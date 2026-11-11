/**
 * ============================================================================
 * BUDDIES BLITZ 3D — SHORELINE 60FPS WATER & FISHING ENGINE + KAI'S NFT MARKET
 * ============================================================================
 * Economy & Gameplay Rules (fishing loop adapted from the MIT-licensed Tidewater project
 * by Dan Greenheck / DRG Software Solutions LLC - see THIRD-PARTY-NOTICES.md):
 *   1. LUL is earned ONLY in the Warzone (high supply from combat & crates).
 *   2. Fishing at East Beach or Central Oasis Lake uses the adapted tactile loop:
 *      - Charge-to-Cast (0..100% power -> 8m..28m ballistic cast + 48-seg catenary line)
 *      - Habitat Depth + Time-of-Day activity curves ('day' | 'dawnDusk' | 'night' | 'any')
 *      - Two-Stage Bite Cues: 1..3 Preliminary Nibbles (gentle dip) -> Take! (deep plunge)
 *      - Line-Tension + Stamina + Periodic Fish Surge Minigame (Green Band [0.30..0.85] = 3.3x drain)
 *      - Skewed Weight Roll (`rng()^2.2`), FishBase Length (`W = a * L^b`), & Trophy Bonus (>70% max weight = +25% value)
 *   3. Post-Catch Options:
 *      - Option A (Direct Sale): Sell caught fish directly to Merchant Kai for CYON.
 *      - Option B (NFT Marketplace): Mint caught fish into a NEP-171 Fish NFT (with kg, cm, & Trophy metadata)
 *        and list it on Kai's P2P Marketplace for RESPITE.
 * ============================================================================
 */

import { evaluateNwLakeSdf, evaluateSeHarborSdf } from './buddiesPlanetCurvature';

export type FishingWaterZoneId = 'central_oasis' | 'east_beach';
export type FishRarityTier = 'Common' | 'Uncommon' | 'Rare' | 'Mythic';
export type FishTimePreference = 'day' | 'dawnDusk' | 'night' | 'any';
export type FishingPhaseState =
  | 'idle'
  | 'charging'
  | 'casting'
  | 'nibble'
  | 'bite'
  | 'fighting';

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
  /** Shoreline time-of-day activity preference ('day' | 'dawnDusk' | 'night' | 'any') */
  timePreference: FishTimePreference;
  /** Shoreline fight intensity (0.15 calm -> 0.92 apex predator) */
  fightStrength: number;
  /** FishBase length-weight power-law coefficient `a` (g / cm^b) */
  lwA: number;
  /** FishBase length-weight power-law exponent `b` (~3.0) */
  lwB: number;
  /** Optimal water depth in meters for habitat weighting */
  optimalDepthM: number;
}

export interface CaughtFishItem {
  id: string;
  speciesId: string;
  speciesName: string;
  waterZone: FishingWaterZoneId;
  waterZoneLabel: string;
  rarity: FishRarityTier;
  weightKg: number;
  lengthCm?: number;
  isTrophy?: boolean;
  castDistanceM?: number;
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
  lengthCm?: number;
  isTrophy?: boolean;
  colorHex: string;
  caughtByAccount: string;
  sellerNearAccount: string;
  priceRespite: number;
  priceLul: number;
  nearTxHash: string;
  listedAtIso: string;
}

/**
 * Shared 60 FPS analytical multi-cascade wave evaluator (adapted from the MIT-licensed
 * Tidewater project by Dan Greenheck / DRG Software Solutions LLC - see THIRD-PARTY-NOTICES.md).
 * Used by both the 3D floating bobber and water surface shaders so the bobber
 * tracks wave crests and troughs with zero GPU-to-CPU pipeline stalls.
 */
export interface ShorelineWaveSample {
  heightY: number;
  slopeX: number;
  slopeZ: number;
  jacobianFoam: number;
}

export function evaluateShorelineWaveHeight(
  worldX: number,
  worldZ: number,
  timeSec: number,
  zoneId: FishingWaterZoneId = 'east_beach',
): ShorelineWaveSample {
  const ampScale = zoneId === 'east_beach' ? 1.0 : 0.45;
  // Cascade 0: 73.3m primary swell
  const k0 = (2.0 * Math.PI) / 73.3;
  const p0 = worldX * k0 * 0.88 + worldZ * k0 * 0.47 + timeSec * 1.45;
  const w0 = Math.sin(p0) * 0.11 * ampScale;

  // Cascade 1: 15.7m wind wave
  const k1 = (2.0 * Math.PI) / 15.7;
  const p1 = worldX * k1 * 0.76 - worldZ * k1 * 0.65 + timeSec * 2.15;
  const w1 = Math.sin(p1) * 0.055 * ampScale;

  // Cascade 2: 3.33m chop
  const k2 = (2.0 * Math.PI) / 3.33;
  const p2 = -worldX * k2 * 0.54 + worldZ * k2 * 0.84 + timeSec * 3.1;
  const w2 = Math.cos(p2) * 0.022 * ampScale;

  // Cascade 3: 0.71m capillary ripple
  const k3 = (2.0 * Math.PI) / 0.71;
  const p3 = worldX * k3 * 0.62 + worldZ * k3 * 0.78 - timeSec * 4.2;
  const w3 = Math.sin(p3) * 0.006 * ampScale;

  const heightY = w0 + w1 + w2 + w3;
  const slopeX =
    Math.cos(p0) * k0 * 0.88 * 0.11 * ampScale +
    Math.cos(p1) * k1 * 0.76 * 0.055 * ampScale +
    Math.sin(p2) * k2 * 0.54 * 0.022 * ampScale;
  const slopeZ =
    Math.cos(p0) * k0 * 0.47 * 0.11 * ampScale -
    Math.cos(p1) * k1 * 0.65 * 0.055 * ampScale -
    Math.sin(p2) * k2 * 0.84 * 0.022 * ampScale;

  // Approximate Jacobian whitecap compression at wave crests
  const crestCompression = Math.max(0, Math.sin(p1) * 0.55 + Math.cos(p2) * 0.45 - 0.52);
  const jacobianFoam = Math.min(1, crestCompression * 2.1);

  return {
    heightY,
    slopeX,
    slopeZ,
    jacobianFoam,
  };
}

/**
 * Derives fish length in `cm` from weight in `kg` using FishBase power-law `W(g) = a * L^b`.
 */
export function computeLengthCmFromWeightKg(
  weightKg: number,
  lwA = 0.012,
  lwB = 3.02,
): number {
  const grams = Math.max(50, weightKg * 1000);
  const rawCm = Math.pow(grams / Math.max(0.001, lwA), 1 / Math.max(2.5, lwB));
  return Math.round(rawCm);
}

/**
 * Shoreline time-of-day activity multiplier (`Bites.js` TIME_CURVES adaptation).
 */
export function evaluateTimeOfDayFactor(
  preference: FishTimePreference,
  lightingPreset: 'day' | 'dusk' | 'night' | 'dawn' = 'day',
): number {
  if (preference === 'any') return 1.0;
  if (preference === 'day') {
    return lightingPreset === 'day' ? 1.25 : lightingPreset === 'night' ? 0.35 : 0.85;
  }
  if (preference === 'dawnDusk') {
    return lightingPreset === 'dawn' || lightingPreset === 'dusk'
      ? 1.45
      : lightingPreset === 'day'
        ? 0.75
        : 0.65;
  }
  if (preference === 'night') {
    return lightingPreset === 'night'
      ? 1.55
      : lightingPreset === 'dusk' || lightingPreset === 'dawn'
        ? 0.95
        : 0.28;
  }
  return 1.0;
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
    timePreference: 'day',
    fightStrength: 0.22,
    lwA: 0.0095,
    lwB: 3.04,
    optimalDepthM: 3.5,
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
    timePreference: 'any',
    fightStrength: 0.36,
    lwA: 0.0088,
    lwB: 3.08,
    optimalDepthM: 6.0,
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
    timePreference: 'dawnDusk',
    fightStrength: 0.54,
    lwA: 0.014,
    lwB: 3.02,
    optimalDepthM: 11.0,
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
    timePreference: 'dawnDusk',
    fightStrength: 0.76,
    lwA: 0.018,
    lwB: 3.0,
    optimalDepthM: 18.0,
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
    timePreference: 'night',
    fightStrength: 0.92,
    lwA: 0.016,
    lwB: 3.05,
    optimalDepthM: 24.0,
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
    timePreference: 'any',
    fightStrength: 0.24,
    lwA: 0.013,
    lwB: 3.02,
    optimalDepthM: 3.0,
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
    timePreference: 'day',
    fightStrength: 0.34,
    lwA: 0.012,
    lwB: 3.04,
    optimalDepthM: 5.0,
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
    timePreference: 'dawnDusk',
    fightStrength: 0.52,
    lwA: 0.015,
    lwB: 3.01,
    optimalDepthM: 8.5,
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
    timePreference: 'dawnDusk',
    fightStrength: 0.78,
    lwA: 0.0092,
    lwB: 3.06,
    optimalDepthM: 14.0,
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
    timePreference: 'night',
    fightStrength: 0.90,
    lwA: 0.011,
    lwB: 3.05,
    optimalDepthM: 19.0,
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
  // Never allow fishing inside Central Plaza (x <= -76.2)
  if (worldX <= -76.2) {
    return {
      canFish: false,
      zoneId: null,
      zoneLabel: null,
      distanceToWaterM: 999,
    };
  }

  const lakeSdf = evaluateNwLakeSdf(worldX, worldZ);
  const { waterSdf } = evaluateSeHarborSdf(worldX, worldZ);

  const absLakeDist = Math.abs(lakeSdf);
  const absHarborDist = Math.abs(waterSdf);

  // 1. Central Oasis Lake shoreline (within 6.5m of water edge)
  if (lakeSdf <= 6.5) {
    return {
      canFish: true,
      zoneId: 'central_oasis',
      zoneLabel: 'Central Oasis Lake',
      distanceToWaterM: Number(Math.max(0, lakeSdf).toFixed(1)),
    };
  }

  // 2. East Beach & Harbor shoreline (within 8.5m of ocean edge)
  if (waterSdf <= 8.5) {
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
 * Selects a fish species using Shoreline's habitat depth + time-of-day weighting (`Bites.js`).
 */
export function pickShorelineFishSpecies(params: {
  waterZone: FishingWaterZoneId;
  lightingPreset?: 'day' | 'dusk' | 'night' | 'dawn';
  castPower?: number;
  rng?: () => number;
}): FishSpeciesSpec {
  const rand = params.rng ?? Math.random;
  const castPower = Math.max(0, Math.min(1, params.castPower ?? 0.65));
  const simulatedDepthM = 2.5 + castPower * 22.0;
  const pool = FISH_SPECIES_CATALOG.filter((s) => s.waterZone === params.waterZone);

  const weights = pool.map((spec) => {
    const todFactor = evaluateTimeOfDayFactor(spec.timePreference, params.lightingPreset ?? 'day');
    // Longer casts into deeper water favor deeper-habitat Rare & Mythic species
    const depthDiff = Math.abs(simulatedDepthM - spec.optimalDepthM);
    const depthFactor = 0.55 + 0.75 * Math.exp(-(depthDiff * depthDiff) / 140);
    return Math.max(0.2, spec.dropWeight * todFactor * depthFactor);
  });

  const totalWeight = weights.reduce((acc, w) => acc + w, 0);
  let roll = rand() * totalWeight;
  for (let i = 0; i < pool.length; i++) {
    if (roll <= weights[i]) {
      return pool[i];
    }
    roll -= weights[i];
  }
  return pool[0];
}

/**
 * Rolls a caught fish using Shoreline's skewed weight curve (`t = rng()^2.2`),
 * FishBase length-weight power law (`W = a * L^b`), and Trophy bonus (`>70%` max weight = up to +25% value).
 */
export function rollRandomCaughtFish(params: {
  waterZone: FishingWaterZoneId;
  caughtByAccount: string;
  lightingPreset?: 'day' | 'dusk' | 'night' | 'dawn';
  castPower?: number;
  specificSpecies?: FishSpeciesSpec;
  rng?: () => number;
}): CaughtFishItem {
  const rand = params.rng ?? Math.random;
  const castPower = Math.max(0, Math.min(1, params.castPower ?? 0.65));
  const chosen =
    params.specificSpecies ??
    pickShorelineFishSpecies({
      waterZone: params.waterZone,
      lightingPreset: params.lightingPreset,
      castPower,
      rng: rand,
    });

  // Shoreline skewed weight roll (`t = Math.pow(rng(), 2.2)` shifted slightly by cast power)
  const skewExp = Math.max(1.45, 2.2 - castPower * 0.45);
  const weightRatio = Math.max(0, Math.min(1, Math.pow(rand(), skewExp)));
  const weightSpan = chosen.maxWeightKg - chosen.minWeightKg;
  const rawWeight = chosen.minWeightKg + weightRatio * weightSpan;
  const weightKg = Number(rawWeight.toFixed(2));
  const lengthCm = computeLengthCmFromWeightKg(weightKg, chosen.lwA, chosen.lwB);

  // Shoreline Trophy threshold: top 30% of species weight range (> 0.70) gets up to +25% bonus value
  const isTrophy = weightRatio >= 0.70;
  const trophyBonusMultiplier = isTrophy
    ? 1.0 + Math.min(1, (weightRatio - 0.70) / 0.30) * 0.25
    : 1.0;

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
    Math.round(weightKg * chosen.baseCyonPerKg * rarityMultiplier * trophyBonusMultiplier),
  );
  const suggestedRespitePrice = Math.max(
    1,
    Math.round(chosen.suggestedRespitePrice * trophyBonusMultiplier),
  );
  const castDistanceM = Number((8.0 + castPower * 20.0).toFixed(1));
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
    lengthCm,
    isTrophy,
    castDistanceM,
    sellValueCyon,
    sellValueLul: sellValueCyon,
    mintFeeLul: 0,
    suggestedRespitePrice,
    colorHex: chosen.colorHex,
    loreTag: chosen.loreTag,
    caughtByAccount: params.caughtByAccount,
    caughtAtIso: new Date().toISOString(),
    isMintedNft: false,
    nftTokenId: null,
    nearTxHash: null,
  };
}

/**
 * ============================================================================
 * SHORELINE TWO-STAGE BITE SCHEDULE & LINE-TENSION / STAMINA / SURGE MINIGAME
 * ============================================================================
 * Ported from Shoreline's `Game.js` (nibble -> take cues) and `CatchMinigame.js`.
 */
export interface ShorelineBiteSchedule {
  species: FishSpeciesSpec;
  castPower: number;
  castDistanceM: number;
  /** Calm floating wait on water (seconds) after bobber splashdown before first nibble */
  initialWaitSec: number;
  /** Interval (seconds) between preliminary bobber nibbles */
  nibbleIntervalSec: number;
  nibblesTotal: number;
  nibblesDone: number;
  strikeWindowSec: number;
}

export function createShorelineBiteSchedule(params: {
  waterZone: FishingWaterZoneId;
  lightingPreset?: 'day' | 'dusk' | 'night' | 'dawn';
  castPower?: number;
  rng?: () => number;
}): ShorelineBiteSchedule {
  const rand = params.rng ?? Math.random;
  const castPower = Math.max(0.15, Math.min(1, params.castPower ?? 0.7));
  const species = pickShorelineFishSpecies({
    waterZone: params.waterZone,
    lightingPreset: params.lightingPreset,
    castPower,
    rng: rand,
  });
  const initialWaitSec = Number((2.8 + rand() * 2.6).toFixed(2)); // 2.8s..5.4s calm float after splashdown
  const nibbleIntervalSec = Number((1.2 + rand() * 0.5).toFixed(2)); // 1.2s..1.7s per nibble
  const nibblesTotal = 2 + Math.floor(rand() * 3); // 2..4 preliminary nibbles before real bite
  const strikeWindowSec = Number((2.6 - species.fightStrength * 0.45).toFixed(2));
  const castDistanceM = Number((9.5 + castPower * 16.5).toFixed(1));
  return {
    species,
    castPower,
    castDistanceM,
    initialWaitSec,
    nibbleIntervalSec,
    nibblesTotal,
    nibblesDone: 0,
    strikeWindowSec,
  };
}

export interface ShorelineMinigameState {
  species: FishSpeciesSpec;
  castPower: number;
  /** Remaining line distance to land the fish (`<= 1.6` = landed at shore!) */
  distanceM: number;
  initialDistanceM: number;
  maxDistanceM: number;
  /** Normalized line tension (`0..1.2`; Green Sweet-Spot is `[0.30, 0.85]`; `>1.0` = Overload!) */
  tension: number;
  /** Green sweet-spot band `[0.30, 0.85]` where fish stamina drains at 3.3x rate */
  greenBand: [number, number];
  /** Fish remaining stamina (`1.0` fresh -> `0.0` exhausted) */
  stamina: number;
  /** True when the fish is executing a sudden high-pull surge run */
  isSurging: boolean;
  /** Current surge intensity (`0..1`) */
  surgeIntensity: number;
  timeToNextSurgeSec: number;
  surgeRemainingSec: number;
  /** Cumulative seconds spent above `tension > 1.0` (`>= 0.85s` snaps the line) */
  overloadSec: number;
  /** Cumulative seconds spent below `tension < 0.10` (`>= 5.5s` throws the hook) */
  slackSec: number;
  /** Progressive rod blank bend (`0..1`) for 3D vertex/rig animation */
  rodBend: number;
  /** Spinning reel crank rotation angle (radians) */
  reelAngle: number;
  status: 'active' | 'caught' | 'snapped' | 'escaped';
  statusReason: string | null;
}

export function createShorelineMinigameState(
  species: FishSpeciesSpec,
  castPower = 0.7,
): ShorelineMinigameState {
  const initialDistanceM = Number((10.5 + castPower * 11.5).toFixed(1));
  const fight = species.fightStrength;
  return {
    species,
    castPower,
    distanceM: initialDistanceM,
    initialDistanceM,
    maxDistanceM: Number((initialDistanceM + 22.0).toFixed(1)),
    tension: 0.42,
    greenBand: [0.30, 0.85],
    stamina: 1.0,
    isSurging: false,
    surgeIntensity: 0,
    timeToNextSurgeSec: 1.15 + (1 - fight) * 1.1,
    surgeRemainingSec: 0,
    overloadSec: 0,
    slackSec: 0,
    rodBend: 0.38,
    reelAngle: 0,
    status: 'active',
    statusReason: null,
  };
}

/**
 * Advances the Shoreline Line-Tension + Stamina + Surge fight minigame by `dt` seconds.
 * Requires reeling the fish all the way into shore (`distanceM <= 1.6m`) while managing surges.
 */
export function stepShorelineMinigame(
  state: ShorelineMinigameState,
  dt: number,
  isReeling: boolean,
  rng: () => number = Math.random,
): ShorelineMinigameState {
  if (state.status !== 'active') return state;
  const clampedDt = Math.min(dt, 0.1);
  const fight = state.species.fightStrength;
  const tired = 1 - state.stamina;

  // 1. Periodic fish surges (runs), weaker and rarer as stamina drops toward 0
  let timeToNextSurgeSec = state.timeToNextSurgeSec - clampedDt;
  let surgeRemainingSec = state.surgeRemainingSec;
  if (state.stamina > 0.08 && timeToNextSurgeSec <= 0 && surgeRemainingSec <= 0) {
    surgeRemainingSec = (0.9 + randRange(rng, 0, 0.95)) * (1 - tired * 0.55);
    timeToNextSurgeSec = (1.9 + randRange(rng, 0, 2.1)) * (1 + tired * 0.85);
  }
  if (surgeRemainingSec > 0) {
    surgeRemainingSec = Math.max(0, surgeRemainingSec - clampedDt);
  }
  const targetSurge = surgeRemainingSec > 0 && state.stamina > 0.05 ? 1 : 0;
  const surgeIntensity =
    state.surgeIntensity +
    (targetSurge - state.surgeIntensity) * (1 - Math.exp(-clampedDt * 6.0));
  const isSurging = surgeIntensity > 0.42;

  // 2. Fish pull and exponential tension relaxation
  const power = 0.54 + fight * 0.54;
  const pull = power * (0.34 + 0.66 * surgeIntensity) * (1 - 0.62 * tired);
  const targetTension = isReeling ? 0.48 + pull * 0.86 : Math.max(0.20, pull * 0.68);
  const rate = isReeling ? 2.4 : 3.2;
  const tension = Math.max(
    0,
    Math.min(1.18, state.tension + (targetTension - state.tension) * (1 - Math.exp(-clampedDt * rate))),
  );

  // 3. Stamina drains faster inside the Green Band [0.30, 0.85] over ~7.5s..15s
  const [bandLow, bandHigh] = state.greenBand;
  const inGreenBand = tension >= bandLow && tension <= bandHigh;
  const staminaMaxSec = 6.5 + fight * 9.0;
  const stamina = Math.max(
    0,
    state.stamina - (clampedDt / staminaMaxSec) * (inGreenBand ? 1.0 : 0.32),
  );

  // 4. Line in / out: fresh fish resists strongly; tired fish reels smoothly to shore
  const effectiveReelSpeedMps = 1.55 + tired * 2.25;
  const surgeResistance = 1.0 - 0.72 * surgeIntensity * (1 - tired * 0.65);
  const distanceDelta = isReeling
    ? -effectiveReelSpeedMps * clampedDt * Math.max(0.18, surgeResistance)
    : pull * 1.25 * clampedDt;
  const distanceM = Math.max(0, state.distanceM + distanceDelta);

  // 5. Overload & Slack outcomes
  const overloadSec =
    tension > 1.0
      ? state.overloadSec + clampedDt
      : Math.max(0, state.overloadSec - clampedDt * 1.8);
  const slackSec =
    tension < 0.12
      ? state.slackSec + clampedDt
      : Math.max(0, state.slackSec - clampedDt * 2.0);

  // 6. Progressive rod bend & spinning reel crank rotation
  const reelPumpWave = isReeling ? Math.sin(state.reelAngle * 0.5) * 0.08 : 0;
  const targetBend = Math.min(1, tension * 0.76 + surgeIntensity * 0.30 + reelPumpWave);
  const rodBend = state.rodBend + (targetBend - state.rodBend) * Math.min(1, clampedDt * 10);
  const reelAngle = state.reelAngle + (isReeling ? 14.0 : 1.1) * clampedDt;

  let status: ShorelineMinigameState['status'] = 'active';
  let statusReason: string | null = null;
  if (distanceM <= 1.6) {
    status = 'caught';
    statusReason = null;
  } else if (overloadSec > 0.85) {
    status = 'snapped';
    statusReason = 'Line snapped. Ease off when the fish pulls hard.';
  } else if (slackSec > 5.5 || distanceM > state.maxDistanceM) {
    status = 'escaped';
    statusReason = 'Fish escaped due to slack line.';
  }

  return {
    ...state,
    distanceM: Number(distanceM.toFixed(2)),
    tension: Number(tension.toFixed(3)),
    stamina: Number(stamina.toFixed(3)),
    isSurging,
    surgeIntensity: Number(surgeIntensity.toFixed(3)),
    timeToNextSurgeSec,
    surgeRemainingSec,
    overloadSec: Number(overloadSec.toFixed(3)),
    slackSec: Number(slackSec.toFixed(3)),
    rodBend: Number(rodBend.toFixed(3)),
    reelAngle,
    status,
    statusReason,
  };
}

function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

