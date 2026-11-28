import {
  getPlanetShortestDelta,
  wrapPlanetCoord,
} from './buddiesPlanetCurvature';

export const REMOTE_INTERP_MIN_DELAY_MS = 85;
export const REMOTE_INTERP_DEFAULT_DELAY_MS = 105;
export const REMOTE_INTERP_MAX_DELAY_MS = 190;
export const REMOTE_DEAD_RECKON_MAX_MS = 260;
export const REMOTE_DEAD_RECKON_MAX_OFFSET_M = 1.8;
export const REMOTE_TELEPORT_SNAP_DISTANCE_M = 14.0;
export const DEFAULT_CHAT_BUBBLE_TTL_MS = 7500;
export const TRANSIENT_CAFE_WORK_EMOTE_TTL_MS = 6500;

export type SocialEmoteId = 'wave' | 'cheer' | 'dance' | 'salute' | 'punch' | 'kick';

export interface SocialEmoteSpec {
  id: SocialEmoteId;
  clip: `emote:${SocialEmoteId}`;
  label: string;
  slashCommand: string;
  durationMs: number;
}

export const SOCIAL_EMOTE_SPECS: Record<SocialEmoteId, SocialEmoteSpec> = {
  wave: {
    id: 'wave',
    clip: 'emote:wave',
    label: 'WAVE',
    slashCommand: '/wave',
    durationMs: 2400,
  },
  cheer: {
    id: 'cheer',
    clip: 'emote:cheer',
    label: 'CHEER',
    slashCommand: '/cheer',
    durationMs: 2600,
  },
  dance: {
    id: 'dance',
    clip: 'emote:dance',
    label: 'DANCE',
    slashCommand: '/dance',
    durationMs: 4200,
  },
  salute: {
    id: 'salute',
    clip: 'emote:salute',
    label: 'SALUTE',
    slashCommand: '/salute',
    durationMs: 2000,
  },
  punch: {
    id: 'punch',
    clip: 'emote:punch',
    label: 'JAB',
    slashCommand: '/punch',
    durationMs: 360,
  },
  kick: {
    id: 'kick',
    clip: 'emote:kick',
    label: 'KICK',
    slashCommand: '/kick',
    durationMs: 440,
  },
};

export const SOCIAL_EMOTE_QUICK_LIST: readonly SocialEmoteSpec[] = [
  SOCIAL_EMOTE_SPECS.wave,
  SOCIAL_EMOTE_SPECS.cheer,
  SOCIAL_EMOTE_SPECS.dance,
  SOCIAL_EMOTE_SPECS.salute,
];

/**
 * Returns true when a zone key represents a flat indoor coordinate space
 * (private houses, Glasshouse Cafe, Grand Casino) rather than the outdoor world map.
 */
export function isFlatIndoorZoneKey(zoneKey: string): boolean {
  return (
    zoneKey.startsWith('house:') ||
    zoneKey.startsWith('cafe:') ||
    zoneKey.startsWith('casino:')
  );
}

/**
 * Wraps a finite angle in radians into (-pi, pi] in O(1) without unbounded loops.
 */
export function normalizeAngleRad(angle: number): number {
  if (!Number.isFinite(angle)) return 0;
  let wrapped = Math.atan2(Math.sin(angle), Math.cos(angle));
  if (Object.is(wrapped, -0) || wrapped <= -Math.PI) {
    wrapped = Math.abs(wrapped) >= Math.PI - 1e-12 ? Math.PI : 0;
  }
  return wrapped;
}

/**
 * Computes the shortest signed angular delta (targetYaw - currentYaw) in [-pi, pi].
 */
export function shortestAngleDeltaRad(targetYaw: number, currentYaw: number): number {
  if (!Number.isFinite(targetYaw) || !Number.isFinite(currentYaw)) return 0;
  return Math.atan2(Math.sin(targetYaw - currentYaw), Math.cos(targetYaw - currentYaw));
}

/**
 * Shortest-arc spherical linear interpolation for yaw angles without +/-pi wrap jumps.
 */
export function lerpShortestAngleRad(fromYaw: number, toYaw: number, alpha: number): number {
  const t = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 0));
  const start = normalizeAngleRad(fromYaw);
  const delta = shortestAngleDeltaRad(toYaw, start);
  return normalizeAngleRad(start + delta * t);
}

/**
 * Frame-rate-independent exponential yaw smoothing along the shortest arc.
 */
export function smoothAngleExpRad(
  currentYaw: number,
  targetYaw: number,
  dtSec: number,
  responseHz = 20,
): number {
  const safeDt = Math.max(0, Math.min(0.25, Number.isFinite(dtSec) ? dtSec : 0));
  if (safeDt <= 0) return normalizeAngleRad(currentYaw);
  const alpha = 1 - Math.exp(-Math.max(0.1, responseHz) * safeDt);
  return lerpShortestAngleRad(currentYaw, targetYaw, alpha);
}

/**
 * Wraps a coordinate into [-period/2, +period/2) for toroidal wraparound worlds.
 */
export function wrapToroidalCoord(coord: number, period: number): number {
  if (!Number.isFinite(coord) || !Number.isFinite(period) || period <= 0) return 0;
  const half = period * 0.5;
  const shifted = (((coord + half) % period) + period) % period;
  return shifted - half;
}

/**
 * Computes the shortest signed delta between two coordinates on a toroidal world of `period`.
 */
export function shortestToroidalDelta(
  target: number,
  reference: number,
  period: number,
): number {
  if (!Number.isFinite(target) || !Number.isFinite(reference)) return 0;
  if (!Number.isFinite(period) || period <= 0) return target - reference;
  const half = period * 0.5;
  let d = (((target - reference) % period) + period) % period;
  if (d > half) d -= period;
  return d;
}

/**
 * Computes signed delta along one axis using flat Euclidean math indoors or
 * planetary/toroidal shortest-delta math outdoors.
 */
export function computeZoneDelta(
  target: number,
  reference: number,
  isFlatIndoor: boolean,
  toroidalPeriod?: number,
): number {
  if (!Number.isFinite(target) || !Number.isFinite(reference)) return 0;
  if (isFlatIndoor) return target - reference;
  if (toroidalPeriod && toroidalPeriod > 0) {
    return shortestToroidalDelta(target, reference, toroidalPeriod);
  }
  return getPlanetShortestDelta(target, reference);
}

/**
 * Wraps/clamps a single coordinate if outdoors, leaving flat indoor coordinates untouched.
 */
export function normalizeZoneCoord(
  coord: number,
  isFlatIndoor: boolean,
  toroidalPeriod?: number,
): number {
  if (!Number.isFinite(coord)) return 0;
  if (isFlatIndoor) return coord;
  if (toroidalPeriod && toroidalPeriod > 0) {
    return wrapToroidalCoord(coord, toroidalPeriod);
  }
  return wrapPlanetCoord(coord);
}

/**
 * Interpolates between two coordinates using flat linear math indoors or
 * wrap-aware shortest-delta math outdoors.
 */
export function lerpZoneCoord(
  from: number,
  to: number,
  alpha: number,
  isFlatIndoor: boolean,
  toroidalPeriod?: number,
): number {
  const t = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 0));
  const delta = computeZoneDelta(to, from, isFlatIndoor, toroidalPeriod);
  return normalizeZoneCoord(from + delta * t, isFlatIndoor, toroidalPeriod);
}

/**
 * Adds a spatial offset to a coordinate and normalizes/wraps if outdoors.
 */
export function addZoneOffset(
  coord: number,
  delta: number,
  isFlatIndoor: boolean,
  toroidalPeriod?: number,
): number {
  const safeCoord = Number.isFinite(coord) ? coord : 0;
  const safeDelta = Number.isFinite(delta) ? delta : 0;
  return normalizeZoneCoord(safeCoord + safeDelta, isFlatIndoor, toroidalPeriod);
}

/**
 * Computes 2D distance between (ax, az) and (bx, bz) respecting indoor vs outdoor wrap math.
 */
export function computeZoneDistance2D(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  isFlatIndoor: boolean,
  toroidalPeriod?: number,
): number {
  const dx = computeZoneDelta(ax, bx, isFlatIndoor, toroidalPeriod);
  const dz = computeZoneDelta(az, bz, isFlatIndoor, toroidalPeriod);
  return Math.hypot(dx, dz);
}

export interface RemotePoseSample {
  seq: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  jumpOffset: number;
  senderStampMs: number;
  receivedAtMs: number;
  isSitting: boolean;
  isSleeping: boolean;
}

export interface RemotePoseSampleInput {
  seq?: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  jumpOffset?: number;
  senderStampMs: number;
  receivedAtMs: number;
  isSitting?: boolean;
  isSleeping?: boolean;
}

export interface PeerInterpolationState {
  samples: RemotePoseSample[];
  lastSeq: number;
  lastSenderStampMs: number;
  lastArrivalMs: number;
  jitterMs: number;
  adaptiveDelayMs: number;
  playbackMs: number;
  smoothedX: number;
  smoothedZ: number;
  smoothedYaw: number;
  smoothedJumpOffset: number;
  initialized: boolean;
}

export function createPeerInterpolationState(): PeerInterpolationState {
  return {
    samples: [],
    lastSeq: 0,
    lastSenderStampMs: 0,
    lastArrivalMs: 0,
    jitterMs: 0,
    adaptiveDelayMs: REMOTE_INTERP_DEFAULT_DELAY_MS,
    playbackMs: 0,
    smoothedX: 0,
    smoothedZ: 0,
    smoothedYaw: 0,
    smoothedJumpOffset: 0,
    initialized: false,
  };
}

export function resetPeerInterpolationState(state: PeerInterpolationState): void {
  state.samples.length = 0;
  state.lastSeq = 0;
  state.lastSenderStampMs = 0;
  state.lastArrivalMs = 0;
  state.jitterMs = 0;
  state.adaptiveDelayMs = REMOTE_INTERP_DEFAULT_DELAY_MS;
  state.playbackMs = 0;
  state.initialized = false;
}

/**
 * Determines whether an incoming packet should be accepted over the latest recorded
 * sequence & sender timestamp, rejecting delayed/reordered packets while permitting
 * clean reconnect/tab-reload resets.
 */
export function shouldAcceptPeerPacketOrder(
  prevSeq: number,
  prevSentAtMs: number,
  nextSeq: number,
  nextSentAtMs: number,
): boolean {
  if (nextSeq > 0 && prevSeq > 0) {
    if (nextSeq > prevSeq) return true;
    // Allow session reconnects / refreshes where sequence restarts low and timestamp advances cleanly
    if (nextSeq <= 3 && nextSentAtMs > prevSentAtMs + 1500) {
      return true;
    }
    return false;
  }
  if (nextSentAtMs > 0 && prevSentAtMs > 0) {
    return nextSentAtMs > prevSentAtMs;
  }
  return true;
}

export function pushRemotePoseSample(
  state: PeerInterpolationState,
  input: RemotePoseSampleInput,
  options?: {
    maxSamples?: number;
    expectedCadenceMs?: number;
    teleportDistanceM?: number;
    isFlatIndoor?: boolean;
    toroidalPeriod?: number;
  },
): boolean {
  const seq = Number.isFinite(input.seq) ? Math.max(0, Math.floor(input.seq!)) : 0;
  const senderStampMs = Number.isFinite(input.senderStampMs) ? input.senderStampMs : input.receivedAtMs;
  if (
    state.samples.length > 0 &&
    !shouldAcceptPeerPacketOrder(state.lastSeq, state.lastSenderStampMs, seq, senderStampMs)
  ) {
    return false;
  }

  const maxSamples = options?.maxSamples ?? 10;
  const expectedCadenceMs = options?.expectedCadenceMs ?? 88;
  const teleportDist = options?.teleportDistanceM ?? REMOTE_TELEPORT_SNAP_DISTANCE_M;
  const isFlatIndoor = options?.isFlatIndoor ?? false;
  const toroidalPeriod = options?.toroidalPeriod;

  const receivedAtMs = Math.max(
    input.receivedAtMs,
    state.samples.length > 0 ? state.samples[state.samples.length - 1].receivedAtMs : 0,
  );

  // Measure inter-arrival jitter only across active packet bursts (skip long idle heartbeats > 450ms)
  if (state.lastArrivalMs > 0) {
    const interArrivalMs = receivedAtMs - state.lastArrivalMs;
    if (interArrivalMs > 0 && interArrivalMs <= 450) {
      const arrivalDeviation = Math.abs(interArrivalMs - expectedCadenceMs);
      state.jitterMs = state.jitterMs * 0.78 + arrivalDeviation * 0.22;
      const targetDelay = Math.max(
        REMOTE_INTERP_MIN_DELAY_MS,
        Math.min(
          REMOTE_INTERP_MAX_DELAY_MS,
          REMOTE_INTERP_DEFAULT_DELAY_MS + state.jitterMs * 1.15,
        ),
      );
      state.adaptiveDelayMs = state.adaptiveDelayMs * 0.85 + targetDelay * 0.15;
    }
  }
  state.lastArrivalMs = receivedAtMs;

  const sample: RemotePoseSample = {
    seq,
    x: Number.isFinite(input.x) ? input.x : 0,
    z: Number.isFinite(input.z) ? input.z : 0,
    vx: Number.isFinite(input.vx) ? input.vx : 0,
    vz: Number.isFinite(input.vz) ? input.vz : 0,
    yaw: normalizeAngleRad(input.yaw),
    jumpOffset: Math.max(0, Number.isFinite(input.jumpOffset) ? input.jumpOffset! : 0),
    senderStampMs,
    receivedAtMs,
    isSitting: Boolean(input.isSitting),
    isSleeping: Boolean(input.isSleeping),
  };

  // On teleport/zone jump, discard older pre-jump snapshots so interpolation never slides across the map
  const prevSample = state.samples[state.samples.length - 1];
  if (
    prevSample &&
    computeZoneDistance2D(
      sample.x,
      sample.z,
      prevSample.x,
      prevSample.z,
      isFlatIndoor,
      toroidalPeriod,
    ) > teleportDist
  ) {
    state.samples.length = 0;
  }

  state.samples.push(sample);
  if (state.samples.length > maxSamples) {
    state.samples.splice(0, state.samples.length - maxSamples);
  }
  state.lastSeq = seq;
  state.lastSenderStampMs = senderStampMs;
  return true;
}

export interface RemoteInterpolationStepResult {
  x: number;
  z: number;
  yaw: number;
  jumpOffset: number;
  vx: number;
  vz: number;
  visualSpeedMps: number;
  didTeleport: boolean;
  isDeadReckoning: boolean;
}

export function stepRemoteAvatarInterpolation(
  state: PeerInterpolationState,
  params: {
    nowMs: number;
    dtSec: number;
    isFlatIndoor: boolean;
    fallbackPose: {
      x: number;
      z: number;
      vx: number;
      vz: number;
      yaw: number;
      jumpOffset?: number;
      isSitting?: boolean;
      isSleeping?: boolean;
    };
    teleportDistanceM?: number;
    maxDeadReckonMs?: number;
    maxDeadReckonOffsetM?: number;
    toroidalPeriod?: number;
  },
): RemoteInterpolationStepResult {
  const {
    nowMs,
    dtSec,
    isFlatIndoor,
    fallbackPose,
    teleportDistanceM = REMOTE_TELEPORT_SNAP_DISTANCE_M,
    maxDeadReckonMs = REMOTE_DEAD_RECKON_MAX_MS,
    maxDeadReckonOffsetM = REMOTE_DEAD_RECKON_MAX_OFFSET_M,
    toroidalPeriod,
  } = params;

  const safeDt = Math.max(0, Math.min(0.25, Number.isFinite(dtSec) ? dtSec : 0));
  const samples = state.samples;

  const evaluateAtPlayback = (playbackMs: number) => {
    let targetX = normalizeZoneCoord(fallbackPose.x, isFlatIndoor, toroidalPeriod);
    let targetZ = normalizeZoneCoord(fallbackPose.z, isFlatIndoor, toroidalPeriod);
    let targetYaw = normalizeAngleRad(fallbackPose.yaw);
    let targetJump = Math.max(0, fallbackPose.jumpOffset ?? 0);
    let targetVx = fallbackPose.vx ?? 0;
    let targetVz = fallbackPose.vz ?? 0;
    let isDeadReckoning = false;

    if (samples.length > 0) {
      const newest = samples[samples.length - 1];
      if (playbackMs >= newest.receivedAtMs) {
        const gapMs = Math.max(0, playbackMs - newest.receivedAtMs);
        const speedMag = Math.hypot(newest.vx, newest.vz);
        const canDeadReckon =
          gapMs > 0 &&
          gapMs <= maxDeadReckonMs &&
          speedMag > 0.05 &&
          !newest.isSitting &&
          !newest.isSleeping;

        if (canDeadReckon) {
          isDeadReckoning = true;
          const clampedSec = Math.min(maxDeadReckonMs, gapMs) / 1000;
          // Exponentially decaying dead-reckoning: integral of v * e^(-k*t) dt = v * (1 - e^(-k*t)) / k
          const decayRate = 5.5;
          const effectiveDistFactor = (1 - Math.exp(-decayRate * clampedSec)) / decayRate;
          const instDecay = Math.exp(-decayRate * clampedSec);
          let offX = newest.vx * effectiveDistFactor;
          let offZ = newest.vz * effectiveDistFactor;
          const offMag = Math.hypot(offX, offZ);
          if (offMag > maxDeadReckonOffsetM && offMag > 1e-6) {
            const capScale = maxDeadReckonOffsetM / offMag;
            offX *= capScale;
            offZ *= capScale;
          }
          targetX = addZoneOffset(newest.x, offX, isFlatIndoor, toroidalPeriod);
          targetZ = addZoneOffset(newest.z, offZ, isFlatIndoor, toroidalPeriod);
          targetVx = newest.vx * instDecay;
          targetVz = newest.vz * instDecay;
        } else {
          targetX = normalizeZoneCoord(newest.x, isFlatIndoor, toroidalPeriod);
          targetZ = normalizeZoneCoord(newest.z, isFlatIndoor, toroidalPeriod);
          targetVx = gapMs > maxDeadReckonMs ? 0 : newest.vx;
          targetVz = gapMs > maxDeadReckonMs ? 0 : newest.vz;
        }
        targetYaw = newest.yaw;
        targetJump = newest.jumpOffset;
      } else {
        let sampleA = samples[0];
        let sampleB = samples[0];
        for (let i = 0; i < samples.length; i++) {
          if (samples[i].receivedAtMs <= playbackMs) {
            sampleA = samples[i];
          }
          if (samples[i].receivedAtMs >= playbackMs) {
            sampleB = samples[i];
            break;
          }
        }
        if (sampleB !== sampleA && sampleB.receivedAtMs > sampleA.receivedAtMs) {
          const spanMs = sampleB.receivedAtMs - sampleA.receivedAtMs;
          const t = Math.max(0, Math.min(1, (playbackMs - sampleA.receivedAtMs) / spanMs));
          const segDist = computeZoneDistance2D(
            sampleA.x,
            sampleA.z,
            sampleB.x,
            sampleB.z,
            isFlatIndoor,
            toroidalPeriod,
          );
          if (segDist > teleportDistanceM) {
            targetX = normalizeZoneCoord(sampleB.x, isFlatIndoor, toroidalPeriod);
            targetZ = normalizeZoneCoord(sampleB.z, isFlatIndoor, toroidalPeriod);
            targetYaw = sampleB.yaw;
            targetJump = sampleB.jumpOffset;
            targetVx = 0;
            targetVz = 0;
          } else {
            targetX = lerpZoneCoord(sampleA.x, sampleB.x, t, isFlatIndoor, toroidalPeriod);
            targetZ = lerpZoneCoord(sampleA.z, sampleB.z, t, isFlatIndoor, toroidalPeriod);
            targetYaw = lerpShortestAngleRad(sampleA.yaw, sampleB.yaw, t);
            targetJump = sampleA.jumpOffset + (sampleB.jumpOffset - sampleA.jumpOffset) * t;
            targetVx = sampleA.vx + (sampleB.vx - sampleA.vx) * t;
            targetVz = sampleA.vz + (sampleB.vz - sampleA.vz) * t;
          }
        } else {
          targetX = normalizeZoneCoord(sampleA.x, isFlatIndoor, toroidalPeriod);
          targetZ = normalizeZoneCoord(sampleA.z, isFlatIndoor, toroidalPeriod);
          targetYaw = sampleA.yaw;
          targetJump = sampleA.jumpOffset;
          targetVx = sampleA.vx;
          targetVz = sampleA.vz;
        }
      }
    }

    return {
      targetX,
      targetZ,
      targetYaw,
      targetJump,
      targetVx,
      targetVz,
      isDeadReckoning,
    };
  };

  if (!state.initialized) {
    state.playbackMs = nowMs - state.adaptiveDelayMs;
    const initEval = evaluateAtPlayback(state.playbackMs);
    state.smoothedX = initEval.targetX;
    state.smoothedZ = initEval.targetZ;
    state.smoothedYaw = initEval.targetYaw;
    state.smoothedJumpOffset = initEval.targetJump;
    state.initialized = true;
    return {
      x: initEval.targetX,
      z: initEval.targetZ,
      yaw: initEval.targetYaw,
      jumpOffset: initEval.targetJump,
      vx: initEval.targetVx,
      vz: initEval.targetVz,
      visualSpeedMps: 0,
      didTeleport: true,
      isDeadReckoning: initEval.isDeadReckoning,
    };
  }

  // Advance playback clock monotonically so adaptive jitter delay changes never scrub backwards
  const desiredPlaybackMs = nowMs - state.adaptiveDelayMs;
  if (desiredPlaybackMs - state.playbackMs > 600) {
    state.playbackMs = desiredPlaybackMs;
  } else {
    state.playbackMs = Math.max(state.playbackMs, desiredPlaybackMs);
  }

  const {
    targetX,
    targetZ,
    targetYaw,
    targetJump,
    targetVx,
    targetVz,
    isDeadReckoning,
  } = evaluateAtPlayback(state.playbackMs);

  const prevX = state.smoothedX;
  const prevZ = state.smoothedZ;
  const deltaToTarget = computeZoneDistance2D(
    targetX,
    targetZ,
    prevX,
    prevZ,
    isFlatIndoor,
    toroidalPeriod,
  );

  let didTeleport = false;
  if (deltaToTarget > teleportDistanceM) {
    state.smoothedX = targetX;
    state.smoothedZ = targetZ;
    state.smoothedYaw = targetYaw;
    state.smoothedJumpOffset = targetJump;
    didTeleport = true;
  } else if (safeDt > 0) {
    const posAlpha = 1 - Math.exp(-22 * safeDt);
    const jumpAlpha = 1 - Math.exp(-24 * safeDt);
    state.smoothedX = lerpZoneCoord(prevX, targetX, posAlpha, isFlatIndoor, toroidalPeriod);
    state.smoothedZ = lerpZoneCoord(prevZ, targetZ, posAlpha, isFlatIndoor, toroidalPeriod);
    state.smoothedYaw = smoothAngleExpRad(state.smoothedYaw, targetYaw, safeDt, 20);
    state.smoothedJumpOffset =
      state.smoothedJumpOffset + (targetJump - state.smoothedJumpOffset) * jumpAlpha;
  } else {
    state.smoothedX = targetX;
    state.smoothedZ = targetZ;
    state.smoothedYaw = targetYaw;
    state.smoothedJumpOffset = targetJump;
  }

  let visualSpeedMps = Math.hypot(targetVx, targetVz);
  if (!didTeleport && safeDt > 1e-4) {
    const movedDist = computeZoneDistance2D(
      state.smoothedX,
      state.smoothedZ,
      prevX,
      prevZ,
      isFlatIndoor,
      toroidalPeriod,
    );
    const renderedSpeed = movedDist / safeDt;
    // Blend interpolated velocity with actual rendered speed so idle settling & gap pauses never skate legs
    if (visualSpeedMps < 0.08 && renderedSpeed < 0.25) {
      visualSpeedMps = 0;
    } else if (renderedSpeed > 0.05) {
      visualSpeedMps = visualSpeedMps * 0.5 + Math.min(18, renderedSpeed) * 0.5;
    }
  } else if (didTeleport) {
    visualSpeedMps = 0;
  }

  return {
    x: state.smoothedX,
    z: state.smoothedZ,
    yaw: state.smoothedYaw,
    jumpOffset: state.smoothedJumpOffset,
    vx: targetVx,
    vz: targetVz,
    visualSpeedMps,
    didTeleport,
    isDeadReckoning,
  };
}

/**
 * Determines the minimum broadcast interval (0 = immediate) for the local player's pose
 * so discrete idle stops, landings, emotes, and chat triggers reach peers without 1.1s lag.
 */
export function computeLocalPoseBroadcastIntervalMs(params: {
  zoneChanged: boolean;
  chatChanged: boolean;
  emoteChanged: boolean;
  discreteStateChanged: boolean;
  stoppedMoving: boolean;
  landedJump: boolean;
  yawDeltaRad: number;
  isActivelyMoving: boolean;
}): number {
  if (
    params.zoneChanged ||
    params.chatChanged ||
    params.emoteChanged ||
    params.stoppedMoving ||
    params.landedJump
  ) {
    return 0;
  }
  if (params.discreteStateChanged || params.yawDeltaRad > 0.04) {
    return 45;
  }
  if (params.isActivelyMoving) {
    return 88;
  }
  return 1100;
}

/**
 * Parses slash emote commands such as `/wave`, `/cheer`, `/dance`, `/salute` from chat input.
 */
export function parseSocialEmoteCommand(text: string): SocialEmoteId | null {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed.startsWith('/')) return null;
  const cmd = trimmed.split(/\s+/)[0];
  for (const spec of Object.values(SOCIAL_EMOTE_SPECS)) {
    if (cmd === spec.slashCommand) {
      return spec.id;
    }
  }
  return null;
}

export function resolveLocalEmoteClip(params: {
  isSleeping: boolean;
  cafeWorkPhase: 'idle' | 'prep_move' | 'prep_act' | 'serve_move' | 'serve_act';
  cafeCategory: 'drink' | 'pastry';
  consumeItemId: string | null;
  isCafeWorker: boolean;
  isSitting: boolean;
  sitVariant: string | null;
  activeSocialEmoteClip: string | null;
}): string {
  if (params.isSleeping) return 'bed:sleep';
  if (params.cafeWorkPhase === 'prep_act') {
    return params.cafeCategory === 'pastry' ? 'cafe:tray' : 'cafe:coffee';
  }
  if (params.cafeWorkPhase === 'serve_act') {
    return 'cafe:serve';
  }
  if (params.consumeItemId && !params.isCafeWorker) {
    if (params.isSitting && params.sitVariant && params.sitVariant !== 'chair') {
      return `eat:${params.consumeItemId}@${params.sitVariant}`;
    }
    return `eat:${params.consumeItemId}`;
  }
  if (params.isSitting && params.sitVariant && params.sitVariant !== 'chair') {
    return `seat:${params.sitVariant}`;
  }
  if (params.activeSocialEmoteClip) {
    return params.activeSocialEmoteClip;
  }
  return '';
}

export function isTransientLiveEmoteClip(clip: string): boolean {
  return clip.startsWith('emote:') || clip.startsWith('cafe:');
}

export function getDefaultEmoteDurationMs(clip: string): number {
  if (clip.startsWith('emote:')) {
    const id = clip.slice('emote:'.length) as SocialEmoteId;
    return SOCIAL_EMOTE_SPECS[id]?.durationMs ?? 2600;
  }
  if (clip.startsWith('cafe:')) {
    return TRANSIENT_CAFE_WORK_EMOTE_TTL_MS;
  }
  return 0;
}

export interface RemoteEmoteState {
  emoteClip: string;
  seenSeq: number;
  startedAtMs: number;
  expiresAtMs: number;
}

export function createRemoteEmoteState(): RemoteEmoteState {
  return {
    emoteClip: '',
    seenSeq: 0,
    startedAtMs: 0,
    expiresAtMs: 0,
  };
}

export function mergeRemoteEmoteState(
  prev: RemoteEmoteState,
  incoming: {
    emoteClip: string;
    emoteSeq?: number;
    emoteDurationMs?: number;
    fromPresence?: boolean;
  },
  nowMs: number,
): RemoteEmoteState {
  // Never let coarse Presence overwrite a live Broadcast emote state
  if (incoming.fromPresence && prev.seenSeq > 0 && (incoming.emoteSeq ?? 0) <= prev.seenSeq) {
    return prev;
  }

  const nextClip = (incoming.emoteClip || '').trim();
  const nextSeq = Number.isFinite(incoming.emoteSeq) ? Math.max(0, Math.floor(incoming.emoteSeq!)) : 0;

  if (!nextClip) {
    if (nextSeq > 0 && nextSeq < prev.seenSeq) return prev;
    return {
      emoteClip: '',
      seenSeq: Math.max(prev.seenSeq, nextSeq),
      startedAtMs: 0,
      expiresAtMs: 0,
    };
  }

  const isRetriggered =
    nextSeq > prev.seenSeq || nextClip !== prev.emoteClip;
  if (!isRetriggered) {
    return prev;
  }

  const durationMs =
    incoming.emoteDurationMs && incoming.emoteDurationMs > 0
      ? incoming.emoteDurationMs
      : getDefaultEmoteDurationMs(nextClip);

  return {
    emoteClip: nextClip,
    seenSeq: Math.max(prev.seenSeq, nextSeq),
    startedAtMs: nowMs,
    expiresAtMs: durationMs > 0 ? nowMs + durationMs : 0,
  };
}

export function getActiveRemoteEmoteClip(
  state: RemoteEmoteState,
  nowMs: number,
): string {
  if (!state.emoteClip) return '';
  if (state.expiresAtMs > 0 && nowMs >= state.expiresAtMs) {
    return '';
  }
  return state.emoteClip;
}

export function sanitizeHexColor(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed) || /^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return fallback;
}

export function resolveContrastingTextColor(bgHex: string): string {
  const clean = sanitizeHexColor(bgHex, '#ffffff');
  const full =
    clean.length === 4
      ? `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`
      : clean;
  const r = parseInt(full.slice(1, 3), 16);
  const g = parseInt(full.slice(3, 5), 16);
  const b = parseInt(full.slice(5, 7), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma < 0.48 ? '#f8fafc' : '#0f172a';
}

export function resolveBubbleStyle(
  bgColor?: string | null,
  textColor?: string | null,
): { bgColor: string; textColor: string } {
  const bg = sanitizeHexColor(bgColor, '#ffffff');
  const txt = sanitizeHexColor(textColor, resolveContrastingTextColor(bg));
  return { bgColor: bg, textColor: txt };
}

export interface RemoteChatBubbleState {
  text: string | null;
  bgColor: string;
  textColor: string;
  seenSeq: number;
  receivedAtMs: number;
  expiresAtMs: number;
}

export function createRemoteChatBubbleState(): RemoteChatBubbleState {
  return {
    text: null,
    bgColor: '#ffffff',
    textColor: '#0f172a',
    seenSeq: 0,
    receivedAtMs: 0,
    expiresAtMs: 0,
  };
}

export function mergeRemoteChatBubbleState(
  prev: RemoteChatBubbleState,
  incoming: {
    text: string | null;
    seq?: number;
    bgColor?: string | null;
    textColor?: string | null;
    fromPresence?: boolean;
  },
  nowMs: number,
  ttlMs = DEFAULT_CHAT_BUBBLE_TTL_MS,
): RemoteChatBubbleState {
  const nextSeq = Number.isFinite(incoming.seq) ? Math.max(0, Math.floor(incoming.seq!)) : 0;
  // Stale Presence snapshots must never resurrect an expired or overwritten bubble
  if (incoming.fromPresence && prev.seenSeq > 0 && nextSeq <= prev.seenSeq) {
    return prev;
  }

  const cleanText =
    typeof incoming.text === 'string' && incoming.text.trim()
      ? incoming.text.trim().slice(0, 64)
      : null;

  if (!cleanText) {
    if (nextSeq > 0 && nextSeq < prev.seenSeq) return prev;
    if (incoming.fromPresence) return prev;
    return {
      ...prev,
      text: null,
      seenSeq: Math.max(prev.seenSeq, nextSeq),
      expiresAtMs: 0,
    };
  }

  const style = resolveBubbleStyle(incoming.bgColor, incoming.textColor);
  const isNewBubble =
    (nextSeq > 0 && nextSeq > prev.seenSeq) ||
    cleanText !== prev.text ||
    nowMs >= prev.expiresAtMs;

  if (!isNewBubble) {
    // Allow style update even if text is the same
    if (style.bgColor !== prev.bgColor || style.textColor !== prev.textColor) {
      return {
        ...prev,
        bgColor: style.bgColor,
        textColor: style.textColor,
      };
    }
    return prev;
  }

  return {
    text: cleanText,
    bgColor: style.bgColor,
    textColor: style.textColor,
    seenSeq: Math.max(prev.seenSeq, nextSeq),
    receivedAtMs: nowMs,
    expiresAtMs: nowMs + Math.max(500, ttlMs),
  };
}

export function getActiveRemoteChatBubble(
  state: RemoteChatBubbleState,
  nowMs: number,
): { text: string; bgColor: string; textColor: string; seq: number } | null {
  if (!state.text || nowMs >= state.expiresAtMs) return null;
  return {
    text: state.text,
    bgColor: state.bgColor,
    textColor: state.textColor,
    seq: state.seenSeq,
  };
}

export interface ReconcilablePeerPacket {
  sessionId: string;
  nearAccountId: string | null;
  displayName: string;
  gender: 'male' | 'female';
  team: 'blue' | 'red';
  zoneKey: string;
  inWorld: boolean;
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  jumpOffset: number;
  weaponId: string;
  carryingCrate: string;
  isSitting: boolean;
  isDriving: boolean;
  isHiddenInVehicle: boolean;
  scooterKind: 'electric_scooter_bike' | 'push_kick_scooter' | null;
  fishingPhase: 'idle' | 'charging' | 'casting' | 'nibble' | 'bite' | 'fighting';
  isReeling: boolean;
  rodBend: number;
  hasClaimedBase: boolean;
  isCafeWorker: boolean;
  cafePreparing: boolean;
  level: number;
  emoteClip: string;
  chatBubbleText: string | null;
  updatedAtMs: number;
  seq?: number;
  sentAtMs?: number;
  emoteSeq?: number;
  emoteStartedAtMs?: number;
  emoteDurationMs?: number;
  seatLiftY?: number;
  chatBubbleSeq?: number;
  chatBubbleBgColor?: string | null;
  chatBubbleTextColor?: string | null;
  roleBadge?: string;
  buildingProject?: string;
  socialX?: string;
  socialGithub?: string;
  socialWebsite?: string;
  statusCaption?: string;
  appearOnline?: boolean;
  allowFriendRequests?: boolean;
  privateMessages?: string;
  apartmentVisits?: string;
  showWalletAddressOnProfile?: boolean;
  showThingsOnProfile?: boolean;
}

/**
 * Reconciles an incoming Presence snapshot or Broadcast pose packet against the
 * current peer entry, ensuring stale Presence syncs never roll back fresher
 * Broadcast positions, emotes, or chat bubbles.
 */
export function reconcileWorldPeerPacket<T extends ReconcilablePeerPacket>(
  existing: T | undefined,
  incoming: T,
  source: 'broadcast' | 'presence',
  nowMs: number,
): T {
  if (!existing) {
    return incoming;
  }

  const inSeq = incoming.seq ?? 0;
  const exSeq = existing.seq ?? 0;
  const inSent = incoming.sentAtMs ?? 0;
  const exSent = existing.sentAtMs ?? 0;

  if (source === 'broadcast') {
    if (!shouldAcceptPeerPacketOrder(exSeq, exSent, inSeq, inSent)) {
      return existing;
    }
    const exBubbleSeq = existing.chatBubbleSeq ?? 0;
    const inBubbleSeq = incoming.chatBubbleSeq ?? 0;
    const preserveNewerBubble = exBubbleSeq > inBubbleSeq && existing.chatBubbleText;

    const exEmoteSeq = existing.emoteSeq ?? 0;
    const inEmoteSeq = incoming.emoteSeq ?? 0;
    const preserveNewerEmote = exEmoteSeq > inEmoteSeq && existing.emoteClip;

    return {
      ...incoming,
      chatBubbleText: preserveNewerBubble ? existing.chatBubbleText : incoming.chatBubbleText,
      chatBubbleSeq: preserveNewerBubble ? exBubbleSeq : inBubbleSeq,
      chatBubbleBgColor: preserveNewerBubble
        ? existing.chatBubbleBgColor
        : incoming.chatBubbleBgColor,
      chatBubbleTextColor: preserveNewerBubble
        ? existing.chatBubbleTextColor
        : incoming.chatBubbleTextColor,
      emoteClip: preserveNewerEmote ? existing.emoteClip : incoming.emoteClip,
      emoteSeq: preserveNewerEmote ? exEmoteSeq : inEmoteSeq,
      emoteStartedAtMs: preserveNewerEmote
        ? existing.emoteStartedAtMs
        : incoming.emoteStartedAtMs,
      emoteDurationMs: preserveNewerEmote
        ? existing.emoteDurationMs
        : incoming.emoteDurationMs,
    };
  }

  // Presence source: authoritative for metadata & zone fallback, NOT for fresher pose/emote/bubble
  const broadcastIsFresh = nowMs - existing.updatedAtMs <= 4000;
  const presenceIsStrictlyNewer = inSeq > exSeq || (inSeq === 0 && inSent > exSent + 250);

  if (existing.zoneKey !== incoming.zoneKey && (!broadcastIsFresh || presenceIsStrictlyNewer)) {
    return incoming;
  }

  if (!broadcastIsFresh && presenceIsStrictlyNewer) {
    const exBubbleSeq = existing.chatBubbleSeq ?? 0;
    const inBubbleSeq = incoming.chatBubbleSeq ?? 0;
    return {
      ...incoming,
      // Never resurrect a stale chat bubble from Presence if sequence didn't advance
      chatBubbleText: inBubbleSeq > exBubbleSeq ? incoming.chatBubbleText : null,
      chatBubbleSeq: Math.max(exBubbleSeq, inBubbleSeq),
    };
  }

  // Metadata-only update without touching updatedAtMs, position, emoteClip, or chatBubbleText
  return {
    ...existing,
    displayName: incoming.displayName,
    gender: incoming.gender,
    nearAccountId: incoming.nearAccountId,
    inWorld: incoming.inWorld,
    hasClaimedBase: incoming.hasClaimedBase,
    isCafeWorker: incoming.isCafeWorker,
    level: incoming.level,
    roleBadge: incoming.roleBadge ?? existing.roleBadge,
    buildingProject: incoming.buildingProject ?? existing.buildingProject,
    socialX: incoming.socialX ?? existing.socialX,
    socialGithub: incoming.socialGithub ?? existing.socialGithub,
    socialWebsite: incoming.socialWebsite ?? existing.socialWebsite,
    statusCaption: incoming.statusCaption ?? existing.statusCaption,
    appearOnline: incoming.appearOnline ?? existing.appearOnline,
    allowFriendRequests: incoming.allowFriendRequests ?? existing.allowFriendRequests,
    privateMessages: incoming.privateMessages ?? existing.privateMessages,
    apartmentVisits: incoming.apartmentVisits ?? existing.apartmentVisits,
    showWalletAddressOnProfile:
      incoming.showWalletAddressOnProfile ?? existing.showWalletAddressOnProfile,
    showThingsOnProfile: incoming.showThingsOnProfile ?? existing.showThingsOnProfile,
  };
}

export interface MergeableChatMessage {
  id: string;
  clientMsgId?: string;
  senderId?: string;
  senderName: string;
  recipientId?: string;
  recipientName?: string;
  isSelf?: boolean;
  text: string;
  timestamp: string;
  createdAtMs?: number;
  bubbleBgColor?: string;
  bubbleTextColor?: string;
  type: 'public' | 'private';
}

function isEphemeralChatId(id: string): boolean {
  return (
    id.startsWith('pub-') ||
    id.startsWith('priv-') ||
    id.startsWith('bc-') ||
    id.startsWith('inv-')
  );
}

/**
 * Merges a newly arrived realtime chat message (either from fast Broadcast or
 * PostgreSQL Realtime INSERT) into the existing list, upgrading ephemeral IDs to
 * canonical DB UUIDs in place and preserving sender bubble colors while preventing
 * duplicate notifications.
 */
export function mergeRealtimeSocialChatMessage<T extends MergeableChatMessage>(
  existingMessages: readonly T[],
  incoming: T,
  options: {
    localPlayerName: string;
    localPlayerUid?: string | null;
    isOwnFn: (msg: T) => boolean;
    simplifyNameFn: (name: string) => string;
    dedupWindowMs?: number;
  },
): {
  nextMessages: T[];
  isDuplicate: boolean;
  upgradedExisting: boolean;
} {
  const dedupWindowMs = options.dedupWindowMs ?? 20_000;
  const resolvedIsSelf = options.isOwnFn(incoming);
  const normalizedIncoming: T = {
    ...incoming,
    isSelf: resolvedIsSelf,
  };

  // 1. Exact ID match
  if (existingMessages.some((m) => m.id === normalizedIncoming.id)) {
    return {
      nextMessages: existingMessages as T[],
      isDuplicate: true,
      upgradedExisting: false,
    };
  }

  // 2. Exact clientMsgId match (e.g. Broadcast 'bc-xyz' + DB echo or vice-versa)
  if (normalizedIncoming.clientMsgId) {
    const clientMatchIdx = existingMessages.findIndex(
      (m) =>
        m.clientMsgId === normalizedIncoming.clientMsgId ||
        m.id === normalizedIncoming.clientMsgId,
    );
    if (clientMatchIdx >= 0) {
      const prevMsg = existingMessages[clientMatchIdx];
      const next = [...existingMessages];
      next[clientMatchIdx] = {
        ...prevMsg,
        ...normalizedIncoming,
        id: isEphemeralChatId(normalizedIncoming.id) ? prevMsg.id : normalizedIncoming.id,
        bubbleBgColor: prevMsg.bubbleBgColor ?? normalizedIncoming.bubbleBgColor,
        bubbleTextColor: prevMsg.bubbleTextColor ?? normalizedIncoming.bubbleTextColor,
        isSelf: Boolean(prevMsg.isSelf || resolvedIsSelf),
      };
      return {
        nextMessages: next,
        isDuplicate: false,
        upgradedExisting: true,
      };
    }
  }

  // 3. Semantic cross-transport match (Optimistic/Broadcast <-> DB Realtime INSERT)
  const cleanText = normalizedIncoming.text.trim();
  const cleanRecipient = options
    .simplifyNameFn(normalizedIncoming.recipientName || '')
    .toLowerCase();
  const cleanSender = options.simplifyNameFn(normalizedIncoming.senderName).toLowerCase();
  const cleanSenderId = (normalizedIncoming.senderId || '').trim().toLowerCase();
  const inTime = normalizedIncoming.createdAtMs;

  const semanticIdx = existingMessages.findIndex((existing) => {
    if (existing.type !== normalizedIncoming.type) return false;
    if (existing.text.trim() !== cleanText) return false;
    const exRecipient = options.simplifyNameFn(existing.recipientName || '').toLowerCase();
    if (exRecipient !== cleanRecipient) return false;

    const exIsSelf = options.isOwnFn(existing);
    if (exIsSelf !== resolvedIsSelf) return false;

    if (!resolvedIsSelf) {
      const exSender = options.simplifyNameFn(existing.senderName).toLowerCase();
      const exSenderId = (existing.senderId || '').trim().toLowerCase();
      const sameSender =
        (cleanSenderId && exSenderId && cleanSenderId === exSenderId) ||
        (cleanSender && exSender && cleanSender === exSender);
      if (!sameSender) return false;
    }

    const oneEphemeralOneCanonical =
      isEphemeralChatId(existing.id) !== isEphemeralChatId(normalizedIncoming.id);
    if (!oneEphemeralOneCanonical) return false;

    if (inTime && existing.createdAtMs) {
      return Math.abs(inTime - existing.createdAtMs) <= dedupWindowMs;
    }
    return true;
  });

  if (semanticIdx >= 0) {
    const prevMsg = existingMessages[semanticIdx];
    const next = [...existingMessages];
    const preferIncomingId = !isEphemeralChatId(normalizedIncoming.id);
    next[semanticIdx] = {
      ...prevMsg,
      ...normalizedIncoming,
      id: preferIncomingId ? normalizedIncoming.id : prevMsg.id,
      clientMsgId: prevMsg.clientMsgId ?? normalizedIncoming.clientMsgId,
      senderId: normalizedIncoming.senderId || prevMsg.senderId,
      bubbleBgColor: prevMsg.bubbleBgColor ?? normalizedIncoming.bubbleBgColor,
      bubbleTextColor: prevMsg.bubbleTextColor ?? normalizedIncoming.bubbleTextColor,
      isSelf: Boolean(prevMsg.isSelf || resolvedIsSelf),
    };
    return {
      nextMessages: next,
      isDuplicate: false,
      upgradedExisting: true,
    };
  }

  return {
    nextMessages: [...existingMessages, normalizedIncoming],
    isDuplicate: false,
    upgradedExisting: false,
  };
}
