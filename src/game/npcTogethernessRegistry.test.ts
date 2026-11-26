import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmptyNpcClosenessStore,
  recordNpcConversation,
  type NpcClosenessStore,
  type NpcId,
} from './npcClosenessEngine';
import { stepNpcApproachVehicleForRide } from './npcTogethernessSession';
import {
  CATEGORY_COOLDOWN_MS,
  DOCK_CHIP_EXPIRY_MS,
  PAIRED_ANIMATION_CATEGORY_REGISTRY,
  advancePendingChipOtherTurn,
  computeDiminishingClosenessDelta,
  createEmptyNpcPacingStore,
  createPendingDockChip,
  detectProgressiveChatIntent,
  evaluateProgressiveCategoryVerdict,
  filterPairedItemsForAcceptedCategory,
  getPairedCategoryCounts,
  isPendingDockChipExpired,
  recordCompletedCategorySession,
  resolvePairedAnimationCategory,
} from './npcTogethernessRegistry';
import type { WardrobeCatalogItem } from './buddiesWardrobeStudioRules';

function buildStoreAtScore(npcId: NpcId, targetScore: number): NpcClosenessStore {
  let store = createEmptyNpcClosenessStore();
  let cur = 0;
  let now = Date.UTC(2026, 10, 27, 1, 0, 0);
  while (cur < targetScore) {
    const delta = Math.min(12, targetScore - cur);
    store = recordNpcConversation(store, npcId, { closenessDelta: delta, nowMs: now }).store;
    cur += delta;
    now += 1000;
  }
  return store;
}

function makeMockPairedItem(id: string): WardrobeCatalogItem {
  return {
    id,
    slot: 'style_paired',
    gender: 'unisex',
    name: id,
    subtitle: 'Paired',
    collection: 'Test',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    pairedAnim: {
      initiateGlbUrl: `/assets/animations/paired/${id}_initiate.glb`,
      receiveGlbUrl: `/assets/animations/paired/${id}_receive.glb`,
      subKind: id.includes('interdance') ? 'dance' : 'pose',
      vibeTag: 'Duo',
    },
    swatchGradient: ['#f472b6', '#831843'],
    accentHex: '#f472b6',
  };
}

test('Category registry maps all 57 paired animations with valid categories & minBands, defaulting unmapped items to fun_pose', () => {
  const counts = getPairedCategoryCounts();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.equal(total, 57);
  assert.equal(counts.dance, 14);
  assert.equal(counts.hug, 14);
  assert.equal(counts.kiss, 5);
  assert.equal(counts.hold_hands, 4);
  assert.equal(counts.sit_together, 5);
  assert.equal(counts.fun_pose, 15);

  const fallback = resolvePairedAnimationCategory('unmapped_custom_pose_999');
  assert.equal(fallback.category, 'fun_pose');
  assert.equal(fallback.minBand, 'friendly');
});

test('Acceptance 1: Beside Tari at sufficient band on scooter bike -> ride chat accepts -> chip appears -> walks to pillion -> mounts', () => {
  const nowMs = Date.UTC(2026, 10, 27, 3, 0, 0);
  const store = buildStoreAtScore('tari', 90);
  const pacing = createEmptyNpcPacingStore();

  assert.equal(detectProgressiveChatIntent('yuk naik motorku keliling kota'), 'ride');
  const verdict = evaluateProgressiveCategoryVerdict({
    store,
    pacingStore: pacing,
    npcId: 'tari',
    category: 'ride',
    isInPerson: true,
    playerScooterKind: 'electric_scooter_bike',
    nowMs,
  });
  assert.equal(verdict.accepted, true);
  assert.ok(verdict.replyLine.length > 0);

  // Chip is live while mounted & in person
  const chip = createPendingDockChip('tari', 'ride', nowMs);
  assert.equal(
    isPendingDockChipExpired(chip, {
      nowMs: nowMs + 10_000,
      isChatOpen: true,
      isInPerson: true,
      isInProximity: true,
      activeNpcId: 'tari',
      playerScooterKind: 'electric_scooter_bike',
    }),
    false,
  );

  // Dismounting silently expires ride chip
  assert.equal(
    isPendingDockChipExpired(chip, {
      nowMs: nowMs + 10_000,
      isChatOpen: true,
      isInPerson: true,
      isInProximity: true,
      activeNpcId: 'tari',
      playerScooterKind: null,
    }),
    true,
  );

  // Approach stepper walks Tari to pillion without teleporting
  const step = stepNpcApproachVehicleForRide({
    npcX: 0,
    npcZ: 0,
    npcYaw: 0,
    pillionX: 3.5,
    pillionZ: 0,
    dt: 0.4,
    elapsedSec: 0.4,
  });
  assert.equal(step.reachedMount, false);
  assert.ok(step.x > 0 && step.x < 3.5);
});

test('Acceptance 2: Ask Tari to dance (band sufficient) -> accept -> picker lists ONLY dance poses', () => {
  const nowMs = Date.UTC(2026, 10, 27, 3, 0, 0);
  const store = buildStoreAtScore('tari', 50); // friendly
  const pacing = createEmptyNpcPacingStore();

  assert.equal(detectProgressiveChatIntent('mau dansa bareng yuk?'), 'dance');
  const verdict = evaluateProgressiveCategoryVerdict({
    store,
    pacingStore: pacing,
    npcId: 'tari',
    category: 'dance',
    isInPerson: true,
    playerScooterKind: null,
    nowMs,
  });
  assert.equal(verdict.accepted, true);

  const allOwned = Object.keys(PAIRED_ANIMATION_CATEGORY_REGISTRY).map(makeMockPairedItem);
  const danceOnly = filterPairedItemsForAcceptedCategory({
    ownedPairedItems: allOwned,
    category: 'dance',
    currentBand: 'friendly',
  });
  assert.equal(danceOnly.length, 14);
  assert.ok(danceOnly.every((it) => resolvePairedAnimationCategory(it.id).category === 'dance'));
});

test('Acceptance 3: Ask for a kiss below its band -> warm decline, no kiss chip, no other category leaks in', () => {
  const nowMs = Date.UTC(2026, 10, 27, 3, 0, 0);
  const store = buildStoreAtScore('tari', 55); // friendly (< trusted)
  const pacing = createEmptyNpcPacingStore();

  assert.equal(detectProgressiveChatIntent('boleh cium?'), 'kiss');
  const verdict = evaluateProgressiveCategoryVerdict({
    store,
    pacingStore: pacing,
    npcId: 'tari',
    category: 'kiss',
    isInPerson: true,
    playerScooterKind: null,
    nowMs,
  });
  assert.equal(verdict.accepted, false);
  assert.equal(verdict.reason, 'closeness_too_low');
  assert.ok(verdict.replyLine.length > 10);

  // Even if someone tried filtering kiss items at friendly band, 0 items are eligible
  const allOwned = Object.keys(PAIRED_ANIMATION_CATEGORY_REGISTRY).map(makeMockPairedItem);
  const kissAtFriendly = filterPairedItemsForAcceptedCategory({
    ownedPairedItems: allOwned,
    category: 'kiss',
    currentBand: 'friendly',
  });
  assert.equal(kissAtFriendly.length, 0);
});

test('Acceptance 4: Repeat same category in one day -> diminishing returns decay to 0 and cooldown deflects in character', () => {
  const t0 = Date.UTC(2026, 10, 27, 3, 0, 0);
  const store = buildStoreAtScore('tari', 75); // close (allows hug)
  let pacing = createEmptyNpcPacingStore();

  assert.equal(computeDiminishingClosenessDelta(6, 0), 6);
  assert.equal(computeDiminishingClosenessDelta(6, 1), 3);
  assert.equal(computeDiminishingClosenessDelta(6, 2), 0);

  // 1st hug session completes
  const r1 = recordCompletedCategorySession({
    pacingStore: pacing,
    npcId: 'tari',
    category: 'hug',
    baseClosenessDelta: 6,
    nowMs: t0,
  });
  pacing = r1.pacingStore;
  assert.equal(r1.awardedClosenessDelta, 6);

  // Immediately re-asking during cooldown -> deflected in character, no chip
  const duringCooldown = evaluateProgressiveCategoryVerdict({
    store,
    pacingStore: pacing,
    npcId: 'tari',
    category: 'hug',
    isInPerson: true,
    playerScooterKind: null,
    nowMs: t0 + 60_000,
  });
  assert.equal(duringCooldown.accepted, false);
  assert.equal(duringCooldown.reason, 'cooldown');
  assert.ok(duringCooldown.replyLine.length > 10);

  // After cooldown passes, 2nd & 3rd sessions decay to 50% then 0%
  const r2 = recordCompletedCategorySession({
    pacingStore: pacing,
    npcId: 'tari',
    category: 'hug',
    baseClosenessDelta: 6,
    nowMs: t0 + CATEGORY_COOLDOWN_MS + 1000,
  });
  assert.equal(r2.awardedClosenessDelta, 3);
  const r3 = recordCompletedCategorySession({
    pacingStore: r2.pacingStore,
    npcId: 'tari',
    category: 'hug',
    baseClosenessDelta: 6,
    nowMs: t0 + CATEGORY_COOLDOWN_MS * 2 + 2000,
  });
  assert.equal(r3.awardedClosenessDelta, 0);
});

test('Acceptance 5 + Addendum: Phone chat blocks all togetherness chips; pending chips expire silently after 3 turns or 90s', () => {
  const t0 = Date.UTC(2026, 10, 27, 3, 0, 0);
  const store = buildStoreAtScore('tari', 95);
  const pacing = createEmptyNpcPacingStore();

  // Phone chat -> never accepted, no chip
  const phoneRide = evaluateProgressiveCategoryVerdict({
    store,
    pacingStore: pacing,
    npcId: 'tari',
    category: 'ride',
    isInPerson: false,
    playerScooterKind: 'electric_scooter_bike',
    nowMs: t0,
  });
  assert.equal(phoneRide.accepted, false);
  assert.equal(phoneRide.reason, 'phone_chat_blocked');

  // Addendum expiry (a): 3 subsequent chat turns on other topics
  let chip = createPendingDockChip('tari', 'dance', t0);
  chip = advancePendingChipOtherTurn(chip)!;
  assert.ok(chip);
  chip = advancePendingChipOtherTurn(chip)!;
  assert.ok(chip);
  const after3 = advancePendingChipOtherTurn(chip);
  assert.equal(after3, null);

  // Addendum expiry (b): 90s idle
  const freshChip = createPendingDockChip('tari', 'dance', t0);
  assert.equal(
    isPendingDockChipExpired(freshChip, {
      nowMs: t0 + DOCK_CHIP_EXPIRY_MS - 1,
      isChatOpen: true,
      isInPerson: true,
      isInProximity: true,
      activeNpcId: 'tari',
      playerScooterKind: null,
    }),
    false,
  );
  assert.equal(
    isPendingDockChipExpired(freshChip, {
      nowMs: t0 + DOCK_CHIP_EXPIRY_MS,
      isChatOpen: true,
      isInPerson: true,
      isInProximity: true,
      activeNpcId: 'tari',
      playerScooterKind: null,
    }),
    true,
  );
});
