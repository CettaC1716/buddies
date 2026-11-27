import type { PlacedMapProp, StaticWorldStructureObb } from './buddiesBlitzTypes';

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export interface CentralParkBenchSpec {
  id: string;
  style: 'solid_wave' | 'classic_teak';
  x: number;
  z: number;
  rotY: number;
  planterSide?: 'left' | 'right' | 'both' | 'none';
}

export interface CentralParkLamppostSpec {
  id: string;
  x: number;
  z: number;
  rotY: number;
}

export interface CentralParkTreeRelocationEntry {
  id: number;
  kind: 'tree_purple' | 'tree_gold';
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  reason: string;
}

export interface CentralParkPropRelocationEntry {
  id: number;
  kind: PlacedMapProp['kind'];
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  toRotY?: number;
  reason: string;
}

export interface CentralParkGrassExclusionBox {
  x: number;
  z: number;
  yaw: number;
  halfLen: number;
  halfWidth: number;
}

export interface CentralParkSeatSpotSpec {
  id: string;
  x: number;
  z: number;
  yaw: number;
  seatLiftY: number;
  indicatorHeightY: number;
  standUpX: number;
  standUpZ: number;
}

export interface CentralParkBotanicalClusterSpec {
  id: string;
  species: 'english_rose' | 'hydrangea' | 'english_lavender';
  x: number;
  z: number;
  yaw: number;
  scale: number;
  colorVariant: 0 | 1 | 2;
}

export interface CentralParkCanopyTreeSpec {
  id: string;
  species: 'pink_sakura' | 'mature_oak' | 'weeping_willow';
  x: number;
  z: number;
  rotY: number;
  scale: number;
}

export interface CentralParkFenceSegmentSpec {
  id: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  hasHedge: boolean;
}

/**
 * Enlarged 12-vertex Central Urban Plaza Island perimeter polygon spanning
 * `x in [-9.50 .. +57.50]`, `|z| <= 21.70`, inset cleanly inside the surrounding
 * asphalt avenues (`roadSdf >= +0.358m`) so zero curb or chamfer overlaps road markings.
 */
export const CENTRAL_PARK_PERIMETER_VERTICES: readonly [number, number][] = [
  [-9.50, 10.90],
  [9.95, 10.90],
  [20.55, 21.70],
  [41.45, 21.70],
  [52.45, 10.30],
  [57.30, 10.30],
  [57.30, -10.30],
  [52.45, -10.30],
  [41.45, -21.70],
  [20.55, -21.70],
  [9.95, -10.90],
  [-9.50, -10.90],
];

/**
 * 1:1 Masterplan constants for the Redesigned Central Urban Plaza:
 * - Luxury Cream/Rose Terrazzo Promenade + Sweeping Gold Ribbon Inlays + Granite Perimeter Curbs
 * - Civic Cascade Fountain (`29.5, 0.0`) with stepped circular basins & falling water jets
 * - Natural Honey-Oak Timber Pergola & Water Lily Pond (`29.5, -14.8`) wrapped in Wisteria
 * - 3-Story Stepped European Boutique & Rooftop Garden Tower (`12.2, -0.4`) on West Plaza
 * - Cozy Bites & Sips European Cafe Pavilion (`45.2, -0.6`) with outdoor bistro seating on East Plaza
 * - 2-Story Curved-Corner Beauty & Glow / Glow Studio Salon (`29.5, +15.0`) with Rooftop Garden
 * - Solid Wave Stone Benches, Ornate Dual-Basket Brass Lampposts & Blooming Pink Sakura Trees
 */
export const CENTRAL_PARK_MASTERPLAN = {
  bounds: {
    minX: -9.50,
    maxX: 57.30,
    minZ: -21.70,
    maxZ: 21.70,
  },
  gates: {
    west: { x: -9.50, z: 0.0, halfWidth: 3.8, axis: 'z' as const },
    east: { x: 57.30, z: 0.0, halfWidth: 3.8, axis: 'z' as const },
    north: { x: 29.5, z: -21.70, halfWidth: 3.6, axis: 'x' as const },
    south: { x: 29.5, z: 21.70, halfWidth: 3.6, axis: 'x' as const },
  },
  fountainPlaza: {
    x: 29.5,
    z: 0.0,
    plazaOuterRadius: 8.6,
    brickRadius: 8.15,
    apronRadius: 4.85,
    copingRadius: 3.7,
    fountainHeight: 5.85,
  },
  pergolaPond: {
    centerX: 29.5,
    centerZ: -14.8,
    yaw: 0.0,
    pondRadius: 3.35,
    copingRadius: 4.15,
    deckBackRadius: 5.05,
    waterY: 0.24,
    pergolaSpanX: 9.6,
    pergolaSpanZ: 6.2,
    postHeight: 4.4,
    totalHeight: 5.55,
  },
  boutiqueTower: {
    x: 12.2,
    z: -0.4,
    yaw: Math.PI / 2, // Front storefront faces East (+X) onto the Central Cascade Fountain
    halfX: 4.4, // World X span [7.8 .. 16.6]
    halfZ: 4.8, // World Z span [-5.2 .. +4.4]
    groundFloorHeight: 5.2,
    terraceWingHeight: 8.3,
    totalHeight: 12.3,
  },
  cozyCafePavilion: {
    x: 45.2,
    z: -0.6,
    yaw: -Math.PI / 2, // Main entrance faces West (-X) across Fountain toward Boutique Tower
    halfX: 3.6, // World X span [41.6 .. 48.8]
    halfZ: 4.1, // World Z span [-4.7 .. +3.5]
    totalHeight: 7.25,
  },
  beautySalon: {
    x: 29.5,
    z: 15.0,
    yaw: Math.PI, // Front storefront & curved corner face North (-Z) toward Civic Cascade Fountain
    halfX: 6.3, // World X span [23.2 .. 35.8] (12.6m exterior width, synced 1:1 with 12.0m interior + 0.30m walls)
    halfZ: 4.4, // World Z span [10.6 .. 19.4] (8.8m exterior depth, synced 1:1 with 8.2m interior + 0.30m walls)
    upperHalfX: 5.1, // 2F inset upper story width 10.2m with 1.2m side wrap-around balconies
    upperHalfZ: 3.1, // 2F inset upper story depth 6.2m with 1.3m front/rear wrap-around balconies
    groundFloorHeight: 4.92,
    secondFloorHeight: 8.35,
    totalHeight: 9.7,
  },
  bistroTables: [
    { id: 'cozy_cafe_table_fn', x: 40.25, z: -2.55 },
    { id: 'cozy_cafe_table_fs', x: 40.25, z: 1.45 },
    { id: 'cozy_cafe_table_sn', x: 43.35, z: 4.95 },
    { id: 'cozy_cafe_table_ss', x: 46.95, z: 4.95 },
  ] as const,
} as const;

/**
 * Open urban plaza perimeter — zero perimeter iron cage fences (`CENTRAL_PARK_FENCE_RUNS = []`)
 * matching `media_1795017967481_ada46a69.jpg`.
 */
export const CENTRAL_PARK_FENCE_RUNS: readonly CentralParkFenceSegmentSpec[] = [];

/**
 * 10 Urban Plaza Benches: 6 Sculpted Cast-Stone Solid Wave Benches (`solid_wave`,
 * matching `media_1795017982455_f313bc74.jpg`) + 4 Classic Slatted Teak & Iron Benches
 * framing the South Lawn Bed and Fountain Promenade (`media_1795017967481_ada46a69.jpg`).
 */
export const CENTRAL_PARK_BENCHES: readonly CentralParkBenchSpec[] = [
  { id: 'urban_wave_bench_west_n', style: 'solid_wave', x: 0.5, z: -8.8, rotY: 0, planterSide: 'none' },
  { id: 'urban_wave_bench_west_s', style: 'solid_wave', x: 0.5, z: 8.8, rotY: Math.PI, planterSide: 'none' },
  { id: 'urban_wave_bench_nw', style: 'solid_wave', x: 15.2, z: -14.2, rotY: Math.PI * 0.25, planterSide: 'none' },
  { id: 'urban_wave_bench_sw', style: 'solid_wave', x: 15.2, z: 13.6, rotY: Math.PI * 0.75, planterSide: 'none' },
  { id: 'urban_wave_bench_ne', style: 'solid_wave', x: 43.2, z: -14.2, rotY: -Math.PI * 0.25, planterSide: 'none' },
  { id: 'urban_wave_bench_se', style: 'solid_wave', x: 43.2, z: 13.6, rotY: -Math.PI * 0.75, planterSide: 'none' },
  {
    id: 'urban_lawn_bench_n',
    style: 'classic_teak',
    x: 22.8,
    z: 6.2,
    rotY: Math.atan2(6.7, -6.2),
    planterSide: 'both',
  },
  {
    id: 'urban_lawn_bench_s',
    style: 'classic_teak',
    x: 36.2,
    z: -6.2,
    rotY: Math.atan2(-6.7, 6.2),
    planterSide: 'both',
  },
  {
    id: 'urban_fountain_bench_nw',
    style: 'classic_teak',
    x: 22.8,
    z: -6.2,
    rotY: Math.atan2(6.7, 6.2),
    planterSide: 'both',
  },
  {
    id: 'urban_fountain_bench_se',
    style: 'classic_teak',
    x: 36.2,
    z: 6.2,
    rotY: Math.atan2(-6.7, -6.2),
    planterSide: 'both',
  },
];

/**
 * 10 Ornate Aged-Bronze Single-Lantern Lampposts with Twin Suspended Flower Baskets
 * (`media_1795017982455_f313bc74.jpg`) illuminating the perimeter sidewalks & plaza entrances.
 */
export const CENTRAL_PARK_LAMPPOSTS: readonly CentralParkLamppostSpec[] = [
  { id: 'central_park_lamp_west_nw', x: -6.5, z: -8.2, rotY: Math.PI / 2 },
  { id: 'central_park_lamp_west_sw', x: -6.5, z: 8.2, rotY: Math.PI / 2 },
  { id: 'central_park_lamp_espl_n', x: 5.5, z: -8.2, rotY: Math.PI / 2 },
  { id: 'central_park_lamp_espl_s', x: 5.5, z: 8.2, rotY: Math.PI / 2 },
  { id: 'central_park_lamp_north_w', x: 19.6, z: -19.2, rotY: 0 },
  { id: 'central_park_lamp_north_e', x: 39.4, z: -19.2, rotY: 0 },
  { id: 'central_park_lamp_south_w', x: 19.6, z: 19.2, rotY: 0 },
  { id: 'central_park_lamp_south_e', x: 39.4, z: 19.2, rotY: 0 },
  { id: 'central_park_lamp_east_ne', x: 52.6, z: -8.4, rotY: Math.PI / 2 },
  { id: 'central_park_lamp_east_se', x: 52.6, z: 8.4, rotY: Math.PI / 2 },
];

export const CENTRAL_PARK_LANTERN_GLOW_SPEC = {
  lampScale: 1.62,
  localLanternCenterY: 3.68,
  worldBaseOffsetY: 0.02,
  billboardBaseSizeMeters: 0.94,
  dayCutoffNightFactor: 0.05,
} as const;

/**
 * 9 Urban Plaza Canopy Trees combining 6 Blooming Pink Sakura Cherry Blossom Trees
 * (`pink_sakura`) and 3 Fresh Green Civic Shade Trees (`mature_oak`).
 */
export const CENTRAL_PARK_CANOPY_TREES: readonly CentralParkCanopyTreeSpec[] = [
  { id: 'urban_sakura_west_nw', species: 'pink_sakura', x: -3.2, z: -7.8, rotY: 0.35, scale: 1.06 },
  { id: 'urban_sakura_west_sw', species: 'pink_sakura', x: -3.2, z: 7.8, rotY: -0.35, scale: 1.06 },
  { id: 'urban_sakura_pergola_nw', species: 'pink_sakura', x: 20.6, z: -15.8, rotY: 0.55, scale: 1.08 },
  { id: 'urban_sakura_south_sw', species: 'pink_sakura', x: 17.6, z: 11.0, rotY: -0.52, scale: 1.04 },
  { id: 'urban_sakura_east_ne', species: 'pink_sakura', x: 51.2, z: -7.2, rotY: 0.25, scale: 1.05 },
  { id: 'urban_sakura_east_se', species: 'pink_sakura', x: 51.2, z: 7.2, rotY: -0.25, scale: 1.05 },
  { id: 'urban_oak_pergola_ne', species: 'mature_oak', x: 38.4, z: -15.8, rotY: -0.4, scale: 1.08 },
  { id: 'urban_oak_lawn_sw', species: 'mature_oak', x: 43.5, z: -9.2, rotY: 0.65, scale: 0.98 },
  { id: 'urban_oak_southeast', species: 'mature_oak', x: 41.4, z: 11.0, rotY: 0.85, scale: 1.02 },
];

/**
 * Curated botanical flower borders ringing tree planters, Raised Green Lawn Bed corners,
 * Boutique & Cozy Bites terraces, and the rear of the Timber Pergola & Water Lily Pond.
 */
export const CENTRAL_PARK_BOTANICAL_BEDS: readonly CentralParkBotanicalClusterSpec[] = (() => {
  const beds: CentralParkBotanicalClusterSpec[] = [];
  let idx = 0;
  const push = (
    species: CentralParkBotanicalClusterSpec['species'],
    x: number,
    z: number,
    yaw: number,
    scale: number,
    colorVariant: 0 | 1 | 2,
  ) => {
    beds.push({ id: `park_flora_${species}_${idx++}`, species, x, z, yaw, scale, colorVariant });
  };

  // Water Lily Pond & Timber Pergola Scenic Rear & Side Borders
  for (const [px, pz, sp, cv] of [
    [24.6, -15.6, 'hydrangea', 0],
    [24.8, -17.4, 'english_lavender', 1],
    [27.2, -18.5, 'english_rose', 0],
    [31.8, -18.5, 'english_rose', 2],
    [34.2, -17.4, 'english_lavender', 0],
    [34.4, -15.6, 'hydrangea', 2],
  ] as const) {
    push(sp, px, pz, px * 0.5, 0.98, cv);
  }

  // Boutique Tower & Cafe Pavilion Side Borders
  for (const [bx, bz, sp, cv] of [
    [7.2, -4.6, 'hydrangea', 1],
    [7.2, 3.8, 'english_rose', 0],
    [49.6, -4.2, 'english_lavender', 1],
    [49.6, 3.0, 'hydrangea', 2],
  ] as const) {
    push(sp, bx, bz, bx * 0.3, 0.96, cv);
  }

  // West & East Sakura Tree Planter Ring Florals
  for (const tree of CENTRAL_PARK_CANOPY_TREES) {
    push('english_lavender', tree.x - 0.85, tree.z + 0.55, 0.4, 0.88, 0);
    push('hydrangea', tree.x + 0.85, tree.z - 0.55, 1.2, 0.88, 1);
  }

  return beds;
})();

/**
 * 100% Lossless Tree Relocation Manifest (retained intact off-island so all 51 base map trees remain untouched!).
 */
export const CENTRAL_PARK_TREE_RELOCATION_MANIFEST: readonly CentralParkTreeRelocationEntry[] = [
  { id: 506, kind: 'tree_purple', fromX: -4.5, fromZ: -7.2, toX: -52.0, toZ: -28.0, reason: 'Cleared central island for Urban Plaza; placed on NW Oasis grass lawn' },
  { id: 507, kind: 'tree_purple', fromX: -4.5, fromZ: 7.2, toX: -52.0, toZ: 26.0, reason: 'Cleared central island for Urban Plaza; placed on SW Oasis grass lawn' },
  { id: 508, kind: 'tree_gold', fromX: 3.2, fromZ: -7.2, toX: -40.0, toZ: -35.0, reason: 'Cleared central island for Urban Plaza; placed on N-West grass corridor' },
  { id: 509, kind: 'tree_gold', fromX: 3.2, fromZ: 7.2, toX: -40.0, toZ: 35.0, reason: 'Cleared central island for Urban Plaza; placed on S-West grass corridor' },
  { id: 510, kind: 'tree_purple', fromX: 12.5, fromZ: -5.5, toX: -51.0, toZ: -8.0, reason: 'Cleared central island for Urban Plaza; placed on West Oasis meadow' },
  { id: 511, kind: 'tree_purple', fromX: 12.5, fromZ: 5.5, toX: -51.0, toZ: 7.5, reason: 'Cleared central island for Urban Plaza; placed on West Oasis meadow' },
  { id: 512, kind: 'tree_gold', fromX: 16.5, fromZ: 0.0, toX: -39.5, toZ: -16.5, reason: 'Cleared central island for Urban Plaza; placed on N Oasis lakeside lawn' },
  { id: 570, kind: 'tree_gold', fromX: 28.5, fromZ: 0.0, toX: -39.5, toZ: 16.5, reason: 'Cleared central island for Urban Plaza; placed on S Oasis lakeside lawn' },
  { id: 571, kind: 'tree_purple', fromX: 25.5, fromZ: -8.5, toX: 72.5, toZ: -60.0, reason: 'Cleared central island for Urban Plaza; placed on NE outer parkway lawn' },
  { id: 572, kind: 'tree_purple', fromX: 25.5, fromZ: 8.5, toX: 72.5, toZ: 62.5, reason: 'Cleared central island for Urban Plaza; placed on SE outer parkway lawn' },
  { id: 573, kind: 'tree_gold', fromX: 28.0, fromZ: -14.5, toX: 72.5, toZ: -83.0, reason: 'Cleared central island for Urban Plaza; placed on NE outer parkway lawn' },
  { id: 574, kind: 'tree_gold', fromX: 28.0, fromZ: 14.5, toX: 72.5, toZ: 83.0, reason: 'Cleared central island for Urban Plaza; placed on SE outer parkway lawn' },
  { id: 577, kind: 'tree_purple', fromX: 38.5, fromZ: -6.5, toX: -79.5, toZ: 70.5, reason: 'Cleared central island for Urban Plaza; placed on Far SW lawn south of Tennis Club' },
  { id: 578, kind: 'tree_purple', fromX: 38.5, fromZ: 6.5, toX: -92.0, toZ: 70.5, reason: 'Cleared central island for Urban Plaza; placed on Far SW lawn south of Tennis Club' },
  { id: 579, kind: 'tree_gold', fromX: 46.5, fromZ: 0.0, toX: -103.5, toZ: 69.5, reason: 'Cleared central island for Urban Plaza; placed on Far SW corner lawn' },
  { id: 337, kind: 'tree_purple', fromX: -68.5, fromZ: 58.5, toX: -74.0, toZ: 82.0, reason: 'Moved off Outer Tram Sidewalk onto Far SW grass lawn' },
  { id: 336, kind: 'tree_purple', fromX: -69.5, fromZ: -96.8, toX: -86.0, toZ: 82.0, reason: 'De-congested from tree 205 onto Far SW grass lawn' },
  { id: 556, kind: 'tree_gold', fromX: 4.0, fromZ: -34.0, toX: 72.5, toZ: -101.0, reason: 'De-congested from tree 554 onto NE outer lawn' },
  { id: 566, kind: 'tree_gold', fromX: 4.0, fromZ: 35.2, toX: 72.5, toZ: 101.0, reason: 'De-congested from tree 564 onto SE outer lawn' },
  { id: 594, kind: 'tree_gold', fromX: 48.0, fromZ: -28.5, toX: -26.0, toZ: -36.0, reason: 'De-congested from tree 592 & S-curve road curb onto N Mid lawn' },
  { id: 595, kind: 'tree_gold', fromX: 48.0, fromZ: 28.5, toX: -29.0, toZ: 34.5, reason: 'De-congested from tree 593 & S-curve road curb onto S Mid lawn' },
  { id: 553, kind: 'tree_purple', fromX: 11.0, fromZ: -32.5, toX: -74.0, toZ: 98.0, reason: 'Cleared off public_pad_red_ce shield onto Far SW grass lawn' },
  { id: 563, kind: 'tree_purple', fromX: 11.0, fromZ: 32.5, toX: -71.5, toZ: 62.5, reason: 'Cleared off public_pad_blue_ce shield onto Far SW grass lawn' },
  { id: 565, kind: 'tree_purple', fromX: -8.5, fromZ: 37.2, toX: -6.8, toZ: 37.8, reason: 'Shifted 1.8m east clear of public_pad_blue_cw shield radius' },
];

export const CENTRAL_PARK_PROP_RELOCATION_MANIFEST: readonly CentralParkPropRelocationEntry[] = [
  { id: 504, kind: 'pipe_cluster', fromX: 7.5, fromZ: -5.6, toX: 86.5, toZ: 21.5, toRotY: 0.0, reason: 'Moved industrial pipe stack to Southern Concrete Harbor Apron' },
  { id: 505, kind: 'pipe_cluster', fromX: 7.5, fromZ: 5.6, toX: 86.5, toZ: 38.5, toRotY: Math.PI, reason: 'Moved industrial pipe stack to Southern Concrete Harbor Apron' },
  { id: 524, kind: 'bench', fromX: 23.8, fromZ: 0.0, toX: -47.5, toZ: -10.2, toRotY: -Math.PI / 2, reason: 'Relocated legacy central bench to NW Oasis lakeside lawn' },
  { id: 525, kind: 'bench', fromX: 25.2, fromZ: 0.0, toX: -47.5, toZ: 10.2, toRotY: -Math.PI / 2, reason: 'Relocated legacy central bench to SW Oasis lakeside lawn' },
  { id: 582, kind: 'recycle_bin', fromX: 24.5, fromZ: -2.3, toX: -47.5, toZ: -7.8, toRotY: -Math.PI / 2, reason: 'Paired with relocated bench 524 at NW Oasis' },
  { id: 583, kind: 'recycle_bin', fromX: 24.5, fromZ: 2.3, toX: -47.5, toZ: 7.8, toRotY: -Math.PI / 2, reason: 'Paired with relocated bench 525 at SW Oasis' },
  { id: 575, kind: 'flower_cluster', fromX: 26.5, fromZ: -4.2, toX: -44.5, toZ: -9.8, toRotY: 0.6, reason: 'Moved legacy flower cluster to NW Oasis grass border' },
  { id: 576, kind: 'flower_cluster', fromX: 26.5, fromZ: 4.2, toX: -44.5, toZ: 9.8, toRotY: -0.6, reason: 'Moved legacy flower cluster to SW Oasis grass border' },
  { id: 598, kind: 'river_rock', fromX: 48.0, fromZ: -8.5, toX: -37.2, toZ: -11.8, toRotY: 0.7, reason: 'Moved boulder to NW Oasis lakeside shore' },
  { id: 599, kind: 'river_rock', fromX: 48.0, fromZ: 8.5, toX: -37.2, toZ: 11.8, toRotY: -0.7, reason: 'Moved boulder to SW Oasis lakeside shore' },
];

/**
 * Ray-casting point-in-polygon check for the 12-vertex Central Urban Plaza boundary.
 */
export function isPointInsideCentralParkPolygon(worldX: number, worldZ: number): boolean {
  const b = CENTRAL_PARK_MASTERPLAN.bounds;
  if (worldX < b.minX || worldX > b.maxX || worldZ < b.minZ || worldZ > b.maxZ) {
    return false;
  }
  const poly = CENTRAL_PARK_PERIMETER_VERTICES;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const zi = poly[i][1];
    const xj = poly[j][0];
    const zj = poly[j][1];
    const intersect =
      zi > worldZ !== zj > worldZ &&
      worldX < ((xj - xi) * (worldZ - zi)) / (zj - zi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Returns true if (worldX, worldZ) falls inside the Central Island envelope.
 */
export function isPointInsideCentralIslandEnvelope(worldX: number, worldZ: number): boolean {
  if (worldX < -10.2 || worldX > 58.0) return false;
  if (worldX <= 8.2) return Math.abs(worldZ) <= 11.4;
  return Math.abs(worldZ) <= 22.3;
}

/**
 * Evaluates walkable ground elevation (in meters) across Central Urban Plaza:
 * - Stepped outer circular stone base around Civic Cascade Fountain (`R in [3.75..4.85]`) smoothly rises `+0.32m`
 * - Promenade deck stands cleanly at `+0.04m` above street level (`0.0m` along outer ramp borders)
 */
export function evaluateCentralParkElevation(worldX: number, worldZ: number): number {
  const fp = CENTRAL_PARK_MASTERPLAN.fountainPlaza;
  const distFountain = Math.hypot(worldX - fp.x, worldZ - fp.z);
  if (distFountain >= fp.copingRadius - 0.1 && distFountain <= fp.apronRadius) {
    const stepT = 1.0 - smoothstep(fp.copingRadius + 0.1, fp.apronRadius, distFountain);
    return Number((stepT * 0.32).toFixed(3));
  }
  return 0.0;
}

/**
 * Interactive seating spots for all 10 Urban Plaza Benches (6 Solid Wave + 4 Classic Teak).
 */
export const CENTRAL_PARK_SEAT_SPOTS: readonly CentralParkSeatSpotSpec[] = (() => {
  const spots: CentralParkSeatSpotSpec[] = [];
  for (const bench of CENTRAL_PARK_BENCHES) {
    const yaw = Math.PI / 2 - bench.rotY;
    const fwdX = Math.sin(bench.rotY);
    const fwdZ = Math.cos(bench.rotY);
    const frontShift = bench.style === 'solid_wave' ? 0.16 : 0.14;
    spots.push({
      id: bench.id,
      x: Number((bench.x + fwdX * frontShift).toFixed(2)),
      z: Number((bench.z + fwdZ * frontShift).toFixed(2)),
      yaw: Number(yaw.toFixed(4)),
      seatLiftY: bench.style === 'solid_wave' ? 0.05 : 0.04,
      indicatorHeightY: 1.32,
      standUpX: Number((bench.x + fwdX * 1.35).toFixed(2)),
      standUpZ: Number((bench.z + fwdZ * 1.35).toFixed(2)),
    });
  }
  return spots;
})();

/**
 * 6 compact Grass exclusion OBB rectangles wrapping the enlarged 12-vertex Central Urban Plaza
 * so ZERO wild InfiniteGrass blades or InfiniteGrassPetals grow inside the paved urban plaza.
 */
export function getCentralParkGrassExclusionBoxes(): readonly CentralParkGrassExclusionBox[] {
  return [
    { x: 24.0, z: 0.0, yaw: 0, halfLen: 34.2, halfWidth: 11.4 },
    { x: 55.6, z: 0.0, yaw: 0, halfLen: 2.3, halfWidth: 11.6 },
    { x: 30.9, z: 0.0, yaw: 0, halfLen: 12.6, halfWidth: 22.3 },
    { x: 31.0, z: 0.0, yaw: Math.PI / 4, halfLen: 8.8, halfWidth: 24.8 },
    { x: 31.0, z: 0.0, yaw: -Math.PI / 4, halfLen: 8.8, halfWidth: 24.8 },
    { x: 30.9, z: 0.0, yaw: 0, halfLen: 18.8, halfWidth: 15.2 },
  ];
}

/**
 * Generates solid 2D OBB colliders for the Central Urban Plaza architecture, fountain,
 * pond, lawn bed, bistro patio, benches, lampposts & trees while keeping all walkways wide & walkable.
 */
export function getCentralParkObstacles(): StaticWorldStructureObb[] {
  const mp = CENTRAL_PARK_MASTERPLAN;
  const obs: StaticWorldStructureObb[] = [];

  // 1. Civic Cascade Fountain Basin
  obs.push({
    id: 'central_park_stone_fountain',
    x: mp.fountainPlaza.x,
    z: mp.fountainPlaza.z,
    halfX: mp.fountainPlaza.copingRadius,
    halfZ: mp.fountainPlaza.copingRadius,
    rotY: 0,
    heightY: mp.fountainPlaza.fountainHeight,
    mat: 'concrete',
  });

  // 2. Boutique & Rooftop Garden Tower (West Wing)
  obs.push({
    id: 'urban_plaza_boutique_tower',
    x: mp.boutiqueTower.x,
    z: mp.boutiqueTower.z,
    halfX: mp.boutiqueTower.halfX + 0.2,
    halfZ: mp.boutiqueTower.halfZ + 0.2,
    rotY: 0,
    heightY: mp.boutiqueTower.totalHeight,
    mat: 'concrete',
  });

  // 3. Cozy Bites & Sips Cafe Pavilion (East Wing) — owner GLB body box.
  // The pavilion visual is now the owner-supplied GLB (bites_sips_pavilion.glb,
  // placed at the masterplan anchor at native size, yaw -PI/2). Its cafe body
  // (the source model's COL_WALL_CafeBody) spans local x [-3.14..4.14],
  // z [-4.14..3.14], which under that yaw maps to world x [42.06..49.34],
  // z [-3.74..3.54] — centre (45.70, -0.10), half extents 3.64. The collider
  // tracks the model's real walls (+0.2m margin, as before) instead of the
  // retired procedural shell (7.2 x 8.2m centred on the anchor), so no
  // invisible wall crosses the model's west sidewalk or door, and the body
  // no longer pokes out past its collider on the east side.
  obs.push({
    id: 'urban_plaza_cozy_cafe',
    x: 45.7,
    z: -0.1,
    halfX: 3.84,
    halfZ: 3.84,
    rotY: 0,
    heightY: 4.82,
    mat: 'concrete',
  });

  // 4. Outdoor Bistro Cafe Tables (1.68x outdoor avatar ergonomics)
  for (const tbl of mp.bistroTables) {
    obs.push({
      id: tbl.id,
      x: tbl.x,
      z: tbl.z,
      halfX: 1.02,
      halfZ: 1.02,
      rotY: 0,
      heightY: 1.55,
      mat: 'wood',
    });
  }

  // 5. Timber Pergola & Water Lily Pond Basin (North) + 4 Corner Timber Post Footings
  obs.push({
    id: 'central_park_duck_pond',
    x: mp.pergolaPond.centerX,
    z: mp.pergolaPond.centerZ,
    halfX: mp.pergolaPond.copingRadius + 0.25,
    halfZ: mp.pergolaPond.copingRadius * 0.78 + 0.25,
    rotY: 0,
    heightY: mp.pergolaPond.totalHeight,
    mat: 'concrete',
  });

  // 6. Central Urban Plaza Beauty Salon ("BEAUTY & GLOW / GLOW STUDIO", South)
  obs.push({
    id: 'urban_plaza_beauty_salon',
    x: mp.beautySalon.x,
    z: mp.beautySalon.z,
    halfX: mp.beautySalon.halfX + 0.2,
    halfZ: mp.beautySalon.halfZ + 0.2,
    rotY: 0,
    heightY: mp.beautySalon.totalHeight,
    mat: 'concrete',
  });

  // 7. 10 Urban Plaza Benches (6 Sculpted Wave + 4 Classic Teak)
  for (const bench of CENTRAL_PARK_BENCHES) {
    obs.push({
      id: bench.id,
      x: bench.x,
      z: bench.z,
      halfX: bench.style === 'solid_wave' ? 1.48 : 1.4,
      halfZ: 0.56,
      rotY: bench.rotY,
      heightY: 1.35,
      mat: bench.style === 'solid_wave' ? 'concrete' : 'wood',
    });
  }

  // 8. 10 Ornate Hanging-Basket Brass Lampposts (~7.2m full height)
  for (const lamp of CENTRAL_PARK_LAMPPOSTS) {
    obs.push({
      id: lamp.id,
      x: lamp.x,
      z: lamp.z,
      halfX: 0.36,
      halfZ: 0.36,
      rotY: 0,
      heightY: 7.4,
      mat: 'metal',
    });
  }

  // 9. 9 Urban Plaza Canopy Trees (6 Pink Sakura + 3 Mature Oak)
  for (const tree of CENTRAL_PARK_CANOPY_TREES) {
    obs.push({
      id: tree.id,
      x: tree.x,
      z: tree.z,
      halfX: 0.62,
      halfZ: 0.62,
      rotY: 0,
      heightY: tree.species === 'pink_sakura' ? 7.8 : 9.4,
      mat: 'wood',
    });
  }

  return obs;
}
