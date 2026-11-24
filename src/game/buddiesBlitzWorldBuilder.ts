import * as THREE from 'three';
import {
  getAnyRoleBadgeSpec,
  type AnyRoleBadgeId,
} from './buddiesProfileIdentity';
import {
  CENTRAL_PARK_TRANSIT_KIOSK_SPEC,
  CENTRAL_PLAZA_INFO_CENTER_KIOSK_SPEC,
  CITY_TRAFFIC_SIGNAL_POLE_SPECS,
  IndividualCommanderBaseState,
  isCommanderBasePlotActive,
} from './buddiesBlitzRules';
import {
  BEACHFRONT_STILT_CABIN_SPEC,
  resetTerrainSculptGrid,
  restoreTerrainSculptGrid,
} from './buddiesPlanetCurvature';
import {
  getBaseSkyshieldTurrets,
} from './buddiesBlitzShadersAndAssets';
import {
  ArenaMapLayout,
  PlacedMapProp,
  StaticWorldStructureObb,
} from './buddiesBlitzTypes';
import { getBeachClubObstacles } from './buddiesBeachClubRules';
import {
  getCentralParkObstacles,
  isPointInsideCentralIslandEnvelope,
} from './buddiesCentralParkRules';
import {
  getGrandCasinoObstacles,
  isInsideNorthGrandCasinoFootprint,
} from './buddiesGrandCasinoRules';
import { computeScooterShopWorldColliders } from './buddiesUrbanScooterRules';
import {
  computeRealEstateKioskWorldColliders,
  REAL_ESTATE_FURNITURE_KIOSK_LAYOUT,
} from './buddiesRealEstateKioskRules';
import { computeFashionKioskWorldColliders } from './buddiesFashionKioskRules';

export const MAP_STORAGE_KEY = 'blitz_arena_map_layout_v56';

/**
 * Single 180°-Rotationally Symmetric Base Section Generator (`buildTeamBaseQuadrant`):
 * - `sign = +1` ('blue'): South Base Complex `(4 Individual Base Plots at x = [-45, -15, +15, +45], z > 0)`
 * - `sign = -1` ('red') : North Base Complex `(4 Individual Base Plots at x = [+45, +15, -15, -45], z < 0)`
 */
export function buildTeamBaseQuadrant(
  team: 'blue' | 'red',
  sign: 1 | -1 = team === 'blue' ? 1 : -1,
  startId: number = team === 'blue' ? 100 : 200,
): PlacedMapProp[] {
  const rotOffset = Math.PI / 2 + (sign === -1 ? Math.PI : 0);
  let nextId = startId;
  const placeWorld = (
    kind: PlacedMapProp['kind'],
    wx: number,
    wz: number,
    lRotY: number,
    scale = 1.0,
  ): PlacedMapProp => ({
    id: nextId++,
    kind,
    x: Number((sign * wx).toFixed(2)),
    z: Number((sign * wz).toFixed(2)),
    rotY: Number((lRotY + rotOffset).toFixed(4)),
    scale,
  });

  return [
    placeWorld('hydrant', -55.2, 56.8, 0.0, 1.05),
    placeWorld('hydrant', -25.2, 56.8, 0.0, 1.05),
    placeWorld('hydrant', 4.8, 56.8, 0.0, 1.05),
    placeWorld('hydrant', 34.8, 56.8, 0.0, 1.05),
    placeWorld(
      'tree_purple',
      sign === -1 ? 67.2 : 66.5,
      sign === -1 ? 83.2 : 74.5,
      -0.45,
      1.12,
    ),
    placeWorld('tree_gold', 66.5, 91.5, 0.25, 1.1),
    placeWorld('tree_purple', -66.5, 74.5, 0.55, 1.12),
    placeWorld('tree_gold', -66.5, 91.5, -0.35, 1.1),
  ];
}

export const DEFAULT_ARENA_MAP_LAYOUT: ArenaMapLayout = {
  blueHq: { x: 0.0, z: 86.0 },
  bluePad: { x: -37.7, z: 77.8 },
  redHq: { x: 0.0, z: -86.0 },
  redPad: { x: 37.7, z: -77.8 },
  centerDropZone: { x: 0, z: 0 },
  props: [
    ...buildTeamBaseQuadrant('blue', 1, 100),
    ...buildTeamBaseQuadrant('red', -1, 200),
    { id: 502, kind: 'giant_pipe', x: -5.5, z: -22.5, rotY: 0.0, scale: 1.12 },
    { id: 503, kind: 'giant_pipe', x: -5.5, z: 22.5, rotY: 0.0, scale: 1.12 },
    { id: 506, kind: 'tree_purple', x: -52.0, z: -28.0, rotY: 0.35, scale: 1.08 },
    { id: 507, kind: 'tree_purple', x: -52.0, z: 26.0, rotY: -0.35, scale: 1.08 },
    { id: 508, kind: 'tree_gold', x: -40.0, z: -35.0, rotY: 0.65, scale: 1.08 },
    { id: 509, kind: 'tree_gold', x: -40.0, z: 35.0, rotY: -0.65, scale: 1.08 },
    { id: 510, kind: 'tree_purple', x: -51.0, z: -8.0, rotY: 0.15, scale: 1.08 },
    { id: 511, kind: 'tree_purple', x: -51.0, z: 7.5, rotY: -0.15, scale: 1.08 },
    { id: 512, kind: 'tree_gold', x: -39.5, z: -16.5, rotY: 0.45, scale: 1.1 },

    { id: 550, kind: 'tree_gold', x: -9.5, z: -28.0, rotY: 0.25, scale: 1.14 },
    { id: 551, kind: 'tree_purple', x: -2.5, z: -24.5, rotY: -0.45, scale: 1.12 },
    { id: 552, kind: 'tree_gold', x: 6.5, z: -25.5, rotY: 0.75, scale: 1.15 },
    { id: 553, kind: 'tree_purple', x: -74.0, z: 98.0, rotY: -0.65, scale: 1.1 },
    { id: 554, kind: 'tree_gold', x: 2.5, z: -35.2, rotY: 0.35, scale: 1.12 },
    { id: 555, kind: 'tree_purple', x: -8.5, z: -37.2, rotY: 0.95, scale: 1.08 },
    { id: 556, kind: 'tree_gold', x: 72.5, z: -101.0, rotY: -0.25, scale: 1.12 },
    { id: 557, kind: 'flower_cluster', x: 0.0, z: -35.0, rotY: 0.4, scale: 1.35 },
    { id: 558, kind: 'river_rock', x: 2.0, z: -32.0, rotY: 0.8, scale: 1.4 },

    { id: 560, kind: 'tree_gold', x: -9.5, z: 28.0, rotY: -0.25, scale: 1.14 },
    { id: 561, kind: 'tree_purple', x: -2.5, z: 24.5, rotY: 0.45, scale: 1.12 },
    { id: 562, kind: 'tree_gold', x: 6.5, z: 25.5, rotY: -0.75, scale: 1.15 },
    { id: 563, kind: 'tree_purple', x: -71.5, z: 62.5, rotY: 0.65, scale: 1.1 },
    { id: 564, kind: 'tree_gold', x: 2.5, z: 35.8, rotY: -0.35, scale: 1.12 },
    { id: 565, kind: 'tree_purple', x: -6.8, z: 37.8, rotY: -0.95, scale: 1.08 },
    { id: 566, kind: 'tree_gold', x: 72.5, z: 101.0, rotY: 0.25, scale: 1.12 },
    { id: 567, kind: 'flower_cluster', x: 0.0, z: 35.0, rotY: -0.4, scale: 1.35 },
    { id: 568, kind: 'river_rock', x: -1.0, z: 32.0, rotY: -0.8, scale: 1.4 },

    { id: 570, kind: 'tree_gold', x: -39.5, z: 16.5, rotY: 0.45, scale: 1.14 },
    { id: 571, kind: 'tree_purple', x: 72.5, z: -60.0, rotY: -0.35, scale: 1.12 },
    { id: 572, kind: 'tree_purple', x: 72.5, z: 62.5, rotY: 0.35, scale: 1.12 },
    { id: 573, kind: 'tree_gold', x: 72.5, z: -83.0, rotY: -0.55, scale: 1.12 },
    { id: 574, kind: 'tree_gold', x: 72.5, z: 83.0, rotY: 0.55, scale: 1.12 },
    { id: 575, kind: 'flower_cluster', x: -44.5, z: -9.8, rotY: 0.6, scale: 1.32 },
    { id: 576, kind: 'flower_cluster', x: -44.5, z: 9.8, rotY: -0.6, scale: 1.32 },
    { id: 577, kind: 'tree_purple', x: -79.5, z: 70.5, rotY: 0.25, scale: 1.14 },
    { id: 578, kind: 'tree_purple', x: -92.0, z: 70.5, rotY: -0.25, scale: 1.14 },
    { id: 579, kind: 'tree_gold', x: -103.5, z: 69.5, rotY: -0.4, scale: 1.16 },
    { id: 590, kind: 'tree_gold', x: 31.0, z: -36.5, rotY: 0.35, scale: 1.14 },
    { id: 591, kind: 'tree_gold', x: 31.0, z: 36.5, rotY: -0.35, scale: 1.14 },
    { id: 592, kind: 'tree_purple', x: 54.5, z: -27.5, rotY: -0.45, scale: 1.14 },
    { id: 593, kind: 'tree_purple', x: 49.5, z: 30.2, rotY: 0.45, scale: 1.14 },
    { id: 594, kind: 'tree_gold', x: -26.0, z: -36.0, rotY: 0.55, scale: 1.12 },
    { id: 595, kind: 'tree_gold', x: -29.0, z: 34.5, rotY: -0.55, scale: 1.12 },
    { id: 596, kind: 'flower_cluster', x: 52.0, z: -38.5, rotY: 0.5, scale: 1.32 },
    { id: 597, kind: 'flower_cluster', x: 52.0, z: 38.5, rotY: -0.5, scale: 1.32 },
    { id: 598, kind: 'river_rock', x: -37.2, z: -11.8, rotY: 0.7, scale: 1.35 },
    { id: 599, kind: 'river_rock', x: -37.2, z: 11.8, rotY: -0.7, scale: 1.35 },

    // Tree 491 removed from South Plaza L-Shaped Glasshouse Cafe interior ("hapus pohon yang di dadlam cafe kaca")

    // Wind turbines removed from West Ring Road ("hapus windfarm yang ada di jalan ini")

    { id: 310, kind: 'river_rock', x: -41.2, z: -4.5, rotY: 0.2, scale: 1.45 },
    { id: 311, kind: 'river_rock', x: -41.2, z: 4.5, rotY: -0.2, scale: 1.45 },
    { id: 312, kind: 'river_rock', x: -38.5, z: -10.2, rotY: 1.1, scale: 1.35 },
    { id: 313, kind: 'river_rock', x: -38.5, z: 10.2, rotY: -1.1, scale: 1.35 },
    { id: 314, kind: 'river_rock', x: -31.0, z: -12.6, rotY: 2.0, scale: 1.5 },
    { id: 315, kind: 'river_rock', x: -31.0, z: 12.6, rotY: -2.0, scale: 1.5 },
    { id: 316, kind: 'river_rock', x: -23.2, z: -9.2, rotY: 0.6, scale: 1.4 },
    { id: 317, kind: 'river_rock', x: -23.2, z: 9.2, rotY: -0.6, scale: 1.4 },
    { id: 318, kind: 'river_rock', x: -21.2, z: -3.5, rotY: 1.4, scale: 1.35 },
    { id: 319, kind: 'river_rock', x: -21.2, z: 3.5, rotY: -1.4, scale: 1.35 },

    { id: 320, kind: 'flower_cluster', x: -42.0, z: 0.0, rotY: 0.0, scale: 1.35 },
    { id: 321, kind: 'flower_cluster', x: -35.0, z: -12.2, rotY: 0.8, scale: 1.3 },
    { id: 322, kind: 'flower_cluster', x: -35.0, z: 12.2, rotY: -0.8, scale: 1.3 },
    { id: 323, kind: 'flower_cluster', x: -25.5, z: -11.5, rotY: 1.5, scale: 1.35 },
    { id: 324, kind: 'flower_cluster', x: -25.5, z: 11.5, rotY: -1.5, scale: 1.35 },
    { id: 325, kind: 'flower_cluster', x: -21.5, z: 0.0, rotY: 1.2, scale: 1.3 },
    // Extended Central Plaza botanical flower mounds spread across the Oasis, Center, and East parks
    { id: 340, kind: 'flower_cluster', x: -50.0, z: -3.8, rotY: 0.35, scale: 1.32 },
    { id: 341, kind: 'flower_cluster', x: -50.0, z: 3.8, rotY: -0.35, scale: 1.32 },
    { id: 342, kind: 'flower_cluster', x: -48.0, z: 14.2, rotY: 0.75, scale: 1.35 },
    { id: 343, kind: 'flower_cluster', x: -51.5, z: 19.5, rotY: 1.25, scale: 1.38 },
    { id: 344, kind: 'flower_cluster', x: -44.5, z: 21.5, rotY: -0.65, scale: 1.40 },
    { id: 345, kind: 'flower_cluster', x: -35.5, z: 22.5, rotY: 0.45, scale: 1.36 },
    { id: 346, kind: 'flower_cluster', x: -34.0, z: 30.0, rotY: -1.15, scale: 1.34 },
    { id: 347, kind: 'flower_cluster', x: -46.5, z: 31.0, rotY: 0.90, scale: 1.36 },
    { id: 348, kind: 'flower_cluster', x: -45.0, z: -33.0, rotY: -0.50, scale: 1.34 },
    { id: 349, kind: 'flower_cluster', x: -36.5, z: -32.5, rotY: 0.55, scale: 1.34 },
    { id: 350, kind: 'flower_cluster', x: -35.0, z: -17.0, rotY: -0.85, scale: 1.32 },
    { id: 351, kind: 'flower_cluster', x: -26.0, z: -17.0, rotY: 1.10, scale: 1.32 },
    { id: 352, kind: 'flower_cluster', x: -26.0, z: 16.0, rotY: -1.10, scale: 1.32 },
    { id: 353, kind: 'flower_cluster', x: -23.0, z: -14.0, rotY: 0.30, scale: 1.30 },
    { id: 354, kind: 'flower_cluster', x: -10.0, z: -32.0, rotY: 0.60, scale: 1.35 },
    { id: 355, kind: 'flower_cluster', x: -12.5, z: -25.5, rotY: -0.75, scale: 1.32 },
    { id: 356, kind: 'flower_cluster', x: -4.5, z: -29.5, rotY: 1.35, scale: 1.34 },
    { id: 357, kind: 'flower_cluster', x: 2.0, z: -24.5, rotY: -0.45, scale: 1.32 },
    { id: 358, kind: 'flower_cluster', x: 5.0, z: -30.5, rotY: 0.85, scale: 1.34 },
    { id: 359, kind: 'flower_cluster', x: -12.5, z: 26.5, rotY: -0.60, scale: 1.35 },
    { id: 360, kind: 'flower_cluster', x: -4.5, z: 31.0, rotY: 0.75, scale: 1.34 },
    { id: 361, kind: 'flower_cluster', x: 2.5, z: 23.5, rotY: -1.25, scale: 1.32 },
    { id: 362, kind: 'flower_cluster', x: 5.5, z: 31.5, rotY: 0.50, scale: 1.34 },
    { id: 363, kind: 'flower_cluster', x: 10.5, z: 28.0, rotY: -0.90, scale: 1.32 },
    { id: 364, kind: 'flower_cluster', x: 31.5, z: -33.0, rotY: 0.40, scale: 1.35 },
    { id: 365, kind: 'flower_cluster', x: 50.0, z: -30.0, rotY: -0.55, scale: 1.34 },
    { id: 366, kind: 'flower_cluster', x: 35.0, z: 35.0, rotY: 0.70, scale: 1.35 },

    { id: 330, kind: 'tree_gold', x: -42.5, z: -7.8, rotY: 0.3, scale: 1.12 },
    { id: 331, kind: 'tree_gold', x: -42.5, z: 7.8, rotY: -0.3, scale: 1.12 },
    { id: 332, kind: 'tree_purple', x: -28.5, z: -15.2, rotY: -0.5, scale: 1.1 },
    { id: 333, kind: 'tree_purple', x: -28.5, z: 15.2, rotY: 0.5, scale: 1.1 },
    { id: 334, kind: 'tree_gold', x: -48.5, z: -36.5, rotY: 0.6, scale: 1.1 },
    { id: 335, kind: 'tree_gold', x: -48.5, z: 36.5, rotY: -0.6, scale: 1.1 },
    { id: 336, kind: 'tree_purple', x: -86.0, z: 82.0, rotY: -0.3, scale: 1.12 },
    { id: 337, kind: 'tree_purple', x: -74.0, z: 82.0, rotY: 0.3, scale: 1.12 },

    { id: 520, kind: 'bench', x: 2.0, z: -34.5, rotY: 0.0, scale: 1.35 },
    { id: 521, kind: 'bench', x: 2.0, z: -29.5, rotY: Math.PI, scale: 1.35 },
    { id: 580, kind: 'recycle_bin', x: 4.3, z: -34.5, rotY: -Math.PI / 2, scale: 1.08 },
    { id: 522, kind: 'bench', x: -1.0, z: 29.8, rotY: -Math.PI / 2, scale: 1.35 },
    { id: 523, kind: 'bench', x: -1.0, z: 34.2, rotY: -Math.PI / 2, scale: 1.35 },
    { id: 581, kind: 'recycle_bin', x: -1.0, z: 36.6, rotY: -Math.PI / 2, scale: 1.08 },
    { id: 524, kind: 'bench', x: -47.5, z: -10.2, rotY: -Math.PI / 2, scale: 1.35 },
    { id: 525, kind: 'bench', x: -47.5, z: 10.2, rotY: -Math.PI / 2, scale: 1.35 },
    { id: 582, kind: 'recycle_bin', x: -47.5, z: -7.8, rotY: -Math.PI / 2, scale: 1.08 },
    { id: 583, kind: 'recycle_bin', x: -47.5, z: 7.8, rotY: -Math.PI / 2, scale: 1.08 },
    { id: 526, kind: 'bench', x: -44.2, z: -2.0, rotY: -Math.PI / 2, scale: 1.35 },
    { id: 527, kind: 'bench', x: -44.2, z: 2.0, rotY: -Math.PI / 2, scale: 1.35 },
    { id: 584, kind: 'recycle_bin', x: -44.2, z: -4.2, rotY: -Math.PI / 2, scale: 1.08 },
    { id: 585, kind: 'recycle_bin', x: -44.2, z: 4.2, rotY: -Math.PI / 2, scale: 1.08 },
    { id: 528, kind: 'bench', x: -9.5, z: -41.8, rotY: 0.0, scale: 1.35 },
    { id: 529, kind: 'bench', x: -9.5, z: 41.8, rotY: Math.PI, scale: 1.35 },
    { id: 586, kind: 'recycle_bin', x: -12.0, z: -41.8, rotY: 0.0, scale: 1.08 },
    { id: 587, kind: 'recycle_bin', x: -12.0, z: 41.8, rotY: Math.PI, scale: 1.08 },
  ],
};

export function cloneDefaultLayout(): ArenaMapLayout {
  return JSON.parse(JSON.stringify(DEFAULT_ARENA_MAP_LAYOUT));
}

/**
 * Returns true if world (x, z) falls inside the South Plaza L-Shaped Glasshouse Cafe footprint
 * (Main Hall: x in [-105.85, -79.65], z in [22.9, 37.1]; West L-Wing: x in [-105.85, -94.85], z in [13.7, 23.2]).
 */
export function isInsideSouthPlazaGlasshouseFootprint(x: number, z: number): boolean {
  const inMainHall = x >= -105.85 && x <= -79.65 && z >= 22.9 && z <= 37.1;
  const inWestWing = x >= -105.85 && x <= -94.85 && z >= 13.7 && z <= 23.2;
  return inMainHall || inWestWing;
}

export function isInsideEastCoastalBeachClubFootprint(x: number, z: number): boolean {
  return x >= 78.0 && x <= 134.5 && z >= -99.0 && z <= 46.2;
}

export function loadSavedArenaLayout(): ArenaMapLayout {
  try {
    const raw = localStorage.getItem(MAP_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ArenaMapLayout;
      if (parsed && Array.isArray(parsed.props) && parsed.blueHq && parsed.redHq) {
        parsed.props = parsed.props.filter(
          (p) =>
            p.id !== 491 &&
            p.id !== 530 &&
            p.id !== 531 &&
            !isInsideSouthPlazaGlasshouseFootprint(p.x, p.z) &&
            !isInsideEastCoastalBeachClubFootprint(p.x, p.z) &&
            !isInsideNorthGrandCasinoFootprint(p.x, p.z) &&
            !isPointInsideCentralIslandEnvelope(p.x, p.z),
        );
        if (Array.isArray(parsed.sculptData) && parsed.sculptData.length > 0) {
          restoreTerrainSculptGrid(parsed.sculptData);
        }
        return parsed;
      }
    }
  } catch {
    // Ignore storage errors
  }
  resetTerrainSculptGrid();
  return cloneDefaultLayout();
}

/**
 * Golden Scale Calibration Benchmark anchored to the East Halte Trem (`ModernUrbanTramStopShelter3D`)
 * relative to the 3.85m Buddy character (`3.45x` Mixamo rig).
 * Shared between 3D procedural builders and `buildStaticWorldStructuresList` so 3D meshes and
 * OBB colliders remain 100% synchronized.
 */
export const HALTE_GOLDEN_SCALE_CONFIG = {
  characterHeightM: 3.85,
  halteCanopyClearanceM: 5.05,
  kioskScaleS: 1.70, // scaled ~1.21x from 1.40 -> ~3.08m height, proportional to outdoor avatar
  kioskColliderHeightY: 3.10,
  lobbyParasolScale: 1.62, // raised from 1.38 so umbrella canopy clears 3.85m character head (~3.95m)
  lobbyLampPoleScale: 1.06, // sleek ~4.81m promenade lamp pole matching the 5.05m Halte canopy
  streetLamppostBaseHeightM: 5.92, // at 1.15x layout scale -> 6.81m streetlamp height
  beachShowerScale: 1.72, // raised from 1.55 so rain showerhead sits at ~4.44m (above 3.85m character head)
  beachSurfRackScale: 1.18, // calibrated from 1.48 so surfboards stand ~3.71m instead of 4.66m
} as const;

export function getPropBaseHeight(kind: PlacedMapProp['kind']): number {
  switch (kind) {
    case 'turbine':
      return 17.5;
    case 'chimney':
      return 15.6;
    case 'crane':
      return 18.5;
    case 'giant_tank':
      return 9.2;
    case 'lamppost_1a':
    case 'lamppost_1b':
      return HALTE_GOLDEN_SCALE_CONFIG.streetLamppostBaseHeightM;
    case 'dump_truck':
      return 3.8;
    case 'forklift':
      return 3.15;
    case 'power_core':
      return 7.8;
    case 'pipe_cluster':
    case 'pipe_cluster_1b':
      return 3.4;
    case 'giant_pipe':
      return 3.3;
    case 'giant_pipe_1b':
      return 3.85;
    case 'tank_1a':
    case 'tank_1b':
      return 3.4;
    case 'concrete_fence':
      return 2.85;
    case 'concrete_fence_1b':
      return 2.05;
    case 'concrete_pipe':
      return 2.35;
    case 'h_beam':
      return 2.45;
    case 'barricade':
      return 1.68;
    case 'explosive_barrel':
    case 'barrel_1c':
      return 1.38;
    case 'hydrant':
      return 1.39;
    case 'recycle_bin':
      return 1.44;
    case 'bench':
      // Calibrated so at 1.35x layout scale benches stand ~1.48m tall (~0.45 * 3.30m avatar).
      return 1.096;
    case 'wheelbarrow':
      return 1.14;
    case 'pallet_1a':
      return 1.35;
    case 'fuel_cell':
      return 1.25;
    case 'circuit_module':
      return 1.15;
    case 'traffic_cone':
      return 0.86;
    default:
      return 2.2;
  }
}

const SHARED_BILLBOARD_QUAD_GEO = new THREE.PlaneGeometry(1, 1);

export function createBillboardSign(widthWorld: number, heightWorld: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false,
  });
  const sprite = new THREE.Mesh(SHARED_BILLBOARD_QUAD_GEO, mat);
  sprite.scale.set(widthWorld, heightWorld, 1);
  sprite.renderOrder = 10;
  sprite.castShadow = false;
  sprite.receiveShadow = false;
  sprite.raycast = () => {};

  const updateText = (title: string, subtitle: string, accentHex: string, ratio = 1) => {
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = '#11121a';
    ctx.beginPath();
    ctx.roundRect(8, 8, 496, 112, 22);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = accentHex;
    ctx.stroke();

    if (ratio >= 0) {
      ctx.fillStyle = '#272935';
      ctx.fillRect(24, 82, 464, 22);
      ctx.fillStyle = accentHex;
      ctx.fillRect(24, 82, Math.max(0, Math.min(1, ratio)) * 464, 22);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 30px "Barlow", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 256, 44);

    ctx.fillStyle = accentHex;
    ctx.font = '800 22px "JetBrains Mono", monospace';
    ctx.fillText(subtitle, 256, 72);
    tex.needsUpdate = true;
  };

  return { sprite, updateText };
}

/**
 * Creates an MMORPG Glassmorphism Nameplate Quad Billboard with Custom Emblem (Crown / Shield)
 * Sized in constant screen-space pixels each frame so it stays crisp and proportional like UI prompts.
 */
export function createGlassmorphicNameplate(
  widthWorld = 2.8,
  heightWorld = 0.72,
  defaultName = 'CITIZEN',
  _defaultSub = '',
  isNpc = false,
  defaultRoleBadge?: AnyRoleBadgeId,
) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 116;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false,
  });
  const sprite = new THREE.Mesh(SHARED_BILLBOARD_QUAD_GEO, mat);
  sprite.scale.set(widthWorld, heightWorld, 1);
  sprite.renderOrder = 11;
  sprite.castShadow = false;
  sprite.receiveShadow = false;
  sprite.raycast = () => {};

  const drawWhiteRoleIcon = (
    icon: 'gear' | 'crown' | 'paintbrush' | 'smiley' | 'shield' | 'merchant',
    cx: number,
    cy: number,
    badgeColor: string,
  ) => {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (icon === 'gear') {
      const teeth = 8;
      const outerR = 16;
      const innerR = 11.5;
      ctx.beginPath();
      for (let i = 0; i < teeth * 2; i++) {
        const angle = (i * Math.PI) / teeth;
        const r = i % 2 === 0 ? outerR : innerR;
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = badgeColor;
      ctx.beginPath();
      ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (icon === 'crown') {
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy + 10);
      ctx.lineTo(cx - 15, cy - 6);
      ctx.lineTo(cx - 6, cy + 1);
      ctx.lineTo(cx, cy - 12);
      ctx.lineTo(cx + 6, cy + 1);
      ctx.lineTo(cx + 15, cy - 6);
      ctx.lineTo(cx + 14, cy + 10);
      ctx.closePath();
      ctx.fill();
    } else if (icon === 'paintbrush') {
      ctx.translate(cx, cy);
      ctx.rotate(-Math.PI / 4);
      // Brush handle
      ctx.beginPath();
      ctx.roundRect(-14, -3, 18, 6, 3);
      ctx.fill();
      // Bristle tip
      ctx.beginPath();
      ctx.moveTo(5, -5);
      ctx.quadraticCurveTo(15, -5, 16, 0);
      ctx.quadraticCurveTo(15, 5, 5, 5);
      ctx.closePath();
      ctx.fill();
    } else if (icon === 'smiley') {
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(cx, cy, 13.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - 4.8, cy - 3, 2.1, 0, Math.PI * 2);
      ctx.arc(cx + 4.8, cy - 3, 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(cx, cy + 1.5, 6.2, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    } else if (icon === 'shield') {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 14);
      ctx.lineTo(cx + 13, cy - 8);
      ctx.lineTo(cx + 12, cy + 2);
      ctx.quadraticCurveTo(cx + 10, cy + 11, cx, cy + 16);
      ctx.quadraticCurveTo(cx - 10, cy + 11, cx - 12, cy + 2);
      ctx.lineTo(cx - 13, cy - 8);
      ctx.closePath();
      ctx.fill();
    } else {
      // NPC Merchant storefront icon
      ctx.beginPath();
      ctx.roundRect(cx - 12, cy - 2, 24, 13, 2.5);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy - 2);
      ctx.lineTo(cx - 11, cy - 12);
      ctx.lineTo(cx + 11, cy - 12);
      ctx.lineTo(cx + 15, cy - 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = badgeColor;
      ctx.fillRect(cx - 3.5, cy + 3, 7, 8);
    }

    ctx.restore();
  };

  const updatePlate = (
    name: string,
    _sub = '',
    emblemType: 'npc' | 'player_rookie' | 'player_veteran' = isNpc ? 'npc' : 'player_rookie',
    roleBadge?: AnyRoleBadgeId,
  ) => {
    ctx.clearRect(0, 0, 512, 116);

    const badgeSpec = getAnyRoleBadgeSpec(
      roleBadge ?? defaultRoleBadge,
      emblemType === 'npc',
    );

    // 1. Crisp High-Contrast Frosted Dark Slate Backing matching UI Prompts
    const bgGrad = ctx.createLinearGradient(0, 8, 0, 108);
    bgGrad.addColorStop(0, 'rgba(20, 27, 45, 0.88)');
    bgGrad.addColorStop(0.45, 'rgba(15, 23, 42, 0.90)');
    bgGrad.addColorStop(1, 'rgba(8, 12, 24, 0.94)');

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(10, 10, 492, 96, 20);
    ctx.fill();
    ctx.restore();

    // 2. Subtle Top Specular Sheen
    const glossGrad = ctx.createLinearGradient(0, 10, 0, 48);
    glossGrad.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
    glossGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = glossGrad;
    ctx.beginPath();
    ctx.roundRect(12, 12, 488, 36, [18, 18, 0, 0]);
    ctx.fill();

    // 3. Crisp Accent Border matching UI Prompt stroke weight
    ctx.lineWidth = 4.0;
    ctx.strokeStyle = emblemType === 'npc' ? '#facc15' : '#38bdf8';
    ctx.beginPath();
    ctx.roundRect(10, 10, 492, 96, 20);
    ctx.stroke();

    // 4. Render Role Badge Circle (filled circle, white icon, thin dark ring)
    ctx.save();
    const cx = 60;
    const cy = 58;
    ctx.fillStyle = badgeSpec.color;
    ctx.beginPath();
    ctx.arc(cx, cy, 29, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4.0;
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();
    drawWhiteRoleIcon(badgeSpec.icon, cx, cy, badgeSpec.color);
    ctx.restore();

    // 5. Player / NPC Name Text (Bold, legible at compact 146x33px constant screen size)
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1.5;
    ctx.shadowOffsetY = 1.5;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 36px "Barlow", sans-serif';
    ctx.fillText(name.toUpperCase(), 292, 58, 372);
    ctx.restore();

    tex.needsUpdate = true;
  };

  updatePlate(defaultName, '', isNpc ? 'npc' : 'player_rookie', defaultRoleBadge);

  return { sprite, updatePlate };
}

/**
 * Builds the list of static 3D OBB world structures (Retaining Walls, Base Plot Buildings & Fences,
 * Bastions, Container Stacks, Excavators, Kiosks, Planters, and Parking Pillars).
 */
export function buildStaticWorldStructuresList(params: {
  blueBase: { baseGroup: THREE.Group; hqX: number; hqZ: number };
  redBase?: { baseGroup: THREE.Group; hqX: number; hqZ: number };
  blueCommanderBases: ReadonlyArray<IndividualCommanderBaseState>;
  redCommanderBases?: ReadonlyArray<IndividualCommanderBaseState>;
  isSafezoneMode?: boolean;
}): StaticWorldStructureObb[] {
  const { blueBase, redBase, blueCommanderBases, redCommanderBases = [], isSafezoneMode = false } = params;
  const blueSkyshields = getBaseSkyshieldTurrets(blueBase.baseGroup);
  const redSkyshields = redBase ? getBaseSkyshieldTurrets(redBase.baseGroup) : [];

  const plotOffsetsX = [-45.0, -15.0, 15.0, 45.0] as const;
  const bastionLocalZ = [-51.4, -21.4, 8.6, 38.6] as const;
  const parasolRatio = HALTE_GOLDEN_SCALE_CONFIG.lobbyParasolScale / 1.38;
  const showerRatio = HALTE_GOLDEN_SCALE_CONFIG.beachShowerScale / 1.55;
  const surfRackRatio = HALTE_GOLDEN_SCALE_CONFIG.beachSurfRackScale / 1.48;
  const structures: StaticWorldStructureObb[] = [
    // Open Central Plaza Perimeter Colliders (+2.50m Plaza Level: North, South, West parapets + East outer wing parapets flush with Tennis Court Fence -78.82)
    { id: 'west_wall_north', x: -94.75, z: -38.05, halfX: 16.05, halfZ: 0.28, rotY: 0, heightY: 3.5, mat: 'concrete', isRetainingWall: true },
    { id: 'west_wall_south', x: -94.75, z: 38.05, halfX: 16.05, halfZ: 0.28, rotY: 0, heightY: 3.5, mat: 'concrete', isRetainingWall: true },
    { id: 'west_wall_west', x: -110.75, z: 0.0, halfX: 0.35, halfZ: 38.2, rotY: 0, heightY: 3.5, mat: 'concrete', isRetainingWall: true },
    { id: 'west_wall_east_n', x: -78.70, z: -24.0, halfX: 0.28, halfZ: 14.0, rotY: 0, heightY: 3.5, mat: 'concrete', isRetainingWall: true },
    { id: 'west_wall_east_s', x: -78.70, z: 24.0, halfX: 0.28, halfZ: 14.0, rotY: 0, heightY: 3.5, mat: 'concrete', isRetainingWall: true },

    // South Plaza Grand L-Shaped Botanical Glasshouse Cafe (+2.50m Plaza Level, spanning West-to-East fence & West wing, clear of East Parasol Cafe Tables), Modern Coffee & Gelato Kiosks
    { id: 'lobby_glasshouse_l_main', x: -92.75, z: 30.00, halfX: 12.85, halfZ: 6.85, rotY: 0, heightY: 9.6, mat: 'metal' },
    { id: 'lobby_glasshouse_l_wing', x: -100.35, z: 18.60, halfX: 5.25, halfZ: 4.65, rotY: 0, heightY: 9.6, mat: 'metal' },
    ...computeRealEstateKioskWorldColliders(),
    ...computeScooterShopWorldColliders(),
    ...computeFashionKioskWorldColliders(),
    {
      id: 'npc_merchant_hana',
      x: REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.hanaMerchantWorld.x,
      z: REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.hanaMerchantWorld.z,
      halfX: 0.52,
      halfZ: 0.52,
      rotY: REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.hanaMerchantWorld.rotY,
      heightY: 3.85,
      mat: 'wood',
    },
    { id: 'npc_merchant_kai', x: 85.8, z: 60.0, halfX: 0.52, halfZ: 0.52, rotY: 0, heightY: 3.85, mat: 'wood' },
    { id: 'lobby_parasol_table_n', x: -83.95, z: 13.31, halfX: +(1.62 * parasolRatio).toFixed(2), halfZ: +(1.62 * parasolRatio).toFixed(2), rotY: 0, heightY: +(6.2 * parasolRatio).toFixed(2), mat: 'wood' },
    { id: 'lobby_parasol_table_s', x: -83.95, z: 19.09, halfX: +(1.62 * parasolRatio).toFixed(2), halfZ: +(1.62 * parasolRatio).toFixed(2), rotY: 0, heightY: +(6.2 * parasolRatio).toFixed(2), mat: 'wood' },
    // Grand Neoclassical Municipal Hall & Clock Tower on North Central Plaza (world center x = -93.55, z = -29.2, scale = 1.42)
    { id: 'lobby_civic_hall_main_body', x: -93.55, z: -29.98, halfX: 6.45, halfZ: 3.90, rotY: 0, heightY: 14.5, mat: 'concrete' },
    { id: 'lobby_civic_hall_balustrade_w', x: -99.15, z: -24.73, halfX: 2.85, halfZ: 1.15, rotY: 0, heightY: 4.5, mat: 'concrete' },
    { id: 'lobby_civic_hall_balustrade_e', x: -87.95, z: -24.73, halfX: 2.85, halfZ: 1.15, rotY: 0, heightY: 4.5, mat: 'concrete' },
    { id: 'lobby_civic_hall_kiosk_w', x: -100.86, z: -27.99, halfX: 0.55, halfZ: 0.85, rotY: 0, heightY: 5.8, mat: 'wood' },
    { id: 'lobby_civic_hall_kiosk_e', x: -86.24, z: -28.42, halfX: 0.55, halfZ: 0.85, rotY: 0, heightY: 5.8, mat: 'wood' },
    // 5 Vintage Park Lampposts + w3/e2/e3 replaced by Tier 4 Chandelier Lamps (+2.50m Plaza Level)
    { id: 'lobby_vintage_lamppost_w1', x: -108.95, z: -28.5, halfX: 0.28, halfZ: 0.28, rotY: 0, heightY: 6.8, mat: 'metal' },
    { id: 'lobby_vintage_lamppost_w2', x: -109.15, z: -19.2, halfX: 0.28, halfZ: 0.28, rotY: 0, heightY: 6.8, mat: 'metal' },
    { id: 'lobby_vintage_lamppost_w3', x: -95.55, z: 11.6, halfX: 0.45, halfZ: 0.45, rotY: 0, heightY: 9.9, mat: 'metal' },
    { id: 'lobby_vintage_lamppost_w4', x: -109.15, z: 11.6, halfX: 0.28, halfZ: 0.28, rotY: 0, heightY: 6.8, mat: 'metal' },
    { id: 'lobby_vintage_lamppost_e1', x: -80.55, z: -28.5, halfX: 0.28, halfZ: 0.28, rotY: 0, heightY: 6.8, mat: 'metal' },
    { id: 'lobby_vintage_lamppost_e4', x: -80.35, z: 21.6, halfX: 0.28, halfZ: 0.28, rotY: 0, heightY: 6.8, mat: 'metal' },
    // 2 Aligned Vintage Park Benches & Planter Boxes along East-North Plaza Promenade
    { id: 'lobby_vintage_bench_planter_en', x: -80.85, z: -16.40, halfX: 0.92, halfZ: 2.15, rotY: 0, heightY: 4.5, mat: 'wood' },
    { id: 'lobby_vintage_bench_planter_en_2', x: -80.85, z: -23.60, halfX: 0.92, halfZ: 2.15, rotY: 0, heightY: 4.5, mat: 'wood' },
    // Urban Plaza to Street Staircase — North & South 4-Tier Stepped Side Concrete Planters, Glass-Steel Balustrades & Twin Central Handrail Divider
    { id: 'lobby_stair_planter_n', x: -83.35, z: -9.20, halfX: 4.25, halfZ: 0.84, rotY: 0, heightY: 3.5, mat: 'concrete' },
    { id: 'lobby_stair_planter_s', x: -83.35, z: 9.20, halfX: 4.25, halfZ: 0.84, rotY: 0, heightY: 3.5, mat: 'concrete' },
    { id: 'lobby_stair_center_handrail', x: -83.33, z: 0.0, halfX: 4.36, halfZ: 0.22, rotY: 0, heightY: 3.5, mat: 'metal' },
    // Standalone Scenic Clay Tennis Court Colliders (Attached flush to Central Plaza South Wall at z = +38.43, with Courtside Benches, Net, Umpire Chair & 4-Sided Fencing)
    { id: 'tennis_porch_bench_l', x: -92.32, z: 39.58, halfX: 1.22, halfZ: 0.48, rotY: 0, heightY: 1.50, mat: 'wood' },
    { id: 'tennis_porch_bench_r', x: -85.30, z: 39.58, halfX: 1.22, halfZ: 0.48, rotY: 0, heightY: 1.50, mat: 'wood' },
    { id: 'tennis_court_net', x: -88.81, z: 50.58, halfX: 6.95, halfZ: 0.26, rotY: 0, heightY: 1.65, mat: 'metal' },
    { id: 'tennis_umpire_chair', x: -95.90, z: 50.58, halfX: 0.72, halfZ: 0.72, rotY: 0, heightY: 3.00, mat: 'wood' },
    { id: 'tennis_fence_north', x: -88.81, z: 38.43, halfX: 9.99, halfZ: 0.28, rotY: 0, heightY: 4.00, mat: 'metal' },
    { id: 'tennis_fence_west', x: -98.80, z: 50.58, halfX: 0.28, halfZ: 12.15, rotY: 0, heightY: 4.00, mat: 'metal' },
    { id: 'tennis_fence_east_n', x: -78.82, z: 43.42, halfX: 0.28, halfZ: 5.00, rotY: 0, heightY: 4.00, mat: 'metal' },
    { id: 'tennis_fence_east_s', x: -78.82, z: 57.74, halfX: 0.28, halfZ: 5.00, rotY: 0, heightY: 4.00, mat: 'metal' },
    { id: 'tennis_fence_south_w', x: -94.88, z: 62.73, halfX: 3.92, halfZ: 0.28, rotY: 0, heightY: 4.00, mat: 'metal' },
    { id: 'tennis_fence_south_e', x: -82.74, z: 62.73, halfX: 3.92, halfZ: 0.28, rotY: 0, heightY: 4.00, mat: 'metal' },
    // Central Plaza Halte Trem Shelter Colliders (Windbreak Wall, Black Transit Kiosk, Ticket Machine & Slatted Passenger Bench, shifted +4.6m South)
    { id: 'lobby_tram_shelter_windbreak', x: -56.83, z: 4.6, halfX: 0.28, halfZ: 6.8, rotY: 0, heightY: HALTE_GOLDEN_SCALE_CONFIG.halteCanopyClearanceM, mat: 'concrete' },
    { id: 'halte_teleport_kiosk', x: -59.18, z: 4.6, halfX: 0.42, halfZ: 0.62, rotY: 0, heightY: HALTE_GOLDEN_SCALE_CONFIG.kioskColliderHeightY, mat: 'metal' },
    {
      id: 'central_plaza_info_transit_kiosk',
      x: CENTRAL_PLAZA_INFO_CENTER_KIOSK_SPEC.kioskX,
      z: CENTRAL_PLAZA_INFO_CENTER_KIOSK_SPEC.kioskZ,
      halfX: 0.42,
      halfZ: 0.48,
      rotY: 0,
      heightY: 4.65,
      mat: 'metal',
    },
    { id: 'halte_ticket_machine', x: -57.19, z: -0.55, halfX: 0.42, halfZ: 0.62, rotY: 0, heightY: 2.30, mat: 'metal' },
    { id: 'halte_passenger_bench', x: -57.55, z: 2.00, halfX: 0.42, halfZ: 2.30, rotY: 0, heightY: 1.82, mat: 'wood' },
    // North Residence & South Residence Rail Halte Colliders + Standalone Black Transit Kiosks at Beachfront Harbor & NW Fishing Lake
    { id: 'north_residence_shelter_windbreak', x: 3.5, z: -38.8, halfX: 6.8, halfZ: 0.28, rotY: 0, heightY: HALTE_GOLDEN_SCALE_CONFIG.halteCanopyClearanceM, mat: 'concrete' },
    { id: 'north_residence_transit_kiosk', x: 3.5, z: -41.15, halfX: 0.42, halfZ: 0.62, rotY: 0, heightY: HALTE_GOLDEN_SCALE_CONFIG.kioskColliderHeightY, mat: 'metal' },
    { id: 'north_residence_passenger_bench', x: 6.1, z: -39.52, halfX: 2.30, halfZ: 0.42, rotY: 0, heightY: 1.82, mat: 'wood' },
    { id: 'south_residence_shelter_windbreak', x: -36.5, z: 38.8, halfX: 6.8, halfZ: 0.28, rotY: 0, heightY: HALTE_GOLDEN_SCALE_CONFIG.halteCanopyClearanceM, mat: 'concrete' },
    { id: 'south_residence_transit_kiosk', x: -36.5, z: 41.15, halfX: 0.42, halfZ: 0.62, rotY: 0, heightY: HALTE_GOLDEN_SCALE_CONFIG.kioskColliderHeightY, mat: 'metal' },
    { id: 'beachfront_harbor_shelter_windbreak', x: 56.83, z: 28.6, halfX: 0.28, halfZ: 6.8, rotY: 0, heightY: HALTE_GOLDEN_SCALE_CONFIG.halteCanopyClearanceM, mat: 'concrete' },
    { id: 'beachfront_harbor_transit_kiosk', x: 59.18, z: 28.6, halfX: 0.42, halfZ: 0.62, rotY: 0, heightY: HALTE_GOLDEN_SCALE_CONFIG.kioskColliderHeightY, mat: 'metal' },
    { id: 'beachfront_kai_transit_kiosk', x: 84.85, z: 65.65, halfX: 0.42, halfZ: 0.62, rotY: 0, heightY: HALTE_GOLDEN_SCALE_CONFIG.kioskColliderHeightY, mat: 'metal' },
    { id: 'beachfront_harbor_passenger_bench', x: 57.55, z: 31.2, halfX: 0.42, halfZ: 2.30, rotY: 0, heightY: 1.82, mat: 'wood' },
    { id: 'nw_fishing_lake_transit_kiosk', x: -44.5, z: -6.5, halfX: 0.42, halfZ: 0.62, rotY: 0, heightY: HALTE_GOLDEN_SCALE_CONFIG.kioskColliderHeightY, mat: 'metal' },
    {
      id: 'central_park_transit_kiosk',
      x: CENTRAL_PARK_TRANSIT_KIOSK_SPEC.kioskX,
      z: CENTRAL_PARK_TRANSIT_KIOSK_SPEC.kioskZ,
      halfX: 0.42,
      halfZ: 0.62,
      rotY: CENTRAL_PARK_TRANSIT_KIOSK_SPEC.kioskRotY,
      heightY: HALTE_GOLDEN_SCALE_CONFIG.kioskColliderHeightY,
      mat: 'metal',
    },
    // Blueprint Curved-Cantilever Traffic Signal Concrete Pedestals (Plaza West & East Harbor Crosswalks)
    ...CITY_TRAFFIC_SIGNAL_POLE_SPECS.map((pole) => ({
      id: `traffic_signal_${pole.id}`,
      x: pole.x,
      z: pole.z,
      halfX: 0.24,
      halfZ: 0.24,
      rotY: 0,
      heightY: pole.boomHeightY,
      mat: 'metal' as const,
    })),

    // South-East Coastal Beachfront & Park Structures (Pergola Pavilion, Tables, Pots, Planters, Shower Station, Juice Kiosk, Surfboard Rack, Lifeguard Watchtower, Loungers, Chairs, Palms & Railings)
    { id: 'beach_planter_w1', x: 78.55, z: 51.0, halfX: 0.52, halfZ: 3.78, rotY: 0, heightY: 2.2, mat: 'concrete' },
    { id: 'beach_planter_w2', x: 78.55, z: 66.2, halfX: 0.52, halfZ: 3.28, rotY: 0, heightY: 2.2, mat: 'concrete' },
    { id: 'beach_planter_w3', x: 78.55, z: 80.5, halfX: 0.52, halfZ: 3.28, rotY: 0, heightY: 2.2, mat: 'concrete' },
    { id: 'beach_planter_w4', x: 78.55, z: 96.0, halfX: 0.52, halfZ: 3.28, rotY: 0, heightY: 2.2, mat: 'concrete' },
    { id: 'beach_lamp_1', x: 75.85, z: 49.5, halfX: 0.24, halfZ: 0.24, rotY: 0, heightY: 5.05, mat: 'metal' },
    { id: 'beach_lamp_2', x: 75.85, z: 63.0, halfX: 0.24, halfZ: 0.24, rotY: 0, heightY: 5.05, mat: 'metal' },
    { id: 'beach_lamp_3', x: 75.85, z: 76.5, halfX: 0.24, halfZ: 0.24, rotY: 0, heightY: 5.05, mat: 'metal' },
    { id: 'beach_lamp_4', x: 75.85, z: 91.5, halfX: 0.24, halfZ: 0.24, rotY: 0, heightY: 5.05, mat: 'metal' },

    // Pergola Pavilion: Rear Trellis & 3 Rear Columns, 3 Front Columns, Lounger Bench, 2 Café Table+Chair Sets & 5 Ceramic Flower Pots
    { id: 'beach_pergola_pavilion', x: 80.22, z: 88.5, halfX: 0.44, halfZ: 7.25, rotY: 0, heightY: 5.8, mat: 'wood' },
    { id: 'beach_pergola_col_fs', x: 88.18, z: 95.46, halfX: 0.38, halfZ: 0.38, rotY: 0, heightY: 5.8, mat: 'wood' },
    { id: 'beach_pergola_col_fc', x: 88.18, z: 88.50, halfX: 0.38, halfZ: 0.38, rotY: 0, heightY: 5.8, mat: 'wood' },
    { id: 'beach_pergola_col_fn', x: 88.18, z: 81.54, halfX: 0.38, halfZ: 0.38, rotY: 0, heightY: 5.8, mat: 'wood' },
    { id: 'beach_pergola_bench', x: 83.92, z: 93.61, halfX: 2.58, halfZ: 0.88, rotY: 0, heightY: 2.0, mat: 'wood' },
    { id: 'beach_pergola_table_s', x: 84.48, z: 89.64, halfX: 1.92, halfZ: 1.92, rotY: 0, heightY: 2.2, mat: 'wood' },
    { id: 'beach_pergola_table_n', x: 84.48, z: 84.81, halfX: 1.92, halfZ: 1.92, rotY: 0, heightY: 2.2, mat: 'wood' },
    { id: 'beach_pergola_pot_1', x: 87.47, z: 94.61, halfX: 0.56, halfZ: 0.56, rotY: 0, heightY: 2.2, mat: 'concrete' },
    { id: 'beach_pergola_pot_2', x: 87.47, z: 83.10, halfX: 0.56, halfZ: 0.56, rotY: 0, heightY: 2.2, mat: 'concrete' },
    { id: 'beach_pergola_pot_3', x: 86.19, z: 82.25, halfX: 0.56, halfZ: 0.56, rotY: 0, heightY: 2.2, mat: 'concrete' },
    { id: 'beach_pergola_pot_4', x: 81.08, z: 94.61, halfX: 0.56, halfZ: 0.56, rotY: 0, heightY: 2.2, mat: 'concrete' },
    { id: 'beach_pergola_pot_5', x: 81.08, z: 82.39, halfX: 0.56, halfZ: 0.56, rotY: 0, heightY: 2.2, mat: 'concrete' },

    // Shower Station Pillars & 2 Flanking Ceramic Flower Pots
    { id: 'beach_shower_station', x: 83.02, z: 72.8, halfX: +(0.48 * showerRatio).toFixed(2), halfZ: +(1.68 * showerRatio).toFixed(2), rotY: 0, heightY: +(5.5 * showerRatio).toFixed(2), mat: 'wood' },
    { id: 'beach_shower_pot_s', x: +(83.6 - 0.25 * HALTE_GOLDEN_SCALE_CONFIG.beachShowerScale).toFixed(2), z: +(72.8 + 1.98 * HALTE_GOLDEN_SCALE_CONFIG.beachShowerScale).toFixed(2), halfX: +(0.56 * showerRatio).toFixed(2), halfZ: +(0.56 * showerRatio).toFixed(2), rotY: 0, heightY: 2.2, mat: 'concrete' },
    { id: 'beach_shower_pot_n', x: +(83.6 - 0.25 * HALTE_GOLDEN_SCALE_CONFIG.beachShowerScale).toFixed(2), z: +(72.8 - 1.98 * HALTE_GOLDEN_SCALE_CONFIG.beachShowerScale).toFixed(2), halfX: +(0.56 * showerRatio).toFixed(2), halfZ: +(0.56 * showerRatio).toFixed(2), rotY: 0, heightY: 2.2, mat: 'concrete' },

    // Beachside Juice & Coconut Kiosk, Bar Stools, Overflowing Coconut Crates & Corner Ceramic Pots
    { id: 'beach_juice_kiosk', x: 82.22, z: 60.0, halfX: 3.05, halfZ: 4.05, rotY: 0, heightY: 6.2, mat: 'wood' },
    { id: 'beach_kiosk_stools', x: 85.68, z: 62.05, halfX: 0.55, halfZ: 1.25, rotY: 0, heightY: 2.2, mat: 'wood' },
    { id: 'beach_kiosk_crates', x: 84.80, z: 56.30, halfX: 1.35, halfZ: 1.45, rotY: 0, heightY: 2.4, mat: 'wood' },
    { id: 'beach_kiosk_pot_f', x: 85.59, z: 63.92, halfX: 0.56, halfZ: 0.56, rotY: 0, heightY: 2.2, mat: 'concrete' },
    { id: 'beach_kiosk_pot_r', x: 79.84, z: 63.92, halfX: 0.56, halfZ: 0.56, rotY: 0, heightY: 2.2, mat: 'concrete' },

    // Surfboard Rental Rack & Coastal Lifeguard Watchtower
    { id: 'beach_surfboard_rack', x: 83.8, z: 49.5, halfX: +(1.28 * surfRackRatio).toFixed(2), halfZ: +(3.98 * surfRackRatio).toFixed(2), rotY: -0.18, heightY: +(5.5 * surfRackRatio).toFixed(2), mat: 'wood' },
    { id: 'beach_lifeguard_tower', x: 117.6, z: 67.5, halfX: 3.45, halfZ: 2.35, rotY: 0, heightY: 7.5, mat: 'wood' },

    // Beachfront Stilt Timber Cabin ("Rumah Papan Panggung Tepi Pantai") — Cabin Body + Walkable Veranda Perimeter Railings (West Stair Opening Clear)
    {
      id: 'beach_stilt_cabin_body',
      x: (BEACHFRONT_STILT_CABIN_SPEC.cabinBodyMinX + BEACHFRONT_STILT_CABIN_SPEC.cabinBodyMaxX) * 0.5,
      z: (BEACHFRONT_STILT_CABIN_SPEC.cabinBodyMinZ + BEACHFRONT_STILT_CABIN_SPEC.cabinBodyMaxZ) * 0.5,
      halfX: (BEACHFRONT_STILT_CABIN_SPEC.cabinBodyMaxX - BEACHFRONT_STILT_CABIN_SPEC.cabinBodyMinX) * 0.5 + 0.08,
      halfZ: (BEACHFRONT_STILT_CABIN_SPEC.cabinBodyMaxZ - BEACHFRONT_STILT_CABIN_SPEC.cabinBodyMinZ) * 0.5 + 0.08,
      rotY: 0,
      heightY: 7.4,
      mat: 'wood',
    },
    {
      id: 'beach_stilt_cabin_rail_n',
      x: (BEACHFRONT_STILT_CABIN_SPEC.deckMinX + BEACHFRONT_STILT_CABIN_SPEC.deckMaxX) * 0.5,
      z: BEACHFRONT_STILT_CABIN_SPEC.deckMinZ + 0.12,
      halfX: (BEACHFRONT_STILT_CABIN_SPEC.deckMaxX - BEACHFRONT_STILT_CABIN_SPEC.deckMinX) * 0.5,
      halfZ: 0.16,
      rotY: 0,
      heightY: 2.3,
      mat: 'wood',
    },
    {
      id: 'beach_stilt_cabin_rail_s',
      x: (BEACHFRONT_STILT_CABIN_SPEC.deckMinX + BEACHFRONT_STILT_CABIN_SPEC.deckMaxX) * 0.5,
      z: BEACHFRONT_STILT_CABIN_SPEC.deckMaxZ - 0.12,
      halfX: (BEACHFRONT_STILT_CABIN_SPEC.deckMaxX - BEACHFRONT_STILT_CABIN_SPEC.deckMinX) * 0.5,
      halfZ: 0.16,
      rotY: 0,
      heightY: 2.3,
      mat: 'wood',
    },
    {
      id: 'beach_stilt_cabin_rail_e',
      x: BEACHFRONT_STILT_CABIN_SPEC.deckMaxX - 0.12,
      z: (BEACHFRONT_STILT_CABIN_SPEC.deckMinZ + BEACHFRONT_STILT_CABIN_SPEC.deckMaxZ) * 0.5,
      halfX: 0.16,
      halfZ: (BEACHFRONT_STILT_CABIN_SPEC.deckMaxZ - BEACHFRONT_STILT_CABIN_SPEC.deckMinZ) * 0.5,
      rotY: 0,
      heightY: 2.3,
      mat: 'wood',
    },
    {
      id: 'beach_stilt_cabin_rail_w_n',
      x: BEACHFRONT_STILT_CABIN_SPEC.deckMinX + 0.12,
      z: (BEACHFRONT_STILT_CABIN_SPEC.deckMinZ + BEACHFRONT_STILT_CABIN_SPEC.stairMinZ) * 0.5,
      halfX: 0.16,
      halfZ: (BEACHFRONT_STILT_CABIN_SPEC.stairMinZ - BEACHFRONT_STILT_CABIN_SPEC.deckMinZ) * 0.5,
      rotY: 0,
      heightY: 2.3,
      mat: 'wood',
    },
    {
      id: 'beach_stilt_cabin_rail_w_s',
      x: BEACHFRONT_STILT_CABIN_SPEC.deckMinX + 0.12,
      z: (BEACHFRONT_STILT_CABIN_SPEC.stairMaxZ + BEACHFRONT_STILT_CABIN_SPEC.deckMaxZ) * 0.5,
      halfX: 0.16,
      halfZ: (BEACHFRONT_STILT_CABIN_SPEC.deckMaxZ - BEACHFRONT_STILT_CABIN_SPEC.stairMaxZ) * 0.5,
      rotY: 0,
      heightY: 2.3,
      mat: 'wood',
    },
    {
      id: 'beach_stilt_cabin_stair_rail_n',
      x: (BEACHFRONT_STILT_CABIN_SPEC.stairMinX + BEACHFRONT_STILT_CABIN_SPEC.stairMaxX) * 0.5,
      z: BEACHFRONT_STILT_CABIN_SPEC.stairMinZ - 0.10,
      halfX: (BEACHFRONT_STILT_CABIN_SPEC.stairMaxX - BEACHFRONT_STILT_CABIN_SPEC.stairMinX) * 0.5,
      halfZ: 0.14,
      rotY: 0,
      heightY: 2.0,
      mat: 'wood',
    },
    {
      id: 'beach_stilt_cabin_stair_rail_s',
      x: (BEACHFRONT_STILT_CABIN_SPEC.stairMinX + BEACHFRONT_STILT_CABIN_SPEC.stairMaxX) * 0.5,
      z: BEACHFRONT_STILT_CABIN_SPEC.stairMaxZ + 0.10,
      halfX: (BEACHFRONT_STILT_CABIN_SPEC.stairMaxX - BEACHFRONT_STILT_CABIN_SPEC.stairMinX) * 0.5,
      halfZ: 0.14,
      rotY: 0,
      heightY: 2.0,
      mat: 'wood',
    },

    // Nautical Rope Railings & Staircase Side Handrails
    // (North edge z = 46.3 opens directly onto Beach Club's stair_prom_kai_boardwalk!)
    { id: 'beach_railing_sea_n', x: 91.9, z: 55.5, halfX: 0.28, halfZ: 9.25, rotY: 0, heightY: 2.4, mat: 'wood' },
    { id: 'beach_railing_sea_mid', x: 91.9, z: 85.4, halfX: 0.28, halfZ: 8.65, rotY: 0, heightY: 2.4, mat: 'wood' },
    { id: 'beach_railing_sea_s', x: 91.9, z: 100.7, halfX: 0.28, halfZ: 1.55, rotY: 0, heightY: 2.4, mat: 'wood' },
    { id: 'beach_railing_south', x: 85.2, z: 102.2, halfX: 6.8, halfZ: 0.28, rotY: 0, heightY: 2.4, mat: 'wood' },
    { id: 'beach_stair1_rail_n', x: 94.9, z: 70.3, halfX: 2.7, halfZ: 0.22, rotY: 0, heightY: 2.2, mat: 'wood' },
    { id: 'beach_stair1_rail_s', x: 94.9, z: 76.7, halfX: 2.7, halfZ: 0.22, rotY: 0, heightY: 2.2, mat: 'wood' },
    { id: 'beach_stair2_rail_n', x: 94.9, z: 94.1, halfX: 2.7, halfZ: 0.22, rotY: 0, heightY: 2.2, mat: 'wood' },
    { id: 'beach_stair2_rail_s', x: 94.9, z: 99.1, halfX: 2.7, halfZ: 0.22, rotY: 0, heightY: 2.2, mat: 'wood' },

    // 7 Slatted Timber Sun Loungers & 4 Coastal Adirondack Beach Chairs (+16m seaward on widened sand)
    { id: 'beach_lounger_1', x: 116.2, z: 54.0, halfX: 1.38, halfZ: 0.72, rotY: -0.12, heightY: 1.6, mat: 'wood' },
    { id: 'beach_lounger_2', x: 116.2, z: 57.2, halfX: 1.38, halfZ: 0.72, rotY: -0.08, heightY: 1.6, mat: 'wood' },
    { id: 'beach_lounger_3', x: 116.2, z: 60.4, halfX: 1.38, halfZ: 0.72, rotY: -0.05, heightY: 1.6, mat: 'wood' },
    { id: 'beach_lounger_4', x: 117.0, z: 77.5, halfX: 1.38, halfZ: 0.72, rotY: 0.08, heightY: 1.6, mat: 'wood' },
    { id: 'beach_lounger_5', x: 117.0, z: 80.8, halfX: 1.38, halfZ: 0.72, rotY: 0.12, heightY: 1.6, mat: 'wood' },
    { id: 'beach_lounger_6', x: 116.2, z: 91.5, halfX: 1.38, halfZ: 0.72, rotY: -0.10, heightY: 1.6, mat: 'wood' },
    { id: 'beach_lounger_7', x: 116.2, z: 94.8, halfX: 1.38, halfZ: 0.72, rotY: -0.06, heightY: 1.6, mat: 'wood' },
    { id: 'beach_chair_1', x: 112.2, z: 81.8, halfX: 0.78, halfZ: 0.78, rotY: 0.15, heightY: 1.8, mat: 'wood' },
    { id: 'beach_chair_2', x: 112.2, z: 85.0, halfX: 0.78, halfZ: 0.78, rotY: 0.05, heightY: 1.8, mat: 'wood' },
    { id: 'beach_chair_3', x: 112.2, z: 88.2, halfX: 0.78, halfZ: 0.78, rotY: -0.10, heightY: 1.8, mat: 'wood' },
    { id: 'beach_chair_4', x: 113.5, z: 49.5, halfX: 0.78, halfZ: 0.78, rotY: -0.20, heightY: 1.8, mat: 'wood' },

    // 7 Tropical Coconut Palm Tree Trunks & 8 Coastal Flower Shrubs
    { id: 'beach_palm_1', x: 93.8, z: 48.2, halfX: 0.56, halfZ: 0.56, rotY: 0, heightY: 7.5, mat: 'wood' },
    { id: 'beach_palm_2', x: 96.0, z: 52.0, halfX: 0.52, halfZ: 0.52, rotY: 0, heightY: 7.2, mat: 'wood' },
    { id: 'beach_palm_3', x: 93.6, z: 62.5, halfX: 0.58, halfZ: 0.58, rotY: 0, heightY: 7.8, mat: 'wood' },
    { id: 'beach_palm_4', x: 93.4, z: 78.8, halfX: 0.56, halfZ: 0.56, rotY: 0, heightY: 7.5, mat: 'wood' },
    { id: 'beach_palm_5', x: 93.6, z: 100.5, halfX: 0.56, halfZ: 0.56, rotY: 0, heightY: 7.5, mat: 'wood' },
    { id: 'beach_palm_6', x: 98.5, z: 47.5, halfX: 0.54, halfZ: 0.54, rotY: 0, heightY: 7.2, mat: 'wood' },
    { id: 'beach_palm_7', x: 98.2, z: 101.2, halfX: 0.54, halfZ: 0.54, rotY: 0, heightY: 7.2, mat: 'wood' },
    { id: 'beach_shrub_1', x: 94.4, z: 50.0, halfX: 0.48, halfZ: 0.48, rotY: 0, heightY: 1.5, mat: 'wood' },
    { id: 'beach_shrub_2', x: 94.6, z: 63.8, halfX: 0.48, halfZ: 0.48, rotY: 0, heightY: 1.5, mat: 'wood' },
    { id: 'beach_shrub_3', x: 97.2, z: 70.2, halfX: 0.46, halfZ: 0.46, rotY: 0, heightY: 1.5, mat: 'wood' },
    { id: 'beach_shrub_4', x: 94.2, z: 80.0, halfX: 0.48, halfZ: 0.48, rotY: 0, heightY: 1.5, mat: 'wood' },
    { id: 'beach_shrub_5', x: 97.5, z: 62.5, halfX: 0.48, halfZ: 0.48, rotY: 0, heightY: 1.5, mat: 'wood' },
    { id: 'beach_shrub_6', x: 98.2, z: 74.2, halfX: 0.46, halfZ: 0.46, rotY: 0, heightY: 1.5, mat: 'wood' },
    { id: 'beach_shrub_7', x: 94.8, z: 100.0, halfX: 0.48, halfZ: 0.48, rotY: 0, heightY: 1.5, mat: 'wood' },
    { id: 'beach_shrub_8', x: 98.5, z: 88.5, halfX: 0.48, halfZ: 0.48, rotY: 0, heightY: 1.5, mat: 'wood' },

    ...getBeachClubObstacles(),
    ...getGrandCasinoObstacles(),
    ...getCentralParkObstacles(),
  ];

  const gardenCornersLocal: readonly [number, number][] = [
    [18.4, -7.8],
    [18.4, 7.8],
    [-11.2, -7.8],
    [-11.2, 7.8],
  ];
  const parkingPillarsLocal: readonly [number, number][] = [
    [12.4, -7.2],
    [12.4, -3.2],
    [17.6, -7.2],
    [17.6, -3.2],
  ];

  const emitTeamBasePlotColliders = (
    team: 'blue' | 'red',
    baseHqX: number,
    baseHqZ: number,
    plots: ReadonlyArray<IndividualCommanderBaseState>,
    skyshields: ReturnType<typeof getBaseSkyshieldTurrets>,
  ) => {
    const sign = team === 'blue' ? 1 : -1;
    const teamShort = team === 'blue' ? 'b' : 'r';

    for (let pIdx = 0; pIdx < 4; pIdx++) {
      const plot = plots[pIdx];
      const pwx = baseHqX + sign * plotOffsetsX[pIdx];

      // 1. Standalone Kiosk Machine collider exists in ALL 8 base plots (1 Model Estate + 7 Empty Grass Lots)
      //    at the exact same local offset as the Model Estate Kiosk!
      structures.push({
        id: `${team}_plot_${pIdx}_kiosk`,
        x: pwx + sign * 8.52,
        z: baseHqZ - sign * 14.68,
        halfX: 0.56,
        halfZ: 0.52,
        rotY: 0,
        heightY: HALTE_GOLDEN_SCALE_CONFIG.kioskColliderHeightY,
        mat: 'metal',
      });

      // 2. Building, Fence, Gate, Planter, Parking Pillar, and Skyshield Bastion colliders
      //    are ONLY emitted if this plot is the permanent Model Estate (blue plot 0) OR actively claimed via NEAR Gamepass!
      if (!isCommanderBasePlotActive(plot)) {
        continue;
      }

      if (!isSafezoneMode) {
        structures.push({
          id: `bastion_${teamShort}_${pIdx}`,
          x: baseHqX + sign * bastionLocalZ[pIdx],
          z: baseHqZ - sign * 26.0,
          halfX: 1.85,
          halfZ: 1.85,
          rotY: 0,
          heightY: skyshields[pIdx]?.isBuilt ? 5.2 : 2.6,
          mat: 'concrete',
        });
      }

      if (plot && !plot.destroyed) {
        if (isSafezoneMode || plot.buildingHp > 0) {
          structures.push({
            id: `${team}_plot_${pIdx}_building`,
            x: pwx,
            z: baseHqZ + sign * 4.4,
            halfX: 5.42,
            halfZ: 4.78,
            rotY: 0,
            heightY: 7.8 + plot.buildingLevel * 2.2,
            mat: 'wood',
          });
        }
        if (plot.fenceHp > 0) {
          const fh = 1.9 + plot.fenceLevel * 0.35;
          structures.push(
            { id: `${team}_plot_${pIdx}_fence_rear`, x: pwx, z: baseHqZ + sign * 13.2, halfX: 9.8, halfZ: 0.32, rotY: 0, heightY: fh, mat: 'concrete' },
            { id: `${team}_plot_${pIdx}_fence_w`, x: pwx - 9.8, z: baseHqZ - sign * 4.3, halfX: 0.32, halfZ: 17.5, rotY: 0, heightY: fh, mat: 'concrete' },
            { id: `${team}_plot_${pIdx}_fence_e`, x: pwx + 9.8, z: baseHqZ - sign * 4.3, halfX: 0.32, halfZ: 17.5, rotY: 0, heightY: fh, mat: 'concrete' },
            { id: `${team}_plot_${pIdx}_fence_fl`, x: pwx - 6.3, z: baseHqZ - sign * 21.8, halfX: 3.5, halfZ: 0.32, rotY: 0, heightY: fh, mat: 'concrete' },
            { id: `${team}_plot_${pIdx}_fence_fr`, x: pwx + 6.3, z: baseHqZ - sign * 21.8, halfX: 3.5, halfZ: 0.32, rotY: 0, heightY: fh, mat: 'concrete' },
            { id: `${team}_plot_${pIdx}_gate`, x: pwx, z: baseHqZ - sign * 21.8, halfX: 2.8, halfZ: 0.34, rotY: 0, heightY: fh, mat: 'metal' },
          );
        }
        for (let cIdx = 0; cIdx < gardenCornersLocal.length; cIdx++) {
          const [gx, gz] = gardenCornersLocal[cIdx];
          structures.push({
            id: `${team}_plot_${pIdx}_planter_${cIdx}`,
            x: pwx + sign * gz,
            z: baseHqZ - sign * gx,
            halfX: 1.08,
            halfZ: 1.18,
            rotY: 0,
            heightY: 4.2,
            mat: 'wood',
          });
        }
        if (!isSafezoneMode && plot.hasParkingBay) {
          for (let pStep = 0; pStep < parkingPillarsLocal.length; pStep++) {
            const [lx, relZ] = parkingPillarsLocal[pStep];
            structures.push({
              id: `${team}_plot_${pIdx}_parking_pillar_${pStep}`,
              x: pwx + sign * relZ,
              z: baseHqZ - sign * lx,
              halfX: 0.3,
              halfZ: 0.3,
              rotY: 0,
              heightY: 2.95,
              mat: 'metal',
            });
          }
        }
      }
    }
  };

  emitTeamBasePlotColliders('blue', blueBase.hqX, blueBase.hqZ, blueCommanderBases, blueSkyshields);
  emitTeamBasePlotColliders(
    'red',
    redBase?.hqX ?? 0.0,
    redBase?.hqZ ?? -86.0,
    redCommanderBases,
    redSkyshields,
  );

  return structures;
}
