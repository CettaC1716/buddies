import { resolveApiUrl } from '../lib/nearClient';

/**
 * Hana voice chat client (Gemini Live, conversation-only test).
 *
 * Flow: the caller invokes `startHanaVoiceChat` from the player's tap on the
 * Voice button in Hana's chat. The microphone is requested at that moment —
 * never on page load or chat open. A single-use ephemeral token is minted by
 * `/api/hana-voice-token` with Hana's model, voice, and system instruction
 * locked in on the server; this client only opens the constrained Live
 * WebSocket with that token, streams 16 kHz microphone PCM, and plays back
 * the 24 kHz PCM replies. Every failure path ends the session quietly and
 * leaves the text chat untouched.
 */

export type HanaVoiceChatStatus = 'connecting' | 'live' | 'denied' | 'error' | 'off';

export interface HanaVoiceChatSession {
  stop: () => void;
}

export interface StartHanaVoiceChatOptions {
  liveState?: Record<string, unknown>;
  onStatus?: (status: HanaVoiceChatStatus) => void;
  onTranscript?: (speaker: 'player' | 'hana', text: string) => void;
}

const LIVE_MODEL = 'models/gemini-3.8-live';
const LIVE_WS_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';
const MIC_SAMPLE_RATE = 16000;
const PLAYBACK_SAMPLE_RATE = 24000;
const CONNECT_TIMEOUT_MS = 15000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function resampleToRate(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outLength = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i += 1) {
    const srcIndex = i * ratio;
    const base = Math.floor(srcIndex);
    const frac = srcIndex - base;
    const a = input[base] ?? 0;
    const b = input[Math.min(base + 1, input.length - 1)] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

function floatToPcm16(input: Float32Array): Uint8Array {
  const bytes = new Uint8Array(input.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < input.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, Math.round(clamped * 32767), true);
  }
  return bytes;
}

function isMicDeniedError(err: unknown): boolean {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return true;
  }
  if (err instanceof DOMException) {
    return (
      err.name === 'NotAllowedError' ||
      err.name === 'NotFoundError' ||
      err.name === 'OverconstrainedError' ||
      err.name === 'SecurityError'
    );
  }
  return false;
}

export async function startHanaVoiceChat(
  options: StartHanaVoiceChatOptions,
): Promise<HanaVoiceChatSession | null> {
  const onStatus = options.onStatus ?? (() => undefined);
  onStatus('connecting');

  // 1. Microphone first: the permission prompt belongs to the player's tap,
  // and no token is minted if the mic is unavailable or denied.
  let stream: MediaStream;
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new DOMException('No microphone available', 'NotFoundError');
    }
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
  } catch (err) {
    onStatus(isMicDeniedError(err) ? 'denied' : 'error');
    return null;
  }

  const stopTracks = () => {
    for (const track of stream.getTracks()) {
      try {
        track.stop();
      } catch {
        // already stopped
      }
    }
  };

  // 2. Mint the locked ephemeral token from our own server route.
  let token: string;
  try {
    const res = await fetch(resolveApiUrl('/api/hana-voice-token'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ liveState: options.liveState ?? {} }),
    });
    const data = (await res.json()) as { ok?: boolean; token?: string };
    if (!res.ok || !data?.ok || !data.token) {
      throw new Error('Voice token request failed.');
    }
    token = data.token;
  } catch {
    stopTracks();
    onStatus('error');
    return null;
  }

  // 3. Audio pipeline + constrained Live WebSocket session.
  const AudioContextCtor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    stopTracks();
    onStatus('error');
    return null;
  }
  const audioCtx = new AudioContextCtor();
  void audioCtx.resume().catch(() => undefined);

  let stopped = false;
  let setupDone = false;
  let ws: WebSocket | null = null;
  let resumptionHandle: string | null = null;
  let reconnectAttempted = false;
  let playCursor = 0;
  let settleStart: ((session: HanaVoiceChatSession | null) => void) | null = null;
  const activeSources = new Set<AudioBufferSourceNode>();

  const sourceNode = audioCtx.createMediaStreamSource(stream);
  const processor = audioCtx.createScriptProcessor(4096, 1, 1);
  const muteGain = audioCtx.createGain();
  muteGain.gain.value = 0;
  sourceNode.connect(processor);
  processor.connect(muteGain);
  muteGain.connect(audioCtx.destination);

  const flushPlayback = () => {
    for (const src of activeSources) {
      try {
        src.stop();
      } catch {
        // already ended
      }
    }
    activeSources.clear();
    playCursor = 0;
  };

  const enqueueAudio = (base64: string) => {
    try {
      const bytes = base64ToBytes(base64);
      const usable = bytes.byteLength - (bytes.byteLength % 2);
      if (usable <= 0) return;
      const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, usable / 2);
      const buffer = audioCtx.createBuffer(1, pcm.length, PLAYBACK_SAMPLE_RATE);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < pcm.length; i += 1) {
        channel[i] = pcm[i] / 32768;
      }
      const src = audioCtx.createBufferSource();
      src.buffer = buffer;
      src.connect(audioCtx.destination);
      const startAt = Math.max(audioCtx.currentTime + 0.05, playCursor);
      src.start(startAt);
      playCursor = startAt + buffer.duration;
      activeSources.add(src);
      src.onended = () => {
        activeSources.delete(src);
      };
    } catch {
      // A malformed audio chunk never breaks the session.
    }
  };

  const teardownAudio = () => {
    processor.onaudioprocess = null;
    try {
      processor.disconnect();
    } catch {
      // already disconnected
    }
    try {
      sourceNode.disconnect();
    } catch {
      // already disconnected
    }
    try {
      muteGain.disconnect();
    } catch {
      // already disconnected
    }
    flushPlayback();
    stopTracks();
    void audioCtx.close().catch(() => undefined);
  };

  const closeSocket = () => {
    if (ws) {
      const socket = ws;
      ws = null;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      try {
        socket.close();
      } catch {
        // already closed
      }
    }
  };

  const failSession = () => {
    if (stopped) return;
    stopped = true;
    closeSocket();
    teardownAudio();
    onStatus('error');
    const settle = settleStart;
    settleStart = null;
    settle?.(null);
  };

  const session: HanaVoiceChatSession = {
    stop: () => {
      if (stopped) return;
      stopped = true;
      closeSocket();
      teardownAudio();
      const settle = settleStart;
      settleStart = null;
      settle?.(null);
    },
  };

  processor.onaudioprocess = (event) => {
    if (stopped || !setupDone || !ws || ws.readyState !== WebSocket.OPEN) return;
    const input = event.inputBuffer.getChannelData(0);
    const resampled = resampleToRate(input, audioCtx.sampleRate, MIC_SAMPLE_RATE);
    const pcmBytes = floatToPcm16(resampled);
    try {
      ws.send(
        JSON.stringify({
          realtimeInput: {
            audio: {
              data: bytesToBase64(pcmBytes),
              mimeType: `audio/pcm;rate=${MIC_SAMPLE_RATE}`,
            },
          },
        }),
      );
    } catch {
      // Socket went away mid-send; onclose decides the session state.
    }
  };

  const connect = (isResume: boolean) => {
    const socket = new WebSocket(`${LIVE_WS_URL}?access_token=${token}`);
    ws = socket;
    setupDone = false;
    let inputTranscriptBuffer = '';
    let outputTranscriptBuffer = '';

    socket.onopen = () => {
      const setup: Record<string, unknown> = {
        model: LIVE_MODEL,
        generationConfig: { responseModalities: ['AUDIO'] },
      };
      if (isResume && resumptionHandle) {
        setup.sessionResumption = { handle: resumptionHandle };
      }
      try {
        socket.send(JSON.stringify({ setup }));
      } catch {
        failSession();
        return;
      }
      const settle = settleStart;
      settleStart = null;
      settle?.(session);
    };

    socket.onmessage = (event) => {
      let msg: {
        setupComplete?: unknown;
        sessionResumptionUpdate?: { newHandle?: string; resumable?: boolean };
        serverContent?: {
          interrupted?: boolean;
          inputTranscription?: { text?: string; finished?: boolean };
          outputTranscription?: { text?: string; finished?: boolean };
          modelTurn?: {
            parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }>;
          };
        };
      };
      try {
        msg = JSON.parse(String(event.data)) as typeof msg;
      } catch {
        return;
      }
      if (msg.setupComplete) {
        setupDone = true;
        onStatus('live');
        return;
      }
      if (msg.sessionResumptionUpdate) {
        if (msg.sessionResumptionUpdate.newHandle) {
          resumptionHandle = msg.sessionResumptionUpdate.newHandle;
        }
        if (msg.sessionResumptionUpdate.resumable === false) {
          resumptionHandle = null;
        }
      }
      const serverContent = msg.serverContent;
      if (serverContent) {
        if (serverContent.inputTranscription) {
          inputTranscriptBuffer += serverContent.inputTranscription.text ?? '';
          if (serverContent.inputTranscription.finished) {
            const text = inputTranscriptBuffer.trim();
            inputTranscriptBuffer = '';
            if (text) options.onTranscript?.('player', text);
          }
        }
        if (serverContent.outputTranscription) {
          outputTranscriptBuffer += serverContent.outputTranscription.text ?? '';
          if (serverContent.outputTranscription.finished) {
            const text = outputTranscriptBuffer.trim();
            outputTranscriptBuffer = '';
            if (text) options.onTranscript?.('hana', text);
          }
        }
        if (serverContent.interrupted) {
          flushPlayback();
        }
        const parts = serverContent.modelTurn?.parts ?? [];
        for (const part of parts) {
          const data = part?.inlineData?.data;
          if (typeof data === 'string' && data) {
            enqueueAudio(data);
          }
        }
      }
    };

    socket.onclose = () => {
      if (stopped) return;
      // Live connections roll roughly every 10 minutes; resume once on the
      // same token with the stored handle before giving up.
      if (resumptionHandle && !reconnectAttempted) {
        reconnectAttempted = true;
        connect(true);
        return;
      }
      failSession();
    };

    socket.onerror = () => {
      // onclose always follows and decides resumption vs failure.
    };
  };

  return new Promise<HanaVoiceChatSession | null>((resolve) => {
    settleStart = resolve;
    try {
      connect(false);
    } catch {
      failSession();
    }
    // Bound the wait for the first connection so a dead socket can never
    // leave the caller hanging.
    setTimeout(() => {
      if (settleStart) {
        failSession();
      }
    }, CONNECT_TIMEOUT_MS);
  });
}
