/**
 * Pure, deterministic performance-scheduling rules for Buddies Blitz 3D rendering:
 * - Texel-locked, throttled DirectionalLight shadow map refresh policy
 * - Hysteresis-guarded adaptive DPR scaling across both landing tour & gameplay
 * - Dirty-checked night-window lighting refresh cadence (zero daytime GPU buffer uploads)
 */

export interface ShadowRefreshInput {
  finalLookX: number;
  finalLookZ: number;
  shadowLightRight: { x: number; y: number; z: number };
  shadowLightUp: { x: number; y: number; z: number };
  shadowLightBack: { x: number; y: number; z: number };
  shadowTexelWorldSize: number;
  prevSnappedShadowX: number;
  prevSnappedShadowZ: number;
  frameTickCount: number;
  lastShadowUpdateFrame: number;
  maxStationaryIntervalFrames: number;
  smoothedFrameMs: number;
}

export interface ShadowRefreshDecision {
  shouldUpdate: boolean;
  snappedLookX: number;
  snappedLookY: number;
  snappedLookZ: number;
}

/**
 * Computes a light-space texel-locked shadow anchor (aligned to an exact integer
 * multiple of `shadowTexelWorldSize` so stationary shadows never swim/shimmer)
 * and throttles shadow-map depth passes while moving so the 2048x2048 shadow map
 * isn't re-rendered every single frame during casual walking.
 */
export function evaluateShadowMapRefreshDecision(
  input: ShadowRefreshInput,
): ShadowRefreshDecision {
  // Exact integer multiple of shadowTexelWorldSize preserves rock-solid texel locking
  // while avoiding shadow re-renders on tiny 3.5cm micro-steps.
  const snapTexelStride = 6;
  const snapStep = Math.max(1e-4, input.shadowTexelWorldSize * snapTexelStride);

  const projU =
    input.finalLookX * input.shadowLightRight.x + input.finalLookZ * input.shadowLightRight.z;
  const projV =
    input.finalLookX * input.shadowLightUp.x + input.finalLookZ * input.shadowLightUp.z;
  const projW =
    input.finalLookX * input.shadowLightBack.x + input.finalLookZ * input.shadowLightBack.z;

  const snapU = Math.round(projU / snapStep) * snapStep;
  const snapV = Math.round(projV / snapStep) * snapStep;
  const snapW = Math.round(projW / snapStep) * snapStep;

  const snappedLookX =
    input.shadowLightRight.x * snapU +
    input.shadowLightUp.x * snapV +
    input.shadowLightBack.x * snapW;
  const snappedLookY =
    input.shadowLightRight.y * snapU +
    input.shadowLightUp.y * snapV +
    input.shadowLightBack.y * snapW;
  const snappedLookZ =
    input.shadowLightRight.z * snapU +
    input.shadowLightUp.z * snapV +
    input.shadowLightBack.z * snapW;

  const isFirstInit =
    !Number.isFinite(input.prevSnappedShadowX) ||
    !Number.isFinite(input.prevSnappedShadowZ) ||
    input.frameTickCount <= 2;

  if (isFirstInit) {
    return { shouldUpdate: true, snappedLookX, snappedLookY, snappedLookZ };
  }

  const dx = snappedLookX - input.prevSnappedShadowX;
  const dz = snappedLookZ - input.prevSnappedShadowZ;
  const distSq = dx * dx + dz * dz;
  const shadowMoved = distSq > 1e-6;
  const framesSinceLast = input.frameTickCount - input.lastShadowUpdateFrame;

  // Immediate refresh on large camera jumps / teleports (> 3.0m)
  if (distSq >= 9.0) {
    return { shouldUpdate: true, snappedLookX, snappedLookY, snappedLookZ };
  }

  // Adaptive movement cadence: 30Hz (every 2 frames) when fast, 15-20Hz (every 3-4 frames) under GPU load
  const moveMinIntervalFrames =
    input.smoothedFrameMs > 26 ? 4 : input.smoothedFrameMs > 19 ? 3 : 2;

  if (shadowMoved && framesSinceLast >= moveMinIntervalFrames) {
    return { shouldUpdate: true, snappedLookX, snappedLookY, snappedLookZ };
  }

  if (framesSinceLast >= Math.max(1, input.maxStationaryIntervalFrames)) {
    return { shouldUpdate: true, snappedLookX, snappedLookY, snappedLookZ };
  }

  return { shouldUpdate: false, snappedLookX, snappedLookY, snappedLookZ };
}

export interface AdaptiveDprInput {
  smoothedFrameMs: number;
  currentDpr: number;
  capDpr: number;
  cooldownFrames: number;
}

export interface AdaptiveDprResult {
  nextDpr: number;
  changed: boolean;
  nextCooldownFrames: number;
}

const ADAPTIVE_DPR_LADDER = [1.0, 1.12, 1.25];

/**
 * Smooth hysteresis-based DPR controller that keeps crisp native resolution (>= 1.0,
 * never downscaling into blurry/pixelated sub-1.0 buffers) while gracefully stepping
 * between 1.25 -> 1.12 -> 1.0 on HiDPI screens under sustained frame drops (> 21.5ms).
 */
export function computeAdaptiveDprTarget(input: AdaptiveDprInput): AdaptiveDprResult {
  if (input.cooldownFrames > 0) {
    return {
      nextDpr: input.currentDpr,
      changed: false,
      nextCooldownFrames: input.cooldownFrames - 1,
    };
  }

  const clampedCap = Math.max(1.0, Math.min(1.25, input.capDpr));
  const steps = ADAPTIVE_DPR_LADDER.filter((s) => s < clampedCap - 0.015);
  steps.push(clampedCap);

  // Find nearest step index
  let curIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < steps.length; i++) {
    const d = Math.abs(steps[i] - input.currentDpr);
    if (d < bestDist) {
      bestDist = d;
      curIdx = i;
    }
  }

  if (input.smoothedFrameMs > 21.5 && curIdx > 0) {
    const nextDpr = steps[curIdx - 1];
    return {
      nextDpr,
      changed: Math.abs(nextDpr - input.currentDpr) > 0.02,
      nextCooldownFrames: 45,
    };
  }

  if (input.smoothedFrameMs < 14.5 && curIdx < steps.length - 1) {
    const nextDpr = steps[curIdx + 1];
    return {
      nextDpr,
      changed: Math.abs(nextDpr - input.currentDpr) > 0.02,
      nextCooldownFrames: 90,
    };
  }

  return {
    nextDpr: input.currentDpr,
    changed: false,
    nextCooldownFrames: 0,
  };
}

export type AvatarOutlineProfileKind =
  | 'head'
  | 'skin'
  | 'cloth'
  | 'hair_cutout'
  | 'baked_skin'
  | 'baked_cloth';

export interface AvatarOutlineScreenSpaceProfile {
  /** Target stroke width in CSS pixels when the camera is close (~4m). */
  closePx: number;
  /** Target stroke width in CSS pixels at standard third-person gameplay distance (~14-20m). */
  midPx: number;
  /** Minimum multiplier at far distances (> 56m) so distant NPCs never blob into solid black. */
  farFadeScale: number;
  /** Subtle positive clip-space Z push (* w) preventing back-face z-fighting speckles through front meshes. */
  depthBias: number;
  /** Harmonious anime ink color hex (softer warm umber on skin, cool charcoal-slate on clothing). */
  inkHex: string;
}

const AVATAR_OUTLINE_PROFILES: Record<AvatarOutlineProfileKind, AvatarOutlineScreenSpaceProfile> = {
  head: {
    closePx: 0.78,
    midPx: 0.78,
    farFadeScale: 0.50,
    depthBias: 0.000038,
    inkHex: '#3f3034',
  },
  skin: {
    closePx: 0.78,
    midPx: 0.78,
    farFadeScale: 0.50,
    depthBias: 0.000038,
    inkHex: '#473638',
  },
  cloth: {
    closePx: 0.95,
    midPx: 0.88,
    farFadeScale: 0.52,
    depthBias: 0.000032,
    inkHex: '#252330',
  },
  hair_cutout: {
    closePx: 0.88,
    midPx: 0.82,
    farFadeScale: 0.50,
    depthBias: 0.000035,
    inkHex: '#1f1b24',
  },
  baked_skin: {
    closePx: 0.25,
    midPx: 0.32,
    farFadeScale: 0.40,
    depthBias: 0.000025,
    inkHex: '#3f3134',
  },
  baked_cloth: {
    closePx: 0.32,
    midPx: 0.38,
    farFadeScale: 0.44,
    depthBias: 0.000025,
    inkHex: '#23202c',
  },
};

export function getAvatarOutlineScreenSpaceProfile(
  kind: AvatarOutlineProfileKind,
): AvatarOutlineScreenSpaceProfile {
  return AVATAR_OUTLINE_PROFILES[kind];
}

function smoothstep01(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Mirrors the exact GLSL clip-space thin anime outline pixel width curve so unit tests
 * can verify >= 1.0px stroke continuity at third-person distances and graceful far-distance fade.
 */
export function evaluateAvatarOutlinePixelWidth(
  profile: AvatarOutlineScreenSpaceProfile,
  cameraDistanceW: number,
): number {
  const dist = Math.max(0.5, cameraDistanceW);
  const tMid = smoothstep01(4.0, 18.0, dist);
  const basePx = profile.closePx + (profile.midPx - profile.closePx) * tMid;
  const tFar = smoothstep01(26.0, 56.0, dist);
  const farScale = 1.0 + (profile.farFadeScale - 1.0) * tFar;
  return basePx * farScale;
}

export interface NightLightingThrottleInput {
  isDay: boolean;
  nightFactor: number;
  elapsedSec: number;
  hasAppliedInitial: boolean;
  prevWasDay: boolean;
  prevNightFactor: number;
  prevElapsedSec: number;
  registryGrew: boolean;
}

/**
 * Returns true only when window lighting materials/GPU instance buffers actually need
 * updating:
 * - Always updates on initial frame or when new window buildings were discovered
 * - Skips redundant daytime frames in O(1) once daytime state has been applied
 * - Smoothly updates dusk/night glow at ~15Hz (or immediately on noticeable nightFactor shifts)
 */
export function shouldRefreshNightLightingFrame(input: NightLightingThrottleInput): boolean {
  if (!input.hasAppliedInitial || input.registryGrew) {
    return true;
  }
  if (input.isDay) {
    return !input.prevWasDay;
  }
  if (input.prevWasDay) {
    return true;
  }
  if (Math.abs(input.nightFactor - input.prevNightFactor) >= 0.004) {
    return true;
  }
  if (Math.abs(input.elapsedSec - input.prevElapsedSec) >= 0.065) {
    return true;
  }
  return false;
}
