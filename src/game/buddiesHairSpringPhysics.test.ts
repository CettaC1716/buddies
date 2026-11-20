import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  buildAnatomicalCharacterColliders,
  buildSecondaryVertexInjection,
  buildTorsoBindCollisionEnvelope,
  computeRigAnatomyMetrics,
  createCharacterSecondaryPhysicsController,
  resolveSecondaryPhysicsLod,
  SpringBoneColliderCapsule,
  SpringBoneColliderSphere,
  type Vrm1SpringBoneExtension,
  type VrmSecondaryAnimationMetadata,
} from './buddiesHairSpringPhysics';
import { matchOutlineToBaseVertices } from './buddiesAvatarAnatomyRules';
import {
  applyEquippedApparelSlotToBuddyRig,
  applyEquippedTorsoToBuddyRig,
  upgradeBuddyRigWithCharBuddiesGlb,
  type BuddyCharacterRig,
} from './buddiesBlitzShadersAndAssets';

function createHumanoidSpringRig(options?: {
  withHairChain?: boolean;
  withSkirtChain?: boolean;
  withSidePonytail?: boolean;
  hairRestDir?: THREE.Vector3;
  pelvisPreRotated?: boolean;
}) {
  const root = new THREE.Group();
  root.name = 'RigRoot';

  const hips = new THREE.Bone();
  hips.name = options?.pelvisPreRotated ? 'Hip' : 'Hips';
  hips.position.set(0, 0.84, 0);

  const spine = new THREE.Bone();
  spine.name = 'Spine';
  spine.position.set(0, 0.14, 0);

  const spine2 = new THREE.Bone();
  spine2.name = options?.pelvisPreRotated ? 'Spine02' : 'Spine2';
  spine2.position.set(0, 0.16, 0);

  const neck = new THREE.Bone();
  neck.name = 'Neck';
  neck.position.set(0, 0.18, 0);

  const head = new THREE.Bone();
  head.name = 'Head';
  head.position.set(0, 0.08, 0);
  if (options?.pelvisPreRotated) {
    // Replicate PelvisRoot GLB Head pre-rotation (swaps local +X <-> +Y)
    head.quaternion.set(0.707, 0.707, 0.022, -0.022).normalize();
  }

  const leftShoulder = new THREE.Bone();
  leftShoulder.name = 'LeftShoulder';
  leftShoulder.position.set(0.05, 0.12, 0);

  const leftArm = new THREE.Bone();
  leftArm.name = 'LeftArm';
  leftArm.position.set(0.10, 0, -0.02);

  const rightShoulder = new THREE.Bone();
  rightShoulder.name = 'RightShoulder';
  rightShoulder.position.set(-0.05, 0.12, 0);

  const rightArm = new THREE.Bone();
  rightArm.name = 'RightArm';
  rightArm.position.set(-0.10, 0, -0.02);

  root.add(hips);
  hips.add(spine);
  spine.add(spine2);
  spine2.add(neck, leftShoulder, rightShoulder);
  neck.add(head);
  leftShoulder.add(leftArm);
  rightShoulder.add(rightArm);

  const hairBones: THREE.Bone[] = [];
  if (options?.withHairChain !== false) {
    const dir = (options?.hairRestDir ?? new THREE.Vector3(0, -0.6, -0.8)).clone().normalize();
    const h1 = new THREE.Bone();
    h1.name = 'Hair_Back_01';
    h1.position.set(0, 0.08, -0.09);
    const h2 = new THREE.Bone();
    h2.name = 'Hair_Back_02';
    h2.position.copy(dir).multiplyScalar(0.14);
    const h3 = new THREE.Bone();
    h3.name = 'Hair_Back_03';
    h3.position.copy(dir).multiplyScalar(0.14);
    head.add(h1);
    h1.add(h2);
    h2.add(h3);
    hairBones.push(h1, h2, h3);
  }

  const sideBones: THREE.Bone[] = [];
  if (options?.withSidePonytail) {
    const p1 = new THREE.Bone();
    p1.name = 'Ponytail_L_01';
    p1.position.set(0.08, 0.02, -0.04);
    const p2 = new THREE.Bone();
    p2.name = 'Ponytail_L_02';
    p2.position.set(0.04, -0.15, -0.02);
    const p3 = new THREE.Bone();
    p3.name = 'Ponytail_L_03';
    p3.position.set(0.02, -0.15, 0);
    head.add(p1);
    p1.add(p2);
    p2.add(p3);
    sideBones.push(p1, p2, p3);
  }

  const skirtBones: THREE.Bone[] = [];
  if (options?.withSkirtChain) {
    const s1 = new THREE.Bone();
    s1.name = 'Skirt_Front_01';
    s1.position.set(0, -0.02, 0.11);
    const s2 = new THREE.Bone();
    s2.name = 'Skirt_Front_02';
    s2.position.set(0, -0.14, 0.02);
    hips.add(s1);
    s1.add(s2);
    skirtBones.push(s1, s2);
  }

  root.updateMatrixWorld(true);
  return {
    root,
    hips,
    spine,
    spine2,
    neck,
    head,
    leftShoulder,
    leftArm,
    rightShoulder,
    rightArm,
    hairBones,
    sideBones,
    skirtBones,
  };
}

let cachedNodeDracoModule: unknown = null;

async function loadRealGlbInNode(filePath: string): Promise<GLTF> {
  const g = globalThis as Record<string, unknown>;
  g.self ??= globalThis;
  g.createImageBitmap ??= async () => ({ width: 2, height: 2, close() {} });

  if (!cachedNodeDracoModule) {
    const dracoJs = fs.readFileSync(path.resolve('public/draco/draco_decoder.js'), 'utf8');
    const mod: { exports: unknown } = { exports: {} };
    const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', dracoJs);
    fn(
      mod.exports,
      createRequire(import.meta.url),
      mod,
      path.resolve('public/draco/draco_decoder.js'),
      path.resolve('public/draco'),
    );
    const factory = mod.exports as (opts: { wasmBinary: Buffer }) => Promise<unknown>;
    cachedNodeDracoModule = await factory({
      wasmBinary: fs.readFileSync(path.resolve('public/draco/draco_decoder.wasm')),
    });
  }

  const dm = cachedNodeDracoModule as {
    Decoder: new () => {
      GetEncodedGeometryType: (b: unknown) => number;
      DecodeBufferToMesh: (b: unknown, m: unknown) => void;
      DecodeBufferToPointCloud: (b: unknown, p: unknown) => void;
      GetAttributeByUniqueId: (g: unknown, id: number) => { num_components: () => number } | null;
      GetAttributeFloatForAllPoints: (g: unknown, a: unknown, p: unknown) => void;
      GetAttributeUInt16ForAllPoints: (g: unknown, a: unknown, p: unknown) => void;
      GetAttributeUInt8ForAllPoints: (g: unknown, a: unknown, p: unknown) => void;
      GetFaceFromMesh: (g: unknown, idx: number, ia: unknown) => void;
    };
    DecoderBuffer: new () => { Init: (arr: Int8Array, len: number) => void };
    Mesh: new () => { num_points: () => number; num_faces: () => number };
    PointCloud: new () => { num_points: () => number; num_faces: () => number };
    DracoFloat32Array: new () => { GetValue: (i: number) => number };
    DracoUInt16Array: new () => { GetValue: (i: number) => number };
    DracoUInt8Array: new () => { GetValue: (i: number) => number };
    DracoInt32Array: new () => { GetValue: (i: number) => number };
    TRIANGULAR_MESH: number;
    destroy: (obj: unknown) => void;
  };

  const dracoLoader = {
    preload() {},
    dispose() {},
    decodeDracoFile(
      buffer: ArrayBuffer,
      callback: (geom: THREE.BufferGeometry) => void,
      attributeIDs: Record<string, number>,
      attributeTypes: Record<string, string>,
    ) {
      const decoder = new dm.Decoder();
      const dracoBuffer = new dm.DecoderBuffer();
      dracoBuffer.Init(new Int8Array(buffer), buffer.byteLength);
      const geomType = decoder.GetEncodedGeometryType(dracoBuffer);
      const isMesh = geomType === dm.TRIANGULAR_MESH;
      const dracoGeom = isMesh ? new dm.Mesh() : new dm.PointCloud();
      if (isMesh) decoder.DecodeBufferToMesh(dracoBuffer, dracoGeom);
      else decoder.DecodeBufferToPointCloud(dracoBuffer, dracoGeom);

      const geometry = new THREE.BufferGeometry();
      const numPoints = dracoGeom.num_points();
      for (const attrName of Object.keys(attributeIDs)) {
        const attr = decoder.GetAttributeByUniqueId(dracoGeom, attributeIDs[attrName]);
        if (!attr) continue;
        const numComp = attr.num_components();
        const numValues = numPoints * numComp;
        const typeName = attributeTypes[attrName];
        if (typeName === 'Float32Array') {
          const ptr = new dm.DracoFloat32Array();
          decoder.GetAttributeFloatForAllPoints(dracoGeom, attr, ptr);
          const arr = new Float32Array(numValues);
          for (let i = 0; i < numValues; i++) arr[i] = ptr.GetValue(i);
          dm.destroy(ptr);
          geometry.setAttribute(attrName, new THREE.BufferAttribute(arr, numComp));
        } else if (typeName === 'Uint16Array') {
          const ptr = new dm.DracoUInt16Array();
          decoder.GetAttributeUInt16ForAllPoints(dracoGeom, attr, ptr);
          const arr = new Uint16Array(numValues);
          for (let i = 0; i < numValues; i++) arr[i] = ptr.GetValue(i);
          dm.destroy(ptr);
          geometry.setAttribute(attrName, new THREE.BufferAttribute(arr, numComp));
        } else if (typeName === 'Uint8Array') {
          const ptr = new dm.DracoUInt8Array();
          decoder.GetAttributeUInt8ForAllPoints(dracoGeom, attr, ptr);
          const arr = new Uint8Array(numValues);
          for (let i = 0; i < numValues; i++) arr[i] = ptr.GetValue(i);
          dm.destroy(ptr);
          geometry.setAttribute(
            attrName,
            new THREE.BufferAttribute(arr, numComp, attrName === 'skinWeight' || attrName === 'color'),
          );
        }
      }
      if (isMesh) {
        const numFaces = dracoGeom.num_faces();
        const ia = new dm.DracoInt32Array();
        const indices = new Uint32Array(numFaces * 3);
        for (let i = 0; i < numFaces; i++) {
          decoder.GetFaceFromMesh(dracoGeom, i, ia);
          indices[i * 3] = ia.GetValue(0);
          indices[i * 3 + 1] = ia.GetValue(1);
          indices[i * 3 + 2] = ia.GetValue(2);
        }
        dm.destroy(ia);
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      }
      dm.destroy(dracoGeom);
      dm.destroy(decoder);
      dm.destroy(dracoBuffer);
      callback(geometry);
    },
  };

  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader as unknown as never);
  const buf = fs.readFileSync(path.resolve(filePath));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return loader.parseAsync(ab, '');
}

test('Verlet spring-bone chains respond to gravity, stiffness, wind, world velocity, angular yaw, and reset()', () => {
  const rigSoft = createHumanoidSpringRig({
    withHairChain: true,
    withSkirtChain: true,
    withSidePonytail: true,
    hairRestDir: new THREE.Vector3(0, 0, -1),
  });
  const rigStiff = createHumanoidSpringRig({
    withHairChain: true,
    hairRestDir: new THREE.Vector3(0, 0, -1),
  });

  const ctrlSoft = createCharacterSecondaryPhysicsController(rigSoft.root, {
    stiffnessForce: 0.45,
    gravityPower: 1.2,
    dragForce: 0.3,
  });
  const ctrlStiff = createCharacterSecondaryPhysicsController(rigStiff.root, {
    stiffnessForce: 3.6,
    gravityPower: 1.2,
    dragForce: 0.3,
  });

  assert.equal(ctrlSoft.metrics.boneChains, 3, 'Hair + side ponytail + skirt chains discovered');
  assert.ok(ctrlSoft.metrics.colliders >= 7, 'Anatomical colliders auto-built');

  const restTipSoft = new THREE.Vector3();
  rigSoft.hairBones[2].getWorldPosition(restTipSoft);
  const restTipStiff = new THREE.Vector3();
  rigStiff.hairBones[2].getWorldPosition(restTipStiff);

  for (let i = 0; i < 45; i++) {
    ctrlSoft.update(1 / 60);
    ctrlStiff.update(1 / 60);
  }

  const gravityTipSoft = new THREE.Vector3();
  rigSoft.hairBones[2].getWorldPosition(gravityTipSoft);
  const gravityTipStiff = new THREE.Vector3();
  rigStiff.hairBones[2].getWorldPosition(gravityTipStiff);

  assert.ok(gravityTipSoft.y < restTipSoft.y - 0.02, 'Gravity sags horizontal hair chain downward');
  assert.ok(
    restTipSoft.y - gravityTipSoft.y > restTipStiff.y - gravityTipStiff.y,
    'Higher stiffness resists gravity sag more strongly',
  );

  // Wind along +X pushes side ponytail outward in +X
  const preWindSidePos = new THREE.Vector3();
  rigSoft.sideBones[2].getWorldPosition(preWindSidePos);
  for (let i = 0; i < 30; i++) {
    ctrlSoft.update(1 / 60, { windX: 12, windZ: 0 });
  }
  const postWindSidePos = new THREE.Vector3();
  rigSoft.sideBones[2].getWorldPosition(postWindSidePos);
  assert.ok(postWindSidePos.x > preWindSidePos.x + 0.03, 'Wind +X deflects hanging ponytail in +X');

  // Forward velocity (+Z) pushes skirt/ponytail backward (-Z)
  ctrlSoft.reset();
  const postResetPos = new THREE.Vector3();
  rigSoft.hairBones[2].getWorldPosition(postResetPos);
  assert.ok(
    postResetPos.distanceTo(restTipSoft) < 1e-4,
    'reset() snaps bone chains cleanly back to initial rest pose',
  );

  for (let i = 0; i < 30; i++) {
    ctrlSoft.update(1 / 60, { worldVelocity: { x: 0, y: 0, z: 12 }, angularYawRate: 5.5 });
  }
  const postRunSidePos = new THREE.Vector3();
  rigSoft.sideBones[2].getWorldPosition(postRunSidePos);
  assert.ok(postRunSidePos.z < -0.05, 'Running +Z velocity trails ponytail backward in -Z');

  ctrlSoft.dispose();
  ctrlStiff.dispose();
});

test('SpringBoneColliderSphere & SpringBoneColliderCapsule push hair out without clipping, including pre-rotated PelvisRoot skeletons', () => {
  // 1. Direct unit geometry pushout for sphere & capsule
  const anchor = new THREE.Group();
  anchor.position.set(1, 2, 3);
  anchor.scale.setScalar(2);
  anchor.updateMatrixWorld(true);

  const sphere = new SpringBoneColliderSphere(anchor, new THREE.Vector3(0, 0, 0), 0.25, 'test_sphere');
  sphere.updateWorldTransform();
  const probe = new THREE.Vector3(1.1, 2.0, 3.0);
  const hitSphere = sphere.resolveCollision(probe, 0.05);
  assert.equal(hitSphere, true);
  assert.ok(
    probe.distanceTo(sphere.worldCenter) >= 0.25 * 2 + 0.05 - 1e-4,
    'Sphere collider pushes point outside scaled radius + hitRadius',
  );

  const capsule = new SpringBoneColliderCapsule(
    anchor,
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0, 0),
    0.15,
    'test_capsule',
  );
  capsule.updateWorldTransform();
  const capProbe = new THREE.Vector3(2.0, 2.05, 3.0);
  const hitCap = capsule.resolveCollision(capProbe, 0.05);
  assert.equal(hitCap, true);
  assert.ok(
    Math.hypot(capProbe.y - 2.0, capProbe.z - 3.0) >= 0.15 * 2 + 0.05 - 1e-4,
    'Capsule collider pushes point radially outside scaled capsule radius + hitRadius',
  );

  // 2. Full solver pushout on pre-rotated PelvisRoot rig:
  //    Even under strong +Z wind blowing hair forward into the head/neck/shoulder, hair stays outside colliders
  const rig = createHumanoidSpringRig({
    withHairChain: true,
    withSidePonytail: true,
    pelvisPreRotated: true,
    hairRestDir: new THREE.Vector3(0, -0.95, -0.31),
  });
  // Place a hanging side strand near the left shoulder so wind pushes it over the shoulder capsule
  rig.sideBones[0].position.set(-0.08, -0.02, 0.02); // remember Head is pre-rotated in PelvisRoot!
  rig.root.updateMatrixWorld(true);

  const colliders = buildAnatomicalCharacterColliders(rig.root);
  const headSphere = colliders.find((c) => c.anchorName === 'Head_Cranium') as SpringBoneColliderSphere;
  assert.ok(headSphere, 'Head_Cranium collider present');
  rig.head.getWorldPosition(new THREE.Vector3());
  // Verify Head_Cranium worldCenter sits ABOVE Head bone in world +Y, NOT sideways along +X despite PelvisRoot pre-rotation
  const headWorld = new THREE.Vector3();
  rig.head.getWorldPosition(headWorld);
  assert.ok(
    headSphere.worldCenter.y > headWorld.y + 0.04,
    `Expected Head_Cranium above Head bone (+Y), got deltaY=${(headSphere.worldCenter.y - headWorld.y).toFixed(4)}`,
  );
  assert.ok(
    Math.abs(headSphere.worldCenter.x - headWorld.x) < 0.02,
    'Head_Cranium must stay centered on X despite pre-rotation',
  );

  const ctrl = createCharacterSecondaryPhysicsController(rig.root, {
    stiffnessForce: 0.4,
    gravityPower: 0.5,
    hitRadius: 0.03,
  });

  // Blow strong forward wind (+Z) pushing back hair directly into head/neck/chest colliders
  for (let i = 0; i < 60; i++) {
    ctrl.update(1 / 60, { windX: 0, windZ: 18 });
  }

  for (const b of rig.hairBones) {
    const worldPos = new THREE.Vector3();
    b.getWorldPosition(worldPos);
    const distToCranium = worldPos.distanceTo(headSphere.worldCenter);
    assert.ok(
      distToCranium >= headSphere.worldRadius * 0.92,
      `Hair bone ${b.name} clipped inside head cranium (${distToCranium.toFixed(4)} < ${headSphere.worldRadius.toFixed(4)})`,
    );
  }
  ctrl.dispose();
});

test('dt-spike, NaN input, and teleport spike clamping keep bone lengths invariant and never explode', () => {
  const rig = createHumanoidSpringRig({
    withHairChain: true,
    withSidePonytail: true,
  });
  const ctrl = createCharacterSecondaryPhysicsController(rig.root, {
    stiffnessForce: 2.2,
    gravityPower: 1.0,
    maxDt: 0.05,
    teleportDistanceThreshold: 1.25,
  });

  const restDist01 = rig.hairBones[0].getWorldPosition(new THREE.Vector3()).distanceTo(
    rig.hairBones[1].getWorldPosition(new THREE.Vector3()),
  );

  // Huge frame drop + invalid dt values + extreme velocity inputs
  ctrl.update(0);
  ctrl.update(-1);
  ctrl.update(Number.NaN);
  ctrl.update(Number.POSITIVE_INFINITY);
  ctrl.update(12.0, {
    worldVelocity: { x: 1e6, y: -1e6, z: 1e6 },
    angularYawRate: 1e5,
    windX: 9999,
    windZ: -9999,
  });

  for (const b of rig.hairBones) {
    assert.ok(Number.isFinite(b.quaternion.x) && Number.isFinite(b.quaternion.w));
    assert.ok(Math.abs(b.quaternion.length() - 1) < 1e-4);
  }

  // Teleport 800m in a single frame
  rig.root.position.set(800, 15, -600);
  ctrl.update(1 / 60);

  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  rig.hairBones[0].getWorldPosition(p0);
  rig.hairBones[1].getWorldPosition(p1);
  rig.hairBones[2].getWorldPosition(p2);

  assert.ok(
    p0.x > 799 && p2.x > 799,
    'Teleported hair chain moves cleanly with character instead of stretching back to origin',
  );
  assert.ok(
    Math.abs(p0.distanceTo(p1) - restDist01) < 1e-3,
    'Bone segment length preserved after teleport',
  );
  ctrl.dispose();
});

test('VRM 0.x secondaryAnimation (including stiffiness & colliderGroups) and VRM 1.0 VRMC_springBone metadata parse and simulate accurately', () => {
  // VRM 0.x metadata test
  const rig0 = createHumanoidSpringRig({ withHairChain: true, withSidePonytail: true });
  const vrm0Meta: VrmSecondaryAnimationMetadata = {
    colliderGroups: [
      {
        node: 'Head',
        colliders: [{ offset: [0, 0.04, 0], radius: 0.14 }],
      },
    ],
    boneGroups: [
      {
        comment: 'BangsGroup',
        stiffiness: 1.5, // VRM 0.x legacy spelling
        gravityPower: 0.8,
        dragForce: 0.45,
        hitRadius: 0.035,
        bones: ['Hair_Back_01'], // Root-only; should expand Hair_Back_01 -> 02 -> 03
        colliderGroups: [0],
      },
      {
        comment: 'PonytailGroup',
        stiffnessForce: 0.6,
        gravityPower: 1.1,
        dragForce: 0.3,
        hitRadius: 0.025,
        bones: ['Ponytail_L_01', 'Ponytail_L_02', 'Ponytail_L_03'], // Sequential explicit list
        colliderGroups: [],
      },
    ],
  };

  const ctrl0 = createCharacterSecondaryPhysicsController(rig0.root, {
    vrmSecondaryAnimation: vrm0Meta,
    autoBuildColliders: false,
  });
  assert.equal(ctrl0.metrics.boneChains, 2);
  assert.equal(ctrl0.metrics.colliders, 1);

  for (let i = 0; i < 30; i++) {
    ctrl0.update(1 / 60, { windX: 6, windZ: 10 });
  }
  const tipPos = rig0.hairBones[2].getWorldPosition(new THREE.Vector3());
  const headPos = rig0.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.04, 0));
  assert.ok(
    tipPos.distanceTo(headPos) >= 0.14 + 0.035 - 1e-3,
    'VRM 0.x colliderGroup enforces hitRadius clearance on expanded boneGroup',
  );
  ctrl0.dispose();

  // VRM 1.0 VRMC_springBone metadata test
  const rig1 = createHumanoidSpringRig({ withHairChain: true });
  const vrm1Meta: Vrm1SpringBoneExtension = {
    colliders: [
      {
        node: 'Head',
        shape: { sphere: { offset: [0, 0.06, 0], radius: 0.12 } },
      },
      {
        node: 'Spine2',
        shape: { capsule: { offset: [0, 0, 0], tail: [0, 0.14, 0], radius: 0.11 } },
      },
    ],
    colliderGroups: [{ name: 'UpperBody', colliders: [0, 1] }],
    springs: [
      {
        name: 'BackHairSpring',
        colliderGroups: [0],
        joints: [
          { node: 'Hair_Back_01', stiffness: 1.1, gravityPower: 0.6, dragForce: 0.35, hitRadius: 0.025 },
          { node: 'Hair_Back_02', stiffness: 1.1, gravityPower: 0.6, dragForce: 0.35, hitRadius: 0.025 },
          { node: 'Hair_Back_03', stiffness: 1.1, gravityPower: 0.6, dragForce: 0.35, hitRadius: 0.025 },
        ],
      },
    ],
  };

  const ctrl1 = createCharacterSecondaryPhysicsController(rig1.root, {
    vrmSpringBone: vrm1Meta,
    autoBuildColliders: false,
  });
  assert.equal(ctrl1.metrics.boneChains, 1);
  assert.equal(ctrl1.metrics.colliders, 2);
  for (let i = 0; i < 25; i++) ctrl1.update(1 / 60, { windZ: 8 });
  assert.ok(Number.isFinite(rig1.hairBones[1].quaternion.w));
  ctrl1.dispose();
});

test('Shader secondary-motion fallback pins scalp crown to 0, skips pants, isolates per-rig uniforms, and cleans up on dispose()', () => {
  const buildMeshRig = () => {
    const rig = createHumanoidSpringRig({ withHairChain: false });
    const hairGeo = new THREE.BufferGeometry();
    // Vert 0: crown scalp (y=1.56), Vert 1: mid hair (y=1.32), Vert 2: lower tip (y=1.02)
    hairGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 1.56, -0.05, 0.11, 1.32, -0.10, 0.12, 1.02, -0.12], 3),
    );
    hairGeo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 1, 0, 0, 1, 0, 0], 3));
    hairGeo.setIndex([0, 1, 2]);

    const sharedHairMat = new THREE.MeshBasicMaterial({ name: 'HairMat' });
    sharedHairMat.customProgramCacheKey = () => 'custom-hair-key-test';
    sharedHairMat.onBeforeCompile = (shader) => {
      shader.uniforms.uCustomKeep = { value: 1 };
    };

    const hairMesh = new THREE.Mesh(hairGeo, sharedHairMat);
    hairMesh.name = 'hair_draped_test';
    const outlineMesh = new THREE.Mesh(hairGeo.clone(), sharedHairMat);
    outlineMesh.name = 'hair_draped_test_Outline';

    const skirtGeo = new THREE.BufferGeometry();
    skirtGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-0.14, 0.94, 0.05, 0.14, 0.94, 0.05, 0, 0.68, 0.10], 3),
    );
    skirtGeo.setIndex([0, 1, 2]);
    const skirtMesh = new THREE.Mesh(skirtGeo, new THREE.MeshBasicMaterial({ name: 'SkirtMat' }));
    skirtMesh.name = 'legs_skirt_test';

    const pantsGeo = new THREE.BufferGeometry();
    pantsGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-0.12, 0.92, 0.05, 0.12, 0.92, 0.05, 0, 0.02, 0.05], 3),
    );
    pantsGeo.setIndex([0, 1, 2]);
    const pantsMesh = new THREE.Mesh(pantsGeo, new THREE.MeshBasicMaterial({ name: 'PantsMat' }));
    pantsMesh.name = 'legs_full_pants_test';

    rig.root.add(hairMesh, outlineMesh, skirtMesh, pantsMesh);
    return { rig, hairMesh, outlineMesh, skirtMesh, pantsMesh, sharedHairMat };
  };

  const a = buildMeshRig();
  const b = buildMeshRig();
  b.hairMesh.material = a.sharedHairMat;
  b.outlineMesh.material = a.sharedHairMat;

  const ctrlA = createCharacterSecondaryPhysicsController(a.rig.root);
  const ctrlB = createCharacterSecondaryPhysicsController(b.rig.root);

  assert.equal(ctrlA.metrics.boneChains, 0);
  assert.equal(ctrlA.metrics.secondaryShaderHooks, 3, 'Hair + Outline + Skirt hooked; full pants skipped');

  const metaAttr = a.hairMesh.geometry.getAttribute('aSecondaryMeta') as THREE.BufferAttribute;
  const outMetaAttr = a.outlineMesh.geometry.getAttribute('aSecondaryMeta') as THREE.BufferAttribute;
  assert.ok(metaAttr && outMetaAttr);
  assert.equal(metaAttr.getX(0), 0, 'Scalp crown vertex strictly pinned at mobility=0');
  assert.ok(metaAttr.getX(2) > 0.7, 'Long hair tip has strong mobility > 0.7');
  assert.equal(metaAttr.getX(2), outMetaAttr.getX(2), 'Outline matches base mesh mobility 1:1');

  const skirtMeta = a.skirtMesh.geometry.getAttribute('aSecondaryMeta') as THREE.BufferAttribute;
  assert.equal(skirtMeta.getX(0), 0, 'Skirt waistband pinned at mobility=0');
  assert.ok(skirtMeta.getX(2) > 0.5, 'Skirt hem has secondary mobility > 0.5');
  assert.equal(a.pantsMesh.geometry.getAttribute('aSecondaryMeta'), undefined, 'Full pants skipped');

  // Verify shader compilation hook preserves existing key & injects uniforms per rig independently
  const matA = a.hairMesh.material as THREE.Material;
  const matB = b.hairMesh.material as THREE.Material;
  assert.notEqual(matA, a.sharedHairMat);
  assert.notEqual(matA, matB);
  assert.equal(matA.customProgramCacheKey(), matB.customProgramCacheKey(), 'Program cache key shared across NPCs');
  assert.ok(matA.customProgramCacheKey().includes('custom-hair-key-test'));

  const mockShaderA = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: THREE.ShaderLib.basic.vertexShader,
    fragmentShader: THREE.ShaderLib.basic.fragmentShader,
  };
  const mockShaderB = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: THREE.ShaderLib.basic.vertexShader,
    fragmentShader: THREE.ShaderLib.basic.fragmentShader,
  };
  matA.onBeforeCompile(mockShaderA as never, null as never);
  matB.onBeforeCompile(mockShaderB as never, null as never);

  assert.ok(mockShaderA.uniforms.uCustomKeep, 'Original onBeforeCompile preserved');
  assert.ok(mockShaderA.uniforms.uSecondaryDisp);
  assert.ok(mockShaderA.vertexShader.includes('uSecondaryDisp'));
  assert.ok(mockShaderA.vertexShader.includes('aSecondaryMeta'));

  for (let i = 0; i < 30; i++) {
    ctrlA.update(1 / 60, { worldVelocity: { x: 0, y: 0, z: 10 }, windX: 4 });
    ctrlB.update(1 / 60, { worldVelocity: { x: 0, y: 0, z: 0 } });
  }

  const dispA = mockShaderA.uniforms.uSecondaryDisp.value as THREE.Vector3;
  const dispB = mockShaderB.uniforms.uSecondaryDisp.value as THREE.Vector3;
  assert.ok(dispA.z < -0.015, `Moving rig A hair trails backward (-Z), got ${dispA.z}`);
  assert.ok(dispA.x > 0.005, `Wind +X deflects rig A hair (+X), got ${dispA.x}`);
  assert.ok(dispB.length() < 1e-4, 'Idle rig B stays completely still (per-rig uniform isolation)');

  ctrlA.dispose();
  ctrlB.dispose();
  assert.equal(a.hairMesh.material, a.sharedHairMat, 'dispose() restores original shared material');
  // Calling update after dispose must be a safe no-op
  ctrlA.update(1 / 60, { windX: 20 });
  assert.equal(dispA.length(), 0);
});

test('Real bundled character & modular outfit GLBs attach colliders + scalp-safe secondary physics cleanly', async () => {
  const realAssets = [
    {
      label: 'Player Female (Tari/Mira base)',
      file: 'public/assets/character_custom_idle_runway_catwalk_stylish_11 (3).glb',
      expectLongHair: true,
      expectMinHooks: 3, // hair + outline + skirt legs + outline
    },
    {
      label: 'Player Male',
      file: 'public/assets/character_custom_idle_runway_catwalk_stylish_11 (2).glb',
      expectLongHair: false,
      expectMinHooks: 2, // hair + outline
    },
    {
      label: 'NPC Hana',
      file: 'public/assets/character_custom_idle_elegan_kalem_4.glb',
      expectLongHair: false,
      expectMinHooks: 2,
    },
    {
      label: 'NPC Nadia',
      file: 'public/assets/character_custom_sit_formal_tenang_2.glb',
      expectLongHair: true,
      expectMinHooks: 2,
    },
    {
      label: 'NPC Kenji',
      file: 'public/assets/character_custom_sit_runway_catwalk_stylish_4.glb',
      expectLongHair: false,
      expectMinHooks: 2,
    },
    {
      label: 'NPC Kai',
      file: 'public/assets/character_custom_idle_runway_catwalk_stylish_11 (1).glb',
      expectLongHair: false,
      expectMinHooks: 2,
    },
    {
      label: 'Mira Hair GLB',
      file: 'public/assets/outfit/mira/blitz_hair_draped_hair_1_43391F7E.glb',
      expectLongHair: true,
      expectMinHooks: 2,
    },
    {
      label: 'Bima Hair GLB',
      file: 'public/assets/outfit/bima/blitz_hair_trend_autumn_edit_2_9582695C.glb',
      expectLongHair: false,
      expectMinHooks: 2,
    },
    {
      label: 'Raka Hair GLB',
      file: 'public/assets/outfit/raka/blitz_hair_valbotq_12_18181D54.glb',
      expectLongHair: false,
      expectMinHooks: 2,
    },
    {
      label: 'Tari Costume GLB',
      file: 'public/assets/outfit/tari/tari-costume.glb',
      expectLongHair: false,
      expectMinHooks: 4, // legs skirt + outline + neck collar + outline
    },
  ];

  for (const spec of realAssets) {
    const gltf = await loadRealGlbInNode(spec.file);
    // Wrap inside scaled bodyGroup (matching upgradeBuddyRigWithCharBuddiesGlb unifiedModelScale ~2.14)
    const bodyGroup = new THREE.Group();
    bodyGroup.rotation.y = Math.PI * 0.5; // Facing +X world
    gltf.scene.scale.setScalar(2.14);
    bodyGroup.add(gltf.scene);
    bodyGroup.updateMatrixWorld(true);

    const anatomy = computeRigAnatomyMetrics(bodyGroup);
    const ctrl = createCharacterSecondaryPhysicsController(bodyGroup);
    assert.ok(
      ctrl.metrics.colliders >= 7,
      `${spec.label}: expected >= 7 anatomical colliders, got ${ctrl.metrics.colliders}`,
    );
    assert.ok(
      ctrl.metrics.secondaryShaderHooks >= spec.expectMinHooks,
      `${spec.label}: expected >= ${spec.expectMinHooks} hooks, got ${ctrl.metrics.secondaryShaderHooks}`,
    );

    // Check every hooked hair mesh keeps its scalp/inner-cap pinned while allowing outer tips/strands to move
    let checkedHairMesh = false;
    gltf.scene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const m = obj as THREE.Mesh;
      if (m.name.toLowerCase().includes('hair') && !m.name.toLowerCase().includes('outline')) {
        checkedHairMesh = true;
        const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute;
        const meta = m.geometry.getAttribute('aSecondaryMeta') as THREE.BufferAttribute;
        assert.ok(meta, `${spec.label}: ${m.name} missing aSecondaryMeta`);
        let maxY = -Infinity;
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i);
          if (y > maxY) maxY = y;
        }
        let scalpPinnedCount = 0;
        let scalpCheckTotal = 0;
        let maxTipMob = 0;
        const skullCx = anatomy.skullBindCenter.x;
        const skullCy = anatomy.skullBindCenter.y;
        const skullCz = anatomy.skullBindCenter.z;
        const skullInnerR = anatomy.skullBindRadius * 0.96;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const y = pos.getY(i);
          const z = pos.getZ(i);
          const mob = meta.getX(i);
          assert.ok(Number.isFinite(mob) && mob >= 0 && mob <= 1);
          if (spec.expectLongHair) {
            const radXZ = Math.hypot(x - skullCx, z - skullCz);
            if (y > maxY - 0.025 && radXZ <= anatomy.skullBindRadius * 1.28) {
              scalpCheckTotal++;
              if (mob <= 0.02) scalpPinnedCount++;
            }
          } else {
            const distSkull = Math.hypot(x - skullCx, (y - skullCy) * 0.88, z - skullCz);
            if (distSkull <= skullInnerR) {
              scalpCheckTotal++;
              if (mob <= 0.02) scalpPinnedCount++;
            }
          }
          if (mob > maxTipMob) {
            maxTipMob = mob;
          }
        }
        assert.ok(
          scalpCheckTotal > 0 && scalpPinnedCount === scalpCheckTotal,
          `${spec.label}: scalp/inner-cap vertices must stay pinned (${scalpPinnedCount}/${scalpCheckTotal})`,
        );
        if (spec.expectLongHair) {
          assert.ok(maxTipMob > 0.65, `${spec.label}: long hair tips should reach >0.65 mobility, got ${maxTipMob}`);
        } else {
          assert.ok(maxTipMob > 0.05 && maxTipMob <= 0.85, `${spec.label}: short/medium hair tips should have controlled sway, got ${maxTipMob}`);
        }
      }
    });
    if (!spec.file.includes('tari-costume')) {
      assert.equal(checkedHairMesh, true, `${spec.label}: expected to inspect at least one hair mesh`);
    }

    // Simulate scooter ride at +8 m/s in +X world (avatar's facing direction since yaw = +PI/2)
    // World velocity +8 in +X -> trails backward in world -X -> which in avatar bind-pose space is local -Z!
    let compiledHairUniform: THREE.Vector3 | null = null;
    gltf.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && !compiledHairUniform && obj.name.toLowerCase().includes('hair')) {
        const mat = (obj as THREE.Mesh).material as THREE.Material;
        const mockShader = {
          uniforms: {} as Record<string, { value: unknown }>,
          vertexShader: THREE.ShaderLib.basic.vertexShader,
          fragmentShader: THREE.ShaderLib.basic.fragmentShader,
        };
        mat.onBeforeCompile(mockShader as never, null as never);
        compiledHairUniform = mockShader.uniforms.uSecondaryDisp?.value as THREE.Vector3;
      }
    });

    for (let i = 0; i < 35; i++) {
      ctrl.update(1 / 60, { worldVelocity: { x: 8, y: 0, z: 0 }, angularYawRate: 1.5, windZ: -3 });
    }

    if (compiledHairUniform) {
      const disp = compiledHairUniform as THREE.Vector3;
      assert.ok(Number.isFinite(disp.x) && Number.isFinite(disp.y) && Number.isFinite(disp.z));
      assert.ok(
        disp.z < -0.01,
        `${spec.label}: rotated +90deg rig moving +X world should trail hair in bind-local -Z, got z=${disp.z.toFixed(4)}`,
      );
      assert.ok(disp.length() <= 0.085, `${spec.label}: displacement safely bounded, got ${disp.length()}`);
    }

    ctrl.dispose();
  }
});

function createMinimalBuddyRigForHairCollisionTest(bodyGroup: THREE.Group): BuddyCharacterRig {
  const dummyMesh = new THREE.Mesh();
  const weaponRigGroup = new THREE.Group();
  const pistolGroup = new THREE.Group();
  const rifleGroup = new THREE.Group();
  const bazookaGroup = new THREE.Group();
  return {
    headMesh: dummyMesh,
    leftArmPivot: new THREE.Group(),
    rightArmPivot: new THREE.Group(),
    leftLegPivot: new THREE.Group(),
    rightLegPivot: new THREE.Group(),
    weaponMesh: dummyMesh,
    weaponRigGroup,
    pistolGroup,
    rifleGroup,
    bazookaGroup,
    bazookaFrontFlash: new THREE.Group(),
    bazookaBackblastGroup: new THREE.Group(),
    bodyGroupRef: bodyGroup,
  };
}

function collectVisibleHairAndTorsoMeshes(root: THREE.Object3D): {
  hairBase: THREE.SkinnedMesh | null;
  hairOutline: THREE.SkinnedMesh | null;
  torsoMeshes: THREE.SkinnedMesh[];
} {
  let hairBase: THREE.SkinnedMesh | null = null;
  let hairOutline: THREE.SkinnedMesh | null = null;
  const torsoMeshes: THREE.SkinnedMesh[] = [];
  root.traverse((obj) => {
    const sm = obj as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh || !sm.visible) return;
    const lower = sm.name.toLowerCase();
    if (lower.includes('hair') && !lower.includes('outline') && !hairBase) {
      hairBase = sm;
    } else if (lower.includes('hair') && lower.includes('outline') && !hairOutline) {
      hairOutline = sm;
    } else if (lower.startsWith('torso_') && !lower.includes('outline')) {
      torsoMeshes.push(sm);
    }
  });
  return { hairBase, hairOutline, torsoMeshes };
}

function applyTestCapsulePush(
  cand: THREE.Vector3,
  orig: THREE.Vector3,
  capA: THREE.Vector4,
  capB: THREE.Vector4,
): void {
  if (capA.w <= 0.0001) return;
  const sx = capB.x - capA.x;
  const sy = capB.y - capA.y;
  const sz = capB.z - capA.z;
  const segLenSq = sx * sx + sy * sy + sz * sz;
  const tCand = segLenSq > 1e-8
    ? Math.max(0, Math.min(1, ((cand.x - capA.x) * sx + (cand.y - capA.y) * sy + (cand.z - capA.z) * sz) / segLenSq))
    : 0;
  const cx = capA.x + sx * tCand;
  const cy = capA.y + sy * tCand;
  const cz = capA.z + sz * tCand;
  const tOrig = segLenSq > 1e-8
    ? Math.max(0, Math.min(1, ((orig.x - capA.x) * sx + (orig.y - capA.y) * sy + (orig.z - capA.z) * sz) / segLenSq))
    : 0;
  const ox = capA.x + sx * tOrig;
  const oy = capA.y + sy * tOrig;
  const oz = capA.z + sz * tOrig;
  const origDist = Math.hypot(orig.x - ox, orig.y - oy, orig.z - oz);
  const dx = cand.x - cx;
  const dy = cand.y - cy;
  const dz = cand.z - cz;
  const candDist = Math.hypot(dx, dy, dz);
  const minAllowed = Math.min(capA.w, origDist);
  if (candDist < minAllowed) {
    let dirX = candDist > 0.0001 ? dx / candDist : orig.x - ox;
    let dirY = candDist > 0.0001 ? dy / candDist : orig.y - oy;
    let dirZ = candDist > 0.0001 ? dz / candDist : orig.z - oz + 0.001;
    const len1 = Math.hypot(dirX, dirY, dirZ) || 1;
    dirX /= len1;
    dirY /= len1;
    dirZ /= len1;
    if (orig.z > oz + 0.008 && dirZ < 0) {
      dirZ = Math.abs(dirZ) + 0.25;
      dirY = Math.max(0, dirY);
      const len2 = Math.hypot(dirX, dirY, dirZ) || 1;
      dirX /= len2;
      dirY /= len2;
      dirZ /= len2;
    } else if (orig.z < oz - 0.008 && dirZ > 0) {
      dirZ = -Math.abs(dirZ) - 0.25;
      dirY = Math.max(0, dirY);
      const len2 = Math.hypot(dirX, dirY, dirZ) || 1;
      dirX /= len2;
      dirY /= len2;
      dirZ /= len2;
    }
    cand.set(cx + dirX * minAllowed, cy + dirY * minAllowed, cz + dirZ * minAllowed);
  }
}

function buildChestTriangleSoup(
  torsoMeshes: THREE.SkinnedMesh[],
  invRoot: THREE.Matrix4,
  posed: boolean,
): Array<{ a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3 }> {
  const tris: Array<{ a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3 }> = [];
  const tmp = new THREE.Vector3();
  for (const tm of torsoMeshes) {
    const pos = tm.geometry.getAttribute('position') as THREE.BufferAttribute;
    const idx = tm.geometry.getIndex();
    const verts: THREE.Vector3[] = [];
    const inChest = new Uint8Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      tmp.fromBufferAttribute(pos, i);
      inChest[i] = Math.abs(tmp.x) < 0.21 ? 1 : 0;
      if (posed) {
        tm.applyBoneTransform(i, tmp);
        tmp.applyMatrix4(tm.matrixWorld).applyMatrix4(invRoot);
      }
      verts.push(tmp.clone());
    }
    const count = idx ? idx.count : pos.count;
    for (let k = 0; k + 2 < count; k += 3) {
      const ia = idx ? idx.getX(k) : k;
      const ib = idx ? idx.getX(k + 1) : k + 1;
      const ic = idx ? idx.getX(k + 2) : k + 2;
      if (!inChest[ia] || !inChest[ib] || !inChest[ic]) continue;
      tris.push({ a: verts[ia], b: verts[ib], c: verts[ic] });
    }
  }
  return tris;
}

function auditHairRigGeometryAndBustCollision(
  rig: BuddyCharacterRig,
  clip: THREE.AnimationClip | null = null,
  timeSec = 0,
): {
  nanCount: number;
  badWeightCount: number;
  outlineMismatchCount: number;
  frontBustPenetrations: number;
  worstFrontPenetrationM: number;
  backTorsoPenetrations: number;
  worstBackPenetrationM: number;
  hairBase: THREE.SkinnedMesh;
  chestTris: Array<{ a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3 }>;
} {
  const ctrl = rig.customGlbController!;
  const root = ctrl.glbRoot;
  if (clip) {
    ctrl.mixer.stopAllAction();
    ctrl.mixer.clipAction(clip).play();
    ctrl.mixer.update(timeSec);
  }
  root.updateMatrixWorld(true);
  const invRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();

  const { hairBase, hairOutline, torsoMeshes } = collectVisibleHairAndTorsoMeshes(root);
  assert.ok(hairBase, 'expected visible non-outline hair mesh');
  const hPos = hairBase.geometry.getAttribute('position') as THREE.BufferAttribute;
  const hSi = hairBase.geometry.getAttribute('skinIndex') as THREE.BufferAttribute;
  const hSw = hairBase.geometry.getAttribute('skinWeight') as THREE.BufferAttribute;
  const hMeta = hairBase.geometry.getAttribute('aSecondaryMeta') as THREE.BufferAttribute;
  assert.ok(hMeta, 'expected aSecondaryMeta attribute on hair mesh');

  let nanCount = 0;
  let badWeightCount = 0;
  for (let i = 0; i < hPos.count; i++) {
    if (!Number.isFinite(hPos.getX(i)) || !Number.isFinite(hPos.getY(i)) || !Number.isFinite(hPos.getZ(i))) {
      nanCount++;
    }
    const sum = hSw.getX(i) + hSw.getY(i) + hSw.getZ(i) + hSw.getW(i);
    if (!Number.isFinite(sum) || Math.abs(sum - 1.0) > 1e-3) {
      badWeightCount++;
    }
    for (let k = 0; k < 4; k++) {
      const bi = k === 0 ? hSi.getX(i) : k === 1 ? hSi.getY(i) : k === 2 ? hSi.getZ(i) : hSi.getW(i);
      const w = k === 0 ? hSw.getX(i) : k === 1 ? hSw.getY(i) : k === 2 ? hSw.getZ(i) : hSw.getW(i);
      if (w > 0 && (bi < 0 || bi >= hairBase.skeleton.bones.length)) {
        badWeightCount++;
      }
    }
  }

  let outlineMismatchCount = 0;
  if (hairOutline) {
    const oPos = hairOutline.geometry.getAttribute('position') as THREE.BufferAttribute;
    const oMeta = hairOutline.geometry.getAttribute('aSecondaryMeta') as THREE.BufferAttribute;
    const oSw = hairOutline.geometry.getAttribute('skinWeight') as THREE.BufferAttribute;
    const matches = matchOutlineToBaseVertices(hairBase.geometry, hairOutline.geometry, 0.02);
    for (let oi = 0; oi < oPos.count; oi++) {
      const bi = matches[oi];
      if (bi < 0) {
        outlineMismatchCount++;
        continue;
      }
      const dist = Math.hypot(
        oPos.getX(oi) - hPos.getX(bi),
        oPos.getY(oi) - hPos.getY(bi),
        oPos.getZ(oi) - hPos.getZ(bi),
      );
      const metaDiff = oMeta ? Math.abs(oMeta.getX(oi) - hMeta.getX(bi)) : 1;
      const weightDiff =
        Math.abs(oSw.getX(oi) - hSw.getX(bi))
        + Math.abs(oSw.getY(oi) - hSw.getY(bi))
        + Math.abs(oSw.getZ(oi) - hSw.getZ(bi))
        + Math.abs(oSw.getW(oi) - hSw.getW(bi));
      if (dist > 0.0055 || metaDiff > 1e-4 || weightDiff > 1e-3) {
        outlineMismatchCount++;
      }
    }
  }

  const chestTris = buildChestTriangleSoup(torsoMeshes, invRoot, clip !== null);
  const spine2Bone = ctrl.bones.get('Spine02');
  const spine2Idx = spine2Bone ? hairBase.skeleton.bones.indexOf(spine2Bone) : -1;
  const chestFwd = new THREE.Vector3(0, 0, 1);
  if (clip && spine2Bone && spine2Idx >= 0) {
    const spine2ToRoot = new THREE.Matrix4().multiplyMatrices(invRoot, spine2Bone.matrixWorld);
    const spine2Delta = new THREE.Matrix4().multiplyMatrices(spine2ToRoot, hairBase.skeleton.boneInverses[spine2Idx]);
    chestFwd.transformDirection(spine2Delta).normalize();
  }

  const ray = new THREE.Ray();
  const hit = new THREE.Vector3();
  const v = new THREE.Vector3();
  let frontBustPenetrations = 0;
  let backTorsoPenetrations = 0;
  let worstFrontPenetrationM = 0;
  let worstBackPenetrationM = 0;
  for (let i = 0; i < hPos.count; i++) {
    const ox = hPos.getX(i);
    const oy = hPos.getY(i);
    const oz = hPos.getZ(i);
    if (oy > 1.33 || Math.abs(ox) > 0.21) continue;
    v.set(ox, oy, oz);
    if (clip) {
      hairBase.applyBoneTransform(i, v);
      v.applyMatrix4(hairBase.matrixWorld).applyMatrix4(invRoot);
    }
    ray.origin.copy(v).addScaledVector(chestFwd, 0.8);
    ray.direction.copy(chestFwd).negate();
    let maxProj = -Infinity;
    let minProj = Infinity;
    for (const tri of chestTris) {
      if (ray.intersectTriangle(tri.a, tri.b, tri.c, false, hit)) {
        const proj = hit.clone().sub(v).dot(chestFwd);
        if (proj > maxProj) maxProj = proj;
        if (proj < minProj) minProj = proj;
      }
    }
    if (maxProj > 0.0005 && minProj < -0.0005) {
      if (maxProj <= -minProj) {
        frontBustPenetrations++;
        worstFrontPenetrationM = Math.max(worstFrontPenetrationM, maxProj);
      } else {
        backTorsoPenetrations++;
        worstBackPenetrationM = Math.max(worstBackPenetrationM, -minProj);
      }
    }
  }

  return {
    nanCount,
    badWeightCount,
    outlineMismatchCount,
    frontBustPenetrations,
    worstFrontPenetrationM,
    backTorsoPenetrations,
    worstBackPenetrationM,
    hairBase,
    chestTris,
  };
}

test('Mira real draped hair over halter top: 0 bust penetration across T-pose and idle/walk/run/sit, damped chest Head/Neck weights, intact scalp, and synced _Outline', async () => {
  const [playerFem, miraHair, miraTop, miraAnims] = await Promise.all([
    loadRealGlbInNode('public/assets/character_custom_idle_runway_catwalk_stylish_11 (3).glb'),
    loadRealGlbInNode('public/assets/outfit/mira/blitz_hair_draped_hair_1_43391F7E.glb'),
    loadRealGlbInNode('public/assets/outfit/mira/blitz_torso_resort_modern_6_5DC8FAA4.glb'),
    loadRealGlbInNode('public/assets/mira-anims.glb'),
  ]);

  // Capture raw GLB crown coordinates and chest Head weight sum prior to rig assembly/depenetration
  let rawHairMesh: THREE.SkinnedMesh | null = null;
  miraHair.scene.traverse((obj) => {
    const sm = obj as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh && !sm.name.toLowerCase().includes('outline') && !rawHairMesh) rawHairMesh = sm;
  });
  assert.ok(rawHairMesh, 'expected raw Mira hair SkinnedMesh');
  const rawPos = (rawHairMesh as THREE.SkinnedMesh).geometry.getAttribute('position') as THREE.BufferAttribute;
  const rawSi = (rawHairMesh as THREE.SkinnedMesh).geometry.getAttribute('skinIndex') as THREE.BufferAttribute;
  const rawSw = (rawHairMesh as THREE.SkinnedMesh).geometry.getAttribute('skinWeight') as THREE.BufferAttribute;
  const rawHeadBoneIdx = (rawHairMesh as THREE.SkinnedMesh).skeleton.bones.findIndex((b) => b.name.includes('Head'));
  assert.ok(rawHeadBoneIdx >= 0, 'expected Head bone in raw Mira hair skeleton');

  const rawPosCopy = new Float32Array(rawPos.array as Float32Array);
  let rawChestHeadWeightSum = 0;
  for (let i = 0; i < rawPos.count; i++) {
    if (rawPos.getY(i) >= 1.28) continue;
    for (let k = 0; k < 4; k++) {
      const bi = k === 0 ? rawSi.getX(i) : k === 1 ? rawSi.getY(i) : k === 2 ? rawSi.getZ(i) : rawSi.getW(i);
      const w = k === 0 ? rawSw.getX(i) : k === 1 ? rawSw.getY(i) : k === 2 ? rawSw.getZ(i) : rawSw.getW(i);
      if (bi === rawHeadBoneIdx) rawChestHeadWeightSum += w;
    }
  }
  assert.ok(rawChestHeadWeightSum > 1.0, `expected significant raw chest Head rigid weights before fix, got ${rawChestHeadWeightSum}`);

  const rig = createMinimalBuddyRigForHairCollisionTest(new THREE.Group());
  upgradeBuddyRigWithCharBuddiesGlb(rig, playerFem);
  applyEquippedApparelSlotToBuddyRig(rig, 'hair', miraHair);
  applyEquippedTorsoToBuddyRig(rig, miraTop);

  // Check anatomical + active torso envelope metrics
  const ctrl = rig.customGlbController!;
  const anatomy = computeRigAnatomyMetrics(ctrl.glbRoot);
  const env = buildTorsoBindCollisionEnvelope(ctrl.glbRoot, anatomy);
  assert.equal(env.hasTorsoMeshes, true, 'expected active torso mesh rasterized into collision envelope');

  // T-pose check
  const tPose = auditHairRigGeometryAndBustCollision(rig, null, 0);
  assert.equal(tPose.nanCount, 0);
  assert.equal(tPose.badWeightCount, 0);
  assert.equal(tPose.outlineMismatchCount, 0);
  assert.equal(tPose.frontBustPenetrations, 0, `expected 0 T-pose front bust penetrations, worst=${tPose.worstFrontPenetrationM}`);
  assert.equal(tPose.backTorsoPenetrations, 0, `expected 0 T-pose back torso penetrations, worst=${tPose.worstBackPenetrationM}`);

  // Verify scalp crown above chin cutoff was not distorted and chest Head weights were damped toward Spine02/UpperChest
  const hPos = tPose.hairBase.geometry.getAttribute('position') as THREE.BufferAttribute;
  const hSi = tPose.hairBase.geometry.getAttribute('skinIndex') as THREE.BufferAttribute;
  const hSw = tPose.hairBase.geometry.getAttribute('skinWeight') as THREE.BufferAttribute;
  const postHeadIdx = tPose.hairBase.skeleton.bones.indexOf(ctrl.bones.get('Head')!);
  assert.ok(postHeadIdx >= 0);
  const chinCutoffY = anatomy.headBindPos.y - 0.04 * anatomy.anatScale;
  let maxCrownDrift = 0;
  let postChestHeadWeightSum = 0;
  for (let i = 0; i < hPos.count; i++) {
    const oy = rawPosCopy[i * 3 + 1];
    if (oy >= chinCutoffY + 0.02) {
      maxCrownDrift = Math.max(
        maxCrownDrift,
        Math.hypot(hPos.getX(i) - rawPosCopy[i * 3], hPos.getY(i) - oy, hPos.getZ(i) - rawPosCopy[i * 3 + 2]),
      );
    }
    if (oy < 1.28) {
      for (let k = 0; k < 4; k++) {
        const bi = k === 0 ? hSi.getX(i) : k === 1 ? hSi.getY(i) : k === 2 ? hSi.getZ(i) : hSi.getW(i);
        const w = k === 0 ? hSw.getX(i) : k === 1 ? hSw.getY(i) : k === 2 ? hSw.getZ(i) : hSw.getW(i);
        if (bi === postHeadIdx) postChestHeadWeightSum += w;
      }
    }
  }
  assert.equal(maxCrownDrift, 0, `expected 0 scalp crown distortion above chin cutoff, got ${maxCrownDrift}`);
  assert.ok(
    postChestHeadWeightSum < rawChestHeadWeightSum * 0.35,
    `expected damped chest Head weight sum (<35% of ${rawChestHeadWeightSum.toFixed(2)}), got ${postChestHeadWeightSum.toFixed(2)}`,
  );

  // Animated locomotion + idle + sit checks across keyframe intervals
  const testedClips = miraAnims.animations.filter((clip) => /idle|walk|run|sit/i.test(clip.name));
  assert.ok(testedClips.length >= 4, `expected idle/walk/run/sit clips in mira-anims.glb, got ${testedClips.map((c) => c.name).join(', ')}`);
  for (const clip of testedClips) {
    for (let t = 0; t <= clip.duration; t += 0.5) {
      const res = auditHairRigGeometryAndBustCollision(rig, clip, t);
      assert.equal(res.nanCount, 0, `${clip.name}@${t}: expected 0 NaNs`);
      assert.equal(res.badWeightCount, 0, `${clip.name}@${t}: expected 0 bad skinWeights`);
      assert.equal(res.outlineMismatchCount, 0, `${clip.name}@${t}: expected 0 outline mismatches`);
      assert.equal(res.frontBustPenetrations, 0, `${clip.name}@${t}: expected 0 front bust penetrations (worst=${res.worstFrontPenetrationM})`);
      assert.equal(res.backTorsoPenetrations, 0, `${clip.name}@${t}: expected 0 back torso penetrations (worst=${res.worstBackPenetrationM})`);
    }
  }

  ctrl.secondaryPhysics?.dispose();
});

test('Idempotent torso swap refresh, Uint8 normalized skinWeights, anatomical fallback without torso mesh, and multi-rig isolation/dispose', async () => {
  const [playerFem, miraHair, miraTop, dropscience, nadiaGlb] = await Promise.all([
    loadRealGlbInNode('public/assets/character_custom_idle_runway_catwalk_stylish_11 (3).glb'),
    loadRealGlbInNode('public/assets/outfit/mira/blitz_hair_draped_hair_1_43391F7E.glb'),
    loadRealGlbInNode('public/assets/outfit/mira/blitz_torso_resort_modern_6_5DC8FAA4.glb'),
    loadRealGlbInNode('public/assets/torso_dropscience_hiphop_24_iap_1_3B9D82F3.glb'),
    loadRealGlbInNode('public/assets/character_custom_sit_formal_tenang_2.glb'),
  ]);

  // 1. Idempotent refresh across MiraTop -> DropScience hoodie -> DefaultTop -> MiraTop
  const rig1 = createMinimalBuddyRigForHairCollisionTest(new THREE.Group());
  upgradeBuddyRigWithCharBuddiesGlb(rig1, playerFem);
  applyEquippedApparelSlotToBuddyRig(rig1, 'hair', miraHair);
  applyEquippedTorsoToBuddyRig(rig1, miraTop);

  const miraBaseSnap = auditHairRigGeometryAndBustCollision(rig1, null, 0);
  const posSnap1 = new Float32Array(miraBaseSnap.hairBase.geometry.getAttribute('position').array as Float32Array);
  const wgtSnap1 = new Float32Array(miraBaseSnap.hairBase.geometry.getAttribute('skinWeight').array as Float32Array);
  const metaSnap1 = new Float32Array(miraBaseSnap.hairBase.geometry.getAttribute('aSecondaryMeta').array as Float32Array);

  applyEquippedTorsoToBuddyRig(rig1, dropscience);
  const hoodieRes = auditHairRigGeometryAndBustCollision(rig1, null, 0);
  assert.equal(hoodieRes.frontBustPenetrations, 0, 'DropScience hoodie: expected 0 chest penetration');
  assert.equal(hoodieRes.outlineMismatchCount, 0, 'DropScience hoodie: expected 0 outline mismatch');
  assert.equal(hoodieRes.badWeightCount, 0, 'DropScience hoodie: expected 0 bad skinWeights');

  applyEquippedTorsoToBuddyRig(rig1, null);
  const defaultRes = auditHairRigGeometryAndBustCollision(rig1, null, 0);
  assert.equal(defaultRes.frontBustPenetrations, 0, 'DefaultTop: expected 0 chest penetration');
  assert.equal(defaultRes.outlineMismatchCount, 0, 'DefaultTop: expected 0 outline mismatch');
  assert.equal(defaultRes.badWeightCount, 0, 'DefaultTop: expected 0 bad skinWeights');

  applyEquippedTorsoToBuddyRig(rig1, miraTop);
  const miraRoundTrip = auditHairRigGeometryAndBustCollision(rig1, null, 0);
  const posSnap2 = miraRoundTrip.hairBase.geometry.getAttribute('position').array as Float32Array;
  const wgtSnap2 = miraRoundTrip.hairBase.geometry.getAttribute('skinWeight').array as Float32Array;
  const metaSnap2 = miraRoundTrip.hairBase.geometry.getAttribute('aSecondaryMeta').array as Float32Array;

  let maxPosDrift = 0;
  let maxWgtDrift = 0;
  let maxMetaDrift = 0;
  for (let i = 0; i < posSnap1.length; i++) maxPosDrift = Math.max(maxPosDrift, Math.abs(posSnap1[i] - posSnap2[i]));
  for (let i = 0; i < wgtSnap1.length; i++) maxWgtDrift = Math.max(maxWgtDrift, Math.abs(wgtSnap1[i] - wgtSnap2[i]));
  for (let i = 0; i < metaSnap1.length; i++) maxMetaDrift = Math.max(maxMetaDrift, Math.abs(metaSnap1[i] - metaSnap2[i]));
  assert.equal(maxPosDrift, 0, `idempotent refresh position drift expected 0, got ${maxPosDrift}`);
  assert.equal(maxWgtDrift, 0, `idempotent refresh skinWeight drift expected 0, got ${maxWgtDrift}`);
  assert.equal(maxMetaDrift, 0, `idempotent refresh aSecondaryMeta drift expected 0, got ${maxMetaDrift}`);

  // 2. Multi-rig isolation + dispose pristine restoration
  const rig2 = createMinimalBuddyRigForHairCollisionTest(new THREE.Group());
  upgradeBuddyRigWithCharBuddiesGlb(rig2, playerFem);
  applyEquippedApparelSlotToBuddyRig(rig2, 'hair', miraHair);
  applyEquippedTorsoToBuddyRig(rig2, dropscience);
  const rig2SnapBefore = new Float32Array(
    collectVisibleHairAndTorsoMeshes(rig2.customGlbController!.glbRoot).hairBase!.geometry.getAttribute('position').array as Float32Array,
  );
  rig1.customGlbController!.secondaryPhysics!.dispose();
  const rig2SnapAfter = collectVisibleHairAndTorsoMeshes(rig2.customGlbController!.glbRoot).hairBase!.geometry.getAttribute('position').array as Float32Array;
  let crossRigDrift = 0;
  for (let i = 0; i < rig2SnapBefore.length; i++) crossRigDrift = Math.max(crossRigDrift, Math.abs(rig2SnapBefore[i] - rig2SnapAfter[i]));
  assert.equal(crossRigDrift, 0, 'disposing rig1 must not mutate rig2 shared outfit geometry');
  rig2.customGlbController!.secondaryPhysics!.dispose();

  // 3. Anatomical fallback envelope when no visible torso mesh is present
  const fallbackRig = createMinimalBuddyRigForHairCollisionTest(new THREE.Group());
  upgradeBuddyRigWithCharBuddiesGlb(fallbackRig, playerFem);
  applyEquippedApparelSlotToBuddyRig(fallbackRig, 'hair', miraHair);
  fallbackRig.customGlbController!.glbRoot.traverse((obj) => {
    if (obj.name.toLowerCase().startsWith('torso_')) obj.visible = false;
  });
  fallbackRig.customGlbController!.secondaryPhysics!.refresh();
  const fallbackEnv = buildTorsoBindCollisionEnvelope(
    fallbackRig.customGlbController!.glbRoot,
    computeRigAnatomyMetrics(fallbackRig.customGlbController!.glbRoot),
  );
  assert.equal(fallbackEnv.hasTorsoMeshes, false, 'expected fallback anatomical envelope when torso meshes are hidden');
  const fallbackHair = collectVisibleHairAndTorsoMeshes(fallbackRig.customGlbController!.glbRoot).hairBase!;
  const fallbackPos = fallbackHair.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < fallbackPos.count; i++) {
    const x = fallbackPos.getX(i);
    const y = fallbackPos.getY(i);
    if (y >= 1.10 && y <= 1.24 && Math.abs(x) < 0.08 && fallbackPos.getZ(i) > 0) {
      assert.ok(fallbackPos.getZ(i) > 0.11, `expected fallback chest depenetration z>0.11 at y=${y.toFixed(3)}, got ${fallbackPos.getZ(i).toFixed(4)}`);
    }
  }
  fallbackRig.customGlbController!.secondaryPhysics!.dispose();

  // 4. Normalized Uint8Array skinWeight rig (Nadia) preserves exact unit sum & outline sync
  const nadiaRig = createMinimalBuddyRigForHairCollisionTest(new THREE.Group());
  upgradeBuddyRigWithCharBuddiesGlb(nadiaRig, nadiaGlb);
  const nadiaRes = auditHairRigGeometryAndBustCollision(nadiaRig, null, 0);
  assert.equal(nadiaRes.nanCount, 0);
  assert.equal(nadiaRes.badWeightCount, 0);
  assert.equal(nadiaRes.outlineMismatchCount, 0);
  assert.equal(nadiaRes.frontBustPenetrations, 0);
  nadiaRig.customGlbController!.secondaryPhysics!.dispose();
});

test('buildSecondaryVertexInjection(true) binds multi-capsule chest/clavicle/back colliders preventing sprint sway bust penetration', async () => {
  const hairCode = buildSecondaryVertexInjection(true);
  const skirtCode = buildSecondaryVertexInjection(false);
  for (const uniformName of [
    'uSecChestLA',
    'uSecChestLB',
    'uSecChestRA',
    'uSecChestRB',
    'uSecClavLA',
    'uSecClavLB',
    'uSecClavRA',
    'uSecClavRB',
    'uSecBackA',
    'uSecBackB',
  ]) {
    assert.ok(hairCode.includes(uniformName), `expected hair GLSL injection to reference ${uniformName}`);
    assert.ok(!skirtCode.includes(uniformName), `expected non-hair GLSL injection not to include ${uniformName}`);
  }

  const [playerFem, miraHair, miraTop, dropscience] = await Promise.all([
    loadRealGlbInNode('public/assets/character_custom_idle_runway_catwalk_stylish_11 (3).glb'),
    loadRealGlbInNode('public/assets/outfit/mira/blitz_hair_draped_hair_1_43391F7E.glb'),
    loadRealGlbInNode('public/assets/outfit/mira/blitz_torso_resort_modern_6_5DC8FAA4.glb'),
    loadRealGlbInNode('public/assets/torso_dropscience_hiphop_24_iap_1_3B9D82F3.glb'),
  ]);

  const rig = createMinimalBuddyRigForHairCollisionTest(new THREE.Group());
  upgradeBuddyRigWithCharBuddiesGlb(rig, playerFem);
  applyEquippedApparelSlotToBuddyRig(rig, 'hair', miraHair);
  applyEquippedTorsoToBuddyRig(rig, miraTop);

  const tPose = auditHairRigGeometryAndBustCollision(rig, null, 0);
  const mat = (Array.isArray(tPose.hairBase.material) ? tPose.hairBase.material[0] : tPose.hairBase.material) as THREE.Material;
  const mockShader = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: THREE.ShaderLib.basic.vertexShader,
    fragmentShader: THREE.ShaderLib.basic.fragmentShader,
  };
  mat.onBeforeCompile(mockShader as never, null as never);

  const uCapLA = mockShader.uniforms.uSecChestLA?.value as THREE.Vector4;
  const uCapLB = mockShader.uniforms.uSecChestLB?.value as THREE.Vector4;
  const uCapRA = mockShader.uniforms.uSecChestRA?.value as THREE.Vector4;
  const uCapRB = mockShader.uniforms.uSecChestRB?.value as THREE.Vector4;
  const uClavLA = mockShader.uniforms.uSecClavLA?.value as THREE.Vector4;
  const uClavLB = mockShader.uniforms.uSecClavLB?.value as THREE.Vector4;
  const uClavRA = mockShader.uniforms.uSecClavRA?.value as THREE.Vector4;
  const uClavRB = mockShader.uniforms.uSecClavRB?.value as THREE.Vector4;
  const uBackA = mockShader.uniforms.uSecBackA?.value as THREE.Vector4;
  const uBackB = mockShader.uniforms.uSecBackB?.value as THREE.Vector4;
  const uAnchor = mockShader.uniforms.uSecondaryAnchor?.value as THREE.Vector3;
  const uParams = mockShader.uniforms.uSecondaryParams?.value as THREE.Vector4;

  for (const cap of [uCapLA, uCapRA, uClavLA, uClavRA, uBackA]) {
    assert.ok(cap && cap.w > 0.05, `expected positive shader collider capsule radius, got ${cap?.w}`);
  }

  // Strong forward sprint trails hair along -Z; shader capsules must keep chest strands outside Mira halter bust surface
  const hPos = tPose.hairBase.geometry.getAttribute('position') as THREE.BufferAttribute;
  const hMeta = tPose.hairBase.geometry.getAttribute('aSecondaryMeta') as THREE.BufferAttribute;
  const sprintDisp = new THREE.Vector3(0, 0, -0.072);
  const ray = new THREE.Ray();
  const hit = new THREE.Vector3();
  let shaderSprintPen = 0;
  for (let i = 0; i < hPos.count; i++) {
    const orig = new THREE.Vector3().fromBufferAttribute(hPos, i);
    if (orig.y > 1.28 || orig.z < 0.01) continue;
    const cand = orig.clone().addScaledVector(sprintDisp, hMeta.getX(i));
    const origSkull = orig.clone().sub(uAnchor);
    origSkull.y *= 0.84;
    const candSkull = cand.clone().sub(uAnchor);
    candSkull.y *= 0.84;
    const minSkull = Math.min(uParams.x, origSkull.length());
    if (candSkull.length() < minSkull && candSkull.length() > 1e-4) {
      candSkull.normalize().multiplyScalar(minSkull);
      cand.set(uAnchor.x + candSkull.x, uAnchor.y + candSkull.y / 0.84, uAnchor.z + candSkull.z);
    }
    applyTestCapsulePush(cand, orig, uCapLA, uCapLB);
    applyTestCapsulePush(cand, orig, uCapRA, uCapRB);
    applyTestCapsulePush(cand, orig, uClavLA, uClavLB);
    applyTestCapsulePush(cand, orig, uClavRA, uClavRB);
    applyTestCapsulePush(cand, orig, uBackA, uBackB);
    ray.origin.set(cand.x, cand.y, 2.0);
    ray.direction.set(0, 0, -1);
    let frontZ = -Infinity;
    for (const tri of tPose.chestTris) {
      if (ray.intersectTriangle(tri.a, tri.b, tri.c, false, hit) && hit.z > frontZ) frontZ = hit.z;
    }
    if (cand.z < frontZ) shaderSprintPen++;
  }
  assert.equal(shaderSprintPen, 0, `expected 0 bust penetrations under sprint disp in shader space, got ${shaderSprintPen}`);

  // Swapping to baggy hoodie updates capsule bounds in place cleanly
  const halterBackZ = uBackA.z;
  applyEquippedTorsoToBuddyRig(rig, dropscience);
  assert.notEqual(uBackA.z, halterBackZ, 'expected torso equip refresh to update shader capsule colliders');
  rig.customGlbController!.secondaryPhysics!.dispose();
});

test('LOD tier resolution, 30Hz half-rate stepping, sleep rest lock, wake without whip & skipMatrix parity', () => {
  assert.equal(resolveSecondaryPhysicsLod({ cameraDistanceM: 8, inFrustum: true, isPlayer: false }), 'full');
  assert.equal(resolveSecondaryPhysicsLod({ cameraDistanceM: 15.9, inFrustum: true, isPlayer: false }), 'full');
  assert.equal(resolveSecondaryPhysicsLod({ cameraDistanceM: 16, inFrustum: true, isPlayer: false }), 'half');
  assert.equal(resolveSecondaryPhysicsLod({ cameraDistanceM: 32, inFrustum: true, isPlayer: false }), 'half');
  assert.equal(resolveSecondaryPhysicsLod({ cameraDistanceM: 36.1, inFrustum: true, isPlayer: false }), 'sleep');
  assert.equal(resolveSecondaryPhysicsLod({ cameraDistanceM: 5, inFrustum: false, isPlayer: false }), 'sleep');
  assert.equal(resolveSecondaryPhysicsLod({ cameraDistanceM: 80, inFrustum: false, isPlayer: true }), 'full');

  // Verify skipRigMatrixWorldUpdate parity against default update
  const rigA = createHumanoidSpringRig({ withHairChain: true });
  const rigB = createHumanoidSpringRig({ withHairChain: true });
  const ctrlA = createCharacterSecondaryPhysicsController(rigA.root, { stiffnessForce: 1.0, dragForce: 0.35 });
  const ctrlB = createCharacterSecondaryPhysicsController(rigB.root, { stiffnessForce: 1.0, dragForce: 0.35 });

  for (let i = 0; i < 20; i++) {
    rigA.root.position.x += 0.04;
    rigB.root.position.x += 0.04;
    rigB.root.updateMatrixWorld(true);
    ctrlA.update(1 / 60, { windX: 3.5, windZ: 1.2, angularYawRate: 1.1, lod: 'full' });
    ctrlB.update(1 / 60, {
      windX: 3.5,
      windZ: 1.2,
      angularYawRate: 1.1,
      lod: 'full',
      skipRigMatrixWorldUpdate: true,
    });
  }
  const qa = rigA.hairBones[0].quaternion;
  const qb = rigB.hairBones[0].quaternion;
  assert.ok(qa.angleTo(qb) < 1e-6, `skipRigMatrixWorldUpdate diverged: angle=${qa.angleTo(qb)}`);

  // Verify half-rate LOD skips every other 60Hz call and steps cleanly on accumulated interval
  ctrlA.reset();
  const rigHalf = createHumanoidSpringRig({ withHairChain: true });
  const ctrlHalf = createCharacterSecondaryPhysicsController(rigHalf.root, { stiffnessForce: 1.0, dragForce: 0.35 });
  const hairBone = rigHalf.hairBones[0];
  const initQ = hairBone.quaternion.clone();
  ctrlHalf.update(1 / 60, { windX: 10, lod: 'half' });
  assert.equal(ctrlHalf.lodMode, 'half');
  assert.ok(hairBone.quaternion.angleTo(initQ) < 1e-6, 'expected first 1/60s half-LOD tick to accumulate and skip');
  ctrlHalf.update(1 / 60, { windX: 10, lod: 'half' });
  assert.ok(hairBone.quaternion.angleTo(initQ) > 0.005, 'expected second 1/60s half-LOD tick to solve accumulated 33ms step');

  // Verify sleep resets hair back to rest cleanly, keeps scalp-like root untouched, and wakes while teleporting without whip
  ctrlHalf.update(1 / 60, { lod: 'sleep' });
  assert.equal(ctrlHalf.lodMode, 'sleep');
  assert.ok(hairBone.quaternion.angleTo(initQ) < 1e-6, 'expected sleep to restore clean rest quaternion');
  // Move rig far while sleeping -> wake must NOT produce a velocity whip explosion
  rigHalf.root.position.set(25, 0, 12);
  ctrlHalf.update(1 / 60, { lod: 'sleep' });
  ctrlHalf.update(1 / 60, { windX: 0, windZ: 0, lod: 'full' });
  assert.ok(
    hairBone.quaternion.angleTo(initQ) < 0.08,
    `expected smooth wake without teleport whip, got angle=${hairBone.quaternion.angleTo(initQ)}`,
  );

  ctrlA.dispose();
  ctrlB.dispose();
  ctrlHalf.dispose();
});

test('Blitz character avatars merge BodySkin, enable frustum culling with inflated bounds, share 1 Skeleton, and sync male hair outline meta', async () => {
  const femaleGltf = await loadRealGlbInNode('public/assets/avatars/blitz-female-01.glb');
  const maleGltf = await loadRealGlbInNode('public/assets/avatars/blitz-male-01.glb');

  for (const [label, gltf, dollName] of [
    ['blitz-female-01', femaleGltf, 'Blitz_BaseDoll_Female_Mesh'],
    ['blitz-male-01', maleGltf, 'Blitz_BaseDoll_Male_Mesh'],
  ] as const) {
    const rig = createMinimalBuddyRigForHairCollisionTest(new THREE.Group());
    upgradeBuddyRigWithCharBuddiesGlb(rig, gltf);
    assert.ok(rig.customGlbController, `expected ${label} upgrade to attach controller`);
    const ctrl = rig.customGlbController!;
    const glbRoot = ctrl.glbRoot;

    let headFound = false;
    let bodySkinFound = false;
    let skinnedCount = 0;
    const uniqueSkeletons = new Set<THREE.Skeleton>();

    glbRoot.traverse((n) => {
      const sm = n as THREE.SkinnedMesh;
      if (!sm.isSkinnedMesh) return;
      skinnedCount++;
      assert.equal(sm.frustumCulled, true, `${label} mesh ${sm.name} must have frustumCulled=true`);
      assert.ok(sm.boundingSphere && sm.boundingSphere.radius >= 0.75, `${label} ${sm.name} must have inflated boundingSphere`);
      if (sm.skeleton) uniqueSkeletons.add(sm.skeleton);
      if (sm.name === dollName) headFound = true;
      if (sm.name === `${dollName}_BodySkin`) bodySkinFound = true;
      assert.ok(
        !/^Blitz_BaseDoll_(?:Female|Male)_Mesh_\d+$/i.test(sm.name),
        `${label} body skin submesh ${sm.name} should be merged into BodySkin`,
      );
      const mats = Array.isArray(sm.material) ? sm.material : [sm.material];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        assert.equal(std.normalMap ?? null, null, `${label} ${sm.name} material should have no normalMap`);
      }
    });

    assert.ok(headFound, `${label} must keep ${dollName} intact`);
    assert.ok(bodySkinFound, `${label} must produce merged ${dollName}_BodySkin`);
    assert.equal(uniqueSkeletons.size, 1, `${label} must share 1 deduplicated Skeleton across all ${skinnedCount} SkinnedMeshes`);
    assert.ok(skinnedCount <= 16, `${label} SkinnedMesh count should stay <= 16, got ${skinnedCount}`);

    if (label === 'blitz-male-01') {
      const hairOutline = glbRoot.getObjectByName('Blitz_Male_Outfit01_Hair_Outline') as THREE.Mesh | undefined;
      assert.ok(hairOutline, 'expected Blitz_Male_Outfit01_Hair_Outline to exist');
      assert.ok(
        hairOutline.geometry.getAttribute('aSecondaryMeta'),
        'expected Blitz_Male_Outfit01_Hair_Outline to receive aSecondaryMeta after HAIR_MESH_RE fix',
      );
    }

    // Check scalp anchor root bones remain strictly locked 0.0° under high wind/sleep/wake
    const scalpRoots: Array<{ bone: THREE.Bone; rest: THREE.Quaternion }> = [];
    glbRoot.traverse((n) => {
      if ((n as THREE.Bone).isBone && /hair_?root$/i.test(n.name)) {
        scalpRoots.push({ bone: n as THREE.Bone, rest: n.quaternion.clone() });
      }
    });
    for (let f = 0; f < 10; f++) {
      ctrl.secondaryPhysics?.update(1 / 60, { windX: 8, windZ: -4, angularYawRate: 4, lod: 'full' });
    }
    for (const sr of scalpRoots) {
      assert.ok(
        sr.bone.quaternion.equals(sr.rest),
        `${label} scalp root ${sr.bone.name} rotated off head`,
      );
    }
    ctrl.secondaryPhysics?.dispose();
  }
});
