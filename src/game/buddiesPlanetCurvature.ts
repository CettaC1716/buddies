import * as THREE from 'three';
import { evaluateBeachClubElevation } from './buddiesBeachClubRules';
import { evaluateCentralParkElevation } from './buddiesCentralParkRules';
import {
  evaluateGrandCasinoHillClear,
  evaluateGrandCasinoPavedPlatformSdf,
  evaluateGrandCasinoSidewalkElevation,
  evaluateGrandCasinoValetLoopSdf,
  isPointOnGrandCasinoCrosswalk,
} from './buddiesGrandCasinoRules';
import {
  COASTAL_HILL_RIDGE_ELEV_Y,
  COASTAL_HILL_ROAD_HALF_WIDTH,
  COASTAL_HILL_WALKABLE_HALF_WIDTH,
  evaluateCoastalHillRoadSample,
  evaluateHillVillaDrivewayApronSdf,
  evaluateHillVillaPlateauSdf,
} from './buddiesCoastalHillsRules';

/**
 * Flat Ground Map (Original Buddies Blitz / Blitz World):
 * Planet curvature is disabled (0.0) so the entire world is 100% flat (elevation = 0, curvature = 0).
 */
export const PLANET_CURVATURE_STRENGTH = 0.0;

/**
 * Playable arena bounds [-156, +156] in X and Z (expanded 3-part North-Central-South arena
 * with Base Outer Ring Roads, San Francisco-style Coastal Switchbacks, Twin Peaks Scenic Ridge Loop,
 * and 3 flat +8.50m Hilltop Villa Plateaus).
 */
export const PLANET_HALF_EXTENT = 156.0;
export const PLANET_WORLD_PERIOD = 312.0;

/**
 * Legacy constants kept at 0.0 (no carved rivers or bridges in the flat Blitz world).
 */
export const PLANET_RIVERBED_DEPTH = 0.0;
export const PLANET_WATER_SURFACE_Y = 0.0;

export interface PlanetBridgeSpec {
  id: string;
  x: number;
  z: number;
  yaw: number;
  halfWidth: number;
  halfSpan: number;
  archHeight: number;
}

export const PLANET_BRIDGES: readonly PlanetBridgeSpec[] = [];

/**
 * Shared world geometry & walkable bounds for the SE Beachfront Stilt Timber Cabin
 * ("Rumah Papan Panggung Tepi Pantai"), synchronized between 3D mesh builder, ground elevation,
 * ocean barrier, OBB colliders, and underwater ecology exclusions.
 */
export const BEACHFRONT_STILT_CABIN_SPEC = {
  centerX: 131.6,
  centerZ: 95.2,
  baseSandY: -2.0,
  deckTopY: -1.04,
  deckMinX: 127.6,
  deckMaxX: 135.6,
  deckMinZ: 91.5,
  deckMaxZ: 100.0,
  stairMinX: 131.2,
  stairMaxX: 133.6,
  stairMinZ: 90.3,
  stairMaxZ: 91.5,
  cabinBodyMinX: 130.0,
  cabinBodyMaxX: 134.8,
  cabinBodyMinZ: 93.6,
  cabinBodyMaxZ: 97.7,
} as const;

export function isPointOnBeachfrontStiltCabinDeck(worldX: number, worldZ: number): boolean {
  const c = BEACHFRONT_STILT_CABIN_SPEC;
  return (
    worldX >= c.deckMinX + 0.35 &&
    worldX <= c.deckMaxX - 0.35 &&
    worldZ >= c.deckMinZ &&
    worldZ <= c.deckMaxZ - 0.35
  );
}

export function evaluateBeachfrontStiltCabinElevation(worldX: number, worldZ: number): number {
  const c = BEACHFRONT_STILT_CABIN_SPEC;
  if (
    worldX >= c.deckMinX &&
    worldX <= c.deckMaxX &&
    worldZ >= c.deckMinZ &&
    worldZ <= c.deckMaxZ
  ) {
    return c.deckTopY;
  }
  if (
    worldX >= c.stairMinX &&
    worldX <= c.stairMaxX &&
    worldZ >= c.stairMinZ &&
    worldZ <= c.stairMaxZ
  ) {
    const t = Math.max(0, Math.min(1, (worldZ - c.stairMinZ) / (c.stairMaxZ - c.stairMinZ)));
    return c.baseSandY + (c.deckTopY - c.baseSandY) * t;
  }
  return -Infinity;
}

/**
 * Clamps a world coordinate cleanly within the flat arena bounds [-PLANET_HALF_EXTENT, +PLANET_HALF_EXTENT]
 * (no toroidal coordinate wrapping jump).
 */
export function wrapPlanetCoord(coord: number, period: number = PLANET_WORLD_PERIOD): number {
  const half = period * 0.5;
  return Math.max(-half, Math.min(half, coord));
}

/**
 * Standard Euclidean signed delta (target - reference) on the flat Blitz map.
 */
export function getPlanetShortestDelta(
  target: number,
  reference: number,
  _period: number = PLANET_WORLD_PERIOD,
): number {
  return target - reference;
}

/**
 * Standard 2D Euclidean distance between two points on the flat Blitz map.
 */
export function getPlanetShortestDistance(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  _period: number = PLANET_WORLD_PERIOD,
): number {
  return Math.hypot(ax - bx, az - bz);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ============================================================================
// LIVE TERRAIN SCULPTING HEIGHTMAP GRID (64x64 FLAT ARENA GRID FOR MAP EDITOR)
// Default is 0.0 everywhere (100% flat ground)
// ============================================================================
export const SCULPT_GRID_SIZE = 64;
const terrainSculptGrid = new Float32Array(SCULPT_GRID_SIZE * SCULPT_GRID_SIZE);
export const terrainSculptRgbaData = new Uint8Array(SCULPT_GRID_SIZE * SCULPT_GRID_SIZE * 4);
export let terrainSculptVersion = 1;

function initTerrainSculptBuffer() {
  for (let i = 0; i < SCULPT_GRID_SIZE * SCULPT_GRID_SIZE; i++) {
    terrainSculptGrid[i] = 0;
    const idx4 = i * 4;
    terrainSculptRgbaData[idx4] = 128;
    terrainSculptRgbaData[idx4 + 1] = 128;
    terrainSculptRgbaData[idx4 + 2] = 128;
    terrainSculptRgbaData[idx4 + 3] = 255;
  }
}
initTerrainSculptBuffer();

function syncCellToRgba(cellIndex: number, heightOffset: number) {
  const clamped = Math.max(-7.5, Math.min(7.5, heightOffset));
  const byteVal = Math.max(0, Math.min(255, Math.round(clamped * 16.0 + 128.0)));
  const quantized = (byteVal - 128.0) * 0.0625;
  terrainSculptGrid[cellIndex] = quantized;
  const idx4 = cellIndex * 4;
  terrainSculptRgbaData[idx4] = byteVal;
  terrainSculptRgbaData[idx4 + 1] = byteVal;
  terrainSculptRgbaData[idx4 + 2] = byteVal;
  terrainSculptRgbaData[idx4 + 3] = 255;
}

export function resetTerrainSculptGrid(): void {
  initTerrainSculptBuffer();
  terrainSculptVersion++;
}

export function serializeTerrainSculptGrid(): number[] {
  const hasNonZero = terrainSculptGrid.some((v) => Math.abs(v) > 0.001);
  if (!hasNonZero) return [];
  return Array.from(terrainSculptRgbaData.filter((_, i) => i % 4 === 0));
}

export function restoreTerrainSculptGrid(rBytes?: number[]): void {
  if (!rBytes || rBytes.length !== SCULPT_GRID_SIZE * SCULPT_GRID_SIZE) {
    resetTerrainSculptGrid();
    return;
  }
  for (let i = 0; i < SCULPT_GRID_SIZE * SCULPT_GRID_SIZE; i++) {
    const b = Math.max(0, Math.min(255, Math.round(rBytes[i] ?? 128)));
    terrainSculptGrid[i] = (b - 128.0) * 0.0625;
    const idx4 = i * 4;
    terrainSculptRgbaData[idx4] = b;
    terrainSculptRgbaData[idx4 + 1] = b;
    terrainSculptRgbaData[idx4 + 2] = b;
    terrainSculptRgbaData[idx4 + 3] = 255;
  }
  terrainSculptVersion++;
}

export function sampleTerrainSculptOffset(worldX: number, worldZ: number): number {
  const px = wrapPlanetCoord(worldX);
  const pz = wrapPlanetCoord(worldZ);
  const u = ((px + PLANET_HALF_EXTENT) / PLANET_WORLD_PERIOD) * SCULPT_GRID_SIZE - 0.5;
  const v = ((pz + PLANET_HALF_EXTENT) / PLANET_WORLD_PERIOD) * SCULPT_GRID_SIZE - 0.5;

  const x0 = Math.floor(u);
  const z0 = Math.floor(v);
  const fx = u - x0;
  const fz = v - z0;

  const ix0 = Math.max(0, Math.min(SCULPT_GRID_SIZE - 1, x0));
  const ix1 = Math.max(0, Math.min(SCULPT_GRID_SIZE - 1, x0 + 1));
  const iz0 = Math.max(0, Math.min(SCULPT_GRID_SIZE - 1, z0));
  const iz1 = Math.max(0, Math.min(SCULPT_GRID_SIZE - 1, z0 + 1));

  const v00 = terrainSculptGrid[iz0 * SCULPT_GRID_SIZE + ix0];
  const v10 = terrainSculptGrid[iz0 * SCULPT_GRID_SIZE + ix1];
  const v01 = terrainSculptGrid[iz1 * SCULPT_GRID_SIZE + ix0];
  const v11 = terrainSculptGrid[iz1 * SCULPT_GRID_SIZE + ix1];

  const top = v00 + (v10 - v00) * fx;
  const bot = v01 + (v11 - v01) * fx;
  return top + (bot - top) * fz;
}

/**
 * Multi-octave organic noise in [-1, +1] used for soft splatmap edge perturbation & soil variation.
 * Matches the GLSL shader function samplePlanetMultiOctaveNoise(vec2 p) 1:1.
 */
export function samplePlanetMultiOctaveNoise(worldX: number, worldZ: number): number {
  const x = worldX;
  const z = worldZ;
  const k1 = 0.07853981633974483;
  const k2 = 0.15707963267948966;
  const k3 = 0.3141592653589793;

  const octave1 =
    Math.sin(x * k1 + Math.cos(z * k1) * 1.15) *
    Math.cos(z * k1 - Math.sin(x * k1) * 0.95);
  const octave2 =
    Math.sin(x * k2 - z * k1 * 1.5 + 1.3) * 0.55 +
    Math.cos(z * k2 + x * k1 - 0.8) * 0.45;
  const octave3 =
    Math.sin(x * k3 + z * k2) * Math.cos(z * k3 - x * k2);

  return octave1 * 0.58 + octave2 * 0.28 + octave3 * 0.14;
}

function sdSegment2D(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const pax = px - ax;
  const paz = pz - az;
  const bax = bx - ax;
  const baz = bz - az;
  const h = Math.max(0, Math.min(1, (pax * bax + paz * baz) / (bax * bax + baz * baz + 1e-6)));
  return Math.hypot(pax - bax * h, paz - baz * h);
}

function sdRoundedBox2D(
  px: number,
  pz: number,
  cx: number,
  cz: number,
  hx: number,
  hz: number,
  r: number,
): number {
  const qx = Math.abs(px - cx) - hx + r;
  const qz = Math.abs(pz - cz) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
}

function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0.0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/**
 * Signed distance to the Widened West Elevated Lobby & Skin Shop Plaza ("Lobby Area & Toko-Toko Skin"):
 * - Set back -2.25m to span x in [-110.75, -78.75], z in [-38.0, +38.0] (aligned flush with Tennis Court Fence -78.82)
 * - Returns < 0.0 inside the elevated lobby platform
 */
export function evaluateWestPowerPlantSdf(worldX: number, worldZ: number): number {
  return sdRoundedBox2D(worldX, worldZ, -94.75, 0.0, 16.0, 38.0, 2.4);
}

/**
 * Signed distance to the 100% North-South Mirrored East Dirt Construction Yards ("Area Tanah Alat-Alat Konstruksi"):
 * - Located between the East Outer Ring / Base Complex Road (x = 70.0) and the East Coastal Concrete Seawall (x = 101.5)
 * - Spans x in [75.5, 101.5], |z| in [46.0, 104.0]
 * - Returns < 0.0 inside the compacted dirt construction yard
 */
export function evaluateEastConstructionYardSdf(worldX: number, worldZ: number): number {
  return sdRoundedBox2D(worldX, Math.abs(worldZ), 88.5, 75.0, 13.0, 29.0, 2.5);
}

/**
 * Evaluates the 4 undulating contour-level signed distances (`t1, t2, t3, t4`) for the
 * Multi-Level Terraced Outer Perimeter Hill Embankment ("Tanggul Bukit dengan Lekukan Level"):
 * - Wraps around the North, West, and South land borders of the map
 * - Widened on the West to frame the new 28m-wide West Lobby & Skin Shop Plaza
 * - Expanded eastward so the East Coastal Concrete Seawall sits at `x = 101.5..110.0` and Open Ocean at `x > 110.0`.
 */
export function evaluateEmbankmentTierOffsets(
  worldX: number,
  worldZ: number,
): { t1: number; t2: number; t3: number; t4: number } {
  const px = worldX;
  const pz = worldZ;
  // Box spans West edge x = -96.5 (widened at Lobby z in [-44..+44]), North/South edges z = ±113.5, and stays open on the East side
  const dBox = sdRoundedBox2D(px, pz, 48.25, 0.0, 144.75, 113.5, 34.0);
  const westCornerBulge =
    smoothstep(-54.0, -90.0, px) * smoothstep(62.0, 102.0, Math.abs(pz)) * 11.5;
  const westPlantClear =
    smoothstep(-78.25, -108.75, px) *
    (1.0 - smoothstep(-110.6, -111.7, px)) *
    (1.0 - smoothstep(37.0, 42.5, Math.abs(pz))) *
    16.0;
  const tennisClubClear =
    smoothstep(-74.0, -102.0, px) *
    (12.2 - 1.7 * smoothstep(-106.0, -112.0, px)) *
    smoothstep(35.0, 41.0, pz) *
    (1.0 - smoothstep(75.0, 82.0, pz));
  const grandCasinoClear = evaluateGrandCasinoHillClear(px, pz);
  // Keep North & South rear collector roads (|z| = 108 ± 3.9, x in [-60..+96]) 100% flat and clear of hill toes
  const rearRoadClear =
    smoothstep(-68.0, -58.0, px) *
    (1.0 - smoothstep(95.0, 100.5, px)) *
    (1.0 - smoothstep(111.8, 114.8, Math.abs(pz))) *
    5.8;
  // Smoothly open the East side at x >= 101.5 where the shifted Coastal Concrete Seawall & Open Ocean sit
  const eastCoastalOpen = smoothstep(96.5, 102.0, px) * 92.0;
  const d0 =
    dBox +
    westCornerBulge -
    westPlantClear -
    tennisClubClear -
    grandCasinoClear -
    rearRoadClear -
    eastCoastalOpen;

  const w1 =
    Math.sin(px * 0.075 + Math.cos(pz * 0.068) * 1.55) * 2.05 +
    Math.cos(pz * 0.072 - Math.sin(px * 0.065) * 1.55) * 1.75 +
    Math.sin((px - pz) * 0.14) * 0.65;

  const nsCompact = 1.0 - 0.24 * smoothstep(92.0, 115.0, Math.abs(pz));
  const stepW12 =
    (5.8 +
      2.1 * Math.sin(px * 0.064 - pz * 0.070 + 1.1) +
      1.1 * Math.cos(px * 0.13 + pz * 0.11 - 0.6)) *
    nsCompact;
  const stepW23 =
    (6.2 +
      2.3 * Math.cos(px * 0.058 + pz * 0.066 - 1.9) +
      1.2 * Math.sin(px * 0.12 - pz * 0.14 + 1.4)) *
    nsCompact;
  const stepW34 =
    (6.5 +
      2.4 * Math.sin(px * 0.054 + pz * 0.060 + 2.7) +
      1.2 * Math.cos(px * 0.11 + pz * 0.13 - 2.1)) *
    nsCompact;

  const t1 = d0 + w1;
  const t2 = t1 - Math.max(3.45, stepW12);
  const t3 = t2 - Math.max(3.55, stepW23);
  const t4 = t3 - Math.max(3.65, stepW34);
  return { t1, t2, t3, t4 };
}

export const EAST_COAST_WIDENED_SHORELINE_X = 134.0;

/**
 * Computes the continuous widened East Coast sandy shoreline X coordinate (`134.0m`)
 * spanning N/S coastal beaches & Tropical Beach Club (`z ∈ [-104.2 .. +104.2]`),
 * tapering smoothly back to `110.0m` outside `|z| > 105.2` along N/S hillside switchbacks.
 */
export function getEastCoastalShorelineX(worldZ: number): number {
  const beachMask =
    smoothstep(-105.2, -98.5, worldZ) * (1.0 - smoothstep(98.5, 105.2, worldZ));
  return 110.0 + (EAST_COAST_WIDENED_SHORELINE_X - 110.0) * beachMask;
}

/**
 * Signed distance to the Impassable Outer Map Boundary:
 * - Returns < 0.0 inside the playable arena, coastal switchbacks, Twin Peaks Ridge Highway,
 *   and all 3 flat Hilltop Villa Plateaus (connected smoothly across wide driveway aprons).
 * - Returns >= 0.0 on impassable outer hill bluffs/guardrails OR East Open Ocean past shoreline.
 */
export function evaluateOuterEmbankmentSdf(worldX: number, worldZ: number): number {
  const { t1 } = evaluateEmbankmentTierOffsets(worldX, worldZ);
  const shorelineX = getEastCoastalShorelineX(worldZ);
  const eastOceanBarrier = isPointOnBeachfrontStiltCabinDeck(worldX, worldZ)
    ? -4.0
    : worldX - (shorelineX - 0.8);
  const baseWalkSdf = Math.max(t1, eastOceanBarrier);
  const hillRoad = evaluateCoastalHillRoadSample(worldX, worldZ);
  const hillRoadWalkSdf = hillRoad.distToCenterM - COASTAL_HILL_WALKABLE_HALF_WIDTH;
  const plateauWalkSdf = evaluateHillVillaPlateauSdf(worldX, worldZ);
  const drivewayApronSdf = evaluateHillVillaDrivewayApronSdf(worldX, worldZ);
  const coastalWalkUnion = Math.min(hillRoadWalkSdf, Math.min(plateauWalkSdf, drivewayApronSdf));
  return Math.min(baseWalkSdf, coastalWalkUnion);
}

function evalMirroredCentralSCurveDist(px: number, pz: number): number {
  const az = Math.abs(pz);
  // 1. Wind Farm S-Bend (West side x = -66.5..-25, North-only: South side closed into continuous park lawn & sidewalk)
  const s1 = pz <= 0.0 ? sdSegment2D(px, -pz, -66.5, 15.0, -52.0, 15.0) : 999.0;
  const s2 = pz <= 0.0 ? sdSegment2D(px, -pz, -52.0, 15.0, -41.0, 26.0) : 999.0;
  const s3 = pz <= 0.0 ? sdSegment2D(px, -pz, -41.0, 26.0, -25.0, 26.0) : 999.0;

  // 2. Central Forest S-Bend & Equator Crossing (x = -25..+19, framing enlarged Central Urban Plaza)
  const s4 = sdSegment2D(px, az, -25.0, 26.0, -14.2, 15.6);
  const s5 = sdSegment2D(px, az, -14.2, 0.0, -14.2, 15.6);
  const s6 = sdSegment2D(px, az, -14.2, 15.6, 8.0, 15.6);
  const s7 = sdSegment2D(px, az, 8.0, 15.6, 18.5, 26.5);

  // 3. Expanded East Warzone S-Curve & North/South Base Collector Connectors (x = +18.5..+66.5)
  const s8 = sdSegment2D(px, az, 18.5, 26.5, 43.5, 26.5);
  const s9 = sdSegment2D(px, az, -25.0, 26.0, -18.0, 33.0);
  const s10 = sdSegment2D(px, az, -18.0, 33.0, -18.0, 49.5);
  const s11 = sdSegment2D(px, az, 19.0, 26.5, 19.0, 49.5);
  const s12 = sdSegment2D(px, az, 43.5, 26.5, 54.5, 15.0);
  const s13 = sdSegment2D(px, az, 54.5, 15.0, 66.5, 15.0);
  const s14 = sdSegment2D(px, az, 42.0, 26.5, 42.0, 49.5);

  return Math.min(s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14);
}

/**
 * Signed distance to the Asphalt Road Network:
 * - Complete Outer Ring Highway Loop for the City Tram (x = ±70.0, z = ±52.0 with R = 8.0m corners)
 * - East Harbor Dock Entrance Spurs (x = 70.0..76.5 at z = ±24.0)
 * - 4-Base Complex Ring & Dividing Roads (x in [-60..+60], |z| in [52..108])
 * - Twin S-Curve Warzone Roads weaving across the widened Warzone (with South x=-18 connector closed into park/sidewalk)
 * Returns < 0.0 on the asphalt road surface.
 */
export function evaluateRoadNetworkSdf(worldX: number, worldZ: number): number {
  const px = worldX;
  const az = Math.abs(worldZ);

  // 1. Complete Ring Highway Loop for City Tram + Parallel Inner Car Lane:
  //    Outer curb stays at +3.90m of (70, 52, R=8.0) -> (|x| = 73.90, |z| = 55.90, R_outer = 11.90m);
  //    Inner curb follows the wide R=9.0m tram curve offset inward by 2.80m -> (|x| = 62.20, |z| = 44.20, R_inner = 6.20m).
  const dTramOuterBox = sdRoundedBox2D(px, az, 0.0, 0.0, 70.0, 52.0, 8.0);
  const dTramInnerBox = sdRoundedBox2D(px, az, 0.0, 0.0, 65.0, 47.0, 9.0);
  const dTramRingRoad = Math.max(dTramOuterBox - 3.9, -(dTramInnerBox + 2.8));
  const dHarborTurn = sdSegment2D(px, az, 70.0, 15.0, 76.5, 15.0);

  // 2. 4-Block Commercial Avenues (WS Shop Buildings Block Layout):
  //    - Divider Roads 2 (x = -30.0) & 4 (x = +30.0) are CLOSED and form the back-to-back block centerlines.
  //    - Avenues 1 (x = -60.0), 3 (x = 0.0), and 5 (x = +60.0) are WIDENED to 10.4m (half-width 5.2m).
  //    - Rear Promenade Road stays at |z| = 108.0; Tram Ring Road stays untouched.
  const dBaseWestOuter = sdSegment2D(px, az, -60.0, 52.0, -60.0, 108.0);
  const dBaseCenterAvenue = sdSegment2D(px, az, 0.0, 52.0, 0.0, 108.0);
  const dBaseEastOuter = sdSegment2D(px, az, 60.0, 52.0, 60.0, 108.0);
  const dBaseRear = sdSegment2D(px, az, -60.0, 108.0, 96.0, 108.0);

  const dOuterAndBaseRing = Math.min(
    dTramRingRoad,
    Math.min(dBaseWestOuter, dBaseCenterAvenue, dBaseEastOuter) - 5.2,
    Math.min(dHarborTurn, dBaseRear) - 3.9,
  );

  // 3. Central S-Curve Warzone Roads (cutting through Wind Farm, Forest, and East Warzone)
  const dCentralSCurve = evalMirroredCentralSCurveDist(px, worldZ) - 4.2;

  // 4. Grand Casino Semi-Circular Valet Drop-Off Loop (North of Central Plaza, x <= -60.0, z in [-76.4, -50.8])
  const dCasinoValetLoop = evaluateGrandCasinoValetLoopSdf(px, worldZ);

  // 5. Mirrored San Francisco-Style Coastal Switchbacks & Twin Peaks Scenic Ridge Loop
  const dCoastalHillRoad = evaluateCoastalHillRoadSample(px, worldZ).roadSdfM;

  return Math.min(
    Math.min(Math.min(dOuterAndBaseRing, dCentralSCurve), dCasinoValetLoop),
    dCoastalHillRoad,
  );
}

export interface ZebraCrosswalkZoneSpec {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  mirroredZ: boolean;
}

/**
 * Exact 13 Zebra Crosswalk zones matching the GLSL terrain shader
 * (`evalZebraCrosswalk` in buddiesBlitzShadersAndAssets.ts):
 * - West S-curve crosswalk (-60.0, -15.0) is North-only (South branch closed into park & sidewalk)
 * - Single North Plaza crosswalk (-68.05, -8.60) so the 2-car tram stops flush behind it alongside shifted Central Plaza Halte
 * - Signalized North Residence crosswalk (9.80, -50.05) across the North Ring Road beside North Residence Halte
 */
export const ZEBRA_CROSSWALK_ZONES: readonly ZebraCrosswalkZoneSpec[] = [
  { cx: -18.0, cz: 42.0, hx: 3.2, hz: 2.2, mirroredZ: true },
  { cx: 19.0, cz: 42.0, hx: 3.2, hz: 2.2, mirroredZ: true },
  { cx: 42.0, cz: 42.0, hx: 3.2, hz: 2.2, mirroredZ: true },
  { cx: -60.0, cz: -15.0, hx: 2.2, hz: 3.2, mirroredZ: false },
  { cx: 60.0, cz: 15.0, hx: 2.2, hz: 3.2, mirroredZ: true },
  { cx: -68.05, cz: -8.6, hx: 5.2, hz: 2.2, mirroredZ: false },
  { cx: 9.8, cz: -50.05, hx: 2.2, hz: 5.2, mirroredZ: false },
  { cx: 68.05, cz: 0.0, hx: 5.2, hz: 2.2, mirroredZ: false },
  { cx: -60.0, cz: 58.0, hx: 3.2, hz: 2.2, mirroredZ: true },
  { cx: -30.0, cz: 58.0, hx: 3.2, hz: 2.2, mirroredZ: true },
  { cx: 0.0, cz: 58.0, hx: 3.2, hz: 2.2, mirroredZ: true },
  { cx: 30.0, cz: 58.0, hx: 3.2, hz: 2.2, mirroredZ: true },
  { cx: 60.0, cz: 58.0, hx: 3.2, hz: 2.2, mirroredZ: true },
];

/**
 * Returns true if (worldX, worldZ) lies inside any painted Zebra Crosswalk rectangle.
 */
export function isPointOnZebraCrosswalk(worldX: number, worldZ: number): boolean {
  const px = worldX;
  const az = Math.abs(worldZ);
  for (let i = 0; i < ZEBRA_CROSSWALK_ZONES.length; i++) {
    const zc = ZEBRA_CROSSWALK_ZONES[i];
    const testZ = zc.mirroredZ ? az : worldZ;
    if (Math.abs(px - zc.cx) <= zc.hx && Math.abs(testZ - zc.cz) <= zc.hz) {
      return true;
    }
  }
  return false;
}

/**
 * Returns true when a unit or vehicle is on the Asphalt Road Network or any Zebra Crosswalk.
 */
export function isPointOnAsphaltRoadOrZebraCross(worldX: number, worldZ: number): boolean {
  return (
    evaluateRoadNetworkSdf(worldX, worldZ) <= 0.15 ||
    isPointOnZebraCrosswalk(worldX, worldZ) ||
    isPointOnGrandCasinoCrosswalk(worldX, worldZ)
  );
}


/**
 * Signed distance to the Central-West Mirrored Turquoise Oasis Lake (centered at (-31.0, 0.0)
 * between the West Wind Farm Super DropZone and the Central Forest).
 * Returns < 0.0 inside the lake water.
 */
export function evaluateNwLakeSdf(worldX: number, worldZ: number): number {
  const px = worldX;
  const az = Math.abs(worldZ);
  const d1 = Math.hypot(px - -31.0, az - 0.0) - 8.4;
  const d2 = Math.hypot(px - -26.5, az - 4.2) - 6.8;
  const d3 = Math.hypot(px - -35.0, az - 4.5) - 6.8;
  const d4 = Math.hypot(px - -30.5, az - 7.2) - 6.2;
  const wave =
    Math.sin(px * 0.26 + Math.cos(az * 0.22)) * 0.55 +
    Math.cos(az * 0.31 - px * 0.19) * 0.4;
  return smin(smin(d1, d2, 4.0), smin(d3, d4, 4.0), 4.0) + wave;
}

/**
 * Signed distances for the Shifted Right-Side (East) Industrial Harbor Dock, Coastal Concrete Seawall, & Open Ocean:
 * - concreteSdf < 0.0 on the shifted concrete harbor apron [76.0..110.0] x [-46.0..+46.0]
 *   AND the continuous East Coastal Concrete Seawall Promenade [101.5..110.0] x [-180.0..+180.0]
 * - waterSdf < 0.0 in the Open East Ocean (worldX > 110.0 across the entire East side of the map)
 */
export function evaluateSeHarborSdf(
  worldX: number,
  worldZ: number,
): { concreteSdf: number; waterSdf: number } {
  const px = worldX;
  const pz = worldZ;
  // Far N/S outer hill concrete seawall tails only (`|z| > 104.2`), industrial harbor removed
  const concreteSdf = Math.max(
    sdRoundedBox2D(px, pz, 105.75, 0.0, 4.25, 180.0, 0.8),
    104.2 - Math.abs(pz),
  );
  // Widened continuous East Ocean shoreline (`134.0m` along the beach strip, tapering to `110.0m` at N/S switchbacks)
  const waterSdf = getEastCoastalShorelineX(pz) - px;
  return { concreteSdf, waterSdf };
}

function evalModelEstateBaseDirtSdf(_px: number, _pz: number): number {
  // WS20: Legacy Model Estate on-map house & walled yard removed — return clean grass across all commercial lots.
  return 999.0;
}

export const OUTER_TRAM_SIDEWALK_WIDTH_M = 4.4;

/**
 * Signed distance to the 4.40m-wide paved urban sidewalk hugging the outer perimeter
 * of the Autonomous City Tram ring road (`x = ±70.0, z = ±52.0, R = 8.0m` corners),
 * matched 1:1 to the width of the main zebra crosswalks (`2 * 2.20m = 4.40m`) while
 * leaving all crossroad intersections, Harbor turn spurs, Grand Casino, Central Plaza,
 * Tennis Club, Beachfront Halte, and SE Beachfront walkway open.
 */
export function evaluateOuterTramSidewalkSdf(px: number, pz: number): number {
  const dTram = sdRoundedBox2D(px, pz, 0.0, 0.0, 70.0, 52.0, 8.0);
  let d = Math.abs(dTram - 6.13) - 2.2;

  // Exclude West straight already built by Plaza/Casino/Tennis and NW Grand Casino lot
  d = Math.max(d, -sdRoundedBox2D(px, pz, -91.965, 0.0, 18.035, 110.0, 0.0));
  d = Math.max(d, -sdRoundedBox2D(px, pz, -86.965, -74.05, 23.035, 35.95, 0.0));

  // Exclude widened N/S commercial avenues (x = -60, 0, +60, half-width 5.2m); continuous sidewalk across each block!
  const az = Math.abs(pz);
  if (az > 54.0) {
    for (const rx of [-60.0, 0.0, 60.0] as const) {
      d = Math.max(d, -sdRoundedBox2D(px, az, rx, 59.5, 5.23, 5.5, 0.0));
    }
  }

  // Exclude East Harbor entrance asphalt spurs (z = ±15.0, x >= 73.5)
  d = Math.max(d, -sdRoundedBox2D(px, az, 77.5, 15.0, 4.0, 3.93, 0.0));

  // Exclude SE Beachfront Urban Walkway
  d = Math.max(d, -sdRoundedBox2D(px, pz, 85.01, 60.225, 9.99, 14.775, 0.0));

  return d;
}

/**
 * Returns true when `(worldX, worldZ)` lies on the 4.40m outer tramway pedestrian sidewalk.
 */
export function isPointOnOuterTramSidewalk(worldX: number, worldZ: number): boolean {
  return evaluateOuterTramSidewalkSdf(worldX, worldZ) <= 0.02;
}

/**
 * Builds a flat horizontal polygon slab in `(worldX, worldZ)` spanning `[yBottom, yTop]`
 * with metric planar UVs so procedural paver/cobblestone textures tile without distortion.
 */
export function createHorizontalPolygonSlabGeometry(
  ptsWorldXZ: readonly [number, number][],
  yBottom: number,
  yTop: number,
  uvTileMeters = 2.4,
  uvMapper?: (wx: number, wz: number) => [number, number],
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < ptsWorldXZ.length; i++) {
    const [wx, wz] = ptsWorldXZ[i];
    if (i === 0) shape.moveTo(wx, -wz);
    else shape.lineTo(wx, -wz);
  }
  shape.closePath();

  const depth = Math.max(0.01, yTop - yBottom);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 12,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, yBottom, 0);

  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  if (pos && uv) {
    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i);
      const wz = pos.getZ(i);
      if (uvMapper) {
        const [u, v] = uvMapper(wx, wz);
        uv.setXY(i, u, v);
      } else {
        uv.setXY(i, wx / uvTileMeters, wz / uvTileMeters);
      }
    }
    uv.needsUpdate = true;
  }
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export const INNER_TRAM_SIDEWALK_WIDTH_M = 4.4;

/**
 * Signed distance to the 4.40m-wide paved urban sidewalk hugging the inner perimeter
 * of the widened City Tram + Car ring road (`|x| in [57.80 .. 62.20]`, `|z| in [39.80 .. 44.20]`),
 * aligned 1:1 with the inner S-curve zebra crosswalks while leaving intersecting streets
 * and the 4 inner Halte decks (`Central Plaza`, `North Residence`, `South Residence`, `Beachfront Harbor`) clear.
 */
export function evaluateInnerTramSidewalkSdf(px: number, pz: number): number {
  const dInnerTram = sdRoundedBox2D(px, pz, 0.0, 0.0, 65.0, 47.0, 9.0);
  let d = Math.abs(dInnerTram + 5.0) - 2.2;

  // Exclude East S-curve road entrances at z = ±15.0 and West North-only entrance at z = -15.0
  // (West South entrance at z = +15.0 is closed into continuous inner sidewalk & park lawn)
  const ax = Math.abs(px);
  const az = Math.abs(pz);
  if (ax > 57.0 && ax < 63.0) {
    if (px > 0.0 || pz < 0.0) {
      d = Math.max(d, -sdRoundedBox2D(ax, az, 60.0, 15.0, 3.0, 4.23, 0.0));
    }
  }

  // Exclude North & South S-curve road entrances at x = -18.0, +19.0, +42.0
  if (az > 39.0 && az < 45.0) {
    for (const sx of [-18.0, 19.0, 42.0] as const) {
      d = Math.max(d, -sdRoundedBox2D(px, az, sx, 42.0, 4.23, 3.0, 0.0));
    }
  }

  // Exclude the 4 inner Halte raised boarding decks (+0.26m)
  d = Math.max(d, -sdRoundedBox2D(px, pz, -58.9, 4.6, 3.35, 9.2, 0.0));
  d = Math.max(d, -sdRoundedBox2D(px, pz, 3.5, -40.87, 9.2, 3.35, 0.0));
  d = Math.max(d, -sdRoundedBox2D(px, pz, -36.5, 40.87, 9.2, 3.35, 0.0));
  d = Math.max(d, -sdRoundedBox2D(px, pz, 58.9, 28.6, 3.35, 9.2, 0.0));

  return d;
}

/**
 * Returns true when `(worldX, worldZ)` lies on the 4.40m inner tramway pedestrian sidewalk.
 */
export function isPointOnInnerTramSidewalk(worldX: number, worldZ: number): boolean {
  return evaluateInnerTramSidewalkSdf(worldX, worldZ) <= 0.02;
}

export function evaluateHaltePlatformSdf(px: number, pz: number): number {
  // Central Halte (shifted inward flush to |x| = 62.20 curb & slightly South to z = +4.6): center (-58.90, 4.6), halfExtents (3.6, 9.4)
  const dCentral = sdRoundedBox2D(px, pz, -58.9, 4.6, 3.6, 9.4, 0.4);
  // North Residence Halte (shifted inward flush to |z| = 44.20 curb & clear of x = 19 street): center (3.5, -40.87)
  const dNorth = sdRoundedBox2D(px, pz, 3.5, -40.87, 9.4, 3.6, 0.4);
  // South Residence Halte (shifted inward flush to |z| = 44.20 curb): center (-36.5, 40.87)
  const dSouth = sdRoundedBox2D(px, pz, -36.5, 40.87, 9.4, 3.6, 0.4);
  // Beachfront Harbor Halte (relocated across road to SE inner sidewalk facing East toward road): center (58.90, 28.6), halfExtents (3.6, 9.4)
  const dBeach = sdRoundedBox2D(px, pz, 58.9, 28.6, 3.6, 9.4, 0.4);
  // Central Plaza Roadside Pedestrian Sidewalk (widened 4.80m span worldX in [-78.86 .. -73.90], worldZ in [-38.2 .. +38.2])
  const dPlazaSidewalk = sdRoundedBox2D(px, pz, -76.38, 0.0, 2.48, 38.2, 0.2);
  // Standalone Scenic Clay Tennis Court & Full-Width Perimeter Sidewalks (worldX in [-104.40 .. -73.85], worldZ in [+38.10 .. +65.70])
  const dTennisClub = sdRoundedBox2D(px, pz, -89.20, 51.90, 15.20, 13.70, 0.3);
  // North-of-Plaza Grand Casino, Median Island, South Connector & Curved North Garden
  const dGrandCasino = evaluateGrandCasinoPavedPlatformSdf(px, pz);
  // 4.40m Outer & Inner Tram Ring Sidewalks around all un-built tram loop perimeters
  const dOuterTramSidewalk = evaluateOuterTramSidewalkSdf(px, pz);
  const dInnerTramSidewalk = evaluateInnerTramSidewalkSdf(px, pz);
  return Math.min(
    Math.min(dOuterTramSidewalk, dInnerTramSidewalk),
    Math.min(
      dGrandCasino,
      Math.min(
        dTennisClub,
        Math.min(dPlazaSidewalk, Math.min(dCentral, Math.min(dNorth, Math.min(dSouth, dBeach)))),
      ),
    ),
  );
}

/**
 * Evaluates the authentic Buddies Blitz Splatmap Grass Mask in [0.0, 1.0] at (worldX, worldZ):
 * - 0.0 = Warm golden-tan Blitz dirt (#eab664), Asphalt Road, Oasis Lake, Concrete Harbor/Seawall, West Power Plant, Drop Zones, Halte Platforms, Model Estate Base Plot, or Embankment Cliff Slope
 * - 1.0 = Lush green grass meadow (#4ea832 -> #9be15d) where InfiniteGrass & flower petals grow (including all emptied base lots)
 * Matches the GLSL shader function evaluateBlitzGrassMask(vec2 p) 1:1.
 */
export function evaluateBlitzGrassMask(worldX: number, worldZ: number): number {
  const px = worldX;
  const pz = worldZ;
  const qx = pz < 0 ? -px : px;
  const qz = pz < 0 ? -pz : pz;

  const n1 =
    Math.sin(qx * 0.17 + Math.cos(qz * 0.15) * 1.6) *
    Math.cos(qz * 0.16 - Math.sin(qx * 0.14) * 1.4);
  const n2 =
    Math.sin(qx * 0.37 - qz * 0.31 + 0.9) * 0.5 +
    Math.cos(qz * 0.41 + qx * 0.29 - 0.6) * 0.5;
  const wobble = (n1 * 0.65 + n2 * 0.35) * 1.05;

  // 1. Single Intact Bottom-Left Model Estate Clearing (-45.0, 81.7) + East Dirt Construction Yards
  const dModelEstateDirt = evalModelEstateBaseDirtSdf(px, pz);
  const dConstructionYardDirt = evaluateEastConstructionYardSdf(px, pz);

  const minDirtSdf = Math.min(dModelEstateDirt, dConstructionYardDirt) + wobble;
  const grassMask = smoothstep(-0.35, 1.35, minDirtSdf);

  // 2. Hard exclusions: zero grass on Asphalt Roads, Oasis Lake, Harbor/Coastal Concrete, Open Sea, West Power Plant, Halte Platforms, East Construction Yards, Intact Model Estate & Embankment
  const roadSdf = evaluateRoadNetworkSdf(px, pz);
  const roadSafe = smoothstep(-0.15, 0.85, roadSdf);

  const lakeSdf = evaluateNwLakeSdf(px, pz);
  const lakeSafe = smoothstep(0.2, 1.65, lakeSdf);

  const { concreteSdf, waterSdf } = evaluateSeHarborSdf(px, pz);
  const coastalBeachClubPadSdf = sdRoundedBox2D(px, pz, 106.5, 0.0, 28.2, 104.5, 2.0);
  const harborSafe = smoothstep(
    -0.2,
    1.25,
    Math.min(Math.min(concreteSdf, waterSdf), coastalBeachClubPadSdf),
  );

  const westPlantSdf = evaluateWestPowerPlantSdf(px, pz);
  const westPlantSafe = smoothstep(-0.2, 1.15, westPlantSdf);

  const hardPadSdf = Math.min(dModelEstateDirt, dConstructionYardDirt);
  const padSafe = smoothstep(-0.3, 0.5, hardPadSdf);

  // Match GLSL evaluateOuterEmbankmentSdf grass suppression east of coastal shoreline while allowing lush grass on flat Hilltop Villa Plateaus
  const { t1: embT1 } = evaluateEmbankmentTierOffsets(px, pz);
  const embSdf = Math.max(embT1, px - (getEastCoastalShorelineX(pz) - 0.8));
  const plateauSdf = evaluateHillVillaPlateauSdf(px, pz);
  const plateauGrassMask = 1.0 - smoothstep(-0.2, 0.6, plateauSdf);
  const embSafe = Math.max(1.0 - smoothstep(-0.6, 0.8, embSdf), plateauGrassMask);
  const hillRoad = evaluateCoastalHillRoadSample(px, pz);
  const hillRoadSafe = smoothstep(
    COASTAL_HILL_ROAD_HALF_WIDTH - 0.15,
    COASTAL_HILL_ROAD_HALF_WIDTH + 0.85,
    hillRoad.distToCenterM,
  );

  const halteSdf = evaluateHaltePlatformSdf(px, pz);
  const halteSafe = smoothstep(-0.2, 0.6, halteSdf);

  return Math.max(
    0.0,
    Math.min(
      1.0,
      grassMask *
        roadSafe *
        hillRoadSafe *
        lakeSafe *
        harborSafe *
        westPlantSafe *
        padSafe *
        embSafe *
        halteSafe,
    ),
  );
}

export function getSingleRiverCenterZ(_px: number): number {
  return 0.0;
}

export function getPlanetWaterSdf(rawX: number, rawZ: number): number {
  const lakeSdf = evaluateNwLakeSdf(rawX, rawZ);
  const { waterSdf } = evaluateSeHarborSdf(rawX, rawZ);
  return Math.min(lakeSdf, waterSdf);
}

export function evaluatePlanetWaterField(worldX: number, worldZ: number): number {
  return 1.0 - smoothstep(-0.4, 0.4, getPlanetWaterSdf(worldX, worldZ));
}

export const EAST_WATER_SURFACE_Y = -2.16;
export const HARBOR_SEABED_DEEP_Y = -3.65;

/**
 * Returns 1.0 continuously along the widened East Coast golden sandy beaches & Tropical Beach Club
 * (`z in [-104.2..+104.2]`), and 0.0 on the N/S concrete seawall tails (`|z| > 105.2`).
 * Matches GLSL evaluateEastCoastalSandyMask(float z) 1:1.
 */
export function evaluateEastCoastalSandyMask(worldZ: number): number {
  return smoothstep(-105.2, -102.5, worldZ) * (1.0 - smoothstep(102.5, 105.2, worldZ));
}

/**
 * Evaluates the multi-tiered East Coast & Ocean elevation drop (`0.0m -> -1.00m -> -2.00m -> -3.65m`)
 * matching GLSL `evalHarborSeabedDrop` 1:1 (`screenshot_3_9d0de9bd.png`):
 * - Box 1 (`x in [99.6 .. 121.4]` in Beach Club / `x in [97.6 .. 121.4]` in Kai's Beach): lowered `-1.00m`.
 * - Box 2 (`x >= 121.4` seaward golden beach sand): lowered an additional `-1.00m` to `-2.00m`.
 * - East Ocean (`waterSdf < 0.35`, water surface at `-2.16m`): gentle 14m sandy reef slope from `-2.00m`
 *   down to `HARBOR_SEABED_DEEP_Y = -3.65m` (preserving the exact `0.0m .. 1.49m` water depth column).
 * - Far N/S concrete seawall tails (`|z| > 105.2`): steep drop `smoothstep(0.15, -1.2, waterSdf)` to `-3.65m`.
 */
export function evaluateHarborSeabedDrop(worldX: number, worldZ: number): number {
  if (worldX <= 91.2) return 0.0;
  const { waterSdf } = evaluateSeHarborSdf(worldX, worldZ);
  const sandyMask = evaluateEastCoastalSandyMask(worldZ);

  // Box 1 (-1.00m terrace drop): begins at x = 92.2..97.6 on Kai's Beach (z > 45.2) and x = 93.5..97.2 in Beach Club
  const kaiBlend = smoothstep(44.8, 45.6, worldZ);
  const box1Start = 93.5 + (92.2 - 93.5) * kaiBlend;
  const box1End = 97.2 + (97.6 - 97.2) * kaiBlend;
  let box1Drop = -1.0 * smoothstep(box1Start, box1End, worldX);

  // Extra subsurface basin clearance beneath the built Beach Club terraces & pools (x in [93.5..121.4], z in [-96.8..45.4])
  // Matches GLSL evalHarborSeabedDrop 1:1 so underlying sand/slope triangles never poke through terrace decks or pool basins.
  const clubPoolPit =
    smoothstep(93.5, 97.2, worldX) *
    (1.0 - smoothstep(118.8, 121.4, worldX)) *
    smoothstep(-96.8, -94.5, worldZ) *
    (1.0 - smoothstep(44.2, 45.4, worldZ));
  box1Drop -= 0.85 * clubPoolPit;

  // Box 2 (-2.00m golden beach sand drop): reaches -2.00m at x = 121.4 along Beach Club and x = 122.2 on Kai's Beach
  const box2Start = 118.8 + (119.8 - 118.8) * kaiBlend;
  const box2End = 121.4 + (122.2 - 121.4) * kaiBlend;
  const box2Drop = -1.0 * smoothstep(box2Start, box2End, worldX);

  // Ocean seabed slope below -2.00m down to -3.65m
  const seaSlope = (HARBOR_SEABED_DEEP_Y - -2.0) * smoothstep(0.35, -14.0, waterSdf);
  const sandyTotalDrop = box1Drop + box2Drop + seaSlope;

  const quayDrop = HARBOR_SEABED_DEEP_Y * smoothstep(0.15, -1.2, waterSdf);
  return quayDrop + (sandyTotalDrop - quayDrop) * sandyMask;
}

export const URBAN_SIDEWALK_TOP_Y = 0.09;

/**
 * Evaluates exact walkable top elevation (in meters) for all paved urban pedestrian
 * sidewalks (`trotoar`), courts, and medians across the city:
 * - `+0.09m` on the 4.40m Outer & Inner Tram Ring Sidewalks
 * - `+0.09m` on the Central Plaza Roadside Pedestrian Sidewalk (N/Center/S)
 * - `+0.09m` on the Tennis Club Perimeter Sidewalks and `+0.108m` on the Clay Court
 * - `+0.09m` on Grand Casino Sidewalk, `+0.14m` on Median Island, `+0.022m` on Valet Apron
 * All asphalt carriageways, zebra crosswalks, and lawns return `0.0m`.
 */
export function evaluateUrbanSidewalkElevation(worldX: number, worldZ: number): number {
  let elev = 0.0;

  // 1. Central Plaza Roadside Pedestrian Sidewalk (worldX in [-79.15 .. -73.93], worldZ in [-38.10 .. +38.10])
  if (worldZ >= -38.10 && worldZ <= 38.10 && worldX >= -79.15 && worldX <= -73.85) {
    const westEdge = Math.abs(worldZ) <= 10.0 ? -79.15 : -78.83;
    if (worldX >= westEdge) {
      const curbTaper = 1.0 - smoothstep(-73.93, -73.85, worldX);
      elev = Math.max(elev, URBAN_SIDEWALK_TOP_Y * curbTaper);
    }
  }

  // 2. Tennis Club Perimeter Sidewalks (+0.09m) & Scenic Clay Court (+0.108m)
  if (worldZ >= 38.10 && worldZ <= 65.78 && worldX >= -104.48 && worldX <= -73.85) {
    // 2a) Scenic Clay Court inner plateau (0.08m * 1.35 scale = +0.108m)
    if (worldX >= -98.80 && worldX <= -78.82 && worldZ >= 38.43 && worldZ <= 62.73) {
      elev = Math.max(elev, 0.108);
    }
    // 2b) East Roadside & Spectator Sidewalk
    if (worldX >= -78.82 && worldX <= -73.85) {
      const xTaper = 1.0 - smoothstep(-73.93, -73.85, worldX);
      const zTaper = 1.0 - smoothstep(65.70, 65.78, worldZ);
      elev = Math.max(elev, URBAN_SIDEWALK_TOP_Y * xTaper * zTaper);
    }
    // 2c) South Perimeter Sidewalk
    if (worldX < -78.82 && worldZ >= 62.73) {
      const xWestTaper = smoothstep(-104.48, -104.40, worldX);
      const zSouthTaper = 1.0 - smoothstep(65.70, 65.78, worldZ);
      elev = Math.max(elev, URBAN_SIDEWALK_TOP_Y * xWestTaper * zSouthTaper);
    }
    // 2d) West Perimeter Sidewalk
    if (worldX < -98.80 && worldZ >= 38.30 && worldZ < 62.73) {
      const xWestTaper = smoothstep(-104.48, -104.40, worldX);
      const zNorthTaper = smoothstep(38.30, 38.3625, worldZ);
      elev = Math.max(elev, URBAN_SIDEWALK_TOP_Y * xWestTaper * zNorthTaper);
    }
  }

  // 3. Grand Casino District Sidewalks (+0.09m), Median Island (+0.14m), & Cobble Apron (+0.022m)
  const casinoElev = evaluateGrandCasinoSidewalkElevation(worldX, worldZ);
  if (casinoElev > elev) {
    elev = casinoElev;
  }

  // 4. Outer Tram Ring 4.40m Pedestrian Sidewalks (+0.09m)
  const dOuterTramSidewalk = evaluateOuterTramSidewalkSdf(worldX, worldZ);
  if (dOuterTramSidewalk < 0.06) {
    elev = Math.max(
      elev,
      URBAN_SIDEWALK_TOP_Y * (1.0 - smoothstep(0.0, 0.06, dOuterTramSidewalk)),
    );
  }

  // 5. Inner Tram Ring 4.40m Pedestrian Sidewalks (+0.09m)
  const dInnerTramSidewalk = evaluateInnerTramSidewalkSdf(worldX, worldZ);
  if (dInnerTramSidewalk < 0.06) {
    elev = Math.max(
      elev,
      URBAN_SIDEWALK_TOP_Y * (1.0 - smoothstep(0.0, 0.06, dInnerTramSidewalk)),
    );
  }

  return elev;
}

/**
 * Base procedural ground elevation:
 * - 0.0m across the flat playable arena, Harbor Dock, and East Coastal Seawall
 * - +0.09m across all Urban Pedestrian Concrete Sidewalks ("trotoar")
 * - Sloped sandy seabed (0.0m -> -1.65m over 14m) off NE Taman Ria & SE Beachfront, and steep -1.65m drop at Harbor Quay
 * - -1.55m 3-level concave lake basin depression ("level cekungan danau") inside the Oasis Lake (`evaluateNwLakeSdf`)
 * - +2.50m on the West Elevated Central Plaza Platform (`x in [-110.75, -78.75], z in [-38.0, +38.0]`)
 * - Rises into a 4-level stepped contour hill embankment ("Tanggul Bukit dengan Lekukan Level", +11.4m)
 *   around the North, West, and South map boundaries
 */
export function getBaseProceduralGroundElevation(worldX: number, worldZ: number): number {
  const westPlantSdf = evaluateWestPowerPlantSdf(worldX, worldZ);
  let westPlantElev = (1.0 - smoothstep(-0.45, -0.15, westPlantSdf)) * 2.5;
  // Urban Plaza to Street Staircase (20m wide: worldZ in [-10.00 .. +10.00], worldX in [-87.55 .. -73.93]):
  // - Upper Flight (worldX in [-87.55 .. -84.05]): descends from +2.50m Plaza Level to +1.32m Mid-Landing
  // - Mid-Landing (worldX in [-84.05 .. -82.65]): flat granite landing at +1.32m
  // - Lower Flight (worldX in [-82.65 .. -79.15]): descends from +1.32m to +0.09m Urban Sidewalk
  // - Bottom Widened Urban Sidewalk (worldX in [-79.15 .. -73.93]): +0.09m concrete sidewalk stepping down at -73.93 curb
  if (worldX >= -87.60 && worldX <= -73.85 && worldZ >= -10.00 && worldZ <= 10.00) {
    if (worldX <= -84.05) {
      const upperT = smoothstep(-87.55, -84.05, worldX);
      westPlantElev = 2.50 - upperT * (2.50 - 1.32);
    } else if (worldX <= -82.65) {
      westPlantElev = 1.32;
    } else if (worldX <= -79.15) {
      const lowerT = smoothstep(-82.65, -79.15, worldX);
      westPlantElev = 1.32 - lowerT * (1.32 - URBAN_SIDEWALK_TOP_Y);
    } else {
      const curbT = smoothstep(-73.93, -73.85, worldX);
      westPlantElev = URBAN_SIDEWALK_TOP_Y * (1.0 - curbT);
    }
  }

  // South-East Coastal Beachfront Elevated Weathered Timber Boardwalk (+0.82m),
  // Urban Seaside Walkway (+0.24m), and Seaward Access Stairs & Sloped Beach Ramp down to -1.00m Box 1 Beach
  let seBoardwalkElev = 0.0;
  let inKaiBoardwalkStairsOrRamp = false;
  let kaiBoardwalkStairElev = 0.0;
  if (worldX >= 74.8 && worldX <= 97.6 && worldZ >= 45.2 && worldZ <= 103.2) {
    const zMask = smoothstep(45.3, 46.2, worldZ) * (1.0 - smoothstep(102.2, 103.1, worldZ));
    if (worldX < 78.2) {
      // Urban Seaside Walkway (x in [75.2..77.6] at +0.24m) & step up onto Timber Boardwalk (x in [77.4..78.2] to +0.82m)
      const walkUp = smoothstep(74.9, 75.6, worldX) * 0.24;
      const deckStep = smoothstep(77.3, 78.15, worldX) * (0.82 - 0.24);
      seBoardwalkElev = (walkUp + deckStep) * zMask;
    } else if (worldX <= 92.2) {
      // Main Elevated Weathered Timber Boardwalk Deck (+0.82m); smoothly join VIP Mezzanine (+0.64m at z=45.2) for x in (91.2..92.2]
      if (worldX > 91.2 && worldZ <= 46.2) {
        seBoardwalkElev = 0.64 + (0.82 - 0.64) * smoothstep(45.2, 46.2, worldZ);
      } else {
        seBoardwalkElev = 0.82 * zMask;
      }
      // Slight elevation for Shower Pebble Drain Basin (x in [81.6..85.6], z in [70.2..75.4])
      if (worldX >= 81.6 && worldX <= 85.6 && worldZ >= 70.2 && worldZ <= 75.4) {
        seBoardwalkElev = 1.02 * zMask;
      }
    } else {
      // East (Seaward) Step-Stone / Timber Access Stairs & Sloped Beach Ramp (x in [92.2..97.6]: +0.82m -> -1.00m)
      const inMainStairsOrRamp = worldZ >= 64.8 && worldZ <= 76.8;
      const inSouthStairs = worldZ >= 94.0 && worldZ <= 99.2;
      if (inMainStairsOrRamp || inSouthStairs) {
        inKaiBoardwalkStairsOrRamp = true;
        const stairT = smoothstep(92.2, 97.6, worldX);
        kaiBoardwalkStairElev = (0.82 + (-1.0 - 0.82) * stairT) * zMask;
      }
    }
  }

  // Halte Raised Boarding Platform Decks (+0.26m) & Sloped Access Ramps:
  // 1) Central Plaza Halte: worldX in [-62.20, -55.60], worldZ in [-3.10, +12.30], ramps to [-4.60, +13.80]
  // 2) North Residence Halte: worldX in [-4.20, 11.20] (ramps to [-5.70, 12.70]), worldZ in [-44.17, -37.57]
  // 3) South Residence Halte: worldX in [-44.20, -28.80] (ramps to [-45.70, -27.30]), worldZ in [37.57, 44.17]
  // 4) Beachfront Harbor Halte (relocated across road to SE inner sidewalk): worldX in [55.60, 62.20], worldZ in [20.90, 36.30] (ramps to [19.40, 37.80])
  let haltePlatformElev = 0.0;
  const absHalteZ = Math.abs(worldZ);
  const dzCentralHalte = Math.abs(worldZ - 4.6);
  if (worldX >= -62.38 && worldX <= -55.38 && dzCentralHalte <= 9.25) {
    const xMask =
      smoothstep(-62.38, -62.08, worldX) * (1.0 - smoothstep(-55.71, -55.38, worldX));
    const zRampMask = 1.0 - smoothstep(7.68, 9.20, dzCentralHalte);
    haltePlatformElev = 0.26 * xMask * zRampMask;
  } else if (worldZ <= -37.35 && worldZ >= -44.35 && worldX >= -5.75 && worldX <= 12.75) {
    const zMask =
      smoothstep(37.35, 37.65, absHalteZ) * (1.0 - smoothstep(44.05, 44.35, absHalteZ));
    const dxFromCenter = Math.abs(worldX - 3.5);
    const xRampMask = 1.0 - smoothstep(7.68, 9.20, dxFromCenter);
    haltePlatformElev = 0.26 * zMask * xRampMask;
  } else if (worldZ >= 37.35 && worldZ <= 44.35 && worldX >= -45.75 && worldX <= -27.25) {
    const zMask =
      smoothstep(37.35, 37.65, absHalteZ) * (1.0 - smoothstep(44.05, 44.35, absHalteZ));
    const dxFromCenter = Math.abs(worldX - -36.5);
    const xRampMask = 1.0 - smoothstep(7.68, 9.20, dxFromCenter);
    haltePlatformElev = 0.26 * zMask * xRampMask;
  } else if (worldX >= 55.38 && worldX <= 62.38 && worldZ >= 19.35 && worldZ <= 37.85) {
    const xMask =
      smoothstep(55.38, 55.71, worldX) * (1.0 - smoothstep(62.08, 62.38, worldX));
    const dzFromCenter = Math.abs(worldZ - 28.6);
    const zRampMask = 1.0 - smoothstep(7.68, 9.20, dzFromCenter);
    haltePlatformElev = 0.26 * xMask * zRampMask;
  }

  // 3-Level Concave Basin Depression ("level cekungan danau") for the Central-West Oasis Lake
  const lakeSdf = evaluateNwLakeSdf(worldX, worldZ);
  let lakeBasinDepression = 0.0;
  if (lakeSdf < 0.85) {
    const lakeStep1 = (1.0 - smoothstep(-0.45, 0.85, lakeSdf)) * 0.48;
    const lakeStep2 = (1.0 - smoothstep(-2.60, -1.10, lakeSdf)) * 0.52;
    const lakeStep3 = (1.0 - smoothstep(-5.60, -3.20, lakeSdf)) * 0.55;
    lakeBasinDepression = lakeStep1 + lakeStep2 + lakeStep3;
  }

  const harborDrop = evaluateHarborSeabedDrop(worldX, worldZ);
  const beachClubElev = evaluateBeachClubElevation(worldX, worldZ);
  const stiltCabinDeckElev = evaluateBeachfrontStiltCabinElevation(worldX, worldZ);
  const centralParkElev = evaluateCentralParkElevation(worldX, worldZ);
  const urbanSidewalkElev = evaluateUrbanSidewalkElevation(worldX, worldZ);
  let baseLandElev =
    Math.max(
      westPlantElev,
      seBoardwalkElev,
      haltePlatformElev,
      centralParkElev,
      urbanSidewalkElev,
    ) -
    lakeBasinDepression +
    harborDrop;
  if (inKaiBoardwalkStairsOrRamp) {
    baseLandElev = kaiBoardwalkStairElev;
  }
  let baseArenaElev = baseLandElev;
  // Inside the built Tropical Beach Club footprint, use the exact multi-tiered terrace / pool basin elevation
  if (
    worldX >= 78.35 &&
    worldX <= 123.8 &&
    worldZ >= -96.5 &&
    worldZ <= (worldX <= 91.2 ? 46.2 : 45.2)
  ) {
    baseArenaElev = beachClubElev;
  }
  if (stiltCabinDeckElev > -2.0) {
    baseArenaElev = Math.max(baseArenaElev, stiltCabinDeckElev);
  }
  const { t1, t2, t3, t4 } = evaluateEmbankmentTierOffsets(worldX, worldZ);
  let coastalHillBaseElev = 0.0;
  if (t1 > -0.1) {
    const b1 = smoothstep(0.0, 4.4, t1) * 4.8;
    const b2 = smoothstep(-0.5, 6.2, t2) * 3.2;
    const b3 = smoothstep(-0.5, 7.6, t3) * 2.2;
    const b4 = smoothstep(-0.5, 9.2, t4) * 1.4;
    coastalHillBaseElev = b1 + b2 + b3 + b4;
  }
  const plateauSdf = evaluateHillVillaPlateauSdf(worldX, worldZ);
  const plateauMask = 1.0 - smoothstep(-0.05, 5.8, plateauSdf);
  const withPlateauElev =
    coastalHillBaseElev + (COASTAL_HILL_RIDGE_ELEV_Y - coastalHillBaseElev) * plateauMask;
  const hillRoad = evaluateCoastalHillRoadSample(worldX, worldZ);
  const coastalTerrainElev =
    withPlateauElev + (hillRoad.roadElevY - withPlateauElev) * hillRoad.cutAlpha;
  if (coastalTerrainElev <= 0.0001) return baseArenaElev;
  return Math.max(baseArenaElev, coastalTerrainElev);
}

/**
 * Applies a Map Editor terrain sculpt brush stroke at (worldX, worldZ) with given radius:
 * - 'sculpt_raise': raises hills (+Y) smoothly
 * - 'sculpt_lower': carves basins (-Y) smoothly
 * - 'sculpt_flatten': flattens terrain back to level ground (y = 0.0m)
 */
export function applyTerrainSculptBrush(
  worldX: number,
  worldZ: number,
  radius: number,
  mode: 'sculpt_raise' | 'sculpt_lower' | 'sculpt_flatten',
  amount = 0.85,
): void {
  const r = Math.max(2.0, Math.min(32.0, radius));
  const cellStep = PLANET_WORLD_PERIOD / SCULPT_GRID_SIZE;

  for (let iz = 0; iz < SCULPT_GRID_SIZE; iz++) {
    const cellZ = -PLANET_HALF_EXTENT + (iz + 0.5) * cellStep;
    for (let ix = 0; ix < SCULPT_GRID_SIZE; ix++) {
      const cellX = -PLANET_HALF_EXTENT + (ix + 0.5) * cellStep;
      const dist = getPlanetShortestDistance(cellX, cellZ, worldX, worldZ);
      if (dist > r) continue;

      const falloff = 0.5 + 0.5 * Math.cos((Math.PI * dist) / r);
      const cellIdx = iz * SCULPT_GRID_SIZE + ix;
      const curOffset = terrainSculptGrid[cellIdx];

      let nextOffset = curOffset;
      if (mode === 'sculpt_raise') {
        nextOffset = curOffset + amount * falloff;
      } else if (mode === 'sculpt_lower') {
        nextOffset = curOffset - amount * falloff;
      } else {
        nextOffset = curOffset * (1.0 - Math.min(1, falloff * 0.75));
      }
      syncCellToRgba(cellIdx, nextOffset);
    }
  }
  terrainSculptVersion++;
}

/**
 * Returns ground elevation at (worldX, worldZ): 0.0 everywhere on the default flat Blitz map
 * (+ any optional Map Editor sculpt offset if the user sculpted in the editor).
 */
export function getRawGroundElevation(worldX: number, worldZ: number): number {
  return getBaseProceduralGroundElevation(worldX, worldZ) + sampleTerrainSculptOffset(worldX, worldZ);
}

export function getBridgeDeckElevation(_worldX: number, _worldZ: number): number {
  return -Infinity;
}

export function getTerrainElevation(worldX: number, worldZ: number): number {
  return getRawGroundElevation(worldX, worldZ);
}

export function computePlanetYOffset(
  worldX: number,
  worldZ: number,
  pivotX: number,
  pivotZ: number,
  curvatureStrength: number = PLANET_CURVATURE_STRENGTH,
): number {
  if (curvatureStrength === 0) return 0;
  const dx = worldX - pivotX;
  const dz = worldZ - pivotZ;
  const distSq = dx * dx + dz * dz;
  if (distSq === 0) return 0;
  return -curvatureStrength * distSq;
}

export function computePlanetSurfaceNormal(
  worldX: number,
  worldZ: number,
  pivotX: number,
  pivotZ: number,
  curvatureStrength: number = PLANET_CURVATURE_STRENGTH,
  normalTiltScale = 0.85,
): { nx: number; ny: number; nz: number } {
  if (curvatureStrength === 0) {
    return { nx: 0, ny: 1, nz: 0 };
  }
  const dx = worldX - pivotX;
  const dz = worldZ - pivotZ;
  const effK = curvatureStrength * normalTiltScale;
  const rawX = 2.0 * effK * dx;
  const rawY = 1.0;
  const rawZ = 2.0 * effK * dz;
  const len = Math.hypot(rawX, rawY, rawZ) || 1.0;
  return {
    nx: rawX / len,
    ny: rawY / len,
    nz: rawZ / len,
  };
}

export function samplePlanetCurvature(
  worldX: number,
  worldZ: number,
  pivotX: number,
  pivotZ: number,
  extraY = 0,
  curvatureStrength: number = PLANET_CURVATURE_STRENGTH,
  normalTiltScale = 0.85,
) {
  const dx = worldX - pivotX;
  const dz = worldZ - pivotZ;
  const wrappedX = worldX;
  const wrappedZ = worldZ;
  const terrainY = getTerrainElevation(worldX, worldZ);
  const yOffset = curvatureStrength === 0 ? 0 : -curvatureStrength * (dx * dx + dz * dz);
  const finalY = terrainY + extraY + yOffset;
  const normal = computePlanetSurfaceNormal(
    worldX,
    worldZ,
    pivotX,
    pivotZ,
    curvatureStrength,
    normalTiltScale,
  );
  return {
    wrappedX,
    wrappedZ,
    terrainY,
    yOffset,
    finalY,
    normal,
  };
}

const _upVec = new THREE.Vector3(0, 1, 0);
const _surfNormal = new THREE.Vector3();
const _tiltQuat = new THREE.Quaternion();
const _yawQuat = new THREE.Quaternion();
const _localEuler = new THREE.Euler();
const _localQuat = new THREE.Quaternion();

/**
 * Positions an Object3D on the flat Blitz terrain (elevation = 0, curvature = 0).
 */
export function applyPlanetCurvatureToObject(
  obj: THREE.Object3D,
  worldX: number,
  baseY: number,
  worldZ: number,
  pivotX: number,
  pivotZ: number,
  baseYaw = 0,
  curvatureStrength: number = PLANET_CURVATURE_STRENGTH,
  normalTiltScale = 0.85,
  extraPitch = 0,
  extraRoll = 0,
): number {
  const yOffset =
    curvatureStrength === 0
      ? 0
      : -curvatureStrength * ((worldX - pivotX) ** 2 + (worldZ - pivotZ) ** 2);
  obj.position.set(worldX, baseY + yOffset, worldZ);

  if (curvatureStrength === 0) {
    if (extraPitch !== 0 || extraRoll !== 0) {
      _localEuler.set(extraPitch, baseYaw, extraRoll, 'YXZ');
      obj.quaternion.setFromEuler(_localEuler);
    } else {
      obj.quaternion.setFromAxisAngle(_upVec, baseYaw);
    }
    return 0;
  }

  const { nx, ny, nz } = computePlanetSurfaceNormal(
    worldX,
    worldZ,
    pivotX,
    pivotZ,
    curvatureStrength,
    normalTiltScale,
  );
  _surfNormal.set(nx, ny, nz);
  _tiltQuat.setFromUnitVectors(_upVec, _surfNormal);

  if (extraPitch !== 0 || extraRoll !== 0) {
    _localEuler.set(extraPitch, baseYaw, extraRoll, 'YXZ');
    _localQuat.setFromEuler(_localEuler);
    obj.quaternion.copy(_tiltQuat).multiply(_localQuat);
  } else {
    _yawQuat.setFromAxisAngle(_upVec, baseYaw);
    obj.quaternion.copy(_tiltQuat).multiply(_yawQuat);
  }

  return yOffset;
}
