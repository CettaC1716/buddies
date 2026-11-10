import * as THREE from 'three';
import {
  IndividualCommanderBaseState,
  isCommanderBasePlotActive,
} from './buddiesBlitzRules';
import {
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

export const MAP_STORAGE_KEY = 'blitz_arena_map_layout_v40';

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
    placeWorld('tree_purple', 66.5, 74.5, -0.45, 1.12),
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
    { id: 504, kind: 'pipe_cluster', x: 7.5, z: -5.6, rotY: 0.0, scale: 1.08 },
    { id: 505, kind: 'pipe_cluster', x: 7.5, z: 5.6, rotY: Math.PI, scale: 1.08 },
    { id: 506, kind: 'tree_purple', x: -4.5, z: -7.2, rotY: 0.35, scale: 1.08 },
    { id: 507, kind: 'tree_purple', x: -4.5, z: 7.2, rotY: -0.35, scale: 1.08 },
    { id: 508, kind: 'tree_gold', x: 3.2, z: -7.2, rotY: 0.65, scale: 1.08 },
    { id: 509, kind: 'tree_gold', x: 3.2, z: 7.2, rotY: -0.65, scale: 1.08 },
    { id: 510, kind: 'tree_purple', x: 12.5, z: -5.5, rotY: 0.15, scale: 1.08 },
    { id: 511, kind: 'tree_purple', x: 12.5, z: 5.5, rotY: -0.15, scale: 1.08 },
    { id: 512, kind: 'tree_gold', x: 16.5, z: 0.0, rotY: 0.45, scale: 1.1 },

    { id: 550, kind: 'tree_gold', x: -9.5, z: -28.0, rotY: 0.25, scale: 1.14 },
    { id: 551, kind: 'tree_purple', x: -2.5, z: -24.5, rotY: -0.45, scale: 1.12 },
    { id: 552, kind: 'tree_gold', x: 6.5, z: -25.5, rotY: 0.75, scale: 1.15 },
    { id: 553, kind: 'tree_purple', x: 11.0, z: -32.5, rotY: -0.65, scale: 1.1 },
    { id: 554, kind: 'tree_gold', x: 2.5, z: -41.5, rotY: 0.35, scale: 1.12 },
    { id: 555, kind: 'tree_purple', x: -8.5, z: -38.5, rotY: 0.95, scale: 1.08 },
    { id: 556, kind: 'tree_gold', x: 9.5, z: -42.0, rotY: -0.25, scale: 1.12 },
    { id: 557, kind: 'flower_cluster', x: 0.0, z: -35.0, rotY: 0.4, scale: 1.35 },
    { id: 558, kind: 'river_rock', x: 2.0, z: -32.0, rotY: 0.8, scale: 1.4 },

    { id: 560, kind: 'tree_gold', x: -9.5, z: 28.0, rotY: -0.25, scale: 1.14 },
    { id: 561, kind: 'tree_purple', x: -2.5, z: 24.5, rotY: 0.45, scale: 1.12 },
    { id: 562, kind: 'tree_gold', x: 6.5, z: 25.5, rotY: -0.75, scale: 1.15 },
    { id: 563, kind: 'tree_purple', x: 11.0, z: 32.5, rotY: 0.65, scale: 1.1 },
    { id: 564, kind: 'tree_gold', x: 2.5, z: 41.5, rotY: -0.35, scale: 1.12 },
    { id: 565, kind: 'tree_purple', x: -8.5, z: 38.5, rotY: -0.95, scale: 1.08 },
    { id: 566, kind: 'tree_gold', x: 9.5, z: 42.0, rotY: 0.25, scale: 1.12 },
    { id: 567, kind: 'flower_cluster', x: 0.0, z: 35.0, rotY: -0.4, scale: 1.35 },
    { id: 568, kind: 'river_rock', x: -1.0, z: 32.0, rotY: -0.8, scale: 1.4 },

    { id: 570, kind: 'tree_gold', x: 28.5, z: 0.0, rotY: 0.45, scale: 1.14 },
    { id: 571, kind: 'tree_purple', x: 25.5, z: -8.5, rotY: -0.35, scale: 1.12 },
    { id: 572, kind: 'tree_purple', x: 25.5, z: 8.5, rotY: 0.35, scale: 1.12 },
    { id: 573, kind: 'tree_gold', x: 28.0, z: -14.5, rotY: -0.55, scale: 1.12 },
    { id: 574, kind: 'tree_gold', x: 28.0, z: 14.5, rotY: 0.55, scale: 1.12 },
    { id: 575, kind: 'flower_cluster', x: 26.5, z: -4.2, rotY: 0.6, scale: 1.32 },
    { id: 576, kind: 'flower_cluster', x: 26.5, z: 4.2, rotY: -0.6, scale: 1.32 },
    { id: 577, kind: 'tree_purple', x: 38.5, z: -6.5, rotY: 0.25, scale: 1.14 },
    { id: 578, kind: 'tree_purple', x: 38.5, z: 6.5, rotY: -0.25, scale: 1.14 },
    { id: 579, kind: 'tree_gold', x: 46.5, z: 0.0, rotY: -0.4, scale: 1.16 },
    { id: 590, kind: 'tree_gold', x: 31.0, z: -36.5, rotY: 0.35, scale: 1.14 },
    { id: 591, kind: 'tree_gold', x: 31.0, z: 36.5, rotY: -0.35, scale: 1.14 },
    { id: 592, kind: 'tree_purple', x: 54.5, z: -34.0, rotY: -0.45, scale: 1.14 },
    { id: 593, kind: 'tree_purple', x: 54.5, z: 34.0, rotY: 0.45, scale: 1.14 },
    { id: 594, kind: 'tree_gold', x: 60.5, z: -28.0, rotY: 0.55, scale: 1.12 },
    { id: 595, kind: 'tree_gold', x: 60.5, z: 28.0, rotY: -0.55, scale: 1.12 },
    { id: 596, kind: 'flower_cluster', x: 52.0, z: -38.5, rotY: 0.5, scale: 1.32 },
    { id: 597, kind: 'flower_cluster', x: 52.0, z: 38.5, rotY: -0.5, scale: 1.32 },
    { id: 598, kind: 'river_rock', x: 48.0, z: -8.5, rotY: 0.7, scale: 1.35 },
    { id: 599, kind: 'river_rock', x: 48.0, z: 8.5, rotY: -0.7, scale: 1.35 },

    { id: 490, kind: 'tree_purple', x: -100.5, z: -26.5, rotY: 0.25, scale: 1.08 },
    { id: 491, kind: 'tree_gold', x: -100.5, z: 26.5, rotY: -0.25, scale: 1.08 },
    { id: 494, kind: 'flower_cluster', x: -96.5, z: -32.5, rotY: 0.4, scale: 1.32 },
    { id: 495, kind: 'flower_cluster', x: -96.5, z: 32.5, rotY: -0.4, scale: 1.32 },

    { id: 301, kind: 'turbine', x: -59.5, z: -36.5, rotY: 0.45, scale: 1.25 },
    { id: 302, kind: 'turbine', x: -59.5, z: 36.5, rotY: 0.45, scale: 1.25 },
    { id: 303, kind: 'turbine', x: -34.5, z: -38.5, rotY: 0.3, scale: 1.25 },
    { id: 304, kind: 'turbine', x: -34.5, z: 38.5, rotY: 0.3, scale: 1.25 },
    { id: 305, kind: 'turbine', x: -84.0, z: -43.5, rotY: 0.35, scale: 1.24 },
    { id: 306, kind: 'turbine', x: -84.0, z: 43.5, rotY: 0.35, scale: 1.24 },

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

    { id: 330, kind: 'tree_gold', x: -42.5, z: -7.8, rotY: 0.3, scale: 1.12 },
    { id: 331, kind: 'tree_gold', x: -42.5, z: 7.8, rotY: -0.3, scale: 1.12 },
    { id: 332, kind: 'tree_purple', x: -28.5, z: -15.2, rotY: -0.5, scale: 1.1 },
    { id: 333, kind: 'tree_purple', x: -28.5, z: 15.2, rotY: 0.5, scale: 1.1 },
    { id: 334, kind: 'tree_gold', x: -48.5, z: -36.5, rotY: 0.6, scale: 1.1 },
    { id: 335, kind: 'tree_gold', x: -48.5, z: 36.5, rotY: -0.6, scale: 1.1 },
    { id: 336, kind: 'tree_purple', x: -84.0, z: -48.0, rotY: -0.3, scale: 1.12 },
    { id: 337, kind: 'tree_purple', x: -84.0, z: 48.0, rotY: 0.3, scale: 1.12 },

    { id: 401, kind: 'crane', x: 105.8, z: 0.0, rotY: Math.PI / 2, scale: 1.38 },
    { id: 430, kind: 'forklift', x: 88.5, z: -29.5, rotY: 0.0, scale: 1.18 },
    { id: 431, kind: 'forklift', x: 88.5, z: 29.5, rotY: Math.PI, scale: 1.18 },
    { id: 432, kind: 'concrete_fence_1b', x: 98.5, z: -43.8, rotY: 0.0, scale: 1.18 },
    { id: 433, kind: 'concrete_fence_1b', x: 103.0, z: -43.8, rotY: 0.0, scale: 1.18 },

    { id: 520, kind: 'bench', x: 2.0, z: -34.5, rotY: 0.0, scale: 1.35 },
    { id: 521, kind: 'bench', x: 2.0, z: -29.5, rotY: Math.PI, scale: 1.35 },
    { id: 580, kind: 'recycle_bin', x: 4.3, z: -34.5, rotY: -Math.PI / 2, scale: 1.08 },
    { id: 522, kind: 'bench', x: -1.0, z: 29.8, rotY: -Math.PI / 2, scale: 1.35 },
    { id: 523, kind: 'bench', x: -1.0, z: 34.2, rotY: -Math.PI / 2, scale: 1.35 },
    { id: 581, kind: 'recycle_bin', x: -1.0, z: 36.6, rotY: -Math.PI / 2, scale: 1.08 },
    { id: 524, kind: 'bench', x: 23.8, z: 0.0, rotY: Math.PI / 2, scale: 1.35 },
    { id: 525, kind: 'bench', x: 25.2, z: 0.0, rotY: -Math.PI / 2, scale: 1.35 },
    { id: 582, kind: 'recycle_bin', x: 24.5, z: -2.3, rotY: 0.0, scale: 1.08 },
    { id: 583, kind: 'recycle_bin', x: 24.5, z: 2.3, rotY: Math.PI, scale: 1.08 },
    { id: 526, kind: 'bench', x: -44.2, z: -2.0, rotY: -Math.PI / 2, scale: 1.35 },
    { id: 527, kind: 'bench', x: -44.2, z: 2.0, rotY: -Math.PI / 2, scale: 1.35 },
    { id: 584, kind: 'recycle_bin', x: -44.2, z: -4.2, rotY: -Math.PI / 2, scale: 1.08 },
    { id: 585, kind: 'recycle_bin', x: -44.2, z: 4.2, rotY: -Math.PI / 2, scale: 1.08 },
    { id: 528, kind: 'bench', x: -9.5, z: -44.6, rotY: 0.0, scale: 1.35 },
    { id: 529, kind: 'bench', x: -9.5, z: 44.6, rotY: Math.PI, scale: 1.35 },
    { id: 586, kind: 'recycle_bin', x: -12.0, z: -44.6, rotY: 0.0, scale: 1.08 },
    { id: 587, kind: 'recycle_bin', x: -12.0, z: 44.6, rotY: Math.PI, scale: 1.08 },

    { id: 530, kind: 'lamppost_1b', x: -6.2, z: -7.2, rotY: 0.0, scale: 1.15 },
    { id: 531, kind: 'lamppost_1b', x: -6.2, z: 7.2, rotY: Math.PI / 2, scale: 1.15 },
    { id: 532, kind: 'lamppost_1b', x: 25.8, z: -30.8, rotY: Math.PI / 2, scale: 1.15 },
    { id: 533, kind: 'lamppost_1b', x: 25.8, z: 30.8, rotY: 0.0, scale: 1.15 },
    { id: 534, kind: 'lamppost_1b', x: -61.2, z: -43.2, rotY: 0.0, scale: 1.15 },
    { id: 535, kind: 'lamppost_1b', x: -61.2, z: 43.2, rotY: Math.PI / 2, scale: 1.15 },
    { id: 536, kind: 'lamppost_1b', x: 61.2, z: -43.2, rotY: -Math.PI / 2, scale: 1.15 },
    { id: 537, kind: 'lamppost_1b', x: 61.2, z: 43.2, rotY: Math.PI, scale: 1.15 },

    { id: 538, kind: 'lamppost_1a', x: 0.0, z: -45.2, rotY: 0.0, scale: 1.15 },
    { id: 539, kind: 'lamppost_1a', x: 0.0, z: 45.2, rotY: Math.PI, scale: 1.15 },
    { id: 540, kind: 'lamppost_1a', x: -64.8, z: -78.0, rotY: -Math.PI / 2, scale: 1.15 },
    { id: 541, kind: 'lamppost_1a', x: -64.8, z: 78.0, rotY: -Math.PI / 2, scale: 1.15 },
    { id: 542, kind: 'lamppost_1a', x: 64.8, z: -78.0, rotY: Math.PI / 2, scale: 1.15 },
    { id: 543, kind: 'lamppost_1a', x: 64.8, z: 78.0, rotY: Math.PI / 2, scale: 1.15 },

    { id: 618, kind: 'barricade', x: 96.5, z: -63.5, rotY: Math.PI / 2, scale: 1.1 },
    { id: 619, kind: 'barricade', x: 96.5, z: -80.5, rotY: Math.PI / 2, scale: 1.1 },
  ],
};

export function cloneDefaultLayout(): ArenaMapLayout {
  return JSON.parse(JSON.stringify(DEFAULT_ARENA_MAP_LAYOUT));
}

export function loadSavedArenaLayout(): ArenaMapLayout {
  try {
    const raw = localStorage.getItem(MAP_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ArenaMapLayout;
      if (parsed && Array.isArray(parsed.props) && parsed.blueHq && parsed.redHq) {
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
  kioskScaleS: 1.4, // 0.62x of legacy 2.25 -> ~2.54m height (0.66x character height)
  kioskColliderHeightY: 2.55,
  lobbyParasolScale: 1.62, // raised from 1.38 so umbrella canopy clears 3.85m character head (~3.95m)
  lobbyLampPoleScale: 1.06, // sleek ~4.81m promenade lamp pole matching the 5.05m Halte canopy
  streetLamppostBaseHeightM: 4.35, // at 1.15x layout scale -> 5.00m (down from 8.51m giant lamppost)
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
      return 1.42;
    case 'explosive_barrel':
    case 'barrel_1c':
      return 1.38;
    case 'hydrant':
      return 1.18;
    case 'recycle_bin':
      return 1.22;
    case 'bench':
      return 1.08;
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

export function createBillboardSign(widthWorld: number, heightWorld: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(widthWorld, heightWorld, 1);
  sprite.renderOrder = 10;

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
 * Creates an MMORPG Glassmorphism Nameplate with Custom Emblem (Diamond Crown / Shield / Star)
 * Inspired by modern stylized games (e.g. Avakin / Genshin / Anime MMOs).
 */
export function createGlassmorphicNameplate(
  widthWorld = 2.8,
  heightWorld = 0.72,
  defaultName = 'WARGA',
  _defaultSub = '',
  isNpc = false,
) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 112;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(widthWorld, heightWorld, 1);
  sprite.renderOrder = 11;

  const updatePlate = (name: string, _sub = '', emblemType: 'npc' | 'player_rookie' | 'player_veteran' = isNpc ? 'npc' : 'player_rookie') => {
    ctx.clearRect(0, 0, 512, 112);

    // 1. Crystal-Clear Translucent Frosted Glassmorphism Background ("Bening")
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 112);
    bgGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
    bgGrad.addColorStop(0.3, 'rgba(15, 23, 42, 0.40)');
    bgGrad.addColorStop(1, 'rgba(2, 6, 23, 0.60)');

    ctx.save();
    ctx.shadowColor = emblemType === 'npc' ? 'rgba(250, 204, 21, 0.6)' : 'rgba(56, 189, 248, 0.6)';
    ctx.shadowBlur = 14;

    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(10, 10, 492, 92, 22);
    ctx.fill();
    ctx.restore();

    // 2. Translucent Glass Glossy Top Highlight Reflection
    const glossGrad = ctx.createLinearGradient(0, 10, 0, 50);
    glossGrad.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
    glossGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
    glossGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = glossGrad;
    ctx.beginPath();
    ctx.roundRect(12, 12, 488, 42, [20, 20, 0, 0]);
    ctx.fill();

    // 3. Cybernetic Neon Glass Border
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = emblemType === 'npc' ? 'rgba(250, 204, 21, 0.95)' : 'rgba(56, 189, 248, 0.95)';
    ctx.beginPath();
    ctx.roundRect(10, 10, 492, 92, 22);
    ctx.stroke();

    // 3b. Inner crystal reflection line for authentic glassmorphism
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.beginPath();
    ctx.roundRect(13, 13, 486, 86, 19);
    ctx.stroke();

    // 4. Render Emblem (Left badge circle/shield)
    ctx.save();
    const cx = 58;
    const cy = 56;

    if (emblemType === 'npc') {
      // NPC Emblem: Royal Golden Crown & Star Crest
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(cx, cy, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#facc15';
      ctx.stroke();

      // Golden Crown polygon
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy + 11);
      ctx.lineTo(cx - 16, cy - 6);
      ctx.lineTo(cx - 6, cy + 1);
      ctx.lineTo(cx, cy - 13);
      ctx.lineTo(cx + 6, cy + 1);
      ctx.lineTo(cx + 16, cy - 6);
      ctx.lineTo(cx + 15, cy + 11);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#78350f';
      ctx.stroke();

      // Center ruby gem
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(cx, cy + 3, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Player Default Rookie Emblem: Blue Tactical Shield with Wing/Chevron
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(cx, cy, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#38bdf8';
      ctx.stroke();

      // Shield Chevron / Wings (Rookie military badge)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 14);
      ctx.lineTo(cx + 14, cy - 3);
      ctx.lineTo(cx + 11, cy + 11);
      ctx.lineTo(cx, cy + 17);
      ctx.lineTo(cx - 11, cy + 11);
      ctx.lineTo(cx - 14, cy - 3);
      ctx.closePath();
      ctx.fill();

      // Inner tactical star / chevron
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 8);
      ctx.lineTo(cx + 8, cy - 1);
      ctx.lineTo(cx + 5, cy + 8);
      ctx.lineTo(cx, cy + 12);
      ctx.lineTo(cx - 5, cy + 8);
      ctx.lineTo(cx - 8, cy - 1);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 13px "Barlow", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('1', cx, cy + 2);
    }
    ctx.restore();

    // 5. Player / NPC Name Text (Bold, modern typography with shadow, vertically centered)
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 1.5;
    ctx.shadowOffsetY = 1.5;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 32px "Barlow", sans-serif';
    ctx.fillText(name.toUpperCase(), 106, 56);
    ctx.restore();

    tex.needsUpdate = true;
  };

  updatePlate(defaultName, '', isNpc ? 'npc' : 'player_rookie');

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

  const nExcRot = Math.PI + 0.35;
  const excBoomOffset = 4.55;
  const plotOffsetsX = [-45.0, -15.0, 15.0, 45.0] as const;
  const bastionLocalZ = [-51.4, -21.4, 8.6, 38.6] as const;
  const parasolRatio = HALTE_GOLDEN_SCALE_CONFIG.lobbyParasolScale / 1.38;
  const showerRatio = HALTE_GOLDEN_SCALE_CONFIG.beachShowerScale / 1.55;
  const surfRackRatio = HALTE_GOLDEN_SCALE_CONFIG.beachSurfRackScale / 1.48;
  const structures: StaticWorldStructureObb[] = [
    // Sealed Lobby Safezone Perimeter Colliders (continuous parapet around the flat plaza; portals sit on the flat upper deck at (-84.0, ±15.0))
    { id: 'west_wall_north', x: -90.5, z: -38.05, halfX: 14.05, halfZ: 0.28, rotY: 0, heightY: 2.2, mat: 'concrete', isRetainingWall: true },
    { id: 'west_wall_south', x: -90.5, z: 38.05, halfX: 14.05, halfZ: 0.28, rotY: 0, heightY: 2.2, mat: 'concrete', isRetainingWall: true },
    { id: 'west_wall_west', x: -104.5, z: 0.0, halfX: 0.35, halfZ: 38.2, rotY: 0, heightY: 2.2, mat: 'concrete', isRetainingWall: true },
    { id: 'west_wall_east_n', x: -76.45, z: -26.5, halfX: 0.28, halfZ: 11.6, rotY: 0, heightY: 2.2, mat: 'concrete', isRetainingWall: true },
    { id: 'west_wall_east_mid', x: -76.45, z: 0.0, halfX: 0.28, halfZ: 15.2, rotY: 0, heightY: 2.2, mat: 'concrete', isRetainingWall: true },
    { id: 'west_wall_east_s', x: -76.45, z: 26.5, halfX: 0.28, halfZ: 11.6, rotY: 0, heightY: 2.2, mat: 'concrete', isRetainingWall: true },

    // Lobby Safezone Self-Service Tactical Kiosks (without crate pad), Contemporary Pergola, Modern Coffee & Gelato Kiosk, Parasol Tables & 6 Integrated Concrete Planter Benches
    { id: 'west_plaza_near_terminal', x: -81.8, z: -8.2, halfX: 0.65, halfZ: 0.88, rotY: 0, heightY: HALTE_GOLDEN_SCALE_CONFIG.kioskColliderHeightY, mat: 'metal' },
    { id: 'west_plaza_gold_exchange', x: -81.8, z: -14.8, halfX: 0.65, halfZ: 0.88, rotY: 0, heightY: HALTE_GOLDEN_SCALE_CONFIG.kioskColliderHeightY, mat: 'metal' },
    { id: 'lobby_pergola_rear_screen', x: -101.04, z: 12.2, halfX: 0.38, halfZ: 3.32, rotY: 0, heightY: 5.8, mat: 'wood' },
    { id: 'lobby_pergola_left_screen', x: -99.34, z: 15.43, halfX: 1.75, halfZ: 0.38, rotY: 0, heightY: 5.8, mat: 'wood' },
    { id: 'lobby_pergola_post_rf', x: -97.63, z: 8.97, halfX: 0.34, halfZ: 0.34, rotY: 0, heightY: 5.8, mat: 'metal' },
    { id: 'lobby_pergola_bench_rear', x: -100.52, z: 12.11, halfX: 0.48, halfZ: 3.02, rotY: 0, heightY: 2.6, mat: 'wood' },
    { id: 'lobby_pergola_bench_left', x: -98.83, z: 14.89, halfX: 1.28, halfZ: 0.48, rotY: 0, heightY: 2.6, mat: 'wood' },
    { id: 'lobby_pergola_table_s', x: -96.94, z: 13.16, halfX: 1.45, halfZ: 1.45, rotY: 0, heightY: 2.6, mat: 'wood' },
    { id: 'lobby_pergola_table_n', x: -96.94, z: 10.50, halfX: 1.45, halfZ: 1.45, rotY: 0, heightY: 2.6, mat: 'wood' },
    { id: 'lobby_gelato_kiosk_body', x: -98.15, z: -13.8, halfX: 2.62, halfZ: 3.30, rotY: 0, heightY: 5.8, mat: 'metal' },
    { id: 'lobby_gelato_kiosk_stools', x: -95.16, z: -12.38, halfX: 0.44, halfZ: 1.38, rotY: 0, heightY: 2.6, mat: 'wood' },
    { id: 'lobby_parasol_table_n', x: -97.7, z: -3.76, halfX: +(1.45 * parasolRatio).toFixed(2), halfZ: +(1.45 * parasolRatio).toFixed(2), rotY: 0, heightY: +(4.8 * parasolRatio).toFixed(2), mat: 'wood' },
    { id: 'lobby_parasol_table_s', x: -97.7, z: 1.76, halfX: +(1.45 * parasolRatio).toFixed(2), halfZ: +(1.45 * parasolRatio).toFixed(2), rotY: 0, heightY: +(4.8 * parasolRatio).toFixed(2), mat: 'wood' },
    { id: 'lobby_planter_bench_n', x: -90.5, z: -32.78, halfX: 3.48, halfZ: 1.72, rotY: 0, heightY: 4.5, mat: 'concrete' },
    { id: 'lobby_planter_bench_s', x: -90.5, z: 32.78, halfX: 3.48, halfZ: 1.72, rotY: 0, heightY: 4.5, mat: 'concrete' },
    { id: 'lobby_planter_bench_wn', x: -99.7, z: -24.5, halfX: 1.62, halfZ: 3.25, rotY: 0, heightY: 4.5, mat: 'concrete' },
    { id: 'lobby_planter_bench_ws', x: -99.7, z: 24.8, halfX: 1.62, halfZ: 3.25, rotY: 0, heightY: 4.5, mat: 'concrete' },
    { id: 'lobby_planter_bench_en', x: -81.1, z: -24.5, halfX: 1.62, halfZ: 3.25, rotY: 0, heightY: 4.5, mat: 'concrete' },
    { id: 'lobby_planter_bench_es', x: -81.1, z: 24.8, halfX: 1.62, halfZ: 3.25, rotY: 0, heightY: 4.5, mat: 'concrete' },
    // Sunken Stepped Amphitheater Seating Bleachers & Sloped Side Glass-Timber Balustrades (Sheet 5)
    { id: 'lobby_amphitheater_rail_n', x: -78.45, z: -6.42, halfX: 1.82, halfZ: 0.24, rotY: 0, heightY: 2.6, mat: 'concrete' },
    { id: 'lobby_amphitheater_rail_s', x: -78.45, z: 11.42, halfX: 1.82, halfZ: 0.24, rotY: 0, heightY: 2.6, mat: 'concrete' },
    { id: 'lobby_amphitheater_bleacher_n', x: -79.15, z: -3.28, halfX: 1.12, halfZ: 3.12, rotY: 0, heightY: 2.6, mat: 'wood' },
    { id: 'lobby_amphitheater_bleacher_s', x: -79.15, z: 8.28, halfX: 1.12, halfZ: 3.12, rotY: 0, heightY: 2.6, mat: 'wood' },
    // East Halte Trem Shelter Colliders (Windbreak Wall, Self-Service Teleport Kiosk, Ticket Machine & Slatted Passenger Bench)
    { id: 'lobby_tram_shelter_windbreak', x: -59.6, z: 0.0, halfX: 0.28, halfZ: 6.8, rotY: 0, heightY: HALTE_GOLDEN_SCALE_CONFIG.halteCanopyClearanceM, mat: 'concrete' },
    { id: 'halte_teleport_kiosk', x: -61.95, z: 0.0, halfX: 0.56, halfZ: 0.72, rotY: 0, heightY: HALTE_GOLDEN_SCALE_CONFIG.kioskColliderHeightY, mat: 'metal' },
    { id: 'halte_ticket_machine', x: -59.96, z: -5.15, halfX: 0.42, halfZ: 0.62, rotY: 0, heightY: 2.30, mat: 'metal' },
    { id: 'halte_passenger_bench', x: -60.14, z: 2.60, halfX: 0.34, halfZ: 1.72, rotY: 0, heightY: 1.25, mat: 'wood' },

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
    { id: 'beach_lifeguard_tower', x: 101.6, z: 67.5, halfX: 3.45, halfZ: 2.35, rotY: 0, heightY: 7.5, mat: 'wood' },

    // Nautical Rope Railings & Staircase Side Handrails
    { id: 'beach_railing_north', x: 85.2, z: 46.3, halfX: 6.8, halfZ: 0.28, rotY: 0, heightY: 2.4, mat: 'wood' },
    { id: 'beach_railing_sea_n', x: 91.9, z: 55.5, halfX: 0.28, halfZ: 9.25, rotY: 0, heightY: 2.4, mat: 'wood' },
    { id: 'beach_railing_sea_mid', x: 91.9, z: 85.4, halfX: 0.28, halfZ: 8.65, rotY: 0, heightY: 2.4, mat: 'wood' },
    { id: 'beach_railing_sea_s', x: 91.9, z: 100.7, halfX: 0.28, halfZ: 1.55, rotY: 0, heightY: 2.4, mat: 'wood' },
    { id: 'beach_railing_south', x: 85.2, z: 102.2, halfX: 6.8, halfZ: 0.28, rotY: 0, heightY: 2.4, mat: 'wood' },
    { id: 'beach_stair1_rail_n', x: 93.75, z: 70.3, halfX: 1.75, halfZ: 0.22, rotY: 0, heightY: 2.2, mat: 'wood' },
    { id: 'beach_stair1_rail_s', x: 93.75, z: 76.7, halfX: 1.75, halfZ: 0.22, rotY: 0, heightY: 2.2, mat: 'wood' },
    { id: 'beach_stair2_rail_n', x: 93.75, z: 94.1, halfX: 1.75, halfZ: 0.22, rotY: 0, heightY: 2.2, mat: 'wood' },
    { id: 'beach_stair2_rail_s', x: 93.75, z: 99.1, halfX: 1.75, halfZ: 0.22, rotY: 0, heightY: 2.2, mat: 'wood' },

    // 7 Slatted Timber Sun Loungers & 4 Coastal Adirondack Beach Chairs
    { id: 'beach_lounger_1', x: 100.2, z: 54.0, halfX: 1.38, halfZ: 0.72, rotY: -0.12, heightY: 1.6, mat: 'wood' },
    { id: 'beach_lounger_2', x: 100.2, z: 57.2, halfX: 1.38, halfZ: 0.72, rotY: -0.08, heightY: 1.6, mat: 'wood' },
    { id: 'beach_lounger_3', x: 100.2, z: 60.4, halfX: 1.38, halfZ: 0.72, rotY: -0.05, heightY: 1.6, mat: 'wood' },
    { id: 'beach_lounger_4', x: 101.0, z: 77.5, halfX: 1.38, halfZ: 0.72, rotY: 0.08, heightY: 1.6, mat: 'wood' },
    { id: 'beach_lounger_5', x: 101.0, z: 80.8, halfX: 1.38, halfZ: 0.72, rotY: 0.12, heightY: 1.6, mat: 'wood' },
    { id: 'beach_lounger_6', x: 100.2, z: 91.5, halfX: 1.38, halfZ: 0.72, rotY: -0.10, heightY: 1.6, mat: 'wood' },
    { id: 'beach_lounger_7', x: 100.2, z: 94.8, halfX: 1.38, halfZ: 0.72, rotY: -0.06, heightY: 1.6, mat: 'wood' },
    { id: 'beach_chair_1', x: 96.2, z: 81.8, halfX: 0.78, halfZ: 0.78, rotY: 0.15, heightY: 1.8, mat: 'wood' },
    { id: 'beach_chair_2', x: 96.2, z: 85.0, halfX: 0.78, halfZ: 0.78, rotY: 0.05, heightY: 1.8, mat: 'wood' },
    { id: 'beach_chair_3', x: 96.2, z: 88.2, halfX: 0.78, halfZ: 0.78, rotY: -0.10, heightY: 1.8, mat: 'wood' },
    { id: 'beach_chair_4', x: 97.5, z: 49.5, halfX: 0.78, halfZ: 0.78, rotY: -0.20, heightY: 1.8, mat: 'wood' },

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

    // North-East Construction Yard Equipment (Excavator, Steel Girders, Palletized Bricks/Cement)
    { id: 'const_excavator_n_body', x: 92.0, z: -72.0, halfX: 2.22, halfZ: 2.75, rotY: nExcRot, heightY: 4.85, mat: 'metal' },
    {
      id: 'const_excavator_n_boom',
      x: 92.0 + Math.sin(nExcRot) * excBoomOffset,
      z: -72.0 + Math.cos(nExcRot) * excBoomOffset,
      halfX: 0.62,
      halfZ: 2.15,
      rotY: nExcRot,
      heightY: 4.85,
      mat: 'metal',
    },
    { id: 'const_girders_n1', x: 93.0, z: -55.0, halfX: 1.85, halfZ: 3.48, rotY: 0.0, heightY: 1.75, mat: 'metal' },
    { id: 'const_pallets_n2', x: 92.5, z: -89.0, halfX: 2.85, halfZ: 2.65, rotY: 0.0, heightY: 1.95, mat: 'concrete' },

    { id: 'cont_stack_harbor_nw', x: 80.15, z: -34.5, halfX: 3.55, halfZ: 3.64, rotY: 0, heightY: 6.72, mat: 'metal' },
    { id: 'cont_stack_harbor_sw', x: 80.15, z: 34.5, halfX: 3.55, halfZ: 3.64, rotY: 0, heightY: 6.72, mat: 'metal' },
    { id: 'cont_stack_harbor_nc', x: 80.15, z: -24.5, halfX: 3.55, halfZ: 3.64, rotY: 0, heightY: 3.4, mat: 'metal' },
    { id: 'cont_stack_harbor_sc', x: 80.15, z: 24.5, halfX: 3.55, halfZ: 3.64, rotY: 0, heightY: 3.4, mat: 'metal' },
    { id: 'cont_stack_harbor_ne', x: 101.5, z: -33.45, halfX: 3.55, halfZ: 3.64, rotY: Math.PI / 2, heightY: 6.72, mat: 'metal' },
    { id: 'cont_stack_harbor_se', x: 101.5, z: 33.45, halfX: 3.55, halfZ: 3.64, rotY: Math.PI / 2, heightY: 6.72, mat: 'metal' },
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
        if (!isSafezoneMode && plot.buildingHp > 0) {
          structures.push({
            id: `${team}_plot_${pIdx}_building`,
            x: pwx,
            z: baseHqZ + sign * 5.5,
            halfX: 4.25,
            halfZ: 3.65,
            rotY: Math.PI / 2,
            heightY: 6.8 + plot.buildingLevel * 2.1,
            mat: 'concrete',
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
