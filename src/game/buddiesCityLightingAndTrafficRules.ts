import type {
  CityTramConsistState,
  LightingPresetKey,
  PlazaTrafficSignalState,
} from './buddiesBlitzRules';
import {
  CITY_TRAFFIC_SIGNAL_POLE_SPECS,
  CITY_TRAFFIC_SIGN_SPECS,
  CITY_TRAM_SPEC,
  PLAZA_TRAFFIC_SIGNAL_SPEC,
  clamp,
  shortestAngleDelta,
} from './buddiesBlitzRules';
import {
  evaluateHaltePlatformSdf,
  evaluateNwLakeSdf,
  evaluateOuterEmbankmentSdf,
  evaluateRoadNetworkSdf,
  evaluateSeHarborSdf,
  getTerrainElevation,
  isPointOnInnerTramSidewalk,
  isPointOnOuterTramSidewalk,
  isPointOnZebraCrosswalk,
} from './buddiesPlanetCurvature';
import {
  GRAND_CASINO_MASTERPLAN,
  evaluateGrandCasinoPavedPlatformSdf,
  isPointOnGrandCasinoCrosswalk,
} from './buddiesGrandCasinoRules';
import { BEACH_CLUB_MASTERPLAN } from './buddiesBeachClubRules';

/**
 * Shared dynamic atmosphere state published on `scene.userData.weatherEnvState` by `@dynamiccuaca`
 * (or absent when running standalone, falling back cleanly to `lightingPreset`).
 */
export interface WeatherEnvStateContract {
  timeOfDayHours?: number;
  phase?: LightingPresetKey;
  nightFactor01?: number;
  duskDawnFactor01?: number;
  fogFactor01?: number;
  rainFactor01?: number;
  wetness01?: number;
  windStrength?: number;
  cityLightsScale?: number;
  sunElevation01?: number;
}

export interface CityIlluminationLevels {
  nightFactor01: number;
  duskDawnFactor01: number;
  fogFactor01: number;
  rainFactor01: number;
  wetness01: number;
  cityLightsScale: number;
  /** Normalized brightness [0..2.5] driving lantern glass, bollards & halos */
  streetLampBrightness01: number;
  /** Warm amber/gold emissive hex color for lantern glass */
  lanternEmissiveHex: string;
  /** Normalized brightness [0..2.5] driving building facade & storefront windows */
  windowGlow01: number;
  /** Opacity multiplier [0..1] for projected warm ground light pools */
  groundPoolOpacity01: number;
  /** True during dusk, night, dawn, rain, or dense fog */
  headlightOn: boolean;
  /** Normalized strength [0..1.6] for vehicle headlight cones & lens flare */
  headlightStrength01: number;
}

const PRESET_NIGHT_FALLBACK: Record<LightingPresetKey, number> = {
  day: 0.0,
  dusk: 0.72,
  night: 1.0,
  dawn: 0.58,
};

const PRESET_DUSK_DAWN_FALLBACK: Record<LightingPresetKey, number> = {
  day: 0.0,
  dusk: 0.85,
  night: 0.15,
  dawn: 0.78,
};

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t);
}

function smoothstep01(edge0: number, edge1: number, x: number): number {
  const span = edge1 - edge0;
  if (span <= 0) return x >= edge1 ? 1 : 0;
  const t = clamp01((x - edge0) / span);
  return t * t * (3 - 2 * t);
}

/**
 * Computes city streetlamp, building window, ground light-pool, and vehicle headlight
 * brightness levels from shared `@dynamiccuaca` `weatherEnvState` with clean fallback
 * to `lightingPreset` (`day`, `dusk`, `night`, `dawn`).
 *
 * Daytime threshold: when effective drive <= 0.05 (e.g. `nightFactor01 <= 0.05` in clear day),
 * streetlamps, glow sprites, windows, and ground pools remain cleanly off (`0`), then ramp
 * smoothly across `0.05 .. 0.22` into dusk, night, dawn, rain, or dense fog.
 */
export function computeCityIlluminationLevels(
  weatherEnvState: WeatherEnvStateContract | undefined | null,
  fallbackPreset: LightingPresetKey = 'day',
): CityIlluminationLevels {
  const rawPreset = weatherEnvState?.phase ?? fallbackPreset;
  const safePreset: LightingPresetKey =
    rawPreset in PRESET_NIGHT_FALLBACK ? rawPreset : 'day';
  const nightFactor01 = clamp01(
    weatherEnvState?.nightFactor01 ?? PRESET_NIGHT_FALLBACK[safePreset],
  );
  const duskDawnFactor01 = clamp01(
    weatherEnvState?.duskDawnFactor01 ?? PRESET_DUSK_DAWN_FALLBACK[safePreset],
  );
  const fogFactor01 = clamp01(weatherEnvState?.fogFactor01 ?? 0);
  const rainFactor01 = clamp01(weatherEnvState?.rainFactor01 ?? 0);
  const wetness01 = clamp01(weatherEnvState?.wetness01 ?? rainFactor01 * 0.85);
  const cityLightsScale = clamp(weatherEnvState?.cityLightsScale ?? 1.0, 0.25, 2.5);

  const stormBoost = Math.max(rainFactor01 * 0.65, fogFactor01 * 0.52);
  const rawLampDrive = Math.max(nightFactor01, duskDawnFactor01 * 0.78, stormBoost);
  const lampTurnOnRamp = rawLampDrive > 0.05 ? smoothstep01(0.05, 0.22, rawLampDrive) : 0;
  const streetLampBrightness01 =
    lampTurnOnRamp > 0 ? rawLampDrive * lampTurnOnRamp * cityLightsScale : 0;

  const rawWindowDrive = Math.max(
    nightFactor01,
    duskDawnFactor01 * 0.82,
    rainFactor01 * 0.45 + fogFactor01 * 0.28,
  );
  const windowTurnOnRamp = rawWindowDrive > 0.05 ? smoothstep01(0.05, 0.22, rawWindowDrive) : 0;
  const windowGlow01 =
    windowTurnOnRamp > 0 ? rawWindowDrive * windowTurnOnRamp * cityLightsScale : 0;

  const rawPoolDrive = Math.max(
    nightFactor01 * 0.96,
    duskDawnFactor01 * 0.72,
    rainFactor01 * 0.48,
    fogFactor01 * 0.34,
  );
  const poolTurnOnRamp = rawPoolDrive > 0.05 ? smoothstep01(0.05, 0.22, rawPoolDrive) : 0;
  const groundPoolOpacity01 =
    poolTurnOnRamp > 0
      ? clamp(rawPoolDrive * poolTurnOnRamp * (0.5 + 0.5 * cityLightsScale), 0, 1.0)
      : 0;

  const headlightOn =
    nightFactor01 >= 0.18 ||
    duskDawnFactor01 >= 0.25 ||
    rainFactor01 >= 0.18 ||
    fogFactor01 >= 0.22;

  const rawHeadlight = Math.max(
    nightFactor01,
    duskDawnFactor01 * 0.84,
    rainFactor01 * 0.88,
    fogFactor01 * 0.76,
  );
  const headlightStrength01 = headlightOn
    ? clamp(rawHeadlight * (0.65 + 0.35 * cityLightsScale), 0.25, 1.6)
    : 0;

  // Warm tungsten amber at dusk/dawn -> rich warm golden ivory at deep night
  const r = Math.round(lerpNum(245, 255, nightFactor01));
  const g = Math.round(lerpNum(198, 224, nightFactor01));
  const b = Math.round(lerpNum(112, 146, nightFactor01));
  const lanternEmissiveHex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

  return {
    nightFactor01,
    duskDawnFactor01,
    fogFactor01,
    rainFactor01,
    wetness01,
    cityLightsScale,
    streetLampBrightness01,
    lanternEmissiveHex,
    windowGlow01,
    groundPoolOpacity01,
    headlightOn,
    headlightStrength01,
  };
}

// ============================================================================
// 4-TIER PARK & STREET LIGHTING MANIFEST
// ============================================================================

export type LampTier = 1 | 2 | 3 | 4;
export type CityLampVariant = 'single' | 'corner' | 'pier_lantern';

export type CityLampDistrict =
  | 'central_plaza'
  | 'glasshouse_cafe'
  | 'grand_casino'
  | 'central_park_edge'
  | 'inner_boulevard'
  | 'outer_ring'
  | 'residential'
  | 'beach_club'
  | 'se_beach';

export interface CityLampSpec {
  id: string;
  tier: LampTier;
  lampVariant?: CityLampVariant;
  district: CityLampDistrict;
  x: number;
  y: number;
  z: number;
  rotY: number;
  /** Optional elevation offset above deck/ground Y (e.g. pier-mounted balustrade lanterns). */
  mountHeightOffset?: number;
  poolRadius: number;
  hasFlowerBaskets: boolean;
}

export interface CityLampPoolAnchor {
  id: string;
  x: number;
  y: number;
  z: number;
  lanternYOffset: number;
  lanternXOffset?: number;
  lanternZOffset?: number;
  poolRadius: number;
  haloScale: number;
}

/**
 * Strict Central Urban Plaza core exclusion zone (`CentralUrbanPlaza3D`).
 * Ensures ZERO outer city streetlamps spawn inside the enlarged Central Urban Plaza island.
 */
export function isInsideCentralParkExclusionZone(x: number, z: number): boolean {
  if (x >= -10.2 && x <= 53.8 && Math.abs(z) <= 22.1) return true;
  if (x >= 53.8 && x <= 57.8 && Math.abs(z) <= 11.4) return true;
  return false;
}

/**
 * Checks if `(x, z)` lies inside any known major outdoor building/ride/kiosk obstacle
 * where a lamp pole must never spawn.
 */
export function isInsideBuildingOrPropFootprint(x: number, z: number): boolean {
  // South Plaza L-Shaped Glasshouse Cafe
  if (x >= -106.05 && x <= -79.45 && z >= 22.6 && z <= 37.4) return true;
  if (x >= -106.05 && x <= -94.55 && z >= 13.4 && z <= 23.4) return true;
  // Municipal Hall & Clock Tower
  if (x >= -100.85 && x <= -86.25 && z >= -34.8 && z <= -25.2) return true;
  // West Plaza Retail Arcade (shifted -2.25m West with Plaza group)
  if (x >= -110.45 && x <= -103.05 && z >= -17.6 && z <= 9.6) return true;
  // Plaza Staircase Center Handrail & Planters (stair walk x in [-87.55..-79.15], z in [-9.8..+9.8])
  if (x >= -88.05 && x <= -78.95 && Math.abs(z) <= 9.8) return true;
  // Grand Casino Main Building & Porte-Cochere footprint
  if (x >= -99.5 && x <= -77.5 && z >= -88.2 && z <= -53.2) return true;
  if (x >= -78.5 && x <= -68.0 && z >= -75.2 && z <= -66.0) return true;
  // Bottom-Left Model Estate House & Yard Interior (-45, 81.7, hx=9.8, hz=17.5)
  if (x >= -55.2 && x <= -34.8 && z >= 63.8 && z <= 99.6) return true;
  // Halte Shelters (Central Plaza, North Res, South Res, Beachfront)
  if (x >= -62.5 && x <= -55.2 && Math.abs(z) <= 9.6) return true;
  if (x >= -6.0 && x <= 13.0 && z >= -44.4 && z <= -37.2) return true;
  if (x >= -46.0 && x <= -27.0 && z >= 37.2 && z <= 44.4) return true;
  if (x >= 55.2 && x <= 62.5 && z >= 19.2 && z <= 38.2) return true;
  // East Coastal Beach Club Main Pool Terrace, Beach Stairs, DJ Stage, Cocktail Bar & Cabanas
  if (
    x >= BEACH_CLUB_MASTERPLAN.mainDeck.minX - 0.2 &&
    x <= BEACH_CLUB_MASTERPLAN.mainDeck.maxX + 2.4 &&
    z >= BEACH_CLUB_MASTERPLAN.mainDeck.minZ - 0.3 &&
    z <= BEACH_CLUB_MASTERPLAN.mainDeck.maxZ + 0.3
  ) {
    return true;
  }
  for (let i = 0; i < BEACH_CLUB_MASTERPLAN.stairFlights.length; i++) {
    const sf = BEACH_CLUB_MASTERPLAN.stairFlights[i];
    if (x >= sf.minX - 0.35 && x <= sf.maxX + 0.35 && z >= sf.minZ - 0.35 && z <= sf.maxZ + 0.35) {
      return true;
    }
  }
  if (
    Math.hypot(x - BEACH_CLUB_MASTERPLAN.cocktailBar.cx, z - BEACH_CLUB_MASTERPLAN.cocktailBar.cz) <=
    BEACH_CLUB_MASTERPLAN.cocktailBar.padRadiusM + 0.5
  ) {
    return true;
  }
  // SE Beachfront Pergola, Juice Kiosk, Surf Rack, Watchtower (+16m seaward)
  if (x >= 79.0 && x <= 89.2 && z >= 80.5 && z <= 96.5) return true;
  if (x >= 78.8 && x <= 86.2 && z >= 55.2 && z <= 64.8) return true;
  if (x >= 113.5 && x <= 121.5 && z >= 64.5 && z <= 70.5) return true;
  return false;
}

/**
 * Validates that a streetlamp or bollard coordinate `(x, z)` sits safely clear of
 * asphalt roads, crosswalks, Central Plaza stair landings, lakes, open ocean, stepped outer hill
 * embankments, Central Park core, buildings, rides, traffic signal poles, and road signs.
 */
export function isValidCityLampPlacement(
  x: number,
  z: number,
  options?: { minRoadMargin?: number },
): boolean {
  const minRoadMargin = options?.minRoadMargin ?? 0.35;
  if (isInsideCentralParkExclusionZone(x, z)) return false;
  if (isInsideBuildingOrPropFootprint(x, z)) return false;
  if (evaluateRoadNetworkSdf(x, z) <= minRoadMargin) return false;
  if (isPointOnZebraCrosswalk(x, z) || isPointOnGrandCasinoCrosswalk(x, z)) return false;
  // Keep Central Plaza lower staircase landing & crosswalk approach completely clear
  if (x >= -76.9 && x <= -73.85 && Math.abs(z) < 12.2) return false;
  if (evaluateNwLakeSdf(x, z) <= 0.75) return false;

  const { waterSdf } = evaluateSeHarborSdf(x, z);
  if (waterSdf <= 0.55) return false;
  if (evaluateOuterEmbankmentSdf(x, z) >= -0.35) return false;

  for (let i = 0; i < CITY_TRAFFIC_SIGNAL_POLE_SPECS.length; i++) {
    const pole = CITY_TRAFFIC_SIGNAL_POLE_SPECS[i];
    if (Math.hypot(x - pole.x, z - pole.z) < 2.5) return false;
  }
  for (let i = 0; i < CITY_TRAFFIC_SIGN_SPECS.length; i++) {
    const sign = CITY_TRAFFIC_SIGN_SPECS[i];
    if (Math.hypot(x - sign.x, z - sign.z) < 3.0) return false;
  }
  return true;
}

function computeLampGroundY(x: number, z: number): number {
  const baseElev = getTerrainElevation(x, z);
  if (baseElev > 0.05) {
    // Plaza (+2.50m), Boardwalk (+1.10m / +0.82m), Halte (+0.26m) already encode top deck height
    return baseElev;
  }
  if (
    isPointOnOuterTramSidewalk(x, z) ||
    isPointOnInnerTramSidewalk(x, z) ||
    evaluateGrandCasinoPavedPlatformSdf(x, z) <= 0.02 ||
    evaluateHaltePlatformSdf(x, z) <= 0.02
  ) {
    return 0.09;
  }
  return Math.abs(baseElev) <= 0.05 ? 0 : baseElev;
}

interface RawLampEntry {
  id: string;
  tier: LampTier;
  lampVariant?: CityLampVariant;
  district: CityLampDistrict;
  x: number;
  z: number;
  rotY: number;
  mountHeightOffset?: number;
}

const RAW_CITY_LAMPS: readonly RawLampEntry[] = [
  // =========================================================================
  // TIER 1: GROUND BOLLARD / PATHWAY SPIKE LIGHTS (~0.45m) — 60 lamps
  // =========================================================================
  // Glasshouse Cafe West L-Wing Terrace Border (clear of Cafe door, parasol tables, & chandelier at -95.55, 11.6)
  { id: 'lamp_t1_cafe_terrace_1', tier: 1, district: 'glasshouse_cafe', x: -93.85, z: 16.0, rotY: 0 },
  { id: 'lamp_t1_cafe_terrace_2', tier: 1, district: 'glasshouse_cafe', x: -93.85, z: 20.6, rotY: 0 },
  // Beach Club Western Palm Promenade Approach Bollards (aligned along x = 78.85 border, centered in palm bays & clear of z=±15 entrances)
  { id: 'lamp_t1_beach_club_prom_n1', tier: 1, district: 'beach_club', x: 78.85, z: -95.5, rotY: 0 },
  { id: 'lamp_t1_beach_club_prom_n2', tier: 1, district: 'beach_club', x: 78.85, z: -67.0, rotY: 0 },
  { id: 'lamp_t1_beach_club_prom_c1', tier: 1, district: 'beach_club', x: 78.85, z: -27.0, rotY: 0 },
  { id: 'lamp_t1_beach_club_prom_s1', tier: 1, district: 'beach_club', x: 78.85, z: 25.0, rotY: 0 },
  // Central Park East Gate Approach & Oasis Lake Scenic Rim (strictly outside Central Park core!)
  { id: 'lamp_t1_park_east_n', tier: 1, district: 'central_park_edge', x: 61.72, z: -8.5, rotY: 0 },
  { id: 'lamp_t1_park_east_s', tier: 1, district: 'central_park_edge', x: 61.72, z: 8.5, rotY: 0 },
  { id: 'lamp_t1_oasis_n', tier: 1, district: 'inner_boulevard', x: -31.0, z: -15.8, rotY: 0 },
  { id: 'lamp_t1_oasis_s', tier: 1, district: 'inner_boulevard', x: -31.0, z: 15.8, rotY: 0 },
  { id: 'lamp_t1_oasis_wn', tier: 1, district: 'inner_boulevard', x: -41.5, z: -12.0, rotY: 0 },
  { id: 'lamp_t1_oasis_ws', tier: 1, district: 'inner_boulevard', x: -41.5, z: 12.0, rotY: 0 },
  // Oasis Lake Park Scenic Entry, Bench Promenade & Shoreline Loop
  { id: 'lamp_t1_oasis_gate_w', tier: 1, district: 'inner_boulevard', x: -52.2, z: 0.0, rotY: 0 },
  { id: 'lamp_t1_oasis_plaza_c', tier: 1, district: 'inner_boulevard', x: -47.2, z: 0.0, rotY: 0 },
  { id: 'lamp_t1_oasis_bench_n', tier: 1, district: 'inner_boulevard', x: -47.2, z: -5.3, rotY: 0 },
  { id: 'lamp_t1_oasis_bench_s', tier: 1, district: 'inner_boulevard', x: -47.2, z: 5.3, rotY: 0 },
  { id: 'lamp_t1_oasis_bench_sw', tier: 1, district: 'inner_boulevard', x: -51.4, z: 11.4, rotY: 0 },
  { id: 'lamp_t1_oasis_rim_sw1', tier: 1, district: 'inner_boulevard', x: -45.6, z: 16.2, rotY: 0 },
  { id: 'lamp_t1_oasis_rim_nw', tier: 1, district: 'inner_boulevard', x: -36.2, z: -14.8, rotY: 0 },
  { id: 'lamp_t1_oasis_rim_sw2', tier: 1, district: 'inner_boulevard', x: -36.4, z: 17.6, rotY: 0 },
  { id: 'lamp_t1_oasis_rim_ne', tier: 1, district: 'inner_boulevard', x: -27.8, z: -19.2, rotY: 0 },
  { id: 'lamp_t1_oasis_rim_se', tier: 1, district: 'inner_boulevard', x: -25.8, z: 18.6, rotY: 0 },
  // West-North City Park Lawn
  { id: 'lamp_t1_park_wn_1', tier: 1, district: 'inner_boulevard', x: -52.0, z: -24.0, rotY: 0 },
  { id: 'lamp_t1_park_wn_2', tier: 1, district: 'inner_boulevard', x: -51.8, z: -32.4, rotY: 0 },
  { id: 'lamp_t1_park_wn_3', tier: 1, district: 'inner_boulevard', x: -47.0, z: -28.0, rotY: 0 },
  { id: 'lamp_t1_park_wn_4', tier: 1, district: 'inner_boulevard', x: -41.2, z: -31.8, rotY: 0 },
  { id: 'lamp_t1_park_wn_5', tier: 1, district: 'inner_boulevard', x: -32.2, z: -32.0, rotY: 0 },
  // West-South S-Curve City Park & Flower Trail
  { id: 'lamp_t1_park_ws_1', tier: 1, district: 'inner_boulevard', x: -52.2, z: 22.8, rotY: 0 },
  { id: 'lamp_t1_park_ws_2', tier: 1, district: 'inner_boulevard', x: -47.2, z: 23.6, rotY: 0 },
  { id: 'lamp_t1_park_ws_3', tier: 1, district: 'inner_boulevard', x: -39.6, z: 23.6, rotY: 0 },
  { id: 'lamp_t1_park_ws_4', tier: 1, district: 'inner_boulevard', x: -32.2, z: 24.4, rotY: 0 },
  { id: 'lamp_t1_park_ws_5', tier: 1, district: 'inner_boulevard', x: -29.2, z: 29.2, rotY: 0 },
  { id: 'lamp_t1_park_ws_6', tier: 1, district: 'inner_boulevard', x: -37.8, z: 29.8, rotY: 0 },
  { id: 'lamp_t1_park_ws_7', tier: 1, district: 'inner_boulevard', x: -44.2, z: 28.4, rotY: 0 },
  { id: 'lamp_t1_park_ws_8', tier: 1, district: 'inner_boulevard', x: -51.6, z: 32.0, rotY: 0 },
  // Center-North City Park Lawn (framing seating & flowerbeds)
  { id: 'lamp_t1_park_cn_1', tier: 1, district: 'inner_boulevard', x: -14.2, z: -27.0, rotY: 0 },
  { id: 'lamp_t1_park_cn_2', tier: 1, district: 'inner_boulevard', x: -7.5, z: -32.2, rotY: 0 },
  { id: 'lamp_t1_park_cn_3', tier: 1, district: 'inner_boulevard', x: -1.4, z: -27.4, rotY: 0 },
  { id: 'lamp_t1_park_cn_4', tier: 1, district: 'inner_boulevard', x: 7.4, z: -34.6, rotY: 0 },
  { id: 'lamp_t1_park_cn_5', tier: 1, district: 'inner_boulevard', x: 12.6, z: -32.2, rotY: 0 },
  { id: 'lamp_t1_park_cn_6', tier: 1, district: 'inner_boulevard', x: 11.4, z: -27.2, rotY: 0 },
  // Center-South City Park Lawn (framing seating & flowerbeds)
  { id: 'lamp_t1_park_cs_1', tier: 1, district: 'inner_boulevard', x: -14.2, z: 28.6, rotY: 0 },
  { id: 'lamp_t1_park_cs_2', tier: 1, district: 'inner_boulevard', x: -8.2, z: 34.0, rotY: 0 },
  { id: 'lamp_t1_park_cs_3', tier: 1, district: 'inner_boulevard', x: -5.4, z: 25.4, rotY: 0 },
  { id: 'lamp_t1_park_cs_4', tier: 1, district: 'inner_boulevard', x: 2.0, z: 28.2, rotY: 0 },
  { id: 'lamp_t1_park_cs_5', tier: 1, district: 'inner_boulevard', x: 8.6, z: 34.6, rotY: 0 },
  { id: 'lamp_t1_park_cs_6', tier: 1, district: 'inner_boulevard', x: 13.0, z: 30.8, rotY: 0 },
  { id: 'lamp_t1_park_cs_7', tier: 1, district: 'inner_boulevard', x: 10.2, z: 25.4, rotY: 0 },
  // East-North & East-South Pocket Parks
  { id: 'lamp_t1_park_en_1', tier: 1, district: 'inner_boulevard', x: 34.6, z: -31.8, rotY: 0 },
  { id: 'lamp_t1_park_en_2', tier: 1, district: 'inner_boulevard', x: 48.2, z: -34.2, rotY: 0 },
  { id: 'lamp_t1_park_en_3', tier: 1, district: 'inner_boulevard', x: 55.2, z: -32.2, rotY: 0 },
  { id: 'lamp_t1_park_es_1', tier: 1, district: 'inner_boulevard', x: 31.6, z: 32.0, rotY: 0 },
  { id: 'lamp_t1_park_es_2', tier: 1, district: 'inner_boulevard', x: 48.2, z: 34.2, rotY: 0 },
  { id: 'lamp_t1_park_es_3', tier: 1, district: 'inner_boulevard', x: 53.2, z: 33.2, rotY: 0 },

  // =========================================================================
  // TIER 2: WAIST-HEIGHT BRICK PEDESTAL LANTERNS (~1.10m) — 14 lamps
  // =========================================================================
  // Central Plaza Upper Staircase Portals, Civic Balustrade End-Piers (lantern-only, no brick pier) & Retail Terraces
  { id: 'lamp_t2_plaza_portal_tn', tier: 2, district: 'central_plaza', x: -88.05, z: -12.6, rotY: 0 },
  { id: 'lamp_t2_plaza_portal_ts', tier: 2, district: 'central_plaza', x: -88.05, z: 12.6, rotY: 0 },
  { id: 'lamp_t2_civic_step_w', tier: 2, lampVariant: 'pier_lantern', district: 'central_plaza', x: -96.319, z: -23.264, rotY: 0, mountHeightOffset: 1.2212 },
  { id: 'lamp_t2_civic_step_e', tier: 2, lampVariant: 'pier_lantern', district: 'central_plaza', x: -90.781, z: -23.264, rotY: 0, mountHeightOffset: 1.2212 },
  { id: 'lamp_t2_fashion_terrace', tier: 2, district: 'central_plaza', x: -100.85, z: 7.4, rotY: 0 },
  { id: 'lamp_t2_realestate_terrace', tier: 2, district: 'central_plaza', x: -100.85, z: -16.8, rotY: 0 },
  // Grand Casino Valet Entrance Piers (shifted west of widened Avenue 1 edge x=-65.2)
  { id: 'lamp_t2_casino_valet_s', tier: 2, district: 'grand_casino', x: -66.0, z: -59.4, rotY: Math.PI / 2 },
  { id: 'lamp_t2_casino_valet_n', tier: 2, district: 'grand_casino', x: -66.0, z: -81.3, rotY: Math.PI / 2 },
  // Model Estate House Gateposts ONLY (intact house at -45, 81.7; zero empty-lot stray posts!)
  { id: 'lamp_t2_res_blue0_w', tier: 2, district: 'residential', x: -49.2, z: 62.6, rotY: 0 },
  { id: 'lamp_t2_res_blue0_e', tier: 2, district: 'residential', x: -40.8, z: 62.6, rotY: 0 },
  // Beach Club Promenade Entry Piers & SE Beachfront Collinear Framing (x = 75.85 matches beach_lamp_1..4)
  { id: 'lamp_t2_beach_club_entry_n', tier: 2, district: 'beach_club', x: 78.85, z: -87.0, rotY: 0 },
  { id: 'lamp_t2_beach_club_entry_s', tier: 2, district: 'beach_club', x: 78.85, z: 35.5, rotY: 0 },
  { id: 'lamp_t2_se_beach_entry', tier: 2, district: 'se_beach', x: 75.85, z: 45.2, rotY: 0 },
  { id: 'lamp_t2_se_beach_south', tier: 2, district: 'se_beach', x: 75.85, z: 103.5, rotY: 0 },

  // =========================================================================
  // TIER 3: MODERN NAVY-CHARCOAL LED STREETLAMPS (~4.62m) — 42 lamps
  //         Strictly OFF paved sidewalks (inside grass/apron verges):
  //         - 'corner' (90 deg Y-arm) strictly at road corners/junctions
  //         - 'single' (unbranched cantilever) strictly along straight roads
  // =========================================================================
  // Outer Ring Corners ('corner' dual 90-deg branched Y-arms on grass bends)
  { id: 'lamp_t3_casino_connector', tier: 3, lampVariant: 'corner', district: 'grand_casino', x: -77.1, z: -43.5, rotY: Math.PI / 2 },
  { id: 'lamp_t3_outer_sw_corner', tier: 3, lampVariant: 'corner', district: 'outer_ring', x: -73.0, z: 57.0, rotY: Math.PI / 2 },
  { id: 'lamp_t3_outer_n_5', tier: 3, lampVariant: 'corner', district: 'outer_ring', x: 74.0, z: -56.0, rotY: -Math.PI / 2 },
  { id: 'lamp_t3_outer_s_5', tier: 3, lampVariant: 'corner', district: 'outer_ring', x: 74.0, z: 56.0, rotY: Math.PI },
  // North & South Outer Ring Boulevards ('single', N-S mirrored on outer grass verge |z| = 60.90)
  { id: 'lamp_t3_outer_n_1', tier: 3, lampVariant: 'single', district: 'outer_ring', x: -54.0, z: -60.9, rotY: 0 },
  { id: 'lamp_t3_outer_n_2', tier: 3, lampVariant: 'single', district: 'outer_ring', x: -22.5, z: -60.9, rotY: 0 },
  { id: 'lamp_t3_outer_n_3', tier: 3, lampVariant: 'single', district: 'outer_ring', x: 8.5, z: -60.9, rotY: 0 },
  { id: 'lamp_t3_outer_n_4', tier: 3, lampVariant: 'single', district: 'outer_ring', x: 38.5, z: -60.9, rotY: 0 },
  { id: 'lamp_t3_outer_s_1', tier: 3, lampVariant: 'single', district: 'outer_ring', x: -54.0, z: 60.9, rotY: Math.PI },
  { id: 'lamp_t3_outer_s_2', tier: 3, lampVariant: 'single', district: 'outer_ring', x: -22.5, z: 60.9, rotY: Math.PI },
  { id: 'lamp_t3_outer_s_3', tier: 3, lampVariant: 'single', district: 'outer_ring', x: 8.5, z: 60.9, rotY: Math.PI },
  { id: 'lamp_t3_outer_s_4', tier: 3, lampVariant: 'single', district: 'outer_ring', x: 38.5, z: 60.9, rotY: Math.PI },
  // East Outer Ring Boulevard ('single' behind Outer East sidewalk on Harbor Apron, x = 78.85, centered in palm bays)
  { id: 'lamp_t3_outer_e_n', tier: 3, lampVariant: 'single', district: 'outer_ring', x: 78.85, z: -37.0, rotY: -Math.PI / 2 },
  { id: 'lamp_t3_outer_e_c', tier: 3, lampVariant: 'single', district: 'outer_ring', x: 78.85, z: 5.0, rotY: -Math.PI / 2 },
  // Inner Tram Ring Main Corners ('corner' on inner grass corners, facing outward over curved sidewalk + road)
  { id: 'lamp_t3_inner_nw_c', tier: 3, lampVariant: 'corner', district: 'inner_boulevard', x: -56.6, z: -38.6, rotY: Math.PI },
  { id: 'lamp_t3_inner_ne_c', tier: 3, lampVariant: 'corner', district: 'inner_boulevard', x: 56.6, z: -38.6, rotY: Math.PI / 2 },
  { id: 'lamp_t3_inner_se_c', tier: 3, lampVariant: 'corner', district: 'inner_boulevard', x: 54.5, z: 39.0, rotY: 0 },
  { id: 'lamp_t3_inner_sw_c', tier: 3, lampVariant: 'corner', district: 'inner_boulevard', x: -56.6, z: 38.6, rotY: -Math.PI / 2 },
  // Inner S-Curve Entrance Grass Corners ('corner' framing W/E S-curve intersections)
  { id: 'lamp_t3_scurve_wn', tier: 3, lampVariant: 'corner', district: 'inner_boulevard', x: -57.1, z: -20.0, rotY: -Math.PI / 2 },
  { id: 'lamp_t3_scurve_ws', tier: 3, lampVariant: 'corner', district: 'inner_boulevard', x: -57.1, z: 20.0, rotY: Math.PI },
  { id: 'lamp_t3_scurve_en', tier: 3, lampVariant: 'corner', district: 'inner_boulevard', x: 57.1, z: -20.0, rotY: 0 },
  { id: 'lamp_t3_scurve_es', tier: 3, lampVariant: 'corner', district: 'inner_boulevard', x: 53.6, z: 23.4, rotY: Math.PI / 2 },
  // Inner Tram Straight Grass Verges ('single', spacious spacing, clear of Halte & Central Park)
  { id: 'lamp_t3_inner_nmw', tier: 3, lampVariant: 'single', district: 'inner_boulevard', x: -33.5, z: -39.2, rotY: Math.PI },
  { id: 'lamp_t3_inner_nme', tier: 3, lampVariant: 'single', district: 'inner_boulevard', x: 27.5, z: -39.2, rotY: Math.PI },
  { id: 'lamp_t3_inner_smw', tier: 3, lampVariant: 'single', district: 'inner_boulevard', x: 5.5, z: 39.2, rotY: 0 },
  { id: 'lamp_t3_inner_sme', tier: 3, lampVariant: 'single', district: 'inner_boulevard', x: 27.5, z: 39.2, rotY: 0 },
  // Inner S-Curve Straight Boulevards ('single' in grass facing directly across S-curve asphalt)
  { id: 'lamp_t3_scurve_nc', tier: 3, lampVariant: 'single', district: 'inner_boulevard', x: -13.0, z: -35.0, rotY: -Math.PI / 2 },
  { id: 'lamp_t3_scurve_sc', tier: 3, lampVariant: 'single', district: 'inner_boulevard', x: -13.0, z: 35.0, rotY: -Math.PI / 2 },
  { id: 'lamp_t3_scurve_ne', tier: 3, lampVariant: 'single', district: 'inner_boulevard', x: 26.2, z: -33.6, rotY: -Math.PI / 2 },
  { id: 'lamp_t3_scurve_se', tier: 3, lampVariant: 'single', district: 'inner_boulevard', x: 26.2, z: 33.6, rotY: -Math.PI / 2 },
  // Residential Collector Avenues ('single', 100% N-S symmetric on green grass)
  { id: 'lamp_t3_res_s_w30', tier: 3, lampVariant: 'single', district: 'residential', x: -25.35, z: 78.0, rotY: -Math.PI / 2 },
  { id: 'lamp_t3_res_s_0w', tier: 3, lampVariant: 'single', district: 'residential', x: -6.25, z: 78.0, rotY: Math.PI / 2 },
  { id: 'lamp_t3_res_s_0e', tier: 3, lampVariant: 'single', district: 'residential', x: 6.25, z: 78.0, rotY: -Math.PI / 2 },
  { id: 'lamp_t3_res_s_e30', tier: 3, lampVariant: 'single', district: 'residential', x: 25.35, z: 78.0, rotY: Math.PI / 2 },
  { id: 'lamp_t3_res_s_e60', tier: 3, lampVariant: 'single', district: 'residential', x: 53.75, z: 78.0, rotY: Math.PI / 2 },
  { id: 'lamp_t3_res_n_w30', tier: 3, lampVariant: 'single', district: 'residential', x: -25.35, z: -78.0, rotY: -Math.PI / 2 },
  { id: 'lamp_t3_res_n_0w', tier: 3, lampVariant: 'single', district: 'residential', x: -6.25, z: -78.0, rotY: Math.PI / 2 },
  { id: 'lamp_t3_res_n_0e', tier: 3, lampVariant: 'single', district: 'residential', x: 6.25, z: -78.0, rotY: -Math.PI / 2 },
  { id: 'lamp_t3_res_n_e30', tier: 3, lampVariant: 'single', district: 'residential', x: 25.35, z: -78.0, rotY: Math.PI / 2 },
  { id: 'lamp_t3_res_n_e60', tier: 3, lampVariant: 'single', district: 'residential', x: 53.75, z: -78.0, rotY: Math.PI / 2 },
  // Beach Club North & South Boulevard Verge Streetlamps (centered in palm bays, clear of z=±15 entrances)
  { id: 'lamp_t3_beach_club_nw', tier: 3, lampVariant: 'single', district: 'beach_club', x: 78.85, z: -77.0, rotY: -Math.PI / 2 },
  { id: 'lamp_t3_beach_club_sw', tier: 3, lampVariant: 'single', district: 'beach_club', x: 78.85, z: -57.0, rotY: -Math.PI / 2 },

  // =========================================================================
  // TIER 4: GRAND MULTI-ARM VICTORIAN CHANDELIER + FLOWER BASKETS (~4.80m) — 11 lamps
  // =========================================================================
  // Central Plaza Main Square & Glasshouse Cafe Courtyard (replaces small lamps w3 at -95.55, 11.6, e2 at -80.35, -12.4 & e3 at -80.35, 12.4)
  { id: 'lamp_t4_plaza_center_n', tier: 4, district: 'central_plaza', x: -80.35, z: -12.4, rotY: 0 },
  { id: 'lamp_t4_plaza_center_s', tier: 4, district: 'central_plaza', x: -80.35, z: 12.4, rotY: 0 },
  { id: 'lamp_t4_cafe_corner', tier: 4, district: 'glasshouse_cafe', x: -95.55, z: 11.6, rotY: 0 },
  // Grand Casino South Forecourt Plaza & North Lawn Approach
  { id: 'lamp_t4_casino_forecourt_s', tier: 4, district: 'grand_casino', x: -68.5, z: -55.0, rotY: Math.PI / 4 },
  { id: 'lamp_t4_casino_forecourt_n', tier: 4, district: 'grand_casino', x: -69.5, z: -88.0, rotY: -Math.PI / 4 },
  // Beach Club Promenade Architectural Gateway Chandeliers (centered in palm bays)
  { id: 'lamp_t4_beach_club_gate_n', tier: 4, district: 'beach_club', x: 78.85, z: -47.0, rotY: 0 },
  { id: 'lamp_t4_beach_club_gate_s', tier: 4, district: 'beach_club', x: 78.85, z: -5.0, rotY: 0 },
  // Four Outer Corners Outside the Central Urban Plaza Island (strictly outside Central Urban Plaza interior!)
  { id: 'lamp_t4_park_corner_nw', tier: 4, district: 'central_park_edge', x: -20.8, z: -10.5, rotY: Math.PI / 4 },
  { id: 'lamp_t4_park_corner_sw', tier: 4, district: 'central_park_edge', x: -20.8, z: 10.5, rotY: -Math.PI / 4 },
  { id: 'lamp_t4_park_corner_ne', tier: 4, district: 'central_park_edge', x: 52.2, z: -28.0, rotY: -Math.PI / 4 },
  { id: 'lamp_t4_park_corner_se', tier: 4, district: 'central_park_edge', x: 52.2, z: 28.0, rotY: Math.PI / 4 },
];

const POOL_RADIUS_BY_TIER: Record<LampTier, number> = {
  1: 4.6,
  2: 4.8,
  3: 9.2,
  4: 11.4,
};

export const CITY_LAMP_MANIFEST: readonly CityLampSpec[] = RAW_CITY_LAMPS.map((entry) => ({
  id: entry.id,
  tier: entry.tier,
  ...(entry.lampVariant ? { lampVariant: entry.lampVariant } : {}),
  district: entry.district,
  x: entry.x,
  y: computeLampGroundY(entry.x, entry.z) + (entry.mountHeightOffset ?? 0),
  z: entry.z,
  rotY: entry.rotY,
  ...(entry.mountHeightOffset ? { mountHeightOffset: entry.mountHeightOffset } : {}),
  poolRadius:
    entry.tier === 3
      ? entry.lampVariant === 'corner'
        ? 10.8
        : 9.2
      : POOL_RADIUS_BY_TIER[entry.tier],
  hasFlowerBaskets: entry.tier === 4,
}));

/**
 * Existing static Plaza, Grand Casino, and SE Beach streetlamps so their lanterns also cast
 * synchronized warm ground light pools & soft lantern halos during Dusk/Night/Dawn/Rain.
 */
export const EXISTING_CITY_LAMP_POOL_ANCHORS: readonly CityLampPoolAnchor[] = [
  // Central Plaza 5 Ornate Dual-Basket Bronze Promenade Lamps (y = 2.50m deck + 3.685*1.62 = 5.97m lantern center)
  { id: 'existing_plaza_w1', x: -108.95, y: 2.5, z: -28.5, lanternYOffset: 5.97, poolRadius: 8.5, haloScale: 0.94 },
  { id: 'existing_plaza_w2', x: -109.15, y: 2.5, z: -19.2, lanternYOffset: 5.97, poolRadius: 8.5, haloScale: 0.94 },
  { id: 'existing_plaza_w4', x: -109.15, y: 2.5, z: 11.6, lanternYOffset: 5.97, poolRadius: 8.5, haloScale: 0.94 },
  { id: 'existing_plaza_e1', x: -80.35, y: 2.5, z: -28.5, lanternYOffset: 5.97, poolRadius: 8.5, haloScale: 0.94 },
  { id: 'existing_plaza_e4', x: -80.35, y: 2.5, z: 21.6, lanternYOffset: 5.97, poolRadius: 8.5, haloScale: 0.94 },
  // Civic Hall Front Planter Bed Ornate Dual-Basket Bronze Lamps (scale 0.85 * 1.42 = 1.207, lantern center y = 2.50 + 4.96 = 7.46m)
  { id: 'existing_civic_planter_w', x: -100.295, y: 2.5, z: -24.585, lanternYOffset: 4.96, poolRadius: 6.8, haloScale: 0.74 },
  { id: 'existing_civic_planter_e', x: -86.805, y: 2.5, z: -24.585, lanternYOffset: 4.96, poolRadius: 6.8, haloScale: 0.74 },
  // Grand Casino 6 Street Lamps
  ...GRAND_CASINO_MASTERPLAN.streetLamps.map((lamp) => ({
    id: `existing_${lamp.id}`,
    x: lamp.x,
    y: lamp.id.includes('median') ? 0.14 : 0.09,
    z: lamp.z,
    lanternYOffset: 4.32,
    poolRadius: 9.2,
    haloScale: 0.96,
  })),
  // SE Beachfront 4 Walkway Lamps (arm projects +0.63m East to x=76.48, luminaire underside y=4.90m)
  ...[49.5, 63.0, 76.5, 91.5].map((bz, idx) => ({
    id: `existing_beach_lamp_${idx + 1}`,
    x: 75.85,
    y: 0.24,
    z: bz,
    lanternXOffset: 0.63,
    lanternYOffset: 4.66,
    poolRadius: 8.0,
    haloScale: 0.84,
  })),
];

// ============================================================================
// BUILDING NIGHT ILLUMINATION MANIFEST (WARM GLOWING WINDOWS & STOREFRONTS)
// ============================================================================

export interface BuildingGlowPaneSpec {
  id: string;
  building: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  width: number;
  height: number;
  colorHex: string;
  intensityScale: number;
  phaseOffset: number;
}

const CIVIC_CX = -93.55;
const CIVIC_Y = 2.5;
const CIVIC_CZ = -29.2;
const CIVIC_S = 1.42;

const arcadeWorldPane = (
  lx: number,
  ly: number,
  lz: number,
  w: number,
  h: number,
) => ({
  // Unified Civic Commercial Arcade sits at (-106.35, 2.50, -4.40), facing East (+X, rotY = +Math.PI/2)
  x: Number((-106.35 + lz).toFixed(3)),
  y: Number((2.5 + ly).toFixed(3)),
  z: Number((-4.4 - lx).toFixed(3)),
  rotY: Math.PI / 2,
  width: Number(w.toFixed(3)),
  height: Number(h.toFixed(3)),
});

export const CITY_BUILDING_GLOW_MANIFEST: readonly BuildingGlowPaneSpec[] = (() => {
  const hashIdSeed32 = (windowId: string): number => {
    let h = 0x811c9dc5;
    for (let i = 0; i < windowId.length; i++) {
      h ^= windowId.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= Math.imul(0x27d4eb2d, 0x165667b1);
    h = Math.imul(h, 0x85ebca6b);
    h ^= Math.imul(0x1b873593, 0xcc9e2d51);
    let x = h | 0;
    x ^= x >>> 16;
    x = Math.imul(x, 0x85ebca6b);
    x ^= x >>> 13;
    x = Math.imul(x, 0xc2b2ae35);
    x ^= x >>> 16;
    return x >>> 0;
  };
  const seedUnit01 = (seed: number, salt: number): number => {
    let x = (seed | 0) ^ Math.imul(salt + 1, 0x9e3779b9);
    x ^= x >>> 16;
    x = Math.imul(x, 0x85ebca6b);
    x ^= x >>> 13;
    x = Math.imul(x, 0xc2b2ae35);
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  };
  const withSeededTiming = (
    spec: Omit<BuildingGlowPaneSpec, 'phaseOffset' | 'intensityScale'>,
    baseIntensityScale = 1.0,
  ): BuildingGlowPaneSpec => {
    const seed = hashIdSeed32(spec.id);
    const phaseOffset = Math.round(seedUnit01(seed, 17) * Math.PI * 2 * 1000) / 1000;
    const weight = 0.84 + seedUnit01(seed, 29) * 0.28;
    const intensityScale = Math.round(baseIntensityScale * weight * 1000) / 1000;
    return {
      ...spec,
      intensityScale,
      phaseOffset,
    };
  };

  return [
    // 1. Municipal Hall & Clock Tower (`(-93.55, 2.50, -29.2)`, scale = 1.42)
    // Positioned +6mm proud of actual glass outer faces & behind 6-pane crossbars (zero buried/overhang).
    withSeededTiming(
      {
        id: 'glow_civic_front_win_w',
        building: 'municipal_hall',
        x: CIVIC_CX - 2.95 * CIVIC_S,
        y: CIVIC_Y + 1.96 * CIVIC_S,
        z: CIVIC_CZ + 2.196 * CIVIC_S,
        rotY: 0,
        width: 0.78 * CIVIC_S,
        height: 1.1 * CIVIC_S,
        colorHex: '#ffd77a',
      },
      0.98,
    ),
    withSeededTiming(
      {
        id: 'glow_civic_front_win_e',
        building: 'municipal_hall',
        x: CIVIC_CX + 2.95 * CIVIC_S,
        y: CIVIC_Y + 1.96 * CIVIC_S,
        z: CIVIC_CZ + 2.196 * CIVIC_S,
        rotY: 0,
        width: 0.78 * CIVIC_S,
        height: 1.1 * CIVIC_S,
        colorHex: '#ffd77a',
      },
      0.98,
    ),
    withSeededTiming(
      {
        id: 'glow_civic_portico_door_w',
        building: 'municipal_hall',
        x: CIVIC_CX - 0.35 * CIVIC_S,
        y: CIVIC_Y + 2.30 * CIVIC_S,
        z: CIVIC_CZ + 2.248 * CIVIC_S,
        rotY: 0,
        width: 0.44 * CIVIC_S,
        height: 1.22 * CIVIC_S,
        colorHex: '#ffe69e',
      },
      1.0,
    ),
    withSeededTiming(
      {
        id: 'glow_civic_portico_door_e',
        building: 'municipal_hall',
        x: CIVIC_CX + 0.35 * CIVIC_S,
        y: CIVIC_Y + 2.30 * CIVIC_S,
        z: CIVIC_CZ + 2.248 * CIVIC_S,
        rotY: 0,
        width: 0.44 * CIVIC_S,
        height: 1.22 * CIVIC_S,
        colorHex: '#ffe69e',
      },
      1.0,
    ),
    withSeededTiming(
      {
        id: 'glow_civic_side_e1',
        building: 'municipal_hall',
        x: CIVIC_CX + 4.546 * CIVIC_S,
        y: CIVIC_Y + 1.96 * CIVIC_S,
        z: CIVIC_CZ + 0.82 * CIVIC_S,
        rotY: Math.PI / 2,
        width: 0.78 * CIVIC_S,
        height: 1.1 * CIVIC_S,
        colorHex: '#ffcf6e',
      },
      0.94,
    ),
    withSeededTiming(
      {
        id: 'glow_civic_side_e2',
        building: 'municipal_hall',
        x: CIVIC_CX + 4.546 * CIVIC_S,
        y: CIVIC_Y + 1.96 * CIVIC_S,
        z: CIVIC_CZ - 1.55 * CIVIC_S,
        rotY: Math.PI / 2,
        width: 0.78 * CIVIC_S,
        height: 1.1 * CIVIC_S,
        colorHex: '#ffcf6e',
      },
      0.94,
    ),
    withSeededTiming(
      {
        id: 'glow_civic_side_w1',
        building: 'municipal_hall',
        x: CIVIC_CX - 4.546 * CIVIC_S,
        y: CIVIC_Y + 1.96 * CIVIC_S,
        z: CIVIC_CZ + 0.82 * CIVIC_S,
        rotY: -Math.PI / 2,
        width: 0.78 * CIVIC_S,
        height: 1.1 * CIVIC_S,
        colorHex: '#ffcf6e',
      },
      0.94,
    ),
    withSeededTiming(
      {
        id: 'glow_civic_side_w2',
        building: 'municipal_hall',
        x: CIVIC_CX - 4.546 * CIVIC_S,
        y: CIVIC_Y + 1.96 * CIVIC_S,
        z: CIVIC_CZ - 1.55 * CIVIC_S,
        rotY: -Math.PI / 2,
        width: 0.78 * CIVIC_S,
        height: 1.1 * CIVIC_S,
        colorHex: '#ffcf6e',
      },
      0.94,
    ),
    withSeededTiming(
      {
        id: 'glow_civic_clock_front',
        building: 'municipal_hall',
        x: CIVIC_CX,
        y: CIVIC_Y + (4.85 + 1.62) * CIVIC_S,
        z: CIVIC_CZ + 0.598 * CIVIC_S,
        rotY: 0,
        // Compact inside circular dial radius (0.58 * CIVIC_S, half-diag 0.537 < 0.58)
        width: 0.76 * CIVIC_S,
        height: 0.76 * CIVIC_S,
        colorHex: '#fff3c4',
      },
      1.04,
    ),

    // 2. Unified West Plaza 3-Bay Civic Commercial Arcade
    //    Storefronts keep crystal-clear 3D glass without opaque curtain decals washing out mannequins/models;
    //    only the 3 rooftop clerestory skylights emit soft night glow.
    withSeededTiming(
      {
        id: 'glow_arcade_fashion_sky',
        building: 'arcade_fashion_bay',
        ...arcadeWorldPane(-6.75, 6.02, 0.696, 2.02, 0.22),
        colorHex: '#ffe8b8',
      },
      0.78,
    ),
    withSeededTiming(
      {
        id: 'glow_arcade_realestate_sky',
        building: 'arcade_realestate_bay',
        ...arcadeWorldPane(0.0, 6.02, 0.696, 2.02, 0.22),
        colorHex: '#ffe8b8',
      },
      0.78,
    ),
    withSeededTiming(
      {
        id: 'glow_arcade_scooter_sky',
        building: 'arcade_scooter_bay',
        ...arcadeWorldPane(6.75, 6.02, 0.696, 2.02, 0.22),
        colorHex: '#ffe8b8',
      },
      0.78,
    ),

    // (Grand Casino windows & doors use 3D `cityWindowSpec` staggered lighting in `buddiesGrandCasinoBuilder.ts`
    //  so flat manifest panes never mask `'off'` rooms or cast always-on daytime/night quads.)

    // 3. Model Estate House (`(-45.0, 90.8)`, Japanese Pavilion Lv.1 facing North -Z)
    // Split cleanly into individual sliding shoji, front/rear clerestory bays, and rear transom panes flush with glazing.
    withSeededTiming(
      {
        id: 'glow_model_house_front_shoji_w',
        building: 'model_estate_house',
        x: -47.357,
        y: 2.59,
        z: 87.015,
        rotY: Math.PI,
        width: 1.80,
        height: 3.22,
        colorHex: '#ffdf88',
      },
      0.92,
    ),
    withSeededTiming(
      {
        id: 'glow_model_house_front_shoji_e',
        building: 'model_estate_house',
        x: -45.299,
        y: 2.59,
        z: 86.982,
        rotY: Math.PI,
        width: 1.80,
        height: 3.22,
        colorHex: '#ffdf88',
      },
      0.92,
    ),
    ...[-47.756, -46.328, -44.900].map((wx, idx) =>
      withSeededTiming(
        {
          id: `glow_model_house_clerestory_${idx}`,
          building: 'model_estate_house',
          x: wx,
          y: 5.445,
          z: 87.273,
          rotY: Math.PI,
          width: 1.26,
          height: 0.60,
          colorHex: '#ffe59c',
        },
        0.88,
      ),
    ),
    ...[-1.76, -0.88, 0, 0.88, 1.76].map((offset, idx) =>
      withSeededTiming(
        {
          id: `glow_model_house_rear_clerestory_${idx}`,
          building: 'model_estate_house',
          x: Number((-45.0 + 1.66 * offset).toFixed(3)),
          y: 5.445,
          z: 94.510,
          rotY: 0,
          width: 1.26,
          height: 0.58,
          colorHex: '#ffe092',
        },
        0.88,
      ),
    ),
    ...[-48.452, -46.294, -43.706, -41.548].map((wx, idx) =>
      withSeededTiming(
        {
          id: `glow_model_house_rear_transom_${idx}`,
          building: 'model_estate_house',
          x: wx,
          y: 3.967,
          z: 94.775,
          rotY: 0,
          width: 1.92,
          height: 0.44,
          colorHex: '#ffd778',
        },
        0.86,
      ),
    ),

    // (Halte shelters use their own clean translucent route-map windbreak glass without extra window-glow overlay panes.)

    // (Boutique Tower upper casements & 1F storefronts use 3D `cityWindowSpec` staggered lighting in
    //  `buddiesUrbanPlazaBuildingsBuilder.ts`; no flat manifest panes overlap `'off'` upper rooms.)
  ];
})();

// ============================================================================
// AUTONOMOUS CITY TRAFFIC SYSTEM (60 FPS, SIGNAL & TRAM COMPLIANT)
// ============================================================================

export type TrafficVehicleKind = 'sedan' | 'van' | 'taxi' | 'coupe';

export type TrafficLoopId =
  | 'ring_cw'
  | 'ring_ccw'
  | 'scurve_central'
  | 'scurve_west'
  | 'residential_south'
  | 'residential_north';

export interface TrafficWaypoint {
  x: number;
  z: number;
  filletRadius?: number;
}

export interface CompiledTrafficSegment {
  kind: 'line' | 'arc';
  startDist: number;
  length: number;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  ux: number;
  uz: number;
  cx: number;
  cz: number;
  radius: number;
  startAngle: number;
  deltaAngle: number;
}

export interface CompiledTrafficTrack {
  id: TrafficLoopId;
  segments: CompiledTrafficSegment[];
  totalLength: number;
}

export interface TrafficTrackSample {
  x: number;
  z: number;
  forwardX: number;
  forwardZ: number;
  yaw: number;
  distance: number;
  totalLength: number;
}

export interface TrafficStopBarSpec {
  id: string;
  signalGroup: 'plaza' | 'north' | 'east';
  /** Expected unit heading direction at this stop bar */
  axis: 'x' | 'z';
  dirSign: 1 | -1;
  stopCoord: number;
  minOrtho: number;
  maxOrtho: number;
}

export interface TrafficVehicleSpec {
  kind: TrafficVehicleKind;
  length: number;
  width: number;
  height: number;
  cruiseSpeedMps: number;
  bodyColorHex: string;
}

export interface TrafficVehicleState {
  id: string;
  kind: TrafficVehicleKind;
  loopId: TrafficLoopId;
  distanceMeters: number;
  speedMps: number;
  cruiseSpeedMps: number;
  x: number;
  z: number;
  yaw: number;
  forwardX: number;
  forwardZ: number;
  halfLength: number;
  halfWidth: number;
  bodyColorHex: string;
  wheelSpinRad: number;
  isBraking: boolean;
  brakeLightIntensity01: number;
  stoppedReason: 'none' | 'signal' | 'tram' | 'headway' | 'pedestrian' | 'junction';
}

export const TRAFFIC_VEHICLE_SPECS: Record<TrafficVehicleKind, TrafficVehicleSpec> = {
  sedan: {
    kind: 'sedan',
    length: 4.4,
    width: 1.88,
    height: 1.56,
    cruiseSpeedMps: 11.2,
    bodyColorHex: '#3b82f6',
  },
  van: {
    kind: 'van',
    length: 4.55,
    width: 1.94,
    height: 2.02,
    cruiseSpeedMps: 9.8,
    bodyColorHex: '#ef4444',
  },
  taxi: {
    kind: 'taxi',
    length: 4.35,
    width: 1.88,
    height: 1.58,
    cruiseSpeedMps: 11.6,
    bodyColorHex: '#facc15',
  },
  coupe: {
    kind: 'coupe',
    length: 4.15,
    width: 1.84,
    height: 1.44,
    cruiseSpeedMps: 12.4,
    bodyColorHex: '#14b8a6',
  },
};

const CAR_LANE_OFFSET_M = 1.6;

/**
 * Computes right-hand lane centerline vertices from a closed road centerline polyline
 * (`offset > 0` shifts to the right of travel direction `(forwardX, forwardZ)`).
 */
function offsetClosedPolylineRight(
  pts: readonly (readonly [number, number])[],
  rightOffsetM: number,
): TrafficWaypoint[] {
  if (Math.abs(rightOffsetM) < 1e-4) {
    return pts.map(([x, z]) => ({ x, z }));
  }
  const n = pts.length;
  const out: TrafficWaypoint[] = [];
  for (let i = 0; i < n; i++) {
    const pPrev = pts[(i - 1 + n) % n];
    const pCurr = pts[i];
    const pNext = pts[(i + 1) % n];

    const dx0 = pCurr[0] - pPrev[0];
    const dz0 = pCurr[1] - pPrev[1];
    const l0 = Math.hypot(dx0, dz0) || 1;
    const u0x = dx0 / l0;
    const u0z = dz0 / l0;

    const dx1 = pNext[0] - pCurr[0];
    const dz1 = pNext[1] - pCurr[1];
    const l1 = Math.hypot(dx1, dz1) || 1;
    const u1x = dx1 / l1;
    const u1z = dz1 / l1;

    // Right normal in XZ plane for forward (ux, uz): (-uz, ux)
    const n0x = -u0z;
    const n0z = u0x;
    const n1x = -u1z;
    const n1z = u1x;

    const bx = n0x + n1x;
    const bz = n0z + n1z;
    const bLen = Math.hypot(bx, bz);
    if (bLen > 1e-4) {
      const ux = bx / bLen;
      const uz = bz / bLen;
      const dot = Math.max(0.45, ux * n0x + uz * n0z);
      const miter = Math.min(rightOffsetM * 1.65, rightOffsetM / dot);
      out.push({
        x: Number((pCurr[0] + ux * miter).toFixed(3)),
        z: Number((pCurr[1] + uz * miter).toFixed(3)),
      });
    } else {
      out.push({
        x: Number((pCurr[0] + n0x * rightOffsetM).toFixed(3)),
        z: Number((pCurr[1] + n0z * rightOffsetM).toFixed(3)),
      });
    }
  }
  return out;
}

/**
 * Compiles a closed-loop filleted polyline track with exact line segments & circular corner arcs
 * (mirroring `compileCityTramTrack` for smooth $C^1$ cornering).
 */
export function compileTrafficTrack(
  id: TrafficLoopId,
  waypoints: readonly TrafficWaypoint[],
  defaultFilletRadius = 4.2,
): CompiledTrafficTrack {
  const n = waypoints.length;
  interface FilletInfo {
    entryX: number;
    entryZ: number;
    exitX: number;
    exitZ: number;
    cx: number;
    cz: number;
    radius: number;
    startAngle: number;
    deltaAngle: number;
    arcLength: number;
  }

  const fillets: FilletInfo[] = [];

  for (let i = 0; i < n; i++) {
    const prev = waypoints[(i - 1 + n) % n];
    const curr = waypoints[i];
    const next = waypoints[(i + 1) % n];

    const inDx = curr.x - prev.x;
    const inDz = curr.z - prev.z;
    const inLen = Math.hypot(inDx, inDz) || 1;
    const uInX = inDx / inLen;
    const uInZ = inDz / inLen;

    const outDx = next.x - curr.x;
    const outDz = next.z - curr.z;
    const outLen = Math.hypot(outDx, outDz) || 1;
    const uOutX = outDx / outLen;
    const uOutZ = outDz / outLen;

    const dot = clamp(uInX * uOutX + uInZ * uOutZ, -0.9999, 0.9999);
    const turnAngle = Math.acos(dot);

    if (turnAngle < 0.02) {
      fillets.push({
        entryX: curr.x,
        entryZ: curr.z,
        exitX: curr.x,
        exitZ: curr.z,
        cx: curr.x,
        cz: curr.z,
        radius: 0,
        startAngle: 0,
        deltaAngle: 0,
        arcLength: 0,
      });
      continue;
    }

    const desiredR = curr.filletRadius ?? defaultFilletRadius;
    const maxAllowedTan = Math.min(inLen, outLen) * 0.42;
    const tanHalf = Math.tan(turnAngle * 0.5);
    const r = Math.min(desiredR, maxAllowedTan / Math.max(1e-4, tanHalf));
    const tanDist = r * tanHalf;

    const entryX = curr.x - uInX * tanDist;
    const entryZ = curr.z - uInZ * tanDist;
    const exitX = curr.x + uOutX * tanDist;
    const exitZ = curr.z + uOutZ * tanDist;

    const cross = uInX * uOutZ - uInZ * uOutX;
    const sign = cross >= 0 ? 1 : -1;

    const nInX = -sign * uInZ;
    const nInZ = sign * uInX;
    const cx = entryX + nInX * r;
    const cz = entryZ + nInZ * r;

    const startAngle = Math.atan2(entryZ - cz, entryX - cx);
    const deltaAngle = sign * turnAngle;
    const arcLength = r * turnAngle;

    fillets.push({
      entryX,
      entryZ,
      exitX,
      exitZ,
      cx,
      cz,
      radius: r,
      startAngle,
      deltaAngle,
      arcLength,
    });
  }

  const segments: CompiledTrafficSegment[] = [];
  let accumDist = 0;

  for (let i = 0; i < n; i++) {
    const prevF = fillets[(i - 1 + n) % n];
    const currF = fillets[i];

    const dx = currF.entryX - prevF.exitX;
    const dz = currF.entryZ - prevF.exitZ;
    const lineLen = Math.hypot(dx, dz);
    if (lineLen > 1e-4) {
      segments.push({
        kind: 'line',
        startDist: accumDist,
        length: lineLen,
        x0: prevF.exitX,
        z0: prevF.exitZ,
        x1: currF.entryX,
        z1: currF.entryZ,
        ux: dx / lineLen,
        uz: dz / lineLen,
        cx: 0,
        cz: 0,
        radius: 0,
        startAngle: 0,
        deltaAngle: 0,
      });
      accumDist += lineLen;
    }

    if (currF.arcLength > 1e-4) {
      segments.push({
        kind: 'arc',
        startDist: accumDist,
        length: currF.arcLength,
        x0: currF.entryX,
        z0: currF.entryZ,
        x1: currF.exitX,
        z1: currF.exitZ,
        ux: 0,
        uz: 0,
        cx: currF.cx,
        cz: currF.cz,
        radius: currF.radius,
        startAngle: currF.startAngle,
        deltaAngle: currF.deltaAngle,
      });
      accumDist += currF.arcLength;
    }
  }

  return { id, segments, totalLength: accumDist };
}

/**
 * Samples a compiled closed traffic track at `distanceMeters` (wraps cleanly modulo `totalLength`).
 */
export function sampleTrafficTrackAtDistance(
  track: CompiledTrafficTrack,
  distanceMeters: number,
): TrafficTrackSample {
  const { segments, totalLength } = track;
  let d = distanceMeters % totalLength;
  if (d < 0) d += totalLength;

  let seg = segments[segments.length - 1];
  for (let i = 0; i < segments.length; i++) {
    const cand = segments[i];
    if (d <= cand.startDist + cand.length || i === segments.length - 1) {
      seg = cand;
      break;
    }
  }

  const localS = clamp(d - seg.startDist, 0, seg.length);
  if (seg.kind === 'line') {
    const x = seg.x0 + seg.ux * localS;
    const z = seg.z0 + seg.uz * localS;
    const yaw = Math.atan2(seg.ux, seg.uz); // model +Z forward -> sin(yaw)=fx, cos(yaw)=fz
    return {
      x,
      z,
      forwardX: seg.ux,
      forwardZ: seg.uz,
      yaw,
      distance: d,
      totalLength,
    };
  }

  const t = seg.length > 1e-5 ? localS / seg.length : 0;
  const angle = seg.startAngle + seg.deltaAngle * t;
  const x = seg.cx + Math.cos(angle) * seg.radius;
  const z = seg.cz + Math.sin(angle) * seg.radius;
  const sign = seg.deltaAngle >= 0 ? 1 : -1;
  const forwardX = -sign * Math.sin(angle);
  const forwardZ = sign * Math.cos(angle);
  const yaw = Math.atan2(forwardX, forwardZ);
  return {
    x,
    z,
    forwardX,
    forwardZ,
    yaw,
    distance: d,
    totalLength,
  };
}

// Compile the 6 valid asphalt vehicle loops:
// 1. Outer Ring Inner Car Lane (CW, dTramSigned = -0.68 -> |x|=69.32, |z|=51.32, R=7.32)
const RING_CW_TRACK = compileTrafficTrack(
  'ring_cw',
  [
    { x: -69.32, z: -51.32, filletRadius: 7.32 },
    { x: 69.32, z: -51.32, filletRadius: 7.32 },
    { x: 69.32, z: 51.32, filletRadius: 7.32 },
    { x: -69.32, z: 51.32, filletRadius: 7.32 },
  ],
  7.32,
);

// 2. Outer Ring Outer Car Lane (CCW, dTramSigned = +2.22 -> |x|=72.22, |z|=54.22, R=10.22)
const RING_CCW_TRACK = compileTrafficTrack(
  'ring_ccw',
  [
    { x: -72.22, z: 54.22, filletRadius: 10.22 },
    { x: 72.22, z: 54.22, filletRadius: 10.22 },
    { x: 72.22, z: -54.22, filletRadius: 10.22 },
    { x: -72.22, z: -54.22, filletRadius: 10.22 },
  ],
  10.22,
);

// 3. Central Urban Plaza + East S-Curve Scenic Circuit (right-hand drive around enlarged Central Urban Plaza)
const SCURVE_CENTRAL_TRACK = compileTrafficTrack(
  'scurve_central',
  offsetClosedPolylineRight(
    [
      [-14.2, 15.6],
      [-14.2, -15.6],
      [8.0, -15.6],
      [18.5, -26.5],
      [19.0, -52.92],
      [42.0, -52.92],
      [43.5, -26.5],
      [54.5, -15.0],
      [70.92, -15.0],
      [70.92, 15.0],
      [54.5, 15.0],
      [43.5, 26.5],
      [42.0, 52.92],
      [19.0, 52.92],
      [18.5, 26.5],
      [8.0, 15.6],
    ],
    CAR_LANE_OFFSET_M,
  ),
  3.6,
);

// 4. West Oasis & SW Boulevard Circuit (right-hand drive via West Ring, open North S-curve, Equator, open South x=-18 connector, & South Ring)
const SCURVE_WEST_TRACK = compileTrafficTrack(
  'scurve_west',
  offsetClosedPolylineRight(
    [
      [-70.92, 52.92],
      [-70.92, -15.0],
      [-52.0, -15.0],
      [-41.0, -26.0],
      [-25.0, -26.0],
      [-14.2, -15.6],
      [-14.2, 15.6],
      [-25.0, 26.0],
      [-18.0, 33.0],
      [-18.0, 52.92],
    ],
    CAR_LANE_OFFSET_M,
  ).map((wp, idx) => (idx === 0 ? { ...wp, filletRadius: 7.32 } : wp)),
  3.6,
);

// 5. South Residential Estate Collector Loop (CCW along South Collector z=52.6 + x=±60 + Rear z=108)
const RESIDENTIAL_SOUTH_TRACK = compileTrafficTrack(
  'residential_south',
  offsetClosedPolylineRight(
    [
      [-60.0, 52.62],
      [-60.0, 108.0],
      [60.0, 108.0],
      [60.0, 52.62],
    ],
    CAR_LANE_OFFSET_M,
  ),
  3.8,
);

// 6. North Residential Estate Collector Loop (CCW mirrored along North Collector z=-52.6 + x=±60 + Rear z=-108)
const RESIDENTIAL_NORTH_TRACK = compileTrafficTrack(
  'residential_north',
  offsetClosedPolylineRight(
    [
      [60.0, -52.62],
      [60.0, -108.0],
      [-60.0, -108.0],
      [-60.0, -52.62],
    ],
    CAR_LANE_OFFSET_M,
  ),
  3.8,
);

export const CITY_TRAFFIC_TRACKS: Record<TrafficLoopId, CompiledTrafficTrack> = {
  ring_cw: RING_CW_TRACK,
  ring_ccw: RING_CCW_TRACK,
  scurve_central: SCURVE_CENTRAL_TRACK,
  scurve_west: SCURVE_WEST_TRACK,
  residential_south: RESIDENTIAL_SOUTH_TRACK,
  residential_north: RESIDENTIAL_NORTH_TRACK,
};

/**
 * Signal stop bars aligned 1:1 with the GLSL road shader stop lines (`evalAllRoadCenterMarkings`)
 * and `PLAZA_TRAFFIC_SIGNAL_SPEC`.
 */
export const TRAFFIC_SIGNAL_STOP_BARS: readonly TrafficStopBarSpec[] = [
  // Central Plaza West Northbound (single North crosswalk stop bar z = -5.40)
  {
    id: 'plaza_nb_north',
    signalGroup: 'plaza',
    axis: 'z',
    dirSign: -1,
    stopCoord: PLAZA_TRAFFIC_SIGNAL_SPEC.northStopBarZ, // -5.40
    minOrtho: -73.6,
    maxOrtho: -67.5,
  },
  // Central Plaza West Southbound (outer car lane ahead of North crosswalk z = -11.40)
  {
    id: 'plaza_sb_north',
    signalGroup: 'plaza',
    axis: 'z',
    dirSign: 1,
    stopCoord: -11.4,
    minOrtho: -73.6,
    maxOrtho: -68.0,
  },
  // North Residence Eastbound (inner car lane x = +6.60)
  {
    id: 'north_res_eb',
    signalGroup: 'north',
    axis: 'x',
    dirSign: 1,
    stopCoord: PLAZA_TRAFFIC_SIGNAL_SPEC.northResStopBarX, // +6.60
    minOrtho: -55.9,
    maxOrtho: -48.0,
  },
  // North Residence Westbound (outer car lane x = +13.00)
  {
    id: 'north_res_wb',
    signalGroup: 'north',
    axis: 'x',
    dirSign: -1,
    stopCoord: PLAZA_TRAFFIC_SIGNAL_SPEC.northResWestboundStopBarX, // +13.00
    minOrtho: -55.9,
    maxOrtho: -49.5,
  },
  // East Harbor Southbound (inner car lane)
  {
    id: 'east_sb',
    signalGroup: 'east',
    axis: 'z',
    dirSign: 1,
    stopCoord: PLAZA_TRAFFIC_SIGNAL_SPEC.eastStopBarZ, // -3.20
    minOrtho: 67.5,
    maxOrtho: 73.6,
  },
  // East Harbor Northbound (outer car lane)
  {
    id: 'east_nb',
    signalGroup: 'east',
    axis: 'z',
    dirSign: -1,
    stopCoord: 3.2,
    minOrtho: 68.0,
    maxOrtho: 73.6,
  },
];

interface InitialVehicleSeed {
  id: string;
  kind: TrafficVehicleKind;
  loopId: TrafficLoopId;
  frac: number;
  bodyColorHex: string;
}

const INITIAL_FLEET_SEEDS: readonly InitialVehicleSeed[] = [
  // 4 vehicles on Ring CW
  { id: 'car_rcw_1', kind: 'taxi', loopId: 'ring_cw', frac: 0.04, bodyColorHex: '#facc15' },
  { id: 'car_rcw_2', kind: 'sedan', loopId: 'ring_cw', frac: 0.28, bodyColorHex: '#3b82f6' },
  { id: 'car_rcw_3', kind: 'van', loopId: 'ring_cw', frac: 0.54, bodyColorHex: '#ef4444' },
  { id: 'car_rcw_4', kind: 'coupe', loopId: 'ring_cw', frac: 0.79, bodyColorHex: '#10b981' },
  // 4 vehicles on Ring CCW
  { id: 'car_rccw_1', kind: 'sedan', loopId: 'ring_ccw', frac: 0.12, bodyColorHex: '#f8fafc' },
  { id: 'car_rccw_2', kind: 'coupe', loopId: 'ring_ccw', frac: 0.37, bodyColorHex: '#f97316' },
  { id: 'car_rccw_3', kind: 'taxi', loopId: 'ring_ccw', frac: 0.62, bodyColorHex: '#facc15' },
  { id: 'car_rccw_4', kind: 'van', loopId: 'ring_ccw', frac: 0.88, bodyColorHex: '#2563eb' },
  // 3 vehicles on Central Park / East S-Curve Circuit
  { id: 'car_sc_1', kind: 'taxi', loopId: 'scurve_central', frac: 0.08, bodyColorHex: '#facc15' },
  { id: 'car_sc_2', kind: 'sedan', loopId: 'scurve_central', frac: 0.42, bodyColorHex: '#ef4444' },
  { id: 'car_sc_3', kind: 'coupe', loopId: 'scurve_central', frac: 0.74, bodyColorHex: '#38bdf8' },
  // 2 vehicles on West S-Curve Circuit
  { id: 'car_sw_1', kind: 'sedan', loopId: 'scurve_west', frac: 0.18, bodyColorHex: '#6366f1' },
  { id: 'car_sw_2', kind: 'van', loopId: 'scurve_west', frac: 0.68, bodyColorHex: '#14b8a6' },
  // 2 vehicles on South Residential Loop
  { id: 'car_rs_1', kind: 'sedan', loopId: 'residential_south', frac: 0.22, bodyColorHex: '#e11d48' },
  { id: 'car_rs_2', kind: 'van', loopId: 'residential_south', frac: 0.72, bodyColorHex: '#f8fafc' },
  // 1 vehicle on North Residential Loop
  { id: 'car_rn_1', kind: 'coupe', loopId: 'residential_north', frac: 0.35, bodyColorHex: '#0ea5e9' },
];

export function createInitialTrafficFleetState(): TrafficVehicleState[] {
  return INITIAL_FLEET_SEEDS.map((seed) => {
    const track = CITY_TRAFFIC_TRACKS[seed.loopId];
    const spec = TRAFFIC_VEHICLE_SPECS[seed.kind];
    const dist = track.totalLength * seed.frac;
    const sample = sampleTrafficTrackAtDistance(track, dist);
    return {
      id: seed.id,
      kind: seed.kind,
      loopId: seed.loopId,
      distanceMeters: dist,
      speedMps: spec.cruiseSpeedMps * 0.85,
      cruiseSpeedMps: spec.cruiseSpeedMps,
      x: sample.x,
      z: sample.z,
      yaw: sample.yaw,
      forwardX: sample.forwardX,
      forwardZ: sample.forwardZ,
      halfLength: spec.length * 0.5,
      halfWidth: spec.width * 0.5,
      bodyColorHex: seed.bodyColorHex,
      wheelSpinRad: 0,
      isBraking: false,
      brakeLightIntensity01: 0,
      stoppedReason: 'none',
    };
  });
}

function minDistToTramConsist(
  x: number,
  z: number,
  tramState: CityTramConsistState,
): number {
  const halfLen = CITY_TRAM_SPEC.carLength * 0.5;
  const halfWid = CITY_TRAM_SPEC.carWidth * 0.5;
  const jointForwardX = Math.cos(tramState.joint.yaw);
  const jointForwardZ = -Math.sin(tramState.joint.yaw);
  const jointHalfLen = Math.max(CITY_TRAM_SPEC.jointLength, tramState.joint.spanLength) * 0.5 + 0.65;
  const jointHalfWid = CITY_TRAM_SPEC.carWidth * 0.49;

  const sections = [
    {
      x: tramState.car1.x,
      z: tramState.car1.z,
      forwardX: tramState.car1.forwardX,
      forwardZ: tramState.car1.forwardZ,
      halfX: halfLen,
      halfZ: halfWid,
    },
    {
      x: tramState.joint.x,
      z: tramState.joint.z,
      forwardX: jointForwardX,
      forwardZ: jointForwardZ,
      halfX: jointHalfLen,
      halfZ: jointHalfWid,
    },
    {
      x: tramState.car2.x,
      z: tramState.car2.z,
      forwardX: tramState.car2.forwardX,
      forwardZ: tramState.car2.forwardZ,
      halfX: halfLen,
      halfZ: halfWid,
    },
  ] as const;

  let best = Infinity;
  for (const sec of sections) {
    const dx = x - sec.x;
    const dz = z - sec.z;
    const rightX = -sec.forwardZ;
    const rightZ = sec.forwardX;
    const lLong = Math.abs(dx * sec.forwardX + dz * sec.forwardZ);
    const lLat = Math.abs(dx * rightX + dz * rightZ);
    const d = Math.hypot(Math.max(0, lLong - sec.halfX), Math.max(0, lLat - sec.halfZ));
    if (d < best) best = d;
  }
  return best;
}

function isPointInTramApproachSweep(
  x: number,
  z: number,
  tramState: CityTramConsistState,
): boolean {
  const c1 = tramState.car1;
  const noseX = c1.x + c1.forwardX * (CITY_TRAM_SPEC.carLength * 0.5);
  const noseZ = c1.z + c1.forwardZ * (CITY_TRAM_SPEC.carLength * 0.5);
  const dx = x - noseX;
  const dz = z - noseZ;
  const longAhead = dx * c1.forwardX + dz * c1.forwardZ;
  const latDist = Math.abs(-dx * c1.forwardZ + dz * c1.forwardX);
  return longAhead >= -1.0 && longAhead <= 19.0 && latDist <= 3.6;
}

function evalTramTrackCenterOffset(x: number, z: number): number {
  const qx = Math.abs(x) - 62.0;
  const qz = Math.abs(z) - 44.0;
  const signedSdf =
    Math.hypot(Math.max(0, qx), Math.max(0, qz)) + Math.min(0, Math.max(qx, qz)) - 3.0;
  return Math.abs(signedSdf);
}

export interface TrafficStepInput {
  tramState: CityTramConsistState;
  plazaSignalState: PlazaTrafficSignalState;
  northSignalState?: PlazaTrafficSignalState;
  eastSignalState: PlazaTrafficSignalState;
  pedestrians?: ReadonlyArray<{ x: number; z: number }>;
  playerPose?: { x: number; z: number; alive?: boolean } | null;
}

/**
 * Advances all pooled AI vehicles smoothly for `dt` seconds while obeying:
 * 1. Central Plaza, North Residence & East Harbor traffic lights (braking smoothly ahead of stop bars).
 * 2. City Tram consist OBB + forward approach sweep yielding at track crossings.
 * 3. Safe same-lane following headway (`>= 3.4m` stopped, velocity-scaled while cruising).
 * 4. Cross-loop merge/junction right-of-way yielding.
 * 5. Active pedestrian & player yield zones ahead of the vehicle bumper.
 */
export function stepCityTrafficFleet(
  vehicles: TrafficVehicleState[],
  dt: number,
  input: TrafficStepInput,
): void {
  const stepDt = Math.max(0, Math.min(0.1, dt));
  if (stepDt <= 0) return;

  const {
    tramState,
    plazaSignalState,
    northSignalState,
    eastSignalState,
    pedestrians = [],
    playerPose,
  } = input;

  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];
    const track = CITY_TRAFFIC_TRACKS[v.loopId];
    let targetSpeed = v.cruiseSpeedMps;
    let reason: TrafficVehicleState['stoppedReason'] = 'none';

    const noseX = v.x + v.forwardX * v.halfLength;
    const noseZ = v.z + v.forwardZ * v.halfLength;

    // 1. Traffic Signal Stop Bars (Central Plaza, North Residence & East Harbor)
    for (let si = 0; si < TRAFFIC_SIGNAL_STOP_BARS.length; si++) {
      const bar = TRAFFIC_SIGNAL_STOP_BARS[si];
      const sig =
        bar.signalGroup === 'plaza'
          ? plazaSignalState
          : bar.signalGroup === 'north'
            ? (northSignalState ?? plazaSignalState)
            : eastSignalState;
      if (sig.phase === 'tram_green') continue;

      const ortho = bar.axis === 'z' ? v.x : v.z;
      if (ortho < bar.minOrtho || ortho > bar.maxOrtho) continue;

      const forwardComponent = bar.axis === 'z' ? v.forwardZ : v.forwardX;
      if (forwardComponent * bar.dirSign < 0.72) continue;

      const noseCoord = bar.axis === 'z' ? noseZ : noseX;
      const distToBar = (bar.stopCoord - noseCoord) * bar.dirSign;
      const reqStop = (v.speedMps * v.speedMps) / (2 * 11.5);

      if (distToBar >= -0.4 && distToBar <= 22.0 && (distToBar >= reqStop - 0.35 || v.speedMps <= 1.6)) {
        if (distToBar <= 0.55) {
          targetSpeed = 0;
          reason = 'signal';
        } else {
          const brakeLim = Math.sqrt(Math.max(0, 2 * 5.4 * Math.max(0, distToBar - 0.35)));
          if (brakeLim < targetSpeed) {
            targetSpeed = brakeLim;
            reason = 'signal';
          }
        }
        break;
      }
    }

    // 2. City Tram Consist Yielding (stop outside rail clearance before crossing; parallel ring lanes stay flowing)
    const centerTrackDist = evalTramTrackCenterOffset(v.x, v.z);
    const noseTrackDist = evalTramTrackCenterOffset(noseX, noseZ);
    const probeDistM = 3.2 + (v.speedMps * v.speedMps) / (2 * 16.5);
    const probeX = noseX + v.forwardX * probeDistM;
    const probeZ = noseZ + v.forwardZ * probeDistM;
    const probeTrackDist = evalTramTrackCenterOffset(probeX, probeZ);
    const movingAwayFromRails = centerTrackDist <= 1.8 && noseTrackDist > centerTrackDist + 0.4;
    const approachingOrCrossingRails = noseTrackDist <= 2.5 || probeTrackDist <= 2.5;

    if (approachingOrCrossingRails && !movingAwayFromRails) {
      const tramNearNose = minDistToTramConsist(noseX, noseZ, tramState);
      const tramNearProbe = minDistToTramConsist(probeX, probeZ, tramState);
      if (
        tramNearNose < 3.4 ||
        tramNearProbe < 5.6 ||
        isPointInTramApproachSweep(probeX, probeZ, tramState)
      ) {
        targetSpeed = 0;
        reason = 'tram';
      }
    }

    // 3. Same-Loop Following Headway
    const minStopGap = 3.2;
    const desiredGap = minStopGap + v.speedMps * 0.62;
    for (let j = 0; j < vehicles.length; j++) {
      if (i === j) continue;
      const other = vehicles[j];
      if (other.loopId !== v.loopId) continue;

      let centerDelta = other.distanceMeters - v.distanceMeters;
      if (centerDelta < 0) centerDelta += track.totalLength;
      if (centerDelta <= 0.01) continue;

      const bumperGap = centerDelta - (v.halfLength + other.halfLength);
      const stopBuffer = other.speedMps < 0.4 ? minStopGap + 0.55 : minStopGap;
      if (bumperGap < desiredGap + 12.0) {
        let cap: number;
        if (bumperGap <= minStopGap) {
          cap = 0;
        } else {
          const gapRem = Math.max(0, bumperGap - stopBuffer);
          cap = Math.sqrt(other.speedMps * other.speedMps + 2 * 5.2 * gapRem);
        }
        if (cap < targetSpeed) {
          targetSpeed = cap;
          reason = 'headway';
        }
      }
    }

    // 4. Cross-Loop Junction Right-of-Way Yielding
    const rightX = -v.forwardZ;
    const rightZ = v.forwardX;
    for (let j = 0; j < vehicles.length; j++) {
      if (i === j) continue;
      const other = vehicles[j];
      if (other.loopId === v.loopId) continue;

      const dx = other.x - v.x;
      const dz = other.z - v.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > 11.5 * 11.5) continue;

      const longAhead = dx * v.forwardX + dz * v.forwardZ - v.halfLength;
      const latDist = Math.abs(dx * rightX + dz * rightZ);
      // Only yield to cross/ahead cars blocking our forward corridor; tie-break by index
      const otherBlocksUs =
        longAhead >= -0.4 && longAhead <= 7.8 && latDist <= v.halfWidth + other.halfWidth + 0.65;
      if (otherBlocksUs) {
        // Check if we are ahead of them (avoid mutual deadlock by lower-index priority when both face)
        const odx = v.x - other.x;
        const odz = v.z - other.z;
        const usAheadOfOther = odx * other.forwardX + odz * other.forwardZ - other.halfLength;
        const usLat = Math.abs(odx * -other.forwardZ + odz * other.forwardX);
        const mutual = usAheadOfOther >= -0.4 && usAheadOfOther <= 7.8 && usLat <= 2.6;
        if (!mutual || i > j) {
          targetSpeed = 0;
          reason = 'junction';
          break;
        }
      }
    }

    // 5. Pedestrian & Player Yielding
    const yieldProbeDist = v.halfLength + 6.8;
    const checkPedestrianAhead = (px: number, pz: number): boolean => {
      const dx = px - v.x;
      const dz = pz - v.z;
      const longAhead = dx * v.forwardX + dz * v.forwardZ;
      const latDist = Math.abs(dx * rightX + dz * rightZ);
      return longAhead >= v.halfLength - 0.3 && longAhead <= yieldProbeDist && latDist <= v.halfWidth + 1.05;
    };

    if (playerPose && playerPose.alive !== false && checkPedestrianAhead(playerPose.x, playerPose.z)) {
      targetSpeed = 0;
      reason = 'pedestrian';
    } else {
      for (let pi = 0; pi < pedestrians.length; pi++) {
        const ped = pedestrians[pi];
        if (checkPedestrianAhead(ped.x, ped.z)) {
          targetSpeed = 0;
          reason = 'pedestrian';
          break;
        }
      }
    }

    // Smooth Velocity Integration
    const prevSpeed = v.speedMps;
    if (v.speedMps > targetSpeed) {
      const decel = reason === 'pedestrian' || reason === 'tram' ? 16.5 : 12.2;
      v.speedMps = Math.max(targetSpeed, v.speedMps - decel * stepDt);
    } else if (v.speedMps < targetSpeed) {
      v.speedMps = Math.min(targetSpeed, v.speedMps + 5.6 * stepDt);
    }

    const isDecelerating = targetSpeed < prevSpeed - 0.15 || v.speedMps < prevSpeed - 0.05;
    const isStoppedYielding = v.speedMps < 0.45 && reason !== 'none';
    v.isBraking = isDecelerating || isStoppedYielding;
    v.stoppedReason = reason;

    const targetBrakeGlow = v.isBraking ? 1.0 : 0.18;
    v.brakeLightIntensity01 +=
      (targetBrakeGlow - v.brakeLightIntensity01) * Math.min(1, stepDt * 12.0);

    // Advance along track & sample C1-smooth pose
    v.distanceMeters = (v.distanceMeters + v.speedMps * stepDt) % track.totalLength;
    if (v.distanceMeters < 0) v.distanceMeters += track.totalLength;

    const nextSample = sampleTrafficTrackAtDistance(track, v.distanceMeters);
    // Smooth yaw delta cleanly across ±π
    const yawDiff = shortestAngleDelta(v.yaw, nextSample.yaw);
    v.yaw = v.yaw + yawDiff * Math.min(1, stepDt * 18.0);
    v.x = nextSample.x;
    v.z = nextSample.z;
    v.forwardX = nextSample.forwardX;
    v.forwardZ = nextSample.forwardZ;
    v.wheelSpinRad = (v.wheelSpinRad + (v.speedMps * stepDt) / 0.34) % (Math.PI * 2);
  }
}

// ============================================================================
// LANTERN BILLBOARD GLOW & FILAMENT CORE CURVES
// ============================================================================

export const LANTERN_BILLBOARD_CONFIG = {
  dayCutoffNightFactor: 0.05,
  rampEndNightFactor: 0.22,
  nearScaleMultiplier: 0.86,
  farScaleMultiplier: 2.3,
  nearDistanceMeters: 4.0,
  farDistanceMeters: 75.0,
  closeOpacityMin: 0.68,
  closeOpacityNearDist: 1.8,
  closeOpacityFullDist: 7.5,
  farBoostMax: 1.24,
  farBoostStartDist: 25.0,
  farBoostEndDist: 85.0,
  farDepthNudgeMax: 0.28,
  farDepthNudgeStartDist: 18.0,
  farDepthNudgeEndDist: 60.0,
  radialEdgeZeroAt: 0.96,
} as const;

export interface LanternBillboardDistanceMetrics {
  scaleMultiplier: number;
  quadSizeMeters: number;
  closeAlphaDamp: number;
  farAlphaBoost: number;
  farDepthNudge: number;
}

/**
 * Evaluates camera-distance scaling and opacity damping matching the GPU billboard vertex/fragment shaders:
 * - Close-ups stay compact (`0.86x` baseSize, damped center alpha, zero Z-nudge) so dark frames,
 *   bronze mullions, Edison filaments, and flower baskets remain crisp and un-washed.
 * - Distant lamps grow smoothly (`up to 2.30x`) so boulevards remain warmly readable without hard edges.
 */
export function evaluateLanternBillboardDistanceScale(
  baseSizeMeters: number,
  cameraDistanceMeters: number,
): LanternBillboardDistanceMetrics {
  const safeDist = Math.max(0.5, Number.isFinite(cameraDistanceMeters) ? cameraDistanceMeters : 0.5);
  const safeBase = Math.max(0.05, Number.isFinite(baseSizeMeters) ? baseSizeMeters : 0.5);
  const cfg = LANTERN_BILLBOARD_CONFIG;

  const distT = smoothstep01(cfg.nearDistanceMeters, cfg.farDistanceMeters, safeDist);
  const scaleMultiplier = lerpNum(cfg.nearScaleMultiplier, cfg.farScaleMultiplier, distT);
  const closeAlphaDamp = lerpNum(
    cfg.closeOpacityMin,
    1.0,
    smoothstep01(cfg.closeOpacityNearDist, cfg.closeOpacityFullDist, safeDist),
  );
  const farAlphaBoost = lerpNum(
    1.0,
    cfg.farBoostMax,
    smoothstep01(cfg.farBoostStartDist, cfg.farBoostEndDist, safeDist),
  );
  const farDepthNudge =
    cfg.farDepthNudgeMax * smoothstep01(cfg.farDepthNudgeStartDist, cfg.farDepthNudgeEndDist, safeDist);

  return {
    scaleMultiplier,
    quadSizeMeters: safeBase * scaleMultiplier,
    closeAlphaDamp,
    farAlphaBoost,
    farDepthNudge,
  };
}

/**
 * Smooth Gaussian + raised-cosine radial gradient falloff (`r in [0..1]`):
 * - C^1 smooth peak at center (`1.0`)
 * - Smooth optical Gaussian core + warm aureole
 * - Strictly `0.0` at `r >= 0.96` with zero derivative so additive billboard quads never show polygon edges.
 */
export function evaluateSmoothRadialGlowFalloff(normalizedRadius01: number): number {
  const r = clamp01(Number.isFinite(normalizedRadius01) ? normalizedRadius01 : 1);
  if (r >= LANTERN_BILLBOARD_CONFIG.radialEdgeZeroAt) return 0;
  const u = r / LANTERN_BILLBOARD_CONFIG.radialEdgeZeroAt;
  const cosineWindow = 0.5 * (1.0 + Math.cos(Math.PI * u));
  const smoothEdge = cosineWindow * cosineWindow;
  const hotCore = Math.exp(-r * r * 16.5) * 0.55;
  const warmAura = Math.exp(-r * r * 4.6) * 0.45;
  return clamp01((hotCore + warmAura) * smoothEdge);
}

export interface LanternCoreAndSpriteState {
  active: boolean;
  ramp01: number;
  billboardOpacity: number;
  glassEmissiveIntensity: number;
  bulbEmissiveIntensity: number;
  filamentEmissiveIntensity: number;
}

/**
 * Computes coordinated inner-glass, Edison-bulb, filament-core, and billboard-sprite levels
 * from `effectiveDrive01` (`nightFactor01` or `streetLampBrightness01`).
 * Ensures `effectiveDrive01 <= 0.05` renders clean unlit glass with sprites hidden (`0`).
 */
export function evaluateLanternCoreAndSpriteState(
  effectiveDrive01: number,
): LanternCoreAndSpriteState {
  const drive = Math.max(0, Number.isFinite(effectiveDrive01) ? effectiveDrive01 : 0);
  if (drive <= LANTERN_BILLBOARD_CONFIG.dayCutoffNightFactor) {
    return {
      active: false,
      ramp01: 0,
      billboardOpacity: 0,
      glassEmissiveIntensity: 0.02,
      bulbEmissiveIntensity: 0.12,
      filamentEmissiveIntensity: 0.15,
    };
  }
  const ramp01 = smoothstep01(
    LANTERN_BILLBOARD_CONFIG.dayCutoffNightFactor,
    LANTERN_BILLBOARD_CONFIG.rampEndNightFactor,
    drive,
  );
  const effective = Math.min(2.2, drive * ramp01);
  return {
    active: true,
    ramp01,
    billboardOpacity: clamp(0.10 + effective * 0.58, 0, 0.86),
    glassEmissiveIntensity: clamp(0.02 + effective * 0.92, 0.02, 1.32),
    bulbEmissiveIntensity: clamp(0.12 + effective * 1.75, 0.12, 2.55),
    filamentEmissiveIntensity: clamp(0.15 + effective * 2.45, 0.15, 3.40),
  };
}
