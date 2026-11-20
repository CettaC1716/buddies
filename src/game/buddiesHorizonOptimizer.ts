import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BlitzWindUniforms } from './buddiesBlitzShadersAndAssets';
import { computeInstancedBoundingVolumes } from './buddiesHubRenderOptimizer';
import {
  evaluateCoastalHillRoadSample,
  evaluateHillVillaPlateauSdf,
} from './buddiesCoastalHillsRules';
import {
  evaluateEmbankmentTierOffsets,
  getBaseProceduralGroundElevation,
} from './buddiesPlanetCurvature';

/**
 * Sky-matching daylight horizon fog color (#bae2ff) for Linear `THREE.Fog`.
 * Matches `AnimeSkyDome`'s horizon band so distant terrain, hills, and treelines
 * dissolve seamlessly into the sky without `FogExp2` or post-processing passes.
 */
export const HORIZON_CLEAR_FOG_COLOR_HEX = 0xbae2ff;
export const HORIZON_CLEAR_FOG_COLOR_CSS = '#bae2ff';

export const HORIZON_BACKDROP_DRAW_CALL_LIMIT = 3;

export const HORIZON_FAR_CLIP_BUFFERS = {
  gameplay: 32,
  seated: 30,
  city_overview: 45,
  city_district: 34,
  park_view: 36,
  landing_tour: 40,
  showcase: 40,
  full_map_overview: 200,
  indoor: 40,
} as const;

export type HorizonCameraViewMode = keyof typeof HORIZON_FAR_CLIP_BUFFERS;

export interface HorizonFogCalibrationInput {
  mode: HorizonCameraViewMode;
  cameraDistanceM?: number;
  cameraHeightM?: number;
  fovDeg?: number;
  isSoftwareGl?: boolean;
}

export interface HorizonFogCalibrationResult {
  fogEnabled: boolean;
  fogColorHex: number;
  fogNear: number;
  fogFar: number;
  farClipBuffer: number;
  cameraFar: number;
}

export interface HorizonOptimizerSceneState {
  mode: HorizonCameraViewMode;
  baseNear: number;
  baseFar: number;
  effectiveNear: number;
  effectiveFar: number;
  farClipBuffer: number;
  cameraFar: number;
}

export interface HorizonCliffBackdropOptions {
  isSoftwareGl?: boolean;
  leafMaskTexture?: THREE.Texture | null;
  windUniforms?: BlitzWindUniforms | null;
}

export interface HorizonCliffBackdropHandle {
  group: THREE.Group;
  hillMoundsMesh: THREE.InstancedMesh;
  treeCanopiesMesh: THREE.InstancedMesh;
  treeTrunksMesh: THREE.InstancedMesh;
  instancedMeshes: readonly THREE.InstancedMesh[];
  getDrawCallCount(): number;
  setLeafMaskTexture(tex: THREE.Texture | null | undefined): void;
  dispose(): void;
}

const HORIZON_FOG_SKIP_OBJECT_NAMES = new Set<string>([
  'AnimeSkyDome',
  'AnimeHorizonCloudRingInstanced',
  'AnimeSkySparkles',
  'HouseInteriorRoomGroup',
  'BotanicalGlasshouseCafeInterior',
  'GrandCasinoInterior',
]);

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const denom = edge1 - edge0;
  if (Math.abs(denom) < 1e-6) return x >= edge1 ? 1 : 0;
  const t = clamp((x - edge0) / denom, 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Evaluates the exact Three.js Linear `THREE.Fog` blend factor (`smoothstep(near, far, depth)`).
 */
export function evaluateHorizonLinearFogFactor(
  viewDepthM: number,
  fogNear: number,
  fogFar: number,
): number {
  return smoothstep(fogNear, fogFar, viewDepthM);
}

/**
 * Pure Linear `THREE.Fog` + `camera.far` calibration across Gameplay, Seated,
 * `#kota` City Overview, District Views, Park Views, and Indoor/Overview modes.
 *
 * Design invariants:
 * - Keeps active city roads, Central Botanical Park, Plaza, Tennis, and Grand Casino crisp (`< near`).
 * - Places `far` across the outer West plateau behind Tennis/Plaza/Casino so the outer edge
 *   dissolves into `#bae2ff` horizon sky instead of showing a sharp flat cutoff.
 * - Aligns `camera.far === fog.far + farClipBuffer` when outdoor fog is active, eliminating
 *   900-1000m GPU overdraw without post-processing.
 */
export function evaluateHorizonFogAndFarClip(
  input: HorizonFogCalibrationInput,
): HorizonFogCalibrationResult {
  const buffer = HORIZON_FAR_CLIP_BUFFERS[input.mode];
  const fovDeg = input.fovDeg ?? 42;
  const heightM = Math.max(0, input.cameraHeightM ?? 12);

  if (input.mode === 'full_map_overview') {
    return {
      fogEnabled: false,
      fogColorHex: HORIZON_CLEAR_FOG_COLOR_HEX,
      fogNear: 5000,
      fogFar: 6000,
      farClipBuffer: buffer,
      cameraFar: 800,
    };
  }

  if (input.mode === 'showcase') {
    return {
      fogEnabled: false,
      fogColorHex: HORIZON_CLEAR_FOG_COLOR_HEX,
      fogNear: 5000,
      fogFar: 6000,
      farClipBuffer: buffer,
      cameraFar: 260,
    };
  }

  if (input.mode === 'indoor') {
    // Push linear fog far beyond indoor room bounds instead of nulling `scene.fog`,
    // avoiding WebGL shader recompilation stalls when entering/exiting buildings.
    return {
      fogEnabled: false,
      fogColorHex: HORIZON_CLEAR_FOG_COLOR_HEX,
      fogNear: 5000,
      fogFar: 6000,
      farClipBuffer: buffer,
      cameraFar: 180,
    };
  }

  if (input.mode === 'city_overview') {
    const dist = clamp(input.cameraDistanceM ?? 138, 42, 215);
    const fogNear = Math.round(clamp(dist * 1.38, 84, 278));
    const fogFar = Math.round(Math.max(fogNear + 48, clamp(dist * 1.98, 138, 395)));
    return {
      fogEnabled: true,
      fogColorHex: HORIZON_CLEAR_FOG_COLOR_HEX,
      fogNear,
      fogFar,
      farClipBuffer: buffer,
      cameraFar: fogFar + buffer,
    };
  }

  if (input.mode === 'city_district') {
    const dist = clamp(input.cameraDistanceM ?? 52, 20, 110);
    const fogNear = Math.round(clamp(dist * 1.25, 58, 118));
    const fogFar = Math.round(Math.max(fogNear + 34, clamp(dist * 1.95 + 16, 102, 195)));
    return {
      fogEnabled: true,
      fogColorHex: HORIZON_CLEAR_FOG_COLOR_HEX,
      fogNear,
      fogFar,
      farClipBuffer: buffer,
      cameraFar: fogFar + buffer,
    };
  }

  if (input.mode === 'park_view') {
    const fogNear = 76;
    const fogFar = 132;
    return {
      fogEnabled: true,
      fogColorHex: HORIZON_CLEAR_FOG_COLOR_HEX,
      fogNear,
      fogFar,
      farClipBuffer: buffer,
      cameraFar: fogFar + buffer,
    };
  }

  if (input.mode === 'landing_tour') {
    const fogNear = 140;
    const fogFar = 240;
    return {
      fogEnabled: true,
      fogColorHex: HORIZON_CLEAR_FOG_COLOR_HEX,
      fogNear,
      fogFar,
      farClipBuffer: buffer,
      cameraFar: fogFar + buffer,
    };
  }

  if (input.mode === 'seated') {
    const fogNear = 64;
    const fogFar = 114;
    return {
      fogEnabled: true,
      fogColorHex: HORIZON_CLEAR_FOG_COLOR_HEX,
      fogNear,
      fogFar,
      farClipBuffer: buffer,
      cameraFar: fogFar + buffer,
    };
  }

  // Gameplay outdoor view (eye-level / follow / drive / plane / ortho18)
  const altLift = Math.max(0, (heightM - 26) * 2.2);
  const orthoBoost = fovDeg <= 22 ? 40 : 0;
  const fogNear = Math.round(74 + altLift * 0.65 + orthoBoost);
  const fogFar = Math.round(Math.max(fogNear + 44, 132 + altLift + orthoBoost * 1.4));
  return {
    fogEnabled: true,
    fogColorHex: HORIZON_CLEAR_FOG_COLOR_HEX,
    fogNear,
    fogFar,
    farClipBuffer: buffer,
    cameraFar: fogFar + buffer,
  };
}

/**
 * Applies Linear `THREE.Fog` and synchronized `camera.far` to a live Three.js Scene/Camera.
 * Composes cleanly with `@dynamiccuaca`'s `scene.userData.weatherEnvState`:
 * - Never overwrites dynamic weather fog colors (`malam`/`senja`/`fajar`/`hujan`/`kabut`).
 * - Preserves weather fog compression during `kabut`/`hujan` while keeping `camera.far === fog.far + buffer`.
 * - Calls `camera.updateProjectionMatrix()` strictly when `camera.fov` or `camera.far` changes.
 */
export function syncSceneHorizonFogAndFarClip(params: {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  mode: HorizonCameraViewMode;
  cameraDistanceM?: number;
  cameraHeightM?: number;
  targetFovDeg?: number;
  isSoftwareGl?: boolean;
}): HorizonFogCalibrationResult {
  const { scene, camera, mode } = params;
  const cal = evaluateHorizonFogAndFarClip({
    mode,
    cameraDistanceM: params.cameraDistanceM,
    cameraHeightM: params.cameraHeightM,
    fovDeg: params.targetFovDeg ?? camera.fov,
    isSoftwareGl: params.isSoftwareGl,
  });

  const weatherState = scene.userData?.weatherEnvState as
    | { fogFactor01?: number; rainFactor01?: number }
    | undefined;
  const isWeatherCompressing = Boolean(
    weatherState &&
      ((weatherState.fogFactor01 ?? 0) > 0.01 || (weatherState.rainFactor01 ?? 0) > 0.01),
  );

  let effectiveNear = cal.fogNear;
  let effectiveFar = cal.fogFar;

  if (mode === 'full_map_overview' || mode === 'showcase') {
    if (scene.fog !== null) {
      scene.fog = null;
    }
  } else if (mode === 'indoor') {
    if (!(scene.fog instanceof THREE.Fog)) {
      scene.fog = new THREE.Fog(cal.fogColorHex, cal.fogNear, cal.fogFar);
    } else {
      scene.fog.near = cal.fogNear;
      scene.fog.far = cal.fogFar;
    }
  } else {
    if (!(scene.fog instanceof THREE.Fog)) {
      scene.fog = new THREE.Fog(cal.fogColorHex, cal.fogNear, cal.fogFar);
    } else if (!isWeatherCompressing) {
      scene.fog.near = cal.fogNear;
      scene.fog.far = cal.fogFar;
      if (!weatherState) {
        scene.fog.color.setHex(cal.fogColorHex);
      }
    }
    if (isWeatherCompressing && scene.fog instanceof THREE.Fog) {
      effectiveNear = scene.fog.near;
      effectiveFar =
        scene.fog.far > 20 && scene.fog.far < 2000
          ? Math.min(cal.fogFar, scene.fog.far)
          : cal.fogFar;
    }
  }

  const targetCameraFar = cal.fogEnabled ? effectiveFar + cal.farClipBuffer : cal.cameraFar;
  let projChanged = false;
  if (params.targetFovDeg !== undefined && Math.abs(camera.fov - params.targetFovDeg) > 0.02) {
    camera.fov = params.targetFovDeg;
    projChanged = true;
  }
  if (Math.abs(camera.far - targetCameraFar) > 0.25) {
    camera.far = targetCameraFar;
    projChanged = true;
  }
  if (projChanged) {
    camera.updateProjectionMatrix();
  }

  const optimizerState: HorizonOptimizerSceneState = {
    mode,
    baseNear: cal.fogNear,
    baseFar: cal.fogFar,
    effectiveNear,
    effectiveFar,
    farClipBuffer: cal.farClipBuffer,
    cameraFar: targetCameraFar,
  };
  scene.userData.horizonOptimizerState = optimizerState;

  return {
    ...cal,
    fogNear: effectiveNear,
    fogFar: effectiveFar,
    cameraFar: targetCameraFar,
  };
}

/**
 * Sweeps outdoor map meshes and outlines to ensure `material.fog = true` while preserving
 * `fog = false` on sky domes, horizon cloud/sparkle effects, additive glow overlays, billboards,
 * and indoor room subtrees.
 */
export function enableSceneLinearFog(
  root: THREE.Object3D,
  options?: {
    skipObjectNames?: ReadonlySet<string>;
  },
): { updatedCount: number; totalVisited: number; skippedCount: number } {
  const extraSkips = options?.skipObjectNames;
  let updatedCount = 0;
  let totalVisited = 0;
  let skippedCount = 0;

  const visit = (node: THREE.Object3D) => {
    if (
      HORIZON_FOG_SKIP_OBJECT_NAMES.has(node.name) ||
      (extraSkips && extraSkips.has(node.name)) ||
      node.userData?.preserveFogFalse === true
    ) {
      skippedCount++;
      return;
    }

    const meshLike = node as THREE.Mesh;
    if (meshLike.material) {
      const mats = Array.isArray(meshLike.material) ? meshLike.material : [meshLike.material];
      for (let i = 0; i < mats.length; i++) {
        const mat = mats[i];
        if (!mat) continue;
        totalVisited++;

        // Preserve fog: false on 2D UI billboards, additive light cones/halos, and explicit opt-outs.
        if (
          mat.depthTest === false ||
          mat.blending === THREE.AdditiveBlending ||
          mat.userData?.preserveFogFalse === true
        ) {
          skippedCount++;
          continue;
        }

        const shaderMat = mat as THREE.ShaderMaterial;
        if (shaderMat.isShaderMaterial) {
          const hasFogUniforms = Boolean(
            shaderMat.uniforms &&
              'fogNear' in shaderMat.uniforms &&
              'fogFar' in shaderMat.uniforms &&
              'fogColor' in shaderMat.uniforms,
          );
          if (!hasFogUniforms) {
            skippedCount++;
            continue;
          }
          if (!shaderMat.fog) {
            shaderMat.fog = true;
            shaderMat.needsUpdate = true;
            updatedCount++;
          }
          continue;
        }

        if ('fog' in mat && mat.fog !== true) {
          mat.fog = true;
          mat.needsUpdate = true;
          updatedCount++;
        }
      }
    }

    for (let c = 0; c < node.children.length; c++) {
      visit(node.children[c]);
    }
  };

  visit(root);
  return { updatedCount, totalVisited, skippedCount };
}

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface HillMoundSpec {
  x: number;
  z: number;
  baseY: number;
  rx: number;
  ry: number;
  rz: number;
  yaw: number;
  colorHex: string;
}

const HORIZON_HILL_PHI_MAX = Math.PI * 0.56;

function evaluateBellHillProfileY(radialNorm: number): number {
  const r = clamp(radialNorm, 0, 1);
  const bellCos = 0.5 + 0.5 * Math.cos(Math.PI * r);
  return 1.14 * Math.pow(bellCos, 0.85) - 0.14;
}

function evaluateBellHillSlopeDr(radialNorm: number): number {
  if (radialNorm <= 1e-5 || radialNorm >= 0.999) return 0;
  const bellCos = 0.5 + 0.5 * Math.cos(Math.PI * radialNorm);
  if (bellCos <= 1e-5) return 0;
  return (
    1.14 *
    0.85 *
    Math.pow(bellCos, -0.15) *
    (-0.5 * Math.PI * Math.sin(Math.PI * radialNorm))
  );
}

/**
 * Generates a high-segment rolling bell-dome hill geometry (`>= 36` radial segments)
 * with smooth C-infinity revolution normals (zero UV-seam crease, zero low-poly facets).
 */
function createSmoothHorizonHillGeometry(
  radialSegments = 44,
  heightSegments = 22,
): THREE.SphereGeometry {
  const geo = new THREE.SphereGeometry(
    1.0,
    radialSegments,
    heightSegments,
    0,
    Math.PI * 2,
    0,
    HORIZON_HILL_PHI_MAX,
  );
  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);
    const len = Math.hypot(vx, vy, vz) || 1;
    const ny = clamp(vy / len, -1, 1);
    const theta = Math.acos(ny);
    const u = clamp(theta / HORIZON_HILL_PHI_MAX, 0, 1);
    const horizLen = Math.hypot(vx, vz);
    const dirX = horizLen > 1e-6 ? vx / horizLen : 0;
    const dirZ = horizLen > 1e-6 ? vz / horizLen : 0;
    posAttr.setXYZ(i, dirX * u, evaluateBellHillProfileY(u), dirZ * u);
  }
  posAttr.needsUpdate = true;

  geo.computeVertexNormals();
  const normAttr = geo.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < posAttr.count; i++) {
    const px = posAttr.getX(i);
    const pz = posAttr.getZ(i);
    const r = Math.hypot(px, pz);
    if (r <= 1e-5) {
      normAttr.setXYZ(i, 0, 1, 0);
    } else {
      const dydr = evaluateBellHillSlopeDr(r);
      const nx = -dydr * (px / r);
      const ny = 1.0;
      const nz = -dydr * (pz / r);
      const invLen = 1.0 / (Math.hypot(nx, ny, nz) || 1.0);
      normAttr.setXYZ(i, nx * invLen, ny * invLen, nz * invLen);
    }
  }
  normAttr.needsUpdate = true;
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Pure-JS RGBA leaf cluster alpha mask DataTexture used when no `treeFoliageTex`
 * is provided (e.g. headless Node.js unit tests or before KTX2 transcoding finishes).
 */
function createFallbackHorizonLeafMaskTexture(): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  const blobs: ReadonlyArray<readonly [number, number, number]> = [
    [0.5, 0.5, 0.28],
    [0.32, 0.42, 0.20],
    [0.68, 0.42, 0.20],
    [0.37, 0.63, 0.19],
    [0.64, 0.63, 0.19],
    [0.5, 0.30, 0.21],
    [0.26, 0.54, 0.16],
    [0.74, 0.54, 0.16],
  ];
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size;
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      let val = 0;
      for (let b = 0; b < blobs.length; b++) {
        const [bx, by, br] = blobs[b];
        const dist = Math.hypot(u - bx, v - by) / br;
        if (dist < 1.0) {
          const lobe = 1.0 - smoothstep(0.35, 1.0, dist);
          if (lobe > val) val = lobe;
        }
      }
      const byteVal = Math.round(clamp(val, 0, 1) * 255);
      const idx = (y * size + x) * 4;
      data[idx] = byteVal;
      data[idx + 1] = byteVal;
      data[idx + 2] = byteVal;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds a sakura-style multi-lobe camera-facing billboard leaf-cluster canopy geometry
 * (matching `getSharedTreeClusterGeometry` in `buddiesBlitzShadersAndAssets.ts`,
 * zero icosahedron polygons) with per-card `aLeafCenter`, `aLeafLocalPos`, `aLeafPlaneSeed`,
 * and `aLobeNormal` attributes for smooth spherical volume shading + wind sway.
 */
function createHorizonSakuraCanopyGeometry(isCompact: boolean): THREE.BufferGeometry {
  const lobes: ReadonlyArray<{ cx: number; cy: number; cz: number; radius: number }> = [
    { cx: 0.0, cy: 0.58, cz: 0.0, radius: 0.94 },
    { cx: -0.56, cy: 0.34, cz: 0.22, radius: 0.72 },
    { cx: 0.54, cy: 0.36, cz: -0.20, radius: 0.70 },
    { cx: -0.10, cy: 0.42, cz: 0.48, radius: 0.66 },
    { cx: 0.10, cy: 0.44, cz: -0.46, radius: 0.66 },
    { cx: 0.04, cy: 1.00, cz: 0.04, radius: 0.68 },
  ];
  const planesPerLobe = isCompact ? 6 : 9;
  const totalPlanes = lobes.length * planesPerLobe;
  const planeSize = 0.80;

  const rng = createSeededRng(1431691);
  const clusterGeos: THREE.BufferGeometry[] = [];
  const leafCenters = new Float32Array(totalPlanes * 4 * 3);
  const leafLocalPos = new Float32Array(totalPlanes * 4 * 3);
  const leafPlaneSeed = new Float32Array(totalPlanes * 4);
  const lobeNormals = new Float32Array(totalPlanes * 4 * 3);

  const tmpCenter = new THREE.Vector3();
  const tmpLobeNorm = new THREE.Vector3();
  const tmpCrownNorm = new THREE.Vector3();
  const tmpBlendedNorm = new THREE.Vector3();
  const tmpSph = new THREE.Spherical();

  let planeIdx = 0;
  for (let l = 0; l < lobes.length; l++) {
    const lobe = lobes[l];
    for (let p = 0; p < planesPerLobe; p++) {
      const plane = new THREE.PlaneGeometry(planeSize, planeSize);
      const seed = rng();
      const rNorm = 1.0 - Math.pow(rng(), 2.6);
      const phi = Math.PI * 2 * rng();
      const theta = Math.acos(1 - 2 * rng());
      tmpSph.set(rNorm * lobe.radius, theta, phi);
      tmpCenter.setFromSpherical(tmpSph);

      tmpLobeNorm.copy(tmpCenter);
      if (tmpLobeNorm.lengthSq() < 1e-6) tmpLobeNorm.set(0, 1, 0);
      else tmpLobeNorm.normalize();

      tmpCenter.x += lobe.cx;
      tmpCenter.y += lobe.cy;
      tmpCenter.z += lobe.cz;

      tmpCrownNorm.set(tmpCenter.x, tmpCenter.y - 0.35, tmpCenter.z);
      if (tmpCrownNorm.lengthSq() < 1e-6) tmpCrownNorm.set(0, 1, 0);
      else tmpCrownNorm.normalize();

      tmpBlendedNorm.copy(tmpLobeNorm).lerp(tmpCrownNorm, 0.55).normalize();

      const posAttr = plane.attributes.position as THREE.BufferAttribute;
      const normAttr = plane.attributes.normal as THREE.BufferAttribute;
      for (let v = 0; v < 4; v++) {
        const vertIdx = planeIdx * 4 + v;
        const f3 = vertIdx * 3;
        const lx = posAttr.getX(v);
        const ly = posAttr.getY(v);
        const lz = posAttr.getZ(v);

        leafCenters[f3] = tmpCenter.x;
        leafCenters[f3 + 1] = tmpCenter.y;
        leafCenters[f3 + 2] = tmpCenter.z;

        leafLocalPos[f3] = lx;
        leafLocalPos[f3 + 1] = ly;
        leafLocalPos[f3 + 2] = lz;

        leafPlaneSeed[vertIdx] = seed;

        lobeNormals[f3] = tmpBlendedNorm.x;
        lobeNormals[f3 + 1] = tmpBlendedNorm.y;
        lobeNormals[f3 + 2] = tmpBlendedNorm.z;

        posAttr.setXYZ(v, tmpCenter.x + lx * 1.25, tmpCenter.y + ly * 1.25, tmpCenter.z + lz * 1.25);
        normAttr.setXYZ(v, tmpBlendedNorm.x, tmpBlendedNorm.y, tmpBlendedNorm.z);
      }
      posAttr.needsUpdate = true;
      normAttr.needsUpdate = true;
      clusterGeos.push(plane);
      planeIdx++;
    }
  }

  const merged = mergeGeometries(clusterGeos, false);
  for (let i = 0; i < clusterGeos.length; i++) clusterGeos[i].dispose();
  merged.setAttribute('aLeafCenter', new THREE.BufferAttribute(leafCenters, 3));
  merged.setAttribute('aLeafLocalPos', new THREE.BufferAttribute(leafLocalPos, 3));
  merged.setAttribute('aLeafPlaneSeed', new THREE.BufferAttribute(leafPlaneSeed, 1));
  merged.setAttribute('aLobeNormal', new THREE.BufferAttribute(lobeNormals, 3));
  merged.computeBoundingBox();
  if (merged.boundingBox) {
    merged.boundingBox.expandByScalar(0.35);
  }
  merged.computeBoundingSphere();
  return merged;
}

function evaluateMaxHillSurfaceY(
  x: number,
  z: number,
  mounds: readonly HillMoundSpec[],
): number {
  let maxY = getBaseProceduralGroundElevation(x, z);
  for (let i = 0; i < mounds.length; i++) {
    const m = mounds[i];
    const dx = x - m.x;
    const dz = z - m.z;
    const maxR = Math.max(m.rx, m.rz);
    if (Math.abs(dx) > maxR || Math.abs(dz) > maxR) continue;
    const cosY = Math.cos(m.yaw);
    const sinY = Math.sin(m.yaw);
    const lx = (dx * cosY + dz * sinY) / m.rx;
    const lz = (-dx * sinY + dz * cosY) / m.rz;
    const normSq = lx * lx + lz * lz;
    if (normSq < 0.96) {
      const domeY = m.baseY + m.ry * evaluateBellHillProfileY(Math.sqrt(normSq));
      if (domeY > maxY) maxY = domeY;
    }
  }
  return maxY;
}

function createHorizonHillsShaderMaterial(
  lightDirUniform: { value: THREE.Vector3 },
  lightColorUniform: { value: THREE.Color },
  shadowColorUniform: { value: THREE.Color },
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uLightDirection: lightDirUniform,
      uLightColor: lightColorUniform,
      uShadowColor: shadowColorUniform,
    },
    fog: true,
    vertexShader: /* glsl */ `
      varying vec3 vWorldNormal;
      varying float vHeight01;
      varying float vWestDepth01;
      varying vec3 vInstanceColor;
      #include <fog_pars_vertex>

      void main() {
        #ifdef USE_INSTANCING
          mat4 worldMat = modelMatrix * instanceMatrix;
        #else
          mat4 worldMat = modelMatrix;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vInstanceColor = instanceColor;
        #else
          vInstanceColor = vec3(0.36, 0.72, 0.28);
        #endif

        vec4 worldPosition = worldMat * vec4(position, 1.0);
        vec3 col0 = worldMat[0].xyz;
        vec3 col1 = worldMat[1].xyz;
        vec3 col2 = worldMat[2].xyz;
        vec3 invScaleSq = vec3(
          1.0 / max(1e-4, dot(col0, col0)),
          1.0 / max(1e-4, dot(col1, col1)),
          1.0 / max(1e-4, dot(col2, col2))
        );
        vWorldNormal = normalize(mat3(worldMat) * (normal * invScaleSq));
        vHeight01 = clamp(position.y, 0.0, 1.0);
        vWestDepth01 = smoothstep(-120.0, -176.0, worldPosition.x);

        vec4 mvPosition = viewMatrix * worldPosition;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uLightDirection;
      uniform vec3 uLightColor;
      uniform vec3 uShadowColor;
      varying vec3 vWorldNormal;
      varying float vHeight01;
      varying float vWestDepth01;
      varying vec3 vInstanceColor;
      #include <fog_pars_fragment>

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 L = normalize(uLightDirection);
        float halfLambert = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
        float softLit = smoothstep(0.04, 0.96, halfLambert);
        float skyAmbient = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);

        float heightLift = mix(0.82, 1.08, smoothstep(0.0, 0.92, vHeight01));
        vec3 baseAlbedo = vInstanceColor * heightLift;

        vec3 lightTint = mix(vec3(0.92), uLightColor, 0.65);
        vec3 shadowTint = mix(vec3(0.56, 0.64, 0.74), uShadowColor * 1.38, 0.44);
        float lightLuma = max(0.24, dot(uLightColor, vec3(0.299, 0.587, 0.114)));

        vec3 litCol = baseAlbedo * lightTint * (0.94 + 0.10 * softLit);
        vec3 shadeCol = baseAlbedo * shadowTint * lightLuma * mix(0.86, 1.02, skyAmbient);
        vec3 hillCol = mix(shadeCol, litCol, softLit);

        vec3 mistTint = vec3(0.46, 0.68, 0.88) * lightLuma;
        hillCol = mix(hillCol, mistTint, vWestDepth01 * 0.24);

        gl_FragColor = vec4(hillCol, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}

function createHorizonCanopyShaderMaterial(
  initialLeafTex: THREE.Texture,
  uniforms: {
    uLightDirection: { value: THREE.Vector3 };
    uLightColor: { value: THREE.Color };
    uShadowColor: { value: THREE.Color };
    uWindPhase: { value: number };
    uWindDirection: { value: THREE.Vector2 };
    uWindStrength: { value: number };
    uWindGust: { value: number };
  },
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uLeafTex: { value: initialLeafTex },
      uLeafScale: { value: 1.28 },
      uAlphaThreshold: { value: 0.35 },
      uLightDirection: uniforms.uLightDirection,
      uLightColor: uniforms.uLightColor,
      uShadowColor: uniforms.uShadowColor,
      uWindPhase: uniforms.uWindPhase,
      uWindDirection: uniforms.uWindDirection,
      uWindStrength: uniforms.uWindStrength,
      uWindGust: uniforms.uWindGust,
    },
    fog: true,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute vec3 aLeafCenter;
      attribute vec3 aLeafLocalPos;
      attribute float aLeafPlaneSeed;
      attribute vec3 aLobeNormal;

      uniform float uLeafScale;
      uniform float uWindPhase;
      uniform vec2 uWindDirection;
      uniform float uWindStrength;
      uniform float uWindGust;

      varying vec2 vUv;
      varying vec3 vSphereNormal;
      varying float vCrownHeight;
      varying float vWestDepth01;
      varying vec3 vInstanceColor;
      #include <fog_pars_vertex>

      void main() {
        vUv = uv;
        #ifdef USE_INSTANCING
          mat4 worldMat = modelMatrix * instanceMatrix;
        #else
          mat4 worldMat = modelMatrix;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vInstanceColor = instanceColor;
        #else
          vInstanceColor = vec3(0.32, 0.72, 0.34);
        #endif

        float instScaleXZ = (length(worldMat[0].xyz) + length(worldMat[2].xyz)) * 0.5;
        float instScaleY = length(worldMat[1].xyz);
        float cardWorldScale = (instScaleXZ * 0.68 + instScaleY * 0.32) * uLeafScale;

        vec3 treeWorldOrigin = worldMat[3].xyz;
        float windAmp = max(0.62, uWindStrength);
        float spatialPhase =
          dot(treeWorldOrigin.xz, vec2(0.14, 0.11)) + dot(aLeafCenter.xz, vec2(0.28, 0.22));
        float swayFactor = smoothstep(-0.35, 1.15, aLeafCenter.y);
        float macroWave =
          sin(uWindPhase * 0.38 - spatialPhase) * 0.65 +
          sin(uWindPhase * 0.21 + spatialPhase * 0.55) * 0.35;
        float crownSway = (macroWave * 0.38 + uWindGust * 0.24) * windAmp * swayFactor;
        float leafFlutter =
          sin(uWindPhase * 1.18 + aLeafPlaneSeed * 6.2831853 + aLeafCenter.x * 0.85) *
          0.14 *
          windAmp *
          swayFactor;
        float sway = crownSway + leafFlutter;
        float vertBob =
          (cos(uWindPhase * 0.52 - spatialPhase) * 0.08 +
            sin(uWindPhase * 1.18 + aLeafPlaneSeed * 6.2831853) * 0.05) *
          windAmp *
          swayFactor;
        vec3 windDisp = vec3(
          uWindDirection.x * sway - uWindDirection.y * leafFlutter * 0.45,
          vertBob,
          uWindDirection.y * sway + uWindDirection.x * leafFlutter * 0.45
        );

        vec4 worldCenter = worldMat * vec4(aLeafCenter, 1.0);
        worldCenter.xyz += windDisp;
        vec4 mvCenter = viewMatrix * worldCenter;

        float angle =
          aLeafPlaneSeed * 6.2831853 +
          sin(uWindPhase * 0.95 + aLeafPlaneSeed * 19.3 + spatialPhase) * 0.22 * windAmp * swayFactor;
        float s = sin(angle);
        float c = cos(angle);
        vec2 scaledLocal = aLeafLocalPos.xy * cardWorldScale;
        float rotX = scaledLocal.x * c - scaledLocal.y * s;
        float rotY = scaledLocal.x * s + scaledLocal.y * c;

        vec4 mvPosition = mvCenter + vec4(rotX, rotY, (aLeafPlaneSeed - 0.5) * 0.04 * cardWorldScale, 0.0);

        vec3 col0 = worldMat[0].xyz;
        vec3 col1 = worldMat[1].xyz;
        vec3 col2 = worldMat[2].xyz;
        vec3 invScaleSq = vec3(
          1.0 / max(1e-4, dot(col0, col0)),
          1.0 / max(1e-4, dot(col1, col1)),
          1.0 / max(1e-4, dot(col2, col2))
        );
        vSphereNormal = normalize(mat3(worldMat) * (aLobeNormal * invScaleSq));
        vCrownHeight = smoothstep(-0.25, 1.35, aLeafCenter.y);
        vWestDepth01 = smoothstep(-120.0, -172.0, worldCenter.x);

        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uLeafTex;
      uniform float uAlphaThreshold;
      uniform vec3 uLightDirection;
      uniform vec3 uLightColor;
      uniform vec3 uShadowColor;

      varying vec2 vUv;
      varying vec3 vSphereNormal;
      varying float vCrownHeight;
      varying float vWestDepth01;
      varying vec3 vInstanceColor;
      #include <fog_pars_fragment>

      void main() {
        float mask = texture2D(uLeafTex, vUv).r;
        if (mask < uAlphaThreshold) discard;

        vec3 N = normalize(vSphereNormal);
        vec3 L = normalize(uLightDirection);
        float halfLambert = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
        float ndl = smoothstep(0.08, 0.94, halfLambert * 0.82 + vCrownHeight * 0.24);

        vec3 lightTint = mix(vec3(0.92), uLightColor, 0.62);
        float lightLuma = max(0.24, dot(uLightColor, vec3(0.299, 0.587, 0.114)));
        vec3 shadowTint = mix(vec3(0.55, 0.60, 0.72), uShadowColor * 1.38, 0.42);

        vec3 shadeCol = vInstanceColor * shadowTint * lightLuma * mix(0.84, 0.98, vCrownHeight);
        vec3 midCol = vInstanceColor * lightTint;
        vec3 sunCol = vInstanceColor * lightTint * 1.14 + vec3(0.035, 0.035, 0.015) * lightLuma * vCrownHeight;

        vec3 leafCol = mix(shadeCol, midCol, smoothstep(0.0, 0.58, ndl));
        leafCol = mix(leafCol, sunCol, smoothstep(0.54, 1.0, ndl));

        vec3 mistTint = vec3(0.46, 0.68, 0.88) * lightLuma;
        leafCol = mix(leafCol, mistTint, vWestDepth01 * 0.20);

        gl_FragColor = vec4(leafCol, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}

function createHorizonTrunkShaderMaterial(
  lightDirUniform: { value: THREE.Vector3 },
  lightColorUniform: { value: THREE.Color },
  shadowColorUniform: { value: THREE.Color },
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uBarkColor: { value: new THREE.Color('#6e4c36') },
      uLightDirection: lightDirUniform,
      uLightColor: lightColorUniform,
      uShadowColor: shadowColorUniform,
    },
    fog: true,
    vertexShader: /* glsl */ `
      varying vec3 vWorldNormal;
      varying float vHeight01;
      #include <fog_pars_vertex>

      void main() {
        #ifdef USE_INSTANCING
          mat4 worldMat = modelMatrix * instanceMatrix;
        #else
          mat4 worldMat = modelMatrix;
        #endif
        vec4 worldPosition = worldMat * vec4(position, 1.0);
        vec3 col0 = worldMat[0].xyz;
        vec3 col1 = worldMat[1].xyz;
        vec3 col2 = worldMat[2].xyz;
        vec3 invScaleSq = vec3(
          1.0 / max(1e-4, dot(col0, col0)),
          1.0 / max(1e-4, dot(col1, col1)),
          1.0 / max(1e-4, dot(col2, col2))
        );
        vWorldNormal = normalize(mat3(worldMat) * (normal * invScaleSq));
        vHeight01 = clamp(position.y, 0.0, 1.0);

        vec4 mvPosition = viewMatrix * worldPosition;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uBarkColor;
      uniform vec3 uLightDirection;
      uniform vec3 uLightColor;
      uniform vec3 uShadowColor;
      varying vec3 vWorldNormal;
      varying float vHeight01;
      #include <fog_pars_fragment>

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 L = normalize(uLightDirection);
        float halfLambert = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
        float softLit = smoothstep(0.05, 0.95, halfLambert);

        float lightLuma = max(0.24, dot(uLightColor, vec3(0.299, 0.587, 0.114)));
        vec3 lightTint = mix(vec3(0.92), uLightColor, 0.62);
        vec3 shadowTint = mix(vec3(0.52, 0.56, 0.66), uShadowColor * 1.25, 0.40);

        vec3 baseBark = uBarkColor * mix(0.76, 1.04, vHeight01);
        vec3 trunkCol = mix(baseBark * shadowTint * lightLuma, baseBark * lightTint, softLit);

        gl_FragColor = vec4(trunkCol, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}

/**
 * Builds the 60 FPS West cliff horizon backdrop (`<= 3` `InstancedMesh` draw calls total)
 * with high-segment smooth bell-dome hills (`>= 36` radial segments) and sakura-style
 * camera-facing billboard leaf-cluster trees along the West upper cliff crest behind
 * Tennis (`z ~ +90`), Central Plaza (`z ~ 0`), and Grand Casino (`z ~ -110`).
 */
export function buildHorizonCliffBackdrop3D(
  scene: THREE.Scene,
  options?: HorizonCliffBackdropOptions,
): HorizonCliffBackdropHandle {
  const rng = createSeededRng(20261118);
  const isCompact = Boolean(options?.isSoftwareGl);

  const group = new THREE.Group();
  group.name = 'HorizonWestCliffBackdrop';
  group.matrixAutoUpdate = false;
  group.updateMatrix();

  const windUniforms = options?.windUniforms;
  const lightDirUniform = windUniforms?.uLightDirection ?? {
    value: new THREE.Vector3(0.388, 0.808, 0.443).normalize(),
  };
  const lightColorUniform = windUniforms?.uLightColor ?? { value: new THREE.Color('#fff4c8') };
  const shadowColorUniform = windUniforms?.uShadowColor ?? { value: new THREE.Color('#3b6e52') };
  const windPhaseUniform = windUniforms?.uWindPhase ?? { value: 0 };
  const windDirUniform = windUniforms?.uWindDirection ?? { value: new THREE.Vector2(0.7071, 0.7071) };
  const windStrengthUniform = windUniforms?.uWindStrength ?? { value: 0.32 };
  const windGustUniform = windUniforms?.uWindGust ?? { value: 0.0 };

  let ownedFallbackLeafTex: THREE.DataTexture | null = null;
  const initialLeafTex =
    options?.leafMaskTexture ?? (ownedFallbackLeafTex = createFallbackHorizonLeafMaskTexture());

  const hillGeo = createSmoothHorizonHillGeometry(isCompact ? 36 : 44, isCompact ? 18 : 22);
  const canopyGeo = createHorizonSakuraCanopyGeometry(isCompact);

  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.34, 1.0, 10);
  trunkGeo.translate(0, 0.5, 0);
  trunkGeo.computeBoundingBox();
  trunkGeo.computeBoundingSphere();

  const hillMat = createHorizonHillsShaderMaterial(
    lightDirUniform,
    lightColorUniform,
    shadowColorUniform,
  );
  const canopyMat = createHorizonCanopyShaderMaterial(initialLeafTex, {
    uLightDirection: lightDirUniform,
    uLightColor: lightColorUniform,
    uShadowColor: shadowColorUniform,
    uWindPhase: windPhaseUniform,
    uWindDirection: windDirUniform,
    uWindStrength: windStrengthUniform,
    uWindGust: windGustUniform,
  });
  const trunkMat = createHorizonTrunkShaderMaterial(
    lightDirUniform,
    lightColorUniform,
    shadowColorUniform,
  );

  // Graduated atmospheric palette: warm lush greens in front -> sage mid-ridge -> misty cerulean-green horizon
  const crestGreens = ['#56b23e', '#62bc44', '#6ec442', '#4ea63a'];
  const midGreens = ['#4aa252', '#54ac5e', '#5eb46c', '#42964c'];
  const farGreens = ['#58a48c', '#66b29c', '#72bcac', '#4e9882'];

  const mounds: HillMoundSpec[] = [];

  const isClearOfCoastalRoadAndPlateaus = (
    cx: number,
    cz: number,
    rx: number,
    rz: number,
    roadMarginM: number,
    plateauMarginM: number,
  ): boolean => {
    const sampleOffsets: readonly [number, number][] = [
      [0, 0],
      [-0.82, 0],
      [0.82, 0],
      [0, -0.82],
      [0, 0.82],
      [-0.58, -0.58],
      [0.58, -0.58],
      [-0.58, 0.58],
      [0.58, 0.58],
    ];
    for (const [ox, oz] of sampleOffsets) {
      const px = cx + ox * rx;
      const pz = cz + oz * rz;
      if (evaluateHillVillaPlateauSdf(px, pz) < plateauMarginM) return false;
      if (evaluateCoastalHillRoadSample(px, pz).distToCenterM < roadMarginM) return false;
    }
    return true;
  };

  const pushValidMound = (
    x: number,
    z: number,
    rx: number,
    ry: number,
    rz: number,
    yaw: number,
    palette: readonly string[],
    minTier2 = 0.4,
  ) => {
    const tiers = evaluateEmbankmentTierOffsets(x, z);
    if (tiers.t2 < minTier2) return;
    // Keep outer backdrop hills completely clear of the Coastal Ridge Highway, its outer cut berm, and all 3 Villa Plateaus.
    if (!isClearOfCoastalRoadAndPlateaus(x, z, rx, rz, 8.2, 2.2)) return;
    const baseY = getBaseProceduralGroundElevation(x, z) - 1.25;
    const colorHex = palette[Math.floor(rng() * palette.length)];
    mounds.push({ x, z, baseY, rx, ry, rz, yaw, colorHex });
  };

  // Layer 1: Inner crest rolling hills west of the West Ridge Highway & West Villa Plateau
  const crestZStep = isCompact ? 15 : 11.5;
  for (let z = -134; z <= 134; z += crestZStep) {
    const zJitter = z + (rng() - 0.5) * 6;
    const behindVilla = Math.abs(zJitter) < 62;
    const xJitter = (behindVilla ? -161.5 : -146.5) - rng() * 9;
    pushValidMound(
      xJitter,
      zJitter,
      10.5 + rng() * 4.0,
      2.8 + rng() * 1.9,
      12.0 + rng() * 4.5,
      (rng() - 0.5) * 0.65,
      crestGreens,
      0.5,
    );
  }

  // Layer 2: Mid-ridge overlapping mountain lobes breaking up straight horizon line
  const midZStep = isCompact ? 17 : 13.5;
  for (let z = -148; z <= 148; z += midZStep) {
    const zJitter = z + (rng() - 0.5) * 8;
    const xJitter = -167.5 - rng() * 11;
    pushValidMound(
      xJitter,
      zJitter,
      15.5 + rng() * 6.0,
      5.6 + rng() * 3.4,
      17.0 + rng() * 6.5,
      (rng() - 0.5) * 0.85,
      midGreens,
      0.8,
    );
  }

  // Layer 3: Outer foothill massif covering x in [-174..-188] + NW/SW continuation
  const farZStep = isCompact ? 20 : 16;
  for (let z = -160; z <= 160; z += farZStep) {
    const zJitter = z + (rng() - 0.5) * 9;
    const xJitter = -175.0 - rng() * 14;
    pushValidMound(
      xJitter,
      zJitter,
      19.0 + rng() * 7.5,
      8.8 + rng() * 4.8,
      21.0 + rng() * 7.5,
      (rng() - 0.5) * 0.9,
      farGreens,
      1.0,
    );
  }

  // North & South outer Twin Peaks skyline mounds set cleanly back behind the N/S cut berms (|z| >= 171)
  for (const zSign of [-1, 1] as const) {
    const cornerXs = [-164, -144, -124, -104, -84, -64, -44, -22, 0, 22, 44];
    for (let i = 0; i < cornerXs.length; i++) {
      const cx = cornerXs[i] + (rng() - 0.5) * 6;
      const cz = zSign * (171.5 + (i < 3 ? 4 : 0) + rng() * 9);
      pushValidMound(
        cx,
        cz,
        16.5 + rng() * 6.0,
        2.8 + rng() * 2.0,
        15.0 + rng() * 5.0,
        (rng() - 0.5) * 0.7,
        i < 3 ? farGreens : midGreens,
        0.8,
      );
    }
  }

  // Build Mound InstancedMesh
  const hillMatrices: THREE.Matrix4[] = [];
  const hillColors: THREE.Color[] = [];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < mounds.length; i++) {
    const m = mounds[i];
    dummy.position.set(m.x, m.baseY, m.z);
    dummy.rotation.set(0, m.yaw, 0);
    dummy.scale.set(m.rx, m.ry, m.rz);
    dummy.updateMatrix();
    hillMatrices.push(dummy.matrix.clone());
    hillColors.push(new THREE.Color(m.colorHex));
  }

  const hillMoundsMesh = new THREE.InstancedMesh(
    hillGeo,
    hillMat,
    Math.max(1, hillMatrices.length),
  );
  hillMoundsMesh.name = 'HorizonWestHillMoundsInstanced';
  hillMoundsMesh.count = hillMatrices.length;
  hillMoundsMesh.castShadow = false;
  hillMoundsMesh.receiveShadow = false;
  for (let i = 0; i < hillMatrices.length; i++) {
    hillMoundsMesh.setMatrixAt(i, hillMatrices[i]);
    hillMoundsMesh.setColorAt(i, hillColors[i]);
  }
  hillMoundsMesh.instanceMatrix.needsUpdate = true;
  if (hillMoundsMesh.instanceColor) hillMoundsMesh.instanceColor.needsUpdate = true;
  computeInstancedBoundingVolumes(hillMoundsMesh, { padding: 1.5, frustumCulled: true });
  hillMoundsMesh.updateMatrix();
  hillMoundsMesh.matrixAutoUpdate = false;
  group.add(hillMoundsMesh);

  // Treeline palette: lush greens balanced with signature cityscape sakura pink & lilac accents
  const treePalette = [
    '#349a3c',
    '#42aa3e',
    '#4fb844',
    '#60c446',
    '#388e44',
    '#78c83e',
    '#2e863c',
    '#58b24c',
    '#f58cd8',
    '#ff9ee6',
    '#b474f0',
  ];

  const canopyMatrices: THREE.Matrix4[] = [];
  const canopyColors: THREE.Color[] = [];
  const trunkMatrices: THREE.Matrix4[] = [];

  const addBackdropTree = (x: number, z: number, scaleXZ: number, scaleY: number, trunkH: number) => {
    const tiers = evaluateEmbankmentTierOffsets(x, z);
    if (tiers.t2 < 0.35) return;
    // Keep strictly behind Tennis/Plaza/Casino edge
    if (Math.abs(z) < 92 && x > -112.5) return;
    // Never place backdrop trees onto coastal roads, switchback cuts, or overhanging road curbs
    if (evaluateHillVillaPlateauSdf(x, z) < Math.max(2.6, scaleXZ * 1.15)) return;
    if (evaluateCoastalHillRoadSample(x, z).distToCenterM < Math.max(6.85, 4.15 + scaleXZ * 1.35)) {
      return;
    }

    const surfY = evaluateMaxHillSurfaceY(x, z, mounds);
    const trunkBaseY = surfY - 0.45;
    const yaw = rng() * Math.PI * 2;

    dummy.position.set(x, trunkBaseY, z);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(scaleXZ * 0.56, trunkH + 0.65, scaleXZ * 0.56);
    dummy.updateMatrix();
    trunkMatrices.push(dummy.matrix.clone());

    dummy.position.set(x, trunkBaseY + trunkH * 0.78, z);
    dummy.rotation.set((rng() - 0.5) * 0.08, yaw, (rng() - 0.5) * 0.08);
    dummy.scale.set(scaleXZ, scaleY, scaleXZ * (0.9 + rng() * 0.22));
    dummy.updateMatrix();
    canopyMatrices.push(dummy.matrix.clone());

    const col = treePalette[Math.floor(rng() * treePalette.length)];
    canopyColors.push(new THREE.Color(col));
  };

  // Front bluff treeline nestled between Casino/Plaza/Tennis and West Ridge Highway inner cut
  const treeStepFront = isCompact ? 6.8 : 5.2;
  for (let z = -126; z <= 126; z += treeStepFront) {
    const tz = z + (rng() - 0.5) * 3.4;
    const tx = -112.4 - rng() * 3.8;
    const sXZ = 1.65 + rng() * 0.7;
    const sY = 2.1 + rng() * 1.2;
    const trunkH = 2.0 + rng() * 1.4;
    addBackdropTree(tx, tz, sXZ, sY, trunkH);
  }

  // Second elevated treeline west of West Ridge Highway & West Villa Plateau
  const treeStepBack = isCompact ? 7.6 : 5.8;
  for (let z = -138; z <= 138; z += treeStepBack) {
    const tz = z + (rng() - 0.5) * 4.2;
    const behindVilla = Math.abs(tz) < 58;
    const tx = (behindVilla ? -153.5 : -136.0) - rng() * 22.0;
    const sXZ = 2.8 + rng() * 1.8;
    const sY = 3.0 + rng() * 2.0;
    const trunkH = 2.4 + rng() * 1.8;
    addBackdropTree(tx, tz, sXZ, sY, trunkH);
  }

  // Extra dense treeline clusters behind Tennis (z in [35..88]), Plaza (z in [-35..+35]), and Casino (z in [-108..-42])
  const denseZones: Array<[number, number, number]> = [
    [34, 88, isCompact ? 12 : 18],
    [-34, 34, isCompact ? 10 : 16],
    [-108, -42, isCompact ? 12 : 18],
  ];
  for (const [zMin, zMax, count] of denseZones) {
    for (let k = 0; k < count; k++) {
      const tz = zMin + ((k + rng() * 0.8) / count) * (zMax - zMin);
      const isInner = k % 2 === 0;
      const behindVilla = Math.abs(tz) < 58;
      const tx = isInner
        ? -112.5 - rng() * 3.8
        : (behindVilla ? -153.5 : -136.5) - rng() * 18.0;
      const sXZ = isInner ? 1.65 + rng() * 0.7 : 2.6 + rng() * 1.6;
      const sY = isInner ? 2.1 + rng() * 1.1 : 2.8 + rng() * 1.8;
      const trunkH = 2.1 + rng() * 1.5;
      addBackdropTree(tx, tz, sXZ, sY, trunkH);
    }
  }

  // North & South outer ridge trees behind North/South Ridge Highways (|z| >= 151.5)
  for (const zSign of [-1, 1] as const) {
    const cornerTreeCount = isCompact ? 10 : 16;
    for (let k = 0; k < cornerTreeCount; k++) {
      const tx = -142 + (k / cornerTreeCount) * 188 + (rng() - 0.5) * 6;
      const tz = zSign * (152.0 + rng() * 16);
      const sXZ = 2.5 + rng() * 1.6;
      const sY = 2.7 + rng() * 1.8;
      addBackdropTree(tx, tz, sXZ, sY, 2.2 + rng() * 1.5);
    }
  }

  const treeCanopiesMesh = new THREE.InstancedMesh(
    canopyGeo,
    canopyMat,
    Math.max(1, canopyMatrices.length),
  );
  treeCanopiesMesh.name = 'HorizonWestTreelineCanopiesInstanced';
  treeCanopiesMesh.count = canopyMatrices.length;
  treeCanopiesMesh.castShadow = false;
  treeCanopiesMesh.receiveShadow = false;
  for (let i = 0; i < canopyMatrices.length; i++) {
    treeCanopiesMesh.setMatrixAt(i, canopyMatrices[i]);
    treeCanopiesMesh.setColorAt(i, canopyColors[i]);
  }
  treeCanopiesMesh.instanceMatrix.needsUpdate = true;
  if (treeCanopiesMesh.instanceColor) treeCanopiesMesh.instanceColor.needsUpdate = true;
  computeInstancedBoundingVolumes(treeCanopiesMesh, { padding: 1.5, frustumCulled: true });
  treeCanopiesMesh.updateMatrix();
  treeCanopiesMesh.matrixAutoUpdate = false;
  group.add(treeCanopiesMesh);

  const treeTrunksMesh = new THREE.InstancedMesh(
    trunkGeo,
    trunkMat,
    Math.max(1, trunkMatrices.length),
  );
  treeTrunksMesh.name = 'HorizonWestTreelineTrunksInstanced';
  treeTrunksMesh.count = trunkMatrices.length;
  treeTrunksMesh.castShadow = false;
  treeTrunksMesh.receiveShadow = false;
  for (let i = 0; i < trunkMatrices.length; i++) {
    treeTrunksMesh.setMatrixAt(i, trunkMatrices[i]);
  }
  treeTrunksMesh.instanceMatrix.needsUpdate = true;
  computeInstancedBoundingVolumes(treeTrunksMesh, { padding: 1.0, frustumCulled: true });
  treeTrunksMesh.updateMatrix();
  treeTrunksMesh.matrixAutoUpdate = false;
  group.add(treeTrunksMesh);

  scene.add(group);

  const instancedMeshes: readonly THREE.InstancedMesh[] = [
    hillMoundsMesh,
    treeCanopiesMesh,
    treeTrunksMesh,
  ];

  return {
    group,
    hillMoundsMesh,
    treeCanopiesMesh,
    treeTrunksMesh,
    instancedMeshes,
    getDrawCallCount: () => instancedMeshes.length,
    setLeafMaskTexture: (tex: THREE.Texture | null | undefined) => {
      if (!tex) return;
      canopyMat.uniforms.uLeafTex.value = tex;
      canopyMat.uniformsNeedUpdate = true;
    },
    dispose: () => {
      scene.remove(group);
      hillGeo.dispose();
      canopyGeo.dispose();
      trunkGeo.dispose();
      hillMat.dispose();
      canopyMat.dispose();
      trunkMat.dispose();
      if (ownedFallbackLeafTex) {
        ownedFallbackLeafTex.dispose();
        ownedFallbackLeafTex = null;
      }
    },
  };
}
