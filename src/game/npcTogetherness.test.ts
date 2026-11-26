import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyNpcClosenessStore,
  recordNpcConversation,
  type NpcClosenessStore,
} from './npcClosenessEngine';
import {
  CITY_LIFE_ANCHOR_IDS,
  CITY_LIFE_ANCHORS,
  CURATED_NPC_PAIR_POSES,
  ELECTRIC_SCOOTER_PASSENGER_SPEC,
  RIDE_PASSENGER_HUG_POSE_SPEC,
  applyScooterPillionHugPose,
  computeScooterPassengerTransform,
  getCityLifeAnchor,
  getTimeSlotWindowForHour,
  isHourInScheduleSlot,
  resolveNpcScheduledWaypoint,
  resolveScooterBrakeOverride,
  shouldAllowFramedDialogueCamera,
  startNpcPairPose,
  startNpcRideTogether,
  startNpcWalkTogether,
  stepNpcWalkTogether,
} from './npcTogetherness';
import type { NpcScheduleSlot } from './npcPersonaRegistry';

function buildStoreWithScore(npcId: 'hana' | 'kai' | 'mira' | 'nadia' | 'tari' | 'bima' | 'kenji', targetScore: number): NpcClosenessStore {
  let store = createEmptyNpcClosenessStore();
  let remaining = targetScore;
  const nowMs = Date.UTC(2026, 10, 26, 12, 0, 0);
  while (remaining > 0) {
    const step = Math.min(12, remaining);
    const res = recordNpcConversation(store, npcId, {
      closenessDelta: step,
      nowMs,
      dateKey: '2026-11-26',
    });
    store = res.store;
    remaining -= step;
  }
  return store;
}

describe('npcTogetherness — deterministic anchors & persona schedules', () => {
  it('exposes verified city anchors with valid coordinates', () => {
    assert.ok(CITY_LIFE_ANCHOR_IDS.length >= 20);
    for (const id of CITY_LIFE_ANCHOR_IDS) {
      const anchor = getCityLifeAnchor(id);
      assert.ok(anchor, `Expected anchor ${id}`);
      assert.equal(anchor.id, id);
      assert.ok(Number.isFinite(anchor.x) && Number.isFinite(anchor.z));
      assert.ok(Number.isFinite(anchor.yaw));
    }
    assert.ok(CITY_LIFE_ANCHORS.glasshouse_cafe_counter);
    assert.ok(CITY_LIFE_ANCHORS.kai_fish_market_pier);
    assert.ok(CITY_LIFE_ANCHORS.nw_lake_shore);
  });

  it('maps 24h world clock hours deterministically to time-slot windows and midnight-wrapping ranges', () => {
    assert.equal(getTimeSlotWindowForHour(8), 'morning');
    assert.equal(getTimeSlotWindowForHour(14), 'afternoon');
    assert.equal(getTimeSlotWindowForHour(19), 'evening');
    assert.equal(getTimeSlotWindowForHour(23), 'night');
    assert.equal(getTimeSlotWindowForHour(2), 'night');

    const nightWrapSlot: NpcScheduleSlot = {
      window: 'night',
      waypointId: 'grand_casino_foyer',
      startHour: 21,
      endHour: 6,
      activityLabel: 'Evening stroll',
    };
    assert.equal(isHourInScheduleSlot(22.5, nightWrapSlot), true);
    assert.equal(isHourInScheduleSlot(3.0, nightWrapSlot), true);
    assert.equal(isHourInScheduleSlot(12.0, nightWrapSlot), false);
  });

  it('resolves persona schedule slots to city anchors and falls back to null when empty', () => {
    assert.equal(resolveNpcScheduledWaypoint('mira', 10, []), null);

    const schedule: NpcScheduleSlot[] = [
      {
        window: 'morning',
        waypointId: 'glasshouse_cafe_terrace',
        startHour: 6,
        endHour: 12,
        activityLabel: 'Morning sketch at Glasshouse',
      },
      {
        window: 'evening',
        waypointId: 'oasis_bench_south',
        startHour: 17,
        endHour: 21,
        activityLabel: 'Sunset sketching by the Oasis',
      },
    ];

    const morningTarget = resolveNpcScheduledWaypoint('mira', 9.5, schedule);
    assert.ok(morningTarget);
    assert.equal(morningTarget.anchor.id, 'glasshouse_cafe_terrace');
    assert.equal(morningTarget.waypoint.x, CITY_LIFE_ANCHORS.glasshouse_cafe_terrace.x);
    assert.equal(morningTarget.waypoint.label, 'Morning sketch at Glasshouse');

    // No afternoon slot -> null (falls back to existing default behavior)
    assert.equal(resolveNpcScheduledWaypoint('mira', 14.0, schedule), null);

    const eveningTarget = resolveNpcScheduledWaypoint('mira', 19.0, schedule);
    assert.ok(eveningTarget);
    assert.equal(eveningTarget.anchor.id, 'oasis_bench_south');
  });
});

describe('npcTogetherness — walk-together, pair poses, and ride-together gating & physics', () => {
  it('gates pair pose at F1 threshold (45), uses true paired clips, and records shared activity', () => {
    const lowStore = buildStoreWithScore('nadia', 40);
    const denied = startNpcPairPose(lowStore, 'nadia');
    assert.equal(denied.allowed, false);
    assert.equal(denied.reason, 'not_unlocked');

    const unlockedStore = buildStoreWithScore('nadia', 50);
    const started = startNpcPairPose(unlockedStore, 'nadia', {
      poseId: CURATED_NPC_PAIR_POSES[1].id,
      dateKey: '2026-11-26',
    });
    assert.equal(started.allowed, true);
    assert.ok(started.session);
    assert.equal(started.session.pose.isTruePairedClip, true);
    assert.equal(started.session.pose.id, CURATED_NPC_PAIR_POSES[1].id);
    assert.ok(started.closenessResult);
    assert.equal(started.closenessResult.appliedDelta, 5);
  });

  it('gates walk-together at F1 threshold (68) and steps smoothly behind player', () => {
    const locked = startNpcWalkTogether(buildStoreWithScore('mira', 60), 'mira');
    assert.equal(locked.allowed, false);
    assert.equal(locked.reason, 'not_unlocked');

    const unlocked = startNpcWalkTogether(buildStoreWithScore('mira', 70), 'mira', {
      dateKey: '2026-11-26',
    });
    assert.equal(unlocked.allowed, true);
    assert.ok(unlocked.closenessResult);
    assert.equal(unlocked.closenessResult.appliedDelta, 6);

    // NPC 6m away should walk toward player
    const walking = stepNpcWalkTogether({
      npcX: 0,
      npcZ: 0,
      npcYaw: 0,
      wasMoving: false,
      playerX: 6,
      playerZ: 0,
      playerYaw: 0,
      playerSpeedMps: 2.0,
      dt: 0.1,
    });
    assert.equal(walking.isMoving, true);
    assert.equal(walking.shouldEndWalk, false);
    assert.ok(walking.x > 0.1);

    // NPC within stop radius pauses smoothly
    const paused = stepNpcWalkTogether({
      npcX: 4.5,
      npcZ: 0,
      npcYaw: 0,
      wasMoving: true,
      playerX: 6,
      playerZ: 0,
      playerYaw: 0,
      playerSpeedMps: 0,
      dt: 0.1,
    });
    assert.equal(paused.isMoving, false);
    assert.equal(paused.speedMps, 0);
    assert.equal(paused.shouldEndWalk, false);

    // Beyond tether auto-ends walk
    const tooFar = stepNpcWalkTogether({
      npcX: 0,
      npcZ: 0,
      npcYaw: 0,
      wasMoving: true,
      playerX: 80,
      playerZ: 0,
      playerYaw: 0,
      playerSpeedMps: 0,
      dt: 0.1,
    });
    assert.equal(tooFar.shouldEndWalk, true);
  });

  it('gates ride-together at F1 threshold (85), requires electric_scooter_bike, and computes pillion transform', () => {
    const locked = startNpcRideTogether(buildStoreWithScore('bima', 80), 'bima', {
      scooterKind: 'electric_scooter_bike',
    });
    assert.equal(locked.allowed, false);
    assert.equal(locked.reason, 'not_unlocked');

    const unlockedStore = buildStoreWithScore('bima', 88);
    const wrongScooter = startNpcRideTogether(unlockedStore, 'bima', {
      scooterKind: 'push_kick_scooter',
    });
    assert.equal(wrongScooter.allowed, false);
    assert.equal(wrongScooter.reason, 'requires_electric_scooter_bike');

    const started = startNpcRideTogether(unlockedStore, 'bima', {
      scooterKind: 'electric_scooter_bike',
      dateKey: '2026-11-26',
    });
    assert.equal(started.allowed, true);
    assert.ok(started.closenessResult);
    assert.equal(started.closenessResult.appliedDelta, 8);

    const tf = computeScooterPassengerTransform({
      driverX: 10,
      driverZ: 20,
      driverYaw: 0, // facing +X
      groundY: 0.5,
      slopePitchX: 0.04,
      leanRollZ: -0.08,
    });
    assert.ok(Math.abs(tf.worldX - (10 + ELECTRIC_SCOOTER_PASSENGER_SPEC.pillionBackOffsetM)) < 1e-6);
    assert.equal(tf.worldZ, 20);
    assert.equal(tf.bodyLiftY, ELECTRIC_SCOOTER_PASSENGER_SPEC.pillionLiftY);
    assert.equal(tf.rollZ, -0.08);
  });

  it('WS24 acceptance (a/b/c): brake overrides throttle to full stop, riding camera stays in chase view, pillion hard-anchored with seated hug pose', () => {
    // (a) Brake always overrides throttle and decelerates to full stop (0 m/s)
    const braked = resolveScooterBrakeOverride({
      rawRideTargetMps: 9.5,
      currentSpeedMps: 8.2,
      isBrakeHeld: true,
      isBikeRide: true,
    });
    assert.equal(braked.rideTargetMps, 0);
    assert.equal(braked.isThrottleActive, false);
    assert.equal(braked.isBraking, true);
    assert.ok((braked.decelRateOverrideMps2 ?? 0) >= 24);

    // (b) Opening Talk during active ride keeps chase camera (never framed dialogue camera)
    assert.equal(shouldAllowFramedDialogueCamera({ isRidingTogether: true, scooterSpeedMps: 0 }), false);
    assert.equal(shouldAllowFramedDialogueCamera({ isRidingTogether: true, scooterSpeedMps: 8.5 }), false);
    assert.equal(shouldAllowFramedDialogueCamera({ isRidingTogether: false, scooterSpeedMps: 0 }), true);

    // (c) Corner lean & slope pitch anchor + dedicated seated hugging pose in local bone space
    assert.equal(RIDE_PASSENGER_HUG_POSE_SPEC.rideSessionOnly, true);
    const cornerTf = computeScooterPassengerTransform({
      driverX: 5,
      driverZ: -12,
      driverYaw: Math.PI / 3,
      groundY: 1.2,
      slopePitchX: 0.09,
      leanRollZ: 0.24,
    });
    assert.equal(cornerTf.yaw, Math.PI / 3);
    assert.equal(cornerTf.pitchX, 0.09);
    assert.equal(cornerTf.rollZ, 0.24);

    const makeBone = () => ({ rotation: { x: 0, y: 0.9, z: 0 } });
    const bones = new Map<string, { rotation: { x: number; y: number; z: number } }>([
      ['Hips', makeBone()],
      ['Spine', makeBone()],
      ['LeftArm', makeBone()],
      ['RightArm', makeBone()],
      ['LeftForeArm', makeBone()],
      ['RightForeArm', makeBone()],
      ['LeftUpLeg', makeBone()],
      ['RightUpLeg', makeBone()],
    ]);
    applyScooterPillionHugPose({ customGlbController: { bones } }, 1.0);
    // Hips locked forward (no independent root rotation); arms reaching forward around driver's waist
    assert.equal(bones.get('Hips')!.rotation.y, 0);
    assert.ok(bones.get('LeftArm')!.rotation.x < -0.5);
    assert.ok(bones.get('RightArm')!.rotation.x < -0.5);
    assert.ok(bones.get('LeftForeArm')!.rotation.y > 0.3);
    assert.ok(bones.get('RightForeArm')!.rotation.y < -0.3);
  });
});
