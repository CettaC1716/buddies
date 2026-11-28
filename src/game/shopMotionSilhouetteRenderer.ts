import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  getCachedLoadedBlitzAssets,
  loadAndAttachExternalStyleAnimationClip,
  loadModularApparelGltf,
  upgradeBuddyRigWithCharBuddiesGlb,
  type BuddyCharacterRig,
} from './buddiesBlitzShadersAndAssets';
import {
  classifyDefaultAvatarSlotFromMeshName,
  getWardrobeCatalogItemById,
  type WardrobeCatalogItem,
  type WardrobeDanceKind,
} from './buddiesWardrobeStudioRules';

const DEFAULT_FEMALE_SILHOUETTE_GLB = '/assets/avatars/blitz-female-03.glb';
const DEFAULT_MALE_SILHOUETTE_GLB = '/assets/avatars/blitz-male-player.glb';

interface RestBoneTransform {
  bone: THREE.Bone;
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  scale: THREE.Vector3;
}

interface SilhouetteRigInstance {
  root: THREE.Group;
  rig: BuddyCharacterRig;
  restBones: RestBoneTransform[];
  materials: THREE.Material[];
  dispose: () => void;
}

export interface LiveMotionSilhouetteHandle {
  group: THREE.Group;
  update: (dt: number) => void;
  dispose: () => void;
}

type SilhouetteMaterialTone =
  | 'primary_skin'
  | 'primary_garment'
  | 'partner_skin'
  | 'partner_garment';

const _tempEuler = new THREE.Euler(0, 0, 0, 'XYZ');
const _tempQuat = new THREE.Quaternion();
const _tempVec = new THREE.Vector3();
const _tempBox = new THREE.Box3();
const _tempSize = new THREE.Vector3();
const _tempCenter = new THREE.Vector3();

function createDummyBuddyRig(rootGroup: THREE.Group, isSoftwareGl: boolean): BuddyCharacterRig {
  const emptyGeo = new THREE.BufferGeometry();
  const emptyMat = new THREE.MeshBasicMaterial({ visible: false });
  const headMesh = new THREE.Mesh(emptyGeo, emptyMat);
  const weaponMesh = new THREE.Mesh(emptyGeo, emptyMat);
  const weaponRigGroup = new THREE.Group();
  weaponRigGroup.visible = false;

  return {
    headMesh,
    leftArmPivot: new THREE.Group(),
    rightArmPivot: new THREE.Group(),
    leftLegPivot: new THREE.Group(),
    rightLegPivot: new THREE.Group(),
    weaponMesh,
    weaponRigGroup,
    pistolGroup: new THREE.Group(),
    rifleGroup: new THREE.Group(),
    bazookaGroup: new THREE.Group(),
    laserGroup: new THREE.Group(),
    gatlingGroup: new THREE.Group(),
    fishingRodGroup: new THREE.Group(),
    bazookaFrontFlash: new THREE.Group(),
    bazookaBackblastGroup: new THREE.Group(),
    bodyGroupRef: rootGroup,
    teamRef: 'blue',
    isSoftwareGlRef: isSoftwareGl,
  };
}

function createSilhouetteMaterial(
  tone: SilhouetteMaterialTone,
  alphaSourceMat?: THREE.Material | null,
): THREE.MeshStandardMaterial {
  const baseVec =
    tone === 'primary_garment'
      ? 'vec3(0.022, 0.024, 0.032)'
      : tone === 'primary_skin'
        ? 'vec3(0.048, 0.050, 0.062)'
        : tone === 'partner_garment'
          ? 'vec3(0.165, 0.168, 0.195)'
          : 'vec3(0.220, 0.222, 0.252)';
  const rimStrength =
    tone === 'primary_garment'
      ? 0.82
      : tone === 'primary_skin'
        ? 0.42
        : tone === 'partner_garment'
          ? 0.72
          : 0.48;

  const srcStd = alphaSourceMat as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial | undefined;
  const hasCutoutAlpha = Boolean(
    srcStd &&
      srcStd.map &&
      (srcStd.alphaTest > 0 || srcStd.transparent || Boolean((srcStd as THREE.MeshStandardMaterial).alphaMap)),
  );

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#090A0D'),
    roughness: 0.92,
    metalness: 0.0,
    side: hasCutoutAlpha ? THREE.DoubleSide : THREE.FrontSide,
    ...(hasCutoutAlpha
      ? {
          map: srcStd!.map,
          alphaMap: (srcStd as THREE.MeshStandardMaterial).alphaMap ?? null,
          alphaTest: Math.max(srcStd!.alphaTest || 0, 0.42),
          transparent: false,
        }
      : {}),
  });

  const cacheKey = `red-studio-silhouette-${tone}-${hasCutoutAlpha ? 'cutout' : 'solid'}-v1`;
  mat.customProgramCacheKey = () => cacheKey;
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      /* glsl */ `
      {
        vec3 silN = normalize(normal);
        vec3 silV = normalize(vViewPosition);
        float silNdotV = clamp(abs(dot(silN, silV)), 0.0, 1.0);
        float silRim = smoothstep(0.18, 0.76, pow(1.0 - silNdotV, 2.35));
        vec3 silBase = ${baseVec};
        vec3 silRimCol = vec3(0.95, 0.93, 0.90);
        gl_FragColor = vec4(mix(silBase, silRimCol, silRim * ${rimStrength.toFixed(3)}), 1.0);
      }
      #include <dithering_fragment>
      `,
    );
  };
  return mat;
}

function shouldHideMeshInSilhouette(mesh: THREE.Mesh): boolean {
  const lower = (mesh.name || '').toLowerCase();
  if (lower.includes('outline') || Boolean(mesh.userData?.isRuntimeOutlineMesh)) return true;
  // Hide facial overlay decals / inner mouth parts so the head forms a sleek editorial silhouette
  if (
    lower.includes('eyelash') ||
    lower.includes('lash') ||
    lower.includes('eyebrow') ||
    lower.includes('brow') ||
    lower.includes('cornea') ||
    lower.includes('pupil') ||
    lower.includes('iris') ||
    lower.includes('sclera') ||
    lower.includes('tear') ||
    lower.includes('blush') ||
    lower.includes('makeup') ||
    lower.includes('eyeshadow') ||
    lower.includes('lipstick') ||
    lower.includes('teeth') ||
    lower.includes('tongue') ||
    lower.includes('mouth_inner') ||
    lower.includes('shadow')
  ) {
    return true;
  }
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (mat && mat.side === THREE.BackSide) return true;
  return false;
}

function isGarmentMesh(mesh: THREE.Mesh): boolean {
  const lower = (mesh.name || '').toLowerCase();
  if (lower.includes('_skin') || lower.includes('basedoll') || lower.startsWith('head_') || lower.startsWith('ears_')) {
    return false;
  }
  const slot = classifyDefaultAvatarSlotFromMeshName(mesh.name || '');
  return (
    slot === 'torso' ||
    slot === 'legs' ||
    slot === 'feet' ||
    slot === 'neck' ||
    lower.includes('top') ||
    lower.includes('shirt') ||
    lower.includes('short') ||
    lower.includes('pant') ||
    lower.includes('skirt') ||
    lower.includes('dress') ||
    lower.includes('shoe') ||
    lower.includes('boot') ||
    lower.includes('jacket') ||
    lower.includes('hoodie')
  );
}

function applySilhouetteMaterialsToRig(
  glbRoot: THREE.Object3D,
  isPartner: boolean,
): THREE.Material[] {
  const skinMat = createSilhouetteMaterial(isPartner ? 'partner_skin' : 'primary_skin');
  const garmentMat = createSilhouetteMaterial(isPartner ? 'partner_garment' : 'primary_garment');
  const createdMaterials: THREE.Material[] = [skinMat, garmentMat];

  glbRoot.traverse((node) => {
    if (!(node as THREE.Mesh).isMesh) return;
    const mesh = node as THREE.Mesh;
    if (shouldHideMeshInSilhouette(mesh)) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    const garment = isGarmentMesh(mesh);
    const origMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const origStd = origMat as THREE.MeshStandardMaterial | undefined;
    const needsCutout = Boolean(
      origStd &&
        origStd.map &&
        (origStd.alphaTest > 0 || origStd.transparent || Boolean(origStd.alphaMap)),
    );

    if (needsCutout) {
      const cutoutMat = createSilhouetteMaterial(
        garment
          ? isPartner
            ? 'partner_garment'
            : 'primary_garment'
          : isPartner
            ? 'partner_skin'
            : 'primary_skin',
        origMat,
      );
      createdMaterials.push(cutoutMat);
      mesh.material = cutoutMat;
    } else {
      mesh.material = garment ? garmentMat : skinMat;
    }
  });

  return createdMaterials;
}

async function loadBaseSilhouetteGltf(gender: 'female' | 'male'): Promise<GLTF | null> {
  const cached = getCachedLoadedBlitzAssets();
  if (gender === 'male') {
    if (cached?.playerMaleGlb) return cached.playerMaleGlb;
    return loadModularApparelGltf(DEFAULT_MALE_SILHOUETTE_GLB);
  }
  if (cached?.playerFemaleGlb) return cached.playerFemaleGlb;
  return loadModularApparelGltf(DEFAULT_FEMALE_SILHOUETTE_GLB);
}

function captureRestBoneTransforms(glbRoot: THREE.Object3D): RestBoneTransform[] {
  const list: RestBoneTransform[] = [];
  glbRoot.traverse((node) => {
    if ((node as THREE.Bone).isBone) {
      const bone = node as THREE.Bone;
      list.push({
        bone,
        pos: bone.position.clone(),
        quat: bone.quaternion.clone(),
        scale: bone.scale.clone(),
      });
    }
  });
  return list;
}

function restoreRestBoneTransforms(restBones: RestBoneTransform[]): void {
  for (let i = 0; i < restBones.length; i++) {
    const entry = restBones[i];
    entry.bone.position.copy(entry.pos);
    entry.bone.quaternion.copy(entry.quat);
    entry.bone.scale.copy(entry.scale);
  }
}

async function createSilhouetteRigInstance(
  gender: 'female' | 'male',
  isPartner: boolean,
  isSoftwareGl: boolean,
): Promise<SilhouetteRigInstance | null> {
  const baseGltf = await loadBaseSilhouetteGltf(gender);
  if (!baseGltf) return null;

  const root = new THREE.Group();
  root.userData.disableNpcOutline = true;
  const rig = createDummyBuddyRig(root, isSoftwareGl);
  upgradeBuddyRigWithCharBuddiesGlb(rig, baseGltf, null, null);

  const ctrl = rig.customGlbController;
  if (!ctrl?.glbRoot) return null;

  // Capture pristine rest-pose bone transforms before stopping initial actions
  ctrl.mixer.stopAllAction();
  const restBones = captureRestBoneTransforms(ctrl.glbRoot);
  const materials = applySilhouetteMaterialsToRig(ctrl.glbRoot, isPartner);

  const dispose = () => {
    ctrl.mixer.stopAllAction();
    ctrl.mixer.uncacheRoot(ctrl.glbRoot);
    for (const m of materials) m.dispose();
    rig.headMesh.geometry.dispose();
    (rig.headMesh.material as THREE.Material).dispose();
    root.clear();
  };

  return { root, rig, restBones, materials, dispose };
}

function applyAdditiveBoneRot(
  bone: THREE.Bone | undefined,
  rx: number,
  ry: number,
  rz: number,
): void {
  if (!bone) return;
  _tempEuler.set(rx, ry, rz, 'XYZ');
  _tempQuat.setFromEuler(_tempEuler);
  bone.quaternion.multiply(_tempQuat);
}

function applyProceduralDancePose(
  bones: Map<string, THREE.Bone>,
  kind: WardrobeDanceKind,
  phase: number,
): void {
  if (kind === 'none') return;
  const s1 = Math.sin(phase);
  const s2 = Math.sin(phase * 2);
  const c1 = Math.cos(phase);

  const spine2 = bones.get('Spine2');
  const head = bones.get('Head');
  const rArm = bones.get('RightArm');
  const rFore = bones.get('RightForeArm');
  const lArm = bones.get('LeftArm');
  const lFore = bones.get('LeftForeArm');

  if (kind === 'groove') {
    applyAdditiveBoneRot(spine2, 0.04 * s2, 0.14 * s1, 0.12 * c1);
    applyAdditiveBoneRot(head, 0.08 * s2, -0.08 * s1, 0.06 * c1);
    applyAdditiveBoneRot(rArm, -0.35 + 0.25 * s1, 0.15 * c1, -0.22 + 0.16 * s1);
    applyAdditiveBoneRot(rFore, 0.45 + 0.2 * c1, 0, -0.45);
    applyAdditiveBoneRot(lArm, -0.35 - 0.25 * s1, -0.15 * c1, 0.22 - 0.16 * s1);
    applyAdditiveBoneRot(lFore, 0.45 - 0.2 * c1, 0, 0.45);
  } else if (kind === 'wave') {
    applyAdditiveBoneRot(spine2, -0.04, 0.08, -0.05);
    applyAdditiveBoneRot(head, 0.04, -0.06, 0.12 * Math.sin(phase * 0.5));
    applyAdditiveBoneRot(rArm, -1.15, 0.25, -0.68);
    applyAdditiveBoneRot(rFore, -0.2, 0.15, -0.78 + 0.36 * s2);
    applyAdditiveBoneRot(lArm, 0.08, 0, 0.18);
  } else if (kind === 'cheer') {
    applyAdditiveBoneRot(spine2, -0.08 + 0.06 * s2, 0.06 * s1, 0.06 * c1);
    applyAdditiveBoneRot(head, -0.06 + 0.05 * s2, 0, 0.06 * s1);
    applyAdditiveBoneRot(rArm, -1.35 + 0.16 * s2, 0.15, -0.55);
    applyAdditiveBoneRot(rFore, 0.15, 0, -0.25 + 0.18 * s2);
    applyAdditiveBoneRot(lArm, -1.35 - 0.16 * s2, -0.15, 0.55);
    applyAdditiveBoneRot(lFore, 0.15, 0, 0.25 - 0.18 * s2);
  } else if (kind === 'salute') {
    applyAdditiveBoneRot(spine2, -0.05, 0.04, 0);
    applyAdditiveBoneRot(head, 0.02, -0.04, 0);
    applyAdditiveBoneRot(rArm, -0.95, 0.42, -0.58);
    applyAdditiveBoneRot(rFore, -0.32, 0.22, -1.25);
    applyAdditiveBoneRot(lArm, 0.12, 0, 0.12);
  } else if (kind === 'idol_pop') {
    applyAdditiveBoneRot(spine2, 0.07 * s2, 0.2 * s1, 0.15 * c1);
    applyAdditiveBoneRot(head, 0.09 * s2, -0.14 * s1, 0.11 * c1);
    applyAdditiveBoneRot(rArm, -0.82 + 0.34 * s1, 0.22 * c1, -0.45 + 0.22 * c1);
    applyAdditiveBoneRot(rFore, 0.35 + 0.28 * s2, 0, -0.78 + 0.24 * s1);
    applyAdditiveBoneRot(lArm, -0.72 - 0.34 * s1, -0.22 * c1, 0.45 - 0.22 * c1);
    applyAdditiveBoneRot(lFore, 0.35 - 0.28 * s2, 0, 0.78 - 0.24 * s1);
  } else if (kind === 'hiphop') {
    applyAdditiveBoneRot(spine2, 0.14 + 0.11 * s2, 0.18 * s1, 0.16 * c1);
    applyAdditiveBoneRot(head, 0.14 * s2, -0.1 * s1, 0.08 * c1);
    applyAdditiveBoneRot(rArm, -0.48 + 0.32 * s1, 0.28 * c1, -0.35 + 0.18 * s2);
    applyAdditiveBoneRot(rFore, 0.65 + 0.26 * c1, 0, -0.68);
    applyAdditiveBoneRot(lArm, -0.48 - 0.32 * s1, -0.28 * c1, 0.35 - 0.18 * s2);
    applyAdditiveBoneRot(lFore, 0.65 - 0.26 * c1, 0, 0.68);
  }
}

interface ResolvedMotionItemPlayback {
  gender: 'female' | 'male';
  primaryGlbUrl: string | null;
  primaryClipKey: string | null;
  primaryCandidates: readonly string[];
  partnerGlbUrl: string | null;
  partnerClipKey: string | null;
  danceKind: WardrobeDanceKind;
  tempoBpm: number;
  slot: WardrobeCatalogItem['slot'];
}

function resolveMotionItemPlayback(wardrobeItemId: string): ResolvedMotionItemPlayback {
  const item = getWardrobeCatalogItemById(wardrobeItemId);
  if (!item) {
    return {
      gender: 'female',
      primaryGlbUrl: null,
      primaryClipKey: null,
      primaryCandidates: ['idle.001'],
      partnerGlbUrl: null,
      partnerClipKey: null,
      danceKind: 'none',
      tempoBpm: 110,
      slot: 'style_anim',
    };
  }

  const gender: 'female' | 'male' = item.gender === 'male' ? 'male' : 'female';

  if (item.slot === 'style_paired' && item.pairedAnim) {
    return {
      gender,
      primaryGlbUrl: item.pairedAnim.initiateGlbUrl || null,
      primaryClipKey: `sil_${item.id}_init`,
      primaryCandidates: ['idle.001'],
      partnerGlbUrl: item.pairedAnim.receiveGlbUrl || null,
      partnerClipKey: `sil_${item.id}_recv`,
      danceKind: 'none',
      tempoBpm: 110,
      slot: item.slot,
    };
  }

  if (
    (item.slot === 'style_dance' || item.slot === 'style_pose' || item.slot === 'style_action') &&
    item.dancePose
  ) {
    return {
      gender,
      primaryGlbUrl: item.dancePose.animGlbUrl ?? null,
      primaryClipKey: item.dancePose.animGlbUrl ? `sil_${item.id}` : null,
      primaryCandidates: ['idle.001'],
      partnerGlbUrl: null,
      partnerClipKey: null,
      danceKind: item.dancePose.animGlbUrl ? 'none' : item.dancePose.danceKind,
      tempoBpm: item.dancePose.tempoBpm || 110,
      slot: item.slot,
    };
  }

  if (item.slot === 'style_anim' && item.animSet) {
    return {
      gender,
      primaryGlbUrl: item.animSet.animGlbUrl ?? null,
      primaryClipKey: item.animSet.animGlbUrl ? `sil_${item.id}_idle` : null,
      primaryCandidates:
        item.animSet.clipCandidates.length > 0 ? item.animSet.clipCandidates : ['idle.001'],
      partnerGlbUrl: null,
      partnerClipKey: null,
      danceKind: 'none',
      tempoBpm: 110,
      slot: item.slot,
    };
  }

  return {
    gender,
    primaryGlbUrl: null,
    primaryClipKey: null,
    primaryCandidates: ['idle.001'],
    partnerGlbUrl: null,
    partnerClipKey: null,
    danceKind: 'none',
    tempoBpm: 110,
    slot: item.slot,
  };
}

async function resolveAndPlayClipOnRig(
  instance: SilhouetteRigInstance,
  glbUrl: string | null,
  clipKey: string | null,
  candidates: readonly string[],
  sampleTimeSec?: number,
): Promise<THREE.AnimationClip | null> {
  const ctrl = instance.rig.customGlbController;
  if (!ctrl?.mixer) return null;

  let clip: THREE.AnimationClip | null = null;
  if (glbUrl && clipKey) {
    clip = await loadAndAttachExternalStyleAnimationClip(instance.rig, glbUrl, clipKey);
  }
  if (!clip) {
    for (const name of candidates) {
      const found = ctrl.clips.get(name);
      if (found) {
        clip = found;
        break;
      }
    }
  }
  if (!clip) {
    clip = ctrl.clips.get('idle.001') ?? ctrl.clips.values().next().value ?? null;
  }
  if (!clip) return null;

  ctrl.mixer.stopAllAction();
  restoreRestBoneTransforms(instance.restBones);

  const action = ctrl.mixer.clipAction(clip);
  action.reset();
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.enabled = true;
  action.setEffectiveWeight(1);
  action.play();

  const evalTime =
    typeof sampleTimeSec === 'number'
      ? Math.max(0, Math.min(sampleTimeSec, Math.max(0.01, clip.duration - 0.01)))
      : 0.016;
  ctrl.mixer.setTime(evalTime);
  ctrl.glbRoot.position.y = ctrl.baseRootY;
  return clip;
}

function chooseRepresentativeSampleTime(
  clip: THREE.AnimationClip | null,
  slot: WardrobeCatalogItem['slot'],
): number {
  if (!clip || clip.duration <= 0.12) return 0.02;
  if (slot === 'style_pose') {
    return Math.min(clip.duration * 0.45, 0.55);
  }
  if (slot === 'style_paired') {
    return Math.min(clip.duration * 0.42, 1.35);
  }
  if (slot === 'style_dance' || slot === 'style_action') {
    return Math.min(clip.duration * 0.36, 1.25);
  }
  return Math.min(clip.duration * 0.3, 0.9);
}

function chooseRepresentativeDancePhase(kind: WardrobeDanceKind): number {
  switch (kind) {
    case 'groove':
      return Math.PI * 0.38;
    case 'wave':
      return Math.PI * 0.55;
    case 'cheer':
      return Math.PI * 0.28;
    case 'salute':
      return Math.PI * 0.45;
    case 'idol_pop':
      return Math.PI * 0.35;
    case 'hiphop':
      return Math.PI * 0.42;
    default:
      return 0;
  }
}

const _pairP1 = new THREE.Vector3();
const _pairP2 = new THREE.Vector3();

function getPelvisWorldPosition(inst: SilhouetteRigInstance, out: THREE.Vector3): boolean {
  const bones = inst.rig.customGlbController?.bones;
  const pelvis =
    bones?.get('Hips') ??
    bones?.get('PelvisRoot') ??
    bones?.get('Spine') ??
    inst.restBones[0]?.bone;
  if (!pelvis) return false;
  pelvis.getWorldPosition(out);
  return true;
}

/**
 * Computes an editorial 3/4 broadside yaw so two paired silhouettes stand clearly
 * side-by-side in frame instead of occluding one another along the camera Z axis.
 */
function alignPairedSilhouettesAndComputeYaw(
  rigContainer: THREE.Group,
  primary: SilhouetteRigInstance,
  partner: SilhouetteRigInstance,
): number {
  primary.root.position.set(0, 0, 0);
  partner.root.position.set(0, 0, 0);
  rigContainer.rotation.set(0, 0, 0);
  rigContainer.scale.set(1, 1, 1);
  rigContainer.position.set(0, 0, 0);
  rigContainer.updateMatrixWorld(true);

  if (getPelvisWorldPosition(primary, _pairP1) && getPelvisWorldPosition(partner, _pairP2)) {
    const dx = _pairP2.x - _pairP1.x;
    const dz = _pairP2.z - _pairP1.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) {
      // Fallback separation if both paired clips have identical root origin
      primary.root.position.set(-0.34, 0, 0);
      partner.root.position.set(0.34, 0, 0);
      rigContainer.updateMatrixWorld(true);
      return -0.2;
    }
    return Math.atan2(dz, dx) - 0.24;
  }
  return -0.34;
}

/**
 * Computes posed world bounds directly from animated skeleton bone positions (with head/foot/limb
 * anatomical margins) so SkinnedMesh poses (standing, crouching, seated, jumping, or paired duos)
 * are framed accurately without expensive per-vertex CPU skinning.
 */
function framePosedSilhouetteGroup(
  container: THREE.Group,
  instances: SilhouetteRigInstance[],
  targetMaxDim: number,
  groundY: number,
  centerVertically = false,
): void {
  container.scale.set(1, 1, 1);
  container.position.set(0, 0, 0);
  container.updateMatrixWorld(true);

  _tempBox.makeEmpty();
  for (const inst of instances) {
    for (let i = 0; i < inst.restBones.length; i++) {
      const bone = inst.restBones[i].bone;
      bone.getWorldPosition(_tempVec);
      _tempBox.expandByPoint(_tempVec);
      const lower = (bone.name || '').toLowerCase();
      if (lower.includes('head')) {
        // Add crown / hair height above head pivot
        _tempVec.y += 0.34;
        _tempBox.expandByPoint(_tempVec);
      } else if (lower.includes('foot') || lower.includes('toe')) {
        _tempVec.y -= 0.1;
        _tempBox.expandByPoint(_tempVec);
      }
    }
  }

  if (_tempBox.isEmpty()) return;

  // Add modest shoulder/limb silhouette padding horizontally
  _tempBox.min.x -= 0.22;
  _tempBox.max.x += 0.22;
  _tempBox.min.z -= 0.22;
  _tempBox.max.z += 0.22;

  _tempBox.getSize(_tempSize);
  _tempBox.getCenter(_tempCenter);

  const maxDim = Math.max(_tempSize.x, _tempSize.y, _tempSize.z * 0.9, 0.5);
  const scale = targetMaxDim / maxDim;
  container.scale.setScalar(scale);

  if (centerVertically) {
    container.position.set(
      -_tempCenter.x * scale,
      -_tempCenter.y * scale,
      -_tempCenter.z * scale,
    );
  } else {
    container.position.set(
      -_tempCenter.x * scale,
      groundY - _tempBox.min.y * scale,
      -_tempCenter.z * scale,
    );
  }
}

/**
 * Builds a live animated 3D human silhouette preview (single or paired duo) for the
 * Red Studio interactive turntable stage (`ShopProduct3DTurntable`).
 */
export async function createLiveMotionSilhouettePreview(
  wardrobeItemId: string,
  isSoftwareGl: boolean,
): Promise<LiveMotionSilhouetteHandle | null> {
  const spec = resolveMotionItemPlayback(wardrobeItemId);
  const stageWrapper = new THREE.Group();
  const rigContainer = new THREE.Group();
  stageWrapper.add(rigContainer);

  const primary = await createSilhouetteRigInstance(spec.gender, false, isSoftwareGl);
  if (!primary) return null;
  rigContainer.add(primary.root);

  const instances: SilhouetteRigInstance[] = [primary];

  let partner: SilhouetteRigInstance | null = null;
  if (spec.partnerGlbUrl && spec.partnerClipKey) {
    const partnerGender: 'female' | 'male' = spec.gender === 'male' ? 'female' : 'male';
    partner = await createSilhouetteRigInstance(partnerGender, true, isSoftwareGl);
    if (partner) {
      rigContainer.add(partner.root);
      instances.push(partner);
    }
  }

  const [primaryClip] = await Promise.all([
    resolveAndPlayClipOnRig(
      primary,
      spec.primaryGlbUrl,
      spec.primaryClipKey,
      spec.primaryCandidates,
    ),
    partner && spec.partnerGlbUrl && spec.partnerClipKey
      ? resolveAndPlayClipOnRig(partner, spec.partnerGlbUrl, spec.partnerClipKey, ['idle.001'])
      : Promise.resolve(null),
  ]);

  // Evaluate once at representative pose to compute clean stage framing, then reset to t=0 for live playback
  const frameSampleTime = chooseRepresentativeSampleTime(primaryClip, spec.slot);
  primary.rig.customGlbController?.mixer.setTime(frameSampleTime);
  if (partner) {
    partner.rig.customGlbController?.mixer.setTime(frameSampleTime);
  }
  if (spec.danceKind !== 'none' && primary.rig.customGlbController) {
    applyProceduralDancePose(
      primary.rig.customGlbController.bones,
      spec.danceKind,
      chooseRepresentativeDancePhase(spec.danceKind),
    );
  }
  if (partner) {
    const broadsideYaw = alignPairedSilhouettesAndComputeYaw(rigContainer, primary, partner);
    stageWrapper.rotation.y = broadsideYaw;
  }
  framePosedSilhouetteGroup(
    rigContainer,
    instances,
    partner ? 1.62 : 1.56,
    -0.84,
    false,
  );

  // Reset actions cleanly to t=0 so paired / solo animations loop smoothly from frame 0
  primary.rig.customGlbController?.mixer.setTime(0);
  if (partner) {
    partner.rig.customGlbController?.mixer.setTime(0);
  }

  let danceClock = 0;
  let disposed = false;

  return {
    group: stageWrapper,
    update(dt: number) {
      if (disposed) return;
      const clampedDt = Math.min(dt, 0.05);
      for (let i = 0; i < instances.length; i++) {
        const ctrl = instances[i].rig.customGlbController;
        if (!ctrl) continue;
        ctrl.mixer.update(clampedDt);
        ctrl.glbRoot.position.y = ctrl.baseRootY;
      }
      if (spec.danceKind !== 'none' && primary.rig.customGlbController) {
        danceClock += clampedDt;
        const beatHz = (spec.tempoBpm || 110) / 60;
        const phase = danceClock * beatHz * Math.PI;
        applyProceduralDancePose(primary.rig.customGlbController.bones, spec.danceKind, phase);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const inst of instances) {
        inst.dispose();
      }
      rigContainer.clear();
      stageWrapper.clear();
    },
  };
}

// ── Pooled Offscreen WebGL Silhouette Thumbnail Rasterizer ────────────────────

const motionThumbCache = new Map<string, string>();
const motionThumbInFlight = new Map<string, Promise<string | null>>();

interface PooledThumbContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  stageHolder: THREE.Group;
  rigs: {
    femalePrimary: SilhouetteRigInstance | null;
    malePrimary: SilhouetteRigInstance | null;
    femalePartner: SilhouetteRigInstance | null;
    malePartner: SilhouetteRigInstance | null;
  };
}

let pooledThumbCtx: PooledThumbContext | null = null;
let thumbIdleDisposeTimer: number | null = null;
let thumbQueueTail: Promise<void> = Promise.resolve();

function scheduleThumbPoolDispose(): void {
  if (typeof window === 'undefined') return;
  if (thumbIdleDisposeTimer !== null) {
    window.clearTimeout(thumbIdleDisposeTimer);
  }
  thumbIdleDisposeTimer = window.setTimeout(() => {
    thumbIdleDisposeTimer = null;
    if (!pooledThumbCtx) return;
    pooledThumbCtx.rigs.femalePrimary?.dispose();
    pooledThumbCtx.rigs.malePrimary?.dispose();
    pooledThumbCtx.rigs.femalePartner?.dispose();
    pooledThumbCtx.rigs.malePartner?.dispose();
    pooledThumbCtx.renderer.dispose();
    pooledThumbCtx = null;
  }, 20000);
}

function getOrCreatePooledThumbContext(): PooledThumbContext | null {
  if (typeof document === 'undefined') return null;
  if (pooledThumbCtx) {
    scheduleThumbPoolDispose();
    return pooledThumbCtx;
  }
  try {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(1);
    renderer.setSize(160, 160, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;

    const scene = new THREE.Scene();
    const hemi = new THREE.HemisphereLight('#ffffff', '#d4cfc7', 1.2);
    scene.add(hemi);
    const key = new THREE.DirectionalLight('#ffffff', 1.4);
    key.position.set(1.5, 2.4, 2.8);
    scene.add(key);

    const stageHolder = new THREE.Group();
    scene.add(stageHolder);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 25);
    camera.position.set(0, 0.04, 2.55);
    camera.lookAt(0, 0, 0);

    pooledThumbCtx = {
      renderer,
      scene,
      camera,
      stageHolder,
      rigs: {
        femalePrimary: null,
        malePrimary: null,
        femalePartner: null,
        malePartner: null,
      },
    };
    scheduleThumbPoolDispose();
    return pooledThumbCtx;
  } catch {
    return null;
  }
}

async function getPooledRig(
  ctx: PooledThumbContext,
  gender: 'female' | 'male',
  isPartner: boolean,
): Promise<SilhouetteRigInstance | null> {
  const key =
    gender === 'male'
      ? isPartner
        ? 'malePartner'
        : 'malePrimary'
      : isPartner
        ? 'femalePartner'
        : 'femalePrimary';
  const existing = ctx.rigs[key];
  if (existing) return existing;
  const created = await createSilhouetteRigInstance(gender, isPartner, true);
  if (created) {
    ctx.rigs[key] = created;
  }
  return created;
}

export function getCachedMotionSilhouetteThumbnail(wardrobeItemId: string | null): string | null {
  if (!wardrobeItemId) return null;
  return motionThumbCache.get(wardrobeItemId) ?? null;
}

/**
 * Lazily renders a crisp 160×160 posed black human silhouette PNG matching the exact animation
 * or pose of a Red Studio item (`style_anim`, `style_dance`, `style_pose`, `style_action`, `style_paired`).
 * Uses a single pooled offscreen WebGLRenderer & serialized queue to keep GPU memory flat.
 */
export function renderMotionSilhouetteThumbnail(
  wardrobeItemId: string | null,
): Promise<string | null> {
  if (!wardrobeItemId) return Promise.resolve(null);
  const cached = motionThumbCache.get(wardrobeItemId);
  if (cached) return Promise.resolve(cached);

  const existing = motionThumbInFlight.get(wardrobeItemId);
  if (existing) return existing;

  const task = new Promise<string | null>((resolve) => {
    const run = async () => {
      try {
        const ctx = getOrCreatePooledThumbContext();
        if (!ctx) {
          resolve(null);
          return;
        }
        const spec = resolveMotionItemPlayback(wardrobeItemId);
        const primary = await getPooledRig(ctx, spec.gender, false);
        if (!primary) {
          resolve(null);
          return;
        }

        let partner: SilhouetteRigInstance | null = null;
        if (spec.partnerGlbUrl && spec.partnerClipKey) {
          const partnerGender: 'female' | 'male' = spec.gender === 'male' ? 'female' : 'male';
          partner = await getPooledRig(ctx, partnerGender, true);
        }

        primary.root.position.set(0, 0, 0);
        if (partner) {
          partner.root.position.set(0, 0, 0);
        }

        const primaryClip = await resolveAndPlayClipOnRig(
          primary,
          spec.primaryGlbUrl,
          spec.primaryClipKey,
          spec.primaryCandidates,
        );
        const sampleTime = chooseRepresentativeSampleTime(primaryClip, spec.slot);
        primary.rig.customGlbController?.mixer.setTime(sampleTime);

        if (partner && spec.partnerGlbUrl && spec.partnerClipKey) {
          await resolveAndPlayClipOnRig(
            partner,
            spec.partnerGlbUrl,
            spec.partnerClipKey,
            ['idle.001'],
            sampleTime,
          );
        }

        if (spec.danceKind !== 'none' && primary.rig.customGlbController) {
          applyProceduralDancePose(
            primary.rig.customGlbController.bones,
            spec.danceKind,
            chooseRepresentativeDancePhase(spec.danceKind),
          );
        }

        const activeInstances: SilhouetteRigInstance[] = partner ? [primary, partner] : [primary];
        ctx.stageHolder.clear();
        ctx.stageHolder.rotation.set(0, 0, 0);
        const rigContainer = new THREE.Group();
        for (const inst of activeInstances) {
          rigContainer.add(inst.root);
        }
        ctx.stageHolder.add(rigContainer);

        const viewYaw = partner
          ? alignPairedSilhouettesAndComputeYaw(rigContainer, primary, partner)
          : -0.18;
        ctx.stageHolder.rotation.set(0, viewYaw, 0);
        framePosedSilhouetteGroup(
          rigContainer,
          activeInstances,
          partner ? 1.2 : 1.14,
          0,
          true,
        );

        ctx.renderer.setClearColor(0x000000, 0);
        ctx.renderer.clear();
        ctx.renderer.render(ctx.scene, ctx.camera);

        const dataUrl = ctx.renderer.domElement.toDataURL('image/png');
        ctx.stageHolder.clear();
        scheduleThumbPoolDispose();

        if (dataUrl && dataUrl.startsWith('data:image/png')) {
          motionThumbCache.set(wardrobeItemId, dataUrl);
          resolve(dataUrl);
          return;
        }
        resolve(null);
      } catch {
        resolve(null);
      } finally {
        motionThumbInFlight.delete(wardrobeItemId);
      }
    };

    thumbQueueTail = thumbQueueTail.then(run, run);
  });

  motionThumbInFlight.set(wardrobeItemId, task);
  return task;
}
