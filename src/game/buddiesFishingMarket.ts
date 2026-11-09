/**
 * ============================================================================
 * BUDDIES BLITZ 3D — FISHING, FISH NFT MINTING & KAI'S RESPITE MARKETPLACE
 * ============================================================================
 * Economy Rules:
 *   1. LUL is earned ONLY in the Warzone (high supply from combat & crates).
 *   2. Fishing has its own skill/difficulty at East Beach or Central Oasis Lake:
 *      - Option A (Direct Sale): Sell caught fish directly to Merchant Kai for CYON.
 *      - Option B (NFT Marketplace): Mint caught fish into a NEP-171 Fish NFT and
 *        list it on Kai's P2P Marketplace, where other players buy it using RESPITE.
 * ============================================================================
 */

import { evaluateNwLakeSdf, evaluateSeHarborSdf } from './buddiesPlanetCurvature';

export type FishingWaterZoneId = 'central_oasis' | 'east_beach';
export type FishRarityTier = 'Common' | 'Uncommon' | 'Rare' | 'Mythic';

export interface FishingWaterDetection {
  canFish: boolean;
  zoneId: FishingWaterZoneId | null;
  zoneLabel: string | null;
  distanceToWaterM: number;
}

export interface FishSpeciesSpec {
  speciesId: string;
  speciesName: string;
  waterZone: FishingWaterZoneId;
  rarity: FishRarityTier;
  minWeightKg: number;
  maxWeightKg: number;
  baseCyonPerKg: number;
  baseLulPerKg: number;
  mintFeeLul: number;
  suggestedRespitePrice: number;
  dropWeight: number;
  colorHex: string;
  loreTag: string;
}

export interface CaughtFishItem {
  id: string;
  speciesId: string;
  speciesName: string;
  waterZone: FishingWaterZoneId;
  waterZoneLabel: string;
  rarity: FishRarityTier;
  weightKg: number;
  sellValueCyon: number;
  sellValueLul: number;
  mintFeeLul: number;
  suggestedRespitePrice: number;
  colorHex: string;
  loreTag: string;
  caughtByAccount: string;
  caughtAtIso: string;
  isMintedNft: boolean;
  nftTokenId: string | null;
  nearTxHash: string | null;
}

export interface FishNftMarketplaceListing {
  listingId: string;
  nftTokenId: string;
  speciesId: string;
  speciesName: string;
  waterZone: FishingWaterZoneId;
  waterZoneLabel: string;
  rarity: FishRarityTier;
  weightKg: number;
  colorHex: string;
  caughtByAccount: string;
  sellerNearAccount: string;
  priceRespite: number;
  priceLul: number;
  nearTxHash: string;
  listedAtIso: string;
}

export const FISH_SPECIES_CATALOG: FishSpeciesSpec[] = [
  // 1. East Beach & Harbor (Saltwater)
  {
    speciesId: 'coral_sardine',
    speciesName: 'Coral Sardine',
    waterZone: 'east_beach',
    rarity: 'Common',
    minWeightKg: 0.4,
    maxWeightKg: 1.8,
    baseCyonPerKg: 12,
    baseLulPerKg: 12,
    mintFeeLul: 0,
    suggestedRespitePrice: 5,
    dropWeight: 44,
    colorHex: '#38bdf8',
    loreTag: 'Schooling coastal fish found along the East Beach seawall.',
  },
  {
    speciesId: 'striped_mackerel',
    speciesName: 'Striped Mackerel',
    waterZone: 'east_beach',
    rarity: 'Common',
    minWeightKg: 0.9,
    maxWeightKg: 3.4,
    baseCyonPerKg: 14,
    baseLulPerKg: 14,
    mintFeeLul: 0,
    suggestedRespitePrice: 8,
    dropWeight: 30,
    colorHex: '#60a5fa',
    loreTag: 'Fast saltwater swimmer prized by Kai at the Beach Safezone.',
  },
  {
    speciesId: 'azure_reef_snapper',
    speciesName: 'Azure Reef Snapper',
    waterZone: 'east_beach',
    rarity: 'Uncommon',
    minWeightKg: 1.8,
    maxWeightKg: 6.2,
    baseCyonPerKg: 20,
    baseLulPerKg: 20,
    mintFeeLul: 0,
    suggestedRespitePrice: 15,
    dropWeight: 16,
    colorHex: '#2dd4bf',
    loreTag: 'Vibrant turquoise scales that shimmer under coastal sunlight.',
  },
  {
    speciesId: 'golden_harbor_tuna',
    speciesName: 'Golden Harbor Tuna',
    waterZone: 'east_beach',
    rarity: 'Rare',
    minWeightKg: 5.5,
    maxWeightKg: 16.0,
    baseCyonPerKg: 30,
    baseLulPerKg: 30,
    mintFeeLul: 0,
    suggestedRespitePrice: 28,
    dropWeight: 7,
    colorHex: '#facc15',
    loreTag: 'Deep-water trophy predator rarely venturing near the pier.',
  },
  {
    speciesId: 'nebula_coelacanth',
    speciesName: 'Nebula Coelacanth',
    waterZone: 'east_beach',
    rarity: 'Mythic',
    minWeightKg: 12.0,
    maxWeightKg: 34.0,
    baseCyonPerKg: 55,
    baseLulPerKg: 55,
    mintFeeLul: 0,
    suggestedRespitePrice: 60,
    dropWeight: 3,
    colorHex: '#c084fc',
    loreTag: 'Ancient bioluminescent relic of the East Trench. Collector NFT centerpiece.',
  },

  // 2. Central Oasis Lake (Freshwater Surprise Spot)
  {
    speciesId: 'oasis_silver_carp',
    speciesName: 'Oasis Silver Carp',
    waterZone: 'central_oasis',
    rarity: 'Common',
    minWeightKg: 0.6,
    maxWeightKg: 2.4,
    baseCyonPerKg: 12,
    baseLulPerKg: 12,
    mintFeeLul: 0,
    suggestedRespitePrice: 6,
    dropWeight: 42,
    colorHex: '#94a3b8',
    loreTag: 'Calm freshwater carp thriving in the Central Oasis basin.',
  },
  {
    speciesId: 'emerald_oasis_perch',
    speciesName: 'Emerald Perch',
    waterZone: 'central_oasis',
    rarity: 'Common',
    minWeightKg: 0.8,
    maxWeightKg: 3.1,
    baseCyonPerKg: 15,
    baseLulPerKg: 15,
    mintFeeLul: 0,
    suggestedRespitePrice: 8,
    dropWeight: 28,
    colorHex: '#4ade80',
    loreTag: 'Camouflaged among the lush green reeds of the central lake.',
  },
  {
    speciesId: 'sakura_nishikigoi',
    speciesName: 'Sakura Nishikigoi',
    waterZone: 'central_oasis',
    rarity: 'Uncommon',
    minWeightKg: 2.0,
    maxWeightKg: 6.8,
    baseCyonPerKg: 22,
    baseLulPerKg: 22,
    mintFeeLul: 0,
    suggestedRespitePrice: 16,
    dropWeight: 18,
    colorHex: '#fb7185',
    loreTag: 'Ornamental koi patterned like cherry blossoms.',
  },
  {
    speciesId: 'volt_fin_arapaima',
    speciesName: 'Volt-Fin Arapaima',
    waterZone: 'central_oasis',
    rarity: 'Rare',
    minWeightKg: 6.5,
    maxWeightKg: 19.5,
    baseCyonPerKg: 34,
    baseLulPerKg: 34,
    mintFeeLul: 0,
    suggestedRespitePrice: 32,
    dropWeight: 8,
    colorHex: '#38bdf8',
    loreTag: 'Apex freshwater giant charged by nearby wind-turbine currents.',
  },
  {
    speciesId: 'astral_dragon_arowana',
    speciesName: 'Astral Dragon Arowana',
    waterZone: 'central_oasis',
    rarity: 'Mythic',
    minWeightKg: 11.0,
    maxWeightKg: 29.0,
    baseCyonPerKg: 60,
    baseLulPerKg: 60,
    mintFeeLul: 0,
    suggestedRespitePrice: 65,
    dropWeight: 4,
    colorHex: '#f59e0b',
    loreTag: 'Legendary golden lake guardian sought by every collector on NEAR.',
  },
];

/**
 * Detects whether the player at `(worldX, worldZ)` is within casting range of ANY water body
 * (Central Oasis Lake or East Beach / Harbor shoreline).
 */
export function detectNearbyFishingWaterZone(
  worldX: number,
  worldZ: number,
): FishingWaterDetection {
  const lakeSdf = evaluateNwLakeSdf(worldX, worldZ);
  const { waterSdf } = evaluateSeHarborSdf(worldX, worldZ);

  const absLakeDist = Math.abs(lakeSdf);
  const absHarborDist = Math.abs(waterSdf);

  // 1. Central Oasis Lake shoreline (within 11.5m of water edge)
  if (lakeSdf <= 11.5) {
    return {
      canFish: true,
      zoneId: 'central_oasis',
      zoneLabel: 'Central Oasis Lake',
      distanceToWaterM: Number(Math.max(0, lakeSdf).toFixed(1)),
    };
  }

  // 2. East Beach & Harbor shoreline (within 18m of ocean edge or along the East Beach promenade x >= 78)
  if (waterSdf <= 18.0 || (worldX >= 78.0 && worldZ >= 42.0 && worldZ <= 106.0)) {
    return {
      canFish: true,
      zoneId: 'east_beach',
      zoneLabel: 'East Beach Shoreline',
      distanceToWaterM: Number(Math.max(0, waterSdf).toFixed(1)),
    };
  }

  return {
    canFish: false,
    zoneId: null,
    zoneLabel: null,
    distanceToWaterM: Number(Math.min(absLakeDist, absHarborDist).toFixed(1)),
  };
}

/**
 * Rolls a random caught fish for the given water zone (`central_oasis` or `east_beach`).
 */
export function rollRandomCaughtFish(params: {
  waterZone: FishingWaterZoneId;
  caughtByAccount: string;
  rng?: () => number;
}): CaughtFishItem {
  const rand = params.rng ?? Math.random;
  const pool = FISH_SPECIES_CATALOG.filter((s) => s.waterZone === params.waterZone);
  const totalWeight = pool.reduce((acc, s) => acc + s.dropWeight, 0);

  let roll = rand() * totalWeight;
  let chosen = pool[0];
  for (const spec of pool) {
    if (roll <= spec.dropWeight) {
      chosen = spec;
      break;
    }
    roll -= spec.dropWeight;
  }

  const weightSpan = chosen.maxWeightKg - chosen.minWeightKg;
  const rawWeight = chosen.minWeightKg + rand() * weightSpan;
  const weightKg = Number(rawWeight.toFixed(2));

  const rarityMultiplier =
    chosen.rarity === 'Mythic'
      ? 1.5
      : chosen.rarity === 'Rare'
        ? 1.25
        : chosen.rarity === 'Uncommon'
          ? 1.1
          : 1.0;

  const sellValueCyon = Math.max(
    10,
    Math.round(weightKg * chosen.baseCyonPerKg * rarityMultiplier),
  );

  const uniqueSuffix = Math.floor(100000 + rand() * 900000);

  return {
    id: `fish-${Date.now()}-${uniqueSuffix}`,
    speciesId: chosen.speciesId,
    speciesName: chosen.speciesName,
    waterZone: chosen.waterZone,
    waterZoneLabel:
      chosen.waterZone === 'central_oasis' ? 'Central Oasis Lake' : 'East Beach Shoreline',
    rarity: chosen.rarity,
    weightKg,
    sellValueCyon,
    sellValueLul: sellValueCyon,
    mintFeeLul: 0,
    suggestedRespitePrice: chosen.suggestedRespitePrice,
    colorHex: chosen.colorHex,
    loreTag: chosen.loreTag,
    caughtByAccount: params.caughtByAccount,
    caughtAtIso: new Date().toISOString(),
    isMintedNft: false,
    nftTokenId: null,
    nearTxHash: null,
  };
}

export const INITIAL_DEMO_FISH_MARKET_LISTINGS: FishNftMarketplaceListing[] = [
  {
    listingId: 'listing-genesis-1',
    nftTokenId: 'nep171-fish-golden_harbor_tuna-8841',
    speciesId: 'golden_harbor_tuna',
    speciesName: 'Golden Harbor Tuna',
    waterZone: 'east_beach',
    waterZoneLabel: 'East Beach Shoreline',
    rarity: 'Rare',
    weightKg: 13.45,
    colorHex: '#facc15',
    caughtByAccount: 'kai-angler.buddiesblitz.testnet',
    sellerNearAccount: 'kai-angler.buddiesblitz.testnet',
    priceRespite: 25,
    priceLul: 25,
    nearTxHash: '9fK2vL8xM1pQ4zW7nB3cR6tY5uJ8hG2dF4sA1eN',
    listedAtIso: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
  },
  {
    listingId: 'listing-genesis-2',
    nftTokenId: 'nep171-fish-astral_dragon_arowana-2049',
    speciesId: 'astral_dragon_arowana',
    speciesName: 'Astral Dragon Arowana',
    waterZone: 'central_oasis',
    waterZoneLabel: 'Central Oasis Lake',
    rarity: 'Mythic',
    weightKg: 24.8,
    colorHex: '#f59e0b',
    caughtByAccount: 'oasis-hunter.buddiesblitz.testnet',
    sellerNearAccount: 'oasis-hunter.buddiesblitz.testnet',
    priceRespite: 55,
    priceLul: 55,
    nearTxHash: '4xP9mN2vK7qL1wZ8cR5tY3uJ6hG9dF2sA7eB4nM',
    listedAtIso: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
  },
];
