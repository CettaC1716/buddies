import * as THREE from 'three';

/** Standardized sole-to-skull-crown height in `bodyGroup` space (~3.38m including hair, ~3.31m in Plaza). */
export const STANDARD_AVATAR_SKULL_CROWN_HEIGHT_M = 3.34;

/** Fallback total-bounds target height when skull/footwear landmarks are absent (synthetic rigs). */
export const STANDARD_AVATAR_FALLBACK_FULL_HEIGHT_M = 3.38;

/** Shader & outline calibration constants shared across base and modular character pipelines. */
export const ANATOMICAL_SKIN_SHADER_PARAMS = {
  cleanForeheadU: 0.785,
  cleanForeheadV: 0.28,
  rawSkinTapBlend: 0.015,
  foreheadSkinFloor: 0.985,
  skinOutlineNormalOffsetM: 0.00025,
  headOutlineNormalOffsetM: 0.00030,
  clothOutlineNormalOffsetM: 0.00125,
  hairCutoutOutlineNormalOffsetM: 0.00135,
  skinOutlinePolygonOffsetFactor: 2.0,
  skinOutlinePolygonOffsetUnits: 2.0,
  clothOutlinePolygonOffsetFactor: 1.0,
  clothOutlinePolygonOffsetUnits: 1.0,
} as const;

export const HAND_OUTLINE_SUPPRESSION_PARAMS = {
  fingerStartAbsX: 0.645,
  palmTaperStartAbsX: 0.628,
  maxOuterWristOutlineOffsetM: 0.00065,
  boundaryInwardTuckM: -0.0004,
  minWallClearanceM: 0.01,
} as const;

export const EAR_OUTLINE_PARAMS = {
  boundaryInwardTuckM: -0.0003,
  maxOuterRimOffsetM: 0.00065,
  minEarFoldClearanceM: 0.0065,
} as const;

export const HEAD_OUTLINE_PARAMS = {
  zeroFeatureThresholdM: 0.00035,
  featureInwardTuckM: -0.00035,
  maxHeadOutlineOffsetM: 0.00105,
} as const;

export const BODY_SKIN_CULLING_PARAMS = {
  hemKeepMarginM: 0.01,
  tuckBandMarginM: 0.018,
  maxClothRayDistanceM: 0.095,
  minSkinInsetM: 0.002,
  maxSkinInsetM: 0.0045,
} as const;

export type AvatarMeshRole =
  | 'head'
  | 'head_outline'
  | 'ears'
  | 'ears_outline'
  | 'hands_skin'
  | 'hands_outline'
  | 'torso_skin'
  | 'torso_skin_outline'
  | 'legs_skin'
  | 'legs_skin_outline'
  | 'feet_skin'
  | 'feet_skin_outline'
  | 'hair'
  | 'hair_outline'
  | 'clothing'
  | 'clothing_outline'
  | 'other';

export type AvatarOutlineCategory =
  | 'skin_hand'
  | 'skin_ear'
  | 'skin_head'
  | 'skin_body'
  | 'hair_cutout'
  | 'clothing';

export interface OpenBoundaryTopology {
  posAttr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
  nrmAttr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined;
  vKeys: string[];
  indicesByKey: Map<string, number[]>;
  openBoundaryKeys: Set<string>;
  oneRingKeys: Set<string>;
}

export interface AvatarRigStandardMetrics {
  unifiedModelScale: number;
  skullHeightRaw: number;
  fullHeightRaw: number;
  nonOutlineMinY: number;
  headTopY: number;
  usedSkullNormalization: boolean;
}

export interface AvatarAnatomySanitizationReport {
  normalizedWeightVerts: number;
  repairedBaseNormals: number;
  wristWeldedVerts: number;
  culledHandOutlineTris: number;
  culledEarOutlineTris: number;
  culledHeadOutlineTris: number;
  culledCoveredSkinTris: number;
  insetSkinVerts: number;
}

interface TriangleSoupItem {
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
  nAvg: THREE.Vector3;
  box: THREE.Box3;
}

const FINGER_BONE_RE = /(?:thumb|index|middle|ring|pinky|others)/i;
const VARIANT_SUFFIX_RE = /_\d+$/;

const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vC = new THREE.Vector3();
const _vAB = new THREE.Vector3();
const _vAC = new THREE.Vector3();
const _vCross = new THREE.Vector3();
const _vNrm = new THREE.Vector3();
const _vRayHit = new THREE.Vector3();
const _ray = new THREE.Ray();

/** Strips GLTFLoader multi-primitive numeric suffixes (e.g. `hands_skin_1` -> `hands_skin`). */
export function stripMeshVariantSuffix(meshName: string): string {
  return (meshName || '').trim().replace(VARIANT_SUFFIX_RE, '');
}

/** Classifies a mesh name from base or modular GLBs into its canonical avatar anatomy role. */
export function classifyAvatarMeshRole(meshName: string): AvatarMeshRole {
  const rawLower = (meshName || '').trim().toLowerCase();
  if (!rawLower) return 'other';
  const isOutline = rawLower.endsWith('_outline') || rawLower.includes('_outline');
  const rawBaseLower = rawLower.replace(/_outline$/i, '');
  // New Blender Blitz_* modular dolls: exact base primitive (no _N suffix) is the head mesh;
  // _1.._10 are body skin parts; Blitz_Hair_* / Blitz_*_Hair are hair; shoes/legs/top/acc are clothing.
  if (rawBaseLower === 'blitz_basedoll_female_mesh' || rawBaseLower === 'blitz_basedoll_male_mesh') {
    return isOutline ? 'head_outline' : 'head';
  }
  if (rawBaseLower.startsWith('blitz_basedoll_')) {
    return isOutline ? 'torso_skin_outline' : 'torso_skin';
  }
  if (rawBaseLower.startsWith('blitz_')) {
    if (rawBaseLower.includes('hair')) {
      return isOutline ? 'hair_outline' : 'hair';
    }
    return isOutline ? 'clothing_outline' : 'clothing';
  }
  const lower = stripMeshVariantSuffix(rawLower);
  if (!lower) return 'other';
  if (lower.startsWith('head_')) {
    return isOutline ? 'head_outline' : 'head';
  }
  if (lower.startsWith('ears_')) {
    return isOutline ? 'ears_outline' : 'ears';
  }
  if (lower.startsWith('hands_skin') || lower === 'hands') {
    return isOutline ? 'hands_outline' : 'hands_skin';
  }
  if (lower.startsWith('torso_') && lower.includes('_skin')) {
    return isOutline ? 'torso_skin_outline' : 'torso_skin';
  }
  if (lower.startsWith('legs_') && lower.includes('_skin')) {
    return isOutline ? 'legs_skin_outline' : 'legs_skin';
  }
  if (lower.startsWith('feet_') && lower.includes('_skin')) {
    return isOutline ? 'feet_skin_outline' : 'feet_skin';
  }
  if (lower.startsWith('hair')) {
    return isOutline ? 'hair_outline' : 'hair';
  }
  if (
    lower.startsWith('torso_') ||
    lower.startsWith('legs_') ||
    lower.startsWith('feet_') ||
    lower.startsWith('hands_') ||
    lower.startsWith('neck_')
  ) {
    return isOutline ? 'clothing_outline' : 'clothing';
  }
  return isOutline ? 'clothing_outline' : 'other';
}

/** Returns true for non-outline, non-head body skin meshes (including `_skin_1` GLTF variants). */
export function isBodySkinMeshName(meshName: string): boolean {
  const role = classifyAvatarMeshRole(meshName);
  return (
    role === 'ears' ||
    role === 'hands_skin' ||
    role === 'torso_skin' ||
    role === 'legs_skin' ||
    role === 'feet_skin'
  );
}

/** Returns true for bare hand/palm/finger skin meshes (excluding outlines). */
export function isHandSkinMeshName(meshName: string): boolean {
  return classifyAvatarMeshRole(meshName) === 'hands_skin';
}

/** Classifies an outline mesh/material into the proper shader & depth-bias profile. */
export function classifyAvatarOutlineCategory(
  meshName: string,
  materialName = '',
): AvatarOutlineCategory {
  const role = classifyAvatarMeshRole(meshName);
  if (role === 'hands_outline') return 'skin_hand';
  if (role === 'ears_outline') return 'skin_ear';
  if (role === 'head_outline') return 'skin_head';
  if (
    role === 'torso_skin_outline' ||
    role === 'legs_skin_outline' ||
    role === 'feet_skin_outline'
  ) {
    return 'skin_body';
  }
  if (role === 'hair_outline' || materialName.toLowerCase().includes('cutout')) {
    return 'hair_cutout';
  }
  return 'clothing';
}

/** Resolves the base mesh corresponding to an `*_Outline` mesh, handling `_1` GLTF variants. */
export function findBaseMeshForOutline(
  outlineMeshName: string,
  meshesByLowerKey: ReadonlyMap<string, THREE.Mesh[]>,
): THREE.Mesh | null {
  const lower = (outlineMeshName || '').toLowerCase();
  const stripped = stripMeshVariantSuffix(lower);
  if (!stripped.endsWith('_outline')) return null;
  const stem = stripped.slice(0, -'_outline'.length);
  const exact = meshesByLowerKey.get(stem)?.[0];
  if (exact) return exact;
  const v1 = meshesByLowerKey.get(`${stem}_1`)?.[0];
  if (v1) return v1;
  const v0 = meshesByLowerKey.get(`${stem}_0`)?.[0];
  return v0 ?? null;
}

/** Computes welded spatial vertex keys and detects 1-edge open boundaries and their 1-ring neighbors. */
export function analyzeMeshOpenBoundaryTopology(
  geo: THREE.BufferGeometry,
): OpenBoundaryTopology | null {
  const posAttr = geo.getAttribute('position');
  if (!posAttr || posAttr.count === 0) return null;
  const nrmAttr = geo.getAttribute('normal');
  const vKeys: string[] = new Array(posAttr.count);
  const indicesByKey = new Map<string, number[]>();
  for (let i = 0; i < posAttr.count; i++) {
    const k = `${Math.round(posAttr.getX(i) * 2000)},${Math.round(posAttr.getY(i) * 2000)},${Math.round(posAttr.getZ(i) * 2000)}`;
    vKeys[i] = k;
    let bucket = indicesByKey.get(k);
    if (!bucket) {
      bucket = [];
      indicesByKey.set(k, bucket);
    }
    bucket.push(i);
  }

  const edgeCounts = new Map<string, number>();
  const neighborsByKey = new Map<string, Set<string>>();
  const addNeighbor = (a: string, b: string) => {
    let s = neighborsByKey.get(a);
    if (!s) {
      s = new Set<string>();
      neighborsByKey.set(a, s);
    }
    s.add(b);
  };
  const recordTri = (i0: number, i1: number, i2: number) => {
    const triKeys = [vKeys[i0], vKeys[i1], vKeys[i2]];
    for (let e = 0; e < 3; e++) {
      const ka = triKeys[e];
      const kb = triKeys[(e + 1) % 3];
      if (!ka || !kb || ka === kb) continue;
      const edgeKey = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      edgeCounts.set(edgeKey, (edgeCounts.get(edgeKey) ?? 0) + 1);
      addNeighbor(ka, kb);
      addNeighbor(kb, ka);
    }
  };

  const idxAttr = geo.getIndex();
  if (idxAttr) {
    for (let t = 0; t + 2 < idxAttr.count; t += 3) {
      recordTri(idxAttr.getX(t), idxAttr.getX(t + 1), idxAttr.getX(t + 2));
    }
  } else {
    for (let t = 0; t + 2 < posAttr.count; t += 3) {
      recordTri(t, t + 1, t + 2);
    }
  }

  const openBoundaryKeys = new Set<string>();
  for (const [edgeKey, count] of edgeCounts.entries()) {
    if (count === 1) {
      const sep = edgeKey.indexOf('|');
      if (sep > 0) {
        openBoundaryKeys.add(edgeKey.slice(0, sep));
        openBoundaryKeys.add(edgeKey.slice(sep + 1));
      }
    }
  }

  const oneRingKeys = new Set<string>();
  for (const openKey of openBoundaryKeys) {
    const nbrs = neighborsByKey.get(openKey);
    if (!nbrs) continue;
    for (const nk of nbrs) {
      if (!openBoundaryKeys.has(nk)) {
        oneRingKeys.add(nk);
      }
    }
  }

  return { posAttr, nrmAttr, vKeys, indicesByKey, openBoundaryKeys, oneRingKeys };
}

/**
 * Matches every vertex of an `*_Outline` geometry to its corresponding vertex on the base geometry
 * by proximity + inverted normal alignment (required because Draco reorders attributes per primitive).
 */
export function matchOutlineToBaseVertices(
  baseGeo: THREE.BufferGeometry,
  outlineGeo: THREE.BufferGeometry,
  maxSearchRadiusM = 0.015,
): Int32Array {
  const bPos = baseGeo.getAttribute('position');
  const bNrm = baseGeo.getAttribute('normal');
  const oPos = outlineGeo.getAttribute('position');
  const oNrm = outlineGeo.getAttribute('normal');
  const matches = new Int32Array(oPos ? oPos.count : 0);
  matches.fill(-1);
  if (!bPos || !oPos || bPos.count === 0 || oPos.count === 0) return matches;

  const cellSize = Math.max(0.005, maxSearchRadiusM);
  const grid = new Map<string, number[]>();
  const keyOf = (x: number, y: number, z: number) =>
    `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)},${Math.floor(z / cellSize)}`;

  for (let j = 0; j < bPos.count; j++) {
    const k = keyOf(bPos.getX(j), bPos.getY(j), bPos.getZ(j));
    let bucket = grid.get(k);
    if (!bucket) {
      bucket = [];
      grid.set(k, bucket);
    }
    bucket.push(j);
  }

  const pO = new THREE.Vector3();
  const pB = new THREE.Vector3();
  const nO = new THREE.Vector3();
  const nB = new THREE.Vector3();
  const maxR2 = maxSearchRadiusM * maxSearchRadiusM;

  for (let i = 0; i < oPos.count; i++) {
    pO.fromBufferAttribute(oPos, i);
    if (oNrm) nO.fromBufferAttribute(oNrm, i);
    const cx = Math.floor(pO.x / cellSize);
    const cy = Math.floor(pO.y / cellSize);
    const cz = Math.floor(pO.z / cellSize);

    let bestJ = -1;
    let bestScore = Infinity;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (!bucket) continue;
          for (let bi = 0; bi < bucket.length; bi++) {
            const j = bucket[bi];
            pB.fromBufferAttribute(bPos, j);
            const d2 = pO.distanceToSquared(pB);
            if (d2 > maxR2) continue;
            let score = Math.sqrt(d2);
            if (bNrm && oNrm) {
              nB.fromBufferAttribute(bNrm, j);
              score += (1 + nB.dot(nO)) * 0.008;
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

/** Counts triangles whose geometric winding matches or opposes their vertex normals. */
export function countOutlineWindingMismatches(geo: THREE.BufferGeometry): {
  outward: number;
  inward: number;
  degenerate: number;
  total: number;
} {
  const pos = geo.getAttribute('position');
  const nrm = geo.getAttribute('normal');
  if (!pos || !nrm) return { outward: 0, inward: 0, degenerate: 0, total: 0 };
  const idx = geo.getIndex();
  const count = idx ? idx.count : pos.count;
  let outward = 0;
  let inward = 0;
  let degenerate = 0;

  for (let t = 0; t + 2 < count; t += 3) {
    const ia = idx ? idx.getX(t) : t;
    const ib = idx ? idx.getX(t + 1) : t + 1;
    const ic = idx ? idx.getX(t + 2) : t + 2;
    _vA.fromBufferAttribute(pos, ia);
    _vB.fromBufferAttribute(pos, ib);
    _vC.fromBufferAttribute(pos, ic);
    _vAB.subVectors(_vB, _vA);
    _vAC.subVectors(_vC, _vA);
    _vCross.crossVectors(_vAB, _vAC);
    if (_vCross.lengthSq() <= 1e-14) {
      degenerate++;
      continue;
    }
    _vNrm.fromBufferAttribute(nrm, ia);
    const dot = _vCross.dot(_vNrm);
    if (dot > 0) outward++;
    else inward++;
  }
  return { outward, inward, degenerate, total: Math.floor(count / 3) };
}

/**
 * Rebuilds smooth outward vertex normals on vertices whose normals oppose their geometric triangle
 * winding (e.g. fingertip nail creases on `hands_skin_1` and chin crease on `head_102_triangle_1`).
 */
export function repairInconsistentBaseNormals(geo: THREE.BufferGeometry): number {
  const pos = geo.getAttribute('position');
  const nrm = geo.getAttribute('normal');
  if (!pos || !nrm || pos.count === 0) return 0;

  const idx = geo.getIndex();
  const count = idx ? idx.count : pos.count;
  const accum = new Float32Array(pos.count * 3);

  for (let t = 0; t + 2 < count; t += 3) {
    const ia = idx ? idx.getX(t) : t;
    const ib = idx ? idx.getX(t + 1) : t + 1;
    const ic = idx ? idx.getX(t + 2) : t + 2;
    _vA.fromBufferAttribute(pos, ia);
    _vB.fromBufferAttribute(pos, ib);
    _vC.fromBufferAttribute(pos, ic);
    _vAB.subVectors(_vB, _vA);
    _vAC.subVectors(_vC, _vA);
    _vCross.crossVectors(_vAB, _vAC);
    if (_vCross.lengthSq() <= 1e-14) continue;
    for (const vi of [ia, ib, ic]) {
      accum[vi * 3] += _vCross.x;
      accum[vi * 3 + 1] += _vCross.y;
      accum[vi * 3 + 2] += _vCross.z;
    }
  }

  let fixed = 0;
  for (let i = 0; i < pos.count; i++) {
    const ax = accum[i * 3];
    const ay = accum[i * 3 + 1];
    const az = accum[i * 3 + 2];
    const aLen = Math.hypot(ax, ay, az);
    if (aLen <= 1e-7) continue;
    const fx = ax / aLen;
    const fy = ay / aLen;
    const fz = az / aLen;
    const nx = nrm.getX(i);
    const ny = nrm.getY(i);
    const nz = nrm.getZ(i);
    if (nx * fx + ny * fy + nz * fz < -0.15) {
      nrm.setXYZ(i, fx, fy, fz);
      fixed++;
    }
  }
  if (fixed > 0) {
    nrm.needsUpdate = true;
  }
  return fixed;
}

function buildTriangleSoup(meshes: readonly THREE.Mesh[]): TriangleSoupItem[] {
  const tris: TriangleSoupItem[] = [];
  for (const m of meshes) {
    const pos = m.geometry.getAttribute('position');
    const nrm = m.geometry.getAttribute('normal');
    if (!pos) continue;
    const idx = m.geometry.getIndex();
    const count = idx ? idx.count : pos.count;
    for (let t = 0; t + 2 < count; t += 3) {
      const ia = idx ? idx.getX(t) : t;
      const ib = idx ? idx.getX(t + 1) : t + 1;
      const ic = idx ? idx.getX(t + 2) : t + 2;
      const a = new THREE.Vector3().fromBufferAttribute(pos, ia);
      const b = new THREE.Vector3().fromBufferAttribute(pos, ib);
      const c = new THREE.Vector3().fromBufferAttribute(pos, ic);
      const nAvg = new THREE.Vector3(0, 1, 0);
      if (nrm) {
        _vA.fromBufferAttribute(nrm, ia);
        _vB.fromBufferAttribute(nrm, ib);
        _vC.fromBufferAttribute(nrm, ic);
        nAvg.copy(_vA).add(_vB).add(_vC);
        if (nAvg.lengthSq() > 1e-8) nAvg.normalize();
      }
      const box = new THREE.Box3().setFromPoints([a, b, c]);
      tris.push({ a, b, c, nAvg, box });
    }
  }
  return tris;
}

function castRayMinDist(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  tris: readonly TriangleSoupItem[],
  maxDist: number,
  minSelfSkip = 0.0004,
): number {
  _ray.set(origin, dir);
  const minX = Math.min(origin.x, origin.x + dir.x * maxDist) - 0.002;
  const maxX = Math.max(origin.x, origin.x + dir.x * maxDist) + 0.002;
  const minY = Math.min(origin.y, origin.y + dir.y * maxDist) - 0.002;
  const maxY = Math.max(origin.y, origin.y + dir.y * maxDist) + 0.002;
  const minZ = Math.min(origin.z, origin.z + dir.z * maxDist) - 0.002;
  const maxZ = Math.max(origin.z, origin.z + dir.z * maxDist) + 0.002;

  let best = Infinity;
  for (let i = 0; i < tris.length; i++) {
    const tri = tris[i];
    if (
      tri.box.max.x < minX ||
      tri.box.min.x > maxX ||
      tri.box.max.y < minY ||
      tri.box.min.y > maxY ||
      tri.box.max.z < minZ ||
      tri.box.min.z > maxZ
    ) {
      continue;
    }
    if (_ray.intersectTriangle(tri.a, tri.b, tri.c, false, _vRayHit)) {
      const d = origin.distanceTo(_vRayHit);
      if (d > minSelfSkip && d < maxDist && d < best) {
        best = d;
      }
    }
  }
  return best;
}

function filterAndRewriteGeometryIndex(
  geo: THREE.BufferGeometry,
  keepPredicate: (ia: number, ib: number, ic: number, faceCross: THREE.Vector3) => boolean,
): { kept: number; culled: number } {
  const pos = geo.getAttribute('position');
  if (!pos) return { kept: 0, culled: 0 };
  const origIdx = geo.getIndex();
  const count = origIdx ? origIdx.count : pos.count;
  const keptIndices: number[] = [];
  let kept = 0;
  let culled = 0;

  for (let t = 0; t + 2 < count; t += 3) {
    const ia = origIdx ? origIdx.getX(t) : t;
    const ib = origIdx ? origIdx.getX(t + 1) : t + 1;
    const ic = origIdx ? origIdx.getX(t + 2) : t + 2;
    _vA.fromBufferAttribute(pos, ia);
    _vB.fromBufferAttribute(pos, ib);
    _vC.fromBufferAttribute(pos, ic);
    _vAB.subVectors(_vB, _vA);
    _vAC.subVectors(_vC, _vA);
    _vCross.crossVectors(_vAB, _vAC);
    if (keepPredicate(ia, ib, ic, _vCross)) {
      keptIndices.push(ia, ib, ic);
      kept++;
    } else {
      culled++;
    }
  }

  if (culled > 0) {
    const IndexCtor = pos.count > 65535 ? Uint32Array : Uint16Array;
    geo.setIndex(new THREE.BufferAttribute(new IndexCtor(keptIndices), 1));
  }
  return { kept, culled };
}

function buildFingerWeightedVertexMask(mesh: THREE.Mesh): Uint8Array {
  const pos = mesh.geometry.getAttribute('position');
  const mask = new Uint8Array(pos ? pos.count : 0);
  const skinned = mesh as THREE.SkinnedMesh;
  const bones = skinned.skeleton?.bones;
  const jntAttr = mesh.geometry.getAttribute('skinIndex');
  const wgtAttr = mesh.geometry.getAttribute('skinWeight');
  if (!pos || !bones || !jntAttr || !wgtAttr) return mask;

  const isFingerBone = bones.map((b) => FINGER_BONE_RE.test(b?.name || ''));
  for (let i = 0; i < pos.count; i++) {
    const fingerWeight =
      (isFingerBone[jntAttr.getX(i)] ? wgtAttr.getX(i) : 0) +
      (isFingerBone[jntAttr.getY(i)] ? wgtAttr.getY(i) : 0) +
      (isFingerBone[jntAttr.getZ(i)] ? wgtAttr.getZ(i) : 0) +
      (isFingerBone[jntAttr.getW(i)] ? wgtAttr.getW(i) : 0);
    if (fingerWeight > 0.02) {
      mask[i] = 1;
    }
  }
  return mask;
}

/**
 * Eliminates dark finger/palm/inter-digit outline blotches (`corak hitam pada bagian jari avatar`):
 * 1. Repairs inverted fingertip crease normals on `hands_skin`.
 * 2. Suppresses/culls all `hands_skin_Outline` triangles covering digits, knuckles, finger webs,
 *    thin regions, and flipped-winding faces (`FrontSide` outward-facing black triangles).
 * 3. Smoothly clamps & tucks the remaining outer wrist/palm-heel silhouette outline cleanly.
 */
export function sanitizeHandSkinAndOutlineMeshes(
  handsMesh: THREE.Mesh,
  handsOutlineMesh: THREE.Mesh | null,
): { repairedBaseNormals: number; culledOutlineTris: number } {
  const repairedBaseNormals = repairInconsistentBaseNormals(handsMesh.geometry);
  if (!handsOutlineMesh) {
    return { repairedBaseNormals, culledOutlineTris: 0 };
  }

  const bGeo = handsMesh.geometry;
  const oGeo = handsOutlineMesh.geometry;
  const bPos = bGeo.getAttribute('position');
  const bNrm = bGeo.getAttribute('normal');
  const oPos = oGeo.getAttribute('position');
  const oNrm = oGeo.getAttribute('normal');
  if (!bPos || !bNrm || !oPos || !oNrm) {
    return { repairedBaseNormals, culledOutlineTris: 0 };
  }

  const matchedBase = matchOutlineToBaseVertices(bGeo, oGeo, 0.02);
  const oFingerMask = buildFingerWeightedVertexMask(handsOutlineMesh);
  const bFingerMask = buildFingerWeightedVertexMask(handsMesh);
  const oTopo = analyzeMeshOpenBoundaryTopology(oGeo);
  const handSoup = buildTriangleSoup([handsMesh]);

  const suppressVert = new Uint8Array(oPos.count);
  const pB = new THREE.Vector3();
  const nB = new THREE.Vector3();
  const pO = new THREE.Vector3();
  const negN = new THREE.Vector3();

  for (let i = 0; i < oPos.count; i++) {
    const bj = matchedBase[i];
    if (bj < 0) {
      suppressVert[i] = 1;
      continue;
    }
    pB.fromBufferAttribute(bPos, bj);
    nB.fromBufferAttribute(bNrm, bj);
    if (nB.lengthSq() > 1e-8) nB.normalize();
    pO.fromBufferAttribute(oPos, i);

    const absX = Math.abs(pB.x);
    const hasFingerWeight = oFingerMask[i] === 1 || bFingerMask[bj] === 1;
    const isOpenWrist = Boolean(oTopo && oTopo.openBoundaryKeys.has(oTopo.vKeys[i]));

    negN.copy(nB).negate();
    const wallThickness = castRayMinDist(
      pB,
      negN,
      handSoup,
      HAND_OUTLINE_SUPPRESSION_PARAMS.minWallClearanceM,
      0.0003,
    );

    if (
      hasFingerWeight ||
      absX >= HAND_OUTLINE_SUPPRESSION_PARAMS.fingerStartAbsX ||
      wallThickness < HAND_OUTLINE_SUPPRESSION_PARAMS.minWallClearanceM
    ) {
      suppressVert[i] = 1;
      // Tuck vertex cleanly inside skin so even if adjacent wrist edge shares it, nothing pokes out
      oPos.setXYZ(
        i,
        pB.x + nB.x * HAND_OUTLINE_SUPPRESSION_PARAMS.boundaryInwardTuckM,
        pB.y + nB.y * HAND_OUTLINE_SUPPRESSION_PARAMS.boundaryInwardTuckM,
        pB.z + nB.z * HAND_OUTLINE_SUPPRESSION_PARAMS.boundaryInwardTuckM,
      );
      oNrm.setXYZ(i, -nB.x, -nB.y, -nB.z);
      continue;
    }

    let targetOffset: number = HAND_OUTLINE_SUPPRESSION_PARAMS.maxOuterWristOutlineOffsetM;
    if (isOpenWrist) {
      targetOffset = HAND_OUTLINE_SUPPRESSION_PARAMS.boundaryInwardTuckM;
    } else if (absX > HAND_OUTLINE_SUPPRESSION_PARAMS.palmTaperStartAbsX) {
      const t = Math.min(
        1,
        (absX - HAND_OUTLINE_SUPPRESSION_PARAMS.palmTaperStartAbsX) /
          Math.max(
            1e-4,
            HAND_OUTLINE_SUPPRESSION_PARAMS.fingerStartAbsX -
              HAND_OUTLINE_SUPPRESSION_PARAMS.palmTaperStartAbsX,
          ),
      );
      targetOffset =
        HAND_OUTLINE_SUPPRESSION_PARAMS.maxOuterWristOutlineOffsetM * (1 - t) +
        HAND_OUTLINE_SUPPRESSION_PARAMS.boundaryInwardTuckM * t;
    }

    oPos.setXYZ(
      i,
      pB.x + nB.x * targetOffset,
      pB.y + nB.y * targetOffset,
      pB.z + nB.z * targetOffset,
    );
    oNrm.setXYZ(i, -nB.x, -nB.y, -nB.z);
  }

  oPos.needsUpdate = true;
  oNrm.needsUpdate = true;

  const { culled } = filterAndRewriteGeometryIndex(oGeo, (ia, ib, ic, faceCross) => {
    if (suppressVert[ia] || suppressVert[ib] || suppressVert[ic]) return false;
    if (faceCross.lengthSq() <= 1e-14) return false;
    _vNrm.fromBufferAttribute(oNrm, ia);
    // Inverted hull with FrontSide must strictly have faceCross aligned with inward normal
    return faceCross.dot(_vNrm) > 0;
  });

  return { repairedBaseNormals, culledOutlineTris: culled };
}

/**
 * Eliminates dark ear-crease & attachment-ring artifacts on `ears_*_Outline`:
 * suppresses concave inner-ear fold outline triangles and double-tucked open rims,
 * leaving a clean thin contour around the convex outer helix/lobe silhouette.
 */
export function sanitizeEarSkinAndOutlineMeshes(
  earsMesh: THREE.Mesh,
  earsOutlineMesh: THREE.Mesh | null,
): { repairedBaseNormals: number; culledOutlineTris: number } {
  const repairedBaseNormals = repairInconsistentBaseNormals(earsMesh.geometry);
  if (!earsOutlineMesh) {
    return { repairedBaseNormals, culledOutlineTris: 0 };
  }

  const bGeo = earsMesh.geometry;
  const oGeo = earsOutlineMesh.geometry;
  const bPos = bGeo.getAttribute('position');
  const bNrm = bGeo.getAttribute('normal');
  const oPos = oGeo.getAttribute('position');
  const oNrm = oGeo.getAttribute('normal');
  if (!bPos || !bNrm || !oPos || !oNrm) {
    return { repairedBaseNormals, culledOutlineTris: 0 };
  }

  const matchedBase = matchOutlineToBaseVertices(bGeo, oGeo, 0.02);
  const bTopo = analyzeMeshOpenBoundaryTopology(bGeo);
  const oTopo = analyzeMeshOpenBoundaryTopology(oGeo);
  const earSoup = buildTriangleSoup([earsMesh]);

  const suppressVert = new Uint8Array(oPos.count);
  const pB = new THREE.Vector3();
  const nB = new THREE.Vector3();
  const negN = new THREE.Vector3();

  for (let i = 0; i < oPos.count; i++) {
    const bj = matchedBase[i];
    if (bj < 0) {
      suppressVert[i] = 1;
      continue;
    }
    pB.fromBufferAttribute(bPos, bj);
    nB.fromBufferAttribute(bNrm, bj);
    if (nB.lengthSq() > 1e-8) nB.normalize();

    const isOpenEdge =
      Boolean(oTopo && oTopo.openBoundaryKeys.has(oTopo.vKeys[i])) ||
      Boolean(bTopo && bTopo.openBoundaryKeys.has(bTopo.vKeys[bj]));
    const isOneRing =
      !isOpenEdge &&
      (Boolean(oTopo && oTopo.oneRingKeys.has(oTopo.vKeys[i])) ||
        Boolean(bTopo && bTopo.oneRingKeys.has(bTopo.vKeys[bj])));

    negN.copy(nB).negate();
    const thickness = castRayMinDist(
      pB,
      negN,
      earSoup,
      EAR_OUTLINE_PARAMS.minEarFoldClearanceM,
      0.0003,
    );
    // Front/inner concha ear folds face forward (+Z) or inward toward skull while sitting thin
    const isInnerEarCrease =
      thickness < EAR_OUTLINE_PARAMS.minEarFoldClearanceM || (nB.z > 0.35 && Math.abs(pB.x) < 0.094);

    if (isInnerEarCrease) {
      suppressVert[i] = 1;
    }

    const offset = isOpenEdge
      ? EAR_OUTLINE_PARAMS.boundaryInwardTuckM
      : isInnerEarCrease
        ? EAR_OUTLINE_PARAMS.boundaryInwardTuckM
        : isOneRing
          ? EAR_OUTLINE_PARAMS.maxOuterRimOffsetM * 0.45
          : EAR_OUTLINE_PARAMS.maxOuterRimOffsetM;

    oPos.setXYZ(i, pB.x + nB.x * offset, pB.y + nB.y * offset, pB.z + nB.z * offset);
    oNrm.setXYZ(i, -nB.x, -nB.y, -nB.z);
  }

  oPos.needsUpdate = true;
  oNrm.needsUpdate = true;

  const { culled } = filterAndRewriteGeometryIndex(oGeo, (ia, ib, ic, faceCross) => {
    if (suppressVert[ia] && suppressVert[ib] && suppressVert[ic]) return false;
    if (faceCross.lengthSq() <= 1e-14) return false;
    _vNrm.fromBufferAttribute(oNrm, ia);
    return faceCross.dot(_vNrm) > 0;
  });

  return { repairedBaseNormals, culledOutlineTris: culled };
}

/**
 * Repairs inverted facial crease normals on `head_*`, preserves zero-offset lip/eyelid/nostril/neck
 * seams tucked cleanly behind skin, and clamps outer head contour to prevent double-edge halos.
 */
export function sanitizeHeadSkinAndOutlineMeshes(
  headMesh: THREE.Mesh,
  headOutlineMesh: THREE.Mesh | null,
): { repairedBaseNormals: number; culledOutlineTris: number } {
  const repairedBaseNormals = repairInconsistentBaseNormals(headMesh.geometry);
  if (!headOutlineMesh) {
    return { repairedBaseNormals, culledOutlineTris: 0 };
  }

  const bGeo = headMesh.geometry;
  const oGeo = headOutlineMesh.geometry;
  const bPos = bGeo.getAttribute('position');
  const bNrm = bGeo.getAttribute('normal');
  const oPos = oGeo.getAttribute('position');
  const oNrm = oGeo.getAttribute('normal');
  if (!bPos || !bNrm || !oPos || !oNrm) {
    return { repairedBaseNormals, culledOutlineTris: 0 };
  }

  const matchedBase = matchOutlineToBaseVertices(bGeo, oGeo, 0.02);
  const pB = new THREE.Vector3();
  const nB = new THREE.Vector3();
  const pO = new THREE.Vector3();
  const diff = new THREE.Vector3();

  for (let i = 0; i < oPos.count; i++) {
    const bj = matchedBase[i];
    if (bj < 0) continue;
    pB.fromBufferAttribute(bPos, bj);
    nB.fromBufferAttribute(bNrm, bj);
    if (nB.lengthSq() > 1e-8) nB.normalize();
    pO.fromBufferAttribute(oPos, i);

    const rawGap = diff.subVectors(pO, pB).dot(nB);
    const targetOffset =
      rawGap <= HEAD_OUTLINE_PARAMS.zeroFeatureThresholdM
        ? HEAD_OUTLINE_PARAMS.featureInwardTuckM
        : Math.min(rawGap, HEAD_OUTLINE_PARAMS.maxHeadOutlineOffsetM);

    oPos.setXYZ(
      i,
      pB.x + nB.x * targetOffset,
      pB.y + nB.y * targetOffset,
      pB.z + nB.z * targetOffset,
    );
    oNrm.setXYZ(i, -nB.x, -nB.y, -nB.z);
  }
  oPos.needsUpdate = true;
  oNrm.needsUpdate = true;

  const { culled } = filterAndRewriteGeometryIndex(oGeo, (ia, _ib, _ic, faceCross) => {
    if (faceCross.lengthSq() <= 1e-14) return false;
    _vNrm.fromBufferAttribute(oNrm, ia);
    return faceCross.dot(_vNrm) > 0;
  });

  return { repairedBaseNormals, culledOutlineTris: culled };
}

/**
 * Tucks open-boundary edges of `torso_*_skin_Outline` / `legs_*_skin_Outline` / `feet_*_skin_Outline`
 * cleanly against their matched base skin surface (avoiding blind inward overshoots).
 */
export function sanitizeBodySkinOutlineBoundaryTuck(
  outlineMesh: THREE.Mesh,
  baseMesh: THREE.Mesh | null,
): void {
  const oGeo = outlineMesh.geometry;
  const oPos = oGeo.getAttribute('position');
  const oNrm = oGeo.getAttribute('normal');
  const topo = analyzeMeshOpenBoundaryTopology(oGeo);
  if (!topo || !oPos || !oNrm || topo.openBoundaryKeys.size === 0) return;

  const bPos = baseMesh?.geometry.getAttribute('position');
  const bNrm = baseMesh?.geometry.getAttribute('normal');
  const matchedBase =
    baseMesh && bPos && bNrm ? matchOutlineToBaseVertices(baseMesh.geometry, oGeo, 0.02) : null;

  const pB = new THREE.Vector3();
  const nB = new THREE.Vector3();
  const pO = new THREE.Vector3();
  const diff = new THREE.Vector3();
  let moved = false;

  for (let i = 0; i < oPos.count; i++) {
    const k = topo.vKeys[i];
    const isOpen = topo.openBoundaryKeys.has(k);
    const isOneRing = !isOpen && topo.oneRingKeys.has(k);

    if (matchedBase && bPos && bNrm && matchedBase[i] >= 0) {
      const bj = matchedBase[i];
      pB.fromBufferAttribute(bPos, bj);
      nB.fromBufferAttribute(bNrm, bj);
      if (nB.lengthSq() > 1e-8) nB.normalize();
      pO.fromBufferAttribute(oPos, i);
      const rawGap = diff.subVectors(pO, pB).dot(nB);
      const targetOffset = isOpen
        ? -0.00035
        : isOneRing
          ? Math.min(rawGap, 0.00055)
          : Math.min(rawGap, 0.00095);
      oPos.setXYZ(
        i,
        pB.x + nB.x * targetOffset,
        pB.y + nB.y * targetOffset,
        pB.z + nB.z * targetOffset,
      );
      oNrm.setXYZ(i, -nB.x, -nB.y, -nB.z);
      moved = true;
    } else if (isOpen || isOneRing) {
      const tuck = isOpen ? 0.0036 : 0.0014;
      oPos.setXYZ(
        i,
        oPos.getX(i) + oNrm.getX(i) * tuck,
        oPos.getY(i) + oNrm.getY(i) * tuck,
        oPos.getZ(i) + oNrm.getZ(i) * tuck,
      );
      moved = true;
    }
  }
  if (moved) {
    oPos.needsUpdate = true;
    oNrm.needsUpdate = true;
  }
}

/**
 * Welds open wrist boundary rings between `hands_skin(_1)` and `torso_*_skin(_1)`
 * (position midpoint, blended normal, 50/50 ForeArm-Hand weights, plus companion outline alignment).
 */
export function weldHandToTorsoWristSeams(
  handsMesh: THREE.Mesh,
  handsOutlineMesh: THREE.Mesh | null,
  torsoSkinMeshes: readonly THREE.Mesh[],
  meshesByLowerKey: ReadonlyMap<string, THREE.Mesh[]>,
): number {
  if (torsoSkinMeshes.length === 0) return 0;
  const hTopo = analyzeMeshOpenBoundaryTopology(handsMesh.geometry);
  if (!hTopo || hTopo.openBoundaryKeys.size === 0) return 0;

  const findArmBonePair = (
    mesh: THREE.Mesh,
    sampleVertIdx: number,
  ): { foreArmIdx: number; handIdx: number } | null => {
    const bones = (mesh as THREE.SkinnedMesh).skeleton?.bones;
    const jntAttr = mesh.geometry.getAttribute('skinIndex');
    if (!bones || !jntAttr || sampleVertIdx >= jntAttr.count) return null;
    let sidePrefix: 'Left' | 'Right' | null = null;
    for (const bIdx of [
      jntAttr.getX(sampleVertIdx),
      jntAttr.getY(sampleVertIdx),
      jntAttr.getZ(sampleVertIdx),
      jntAttr.getW(sampleVertIdx),
    ]) {
      const bName = bones[bIdx]?.name || '';
      if (bName.startsWith('Right')) {
        sidePrefix = 'Right';
        break;
      }
      if (bName.startsWith('Left')) {
        sidePrefix = 'Left';
        break;
      }
    }
    if (!sidePrefix) return null;
    const foreArmIdx = bones.findIndex((b) => b.name === `${sidePrefix}ForeArm`);
    const handIdx = bones.findIndex((b) => b.name === `${sidePrefix}Hand`);
    if (foreArmIdx < 0 || handIdx < 0) return null;
    return { foreArmIdx, handIdx };
  };

  const setWristHalfWeights = (
    geo: THREE.BufferGeometry,
    vertIndices: readonly number[],
    foreArmIdx: number,
    handIdx: number,
  ) => {
    const jntAttr = geo.getAttribute('skinIndex');
    const wgtAttr = geo.getAttribute('skinWeight');
    if (!jntAttr || !wgtAttr) return;
    for (const vi of vertIndices) {
      jntAttr.setXYZW(vi, foreArmIdx, handIdx, 0, 0);
      wgtAttr.setXYZW(vi, 128 / 255, 127 / 255, 0, 0);
    }
    jntAttr.needsUpdate = true;
    wgtAttr.needsUpdate = true;
  };

  const hOutMatch = handsOutlineMesh
    ? matchOutlineToBaseVertices(handsMesh.geometry, handsOutlineMesh.geometry, 0.015)
    : null;
  const hOutByBase = new Map<number, number[]>();
  if (hOutMatch) {
    for (let oi = 0; oi < hOutMatch.length; oi++) {
      const bj = hOutMatch[oi];
      if (bj < 0) continue;
      let list = hOutByBase.get(bj);
      if (!list) {
        list = [];
        hOutByBase.set(bj, list);
      }
      list.push(oi);
    }
  }
  const hOutPosAttr = handsOutlineMesh?.geometry.getAttribute('position');

  let weldedVerts = 0;
  for (const torsoMesh of torsoSkinMeshes) {
    const tTopo = analyzeMeshOpenBoundaryTopology(torsoMesh.geometry);
    if (!tTopo || tTopo.openBoundaryKeys.size === 0) continue;
    const torsoStem = stripMeshVariantSuffix((torsoMesh.name || '').toLowerCase());
    const torsoOutlineMesh = meshesByLowerKey.get(`${torsoStem}_outline`)?.[0] ?? null;
    const tOutPosAttr = torsoOutlineMesh?.geometry.getAttribute('position');
    const tOutMatch = torsoOutlineMesh
      ? matchOutlineToBaseVertices(torsoMesh.geometry, torsoOutlineMesh.geometry, 0.015)
      : null;
    const tOutByBase = new Map<number, number[]>();
    if (tOutMatch) {
      for (let oi = 0; oi < tOutMatch.length; oi++) {
        const bj = tOutMatch[oi];
        if (bj < 0) continue;
        let list = tOutByBase.get(bj);
        if (!list) {
          list = [];
          tOutByBase.set(bj, list);
        }
        list.push(oi);
      }
    }

    let weldedAny = false;
    for (const hKey of hTopo.openBoundaryKeys) {
      const hVerts = hTopo.indicesByKey.get(hKey);
      if (!hVerts || hVerts.length === 0) continue;
      const h0 = hVerts[0];
      const hx = hTopo.posAttr.getX(h0);
      const hy = hTopo.posAttr.getY(h0);
      const hz = hTopo.posAttr.getZ(h0);

      let bestTKey: string | null = null;
      let bestDist = 0.016;
      for (const tKey of tTopo.openBoundaryKeys) {
        const tVerts = tTopo.indicesByKey.get(tKey);
        if (!tVerts || tVerts.length === 0) continue;
        const t0 = tVerts[0];
        const d = Math.hypot(
          hx - tTopo.posAttr.getX(t0),
          hy - tTopo.posAttr.getY(t0),
          hz - tTopo.posAttr.getZ(t0),
        );
        if (d < bestDist) {
          bestDist = d;
          bestTKey = tKey;
        }
      }
      if (!bestTKey) continue;

      const tVerts = tTopo.indicesByKey.get(bestTKey)!;
      const t0 = tVerts[0];
      const mx = 0.5 * (hx + tTopo.posAttr.getX(t0));
      const my = 0.5 * (hy + tTopo.posAttr.getY(t0));
      const mz = 0.5 * (hz + tTopo.posAttr.getZ(t0));

      let nx = 0;
      let ny = 0;
      let nz = 0;
      if (hTopo.nrmAttr && tTopo.nrmAttr) {
        nx = hTopo.nrmAttr.getX(h0) + tTopo.nrmAttr.getX(t0);
        ny = hTopo.nrmAttr.getY(h0) + tTopo.nrmAttr.getY(t0);
        nz = hTopo.nrmAttr.getZ(h0) + tTopo.nrmAttr.getZ(t0);
        const nLen = Math.hypot(nx, ny, nz);
        if (nLen > 1e-5) {
          nx /= nLen;
          ny /= nLen;
          nz /= nLen;
        }
      }

      for (const vi of hVerts) {
        const dx = mx - hTopo.posAttr.getX(vi);
        const dy = my - hTopo.posAttr.getY(vi);
        const dz = mz - hTopo.posAttr.getZ(vi);
        hTopo.posAttr.setXYZ(vi, mx, my, mz);
        if (hTopo.nrmAttr && (nx !== 0 || ny !== 0 || nz !== 0)) {
          hTopo.nrmAttr.setXYZ(vi, nx, ny, nz);
        }
        const outVerts = hOutByBase.get(vi);
        if (hOutPosAttr && outVerts) {
          for (const oi of outVerts) {
            hOutPosAttr.setXYZ(
              oi,
              hOutPosAttr.getX(oi) + dx,
              hOutPosAttr.getY(oi) + dy,
              hOutPosAttr.getZ(oi) + dz,
            );
          }
        }
        weldedVerts++;
      }

      for (const vi of tVerts) {
        const dx = mx - tTopo.posAttr.getX(vi);
        const dy = my - tTopo.posAttr.getY(vi);
        const dz = mz - tTopo.posAttr.getZ(vi);
        tTopo.posAttr.setXYZ(vi, mx, my, mz);
        if (tTopo.nrmAttr && (nx !== 0 || ny !== 0 || nz !== 0)) {
          tTopo.nrmAttr.setXYZ(vi, nx, ny, nz);
        }
        const outVerts = tOutByBase.get(vi);
        if (tOutPosAttr && outVerts) {
          for (const oi of outVerts) {
            tOutPosAttr.setXYZ(
              oi,
              tOutPosAttr.getX(oi) + dx,
              tOutPosAttr.getY(oi) + dy,
              tOutPosAttr.getZ(oi) + dz,
            );
          }
        }
        weldedVerts++;
      }

      const hBones = findArmBonePair(handsMesh, h0);
      const tBones = findArmBonePair(torsoMesh, t0);
      if (hBones && tBones) {
        setWristHalfWeights(handsMesh.geometry, hVerts, hBones.foreArmIdx, hBones.handIdx);
        setWristHalfWeights(torsoMesh.geometry, tVerts, tBones.foreArmIdx, tBones.handIdx);
      }
      weldedAny = true;
    }

    if (weldedAny) {
      hTopo.posAttr.needsUpdate = true;
      tTopo.posAttr.needsUpdate = true;
      if (hTopo.nrmAttr) hTopo.nrmAttr.needsUpdate = true;
      if (tTopo.nrmAttr) tTopo.nrmAttr.needsUpdate = true;
      if (hOutPosAttr) hOutPosAttr.needsUpdate = true;
      if (tOutPosAttr) tOutPosAttr.needsUpdate = true;
    }
  }
  return weldedVerts;
}

/**
 * Normalizes `skinIndex` and `skinWeight` attributes across every `SkinnedMesh` under `sceneRoot`
 * so bone weights are non-negative, finite, within skeleton bounds, and sum cleanly to `1.0`.
 */
export function normalizeAllSkeletonMeshWeights(sceneRoot: THREE.Object3D): number {
  let normalizedVerts = 0;
  sceneRoot.traverse((node) => {
    const sm = node as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh) return;
    const boneCount = sm.skeleton?.bones.length ?? 0;
    const jnt = sm.geometry.getAttribute('skinIndex');
    const wgt = sm.geometry.getAttribute('skinWeight');
    if (!jnt || !wgt || jnt.count !== wgt.count) return;

    let changedMesh = false;
    for (let i = 0; i < wgt.count; i++) {
      let j0 = jnt.getX(i);
      let j1 = jnt.getY(i);
      let j2 = jnt.getZ(i);
      let j3 = jnt.getW(i);
      let w0 = Math.max(0, Number.isFinite(wgt.getX(i)) ? wgt.getX(i) : 0);
      let w1 = Math.max(0, Number.isFinite(wgt.getY(i)) ? wgt.getY(i) : 0);
      let w2 = Math.max(0, Number.isFinite(wgt.getZ(i)) ? wgt.getZ(i) : 0);
      let w3 = Math.max(0, Number.isFinite(wgt.getW(i)) ? wgt.getW(i) : 0);

      if (boneCount > 0) {
        if (j0 < 0 || j0 >= boneCount) {
          j0 = 0;
          w0 = 0;
        }
        if (j1 < 0 || j1 >= boneCount) {
          j1 = 0;
          w1 = 0;
        }
        if (j2 < 0 || j2 >= boneCount) {
          j2 = 0;
          w2 = 0;
        }
        if (j3 < 0 || j3 >= boneCount) {
          j3 = 0;
          w3 = 0;
        }
      }

      const sum = w0 + w1 + w2 + w3;
      if (sum <= 1e-6) {
        jnt.setXYZW(i, 0, 0, 0, 0);
        wgt.setXYZW(i, 1, 0, 0, 0);
        normalizedVerts++;
        changedMesh = true;
      } else if (Math.abs(sum - 1) > 0.005) {
        const inv = 1 / sum;
        jnt.setXYZW(i, j0, j1, j2, j3);
        wgt.setXYZW(i, w0 * inv, w1 * inv, w2 * inv, w3 * inv);
        normalizedVerts++;
        changedMesh = true;
      }
    }

    if (changedMesh) {
      jnt.needsUpdate = true;
      wgt.needsUpdate = true;
    }
  });
  return normalizedVerts;
}

/**
 * Automated underlying-skin culling/masking and transition-band vertex-normal inset rule system.
 * Culls covered torso, hip, leg, and foot skin triangles hidden beneath outfits (with safe hem/collar
 * margins), and smoothly insets remaining near-garment rim vertices inward so skin never pokes out.
 */
export function applyUnderlyingSkinCullingAndOffsetRules(
  sceneRoot: THREE.Object3D,
): { culledTris: number; insetVerts: number } {
  const meshesByLowerKey = new Map<string, THREE.Mesh[]>();
  const clothMeshesBySlot: Record<'torso' | 'legs' | 'feet', THREE.Mesh[]> = {
    torso: [],
    legs: [],
    feet: [],
  };
  const skinEntries: Array<{ mesh: THREE.Mesh; slot: 'torso' | 'legs' | 'feet' }> = [];

  sceneRoot.traverse((node) => {
    if (!(node as THREE.Mesh).isMesh) return;
    const mesh = node as THREE.Mesh;
    if (!mesh.visible) return;
    const lower = (mesh.name || '').toLowerCase();
    const stripped = stripMeshVariantSuffix(lower);
    for (const key of [lower, stripped]) {
      if (!key) continue;
      const list = meshesByLowerKey.get(key);
      if (list) list.push(mesh);
      else meshesByLowerKey.set(key, [mesh]);
    }
    const role = classifyAvatarMeshRole(mesh.name);
    if (role === 'torso_skin') skinEntries.push({ mesh, slot: 'torso' });
    else if (role === 'legs_skin') skinEntries.push({ mesh, slot: 'legs' });
    else if (role === 'feet_skin') skinEntries.push({ mesh, slot: 'feet' });
    else if (role === 'clothing') {
      if (stripped.startsWith('torso_') || stripped.startsWith('neck_')) {
        clothMeshesBySlot.torso.push(mesh);
      } else if (stripped.startsWith('legs_')) {
        clothMeshesBySlot.legs.push(mesh);
      } else if (stripped.startsWith('feet_')) {
        clothMeshesBySlot.feet.push(mesh);
      }
    }
  });

  const allClothMeshes = [
    ...clothMeshesBySlot.torso,
    ...clothMeshesBySlot.legs,
    ...clothMeshesBySlot.feet,
  ];
  if (allClothMeshes.length === 0 || skinEntries.length === 0) {
    return { culledTris: 0, insetVerts: 0 };
  }

  const clothBounds = allClothMeshes.map((cm) => {
    const pos = cm.geometry.getAttribute('position');
    const b = new THREE.Box3();
    if (pos) b.setFromBufferAttribute(pos as THREE.BufferAttribute);
    const stripped = stripMeshVariantSuffix((cm.name || '').toLowerCase());
    const slot: 'torso' | 'legs' | 'feet' = stripped.startsWith('legs_')
      ? 'legs'
      : stripped.startsWith('feet_')
        ? 'feet'
        : 'torso';
    return { mesh: cm, slot, box: b };
  });
  const allClothSoup = buildTriangleSoup(allClothMeshes);

  let culledTris = 0;
  let insetVerts = 0;

  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const negN = new THREE.Vector3();

  for (const { mesh: skinMesh, slot: skinSlot } of skinEntries) {
    const sGeo = skinMesh.geometry;
    const pos = sGeo.getAttribute('position');
    const nrm = sGeo.getAttribute('normal');
    if (!pos || !nrm || pos.count === 0) continue;

    const skinStem = stripMeshVariantSuffix((skinMesh.name || '').toLowerCase());
    const outlineMesh = meshesByLowerKey.get(`${skinStem}_outline`)?.[0] ?? null;
    const oPos = outlineMesh?.geometry.getAttribute('position');
    const oMatch =
      outlineMesh && oPos
        ? matchOutlineToBaseVertices(sGeo, outlineMesh.geometry, 0.018)
        : null;
    const outVertsByBase = new Map<number, number[]>();
    if (oMatch) {
      for (let oi = 0; oi < oMatch.length; oi++) {
        const bj = oMatch[oi];
        if (bj < 0) continue;
        let list = outVertsByBase.get(bj);
        if (!list) {
          list = [];
          outVertsByBase.set(bj, list);
        }
        list.push(oi);
      }
    }

    const vertDeepCovered = new Uint8Array(pos.count);
    const vertInsetApplied = new Float32Array(pos.count);
    let meshInsetVerts = 0;

    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      n.fromBufferAttribute(nrm, i);
      if (n.lengthSq() > 1e-8) n.normalize();
      negN.copy(n).negate();

      // Never touch exposed neck/head collar zone or hands/wrists
      const isProtectedNeck = Math.abs(p.x) < 0.085 && p.y >= 1.325;
      if (isProtectedNeck) continue;

      let insideAnyClothDeep = false;
      let insideAnyClothTuck = false;
      let matchingBounds = false;

      for (const cb of clothBounds) {
        if (cb.box.isEmpty()) continue;
        const margin = BODY_SKIN_CULLING_PARAMS.hemKeepMarginM;
        const tuckM = BODY_SKIN_CULLING_PARAMS.tuckBandMarginM;

        // Check whether vertex sits strictly inside garment's anatomical span
        const inY = p.y >= cb.box.min.y - 0.005 && p.y <= cb.box.max.y + 0.005;
        const inX = p.x >= cb.box.min.x - 0.01 && p.x <= cb.box.max.x + 0.01;
        const inZ = p.z >= cb.box.min.z - 0.015 && p.z <= cb.box.max.z + 0.015;
        if (!inY || !inX || !inZ) continue;
        // Short skirts / garters (`min.y > 0.35` on legs) drape loosely over bare thighs and
        // often include asymmetric thigh straps; never let a garter's bounding box cull or
        // inset exposed thigh skin below the upper-pelvis waistband (`p.y < 0.785`).
        const isSkirtOrGarterOverlap = skinSlot === 'legs' && cb.slot === 'legs' && cb.box.min.y > 0.35;
        if (isSkirtOrGarterOverlap && p.y < 0.785) {
          continue;
        }
        matchingBounds = true;

        // Deep interior check away from open top/bottom/sleeve hems
        const deepY =
          cb.slot === 'feet'
            ? p.y <= cb.box.max.y - margin
            : p.y >= cb.box.min.y + margin && p.y <= cb.box.max.y - margin;
        const deepArmX =
          cb.slot !== 'torso' ||
          Math.abs(p.x) < 0.16 ||
          Math.abs(p.x) <= Math.max(Math.abs(cb.box.min.x), Math.abs(cb.box.max.x)) - margin;
        if (deepY && deepArmX) {
          insideAnyClothDeep = true;
        }
        const tuckY =
          p.y >= cb.box.min.y - 0.004 &&
          p.y <= cb.box.max.y + 0.004 &&
          (cb.slot !== 'torso' ||
            Math.abs(p.x) < 0.16 ||
            Math.abs(p.x) <= Math.max(Math.abs(cb.box.min.x), Math.abs(cb.box.max.x)) + tuckM);
        if (tuckY) {
          insideAnyClothTuck = true;
        }
      }
      if (!matchingBounds) continue;

      const outClothDist = castRayMinDist(
        p,
        n,
        allClothSoup,
        BODY_SKIN_CULLING_PARAMS.maxClothRayDistanceM,
        0.0002,
      );
      const inClothDist = castRayMinDist(p, negN, allClothSoup, 0.022, 0.0002);

      const isCoveredOut = outClothDist < BODY_SKIN_CULLING_PARAMS.maxClothRayDistanceM;
      const isPokingOut = !isCoveredOut && inClothDist < 0.02;

      if ((isCoveredOut || isPokingOut) && insideAnyClothDeep) {
        vertDeepCovered[i] = 1;
      }

      // Compute smooth inward vertex-normal inset for covered seam rims or poking vertices
      if (insideAnyClothTuck && (isPokingOut || (isCoveredOut && outClothDist < 0.012))) {
        const rawInset = isPokingOut
          ? Math.min(
              BODY_SKIN_CULLING_PARAMS.maxSkinInsetM,
              inClothDist + BODY_SKIN_CULLING_PARAMS.minSkinInsetM,
            )
          : Math.max(
              BODY_SKIN_CULLING_PARAMS.minSkinInsetM,
              0.0032 - outClothDist * 0.12,
            );
        vertInsetApplied[i] = rawInset;
        pos.setXYZ(i, p.x - n.x * rawInset, p.y - n.y * rawInset, p.z - n.z * rawInset);
        meshInsetVerts++;
        insetVerts++;

        if (oPos && outVertsByBase.has(i)) {
          for (const oi of outVertsByBase.get(i)!) {
            // Pull outline slightly further inward so black skin rim stays tucked inside clothes
            const outPull = rawInset + 0.0004;
            oPos.setXYZ(
              oi,
              oPos.getX(oi) - n.x * outPull,
              oPos.getY(oi) - n.y * outPull,
              oPos.getZ(oi) - n.z * outPull,
            );
          }
        }
      }
    }

    if (meshInsetVerts > 0) {
      pos.needsUpdate = true;
      if (oPos) oPos.needsUpdate = true;
    }

    // Cull triangles strictly covered beneath clothes (requiring all 3 vertices deep inside)
    // while preserving exposed collar, sleeve, hem, and ankle rims.
    const { culled } = filterAndRewriteGeometryIndex(sGeo, (ia, ib, ic) => {
      return vertDeepCovered[ia] + vertDeepCovered[ib] + vertDeepCovered[ic] < 3;
    });
    culledTris += culled;

    // Also cull corresponding covered triangles on companion *_skin_Outline
    if (outlineMesh && oMatch && culled > 0) {
      filterAndRewriteGeometryIndex(outlineMesh.geometry, (ia, ib, ic) => {
        const ba = oMatch[ia];
        const bb = oMatch[ib];
        const bc = oMatch[ic];
        if (ba >= 0 && bb >= 0 && bc >= 0) {
          return vertDeepCovered[ba] + vertDeepCovered[bb] + vertDeepCovered[bc] < 3;
        }
        return true;
      });
    }
  }

  return { culledTris, insetVerts };
}

/**
 * Full avatar anatomy & skin seam sanitization pipeline invoked once per loaded custom GLB template.
 * Fixes `_skin_1` wrist welds, finger/ear/head outline blotches, inconsistent base normals,
 * weight normalization, and automated under-clothing skin culling & vertex-normal insets.
 */
export function sanitizeAvatarAnatomyAndSkinSeams(
  sceneRoot: THREE.Object3D,
): AvatarAnatomySanitizationReport {
  const report: AvatarAnatomySanitizationReport = {
    normalizedWeightVerts: 0,
    repairedBaseNormals: 0,
    wristWeldedVerts: 0,
    culledHandOutlineTris: 0,
    culledEarOutlineTris: 0,
    culledHeadOutlineTris: 0,
    culledCoveredSkinTris: 0,
    insetSkinVerts: 0,
  };

  report.normalizedWeightVerts = normalizeAllSkeletonMeshWeights(sceneRoot);

  // Clean watertight Blender Blitz_* avatars already have welded limbs, clean normals, and pre-culled
  // hidden skin; skip legacy seam culling/tucking so hand/head/outfit geometry stays untouched.
  if (
    sceneRoot.getObjectByName('Blitz_BaseDoll_Female_Mesh') ||
    sceneRoot.getObjectByName('Blitz_BaseDoll_Male_Mesh')
  ) {
    return report;
  }

  const meshesByLowerKey = new Map<string, THREE.Mesh[]>();
  const torsoSkinMeshes: THREE.Mesh[] = [];
  const headMeshes: THREE.Mesh[] = [];
  const earMeshes: THREE.Mesh[] = [];
  const handMeshes: THREE.Mesh[] = [];
  const bodySkinOutlineMeshes: THREE.Mesh[] = [];

  sceneRoot.traverse((node) => {
    if (!(node as THREE.Mesh).isMesh) return;
    const mesh = node as THREE.Mesh;
    const lower = (mesh.name || '').toLowerCase();
    const stripped = stripMeshVariantSuffix(lower);
    for (const k of [lower, stripped]) {
      if (!k) continue;
      const list = meshesByLowerKey.get(k);
      if (list) list.push(mesh);
      else meshesByLowerKey.set(k, [mesh]);
    }
    const role = classifyAvatarMeshRole(mesh.name);
    if (role === 'torso_skin') torsoSkinMeshes.push(mesh);
    else if (role === 'head') headMeshes.push(mesh);
    else if (role === 'ears') earMeshes.push(mesh);
    else if (role === 'hands_skin') handMeshes.push(mesh);
    else if (
      role === 'torso_skin_outline' ||
      role === 'legs_skin_outline' ||
      role === 'feet_skin_outline'
    ) {
      bodySkinOutlineMeshes.push(mesh);
    }
  });

  const getOutlineForBase = (baseMesh: THREE.Mesh): THREE.Mesh | null => {
    const stem = stripMeshVariantSuffix((baseMesh.name || '').toLowerCase());
    return meshesByLowerKey.get(`${stem}_outline`)?.[0] ?? null;
  };

  // 1. Weld wrist seams between hands_skin(_1) and torso_*_skin(_1)
  if (handMeshes.length > 0 && torsoSkinMeshes.length > 0) {
    for (const hMesh of handMeshes) {
      report.wristWeldedVerts += weldHandToTorsoWristSeams(
        hMesh,
        getOutlineForBase(hMesh),
        torsoSkinMeshes,
        meshesByLowerKey,
      );
    }
  }

  // 2. Fix finger/palm/web black patches & hand outline hulls
  for (const hMesh of handMeshes) {
    const res = sanitizeHandSkinAndOutlineMeshes(hMesh, getOutlineForBase(hMesh));
    report.repairedBaseNormals += res.repairedBaseNormals;
    report.culledHandOutlineTris += res.culledOutlineTris;
  }

  // 3. Fix ear-crease & attachment-ring outline artifacts
  for (const eMesh of earMeshes) {
    const res = sanitizeEarSkinAndOutlineMeshes(eMesh, getOutlineForBase(eMesh));
    report.repairedBaseNormals += res.repairedBaseNormals;
    report.culledEarOutlineTris += res.culledOutlineTris;
  }

  // 4. Fix head normal creases & zero-offset facial seam tucks
  for (const hdMesh of headMeshes) {
    const res = sanitizeHeadSkinAndOutlineMeshes(hdMesh, getOutlineForBase(hdMesh));
    report.repairedBaseNormals += res.repairedBaseNormals;
    report.culledHeadOutlineTris += res.culledOutlineTris;
  }

  // 5. Base-referenced boundary tuck on remaining body skin outlines (torso/legs/feet)
  for (const outMesh of bodySkinOutlineMeshes) {
    const baseMesh = findBaseMeshForOutline(outMesh.name, meshesByLowerKey);
    sanitizeBodySkinOutlineBoundaryTuck(outMesh, baseMesh);
  }

  // 6. Automated under-clothing skin culling & transition-rim vertex-normal insets
  const cullRes = applyUnderlyingSkinCullingAndOffsetRules(sceneRoot);
  report.culledCoveredSkinTris = cullRes.culledTris;
  report.insetSkinVerts = cullRes.insetVerts;

  return report;
}

/**
 * Computes standardized avatar scale across male/female archetypes and Town Folks NPCs using
 * anatomical sole-to-skull-crown span (excluding variable spiky hair and outline protrusions).
 */
export function computeStandardizedAvatarRigMetrics(
  sceneRoot: THREE.Object3D,
): AvatarRigStandardMetrics {
  sceneRoot.updateMatrixWorld(true);
  const fullBox = new THREE.Box3().setFromObject(sceneRoot);
  const fullHeightRaw = Math.max(0, fullBox.max.y - fullBox.min.y);

  const nonOutlineBox = new THREE.Box3();
  const headBox = new THREE.Box3();
  let hasFeetOrLegs = false;
  let hasHead = false;
  const tempBox = new THREE.Box3();

  sceneRoot.traverse((node) => {
    if (!(node as THREE.Mesh).isMesh) return;
    const mesh = node as THREE.Mesh;
    if (!mesh.visible) return;
    const role = classifyAvatarMeshRole(mesh.name);
    if (role.endsWith('_outline')) return;

    tempBox.setFromObject(mesh);
    if (tempBox.isEmpty()) return;
    nonOutlineBox.union(tempBox);

    if (role === 'head') {
      headBox.union(tempBox);
      hasHead = true;
    } else if (role === 'feet_skin' || role === 'legs_skin' || role === 'clothing') {
      const stripped = stripMeshVariantSuffix((mesh.name || '').toLowerCase());
      if (
        stripped.startsWith('feet_') ||
        stripped.startsWith('legs_') ||
        (stripped.startsWith('blitz_') &&
          (stripped.includes('_shoes') ||
            stripped.includes('heels') ||
            stripped.includes('sneakers') ||
            stripped.includes('_legs') ||
            stripped.includes('_shorts') ||
            stripped.includes('_trousers')))
      ) {
        hasFeetOrLegs = true;
      }
    } else if (role === 'torso_skin' && (mesh.name || '').toLowerCase().startsWith('blitz_basedoll_')) {
      hasFeetOrLegs = true;
    }
  });

  const nonOutlineMinY = !nonOutlineBox.isEmpty() ? nonOutlineBox.min.y : fullBox.min.y;
  const headTopY = hasHead && !headBox.isEmpty() ? headBox.max.y : fullBox.max.y;
  const skullHeightRaw = Math.max(0, headTopY - nonOutlineMinY);

  const usedSkullNormalization = hasHead && hasFeetOrLegs && skullHeightRaw > 0.5;
  const unifiedModelScale = usedSkullNormalization
    ? STANDARD_AVATAR_SKULL_CROWN_HEIGHT_M / skullHeightRaw
    : fullHeightRaw > 0.5
      ? STANDARD_AVATAR_FALLBACK_FULL_HEIGHT_M / fullHeightRaw
      : 3.45;

  return {
    unifiedModelScale,
    skullHeightRaw,
    fullHeightRaw,
    nonOutlineMinY,
    headTopY,
    usedSkullNormalization,
  };
}

/**
 * Computes standing `baseRootY` strictly from non-outline footwear/body bounds in isolated
 * `glbRoot` space so overhanging clothing outlines never hover a character off the floor.
 */
export function computeStandardizedGroundRootY(
  glbRoot: THREE.Object3D,
  scratchBox = new THREE.Box3(),
): number {
  glbRoot.updateMatrixWorld(true);
  const nonOutlineBox = new THREE.Box3();
  scratchBox.makeEmpty();
  glbRoot.traverse((node) => {
    if (!(node as THREE.Mesh).isMesh) return;
    const mesh = node as THREE.Mesh;
    if (!mesh.visible) return;
    const role = classifyAvatarMeshRole(mesh.name);
    if (role.endsWith('_outline')) return;
    scratchBox.setFromObject(mesh);
    if (!scratchBox.isEmpty()) {
      nonOutlineBox.union(scratchBox);
    }
  });
  if (!nonOutlineBox.isEmpty()) {
    return -nonOutlineBox.min.y;
  }
  scratchBox.setFromObject(glbRoot);
  return !scratchBox.isEmpty() ? -scratchBox.min.y : 0;
}

/**
 * Per-rig post-upgrade normalization pass verifying finite skin weights and consistent pose matrices
 * after cloning a shared template onto an individual avatar or Town Folks NPC.
 */
export function applyRigPostUpgradeAnatomyRules(glbRoot: THREE.Object3D): number {
  return normalizeAllSkeletonMeshWeights(glbRoot);
}
