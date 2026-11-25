import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CITIZEN_DAILY_GIFT_CATALOG,
  CITIZEN_DAILY_TALK_BONUS_POINTS,
  CITIZEN_FRIENDSHIP_STORAGE_KEY,
  CITIZEN_GIFT_REACTION_POINTS,
  CITIZEN_MAX_FRIENDSHIP_POINTS,
  CITIZEN_PROFILES,
  createDefaultCitizenFriendshipStore,
  evaluateCaughtFishGiftReaction,
  evaluateGiftReaction,
  generateCitizenChatReply,
  getCitizenHeartProgress,
  getCitizenProfile,
  getCitizenQuickPrompts,
  listCitizenDirectory,
  loadCitizenFriendshipStore,
  pickCitizenContextualDialogue,
  recordCitizenDailyGift,
  recordCitizenDailyTalk,
  resolveCanonicalCitizenId,
  saveCitizenFriendshipStore,
} from './buddiesCitizenRoles';
import type { CaughtFishItem } from './buddiesFishingMarket';

test('Citizen roster covers all 8 Coral Island-inspired villagers and resolves merchant aliases', () => {
  assert.equal(CITIZEN_PROFILES.length, 8);
  assert.equal(resolveCanonicalCitizenId('npc_cafe'), 'npc_hana');
  assert.equal(resolveCanonicalCitizenId('npc_beach'), 'npc_kai');
  assert.equal(resolveCanonicalCitizenId('citizen_mira'), 'citizen_mira');
  assert.equal(resolveCanonicalCitizenId('nonexistent_npc'), null);

  const mira = getCitizenProfile('citizen_mira');
  assert.ok(mira);
  assert.equal(mira.roleBadge, 'ARTIST');
  assert.equal(mira.appearance.baseGlbVariant, 'player');
  assert.equal(mira.appearance.idleOverrideClip, 'mira_idle.001');
  assert.equal(mira.appearance.walkOverrideClip, 'mira_walk.001');
  assert.equal(mira.appearance.runOverrideClip, 'mira_run.001');
  assert.equal(mira.appearance.sitOverrideClip, 'mira_sit.001');
  assert.equal(mira.appearance.equippedHairUrl, undefined);
  assert.equal(mira.appearance.equippedTorsoUrl, undefined);
  assert.equal(mira.appearance.equippedLegsUrl, undefined);
  assert.equal(mira.appearance.equippedFeetUrl, undefined);
  const bima = getCitizenProfile('citizen_bima');
  assert.ok(bima);
  assert.equal(bima.roleBadge, 'RIDER');
  assert.equal(bima.appearance.idleOverrideClip, 'bima_idle.001');
  assert.equal(bima.appearance.walkOverrideClip, 'bima_walk.001');
  assert.equal(bima.appearance.runOverrideClip, 'bima_run.001');
  assert.equal(bima.appearance.sitOverrideClip, 'bima_sit.001');
  assert.ok(bima.appearance.equippedHairUrl);
  assert.ok(bima.appearance.equippedTorsoUrl);
  assert.ok(bima.appearance.equippedLegsUrl);
  assert.ok(bima.appearance.equippedFeetUrl);
  const raka = getCitizenProfile('city_plaza_raka');
  assert.ok(raka);
  assert.equal(raka.appearance.baseGlbVariant, 'player');
  assert.equal(raka.appearance.idleOverrideClip, 'raka_idle.001');
  assert.equal(raka.appearance.walkOverrideClip, 'raka_walk.001');
  assert.equal(raka.appearance.runOverrideClip, 'raka_run.001');
  assert.equal(raka.appearance.sitOverrideClip, 'raka_sit.001');
  assert.ok(raka.appearance.equippedHairUrl);
  assert.ok(raka.appearance.equippedTorsoUrl);
  assert.ok(raka.appearance.equippedLegsUrl);
  assert.ok(raka.appearance.equippedFeetUrl);
  const nadia = getCitizenProfile('city_plaza_nadia');
  assert.ok(nadia);
  assert.equal(nadia.appearance.idleOverrideClip, 'nadia_idle.001');
  assert.equal(nadia.appearance.walkOverrideClip, 'nadia_walk.001');
  assert.equal(nadia.appearance.runOverrideClip, 'nadia_run.001');
  assert.equal(nadia.appearance.sitOverrideClip, 'nadia_sit.001');
  const tari = getCitizenProfile('citizen_tari');
  assert.ok(tari);
  assert.equal(tari.appearance.idleOverrideClip, 'tari_idle.001');
  assert.equal(tari.appearance.walkOverrideClip, 'tari_walk.001');
  assert.equal(tari.appearance.runOverrideClip, 'tari_run.001');
  assert.equal(tari.appearance.sitOverrideClip, 'tari_sit.001');
  const kenji = getCitizenProfile('citizen_kenji');
  assert.ok(kenji);
  assert.equal(kenji.appearance.idleOverrideClip, 'kenji_idle.001');
  assert.equal(kenji.appearance.walkOverrideClip, 'kenji_walk.001');
  assert.equal(kenji.appearance.runOverrideClip, 'kenji_run.001');
  assert.equal(kenji.appearance.sitOverrideClip, 'kenji_sit.001');
  assert.ok(CITIZEN_DAILY_GIFT_CATALOG.length >= 6);
});

test('Daily talk grants +25 pts only once per calendar day and increments totalTalks', () => {
  const initial = createDefaultCitizenFriendshipStore();
  const first = recordCitizenDailyTalk(initial, 'npc_cafe', '2026-11-17');
  assert.equal(first.awardedTodayBonus, true);
  assert.equal(first.pointsAwarded, CITIZEN_DAILY_TALK_BONUS_POINTS);
  assert.equal(first.progress.points, CITIZEN_DAILY_TALK_BONUS_POINTS);

  const repeatSameDay = recordCitizenDailyTalk(first.store, 'npc_hana', '2026-11-17');
  assert.equal(repeatSameDay.awardedTodayBonus, false);
  assert.equal(repeatSameDay.pointsAwarded, 0);
  assert.equal(repeatSameDay.progress.points, CITIZEN_DAILY_TALK_BONUS_POINTS);
  assert.equal(repeatSameDay.store.records.npc_hana.totalTalks, 2);

  const nextDay = recordCitizenDailyTalk(repeatSameDay.store, 'npc_hana', '2026-11-18');
  assert.equal(nextDay.awardedTodayBonus, true);
  assert.equal(nextDay.progress.points, CITIZEN_DAILY_TALK_BONUS_POINTS * 2);
});

test('Daily gifting evaluates loved/liked/neutral tiers, caps 1 gift/day, and clamps at 5 hearts (500 pts)', () => {
  let store = createDefaultCitizenFriendshipStore();
  assert.equal(evaluateGiftReaction('citizen_bima', 'chrome_wrench'), 'loved');
  assert.equal(evaluateGiftReaction('citizen_bima', 'iced_matcha'), 'liked');
  assert.equal(evaluateGiftReaction('citizen_bima', 'lure_feather'), 'neutral');

  const lovedGift = recordCitizenDailyGift(
    store,
    'citizen_bima',
    { kind: 'catalog', giftId: 'chrome_wrench' },
    '2026-11-17',
  );
  assert.equal(lovedGift.accepted, true);
  assert.equal(lovedGift.tier, 'loved');
  assert.equal(lovedGift.pointsAwarded, CITIZEN_GIFT_REACTION_POINTS.loved);
  store = lovedGift.store;

  const blockedSecondSameDay = recordCitizenDailyGift(
    store,
    'citizen_bima',
    { kind: 'catalog', giftId: 'roasted_beans' },
    '2026-11-17',
  );
  assert.equal(blockedSecondSameDay.accepted, false);
  assert.equal(blockedSecondSameDay.reason, 'already_gifted_today');

  // Repeated gifting across future days caps cleanly at 500 pts / 5 hearts
  for (let d = 1; d <= 10; d++) {
    const res = recordCitizenDailyGift(
      store,
      'citizen_bima',
      { kind: 'catalog', giftId: 'chrome_wrench' },
      `2026-12-${String(d).padStart(2, '0')}`,
    );
    store = res.store;
  }
  const finalProgress = getCitizenHeartProgress(store.records.citizen_bima.points);
  assert.equal(finalProgress.points, CITIZEN_MAX_FRIENDSHIP_POINTS);
  assert.equal(finalProgress.hearts, 5);
  assert.equal(finalProgress.tierLabel, 'Island Bestie');
});

test('Gifting caught fish favors water-zone preferences, rarity bonuses, and trophy bonuses', () => {
  const oasisTrophy: CaughtFishItem = {
    id: 'fish_1',
    speciesId: 'oasis_koi',
    speciesName: 'Emerald Oasis Koi',
    waterZone: 'central_oasis',
    waterZoneLabel: 'NW Fishing Lake',
    rarity: 'Rare',
    weightKg: 3.4,
    isTrophy: true,
    sellValueCyon: 40,
    sellValueLul: 1,
    mintFeeLul: 5,
    suggestedRespitePrice: 12,
    colorHex: '#0d9488',
    loreTag: 'Oasis Crown',
    caughtByAccount: 'guest',
    caughtAtIso: '2026-11-17T10:00:00Z',
    isMintedNft: false,
    nftTokenId: null,
    nearTxHash: null,
  };
  const tariReaction = evaluateCaughtFishGiftReaction('citizen_tari', oasisTrophy);
  assert.equal(tariReaction.tier, 'loved');
  assert.equal(tariReaction.points, 75 + 20 + 10);

  const store = createDefaultCitizenFriendshipStore();
  const giftRes = recordCitizenDailyGift(
    store,
    'citizen_tari',
    { kind: 'fish', fish: oasisTrophy },
    '2026-11-17',
  );
  assert.equal(giftRes.accepted, true);
  assert.equal(giftRes.pointsAwarded, 105);
  assert.equal(giftRes.progress.hearts, 1);
  assert.match(giftRes.store.records.citizen_tari.lastGiftLabel ?? '', /Emerald Oasis Koi/);
});

test('Contextual dialogues react to weather/timePhase and unlock deep talks at 2+ hearts', () => {
  const freshDialogue = pickCitizenContextualDialogue({
    citizenId: 'citizen_tari',
    hearts: 0,
    timePhase: 'day',
    isRaining: false,
    talkedCount: 0,
  });
  assert.equal(freshDialogue.deepTalk, null);

  const rainyFriendDialogue = pickCitizenContextualDialogue({
    citizenId: 'citizen_tari',
    hearts: 2,
    timePhase: 'night',
    isRaining: true,
    talkedCount: 1,
  });
  assert.match(rainyFriendDialogue.greeting.toLowerCase(), /rain|shower/);
  assert.ok(rainyFriendDialogue.deepTalk && rainyFriendDialogue.deepTalk.length > 10);
});

test('Friendship store round-trips cleanly via localStorage shim and builds directory overview', () => {
  const memoryStorage = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => memoryStorage.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memoryStorage.set(k, v);
    },
  };

  let store = loadCitizenFriendshipStore(mockStorage);
  store = recordCitizenDailyTalk(store, 'city_plaza_raka', '2026-11-17').store;
  saveCitizenFriendshipStore(store, mockStorage);
  assert.ok(memoryStorage.has(CITIZEN_FRIENDSHIP_STORAGE_KEY));

  const reloaded = loadCitizenFriendshipStore(mockStorage);
  const directory = listCitizenDirectory(reloaded, '2026-11-17');
  assert.equal(directory.length, 8);
  const rakaEntry = directory.find((entry) => entry.profile.id === 'city_plaza_raka')!;
  assert.equal(rakaEntry.talkedToday, true);
  assert.equal(rakaEntry.giftedToday, false);
  assert.equal(rakaEntry.record.points, CITIZEN_DAILY_TALK_BONUS_POINTS);
});

test('Citizen chat replies and quick prompts respond coherently in character', () => {
  const miraPrompts = getCitizenQuickPrompts('citizen_mira');
  assert.equal(miraPrompts.length, 3);

  const giftReply = generateCitizenChatReply({
    citizenId: 'citizen_mira',
    userText: 'What gifts do you like?',
    hearts: 0,
  });
  assert.match(giftReply.reply, /Iced Matcha|Tidal Shells|DropScience/i);
  assert.equal(giftReply.suggestRoleAction, false);

  const openReply = generateCitizenChatReply({
    citizenId: 'citizen_bima',
    userText: 'open scooter garage',
    hearts: 1,
  });
  assert.equal(openReply.suggestRoleAction, true);

  const secretLowHeart = generateCitizenChatReply({
    citizenId: 'citizen_tari',
    userText: 'tell me a secret story',
    hearts: 1,
  });
  assert.match(secretLowHeart.reply, /2 Hearts/i);

  const secretUnlocked = generateCitizenChatReply({
    citizenId: 'citizen_tari',
    userText: 'tell me a secret story',
    hearts: 2,
  });
  assert.match(secretUnlocked.reply, /Kai|Hana/);
});
