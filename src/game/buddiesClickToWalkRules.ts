import * as THREE from 'three';
import {
  AStarNavGrid,
  RADAR_WORLD_HALF_EXTENT,
  WorldMode,
  createAStarNavGrid,
  createIndividualCommanderBasesState,
  getPropCollisionSpec,
  isPointInsideLobbySafezone,
  navGridCellToWorld,
  pointInObb2D,
  rasterizeCircleObstacleToNavGrid,
  rasterizeObbObstacleToNavGrid,
  resolveSolidObbCollision2D,
  worldToNavGridCell,
} from './buddiesBlitzRules';
import {
  ActiveMapPropPhysics,
  DestructibleTree,
  StaticWorldStructureObb,
} from './buddiesBlitzTypes';
import {
  DEFAULT_ARENA_MAP_LAYOUT,
  buildStaticWorldStructuresList,
  getPropBaseHeight,
  isInsideCoastalAmusementParkFootprint,
  isInsideSouthPlazaGlasshouseFootprint,
} from './buddiesBlitzWorldBuilder';
import {
  CENTRAL_PARK_MASTERPLAN,
  isPointInsideCentralIslandEnvelope,
} from './buddiesCentralParkRules';
import { isInsideNorthGrandCasinoFootprint } from './buddiesGrandCasinoRules';
import {
  CAFE_EXTERIOR_DOOR_TRIGGER,
  CAFE_INTERIOR_BOUNDS,
  clampCafeBaristaWorkShiftPosition,
  clampCafeInteriorPosition,
} from './buddiesCafeRules';
import {
  CAFE_INTERIOR_COLLIDERS,
} from './buddiesCafeInteriorBuilder';
import {
  CASINO_INTERIOR_BOUNDS,
  CASINO_INTERIOR_COLLIDERS,
  clampCasinoInteriorPosition,
} from './buddiesGrandCasinoRules';
import {
  SALON_EXTERIOR_DOOR_TRIGGER,
  SALON_INTERIOR_BOUNDS,
  SALON_INTERIOR_COLLIDERS,
  clampSalonInteriorPosition,
} from './buddiesBeautySalonRules';
import {
  REAL_ESTATE_FURNITURE_KIOSK_LAYOUT,
} from './buddiesRealEstateKioskRules';
import {
  CUTAWAY_ROOM_BOUNDS,
} from './buddiesMerchantPricing';
import {
  evaluateNwLakeSdf,
  evaluateOuterEmbankmentSdf,
  evaluateRoadNetworkSdf,
  evaluateSeHarborSdf,
  getTerrainElevation,
  isPointOnBeachfrontStiltCabinDeck,
} from './buddiesPlanetCurvature';
import {
  evaluateHaltePlatformSdf,
} from './buddiesPlanetCurvature';
import {
  isPointOnAmusementOverwaterPier,
} from './buddiesAmusementParkRules';
import {
  evaluateGrandCasinoPavedPlatformSdf,
} from './buddiesGrandCasinoRules';
import {
  isPointOnPedestrianCrosswalkCorridor,
} from './buddiesBlitzSquadAi';
import {
  AuditedWorldCollidersSet,
  DynamicCircleObstacle2D,
  DynamicObbObstacle2D,
  PLAYER_FOOT_CAPSULE_RADIUS,
  PedestrianAvoidanceCapsule2D,
  WORLD_STAIRCASE_CORRIDORS,
  computeLocalPedestrianAvoidance2D,
  getAuditedStaticWorldStructures,
  isSegmentClearOfAuditedStaticObstacles2D,
} from './buddiesCharacterCollisionRules';

export const CITY_NAV_MIN_COORD = -125.0;
export const CITY_NAV_MAX_COORD = 125.0;
export const CITY_NAV_DEFAULT_CELL_SIZE = 1.25;
export const CLICK_TO_WALK_MAX_DRAG_PX = 6;

export type ClickToWalkSource = 'world' | 'minimap' | 'poi';
export type InteriorRoomKind =
  | 'cafe_interior'
  | 'casino_interior'
  | 'salon_interior'
  | 'house_visit';

export type ClickToWalkPendingInteraction =
  | { kind: 'none' }
  | {
      kind: 'sit';
      seatId: string;
      seatX: number;
      seatZ: number;
      floorLevel?: '1f' | '2f';
      label?: string;
    }
  | {
      kind: 'sleep';
      bedId: string;
      bedX: number;
      bedZ: number;
      label?: string;
    }
  | {
      kind: 'door_or_kiosk';
      triggerId: string;
      eventName: string;
      eventDetail?: Record<string, unknown>;
      triggerRadius: number;
      label?: string;
    };

export interface ClickToWalkWaypoint {
  x: number;
  z: number;
  floorY?: number;
}

export interface ClickToWalkState {
  active: boolean;
  source: ClickToWalkSource;
  rawTargetX: number;
  rawTargetZ: number;
  targetX: number;
  targetZ: number;
  targetLabel: string | null;
  waypoints: ClickToWalkWaypoint[];
  waypointIndex: number;
  totalDistanceM: number;
  remainingDistanceM: number;
  pendingInteraction: ClickToWalkPendingInteraction;
  avoidSide: number;
  avoidTimer: number;
  stuckTimer: number;
  lastProgressX: number;
  lastProgressZ: number;
  startedAtMs: number;
}

export interface CityMinimapPoiSpec {
  id: 'hana' | 'cafe' | 'glow_studio' | 'kai' | 'park';
  label: string;
  x: number;
  z: number;
  walkTargetX: number;
  walkTargetZ: number;
  colorClass: string;
  badgeHex: string;
  labelSide: 'left' | 'right';
}

export const CITY_MINIMAP_POIS: readonly CityMinimapPoiSpec[] = [
  {
    id: 'hana',
    label: 'HANA',
    x: REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.hanaMerchantWorld.x,
    z: REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.hanaMerchantWorld.z,
    walkTargetX: REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.hanaMerchantWorld.x + 1.8,
    walkTargetZ: REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.hanaMerchantWorld.z,
    colorClass: 'bg-[#b8ff3c]',
    badgeHex: '#b8ff3c',
    labelSide: 'right',
  },
  {
    id: 'cafe',
    label: 'CAFE',
    x: CAFE_EXTERIOR_DOOR_TRIGGER.x,
    z: CAFE_EXTERIOR_DOOR_TRIGGER.z,
    walkTargetX: CAFE_EXTERIOR_DOOR_TRIGGER.x,
    walkTargetZ: CAFE_EXTERIOR_DOOR_TRIGGER.z,
    colorClass: 'bg-[#fb923c]',
    badgeHex: '#fb923c',
    labelSide: 'right',
  },
  {
    id: 'glow_studio',
    label: 'GLOW STUDIO',
    x: CENTRAL_PARK_MASTERPLAN.beautySalon.x,
    z: CENTRAL_PARK_MASTERPLAN.beautySalon.z,
    walkTargetX: SALON_EXTERIOR_DOOR_TRIGGER.x,
    walkTargetZ: SALON_EXTERIOR_DOOR_TRIGGER.z,
    colorClass: 'bg-[#f472b6]',
    badgeHex: '#f472b6',
    labelSide: 'right',
  },
  {
    id: 'kai',
    label: 'KAI',
    x: 85.8,
    z: 60.0,
    walkTargetX: 87.8,
    walkTargetZ: 60.0,
    colorClass: 'bg-[#facc15]',
    badgeHex: '#facc15',
    labelSide: 'left',
  },
  {
    id: 'park',
    label: 'PARK',
    x: 101.0,
    z: -61.0,
    walkTargetX: 98.5,
    walkTargetZ: -61.0,
    colorClass: 'bg-[#c084fc]',
    badgeHex: '#c084fc',
    labelSide: 'left',
  },
] as const;

export interface CityNavGridOptions {
  minX?: number;
  maxX?: number;
  minZ?: number;
  maxZ?: number;
  cellSize?: number;
  mode?: 'foot' | 'scooter';
  isSafezoneMode?: boolean;
  worldMode?: WorldMode;
  staticStructures?: ReadonlyArray<StaticWorldStructureObb>;
  auditedWorld?: AuditedWorldCollidersSet;
  trees?: ReadonlyArray<Pick<DestructibleTree, 'x' | 'z' | 'scale' | 'alive'>>;
  activeMapProps?: ReadonlyArray<
    Pick<
      ActiveMapPropPhysics,
      'alive' | 'category' | 'kind' | 'scale' | 'x' | 'z' | 'halfX' | 'halfZ' | 'rotY' | 'radius'
    >
  >;
}

export interface CityNavGridHandle {
  grid: AStarNavGrid;
  audited: AuditedWorldCollidersSet;
  elevations: Float32Array;
  stairMask: Uint8Array;
  mode: 'foot' | 'scooter';
  worldMode: WorldMode;
}

export interface CitySnapPointResult {
  x: number;
  z: number;
  snapped: boolean;
  rawX: number;
  rawZ: number;
  snapDistanceM: number;
}

export interface CityRoutePlanResult {
  reachable: boolean;
  snapped: boolean;
  startX: number;
  startZ: number;
  rawTargetX: number;
  rawTargetZ: number;
  targetX: number;
  targetZ: number;
  waypoints: ClickToWalkWaypoint[];
  totalDistanceM: number;
  expandedCount: number;
}

export interface InteriorRoutePlanResult {
  reachable: boolean;
  snapped: boolean;
  targetX: number;
  targetZ: number;
  targetFloorY: number;
  waypoints: ClickToWalkWaypoint[];
  totalDistanceM: number;
}

export interface ClickToWalkStepResult {
  nextState: ClickToWalkState;
  dirX: number;
  dirZ: number;
  speedScale: number;
  arrived: boolean;
  cancelledByManualInput: boolean;
  cancelledByStuck: boolean;
  pendingInteractionToTrigger: ClickToWalkPendingInteraction | null;
}

export interface ClickToWalkHudSummary {
  active: boolean;
  source: ClickToWalkSource;
  targetX: number;
  targetZ: number;
  targetLabel: string | null;
  remainingDistanceM: number;
  isOnScooter: boolean;
  waypoints: ReadonlyArray<{ x: number; z: number }>;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Exact inverse of `worldCoordToRadarPercent` (`src/game/buddiesBlitzRules.ts`).
 * Maps normalized minimap click percentages `[0..100]` back to world `(x, z)` meters.
 */
export function radarPercentToWorldCoord(
  leftPct: number,
  topPct: number,
  halfExtent: number = RADAR_WORLD_HALF_EXTENT,
): { x: number; z: number } {
  const safeLeft = Number.isFinite(leftPct) ? clamp(leftPct, 0, 100) : 50;
  const safeTop = Number.isFinite(topPct) ? clamp(topPct, 0, 100) : 50;
  const safeExtent = Number.isFinite(halfExtent) && halfExtent > 0 ? halfExtent : RADAR_WORLD_HALF_EXTENT;
  const x = ((safeLeft / 100) * 2 - 1) * safeExtent;
  const z = ((safeTop / 100) * 2 - 1) * safeExtent;
  return { x, z };
}

/**
 * Distinguishes a clean click/tap from an orbit/camera drag using pixel delta (`<= 6px`).
 */
export function isCleanClickTap(
  downX: number,
  downY: number,
  upX: number,
  upY: number,
  maxDragPx: number = CLICK_TO_WALK_MAX_DRAG_PX,
): boolean {
  if (
    !Number.isFinite(downX) ||
    !Number.isFinite(downY) ||
    !Number.isFinite(upX) ||
    !Number.isFinite(upY)
  ) {
    return false;
  }
  return Math.hypot(upX - downX, upY - downY) <= Math.max(0, maxDragPx);
}

/**
 * Builds the default city static world OBBs without requiring a live Three.js scene graph.
 */
export function createDefaultCityStaticStructures(
  isSafezoneMode = true,
): StaticWorldStructureObb[] {
  const dummyGroup = { userData: {} } as unknown as THREE.Group;
  return buildStaticWorldStructuresList({
    blueBase: { baseGroup: dummyGroup, hqX: 0.0, hqZ: 86.0 },
    redBase: { baseGroup: dummyGroup, hqX: 0.0, hqZ: -86.0 },
    blueCommanderBases: createIndividualCommanderBasesState('blue'),
    redCommanderBases: createIndividualCommanderBasesState('red'),
    isSafezoneMode,
  });
}

function getDefaultTreesAndSolidProps(): {
  trees: Array<Pick<DestructibleTree, 'x' | 'z' | 'scale' | 'alive'>>;
  props: Array<
    Pick<
      ActiveMapPropPhysics,
      'alive' | 'category' | 'kind' | 'scale' | 'x' | 'z' | 'halfX' | 'halfZ' | 'rotY' | 'radius'
    >
  >;
} {
  const trees: Array<Pick<DestructibleTree, 'x' | 'z' | 'scale' | 'alive'>> = [];
  const props: Array<
    Pick<
      ActiveMapPropPhysics,
      'alive' | 'category' | 'kind' | 'scale' | 'x' | 'z' | 'halfX' | 'halfZ' | 'rotY' | 'radius'
    >
  > = [];

  for (const p of DEFAULT_ARENA_MAP_LAYOUT.props) {
    if (
      p.id === 491 ||
      isInsideSouthPlazaGlasshouseFootprint(p.x, p.z) ||
      isInsideCoastalAmusementParkFootprint(p.x, p.z) ||
      isInsideNorthGrandCasinoFootprint(p.x, p.z) ||
      isPointInsideCentralIslandEnvelope(p.x, p.z)
    ) {
      continue;
    }
    if (p.kind === 'tree_purple' || p.kind === 'tree_gold') {
      trees.push({ x: p.x, z: p.z, scale: p.scale, alive: true });
      continue;
    }
    const spec = getPropCollisionSpec(p.kind, p.scale);
    if (spec.category === 'solid') {
      void getPropBaseHeight(p.kind);
      props.push({
        alive: true,
        category: spec.category,
        kind: p.kind,
        scale: p.scale,
        x: p.x,
        z: p.z,
        halfX: spec.halfX,
        halfZ: spec.halfZ,
        rotY: p.rotY,
        radius: spec.radius,
      });
    }
  }
  return { trees, props };
}

function isInStaircaseCorridor(x: number, z: number): boolean {
  for (let i = 0; i < WORLD_STAIRCASE_CORRIDORS.length; i++) {
    const c = WORLD_STAIRCASE_CORRIDORS[i];
    if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) {
      return true;
    }
  }
  return false;
}

function isOceanBlockedAt(x: number, z: number): boolean {
  const waterSdf = evaluateSeHarborSdf(x, z).waterSdf;
  if (waterSdf >= 0.25) return false;
  if (isPointOnAmusementOverwaterPier(x, z) || isPointOnBeachfrontStiltCabinDeck(x, z)) {
    return false;
  }
  return true;
}

/**
 * Builds an audited 2D navigation grid over `[-125, +125]` (default `1.25m` cell size)
 * synchronized with static buildings, Central Park structures (Fountain, Lily Pond, Glow Studio,
 * Boutique, Cozy Cafe), Grand Casino, NW Oasis Lake, East Harbor/Ocean, Outer Embankment,
 * elevation staircase guards, trees, and solid map props.
 */
export function buildCityNavGrid(options: CityNavGridOptions = {}): CityNavGridHandle {
  const minX = options.minX ?? CITY_NAV_MIN_COORD;
  const maxX = options.maxX ?? CITY_NAV_MAX_COORD;
  const minZ = options.minZ ?? CITY_NAV_MIN_COORD;
  const maxZ = options.maxZ ?? CITY_NAV_MAX_COORD;
  const cellSize = options.cellSize ?? CITY_NAV_DEFAULT_CELL_SIZE;
  const mode = options.mode ?? 'foot';
  const worldMode: WorldMode = options.worldMode ?? 'safezone';
  const isSafezoneMode = options.isSafezoneMode ?? worldMode !== 'warzone';

  const staticStructures =
    options.staticStructures ?? createDefaultCityStaticStructures(isSafezoneMode);
  const audited = options.auditedWorld ?? getAuditedStaticWorldStructures(staticStructures);

  const defaults =
    options.trees && options.activeMapProps ? null : getDefaultTreesAndSolidProps();
  const trees = options.trees ?? defaults!.trees;
  const activeMapProps = options.activeMapProps ?? defaults!.props;

  const grid = createAStarNavGrid(minX, maxX, minZ, maxZ, cellSize);
  const totalCells = grid.cols * grid.rows;
  const elevations = new Float32Array(totalCells);
  const stairMask = new Uint8Array(totalCells);
  const cellCosts = new Float32Array(totalCells);
  const minCost = mode === 'scooter' ? 0.65 : 0.72;

  for (let row = 0; row < grid.rows; row++) {
    const wz = grid.minZ + (row + 0.5) * grid.cellSize;
    for (let col = 0; col < grid.cols; col++) {
      const wx = grid.minX + (col + 0.5) * grid.cellSize;
      const idx = row * grid.cols + col;
      elevations[idx] = getTerrainElevation(wx, wz);
      if (isInStaircaseCorridor(wx, wz)) {
        stairMask[idx] = 1;
      }

      if (
        evaluateOuterEmbankmentSdf(wx, wz) > -0.75 ||
        evaluateNwLakeSdf(wx, wz) < 0.25 ||
        isOceanBlockedAt(wx, wz) ||
        (worldMode === 'warzone' && isPointInsideLobbySafezone(wx, wz))
      ) {
        grid.blocked[idx] = 1;
        cellCosts[idx] = 1.0;
        continue;
      }

      const roadSdf = evaluateRoadNetworkSdf(wx, wz);
      const onCrosswalk = isPointOnPedestrianCrosswalkCorridor(wx, wz);
      if (mode === 'scooter') {
        if (roadSdf <= 0.25 || onCrosswalk) {
          cellCosts[idx] = 0.65;
        } else if (
          evaluateHaltePlatformSdf(wx, wz) <= 0.65 ||
          evaluateGrandCasinoPavedPlatformSdf(wx, wz) <= 0.55 ||
          isPointInsideCentralIslandEnvelope(wx, wz) ||
          (wx <= -74.0 && wx >= -110.75 && Math.abs(wz) <= 44.5)
        ) {
          cellCosts[idx] = 0.85;
        } else {
          cellCosts[idx] = 1.25;
        }
      } else {
        if (onCrosswalk) {
          cellCosts[idx] = 0.72;
        } else if (roadSdf <= 0.2) {
          cellCosts[idx] = 3.2;
        } else if (
          roadSdf <= 4.35 ||
          evaluateHaltePlatformSdf(wx, wz) <= 0.65 ||
          evaluateGrandCasinoPavedPlatformSdf(wx, wz) <= 0.55 ||
          isPointInsideCentralIslandEnvelope(wx, wz) ||
          (wx <= -74.0 && wx >= -110.75 && Math.abs(wz) <= 44.5) ||
          evaluateSeHarborSdf(wx, wz).concreteSdf <= 0.55
        ) {
          cellCosts[idx] = 0.78;
        } else {
          cellCosts[idx] = 1.02;
        }
      }
    }
  }

  grid.cellCosts = cellCosts;
  grid.minCellCost = minCost;

  // Rasterize audited OBBs (preserving open base gates)
  const obbs = audited.obbs;
  for (let i = 0; i < obbs.length; i++) {
    const st = obbs[i];
    if (st.id.endsWith('_gate')) continue;
    const isPole =
      st.id.startsWith('city_traffic_sign_') ||
      st.id.startsWith('city_lamp_') ||
      st.id.startsWith('traffic_signal_');
    const isThinRailOrFence =
      st.id.includes('_fence_') ||
      st.id.includes('_railing_') ||
      st.id.includes('_rail_') ||
      st.id.startsWith('gate_post_');
    const pad = isPole ? 0.32 : isThinRailOrFence ? 0.26 : 0.45;
    // Prevent thin railings/fences/walls (< 0.54 * cellSize half-thickness) from falling strictly
    // between two adjacent 1.25m cell centers and allowing A* to tunnel straight across them.
    const minBarrierHalf = grid.cellSize * 0.55 - pad;
    const effHalfX = isPole ? st.halfX : Math.max(st.halfX, minBarrierHalf);
    const effHalfZ = isPole ? st.halfZ : Math.max(st.halfZ, minBarrierHalf);
    rasterizeObbObstacleToNavGrid(grid, st.x, st.z, effHalfX, effHalfZ, st.rotY, pad);
  }

  // Rasterize audited circles (Fountain, Lily Pond, Bistro tables, Ontang-Anting, Botanical beds)
  const circles = audited.circles;
  for (let i = 0; i < circles.length; i++) {
    const c = circles[i];
    const pad = c.id.startsWith('central_park_bed_') ? 0.34 : 0.44;
    rasterizeCircleObstacleToNavGrid(grid, c.x, c.z, c.radius, pad);
  }

  // Rasterize living trees
  for (let i = 0; i < trees.length; i++) {
    const tr = trees[i];
    if (!tr.alive) continue;
    rasterizeCircleObstacleToNavGrid(grid, tr.x, tr.z, 0.88 * tr.scale, 0.36);
  }

  // Rasterize solid map props
  for (let i = 0; i < activeMapProps.length; i++) {
    const mp = activeMapProps[i];
    if (!mp.alive || mp.category !== 'solid') continue;
    if (mp.halfX !== undefined && mp.halfZ !== undefined) {
      rasterizeObbObstacleToNavGrid(grid, mp.x, mp.z, mp.halfX, mp.halfZ, mp.rotY, 0.42);
    } else {
      rasterizeCircleObstacleToNavGrid(grid, mp.x, mp.z, mp.radius, 0.38);
    }
  }

  return {
    grid,
    audited,
    elevations,
    stairMask,
    mode,
    worldMode,
  };
}

/**
 * Checks whether an exact world `(x, z)` is clear of water, outer embankment, and audited OBB/circle obstacles.
 */
export function isWorldPointStrictlyWalkable(
  nav: CityNavGridHandle,
  x: number,
  z: number,
  radius = 0.42,
): boolean {
  const { grid, audited, worldMode } = nav;
  if (x < grid.minX || x > grid.maxX || z < grid.minZ || z > grid.maxZ) return false;
  if (evaluateOuterEmbankmentSdf(x, z) > -0.75) return false;
  if (evaluateNwLakeSdf(x, z) < 0.28) return false;
  if (isOceanBlockedAt(x, z)) return false;
  if (worldMode === 'warzone' && isPointInsideLobbySafezone(x, z)) return false;

  for (let i = 0; i < audited.obbs.length; i++) {
    const st = audited.obbs[i];
    if (st.id.endsWith('_gate')) continue;
    if (pointInObb2D(x, z, st.x, st.z, st.halfX, st.halfZ, st.rotY, radius)) {
      return false;
    }
  }
  for (let i = 0; i < audited.circles.length; i++) {
    const c = audited.circles[i];
    const minD = c.radius + radius;
    const dx = x - c.x;
    const dz = z - c.z;
    if (dx * dx + dz * dz < minD * minD) return false;
  }
  return true;
}

/**
 * Snaps an arbitrary world point (e.g. a minimap click inside a building, fountain, Oasis Lake, or ocean)
 * to the nearest valid walkable grid/sidewalk/promenade coordinate.
 */
export function snapWorldPointToWalkable(
  nav: CityNavGridHandle,
  rawX: number,
  rawZ: number,
  options?: {
    maxSearchRadiusM?: number;
    preferApproachX?: number;
    preferApproachZ?: number;
    exemptSeatPoint?: { x: number; z: number } | null;
  },
): CitySnapPointResult {
  const { grid } = nav;
  const clampedX = clamp(
    Number.isFinite(rawX) ? rawX : 0,
    grid.minX + 0.5,
    grid.maxX - 0.5,
  );
  const clampedZ = clamp(
    Number.isFinite(rawZ) ? rawZ : 0,
    grid.minZ + 0.5,
    grid.maxZ - 0.5,
  );

  const exactCell = worldToNavGridCell(grid, clampedX, clampedZ);
  const exactIdx = exactCell.gz * grid.cols + exactCell.gx;
  const checkStrict = (px: number, pz: number): boolean => {
    if (isWorldPointStrictlyWalkable(nav, px, pz, 0.36)) return true;
    if (options?.exemptSeatPoint) {
      if (Math.hypot(px - options.exemptSeatPoint.x, pz - options.exemptSeatPoint.z) <= 1.2) {
        return evaluateNwLakeSdf(px, pz) >= 0.25 && !isOceanBlockedAt(px, pz);
      }
    }
    return false;
  };

  if (grid.blocked[exactIdx] === 0 && checkStrict(clampedX, clampedZ)) {
    return {
      x: clampedX,
      z: clampedZ,
      snapped: Math.hypot(clampedX - rawX, clampedZ - rawZ) > 0.01,
      rawX,
      rawZ,
      snapDistanceM: Math.hypot(clampedX - rawX, clampedZ - rawZ),
    };
  }

  const maxSearchM = options?.maxSearchRadiusM ?? 58.0;
  const maxCells = Math.min(
    Math.max(grid.cols, grid.rows),
    Math.max(8, Math.ceil(maxSearchM / grid.cellSize)),
  );
  const rawRefElev = getTerrainElevation(clampedX, clampedZ);
  let bestScore = Infinity;
  let bestX = clampedX;
  let bestZ = clampedZ;
  let found = false;

  for (let r = 0; r <= maxCells; r++) {
    const minGx = Math.max(0, exactCell.gx - r);
    const maxGx = Math.min(grid.cols - 1, exactCell.gx + r);
    const minGz = Math.max(0, exactCell.gz - r);
    const maxGz = Math.min(grid.rows - 1, exactCell.gz + r);
    for (let gz = minGz; gz <= maxGz; gz++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        if (r > 0 && Math.abs(gx - exactCell.gx) !== r && Math.abs(gz - exactCell.gz) !== r) {
          continue;
        }
        const idx = gz * grid.cols + gx;
        if (grid.blocked[idx] !== 0) continue;
        const pos = navGridCellToWorld(grid, gx, gz);
        const dist = Math.hypot(pos.x - clampedX, pos.z - clampedZ);
        let score = dist;
        if (options?.preferApproachX !== undefined && options?.preferApproachZ !== undefined) {
          score += Math.hypot(pos.x - options.preferApproachX, pos.z - options.preferApproachZ) * 0.03;
        }
        // Subtle tie-break toward ground level if click fell inside a raised building box vs ocean
        if (Math.abs(nav.elevations[idx] - rawRefElev) > 3.5) {
          score += 0.2;
        }
        if (score >= bestScore) continue;
        if (!checkStrict(pos.x, pos.z)) continue;
        bestScore = score;
        bestX = pos.x;
        bestZ = pos.z;
        found = true;
      }
    }
    if (found && r * grid.cellSize > bestScore + grid.cellSize * 2) {
      break;
    }
  }

  return {
    x: bestX,
    z: bestZ,
    snapped: true,
    rawX,
    rawZ,
    snapDistanceM: Math.hypot(bestX - rawX, bestZ - rawZ),
  };
}

// Preallocated reusable A* typed buffers for fast cross-map planning
class NavMinHeap {
  private indices: Int32Array;
  private fScores: Float32Array;
  private hScores: Float32Array;
  public size = 0;

  constructor(capacity = 4096) {
    this.indices = new Int32Array(capacity);
    this.fScores = new Float32Array(capacity);
    this.hScores = new Float32Array(capacity);
  }

  clear(): void {
    this.size = 0;
  }

  push(idx: number, f: number, h: number): void {
    if (this.size >= this.indices.length) {
      const nextCap = this.indices.length * 2;
      const nextIdx = new Int32Array(nextCap);
      nextIdx.set(this.indices);
      this.indices = nextIdx;
      const nextF = new Float32Array(nextCap);
      nextF.set(this.fScores);
      this.fScores = nextF;
      const nextH = new Float32Array(nextCap);
      nextH.set(this.hScores);
      this.hScores = nextH;
    }
    let i = this.size++;
    this.indices[i] = idx;
    this.fScores[i] = f;
    this.hScores[i] = h;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (
        this.fScores[p] < this.fScores[i] ||
        (this.fScores[p] === this.fScores[i] && this.hScores[p] <= this.hScores[i])
      ) {
        break;
      }
      this.swap(i, p);
      i = p;
    }
  }

  pop(): { idx: number; f: number; h: number } | undefined {
    if (this.size === 0) return undefined;
    const idx = this.indices[0];
    const f = this.fScores[0];
    const h = this.hScores[0];
    const last = --this.size;
    if (last > 0) {
      this.indices[0] = this.indices[last];
      this.fScores[0] = this.fScores[last];
      this.hScores[0] = this.hScores[last];
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let smallest = i;
        if (
          l < this.size &&
          (this.fScores[l] < this.fScores[smallest] ||
            (this.fScores[l] === this.fScores[smallest] &&
              this.hScores[l] < this.hScores[smallest]))
        ) {
          smallest = l;
        }
        if (
          r < this.size &&
          (this.fScores[r] < this.fScores[smallest] ||
            (this.fScores[r] === this.fScores[smallest] &&
              this.hScores[r] < this.hScores[smallest]))
        ) {
          smallest = r;
        }
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return { idx, f, h };
  }

  private swap(a: number, b: number): void {
    const ti = this.indices[a];
    this.indices[a] = this.indices[b];
    this.indices[b] = ti;
    const tf = this.fScores[a];
    this.fScores[a] = this.fScores[b];
    this.fScores[b] = tf;
    const th = this.hScores[a];
    this.hScores[a] = this.hScores[b];
    this.hScores[b] = th;
  }
}

let sharedGScore = new Float32Array(0);
let sharedParent = new Int32Array(0);
let sharedClosed = new Uint8Array(0);
const sharedHeap = new NavMinHeap(8192);

function ensureCityAStarBuffers(totalCells: number): void {
  if (sharedGScore.length < totalCells) {
    sharedGScore = new Float32Array(totalCells);
    sharedParent = new Int32Array(totalCells);
    sharedClosed = new Uint8Array(totalCells);
  }
  sharedGScore.fill(Infinity, 0, totalCells);
  sharedParent.fill(-1, 0, totalCells);
  sharedClosed.fill(0, 0, totalCells);
  sharedHeap.clear();
}

const DIRS_8WAY: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 1.0],
  [-1, 0, 1.0],
  [0, 1, 1.0],
  [0, -1, 1.0],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

function octileDistance(ax: number, az: number, bx: number, bz: number): number {
  const dx = Math.abs(ax - bx);
  const dz = Math.abs(az - bz);
  return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
}

/**
 * Fast elevation-aware A* over `CityNavGridHandle` using pooled typed buffers.
 * Never crosses retaining-wall vertical drops (`> 0.92m`, or `> 1.45m` in staircase corridors).
 */
export function findCityPathAStar(
  nav: CityNavGridHandle,
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number,
  options?: { maxIterations?: number },
): {
  waypoints: Array<{ x: number; z: number }>;
  reachedGoal: boolean;
  expandedCount: number;
  totalCost: number;
} {
  const { grid, elevations, stairMask } = nav;
  const cols = grid.cols;
  const rows = grid.rows;
  const totalCells = cols * rows;
  const maxIterations = options?.maxIterations ?? 45000;
  const hScale = grid.cellCosts ? Math.max(0.05, grid.minCellCost ?? 1.0) : 1.0;

  const rawStart = worldToNavGridCell(grid, startX, startZ);
  const rawGoal = worldToNavGridCell(grid, goalX, goalZ);
  const startIdx = rawStart.gz * cols + rawStart.gx;
  const goalIdx = rawGoal.gz * cols + rawGoal.gx;

  if (grid.blocked[startIdx] !== 0 || grid.blocked[goalIdx] !== 0) {
    return {
      waypoints: [{ x: goalX, z: goalZ }],
      reachedGoal: false,
      expandedCount: 0,
      totalCost: Infinity,
    };
  }

  if (startIdx === goalIdx) {
    return {
      waypoints: [{ x: goalX, z: goalZ }],
      reachedGoal: true,
      expandedCount: 1,
      totalCost: 0,
    };
  }

  ensureCityAStarBuffers(totalCells);
  const hStart = octileDistance(rawStart.gx, rawStart.gz, rawGoal.gx, rawGoal.gz) * hScale;
  sharedGScore[startIdx] = 0;
  sharedHeap.push(startIdx, hStart, hStart);

  let expandedCount = 0;
  let reachedGoal = false;
  let bestFallbackIdx = startIdx;
  let bestFallbackH = hStart;

  while (sharedHeap.size > 0 && expandedCount < maxIterations) {
    const cur = sharedHeap.pop()!;
    const currIdx = cur.idx;
    if (sharedClosed[currIdx] !== 0) continue;
    sharedClosed[currIdx] = 1;
    expandedCount++;

    if (cur.h < bestFallbackH) {
      bestFallbackH = cur.h;
      bestFallbackIdx = currIdx;
    }

    if (currIdx === goalIdx) {
      reachedGoal = true;
      bestFallbackIdx = goalIdx;
      break;
    }

    const cx = currIdx % cols;
    const cz = (currIdx / cols) | 0;
    const currG = sharedGScore[currIdx];
    const currElev = elevations[currIdx];
    const currStair = stairMask[currIdx];

    for (let di = 0; di < DIRS_8WAY.length; di++) {
      const [dx, dz, stepCost] = DIRS_8WAY[di];
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 0 || nx >= cols || nz < 0 || nz >= rows) continue;
      const nIdx = nz * cols + nx;
      if (sharedClosed[nIdx] !== 0 || grid.blocked[nIdx] !== 0) continue;

      if (dx !== 0 && dz !== 0) {
        if (grid.blocked[cz * cols + (cx + dx)] !== 0 || grid.blocked[(cz + dz) * cols + cx] !== 0) {
          continue;
        }
      }

      const maxStep = currStair || stairMask[nIdx] ? 1.45 : 0.92;
      if (Math.abs(elevations[nIdx] - currElev) > maxStep) {
        continue;
      }

      const costScale = grid.cellCosts
        ? 0.5 * (grid.cellCosts[currIdx] + grid.cellCosts[nIdx])
        : 1.0;
      const tentativeG = currG + stepCost * costScale;
      if (tentativeG + 1e-6 < sharedGScore[nIdx]) {
        sharedGScore[nIdx] = tentativeG;
        sharedParent[nIdx] = currIdx;
        const h = octileDistance(nx, nz, rawGoal.gx, rawGoal.gz) * hScale;
        sharedHeap.push(nIdx, tentativeG + h, h);
      }
    }
  }

  const targetIdx = reachedGoal ? goalIdx : bestFallbackIdx;
  const revIndices: number[] = [];
  let trace = targetIdx;
  let safety = 0;
  while (trace !== -1 && safety <= totalCells) {
    revIndices.push(trace);
    if (trace === startIdx) break;
    trace = sharedParent[trace];
    safety++;
  }
  revIndices.reverse();

  const waypoints: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < revIndices.length; i++) {
    if (i === 0 && revIndices.length > 1) continue;
    const idx = revIndices[i];
    const gx = idx % cols;
    const gz = (idx / cols) | 0;
    waypoints.push(navGridCellToWorld(grid, gx, gz));
  }
  if (reachedGoal && waypoints.length > 0) {
    waypoints[waypoints.length - 1] = { x: goalX, z: goalZ };
  }

  return {
    waypoints,
    reachedGoal,
    expandedCount,
    totalCost: sharedGScore[targetIdx],
  };
}

function checkCitySegmentGridFast(
  nav: CityNavGridHandle,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  maxAllowedCellCost: number,
): boolean {
  const { grid, elevations, stairMask } = nav;
  const dx = bx - ax;
  const dz = bz - az;
  const segLen = Math.hypot(dx, dz);
  if (segLen <= 0.05) return true;

  const invLen = 1 / segLen;
  const perpX = -dz * invLen;
  const perpZ = dx * invLen;
  const stepDist = Math.max(0.45, grid.cellSize * 0.45);
  const steps = Math.max(2, Math.ceil(segLen / stepDist));
  const c0 = worldToNavGridCell(grid, ax, az);
  const idx0 = c0.gz * grid.cols + c0.gx;
  let prevElev = elevations[idx0];
  let prevInStair = stairMask[idx0] !== 0;

  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const px = ax + dx * t;
    const pz = az + dz * t;
    const cCenter = worldToNavGridCell(grid, px, pz);
    const idxCenter = cCenter.gz * grid.cols + cCenter.gx;
    if (grid.blocked[idxCenter] !== 0) return false;
    if (s < steps && grid.cellCosts && grid.cellCosts[idxCenter] > maxAllowedCellCost) {
      return false;
    }

    const curElev = elevations[idxCenter];
    const curInStair = stairMask[idxCenter] !== 0;
    const maxStep = prevInStair || curInStair ? 1.45 : 0.92;
    if (Math.abs(curElev - prevElev) > maxStep) {
      return false;
    }
    prevElev = curElev;
    prevInStair = curInStair;

    if (s < steps) {
      for (const offset of [0.4, -0.4] as const) {
        const cLat = worldToNavGridCell(grid, px + perpX * offset, pz + perpZ * offset);
        const idxLat = cLat.gz * grid.cols + cLat.gx;
        if (grid.blocked[idxLat] !== 0) return false;
        if (grid.cellCosts && grid.cellCosts[idxLat] > maxAllowedCellCost) {
          return false;
        }
      }
    }
  }
  return true;
}

function checkCitySegmentContinuous(
  nav: CityNavGridHandle,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): boolean {
  const { grid, audited } = nav;
  const dx = bx - ax;
  const dz = bz - az;
  const segLen = Math.hypot(dx, dz);
  if (segLen <= 0.05) return true;

  if (
    !isSegmentClearOfAuditedStaticObstacles2D({
      fromX: ax,
      fromZ: az,
      toX: bx,
      toZ: bz,
      radius: 0.48,
      audited,
    })
  ) {
    return false;
  }

  const stepDist = Math.max(0.85, grid.cellSize * 0.75);
  const steps = Math.max(2, Math.ceil(segLen / stepDist));
  let prevElev = getTerrainElevation(ax, az);
  let prevInStair = isInStaircaseCorridor(ax, az);

  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const px = ax + dx * t;
    const pz = az + dz * t;

    if (
      evaluateOuterEmbankmentSdf(px, pz) > -0.75 ||
      evaluateNwLakeSdf(px, pz) < 0.25 ||
      isOceanBlockedAt(px, pz)
    ) {
      return false;
    }

    const curElev = getTerrainElevation(px, pz);
    const curInStair = isInStaircaseCorridor(px, pz);
    const maxStep = prevInStair || curInStair ? 1.45 : 0.92;
    if (Math.abs(curElev - prevElev) > maxStep) {
      return false;
    }
    prevElev = curElev;
    prevInStair = curInStair;
  }
  return true;
}

/**
 * Line-of-sight string-pulling smoother over A* waypoints, honoring audited OBBs, circular basins,
 * water boundaries, retaining-wall elevation drops, and sidewalk/road cost budgets.
 */
export function smoothCityWaypoints(
  nav: CityNavGridHandle,
  startX: number,
  startZ: number,
  rawWaypoints: ReadonlyArray<{ x: number; z: number }>,
): Array<{ x: number; z: number }> {
  if (rawWaypoints.length <= 2) {
    return rawWaypoints.map((w) => ({ x: w.x, z: w.z }));
  }
  const { grid } = nav;
  const pts: Array<{ x: number; z: number }> = [{ x: startX, z: startZ }, ...rawWaypoints];
  const nodeCosts = grid.cellCosts
    ? pts.map((p) => {
        const c = worldToNavGridCell(grid, p.x, p.z);
        return grid.cellCosts![c.gz * grid.cols + c.gx];
      })
    : null;

  const smoothed: Array<{ x: number; z: number }> = [];
  let anchor = 0;
  const passingCands: number[] = [];
  while (anchor < pts.length - 1) {
    passingCands.length = 0;
    let spanMaxCost = nodeCosts ? nodeCosts[anchor] : 1.0;
    for (let cand = anchor + 2; cand < pts.length; cand++) {
      if (nodeCosts) {
        spanMaxCost = Math.max(spanMaxCost, nodeCosts[cand - 1]);
      }
      const endCost = nodeCosts ? Math.max(spanMaxCost, nodeCosts[cand]) : 1.0;
      const maxAllowed = endCost * 1.15 + 0.15;
      if (
        checkCitySegmentGridFast(
          nav,
          pts[anchor].x,
          pts[anchor].z,
          pts[cand].x,
          pts[cand].z,
          maxAllowed,
        )
      ) {
        passingCands.push(cand);
      }
    }

    let farthest = anchor + 1;
    for (let i = passingCands.length - 1; i >= 0; i--) {
      const cand = passingCands[i];
      if (
        checkCitySegmentContinuous(
          nav,
          pts[anchor].x,
          pts[anchor].z,
          pts[cand].x,
          pts[cand].z,
        )
      ) {
        farthest = cand;
        break;
      }
    }

    smoothed.push({ x: pts[farthest].x, z: pts[farthest].z });
    anchor = farthest;
  }
  return smoothed;
}

/**
 * Computes total Euclidean polyline distance from `(startX, startZ)` across `waypoints[fromIndex..]`.
 */
export function computeRoutePolylineLength(
  startX: number,
  startZ: number,
  waypoints: ReadonlyArray<{ x: number; z: number }>,
  fromIndex = 0,
): number {
  if (waypoints.length === 0 || fromIndex >= waypoints.length) return 0;
  let total = 0;
  let prevX = startX;
  let prevZ = startZ;
  for (let i = Math.max(0, fromIndex); i < waypoints.length; i++) {
    total += Math.hypot(waypoints[i].x - prevX, waypoints[i].z - prevZ);
    prevX = waypoints[i].x;
    prevZ = waypoints[i].z;
  }
  return total;
}

/**
 * Plans a long-distance collision-free multi-waypoint route across the entire city (`[-125, +125]`),
 * snapping invalid/blocked clicks inside buildings, fountains, Oasis Lake, or ocean to the nearest clear point.
 */
export function planCityClickToWalkRoute(
  nav: CityNavGridHandle,
  startX: number,
  startZ: number,
  rawGoalX: number,
  rawGoalZ: number,
  options?: {
    exemptSeatPoint?: { x: number; z: number } | null;
    maxIterations?: number;
  },
): CityRoutePlanResult {
  const snappedStart = snapWorldPointToWalkable(nav, startX, startZ, {
    maxSearchRadiusM: 18,
  });
  const snappedGoal = snapWorldPointToWalkable(nav, rawGoalX, rawGoalZ, {
    maxSearchRadiusM: 58,
    preferApproachX: snappedStart.x,
    preferApproachZ: snappedStart.z,
    exemptSeatPoint: options?.exemptSeatPoint,
  });

  const aStar = findCityPathAStar(
    nav,
    snappedStart.x,
    snappedStart.z,
    snappedGoal.x,
    snappedGoal.z,
    { maxIterations: options?.maxIterations ?? 45000 },
  );

  const smoothed = smoothCityWaypoints(
    nav,
    snappedStart.x,
    snappedStart.z,
    aStar.waypoints,
  );
  const waypoints: ClickToWalkWaypoint[] = smoothed.map((w) => ({ x: w.x, z: w.z }));
  const totalDistanceM = computeRoutePolylineLength(startX, startZ, waypoints, 0);

  return {
    reachable: aStar.reachedGoal,
    snapped: snappedGoal.snapped,
    startX: snappedStart.x,
    startZ: snappedStart.z,
    rawTargetX: rawGoalX,
    rawTargetZ: rawGoalZ,
    targetX: snappedGoal.x,
    targetZ: snappedGoal.z,
    waypoints,
    totalDistanceM,
    expandedCount: aStar.expandedCount,
  };
}

// =============================================================================
// INTERIOR NAVIGATION (CAFÉ, GRAND CASINO, 2-STORY BEAUTY SALON, HOUSE VISIT)
// =============================================================================

interface InteriorGridSpec {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  cellSize: number;
  colliders: ReadonlyArray<{ x: number; z: number; hw: number; hd: number; ry: number }>;
  clampFn: (x: number, z: number) => { x: number; z: number };
}

function buildInteriorNavGrid(spec: InteriorGridSpec, pad = 0.34): AStarNavGrid {
  const grid = createAStarNavGrid(spec.minX, spec.maxX, spec.minZ, spec.maxZ, spec.cellSize);
  for (let row = 0; row < grid.rows; row++) {
    const wz = grid.minZ + (row + 0.5) * grid.cellSize;
    for (let col = 0; col < grid.cols; col++) {
      const wx = grid.minX + (col + 0.5) * grid.cellSize;
      const clamped = spec.clampFn(wx, wz);
      if (Math.hypot(clamped.x - wx, clamped.z - wz) > 0.14) {
        grid.blocked[row * grid.cols + col] = 1;
      }
    }
  }
  for (let i = 0; i < spec.colliders.length; i++) {
    const c = spec.colliders[i];
    rasterizeObbObstacleToNavGrid(grid, c.x, c.z, c.hw, c.hd, c.ry, pad);
  }
  return grid;
}

function snapInteriorPoint(
  grid: AStarNavGrid,
  clampFn: (x: number, z: number) => { x: number; z: number },
  rawX: number,
  rawZ: number,
): { x: number; z: number; snapped: boolean } {
  const c = clampFn(rawX, rawZ);
  const startCell = worldToNavGridCell(grid, c.x, c.z);
  const sIdx = startCell.gz * grid.cols + startCell.gx;
  if (grid.blocked[sIdx] === 0) {
    return { x: c.x, z: c.z, snapped: Math.hypot(c.x - rawX, c.z - rawZ) > 0.02 };
  }
  let bestDist = Infinity;
  let bestX = c.x;
  let bestZ = c.z;
  for (let gz = 0; gz < grid.rows; gz++) {
    for (let gx = 0; gx < grid.cols; gx++) {
      if (grid.blocked[gz * grid.cols + gx] !== 0) continue;
      const p = navGridCellToWorld(grid, gx, gz);
      const d = Math.hypot(p.x - c.x, p.z - c.z);
      if (d < bestDist) {
        bestDist = d;
        bestX = p.x;
        bestZ = p.z;
      }
    }
  }
  return { x: bestX, z: bestZ, snapped: true };
}

function runInteriorGridAStar(
  grid: AStarNavGrid,
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number,
  floorY?: number,
): { waypoints: ClickToWalkWaypoint[]; reached: boolean } {
  const sCell = worldToNavGridCell(grid, startX, startZ);
  const gCell = worldToNavGridCell(grid, goalX, goalZ);
  const cols = grid.cols;
  const total = cols * grid.rows;
  const sIdx = sCell.gz * cols + sCell.gx;
  const gIdx = gCell.gz * cols + gCell.gx;

  if (sIdx === gIdx || grid.blocked[sIdx] !== 0 || grid.blocked[gIdx] !== 0) {
    return {
      waypoints: [{ x: goalX, z: goalZ, floorY }],
      reached: grid.blocked[gIdx] === 0,
    };
  }

  ensureCityAStarBuffers(total);
  const h0 = octileDistance(sCell.gx, sCell.gz, gCell.gx, gCell.gz);
  sharedGScore[sIdx] = 0;
  sharedHeap.push(sIdx, h0, h0);
  let reached = false;
  let bestIdx = sIdx;
  let bestH = h0;
  let iters = 0;

  while (sharedHeap.size > 0 && iters < 6000) {
    const cur = sharedHeap.pop()!;
    if (sharedClosed[cur.idx] !== 0) continue;
    sharedClosed[cur.idx] = 1;
    iters++;
    if (cur.h < bestH) {
      bestH = cur.h;
      bestIdx = cur.idx;
    }
    if (cur.idx === gIdx) {
      reached = true;
      bestIdx = gIdx;
      break;
    }
    const cx = cur.idx % cols;
    const cz = (cur.idx / cols) | 0;
    const cg = sharedGScore[cur.idx];
    for (let di = 0; di < DIRS_8WAY.length; di++) {
      const [dx, dz, stepCost] = DIRS_8WAY[di];
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 0 || nx >= cols || nz < 0 || nz >= grid.rows) continue;
      const nIdx = nz * cols + nx;
      if (sharedClosed[nIdx] !== 0 || grid.blocked[nIdx] !== 0) continue;
      if (dx !== 0 && dz !== 0) {
        if (grid.blocked[cz * cols + (cx + dx)] !== 0 || grid.blocked[(cz + dz) * cols + cx] !== 0) {
          continue;
        }
      }
      const ng = cg + stepCost;
      if (ng + 1e-6 < sharedGScore[nIdx]) {
        sharedGScore[nIdx] = ng;
        sharedParent[nIdx] = cur.idx;
        const h = octileDistance(nx, nz, gCell.gx, gCell.gz);
        sharedHeap.push(nIdx, ng + h, h);
      }
    }
  }

  const endIdx = reached ? gIdx : bestIdx;
  const rev: number[] = [];
  let trace = endIdx;
  let guard = 0;
  while (trace !== -1 && guard <= total) {
    rev.push(trace);
    if (trace === sIdx) break;
    trace = sharedParent[trace];
    guard++;
  }
  rev.reverse();

  const rawPts: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < rev.length; i++) {
    if (i === 0 && rev.length > 1) continue;
    const gx = rev[i] % cols;
    const gz = (rev[i] / cols) | 0;
    rawPts.push(navGridCellToWorld(grid, gx, gz));
  }
  if (reached && rawPts.length > 0) {
    rawPts[rawPts.length - 1] = { x: goalX, z: goalZ };
  }

  // Smooth interior grid zigzags
  const pts = [{ x: startX, z: startZ }, ...rawPts];
  const smoothed: ClickToWalkWaypoint[] = [];
  let anchor = 0;
  while (anchor < pts.length - 1) {
    let farthest = anchor + 1;
    for (let cand = anchor + 2; cand < pts.length; cand++) {
      const ax = pts[anchor].x;
      const az = pts[anchor].z;
      const bx = pts[cand].x;
      const bz = pts[cand].z;
      const len = Math.hypot(bx - ax, bz - az);
      const steps = Math.max(2, Math.ceil(len / 0.18));
      let clear = true;
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const px = ax + (bx - ax) * t;
        const pz = az + (bz - az) * t;
        const cell = worldToNavGridCell(grid, px, pz);
        if (grid.blocked[cell.gz * cols + cell.gx] !== 0) {
          clear = false;
          break;
        }
      }
      if (clear) farthest = cand;
    }
    smoothed.push({ x: pts[farthest].x, z: pts[farthest].z, floorY });
    anchor = farthest;
  }
  if (smoothed.length === 0) {
    smoothed.push({ x: goalX, z: goalZ, floorY });
  }
  return { waypoints: smoothed, reached };
}

const SALON_STAIR_1F_MOUTH = { x: -0.45, z: -2.52, floorY: 0.0 };
const SALON_STAIR_2F_MOUTH = { x: -0.45, z: -4.38, floorY: 3.0 };

// Incremental step waypoints along the U-turn staircase (keeps per-step climb <= ~0.55m for
// both gradual elevation clamping and smooth 3D staircase breadcrumb chevron heights).
const SALON_STAIR_ASCENT_STEPS: ReadonlyArray<ClickToWalkWaypoint> = [
  SALON_STAIR_1F_MOUTH,
  { x: -1.65, z: -2.52, floorY: 0.05 },
  { x: -2.35, z: -2.52, floorY: 0.45 },
  { x: -3.05, z: -2.52, floorY: 0.90 },
  { x: -3.55, z: -2.52, floorY: 1.25 },
  { x: -3.95, z: -2.52, floorY: 1.50 },
  { x: -3.95, z: -3.45, floorY: 1.50 },
  { x: -3.95, z: -4.38, floorY: 1.50 },
  { x: -3.45, z: -4.38, floorY: 1.50 },
  { x: -2.75, z: -4.38, floorY: 1.82 },
  { x: -2.05, z: -4.38, floorY: 2.25 },
  { x: -1.35, z: -4.38, floorY: 2.68 },
  SALON_STAIR_2F_MOUTH,
];

function sliceSalonStairSteps(
  ascending: boolean,
  onStairsNow: boolean,
  startX: number,
  startZ: number,
): ClickToWalkWaypoint[] {
  const ordered = ascending ? SALON_STAIR_ASCENT_STEPS : [...SALON_STAIR_ASCENT_STEPS].reverse();
  if (!onStairsNow) {
    return ordered.map((w) => ({ ...w }));
  }
  let closestIdx = 0;
  let closestDist = Infinity;
  for (let i = 0; i < ordered.length; i++) {
    const d = Math.hypot(ordered[i].x - startX, ordered[i].z - startZ);
    if (d < closestDist) {
      closestDist = d;
      closestIdx = i;
    }
  }
  return ordered.slice(Math.min(ordered.length - 1, closestIdx + 1)).map((w) => ({ ...w }));
}

/**
 * Computes room-safe interior click-to-walk routes for Glasshouse Cafe, Grand Casino,
 * 2-Story Beauty Salon (including automatic U-turn staircase climbs between 1F and 2F),
 * and Private House visits without ever warping outside walls.
 */
export function planInteriorClickToWalkRoute(params: {
  room: InteriorRoomKind;
  startX: number;
  startZ: number;
  startFloorY?: number;
  goalX: number;
  goalZ: number;
  goalFloorY?: number;
  cafeWorkShiftActive?: boolean;
  houseColliders?: ReadonlyArray<{
    id?: string;
    x: number;
    z: number;
    hw: number;
    hd: number;
    ry: number;
  }>;
  exemptSeatId?: string | null;
}): InteriorRoutePlanResult {
  const { room, startX, startZ, goalX, goalZ } = params;

  if (room === 'salon_interior') {
    const startY = params.startFloorY ?? 0;
    const goalY = params.goalFloorY ?? 0;
    const startOn2F = startY >= 1.95;
    const goalOn2F = goalY >= 1.95;
    const onStairsNow = startY >= 0.45 && startY < 1.95;

    const filterSalonColliders = (level: '1f' | '2f') =>
      SALON_INTERIOR_COLLIDERS.filter(
        (c) =>
          (c.floorLevel === 'all' || c.floorLevel === level) &&
          (!params.exemptSeatId || !c.id.includes(params.exemptSeatId)),
      );

    const grid1F = buildInteriorNavGrid({
      minX: SALON_INTERIOR_BOUNDS.minX,
      maxX: SALON_INTERIOR_BOUNDS.maxX,
      minZ: SALON_INTERIOR_BOUNDS.minZ,
      maxZ: SALON_INTERIOR_BOUNDS.maxZ,
      cellSize: 0.32,
      colliders: filterSalonColliders('1f'),
      clampFn: (x, z) => clampSalonInteriorPosition(x, z, 0),
    });
    const grid2F = buildInteriorNavGrid({
      minX: SALON_INTERIOR_BOUNDS.minX,
      maxX: SALON_INTERIOR_BOUNDS.maxX,
      minZ: SALON_INTERIOR_BOUNDS.minZ,
      maxZ: SALON_INTERIOR_BOUNDS.maxZ,
      cellSize: 0.32,
      colliders: filterSalonColliders('2f'),
      clampFn: (x, z) => clampSalonInteriorPosition(x, z, SALON_INTERIOR_BOUNDS.secondFloorY),
    });

    const targetGrid = goalOn2F ? grid2F : grid1F;
    const targetClamp = (x: number, z: number) =>
      clampSalonInteriorPosition(x, z, goalOn2F ? SALON_INTERIOR_BOUNDS.secondFloorY : 0);
    const snappedGoal = snapInteriorPoint(targetGrid, targetClamp, goalX, goalZ);
    const targetFloorY = goalOn2F ? SALON_INTERIOR_BOUNDS.secondFloorY : 0;

    if (!onStairsNow && startOn2F === goalOn2F) {
      const activeGrid = startOn2F ? grid2F : grid1F;
      const startClamp = (x: number, z: number) =>
        clampSalonInteriorPosition(x, z, startOn2F ? SALON_INTERIOR_BOUNDS.secondFloorY : 0);
      const snappedStart = snapInteriorPoint(activeGrid, startClamp, startX, startZ);
      const res = runInteriorGridAStar(
        activeGrid,
        snappedStart.x,
        snappedStart.z,
        snappedGoal.x,
        snappedGoal.z,
        targetFloorY,
      );
      return {
        reachable: res.reached,
        snapped: snappedGoal.snapped,
        targetX: snappedGoal.x,
        targetZ: snappedGoal.z,
        targetFloorY,
        waypoints: res.waypoints,
        totalDistanceM: computeRoutePolylineLength(startX, startZ, res.waypoints),
      };
    }

    // Multi-story transition via U-turn staircase
    const combined: ClickToWalkWaypoint[] = [];
    if (goalOn2F) {
      if (onStairsNow) {
        combined.push(...sliceSalonStairSteps(true, true, startX, startZ));
      } else {
        const s1 = snapInteriorPoint(
          grid1F,
          (x, z) => clampSalonInteriorPosition(x, z, 0),
          startX,
          startZ,
        );
        const leg1 = runInteriorGridAStar(
          grid1F,
          s1.x,
          s1.z,
          SALON_STAIR_1F_MOUTH.x,
          SALON_STAIR_1F_MOUTH.z,
          0,
        );
        combined.push(...leg1.waypoints);
        combined.push(...sliceSalonStairSteps(true, false, startX, startZ).slice(1));
      }
      const leg2 = runInteriorGridAStar(
        grid2F,
        SALON_STAIR_2F_MOUTH.x,
        SALON_STAIR_2F_MOUTH.z,
        snappedGoal.x,
        snappedGoal.z,
        SALON_INTERIOR_BOUNDS.secondFloorY,
      );
      combined.push(...leg2.waypoints);
    } else {
      if (onStairsNow) {
        combined.push(...sliceSalonStairSteps(false, true, startX, startZ));
      } else {
        const s2 = snapInteriorPoint(
          grid2F,
          (x, z) => clampSalonInteriorPosition(x, z, SALON_INTERIOR_BOUNDS.secondFloorY),
          startX,
          startZ,
        );
        const leg1 = runInteriorGridAStar(
          grid2F,
          s2.x,
          s2.z,
          SALON_STAIR_2F_MOUTH.x,
          SALON_STAIR_2F_MOUTH.z,
          SALON_INTERIOR_BOUNDS.secondFloorY,
        );
        combined.push(...leg1.waypoints);
        combined.push(...sliceSalonStairSteps(false, false, startX, startZ).slice(1));
      }
      const leg2 = runInteriorGridAStar(
        grid1F,
        SALON_STAIR_1F_MOUTH.x,
        SALON_STAIR_1F_MOUTH.z,
        snappedGoal.x,
        snappedGoal.z,
        0,
      );
      combined.push(...leg2.waypoints);
    }

    return {
      reachable: true,
      snapped: snappedGoal.snapped,
      targetX: snappedGoal.x,
      targetZ: snappedGoal.z,
      targetFloorY,
      waypoints: combined,
      totalDistanceM: computeRoutePolylineLength(startX, startZ, combined),
    };
  }

  let spec: InteriorGridSpec;
  if (room === 'cafe_interior') {
    const clampFn = params.cafeWorkShiftActive
      ? (x: number, z: number) => clampCafeBaristaWorkShiftPosition(x, z)
      : (x: number, z: number) => clampCafeInteriorPosition(x, z);
    spec = {
      minX: CAFE_INTERIOR_BOUNDS.minX,
      maxX: CAFE_INTERIOR_BOUNDS.maxX,
      minZ: CAFE_INTERIOR_BOUNDS.minZ,
      maxZ: CAFE_INTERIOR_BOUNDS.maxZ,
      cellSize: 0.32,
      colliders: params.cafeWorkShiftActive
        ? []
        : CAFE_INTERIOR_COLLIDERS.filter(
            (c) => !params.exemptSeatId || !c.id.includes(params.exemptSeatId),
          ),
      clampFn,
    };
  } else if (room === 'casino_interior') {
    spec = {
      minX: CASINO_INTERIOR_BOUNDS.minX,
      maxX: CASINO_INTERIOR_BOUNDS.maxX,
      minZ: CASINO_INTERIOR_BOUNDS.minZ,
      maxZ: CASINO_INTERIOR_BOUNDS.maxZ,
      cellSize: 0.35,
      colliders: CASINO_INTERIOR_COLLIDERS.filter(
        (c) => !params.exemptSeatId || !c.id.includes(params.exemptSeatId),
      ),
      clampFn: (x, z) => clampCasinoInteriorPosition(x, z),
    };
  } else {
    spec = {
      minX: CUTAWAY_ROOM_BOUNDS.minX,
      maxX: CUTAWAY_ROOM_BOUNDS.maxX,
      minZ: CUTAWAY_ROOM_BOUNDS.minZ,
      maxZ: CUTAWAY_ROOM_BOUNDS.maxZ,
      cellSize: 0.34,
      colliders: params.houseColliders ?? [],
      clampFn: (x, z) => ({
        x: clamp(x, CUTAWAY_ROOM_BOUNDS.minX + 0.55, CUTAWAY_ROOM_BOUNDS.maxX - 0.55),
        z: clamp(z, CUTAWAY_ROOM_BOUNDS.minZ + 0.55, CUTAWAY_ROOM_BOUNDS.maxZ - 0.55),
      }),
    };
  }

  const grid = buildInteriorNavGrid(spec);
  const sStart = snapInteriorPoint(grid, spec.clampFn, startX, startZ);
  const sGoal = snapInteriorPoint(grid, spec.clampFn, goalX, goalZ);
  const res = runInteriorGridAStar(grid, sStart.x, sStart.z, sGoal.x, sGoal.z, 0);

  return {
    reachable: res.reached,
    snapped: sGoal.snapped,
    targetX: sGoal.x,
    targetZ: sGoal.z,
    targetFloorY: 0,
    waypoints: res.waypoints,
    totalDistanceM: computeRoutePolylineLength(startX, startZ, res.waypoints),
  };
}

// =============================================================================
// CLICK-TO-WALK STATE MACHINE & STEERING
// =============================================================================

export function createIdleClickToWalkState(): ClickToWalkState {
  return {
    active: false,
    source: 'world',
    rawTargetX: 0,
    rawTargetZ: 0,
    targetX: 0,
    targetZ: 0,
    targetLabel: null,
    waypoints: [],
    waypointIndex: 0,
    totalDistanceM: 0,
    remainingDistanceM: 0,
    pendingInteraction: { kind: 'none' },
    avoidSide: 0,
    avoidTimer: 0,
    stuckTimer: 0,
    lastProgressX: 0,
    lastProgressZ: 0,
    startedAtMs: 0,
  };
}

export function cancelClickToWalkState(state: ClickToWalkState): ClickToWalkState {
  if (!state.active && state.waypoints.length === 0) return state;
  return createIdleClickToWalkState();
}

export function startClickToWalkState(params: {
  source: ClickToWalkSource;
  startX: number;
  startZ: number;
  rawTargetX: number;
  rawTargetZ: number;
  targetX: number;
  targetZ: number;
  waypoints: ReadonlyArray<ClickToWalkWaypoint>;
  targetLabel?: string | null;
  pendingInteraction?: ClickToWalkPendingInteraction;
  nowMs?: number;
}): ClickToWalkState {
  const waypoints =
    params.waypoints.length > 0
      ? params.waypoints.map((w) => ({ x: w.x, z: w.z, floorY: w.floorY }))
      : [{ x: params.targetX, z: params.targetZ }];
  const totalDistanceM = computeRoutePolylineLength(params.startX, params.startZ, waypoints, 0);
  return {
    active: true,
    source: params.source,
    rawTargetX: params.rawTargetX,
    rawTargetZ: params.rawTargetZ,
    targetX: params.targetX,
    targetZ: params.targetZ,
    targetLabel: params.targetLabel ?? null,
    waypoints,
    waypointIndex: 0,
    totalDistanceM,
    remainingDistanceM: totalDistanceM,
    pendingInteraction: params.pendingInteraction ?? { kind: 'none' },
    avoidSide: 0,
    avoidTimer: 0,
    stuckTimer: 0,
    lastProgressX: params.startX,
    lastProgressZ: params.startZ,
    startedAtMs: params.nowMs ?? 0,
  };
}

/**
 * Returns true if the player pressed directional WASD / Arrow keys or moved the Virtual Joystick,
 * which immediately yields priority from auto-walk back to manual player control.
 */
export function hasManualMovementConflict(input: {
  moveX?: number;
  moveZ?: number;
  keys?: Record<string, boolean>;
  joystickMag?: number;
}): boolean {
  if (input.keys) {
    if (
      input.keys['KeyW'] ||
      input.keys['KeyA'] ||
      input.keys['KeyS'] ||
      input.keys['KeyD'] ||
      input.keys['ArrowUp'] ||
      input.keys['ArrowDown'] ||
      input.keys['ArrowLeft'] ||
      input.keys['ArrowRight']
    ) {
      return true;
    }
  }
  if ((input.joystickMag ?? 0) > 0.06) return true;
  if (Math.hypot(input.moveX ?? 0, input.moveZ ?? 0) > 0.05) return true;
  return false;
}

/**
 * Advances active Click-to-Walk waypoint steering by `dt`, honoring manual-input priority,
 * intermediate waypoint pass-through, local obstacle/crowd tangent avoidance, and arrival triggers.
 */
export function stepClickToWalkSteering(params: {
  state: ClickToWalkState;
  x: number;
  z: number;
  dt: number;
  manualInputActive: boolean;
  isBlockedMode?: boolean; // e.g. riding tank/tram, fishing, work-anim
  arrivalRadius?: number;
  waypointReachRadius?: number;
  maxStuckSec?: number;
  // Optional outdoor local avoidance
  audited?: AuditedWorldCollidersSet;
  dynamicObbs?: readonly DynamicObbObstacle2D[];
  dynamicCircles?: readonly DynamicCircleObstacle2D[];
  characterCapsules?: readonly PedestrianAvoidanceCapsule2D[];
  exemptSeatPoint?: { x: number; z: number } | null;
  moverRadius?: number;
  isOnScooter?: boolean;
}): ClickToWalkStepResult {
  const { state, x, z, dt } = params;
  if (!state.active || state.waypoints.length === 0) {
    return {
      nextState: state,
      dirX: 0,
      dirZ: 0,
      speedScale: 0,
      arrived: false,
      cancelledByManualInput: false,
      cancelledByStuck: false,
      pendingInteractionToTrigger: null,
    };
  }

  if (params.manualInputActive || params.isBlockedMode) {
    return {
      nextState: cancelClickToWalkState(state),
      dirX: 0,
      dirZ: 0,
      speedScale: 0,
      arrived: false,
      cancelledByManualInput: Boolean(params.manualInputActive),
      cancelledByStuck: false,
      pendingInteractionToTrigger: null,
    };
  }

  const arrivalRadius = params.arrivalRadius ?? (params.isOnScooter ? 1.35 : 0.72);
  const waypointReachRadius = params.waypointReachRadius ?? (params.isOnScooter ? 1.95 : 1.05);
  let wpIdx = state.waypointIndex;

  while (wpIdx < state.waypoints.length - 1) {
    const wp = state.waypoints[wpIdx];
    const nextWp = state.waypoints[wpIdx + 1];
    const dx = wp.x - x;
    const dz = wp.z - z;
    const dist = Math.hypot(dx, dz);
    const segX = nextWp.x - wp.x;
    const segZ = nextWp.z - wp.z;
    const passedPlane = dist < waypointReachRadius * 1.35 && -dx * segX - dz * segZ > 0;
    if (dist <= waypointReachRadius || passedPlane) {
      wpIdx++;
    } else {
      break;
    }
  }

  const finalWp = state.waypoints[state.waypoints.length - 1];
  const distToFinal = Math.hypot(finalWp.x - x, finalWp.z - z);
  const interactionThreshold =
    state.pendingInteraction.kind === 'door_or_kiosk'
      ? Math.max(arrivalRadius, state.pendingInteraction.triggerRadius * 0.85)
      : arrivalRadius;

  if (wpIdx >= state.waypoints.length - 1 && distToFinal <= interactionThreshold) {
    const pending =
      state.pendingInteraction.kind !== 'none' ? state.pendingInteraction : null;
    return {
      nextState: createIdleClickToWalkState(),
      dirX: 0,
      dirZ: 0,
      speedScale: 0,
      arrived: true,
      cancelledByManualInput: false,
      cancelledByStuck: false,
      pendingInteractionToTrigger: pending,
    };
  }

  const activeWp = state.waypoints[Math.min(wpIdx, state.waypoints.length - 1)];
  const rawDx = activeWp.x - x;
  const rawDz = activeWp.z - z;
  const rawDist = Math.max(1e-4, Math.hypot(rawDx, rawDz));
  let dirX = rawDx / rawDist;
  let dirZ = rawDz / rawDist;
  let speedScale = 1.0;
  let avoidSide = state.avoidSide;
  let avoidTimer = Math.max(0, state.avoidTimer - dt);

  if (params.audited && !params.isOnScooter) {
    const avoid = computeLocalPedestrianAvoidance2D({
      selfId: 'player_click_to_walk',
      x,
      z,
      dirX,
      dirZ,
      radius: params.moverRadius ?? PLAYER_FOOT_CAPSULE_RADIUS,
      distToSteerTarget: rawDist,
      distToFinal,
      isFinalGoal: wpIdx >= state.waypoints.length - 1,
      dt,
      audited: params.audited,
      dynamicObbs: params.dynamicObbs,
      dynamicCircles: params.dynamicCircles,
      characterCapsules: params.characterCapsules,
      exemptSeatPoint: params.exemptSeatPoint,
      stayOffNonCrosswalkRoads: false,
      avoidSide,
      avoidTimer,
      lookaheadM: 1.7,
    });
    dirX = avoid.dirX;
    dirZ = avoid.dirZ;
    speedScale = avoid.speedScale;
    avoidSide = avoid.avoidSide;
    avoidTimer = avoid.avoidTimer;
  }

  const moved = Math.hypot(x - state.lastProgressX, z - state.lastProgressZ);
  let lastProgressX = state.lastProgressX;
  let lastProgressZ = state.lastProgressZ;
  let stuckTimer = state.stuckTimer;
  if (moved > 0.25) {
    lastProgressX = x;
    lastProgressZ = z;
    stuckTimer = 0;
  } else {
    stuckTimer += Math.max(0, dt);
  }

  const maxStuckSec = params.maxStuckSec ?? 2.4;
  if (stuckTimer >= maxStuckSec) {
    return {
      nextState: createIdleClickToWalkState(),
      dirX: 0,
      dirZ: 0,
      speedScale: 0,
      arrived: false,
      cancelledByManualInput: false,
      cancelledByStuck: true,
      pendingInteractionToTrigger: null,
    };
  }

  const remainingDistanceM = computeRoutePolylineLength(x, z, state.waypoints, wpIdx);
  return {
    nextState: {
      ...state,
      waypointIndex: wpIdx,
      remainingDistanceM,
      avoidSide,
      avoidTimer,
      stuckTimer,
      lastProgressX,
      lastProgressZ,
    },
    dirX,
    dirZ,
    speedScale,
    arrived: false,
    cancelledByManualInput: false,
    cancelledByStuck: false,
    pendingInteractionToTrigger: null,
  };
}

export function summarizeClickToWalkForHud(
  state: ClickToWalkState,
  playerX: number,
  playerZ: number,
  isOnScooter: boolean,
): ClickToWalkHudSummary {
  if (!state.active) {
    return {
      active: false,
      source: 'world',
      targetX: 0,
      targetZ: 0,
      targetLabel: null,
      remainingDistanceM: 0,
      isOnScooter,
      waypoints: [],
    };
  }
  const rem = computeRoutePolylineLength(playerX, playerZ, state.waypoints, state.waypointIndex);
  return {
    active: true,
    source: state.source,
    targetX: state.targetX,
    targetZ: state.targetZ,
    targetLabel: state.targetLabel,
    remainingDistanceM: Math.max(0, Math.round(rem)),
    isOnScooter,
    waypoints: state.waypoints.slice(state.waypointIndex).map((w) => ({ x: w.x, z: w.z })),
  };
}

/**
 * Matches a clicked 3D ground/object point against interactive seats/benches (outdoors or indoors)
 * so clicking directly on a chair, bench, sofa, or lounger walks to it and sits down automatically.
 */
export function pickClosestInteractiveSeatAtPoint<
  T extends { id: string; x: number; z: number; floorLevel?: '1f' | '2f' },
>(params: {
  hitX: number;
  hitZ: number;
  hitY?: number;
  seats: ReadonlyArray<T>;
  maxRadiusM?: number;
  preferredFloorLevel?: '1f' | '2f';
}): T | null {
  const maxR = params.maxRadiusM ?? 1.45;
  let best: T | null = null;
  let bestScore = maxR;
  for (let i = 0; i < params.seats.length; i++) {
    const s = params.seats[i];
    if (
      params.preferredFloorLevel &&
      s.floorLevel &&
      s.floorLevel !== params.preferredFloorLevel
    ) {
      continue;
    }
    const d = Math.hypot(s.x - params.hitX, s.z - params.hitZ);
    if (d <= bestScore) {
      bestScore = d;
      best = s;
    }
  }
  return best;
}

/**
 * Samples animated breadcrumb chevron poses along the active multi-waypoint polyline
 * starting `startOffsetM` ahead of the player so breadcrumbs smoothly curve around buildings and lakes.
 */
export function samplePolylineBreadcrumbs(
  startX: number,
  startZ: number,
  waypoints: ReadonlyArray<ClickToWalkWaypoint>,
  waypointIndex: number,
  maxCount = 14,
  spacingM = 2.4,
  phaseOffset01 = 0,
  startOffsetM = 1.25,
  endPaddingM = 1.05,
): Array<{ x: number; z: number; yaw: number; floorY?: number }> {
  const out: Array<{ x: number; z: number; yaw: number; floorY?: number }> = [];
  if (waypoints.length === 0 || waypointIndex >= waypoints.length || maxCount <= 0) {
    return out;
  }

  const pts: ClickToWalkWaypoint[] = [{ x: startX, z: startZ, floorY: waypoints[waypointIndex]?.floorY }];
  for (let i = waypointIndex; i < waypoints.length; i++) {
    pts.push(waypoints[i]);
  }

  const cumLen: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cumLen.push(
      cumLen[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z),
    );
  }
  const totalLen = cumLen[cumLen.length - 1];
  if (totalLen <= startOffsetM + endPaddingM) return out;

  const maxSpan = totalLen - endPaddingM;
  const phaseDist = ((phaseOffset01 % 1) + 1) % 1 * spacingM;

  let segIdx = 0;
  for (let k = 0; k < maxCount; k++) {
    const targetDist = startOffsetM + phaseDist + k * spacingM;
    if (targetDist > maxSpan) break;
    while (segIdx + 1 < cumLen.length && cumLen[segIdx + 1] < targetDist) {
      segIdx++;
    }
    if (segIdx + 1 >= pts.length) break;
    const segStart = pts[segIdx];
    const segEnd = pts[segIdx + 1];
    const segLen = Math.max(1e-5, cumLen[segIdx + 1] - cumLen[segIdx]);
    const localT = clamp((targetDist - cumLen[segIdx]) / segLen, 0, 1);
    const px = segStart.x + (segEnd.x - segStart.x) * localT;
    const pz = segStart.z + (segEnd.z - segStart.z) * localT;
    const yaw = Math.atan2(segEnd.x - segStart.x, segEnd.z - segStart.z);
    const floorY =
      segStart.floorY !== undefined && segEnd.floorY !== undefined
        ? segStart.floorY + (segEnd.floorY - segStart.floorY) * localT
        : segEnd.floorY ?? segStart.floorY;
    out.push({ x: px, z: pz, yaw, floorY });
  }
  return out;
}

// =============================================================================
// 3D GROUND DESTINATION TARGET RING & BREADCRUMB CHEVRONS (CEL-CRISP AESTHETIC)
// =============================================================================

export interface ClickToWalkIndicator3DHandle {
  root: THREE.Group;
  update: (params: {
    state: ClickToWalkState;
    playerX: number;
    playerZ: number;
    timeSec: number;
    sampleGroundY: (x: number, z: number, floorY?: number) => number;
    scaleMultiplier?: number;
  }) => void;
  dispose: () => void;
}

/**
 * Creates a crisp cel-styled 3D destination ring (dark ink outline + lime/pink core + expanding pulse)
 * and animated ground breadcrumb chevrons following the smoothed Click-to-Walk waypoint path.
 */
export function createClickToWalkIndicator3D(
  scene: THREE.Scene,
  options?: { chevronCount?: number },
): ClickToWalkIndicator3DHandle {
  const chevronCount = Math.max(4, options?.chevronCount ?? 14);
  const root = new THREE.Group();
  root.name = 'ClickToWalkIndicator3D';
  root.visible = false;
  scene.add(root);

  // 1. Crisp Cel-Outlined Ground Target Ring
  const destGroup = new THREE.Group();
  root.add(destGroup);

  const outlineRingGeo = new THREE.RingGeometry(0.62, 0.98, 32);
  outlineRingGeo.rotateX(-Math.PI / 2);
  const outlineRingMat = new THREE.MeshBasicMaterial({
    color: '#14161d',
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const outlineRingMesh = new THREE.Mesh(outlineRingGeo, outlineRingMat);
  outlineRingMesh.renderOrder = 18;
  outlineRingMesh.raycast = () => {};
  destGroup.add(outlineRingMesh);

  const coreRingGeo = new THREE.RingGeometry(0.68, 0.92, 32);
  coreRingGeo.rotateX(-Math.PI / 2);
  const coreRingMat = new THREE.MeshBasicMaterial({
    color: '#b8ff3c',
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const coreRingMesh = new THREE.Mesh(coreRingGeo, coreRingMat);
  coreRingMesh.position.y = 0.01;
  coreRingMesh.renderOrder = 19;
  coreRingMesh.raycast = () => {};
  destGroup.add(coreRingMesh);

  const pulseWaveGeo = new THREE.RingGeometry(0.55, 0.72, 32);
  pulseWaveGeo.rotateX(-Math.PI / 2);
  const pulseWaveMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const pulseWaveMesh = new THREE.Mesh(pulseWaveGeo, pulseWaveMat);
  pulseWaveMesh.position.y = 0.02;
  pulseWaveMesh.renderOrder = 19;
  pulseWaveMesh.raycast = () => {};
  destGroup.add(pulseWaveMesh);

  const centerBeaconGeo = new THREE.CircleGeometry(0.24, 16);
  centerBeaconGeo.rotateX(-Math.PI / 2);
  const centerBeaconMat = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const centerBeaconMesh = new THREE.Mesh(centerBeaconGeo, centerBeaconMat);
  centerBeaconMesh.position.y = 0.015;
  centerBeaconMesh.renderOrder = 20;
  centerBeaconMesh.raycast = () => {};
  destGroup.add(centerBeaconMesh);

  // 2. Breadcrumb Chevrons Pool
  const chevShape = new THREE.Shape();
  chevShape.moveTo(0, 0.34);
  chevShape.lineTo(0.34, -0.18);
  chevShape.lineTo(0.18, -0.28);
  chevShape.lineTo(0, 0.02);
  chevShape.lineTo(-0.18, -0.28);
  chevShape.lineTo(-0.34, -0.18);
  chevShape.closePath();
  const chevronGeo = new THREE.ShapeGeometry(chevShape);
  chevronGeo.rotateX(-Math.PI / 2);

  const chevronItems: Array<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }> = [];
  for (let i = 0; i < chevronCount; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: '#b8ff3c',
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(chevronGeo, mat);
    mesh.visible = false;
    mesh.renderOrder = 18;
    mesh.raycast = () => {};
    root.add(mesh);
    chevronItems.push({ mesh, mat });
  }

  const update: ClickToWalkIndicator3DHandle['update'] = ({
    state,
    playerX,
    playerZ,
    timeSec,
    sampleGroundY,
    scaleMultiplier = 1.0,
  }) => {
    if (!state.active || state.waypoints.length === 0) {
      root.visible = false;
      return;
    }

    root.visible = true;
    const isInteract = state.pendingInteraction.kind !== 'none';
    const primaryHex = isInteract ? '#f472b6' : '#b8ff3c';
    const secondaryHex = isInteract ? '#facc15' : '#38bdf8';
    coreRingMat.color.set(primaryHex);
    pulseWaveMat.color.set(secondaryHex);

    const finalWp = state.waypoints[state.waypoints.length - 1];
    const destY = sampleGroundY(finalWp.x, finalWp.z, finalWp.floorY) + 0.08;
    destGroup.position.set(finalWp.x, destY, finalWp.z);
    const ringPulse = 1.0 + Math.sin(timeSec * 5.2) * 0.1;
    destGroup.scale.setScalar(scaleMultiplier * ringPulse);
    coreRingMat.opacity = 0.78 + Math.sin(timeSec * 5.2) * 0.2;

    const waveT = (timeSec * 1.35) % 1;
    pulseWaveMesh.scale.setScalar(0.85 + waveT * 0.85);
    pulseWaveMat.opacity = (1 - waveT) * 0.65;

    const crumbs = samplePolylineBreadcrumbs(
      playerX,
      playerZ,
      state.waypoints,
      state.waypointIndex,
      chevronCount,
      2.35 * scaleMultiplier,
      timeSec * 0.75,
      1.15 * scaleMultiplier,
      0.95 * scaleMultiplier,
    );

    for (let i = 0; i < chevronItems.length; i++) {
      const item = chevronItems[i];
      if (i >= crumbs.length) {
        item.mesh.visible = false;
        continue;
      }
      const c = crumbs[i];
      item.mesh.visible = true;
      item.mesh.position.set(c.x, sampleGroundY(c.x, c.z, c.floorY) + 0.09, c.z);
      item.mesh.rotation.y = c.yaw;
      item.mat.color.set(primaryHex);
      const wave = 0.5 + 0.5 * Math.sin(timeSec * 7.0 - i * 0.7);
      item.mat.opacity = 0.45 + wave * 0.48;
      item.mesh.scale.setScalar(scaleMultiplier * (0.78 + wave * 0.18));
    }
  };

  const dispose = () => {
    scene.remove(root);
    outlineRingGeo.dispose();
    outlineRingMat.dispose();
    coreRingGeo.dispose();
    coreRingMat.dispose();
    pulseWaveGeo.dispose();
    pulseWaveMat.dispose();
    centerBeaconGeo.dispose();
    centerBeaconMat.dispose();
    chevronGeo.dispose();
    for (const item of chevronItems) {
      item.mat.dispose();
    }
  };

  return { root, update, dispose };
}

/**
 * Helper to check if a world position sits near any static OBB collision boundary (for diagnostics/tests).
 */
export function verifyRouteClearOfStructures(
  nav: CityNavGridHandle,
  waypoints: ReadonlyArray<{ x: number; z: number }>,
  startX: number,
  startZ: number,
  sampleStepM = 0.45,
): { clear: boolean; violationReason: string | null } {
  const pts = [{ x: startX, z: startZ }, ...waypoints];
  for (let i = 0; i + 1 < pts.length; i++) {
    const ax = pts[i].x;
    const az = pts[i].z;
    const bx = pts[i + 1].x;
    const bz = pts[i + 1].z;
    const len = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.ceil(len / sampleStepM));
    let prevElev = getTerrainElevation(ax, az);
    let prevStair = isInStaircaseCorridor(ax, az);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const px = ax + (bx - ax) * t;
      const pz = az + (bz - az) * t;
      if (evaluateNwLakeSdf(px, pz) < 0.2) {
        return { clear: false, violationReason: `Lake collision at (${px.toFixed(2)}, ${pz.toFixed(2)})` };
      }
      if (isOceanBlockedAt(px, pz)) {
        return { clear: false, violationReason: `Ocean collision at (${px.toFixed(2)}, ${pz.toFixed(2)})` };
      }
      if (evaluateOuterEmbankmentSdf(px, pz) > -0.65) {
        return { clear: false, violationReason: `Embankment collision at (${px.toFixed(2)}, ${pz.toFixed(2)})` };
      }
      const curElev = getTerrainElevation(px, pz);
      const curStair = isInStaircaseCorridor(px, pz);
      const maxStep = prevStair || curStair ? 1.45 : 0.92;
      if (Math.abs(curElev - prevElev) > maxStep) {
        return {
          clear: false,
          violationReason: `Cliff/retaining wall drop (${prevElev.toFixed(2)} -> ${curElev.toFixed(2)}) at (${px.toFixed(2)}, ${pz.toFixed(2)})`,
        };
      }
      prevElev = curElev;
      prevStair = curStair;
      for (const st of nav.audited.obbs) {
        if (st.id.endsWith('_gate')) continue;
        const res = resolveSolidObbCollision2D(
          px,
          pz,
          0,
          0,
          0.32,
          st.x,
          st.z,
          st.halfX,
          st.halfZ,
          st.rotY,
          0,
        );
        if (res.collided) {
          return { clear: false, violationReason: `OBB ${st.id} collision at (${px.toFixed(2)}, ${pz.toFixed(2)})` };
        }
      }
      for (const c of nav.audited.circles) {
        if (Math.hypot(px - c.x, pz - c.z) < c.radius + 0.32) {
          return { clear: false, violationReason: `Circle ${c.id} collision at (${px.toFixed(2)}, ${pz.toFixed(2)})` };
        }
      }
    }
  }
  return { clear: true, violationReason: null };
}
