import { clamp, CollisionMaterialTag, computeCollisionAudioParams } from './buddiesBlitzRules';

/**
 * Authentic Buddies Blitz Audio & Physics Impact Sound Engine
 * Loads and decodes real bundled Blitz `.mp3` audio files from `/assets/buddies/audio/`
 * (`hit-metal.mp3`, `hit-wood.mp3`, `hit-concrete.mp3`, `hit-brick-01.mp3`, `hit-brick-02.mp3`,
 * `hit-plastic.mp3`, `hit-generic.mp3`, `barrel-explode.mp3`, `player-move.mp3`, `player-boost.mp3`,
 * `player-shoot.mp3`, `grass.mp3`, `button-click.mp3`, `collect-gear.mp3`, `victory-01.mp3`, etc.)
 * with Web Audio API pitch/volume modulation (`playbackRate` 0.90–1.15 proportional to `impactSpeed`)
 * and instant procedural Web Audio synthesis fallback.
 */

export type BlitzSampleKey =
  | 'hit-metal'
  | 'hit-wood'
  | 'hit-concrete'
  | 'hit-brick-01'
  | 'hit-brick-02'
  | 'hit-plastic'
  | 'hit-generic'
  | 'barrel-explode'
  | 'player-explode'
  | 'player-shoot'
  | 'boss-shoot-02'
  | 'player-hit'
  | 'boss-hit'
  | 'fodder-hit'
  | 'player-move'
  | 'player-boost'
  | 'stunned'
  | 'grass'
  | 'button-click'
  | 'collect-gear'
  | 'release'
  | 'victory-01';

const BLITZ_AUDIO_PATHS: Record<BlitzSampleKey, string> = {
  'hit-metal': '/assets/buddies/audio/sfx/physics/hit-metal.mp3',
  'hit-wood': '/assets/buddies/audio/sfx/physics/hit-wood.mp3',
  'hit-concrete': '/assets/buddies/audio/sfx/physics/hit-concrete.mp3',
  'hit-brick-01': '/assets/buddies/audio/sfx/physics/hit-brick-01.mp3',
  'hit-brick-02': '/assets/buddies/audio/sfx/physics/hit-brick-02.mp3',
  'hit-plastic': '/assets/buddies/audio/sfx/physics/hit-plastic.mp3',
  'hit-generic': '/assets/buddies/audio/sfx/physics/hit-generic.mp3',
  'barrel-explode': '/assets/buddies/audio/sfx/vfx/barrel-explode.mp3',
  'player-explode': '/assets/buddies/audio/sfx/player/player-explode.mp3',
  'player-shoot': '/assets/buddies/audio/sfx/player/player-shoot.mp3',
  'boss-shoot-02': '/assets/buddies/audio/sfx/enemy/boss-shoot-02.mp3',
  'player-hit': '/assets/buddies/audio/sfx/player/player-hit.mp3',
  'boss-hit': '/assets/buddies/audio/sfx/enemy/boss-hit.mp3',
  'fodder-hit': '/assets/buddies/audio/sfx/enemy/fodder-hit.mp3',
  'player-move': '/assets/buddies/audio/sfx/player/player-move.mp3',
  'player-boost': '/assets/buddies/audio/sfx/player/player-boost.mp3',
  stunned: '/assets/buddies/audio/sfx/vfx/stunned.mp3',
  grass: '/assets/buddies/audio/sfx/object/grass.mp3',
  'button-click': '/assets/buddies/audio/ui/button-click.mp3',
  'collect-gear': '/assets/buddies/audio/sfx/object/collect-gear.mp3',
  release: '/assets/buddies/audio/sfx/grab-mode/release.mp3',
  'victory-01': '/assets/buddies/audio/sfx/object/victory-01.mp3',
};

interface ActiveLoopVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  key: BlitzSampleKey;
}

export interface TacticalAudioSpec {
  masterBus: {
    lowPassCutoffHz: number;
    compressorThresholdDb: number;
    compressorRatio: number;
  };
  skyshield: {
    radarLockChirpStartHz: number;
    radarLockChirpEndHz: number;
    radarLockChirpDurationSec: number;
    radarLockChirpRepeats: number;
    servoStartHz: number;
    servoEndHz: number;
    burstIntervalMs: number;
    shotPunchStartHz: number;
    shotPunchEndHz: number;
    shotPunchDurationSec: number;
    shotNoiseBandpassHz: number;
    shotNoiseQ: number;
    shotNoiseDurationSec: number;
    flakSubStartHz: number;
    flakSubEndHz: number;
    flakSubDurationSec: number;
    flakSnapBandpassHz: number;
  };
  fighterJet: {
    lfoRateHz: number;
    coreOscHz: number;
    noiseBandpassHz: number;
    noiseQ: number;
    burstDurationSec: number;
    dopplerStartHz: number;
    dopplerPeakHz: number;
    dopplerEndHz: number;
  };
  bazookaLaunch: {
    subStartHz: number;
    subEndHz: number;
    subDurationSec: number;
    whooshStartHz: number;
    whooshEndHz: number;
    whooshQ: number;
  };
  tacticalExplosion: {
    subStartHz: number;
    subEndHz: number;
    durationSec: number;
    rumbleLowPassStartHz: number;
    rumbleLowPassEndHz: number;
    usesSoftClipWaveShaper: boolean;
  };
  firearm: {
    punchStartHz: number;
    punchEndHz: number;
    punchDurationSec: number;
    noiseDurationSec: number;
    noiseLowPassHz: number;
  };
}

export const TACTICAL_AUDIO_SPEC: TacticalAudioSpec = {
  masterBus: {
    lowPassCutoffHz: 4500,
    compressorThresholdDb: -6,
    compressorRatio: 12,
  },
  skyshield: {
    radarLockChirpStartHz: 1400,
    radarLockChirpEndHz: 1800,
    radarLockChirpDurationSec: 0.04,
    radarLockChirpRepeats: 2,
    servoStartHz: 120,
    servoEndHz: 220,
    burstIntervalMs: 40,
    shotPunchStartHz: 260,
    shotPunchEndHz: 70,
    shotPunchDurationSec: 0.03,
    shotNoiseBandpassHz: 1400,
    shotNoiseQ: 3.0,
    shotNoiseDurationSec: 0.035,
    flakSubStartHz: 110,
    flakSubEndHz: 40,
    flakSubDurationSec: 0.12,
    flakSnapBandpassHz: 900,
  },
  fighterJet: {
    lfoRateHz: 60,
    coreOscHz: 130,
    noiseBandpassHz: 650,
    noiseQ: 2.0,
    burstDurationSec: 0.42,
    dopplerStartHz: 250,
    dopplerPeakHz: 900,
    dopplerEndHz: 200,
  },
  bazookaLaunch: {
    subStartHz: 180,
    subEndHz: 45,
    subDurationSec: 0.15,
    whooshStartHz: 1200,
    whooshEndHz: 300,
    whooshQ: 2.5,
  },
  tacticalExplosion: {
    subStartHz: 90,
    subEndHz: 25,
    durationSec: 0.45,
    rumbleLowPassStartHz: 800,
    rumbleLowPassEndHz: 80,
    usesSoftClipWaveShaper: true,
  },
  firearm: {
    punchStartHz: 300,
    punchEndHz: 60,
    punchDurationSec: 0.05,
    noiseDurationSec: 0.06,
    noiseLowPassHz: 1800,
  },
};

export type BgmMode = 'city' | 'warzone';

interface BossaBarSpec {
  bassRootHz: number;
  bassFifthHz: number;
  chordHz: readonly [number, number, number, number];
  melodyNotes: readonly { step: number; hz: number; durSteps: number }[];
}

// Gentle Sunny Morning Bossa Nova progression in F Major / C Major (~104 BPM)
const CITY_SUNNY_BOSSA_PROGRESSION: readonly BossaBarSpec[] = [
  // Bar 0: Fmaj9
  {
    bassRootHz: 87.31,
    bassFifthHz: 130.81,
    chordHz: [220.0, 261.63, 329.63, 392.0],
    melodyNotes: [
      { step: 2, hz: 523.25, durSteps: 4 },
      { step: 6, hz: 659.25, durSteps: 4 },
      { step: 11, hz: 587.33, durSteps: 4 },
    ],
  },
  // Bar 1: G13
  {
    bassRootHz: 98.0,
    bassFifthHz: 146.83,
    chordHz: [174.61, 246.94, 329.63, 440.0],
    melodyNotes: [
      { step: 0, hz: 659.25, durSteps: 5 },
      { step: 8, hz: 587.33, durSteps: 4 },
      { step: 12, hz: 523.25, durSteps: 4 },
    ],
  },
  // Bar 2: Em9
  {
    bassRootHz: 82.41,
    bassFifthHz: 123.47,
    chordHz: [196.0, 246.94, 293.66, 369.99],
    melodyNotes: [
      { step: 2, hz: 493.88, durSteps: 5 },
      { step: 10, hz: 587.33, durSteps: 5 },
    ],
  },
  // Bar 3: A7(b13)
  {
    bassRootHz: 110.0,
    bassFifthHz: 164.81,
    chordHz: [196.0, 277.18, 349.23, 440.0],
    melodyNotes: [
      { step: 0, hz: 554.37, durSteps: 5 },
      { step: 6, hz: 523.25, durSteps: 4 },
      { step: 11, hz: 440.0, durSteps: 5 },
    ],
  },
  // Bar 4: Dm9
  {
    bassRootHz: 73.42,
    bassFifthHz: 110.0,
    chordHz: [174.61, 220.0, 261.63, 329.63],
    melodyNotes: [
      { step: 2, hz: 440.0, durSteps: 4 },
      { step: 6, hz: 523.25, durSteps: 4 },
      { step: 10, hz: 659.25, durSteps: 5 },
    ],
  },
  // Bar 5: G13
  {
    bassRootHz: 98.0,
    bassFifthHz: 146.83,
    chordHz: [174.61, 246.94, 329.63, 440.0],
    melodyNotes: [
      { step: 0, hz: 587.33, durSteps: 5 },
      { step: 8, hz: 493.88, durSteps: 4 },
      { step: 12, hz: 440.0, durSteps: 4 },
    ],
  },
  // Bar 6: Cmaj9
  {
    bassRootHz: 65.41,
    bassFifthHz: 98.0,
    chordHz: [164.81, 196.0, 246.94, 293.66],
    melodyNotes: [
      { step: 2, hz: 587.33, durSteps: 6 },
      { step: 10, hz: 523.25, durSteps: 5 },
    ],
  },
  // Bar 7: Gm9 -> C13 Turnaround
  {
    bassRootHz: 98.0,
    bassFifthHz: 130.81,
    chordHz: [233.08, 293.66, 349.23, 440.0],
    melodyNotes: [
      { step: 0, hz: 440.0, durSteps: 4 },
      { step: 6, hz: 466.16, durSteps: 4 },
      { step: 11, hz: 523.25, durSteps: 5 },
    ],
  },
];

// Chill Upbeat Bossa / Lo-Fi Groove in E Dorian / G Major (~118 BPM) for Warzone
const WARZONE_CHILL_BEAT_BOSSA_PROGRESSION: readonly BossaBarSpec[] = [
  // Bar 0: Em9
  {
    bassRootHz: 82.41,
    bassFifthHz: 123.47,
    chordHz: [196.0, 246.94, 293.66, 369.99],
    melodyNotes: [
      { step: 0, hz: 587.33, durSteps: 3 },
      { step: 6, hz: 659.25, durSteps: 4 },
      { step: 11, hz: 493.88, durSteps: 4 },
    ],
  },
  // Bar 1: Am9
  {
    bassRootHz: 110.0,
    bassFifthHz: 164.81,
    chordHz: [196.0, 261.63, 329.63, 493.88],
    melodyNotes: [
      { step: 2, hz: 523.25, durSteps: 4 },
      { step: 8, hz: 587.33, durSteps: 3 },
      { step: 12, hz: 659.25, durSteps: 4 },
    ],
  },
  // Bar 2: D13
  {
    bassRootHz: 73.42,
    bassFifthHz: 110.0,
    chordHz: [185.0, 261.63, 329.63, 493.88],
    melodyNotes: [
      { step: 0, hz: 739.99, durSteps: 4 },
      { step: 6, hz: 659.25, durSteps: 4 },
      { step: 11, hz: 587.33, durSteps: 4 },
    ],
  },
  // Bar 3: Gmaj9
  {
    bassRootHz: 98.0,
    bassFifthHz: 146.83,
    chordHz: [185.0, 246.94, 293.66, 440.0],
    melodyNotes: [
      { step: 2, hz: 587.33, durSteps: 5 },
      { step: 10, hz: 493.88, durSteps: 5 },
    ],
  },
  // Bar 4: Cmaj9
  {
    bassRootHz: 65.41,
    bassFifthHz: 98.0,
    chordHz: [164.81, 196.0, 246.94, 293.66],
    melodyNotes: [
      { step: 0, hz: 523.25, durSteps: 3 },
      { step: 6, hz: 587.33, durSteps: 4 },
      { step: 12, hz: 659.25, durSteps: 4 },
    ],
  },
  // Bar 5: F#m7b5
  {
    bassRootHz: 92.5,
    bassFifthHz: 130.81,
    chordHz: [164.81, 220.0, 261.63, 329.63],
    melodyNotes: [
      { step: 2, hz: 659.25, durSteps: 4 },
      { step: 8, hz: 587.33, durSteps: 4 },
      { step: 13, hz: 523.25, durSteps: 3 },
    ],
  },
  // Bar 6: B7(b9)
  {
    bassRootHz: 61.74,
    bassFifthHz: 92.5,
    chordHz: [155.56, 220.0, 261.63, 369.99],
    melodyNotes: [
      { step: 0, hz: 493.88, durSteps: 4 },
      { step: 6, hz: 523.25, durSteps: 4 },
      { step: 11, hz: 493.88, durSteps: 4 },
    ],
  },
  // Bar 7: Em9 Turnaround
  {
    bassRootHz: 82.41,
    bassFifthHz: 123.47,
    chordHz: [196.0, 246.94, 293.66, 369.99],
    melodyNotes: [
      { step: 2, hz: 659.25, durSteps: 5 },
      { step: 10, hz: 587.33, durSteps: 5 },
    ],
  },
];

export function getTacticalAudioSpec(): TacticalAudioSpec {
  return TACTICAL_AUDIO_SPEC;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterInputGain: GainNode | null = null;
  private masterLowShelfFilter: BiquadFilterNode | null = null;
  private masterLowPassFilter: BiquadFilterNode | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private bgmBusGain: GainNode | null = null;
  private bgmWarmFilter: BiquadFilterNode | null = null;
  private buffers = new Map<BlitzSampleKey, AudioBuffer>();
  private rawAudioBuffers = new Map<BlitzSampleKey, ArrayBuffer>();
  private loadingKeys = new Set<BlitzSampleKey>();
  private preloadStarted = false;
  private audioPreloadPromise: Promise<void> | null = null;
  private audioPreloadComplete = false;
  private activeLoops = new Map<BlitzSampleKey, ActiveLoopVoice>();
  private lastKeyPlayMs = new Map<string, number>();
  private recentExplosionTimestamps: number[] = [];
  private pinkNoiseBuffer: AudioBuffer | null = null;
  private brownNoiseBuffer: AudioBuffer | null = null;
  private softClipCurves = new Map<number, Float32Array<ArrayBuffer>>();
  private currentSpatialNode: GainNode | null = null;

  private bgmStarted = false;
  private bgmMode: BgmMode = 'city';
  private bgmVolume = 0.34;
  private bgmTimerId: ReturnType<typeof setInterval> | null = null;
  private bgmNextNoteTime = 0;
  private bgmStepIndex = 0;
  private bgmUnlockBound = false;

  private sessionMusicTrack: 'none' | 'landing' | 'ingame' = 'none';
  private landingBgmAudio: HTMLAudioElement | null = null;
  private ingameBgmAudio: HTMLAudioElement | null = null;
  private sessionMusicUnlockBound = false;
  private sessionLoopMonitorId: ReturnType<typeof setInterval> | null = null;
  private sessionFadeRafId: number | null = null;
  private sessionFadeMultiplier = 1.0;
  private isSessionLoopFading = false;

  // Web Audio BGM softening chain (9000Hz lowpass + high-shelf cut + gentle compressor)
  private sessionBgmFilterChainReady = false;
  private landingMediaSourceWired = false;
  private ingameMediaSourceWired = false;
  private sessionBgmInputGain: GainNode | null = null;

  // Clean loop segments (excludes noisy/crowded mid-song brass & transition sections)
  private static readonly LANDING_LOOP_START_SEC = 0.2;
  private static readonly LANDING_LOOP_END_SEC = 48.2;
  private static readonly INGAME_LOOP_START_SEC = 21.0;
  private static readonly INGAME_LOOP_END_SEC = 60.8;
  private static readonly LOOP_FADE_MS = 180;

  private _muted = false;
  private _masterVolume = 1.0;

  public get muted(): boolean {
    return this._muted;
  }

  public set muted(val: boolean) {
    this._muted = Boolean(val);
    if (this._muted) {
      this.stopAllLoops();
      this.clearBgmScheduler();
      if (this.ctx && this.masterInputGain) {
        this.masterInputGain.gain.setValueAtTime(0, this.ctx.currentTime);
      }
      if (this.ctx && this.bgmBusGain) {
        this.bgmBusGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
      }
    } else {
      if (this.ctx && this.masterInputGain) {
        this.masterInputGain.gain.setValueAtTime(1.58 * this._masterVolume, this.ctx.currentTime);
      }
      if (this.ctx && this.bgmBusGain) {
        this.bgmBusGain.gain.setTargetAtTime(
          this.bgmVolume * this._masterVolume,
          this.ctx.currentTime,
          0.08,
        );
      }
      if (this.bgmStarted) {
        this.ensureBgmSchedulerRunning();
      }
    }
    this.syncSessionMusicPlayback();
  }

  public get masterVolume(): number {
    return this._masterVolume;
  }

  public setMasterVolume(vol: number): void {
    this._masterVolume = clamp(vol, 0, 1);
    if (this.ctx && this.masterInputGain) {
      this.masterInputGain.gain.setValueAtTime(
        this._muted ? 0 : 1.58 * this._masterVolume,
        this.ctx.currentTime,
      );
    }
    if (this.ctx && this.bgmBusGain) {
      this.bgmBusGain.gain.setTargetAtTime(
        this._muted ? 0 : this.bgmVolume * this._masterVolume,
        this.ctx.currentTime,
        0.05,
      );
    }
    this.syncSessionMusicPlayback();
  }

  /**
   * Builds a gentle Web Audio softening chain for HTMLAudioElement BGM tracks:
   * High-Shelf (-3.5dB @ 6500Hz) -> Low-Pass (9000Hz, Q=0.65) -> Gentle Glue Compressor -> Destination.
   * Only wires MediaElementAudioSourceNode once the AudioContext is actively running so playback is never blocked.
   */
  private ensureSessionBgmFilterChain(): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (
      !this.sessionBgmFilterChainReady &&
      typeof this.ctx.createBiquadFilter === 'function' &&
      typeof this.ctx.createDynamicsCompressor === 'function'
    ) {
      const now = this.ctx.currentTime;
      const inGain = this.ctx.createGain();
      inGain.gain.setValueAtTime(1.0, now);

      // Soften sharp upper-treble transients above 6.5kHz
      const highShelf = this.ctx.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.setValueAtTime(6500, now);
      highShelf.gain.setValueAtTime(-3.5, now);

      // Warm 9000Hz Low-Pass Filter so high frequencies never pierce the ears
      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(9000, now);
      lowpass.Q.setValueAtTime(0.65, now);

      // Gentle dynamic smoothing so busy passages stay even and unobtrusive
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-20, now);
      comp.knee.setValueAtTime(14, now);
      comp.ratio.setValueAtTime(2.6, now);
      comp.attack.setValueAtTime(0.015, now);
      comp.release.setValueAtTime(0.18, now);

      inGain.connect(highShelf);
      highShelf.connect(lowpass);
      lowpass.connect(comp);
      comp.connect(this.ctx.destination);

      this.sessionBgmInputGain = inGain;
      this.sessionBgmFilterChainReady = true;
    }

    if (
      this.sessionBgmInputGain &&
      typeof this.ctx.createMediaElementSource === 'function'
    ) {
      if (this.landingBgmAudio && !this.landingMediaSourceWired) {
        try {
          const src = this.ctx.createMediaElementSource(this.landingBgmAudio);
          src.connect(this.sessionBgmInputGain);
          this.landingMediaSourceWired = true;
        } catch {
          this.landingMediaSourceWired = true;
        }
      }
      if (this.ingameBgmAudio && !this.ingameMediaSourceWired) {
        try {
          const src = this.ctx.createMediaElementSource(this.ingameBgmAudio);
          src.connect(this.sessionBgmInputGain);
          this.ingameMediaSourceWired = true;
        } catch {
          this.ingameMediaSourceWired = true;
        }
      }
    }
  }

  private applySessionAudioVolumes(): void {
    const baseVolume = this._muted
      ? 0
      : clamp(this.bgmVolume * this._masterVolume * 0.95, 0, 1);
    const effectiveVolume = clamp(baseVolume * this.sessionFadeMultiplier, 0, 1);

    if (this.landingBgmAudio) {
      this.landingBgmAudio.muted = this._muted;
      this.landingBgmAudio.volume = effectiveVolume;
    }
    if (this.ingameBgmAudio) {
      this.ingameBgmAudio.muted = this._muted;
      this.ingameBgmAudio.volume = effectiveVolume;
    }
  }

  /**
   * Performs a smooth ~180ms volume fade-out to near-zero, seeks to `loopStartSec`,
   * and smoothly fades back in over ~180ms so loop boundaries never sound abrupt.
   */
  private triggerSmoothLoopJump(audio: HTMLAudioElement, loopStartSec: number): void {
    if (this.isSessionLoopFading) return;
    this.isSessionLoopFading = true;
    if (this.sessionFadeRafId !== null && typeof window !== 'undefined') {
      window.clearInterval(this.sessionFadeRafId);
      this.sessionFadeRafId = null;
    }

    const fadeMs = SoundEngine.LOOP_FADE_MS;
    const stepMs = 20;
    const totalSteps = Math.max(4, Math.round(fadeMs / stepMs));
    let step = 0;
    let phase: 'out' | 'in' = 'out';

    this.sessionFadeRafId = window.setInterval(() => {
      step += 1;
      const t = clamp(step / totalSteps, 0, 1);
      if (phase === 'out') {
        // Cosine-eased fade out (1.0 -> 0.03) over 180ms
        this.sessionFadeMultiplier = 0.03 + 0.97 * (0.5 * (1 + Math.cos(Math.PI * t)));
        this.applySessionAudioVolumes();
        if (step >= totalSteps) {
          try {
            audio.currentTime = loopStartSec;
          } catch {
            // ignore seek error if not buffered yet
          }
          if (!this._muted && this.sessionMusicTrack !== 'none' && audio.paused) {
            audio.play().catch(() => {});
          }
          phase = 'in';
          step = 0;
        }
      } else {
        // Cosine-eased fade in (0.03 -> 1.0) over 180ms
        this.sessionFadeMultiplier = 0.03 + 0.97 * (0.5 * (1 - Math.cos(Math.PI * t)));
        this.applySessionAudioVolumes();
        if (step >= totalSteps) {
          this.sessionFadeMultiplier = 1.0;
          this.applySessionAudioVolumes();
          this.isSessionLoopFading = false;
          if (this.sessionFadeRafId !== null) {
            window.clearInterval(this.sessionFadeRafId);
            this.sessionFadeRafId = null;
          }
        }
      }
    }, stepMs) as unknown as number;
  }

  private startSessionLoopMonitor(): void {
    if (this.sessionLoopMonitorId !== null || typeof window === 'undefined') return;
    const fadeLeadSec = SoundEngine.LOOP_FADE_MS / 1000;
    this.sessionLoopMonitorId = setInterval(() => {
      if (this._muted || this.sessionMusicTrack === 'none') return;
      this.ensureSessionBgmFilterChain();

      if (this.sessionMusicTrack === 'landing' && this.landingBgmAudio && !this.landingBgmAudio.paused) {
        const cur = this.landingBgmAudio.currentTime;
        if (cur >= SoundEngine.LANDING_LOOP_END_SEC - fadeLeadSec) {
          this.triggerSmoothLoopJump(this.landingBgmAudio, SoundEngine.LANDING_LOOP_START_SEC);
        }
      } else if (this.sessionMusicTrack === 'ingame' && this.ingameBgmAudio && !this.ingameBgmAudio.paused) {
        const cur = this.ingameBgmAudio.currentTime;
        if (cur < SoundEngine.INGAME_LOOP_START_SEC - 0.25 && !this.isSessionLoopFading) {
          try {
            this.ingameBgmAudio.currentTime = SoundEngine.INGAME_LOOP_START_SEC;
          } catch {
            // ignore
          }
        } else if (cur >= SoundEngine.INGAME_LOOP_END_SEC - fadeLeadSec) {
          this.triggerSmoothLoopJump(this.ingameBgmAudio, SoundEngine.INGAME_LOOP_START_SEC);
        }
      }
    }, 60);
  }

  private stopSessionLoopMonitor(): void {
    if (this.sessionLoopMonitorId !== null) {
      clearInterval(this.sessionLoopMonitorId);
      this.sessionLoopMonitorId = null;
    }
    if (this.sessionFadeRafId !== null && typeof window !== 'undefined') {
      window.clearInterval(this.sessionFadeRafId);
      this.sessionFadeRafId = null;
    }
    this.isSessionLoopFading = false;
    this.sessionFadeMultiplier = 1.0;
  }

  private ensureSessionMusicElements(): void {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
    if (!this.landingBgmAudio) {
      const landingAudio = new Audio('/assets/aistudio/Funkopolis_Game_Title_Soundtrack_5d70c7e1.mp3');
      landingAudio.preload = 'none';
      landingAudio.loop = true;
      landingAudio.addEventListener('timeupdate', () => {
        if (
          landingAudio.currentTime >=
          SoundEngine.LANDING_LOOP_END_SEC - SoundEngine.LOOP_FADE_MS / 1000
        ) {
          this.triggerSmoothLoopJump(landingAudio, SoundEngine.LANDING_LOOP_START_SEC);
        }
      });
      this.landingBgmAudio = landingAudio;
    }
    if (!this.ingameBgmAudio) {
      const ingameAudio = new Audio('/assets/aistudio/Sunny_Shibuya-Style_Urban_BGM_7f85cba2.mp3');
      // Keep preload="none" initially so it never blocks initial 3D loading or landing screen
      ingameAudio.preload = 'none';
      ingameAudio.loop = true;
      ingameAudio.addEventListener('loadedmetadata', () => {
        if (ingameAudio.currentTime < SoundEngine.INGAME_LOOP_START_SEC) {
          try {
            ingameAudio.currentTime = SoundEngine.INGAME_LOOP_START_SEC;
          } catch {
            // ignore
          }
        }
      });
      ingameAudio.addEventListener('timeupdate', () => {
        if (
          ingameAudio.currentTime >=
          SoundEngine.INGAME_LOOP_END_SEC - SoundEngine.LOOP_FADE_MS / 1000
        ) {
          this.triggerSmoothLoopJump(ingameAudio, SoundEngine.INGAME_LOOP_START_SEC);
        }
      });
      this.ingameBgmAudio = ingameAudio;
    }
  }

  /**
   * Asynchronously warms up the in-game BGM audio element after the player leaves
   * the landing screen / enters character creation, without blocking any UI or 3D load.
   */
  public preloadIngameBgmAsync(): void {
    if (typeof window === 'undefined') return;
    this.ensureSessionMusicElements();
    if (this.ingameBgmAudio && this.ingameBgmAudio.preload === 'none') {
      this.ingameBgmAudio.preload = 'auto';
      try {
        this.ingameBgmAudio.load();
      } catch {
        // Ignore background load errors
      }
    }
  }

  private bindSessionMusicUnlock(): void {
    if (this.sessionMusicUnlockBound || typeof window === 'undefined') return;
    this.sessionMusicUnlockBound = true;
    const unlock = () => {
      this.sessionMusicUnlockBound = false;
      this.userInteracted = true;
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      this.ensureCtx();
      this.ensureSessionBgmFilterChain();
      this.syncSessionMusicPlayback();
    };
    window.addEventListener('pointerdown', unlock, { capture: true, once: true });
    window.addEventListener('keydown', unlock, { capture: true, once: true });
  }

  private syncSessionMusicPlayback(): void {
    if (typeof window === 'undefined') return;
    if (this.sessionMusicTrack === 'none' && !this.landingBgmAudio && !this.ingameBgmAudio) {
      return;
    }
    this.ensureSessionMusicElements();
    this.ensureSessionBgmFilterChain();
    this.applySessionAudioVolumes();

    if (this._muted || this.sessionMusicTrack === 'none') {
      this.stopSessionLoopMonitor();
      if (this.landingBgmAudio && !this.landingBgmAudio.paused) {
        this.landingBgmAudio.pause();
      }
      if (this.ingameBgmAudio && !this.ingameBgmAudio.paused) {
        this.ingameBgmAudio.pause();
      }
      return;
    }

    this.startSessionLoopMonitor();

    if (this.sessionMusicTrack === 'landing') {
      if (this.ingameBgmAudio) {
        if (!this.ingameBgmAudio.paused) {
          this.ingameBgmAudio.pause();
        }
        try {
          this.ingameBgmAudio.currentTime = SoundEngine.INGAME_LOOP_START_SEC;
        } catch {
          // ignore
        }
      }
      if (this.landingBgmAudio) {
        if (this.landingBgmAudio.preload === 'none') {
          this.landingBgmAudio.preload = 'auto';
        }
        if (
          this.landingBgmAudio.currentTime < SoundEngine.LANDING_LOOP_START_SEC ||
          this.landingBgmAudio.currentTime >= SoundEngine.LANDING_LOOP_END_SEC
        ) {
          try {
            this.landingBgmAudio.currentTime = SoundEngine.LANDING_LOOP_START_SEC;
          } catch {
            // ignore
          }
        }
        if (this.landingBgmAudio.paused) {
          this.landingBgmAudio.play().catch(() => {
            this.bindSessionMusicUnlock();
          });
        }
      }
    } else if (this.sessionMusicTrack === 'ingame') {
      if (this.landingBgmAudio) {
        if (!this.landingBgmAudio.paused) {
          this.landingBgmAudio.pause();
        }
        try {
          this.landingBgmAudio.currentTime = SoundEngine.LANDING_LOOP_START_SEC;
        } catch {
          // ignore
        }
      }
      if (this.ingameBgmAudio) {
        if (this.ingameBgmAudio.preload === 'none') {
          this.ingameBgmAudio.preload = 'auto';
        }
        if (
          this.ingameBgmAudio.currentTime < SoundEngine.INGAME_LOOP_START_SEC ||
          this.ingameBgmAudio.currentTime >= SoundEngine.INGAME_LOOP_END_SEC
        ) {
          try {
            this.ingameBgmAudio.currentTime = SoundEngine.INGAME_LOOP_START_SEC;
          } catch {
            // ignore
          }
        }
        if (this.ingameBgmAudio.paused) {
          this.ingameBgmAudio.play().catch(() => {
            this.bindSessionMusicUnlock();
          });
        }
      }
    }
  }

  public setSessionMusicTrack(track: 'none' | 'landing' | 'ingame'): void {
    const prevTrack = this.sessionMusicTrack;
    this.sessionMusicTrack = track;
    if (prevTrack !== track) {
      this.isSessionLoopFading = false;
      this.sessionFadeMultiplier = 1.0;
      if (track !== 'none') {
        this.ensureSessionMusicElements();
        if (track === 'landing' && this.landingBgmAudio) {
          try {
            this.landingBgmAudio.currentTime = SoundEngine.LANDING_LOOP_START_SEC;
          } catch {
            // ignore
          }
        } else if (track === 'ingame' && this.ingameBgmAudio) {
          if (this.ingameBgmAudio.preload === 'none') {
            this.ingameBgmAudio.preload = 'auto';
          }
          try {
            this.ingameBgmAudio.currentTime = SoundEngine.INGAME_LOOP_START_SEC;
          } catch {
            // ignore
          }
        }
      }
    }
    this.clearBgmScheduler();
    this.syncSessionMusicPlayback();
  }

  public getSessionMusicTrack(): 'none' | 'landing' | 'ingame' {
    return this.sessionMusicTrack;
  }

  public getBgmMode(): BgmMode {
    return this.bgmMode;
  }

  public setBgmMode(mode: BgmMode): void {
    const nextMode: BgmMode = mode === 'warzone' ? 'warzone' : 'city';
    if (this.bgmMode === nextMode) return;
    this.bgmMode = nextMode;
    const nextBarStep = Math.ceil(this.bgmStepIndex / 16) * 16;
    this.bgmStepIndex = nextBarStep % 128;
    if (this.bgmStarted && !this._muted) {
      this.ensureBgmSchedulerRunning();
    }
  }

  private userInteracted = false;
  private interactionListenersBound = false;

  private bindUserInteractionUnlock(): void {
    if (this.interactionListenersBound || typeof window === 'undefined') return;
    this.interactionListenersBound = true;
    const unlock = () => {
      this.userInteracted = true;
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, { capture: true, once: true });
    window.addEventListener('keydown', unlock, { capture: true, once: true });
  }

  private ensureCtx(): AudioContext | null {
    if (this._muted || typeof window === 'undefined') return null;
    if (!this.userInteracted) {
      const hasActivation =
        typeof navigator !== 'undefined' &&
        'userActivation' in navigator &&
        Boolean((navigator as Navigator & { userActivation?: { hasBeenActive?: boolean } }).userActivation?.hasBeenActive);
      if (hasActivation) {
        this.userInteracted = true;
      } else if (typeof navigator !== 'undefined' && 'userActivation' in navigator) {
        this.bindUserInteractionUnlock();
        return null;
      }
    }
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        if (
          typeof this.ctx.createDynamicsCompressor === 'function' &&
          typeof this.ctx.createBiquadFilter === 'function'
        ) {
          // 1. Pre-bus makeup gain (1.58x * masterVolume) for loud, assertive tactical presence
          const inputGain = this.ctx.createGain();
          inputGain.gain.setValueAtTime(1.58 * this._masterVolume, this.ctx.currentTime);

          // 2. Low-Shelf Punch EQ (+4.8 dB below 145Hz) for chest-thumping weight
          const lowShelf = this.ctx.createBiquadFilter();
          lowShelf.type = 'lowshelf';
          lowShelf.frequency.setValueAtTime(145, this.ctx.currentTime);
          lowShelf.gain.setValueAtTime(4.8, this.ctx.currentTime);

          // 3. Master Low-Pass Filter (~4500Hz) with slight resonant presence (Q=0.85)
          const lpf = this.ctx.createBiquadFilter();
          lpf.type = 'lowpass';
          lpf.frequency.setValueAtTime(
            TACTICAL_AUDIO_SPEC.masterBus.lowPassCutoffHz,
            this.ctx.currentTime,
          );
          lpf.Q.setValueAtTime(0.85, this.ctx.currentTime);

          // 4. Glue Compressor / Limiter
          const comp = this.ctx.createDynamicsCompressor();
          comp.threshold.setValueAtTime(
            TACTICAL_AUDIO_SPEC.masterBus.compressorThresholdDb,
            this.ctx.currentTime,
          );
          comp.knee.setValueAtTime(5, this.ctx.currentTime);
          comp.ratio.setValueAtTime(
            TACTICAL_AUDIO_SPEC.masterBus.compressorRatio,
            this.ctx.currentTime,
          );
          comp.attack.setValueAtTime(0.004, this.ctx.currentTime);
          comp.release.setValueAtTime(0.09, this.ctx.currentTime);

          inputGain.connect(lowShelf);
          lowShelf.connect(lpf);
          lpf.connect(comp);
          comp.connect(this.ctx.destination);

          this.masterInputGain = inputGain;
          this.masterLowShelfFilter = lowShelf;
          this.masterLowPassFilter = lpf;
          this.masterCompressor = comp;

          // Dedicated warm BGM bus (bypasses combat limiter so Sunny Morning Bossa stays silky & uncompressed)
          const bgmFilter = this.ctx.createBiquadFilter();
          bgmFilter.type = 'lowpass';
          bgmFilter.frequency.setValueAtTime(5200, this.ctx.currentTime);
          bgmFilter.Q.setValueAtTime(0.65, this.ctx.currentTime);

          const bgmGain = this.ctx.createGain();
          bgmGain.gain.setValueAtTime(
            this._muted ? 0 : this.bgmVolume * this._masterVolume,
            this.ctx.currentTime,
            );
          bgmFilter.connect(bgmGain);
          bgmGain.connect(this.ctx.destination);
          this.bgmWarmFilter = bgmFilter;
          this.bgmBusGain = bgmGain;
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx && !this.preloadStarted) {
      this.preloadStarted = true;
      this.preloadAllBlitzSamples();
    }
    if (this.ctx && this.bgmStarted && !this._muted && this.bgmTimerId === null) {
      this.startBgmSchedulerForCtx(this.ctx);
    }
    return this.ctx;
  }

  private getBgmDestination(ctx: AudioContext): AudioNode {
    return this.bgmWarmFilter || this.bgmBusGain || ctx.destination;
  }

  private clearBgmScheduler(): void {
    if (this.bgmTimerId !== null) {
      clearInterval(this.bgmTimerId);
      this.bgmTimerId = null;
    }
  }

  public stopBgm(): void {
    this.bgmStarted = false;
    this.clearBgmScheduler();
    this.setSessionMusicTrack('none');
  }

  public startBgm(mode?: BgmMode): void {
    if (mode) {
      this.bgmMode = mode === 'warzone' ? 'warzone' : 'city';
    }
    this.bgmStarted = false;
    this.clearBgmScheduler();
    this.syncSessionMusicPlayback();
  }

  private ensureBgmSchedulerRunning(): void {
    this.clearBgmScheduler();
    this.syncSessionMusicPlayback();
  }

  private startBgmSchedulerForCtx(ctx: AudioContext): void {
    // Dedicated session MP3 soundtracks (Landing & In-Game) replace procedural synth BGM
    this.clearBgmScheduler();
    this.syncSessionMusicPlayback();
    if (!this.bgmStarted || this._muted || this.sessionMusicTrack !== 'none' || this.bgmUnlockBound) {
      return;
    }
    if (this.bgmTimerId !== null) return;
    this.bgmNextNoteTime = ctx.currentTime + 0.06;
    this.bgmTimerId = setInterval(() => {
      if (!this.bgmStarted || this._muted || !this.ctx) {
        this.clearBgmScheduler();
        return;
      }
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
        return;
      }
      const now = this.ctx.currentTime;
      if (this.bgmNextNoteTime < now - 0.3) {
        this.bgmNextNoteTime = now + 0.04;
      }
      const lookaheadSec = 0.24;
      let guard = 0;
      while (this.bgmNextNoteTime < now + lookaheadSec && guard < 8) {
        guard++;
        const isWarzone = this.bgmMode === 'warzone';
        const stepDurSec = isWarzone ? 60 / 118 / 4 : 60 / 104 / 4;
        this.scheduleBossaStep(
          this.ctx,
          this.bgmStepIndex,
          this.bgmNextNoteTime,
          stepDurSec,
          isWarzone,
        );
        this.bgmNextNoteTime += stepDurSec;
        this.bgmStepIndex = (this.bgmStepIndex + 1) % 128;
      }
    }, 110);
  }

  private scheduleBossaStep(
    ctx: AudioContext,
    globalStep: number,
    when: number,
    stepDur: number,
    isWarzone: boolean,
  ): void {
    const barIdx = Math.floor(globalStep / 16) % 8;
    const step = globalStep % 16;
    const isEvenBar = barIdx % 2 === 0;
    const bar = isWarzone
      ? WARZONE_CHILL_BEAT_BOSSA_PROGRESSION[barIdx]
      : CITY_SUNNY_BOSSA_PROGRESSION[barIdx];
    const dest = this.getBgmDestination(ctx);

    // 1. Warm Fender Rhodes Electric Piano Pad (step 0 of every bar)
    if (step === 0) {
      this.triggerBossaRhodesPad(ctx, dest, bar.chordHz, when, stepDur * 15.2, isWarzone ? 0.052 : 0.062);
    }

    // 2. Authentic Brazilian 2-3 Bossa Clave Nylon-String Acoustic Guitar Comping
    const cityGuitarComp = isEvenBar
      ? step === 0 || step === 3 || step === 6 || step === 10 || step === 14
      : step === 2 || step === 6 || step === 9 || step === 12;
    const warzoneGuitarComp = isEvenBar
      ? step === 0 || step === 3 || step === 6 || step === 10 || step === 12 || step === 14
      : step === 2 || step === 6 || step === 9 || step === 12 || step === 15;

    if (isWarzone ? warzoneGuitarComp : cityGuitarComp) {
      const dur = step === 0 || step === 6 ? stepDur * 2.9 : stepDur * 2.1;
      const accent = step === 0 || step === 3 || step === 6 ? 1.0 : 0.78;
      this.triggerBossaNylonStrum(ctx, dest, bar.chordHz, when, dur, (isWarzone ? 0.072 : 0.078) * accent);
    }

    // 3. Warm Acoustic Contrabass (gentle root-fifth surdo feel in City; bouncy pocket in Warzone)
    if (!isWarzone) {
      if (step === 0) {
        this.triggerBossaUprightBass(ctx, dest, bar.bassRootHz, when, stepDur * 6.8, 0.16);
      } else if (step === 7) {
        this.triggerBossaUprightBass(ctx, dest, bar.bassFifthHz, when, stepDur * 1.1, 0.085);
      } else if (step === 8) {
        this.triggerBossaUprightBass(ctx, dest, bar.bassFifthHz, when, stepDur * 6.5, 0.145);
      } else if (step === 15) {
        this.triggerBossaUprightBass(ctx, dest, bar.bassRootHz, when, stepDur * 0.95, 0.08);
      }
    } else {
      if (step === 0) {
        this.triggerBossaUprightBass(ctx, dest, bar.bassRootHz, when, stepDur * 3.2, 0.19);
      } else if (step === 3) {
        this.triggerBossaUprightBass(ctx, dest, bar.bassRootHz * 1.5, when, stepDur * 2.2, 0.13);
      } else if (step === 6) {
        this.triggerBossaUprightBass(ctx, dest, bar.bassFifthHz, when, stepDur * 1.8, 0.14);
      } else if (step === 8) {
        this.triggerBossaUprightBass(ctx, dest, bar.bassFifthHz, when, stepDur * 3.0, 0.18);
      } else if (step === 11) {
        this.triggerBossaUprightBass(ctx, dest, bar.bassRootHz, when, stepDur * 2.2, 0.135);
      } else if (step === 14) {
        this.triggerBossaUprightBass(ctx, dest, bar.bassFifthHz, when, stepDur * 1.6, 0.12);
      }
    }

    // 4. Sunlit Rhodes / Flute Lyrical Melody Touches
    for (let i = 0; i < bar.melodyNotes.length; i++) {
      const m = bar.melodyNotes[i];
      if (m.step === step) {
        this.triggerBossaSunlitMelody(
          ctx,
          dest,
          m.hz,
          when,
          stepDur * m.durSteps,
          isWarzone ? 0.058 : 0.068,
        );
      }
    }

    // 5. Percussion:
    //    - City: Whisper-light brushed cabasa/shaker only (gentle sunlit cafe breeze)
    //    - Warzone: Soft round lo-fi bossa kick + crisp wooden cross-stick rimshot + syncopated shaker pocket
    if (!isWarzone) {
      if (step % 2 === 0) {
        const shakerGain = step === 4 || step === 12 ? 0.028 : 0.016;
        this.triggerBossaShaker(ctx, dest, when, stepDur * 0.62, shakerGain, 5800);
      }
    } else {
      // Soft round lo-fi/bossa kick drum ("sedikit beat tapi tetap chill")
      if (step === 0 || step === 7 || step === 8 || step === 15) {
        const kickVol = step === 0 || step === 8 ? 0.21 : 0.135;
        this.triggerChillBossaKick(ctx, dest, when, kickVol);
      }
      // Wooden cross-stick rimshot on 2-3 bossa clave
      const rimHit = isEvenBar
        ? step === 0 || step === 3 || step === 6 || step === 10 || step === 12
        : step === 2 || step === 6 || step === 10 || step === 13;
      if (rimHit) {
        this.triggerBossaCrossStick(ctx, dest, when, step === 6 || step === 12 ? 0.085 : 0.062);
      }
      // Crisp 16th-note pocket shaker/hi-hat
      if (step % 2 === 0 || step === 3 || step === 11) {
        const hatVol = step === 4 || step === 12 ? 0.044 : step % 2 === 0 ? 0.026 : 0.018;
        this.triggerBossaShaker(ctx, dest, when, stepDur * 0.52, hatVol, 6600);
      }
    }
  }

  private triggerBossaNylonStrum(
    ctx: AudioContext,
    dest: AudioNode,
    chordHz: readonly [number, number, number, number],
    when: number,
    durSec: number,
    peakGain: number,
  ): void {
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(2150, when);
    lpf.frequency.exponentialRampToValueAtTime(780, when + durSec + 0.04);
    lpf.connect(dest);

    for (let i = 0; i < chordHz.length; i++) {
      const noteTime = when + i * 0.012;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(chordHz[i], noteTime);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, noteTime);
      g.gain.linearRampToValueAtTime(peakGain, noteTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0008, noteTime + durSec);

      osc.connect(g);
      g.connect(lpf);
      const isLast = i === chordHz.length - 1;
      osc.onended = () => {
        g.disconnect();
        if (isLast) lpf.disconnect();
      };
      osc.start(noteTime);
      osc.stop(noteTime + durSec + 0.03);
    }
  }

  private triggerBossaRhodesPad(
    ctx: AudioContext,
    dest: AudioNode,
    chordHz: readonly [number, number, number, number],
    when: number,
    durSec: number,
    peakGain: number,
  ): void {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peakGain, when + 0.06);
    g.gain.exponentialRampToValueAtTime(peakGain * 0.42, when + durSec * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0008, when + durSec);
    g.connect(dest);

    for (let i = 0; i < chordHz.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(chordHz[i], when);
      osc.connect(g);
      if (i === chordHz.length - 1) {
        osc.onended = () => {
          g.disconnect();
        };
      }
      osc.start(when);
      osc.stop(when + durSec + 0.04);
    }
  }

  private triggerBossaSunlitMelody(
    ctx: AudioContext,
    dest: AudioNode,
    hz: number,
    when: number,
    durSec: number,
    peakGain: number,
  ): void {
    const bodyOsc = ctx.createOscillator();
    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(hz, when);

    const tineOsc = ctx.createOscillator();
    tineOsc.type = 'triangle';
    tineOsc.frequency.setValueAtTime(hz * 2, when);

    const tineGain = ctx.createGain();
    tineGain.gain.setValueAtTime(peakGain * 0.24, when);
    tineGain.gain.exponentialRampToValueAtTime(0.0005, when + Math.min(0.16, durSec * 0.5));

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(peakGain, when + 0.018);
    env.gain.exponentialRampToValueAtTime(peakGain * 0.48, when + durSec * 0.45);
    env.gain.exponentialRampToValueAtTime(0.0008, when + durSec);

    bodyOsc.connect(env);
    tineOsc.connect(tineGain);
    tineGain.connect(env);
    env.connect(dest);
    bodyOsc.onended = () => {
      tineGain.disconnect();
      env.disconnect();
    };

    bodyOsc.start(when);
    tineOsc.start(when);
    bodyOsc.stop(when + durSec + 0.03);
    tineOsc.stop(when + durSec + 0.03);
  }

  private triggerBossaUprightBass(
    ctx: AudioContext,
    dest: AudioNode,
    hz: number,
    when: number,
    durSec: number,
    peakGain: number,
  ): void {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hz * 1.03, when);
    osc.frequency.exponentialRampToValueAtTime(hz, when + 0.025);

    const pluckOsc = ctx.createOscillator();
    pluckOsc.type = 'triangle';
    pluckOsc.frequency.setValueAtTime(hz, when);

    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(340, when);
    lpf.frequency.exponentialRampToValueAtTime(160, when + durSec);

    const pluckGain = ctx.createGain();
    pluckGain.gain.setValueAtTime(0.45, when);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(peakGain, when + 0.014);
    env.gain.exponentialRampToValueAtTime(0.001, when + durSec);

    osc.connect(env);
    pluckOsc.connect(lpf);
    lpf.connect(pluckGain);
    pluckGain.connect(env);
    env.connect(dest);
    osc.onended = () => {
      lpf.disconnect();
      pluckGain.disconnect();
      env.disconnect();
    };

    osc.start(when);
    pluckOsc.start(when);
    osc.stop(when + durSec + 0.03);
    pluckOsc.stop(when + durSec + 0.03);
  }

  private triggerBossaShaker(
    ctx: AudioContext,
    dest: AudioNode,
    when: number,
    durSec: number,
    peakGain: number,
    centerHz: number,
  ): void {
    const src = ctx.createBufferSource();
    src.buffer = this.ensurePinkNoiseBuffer(ctx);
    const maxOffset = Math.max(0, src.buffer.duration - durSec - 0.05);
    const offset = (when * 0.37) % Math.max(0.05, maxOffset);

    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.setValueAtTime(centerHz, when);
    bpf.Q.setValueAtTime(1.8, when);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peakGain, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0005, when + durSec);

    src.connect(bpf);
    bpf.connect(g);
    g.connect(dest);
    src.onended = () => {
      bpf.disconnect();
      g.disconnect();
    };
    src.start(when, offset, durSec + 0.02);
  }

  private triggerChillBossaKick(
    ctx: AudioContext,
    dest: AudioNode,
    when: number,
    peakGain: number,
  ): void {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(116, when);
    osc.frequency.exponentialRampToValueAtTime(48, when + 0.085);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peakGain, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0008, when + 0.19);

    osc.connect(g);
    g.connect(dest);
    osc.onended = () => {
      g.disconnect();
    };
    osc.start(when);
    osc.stop(when + 0.21);
  }

  private triggerBossaCrossStick(
    ctx: AudioContext,
    dest: AudioNode,
    when: number,
    peakGain: number,
  ): void {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(820, when);
    osc.frequency.exponentialRampToValueAtTime(410, when + 0.028);

    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.setValueAtTime(1450, when);
    bpf.Q.setValueAtTime(2.6, when);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peakGain, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0006, when + 0.055);

    osc.connect(bpf);
    bpf.connect(g);
    g.connect(dest);
    osc.onended = () => {
      bpf.disconnect();
      g.disconnect();
    };
    osc.start(when);
    osc.stop(when + 0.065);
  }

  private getMasterBusNode(ctx: AudioContext): AudioNode {
    return (
      this.masterInputGain ||
      this.masterLowShelfFilter ||
      this.masterLowPassFilter ||
      this.masterCompressor ||
      ctx.destination
    );
  }

  private getOutputNode(ctx: AudioContext): AudioNode {
    if (this.currentSpatialNode) {
      return this.currentSpatialNode;
    }
    return this.getMasterBusNode(ctx);
  }

  /**
   * Executes a sound callback with 3D spatial distance attenuation.
   * When `gain <= 0.015` (e.g. player is outside the base or beyond hearing range),
   * skips execution completely so distant AI / crate / build-box sounds never leak!
   */
  public withSpatialGain(gain: number, fn: () => void): void {
    const clampedGain = clamp(gain, 0, 1);
    if (clampedGain <= 0.015) return;
    if (clampedGain >= 0.99) {
      fn();
      return;
    }
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const prevNode = this.currentSpatialNode;
    const spatialNode = ctx.createGain();
    spatialNode.gain.setValueAtTime(clampedGain, ctx.currentTime);
    spatialNode.connect(prevNode || this.getMasterBusNode(ctx));
    this.currentSpatialNode = spatialNode;
    try {
      fn();
    } finally {
      this.currentSpatialNode = prevNode;
    }
  }

  /**
   * Generates a full-scale 1.2-second Pink Noise (-3dB/octave) buffer using Paul Kellet's 7-state filter
   * normalized to high energy so bandpass-filtered bursts & whooshes cut through clearly.
   */
  private ensurePinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.pinkNoiseBuffer) return this.pinkNoiseBuffer;
    const length = Math.floor(ctx.sampleRate * 1.2);
    const buf = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      data[i] = clamp(pink * 0.44, -1, 1);
    }
    this.pinkNoiseBuffer = buf;
    return buf;
  }

  /**
   * Generates a full-scale 1.2-second Brown/Red Noise (-6dB/octave) buffer using a leaky integrator
   * for heavy, chest-shaking explosion rumbles and artillery body.
   */
  private ensureBrownNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.brownNoiseBuffer) return this.brownNoiseBuffer;
    const length = Math.floor(ctx.sampleRate * 1.2);
    const buf = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.04 * white) / 1.04;
      data[i] = clamp(lastOut * 4.6, -1, 1);
    }
    this.brownNoiseBuffer = buf;
    return buf;
  }

  /**
   * Creates a smooth tanh soft-clipping WaveShaperNode with configurable drive for punchy harmonic grit.
   */
  private createSoftClipWaveShaper(ctx: AudioContext, drive = 2.8): WaveShaperNode {
    const key = Math.round(drive * 10);
    let curve = this.softClipCurves.get(key);
    if (!curve) {
      const samples = 1024;
      curve = new Float32Array(new ArrayBuffer(samples * 4));
      const norm = Math.tanh(drive);
      for (let i = 0; i < samples; i++) {
        const x = (i * 2) / (samples - 1) - 1;
        curve[i] = Math.tanh(x * drive) / norm;
      }
      this.softClipCurves.set(key, curve);
    }
    const shaper = ctx.createWaveShaper();
    shaper.curve = curve;
    shaper.oversample = '2x';
    return shaper;
  }

  private preloadAllBlitzSamples(): void {
    const keys = Object.keys(BLITZ_AUDIO_PATHS) as BlitzSampleKey[];
    for (const key of keys) {
      this.loadSample(key);
    }
  }

  /**
   * Preloads all 22 SFX `.mp3` files concurrently via `Promise.all`,
   * reporting progress `(loaded, total)` and logging a warning on any missing optional file
   * without blocking the preload gate.
   */
  public preloadAllAudioAssets(
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<void> {
    const sampleKeys = Object.keys(BLITZ_AUDIO_PATHS) as BlitzSampleKey[];
    const total = sampleKeys.length;

    if (this.audioPreloadComplete || typeof fetch === 'undefined') {
      onProgress?.(total, total);
      return Promise.resolve();
    }

    let loaded = 0;
    onProgress?.(0, total);

    const advance = () => {
      loaded += 1;
      onProgress?.(loaded, total);
    };

    const samplePromises = sampleKeys.map(async (key) => {
      if (this.rawAudioBuffers.has(key) || this.buffers.has(key)) {
        advance();
        return;
      }
      const url = BLITZ_AUDIO_PATHS[key];
      try {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const arr = await res.arrayBuffer();
        this.rawAudioBuffers.set(key, arr);
        if (this.ctx) {
          try {
            const decoded = await this.ctx.decodeAudioData(arr.slice(0));
            if (decoded) {
              this.buffers.set(key, decoded);
            }
          } catch {
            // Will decode on demand or use procedural synth fallback
          }
        }
      } catch (err) {
        console.warn(`[PreloadGate] Non-critical audio sample failed to preload (${url}):`, err);
      } finally {
        advance();
      }
    });

    const allPromise = Promise.all(samplePromises).then(() => {
      this.audioPreloadComplete = true;
    });

    if (!this.audioPreloadPromise) {
      this.audioPreloadPromise = allPromise;
    }
    return allPromise;
  }

  private loadSample(key: BlitzSampleKey): void {
    if (this.buffers.has(key) || this.loadingKeys.has(key) || typeof fetch === 'undefined') return;
    this.loadingKeys.add(key);

    const cachedRaw = this.rawAudioBuffers.get(key);
    if (cachedRaw && this.ctx) {
      this.ctx
        .decodeAudioData(cachedRaw.slice(0))
        .then((decoded) => {
          if (decoded) {
            this.buffers.set(key, decoded);
          }
        })
        .catch(() => {
          // Fallback synthesis handles undecodable audio seamlessly
        })
        .finally(() => {
          this.loadingKeys.delete(key);
        });
      return;
    }

    const url = BLITZ_AUDIO_PATHS[key];
    fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error('HTTP ' + res.status))))
      .then((arr) => {
        this.rawAudioBuffers.set(key, arr);
        if (!this.ctx) return null;
        return this.ctx.decodeAudioData(arr.slice(0));
      })
      .then((decoded) => {
        if (decoded) {
          this.buffers.set(key, decoded);
        }
      })
      .catch(() => {
        // Fallback synthesis handles missing or undecodable audio seamlessly
      })
      .finally(() => {
        this.loadingKeys.delete(key);
      });
  }

  private pitchJitter(baseFreq: number): number {
    return baseFreq * (0.92 + Math.random() * 0.16);
  }

  /**
   * Plays a decoded Blitz `.mp3` sample with custom volume & playbackRate (0.90 - 1.15).
   * Returns true if the real Blitz sample buffer played, or false if fallback synth should run.
   */
  public playSample(
    key: BlitzSampleKey,
    volume = 0.5,
    playbackRate = 1.0,
    throttleMs = 35,
  ): boolean {
    const ctx = this.ensureCtx();
    if (!ctx) return false;

    const nowMs = performance.now();
    const throttleKey = this.currentSpatialNode !== null ? `spatial:${key}` : key;
    const prevMs = this.lastKeyPlayMs.get(throttleKey) || 0;
    if (throttleMs > 0 && nowMs - prevMs < throttleMs) {
      return true;
    }
    this.lastKeyPlayMs.set(throttleKey, nowMs);

    const buf = this.buffers.get(key);
    if (!buf) {
      this.loadSample(key);
      return false;
    }

    try {
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.playbackRate.setValueAtTime(clamp(playbackRate, 0.75, 1.45), ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(clamp(volume, 0.01, 1.25), ctx.currentTime);

      source.connect(gain);
      gain.connect(this.getOutputNode(ctx));
      source.start(ctx.currentTime);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 1a. Metal / Pipe / Tank / Vehicle Collision SFX (`hit-metal.mp3`)
   * Volume and playbackRate (0.90 - 1.15) scale proportionally with `impactSpeed`.
   */
  public playMetalImpact(impactSpeed = 6.0): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const { volume, playbackRate } = computeCollisionAudioParams(impactSpeed, Math.random());

    if (this.playSample('hit-metal', volume * 0.75, playbackRate, 45)) {
      return;
    }

    // Warm metallic clank fallback (no harsh square wave)
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);
    const freqs = [340 * playbackRate, 585 * playbackRate, 920 * playbackRate];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.42, now + 0.14);
      gain.gain.setValueAtTime((volume * 0.22) / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.16);
    });
  }

  /**
   * 1b. Wood Crate / Barricade Hit (`hit-wood.mp3`) & Smash/Break (`hit-wood.mp3` + `hit-brick-01.mp3`)
   */
  public playWoodHit(impactSpeed = 5.0): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const { volume, playbackRate } = computeCollisionAudioParams(impactSpeed, Math.random());

    if (this.playSample('hit-wood', volume * 0.72, playbackRate, 45)) {
      return;
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(195 * playbackRate, now);
    osc.frequency.exponentialRampToValueAtTime(68, now + 0.11);
    gain.gain.setValueAtTime(volume * 0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.getOutputNode(ctx));
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playWoodBreak(impactSpeed = 10.0): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const { volume, playbackRate } = computeCollisionAudioParams(impactSpeed, Math.random());

    this.playSample('hit-wood', Math.min(1.0, volume * 0.95), playbackRate, 0);
    const playedCrunch = this.playSample(
      Math.random() < 0.5 ? 'hit-brick-01' : 'hit-brick-02',
      Math.min(1.0, volume * 0.85),
      clamp(playbackRate * 0.96, 0.9, 1.15),
      0,
    );
    if (playedCrunch) return;

    // Multi-splinter wood break synthesis fallback using warm Pink Noise
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.ensurePinkNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420 * playbackRate, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.34, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.getOutputNode(ctx));
    noise.start(now);
    noise.stop(now + 0.25);
  }

  /**
   * 1c. Stone / Concrete / Tree Trunk Thud (`hit-concrete.mp3`, `hit-brick-01.mp3`, + `grass.mp3` foliage rustle)
   */
  public playHeavyThud(impactSpeed = 6.0, isTree = false): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const { volume, playbackRate } = computeCollisionAudioParams(impactSpeed, Math.random());

    if (isTree) {
      // Combine deep trunk thud + brief foliage rustle
      this.playSample('hit-wood', volume * 0.68, clamp(playbackRate * 0.92, 0.9, 1.12), 45);
      this.playSample('hit-concrete', volume * 0.55, clamp(playbackRate * 0.95, 0.9, 1.12), 45);
      return;
    }

    if (this.playSample('hit-concrete', volume * 0.78, playbackRate, 45)) {
      return;
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(125 * playbackRate, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.16);
    gain.gain.setValueAtTime(volume * 0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(gain);
    gain.connect(this.getOutputNode(ctx));
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /**
   * Plastic / Traffic Cone / Recycle Bin Impact (`hit-plastic.mp3`)
   */
  public playPlasticHit(impactSpeed = 5.0): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const { volume, playbackRate } = computeCollisionAudioParams(impactSpeed, Math.random());
    if (this.playSample('hit-plastic', volume * 0.72, playbackRate, 45)) {
      return;
    }
    this.playWoodHit(impactSpeed);
  }

  /**
   * Brick / Masonry Impact (`hit-brick-01.mp3` & `hit-brick-02.mp3`, baseVolume: 0.50, throttleMs: 90)
   */
  public playBrickHit(impactSpeed = 4.0): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    if (impactSpeed < 0.2) return;
    const volScale = clamp(impactSpeed / 6.0, 0.45, 1.0);
    const playbackRate = 1.0 + (Math.random() * 2 - 1) * 0.1;
    const key: BlitzSampleKey = Math.random() < 0.5 ? 'hit-brick-01' : 'hit-brick-02';
    if (this.playSample(key, 0.5 * volScale, playbackRate, 90)) {
      return;
    }
    this.playHeavyThud(impactSpeed, false);
  }

  /**
   * Dispatches the surface material impact SFX for any `CollisionMaterialTag`.
   */
  public playMaterialImpact(materialTag: CollisionMaterialTag, impactSpeed: number): void {
    const isBrick = materialTag === 'brick';
    if (impactSpeed < (isBrick ? 0.2 : 0.3)) return;
    switch (materialTag) {
      case 'brick':
        this.playBrickHit(impactSpeed);
        break;
      case 'metal':
        this.playMetalImpact(impactSpeed);
        break;
      case 'wood':
        this.playWoodHit(impactSpeed);
        break;
      case 'tree':
        this.playHeavyThud(impactSpeed, true);
        break;
      case 'concrete':
        this.playHeavyThud(impactSpeed, false);
        break;
      case 'plastic':
        this.playPlasticHit(impactSpeed);
        break;
      default: {
        const { volume, playbackRate } = computeCollisionAudioParams(impactSpeed, Math.random());
        if (!this.playSample('hit-generic', volume * 0.55, playbackRate, 90)) {
          this.playHeavyThud(impactSpeed, false);
        }
        break;
      }
    }
  }

  /**
   * 1d. Blitz Tank Engine / Tracks (`player-move.mp3`), Boost (`player-boost.mp3`), and Grass (`grass.mp3`) loop
   */
  public updateVehicleMovementLoop(
    speed: number,
    isBoosting: boolean,
    isOnGrass: boolean,
    isActive = true,
  ): void {
    if (this._muted || !isActive || speed < 0.35) {
      this.stopLoop('player-move');
      this.stopLoop('player-boost');
      this.stopLoop('grass');
      return;
    }

    const ctx = this.ensureCtx();
    if (!ctx) return;

    const speedNorm = clamp(speed / 15.2, 0, 1);
    const moveVol = clamp(0.06 + speedNorm * 0.16, 0.04, 0.24);
    const moveRate = clamp(0.85 + speedNorm * 0.45, 0.85, 1.35);
    this.ensureLoopPlaying('player-move', moveVol, moveRate);

    if (isBoosting && speed > 2.0) {
      const boostVol = clamp(0.14 + speedNorm * 0.22, 0.1, 0.36);
      const boostRate = clamp(0.92 + speedNorm * 0.28, 0.9, 1.25);
      this.ensureLoopPlaying('player-boost', boostVol, boostRate);
    } else {
      this.stopLoop('player-boost');
    }

    if (isOnGrass && speed > 1.0) {
      const grassVol = clamp(0.08 + speedNorm * 0.18, 0.05, 0.26);
      const grassRate = clamp(0.9 + speedNorm * 0.3, 0.9, 1.25);
      this.ensureLoopPlaying('grass', grassVol, grassRate);
    } else {
      this.stopLoop('grass');
    }
  }

  private ensureLoopPlaying(key: BlitzSampleKey, volume: number, rate: number): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const existing = this.activeLoops.get(key);
    if (existing) {
      existing.gain.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
      existing.source.playbackRate.setTargetAtTime(rate, ctx.currentTime, 0.05);
      return;
    }

    const buf = this.buffers.get(key);
    if (!buf) {
      this.loadSample(key);
      return;
    }

    try {
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.loop = true;
      source.playbackRate.setValueAtTime(rate, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);

      source.connect(gain);
      gain.connect(this.getOutputNode(ctx));
      source.start(ctx.currentTime);

      this.activeLoops.set(key, { source, gain, key });
    } catch {
      // Ignore loop start errors
    }
  }

  private stopLoop(key: BlitzSampleKey): void {
    const active = this.activeLoops.get(key);
    if (!active) return;
    try {
      active.source.stop();
      active.source.disconnect();
      active.gain.disconnect();
    } catch {
      // Ignore stop errors
    }
    this.activeLoops.delete(key);
  }

  public stopAllLoops(): void {
    for (const key of Array.from(this.activeLoops.keys())) {
      this.stopLoop(key);
    }
  }

  private isThrottled(tag: string, throttleMs: number): boolean {
    if (throttleMs <= 0) return false;
    const nowMs = performance.now();
    const prevMs = this.lastKeyPlayMs.get(tag) || 0;
    if (nowMs - prevMs < throttleMs) return true;
    this.lastKeyPlayMs.set(tag, nowMs);
    return false;
  }

  // ============================================================================
  // MODERN STYLIZED 3D TACTICAL ARCADE — MULTI-LAYER SYNTHESIS ENGINE
  // ============================================================================

  /**
   * 1a. Skyshield Anti-Drone System — Radar Lock SFX
   * - Crystal-smooth chirp: Sine wave 1400Hz -> 1800Hz (0.04s), repeated 2x
   * - Turret servo motor whirr: Triangle wave 120Hz -> 220Hz
   */
  public playSkyshieldRadarLock(): void {
    if (this.isThrottled('skyshield-radar-lock', 220)) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);
    const spec = TACTICAL_AUDIO_SPEC.skyshield;

    // Two crisp crystal Sine + Triangle harmonic chirps (1400Hz -> 1800Hz, 0.04s each)
    for (let i = 0; i < spec.radarLockChirpRepeats; i++) {
      const t0 = now + i * 0.055;
      const chirpOsc = ctx.createOscillator();
      const harmOsc = ctx.createOscillator();
      const chirpGain = ctx.createGain();
      chirpOsc.type = 'sine';
      harmOsc.type = 'triangle';
      chirpOsc.frequency.setValueAtTime(spec.radarLockChirpStartHz, t0);
      chirpOsc.frequency.exponentialRampToValueAtTime(
        spec.radarLockChirpEndHz,
        t0 + spec.radarLockChirpDurationSec,
      );
      harmOsc.frequency.setValueAtTime(spec.radarLockChirpStartHz * 0.5, t0);
      harmOsc.frequency.exponentialRampToValueAtTime(
        spec.radarLockChirpEndHz * 0.5,
        t0 + spec.radarLockChirpDurationSec,
      );
      chirpGain.gain.setValueAtTime(0.001, t0);
      chirpGain.gain.linearRampToValueAtTime(0.36, t0 + 0.004);
      chirpGain.gain.exponentialRampToValueAtTime(0.001, t0 + spec.radarLockChirpDurationSec);
      chirpOsc.connect(chirpGain);
      harmOsc.connect(chirpGain);
      chirpGain.connect(out);
      chirpOsc.start(t0);
      harmOsc.start(t0);
      chirpOsc.stop(t0 + spec.radarLockChirpDurationSec + 0.006);
      harmOsc.stop(t0 + spec.radarLockChirpDurationSec + 0.006);
    }

    // Turret servo motor whirr (Triangle + Sawtooth body 120Hz -> 220Hz)
    const servoStart = now + 0.035;
    const servoDur = 0.15;
    const servoOsc = ctx.createOscillator();
    const servoSaw = ctx.createOscillator();
    const servoFilter = ctx.createBiquadFilter();
    const servoGain = ctx.createGain();
    servoOsc.type = 'triangle';
    servoSaw.type = 'sawtooth';
    servoOsc.frequency.setValueAtTime(spec.servoStartHz, servoStart);
    servoOsc.frequency.exponentialRampToValueAtTime(spec.servoEndHz, servoStart + servoDur);
    servoSaw.frequency.setValueAtTime(spec.servoStartHz * 2, servoStart);
    servoSaw.frequency.exponentialRampToValueAtTime(spec.servoEndHz * 2, servoStart + servoDur);
    servoFilter.type = 'lowpass';
    servoFilter.frequency.setValueAtTime(980, servoStart);
    servoGain.gain.setValueAtTime(0.001, servoStart);
    servoGain.gain.linearRampToValueAtTime(0.28, servoStart + 0.02);
    servoGain.gain.exponentialRampToValueAtTime(0.001, servoStart + servoDur);
    servoOsc.connect(servoFilter);
    servoSaw.connect(servoFilter);
    servoFilter.connect(servoGain);
    servoGain.connect(out);
    servoOsc.start(servoStart);
    servoSaw.start(servoStart);
    servoOsc.stop(servoStart + servoDur + 0.01);
    servoSaw.stop(servoStart + servoDur + 0.01);
  }

  /**
   * 1b. Skyshield Anti-Drone System — Single High-RPM AHEAD Cannon Round
   * Zero square waves. Hard-hitting C-RAM "THUMP-CLACK" combining:
   * - Mechanical punch: Saturated Sine + Triangle pitch drop 260Hz -> 70Hz in 0.03s
   * - Breech bolt transient click: Triangle 1650Hz -> 280Hz in 0.014s
   * - Crisp metallic burst: Bandpass-filtered Pink Noise at 1400Hz, Q = 3.0, duration 0.035s
   */
  public playSkyshieldShot(delaySec = 0): void {
    if (delaySec <= 0 && this.isThrottled('skyshield-shot', 26)) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const spec = TACTICAL_AUDIO_SPEC.skyshield;
    const t0 = ctx.currentTime + Math.max(0, delaySec);
    const out = this.getOutputNode(ctx);
    const jitter = 0.96 + Math.random() * 0.08;
    const shaper = this.createSoftClipWaveShaper(ctx, 3.2);
    shaper.connect(out);

    // Layer A: Saturated Mechanical Thump (Sine + Triangle pitch drop 260Hz -> 70Hz in 0.03s)
    const punchOsc = ctx.createOscillator();
    const bodyTri = ctx.createOscillator();
    const punchGain = ctx.createGain();
    punchOsc.type = 'sine';
    bodyTri.type = 'triangle';
    punchOsc.frequency.setValueAtTime(spec.shotPunchStartHz * jitter, t0);
    punchOsc.frequency.exponentialRampToValueAtTime(
      spec.shotPunchEndHz,
      t0 + spec.shotPunchDurationSec,
    );
    bodyTri.frequency.setValueAtTime(spec.shotPunchStartHz * 1.25 * jitter, t0);
    bodyTri.frequency.exponentialRampToValueAtTime(
      spec.shotPunchEndHz,
      t0 + spec.shotPunchDurationSec,
    );
    punchGain.gain.setValueAtTime(0.68, t0);
    punchGain.gain.exponentialRampToValueAtTime(0.001, t0 + spec.shotPunchDurationSec + 0.008);
    punchOsc.connect(punchGain);
    bodyTri.connect(punchGain);
    punchGain.connect(shaper);
    punchOsc.start(t0);
    bodyTri.start(t0);
    punchOsc.stop(t0 + spec.shotPunchDurationSec + 0.012);
    bodyTri.stop(t0 + spec.shotPunchDurationSec + 0.012);

    // Layer A2: Breech bolt transient snap (1650Hz -> 280Hz in 0.014s) for tactile mechanical bite
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(1650 * jitter, t0);
    snapOsc.frequency.exponentialRampToValueAtTime(280, t0 + 0.014);
    snapGain.gain.setValueAtTime(0.42, t0);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.015);
    snapOsc.connect(snapGain);
    snapGain.connect(shaper);
    snapOsc.start(t0);
    snapOsc.stop(t0 + 0.017);

    // Layer B: Crisp metallic burst (Bandpass-filtered Pink Noise at 1400Hz, Q=3.0, duration 0.035s)
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this.ensurePinkNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(spec.shotNoiseBandpassHz * jitter, t0);
    bp.Q.setValueAtTime(spec.shotNoiseQ, t0);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.76, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t0 + spec.shotNoiseDurationSec);
    noiseSrc.connect(bp);
    bp.connect(noiseGain);
    noiseGain.connect(shaper);
    const offset = Math.random() * 0.6;
    noiseSrc.start(t0, offset, spec.shotNoiseDurationSec + 0.01);
  }

  /**
   * 1c. Skyshield Flak / Airburst Detonation (Anti-Drone Airburst)
   * - Short sub-bass pop: Sine + Triangle 110Hz -> 40Hz (0.12s)
   * - Filtered Pink Noise snap at 900Hz
   */
  public playSkyshieldFlakAirburst(): void {
    if (this.isThrottled('skyshield-flak-airburst', 35)) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);
    const spec = TACTICAL_AUDIO_SPEC.skyshield;
    const { volumeScale } = this.computeExplosionDucking();
    const shaper = this.createSoftClipWaveShaper(ctx, 3.0);
    shaper.connect(out);

    // Sub-bass pop (Sine + Triangle 110Hz -> 40Hz, 0.12s)
    const subOsc = ctx.createOscillator();
    const triOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    triOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(spec.flakSubStartHz, now);
    subOsc.frequency.exponentialRampToValueAtTime(spec.flakSubEndHz, now + spec.flakSubDurationSec);
    triOsc.frequency.setValueAtTime(spec.flakSubStartHz * 1.4, now);
    triOsc.frequency.exponentialRampToValueAtTime(spec.flakSubEndHz, now + spec.flakSubDurationSec);
    subGain.gain.setValueAtTime(0.75 * volumeScale, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + spec.flakSubDurationSec);
    subOsc.connect(subGain);
    triOsc.connect(subGain);
    subGain.connect(shaper);
    subOsc.start(now);
    triOsc.start(now);
    subOsc.stop(now + spec.flakSubDurationSec + 0.01);
    triOsc.stop(now + spec.flakSubDurationSec + 0.01);

    // Filtered Pink Noise snap at 900Hz
    const snapNoise = ctx.createBufferSource();
    snapNoise.buffer = this.ensurePinkNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(spec.flakSnapBandpassHz, now);
    bp.Q.setValueAtTime(1.8, now);
    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime(0.82 * volumeScale, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);
    snapNoise.connect(bp);
    bp.connect(snapGain);
    snapGain.connect(shaper);
    snapNoise.start(now, Math.random() * 0.5, 0.11);
  }

  /**
   * 2. Fighter Jet Strafe & Rotary Cannon "BRRRT" (3600 RPM Vulcan Burst + Jet Turbine Doppler Whoosh)
   * - Layer 1 (Rotary Vulcan Cannon "BRRRT"): Fast AM / LFO (55Hz-65Hz for 3600 RPM) modulating
   *   combined low Sawtooth + Triangle (130Hz) + Bandpass Pink Noise (650Hz, Q=2.0) over 0.35s-0.5s.
   * - Layer 2 (Jet Turbine Doppler Whoosh): Pink Noise through Bandpass Filter sweeping up
   *   250Hz -> 900Hz then down -> 200Hz.
   */
  public playFighterJetRotaryBurst(): void {
    if (this.isThrottled('fighter-jet-rotary-burst', 220)) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);
    const spec = TACTICAL_AUDIO_SPEC.fighterJet;
    const dur = spec.burstDurationSec; // 0.42s (within 0.35s - 0.50s)

    // --- LAYER 1: Ferocious Rotary Vulcan Cannon "BRRRRRRT" (AM LFO at 60Hz on 130Hz Saw+Tri + 650Hz BP Pink Noise) ---
    const vulcanBus = ctx.createGain();
    // Deep 100% AM modulation (0.50 +/- 0.50) driven through soft-clipper so every 3600 RPM pulse rips hard!
    vulcanBus.gain.setValueAtTime(0.55, now);

    const lfo = ctx.createOscillator();
    const lfoShaper = this.createSoftClipWaveShaper(ctx, 2.6);
    const lfoDepth = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(spec.lfoRateHz + (Math.random() * 6 - 3), now); // 57Hz - 63Hz
    lfoDepth.gain.setValueAtTime(0.54, now);
    lfo.connect(lfoShaper);
    lfoShaper.connect(lfoDepth);
    lfoDepth.connect(vulcanBus.gain);

    // Low Sawtooth + Detuned Saw + Sub-Triangle at 130Hz / 65Hz for iconic GAU-8 Warthog growl
    const sawOsc = ctx.createOscillator();
    const sawOsc2 = ctx.createOscillator();
    const triOsc = ctx.createOscillator();
    const sawGain = ctx.createGain();
    const triGain = ctx.createGain();
    sawOsc.type = 'sawtooth';
    sawOsc2.type = 'sawtooth';
    triOsc.type = 'triangle';
    const baseHz = spec.coreOscHz * (0.97 + Math.random() * 0.06);
    sawOsc.frequency.setValueAtTime(baseHz, now);
    sawOsc.frequency.exponentialRampToValueAtTime(baseHz * 0.86, now + dur);
    sawOsc2.frequency.setValueAtTime(baseHz * 1.5, now);
    sawOsc2.frequency.exponentialRampToValueAtTime(baseHz * 1.28, now + dur);
    triOsc.frequency.setValueAtTime(baseHz * 0.5, now); // 65Hz chest sub-fundamental
    triOsc.frequency.exponentialRampToValueAtTime(baseHz * 0.44, now + dur);
    sawGain.gain.setValueAtTime(0.46, now);
    triGain.gain.setValueAtTime(0.52, now);
    sawOsc.connect(sawGain);
    sawOsc2.connect(sawGain);
    triOsc.connect(triGain);
    sawGain.connect(vulcanBus);
    triGain.connect(vulcanBus);

    // Bandpass Pink Noise (center 650Hz, Q=2.0) + High-Mid Bite Bandpass (1350Hz, Q=2.2)
    const vulcanNoise = ctx.createBufferSource();
    vulcanNoise.buffer = this.ensurePinkNoiseBuffer(ctx);
    const vulcanBp = ctx.createBiquadFilter();
    vulcanBp.type = 'bandpass';
    vulcanBp.frequency.setValueAtTime(spec.noiseBandpassHz, now);
    vulcanBp.Q.setValueAtTime(spec.noiseQ, now);
    const vulcanBiteBp = ctx.createBiquadFilter();
    vulcanBiteBp.type = 'bandpass';
    vulcanBiteBp.frequency.setValueAtTime(1350, now);
    vulcanBiteBp.Q.setValueAtTime(2.2, now);
    const vulcanNoiseGain = ctx.createGain();
    vulcanNoiseGain.gain.setValueAtTime(0.78, now);
    vulcanNoise.connect(vulcanBp);
    vulcanNoise.connect(vulcanBiteBp);
    vulcanBp.connect(vulcanNoiseGain);
    vulcanBiteBp.connect(vulcanNoiseGain);
    vulcanNoiseGain.connect(vulcanBus);

    // Aggressive soft-clipper & punchy envelope for the Vulcan cannon bus
    const vulcanEnv = ctx.createGain();
    vulcanEnv.gain.setValueAtTime(0.001, now);
    vulcanEnv.gain.linearRampToValueAtTime(1.05, now + 0.01);
    vulcanEnv.gain.setValueAtTime(0.98, now + dur - 0.05);
    vulcanEnv.gain.exponentialRampToValueAtTime(0.001, now + dur);

    const shaper = this.createSoftClipWaveShaper(ctx, 3.6);
    vulcanBus.connect(shaper);
    shaper.connect(vulcanEnv);
    vulcanEnv.connect(out);

    lfo.start(now);
    sawOsc.start(now);
    sawOsc2.start(now);
    triOsc.start(now);
    vulcanNoise.start(now, Math.random() * 0.4, dur + 0.02);
    lfo.stop(now + dur + 0.02);
    sawOsc.stop(now + dur + 0.02);
    sawOsc2.stop(now + dur + 0.02);
    triOsc.stop(now + dur + 0.02);

    // --- LAYER 2: Jet Turbine Doppler Whoosh (Pink Noise Bandpass 250Hz -> 900Hz -> 200Hz) ---
    const dopplerDur = dur + 0.10;
    const jetNoise = ctx.createBufferSource();
    jetNoise.buffer = this.ensurePinkNoiseBuffer(ctx);
    const jetBp = ctx.createBiquadFilter();
    jetBp.type = 'bandpass';
    jetBp.Q.setValueAtTime(1.5, now);
    jetBp.frequency.setValueAtTime(spec.dopplerStartHz, now);
    jetBp.frequency.exponentialRampToValueAtTime(spec.dopplerPeakHz, now + dopplerDur * 0.42);
    jetBp.frequency.exponentialRampToValueAtTime(spec.dopplerEndHz, now + dopplerDur);

    const jetGain = ctx.createGain();
    jetGain.gain.setValueAtTime(0.001, now);
    jetGain.gain.linearRampToValueAtTime(0.62, now + dopplerDur * 0.38);
    jetGain.gain.exponentialRampToValueAtTime(0.001, now + dopplerDur);

    jetNoise.connect(jetBp);
    jetBp.connect(jetGain);
    jetGain.connect(out);
    jetNoise.start(now, Math.random() * 0.3, dopplerDur + 0.02);
  }

  /**
   * 3. Bazooka Launcher (When Fired)
   * - (a) Sine/Triangle sub-bass pitch drop (180Hz exponential drop to 45Hz in 0.15s) for the heavy "THUMP"
   * - (b) Pink Noise with BiquadFilter bandpass sweeping from 1200Hz down to 300Hz (Q=2.5) for powerful rocket propellant "WHOOSH"
   */
  public playBazookaLaunch(): void {
    if (this.isThrottled('bazooka-launch', 90)) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);
    const spec = TACTICAL_AUDIO_SPEC.bazookaLaunch;
    const shaper = this.createSoftClipWaveShaper(ctx, 3.4);
    shaper.connect(out);

    // Layer (a): Heavy Sine + Triangle sub-bass pitch drop (180Hz -> 45Hz in 0.15s) + ignition transient crack
    const sineOsc = ctx.createOscillator();
    const triOsc = ctx.createOscillator();
    const crackOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    const crackGain = ctx.createGain();
    sineOsc.type = 'sine';
    triOsc.type = 'triangle';
    crackOsc.type = 'sawtooth';
    sineOsc.frequency.setValueAtTime(spec.subStartHz, now);
    sineOsc.frequency.exponentialRampToValueAtTime(spec.subEndHz, now + spec.subDurationSec);
    triOsc.frequency.setValueAtTime(spec.subStartHz * 1.15, now);
    triOsc.frequency.exponentialRampToValueAtTime(spec.subEndHz, now + spec.subDurationSec);
    crackOsc.frequency.setValueAtTime(520, now);
    crackOsc.frequency.exponentialRampToValueAtTime(75, now + 0.038);

    subGain.gain.setValueAtTime(0.84, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + spec.subDurationSec + 0.025);
    crackGain.gain.setValueAtTime(0.48, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    sineOsc.connect(subGain);
    triOsc.connect(subGain);
    crackOsc.connect(crackGain);
    subGain.connect(shaper);
    crackGain.connect(shaper);
    sineOsc.start(now);
    triOsc.start(now);
    crackOsc.start(now);
    sineOsc.stop(now + spec.subDurationSec + 0.03);
    triOsc.stop(now + spec.subDurationSec + 0.03);
    crackOsc.stop(now + 0.045);

    // Layer (b): Pink Noise with Bandpass filter (1200Hz -> 300Hz, Q=2.5) for powerful propellant "whoosh"
    const whooshDur = 0.30;
    const propellantNoise = ctx.createBufferSource();
    propellantNoise.buffer = this.ensurePinkNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(spec.whooshQ, now);
    bp.frequency.setValueAtTime(spec.whooshStartHz, now);
    bp.frequency.exponentialRampToValueAtTime(spec.whooshEndHz, now + whooshDur);

    const whooshGain = ctx.createGain();
    whooshGain.gain.setValueAtTime(0.001, now);
    whooshGain.gain.linearRampToValueAtTime(0.86, now + 0.015);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, now + whooshDur);

    propellantNoise.connect(bp);
    bp.connect(whooshGain);
    whooshGain.connect(shaper);
    propellantNoise.start(now, Math.random() * 0.4, whooshDur + 0.02);
  }

  /**
   * 4. Bazooka & Tank Projectile Explosion (3-Layer Heavy Warm Tactical Boom)
   * - (a) Sub-bass boom: Sine + Triangle wave 90Hz -> 25Hz, duration 0.45s
   * - (b) Brown/Pink Noise with exponential Low-Pass Filter (800Hz -> 80Hz) + initial detonation punch
   * - (c) Soft-clipping WaveShaperNode saturation
   */
  public playTacticalExplosion(intensity = 1.0): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const { volumeScale, playbackRate } = this.computeExplosionDucking();
    const scale = clamp(intensity, 0.7, 1.35) * volumeScale;
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);
    const spec = TACTICAL_AUDIO_SPEC.tacticalExplosion;
    const dur = spec.durationSec; // 0.45s

    // Blend studio explosion impact sample alongside the 3-layer synthesis for maximum chest impact
    this.playSample('barrel-explode', 0.58 * scale, clamp(playbackRate, 0.88, 1.06), 25);

    // Layer (c): Soft-clipping WaveShaper summing bus (high drive = 3.5 for thick harmonic weight)
    const shaper = this.createSoftClipWaveShaper(ctx, 3.5);
    const masterExplGain = ctx.createGain();
    masterExplGain.gain.setValueAtTime(1.12 * scale, now);
    shaper.connect(masterExplGain);
    masterExplGain.connect(out);

    // Layer (a): Sub-bass boom (Sine + Triangle 90Hz -> 25Hz, duration 0.45s) + initial impact slam (220Hz -> 38Hz in 0.07s)
    const subOsc = ctx.createOscillator();
    const subTri = ctx.createOscillator();
    const slamOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    const slamGain = ctx.createGain();
    subOsc.type = 'sine';
    subTri.type = 'triangle';
    slamOsc.type = 'triangle';
    const startHz = spec.subStartHz * clamp(playbackRate, 0.92, 1.08);
    subOsc.frequency.setValueAtTime(startHz, now);
    subOsc.frequency.exponentialRampToValueAtTime(spec.subEndHz, now + dur);
    subTri.frequency.setValueAtTime(startHz * 1.2, now);
    subTri.frequency.exponentialRampToValueAtTime(spec.subEndHz, now + dur);
    slamOsc.frequency.setValueAtTime(220, now);
    slamOsc.frequency.exponentialRampToValueAtTime(38, now + 0.075);

    subGain.gain.setValueAtTime(0.92, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    slamGain.gain.setValueAtTime(0.72, now);
    slamGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    subOsc.connect(subGain);
    subTri.connect(subGain);
    slamOsc.connect(slamGain);
    subGain.connect(shaper);
    slamGain.connect(shaper);
    subOsc.start(now);
    subTri.start(now);
    slamOsc.start(now);
    subOsc.stop(now + dur + 0.02);
    subTri.stop(now + dur + 0.02);
    slamOsc.stop(now + 0.085);

    // Layer (b): Brown + Pink Noise with exponential Low-Pass Filter (800Hz -> 80Hz over 0.45s)
    const brownSrc = ctx.createBufferSource();
    brownSrc.buffer = this.ensureBrownNoiseBuffer(ctx);
    const pinkSrc = ctx.createBufferSource();
    pinkSrc.buffer = this.ensurePinkNoiseBuffer(ctx);

    const rumbleLpf = ctx.createBiquadFilter();
    rumbleLpf.type = 'lowpass';
    rumbleLpf.Q.setValueAtTime(1.4, now);
    rumbleLpf.frequency.setValueAtTime(spec.rumbleLowPassStartHz, now);
    rumbleLpf.frequency.exponentialRampToValueAtTime(spec.rumbleLowPassEndHz, now + dur);

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.001, now);
    rumbleGain.gain.linearRampToValueAtTime(0.94, now + 0.008);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    brownSrc.connect(rumbleLpf);
    pinkSrc.connect(rumbleLpf);
    rumbleLpf.connect(rumbleGain);
    rumbleGain.connect(shaper);

    brownSrc.start(now, Math.random() * 0.4, dur + 0.02);
    pinkSrc.start(now, Math.random() * 0.4, dur + 0.02);
  }

  /**
   * 5. Pistol & Assault Rifle ("Pop/Thwack" Tactical Firearm)
   * - Tight transient punch: Saturated Sine + Triangle fast pitch drop 300Hz -> 60Hz in 0.05s
   * - Mechanical bolt transient snap: Triangle 1100Hz -> 190Hz in 0.016s
   * - Short Pink Noise burst (0.06s) with Low-Pass Filter at 1800Hz
   */
  public playTacticalFirearm(variant: 'pistol' | 'rifle' = 'rifle'): void {
    if (this.isThrottled(`tactical-firearm-${variant}`, 30)) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);
    const spec = TACTICAL_AUDIO_SPEC.firearm;
    const jitter = (variant === 'pistol' ? 1.04 : 0.96) * (0.96 + Math.random() * 0.08);
    const shaper = this.createSoftClipWaveShaper(ctx, 3.2);
    shaper.connect(out);

    // Layer A: Saturated tight transient punch (Sine + Triangle pitch drop 300Hz -> 60Hz in 0.05s)
    const punchOsc = ctx.createOscillator();
    const bodyTri = ctx.createOscillator();
    const boltSnap = ctx.createOscillator();
    const punchGain = ctx.createGain();
    const boltGain = ctx.createGain();
    punchOsc.type = 'sine';
    bodyTri.type = 'triangle';
    boltSnap.type = 'triangle';
    punchOsc.frequency.setValueAtTime(spec.punchStartHz * jitter, now);
    punchOsc.frequency.exponentialRampToValueAtTime(
      spec.punchEndHz,
      now + spec.punchDurationSec,
    );
    bodyTri.frequency.setValueAtTime(spec.punchStartHz * 1.3 * jitter, now);
    bodyTri.frequency.exponentialRampToValueAtTime(
      spec.punchEndHz,
      now + spec.punchDurationSec,
    );
    boltSnap.frequency.setValueAtTime(1150 * jitter, now);
    boltSnap.frequency.exponentialRampToValueAtTime(190, now + 0.016);

    punchGain.gain.setValueAtTime(variant === 'rifle' ? 0.72 : 0.62, now);
    punchGain.gain.exponentialRampToValueAtTime(0.001, now + spec.punchDurationSec + 0.01);
    boltGain.gain.setValueAtTime(variant === 'rifle' ? 0.45 : 0.38, now);
    boltGain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);

    punchOsc.connect(punchGain);
    bodyTri.connect(punchGain);
    boltSnap.connect(boltGain);
    punchGain.connect(shaper);
    boltGain.connect(shaper);
    punchOsc.start(now);
    bodyTri.start(now);
    boltSnap.start(now);
    punchOsc.stop(now + spec.punchDurationSec + 0.014);
    bodyTri.stop(now + spec.punchDurationSec + 0.014);
    boltSnap.stop(now + 0.02);

    // Layer B: Short Pink Noise burst (0.06s) with Low-Pass filter at 1800Hz (Q=1.6)
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this.ensurePinkNoiseBuffer(ctx);
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(spec.noiseLowPassHz * jitter, now);
    lpf.Q.setValueAtTime(1.6, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(variant === 'rifle' ? 0.74 : 0.64, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + spec.noiseDurationSec);

    noiseSrc.connect(lpf);
    lpf.connect(noiseGain);
    noiseGain.connect(shaper);
    noiseSrc.start(now, Math.random() * 0.5, spec.noiseDurationSec + 0.01);
  }

  /**
   * Heavy Tank Cannon Breech Thump + Muzzle Blast (combines deep breech punch + warm low-pass blast)
   */
  public playTankCannonFire(): void {
    if (this.isThrottled('tank-cannon-fire', 80)) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);
    const shaper = this.createSoftClipWaveShaper(ctx, 3.6);
    shaper.connect(out);

    this.playSample('boss-shoot-02', 0.52, 0.94 + Math.random() * 0.1, 60);

    // Heavy cannon breech thump (Sine + Triangle + Sawtooth punch 230Hz -> 36Hz in 0.15s)
    const sineOsc = ctx.createOscillator();
    const triOsc = ctx.createOscillator();
    const slamOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    sineOsc.type = 'sine';
    triOsc.type = 'triangle';
    slamOsc.type = 'sawtooth';
    sineOsc.frequency.setValueAtTime(230, now);
    sineOsc.frequency.exponentialRampToValueAtTime(36, now + 0.15);
    triOsc.frequency.setValueAtTime(175, now);
    triOsc.frequency.exponentialRampToValueAtTime(34, now + 0.15);
    slamOsc.frequency.setValueAtTime(480, now);
    slamOsc.frequency.exponentialRampToValueAtTime(55, now + 0.045);
    subGain.gain.setValueAtTime(0.88, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    sineOsc.connect(subGain);
    triOsc.connect(subGain);
    slamOsc.connect(subGain);
    subGain.connect(shaper);
    sineOsc.start(now);
    triOsc.start(now);
    slamOsc.start(now);
    sineOsc.stop(now + 0.17);
    triOsc.stop(now + 0.17);
    slamOsc.stop(now + 0.05);

    // Muzzle blast (Brown + Pink Noise through Low-Pass 1600Hz -> 160Hz in 0.20s)
    const blastNoise = ctx.createBufferSource();
    blastNoise.buffer = this.ensurePinkNoiseBuffer(ctx);
    const brownNoise = ctx.createBufferSource();
    brownNoise.buffer = this.ensureBrownNoiseBuffer(ctx);
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.Q.setValueAtTime(1.5, now);
    lpf.frequency.setValueAtTime(1600, now);
    lpf.frequency.exponentialRampToValueAtTime(160, now + 0.20);
    const blastGain = ctx.createGain();
    blastGain.gain.setValueAtTime(0.85, now);
    blastGain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
    blastNoise.connect(lpf);
    brownNoise.connect(lpf);
    lpf.connect(blastGain);
    blastGain.connect(shaper);
    blastNoise.start(now, Math.random() * 0.4, 0.21);
    brownNoise.start(now, Math.random() * 0.4, 0.21);
  }

  /**
   * Creates a warm 1400Hz low-pass BiquadFilterNode routed directly to destination
   * (bypassing the combat compressor) for "Warm Cozy Plaza UI" SFX.
   */
  private createWarmUiLowpass(ctx: AudioContext, now: number): BiquadFilterNode {
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(1400, now);
    lpf.Q.setValueAtTime(0.7, now);
    lpf.connect(ctx.destination);
    return lpf;
  }

  /**
   * 1. Warm Cozy UI Click: "soft wood/bubble tap"
   * Pure sine 340Hz -> 180Hz, duration 35ms, peak gain 0.04 (scaled by masterVolume),
   * 7ms soft linear attack + smooth exponential release through 1400Hz lowpass filter.
   */
  public playUiClick(): void {
    const ctx = this.ensureCtx();
    if (!ctx || this._muted) return;
    const vol = clamp(this._masterVolume, 0, 1);
    if (vol <= 0.0001) return;

    const now = ctx.currentTime;
    const dur = 0.035;
    const attack = 0.006;
    const peakGain = Math.max(0.0002, 0.04 * vol);

    const lpf = this.createWarmUiLowpass(ctx, now);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + dur);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain);
    gain.connect(lpf);
    osc.start(now);
    osc.stop(now + dur + 0.004);
  }

  /**
   * 2. Warm Cozy UI Confirm: "warm marimba/rhodes chime" 2 soft ascending notes
   * Pure sine 440Hz -> 587.33Hz [A4 -> D5], total duration ~110ms, peak gain 0.05,
   * 7ms soft linear attack + smooth exponential release through 1400Hz lowpass filter.
   */
  public playUiConfirm(): void {
    const ctx = this.ensureCtx();
    if (!ctx || this._muted) return;
    const vol = clamp(this._masterVolume, 0, 1);
    if (vol <= 0.0001) return;

    const now = ctx.currentTime;
    const lpf = this.createWarmUiLowpass(ctx, now);
    const peakGain = Math.max(0.0002, 0.05 * vol);

    const notes: ReadonlyArray<{ freq: number; startOffset: number; dur: number }> = [
      { freq: 440, startOffset: 0.0, dur: 0.055 }, // A4
      { freq: 587.33, startOffset: 0.048, dur: 0.062 }, // D5 (total ~110ms)
    ];

    for (const n of notes) {
      const t0 = now + n.startOffset;
      const attack = 0.007;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, t0);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(peakGain, t0 + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);

      osc.connect(gain);
      gain.connect(lpf);
      osc.start(t0);
      osc.stop(t0 + n.dur + 0.005);
    }
  }

  /**
   * 3. Warm Cozy UI Cancel: "soft muted drop"
   * Pure sine 300Hz -> 210Hz, duration 70ms, peak gain 0.035,
   * 7ms soft linear attack + smooth exponential release through 1400Hz lowpass filter.
   */
  public playUiCancel(): void {
    const ctx = this.ensureCtx();
    if (!ctx || this._muted) return;
    const vol = clamp(this._masterVolume, 0, 1);
    if (vol <= 0.0001) return;

    const now = ctx.currentTime;
    const dur = 0.07;
    const attack = 0.007;
    const peakGain = Math.max(0.0002, 0.035 * vol);

    const lpf = this.createWarmUiLowpass(ctx, now);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + dur);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain);
    gain.connect(lpf);
    osc.start(now);
    osc.stop(now + dur + 0.005);
  }

  /**
   * 4. Warm Acoustic Cafe Chime: gentle two-harmonic sine bell
   * Pure sine 784Hz [G5] + 1174.66Hz [D6] through 1400Hz lowpass filter,
   * peak gain 0.045, 8ms soft linear attack, 400ms smooth exponential decay.
   */
  public playOrderBell(): void {
    const ctx = this.ensureCtx();
    if (!ctx || this._muted) return;
    const vol = clamp(this._masterVolume, 0, 1);
    if (vol <= 0.0001) return;

    const now = ctx.currentTime;
    const dur = 0.4;
    const attack = 0.008;
    const lpf = this.createWarmUiLowpass(ctx, now);

    // Warm G5 fundamental (784Hz)
    const fundPeak = Math.max(0.0002, 0.045 * vol);
    const fundOsc = ctx.createOscillator();
    const fundGain = ctx.createGain();
    fundOsc.type = 'sine';
    fundOsc.frequency.setValueAtTime(784, now);
    fundGain.gain.setValueAtTime(0.0001, now);
    fundGain.gain.linearRampToValueAtTime(fundPeak, now + attack);
    fundGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    fundOsc.connect(fundGain);
    fundGain.connect(lpf);
    fundOsc.start(now);
    fundOsc.stop(now + dur + 0.006);

    // Soft fifth harmonic D6 (1174.66Hz)
    const harmPeak = Math.max(0.0002, 0.022 * vol);
    const harmOsc = ctx.createOscillator();
    const harmGain = ctx.createGain();
    harmOsc.type = 'sine';
    harmOsc.frequency.setValueAtTime(1174.66, now);
    harmGain.gain.setValueAtTime(0.0001, now);
    harmGain.gain.linearRampToValueAtTime(harmPeak, now + attack);
    harmGain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.85);
    harmOsc.connect(harmGain);
    harmGain.connect(lpf);
    harmOsc.start(now);
    harmOsc.stop(now + dur);
  }

  /** Quiet synth-only tap for high-frequency action buttons (fishing) - warm sine + 1400Hz lowpass. */
  public playSoftTap(): void {
    this.playUiClick();
  }

  private phoneRingTimer: number | null = null;

  /** Gentle two-tone phone ring (synth only): a few short cycles, auto-stops. */
  public playPhoneRing(): void {
    this.stopPhoneRing();
    const ctx = this.ensureCtx();
    if (!ctx) return;
    let cycles = 0;
    const ringCycle = () => {
      const c = this.ensureCtx();
      if (!c) return;
      const t0 = c.currentTime;
      const out = this.getOutputNode(c);
      for (let i = 0; i < 4; i += 1) {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(i % 2 === 0 ? 440 : 480, t0 + i * 0.32);
        gain.gain.setValueAtTime(0.0001, t0 + i * 0.32);
        gain.gain.exponentialRampToValueAtTime(0.05, t0 + i * 0.32 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.32 + 0.24);
        osc.connect(gain);
        gain.connect(out);
        osc.start(t0 + i * 0.32);
        osc.stop(t0 + i * 0.32 + 0.26);
      }
      cycles += 1;
      if (cycles >= 3 && this.phoneRingTimer !== null) {
        window.clearInterval(this.phoneRingTimer);
        this.phoneRingTimer = null;
      }
    };
    ringCycle();
    this.phoneRingTimer = window.setInterval(ringCycle, 3000);
  }

  public stopPhoneRing(): void {
    if (this.phoneRingTimer !== null) {
      window.clearInterval(this.phoneRingTimer);
      this.phoneRingTimer = null;
    }
  }

  public playHit(): void {
    if (this.playSample('player-hit', 0.36, 0.94 + Math.random() * 0.12, 35)) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(this.pitchJitter(175), now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.09);
    gain.gain.setValueAtTime(0.20, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);
    osc.connect(gain);
    gain.connect(this.getOutputNode(ctx));
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playEnemyHit(isBoss = false): void {
    const key: BlitzSampleKey = isBoss ? 'boss-hit' : 'fodder-hit';
    if (this.playSample(key, 0.35, 0.92 + Math.random() * 0.16, 55)) return;
    this.playHit();
  }

  public playStunned(): void {
    this.playSample('stunned', 0.32, 1.0, 250);
  }

  private computeExplosionDucking(): { volumeScale: number; playbackRate: number } {
    const res = computeExplosionDucking(performance.now(), this.recentExplosionTimestamps, Math.random());
    this.recentExplosionTimestamps = res.updatedTimestampsMs;
    return { volumeScale: res.duckingGain, playbackRate: res.playbackRate };
  }

  public playBarrelExplosion(): void {
    this.playTacticalExplosion(1.0);
  }

  public playPickup(): void {
    // Soft synth arpeggio only - the 'collect-gear' sample (peak -1.3 dB at 0.65
    // gain) sounded harsh, and this fires on every cast and rod equip.
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);
    const freqs = [523.25, 659.25, 783.99, 1046.5];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.045);
      gain.gain.setValueAtTime(0.09, now + idx * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.14);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now + idx * 0.045);
      osc.stop(now + idx * 0.045 + 0.15);
    });
  }

  public playCrateThrow(): void {
    if (this.playSample('release', 0.55, 0.94 + Math.random() * 0.12, 30)) return;
    this.playTacticalFirearm('pistol');
  }

  public playVictory(): void {
    if (this.playSample('victory-01', 0.75, 1.0, 0)) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.08);
      gain.gain.setValueAtTime(0.18, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.28);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.3);
    });
  }

  public playPowerCore(): void {
    this.playVictory();
  }

  /**
   * Warm, compact, non-intrusive Build Box / Stacking Pad Craft SFX.
   * Replaces the loud fanfare (`victory-01`) when crafting crates on a base stacking pad
   * so pad crafting sounds tactile and never noisy.
   */
  public playBuildBoxCraft(isAiPad = false): void {
    if (this.isThrottled(isAiPad ? 'build-box-craft-ai' : 'build-box-craft-player', isAiPad ? 420 : 180)) {
      return;
    }
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);
    const scale = isAiPad ? 0.45 : 0.85;

    // Soft tactile latch thud (Sine 165Hz -> 62Hz in 0.08s)
    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(165, now);
    thudOsc.frequency.exponentialRampToValueAtTime(62, now + 0.08);
    thudGain.gain.setValueAtTime(0.22 * scale, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    thudOsc.connect(thudGain);
    thudGain.connect(out);
    thudOsc.start(now);
    thudOsc.stop(now + 0.1);

    // Warm 2-note confirmation harmonic (Sine + low-passed Triangle, 440Hz -> 587.33Hz)
    const notes = [440, 587.33];
    notes.forEach((freq, idx) => {
      const t0 = now + idx * 0.055;
      const osc = ctx.createOscillator();
      const lpf = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(1400, t0);
      gain.gain.setValueAtTime(0.16 * scale, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
      osc.connect(lpf);
      lpf.connect(gain);
      gain.connect(out);
      osc.start(t0);
      osc.stop(t0 + 0.15);
    });
  }

  /**
   * Hydraulic cylinder lift whine + pneumatic hiss when Dump Truck raises its cargo vessel
   */
  public playHydraulicLift(): void {
    this.playSample('release', 0.48, 0.85, 80);
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.linearRampToValueAtTime(310, now + 0.48);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.54);
    osc.connect(gain);
    gain.connect(this.getOutputNode(ctx));
    osc.start(now);
    osc.stop(now + 0.55);
  }

  /**
   * Metallic tailgate clank + wooden crate tumble when crates slide out of the raised hydraulic vessel
   */
  public playHydraulicDump(): void {
    this.playSample('hit-metal', 0.62, 0.94, 50);
    this.playSample('hit-wood', 0.72, 1.02, 50);
  }

  /**
   * Buddies Blitz Character Jump Whoosh / Spring Hop SFX
   */
  public playJump(): void {
    this.playSample('release', 0.36, 1.18 + Math.random() * 0.08, 60);
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(460, now + 0.13);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(this.getOutputNode(ctx));
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * Buddies Blitz Unarmed Fist Punch Whoosh + Optional Flesh/Crate Impact Thud
   */
  public playPunch(hitTarget = false): void {
    if (hitTarget) {
      this.playSample('player-hit', 0.55, 1.05 + Math.random() * 0.12, 35);
    } else {
      this.playSample('release', 0.32, 1.32 + Math.random() * 0.1, 35);
    }
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = hitTarget ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(hitTarget ? 210 : 280, now);
    osc.frequency.exponentialRampToValueAtTime(hitTarget ? 62 : 110, now + 0.09);
    gain.gain.setValueAtTime(hitTarget ? 0.24 : 0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(this.getOutputNode(ctx));
    osc.start(now);
    osc.stop(now + 0.11);
  }

  /**
   * Buddies Blitz Heavy Boot Kick Swing + Impact Punt SFX
   */
  public playKick(hitTarget = false): void {
    if (hitTarget) {
      this.playSample('hit-generic', 0.68, 0.96 + Math.random() * 0.1, 40);
    } else {
      this.playSample('release', 0.42, 0.98 + Math.random() * 0.1, 40);
    }
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(hitTarget ? 165 : 220, now);
    osc.frequency.exponentialRampToValueAtTime(44, now + 0.14);
    gain.gain.setValueAtTime(hitTarget ? 0.28 : 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.getOutputNode(ctx));
    osc.start(now);
    osc.stop(now + 0.16);
  }

  /**
   * LG-88 Photon Lance Directed-Energy Laser Beam Discharge + Thermal Target Ignition Sizzle
   */
  public playLaserGunFire(): void {
    this.playSample('player-shoot', 0.45, 1.55 + Math.random() * 0.12, 35);
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);

    // 1. Coherent Photon Beam Frequency Sweep (1850 Hz -> 340 Hz)
    const beamOsc = ctx.createOscillator();
    const beamGain = ctx.createGain();
    beamOsc.type = 'sawtooth';
    beamOsc.frequency.setValueAtTime(1850 + Math.random() * 140, now);
    beamOsc.frequency.exponentialRampToValueAtTime(340, now + 0.13);
    beamGain.gain.setValueAtTime(0.22, now);
    beamGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    beamOsc.connect(beamGain);
    beamGain.connect(out);
    beamOsc.start(now);
    beamOsc.stop(now + 0.15);

    // 2. Harmonic Crystal Plasma Resonance (2600 Hz -> 920 Hz)
    const harmOsc = ctx.createOscillator();
    const harmGain = ctx.createGain();
    harmOsc.type = 'sine';
    harmOsc.frequency.setValueAtTime(2600, now);
    harmOsc.frequency.exponentialRampToValueAtTime(920, now + 0.11);
    harmGain.gain.setValueAtTime(0.16, now);
    harmGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    harmOsc.connect(harmGain);
    harmGain.connect(out);
    harmOsc.start(now);
    harmOsc.stop(now + 0.13);
  }

  /**
   * TITAN-6 Rotary Gatling Gun: High-RPM 6-Barrel Rotary Motor Whirr + Heavy 7.62mm Percussive Burst + Brass Casing Clatter
   */
  public playGatlingGunFire(): void {
    this.playSample('player-shoot', 0.72, 1.18 + Math.random() * 0.14, 22);
    this.playSample('hit-metal', 0.24, 1.65 + Math.random() * 0.2, 28);
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);

    // 1. Heavy 7.62mm Rotary Muzzle Punch (290 Hz -> 58 Hz)
    const punchOsc = ctx.createOscillator();
    const punchGain = ctx.createGain();
    punchOsc.type = 'square';
    punchOsc.frequency.setValueAtTime(290 + Math.random() * 35, now);
    punchOsc.frequency.exponentialRampToValueAtTime(58, now + 0.055);
    punchGain.gain.setValueAtTime(0.26, now);
    punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    punchOsc.connect(punchGain);
    punchGain.connect(out);
    punchOsc.start(now);
    punchOsc.stop(now + 0.065);

    // 2. Electric 6-Barrel Rotary Drive Whirr (480 Hz -> 540 Hz)
    const motorOsc = ctx.createOscillator();
    const motorGain = ctx.createGain();
    motorOsc.type = 'triangle';
    motorOsc.frequency.setValueAtTime(480, now);
    motorOsc.frequency.linearRampToValueAtTime(545, now + 0.06);
    motorGain.gain.setValueAtTime(0.11, now);
    motorGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    motorOsc.connect(motorGain);
    motorGain.connect(out);
    motorOsc.start(now);
    motorOsc.stop(now + 0.075);
  }
}

export function computeExplosionDucking(
  nowMs: number,
  recentTimestampsMs: number[],
  rand01 = 0.5,
): {
  duckingGain: number;
  playbackRate: number;
  updatedTimestampsMs: number[];
} {
  const filtered = recentTimestampsMs.filter((t) => nowMs - t < 350);
  const count = filtered.length;
  const updatedTimestampsMs = [...filtered, nowMs];
  const duckingGain = count === 0 ? 1.0 : count === 1 ? 0.85 : count === 2 ? 0.72 : 0.6;
  const jitter = 0.08 + Math.min(count * 0.03, 0.12);
  const playbackRate = 1.0 + (rand01 * 2 - 1) * jitter;
  return { duckingGain, playbackRate, updatedTimestampsMs };
}

/**
 * Computes 3D spatial distance attenuation gain (0.0 to 1.0) between the player listener
 * and a sound source on the map.
 * - Within `refDistance`: returns `1.0`
 * - At or beyond `maxDistance`: returns `0.0` (completely culled)
 * - Between `refDistance` and `maxDistance`: smooth quadratic roll-off `(1 - t)^2`
 */
export function computeSpatialAudioGain(
  listenerX: number,
  listenerZ: number,
  sourceX: number,
  sourceZ: number,
  maxDistance = 22,
  refDistance = 4.5,
): number {
  const dist = Math.hypot(sourceX - listenerX, sourceZ - listenerZ);
  if (dist >= maxDistance) return 0;
  if (dist <= refDistance) return 1;
  const span = Math.max(0.001, maxDistance - refDistance);
  const t = clamp((dist - refDistance) / span, 0, 1);
  return (1 - t) * (1 - t);
}

/**
 * Checks whether the player listener is currently inside the fortified perimeter of a team's base.
 */
export function isListenerInsideBasePerimeter(
  listenerX: number,
  listenerZ: number,
  baseHqX: number,
  baseHqZ: number,
  halfWidthX = 38.5,
  halfDepthZ = 24.5,
): boolean {
  return (
    Math.abs(listenerX - baseHqX) <= halfWidthX &&
    Math.abs(listenerZ - baseHqZ) <= halfDepthZ
  );
}

/**
 * Computes spatial audio gain specifically for Build Box / Stacking Pad / Base Crate events.
 * Strictly returns `0` when the player is outside that base's perimeter so build-box noises
 * NEVER leak outside the base!
 */
export function computeBuildBoxAudioGain(
  listenerX: number,
  listenerZ: number,
  padX: number,
  padZ: number,
  baseHqX: number,
  baseHqZ: number,
  isPlayerAction = false,
): number {
  if (!isListenerInsideBasePerimeter(listenerX, listenerZ, baseHqX, baseHqZ)) {
    return 0;
  }
  const distGain = computeSpatialAudioGain(
    listenerX,
    listenerZ,
    padX,
    padZ,
    isPlayerAction ? 22 : 16,
    isPlayerAction ? 5.5 : 3.5,
  );
  return isPlayerAction ? distGain : distGain * 0.45;
}

export const soundEngine = new SoundEngine();

