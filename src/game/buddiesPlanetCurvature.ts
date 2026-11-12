import * as THREE from 'three';

/**
 * Flat Ground Map (Original Buddies Blitz / Blitz World):
 * Planet curvature is disabled (0.0) so the entire world is 100% flat (elevation = 0, curvature = 0).
 */
export const PLANET_CURVATURE_STRENGTH = 0.0;

/**
 * Playable flat arena bounds [-130, +130] in X and Z (expanded 3-part North-Central-South arena
 * with Base Outer Ring Roads & Impassable Outer Perimeter Hill Embankment).
 */
export const PLANET_HALF_EXTENT = 130.0;
export const PLANET_WORLD_PERIOD = 260.0;

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
 * - Widened to span x in [-104.5, -76.5], z in [-38.0, +38.0] (28m x 76m elevated plaza at y = +1.40m)
 * - Returns < 0.0 inside the elevated lobby platform
 */
export function evaluateWestPowerPlantSdf(worldX: number, worldZ: number): number {
  return sdRoundedBox2D(worldX, worldZ, -90.5, 0.0, 14.0, 38.0, 2.4);
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
    smoothstep(-76.0, -104.0, px) * (1.0 - smoothstep(36.0, 44.0, Math.abs(pz))) * 9.5;
  const tennisClubClear =
    smoothstep(-74.0, -102.0, px) *
    (12.2 - 1.7 * smoothstep(-106.0, -112.0, px)) *
    smoothstep(35.0, 41.0, pz) *
    (1.0 - smoothstep(75.0, 82.0, pz));
  // Smoothly open the East side at x >= 101.5 where the shifted Coastal Concrete Seawall & Open Ocean sit
  const eastCoastalOpen = smoothstep(96.5, 102.0, px) * 92.0;
  const d0 = dBox + westCornerBulge - westPlantClear - tennisClubClear - eastCoastalOpen;

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

/**
 * Signed distance to the Impassable Outer Map Boundary:
 * - Returns < 0.0 inside the playable arena (including the Harbor Dock and Coastal Seawall promenade)
 * - Returns >= 0.0 on the North/West/South 4-level stepped hill embankment (`t1 >= 0`)
 *   OR past the East Coastal Seawall / Harbor Quay edge into the Open East Ocean (`worldX >= 109.2`).
 */
export function evaluateOuterEmbankmentSdf(worldX: number, worldZ: number): number {
  const { t1 } = evaluateEmbankmentTierOffsets(worldX, worldZ);
  const eastOceanBarrier = worldX - 109.2;
  return Math.max(t1, eastOceanBarrier);
}

function evalMirroredCentralSCurveDist(px: number, az: number): number {
  // 1. Wind Farm S-Bend (West side x = -70..-25, curving around West Super DropZone & Oasis Lake)
  const s1 = sdSegment2D(px, az, -70.0, 15.0, -52.0, 15.0);
  const s2 = sdSegment2D(px, az, -52.0, 15.0, -41.0, 26.0);
  const s3 = sdSegment2D(px, az, -41.0, 26.0, -25.0, 26.0);

  // 2. Central Forest S-Bend & Equator Crossing (x = -25..+19, framing Central DropZone & Power Core)
  const s4 = sdSegment2D(px, az, -25.0, 26.0, -13.0, 14.0);
  const s5 = sdSegment2D(px, az, -13.0, 0.0, -13.0, 14.0);
  const s6 = sdSegment2D(px, az, -13.0, 14.0, 9.0, 14.0);
  const s7 = sdSegment2D(px, az, 9.0, 14.0, 19.0, 24.0);

  // 3. Expanded East Warzone S-Curve & Symmetric North/South Base Collector Connectors (x = +19..+70)
  const s8 = sdSegment2D(px, az, 19.0, 24.0, 42.0, 24.0);
  const s9 = sdSegment2D(px, az, -25.0, 26.0, -18.0, 33.0);
  const s10 = sdSegment2D(px, az, -18.0, 33.0, -18.0, 52.0);
  const s11 = sdSegment2D(px, az, 19.0, 24.0, 19.0, 52.0);
  const s12 = sdSegment2D(px, az, 42.0, 24.0, 52.0, 15.0);
  const s13 = sdSegment2D(px, az, 52.0, 15.0, 70.0, 15.0);
  const s14 = sdSegment2D(px, az, 42.0, 24.0, 42.0, 52.0);

  return Math.min(s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14);
}

/**
 * Signed distance to the 100% North-South Mirrored Asphalt Road Network:
 * - Complete Outer Ring Highway Loop for the City Tram (x = ±70.0, z = ±52.0 with R = 8.0m corners)
 * - East Harbor Dock Entrance Spurs (x = 70.0..76.5 at z = ±24.0)
 * - 4-Base Complex Ring & Dividing Roads (x in [-60..+60], |z| in [52..108])
 * - Mirrored Twin S-Curve Warzone Roads weaving across the widened Warzone (x in [-70..+70])
 * Returns < 0.0 on the asphalt road surface.
 */
export function evaluateRoadNetworkSdf(worldX: number, worldZ: number): number {
  const px = worldX;
  const az = Math.abs(worldZ);

  // 1. Complete Outer Ring Highway Loop (x = ±70.0, z = ±52.0) & Harbor Dock Entrance Spurs
  const dWest = sdSegment2D(px, az, -70.0, 0.0, -70.0, 44.0);
  const dEast = sdSegment2D(px, az, 70.0, 0.0, 70.0, 44.0);
  const dCollector = sdSegment2D(px, az, -62.0, 52.0, 62.0, 52.0);
  const dHarborTurn = sdSegment2D(px, az, 70.0, 15.0, 76.5, 15.0);

  const dCornerW =
    px <= -62.0 && az >= 44.0 ? Math.abs(Math.hypot(px + 62.0, az - 44.0) - 8.0) : 999.0;
  const dCornerE =
    px >= 62.0 && az >= 44.0 ? Math.abs(Math.hypot(px - 62.0, az - 44.0) - 8.0) : 999.0;

  // 2. 4-Base Complex Ring & Dividing Roads ("masing-masing base dipisahkan dengan jalan raya seperti komplek"):
  //    - 4 Base Plots centered at x = -45.0, -15.0, +15.0, +45.0 (|z| in [64.2, 99.2])
  //    - Divided by 3 Complex Roads at x = -30.0, 0.0, +30.0 + Outer Ring Roads at x = ±60.0 & Rear Road at |z| = 108.0
  const dBaseWestOuter = sdSegment2D(px, az, -60.0, 52.0, -60.0, 108.0);
  const dBaseEastOuter = sdSegment2D(px, az, 60.0, 52.0, 60.0, 108.0);
  const dComplexDiv1 = sdSegment2D(px, az, -30.0, 52.0, -30.0, 108.0);
  const dComplexDiv2 = sdSegment2D(px, az, 0.0, 52.0, 0.0, 108.0);
  const dComplexDiv3 = sdSegment2D(px, az, 30.0, 52.0, 30.0, 108.0);
  const dBaseRear = sdSegment2D(px, az, -60.0, 108.0, 60.0, 108.0);
  const dGateDrive1 = sdSegment2D(px, az, -45.0, 52.0, -45.0, 64.2);
  const dGateDrive2 = sdSegment2D(px, az, -15.0, 52.0, -15.0, 64.2);
  const dGateDrive3 = sdSegment2D(px, az, 15.0, 52.0, 15.0, 64.2);
  const dGateDrive4 = sdSegment2D(px, az, 45.0, 52.0, 45.0, 64.2);

  const dOuterAndBaseRing =
    Math.min(
      Math.min(
        dWest,
        dEast,
        dCollector,
        dHarborTurn,
        dCornerW,
        dCornerE,
        dBaseWestOuter,
        dBaseEastOuter,
        dComplexDiv1,
        dComplexDiv2,
        dComplexDiv3,
        dBaseRear,
      ) - 3.9,
      Math.min(dGateDrive1, dGateDrive2, dGateDrive3, dGateDrive4) - 2.6,
    );

  // 3. Mirrored Central S-Curve Warzone Roads (cutting through Wind Farm, Forest, and East Warzone)
  const dCentralSCurve = evalMirroredCentralSCurveDist(px, az) - 4.2;

  return Math.min(dOuterAndBaseRing, dCentralSCurve);
}

export interface ZebraCrosswalkZoneSpec {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  mirroredZ: boolean;
}

/**
 * Exact 13 North-South Mirrored Zebra Crosswalk zones matching the GLSL terrain shader
 * (`evalZebraCrosswalk` in buddiesBlitzShadersAndAssets.ts).
 */
export const ZEBRA_CROSSWALK_ZONES: readonly ZebraCrosswalkZoneSpec[] = [
  { cx: -18.0, cz: 46.5, hx: 3.2, hz: 2.2, mirroredZ: true },
  { cx: 19.0, cz: 46.5, hx: 3.2, hz: 2.2, mirroredZ: true },
  { cx: 42.0, cz: 46.5, hx: 3.2, hz: 2.2, mirroredZ: true },
  { cx: 73.2, cz: 15.0, hx: 2.2, hz: 3.2, mirroredZ: true },
  { cx: -60.0, cz: 15.0, hx: 2.2, hz: 3.2, mirroredZ: true },
  { cx: 60.0, cz: 15.0, hx: 2.2, hz: 3.2, mirroredZ: true },
  { cx: -70.0, cz: 0.0, hx: 3.2, hz: 2.2, mirroredZ: false },
  { cx: 70.0, cz: 0.0, hx: 3.2, hz: 2.2, mirroredZ: false },
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
  return evaluateRoadNetworkSdf(worldX, worldZ) <= 0.15 || isPointOnZebraCrosswalk(worldX, worldZ);
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
  // 1. Shifted Right-Side Concrete Harbor Apron [76.0..110.0] x [-46.0..+46.0] (east of the x=70.0 Outer Ring Highway)
  const dHarborDock = sdRoundedBox2D(px, pz, 93.0, 0.0, 17.0, 46.0, 2.4);
  // 2. Continuous East Coastal Concrete Seawall Promenade ("beton area pesisir laut") [101.5..110.0] x [-180.0..+180.0]
  const dCoastalWall = sdRoundedBox2D(px, pz, 105.75, 0.0, 4.25, 180.0, 0.8);
  const concreteSdf = Math.min(dHarborDock, dCoastalWall);
  // 3. Open East Ocean extending continuously from x = 110.0 ("ujung dermaga") to the East horizon of the map
  const waterSdf = 110.0 - px;
  return { concreteSdf, waterSdf };
}

function evalModelEstateBaseDirtSdf(px: number, pz: number): number {
  // Only the single intact Bottom-Left Model Estate Base Plot (centered at x = -45.0, z = 81.7, hx = 9.8, hz = 17.5)
  // and its Front Gate Driveway Spur leading from the gate (z = 64.2) to the Collector Road (z = 52.0).
  // All other base areas are empty green grass lots.
  const dPlot0 = sdRoundedBox2D(px, pz, -45.0, 81.7, 9.8, 17.5, 0.8);
  const dSpur0 = sdSegment2D(px, pz, -45.0, 64.2, -45.0, 52.0) - 2.65;
  return Math.min(dPlot0, dSpur0);
}

export function evaluateHaltePlatformSdf(px: number, pz: number): number {
  // Central Halte: center (-61.66, 0.0), halfExtents (3.6, 9.4)
  const dCentral = sdRoundedBox2D(px, pz, -61.66, 0.0, 3.6, 9.4, 0.4);
  // North Residence Halte: center (6.5, -44.67), halfExtents (9.4, 3.6)
  const dNorth = sdRoundedBox2D(px, pz, 6.5, -44.67, 9.4, 3.6, 0.4);
  // South Residence Halte: center (-36.5, 44.67), halfExtents (9.4, 3.6)
  const dSouth = sdRoundedBox2D(px, pz, -36.5, 44.67, 9.4, 3.6, 0.4);
  // Beachfront Harbor Halte: center (79.63, 29.5), halfExtents (3.6, 9.4)
  const dBeach = sdRoundedBox2D(px, pz, 79.63, 29.5, 3.6, 9.4, 0.4);
  // Central Plaza Roadside Pedestrian Sidewalk (worldX in [-76.65 .. -73.85], worldZ in [-38.2 .. +38.2])
  const dPlazaSidewalk = sdRoundedBox2D(px, pz, -75.25, 0.0, 1.45, 38.2, 0.2);
  // Standalone Scenic Clay Tennis Court & Full-Width Perimeter Sidewalks (worldX in [-104.40 .. -73.85], worldZ in [+38.10 .. +65.70])
  const dTennisClub = sdRoundedBox2D(px, pz, -89.20, 51.90, 15.20, 13.70, 0.3);
  return Math.min(
    dTennisClub,
    Math.min(dPlazaSidewalk, Math.min(dCentral, Math.min(dNorth, Math.min(dSouth, dBeach)))),
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
  const harborSafe = smoothstep(-0.2, 1.25, Math.min(concreteSdf, waterSdf));

  const westPlantSdf = evaluateWestPowerPlantSdf(px, pz);
  const westPlantSafe = smoothstep(-0.2, 1.15, westPlantSdf);

  const hardPadSdf = Math.min(dModelEstateDirt, dConstructionYardDirt);
  const padSafe = smoothstep(-0.3, 0.5, hardPadSdf);

  const embSdf = evaluateOuterEmbankmentSdf(px, pz);
  const embSafe = 1.0 - smoothstep(-0.6, 0.8, embSdf);

  const halteSdf = evaluateHaltePlatformSdf(px, pz);
  const halteSafe = smoothstep(-0.2, 0.6, halteSdf);

  return Math.max(
    0.0,
    Math.min(
      1.0,
      grassMask * roadSafe * lakeSafe * harborSafe * westPlantSafe * padSafe * embSafe * halteSafe,
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

/**
 * Base procedural ground elevation:
 * - 0.0m across the flat playable arena, Harbor Dock, and East Coastal Seawall
 * - -1.55m 3-level concave lake basin depression ("level cekungan danau") inside the Oasis Lake (`evaluateNwLakeSdf`)
 * - +1.40m on the West Elevated Concrete Power Plant Platform (`x in [-98.5, -78.5], z in [-35.0, +35.0]`)
 * - Rises into a 4-level stepped contour hill embankment ("Tanggul Bukit dengan Lekukan Level", +11.4m)
 *   around the North, West, and South map boundaries
 */
export function getBaseProceduralGroundElevation(worldX: number, worldZ: number): number {
  const westPlantSdf = evaluateWestPowerPlantSdf(worldX, worldZ);
  let westPlantElev = (1.0 - smoothstep(-0.45, -0.15, westPlantSdf)) * 2.5;
  // Urban Plaza to Street Staircase (20m wide: worldZ in [-10.00 .. +10.00], worldX in [-85.30 .. -75.20]):
  // - Upper Flight (worldX in [-85.30 .. -81.80]): descends from +2.50m Plaza Level to +1.32m Mid-Landing
  // - Mid-Landing (worldX in [-81.80 .. -80.40]): flat granite landing at +1.32m
  // - Lower Flight (worldX in [-80.40 .. -76.90]): descends from +1.32m to +0.08m Urban Sidewalk
  // - Bottom Urban Sidewalk (worldX in [-76.90 .. -75.20]): +0.08m concrete sidewalk stepping down to 0.00m street level
  if (worldX >= -85.35 && worldX <= -75.20 && worldZ >= -10.00 && worldZ <= 10.00) {
    if (worldX <= -81.80) {
      const upperT = smoothstep(-85.30, -81.80, worldX);
      westPlantElev = 2.50 - upperT * (2.50 - 1.32);
    } else if (worldX <= -80.40) {
      westPlantElev = 1.32;
    } else if (worldX <= -76.90) {
      const lowerT = smoothstep(-80.40, -76.90, worldX);
      westPlantElev = 1.32 - lowerT * (1.32 - 0.08);
    } else {
      const curbT = smoothstep(-76.90, -75.25, worldX);
      westPlantElev = 0.08 * (1.0 - curbT);
    }
  }

  // South-East Coastal Beachfront Elevated Weathered Timber Boardwalk (+0.82m),
  // Urban Seaside Walkway (+0.24m), and Seaward Access Stairs & Sloped Beach Ramp
  let seBoardwalkElev = 0.0;
  if (worldX >= 74.8 && worldX <= 96.6 && worldZ >= 45.2 && worldZ <= 103.2) {
    const zMask = smoothstep(45.3, 46.2, worldZ) * (1.0 - smoothstep(102.2, 103.1, worldZ));
    if (worldX < 78.2) {
      // Urban Seaside Walkway (x in [75.2..77.6] at +0.24m) & step up onto Timber Boardwalk (x in [77.4..78.2] to +0.82m)
      const walkUp = smoothstep(74.9, 75.6, worldX) * 0.24;
      const deckStep = smoothstep(77.3, 78.15, worldX) * (0.82 - 0.24);
      seBoardwalkElev = (walkUp + deckStep) * zMask;
    } else if (worldX <= 92.2) {
      // Main Elevated Weathered Timber Boardwalk Deck (+0.82m)
      seBoardwalkElev = 0.82 * zMask;
      // Slight elevation for Shower Pebble Drain Basin (x in [81.6..85.6], z in [70.2..75.4])
      if (worldX >= 81.6 && worldX <= 85.6 && worldZ >= 70.2 && worldZ <= 75.4) {
        seBoardwalkElev = 1.02 * zMask;
      }
    } else {
      // East (Seaward) Step-Stone / Timber Access Stairs & Sloped Beach Ramp (x in [92.2..96.2])
      const inMainStairsOrRamp = worldZ >= 64.8 && worldZ <= 76.8;
      const inSouthStairs = worldZ >= 94.0 && worldZ <= 99.2;
      if (inMainStairsOrRamp || inSouthStairs) {
        const stairSlope = 1.0 - smoothstep(92.2, 96.2, worldX);
        seBoardwalkElev = 0.82 * stairSlope * zMask;
      }
    }
  }

  // Halte Raised Boarding Platform Decks (+0.26m) & Sloped Access Ramps:
  // 1) Central Plaza Halte: worldX in [-64.97, -58.37], worldZ in [-7.70, +7.70], ramps at |worldZ| in [7.70, 9.20]
  // 2) North Residence Halte: worldX in [-1.20, 14.20] (ramps to [-2.70, 15.70]), worldZ in [-47.97, -41.37]
  // 3) South Residence Halte: worldX in [-44.20, -28.80] (ramps to [-45.70, -27.30]), worldZ in [41.37, 47.97]
  // 4) Beachfront Harbor Halte: worldX in [76.31, 82.95], worldZ in [21.80, 37.20] (ramps to [20.30, 38.70])
  let haltePlatformElev = 0.0;
  const absHalteZ = Math.abs(worldZ);
  if (worldX >= -65.15 && worldX <= -58.15 && absHalteZ <= 9.25) {
    const xMask =
      smoothstep(-65.15, -64.85, worldX) * (1.0 - smoothstep(-58.48, -58.15, worldX));
    const zRampMask = 1.0 - smoothstep(7.68, 9.20, absHalteZ);
    haltePlatformElev = 0.26 * xMask * zRampMask;
  } else if (worldZ <= -41.15 && worldZ >= -48.15 && worldX >= -2.75 && worldX <= 15.75) {
    const zMask =
      smoothstep(41.15, 41.45, absHalteZ) * (1.0 - smoothstep(47.85, 48.15, absHalteZ));
    const dxFromCenter = Math.abs(worldX - 6.5);
    const xRampMask = 1.0 - smoothstep(7.68, 9.20, dxFromCenter);
    haltePlatformElev = 0.26 * zMask * xRampMask;
  } else if (worldZ >= 41.15 && worldZ <= 48.15 && worldX >= -45.75 && worldX <= -27.25) {
    const zMask =
      smoothstep(41.15, 41.45, absHalteZ) * (1.0 - smoothstep(47.85, 48.15, absHalteZ));
    const dxFromCenter = Math.abs(worldX - -36.5);
    const xRampMask = 1.0 - smoothstep(7.68, 9.20, dxFromCenter);
    haltePlatformElev = 0.26 * zMask * xRampMask;
  } else if (worldX >= 76.15 && worldX <= 83.15 && worldZ >= 20.25 && worldZ <= 38.75) {
    const xMask =
      smoothstep(76.15, 76.45, worldX) * (1.0 - smoothstep(82.82, 83.15, worldX));
    const dzFromCenter = Math.abs(worldZ - 29.5);
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

  const baseArenaElev =
    Math.max(westPlantElev, seBoardwalkElev, haltePlatformElev) - lakeBasinDepression;
  const { t1, t2, t3, t4 } = evaluateEmbankmentTierOffsets(worldX, worldZ);
  if (t1 <= -0.1) return baseArenaElev;
  const step1 = smoothstep(0.0, 1.45, t1) * 3.2;
  const step2 = smoothstep(0.0, 1.50, t2) * 2.9;
  const step3 = smoothstep(0.0, 1.55, t3) * 2.7;
  const step4 = smoothstep(0.0, 1.60, t4) * 2.6;
  return Math.max(baseArenaElev, step1 + step2 + step3 + step4);
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
