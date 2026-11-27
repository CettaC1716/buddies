import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NAMED_NPC_IDS,
  createEmptyNpcClosenessStore,
  type NpcClosenessStore,
} from './npcClosenessEngine';
import {
  QA_CLOSENESS_PRESETS,
  applyQaClosenessPreset,
  applyQaShopBillboardPreset,
  applyQaShopLotStateMutation,
  applyQaShopPlaceBuilding,
  buildQaNpcClosenessDiagnostic,
  cloneLotRentalStore,
  cloneNpcClosenessStore,
  computeQaLotTeleportPose,
  createInitialQaDirectorState,
  evaluateQaShopLotDiagnostic,
  generateQaBillboardTestDataUrl,
  isQaDirectorAvailable,
  resolveQaEffectiveIds,
  simulateQaAbsenceDecay,
} from './qaDirectorMode';
import {
  CITY_RENTAL_LOTS,
  SHOP_BUILDING_FORM_IDS,
} from './buddiesCityRentalLotsRules';
import { createEmptyLotRentalStore } from './shopRentalEngine';
import {
  AMBIENT_NPC_CAPSULE_RADIUS,
  computeLocalPedestrianAvoidance2D,
} from './buddiesCharacterCollisionRules';
import {
  CITY_AMBIENT_NPC_PRESETS,
  stepCityAmbientNpcSchedule,
  type CityAmbientNpcPreset,
} from './buddiesBlitzRules';

test('QA Director availability flag respects explicit override and initial state matches dev gate', () => {
  assert.equal(isQaDirectorAvailable(true), true);
  assert.equal(isQaDirectorAvailable(false), false);

  const devState = createInitialQaDirectorState(true);
  assert.equal(devState.enabled, true);
  assert.equal(devState.drawerOpen, false);
  assert.equal(devState.previewApparelAndPoses, true);
  assert.equal(devState.previewVehicles, true);
  assert.equal(devState.previewMerchantAndShops, true);
  assert.equal(devState.previewCafeGifts, true);
  assert.equal(devState.qaBonusLul, 0);
  assert.equal(devState.previewAllShopBuildings, false);
  assert.equal(devState.debugShopBounds3D, false);

  const prodState = createInitialQaDirectorState(false);
  assert.equal(prodState.enabled, false);
  assert.equal(prodState.previewApparelAndPoses, false);
  assert.equal(prodState.previewVehicles, false);
  assert.equal(prodState.previewMerchantAndShops, false);
  assert.equal(prodState.previewCafeGifts, false);
  assert.equal(prodState.previewAllShopBuildings, false);
  assert.equal(prodState.debugShopBounds3D, false);
});

test('resolveQaEffectiveIds is strictly non-destructive and cleanly toggles virtual unlocks', () => {
  const realOwned = ['item_a', 'item_b'];
  const allCatalog = ['item_b', 'item_c', 'item_d'];

  const whenOff = resolveQaEffectiveIds(realOwned, allCatalog, false);
  assert.deepEqual(whenOff, ['item_a', 'item_b']);
  assert.notEqual(whenOff, realOwned);

  const whenOn = resolveQaEffectiveIds(realOwned, allCatalog, true);
  assert.deepEqual(whenOn, ['item_a', 'item_b', 'item_c', 'item_d']);

  // Original real owned list must never be mutated
  assert.deepEqual(realOwned, ['item_a', 'item_b']);
});

test('applyQaClosenessPreset & cloneNpcClosenessStore preserve real save snapshots and unlock tiers', () => {
  const realStore: NpcClosenessStore = createEmptyNpcClosenessStore();
  realStore.records.mira.score = 12;
  realStore.records.mira.peakScore = 12;
  realStore.records.mira.lastGiftDateKey = '2026-04-01';
  realStore.records.mira.lastActivityDateByKind.walk_together = '2026-04-01';

  const snapshot = cloneNpcClosenessStore(realStore);
  const jumped = applyQaClosenessPreset(realStore, 'mira', 92, {
    nowMs: 1_700_000_000_000,
    clearDailyLocks: true,
  });

  // Real store & snapshot untouched
  assert.equal(realStore.records.mira.score, 12);
  assert.equal(snapshot.records.mira.score, 12);
  assert.equal(snapshot.records.mira.lastGiftDateKey, '2026-04-01');

  // Jumped store reflects trusted tier & cleared daily locks
  const diag = buildQaNpcClosenessDiagnostic(jumped, 'mira', 1_700_000_000_000);
  assert.equal(diag.score, 92);
  assert.equal(diag.band, 'trusted');
  assert.equal(diag.lastGiftDateKey, null);
  assert.deepEqual(diag.unlocks, [
    'long_conversation',
    'pair_pose',
    'walk_together',
    'ride_together',
  ]);

  // All presets map to their declared closeness band
  for (const preset of QA_CLOSENESS_PRESETS) {
    const presetStore = applyQaClosenessPreset(realStore, 'hana', preset.score, {
      nowMs: 1_700_000_000_000,
    });
    const presetDiag = buildQaNpcClosenessDiagnostic(presetStore, 'hana', 1_700_000_000_000);
    assert.equal(presetDiag.band, preset.id);
  }

  // Batch jump ('all') applies to all 7 named NPCs
  const allFriendly = applyQaClosenessPreset(realStore, 'all', 48, {
    nowMs: 1_700_000_000_000,
  });
  for (const npcId of NAMED_NPC_IDS) {
    assert.equal(buildQaNpcClosenessDiagnostic(allFriendly, npcId, 1_700_000_000_000).band, 'friendly');
  }
});

test('simulateQaAbsenceDecay verifies 3-day grace window, -1pt/day decay, and safe floor of 10', () => {
  const nowMs = 1_700_000_000_000;
  const base = applyQaClosenessPreset(createEmptyNpcClosenessStore(), 'kai', 50, { nowMs });

  const after3d = simulateQaAbsenceDecay(base, 'kai', 3, nowMs);
  assert.equal(buildQaNpcClosenessDiagnostic(after3d, 'kai', nowMs).score, 50);

  const after4d = simulateQaAbsenceDecay(base, 'kai', 4, nowMs);
  assert.equal(buildQaNpcClosenessDiagnostic(after4d, 'kai', nowMs).score, 49);

  const after10d = simulateQaAbsenceDecay(base, 'kai', 10, nowMs);
  assert.equal(buildQaNpcClosenessDiagnostic(after10d, 'kai', nowMs).score, 43);

  const after90d = simulateQaAbsenceDecay(base, 'kai', 90, nowMs);
  assert.equal(buildQaNpcClosenessDiagnostic(after90d, 'kai', nowMs).score, 10);
});

test('reciprocal keep-right pedestrian avoidance steers oncoming NPCs cleanly past each other', () => {
  const emptyAudited = { obbs: [], circles: [], benchAndSeatObbs: [] };
  const resA = computeLocalPedestrianAvoidance2D({
    selfId: 'npc_a',
    x: -85,
    z: 0,
    dirX: 1,
    dirZ: 0,
    radius: AMBIENT_NPC_CAPSULE_RADIUS,
    distToSteerTarget: 10,
    distToFinal: 10,
    isFinalGoal: false,
    dt: 0.05,
    audited: emptyAudited,
    stayOffNonCrosswalkRoads: false,
    characterCapsules: [
      {
        id: 'npc_b',
        x: -83.6,
        z: 0.02,
        vx: -1.4,
        vz: 0,
        radius: AMBIENT_NPC_CAPSULE_RADIUS,
        groundY: 2.5,
      },
    ],
    selfGroundY: 2.5,
  });

  const resB = computeLocalPedestrianAvoidance2D({
    selfId: 'npc_b',
    x: -83.6,
    z: 0.02,
    dirX: -1,
    dirZ: 0,
    radius: AMBIENT_NPC_CAPSULE_RADIUS,
    distToSteerTarget: 10,
    distToFinal: 10,
    isFinalGoal: false,
    dt: 0.05,
    audited: emptyAudited,
    stayOffNonCrosswalkRoads: false,
    characterCapsules: [
      {
        id: 'npc_a',
        x: -85,
        z: 0,
        vx: 1.4,
        vz: 0,
        radius: AMBIENT_NPC_CAPSULE_RADIUS,
        groundY: 2.5,
      },
    ],
    selfGroundY: 2.5,
  });

  assert.equal(resA.blocked, true);
  assert.equal(resB.blocked, true);
  // Keep-right rule: A heading +X steers +Z (dirZ > 0); B heading -X steers -Z (dirZ < 0)
  assert.ok(resA.dirZ > 0.05, `Expected A to steer right (+Z), got dirZ=${resA.dirZ}`);
  assert.ok(resB.dirZ < -0.05, `Expected B to steer right (-Z), got dirZ=${resB.dirZ}`);
});

test('stepCityAmbientNpcSchedule escalates past blocked waypoint after repeated stuck replans', () => {
  const preset: CityAmbientNpcPreset = {
    ...CITY_AMBIENT_NPC_PRESETS[0],
    id: 'test_npc_escalation',
    speedMps: 1.4,
    waypoints: [
      { x: -85, z: 0, durationSec: 0, activity: 'walk_patrol', label: 'Walking' },
      { x: -75, z: 0, durationSec: 0, activity: 'walk_patrol', label: 'Walking' },
      { x: -75, z: 10, durationSec: 0, activity: 'walk_patrol', label: 'Walking' },
    ],
  };

  // Already stuck with 2 consecutive stuck replans -> third stuck event escalates to next waypoint (index 2)
  const stepped = stepCityAmbientNpcSchedule({
    preset,
    x: -84.8,
    z: 0.1,
    yaw: 0,
    waypointIdx: 1,
    pauseTimer: 0,
    stuckTimer: 1.15,
    lastProgressX: -84.8,
    lastProgressZ: 0.1,
    consecutiveStuckReplans: 2,
    dt: 0.1,
    elapsedSec: 12.0,
    navGrid: {
      cols: 16,
      rows: 16,
      cellSize: 2,
      minX: -100,
      maxX: -68,
      minZ: -16,
      maxZ: 16,
      blocked: new Uint8Array(16 * 16),
    },
    navPath: [
      { x: -84.8, z: 0.1 },
      { x: -75, z: 0 },
    ],
    navWaypointIndex: 1,
    navPathGoalKey: '1:-75.0,0.0',
  });

  assert.equal(stepped.waypointIdx, 2);
  assert.equal(stepped.consecutiveStuckReplans, 0);
  assert.ok(stepped.pauseTimer >= 0.5);
});

test('Shop Building QA diagnostics verify all 16 lots x 3 building forms fit strictly within standards', () => {
  const emptyStore = createEmptyLotRentalStore();
  assert.equal(CITY_RENTAL_LOTS.length, 16);

  for (const lot of CITY_RENTAL_LOTS) {
    const pose = computeQaLotTeleportPose(lot.slotId);
    assert.ok(pose, `Expected valid teleport pose for ${lot.slotId}`);
    // Player stands strictly outside the 20x20m lot on the center of the 4.8m front city sidewalk facing the lot center
    const dx = lot.x - pose.x;
    const dz = lot.z - pose.z;
    const dist = Math.hypot(dx, dz);
    assert.ok(dist > 11.0 && dist < 14.0, `Expected sidewalk stand distance ~12.4m, got ${dist}`);
    // Forward vector (+cos(yaw), -sin(yaw)) must align with vector toward lot center
    const dot = Math.cos(pose.yaw) * (dx / dist) + -Math.sin(pose.yaw) * (dz / dist);
    assert.ok(dot > 0.99, `Expected teleport yaw to face lot center, dot=${dot}`);

    for (const formId of SHOP_BUILDING_FORM_IDS) {
      const diag = evaluateQaShopLotDiagnostic(emptyStore, lot.slotId, formId);
      assert.ok(diag);
      assert.equal(diag.allChecksPass, true, `Expected PASS for ${lot.slotId} + ${formId}`);
      assert.equal(diag.bounds.fitsStrictlyInsideLot, true);
    }
  }
});

test('Shop Building QA placement, lease lifecycle simulation, and billboard UV presets are non-destructive', () => {
  const nowMs = 1_750_000_000_000;
  const realStore = createEmptyLotRentalStore();
  const snapshot = cloneLotRentalStore(realStore);

  // Instant placement auto-rents in QA memory without touching realStore
  const placed = applyQaShopPlaceBuilding({
    store: realStore,
    lotId: 'lot-n-01',
    accountId: 'tester.near',
    formId: 'brick_rooftop_deck',
    nowMs,
  });
  assert.equal(Object.keys(realStore.rentalsByLotId).length, 0);
  assert.equal(Object.keys(snapshot.rentalsByLotId).length, 0);
  assert.equal(placed.rentalsByLotId['lot-n-01']?.placedBuildingFormId, 'brick_rooftop_deck');

  // Lease lifecycle presets map to exact lifecycle states
  const graceStore = applyQaShopLotStateMutation({
    store: placed,
    lotId: 'lot-n-01',
    accountId: 'tester.near',
    preset: 'grace_3d',
    nowMs,
  });
  assert.equal(
    evaluateQaShopLotDiagnostic(graceStore, 'lot-n-01', null, nowMs)?.lifecycleStatus,
    'grace',
  );

  const expiredStore = applyQaShopLotStateMutation({
    store: placed,
    lotId: 'lot-n-01',
    accountId: 'tester.near',
    preset: 'expired_freeing',
    nowMs,
  });
  assert.equal(
    evaluateQaShopLotDiagnostic(expiredStore, 'lot-n-01', null, nowMs)?.lifecycleStatus,
    'freeing',
  );

  // Billboard presets generate valid SVG data URLs and auto-mount a building on empty lots
  assert.equal(generateQaBillboardTestDataUrl('blank', 'N-01'), null);
  const uvUrl = generateQaBillboardTestDataUrl('uv_grid', 'N-01');
  assert.ok(uvUrl?.startsWith('data:image/svg+xml;charset=utf-8,'));

  const withBillboard = applyQaShopBillboardPreset({
    store: realStore,
    lotId: 'lot-s-04',
    accountId: 'tester.near',
    preset: 'neon_night',
    nowMs,
  });
  assert.ok(withBillboard.rentalsByLotId['lot-s-04']?.placedBuildingFormId);
  assert.ok(
    withBillboard.rentalsByLotId['lot-s-04']?.billboardLogoUrl?.startsWith(
      'data:image/svg+xml;charset=utf-8,',
    ),
  );
});
