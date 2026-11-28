import { CAFE_MENU_ITEMS } from './buddiesCafeRules';
import { FASHION_APPAREL_CATALOG_ITEMS } from './buddiesFashionKioskRules';
import {
  FISH_SPECIES_CATALOG,
  type CaughtFishItem,
  type FishRarityTier,
  type FishingWaterZoneId,
} from './buddiesFishingMarket';
import { MERCHANT_CATALOG_ITEMS } from './buddiesMerchantPricing';
import { WARDROBE_STUDIO_ITEMS } from './buddiesWardrobeStudioRules';
import {
  applyNpcGiftCloseness,
  getLocalClosenessDateKey,
  getNpcClosenessRecord,
  resolveNpcId,
  type ClosenessUnlockId,
  type NpcClosenessStore,
  type NpcId,
} from './npcClosenessEngine';

/**
 * Gift Engine (Foundation F1)
 * ===========================
 * - Categorizes existing game items across fish, cafe food, fashion/apparel, and furniture
 *   without modifying any existing item IDs.
 * - Supports per-NPC preference tables (`loved`, `liked`, `neutral`, `disliked`) registered
 *   by each NPC's dedicated persona file (`src/game/personas/<npc>.ts`).
 * - Enforces 1 gift per NPC per calendar day (persisted per player + NPC in NpcClosenessStore).
 * - Returns structured gift result `{ accepted, reason?, reactionTier, closenessDelta, unlockedNow }`
 *   with zero visible score/meter UI.
 */

export type GiftCategory =
  | 'fish'
  | 'cafe_food'
  | 'gift_consumable'
  | 'gift_special'
  | 'cooked_dish'
  | 'fashion_apparel'
  | 'furniture';

/**
 * Shipping gift-picker eligibility (companion to the gift preferences amendment):
 * ONLY gift catalog items (daily consumables + special/premium gifts, including cafe treats)
 * and cooked dishes may appear in the gift picker.
 * Raw fish, wardrobe/fashion, furniture, and fishing gear NEVER appear in the gift picker.
 */
export const GIFTABLE_PICKER_CATEGORIES: ReadonlySet<GiftCategory> = new Set<GiftCategory>([
  'cafe_food',
  'gift_consumable',
  'gift_special',
  'cooked_dish',
]);

export const EMPTY_GIFT_PICKER_HINT =
  'No gifts in your bag yet. Pick up drinks, treats, or special gifts at the drink/ice-cream stall or shops around town.';

export function isGiftPickerEligibleItem(
  item: Pick<GiftCatalogItem, 'category'> | null | undefined,
): boolean {
  if (!item) return false;
  return GIFTABLE_PICKER_CATEGORIES.has(item.category);
}

export function filterGiftPickerItems(ownedBagItemIds: readonly string[]): GiftCatalogItem[] {
  const result: GiftCatalogItem[] = [];
  for (const id of ownedBagItemIds) {
    const item = getGiftCatalogItem(id);
    if (item && isGiftPickerEligibleItem(item)) {
      result.push(item);
    }
  }
  return result;
}

export type GiftReactionTier = 'loved' | 'liked' | 'neutral' | 'disliked';

export interface GiftCatalogItem {
  /** Exact existing game item ID (never renamed). */
  itemId: string;
  name: string;
  category: GiftCategory;
  /** Optional fish metadata when category === 'fish'. */
  fishWaterZone?: FishingWaterZoneId;
  fishRarity?: FishRarityTier;
  /** Optional subcategory detail (e.g. 'drink' | 'pastry' | 'top' | 'bottoms' | 'set' | 'hair' | 'shoes'). */
  subCategory?: string;
}

export interface NpcGiftPreferenceTable {
  npcId: NpcId;
  lovedItemIds?: readonly string[];
  likedItemIds?: readonly string[];
  dislikedItemIds?: readonly string[];
  lovedCategories?: readonly GiftCategory[];
  likedCategories?: readonly GiftCategory[];
  dislikedCategories?: readonly GiftCategory[];
  lovedFishZones?: readonly FishingWaterZoneId[];
  dislikedFishZones?: readonly FishingWaterZoneId[];
}

export interface GiftDeliveryOptions {
  nowMs?: number;
  dateKey?: string;
  /** Optional trophy flag when gifting a specific caught fish. */
  isTrophyFish?: boolean;
}

export type GiftRejectionReason =
  | 'already_gifted_today'
  | 'unknown_npc'
  | 'unknown_item';

export interface GiftDeliveryResult {
  accepted: boolean;
  reason?: GiftRejectionReason;
  npcId: NpcId | null;
  itemId: string;
  itemName: string;
  category: GiftCategory | null;
  reactionTier: GiftReactionTier;
  /** Internal closeness delta for F1/F2 telemetry ONLY — never display as a number in UI. */
  closenessDelta: number;
  unlockedNow: ClosenessUnlockId[];
  store: NpcClosenessStore;
}

export const GIFT_REACTION_BASE_DELTAS: Readonly<Record<GiftReactionTier, number>> = {
  loved: 12,
  liked: 6,
  neutral: 2,
  disliked: -3,
};

export interface CentralPlazaSpecialGiftSpec {
  readonly id: string;
  readonly name: string;
  readonly category: 'gift_special' | 'gift_consumable';
  readonly subCategory: 'flower' | 'patisserie' | 'confection' | 'tea';
  readonly priceRespite: number;
  readonly description: string;
  readonly previewGiftKind:
    | 'rose_bouquet'
    | 'sunflower_bouquet'
    | 'lavender_bouquet'
    | 'macaron_box'
    | 'truffle_box'
    | 'tea_set';
  readonly primaryHex: string;
  readonly secondaryHex: string;
  readonly accentHex: string;
}

export const CENTRAL_PLAZA_SPECIAL_GIFT_ITEMS: readonly CentralPlazaSpecialGiftSpec[] = [
  {
    id: 'gift_velvet_rose_bouquet',
    name: 'Velvet Rose Bouquet',
    category: 'gift_special',
    subCategory: 'flower',
    priceRespite: 18,
    description:
      'Hand-tied crimson garden roses wrapped in linen paper and satin ribbon, ready to gift to any friend in Cerria.',
    previewGiftKind: 'rose_bouquet',
    primaryHex: '#C83E4D',
    secondaryHex: '#355E3B',
    accentHex: '#F3DFC1',
  },
  {
    id: 'gift_sunlit_sunflower_bundle',
    name: 'Sunlit Sunflower Bundle',
    category: 'gift_special',
    subCategory: 'flower',
    priceRespite: 14,
    description:
      'Bright golden sunflowers cut fresh from the plaza conservatory and wrapped in kraft parchment for warm daily gifting.',
    previewGiftKind: 'sunflower_bouquet',
    primaryHex: '#EAB308',
    secondaryHex: '#4A3219',
    accentHex: '#3F6A3C',
  },
  {
    id: 'gift_lavender_blossom_wrap',
    name: 'Lavender Blossom Wrap',
    category: 'gift_special',
    subCategory: 'flower',
    priceRespite: 16,
    description:
      'Fragrant purple lavender stems paired with soft eucalyptus leaves, tied with cream twine for calming social gifts.',
    previewGiftKind: 'lavender_bouquet',
    primaryHex: '#8B6BB8',
    secondaryHex: '#4A6B53',
    accentHex: '#EDE4D6',
  },
  {
    id: 'gift_pastel_macaron_box',
    name: 'Pastel Macaron Box',
    category: 'gift_consumable',
    subCategory: 'patisserie',
    priceRespite: 15,
    description:
      'Six French almond macarons in rose, pistachio, and vanilla cream arranged in a ribboned keepsake box for NPC gifting.',
    previewGiftKind: 'macaron_box',
    primaryHex: '#F2C6CE',
    secondaryHex: '#C7A97C',
    accentHex: '#A7C7A5',
  },
  {
    id: 'gift_matcha_truffle_tin',
    name: 'Matcha Truffle Tin',
    category: 'gift_consumable',
    subCategory: 'confection',
    priceRespite: 20,
    description:
      'Velvety dark chocolate ganache dusted with ceremonial Kyoto matcha inside a brushed brass patisserie tin.',
    previewGiftKind: 'truffle_box',
    primaryHex: '#4D7348',
    secondaryHex: '#3D271C',
    accentHex: '#D5AA4E',
  },
  {
    id: 'gift_artisan_honey_tea_set',
    name: 'Artisan Honey Tea Set',
    category: 'gift_special',
    subCategory: 'tea',
    priceRespite: 24,
    description:
      'Small-batch wildflower honey and loose chamomile petals paired with stoneware tasting cups for thoughtful gifting.',
    previewGiftKind: 'tea_set',
    primaryHex: '#D99B38',
    secondaryHex: '#EDE6DA',
    accentHex: '#7A5438',
  },
] as const;

const WEARABLE_APPAREL_SLOTS = new Set<string>(['top', 'bottoms', 'set', 'hair', 'shoes']);
const FURNITURE_MERCHANT_CATEGORIES = new Set<string>([
  'non_nft_furniture',
  'nft_collector_furniture',
  'nft_house_theme',
]);

let cachedGiftCatalogMap: ReadonlyMap<string, GiftCatalogItem> | null = null;
let cachedGiftCatalogList: readonly GiftCatalogItem[] | null = null;

function buildGiftCatalog(): {
  map: ReadonlyMap<string, GiftCatalogItem>;
  list: readonly GiftCatalogItem[];
} {
  if (cachedGiftCatalogMap && cachedGiftCatalogList) {
    return { map: cachedGiftCatalogMap, list: cachedGiftCatalogList };
  }

  const map = new Map<string, GiftCatalogItem>();

  // 1. Fish (exact speciesId from FISH_SPECIES_CATALOG)
  for (const fish of FISH_SPECIES_CATALOG) {
    map.set(fish.speciesId, {
      itemId: fish.speciesId,
      name: fish.speciesName,
      category: 'fish',
      fishWaterZone: fish.waterZone,
      fishRarity: fish.rarity,
      subCategory: fish.waterZone,
    });
  }

  // 2. Cafe Food & Drinks (exact id from CAFE_MENU_ITEMS)
  for (const food of CAFE_MENU_ITEMS) {
    map.set(food.id, {
      itemId: food.id,
      name: food.name,
      category: 'cafe_food',
      subCategory: food.category,
    });
  }

  // 2b. Central Plaza Flowers, Confections & Special Gifts (Cerria Bites & Sips)
  for (const gift of CENTRAL_PLAZA_SPECIAL_GIFT_ITEMS) {
    if (map.has(gift.id)) continue;
    map.set(gift.id, {
      itemId: gift.id,
      name: gift.name,
      category: gift.category,
      subCategory: gift.subCategory,
    });
  }

  // 3. Fashion & Apparel (exact ids from FASHION_APPAREL_CATALOG_ITEMS + wearable WARDROBE_STUDIO_ITEMS)
  for (const apparel of FASHION_APPAREL_CATALOG_ITEMS) {
    map.set(apparel.id, {
      itemId: apparel.id,
      name: apparel.name,
      category: 'fashion_apparel',
      subCategory: apparel.slot,
    });
  }
  for (const wardrobeItem of WARDROBE_STUDIO_ITEMS) {
    if (!WEARABLE_APPAREL_SLOTS.has(wardrobeItem.slot)) continue;
    if (map.has(wardrobeItem.id)) continue;
    map.set(wardrobeItem.id, {
      itemId: wardrobeItem.id,
      name: wardrobeItem.name,
      category: 'fashion_apparel',
      subCategory: wardrobeItem.slot,
    });
  }

  // 4. Furniture & House Themes (exact ids from MERCHANT_CATALOG_ITEMS)
  for (const merchantItem of MERCHANT_CATALOG_ITEMS) {
    if (!FURNITURE_MERCHANT_CATEGORIES.has(merchantItem.category)) continue;
    if (map.has(merchantItem.id)) continue;
    map.set(merchantItem.id, {
      itemId: merchantItem.id,
      name: merchantItem.name,
      category: 'furniture',
      subCategory: merchantItem.interiorSlot ?? merchantItem.category,
    });
  }

  const list = Array.from(map.values());
  cachedGiftCatalogMap = map;
  cachedGiftCatalogList = list;
  return { map, list };
}

export function getGiftCatalogItem(itemId: string | null | undefined): GiftCatalogItem | null {
  if (!itemId || typeof itemId !== 'string') return null;
  const trimmed = itemId.trim();
  if (!trimmed) return null;
  return buildGiftCatalog().map.get(trimmed) ?? null;
}

export function getGiftCategoryForItem(itemId: string | null | undefined): GiftCategory | null {
  return getGiftCatalogItem(itemId)?.category ?? null;
}

export function listGiftCatalogItems(category?: GiftCategory): readonly GiftCatalogItem[] {
  const { list } = buildGiftCatalog();
  if (!category) return list;
  return list.filter((item) => item.category === category);
}

// Per-NPC preference registry populated by persona packs (`src/game/personas/<npc>.ts`)
const npcGiftPreferencesRegistry = new Map<NpcId, NpcGiftPreferenceTable>();

export function registerNpcGiftPreferences(table: NpcGiftPreferenceTable): void {
  const npcId = resolveNpcId(table.npcId);
  if (!npcId) {
    throw new Error(`Cannot register gift preferences for unknown NPC: "${table.npcId}"`);
  }
  npcGiftPreferencesRegistry.set(npcId, {
    ...table,
    npcId,
    lovedItemIds: table.lovedItemIds ? [...table.lovedItemIds] : [],
    likedItemIds: table.likedItemIds ? [...table.likedItemIds] : [],
    dislikedItemIds: table.dislikedItemIds ? [...table.dislikedItemIds] : [],
    lovedCategories: table.lovedCategories ? [...table.lovedCategories] : [],
    likedCategories: table.likedCategories ? [...table.likedCategories] : [],
    dislikedCategories: table.dislikedCategories ? [...table.dislikedCategories] : [],
    lovedFishZones: table.lovedFishZones ? [...table.lovedFishZones] : [],
    dislikedFishZones: table.dislikedFishZones ? [...table.dislikedFishZones] : [],
  });
}

export function getNpcGiftPreferences(rawNpcId: string): NpcGiftPreferenceTable | null {
  const npcId = resolveNpcId(rawNpcId);
  if (!npcId) return null;
  return npcGiftPreferencesRegistry.get(npcId) ?? null;
}

export function unregisterNpcGiftPreferencesForTests(npcId: NpcId): void {
  npcGiftPreferencesRegistry.delete(npcId);
}

export function clearNpcGiftPreferencesForTests(): void {
  npcGiftPreferencesRegistry.clear();
}

export type GiftItemInput = string | Pick<CaughtFishItem, 'speciesId' | 'isTrophy'>;

function resolveGiftInput(input: GiftItemInput): {
  item: GiftCatalogItem | null;
  rawId: string;
  isTrophyFish: boolean;
} {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    return {
      item: getGiftCatalogItem(trimmed),
      rawId: trimmed,
      isTrophyFish: false,
    };
  }
  const speciesId = (input?.speciesId ?? '').trim();
  return {
    item: getGiftCatalogItem(speciesId),
    rawId: speciesId,
    isTrophyFish: Boolean(input?.isTrophy),
  };
}

/**
 * Evaluates an NPC's reaction tier and closeness delta for a given gift item.
 * Precedence:
 *   1. Explicit item ID match (loved > disliked > liked)
 *   2. Fish water zone match (lovedFishZones > dislikedFishZones)
 *   3. Gift category match (lovedCategories > dislikedCategories > likedCategories)
 *   4. Default 'neutral'
 */
export function evaluateNpcGiftReaction(
  rawNpcId: string,
  itemInput: GiftItemInput,
  options: { isTrophyFish?: boolean; preferenceOverride?: NpcGiftPreferenceTable | null } = {},
): {
  item: GiftCatalogItem | null;
  reactionTier: GiftReactionTier;
  closenessDelta: number;
} {
  const { item, isTrophyFish: inputTrophy } = resolveGiftInput(itemInput);
  if (!item) {
    return {
      item: null,
      reactionTier: 'neutral',
      closenessDelta: 0,
    };
  }

  const prefs =
    options.preferenceOverride !== undefined
      ? options.preferenceOverride
      : getNpcGiftPreferences(rawNpcId);

  let reactionTier: GiftReactionTier = 'neutral';

  if (prefs) {
    if (prefs.lovedItemIds?.includes(item.itemId)) {
      reactionTier = 'loved';
    } else if (prefs.dislikedItemIds?.includes(item.itemId)) {
      reactionTier = 'disliked';
    } else if (prefs.likedItemIds?.includes(item.itemId)) {
      reactionTier = 'liked';
    } else if (item.category === 'fish' && item.fishWaterZone) {
      if (prefs.lovedFishZones?.includes(item.fishWaterZone)) {
        reactionTier = 'loved';
      } else if (prefs.dislikedFishZones?.includes(item.fishWaterZone)) {
        reactionTier = 'disliked';
      } else if (prefs.lovedCategories?.includes('fish')) {
        reactionTier = 'loved';
      } else if (prefs.dislikedCategories?.includes('fish')) {
        reactionTier = 'disliked';
      } else if (prefs.likedCategories?.includes('fish')) {
        reactionTier = 'liked';
      }
    } else if (prefs.lovedCategories?.includes(item.category)) {
      reactionTier = 'loved';
    } else if (prefs.dislikedCategories?.includes(item.category)) {
      reactionTier = 'disliked';
    } else if (prefs.likedCategories?.includes(item.category)) {
      reactionTier = 'liked';
    }
  }

  let closenessDelta = GIFT_REACTION_BASE_DELTAS[reactionTier];

  // Small extra appreciation for Rare/Mythic or Trophy fish when the NPC likes or loves it.
  if (item.category === 'fish' && (reactionTier === 'loved' || reactionTier === 'liked')) {
    const isTrophy = Boolean(options.isTrophyFish || inputTrophy);
    const rarityBonus =
      item.fishRarity === 'Mythic' ? 3 : item.fishRarity === 'Rare' ? 2 : 0;
    const trophyBonus = isTrophy ? 2 : 0;
    closenessDelta += rarityBonus + trophyBonus;
  }

  return {
    item,
    reactionTier,
    closenessDelta,
  };
}

export function hasGiftedNpcToday(
  store: NpcClosenessStore,
  rawNpcId: string,
  dateKey: string = getLocalClosenessDateKey(),
): boolean {
  const npcId = resolveNpcId(rawNpcId);
  if (!npcId) return false;
  const record = getNpcClosenessRecord(store, npcId);
  return record.lastGiftDateKey === dateKey;
}

export function canGiftNpcToday(
  store: NpcClosenessStore,
  rawNpcId: string,
  dateKey: string = getLocalClosenessDateKey(),
): boolean {
  const npcId = resolveNpcId(rawNpcId);
  if (!npcId) return false;
  return !hasGiftedNpcToday(store, npcId, dateKey);
}

/**
 * Delivers a gift to an NPC, enforcing the 1-gift-per-NPC-per-calendar-day rule
 * and updating the hidden closeness store cleanly.
 */
export function giveGiftToNpc(
  store: NpcClosenessStore,
  rawNpcId: string,
  itemInput: GiftItemInput,
  options: GiftDeliveryOptions = {},
): GiftDeliveryResult {
  const nowMs = options.nowMs ?? Date.now();
  const dateKey = options.dateKey ?? getLocalClosenessDateKey(nowMs);
  const { item, rawId, isTrophyFish } = resolveGiftInput(itemInput);

  const npcId = resolveNpcId(rawNpcId);
  if (!npcId) {
    return {
      accepted: false,
      reason: 'unknown_npc',
      npcId: null,
      itemId: rawId,
      itemName: item?.name ?? rawId,
      category: item?.category ?? null,
      reactionTier: 'neutral',
      closenessDelta: 0,
      unlockedNow: [],
      store,
    };
  }

  if (!item) {
    return {
      accepted: false,
      reason: 'unknown_item',
      npcId,
      itemId: rawId,
      itemName: rawId,
      category: null,
      reactionTier: 'neutral',
      closenessDelta: 0,
      unlockedNow: [],
      store,
    };
  }

  if (hasGiftedNpcToday(store, npcId, dateKey)) {
    return {
      accepted: false,
      reason: 'already_gifted_today',
      npcId,
      itemId: item.itemId,
      itemName: item.name,
      category: item.category,
      reactionTier: 'neutral',
      closenessDelta: 0,
      unlockedNow: [],
      store,
    };
  }

  const evaluated = evaluateNpcGiftReaction(npcId, itemInput, {
    isTrophyFish: options.isTrophyFish ?? isTrophyFish,
  });

  const mutation = applyNpcGiftCloseness(store, npcId, {
    delta: evaluated.closenessDelta,
    dateKey,
    giftItemId: item.itemId,
    nowMs,
  });

  return {
    accepted: true,
    npcId,
    itemId: item.itemId,
    itemName: item.name,
    category: item.category,
    reactionTier: evaluated.reactionTier,
    closenessDelta: mutation.appliedDelta,
    unlockedNow: mutation.unlockedNow,
    store: mutation.store,
  };
}

// ---------------------------------------------------------------------------
// Per-NPC Gift Treasury Persistence (accepted gifts enter the NPC's treasury)
// ---------------------------------------------------------------------------

export interface NpcTreasuryEntry {
  id: string;
  itemId: string;
  itemName: string;
  category: GiftCategory;
  giftedAtMs: number;
  giftedBy: string;
}

export type NpcTreasuryStore = Partial<Record<NpcId, NpcTreasuryEntry[]>>;

const NPC_TREASURY_STORAGE_PREFIX = 'bb_npc_treasury_v1';

export function getNpcTreasuryStorageKey(playerAccountId?: string | null): string {
  const clean = (playerAccountId ?? '').trim().toLowerCase() || 'guest';
  return `${NPC_TREASURY_STORAGE_PREFIX}:${clean}`;
}

export function loadNpcTreasuryStore(
  playerAccountId?: string | null,
  storage?: Pick<Storage, 'getItem'> | null,
): NpcTreasuryStore {
  const storeRef = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!storeRef) return {};
  try {
    const raw = storeRef.getItem(getNpcTreasuryStorageKey(playerAccountId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as NpcTreasuryStore;
  } catch {
    return {};
  }
}

export function saveNpcTreasuryStore(
  playerAccountId: string | null | undefined,
  treasury: NpcTreasuryStore,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  const storeRef = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!storeRef) return;
  try {
    storeRef.setItem(getNpcTreasuryStorageKey(playerAccountId), JSON.stringify(treasury));
  } catch {
    // ignore quota errors
  }
}

export function recordNpcTreasuryGift(
  treasury: NpcTreasuryStore,
  rawNpcId: string | null | undefined,
  entry: {
    itemId: string;
    itemName: string;
    category: GiftCategory;
    giftedBy?: string;
    nowMs?: number;
  },
): NpcTreasuryStore {
  const npcId = resolveNpcId(rawNpcId);
  if (!npcId) return treasury;
  const nowMs = entry.nowMs ?? Date.now();
  const prevList = treasury[npcId] ?? [];
  const nextEntry: NpcTreasuryEntry = {
    id: `${npcId}_${entry.itemId}_${nowMs}`,
    itemId: entry.itemId,
    itemName: entry.itemName,
    category: entry.category,
    giftedAtMs: nowMs,
    giftedBy: (entry.giftedBy ?? 'Player').trim() || 'Player',
  };
  return {
    ...treasury,
    [npcId]: [nextEntry, ...prevList].slice(0, 120),
  };
}

export function getNpcTreasuryItems(
  treasury: NpcTreasuryStore,
  rawNpcId: string | null | undefined,
): readonly NpcTreasuryEntry[] {
  const npcId = resolveNpcId(rawNpcId);
  if (!npcId) return [];
  return treasury[npcId] ?? [];
}

export function buildNpcPairPoseDecisionReply(
  rawNpcId: string | null | undefined,
  accepted: boolean,
): string {
  const npcId = resolveNpcId(rawNpcId);
  if (accepted) {
    switch (npcId) {
      case 'hana':
        return 'Of course! Let us step over and pick a nice pose together.';
      case 'kai':
        return 'Sure thing. Lead the way and pick a pose — I will try not to blink.';
      case 'mira':
        return 'Yes! I would love to — let us pick a fun pose together!';
      case 'nadia':
        return 'Finally, someone with an eye for a good frame. Pick a pose and let us shoot.';
      case 'tari':
        return 'Oh, I am SO in! Pick a pose or dance and let us make it shine!';
      case 'bima':
        return 'Alright. Pick a pose — I am ready.';
      case 'kenji':
        return 'Very well, I have a moment off-duty. Please choose a pose.';
      default:
        return 'Sure, let us pose together! Pick one you like.';
    }
  }
  switch (npcId) {
    case 'hana':
      return 'That is sweet of you to ask! Let us get to know each other a bit better first.';
    case 'kai':
      return 'Easy there — we barely know each other yet. Stick around and chat a bit first.';
    case 'mira':
      return 'Hehe, maybe after we have chatted a bit more! Come hang out with me first.';
    case 'nadia':
      return 'Not so fast. I only do paired shoots with people I know well — talk to me a bit more first.';
    case 'tari':
      return 'Ooh, rain check for now! Let us hang out and chat a little more first, okay?';
    case 'bima':
      return 'Not yet. Let us talk a bit more first.';
    case 'kenji':
      return 'I appreciate the offer, though I prefer to get acquainted a bit more before posing together.';
    default:
      return 'Maybe once we know each other a little better — let us chat a bit more first!';
  }
}
