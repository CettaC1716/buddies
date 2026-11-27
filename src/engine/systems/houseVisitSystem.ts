/**
 * Dedicated Private House Walk-In Exploration System (`house_visit`).
 *
 * Extracts Private House playable-area clamping, courtyard + interior collider
 * classification, smooth floor elevation grounding, wooden garden gate exit
 * proximity, and damped anti-wall-clipping camera resolution out of the
 * monolithic arena file into a pure, testable, zero-allocation engine system.
 */

import {
  HOUSE_VISIT_INDOOR_BOUNDS,
  INDOOR_ORBIT_CAMERA_CONFIG,
  computeIndoorRoomOrbitCameraPose,
  getHouseVisitFloorY,
  type HouseCameraObstructionBox,
  type IndoorRoomOrbitCameraPose,
} from '../../game/buddiesCafeRules';
import type { HouseSceneColliderAabb } from '../../game/buddiesHouseSceneBuilder';

export const HOUSE_VISIT_PLAYER_RADIUS = 0.28;

const HOUSE_VISIT_SOLID_COLLIDER_PREFIXES = [
  'Col_Wall_',
  'Col_Part_',
  'Col_Kitchen_',
  'Col_Courtyard_',
  'Col_Lantern_',
  'Col_Maple_',
  'Col_ZenRocks_',
  'Col_Bamboo_',
  'Col_MainSlide_',
  'Col_BedSlide_',
] as const;

const HOUSE_VISIT_SOLID_COLLIDER_NAMES = new Set([
  'Col_Wardrobe',
  'Col_BathTub',
  'Col_Lotus_Pond',
]);

/** Returns true when a GLB `Col_*` footprint should block walk-in movement. */
export function isHouseVisitSolidCollider(collider: Pick<HouseSceneColliderAabb, 'name'>): boolean {
  if (HOUSE_VISIT_SOLID_COLLIDER_NAMES.has(collider.name)) return true;
  for (let i = 0; i < HOUSE_VISIT_SOLID_COLLIDER_PREFIXES.length; i++) {
    if (collider.name.startsWith(HOUSE_VISIT_SOLID_COLLIDER_PREFIXES[i])) {
      return true;
    }
  }
  return false;
}

export interface HouseVisitDampedCameraPose {
  fovDeg: number;
  camX: number;
  camY: number;
  camZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
  obstructionRatio: number;
}

export interface HouseVisitExitProximity {
  near: boolean;
  distance: number;
}

export interface HouseVisitSystemHandle {
  /** Resets floor elevation and camera damping when entering `house_visit`. */
  resetOnEnter: (spawnX?: number, spawnZ?: number) => void;
  /** Returns current smoothly damped room-local floor Y. */
  getCurrentFloorY: () => number;
  /** Advances smooth floor elevation toward the exact surface at `(x, z)`. */
  stepFloorY: (x: number, z: number, dtSec: number, isVisitMode: boolean) => number;
  /** Clamps `(x, z)` strictly inside the walled courtyard playable bounds. */
  clampPlayableXZ: (pos: { x: number; z: number }, margin?: number) => void;
  /** Returns true when a click-to-walk target lies inside the playable courtyard. */
  isClickPointInsidePlayableBounds: (x: number, z: number, margin?: number) => boolean;
  /** Evaluates distance & proximity to the wooden garden gate exit portal. */
  evaluateExitProximity: (x: number, z: number) => HouseVisitExitProximity;
  /**
   * Computes the playable-area anti-wall-clipping orbit camera pose with
   * instant pull-in on wall obstruction and exponential ease-out recovery.
   * Reuses an internal output object to avoid per-frame allocations.
   */
  resolveDampedCameraPose: (params: {
    originY: number;
    anchorX: number;
    anchorZ: number;
    yaw: number;
    pitch: number;
    dist: number;
    dtSec: number;
    obstructionBoxes?: readonly HouseCameraObstructionBox[];
  }) => Readonly<HouseVisitDampedCameraPose>;
}

function clampValue(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createHouseVisitSystem(): HouseVisitSystemHandle {
  let currentFloorY = getHouseVisitFloorY(
    HOUSE_VISIT_INDOOR_BOUNDS.spawnX,
    HOUSE_VISIT_INDOOR_BOUNDS.spawnZ,
  );
  let camObstructionRatio = 1.0;

  // Reusable output object (zero per-frame heap allocation in 60FPS loop)
  const scratchCameraPose: HouseVisitDampedCameraPose = {
    fovDeg: INDOOR_ORBIT_CAMERA_CONFIG.house_visit.fovDeg,
    camX: 0,
    camY: 0,
    camZ: 0,
    lookX: 0,
    lookY: 0,
    lookZ: 0,
    obstructionRatio: 1,
  };

  const resetOnEnter = (
    spawnX: number = HOUSE_VISIT_INDOOR_BOUNDS.spawnX,
    spawnZ: number = HOUSE_VISIT_INDOOR_BOUNDS.spawnZ,
  ) => {
    currentFloorY = getHouseVisitFloorY(spawnX, spawnZ);
    camObstructionRatio = 1.0;
  };

  const stepFloorY = (x: number, z: number, dtSec: number, isVisitMode: boolean): number => {
    const targetY = isVisitMode ? getHouseVisitFloorY(x, z) : 0;
    const safeDt = clampValue(dtSec, 0, 0.05);
    const alpha = 1 - Math.exp(-safeDt * 16.0);
    currentFloorY += (targetY - currentFloorY) * alpha;
    return currentFloorY;
  };

  const clampPlayableXZ = (
    pos: { x: number; z: number },
    margin: number = HOUSE_VISIT_PLAYER_RADIUS,
  ) => {
    pos.x = clampValue(
      pos.x,
      HOUSE_VISIT_INDOOR_BOUNDS.minX + margin,
      HOUSE_VISIT_INDOOR_BOUNDS.maxX - margin,
    );
    pos.z = clampValue(
      pos.z,
      HOUSE_VISIT_INDOOR_BOUNDS.minZ + margin,
      HOUSE_VISIT_INDOOR_BOUNDS.maxZ - margin,
    );
  };

  const isClickPointInsidePlayableBounds = (x: number, z: number, margin = 0.34): boolean =>
    x >= HOUSE_VISIT_INDOOR_BOUNDS.minX + margin &&
    x <= HOUSE_VISIT_INDOOR_BOUNDS.maxX - margin &&
    z >= HOUSE_VISIT_INDOOR_BOUNDS.minZ + margin &&
    z <= HOUSE_VISIT_INDOOR_BOUNDS.maxZ - margin;

  const evaluateExitProximity = (x: number, z: number): HouseVisitExitProximity => {
    const distance = Math.hypot(
      x - HOUSE_VISIT_INDOOR_BOUNDS.exitX,
      z - HOUSE_VISIT_INDOOR_BOUNDS.exitZ,
    );
    return {
      near: distance <= HOUSE_VISIT_INDOOR_BOUNDS.exitTriggerRadius,
      distance,
    };
  };

  const resolveDampedCameraPose: HouseVisitSystemHandle['resolveDampedCameraPose'] = ({
    originY,
    anchorX,
    anchorZ,
    yaw,
    pitch,
    dist,
    dtSec,
    obstructionBoxes,
  }) => {
    const rawPose: IndoorRoomOrbitCameraPose = computeIndoorRoomOrbitCameraPose({
      roomKind: 'house_visit',
      originY,
      anchorX,
      anchorZ,
      yaw,
      pitch,
      dist,
      obstructionBoxes,
    });

    const targetRatio = rawPose.obstructionRatio ?? 1.0;
    if (targetRatio <= camObstructionRatio) {
      // Snap inward immediately on obstruction so camera never clips a wall for even 1 frame
      camObstructionRatio = targetRatio;
    } else {
      const easeAlpha = 1 - Math.exp(-clampValue(dtSec, 0, 0.05) * 10.0);
      camObstructionRatio += (targetRatio - camObstructionRatio) * easeAlpha;
    }

    const scaleAlongRay =
      targetRatio > 1e-4 ? Math.min(1.0, camObstructionRatio / targetRatio) : 1.0;

    scratchCameraPose.fovDeg = rawPose.fovDeg;
    scratchCameraPose.lookX = rawPose.lookX;
    scratchCameraPose.lookY = rawPose.lookY;
    scratchCameraPose.lookZ = rawPose.lookZ;
    scratchCameraPose.camX = rawPose.lookX + (rawPose.camX - rawPose.lookX) * scaleAlongRay;
    scratchCameraPose.camY = rawPose.lookY + (rawPose.camY - rawPose.lookY) * scaleAlongRay;
    scratchCameraPose.camZ = rawPose.lookZ + (rawPose.camZ - rawPose.lookZ) * scaleAlongRay;
    scratchCameraPose.obstructionRatio = camObstructionRatio;
    return scratchCameraPose;
  };

  return {
    resetOnEnter,
    getCurrentFloorY: () => currentFloorY,
    stepFloorY,
    clampPlayableXZ,
    isClickPointInsidePlayableBounds,
    evaluateExitProximity,
    resolveDampedCameraPose,
  };
}
