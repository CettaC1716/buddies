import {
  FASHION_APPAREL_CATALOG_ITEMS,
  type FashionApparelCatalogItem,
} from '../game/buddiesFashionKioskRules';
import {
  MERCHANT_CATALOG_ITEMS,
  countOwnedMerchantItems,
  type MerchantCatalogItem,
} from '../game/buddiesMerchantPricing';
import {
  URBAN_SCOOTER_CATALOG_ITEMS,
  type UrbanScooterCatalogItem,
} from '../game/buddiesUrbanScooterRules';
import {
  WARDROBE_STUDIO_ITEMS,
  type WardrobeCatalogItem,
} from '../game/buddiesWardrobeStudioRules';

export type MyThingsSectionId = 'items' | 'vehicles' | 'properties' | 'collectibles';

export interface MyThingsSectionTab {
  id: MyThingsSectionId;
  label: string;
}

export const MY_THINGS_SECTIONS: readonly MyThingsSectionTab[] = [
  { id: 'items', label: 'Items' },
  { id: 'vehicles', label: 'Vehicles' },
  { id: 'properties', label: 'Properties' },
  { id: 'collectibles', label: 'Collectibles' },
] as const;

export const WALLET_TABS = ['wallet', 'history'] as const;
export type PersonalWalletTabId = (typeof WALLET_TABS)[number];

const CLOTHING_WARDROBE_SLOTS = new Set<WardrobeCatalogItem['slot']>([
  'top',
  'bottoms',
  'set',
  'hair',
  'shoes',
  'underwear',
]);

export interface OwnedClothingCardItem {
  id: string;
  name: string;
  categoryLabel: string;
  glbPath: string | null;
  thumbUrl: string | null;
  thumbFlipY: boolean;
}

/**
 * Strips crypto jargon (NFT, NEP-245, etc.) from player-facing item titles
 * without mutating underlying catalog data fields.
 */
export function sanitizeOwnedItemLabel(rawName: string): string {
  return rawName
    .replace(/\bNFTs?\b/gi, '')
    .replace(/\bNEP-?\d+\b/gi, '')
    .replace(/\s*\(\s*\)\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function formatClothingSlotLabel(slot: string): string {
  switch (slot) {
    case 'torso':
    case 'top':
      return 'Top';
    case 'bottoms':
      return 'Bottoms';
    case 'set':
      return 'Outfit Set';
    case 'hair':
      return 'Hair';
    case 'shoes':
      return 'Shoes';
    case 'underwear':
      return 'Essentials';
    default:
      return 'Clothing';
  }
}

export interface MyThingsInventoryInput {
  ownedMerchantItemIds: readonly string[];
  ownedApparelIds: readonly string[];
  ownedScooterIds: readonly string[];
  hasHouseOwnership: boolean;
  caughtFishCount: number;
  listedFishCount: number;
  recruitedCompanionsCount: number;
  characterGender: 'male' | 'female';
}

export interface MyThingsInventorySummary {
  ownedFishingGear: MerchantCatalogItem[];
  ownedClothing: OwnedClothingCardItem[];
  ownedVehicles: UrbanScooterCatalogItem[];
  ownedPropertyItems: MerchantCatalogItem[];
  ownedMerchantCounts: Record<string, number>;
  sectionCounts: Record<MyThingsSectionId, number>;
  totalCount: number;
}

/**
 * Partitions all existing player ownership state into the 4 My Things sections:
 * - Items: starter fishing rod + owned fishing gear/tackle + owned clothing
 * - Vehicles: owned scooters
 * - Properties: owned house + owned house themes + owned furniture
 * - Collectibles: caught fish + player's listed fish + recruited companions
 */
export function partitionMyThingsInventory(
  input: MyThingsInventoryInput,
): MyThingsInventorySummary {
  const ownedMerchantCounts = countOwnedMerchantItems([...input.ownedMerchantItemIds]);

  const ownedFishingGear = MERCHANT_CATALOG_ITEMS.filter(
    (item) => item.category === 'fishing_gear' && (ownedMerchantCounts[item.id] ?? 0) > 0,
  );

  const ownedPropertyItems = MERCHANT_CATALOG_ITEMS.filter(
    (item) =>
      (item.category === 'nft_collector_furniture' ||
        item.category === 'non_nft_furniture' ||
        item.category === 'nft_house_theme' ||
        item.category === 'nft_shop_building') &&
      (ownedMerchantCounts[item.id] ?? 0) > 0,
  );

  const ownedApparelSet = new Set(input.ownedApparelIds);
  const seenClothingIds = new Set<string>();
  const ownedClothing: OwnedClothingCardItem[] = [];

  for (const apparel of FASHION_APPAREL_CATALOG_ITEMS as readonly FashionApparelCatalogItem[]) {
    if (!ownedApparelSet.has(apparel.id) || seenClothingIds.has(apparel.id)) continue;
    seenClothingIds.add(apparel.id);
    ownedClothing.push({
      id: apparel.id,
      name: sanitizeOwnedItemLabel(apparel.name),
      categoryLabel: formatClothingSlotLabel(apparel.slot),
      glbPath:
        input.characterGender === 'female' ? apparel.femaleGlbPath : apparel.maleGlbPath,
      thumbUrl: null,
      thumbFlipY: false,
    });
  }

  for (const item of WARDROBE_STUDIO_ITEMS) {
    if (
      !ownedApparelSet.has(item.id) ||
      seenClothingIds.has(item.id) ||
      !CLOTHING_WARDROBE_SLOTS.has(item.slot)
    ) {
      continue;
    }
    seenClothingIds.add(item.id);
    ownedClothing.push({
      id: item.id,
      name: sanitizeOwnedItemLabel(item.name),
      categoryLabel: formatClothingSlotLabel(item.slot),
      glbPath: item.glbPath,
      thumbUrl: item.thumbUrl ?? null,
      thumbFlipY: Boolean(item.thumbFlipY),
    });
  }

  const ownedVehicles = URBAN_SCOOTER_CATALOG_ITEMS.filter((v) =>
    input.ownedScooterIds.includes(v.id),
  );

  const fishingGearTotalQty = ownedFishingGear.reduce(
    (sum, item) => sum + (ownedMerchantCounts[item.id] ?? 1),
    0,
  );
  const propertyItemsTotalQty = ownedPropertyItems.reduce(
    (sum, item) => sum + (ownedMerchantCounts[item.id] ?? 1),
    0,
  );

  const sectionCounts: Record<MyThingsSectionId, number> = {
    // +1 for the player's always-owned starter Fishing Rod
    items: 1 + fishingGearTotalQty + ownedClothing.length,
    vehicles: ownedVehicles.length,
    properties: (input.hasHouseOwnership ? 1 : 0) + propertyItemsTotalQty,
    collectibles:
      input.caughtFishCount + input.listedFishCount + input.recruitedCompanionsCount,
  };

  const totalCount =
    sectionCounts.items +
    sectionCounts.vehicles +
    sectionCounts.properties +
    sectionCounts.collectibles;

  return {
    ownedFishingGear,
    ownedClothing,
    ownedVehicles,
    ownedPropertyItems,
    ownedMerchantCounts,
    sectionCounts,
    totalCount,
  };
}

/**
 * Default collectible badge set that every player starts with.
 * Separate from the Batch 1 player role badge (Builder, Founder, etc.).
 * Future event-earned badges append to this set.
 */
export const DEFAULT_COLLECTIBLE_BADGE_IDS = [
  'smile',
  'sparkles',
  'crown',
  'flame',
  'heart',
  'zap',
  'star',
  'shield',
] as const;

export type DefaultCollectibleBadgeId = (typeof DEFAULT_COLLECTIBLE_BADGE_IDS)[number];

export function countCollectibleBadges(earnedBadgeIds?: readonly string[]): number {
  const unique = new Set<string>(DEFAULT_COLLECTIBLE_BADGE_IDS);
  if (Array.isArray(earnedBadgeIds)) {
    for (const rawId of earnedBadgeIds) {
      if (typeof rawId !== 'string') continue;
      const trimmed = rawId.trim();
      if (trimmed) unique.add(trimmed);
    }
  }
  return unique.size;
}

export type ProfileAssetTileId =
  | 'homes'
  | 'clothes'
  | 'vehicles'
  | 'furniture'
  | 'fish'
  | 'badges';

export interface ProfileAssetTile {
  id: ProfileAssetTileId;
  label: string;
  count: number;
}

export interface ProfileAssetTileInput {
  ownedMerchantItemIds: readonly string[];
  ownedApparelIds: readonly string[];
  ownedScooterIds: readonly string[];
  hasHouseOwnership: boolean;
  caughtFishCount: number;
  listedFishCount: number;
  characterGender: 'male' | 'female';
  earnedBadgeIds?: readonly string[];
}

/**
 * Builds the 6 calm profile asset tiles directly from the same ownership data
 * that My Things uses, plus collectible badges (default set + any event badges).
 */
export function buildProfileAssetTiles(input: ProfileAssetTileInput): ProfileAssetTile[] {
  const summary = partitionMyThingsInventory({
    ownedMerchantItemIds: input.ownedMerchantItemIds,
    ownedApparelIds: input.ownedApparelIds,
    ownedScooterIds: input.ownedScooterIds,
    hasHouseOwnership: input.hasHouseOwnership,
    caughtFishCount: Math.max(0, input.caughtFishCount),
    listedFishCount: Math.max(0, input.listedFishCount),
    recruitedCompanionsCount: 0,
    characterGender: input.characterGender,
  });

  const furnitureCount = summary.ownedPropertyItems.reduce((sum, item) => {
    if (
      item.category === 'nft_collector_furniture' ||
      item.category === 'non_nft_furniture'
    ) {
      return sum + (summary.ownedMerchantCounts[item.id] ?? 1);
    }
    return sum;
  }, 0);

  const fishCount = Math.max(0, input.caughtFishCount) + Math.max(0, input.listedFishCount);

  return [
    { id: 'homes', label: 'Homes', count: input.hasHouseOwnership ? 1 : 0 },
    { id: 'clothes', label: 'Clothes', count: summary.ownedClothing.length },
    { id: 'vehicles', label: 'Vehicles', count: summary.ownedVehicles.length },
    { id: 'furniture', label: 'Furniture', count: furnitureCount },
    { id: 'fish', label: 'Fish', count: fishCount },
    { id: 'badges', label: 'Badges', count: countCollectibleBadges(input.earnedBadgeIds) },
  ];
}

export function shouldShowProfileAssetTiles(params: {
  isSelfProfile: boolean;
  showThingsOnProfile: boolean;
}): boolean {
  return params.isSelfProfile && params.showThingsOnProfile;
}
