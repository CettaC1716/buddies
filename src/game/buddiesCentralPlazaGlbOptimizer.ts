import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  upgradeMeshToBlitzWorldMaterial,
  type BlitzWindUniforms,
} from './buddiesBlitzShadersAndAssets';

export interface PlazaBuildingGlowUniforms {
  uNightFactor: { value: number };
  uTime: { value: number };
}

export function createPlazaBuildingGlowUniforms(): PlazaBuildingGlowUniforms {
  return {
    uNightFactor: { value: 0 },
    uTime: { value: 0 },
  };
}

export interface OptimizeCentralPlazaGlbOptions {
  buildingId: string;
  glowUniforms: PlazaBuildingGlowUniforms;
  /** When provided (outdoor exterior GLBs), upgrades opaque walls/roofs to Blitz sky/moonlight world shader. */
  windUniforms?: BlitzWindUniforms;
  isSoftwareGl?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  glassWarmTintHex?: string;
  /** Optional exact GLTF node names (or regex matchers) to drop completely during optimization. */
  excludedNodeNames?: readonly (string | RegExp)[];
  /** Optional per-triangle filter evaluated on triangle centroids in gltfScene-local coordinates. */
  excludeTriangleCentroid?: (nodeName: string, localCentroid: THREE.Vector3) => boolean;
}

export interface CentralPlazaGlbOptimizationReport {
  buildingId: string;
  beforeDrawCalls: number;
  afterDrawCalls: number;
  savedDrawCalls: number;
  glowingGlassMaterials: number;
  glowingFixtureMaterials: number;
  zFightProtectedMaterials: number;
}

type GlbMaterialRole =
  | 'translucent_window_glass'
  | 'opaque_window_glass'
  | 'illuminated_window_display'
  | 'practical_light_fixture'
  | 'wall_decal_sign'
  | 'standard';

const TRANSLUCENT_GLASS_RE = /(?:^|_)(?:glass|window|pane|vitrine)(?:_|$)/i;
const OPAQUE_TINTED_GLASS_RE = /glass_upper_tinted|upper.*glass|tinted.*glass/i;
const WINDOW_DISPLAY_RE = /window_bakery_display|cafe_warm_interior|bakery.*display|interior.*glow/i;
const PRACTICAL_LIGHT_RE = /(?:^|_)(?:light|lantern|sconce|bulb|lamp_glow|hollywood)(?:_|$)/i;
const WALL_DECAL_SIGN_RE = /(?:^|_)(?:sign|chalkboard|menu|poster|aframe|mirror_vanity|door_open_sign)(?:_|$)/i;

function classifyGlbMaterialRole(
  mat: THREE.Material,
  sampleNodeName: string,
): GlbMaterialRole {
  const matName = (mat.name || '').trim();
  const combined = `${matName} ${sampleNodeName}`;
  const isTransparent = Boolean(mat.transparent) || mat.opacity < 0.99;

  if (PRACTICAL_LIGHT_RE.test(matName)) {
    return 'practical_light_fixture';
  }
  if (WINDOW_DISPLAY_RE.test(matName)) {
    return 'illuminated_window_display';
  }
  if (OPAQUE_TINTED_GLASS_RE.test(matName)) {
    return 'opaque_window_glass';
  }
  if (TRANSLUCENT_GLASS_RE.test(matName) || (isTransparent && /glass|window/i.test(combined))) {
    return isTransparent ? 'translucent_window_glass' : 'opaque_window_glass';
  }
  if (WALL_DECAL_SIGN_RE.test(matName)) {
    return 'wall_decal_sign';
  }
  return 'standard';
}

/**
 * Injects zero-extra-draw-call luminous window glow directly into an existing GLB
 * MeshStandardMaterial via `onBeforeCompile`, driven by the shared Central Plaza
 * `uNightFactor` & `uTime` uniforms.
 *
 * - Adds 0 meshes, 0 lights, and 0 draw calls.
 * - Daytime (`uNightFactor = 0`): warm luminous interior gleam + subtle glass Fresnel sheen.
 * - Dusk/Night (`uNightFactor -> 1`): rich boutique golden-amber interior radiance.
 */
function attachZeroDrawCallWindowGlow(
  mat: THREE.MeshStandardMaterial,
  role: 'translucent_window_glass' | 'opaque_window_glass' | 'illuminated_window_display' | 'practical_light_fixture',
  glowUniforms: PlazaBuildingGlowUniforms,
  warmTintHex: string,
): void {
  if (mat.userData.__plazaZeroDrawCallGlowAttached) return;
  mat.userData.__plazaZeroDrawCallGlowAttached = true;
  mat.userData.__plazaGlowRole = role;

  const warmTint = new THREE.Color(warmTintHex);
  const deepAmber = new THREE.Color('#ffaa4c');

  if (role === 'translucent_window_glass') {
    mat.transparent = true;
    mat.depthWrite = false;
    mat.opacity = Math.max(mat.opacity, 0.36);
    mat.roughness = Math.min(mat.roughness, 0.16);
    mat.metalness = Math.min(mat.metalness, 0.10);
    mat.emissive.copy(warmTint);
    mat.emissiveIntensity = 0.45;
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -1;
    mat.polygonOffsetUnits = -1;
  } else if (role === 'opaque_window_glass') {
    mat.roughness = Math.min(mat.roughness, 0.18);
    mat.metalness = Math.min(mat.metalness, 0.15);
    mat.emissive.copy(warmTint);
    mat.emissiveIntensity = 0.58;
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -0.5;
    mat.polygonOffsetUnits = -1;
  } else if (role === 'illuminated_window_display') {
    mat.emissive.copy(new THREE.Color('#fff2d6'));
    mat.emissiveIntensity = Math.max(mat.emissiveIntensity || 0.5, 0.65);
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -0.5;
    mat.polygonOffsetUnits = -1;
  } else if (role === 'practical_light_fixture') {
    mat.emissiveIntensity = Math.max(mat.emissiveIntensity || 1.0, 1.15);
  }

  const prevCompile = mat.onBeforeCompile;
  const prevCacheKey = mat.customProgramCacheKey?.bind(mat);

  mat.customProgramCacheKey = () => {
    const baseKey = prevCacheKey ? prevCacheKey() : '';
    return `${baseKey}_plaza_glow_${role}`;
  };

  const roleCode =
    role === 'translucent_window_glass'
      ? 0
      : role === 'opaque_window_glass'
        ? 1
        : role === 'illuminated_window_display'
          ? 2
          : 3;

  mat.onBeforeCompile = (shader, renderer) => {
    if (prevCompile) prevCompile(shader, renderer);
    shader.uniforms.uPlazaNightFactor = glowUniforms.uNightFactor;
    shader.uniforms.uPlazaGlowTime = glowUniforms.uTime;
    shader.uniforms.uPlazaWarmTint = { value: warmTint };
    shader.uniforms.uPlazaDeepAmber = { value: deepAmber };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vPlazaWorldPos;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vec4 plazaWp = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  plazaWp = instanceMatrix * plazaWp;
#endif
plazaWp = modelMatrix * plazaWp;
vPlazaWorldPos = plazaWp.xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uPlazaNightFactor;
uniform float uPlazaGlowTime;
uniform vec3 uPlazaWarmTint;
uniform vec3 uPlazaDeepAmber;
varying vec3 vPlazaWorldPos;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
{
  float nightT = clamp(uPlazaNightFactor, 0.0, 1.0);
  vec3 viewDirW = normalize(cameraPosition - vPlazaWorldPos);
  vec3 worldN = normalize(vec3(
    dot(normal, vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0])),
    dot(normal, vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1])),
    dot(normal, vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]))
  ));
  float ndotv = abs(dot(worldN, viewDirW));
  float fresnel = pow(1.0 - clamp(ndotv, 0.0, 1.0), 2.15);
  float verticalCurtain = 0.68 + 0.32 * smoothstep(0.5, 4.8, mod(vPlazaWorldPos.y, 5.2));
  float subtleBreath = 0.97 + 0.03 * sin(uPlazaGlowTime * 1.15 + vPlazaWorldPos.x * 0.25 + vPlazaWorldPos.z * 0.25);
  vec3 glowCol = mix(uPlazaWarmTint, uPlazaDeepAmber, 0.22 + 0.35 * nightT);
  ${
    roleCode === 0
      ? `
  // Translucent storefront & arched boutique glass: luminous warm veil + crisp rim glow
  float glowStrength = mix(0.42, 1.25, nightT) * verticalCurtain * subtleBreath;
  totalEmissiveRadiance = glowCol * (glowStrength + fresnel * mix(0.28, 0.55, nightT));
  diffuseColor.a = clamp(diffuseColor.a + mix(0.06, 0.24, nightT) + fresnel * 0.16, 0.34, 0.84);
  `
      : roleCode === 1
        ? `
  // Opaque upper-floor architectural glass: rich warm illuminated room glow with vertical gradient
  float roomCell = 0.86 + 0.14 * sin(floor(vPlazaWorldPos.x * 0.45) * 2.1 + floor(vPlazaWorldPos.z * 0.45) * 1.7);
  float glowStrength = mix(0.52, 1.48, nightT) * verticalCurtain * roomCell * subtleBreath;
  totalEmissiveRadiance = glowCol * (glowStrength + fresnel * 0.24);
  `
        : roleCode === 2
          ? `
  // Illuminated bakery/cafe interior window display: preserves painted interior art while warming smoothly
  float displayBoost = mix(0.32, 0.98, nightT) * subtleBreath;
  totalEmissiveRadiance += diffuseColor.rgb * glowCol * displayBoost;
  `
          : `
  // Practical sconces, lanterns & vanity bulbs: soft day warmth, radiant dusk/night glow
  totalEmissiveRadiance *= mix(1.0, 1.85, nightT) * subtleBreath;
  `
  }
}`,
      );
  };

  mat.needsUpdate = true;
}

function flipNonIndexedWinding(geo: THREE.BufferGeometry): void {
  const pos = geo.getAttribute('position');
  if (!pos || pos.count < 3) return;
  const attrs = Object.values(geo.attributes);
  for (let i = 0; i + 2 < pos.count; i += 3) {
    for (const attr of attrs) {
      const itemSize = attr.itemSize;
      for (let k = 0; k < itemSize; k++) {
        const idx1 = (i + 1) * itemSize + k;
        const idx2 = (i + 2) * itemSize + k;
        const arr = attr.array as Float32Array;
        const tmp = arr[idx1];
        arr[idx1] = arr[idx2];
        arr[idx2] = tmp;
      }
    }
  }
}

function filterTrianglesByCentroid(
  geo: THREE.BufferGeometry,
  nodeName: string,
  shouldExclude: (nodeName: string, localCentroid: THREE.Vector3) => boolean,
): THREE.BufferGeometry | null {
  const pos = geo.getAttribute('position');
  if (!pos || pos.count < 3) return geo;
  const keepTriIndices: number[] = [];
  const centroid = new THREE.Vector3();
  for (let i = 0; i + 2 < pos.count; i += 3) {
    centroid.set(
      (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3,
      (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3,
      (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3,
    );
    if (!shouldExclude(nodeName, centroid)) {
      keepTriIndices.push(i);
    }
  }
  const totalTris = Math.floor(pos.count / 3);
  if (keepTriIndices.length === totalTris) {
    return geo;
  }
  if (keepTriIndices.length === 0) {
    geo.dispose();
    return null;
  }
  const filtered = new THREE.BufferGeometry();
  const keptVerts = keepTriIndices.length * 3;
  for (const [attrName, attr] of Object.entries(geo.attributes)) {
    const itemSize = attr.itemSize;
    const src = attr.array as ArrayLike<number>;
    const dst = new Float32Array(keptVerts * itemSize);
    let writeOffset = 0;
    for (const triStart of keepTriIndices) {
      const startEl = triStart * itemSize;
      const countEl = 3 * itemSize;
      for (let k = 0; k < countEl; k++) {
        dst[writeOffset++] = src[startEl + k];
      }
    }
    filtered.setAttribute(attrName, new THREE.BufferAttribute(dst, itemSize));
  }
  geo.dispose();
  return filtered;
}

function buildMaterialSignature(
  mat: THREE.Material,
  role: GlbMaterialRole,
  castShadow: boolean,
  receiveShadow: boolean,
  renderOrder: number,
): string {
  const std = mat as THREE.MeshStandardMaterial;
  const hasAnyTexture = Boolean(
    std.map ||
      std.normalMap ||
      std.roughnessMap ||
      std.metalnessMap ||
      std.emissiveMap ||
      std.aoMap ||
      std.alphaMap,
  );
  // Textured materials keep strict reference identity (textures/UV transforms stay 1:1);
  // untextured PBR materials with identical visual parameters can safely share one draw call!
  if (hasAnyTexture || !(mat instanceof THREE.MeshStandardMaterial)) {
    return `ref:${mat.uuid}:${castShadow ? 1 : 0}:${receiveShadow ? 1 : 0}:${renderOrder}`;
  }
  const c = std.color.getHexString();
  const em = std.emissive.getHexString();
  return [
    'pbr',
    role,
    c,
    em,
    std.emissiveIntensity.toFixed(2),
    std.roughness.toFixed(2),
    std.metalness.toFixed(2),
    std.opacity.toFixed(2),
    std.transparent ? 1 : 0,
    std.depthWrite ? 1 : 0,
    std.side,
    std.vertexColors ? 1 : 0,
    std.polygonOffset ? `${std.polygonOffsetFactor}_${std.polygonOffsetUnits}` : '0',
    castShadow ? 1 : 0,
    receiveShadow ? 1 : 0,
    renderOrder,
  ].join('|');
}

/**
 * Optimizes an async-loaded Central Plaza GLB building in-place:
 * 1. Injects zero-extra-draw-call luminous glass & practical fixture shaders onto existing materials.
 * 2. Applies polygonOffset Z-fighting guards on flush wall signs, decals, mirrors & window panes.
 * 3. Merges all static submeshes sharing the same material (or identical untextured PBR signature)
 *    into single `THREE.Mesh` draw calls via `mergeGeometries`, slashing draw calls by ~60–75%.
 */
export function optimizeCentralPlazaBuildingGlb(
  gltfScene: THREE.Object3D,
  options: OptimizeCentralPlazaGlbOptions,
): CentralPlazaGlbOptimizationReport {
  const isSoftwareGl = Boolean(options.isSoftwareGl);
  const allowCastShadow = !isSoftwareGl && (options.castShadow ?? true);
  const allowReceiveShadow = !isSoftwareGl && (options.receiveShadow ?? true);
  const warmTintHex = options.glassWarmTintHex ?? '#ffdf9e';
  const excludedMatchers = options.excludedNodeNames ?? [];
  const isNodeExcluded = (name: string): boolean => {
    if (!name || excludedMatchers.length === 0) return false;
    return excludedMatchers.some((m) => (typeof m === 'string' ? m === name : m.test(name)));
  };

  gltfScene.updateMatrixWorld(true);
  const rootInv = gltfScene.matrixWorld.clone().invert();
  const relMatrix = new THREE.Matrix4();

  let beforeDrawCalls = 0;
  let glowingGlassMaterials = 0;
  let glowingFixtureMaterials = 0;
  let zFightProtectedMaterials = 0;

  const processedMaterials = new Map<THREE.Material, GlbMaterialRole>();
  const meshesToRemove: THREE.Mesh[] = [];
  const buckets = new Map<
    string,
    {
      material: THREE.Material;
      role: GlbMaterialRole;
      castShadow: boolean;
      receiveShadow: boolean;
      renderOrder: number;
      geos: THREE.BufferGeometry[];
    }
  >();

  gltfScene.traverse((obj) => {
    if (!obj.visible) return;
    if (!(obj instanceof THREE.Mesh)) return;
    if (obj instanceof THREE.SkinnedMesh || obj instanceof THREE.InstancedMesh) return;
    if (!obj.geometry || Array.isArray(obj.material)) return;

    const nodeName = obj.name || '';
    if (isNodeExcluded(nodeName)) {
      beforeDrawCalls++;
      meshesToRemove.push(obj);
      return;
    }

    const posAttr = obj.geometry.getAttribute('position');
    if (!posAttr || posAttr.count === 0) return;

    beforeDrawCalls++;
    const mat = obj.material as THREE.Material;

    let role = processedMaterials.get(mat);
    if (!role) {
      role = classifyGlbMaterialRole(mat, nodeName);
      processedMaterials.set(mat, role);

      if (mat instanceof THREE.MeshStandardMaterial) {
        if (
          role === 'translucent_window_glass' ||
          role === 'opaque_window_glass' ||
          role === 'illuminated_window_display'
        ) {
          attachZeroDrawCallWindowGlow(mat, role, options.glowUniforms, warmTintHex);
          glowingGlassMaterials++;
          zFightProtectedMaterials++;
        } else if (role === 'practical_light_fixture') {
          attachZeroDrawCallWindowGlow(mat, role, options.glowUniforms, warmTintHex);
          glowingFixtureMaterials++;
        } else if (role === 'wall_decal_sign') {
          mat.polygonOffset = true;
          mat.polygonOffsetFactor = -1;
          mat.polygonOffsetUnits = -2;
          mat.needsUpdate = true;
          zFightProtectedMaterials++;
        }
      }
    }

    const isGlassTransparent = role === 'translucent_window_glass' || Boolean(mat.transparent);
    const castShadow = allowCastShadow && !isGlassTransparent && role !== 'wall_decal_sign';
    const receiveShadow = allowReceiveShadow && !isGlassTransparent;
    const renderOrder = isGlassTransparent ? 2 : role === 'wall_decal_sign' ? 1 : 0;

    // Normalize geometry into non-indexed world-relative space with uniform attribute schema
    let g: THREE.BufferGeometry | null = obj.geometry.index
      ? obj.geometry.toNonIndexed()
      : obj.geometry.clone();
    if (!g) return;
    const gPos = g.getAttribute('position');
    if (!gPos || gPos.count === 0) {
      g.dispose();
      return;
    }
    if (!g.getAttribute('normal')) {
      g.computeVertexNormals();
    }
    if (!g.getAttribute('uv')) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(gPos.count * 2), 2));
    }

    const keepVertexColor = Boolean((mat as THREE.Material & { vertexColors?: boolean }).vertexColors);
    if (keepVertexColor && !g.getAttribute('color')) {
      const ones = new Float32Array(gPos.count * 3);
      ones.fill(1);
      g.setAttribute('color', new THREE.BufferAttribute(ones, 3));
    }
    for (const attrName of Object.keys(g.attributes)) {
      if (
        attrName !== 'position' &&
        attrName !== 'normal' &&
        attrName !== 'uv' &&
        (!keepVertexColor || attrName !== 'color')
      ) {
        g.deleteAttribute(attrName);
      }
    }

    relMatrix.multiplyMatrices(rootInv, obj.matrixWorld);
    if (relMatrix.determinant() < 0) {
      flipNonIndexedWinding(g);
    }
    g.applyMatrix4(relMatrix);

    if (options.excludeTriangleCentroid) {
      g = filterTrianglesByCentroid(g, nodeName, options.excludeTriangleCentroid);
      if (!g) {
        meshesToRemove.push(obj);
        return;
      }
    }

    const sig = buildMaterialSignature(mat, role, castShadow, receiveShadow, renderOrder);
    let bucket = buckets.get(sig);
    if (!bucket) {
      bucket = {
        material: mat,
        role,
        castShadow,
        receiveShadow,
        renderOrder,
        geos: [],
      };
      buckets.set(sig, bucket);
    }
    bucket.geos.push(g);
    meshesToRemove.push(obj);
  });

  // Remove old unmerged static meshes and dispose their individual geometries
  for (const oldMesh of meshesToRemove) {
    oldMesh.parent?.remove(oldMesh);
    oldMesh.geometry.dispose();
  }

  // Prune now-empty intermediate GLTF transform groups to keep the scene graph lean
  const pruneEmptyGroups = (node: THREE.Object3D): void => {
    for (let i = node.children.length - 1; i >= 0; i--) {
      const child = node.children[i];
      pruneEmptyGroups(child);
      if (
        child.children.length === 0 &&
        !(child instanceof THREE.Mesh) &&
        !(child instanceof THREE.Light)
      ) {
        node.remove(child);
      }
    }
  };
  pruneEmptyGroups(gltfScene);

  let afterDrawCalls = 0;
  for (const bucket of buckets.values()) {
    const mergedGeo =
      bucket.geos.length === 1 ? bucket.geos[0] : mergeGeometries(bucket.geos, false);
    if (bucket.geos.length > 1) {
      for (const g of bucket.geos) g.dispose();
    }
    if (!mergedGeo) continue;
    mergedGeo.computeBoundingBox();
    mergedGeo.computeBoundingSphere();

    const safeMatName = (bucket.material.name || bucket.role || 'Mat').replace(/[^a-zA-Z0-9_]/g, '_');
    const mergedMesh = new THREE.Mesh(mergedGeo, bucket.material);
    mergedMesh.name = `${options.buildingId}_Merged_${safeMatName}`;
    mergedMesh.castShadow = bucket.castShadow;
    mergedMesh.receiveShadow = bucket.receiveShadow;
    mergedMesh.renderOrder = bucket.renderOrder;
    mergedMesh.frustumCulled = true;
    mergedMesh.userData.plazaGlbOptimized = true;
    mergedMesh.userData.plazaGlowRole = bucket.role;
    // Upgrade outdoor opaque building architecture to Blitz sky/moonlight shader (matching Grand Casino & Municipal Hall)
    if (
      options.windUniforms &&
      (bucket.role === 'standard' || bucket.role === 'wall_decal_sign') &&
      !bucket.material.transparent
    ) {
      upgradeMeshToBlitzWorldMaterial(mergedMesh, options.windUniforms, undefined, 0.14);
    }
    gltfScene.add(mergedMesh);
    afterDrawCalls++;
  }

  const report: CentralPlazaGlbOptimizationReport = {
    buildingId: options.buildingId,
    beforeDrawCalls,
    afterDrawCalls,
    savedDrawCalls: Math.max(0, beforeDrawCalls - afterDrawCalls),
    glowingGlassMaterials,
    glowingFixtureMaterials,
    zFightProtectedMaterials,
  };
  gltfScene.userData.plazaOptimizationReport = report;
  return report;
}
