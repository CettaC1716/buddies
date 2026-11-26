import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CAFE_MENU_ITEMS } from './buddiesCafeRules';
import { FASHION_APPAREL_CATALOG_ITEMS } from './buddiesFashionKioskRules';
import { FISH_SPECIES_CATALOG } from './buddiesFishingMarket';
import { MERCHANT_CATALOG_ITEMS } from './buddiesMerchantPricing';
import {
  canLongConversation,
  createEmptyNpcClosenessStore,
  getNpcClosenessRecord,
  recordNpcConversation,
} from './npcClosenessEngine';
import {
  EMPTY_GIFT_PICKER_HINT,
  GIFT_REACTION_BASE_DELTAS,
  canGiftNpcToday,
  clearNpcGiftPreferencesForTests,
  evaluateNpcGiftReaction,
  filterGiftPickerItems,
  getGiftCatalogItem,
  getGiftCategoryForItem,
  giveGiftToNpc,
  hasGiftedNpcToday,
  isGiftPickerEligibleItem,
  listGiftCatalogItems,
  registerNpcGiftPreferences,
} from './npcGiftEngine';
import {
  clearNpcPersonaRegistryForTests,
  getNpcPersona,
  hasRegisteredNpcPersona,
  listRegisteredNpcPersonas,
  registerNpcPersona,
} from './npcPersonaRegistry';

describe('npcGiftEngine & npcPersonaRegistry', () => {
  beforeEach(() => {
    clearNpcPersonaRegistryForTests();
    clearNpcGiftPreferencesForTests();
  });

  it('categorizes all existing fish, cafe food, fashion/apparel, and furniture items without changing item IDs', () => {
    for (const fish of FISH_SPECIES_CATALOG) {
      assert.equal(getGiftCategoryForItem(fish.speciesId), 'fish');
      assert.equal(getGiftCatalogItem(fish.speciesId)?.itemId, fish.speciesId);
    }

    for (const food of CAFE_MENU_ITEMS) {
      assert.equal(getGiftCategoryForItem(food.id), 'cafe_food');
      assert.equal(getGiftCatalogItem(food.id)?.itemId, food.id);
    }

    for (const apparel of FASHION_APPAREL_CATALOG_ITEMS) {
      assert.equal(getGiftCategoryForItem(apparel.id), 'fashion_apparel');
      assert.equal(getGiftCatalogItem(apparel.id)?.itemId, apparel.id);
    }

    const furnitureItems = MERCHANT_CATALOG_ITEMS.filter(
      (i) =>
        i.category === 'non_nft_furniture' ||
        i.category === 'nft_collector_furniture' ||
        i.category === 'nft_house_theme',
    );
    assert.ok(furnitureItems.length > 0);
    for (const furn of furnitureItems) {
      assert.equal(getGiftCategoryForItem(furn.id), 'furniture');
      assert.equal(getGiftCatalogItem(furn.id)?.itemId, furn.id);
    }

    assert.ok(listGiftCatalogItems('fish').length === FISH_SPECIES_CATALOG.length);
    assert.ok(listGiftCatalogItems('cafe_food').length === CAFE_MENU_ITEMS.length);
    assert.ok(listGiftCatalogItems('fashion_apparel').length >= FASHION_APPAREL_CATALOG_ITEMS.length);
    assert.ok(listGiftCatalogItems('furniture').length === furnitureItems.length);
    assert.equal(getGiftCatalogItem('nonexistent_item_xyz'), null);
  });

  it('evaluates per-NPC loved, liked, neutral, and disliked preferences with deterministic precedence', () => {
    registerNpcGiftPreferences({
      npcId: 'hana',
      lovedItemIds: ['latte'],
      likedItemIds: ['croissant'],
      dislikedItemIds: ['coral_sardine'],
      lovedFishZones: ['central_oasis'],
      likedCategories: ['furniture'],
      dislikedCategories: ['fashion_apparel'],
    });

    // Explicit loved item
    const lovedRes = evaluateNpcGiftReaction('hana', 'latte');
    assert.equal(lovedRes.reactionTier, 'loved');
    assert.equal(lovedRes.closenessDelta, GIFT_REACTION_BASE_DELTAS.loved);

    // Explicit liked item
    const likedRes = evaluateNpcGiftReaction('hana', 'croissant');
    assert.equal(likedRes.reactionTier, 'liked');
    assert.equal(likedRes.closenessDelta, GIFT_REACTION_BASE_DELTAS.liked);

    // Explicit disliked item overrides fish/category
    const dislikedRes = evaluateNpcGiftReaction('hana', 'coral_sardine');
    assert.equal(dislikedRes.reactionTier, 'disliked');
    assert.equal(dislikedRes.closenessDelta, GIFT_REACTION_BASE_DELTAS.disliked);

    // Fish water zone preference + rarity & trophy bonus
    const trophyOasisFish = evaluateNpcGiftReaction('hana', {
      speciesId: 'astral_dragon_arowana',
      isTrophy: true,
    });
    assert.equal(trophyOasisFish.reactionTier, 'loved');
    assert.equal(trophyOasisFish.closenessDelta, GIFT_REACTION_BASE_DELTAS.loved + 3 + 2);

    // Category preference
    assert.equal(evaluateNpcGiftReaction('hana', 'sakura_bonsai_pot').reactionTier, 'liked');
    assert.equal(
      evaluateNpcGiftReaction('hana', 'apparel_torso_dropscience_hiphop_24').reactionTier,
      'disliked',
    );

    // Neutral fallback
    assert.equal(evaluateNpcGiftReaction('hana', 'donut').reactionTier, 'neutral');
    assert.equal(evaluateNpcGiftReaction('kai', 'latte').reactionTier, 'neutral');
  });

  it('enforces 1 gift per NPC per calendar day and unlocks thresholds on gift delivery', () => {
    registerNpcGiftPreferences({
      npcId: 'tari',
      lovedItemIds: ['iced_latte'],
      likedItemIds: ['muffin'],
    });

    const tDay1 = Date.UTC(2026, 10, 12, 14, 0, 0);
    const tDay2 = tDay1 + 24 * 60 * 60 * 1000;
    let store = createEmptyNpcClosenessStore();

    // Bring Tari to 10 via conversation so a loved gift (+12) crosses long_conversation (20)
    store = recordNpcConversation(store, 'tari', {
      closenessDelta: 10,
      nowMs: tDay1 - 60_000,
      dateKey: '2026-11-12',
    }).store;

    assert.equal(canGiftNpcToday(store, 'tari', '2026-11-12'), true);
    assert.equal(hasGiftedNpcToday(store, 'tari', '2026-11-12'), false);

    const gift1 = giveGiftToNpc(store, 'tari', 'iced_latte', {
      nowMs: tDay1,
      dateKey: '2026-11-12',
    });
    assert.equal(gift1.accepted, true);
    assert.equal(gift1.reason, undefined);
    assert.equal(gift1.reactionTier, 'loved');
    assert.equal(gift1.closenessDelta, 12);
    assert.deepEqual(gift1.unlockedNow, ['long_conversation']);
    assert.equal(canLongConversation(gift1.store, 'tari', tDay1), true);
    store = gift1.store;

    // Second gift to Tari on the same calendar day is rejected
    assert.equal(hasGiftedNpcToday(store, 'tari', '2026-11-12'), true);
    assert.equal(canGiftNpcToday(store, 'tari', '2026-11-12'), false);
    const gift1Dup = giveGiftToNpc(store, 'tari', 'muffin', {
      nowMs: tDay1 + 5000,
      dateKey: '2026-11-12',
    });
    assert.equal(gift1Dup.accepted, false);
    assert.equal(gift1Dup.reason, 'already_gifted_today');
    assert.equal(gift1Dup.closenessDelta, 0);

    // Gifting a different NPC (kenji) on the same day is allowed
    const giftOtherNpc = giveGiftToNpc(store, 'kenji', 'croissant', {
      nowMs: tDay1 + 10_000,
      dateKey: '2026-11-12',
    });
    assert.equal(giftOtherNpc.accepted, true);
    store = giftOtherNpc.store;

    // Next calendar day allows gifting Tari again
    const giftDay2 = giveGiftToNpc(store, 'tari', 'muffin', {
      nowMs: tDay2,
      dateKey: '2026-11-13',
    });
    assert.equal(giftDay2.accepted, true);
    assert.equal(giftDay2.reactionTier, 'liked');
    assert.equal(getNpcClosenessRecord(giftDay2.store, 'tari').totalGifts, 2);
  });

  it('rejects unknown NPCs and unknown items cleanly', () => {
    const store = createEmptyNpcClosenessStore();
    const badNpc = giveGiftToNpc(store, 'unknown_npc_123', 'latte');
    assert.equal(badNpc.accepted, false);
    assert.equal(badNpc.reason, 'unknown_npc');

    const badItem = giveGiftToNpc(store, 'hana', 'not_a_real_item');
    assert.equal(badItem.accepted, false);
    assert.equal(badItem.reason, 'unknown_item');
  });

  it('wires persona registry packs automatically into the gift engine without shipping persona content in F1', () => {
    // F1 ships zero pre-registered persona packs
    assert.equal(listRegisteredNpcPersonas().length, 0);
    assert.equal(hasRegisteredNpcPersona('kenji'), false);

    registerNpcPersona({
      npcId: 'kenji',
      displayName: 'Kenji',
      roleTitle: 'Test Fixture',
      homeDistrict: 'nw_fishing_lake',
      systemPrompt: 'Test fixture prompt only.',
      toneByClosenessBand: {
        stranger: 'polite',
        acquaintance: 'casual',
        friendly: 'warm',
        close: 'candid',
        trusted: 'deeply loyal',
      },
      giftPreferences: {
        npcId: 'kenji',
        lovedItemIds: ['croissant'],
        dislikedCategories: ['furniture'],
      },
    });

    assert.equal(hasRegisteredNpcPersona('citizen_kenji'), true);
    assert.equal(getNpcPersona('kenji')?.citizenId, 'citizen_kenji');
    assert.equal(evaluateNpcGiftReaction('kenji', 'croissant').reactionTier, 'loved');
    assert.equal(evaluateNpcGiftReaction('kenji', 'tatami_tea_table').reactionTier, 'disliked');
  });

  it('gift picker eligibility includes ONLY gift catalog items & cooked dishes and excludes raw fish, wardrobe, furniture, and gear', () => {
    assert.equal(isGiftPickerEligibleItem({ category: 'cafe_food' }), true);
    assert.equal(isGiftPickerEligibleItem({ category: 'gift_consumable' }), true);
    assert.equal(isGiftPickerEligibleItem({ category: 'gift_special' }), true);
    assert.equal(isGiftPickerEligibleItem({ category: 'cooked_dish' }), true);

    assert.equal(isGiftPickerEligibleItem({ category: 'fish' }), false);
    assert.equal(isGiftPickerEligibleItem({ category: 'fashion_apparel' }), false);
    assert.equal(isGiftPickerEligibleItem({ category: 'furniture' }), false);

    const sampleFish = FISH_SPECIES_CATALOG[0].speciesId;
    const sampleFood = CAFE_MENU_ITEMS[0].id;
    const sampleFashion = FASHION_APPAREL_CATALOG_ITEMS[0].id;
    const sampleFurniture = MERCHANT_CATALOG_ITEMS.find(
      (i) => i.category === 'nft_collector_furniture' || i.category === 'non_nft_furniture',
    )!.id;

    const pickerItems = filterGiftPickerItems([
      sampleFish,
      sampleFood,
      sampleFashion,
      sampleFurniture,
    ]);
    assert.deepEqual(
      pickerItems.map((it) => it.itemId),
      [sampleFood],
    );
    assert.ok(EMPTY_GIFT_PICKER_HINT.toLowerCase().includes('stall'));
  });
});
