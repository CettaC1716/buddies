import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { IndividualCommanderBaseState } from './buddiesBlitzRules';
import {
  upgradeMeshToBlitzWorldMaterial,
  type BlitzWindUniforms,
} from './buddiesBlitzShadersAndAssets';
import {
  CITY_RENTAL_LOTS,
  CITY_RENTAL_LOT_SIZE_M,
  COMMERCIAL_SIDEWALK_STRIPS,
  SHOP_BILLBOARD_MESH_SPEC,
  SHOP_BUILDING_FORMS,
  STANDARD_SHOP_FOOTPRINT_SPEC,
  resolveCityRentalLotsState,
  type CityRentalLotSpec,
  type CityRentalLotStatus,
  type ShopBuildingFormId,
} from './buddiesCityRentalLotsRules';
import type { QaShopLiveTelemetrySummary, QaShopRenderMode } from './qaDirectorMode';

const LOT_SURFACE_Y = 0.09; // Matches URBAN_SIDEWALK_TOP_Y on the 4-sided commercial block plateau
const BUILDING_PAVING_TOP_Y = 0.104;
/** Local +Z placement for each lot's claim kiosk on the front sidewalk apron outside the 20x20m lot. */
export const LOT_CLAIM_KIOSK_LOCAL_Z = CITY_RENTAL_LOT_SIZE_M.halfDepth + 1.05;

export interface ShopKioskHologramRig {
  holoRoot: THREE.Group;
  holoTurntable: THREE.Group;
  holoSolidMat: THREE.MeshBasicMaterial;
  holoWireMat: THREE.LineBasicMaterial;
  holoRingMat: THREE.MeshBasicMaterial;
  holoBeamMat: THREE.MeshBasicMaterial;
  shopModels: Record<'default' | ShopBuildingFormId, THREE.Group>;
  loadingOverlayGroup: THREE.Group;
  outerHaloRing: THREE.Mesh;
  innerHaloRing: THREE.Mesh;
  scanBandMesh: THREE.Mesh;
  loadingBannerSprite: THREE.Sprite;
  loadingBannerCanvas: HTMLCanvasElement | null;
  loadingBannerTex: THREE.CanvasTexture | null;
  lastBannerKey: string;
  activeDisplayKey: 'default' | ShopBuildingFormId;
  formSwitchScale: number;
}

export interface CityRentalLotNodeController {
  spec: CityRentalLotSpec;
  lotRoot: THREE.Group;
  emptyMarkerGroup: THREE.Group;
  emptyTurfMesh: THREE.Mesh;
  claimKioskMesh: THREE.Group;
  kioskWorldX: number;
  kioskWorldZ: number;
  lotPavingMesh: THREE.Mesh;
  shopBuildingGroup: THREE.Group;
  glbBuildingMount: THREE.Group;
  loadedGlbFormId: ShopBuildingFormId | null;
  glbLoadStatus: 'idle' | 'loading' | 'loaded' | 'fallback';
  buildAnimStartSec: number;
  pendingGlbTemplate: THREE.Group | null;
  pendingLogoUrl: string | null;
  hologramRig: ShopKioskHologramRig | null;
  appliedBillboardLogoUrl: string | null;
  activeBillboardMats: THREE.MeshStandardMaterial[];
  highlightGroup: THREE.Group;
  qaBoundsGroup: THREE.Group;
  hitProxyMesh: THREE.Mesh;
  statusSignMat: THREE.MeshBasicMaterial;
  highlightRingMat: THREE.MeshBasicMaterial;
}

export interface CityRentalLotsVisualController {
  rootGroup: THREE.Group;
  lotNodes: ReadonlyArray<CityRentalLotNodeController>;
  hitProxyMeshes: ReadonlyArray<THREE.Mesh>;
  sync: (params: {
    isSafezoneMode: boolean;
    showOutdoor: boolean;
    blueCommanderBases?: ReadonlyArray<IndividualCommanderBaseState>;
    redCommanderBases?: ReadonlyArray<IndividualCommanderBaseState>;
    rentedSlotIds?: ReadonlySet<string> | ReadonlyArray<string>;
    lotStatusBySlotId?: Readonly<Record<string, CityRentalLotStatus>>;
    placedBuildingBySlotId?: Readonly<Record<string, ShopBuildingFormId | null | undefined>>;
    previewFormBySlotId?: Readonly<Record<string, ShopBuildingFormId | null | undefined>>;
    billboardLogoUrlBySlotId?: Readonly<Record<string, string | null | undefined>>;
    selectedSlotId?: string | null;
    hoveredSlotId?: string | null;
    previewAllBuildingsFit?: boolean;
    debugShopBounds3D?: boolean;
    timeSec?: number;
  }) => void;
  updateNightLighting: (nightFactor01: number, timeSec?: number) => void;
  getQaTelemetrySummary: () => QaShopLiveTelemetrySummary;
  dispose: () => void;
}

function createNeutralBillboardTexture(
  disposables: Array<{ dispose: () => void }>,
): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    const tex = new THREE.DataTexture(new Uint8Array([229, 231, 235, 255]), 1, 1);
    tex.needsUpdate = true;
    disposables.push(tex);
    return tex as unknown as THREE.CanvasTexture;
  }

  const canvas = document.createElement('canvas');
  canvas.width = SHOP_BILLBOARD_MESH_SPEC.textureWidthPx;
  canvas.height = SHOP_BILLBOARD_MESH_SPEC.textureHeightPx;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = SHOP_BILLBOARD_MESH_SPEC.defaultColorHex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  disposables.push(tex);
  return tex;
}

/**
 * Generates a soft 4-cone overhead spotlight wash texture for rooftop billboards at night.
 * Rendered with AdditiveBlending & zero real Three.js lights for 60 FPS performance.
 */
function createBillboardSpotlightWashTexture(
  disposables: Array<{ dispose: () => void }>,
): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    const tex = new THREE.DataTexture(new Uint8Array([255, 236, 185, 200]), 1, 1);
    tex.needsUpdate = true;
    disposables.push(tex);
    return tex as unknown as THREE.CanvasTexture;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 512, 192);
    const lampXs = [78, 194, 318, 434];
    for (let i = 0; i < lampXs.length; i++) {
      const lx = lampXs[i];
      const grad = ctx.createRadialGradient(lx, 6, 4, lx, 62, 128);
      grad.addColorStop(0.0, 'rgba(255, 246, 212, 0.92)');
      grad.addColorStop(0.32, 'rgba(255, 224, 150, 0.52)');
      grad.addColorStop(0.72, 'rgba(255, 200, 110, 0.16)');
      grad.addColorStop(1.0, 'rgba(255, 190, 95, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 192);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  disposables.push(tex);
  return tex;
}

function createLotGroundPlaqueTexture(
  shortCode: string,
  status: CityRentalLotStatus,
  disposables: Array<{ dispose: () => void }>,
): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    const tex = new THREE.DataTexture(new Uint8Array([20, 24, 32, 255]), 1, 1);
    tex.needsUpdate = true;
    disposables.push(tex);
    return tex as unknown as THREE.CanvasTexture;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const isRented = status === 'rented';
    ctx.fillStyle = isRented ? '#1e293b' : '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = isRented ? '#38bdf8' : '#b8ff3c';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

    ctx.fillStyle = isRented ? '#38bdf8' : '#b8ff3c';
    ctx.font = '900 24px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      isRented ? 'RENTED LOT' : 'RENTAL LOT · AVAILABLE',
      canvas.width * 0.5,
      44,
    );

    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 34px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      `LOT ${shortCode} · ${CITY_RENTAL_LOT_SIZE_M.width}×${CITY_RENTAL_LOT_SIZE_M.depth}M`,
      canvas.width * 0.5,
      88,
    );
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  disposables.push(tex);
  return tex;
}

function createRectOutlineGeometry(width: number, depth: number, y: number): THREE.BufferGeometry {
  const hw = width * 0.5;
  const hd = depth * 0.5;
  const positions = new Float32Array([
    -hw, y, -hd, hw, y, -hd,
    hw, y, -hd, hw, y, hd,
    hw, y, hd, -hw, y, hd,
    -hw, y, hd, -hw, y, -hd,
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geo;
}


/**
 * Normalizes a cloned BufferGeometry into non-indexed form with guaranteed consistent attributes
 * so `mergeGeometries` can aggressively collapse dozens of meshes into 1 draw call safely.
 */
function normalizeGeometryForMerge(
  source: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  options: { includeUv: boolean; vertexColor?: THREE.Color },
): THREE.BufferGeometry | null {
  const raw = source.index ? source.toNonIndexed() : source.clone();
  const posAttr = raw.getAttribute('position');
  if (!posAttr || posAttr.count === 0) {
    raw.dispose();
    return null;
  }

  raw.applyMatrix4(matrix);
  if (!raw.getAttribute('normal')) {
    raw.computeVertexNormals();
  }

  const out = new THREE.BufferGeometry();
  const bakedPos = raw.getAttribute('position');
  const bakedNorm = raw.getAttribute('normal');
  out.setAttribute('position', bakedPos.clone());
  out.setAttribute('normal', bakedNorm.clone());

  const vCount = bakedPos.count;
  if (options.includeUv) {
    const srcUv = raw.getAttribute('uv');
    if (srcUv && srcUv.count === vCount) {
      out.setAttribute('uv', srcUv.clone());
    } else {
      out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(vCount * 2), 2));
    }
  }

  if (options.vertexColor) {
    const colArr = new Float32Array(vCount * 3);
    const r = options.vertexColor.r;
    const g = options.vertexColor.g;
    const b = options.vertexColor.b;
    for (let i = 0; i < vCount; i++) {
      const o = i * 3;
      colArr[o] = r;
      colArr[o + 1] = g;
      colArr[o + 2] = b;
    }
    out.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  }

  raw.dispose();
  return out;
}

function mergeBucketOrNull(
  geos: THREE.BufferGeometry[],
  disposables: Array<{ dispose: () => void }>,
): THREE.BufferGeometry | null {
  if (geos.length === 0) return null;
  if (geos.length === 1) {
    const g = geos[0];
    g.computeBoundingBox();
    g.computeBoundingSphere();
    disposables.push(g);
    return g;
  }
  const merged = mergeGeometries(geos, false);
  for (let i = 0; i < geos.length; i++) {
    geos[i].dispose();
  }
  if (!merged) return null;
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  disposables.push(merged);
  return merged;
}

/**
 * Adds a compact 4-lamp overhead gooseneck spotlight bar + glowing bulbs + downward light-wash
 * directly above a rooftop billboard face so ALL 3 shop forms illuminate their rooftop signage at night.
 */
function buildBillboardOverheadSpotlightRig(
  bbCenterX: number,
  bbTopY: number,
  bbCenterY: number,
  bbFrontZ: number,
  bbWidth: number,
  bbHeight: number,
  includeArms: boolean,
  sharedMats: {
    lampHousingMat: THREE.Material;
    lampBulbMat: THREE.Material;
    billboardWashMat: THREE.Material;
  },
  disposables: Array<{ dispose: () => void }>,
): THREE.Group {
  const rig = new THREE.Group();
  rig.name = 'BillboardOverheadSpotlightRig';

  const armGeos: THREE.BufferGeometry[] = [];
  const bulbGeos: THREE.BufferGeometry[] = [];
  const mat4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();

  const lampCount = 4;
  const span = Math.max(2.0, bbWidth * 0.78);
  const armLen = 0.72;
  const lampY = bbTopY + 0.24;
  const lampZ = bbFrontZ + armLen;

  for (let i = 0; i < lampCount; i++) {
    const t = i / (lampCount - 1);
    const lx = bbCenterX + (t - 0.5) * span;

    if (includeArms) {
      // Horizontal gooseneck arm extending out over the front of the billboard
      const armBox = new THREE.BoxGeometry(0.08, 0.08, armLen);
      p.set(lx, lampY, bbFrontZ + armLen * 0.5);
      q.identity();
      mat4.compose(p, q, s);
      const normArm = normalizeGeometryForMerge(armBox, mat4, { includeUv: false });
      armBox.dispose();
      if (normArm) armGeos.push(normArm);

      // Angled spotlight hood aimed down at the billboard face
      const hoodBox = new THREE.BoxGeometry(0.32, 0.14, 0.26);
      p.set(lx, lampY - 0.04, lampZ);
      q.setFromEuler(new THREE.Euler(0.42, 0, 0));
      mat4.compose(p, q, s);
      const normHood = normalizeGeometryForMerge(hoodBox, mat4, { includeUv: false });
      hoodBox.dispose();
      if (normHood) armGeos.push(normHood);
    }

    // Glowing overhead spotlight lens/bulb
    const bulbGeo = new THREE.BoxGeometry(0.24, 0.08, 0.18);
    p.set(lx, lampY - 0.11, lampZ - 0.03);
    q.setFromEuler(new THREE.Euler(0.42, 0, 0));
    mat4.compose(p, q, s);
    const normBulb = normalizeGeometryForMerge(bulbGeo, mat4, { includeUv: false });
    bulbGeo.dispose();
    if (normBulb) bulbGeos.push(normBulb);
  }

  const mergedArms = mergeBucketOrNull(armGeos, disposables);
  if (mergedArms) {
    const armsMesh = new THREE.Mesh(mergedArms, sharedMats.lampHousingMat);
    armsMesh.name = 'BillboardSpotlightArms';
    rig.add(armsMesh);
  }

  const mergedBulbs = mergeBucketOrNull(bulbGeos, disposables);
  if (mergedBulbs) {
    const bulbsMesh = new THREE.Mesh(mergedBulbs, sharedMats.lampBulbMat);
    bulbsMesh.name = 'BillboardSpotlightBulbs';
    rig.add(bulbsMesh);
  }

  // Soft downward warm spotlight light-wash plane hovering 0.04m in front of the billboard face
  const washGeo = new THREE.PlaneGeometry(bbWidth * 1.02, bbHeight * 1.02);
  disposables.push(washGeo);
  const washMesh = new THREE.Mesh(washGeo, sharedMats.billboardWashMat);
  washMesh.name = 'BillboardSpotlightWash';
  washMesh.position.set(bbCenterX, bbCenterY, bbFrontZ + 0.045);
  washMesh.renderOrder = 3;
  rig.add(washMesh);

  return rig;
}

interface SharedShopLightingMaterials {
  showcaseGlassMat: THREE.MeshStandardMaterial;
  upperWindowMat: THREE.MeshStandardMaterial;
  canopyGlassMat: THREE.MeshLambertMaterial;
  fixtureLampMat: THREE.MeshStandardMaterial;
  lampHousingMat: THREE.MeshLambertMaterial;
  billboardWashMat: THREE.MeshBasicMaterial;
  stonePlinthMat: THREE.MeshLambertMaterial;
  darkFrameMat: THREE.MeshLambertMaterial;
  woodDeckMat: THREE.MeshLambertMaterial;
}

/**
 * Optimizes a loaded GLB shop building ONCE per form into a low-draw-call shared template:
 * - Scales by `spec.glbScale` and grounds flush at `spec.glbGroundOffsetY` so the shop fills its 20m x 20m lot.
 * - Merges all untextured opaque meshes into 1 single vertex-colored MeshLambertMaterial draw call.
 * - Merges textured opaque meshes grouped by shared baseColor texture (1 draw call per texture).
 * - Merges storefront & upper display windows into 1–2 night-glowing window draw calls.
 * - Merges built-in spotlight/soffit/lantern fixtures into 1 night-glowing lamp draw call.
 * - Preserves `rooftop_billboard_face` (`rooftop_billboard_mat`) standalone + adds overhead billboard spotlights!
 */
function optimizeShopGlbTemplate(
  rawScene: THREE.Group,
  formId: ShopBuildingFormId,
  sharedMats: SharedShopLightingMaterials,
  neutralBillboardTex: THREE.Texture,
  disposables: Array<{ dispose: () => void }>,
  windUniforms?: BlitzWindUniforms,
): THREE.Group {
  const spec = SHOP_BUILDING_FORMS[formId];
  rawScene.updateMatrixWorld(true);

  const scaleAndGround = new THREE.Matrix4().compose(
    new THREE.Vector3(0, spec.glbGroundOffsetY, 0),
    new THREE.Quaternion(),
    new THREE.Vector3(spec.glbScale, spec.glbScale, spec.glbScale),
  );

  const untexturedOpaqueGeos: THREE.BufferGeometry[] = [];
  const texturedOpaqueBuckets = new Map<
    THREE.Texture,
    { geos: THREE.BufferGeometry[]; color: THREE.Color }
  >();
  const showcaseGlassGeos: THREE.BufferGeometry[] = [];
  const upperWindowGeos: THREE.BufferGeometry[] = [];
  const canopyGlassGeos: THREE.BufferGeometry[] = [];
  const fixtureLampGeos: THREE.BufferGeometry[] = [];
  const billboardGeos: THREE.BufferGeometry[] = [];
  let hasBuiltInBillboardSpotlights = false;

  const bakedMatrix = new THREE.Matrix4();
  const fallbackColor = new THREE.Color('#d8d4cc');

  rawScene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const rawMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!rawMat) return;

    const meshName = mesh.name || '';
    const matName = rawMat.name || '';
    const combinedName = `${meshName} ${matName}`;

    bakedMatrix.multiplyMatrices(scaleAndGround, mesh.matrixWorld);

    // 1. Standalone Rooftop Billboard Face (replaceable per-lot logo + night illumination)
    if (
      meshName === SHOP_BILLBOARD_MESH_SPEC.meshName ||
      matName === SHOP_BILLBOARD_MESH_SPEC.materialName
    ) {
      const norm = normalizeGeometryForMerge(mesh.geometry, bakedMatrix, { includeUv: true });
      if (norm) billboardGeos.push(norm);
      return;
    }

    // 2. Overhead Billboard Spotlights, Soffit LEDs & Facade Lanterns
    if (/spot_warm_bulb|billboard_spotlight|lamp_amber|light_lens|soffit_warm_light/i.test(combinedName)) {
      if (/billboard_spotlight|spot_warm_bulb/i.test(combinedName)) {
        hasBuiltInBillboardSpotlights = true;
      }
      const norm = normalizeGeometryForMerge(mesh.geometry, bakedMatrix, { includeUv: false });
      if (norm) fixtureLampGeos.push(norm);
      return;
    }

    // 3. Frosted Overhead Canopy Glass (stays translucent, does not glow like showcase windows)
    if (/canopy_frosted|glass_canopy/i.test(combinedName)) {
      const norm = normalizeGeometryForMerge(mesh.geometry, bakedMatrix, { includeUv: false });
      if (norm) canopyGlassGeos.push(norm);
      return;
    }

    // 4. Storefront & Upper Showcase Windows (glow warm at dusk/night)
    if (/upper_window_interior|glass_upper_window|glass_window_upper/i.test(combinedName)) {
      const norm = normalizeGeometryForMerge(mesh.geometry, bakedMatrix, { includeUv: false });
      if (norm) upperWindowGeos.push(norm);
      return;
    }
    if (/glass_storefront_clear|clear_glass|glass_clear/i.test(combinedName)) {
      const norm = normalizeGeometryForMerge(mesh.geometry, bakedMatrix, { includeUv: false });
      if (norm) showcaseGlassGeos.push(norm);
      return;
    }

    // 5. Opaque Structural / Architectural Meshes (merged by texture or single vertex-color batch)
    const stdMat = rawMat as THREE.MeshStandardMaterial;
    const mapTex = stdMat.map ?? null;
    const baseColor = stdMat.color ? stdMat.color.clone() : fallbackColor.clone();

    if (mapTex) {
      let bucket = texturedOpaqueBuckets.get(mapTex);
      if (!bucket) {
        bucket = { geos: [], color: baseColor };
        texturedOpaqueBuckets.set(mapTex, bucket);
      }
      const norm = normalizeGeometryForMerge(mesh.geometry, bakedMatrix, { includeUv: true });
      if (norm) bucket.geos.push(norm);
    } else {
      const norm = normalizeGeometryForMerge(mesh.geometry, bakedMatrix, {
        includeUv: false,
        vertexColor: baseColor,
      });
      if (norm) untexturedOpaqueGeos.push(norm);
    }
  });

  const optimized = new THREE.Group();
  optimized.name = `OptimizedShopGlb_${formId}`;

  // 1) Single merged vertex-colored opaque structure mesh (1 draw call for all untextured parts!)
  const mergedUntextured = mergeBucketOrNull(untexturedOpaqueGeos, disposables);
  if (mergedUntextured) {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(mergedUntextured, mat);
    mesh.name = `ShopOpaqueSolid_${formId}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (windUniforms) {
      upgradeMeshToBlitzWorldMaterial(mesh, windUniforms, '#ffffff', 0.14);
      mat.dispose();
    } else {
      disposables.push(mat);
    }
    optimized.add(mesh);
  }

  // 2) Merged textured opaque buckets (1 draw call per unique texture)
  let texIdx = 0;
  for (const [tex, bucket] of texturedOpaqueBuckets.entries()) {
    const mergedTexGeo = mergeBucketOrNull(bucket.geos, disposables);
    if (!mergedTexGeo) continue;
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshLambertMaterial({
      map: tex,
      color: bucket.color,
    });
    const mesh = new THREE.Mesh(mergedTexGeo, mat);
    mesh.name = `ShopOpaqueTex_${formId}_${texIdx++}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (windUniforms) {
      upgradeMeshToBlitzWorldMaterial(mesh, windUniforms, undefined, 0.14);
      mat.dispose();
    } else {
      disposables.push(mat);
    }
    optimized.add(mesh);
  }

  // 3) Frosted canopy glass (1 draw call if present)
  const mergedCanopyGlass = mergeBucketOrNull(canopyGlassGeos, disposables);
  if (mergedCanopyGlass) {
    const mesh = new THREE.Mesh(mergedCanopyGlass, sharedMats.canopyGlassMat);
    mesh.name = `ShopCanopyGlass_${formId}`;
    optimized.add(mesh);
  }

  // 4) Storefront showcase windows (1 draw call, glows warm at dusk/night)
  const mergedShowcaseGlass = mergeBucketOrNull(showcaseGlassGeos, disposables);
  if (mergedShowcaseGlass) {
    const mesh = new THREE.Mesh(mergedShowcaseGlass, sharedMats.showcaseGlassMat);
    mesh.name = `ShopShowcaseGlass_${formId}`;
    mesh.renderOrder = 2;
    optimized.add(mesh);
  }

  // 5) Upper display windows (1 draw call, glows warm at dusk/night)
  const mergedUpperWindows = mergeBucketOrNull(upperWindowGeos, disposables);
  if (mergedUpperWindows) {
    const mesh = new THREE.Mesh(mergedUpperWindows, sharedMats.upperWindowMat);
    mesh.name = `ShopUpperWindows_${formId}`;
    optimized.add(mesh);
  }

  // 6) Built-in spotlight bulbs, facade lanterns & soffit LEDs (1 draw call, glows bright at night)
  const mergedLamps = mergeBucketOrNull(fixtureLampGeos, disposables);
  if (mergedLamps) {
    const mesh = new THREE.Mesh(mergedLamps, sharedMats.fixtureLampMat);
    mesh.name = `ShopFixtureLamps_${formId}`;
    optimized.add(mesh);
  }

  // 7) Standalone Rooftop Billboard Face + Overhead Billboard Spotlight Rig
  const mergedBillboard = mergeBucketOrNull(billboardGeos, disposables);
  let bbCenterX = 0;
  let bbCenterY = spec.billboard.centerYM;
  let bbTopY = spec.billboard.centerYM + spec.billboard.heightM * 0.5;
  let bbFrontZ = spec.billboard.offsetFrontZM;
  let bbWidth = spec.billboard.widthM;
  let bbHeight = spec.billboard.heightM;

  if (mergedBillboard) {
    const bbMat = new THREE.MeshStandardMaterial({
      map: neutralBillboardTex,
      emissiveMap: neutralBillboardTex,
      color: '#ffffff',
      emissive: new THREE.Color('#fff1d6'),
      emissiveIntensity: 0.0,
      roughness: 0.55,
      metalness: 0.0,
    });
    bbMat.name = SHOP_BILLBOARD_MESH_SPEC.materialName;
    disposables.push(bbMat);

    const bbMesh = new THREE.Mesh(mergedBillboard, bbMat);
    bbMesh.name = SHOP_BILLBOARD_MESH_SPEC.meshName;
    optimized.add(bbMesh);

    if (mergedBillboard.boundingBox) {
      const b = mergedBillboard.boundingBox;
      bbCenterX = (b.min.x + b.max.x) * 0.5;
      bbCenterY = (b.min.y + b.max.y) * 0.5;
      bbTopY = b.max.y;
      bbFrontZ = b.max.z;
      bbWidth = Math.max(2.0, b.max.x - b.min.x);
      bbHeight = Math.max(0.8, b.max.y - b.min.y);
    }
  }

  // Mount overhead billboard spotlight rig (adds gooseneck arms if GLB doesn't already have them, plus bulbs & warm light-wash)
  const spotlightRig = buildBillboardOverheadSpotlightRig(
    bbCenterX,
    bbTopY,
    bbCenterY,
    bbFrontZ,
    bbWidth,
    bbHeight,
    !hasBuiltInBillboardSpotlights,
    {
      lampHousingMat: sharedMats.lampHousingMat,
      lampBulbMat: sharedMats.fixtureLampMat,
      billboardWashMat: sharedMats.billboardWashMat,
    },
    disposables,
  );
  optimized.add(spotlightRig);

  // Dispose raw unmerged geometries & materials to free memory immediately
  rawScene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (let i = 0; i < mats.length; i++) {
      mats[i]?.dispose();
    }
  });

  return optimized;
}

const MIN_HOLOGRAM_BUILD_DURATION_SEC = 1.65;

const HOLO_FORM_SHORT_NAMES: Record<ShopBuildingFormId, string> = {
  glass_corner_3story: 'GLASS CORNER 3F',
  canopy_storefront_2story: 'CANOPY SHOP 2F',
  brick_rooftop_deck: 'BRICK DECK 2F',
};

interface SharedShopHologramGeometries {
  models: Record<'default' | ShopBuildingFormId, { solid: THREE.BufferGeometry; edges: THREE.EdgesGeometry }>;
  outerHaloGeo: THREE.TorusGeometry;
  innerHaloGeo: THREE.TorusGeometry;
  scanBandGeo: THREE.CylinderGeometry;
}

/**
 * Builds shared merged miniature architectural hologram geometries for the kiosk projector:
 * - default: crisp retail pavilion silhouette when idle
 * - glass_corner_3story: 3-story stepped corner tower with rooftop solar panels, dish & billboard
 * - canopy_storefront_2story: 2-story storefront with cantilevered wrap-around canopy & banner billboard
 * - brick_rooftop_deck: 2-story brick block with facade pilasters, rooftop terrace parapet & billboard
 */
function createSharedShopHologramGeometries(
  disposables: Array<{ dispose: () => void }>,
): SharedShopHologramGeometries {
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const pos = new THREE.Vector3();

  const buildHoloModel = (
    builder: (
      push: (
        geo: THREE.BufferGeometry,
        x: number,
        y: number,
        z: number,
        rotX?: number,
        rotY?: number,
        rotZ?: number,
      ) => void,
    ) => void,
  ): { solid: THREE.BufferGeometry; edges: THREE.EdgesGeometry } => {
    const geos: THREE.BufferGeometry[] = [];
    const push = (
      geo: THREE.BufferGeometry,
      x: number,
      y: number,
      z: number,
      rotX = 0,
      rotY = 0,
      rotZ = 0,
    ) => {
      pos.set(x, y, z);
      q.setFromEuler(new THREE.Euler(rotX, rotY, rotZ));
      m4.compose(pos, q, one);
      const norm = normalizeGeometryForMerge(geo, m4, { includeUv: false });
      geo.dispose();
      if (norm) geos.push(norm);
    };
    builder(push);
    const merged = mergeBucketOrNull(geos, disposables) ?? new THREE.BoxGeometry(0.4, 0.4, 0.4);
    merged.computeBoundingBox();
    if (merged.boundingBox) {
      const cx = (merged.boundingBox.min.x + merged.boundingBox.max.x) * 0.5;
      const cz = (merged.boundingBox.min.z + merged.boundingBox.max.z) * 0.5;
      const minY = merged.boundingBox.min.y;
      merged.translate(-cx, -minY, -cz);
      merged.computeBoundingBox();
      merged.computeBoundingSphere();
    }
    const edges = new THREE.EdgesGeometry(merged, 20);
    disposables.push(edges);
    return { solid: merged, edges };
  };

  // Default idle shop pavilion icon silhouette
  const defaultModel = buildHoloModel((push) => {
    push(new THREE.BoxGeometry(0.56, 0.05, 0.56), 0, 0.025, 0);
    push(new THREE.BoxGeometry(0.44, 0.34, 0.38), 0, 0.22, -0.02);
    push(new THREE.BoxGeometry(0.48, 0.05, 0.14), 0, 0.31, 0.22, 0.22);
    push(new THREE.BoxGeometry(0.32, 0.12, 0.04), 0, 0.46, 0.14);
  });

  // 1) Glass Corner 3-Story Tower
  const glassCornerModel = buildHoloModel((push) => {
    // Architectural terrace plinth
    push(new THREE.BoxGeometry(0.66, 0.04, 0.66), 0, 0.02, 0);
    // Core 3-story stepped volume + prominent horizontal floor slab bands
    push(new THREE.BoxGeometry(0.46, 0.72, 0.46), 0, 0.40, 0);
    for (const slabY of [0.28, 0.52, 0.76]) {
      push(new THREE.BoxGeometry(0.52, 0.032, 0.52), 0, slabY, 0);
    }
    // Corner vertical bronze/glass mullions
    for (const mx of [-0.24, 0.0, 0.24]) {
      push(new THREE.BoxGeometry(0.028, 0.72, 0.028), mx, 0.40, 0.24);
    }
    // Rooftop solar panel array + satellite dish + rooftop billboard
    push(new THREE.BoxGeometry(0.28, 0.02, 0.16), -0.08, 0.84, -0.08, 0.34);
    push(new THREE.CylinderGeometry(0.06, 0.015, 0.05, 8), 0.14, 0.85, -0.10, 0.45);
    push(new THREE.BoxGeometry(0.42, 0.14, 0.03), 0, 0.88, 0.21);
  });

  // 2) Canopy Storefront 2-Story
  const canopyModel = buildHoloModel((push) => {
    // Terrace base
    push(new THREE.BoxGeometry(0.68, 0.04, 0.68), 0, 0.02, 0);
    // Ground floor recessed storefront + wide cantilevered wrap-around steel canopy
    push(new THREE.BoxGeometry(0.46, 0.24, 0.44), 0, 0.16, -0.02);
    push(new THREE.BoxGeometry(0.62, 0.045, 0.56), 0, 0.29, 0.04);
    // Upper limestone volume + roof cornice
    push(new THREE.BoxGeometry(0.50, 0.28, 0.46), 0, 0.45, -0.01);
    push(new THREE.BoxGeometry(0.54, 0.04, 0.50), 0, 0.60, -0.01);
    // Elevated horizontal rooftop banner billboard + support posts
    push(new THREE.BoxGeometry(0.025, 0.09, 0.025), -0.16, 0.66, 0.16);
    push(new THREE.BoxGeometry(0.025, 0.09, 0.025), 0.16, 0.66, 0.16);
    push(new THREE.BoxGeometry(0.46, 0.12, 0.03), 0, 0.74, 0.18);
  });

  // 3) Brick Block with Rooftop Deck
  const brickDeckModel = buildHoloModel((push) => {
    // Terrace base
    push(new THREE.BoxGeometry(0.66, 0.04, 0.66), 0, 0.02, 0);
    // 2-story solid brick mass + corner pilasters
    push(new THREE.BoxGeometry(0.48, 0.52, 0.46), 0, 0.30, 0);
    for (const px of [-0.24, 0.24]) {
      for (const pz of [-0.23, 0.23]) {
        push(new THREE.BoxGeometry(0.055, 0.54, 0.055), px, 0.31, pz);
      }
    }
    // Rooftop timber deck perimeter parapet railings
    push(new THREE.BoxGeometry(0.48, 0.08, 0.025), 0, 0.60, 0.22);
    push(new THREE.BoxGeometry(0.48, 0.08, 0.025), 0, 0.60, -0.22);
    push(new THREE.BoxGeometry(0.025, 0.08, 0.44), -0.23, 0.60, 0);
    push(new THREE.BoxGeometry(0.025, 0.08, 0.44), 0.23, 0.60, 0);
    // Rooftop planter accent + panoramic billboard
    push(new THREE.BoxGeometry(0.11, 0.06, 0.11), -0.14, 0.60, -0.12);
    push(new THREE.BoxGeometry(0.48, 0.13, 0.03), 0, 0.72, 0.19);
  });

  const outerHaloGeo = new THREE.TorusGeometry(0.48, 0.016, 8, 36);
  const innerHaloGeo = new THREE.TorusGeometry(0.38, 0.012, 8, 32);
  const scanBandGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.055, 24, 1, true);
  disposables.push(outerHaloGeo, innerHaloGeo, scanBandGeo);

  return {
    models: {
      default: defaultModel,
      glass_corner_3story: glassCornerModel,
      canopy_storefront_2story: canopyModel,
      brick_rooftop_deck: brickDeckModel,
    },
    outerHaloGeo,
    innerHaloGeo,
    scanBandGeo,
  };
}

function drawHoloLoadingBanner(
  canvas: HTMLCanvasElement,
  tex: THREE.CanvasTexture,
  title: string,
  progress01: number,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const pct = Math.max(0, Math.min(100, Math.round(progress01 * 100)));

  ctx.clearRect(0, 0, w, h);

  // Sleek translucent frosted dark glass rounded card matching Cerria OS aesthetic
  const r = 18;
  ctx.beginPath();
  ctx.moveTo(r + 4, 4);
  ctx.lineTo(w - r - 4, 4);
  ctx.quadraticCurveTo(w - 4, 4, w - 4, r + 4);
  ctx.lineTo(w - 4, h - r - 4);
  ctx.quadraticCurveTo(w - 4, h - 4, w - r - 4, h - 4);
  ctx.lineTo(r + 4, h - 4);
  ctx.quadraticCurveTo(4, h - 4, 4, h - r - 4);
  ctx.lineTo(4, r + 4);
  ctx.quadraticCurveTo(4, 4, r + 4, 4);
  ctx.closePath();

  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.90)');
  bgGrad.addColorStop(1, 'rgba(12, 18, 32, 0.94)');
  ctx.fillStyle = bgGrad;
  ctx.fill();

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.72)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Top label row: "BUILDING" + live percentage
  ctx.font = '700 16px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#67e8f9';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('BUILDING SHOP', 20, 28);

  ctx.font = '800 18px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#34d399';
  ctx.textAlign = 'right';
  ctx.fillText(`${pct}%`, w - 20, 28);

  // Building form subtitle
  ctx.font = '700 18px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'left';
  ctx.fillText(title, 20, 56);

  // Progress bar track
  const barX = 20;
  const barY = 78;
  const barW = w - 40;
  const barH = 12;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 6);
  ctx.fill();

  // Animated cyan -> emerald fill
  const fillW = Math.max(12, Math.round(barW * Math.max(0.04, progress01)));
  const fillGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  fillGrad.addColorStop(0, '#38bdf8');
  fillGrad.addColorStop(1, '#34d399');
  ctx.fillStyle = fillGrad;
  ctx.beginPath();
  ctx.roundRect(barX, barY, fillW, barH, 6);
  ctx.fill();

  tex.needsUpdate = true;
}

function attachShopHologramRigToKiosk(
  claimKioskMesh: THREE.Group,
  sharedHoloGeos: SharedShopHologramGeometries,
  disposables: Array<{ dispose: () => void }>,
): ShopKioskHologramRig | null {
  const sideHolo = claimKioskMesh.userData?.sideHologram as
    | {
        holoRoot: THREE.Group;
        holoTurntable: THREE.Group;
        holoModels: Record<string, THREE.Group>;
        holoSolidMat: THREE.MeshBasicMaterial;
        holoWireMat: THREE.LineBasicMaterial;
        holoRingMat: THREE.MeshBasicMaterial;
        holoBeamMat: THREE.MeshBasicMaterial;
      }
    | undefined;
  if (!sideHolo) return null;

  // Hide all warzone weapon/buddy hologram meshes on commercial shop lot kiosks
  for (const grp of Object.values(sideHolo.holoModels)) {
    grp.visible = false;
  }

  sideHolo.holoRoot.visible = true;
  sideHolo.holoTurntable.position.set(0, 0.42, 0);

  const shopModels = {} as Record<'default' | ShopBuildingFormId, THREE.Group>;
  const keys: Array<'default' | ShopBuildingFormId> = [
    'default',
    'glass_corner_3story',
    'canopy_storefront_2story',
    'brick_rooftop_deck',
  ];
  for (const key of keys) {
    const geomPair = sharedHoloGeos.models[key];
    const grp = new THREE.Group();
    grp.name = `ShopHoloModel_${key}`;
    const solidMesh = new THREE.Mesh(geomPair.solid, sideHolo.holoSolidMat);
    const wireMesh = new THREE.LineSegments(geomPair.edges, sideHolo.holoWireMat);
    wireMesh.scale.setScalar(1.012);
    grp.add(solidMesh, wireMesh);
    grp.scale.setScalar(1.25);
    grp.visible = key === 'default';
    sideHolo.holoTurntable.add(grp);
    shopModels[key] = grp;
  }

  // Aesthetic loading state rig positioned around & above the hologram
  const loadingOverlayGroup = new THREE.Group();
  loadingOverlayGroup.name = 'ShopHoloLoadingOverlay';
  loadingOverlayGroup.visible = false;
  sideHolo.holoRoot.add(loadingOverlayGroup);

  const outerHaloMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const innerHaloMat = new THREE.MeshBasicMaterial({
    color: '#34d399',
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  });
  const scanBandMat = new THREE.MeshBasicMaterial({
    color: '#5eead4',
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  disposables.push(outerHaloMat, innerHaloMat, scanBandMat);

  const outerHaloRing = new THREE.Mesh(sharedHoloGeos.outerHaloGeo, outerHaloMat);
  outerHaloRing.position.set(0, 0.92, 0);
  outerHaloRing.rotation.x = Math.PI * 0.38;
  loadingOverlayGroup.add(outerHaloRing);

  const innerHaloRing = new THREE.Mesh(sharedHoloGeos.innerHaloGeo, innerHaloMat);
  innerHaloRing.position.set(0, 0.92, 0);
  innerHaloRing.rotation.x = -Math.PI * 0.34;
  loadingOverlayGroup.add(innerHaloRing);

  const scanBandMesh = new THREE.Mesh(sharedHoloGeos.scanBandGeo, scanBandMat);
  scanBandMesh.position.set(0, 0.65, 0);
  loadingOverlayGroup.add(scanBandMesh);

  let loadingBannerCanvas: HTMLCanvasElement | null = null;
  let loadingBannerTex: THREE.CanvasTexture | null = null;
  const bannerMat = new THREE.SpriteMaterial({
    transparent: true,
    depthWrite: false,
  });
  if (typeof document !== 'undefined') {
    loadingBannerCanvas = document.createElement('canvas');
    loadingBannerCanvas.width = 320;
    loadingBannerCanvas.height = 108;
    loadingBannerTex = new THREE.CanvasTexture(loadingBannerCanvas);
    loadingBannerTex.colorSpace = THREE.SRGBColorSpace;
    bannerMat.map = loadingBannerTex;
    disposables.push(loadingBannerTex);
  }
  disposables.push(bannerMat);

  const loadingBannerSprite = new THREE.Sprite(bannerMat);
  loadingBannerSprite.name = 'ShopHoloLoadingBanner';
  loadingBannerSprite.position.set(0, 2.04, 0);
  loadingBannerSprite.scale.set(2.1, 0.71, 1);
  loadingBannerSprite.renderOrder = 10;
  loadingOverlayGroup.add(loadingBannerSprite);

  return {
    holoRoot: sideHolo.holoRoot,
    holoTurntable: sideHolo.holoTurntable,
    holoSolidMat: sideHolo.holoSolidMat,
    holoWireMat: sideHolo.holoWireMat,
    holoRingMat: sideHolo.holoRingMat,
    holoBeamMat: sideHolo.holoBeamMat,
    shopModels,
    loadingOverlayGroup,
    outerHaloRing,
    innerHaloRing,
    scanBandMesh,
    loadingBannerSprite,
    loadingBannerCanvas,
    loadingBannerTex,
    lastBannerKey: '',
    activeDisplayKey: 'default',
    formSwitchScale: 1,
  };
}

/**
 * Builds the 3D scene representation for all 16 city rental lots (20m x 20m filling 100% of each block interior):
 * - Visually distinct full-lot Building Paving ("Trotoar Bangunan") flush with the 4-sided curbed City Sidewalk ("Trotoar Kota").
 * - Aggressively merged low-draw-call GLB & procedural shop buildings (~5–9 draw calls per building).
 * - Nighttime glowing storefront/showcase windows & overhead rooftop billboard spotlights (0 extra Three.js lights).
 * - Interactive hover/selection rings & optional 3D QA bounds overlay.
 */
export function buildCityRentalLotsVisuals(options?: {
  createKioskMesh?: () => THREE.Group;
  windUniforms?: BlitzWindUniforms;
}): CityRentalLotsVisualController {
  const windUniforms = options?.windUniforms;
  const rootGroup = new THREE.Group();
  rootGroup.name = 'CityRentalLotsSystemRoot';

  const disposables: Array<{ dispose: () => void }> = [];
  const regGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const regMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  const lotW = CITY_RENTAL_LOT_SIZE_M.width;
  const lotD = CITY_RENTAL_LOT_SIZE_M.depth;
  const halfLotW = CITY_RENTAL_LOT_SIZE_M.halfWidth;
  const halfLotD = CITY_RENTAL_LOT_SIZE_M.halfDepth;

  // Full-lot Building Paving ("Trotoar Bangunan"): solid 19.98m x 19.98m architectural terrace slab
  // filling 100% of the lot land flush to neighboring lots & the inner granite curb of Trotoar Kota
  const lotPavingGeo = regGeo(new THREE.BoxGeometry(lotW - 0.02, 0.044, lotD - 0.02));
  const emptyTurfGeo = regGeo(new THREE.BoxGeometry(lotW - 0.04, 0.036, lotD - 0.04));

  const groundPlaqueFaceGeo = regGeo(new THREE.PlaneGeometry(3.1, 0.96));
  groundPlaqueFaceGeo.rotateX(-Math.PI * 0.5);

  // Highlight ring along the 20.0m x 20.0m lot perimeter
  const highlightNSGeo = regGeo(new THREE.PlaneGeometry(lotW, 0.34));
  highlightNSGeo.rotateX(-Math.PI * 0.5);
  const highlightEWGeo = regGeo(new THREE.PlaneGeometry(0.34, lotD - 0.68));
  highlightEWGeo.rotateX(-Math.PI * 0.5);

  // Shared 3D QA Bounds Overlay Geometries & Materials (20m lot, 19.6m package cap)
  const qaLotOutlineGeo = regGeo(createRectOutlineGeometry(lotW, lotD, BUILDING_PAVING_TOP_Y + 0.04));
  const qaCapOutlineGeo = regGeo(
    createRectOutlineGeometry(
      STANDARD_SHOP_FOOTPRINT_SPEC.width,
      STANDARD_SHOP_FOOTPRINT_SPEC.depth,
      BUILDING_PAVING_TOP_Y + 0.05,
    ),
  );
  const qaLotOutlineMat = regMat(new THREE.LineBasicMaterial({ color: '#22d3ee' }));
  const qaCapOutlineMat = regMat(new THREE.LineBasicMaterial({ color: '#fbbf24' }));

  // Shared flat white lot boundary markings (visible cleanly on unbuilt lots)
  const whiteLineMat = regMat(
    new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.84,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  const whiteLineNSGeo = regGeo(new THREE.PlaneGeometry(lotW, 0.2));
  whiteLineNSGeo.rotateX(-Math.PI * 0.5);
  const whiteLineEWGeo = regGeo(new THREE.PlaneGeometry(0.2, lotD));
  whiteLineEWGeo.rotateX(-Math.PI * 0.5);
  const frontWhiteSegmentGeo = regGeo(new THREE.PlaneGeometry(6.0, 0.2));
  frontWhiteSegmentGeo.rotateX(-Math.PI * 0.5);

  // Invisible hit proxy for raycasting clicks/hovers across the 20.0m x 20.0m lot
  const hitProxyGeo = regGeo(new THREE.PlaneGeometry(lotW, lotD));
  hitProxyGeo.rotateX(-Math.PI * 0.5);
  const hitProxyMat = regMat(
    new THREE.MeshBasicMaterial({
      visible: false,
      side: THREE.DoubleSide,
    }),
  );

  // Shared Night-Reactive Showcase Glass, Lamps & Billboard Spotlight Wash Materials
  const billboardWashTex = createBillboardSpotlightWashTexture(disposables);
  const sharedShopMats: SharedShopLightingMaterials = {
    showcaseGlassMat: regMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#c8e4f4'),
        emissive: new THREE.Color('#ffbe55'),
        emissiveIntensity: 0.0,
        roughness: 0.14,
        metalness: 0.12,
        transparent: true,
        opacity: 0.44,
        side: THREE.DoubleSide,
      }),
    ),
    upperWindowMat: regMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#3b4c63'),
        emissive: new THREE.Color('#f7ad3b'),
        emissiveIntensity: 0.0,
        roughness: 0.22,
        metalness: 0.1,
      }),
    ),
    canopyGlassMat: regMat(
      new THREE.MeshLambertMaterial({
        color: '#d8ecf8',
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    ),
    fixtureLampMat: regMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#e2e8f0'),
        emissive: new THREE.Color('#ffe6a6'),
        emissiveIntensity: 0.05,
        roughness: 0.25,
        metalness: 0.0,
      }),
    ),
    lampHousingMat: regMat(new THREE.MeshLambertMaterial({ color: '#1e2430' })),
    billboardWashMat: regMat(
      new THREE.MeshBasicMaterial({
        map: billboardWashTex,
        color: new THREE.Color('#ffe5ad'),
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    ),
    stonePlinthMat: regMat(new THREE.MeshLambertMaterial({ color: '#94a3b8' })),
    darkFrameMat: regMat(new THREE.MeshLambertMaterial({ color: '#1e293b' })),
    woodDeckMat: regMat(new THREE.MeshLambertMaterial({ color: '#8b5a2b' })),
  };
  sharedShopMats.billboardWashMat.visible = false;

  const sharedHoloGeos = createSharedShopHologramGeometries(disposables);

  /**
   * Visually distinct Building Paving ("Trotoar Bangunan") textures:
   * Warm architectural travertine/sandstone/terracotta terrace stone framed by a dark coping border,
   * unmistakably distinct from the cool-grey flagstone City Block Sidewalk ("Trotoar Kota").
   */
  const createBuildingFormPavingMat = (
    baseHex: string,
    groutHex: string,
    accentHex: string,
    borderHex: string,
    tileCount: number,
  ): THREE.Material => {
    const makeWorldMat = (fallback: THREE.MeshLambertMaterial, tintHex?: string): THREE.Material => {
      if (!windUniforms) return regMat(fallback);
      const tmpGeo = new THREE.BufferGeometry();
      const tmpMesh = new THREE.Mesh(tmpGeo, fallback);
      upgradeMeshToBlitzWorldMaterial(tmpMesh, windUniforms, tintHex, 0.08);
      fallback.dispose();
      tmpGeo.dispose();
      return tmpMesh.material as THREE.Material;
    };
    if (typeof document === 'undefined') {
      return makeWorldMat(new THREE.MeshLambertMaterial({ color: baseHex }), baseHex);
    }
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = baseHex;
      ctx.fillRect(0, 0, 512, 512);

      // Architectural staggered paver tiles
      const step = 512 / tileCount;
      ctx.fillStyle = accentHex;
      for (let gy = 0; gy < tileCount; gy++) {
        for (let gx = 0; gx < tileCount; gx++) {
          ctx.globalAlpha = (gx + gy) % 2 === 0 ? 0.22 : 0.08;
          ctx.fillRect(gx * step + 3, gy * step + 3, step - 6, step - 6);
        }
      }
      ctx.globalAlpha = 1.0;

      // Crisp mortar joints
      ctx.strokeStyle = groutHex;
      ctx.lineWidth = 3;
      for (let gx = 0; gx <= tileCount; gx++) {
        ctx.beginPath();
        ctx.moveTo(gx * step, 0);
        ctx.lineTo(gx * step, 512);
        ctx.stroke();
      }
      for (let gy = 0; gy <= tileCount; gy++) {
        ctx.beginPath();
        ctx.moveTo(0, gy * step);
        ctx.lineTo(512, gy * step);
        ctx.stroke();
      }

      // Perimeter architectural trim border clearly framing each building's private terrace paving
      ctx.strokeStyle = borderHex;
      ctx.lineWidth = 18;
      ctx.strokeRect(9, 9, 494, 494);
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 3;
      ctx.strokeRect(22, 22, 468, 468);
      ctx.globalAlpha = 1.0;
    }
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    tex.colorSpace = THREE.SRGBColorSpace;
    disposables.push(tex);
    return makeWorldMat(new THREE.MeshLambertMaterial({ map: tex }), '#ffffff');
  };

  const lotPavingMatByForm: Record<ShopBuildingFormId, THREE.Material> = {
    glass_corner_3story: createBuildingFormPavingMat(
      '#ddd6c8',
      '#b5ab9b',
      '#ede7dc',
      '#647082',
      10,
    ),
    canopy_storefront_2story: createBuildingFormPavingMat(
      '#e5d5bc',
      '#bfa98b',
      '#f3e7d4',
      '#7d6b57',
      10,
    ),
    brick_rooftop_deck: createBuildingFormPavingMat(
      '#d2bba4',
      '#9c816a',
      '#e3cfba',
      '#6b5344',
      12,
    ),
  };

  // Clean manicured lot turf pad for empty lots flush at +0.09m block elevation
  const emptyLotTurfMat = regMat(new THREE.MeshLambertMaterial({ color: '#6ec44a' }));

  const gltfLoader = new GLTFLoader();
  const textureLoader = new THREE.TextureLoader();
  const glbTemplateCache = new Map<ShopBuildingFormId, Promise<THREE.Group | null>>();
  const resolvedGlbTemplates = new Map<ShopBuildingFormId, THREE.Group>();
  const neutralBillboardTex = createNeutralBillboardTexture(disposables);
  let disposed = false;
  let lastPreviewAllBuildings = false;
  let lastDebugShopBounds3D = false;
  let lastNightFactor01 = 0;

  // Scratch colors for zero-allocation night lighting updates
  const tmpShowcaseColor = new THREE.Color();
  const tmpUpperColor = new THREE.Color();
  const tmpLampColor = new THREE.Color();
  const tmpStreetGlobeColor = new THREE.Color();
  const DAY_SHOWCASE_COLOR = new THREE.Color('#c8e4f4');
  const NIGHT_SHOWCASE_COLOR = new THREE.Color('#ffe9bd');
  const DAY_UPPER_COLOR = new THREE.Color('#3b4c63');
  const NIGHT_UPPER_COLOR = new THREE.Color('#ffda96');
  const DAY_LAMP_COLOR = new THREE.Color('#d8e0ea');
  const NIGHT_LAMP_COLOR = new THREE.Color('#fff5d4');
  const DAY_STREET_GLOBE = new THREE.Color('#dce3ec');
  const NIGHT_STREET_GLOBE = new THREE.Color('#ffebb5');

  const lotNodes: CityRentalLotNodeController[] = [];
  const hitProxyMeshes: THREE.Mesh[] = [];

  for (let i = 0; i < CITY_RENTAL_LOTS.length; i++) {
    const spec = CITY_RENTAL_LOTS[i];
    const lotRoot = new THREE.Group();
    lotRoot.name = `CityRentalLot_${spec.slotId}`;
    lotRoot.position.set(spec.x, 0, spec.z);
    lotRoot.rotation.y = spec.facingYaw;
    rootGroup.add(lotRoot);

    // 1. Flat White Ground Boundary Lines flush with lot pad (visible when empty)
    const boundaryGroup = new THREE.Group();
    boundaryGroup.name = `LotBoundary_${spec.slotId}`;
    lotRoot.add(boundaryGroup);

    const lineY = LOT_SURFACE_Y + 0.022;
    const rearLine = new THREE.Mesh(whiteLineNSGeo, whiteLineMat);
    rearLine.position.set(0, lineY, -(halfLotD - 0.12));
    boundaryGroup.add(rearLine);

    for (const xSign of [-1, 1]) {
      const sideLine = new THREE.Mesh(whiteLineEWGeo, whiteLineMat);
      sideLine.position.set(xSign * (halfLotW - 0.12), lineY, 0);
      boundaryGroup.add(sideLine);

      // Front white corner returns leaving an 8.0m open entrance in the middle
      const frontSeg = new THREE.Mesh(frontWhiteSegmentGeo, whiteLineMat);
      frontSeg.position.set(xSign * (halfLotW - 3.0), lineY, halfLotD - 0.12);
      boundaryGroup.add(frontSeg);
    }

    // 2. Resting Empty Land Presentation: Clean manicured turf pad + Claim Kiosk at +0.09m
    const emptyMarkerGroup = new THREE.Group();
    emptyMarkerGroup.name = `LotEmptyMarker_${spec.slotId}`;
    lotRoot.add(emptyMarkerGroup);

    const emptyTurfMesh = new THREE.Mesh(emptyTurfGeo, emptyLotTurfMat);
    emptyTurfMesh.name = `LotEmptyTurf_${spec.slotId}`;
    emptyTurfMesh.position.set(0, LOT_SURFACE_Y - 0.018, 0);
    emptyTurfMesh.receiveShadow = true;
    if (windUniforms) {
      upgradeMeshToBlitzWorldMaterial(emptyTurfMesh, windUniforms, '#6ec44a', 0.12);
    }
    emptyMarkerGroup.add(emptyTurfMesh);
    emptyMarkerGroup.add(boundaryGroup);

    const claimKioskMesh = options?.createKioskMesh
      ? options.createKioskMesh()
      : new THREE.Group();
    claimKioskMesh.name = `LotClaimKiosk_${spec.slotId}`;
    claimKioskMesh.position.set(0, LOT_SURFACE_Y, LOT_CLAIM_KIOSK_LOCAL_Z);
    emptyMarkerGroup.add(claimKioskMesh);
    const hologramRig = attachShopHologramRigToKiosk(claimKioskMesh, sharedHoloGeos, disposables);
    const kioskWorldX = spec.x + spec.frontDirX * LOT_CLAIM_KIOSK_LOCAL_Z;
    const kioskWorldZ = spec.z + spec.frontDirZ * LOT_CLAIM_KIOSK_LOCAL_Z;

    const availTex = createLotGroundPlaqueTexture(spec.shortCode, 'available', disposables);
    const statusSignMat = regMat(new THREE.MeshBasicMaterial({ map: availTex }));
    if (!options?.createKioskMesh) {
      const plaqueFace = new THREE.Mesh(groundPlaqueFaceGeo, statusSignMat);
      plaqueFace.position.set(0, LOT_SURFACE_Y + 0.028, 1.8);
      emptyMarkerGroup.add(plaqueFace);
    }

    // 3. Kept empty & hidden (procedural poly shop fallback retired — GLB only)
    const shopBuildingGroup = new THREE.Group();
    shopBuildingGroup.name = `ProceduralShopMount_${spec.slotId}`;
    shopBuildingGroup.visible = false;
    lotRoot.add(shopBuildingGroup);

    // 3B. Optimized Low-Draw-Call GLB Building Mount
    const glbBuildingMount = new THREE.Group();
    glbBuildingMount.name = `ShopGlbMount_${spec.slotId}`;
    glbBuildingMount.position.set(0, 0, STANDARD_SHOP_FOOTPRINT_SPEC.localDepthOffsetTowardRearM);
    glbBuildingMount.visible = false;
    lotRoot.add(glbBuildingMount);

    // 3C. Distinct Full-Lot Building Paving ("Trotoar Bangunan") covering 100% of the 20m x 20m lot
    const lotPavingMesh = new THREE.Mesh(lotPavingGeo, lotPavingMatByForm.glass_corner_3story);
    lotPavingMesh.name = `LotBuildingPaving_${spec.slotId}`;
    lotPavingMesh.position.set(0, BUILDING_PAVING_TOP_Y - 0.022, 0);
    lotPavingMesh.receiveShadow = true;
    lotPavingMesh.visible = false;
    lotRoot.add(lotPavingMesh);

    // 4. Interactive 3D Selection / Hover Highlight Border Ring
    const highlightGroup = new THREE.Group();
    highlightGroup.name = `LotHighlight_${spec.slotId}`;
    highlightGroup.visible = false;
    lotRoot.add(highlightGroup);

    const highlightRingMat = regMat(
      new THREE.MeshBasicMaterial({
        color: '#b8ff3c',
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );

    const highlightY = BUILDING_PAVING_TOP_Y + 0.032;
    for (const zSign of [-1, 1]) {
      const hBar = new THREE.Mesh(highlightNSGeo, highlightRingMat);
      hBar.position.set(0, highlightY, zSign * (halfLotD - 0.17));
      highlightGroup.add(hBar);
    }
    for (const xSign of [-1, 1]) {
      const vBar = new THREE.Mesh(highlightEWGeo, highlightRingMat);
      vBar.position.set(xSign * (halfLotW - 0.17), highlightY, 0);
      highlightGroup.add(vBar);
    }

    // 4B. 3D Shop QA Bounds & Margin Overlay (20m outer cyan, 19.6m cap amber)
    const qaBoundsGroup = new THREE.Group();
    qaBoundsGroup.name = `LotQaBounds_${spec.slotId}`;
    qaBoundsGroup.visible = false;
    qaBoundsGroup.add(new THREE.LineSegments(qaLotOutlineGeo, qaLotOutlineMat));
    qaBoundsGroup.add(new THREE.LineSegments(qaCapOutlineGeo, qaCapOutlineMat));
    lotRoot.add(qaBoundsGroup);

    // 5. Raycast Hit Proxy Mesh tagged with userData.cityRentalLotId
    const hitProxyMesh = new THREE.Mesh(hitProxyGeo, hitProxyMat);
    hitProxyMesh.position.set(0, BUILDING_PAVING_TOP_Y + 0.02, 0);
    hitProxyMesh.userData.cityRentalLotId = spec.slotId;
    lotRoot.add(hitProxyMesh);
    hitProxyMeshes.push(hitProxyMesh);

    lotNodes.push({
      spec,
      lotRoot,
      emptyMarkerGroup,
      emptyTurfMesh,
      claimKioskMesh,
      kioskWorldX,
      kioskWorldZ,
      lotPavingMesh,
      shopBuildingGroup,
      glbBuildingMount,
      loadedGlbFormId: null,
      glbLoadStatus: 'idle',
      buildAnimStartSec: 0,
      pendingGlbTemplate: null,
      pendingLogoUrl: null,
      hologramRig,
      appliedBillboardLogoUrl: null,
      activeBillboardMats: [],
      highlightGroup,
      qaBoundsGroup,
      hitProxyMesh,
      statusSignMat,
      highlightRingMat,
    });
  }

  // Street furniture neatly positioned along the outer curb of the new 4.80m curbed tram-style block sidewalks
  // (batched with InstancedMesh so all 4 blocks' streetlamps, planters, benches & bike racks cost just 6 draw calls!)
  const sidewalkFurnitureGroup = new THREE.Group();
  sidewalkFurnitureGroup.name = 'CommercialAvenueStreetFurniture';
  rootGroup.add(sidewalkFurnitureGroup);

  const lampPostMat = regMat(new THREE.MeshLambertMaterial({ color: '#272c36' }));
  const avenueLampGlobeMat = regMat(new THREE.MeshBasicMaterial({ color: '#dce3ec' }));
  const benchWoodMat = regMat(new THREE.MeshLambertMaterial({ color: '#9c6b3b' }));
  const planterPotMat = regMat(new THREE.MeshLambertMaterial({ color: '#5b6472' }));
  const planterFoliageMat = regMat(new THREE.MeshLambertMaterial({ color: '#2f855a' }));

  const lampPoleGeo = regGeo(new THREE.CylinderGeometry(0.06, 0.08, 3.6, 8));
  const lampHeadGeo = regGeo(new THREE.SphereGeometry(0.22, 8, 8));
  const benchSeatGeo = regGeo(new RoundedBoxGeometry(0.55, 0.14, 1.6, 1, 0.02));
  const planterBoxGeo = regGeo(new RoundedBoxGeometry(0.68, 0.5, 0.68, 1, 0.03));
  const planterBushGeo = regGeo(new THREE.SphereGeometry(0.44, 8, 8));
  const bikeRackLoopGeo = regGeo(new THREE.TorusGeometry(0.28, 0.035, 6, 12, Math.PI));

  const poleTransforms: THREE.Matrix4[] = [];
  const globeTransforms: THREE.Matrix4[] = [];
  const planterTransforms: THREE.Matrix4[] = [];
  const bushTransforms: THREE.Matrix4[] = [];
  const benchTransforms: THREE.Matrix4[] = [];
  const rackTransforms: THREE.Matrix4[] = [];

  for (const strip of COMMERCIAL_SIDEWALK_STRIPS) {
    const isNorth = strip.maxZ < 0;
    const zSign = isNorth ? -1 : 1;
    // Place furniture cleanly near the road-side curb of the 4.80m city sidewalk (leaving 3.2m+ clear walkway!)
    const roadEdgeX = strip.sideOfAvenue === 'east' ? strip.minX : strip.maxX;
    const inwardSign = strip.sideOfAvenue === 'east' ? 1 : -1;
    const fx = roadEdgeX + inwardSign * 1.05;
    const solidFurnitureZ = [zSign * 64.5, zSign * 80.33, zSign * 96.2];

    for (let zi = 0; zi < solidFurnitureZ.length; zi++) {
      const fz = solidFurnitureZ[zi];

      if (zi === 1) {
        benchTransforms.push(
          new THREE.Matrix4().makeTranslation(fx, LOT_SURFACE_Y + 0.42, fz - zSign * 2.5),
        );
        for (let r = 0; r < 2; r++) {
          rackTransforms.push(
            new THREE.Matrix4().makeTranslation(
              fx,
              LOT_SURFACE_Y + 0.04,
              fz + zSign * (3.9 + r * 0.68),
            ),
          );
        }
      }
    }
  }

  const addInstancedFurniture = (
    name: string,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    transforms: THREE.Matrix4[],
    upgradeWorld = true,
  ) => {
    if (transforms.length === 0) return;
    const inst = new THREE.InstancedMesh(geo, mat, transforms.length);
    inst.name = name;
    for (let idx = 0; idx < transforms.length; idx++) {
      inst.setMatrixAt(idx, transforms[idx]);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (windUniforms && upgradeWorld) {
      upgradeMeshToBlitzWorldMaterial(inst, windUniforms, undefined, 0.12);
    }
    sidewalkFurnitureGroup.add(inst);
  };

  addInstancedFurniture('CommercialLampPoles', lampPoleGeo, lampPostMat, poleTransforms, true);
  addInstancedFurniture('CommercialLampGlobes', lampHeadGeo, avenueLampGlobeMat, globeTransforms, false);
  addInstancedFurniture('CommercialPlanterBoxes', planterBoxGeo, planterPotMat, planterTransforms, true);
  addInstancedFurniture('CommercialPlanterBushes', planterBushGeo, planterFoliageMat, bushTransforms, true);
  addInstancedFurniture('CommercialBenches', benchSeatGeo, benchWoodMat, benchTransforms, true);
  addInstancedFurniture('CommercialBikeRacks', bikeRackLoopGeo, lampPostMat, rackTransforms, true);

  const registerActiveBillboardMats = (node: CityRentalLotNodeController, root: THREE.Object3D) => {
    node.activeBillboardMats.length = 0;
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
      if (
        mat &&
        (mesh.name === SHOP_BILLBOARD_MESH_SPEC.meshName ||
          mat.name === SHOP_BILLBOARD_MESH_SPEC.materialName)
      ) {
        if ('emissiveIntensity' in mat) {
          mat.emissiveIntensity = lastNightFactor01 * 0.82;
          node.activeBillboardMats.push(mat);
        }
      }
    });
  };

  const loadShopGlbTemplate = (formId: ShopBuildingFormId): Promise<THREE.Group | null> => {
    const ready = resolvedGlbTemplates.get(formId);
    if (ready) return Promise.resolve(ready);
    const cached = glbTemplateCache.get(formId);
    if (cached) return cached;
    const spec = SHOP_BUILDING_FORMS[formId];
    const p = new Promise<THREE.Group | null>((resolve) => {
      if (typeof window === 'undefined') {
        resolve(null);
        return;
      }
      gltfLoader.load(
        spec.glbPath,
        (gltf) => {
          if (disposed) {
            resolve(null);
            return;
          }
          const optimized = optimizeShopGlbTemplate(
            gltf.scene,
            formId,
            sharedShopMats,
            neutralBillboardTex,
            disposables,
            windUniforms,
          );
          resolvedGlbTemplates.set(formId, optimized);
          resolve(optimized);
        },
        undefined,
        () => {
          glbTemplateCache.delete(formId);
          resolve(null);
        },
      );
    });
    glbTemplateCache.set(formId, p);
    return p;
  };

  const mountResolvedGlbOnNode = (
    node: CityRentalLotNodeController,
    formId: ShopBuildingFormId,
    template: THREE.Group,
    logoUrl: string | null,
  ) => {
    // Shallow clone shares all merged BufferGeometries & shared materials across all 16 lots!
    const clone = template.clone(true);
    // Clone ONLY the per-lot rooftop billboard material so logo textures NEVER bleed across lots
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (
        mesh.isMesh &&
        (mesh.name === SHOP_BILLBOARD_MESH_SPEC.meshName ||
          (mesh.material as THREE.Material | undefined)?.name ===
            SHOP_BILLBOARD_MESH_SPEC.materialName)
      ) {
        const clonedMat = (mesh.material as THREE.Material).clone();
        disposables.push(clonedMat);
        mesh.material = clonedMat;
      }
    });
    node.lotPavingMesh.material = lotPavingMatByForm[formId];
    node.lotPavingMesh.visible = true;
    node.glbBuildingMount.clear();
    node.glbBuildingMount.add(clone);
    node.glbBuildingMount.visible = true;
    node.shopBuildingGroup.visible = false;
    node.emptyMarkerGroup.visible = false;
    node.glbLoadStatus = 'loaded';
    node.pendingGlbTemplate = null;
    node.appliedBillboardLogoUrl = logoUrl;
    applyBillboardLogoToObject(clone, logoUrl);
    registerActiveBillboardMats(node, clone);
  };

  const applyBillboardLogoToObject = (root: THREE.Object3D, logoUrl: string | null) => {
    const applyTex = (tex: THREE.Texture) => {
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = mesh.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial | undefined;
        if (
          mesh.name === SHOP_BILLBOARD_MESH_SPEC.meshName ||
          mat?.name === SHOP_BILLBOARD_MESH_SPEC.materialName
        ) {
          if (mat && 'map' in mat) {
            mat.map = tex;
            if ('emissiveMap' in mat) {
              mat.emissiveMap = tex;
            }
            mat.needsUpdate = true;
          }
        }
      });
    };

    if (!logoUrl) {
      applyTex(neutralBillboardTex);
      return;
    }

    textureLoader.load(
      logoUrl,
      (loadedTex) => {
        if (disposed) {
          loadedTex.dispose();
          return;
        }
        loadedTex.colorSpace = THREE.SRGBColorSpace;
        loadedTex.needsUpdate = true;
        disposables.push(loadedTex);
        applyTex(loadedTex);
      },
      undefined,
      () => applyTex(neutralBillboardTex),
    );
  };

  const updateNightLighting: CityRentalLotsVisualController['updateNightLighting'] = (
    nightFactor01: number,
  ) => {
    const n = Math.max(0, Math.min(1, Number.isFinite(nightFactor01) ? nightFactor01 : 0));
    lastNightFactor01 = n;

    // 1. Storefront & Showcase Display Windows (clean daytime glass -> warm inviting golden glow at night)
    tmpShowcaseColor.copy(DAY_SHOWCASE_COLOR).lerp(NIGHT_SHOWCASE_COLOR, n);
    sharedShopMats.showcaseGlassMat.color.copy(tmpShowcaseColor);
    sharedShopMats.showcaseGlassMat.emissiveIntensity = n * 1.25;
    sharedShopMats.showcaseGlassMat.opacity = 0.44 + n * 0.42;

    // 2. Upper Floor Showcase Windows
    tmpUpperColor.copy(DAY_UPPER_COLOR).lerp(NIGHT_UPPER_COLOR, n);
    sharedShopMats.upperWindowMat.color.copy(tmpUpperColor);
    sharedShopMats.upperWindowMat.emissiveIntensity = n * 0.98;

    // 3. Overhead Billboard Spotlight Bulbs, Facade Lanterns & Soffit LEDs
    tmpLampColor.copy(DAY_LAMP_COLOR).lerp(NIGHT_LAMP_COLOR, n);
    sharedShopMats.fixtureLampMat.color.copy(tmpLampColor);
    sharedShopMats.fixtureLampMat.emissiveIntensity = 0.05 + n * 1.85;

    // 4. Downward Overhead Billboard Spotlight Light-Wash Cone (0 overdraw during daytime)
    sharedShopMats.billboardWashMat.opacity = n * 0.44;
    sharedShopMats.billboardWashMat.visible = n > 0.02;

    // 5. Commercial Avenue Streetlamp Globes
    tmpStreetGlobeColor.copy(DAY_STREET_GLOBE).lerp(NIGHT_STREET_GLOBE, n);
    avenueLampGlobeMat.color.copy(tmpStreetGlobeColor);

    // 6. Active Rooftop Billboard Faces (spotlight-lit vibrancy at night)
    const bbEmissive = n * 0.82;
    for (let i = 0; i < lotNodes.length; i++) {
      const mats = lotNodes[i].activeBillboardMats;
      for (let m = 0; m < mats.length; m++) {
        mats[m].emissiveIntensity = bbEmissive;
      }
    }
  };

  const sync: CityRentalLotsVisualController['sync'] = (params) => {
    const visibleMode = params.isSafezoneMode && params.showOutdoor;
    rootGroup.visible = visibleMode;
    lastPreviewAllBuildings = Boolean(params.previewAllBuildingsFit);
    lastDebugShopBounds3D = Boolean(params.debugShopBounds3D);
    if (!visibleMode) return;

    const resolvedStates = resolveCityRentalLotsState({
      blueCommanderBases: params.blueCommanderBases,
      redCommanderBases: params.redCommanderBases,
      rentedSlotIds: params.rentedSlotIds,
      lotStatusBySlotId: params.lotStatusBySlotId,
      placedBuildingBySlotId: params.placedBuildingBySlotId,
      previewAllBuildingsFit: params.previewAllBuildingsFit,
    });

    const nowSec = typeof params.timeSec === 'number' ? params.timeSec : performance.now() * 0.001;
    const pulse = 0.78 + 0.22 * Math.sin(nowSec * 5.2);

    for (let i = 0; i < lotNodes.length; i++) {
      const node = lotNodes[i];
      const st = resolvedStates[i];
      node.lotRoot.visible = st.isVisibleInWorld;
      if (!st.isVisibleInWorld) continue;

      node.qaBoundsGroup.visible = lastDebugShopBounds3D;

      const targetForm = st.showShopBuilding ? st.placedBuildingFormId : null;
      const previewForm = params.previewFormBySlotId?.[node.spec.slotId] ?? null;
      const targetLogoUrl = params.billboardLogoUrlBySlotId?.[node.spec.slotId] ?? null;

      // Never show the retired procedural poly box building
      node.shopBuildingGroup.visible = false;

      if (targetForm) {
        if (node.loadedGlbFormId !== targetForm) {
          node.loadedGlbFormId = targetForm;
          node.pendingLogoUrl = targetLogoUrl;
          node.appliedBillboardLogoUrl = targetLogoUrl;
          node.glbBuildingMount.clear();
          node.glbBuildingMount.visible = false;
          node.lotPavingMesh.visible = false;

          const syncReadyTemplate = resolvedGlbTemplates.get(targetForm) ?? null;

          // QA bulk fit-preview mounts immediately; real player builds animate the kiosk hologram loading state
          if (lastPreviewAllBuildings && syncReadyTemplate) {
            mountResolvedGlbOnNode(node, targetForm, syncReadyTemplate, targetLogoUrl);
          } else {
            node.glbLoadStatus = 'loading';
            node.buildAnimStartSec = nowSec;
            node.pendingGlbTemplate = syncReadyTemplate;
            node.emptyMarkerGroup.visible = true;

            if (!syncReadyTemplate) {
              void loadShopGlbTemplate(targetForm).then((template) => {
                if (disposed || node.loadedGlbFormId !== targetForm) return;
                if (!template) {
                  node.glbLoadStatus = 'fallback';
                  return;
                }
                node.pendingGlbTemplate = template;
              });
            }
          }
        } else if (node.glbLoadStatus === 'loading') {
          node.pendingLogoUrl = targetLogoUrl;
          const elapsed = Math.max(0, nowSec - node.buildAnimStartSec);
          const animDone = lastPreviewAllBuildings || elapsed >= MIN_HOLOGRAM_BUILD_DURATION_SEC;
          if (node.pendingGlbTemplate && animDone) {
            mountResolvedGlbOnNode(
              node,
              targetForm,
              node.pendingGlbTemplate,
              node.pendingLogoUrl,
            );
          }
        } else if (node.glbLoadStatus === 'loaded' && node.appliedBillboardLogoUrl !== targetLogoUrl) {
          node.appliedBillboardLogoUrl = targetLogoUrl;
          applyBillboardLogoToObject(node.glbBuildingMount, targetLogoUrl);
        }
      } else {
        node.lotPavingMesh.visible = false;
        node.glbBuildingMount.visible = false;
        node.glbLoadStatus = 'idle';
        node.pendingGlbTemplate = null;
        node.pendingLogoUrl = null;
        node.activeBillboardMats.length = 0;
        if (node.loadedGlbFormId !== null) {
          node.loadedGlbFormId = null;
          node.appliedBillboardLogoUrl = null;
          node.glbBuildingMount.clear();
        }
      }

      const isGlbBuiltAndVisible =
        Boolean(targetForm) && node.glbLoadStatus === 'loaded' && node.glbBuildingMount.visible;
      node.emptyMarkerGroup.visible = !isGlbBuiltAndVisible;

      // Update Kiosk 3D Hologram reflection & aesthetic loading state while kiosk is visible
      const rig = node.hologramRig;
      if (rig && node.emptyMarkerGroup.visible) {
        const isBuildingNow = Boolean(targetForm) && node.glbLoadStatus === 'loading';
        const displayKey: 'default' | ShopBuildingFormId = isBuildingNow
          ? targetForm!
          : previewForm ?? 'default';

        if (rig.activeDisplayKey !== displayKey) {
          rig.activeDisplayKey = displayKey;
          rig.formSwitchScale = 0.72;
          for (const [k, grp] of Object.entries(rig.shopModels)) {
            grp.visible = k === displayKey;
          }
        }
        if (rig.formSwitchScale < 1) {
          rig.formSwitchScale = Math.min(1, rig.formSwitchScale + 0.08);
        }

        const spinSpeed = isBuildingNow ? 2.15 : previewForm ? 1.35 : 0.78;
        rig.holoTurntable.rotation.y = nowSec * spinSpeed + i * 0.45;
        rig.holoTurntable.position.y = 0.36 + Math.sin(nowSec * 2.8 + i) * 0.045;
        rig.holoTurntable.scale.setScalar(rig.formSwitchScale);

        if (isBuildingNow && targetForm) {
          const elapsed = Math.max(0, nowSec - node.buildAnimStartSec);
          const timeProgress = Math.min(1, elapsed / MIN_HOLOGRAM_BUILD_DURATION_SEC);
          // Cap smoothly at 92% while network GLB download is still in flight; surge to 100% once GLB ready
          const displayProgress = node.pendingGlbTemplate
            ? timeProgress
            : Math.min(0.92, timeProgress * 0.92);

          rig.loadingOverlayGroup.visible = true;
          rig.outerHaloRing.rotation.z = nowSec * 2.4;
          rig.outerHaloRing.rotation.y = nowSec * 1.1;
          rig.innerHaloRing.rotation.z = -nowSec * 3.1;
          rig.innerHaloRing.rotation.y = -nowSec * 1.4;

          const scanWave = 0.5 + 0.5 * Math.sin(nowSec * 4.4);
          rig.scanBandMesh.position.y = 0.38 + scanWave * 1.02;

          // Vibrant cyan -> mint-emerald holographic construction pulse
          const huePulse = 0.5 + 0.5 * Math.sin(nowSec * 6.0);
          const activeHex = huePulse > 0.5 ? 0x34d399 : 0x38bdf8;
          rig.holoSolidMat.color.setHex(activeHex);
          rig.holoSolidMat.opacity = 0.34 + 0.16 * huePulse;
          rig.holoWireMat.color.setHex(0x99f6e4);
          rig.holoRingMat.color.setHex(0x34d399);
          rig.holoBeamMat.color.setHex(0x2dd4bf);
          rig.holoBeamMat.opacity = 0.24 + 0.08 * huePulse;

          if (rig.loadingBannerCanvas && rig.loadingBannerTex) {
            const pctBucket = Math.round(displayProgress * 50); // Update texture smoothly at 2% steps
            const bannerKey = `${targetForm}:${pctBucket}`;
            if (rig.lastBannerKey !== bannerKey) {
              rig.lastBannerKey = bannerKey;
              drawHoloLoadingBanner(
                rig.loadingBannerCanvas,
                rig.loadingBannerTex,
                HOLO_FORM_SHORT_NAMES[targetForm],
                displayProgress,
              );
            }
          }
        } else {
          rig.loadingOverlayGroup.visible = false;
          const isPreviewing = Boolean(previewForm);
          rig.holoSolidMat.color.setHex(isPreviewing ? 0x38bdf8 : 0x00d2ff);
          rig.holoSolidMat.opacity = isPreviewing ? 0.44 : 0.32;
          rig.holoWireMat.color.setHex(isPreviewing ? 0xa5f3fc : 0x67e8f9);
          rig.holoRingMat.color.setHex(isPreviewing ? 0x38bdf8 : 0x00d2ff);
          rig.holoBeamMat.color.setHex(0x00d2ff);
          rig.holoBeamMat.opacity = isPreviewing ? 0.20 : 0.13;
        }
      }

      const isSelected = params.selectedSlotId === node.spec.slotId;
      const isHovered = params.hoveredSlotId === node.spec.slotId;
      node.highlightGroup.visible = isSelected || isHovered;
      if (isSelected) {
        node.highlightRingMat.color.set('#b8ff3c');
        node.highlightRingMat.opacity = pulse;
      } else if (isHovered) {
        node.highlightRingMat.color.set('#38bdf8');
        node.highlightRingMat.opacity = 0.72;
      }
    }
  };

  const getQaTelemetrySummary = (): QaShopLiveTelemetrySummary => {
    const renderModeBySlotId: Record<string, QaShopRenderMode> = {};
    const activeFormBySlotId: Record<string, ShopBuildingFormId | null> = {};
    let visibleBuildingsCount = 0;
    let glbLoadedCount = 0;
    let proceduralFallbackCount = 0;

    for (let i = 0; i < lotNodes.length; i++) {
      const node = lotNodes[i];
      const slotId = node.spec.slotId;
      if (node.glbBuildingMount.visible && node.loadedGlbFormId) {
        renderModeBySlotId[slotId] = 'glb';
        activeFormBySlotId[slotId] = node.loadedGlbFormId;
        visibleBuildingsCount++;
        glbLoadedCount++;
      } else if (node.shopBuildingGroup.visible && node.loadedGlbFormId) {
        renderModeBySlotId[slotId] = 'procedural';
        activeFormBySlotId[slotId] = node.loadedGlbFormId;
        visibleBuildingsCount++;
        proceduralFallbackCount++;
      } else {
        renderModeBySlotId[slotId] = 'none';
        activeFormBySlotId[slotId] = null;
      }
    }

    return {
      previewAllBuildings: lastPreviewAllBuildings,
      debugBounds3D: lastDebugShopBounds3D,
      visibleBuildingsCount,
      glbLoadedCount,
      proceduralFallbackCount,
      renderModeBySlotId,
      activeFormBySlotId,
    };
  };

  const dispose = () => {
    disposed = true;
    for (let i = 0; i < disposables.length; i++) {
      disposables[i].dispose();
    }
    disposables.length = 0;
  };

  return {
    rootGroup,
    lotNodes,
    hitProxyMeshes,
    sync,
    updateNightLighting,
    getQaTelemetrySummary,
    dispose,
  };
}
