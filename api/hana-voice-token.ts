import dns from 'node:dns';

try {
  dns.setDefaultResultOrder?.('ipv4first');
} catch {
  // ignore in non-Node runtimes
}

import {
  buildNpcSystemInstruction,
  type NpcAgentRequestPayload,
} from './npc-agent.ts';

/**
 * Vercel Serverless Function: `/api/hana-voice-token`
 * Mints a single-use Gemini Live ephemeral token for a voice conversation
 * with Hana (property & housing agent and city guide, Central Plaza).
 *
 * The token is locked on the server to the `gemini-3.8-live` model, audio
 * responses, the warm Sulafat voice, and Hana's server-built system
 * instruction, so the browser can only ever hold a short-lived token — the
 * GEMINI_API_KEY never leaves the server. Voice is conversation-only: the
 * instruction forbids confirming or executing any purchase, exchange, or
 * price negotiation by voice; those stay in the text chat and its on-screen
 * confirmation buttons.
 */

export interface HanaVoiceTokenRequestPayload {
  liveState?: NpcAgentRequestPayload['liveState'];
}

export interface HanaVoiceTokenResponsePayload {
  ok: boolean;
  token?: string;
  error?: string;
}

const HANA_LIVE_MODEL = 'gemini-3.8-live';
const HANA_LIVE_VOICE_NAME = 'Sulafat';
const AUTH_TOKENS_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/auth_tokens';

export function buildHanaVoiceInstruction(
  liveState: NpcAgentRequestPayload['liveState'],
): string {
  const baseInstruction = buildNpcSystemInstruction('lobby_cafe', liveState);
  return [
    baseInstruction,
    '',
    'VOICE SESSION RULES (these override the text-chat rules above wherever they differ):',
    '- You are speaking out loud with the player through a microphone and speaker, not typing. Keep every reply to one or two short, natural spoken sentences. Never read out lists, tables, item IDs, or long figures; mention a number only when it truly matters and say it simply.',
    '- Never append, speak, or describe any [[ACTION:...]] tag, and never use the in-chat transaction or teleport cards in this voice session.',
    '- Voice is only for friendly conversation, questions, and city guidance. Buying, selling, exchanging, claiming bonuses, and price negotiation NEVER happen by voice and you cannot confirm them here: if the player asks for any of those, warmly point them to the buttons and text chat in this same window, where every purchase is shown and confirmed on screen before anything is spent. Never state a final price, agree a trade, or say a purchase or exchange is done in this voice session.',
    '- Match the language the player is speaking, stay warm and in character as Hana, and keep the same plain style as your text chat: no emojis, no markdown, no developer jargon.',
  ].join('\n');
}

export async function handleHanaVoiceTokenRequest(
  body: HanaVoiceTokenRequestPayload,
  apiKeyOverride?: string,
): Promise<{ status: number; payload: HanaVoiceTokenResponsePayload }> {
  const apiKey = (apiKeyOverride ?? process.env.GEMINI_API_KEY ?? '').trim();
  if (!apiKey) {
    return {
      status: 503,
      payload: { ok: false, error: 'GEMINI_API_KEY is not configured on the server.' },
    };
  }

  const instruction = buildHanaVoiceInstruction(body?.liveState);
  const now = Date.now();

  try {
    const response = await fetch(AUTH_TOKENS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      signal: AbortSignal.timeout(8500),
      body: JSON.stringify({
        uses: 1,
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: `models/${HANA_LIVE_MODEL}`,
          config: {
            sessionResumption: {},
            responseModalities: ['AUDIO'],
            systemInstruction: {
              parts: [{ text: instruction }],
            },
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: HANA_LIVE_VOICE_NAME },
              },
            },
          },
        },
      }),
    });

    const data = (await response.json()) as {
      name?: string;
      error?: { message?: string };
    };

    if (!response.ok || !data?.name) {
      return {
        status: 502,
        payload: {
          ok: false,
          error: data?.error?.message || `Token request failed (HTTP ${response.status}).`,
        },
      };
    }

    return { status: 200, payload: { ok: true, token: data.name } };
  } catch (err) {
    return {
      status: 502,
      payload: {
        ok: false,
        error: err instanceof Error ? err.message : 'Network timeout minting voice token.',
      },
    };
  }
}

const HANA_VOICE_TOKEN_ALLOWED_ORIGINS = [
  'https://cettac1716.github.io',
  'https://buddies-rouge.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
];

export default async function handler(req: any, res: any): Promise<void> {
  const requestOrigin = String(req.headers?.origin || '');
  if (HANA_VOICE_TOKEN_ALLOWED_ORIGINS.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const result = await handleHanaVoiceTokenRequest(body);
    res.status(result.status).json(result.payload);
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Invalid JSON request body.',
    });
  }
}
