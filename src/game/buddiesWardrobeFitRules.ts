import * as THREE from 'three';

/**
 * Pure wardrobe layering, skeleton synchronization, skin-weight normalization,
 * boundary seam smoothing, and material classification rules for modular outfits
 * and NPC costumes across PelvisRoot, Mixamo, and custom character skeletons.
 */

export type WardrobeLayerId =
  | 'skin'
  | 'inner_top'
  | 'pants'
  | 'footwear'
  | 'skirt'
  | 'dress'
  | 'jacket'
  | 'straps'
  | 'accessories'
  | 'hair';

export const WARDROBE_LAYER_ORDER: Readonly<Record<WardrobeLayerId, number>> = {
  skin: 0,
  hair: 0,
  inner_top: 1,
  pants: 2,
  footwear: 3,
  skirt: 4,
  dress: 5,
  jacket: 6,
  straps: 7,
  accessories: 8,
};

/**
 * Subtle outward vertex-normal clearance offsets (meters) strictly ordered by layer:
 * `skin < inner_top < pants < footwear < skirt < dress < jacket < straps < accessories`.
 */
export const WARDROBE_LAYER_CLEARANCE_M: Readonly<Record<WardrobeLayerId, number>> = {
  skin: 0.0,
  hair: 0.0,
  inner_top: 0.0022,
  pants: 0.0026,
  footwear: 0.0030,
  skirt: 0.0046,
  dress: 0.0050,
  jacket: 0.0056,
  straps: 0.0070,
  accessories: 0.0078,
};

export interface GarmentLayerHintBounds {
  minY?: number;
  maxY?: number;
  waistRadius?: number;
  hasFullBilateralHands?: boolean;
}

/**
 * Canonical mapping between PelvisRoot custom skeleton bones and Mixamo bone short names.
 */
export const WARDROBE_PELVIS_TO_MIXAMO_MAP: ReadonlyArray<readonly [string, string]> = [
  ['Hip', 'Hips'],
  ['Spine', 'Spine'],
  ['Spine01', 'Spine1'],
  ['Spine02', 'Spine2'],
  ['Neck', 'Neck'],
  ['Head', 'Head'],
  ['LeftShoulder', 'LeftShoulder'],
  ['LeftArm', 'LeftArm'],
  ['LeftForeArm', 'LeftForeArm'],
  ['LeftHand', 'LeftHand'],
  ['LeftThumb1', 'LeftHandThumb1'],
  ['LeftThumb2', 'LeftHandThumb2'],
  ['LeftThumb3', 'LeftHandThumb3'],
  ['LeftIndex1', 'LeftHandIndex1'],
  ['LeftIndex2', 'LeftHandIndex2'],
  ['LeftIndex3', 'LeftHandIndex3'],
  ['LeftOthers1', 'LeftHandMiddle1'],
  ['LeftOthers2', 'LeftHandMiddle2'],
  ['LeftOthers3', 'LeftHandMiddle3'],
  ['RightShoulder', 'RightShoulder'],
  ['RightArm', 'RightArm'],
  ['RightForeArm', 'RightForeArm'],
  ['RightHand', 'RightHand'],
  ['RightThumb1', 'RightHandThumb1'],
  ['RightThumb2', 'RightHandThumb2'],
  ['RightThumb3', 'RightHandThumb3'],
  ['RightIndex1', 'RightHandIndex1'],
  ['RightIndex2', 'RightHandIndex2'],
  ['RightIndex3', 'RightHandIndex3'],
  ['RightOthers1', 'RightHandMiddle1'],
  ['RightOthers2', 'RightHandMiddle2'],
  ['RightOthers3', 'RightHandMiddle3'],
  ['LeftUpLeg', 'LeftUpLeg'],
  ['LeftLeg', 'LeftLeg'],
  ['LeftFoot', 'LeftFoot'],
  ['LeftToes', 'LeftToeBase'],
  ['RightUpLeg', 'RightUpLeg'],
  ['RightLeg', 'RightLeg'],
  ['RightFoot', 'RightFoot'],
  ['RightToes', 'RightToeBase'],
];

const PELVIS_TO_MIXAMO_LOOKUP = new Map<string, string>(WARDROBE_PELVIS_TO_MIXAMO_MAP);
const MIXAMO_TO_PELVIS_LOOKUP = new Map<string, string>(
  WARDROBE_PELVIS_TO_MIXAMO_MAP.map(([pelvis, mixamo]) => [mixamo, pelvis]),
);

const EXTRA_CANONICAL_BONE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  hip: ['Hips', 'Hip', 'Pelvis', 'PelvisRoot', 'Root'],
  hips: ['Hip', 'Hips', 'Pelvis', 'PelvisRoot', 'Root'],
  pelvis: ['Hip', 'Hips', 'PelvisRoot'],
  pelvisroot: ['Hip', 'Hips', 'Spine'],
  hip_translation: ['Hip', 'Hips'],
  spine_translation: ['Spine', 'Spine01', 'Spine1'],
  spine: ['Spine', 'Spine01', 'Spine1'],
  spine01: ['Spine1', 'Spine01', 'Spine', 'Chest'],
  spine1: ['Spine01', 'Spine1', 'Spine', 'Chest'],
  spine02: ['Spine2', 'Spine02', 'UpperChest', 'Chest', 'Spine01', 'Spine1'],
  spine2: ['Spine02', 'Spine2', 'UpperChest', 'Chest', 'Spine01', 'Spine1'],
  chest: ['Spine01', 'Spine1', 'Spine02', 'Spine2', 'Spine'],
  upperchest: ['Spine02', 'Spine2', 'Spine01', 'Spine1'],
  neck: ['Neck', 'Spine02', 'Spine2', 'Head'],
  head: ['Head', 'Neck'],
  texturechange: ['Head', 'Neck', 'Spine02', 'Spine2'],
  leftshoulder: ['LeftShoulder', 'LeftClavicle', 'Spine02', 'Spine2'],
  leftclavicle: ['LeftShoulder', 'Spine02', 'Spine2'],
  rightshoulder: ['RightShoulder', 'RightClavicle', 'Spine02', 'Spine2'],
  rightclavicle: ['RightShoulder', 'Spine02', 'Spine2'],
  leftarm: ['LeftArm', 'LeftUpperArm', 'LeftShoulder'],
  leftupperarm: ['LeftArm', 'LeftShoulder'],
  rightarm: ['RightArm', 'RightUpperArm', 'RightShoulder'],
  rightupperarm: ['RightArm', 'RightShoulder'],
  leftforearm: ['LeftForeArm', 'LeftLowerArm', 'LeftArm'],
  leftlowerarm: ['LeftForeArm', 'LeftArm'],
  rightforearm: ['RightForeArm', 'RightLowerArm', 'RightArm'],
  rightlowerarm: ['RightForeArm', 'RightArm'],
  lefthand: ['LeftHand', 'LeftWrist', 'LeftForeArm'],
  righthand: ['RightHand', 'RightWrist', 'RightForeArm'],
  leftupleg: ['LeftUpLeg', 'LeftThigh', 'Hip', 'Hips'],
  leftthigh: ['LeftUpLeg', 'Hip', 'Hips'],
  rightupleg: ['RightUpLeg', 'RightThigh', 'Hip', 'Hips'],
  rightthigh: ['RightUpLeg', 'Hip', 'Hips'],
  leftleg: ['LeftLeg', 'LeftShin', 'LeftCalf', 'LeftLowerLeg', 'LeftUpLeg'],
  leftlowerleg: ['LeftLeg', 'LeftUpLeg'],
  rightleg: ['RightLeg', 'RightShin', 'RightCalf', 'RightLowerLeg', 'RightUpLeg'],
  rightlowerleg: ['RightLeg', 'RightUpLeg'],
  leftfoot: ['LeftFoot', 'LeftAnkle', 'LeftLeg'],
  rightfoot: ['RightFoot', 'RightAnkle', 'RightLeg'],
  lefttoes: ['LeftToeBase', 'LeftToes', 'LeftFoot'],
  lefttoebase: ['LeftToes', 'LeftToeBase', 'LeftFoot'],
  lefttoesnull: ['LeftToes', 'LeftToeBase', 'LeftFoot'],
  righttoes: ['RightToeBase', 'RightToes', 'RightFoot'],
  righttoebase: ['RightToes', 'RightToeBase', 'RightFoot'],
  righttoesnull: ['RightToes', 'RightToeBase', 'RightFoot'],
};

const ANATOMICAL_FALLBACK_CHAINS: Readonly<Record<string, readonly string[]>> = {
  PelvisRoot: ['Hip', 'Hips', 'Spine'],
  Hip: ['Hips', 'PelvisRoot', 'Spine'],
  Hips: ['Hip', 'PelvisRoot', 'Spine'],
  Spine: ['Hip', 'Hips', 'Spine01', 'Spine1'],
  Spine01: ['Spine1', 'Spine', 'Spine02', 'Spine2', 'Hip', 'Hips'],
  Spine1: ['Spine01', 'Spine', 'Spine2', 'Spine02', 'Hips', 'Hip'],
  Spine02: ['Spine2', 'Spine01', 'Spine1', 'Spine', 'Hip', 'Hips'],
  Spine2: ['Spine02', 'Spine1', 'Spine01', 'Spine', 'Hips', 'Hip'],
  Neck: ['Spine02', 'Spine2', 'Spine01', 'Spine1', 'Spine', 'Head'],
  Head: ['Neck', 'Spine02', 'Spine2'],
  TextureChange: ['Head', 'Neck', 'Spine02', 'Spine2'],
  LeftShoulder: ['Spine02', 'Spine2', 'Spine01', 'Spine1', 'Spine'],
  RightShoulder: ['Spine02', 'Spine2', 'Spine01', 'Spine1', 'Spine'],
  LeftArm: ['LeftShoulder', 'Spine02', 'Spine2'],
  RightArm: ['RightShoulder', 'Spine02', 'Spine2'],
  LeftForeArm: ['LeftArm', 'LeftShoulder', 'Spine02'],
  RightForeArm: ['RightArm', 'RightShoulder', 'Spine02'],
  LeftHand: ['LeftForeArm', 'LeftArm'],
  RightHand: ['RightForeArm', 'RightArm'],
  LeftUpLeg: ['Hip', 'Hips', 'Spine'],
  RightUpLeg: ['Hip', 'Hips', 'Spine'],
  LeftLeg: ['LeftUpLeg', 'Hip', 'Hips'],
  RightLeg: ['RightUpLeg', 'Hip', 'Hips'],
  LeftFoot: ['LeftLeg', 'LeftUpLeg', 'Hip', 'Hips'],
  RightFoot: ['RightLeg', 'RightUpLeg', 'Hip', 'Hips'],
  LeftToes: ['LeftToeBase', 'LeftFoot', 'LeftLeg'],
  RightToes: ['RightToeBase', 'RightFoot', 'RightLeg'],
  LeftToeBase: ['LeftToes', 'LeftFoot', 'LeftLeg'],
  RightToeBase: ['RightToes', 'RightFoot', 'RightLeg'],
  LeftToesNull: ['LeftToes', 'LeftToeBase', 'LeftFoot', 'LeftLeg'],
  RightToesNull: ['RightToes', 'RightToeBase', 'RightFoot', 'RightLeg'],
};

const FINGER_GROUPS = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky', 'Others'] as const;

/**
 * Strips Mixamo/Biped/VRM prefixes and normalizes `.L`/`.R`/`_L`/`_R` suffixes
 * into canonical `Left*`/`Right*` names so bones from diverse rigs match reliably.
 */
export function normalizeWardrobeBoneName(rawName: string): string {
  let s = (rawName || '').trim();
  if (!s) return '';
  s = s.replace(/^(?:mixamorig\d*[:._]?|bip01_?|valvebiped_?|def[-_.]|armature\|)/i, '');
  s = s.replace(/^J_Bip_([CLR])_/i, (_m, side: string) => {
    const up = side.toUpperCase();
    return up === 'L' ? 'Left' : up === 'R' ? 'Right' : '';
  });
  s = s.replace(/^J_Sec_([LR])_/i, (_m, side: string) =>
    side.toUpperCase() === 'L' ? 'Left' : 'Right',
  );
  if (/(?:[._\-\s])L$/i.test(s) && !/^Left/i.test(s)) {
    s = `Left${s.replace(/(?:[._\-\s])L$/i, '')}`;
  } else if (/(?:[._\-\s])R$/i.test(s) && !/^Right/i.test(s)) {
    s = `Right${s.replace(/(?:[._\-\s])R$/i, '')}`;
  }
  s = s.replace(/[\s:._-]+/g, '');
  return s;
}

/**
 * Strips twist/roll/null/end decorators from a canonical bone name so twist bones
 * fall back cleanly onto their parent anatomical limb segment.
 */
function buildTwistAndFingerCandidates(cleanName: string): string[] {
  const candidates: string[] = [];
  if (!cleanName) return candidates;

  // Strip Twist / Roll / Helper / Null / End suffixes
  const withoutTwist = cleanName.replace(/(?:Twist|Roll|Helper|Null|End)\d*$/i, '');
  if (withoutTwist && withoutTwist !== cleanName) {
    candidates.push(withoutTwist);
  }

  // Handle finger phalanges: LeftHandRing2 -> LeftOthers2 -> LeftHandMiddle2 -> LeftHand
  for (const side of ['Left', 'Right'] as const) {
    if (!cleanName.startsWith(side)) continue;
    const rest = cleanName.slice(side.length);
    for (const fg of FINGER_GROUPS) {
      const m = new RegExp(`^(?:Hand)?${fg}(\\d+)?$`, 'i').exec(rest);
      if (m) {
        const digit = m[1] ? Number(m[1]) : 1;
        if (fg === 'Ring' || fg === 'Pinky' || fg === 'Middle') {
          candidates.push(`${side}Others${digit}`, `${side}HandMiddle${digit}`);
        } else if (fg === 'Others') {
          candidates.push(`${side}HandMiddle${digit}`, `${side}Middle${digit}`);
        } else {
          candidates.push(`${side}Hand${fg}${digit}`, `${side}${fg}${digit}`);
        }
        for (let d = digit - 1; d >= 1; d--) {
          candidates.push(
            `${side}Hand${fg}${d}`,
            `${side}${fg}${d}`,
            `${side}Others${d}`,
            `${side}HandMiddle${d}`,
          );
        }
        candidates.push(`${side}Hand`, `${side}ForeArm`, `${side}Arm`);
        break;
      }
    }
  }

  return candidates;
}

export interface ModularBoneResolutionResult {
  mappedBones: THREE.Bone[];
  /** For each source bone index `i`, points to `mappedBones` index (`i` when 1:1, or merged target). */
  sourceToTargetSlot: number[];
  exactMatchCount: number;
  aliasMatchCount: number;
  fallbackMatchCount: number;
  unmappedCount: number;
}

/**
 * Indexes all target bones by exact name, stripped Mixamo name, normalized canonical key,
 * and bidirectional PelvisRoot <-> Mixamo aliases.
 */
export function buildTargetBoneLookup(
  bones: ReadonlyMap<string, THREE.Bone> | readonly THREE.Bone[],
  rootObject?: THREE.Object3D | null,
): Map<string, THREE.Bone> {
  const lookup = new Map<string, THREE.Bone>();
  const addEntry = (key: string, bone: THREE.Bone) => {
    if (!key) return;
    if (!lookup.has(key)) lookup.set(key, bone);
    const lower = key.toLowerCase();
    if (!lookup.has(lower)) lookup.set(lower, bone);
  };

  const registerBone = (bone: THREE.Bone, explicitKey?: string) => {
    const baseName = explicitKey || bone.name;
    addEntry(baseName, bone);
    const norm = normalizeWardrobeBoneName(baseName);
    addEntry(norm, bone);
    const mixamoAlias = PELVIS_TO_MIXAMO_LOOKUP.get(baseName) ?? PELVIS_TO_MIXAMO_LOOKUP.get(norm);
    if (mixamoAlias) addEntry(mixamoAlias, bone);
    const pelvisAlias = MIXAMO_TO_PELVIS_LOOKUP.get(baseName) ?? MIXAMO_TO_PELVIS_LOOKUP.get(norm);
    if (pelvisAlias) addEntry(pelvisAlias, bone);
  };

  if (bones instanceof Map) {
    for (const [key, bone] of bones.entries()) {
      registerBone(bone, key);
    }
  } else {
    for (const bone of bones as readonly THREE.Bone[]) {
      registerBone(bone);
    }
  }

  if (rootObject) {
    rootObject.traverse((node) => {
      if ((node as THREE.Bone).isBone && node.name) {
        registerBone(node as THREE.Bone);
      }
    });
  }

  return lookup;
}

function findBoneInLookup(
  lookup: ReadonlyMap<string, THREE.Bone>,
  candidate: string,
): THREE.Bone | undefined {
  if (!candidate) return undefined;
  return (
    lookup.get(candidate) ??
    lookup.get(candidate.toLowerCase()) ??
    lookup.get(normalizeWardrobeBoneName(candidate)) ??
    lookup.get(normalizeWardrobeBoneName(candidate).toLowerCase())
  );
}

/**
 * Resolves every bone in a modular garment's skeleton onto the target rig's bones
 * with full bidirectional PelvisRoot/Mixamo aliases, twist/clavicle/spine fallbacks,
 * and source-parent walking so missing helper or twist bones never drop an entire outfit mesh.
 */
export function resolveModularBoneMapping(
  srcBones: readonly THREE.Bone[],
  targetLookup: ReadonlyMap<string, THREE.Bone>,
  fallbackRootBone?: THREE.Bone | null,
): ModularBoneResolutionResult {
  const mappedBones: THREE.Bone[] = [];
  const sourceToTargetSlot: number[] = new Array(srcBones.length).fill(0);
  let exactMatchCount = 0;
  let aliasMatchCount = 0;
  let fallbackMatchCount = 0;
  let unmappedCount = 0;

  const rootBoneFallback =
    fallbackRootBone ??
    findBoneInLookup(targetLookup, 'Hip') ??
    findBoneInLookup(targetLookup, 'Hips') ??
    findBoneInLookup(targetLookup, 'Spine') ??
    targetLookup.values().next().value;

  for (let i = 0; i < srcBones.length; i++) {
    const srcBone = srcBones[i];
    const rawName = srcBone?.name ?? '';
    const normName = normalizeWardrobeBoneName(rawName);

    let resolved: THREE.Bone | undefined =
      targetLookup.get(rawName) ?? targetLookup.get(rawName.toLowerCase());
    if (resolved) {
      exactMatchCount++;
    } else {
      // 1. Try canonical normalized name + Pelvis<->Mixamo + extra aliases
      const aliasCandidates: string[] = [];
      if (normName) aliasCandidates.push(normName);
      const p2m = PELVIS_TO_MIXAMO_LOOKUP.get(normName) ?? PELVIS_TO_MIXAMO_LOOKUP.get(rawName);
      if (p2m) aliasCandidates.push(p2m);
      const m2p = MIXAMO_TO_PELVIS_LOOKUP.get(normName) ?? MIXAMO_TO_PELVIS_LOOKUP.get(rawName);
      if (m2p) aliasCandidates.push(m2p);
      const extras = EXTRA_CANONICAL_BONE_ALIASES[normName.toLowerCase()];
      if (extras) aliasCandidates.push(...extras);

      for (const cand of aliasCandidates) {
        const hit = findBoneInLookup(targetLookup, cand);
        if (hit) {
          resolved = hit;
          aliasMatchCount++;
          break;
        }
      }
    }

    if (!resolved) {
      // 2. Try twist/finger/anatomical fallback chains
      const fallbackCandidates: string[] = [
        ...buildTwistAndFingerCandidates(normName),
        ...(ANATOMICAL_FALLBACK_CHAINS[normName] ?? []),
      ];
      for (const cand of fallbackCandidates) {
        const hit = findBoneInLookup(targetLookup, cand);
        if (hit) {
          resolved = hit;
          fallbackMatchCount++;
          break;
        }
      }
    }

    if (!resolved && srcBone?.parent) {
      // 3. Walk source hierarchy parent chain to first bone present on target rig
      let curParent: THREE.Object3D | null = srcBone.parent;
      while (curParent) {
        if (curParent.name) {
          const hit = findBoneInLookup(targetLookup, curParent.name);
          if (hit) {
            resolved = hit;
            fallbackMatchCount++;
            break;
          }
        }
        curParent = curParent.parent;
      }
    }

    if (!resolved) {
      unmappedCount++;
      resolved = rootBoneFallback;
    }

    if (resolved) {
      mappedBones.push(resolved);
      sourceToTargetSlot[i] = mappedBones.length - 1;
    } else {
      sourceToTargetSlot[i] = -1;
    }
  }

  return {
    mappedBones,
    sourceToTargetSlot,
    exactMatchCount,
    aliasMatchCount,
    fallbackMatchCount,
    unmappedCount,
  };
}

export interface SkinWeightSanitizeReport {
  vertexCount: number;
  normalizedCount: number;
  prunedInfluenceCount: number;
  recoveredZeroWeightVertices: number;
}

/**
 * Normalizes every vertex's 4 skin weights to sum `1.0`, prunes out-of-range/invalid
 * bone indices, merges duplicate bone slots produced by fallback mapping, and recovers
 * any zero-weight orphan vertices using the nearest valid skeleton bone or fallback index.
 */
export function sanitizeAndNormalizeSkinAttributes(
  geometry: THREE.BufferGeometry,
  boneCount: number,
  sourceToTargetSlot?: readonly number[],
  fallbackBoneIndex = 0,
  boneBindPositions?: readonly (THREE.Vector3 | null)[],
): SkinWeightSanitizeReport {
  const skinIdxAttr = geometry.getAttribute('skinIndex') as THREE.BufferAttribute | undefined;
  const skinWgtAttr = geometry.getAttribute('skinWeight') as THREE.BufferAttribute | undefined;
  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!skinIdxAttr || !skinWgtAttr || boneCount <= 0) {
    return {
      vertexCount: posAttr?.count ?? 0,
      normalizedCount: 0,
      prunedInfluenceCount: 0,
      recoveredZeroWeightVertices: 0,
    };
  }

  const count = Math.min(skinIdxAttr.count, skinWgtAttr.count);
  const safeFallback = Math.max(0, Math.min(boneCount - 1, Math.floor(fallbackBoneIndex)));
  const outIdx = new Uint16Array(count * 4);
  const outWgt = new Float32Array(count * 4);

  let normalizedCount = 0;
  let prunedInfluenceCount = 0;
  let recoveredZeroWeightVertices = 0;

  const slotIdx = [0, 0, 0, 0];
  const slotWgt = [0, 0, 0, 0];

  for (let vi = 0; vi < count; vi++) {
    const rawIdx = [
      skinIdxAttr.getX(vi),
      skinIdxAttr.getY(vi),
      skinIdxAttr.getZ(vi),
      skinIdxAttr.getW(vi),
    ];
    const rawWgt = [
      skinWgtAttr.getX(vi),
      skinWgtAttr.getY(vi),
      skinWgtAttr.getZ(vi),
      skinWgtAttr.getW(vi),
    ];

    let uniqueCount = 0;
    let rawSum = 0;
    for (let k = 0; k < 4; k++) {
      let w = rawWgt[k];
      let j = Math.round(rawIdx[k]);
      if (!Number.isFinite(w) || w <= 1e-7) {
        continue;
      }
      rawSum += w;
      if (!Number.isFinite(j) || j < 0) {
        prunedInfluenceCount++;
        continue;
      }
      if (sourceToTargetSlot) {
        if (j >= sourceToTargetSlot.length) {
          prunedInfluenceCount++;
          continue;
        }
        j = sourceToTargetSlot[j];
      }
      if (j < 0 || j >= boneCount) {
        prunedInfluenceCount++;
        continue;
      }

      // Merge weights that mapped onto the same target bone index
      let merged = false;
      for (let u = 0; u < uniqueCount; u++) {
        if (slotIdx[u] === j) {
          slotWgt[u] += w;
          merged = true;
          break;
        }
      }
      if (!merged) {
        slotIdx[uniqueCount] = j;
        slotWgt[uniqueCount] = w;
        uniqueCount++;
      }
    }

    let validSum = 0;
    for (let u = 0; u < uniqueCount; u++) {
      validSum += slotWgt[u];
    }

    if (validSum <= 1e-6) {
      // Recover zero-weight vertex cleanly to nearest valid bone or safeFallback
      recoveredZeroWeightVertices++;
      let chosenBone = safeFallback;
      if (posAttr && boneBindPositions && boneBindPositions.length === boneCount) {
        const vx = posAttr.getX(vi);
        const vy = posAttr.getY(vi);
        const vz = posAttr.getZ(vi);
        let bestD2 = Infinity;
        for (let bi = 0; bi < boneCount; bi++) {
          const bp = boneBindPositions[bi];
          if (!bp) continue;
          const dx = vx - bp.x;
          const dy = vy - bp.y;
          const dz = vz - bp.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < bestD2) {
            bestD2 = d2;
            chosenBone = bi;
          }
        }
      }
      outIdx[vi * 4] = chosenBone;
      outWgt[vi * 4] = 1.0;
      normalizedCount++;
      continue;
    }

    // Sort descending by weight so primary influences always stay first
    for (let a = 0; a < uniqueCount - 1; a++) {
      for (let b = a + 1; b < uniqueCount; b++) {
        if (slotWgt[b] > slotWgt[a]) {
          const tmpW = slotWgt[a];
          slotWgt[a] = slotWgt[b];
          slotWgt[b] = tmpW;
          const tmpI = slotIdx[a];
          slotIdx[a] = slotIdx[b];
          slotIdx[b] = tmpI;
        }
      }
    }

    if (Math.abs(rawSum - 1.0) > 1e-4 || Math.abs(validSum - 1.0) > 1e-4) {
      normalizedCount++;
    }
    const invSum = 1.0 / validSum;
    for (let u = 0; u < uniqueCount; u++) {
      outIdx[vi * 4 + u] = slotIdx[u];
      outWgt[vi * 4 + u] = slotWgt[u] * invSum;
    }
  }

  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(outIdx, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(outWgt, 4));

  return {
    vertexCount: count,
    normalizedCount,
    prunedInfluenceCount,
    recoveredZeroWeightVertices,
  };
}

export interface TargetRigBindProfile {
  bindMatrix: THREE.Matrix4;
  bindMode: THREE.BindMode;
  boneInversesByName: Map<string, THREE.Matrix4>;
  boneBindPosByName: Map<string, THREE.Vector3>;
  morphInfluencesByName: Map<string, number>;
  skeletonHeightM: number;
  shoulderWidthM: number;
}

const _tmpMatA = new THREE.Matrix4();
const _tmpMatB = new THREE.Matrix4();
const _tmpMatC = new THREE.Matrix4();
const _tmpNormMat = new THREE.Matrix3();
const _tmpVecA = new THREE.Vector3();

/**
 * Extracts canonical bindMatrix, per-bone T-pose inverses, skeleton dimensions, and
 * active morph target weights from the target character rig's base SkinnedMeshes.
 */
export function extractTargetRigBindProfile(
  baseMeshes: ReadonlyArray<{ mesh: THREE.Mesh }>,
  bones: ReadonlyMap<string, THREE.Bone>,
  glbRoot?: THREE.Group | null,
): TargetRigBindProfile {
  const boneInversesByName = new Map<string, THREE.Matrix4>();
  const boneBindPosByName = new Map<string, THREE.Vector3>();
  const morphInfluencesByName = new Map<string, number>();

  let bindMatrix = new THREE.Matrix4();
  let bindMode: THREE.BindMode = THREE.AttachedBindMode;
  let capturedBindMatrix = false;

  const registerInverse = (boneName: string, inv: THREE.Matrix4) => {
    const keys = [
      boneName,
      normalizeWardrobeBoneName(boneName),
      PELVIS_TO_MIXAMO_LOOKUP.get(boneName) ?? '',
      MIXAMO_TO_PELVIS_LOOKUP.get(boneName) ?? '',
    ];
    _tmpMatA.copy(inv).invert();
    const bindPos = new THREE.Vector3().setFromMatrixPosition(_tmpMatA);
    for (const k of keys) {
      if (!k) continue;
      if (!boneInversesByName.has(k)) {
        boneInversesByName.set(k, inv.clone());
      }
      if (!boneBindPosByName.has(k)) {
        boneBindPosByName.set(k, bindPos.clone());
      }
    }
  };

  // Prefer head / hands / feet / torso meshes first so canonical T-pose inverses take priority
  // over any legacy mesh whose boneInverses carry a small export offset.
  const orderedEntries = [...baseMeshes].sort((a, b) => {
    const score = (name: string) => {
      const l = name.toLowerCase();
      if (l.startsWith('head') || l.startsWith('hands_')) return 0;
      if (l.startsWith('feet_') || l.startsWith('torso_')) return 1;
      return 2;
    };
    return score(a.mesh.name || '') - score(b.mesh.name || '');
  });

  for (const entry of orderedEntries) {
    const mesh = entry.mesh;
    if (mesh.userData?.isCustomEquippedTorso || mesh.userData?.customEquippedSlot) continue;

    if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
      for (const [mName, mIdx] of Object.entries(mesh.morphTargetDictionary)) {
        if (!morphInfluencesByName.has(mName)) {
          const val = mesh.morphTargetInfluences[mIdx] ?? 0;
          morphInfluencesByName.set(mName, val);
        }
      }
    }

    const sm = mesh as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh || !sm.skeleton) continue;
    if (!capturedBindMatrix) {
      bindMatrix = sm.bindMatrix.clone();
      bindMode = sm.bindMode;
      capturedBindMatrix = true;
    }
    const skelBones = sm.skeleton.bones;
    const skelInvs = sm.skeleton.boneInverses;
    for (let i = 0; i < skelBones.length; i++) {
      const b = skelBones[i];
      const inv = skelInvs[i];
      if (!b || !inv) continue;
      registerInverse(b.name, inv);
    }
  }

  // Fill any unreferenced skeleton bones by removing glbRoot world transform from bone.matrixWorld
  if (glbRoot) {
    glbRoot.updateWorldMatrix(true, true);
    _tmpMatB.copy(glbRoot.matrixWorld).invert();
    for (const [bName, b] of bones.entries()) {
      if (boneInversesByName.has(bName)) continue;
      _tmpMatA.multiplyMatrices(_tmpMatB, b.matrixWorld);
      _tmpMatC.copy(_tmpMatA).invert();
      registerInverse(bName, _tmpMatC);
    }
  }

  const headPos = boneBindPosByName.get('Head') ?? boneBindPosByName.get('Neck');
  const footPos = boneBindPosByName.get('LeftFoot') ?? boneBindPosByName.get('RightFoot');
  const lArmPos = boneBindPosByName.get('LeftArm');
  const rArmPos = boneBindPosByName.get('RightArm');

  const skeletonHeightM =
    headPos && footPos ? Math.max(0.4, headPos.y - footPos.y) : 1.38;
  const shoulderWidthM =
    lArmPos && rArmPos ? Math.max(0.15, Math.abs(lArmPos.x - rArmPos.x)) : 0.28;

  return {
    bindMatrix,
    bindMode,
    boneInversesByName,
    boneBindPosByName,
    morphInfluencesByName,
    skeletonHeightM,
    shoulderWidthM,
  };
}

function lookupTargetInverse(
  profile: TargetRigBindProfile,
  boneName: string,
): THREE.Matrix4 | undefined {
  return (
    profile.boneInversesByName.get(boneName) ??
    profile.boneInversesByName.get(normalizeWardrobeBoneName(boneName)) ??
    profile.boneInversesByName.get(PELVIS_TO_MIXAMO_LOOKUP.get(boneName) ?? '') ??
    profile.boneInversesByName.get(MIXAMO_TO_PELVIS_LOOKUP.get(boneName) ?? '')
  );
}

/**
 * Synchronizes geometry vertex space, skeleton `boneInverses`, `bindMatrix`, `bindMatrixInverse`,
 * proportion scale multipliers (e.g. cm-vs-m or Mixamo-vs-PelvisRoot stature differences),
 * and morph target influences between a source modular `SkinnedMesh` and the target rig.
 */
export function synchronizeModularBindAndGeometry(
  geometry: THREE.BufferGeometry,
  srcSm: THREE.SkinnedMesh,
  mappedBones: readonly THREE.Bone[],
  targetProfile: TargetRigBindProfile,
  targetMeshForMorphs?: THREE.Mesh,
): {
  syncedBindMatrix: THREE.Matrix4;
  syncedInverses: THREE.Matrix4[];
  appliedScaleMultiplier: number;
  transformedBindSpace: boolean;
} {
  const srcInverses = srcSm.skeleton?.boneInverses ?? [];

  // Compare shared bone positions in source bind space vs target bind space to detect
  // unit-scale differences (e.g., cm vs m) or stature differences even on partial-slot GLBs.
  const sharedPairs: Array<{ srcPos: THREE.Vector3; tgtPos: THREE.Vector3; priority: number }> = [];
  for (let i = 0; i < mappedBones.length && i < srcInverses.length; i++) {
    const tgtBone = mappedBones[i];
    const tgtPos = targetProfile.boneBindPosByName.get(tgtBone.name);
    if (!tgtPos) continue;
    _tmpMatA.copy(srcInverses[i]).invert();
    const srcPos = new THREE.Vector3().setFromMatrixPosition(_tmpMatA);
    const norm = normalizeWardrobeBoneName(tgtBone.name);
    const priority =
      norm === 'Hip' || norm === 'Hips'
        ? 3
        : norm === 'Spine02' || norm === 'Spine2' || norm === 'Neck'
          ? 2
          : 1;
    sharedPairs.push({ srcPos, tgtPos, priority });
  }

  let proportionScale = 1.0;
  let hipOffsetY = 0.0;
  if (sharedPairs.length >= 2) {
    let bestTgtDist = 0;
    let bestSrcDist = 0;
    for (let a = 0; a < sharedPairs.length; a++) {
      for (let b = a + 1; b < sharedPairs.length; b++) {
        const dt = sharedPairs[a].tgtPos.distanceTo(sharedPairs[b].tgtPos);
        if (dt > bestTgtDist) {
          bestTgtDist = dt;
          bestSrcDist = sharedPairs[a].srcPos.distanceTo(sharedPairs[b].srcPos);
        }
      }
    }
    if (bestTgtDist > 0.08 && bestSrcDist > 0.01) {
      const ratio = bestTgtDist / bestSrcDist;
      if (Math.abs(ratio - 1.0) > 0.018 && ratio > 0.005 && ratio < 200) {
        proportionScale = ratio;
      }
    }
  }
  if (proportionScale !== 1.0 && sharedPairs.length > 0) {
    sharedPairs.sort((a, b) => b.priority - a.priority);
    const anchor = sharedPairs[0];
    hipOffsetY = anchor.tgtPos.y - anchor.srcPos.y * proportionScale;
  }

  // Transform vertices from srcBindMatrix into targetBindMatrix space if they differ or if scaled
  let matricesDiffer = false;
  for (let e = 0; e < 16; e++) {
    if (Math.abs(srcSm.bindMatrix.elements[e] - targetProfile.bindMatrix.elements[e]) > 1e-4) {
      matricesDiffer = true;
      break;
    }
  }

  const transformedBindSpace = matricesDiffer || proportionScale !== 1.0 || Math.abs(hipOffsetY) > 1e-4;
  if (transformedBindSpace) {
    _tmpMatB.makeScale(proportionScale, proportionScale, proportionScale);
    _tmpMatB.setPosition(0, hipOffsetY, 0);
    _tmpMatC.copy(targetProfile.bindMatrix).invert();
    // vertexTransform = inv(targetBind) * proportionAlign * srcBind
    _tmpMatA.copy(_tmpMatC).multiply(_tmpMatB).multiply(srcSm.bindMatrix);
    geometry.applyMatrix4(_tmpMatA);
    const nrm = geometry.getAttribute('normal');
    if (nrm) {
      _tmpNormMat.getNormalMatrix(_tmpMatA);
      for (let i = 0; i < nrm.count; i++) {
        _tmpVecA.fromBufferAttribute(nrm, i).applyMatrix3(_tmpNormMat).normalize();
        nrm.setXYZ(i, _tmpVecA.x, _tmpVecA.y, _tmpVecA.z);
      }
      nrm.needsUpdate = true;
    }
  }

  // Synchronize per-bone inverses directly to the target skeleton's canonical T-pose inverses
  const syncedInverses: THREE.Matrix4[] = [];
  for (let i = 0; i < mappedBones.length; i++) {
    const targetBone = mappedBones[i];
    const tgtInv = lookupTargetInverse(targetProfile, targetBone.name);
    if (tgtInv) {
      syncedInverses.push(tgtInv.clone());
    } else if (srcInverses[i]) {
      if (proportionScale !== 1.0 || Math.abs(hipOffsetY) > 1e-4) {
        _tmpMatA.copy(srcInverses[i]).invert();
        _tmpMatB.makeScale(proportionScale, proportionScale, proportionScale);
        _tmpMatB.setPosition(0, hipOffsetY, 0);
        _tmpMatA.premultiply(_tmpMatB);
        syncedInverses.push(new THREE.Matrix4().copy(_tmpMatA).invert());
      } else {
        syncedInverses.push(srcInverses[i].clone());
      }
    } else {
      syncedInverses.push(new THREE.Matrix4());
    }
  }

  // Sync matching morph target influences between base rig and modular mesh
  if (
    targetMeshForMorphs &&
    srcSm.morphTargetDictionary &&
    srcSm.morphTargetInfluences &&
    targetProfile.morphInfluencesByName.size > 0
  ) {
    targetMeshForMorphs.morphTargetDictionary = { ...srcSm.morphTargetDictionary };
    targetMeshForMorphs.morphTargetInfluences = [...srcSm.morphTargetInfluences];
    for (const [mName, mIdx] of Object.entries(targetMeshForMorphs.morphTargetDictionary)) {
      const baseVal = targetProfile.morphInfluencesByName.get(mName);
      if (baseVal !== undefined) {
        targetMeshForMorphs.morphTargetInfluences[mIdx] = baseVal;
      }
    }
  }

  return {
    syncedBindMatrix: targetProfile.bindMatrix.clone(),
    syncedInverses,
    appliedScaleMultiplier: proportionScale,
    transformedBindSpace,
  };
}

/**
 * Classifies a mesh into a strict garment clearance layer:
 * `skin < inner_top < pants < footwear < skirt < dress < jacket < straps < accessories`.
 */
export function classifyGarmentLayer(
  meshName: string,
  bounds?: GarmentLayerHintBounds,
): WardrobeLayerId {
  const lower = (meshName || '')
    .toLowerCase()
    .replace(/_outline$/i, '')
    .replace(/(?:_\d+|\.\d+)$/, '');

  if (
    lower.includes('_skin') ||
    lower.startsWith('head') ||
    lower.startsWith('ears') ||
    lower === 'hands_skin'
  ) {
    return 'skin';
  }
  if (lower.startsWith('hair') || lower.includes('_hair')) {
    return 'hair';
  }
  if (/(?:strap|belt|harness|sling|holster|crossbody|backpack|suspender|bag)/.test(lower)) {
    return 'straps';
  }
  if (
    lower.startsWith('neck_') ||
    /(?:scarf|collar|choker|tie|ribbon|bracelet|corsage|teaandflowers|accessory|ring|watch|glasses|hat|nail)/.test(
      lower,
    )
  ) {
    return 'accessories';
  }
  if (lower.startsWith('hands_')) {
    return bounds?.hasFullBilateralHands ? 'jacket' : 'accessories';
  }
  if (
    /(?:jacket|hoodie|coat|parka|blazer|cardigan|overshirt|hiphop|unplugged|healthgoth|bomber|trench|sweater)/.test(
      lower,
    )
  ) {
    return 'jacket';
  }
  if (/(?:dress|gown|onepiece|jumpsuit|romper)/.test(lower)) {
    return 'dress';
  }
  if (
    /(?:skirt|kilt|tutu|delirioussquidalternative)/.test(lower) ||
    (lower.startsWith('legs_') && lower.includes('solstice'))
  ) {
    return 'skirt';
  }
  if (lower.startsWith('feet_') || /(?:shoe|boot|sneaker|trainer|heel|sandal)/.test(lower)) {
    return 'footwear';
  }
  if (lower.startsWith('legs_') || /(?:pants|shorts|trouser|jeans|legging)/.test(lower)) {
    return 'pants';
  }
  if (lower.startsWith('torso_')) {
    if (
      bounds?.minY !== undefined &&
      bounds.minY < 0.87 &&
      (bounds.waistRadius === undefined || bounds.waistRadius > 0.145)
    ) {
      return 'jacket';
    }
    if (bounds?.waistRadius !== undefined && bounds.waistRadius > 0.160) {
      return 'jacket';
    }
    return 'inner_top';
  }

  return 'inner_top';
}

export function getGarmentLayerClearanceOffsetM(layer: WardrobeLayerId): number {
  return WARDROBE_LAYER_CLEARANCE_M[layer] ?? 0;
}

function quantizePosKey(x: number, y: number, z: number): string {
  return `${Math.round(x * 2000)},${Math.round(y * 2000)},${Math.round(z * 2000)}`;
}

/**
 * Applies subtle outward vertex-normal clearance ordered cleanly by `WardrobeLayerId`
 * (`skin < inner_top < pants < footwear < skirt < dress < jacket < straps < accessories`),
 * keeping companion `_Outline` meshes locked at identical outward offset and tucking
 * tucked-in shirt hems cleanly inside pant waistbands.
 */
export function applyLayeredGarmentClearance(
  geometry: THREE.BufferGeometry,
  layer: WardrobeLayerId,
  options?: {
    isOutlineMesh?: boolean;
    companionBaseGeometry?: THREE.BufferGeometry;
    bounds?: GarmentLayerHintBounds;
    extraOffsetM?: number;
  },
): number {
  const baseOffsetM = getGarmentLayerClearanceOffsetM(layer) + (options?.extraOffsetM ?? 0);
  if (Math.abs(baseOffsetM) <= 1e-6) {
    return 0;
  }

  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!posAttr || posAttr.count === 0) return 0;

  let nrmAttr = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (!nrmAttr) {
    geometry.computeVertexNormals();
    nrmAttr = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
  }
  if (!nrmAttr) return 0;

  // Build outward-normal lookup from companion non-outline mesh when offsetting an _Outline hull
  const companionNormalsByKey = new Map<string, [number, number, number]>();
  if (options?.isOutlineMesh && options.companionBaseGeometry) {
    const cPos = options.companionBaseGeometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    const cNrm = options.companionBaseGeometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
    if (cPos && cNrm) {
      for (let i = 0; i < cPos.count; i++) {
        const key = quantizePosKey(cPos.getX(i), cPos.getY(i), cPos.getZ(i));
        if (!companionNormalsByKey.has(key)) {
          companionNormalsByKey.set(key, [cNrm.getX(i), cNrm.getY(i), cNrm.getZ(i)]);
        }
      }
    }
  }

  const isTuckedInnerTop =
    layer === 'inner_top' &&
    options?.bounds?.minY !== undefined &&
    options.bounds.minY >= 0.865 &&
    options.bounds.minY <= 0.940 &&
    (options.bounds.waistRadius === undefined || options.bounds.waistRadius <= 0.145);

  const isOutline = Boolean(options?.isOutlineMesh);
  for (let i = 0; i < posAttr.count; i++) {
    const px = posAttr.getX(i);
    const py = posAttr.getY(i);
    const pz = posAttr.getZ(i);
    const absX = Math.abs(px);

    let offset = baseOffsetM;
    // Cap tiny neck/collar & finger/nail accessory clearance so chokers and nails stay snug
    if (layer === 'accessories') {
      if (absX < 0.095 && py > 1.24) {
        offset = Math.min(offset, 0.0032);
      } else if (absX > 0.65) {
        offset = Math.min(offset, 0.0020);
      } else if (absX > 0.56) {
        offset = Math.min(offset, 0.0034);
      }
    } else if (isTuckedInnerTop && absX < 0.18 && py < 0.944) {
      // Smoothly tuck inner_top hem inside high-waist pants so waistband never Z-fights
      const tuckBlend = Math.min(1, Math.max(0, (0.944 - py) / 0.032));
      offset = baseOffsetM * (1 - tuckBlend) - 0.0016 * tuckBlend;
    }

    let nx = nrmAttr.getX(i);
    let ny = nrmAttr.getY(i);
    let nz = nrmAttr.getZ(i);
    if (isOutline) {
      const comp = companionNormalsByKey.get(quantizePosKey(px, py, pz));
      if (comp) {
        nx = comp[0];
        ny = comp[1];
        nz = comp[2];
      } else {
        // Inverted-hull outline meshes store inward-facing normals
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
    }
    const nLen = Math.hypot(nx, ny, nz);
    if (nLen <= 1e-5) continue;
    const invLen = offset / nLen;
    posAttr.setXYZ(i, px + nx * invLen, py + ny * invLen, pz + nz * invLen);
  }
  posAttr.needsUpdate = true;
  return baseOffsetM;
}

/**
 * Smoothly tapers covered underlying limb/thigh skin inward across a shorts/skirt hem
 * transition band (`[minHemY + 0.010, maxKeepY]`) so thigh skin never pokes through
 * arched hems during walk, run, sit, or scooter animations.
 */
export function applyCoveredSkinHemTuck(
  geometry: THREE.BufferGeometry,
  minHemY: number,
  maxKeepY: number,
  maxInsetM = 0.006,
  isOutlineMesh = false,
): number {
  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  const nrmAttr = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (!posAttr || !nrmAttr || maxKeepY <= minHemY) return 0;

  const bandStartY = minHemY - 0.004;
  const bandSpan = Math.max(0.012, maxKeepY - bandStartY);
  // Weld horizontal normals across coincident vertices (UV seams / creased edges) so
  // tucked skin never splits open along seams and sharp corners pull cleanly inward.
  const weldedHorizNormals = new Map<string, { nx: number; nz: number }>();
  const posKey = (x: number, y: number, z: number): string =>
    `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
  for (let i = 0; i < posAttr.count; i++) {
    const py = posAttr.getY(i);
    if (py <= bandStartY) continue;
    const k = posKey(posAttr.getX(i), py, posAttr.getZ(i));
    let entry = weldedHorizNormals.get(k);
    if (!entry) {
      entry = { nx: 0, nz: 0 };
      weldedHorizNormals.set(k, entry);
    }
    entry.nx += nrmAttr.getX(i);
    entry.nz += nrmAttr.getZ(i);
  }

  let tuckedVerts = 0;

  for (let i = 0; i < posAttr.count; i++) {
    const py = posAttr.getY(i);
    if (py <= bandStartY) continue;
    const rawT = Math.min(1, (py - bandStartY) / bandSpan);
    // Smoothstep ramp so the transition at the hem edge is silky and reaches full inset by mid-overlap
    const t = rawT * rawT * (3 - 2 * rawT);
    const inset = maxInsetM * Math.max(0.25 * rawT, t);
    const px = posAttr.getX(i);
    const pz = posAttr.getZ(i);
    const welded = weldedHorizNormals.get(posKey(px, py, pz));
    let nx = welded ? welded.nx : nrmAttr.getX(i);
    let nz = welded ? welded.nz : nrmAttr.getZ(i);
    const horizLen = Math.hypot(nx, nz);
    if (horizLen > 0.15) {
      nx /= horizLen;
      nz /= horizLen;
    } else {
      // Cap/flat-end triangles: tuck horizontally inward toward nearest thigh axis (±0.08, z)
      const thighCenterX = Math.abs(px) > 0.04 ? Math.sign(px) * 0.075 : 0;
      const rx = px - thighCenterX;
      const rz = pz;
      const rLen = Math.hypot(rx, rz);
      if (rLen <= 1e-5) continue;
      nx = rx / rLen;
      nz = rz / rLen;
    }
    const sign = isOutlineMesh ? 1 : -1;
    posAttr.setXYZ(i, px + nx * sign * inset, py, pz + nz * sign * inset);
    tuckedVerts++;
  }
  if (tuckedVerts > 0) {
    posAttr.needsUpdate = true;
  }
  return tuckedVerts;
}

/**
 * Smooths skin weights across neck, shoulder, wrist, waist, and hip/thigh transition bands
 * using position-welded mesh adjacency (keeping UV seams 100% watertight!) plus anatomical
 * wrist/hip articulation alignment so idle, walk, run, sit, scooter ride, and emote poses
 * produce zero jagged seam gaps, zero shoulder/neck tearing, and zero hip/thigh clipping.
 */
export function smoothBoundaryTransitionWeights(
  geometry: THREE.BufferGeometry,
  bones: readonly THREE.Bone[],
  layer: WardrobeLayerId,
  options?: {
    passes?: number;
  },
): number {
  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  const skinIdxAttr = geometry.getAttribute('skinIndex') as THREE.BufferAttribute | undefined;
  const skinWgtAttr = geometry.getAttribute('skinWeight') as THREE.BufferAttribute | undefined;
  if (!posAttr || !skinIdxAttr || !skinWgtAttr || bones.length === 0) return 0;
  if (layer === 'hair' || layer === 'footwear') return 0;

  const vCount = posAttr.count;
  const boneCount = bones.length;

  // Locate canonical anatomical bone indices inside this mesh's skeleton
  const findSkelBoneIdx = (targetNames: readonly string[]): number => {
    for (const tn of targetNames) {
      const idx = bones.findIndex(
        (b) =>
          b.name === tn ||
          normalizeWardrobeBoneName(b.name).toLowerCase() === tn.toLowerCase(),
      );
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const hipIdx = findSkelBoneIdx(['Hip', 'Hips']);
  const spineIdx = findSkelBoneIdx(['Spine']);
  const spine02Idx = findSkelBoneIdx(['Spine02', 'Spine2']);
  const neckIdx = findSkelBoneIdx(['Neck']);
  const lShoulderIdx = findSkelBoneIdx(['LeftShoulder']);
  const rShoulderIdx = findSkelBoneIdx(['RightShoulder']);
  const lForeArmIdx = findSkelBoneIdx(['LeftForeArm']);
  const rForeArmIdx = findSkelBoneIdx(['RightForeArm']);
  const lHandIdx = findSkelBoneIdx(['LeftHand']);
  const rHandIdx = findSkelBoneIdx(['RightHand']);
  const lUpLegIdx = findSkelBoneIdx(['LeftUpLeg']);
  const rUpLegIdx = findSkelBoneIdx(['RightUpLeg']);

  // Detect whether this garment extends into lower-hip/thigh zone or reaches wrists
  let minY = Infinity;
  let maxAbsX = 0;
  for (let i = 0; i < vCount; i++) {
    const y = posAttr.getY(i);
    const ax = Math.abs(posAttr.getX(i));
    if (y < minY) minY = y;
    if (ax > maxAbsX) maxAbsX = ax;
  }
  const hasWristCuffs =
    (layer === 'inner_top' || layer === 'jacket' || layer === 'dress') && maxAbsX >= 0.595;
  const hasHipSkirtHem =
    (layer === 'jacket' || layer === 'skirt' || layer === 'dress') && minY < 0.885;

  // Group vertices by quantized 3D position so UV seams stay tightly welded
  const keyToVerts = new Map<string, number[]>();
  const vertKeyIndex = new Int32Array(vCount);
  const uniqueVertGroups: number[][] = [];
  for (let i = 0; i < vCount; i++) {
    const k = quantizePosKey(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
    let grp = keyToVerts.get(k);
    if (!grp) {
      grp = [];
      keyToVerts.set(k, grp);
      uniqueVertGroups.push(grp);
    }
    grp.push(i);
    vertKeyIndex[i] = uniqueVertGroups.length - 1;
  }

  const groupCount = uniqueVertGroups.length;
  const groupNeighbors: Set<number>[] = Array.from({ length: groupCount }, () => new Set<number>());
  const idxAttr = geometry.getIndex();
  const triCount = idxAttr ? Math.floor(idxAttr.count / 3) : Math.floor(vCount / 3);
  for (let t = 0; t < triCount; t++) {
    const i0 = idxAttr ? idxAttr.getX(t * 3) : t * 3;
    const i1 = idxAttr ? idxAttr.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idxAttr ? idxAttr.getX(t * 3 + 2) : t * 3 + 2;
    const g0 = vertKeyIndex[i0];
    const g1 = vertKeyIndex[i1];
    const g2 = vertKeyIndex[i2];
    if (g0 !== g1) {
      groupNeighbors[g0].add(g1);
      groupNeighbors[g1].add(g0);
    }
    if (g1 !== g2) {
      groupNeighbors[g1].add(g2);
      groupNeighbors[g2].add(g1);
    }
    if (g0 !== g2) {
      groupNeighbors[g0].add(g2);
      groupNeighbors[g2].add(g0);
    }
  }

  // Classify each unique 3D vertex group into anatomical transition zones
  const inZone = new Uint8Array(groupCount);
  const groupPos = new Float32Array(groupCount * 3);
  for (let gi = 0; gi < groupCount; gi++) {
    const rep = uniqueVertGroups[gi][0];
    const x = posAttr.getX(rep);
    const y = posAttr.getY(rep);
    const z = posAttr.getZ(rep);
    groupPos[gi * 3] = x;
    groupPos[gi * 3 + 1] = y;
    groupPos[gi * 3 + 2] = z;
    const ax = Math.abs(x);

    const isNeckZone = ax < 0.11 && y >= 1.27 && y <= 1.38;
    const isShoulderZone = ax >= 0.11 && ax <= 0.24 && y >= 1.16 && y <= 1.36;
    const isWristZone = hasWristCuffs && ax >= 0.575 && ax <= 0.640 && y >= 1.16 && y <= 1.32;
    const isWaistZone = ax < 0.22 && y >= 0.87 && y <= 1.01;
    const isHipZone = hasHipSkirtHem && ax < 0.24 && y >= 0.68 && y < 0.89;

    if (isNeckZone || isShoulderZone || isWristZone || isWaistZone || isHipZone) {
      inZone[gi] = 1;
    }
  }

  // Expand each unique vertex into dense bone-weight vector (`groupCount * boneCount`)
  // Only allocate dense array when there are vertices inside transition zones
  let zoneVertCount = 0;
  for (let gi = 0; gi < groupCount; gi++) {
    if (inZone[gi]) zoneVertCount++;
  }
  if (zoneVertCount === 0) return 0;

  let curWeights = new Float32Array(groupCount * boneCount);
  let nextWeights = new Float32Array(groupCount * boneCount);

  for (let gi = 0; gi < groupCount; gi++) {
    const grp = uniqueVertGroups[gi];
    const rowOff = gi * boneCount;
    for (const vi of grp) {
      for (let k = 0; k < 4; k++) {
        const j =
          k === 0
            ? skinIdxAttr.getX(vi)
            : k === 1
              ? skinIdxAttr.getY(vi)
              : k === 2
                ? skinIdxAttr.getZ(vi)
                : skinIdxAttr.getW(vi);
        const w =
          k === 0
            ? skinWgtAttr.getX(vi)
            : k === 1
              ? skinWgtAttr.getY(vi)
              : k === 2
                ? skinWgtAttr.getZ(vi)
                : skinWgtAttr.getW(vi);
        if (w > 0 && j >= 0 && j < boneCount) {
          curWeights[rowOff + j] += w / grp.length;
        }
      }
    }
    // Pre-apply parametric wrist & hip/thigh articulation guides before neighbor smoothing
    const x = groupPos[gi * 3];
    const y = groupPos[gi * 3 + 1];
    const z = groupPos[gi * 3 + 2];
    const ax = Math.abs(x);

    // Wrist cuff alignment: smoothly bridge sleeve cuff toward 50/50 ForeArm-Hand at |x|=0.618
    if (hasWristCuffs && ax >= 0.580 && ax <= 0.640 && y >= 1.16 && y <= 1.32) {
      const foreIdx = x > 0 ? lForeArmIdx : rForeArmIdx;
      const handIdx = x > 0 ? lHandIdx : rHandIdx;
      if (foreIdx >= 0 && handIdx >= 0) {
        const curArm = curWeights[rowOff + foreIdx] + curWeights[rowOff + handIdx];
        if (curArm > 0.5) {
          const tWrist = Math.min(1, Math.max(0, (ax - 0.580) / 0.045));
          const targetHandShare = 0.5 * tWrist;
          const blend = 0.45 * tWrist;
          const desiredHand = curArm * targetHandShare;
          const desiredFore = curArm - desiredHand;
          curWeights[rowOff + foreIdx] =
            curWeights[rowOff + foreIdx] * (1 - blend) + desiredFore * blend;
          curWeights[rowOff + handIdx] =
            curWeights[rowOff + handIdx] * (1 - blend) + desiredHand * blend;
        }
      }
    }

    // Center-neck shoulder-pull damping (prevents chokers/collars lifting sideways when arms raise)
    if (layer === 'accessories' && ax < 0.055 && y >= 1.25 && y <= 1.36 && spine02Idx >= 0) {
      for (const sIdx of [lShoulderIdx, rShoulderIdx]) {
        if (sIdx >= 0 && curWeights[rowOff + sIdx] > 0.04) {
          const transfer = curWeights[rowOff + sIdx] * 0.55;
          curWeights[rowOff + sIdx] -= transfer;
          curWeights[rowOff + (neckIdx >= 0 ? neckIdx : spine02Idx)] += transfer * 0.35;
          curWeights[rowOff + spine02Idx] += transfer * 0.65;
        }
      }
    }

    // Lower-hip jacket/skirt thigh articulation blend so lifted thighs in sit/scooter never poke through
    if (hasHipSkirtHem && ax < 0.24 && y >= 0.68 && y < 0.885 && hipIdx >= 0 && lUpLegIdx >= 0 && rUpLegIdx >= 0) {
      const hipW = curWeights[rowOff + hipIdx] + (spineIdx >= 0 ? curWeights[rowOff + spineIdx] * 0.25 : 0);
      const existingLegW = curWeights[rowOff + lUpLegIdx] + curWeights[rowOff + rUpLegIdx];
      const depthT = Math.min(1, Math.max(0, (0.885 - y) / 0.16));
      const lateralShare = Math.min(1, ax / 0.055);
      // Modulate strongly on front/side panels (+Z) where thighs lift when seated, gently on back hem
      const frontMask = z >= -0.02 ? 1.0 : Math.max(0.32, 1.0 + (z + 0.02) * 8.0);
      const targetLegTotal = Math.min(0.62, depthT * frontMask * (0.28 + 0.24 * lateralShare));
      if (hipW + existingLegW > 0.35 && existingLegW < targetLegTotal) {
        const addLeg = Math.min(curWeights[rowOff + hipIdx] * 0.72, targetLegTotal - existingLegW);
        if (addLeg > 0) {
          const leftFraction = x >= 0.03 ? 1.0 : x <= -0.03 ? 0.0 : (x + 0.03) / 0.06;
          curWeights[rowOff + hipIdx] -= addLeg;
          curWeights[rowOff + lUpLegIdx] += addLeg * leftFraction;
          curWeights[rowOff + rUpLegIdx] += addLeg * (1 - leftFraction);
        }
      }
    }
  }

  const passes = Math.max(1, Math.min(4, options?.passes ?? 2));
  for (let pass = 0; pass < passes; pass++) {
    nextWeights.set(curWeights);
    for (let gi = 0; gi < groupCount; gi++) {
      if (!inZone[gi]) continue;
      const nbrs = groupNeighbors[gi];
      if (nbrs.size === 0) continue;
      const rowOff = gi * boneCount;
      for (let b = 0; b < boneCount; b++) {
        let sumNbr = 0;
        for (const nj of nbrs) {
          sumNbr += curWeights[nj * boneCount + b];
        }
        const avgNbr = sumNbr / nbrs.size;
        nextWeights[rowOff + b] = curWeights[rowOff + b] * 0.58 + avgNbr * 0.42;
      }
    }
    const tmp = curWeights;
    curWeights = nextWeights;
    nextWeights = tmp;
  }

  // Write top 4 normalized influences back to every vertex in each welded group
  const outIdx = new Uint16Array(vCount * 4);
  const outWgt = new Float32Array(vCount * 4);
  const topBone = [0, 0, 0, 0];
  const topW = [0, 0, 0, 0];

  for (let gi = 0; gi < groupCount; gi++) {
    const rowOff = gi * boneCount;
    topBone.fill(0);
    topW.fill(0);
    for (let b = 0; b < boneCount; b++) {
      const w = curWeights[rowOff + b];
      if (w <= 1e-6) continue;
      // Insert into sorted top 4
      for (let s = 0; s < 4; s++) {
        if (w > topW[s]) {
          for (let sh = 3; sh > s; sh--) {
            topW[sh] = topW[sh - 1];
            topBone[sh] = topBone[sh - 1];
          }
          topW[s] = w;
          topBone[s] = b;
          break;
        }
      }
    }
    const sum4 = topW[0] + topW[1] + topW[2] + topW[3];
    const invSum = sum4 > 1e-6 ? 1.0 / sum4 : 1.0;
    if (sum4 <= 1e-6) {
      topBone[0] = hipIdx >= 0 ? hipIdx : 0;
      topW[0] = 1.0;
    }

    for (const vi of uniqueVertGroups[gi]) {
      const base = vi * 4;
      for (let s = 0; s < 4; s++) {
        outIdx[base + s] = topBone[s];
        outWgt[base + s] = topW[s] * (sum4 > 1e-6 ? invSum : 1.0);
      }
    }
  }

  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(outIdx, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(outWgt, 4));
  return zoneVertCount;
}

function quantizeCoarseKey(cx: number, cy: number, cz: number): string {
  return `${cx},${cy},${cz}`;
}

/**
 * Copies nearest-position skin weights from a primary garment geometry onto its
 * companion `_Outline` geometry (accounting for ~2-4mm inverted-hull extrusion)
 * so ink silhouettes stay locked to smoothed seams.
 */
export function syncCompanionOutlineSkinWeights(
  outlineGeometry: THREE.BufferGeometry,
  companionGeometry: THREE.BufferGeometry,
  outlineBoneNames: readonly string[],
  companionBoneNames: readonly string[],
): number {
  const oPos = outlineGeometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  const oIdx = outlineGeometry.getAttribute('skinIndex') as THREE.BufferAttribute | undefined;
  const oWgt = outlineGeometry.getAttribute('skinWeight') as THREE.BufferAttribute | undefined;
  const cPos = companionGeometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  const cIdx = companionGeometry.getAttribute('skinIndex') as THREE.BufferAttribute | undefined;
  const cWgt = companionGeometry.getAttribute('skinWeight') as THREE.BufferAttribute | undefined;
  if (!oPos || !oIdx || !oWgt || !cPos || !cIdx || !cWgt) return 0;

  const compToOutBone = new Map<number, number>();
  for (let ci = 0; ci < companionBoneNames.length; ci++) {
    const oi = outlineBoneNames.indexOf(companionBoneNames[ci]);
    if (oi >= 0) compToOutBone.set(ci, oi);
  }

  // Coarse 12mm spatial grid so O(N) nearest-vertex lookup handles ~3mm hull offsets cleanly
  const cellScale = 1 / 0.012;
  const grid = new Map<string, number[]>();
  for (let i = 0; i < cPos.count; i++) {
    const key = quantizeCoarseKey(
      Math.round(cPos.getX(i) * cellScale),
      Math.round(cPos.getY(i) * cellScale),
      Math.round(cPos.getZ(i) * cellScale),
    );
    let bucket = grid.get(key);
    if (!bucket) {
      bucket = [];
      grid.set(key, bucket);
    }
    bucket.push(i);
  }

  const resolveSideTag = (boneNames: readonly string[], boneIdxVal: number): 'left' | 'right' | 'center' => {
    const bName = boneNames[boneIdxVal] ?? '';
    if (bName.startsWith('Left') || bName.includes('Left')) return 'left';
    if (bName.startsWith('Right') || bName.includes('Right')) return 'right';
    return 'center';
  };
  const resolvePrimarySlot = (
    idxAttr: THREE.BufferAttribute,
    wgtAttr: THREE.BufferAttribute,
    vi: number,
  ): number => {
    let bestBone = Math.round(idxAttr.getX(vi));
    let bestW = wgtAttr.getX(vi);
    const b1 = Math.round(idxAttr.getY(vi));
    const w1 = wgtAttr.getY(vi);
    const b2 = Math.round(idxAttr.getZ(vi));
    const w2 = wgtAttr.getZ(vi);
    const b3 = Math.round(idxAttr.getW(vi));
    const w3 = wgtAttr.getW(vi);
    if (w1 > bestW) { bestW = w1; bestBone = b1; }
    if (w2 > bestW) { bestW = w2; bestBone = b2; }
    if (w3 > bestW) { bestBone = b3; }
    return bestBone;
  };

  let synced = 0;
  const maxDistSq = 0.0085 * 0.0085;
  for (let i = 0; i < oPos.count; i++) {
    const ox = oPos.getX(i);
    const oy = oPos.getY(i);
    const oz = oPos.getZ(i);
    const gx = Math.round(ox * cellScale);
    const gy = Math.round(oy * cellScale);
    const gz = Math.round(oz * cellScale);
    const outPrimaryBone = resolvePrimarySlot(oIdx, oWgt, i);
    const outSide = resolveSideTag(outlineBoneNames, outPrimaryBone);

    let bestVi = -1;
    let bestD2 = maxDistSq;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = grid.get(quantizeCoarseKey(gx + dx, gy + dy, gz + dz));
          if (!bucket) continue;
          for (const vi of bucket) {
            // Never copy skin weights across Left/Right anatomical midline (e.g. extruded cuff outline vertices crossing x=0)
            if (outSide !== 'center') {
              const candSide = resolveSideTag(companionBoneNames, resolvePrimarySlot(cIdx, cWgt, vi));
              if (candSide !== 'center' && candSide !== outSide) {
                continue;
              }
            }
            const d2 =
              (ox - cPos.getX(vi)) ** 2 +
              (oy - cPos.getY(vi)) ** 2 +
              (oz - cPos.getZ(vi)) ** 2;
            if (d2 < bestD2) {
              bestD2 = d2;
              bestVi = vi;
            }
          }
        }
      }
    }
    if (bestVi < 0) continue;

    const j = [
      cIdx.getX(bestVi),
      cIdx.getY(bestVi),
      cIdx.getZ(bestVi),
      cIdx.getW(bestVi),
    ];
    const w = [
      cWgt.getX(bestVi),
      cWgt.getY(bestVi),
      cWgt.getZ(bestVi),
      cWgt.getW(bestVi),
    ];
    let ok = true;
    for (let s = 0; s < 4; s++) {
      if (w[s] > 0) {
        const mapped = compToOutBone.get(j[s]);
        if (mapped === undefined) {
          ok = false;
          break;
        }
        j[s] = mapped;
      } else {
        j[s] = 0;
      }
    }
    if (!ok) continue;
    oIdx.setXYZW(i, j[0], j[1], j[2], j[3]);
    oWgt.setXYZW(i, w[0], w[1], w[2], w[3]);
    synced++;
  }
  if (synced > 0) {
    oIdx.needsUpdate = true;
    oWgt.needsUpdate = true;
  }
  return synced;
}

export interface ModularMaterialHintClassification {
  isOutline: boolean;
  isHair: boolean;
  isBodySkin: boolean;
  normalizedMaterialName: string;
}

/**
 * Classifies a modular apparel submesh + material pair so `prepareModularApparelGltfMaterials`
 * applies consistent outline, hair, clothing, and body-skin shader hints even when GLTF
 * exporters append `_1` suffixes (`torso_*_skin_1`, `hands_skin_1`) or omit `_Skin`/`Outline` tags.
 */
export function classifyModularApparelMaterialHint(
  meshName: string,
  materialName: string,
): ModularMaterialHintClassification {
  const lowerMesh = (meshName || '').toLowerCase();
  const lowerMat = (materialName || '').toLowerCase();
  const isOutline = lowerMesh.includes('outline') || lowerMat.includes('outline');
  const isHair = !isOutline && (lowerMesh.startsWith('hair') || lowerMesh.includes('_hair') || lowerMat.includes('hair'));
  const meshHasSkinTag =
    !isOutline &&
    !lowerMesh.startsWith('head') &&
    (lowerMesh.includes('_skin') ||
      lowerMesh.startsWith('hands_skin') ||
      lowerMesh.startsWith('ears_'));
  const matHasSkinTag = !isOutline && !lowerMesh.startsWith('head') && lowerMat.includes('skin');
  const isBodySkin = !isOutline && !isHair && (meshHasSkinTag || matHasSkinTag);

  let normalizedMaterialName = materialName || 'ModularMat';
  if (isOutline && !lowerMat.includes('outline')) {
    normalizedMaterialName = `${normalizedMaterialName}_Outline`;
  } else if (isBodySkin && !lowerMat.includes('skin')) {
    normalizedMaterialName = `${normalizedMaterialName}_Skin`;
  }

  return {
    isOutline,
    isHair,
    isBodySkin,
    normalizedMaterialName,
  };
}
