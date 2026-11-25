import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeKickScooterRidePose,
  computePushKickScooterAccelRate,
  computeScooterRiderRigPose,
  kickScooterStrideLengthM,
} from './buddiesScooterRidePose';
import {
  SCOOTER_HANDLEBAR_SPECS,
  SCOOTER_RIDER_BACK_OFFSET_BY_KIND_M,
  SCOOTER_RIDER_LIFT_BY_KIND_M,
  SCOOTER_RIDE_MODEL_SCALE_BY_KIND,
} from './buddiesUrbanScooterRules';

function closeTo(actual: number, expected: number, epsilon = 1e-6): void {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`,
  );
}

test('stands in a staggered deck stance at rest', () => {
  const pose = computeKickScooterRidePose(0, 0, 1);
  assert.equal(pose.blend, 1);
  closeTo(pose.pushHipX, -0.3, 1e-9);
  closeTo(pose.supportHipX, 0.14, 1e-9);
  assert.equal(pose.dipY, 0);
});

test('respects the mount blend', () => {
  assert.equal(computeKickScooterRidePose(3, 4, 0).blend, 0);
  closeTo(computeKickScooterRidePose(3, 4, 0.5).blend, 0.5, 1e-9);
  assert.equal(computeKickScooterRidePose(3, 4, 2).blend, 1);
});

test('is continuous across the phase wrap', () => {
  const speed = 4;
  const stride = kickScooterStrideLengthM(speed);
  for (const d of [0.3, 1.7, 5.25, 11.9]) {
    const a = computeKickScooterRidePose(d, speed, 1);
    const b = computeKickScooterRidePose(d + stride, speed, 1);
    closeTo(b.pushHipX, a.pushHipX);
    closeTo(b.pushKneeX, a.pushKneeX);
    closeTo(b.dipY, a.dipY);
  }
});

test('sweeps the push leg from ahead of the hip to behind it during contact', () => {
  const speed = 4;
  const stride = kickScooterStrideLengthM(speed);
  const plant = computeKickScooterRidePose(0, speed, 1);
  const toeOff = computeKickScooterRidePose(stride * 0.41, speed, 1);
  assert.ok(plant.pushHipX > 0.2, `plant hip ${plant.pushHipX}`);
  assert.ok(toeOff.pushHipX < -0.9, `toe-off hip ${toeOff.pushHipX}`);
  assert.ok(Math.abs(plant.pushKneeX) > Math.abs(toeOff.pushKneeX));
});

test('dips the body mid-push and folds the leg during recovery', () => {
  const speed = 4;
  const stride = kickScooterStrideLengthM(speed);
  const midPush = computeKickScooterRidePose(stride * 0.21, speed, 1);
  assert.ok(midPush.dipY > 0.09, `mid-push dip ${midPush.dipY}`);
  const midRecovery = computeKickScooterRidePose(stride * 0.71, speed, 1);
  assert.ok(
    Math.abs(midRecovery.pushKneeX) > 0.8,
    `mid-recovery knee ${midRecovery.pushKneeX}`,
  );
});

test('lengthens the stride with speed within bounds', () => {
  closeTo(kickScooterStrideLengthM(0), 2.4, 1e-9);
  closeTo(kickScooterStrideLengthM(4), 3.22, 1e-9);
  closeTo(kickScooterStrideLengthM(20), 4.6, 1e-9);
});

test('electric_scooter_bike rig pose matches 2x saddle, floorboard, and steered handlebar grips', () => {
  const straight = computeScooterRiderRigPose({
    kind: 'electric_scooter_bike',
    distanceM: 0,
    speedMps: 0,
    mountBlend: 1,
    steerAngleRad: 0,
  });
  closeTo(straight.seatLiftY, SCOOTER_RIDER_LIFT_BY_KIND_M.electric_scooter_bike, 1e-6);
  closeTo(straight.seatBackOffsetZ, SCOOTER_RIDER_BACK_OFFSET_BY_KIND_M.electric_scooter_bike, 1e-6);
  assert.ok(straight.torsoPitchRad >= 0 && straight.torsoPitchRad <= 0.28, 'e-bike rider leans forward naturally');

  // Convert bodyGroup-local back into scooter-world coordinates at 1.86x proportional bike scale
  const eScale = SCOOTER_RIDE_MODEL_SCALE_BY_KIND.electric_scooter_bike;
  const worldLeftGripY = straight.leftGripBodyLocal.y + straight.seatLiftY;
  const worldLeftGripZ = straight.leftGripBodyLocal.z + straight.seatBackOffsetZ;
  closeTo(straight.leftGripBodyLocal.x, 0.262 * eScale, 1e-3);
  closeTo(worldLeftGripY, 1.092 * eScale, 1e-3);
  closeTo(worldLeftGripZ, 0.24 * eScale, 1e-3);

  const worldLeftFootY = straight.leftFootSoleBodyLocal.y + straight.seatLiftY;
  const worldLeftFootZ = straight.leftFootSoleBodyLocal.z + straight.seatBackOffsetZ;
  closeTo(worldLeftFootY, 0.246 * eScale, 1e-3);
  assert.ok(worldLeftFootZ > -0.2 && worldLeftFootZ < 0.45, 'feet stay squarely on bike floorboard');

  // Turning left (+steer > 0) pulls left grip back, pushes right grip forward, leans left (<0 roll)
  const leftTurn = computeScooterRiderRigPose({
    kind: 'electric_scooter_bike',
    distanceM: 12,
    speedMps: 7,
    mountBlend: 1,
    steerAngleRad: 0.25,
    spec: {
      modelScale: eScale,
      seatLiftY: SCOOTER_RIDER_LIFT_BY_KIND_M.electric_scooter_bike,
      seatBackOffsetZ: SCOOTER_RIDER_BACK_OFFSET_BY_KIND_M.electric_scooter_bike,
      handlebar: SCOOTER_HANDLEBAR_SPECS.electric_scooter_bike,
    },
  });
  assert.ok(leftTurn.leftGripBodyLocal.z < straight.leftGripBodyLocal.z);
  assert.ok(leftTurn.rightGripBodyLocal.z > straight.rightGripBodyLocal.z);
  assert.ok(leftTurn.leanRollZ < 0 && Math.abs(leftTurn.leanRollZ) <= 0.14);
  assert.ok(leftTurn.headLookYawRad > 0);
});

test('push_kick_scooter rig pose locks left foot on deck and grounds push stroke cleanly', () => {
  const speed = 3.6;
  const stride = kickScooterStrideLengthM(speed);

  const midPush = computeScooterRiderRigPose({
    kind: 'push_kick_scooter',
    distanceM: stride * 0.22,
    speedMps: speed,
    mountBlend: 1,
    steerAngleRad: 0,
    isThrottleActive: true,
    pushActivity: 1,
  });
  assert.equal(midPush.isPushing, true);
  assert.ok(midPush.torsoPitchRad >= 0 && midPush.torsoPitchRad <= 0.18, 'kick scooter pushing stays upright');
  assert.ok(midPush.dipY >= 0.22, 'hips dip deeply enough on deck leg so pushing shoe reaches ground');
  closeTo(midPush.leftFootSoleBodyLocal.y + midPush.seatLiftY, 0.228, 1e-3);
  closeTo(midPush.rightFootSoleBodyLocal.y + midPush.seatLiftY, 0, 1e-3);

  // World T-bar grip Y matches slanted kick stem 2x height (~1.968m)
  closeTo(midPush.leftGripBodyLocal.y + midPush.seatLiftY, 1.968374, 1e-3);

  const midRecovery = computeScooterRiderRigPose({
    kind: 'push_kick_scooter',
    distanceM: stride * 0.72,
    speedMps: speed,
    mountBlend: 1,
    steerAngleRad: 0,
    isThrottleActive: true,
    pushActivity: 1,
  });
  assert.equal(midRecovery.isPushing, false);
  const recoveryFootWorldY = midRecovery.rightFootSoleBodyLocal.y + midRecovery.seatLiftY;
  assert.ok(recoveryFootWorldY > 0.18, 'recovery swing lifts pushing foot clear above asphalt');

  const coast = computeScooterRiderRigPose({
    kind: 'push_kick_scooter',
    distanceM: 10,
    speedMps: 3.0,
    mountBlend: 1,
    isThrottleActive: false,
    pushActivity: 0,
  });
  closeTo(coast.rightFootSoleBodyLocal.y + coast.seatLiftY, 0.228, 1e-3);

  const brake = computeScooterRiderRigPose({
    kind: 'push_kick_scooter',
    distanceM: 10,
    speedMps: 3.0,
    mountBlend: 1,
    isBraking: true,
    pushActivity: 0,
  });
  assert.ok(brake.rightFootSoleBodyLocal.z < -0.3 && brake.rightFootPitchRad < -0.1);

  const highSpeedCruise = computeScooterRiderRigPose({
    kind: 'push_kick_scooter',
    distanceM: stride * 0.22,
    speedMps: 6.5,
    mountBlend: 1,
    isThrottleActive: true,
  });
  assert.equal(highSpeedCruise.isPushing, false);
  closeTo(highSpeedCruise.rightFootSoleBodyLocal.y + highSpeedCruise.seatLiftY, 0.228, 1e-3);
  assert.ok(highSpeedCruise.rightFootSoleBodyLocal.z < -0.2);

  // Medium speed (4.5 m/s) keeps actively pushing instead of cutting off prematurely
  const mediumSpeedPush = computeScooterRiderRigPose({
    kind: 'push_kick_scooter',
    distanceM: stride * 0.22,
    speedMps: 4.5,
    mountBlend: 1,
    isThrottleActive: true,
  });
  assert.equal(mediumSpeedPush.isPushing, true);
});

test('electric_scooter_bike uses straight zero-sweep grip axes matching push_kick_scooter hand alignment', () => {
  const bikeStraight = computeScooterRiderRigPose({
    kind: 'electric_scooter_bike',
    distanceM: 0,
    speedMps: 0,
    mountBlend: 1,
    steerAngleRad: 0,
  });
  const kickStraight = computeScooterRiderRigPose({
    kind: 'push_kick_scooter',
    distanceM: 0,
    speedMps: 0,
    mountBlend: 1,
    steerAngleRad: 0,
  });
  closeTo(bikeStraight.leftGripBarAxisLocal.x, kickStraight.leftGripBarAxisLocal.x, 1e-6);
  closeTo(bikeStraight.leftGripBarAxisLocal.z, kickStraight.leftGripBarAxisLocal.z, 1e-6);
  closeTo(bikeStraight.rightGripBarAxisLocal.x, kickStraight.rightGripBarAxisLocal.x, 1e-6);
  closeTo(bikeStraight.rightGripBarAxisLocal.z, kickStraight.rightGripBarAxisLocal.z, 1e-6);
});

test('push_kick_scooter speed ramps across multiple kick cycles from rest to high-speed deck tuck', () => {
  let speed = 0;
  let distance = 0;
  let isCruisingCoast = false;
  let prevCycle = -1;
  let kickStrokes = 0;
  let elapsedSec = 0;
  const dt = 1 / 60;
  const maxSpeed = 6.5;

  while (elapsedSec < 5.0 && !isCruisingCoast) {
    const accel = computePushKickScooterAccelRate({
      speedMps: speed,
      rideTargetMps: maxSpeed,
      rideMaxSpeedMps: maxSpeed,
      pushDistanceM: distance,
      isCruisingCoast,
      isBoosting: false,
      hasDirectionalInput: true,
    });
    speed = Math.min(maxSpeed, speed + accel * dt);
    distance += speed * dt;
    elapsedSec += dt;

    const stride = kickScooterStrideLengthM(Math.max(1.0, speed));
    const cycleIdx = Math.floor(distance / stride);
    const phase = (((distance % stride) + stride) % stride) / stride;
    if (cycleIdx !== prevCycle && phase >= 0.04 && phase <= 0.38 && speed > 0.35) {
      prevCycle = cycleIdx;
      kickStrokes++;
    }
    if (!isCruisingCoast && speed >= 5.3 && phase >= 0.42) {
      isCruisingCoast = true;
    }
  }

  assert.equal(isCruisingCoast, true, 'rider eventually reaches cruising speed and tucks onto deck');
  assert.ok(elapsedSec >= 2.2 && elapsedSec <= 4.2, `expected multi-second ramp, got ${elapsedSec.toFixed(2)}s`);
  assert.ok(kickStrokes >= 2, `expected multiple visible kick strokes during acceleration, got ${kickStrokes}`);
});
