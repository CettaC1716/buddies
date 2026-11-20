import type * as THREE from 'three';

export type CityWindowKind =
  | 'upper_floor'
  | 'storefront'
  | 'civic'
  | 'dormer'
  | 'conservatory';

export interface CityWindowSpec {
  id: string;
  kind: CityWindowKind;
  seed: number;
  baseColorHex: string;
  intensityScale?: number;
}

export type WallNormalAxis = '+X' | '-X' | '+Z' | '-Z';

export type BlockRotationDeg = 0 | 90 | 180 | 270;

export type FacadeObstacleKind =
  | 'corner_pillar'
  | 'pilaster'
  | 'quoin'
  | 'doorway'
  | 'adjacent_window'
  | 'roof_cornice'
  | 'arch_trim'
  | 'balcony'
  | 'awning'
  | 'wing_wall';

export interface FacadeObstacleSpan {
  id: string;
  kind: FacadeObstacleKind;
  /** Horizontal span along the host wall tangent axis in building-local space */
  uMin: number;
  uMax: number;
  /** Vertical elevation span (world/building Y) */
  vMin: number;
  vMax: number;
  /** Optional outward depth span relative to host wall face */
  nMin?: number;
  nMax?: number;
}

export interface FacadeWallBounds {
  /** Coordinate of the exterior wall plane along wallNormal */
  wallFaceCoord: number;
  /** Minimum/maximum horizontal bounds along wall tangent axis */
  uMin: number;
  uMax: number;
  /** Minimum/maximum vertical elevation bounds along Y */
  vMin: number;
  vMax: number;
  /** Optional mandatory inset margin from horizontal wall ends / corners */
  cornerMargin?: number;
  /** Optional mandatory inset margin below roof eaves or cornice */
  corniceMargin?: number;
  /** Optional mandatory inset margin above ground/plinth base */
  plinthMargin?: number;
}

export interface FacadeWindowPlacementInput {
  /** Host wall surface anchor point [x, y, z] in building-local space */
  wallFacePos: readonly [number, number, number];
  /** Host wall outward normal axis in building-local space */
  wallNormal: WallNormalAxis;
  /** Thickness (depth) of the primary window or frame along the outward normal */
  depth: number;
  /** Extra outward clearance beyond depth * 0.5 (default 0.004m) */
  flushClearance?: number;
  /** Which local axis of the window prefab/mesh faces outward before Y-rotation (default '+Z') */
  localOutwardAxis?: WallNormalAxis;
  /** City block / plot yaw rotation in degrees (0 | 90 | 180 | 270) */
  blockRotationDeg?: BlockRotationDeg;
  /** Optional building anchor around which blockRotationDeg rotates */
  buildingOrigin?: readonly [number, number, number];
  /** Extrusion thicknesses along the outward normal */
  frameDepth?: number;
  mullionDepth?: number;
  sillDepth?: number;
  glassDepth?: number;
  shutterDepth?: number;
  awningDepth?: number;
  /** Optional distance sill extends in front of frame (defaults to 0.04m) */
  sillLip?: number;
  /** Optional recess of glass front behind frame front (defaults to 0.008m inside frame) */
  glassRecessFromFrameFront?: number;
}

export interface AuditedFacadeWindowTransform {
  localPosition: [number, number, number];
  localRotationY: number;
  flushOffset: number;
  frontFaceOffset: number;
  backFaceOffset: number;
  extrusions: {
    frameDepth: number;
    mullionDepth: number;
    sillDepth: number;
    glassDepth: number;
    shutterDepth: number;
    awningDepth: number;
    frameCenterOutward: number;
    glassCenterOutward: number;
    mullionCenterOutward: number;
    sillCenterOutward: number;
    shutterCenterOutward: number;
    awningCenterOutward: number;
    frameFrontOutward: number;
    glassFrontOutward: number;
    mullionFrontOutward: number;
    sillFrontOutward: number;
    shutterFrontOutward: number;
    awningFrontOutward: number;
  };
  blockOutwardNormal: [number, number, number];
  blockPosition: [number, number, number];
  blockRotationY: number;
  blockNormalAxis: WallNormalAxis;
}

export interface FacadeWindowBoundsInput {
  id: string;
  /** Window center horizontal coordinate along wall tangent axis */
  uCenter: number;
  /** Window center vertical coordinate (Y) */
  vCenter: number;
  /** Glass pane width/height */
  width: number;
  height: number;
  /** Outer frame width/height (defaults to width/height) */
  frameWidth?: number;
  frameHeight?: number;
  /** Sill width/height/offset relative to frame bottom */
  sillWidth?: number;
  sillHeight?: number;
  sillBottomOffset?: number;
  /** Optional shutter dimensions flanking the frame */
  shutterWidth?: number;
  shutterHeight?: number;
  shutterGap?: number;
  omitLeftShutter?: boolean;
  omitRightShutter?: boolean;
  /** Mullion thickness along wall-tangent axis & outward normal */
  mullionWidth?: number;
  mullionDepth?: number;
  /** Optional awning dimensions */
  awningWidth?: number;
  awningBottomY?: number;
  awningTopY?: number;
  /** Arch crown rise above rectangular frame top (0 for rectangular windows) */
  archCrownHeight?: number;
  /** Depth along wall outward normal of main glass/frame assembly */
  depth: number;
  /** Outward offset of primary assembly center from wall surface */
  flushOffset: number;
  /** Maximum acceptable back-face gap from wall surface (default 0.03m) */
  maxFloatGap?: number;
  /** Minimum required front-face protrusion proud of wall surface (default 0.002m) */
  minFrontProtrusion?: number;
  /** Host wall elevation and horizontal bounds */
  wall: FacadeWallBounds;
  /** Nearby pillars, pilasters, quoins, doorways, neighboring windows, roof trims */
  obstacles?: readonly FacadeObstacleSpan[];
  /** Minimum clearance from nearby obstacles in meters (default 0.005m) */
  minObstacleClearance?: number;
}

export type FacadeWindowIssueCode =
  | 'INVALID_DIMENSIONS'
  | 'ZERO_THICKNESS_PANE'
  | 'WINDOW_BURIED_IN_WALL'
  | 'WINDOW_ZFIGHT_RISK'
  | 'WINDOW_FLOATING_OUTSIDE_WALL'
  | 'OUT_OF_WALL_HORIZONTAL_BOUNDS'
  | 'OUT_OF_WALL_VERTICAL_BOUNDS'
  | 'MULLION_EXCEEDS_FRAME'
  | 'AWNING_CLIPS_ARCH_CROWN'
  | 'CLIPS_CORNER_OR_PILASTER'
  | 'CLIPS_DOORWAY'
  | 'CLIPS_ADJACENT_WINDOW'
  | 'CLIPS_ROOF_CORNICE'
  | 'CLIPS_FACADE_OBSTACLE';

export interface FacadeWindowValidationIssue {
  code: FacadeWindowIssueCode;
  component: 'window' | 'frame' | 'mullion' | 'sill' | 'left_shutter' | 'right_shutter' | 'awning';
  message: string;
  obstacleId?: string;
}

export interface FacadeWindowValidationResult {
  valid: boolean;
  windowId: string;
  issues: FacadeWindowValidationIssue[];
  envelopes: {
    frame: { uMin: number; uMax: number; vMin: number; vMax: number };
    mullion: { uMin: number; uMax: number; vMin: number; vMax: number };
    sill?: { uMin: number; uMax: number; vMin: number; vMax: number };
    leftShutter?: { uMin: number; uMax: number; vMin: number; vMax: number };
    rightShutter?: { uMin: number; uMax: number; vMin: number; vMax: number };
    awning?: { uMin: number; uMax: number; vMin: number; vMax: number };
  };
}

const AXIS_VECTORS: Record<WallNormalAxis, readonly [number, number, number]> = {
  '+X': [1, 0, 0],
  '-X': [-1, 0, 0],
  '+Z': [0, 0, 1],
  '-Z': [0, 0, -1],
};

const AXIS_ANGLES_RAD: Record<WallNormalAxis, number> = {
  '+Z': 0,
  '+X': Math.PI / 2,
  '-Z': Math.PI,
  '-X': -Math.PI / 2,
};

export function wallNormalToVector(axis: WallNormalAxis): [number, number, number] {
  const [x, y, z] = AXIS_VECTORS[axis];
  return [x, y, z];
}

/**
 * Exact integer-snapped Y rotation matching Three.js right-handed rotation around +Y:
 *   x' =  x * cos(yaw) + z * sin(yaw)
 *   z' = -x * sin(yaw) + z * cos(yaw)
 */
export function rotateVectorYDeg(
  x: number,
  y: number,
  z: number,
  deg: BlockRotationDeg,
): [number, number, number] {
  switch (deg) {
    case 0:
      return [x, y, z];
    case 90:
      return [z, y, -x];
    case 180:
      return [-x, y, -z];
    case 270:
      return [-z, y, x];
  }
}

export function rotateOutwardAxisDeg(
  axis: WallNormalAxis,
  deg: BlockRotationDeg,
): WallNormalAxis {
  const [vx, , vz] = AXIS_VECTORS[axis];
  const [rx, , rz] = rotateVectorYDeg(vx, 0, vz, deg);
  if (Math.abs(rx) > Math.abs(rz)) {
    return rx >= 0 ? '+X' : '-X';
  }
  return rz >= 0 ? '+Z' : '-Z';
}

export function normalizeYawRadians(yaw: number): number {
  let a = yaw % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a <= -Math.PI) a += Math.PI * 2;
  return Math.abs(a) < 1e-12 ? 0 : a;
}

export function computeDeterministicWindowSeed(
  id: string,
  row = 0,
  col = 0,
): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= Math.imul(row + 17, 0x9e3779b1) >>> 0;
  hash ^= Math.imul(col + 31, 0x85ebca6b) >>> 0;
  return (hash >>> 0) % 100000;
}

export function createCityWindowSpec(
  id: string,
  kind: CityWindowKind,
  baseColorHex: string,
  row = 0,
  col = 0,
  intensityScale?: number,
): CityWindowSpec {
  return {
    id,
    kind,
    seed: computeDeterministicWindowSeed(id, row, col),
    baseColorHex,
    ...(intensityScale !== undefined ? { intensityScale } : {}),
  };
}

export function tagCityWindowMesh<T extends THREE.Object3D>(
  mesh: T,
  spec: CityWindowSpec,
): T {
  mesh.userData.cityWindowSpec = {
    id: spec.id,
    kind: spec.kind,
    seed: spec.seed,
    baseColorHex: spec.baseColorHex,
    ...(spec.intensityScale !== undefined ? { intensityScale: spec.intensityScale } : {}),
  } satisfies CityWindowSpec;
  return mesh;
}

export function tagCityWindowInstancedMesh<T extends THREE.Object3D>(
  mesh: T,
  primarySpec: CityWindowSpec,
  instancedSpecs: readonly CityWindowSpec[],
): T {
  tagCityWindowMesh(mesh, primarySpec);
  mesh.userData.cityWindowInstancedSpecs = instancedSpecs.map((s) => ({
    id: s.id,
    kind: s.kind,
    seed: s.seed,
    baseColorHex: s.baseColorHex,
    ...(s.intensityScale !== undefined ? { intensityScale: s.intensityScale } : {}),
  }));
  return mesh;
}

/**
 * Computes audited flush window placement along the wall outward normal and transforms it
 * cleanly across 0/90/180/270 degree block rotations without Three.js Y-rotation sign inversions.
 */
export function computeAuditedFacadeWindowTransform(
  input: FacadeWindowPlacementInput,
): AuditedFacadeWindowTransform {
  const depth = Math.max(0.008, input.depth);
  const flushClearance = input.flushClearance ?? 0.004;
  const flushOffset = depth * 0.5 + flushClearance;

  const [nx, , nz] = AXIS_VECTORS[input.wallNormal];
  const localPosition: [number, number, number] = [
    input.wallFacePos[0] + nx * flushOffset,
    input.wallFacePos[1],
    input.wallFacePos[2] + nz * flushOffset,
  ];

  const localOutwardAxis = input.localOutwardAxis ?? '+Z';
  const localRotationY = normalizeYawRadians(
    AXIS_ANGLES_RAD[input.wallNormal] - AXIS_ANGLES_RAD[localOutwardAxis],
  );

  const frameDepth = input.frameDepth ?? depth;
  const mullionDepth = input.mullionDepth ?? Math.max(0.025, frameDepth * 0.65);
  const glassDepth = input.glassDepth ?? Math.max(0.022, Math.min(frameDepth, 0.04));
  const sillLip = input.sillLip ?? 0.04;
  const sillDepth = input.sillDepth ?? frameDepth + sillLip;
  const shutterDepth = input.shutterDepth ?? Math.max(0.035, frameDepth * 0.72);
  const awningDepth = input.awningDepth ?? 0.54;
  const glassRecess = input.glassRecessFromFrameFront ?? 0.008;

  const frameBack = flushClearance;
  const frameFrontOutward = frameBack + frameDepth;
  const frameCenterOutward = frameBack + frameDepth * 0.5;

  const glassFrontOutward = Math.max(flushClearance + glassDepth, frameFrontOutward - glassRecess);
  const glassCenterOutward = glassFrontOutward - glassDepth * 0.5;

  const mullionFrontOutward = Math.max(glassFrontOutward + 0.008, frameFrontOutward - 0.002);
  const mullionCenterOutward = mullionFrontOutward - mullionDepth * 0.5;

  const sillCenterOutward = frameBack + sillDepth * 0.5;
  const sillFrontOutward = frameBack + sillDepth;

  const shutterCenterOutward = frameBack + shutterDepth * 0.5;
  const shutterFrontOutward = frameBack + shutterDepth;

  const awningCenterOutward = Math.max(0.002, frameBack) + awningDepth * 0.5;
  const awningFrontOutward = Math.max(0.002, frameBack) + awningDepth;

  const blockDeg: BlockRotationDeg = input.blockRotationDeg ?? 0;
  const blockRotRad = (blockDeg * Math.PI) / 180;
  const blockRotationY = normalizeYawRadians(localRotationY + blockRotRad);
  const origin = input.buildingOrigin ?? [0, 0, 0];
  const [rx, ry, rz] = rotateVectorYDeg(
    localPosition[0],
    localPosition[1],
    localPosition[2],
    blockDeg,
  );
  const blockPosition: [number, number, number] = [
    origin[0] + rx,
    origin[1] + ry,
    origin[2] + rz,
  ];
  const blockNormalAxis = rotateOutwardAxisDeg(input.wallNormal, blockDeg);
  const blockOutwardNormal = wallNormalToVector(blockNormalAxis);

  return {
    localPosition,
    localRotationY,
    flushOffset,
    frontFaceOffset: flushOffset + depth * 0.5,
    backFaceOffset: flushOffset - depth * 0.5,
    extrusions: {
      frameDepth,
      mullionDepth,
      sillDepth,
      glassDepth,
      shutterDepth,
      awningDepth,
      frameCenterOutward,
      glassCenterOutward,
      mullionCenterOutward,
      sillCenterOutward,
      shutterCenterOutward,
      awningCenterOutward,
      frameFrontOutward,
      glassFrontOutward,
      mullionFrontOutward,
      sillFrontOutward,
      shutterFrontOutward,
      awningFrontOutward,
    },
    blockOutwardNormal,
    blockPosition,
    blockRotationY,
    blockNormalAxis,
  };
}

interface Envelope2D {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
}

function overlaps2D(a: Envelope2D, b: Envelope2D, clearance: number): boolean {
  return (
    a.uMax > b.uMin - clearance &&
    a.uMin < b.uMax + clearance &&
    a.vMax > b.vMin - clearance &&
    a.vMin < b.vMax + clearance
  );
}

function obstacleIssueCode(kind: FacadeObstacleKind): FacadeWindowIssueCode {
  switch (kind) {
    case 'corner_pillar':
    case 'pilaster':
    case 'quoin':
      return 'CLIPS_CORNER_OR_PILASTER';
    case 'doorway':
      return 'CLIPS_DOORWAY';
    case 'adjacent_window':
      return 'CLIPS_ADJACENT_WINDOW';
    case 'roof_cornice':
      return 'CLIPS_ROOF_CORNICE';
    default:
      return 'CLIPS_FACADE_OBSTACLE';
  }
}

export function buildAdjacentWindowObstacle(
  id: string,
  uCenter: number,
  vCenter: number,
  frameWidth: number,
  frameHeight: number,
  shutterWidth = 0,
  shutterGap = 0,
  archCrownHeight = 0,
): FacadeObstacleSpan {
  const halfU = frameWidth * 0.5 + (shutterWidth > 0 ? shutterWidth + shutterGap : 0);
  const halfV = frameHeight * 0.5;
  return {
    id,
    kind: 'adjacent_window',
    uMin: uCenter - halfU,
    uMax: uCenter + halfU,
    vMin: vCenter - halfV,
    vMax: vCenter + halfV + archCrownHeight,
  };
}

/**
 * Validates that frame, mullion, sill, shutters, and awning stay strictly inside
 * host wall elevation bounds, maintain clearance from corners/pillars/doorways/neighbors/cornices,
 * and neither bury inside nor float detached from the host wall.
 */
export function validateFacadeWindowBounds(
  input: FacadeWindowBoundsInput,
): FacadeWindowValidationResult {
  const issues: FacadeWindowValidationIssue[] = [];
  const fw = input.frameWidth ?? input.width;
  const fh = input.frameHeight ?? input.height;
  const archCrown = input.archCrownHeight ?? 0;

  if (input.width <= 0 || input.height <= 0 || fw <= 0 || fh <= 0) {
    issues.push({
      code: 'INVALID_DIMENSIONS',
      component: 'window',
      message: `Window "${input.id}" has non-positive dimensions.`,
    });
  }

  const frontFace = input.flushOffset + input.depth * 0.5;
  const backFace = input.flushOffset - input.depth * 0.5;
  const maxFloatGap = input.maxFloatGap ?? 0.03;
  const minFrontProtrusion = input.minFrontProtrusion ?? 0.002;

  if (input.depth <= 0.002) {
    issues.push({
      code: 'ZERO_THICKNESS_PANE',
      component: 'window',
      message: `Window "${input.id}" depth (${input.depth.toFixed(4)}m) is too thin and risks Z-fighting.`,
    });
  } else if (frontFace <= 0.0005) {
    issues.push({
      code: 'WINDOW_BURIED_IN_WALL',
      component: 'window',
      message: `Window "${input.id}" front face (${frontFace.toFixed(4)}m) is buried inside wall surface.`,
    });
  } else if (frontFace < minFrontProtrusion) {
    issues.push({
      code: 'WINDOW_ZFIGHT_RISK',
      component: 'window',
      message: `Window "${input.id}" front face (${frontFace.toFixed(4)}m) is too close to coplanar wall face.`,
    });
  }

  if (backFace > maxFloatGap) {
    issues.push({
      code: 'WINDOW_FLOATING_OUTSIDE_WALL',
      component: 'window',
      message: `Window "${input.id}" back face floats ${backFace.toFixed(4)}m off host wall (max ${maxFloatGap}m).`,
    });
  }

  const frameEnv: Envelope2D = {
    uMin: input.uCenter - fw * 0.5,
    uMax: input.uCenter + fw * 0.5,
    vMin: input.vCenter - fh * 0.5,
    vMax: input.vCenter + fh * 0.5 + archCrown,
  };

  const mullionWidth = input.mullionWidth ?? 0.04;
  const mullionEnv: Envelope2D = {
    uMin: input.uCenter - mullionWidth * 0.5,
    uMax: input.uCenter + mullionWidth * 0.5,
    vMin: input.vCenter - input.height * 0.5,
    vMax: input.vCenter + input.height * 0.5,
  };
  if (
    mullionEnv.uMin < frameEnv.uMin - 1e-6 ||
    mullionEnv.uMax > frameEnv.uMax + 1e-6 ||
    mullionEnv.vMin < frameEnv.vMin - 1e-6 ||
    mullionEnv.vMax > frameEnv.vMax + 1e-6
  ) {
    issues.push({
      code: 'MULLION_EXCEEDS_FRAME',
      component: 'mullion',
      message: `Mullion on "${input.id}" exceeds outer frame bounds.`,
    });
  }

  let sillEnv: Envelope2D | undefined;
  if ((input.sillWidth ?? 0) > 0 && (input.sillHeight ?? 0) > 0) {
    const sw = input.sillWidth!;
    const sh = input.sillHeight!;
    const sTop = frameEnv.vMin + (input.sillBottomOffset ?? 0) + sh * 0.5;
    sillEnv = {
      uMin: input.uCenter - sw * 0.5,
      uMax: input.uCenter + sw * 0.5,
      vMin: sTop - sh,
      vMax: sTop,
    };
  }

  let leftShutterEnv: Envelope2D | undefined;
  let rightShutterEnv: Envelope2D | undefined;
  if ((input.shutterWidth ?? 0) > 0) {
    const shW = input.shutterWidth!;
    const shH = input.shutterHeight ?? fh;
    const gap = input.shutterGap ?? 0.02;
    if (!input.omitLeftShutter) {
      leftShutterEnv = {
        uMin: frameEnv.uMin - gap - shW,
        uMax: frameEnv.uMin - gap,
        vMin: input.vCenter - shH * 0.5,
        vMax: input.vCenter + shH * 0.5,
      };
    }
    if (!input.omitRightShutter) {
      rightShutterEnv = {
        uMin: frameEnv.uMax + gap,
        uMax: frameEnv.uMax + gap + shW,
        vMin: input.vCenter - shH * 0.5,
        vMax: input.vCenter + shH * 0.5,
      };
    }
  }

  let awningEnv: Envelope2D | undefined;
  if (
    (input.awningWidth ?? 0) > 0 &&
    input.awningBottomY !== undefined &&
    input.awningTopY !== undefined
  ) {
    const aw = input.awningWidth!;
    awningEnv = {
      uMin: input.uCenter - aw * 0.5,
      uMax: input.uCenter + aw * 0.5,
      vMin: input.awningBottomY,
      vMax: input.awningTopY,
    };
    const archTop = input.vCenter + fh * 0.5 + archCrown;
    if (archCrown > 0 && awningEnv.vMin < archTop - 0.005) {
      issues.push({
        code: 'AWNING_CLIPS_ARCH_CROWN',
        component: 'awning',
        message: `Awning bottom (${awningEnv.vMin.toFixed(3)}m) on "${input.id}" clips arch crown (${archTop.toFixed(3)}m).`,
      });
    }
  }

  const cornerMargin = input.wall.cornerMargin ?? 0;
  const corniceMargin = input.wall.corniceMargin ?? 0;
  const plinthMargin = input.wall.plinthMargin ?? 0;
  const wallUMin = input.wall.uMin + cornerMargin;
  const wallUMax = input.wall.uMax - cornerMargin;
  const wallVMin = input.wall.vMin + plinthMargin;
  const wallVMax = input.wall.vMax - corniceMargin;

  const components: Array<{
    name: FacadeWindowValidationIssue['component'];
    env: Envelope2D;
  }> = [{ name: 'frame', env: frameEnv }];
  if (sillEnv) components.push({ name: 'sill', env: sillEnv });
  if (leftShutterEnv) components.push({ name: 'left_shutter', env: leftShutterEnv });
  if (rightShutterEnv) components.push({ name: 'right_shutter', env: rightShutterEnv });
  if (awningEnv) components.push({ name: 'awning', env: awningEnv });

  const minObstacleClearance = input.minObstacleClearance ?? 0.005;

  for (const comp of components) {
    if (comp.env.uMin < wallUMin - 1e-5 || comp.env.uMax > wallUMax + 1e-5) {
      issues.push({
        code: 'OUT_OF_WALL_HORIZONTAL_BOUNDS',
        component: comp.name,
        message: `Component "${comp.name}" of "${input.id}" [${comp.env.uMin.toFixed(3)}, ${comp.env.uMax.toFixed(3)}] exceeds safe horizontal wall span [${wallUMin.toFixed(3)}, ${wallUMax.toFixed(3)}].`,
      });
    }
    if (comp.env.vMin < wallVMin - 1e-5 || comp.env.vMax > wallVMax + 1e-5) {
      issues.push({
        code: 'OUT_OF_WALL_VERTICAL_BOUNDS',
        component: comp.name,
        message: `Component "${comp.name}" of "${input.id}" [${comp.env.vMin.toFixed(3)}, ${comp.env.vMax.toFixed(3)}] exceeds safe elevation span [${wallVMin.toFixed(3)}, ${wallVMax.toFixed(3)}].`,
      });
    }
    for (const obs of input.obstacles ?? []) {
      if (overlaps2D(comp.env, obs, minObstacleClearance)) {
        issues.push({
          code: obstacleIssueCode(obs.kind),
          component: comp.name,
          obstacleId: obs.id,
          message: `Component "${comp.name}" of "${input.id}" clips ${obs.kind} "${obs.id}".`,
        });
      }
    }
  }

  return {
    valid: issues.length === 0,
    windowId: input.id,
    issues,
    envelopes: {
      frame: frameEnv,
      mullion: mullionEnv,
      sill: sillEnv,
      leftShutter: leftShutterEnv,
      rightShutter: rightShutterEnv,
      awning: awningEnv,
    },
  };
}
