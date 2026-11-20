import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  ANATOMICAL_SKIN_SHADER_PARAMS,
  EAR_OUTLINE_PARAMS,
  HAND_OUTLINE_SUPPRESSION_PARAMS,
  HEAD_OUTLINE_PARAMS,
  STANDARD_AVATAR_SKULL_CROWN_HEIGHT_M,
  applyUnderlyingSkinCullingAndOffsetRules,
  classifyAvatarMeshRole,
  classifyAvatarOutlineCategory,
  computeStandardizedAvatarRigMetrics,
  computeStandardizedGroundRootY,
  countOutlineWindingMismatches,
  isBodySkinMeshName,
  isHandSkinMeshName,
  normalizeAllSkeletonMeshWeights,
  repairInconsistentBaseNormals,
  sanitizeAvatarAnatomyAndSkinSeams,
  sanitizeEarSkinAndOutlineMeshes,
  sanitizeHandSkinAndOutlineMeshes,
  sanitizeHeadSkinAndOutlineMeshes,
  stripMeshVariantSuffix,
  weldHandToTorsoWristSeams,
} from './buddiesAvatarAnatomyRules';
import {
  upgradeBuddyRigWithCharBuddiesGlb,
  type BuddyCharacterRig,
} from './buddiesBlitzShadersAndAssets';

const REAL_CHARACTER_GLB_CASES = [
  {
    id: 'playerFemale',
    relPath: 'public/assets/character_custom_idle_runway_catwalk_stylish_11 (3).glb',
    expectSkinOutlineCulled: true,
  },
  {
    id: 'playerMale',
    relPath: 'public/assets/aistudio/character_custom_idle_runway_catwalk_stylish_11 (2).glb',
    expectSkinOutlineCulled: true,
  },
  {
    id: 'hana',
    relPath: 'public/assets/character_custom_idle_elegan_kalem_4.glb',
    expectSkinOutlineCulled: true,
  },
  {
    id: 'kai',
    relPath: 'public/assets/aistudio/character_custom_idle_runway_catwalk_stylish_11 (1).glb',
    expectSkinOutlineCulled: true,
  },
  {
    id: 'ambientFemale',
    relPath: 'public/assets/character_custom_sit_formal_tenang_2.glb',
    expectSkinOutlineCulled: true,
  },
  {
    id: 'ambientMale',
    relPath: 'public/assets/aistudio/character_custom_sit_runway_catwalk_stylish_4.glb',
    expectSkinOutlineCulled: true,
  },
] as const;

type DracoDecoderFactory = (opts?: Record<string, unknown>) => Promise<Record<string, unknown>>;

let cachedDracoModulePromise: Promise<Record<string, unknown>> | null = null;

function getNodeDracoDecoderModule(): Promise<Record<string, unknown>> {
  if (!cachedDracoModulePromise) {
    const g = globalThis as Record<string, unknown>;
    if (typeof g.self === 'undefined') {
      g.self = globalThis;
    }
    const requireFromRoot = createRequire(path.resolve(process.cwd(), 'package.json'));
    const dracoFactory = requireFromRoot(
      path.resolve(process.cwd(), 'public/draco/draco_decoder.js'),
    ) as DracoDecoderFactory;
    const wasmBinary = fs.readFileSync(path.resolve(process.cwd(), 'public/draco/draco_decoder.wasm'));
    cachedDracoModulePromise = dracoFactory({
      wasmBinary: wasmBinary.buffer.slice(
        wasmBinary.byteOffset,
        wasmBinary.byteOffset + wasmBinary.byteLength,
      ),
    });
  }
  return cachedDracoModulePromise;
}

class NodeDracoLoader extends DRACOLoader {
  override preload(): this {
    return this;
  }

  decodeDracoFile(
    buffer: ArrayBuffer,
    callback: (geometry: THREE.BufferGeometry) => void,
    attributeIDs: Record<string, string>,
    attributeTypes: Record<string, string>,
    vertexColorSpace?: THREE.ColorSpace,
    onError?: (error: unknown) => void,
  ): void {
    void (async () => {
      try {
        const draco = await getNodeDracoDecoderModule();
        // Match Three.js DRACOWorker decode contract synchronously in Node without Web Workers
        const DecoderCtor = draco.Decoder as new () => Record<string, unknown>;
        const BufferCtor = draco.DecoderBuffer as new () => Record<string, unknown>;
        const decoder = new DecoderCtor() as {
          GetEncodedGeometryType(buf: unknown): unknown;
          DecodeBufferToMesh(buf: unknown, mesh: unknown): { ok(): boolean; error_msg(): string };
          DecodeBufferToPointCloud(buf: unknown, pc: unknown): { ok(): boolean; error_msg(): string };
          GetAttributeByUniqueId(geom: unknown, id: number): Record<string, unknown>;
          GetAttribute(geom: unknown, type: unknown): Record<string, unknown>;
          GetTrianglesUInt32Array(geom: unknown, byteLen: number, ptr: number): void;
          GetAttributeDataArrayForAllPoints(
            geom: unknown,
            attr: Record<string, unknown>,
            dt: unknown,
            byteLen: number,
            ptr: number,
          ): void;
        };
        const decoderBuffer = new BufferCtor() as {
          Init(bytes: Int8Array, byteLength: number): void;
        };
        const MeshCtor = draco.Mesh as new () => { num_faces(): number; num_points(): number };
        const PointCloudCtor = draco.PointCloud as new () => { num_points(): number };
        const dracoDestroy = draco.destroy as (obj: unknown) => void;

        decoderBuffer.Init(new Int8Array(buffer), buffer.byteLength);
        const geomType = decoder.GetEncodedGeometryType(decoderBuffer);
        const dracoGeometry =
          geomType === draco.TRIANGULAR_MESH ? new MeshCtor() : new PointCloudCtor();
        const status =
          geomType === draco.TRIANGULAR_MESH
            ? decoder.DecodeBufferToMesh(decoderBuffer, dracoGeometry)
            : decoder.DecodeBufferToPointCloud(decoderBuffer, dracoGeometry);

        if (!status.ok()) {
          throw new Error(`DRACO decode error: ${status.error_msg()}`);
        }

        const geometry = new THREE.BufferGeometry();
        const dracoTypedArrays = draco as Record<string, number>;
        const dracoMalloc = draco._malloc as (bytes: number) => number;
        const dracoFree = draco._free as (ptr: number) => void;
        const heapU8 = draco.HEAPU8 as Uint8Array;
        const heapU32 = draco.HEAPU32 as Uint32Array;
        const heapF32 = draco.HEAPF32 as Float32Array;
        const heapU16 = draco.HEAPU16 as Uint16Array;

        for (const [attrName, attrIdOrType] of Object.entries(attributeIDs)) {
          const typeName = attributeTypes[attrName] || 'Float32Array';
          let dracoAttr: Record<string, unknown>;
          if (typeof attrIdOrType === 'number') {
            dracoAttr = decoder.GetAttributeByUniqueId(dracoGeometry, attrIdOrType);
          } else {
            dracoAttr = decoder.GetAttribute(dracoGeometry, draco[attrIdOrType]);
          }
          const attrPtr = (dracoAttr as { ptr?: number }).ptr ?? 0;
          if (!attrPtr) continue;

          const numComponents = (dracoAttr.num_components as () => number)();
          const numPoints = dracoGeometry.num_points();
          const numValues = numPoints * numComponents;

          let DataType = draco.DT_FLOAT32;
          let ArrayCtor:
            | Float32ArrayConstructor
            | Uint16ArrayConstructor
            | Uint8ArrayConstructor = Float32Array;
          let elemBytes = 4;
          if (typeName === 'Uint16Array') {
            DataType = draco.DT_UINT16;
            ArrayCtor = Uint16Array;
            elemBytes = 2;
          } else if (typeName === 'Uint8Array') {
            DataType = draco.DT_UINT8;
            ArrayCtor = Uint8Array;
            elemBytes = 1;
          }

          const byteLength = numValues * elemBytes;
          const ptr = dracoMalloc(byteLength);
          decoder.GetAttributeDataArrayForAllPoints(dracoGeometry, dracoAttr, DataType, byteLength, ptr);

          let outArray: THREE.TypedArray;
          if (ArrayCtor === Float32Array) {
            outArray = new Float32Array(heapF32.buffer, ptr, numValues).slice();
          } else if (ArrayCtor === Uint16Array) {
            outArray = new Uint16Array(heapU16.buffer, ptr, numValues).slice();
          } else {
            outArray = new Uint8Array(heapU8.buffer, ptr, numValues).slice();
          }
          dracoFree(ptr);

          const normalized = Boolean(dracoAttr.normalized && (dracoAttr.normalized as () => boolean)());
          const threeAttr = new THREE.BufferAttribute(outArray, numComponents, normalized);
          if (attrName === 'color' && vertexColorSpace === THREE.SRGBColorSpace) {
            for (let i = 0; i < numPoints; i++) {
              const c = new THREE.Color(threeAttr.getX(i), threeAttr.getY(i), threeAttr.getZ(i)).convertSRGBToLinear();
              threeAttr.setXYZ(i, c.r, c.g, c.b);
            }
          }
          geometry.setAttribute(attrName, threeAttr);
        }

        if (geomType === draco.TRIANGULAR_MESH) {
          const meshGeom = dracoGeometry as unknown as { num_faces(): number };
          const numFaces = meshGeom.num_faces();
          const numIndices = numFaces * 3;
          const byteLength = numIndices * 4;
          const ptr = dracoMalloc(byteLength);
          decoder.GetTrianglesUInt32Array(dracoGeometry, byteLength, ptr);
          const indices = new Uint32Array(heapU32.buffer, ptr, numIndices).slice();
          dracoFree(ptr);
          geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        }

        void dracoTypedArrays;
        dracoDestroy(dracoGeometry);
        dracoDestroy(decoderBuffer);
        dracoDestroy(decoder);
        callback(geometry);
      } catch (err) {
        onError?.(err);
      }
    })();
  }
}

async function parseRealGlbInNode(relPath: string): Promise<GLTF> {
  const g = globalThis as Record<string, unknown>;
  if (typeof g.self === 'undefined') {
    g.self = globalThis;
  }
  if (typeof g.createImageBitmap === 'undefined') {
    g.createImageBitmap = async () => ({ width: 2, height: 2, close() {} });
  }
  const loader = new GLTFLoader();
  loader.setDRACOLoader(new NodeDracoLoader());
  const buf = fs.readFileSync(path.resolve(process.cwd(), relPath));
  return loader.parseAsync(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
    '',
  );
}

function createMinimalBuddyRig(bodyGroup: THREE.Group): BuddyCharacterRig {
  const dummyMesh = new THREE.Mesh();
  return {
    headMesh: dummyMesh,
    leftArmPivot: new THREE.Group(),
    rightArmPivot: new THREE.Group(),
    leftLegPivot: new THREE.Group(),
    rightLegPivot: new THREE.Group(),
    weaponMesh: dummyMesh,
    weaponRigGroup: new THREE.Group(),
    pistolGroup: new THREE.Group(),
    rifleGroup: new THREE.Group(),
    bazookaGroup: new THREE.Group(),
    bazookaFrontFlash: new THREE.Group(),
    bazookaBackblastGroup: new THREE.Group(),
    bodyGroupRef: bodyGroup,
  };
}

function createHandSkeleton(boneNames: string[]): THREE.Bone[] {
  const bones = boneNames.map((name) => {
    const b = new THREE.Bone();
    b.name = name;
    return b;
  });
  for (let i = 1; i < bones.length; i++) {
    bones[i - 1].add(bones[i]);
  }
  bones[0].updateMatrixWorld(true);
  return bones;
}

test('Mesh role & _skin_1 variant classification handles GLTF multi-primitive suffixes and outlines accurately', () => {
  assert.equal(stripMeshVariantSuffix('hands_skin_1'), 'hands_skin');
  assert.equal(stripMeshVariantSuffix('torso_base_skin_2'), 'torso_base_skin');
  assert.equal(stripMeshVariantSuffix('ears_001_basic_Outline_1'), 'ears_001_basic_Outline');

  assert.equal(classifyAvatarMeshRole('hands_skin_1'), 'hands_skin');
  assert.equal(classifyAvatarMeshRole('hands_skin_Outline'), 'hands_outline');
  assert.equal(classifyAvatarMeshRole('torso_base_skin_1'), 'torso_skin');
  assert.equal(classifyAvatarMeshRole('legs_base_skin_1'), 'legs_skin');
  assert.equal(classifyAvatarMeshRole('feet_base_skin_1'), 'feet_skin');
  assert.equal(classifyAvatarMeshRole('ears_001_basic_1'), 'ears');
  assert.equal(classifyAvatarMeshRole('ears_001_basic_Outline'), 'ears_outline');
  assert.equal(classifyAvatarMeshRole('head_102_triangle_1'), 'head');
  assert.equal(classifyAvatarMeshRole('head_102_triangle_Outline'), 'head_outline');
  assert.equal(classifyAvatarMeshRole('torso_crop_01_1'), 'clothing');

  assert.equal(isBodySkinMeshName('hands_skin_1'), true);
  assert.equal(isBodySkinMeshName('torso_base_skin_1'), true);
  assert.equal(isBodySkinMeshName('legs_base_skin_1'), true);
  assert.equal(isBodySkinMeshName('feet_base_skin_1'), true);
  assert.equal(isBodySkinMeshName('ears_001_basic_1'), true);
  assert.equal(isBodySkinMeshName('hands_skin_Outline'), false);
  assert.equal(isBodySkinMeshName('head_102_triangle_1'), false);
  assert.equal(isBodySkinMeshName('torso_crop_01_1'), false);

  assert.equal(isHandSkinMeshName('hands_skin_1'), true);
  assert.equal(isHandSkinMeshName('hands_skin_Outline'), false);
  assert.equal(isHandSkinMeshName('hands_gloves_01'), false);

  assert.equal(classifyAvatarOutlineCategory('hands_skin_Outline', 'skin_Outline'), 'skin_hand');
  assert.equal(classifyAvatarOutlineCategory('ears_001_basic_Outline', 'skin_Outline'), 'skin_ear');
  assert.equal(classifyAvatarOutlineCategory('head_102_triangle_Outline', 'head_Outline'), 'skin_head');
  assert.equal(classifyAvatarOutlineCategory('torso_base_skin_Outline', 'skin_Outline'), 'skin_body');
  assert.equal(classifyAvatarOutlineCategory('hair_bob_Outline', 'hair_cutout_Outline'), 'hair_cutout');
  assert.equal(classifyAvatarOutlineCategory('torso_shirt_Outline', 'cloth_Outline'), 'clothing');
});

test('repairInconsistentBaseNormals flips inverted fingertip/chin crease normals back outward', () => {
  const box = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const nrm = box.getAttribute('normal');
  const origNx0 = nrm.getX(0);
  const origNy0 = nrm.getY(0);
  const origNz0 = nrm.getZ(0);
  const origNx1 = nrm.getX(1);
  const origNy1 = nrm.getY(1);
  const origNz1 = nrm.getZ(1);

  nrm.setXYZ(0, -origNx0, -origNy0, -origNz0);
  nrm.setXYZ(1, -origNx1, -origNy1, -origNz1);

  const repaired = repairInconsistentBaseNormals(box);
  assert.equal(repaired, 2, 'Both inverted vertex normals must be detected and repaired');
  assert.ok(
    nrm.getX(0) * origNx0 + nrm.getY(0) * origNy0 + nrm.getZ(0) * origNz0 > 0.5,
    'Vertex 0 normal aligns with outward triangle winding again',
  );
  assert.ok(
    nrm.getX(1) * origNx1 + nrm.getY(1) * origNy1 + nrm.getZ(1) * origNz1 > 0.5,
    'Vertex 1 normal aligns with outward triangle winding again',
  );
});

test('sanitizeHandSkinAndOutlineMeshes suppresses digit/web/flipped outline triangles while preserving wrist contour', () => {
  const bones = createHandSkeleton(['LeftForeArm', 'LeftHand', 'LeftHandMiddle1']);
  const invMatrices = bones.map((b) => new THREE.Matrix4().copy(b.matrixWorld).invert());
  const skeleton = new THREE.Skeleton(bones, invMatrices);

  // Build base hand mesh:
  // Vertices 0..2: wrist quad triangle at x=0.58..0.60 (bound to LeftHand)
  // Vertices 3..5: finger triangle at x=0.66..0.72 (bound to LeftHandMiddle1)
  const bPos = new THREE.Float32BufferAttribute(
    [
      0.58, 1.25, -0.02,
      0.60, 1.25, 0.02,
      0.59, 1.28, 0.0,
      0.66, 1.25, -0.01,
      0.72, 1.25, 0.01,
      0.69, 1.27, 0.0,
    ],
    3,
  );
  const bNrm = new THREE.Float32BufferAttribute(
    [
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
      0, 0, -1, // flipped fingertip crease normal
      0, 0, 1,
      0, 0, 1,
    ],
    3,
  );
  const bIdx = new THREE.Uint16BufferAttribute([0, 1, 2, 3, 4, 5], 1);
  const bSkinIdx = new THREE.Uint16BufferAttribute(
    [
      1, 0, 0, 0,
      1, 0, 0, 0,
      1, 0, 0, 0,
      2, 0, 0, 0,
      2, 0, 0, 0,
      2, 0, 0, 0,
    ],
    4,
  );
  const bSkinWgt = new THREE.Float32BufferAttribute(
    [
      1, 0, 0, 0,
      1, 0, 0, 0,
      1, 0, 0, 0,
      1, 0, 0, 0,
      1, 0, 0, 0,
      1, 0, 0, 0,
    ],
    4,
  );
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute('position', bPos);
  bGeo.setAttribute('normal', bNrm);
  bGeo.setAttribute('skinIndex', bSkinIdx);
  bGeo.setAttribute('skinWeight', bSkinWgt);
  bGeo.setIndex(bIdx);

  // Build companion outline mesh with 3 triangles:
  // Tri 0 (0..2): properly inverted-winding wrist outline (matches -normal -> inward cross > 0)
  // Tri 1 (3..5): flipped winding at wrist (cross aligns with +normal -> dot(oNrm) <= 0!)
  // Tri 2 (6..8): finger outline at x >= 0.66
  const oPos = new THREE.Float32BufferAttribute(
    [
      0.58, 1.25, -0.02 + 0.002,
      0.59, 1.28, 0.0 + 0.002,
      0.60, 1.25, 0.02 + 0.002,
      0.58, 1.25, -0.02 + 0.002,
      0.60, 1.25, 0.02 + 0.002,
      0.59, 1.28, 0.0 + 0.002,
      0.66, 1.25, -0.01 + 0.002,
      0.69, 1.27, 0.0 + 0.002,
      0.72, 1.25, 0.01 + 0.002,
    ],
    3,
  );
  const oNrm = new THREE.Float32BufferAttribute(
    [
      0, 0, -1,
      0, 0, -1,
      0, 0, -1,
      0, 0, -1,
      0, 0, -1,
      0, 0, -1,
      0, 0, -1,
      0, 0, -1,
      0, 0, -1,
    ],
    3,
  );
  const oSkinIdx = new THREE.Uint16BufferAttribute(
    [
      1, 0, 0, 0,
      1, 0, 0, 0,
      1, 0, 0, 0,
      1, 0, 0, 0,
      1, 0, 0, 0,
      1, 0, 0, 0,
      2, 0, 0, 0,
      2, 0, 0, 0,
      2, 0, 0, 0,
    ],
    4,
  );
  const oSkinWgt = new THREE.Float32BufferAttribute(new Float32Array(9 * 4).fill(0), 4);
  for (let i = 0; i < 9; i++) oSkinWgt.setX(i, 1);

  const oGeo = new THREE.BufferGeometry();
  oGeo.setAttribute('position', oPos);
  oGeo.setAttribute('normal', oNrm);
  oGeo.setAttribute('skinIndex', oSkinIdx);
  oGeo.setAttribute('skinWeight', oSkinWgt);
  oGeo.setIndex([0, 1, 2, 3, 4, 5, 6, 7, 8]);

  const handMesh = new THREE.SkinnedMesh(bGeo, new THREE.MeshBasicMaterial({ name: 'skin' }));
  handMesh.name = 'hands_skin_1';
  handMesh.bind(skeleton);

  const handOutline = new THREE.SkinnedMesh(oGeo, new THREE.MeshBasicMaterial({ name: 'skin_Outline' }));
  handOutline.name = 'hands_skin_Outline';
  handOutline.bind(skeleton);

  const res = sanitizeHandSkinAndOutlineMeshes(handMesh, handOutline);
  assert.equal(res.repairedBaseNormals, 1, 'Repairs inverted normal on fingertip crease');
  assert.equal(res.culledOutlineTris, 2, 'Culls both finger outline tri and flipped wrist outline tri');
  assert.equal(oGeo.getIndex()!.count, 3, 'Only the properly wound non-finger wrist outline triangle remains');
  assert.equal(countOutlineWindingMismatches(oGeo).inward, 0, 'Zero flipped outline triangles remain');
  assert.ok(
    oPos.getZ(0) <= 0.002 + HAND_OUTLINE_SUPPRESSION_PARAMS.maxOuterWristOutlineOffsetM,
    'Remaining wrist outline vertex offset is clamped safely',
  );
});

test('sanitizeEarSkinAndOutlineMeshes suppresses inner ear fold hulls & prevents double-tuck overshoot', () => {
  // Base ear sphere shell with one closed opposing wall vertex pair and open neck-attachment edge
  const bGeo = new THREE.SphereGeometry(0.015, 10, 8);
  const bPos = bGeo.getAttribute('position');
  const bNrm = bGeo.getAttribute('normal');
  const oGeo = bGeo.clone();
  const oPos = oGeo.getAttribute('position');
  const oNrm = oGeo.getAttribute('normal');
  const oIdx = oGeo.getIndex()!;
  const origArr = Array.from(oIdx.array);
  const flipped = [];
  for (let i = 0; i + 2 < origArr.length; i += 3) {
    flipped.push(origArr[i], origArr[i + 2], origArr[i + 1]);
  }
  oGeo.setIndex(flipped);

  // Inflate outline outward cleanly except inject thin-fold verts pushed deep inward and oversized outer verts
  for (let i = 0; i < oPos.count; i++) {
    const push = 0.003; // larger than maxOuterRimOffsetM (0.00065)
    oPos.setXYZ(
      i,
      bPos.getX(i) + bNrm.getX(i) * push,
      bPos.getY(i) + bNrm.getY(i) * push,
      bPos.getZ(i) + bNrm.getZ(i) * push,
    );
    oNrm.setXYZ(i, -bNrm.getX(i), -bNrm.getY(i), -bNrm.getZ(i));
  }

  const earMesh = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial());
  earMesh.name = 'ears_001_basic_1';
  const earOutline = new THREE.Mesh(oGeo, new THREE.MeshBasicMaterial());
  earOutline.name = 'ears_001_basic_Outline';

  sanitizeEarSkinAndOutlineMeshes(earMesh, earOutline);
  // Check remaining outline vertices do not overshoot past maxOuterRimOffsetM or double-tuck > -0.001m inside ear
  const pB = new THREE.Vector3();
  const pO = new THREE.Vector3();
  const nB = new THREE.Vector3();
  let maxGap = -Infinity;
  let minGap = Infinity;
  for (let i = 0; i < oPos.count; i++) {
    pB.fromBufferAttribute(bPos, i);
    pO.fromBufferAttribute(oPos, i);
    nB.fromBufferAttribute(bNrm, i).normalize();
    const gap = pO.sub(pB).dot(nB);
    if (gap > maxGap) maxGap = gap;
    if (gap < minGap) minGap = gap;
  }
  assert.ok(
    maxGap <= EAR_OUTLINE_PARAMS.maxOuterRimOffsetM + 1e-5,
    `Outer ear outline gap (${maxGap}) must stay clamped <= ${EAR_OUTLINE_PARAMS.maxOuterRimOffsetM}`,
  );
  assert.ok(
    minGap >= EAR_OUTLINE_PARAMS.boundaryInwardTuckM - 1e-4,
    `Inner/boundary ear verts (${minGap}) must not double-tuck far inside base ear`,
  );
});

test('sanitizeHeadSkinAndOutlineMeshes tucks zero-offset lip/eyelid seams behind head skin and clamps crown contour', () => {
  const bGeo = new THREE.SphereGeometry(0.11, 10, 8);
  const bPos = bGeo.getAttribute('position');
  const bNrm = bGeo.getAttribute('normal');
  const oGeo = bGeo.clone();
  const oPos = oGeo.getAttribute('position');
  const oNrm = oGeo.getAttribute('normal');
  const idx = Array.from(oGeo.getIndex()!.array);
  for (let i = 0; i + 2 < idx.length; i += 3) {
    [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  }
  oGeo.setIndex(idx);

  for (let i = 0; i < oPos.count; i++) {
    // Even verts: zero-offset facial feature seams; odd verts: oversized 3mm outline
    const gap = i % 2 === 0 ? 0.0 : 0.003;
    oPos.setXYZ(
      i,
      bPos.getX(i) + bNrm.getX(i) * gap,
      bPos.getY(i) + bNrm.getY(i) * gap,
      bPos.getZ(i) + bNrm.getZ(i) * gap,
    );
    oNrm.setXYZ(i, -bNrm.getX(i), -bNrm.getY(i), -bNrm.getZ(i));
  }

  const headMesh = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial());
  headMesh.name = 'head_102_triangle_1';
  const headOutline = new THREE.Mesh(oGeo, new THREE.MeshBasicMaterial());
  headOutline.name = 'head_102_triangle_Outline';

  sanitizeHeadSkinAndOutlineMeshes(headMesh, headOutline);

  const pB = new THREE.Vector3();
  const pO = new THREE.Vector3();
  const nB = new THREE.Vector3();
  for (let i = 0; i < oPos.count; i++) {
    pB.fromBufferAttribute(bPos, i);
    pO.fromBufferAttribute(oPos, i);
    nB.fromBufferAttribute(bNrm, i).normalize();
    const gap = pO.sub(pB).dot(nB);
    if (i % 2 === 0) {
      assert.ok(
        Math.abs(gap - HEAD_OUTLINE_PARAMS.featureInwardTuckM) < 1e-4,
        `Zero-offset facial seam vertex ${i} tucks safely behind skin (${gap})`,
      );
    } else {
      assert.ok(
        gap <= HEAD_OUTLINE_PARAMS.maxHeadOutlineOffsetM + 1e-5,
        `Outer head contour vertex ${i} clamps <= ${HEAD_OUTLINE_PARAMS.maxHeadOutlineOffsetM}`,
      );
    }
  }
});

test('weldHandToTorsoWristSeams closes open wrist gaps and assigns 50/50 ForeArm-Hand weights for _skin_1 variants', () => {
  const bones = createHandSkeleton(['LeftForeArm', 'LeftHand']);
  const inv = bones.map((b) => new THREE.Matrix4().copy(b.matrixWorld).invert());
  const skel = new THREE.Skeleton(bones, inv);

  // Two open triangles separated by a 5mm gap at the wrist (x=0.600 vs x=0.605)
  const hGeo = new THREE.BufferGeometry();
  hGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0.605, 1.25, -0.02, 0.605, 1.25, 0.02, 0.64, 1.25, 0], 3),
  );
  hGeo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  hGeo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  hGeo.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  hGeo.setIndex([0, 1, 2]);

  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0.600, 1.25, -0.02, 0.600, 1.25, 0.02, 0.56, 1.25, 0], 3),
  );
  tGeo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  tGeo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4));
  tGeo.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  tGeo.setIndex([0, 2, 1]);

  const handMesh = new THREE.SkinnedMesh(hGeo, new THREE.MeshBasicMaterial());
  handMesh.name = 'hands_skin_1';
  handMesh.bind(skel);
  const torsoMesh = new THREE.SkinnedMesh(tGeo, new THREE.MeshBasicMaterial());
  torsoMesh.name = 'torso_base_skin_1';
  torsoMesh.bind(skel);

  const map = new Map<string, THREE.Mesh[]>([
    ['hands_skin_1', [handMesh]],
    ['hands_skin', [handMesh]],
    ['torso_base_skin_1', [torsoMesh]],
    ['torso_base_skin', [torsoMesh]],
  ]);

  const welded = weldHandToTorsoWristSeams(handMesh, null, [torsoMesh], map);
  assert.equal(welded, 4, 'Welds both hand + torso vertices along the shared wrist seam');

  const hp = hGeo.getAttribute('position');
  const tp = tGeo.getAttribute('position');
  assert.ok(Math.abs(hp.getX(0) - tp.getX(0)) < 1e-6, 'Wrist seam X meets at exact midpoint (0.6025)');
  assert.ok(Math.abs(hp.getX(0) - 0.6025) < 1e-6);

  const hw = hGeo.getAttribute('skinWeight');
  const tw = tGeo.getAttribute('skinWeight');
  assert.ok(Math.abs(hw.getX(0) + hw.getY(0) - 1.0) < 1e-4);
  assert.ok(Math.abs(hw.getX(0) - 0.502) < 0.01 && Math.abs(tw.getY(0) - 0.498) < 0.01);
});

test('normalizeAllSkeletonMeshWeights clamps out-of-bounds joints, fixes zero-weight verts, and re-normalizes sums to 1', () => {
  const bones = createHandSkeleton(['Hips', 'Spine']);
  const inv = bones.map((b) => new THREE.Matrix4().copy(b.matrixWorld).invert());
  const skel = new THREE.Skeleton(bones, inv);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 1, 0, 0, 99, 0, 0, 0, 0, 0, 0, 0], 4));
  geo.setAttribute(
    'skinWeight',
    new THREE.Float32BufferAttribute([0.6, 0.2, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], 4),
  );
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
  mesh.bind(skel);

  const root = new THREE.Group();
  root.add(bones[0], mesh);
  const fixed = normalizeAllSkeletonMeshWeights(root);
  assert.equal(fixed, 3);

  const wgt = geo.getAttribute('skinWeight');
  for (let i = 0; i < 3; i++) {
    const sum = wgt.getX(i) + wgt.getY(i) + wgt.getZ(i) + wgt.getW(i);
    assert.ok(Math.abs(sum - 1.0) < 1e-4, `Vertex ${i} weights must sum to 1 (got ${sum})`);
  }
  assert.equal(normalizeAllSkeletonMeshWeights(root), 0, 'Idempotent on second pass');
});

test('computeStandardizedAvatarRigMetrics & computeStandardizedGroundRootY ignore hair height variance and outline sole overhang', () => {
  const buildRigWithHairAndOutline = (hairTopY: number, outlineSoleMinY: number) => {
    const root = new THREE.Group();
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.2), new THREE.MeshBasicMaterial());
    head.geometry.translate(0, 1.465, 0); // skull crown at 1.585
    head.name = 'head_102_triangle_1';

    const feet = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.22), new THREE.MeshBasicMaterial());
    feet.geometry.translate(0, 0.05, 0); // real footwear sole at 0.0
    feet.name = 'feet_base';

    const hair = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, Math.max(0.05, hairTopY - 1.45), 0.22),
      new THREE.MeshBasicMaterial(),
    );
    hair.geometry.translate(0, 1.45 + (hairTopY - 1.45) * 0.5, 0);
    hair.name = 'hair_spiky';

    const soleOutline = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.24), new THREE.MeshBasicMaterial());
    soleOutline.geometry.translate(0, outlineSoleMinY + 0.03, 0);
    soleOutline.name = 'legs_frontrow_Outline';

    root.add(head, feet, hair, soleOutline);
    return root;
  };

  const smoothBobRig = buildRigWithHairAndOutline(1.60, 0.0);
  const spikyMaleRig = buildRigWithHairAndOutline(1.72, -0.025);

  const mA = computeStandardizedAvatarRigMetrics(smoothBobRig);
  const mB = computeStandardizedAvatarRigMetrics(spikyMaleRig);

  assert.equal(mA.usedSkullNormalization, true);
  assert.equal(mB.usedSkullNormalization, true);
  assert.ok(
    Math.abs(mA.unifiedModelScale - mB.unifiedModelScale) < 1e-6,
    `Tall spiky hair must not shrink character scale (${mA.unifiedModelScale} vs ${mB.unifiedModelScale})`,
  );
  assert.ok(Math.abs(mA.skullHeightRaw * mA.unifiedModelScale - STANDARD_AVATAR_SKULL_CROWN_HEIGHT_M) < 1e-5);

  const rootYA = computeStandardizedGroundRootY(smoothBobRig);
  const rootYB = computeStandardizedGroundRootY(spikyMaleRig);
  assert.ok(Math.abs(rootYA) < 1e-5 && Math.abs(rootYB) < 1e-5, 'Overhanging outline sole does not float avatar off ground');
});

test('applyUnderlyingSkinCullingAndOffsetRules culls covered interior torso skin and insets poking rim vertices while keeping neck/exposed skin intact', () => {
  const root = new THREE.Group();

  // Base torso box (x: -0.11..0.11, y: 0.88..1.35, z: -0.09..0.09)
  // Includes deep covered torso section (y: 0.96..1.24), poking mid-chest ring, and exposed neck collar (y > 1.325)
  const skinGeo = new THREE.BoxGeometry(0.22, 0.47, 0.18, 4, 12, 4);
  skinGeo.translate(0, 1.115, 0); // y: 0.88..1.35
  const sPos = skinGeo.getAttribute('position');
  const sNrm = skinGeo.getAttribute('normal');
  // Force front-face (+Z normal) vertices around y ~ 1.00 to poke outside front cloth z=+0.102 along their outward normal
  for (let i = 0; i < sPos.count; i++) {
    const y = sPos.getY(i);
    const z = sPos.getZ(i);
    if (z > 0.08 && sNrm.getZ(i) > 0.5 && y >= 0.94 && y <= 1.02) {
      sPos.setZ(i, 0.106); // poking outside shirt z=+0.102
    }
  }
  const torsoSkin = new THREE.Mesh(skinGeo, new THREE.MeshBasicMaterial());
  torsoSkin.name = 'torso_base_skin_1';

  // Larger shirt covering y: 0.94..1.27, x: -0.13..0.13, z: -0.102..0.102
  const shirtGeo = new THREE.BoxGeometry(0.26, 0.33, 0.204);
  shirtGeo.translate(0, 1.105, 0);
  const shirtMesh = new THREE.Mesh(shirtGeo, new THREE.MeshBasicMaterial());
  shirtMesh.name = 'torso_shirt_base';

  root.add(torsoSkin, shirtMesh);
  const initialTris = skinGeo.getIndex()!.count / 3;

  const { culledTris, insetVerts } = applyUnderlyingSkinCullingAndOffsetRules(root);
  assert.ok(culledTris > 0, `Deeply covered torso skin tris culled (${culledTris})`);
  assert.ok(insetVerts > 0, `Near-hem / poking torso skin vertices inset inward (${insetVerts})`);
  assert.ok(skinGeo.getIndex()!.count / 3 < initialTris);

  // Verify exposed upper neck collar verts remain intact at y >= 1.325
  let maxRemainingY = -Infinity;
  const idx = skinGeo.getIndex()!;
  for (let t = 0; t < idx.count; t++) {
    const vi = idx.getX(t);
    const y = sPos.getY(vi);
    if (y > maxRemainingY) maxRemainingY = y;
  }
  assert.ok(maxRemainingY >= 1.325, `Exposed upper neck skin preserved (maxRemainingY=${maxRemainingY})`);

  // Verify previously poking vertices at z=0.106 were pulled inside shirt (< 0.1045)
  for (let i = 0; i < sPos.count; i++) {
    const y = sPos.getY(i);
    if (y >= 0.95 && y <= 1.26 && sPos.getZ(i) > 0.08) {
      assert.ok(sPos.getZ(i) <= 0.1045, `Poking vertex at y=${y.toFixed(3)} was inset to z=${sPos.getZ(i).toFixed(4)}`);
    }
  }
});

test('All 6 character base GLBs pass complete anatomy, hand/ear/head outline, wrist weld, scale & under-clothing skin sanitization', async () => {
  const scaledSkullHeights: number[] = [];
  let wristWeldedGlbCount = 0;

  for (const cfg of REAL_CHARACTER_GLB_CASES) {
    const gltf = await parseRealGlbInNode(cfg.relPath);
    const report = sanitizeAvatarAnatomyAndSkinSeams(gltf.scene);

    if (cfg.expectSkinOutlineCulled) {
      assert.ok(
        report.culledHandOutlineTris > 0,
        `${cfg.id}: hands_skin_Outline finger/web/flipped hulls must be culled (culled=${report.culledHandOutlineTris})`,
      );
      assert.ok(
        report.culledEarOutlineTris > 0,
        `${cfg.id}: ears_*_Outline inner-fold/flipped hulls must be culled (culled=${report.culledEarOutlineTris})`,
      );
    }

    // Verify per-mesh invariants directly on mutated real GLB buffers
    const meshesByRole = new Map<string, THREE.Mesh>();
    gltf.scene.traverse((node) => {
      if (!(node as THREE.Mesh).isMesh) return;
      const m = node as THREE.Mesh;
      const role = classifyAvatarMeshRole(m.name);
      if (!meshesByRole.has(role)) {
        meshesByRole.set(role, m);
      }
    });

    const handsMesh = meshesByRole.get('hands_skin') ?? null;
    const torsoSkinMesh = meshesByRole.get('torso_skin') ?? null;
    const handsOutMesh = meshesByRole.get('hands_outline') ?? null;
    const earsOutMesh = meshesByRole.get('ears_outline') ?? null;
    const headOutMesh = meshesByRole.get('head_outline') ?? null;

    if (torsoSkinMesh) {
      const tPos = torsoSkinMesh.geometry.getAttribute('position');
      let maxAbsX = 0;
      for (let i = 0; tPos && i < tPos.count; i++) {
        const ax = Math.abs(tPos.getX(i));
        if (ax > maxAbsX) maxAbsX = ax;
      }
      if (maxAbsX >= 0.54) {
        assert.ok(
          report.wristWeldedVerts > 0,
          `${cfg.id}: bare-wrist _skin_1 seams must weld cleanly (maxAbsX=${maxAbsX.toFixed(3)}, welded=${report.wristWeldedVerts})`,
        );
      }
    }
    if (report.wristWeldedVerts > 0) wristWeldedGlbCount++;

    assert.ok(handsMesh, `${cfg.id}: must have hands_skin mesh`);
    assert.ok(handsOutMesh, `${cfg.id}: must have hands_skin_Outline mesh`);
    assert.ok(earsOutMesh, `${cfg.id}: must have ears_*_Outline mesh`);
    assert.ok(headOutMesh, `${cfg.id}: must have head_*_Outline mesh`);

    // 1. Zero flipped outward-facing triangles on any skin outline mesh
    assert.equal(
      countOutlineWindingMismatches(handsOutMesh.geometry).inward,
      0,
      `${cfg.id}: zero flipped triangles on hands_skin_Outline`,
    );
    assert.equal(
      countOutlineWindingMismatches(earsOutMesh.geometry).inward,
      0,
      `${cfg.id}: zero flipped triangles on ears_*_Outline`,
    );
    assert.equal(
      countOutlineWindingMismatches(headOutMesh.geometry).inward,
      0,
      `${cfg.id}: zero flipped triangles on head_*_Outline`,
    );

    // 2. Zero dark hand outline triangles covering digits/inter-finger webs (|x| >= fingerStartAbsX)
    const hoPos = handsOutMesh.geometry.getAttribute('position');
    const hoIdx = handsOutMesh.geometry.getIndex()!;
    let remainingDigitTris = 0;
    for (let t = 0; t + 2 < hoIdx.count; t += 3) {
      const x0 = Math.abs(hoPos.getX(hoIdx.getX(t)));
      const x1 = Math.abs(hoPos.getX(hoIdx.getX(t + 1)));
      const x2 = Math.abs(hoPos.getX(hoIdx.getX(t + 2)));
      if (Math.max(x0, x1, x2) >= HAND_OUTLINE_SUPPRESSION_PARAMS.fingerStartAbsX + 0.002) {
        remainingDigitTris++;
      }
    }
    assert.equal(
      remainingDigitTris,
      0,
      `${cfg.id}: hands_skin_Outline must have zero finger-zone triangles blotching digits`,
    );

    // 3. Re-running weight normalization finds 0 unnormalized weights
    assert.equal(
      normalizeAllSkeletonMeshWeights(gltf.scene),
      0,
      `${cfg.id}: all skeleton bone weights normalized after sanitization`,
    );

    // 4. Standardized proportions & ground sole check
    const metrics = computeStandardizedAvatarRigMetrics(gltf.scene);
    assert.equal(metrics.usedSkullNormalization, true, `${cfg.id}: uses skull-crown height normalization`);
    scaledSkullHeights.push(metrics.skullHeightRaw * metrics.unifiedModelScale);

    if (torsoSkinMesh) {
      // Covered under-clothing skin culling ran across outfit-bearing GLBs
      assert.ok(
        report.culledCoveredSkinTris > 0 || report.insetSkinVerts > 0,
        `${cfg.id}: underlying skin rules processed outfit coverage (culled=${report.culledCoveredSkinTris}, inset=${report.insetSkinVerts})`,
      );
    }

    // 5. End-to-end rig upgrade verifies shader material tags + ground rootY on real GLB
    const rig = createMinimalBuddyRig(new THREE.Group());
    upgradeBuddyRigWithCharBuddiesGlb(rig, gltf);
    assert.ok(rig.customGlbController?.glbRoot, `${cfg.id}: upgradeBuddyRigWithCharBuddiesGlb mounted rig`);

    let sawBodySkinShader = false;
    let sawSkinOutlineShader = false;
    let sawHeadShader = false;
    rig.customGlbController!.glbRoot!.traverse((node) => {
      if (!(node as THREE.Mesh).isMesh) return;
      const m = node as THREE.Mesh;
      const mat = Array.isArray(m.material) ? m.material[0] : m.material;
      const key = mat?.customProgramCacheKey?.() ?? '';
      const role = classifyAvatarMeshRole(m.name);
      if (role === 'hands_skin') {
        assert.equal(key, 'blitz-stylized-player-bodyskin-v9', `${cfg.id}: hands_skin_1 uses body-skin forehead sampler`);
        const fakeShader = {
          uniforms: {},
          vertexShader: '#include <common>\n#include <project_vertex>',
          fragmentShader: '#include <common>\n#include <map_fragment>\n#include <opaque_fragment>',
        };
        mat.onBeforeCompile(fakeShader as never, null as never);
        assert.ok(fakeShader.fragmentShader.includes('vec2( 0.785, 0.28 )'));
        assert.ok(fakeShader.fragmentShader.includes('foreheadValid'));
        sawBodySkinShader = true;
      } else if (role === 'hands_outline') {
        assert.equal(key, 'blitz-stylized-player-skin-outline-v3', `${cfg.id}: hands_skin_Outline uses thin skin outline profile`);
        assert.equal(mat.polygonOffset, true);
        assert.equal(mat.polygonOffsetFactor, ANATOMICAL_SKIN_SHADER_PARAMS.skinOutlinePolygonOffsetFactor);
        const fakeShader = {
          uniforms: {},
          vertexShader: '#include <begin_vertex>',
          fragmentShader: '',
        };
        mat.onBeforeCompile(fakeShader as never, null as never);
        assert.ok(
          fakeShader.vertexShader.includes(
            `transformed += normal * ${ANATOMICAL_SKIN_SHADER_PARAMS.skinOutlineNormalOffsetM.toFixed(5)};`,
          ),
        );
        sawSkinOutlineShader = true;
      } else if (role === 'head') {
        assert.equal(key, 'blitz-stylized-player-skin-v9', `${cfg.id}: head uses detailed facial texture sampler`);
        sawHeadShader = true;
      }
    });
    assert.ok(sawBodySkinShader && sawSkinOutlineShader && sawHeadShader, `${cfg.id}: verified shader cache profiles`);

    const expectedBindBaseRootY = -metrics.nonOutlineMinY * metrics.unifiedModelScale;
    assert.ok(
      Math.abs(rig.customGlbController!.baseRootY - expectedBindBaseRootY) < 0.0005,
      `${cfg.id}: baseRootY matches standardized non-outline sole ground (${rig.customGlbController!.baseRootY} vs ${expectedBindBaseRootY})`,
    );
    if (!cfg.relPath.includes('_sit_')) {
      assert.ok(
        Math.abs(rig.customGlbController!.glbRoot!.position.y - expectedBindBaseRootY) < 0.025,
        `${cfg.id}: initial idle frame foot-compensated glbRoot.position.y stays grounded (${rig.customGlbController!.glbRoot!.position.y})`,
      );
    }
    if (cfg.id === 'ambientFemale') {
      const fullBox = new THREE.Box3().setFromObject(gltf.scene);
      assert.ok(
        fullBox.min.y < metrics.nonOutlineMinY - 0.002,
        `ambientFemale outline bottom overhang (${fullBox.min.y}) is excluded from nonOutlineMinY (${metrics.nonOutlineMinY})`,
      );
    }
  }

  assert.ok(
    wristWeldedGlbCount >= 2,
    `Bare-wrist character archetypes weld _skin_1 wrist seams cleanly (weldedGlbs=${wristWeldedGlbCount})`,
  );
  // Cross-archetype proportion check: every male/female avatar scales to the exact standardized skull crown height
  const minScaledSkull = Math.min(...scaledSkullHeights);
  const maxScaledSkull = Math.max(...scaledSkullHeights);
  assert.ok(
    maxScaledSkull - minScaledSkull < 0.02,
    `All 6 avatars standardize to uniform anatomical skull height (spread=${(maxScaledSkull - minScaledSkull).toFixed(4)}m)`,
  );
});

test('applyUnderlyingSkinCullingAndOffsetRules preserves bare thigh skin above Female garter straps', async () => {
  const femGltf = await parseRealGlbInNode(
    'public/assets/character_custom_idle_runway_catwalk_stylish_11 (3).glb',
  );
  const legSkinMesh = femGltf.scene.getObjectByName(
    'legs_delirioussquidalternative1fpbr_skin_1',
  ) as THREE.Mesh;
  assert.ok(legSkinMesh, 'Expected base Female legs_skin_1 mesh');
  const triCountBefore = (legSkinMesh.geometry.getIndex()?.count ?? 0) / 3;
  applyUnderlyingSkinCullingAndOffsetRules(femGltf.scene);
  const triCountAfter = (legSkinMesh.geometry.getIndex()?.count ?? 0) / 3;
  assert.equal(
    triCountAfter,
    triCountBefore,
    `Exposed bare thigh skin above thigh garter must keep all ${triCountBefore} triangles (got ${triCountAfter})`,
  );
});
