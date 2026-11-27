import * as THREE from 'three';
import type { LightingPresetKey } from './buddiesBlitzRules';
import { CAFE_EXTERIOR_DOOR_TRIGGER } from './buddiesCafeRules';
import { CENTRAL_PARK_LAMPPOSTS, CENTRAL_PARK_MASTERPLAN } from './buddiesCentralParkRules';
import {
  CITY_LAMP_MANIFEST,
  EXISTING_CITY_LAMP_POOL_ANCHORS,
  computeCityIlluminationLevels,
  type CityIlluminationLevels,
  type CityLampSpec,
  type WeatherEnvStateContract,
} from './buddiesCityLightingAndTrafficRules';
import { FASHION_APPAREL_KIOSK_LAYOUT } from './buddiesFashionKioskRules';
import { GRAND_CASINO_MASTERPLAN } from './buddiesGrandCasinoRules';
import { computeInstancedBoundingVolumes } from './buddiesHubRenderOptimizer';
import { computePlanetYOffset, getTerrainElevation } from './buddiesPlanetCurvature';
import { REAL_ESTATE_FURNITURE_KIOSK_LAYOUT } from './buddiesRealEstateKioskRules';
import { URBAN_SCOOTER_SHOP_LAYOUT } from './buddiesUrbanScooterRules';

/**
 * Photometric & geometry clearance audit specifications for every real and virtual
 * `THREE.PointLight` / `THREE.SpotLight` family across the Buddies Blitz world.
 *
 * All downward-lit fixtures are offset `-0.22m .. -0.35m` below opaque caps, hoods,
 * or pendant shades so geometry never blocks or skews light distribution, and decay /
 * distance values are standardized for Three.js physical lighting with ACES Filmic
 * tone mapping (`exposure = 1.08`).
 */
export const POINT_LIGHT_AUDIT_SPECS = {
  spotLightCountInCodebase: 0,
  /** Indoor room rigs keep strictly 2 PointLights each (`castShadow = false`). */
  houseInterior: {
    ceilingFill: {
      position: [0.0, 3.58, 0.2] as const, // -0.24m below 3.82m ceiling luminaires / -0.42m below 4.0m ceiling
      capOffsetY: -0.24,
      colorHex: '#ffe8bc',
      distance: 16.0,
      decay: 1.25,
      baseIntensity: 0.58,
      lampBoostIntensity: 0.80,
    },
    warmLampAccent: {
      position: [-2.05, 1.92, -1.35] as const, // cleanly above sofa/tables & below 4.0m ceiling
      capOffsetY: -0.24,
      colorHex: '#ffc882',
      distance: 12.5,
      decay: 1.30,
      baseIntensity: 0.42,
      lampBoostIntensity: 0.88,
    },
  },
  cafeInterior: {
    counterWarmPt: {
      position: [-0.45, 2.08, -2.05] as const, // -0.27m below brass pendant dome shade rims (2.34..2.54m)
      capOffsetY: -0.27,
      colorHex: '#fde68a',
      intensity: 1.32,
      distance: 13.5,
      decay: 1.35,
    },
    wingWarmPt: {
      position: [4.45, 2.68, 7.45] as const, // below 3.85m eaves / hanging botanicals, centered over L-wing tables
      capOffsetY: -0.30,
      colorHex: '#fef3c7',
      intensity: 1.12,
      distance: 11.5,
      decay: 1.35,
    },
  },
  outdoorCategories: {
    city_tier1_bollard: {
      capOffsetY: -0.22,
      colorHex: '#ffd27d',
      baseIntensity: 1.10,
      distance: 6.5,
      decay: 1.65,
      poolRadius: 2.8,
      priorityWeight: 0.45,
    },
    city_tier2_pedestal: {
      capOffsetY: -0.24,
      colorHex: '#ffd37e',
      baseIntensity: 1.75,
      distance: 9.8,
      decay: 1.55,
      poolRadius: 4.8,
      priorityWeight: 0.78,
    },
    city_tier3_streetlamp: {
      capOffsetY: -0.30,
      colorHex: '#ffdc96',
      baseIntensity: 2.55,
      distance: 15.0,
      decay: 1.50,
      poolRadius: 9.2,
      priorityWeight: 1.0,
    },
    city_tier4_chandelier: {
      capOffsetY: -0.34,
      colorHex: '#ffd784',
      baseIntensity: 2.85,
      distance: 16.5,
      decay: 1.48,
      poolRadius: 11.4,
      priorityWeight: 1.12,
    },
    existing_vintage_lamp: {
      capOffsetY: -0.28,
      colorHex: '#ffd884',
      baseIntensity: 2.45,
      distance: 14.5,
      decay: 1.50,
      poolRadius: 8.5,
      priorityWeight: 1.02,
    },
    central_park_lamppost: {
      capOffsetY: -0.34,
      colorHex: '#ffd680',
      baseIntensity: 2.50,
      distance: 14.8,
      decay: 1.50,
      poolRadius: 8.8,
      priorityWeight: 1.05,
    },
    urban_plaza_storefront: {
      capOffsetY: -0.32,
      colorHex: '#ffe2a6',
      baseIntensity: 1.95,
      distance: 11.8,
      decay: 1.50,
      poolRadius: 7.4,
      priorityWeight: 0.96,
    },
    urban_plaza_fountain: {
      capOffsetY: -0.26,
      colorHex: '#ffe6b8',
      baseIntensity: 1.75,
      distance: 13.0,
      decay: 1.55,
      poolRadius: 7.2,
      priorityWeight: 0.92,
    },
    casino_entrance: {
      capOffsetY: -0.30,
      colorHex: '#ffdf92',
      baseIntensity: 2.75,
      distance: 15.5,
      decay: 1.48,
      poolRadius: 9.0,
      priorityWeight: 1.15,
    },
    arcade_kiosk_storefront: {
      capOffsetY: -0.30,
      colorHex: '#ffe3aa',
      baseIntensity: 1.90,
      distance: 11.5,
      decay: 1.52,
      poolRadius: 7.0,
      priorityWeight: 0.96,
    },
  },
} as const;

export type AuditedLightCategory = keyof typeof POINT_LIGHT_AUDIT_SPECS.outdoorCategories;

export const PROXIMITY_LIGHT_POOL_DEFAULTS = {
  /** Fixed real outdoor PointLight slots (`NUM_POINT_LIGHTS` stays constant -> 0 shader recompiles). */
  outdoorPoolSize: 4,
  /** Combined outdoor + laser PointLight ceiling (`FixedPointLightPool` uses up to 2). */
  maxCombinedWithLaser: 6,
  /** Maximum distance (meters) from focus point before an outdoor emitter smoothly reaches 0. */
  activationRangeM: 42.0,
  /** Fraction of `activationRangeM` where smooth Hermite fadeout begins (`0.64 * 42 = 26.88m`). */
  fadeStartRatio: 0.64,
  /** Hysteresis distance bonus (meters) keeping active slots stable when crossing cell midpoints. */
  hysteresisBonusM: 2.2,
  /** Exponential intensity smoothing rate (1/s) preventing popping or sudden flashes. */
  smoothingRatePerSec: 8.5,
  /** Focus jump threshold (meters) where camera cuts snap immediately instead of trailing. */
  teleportSnapDistanceM: 22.0,
} as const;

export interface AuditedProximityLightAnchor {
  readonly id: string;
  readonly category: AuditedLightCategory;
  readonly district: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly groundY: number;
  readonly capOffsetY: number;
  readonly colorHex: string;
  readonly baseIntensity: number;
  readonly distance: number;
  readonly decay: number;
  readonly poolRadius: number;
  readonly priorityWeight: number;
  /** True when `buddiesCityLightingAndTrafficBuilder` already renders its ground light pool. */
  readonly hasBuiltinGroundPool: boolean;
}

export interface ProximityLightFocusInput {
  readonly viewCenterX: number;
  readonly viewCenterZ: number;
  readonly cameraPos: { readonly x: number; readonly y: number; readonly z: number };
  readonly cameraLookDir?: { readonly x: number; readonly y: number; readonly z: number } | null;
  readonly activeUnitPos?: { readonly x: number; readonly z: number } | null;
  readonly isFullMapOverview?: boolean;
  readonly isParkView?: boolean;
  readonly isShowcaseMode?: boolean;
}

export interface ProximityLightUpdateInput {
  readonly focusPos: { readonly x: number; readonly y: number; readonly z: number };
  readonly dt: number;
  readonly timeSec: number;
  readonly weatherEnvState?: WeatherEnvStateContract | null;
  readonly fallbackPreset?: LightingPresetKey;
  readonly activeAllowed?: boolean;
  readonly activeLaserCount?: number;
  readonly isSoftwareGl?: boolean;
  readonly planetPivotX?: number;
  readonly planetPivotZ?: number;
  readonly curvatureStrength?: number;
}

export interface ProximityLightSlotSnapshot {
  readonly slotIndex: number;
  readonly anchorId: string | null;
  readonly intensity: number;
  readonly targetIntensity: number;
}

export interface ProximityLightFrameSnapshot {
  readonly poolSize: number;
  readonly activePointLightCount: number;
  readonly activeLaserCount: number;
  readonly totalActiveScenePointLights: number;
  readonly lampDrive01: number;
  readonly groundPoolOpacity01: number;
  readonly groundPoolVisible: boolean;
  readonly slots: readonly ProximityLightSlotSnapshot[];
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Computes a downward lamp PointLight offset strictly clamped inside `[-0.35, -0.22]` meters
 * below opaque lantern caps, hoods, or canopy soffits based on lantern cage height.
 */
export function computeOffsetBelowCapY(capBottomY: number, lanternCageHeightM: number): number {
  const offset = -clamp(0.22 + (lanternCageHeightM - 0.15) * 0.25, 0.22, 0.35);
  return Number((capBottomY + offset).toFixed(3));
}

/**
 * Smooth C1 Hermite cubic distance fadeout (`1` inside `fadeStartM`, smoothly rolling off to
 * `0` at `cutoffDistM`) eliminating hard circular cutoff edges or popping when entering range.
 */
export function computeSmoothCubicDistanceFade(
  distM: number,
  fadeStartM: number,
  cutoffDistM: number,
): number {
  if (cutoffDistM <= 0) return 0;
  if (distM <= fadeStartM) return 1;
  if (distM >= cutoffDistM) return 0;
  const span = Math.max(1e-4, cutoffDistM - fadeStartM);
  const t = clamp((distM - fadeStartM) / span, 0, 1);
  return 1 - t * t * (3 - 2 * t);
}

function smoothstepRange(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / Math.max(1e-5, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Computes outdoor lamp drive multiplier `[0 .. 2.5]` from `computeCityIlluminationLevels`
 * with a crisp daytime cutoff (`<= 0.05` -> `0`) and smooth Hermite dusk/storm ramp-in.
 */
export function computeProximityLampDrive01(levels: CityIlluminationLevels): number {
  const rawDrive = levels.streetLampBrightness01;
  if (rawDrive <= 0.05) return 0;
  return rawDrive * smoothstepRange(0.05, 0.22, rawDrive);
}

/**
 * Evaluates normalized outdoor lighting drive (`0` in clear daytime `nightFactor01 <= 0.05`,
 * smooth Hermite ramp through dusk/dawn/rain/fog/night).
 */
export function evaluateProximityOutdoorDrive(
  weatherEnvState: WeatherEnvStateContract | undefined | null,
  fallbackPreset: LightingPresetKey = 'day',
): { levels: CityIlluminationLevels; drive01: number } {
  const levels = computeCityIlluminationLevels(weatherEnvState, fallbackPreset);
  return { levels, drive01: computeProximityLampDrive01(levels) };
}

/**
 * Computes the camera/player focus point for outdoor proximity light selection across live play,
 * showcase views (`parkViewMode`), tours (`landing_tour` / `city_view`), and full-map overview.
 */
export function computeProximityCameraFocus(
  input: ProximityLightFocusInput,
  out: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
): { x: number; y: number; z: number } {
  if (input.isFullMapOverview || input.cameraPos.y >= 42) {
    out.x = input.cameraPos.x;
    out.y = input.cameraPos.y;
    out.z = input.cameraPos.z;
    return out;
  }
  if (input.isParkView && input.cameraLookDir) {
    const dirY = input.cameraLookDir.y;
    const reach = dirY < -0.05 ? clamp((2.5 - input.cameraPos.y) / dirY, 12.0, 48.0) : 22.0;
    const fx = input.cameraPos.x + input.cameraLookDir.x * reach;
    const fz = input.cameraPos.z + input.cameraLookDir.z * reach;
    const fy = Math.max(getTerrainElevation(fx, fz) + 2.2, input.cameraPos.y + dirY * reach);
    out.x = fx;
    out.y = fy;
    out.z = fz;
    return out;
  }
  if (!input.isShowcaseMode && input.activeUnitPos) {
    const fx = input.activeUnitPos.x * 0.72 + input.cameraPos.x * 0.28;
    const fz = input.activeUnitPos.z * 0.72 + input.cameraPos.z * 0.28;
    out.x = fx;
    out.y = getTerrainElevation(fx, fz) + 2.2;
    out.z = fz;
    return out;
  }
  out.x = input.viewCenterX;
  out.y = getTerrainElevation(input.viewCenterX, input.viewCenterZ) + 2.4;
  out.z = input.viewCenterZ;
  return out;
}

const CITY_TIER1_SCALE = 1.45;
const CITY_TIER2_SCALE = 1.52;
const CITY_TIER3_SCALE = 1.50;
const CITY_TIER4_SCALE = 1.55;
const PARK_LAMP_SCALE = 1.62;

function computeCityLampWorldAnchor(lamp: CityLampSpec): AuditedProximityLightAnchor {
  const cosR = Math.cos(lamp.rotY);
  const sinR = Math.sin(lamp.rotY);
  const rotateOffset = (dx: number, dz: number) => ({
    wx: lamp.x + dx * cosR + dz * sinR,
    wz: lamp.z - dx * sinR + dz * cosR,
  });

  if (lamp.tier === 1) {
    const spec = POINT_LIGHT_AUDIT_SPECS.outdoorCategories.city_tier1_bollard;
    const capBottomY = lamp.y + 0.382 * CITY_TIER1_SCALE;
    return {
      id: lamp.id,
      category: 'city_tier1_bollard',
      district: lamp.district,
      x: Number(lamp.x.toFixed(3)),
      y: computeOffsetBelowCapY(capBottomY, 0.14),
      z: Number(lamp.z.toFixed(3)),
      groundY: lamp.y,
      capOffsetY: spec.capOffsetY,
      colorHex: spec.colorHex,
      baseIntensity: spec.baseIntensity,
      distance: spec.distance,
      decay: spec.decay,
      poolRadius: spec.poolRadius,
      priorityWeight: spec.priorityWeight,
      hasBuiltinGroundPool: true,
    };
  }

  if (lamp.tier === 2) {
    const spec = POINT_LIGHT_AUDIT_SPECS.outdoorCategories.city_tier2_pedestal;
    const capBottomY = lamp.y + 1.69 * CITY_TIER2_SCALE;
    return {
      id: lamp.id,
      category: 'city_tier2_pedestal',
      district: lamp.district,
      x: Number(lamp.x.toFixed(3)),
      y: computeOffsetBelowCapY(capBottomY, 0.24),
      z: Number(lamp.z.toFixed(3)),
      groundY: lamp.y,
      capOffsetY: spec.capOffsetY,
      colorHex: spec.colorHex,
      baseIntensity: spec.baseIntensity,
      distance: spec.distance,
      decay: spec.decay,
      poolRadius: spec.poolRadius,
      priorityWeight: spec.priorityWeight,
      hasBuiltinGroundPool: true,
    };
  }

  if (lamp.tier === 3) {
    const spec = POINT_LIGHT_AUDIT_SPECS.outdoorCategories.city_tier3_streetlamp;
    const isCorner = lamp.lampVariant === 'corner';
    const localDx = (isCorner ? 0.62 : 0.0) * CITY_TIER3_SCALE;
    const localDz = (isCorner ? 0.62 : 1.28) * CITY_TIER3_SCALE;
    const { wx, wz } = rotateOffset(localDx, localDz);
    const hoodBottomY = lamp.y + 4.355 * CITY_TIER3_SCALE;
    return {
      id: lamp.id,
      category: 'city_tier3_streetlamp',
      district: lamp.district,
      x: Number(wx.toFixed(3)),
      y: computeOffsetBelowCapY(hoodBottomY, 0.36),
      z: Number(wz.toFixed(3)),
      groundY: lamp.y,
      capOffsetY: spec.capOffsetY,
      colorHex: spec.colorHex,
      baseIntensity: isCorner ? spec.baseIntensity * 1.08 : spec.baseIntensity,
      distance: isCorner ? spec.distance + 1.2 : spec.distance,
      decay: spec.decay,
      poolRadius: lamp.poolRadius,
      priorityWeight: isCorner ? spec.priorityWeight * 1.04 : spec.priorityWeight,
      hasBuiltinGroundPool: true,
    };
  }

  const spec = POINT_LIGHT_AUDIT_SPECS.outdoorCategories.city_tier4_chandelier;
  // Position cleanly below the 4 outer carriage lantern roofs (4.16 * 1.55 = 6.45m) and well above the 4.43m flower baskets
  const outerCapBottomY = lamp.y + 4.16 * CITY_TIER4_SCALE;
  return {
    id: lamp.id,
    category: 'city_tier4_chandelier',
    district: lamp.district,
    x: Number(lamp.x.toFixed(3)),
    y: computeOffsetBelowCapY(outerCapBottomY, 0.48),
    z: Number(lamp.z.toFixed(3)),
    groundY: lamp.y,
    capOffsetY: spec.capOffsetY,
    colorHex: spec.colorHex,
    baseIntensity: spec.baseIntensity,
    distance: spec.distance,
    decay: spec.decay,
    poolRadius: spec.poolRadius,
    priorityWeight: spec.priorityWeight,
    hasBuiltinGroundPool: true,
  };
}

/**
 * Builds the complete, deterministic manifest of all audited outdoor proximity emitters
 * across city streetlamps (`CITY_LAMP_MANIFEST` + `EXISTING_CITY_LAMP_POOL_ANCHORS`),
 * Central Park (`CENTRAL_PARK_LAMPPOSTS`), Urban Plaza boutiques/cafes/fountain,
 * Grand Casino entrance, West Plaza Arcade, Municipal Hall, and Glasshouse Cafe exterior.
 */
export function buildAuditedOutdoorLightManifest(): readonly AuditedProximityLightAnchor[] {
  const anchors: AuditedProximityLightAnchor[] = [];

  // 1. City Streetlamps (Tiers 1..4)
  for (const lamp of CITY_LAMP_MANIFEST) {
    anchors.push(computeCityLampWorldAnchor(lamp));
  }

  // 2. Existing Static Plaza, Grand Casino, and SE Beach Walkway Lamps (matching builder dedupe < 2.2m)
  const existingSpec = POINT_LIGHT_AUDIT_SPECS.outdoorCategories.existing_vintage_lamp;
  for (const anchor of EXISTING_CITY_LAMP_POOL_ANCHORS) {
    let tooClose = false;
    for (const lamp of CITY_LAMP_MANIFEST) {
      if (Math.hypot(anchor.x - lamp.x, anchor.z - lamp.z) < 2.2) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const isBeach = anchor.id.includes('beach_lamp');
    const isCasino = anchor.id.includes('casino');
    // Beach lamps extend East to x = 76.48 with head bottom at y = 4.925m
    const wx = isBeach ? 76.48 : anchor.x;
    const capBottomY = isBeach
      ? 4.925
      : isCasino
        ? anchor.y + 4.61
        : anchor.y + 3.91;
    anchors.push({
      id: anchor.id,
      category: 'existing_vintage_lamp',
      district: isBeach ? 'se_beach' : isCasino ? 'grand_casino' : 'central_plaza',
      x: Number(wx.toFixed(3)),
      y: computeOffsetBelowCapY(capBottomY, isBeach ? 0.30 : 0.44),
      z: Number(anchor.z.toFixed(3)),
      groundY: anchor.y,
      capOffsetY: existingSpec.capOffsetY,
      colorHex: isBeach ? '#ffe4a4' : existingSpec.colorHex,
      baseIntensity: isBeach ? 2.25 : existingSpec.baseIntensity,
      distance: isBeach ? 13.5 : existingSpec.distance,
      decay: existingSpec.decay,
      poolRadius: anchor.poolRadius,
      priorityWeight: existingSpec.priorityWeight,
      hasBuiltinGroundPool: true,
    });
  }

  // 3. Central Park / Urban Plaza 10 Ornate Hanging-Basket Bronze Lampposts
  const parkLampSpec = POINT_LIGHT_AUDIT_SPECS.outdoorCategories.central_park_lamppost;
  for (const lamp of CENTRAL_PARK_LAMPPOSTS) {
    const capBottomY = 0.02 + 3.91 * PARK_LAMP_SCALE; // 6.354m
    anchors.push({
      id: lamp.id,
      category: 'central_park_lamppost',
      district: 'urban_plaza',
      x: Number(lamp.x.toFixed(3)),
      y: computeOffsetBelowCapY(capBottomY, 0.44 * PARK_LAMP_SCALE), // 6.004m (-0.35m below cap)
      z: Number(lamp.z.toFixed(3)),
      groundY: 0.064,
      capOffsetY: parkLampSpec.capOffsetY,
      colorHex: parkLampSpec.colorHex,
      baseIntensity: parkLampSpec.baseIntensity,
      distance: parkLampSpec.distance,
      decay: parkLampSpec.decay,
      poolRadius: parkLampSpec.poolRadius,
      priorityWeight: parkLampSpec.priorityWeight,
      hasBuiltinGroundPool: false,
    });
  }

  // 4. Urban Plaza Boutique Tower, Cozy Bites Cafe Pavilion, Beauty Salon, and Civic Cascade Fountain
  const bt = CENTRAL_PARK_MASTERPLAN.boutiqueTower;
  const cf = CENTRAL_PARK_MASTERPLAN.cozyCafePavilion;
  const ftn = CENTRAL_PARK_MASTERPLAN.fountainPlaza;
  const plazaShopSpec = POINT_LIGHT_AUDIT_SPECS.outdoorCategories.urban_plaza_storefront;
  const ftnSpec = POINT_LIGHT_AUDIT_SPECS.outdoorCategories.urban_plaza_fountain;

  const urbanPlazaLandmarks: Array<{
    id: string;
    category: AuditedLightCategory;
    x: number;
    y: number;
    z: number;
    groundY: number;
    colorHex: string;
    baseIntensity: number;
    distance: number;
    decay: number;
    poolRadius: number;
    priorityWeight: number;
  }> = [
    {
      id: 'urban_plaza_boutique_front',
      category: 'urban_plaza_storefront',
      x: bt.x + 6.45, // directly outside East storefront entrance below 3.82m awning
      y: 3.35,
      z: bt.z,
      groundY: 0.064,
      colorHex: plazaShopSpec.colorHex,
      baseIntensity: plazaShopSpec.baseIntensity,
      distance: plazaShopSpec.distance,
      decay: plazaShopSpec.decay,
      poolRadius: plazaShopSpec.poolRadius,
      priorityWeight: plazaShopSpec.priorityWeight,
    },
    {
      id: 'urban_plaza_boutique_south',
      category: 'urban_plaza_storefront',
      x: bt.x,
      y: 3.35,
      z: bt.z + 6.25,
      groundY: 0.064,
      colorHex: plazaShopSpec.colorHex,
      baseIntensity: plazaShopSpec.baseIntensity * 0.9,
      distance: plazaShopSpec.distance,
      decay: plazaShopSpec.decay,
      poolRadius: 6.8,
      priorityWeight: plazaShopSpec.priorityWeight * 0.92,
    },
    {
      id: 'urban_plaza_cozy_cafe_west',
      category: 'urban_plaza_storefront',
      x: cf.x - 4.75, // -0.24m below wall sconce hats & below front awning over bistro patio
      y: 2.68,
      z: cf.z,
      groundY: 0.064,
      colorHex: '#ffdca0',
      baseIntensity: plazaShopSpec.baseIntensity,
      distance: 11.4,
      decay: plazaShopSpec.decay,
      poolRadius: 7.5,
      priorityWeight: plazaShopSpec.priorityWeight,
    },
    {
      id: 'urban_plaza_cozy_cafe_south',
      category: 'urban_plaza_storefront',
      x: cf.x,
      y: 2.68,
      z: cf.z + 4.65,
      groundY: 0.064,
      colorHex: '#ffdca0',
      baseIntensity: plazaShopSpec.baseIntensity * 0.9,
      distance: 11.0,
      decay: plazaShopSpec.decay,
      poolRadius: 6.8,
      priorityWeight: plazaShopSpec.priorityWeight * 0.92,
    },
    {
      id: 'urban_plaza_beauty_salon_front',
      category: 'urban_plaza_storefront',
      x: 25.74, // directly outside North front doorway beneath 3.33m cream awning
      y: 3.25,
      z: 8.12,
      groundY: 0.064,
      colorHex: '#ffe4b4',
      baseIntensity: plazaShopSpec.baseIntensity,
      distance: 11.4,
      decay: plazaShopSpec.decay,
      poolRadius: 7.4,
      priorityWeight: plazaShopSpec.priorityWeight,
    },
    {
      id: 'urban_plaza_beauty_salon_corner',
      category: 'urban_plaza_storefront',
      x: 36.45, // outside East curved storefront panoramic display
      y: 3.25,
      z: 13.35,
      groundY: 0.064,
      colorHex: '#ffe4b4',
      baseIntensity: plazaShopSpec.baseIntensity * 0.92,
      distance: 11.0,
      decay: plazaShopSpec.decay,
      poolRadius: 6.8,
      priorityWeight: plazaShopSpec.priorityWeight * 0.94,
    },
    {
      id: 'urban_plaza_fountain_pool',
      category: 'urban_plaza_fountain',
      x: ftn.x,
      y: 2.10,
      z: ftn.z,
      groundY: 0.34,
      colorHex: ftnSpec.colorHex,
      baseIntensity: ftnSpec.baseIntensity,
      distance: ftnSpec.distance,
      decay: ftnSpec.decay,
      poolRadius: ftnSpec.poolRadius,
      priorityWeight: ftnSpec.priorityWeight,
    },
  ];
  for (const lm of urbanPlazaLandmarks) {
    anchors.push({
      ...lm,
      district: 'urban_plaza',
      capOffsetY: POINT_LIGHT_AUDIT_SPECS.outdoorCategories[lm.category].capOffsetY,
      hasBuiltinGroundPool: false,
    });
  }

  // 5. Grand Casino Porte-Cochere Chandelier & Lobby Entrance Sconces
  const casinoSpec = POINT_LIGHT_AUDIT_SPECS.outdoorCategories.casino_entrance;
  anchors.push(
    {
      id: 'casino_porte_cochere_chandelier',
      category: 'casino_entrance',
      district: 'grand_casino',
      x: -73.5,
      y: computeOffsetBelowCapY(4.54, 0.38), // -0.28m below lowest chandelier drop (4.54m)
      z: GRAND_CASINO_MASTERPLAN.centerZ,
      groundY: 0.125,
      capOffsetY: casinoSpec.capOffsetY,
      colorHex: casinoSpec.colorHex,
      baseIntensity: casinoSpec.baseIntensity,
      distance: casinoSpec.distance,
      decay: casinoSpec.decay,
      poolRadius: casinoSpec.poolRadius,
      priorityWeight: casinoSpec.priorityWeight,
      hasBuiltinGroundPool: false,
    },
    {
      id: 'casino_grand_doors_entry',
      category: 'casino_entrance',
      district: 'grand_casino',
      x: -77.1,
      y: computeOffsetBelowCapY(3.62, 0.36), // -0.27m below twin bronze coach lantern sconces (3.62m)
      z: GRAND_CASINO_MASTERPLAN.centerZ,
      groundY: 0.125,
      capOffsetY: casinoSpec.capOffsetY,
      colorHex: '#ffe39e',
      baseIntensity: 2.35,
      distance: 13.2,
      decay: 1.5,
      poolRadius: 7.4,
      priorityWeight: 1.08,
      hasBuiltinGroundPool: false,
    },
  );

  // 6. West Plaza Commercial Arcade Storefronts (Fashion, Real Estate, Scooter), Municipal Hall & Glasshouse Cafe
  const arcadeSpec = POINT_LIGHT_AUDIT_SPECS.outdoorCategories.arcade_kiosk_storefront;
  const plazaArcadeBays = [
    {
      id: 'arcade_storefront_fashion',
      x: FASHION_APPAREL_KIOSK_LAYOUT.worldCenterX + 3.35, // -103.00m on cobblestone apron outside glass
      y: computeOffsetBelowCapY(FASHION_APPAREL_KIOSK_LAYOUT.worldBaseY + 4.08, 0.38),
      z: FASHION_APPAREL_KIOSK_LAYOUT.worldCenterZ,
      colorHex: '#ffe4ad',
    },
    {
      id: 'arcade_storefront_realestate',
      x: REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.worldCenterX + 3.35,
      y: computeOffsetBelowCapY(REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.worldBaseY + 4.08, 0.38),
      z: REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.worldCenterZ,
      colorHex: '#ffe1a4',
    },
    {
      id: 'arcade_storefront_scooter',
      x: URBAN_SCOOTER_SHOP_LAYOUT.worldCenterX + 3.35,
      y: computeOffsetBelowCapY(URBAN_SCOOTER_SHOP_LAYOUT.worldBaseY + 4.08, 0.38),
      z: URBAN_SCOOTER_SHOP_LAYOUT.worldCenterZ,
      colorHex: '#e6f4ff',
    },
  ];
  for (const bay of plazaArcadeBays) {
    anchors.push({
      id: bay.id,
      category: 'arcade_kiosk_storefront',
      district: 'central_plaza',
      x: Number(bay.x.toFixed(3)),
      y: bay.y,
      z: Number(bay.z.toFixed(3)),
      groundY: 2.565,
      capOffsetY: arcadeSpec.capOffsetY,
      colorHex: bay.colorHex,
      baseIntensity: arcadeSpec.baseIntensity,
      distance: arcadeSpec.distance,
      decay: arcadeSpec.decay,
      poolRadius: arcadeSpec.poolRadius,
      priorityWeight: arcadeSpec.priorityWeight,
      hasBuiltinGroundPool: false,
    });
  }

  anchors.push(
    {
      id: 'municipal_hall_portico',
      category: 'arcade_kiosk_storefront',
      district: 'central_plaza',
      x: -93.55,
      y: 5.25,
      z: -25.4,
      groundY: 2.565,
      capOffsetY: arcadeSpec.capOffsetY,
      colorHex: '#ffe09c',
      baseIntensity: 2.10,
      distance: 12.8,
      decay: 1.5,
      poolRadius: 7.6,
      priorityWeight: 1.0,
      hasBuiltinGroundPool: false,
    },
    {
      id: 'glasshouse_cafe_exterior_porch',
      category: 'arcade_kiosk_storefront',
      district: 'glasshouse_cafe',
      x: CAFE_EXTERIOR_DOOR_TRIGGER.x,
      y: 4.95,
      z: 21.8,
      groundY: 2.565,
      capOffsetY: arcadeSpec.capOffsetY,
      colorHex: '#ffe2a4',
      baseIntensity: 1.95,
      distance: 11.8,
      decay: 1.5,
      poolRadius: 7.4,
      priorityWeight: 0.96,
      hasBuiltinGroundPool: false,
    },
  );

  return anchors;
}

function createSmoothSupplementalGroundPoolTexture(): THREE.Texture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const center = (size - 1) * 0.5;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x - center) / center;
      const ny = (y - center) / center;
      const r = Math.min(1, Math.hypot(nx, ny));
      // Smooth Gaussian-like core + C1 cubic boundary fadeout -> zero polygon edge rings
      const edgeFade = 1 - smoothstepRange(0.55, 1.0, r);
      const core = Math.pow(1 - r, 2.1);
      const alpha = clamp(core * edgeFade * 0.88, 0, 1);
      const warmMix = clamp(1 - r * 0.8, 0, 1);
      const idx = (y * size + x) * 4;
      data[idx] = Math.round(246 + 9 * warmMix);
      data[idx + 1] = Math.round(176 + 60 * warmMix);
      data[idx + 2] = Math.round(74 + 104 * warmMix);
      data[idx + 3] = Math.round(alpha * 255);
    }
  }

  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const img = ctx.createImageData(size, size);
      img.data.set(data);
      ctx.putImageData(img, 0, 0);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    }
  }

  const fallback = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  fallback.colorSpace = THREE.SRGBColorSpace;
  fallback.magFilter = THREE.LinearFilter;
  fallback.minFilter = THREE.LinearFilter;
  fallback.needsUpdate = true;
  return fallback;
}

interface PoolSlotState {
  light: THREE.PointLight;
  assignedAnchorIndex: number;
  currentIntensity: number;
  targetIntensity: number;
  pendingAnchorIndex: number;
  pendingTargetIntensity: number;
}

interface CandidateScore {
  anchorIndex: number;
  scoreDist: number;
  rawDist: number;
}

export interface ProximityPointLightManagerOptions {
  poolSize?: number;
  maxCombinedWithLaser?: number;
  activationRangeM?: number;
  fadeStartRatio?: number;
  hysteresisBonusM?: number;
  smoothingRatePerSec?: number;
  anchors?: readonly AuditedProximityLightAnchor[];
  createGroundPools?: boolean;
}

/**
 * Fixed-slot outdoor `THREE.PointLight` pool + GPU-instanced supplemental ground light pools.
 *
 * Pre-allocates `poolSize` (default `4`) outdoor `THREE.PointLight` instances once at scene
 * startup (`castShadow = false`, unused slots set to `intensity = 0`) so `NUM_POINT_LIGHTS`
 * never mutates and WebGL never stalls on runtime shader recompilations.
 */
export class ProximityPointLightManager {
  public readonly lights: THREE.PointLight[] = [];
  public readonly anchors: readonly AuditedProximityLightAnchor[];
  public readonly groundPoolMesh: THREE.InstancedMesh | null = null;

  private readonly scene: THREE.Scene;
  private readonly maxCombinedWithLaser: number;
  private readonly activationRangeM: number;
  private readonly fadeStartM: number;
  private readonly hysteresisBonusM: number;
  private readonly smoothingRatePerSec: number;
  private readonly slots: PoolSlotState[] = [];
  private readonly anchorToSlotIndex: Int16Array;
  private readonly selectedIndices: Int16Array;
  private readonly selectedRawDists: Float32Array;
  private readonly selectedTargets: Float32Array;
  private readonly slotRetained: Uint8Array;
  private readonly candidateMatched: Uint8Array;
  private readonly mutableSlotSnapshots: Array<{
    slotIndex: number;
    anchorId: string | null;
    intensity: number;
    targetIntensity: number;
  }>;
  private readonly topCandidates: CandidateScore[] = [];
  private readonly supplementalAnchors: AuditedProximityLightAnchor[] = [];
  private readonly groundPoolMat: THREE.MeshBasicMaterial | null = null;
  private readonly groundPoolGeo: THREE.BufferGeometry | null = null;
  private readonly groundPoolTex: THREE.Texture | null = null;
  private readonly tmpMatrix = new THREE.Matrix4();
  private readonly tmpPos = new THREE.Vector3();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpScale = new THREE.Vector3();
  private lastFocusX = Number.NaN;
  private lastFocusY = Number.NaN;
  private lastFocusZ = Number.NaN;
  private lastCurveKey = Number.NaN;

  constructor(scene: THREE.Scene, options?: ProximityPointLightManagerOptions) {
    this.scene = scene;
    const poolSize = Math.max(1, options?.poolSize ?? PROXIMITY_LIGHT_POOL_DEFAULTS.outdoorPoolSize);
    this.maxCombinedWithLaser = Math.max(
      poolSize,
      options?.maxCombinedWithLaser ?? PROXIMITY_LIGHT_POOL_DEFAULTS.maxCombinedWithLaser,
    );
    this.activationRangeM = Math.max(
      4.0,
      options?.activationRangeM ?? PROXIMITY_LIGHT_POOL_DEFAULTS.activationRangeM,
    );
    const fadeStartRatio = clamp(
      options?.fadeStartRatio ?? PROXIMITY_LIGHT_POOL_DEFAULTS.fadeStartRatio,
      0.1,
      0.95,
    );
    this.fadeStartM = this.activationRangeM * fadeStartRatio;
    this.hysteresisBonusM = Math.max(
      0,
      options?.hysteresisBonusM ?? PROXIMITY_LIGHT_POOL_DEFAULTS.hysteresisBonusM,
    );
    this.smoothingRatePerSec = Math.max(
      0.5,
      options?.smoothingRatePerSec ?? PROXIMITY_LIGHT_POOL_DEFAULTS.smoothingRatePerSec,
    );

    this.anchors = options?.anchors ?? buildAuditedOutdoorLightManifest();
    this.anchorToSlotIndex = new Int16Array(this.anchors.length).fill(-1);
    this.selectedIndices = new Int16Array(poolSize).fill(-1);
    this.selectedRawDists = new Float32Array(poolSize);
    this.selectedTargets = new Float32Array(poolSize);
    this.slotRetained = new Uint8Array(poolSize);
    this.candidateMatched = new Uint8Array(poolSize);
    this.mutableSlotSnapshots = Array.from({ length: poolSize }, (_, slotIndex) => ({
      slotIndex,
      anchorId: null,
      intensity: 0,
      targetIntensity: 0,
    }));
    for (let i = 0; i < poolSize; i++) {
      this.topCandidates.push({ anchorIndex: -1, scoreDist: Infinity, rawDist: Infinity });
    }

    for (let i = 0; i < poolSize; i++) {
      const pt = new THREE.PointLight('#ffda8e', 0, 14.5, 1.5);
      pt.name = `ProximityOutdoorPointLight_${i}`;
      pt.castShadow = false;
      scene.add(pt);
      this.lights.push(pt);
      this.slots.push({
        light: pt,
        assignedAnchorIndex: -1,
        currentIntensity: 0,
        targetIntensity: 0,
        pendingAnchorIndex: -1,
        pendingTargetIntensity: 0,
      });
    }

    if (options?.createGroundPools !== false) {
      for (const anchor of this.anchors) {
        if (!anchor.hasBuiltinGroundPool) {
          this.supplementalAnchors.push(anchor);
        }
      }
      if (this.supplementalAnchors.length > 0) {
        const tex = createSmoothSupplementalGroundPoolTexture();
        const geo = new THREE.PlaneGeometry(1, 1);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({
          map: tex,
          color: '#ffcf76',
          transparent: true,
          opacity: 0.0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
          toneMapped: false,
        });
        const inst = new THREE.InstancedMesh(geo, mat, this.supplementalAnchors.length);
        inst.name = 'ProximitySupplementalGroundLightPools';
        inst.renderOrder = 1;
        inst.visible = false;
        this.groundPoolTex = tex;
        this.groundPoolGeo = geo;
        this.groundPoolMat = mat;
        this.groundPoolMesh = inst;
        this.syncGroundPoolMatrices(0, 0, 0);
        scene.add(inst);
      }
    }
  }

  private syncGroundPoolMatrices(
    planetPivotX: number,
    planetPivotZ: number,
    curvatureStrength: number,
  ): void {
    if (!this.groundPoolMesh) return;
    const curveKey =
      curvatureStrength === 0
        ? 0
        : Math.round(planetPivotX * 10) * 1e5 + Math.round(planetPivotZ * 10);
    if (curveKey === this.lastCurveKey) return;
    this.lastCurveKey = curveKey;

    for (let i = 0; i < this.supplementalAnchors.length; i++) {
      const a = this.supplementalAnchors[i];
      const yOff =
        curvatureStrength === 0
          ? 0
          : computePlanetYOffset(a.x, a.z, planetPivotX, planetPivotZ, curvatureStrength);
      const diam = a.poolRadius * 2;
      this.tmpPos.set(a.x, a.groundY + yOff, a.z);
      this.tmpScale.set(diam, 1, diam);
      this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
      this.groundPoolMesh.setMatrixAt(i, this.tmpMatrix);
    }
    this.groundPoolMesh.instanceMatrix.needsUpdate = true;
    computeInstancedBoundingVolumes(this.groundPoolMesh, { padding: 0.5, frustumCulled: true });
  }

  private applyAnchorToSlot(slot: PoolSlotState, anchorIndex: number): void {
    const a = this.anchors[anchorIndex];
    slot.light.position.set(a.x, a.y, a.z);
    slot.light.color.set(a.colorHex);
    slot.light.distance = a.distance;
    slot.light.decay = a.decay;
    slot.assignedAnchorIndex = anchorIndex;
  }

  private zeroAllSlotsImmediate(): void {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      slot.currentIntensity = 0;
      slot.targetIntensity = 0;
      slot.pendingAnchorIndex = -1;
      slot.pendingTargetIntensity = 0;
      slot.light.intensity = 0;
      if (slot.assignedAnchorIndex >= 0) {
        this.anchorToSlotIndex[slot.assignedAnchorIndex] = -1;
        slot.assignedAnchorIndex = -1;
      }
    }
  }

  /**
   * Selects the nearest active emitters to `focusPos` with hysteresis, coordinates with
   * `FixedPointLightPool`, smoothly lerps per-slot intensities, and updates supplemental ground pools.
   */
  update(input: ProximityLightUpdateInput): ProximityLightFrameSnapshot {
    const activeAllowed = input.activeAllowed !== false;
    const dt = clamp(Number.isFinite(input.dt) ? input.dt : 0.016, 0, 0.25);
    const { levels, drive01 } = evaluateProximityOutdoorDrive(
      input.weatherEnvState,
      input.fallbackPreset ?? 'day',
    );

    if (this.groundPoolMesh && this.groundPoolMat) {
      if (activeAllowed && levels.groundPoolOpacity01 > 0.01) {
        this.syncGroundPoolMatrices(
          input.planetPivotX ?? 0,
          input.planetPivotZ ?? 0,
          input.curvatureStrength ?? 0,
        );
        const shimmer = 0.96 + 0.04 * Math.sin(input.timeSec * 2.4);
        this.groundPoolMat.opacity = clamp(levels.groundPoolOpacity01 * 0.66 * shimmer, 0, 0.84);
        this.groundPoolMesh.visible = true;
      } else {
        this.groundPoolMesh.visible = false;
      }
    }

    const activeLaserCount = Math.max(0, input.activeLaserCount ?? 0);
    const maxSlotsAllowed = input.isSoftwareGl
      ? Math.min(2, this.slots.length)
      : Math.min(this.slots.length, Math.max(0, this.maxCombinedWithLaser - activeLaserCount));

    if (!activeAllowed || drive01 <= 0 || maxSlotsAllowed <= 0 || this.anchors.length === 0) {
      if (!activeAllowed) {
        this.zeroAllSlotsImmediate();
      } else {
        const fadeStep = 1 - Math.exp(-this.smoothingRatePerSec * 1.4 * dt);
        for (let i = 0; i < this.slots.length; i++) {
          const slot = this.slots[i];
          slot.targetIntensity = 0;
          slot.pendingAnchorIndex = -1;
          slot.currentIntensity += (0 - slot.currentIntensity) * fadeStep;
          if (slot.currentIntensity < 0.004) {
            slot.currentIntensity = 0;
            if (slot.assignedAnchorIndex >= 0) {
              this.anchorToSlotIndex[slot.assignedAnchorIndex] = -1;
              slot.assignedAnchorIndex = -1;
            }
          }
          slot.light.intensity = slot.currentIntensity;
        }
      }
      return this.buildSnapshot(activeLaserCount, drive01, levels.groundPoolOpacity01);
    }

    const focusX = input.focusPos.x;
    const focusY = input.focusPos.y;
    const focusZ = input.focusPos.z;
    const focusJump =
      Number.isNaN(this.lastFocusX) ||
      Math.hypot(focusX - this.lastFocusX, focusY - this.lastFocusY, focusZ - this.lastFocusZ) >=
        PROXIMITY_LIGHT_POOL_DEFAULTS.teleportSnapDistanceM;
    this.lastFocusX = focusX;
    this.lastFocusY = focusY;
    this.lastFocusZ = focusZ;

    // Reset fixed candidate slots (no heap allocations per frame)
    for (let k = 0; k < maxSlotsAllowed; k++) {
      this.topCandidates[k].anchorIndex = -1;
      this.topCandidates[k].scoreDist = Infinity;
      this.topCandidates[k].rawDist = Infinity;
    }

    const rangeSqMax = (this.activationRangeM + 2.0) * (this.activationRangeM + 2.0);
    for (let i = 0; i < this.anchors.length; i++) {
      const a = this.anchors[i];
      const dx = a.x - focusX;
      const dy = (a.y - focusY) * 0.45; // prioritize horizontal proximity on multi-level plazas
      const dz = a.z - focusZ;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq > rangeSqMax) continue;

      const rawDist = Math.sqrt(distSq);
      if (rawDist >= this.activationRangeM) continue;

      const isBound = !focusJump && this.anchorToSlotIndex[i] >= 0;
      const weightedDist = rawDist / Math.max(0.25, a.priorityWeight) - (isBound ? this.hysteresisBonusM : 0);

      if (weightedDist < this.topCandidates[maxSlotsAllowed - 1].scoreDist) {
        let insertAt = maxSlotsAllowed - 1;
        while (insertAt > 0 && weightedDist < this.topCandidates[insertAt - 1].scoreDist) {
          this.topCandidates[insertAt].anchorIndex = this.topCandidates[insertAt - 1].anchorIndex;
          this.topCandidates[insertAt].scoreDist = this.topCandidates[insertAt - 1].scoreDist;
          this.topCandidates[insertAt].rawDist = this.topCandidates[insertAt - 1].rawDist;
          insertAt--;
        }
        this.topCandidates[insertAt].anchorIndex = i;
        this.topCandidates[insertAt].scoreDist = weightedDist;
        this.topCandidates[insertAt].rawDist = rawDist;
      }
    }

    let chosenCount = 0;
    for (let k = 0; k < maxSlotsAllowed; k++) {
      const c = this.topCandidates[k];
      if (c.anchorIndex < 0) break;
      const a = this.anchors[c.anchorIndex];
      const distFade = computeSmoothCubicDistanceFade(c.rawDist, this.fadeStartM, this.activationRangeM);
      const target = a.baseIntensity * drive01 * distFade;
      if (target <= 0.002) continue;
      this.selectedIndices[chosenCount] = c.anchorIndex;
      this.selectedRawDists[chosenCount] = c.rawDist;
      this.selectedTargets[chosenCount] = target;
      chosenCount++;
    }

    // Track which slots are retained in place without allocating per frame
    const slotRetained = this.slotRetained;
    const candidateMatched = this.candidateMatched;
    slotRetained.fill(0);
    candidateMatched.fill(0);

    if (focusJump) {
      this.zeroAllSlotsImmediate();
      for (let c = 0; c < chosenCount; c++) {
        const slot = this.slots[c];
        const aIdx = this.selectedIndices[c];
        this.applyAnchorToSlot(slot, aIdx);
        this.anchorToSlotIndex[aIdx] = c;
        slot.targetIntensity = this.selectedTargets[c];
        slot.currentIntensity = slot.targetIntensity;
        slot.light.intensity = slot.currentIntensity;
      }
      return this.buildSnapshot(activeLaserCount, drive01, levels.groundPoolOpacity01);
    }

    // 1. Keep any already-bound anchor on its exact existing THREE.PointLight slot
    for (let c = 0; c < chosenCount; c++) {
      const aIdx = this.selectedIndices[c];
      const existingSlotIdx = this.anchorToSlotIndex[aIdx];
      if (existingSlotIdx >= 0 && existingSlotIdx < maxSlotsAllowed) {
        const slot = this.slots[existingSlotIdx];
        slot.targetIntensity = this.selectedTargets[c];
        slot.pendingAnchorIndex = -1;
        slotRetained[existingSlotIdx] = 1;
        candidateMatched[c] = 1;
      }
    }

    // 2. Assign newly entering anchors to free/dimmest slots (fading old light out cleanly first)
    for (let c = 0; c < chosenCount; c++) {
      if (candidateMatched[c]) continue;
      const newAnchorIdx = this.selectedIndices[c];
      const newTarget = this.selectedTargets[c];

      let bestSlotIdx = -1;
      let lowestIntensity = Infinity;
      for (let s = 0; s < maxSlotsAllowed; s++) {
        if (slotRetained[s]) continue;
        if (this.slots[s].assignedAnchorIndex < 0) {
          bestSlotIdx = s;
          break;
        }
        if (this.slots[s].currentIntensity < lowestIntensity) {
          lowestIntensity = this.slots[s].currentIntensity;
          bestSlotIdx = s;
        }
      }
      if (bestSlotIdx < 0) continue;

      slotRetained[bestSlotIdx] = 1;
      const slot = this.slots[bestSlotIdx];
      if (slot.assignedAnchorIndex < 0 || slot.currentIntensity <= 0.025) {
        if (slot.assignedAnchorIndex >= 0) {
          this.anchorToSlotIndex[slot.assignedAnchorIndex] = -1;
        }
        this.applyAnchorToSlot(slot, newAnchorIdx);
        this.anchorToSlotIndex[newAnchorIdx] = bestSlotIdx;
        slot.targetIntensity = newTarget;
        slot.pendingAnchorIndex = -1;
      } else {
        // Fade old anchor down cleanly before hopping position to eliminate light popping
        slot.targetIntensity = 0;
        slot.pendingAnchorIndex = newAnchorIdx;
        slot.pendingTargetIntensity = newTarget;
      }
    }

    // 3. Slots not retained this frame smoothly fade out
    for (let s = 0; s < this.slots.length; s++) {
      if (!slotRetained[s]) {
        this.slots[s].targetIntensity = 0;
        this.slots[s].pendingAnchorIndex = -1;
      }
    }

    // 4. Integrate smooth exponential intensity transitions + apply curvature Y offset if active
    const smoothAlpha = 1 - Math.exp(-this.smoothingRatePerSec * dt);
    const fadeOutAlpha = 1 - Math.exp(-this.smoothingRatePerSec * 1.65 * dt);
    const curveStrength = input.curvatureStrength ?? 0;
    const pPivotX = input.planetPivotX ?? 0;
    const pPivotZ = input.planetPivotZ ?? 0;

    for (let s = 0; s < this.slots.length; s++) {
      const slot = this.slots[s];
      const alpha = slot.targetIntensity < slot.currentIntensity ? fadeOutAlpha : smoothAlpha;
      slot.currentIntensity += (slot.targetIntensity - slot.currentIntensity) * alpha;

      if (slot.pendingAnchorIndex >= 0 && slot.currentIntensity <= 0.025) {
        if (slot.assignedAnchorIndex >= 0) {
          this.anchorToSlotIndex[slot.assignedAnchorIndex] = -1;
        }
        const nextIdx = slot.pendingAnchorIndex;
        this.applyAnchorToSlot(slot, nextIdx);
        this.anchorToSlotIndex[nextIdx] = s;
        slot.targetIntensity = slot.pendingTargetIntensity;
        slot.pendingAnchorIndex = -1;
        slot.pendingTargetIntensity = 0;
      } else if (slot.targetIntensity === 0 && slot.currentIntensity < 0.004) {
        slot.currentIntensity = 0;
        if (slot.assignedAnchorIndex >= 0) {
          this.anchorToSlotIndex[slot.assignedAnchorIndex] = -1;
          slot.assignedAnchorIndex = -1;
        }
      }

      if (slot.assignedAnchorIndex >= 0 && curveStrength !== 0) {
        const a = this.anchors[slot.assignedAnchorIndex];
        slot.light.position.y =
          a.y + computePlanetYOffset(a.x, a.z, pPivotX, pPivotZ, curveStrength);
      }
      slot.light.intensity = slot.currentIntensity;
    }

    return this.buildSnapshot(activeLaserCount, drive01, levels.groundPoolOpacity01);
  }

  private buildSnapshot(
    activeLaserCount: number,
    lampDrive01: number,
    groundPoolOpacity01: number,
  ): ProximityLightFrameSnapshot {
    let activePointLightCount = 0;
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot.currentIntensity > 0.001) {
        activePointLightCount++;
      }
      const snap = this.mutableSlotSnapshots[i];
      snap.anchorId =
        slot.assignedAnchorIndex >= 0 ? this.anchors[slot.assignedAnchorIndex].id : null;
      snap.intensity = slot.currentIntensity;
      snap.targetIntensity = slot.targetIntensity;
    }
    const snapshot: ProximityLightFrameSnapshot = {
      poolSize: this.slots.length,
      activePointLightCount,
      activeLaserCount,
      totalActiveScenePointLights: activePointLightCount + activeLaserCount,
      lampDrive01,
      groundPoolOpacity01,
      groundPoolVisible: Boolean(this.groundPoolMesh?.visible),
      slots: this.mutableSlotSnapshots,
    };
    this.scene.userData.proximityPointLightStats = snapshot;
    return snapshot;
  }

  dispose(): void {
    for (const pt of this.lights) {
      this.scene.remove(pt);
    }
    if (this.groundPoolMesh) {
      this.scene.remove(this.groundPoolMesh);
    }
    this.groundPoolGeo?.dispose();
    this.groundPoolMat?.dispose();
    this.groundPoolTex?.dispose();
  }
}
