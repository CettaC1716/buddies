/**
 * Procedural push-cycle pose for kick scooter riders.
 *
 * The Mixamo clip library has no scooter animation, so the riding pose is
 * computed per frame: the left leg stays on the deck as the support leg
 * while the right leg runs a push cycle against the ground — plant ahead,
 * push through to a toe-off behind, then swing back forward. The cycle
 * phase is driven by travelled distance (not wall time), so the planted
 * foot tracks the ground without skating, and the stride lengthens with
 * speed the way a real rider's does.
 *
 * Angles are Euler X deltas in the GLB bone convention used by the rig
 * overrides in buddiesBlitzShadersAndAssets (+X swings a leg forward,
 * negative X on the shin/foot is flexion). The Arena's pivot rig uses the
 * opposite sign and negates when applying.
 */

export interface KickScooterRidePose {
  /** Overall override strength 0..1 (mount fade). */
  blend: number;
  supportHipX: number;
  supportKneeX: number;
  pushHipX: number;
  pushKneeX: number;
  pushFootX: number;
  /** Body dip in world units (>= 0 while pushing, slightly negative in recovery); subtracted from the rider lift. */
  dipY: number;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

function smoothstep(a: number, b: number, v: number): number {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}

/** World units travelled per full push cycle; grows with speed. */
export function kickScooterStrideLengthM(speedMps: number): number {
  return Math.max(2.4, Math.min(4.6, 1.7 + speedMps * 0.38));
}

const CONTACT_FRACTION = 0.42;

export function computeKickScooterRidePose(
  distanceM: number,
  speedMps: number,
  mountBlend: number,
): KickScooterRidePose {
  const activity = smoothstep(0.6, 2.2, speedMps);
  const stride = kickScooterStrideLengthM(speedMps);
  const phase = (((distanceM / stride) % 1) + 1) % 1;

  let cycleHip: number;
  let cycleKnee: number;
  let cycleFoot: number;
  let cycleDip: number;
  if (phase < CONTACT_FRACTION) {
    // Foot planted: leg sweeps from slightly ahead of the hip to a
    // straightened toe-off behind it while the body presses down.
    const u = phase / CONTACT_FRACTION;
    cycleHip = lerp(0.3, -1.02, easeInOut(u));
    cycleKnee = lerp(-0.38, -0.06, u);
    cycleFoot = lerp(0.05, -0.5, u);
    cycleDip = Math.sin(u * Math.PI) * 0.1;
  } else {
    // Recovery: leg folds, lifts, and swings back ahead of the hip.
    const v = (phase - CONTACT_FRACTION) / (1 - CONTACT_FRACTION);
    cycleHip = lerp(-1.02, 0.3, easeInOut(v));
    cycleKnee = -(0.06 + Math.sin(v * Math.PI) * 0.85);
    cycleFoot = lerp(-0.5, 0.05, v);
    cycleDip = -Math.sin(v * Math.PI) * 0.03;
  }

  // Standing stance (no push): staggered feet on the deck, pusher behind.
  const pushHipX = lerp(-0.3, cycleHip, activity);
  const pushKneeX = lerp(-0.2, cycleKnee, activity);
  const pushFootX = lerp(0, cycleFoot, activity);
  const dipY = cycleDip * activity;

  return {
    blend: clamp01(mountBlend),
    supportHipX: 0.14,
    supportKneeX: -(0.16 + Math.max(0, dipY) * 1.1),
    pushHipX,
    pushKneeX,
    pushFootX,
    dipY,
  };
}
