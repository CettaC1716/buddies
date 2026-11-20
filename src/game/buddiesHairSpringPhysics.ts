import * as THREE from 'three';

/** Vector-like shape accepted from VRM metadata or gameplay state callers. */
export interface VrmVector3Like {
  x?: number;
  y?: number;
  z?: number;
}

export type Vector3Input =
  | THREE.Vector3
  | VrmVector3Like
  | readonly [number, number, number];

/** VRM 0.x `secondaryAnimation.boneGroups[i]` shape. */
export interface VrmSecondaryAnimationBoneGroup {
  comment?: string;
  stiffnessForce?: number;
  stiffness?: number;
  /** VRM 0.x spec exporters frequently emit the typo `stiffiness`. */
  stiffiness?: number;
  gravityPower?: number;
  gravityDir?: Vector3Input;
  dragForce?: number;
  center?: number | string | THREE.Object3D;
  hitRadius?: number;
  bones?: ReadonlyArray<number | string | THREE.Object3D>;
  colliderGroups?: ReadonlyArray<number | string>;
}

/** VRM 0.x `secondaryAnimation.colliderGroups[i]` collider entry. */
export interface VrmColliderShapeEntry {
  offset?: Vector3Input;
  tail?: Vector3Input;
  radius?: number;
}

/** VRM 0.x `secondaryAnimation.colliderGroups[i]` shape. */
export interface VrmSecondaryAnimationColliderGroup {
  name?: string;
  node?: number | string | THREE.Object3D;
  colliders?: ReadonlyArray<VrmColliderShapeEntry>;
}

/** VRM 0.x `secondaryAnimation` extension metadata. */
export interface VrmSecondaryAnimationMetadata {
  boneGroups?: ReadonlyArray<VrmSecondaryAnimationBoneGroup>;
  colliderGroups?: ReadonlyArray<VrmSecondaryAnimationColliderGroup>;
}

/** VRM 1.0 `VRMC_springBone` joint definition. */
export interface Vrm1SpringBoneJoint {
  node?: number | string | THREE.Object3D;
  hitRadius?: number;
  stiffness?: number;
  gravityPower?: number;
  gravityDir?: Vector3Input;
  dragForce?: number;
}

/** VRM 1.0 `VRMC_springBone` spring chain definition. */
export interface Vrm1SpringBoneSpring {
  name?: string;
  center?: number | string | THREE.Object3D;
  colliderGroups?: ReadonlyArray<number | string>;
  joints?: ReadonlyArray<Vrm1SpringBoneJoint>;
}

/** VRM 1.0 `VRMC_springBone` collider definition. */
export interface Vrm1SpringBoneCollider {
  node?: number | string | THREE.Object3D;
  shape?: {
    sphere?: { offset?: Vector3Input; radius?: number };
    capsule?: { offset?: Vector3Input; tail?: Vector3Input; radius?: number };
  };
}

/** VRM 1.0 `VRMC_springBone` extension metadata. */
export interface Vrm1SpringBoneExtension {
  colliders?: ReadonlyArray<Vrm1SpringBoneCollider>;
  colliderGroups?: ReadonlyArray<{ name?: string; colliders?: ReadonlyArray<number> }>;
  springs?: ReadonlyArray<Vrm1SpringBoneSpring>;
}

export type SecondaryPhysicsLodMode = 'full' | 'half' | 'sleep';

export interface SecondaryPhysicsLodContext {
  cameraDistanceM?: number;
  inFrustum?: boolean;
  isPlayer?: boolean;
}

/** Resolves distance + frustum LOD tier for character secondary hair/cloth physics. */
export function resolveSecondaryPhysicsLod(
  ctx?: SecondaryPhysicsLodContext | null,
): SecondaryPhysicsLodMode {
  if (!ctx || ctx.isPlayer) return 'full';
  if (ctx.inFrustum === false) return 'sleep';
  const dist = ctx.cameraDistanceM;
  if (dist === undefined || !Number.isFinite(dist)) return 'full';
  if (dist > 36) return 'sleep';
  if (dist >= 16) return 'half';
  return 'full';
}

export interface CharacterSecondaryPhysicsState {
  worldVelocity?: Vector3Input;
  angularYawRate?: number;
  windX?: number;
  windZ?: number;
  lod?: SecondaryPhysicsLodMode;
  skipRigMatrixWorldUpdate?: boolean;
}

export interface CharacterSecondaryPhysicsMetrics {
  boneChains: number;
  colliders: number;
  secondaryShaderHooks: number;
}

export interface CharacterSecondaryPhysicsOptions {
  vrmSecondaryAnimation?: VrmSecondaryAnimationMetadata | null;
  vrmSpringBone?: Vrm1SpringBoneExtension | null;
  gltf?: {
    parser?: {
      json?: Record<string, unknown>;
      associations?: Map<THREE.Object3D, { nodes?: number }>;
    };
    nodes?: ReadonlyArray<THREE.Object3D>;
    userData?: Record<string, unknown>;
  } | null;
  autoBuildColliders?: boolean;
  enableShaderFallback?: boolean;
  cloneMaterials?: boolean;
  forceShaderFallback?: boolean;
  stiffnessForce?: number;
  gravityPower?: number;
  dragForce?: number;
  hitRadius?: number;
  maxAngleRad?: number;
  maxDt?: number;
  teleportDistanceThreshold?: number;
  maxWorldSpeed?: number;
  windSensitivity?: number;
  bonePattern?: RegExp;
}

export interface CharacterSecondaryPhysicsController {
  update(dt: number, state?: CharacterSecondaryPhysicsState): void;
  reset(): void;
  dispose(): void;
  refresh(): void;
  readonly lodMode: SecondaryPhysicsLodMode;
  readonly metrics: CharacterSecondaryPhysicsMetrics;
}

export type SecondaryMeshKind = 'hair' | 'garment' | 'ribbon';

export interface AnatomicalBoneMap {
  head: THREE.Object3D | null;
  neck: THREE.Object3D | null;
  upperChest: THREE.Object3D | null;
  spine: THREE.Object3D | null;
  hips: THREE.Object3D | null;
  leftShoulder: THREE.Object3D | null;
  rightShoulder: THREE.Object3D | null;
  leftArm: THREE.Object3D | null;
  rightArm: THREE.Object3D | null;
  leftUpLeg: THREE.Object3D | null;
  rightUpLeg: THREE.Object3D | null;
}

export interface RigAnatomyMetrics {
  anatScale: number;
  worldScale: number;
  rigUpLocal: THREE.Vector3;
  rigForwardLocal: THREE.Vector3;
  rigRightLocal: THREE.Vector3;
  headBindPos: THREE.Vector3;
  headBindQuat: THREE.Quaternion;
  skullBindCenter: THREE.Vector3;
  skullBindRadius: number;
  hipsBindPos: THREE.Vector3;
  hipsBindQuat: THREE.Quaternion;
  charBindHeight: number;
  bindMatricesByBone: Map<THREE.Object3D, THREE.Matrix4>;
}

const DEFAULT_STIFFNESS = 1.05;
const DEFAULT_GRAVITY_POWER = 0.65;
const DEFAULT_DRAG_FORCE = 0.36;
const DEFAULT_HIT_RADIUS = 0.025;
const DEFAULT_MAX_ANGLE_RAD = 1.32;
const DEFAULT_MAX_DT = 0.05;
const DEFAULT_TELEPORT_THRESHOLD = 1.25;
const DEFAULT_MAX_WORLD_SPEED = 28;
const DEFAULT_WIND_SENSITIVITY = 1.0;

// Calibrated so stiffnessForce=1.0 gives ~2.4Hz natural hair bounce, matching VRM spring feel
const STIFFNESS_OMEGA_SQ = 235.0;
const GRAVITY_ACCEL_M_S2 = 9.81;
const WIND_ACCEL_GAIN = 2.65;
const TURN_WHIP_GAIN = 1.85;
const SUBSTEP_DT_TARGET = 1 / 60;
const MAX_SUBSTEPS = 4;

const ANATOMICAL_CORE_BONE_RE =
  /^(?:pelvisroot|hip|hips|spine\d*|chest|upperchest|neck|head|(?:left|right)(?:shoulder|clavicle|upperarm|arm|forearm|lowerarm|hand|thumb\d*|index\d*|middle\d*|ring\d*|pinky\d*|others\d*|upleg|upperleg|thigh|leg|lowerleg|calf|shin|foot|toes?|toebase|toesnull)|root|armature)(?:_?(?:translation|prerotation|rotation|postrotation|scale|end|null))?$/i;

const DEFAULT_SPRING_BONE_RE =
  /(?:hair|bangs?|fringe|pony_?tail|twin_?tail|ahoge|braid|strand|curl|lock|ribbon|scarf|tie|bow|cape|cloak|coat_?tail|skirt|dress|apron|tassel|feather|shawl|spring|sec_?bone)/i;

// Scalp/cap mount root bones (e.g. `Blitz_Hair_Root`) carry upper-crown skinning weights and
// must remain rigidly attached to `Head` instead of pivoting as dynamic spring chains.
const SCALP_ANCHOR_ROOT_BONE_RE = /(?:^|_)(?:hair|scalp|wig|fringe|bang)_?root$/i;

const LEAF_MARKER_BONE_RE = /(?:_end|_tip|_nub|_null|end)$/i;

const HAIR_MESH_RE =
  /(?:^hair_|_hair(?:$|_)|bangs|ponytail|twintail|braid|hairclip|ahoge|fringe)/i;

const RIBBON_MESH_RE =
  /(?:^neck_|scarf|ribbon|cravat|bowtie|shawl|collar|tassel|cape|cloak)/i;

const GARMENT_MESH_RE =
  /(?:skirt|dress|apron|tunic|kilt|coattail|coat_tail|cape|cloak)/i;

const _scV0 = new THREE.Vector3();
const _scV1 = new THREE.Vector3();
const _scV2 = new THREE.Vector3();
const _scQ0 = new THREE.Quaternion();
const _scQ1 = new THREE.Quaternion();
const _scM0 = new THREE.Matrix4();
const _scS0 = new THREE.Vector3();

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const span = edge1 - edge0;
  if (Math.abs(span) < 1e-6) return x >= edge1 ? 1 : 0;
  const t = clamp((x - edge0) / span, 0, 1);
  return t * t * (3 - 2 * t);
}

function readVector3Input(
  input: Vector3Input | undefined | null,
  out: THREE.Vector3,
  defX = 0,
  defY = 0,
  defZ = 0,
): THREE.Vector3 {
  if (!input) {
    return out.set(defX, defY, defZ);
  }
  if (Array.isArray(input)) {
    const x = Number(input[0]);
    const y = Number(input[1]);
    const z = Number(input[2]);
    return out.set(
      Number.isFinite(x) ? x : defX,
      Number.isFinite(y) ? y : defY,
      Number.isFinite(z) ? z : defZ,
    );
  }
  const vec = input as VrmVector3Like;
  const x = Number(vec.x);
  const y = Number(vec.y);
  const z = Number(vec.z);
  return out.set(
    Number.isFinite(x) ? x : defX,
    Number.isFinite(y) ? y : defY,
    Number.isFinite(z) ? z : defZ,
  );
}

let _colResX = 0;
let _colResY = 0;
let _colResZ = 0;
let _exQuatX = 0;
let _exQuatY = 0;
let _exQuatZ = 0;
let _exQuatW = 1;

function getUniformWorldScaleFromElements(e: THREE.Matrix4['elements']): number {
  const e0 = e[0], e1 = e[1], e2 = e[2];
  const e4 = e[4], e5 = e[5], e6 = e[6];
  const e8 = e[8], e9 = e[9], e10 = e[10];
  const sx = Math.sqrt(e0 * e0 + e1 * e1 + e2 * e2);
  const sy = Math.sqrt(e4 * e4 + e5 * e5 + e6 * e6);
  const sz = Math.sqrt(e8 * e8 + e9 * e9 + e10 * e10);
  const avg = (sx + sy + sz) * (1 / 3);
  return Number.isFinite(avg) && avg > 1e-5 ? avg : 1;
}

function getUniformWorldScale(obj: THREE.Object3D): number {
  return getUniformWorldScaleFromElements(obj.matrixWorld.elements);
}

/**
 * Extracts world rotation quaternion into `_exQuat{X,Y,Z,W}` and returns average uniform world scale
 * directly from column-major `Matrix4` elements without allocating or calling `Matrix4.decompose()`.
 */
function extractRotationQuatAndScaleFromMatrix4(matrixWorld: THREE.Matrix4): number {
  const e = matrixWorld.elements;
  const n11 = e[0];
  const n12 = e[4];
  const n13 = e[8];
  const n21 = e[1];
  const n22 = e[5];
  const n23 = e[9];
  const n31 = e[2];
  const n32 = e[6];
  const n33 = e[10];

  const absSx = Math.sqrt(n11 * n11 + n21 * n21 + n31 * n31);
  const sy = Math.sqrt(n12 * n12 + n22 * n22 + n32 * n32);
  const sz = Math.sqrt(n13 * n13 + n23 * n23 + n33 * n33);

  const det =
    n11 * (n22 * n33 - n32 * n23) -
    n12 * (n21 * n33 - n31 * n23) +
    n13 * (n21 * n32 - n31 * n22);
  const sx = det < 0 ? -absSx : absSx;

  const invSx = sx !== 0 ? 1 / sx : 0;
  const invSy = sy > 1e-12 ? 1 / sy : 0;
  const invSz = sz > 1e-12 ? 1 / sz : 0;

  const m11 = n11 * invSx;
  const m12 = n12 * invSy;
  const m13 = n13 * invSz;
  const m21 = n21 * invSx;
  const m22 = n22 * invSy;
  const m23 = n23 * invSz;
  const m31 = n31 * invSx;
  const m32 = n32 * invSy;
  const m33 = n33 * invSz;

  const trace = m11 + m22 + m33;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1.0);
    _exQuatW = 0.25 / s;
    _exQuatX = (m32 - m23) * s;
    _exQuatY = (m13 - m31) * s;
    _exQuatZ = (m21 - m12) * s;
  } else if (m11 > m22 && m11 > m33) {
    const s = 2.0 * Math.sqrt(Math.max(1e-12, 1.0 + m11 - m22 - m33));
    _exQuatW = (m32 - m23) / s;
    _exQuatX = 0.25 * s;
    _exQuatY = (m12 + m21) / s;
    _exQuatZ = (m13 + m31) / s;
  } else if (m22 > m33) {
    const s = 2.0 * Math.sqrt(Math.max(1e-12, 1.0 + m22 - m11 - m33));
    _exQuatW = (m13 - m31) / s;
    _exQuatX = (m12 + m21) / s;
    _exQuatY = 0.25 * s;
    _exQuatZ = (m23 + m32) / s;
  } else {
    const s = 2.0 * Math.sqrt(Math.max(1e-12, 1.0 + m33 - m11 - m22));
    _exQuatW = (m21 - m12) / s;
    _exQuatX = (m13 + m31) / s;
    _exQuatY = (m23 + m32) / s;
    _exQuatZ = 0.25 * s;
  }

  const avg = (absSx + sy + sz) * (1 / 3);
  return Number.isFinite(avg) && avg > 1e-5 ? avg : 1;
}

function decomposeWorldRotationAndScale(
  matrixWorld: THREE.Matrix4,
  outQuat: THREE.Quaternion,
): number {
  const avg = extractRotationQuatAndScaleFromMatrix4(matrixWorld);
  outQuat.set(_exQuatX, _exQuatY, _exQuatZ, _exQuatW);
  return avg;
}

/** Strips Mixamo, VRM (`J_Bip_*`), and glTF transform wrapper suffixes cleanly. */
export function normalizeCharacterBoneName(rawName: string): string {
  let s = rawName.trim();
  s = s.replace(/^mixamorig\d*[:_]?/i, '');
  s = s.replace(/^J_Bip_[CLR]_/i, '');
  s = s.replace(/^Character\d*_/i, '');
  return s;
}

/** Sphere collider anchored to an anatomical `THREE.Object3D` / `THREE.Bone`. */
export class SpringBoneColliderSphere {
  public readonly kind = 'sphere' as const;
  public readonly node: THREE.Object3D;
  public readonly offset: THREE.Vector3;
  public radius: number;
  public readonly anchorName: string;

  public readonly worldCenter = new THREE.Vector3();
  public worldRadius = 0;
  private wcx = 0;
  private wcy = 0;
  private wcz = 0;

  constructor(
    node: THREE.Object3D,
    offset: THREE.Vector3 = new THREE.Vector3(),
    radius = 0.08,
    anchorName = 'sphere',
  ) {
    this.node = node;
    this.offset = offset.clone();
    this.radius = Math.max(0.001, radius);
    this.anchorName = anchorName;
    this.updateWorldTransform();
  }

  public updateWorldTransform(): void {
    const e = this.node.matrixWorld.elements;
    const ox = this.offset.x;
    const oy = this.offset.y;
    const oz = this.offset.z;
    const cx = e[0] * ox + e[4] * oy + e[8] * oz + e[12];
    const cy = e[1] * ox + e[5] * oy + e[9] * oz + e[13];
    const cz = e[2] * ox + e[6] * oy + e[10] * oz + e[14];
    this.wcx = cx;
    this.wcy = cy;
    this.wcz = cz;
    this.worldCenter.set(cx, cy, cz);
    this.worldRadius = this.radius * getUniformWorldScaleFromElements(e);
  }

  /** Fast scalar pushout storing pushed coordinates in `_colRes{X,Y,Z}` when colliding. */
  public resolvePointXYZ(wx: number, wy: number, wz: number, hitRadius: number): boolean {
    const cx = this.wcx;
    const cy = this.wcy;
    const cz = this.wcz;
    const minDist = this.worldRadius + (hitRadius > 0 ? hitRadius : 0);
    const dx = wx - cx;
    const dy = wy - cy;
    const dz = wz - cz;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq >= minDist * minDist) {
      return false;
    }
    if (distSq > 1e-10) {
      const k = minDist / Math.sqrt(distSq);
      _colResX = cx + dx * k;
      _colResY = cy + dy * k;
      _colResZ = cz + dz * k;
    } else {
      _colResX = cx;
      _colResY = cy;
      _colResZ = cz + minDist;
    }
    return true;
  }

  /** Pushes `outPos` (or `worldPos` in-place) outside `worldRadius + hitRadius` with zero allocations. */
  public resolveCollision(
    worldPos: THREE.Vector3,
    hitRadius: number,
    outPos: THREE.Vector3 = worldPos,
  ): boolean {
    if (!this.resolvePointXYZ(worldPos.x, worldPos.y, worldPos.z, hitRadius)) {
      if (outPos !== worldPos) outPos.copy(worldPos);
      return false;
    }
    outPos.set(_colResX, _colResY, _colResZ);
    return true;
  }
}

/** Capsule collider anchored along a local `[offset, tail]` segment on a `THREE.Object3D`. */
export class SpringBoneColliderCapsule {
  public readonly kind = 'capsule' as const;
  public readonly node: THREE.Object3D;
  public readonly offset: THREE.Vector3;
  public readonly tail: THREE.Vector3;
  public radius: number;
  public readonly anchorName: string;

  public readonly worldStart = new THREE.Vector3();
  public readonly worldEnd = new THREE.Vector3();
  public worldRadius = 0;
  private wsx = 0;
  private wsy = 0;
  private wsz = 0;
  private segX = 0;
  private segY = 0;
  private segZ = 0;
  private invSegLenSq = 0;

  constructor(
    node: THREE.Object3D,
    offset: THREE.Vector3 = new THREE.Vector3(),
    tail: THREE.Vector3 = new THREE.Vector3(0, 0.1, 0),
    radius = 0.06,
    anchorName = 'capsule',
  ) {
    this.node = node;
    this.offset = offset.clone();
    this.tail = tail.clone();
    this.radius = Math.max(0.001, radius);
    this.anchorName = anchorName;
    this.updateWorldTransform();
  }

  public updateWorldTransform(): void {
    const e = this.node.matrixWorld.elements;
    const ox = this.offset.x;
    const oy = this.offset.y;
    const oz = this.offset.z;
    const tx = this.tail.x;
    const ty = this.tail.y;
    const tz = this.tail.z;

    const sx = e[0] * ox + e[4] * oy + e[8] * oz + e[12];
    const sy = e[1] * ox + e[5] * oy + e[9] * oz + e[13];
    const sz = e[2] * ox + e[6] * oy + e[10] * oz + e[14];
    const ex = e[0] * tx + e[4] * ty + e[8] * tz + e[12];
    const ey = e[1] * tx + e[5] * ty + e[9] * tz + e[13];
    const ez = e[2] * tx + e[6] * ty + e[10] * tz + e[14];

    this.wsx = sx;
    this.wsy = sy;
    this.wsz = sz;
    this.worldStart.set(sx, sy, sz);
    this.worldEnd.set(ex, ey, ez);
    this.segX = ex - sx;
    this.segY = ey - sy;
    this.segZ = ez - sz;
    const segLenSq = this.segX * this.segX + this.segY * this.segY + this.segZ * this.segZ;
    this.invSegLenSq = segLenSq > 1e-10 ? 1 / segLenSq : 0;
    this.worldRadius = this.radius * getUniformWorldScaleFromElements(e);
  }

  /** Fast scalar pushout using precomputed segment vector; writes `_colRes{X,Y,Z}` when colliding. */
  public resolvePointXYZ(wx: number, wy: number, wz: number, hitRadius: number): boolean {
    const sx = this.wsx;
    const sy = this.wsy;
    const wsz = this.wsz;
    const vx = wx - sx;
    const vy = wy - sy;
    const vz = wz - wsz;

    let ax = sx;
    let ay = sy;
    let az = wsz;
    if (this.invSegLenSq > 0) {
      let t = (vx * this.segX + vy * this.segY + vz * this.segZ) * this.invSegLenSq;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      ax = sx + this.segX * t;
      ay = sy + this.segY * t;
      az = wsz + this.segZ * t;
    }

    const dx = wx - ax;
    const dy = wy - ay;
    const dz = wz - az;
    const distSq = dx * dx + dy * dy + dz * dz;
    const minDist = this.worldRadius + (hitRadius > 0 ? hitRadius : 0);
    if (distSq >= minDist * minDist) {
      return false;
    }
    if (distSq > 1e-10) {
      const k = minDist / Math.sqrt(distSq);
      _colResX = ax + dx * k;
      _colResY = ay + dy * k;
      _colResZ = az + dz * k;
    } else {
      _colResX = ax;
      _colResY = ay;
      _colResZ = az + minDist;
    }
    return true;
  }

  /** Pushes `outPos` (or `worldPos` in-place) outside the capsule radius + `hitRadius` with zero allocations. */
  public resolveCollision(
    worldPos: THREE.Vector3,
    hitRadius: number,
    outPos: THREE.Vector3 = worldPos,
  ): boolean {
    if (!this.resolvePointXYZ(worldPos.x, worldPos.y, worldPos.z, hitRadius)) {
      if (outPos !== worldPos) outPos.copy(worldPos);
      return false;
    }
    outPos.set(_colResX, _colResY, _colResZ);
    return true;
  }
}

export type SpringBoneCollider = SpringBoneColliderSphere | SpringBoneColliderCapsule;

/** Resolves standard Mixamo, `PelvisRoot`, and VRM humanoid bone aliases on `rigRoot`. */
export function resolveAnatomicalBoneMap(rigRoot: THREE.Object3D): AnatomicalBoneMap {
  const byNorm = new Map<string, THREE.Object3D>();
  rigRoot.traverse((node) => {
    if (!node.name) return;
    if (/^(?:.*_)?(?:Translation|PreRotation|Rotation|PostRotation|Scale)$/i.test(node.name)) {
      return;
    }
    const norm = normalizeCharacterBoneName(node.name).toLowerCase();
    const existing = byNorm.get(norm);
    // Prefer actual THREE.Bone over mesh wrapper nodes when both share a name
    if (!existing || (!(existing as THREE.Bone).isBone && (node as THREE.Bone).isBone)) {
      byNorm.set(norm, node);
    }
  });

  const pick = (...aliases: string[]): THREE.Object3D | null => {
    for (const alias of aliases) {
      const found = byNorm.get(alias.toLowerCase());
      if (found) return found;
    }
    return null;
  };

  return {
    head: pick('head'),
    neck: pick('neck'),
    upperChest: pick('spine02', 'spine2', 'upperchest', 'upper_chest', 'chest'),
    spine: pick('spine01', 'spine1', 'spine', 'chest'),
    hips: pick('hips', 'hip', 'pelvis'),
    leftShoulder: pick('leftshoulder', 'left_shoulder', 'shoulder_l'),
    rightShoulder: pick('rightshoulder', 'right_shoulder', 'shoulder_r'),
    leftArm: pick('leftarm', 'leftupperarm', 'left_upper_arm', 'upper_arm_l'),
    rightArm: pick('rightarm', 'rightupperarm', 'right_upper_arm', 'upper_arm_r'),
    leftUpLeg: pick('leftupleg', 'leftupperleg', 'leftthigh', 'thigh_l'),
    rightUpLeg: pick('rightupleg', 'rightupperleg', 'rightthigh', 'thigh_r'),
  };
}

/**
 * Extracts exact T-pose bind matrices (using `SkinnedMesh.skeleton.boneInverses` when available)
 * and canonical rig axes so colliders and shader displacements align accurately even on
 * pre-rotated `PelvisRoot` skeletons or already-posed rigs.
 */
export function computeRigAnatomyMetrics(
  rigRoot: THREE.Object3D,
  bones: AnatomicalBoneMap = resolveAnatomicalBoneMap(rigRoot),
): RigAnatomyMetrics {
  rigRoot.updateMatrixWorld(true);

  const bindMatricesByBone = new Map<THREE.Object3D, THREE.Matrix4>();
  let referenceMesh: THREE.SkinnedMesh | null = null;
  rigRoot.traverse((node) => {
    const sm = node as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh || !sm.skeleton) return;
    if (!referenceMesh) referenceMesh = sm;
    const skelBones = sm.skeleton.bones;
    const skelInvs = sm.skeleton.boneInverses;
    for (let i = 0; i < skelBones.length; i++) {
      const b = skelBones[i];
      const inv = skelInvs[i];
      if (!b || !inv || bindMatricesByBone.has(b)) continue;
      if (Math.abs(inv.determinant()) < 1e-10) continue;
      const bindMat = new THREE.Matrix4().copy(inv).invert();
      if (sm.bindMatrix && Math.abs(sm.bindMatrix.determinant()) > 1e-10) {
        bindMat.premultiply(sm.bindMatrix);
      }
      bindMatricesByBone.set(b, bindMat);
    }
  });

  const rigWorldScale = getUniformWorldScale(rigRoot);
  const rigInvWorld = new THREE.Matrix4().copy(rigRoot.matrixWorld).invert();
  const refSkelWorld = referenceMesh
    ? (referenceMesh as THREE.SkinnedMesh).matrixWorld
    : rigRoot.matrixWorld;
  const refWorldScale = getUniformWorldScale(referenceMesh ?? rigRoot);

  const readBindPoseInRigSpace = (
    obj: THREE.Object3D | null,
    outPos: THREE.Vector3,
    outQuat: THREE.Quaternion,
  ): boolean => {
    if (!obj) return false;
    const bindMat = bindMatricesByBone.get(obj);
    if (bindMat) {
      // bindMat is in reference SkinnedMesh local space; lift to rigRoot local space
      _scM0.multiplyMatrices(refSkelWorld, bindMat);
      _scM0.premultiply(rigInvWorld);
      _scM0.decompose(outPos, outQuat, _scS0);
      return true;
    }
    _scM0.multiplyMatrices(rigInvWorld, obj.matrixWorld);
    _scM0.decompose(outPos, outQuat, _scS0);
    return true;
  };

  const headBindPos = new THREE.Vector3(0, 1.4, -0.066);
  const headBindQuat = new THREE.Quaternion();
  const hasHead = readBindPoseInRigSpace(bones.head, headBindPos, headBindQuat);

  const hipsBindPos = new THREE.Vector3(0, 0.84, 0);
  const hipsBindQuat = new THREE.Quaternion();
  const hasHips = readBindPoseInRigSpace(bones.hips, hipsBindPos, hipsBindQuat);

  const neckBindPos = new THREE.Vector3();
  const neckBindQuat = new THREE.Quaternion();
  const hasNeck = readBindPoseInRigSpace(bones.neck, neckBindPos, neckBindQuat);

  const lShoulderPos = new THREE.Vector3();
  const rShoulderPos = new THREE.Vector3();
  const hasLSh = readBindPoseInRigSpace(bones.leftShoulder, lShoulderPos, _scQ0);
  const hasRSh = readBindPoseInRigSpace(bones.rightShoulder, rShoulderPos, _scQ0);

  // Measure anatomical scale relative to standard ~1.6m GLB space (where Head-Hips ≈ 0.56m)
  let anatScale = 1.0;
  if (hasHead && hasHips) {
    const d = headBindPos.distanceTo(hipsBindPos);
    if (d > 0.15) anatScale = clamp(d / 0.56, 0.35, 4.0);
  } else if (hasHead && hasNeck) {
    const d = headBindPos.distanceTo(neckBindPos);
    if (d > 0.02) anatScale = clamp(d / 0.076, 0.35, 4.0);
  } else if (hasLSh && hasRSh) {
    const d = lShoulderPos.distanceTo(rShoulderPos);
    if (d > 0.02) anatScale = clamp(d / 0.084, 0.35, 4.0);
  }

  // Convert rig-local anatScale if rigRoot and reference SkinnedMesh differ in local scale
  const meshToRigRatio =
    rigWorldScale > 1e-5 ? refWorldScale / rigWorldScale : 1.0;
  const meshAnatScale = anatScale / Math.max(1e-4, meshToRigRatio);

  const rigUpLocal = new THREE.Vector3(0, 1, 0);
  if (hasHead && hasHips) {
    _scV0.subVectors(headBindPos, hipsBindPos);
    if (_scV0.lengthSq() > 1e-6) rigUpLocal.copy(_scV0).normalize();
  }
  const rigRightLocal = new THREE.Vector3(-1, 0, 0);
  if (hasLSh && hasRSh) {
    // Character's anatomical left shoulder sits at +X in Blitz/Mixamo T-pose
    _scV0.subVectors(rShoulderPos, lShoulderPos);
    if (_scV0.lengthSq() > 1e-6) rigRightLocal.copy(_scV0).normalize();
  }
  const rigForwardLocal = new THREE.Vector3()
    .crossVectors(rigUpLocal, rigRightLocal)
    .normalize();
  if (rigForwardLocal.lengthSq() < 1e-6) {
    rigForwardLocal.set(0, 0, 1);
  }

  // Also transform head/hips bind positions into SkinnedMesh bind-pose coordinates for shader use
  const headMeshBindPos = new THREE.Vector3(0, 1.398 * meshAnatScale, -0.066 * meshAnatScale);
  const headMeshBindQuat = new THREE.Quaternion();
  if (bones.head) {
    const bindMat = bindMatricesByBone.get(bones.head);
    if (bindMat) {
      bindMat.decompose(headMeshBindPos, headMeshBindQuat, _scS0);
    } else if (referenceMesh) {
      _scM0.copy((referenceMesh as THREE.SkinnedMesh).matrixWorld).invert().multiply(bones.head.matrixWorld);
      _scM0.decompose(headMeshBindPos, headMeshBindQuat, _scS0);
    } else {
      headMeshBindPos.copy(headBindPos);
      headMeshBindQuat.copy(headBindQuat);
    }
  }

  const hipsMeshBindPos = new THREE.Vector3(0, 0.837 * meshAnatScale, 0);
  const hipsMeshBindQuat = new THREE.Quaternion();
  if (bones.hips) {
    const bindMat = bindMatricesByBone.get(bones.hips);
    if (bindMat) {
      bindMat.decompose(hipsMeshBindPos, hipsMeshBindQuat, _scS0);
    } else {
      hipsMeshBindPos.copy(hipsBindPos);
      hipsMeshBindQuat.copy(hipsBindQuat);
    }
  }

  const skullBindRadius = 0.086 * meshAnatScale;
  const skullBindCenter = new THREE.Vector3(
    headMeshBindPos.x,
    headMeshBindPos.y + 0.068 * meshAnatScale,
    headMeshBindPos.z + 0.012 * meshAnatScale,
  );

  // If a `SkinnedMesh` `head_*` mesh exists, refine skullBindCenter directly from its bind-pose bounds
  rigRoot.traverse((node) => {
    const m = node as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh || !m.geometry) return;
    const lower = (m.name || '').toLowerCase();
    if (!lower.startsWith('head') || lower.includes('outline')) return;
    const posAttr = m.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!posAttr || posAttr.count < 12) return;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    if (Number.isFinite(minY) && maxY > minY) {
      skullBindCenter.set(
        (minX + maxX) * 0.5,
        minY + (maxY - minY) * 0.56,
        (minZ + maxZ) * 0.5,
      );
    }
  });

  return {
    anatScale: meshAnatScale,
    worldScale: refWorldScale,
    rigUpLocal,
    rigForwardLocal,
    rigRightLocal,
    headBindPos: headMeshBindPos,
    headBindQuat: headMeshBindQuat,
    skullBindCenter,
    skullBindRadius,
    hipsBindPos: hipsMeshBindPos,
    hipsBindQuat: hipsMeshBindQuat,
    charBindHeight: 1.58 * meshAnatScale,
    bindMatricesByBone,
  };
}

/**
 * Converts a rig-space offset vector into a target bone's true local coordinate system,
 * automatically compensating for Mixamo/`PelvisRoot` bone pre-rotations.
 */
function rigOffsetToBoneLocal(
  bone: THREE.Object3D,
  rigSpaceOffset: THREE.Vector3,
  anatomy: RigAnatomyMetrics,
  rigRoot: THREE.Object3D,
): THREE.Vector3 {
  const bindMat = anatomy.bindMatricesByBone.get(bone);
  if (bindMat) {
    bindMat.decompose(_scV0, _scQ0, _scS0);
    const local = rigSpaceOffset.clone().applyQuaternion(_scQ0.invert());
    const avgScale = (Math.abs(_scS0.x) + Math.abs(_scS0.y) + Math.abs(_scS0.z)) / 3;
    if (avgScale > 1e-5) local.divideScalar(avgScale);
    return local;
  }
  // Fallback using live matrixWorld relative to rigRoot
  const rigScale = getUniformWorldScale(rigRoot);
  const boneScale = getUniformWorldScale(bone);
  rigRoot.matrixWorld.decompose(_scV0, _scQ0, _scS0);
  bone.matrixWorld.decompose(_scV0, _scQ1, _scS0);
  const relQuat = _scQ1.invert().multiply(_scQ0);
  const local = rigSpaceOffset.clone().applyQuaternion(relQuat);
  const ratio = boneScale > 1e-5 ? rigScale / boneScale : 1;
  return local.multiplyScalar(ratio);
}

/**
 * Auto-builds anatomical `SpringBoneColliderSphere` and `SpringBoneColliderCapsule` colliders
 * anchored to `Head`, `Neck`, `Spine2`/`UpperChest`, `LeftShoulder`/`RightShoulder`, and `Hips`.
 */
export function buildAnatomicalCharacterColliders(
  rigRoot: THREE.Object3D,
  bones: AnatomicalBoneMap = resolveAnatomicalBoneMap(rigRoot),
  anatomy: RigAnatomyMetrics = computeRigAnatomyMetrics(rigRoot, bones),
): SpringBoneCollider[] {
  rigRoot.updateMatrixWorld(true);
  const colliders: SpringBoneCollider[] = [];
  const s = anatomy.anatScale;

  const makeRigVec = (right: number, up: number, forward: number): THREE.Vector3 => {
    const out = new THREE.Vector3();
    out.addScaledVector(anatomy.rigRightLocal, right);
    out.addScaledVector(anatomy.rigUpLocal, up);
    out.addScaledVector(anatomy.rigForwardLocal, forward);
    return out;
  };

  if (bones.head) {
    // Cranium sphere + face/jaw capsule prevent bangs and side locks from entering the skull
    const craniumOffset = rigOffsetToBoneLocal(
      bones.head,
      makeRigVec(0, 0.068 * s, 0.012 * s),
      anatomy,
      rigRoot,
    );
    colliders.push(
      new SpringBoneColliderSphere(bones.head, craniumOffset, 0.086 * s, 'Head_Cranium'),
    );
    const faceStart = rigOffsetToBoneLocal(
      bones.head,
      makeRigVec(0, 0.022 * s, 0.020 * s),
      anatomy,
      rigRoot,
    );
    const faceEnd = rigOffsetToBoneLocal(
      bones.head,
      makeRigVec(0, 0.078 * s, 0.006 * s),
      anatomy,
      rigRoot,
    );
    colliders.push(
      new SpringBoneColliderCapsule(bones.head, faceStart, faceEnd, 0.074 * s, 'Head_Face'),
    );
  }

  if (bones.neck) {
    const neckStart = rigOffsetToBoneLocal(
      bones.neck,
      makeRigVec(0, -0.012 * s, 0),
      anatomy,
      rigRoot,
    );
    const neckEnd = rigOffsetToBoneLocal(
      bones.neck,
      makeRigVec(0, 0.078 * s, 0),
      anatomy,
      rigRoot,
    );
    colliders.push(
      new SpringBoneColliderCapsule(bones.neck, neckStart, neckEnd, 0.048 * s, 'Neck_Column'),
    );
  }

  const chestAnchor = bones.upperChest ?? bones.spine;
  if (chestAnchor) {
    const chestStart = rigOffsetToBoneLocal(
      chestAnchor,
      makeRigVec(0, 0.015 * s, 0.005 * s),
      anatomy,
      rigRoot,
    );
    const chestEnd = rigOffsetToBoneLocal(
      chestAnchor,
      makeRigVec(0, 0.145 * s, -0.020 * s),
      anatomy,
      rigRoot,
    );
    colliders.push(
      new SpringBoneColliderCapsule(chestAnchor, chestStart, chestEnd, 0.105 * s, 'Spine2_Ribcage'),
    );

    // Wide collarbone / pectoral shelf capsule so long hair drapes over chest and back
    const clavStart = rigOffsetToBoneLocal(
      chestAnchor,
      makeRigVec(-0.058 * s, 0.088 * s, -0.005 * s),
      anatomy,
      rigRoot,
    );
    const clavEnd = rigOffsetToBoneLocal(
      chestAnchor,
      makeRigVec(0.058 * s, 0.088 * s, -0.005 * s),
      anatomy,
      rigRoot,
    );
    colliders.push(
      new SpringBoneColliderCapsule(chestAnchor, clavStart, clavEnd, 0.088 * s, 'UpperChest_Clavicle'),
    );
  }

  const addShoulderCollider = (
    shoulder: THREE.Object3D | null,
    arm: THREE.Object3D | null,
    sideSign: number,
    label: string,
  ) => {
    if (!shoulder) return;
    let localEnd: THREE.Vector3;
    if (arm && arm.parent === shoulder) {
      localEnd = arm.position.clone().multiplyScalar(0.95);
    } else if (arm) {
      shoulder.updateWorldMatrix(true, false);
      arm.updateWorldMatrix(true, false);
      arm.getWorldPosition(_scV0);
      localEnd = shoulder.worldToLocal(_scV0.clone()).multiplyScalar(0.95);
    } else {
      localEnd = rigOffsetToBoneLocal(
        shoulder,
        makeRigVec(sideSign * 0.095 * s, 0.006 * s, -0.036 * s),
        anatomy,
        rigRoot,
      );
    }
    if (localEnd.lengthSq() < 1e-6) {
      localEnd.set(sideSign * 0.09 * s, 0, 0);
    }
    colliders.push(
      new SpringBoneColliderCapsule(shoulder, new THREE.Vector3(0, 0, 0), localEnd, 0.056 * s, label),
    );
  };

  addShoulderCollider(bones.leftShoulder, bones.leftArm, -1, 'LeftShoulder_Deltoid');
  addShoulderCollider(bones.rightShoulder, bones.rightArm, 1, 'RightShoulder_Deltoid');

  if (bones.hips) {
    const hipL = rigOffsetToBoneLocal(
      bones.hips,
      makeRigVec(-0.058 * s, 0.025 * s, -0.005 * s),
      anatomy,
      rigRoot,
    );
    const hipR = rigOffsetToBoneLocal(
      bones.hips,
      makeRigVec(0.058 * s, 0.025 * s, -0.005 * s),
      anatomy,
      rigRoot,
    );
    colliders.push(
      new SpringBoneColliderCapsule(bones.hips, hipL, hipR, 0.108 * s, 'Hips_Pelvis'),
    );
  }

  if (bones.spine && bones.spine !== chestAnchor) {
    const waistStart = rigOffsetToBoneLocal(
      bones.spine,
      makeRigVec(0, 0, 0),
      anatomy,
      rigRoot,
    );
    const waistEnd = rigOffsetToBoneLocal(
      bones.spine,
      makeRigVec(0, 0.115 * s, 0),
      anatomy,
      rigRoot,
    );
    colliders.push(
      new SpringBoneColliderCapsule(bones.spine, waistStart, waistEnd, 0.094 * s, 'Spine_Waist'),
    );
  }

  return colliders;
}

export interface ParsedSpringBoneChain {
  name: string;
  bones: THREE.Bone[];
  stiffnessForce: number;
  gravityPower: number;
  gravityDir: THREE.Vector3;
  dragForce: number;
  hitRadius: number;
  colliders: SpringBoneCollider[];
  center?: THREE.Object3D | null;
}

/** Resolves VRM 0.x `secondaryAnimation` or VRM 1.0 `VRMC_springBone` definitions into normalized chains + colliders. */
export function extractVrmSecondaryAnimationMetadata(
  rigRoot: THREE.Object3D,
  options: CharacterSecondaryPhysicsOptions = {},
): { chains: ParsedSpringBoneChain[]; colliders: SpringBoneCollider[] } | null {
  const gltfJson = options.gltf?.parser?.json as
    | {
        nodes?: Array<{ name?: string }>;
        extensions?: {
          VRM?: { secondaryAnimation?: VrmSecondaryAnimationMetadata };
          VRMC_springBone?: Vrm1SpringBoneExtension;
        };
      }
    | undefined;
  const userData = rigRoot.userData as
    | {
        vrm?: { secondaryAnimation?: VrmSecondaryAnimationMetadata };
        secondaryAnimation?: VrmSecondaryAnimationMetadata;
        gltfExtensions?: {
          VRM?: { secondaryAnimation?: VrmSecondaryAnimationMetadata };
          VRMC_springBone?: Vrm1SpringBoneExtension;
        };
      }
    | undefined;
  const gltfUserData = options.gltf?.userData as
    | {
        vrm?: { secondaryAnimation?: VrmSecondaryAnimationMetadata };
        secondaryAnimation?: VrmSecondaryAnimationMetadata;
        gltfExtensions?: {
          VRM?: { secondaryAnimation?: VrmSecondaryAnimationMetadata };
          VRMC_springBone?: Vrm1SpringBoneExtension;
        };
      }
    | undefined;

  const vrm0Meta =
    options.vrmSecondaryAnimation ??
    userData?.vrm?.secondaryAnimation ??
    userData?.secondaryAnimation ??
    userData?.gltfExtensions?.VRM?.secondaryAnimation ??
    gltfUserData?.vrm?.secondaryAnimation ??
    gltfUserData?.secondaryAnimation ??
    gltfUserData?.gltfExtensions?.VRM?.secondaryAnimation ??
    gltfJson?.extensions?.VRM?.secondaryAnimation ??
    null;

  const vrm1Meta =
    options.vrmSpringBone ??
    userData?.gltfExtensions?.VRMC_springBone ??
    gltfUserData?.gltfExtensions?.VRMC_springBone ??
    gltfJson?.extensions?.VRMC_springBone ??
    null;

  if (!vrm0Meta && !vrm1Meta) {
    return null;
  }

  const nodeList: THREE.Object3D[] = [];
  const nodeByName = new Map<string, THREE.Object3D>();
  const nodeByIndex = new Map<number, THREE.Object3D>();

  rigRoot.traverse((obj) => {
    nodeList.push(obj);
    if (obj.name && !nodeByName.has(obj.name)) {
      nodeByName.set(obj.name, obj);
    }
    const assoc = options.gltf?.parser?.associations?.get(obj);
    if (assoc && typeof assoc.nodes === 'number') {
      nodeByIndex.set(assoc.nodes, obj);
    }
  });

  if (options.gltf?.nodes) {
    for (let i = 0; i < options.gltf.nodes.length; i++) {
      if (!nodeByIndex.has(i) && options.gltf.nodes[i]) {
        nodeByIndex.set(i, options.gltf.nodes[i]);
      }
    }
  }

  const resolveObjectRef = (ref: number | string | THREE.Object3D | undefined | null): THREE.Object3D | null => {
    if (ref == null) return null;
    if (typeof ref === 'object' && (ref as THREE.Object3D).isObject3D) {
      return ref as THREE.Object3D;
    }
    if (typeof ref === 'string') {
      return nodeByName.get(ref) ?? rigRoot.getObjectByName(ref) ?? null;
    }
    if (typeof ref === 'number' && Number.isInteger(ref) && ref >= 0) {
      const mapped = nodeByIndex.get(ref);
      if (mapped) return mapped;
      const jsonName = gltfJson?.nodes?.[ref]?.name;
      if (jsonName) {
        const byJsonName = nodeByName.get(jsonName) ?? rigRoot.getObjectByName(jsonName);
        if (byJsonName) return byJsonName;
      }
      return nodeList[ref] ?? null;
    }
    return null;
  };

  const resolveBoneChainFromRoot = (rootBone: THREE.Bone, explicitSet: Set<THREE.Object3D>): THREE.Bone[] => {
    // VRM 0.x lists root bones and recurses down children; if caller listed sequential joints, stop before duplicating them
    const chain: THREE.Bone[] = [rootBone];
    let cursor: THREE.Object3D = rootBone;
    while (cursor.children.length > 0) {
      const boneChildren = cursor.children.filter(
        (c): c is THREE.Bone => (c as THREE.Bone).isBone,
      );
      if (boneChildren.length === 0) break;
      const next = boneChildren[0];
      if (explicitSet.has(next)) {
        // Explicit sequential listing; caller's loop handles remaining entries
        break;
      }
      if (LEAF_MARKER_BONE_RE.test(next.name) && next.children.length === 0) {
        break;
      }
      chain.push(next);
      cursor = next;
    }
    return chain;
  };

  const allColliders: SpringBoneCollider[] = [];
  const chains: ParsedSpringBoneChain[] = [];

  if (vrm0Meta) {
    const groupCollidersByIndex = new Map<number, SpringBoneCollider[]>();
    const groupCollidersByName = new Map<string, SpringBoneCollider[]>();
    const rawGroups = vrm0Meta.colliderGroups ?? [];
    for (let gi = 0; gi < rawGroups.length; gi++) {
      const grp = rawGroups[gi];
      const hostNode = resolveObjectRef(grp.node);
      const list: SpringBoneCollider[] = [];
      if (hostNode) {
        for (let ci = 0; ci < (grp.colliders ?? []).length; ci++) {
          const c = grp.colliders![ci];
          const offset = readVector3Input(c.offset, new THREE.Vector3());
          const radius = Number.isFinite(Number(c.radius)) ? Math.max(0.001, Number(c.radius)) : 0.05;
          const col = c.tail
            ? new SpringBoneColliderCapsule(
                hostNode,
                offset,
                readVector3Input(c.tail, new THREE.Vector3()),
                radius,
                `VRM_Capsule_${gi}_${ci}`,
              )
            : new SpringBoneColliderSphere(hostNode, offset, radius, `VRM_Sphere_${gi}_${ci}`);
          list.push(col);
          allColliders.push(col);
        }
      }
      groupCollidersByIndex.set(gi, list);
      if (grp.name) groupCollidersByName.set(grp.name, list);
    }

    const boneGroups = vrm0Meta.boneGroups ?? [];
    for (let bgi = 0; bgi < boneGroups.length; bgi++) {
      const bg = boneGroups[bgi];
      const stiffnessRaw = bg.stiffnessForce ?? bg.stiffness ?? bg.stiffiness;
      const stiffnessForce = Number.isFinite(Number(stiffnessRaw))
        ? clamp(Number(stiffnessRaw), 0.01, 16)
        : DEFAULT_STIFFNESS;
      const gravityPower = Number.isFinite(Number(bg.gravityPower))
        ? clamp(Number(bg.gravityPower), 0, 8)
        : DEFAULT_GRAVITY_POWER;
      const gravityDir = readVector3Input(bg.gravityDir, new THREE.Vector3(0, -1, 0), 0, -1, 0);
      if (gravityDir.lengthSq() > 1e-8) gravityDir.normalize();
      else gravityDir.set(0, -1, 0);
      const dragForce = Number.isFinite(Number(bg.dragForce))
        ? clamp(Number(bg.dragForce), 0.01, 0.99)
        : DEFAULT_DRAG_FORCE;
      const hitRadius = Number.isFinite(Number(bg.hitRadius))
        ? clamp(Number(bg.hitRadius), 0.001, 0.5)
        : DEFAULT_HIT_RADIUS;
      const centerNode = resolveObjectRef(bg.center);

      const groupColliders: SpringBoneCollider[] = [];
      for (const cgRef of bg.colliderGroups ?? []) {
        const list =
          typeof cgRef === 'number'
            ? groupCollidersByIndex.get(cgRef)
            : groupCollidersByName.get(String(cgRef));
        if (list) groupColliders.push(...list);
      }

      const resolvedRefs: THREE.Bone[] = [];
      for (const ref of bg.bones ?? []) {
        const obj = resolveObjectRef(ref);
        if (obj && ((obj as THREE.Bone).isBone || obj.type === 'Bone')) {
          resolvedRefs.push(obj as THREE.Bone);
        } else if (obj && obj.children.length > 0) {
          // Allow Object3D pivot nodes wrapped around bone hierarchies if passed via VRM node index
          resolvedRefs.push(obj as THREE.Bone);
        }
      }
      if (resolvedRefs.length === 0) continue;

      const explicitSet = new Set<THREE.Object3D>(resolvedRefs);
      // Detect whether `bg.bones` is a sequential single parent->child chain vs multiple sibling roots
      const isSequentialSingleChain =
        resolvedRefs.length > 1 &&
        resolvedRefs.every((b, idx) => idx === 0 || b.parent === resolvedRefs[idx - 1]);

      if (isSequentialSingleChain) {
        chains.push({
          name: bg.comment || `vrm_group_${bgi}`,
          bones: resolvedRefs,
          stiffnessForce,
          gravityPower,
          gravityDir: gravityDir.clone(),
          dragForce,
          hitRadius,
          colliders: groupColliders,
          center: centerNode,
        });
      } else {
        for (let ri = 0; ri < resolvedRefs.length; ri++) {
          const rootBone = resolvedRefs[ri];
          if (rootBone.parent && explicitSet.has(rootBone.parent)) continue;
          const expanded = resolveBoneChainFromRoot(rootBone, explicitSet);
          if (expanded.length > 0) {
            chains.push({
              name: `${bg.comment || `vrm_group_${bgi}`}_${ri}`,
              bones: expanded,
              stiffnessForce,
              gravityPower,
              gravityDir: gravityDir.clone(),
              dragForce,
              hitRadius,
              colliders: groupColliders,
              center: centerNode,
            });
          }
        }
      }
    }
  } else if (vrm1Meta) {
    const colliderByIdx: Array<SpringBoneCollider | null> = [];
    for (let ci = 0; ci < (vrm1Meta.colliders ?? []).length; ci++) {
      const cDef = vrm1Meta.colliders![ci];
      const hostNode = resolveObjectRef(cDef.node);
      if (!hostNode || !cDef.shape) {
        colliderByIdx.push(null);
        continue;
      }
      if (cDef.shape.capsule) {
        const cap = cDef.shape.capsule;
        const col = new SpringBoneColliderCapsule(
          hostNode,
          readVector3Input(cap.offset, new THREE.Vector3()),
          readVector3Input(cap.tail, new THREE.Vector3(0, 0.1, 0)),
          Math.max(0.001, cap.radius ?? 0.05),
          `VRM1_Capsule_${ci}`,
        );
        colliderByIdx.push(col);
        allColliders.push(col);
      } else if (cDef.shape.sphere) {
        const sph = cDef.shape.sphere;
        const col = new SpringBoneColliderSphere(
          hostNode,
          readVector3Input(sph.offset, new THREE.Vector3()),
          Math.max(0.001, sph.radius ?? 0.05),
          `VRM1_Sphere_${ci}`,
        );
        colliderByIdx.push(col);
        allColliders.push(col);
      } else {
        colliderByIdx.push(null);
      }
    }

    const groupCollidersByIdx = new Map<number, SpringBoneCollider[]>();
    const groupCollidersByName = new Map<string, SpringBoneCollider[]>();
    for (let gi = 0; gi < (vrm1Meta.colliderGroups ?? []).length; gi++) {
      const cg = vrm1Meta.colliderGroups![gi];
      const list: SpringBoneCollider[] = [];
      for (const cIdx of cg.colliders ?? []) {
        const c = colliderByIdx[cIdx];
        if (c) list.push(c);
      }
      groupCollidersByIdx.set(gi, list);
      if (cg.name) groupCollidersByName.set(cg.name, list);
    }

    for (let si = 0; si < (vrm1Meta.springs ?? []).length; si++) {
      const sp = vrm1Meta.springs![si];
      const joints = sp.joints ?? [];
      const bones: THREE.Bone[] = [];
      let stiffnessSum = 0;
      let gravitySum = 0;
      let dragSum = 0;
      let hitSum = 0;
      const gravityDir = new THREE.Vector3(0, -1, 0);

      for (const j of joints) {
        const obj = resolveObjectRef(j.node);
        if (!obj) continue;
        bones.push(obj as THREE.Bone);
        stiffnessSum += Number.isFinite(Number(j.stiffness)) ? Number(j.stiffness) : DEFAULT_STIFFNESS;
        gravitySum += Number.isFinite(Number(j.gravityPower))
          ? Number(j.gravityPower)
          : DEFAULT_GRAVITY_POWER;
        dragSum += Number.isFinite(Number(j.dragForce)) ? Number(j.dragForce) : DEFAULT_DRAG_FORCE;
        hitSum += Number.isFinite(Number(j.hitRadius)) ? Number(j.hitRadius) : DEFAULT_HIT_RADIUS;
        if (j.gravityDir) {
          readVector3Input(j.gravityDir, gravityDir, 0, -1, 0);
        }
      }
      if (bones.length === 0) continue;
      if (gravityDir.lengthSq() > 1e-8) gravityDir.normalize();
      else gravityDir.set(0, -1, 0);

      const groupColliders: SpringBoneCollider[] = [];
      for (const cgRef of sp.colliderGroups ?? []) {
        const list =
          typeof cgRef === 'number'
            ? groupCollidersByIdx.get(cgRef)
            : groupCollidersByName.get(String(cgRef));
        if (list) groupColliders.push(...list);
      }

      const count = bones.length;
      chains.push({
        name: sp.name || `vrm1_spring_${si}`,
        bones,
        stiffnessForce: clamp(stiffnessSum / count, 0.01, 16),
        gravityPower: clamp(gravitySum / count, 0, 8),
        gravityDir,
        dragForce: clamp(dragSum / count, 0.01, 0.99),
        hitRadius: clamp(hitSum / count, 0.001, 0.5),
        colliders: groupColliders,
        center: resolveObjectRef(sp.center),
      });
    }
  }

  return { chains, colliders: allColliders };
}

/**
 * Discovers standard secondary-motion `THREE.Bone` chains under `rigRoot` (hair, bangs, ponytail,
 * ribbon, scarf, coat-tail, skirt, etc.), excluding core humanoid anatomical bones.
 */
export function discoverAutoSpringBoneChains(
  rigRoot: THREE.Object3D,
  colliders: SpringBoneCollider[],
  options: CharacterSecondaryPhysicsOptions = {},
): ParsedSpringBoneChain[] {
  const customPattern = options.bonePattern;
  const isSpringBone = (node: THREE.Object3D): node is THREE.Bone => {
    if (!(node as THREE.Bone).isBone) return false;
    if (SCALP_ANCHOR_ROOT_BONE_RE.test(node.name)) return false;
    const norm = normalizeCharacterBoneName(node.name);
    if (!norm || ANATOMICAL_CORE_BONE_RE.test(norm)) return false;
    return DEFAULT_SPRING_BONE_RE.test(norm) || Boolean(customPattern && customPattern.test(norm));
  };

  const rootSpringBones: THREE.Bone[] = [];
  rigRoot.traverse((node) => {
    if (!isSpringBone(node)) return;
    if (node.parent && isSpringBone(node.parent)) return;
    if (LEAF_MARKER_BONE_RE.test(node.name) && node.children.length === 0) return;
    rootSpringBones.push(node);
  });

  const chains: ParsedSpringBoneChain[] = [];
  const stiffnessForce = options.stiffnessForce ?? DEFAULT_STIFFNESS;
  const gravityPower = options.gravityPower ?? DEFAULT_GRAVITY_POWER;
  const dragForce = options.dragForce ?? DEFAULT_DRAG_FORCE;
  const hitRadius = options.hitRadius ?? DEFAULT_HIT_RADIUS;

  const collectBranches = (startBone: THREE.Bone, prefix: THREE.Bone[]) => {
    const curChain = [...prefix, startBone];
    const springChildren = startBone.children.filter(
      (c): c is THREE.Bone =>
        (c as THREE.Bone).isBone &&
        !(LEAF_MARKER_BONE_RE.test(c.name) && c.children.length === 0) &&
        !ANATOMICAL_CORE_BONE_RE.test(normalizeCharacterBoneName(c.name)),
    );
    if (springChildren.length === 0) {
      chains.push({
        name: curChain[0].name || `spring_chain_${chains.length}`,
        bones: curChain,
        stiffnessForce,
        gravityPower,
        gravityDir: new THREE.Vector3(0, -1, 0),
        dragForce,
        hitRadius,
        colliders,
      });
      return;
    }
    if (springChildren.length === 1) {
      collectBranches(springChildren[0], curChain);
      return;
    }
    // Branching hair/ribbon tree: commit the shared trunk up to `startBone`, then each child branch
    chains.push({
      name: `${curChain[0].name}_trunk`,
      bones: curChain,
      stiffnessForce,
      gravityPower,
      gravityDir: new THREE.Vector3(0, -1, 0),
      dragForce,
      hitRadius,
      colliders,
    });
    for (const child of springChildren) {
      collectBranches(child, []);
    }
  };

  for (const root of rootSpringBones) {
    collectBranches(root, []);
  }
  return chains;
}

interface SpringBoneJointRuntime {
  bone: THREE.Bone;
  initialLocalQuat: THREE.Quaternion;
  iqx: number;
  iqy: number;
  iqz: number;
  iqw: number;
  lpx: number;
  lpy: number;
  lpz: number;
  boneAxisLocal: THREE.Vector3;
  restLengthLocal: number;
  rpx: number;
  rpy: number;
  rpz: number;
  prevTailX: number;
  prevTailY: number;
  prevTailZ: number;
  curTailX: number;
  curTailY: number;
  curTailZ: number;
  prevSubDt: number;
  stiffnessForce: number;
  gravityPower: number;
  gx: number;
  gy: number;
  gz: number;
  dampBase: number;
  hitRadius: number;
  maxAngleRad: number;
  maxCos: number;
  sphereColliders: SpringBoneColliderSphere[];
  capsuleColliders: SpringBoneColliderCapsule[];
  parentJointIndex: number;
  parentCacheIndex: number;
  localUniformScale: number;
  uniformScaleSafe: boolean;
  curHeadX: number;
  curHeadY: number;
  curHeadZ: number;
  curWorldQuatX: number;
  curWorldQuatY: number;
  curWorldQuatZ: number;
  curWorldQuatW: number;
  curWorldScale: number;
}

function buildJointRuntimes(
  chains: ParsedSpringBoneChain[],
  rigRoot: THREE.Object3D,
  anatomy: RigAnatomyMetrics,
  maxAngleRad: number,
): {
  joints: SpringBoneJointRuntime[];
  activeBones: Set<THREE.Bone>;
  rootParents: THREE.Object3D[];
} {
  rigRoot.updateMatrixWorld(true);
  const joints: SpringBoneJointRuntime[] = [];
  const seenBones = new Set<THREE.Bone>();
  const activeBones = new Set<THREE.Bone>();
  const jointIndexByBone = new Map<THREE.Object3D, number>();
  const rootParentIndexByObj = new Map<THREE.Object3D, number>();
  const rootParents: THREE.Object3D[] = [];

  for (const chain of chains) {
    let prevBoneAxisLocal = new THREE.Vector3(0, -1, 0);
    let prevRestLen = 0.08 * anatomy.anatScale;

    for (let bi = 0; bi < chain.bones.length; bi++) {
      const bone = chain.bones[bi];
      if (seenBones.has(bone)) continue;
      seenBones.add(bone);
      activeBones.add(bone);

      // Determine distal tail vector from child bone (including _end leaf markers) or virtual tip
      const childBone =
        chain.bones[bi + 1] ??
        (bone.children.find((c) => (c as THREE.Bone).isBone) as THREE.Bone | undefined) ??
        null;

      const boneAxisLocal = new THREE.Vector3();
      let restLengthLocal = prevRestLen * 0.78;
      if (childBone && childBone.position.lengthSq() > 1e-8) {
        boneAxisLocal.copy(childBone.position).normalize();
        restLengthLocal = childBone.position.length();
        prevBoneAxisLocal.copy(boneAxisLocal);
        prevRestLen = restLengthLocal;
      } else if (bi > 0) {
        boneAxisLocal.copy(prevBoneAxisLocal).normalize();
        restLengthLocal = Math.max(0.03 * anatomy.anatScale, prevRestLen * 0.78);
      } else {
        // Single-bone terminal chain: point downward in world/rig space transformed into bone local space
        const boneScale = decomposeWorldRotationAndScale(bone.matrixWorld, _scQ0);
        void boneScale;
        boneAxisLocal.set(0, -1, 0).applyQuaternion(_scQ0.invert()).normalize();
        restLengthLocal = Math.max(0.06 * anatomy.anatScale, restLengthLocal);
      }

      const initialLocalQuat = bone.quaternion.clone();
      const restDirParent = boneAxisLocal.clone().applyQuaternion(initialLocalQuat).normalize();

      const worldHeadPos = new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld);
      const worldScale = decomposeWorldRotationAndScale(bone.matrixWorld, _scQ0);
      const parentScale = bone.parent
        ? decomposeWorldRotationAndScale(bone.parent.matrixWorld, _scQ1)
        : worldScale;
      const worldDir = boneAxisLocal.clone().applyQuaternion(_scQ0).normalize();
      const initTailWorld = worldHeadPos.clone().addScaledVector(worldDir, restLengthLocal * worldScale);

      const isBlitzHairBone = bone.name.startsWith('Blitz_Hair_');
      const jointStiffness = isBlitzHairBone
        ? bi === 0
          ? chain.stiffnessForce * 4.2
          : bi === 1
            ? chain.stiffnessForce * 1.65
            : chain.stiffnessForce * 0.95
        : chain.stiffnessForce;
      const jointGravity = isBlitzHairBone
        ? bi === 0
          ? chain.gravityPower * 0.12
          : bi === 1
            ? chain.gravityPower * 0.45
            : chain.gravityPower
        : chain.gravityPower;
      const jointHitRadius = isBlitzHairBone && bi === 0 ? chain.hitRadius * 0.25 : chain.hitRadius;
      const jointMaxAngleRad = isBlitzHairBone
        ? bi === 0
          ? Math.min(maxAngleRad, 0.09)
          : bi === 1
            ? Math.min(maxAngleRad, chain.bones.length <= 3 ? 0.26 : 0.38)
            : Math.min(maxAngleRad, 0.56)
        : maxAngleRad;

      // Exclude colliders that already overlap a joint's sculpted bind rest tail so proximal temple
      // and hairline joints are never pushed outward off the skull during idle standing.
      const restProbe = new THREE.Vector3();
      const restHitR = jointHitRadius * parentScale;
      const sphereColliders: SpringBoneColliderSphere[] = [];
      const capsuleColliders: SpringBoneColliderCapsule[] = [];
      for (let ci = 0; ci < chain.colliders.length; ci++) {
        const col = chain.colliders[ci];
        col.updateWorldTransform();
        restProbe.copy(initTailWorld);
        col.resolveCollision(restProbe, restHitR, restProbe);
        if (restProbe.distanceTo(initTailWorld) <= 0.002 * parentScale) {
          if (col.kind === 'sphere') sphereColliders.push(col);
          else capsuleColliders.push(col);
        }
      }

      const parentObj = bone.parent;
      const maybeParentJoint = parentObj ? jointIndexByBone.get(parentObj) : undefined;
      const parentJointIndex = maybeParentJoint !== undefined ? maybeParentJoint : -1;
      let parentCacheIndex = -1;
      if (parentJointIndex < 0 && parentObj) {
        const existingCache = rootParentIndexByObj.get(parentObj);
        if (existingCache !== undefined) {
          parentCacheIndex = existingCache;
        } else {
          parentCacheIndex = rootParents.length;
          rootParents.push(parentObj);
          rootParentIndexByObj.set(parentObj, parentCacheIndex);
        }
      }

      const bsx = bone.scale.x;
      const bsy = bone.scale.y;
      const bsz = bone.scale.z;
      const uniformScaleSafe =
        bsx > 0 &&
        bsy > 0 &&
        bsz > 0 &&
        Math.abs(bsx - bsy) <= 1e-4 &&
        Math.abs(bsy - bsz) <= 1e-4;
      const localUniformScale = (bsx + bsy + bsz) * (1 / 3);

      const ji = joints.length;
      jointIndexByBone.set(bone, ji);
      joints.push({
        bone,
        initialLocalQuat,
        iqx: initialLocalQuat.x,
        iqy: initialLocalQuat.y,
        iqz: initialLocalQuat.z,
        iqw: initialLocalQuat.w,
        lpx: bone.position.x,
        lpy: bone.position.y,
        lpz: bone.position.z,
        boneAxisLocal,
        restLengthLocal,
        rpx: restDirParent.x,
        rpy: restDirParent.y,
        rpz: restDirParent.z,
        prevTailX: initTailWorld.x,
        prevTailY: initTailWorld.y,
        prevTailZ: initTailWorld.z,
        curTailX: initTailWorld.x,
        curTailY: initTailWorld.y,
        curTailZ: initTailWorld.z,
        prevSubDt: SUBSTEP_DT_TARGET,
        stiffnessForce: jointStiffness,
        gravityPower: jointGravity,
        gx: chain.gravityDir.x,
        gy: chain.gravityDir.y,
        gz: chain.gravityDir.z,
        dampBase: clamp(1.0 - chain.dragForce, 0.01, 0.995),
        hitRadius: jointHitRadius,
        maxAngleRad: jointMaxAngleRad,
        maxCos: Math.cos(jointMaxAngleRad),
        sphereColliders,
        capsuleColliders,
        parentJointIndex,
        parentCacheIndex,
        localUniformScale: Number.isFinite(localUniformScale) && localUniformScale > 1e-5 ? localUniformScale : 1,
        uniformScaleSafe,
        curHeadX: worldHeadPos.x,
        curHeadY: worldHeadPos.y,
        curHeadZ: worldHeadPos.z,
        curWorldQuatX: _scQ0.x,
        curWorldQuatY: _scQ0.y,
        curWorldQuatZ: _scQ0.z,
        curWorldQuatW: _scQ0.w,
        curWorldScale: worldScale,
      });
    }
  }

  return { joints, activeBones, rootParents };
}

/**
 * Classifies a mesh on `rigRoot` for shader-driven secondary motion when no spring bones drive it.
 */
export function classifySecondaryMesh(
  mesh: THREE.Mesh,
  activeSpringBones: ReadonlySet<THREE.Bone>,
  anatomy: RigAnatomyMetrics,
): SecondaryMeshKind | null {
  const lower = (mesh.name || '').toLowerCase();
  if (!lower) return null;
  if (lower.startsWith('head') || lower.startsWith('ears_') || lower.includes('eye')) {
    return null;
  }
  if (lower.includes('_skin') || lower === 'hands_skin') {
    return null;
  }

  // If this SkinnedMesh is already driven by explicit spring bones, skip redundant shader sway
  const sm = mesh as THREE.SkinnedMesh;
  if (sm.isSkinnedMesh && sm.skeleton) {
    for (let i = 0; i < sm.skeleton.bones.length; i++) {
      if (activeSpringBones.has(sm.skeleton.bones[i])) {
        return null;
      }
    }
  }

  if (HAIR_MESH_RE.test(lower)) {
    return 'hair';
  }
  if (RIBBON_MESH_RE.test(lower)) {
    return 'ribbon';
  }
  if (GARMENT_MESH_RE.test(lower)) {
    return 'garment';
  }

  const posAttr = mesh.geometry?.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!posAttr || posAttr.count < 3) return null;

  if (lower.startsWith('legs_')) {
    let minY = Infinity;
    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i);
      if (y < minY) minY = y;
    }
    // Skirts and shorts sit well above the calf/ankle (`>= 0.38 * charBindHeight`), whereas full pants reach the shoes
    if (Number.isFinite(minY) && minY >= 0.38 * anatomy.charBindHeight) {
      return 'garment';
    }
    return null;
  }

  if (lower.startsWith('torso_')) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    // Long untucked shirt tails & coat-tails extending below pelvis height (`< 0.86 * anatScale`)
    if (
      Number.isFinite(minY) &&
      minY <= 0.86 * anatomy.anatScale &&
      maxY - minY >= 0.36 * anatomy.anatScale
    ) {
      return 'garment';
    }
  }

  return null;
}

/**
 * Computes static per-vertex `aSecondaryMeta` = `(mobility [0..1], strandPhase)` in bind-pose space:
 * - Hair crown/inner scalp vertices get `mobility === 0.0` (zero scalp tearing!)
 * - Long hair ramps smoothly from neck/shoulders down to `1.0` at tips; short spiky hair gently moves only outer tufts/bangs
 * - Garments/ribbons anchor top 35% to waist/collar and ramp toward the lower hem
 */
export function computeSecondaryVertexMeta(
  geometry: THREE.BufferGeometry,
  kind: SecondaryMeshKind,
  anatomy: RigAnatomyMetrics,
  companionMeta?: THREE.BufferAttribute | null,
): THREE.BufferAttribute {
  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!posAttr) {
    return new THREE.Float32BufferAttribute(new Float32Array(0), 2);
  }
  if (companionMeta && companionMeta.count === posAttr.count && companionMeta.itemSize === 2) {
    return companionMeta;
  }

  const count = posAttr.count;
  const out = new Float32Array(count * 2);
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < count; i++) {
    const y = posAttr.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const spanY = Math.max(0.02, maxY - minY);
  const s = anatomy.anatScale;

  if (kind === 'hair') {
    const skullCx = anatomy.skullBindCenter.x;
    const skullCy = anatomy.skullBindCenter.y;
    const skullCz = anatomy.skullBindCenter.z;
    const skullR = anatomy.skullBindRadius;
    const headBaseY = anatomy.headBindPos.y;
    const isLongHair = spanY > 0.24 * s;
    const hairHeightAmp = isLongHair
      ? clamp(0.62 + (spanY / (0.58 * s)) * 0.38, 0.62, 1.0)
      : clamp((spanY / (0.24 * s)) * 0.34, 0.16, 0.38);

    for (let i = 0; i < count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);

      const dx = x - skullCx;
      const dy = (y - skullCy) * 0.88;
      const dz = z - skullCz;
      const distFromSkull = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const radialXZ = Math.hypot(dx, dz);

      // Crown & inner scalp lock: anything hugging the upper cranium or scalp cap stays strictly pinned (0.0)
      const upperCrownMask = isLongHair
        ? smoothstep(headBaseY + 0.075 * s, headBaseY + 0.115 * s, y) *
          (1.0 - smoothstep(skullR * 1.35, skullR * 1.75, radialXZ))
        : smoothstep(headBaseY + 0.065 * s, headBaseY + 0.110 * s, y) *
          (1.0 - smoothstep(skullR * 1.15, skullR * 1.38, distFromSkull));
      const innerCapLock = 1.0 - smoothstep(skullR * 0.96, skullR * 1.12, distFromSkull);
      const scalpLock = Math.max(upperCrownMask, innerCapLock);

      const tDrop = smoothstep(headBaseY + 0.055 * s, minY, y);
      const tProtrude = smoothstep(skullR * 1.10, skullR * 1.52, distFromSkull);

      // Gentle front bangs / back nape mobility below brow height
      const bangMask =
        smoothstep(anatomy.headBindPos.z + 0.075 * s, anatomy.headBindPos.z + 0.115 * s, z) *
        (1.0 - smoothstep(headBaseY + 0.055 * s, headBaseY + 0.105 * s, y));
      const napeMask =
        smoothstep(anatomy.headBindPos.z - 0.080 * s, anatomy.headBindPos.z - 0.130 * s, z) *
        (1.0 - smoothstep(headBaseY + 0.03 * s, headBaseY + 0.10 * s, y));

      const rawMob = isLongHair
        ? Math.max(tDrop * 0.96, tProtrude * 0.36, bangMask * 0.34, napeMask * 0.42)
        : Math.max(tDrop * 0.65, tProtrude * 0.72, bangMask * 0.55, napeMask * 0.68);

      const mobility = clamp(rawMob * (1.0 - scalpLock) * hairHeightAmp, 0, 1);
      const phase = Math.atan2(dx, dz) * 2.0 + y * (9.5 / Math.max(0.25, s));
      out[i * 2] = mobility;
      out[i * 2 + 1] = phase;
    }
  } else {
    // Garments (skirt / coat-tail) and neck ribbons anchor upper 35% to waist/collarbone
    const anchorTopY =
      kind === 'garment' && minY < 0.88 * s && maxY > 1.18 * s
        ? Math.min(0.95 * s, maxY - spanY * 0.60)
        : maxY - spanY * 0.35;
    const amp = kind === 'ribbon' ? 0.34 : maxY > 1.18 * s ? 0.42 : 0.78;

    for (let i = 0; i < count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      const tHem = smoothstep(anchorTopY, minY, y);
      const mobility = clamp(tHem * amp, 0, 1);
      const phase = Math.atan2(x, z) * 2.0 + y * (8.5 / Math.max(0.25, s));
      out[i * 2] = mobility;
      out[i * 2 + 1] = phase;
    }
  }

  return new THREE.BufferAttribute(out, 2);
}

interface TorsoBindCollisionEnvelope {
  cx: number;
  s: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
  nx: number;
  ny: number;
  nz: number;
  frontZ: Float32Array;
  backZ: Float32Array;
  topY: Float32Array;
  hasTorsoMeshes: boolean;
  sampleFrontZ(x: number, y: number): number;
  sampleBackZ(x: number, y: number): number;
  sampleTopY(x: number, z: number): number;
}

interface FittedShaderCapsules {
  chestLA: THREE.Vector4;
  chestLB: THREE.Vector4;
  chestRA: THREE.Vector4;
  chestRB: THREE.Vector4;
  clavLA: THREE.Vector4;
  clavLB: THREE.Vector4;
  clavRA: THREE.Vector4;
  clavRB: THREE.Vector4;
  backA: THREE.Vector4;
  backB: THREE.Vector4;
}

let nextHairPhysicsOwnerId = 1;

function sampleEnvelopeGrid2D(
  grid: Float32Array,
  x: number,
  y: number,
  gXMin: number,
  gYMin: number,
  gDx: number,
  gDy: number,
  w: number,
  h: number,
  fallbackVal: number,
): number {
  const fx = clamp((x - gXMin) / gDx, 0, w - 1);
  const fy = clamp((y - gYMin) / gDy, 0, h - 1);
  const ix0 = Math.floor(fx);
  const iy0 = Math.floor(fy);
  const ix1 = Math.min(w - 1, ix0 + 1);
  const iy1 = Math.min(h - 1, iy0 + 1);
  const tx = fx - ix0;
  const ty = fy - iy0;
  const v00 = grid[iy0 * w + ix0];
  const v10 = grid[iy0 * w + ix1];
  const v01 = grid[iy1 * w + ix0];
  const v11 = grid[iy1 * w + ix1];
  let acc = 0;
  let wt = 0;
  if (Number.isFinite(v00)) {
    const k = (1 - tx) * (1 - ty);
    acc += v00 * k;
    wt += k;
  }
  if (Number.isFinite(v10)) {
    const k = tx * (1 - ty);
    acc += v10 * k;
    wt += k;
  }
  if (Number.isFinite(v01)) {
    const k = (1 - tx) * ty;
    acc += v01 * k;
    wt += k;
  }
  if (Number.isFinite(v11)) {
    const k = tx * ty;
    acc += v11 * k;
    wt += k;
  }
  return wt > 1e-4 ? acc / wt : fallbackVal;
}

function smoothEnvelopeGrid(
  raw: Float32Array,
  w: number,
  h: number,
  isMin: boolean,
): Float32Array {
  const cur = new Float32Array(raw);
  const tmp = new Float32Array(raw.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let iy = 0; iy < h; iy++) {
      for (let ix = 0; ix < w; ix++) {
        const c = cur[iy * w + ix];
        if (!Number.isFinite(c)) {
          tmp[iy * w + ix] = c;
          continue;
        }
        let acc = 0;
        let wt = 0;
        for (let oy = -2; oy <= 2; oy++) {
          const yy = iy + oy;
          if (yy < 0 || yy >= h) continue;
          for (let ox = -2; ox <= 2; ox++) {
            const xx = ix + ox;
            if (xx < 0 || xx >= w) continue;
            const nv = cur[yy * w + xx];
            if (!Number.isFinite(nv)) continue;
            const k = (3 - Math.abs(ox)) * (3 - Math.abs(oy));
            acc += nv * k;
            wt += k;
          }
        }
        const avg = wt > 0 ? acc / wt : c;
        tmp[iy * w + ix] = isMin ? Math.min(raw[iy * w + ix], avg) : Math.max(raw[iy * w + ix], avg);
      }
    }
    cur.set(tmp);
  }
  return cur;
}

/**
 * Builds a smooth anatomical front/back/shoulder torso collision envelope in bind-pose space
 * from all visible `torso_*` / `neck_*` meshes on `rigRoot`, falling back to anatomical
 * ribcage/bust/clavicle capsules when no torso mesh is present (e.g., standalone hair GLBs).
 */
export function buildTorsoBindCollisionEnvelope(
  rigRoot: THREE.Object3D,
  anatomy: RigAnatomyMetrics,
): TorsoBindCollisionEnvelope {
  const s = anatomy.anatScale;
  const cx = (anatomy.skullBindCenter.x + anatomy.hipsBindPos.x) * 0.5;
  const headBaseY = anatomy.headBindPos.y;
  const nx = 49;
  const ny = 55;
  const nz = 29;
  const xMin = cx - 0.24 * s;
  const xMax = cx + 0.24 * s;
  const yMin = 0.84 * s;
  const yMax = headBaseY;
  const zMin = -0.20 * s;
  const zMax = 0.08 * s;
  const dx = (xMax - xMin) / (nx - 1);
  const dy = (yMax - yMin) / (ny - 1);
  const dz = (zMax - zMin) / (nz - 1);

  const rawFront = new Float32Array(nx * ny).fill(-Infinity);
  const rawBack = new Float32Array(nx * ny).fill(Infinity);
  const rawTopY = new Float32Array(nx * nz).fill(-Infinity);

  let hasTorsoMeshes = false;
  rigRoot.traverse((node) => {
    const m = node as THREE.Mesh;
    if (!m.isMesh || !m.visible || !m.geometry) return;
    const ln = (m.name || '').toLowerCase();
    if (ln.includes('outline')) return;
    if (!ln.startsWith('torso_') && !ln.startsWith('neck_')) return;
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos || pos.count < 3) return;
    hasTorsoMeshes = true;
    const idx = m.geometry.getIndex();
    const triCount = idx ? Math.floor(idx.count / 3) : Math.floor(pos.count / 3);
    for (let t = 0; t < triCount; t++) {
      const ia = idx ? idx.getX(t * 3) : t * 3;
      const ib = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
      const ic = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      const ax = pos.getX(ia);
      const ay = pos.getY(ia);
      const az = pos.getZ(ia);
      const bx = pos.getX(ib);
      const by = pos.getY(ib);
      const bz = pos.getZ(ib);
      const cxp = pos.getX(ic);
      const cyp = pos.getY(ic);
      const czp = pos.getZ(ic);
      if (
        Math.abs(ax - cx) > 0.25 * s ||
        Math.abs(bx - cx) > 0.25 * s ||
        Math.abs(cxp - cx) > 0.25 * s
      ) {
        continue;
      }
      const minTy = Math.min(ay, by, cyp);
      const maxTy = Math.max(ay, by, cyp);
      if (maxTy < yMin || minTy > yMax + 0.02 * s) continue;

      const minTx = Math.min(ax, bx, cxp);
      const maxTx = Math.max(ax, bx, cxp);
      const ix0 = Math.max(0, Math.floor((minTx - xMin) / dx));
      const ix1 = Math.min(nx - 1, Math.ceil((maxTx - xMin) / dx));
      const iy0 = Math.max(0, Math.floor((minTy - yMin) / dy));
      const iy1 = Math.min(ny - 1, Math.ceil((maxTy - yMin) / dy));
      const denomXY = (by - cyp) * (ax - cxp) + (cxp - bx) * (ay - cyp);
      if (Math.abs(denomXY) > 1e-9) {
        const invD = 1 / denomXY;
        for (let ix = ix0; ix <= ix1; ix++) {
          const px = xMin + ix * dx;
          for (let iy = iy0; iy <= iy1; iy++) {
            const py = yMin + iy * dy;
            const u = ((by - cyp) * (px - cxp) + (cxp - bx) * (py - cyp)) * invD;
            const v = ((cyp - ay) * (px - cxp) + (ax - cxp) * (py - cyp)) * invD;
            const w = 1 - u - v;
            if (u >= -0.02 && v >= -0.02 && w >= -0.02) {
              const z = u * az + v * bz + w * czp;
              const cell = iy * nx + ix;
              if (z > rawFront[cell]) rawFront[cell] = z;
              if (z < rawBack[cell]) rawBack[cell] = z;
            }
          }
        }
      }

      if (maxTy >= 1.18 * s) {
        const minTz = Math.min(az, bz, czp);
        const maxTz = Math.max(az, bz, czp);
        const iz0 = Math.max(0, Math.floor((minTz - zMin) / dz));
        const iz1 = Math.min(nz - 1, Math.ceil((maxTz - zMin) / dz));
        const denomXZ = (bz - czp) * (ax - cxp) + (cxp - bx) * (az - czp);
        if (Math.abs(denomXZ) > 1e-9) {
          const invD = 1 / denomXZ;
          for (let ix = ix0; ix <= ix1; ix++) {
            const px = xMin + ix * dx;
            for (let iz = iz0; iz <= iz1; iz++) {
              const pz = zMin + iz * dz;
              const u = ((bz - czp) * (px - cxp) + (cxp - bx) * (pz - czp)) * invD;
              const v = ((czp - az) * (px - cxp) + (ax - cxp) * (pz - czp)) * invD;
              const w = 1 - u - v;
              if (u >= -0.02 && v >= -0.02 && w >= -0.02) {
                const y = u * ay + v * by + w * cyp;
                const cell = iz * nx + ix;
                if (y > rawTopY[cell]) rawTopY[cell] = y;
              }
            }
          }
        }
      }
    }
  });

  // Union with anatomical ribcage/neck/clavicle safety core (or full bust/chest fallback if no torso meshes)
  for (let iy = 0; iy < ny; iy++) {
    const y = yMin + iy * dy;
    const halfW =
      (0.115 + 0.055 * smoothstep(1.0 * s, 1.26 * s, y)) *
      s *
      (1 - 0.55 * smoothstep(1.29 * s, 1.36 * s, y));
    for (let ix = 0; ix < nx; ix++) {
      const x = xMin + ix * dx;
      const ax = Math.abs(x - cx);
      if (ax > halfW) continue;
      const lat = Math.sqrt(Math.max(0, 1 - (ax / Math.max(1e-4, halfW)) ** 2));
      const bustBump = hasTorsoMeshes
        ? 0
        : 0.032 *
          s *
          Math.exp(-(((y - 1.13 * s) / (0.08 * s)) ** 2)) *
          (0.5 + 0.5 * Math.cos((ax / (0.06 * s)) * 1.2));
      const coreF =
        (hasTorsoMeshes ? 0.048 : 0.078) * s * (1 - smoothstep(1.24 * s, 1.34 * s, y)) -
        0.02 * s * smoothstep(1.24 * s, 1.35 * s, y);
      const coreB =
        (hasTorsoMeshes ? -0.085 : -0.118) * s -
        0.015 * s * Math.exp(-(((y - 1.2 * s) / (0.12 * s)) ** 2));
      const f = (coreF + bustBump) * lat - 0.045 * s * (1 - lat);
      const b = (coreB + 0.045 * s) * lat - 0.045 * s;
      const cell = iy * nx + ix;
      rawFront[cell] = rawFront[cell] === -Infinity ? f : Math.max(rawFront[cell], f);
      rawBack[cell] = rawBack[cell] === Infinity ? b : Math.min(rawBack[cell], b);
    }
  }

  for (let iz = 0; iz < nz; iz++) {
    const z = zMin + iz * dz;
    for (let ix = 0; ix < nx; ix++) {
      const x = xMin + ix * dx;
      const ax = Math.abs(x - cx);
      if (ax > 0.2 * s || z < -0.13 * s || z > 0.02 * s) continue;
      const shoulderArc = (1.335 - 0.045 * smoothstep(0.045 * s, 0.18 * s, ax)) * s;
      const zCurve = Math.abs(z - -0.055 * s) / (0.065 * s);
      if (zCurve <= 1.0) {
        const yFall = shoulderArc - 0.03 * s * zCurve * zCurve;
        const cell = iz * nx + ix;
        if (rawTopY[cell] === -Infinity || !hasTorsoMeshes) {
          rawTopY[cell] = Math.max(rawTopY[cell], yFall);
        } else {
          rawTopY[cell] = Math.max(rawTopY[cell], yFall - 0.015 * s);
        }
      }
    }
  }

  const frontZ = smoothEnvelopeGrid(rawFront, nx, ny, false);
  const backZ = smoothEnvelopeGrid(rawBack, nx, ny, true);
  const topY = smoothEnvelopeGrid(rawTopY, nx, nz, false);

  return {
    cx,
    s,
    xMin,
    xMax,
    yMin,
    yMax,
    zMin,
    zMax,
    nx,
    ny,
    nz,
    frontZ,
    backZ,
    topY,
    hasTorsoMeshes,
    sampleFrontZ: (x, y) => sampleEnvelopeGrid2D(frontZ, x, y, xMin, yMin, dx, dy, nx, ny, -Infinity),
    sampleBackZ: (x, y) => sampleEnvelopeGrid2D(backZ, x, y, xMin, yMin, dx, dy, nx, ny, Infinity),
    sampleTopY: (x, z) => sampleEnvelopeGrid2D(topY, x, z, xMin, zMin, dx, dz, nx, nz, -Infinity),
  };
}

function fitShaderCapsulesFromEnvelope(env: TorsoBindCollisionEnvelope): FittedShaderCapsules {
  const s = env.s;
  const cx = env.cx;
  const sampleMaxFront = (xProbe: number, yStart: number, yEnd: number): number => {
    let best = -Infinity;
    for (let y = yStart; y <= yEnd + 1e-5; y += 0.02 * s) {
      const v = env.sampleFrontZ(xProbe, y);
      if (Number.isFinite(v) && v > best) best = v;
    }
    return Number.isFinite(best) ? best : 0.08 * s;
  };
  const sampleMinBack = (xProbe: number, yStart: number, yEnd: number): number => {
    let best = Infinity;
    for (let y = yStart; y <= yEnd + 1e-5; y += 0.02 * s) {
      const v = env.sampleBackZ(xProbe, y);
      if (Number.isFinite(v) && v < best) best = v;
    }
    return Number.isFinite(best) ? best : -0.11 * s;
  };
  const sampleMaxTopY = (xProbe: number): number => {
    let best = -Infinity;
    for (let z = -0.09 * s; z <= -0.02 * s + 1e-5; z += 0.02 * s) {
      const v = env.sampleTopY(xProbe, z);
      if (Number.isFinite(v) && v > best) best = v;
    }
    return Number.isFinite(best) ? best : 1.31 * s;
  };

  const rChest = 0.12 * s;
  const shaderClearance = 0.012 * s;
  const fLoL = sampleMaxFront(cx + 0.046 * s, 1.01 * s, 1.1 * s);
  const fHiL = sampleMaxFront(cx + 0.046 * s, 1.11 * s, 1.2 * s);
  const fLoR = sampleMaxFront(cx - 0.046 * s, 1.01 * s, 1.1 * s);
  const fHiR = sampleMaxFront(cx - 0.046 * s, 1.11 * s, 1.2 * s);

  const rClav = 0.072 * s;
  const maxClavTopY = 1.335 * s;
  const topInL = Math.min(maxClavTopY, sampleMaxTopY(cx + 0.055 * s) + shaderClearance);
  const topOutL = Math.min(maxClavTopY, sampleMaxTopY(cx + 0.145 * s) + shaderClearance);
  const topInR = Math.min(maxClavTopY, sampleMaxTopY(cx - 0.055 * s) + shaderClearance);
  const topOutR = Math.min(maxClavTopY, sampleMaxTopY(cx - 0.145 * s) + shaderClearance);
  const fClavInL = sampleMaxFront(cx + 0.055 * s, 1.23 * s, 1.29 * s);
  const fClavOutL = sampleMaxFront(cx + 0.14 * s, 1.23 * s, 1.29 * s);
  const fClavInR = sampleMaxFront(cx - 0.055 * s, 1.23 * s, 1.29 * s);
  const fClavOutR = sampleMaxFront(cx - 0.14 * s, 1.23 * s, 1.29 * s);

  const rBack = 0.102 * s;
  const bLo = sampleMinBack(cx, 1.06 * s, 1.18 * s);
  const bHi = sampleMinBack(cx, 1.19 * s, 1.28 * s);

  return {
    chestLA: new THREE.Vector4(cx + 0.044 * s, 1.035 * s, fLoL + shaderClearance - rChest, rChest),
    chestLB: new THREE.Vector4(cx + 0.044 * s, 1.185 * s, fHiL + shaderClearance - rChest, 0),
    chestRA: new THREE.Vector4(cx - 0.044 * s, 1.035 * s, fLoR + shaderClearance - rChest, rChest),
    chestRB: new THREE.Vector4(cx - 0.044 * s, 1.185 * s, fHiR + shaderClearance - rChest, 0),
    clavLA: new THREE.Vector4(
      cx + 0.038 * s,
      Math.max(1.245 * s, topInL - rClav),
      Math.max(-0.055 * s, fClavInL + shaderClearance - rClav),
      rClav,
    ),
    clavLB: new THREE.Vector4(
      cx + 0.16 * s,
      Math.max(1.225 * s, topOutL - rClav),
      Math.max(-0.065 * s, fClavOutL + shaderClearance - rClav),
      0,
    ),
    clavRA: new THREE.Vector4(
      cx - 0.038 * s,
      Math.max(1.245 * s, topInR - rClav),
      Math.max(-0.055 * s, fClavInR + shaderClearance - rClav),
      rClav,
    ),
    clavRB: new THREE.Vector4(
      cx - 0.16 * s,
      Math.max(1.225 * s, topOutR - rClav),
      Math.max(-0.065 * s, fClavOutR + shaderClearance - rClav),
      0,
    ),
    backA: new THREE.Vector4(cx, 1.08 * s, bLo - shaderClearance + rBack, rBack),
    backB: new THREE.Vector4(cx, 1.25 * s, bHi - shaderClearance + rBack, 0),
  };
}

function restoreHairAttributesFromPristine(geo: THREE.BufferGeometry): void {
  const curPos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
  const origPos = geo.userData.__origHairPos as Float32Array | undefined;
  if (curPos && origPos && curPos.array.length === origPos.length) {
    (curPos.array as Float32Array).set(origPos);
    curPos.needsUpdate = true;
  }
  const curIdx = geo.getAttribute('skinIndex') as THREE.BufferAttribute | undefined;
  const origIdx = geo.userData.__origHairSkinIdx as Uint16Array | null | undefined;
  if (curIdx && origIdx && curIdx.array.length === origIdx.length) {
    for (let k = 0; k < origIdx.length; k++) {
      (curIdx.array as Uint16Array)[k] = origIdx[k];
    }
    curIdx.needsUpdate = true;
  }
  const curWgt = geo.getAttribute('skinWeight') as THREE.BufferAttribute | undefined;
  const origWgt = geo.userData.__origHairSkinWgt as Float32Array | null | undefined;
  if (curWgt && origWgt && curWgt.array.length === origWgt.length) {
    (curWgt.array as Float32Array).set(origWgt);
    curWgt.needsUpdate = true;
  }
}

function captureAndRestorePristineHairGeometry(mesh: THREE.Mesh, ownerId: number): void {
  let geo = mesh.geometry;
  if (!geo) return;
  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!posAttr) return;

  const skinIdxAttr = geo.getAttribute('skinIndex') as THREE.BufferAttribute | undefined;
  const skinWgtAttr = geo.getAttribute('skinWeight') as THREE.BufferAttribute | undefined;

  if (!geo.userData.__origHairPos) {
    geo.userData = {
      ...(geo.userData ?? {}),
      __origHairPos: new Float32Array(posAttr.array as ArrayLike<number>),
      __origHairSkinIdx: skinIdxAttr
        ? new Uint16Array(skinIdxAttr.array as ArrayLike<number>)
        : null,
      __origHairSkinWgt: skinWgtAttr
        ? new Float32Array(skinWgtAttr.array as ArrayLike<number>)
        : null,
    };
  }

  const existingOwner = geo.userData.__secondaryPhysicsOwnerId as number | undefined;
  if (existingOwner !== undefined && existingOwner !== ownerId) {
    const cloned = geo.clone();
    cloned.userData = {
      ...(geo.userData ?? {}),
      __origHairPos: new Float32Array(geo.userData.__origHairPos as Float32Array),
      __origHairSkinIdx: geo.userData.__origHairSkinIdx
        ? new Uint16Array(geo.userData.__origHairSkinIdx as Uint16Array)
        : null,
      __origHairSkinWgt: geo.userData.__origHairSkinWgt
        ? new Float32Array(geo.userData.__origHairSkinWgt as Float32Array)
        : null,
      __secondaryPhysicsOwnerId: ownerId,
      __isPerRigUniqueHairGeometry: true,
      __preCloneHairGeometry: geo,
    };
    mesh.geometry = cloned;
    geo = cloned;
  } else {
    geo.userData.__secondaryPhysicsOwnerId = ownerId;
  }

  // Restore pristine bind-pose positions and weights before re-evaluating against active torso
  restoreHairAttributesFromPristine(geo);
}

function restorePristineHairOnDispose(mesh: THREE.Mesh, ownerId: number): void {
  const geo = mesh.geometry;
  if (!geo || geo.userData?.__secondaryPhysicsOwnerId !== ownerId) return;
  if (geo.userData.__isPerRigUniqueHairGeometry && geo.userData.__preCloneHairGeometry) {
    mesh.geometry = geo.userData.__preCloneHairGeometry as THREE.BufferGeometry;
    geo.dispose();
    return;
  }
  restoreHairAttributesFromPristine(geo);
  delete geo.userData.__secondaryPhysicsOwnerId;
}

/** Writes 4 normalized skin weights cleanly, quantizing to exact sum 255/65535 for normalized integer buffers. */
function writeNormalizedSkinWeight4(
  sw: THREE.BufferAttribute,
  vertIdx: number,
  w0: number,
  w1: number,
  w2: number,
  w3: number,
): void {
  if (sw.normalized && (sw.array instanceof Uint8Array || sw.array instanceof Uint16Array)) {
    const maxInt = sw.array instanceof Uint8Array ? 255 : 65535;
    const raw = [Math.max(0, w0), Math.max(0, w1), Math.max(0, w2), Math.max(0, w3)];
    const sum = raw[0] + raw[1] + raw[2] + raw[3] || 1;
    const scaled = raw.map((w) => (w / sum) * maxInt);
    const ints = scaled.map((v) => Math.floor(v));
    let rem = maxInt - (ints[0] + ints[1] + ints[2] + ints[3]);
    const order = [0, 1, 2, 3].sort((a, b) => (scaled[b] - ints[b]) - (scaled[a] - ints[a]));
    for (let k = 0; k < rem; k++) {
      ints[order[k % 4]]++;
    }
    sw.setXYZW(vertIdx, ints[0] / maxInt, ints[1] / maxInt, ints[2] / maxInt, ints[3] / maxInt);
  } else {
    sw.setXYZW(vertIdx, w0, w1, w2, w3);
  }
}

/**
 * Damps chest-level (`y < 1.28 * s`) `Head` / `Neck` skin weights toward `Spine02` / `UpperChest`
 * so head tilts cannot dive draped chest locks through the bust, strictly preserving valid indices
 * and `weightSum === 1.0`.
 */
function rebalanceChestHairWeights(mesh: THREE.Mesh, s: number): void {
  const sm = mesh as THREE.SkinnedMesh;
  if (!sm.isSkinnedMesh || !sm.skeleton) return;
  const pos = sm.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  const si = sm.geometry.getAttribute('skinIndex') as THREE.BufferAttribute | undefined;
  const sw = sm.geometry.getAttribute('skinWeight') as THREE.BufferAttribute | undefined;
  const bones = sm.skeleton.bones;
  if (!pos || !si || !sw || bones.length === 0) return;

  const chestIdx = bones.findIndex((b) =>
    /^(?:spine02|spine2|upperchest|upper_chest)$/i.test(normalizeCharacterBoneName(b.name)),
  );
  if (chestIdx < 0) return;

  const isHeadOrNeck = new Uint8Array(bones.length);
  const isChestOrShoulder = new Uint8Array(bones.length);
  for (let b = 0; b < bones.length; b++) {
    const norm = normalizeCharacterBoneName(bones[b].name).toLowerCase();
    if (norm === 'head' || norm === 'neck') isHeadOrNeck[b] = 1;
    if (norm.includes('spine') || norm.includes('chest') || norm.includes('shoulder')) {
      isChestOrShoulder[b] = 1;
    }
  }

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y >= 1.305 * s) continue;
    const idx4 = [
      Math.round(si.getX(i)),
      Math.round(si.getY(i)),
      Math.round(si.getZ(i)),
      Math.round(si.getW(i)),
    ];
    const wgt4 = [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)];
    let hnTotal = 0;
    let csTotal = 0;
    for (let k = 0; k < 4; k++) {
      const bi = idx4[k];
      const w = Number.isFinite(wgt4[k]) && wgt4[k] > 0 ? wgt4[k] : 0;
      wgt4[k] = w;
      if (bi >= 0 && bi < bones.length) {
        if (isHeadOrNeck[bi]) hnTotal += w;
        if (isChestOrShoulder[bi]) csTotal += w;
      } else {
        idx4[k] = chestIdx;
        wgt4[k] = 0;
      }
    }
    if (hnTotal <= 0.005) continue;

    let transferRatio = 0;
    if (y < 1.28 * s) {
      transferRatio = 0.72 + 0.26 * smoothstep(1.28 * s, 1.2 * s, y);
    } else if (csTotal >= 0.2) {
      transferRatio = 0.45 * smoothstep(1.305 * s, 1.28 * s, y);
    }
    if (transferRatio <= 0.01) continue;

    let moved = 0;
    for (let k = 0; k < 4; k++) {
      const bi = idx4[k];
      if (bi >= 0 && bi < bones.length && isHeadOrNeck[bi] && wgt4[k] > 0) {
        const take = wgt4[k] * transferRatio;
        wgt4[k] -= take;
        moved += take;
      }
    }
    if (moved <= 0) continue;

    let chestSlot = idx4.indexOf(chestIdx);
    if (chestSlot < 0) {
      chestSlot = wgt4.findIndex((w) => w <= 1e-5);
      if (chestSlot < 0) {
        let minK = 0;
        for (let k = 1; k < 4; k++) {
          if (wgt4[k] < wgt4[minK]) minK = k;
        }
        chestSlot = minK;
        wgt4[chestSlot] = 0;
      }
      idx4[chestSlot] = chestIdx;
    }
    wgt4[chestSlot] += moved;

    const sum = wgt4[0] + wgt4[1] + wgt4[2] + wgt4[3];
    if (Number.isFinite(sum) && sum > 1e-6) {
      for (let k = 0; k < 4; k++) wgt4[k] /= sum;
    } else {
      idx4[0] = chestIdx;
      idx4[1] = 0;
      idx4[2] = 0;
      idx4[3] = 0;
      wgt4[0] = 1;
      wgt4[1] = 0;
      wgt4[2] = 0;
      wgt4[3] = 0;
    }
    si.setXYZW(i, idx4[0], idx4[1], idx4[2], idx4[3]);
    writeNormalizedSkinWeight4(sw, i, wgt4[0], wgt4[1], wgt4[2], wgt4[3]);
  }
  si.needsUpdate = true;
  sw.needsUpdate = true;
}

/**
 * Smoothly pushes penetrating bind-pose hair vertices below jawline/chin (`y < headBaseY - 0.04 * s`)
 * outside the active torso/bust/clavicle/shoulder envelope while preserving hair sheet thickness.
 */
function depenetrateHairMeshAgainstEnvelope(
  mesh: THREE.Mesh,
  env: TorsoBindCollisionEnvelope,
  anatomy: RigAnatomyMetrics,
): void {
  const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos || pos.count === 0) return;
  const idx = mesh.geometry.getIndex();
  const s = env.s;
  const chinCutoffY = anatomy.headBindPos.y - 0.04 * s;
  const clearance = 0.015 * s;
  const vCount = pos.count;

  const origX = new Float32Array(vCount);
  const origY = new Float32Array(vCount);
  const origZ = new Float32Array(vCount);
  const pushY = new Float32Array(vCount);
  const pushZ = new Float32Array(vCount);
  const minReqY = new Float32Array(vCount);
  const minReqZ = new Float32Array(vCount);
  const fadeArr = new Float32Array(vCount);
  const sideArr = new Int8Array(vCount);

  for (let i = 0; i < vCount; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    origX[i] = x;
    origY[i] = y;
    origZ[i] = z;
    if (y >= chinCutoffY || Math.abs(x - env.cx) > 0.24 * s) continue;

    const fade = smoothstep(chinCutoffY, chinCutoffY - 0.03 * s, y);
    fadeArr[i] = fade;
    const fz = env.sampleFrontZ(x, y);
    const bz = env.sampleBackZ(x, y);
    if (!Number.isFinite(fz) || !Number.isFinite(bz)) continue;

    const midZ = 0.5 * (fz + bz);
    const isFront = z >= midZ;
    sideArr[i] = isFront ? 1 : -1;

    let reqY = 0;
    let reqZ = 0;
    const clr = clearance * fade;
    if (isFront) {
      if (z < fz + clr) reqZ = fz + clr - z;
    } else if (z > bz - clr) {
      reqZ = bz - clr - z;
    }

    if (Math.abs(x - env.cx) >= 0.045 * s && y >= 1.24 * s) {
      const topY = env.sampleTopY(x, z);
      if (Number.isFinite(topY) && y < topY + clr * 0.8 && Math.abs(reqZ) > 0) {
        const lift = topY + clr * 0.8 - y;
        if (lift <= Math.abs(reqZ) * 0.9) {
          reqY = lift;
          reqZ = Math.sign(reqZ) * Math.min(Math.abs(reqZ), lift * 0.55);
        }
      }
    }

    pushY[i] = reqY;
    pushZ[i] = reqZ;
    minReqY[i] = reqY;
    minReqZ[i] = reqZ;
  }

  const nbrs: Array<Array<{ j: number; w: number }>> = Array.from({ length: vCount }, () => []);
  const addEdge = (a: number, b: number) => {
    if (a === b || sideArr[a] === 0 || sideArr[a] !== sideArr[b]) return;
    if (
      Math.abs(origX[a] - env.cx) > 0.02 * s &&
      Math.abs(origX[b] - env.cx) > 0.02 * s &&
      Math.sign(origX[a] - env.cx) !== Math.sign(origX[b] - env.cx)
    ) {
      return;
    }
    const d3 = Math.hypot(origX[a] - origX[b], origY[a] - origY[b], origZ[a] - origZ[b]);
    const w = 1 / (1 + d3 / (0.02 * s));
    nbrs[a].push({ j: b, w });
    nbrs[b].push({ j: a, w });
  };
  if (idx) {
    for (let t = 0; t + 2 < idx.count; t += 3) {
      const a = idx.getX(t);
      const b = idx.getX(t + 1);
      const c = idx.getX(t + 2);
      addEdge(a, b);
      addEdge(b, c);
      addEdge(c, a);
    }
  }

  const cellR = 0.034 * s;
  const grid = new Map<string, number[]>();
  for (let i = 0; i < vCount; i++) {
    if (sideArr[i] === 0) continue;
    const k = `${Math.floor(origX[i] / cellR)},${Math.floor(origY[i] / cellR)}`;
    let bucket = grid.get(k);
    if (!bucket) {
      bucket = [];
      grid.set(k, bucket);
    }
    bucket.push(i);
  }
  for (let i = 0; i < vCount; i++) {
    if (sideArr[i] === 0) continue;
    const gx = Math.floor(origX[i] / cellR);
    const gy = Math.floor(origY[i] / cellR);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(`${gx + dx},${gy + dy}`);
        if (!bucket) continue;
        for (let bi = 0; bi < bucket.length; bi++) {
          const j = bucket[bi];
          if (j <= i || sideArr[j] !== sideArr[i]) continue;
          if (
            Math.abs(origX[i] - env.cx) > 0.02 * s &&
            Math.abs(origX[j] - env.cx) > 0.02 * s &&
            Math.sign(origX[i] - env.cx) !== Math.sign(origX[j] - env.cx)
          ) {
            continue;
          }
          const d2 = Math.hypot(origX[i] - origX[j], origY[i] - origY[j]);
          const d3 = Math.hypot(origX[i] - origX[j], origY[i] - origY[j], origZ[i] - origZ[j]);
          if (d2 <= 0.032 * s && d3 <= 0.048 * s) {
            const w = 1 / (1 + d3 / (0.02 * s));
            nbrs[i].push({ j, w });
            nbrs[j].push({ j: i, w });
          }
        }
      }
    }
  }

  const nextY = new Float32Array(vCount);
  const nextZ = new Float32Array(vCount);
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < vCount; i++) {
      if (sideArr[i] === 0) {
        nextY[i] = 0;
        nextZ[i] = 0;
        continue;
      }
      let sumY = pushY[i];
      let sumZ = pushZ[i];
      let sumW = 1.0;
      let peakY = pushY[i];
      let peakAbsZ = Math.abs(pushZ[i]);
      const list = nbrs[i];
      for (let k = 0; k < list.length; k++) {
        const { j, w } = list[k];
        sumY += pushY[j] * w;
        sumZ += pushZ[j] * w;
        sumW += w;
        if (pushY[j] * 0.9 > peakY) peakY = pushY[j] * 0.9;
        if (Math.abs(pushZ[j]) * 0.9 > peakAbsZ) peakAbsZ = Math.abs(pushZ[j]) * 0.9;
      }
      const avgY = sumY / sumW;
      const avgZ = sumZ / sumW;
      const peakZ = sideArr[i] > 0 ? peakAbsZ : -peakAbsZ;
      let candY = (0.55 * peakY + 0.45 * avgY) * fadeArr[i];
      let candZ = (0.55 * peakZ + 0.45 * avgZ) * fadeArr[i];
      if (candY < minReqY[i]) candY = minReqY[i];
      if (sideArr[i] > 0 && candZ < minReqZ[i]) candZ = minReqZ[i];
      if (sideArr[i] < 0 && candZ > minReqZ[i]) candZ = minReqZ[i];
      nextY[i] = candY;
      nextZ[i] = candZ;
    }
    pushY.set(nextY);
    pushZ.set(nextZ);
  }

  // Weld UV-seam co-located duplicate vertices so seams never split during depenetration
  const seamGroups = new Map<string, number[]>();
  const qScale = 2000 / Math.max(0.25, s);
  for (let i = 0; i < vCount; i++) {
    const sk = `${Math.round(origX[i] * qScale)},${Math.round(origY[i] * qScale)},${Math.round(origZ[i] * qScale)}`;
    let grp = seamGroups.get(sk);
    if (!grp) {
      grp = [];
      seamGroups.set(sk, grp);
    }
    grp.push(i);
  }
  for (const grp of seamGroups.values()) {
    if (grp.length <= 1) continue;
    let avgY = 0;
    let avgZ = 0;
    for (let k = 0; k < grp.length; k++) {
      avgY += pushY[grp[k]];
      avgZ += pushZ[grp[k]];
    }
    avgY /= grp.length;
    avgZ /= grp.length;
    for (let k = 0; k < grp.length; k++) {
      const idxV = grp[k];
      const uy = Math.max(minReqY[idxV], avgY);
      const uz =
        sideArr[idxV] > 0
          ? Math.max(minReqZ[idxV], avgZ)
          : sideArr[idxV] < 0
            ? Math.min(minReqZ[idxV], avgZ)
            : avgZ;
      pushY[idxV] = uy;
      pushZ[idxV] = uz;
    }
  }

  for (let i = 0; i < vCount; i++) {
    pos.setXYZ(i, origX[i], origY[i] + pushY[i], origZ[i] + pushZ[i]);
  }
  pos.needsUpdate = true;
}

/**
 * Matches each vertex of a hair `_Outline` geometry to its corresponding vertex on the base
 * geometry by pristine-position proximity + inverted-normal alignment (handling Draco reordering
 * as well as direct `geometry.clone()` test meshes).
 */
function matchHairOutlineToBaseIndices(
  baseOrigPos: Float32Array,
  baseNrm: THREE.BufferAttribute | undefined,
  outlineOrigPos: Float32Array,
  outlineNrm: THREE.BufferAttribute | undefined,
  s: number,
): Int32Array {
  const bCount = Math.floor(baseOrigPos.length / 3);
  const oCount = Math.floor(outlineOrigPos.length / 3);
  const matches = new Int32Array(oCount);
  matches.fill(-1);
  if (bCount === 0 || oCount === 0) return matches;

  const cellSize = 0.02 * s;
  const grid = new Map<string, number[]>();
  const keyOf = (x: number, y: number, z: number) =>
    `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)},${Math.floor(z / cellSize)}`;

  for (let j = 0; j < bCount; j++) {
    const k = keyOf(baseOrigPos[j * 3], baseOrigPos[j * 3 + 1], baseOrigPos[j * 3 + 2]);
    let bucket = grid.get(k);
    if (!bucket) {
      bucket = [];
      grid.set(k, bucket);
    }
    bucket.push(j);
  }

  const maxR = 0.025 * s;
  const maxR2 = maxR * maxR;
  for (let i = 0; i < oCount; i++) {
    const ox = outlineOrigPos[i * 3];
    const oy = outlineOrigPos[i * 3 + 1];
    const oz = outlineOrigPos[i * 3 + 2];
    if (i < bCount) {
      const dx = ox - baseOrigPos[i * 3];
      const dy = oy - baseOrigPos[i * 3 + 1];
      const dz = oz - baseOrigPos[i * 3 + 2];
      if (dx * dx + dy * dy + dz * dz < 1e-8) {
        matches[i] = i;
        continue;
      }
    }
    const onx = outlineNrm ? outlineNrm.getX(i) : 0;
    const ony = outlineNrm ? outlineNrm.getY(i) : 0;
    const onz = outlineNrm ? outlineNrm.getZ(i) : 0;
    const cx = Math.floor(ox / cellSize);
    const cy = Math.floor(oy / cellSize);
    const cz = Math.floor(oz / cellSize);

    let bestJ = -1;
    let bestScore = Infinity;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (!bucket) continue;
          for (let bi = 0; bi < bucket.length; bi++) {
            const j = bucket[bi];
            const ddx = ox - baseOrigPos[j * 3];
            const ddy = oy - baseOrigPos[j * 3 + 1];
            const ddz = oz - baseOrigPos[j * 3 + 2];
            const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
            if (d2 > maxR2) continue;
            let score = Math.sqrt(d2);
            if (baseNrm && outlineNrm) {
              const dot = onx * baseNrm.getX(j) + ony * baseNrm.getY(j) + onz * baseNrm.getZ(j);
              score += (1 + dot) * (0.008 * s);
            }
            if (score < bestScore) {
              bestScore = score;
              bestJ = j;
            }
          }
        }
      }
    }
    matches[i] = bestJ;
  }
  return matches;
}

function syncHairOutlineToBaseMesh(
  outlineMesh: THREE.Mesh,
  baseMesh: THREE.Mesh,
  baseOrigPos: Float32Array,
  baseMeta: THREE.BufferAttribute,
  s: number,
): THREE.BufferAttribute {
  const oGeo = outlineMesh.geometry;
  const oPos = oGeo.getAttribute('position') as THREE.BufferAttribute;
  const oOrigPos =
    (oGeo.userData.__origHairPos as Float32Array | undefined) ??
    new Float32Array(oPos.array as ArrayLike<number>);
  const oNrm = oGeo.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const bPos = baseMesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const bNrm = baseMesh.geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;

  const matches = matchHairOutlineToBaseIndices(baseOrigPos, bNrm, oOrigPos, oNrm, s);
  const outMeta = new Float32Array(oPos.count * 2);

  for (let oi = 0; oi < oPos.count; oi++) {
    const bi = matches[oi];
    if (bi >= 0 && bi < bPos.count) {
      const dx = bPos.getX(bi) - baseOrigPos[bi * 3];
      const dy = bPos.getY(bi) - baseOrigPos[bi * 3 + 1];
      const dz = bPos.getZ(bi) - baseOrigPos[bi * 3 + 2];
      oPos.setXYZ(
        oi,
        oOrigPos[oi * 3] + dx,
        oOrigPos[oi * 3 + 1] + dy,
        oOrigPos[oi * 3 + 2] + dz,
      );
      outMeta[oi * 2] = baseMeta.getX(bi);
      outMeta[oi * 2 + 1] = baseMeta.getY(bi);
    } else {
      outMeta[oi * 2] = 0;
      outMeta[oi * 2 + 1] = 0;
    }
  }
  oPos.needsUpdate = true;

  const outSm = outlineMesh as THREE.SkinnedMesh;
  const baseSm = baseMesh as THREE.SkinnedMesh;
  if (outSm.isSkinnedMesh && baseSm.isSkinnedMesh && outSm.skeleton && baseSm.skeleton) {
    const oSi = oGeo.getAttribute('skinIndex') as THREE.BufferAttribute | undefined;
    const oSw = oGeo.getAttribute('skinWeight') as THREE.BufferAttribute | undefined;
    const bSi = baseSm.geometry.getAttribute('skinIndex') as THREE.BufferAttribute | undefined;
    const bSw = baseSm.geometry.getAttribute('skinWeight') as THREE.BufferAttribute | undefined;
    if (oSi && oSw && bSi && bSw) {
      const baseToOutBone = new Int32Array(baseSm.skeleton.bones.length);
      baseToOutBone.fill(-1);
      const outBoneByName = new Map<string, number>();
      for (let k = 0; k < outSm.skeleton.bones.length; k++) {
        const b = outSm.skeleton.bones[k];
        if (b && !outBoneByName.has(b.name)) outBoneByName.set(b.name, k);
      }
      for (let k = 0; k < baseSm.skeleton.bones.length; k++) {
        const b = baseSm.skeleton.bones[k];
        if (!b) continue;
        const exactOut = outSm.skeleton.bones[k] === b ? k : outSm.skeleton.bones.indexOf(b);
        baseToOutBone[k] = exactOut >= 0 ? exactOut : outBoneByName.get(b.name) ?? -1;
      }

      for (let oi = 0; oi < oPos.count; oi++) {
        const bi = matches[oi];
        if (bi < 0 || bi >= bPos.count) continue;
        const js = [
          Math.round(bSi.getX(bi)),
          Math.round(bSi.getY(bi)),
          Math.round(bSi.getZ(bi)),
          Math.round(bSi.getW(bi)),
        ];
        const ws = [bSw.getX(bi), bSw.getY(bi), bSw.getZ(bi), bSw.getW(bi)];
        let valid = true;
        for (let k = 0; k < 4; k++) {
          if (ws[k] > 0) {
            const mapped = js[k] >= 0 && js[k] < baseToOutBone.length ? baseToOutBone[js[k]] : -1;
            if (mapped < 0) {
              valid = false;
              break;
            }
            js[k] = mapped;
          } else {
            js[k] = 0;
          }
        }
        if (valid) {
          oSi.setXYZW(oi, js[0], js[1], js[2], js[3]);
          writeNormalizedSkinWeight4(oSw, oi, ws[0], ws[1], ws[2], ws[3]);
        }
      }
      oSi.needsUpdate = true;
      oSw.needsUpdate = true;
    }
  }

  return new THREE.BufferAttribute(outMeta, 2);
}

interface SecondaryShaderUniformSet {
  uSecondaryDisp: { value: THREE.Vector3 };
  uSecondaryAnchor: { value: THREE.Vector3 };
  uSecondaryParams: { value: THREE.Vector4 };
  uSecChestLA?: { value: THREE.Vector4 };
  uSecChestLB?: { value: THREE.Vector4 };
  uSecChestRA?: { value: THREE.Vector4 };
  uSecChestRB?: { value: THREE.Vector4 };
  uSecClavLA?: { value: THREE.Vector4 };
  uSecClavLB?: { value: THREE.Vector4 };
  uSecClavRA?: { value: THREE.Vector4 };
  uSecClavRB?: { value: THREE.Vector4 };
  uSecBackA?: { value: THREE.Vector4 };
  uSecBackB?: { value: THREE.Vector4 };
}

interface HookedMaterialRecord {
  mesh: THREE.Mesh;
  originalMaterial: THREE.Material | THREE.Material[];
  clonedMaterials: THREE.Material[];
  kind: SecondaryMeshKind;
}

const SECONDARY_SHADER_COMMON_PARS = /* glsl */ `
uniform vec3 uSecondaryDisp;
uniform vec3 uSecondaryAnchor;
uniform vec4 uSecondaryParams;
attribute vec2 aSecondaryMeta;
`;

const SECONDARY_SHADER_HAIR_COLLIDER_PARS = /* glsl */ `
uniform vec4 uSecChestLA;
uniform vec4 uSecChestLB;
uniform vec4 uSecChestRA;
uniform vec4 uSecChestRB;
uniform vec4 uSecClavLA;
uniform vec4 uSecClavLB;
uniform vec4 uSecClavRA;
uniform vec4 uSecClavRB;
uniform vec4 uSecBackA;
uniform vec4 uSecBackB;
void secPushCapsule( inout vec3 cand, vec3 orig, vec4 capA, vec4 capB ) {
  if ( capA.w > 0.0001 ) {
    vec3 seg = capB.xyz - capA.xyz;
    float segLenSq = dot( seg, seg );
    float t = segLenSq > 1e-8 ? clamp( dot( cand - capA.xyz, seg ) / segLenSq, 0.0, 1.0 ) : 0.0;
    vec3 closest = capA.xyz + seg * t;
    float tOrig = segLenSq > 1e-8 ? clamp( dot( orig - capA.xyz, seg ) / segLenSq, 0.0, 1.0 ) : 0.0;
    vec3 closestOrig = capA.xyz + seg * tOrig;
    float origDist = length( orig - closestOrig );
    vec3 diff = cand - closest;
    float candDist = length( diff );
    float minAllowed = min( capA.w, origDist );
    if ( candDist < minAllowed ) {
      vec3 dir = candDist > 0.0001 ? ( diff / candDist ) : normalize( orig - closestOrig + vec3( 0.0, 0.0, 0.001 ) );
      if ( orig.z > closestOrig.z + 0.008 && dir.z < 0.0 ) {
        dir = normalize( vec3( dir.x, max( 0.0, dir.y ), abs( dir.z ) + 0.25 ) );
      } else if ( orig.z < closestOrig.z - 0.008 && dir.z > 0.0 ) {
        dir = normalize( vec3( dir.x, max( 0.0, dir.y ), -abs( dir.z ) - 0.25 ) );
      }
      cand = closest + dir * minAllowed;
    }
  }
}
`;

export function buildSecondaryVertexInjection(isHair: boolean): string {
  if (isHair) {
    return /* glsl */ `
#include <begin_vertex>
{
  float secMob = aSecondaryMeta.x;
  if ( secMob > 0.0001 ) {
    float secWaveA = sin( uSecondaryParams.y + aSecondaryMeta.y ) * uSecondaryParams.z;
    float secWaveB = cos( uSecondaryParams.y * 1.37 + aSecondaryMeta.y * 0.72 ) * ( uSecondaryParams.z * 0.55 );
    vec3 secDelta = uSecondaryDisp * secMob;
    secDelta.x += secWaveA * secMob;
    secDelta.z += secWaveB * secMob;
    secDelta.y += length( uSecondaryDisp.xz ) * 0.16 * secMob;
    vec3 secCand = transformed + secDelta;
    float safeR = uSecondaryParams.x;
    if ( safeR > 0.0001 ) {
      vec3 origFromSkull = transformed - uSecondaryAnchor;
      vec3 candFromSkull = secCand - uSecondaryAnchor;
      vec3 origScaled = vec3( origFromSkull.x, origFromSkull.y * 0.84, origFromSkull.z );
      vec3 candScaled = vec3( candFromSkull.x, candFromSkull.y * 0.84, candFromSkull.z );
      float origDist = length( origScaled );
      float candDist = length( candScaled );
      float minAllowed = min( safeR, origDist );
      if ( candDist < minAllowed && candDist > 0.0001 ) {
        vec3 pushDir = candScaled / candDist;
        vec3 pushed = vec3( pushDir.x, pushDir.y / 0.84, pushDir.z ) * minAllowed;
        secCand = uSecondaryAnchor + pushed;
      }
    }
    secPushCapsule( secCand, transformed, uSecChestLA, uSecChestLB );
    secPushCapsule( secCand, transformed, uSecChestRA, uSecChestRB );
    secPushCapsule( secCand, transformed, uSecClavLA, uSecClavLB );
    secPushCapsule( secCand, transformed, uSecClavRA, uSecClavRB );
    secPushCapsule( secCand, transformed, uSecBackA, uSecBackB );
    transformed = secCand;
  }
}
`;
  }
  return /* glsl */ `
#include <begin_vertex>
{
  float secMob = aSecondaryMeta.x;
  if ( secMob > 0.0001 ) {
    float secWaveA = sin( uSecondaryParams.y + aSecondaryMeta.y ) * uSecondaryParams.z;
    float secWaveB = cos( uSecondaryParams.y * 1.31 + aSecondaryMeta.y * 0.68 ) * ( uSecondaryParams.z * 0.55 );
    vec3 secDelta = uSecondaryDisp * secMob;
    secDelta.x += secWaveA * secMob;
    secDelta.z += secWaveB * secMob;
    secDelta.y += length( uSecondaryDisp.xz ) * 0.14 * secMob;
    vec3 secCand = transformed + secDelta;
    float safeR = uSecondaryParams.x;
    if ( safeR > 0.0001 ) {
      vec2 origXZ = transformed.xz - uSecondaryAnchor.xz;
      vec2 candXZ = secCand.xz - uSecondaryAnchor.xz;
      float origRad = length( origXZ );
      float candRad = length( candXZ );
      float minAllowed = min( safeR, origRad );
      if ( candRad < minAllowed && candRad > 0.0001 ) {
        secCand.xz = uSecondaryAnchor.xz + ( candXZ / candRad ) * minAllowed;
      }
    }
    transformed = secCand;
  }
}
`;
}

function wrapMaterialWithSecondaryHook(
  mat: THREE.Material,
  kind: SecondaryMeshKind,
  uniformSet: SecondaryShaderUniformSet,
  cloneMaterials: boolean,
): THREE.Material {
  const target = cloneMaterials ? mat.clone() : mat;
  if (cloneMaterials) {
    target.onBeforeCompile = mat.onBeforeCompile;
    target.customProgramCacheKey = mat.customProgramCacheKey;
    target.userData = { ...(mat.userData ?? {}), __isSecondaryPhysicsClonedMat: true };
  }

  const prevKey =
    typeof target.customProgramCacheKey === 'function'
      ? target.customProgramCacheKey.bind(target)
      : null;
  const prevCompile =
    typeof target.onBeforeCompile === 'function'
      ? target.onBeforeCompile.bind(target)
      : null;

  const isHair = kind === 'hair';
  const suffix = isHair ? '|blitz-sec-hair-v2' : '|blitz-sec-garment-v1';

  target.customProgramCacheKey = () => `${prevKey ? prevKey() : target.type}${suffix}`;
  target.onBeforeCompile = (shader, renderer) => {
    if (prevCompile) {
      prevCompile(shader, renderer);
    }
    shader.uniforms.uSecondaryDisp = uniformSet.uSecondaryDisp;
    shader.uniforms.uSecondaryAnchor = uniformSet.uSecondaryAnchor;
    shader.uniforms.uSecondaryParams = uniformSet.uSecondaryParams;
    if (isHair) {
      shader.uniforms.uSecChestLA = uniformSet.uSecChestLA!;
      shader.uniforms.uSecChestLB = uniformSet.uSecChestLB!;
      shader.uniforms.uSecChestRA = uniformSet.uSecChestRA!;
      shader.uniforms.uSecChestRB = uniformSet.uSecChestRB!;
      shader.uniforms.uSecClavLA = uniformSet.uSecClavLA!;
      shader.uniforms.uSecClavLB = uniformSet.uSecClavLB!;
      shader.uniforms.uSecClavRA = uniformSet.uSecClavRA!;
      shader.uniforms.uSecClavRB = uniformSet.uSecClavRB!;
      shader.uniforms.uSecBackA = uniformSet.uSecBackA!;
      shader.uniforms.uSecBackB = uniformSet.uSecBackB!;
    }

    if (!shader.vertexShader.includes('uSecondaryDisp')) {
      const extraPars = isHair
        ? `${SECONDARY_SHADER_COMMON_PARS}${SECONDARY_SHADER_HAIR_COLLIDER_PARS}`
        : SECONDARY_SHADER_COMMON_PARS;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>\n${extraPars}`,
      );
      if (shader.vertexShader.includes('#include <begin_vertex>')) {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          buildSecondaryVertexInjection(isHair),
        );
      }
    }
  };
  target.needsUpdate = true;
  return target;
}

/**
 * Creates a reusable, zero-allocation-per-frame secondary physics controller for any
 * character rig (`PelvisRoot`, Mixamo, VRM, or procedural).
 *
 * Combines:
 * 1. Full Verlet `THREE.Bone`-chain spring physics with anatomical sphere & capsule colliders
 * 2. VRM 0.x (`secondaryAnimation`) & VRM 1.0 (`VRMC_springBone`) metadata support
 * 3. Scalp-anchored vertex-shader + Verlet proxy secondary motion for single-mesh rigid GLB hair/skirts/ribbons
 * 4. `dt` clamping, teleport spike clamping, and clean `dispose()` lifecycle
 */
export function createCharacterSecondaryPhysicsController(
  rigRoot: THREE.Object3D,
  options: CharacterSecondaryPhysicsOptions = {},
): CharacterSecondaryPhysicsController {
  const maxDt = Math.max(0.005, options.maxDt ?? DEFAULT_MAX_DT);
  const teleportThreshold = Math.max(0.1, options.teleportDistanceThreshold ?? DEFAULT_TELEPORT_THRESHOLD);
  const maxWorldSpeed = Math.max(1, options.maxWorldSpeed ?? DEFAULT_MAX_WORLD_SPEED);
  const windSensitivity = Math.max(0, options.windSensitivity ?? DEFAULT_WIND_SENSITIVITY);
  const maxAngleRad = clamp(options.maxAngleRad ?? DEFAULT_MAX_ANGLE_RAD, 0.1, Math.PI * 0.9);
  const enableShaderFallback = options.enableShaderFallback ?? true;
  const cloneMaterials = options.cloneMaterials ?? true;

  let bones: AnatomicalBoneMap = {
    head: null,
    neck: null,
    upperChest: null,
    spine: null,
    hips: null,
    leftShoulder: null,
    rightShoulder: null,
    leftArm: null,
    rightArm: null,
    leftUpLeg: null,
    rightUpLeg: null,
  };
  let anatomy!: RigAnatomyMetrics;
  let colliders: SpringBoneCollider[] = [];
  let parsedChains: ParsedSpringBoneChain[] = [];
  let joints: SpringBoneJointRuntime[] = [];
  let activeSpringBones = new Set<THREE.Bone>();
  let hookedMaterials: HookedMaterialRecord[] = [];
  let rootParentCache: Array<{
    node: THREE.Object3D;
    elems: THREE.Matrix4['elements'];
    qx: number;
    qy: number;
    qz: number;
    qw: number;
    scale: number;
  }> = [];
  let allJointsUniformSafe = true;
  let hasHairHooks = false;
  let hasGarmentHooks = false;
  let hasHeadBindQuat = false;
  const headBindQuat = new THREE.Quaternion();
  let hasHipBindQuat = false;
  const hipBindQuat = new THREE.Quaternion();
  let headRefNode: THREE.Object3D = rigRoot;
  let hipRefNode: THREE.Object3D = rigRoot;
  let activeLodMode: SecondaryPhysicsLodMode = 'full';
  let isSleeping = false;
  let halfDtAccum = 0;

  const ownerId = nextHairPhysicsOwnerId++;
  let hookedHairMeshes: THREE.Mesh[] = [];

  // Per-rig shader uniform sets (isolated per controller instance, shared GLSL program cache key)
  const hairUniforms: SecondaryShaderUniformSet = {
    uSecondaryDisp: { value: new THREE.Vector3() },
    uSecondaryAnchor: { value: new THREE.Vector3() },
    uSecondaryParams: { value: new THREE.Vector4(0.085, 0, 0.0042, 0) },
    uSecChestLA: { value: new THREE.Vector4() },
    uSecChestLB: { value: new THREE.Vector4() },
    uSecChestRA: { value: new THREE.Vector4() },
    uSecChestRB: { value: new THREE.Vector4() },
    uSecClavLA: { value: new THREE.Vector4() },
    uSecClavLB: { value: new THREE.Vector4() },
    uSecClavRA: { value: new THREE.Vector4() },
    uSecClavRB: { value: new THREE.Vector4() },
    uSecBackA: { value: new THREE.Vector4() },
    uSecBackB: { value: new THREE.Vector4() },
  };
  const garmentUniforms: SecondaryShaderUniformSet = {
    uSecondaryDisp: { value: new THREE.Vector3() },
    uSecondaryAnchor: { value: new THREE.Vector3() },
    uSecondaryParams: { value: new THREE.Vector4(0.105, 0, 0.0034, 0) },
  };

  // CPU Verlet proxy pendulums for shader fallback (world-space displacement around rest tip)
  const hairProxyDispWorld = new THREE.Vector3();
  const hairProxyPrevWorld = new THREE.Vector3();
  const garmentProxyDispWorld = new THREE.Vector3();
  const garmentProxyPrevWorld = new THREE.Vector3();
  let phaseTime = 0;

  // Zero-alloc per-controller scratch registers
  const prevRigWorldPos = new THREE.Vector3();
  let hasPrevRigWorldPos = false;
  const curRigWorldPos = new THREE.Vector3();
  const worldVelScratch = new THREE.Vector3();
  const boneWorldQuatScratch = new THREE.Quaternion();

  let disposed = false;
  const metrics: CharacterSecondaryPhysicsMetrics = {
    boneChains: 0,
    colliders: 0,
    secondaryShaderHooks: 0,
  };

  const restoreHookedMaterials = () => {
    for (let i = 0; i < hookedMaterials.length; i++) {
      const rec = hookedMaterials[i];
      const stillOwned = Array.isArray(rec.mesh.material)
        ? rec.clonedMaterials.some((cm) => (rec.mesh.material as THREE.Material[]).includes(cm))
        : rec.clonedMaterials.includes(rec.mesh.material);
      if (stillOwned) {
        rec.mesh.material = rec.originalMaterial;
      }
      for (let j = 0; j < rec.clonedMaterials.length; j++) {
        if (cloneMaterials) {
          rec.clonedMaterials[j].dispose();
        }
      }
    }
    hookedMaterials = [];
  };

  const setup = () => {
    rigRoot.updateMatrixWorld(true);
    bones = resolveAnatomicalBoneMap(rigRoot);
    anatomy = computeRigAnatomyMetrics(rigRoot, bones);

    hairUniforms.uSecondaryAnchor.value.copy(anatomy.skullBindCenter);
    hairUniforms.uSecondaryParams.value.set(
      anatomy.skullBindRadius * 0.98,
      phaseTime,
      0.0042 * anatomy.anatScale,
      0,
    );
    garmentUniforms.uSecondaryAnchor.value.copy(anatomy.hipsBindPos);
    garmentUniforms.uSecondaryParams.value.set(
      0.105 * anatomy.anatScale,
      phaseTime,
      0.0034 * anatomy.anatScale,
      0,
    );

    const vrmParsed = extractVrmSecondaryAnimationMetadata(rigRoot, options);
    const autoColliders =
      options.autoBuildColliders !== false
        ? buildAnatomicalCharacterColliders(rigRoot, bones, anatomy)
        : [];

    if (vrmParsed) {
      colliders = [...vrmParsed.colliders, ...autoColliders];
      parsedChains = vrmParsed.chains.map((c) => ({
        ...c,
        colliders: c.colliders.length > 0 ? c.colliders : colliders,
      }));
    } else {
      colliders = autoColliders;
      parsedChains = discoverAutoSpringBoneChains(rigRoot, colliders, options);
    }

    const built = buildJointRuntimes(parsedChains, rigRoot, anatomy, maxAngleRad);
    joints = built.joints;
    activeSpringBones = built.activeBones;
    allJointsUniformSafe = true;
    for (let ji = 0; ji < joints.length; ji++) {
      if (!joints[ji].uniformScaleSafe) {
        allJointsUniformSafe = false;
        break;
      }
    }
    rootParentCache = built.rootParents.map((node) => ({
      node,
      elems: node.matrixWorld.elements,
      qx: 0,
      qy: 0,
      qz: 0,
      qw: 1,
      scale: 1,
    }));

    // Hook eligible rigid-bound hair / skirt / ribbon meshes & companion `_Outline` meshes
    restoreHookedMaterials();
    hookedHairMeshes = [];
    const torsoEnvelope = buildTorsoBindCollisionEnvelope(rigRoot, anatomy);
    const shaderCapsules = fitShaderCapsulesFromEnvelope(torsoEnvelope);
    hairUniforms.uSecChestLA!.value.copy(shaderCapsules.chestLA);
    hairUniforms.uSecChestLB!.value.copy(shaderCapsules.chestLB);
    hairUniforms.uSecChestRA!.value.copy(shaderCapsules.chestRA);
    hairUniforms.uSecChestRB!.value.copy(shaderCapsules.chestRB);
    hairUniforms.uSecClavLA!.value.copy(shaderCapsules.clavLA);
    hairUniforms.uSecClavLB!.value.copy(shaderCapsules.clavLB);
    hairUniforms.uSecClavRA!.value.copy(shaderCapsules.clavRA);
    hairUniforms.uSecClavRB!.value.copy(shaderCapsules.clavRB);
    hairUniforms.uSecBackA!.value.copy(shaderCapsules.backA);
    hairUniforms.uSecBackB!.value.copy(shaderCapsules.backB);

    if (enableShaderFallback) {
      const allMeshes: THREE.Mesh[] = [];
      const baseMetaByStem = new Map<string, THREE.BufferAttribute>();
      const baseHairByStem = new Map<
        string,
        { mesh: THREE.Mesh; origPos: Float32Array; meta: THREE.BufferAttribute }
      >();
      rigRoot.traverse((node) => {
        if ((node as THREE.Mesh).isMesh) {
          allMeshes.push(node as THREE.Mesh);
        }
      });

      // Pass 1: base meshes first so companion `_Outline` meshes copy exact per-vertex metadata
      const classified: Array<{ mesh: THREE.Mesh; kind: SecondaryMeshKind; isOutline: boolean }> = [];
      for (let i = 0; i < allMeshes.length; i++) {
        const mesh = allMeshes[i];
        if (options.forceShaderFallback) {
          const lower = (mesh.name || '').toLowerCase();
          const forcedKind: SecondaryMeshKind | null = HAIR_MESH_RE.test(lower)
            ? 'hair'
            : RIBBON_MESH_RE.test(lower)
              ? 'ribbon'
              : GARMENT_MESH_RE.test(lower)
                ? 'garment'
                : null;
          if (forcedKind) {
            classified.push({ mesh, kind: forcedKind, isOutline: lower.includes('outline') });
          }
          continue;
        }
        const kind = classifySecondaryMesh(mesh, activeSpringBones, anatomy);
        if (kind) {
          classified.push({
            mesh,
            kind,
            isOutline: (mesh.name || '').toLowerCase().includes('outline'),
          });
        }
      }

      classified.sort((a, b) => (a.isOutline === b.isOutline ? 0 : a.isOutline ? 1 : -1));

      for (let i = 0; i < classified.length; i++) {
        const { mesh, kind, isOutline } = classified[i];
        const rawStem = (mesh.name || '')
          .toLowerCase()
          .replace(/_?outline(?:_\d+)?$/i, '')
          .replace(/_\d+$/, '');
        const visStem = `${rawStem}|${mesh.visible ? 'v' : 'h'}`;

        let metaAttr: THREE.BufferAttribute;
        if (kind === 'hair') {
          captureAndRestorePristineHairGeometry(mesh, ownerId);
          hookedHairMeshes.push(mesh);
          const baseEntry = isOutline
            ? baseHairByStem.get(visStem) ?? baseHairByStem.get(rawStem) ?? null
            : null;
          if (isOutline && baseEntry) {
            metaAttr = syncHairOutlineToBaseMesh(
              mesh,
              baseEntry.mesh,
              baseEntry.origPos,
              baseEntry.meta,
              anatomy.anatScale,
            );
            mesh.geometry.setAttribute('aSecondaryMeta', metaAttr);
          } else {
            rebalanceChestHairWeights(mesh, anatomy.anatScale);
            depenetrateHairMeshAgainstEnvelope(mesh, torsoEnvelope, anatomy);
            metaAttr = computeSecondaryVertexMeta(mesh.geometry, kind, anatomy, null);
            mesh.geometry.setAttribute('aSecondaryMeta', metaAttr);
            if (!isOutline && rawStem) {
              const origPos = mesh.geometry.userData.__origHairPos as Float32Array;
              const rec = { mesh, origPos, meta: metaAttr };
              baseHairByStem.set(visStem, rec);
              if (mesh.visible || !baseHairByStem.has(rawStem)) {
                baseHairByStem.set(rawStem, rec);
              }
            }
          }
        } else {
          const companionMeta = isOutline ? baseMetaByStem.get(rawStem) ?? null : null;
          metaAttr = computeSecondaryVertexMeta(mesh.geometry, kind, anatomy, companionMeta);
          mesh.geometry.setAttribute('aSecondaryMeta', metaAttr);
          if (!isOutline && rawStem) {
            baseMetaByStem.set(rawStem, metaAttr);
          }
        }

        const uniformSet = kind === 'hair' ? hairUniforms : garmentUniforms;
        const originalMaterial = mesh.material;
        const clonedMaterials: THREE.Material[] = [];
        if (Array.isArray(originalMaterial)) {
          const nextMats = originalMaterial.map((m) => {
            const wrapped = wrapMaterialWithSecondaryHook(m, kind, uniformSet, cloneMaterials);
            clonedMaterials.push(wrapped);
            return wrapped;
          });
          mesh.material = nextMats;
        } else if (originalMaterial) {
          const wrapped = wrapMaterialWithSecondaryHook(
            originalMaterial,
            kind,
            uniformSet,
            cloneMaterials,
          );
          clonedMaterials.push(wrapped);
          mesh.material = wrapped;
        }

        hookedMaterials.push({
          mesh,
          originalMaterial,
          clonedMaterials,
          kind,
        });
      }
    }

    metrics.boneChains = parsedChains.length;
    metrics.colliders = colliders.length;
    metrics.secondaryShaderHooks = hookedMaterials.length;

    hasHairHooks = false;
    hasGarmentHooks = false;
    for (let hi = 0; hi < hookedMaterials.length; hi++) {
      if (hookedMaterials[hi].kind === 'hair') {
        hasHairHooks = true;
      } else {
        hasGarmentHooks = true;
      }
    }

    headRefNode = bones.head ?? rigRoot;
    const headBindMat = anatomy.bindMatricesByBone.get(headRefNode);
    if (headBindMat) {
      hasHeadBindQuat = true;
      decomposeWorldRotationAndScale(headBindMat, headBindQuat);
    } else {
      hasHeadBindQuat = false;
    }

    hipRefNode = bones.hips ?? bones.spine ?? rigRoot;
    const hipBindMat = anatomy.bindMatricesByBone.get(hipRefNode);
    if (hipBindMat) {
      hasHipBindQuat = true;
      decomposeWorldRotationAndScale(hipBindMat, hipBindQuat);
    } else {
      hasHipBindQuat = false;
    }

    isSleeping = false;
    halfDtAccum = 0;

    curRigWorldPos.setFromMatrixPosition(rigRoot.matrixWorld);
    prevRigWorldPos.copy(curRigWorldPos);
    hasPrevRigWorldPos = true;
  };

  const snapTailsToCurrentRestPose = () => {
    for (let i = 0; i < joints.length; i++) {
      const j = joints[i];
      const m = j.bone.matrixWorld.elements;
      const hx = m[12];
      const hy = m[13];
      const hz = m[14];
      const scale = extractRotationQuatAndScaleFromMatrix4(j.bone.matrixWorld);
      const qx = _exQuatX;
      const qy = _exQuatY;
      const qz = _exQuatZ;
      const qw = _exQuatW;
      const vx = j.boneAxisLocal.x;
      const vy = j.boneAxisLocal.y;
      const vz = j.boneAxisLocal.z;
      const ix = qw * vx + qy * vz - qz * vy;
      const iy = qw * vy + qz * vx - qx * vz;
      const iz = qw * vz + qx * vy - qy * vx;
      const iw = -qx * vx - qy * vy - qz * vz;
      let rdx = ix * qw + iw * -qx + iy * -qz - iz * -qy;
      let rdy = iy * qw + iw * -qy + iz * -qx - ix * -qz;
      let rdz = iz * qw + iw * -qz + ix * -qy - iy * -qx;
      const rLen = Math.sqrt(rdx * rdx + rdy * rdy + rdz * rdz);
      if (rLen > 1e-10) {
        const inv = (j.restLengthLocal * scale) / rLen;
        rdx *= inv;
        rdy *= inv;
        rdz *= inv;
      }
      j.curTailX = hx + rdx;
      j.curTailY = hy + rdy;
      j.curTailZ = hz + rdz;
      j.prevTailX = j.curTailX;
      j.prevTailY = j.curTailY;
      j.prevTailZ = j.curTailZ;
      j.prevSubDt = SUBSTEP_DT_TARGET;
    }
  };

  const reset = () => {
    if (disposed) return;
    if (joints.length > 0) {
      for (let i = 0; i < joints.length; i++) {
        const j = joints[i];
        j.bone.quaternion.copy(j.initialLocalQuat);
        j.bone.updateMatrix();
      }
      rigRoot.updateMatrixWorld(true);
      snapTailsToCurrentRestPose();
    }

    hairProxyDispWorld.set(0, 0, 0);
    hairProxyPrevWorld.set(0, 0, 0);
    garmentProxyDispWorld.set(0, 0, 0);
    garmentProxyPrevWorld.set(0, 0, 0);
    phaseTime = 0;
    halfDtAccum = 0;
    hairUniforms.uSecondaryDisp.value.set(0, 0, 0);
    hairUniforms.uSecondaryParams.value.y = 0;
    garmentUniforms.uSecondaryDisp.value.set(0, 0, 0);
    garmentUniforms.uSecondaryParams.value.y = 0;

    curRigWorldPos.setFromMatrixPosition(rigRoot.matrixWorld);
    prevRigWorldPos.copy(curRigWorldPos);
    hasPrevRigWorldPos = true;
  };

  const stepProxyPendulum = (
    dispWorld: THREE.Vector3,
    prevDispWorld: THREE.Vector3,
    subDt: number,
    rigScale: number,
    accelX: number,
    accelY: number,
    accelZ: number,
    stiffness: number,
    dampingRate: number,
    maxAmpWorld: number,
  ) => {
    const damp = Math.exp(-dampingRate * subDt);
    const vx = (dispWorld.x - prevDispWorld.x) * damp;
    const vy = (dispWorld.y - prevDispWorld.y) * damp;
    const vz = (dispWorld.z - prevDispWorld.z) * damp;

    // Restoring spring toward (0,0,0) + external aerodynamic/turn/gravity-bounce acceleration
    const dt2 = subDt * subDt;
    const nx = dispWorld.x + vx + (accelX - stiffness * dispWorld.x) * dt2;
    const ny = dispWorld.y + vy + (accelY - stiffness * dispWorld.y) * dt2;
    const nz = dispWorld.z + vz + (accelZ - stiffness * dispWorld.z) * dt2;

    prevDispWorld.copy(dispWorld);
    dispWorld.set(
      Number.isFinite(nx) ? nx : 0,
      Number.isFinite(ny) ? ny : 0,
      Number.isFinite(nz) ? nz : 0,
    );

    const lenSq = dispWorld.lengthSq();
    const maxAllowed = maxAmpWorld * rigScale;
    if (lenSq > maxAllowed * maxAllowed && lenSq > 1e-10) {
      dispWorld.multiplyScalar(maxAllowed / Math.sqrt(lenSq));
    }
  };

  const update = (dt: number, state?: CharacterSecondaryPhysicsState) => {
    if (disposed || !Number.isFinite(dt) || dt <= 0) {
      return;
    }

    const reqLod: SecondaryPhysicsLodMode = state?.lod ?? 'full';
    activeLodMode = reqLod;
    if (reqLod === 'sleep') {
      if (isSleeping) {
        return;
      }
      isSleeping = true;
      halfDtAccum = 0;
      reset();
      return;
    }

    const wasSleeping = isSleeping;
    if (wasSleeping) {
      isSleeping = false;
      halfDtAccum = 0;
    }

    const clampedDt = clamp(dt, 0, maxDt);
    let effDt = clampedDt;
    if (reqLod === 'half') {
      if (wasSleeping) {
        halfDtAccum = 0;
      } else {
        halfDtAccum += clampedDt;
        if (halfDtAccum < 0.025) {
          return;
        }
        effDt = Math.min(maxDt, halfDtAccum);
        halfDtAccum = 0;
      }
    } else {
      halfDtAccum = 0;
    }

    const hasAnySimulation = joints.length > 0 || hookedMaterials.length > 0;
    if (hasAnySimulation && !state?.skipRigMatrixWorldUpdate) {
      rigRoot.updateMatrixWorld(true);
    }

    const anchorNode = bones.head ?? bones.hips ?? rigRoot;
    const anchorWorldScale = getUniformWorldScale(anchorNode);
    const rigScale = anchorWorldScale > 1e-5 ? anchorWorldScale : 1;

    // Teleport / velocity spike detection on rig root world position
    const rigEl = rigRoot.matrixWorld.elements;
    curRigWorldPos.set(rigEl[12], rigEl[13], rigEl[14]);
    if (wasSleeping || !hasPrevRigWorldPos) {
      prevRigWorldPos.copy(curRigWorldPos);
      hasPrevRigWorldPos = true;
      if (wasSleeping) {
        if (joints.length > 0) {
          snapTailsToCurrentRestPose();
        }
        hairProxyDispWorld.set(0, 0, 0);
        hairProxyPrevWorld.set(0, 0, 0);
        garmentProxyDispWorld.set(0, 0, 0);
        garmentProxyPrevWorld.set(0, 0, 0);
      }
    }

    if (!hasAnySimulation) {
      prevRigWorldPos.copy(curRigWorldPos);
      return;
    }

    const dRigX = curRigWorldPos.x - prevRigWorldPos.x;
    const dRigY = curRigWorldPos.y - prevRigWorldPos.y;
    const dRigZ = curRigWorldPos.z - prevRigWorldPos.z;
    const deltaDist = Math.sqrt(dRigX * dRigX + dRigY * dRigY + dRigZ * dRigZ);
    const effTeleportDist = teleportThreshold * rigScale;
    let frameRigVelX = 0;
    let frameRigVelY = 0;
    let frameRigVelZ = 0;

    if (!Number.isFinite(deltaDist) || deltaDist > effTeleportDist) {
      // Teleport: preserve relative tail offset cleanly with zero velocity whip
      if (Number.isFinite(deltaDist)) {
        for (let i = 0; i < joints.length; i++) {
          const jj = joints[i];
          jj.curTailX += dRigX;
          jj.curTailY += dRigY;
          jj.curTailZ += dRigZ;
          jj.prevTailX = jj.curTailX;
          jj.prevTailY = jj.curTailY;
          jj.prevTailZ = jj.curTailZ;
        }
      }
      hairProxyPrevWorld.copy(hairProxyDispWorld);
      garmentProxyPrevWorld.copy(garmentProxyDispWorld);
    } else if (effDt > 1e-5) {
      const maxMove = maxWorldSpeed * rigScale * effDt;
      if (deltaDist > maxMove && deltaDist > 1e-6) {
        const excessRatio = (deltaDist - maxMove) / deltaDist;
        const exX = dRigX * excessRatio;
        const exY = dRigY * excessRatio;
        const exZ = dRigZ * excessRatio;
        for (let i = 0; i < joints.length; i++) {
          const jj = joints[i];
          jj.curTailX += exX;
          jj.curTailY += exY;
          jj.curTailZ += exZ;
          jj.prevTailX += exX;
          jj.prevTailY += exY;
          jj.prevTailZ += exZ;
        }
      }
      frameRigVelX = clamp(dRigX / effDt, -maxWorldSpeed, maxWorldSpeed);
      frameRigVelY = clamp(dRigY / effDt, -maxWorldSpeed, maxWorldSpeed);
      frameRigVelZ = clamp(dRigZ / effDt, -maxWorldSpeed, maxWorldSpeed);
    }
    prevRigWorldPos.copy(curRigWorldPos);

    // Sanitize & clamp external state inputs
    if (state?.worldVelocity) {
      readVector3Input(state.worldVelocity, worldVelScratch, 0, 0, 0);
      const speedSq = worldVelScratch.lengthSq();
      if (speedSq > maxWorldSpeed * maxWorldSpeed && speedSq > 1e-8) {
        worldVelScratch.multiplyScalar(maxWorldSpeed / Math.sqrt(speedSq));
      }
    } else {
      worldVelScratch.set(frameRigVelX, frameRigVelY, frameRigVelZ);
    }

    const yawRate = Number.isFinite(Number(state?.angularYawRate))
      ? clamp(Number(state!.angularYawRate), -12, 12)
      : 0;
    const windX = Number.isFinite(Number(state?.windX)) ? clamp(Number(state!.windX), -20, 20) : 0;
    const windZ = Number.isFinite(Number(state?.windZ)) ? clamp(Number(state!.windZ), -20, 20) : 0;

    // Aerodynamic drag opposes movement velocity + adds ambient wind
    const windForceX = (windX - worldVelScratch.x) * windSensitivity;
    const windForceY = -worldVelScratch.y * 0.65 * windSensitivity;
    const windForceZ = (windZ - worldVelScratch.z) * windSensitivity;

    const substeps =
      reqLod === 'half'
        ? effDt > 0.042
          ? 2
          : 1
        : Math.max(
            1,
            Math.min(
              MAX_SUBSTEPS,
              Math.ceil(Math.max(1e-6, effDt - 0.002) / SUBSTEP_DT_TARGET),
            ),
          );
    const subDt = effDt / substeps;
    const subDtSq = subDt * subDt;
    const subDt60 = subDt * 60.0;
    const maxHalfOmegaSq = reqLod === 'half' ? 1.35 / Math.max(1e-6, subDtSq) : 1e9;
    const rigPosX = curRigWorldPos.x;
    const rigPosZ = curRigWorldPos.z;
    const yawWhipGain = yawRate * TURN_WHIP_GAIN;

    // 1. Step all real Three.js Bone spring chains (update colliders only if real joints exist)
    if (joints.length > 0) {
      for (let ci = 0; ci < colliders.length; ci++) {
        colliders[ci].updateWorldTransform();
      }
      for (let pi = 0; pi < rootParentCache.length; pi++) {
        const pc = rootParentCache[pi];
        pc.scale = extractRotationQuatAndScaleFromMatrix4(pc.node.matrixWorld);
        pc.qx = _exQuatX;
        pc.qy = _exQuatY;
        pc.qz = _exQuatZ;
        pc.qw = _exQuatW;
        pc.elems = pc.node.matrixWorld.elements;
      }

      const lastStep = substeps - 1;
      for (let step = 0; step < substeps; step++) {
        const isLastStep = step === lastStep;
        for (let ji = 0; ji < joints.length; ji++) {
          const j = joints[ji];
          const parent = j.bone.parent;
          if (!parent) continue;

          let parentScale = 1;
          let pqx = 0;
          let pqy = 0;
          let pqz = 0;
          let pqw = 1;
          let hx = 0;
          let hy = 0;
          let hz = 0;

          if (j.parentJointIndex >= 0 && allJointsUniformSafe) {
            const pj = joints[j.parentJointIndex];
            parentScale = pj.curWorldScale;
            pqx = pj.curWorldQuatX;
            pqy = pj.curWorldQuatY;
            pqz = pj.curWorldQuatZ;
            pqw = pj.curWorldQuatW;
            const lx = j.lpx * parentScale;
            const ly = j.lpy * parentScale;
            const lz = j.lpz * parentScale;
            const ix = pqw * lx + pqy * lz - pqz * ly;
            const iy = pqw * ly + pqz * lx - pqx * lz;
            const iz = pqw * lz + pqx * ly - pqy * lx;
            const iw = -pqx * lx - pqy * ly - pqz * lz;
            hx = pj.curHeadX + (ix * pqw + iw * -pqx + iy * -pqz - iz * -pqy);
            hy = pj.curHeadY + (iy * pqw + iw * -pqy + iz * -pqx - ix * -pqz);
            hz = pj.curHeadZ + (iz * pqw + iw * -pqz + ix * -pqy - iy * -pqx);
          } else if (j.parentCacheIndex >= 0) {
            const pc = rootParentCache[j.parentCacheIndex];
            parentScale = pc.scale;
            pqx = pc.qx;
            pqy = pc.qy;
            pqz = pc.qz;
            pqw = pc.qw;
            if (step === 0) {
              const e = pc.elems;
              const bx = j.lpx;
              const by = j.lpy;
              const bz = j.lpz;
              hx = e[0] * bx + e[4] * by + e[8] * bz + e[12];
              hy = e[1] * bx + e[5] * by + e[9] * bz + e[13];
              hz = e[2] * bx + e[6] * by + e[10] * bz + e[14];
            } else {
              hx = j.curHeadX;
              hy = j.curHeadY;
              hz = j.curHeadZ;
            }
          } else {
            parentScale = extractRotationQuatAndScaleFromMatrix4(parent.matrixWorld);
            pqx = _exQuatX;
            pqy = _exQuatY;
            pqz = _exQuatZ;
            pqw = _exQuatW;
            const e = parent.matrixWorld.elements;
            const bx = j.lpx;
            const by = j.lpy;
            const bz = j.lpz;
            hx = e[0] * bx + e[4] * by + e[8] * bz + e[12];
            hy = e[1] * bx + e[5] * by + e[9] * bz + e[13];
            hz = e[2] * bx + e[6] * by + e[10] * bz + e[14];
          }

          j.curHeadX = hx;
          j.curHeadY = hy;
          j.curHeadZ = hz;

          const boneWorldLen = j.restLengthLocal * parentScale;
          const worldHitRadius = j.hitRadius * parentScale;

          // restDirWorld = normalize(restDirParent * parentQuat)
          const rpx = j.rpx;
          const rpy = j.rpy;
          const rpz = j.rpz;
          const rix = pqw * rpx + pqy * rpz - pqz * rpy;
          const riy = pqw * rpy + pqz * rpx - pqx * rpz;
          const riz = pqw * rpz + pqx * rpy - pqy * rpx;
          const riw = -pqx * rpx - pqy * rpy - pqz * rpz;
          let rdx = rix * pqw + riw * -pqx + riy * -pqz - riz * -pqy;
          let rdy = riy * pqw + riw * -pqy + riz * -pqx - rix * -pqz;
          let rdz = riz * pqw + riw * -pqz + rix * -pqy - riy * -pqx;
          const rdLen = Math.sqrt(rdx * rdx + rdy * rdy + rdz * rdz);
          if (rdLen > 1e-12) {
            const invRd = 1 / rdLen;
            rdx *= invRd;
            rdy *= invRd;
            rdz *= invRd;
          }

          let curX = j.curTailX;
          let curY = j.curTailY;
          let curZ = j.curTailZ;
          let prevX = j.prevTailX;
          let prevY = j.prevTailY;
          let prevZ = j.prevTailZ;

          if (!Number.isFinite(curX) || !Number.isFinite(curY) || !Number.isFinite(curZ)) {
            curX = hx + rdx * boneWorldLen;
            curY = hy + rdy * boneWorldLen;
            curZ = hz + rdz * boneWorldLen;
            prevX = curX;
            prevY = curY;
            prevZ = curZ;
          }

          // Time-corrected Verlet inertia with drag damping + spike clamp
          let dtRatio = subDt / (j.prevSubDt > 1e-5 ? j.prevSubDt : 1e-5);
          if (dtRatio < 0.25) dtRatio = 0.25;
          else if (dtRatio > 2.0) dtRatio = 2.0;
          const damping = Math.pow(j.dampBase, subDt60);
          const dampScale = dtRatio * damping;
          let inX = (curX - prevX) * dampScale;
          let inY = (curY - prevY) * dampScale;
          let inZ = (curZ - prevZ) * dampScale;
          const maxStepInertia = boneWorldLen * 0.45;
          const inertiaLenSq = inX * inX + inY * inY + inZ * inZ;
          if (inertiaLenSq > maxStepInertia * maxStepInertia && inertiaLenSq > 1e-10) {
            const kIn = maxStepInertia / Math.sqrt(inertiaLenSq);
            inX *= kIn;
            inY *= kIn;
            inZ *= kIn;
          }

          // Angular turn whip: omega x (tail - rigCenter)
          const offX = curX - rigPosX;
          const offZ = curZ - rigPosZ;
          const whipX = yawWhipGain * offZ;
          const whipZ = -yawWhipGain * offX;

          // Combined restoring stiffness + gravity + wind/drag forces
          let stiffOmegaSq = j.stiffnessForce * STIFFNESS_OMEGA_SQ;
          if (stiffOmegaSq > maxHalfOmegaSq) stiffOmegaSq = maxHalfOmegaSq;
          const stiffAccel = stiffOmegaSq * boneWorldLen;
          const gravAccel = j.gravityPower * GRAVITY_ACCEL_M_S2 * parentScale;
          const windGain = WIND_ACCEL_GAIN * parentScale;
          const fx =
            rdx * stiffAccel +
            j.gx * gravAccel +
            windForceX * windGain +
            whipX * parentScale;
          const fy = rdy * stiffAccel + j.gy * gravAccel + windForceY * windGain;
          const fz =
            rdz * stiffAccel +
            j.gz * gravAccel +
            windForceZ * windGain +
            whipZ * parentScale;

          let nx = curX + inX + fx * subDtSq;
          let ny = curY + inY + fy * subDtSq;
          let nz = curZ + inZ + fz * subDtSq;

          // Length projection + 2-pass monomorphic collider pushout + angular limit
          const sCols = j.sphereColliders;
          const sCount = sCols.length;
          const cCols = j.capsuleColliders;
          const cCount = cCols.length;
          for (let relax = 0; relax < 2; relax++) {
            const dx = nx - hx;
            const dy = ny - hy;
            const dz = nz - hz;
            const lenSq = dx * dx + dy * dy + dz * dz;
            if (lenSq > 1e-12) {
              const kLen = boneWorldLen / Math.sqrt(lenSq);
              nx = hx + dx * kLen;
              ny = hy + dy * kLen;
              nz = hz + dz * kLen;
            } else {
              nx = hx + rdx * boneWorldLen;
              ny = hy + rdy * boneWorldLen;
              nz = hz + rdz * boneWorldLen;
            }

            for (let ci = 0; ci < sCount; ci++) {
              if (sCols[ci].resolvePointXYZ(nx, ny, nz, worldHitRadius)) {
                nx = _colResX;
                ny = _colResY;
                nz = _colResZ;
              }
            }
            for (let ci = 0; ci < cCount; ci++) {
              if (cCols[ci].resolvePointXYZ(nx, ny, nz, worldHitRadius)) {
                nx = _colResX;
                ny = _colResY;
                nz = _colResZ;
              }
            }
          }

          // Final length + angular cone guard relative to restDirWorld
          const fdx = nx - hx;
          const fdy = ny - hy;
          const fdz = nz - hz;
          const finalLenSq = fdx * fdx + fdy * fdy + fdz * fdz;
          let ux = rdx;
          let uy = rdy;
          let uz = rdz;
          if (finalLenSq > 1e-12) {
            const invFinal = 1 / Math.sqrt(finalLenSq);
            ux = fdx * invFinal;
            uy = fdy * invFinal;
            uz = fdz * invFinal;
          }
          let cosAng = ux * rdx + uy * rdy + uz * rdz;
          if (cosAng < -1) cosAng = -1;
          else if (cosAng > 1) cosAng = 1;
          if (cosAng < j.maxCos) {
            const curAng = Math.acos(cosAng);
            const tBlend = curAng > 1e-5 ? j.maxAngleRad / curAng : 1;
            const oneMinusT = 1 - tBlend;
            const bx = rdx * oneMinusT + ux * tBlend;
            const by = rdy * oneMinusT + uy * tBlend;
            const bz = rdz * oneMinusT + uz * tBlend;
            const bLen = Math.sqrt(bx * bx + by * by + bz * bz);
            if (bLen > 1e-12) {
              const invB = 1 / bLen;
              ux = bx * invB;
              uy = by * invB;
              uz = bz * invB;
            }
          }

          j.prevTailX = curX;
          j.prevTailY = curY;
          j.prevTailZ = curZ;
          j.curTailX = hx + ux * boneWorldLen;
          j.curTailY = hy + uy * boneWorldLen;
          j.curTailZ = hz + uz * boneWorldLen;
          j.prevSubDt = subDt;

          // targetDirLocal = normalize(unitDir * inv(parentQuat))
          const tix = pqw * ux - pqy * uz + pqz * uy;
          const tiy = pqw * uy - pqz * ux + pqx * uz;
          const tiz = pqw * uz - pqx * uy + pqy * ux;
          const tiw = pqx * ux + pqy * uy + pqz * uz;
          let tdx = tix * pqw + tiw * pqx + tiy * pqz - tiz * pqy;
          let tdy = tiy * pqw + tiw * pqy + tiz * pqx - tix * pqz;
          let tdz = tiz * pqw + tiw * pqz + tix * pqy - tiy * pqx;
          const tdLen = Math.sqrt(tdx * tdx + tdy * tdy + tdz * tdz);
          if (tdLen > 1e-12) {
            const invTd = 1 / tdLen;
            tdx *= invTd;
            tdy *= invTd;
            tdz *= invTd;
          }

          // deltaQuat = safeSetFromUnitVectors(j.restDirParent, targetDirLocal)
          const uDot = rpx * tdx + rpy * tdy + rpz * tdz;
          let dqx = 0;
          let dqy = 0;
          let dqz = 0;
          let dqw = 1;
          if (uDot >= 0.999999) {
            dqw = 1;
          } else if (uDot <= -0.999999) {
            let ax = 1;
            let ay = 0;
            if (Math.abs(rpx) > 0.85) {
              ax = 0;
              ay = 1;
            }
            const cx = -rpz * ay;
            const cy = rpz * ax;
            const cz = rpx * ay - rpy * ax;
            const cLen = Math.sqrt(cx * cx + cy * cy + cz * cz);
            if (cLen > 1e-12) {
              const invC = 1 / cLen;
              dqx = cx * invC;
              dqy = cy * invC;
              dqz = cz * invC;
              dqw = 0;
            }
          } else {
            const r = uDot + 1;
            const qx = rpy * tdz - rpz * tdy;
            const qy = rpz * tdx - rpx * tdz;
            const qz = rpx * tdy - rpy * tdx;
            const qInvLen = 1 / Math.sqrt(qx * qx + qy * qy + qz * qz + r * r);
            dqx = qx * qInvLen;
            dqy = qy * qInvLen;
            dqz = qz * qInvLen;
            dqw = r * qInvLen;
          }

          // lq = normalize(deltaQuat * initialLocalQuat)
          const iqx = j.iqx;
          const iqy = j.iqy;
          const iqz = j.iqz;
          const iqw = j.iqw;
          let lqx = dqx * iqw + dqw * iqx + dqy * iqz - dqz * iqy;
          let lqy = dqy * iqw + dqw * iqy + dqz * iqx - dqx * iqz;
          let lqz = dqz * iqw + dqw * iqz + dqx * iqy - dqy * iqx;
          let lqw = dqw * iqw - dqx * iqx - dqy * iqy - dqz * iqz;
          const lqLen = Math.sqrt(lqx * lqx + lqy * lqy + lqz * lqz + lqw * lqw);
          if (lqLen > 1e-12) {
            const invLq = 1 / lqLen;
            lqx *= invLq;
            lqy *= invLq;
            lqz *= invLq;
            lqw *= invLq;
          }

          if (allJointsUniformSafe) {
            // Propagate child chain world quat/scale directly without Three.js matrix/Euler calls
            let wqx = pqx * lqw + pqw * lqx + pqy * lqz - pqz * lqy;
            let wqy = pqy * lqw + pqw * lqy + pqz * lqx - pqx * lqz;
            let wqz = pqz * lqw + pqw * lqz + pqx * lqy - pqy * lqx;
            let wqw = pqw * lqw - pqx * lqx - pqy * lqy - pqz * lqz;
            const wqLen = Math.sqrt(wqx * wqx + wqy * wqy + wqz * wqz + wqw * wqw);
            if (wqLen > 1e-12) {
              const invWq = 1 / wqLen;
              wqx *= invWq;
              wqy *= invWq;
              wqz *= invWq;
              wqw *= invWq;
            }
            j.curWorldQuatX = wqx;
            j.curWorldQuatY = wqy;
            j.curWorldQuatZ = wqz;
            j.curWorldQuatW = wqw;
            j.curWorldScale = parentScale * j.localUniformScale;
          }

          if (isLastStep || !allJointsUniformSafe) {
            j.bone.quaternion.set(lqx, lqy, lqz, lqw);
            j.bone.updateMatrix();
            j.bone.matrixWorld.multiplyMatrices(parent.matrixWorld, j.bone.matrix);
          }
        }
      }
    }

    // 2. Step lightweight CPU Verlet proxies for shader-fallback hair & garment meshes
    if (hookedMaterials.length > 0) {
      const speedHoriz = Math.sqrt(
        worldVelScratch.x * worldVelScratch.x + worldVelScratch.z * worldVelScratch.z,
      );
      const windMag = Math.sqrt(windX * windX + windZ * windZ);
      const hairPhaseSpeed = 2.6 + speedHoriz * 1.15 + windMag * 0.75 + Math.abs(yawRate) * 0.5;
      phaseTime = (phaseTime + effDt * hairPhaseSpeed) % (Math.PI * 200);

      // Compute character forward/right vectors in world space for turn-whip direction
      extractRotationQuatAndScaleFromMatrix4(rigRoot.matrixWorld);
      _scQ0.set(_exQuatX, _exQuatY, _exQuatZ, _exQuatW);
      _scV1.copy(anatomy.rigRightLocal).applyQuaternion(_scQ0).normalize();
      _scV2.copy(anatomy.rigForwardLocal).applyQuaternion(_scQ0).normalize();

      const turnWhipWorldX = -_scV1.x * yawRate * 0.24 - _scV2.x * Math.abs(yawRate) * 0.14;
      const turnWhipWorldZ = -_scV1.z * yawRate * 0.24 - _scV2.z * Math.abs(yawRate) * 0.14;

      if (hasHairHooks) {
        const hairAccelX = (windForceX * 0.68 + turnWhipWorldX) * rigScale;
        const hairAccelY = (windForceY * 0.42 - Math.abs(worldVelScratch.y) * 0.14) * rigScale;
        const hairAccelZ = (windForceZ * 0.68 + turnWhipWorldZ) * rigScale;
        for (let step = 0; step < substeps; step++) {
          stepProxyPendulum(
            hairProxyDispWorld,
            hairProxyPrevWorld,
            subDt,
            rigScale,
            hairAccelX,
            hairAccelY,
            hairAccelZ,
            95.0,
            6.8,
            0.072 * anatomy.anatScale,
          );
        }

        const headWorldScale = extractRotationQuatAndScaleFromMatrix4(headRefNode.matrixWorld);
        boneWorldQuatScratch.set(_exQuatX, _exQuatY, _exQuatZ, _exQuatW);
        const invHeadPoseQuat = _scQ0.copy(boneWorldQuatScratch).invert();
        if (hasHeadBindQuat) {
          _scQ1.copy(headBindQuat).multiply(invHeadPoseQuat);
        } else {
          _scQ1.copy(invHeadPoseQuat);
        }
        hairUniforms.uSecondaryDisp.value
          .copy(hairProxyDispWorld)
          .divideScalar(Math.max(1e-5, headWorldScale))
          .applyQuaternion(_scQ1);
        hairUniforms.uSecondaryParams.value.y = phaseTime;
      }

      if (hasGarmentHooks) {
        const garmentAccelX = (windForceX * 0.52 + turnWhipWorldX * 1.15) * rigScale;
        const garmentAccelY = windForceY * 0.34 * rigScale;
        const garmentAccelZ = (windForceZ * 0.52 + turnWhipWorldZ * 1.15) * rigScale;
        for (let step = 0; step < substeps; step++) {
          stepProxyPendulum(
            garmentProxyDispWorld,
            garmentProxyPrevWorld,
            subDt,
            rigScale,
            garmentAccelX,
            garmentAccelY,
            garmentAccelZ,
            120.0,
            7.8,
            0.055 * anatomy.anatScale,
          );
        }

        const hipWorldScale = extractRotationQuatAndScaleFromMatrix4(hipRefNode.matrixWorld);
        boneWorldQuatScratch.set(_exQuatX, _exQuatY, _exQuatZ, _exQuatW);
        const invHipPoseQuat = _scQ0.copy(boneWorldQuatScratch).invert();
        if (hasHipBindQuat) {
          _scQ1.copy(hipBindQuat).multiply(invHipPoseQuat);
        } else {
          _scQ1.copy(invHipPoseQuat);
        }
        garmentUniforms.uSecondaryDisp.value
          .copy(garmentProxyDispWorld)
          .divideScalar(Math.max(1e-5, hipWorldScale))
          .applyQuaternion(_scQ1);
        garmentUniforms.uSecondaryParams.value.y = phaseTime;
      }
    }
  };

  const refresh = () => {
    if (disposed) return;
    setup();
  };

  const dispose = () => {
    if (disposed) return;
    reset();
    restoreHookedMaterials();
    for (let i = 0; i < hookedHairMeshes.length; i++) {
      restorePristineHairOnDispose(hookedHairMeshes[i], ownerId);
    }
    hookedHairMeshes = [];
    colliders = [];
    parsedChains = [];
    joints = [];
    rootParentCache = [];
    activeSpringBones.clear();
    metrics.boneChains = 0;
    metrics.colliders = 0;
    metrics.secondaryShaderHooks = 0;
    disposed = true;
  };

  setup();

  return {
    update,
    reset,
    dispose,
    refresh,
    get lodMode() {
      return activeLodMode;
    },
    metrics,
  };
}
