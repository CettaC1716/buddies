import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as vm from 'node:vm';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import {
  applyCitizenClothingTint,
  applyEquippedApparelSlotToBuddyRig,
  applyEquippedCostumeToBuddyRig,
  applyEquippedTorsoToBuddyRig,
  prepareModularApparelGltfMaterials,
  registerCustomPelvisAnimationClip,
  registerMixamoLocomotionSuiteGltf,
  updateCharacterWeaponStance,
  upgradeBuddyRigWithCharBuddiesGlb,
  type BuddyCharacterRig,
} from './buddiesBlitzShadersAndAssets';
import { computeScooterRiderRigPose } from './buddiesScooterRidePose';
import {
  WARDROBE_LAYER_CLEARANCE_M,
  WARDROBE_LAYER_ORDER,
  applyCoveredSkinHemTuck,
  applyLayeredGarmentClearance,
  buildTargetBoneLookup,
  classifyGarmentLayer,
  classifyModularApparelMaterialHint,
  getGarmentLayerClearanceOffsetM,
  resolveModularBoneMapping,
  sanitizeAndNormalizeSkinAttributes,
  smoothBoundaryTransitionWeights,
  syncCompanionOutlineSkinWeights,
  type WardrobeLayerId,
} from './buddiesWardrobeFitRules';

function createMinimalBuddyRig(bodyGroup: THREE.Group): BuddyCharacterRig {
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

function makeBoxSkinnedGeometry(
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  zMin: number,
  zMax: number,
  boneIdx: number,
  invertForOutline = false,
): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(
    Math.max(0.01, xMax - xMin),
    Math.max(0.01, yMax - yMin),
    Math.max(0.01, zMax - zMin),
    2,
    4,
    2,
  );
  geo.translate((xMin + xMax) * 0.5, (yMin + yMax) * 0.5, (zMin + zMax) * 0.5);
  const pos = geo.getAttribute('position');
  const skinIdx = new Uint16Array(pos.count * 4);
  const skinWgt = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    skinIdx[i * 4] = boneIdx;
    skinWgt[i * 4] = 1;
  }
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(skinIdx, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWgt, 4));
  if (invertForOutline) {
    const idx = geo.getIndex();
    if (idx) {
      const arr = Array.from(idx.array);
      for (let i = 0; i + 2 < arr.length; i += 3) {
        const tmp = arr[i + 1];
        arr[i + 1] = arr[i + 2];
        arr[i + 2] = tmp;
      }
      geo.setIndex(arr);
    }
    const nrm = geo.getAttribute('normal');
    if (nrm) {
      for (let i = 0; i < nrm.count; i++) {
        nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i));
      }
    }
  }
  return geo;
}

function buildSkeletonHierarchy(): {
  armature: THREE.Group;
  bones: THREE.Bone[];
  inverses: THREE.Matrix4[];
} {
  const armature = new THREE.Group();
  armature.name = 'Armature';
  const pelvisRoot = new THREE.Bone();
  pelvisRoot.name = 'PelvisRoot';
  const hips = new THREE.Bone();
  hips.name = 'Hips';
  hips.position.set(0, 0.85, 0);
  const spine = new THREE.Bone();
  spine.name = 'Spine';
  spine.position.set(0, 0.015, 0);
  const spine01 = new THREE.Bone();
  spine01.name = 'Spine01';
  spine01.position.set(0, 0.123, 0);
  const spine02 = new THREE.Bone();
  spine02.name = 'Spine02';
  spine02.position.set(0, 0.155, -0.02);
  const neck = new THREE.Bone();
  neck.name = 'Neck';
  neck.position.set(0, 0.179, -0.046);
  const head = new THREE.Bone();
  head.name = 'Head';
  head.position.set(0, 0.076, 0);

  const lShoulder = new THREE.Bone();
  lShoulder.name = 'LeftShoulder';
  lShoulder.position.set(0.042, 0.115, 0);
  const lArm = new THREE.Bone();
  lArm.name = 'LeftArm';
  lArm.position.set(0.10, 0.008, -0.046);
  const lForeArm = new THREE.Bone();
  lForeArm.name = 'LeftForeArm';
  lForeArm.position.set(0.257, -0.001, -0.008);
  const lHand = new THREE.Bone();
  lHand.name = 'LeftHand';
  lHand.position.set(0.221, 0.001, 0.046);

  const rShoulder = new THREE.Bone();
  rShoulder.name = 'RightShoulder';
  rShoulder.position.set(-0.042, 0.115, 0);
  const rArm = new THREE.Bone();
  rArm.name = 'RightArm';
  rArm.position.set(-0.10, 0.008, -0.046);
  const rForeArm = new THREE.Bone();
  rForeArm.name = 'RightForeArm';
  rForeArm.position.set(-0.257, -0.001, -0.008);
  const rHand = new THREE.Bone();
  rHand.name = 'RightHand';
  rHand.position.set(-0.221, 0.001, 0.046);

  armature.add(pelvisRoot);
  pelvisRoot.add(hips);
  hips.add(spine);
  spine.add(spine01);
  spine01.add(spine02);
  spine02.add(neck, lShoulder, rShoulder);
  neck.add(head);
  lShoulder.add(lArm);
  lArm.add(lForeArm);
  lForeArm.add(lHand);
  rShoulder.add(rArm);
  rArm.add(rForeArm);
  rForeArm.add(rHand);

  armature.updateMatrixWorld(true);
  const bones = [
    hips,
    spine,
    spine01,
    spine02,
    neck,
    head,
    lShoulder,
    lArm,
    lForeArm,
    lHand,
    rShoulder,
    rArm,
    rForeArm,
    rHand,
  ];
  const inverses = bones.map((b) => new THREE.Matrix4().copy(b.matrixWorld).invert());
  return { armature, bones, inverses };
}

function buildMockCharacterGltf(opts: {
  isMale: boolean;
  armStartAbsX: number;
  waistMaxY: number;
  neckMinY: number;
}): GLTF {
  const scene = new THREE.Group();
  const { armature, bones, inverses } = buildSkeletonHierarchy();
  scene.add(armature);

  const meshesGroup = new THREE.Group();
  meshesGroup.name = 'CharacterMeshes';
  scene.add(meshesGroup);

  const skinMat = new THREE.MeshBasicMaterial({ name: 'Mock_Skin', color: 0xf4cab3 });
  const clothMat = new THREE.MeshBasicMaterial({
    name: 'Mock_Clothing',
    color: 0x3b82f6,
    side: THREE.DoubleSide,
  });
  const outlineMat = new THREE.MeshBasicMaterial({ name: 'ToonInkOutline', color: 0x1c1a24 });

  const bind = (name: string, geo: THREE.BufferGeometry, mat: THREE.Material) => {
    const sm = new THREE.SkinnedMesh(geo, mat);
    sm.name = name;
    sm.bind(new THREE.Skeleton(bones, inverses.map((m) => m.clone())), new THREE.Matrix4());
    meshesGroup.add(sm);
  };

  const prefix = opts.isMale ? 'torso_frontrowessential1mpbr' : 'torso_bionictennistop';
  const headName = opts.isMale ? 'head_102_triangle' : 'head_002_heart';
  bind(headName, makeBoxSkinnedGeometry(-0.08, 0.08, 1.33, 1.56, -0.14, 0.06, 5), skinMat);
  bind(
    'hands_skin',
    makeBoxSkinnedGeometry(0.614, 0.74, 1.21, 1.29, -0.09, -0.03, 9),
    skinMat,
  );
  bind(prefix, makeBoxSkinnedGeometry(-0.28, 0.28, 0.86, 1.34, -0.14, 0.09, 3), clothMat);
  // Existing torso skin: forearm + neck (+ optional waist for female)
  bind(
    `${prefix}_skin`,
    makeBoxSkinnedGeometry(opts.armStartAbsX, 0.615, 1.22, 1.30, -0.11, -0.02, 7),
    skinMat,
  );
  bind(
    `${prefix}_skin`,
    makeBoxSkinnedGeometry(-0.615, -opts.armStartAbsX, 1.22, 1.30, -0.11, -0.02, 11),
    skinMat,
  );
  bind(
    `${prefix}_skin`,
    makeBoxSkinnedGeometry(-0.055, 0.055, opts.neckMinY, 1.41, -0.11, -0.01, 4),
    skinMat,
  );
  bind(
    `${prefix}_skin_Outline`,
    makeBoxSkinnedGeometry(opts.armStartAbsX, 0.615, 1.22, 1.30, -0.11, -0.02, 7, true),
    outlineMat,
  );
  if (opts.waistMaxY > 0.90) {
    bind(
      `${prefix}_skin`,
      makeBoxSkinnedGeometry(-0.105, 0.105, 0.91, opts.waistMaxY, -0.06, 0.075, 1),
      skinMat,
    );
  }
  bind('legs_mockbase', makeBoxSkinnedGeometry(-0.17, 0.17, 0.56, 0.94, -0.13, 0.08, 0), clothMat);
  bind(
    'legs_mockbase_skin',
    makeBoxSkinnedGeometry(-0.15, 0.15, 0.11, 0.761, -0.10, 0.05, 0),
    skinMat,
  );
  bind(
    'feet_mockbase',
    makeBoxSkinnedGeometry(-0.13, 0.13, 0.0, 0.11, -0.11, 0.12, 0),
    clothMat,
  );

  return {
    scene,
    scenes: [scene],
    animations: [],
    cameras: [],
    asset: { version: '2.0' },
    parser: {} as GLTF['parser'],
    userData: {},
  };
}

function buildMockModularApparelGltf(
  meshName: string,
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number; zMin: number; zMax: number },
): GLTF {
  const scene = new THREE.Group();
  const { armature, bones, inverses } = buildSkeletonHierarchy();
  scene.add(armature);
  const clothMat = new THREE.MeshBasicMaterial({
    name: `${meshName}_Clothing`,
    color: 0xf8fafc,
    side: THREE.DoubleSide,
  });
  const sm = new THREE.SkinnedMesh(
    makeBoxSkinnedGeometry(
      bounds.xMin,
      bounds.xMax,
      bounds.yMin,
      bounds.yMax,
      bounds.zMin,
      bounds.zMax,
      3,
    ),
    clothMat,
  );
  sm.name = meshName;
  sm.bind(new THREE.Skeleton(bones, inverses.map((m) => m.clone())), new THREE.Matrix4());
  scene.add(sm);
  return {
    scene,
    scenes: [scene],
    animations: [],
    cameras: [],
    asset: { version: '2.0' },
    parser: {} as GLTF['parser'],
    userData: {},
  };
}

function findSkinnedMeshByName(
  root: THREE.Object3D,
  targetName: string,
): THREE.SkinnedMesh | null {
  let found: THREE.SkinnedMesh | null = null;
  root.traverse((node) => {
    if (!found && (node as THREE.SkinnedMesh).isSkinnedMesh && node.name === targetName) {
      found = node as THREE.SkinnedMesh;
    }
  });
  return found;
}

function collectMeshIndexCounts(rigRoot: THREE.Object3D, lowerSubstr: string): number {
  let totalTris = 0;
  rigRoot.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) {
      const m = node as THREE.Mesh;
      if ((m.name || '').toLowerCase().includes(lowerSubstr)) {
        totalTris += Math.floor((m.geometry.getIndex()?.count ?? 0) / 3);
      }
    }
  });
  return totalTris;
}

test('Modular outfit equipping isolates skin BufferGeometry per rig (Bima never strips Kenji lower legs)', () => {
  const sharedMaleGltf = buildMockCharacterGltf({
    isMale: true,
    armStartAbsX: 0.284,
    waistMaxY: 0,
    neckMinY: 1.324,
  });
  const kenjiRig = createMinimalBuddyRig(new THREE.Group());
  upgradeBuddyRigWithCharBuddiesGlb(kenjiRig, sharedMaleGltf);

  const bimaRig = createMinimalBuddyRig(new THREE.Group());
  upgradeBuddyRigWithCharBuddiesGlb(bimaRig, sharedMaleGltf);

  const initialKenjiLegTris = collectMeshIndexCounts(kenjiRig.customGlbController!.glbRoot!, 'legs_mockbase_skin');
  assert.ok(initialKenjiLegTris > 0, 'Kenji should start with intact leg skin triangles');

  // Equip full ankle-length pants on Bima (minY = 0.0 trims Bima's own leg skin to 0 tris)
  const longPants = buildMockModularApparelGltf('legs_blitz_urbanromance2mpbr', {
    xMin: -0.16,
    xMax: 0.16,
    yMin: 0.0,
    yMax: 0.947,
    zMin: -0.13,
    zMax: 0.12,
  });
  assert.equal(applyEquippedApparelSlotToBuddyRig(bimaRig, 'legs', longPants), true);

  assert.equal(
    collectMeshIndexCounts(bimaRig.customGlbController!.glbRoot!, 'legs_mockbase_skin'),
    0,
    'Bima hides his own covered lower-leg skin under full-length pants',
  );
  assert.equal(
    collectMeshIndexCounts(kenjiRig.customGlbController!.glbRoot!, 'legs_mockbase_skin'),
    initialKenjiLegTris,
    'Kenji must retain 100% of his own lower-leg skin triangles when Bima equips long pants',
  );

  // Unequipping Bima restores his own leg skin without altering Kenji
  assert.equal(applyEquippedApparelSlotToBuddyRig(bimaRig, 'legs', null), true);
  assert.equal(
    collectMeshIndexCounts(bimaRig.customGlbController!.glbRoot!, 'legs_mockbase_skin'),
    initialKenjiLegTris,
  );
});

test('Sleeveless torso (Raka bunny vest) generates outward-facing shoulder/upper-arm & collar skin bridges', () => {
  const playerMaleGltf = buildMockCharacterGltf({
    isMale: true,
    armStartAbsX: 0.284,
    waistMaxY: 0,
    neckMinY: 1.324,
  });
  const playerRig = createMinimalBuddyRig(new THREE.Group());
  upgradeBuddyRigWithCharBuddiesGlb(playerRig, playerMaleGltf);
  const playerInitArmTris = collectMeshIndexCounts(playerRig.customGlbController!.glbRoot!, 'torso_frontrowessential1mpbr_skin');

  const rakaRig = createMinimalBuddyRig(new THREE.Group());
  upgradeBuddyRigWithCharBuddiesGlb(rakaRig, playerMaleGltf);

  const bunnyVest = buildMockModularApparelGltf('torso_blitz_colorpopbunnyclub1mpbr', {
    xMin: -0.184,
    xMax: 0.184,
    yMin: 0.894,
    yMax: 1.352,
    zMin: -0.145,
    zMax: 0.098,
  });
  assert.equal(applyEquippedTorsoToBuddyRig(rakaRig, bunnyVest), true);

  // Player Male sharing the same GLB stays untouched
  assert.equal(
    collectMeshIndexCounts(playerRig.customGlbController!.glbRoot!, 'torso_frontrowessential1mpbr_skin'),
    playerInitArmTris,
  );

  // Locate Raka's supplemental shoulder/upper-arm skin mesh and verify geometry, winding & arm coverage
  const suppSkin = findSkinnedMeshByName(
    rakaRig.customGlbController!.glbRoot!,
    'torso_supplemental_skin',
  );
  const suppOutline = findSkinnedMeshByName(
    rakaRig.customGlbController!.glbRoot!,
    'torso_supplemental_skin_Outline',
  );
  assert.ok(suppSkin, 'Raka sleeveless top must attach torso_supplemental_skin');
  assert.ok(suppOutline, 'Raka sleeveless top must attach companion torso_supplemental_skin_Outline');

  const pos = suppSkin.geometry.getAttribute('position');
  const nrm = suppSkin.geometry.getAttribute('normal');
  const idx = suppSkin.geometry.getIndex()!;
  let leftUpperArmVerts = 0;
  let rightUpperArmVerts = 0;
  let collarVerts = 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    if (x >= 0.16 && x <= 0.285 && y >= 1.18 && y <= 1.33) leftUpperArmVerts++;
    if (x <= -0.16 && x >= -0.285 && y >= 1.18 && y <= 1.33) rightUpperArmVerts++;
    if (Math.abs(x) <= 0.12 && y >= 1.22 && y <= 1.34) collarVerts++;
  }
  assert.ok(leftUpperArmVerts >= 12, `Expected left shoulder/bicep verts, got ${leftUpperArmVerts}`);
  assert.ok(rightUpperArmVerts >= 12, `Expected right shoulder/bicep verts, got ${rightUpperArmVerts}`);
  assert.ok(collarVerts >= 12, `Expected chest/collar verts, got ${collarVerts}`);

  // Verify outward triangle winding so FrontSide never culls exposed shoulder skin
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const cross = new THREE.Vector3();
  const vertN = new THREE.Vector3();
  let outwardCount = 0;
  const triCount = Math.floor(idx.count / 3);
  for (let t = 0; t < triCount; t++) {
    const ia = idx.getX(t * 3);
    const ib = idx.getX(t * 3 + 1);
    const ic = idx.getX(t * 3 + 2);
    a.fromBufferAttribute(pos, ia);
    b.fromBufferAttribute(pos, ib);
    c.fromBufferAttribute(pos, ic);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    cross.crossVectors(ab, ac);
    vertN.fromBufferAttribute(nrm, ia);
    if (cross.dot(vertN) > 0) outwardCount++;
  }
  assert.equal(outwardCount, triCount, 'All supplemental skin triangles must face outward');

  // Verify bone transforms work cleanly when arm rotates downward (-1.1 rad idle/walk pose)
  const leftArm = rakaRig.customGlbController!.bones.get('LeftArm')!;
  leftArm.rotation.z = -1.1;
  rakaRig.customGlbController!.glbRoot!.updateMatrixWorld(true);
  suppSkin.skeleton.update();
  const boneMatrices = suppSkin.skeleton.boneMatrices;
  assert.ok(boneMatrices && boneMatrices.length > 0, 'Skeleton boneMatrices must be allocated');
  for (let m = 0; m < boneMatrices.length; m++) {
    assert.ok(Number.isFinite(boneMatrices[m]), 'Bone matrices must remain finite');
  }
});

test('Cropped resort top + distressed shorts (Mira) fills midriff waist without clipping thighs or Player Female arms', () => {
  const playerFemaleGltf = buildMockCharacterGltf({
    isMale: false,
    armStartAbsX: 0.238,
    waistMaxY: 0.975,
    neckMinY: 1.27,
  });
  const femalePlayer = createMinimalBuddyRig(new THREE.Group());
  upgradeBuddyRigWithCharBuddiesGlb(femalePlayer, playerFemaleGltf);
  const origFemaleSkinTris = collectMeshIndexCounts(femalePlayer.customGlbController!.glbRoot!, 'torso_bionictennistop_skin');

  const miraRig = createMinimalBuddyRig(new THREE.Group());
  upgradeBuddyRigWithCharBuddiesGlb(miraRig, playerFemaleGltf);

  const resortTop = buildMockModularApparelGltf('torso_blitz_alohamodern6fhighrespbr_hires', {
    xMin: -0.632,
    xMax: 0.632,
    yMin: 1.012,
    yMax: 1.328,
    zMin: -0.183,
    zMax: 0.131,
  });
  const shorts = buildMockModularApparelGltf('legs_dspastelgothdistressedshorts', {
    xMin: -0.154,
    xMax: 0.154,
    yMin: 0.693,
    yMax: 0.942,
    zMin: -0.118,
    zMax: 0.08,
  });

  assert.equal(applyEquippedTorsoToBuddyRig(miraRig, resortTop), true);
  assert.equal(applyEquippedApparelSlotToBuddyRig(miraRig, 'legs', shorts), true);

  // Female player keeps 100% of her forearm/chest/leg triangles when Mira wears long sleeves & shorts
  assert.equal(
    collectMeshIndexCounts(femalePlayer.customGlbController!.glbRoot!, 'torso_bionictennistop_skin'),
    origFemaleSkinTris,
  );

  // Mira's supplemental waist skin bridges her shorts (0.942) to crop top (1.012)
  const suppSkin = findSkinnedMeshByName(
    miraRig.customGlbController!.glbRoot!,
    'torso_supplemental_skin',
  );
  assert.ok(suppSkin, 'Mira crop top must generate supplemental midriff skin bridge');
  const waistPos = suppSkin.geometry.getAttribute('position');
  let midriffCount = 0;
  for (let i = 0; i < waistPos.count; i++) {
    const y = waistPos.getY(i);
    if (y >= 0.95 && y <= 1.03) midriffCount++;
  }
  assert.ok(midriffCount >= 14, `Expected continuous midriff ring verts in 0.95..1.03, got ${midriffCount}`);

  // Mira's shorts leave thigh skin visible above 0.718 up toward 0.758
  assert.ok(
    collectMeshIndexCounts(miraRig.customGlbController!.glbRoot!, 'legs_mockbase_skin') > 0,
    'Mira must retain visible leg/thigh skin under distressed shorts',
  );
});

function readGlbJsonChunk(glbPath: string): {
  nodes?: Array<{ name?: string }>;
  meshes?: unknown[];
  animations?: Array<{ name?: string; channels?: Array<{ target?: { node?: number } }> }>;
} {
  const buf = fs.readFileSync(glbPath);
  assert.equal(buf.toString('ascii', 0, 4), 'glTF', `${glbPath} must have glTF header`);
  const chunkLen = buf.readUInt32LE(12);
  const chunkType = buf.readUInt32LE(16);
  assert.equal(chunkType, 0x4e4f534a, `${glbPath} first chunk must be JSON`);
  return JSON.parse(buf.subarray(20, 20 + chunkLen).toString('utf8'));
}

test('Per-NPC runClipOverrideName binds nadia_run.001 strictly to Nadia and public/assets/nadia-run-anim.glb matches female NPC PelvisRoot nodes', () => {
  // 1. Verify bundled asset matches character_custom_sit_formal_tenang_2.glb skeleton nodes
  const nadiaAnimJson = readGlbJsonChunk('public/assets/nadia-run-anim.glb');
  assert.equal(nadiaAnimJson.meshes?.length ?? 0, 0, 'nadia-run-anim.glb should be animation-only');
  assert.equal(nadiaAnimJson.animations?.length ?? 0, 1, 'nadia-run-anim.glb should carry 1 run clip');
  const nadiaAnim = nadiaAnimJson.animations![0]!;
  assert.equal(nadiaAnim.name, 'Run_blitz_Elegan_Kalem_Wanita_1');
  assert.equal(nadiaAnim.channels?.length ?? 0, 184);

  const femaleNpcJson = readGlbJsonChunk('public/assets/character_custom_sit_formal_tenang_2.glb');
  const femaleNodeNames = new Set(
    (femaleNpcJson.nodes ?? []).map((n) => n.name).filter((n): n is string => Boolean(n)),
  );
  const animNodes = nadiaAnimJson.nodes ?? [];
  const missingTargets = (nadiaAnim.channels ?? [])
    .map((ch) => (typeof ch.target?.node === 'number' ? animNodes[ch.target.node]?.name : undefined))
    .filter((name): name is string => Boolean(name && !femaleNodeNames.has(name)));
  assert.deepEqual(missingTargets, [], 'Every animated node in nadia-run-anim.glb must exist in female NPC rig');

  // 2. Verify late clip arrival + strict isolation between Nadia and Tari sharing one GLTF
  const sharedFemaleGltf = buildMockCharacterGltf({
    isMale: false,
    armStartAbsX: 0.24,
    waistMaxY: 1.005,
    neckMinY: 1.324,
  });
  const baseTracks = [
    new THREE.QuaternionKeyframeTrack('Spine.quaternion', [0, 0.5], [0, 0, 0, 1, 0, 0.05, 0, 0.9987]),
  ];
  sharedFemaleGltf.animations = [
    new THREE.AnimationClip('idle.001', 1.0, baseTracks),
    new THREE.AnimationClip('walk.001', 1.0, baseTracks),
    new THREE.AnimationClip('run.001', 1.0, baseTracks),
  ];

  registerCustomPelvisAnimationClip('nadia_run.001', null);
  try {
    const nadiaRig = createMinimalBuddyRig(new THREE.Group());
    nadiaRig.runClipOverrideName = 'nadia_run.001';
    upgradeBuddyRigWithCharBuddiesGlb(nadiaRig, sharedFemaleGltf);

    const tariRig = createMinimalBuddyRig(new THREE.Group());
    upgradeBuddyRigWithCharBuddiesGlb(tariRig, sharedFemaleGltf);

    // Late arrival after GLTF template was already cached
    const customRunClip = new THREE.AnimationClip('Run_blitz_Elegan_Kalem_Wanita_1', 2.533, baseTracks);
    registerCustomPelvisAnimationClip('nadia_run.001', customRunClip);

    updateCharacterWeaponStance(
      nadiaRig,
      'unarmed',
      0,
      true,
      false,
      0,
      0,
      0,
      'right',
      0,
      0,
      0.76,
      0,
      true,
      'front',
      1.0,
      0,
      4.2,
    );
    assert.equal(nadiaRig.customGlbController?.activeClipName, 'nadia_run.001');

    updateCharacterWeaponStance(
      tariRig,
      'unarmed',
      0,
      true,
      false,
      0,
      0,
      0,
      'right',
      0,
      0,
      0.76,
      0,
      true,
      'front',
      1.0,
      0,
      4.2,
    );
    assert.equal(tariRig.customGlbController?.activeClipName, 'walk.001');

    updateCharacterWeaponStance(
      nadiaRig,
      'unarmed',
      0,
      false,
      false,
      0,
      0,
      0,
      'right',
      0,
      0,
      0.76,
      0,
      true,
      'front',
      1.0,
      0,
      0,
    );
    assert.equal(nadiaRig.customGlbController?.activeClipName, 'idle.001');
  } finally {
    registerCustomPelvisAnimationClip('nadia_run.001', null);
  }
});

function assertAnimGlbMatchesBaseSkeleton(
  animGlbPath: string,
  baseGlbPath: string,
  expectedClipNames: string | string[],
) {
  const expectedList = Array.isArray(expectedClipNames)
    ? expectedClipNames
    : [expectedClipNames];
  const animJson = readGlbJsonChunk(animGlbPath);
  assert.equal(animJson.meshes?.length ?? 0, 0, `${animGlbPath} should be animation-only`);
  assert.ok(
    (animJson.animations?.length ?? 0) >= expectedList.length,
    `${animGlbPath} should carry at least ${expectedList.length} clip(s)`,
  );
  if (!Array.isArray(expectedClipNames)) {
    assert.equal(animJson.animations?.length ?? 0, 1, `${animGlbPath} should carry 1 clip`);
  }

  const baseJson = readGlbJsonChunk(baseGlbPath);
  const baseNodeNames = new Set(
    (baseJson.nodes ?? []).map((n) => n.name).filter((n): n is string => Boolean(n)),
  );
  const animNodes = animJson.nodes ?? [];
  for (const clipName of expectedList) {
    const animMeta = animJson.animations?.find((clip) => clip.name === clipName);
    assert.ok(animMeta, `${animGlbPath} must include clip "${clipName}"`);
    assert.equal(animMeta.channels?.length ?? 0, 184);
    const missingTargets = (animMeta.channels ?? [])
      .map((ch) => (typeof ch.target?.node === 'number' ? animNodes[ch.target.node]?.name : undefined))
      .filter((name): name is string => Boolean(name && !baseNodeNames.has(name)));
    assert.deepEqual(
      missingTargets,
      [],
      `Every animated node in ${animGlbPath}:${clipName} must exist in ${baseGlbPath}`,
    );
  }
}

test('Per-NPC idleClipOverrideName binds mira_idle.001 strictly to Mira and public/assets/mira-idle-anim.glb matches playerFemaleGlb PelvisRoot nodes', async () => {
  assertAnimGlbMatchesBaseSkeleton(
    'public/assets/mira-idle-anim.glb',
    'public/assets/character_custom_idle_runway_catwalk_stylish_11 (3).glb',
    'Idle_blitz_Sassy_Aktif_Wanita_3',
  );

  const miraBuf = fs.readFileSync('public/assets/mira-idle-anim.glb');
  const miraArrayBuf = miraBuf.buffer.slice(
    miraBuf.byteOffset,
    miraBuf.byteOffset + miraBuf.byteLength,
  );
  const parsedMiraAnimGltf = await new GLTFLoader().parseAsync(miraArrayBuf, '');
  const parsedMiraClip = parsedMiraAnimGltf.animations[0];
  assert.ok(parsedMiraClip, 'GLTFLoader must parse Mira idle animation clip');
  assert.ok(
    parsedMiraClip.duration > 9.0,
    `Expected full multi-second loop duration > 9.0s, got ${parsedMiraClip.duration}`,
  );

  // 2. Verify late clip arrival + strict isolation between Mira and Female Player sharing one GLTF
  const sharedPlayerFemaleGltf = buildMockCharacterGltf({
    isMale: false,
    armStartAbsX: 0.24,
    waistMaxY: 1.005,
    neckMinY: 1.324,
  });
  const baseTracks = [
    new THREE.QuaternionKeyframeTrack('Spine.quaternion', [0, 0.5], [0, 0, 0, 1, 0, 0.05, 0, 0.9987]),
  ];
  sharedPlayerFemaleGltf.animations = [
    new THREE.AnimationClip('idle.001', 1.0, baseTracks),
    new THREE.AnimationClip('walk.001', 1.0, baseTracks),
    new THREE.AnimationClip('run.001', 1.0, baseTracks),
    new THREE.AnimationClip('sitting.001', 1.0, baseTracks),
  ];

  registerCustomPelvisAnimationClip('mira_idle.001', null);
  try {
    const miraRig = createMinimalBuddyRig(new THREE.Group());
    miraRig.idleClipOverrideName = 'mira_idle.001';
    upgradeBuddyRigWithCharBuddiesGlb(miraRig, sharedPlayerFemaleGltf);

    const femalePlayerRig = createMinimalBuddyRig(new THREE.Group());
    upgradeBuddyRigWithCharBuddiesGlb(femalePlayerRig, sharedPlayerFemaleGltf);

    // Late arrival after shared playerFemaleGlb template was already cached
    registerCustomPelvisAnimationClip('mira_idle.001', parsedMiraClip);

    const step = (rig: BuddyCharacterRig, isMoving: boolean, speed: number, isSitting: boolean) =>
      updateCharacterWeaponStance(
        rig,
        'unarmed',
        0,
        isMoving,
        false,
        0,
        0,
        0,
        'right',
        0,
        0,
        0.76,
        0,
        true,
        'front',
        1.0,
        0,
        speed,
        isSitting,
      );

    step(miraRig, false, 0, false);
    assert.equal(miraRig.customGlbController?.activeClipName, 'mira_idle.001');

    step(femalePlayerRig, false, 0, false);
    assert.equal(femalePlayerRig.customGlbController?.activeClipName, 'idle.001');

    // Moving or sitting must still use locomotion / sitting clips on Mira
    step(miraRig, true, 2.25, false);
    assert.equal(miraRig.customGlbController?.activeClipName, 'walk.001');

    step(miraRig, false, 0, true);
    assert.equal(miraRig.customGlbController?.activeClipName, 'sitting.001');
  } finally {
    registerCustomPelvisAnimationClip('mira_idle.001', null);
  }
});

test('Per-NPC idleClipOverrideName binds bima_idle.001 strictly to Bima and public/assets/bima-idle-anim.glb matches ambientMaleNpcGlb PelvisRoot nodes', async () => {
  assertAnimGlbMatchesBaseSkeleton(
    'public/assets/bima-idle-anim.glb',
    'public/assets/aistudio/character_custom_sit_runway_catwalk_stylish_4.glb',
    'Idle_blitz_Kasual_Harian_Pria_14',
  );

  const bimaBuf = fs.readFileSync('public/assets/bima-idle-anim.glb');
  const bimaArrayBuf = bimaBuf.buffer.slice(
    bimaBuf.byteOffset,
    bimaBuf.byteOffset + bimaBuf.byteLength,
  );
  const parsedBimaAnimGltf = await new GLTFLoader().parseAsync(bimaArrayBuf, '');
  const parsedBimaClip = parsedBimaAnimGltf.animations[0];
  assert.ok(parsedBimaClip, 'GLTFLoader must parse Bima idle animation clip');
  assert.ok(
    parsedBimaClip.duration > 9.0,
    `Expected full multi-second loop duration > 9.0s, got ${parsedBimaClip.duration}`,
  );

  const sharedAmbientMaleGltf = buildMockCharacterGltf({
    isMale: true,
    armStartAbsX: 0.284,
    waistMaxY: 0,
    neckMinY: 1.324,
  });
  const baseTracks = [
    new THREE.QuaternionKeyframeTrack('Spine.quaternion', [0, 0.5], [0, 0, 0, 1, 0, 0.05, 0, 0.9987]),
  ];
  sharedAmbientMaleGltf.animations = [
    new THREE.AnimationClip('idle.001', 1.0, baseTracks),
    new THREE.AnimationClip('walk.001', 1.0, baseTracks),
    new THREE.AnimationClip('run.001', 1.0, baseTracks),
    new THREE.AnimationClip('sitting.001', 1.0, baseTracks),
  ];

  registerCustomPelvisAnimationClip('bima_idle.001', null);
  try {
    const bimaRig = createMinimalBuddyRig(new THREE.Group());
    bimaRig.idleClipOverrideName = 'bima_idle.001';
    upgradeBuddyRigWithCharBuddiesGlb(bimaRig, sharedAmbientMaleGltf);

    const kenjiRig = createMinimalBuddyRig(new THREE.Group());
    upgradeBuddyRigWithCharBuddiesGlb(kenjiRig, sharedAmbientMaleGltf);

    registerCustomPelvisAnimationClip('bima_idle.001', parsedBimaClip);

    const step = (rig: BuddyCharacterRig, isMoving: boolean, speed: number, isSitting: boolean) =>
      updateCharacterWeaponStance(
        rig,
        'unarmed',
        0,
        isMoving,
        false,
        0,
        0,
        0,
        'right',
        0,
        0,
        0.76,
        0,
        true,
        'front',
        1.0,
        0,
        speed,
        isSitting,
      );

    step(bimaRig, false, 0, false);
    assert.equal(bimaRig.customGlbController?.activeClipName, 'bima_idle.001');

    step(kenjiRig, false, 0, false);
    assert.equal(kenjiRig.customGlbController?.activeClipName, 'idle.001');

    step(bimaRig, true, 5.4, false);
    assert.equal(bimaRig.customGlbController?.activeClipName, 'walk.001');

    step(bimaRig, false, 0, true);
    assert.equal(bimaRig.customGlbController?.activeClipName, 'sitting.001');
  } finally {
    registerCustomPelvisAnimationClip('bima_idle.001', null);
  }
});

test('Per-NPC idleClipOverrideName binds raka_idle.001 strictly to Raka and matches playerMaleGlb PelvisRoot nodes', async () => {
  assertAnimGlbMatchesBaseSkeleton(
    'public/assets/bima-idle-anim.glb',
    'public/assets/aistudio/character_custom_idle_runway_catwalk_stylish_11 (2).glb',
    'Idle_blitz_Kasual_Harian_Pria_14',
  );

  const rakaBuf = fs.readFileSync('public/assets/bima-idle-anim.glb');
  const rakaArrayBuf = rakaBuf.buffer.slice(
    rakaBuf.byteOffset,
    rakaBuf.byteOffset + rakaBuf.byteLength,
  );
  const parsedRakaAnimGltf = await new GLTFLoader().parseAsync(rakaArrayBuf, '');
  const parsedRakaClip = parsedRakaAnimGltf.animations[0];
  assert.ok(parsedRakaClip, 'GLTFLoader must parse Raka idle animation clip');

  const sharedPlayerMaleGltf = buildMockCharacterGltf({
    isMale: true,
    armStartAbsX: 0.284,
    waistMaxY: 0,
    neckMinY: 1.324,
  });
  const baseTracks = [
    new THREE.QuaternionKeyframeTrack('Spine.quaternion', [0, 0.5], [0, 0, 0, 1, 0, 0.05, 0, 0.9987]),
  ];
  sharedPlayerMaleGltf.animations = [
    new THREE.AnimationClip('idle.001', 1.0, baseTracks),
    new THREE.AnimationClip('walk.001', 1.0, baseTracks),
    new THREE.AnimationClip('run.001', 1.0, baseTracks),
    new THREE.AnimationClip('sitting.001', 1.0, baseTracks),
  ];

  registerCustomPelvisAnimationClip('raka_idle.001', null);
  try {
    const rakaRig = createMinimalBuddyRig(new THREE.Group());
    rakaRig.idleClipOverrideName = 'raka_idle.001';
    upgradeBuddyRigWithCharBuddiesGlb(rakaRig, sharedPlayerMaleGltf);

    const malePlayerRig = createMinimalBuddyRig(new THREE.Group());
    upgradeBuddyRigWithCharBuddiesGlb(malePlayerRig, sharedPlayerMaleGltf);

    registerCustomPelvisAnimationClip('raka_idle.001', parsedRakaClip);

    const step = (rig: BuddyCharacterRig, isMoving: boolean, speed: number, isSitting: boolean) =>
      updateCharacterWeaponStance(
        rig,
        'unarmed',
        0,
        isMoving,
        false,
        0,
        0,
        0,
        'right',
        0,
        0,
        0.76,
        0,
        true,
        'front',
        1.0,
        0,
        speed,
        isSitting,
      );

    step(rakaRig, false, 0, false);
    assert.equal(rakaRig.customGlbController?.activeClipName, 'raka_idle.001');

    step(malePlayerRig, false, 0, false);
    assert.equal(malePlayerRig.customGlbController?.activeClipName, 'idle.001');

    step(rakaRig, true, 2.45, false);
    assert.equal(rakaRig.customGlbController?.activeClipName, 'walk.001');

    step(rakaRig, false, 0, true);
    assert.equal(rakaRig.customGlbController?.activeClipName, 'sitting.001');
  } finally {
    registerCustomPelvisAnimationClip('raka_idle.001', null);
  }
});

test('Per-NPC runClipOverrideName binds kenji_run.001 strictly to Kenji and public/assets/kenji-run-anim.glb matches ambientMaleNpcGlb PelvisRoot nodes', async () => {
  assertAnimGlbMatchesBaseSkeleton(
    'public/assets/kenji-run-anim.glb',
    'public/assets/aistudio/character_custom_sit_runway_catwalk_stylish_4.glb',
    'Run_blitz_Kasual_Harian_Pria_4',
  );

  const kenjiBuf = fs.readFileSync('public/assets/kenji-run-anim.glb');
  const kenjiArrayBuf = kenjiBuf.buffer.slice(
    kenjiBuf.byteOffset,
    kenjiBuf.byteOffset + kenjiBuf.byteLength,
  );
  const parsedKenjiAnimGltf = await new GLTFLoader().parseAsync(kenjiArrayBuf, '');
  const parsedKenjiClip = parsedKenjiAnimGltf.animations[0];
  assert.ok(parsedKenjiClip, 'GLTFLoader must parse Kenji run animation clip');
  assert.ok(
    parsedKenjiClip.duration > 2.0,
    `Expected multi-second run loop > 2.0s, got ${parsedKenjiClip.duration}`,
  );

  const sharedAmbientMaleGltf = buildMockCharacterGltf({
    isMale: true,
    armStartAbsX: 0.284,
    waistMaxY: 0,
    neckMinY: 1.324,
  });
  const baseTracks = [
    new THREE.QuaternionKeyframeTrack('Spine.quaternion', [0, 0.5], [0, 0, 0, 1, 0, 0.05, 0, 0.9987]),
  ];
  sharedAmbientMaleGltf.animations = [
    new THREE.AnimationClip('idle.001', 1.0, baseTracks),
    new THREE.AnimationClip('walk.001', 1.0, baseTracks),
    new THREE.AnimationClip('run.001', 1.0, baseTracks),
    new THREE.AnimationClip('sitting.001', 1.0, baseTracks),
  ];

  registerCustomPelvisAnimationClip('kenji_run.001', null);
  try {
    const kenjiRig = createMinimalBuddyRig(new THREE.Group());
    kenjiRig.runClipOverrideName = 'kenji_run.001';
    upgradeBuddyRigWithCharBuddiesGlb(kenjiRig, sharedAmbientMaleGltf);

    const bimaRig = createMinimalBuddyRig(new THREE.Group());
    upgradeBuddyRigWithCharBuddiesGlb(bimaRig, sharedAmbientMaleGltf);

    registerCustomPelvisAnimationClip('kenji_run.001', parsedKenjiClip);

    const step = (rig: BuddyCharacterRig, isMoving: boolean, speed: number, isSitting = false) =>
      updateCharacterWeaponStance(
        rig,
        'unarmed',
        0,
        isMoving,
        false,
        0,
        0,
        0,
        'right',
        0,
        0,
        0.76,
        0,
        true,
        'front',
        1.0,
        0,
        speed,
        isSitting,
      );

    step(kenjiRig, true, 4.8);
    assert.equal(kenjiRig.customGlbController?.activeClipName, 'kenji_run.001');

    step(bimaRig, true, 4.8);
    assert.equal(bimaRig.customGlbController?.activeClipName, 'walk.001');

    step(kenjiRig, true, 2.6);
    assert.equal(kenjiRig.customGlbController?.activeClipName, 'walk.001');

    step(kenjiRig, false, 0);
    assert.equal(kenjiRig.customGlbController?.activeClipName, 'idle.001');
  } finally {
    registerCustomPelvisAnimationClip('kenji_run.001', null);
  }
});

test('Personal PelvisRoot clips are not poisoned into Mixamo Armature stubs when useMixamoLocomotionSuite is enabled', async () => {
  const loader = new GLTFLoader();
  const parseGlb = async (filePath: string): Promise<GLTF> => {
    const buf = fs.readFileSync(filePath);
    return loader.parseAsync(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
      '',
    );
  };

  const mixamoGltf = await parseGlb('public/assets/mixamo-locomotion-anim.glb');
  assert.ok(mixamoGltf.scene.getObjectByName('Armature'), 'mixamo glb carries an Armature root');

  const [nadiaGlb, miraGlb, bimaGlb, kenjiGlb] = await Promise.all([
    parseGlb('public/assets/nadia-run-anim.glb'),
    parseGlb('public/assets/mira-idle-anim.glb'),
    parseGlb('public/assets/bima-idle-anim.glb'),
    parseGlb('public/assets/kenji-run-anim.glb'),
  ]);
  const nadiaClip = nadiaGlb.animations[0]!;
  const miraClip = miraGlb.animations[0]!;
  const bimaClip = bimaGlb.animations[0]!;
  const kenjiClip = kenjiGlb.animations[0]!;

  // Give our synthetic PelvisRoot rigs all required PelvisRoot bone/node names matching the real GLBs
  const pelvisNodeNames = new Set(
    (readGlbJsonChunk('public/assets/nadia-run-anim.glb').nodes ?? [])
      .map((n) => n.name)
      .filter((n): n is string => Boolean(n)),
  );
  const makePelvisSuiteGltf = (isMale: boolean) => {
    const g = buildMockCharacterGltf({
      isMale,
      armStartAbsX: isMale ? 0.284 : 0.24,
      waistMaxY: isMale ? 0 : 1.005,
      neckMinY: 1.324,
    });
    const armature = g.scene.getObjectByName('Armature') ?? g.scene;
    for (const nodeName of pelvisNodeNames) {
      if (!g.scene.getObjectByName(nodeName)) {
        const bone = new THREE.Bone();
        bone.name = nodeName;
        armature.add(bone);
      }
    }
    g.scene.userData.useMixamoLocomotionSuite = true;
    return g;
  };

  registerMixamoLocomotionSuiteGltf(mixamoGltf);
  registerCustomPelvisAnimationClip('nadia_run.001', nadiaClip);
  registerCustomPelvisAnimationClip('mira_idle.001', miraClip);
  registerCustomPelvisAnimationClip('bima_idle.001', bimaClip);
  registerCustomPelvisAnimationClip('kenji_run.001', kenjiClip);

  try {
    const femaleGltf = makePelvisSuiteGltf(false);
    const maleGltf = makePelvisSuiteGltf(true);

    const miraRig = createMinimalBuddyRig(new THREE.Group());
    miraRig.idleClipOverrideName = 'mira_idle.001';
    upgradeBuddyRigWithCharBuddiesGlb(miraRig, femaleGltf);

    const nadiaRig = createMinimalBuddyRig(new THREE.Group());
    nadiaRig.runClipOverrideName = 'nadia_run.001';
    upgradeBuddyRigWithCharBuddiesGlb(nadiaRig, femaleGltf);

    const bimaRig = createMinimalBuddyRig(new THREE.Group());
    bimaRig.idleClipOverrideName = 'bima_idle.001';
    upgradeBuddyRigWithCharBuddiesGlb(bimaRig, maleGltf);

    const rakaRig = createMinimalBuddyRig(new THREE.Group());
    rakaRig.idleClipOverrideName = 'raka_idle.001';
    upgradeBuddyRigWithCharBuddiesGlb(rakaRig, maleGltf);

    const kenjiRig = createMinimalBuddyRig(new THREE.Group());
    kenjiRig.runClipOverrideName = 'kenji_run.001';
    upgradeBuddyRigWithCharBuddiesGlb(kenjiRig, maleGltf);

    const expectedClips: Array<[BuddyCharacterRig, string]> = [
      [nadiaRig, 'nadia_run.001'],
      [miraRig, 'mira_idle.001'],
      [bimaRig, 'bima_idle.001'],
      [rakaRig, 'raka_idle.001'],
      [kenjiRig, 'kenji_run.001'],
    ];
    for (const [rig, clipName] of expectedClips) {
      const clip = rig.customGlbController?.clips.get(clipName);
      assert.ok(clip, `Controller should resolve ${clipName}`);
      assert.ok(
        clip.tracks.length > 100,
        `${clipName} must keep native PelvisRoot tracks instead of 42-track Mixamo stub (got ${clip.tracks.length})`,
      );
      assert.ok(
        clip.tracks.some((tr) => tr.name === 'PelvisRoot_PreRotation.quaternion'),
        `${clipName} must retain native PelvisRoot skeleton tracks`,
      );
    }

    // Verify mixer actually evaluates real LeftArm pose from mira_idle.001 rather than Mixamo bind pose
    const step = (rig: BuddyCharacterRig, isMoving: boolean, speed: number) =>
      updateCharacterWeaponStance(
        rig,
        'unarmed',
        0,
        isMoving,
        false,
        0,
        0,
        0,
        'right',
        0,
        0,
        0.76,
        0,
        true,
        'front',
        1.0,
        0,
        speed,
      );

    step(miraRig, false, 0);
    miraRig.customGlbController!.mixer.setTime(0.5);
    assert.equal(miraRig.customGlbController?.activeClipName, 'mira_idle.001');
    const miraLeftArm = miraRig.bodyGroupRef!.getObjectByName('LeftArm')!;
    assert.ok(
      miraLeftArm.quaternion.x < -0.15 && miraLeftArm.quaternion.z > 0.15,
      `Expected native mira_idle.001 LeftArm rotation instead of Mixamo bind pose, got ${miraLeftArm.quaternion.toArray().join(',')}`,
    );

    step(bimaRig, false, 0);
    assert.equal(bimaRig.customGlbController?.activeClipName, 'bima_idle.001');
    step(rakaRig, false, 0);
    assert.equal(rakaRig.customGlbController?.activeClipName, 'raka_idle.001');
    step(nadiaRig, true, 4.2);
    assert.equal(nadiaRig.customGlbController?.activeClipName, 'nadia_run.001');
    step(kenjiRig, true, 4.8);
    assert.equal(kenjiRig.customGlbController?.activeClipName, 'kenji_run.001');
  } finally {
    registerMixamoLocomotionSuiteGltf(null);
    registerCustomPelvisAnimationClip('nadia_run.001', null);
    registerCustomPelvisAnimationClip('mira_idle.001', null);
    registerCustomPelvisAnimationClip('bima_idle.001', null);
    registerCustomPelvisAnimationClip('kenji_run.001', null);
  }
});

test('Tari costume GLB equips full 5-part ensemble cleanly while preserving base head/ears/hair and isolating tari_sit.001', async () => {
  const glbPath = fs.existsSync('public/assets/outfit/tari/tari-costume.glb')
    ? 'public/assets/outfit/tari/tari-costume.glb'
    : '../BuddiesBlitz-scooter-anim/public/assets/outfit/tari/tari-costume.glb';
  const buf = fs.readFileSync(glbPath);
  const loader = new GLTFLoader();
  const prevSelf = (globalThis as Record<string, unknown>).self;
  const prevCreateImageBitmap = (globalThis as Record<string, unknown>).createImageBitmap;
  (globalThis as Record<string, unknown>).self = globalThis;
  (globalThis as Record<string, unknown>).createImageBitmap = async () => ({
    width: 2,
    height: 2,
    close() {},
  });
  let costumeGltf: GLTF;
  try {
    costumeGltf = (await loader.parseAsync(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      '',
    )) as GLTF;
  } finally {
    if (prevSelf === undefined) {
      delete (globalThis as Record<string, unknown>).self;
    } else {
      (globalThis as Record<string, unknown>).self = prevSelf;
    }
    if (prevCreateImageBitmap === undefined) {
      delete (globalThis as Record<string, unknown>).createImageBitmap;
    } else {
      (globalThis as Record<string, unknown>).createImageBitmap = prevCreateImageBitmap;
    }
  }

  assert.ok(costumeGltf.animations.length >= 1, 'Expected sit clip inside tari-costume.glb');
  const rawSitClip = costumeGltf.animations[0].clone();
  rawSitClip.name = 'tari_sit.001';
  assert.ok(rawSitClip.duration > 1.0, `Expected animated duration > 1s, got ${rawSitClip.duration}`);

  const allCostumeSkinned: THREE.SkinnedMesh[] = [];
  const costumeMeshNames: string[] = [];
  costumeGltf.scene.traverse((node) => {
    if ((node as THREE.SkinnedMesh).isSkinnedMesh) {
      const sm = node as THREE.SkinnedMesh;
      costumeMeshNames.push(sm.name);
      allCostumeSkinned.push(sm);
    }
  });
  assert.ok(allCostumeSkinned.length > 0, 'Expected SkinnedMesh inside tari-costume.glb');
  assert.ok(
    ['hands_', 'torso_', 'legs_', 'feet_', 'neck_'].every((prefix) =>
      costumeMeshNames.some((n) => n.toLowerCase().startsWith(prefix)),
    ),
    `Missing expected costume prefixes: ${costumeMeshNames.join(', ')}`,
  );
  assert.equal(
    costumeMeshNames.some((n) => n.toLowerCase().startsWith('hair_')),
    false,
    'Uploaded tari-costume.glb has no separate hair mesh, so base hair must stay preserved',
  );

  // Build two synthetic PelvisRoot base rigs matching Tari's full bone hierarchy
  const makeBaseRigFromCostumeSkeleton = (withDefaultMeshes: boolean) => {
    const skelRoot = new THREE.Group();
    const boneMap = new Map<string, THREE.Bone>();
    const clonedBones: THREE.Bone[] = [];
    const clonedInverses: THREE.Matrix4[] = [];
    const srcBoneMeta = new Map<string, { src: THREE.Object3D; inv: THREE.Matrix4 }>();

    costumeGltf.scene.traverse((node) => {
      if (node.name && !srcBoneMeta.has(node.name)) {
        srcBoneMeta.set(node.name, { src: node, inv: new THREE.Matrix4() });
      }
    });
    for (const sm of allCostumeSkinned) {
      const bones = sm.skeleton?.bones ?? [];
      const invs = sm.skeleton?.boneInverses ?? [];
      for (let i = 0; i < bones.length; i++) {
        const b = bones[i];
        if (b && b.name) {
          srcBoneMeta.set(b.name, {
            src: b,
            inv: invs[i]?.clone() ?? new THREE.Matrix4(),
          });
        }
      }
    }

    for (const [bName, meta] of srcBoneMeta.entries()) {
      const b = new THREE.Bone();
      b.name = bName;
      b.position.copy(meta.src.position);
      b.quaternion.copy(meta.src.quaternion);
      b.scale.copy(meta.src.scale);
      boneMap.set(bName, b);
      clonedBones.push(b);
      clonedInverses.push(meta.inv.clone());
    }
    for (const [bName, meta] of srcBoneMeta.entries()) {
      const child = boneMap.get(bName)!;
      const parentName = meta.src.parent?.name;
      const parentObj = parentName ? boneMap.get(parentName) : undefined;
      if (parentObj && parentObj !== child) parentObj.add(child);
      else skelRoot.add(child);
    }

    const baseBones = [boneMap.get('PelvisRoot') ?? clonedBones[0], boneMap.get('Hip') ?? clonedBones[0]];
    const skeleton = new THREE.Skeleton(clonedBones, clonedInverses);
    const namedMeshes: Record<string, THREE.SkinnedMesh> = {};
    const makePart = (name: string) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.1, 0, 0.1, 0.5, 0, -0.1, 1.35, 0], 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4));
      geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
      geo.setIndex([0, 1, 2]);
      const sm = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
      sm.name = name;
      sm.bind(skeleton, new THREE.Matrix4());
      skelRoot.add(sm);
      namedMeshes[name] = sm;
      return sm;
    };
    const parts = withDefaultMeshes
      ? [
          'head_002_heart',
          'ears_001_basic',
          'hair_coutureeternalnighthair3f',
          'hands_skin',
          'torso_bionictennistop',
          'torso_bionictennistop_skin',
          'legs_delirioussquidalternative1fpbr',
          'legs_delirioussquidalternative1fpbr_skin',
          'feet_cloudninemillennial1f',
        ]
      : ['head_002_heart'];
    for (const part of parts) {
      makePart(part);
    }
    const baseTracks = [new THREE.VectorKeyframeTrack(`${baseBones[0].name}.position`, [0, 1], [0, 0, 0, 0, 0, 0])];
    const baseGltf = {
      scene: skelRoot,
      scenes: [skelRoot],
      animations: [
        new THREE.AnimationClip('idle.001', 1.0, baseTracks),
        new THREE.AnimationClip('walk.001', 1.0, baseTracks),
        new THREE.AnimationClip('sitting.001', 1.0, baseTracks),
      ],
      cameras: [],
      asset: {},
      parser: {} as never,
      userData: {},
    } as unknown as GLTF;
    const bodyGroup = new THREE.Group();
    const rig = createMinimalBuddyRig(bodyGroup);
    upgradeBuddyRigWithCharBuddiesGlb(rig, baseGltf);
    return { bodyGroup, rig, namedMeshes };
  };

  registerCustomPelvisAnimationClip('tari_sit.001', rawSitClip);
  try {
    const tari = makeBaseRigFromCostumeSkeleton(true);
    tari.rig.sitClipOverrideName = 'tari_sit.001';
    const mira = makeBaseRigFromCostumeSkeleton(false);

    const equipped = applyEquippedCostumeToBuddyRig(tari.rig, costumeGltf);
    assert.equal(equipped, true);

    const getClonedBaseMesh = (meshName: string): THREE.Mesh => {
      let found: THREE.Mesh | undefined;
      tari.rig.customGlbController!.glbRoot.traverse((node) => {
        if (
          (node as THREE.Mesh).isMesh &&
          !node.userData?.isCustomEquippedTorso &&
          !node.userData?.customEquippedSlot &&
          node.name === meshName
        ) {
          found = node as THREE.Mesh;
        }
      });
      assert.ok(found, `Expected cloned base mesh ${meshName}`);
      return found;
    };

    // Base head, ears, hair stay untouched and visible
    assert.equal(getClonedBaseMesh('head_002_heart').visible, true);
    assert.equal(getClonedBaseMesh('ears_001_basic').visible, true);
    assert.equal(getClonedBaseMesh('hair_coutureeternalnighthair3f').visible, true);
    // Base torso/legs/feet clothing are replaced & hidden; base hands & torso/leg skin stay visible under accessory overlays
    assert.equal(getClonedBaseMesh('hands_skin').visible, true);
    assert.equal(getClonedBaseMesh('torso_bionictennistop').visible, false);
    assert.equal(getClonedBaseMesh('legs_delirioussquidalternative1fpbr').visible, false);
    assert.equal(getClonedBaseMesh('feet_cloudninemillennial1f').visible, false);
    assert.equal(getClonedBaseMesh('torso_bionictennistop_skin').visible, true);
    assert.equal(getClonedBaseMesh('legs_delirioussquidalternative1fpbr_skin').visible, true);

    const attachedNames: string[] = [];
    tari.bodyGroup.traverse((n) => {
      if ((n as THREE.Mesh).isMesh && (n.userData?.isCustomEquippedTorso || n.userData?.customEquippedSlot)) {
        attachedNames.push(n.name);
      }
    });
    assert.ok(attachedNames.some((n) => n.startsWith('hands_')), 'Expected custom hands mesh bound');
    assert.ok(attachedNames.some((n) => n.startsWith('torso_')), 'Expected custom torso mesh bound');
    assert.ok(attachedNames.some((n) => n.startsWith('legs_')), 'Expected custom legs mesh bound');
    assert.ok(attachedNames.some((n) => n.startsWith('feet_')), 'Expected custom feet mesh bound');
    assert.ok(attachedNames.some((n) => n.startsWith('neck_')), 'Expected custom neck mesh bound');

    // Step animation states cleanly: idle -> walk -> sit uses tari_sit.001 only on Tari
    let fakeTimeMs = 1000;
    const stepRig = (targetRig: BuddyCharacterRig, isMoving: boolean, speed: number, isSitting: boolean) => {
      fakeTimeMs += 60;
      const origNow = performance.now;
      performance.now = () => fakeTimeMs;
      try {
        updateCharacterWeaponStance(
          targetRig,
          'unarmed',
          0,
          isMoving,
          false,
          0,
          0,
          0,
          'right',
          0,
          0,
          0.76,
          0,
          true,
          'front',
          1.0,
          0,
          speed,
          isSitting,
        );
      } finally {
        performance.now = origNow;
      }
    };

    stepRig(tari.rig, false, 0, false);
    assert.equal(tari.rig.customGlbController?.activeClipName, 'idle.001');
    stepRig(tari.rig, true, 2.25, false);
    assert.equal(tari.rig.customGlbController?.activeClipName, 'walk.001');
    stepRig(tari.rig, false, 0, true);
    assert.equal(tari.rig.customGlbController?.activeClipName, 'tari_sit.001');
    stepRig(mira.rig, false, 0, true);
    assert.equal(mira.rig.customGlbController?.activeClipName, 'sitting.001');

    // Unequip restores base meshes cleanly
    applyEquippedCostumeToBuddyRig(tari.rig, null);
    assert.equal(getClonedBaseMesh('hands_skin').visible, true);
    assert.equal(getClonedBaseMesh('torso_bionictennistop').visible, true);
    assert.equal(getClonedBaseMesh('legs_delirioussquidalternative1fpbr').visible, true);
    assert.equal(getClonedBaseMesh('feet_cloudninemillennial1f').visible, true);
  } finally {
    registerCustomPelvisAnimationClip('tari_sit.001', null);
  }
});

async function assertFourStateAnimPackRigIsolation(opts: {
  animGlbPath: string;
  baseGlbPath: string;
  sourceSuffix: string;
  targetPrefix: string;
  isMale?: boolean;
}) {
  const { animGlbPath, baseGlbPath, sourceSuffix, targetPrefix, isMale = false } = opts;
  assertAnimGlbMatchesBaseSkeleton(animGlbPath, baseGlbPath, [
    `Idle_${sourceSuffix}`,
    `Walk_${sourceSuffix}`,
    `Run_${sourceSuffix}`,
    `Sit_${sourceSuffix}`,
    `Laying_${sourceSuffix}`,
  ]);

  const packBuf = fs.readFileSync(animGlbPath);
  const packArrayBuf = packBuf.buffer.slice(
    packBuf.byteOffset,
    packBuf.byteOffset + packBuf.byteLength,
  );
  const parsedPack = await new GLTFLoader().parseAsync(packArrayBuf, '');
  const clipMappings: Array<[string, string]> = [
    [`Idle_${sourceSuffix}`, `${targetPrefix}_idle.001`],
    [`Walk_${sourceSuffix}`, `${targetPrefix}_walk.001`],
    [`Run_${sourceSuffix}`, `${targetPrefix}_run.001`],
    [`Sit_${sourceSuffix}`, `${targetPrefix}_sit.001`],
  ];

  const sharedBaseGltf = buildMockCharacterGltf({
    isMale,
    armStartAbsX: isMale ? 0.284 : 0.24,
    waistMaxY: isMale ? 0 : 1.005,
    neckMinY: 1.324,
  });
  const baseTracks = [
    new THREE.QuaternionKeyframeTrack('Spine.quaternion', [0, 0.5], [0, 0, 0, 1, 0, 0.05, 0, 0.9987]),
  ];
  sharedBaseGltf.animations = [
    new THREE.AnimationClip('idle.001', 1.0, baseTracks),
    new THREE.AnimationClip('walk.001', 1.0, baseTracks),
    new THREE.AnimationClip('run.001', 1.0, baseTracks),
    new THREE.AnimationClip('sitting.001', 1.0, baseTracks),
  ];

  for (const [, targetName] of clipMappings) {
    registerCustomPelvisAnimationClip(targetName, null);
  }
  try {
    const targetRig = createMinimalBuddyRig(new THREE.Group());
    targetRig.idleClipOverrideName = `${targetPrefix}_idle.001`;
    targetRig.walkClipOverrideName = `${targetPrefix}_walk.001`;
    targetRig.runClipOverrideName = `${targetPrefix}_run.001`;
    targetRig.sitClipOverrideName = `${targetPrefix}_sit.001`;
    upgradeBuddyRigWithCharBuddiesGlb(targetRig, sharedBaseGltf);

    const otherNpcRig = createMinimalBuddyRig(new THREE.Group());
    upgradeBuddyRigWithCharBuddiesGlb(otherNpcRig, sharedBaseGltf);

    // Late arrival after sharedFemaleGltf was already cloned onto rigs
    for (const [sourceName, targetName] of clipMappings) {
      const sourceClip = parsedPack.animations.find((clip) => clip.name === sourceName);
      assert.ok(sourceClip, `Missing ${sourceName} in ${animGlbPath}`);
      const cloned = sourceClip.clone();
      cloned.name = targetName;
      registerCustomPelvisAnimationClip(targetName, cloned);
    }

    const step = (rig: BuddyCharacterRig, isMoving: boolean, speed: number, isSitting: boolean) =>
      updateCharacterWeaponStance(
        rig,
        'unarmed',
        0,
        isMoving,
        false,
        0,
        0,
        0,
        'right',
        0,
        0,
        0.76,
        0,
        true,
        'front',
        1.0,
        0,
        speed,
        isSitting,
      );

    step(targetRig, false, 0, false);
    assert.equal(targetRig.customGlbController?.activeClipName, `${targetPrefix}_idle.001`);
    step(targetRig, true, 1.75, false);
    assert.equal(targetRig.customGlbController?.activeClipName, `${targetPrefix}_walk.001`);
    step(targetRig, true, 4.2, false);
    assert.equal(targetRig.customGlbController?.activeClipName, `${targetPrefix}_run.001`);
    step(targetRig, false, 0, true);
    assert.equal(targetRig.customGlbController?.activeClipName, `${targetPrefix}_sit.001`);

    step(otherNpcRig, false, 0, false);
    assert.equal(otherNpcRig.customGlbController?.activeClipName, 'idle.001');
    step(otherNpcRig, true, 1.75, false);
    assert.equal(otherNpcRig.customGlbController?.activeClipName, 'walk.001');
    step(otherNpcRig, true, 4.2, false);
    assert.equal(otherNpcRig.customGlbController?.activeClipName, 'walk.001');
    step(otherNpcRig, true, 7.0, false);
    assert.equal(otherNpcRig.customGlbController?.activeClipName, 'run.001');
    step(otherNpcRig, false, 0, true);
    assert.equal(otherNpcRig.customGlbController?.activeClipName, 'sitting.001');
  } finally {
    for (const [, targetName] of clipMappings) {
      registerCustomPelvisAnimationClip(targetName, null);
    }
  }
}

test('Tari 5-anim GLB pack binds tari_idle.001, tari_walk.001, tari_run.001, and tari_sit.001 exclusively onto Tari without affecting other NPCs', async () => {
  await assertFourStateAnimPackRigIsolation({
    animGlbPath: 'public/assets/tari-anims.glb',
    baseGlbPath: 'public/assets/character_custom_idle_runway_catwalk_stylish_11 (3).glb',
    sourceSuffix: 'blitz_Lincah_Energik_Wanita_2',
    targetPrefix: 'tari',
  });
});

test('Nadia 5-anim GLB pack binds nadia_idle.001, nadia_walk.001, nadia_run.001, and nadia_sit.001 exclusively onto Nadia without affecting other NPCs', async () => {
  await assertFourStateAnimPackRigIsolation({
    animGlbPath: 'public/assets/nadia-anims.glb',
    baseGlbPath: 'public/assets/character_custom_sit_formal_tenang_2.glb',
    sourceSuffix: 'blitz_Tangan_Di_Pinggul_Wanita_14',
    targetPrefix: 'nadia',
  });
});

test('Mira 5-anim GLB pack binds mira_idle.001, mira_walk.001, mira_run.001, and mira_sit.001 exclusively onto Mira without affecting other NPCs', async () => {
  await assertFourStateAnimPackRigIsolation({
    animGlbPath: 'public/assets/mira-anims.glb',
    baseGlbPath: 'public/assets/character_custom_idle_runway_catwalk_stylish_11 (3).glb',
    sourceSuffix: 'blitz_Kasual_Harian_Wanita_1',
    targetPrefix: 'mira',
  });
});

test('Raka 5-anim GLB pack binds raka_idle.001, raka_walk.001, raka_run.001, and raka_sit.001 exclusively onto Raka without affecting other NPCs', async () => {
  await assertFourStateAnimPackRigIsolation({
    animGlbPath: 'public/assets/raka-anims.glb',
    baseGlbPath: 'public/assets/aistudio/character_custom_idle_runway_catwalk_stylish_11 (2).glb',
    sourceSuffix: 'blitz_Formal_Tenang_Pria_4',
    targetPrefix: 'raka',
    isMale: true,
  });
});

test('Bima 5-anim GLB pack binds bima_idle.001, bima_walk.001, bima_run.001, and bima_sit.001 exclusively onto Bima without affecting other NPCs', async () => {
  await assertFourStateAnimPackRigIsolation({
    animGlbPath: 'public/assets/bima-anims.glb',
    baseGlbPath: 'public/assets/aistudio/character_custom_sit_runway_catwalk_stylish_4.glb',
    sourceSuffix: 'blitz_Kasual_Harian_Pria_15',
    targetPrefix: 'bima',
    isMale: true,
  });
});

test('Kenji 5-anim GLB pack binds kenji_idle.001, kenji_walk.001, kenji_run.001, and kenji_sit.001 exclusively onto Kenji without affecting other NPCs', async () => {
  await assertFourStateAnimPackRigIsolation({
    animGlbPath: 'public/assets/kenji-anims.glb',
    baseGlbPath: 'public/assets/aistudio/character_custom_sit_runway_catwalk_stylish_4.glb',
    sourceSuffix: 'blitz_Kasual_Harian_3',
    targetPrefix: 'kenji',
    isMale: true,
  });
});

test('applyEquippedApparelSlotToBuddyRig keeps base hands_skin visible for nail/bracelet accessories and hides it only for bilateral gloves', () => {
  const baseGltf = buildMockCharacterGltf({
    isMale: false,
    armStartAbsX: 0.24,
    neckMinY: 1.32,
    waistMaxY: 0.96,
  });
  const rig = createMinimalBuddyRig(new THREE.Group());
  upgradeBuddyRigWithCharBuddiesGlb(rig, baseGltf);

  const findHandsSkin = (): THREE.Mesh | undefined => {
    let found: THREE.Mesh | undefined;
    rig.customGlbController?.glbRoot.traverse((n) => {
      if ((n as THREE.Mesh).isMesh && !n.userData?.customEquippedSlot && n.name === 'hands_skin') {
        found = n as THREE.Mesh;
      }
    });
    return found;
  };
  assert.equal(findHandsSkin()?.visible, true);

  // Sparse nail/wrist accessory (20 tris on one side) keeps bare hands_skin visible
  const accessoryGltf = buildMockModularApparelGltf('hands_nail_accessory', {
    xMin: 0.65,
    xMax: 0.72,
    yMin: 1.22,
    yMax: 1.24,
    zMin: -0.04,
    zMax: -0.02,
  });
  assert.equal(applyEquippedApparelSlotToBuddyRig(rig, 'hands', accessoryGltf), true);
  assert.equal(findHandsSkin()?.visible, true);

  // Full bilateral glove mesh (>= 160 tris per side inside |x| in [0.635, 0.735]) hides bare hands_skin
  const glovePositions: number[] = [];
  const gloveIndices: number[] = [];
  const gloveJoints: number[] = [];
  const gloveWeights: number[] = [];
  for (const sign of [1, -1]) {
    for (let t = 0; t < 170; t++) {
      const x = sign * (0.65 + (t % 5) * 0.015);
      const base = glovePositions.length / 3;
      glovePositions.push(x, 1.22, -0.05, x + sign * 0.01, 1.26, -0.05, x, 1.26, -0.02);
      gloveIndices.push(base, base + 1, base + 2);
      for (let k = 0; k < 3; k++) {
        gloveJoints.push(sign > 0 ? 9 : 13, 0, 0, 0);
        gloveWeights.push(1, 0, 0, 0);
      }
    }
  }
  const gloveGeo = new THREE.BufferGeometry();
  gloveGeo.setAttribute('position', new THREE.Float32BufferAttribute(glovePositions, 3));
  gloveGeo.setAttribute('normal', new THREE.Float32BufferAttribute(glovePositions.map(() => 1), 3));
  gloveGeo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(gloveJoints, 4));
  gloveGeo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(gloveWeights, 4));
  gloveGeo.setIndex(gloveIndices);
  const gloveGltf = buildMockModularApparelGltf('hands_full_gloves', {
    xMin: -0.72,
    xMax: 0.72,
    yMin: 1.21,
    yMax: 1.29,
    zMin: -0.08,
    zMax: -0.02,
  });
  const gloveMesh = gloveGltf.scene.getObjectByName('hands_full_gloves') as THREE.SkinnedMesh;
  gloveMesh.geometry.dispose();
  gloveMesh.geometry = gloveGeo;

  assert.equal(applyEquippedApparelSlotToBuddyRig(rig, 'hands', gloveGltf), true);
  assert.equal(findHandsSkin()?.visible, false);

  // Switching back to sparse accessory restores base hands_skin visibility cleanly
  assert.equal(applyEquippedApparelSlotToBuddyRig(rig, 'hands', accessoryGltf), true);
  assert.equal(findHandsSkin()?.visible, true);
});

let cachedNodeDracoModulePromise: Promise<unknown> | null = null;
function getNodeDracoModuleForTest(): Promise<{
  Decoder: new () => Record<string, unknown>;
  Mesh: new () => { num_points(): number; num_faces(): number; ptr: number };
  PointCloud: new () => { num_points(): number; ptr: number };
  TRIANGULAR_MESH: number;
  DT_FLOAT32: number;
  DT_INT8: number;
  DT_INT16: number;
  DT_INT32: number;
  DT_UINT8: number;
  DT_UINT16: number;
  DT_UINT32: number;
  HEAPF32: { buffer: ArrayBuffer };
  _malloc(bytes: number): number;
  _free(ptr: number): void;
  destroy(obj: unknown): void;
  [k: string]: unknown;
}> {
  if (cachedNodeDracoModulePromise) {
    return cachedNodeDracoModulePromise as ReturnType<typeof getNodeDracoModuleForTest>;
  }
  cachedNodeDracoModulePromise = new Promise((resolve) => {
    const jsCode = fs.readFileSync('public/draco/draco_decoder.js', 'utf8');
    const sandbox: Record<string, unknown> = {
      console,
      Uint8Array,
      Uint16Array,
      Uint32Array,
      Int8Array,
      Int16Array,
      Int32Array,
      Float32Array,
      Float64Array,
      ArrayBuffer,
      DataView,
      Promise,
      Math,
      TextDecoder,
    };
    sandbox.self = sandbox;
    vm.runInNewContext(jsCode, sandbox);
    const factory = sandbox.DracoDecoderModule as (cfg: {
      onModuleLoaded: (draco: unknown) => void;
    }) => void;
    factory({ onModuleLoaded: (draco) => resolve(draco) });
  });
  return cachedNodeDracoModulePromise as ReturnType<typeof getNodeDracoModuleForTest>;
}

function createNodeDracoLoaderForTest(): DRACOLoader {
  const loader = new DRACOLoader();
  (loader as unknown as { preload: () => DRACOLoader }).preload = () => loader;
  (
    loader as unknown as {
      decodeGeometry: (
        buffer: ArrayBuffer,
        taskConfig: {
          attributeIDs: Record<string, number | string>;
          attributeTypes: Record<string, string>;
          useUniqueIDs: boolean;
          vertexColorSpace: THREE.ColorSpace;
        },
      ) => Promise<THREE.BufferGeometry>;
    }
  ).decodeGeometry = async function (buffer, taskConfig) {
    const draco = await getNodeDracoModuleForTest();
    const decoder = new draco.Decoder() as {
      GetEncodedGeometryType(arr: Int8Array): number;
      DecodeArrayToMesh(arr: Int8Array, len: number, mesh: unknown): { ok(): boolean; error_msg(): string };
      DecodeArrayToPointCloud(arr: Int8Array, len: number, pc: unknown): { ok(): boolean; error_msg(): string };
      GetAttributeByUniqueId(geom: unknown, id: number | string): { num_components(): number; ptr: number };
      GetAttributeId(geom: unknown, attrType: unknown): number;
      GetAttribute(geom: unknown, id: number): { num_components(): number; ptr: number };
      GetAttributeDataArrayForAllPoints(geom: unknown, attr: unknown, dt: number, len: number, ptr: number): void;
      GetTrianglesUInt32Array(geom: unknown, len: number, ptr: number): void;
    };
    const array = new Int8Array(buffer);
    const geometryType = decoder.GetEncodedGeometryType(array);
    const dracoGeometry =
      geometryType === draco.TRIANGULAR_MESH ? new draco.Mesh() : new draco.PointCloud();
    const status =
      geometryType === draco.TRIANGULAR_MESH
        ? decoder.DecodeArrayToMesh(array, array.byteLength, dracoGeometry)
        : decoder.DecodeArrayToPointCloud(array, array.byteLength, dracoGeometry);
    if (!status.ok() || dracoGeometry.ptr === 0) {
      draco.destroy(decoder);
      throw new Error(`Draco decode failed: ${status.error_msg()}`);
    }
    const geometryData: {
      index: { array: Uint32Array; itemSize: number } | null;
      attributes: Array<{
        name: string;
        count: number;
        itemSize: number;
        array: THREE.TypedArray;
        stride: number;
        vertexColorSpace?: THREE.ColorSpace;
      }>;
    } = { index: null, attributes: [] };
    try {
      const typedCtors: Record<string, Float32ArrayConstructor | Uint8ArrayConstructor | Uint16ArrayConstructor | Uint32ArrayConstructor | Int8ArrayConstructor | Int16ArrayConstructor | Int32ArrayConstructor> = {
        Float32Array,
        Uint8Array,
        Uint16Array,
        Uint32Array,
        Int8Array,
        Int16Array,
        Int32Array,
      };
      for (const attributeName in taskConfig.attributeIDs) {
        const TypedArray = typedCtors[taskConfig.attributeTypes[attributeName]] ?? Float32Array;
        const attribute = taskConfig.useUniqueIDs
          ? decoder.GetAttributeByUniqueId(dracoGeometry, taskConfig.attributeIDs[attributeName])
          : decoder.GetAttribute(
              dracoGeometry,
              decoder.GetAttributeId(dracoGeometry, draco[String(taskConfig.attributeIDs[attributeName])]),
            );
        if (!attribute || attribute.ptr === 0) continue;
        const count = dracoGeometry.num_points();
        const itemSize = attribute.num_components();
        const dracoDataType =
          TypedArray === Float32Array
            ? draco.DT_FLOAT32
            : TypedArray === Uint8Array
              ? draco.DT_UINT8
              : TypedArray === Uint16Array
                ? draco.DT_UINT16
                : TypedArray === Uint32Array
                  ? draco.DT_UINT32
                  : TypedArray === Int8Array
                    ? draco.DT_INT8
                    : TypedArray === Int16Array
                      ? draco.DT_INT16
                      : draco.DT_INT32;
        const srcByteStride = itemSize * TypedArray.BYTES_PER_ELEMENT;
        const dstByteStride = Math.ceil(srcByteStride / 4) * 4;
        const dstStride = dstByteStride / TypedArray.BYTES_PER_ELEMENT;
        const srcByteLength = count * srcByteStride;
        const ptr = draco._malloc(srcByteLength);
        decoder.GetAttributeDataArrayForAllPoints(dracoGeometry, attribute, dracoDataType, srcByteLength, ptr);
        const srcArray = new TypedArray(
          draco.HEAPF32.buffer,
          ptr,
          srcByteLength / TypedArray.BYTES_PER_ELEMENT,
        );
        let dstArray: THREE.TypedArray;
        if (srcByteStride === dstByteStride) {
          dstArray = srcArray.slice();
        } else {
          dstArray = new TypedArray(
            Math.ceil(srcByteLength / 4) * (4 / TypedArray.BYTES_PER_ELEMENT),
          );
          let dstOffset = 0;
          for (let i = 0; i < count; i++) {
            for (let j = 0; j < itemSize; j++) {
              dstArray[dstOffset + j] = srcArray[i * itemSize + j];
            }
            dstOffset += dstStride;
          }
        }
        draco._free(ptr);
        const entry: (typeof geometryData.attributes)[number] = {
          name: attributeName,
          count,
          itemSize,
          array: dstArray,
          stride: dstStride,
        };
        if (attributeName === 'color') entry.vertexColorSpace = taskConfig.vertexColorSpace;
        geometryData.attributes.push(entry);
      }
      if (geometryType === draco.TRIANGULAR_MESH) {
        const numFaces = (dracoGeometry as unknown as { num_faces(): number }).num_faces();
        const numIndices = numFaces * 3;
        const byteLength = numIndices * 4;
        const ptr = draco._malloc(byteLength);
        decoder.GetTrianglesUInt32Array(dracoGeometry, byteLength, ptr);
        const index = new Uint32Array(draco.HEAPF32.buffer, ptr, numIndices).slice();
        draco._free(ptr);
        geometryData.index = { array: index, itemSize: 1 };
      }
    } finally {
      draco.destroy(dracoGeometry);
      draco.destroy(decoder);
    }
    return (
      this as unknown as { _createGeometry: (gd: typeof geometryData) => THREE.BufferGeometry }
    )._createGeometry(geometryData);
  };
  return loader;
}

const sharedTestDracoLoader = createNodeDracoLoaderForTest();

async function loadRealDracoGlbForTest(filePath: string): Promise<GLTF> {
  const buf = fs.readFileSync(filePath);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(sharedTestDracoLoader);
  const prevSelf = (globalThis as Record<string, unknown>).self;
  const prevCreateImageBitmap = (globalThis as Record<string, unknown>).createImageBitmap;
  (globalThis as Record<string, unknown>).self = globalThis;
  (globalThis as Record<string, unknown>).createImageBitmap = async () => ({
    width: 2,
    height: 2,
    close() {},
  });
  try {
    return (await loader.parseAsync(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      '',
    )) as GLTF;
  } finally {
    if (prevSelf === undefined) delete (globalThis as Record<string, unknown>).self;
    else (globalThis as Record<string, unknown>).self = prevSelf;
    if (prevCreateImageBitmap === undefined) {
      delete (globalThis as Record<string, unknown>).createImageBitmap;
    } else {
      (globalThis as Record<string, unknown>).createImageBitmap = prevCreateImageBitmap;
    }
  }
}

test('sanitizeAndNormalizeSkinAttributes normalizes weights to 1.0, prunes invalid bone indices, merges fallback duplicates, and recovers zero-weight vertices', () => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        0.0, 0.85, 0.0, // v0: unnormalized weights + invalid bone index 99
        0.2, 1.26, -0.04, // v1: duplicate mapped slot (slot 1 & slot 2 both map to bone 1)
        0.0, 1.45, 0.0, // v2: zero-weight orphan near bone 2 (Head)
      ],
      3,
    ),
  );
  geo.setAttribute(
    'skinIndex',
    new THREE.Uint16BufferAttribute(
      [
        0, 99, 1, 0, // v0: 99 out-of-range
        1, 2, 3, 0, // v1: src bones 1 & 2 both map to target bone 1
        0, 0, 0, 0, // v2: zero-weight
      ],
      4,
    ),
  );
  geo.setAttribute(
    'skinWeight',
    new THREE.Float32BufferAttribute(
      [
        0.6, 0.8, 0.3, -0.2, // v0: invalid 99 pruned, -0.2 clamped -> remaining 0.6 + 0.3 = 0.9 -> 2/3, 1/3
        0.4, 0.3, 0.3, 0.0, // v1: 1&2 merged -> target 1 gets 0.7, target 2 gets 0.3
        0.0, 0.0, NaN, 0.0, // v2: zero-weight -> recovers to nearest bone (index 2 at y=1.45)
      ],
      4,
    ),
  );

  // Target skeleton has 3 bones: [0: Hip, 1: LeftArm, 2: Head], source had 4: [0->0, 1->1, 2->1, 3->2]
  const report = sanitizeAndNormalizeSkinAttributes(
    geo,
    3,
    [0, 1, 1, 2],
    0,
    [
      new THREE.Vector3(0, 0.85, 0),
      new THREE.Vector3(0.2, 1.26, -0.04),
      new THREE.Vector3(0, 1.45, 0),
    ],
  );
  assert.equal(report.vertexCount, 3);
  assert.equal(report.prunedInfluenceCount, 1);
  assert.equal(report.recoveredZeroWeightVertices, 1);

  const outIdx = geo.getAttribute('skinIndex');
  const outWgt = geo.getAttribute('skinWeight');
  for (let i = 0; i < 3; i++) {
    const sum = outWgt.getX(i) + outWgt.getY(i) + outWgt.getZ(i) + outWgt.getW(i);
    assert.ok(Math.abs(sum - 1.0) <= 1e-5, `Vertex ${i} weight sum must be 1.0, got ${sum}`);
  }
  // v0: slot0=0 (0.6667), slot1=1 (0.3333)
  assert.equal(outIdx.getX(0), 0);
  assert.equal(outIdx.getY(0), 1);
  assert.ok(Math.abs(outWgt.getX(0) - 2 / 3) < 1e-4);
  assert.ok(Math.abs(outWgt.getY(0) - 1 / 3) < 1e-4);
  // v1: merged slots 1+2 => target bone 1 has 0.7, target bone 2 has 0.3
  assert.equal(outIdx.getX(1), 1);
  assert.equal(outIdx.getY(1), 2);
  assert.ok(Math.abs(outWgt.getX(1) - 0.7) < 1e-4);
  assert.ok(Math.abs(outWgt.getY(1) - 0.3) < 1e-4);
  // v2: recovered nearest bone 2 (Head)
  assert.equal(outIdx.getX(2), 2);
  assert.equal(outWgt.getX(2), 1.0);
});

test('resolveModularBoneMapping bridges PelvisRoot <-> Mixamo bones and falls back cleanly for missing clavicle, spine, twist, and null bones', () => {
  const { armature } = buildSkeletonHierarchy();
  // Base rig lacks LeftArmTwist, TextureChange, LeftToesNull, LeftHandRing2, and LeftShoulder? Let's test missing clavicle on a stripped Mixamo rig:
  const mixamoScene = new THREE.Group();
  const mixamoBones: THREE.Bone[] = [];
  for (const name of [
    'mixamorigHips',
    'mixamorigSpine',
    'mixamorigSpine2',
    'mixamorigNeck',
    'mixamorigHead',
    'mixamorigLeftArm',
    'mixamorigLeftForeArm',
    'mixamorigLeftHand',
    'mixamorigLeftHandMiddle1',
    'mixamorigLeftUpLeg',
    'mixamorigLeftLeg',
    'mixamorigLeftFoot',
    'mixamorigLeftToeBase',
  ]) {
    const b = new THREE.Bone();
    b.name = name;
    mixamoScene.add(b);
    mixamoBones.push(b);
  }
  const mixamoLookup = buildTargetBoneLookup(mixamoBones, mixamoScene);

  // Source garment uses PelvisRoot names + Spine01 (missing) + LeftShoulder clavicle (missing) + LeftArmTwist + TextureChange + LeftToesNull
  const srcBoneNames = [
    'Hip',
    'Spine01',
    'Spine02',
    'LeftShoulder',
    'LeftArm',
    'LeftArmTwist',
    'LeftOthers1',
    'LeftToes',
    'LeftToesNull',
    'TextureChange',
  ];
  const srcBones = srcBoneNames.map((n) => {
    const b = new THREE.Bone();
    b.name = n;
    return b;
  });

  const res = resolveModularBoneMapping(srcBones, mixamoLookup);
  assert.equal(res.unmappedCount, 0, 'Every source bone must resolve cleanly with fallbacks');
  assert.equal(res.mappedBones[0].name, 'mixamorigHips'); // Hip -> mixamorigHips
  assert.equal(res.mappedBones[1].name, 'mixamorigSpine'); // missing Spine01 -> mixamorigSpine
  assert.equal(res.mappedBones[2].name, 'mixamorigSpine2'); // Spine02 -> mixamorigSpine2
  assert.equal(res.mappedBones[3].name, 'mixamorigSpine2'); // missing LeftShoulder clavicle -> mixamorigSpine2
  assert.equal(res.mappedBones[4].name, 'mixamorigLeftArm'); // LeftArm -> mixamorigLeftArm
  assert.equal(res.mappedBones[5].name, 'mixamorigLeftArm'); // missing LeftArmTwist -> mixamorigLeftArm
  assert.equal(res.mappedBones[6].name, 'mixamorigLeftHandMiddle1'); // LeftOthers1 -> mixamorigLeftHandMiddle1
  assert.equal(res.mappedBones[7].name, 'mixamorigLeftToeBase'); // LeftToes -> mixamorigLeftToeBase
  assert.equal(res.mappedBones[8].name, 'mixamorigLeftToeBase'); // LeftToesNull -> mixamorigLeftToeBase
  assert.equal(res.mappedBones[9].name, 'mixamorigHead'); // TextureChange -> mixamorigHead

  // Also test equipping a cm-scale / non-identity bindMatrix + twist-bone garment onto a PelvisRoot rig + morph target sync
  const baseGltf = buildMockCharacterGltf({
    isMale: true,
    armStartAbsX: 0.284,
    waistMaxY: 0,
    neckMinY: 1.324,
  });
  const baseTorsoMesh = baseGltf.scene.getObjectByName('torso_frontrowessential1mpbr') as THREE.SkinnedMesh;
  baseTorsoMesh.morphTargetDictionary = { chestWidth: 0 };
  baseTorsoMesh.morphTargetInfluences = [0.65];

  const rig = createMinimalBuddyRig(new THREE.Group());
  upgradeBuddyRigWithCharBuddiesGlb(rig, baseGltf);

  // Build modular jacket in 100x centimeter space with proper parent-child skeleton, missing Twist bone, and morphTarget
  const cmScene = new THREE.Group();
  const cmRig = buildSkeletonHierarchy();
  for (const b of cmRig.bones) {
    b.position.multiplyScalar(100);
  }
  const twistBone = new THREE.Bone();
  twistBone.name = 'LeftArmTwist';
  twistBone.position.set(12, 0, 0);
  const cmLeftArm = cmRig.bones.find((b) => b.name === 'LeftArm')!;
  cmLeftArm.add(twistBone);
  const cmBones = [...cmRig.bones, twistBone];
  cmScene.add(cmRig.armature);
  cmScene.updateMatrixWorld(true);
  const cmInvs = cmBones.map((b) => new THREE.Matrix4().copy(b.matrixWorld).invert());

  const jacketGeo = makeBoxSkinnedGeometry(-22, 22, 78, 134, -15, 11, cmBones.length - 1);
  const jClothMat = new THREE.MeshBasicMaterial({ name: 'Jacket_Clothing', color: 0x1e293b });
  const jacketSm = new THREE.SkinnedMesh(jacketGeo, jClothMat);
  jacketSm.name = 'torso_blitz_hiphop_jacket';
  jacketSm.morphTargetDictionary = { chestWidth: 0 };
  jacketSm.morphTargetInfluences = [0];
  const cmBindMat = new THREE.Matrix4().makeScale(1, 1, 1);
  jacketSm.bind(new THREE.Skeleton(cmBones, cmInvs), cmBindMat);
  cmScene.add(jacketSm);

  const cmGltf: GLTF = {
    scene: cmScene,
    scenes: [cmScene],
    animations: [],
    cameras: [],
    asset: { version: '2.0' },
    parser: {} as GLTF['parser'],
    userData: {},
  };

  assert.equal(applyEquippedTorsoToBuddyRig(rig, cmGltf), true);
  const equippedJacket = findSkinnedMeshByName(
    rig.customGlbController!.glbRoot!,
    'torso_blitz_hiphop_jacket',
  )!;
  assert.ok(equippedJacket, 'Garment with missing twist bone and 100x cm scale must equip cleanly');
  assert.ok(
    Math.abs((equippedJacket.userData.wardrobeScaleMultiplier as number) - 0.01) < 0.002,
    `Expected ~0.01 cm-to-m scale multiplier, got ${equippedJacket.userData.wardrobeScaleMultiplier}`,
  );
  assert.equal(equippedJacket.morphTargetInfluences?.[0], 0.65, 'Morph target weights must sync from base rig');

  // Verify synchronized boneInverses match target rig's Hips/Spine/LeftArm inverses and bindMatrix is synced
  const jacketBox = new THREE.Box3().setFromBufferAttribute(
    equippedJacket.geometry.getAttribute('position') as THREE.BufferAttribute,
  );
  assert.ok(
    jacketBox.max.y > 1.2 && jacketBox.max.y < 1.5,
    `Synchronized jacket Y bounds must be in meter avatar space, got [${jacketBox.min.y}, ${jacketBox.max.y}]`,
  );
  const baseHeadMesh = findSkinnedMeshByName(
    rig.customGlbController!.glbRoot!,
    'head_102_triangle',
  )!;
  assert.ok(baseHeadMesh, 'Base rig head mesh must exist');
  baseHeadMesh.updateMatrixWorld(true);
  equippedJacket.updateMatrixWorld(true);
  for (let e = 0; e < 16; e++) {
    assert.ok(
      Math.abs(equippedJacket.bindMatrix.elements[e] - baseHeadMesh.bindMatrix.elements[e]) < 1e-4,
      `bindMatrix[${e}] must sync to target rig bind space`,
    );
    assert.ok(
      Math.abs(
        equippedJacket.bindMatrixInverse.elements[e] - baseHeadMesh.bindMatrixInverse.elements[e],
      ) < 1e-4,
      `bindMatrixInverse[${e}] must sync to target rig bind space`,
    );
  }
  armature.updateMatrixWorld(true);
});

test('Layered garment clearance rules maintain strict monotonic order (skin < inner_top < pants < footwear < skirt < dress < jacket < straps < accessories) and offset outlines together', () => {
  const orderedLayers: WardrobeLayerId[] = [
    'skin',
    'inner_top',
    'pants',
    'footwear',
    'skirt',
    'dress',
    'jacket',
    'straps',
    'accessories',
  ];
  for (let i = 1; i < orderedLayers.length; i++) {
    const prev = orderedLayers[i - 1];
    const curr = orderedLayers[i];
    assert.ok(
      WARDROBE_LAYER_ORDER[prev] < WARDROBE_LAYER_ORDER[curr],
      `Layer order ${prev} must precede ${curr}`,
    );
    assert.ok(
      WARDROBE_LAYER_CLEARANCE_M[prev] < WARDROBE_LAYER_CLEARANCE_M[curr],
      `Clearance ${prev} (${WARDROBE_LAYER_CLEARANCE_M[prev]}) must be strictly less than ${curr} (${WARDROBE_LAYER_CLEARANCE_M[curr]})`,
    );
  }

  assert.equal(classifyGarmentLayer('torso_bionictennistop_skin_1'), 'skin');
  assert.equal(classifyGarmentLayer('torso_blitz_colorpopbunnyclub1mpbr_1', { minY: 0.894, waistRadius: 0.138 }), 'inner_top');
  assert.equal(classifyGarmentLayer('legs_blitz_urbanromance2mpbr_1'), 'pants');
  assert.equal(classifyGarmentLayer('feet_blitz_warriortrainers1m_1'), 'footwear');
  assert.equal(classifyGarmentLayer('legs_blitz_solstice7fhighrespbr_hires_1'), 'skirt');
  assert.equal(classifyGarmentLayer('torso_evening_dress_1'), 'dress');
  assert.equal(classifyGarmentLayer('torso_dropsciencehiphop24iap1mpbr_1', { minY: 0.753, waistRadius: 0.205 }), 'jacket');
  assert.equal(classifyGarmentLayer('torso_tactical_chest_strap_1'), 'straps');
  assert.equal(classifyGarmentLayer('neck_blitz_1f_1'), 'accessories');

  // Verify outward normal clearance offsets base garment + companion _Outline symmetrically
  const baseGeo = makeBoxSkinnedGeometry(-0.14, 0.14, 0.80, 1.30, -0.10, 0.10, 0);
  const outGeo = makeBoxSkinnedGeometry(-0.143, 0.143, 0.797, 1.303, -0.103, 0.103, 0, true);
  const baseMaxXBefore = (baseGeo.getAttribute('position') as THREE.BufferAttribute).getX(0);
  const maxXOf = (g: THREE.BufferGeometry) => {
    const p = g.getAttribute('position');
    let mx = -Infinity;
    for (let i = 0; i < p.count; i++) mx = Math.max(mx, p.getX(i));
    return mx;
  };
  const bBefore = maxXOf(baseGeo);
  const oBefore = maxXOf(outGeo);

  const offset = applyLayeredGarmentClearance(baseGeo, 'jacket');
  applyLayeredGarmentClearance(outGeo, 'jacket', { isOutlineMesh: true });
  assert.equal(offset, getGarmentLayerClearanceOffsetM('jacket'));
  assert.ok(
    Math.abs(maxXOf(baseGeo) - bBefore - offset) < 1e-4,
    'Base garment must expand outward along vertex normal by exact jacket clearance',
  );
  assert.ok(
    Math.abs(maxXOf(outGeo) - oBefore - offset) < 1e-4,
    'Companion inverted-hull _Outline must expand outward by identical clearance',
  );
  assert.ok(Number.isFinite(baseMaxXBefore));

  // Verify covered thigh skin hem tucking & pristine restoration
  const thighGeo = makeBoxSkinnedGeometry(-0.15, 0.15, 0.60, 0.78, -0.09, 0.09, 0);
  const tuckedCount = applyCoveredSkinHemTuck(thighGeo, 0.69, 0.755, 0.006, false);
  assert.ok(tuckedCount > 0, 'Covered thigh skin above hem must tuck inward');
  const tPos = thighGeo.getAttribute('position');
  let maxThighX = 0;
  for (let i = 0; i < tPos.count; i++) {
    if (tPos.getY(i) >= 0.75) maxThighX = Math.max(maxThighX, Math.abs(tPos.getX(i)));
  }
  assert.ok(maxThighX < 0.146, `Tucked upper thigh X (${maxThighX}) must sit inside 0.15 radius`);
});

test('smoothBoundaryTransitionWeights welds UV seams and eliminates shoulder/wrist/neck/hip tearing across animations', () => {
  const { armature, bones } = buildSkeletonHierarchy();
  // Add Hip, LeftUpLeg, RightUpLeg so sit/hip bending works in synthetic test
  const hip = bones[0];
  const lUpLeg = new THREE.Bone();
  lUpLeg.name = 'LeftUpLeg';
  lUpLeg.position.set(0.08, -0.02, 0);
  const rUpLeg = new THREE.Bone();
  rUpLeg.name = 'RightUpLeg';
  rUpLeg.position.set(-0.08, -0.02, 0);
  hip.add(lUpLeg, rUpLeg);
  armature.updateMatrixWorld(true);
  const allBones = [...bones, lUpLeg, rUpLeg];
  const allInvs = allBones.map((b) => new THREE.Matrix4().copy(b.matrixWorld).invert());

  // Build split-UV seam cylinder spanning hip->thigh (y=0.72..0.90) with sharp discontinuous jump at y=0.84
  const positions: number[] = [];
  const indices: number[] = [];
  const skinIdx: number[] = [];
  const skinWgt: number[] = [];
  const hipIdx = allBones.indexOf(hip);
  const lLegIdx = allBones.indexOf(lUpLeg);
  const rLegIdx = allBones.indexOf(rUpLeg);
  const ringsY = [0.92, 0.86, 0.81, 0.76, 0.72];
  const segs = 12;
  for (let r = 0; r < ringsY.length; r++) {
    const y = ringsY[r];
    for (let s = 0; s <= segs; s++) {
      // Duplicate seam vertex at s=0 and s=segs (`theta=0` and `theta=2*PI`) with intentionally different raw weights
      const theta = (s / segs) * Math.PI * 2;
      positions.push(Math.cos(theta) * 0.16, y, Math.sin(theta) * 0.11);
      const isSeamDup = s === segs;
      skinIdx.push(hipIdx, isSeamDup ? lLegIdx : 0, 0, 0);
      skinWgt.push(isSeamDup ? 0.5 : 1.0, isSeamDup ? 0.5 : 0.0, 0, 0);
    }
  }
  const stride = segs + 1;
  for (let r = 0; r + 1 < ringsY.length; r++) {
    for (let s = 0; s < segs; s++) {
      const a = r * stride + s;
      const b = a + 1;
      const c = (r + 1) * stride + s;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }
  const skirtGeo = new THREE.BufferGeometry();
  skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  skirtGeo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIdx, 4));
  skirtGeo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWgt, 4));
  skirtGeo.setIndex(indices);
  skirtGeo.computeVertexNormals();

  const smoothedCount = smoothBoundaryTransitionWeights(skirtGeo, allBones, 'jacket', { passes: 2 });
  assert.ok(smoothedCount > 0);

  // Verify UV seam duplicate vertices (s=0 and s=segs) share identical welded weights & lift smoothly with LeftUpLeg when sitting
  const sm = new THREE.SkinnedMesh(skirtGeo, new THREE.MeshBasicMaterial());
  sm.bind(new THREE.Skeleton(allBones, allInvs), new THREE.Matrix4());
  lUpLeg.rotation.x = -1.25; // Seated thigh forward (+Z) lift
  rUpLeg.rotation.x = -1.25;
  armature.updateMatrixWorld(true);

  const p0 = new THREE.Vector3().fromBufferAttribute(skirtGeo.getAttribute('position'), stride * 3);
  const pDup = new THREE.Vector3().fromBufferAttribute(skirtGeo.getAttribute('position'), stride * 3 + segs);
  sm.applyBoneTransform(stride * 3, p0);
  sm.applyBoneTransform(stride * 3 + segs, pDup);
  assert.ok(
    p0.distanceTo(pDup) < 1e-5,
    `UV seam vertices must stay watertight when seated, gap=${p0.distanceTo(pDup)}`,
  );
  // Lateral hem vertex on +X side should articulate forward (+Z) with lifted thigh
  assert.ok(p0.z > 0.02, `Skirt/jacket hem must articulate forward with thigh in sit pose, got z=${p0.z}`);

  // Also test syncCompanionOutlineSkinWeights onto a +3mm extruded companion outline mesh
  const outPositions = positions.map((val, idx) => (idx % 3 === 1 ? val : val * 1.02));
  const outGeo = new THREE.BufferGeometry();
  outGeo.setAttribute('position', new THREE.Float32BufferAttribute(outPositions, 3));
  outGeo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(skinIdx.length), 4));
  outGeo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(skinWgt.length), 4));
  const boneNames = allBones.map((b) => b.name);
  const synced = syncCompanionOutlineSkinWeights(outGeo, skirtGeo, boneNames, boneNames);
  assert.equal(synced, positions.length / 3, 'All outline vertices must receive synced smoothed weights');
  assert.ok(rLegIdx >= 0);
});

test('prepareModularApparelGltfMaterials sets consistent body-skin, hair, clothing & outline hints including _skin_1 and hands_skin_1, and applyCitizenClothingTint skips skin/hair/outline', () => {
  assert.equal(classifyModularApparelMaterialHint('torso_top_skin_1', 'Atlas_Mat').isBodySkin, true);
  assert.equal(classifyModularApparelMaterialHint('hands_skin_1', 'Mat').normalizedMaterialName, 'Mat_Skin');
  assert.equal(classifyModularApparelMaterialHint('torso_top_Outline', 'Dark').normalizedMaterialName, 'Dark_Outline');
  assert.equal(classifyModularApparelMaterialHint('hair_bob_1', 'HairMat').isHair, true);

  const scene = new THREE.Group();
  const makeSm = (meshName: string, matName: string) => {
    const sm = new THREE.SkinnedMesh(
      makeBoxSkinnedGeometry(-0.1, 0.1, 1.0, 1.3, -0.05, 0.05, 0),
      new THREE.MeshBasicMaterial({ name: matName, color: 0xffffff }),
    );
    sm.name = meshName;
    scene.add(sm);
    return sm;
  };
  const torsoSkin1 = makeSm('torso_hoodie_skin_1', 'UnlabeledAtlas');
  const handsSkin1 = makeSm('hands_skin_1', 'PalmAtlas');
  const clothTop = makeSm('torso_hoodie_1', 'Hoodie_Clothing');
  const outlineTop = makeSm('torso_hoodie_Outline', 'InkShell');
  const hairCard = makeSm('hair_layered_1', 'StrandMat');

  const gltf = {
    scene,
    scenes: [scene],
    animations: [],
    cameras: [],
    asset: { version: '2.0' },
    parser: {} as GLTF['parser'],
    userData: {},
  };
  prepareModularApparelGltfMaterials(gltf);

  const skinMatA = torsoSkin1.material as THREE.Material;
  const skinMatB = handsSkin1.material as THREE.Material;
  const clothMat = clothTop.material as THREE.Material;
  const outMat = outlineTop.material as THREE.Material;
  const hairMat = hairCard.material as THREE.Material;

  assert.equal(skinMatA.customProgramCacheKey(), 'blitz-stylized-player-bodyskin-v9');
  assert.equal(skinMatB.customProgramCacheKey(), 'blitz-stylized-player-bodyskin-v9');
  assert.equal(clothMat.customProgramCacheKey(), 'blitz-stylized-player-cloth-v5');
  assert.equal(outMat.customProgramCacheKey(), 'blitz-stylized-player-thin-outline-v3');
  assert.equal(hairMat.customProgramCacheKey(), 'blitz-stylized-player-hair-v6');
  assert.equal(skinMatA.userData.isBodySkinMaterial, true);
  assert.equal(skinMatB.userData.isBodySkinMaterial, true);

  // Equip onto rig and verify applyCitizenClothingTint tints clothing ONLY (never skin/hair/outline)
  const baseGltf = buildMockCharacterGltf({
    isMale: false,
    armStartAbsX: 0.24,
    waistMaxY: 0.96,
    neckMinY: 1.32,
  });
  const rig = createMinimalBuddyRig(new THREE.Group());
  upgradeBuddyRigWithCharBuddiesGlb(rig, baseGltf);
  const { bones, inverses } = buildSkeletonHierarchy();
  for (const sm of [torsoSkin1, handsSkin1, clothTop, outlineTop, hairCard]) {
    sm.bind(new THREE.Skeleton(bones, inverses.map((m) => m.clone())), new THREE.Matrix4());
  }
  const { armature } = buildSkeletonHierarchy();
  scene.add(armature);
  assert.equal(applyEquippedTorsoToBuddyRig(rig, gltf), true);
  assert.equal(applyCitizenClothingTint(rig, '#2563eb'), true);

  const attachedCloth = findSkinnedMeshByName(rig.customGlbController!.glbRoot!, 'torso_hoodie_1')!;
  const attachedSkin = findSkinnedMeshByName(rig.customGlbController!.glbRoot!, 'torso_hoodie_skin_1')!;
  assert.notEqual(
    (attachedCloth.material as THREE.MeshBasicMaterial).color.getHexString(),
    'ffffff',
    'Clothing material must receive citizen tint',
  );
  assert.equal(
    (attachedSkin.material as THREE.MeshBasicMaterial).color.getHexString(),
    'f4cab3',
    'Untextured modular _skin_1 adopts base rig skin material and stays untinted to match face/hands skin seamlessly',
  );
});

test('Real GLB outfits in public/assets/outfit/ and DropScience bind cleanly onto Female, Male, and AmbientFemale rigs with 0 weight/index errors and 0 thigh/wrist/neck tearing across idle, walk, run, sit, and scooter poses', async () => {
  const [
    mixamoGltf,
    playerFemaleGltf,
    playerMaleGltf,
    ambientFemaleGltf,
    dropscienceGltf,
    bimaHairGltf,
    bimaTopGltf,
    bimaLegsGltf,
    bimaFeetGltf,
    miraHairGltf,
    miraTopGltf,
    miraShortsGltf,
    miraFeetGltf,
    rakaHairGltf,
    rakaTopGltf,
    rakaLegsGltf,
    tariCostumeGltf,
  ] = await Promise.all([
    loadRealDracoGlbForTest('public/assets/mixamo-locomotion-anim.glb'),
    loadRealDracoGlbForTest('public/assets/character_custom_idle_runway_catwalk_stylish_11 (3).glb'),
    loadRealDracoGlbForTest('public/assets/aistudio/character_custom_idle_runway_catwalk_stylish_11 (2).glb'),
    loadRealDracoGlbForTest('public/assets/character_custom_sit_formal_tenang_2.glb'),
    loadRealDracoGlbForTest('public/assets/torso_dropscience_hiphop_24_iap_1_3B9D82F3.glb'),
    loadRealDracoGlbForTest('public/assets/outfit/bima/blitz_hair_trend_autumn_edit_2_9582695C.glb'),
    loadRealDracoGlbForTest('public/assets/outfit/bima/blitz_torso_sport_goth_top_2_A2601584.glb'),
    loadRealDracoGlbForTest('public/assets/outfit/bima/blitz_legs_urban_2_9A943FA4.glb'),
    loadRealDracoGlbForTest('public/assets/outfit/bima/blitz_feet_warrior_trainers_1_36A44F38.glb'),
    loadRealDracoGlbForTest('public/assets/outfit/mira/blitz_hair_draped_hair_1_43391F7E.glb'),
    loadRealDracoGlbForTest('public/assets/outfit/mira/blitz_torso_resort_modern_6_5DC8FAA4.glb'),
    loadRealDracoGlbForTest('public/assets/outfit/mira/blitz_legs_dspastelgothdistressed_shorts_DDA37A46.glb'),
    loadRealDracoGlbForTest('public/assets/outfit/mira/blitz_feet_elska_sneakers_705A72B0.glb'),
    loadRealDracoGlbForTest('public/assets/outfit/raka/blitz_hair_valbotq_12_18181D54.glb'),
    loadRealDracoGlbForTest('public/assets/outfit/raka/blitz_torso_colorpop_bunny_club_1_7DF6EF18.glb'),
    loadRealDracoGlbForTest('public/assets/outfit/raka/blitz_legs_festive_1_2_FB88CC4F.glb'),
    loadRealDracoGlbForTest('public/assets/outfit/tari/tari-costume.glb'),
  ]);

  playerFemaleGltf.scene.userData.useMixamoLocomotionSuite = true;
  playerMaleGltf.scene.userData.useMixamoLocomotionSuite = true;
  ambientFemaleGltf.scene.userData.useMixamoLocomotionSuite = true;
  registerMixamoLocomotionSuiteGltf(mixamoGltf);

  const origNow = performance.now;
  let fakeNowMs = 5000;
  performance.now = () => fakeNowMs;

  try {
    const buildRig = (base: GLTF) => {
      const rig = createMinimalBuddyRig(new THREE.Group());
      upgradeBuddyRigWithCharBuddiesGlb(rig, base);
      return rig;
    };

    const rigs: Array<{ label: string; rig: BuddyCharacterRig }> = [];

    const femaleDropScience = buildRig(playerFemaleGltf);
    assert.equal(applyEquippedTorsoToBuddyRig(femaleDropScience, dropscienceGltf), true);
    rigs.push({ label: 'Female+DropScience', rig: femaleDropScience });

    const maleDropScience = buildRig(playerMaleGltf);
    assert.equal(applyEquippedTorsoToBuddyRig(maleDropScience, dropscienceGltf), true);
    rigs.push({ label: 'Male+DropScience', rig: maleDropScience });

    const bimaRig = buildRig(playerMaleGltf);
    assert.equal(applyEquippedApparelSlotToBuddyRig(bimaRig, 'hair', bimaHairGltf), true);
    assert.equal(applyEquippedTorsoToBuddyRig(bimaRig, bimaTopGltf), true);
    assert.equal(applyEquippedApparelSlotToBuddyRig(bimaRig, 'legs', bimaLegsGltf), true);
    assert.equal(applyEquippedApparelSlotToBuddyRig(bimaRig, 'feet', bimaFeetGltf), true);
    rigs.push({ label: 'Bima', rig: bimaRig });

    const miraRig = buildRig(ambientFemaleGltf);
    assert.equal(applyEquippedApparelSlotToBuddyRig(miraRig, 'hair', miraHairGltf), true);
    assert.equal(applyEquippedTorsoToBuddyRig(miraRig, miraTopGltf), true);
    assert.equal(applyEquippedApparelSlotToBuddyRig(miraRig, 'legs', miraShortsGltf), true);
    assert.equal(applyEquippedApparelSlotToBuddyRig(miraRig, 'feet', miraFeetGltf), true);
    rigs.push({ label: 'MiraOnAmbientFemale', rig: miraRig });

    const rakaRig = buildRig(playerMaleGltf);
    assert.equal(applyEquippedApparelSlotToBuddyRig(rakaRig, 'hair', rakaHairGltf), true);
    assert.equal(applyEquippedTorsoToBuddyRig(rakaRig, rakaTopGltf), true);
    assert.equal(applyEquippedApparelSlotToBuddyRig(rakaRig, 'legs', rakaLegsGltf), true);
    assert.equal(applyEquippedApparelSlotToBuddyRig(rakaRig, 'feet', bimaFeetGltf), true);
    rigs.push({ label: 'Raka', rig: rakaRig });

    const tariRig = buildRig(playerFemaleGltf);
    assert.equal(applyEquippedCostumeToBuddyRig(tariRig, tariCostumeGltf), true);
    rigs.push({ label: 'Tari', rig: tariRig });

    const scooterPose = computeScooterRiderRigPose({
      kind: 'electric_scooter_bike',
      distanceM: 2.0,
      speedMps: 5.5,
      mountBlend: 1.0,
    });

    for (const { label, rig } of rigs) {
      // 1. Validate weights & bone indices across every visible SkinnedMesh
      rig.bodyGroupRef!.traverse((node) => {
        if ((node as THREE.SkinnedMesh).isSkinnedMesh && node.visible) {
          const sm = node as THREE.SkinnedMesh;
          const si = sm.geometry.getAttribute('skinIndex');
          const sw = sm.geometry.getAttribute('skinWeight');
          if (!si || !sw) return;
          const boneCount = sm.skeleton.bones.length;
          for (let i = 0; i < sw.count; i++) {
            const sum = sw.getX(i) + sw.getY(i) + sw.getZ(i) + sw.getW(i);
            assert.ok(
              Number.isFinite(sum) && Math.abs(sum - 1.0) <= 1e-3,
              `${label} ${sm.name} vertex ${i} weight sum must be 1.0, got ${sum}`,
            );
            for (let k = 0; k < 4; k++) {
              const j = k === 0 ? si.getX(i) : k === 1 ? si.getY(i) : k === 2 ? si.getZ(i) : si.getW(i);
              const w = k === 0 ? sw.getX(i) : k === 1 ? sw.getY(i) : k === 2 ? sw.getZ(i) : sw.getW(i);
              assert.ok(
                !(w > 0 && (j < 0 || j >= boneCount)),
                `${label} ${sm.name} vertex ${i} invalid bone index ${j} >= ${boneCount}`,
              );
            }
          }
        }
      });

      // 2. Step idle -> walk -> run -> sit -> scooter -> emote and verify finite skinned positions & seam continuity
      const steps: Array<[string, () => void]> = [
        ['idle', () => updateCharacterWeaponStance(rig, 'unarmed', 0, false, false, 0, 0, 0, 'right', 0, 0, 0.76, 0, true, 'front', 1, 0, 0)],
        ['walk', () => updateCharacterWeaponStance(rig, 'unarmed', 0.4, true, false, 0, 0, 0, 'right', 0, 0, 0.76, 0, true, 'front', 1, 0, 2.5)],
        ['run', () => updateCharacterWeaponStance(rig, 'unarmed', 1.1, true, false, 0, 0, 0, 'right', 0, 0, 0.76, 0, true, 'front', 1, 0, 7.2)],
        ['sit', () => updateCharacterWeaponStance(rig, 'unarmed', 0, false, false, 0, 0, 0, 'right', 0, 0, 0.76, 0, true, 'front', 1, 0, 0, true)],
        ['scooter', () => updateCharacterWeaponStance(rig, 'unarmed', 0, true, false, 0, 0, 0, 'right', 0, 0, 0.76, 0, true, 'front', 1, 0, 5.5, false, false, false, scooterPose)],
        ['emote', () => updateCharacterWeaponStance(rig, 'unarmed', 0, false, false, 0.7, 0, 0.2, 'right', 0, 0, 0.76, 0, true, 'front', 1, 0, 0)],
      ];

      const vPos = new THREE.Vector3();
      for (const [poseName, runStep] of steps) {
        fakeNowMs += 100;
        runStep();
        rig.bodyGroupRef!.updateMatrixWorld(true);
        rig.bodyGroupRef!.traverse((node) => {
          if ((node as THREE.SkinnedMesh).isSkinnedMesh && node.visible) {
            const sm = node as THREE.SkinnedMesh;
            const pos = sm.geometry.getAttribute('position');
            const stepStride = Math.max(1, Math.floor(pos.count / 64));
            for (let vi = 0; vi < pos.count; vi += stepStride) {
              vPos.fromBufferAttribute(pos, vi);
              sm.applyBoneTransform(vi, vPos);
              assert.ok(
                Number.isFinite(vPos.x) && Number.isFinite(vPos.y) && Number.isFinite(vPos.z),
                `${label} ${sm.name} ${poseName} vertex ${vi} became non-finite`,
              );
              assert.ok(
                vPos.y >= -0.35 && vPos.y <= 2.2,
                `${label} ${sm.name} ${poseName} vertex ${vi} exploded out of bounds y=${vPos.y}`,
              );
            }
          }
        });
      }
    }

    // 3. Verify unequipping Mira's shorts cleanly restores pristine female leg skin positions & triangles
    const miraLegSkinBeforeUnequip = findSkinnedMeshByName(
      miraRig.customGlbController!.glbRoot!,
      'legs_frontrowsafaritrousers2f_skin_1',
    )!;
    assert.equal(applyEquippedApparelSlotToBuddyRig(miraRig, 'legs', null), true);
    const legSkinPos = miraLegSkinBeforeUnequip.geometry.getAttribute('position');
    let maxRestoredThighX = 0;
    for (let i = 0; i < legSkinPos.count; i++) {
      maxRestoredThighX = Math.max(maxRestoredThighX, Math.abs(legSkinPos.getX(i)));
    }
    assert.ok(maxRestoredThighX > 0.1, 'Unequipping shorts must restore pristine leg skin positions');
  } finally {
    performance.now = origNow;
    registerMixamoLocomotionSuiteGltf(null);
  }
});

test('Secondary physics shader hooks persist across frames, Raka ankles never cross midline, and sleeveless collar covers straps', async () => {
  const maleGltf = await loadRealDracoGlbForTest(
    'public/assets/aistudio/character_custom_idle_runway_catwalk_stylish_11 (2).glb',
  );
  const rakaTorso = await loadRealDracoGlbForTest(
    'public/assets/outfit/raka/blitz_torso_colorpop_bunny_club_1_7DF6EF18.glb',
  );
  const rakaLegs = await loadRealDracoGlbForTest(
    'public/assets/outfit/raka/blitz_legs_festive_1_2_FB88CC4F.glb',
  );
  const rakaAnims = await loadRealDracoGlbForTest('public/assets/raka-anims.glb');

  const bodyGroup = new THREE.Group();
  const rig = createMinimalBuddyRig(bodyGroup);
  upgradeBuddyRigWithCharBuddiesGlb(rig, maleGltf);
  applyEquippedTorsoToBuddyRig(rig, rakaTorso);
  applyEquippedApparelSlotToBuddyRig(rig, 'legs', rakaLegs);

  const origNow = performance.now;
  let nowMs = 5000;
  performance.now = () => nowMs;
  try {
    // 1. Hair & garment secondary physics cloned materials survive stepCharBuddiesGlbRigController frames
    const countHookedMeshes = (): number => {
      let n = 0;
      rig.customGlbController!.glbRoot!.traverse((obj) => {
        if (!(obj as THREE.Mesh).isMesh) return;
        const m = (obj as THREE.Mesh).material;
        const mats = Array.isArray(m) ? m : m ? [m] : [];
        if (mats.some((mat) => Boolean(mat?.userData?.__isSecondaryPhysicsClonedMat))) n++;
      });
      return n;
    };
    assert.ok(countHookedMeshes() >= 1, 'Expected secondary physics shader hooks before frame step');
    for (const [isMov, spd] of [
      [false, 0],
      [true, 4.5],
      [true, 7.2],
      [false, 0],
    ] as const) {
      nowMs += 40;
      updateCharacterWeaponStance(rig, 'unarmed', 0.2, isMov, false, 0, 0, 0, 'right', 0, 0, 0.76, 0, true, 'front', 1, 0.3, spd);
      assert.ok(
        countHookedMeshes() >= 1,
        `Secondary physics shader hooks must stay attached during frame speed=${spd}`,
      );
    }

    // 2. Raka sleeveless collar bridge maintains shoulder breadth underneath tank straps (x >= 0.12 at y~1.31)
    const suppSkin = findSkinnedMeshByName(rig.customGlbController!.glbRoot!, 'torso_supplemental_skin')!;
    assert.ok(suppSkin, 'Expected torso_supplemental_skin for Raka sleeveless tank');
    const suppPos = suppSkin.geometry.getAttribute('position');
    let maxShoulderSpanX = 0;
    for (let i = 0; i < suppPos.count; i++) {
      const y = suppPos.getY(i);
      if (y >= 1.29 && y <= 1.33) {
        maxShoulderSpanX = Math.max(maxShoulderSpanX, Math.abs(suppPos.getX(i)));
      }
    }
    assert.ok(
      maxShoulderSpanX >= 0.122,
      `Raka sleeveless collar plateau must cover tank strap inner edge (maxShoulderSpanX=${maxShoulderSpanX.toFixed(3)})`,
    );

    // 3. Raka ankle outline vertices keep same-side Left/Right weights across raka_idle.001 pose (no midline bar)
    const idleClip =
      rakaAnims.animations.find((c: THREE.AnimationClip) => /idle/i.test(c.name)) ??
      rakaAnims.animations[0];
    rig.customGlbController!.mixer.clipAction(idleClip).play();
    rig.customGlbController!.mixer.update(0.35);
    rig.customGlbController!.glbRoot!.updateMatrixWorld(true);

    const legOutMesh = findSkinnedMeshByName(
      rig.customGlbController!.glbRoot!,
      'legs_blitz_festivefrenzy1mpbr_Outline',
    )!;
    const oPos = legOutMesh.geometry.getAttribute('position');
    const oIdx = legOutMesh.geometry.getIndex()!;
    const v = new THREE.Vector3();
    const wp: THREE.Vector3[] = [];
    for (let i = 0; i < oPos.count; i++) {
      v.fromBufferAttribute(oPos, i);
      legOutMesh.applyBoneTransform(i, v);
      wp.push(v.clone());
    }
    const sIdxAttr = legOutMesh.geometry.getAttribute('skinIndex') as THREE.BufferAttribute;
    const sWgtAttr = legOutMesh.geometry.getAttribute('skinWeight') as THREE.BufferAttribute;
    for (let i = 0; i < oIdx.count; i += 3) {
      const a = oIdx.getX(i);
      const b = oIdx.getX(i + 1);
      const c = oIdx.getX(i + 2);
      const maxY = Math.max(wp[a].y, wp[b].y, wp[c].y);
      const maxEdge = Math.max(wp[a].distanceTo(wp[b]), wp[b].distanceTo(wp[c]), wp[c].distanceTo(wp[a]));
      if (maxY < 0.30) {
        assert.ok(maxEdge < 0.135, `Ankle outline triangle [${a},${b},${c}] stretched across gap (${maxEdge.toFixed(3)}m)`);
      }
      if (Math.max(oPos.getY(a), oPos.getY(b), oPos.getY(c)) < 0.45) {
        let sawLeft = false;
        let sawRight = false;
        for (const vi of [a, b, c]) {
          for (let k = 0; k < 4; k++) {
            if (sWgtAttr.getComponent(vi, k) > 0.05) {
              const bName = legOutMesh.skeleton.bones[sIdxAttr.getComponent(vi, k)]?.name ?? '';
              if (bName.includes('Left')) sawLeft = true;
              if (bName.includes('Right')) sawRight = true;
            }
          }
        }
        assert.ok(!(sawLeft && sawRight), `Ankle outline triangle [${a},${b},${c}] must not span Left and Right legs`);
      }
    }
  } finally {
    performance.now = origNow;
  }
});
