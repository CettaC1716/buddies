import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type {
  CityTramConsistState,
  LightingPresetKey,
  PlazaTrafficSignalState,
} from './buddiesBlitzRules';
import { clamp } from './buddiesBlitzRules';
import {
  type BlitzWindUniforms,
  createBlitzStrokeMesh,
} from './buddiesBlitzShadersAndAssets';
import { createInstancedMeshWithOutline } from './buddiesHubRenderOptimizer';
import {
  CITY_BUILDING_GLOW_MANIFEST,
  CITY_LAMP_MANIFEST,
  EXISTING_CITY_LAMP_POOL_ANCHORS,
  LANTERN_BILLBOARD_CONFIG,
  type CityIlluminationLevels,
  type CityLampSpec,
  type TrafficVehicleState,
  type WeatherEnvStateContract,
  computeCityIlluminationLevels,
  evaluateLanternCoreAndSpriteState,
  evaluateSmoothRadialGlowFalloff,
} from './buddiesCityLightingAndTrafficRules';
import { evaluateHaltePlatformSdf } from './buddiesPlanetCurvature';

export type { WeatherEnvStateContract };

export interface CityVehicleCollisionBox {
  id: string;
  x: number;
  z: number;
  yaw: number;
  halfLength: number;
  halfWidth: number;
  vx: number;
  vz: number;
}

export interface CityLightingAndTrafficUpdateInput {
  dt: number;
  timeSec: number;
  tramState: CityTramConsistState;
  plazaSignalState: PlazaTrafficSignalState;
  eastSignalState: PlazaTrafficSignalState;
  fallbackPreset: LightingPresetKey;
  weatherEnvState?: WeatherEnvStateContract | null;
  pedestrians?: ReadonlyArray<{ x: number; z: number }>;
  playerPose?: { x: number; z: number; alive?: boolean } | null;
  planetPivotX?: number;
  planetPivotZ?: number;
  curvatureStrength?: number;
}

export interface CityLightingAndTrafficSystemStats {
  lampCount: number;
  tierCounts: Record<1 | 2 | 3 | 4, number>;
  groundPoolCount: number;
  lanternHaloCount: number;
  buildingGlowCount: number;
  trafficVehicleCount: number;
  pointLightCount: number;
  instancedMeshCount: number;
}

export interface CityLightingAndTrafficSystemHandle {
  rootGroup: THREE.Group;
  update: (input: CityLightingAndTrafficUpdateInput) => CityIlluminationLevels;
  getVehicleCollisionBoxes: () => readonly CityVehicleCollisionBox[];
  getFleetState: () => readonly TrafficVehicleState[];
  getLastIlluminationLevels: () => CityIlluminationLevels;
  stats: CityLightingAndTrafficSystemStats;
  dispose: () => void;
}

interface PbrMapTriplet {
  map: THREE.Texture;
  roughnessMap: THREE.Texture;
  bumpMap: THREE.Texture;
}

const EMPTY_VEHICLE_COLLISION_BOXES: readonly CityVehicleCollisionBox[] = Object.freeze([]);
const EMPTY_TRAFFIC_FLEET: readonly TrafficVehicleState[] = Object.freeze([]);

function hash2D(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function normalizeGeoForMerge(geo: THREE.BufferGeometry, ensureColor = false): THREE.BufferGeometry {
  const nonIndexed = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const attr of Object.keys(nonIndexed.attributes)) {
    if (attr !== 'position' && attr !== 'normal' && attr !== 'uv' && !(ensureColor && attr === 'color')) {
      nonIndexed.deleteAttribute(attr);
    }
  }
  if (!nonIndexed.attributes.normal) {
    nonIndexed.computeVertexNormals();
  }
  const vertCount = nonIndexed.attributes.position.count;
  if (!nonIndexed.attributes.uv) {
    nonIndexed.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(vertCount * 2), 2));
  }
  if (ensureColor && !nonIndexed.attributes.color) {
    const white = new Float32Array(vertCount * 3);
    white.fill(1.0);
    nonIndexed.setAttribute('color', new THREE.BufferAttribute(white, 3));
  }
  return nonIndexed;
}

function mergeNormalizedGeos(parts: THREE.BufferGeometry[], ensureColor = false): THREE.BufferGeometry {
  const normalized = parts.map((p) => {
    const n = normalizeGeoForMerge(p, ensureColor);
    p.dispose();
    return n;
  });
  const merged = normalized.length === 1 ? normalized[0] : mergeGeometries(normalized, false);
  if (normalized.length > 1) {
    for (const g of normalized) g.dispose();
  }
  if (!merged) {
    return new THREE.BoxGeometry(0.1, 0.1, 0.1);
  }
  return merged;
}

function remapGeoUvs(
  geo: THREE.BufferGeometry,
  uMin: number,
  uMax: number,
  vMin = 0.0,
  vMax = 1.0,
): THREE.BufferGeometry {
  const uv = geo.getAttribute('uv');
  if (!uv) return geo;
  const du = uMax - uMin;
  const dv = vMax - vMin;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uMin + uv.getX(i) * du, vMin + uv.getY(i) * dv);
  }
  uv.needsUpdate = true;
  return geo;
}

function scaleGeoUvs(geo: THREE.BufferGeometry, su: number, sv: number): THREE.BufferGeometry {
  const uv = geo.getAttribute('uv');
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  uv.needsUpdate = true;
  return geo;
}

function tintGeoVertexColor(geo: THREE.BufferGeometry, hex: THREE.ColorRepresentation): THREE.BufferGeometry {
  const col = new THREE.Color(hex);
  const count = geo.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = col.r;
    arr[i * 3 + 1] = col.g;
    arr[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function makeTranslatedBox(
  w: number,
  h: number,
  d: number,
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx !== 0) g.rotateX(rx);
  if (ry !== 0) g.rotateY(ry);
  if (rz !== 0) g.rotateZ(rz);
  if (x !== 0 || y !== 0 || z !== 0) g.translate(x, y, z);
  return g;
}

function makeTranslatedRoundedBox(
  w: number,
  h: number,
  d: number,
  radius: number,
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  ry = 0,
  rz = 0,
  segments = 2,
): THREE.BufferGeometry {
  const maxR = Math.min(w, h, d) * 0.42;
  const g = new RoundedBoxGeometry(w, h, d, segments, Math.min(radius, maxR));
  if (rx !== 0) g.rotateX(rx);
  if (ry !== 0) g.rotateY(ry);
  if (rz !== 0) g.rotateZ(rz);
  if (x !== 0 || y !== 0 || z !== 0) g.translate(x, y, z);
  return g;
}

function makeTubularCurveGeo(
  pts: ReadonlyArray<readonly [number, number, number]>,
  tubularSegments: number,
  radius: number,
  radialSegments = 8,
): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(pts.map(([px, py, pz]) => new THREE.Vector3(px, py, pz)));
  return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
}

function makeTranslatedCylinder(
  rTop: number,
  rBottom: number,
  h: number,
  radialSegments: number,
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, radialSegments);
  if (rx !== 0) g.rotateX(rx);
  if (ry !== 0) g.rotateY(ry);
  if (rz !== 0) g.rotateZ(rz);
  if (x !== 0 || y !== 0 || z !== 0) g.translate(x, y, z);
  return g;
}

function makeLatheGeo(
  profile: ReadonlyArray<readonly [number, number]>,
  segments = 14,
  x = 0,
  y = 0,
  z = 0,
): THREE.BufferGeometry {
  const pts = profile.map(([r, py]) => new THREE.Vector2(Math.max(0, r), py));
  const geo = new THREE.LatheGeometry(pts, segments);
  geo.computeVertexNormals();
  if (x !== 0 || y !== 0 || z !== 0) {
    geo.translate(x, y, z);
  }
  return geo;
}

function makeStrutBetween(
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  rTop: number,
  rBot: number,
  radialSegments = 4,
  twistY = Math.PI / 4,
): THREE.BufferGeometry | null {
  const dir = new THREE.Vector3().subVectors(p1, p0);
  const len = dir.length();
  if (!Number.isFinite(len) || len < 1e-4) return null;
  const g = new THREE.CylinderGeometry(rTop, rBot, len, radialSegments);
  if (twistY !== 0) g.rotateY(twistY);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  g.applyQuaternion(q);
  const mid = p0.clone().add(p1).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}

function createSolidFallbackTexture(
  r: number,
  g: number,
  b: number,
  a: number,
  colorSpace: THREE.ColorSpace = THREE.NoColorSpace,
): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array([r, g, b, a]), 1, 1, THREE.RGBAFormat);
  tex.colorSpace = colorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return { canvas, ctx };
}

function finalizeCanvasTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  repeatS = 1,
  repeatT = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = colorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatS, repeatT);
  tex.needsUpdate = true;
  return tex;
}

/**
 * 3-map Procedural Canvas PBR for Warm Antique Forged Gunmetal / Dark Bronze-Pewter (`u in [0..0.85]`)
 * plus a dedicated right-edge UV zone (`u in [0.87..1.0]`) for Brushed Antique Brass sockets & latches.
 */
function createForgedIronPbrSet(): PbrMapTriplet {
  const w = 512;
  const h = 512;
  const albedoSetup = makeCanvas(w, h);
  const roughSetup = makeCanvas(w, h);
  const bumpSetup = makeCanvas(w, h);
  if (!albedoSetup || !roughSetup || !bumpSetup) {
    return {
      map: createSolidFallbackTexture(88, 96, 108, 255, THREE.SRGBColorSpace),
      roughnessMap: createSolidFallbackTexture(215, 215, 215, 255),
      bumpMap: createSolidFallbackTexture(128, 128, 128, 255),
    };
  }

  const aCtx = albedoSetup.ctx;
  const rCtx = roughSetup.ctx;
  const bCtx = bumpSetup.ctx;
  const ironW = Math.floor(w * 0.85);

  // Base warm forged gunmetal / pewter-slate (#525a66)
  const baseGrad = aCtx.createLinearGradient(0, 0, ironW, h);
  baseGrad.addColorStop(0.0, '#5a6370');
  baseGrad.addColorStop(0.5, '#4e5660');
  baseGrad.addColorStop(1.0, '#58606b');
  aCtx.fillStyle = baseGrad;
  aCtx.fillRect(0, 0, ironW, h);

  // Roughness base (~0.84 -> * material.roughness 0.50 = 0.42)
  rCtx.fillStyle = 'rgb(214,214,214)';
  rCtx.fillRect(0, 0, ironW, h);

  // Bump neutral mid-grey
  bCtx.fillStyle = 'rgb(128,128,128)';
  bCtx.fillRect(0, 0, ironW, h);

  // Hammered forged-iron micro-dimples & isotropic pewter highlights (reads crisp on both shafts & pyramid roofs)
  for (let i = 0; i < 1100; i++) {
    const px = hash2D(i * 1.13, 4.7) * (ironW - 10);
    const py = hash2D(9.2, i * 2.41) * h;
    const rad = 2.5 + hash2D(i, i * 0.37) * 7.5;
    const bright = hash2D(i * 3.1, 7.9) > 0.44;
    aCtx.fillStyle = bright ? 'rgba(138, 148, 160, 0.15)' : 'rgba(72, 66, 58, 0.14)';
    aCtx.beginPath();
    aCtx.ellipse(px, py, rad, rad * 0.82, hash2D(i, 1.5) * Math.PI, 0, Math.PI * 2);
    aCtx.fill();

    rCtx.fillStyle = bright ? 'rgba(168, 168, 168, 0.24)' : 'rgba(242, 242, 242, 0.22)';
    rCtx.beginPath();
    rCtx.ellipse(px, py, rad, rad * 0.8, 0, 0, Math.PI * 2);
    rCtx.fill();

    bCtx.fillStyle = bright ? 'rgba(165, 165, 165, 0.26)' : 'rgba(92, 92, 92, 0.24)';
    bCtx.beginPath();
    bCtx.ellipse(px, py, rad, rad * 0.8, 0, 0, Math.PI * 2);
    bCtx.fill();
  }

  // Fine brushed grain without streaky banding
  for (let i = 0; i < 360; i++) {
    const sx = hash2D(i * 2.17, 13.3) * (ironW - 8);
    const sy = hash2D(19.1, i * 1.71) * h;
    const len = 6 + hash2D(i, 5.1) * 14;
    const isHighlight = hash2D(i, 88.2) > 0.38;
    aCtx.strokeStyle = isHighlight ? 'rgba(148, 158, 170, 0.13)' : 'rgba(96, 84, 70, 0.12)';
    aCtx.lineWidth = 1.0;
    aCtx.beginPath();
    aCtx.moveTo(sx, sy);
    aCtx.lineTo(sx, (sy + len) % h);
    aCtx.stroke();

    bCtx.strokeStyle = isHighlight ? 'rgba(150, 150, 150, 0.16)' : 'rgba(108, 108, 108, 0.15)';
    bCtx.lineWidth = 1.0;
    bCtx.beginPath();
    bCtx.moveTo(sx, sy);
    bCtx.lineTo(sx, (sy + len) % h);
    bCtx.stroke();
  }

  // Subtle warm antique bronze cavity patina horizontal bands (catches lathe collar seams)
  for (let row = 0; row < 6; row++) {
    const ry = ((row + 0.5) / 6) * h;
    const patGrad = aCtx.createLinearGradient(0, ry - 12, 0, ry + 12);
    patGrad.addColorStop(0, 'rgba(116, 98, 76, 0.0)');
    patGrad.addColorStop(0.5, 'rgba(116, 98, 76, 0.22)');
    patGrad.addColorStop(1, 'rgba(116, 98, 76, 0.0)');
    aCtx.fillStyle = patGrad;
    aCtx.fillRect(0, ry - 12, ironW, 24);
  }

  // Dedicated Right-Edge Zone (`u in [0.87..1.0]`): Brushed Antique Brass (sockets & latches)
  const brassX = Math.floor(w * 0.87);
  const brassW = w - brassX;
  const brassGrad = aCtx.createLinearGradient(brassX, 0, w, 0);
  brassGrad.addColorStop(0.0, '#b58638');
  brassGrad.addColorStop(0.45, '#ddb45f');
  brassGrad.addColorStop(0.75, '#ecc979');
  brassGrad.addColorStop(1.0, '#c29242');
  aCtx.fillStyle = brassGrad;
  aCtx.fillRect(brassX, 0, brassW, h);

  // Polished satin roughness for brass (~0.52 -> * 0.50 = 0.26)
  rCtx.fillStyle = 'rgb(134,134,134)';
  rCtx.fillRect(brassX, 0, brassW, h);

  bCtx.fillStyle = 'rgb(132,132,132)';
  bCtx.fillRect(brassX, 0, brassW, h);
  for (let y = 0; y < h; y += 6) {
    aCtx.fillStyle = y % 12 === 0 ? 'rgba(255, 236, 178, 0.22)' : 'rgba(118, 82, 26, 0.22)';
    aCtx.fillRect(brassX, y, brassW, 2);
    bCtx.fillStyle = y % 12 === 0 ? 'rgb(162,162,162)' : 'rgb(100,100,100)';
    bCtx.fillRect(brassX, y, brassW, 2);
  }

  return {
    map: finalizeCanvasTexture(albedoSetup.canvas, THREE.SRGBColorSpace),
    roughnessMap: finalizeCanvasTexture(roughSetup.canvas, THREE.NoColorSpace),
    bumpMap: finalizeCanvasTexture(bumpSetup.canvas, THREE.NoColorSpace),
  };
}

/**
 * 3-map Procedural Canvas PBR for Weathered Running-Bond Terracotta Masonry Brick (Tier 2 Pedestal).
 */
function createBrickMasonryPbrSet(): PbrMapTriplet {
  const size = 512;
  const albedoSetup = makeCanvas(size, size);
  const roughSetup = makeCanvas(size, size);
  const bumpSetup = makeCanvas(size, size);
  if (!albedoSetup || !roughSetup || !bumpSetup) {
    return {
      map: createSolidFallbackTexture(172, 92, 68, 255, THREE.SRGBColorSpace),
      roughnessMap: createSolidFallbackTexture(230, 230, 230, 255),
      bumpMap: createSolidFallbackTexture(128, 128, 128, 255),
    };
  }

  const aCtx = albedoSetup.ctx;
  const rCtx = roughSetup.ctx;
  const bCtx = bumpSetup.ctx;

  // Recessed cream-buff sand mortar
  aCtx.fillStyle = '#c4b8a6';
  aCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = 'rgb(245,245,245)';
  rCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = 'rgb(64,64,64)';
  bCtx.fillRect(0, 0, size, size);

  const rows = 8;
  const cols = 4;
  const rowH = size / rows;
  const colW = size / cols;
  const joint = 5;
  const brickPalette = ['#a6543d', '#964a35', '#b56047', '#8a4330', '#ad5942', '#9d4f3a'];

  for (let r = 0; r < rows; r++) {
    const stagger = (r % 2) * (colW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const bx = c * colW + stagger + joint;
      const by = r * rowH + joint;
      const bw = colW - joint * 2;
      const bh = rowH - joint * 2;
      const seed = hash2D(r * 13 + c, r + c * 7);

      aCtx.fillStyle = brickPalette[(r * 5 + Math.abs(c) * 3 + Math.floor(seed * 4)) % brickPalette.length];
      aCtx.fillRect(bx, by, bw, bh);

      // Subtle bevel rim highlight + lower shadow edge per brick
      aCtx.fillStyle = 'rgba(255, 224, 196, 0.18)';
      aCtx.fillRect(bx + 2, by + 2, bw - 4, 4);
      aCtx.fillStyle = 'rgba(58, 26, 18, 0.22)';
      aCtx.fillRect(bx + 2, by + bh - 5, bw - 4, 4);

      // Kiln clay mottling speckles
      for (let s = 0; s < 14; s++) {
        const sx = bx + 4 + hash2D(c * 17 + s, r * 31) * (bw - 8);
        const sy = by + 4 + hash2D(r * 19, c * 23 + s) * (bh - 8);
        const sw = 4 + hash2D(s, r + c) * 12;
        aCtx.fillStyle = s % 2 === 0 ? 'rgba(65, 30, 20, 0.14)' : 'rgba(220, 155, 120, 0.12)';
        aCtx.fillRect(sx, sy, sw, 4);
      }

      // Roughness & bump raised face
      const rVal = Math.round(196 + seed * 32);
      rCtx.fillStyle = `rgb(${rVal},${rVal},${rVal})`;
      rCtx.fillRect(bx, by, bw, bh);

      bCtx.fillStyle = 'rgb(208,208,208)';
      bCtx.fillRect(bx, by, bw, bh);
      bCtx.fillStyle = 'rgb(176,176,176)';
      bCtx.fillRect(bx + 3, by + 3, bw - 6, bh - 6);
    }
  }

  return {
    map: finalizeCanvasTexture(albedoSetup.canvas, THREE.SRGBColorSpace, 1, 1),
    roughnessMap: finalizeCanvasTexture(roughSetup.canvas, THREE.NoColorSpace, 1, 1),
    bumpMap: finalizeCanvasTexture(bumpSetup.canvas, THREE.NoColorSpace, 1, 1),
  };
}

/**
 * 3-map Procedural Limestone PBR for Tier 2 Plinth Skirt & Fluted Coping Cap.
 */
function createLimestonePbrSet(): PbrMapTriplet {
  const size = 256;
  const albedoSetup = makeCanvas(size, size);
  const roughSetup = makeCanvas(size, size);
  const bumpSetup = makeCanvas(size, size);
  if (!albedoSetup || !roughSetup || !bumpSetup) {
    return {
      map: createSolidFallbackTexture(216, 205, 186, 255, THREE.SRGBColorSpace),
      roughnessMap: createSolidFallbackTexture(210, 210, 210, 255),
      bumpMap: createSolidFallbackTexture(128, 128, 128, 255),
    };
  }
  const aCtx = albedoSetup.ctx;
  const rCtx = roughSetup.ctx;
  const bCtx = bumpSetup.ctx;

  aCtx.fillStyle = '#d9cfbd';
  aCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = 'rgb(212,212,212)';
  rCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = 'rgb(128,128,128)';
  bCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 480; i++) {
    const px = hash2D(i, 3.1) * size;
    const py = hash2D(7.4, i) * size;
    const rad = 2 + hash2D(i * 1.9, 2.2) * 8;
    const light = hash2D(i, 11.7) > 0.45;
    aCtx.fillStyle = light ? 'rgba(244, 238, 226, 0.22)' : 'rgba(164, 152, 134, 0.18)';
    aCtx.beginPath();
    aCtx.arc(px, py, rad, 0, Math.PI * 2);
    aCtx.fill();
    bCtx.fillStyle = light ? 'rgba(155,155,155,0.22)' : 'rgba(104,104,104,0.22)';
    bCtx.beginPath();
    bCtx.arc(px, py, rad, 0, Math.PI * 2);
    bCtx.fill();
  }

  return {
    map: finalizeCanvasTexture(albedoSetup.canvas, THREE.SRGBColorSpace),
    roughnessMap: finalizeCanvasTexture(roughSetup.canvas, THREE.NoColorSpace),
    bumpMap: finalizeCanvasTexture(bumpSetup.canvas, THREE.NoColorSpace),
  };
}

/**
 * 3-map Procedural Ashlar Granite Paver PBR for Tier 4 Foundation Pad.
 */
function createGranitePaverPbrSet(): PbrMapTriplet {
  const size = 512;
  const albedoSetup = makeCanvas(size, size);
  const roughSetup = makeCanvas(size, size);
  const bumpSetup = makeCanvas(size, size);
  if (!albedoSetup || !roughSetup || !bumpSetup) {
    return {
      map: createSolidFallbackTexture(142, 150, 160, 255, THREE.SRGBColorSpace),
      roughnessMap: createSolidFallbackTexture(210, 210, 210, 255),
      bumpMap: createSolidFallbackTexture(128, 128, 128, 255),
    };
  }
  const aCtx = albedoSetup.ctx;
  const rCtx = roughSetup.ctx;
  const bCtx = bumpSetup.ctx;

  aCtx.fillStyle = '#5c636c';
  aCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = 'rgb(235,235,235)';
  rCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = 'rgb(66,66,66)';
  bCtx.fillRect(0, 0, size, size);

  const tiles = 4;
  const tileS = size / tiles;
  const tones = ['#8b939d', '#7e8690', '#969ea8', '#838b96'];
  for (let r = 0; r < tiles; r++) {
    const stagger = (r % 2) * (tileS * 0.5);
    for (let c = -1; c <= tiles; c++) {
      const tx = c * tileS + stagger + 4;
      const ty = r * tileS + 4;
      const tw = tileS - 8;
      aCtx.fillStyle = tones[(r * 3 + Math.abs(c) * 5) % tones.length];
      aCtx.fillRect(tx, ty, tw, tw);

      aCtx.fillStyle = 'rgba(235, 240, 248, 0.16)';
      aCtx.fillRect(tx, ty, tw, 4);
      rCtx.fillStyle = 'rgb(192,192,192)';
      rCtx.fillRect(tx, ty, tw, tw);
      bCtx.fillStyle = 'rgb(198,198,198)';
      bCtx.fillRect(tx, ty, tw, tw);
    }
  }

  // Granite mineral salt-and-pepper grain
  for (let i = 0; i < 1200; i++) {
    const px = hash2D(i * 1.31, 9.4) * size;
    const py = hash2D(2.7, i * 1.93) * size;
    const light = hash2D(i, 41.2) > 0.45;
    aCtx.fillStyle = light ? 'rgba(230, 236, 244, 0.24)' : 'rgba(54, 60, 68, 0.24)';
    aCtx.fillRect(px, py, 3, 3);
    bCtx.fillStyle = light ? 'rgba(218, 218, 218, 0.24)' : 'rgba(130, 130, 130, 0.24)';
    bCtx.fillRect(px, py, 3, 3);
  }

  return {
    map: finalizeCanvasTexture(albedoSetup.canvas, THREE.SRGBColorSpace),
    roughnessMap: finalizeCanvasTexture(roughSetup.canvas, THREE.NoColorSpace),
    bumpMap: finalizeCanvasTexture(bumpSetup.canvas, THREE.NoColorSpace),
  };
}

/**
 * 3-map Woven Coir / Wicker Basket PBR for Tier 4 Hanging Petunia Baskets.
 */
function createWickerPbrSet(): PbrMapTriplet {
  const size = 256;
  const albedoSetup = makeCanvas(size, size);
  const roughSetup = makeCanvas(size, size);
  const bumpSetup = makeCanvas(size, size);
  if (!albedoSetup || !roughSetup || !bumpSetup) {
    return {
      map: createSolidFallbackTexture(168, 118, 72, 255, THREE.SRGBColorSpace),
      roughnessMap: createSolidFallbackTexture(228, 228, 228, 255),
      bumpMap: createSolidFallbackTexture(128, 128, 128, 255),
    };
  }
  const aCtx = albedoSetup.ctx;
  const rCtx = roughSetup.ctx;
  const bCtx = bumpSetup.ctx;

  aCtx.fillStyle = '#734f30';
  aCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = 'rgb(235,235,235)';
  rCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = 'rgb(88,88,88)';
  bCtx.fillRect(0, 0, size, size);

  const cellW = 16;
  const cellH = 12;
  for (let r = 0; r < size / cellH; r++) {
    for (let c = 0; c < size / cellW; c++) {
      const x = c * cellW + (r % 2) * (cellW * 0.5);
      const y = r * cellH;
      const tone = hash2D(c * 7, r * 11) > 0.5 ? '#b98652' : '#a3713f';
      aCtx.fillStyle = tone;
      aCtx.fillRect((x + 1) % size, y + 1, cellW - 2, cellH - 2);
      aCtx.fillStyle = 'rgba(244, 210, 165, 0.24)';
      aCtx.fillRect((x + 2) % size, y + 2, cellW - 4, 2);

      rCtx.fillStyle = 'rgb(205,205,205)';
      rCtx.fillRect((x + 1) % size, y + 1, cellW - 2, cellH - 2);
      bCtx.fillStyle = 'rgb(198,198,198)';
      bCtx.fillRect((x + 1) % size, y + 1, cellW - 2, cellH - 2);
    }
  }

  return {
    map: finalizeCanvasTexture(albedoSetup.canvas, THREE.SRGBColorSpace, 3, 2),
    roughnessMap: finalizeCanvasTexture(roughSetup.canvas, THREE.NoColorSpace, 3, 2),
    bumpMap: finalizeCanvasTexture(bumpSetup.canvas, THREE.NoColorSpace, 3, 2),
  };
}

function createFoliageTexture(): THREE.Texture {
  const setup = makeCanvas(256, 256);
  if (!setup) return createSolidFallbackTexture(74, 148, 72, 255, THREE.SRGBColorSpace);
  const { canvas, ctx } = setup;
  ctx.fillStyle = '#3c8646';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 240; i++) {
    const lx = hash2D(i, 5.2) * 256;
    const ly = hash2D(8.9, i) * 256;
    const ang = hash2D(i * 1.7, 3.3) * Math.PI * 2;
    const light = hash2D(i, 19.1) > 0.45;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(ang);
    ctx.fillStyle = light ? '#64b358' : '#32723c';
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(182, 232, 134, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(10, 0);
    ctx.stroke();
    ctx.restore();
  }
  return finalizeCanvasTexture(canvas, THREE.SRGBColorSpace);
}

function createPetuniaPetalTexture(): THREE.Texture {
  const setup = makeCanvas(128, 128);
  if (!setup) return createSolidFallbackTexture(248, 224, 236, 255, THREE.SRGBColorSpace);
  const { canvas, ctx } = setup;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0.0, '#fff7d4');
  g.addColorStop(0.22, '#ffffff');
  g.addColorStop(0.85, '#f2dde8');
  g.addColorStop(1.0, '#e4bfd2');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);

  // 5 delicate radial petal veins
  ctx.strokeStyle = 'rgba(205, 112, 152, 0.25)';
  ctx.lineWidth = 2;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(64, 64);
    ctx.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58);
    ctx.stroke();
  }
  return finalizeCanvasTexture(canvas, THREE.SRGBColorSpace);
}

/**
 * 2-Zone UV texture for Vintage Edison Filament Bulbs:
 * - Lower / outer pear envelope (`v in [0..0.55]`): warm golden-cream incandescent glass
 * - Center/inner U-loop filament (`v in [0.55..1.0]`): white-hot glowing tungsten filament
 */
export function createEdisonBulbTextures(): { map: THREE.Texture; emissiveMap: THREE.Texture } {
  const w = 128;
  const h = 128;
  const mapSetup = makeCanvas(w, h);
  const emSetup = makeCanvas(w, h);
  if (!mapSetup || !emSetup) {
    return {
      map: createSolidFallbackTexture(255, 224, 148, 255, THREE.SRGBColorSpace),
      emissiveMap: createSolidFallbackTexture(255, 206, 108, 255, THREE.SRGBColorSpace),
    };
  }
  const mCtx = mapSetup.ctx;
  const eCtx = emSetup.ctx;

  // Translucent-looking warm champagne-amber glass envelope
  const bulbGrad = mCtx.createLinearGradient(0, 0, 0, h);
  bulbGrad.addColorStop(0.0, '#f8d27c');
  bulbGrad.addColorStop(0.55, '#eab352');
  bulbGrad.addColorStop(1.0, '#cf882a');
  mCtx.fillStyle = bulbGrad;
  mCtx.fillRect(0, 0, w, h);

  // Deeper golden-amber envelope emissive keeps filament loops crisp & high-contrast at night
  const emGrad = eCtx.createLinearGradient(0, 0, 0, h);
  emGrad.addColorStop(0.0, '#6a380c');
  emGrad.addColorStop(0.55, '#542a08');
  emGrad.addColorStop(1.0, '#3a1b04');
  eCtx.fillStyle = emGrad;
  eCtx.fillRect(0, 0, w, h);

  // Crisp glowing vintage squirrel-cage / hairpin filament loops around the bulb circumference
  const drawFilamentArcs = (ctx: CanvasRenderingContext2D, strokeColor: string, glowColor: string) => {
    ctx.save();
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const cx of [w * 0.25, w * 0.5, w * 0.75, w * 0.0, w * 1.0]) {
      ctx.beginPath();
      ctx.moveTo(cx - 7, h * 0.80);
      ctx.lineTo(cx - 8, h * 0.34);
      ctx.quadraticCurveTo(cx, h * 0.22, cx + 8, h * 0.34);
      ctx.lineTo(cx + 7, h * 0.80);
      ctx.stroke();
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.0;
    for (const cx of [w * 0.25, w * 0.5, w * 0.75, w * 0.0, w * 1.0]) {
      ctx.beginPath();
      ctx.moveTo(cx - 7, h * 0.80);
      ctx.lineTo(cx - 8, h * 0.34);
      ctx.quadraticCurveTo(cx, h * 0.22, cx + 8, h * 0.34);
      ctx.lineTo(cx + 7, h * 0.80);
      ctx.stroke();
    }
    ctx.restore();
  };

  drawFilamentArcs(mCtx, '#fffcf0', 'rgba(255, 240, 180, 0.55)');
  drawFilamentArcs(eCtx, '#ffffff', 'rgba(255, 212, 118, 0.58)');

  return {
    map: finalizeCanvasTexture(mapSetup.canvas, THREE.SRGBColorSpace),
    emissiveMap: finalizeCanvasTexture(emSetup.canvas, THREE.SRGBColorSpace),
  };
}

/**
 * Dual-zone Lantern Glass UV Atlas:
 * - Left half (`u in [0..0.5]`): Translucent bevelled glass for carriage lanterns (lets bulb + socket show clearly!)
 * - Right half (`u in [0.5..1.0]`): Semi-translucent frosted diffuser for Tier 1 bollards & Tier 3 LED lenses
 */
export function createLanternGlassTexture(): { map: THREE.Texture; emissiveMap: THREE.Texture } {
  const w = 256;
  const h = 128;
  const mapSetup = makeCanvas(w, h);
  const emSetup = makeCanvas(w, h);
  if (!mapSetup || !emSetup) {
    return {
      map: createSolidFallbackTexture(230, 240, 248, 128, THREE.SRGBColorSpace),
      emissiveMap: createSolidFallbackTexture(255, 224, 150, 255, THREE.SRGBColorSpace),
    };
  }

  const mCtx = mapSetup.ctx;
  const eCtx = emSetup.ctx;
  mCtx.clearRect(0, 0, w, h);

  // Left half (u: 0..0.5): Clear/tinted bevelled pane with subtle glossy chamfer edge border
  const half = w / 2;
  mCtx.fillStyle = 'rgba(228, 240, 250, 0.22)';
  mCtx.fillRect(0, 0, half, h);
  mCtx.strokeStyle = 'rgba(255, 250, 232, 0.52)';
  mCtx.lineWidth = 6;
  mCtx.strokeRect(3, 3, half - 6, h - 6);
  // Subtle diagonal bevel reflection streak
  mCtx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  mCtx.beginPath();
  mCtx.moveTo(14, 8);
  mCtx.lineTo(42, 8);
  mCtx.lineTo(24, h - 8);
  mCtx.lineTo(8, h - 8);
  mCtx.closePath();
  mCtx.fill();

  // Right half (u: 0.5..1.0): Frosted semi-translucent diffuser so inner bulb/LED core shows through cleanly
  mCtx.fillStyle = 'rgba(234, 242, 248, 0.72)';
  mCtx.fillRect(half, 0, half, h);
  mCtx.strokeStyle = 'rgba(255, 250, 236, 0.88)';
  mCtx.lineWidth = 5;
  mCtx.strokeRect(half + 2.5, 2.5, half - 5, h - 5);

  // Emissive map: warm frosted bevel highlight on carriage glass + bright warm gradient on Tier 1/3 diffusers
  eCtx.fillStyle = '#382510';
  eCtx.fillRect(0, 0, half, h);
  eCtx.strokeStyle = '#c48a3c';
  eCtx.lineWidth = 6;
  eCtx.strokeRect(3, 3, half - 6, h - 6);

  const diffGrad = eCtx.createRadialGradient(half + half * 0.5, h * 0.5, 4, half + half * 0.5, h * 0.5, half * 0.65);
  diffGrad.addColorStop(0.0, '#fff7dc');
  diffGrad.addColorStop(0.55, '#ffd078');
  diffGrad.addColorStop(1.0, '#d99838');
  eCtx.fillStyle = diffGrad;
  eCtx.fillRect(half, 0, half, h);

  const map = finalizeCanvasTexture(mapSetup.canvas, THREE.SRGBColorSpace);
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  const emissiveMap = finalizeCanvasTexture(emSetup.canvas, THREE.SRGBColorSpace);
  emissiveMap.wrapS = THREE.ClampToEdgeWrapping;
  emissiveMap.wrapT = THREE.ClampToEdgeWrapping;
  return { map, emissiveMap };
}

/**
 * Procedural outdoor Sky-Sun-Ground Equirectangular Environment Texture so `MeshStandardMaterial`
 * gunmetal, brass, and bevelled glass always catch realistic sky & ground specular highlights
 * even when `scene.environment` is unset.
 */
function createOutdoorMetalEnvTexture(): THREE.Texture {
  const setup = makeCanvas(256, 128);
  if (!setup) {
    const tex = createSolidFallbackTexture(190, 210, 228, 255, THREE.SRGBColorSpace);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  }
  const { canvas, ctx } = setup;
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 128);
  skyGrad.addColorStop(0.0, '#69a7e8');
  skyGrad.addColorStop(0.32, '#a7d6ff');
  skyGrad.addColorStop(0.49, '#f6ebd4');
  skyGrad.addColorStop(0.52, '#b9aa8f');
  skyGrad.addColorStop(0.76, '#7a8777');
  skyGrad.addColorStop(1.0, '#5a6359');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 256, 128);

  // Warm sun specular hot-spot in upper sky
  const sunGrad = ctx.createRadialGradient(184, 34, 2, 184, 34, 38);
  sunGrad.addColorStop(0.0, 'rgba(255, 252, 232, 1.0)');
  sunGrad.addColorStop(0.35, 'rgba(255, 240, 195, 0.72)');
  sunGrad.addColorStop(1.0, 'rgba(255, 240, 195, 0.0)');
  ctx.fillStyle = sunGrad;
  ctx.fillRect(140, 0, 90, 76);

  // Counter-fill sky highlight for opposite-facing bevels
  const fillGrad = ctx.createRadialGradient(54, 44, 2, 54, 44, 44);
  fillGrad.addColorStop(0.0, 'rgba(220, 238, 255, 0.75)');
  fillGrad.addColorStop(1.0, 'rgba(220, 238, 255, 0.0)');
  ctx.fillStyle = fillGrad;
  ctx.fillRect(10, 0, 90, 90);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.needsUpdate = true;
  return tex;
}

function createRadialLightPoolTexture(): THREE.Texture {
  if (typeof document === 'undefined') {
    return createSolidFallbackTexture(255, 214, 130, 128, THREE.SRGBColorSpace);
  }
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return createSolidFallbackTexture(255, 214, 130, 128, THREE.SRGBColorSpace);

  const c = size * 0.5;
  if (typeof ctx.createImageData === 'function' && typeof ctx.putImageData === 'function') {
    const img = ctx.createImageData(size, size);
    const data = img.data;
    if (data && data.length >= size * size * 4) {
      for (let py = 0; py < size; py++) {
        const dy = (py + 0.5 - c) / (c - 1.5);
        for (let px = 0; px < size; px++) {
          const dx = (px + 0.5 - c) / (c - 1.5);
          const r = Math.min(1, Math.hypot(dx, dy));
          const falloff = evaluateSmoothRadialGlowFalloff(r);
          const warmMix = Math.min(1, r * 1.15);
          const rr = Math.round(255 - warmMix * 10);
          const gg = Math.round(236 - warmMix * 70);
          const bb = Math.round(178 - warmMix * 112);
          const aa = Math.round(falloff * 218);
          const idx = (py * size + px) * 4;
          data[idx] = rr;
          data[idx + 1] = gg;
          data[idx + 2] = bb;
          data[idx + 3] = aa;
        }
      }
      ctx.putImageData(img, 0, 0);
    }
  } else {
    const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0.0, 'rgba(255, 236, 178, 0.85)');
    grad.addColorStop(0.32, 'rgba(255, 212, 126, 0.48)');
    grad.addColorStop(0.68, 'rgba(250, 184, 88, 0.14)');
    grad.addColorStop(1.0, 'rgba(245, 165, 65, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Smooth Gaussian + raised-cosine radial glow CanvasTexture (C^1 zero at border `r >= 0.96`).
 */
export function createRadialLanternGlowTexture(size = 256): THREE.Texture {
  if (typeof document === 'undefined') {
    return createSolidFallbackTexture(255, 224, 148, 160, THREE.SRGBColorSpace);
  }
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return createSolidFallbackTexture(255, 224, 148, 160, THREE.SRGBColorSpace);

  const c = size * 0.5;
  if (typeof ctx.createImageData === 'function' && typeof ctx.putImageData === 'function') {
    const img = ctx.createImageData(size, size);
    const data = img.data;
    if (data && data.length >= size * size * 4) {
      for (let py = 0; py < size; py++) {
        const dy = (py + 0.5 - c) / (c - 2.0);
        for (let px = 0; px < size; px++) {
          const dx = (px + 0.5 - c) / (c - 2.0);
          const r = Math.min(1, Math.hypot(dx, dy));
          const alpha01 = evaluateSmoothRadialGlowFalloff(r);
          // Warm ivory-gold core -> rich golden amber mid -> soft warm honey outer halo
          const tColor = Math.min(1, r / 0.85);
          const rr = 255;
          const gg = Math.round(248 - tColor * 92);
          const bb = Math.round(220 - tColor * 158);
          const idx = (py * size + px) * 4;
          data[idx] = rr;
          data[idx + 1] = gg;
          data[idx + 2] = bb;
          data[idx + 3] = Math.round(alpha01 * 255);
        }
      }
      ctx.putImageData(img, 0, 0);
    }
  } else {
    const grad = ctx.createRadialGradient(c, c, 1, c, c, c);
    grad.addColorStop(0.0, 'rgba(255, 248, 220, 1.0)');
    grad.addColorStop(0.24, 'rgba(255, 214, 128, 0.52)');
    grad.addColorStop(0.62, 'rgba(255, 178, 78, 0.14)');
    grad.addColorStop(0.96, 'rgba(255, 156, 62, 0.0)');
    grad.addColorStop(1.0, 'rgba(255, 156, 62, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export interface LanternBillboardMaterialHandle {
  material: THREE.ShaderMaterial;
  setOpacity: (opacity: number) => void;
  setColor: (color: THREE.ColorRepresentation) => void;
  setTime: (timeSec: number) => void;
}

/**
 * Camera-facing GPU-instanced additive radial billboard shader with subtle camera-distance scaling:
 * - Zero crossed-quad / faceted-sphere clipping into lantern mullions or hanging flower baskets
 * - Compact at close range so frames & Edison filaments stay crisp, gently scaled far away for readability
 * - Fog-aware attenuation so distant additive sprites blend softly into scene fog with zero square borders
 */
export function createLanternBillboardGlowMaterial(
  glowTex: THREE.Texture,
  options?: {
    color?: THREE.ColorRepresentation;
    opacity?: number;
  },
): LanternBillboardMaterialHandle {
  const initialOpacity = options?.opacity ?? 0.0;
  const cfg = LANTERN_BILLBOARD_CONFIG;

  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uMap: { value: glowTex },
        uColor: { value: new THREE.Color(options?.color ?? '#ffd984') },
        uOpacity: { value: initialOpacity },
        uTime: { value: 0.0 },
        uNearScale: { value: cfg.nearScaleMultiplier },
        uFarScale: { value: cfg.farScaleMultiplier },
        uNearDist: { value: cfg.nearDistanceMeters },
        uFarDist: { value: cfg.farDistanceMeters },
        uCloseOpacityMin: { value: cfg.closeOpacityMin },
        uCloseOpacityNearDist: { value: cfg.closeOpacityNearDist },
        uCloseOpacityFullDist: { value: cfg.closeOpacityFullDist },
        uFarBoostMax: { value: cfg.farBoostMax },
        uFarBoostStartDist: { value: cfg.farBoostStartDist },
        uFarBoostEndDist: { value: cfg.farBoostEndDist },
        uFarDepthNudgeMax: { value: cfg.farDepthNudgeMax },
        uFarDepthNudgeStartDist: { value: cfg.farDepthNudgeStartDist },
        uFarDepthNudgeEndDist: { value: cfg.farDepthNudgeEndDist },
      },
    ]),
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: true,
    toneMapped: false,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uNearScale;
      uniform float uFarScale;
      uniform float uNearDist;
      uniform float uFarDist;
      uniform float uFarDepthNudgeMax;
      uniform float uFarDepthNudgeStartDist;
      uniform float uFarDepthNudgeEndDist;

      varying vec2 vUv;
      varying float vCamDist;
      varying vec3 vInstTint;

      void main() {
        vUv = uv;
        #ifdef USE_INSTANCING_COLOR
          vInstTint = instanceColor;
        #else
          vInstTint = vec3(1.0);
        #endif

        #ifdef USE_INSTANCING
          mat4 worldMat = modelMatrix * instanceMatrix;
        #else
          mat4 worldMat = modelMatrix;
        #endif

        vec3 worldCenter = worldMat[3].xyz;
        float baseSize = length(worldMat[0].xyz);
        vec4 mvCenter = viewMatrix * vec4(worldCenter, 1.0);
        float camDist = max(0.5, -mvCenter.z);
        vCamDist = camDist;

        float distT = smoothstep(uNearDist, uFarDist, camDist);
        float scaleMult = mix(uNearScale, uFarScale, distT);
        float quadSize = baseSize * scaleMult;

        vec4 mvPosition = mvCenter;
        mvPosition.xy += position.xy * quadSize;
        mvPosition.z += uFarDepthNudgeMax * smoothstep(uFarDepthNudgeStartDist, uFarDepthNudgeEndDist, camDist);

        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform sampler2D uMap;
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;
      uniform float uCloseOpacityMin;
      uniform float uCloseOpacityNearDist;
      uniform float uCloseOpacityFullDist;
      uniform float uFarBoostMax;
      uniform float uFarBoostStartDist;
      uniform float uFarBoostEndDist;

      varying vec2 vUv;
      varying float vCamDist;
      varying vec3 vInstTint;

      void main() {
        if (uOpacity <= 0.001) discard;
        vec4 texel = texture2D(uMap, vUv);
        float radialDist = length(vUv - 0.5) * 2.0;
        float edgeFade = 1.0 - smoothstep(0.68, 0.98, radialDist);

        float closeDamp = mix(uCloseOpacityMin, 1.0, smoothstep(uCloseOpacityNearDist, uCloseOpacityFullDist, vCamDist));
        float farBoost = mix(1.0, uFarBoostMax, smoothstep(uFarBoostStartDist, uFarBoostEndDist, vCamDist));
        float shimmer = 0.97 + 0.03 * sin(uTime * 2.2);

        float alpha = clamp(texel.a * edgeFade * uOpacity * closeDamp * farBoost * shimmer, 0.0, 1.0);

        #ifdef USE_FOG
          #ifdef FOG_EXP2
            float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
          #else
            float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
          #endif
          alpha *= (1.0 - fogFactor * 0.85);
        #endif

        if (alpha <= 0.001) discard;
        vec3 glowCol = texel.rgb * uColor * vInstTint;
        gl_FragColor = vec4(glowCol, alpha);
      }
    `,
  });
  material.opacity = initialOpacity;

  return {
    material,
    setOpacity(opacity: number) {
      const clamped = Math.max(0, Math.min(1, Number.isFinite(opacity) ? opacity : 0));
      material.uniforms.uOpacity.value = clamped;
      material.opacity = clamped;
    },
    setColor(color: THREE.ColorRepresentation) {
      (material.uniforms.uColor.value as THREE.Color).set(color);
    },
    setTime(timeSec: number) {
      material.uniforms.uTime.value = Number.isFinite(timeSec) ? timeSec : 0;
    },
  };
}

function createWindowPaneGlowTexture(): THREE.Texture {
  if (typeof document === 'undefined') {
    return createSolidFallbackTexture(255, 224, 152, 230, THREE.SRGBColorSpace);
  }
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return createSolidFallbackTexture(255, 224, 152, 230, THREE.SRGBColorSpace);

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0.0, 'rgba(255, 246, 212, 0.96)');
  grad.addColorStop(0.65, 'rgba(255, 224, 148, 0.92)');
  grad.addColorStop(1.0, 'rgba(246, 182, 92, 0.88)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = 'rgba(54, 42, 34, 0.36)';
  ctx.fillRect(0, 0, size, 6);
  ctx.fillRect(0, size - 6, size, 6);
  ctx.fillRect(0, 0, 6, size);
  ctx.fillRect(size - 6, 0, 6, size);
  ctx.fillRect(size * 0.5 - 2, 0, 4, size);
  ctx.fillRect(0, size * 0.48 - 2, size, 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Shared 4-sided Square-Tapering Bevelled Carriage Lantern builder (Tier 2 & Tier 4)
 * matching the model sheets 1:1:
 * - Molded square base cup & brass filament socket
 * - 4 diagonal square-section corner mullions + hinged frame clasp detail
 * - Clear/translucent bevelled glass housing + glowing Vintage Edison pear filament bulb
 * - Overhanging molded cornice + stepped pyramidal pagoda roof + 4 raised hip ribs + turned finial
 */
function buildSquareCarriageLanternParts(opts: {
  cx: number;
  baseY: number;
  cz: number;
  scale: number;
  includeHingeLatch?: boolean;
}): {
  ironParts: THREE.BufferGeometry[];
  glassParts: THREE.BufferGeometry[];
  bulbParts: THREE.BufferGeometry[];
  haloY: number;
} {
  const { cx, baseY, cz, scale: s, includeHingeLatch = false } = opts;
  const ironParts: THREE.BufferGeometry[] = [];
  const glassParts: THREE.BufferGeometry[] = [];
  const bulbParts: THREE.BufferGeometry[] = [];

  // 1. Turned base cup & square lower sill frame
  ironParts.push(
    remapGeoUvs(
      makeLatheGeo(
        [
          [0.0, 0.0],
          [0.058 * s, 0.0],
          [0.086 * s, 0.018 * s],
          [0.072 * s, 0.032 * s],
          [0.095 * s, 0.044 * s],
          [0.0, 0.044 * s],
        ],
        10,
        cx,
        baseY,
        cz,
      ),
      0.04,
      0.78,
    ),
    remapGeoUvs(makeTranslatedBox(0.172 * s, 0.022 * s, 0.172 * s, cx, baseY + 0.048 * s, cz), 0.05, 0.75),
  );

  // 2. Cage taper bounds & 4 diagonal corner mullions
  const cageY0 = baseY + 0.054 * s;
  const cageH = 0.245 * s;
  const cageY1 = cageY0 + cageH;
  const hw0 = 0.078 * s;
  const hw1 = 0.128 * s;

  const corners: Array<[number, number]> = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  for (const [sx, sz] of corners) {
    const p0 = new THREE.Vector3(cx + sx * hw0, cageY0 - 0.004 * s, cz + sz * hw0);
    const p1 = new THREE.Vector3(cx + sx * hw1, cageY1 + 0.006 * s, cz + sz * hw1);
    const mullion = makeStrutBetween(p0, p1, 0.0115 * s, 0.0105 * s, 4, Math.PI / 4);
    if (mullion) ironParts.push(remapGeoUvs(mullion, 0.04, 0.75));
  }

  // Optional hinged cage knuckles & clasp latch (brass UV accent on Tier 2 / close-up lanterns)
  if (includeHingeLatch) {
    const midY = (cageY0 + cageY1) * 0.5;
    const hwMid = (hw0 + hw1) * 0.5;
    // Left hinge knuckles
    for (const hy of [cageY0 + cageH * 0.26, cageY0 + cageH * 0.74]) {
      const t = (hy - cageY0) / cageH;
      const hw = hw0 + (hw1 - hw0) * t;
      ironParts.push(
        remapGeoUvs(
          makeTranslatedCylinder(0.009 * s, 0.009 * s, 0.026 * s, 8, cx - hw - 0.006 * s, hy, cz + hw + 0.002 * s),
          0.88,
          0.98,
        ),
      );
    }
    // Right door clasp latch
    ironParts.push(
      remapGeoUvs(
        makeTranslatedBox(0.016 * s, 0.032 * s, 0.018 * s, cx + hwMid + 0.008 * s, midY, cz + hwMid + 0.004 * s),
        0.88,
        0.98,
      ),
    );
  }

  // 3. Upper molded cornice rim + stepped eaves
  ironParts.push(
    remapGeoUvs(makeTranslatedBox(0.278 * s, 0.016 * s, 0.278 * s, cx, cageY1 + 0.004 * s, cz), 0.04, 0.78),
    remapGeoUvs(makeTranslatedBox(0.326 * s, 0.020 * s, 0.326 * s, cx, cageY1 + 0.020 * s, cz), 0.04, 0.78),
  );

  // 4. Stepped 4-sided pyramidal pagoda roof + 4 diagonal raised hip ribs + cupola + turned finial
  const roofBaseY = cageY1 + 0.030 * s;
  const roofH = 0.095 * s;
  const roofTopY = roofBaseY + roofH;
  const roofHwBot = 0.156 * s;
  const roofHwTop = 0.040 * s;
  ironParts.push(
    remapGeoUvs(
      makeTranslatedCylinder(
        roofHwTop * Math.SQRT2,
        roofHwBot * Math.SQRT2,
        roofH,
        4,
        cx,
        roofBaseY + roofH * 0.5,
        cz,
        0,
        Math.PI / 4,
        0,
      ),
      0.04,
      0.80,
    ),
  );
  for (const [sx, sz] of corners) {
    const p0 = new THREE.Vector3(cx + sx * (roofHwBot - 0.002 * s), roofBaseY, cz + sz * (roofHwBot - 0.002 * s));
    const p1 = new THREE.Vector3(cx + sx * roofHwTop, roofTopY, cz + sz * roofHwTop);
    const hip = makeStrutBetween(p0, p1, 0.008 * s, 0.010 * s, 4, Math.PI / 4);
    if (hip) ironParts.push(remapGeoUvs(hip, 0.06, 0.76));
  }
  // Cupola neck + stepped cap + turned ball/acorn finial
  ironParts.push(
    remapGeoUvs(makeTranslatedBox(0.088 * s, 0.018 * s, 0.088 * s, cx, roofTopY + 0.009 * s, cz), 0.04, 0.78),
    remapGeoUvs(
      makeLatheGeo(
        [
          [0.0, 0.0],
          [0.052 * s, 0.0],
          [0.032 * s, 0.018 * s],
          [0.015 * s, 0.024 * s],
          [0.024 * s, 0.038 * s],
          [0.022 * s, 0.054 * s],
          [0.008 * s, 0.066 * s],
          [0.0, 0.076 * s],
        ],
        10,
        cx,
        roofTopY + 0.018 * s,
        cz,
      ),
      0.04,
      0.82,
    ),
  );

  // 5. Brass Edison Bulb Socket (UV mapped to antique brass zone u in [0.89, 0.98])
  ironParts.push(
    remapGeoUvs(
      makeLatheGeo(
        [
          [0.0, 0.0],
          [0.028 * s, 0.0],
          [0.026 * s, 0.010 * s],
          [0.019 * s, 0.018 * s],
          [0.021 * s, 0.046 * s],
          [0.017 * s, 0.052 * s],
          [0.0, 0.052 * s],
        ],
        10,
        cx,
        cageY0,
        cz,
      ),
      0.89,
      0.98,
    ),
  );

  // 6. Visible Glowing Vintage Edison Pear Filament Bulb (`bulbParts`)
  bulbParts.push(
    makeLatheGeo(
      [
        [0.0, 0.0],
        [0.016 * s, 0.002 * s],
        [0.020 * s, 0.018 * s],
        [0.033 * s, 0.048 * s],
        [0.036 * s, 0.070 * s],
        [0.027 * s, 0.092 * s],
        [0.012 * s, 0.104 * s],
        [0.0, 0.108 * s],
      ],
      12,
      cx,
      cageY0 + 0.048 * s,
      cz,
    ),
  );

  // 7. Translucent Bevelled Glass Housing (4 open-ended trapezoidal panes, each UV mapped cleanly to [0.02..0.48])
  const rawGlassCyl = new THREE.CylinderGeometry(
    (hw1 - 0.004 * s) * Math.SQRT2,
    (hw0 - 0.004 * s) * Math.SQRT2,
    cageH * 0.96,
    4,
    1,
    true,
  );
  rawGlassCyl.rotateY(Math.PI / 4);
  rawGlassCyl.translate(cx, (cageY0 + cageY1) * 0.5, cz);
  const glassGeo = rawGlassCyl.toNonIndexed();
  rawGlassCyl.dispose();
  glassGeo.computeVertexNormals();
  const gUv = glassGeo.getAttribute('uv');
  // Each quad face has 6 vertices (2 triangles); normalize its u span to [0.02..0.48] so every pane gets crisp bevel edges
  for (let faceStart = 0; faceStart + 5 < gUv.count; faceStart += 6) {
    let minU = Infinity;
    let maxU = -Infinity;
    for (let k = 0; k < 6; k++) {
      const u = gUv.getX(faceStart + k);
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
    }
    const spanU = Math.max(1e-4, maxU - minU);
    for (let k = 0; k < 6; k++) {
      const uNorm = (gUv.getX(faceStart + k) - minU) / spanU;
      const vNorm = gUv.getY(faceStart + k);
      gUv.setXY(faceStart + k, 0.02 + uNorm * 0.46, 0.02 + vNorm * 0.96);
    }
  }
  gUv.needsUpdate = true;
  glassParts.push(glassGeo);

  return {
    ironParts,
    glassParts,
    bulbParts,
    haloY: cageY0 + cageH * 0.48,
  };
}

/**
 * Tier 1 (~0.45m local, ~0.65m scaled): Dark forged-gunmetal Ground Bollard / Pathway Spike Light.
 */
function buildTier1BollardGeos() {
  const metalGeo = remapGeoUvs(
    mergeNormalizedGeos([
      makeTranslatedCylinder(0.115, 0.125, 0.04, 14, 0, 0.02, 0),
      makeTranslatedCylinder(0.074, 0.082, 0.25, 14, 0, 0.165, 0),
      makeTranslatedRoundedBox(0.018, 0.095, 0.018, 0.004, 0.068, 0.335, 0),
      makeTranslatedRoundedBox(0.018, 0.095, 0.018, 0.004, -0.068, 0.335, 0),
      makeTranslatedRoundedBox(0.018, 0.095, 0.018, 0.004, 0, 0.335, 0.068),
      makeTranslatedRoundedBox(0.018, 0.095, 0.018, 0.004, 0, 0.335, -0.068),
      makeLatheGeo(
        [
          [0.0, 0.382],
          [0.096, 0.382],
          [0.094, 0.402],
          [0.072, 0.428],
          [0.030, 0.448],
          [0.0, 0.454],
        ],
        14,
      ),
    ]),
    0.04,
    0.82,
  );
  const glassGeo = remapGeoUvs(
    makeTranslatedCylinder(0.058, 0.058, 0.088, 14, 0, 0.335, 0),
    0.55,
    0.95,
    0.05,
    0.95,
  );
  // Warm inner incandescent emitter core inside the bollard diffuser cage
  const bulbGeo = makeTranslatedCylinder(0.024, 0.024, 0.066, 10, 0, 0.335, 0);
  return { metalGeo, glassGeo, bulbGeo, lanternY: 0.335 };
}

/**
 * Tier 2 (~1.96m local, ~2.98m @ 1.52x world):
 * Stately Running-Bond Brick Pier + Chamfered Limestone Coping + Turned Iron Pedestal & Carriage Lantern
 * (strict vertical stacking: stone plinth 0..0.14m -> brick pier 0.14..0.88m -> stone cap 0.88..0.96m -> iron 0.96..1.96m).
 */
function buildTier2PedestalGeos() {
  // 1. 3D Sculpted Running-Bond Brick Pillar (`y = 0.138 .. 0.878`, 11 courses)
  const pillarY0 = 0.138;
  const pillarH = 0.740;
  const brickParts: THREE.BufferGeometry[] = [
    makeTranslatedBox(0.366, pillarH, 0.366, 0, pillarY0 + pillarH * 0.5, 0),
  ];
  const courses = 11;
  const courseH = pillarH / courses;
  const brickH = courseH - 0.007;
  const halfCore = 0.191;
  const brickDepth = 0.022;

  for (let r = 0; r < courses; r++) {
    const cy = pillarY0 + (r + 0.5) * courseH;
    const isEven = r % 2 === 0;
    const segs: ReadonlyArray<readonly [number, number]> = isEven
      ? [
          [-0.096, 0.184],
          [0.096, 0.184],
        ]
      : [
          [-0.145, 0.088],
          [0.0, 0.182],
          [0.145, 0.088],
        ];
    for (const [offset, width] of segs) {
      const fz = makeTranslatedRoundedBox(width, brickH, brickDepth, 0.004, offset, cy, halfCore - brickDepth * 0.5, 0, 0, 0, 1);
      scaleGeoUvs(fz, width / 0.25, brickH / 0.15);
      brickParts.push(fz);

      const bz = makeTranslatedRoundedBox(width, brickH, brickDepth, 0.004, -offset, cy, -(halfCore - brickDepth * 0.5), 0, 0, 0, 1);
      scaleGeoUvs(bz, width / 0.25, brickH / 0.15);
      brickParts.push(bz);

      const px = makeTranslatedRoundedBox(brickDepth, brickH, width, 0.004, halfCore - brickDepth * 0.5, cy, -offset, 0, 0, 0, 1);
      scaleGeoUvs(px, width / 0.25, brickH / 0.15);
      brickParts.push(px);

      const nx = makeTranslatedRoundedBox(brickDepth, brickH, width, 0.004, -(halfCore - brickDepth * 0.5), cy, offset, 0, 0, 0, 1);
      scaleGeoUvs(nx, width / 0.25, brickH / 0.15);
      brickParts.push(nx);
    }
  }
  const brickGeo = mergeNormalizedGeos(brickParts);

  // 2. Chamfered Limestone Footing Plinth (`y = 0 .. 0.14m`) + Fluted Limestone Coping Cap (`y = 0.878 .. 0.962m`)
  const stoneParts: THREE.BufferGeometry[] = [
    makeTranslatedRoundedBox(0.456, 0.076, 0.456, 0.014, 0, 0.038, 0),
    makeTranslatedRoundedBox(0.412, 0.064, 0.412, 0.012, 0, 0.106, 0),
    makeTranslatedCylinder(0.224 * Math.SQRT2, 0.198 * Math.SQRT2, 0.020, 4, 0, 0.888, 0, 0, Math.PI / 4, 0),
    makeTranslatedRoundedBox(0.448, 0.028, 0.448, 0.008, 0, 0.912, 0),
    makeTranslatedRoundedBox(0.458, 0.016, 0.458, 0.005, 0, 0.934, 0),
    makeTranslatedCylinder(0.165 * Math.SQRT2, 0.228 * Math.SQRT2, 0.020, 4, 0, 0.952, 0, 0, Math.PI / 4, 0),
  ];
  const stoneGeo = mergeNormalizedGeos(stoneParts);

  // 3. Cast-Iron Foundation Plate + Fluted Post (`y = 0.962 .. 1.375m`) + Carriage Lantern (`y = 1.375 .. 1.96m`)
  const topGeos = buildTier2TopLanternGeos(0.962);

  return {
    brickGeo,
    stoneGeo,
    ironFrameGeo: topGeos.ironFrameGeo,
    glassGeo: topGeos.glassGeo,
    bulbGeo: topGeos.bulbGeo,
    lanternY: topGeos.lanternY,
  };
}

/**
 * Shared upper Tier-2 carriage-lantern assembly (cast-iron anchor plate + bolts + turned pedestal +
 * square carriage lantern) positioned relative to `plateBottomY` (`0.962` above ground on brick piers,
 * or `0.0` directly atop stone balustrade end-piers).
 */
function buildTier2TopLanternGeos(plateBottomY: number) {
  const yOff = plateBottomY - 0.962;
  const ironParts: THREE.BufferGeometry[] = [
    remapGeoUvs(makeTranslatedRoundedBox(0.256, 0.024, 0.256, 0.006, 0, 0.974 + yOff, 0), 0.04, 0.80),
  ];
  for (const bx of [-0.096, 0.096]) {
    for (const bz of [-0.096, 0.096]) {
      ironParts.push(
        remapGeoUvs(makeTranslatedCylinder(0.018, 0.018, 0.008, 10, bx, 0.990 + yOff, bz), 0.06, 0.78),
        remapGeoUvs(makeTranslatedCylinder(0.012, 0.012, 0.014, 6, bx, 1.001 + yOff, bz), 0.06, 0.78),
      );
    }
  }
  ironParts.push(
    remapGeoUvs(
      makeLatheGeo(
        [
          [0.0, 0.0],
          [0.112, 0.0],
          [0.102, 0.024],
          [0.072, 0.055],
          [0.064, 0.145],
          [0.082, 0.175],
          [0.058, 0.205],
          [0.052, 0.340],
          [0.078, 0.372],
          [0.068, 0.392],
          [0.0, 0.392],
        ],
        14,
        0,
        0.986 + yOff,
        0,
      ),
      0.04,
      0.82,
    ),
  );

  const lantern = buildSquareCarriageLanternParts({
    cx: 0,
    baseY: 1.375 + yOff,
    cz: 0,
    scale: 1.04,
    includeHingeLatch: true,
  });
  ironParts.push(...lantern.ironParts);

  return {
    ironFrameGeo: mergeNormalizedGeos(ironParts),
    glassGeo: mergeNormalizedGeos(lantern.glassParts),
    bulbGeo: mergeNormalizedGeos(lantern.bulbParts),
    lanternY: lantern.haloY,
  };
}

/**
 * Shared mast parts for modernized Tier 3 LED streetlamps (~4.62m total height):
 * chamfered square base plate + tapered octagonal boot shroud + cylindrical collar +
 * slim tapered mast + upper mounting sleeve & rounded pole finial cap.
 */
function buildTier3ModernMastParts(): THREE.BufferGeometry[] {
  const finialCap = new THREE.SphereGeometry(0.075, 12, 8);
  finialCap.scale(1, 0.72, 1);
  finialCap.translate(0, 4.56, 0);

  return [
    makeTranslatedRoundedBox(0.42, 0.04, 0.42, 0.010, 0, 0.02, 0),
    makeTranslatedRoundedBox(0.36, 0.025, 0.36, 0.008, 0, 0.0525, 0),
    makeTranslatedCylinder(0.185, 0.21, 0.16, 8, 0, 0.14, 0, 0, Math.PI / 8, 0),
    makeTranslatedCylinder(0.13, 0.175, 0.57, 8, 0, 0.495, 0, 0, Math.PI / 8, 0),
    makeTranslatedCylinder(0.112, 0.14, 0.14, 12, 0, 0.84, 0),
    makeTranslatedCylinder(0.072, 0.095, 3.47, 12, 0, 2.615, 0),
    makeLatheGeo(
      [
        [0.0, 3.92],
        [0.118, 3.92],
        [0.122, 4.02],
        [0.114, 4.26],
        [0.096, 4.30],
        [0.076, 4.32],
        [0.0, 4.32],
      ],
      14,
    ),
    makeTranslatedCylinder(0.074, 0.078, 0.27, 12, 0, 4.425, 0),
    finialCap,
    makeTranslatedCylinder(0.022, 0.03, 0.02, 10, 0, 4.61, 0),
  ];
}

function buildModernLedArmAndHeadParts(
  dirAngleY: number,
  armReachZ: number,
  headCenterZ: number,
): { metalParts: THREE.BufferGeometry[]; glassParts: THREE.BufferGeometry[]; bulbParts: THREE.BufferGeometry[] } {
  const armGeo = makeTubularCurveGeo(
    [
      [0, 4.10, 0.055],
      [0, 4.26, 0.115],
      [0, 4.35, 0.30],
      [0, 4.415, 0.72],
      [0, 4.442, armReachZ - 0.18],
    ],
    14,
    0.040,
    10,
  );
  const collarRing = makeTranslatedCylinder(0.054, 0.058, 0.06, 12, 0, 4.16, 0.08, 0.45, 0, 0);

  const headShape = new THREE.Shape();
  headShape.moveTo(-0.102, -0.448);
  headShape.lineTo(0.102, -0.448);
  headShape.lineTo(0.138, -0.14);
  headShape.lineTo(0.138, 0.33);
  headShape.lineTo(0.095, 0.448);
  headShape.lineTo(-0.095, 0.448);
  headShape.lineTo(-0.138, 0.33);
  headShape.lineTo(-0.138, -0.14);
  headShape.closePath();

  const cobraGeo = new THREE.ExtrudeGeometry(headShape, {
    depth: 0.076,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  cobraGeo.rotateX(Math.PI / 2);
  cobraGeo.translate(0, 4.442, headCenterZ);

  const glassGeo = remapGeoUvs(
    makeTranslatedBox(0.20, 0.024, 0.58, 0, 4.355, headCenterZ),
    0.55,
    0.95,
    0.05,
    0.95,
  );
  // Warm high-emission LED emitter array recessed cleanly inside the translucent lens diffuser
  const bulbGeo = makeTranslatedBox(0.115, 0.014, 0.42, 0, 4.352, headCenterZ);

  if (dirAngleY !== 0) {
    armGeo.rotateY(dirAngleY);
    collarRing.rotateY(dirAngleY);
    cobraGeo.rotateY(dirAngleY);
    glassGeo.rotateY(dirAngleY);
    bulbGeo.rotateY(dirAngleY);
  }

  return {
    metalParts: [armGeo, collarRing, cobraGeo],
    glassParts: [glassGeo],
    bulbParts: [bulbGeo],
  };
}

function buildTier3ModernLedGeos(variant: 'single' | 'corner') {
  const mastParts = buildTier3ModernMastParts();
  if (variant === 'corner') {
    const armX = buildModernLedArmAndHeadParts(Math.PI / 2, 1.36, 1.24);
    const armZ = buildModernLedArmAndHeadParts(0, 1.36, 1.24);
    return {
      metalGeo: mergeNormalizedGeos([...mastParts, ...armX.metalParts, ...armZ.metalParts]),
      glassGeo: mergeNormalizedGeos([...armX.glassParts, ...armZ.glassParts]),
      bulbGeo: mergeNormalizedGeos([...armX.bulbParts, ...armZ.bulbParts]),
      haloOffsets: [
        { dx: 1.24, dy: 4.24, dz: 0 },
        { dx: 0, dy: 4.24, dz: 1.24 },
      ] as const,
    };
  }
  const armSingle = buildModernLedArmAndHeadParts(0, 1.42, 1.28);
  return {
    metalGeo: mergeNormalizedGeos([...mastParts, ...armSingle.metalParts]),
    glassGeo: mergeNormalizedGeos(armSingle.glassParts),
    bulbGeo: mergeNormalizedGeos(armSingle.bulbParts),
    haloOffsets: [{ dx: 0, dy: 4.24, dz: 1.28 }] as const,
  };
}

/**
 * Helper to create a curved wrought-iron scroll ribbon via `THREE.ExtrudeGeometry`
 * from a stroked path centerline in the `(r, y)` arm plane (`z` thickness extruded symmetrically).
 */
function buildScrollBandGeometry(
  pts: ReadonlyArray<readonly [number, number]>,
  halfThickness: number,
  depth: number,
): THREE.BufferGeometry {
  const curvePts = pts.map(([x, y]) => new THREE.Vector2(x, y));
  const curve = new THREE.SplineCurve(curvePts);
  const steps = Math.max(12, pts.length * 4);
  const sampled = curve.getSpacedPoints(steps);

  const leftPts: THREE.Vector2[] = [];
  const rightPts: THREE.Vector2[] = [];
  for (let i = 0; i < sampled.length; i++) {
    const p = sampled[i];
    const prev = sampled[Math.max(0, i - 1)];
    const next = sampled[Math.min(sampled.length - 1, i + 1)];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len;
    const ny = tx / len;
    leftPts.push(new THREE.Vector2(p.x + nx * halfThickness, p.y + ny * halfThickness));
    rightPts.push(new THREE.Vector2(p.x - nx * halfThickness, p.y - ny * halfThickness));
  }

  const shape = new THREE.Shape();
  shape.moveTo(leftPts[0].x, leftPts[0].y);
  for (let i = 1; i < leftPts.length; i++) {
    shape.lineTo(leftPts[i].x, leftPts[i].y);
  }
  for (let i = rightPts.length - 1; i >= 0; i--) {
    shape.lineTo(rightPts[i].x, rightPts[i].y);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.0035,
    bevelSize: 0.0035,
    bevelSegments: 1,
    curveSegments: 6,
  });
  geo.translate(0, 0, -depth * 0.5);
  return geo;
}

/**
 * Tier 4 (~4.80m apex, ~1500mm arm spread, 4-way X-plan arms & 4 hanging petunia baskets):
 * 1:1 Grand Victorian 5-Arm Chandelier Lamppost matching `media_1795019085869_3be0f270.jpg`:
 * - Bevelled ashlar granite paver foundation + stepped collar plinth
 * - Turned cast-iron pedestal base + projecting Molded Maintenance Hatch + turn latch
 * - Vertically fluted cylindrical column + mid-shaft ornate collar + flaring bell capital
 * - 4-way X-plan (`±45°, ±135°`) forged-iron S-scroll & C-scroll filigree brackets
 * - 4 underside scrolled basket hooks + 4x 3-chain hanging harnesses
 * - 4 outer square-tapering carriage lanterns + 1 raised central urn crown lantern (~4.80m apex)
 * - 5 visible brass sockets + glowing Vintage Edison filament bulbs inside clear bevelled glass
 * - 4 Hanging Petunia Wicker Baskets with mounding foliage, cascading trailing vines & pink/rose blossoms
 */
function buildTier4ChandelierGeos() {
  // 1. Granite Paver Foundation (bevelled paver apron + stepped chamfered plinth)
  const graniteBaseGeo = mergeNormalizedGeos([
    makeTranslatedRoundedBox(0.90, 0.075, 0.90, 0.018, 0, 0.0375, 0),
    makeTranslatedCylinder(0.32 * Math.SQRT2, 0.36 * Math.SQRT2, 0.035, 4, 0, 0.0925, 0, 0, Math.PI / 4, 0),
    makeTranslatedRoundedBox(0.62, 0.035, 0.62, 0.010, 0, 0.125, 0),
  ]);

  const ironParts: THREE.BufferGeometry[] = [];

  // 2. Square anchor flange + 4 corner bosses (`y = 0.142 .. 0.185`)
  ironParts.push(remapGeoUvs(makeTranslatedRoundedBox(0.49, 0.042, 0.49, 0.010, 0, 0.163, 0), 0.04, 0.80));
  for (const bx of [-0.205, 0.205]) {
    for (const bz of [-0.205, 0.205]) {
      ironParts.push(
        remapGeoUvs(makeTranslatedCylinder(0.018, 0.022, 0.020, 6, bx, 0.190, bz), 0.06, 0.78),
      );
    }
  }

  // 3. Turned Flared Victorian Pedestal Base (`y = 0.184 .. 1.02m`)
  ironParts.push(
    remapGeoUvs(
      makeLatheGeo(
        [
          [0.0, 0.0],
          [0.238, 0.0],
          [0.228, 0.042],
          [0.204, 0.075],
          [0.220, 0.120],
          [0.186, 0.165],
          [0.178, 0.360],
          [0.144, 0.670],
          [0.172, 0.725],
          [0.156, 0.770],
          [0.168, 0.805],
          [0.116, 0.836],
          [0.0, 0.836],
        ],
        12,
        0,
        0.184,
        0,
      ),
      0.04,
      0.82,
    ),
  );

  // Pedestal base vertical relief flutes around octagonal/round body
  for (let fl = 0; fl < 8; fl++) {
    const a = (fl / 8) * Math.PI * 2 + Math.PI / 8;
    const p0 = new THREE.Vector3(Math.cos(a) * 0.176, 0.36, Math.sin(a) * 0.176);
    const p1 = new THREE.Vector3(Math.cos(a) * 0.144, 0.84, Math.sin(a) * 0.144);
    const rib = makeStrutBetween(p0, p1, 0.011, 0.014, 6, 0);
    if (rib) ironParts.push(remapGeoUvs(rib, 0.04, 0.76));
  }

  // 4. Projecting Molded Maintenance Hatch on front +Z face (`y = 0.40 .. 0.78`)
  ironParts.push(
    remapGeoUvs(makeTranslatedRoundedBox(0.148, 0.36, 0.046, 0.008, 0, 0.59, 0.174, -0.068, 0, 0), 0.06, 0.80),
    remapGeoUvs(makeTranslatedRoundedBox(0.112, 0.30, 0.028, 0.006, 0, 0.59, 0.194, -0.068, 0, 0), 0.04, 0.78),
    remapGeoUvs(makeTranslatedRoundedBox(0.162, 0.026, 0.056, 0.006, 0, 0.768, 0.164, -0.068, 0, 0), 0.06, 0.80),
    remapGeoUvs(makeTranslatedRoundedBox(0.162, 0.026, 0.056, 0.006, 0, 0.412, 0.188, -0.068, 0, 0), 0.06, 0.80),
    remapGeoUvs(makeTranslatedRoundedBox(0.022, 0.036, 0.022, 0.004, 0.036, 0.59, 0.212, -0.068, 0, 0), 0.88, 0.98),
    remapGeoUvs(makeTranslatedCylinder(0.008, 0.008, 0.032, 6, -0.068, 0.69, 0.194, -0.068, 0, 0), 0.88, 0.98),
    remapGeoUvs(makeTranslatedCylinder(0.008, 0.008, 0.032, 6, -0.068, 0.49, 0.208, -0.068, 0, 0), 0.88, 0.98),
  );

  // 5. Cylindrical Fluted Column (`y = 1.02 .. 3.48m`) with mid-column turned collar (`y = 2.02 .. 2.18`)
  ironParts.push(
    // Lower shaft core (`y = 1.02 .. 2.02`)
    remapGeoUvs(makeTranslatedCylinder(0.095, 0.114, 1.00, 12, 0, 1.52, 0), 0.04, 0.82),
    // Mid-shaft ornamental turned collar band (`y = 2.02 .. 2.18`)
    remapGeoUvs(
      makeLatheGeo(
        [
          [0.0, 0.0],
          [0.106, 0.0],
          [0.128, 0.026],
          [0.110, 0.052],
          [0.136, 0.080],
          [0.110, 0.108],
          [0.124, 0.134],
          [0.094, 0.160],
          [0.0, 0.160],
        ],
        12,
        0,
        2.02,
        0,
      ),
      0.04,
      0.82,
    ),
    // Upper fluted shaft core (`y = 2.18 .. 3.46`)
    remapGeoUvs(makeTranslatedCylinder(0.078, 0.094, 1.28, 12, 0, 2.82, 0), 0.04, 0.82),
  );

  // 10 crisp carved vertical flutes along both lower and upper cylindrical shaft segments
  for (let fl = 0; fl < 10; fl++) {
    const a = (fl / 10) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const lowFlute = makeStrutBetween(
      new THREE.Vector3(ca * 0.111, 1.04, sa * 0.111),
      new THREE.Vector3(ca * 0.094, 2.00, sa * 0.094),
      0.011,
      0.013,
      5,
      0,
    );
    if (lowFlute) ironParts.push(remapGeoUvs(lowFlute, 0.06, 0.78));

    const upFlute = makeStrutBetween(
      new THREE.Vector3(ca * 0.092, 2.20, sa * 0.092),
      new THREE.Vector3(ca * 0.077, 3.44, sa * 0.077),
      0.009,
      0.011,
      5,
      0,
    );
    if (upFlute) ironParts.push(remapGeoUvs(upFlute, 0.06, 0.78));
  }

  // 6. Ornate Flaring Bell Capital + Bracket Hub + Central Urn Riser (`y = 3.46 .. 4.18m`)
  ironParts.push(
    remapGeoUvs(
      makeLatheGeo(
        [
          [0.0, 0.0],
          [0.096, 0.0],
          [0.118, 0.022],
          [0.086, 0.045],
          [0.110, 0.120],
          [0.152, 0.195],
          [0.132, 0.225],
          [0.132, 0.375],
          [0.160, 0.405],
          [0.116, 0.440],
          [0.096, 0.510],
          [0.114, 0.575],
          [0.088, 0.640],
          [0.072, 0.695],
          [0.095, 0.720],
          [0.0, 0.720],
        ],
        12,
        0,
        3.46,
        0,
      ),
      0.04,
      0.82,
    ),
  );

  // 7. Central Crown Carriage Lantern (`y = 4.18 .. 4.80m` total apex!)
  const centerLantern = buildSquareCarriageLanternParts({
    cx: 0,
    baseY: 4.18,
    cz: 0,
    scale: 1.18,
    includeHingeLatch: false,
  });
  ironParts.push(...centerLantern.ironParts);
  const glassParts: THREE.BufferGeometry[] = [...centerLantern.glassParts];
  const bulbParts: THREE.BufferGeometry[] = [...centerLantern.bulbParts];

  // 8. 4-Way X-Plan Forged Iron Scrollwork Brackets (`+45°, +135°, -135°, -45°`)
  //    Arm spread ~1520mm (outer radius = 0.71m -> projected span ~ 2*0.50 + lantern ~ 1.50m)
  //    Each arm also carries an underside scroll hook + 3 thin iron chains down to its Hanging Petunia Basket!
  const outerLanternR = 0.71;
  const basketR = 0.50;
  const basketRimY = 2.86;
  const hookY = 3.40;

  // Build reusable single-arm swept tubular iron arches in +X plane, then rotate around Y x4
  const mainArmProto = makeTubularCurveGeo(
    [
      [0.095, 3.74, 0],
      [0.24, 3.75, 0],
      [0.44, 3.70, 0],
      [0.60, 3.74, 0],
      [0.71, 3.81, 0],
    ],
    14,
    0.021,
    8,
  );
  const lowerArchProto = makeTubularCurveGeo(
    [
      [0.082, 3.28, 0],
      [0.20, 3.39, 0],
      [0.39, 3.51, 0],
      [0.58, 3.66, 0],
      [0.69, 3.79, 0],
    ],
    14,
    0.017,
    8,
  );
  const innerScrollProto = buildScrollBandGeometry(
    [
      [0.14, 3.66],
      [0.25, 3.69],
      [0.34, 3.61],
      [0.27, 3.52],
      [0.17, 3.57],
      [0.21, 3.63],
    ],
    0.010,
    0.018,
  );
  const outerTipScrollProto = buildScrollBandGeometry(
    [
      [0.47, 3.68],
      [0.55, 3.63],
      [0.62, 3.69],
      [0.57, 3.74],
      [0.51, 3.71],
    ],
    0.009,
    0.018,
  );
  const basketHookScrollProto = buildScrollBandGeometry(
    [
      [0.38, 3.50],
      [0.45, 3.45],
      [0.50, 3.40],
      [0.535, 3.44],
      [0.50, 3.48],
    ],
    0.009,
    0.018,
  );

  const armHaloOffsets: Array<{ dx: number; dy: number; dz: number; s: number }> = [
    { dx: 0, dy: centerLantern.haloY, dz: 0, s: 0.62 },
  ];
  const basketOffsets: Array<{ dx: number; dy: number; dz: number }> = [];

  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);

    for (const proto of [
      mainArmProto,
      lowerArchProto,
      innerScrollProto,
      outerTipScrollProto,
      basketHookScrollProto,
    ]) {
      const g = proto.clone();
      g.rotateY(-ang);
      ironParts.push(remapGeoUvs(g, 0.04, 0.80));
    }

    // Turned outer lantern socket cup + pendant acorn finial underneath arm tip
    const ax = cosA * outerLanternR;
    const az = sinA * outerLanternR;
    ironParts.push(
      remapGeoUvs(
        makeLatheGeo(
          [
            [0.0, 0.0],
            [0.018, 0.018],
            [0.028, 0.036],
            [0.016, 0.052],
            [0.058, 0.072],
            [0.104, 0.095],
            [0.094, 0.114],
            [0.0, 0.114],
          ],
          12,
          ax,
          3.738,
          az,
        ),
        0.04,
        0.82,
      ),
    );
    const outerLantern = buildSquareCarriageLanternParts({
      cx: ax,
      baseY: 3.84,
      cz: az,
      scale: 0.94,
      includeHingeLatch: false,
    });
    ironParts.push(...outerLantern.ironParts);
    glassParts.push(...outerLantern.glassParts);
    bulbParts.push(...outerLantern.bulbParts);

    armHaloOffsets.push({ dx: ax, dy: outerLantern.haloY, dz: az, s: 0.49 });

    // Basket suspension hook ring + 3 converging iron chains down to basket rim at y = 2.86m
    const bx = cosA * basketR;
    const bz = sinA * basketR;
    basketOffsets.push({ dx: bx, dy: basketRimY, dz: bz });

    ironParts.push(
      remapGeoUvs(
        makeTranslatedCylinder(0.015, 0.015, 0.016, 8, bx, hookY - 0.006, bz),
        0.08,
        0.78,
      ),
    );
    const topHookPt = new THREE.Vector3(bx, hookY - 0.01, bz);
    for (let ch = 0; ch < 3; ch++) {
      const cAng = (ch / 3) * Math.PI * 2 + ang;
      const rimPt = new THREE.Vector3(
        bx + Math.cos(cAng) * 0.195,
        basketRimY + 0.01,
        bz + Math.sin(cAng) * 0.195,
      );
      const chainGeo = makeStrutBetween(topHookPt, rimPt, 0.0055, 0.0055, 5, 0);
      if (chainGeo) ironParts.push(remapGeoUvs(chainGeo, 0.10, 0.75));
    }
  }

  mainArmProto.dispose();
  lowerArchProto.dispose();
  innerScrollProto.dispose();
  outerTipScrollProto.dispose();
  basketHookScrollProto.dispose();

  const ironGeo = mergeNormalizedGeos(ironParts);
  const glassGeo = mergeNormalizedGeos(glassParts);
  const bulbGeo = mergeNormalizedGeos(bulbParts);

  // 9. Hanging Petunia Wicker Basket + Mounding/Cascading Foliage + Multi-Tone Petunia Blossoms
  //    (Local origin = basket rim center at y = 2.86m; instanced x4 per Tier 4 lamp!)
  const basketGeo = mergeNormalizedGeos([
    // Rounded woven wicker/coir hemisphere bowl
    makeLatheGeo(
      [
        [0.0, -0.205],
        [0.085, -0.198],
        [0.145, -0.165],
        [0.188, -0.105],
        [0.212, -0.030],
        [0.222, 0.0],
        [0.208, 0.012],
        [0.185, -0.010],
        [0.0, -0.025],
      ],
      14,
    ),
    // Braided rim collar
    makeTranslatedCylinder(0.225, 0.218, 0.026, 14, 0, -0.008, 0),
  ]);

  // Mounding lush green foliage dome + 8 delicate cascading trailing petunia stems with pointed leaf pairs
  const foliageParts: THREE.BufferGeometry[] = [
    scaleGeoUvs(new THREE.IcosahedronGeometry(0.195, 1).scale(1.04, 0.56, 1.04).translate(0, 0.036, 0), 2.5, 2.5),
    scaleGeoUvs(new THREE.IcosahedronGeometry(0.125, 1).translate(0.08, 0.060, 0.04), 2.0, 2.0),
    scaleGeoUvs(new THREE.IcosahedronGeometry(0.125, 1).translate(-0.08, 0.058, -0.04), 2.0, 2.0),
    scaleGeoUvs(new THREE.IcosahedronGeometry(0.115, 1).translate(-0.04, 0.066, 0.08), 2.0, 2.0),
    scaleGeoUvs(new THREE.IcosahedronGeometry(0.115, 1).translate(0.04, 0.064, -0.08), 2.0, 2.0),
  ];

  // Reusable delicate pointed petunia leaf blade prototype (curved V-folded ovate leaf)
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.022, 0.014, 0.018, 0.038);
  leafShape.quadraticCurveTo(0.008, 0.056, 0, 0.068);
  leafShape.quadraticCurveTo(-0.008, 0.056, -0.018, 0.038);
  leafShape.quadraticCurveTo(-0.022, 0.014, 0, 0);
  const leafBladeProto = new THREE.ExtrudeGeometry(leafShape, {
    depth: 0.004,
    bevelEnabled: false,
    curveSegments: 3,
  });
  leafBladeProto.translate(0, 0, -0.002);

  // Trailing cascading petunia vines connected cleanly from the rim with stems + alternating leaf blades
  const vineDefs: Array<{ ang: number; drop: number; outR: number; leafPairs: number }> = [
    { ang: 0.15, drop: 0.44, outR: 0.23, leafPairs: 5 },
    { ang: 0.95, drop: 0.34, outR: 0.22, leafPairs: 4 },
    { ang: 1.75, drop: 0.48, outR: 0.235, leafPairs: 5 },
    { ang: 2.55, drop: 0.31, outR: 0.215, leafPairs: 4 },
    { ang: 3.35, drop: 0.42, outR: 0.225, leafPairs: 5 },
    { ang: 4.15, drop: 0.36, outR: 0.22, leafPairs: 4 },
    { ang: 4.95, drop: 0.46, outR: 0.23, leafPairs: 5 },
    { ang: 5.70, drop: 0.33, outR: 0.215, leafPairs: 4 },
  ];

  const bloomParts: THREE.BufferGeometry[] = [];
  const petuniaPalette = ['#f49ec0', '#e59ad8', '#f9c2d6', '#de6f9e', '#f6aec8'];

  // Sculpted 5-petal ruffled petunia blossom cluster facing along outward normal
  const addFlowerCluster = (
    fx: number,
    fy: number,
    fz: number,
    nx: number,
    ny: number,
    nz: number,
    radius: number,
    colorHex: string,
  ) => {
    const flowerParts: THREE.BufferGeometry[] = [];
    for (let p = 0; p < 5; p++) {
      const pa = (p / 5) * Math.PI * 2;
      const petal = new THREE.SphereGeometry(radius * 0.56, 7, 5);
      petal.scale(0.88, 0.34, 1.18);
      petal.translate(0, 0, radius * 0.52);
      petal.rotateX(-0.24);
      petal.rotateY(pa);
      flowerParts.push(petal);
    }
    const center = new THREE.SphereGeometry(radius * 0.28, 6, 4);
    center.scale(1, 0.65, 1);
    center.translate(0, radius * 0.10, 0);
    tintGeoVertexColor(center, '#fff4c4');
    for (const fp of flowerParts) {
      tintGeoVertexColor(fp, colorHex);
    }
    flowerParts.push(center);

    const flower = mergeNormalizedGeos(flowerParts, true);
    const upDir = new THREE.Vector3(nx, ny, nz).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), upDir);
    flower.applyQuaternion(q);
    flower.translate(fx, fy, fz);
    bloomParts.push(flower);
  };

  // Abundant mounding petunia blossom clusters sitting PROUDLY on top & spilling around the rim
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + 0.15;
    addFlowerCluster(
      Math.cos(a) * 0.185,
      0.088,
      Math.sin(a) * 0.185,
      Math.cos(a) * 0.72,
      0.69,
      Math.sin(a) * 0.72,
      0.052,
      petuniaPalette[k % petuniaPalette.length],
    );
  }
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + 0.4;
    addFlowerCluster(
      Math.cos(a) * 0.105,
      0.155,
      Math.sin(a) * 0.105,
      Math.cos(a) * 0.36,
      0.93,
      Math.sin(a) * 0.36,
      0.056,
      petuniaPalette[(k + 2) % petuniaPalette.length],
    );
  }
  addFlowerCluster(0, 0.185, 0, 0, 1, 0, 0.058, '#f9c2d6');

  for (let vIdx = 0; vIdx < vineDefs.length; vIdx++) {
    const v = vineDefs[vIdx];
    const ca = Math.cos(v.ang);
    const sa = Math.sin(v.ang);
    let prevPt = new THREE.Vector3(ca * 0.175, 0.03, sa * 0.175);

    for (let sIdx = 0; sIdx < v.leafPairs; sIdx++) {
      const t = (sIdx + 0.5) / v.leafPairs;
      const rNow = 0.185 + Math.sin(t * Math.PI * 0.55) * (v.outR - 0.185);
      const yNow = 0.005 - t * v.drop;
      const swayX = Math.sin(t * 4.5 + vIdx) * 0.015;
      const lx = ca * rNow - sa * swayX;
      const lz = sa * rNow + ca * swayX;
      const curPt = new THREE.Vector3(lx, yNow, lz);

      // Continuous green vine stem bridging cleanly down the drape
      const stem = makeStrutBetween(prevPt, curPt, 0.005, 0.006, 5, 0);
      if (stem) foliageParts.push(stem);
      prevPt = curPt;

      // Pair of crisp flared botanical leaf blades branching out left/right from the vine node
      const leafScale = 1.05 - t * 0.38;
      for (const side of [-1, 1]) {
        const blade = leafBladeProto.clone();
        blade.scale(leafScale, leafScale, leafScale);
        blade.rotateZ(side * 0.52);
        blade.rotateX(0.45 + t * 0.35);
        blade.rotateY(-v.ang + Math.PI * 0.5);
        blade.translate(lx - sa * side * 0.010, yNow + 0.006, lz + ca * side * 0.010);
        foliageParts.push(blade);
      }

      // Cascading pink/lavender petunia blossoms tucked near upper/mid vine drape
      if (sIdx === 0 || (sIdx === 2 && vIdx % 2 === 0)) {
        addFlowerCluster(
          lx + ca * 0.022,
          yNow + 0.008,
          lz + sa * 0.022,
          ca * 0.92,
          0.38,
          sa * 0.92,
          0.042 * (1.0 - t * 0.16),
          petuniaPalette[(vIdx + sIdx) % petuniaPalette.length],
        );
      }
    }
  }
  leafBladeProto.dispose();

  const foliageGeo = mergeNormalizedGeos(foliageParts);
  const bloomGeo = mergeNormalizedGeos(bloomParts, true);

  return {
    graniteBaseGeo,
    ironGeo,
    glassGeo,
    bulbGeo,
    basketGeo,
    foliageGeo,
    bloomGeo,
    armHaloOffsets,
    basketOffsets,
  };
}

/**
 * Mounts the 60 FPS GPU-instanced City Illumination (4-tier streetlamps, ground light pools,
 * smooth camera-facing lantern billboard sprites, and building night glow panes).
 */
export function buildCityLightingAndTrafficSystem(
  scene: THREE.Scene,
  _windUniforms?: BlitzWindUniforms,
  _isSoftwareGl = false,
): CityLightingAndTrafficSystemHandle {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'CityLightingAndTrafficRoot';
  scene.add(rootGroup);

  const disposeGeos: THREE.BufferGeometry[] = [];
  const disposeMats: THREE.Material[] = [];
  const disposeTexs: THREE.Texture[] = [];
  let instancedMeshCount = 0;

  // Shared 3-step cel gradient map (used for Tier 3 modern LED poles)
  const toonSteps = new Uint8Array([108, 196, 255]);
  const toonGradTex = new THREE.DataTexture(toonSteps, 3, 1, THREE.RedFormat);
  toonGradTex.minFilter = THREE.NearestFilter;
  toonGradTex.magFilter = THREE.NearestFilter;
  toonGradTex.needsUpdate = true;
  disposeTexs.push(toonGradTex);

  const ironPbr = createForgedIronPbrSet();
  const brickPbr = createBrickMasonryPbrSet();
  const limestonePbr = createLimestonePbrSet();
  const granitePbr = createGranitePaverPbrSet();
  const wickerPbr = createWickerPbrSet();
  const foliageTex = createFoliageTexture();
  const petuniaTex = createPetuniaPetalTexture();
  const edisonBulbTexs = createEdisonBulbTextures();
  const lanternGlassTexs = createLanternGlassTexture();
  const metalEnvTex = createOutdoorMetalEnvTexture();
  const lightPoolTex = createRadialLightPoolTexture();
  const lanternHaloTex = createRadialLanternGlowTexture();
  const windowPaneTex = createWindowPaneGlowTexture();

  disposeTexs.push(
    ironPbr.map,
    ironPbr.roughnessMap,
    ironPbr.bumpMap,
    brickPbr.map,
    brickPbr.roughnessMap,
    brickPbr.bumpMap,
    limestonePbr.map,
    limestonePbr.roughnessMap,
    limestonePbr.bumpMap,
    granitePbr.map,
    granitePbr.roughnessMap,
    granitePbr.bumpMap,
    wickerPbr.map,
    wickerPbr.roughnessMap,
    wickerPbr.bumpMap,
    foliageTex,
    petuniaTex,
    edisonBulbTexs.map,
    edisonBulbTexs.emissiveMap,
    lanternGlassTexs.map,
    lanternGlassTexs.emissiveMap,
    metalEnvTex,
    lightPoolTex,
    lanternHaloTex,
    windowPaneTex,
  );

  // Shared Forged Gunmetal / Antique Bronze-Pewter 3-map Canvas PBR Material (Tiers 1, 2, 4)
  const forgedIronPbrMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: ironPbr.map,
    roughnessMap: ironPbr.roughnessMap,
    bumpMap: ironPbr.bumpMap,
    bumpScale: 0.015,
    metalness: 0.54,
    roughness: 0.50,
    envMap: metalEnvTex,
    envMapIntensity: 0.92,
  });

  // Shared Translucent Bevelled / Frosted Lantern Glass Material
  const lanternGlassMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: lanternGlassTexs.map,
    emissive: '#ffcf70',
    emissiveMap: lanternGlassTexs.emissiveMap,
    emissiveIntensity: 0.08,
    roughness: 0.14,
    metalness: 0.12,
    envMap: metalEnvTex,
    envMapIntensity: 1.05,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });

  // Shared Vintage Edison Filament Bulb Material (warm glow subtly visible at noon + bright at dusk/night/rain)
  const lanternBulbMat = new THREE.MeshStandardMaterial({
    color: '#fff6d8',
    map: edisonBulbTexs.map,
    emissive: '#ffca64',
    emissiveMap: edisonBulbTexs.emissiveMap,
    emissiveIntensity: 0.72,
    roughness: 0.22,
    metalness: 0.05,
    toneMapped: false,
  });

  disposeMats.push(forgedIronPbrMat, lanternGlassMat, lanternBulbMat);

  const createStaticBatch = (
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    matrices: readonly THREE.Matrix4[],
    options?: {
      colors?: readonly THREE.ColorRepresentation[];
      strokeWidth?: number;
      strokeColor?: string;
      renderOrder?: number;
      padding?: number;
    },
  ): THREE.InstancedMesh => {
    disposeGeos.push(geometry);
    let outlineGeo: THREE.BufferGeometry | undefined;
    let outlineMat: THREE.Material | undefined;
    if (options?.strokeWidth && options.strokeWidth > 0) {
      const stroke = createBlitzStrokeMesh(
        geometry,
        options.strokeWidth,
        options.strokeColor ?? '#12121e',
      );
      if (stroke) {
        outlineGeo = stroke.geometry;
        outlineMat = stroke.material as THREE.Material;
        disposeGeos.push(outlineGeo);
      }
    }
    const batch = createInstancedMeshWithOutline({
      name,
      geometry,
      material,
      matrices,
      colors: options?.colors,
      outlineGeometry: outlineGeo,
      outlineMaterial: outlineMat,
      renderOrder: options?.renderOrder ?? 0,
      padding: options?.padding ?? 0.4,
      lockStaticMatrix: true,
    });
    rootGroup.add(batch.mesh);
    instancedMeshCount++;
    if (batch.strokeMesh) {
      rootGroup.add(batch.strokeMesh);
      instancedMeshCount++;
    }
    return batch.mesh;
  };

  // Partition lamps by Tier
  const lampsByTier: Record<1 | 2 | 3 | 4, CityLampSpec[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const lamp of CITY_LAMP_MANIFEST) {
    lampsByTier[lamp.tier].push(lamp);
  }

  const composePose = (x: number, y: number, z: number, rotY = 0, scale = 1): THREE.Matrix4 => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0));
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(scale, scale, scale));
    return m;
  };

  const haloEntries: Array<{ x: number; y: number; z: number; scale: number }> = [];

  const TIER1_INSTANCE_SCALE = 1.45;
  const TIER2_INSTANCE_SCALE = 1.52;
  const TIER3_INSTANCE_SCALE = 1.50;
  const TIER4_INSTANCE_SCALE = 1.55;

  // -------------------------------------------------------------------------
  // TIER 1: Ground Bollards (~0.66m world @ 1.45x)
  // -------------------------------------------------------------------------
  if (lampsByTier[1].length > 0) {
    const t1Geos = buildTier1BollardGeos();
    const t1Mats = lampsByTier[1].map((l) => {
      haloEntries.push({
        x: l.x,
        y: l.y + t1Geos.lanternY * TIER1_INSTANCE_SCALE,
        z: l.z,
        scale: 0.44,
      });
      return composePose(l.x, l.y, l.z, l.rotY, TIER1_INSTANCE_SCALE);
    });
    createStaticBatch('CityLamp_Tier1_Metal', t1Geos.metalGeo, forgedIronPbrMat, t1Mats, {
      strokeWidth: 0.005,
      strokeColor: '#2d333b',
    });
    createStaticBatch('CityLamp_Tier1_Bulb', t1Geos.bulbGeo, lanternBulbMat, t1Mats);
    createStaticBatch('CityLamp_Tier1_Glass', t1Geos.glassGeo, lanternGlassMat, t1Mats, {
      renderOrder: 1,
    });
  }

  // -------------------------------------------------------------------------
  // TIER 2: Brick Pier + Limestone Coping + Square Carriage Lantern (~2.98m world @ 1.52x)
  //         plus Pier-Top Carriage Lanterns (lantern head only atop balustrade stone piers)
  // -------------------------------------------------------------------------
  if (lampsByTier[2].length > 0) {
    const t2PedestalLamps = lampsByTier[2].filter((l) => l.lampVariant !== 'pier_lantern');
    const t2PierLamps = lampsByTier[2].filter((l) => l.lampVariant === 'pier_lantern');

    if (t2PedestalLamps.length > 0) {
      const t2Geos = buildTier2PedestalGeos();
      const t2BrickMat = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        map: brickPbr.map,
        roughnessMap: brickPbr.roughnessMap,
        bumpMap: brickPbr.bumpMap,
        bumpScale: 0.022,
        roughness: 0.88,
        metalness: 0.03,
      });
      const t2StoneMat = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        map: limestonePbr.map,
        roughnessMap: limestonePbr.roughnessMap,
        bumpMap: limestonePbr.bumpMap,
        bumpScale: 0.012,
        roughness: 0.82,
        metalness: 0.04,
      });
      disposeMats.push(t2BrickMat, t2StoneMat);

      const t2Mats = t2PedestalLamps.map((l) => {
        haloEntries.push({
          x: l.x,
          y: l.y + t2Geos.lanternY * TIER2_INSTANCE_SCALE,
          z: l.z,
          scale: 0.88,
        });
        return composePose(l.x, l.y, l.z, l.rotY, TIER2_INSTANCE_SCALE);
      });
      createStaticBatch('CityLamp_Tier2_Brick', t2Geos.brickGeo, t2BrickMat, t2Mats);
      createStaticBatch('CityLamp_Tier2_Stone', t2Geos.stoneGeo, t2StoneMat, t2Mats, {
        strokeWidth: 0.006,
        strokeColor: '#5c5448',
      });
      createStaticBatch('CityLamp_Tier2_Iron', t2Geos.ironFrameGeo, forgedIronPbrMat, t2Mats);
      createStaticBatch('CityLamp_Tier2_Bulb', t2Geos.bulbGeo, lanternBulbMat, t2Mats);
      createStaticBatch('CityLamp_Tier2_Glass', t2Geos.glassGeo, lanternGlassMat, t2Mats, {
        renderOrder: 1,
      });
    }

    if (t2PierLamps.length > 0) {
      const t2PierGeos = buildTier2TopLanternGeos(0.0);
      const t2PierMats = t2PierLamps.map((l) => {
        haloEntries.push({
          x: l.x,
          y: l.y + t2PierGeos.lanternY * TIER2_INSTANCE_SCALE,
          z: l.z,
          scale: 0.88,
        });
        return composePose(l.x, l.y, l.z, l.rotY, TIER2_INSTANCE_SCALE);
      });
      createStaticBatch('CityLamp_Tier2_Pier_Iron', t2PierGeos.ironFrameGeo, forgedIronPbrMat, t2PierMats);
      createStaticBatch('CityLamp_Tier2_Pier_Bulb', t2PierGeos.bulbGeo, lanternBulbMat, t2PierMats);
      createStaticBatch('CityLamp_Tier2_Pier_Glass', t2PierGeos.glassGeo, lanternGlassMat, t2PierMats, {
        renderOrder: 1,
      });
    }
  }

  // -------------------------------------------------------------------------
  // TIER 3: Modern Navy-Charcoal LED Streetlamps (4.62m geo, ~6.93m world @ 1.50x)
  // -------------------------------------------------------------------------
  if (lampsByTier[3].length > 0) {
    const t3ToonSteps = new Uint8Array([165, 218, 255]);
    const t3GradTex = new THREE.DataTexture(t3ToonSteps, 3, 1, THREE.RedFormat);
    t3GradTex.minFilter = THREE.NearestFilter;
    t3GradTex.magFilter = THREE.NearestFilter;
    t3GradTex.needsUpdate = true;
    disposeTexs.push(t3GradTex);

    const t3PoleMat = new THREE.MeshToonMaterial({
      color: '#2a3448',
      gradientMap: t3GradTex,
    });
    disposeMats.push(t3PoleMat);

    const t3SingleLamps = lampsByTier[3].filter((l) => l.lampVariant !== 'corner');
    const t3CornerLamps = lampsByTier[3].filter((l) => l.lampVariant === 'corner');

    const pushTier3VariantBatch = (
      variant: 'single' | 'corner',
      lamps: readonly CityLampSpec[],
      metalBatchName: string,
      bulbBatchName: string,
      glassBatchName: string,
    ) => {
      if (lamps.length === 0) return;
      const geos = buildTier3ModernLedGeos(variant);
      const mats = lamps.map((l) => {
        const cosR = Math.cos(l.rotY);
        const sinR = Math.sin(l.rotY);
        for (const off of geos.haloOffsets) {
          const sx = off.dx * TIER3_INSTANCE_SCALE;
          const sz = off.dz * TIER3_INSTANCE_SCALE;
          const wx = l.x + sx * cosR + sz * sinR;
          const wz = l.z - sx * sinR + sz * cosR;
          haloEntries.push({
            x: wx,
            y: l.y + off.dy * TIER3_INSTANCE_SCALE,
            z: wz,
            scale: 1.0,
          });
        }
        return composePose(l.x, l.y, l.z, l.rotY, TIER3_INSTANCE_SCALE);
      });
      createStaticBatch(metalBatchName, geos.metalGeo, t3PoleMat, mats, {
        strokeWidth: 0.018,
      });
      createStaticBatch(bulbBatchName, geos.bulbGeo, lanternBulbMat, mats);
      createStaticBatch(glassBatchName, geos.glassGeo, lanternGlassMat, mats, {
        renderOrder: 1,
      });
    };

    pushTier3VariantBatch(
      'single',
      t3SingleLamps,
      'CityLamp_Tier3_Single_Metal',
      'CityLamp_Tier3_Single_Bulb',
      'CityLamp_Tier3_Single_Glass',
    );
    pushTier3VariantBatch(
      'corner',
      t3CornerLamps,
      'CityLamp_Tier3_Corner_Metal',
      'CityLamp_Tier3_Corner_Bulb',
      'CityLamp_Tier3_Corner_Glass',
    );
  }

  // -------------------------------------------------------------------------
  // TIER 4: Granite Base + 5-Lantern Chandelier + 4 Baskets (~7.42m world @ 1.55x)
  // -------------------------------------------------------------------------
  if (lampsByTier[4].length > 0) {
    const t4Geos = buildTier4ChandelierGeos();
    const t4GraniteMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: granitePbr.map,
      roughnessMap: granitePbr.roughnessMap,
      bumpMap: granitePbr.bumpMap,
      bumpScale: 0.016,
      roughness: 0.78,
      metalness: 0.06,
      envMap: metalEnvTex,
      envMapIntensity: 0.45,
    });
    const t4WickerMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: wickerPbr.map,
      roughnessMap: wickerPbr.roughnessMap,
      bumpMap: wickerPbr.bumpMap,
      bumpScale: 0.020,
      roughness: 0.88,
      metalness: 0.02,
    });
    const t4IvyMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: foliageTex,
      bumpMap: foliageTex,
      bumpScale: 0.010,
      roughness: 0.74,
      metalness: 0.02,
    });
    const t4BloomMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: petuniaTex,
      vertexColors: true,
      roughness: 0.56,
      metalness: 0.02,
    });
    disposeMats.push(t4GraniteMat, t4WickerMat, t4IvyMat, t4BloomMat);

    const t4Mats: THREE.Matrix4[] = [];
    const basketMats: THREE.Matrix4[] = [];
    const bloomColors: THREE.ColorRepresentation[] = [];
    const bloomPalette = ['#ffe4ee', '#ffd8e8', '#f5e2ff', '#ffdfe9'];

    lampsByTier[4].forEach((l, lampIdx) => {
      t4Mats.push(composePose(l.x, l.y, l.z, l.rotY, TIER4_INSTANCE_SCALE));
      const cosR = Math.cos(l.rotY);
      const sinR = Math.sin(l.rotY);
      for (const arm of t4Geos.armHaloOffsets) {
        const ax = arm.dx * TIER4_INSTANCE_SCALE;
        const az = arm.dz * TIER4_INSTANCE_SCALE;
        const wx = l.x + ax * cosR + az * sinR;
        const wz = l.z - ax * sinR + az * cosR;
        haloEntries.push({
          x: wx,
          y: l.y + arm.dy * TIER4_INSTANCE_SCALE,
          z: wz,
          scale: arm.s * TIER4_INSTANCE_SCALE,
        });
      }
      // 4 Hanging Petunia Wicker Baskets under EVERY one of the 4 diagonal X-arms
      t4Geos.basketOffsets.forEach((bOff, armIdx) => {
        const sbx = bOff.dx * TIER4_INSTANCE_SCALE;
        const sbz = bOff.dz * TIER4_INSTANCE_SCALE;
        const bx = l.x + sbx * cosR + sbz * sinR;
        const bz = l.z - sbx * sinR + sbz * cosR;
        basketMats.push(
          composePose(
            bx,
            l.y + bOff.dy * TIER4_INSTANCE_SCALE,
            bz,
            l.rotY + armIdx * (Math.PI * 0.5),
            TIER4_INSTANCE_SCALE,
          ),
        );
        bloomColors.push(bloomPalette[(lampIdx + armIdx) % bloomPalette.length]);
      });
    });

    createStaticBatch('CityLamp_Tier4_Granite', t4Geos.graniteBaseGeo, t4GraniteMat, t4Mats, {
      strokeWidth: 0.006,
      strokeColor: '#3f454e',
    });
    createStaticBatch('CityLamp_Tier4_Iron', t4Geos.ironGeo, forgedIronPbrMat, t4Mats);
    createStaticBatch('CityLamp_Tier4_Bulb', t4Geos.bulbGeo, lanternBulbMat, t4Mats);
    createStaticBatch('CityLamp_Tier4_Glass', t4Geos.glassGeo, lanternGlassMat, t4Mats, {
      renderOrder: 1,
    });
    createStaticBatch('CityLamp_Tier4_Wicker', t4Geos.basketGeo, t4WickerMat, basketMats, {
      strokeWidth: 0.0015,
      strokeColor: '#7a522d',
    });
    createStaticBatch('CityLamp_Tier4_Ivy', t4Geos.foliageGeo, t4IvyMat, basketMats, {
      strokeWidth: 0.0015,
      strokeColor: '#3f763a',
    });
    createStaticBatch('CityLamp_Tier4_Blooms', t4Geos.bloomGeo, t4BloomMat, basketMats, {
      colors: bloomColors,
    });
  }

  // -------------------------------------------------------------------------
  // GROUND LIGHT POOLS + CAMERA-FACING LANTERN BILLBOARDS (0 PointLights; hidden cleanly at day!)
  // -------------------------------------------------------------------------
  const filteredExistingAnchors = EXISTING_CITY_LAMP_POOL_ANCHORS.filter((anchor) => {
    for (const lamp of CITY_LAMP_MANIFEST) {
      if (Math.hypot(anchor.x - lamp.x, anchor.z - lamp.z) < 2.2) return false;
    }
    return true;
  });
  for (const anchor of filteredExistingAnchors) {
    haloEntries.push({
      x: anchor.x + (anchor.lanternXOffset ?? 0),
      y: anchor.y + anchor.lanternYOffset,
      z: anchor.z + (anchor.lanternZOffset ?? 0),
      scale: anchor.haloScale,
    });
  }

  const poolGeo = new THREE.PlaneGeometry(1, 1);
  poolGeo.rotateX(-Math.PI / 2);
  const poolMat = new THREE.MeshBasicMaterial({
    map: lightPoolTex,
    color: '#ffcf76',
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    toneMapped: false,
  });
  disposeMats.push(poolMat);

  const poolMatrices: THREE.Matrix4[] = [
    ...CITY_LAMP_MANIFEST.map((l) => {
      if (l.tier === 3) {
        const cosR = Math.cos(l.rotY);
        const sinR = Math.sin(l.rotY);
        const localDx = (l.lampVariant === 'corner' ? 2.0 / Math.SQRT2 : 0.0) * TIER3_INSTANCE_SCALE;
        const localDz = (l.lampVariant === 'corner' ? 2.0 / Math.SQRT2 : 2.4) * TIER3_INSTANCE_SCALE;
        const poolX = l.x + localDx * cosR + localDz * sinR;
        const poolZ = l.z - localDx * sinR + localDz * cosR;
        const radius = (l.lampVariant === 'corner' ? 10.8 : 9.2) * 1.25;
        const crossesRaisedSidewalk = evaluateHaltePlatformSdf(poolX, poolZ) <= 0.45;
        const poolY = crossesRaisedSidewalk ? Math.max(l.y + 0.032, 0.118) : l.y + 0.032;
        return composePose(poolX, poolY, poolZ, 0, radius * 2);
      }
      return composePose(l.x, l.y - (l.mountHeightOffset ?? 0) + 0.032, l.z, 0, l.poolRadius * 2);
    }),
    ...filteredExistingAnchors.map((a) => composePose(a.x, a.y + 0.032, a.z, 0, a.poolRadius * 2)),
  ];
  const groundPoolMesh = createStaticBatch('CityLamp_GroundLightPools', poolGeo, poolMat, poolMatrices, {
    renderOrder: 1,
  });
  groundPoolMesh.visible = false;

  const haloGeo = new THREE.PlaneGeometry(1, 1);
  const haloBillboard = createLanternBillboardGlowMaterial(lanternHaloTex, {
    color: '#ffe094',
    opacity: 0.0,
  });
  disposeMats.push(haloBillboard.material);
  const haloMatrices = haloEntries.map((h) => composePose(h.x, h.y, h.z, 0, h.scale));
  const lanternHaloMesh = createStaticBatch(
    'CityLamp_LanternHalos',
    haloGeo,
    haloBillboard.material,
    haloMatrices,
    {
      renderOrder: 4,
      padding: 1.5,
    },
  );
  lanternHaloMesh.visible = false;

  // -------------------------------------------------------------------------
  // BUILDING NIGHT ILLUMINATION PANES (Municipal Hall, Plaza, Casino, Cafe, Houses, Taman Ria, Halte)
  // -------------------------------------------------------------------------
  const windowGeo = new THREE.PlaneGeometry(1, 1);
  const windowMat = new THREE.MeshBasicMaterial({
    map: windowPaneTex,
    color: '#ffffff',
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    toneMapped: false,
  });
  disposeMats.push(windowMat);

  const windowBaseColors = CITY_BUILDING_GLOW_MANIFEST.map((p) =>
    new THREE.Color(p.colorHex).multiplyScalar(clamp(p.intensityScale, 0.55, 1.15)),
  );
  const windowMatrices = CITY_BUILDING_GLOW_MANIFEST.map((p) => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p.rotY, 0));
    m.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.width, p.height, 1));
    return m;
  });
  const buildingGlowMesh = createStaticBatch(
    'CityBuilding_NightGlowPanes',
    windowGeo,
    windowMat,
    windowMatrices,
    {
      colors: windowBaseColors,
      renderOrder: 2,
    },
  );
  buildingGlowMesh.visible = false;

  let lastLevels: CityIlluminationLevels = computeCityIlluminationLevels(null, 'day');

  const applyIlluminationMaterials = (levels: CityIlluminationLevels, timeSec: number) => {
    const coreState = evaluateLanternCoreAndSpriteState(levels.streetLampBrightness01);
    const lampsActive = coreState.active && levels.streetLampBrightness01 > 0.01;
    lanternGlassMat.emissive.set(levels.lanternEmissiveHex);
    lanternGlassMat.emissiveIntensity = lampsActive ? coreState.glassEmissiveIntensity : 0.02;
    lanternGlassMat.color.set(lampsActive ? '#fff7dc' : '#ffffff');

    // Clean unlit warm filament in daytime; high-emission incandescent filament contrast at dusk/night/rain
    lanternBulbMat.emissive.set(lampsActive ? levels.lanternEmissiveHex : '#ffd680');
    lanternBulbMat.emissiveIntensity = lampsActive ? coreState.bulbEmissiveIntensity : 0.12;

    // Keep forged gunmetal pewter highlights crisp & readable across day, dusk, and night (zero black crush)
    const envScale = clamp(1.0 - levels.nightFactor01 * 0.56 - levels.duskDawnFactor01 * 0.14, 0.44, 1.0);
    forgedIronPbrMat.envMapIntensity = 0.96 * envScale;
    forgedIronPbrMat.emissive.set('#38342e');
    forgedIronPbrMat.emissiveIntensity = lampsActive ? 0.16 : 0.05;
    lanternGlassMat.envMapIntensity = 1.05 * envScale;

    const shimmer = 0.96 + 0.04 * Math.sin(timeSec * 2.4);
    const poolsVisible = levels.groundPoolOpacity01 > 0.01;
    groundPoolMesh.visible = poolsVisible;
    if (poolsVisible) {
      poolMat.opacity = clamp(levels.groundPoolOpacity01 * 0.68 * shimmer, 0, 0.86);
    }

    lanternHaloMesh.visible = lampsActive;
    if (lampsActive) {
      haloBillboard.setOpacity(coreState.billboardOpacity);
      haloBillboard.setColor(levels.lanternEmissiveHex);
      haloBillboard.setTime(timeSec);
    } else {
      haloBillboard.setOpacity(0);
    }

    const windowsVisible = levels.windowGlow01 > 0.01;
    buildingGlowMesh.visible = windowsVisible;
    if (windowsVisible) {
      windowMat.opacity = clamp(levels.windowGlow01 * 0.88, 0, 0.96);
    }
  };

  // Initial sync at rest (noon default)
  applyIlluminationMaterials(lastLevels, 0);

  const update = (input: CityLightingAndTrafficUpdateInput): CityIlluminationLevels => {
    const levels = computeCityIlluminationLevels(input.weatherEnvState, input.fallbackPreset);
    lastLevels = levels;

    applyIlluminationMaterials(levels, input.timeSec);

    return levels;
  };

  const dispose = () => {
    scene.remove(rootGroup);
    for (const g of disposeGeos) g.dispose();
    for (const m of disposeMats) m.dispose();
    for (const t of disposeTexs) t.dispose();
  };

  return {
    rootGroup,
    update,
    getVehicleCollisionBoxes: () => EMPTY_VEHICLE_COLLISION_BOXES,
    getFleetState: () => EMPTY_TRAFFIC_FLEET,
    getLastIlluminationLevels: () => lastLevels,
    stats: {
      lampCount: CITY_LAMP_MANIFEST.length,
      tierCounts: {
        1: lampsByTier[1].length,
        2: lampsByTier[2].length,
        3: lampsByTier[3].length,
        4: lampsByTier[4].length,
      },
      groundPoolCount: poolMatrices.length,
      lanternHaloCount: haloEntries.length,
      buildingGlowCount: CITY_BUILDING_GLOW_MANIFEST.length,
      trafficVehicleCount: 0,
      pointLightCount: 0,
      instancedMeshCount,
    },
    dispose,
  };
}
