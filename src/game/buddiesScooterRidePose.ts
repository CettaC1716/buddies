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
import {
  SCOOTER_HANDLEBAR_SPECS,
  SCOOTER_RIDER_BACK_OFFSET_M,
  SCOOTER_RIDER_LIFT_M,
  SCOOTER_RIDE_MODEL_SCALE,
} from './buddiesUrbanScooterRules';

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

export interface ScooterPoseVec3 {
  x: number;
  y: number;
  z: number;
}

export interface ScooterHandlebarSpecInput {
  steeringPivot: ScooterPoseVec3;
  neckOffset: ScooterPoseVec3;
  neckTiltX: number;
  leftGripInNeck: ScooterPoseVec3;
  rightGripInNeck: ScooterPoseVec3;
}

export interface ScooterRiderSpecInput {
  modelScale: number;
  seatLiftY: number;
  seatBackOffsetZ: number;
  handlebar: ScooterHandlebarSpecInput;
}

export interface ComputeScooterRiderPoseParams {
  kind: 'electric_scooter_bike' | 'push_kick_scooter';
  distanceM: number;
  speedMps: number;
  mountBlend: number;
  steerAngleRad?: number;
  isThrottleActive?: boolean;
  isBraking?: boolean;
  pushActivity?: number;
  spec?: ScooterRiderSpecInput;
}

export interface ScooterRiderRigPose {
  kind: 'electric_scooter_bike' | 'push_kick_scooter';
  blend: number;
  seatLiftY: number;
  seatBackOffsetZ: number;
  leanRollZ: number;
  steerAngleRad: number;
  torsoPitchRad: number;
  torsoYawRad: number;
  headLookYawRad: number;
  leftGripBodyLocal: ScooterPoseVec3;
  rightGripBodyLocal: ScooterPoseVec3;
  leftGripBarAxisLocal: ScooterPoseVec3;
  rightGripBarAxisLocal: ScooterPoseVec3;
  leftFootSoleBodyLocal: ScooterPoseVec3;
  rightFootSoleBodyLocal: ScooterPoseVec3;
  leftFootPitchRad: number;
  rightFootPitchRad: number;
  leftFootYawRad: number;
  rightFootYawRad: number;
  fingerGripCurl: number;
  pushPhase: number;
  dipY: number;
  supportHipX: number;
  supportKneeX: number;
  pushHipX: number;
  pushKneeX: number;
  pushFootX: number;
  leftArmPitchX: number;
  rightArmPitchX: number;
  isPushing: boolean;
}

const DEFAULT_SCOOTER_SPECS: Record<
  'electric_scooter_bike' | 'push_kick_scooter',
  ScooterRiderSpecInput
> = {
  electric_scooter_bike: {
    modelScale: SCOOTER_RIDE_MODEL_SCALE,
    seatLiftY: SCOOTER_RIDER_LIFT_M.electric_scooter_bike,
    seatBackOffsetZ: SCOOTER_RIDER_BACK_OFFSET_M.electric_scooter_bike,
    handlebar: SCOOTER_HANDLEBAR_SPECS.electric_scooter_bike,
  },
  push_kick_scooter: {
    modelScale: SCOOTER_RIDE_MODEL_SCALE,
    seatLiftY: SCOOTER_RIDER_LIFT_M.push_kick_scooter,
    seatBackOffsetZ: SCOOTER_RIDER_BACK_OFFSET_M.push_kick_scooter,
    handlebar: SCOOTER_HANDLEBAR_SPECS.push_kick_scooter,
  },
};

function clampNumber(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: ScooterPoseVec3, b: ScooterPoseVec3, t: number): ScooterPoseVec3 {
  return {
    x: lerpNumber(a.x, b.x, t),
    y: lerpNumber(a.y, b.y, t),
    z: lerpNumber(a.z, b.z, t),
  };
}

function computeSteeredGripInScooterRoot(
  spec: ScooterRiderSpecInput,
  gripInNeck: ScooterPoseVec3,
  steerAngleRad: number,
): ScooterPoseVec3 {
  const hb = spec.handlebar;
  // 1) Tilt neck around +X by neckTiltX
  const cosTilt = Math.cos(hb.neckTiltX);
  const sinTilt = Math.sin(hb.neckTiltX);
  const nx = gripInNeck.x + hb.neckOffset.x;
  const ny = gripInNeck.y * cosTilt - gripInNeck.z * sinTilt + hb.neckOffset.y;
  const nz = gripInNeck.y * sinTilt + gripInNeck.z * cosTilt + hb.neckOffset.z;
  // 2) Yaw steering column around +Y by steerAngleRad
  const cosSteer = Math.cos(steerAngleRad);
  const sinSteer = Math.sin(steerAngleRad);
  const rx = nx * cosSteer + nz * sinSteer + hb.steeringPivot.x;
  const ry = ny + hb.steeringPivot.y;
  const rz = -nx * sinSteer + nz * cosSteer + hb.steeringPivot.z;
  return {
    x: rx * spec.modelScale,
    y: ry * spec.modelScale,
    z: rz * spec.modelScale,
  };
}

/**
 * Unifies skeletal IK + lean + steering pose for both `electric_scooter_bike`
 * and `push_kick_scooter` across Female/Male Mixamo rigs and pivot fallbacks.
 */
export function computeScooterRiderRigPose(
  params: ComputeScooterRiderPoseParams,
): ScooterRiderRigPose {
  const { kind, distanceM, speedMps, mountBlend } = params;
  const blend = clampNumber(mountBlend, 0, 1);
  const absSpeed = Math.abs(speedMps);
  const steerAngleRad = clampNumber(params.steerAngleRad ?? 0, -0.45, 0.45);
  const spec = params.spec ?? DEFAULT_SCOOTER_SPECS[kind];

  const cosS = Math.cos(steerAngleRad);
  const sinS = Math.sin(steerAngleRad);
  // +steer turns front wheel LEFT (+X), so left grip (+X bar outward) sweeps back (-Z)
  const leftGripBarAxisLocal: ScooterPoseVec3 = { x: cosS, y: 0, z: -sinS };
  const rightGripBarAxisLocal: ScooterPoseVec3 = { x: -cosS, y: 0, z: sinS };

  const leftGripScooter = computeSteeredGripInScooterRoot(
    spec,
    spec.handlebar.leftGripInNeck,
    steerAngleRad,
  );
  const rightGripScooter = computeSteeredGripInScooterRoot(
    spec,
    spec.handlebar.rightGripInNeck,
    steerAngleRad,
  );

  if (kind === 'electric_scooter_bike') {
    const seatLiftY = spec.seatLiftY;
    const seatBackOffsetZ = spec.seatBackOffsetZ;
    const leanFactor = 0.24 + 0.14 * clampNumber(absSpeed / 9.0, 0, 1);
    const leanRollZ = clampNumber(-steerAngleRad * leanFactor, -0.13, 0.13) * blend;
    const torsoPitchRad = 0.16 + 0.04 * clampNumber(absSpeed / 10.0, 0, 1);
    const floorboardY = 0.49;

    return {
      kind,
      blend,
      seatLiftY,
      seatBackOffsetZ,
      leanRollZ,
      steerAngleRad,
      torsoPitchRad,
      torsoYawRad: steerAngleRad * 0.48,
      headLookYawRad: steerAngleRad * 0.65,
      leftGripBodyLocal: {
        x: leftGripScooter.x,
        y: leftGripScooter.y - seatLiftY,
        z: leftGripScooter.z - seatBackOffsetZ,
      },
      rightGripBodyLocal: {
        x: rightGripScooter.x,
        y: rightGripScooter.y - seatLiftY,
        z: rightGripScooter.z - seatBackOffsetZ,
      },
      leftGripBarAxisLocal,
      rightGripBarAxisLocal,
      leftFootSoleBodyLocal: {
        x: 0.24,
        y: floorboardY - seatLiftY,
        z: 0.16 - seatBackOffsetZ,
      },
      rightFootSoleBodyLocal: {
        x: -0.24,
        y: floorboardY - seatLiftY,
        z: 0.16 - seatBackOffsetZ,
      },
      leftFootPitchRad: 0,
      rightFootPitchRad: 0,
      leftFootYawRad: 0.08,
      rightFootYawRad: -0.08,
      fingerGripCurl: 0.92,
      pushPhase: 0,
      dipY: 0,
      supportHipX: -1.18,
      supportKneeX: 1.24,
      pushHipX: -1.18,
      pushKneeX: 1.24,
      pushFootX: 0,
      leftArmPitchX: -0.96 - steerAngleRad * 0.25,
      rightArmPitchX: -0.96 + steerAngleRad * 0.25,
      isPushing: false,
    };
  }

  // Push kick scooter: seamless blend between stopped-ready / coast-tuck / brake / active push cycle
  const stride = kickScooterStrideLengthM(Math.max(1.0, absSpeed));
  const rawPhase = ((distanceM % stride) + stride) % stride;
  const pushPhase = rawPhase / stride;

  const isBraking = Boolean(params.isBraking && absSpeed > 0.35);
  const defaultPushActivity =
    isBraking || absSpeed < 0.22
      ? 0
      : params.isThrottleActive === false && absSpeed > 0.35
        ? 0
        : clampNumber((absSpeed - 0.18) / 0.65, 0, 1);
  const pushActivity =
    params.pushActivity !== undefined ? clampNumber(params.pushActivity, 0, 1) : defaultPushActivity;

  const deckTopY = 0.228;
  const seatBackOffsetZ = spec.seatBackOffsetZ;

  // Base non-push pose (standing ready with right foot on ground if slow, tucked on rear deck if coasting, or rear-fender brake)
  const coastBlend = isBraking ? 0 : clampNumber((absSpeed - 0.25) / 0.55, 0, 1);
  let idleDipY = lerpNumber(0.22, 0.10, coastBlend);
  let idleRightSole: ScooterPoseVec3 = lerpVec3(
    { x: -0.27, y: 0.0, z: -0.04 },
    { x: -0.04, y: deckTopY, z: -0.24 },
    coastBlend,
  );
  let idleRightPitch = 0;
  if (isBraking) {
    idleDipY = 0.14;
    idleRightSole = { x: -0.008, y: 0.255, z: -0.35 };
    idleRightPitch = -0.24;
  }

  // Active biomechanical push cycle
  let pushDipY = 0.14;
  let pushRightZ = 0;
  let pushRightY = 0;
  let pushRightPitch = 0;
  let legHipX = 0;
  let legKneeX = 0.22;
  const isPushing = pushActivity > 0.05 && pushPhase < 0.44;

  if (pushPhase < 0.44) {
    const t = pushPhase / 0.44;
    // Knee dips down on support leg so push shoe sole sweeps squarely across ground y=0
    pushDipY = 0.16 + 0.14 * Math.sin(Math.PI * clampNumber(t * 0.9 + 0.08, 0, 1));
    pushRightZ = lerpNumber(0.22, -0.42, t);
    pushRightY = 0.0;
    // Heel-strike -> flat plant -> athletic ball/toe push-off
    if (t < 0.22) {
      pushRightPitch = lerpNumber(0.15, 0, t / 0.22);
    } else if (t < 0.62) {
      pushRightPitch = 0;
    } else {
      pushRightPitch = lerpNumber(0, -0.42, (t - 0.62) / 0.38);
    }
    legHipX = lerpNumber(-0.34, 0.42, t);
    legKneeX = lerpNumber(0.24, 0.14, t);
  } else {
    const r = (pushPhase - 0.44) / 0.56;
    const arc = Math.sin(Math.PI * r);
    const swing = 0.5 - 0.5 * Math.cos(Math.PI * r);
    pushDipY = 0.17 - 0.06 * arc;
    pushRightZ = lerpNumber(-0.42, 0.22, swing);
    pushRightY = 0.26 * arc;
    if (r < 0.5) {
      pushRightPitch = lerpNumber(-0.42, -0.06, r / 0.5);
    } else {
      pushRightPitch = lerpNumber(-0.06, 0.15, (r - 0.5) / 0.5);
    }
    legHipX = lerpNumber(0.42, -0.34, swing);
    legKneeX = 0.22 + 0.68 * arc;
  }

  const dipY = lerpNumber(idleDipY, pushDipY, pushActivity);
  const seatLiftY = spec.seatLiftY - dipY;
  const leanFactor = (0.18 + 0.12 * clampNumber(absSpeed / 6.0, 0, 1)) * (1 - 0.35 * (isPushing ? pushActivity : 0));
  const leanRollZ = clampNumber(-steerAngleRad * leanFactor, -0.10, 0.10) * blend;
  const torsoPitchRad = lerpNumber(0.06, 0.12, pushActivity) + (isPushing ? 0.03 : 0);

  const leftSoleScooter: ScooterPoseVec3 = { x: 0.032, y: deckTopY, z: 0.09 };
  const rightSoleScooter: ScooterPoseVec3 = lerpVec3(
    idleRightSole,
    { x: -0.27, y: pushRightY, z: pushRightZ },
    pushActivity,
  );
  const rightFootPitchRad = lerpNumber(idleRightPitch, pushRightPitch, pushActivity);

  // Convert ground-anchored foot coordinate when pushing near asphalt into rolled bodyGroup space
  const cosR = Math.cos(leanRollZ);
  const sinR = Math.sin(leanRollZ);
  const rightGroundedWeight = pushActivity * (pushPhase < 0.44 ? 1 : 0);
  let rightSoleX = rightSoleScooter.x;
  let rightSoleY = rightSoleScooter.y;
  if (rightGroundedWeight > 0.01) {
    // Undo lean roll around scooter ground y=0 so the pushing sneaker sole stays flat on road y=0
    const unleanedX = rightSoleScooter.x * cosR + rightSoleScooter.y * sinR;
    const unleanedY = -rightSoleScooter.x * sinR + rightSoleScooter.y * cosR;
    rightSoleX = lerpNumber(rightSoleScooter.x, unleanedX, rightGroundedWeight);
    rightSoleY = lerpNumber(rightSoleScooter.y, unleanedY, rightGroundedWeight);
  }

  return {
    kind,
    blend,
    seatLiftY,
    seatBackOffsetZ,
    leanRollZ,
    steerAngleRad,
    torsoPitchRad,
    torsoYawRad: steerAngleRad * 0.45,
    headLookYawRad: steerAngleRad * 0.60,
    leftGripBodyLocal: {
      x: leftGripScooter.x,
      y: leftGripScooter.y - seatLiftY,
      z: leftGripScooter.z - seatBackOffsetZ,
    },
    rightGripBodyLocal: {
      x: rightGripScooter.x,
      y: rightGripScooter.y - seatLiftY,
      z: rightGripScooter.z - seatBackOffsetZ,
    },
    leftGripBarAxisLocal,
    rightGripBarAxisLocal,
    leftFootSoleBodyLocal: {
      x: leftSoleScooter.x,
      y: leftSoleScooter.y - seatLiftY,
      z: leftSoleScooter.z - seatBackOffsetZ,
    },
    rightFootSoleBodyLocal: {
      x: rightSoleX,
      y: rightSoleY - seatLiftY,
      z: rightSoleScooter.z - seatBackOffsetZ,
    },
    leftFootPitchRad: 0,
    rightFootPitchRad,
    leftFootYawRad: 0.14,
    rightFootYawRad: lerpNumber(-0.08, -0.04, pushActivity),
    fingerGripCurl: 0.90,
    pushPhase,
    dipY,
    supportHipX: lerpNumber(-0.24, -0.34, pushActivity),
    supportKneeX: lerpNumber(0.32, 0.56, pushActivity),
    pushHipX: lerpNumber(0.08, legHipX, pushActivity),
    pushKneeX: lerpNumber(0.24, legKneeX, pushActivity),
    pushFootX: rightFootPitchRad,
    leftArmPitchX: -0.92 - steerAngleRad * 0.25,
    rightArmPitchX: -0.92 + steerAngleRad * 0.25,
    isPushing,
  };
}
