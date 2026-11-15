import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeKickScooterRidePose,
  kickScooterStrideLengthM,
} from './buddiesScooterRidePose';

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
