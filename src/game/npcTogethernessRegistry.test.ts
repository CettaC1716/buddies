import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmptyNpcClosenessStore,
  recordNpcConversation,
  type NpcClosenessStore,
  type NpcId,
} from './npcClosenessEngine';
import {
  canStartDirectPairedPoseForTarget,
  stepNpcApproachVehicleForRide,
} from './npcTogethernessSession';
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
  formatEmptyCategoryPickerMessage,
  getPairedCategoryCounts,
  isPairedTargetStillInProximity,
  isPendingDockChipExpired,
  recordCompletedCategorySession,
  resolveLiveNpcTargetEntity,
  resolvePairedAnimationCategory,
  type PairedPoseCategory,
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

test('WS27 acceptance: chip survives closing chat in NPC profile dock, expires on 3 turns / 90s / context break', () => {
  const t0 = Date.UTC(2026, 10, 27, 4, 15, 0);
  const store = buildStoreAtScore('tari', 88);
  const pacing = createEmptyNpcPacingStore();

  // Negotiate ride beside Tari
  const intent = detectProgressiveChatIntent('yuk naik motorku keliling');
  assert.equal(intent, 'ride');
  const verdict = evaluateProgressiveCategoryVerdict({
    store,
    pacingStore: pacing,
    npcId: 'tari',
    category: 'ride',
    isInPerson: true,
    playerScooterKind: 'electric_scooter_bike',
    nowMs: t0,
  });
  assert.equal(verdict.accepted, true);

  const chip = createPendingDockChip('tari', 'ride', t0);

  // Closing the chat modal does NOT kill the chip in Tari's profile dock
  assert.equal(
    isPendingDockChipExpired(chip, {
      nowMs: t0 + 5_000,
      isChatOpen: false,
      isInPerson: true,
      isInProximity: true,
      activeNpcId: null,
      playerScooterKind: 'electric_scooter_bike',
    }),
    false,
  );

  // Leaving proximity or switching to another NPC expires the chip
  assert.equal(
    isPendingDockChipExpired(chip, {
      nowMs: t0 + 5_000,
      isChatOpen: false,
      isInPerson: true,
      isInProximity: false,
      activeNpcId: null,
      playerScooterKind: 'electric_scooter_bike',
    }),
    true,
  );
  assert.equal(
    isPendingDockChipExpired(chip, {
      nowMs: t0 + 5_000,
      isChatOpen: true,
      isInPerson: true,
      isInProximity: true,
      activeNpcId: 'hana',
      playerScooterKind: 'electric_scooter_bike',
    }),
    true,
  );

  // 3 other-topic turns silently expire the chip
  let c: ReturnType<typeof createPendingDockChip> | null = chip;
  c = advancePendingChipOtherTurn(c);
  assert.ok(c);
  c = advancePendingChipOtherTurn(c);
  assert.ok(c);
  c = advancePendingChipOtherTurn(c);
  assert.equal(c, null);
});

test('WS26 acceptance & diagnostic chain: real target entity, empty-category copy, full hug + kiss chain at trusted band', () => {
  const t0 = Date.UTC(2026, 10, 27, 4, 20, 0);
  const store = buildStoreAtScore('tari', 90); // trusted band
  const pacing = createEmptyNpcPacingStore();

  const liveNearbyUsers = [
    { id: 'citizen_tari', name: 'Tari', distance: 2.1, isNpc: true, gender: 'female' as const },
    { id: 'npc_hana', name: 'Hana', distance: 3.4, isNpc: true, isMerchant: true, gender: 'female' as const },
  ];

  // Defect 1: resolveLiveNpcTargetEntity returns the exact live nearby entity (never fabricated)
  const resolvedTari = resolveLiveNpcTargetEntity({
    npcId: 'tari',
    nearbyUsers: liveNearbyUsers,
  });
  assert.strictEqual(resolvedTari, liveNearbyUsers[0]);
  assert.equal(
    isPairedTargetStillInProximity({ target: resolvedTari, nearbyUsers: liveNearbyUsers }),
    true,
  );

  // Alias id (npc_hana in nearbyUsers vs npc_cafe alias) still resolves real live entity & survives guard
  const resolvedHana = resolveLiveNpcTargetEntity({
    npcId: 'hana',
    nearbyUsers: liveNearbyUsers,
  });
  assert.strictEqual(resolvedHana, liveNearbyUsers[1]);
  assert.equal(
    isPairedTargetStillInProximity({
      target: { id: 'npc_cafe', isNpc: true },
      nearbyUsers: liveNearbyUsers,
    }),
    true,
  );

  // Defect 2: Empty-category copy speaks plainly
  assert.equal(
    formatEmptyCategoryPickerMessage('hug'),
    "You don't have any Hug animations yet — you can get them from the Animations catalog.",
  );
  assert.equal(
    formatEmptyCategoryPickerMessage('kiss'),
    "You don't have any Kiss animations yet — you can get them from the Animations catalog.",
  );

  // Full link-by-link chain for hug & kiss with test account at trusted band owning 1 hug + 1 kiss item
  const ownedItems: WardrobeCatalogItem[] = [
    { id: 'anim_paired_61a88358_interpose_hugs01', name: 'Warm Hug', subtitle: 'Hug' } as WardrobeCatalogItem,
    { id: 'anim_paired_b49a5c2c_interpose_affection02', name: 'Sweet Affection', subtitle: 'Kiss' } as WardrobeCatalogItem,
  ];

  const categoriesToVerify: ReadonlyArray<{ category: PairedPoseCategory; prompt: string; expectedId: string }> = [
    { category: 'hug', prompt: 'can I hug you?', expectedId: 'anim_paired_61a88358_interpose_hugs01' },
    { category: 'kiss', prompt: 'can I kiss you?', expectedId: 'anim_paired_b49a5c2c_interpose_affection02' },
  ];

  for (const { category, prompt, expectedId } of categoriesToVerify) {
    // 1. Intent detected
    assert.equal(detectProgressiveChatIntent(prompt), category);
    // 2. Verdict accepted
    const verdict = evaluateProgressiveCategoryVerdict({
      store,
      pacingStore: pacing,
      npcId: 'tari',
      category,
      isInPerson: true,
      playerScooterKind: null,
      nowMs: t0,
    });
    assert.equal(verdict.accepted, true);
    // 3. Chip created & live in NPC profile dock
    const chip = createPendingDockChip('tari', category, t0);
    assert.equal(
      isPendingDockChipExpired(chip, {
        nowMs: t0 + 1000,
        isChatOpen: false,
        isInPerson: true,
        isInProximity: true,
        activeNpcId: null,
        playerScooterKind: null,
      }),
      false,
    );
    // 4. Chip tap resolves real target entity & survives proximity guard
    const target = resolveLiveNpcTargetEntity({
      npcId: chip.npcId,
      nearbyUsers: liveNearbyUsers,
    });
    assert.equal(isPairedTargetStillInProximity({ target, nearbyUsers: liveNearbyUsers }), true);
    // 5. Picker lists filtered items for accepted category only
    const filtered = filterPairedItemsForAcceptedCategory({
      ownedPairedItems: ownedItems,
      category,
      currentBand: 'trusted',
    });
    assert.deepEqual(
      filtered.map((i) => i.id),
      [expectedId],
    );
    // 6. Item selected -> paired pose guard passes
    assert.equal(
      canStartDirectPairedPoseForTarget({
        store,
        targetId: target.id,
        nowMs: t0,
      }),
      true,
    );
  }
});
