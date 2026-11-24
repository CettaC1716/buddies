import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  createUnifiedWaterSurfaceMaterial,
  getSharedFallbackFoliageMaskTexture,
  registerPendingLeafMaskMaterial,
  type BlitzWindUniforms,
} from './buddiesBlitzShadersAndAssets';
import { computeInstancedBoundingVolumes } from './buddiesHubRenderOptimizer';
import { createHorizontalPolygonSlabGeometry } from './buddiesPlanetCurvature';
import {
  CENTRAL_PARK_BENCHES,
  CENTRAL_PARK_BOTANICAL_BEDS,
  CENTRAL_PARK_CANOPY_TREES,
  CENTRAL_PARK_LAMPPOSTS,
  CENTRAL_PARK_LANTERN_GLOW_SPEC,
  CENTRAL_PARK_MASTERPLAN,
  CENTRAL_PARK_PERIMETER_VERTICES,
} from './buddiesCentralParkRules';
import {
  createEdisonBulbTextures,
  createLanternBillboardGlowMaterial,
  createLanternGlassTexture,
  createRadialLanternGlowTexture,
} from './buddiesCityLightingAndTrafficBuilder';
import { evaluateLanternCoreAndSpriteState } from './buddiesCityLightingAndTrafficRules';
import {
  buildBoutiqueRooftopTower3D,
  buildCozyBitesCafePavilion3D,
  buildTimberPergolaAndLilyPond3D,
  type UrbanPlazaBuildingsContext,
} from './buddiesUrbanPlazaBuildingsBuilder';
import { buildBeautySalonStudio3D } from './buddiesBeautySalonBuilder';

export interface BuildCentralBotanicalParkOptions {
  windUniforms: BlitzWindUniforms;
  isSoftwareGl: boolean;
  leafMaskTexture?: THREE.Texture | null;
  waterCascadeTex: THREE.Texture;
  waterRippleTex: THREE.Texture;
  upgradeMeshToBlitzWorldMaterial: (
    mesh: THREE.Mesh,
    windUniforms: BlitzWindUniforms,
    tintHex?: string,
    bounceStrength?: number,
  ) => void;
  createBlitzStrokeMesh: (
    sourceGeometry: THREE.BufferGeometry,
    strokeWidth?: number,
    strokeColorHex?: string,
  ) => THREE.Mesh | null;
  bakeStaticGroupMeshes: (
    rootGroup: THREE.Object3D,
    options?: {
      excludeObjects?: Set<THREE.Object3D>;
      minShadowCasterSpan?: number;
    },
  ) => void;
}

export interface CentralBotanicalParkHandle {
  group: THREE.Group;
  update: (timeSec: number, nightFactor01?: number) => void;
  setCanopyShadowsEnabled: (enabled: boolean) => void;
  dispose: () => void;
  stats: {
    instancedMeshes: number;
    totalBotanicalInstances: number;
  };
}

function createSmoothTaperedTubeGeo(
  curve: THREE.Curve<THREE.Vector3>,
  tubularSegments: number,
  radiusStart: number,
  radiusEnd: number,
  radialSegments: number,
): THREE.TubeGeometry {
  const geo = new THREE.TubeGeometry(curve, tubularSegments, 1.0, radialSegments, false);
  const pos = geo.getAttribute('position');
  const ringVerts = radialSegments + 1;
  const ringCenter = new THREE.Vector3();
  const offset = new THREE.Vector3();
  for (let s = 0; s <= tubularSegments; s++) {
    const t = s / tubularSegments;
    const radius = THREE.MathUtils.lerp(radiusStart, radiusEnd, t);
    curve.getPointAt(t, ringCenter);
    const startIdx = s * ringVerts;
    for (let r = 0; r < ringVerts; r++) {
      const vi = startIdx + r;
      offset.set(pos.getX(vi), pos.getY(vi), pos.getZ(vi)).sub(ringCenter).multiplyScalar(radius).add(ringCenter);
      pos.setXYZ(vi, offset.x, offset.y, offset.z);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Applies a zero-GPU-cost vertex-color canopy AO & sunlit mid-trunk gradient onto
 * tree trunks, buttress roots, and branches:
 * - Ground contact root collar: subtle warm soil AO
 * - Mid-trunk sunlight band: warm sunlit highlight
 * - Top-of-trunk & inner limbs under the leafy crown: smooth cool-warm canopy AO darkening
 */
function applyTreeCanopyAoVertexGradient(
  geo: THREE.BufferGeometry,
  opts: {
    yGroundEnd: number;
    yCanopyStart: number;
    yCanopyDeep: number;
    yTipStart?: number;
    yTipEnd?: number;
    groundTint: readonly [number, number, number];
    sunTint: readonly [number, number, number];
    canopyAoTint: readonly [number, number, number];
    tipTint?: readonly [number, number, number];
  },
): THREE.BufferGeometry {
  const pos = geo.getAttribute('position');
  if (!pos || pos.count === 0) return geo;
  const smoothstep = (e0: number, e1: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - e0) / Math.max(1e-4, e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const groundRise = smoothstep(0.0, opts.yGroundEnd, y);
    const canopyShadow = smoothstep(opts.yCanopyStart, opts.yCanopyDeep, y);

    let r = opts.groundTint[0] + (opts.sunTint[0] - opts.groundTint[0]) * groundRise;
    let g = opts.groundTint[1] + (opts.sunTint[1] - opts.groundTint[1]) * groundRise;
    let b = opts.groundTint[2] + (opts.sunTint[2] - opts.groundTint[2]) * groundRise;

    r += (opts.canopyAoTint[0] - r) * canopyShadow;
    g += (opts.canopyAoTint[1] - g) * canopyShadow;
    b += (opts.canopyAoTint[2] - b) * canopyShadow;

    if (opts.tipTint && opts.yTipStart !== undefined && opts.yTipEnd !== undefined) {
      const tipBlend = smoothstep(opts.yTipStart, opts.yTipEnd, y);
      r += (opts.tipTint[0] - r) * tipBlend;
      g += (opts.tipTint[1] - g) * tipBlend;
      b += (opts.tipTint[2] - b) * tipBlend;
    }

    const idx = i * 3;
    colors[idx] = r;
    colors[idx + 1] = g;
    colors[idx + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function createMiteredPlanterLipGeo(
  outerW: number,
  outerD: number,
  rimWidth: number,
  height: number,
): THREE.BufferGeometry {
  const hw = outerW * 0.5;
  const hd = outerD * 0.5;
  const iw = Math.max(0.05, hw - rimWidth);
  const id = Math.max(0.05, hd - rimWidth);
  const outer = new THREE.Shape();
  outer.moveTo(-hw, -hd);
  outer.lineTo(hw, -hd);
  outer.lineTo(hw, hd);
  outer.lineTo(-hw, hd);
  outer.closePath();
  const inner = new THREE.Path();
  inner.moveTo(-iw, -id);
  inner.lineTo(-iw, id);
  inner.lineTo(iw, id);
  inner.lineTo(iw, -id);
  inner.closePath();
  outer.holes.push(inner);
  const geo = new THREE.ExtrudeGeometry(outer, {
    depth: Math.max(0.01, height - 0.012),
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 2,
    curveSegments: 1,
  });
  geo.rotateX(-Math.PI * 0.5);
  geo.translate(0, 0.006, 0);
  return geo;
}

interface MultiPartGeoAccumulator {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  windParams: number[];
  partKinds: number[];
}

function createGeoAccumulator(): MultiPartGeoAccumulator {
  return {
    positions: [],
    normals: [],
    uvs: [],
    colors: [],
    windParams: [],
    partKinds: [],
  };
}

const _tmpV = new THREE.Vector3();
const _tmpN = new THREE.Vector3();
const _tmpM = new THREE.Matrix4();
const _tmpNMat = new THREE.Matrix3();
const _tmpCol = new THREE.Color();

/**
 * Botanical shading category encoded per vertex in `aPartKind`:
 * - `0`: solid stems, canes, bark, stamen anthers (no alpha cutout)
 * - `1`: alpha-cutout foliage leaf texture (`uLeafTex`, mask.r < 0.34 discard, mask.g = midrib/vein)
 * - `2`: alpha-cutout petal / floret / spike / raceme texture (`uPetalTex`, mask.r < 0.34 discard, mask.g/b = floral contrast)
 */
type BotanicalPartKind = 0 | 1 | 2;

function appendPartToBotanicalAcc(
  acc: MultiPartGeoAccumulator,
  srcGeo: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  colorHex: string,
  petalMask: number,
  swayScale: number,
  swayFloorY: number,
  swayCeilingY: number,
  subSeed: number,
  invertedHang = false,
  partKind: BotanicalPartKind = petalMask > 0.5 ? 2 : 0,
  sphereCenterLocal?: THREE.Vector3,
): void {
  const nonIdx = srcGeo.index ? srcGeo.toNonIndexed() : srcGeo;
  const pos = nonIdx.getAttribute('position');
  if (!pos || pos.count === 0) {
    if (nonIdx !== srcGeo) nonIdx.dispose();
    return;
  }
  if (!nonIdx.getAttribute('normal')) {
    nonIdx.computeVertexNormals();
  }
  const norm = nonIdx.getAttribute('normal');
  const uv = nonIdx.getAttribute('uv');
  _tmpCol.set(colorHex);
  _tmpNMat.getNormalMatrix(matrix);
  const span = Math.max(0.05, Math.abs(swayCeilingY - swayFloorY));

  for (let i = 0; i < pos.count; i++) {
    _tmpV.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(matrix);
    _tmpN.set(norm.getX(i), norm.getY(i), norm.getZ(i)).applyMatrix3(_tmpNMat).normalize();
    if (sphereCenterLocal) {
      const radial = _tmpV.clone().sub(sphereCenterLocal);
      if (radial.lengthSq() > 1e-5) {
        _tmpN.lerp(radial.normalize(), 0.72).normalize();
      }
    }

    acc.positions.push(_tmpV.x, _tmpV.y, _tmpV.z);
    acc.normals.push(_tmpN.x, _tmpN.y, _tmpN.z);
    if (uv) {
      acc.uvs.push(uv.getX(i), uv.getY(i));
    } else {
      acc.uvs.push(0.5, 0.5);
    }

    const t = invertedHang
      ? Math.max(0, Math.min(1, (swayFloorY - _tmpV.y) / span))
      : Math.max(0, Math.min(1, (_tmpV.y - swayFloorY) / span));
    const tipBoost = 0.90 + 0.14 * t;
    acc.colors.push(
      Math.min(1, _tmpCol.r * tipBoost),
      Math.min(1, _tmpCol.g * tipBoost),
      Math.min(1, _tmpCol.b * tipBoost),
    );
    const sway = Math.pow(t, 1.35) * swayScale;
    acc.windParams.push(sway, petalMask, subSeed);
    acc.partKinds.push(partKind);
  }

  if (nonIdx !== srcGeo) {
    nonIdx.dispose();
  }
}

function finalizeBotanicalAccGeometry(acc: MultiPartGeoAccumulator): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(acc.positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(acc.normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(acc.uvs, 2));
  geo.setAttribute('aPartColor', new THREE.Float32BufferAttribute(acc.colors, 3));
  geo.setAttribute('aWindParams', new THREE.Float32BufferAttribute(acc.windParams, 3));
  geo.setAttribute('aPartKind', new THREE.Float32BufferAttribute(acc.partKinds, 1));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function composePartMatrix(
  pos: [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ'));
  return _tmpM
    .compose(
      new THREE.Vector3(pos[0], pos[1], pos[2]),
      q,
      new THREE.Vector3(scale[0], scale[1], scale[2]),
    )
    .clone();
}

// ============================================================================
// BOTANICAL GEOMETRY & ALPHA-CUTOUT TEXTURES
// ============================================================================

function createCurvedBotanicalPlateGeo(
  width: number,
  length: number,
  opts: {
    fold?: number;
    arch?: number;
    rise?: number;
    roll?: number;
    cols?: number;
    rows?: number;
    taperOutline?: boolean;
  } = {},
): THREE.BufferGeometry {
  const fold = opts.fold ?? 0.24;
  const arch = opts.arch ?? 0.22;
  const rise = opts.rise ?? 0.08;
  const roll = opts.roll ?? 0;
  const cols = opts.cols ?? 4;
  const rows = opts.rows ?? 8;
  const geo = new THREE.PlaneGeometry(width, length, cols, rows);
  geo.translate(0, length * 0.5, 0);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const cosR = Math.cos(roll);
  const sinR = Math.sin(roll);

  for (let i = 0; i < pos.count; i++) {
    const rawX = pos.getX(i);
    const rawY = pos.getY(i);
    const t = Math.max(0, Math.min(1, rawY / Math.max(0.001, length)));
    const uLat = rawX / Math.max(0.001, width * 0.5);
    const absU = Math.abs(uLat);

    const widthEnv = opts.taperOutline ? Math.max(0.06, Math.sin(Math.pow(t, 0.68) * Math.PI)) : 1.0;
    const localX = rawX * widthEnv;
    const vFoldBell = Math.sin(Math.pow(t, 0.5) * Math.PI * 0.94);
    const vFoldZ = -Math.pow(absU, 0.9) * fold * width * 0.45 * vFoldBell;
    const archCurveZ = -Math.sin(t * Math.PI * 0.55) * rise * length + Math.pow(t, 2.0) * arch * length;
    const rawZ = vFoldZ + archCurveZ;

    const rolledX = localX * cosR - vFoldZ * sinR * 0.4;
    const rolledZ = localX * sinR * 0.5 + rawZ;
    const curvedY = rawY * (1 - 0.12 * t * t);

    pos.setXYZ(i, rolledX, curvedY, rolledZ);
    uv.setXY(i, uLat * 0.5 + 0.5, t);
  }
  geo.computeVertexNormals();
  return geo;
}

function createCuppedPetalGeometry(
  width = 0.095,
  height = 0.105,
  cupDepth = 0.032,
  rows = 3,
  cols = 2,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];

  const evalPt = (u: number, v: number): [number, number, number] => {
    const x = u * width * 0.5;
    const y = v * height;
    const cupZ = Math.sin(v * Math.PI) * cupDepth - (1 - u * u) * cupDepth * 0.42 * v;
    const reflexZ = v > 0.72 ? -(v - 0.72) * 0.044 : 0;
    return [x, y, cupZ + reflexZ];
  };

  for (let r = 0; r < rows; r++) {
    const v0 = r / rows;
    const v1 = (r + 1) / rows;
    for (let c = 0; c < cols; c++) {
      const u0 = -1 + (2 * c) / cols;
      const u1 = -1 + (2 * (c + 1)) / cols;
      const p00 = evalPt(u0, v0);
      const p10 = evalPt(u1, v0);
      const p01 = evalPt(u0, v1);
      const p11 = evalPt(u1, v1);
      positions.push(...p00, ...p10, ...p11, ...p00, ...p11, ...p01);
      uvs.push(
        (u0 + 1) * 0.5,
        v0,
        (u1 + 1) * 0.5,
        v0,
        (u1 + 1) * 0.5,
        v1,
        (u0 + 1) * 0.5,
        v0,
        (u1 + 1) * 0.5,
        v1,
        (u0 + 1) * 0.5,
        v1,
      );
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

function makeAlphaMaskCanvasTex(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 512, 512);
    draw(ctx, 512, 512);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function createRoseLeafAlphaTexture(): THREE.CanvasTexture {
  return makeAlphaMaskCanvasTex((ctx) => {
    const drawSerratedLeaflet = (
      cx: number,
      cy: number,
      len: number,
      halfW: number,
      rot: number,
      teeth: number,
    ) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.fillStyle = 'rgb(255, 118, 35)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let i = 1; i <= 32; i++) {
        const t = i / 32;
        const env = Math.sin(Math.pow(t, 0.72) * Math.PI * 0.96);
        const serration = t > 0.14 && t < 0.94 ? 1.0 + 0.08 * Math.sin(t * Math.PI * 2 * teeth) : 1.0;
        ctx.lineTo(halfW * env * serration, -t * len);
      }
      ctx.lineTo(0, -len * 1.02);
      for (let i = 32; i >= 1; i--) {
        const t = i / 32;
        const env = Math.sin(Math.pow(t, 0.72) * Math.PI * 0.96);
        const serration = t > 0.14 && t < 0.94 ? 1.0 + 0.08 * Math.sin(t * Math.PI * 2 * teeth) : 1.0;
        ctx.lineTo(-halfW * env * serration, -t * len);
      }
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgb(255, 225, 95)';
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -len * 0.95);
      ctx.stroke();

      ctx.lineWidth = 2.0;
      for (let v = 1; v <= 5; v++) {
        const vt = v / 6.2;
        const vy = -vt * len;
        const vw = halfW * Math.sin(Math.pow(vt, 0.72) * Math.PI * 0.96) * 0.78;
        for (const s of [-1, 1] as const) {
          ctx.beginPath();
          ctx.moveTo(0, vy);
          ctx.quadraticCurveTo(s * vw * 0.55, vy - 10, s * vw, vy - 22);
          ctx.stroke();
        }
      }
      ctx.restore();
    };

    ctx.strokeStyle = 'rgb(255, 200, 70)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(256, 502);
    ctx.lineTo(256, 290);
    ctx.stroke();

    drawSerratedLeaflet(256, 295, 245, 92, 0, 8);
    drawSerratedLeaflet(252, 378, 178, 72, -1.02, 7);
    drawSerratedLeaflet(260, 378, 178, 72, 1.02, 7);
  });
}

function createRosePetalAlphaTexture(): THREE.CanvasTexture {
  return makeAlphaMaskCanvasTex((ctx) => {
    const grad = ctx.createRadialGradient(256, 420, 24, 256, 250, 245);
    grad.addColorStop(0.0, 'rgb(255, 95, 50)');
    grad.addColorStop(0.45, 'rgb(255, 165, 110)');
    grad.addColorStop(0.85, 'rgb(255, 225, 175)');
    grad.addColorStop(1.0, 'rgb(255, 255, 220)');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(220, 494);
    ctx.bezierCurveTo(96, 448, 32, 270, 62, 138);
    ctx.bezierCurveTo(88, 42, 188, 28, 232, 58);
    ctx.quadraticCurveTo(256, 78, 280, 58);
    ctx.bezierCurveTo(324, 28, 424, 42, 450, 138);
    ctx.bezierCurveTo(480, 270, 416, 448, 292, 494);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgb(255, 240, 210)';
    ctx.lineWidth = 2.2;
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(256 + i * 7, 488);
      ctx.quadraticCurveTo(256 + i * 28, 290, 256 + i * 44, 82 + Math.abs(i) * 14);
      ctx.stroke();
    }
  });
}

function createHydrangeaLeafAlphaTexture(): THREE.CanvasTexture {
  return makeAlphaMaskCanvasTex((ctx) => {
    ctx.fillStyle = 'rgb(255, 120, 40)';
    ctx.beginPath();
    ctx.moveTo(256, 494);
    for (let i = 1; i <= 40; i++) {
      const t = i / 40;
      const env = Math.sin(Math.pow(t, 0.72) * Math.PI * 0.97);
      const serration = t > 0.12 && t < 0.94 ? 1.0 + 0.065 * Math.sin(t * Math.PI * 2 * 11) : 1.0;
      ctx.lineTo(256 + 196 * env * serration, 494 - t * 468);
    }
    ctx.lineTo(256, 18);
    for (let i = 40; i >= 1; i--) {
      const t = i / 40;
      const env = Math.sin(Math.pow(t, 0.72) * Math.PI * 0.97);
      const serration = t > 0.12 && t < 0.94 ? 1.0 + 0.065 * Math.sin(t * Math.PI * 2 * 11) : 1.0;
      ctx.lineTo(256 - 196 * env * serration, 494 - t * 468);
    }
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgb(255, 235, 110)';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(256, 494);
    ctx.lineTo(256, 26);
    ctx.stroke();

    ctx.lineWidth = 3.0;
    for (let v = 1; v <= 6; v++) {
      const vt = v / 7.2;
      const vy = 494 - vt * 452;
      const vw = 175 * Math.sin(Math.pow(vt, 0.72) * Math.PI * 0.97);
      for (const s of [-1, 1] as const) {
        ctx.beginPath();
        ctx.moveTo(256, vy);
        ctx.quadraticCurveTo(256 + s * vw * 0.55, vy - 22, 256 + s * vw, vy - 56);
        ctx.stroke();
      }
    }
  });
}

function createHydrangeaFloretAlphaTexture(): THREE.CanvasTexture {
  return makeAlphaMaskCanvasTex((ctx) => {
    for (let k = 0; k < 4; k++) {
      ctx.save();
      ctx.translate(256, 256);
      ctx.rotate((k * Math.PI) / 2);
      const grad = ctx.createRadialGradient(0, -110, 10, 0, -120, 128);
      grad.addColorStop(0.0, 'rgb(255, 245, 200)');
      grad.addColorStop(0.65, 'rgb(255, 185, 130)');
      grad.addColorStop(1.0, 'rgb(255, 125, 85)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.bezierCurveTo(88, -32, 118, -118, 72, -196);
      ctx.quadraticCurveTo(32, -238, 0, -244);
      ctx.quadraticCurveTo(-32, -238, -72, -196);
      ctx.bezierCurveTo(-118, -118, -88, -32, 0, -16);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgb(255, 145, 95)';
      ctx.lineWidth = 2.0;
      for (let v = -2; v <= 2; v++) {
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.quadraticCurveTo(v * 26, -120, v * 32, -216 + Math.abs(v) * 14);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.fillStyle = 'rgb(255, 90, 255)';
    ctx.beginPath();
    ctx.arc(256, 256, 26, 0, Math.PI * 2);
    ctx.fill();
  });
}

function createLavenderLeafAlphaTexture(): THREE.CanvasTexture {
  return makeAlphaMaskCanvasTex((ctx) => {
    ctx.fillStyle = 'rgb(255, 155, 85)';
    ctx.beginPath();
    ctx.moveTo(256, 506);
    ctx.bezierCurveTo(188, 390, 174, 180, 256, 12);
    ctx.bezierCurveTo(338, 180, 324, 390, 256, 506);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgb(255, 235, 165)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(256, 504);
    ctx.lineTo(256, 26);
    ctx.stroke();
  });
}

function createLavenderSpikeAlphaTexture(): THREE.CanvasTexture {
  return makeAlphaMaskCanvasTex((ctx) => {
    ctx.strokeStyle = 'rgb(255, 65, 35)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(256, 508);
    ctx.lineTo(256, 46);
    ctx.stroke();

    const whorls = 7;
    for (let w = 0; w < whorls; w++) {
      const frac = w / (whorls - 1);
      const wy = 450 - frac * 388;
      const spread = (1.0 - frac * 0.42) * 86;
      const fSize = (1.0 - frac * 0.34) * 34;

      ctx.fillStyle = 'rgb(255, 60, 120)';
      for (const s of [-1, 0, 1] as const) {
        ctx.beginPath();
        ctx.ellipse(256 + s * spread * 0.36, wy + 12, fSize * 0.46, fSize * 0.72, s * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const [fx, fy, rx, ry, rot] of [
        [-spread * 0.65, -8, fSize * 0.85, fSize * 0.56, -0.45],
        [spread * 0.65, -8, fSize * 0.85, fSize * 0.56, 0.45],
        [-spread * 0.32, -16, fSize * 0.68, fSize * 0.74, -0.18],
        [spread * 0.32, -16, fSize * 0.68, fSize * 0.74, 0.18],
        [0, -22, fSize * 0.76, fSize * 0.78, 0],
      ] as const) {
        ctx.save();
        ctx.translate(256 + fx, wy + fy);
        ctx.rotate(rot);
        ctx.fillStyle = fy < -12 ? 'rgb(255, 245, 220)' : 'rgb(255, 195, 185)';
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  });
}

function createWisteriaPinnateLeafTexture(): THREE.CanvasTexture {
  return makeAlphaMaskCanvasTex((ctx) => {
    ctx.strokeStyle = 'rgb(255, 200, 60)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(256, 502);
    ctx.quadraticCurveTo(252, 260, 256, 48);
    ctx.stroke();

    const drawLeaflet = (cx: number, cy: number, len: number, halfW: number, rot: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.fillStyle = 'rgb(255, 130, 40)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(halfW, -len * 0.25, halfW * 0.85, -len * 0.78, 0, -len);
      ctx.bezierCurveTo(-halfW * 0.85, -len * 0.78, -halfW, -len * 0.25, 0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgb(255, 230, 100)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.lineTo(0, -len * 0.9);
      ctx.stroke();
      ctx.restore();
    };

    for (let p = 0; p < 5; p++) {
      const py = 445 - p * 84;
      const scale = 1.0 - p * 0.08;
      drawLeaflet(250, py, 136 * scale, 40 * scale, -1.18 + p * 0.07);
      drawLeaflet(262, py, 136 * scale, 40 * scale, 1.18 - p * 0.07);
    }
    drawLeaflet(256, 76, 124, 38, 0);
  });
}

function createWisteriaRacemeAlphaTexture(): THREE.CanvasTexture {
  return makeAlphaMaskCanvasTex((ctx) => {
    ctx.strokeStyle = 'rgb(255, 70, 50)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(256, 6);
    ctx.lineTo(256, 488);
    ctx.stroke();

    const tiers = 11;
    for (let t = 0; t < tiers; t++) {
      const frac = t / (tiers - 1);
      const ty = 26 + frac * 452;
      const widthSpan = (1.0 - Math.pow(frac, 1.15) * 0.78) * 142;
      const bScale = 1.08 - frac * 0.56;
      const blossoms = frac > 0.8 ? 2 : 4;

      for (let b = 0; b < blossoms; b++) {
        const bf = (b / (blossoms - 1)) * 2 - 1;
        const bx = 256 + bf * widthSpan + Math.sin(t * 2.1 + b) * 14;
        const by = ty + Math.cos(b * 1.9 + t) * 10;

        ctx.fillStyle = 'rgb(255, 55, 95)';
        ctx.beginPath();
        ctx.ellipse(bx, by - 14 * bScale, 10 * bScale, 8 * bScale, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgb(255, 245, 220)';
        ctx.beginPath();
        ctx.ellipse(bx, by, 28 * bScale, 24 * bScale, bf * 0.25, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgb(255, 160, 175)';
        ctx.beginPath();
        ctx.ellipse(bx - 11 * bScale, by + 12 * bScale, 13 * bScale, 17 * bScale, 0.25, 0, Math.PI * 2);
        ctx.ellipse(bx + 11 * bScale, by + 12 * bScale, 13 * bScale, 17 * bScale, -0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgb(255, 125, 145)';
        ctx.beginPath();
        ctx.ellipse(bx, by + 17 * bScale, 11 * bScale, 14 * bScale, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

function buildEnglishRoseBushGeometry(): THREE.BufferGeometry {
  const acc = createGeoAccumulator();
  const caneGeo = new THREE.CylinderGeometry(0.010, 0.016, 1.0, 5);
  const leafSprayGeo = createCurvedBotanicalPlateGeo(0.24, 0.22, { fold: 0.24, arch: 0.22, rise: 0.08, cols: 2, rows: 3 });
  const outerPetalGeo = createCuppedPetalGeometry(0.115, 0.112, 0.036, 3, 2);
  const innerPetalGeo = createCuppedPetalGeometry(0.086, 0.090, 0.032, 3, 2);
  const stamenAntherGeo = new THREE.SphereGeometry(0.024, 6, 4);

  const caneSpecs: readonly [number, number, number, number, number][] = [
    [0.15, 0.14, 0.96, 0.06, 0.04],
    [1.15, 0.25, 0.88, 0.22, -0.14],
    [2.18, 0.28, 0.82, 0.18, 0.21],
    [3.25, 0.24, 0.91, -0.21, 0.14],
    [4.28, 0.27, 0.78, -0.24, -0.12],
    [5.35, 0.22, 0.85, 0.02, -0.25],
    [0.75, 0.34, 0.68, 0.28, 0.12],
    [3.85, 0.33, 0.72, -0.27, -0.05],
  ];

  const appendRoseBloom = (
    bx: number,
    by: number,
    bz: number,
    tiltX: number,
    tiltZ: number,
    scale: number,
    seed: number,
    isHalfBud = false,
  ) => {
    const bloomMat = composePartMatrix([bx, by, bz], [tiltX, seed * 6.28, tiltZ], [scale, scale, scale]);
    const outerPitch = isHalfBud ? 0.38 : 0.92;
    for (let p = 0; p < 5; p++) {
      const pAng = (p / 5) * Math.PI * 2 + 0.15;
      const pm = bloomMat
        .clone()
        .multiply(composePartMatrix([Math.sin(pAng) * 0.022, 0.0, Math.cos(pAng) * 0.022], [outerPitch, pAng, 0.06], [1, 1, 1]));
      appendPartToBotanicalAcc(acc, outerPetalGeo, pm, '#f5c4d6', 1.0, 1.05, 0.0, 1.05, seed + p * 0.09, false, 2);
    }
    for (let p = 0; p < 5; p++) {
      const pAng = (p / 5) * Math.PI * 2 + 0.78;
      const pm = bloomMat
        .clone()
        .multiply(
          composePartMatrix(
            [Math.sin(pAng) * 0.013, 0.009, Math.cos(pAng) * 0.013],
            [isHalfBud ? 0.22 : 0.54, pAng, -0.05],
            [1, 1, 1],
          ),
        );
      appendPartToBotanicalAcc(acc, innerPetalGeo, pm, '#ffffff', 1.0, 1.08, 0.0, 1.05, seed + p * 0.13, false, 2);
    }
    for (let p = 0; p < 4; p++) {
      const pAng = (p / 4) * Math.PI * 2 + 0.42;
      const pm = bloomMat
        .clone()
        .multiply(composePartMatrix([Math.sin(pAng) * 0.005, 0.016, Math.cos(pAng) * 0.005], [0.24, pAng, 0.10], [0.74, 0.78, 0.74]));
      appendPartToBotanicalAcc(acc, innerPetalGeo, pm, '#eb9bb8', 1.0, 1.1, 0.0, 1.05, seed + p * 0.17, false, 2);
    }
    if (!isHalfBud) {
      const stM = bloomMat.clone().multiply(composePartMatrix([0, 0.032, 0], [0, 0, 0], [1.05, 0.58, 1.05]));
      appendPartToBotanicalAcc(acc, stamenAntherGeo, stM, '#facc15', 0.0, 1.05, 0.0, 1.05, seed, false, 0);
    }
  };

  caneSpecs.forEach(([yaw, lean, h, tx, tz], idx) => {
    const dirVec = new THREE.Vector3(tx, h, tz);
    const len = dirVec.length();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirVec.clone().normalize());
    const caneMat = new THREE.Matrix4().compose(
      new THREE.Vector3(tx * 0.5, h * 0.5, tz * 0.5),
      quat,
      new THREE.Vector3(1, len, 1),
    );
    appendPartToBotanicalAcc(acc, caneGeo, caneMat, '#537341', 0.0, 0.95, 0.0, 1.05, idx * 0.11, false, 0);

    for (const [frac, lScale, sideRot] of [
      [0.36, 1.06, -0.7],
      [0.64, 0.96, 0.85],
      [0.80, 0.84, 2.2],
    ] as const) {
      const lm = composePartMatrix(
        [tx * frac, h * frac, tz * frac],
        [0.65 + lean * 0.3, yaw + sideRot, (idx % 2 === 0 ? 1 : -1) * 0.15],
        [lScale, lScale, lScale],
      );
      appendPartToBotanicalAcc(acc, leafSprayGeo, lm, frac < 0.5 ? '#3d7432' : '#528e42', 0.0, 1.0, 0.0, 1.05, idx * 0.12 + frac, false, 1);
    }

    appendRoseBloom(tx, h, tz, tz * 0.7, -tx * 0.7, 1.06 + (idx % 2) * 0.12, idx * 0.13, false);

    if (idx % 2 === 0) {
      appendRoseBloom(
        tx * 0.72 + Math.cos(yaw + 1.4) * 0.12,
        h * 0.82,
        tz * 0.72 + Math.sin(yaw + 1.4) * 0.12,
        0.22,
        -0.22,
        0.64,
        idx * 0.19 + 0.07,
        true,
      );
    }
  });

  caneGeo.dispose();
  leafSprayGeo.dispose();
  outerPetalGeo.dispose();
  innerPetalGeo.dispose();
  stamenAntherGeo.dispose();
  return finalizeBotanicalAccGeometry(acc);
}

function buildHydrangeaBushGeometry(): THREE.BufferGeometry {
  const acc = createGeoAccumulator();
  const stemGeo = new THREE.CylinderGeometry(0.012, 0.020, 1.0, 5);
  const broadLeafGeo = createCurvedBotanicalPlateGeo(0.24, 0.28, { fold: 0.28, arch: 0.24, rise: 0.09, cols: 2, rows: 3 });
  const floretCardGeo = createCuppedPetalGeometry(0.145, 0.145, 0.018, 2, 2);
  floretCardGeo.translate(0, -0.0725, 0);
  const coreSphereGeo = new THREE.SphereGeometry(1.0, 6, 5);

  const headSpecs: readonly [number, number, number, number][] = [
    [0.0, 0.94, 0.0, 0.21],
    [0.24, 0.80, 0.18, 0.19],
    [-0.26, 0.78, 0.16, 0.19],
    [0.22, 0.76, -0.21, 0.18],
    [-0.21, 0.82, -0.22, 0.20],
    [0.02, 0.62, 0.31, 0.17],
    [-0.31, 0.60, -0.02, 0.17],
    [0.32, 0.61, 0.01, 0.17],
  ];

  headSpecs.forEach(([hx, hy, hz, panicleR], hIdx) => {
    const rootX = hx * 0.22;
    const rootZ = hz * 0.22;
    const vec = new THREE.Vector3(hx - rootX, hy - 0.05, hz - rootZ);
    const len = vec.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vec.clone().normalize());
    const stemMat = new THREE.Matrix4().compose(
      new THREE.Vector3((hx + rootX) * 0.5, (hy + 0.05) * 0.5, (hz + rootZ) * 0.5),
      q,
      new THREE.Vector3(1, len, 1),
    );
    appendPartToBotanicalAcc(acc, stemGeo, stemMat, '#685947', 0.0, 0.92, 0.0, 1.15, hIdx * 0.14, false, 0);

    for (let lf = 0; lf < 3; lf++) {
      const lAng = Math.atan2(hz, hx) + (lf - 1) * 0.92 + hIdx * 0.5;
      const lm = composePartMatrix(
        [hx * 0.78 + Math.cos(lAng) * 0.06, hy - 0.16 - lf * 0.04, hz * 0.78 + Math.sin(lAng) * 0.06],
        [0.88, lAng, (lf - 1) * 0.14],
        [1.05 + (lf % 2) * 0.12, 1.05, 1.05],
      );
      appendPartToBotanicalAcc(
        acc,
        broadLeafGeo,
        lm,
        lf === 1 ? '#457b3d' : '#57944a',
        0.0,
        0.95,
        0.0,
        1.15,
        hIdx * 0.14 + lf * 0.05,
        false,
        1,
      );
    }

    const headCenter = new THREE.Vector3(hx, hy, hz);
    const coreMat = composePartMatrix([hx, hy, hz], [0, 0, 0], [panicleR * 0.72, panicleR * 0.72, panicleR * 0.72]);
    appendPartToBotanicalAcc(acc, coreSphereGeo, coreMat, '#d5dcf7', 1.0, 1.02, 0.0, 1.15, hIdx * 0.1, false, 0);

    const floretCount = 20;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const fwdZ = new THREE.Vector3(0, 0, 1);
    for (let f = 0; f < floretCount; f++) {
      const fyFrac = 1 - (f / (floretCount - 1)) * 1.25;
      const radiusAtY = Math.sqrt(Math.max(0.02, 1 - fyFrac * fyFrac));
      const theta = goldenAngle * f + hIdx * 1.7;
      const dir = new THREE.Vector3(Math.cos(theta) * radiusAtY, fyFrac, Math.sin(theta) * radiusAtY).normalize();
      const fq = new THREE.Quaternion().setFromUnitVectors(fwdZ, dir);
      const rollQ = new THREE.Quaternion().setFromAxisAngle(fwdZ, f * 0.65);
      fq.multiply(rollQ);
      const fScale = 0.92 + (f % 3) * 0.10;
      const floretMat = new THREE.Matrix4().compose(
        new THREE.Vector3(hx + dir.x * panicleR * 0.96, hy + dir.y * panicleR * 0.96, hz + dir.z * panicleR * 0.96),
        fq,
        new THREE.Vector3(fScale, fScale, fScale),
      );
      const toneTint = f % 3 === 0 ? '#ffffff' : f % 3 === 1 ? '#eef4ff' : '#dfe7fc';
      appendPartToBotanicalAcc(acc, floretCardGeo, floretMat, toneTint, 1.0, 1.05, 0.0, 1.15, hIdx * 0.1 + f * 0.05, false, 2, headCenter);
    }
  });

  stemGeo.dispose();
  broadLeafGeo.dispose();
  floretCardGeo.dispose();
  coreSphereGeo.dispose();
  return finalizeBotanicalAccGeometry(acc);
}

function buildEnglishLavenderClumpGeometry(): THREE.BufferGeometry {
  const acc = createGeoAccumulator();
  const sageLeafGeo = createCurvedBotanicalPlateGeo(0.042, 0.27, { fold: 0.20, arch: 0.24, rise: 0.09, cols: 1, rows: 3 });
  const stalkGeo = new THREE.CylinderGeometry(0.0055, 0.0085, 1.0, 4);
  const spikeRibbonA = createCurvedBotanicalPlateGeo(0.092, 0.28, { fold: 0.05, arch: 0.04, rise: 0.02, cols: 1, rows: 4 });
  const spikeRibbonB = spikeRibbonA.clone();
  spikeRibbonB.rotateY(Math.PI * 0.5);
  const crossedSpikeGeo = mergeGeometries([spikeRibbonA, spikeRibbonB], false);
  spikeRibbonA.dispose();
  spikeRibbonB.dispose();

  for (let l = 0; l < 52; l++) {
    const ring = l < 24 ? 0 : 1;
    const ang = (l * 2.39996) % (Math.PI * 2);
    const pitch = ring === 0 ? 0.95 : 0.52;
    const lScale = ring === 0 ? 1.08 : 0.88;
    const lm = composePartMatrix(
      [Math.cos(ang) * 0.06, 0.04 + ring * 0.05, Math.sin(ang) * 0.06],
      [pitch, ang, 0],
      [lScale, lScale, lScale],
    );
    appendPartToBotanicalAcc(acc, sageLeafGeo, lm, l % 2 === 0 ? '#7d9b7b' : '#96b392', 0.0, 0.85, 0.0, 0.92, l * 0.03, false, 1);
  }

  for (let s = 0; s < 20; s++) {
    const ring = s < 6 ? 0.14 : s < 13 ? 0.28 : 0.42;
    const ang = (s / 20) * Math.PI * 2 + (s % 3) * 0.35;
    const stemH = 0.62 - ring * 0.24 + (s % 3) * 0.03;
    const tipX = Math.cos(ang) * ring * 0.78;
    const tipZ = Math.sin(ang) * ring * 0.78;
    const rootX = Math.cos(ang) * 0.04;
    const rootZ = Math.sin(ang) * 0.04;

    const dir = new THREE.Vector3(tipX - rootX, stemH, tipZ - rootZ);
    const len = dir.length();
    const unitDir = dir.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), unitDir);
    const stalkMat = new THREE.Matrix4().compose(
      new THREE.Vector3((tipX + rootX) * 0.5, stemH * 0.5, (tipZ + rootZ) * 0.5),
      q,
      new THREE.Vector3(1, len, 1),
    );
    appendPartToBotanicalAcc(acc, stalkGeo, stalkMat, '#728e6d', 0.0, 1.25, 0.0, 0.92, s * 0.055, false, 0);

    const spScale = 0.92 + (s % 3) * 0.08;
    const spinQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s * 1.1);
    const spMat = new THREE.Matrix4().compose(
      new THREE.Vector3(rootX + (tipX - rootX) * 0.88, stemH * 0.88, rootZ + (tipZ - rootZ) * 0.88),
      q.clone().multiply(spinQ),
      new THREE.Vector3(spScale, spScale, spScale),
    );
    appendPartToBotanicalAcc(acc, crossedSpikeGeo, spMat, s % 2 === 0 ? '#ffffff' : '#ede4ff', 1.0, 1.42, 0.0, 0.92, s * 0.055, false, 2);
  }

  sageLeafGeo.dispose();
  stalkGeo.dispose();
  crossedSpikeGeo.dispose();
  return finalizeBotanicalAccGeometry(acc);
}

function buildClimbingWisteriaRacemeGeometry(): THREE.BufferGeometry {
  const acc = createGeoAccumulator();
  const leafSprayGeo = createCurvedBotanicalPlateGeo(0.28, 0.34, { fold: 0.18, arch: 0.30, rise: 0.12, cols: 4, rows: 6 });

  const stripParts: THREE.BufferGeometry[] = [];
  for (let p = 0; p < 3; p++) {
    const strip = new THREE.PlaneGeometry(0.28, 0.82, 2, 8);
    strip.translate(0, -0.43, 0);
    const pos = strip.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const frac = Math.max(0, Math.min(1, -y / 0.84));
      const zCurve = Math.sin(frac * Math.PI) * 0.025;
      pos.setZ(i, pos.getZ(i) + zCurve);
    }
    strip.computeVertexNormals();
    strip.rotateY((p * Math.PI) / 3);
    stripParts.push(strip);
  }
  const racemeCrossGeo = mergeGeometries(stripParts, false);
  stripParts.forEach((s) => s.dispose());

  for (let lf = 0; lf < 4; lf++) {
    const yaw = (lf / 4) * Math.PI * 2 + 0.35;
    const lm = composePartMatrix(
      [Math.cos(yaw) * 0.05, 0.04, Math.sin(yaw) * 0.05],
      [1.08, yaw, (lf % 2 === 0 ? 1 : -1) * 0.14],
      [1.0, 1.0, 1.0],
    );
    appendPartToBotanicalAcc(acc, leafSprayGeo, lm, lf % 2 === 0 ? '#528a42' : '#659e50', 0.0, 0.38, 0.05, -0.84, lf * 0.08, true, 1);
  }

  appendPartToBotanicalAcc(acc, racemeCrossGeo, composePartMatrix([0, 0, 0]), '#ffffff', 1.0, 1.22, 0.05, -0.84, 0.15, true, 2);

  leafSprayGeo.dispose();
  racemeCrossGeo.dispose();
  return finalizeBotanicalAccGeometry(acc);
}

function buildCattailReedGeometry(): THREE.BufferGeometry {
  const acc = createGeoAccumulator();
  const bladeGeo = createCurvedBotanicalPlateGeo(0.055, 0.58, { fold: 0.24, arch: 0.26, rise: 0.12, cols: 2, rows: 7, taperOutline: true });
  const stalkGeo = new THREE.CylinderGeometry(0.011, 0.015, 0.96, 6);
  const spikeGeo = new THREE.CapsuleGeometry(0.028, 0.14, 4, 8);

  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + 0.3;
    appendPartToBotanicalAcc(
      acc,
      bladeGeo,
      composePartMatrix([Math.cos(ang) * 0.04, 0.02, Math.sin(ang) * 0.04], [0.58, ang, 0], [1, 1 + (i % 2) * 0.15, 1]),
      i % 2 === 0 ? '#4d8a3f' : '#64a34f',
      0.0,
      1.05,
      0.0,
      0.98,
      i * 0.16,
      false,
      0,
    );
  }
  for (let s = 0; s < 3; s++) {
    const ang = (s / 3) * Math.PI * 2 + 0.5;
    const h = 0.78 + s * 0.12;
    const ox = Math.cos(ang) * 0.05;
    const oz = Math.sin(ang) * 0.05;
    appendPartToBotanicalAcc(
      acc,
      stalkGeo,
      composePartMatrix([ox, h * 0.5, oz], [Math.sin(ang) * 0.08, 0, -Math.cos(ang) * 0.08], [1, h / 0.96, 1]),
      '#588c42',
      0.0,
      1.15,
      0.0,
      0.98,
      s * 0.22,
      false,
      0,
    );
    appendPartToBotanicalAcc(
      acc,
      spikeGeo,
      composePartMatrix([ox, h - 0.10, oz], [Math.sin(ang) * 0.08, 0, -Math.cos(ang) * 0.08], [1, 1, 1]),
      '#6d4329',
      0.0,
      1.2,
      0.0,
      0.98,
      s * 0.22,
      false,
      0,
    );
  }

  bladeGeo.dispose();
  stalkGeo.dispose();
  spikeGeo.dispose();
  return finalizeBotanicalAccGeometry(acc);
}

function createBotanicalAlphaCutoutWindMaterial(
  leafAlphaTex: THREE.Texture,
  petalAlphaTex: THREE.Texture,
  windUniforms: BlitzWindUniforms,
  windAmp = 0.075,
  flutterAmp = 0.024,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uLeafTex: { value: leafAlphaTex },
        uPetalTex: { value: petalAlphaTex },
        uAlphaThreshold: { value: 0.34 },
        uLightDirection: windUniforms.uLightDirection,
        uLightColor: windUniforms.uLightColor,
        uWindPhase: windUniforms.uWindPhase,
        uWindDirection: windUniforms.uWindDirection,
        uWindStrength: windUniforms.uWindStrength,
        uWindGust: windUniforms.uWindGust,
        uWindAmp: { value: windAmp },
        uFlutterAmp: { value: flutterAmp },
      },
    ]),
    fog: true,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute vec3 aPartColor;
      attribute vec3 aWindParams;
      attribute vec3 aBloomTint;
      attribute float aPartKind;

      uniform float uWindPhase;
      uniform vec2 uWindDirection;
      uniform float uWindStrength;
      uniform float uWindGust;
      uniform float uWindAmp;
      uniform float uFlutterAmp;

      varying vec3 vColor;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      varying vec2 vBotanicalUv;
      varying float vPetalMask;
      varying float vPartKind;

      void main() {
        mat4 worldMat = modelMatrix * instanceMatrix;
        vec3 originW = (worldMat * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

        vec2 windDir = length(uWindDirection) > 0.001 ? normalize(uWindDirection) : vec2(0.7071, 0.7071);
        vec2 perpDir = vec2(-windDir.y, windDir.x);

        float swayWeight = aWindParams.x;
        float petalMask = aWindParams.y;
        float subSeed = aWindParams.z;

        float spatialPhase = dot(originW.xz, windDir) * 0.55 + originW.y * 0.30;
        float primaryWave = sin(uWindPhase * 0.62 - spatialPhase + subSeed * 3.1);
        float gustEnv = 0.55 + 0.45 * sin(uWindPhase * 0.25 - spatialPhase * 0.45);
        float windMag = (0.45 + uWindStrength * 0.95) * (1.0 + uWindGust * gustEnv * 0.85);

        float macroDisp = primaryWave * uWindAmp * windMag * swayWeight;
        float flutterDisp = sin(uWindPhase * 1.45 - spatialPhase * 0.8 + subSeed * 6.2831853) * uFlutterAmp * windMag * swayWeight;

        vec4 worldPos = worldMat * vec4(position, 1.0);
        worldPos.x += windDir.x * macroDisp + perpDir.x * flutterDisp;
        worldPos.z += windDir.y * macroDisp + perpDir.y * flutterDisp;
        worldPos.y -= abs(macroDisp) * 0.14;

        vec4 mvPosition = viewMatrix * worldPos;
        vColor = mix(aPartColor, aPartColor * aBloomTint, petalMask);
        vWorldNormal = normalize(mat3(worldMat) * normal);
        vWorldPos = worldPos.xyz;
        vBotanicalUv = uv;
        vPetalMask = petalMask;
        vPartKind = aPartKind;

        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform sampler2D uLeafTex;
      uniform sampler2D uPetalTex;
      uniform float uAlphaThreshold;
      uniform vec3 uLightDirection;
      uniform vec3 uLightColor;

      varying vec3 vColor;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      varying vec2 vBotanicalUv;
      varying float vPetalMask;
      varying float vPartKind;

      void main() {
        vec3 baseCol = vColor;
        if (vPartKind > 1.5) {
          vec4 pMask = texture2D(uPetalTex, vBotanicalUv);
          if (pMask.r < uAlphaThreshold) discard;
          float veinHighlight = smoothstep(0.45, 0.95, pMask.g);
          float calyxHint = smoothstep(0.65, 0.98, pMask.b) * (1.0 - smoothstep(0.35, 0.65, pMask.g));
          baseCol = mix(baseCol * 0.86, min(vec3(1.0), baseCol * 1.18 + 0.06), veinHighlight);
          baseCol = mix(baseCol, vec3(0.34, 0.50, 0.30), calyxHint * 0.55);
        } else if (vPartKind > 0.5) {
          vec4 lMask = texture2D(uLeafTex, vBotanicalUv);
          if (lMask.r < uAlphaThreshold) discard;
          float veinBoost = smoothstep(0.55, 0.92, lMask.g);
          baseCol = mix(baseCol * 0.92, min(vec3(1.0), baseCol * 1.24 + vec3(0.04, 0.06, 0.01)), veinBoost * 0.65);
        }

        vec3 N = normalize(vWorldNormal);
        if (!gl_FrontFacing) N = -N;
        vec3 L = normalize(uLightDirection);
        float ndl = dot(N, L);

        float litFactor = smoothstep(-0.22, 0.85, ndl);
        vec3 bounceGreen = vec3(0.46, 0.66, 0.28);
        float downMask = smoothstep(-0.2, 0.8, -N.y) * clamp(1.0 - max(vWorldPos.y, 0.0) / 1.5, 0.0, 1.0);
        baseCol = mix(baseCol, bounceGreen, downMask * (1.0 - vPetalMask) * 0.16);

        vec3 litCol = baseCol * uLightColor * (0.98 + 0.14 * litFactor);
        vec3 shadowCol = baseCol * mix(vec3(0.68, 0.72, 0.68), vec3(0.76, 0.72, 0.78), vPetalMask);
        vec3 finalRgb = mix(shadowCol, litCol, 0.36 + 0.64 * litFactor);

        gl_FragColor = vec4(finalRgb, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
    side: THREE.DoubleSide,
  });
}

function createCanopyLeafClusterGeometry(planesPerCluster: number): THREE.BufferGeometry {
  const clusterGeos: THREE.BufferGeometry[] = [];
  const leafCenters = new Float32Array(planesPerCluster * 4 * 3);
  const leafLocalPos = new Float32Array(planesPerCluster * 4 * 3);
  const leafPlaneSeed = new Float32Array(planesPerCluster * 4);

  let s = 41327;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  for (let a = 0; a < planesPerCluster; a++) {
    const plane = new THREE.PlaneGeometry(0.92, 0.92);
    const seed = rnd();
    const radius = 1 - Math.pow(rnd(), 3);
    const phi = Math.PI * 2 * rnd();
    const theta = Math.PI * rnd();
    const center = new THREE.Vector3().setFromSpherical(new THREE.Spherical(radius, theta, phi));
    const radialNormal = center.clone().normalize();
    const posAttr = plane.attributes.position;
    const normAttr = plane.attributes.normal;
    for (let v = 0; v < 4; v++) {
      const vertIdx = a * 4 + v;
      const s3 = v * 3;
      const f3 = vertIdx * 3;
      const p = new THREE.Vector3(posAttr.array[s3], posAttr.array[s3 + 1], posAttr.array[s3 + 2]);
      leafCenters[f3] = center.x;
      leafCenters[f3 + 1] = center.y;
      leafCenters[f3 + 2] = center.z;
      leafLocalPos[f3] = p.x;
      leafLocalPos[f3 + 1] = p.y;
      leafLocalPos[f3 + 2] = p.z;
      leafPlaneSeed[vertIdx] = seed;
      const blended = p.clone().lerp(radialNormal, 0.65).normalize();
      normAttr.array[s3] = blended.x;
      normAttr.array[s3 + 1] = blended.y;
      normAttr.array[s3 + 2] = blended.z;
    }
    clusterGeos.push(plane);
  }
  const merged = mergeGeometries(clusterGeos, false);
  clusterGeos.forEach((g) => g.dispose());
  merged.setAttribute('aLeafCenter', new THREE.BufferAttribute(leafCenters, 3));
  merged.setAttribute('aLeafLocalPos', new THREE.BufferAttribute(leafLocalPos, 3));
  merged.setAttribute('aLeafPlaneSeed', new THREE.BufferAttribute(leafPlaneSeed, 1));
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function createCanopyBillboardWindMaterial(
  leafMaskTex: THREE.Texture,
  windUniforms: BlitzWindUniforms,
  colorShadowHex: string,
  colorMidHex: string,
  colorSunHex: string,
  leafScale = 1.48,
): THREE.ShaderMaterial {
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uLeafTex: { value: leafMaskTex },
        uColorShadow: { value: new THREE.Color(colorShadowHex) },
        uColorMid: { value: new THREE.Color(colorMidHex) },
        uColorSun: { value: new THREE.Color(colorSunHex) },
        uLeafScale: { value: leafScale },
        uAlphaThreshold: { value: 0.30 },
        uLightDirection: windUniforms.uLightDirection,
        uLightColor: windUniforms.uLightColor,
        uWindPhase: windUniforms.uWindPhase,
        uWindDirection: windUniforms.uWindDirection,
        uWindStrength: windUniforms.uWindStrength,
        uWindGust: windUniforms.uWindGust,
      },
    ]),
    fog: true,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute vec3 aLeafCenter;
      attribute vec3 aLeafLocalPos;
      attribute float aLeafPlaneSeed;

      uniform float uLeafScale;
      uniform float uWindPhase;
      uniform vec2 uWindDirection;
      uniform float uWindStrength;
      uniform float uWindGust;

      varying vec2 vUv;
      varying vec3 vSphereNormal;
      varying float vCrownHeight;
      varying float vCrownAO;
      varying vec3 vInstTint;

      void main() {
        vUv = uv;
        #ifdef USE_INSTANCING_COLOR
          vInstTint = instanceColor;
        #else
          vInstTint = vec3(1.0);
        #endif

        vec3 treeWorldOrigin = (modelMatrix * instanceMatrix)[3].xyz;
        float windAmp = max(0.62, uWindStrength);
        float spatialPhase =
          dot(treeWorldOrigin.xz, vec2(0.14, 0.11)) + dot(aLeafCenter.xz, vec2(0.28, 0.22));
        float swayFactor = smoothstep(-0.75, 1.0, aLeafCenter.y);

        float angle =
          aLeafPlaneSeed * 6.2831853 +
          sin(uWindPhase * 0.95 + aLeafPlaneSeed * 19.3 + spatialPhase) * 0.22 * windAmp * swayFactor;
        float s = sin(angle);
        float c = cos(angle);
        vec3 scaledLocal = aLeafLocalPos * uLeafScale;
        float rotX = scaledLocal.x * c - scaledLocal.y * s;
        float rotY = scaledLocal.x * s + scaledLocal.y * c;

        mat4 mv = viewMatrix * modelMatrix * instanceMatrix;
        vec3 camRight = normalize(vec3(mv[0][0], mv[1][0], mv[2][0]));
        vec3 camUp = normalize(vec3(mv[0][1], mv[1][1], mv[2][1]));
        vec3 camFwd = normalize(vec3(mv[0][2], mv[1][2], mv[2][2]));

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

        vec3 localPos = aLeafCenter + camRight * rotX + camUp * rotY + camFwd * ((aLeafPlaneSeed - 0.5) * 0.02) + windDisp;
        vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(localPos, 1.0);
        vSphereNormal = normalize(mat3(modelMatrix * instanceMatrix) * normalize(aLeafCenter + vec3(0.0, 0.38, 0.0)));
        vCrownHeight = smoothstep(-0.35, 0.88, aLeafCenter.y);
        vCrownAO = mix(0.76, 1.04, smoothstep(-0.75, 0.72, aLeafCenter.y));

        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform sampler2D uLeafTex;
      uniform vec3 uColorShadow;
      uniform vec3 uColorMid;
      uniform vec3 uColorSun;
      uniform float uAlphaThreshold;
      uniform vec3 uLightDirection;
      uniform vec3 uLightColor;

      varying vec2 vUv;
      varying vec3 vSphereNormal;
      varying float vCrownHeight;
      varying float vCrownAO;
      varying vec3 vInstTint;

      void main() {
        float mask = texture2D(uLeafTex, vUv).r;
        if (mask < uAlphaThreshold) discard;
        float rawNdl = dot(normalize(vSphereNormal), normalize(uLightDirection));
        float ndl = smoothstep(-0.20, 0.88, rawNdl);
        vec3 midLit = mix(uColorShadow, uColorMid, smoothstep(0.04, 0.58, ndl * 0.82 + vCrownHeight * 0.24));
        float tipSunMask = smoothstep(0.46, 0.94, ndl * 0.70 + vCrownHeight * 0.42);
        vec3 baseCol = mix(midLit, uColorSun, tipSunMask) * vInstTint * vCrownAO;
        vec3 sunMod = mix(vec3(0.86, 0.88, 0.90), uLightColor, 0.74);
        vec3 finalCol = baseCol * sunMod;
        gl_FragColor = vec4(finalCol, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
    side: THREE.DoubleSide,
  });
  registerPendingLeafMaskMaterial(mat);
  return mat;
}

// ============================================================================
// PROCEDURAL CANVAS TEXTURES FOR CENTRAL URBAN PLAZA ARCHITECTURE
// ============================================================================

function makeCanvasTex(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeat = true,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Luxury Cream (#f4e7d7) & Blush-Rose (#e5cab8) Terrazzo Checkerboard Tile Texture
 * matching `media_1795017967481_ada46a69.jpg` & `media_1795017982455_f313bc74.jpg`.
 */
function createTerrazzoCheckerboardTexture(): THREE.CanvasTexture {
  return makeCanvasTex(512, 512, (ctx, w, h) => {
    const half = w * 0.5;
    const creamChips = ['#d4b28a', '#c9937e', '#fffdf8', '#a89a8b', '#e2c2a2'];
    const roseChips = ['#ba826d', '#cfa878', '#fcf3ea', '#998276', '#dbb4a0'];

    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const isCream = (row + col) % 2 === 0;
        const tx = col * half;
        const ty = row * half;
        ctx.fillStyle = isCream ? '#f4e7d7' : '#e5cab8';
        ctx.fillRect(tx, ty, half, half);

        // Soft inner tile glaze highlight
        ctx.fillStyle = isCream ? 'rgba(255, 251, 245, 0.25)' : 'rgba(250, 234, 224, 0.22)';
        ctx.fillRect(tx + 6, ty + 6, half - 12, half - 12);

        // Terrazzo mineral aggregate chips (hash PRNG avoids linear repeating diagonal streaks)
        const hashChip = (n: number) => {
          let x = (n ^ 0x9e3779b9) >>> 0;
          x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
          x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
          return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
        };
        const chips = isCream ? creamChips : roseChips;
        for (let k = 0; k < 220; k++) {
          const base = (row * 2 + col) * 4096 + k * 7;
          const cx = tx + 8 + hashChip(base + 1) * (half - 16);
          const cy = ty + 8 + hashChip(base + 2) * (half - 16);
          const sz = 1.9 + hashChip(base + 3) * 3.2;
          const tilt = (hashChip(base + 4) - 0.5) * sz * 0.9;
          ctx.fillStyle = chips[Math.floor(hashChip(base + 5) * chips.length) % chips.length];
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + sz, cy + tilt);
          ctx.lineTo(cx + sz * (0.45 + hashChip(base + 6) * 0.35), cy + sz * 0.92);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // Crisp sandstone grout joints
    ctx.fillStyle = '#c5b4a1';
    ctx.fillRect(0, 0, w, 3);
    ctx.fillRect(0, half - 1.5, w, 3);
    ctx.fillRect(0, 0, 3, h);
    ctx.fillRect(half - 1.5, 0, 3, h);

    ctx.fillStyle = 'rgba(255, 250, 244, 0.34)';
    ctx.fillRect(0, 3, w, 1.5);
    ctx.fillRect(0, half + 1.5, w, 1.5);
  });
}

function createGoldInlayTexture(): THREE.CanvasTexture {
  return makeCanvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#d4ab62';
    ctx.fillRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, '#b38b46');
    grad.addColorStop(0.18, '#e3c47f');
    grad.addColorStop(0.5, '#d8b26a');
    grad.addColorStop(0.82, '#e6c884');
    grad.addColorStop(1.0, '#b38b46');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (let s = 0; s < 36; s++) {
      ctx.fillStyle = s % 2 === 0 ? 'rgba(255, 248, 218, 0.16)' : 'rgba(138, 102, 42, 0.12)';
      ctx.fillRect(0, (s * 7) % h, w, 2);
    }
  });
}

function createGraniteCurbTexture(): THREE.CanvasTexture {
  return makeCanvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#cfc9bd';
    ctx.fillRect(0, 0, w, h);
    const shades = ['#dbd5c9', '#cbc5b8', '#e3ddd2', '#c3bdb0'];
    const cols = 4;
    const rows = 4;
    const cw = w / cols;
    const ch = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw;
        const y = r * ch;
        ctx.fillStyle = shades[(r * 3 + c * 5) % shades.length];
        ctx.fillRect(x + 2, y + 2, cw - 4, ch - 4);
        ctx.fillStyle = 'rgba(255, 253, 248, 0.24)';
        ctx.fillRect(x + 2, y + 2, cw - 4, 4);
      }
    }
    for (let s = 0; s < 750; s++) {
      ctx.fillStyle = s % 2 === 0 ? 'rgba(92, 86, 78, 0.14)' : 'rgba(255, 252, 246, 0.20)';
      ctx.fillRect((s * 97) % w, (s * 173) % h, 2, 2);
    }
  });
}

function createWaveBenchStoneTexture(): THREE.CanvasTexture {
  return makeCanvasTex(512, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, '#f1e7d5');
    grad.addColorStop(0.55, '#e8dcc6');
    grad.addColorStop(1.0, '#ddd0b8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (let s = 0; s < 900; s++) {
      const x = (s * 83) % w;
      const y = (s * 149) % h;
      ctx.fillStyle = s % 3 === 0 ? 'rgba(255, 252, 245, 0.28)' : 'rgba(158, 142, 118, 0.12)';
      ctx.fillRect(x, y, 2.2, 2.2);
    }
  });
}

function createAntiqueBronzeTexture(): THREE.CanvasTexture {
  return makeCanvasTex(256, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0.0, '#5e584d');
    grad.addColorStop(0.32, '#7d735f');
    grad.addColorStop(0.55, '#6a6253');
    grad.addColorStop(0.82, '#867b65');
    grad.addColorStop(1.0, '#5c554a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 64; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(220, 206, 174, 0.10)' : 'rgba(54, 48, 38, 0.14)';
      ctx.fillRect((i * 19) % w, 0, 2, h);
    }
    for (let hIdx = 0; hIdx < 24; hIdx++) {
      ctx.fillStyle = 'rgba(195, 178, 138, 0.08)';
      ctx.fillRect(0, (hIdx * 23) % h, w, 2);
    }
  });
}

function createParkBrickTexture(): THREE.CanvasTexture {
  return makeCanvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#c8beb0';
    ctx.fillRect(0, 0, w, h);
    const brickShades = ['#c66b4f', '#b85d44', '#d47c5d', '#a9513a', '#ce7356', '#bd644a'];
    const u = w / 16;
    const drawBrick = (x: number, y: number, bw: number, bh: number, idx: number) => {
      for (const ox of [-w, 0, w]) {
        for (const oy of [-h, 0, h]) {
          const px = x + ox;
          const py = y + oy;
          if (px + bw < 0 || px > w || py + bh < 0 || py > h) continue;
          ctx.fillStyle = brickShades[(idx + 128) % brickShades.length];
          ctx.fillRect(px + 2, py + 2, bw - 4, bh - 4);
          ctx.fillStyle = 'rgba(255,244,228,0.18)';
          ctx.fillRect(px + 2, py + 2, bw - 4, 3);
          ctx.fillStyle = 'rgba(55,24,14,0.14)';
          ctx.fillRect(px + 2, py + bh - 5, bw - 4, 3);
        }
      }
    };
    for (let d = -16; d < 32; d++) {
      for (let k = -8; k < 24; k++) {
        const bx = (k * 2 + d) * u;
        const by = (d - k * 2) * u;
        drawBrick(bx, by, u * 2, u, d * 7 + k * 3);
        drawBrick(bx + u, by + u, u, u * 2, d * 11 + k * 5 + 1);
      }
    }
  });
}

function createParkCobbleTexture(): THREE.CanvasTexture {
  return makeCanvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#7c838b';
    ctx.fillRect(0, 0, w, h);
    const shades = ['#b4bac3', '#9fa6af', '#c1c6cf', '#9097a1', '#a9afb8'];
    const rows = 10;
    const cols = 10;
    const cw = w / cols;
    const ch = h / rows;
    for (let r = 0; r < rows; r++) {
      const shift = (r % 2) * (cw * 0.5);
      for (let c = -1; c <= cols; c++) {
        const jx = (((r * 17 + c * 31) % 7) - 3) * 1.1;
        const jy = (((r * 23 + c * 13) % 7) - 3) * 1.1;
        const px = c * cw + shift + 3.5 + jx;
        const py = r * ch + 3.5 + jy;
        ctx.fillStyle = shades[(r * 5 + c * 7 + 30) % shades.length];
        ctx.beginPath();
        ctx.roundRect(px, py, cw - 7, ch - 7, 10);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(px + 6, py + 3, cw - 19, 3);
      }
    }
  });
}

function createLimestoneTexture(): THREE.CanvasTexture {
  return makeCanvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#d3cab5';
    ctx.fillRect(0, 0, w, h);
    const shades = ['#e3dccb', '#d4cbb5', '#ebe5d6', '#ccc2ac'];
    const rows = 8;
    const cols = 4;
    const cw = w / cols;
    const ch = h / rows;
    for (let r = 0; r < rows; r++) {
      const shift = (r % 2) * (cw * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * cw + shift;
        const y = r * ch;
        ctx.fillStyle = shades[(r * 3 + c * 5 + 20) % shades.length];
        ctx.fillRect(x + 2, y + 2, cw - 4, ch - 4);
        ctx.fillStyle = 'rgba(255,252,244,0.24)';
        ctx.fillRect(x + 2, y + 2, cw - 4, 3);
      }
    }
    for (let s = 0; s < 550; s++) {
      ctx.fillStyle = s % 2 === 0 ? 'rgba(110,98,80,0.12)' : 'rgba(255,250,240,0.18)';
      ctx.fillRect((s * 97) % w, (s * 173) % h, 2.5, 2.5);
    }
  });
}

function createNaturalFieldstoneTexture(): THREE.CanvasTexture {
  return makeCanvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#625e54';
    ctx.fillRect(0, 0, w, h);
    const stoneTones = ['#aca596', '#948e80', '#beb6a6', '#847e71', '#c7bfb0', '#a19b8c'];
    const rows = 7;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let xCursor = -((r * 47) % 72);
      let c = 0;
      while (xCursor < w) {
        const sw = 62 + ((r * 29 + c * 43) % 54);
        const yJitter = ((r * 13 + c * 19) % 11) - 5;
        const sh = rh - 7 + (((r * 7 + c * 17) % 9) - 4);
        const px = xCursor + 3;
        const py = r * rh + 3.5 + yJitter;
        ctx.fillStyle = stoneTones[(r * 5 + c * 7) % stoneTones.length];
        ctx.beginPath();
        ctx.roundRect(px, py, sw - 6, sh, 12);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,250,238,0.20)';
        ctx.fillRect(px + 8, py + 3, Math.max(8, sw - 22), 3.5);
        ctx.fillStyle = 'rgba(30,26,20,0.18)';
        ctx.fillRect(px + 8, py + sh - 5, Math.max(8, sw - 22), 3);
        xCursor += sw;
        c++;
      }
    }
  });
}

function createTimberGrainTexture(): THREE.CanvasTexture {
  return makeCanvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#c88d56';
    ctx.fillRect(0, 0, w, h);
    const plankTones = ['#d89f68', '#c68a54', '#e1ac74', '#be814b', '#d1955e', '#c98e58'];
    const planks = 6;
    const ph = h / planks;
    for (let p = 0; p < planks; p++) {
      const py = p * ph;
      ctx.fillStyle = plankTones[p % plankTones.length];
      ctx.fillRect(0, py + 1.5, w, ph - 3);
      // Warm top chamfer sun highlight on each plank
      ctx.fillStyle = 'rgba(255, 240, 212, 0.22)';
      ctx.fillRect(0, py + 1.5, w, 4);
      for (let g = 0; g < 18; g++) {
        const gy = py + 5 + (g / 18) * (ph - 10);
        ctx.strokeStyle = g % 3 === 0 ? 'rgba(104, 58, 24, 0.14)' : 'rgba(255, 234, 196, 0.16)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w * 0.33, gy + Math.sin(p * 1.7 + g) * 2.8);
        ctx.lineTo(w * 0.66, gy - Math.cos(p * 1.3 + g) * 2.6);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(78, 44, 20, 0.24)';
      ctx.fillRect(0, py + ph - 2.8, w, 2.8);
    }
  });
}

function createTreeBarkTexture(): THREE.CanvasTexture {
  return makeCanvasTex(256, 256, (ctx, w, h) => {
    // Warm sunlit layered oak bark (cohesive hand-painted honey-umber palette)
    ctx.fillStyle = '#8b684a';
    ctx.fillRect(0, 0, w, h);
    const ridgeTones = ['#a4805d', '#94704f', '#b28d68', '#7d5b3e', '#9c7856'];
    for (let i = 0; i < 38; i++) {
      const bx = (i / 38) * w;
      const bw = 6 + (i % 4) * 2.8;
      const wobble = (((i * 7) % 5) - 2) * 3.5;
      ctx.fillStyle = ridgeTones[i % ridgeTones.length];
      ctx.beginPath();
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx + bw, 0);
      ctx.lineTo(bx + bw + wobble, h * 0.45);
      ctx.lineTo(bx + bw - wobble * 0.6, h * 0.78);
      ctx.lineTo(bx + bw, h);
      ctx.lineTo(bx, h);
      ctx.lineTo(bx - wobble * 0.5, h * 0.62);
      ctx.closePath();
      ctx.fill();

      // Sunlit warm bark plate highlight & soft umber furrow crevice
      ctx.fillStyle = 'rgba(232, 198, 158, 0.16)';
      ctx.fillRect(bx + 1, (i * 29) % h, Math.max(1.5, bw * 0.32), 24 + (i % 3) * 14);
      ctx.fillStyle = 'rgba(66, 44, 28, 0.24)';
      ctx.fillRect(bx + bw - 1.5, 0, 1.8, h);
    }
    // Painterly layered horizontal bark plate cracks
    for (let k = 0; k < 42; k++) {
      const lx = (k * 53) % w;
      const ly = (k * 37) % h;
      const lw = 10 + (k % 4) * 6;
      ctx.fillStyle = k % 2 === 0 ? 'rgba(68, 46, 30, 0.26)' : 'rgba(218, 182, 142, 0.18)';
      ctx.fillRect(lx, ly, lw, 2.2);
    }
  });
}

function createCherryBarkTexture(): THREE.CanvasTexture {
  return makeCanvasTex(256, 256, (ctx, w, h) => {
    // Warm sunlit chestnut-mahogany cherry bark with satin buff lenticels
    ctx.fillStyle = '#825747';
    ctx.fillRect(0, 0, w, h);
    const streaks = ['#956754', '#72493b', '#a3735e', '#7e5344'];
    for (let i = 0; i < 34; i++) {
      const sx = (i / 34) * w;
      const sw = 6 + (i % 3) * 2.5;
      ctx.fillStyle = streaks[i % streaks.length];
      ctx.fillRect(sx, 0, sw, h);
      if (i % 3 === 0) {
        ctx.fillStyle = 'rgba(236, 196, 170, 0.14)';
        ctx.fillRect(sx + 1, 0, 2, h);
      }
    }
    // Signature warm horizontal cherry bark lenticels + soft umber rings
    for (let l = 0; l < 52; l++) {
      const lx = (l * 47) % w;
      const ly = (l * 31) % h;
      const lw = 14 + (l % 4) * 8;
      ctx.fillStyle = l % 2 === 0 ? 'rgba(206, 162, 138, 0.44)' : 'rgba(72, 43, 35, 0.30)';
      ctx.fillRect(lx, ly, lw, 2.4);
    }
  });
}

function createGardenSoilTexture(): THREE.CanvasTexture {
  return makeCanvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#5a4331';
    ctx.fillRect(0, 0, w, h);
    const chips = ['#6b503b', '#4b3626', '#765b44'];
    for (let i = 0; i < 420; i++) {
      ctx.fillStyle = chips[i % chips.length];
      ctx.fillRect((i * 73) % w, (i * 119) % h, 4, 3);
    }
    // Subtle fallen pink sakura petals on planter soil
    for (let p = 0; p < 28; p++) {
      ctx.fillStyle = p % 2 === 0 ? 'rgba(247, 178, 210, 0.65)' : 'rgba(255, 214, 232, 0.65)';
      ctx.beginPath();
      ctx.ellipse((p * 89) % w, (p * 137) % h, 4, 2.5, p * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function createWickerBasketTexture(): THREE.CanvasTexture {
  return makeCanvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#7a4f28';
    ctx.fillRect(0, 0, w, h);
    const cols = 8;
    const rows = 12;
    const cw = w / cols;
    const ch = h / rows;
    for (let r = 0; r < rows; r++) {
      const shift = (r % 2) * (cw * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * cw + shift;
        const y = r * ch;
        ctx.fillStyle = (r + c) % 2 === 0 ? '#b27f4b' : '#9e6c3a';
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, cw - 4, ch - 4, 6);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,228,185,0.22)';
        ctx.fillRect(x + 5, y + 3, cw - 10, 2.5);
      }
    }
  });
}

// ============================================================================
// ARCHITECTURAL GEOMETRY BUILDERS (CURBS, GOLD RIBBONS, WAVE BENCH, WATER)
// ============================================================================

/**
 * Builds a watertight mitered & chamfered stone curb loop following a CCW XZ polygon.
 * Outer perimeter aligns exactly with `polyXZ`; curb extends inward by `curbWidth`.
 */
function createMiteredPerimeterCurbGeometry(
  polyXZ: readonly [number, number][],
  curbWidth: number,
  yBottom: number,
  yTop: number,
  bevel = 0.035,
): THREE.BufferGeometry {
  const n = polyXZ.length;
  const inwardNormals: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = polyXZ[i];
    const b = polyXZ[(i + 1) % n];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz) || 1;
    inwardNormals.push([dz / len, -dx / len]);
  }

  const innerPts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const nPrev = inwardNormals[(i - 1 + n) % n];
    const nNext = inwardNormals[i];
    let mx = nPrev[0] + nNext[0];
    let mz = nPrev[1] + nNext[1];
    const mLen = Math.hypot(mx, mz) || 1;
    mx /= mLen;
    mz /= mLen;
    const denom = Math.max(0.4, mx * nNext[0] + mz * nNext[1]);
    const dist = curbWidth / denom;
    innerPts.push([polyXZ[i][0] + mx * dist, polyXZ[i][1] + mz * dist]);
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const pushQuad = (
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
    u0: number,
    v0: number,
    u1: number,
    v1: number,
  ) => {
    positions.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
    uvs.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
  };

  let arcAccum = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const oA = polyXZ[i];
    const oB = polyXZ[j];
    const iA = innerPts[i];
    const iB = innerPts[j];
    const nIn = inwardNormals[i];
    const segLen = Math.hypot(oB[0] - oA[0], oB[1] - oA[1]);
    const u0 = arcAccum / 1.25;
    const u1 = (arcAccum + segLen) / 1.25;
    arcAccum += segLen;

    const obA: [number, number, number] = [oA[0], yBottom, oA[1]];
    const obB: [number, number, number] = [oB[0], yBottom, oB[1]];
    const otA: [number, number, number] = [oA[0] + nIn[0] * bevel, yTop, oA[1] + nIn[1] * bevel];
    const otB: [number, number, number] = [oB[0] + nIn[0] * bevel, yTop, oB[1] + nIn[1] * bevel];
    const itA: [number, number, number] = [iA[0] - nIn[0] * bevel, yTop, iA[1] - nIn[1] * bevel];
    const itB: [number, number, number] = [iB[0] - nIn[0] * bevel, yTop, iB[1] - nIn[1] * bevel];
    const ibA: [number, number, number] = [iA[0], yBottom, iA[1]];
    const ibB: [number, number, number] = [iB[0], yBottom, iB[1]];

    // Outer face, top face, inner face (CCW outward)
    pushQuad(obA, obB, otB, otA, u0, 0, u1, 0.2);
    pushQuad(otA, otB, itB, itA, u0, 0.25, u1, 0.75);
    pushQuad(itA, itB, ibB, ibA, u0, 0.8, u1, 1.0);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Builds a clean raised brass/gold ribbon strip geometry along a sampled 2D XZ path.
 */
function createGoldRibbonStripGeometry(
  samplesXZ: readonly [number, number][],
  halfWidth: number,
  yBottom: number,
  yTop: number,
  closed = false,
): THREE.BufferGeometry {
  const count = samplesXZ.length;
  if (count < 2) return new THREE.BufferGeometry();

  const leftPts: [number, number][] = [];
  const rightPts: [number, number][] = [];
  const arcLens: number[] = [];
  let accum = 0;

  for (let i = 0; i < count; i++) {
    const prev = closed ? samplesXZ[(i - 1 + count) % count] : samplesXZ[Math.max(0, i - 1)];
    const next = closed ? samplesXZ[(i + 1) % count] : samplesXZ[Math.min(count - 1, i + 1)];
    if (i > 0) {
      accum += Math.hypot(samplesXZ[i][0] - samplesXZ[i - 1][0], samplesXZ[i][1] - samplesXZ[i - 1][1]);
    }
    arcLens.push(accum);
    const tx = next[0] - prev[0];
    const tz = next[1] - prev[1];
    const tLen = Math.hypot(tx, tz) || 1;
    // Left normal in XZ when walking along +tangent: (+tz, -tx)
    const nx = tz / tLen;
    const nz = -tx / tLen;
    leftPts.push([samplesXZ[i][0] + nx * halfWidth, samplesXZ[i][1] + nz * halfWidth]);
    rightPts.push([samplesXZ[i][0] - nx * halfWidth, samplesXZ[i][1] - nz * halfWidth]);
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const pushQuad = (
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
    u0: number,
    v0: number,
    u1: number,
    v1: number,
  ) => {
    positions.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
    uvs.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
  };

  const segCount = closed ? count : count - 1;
  for (let i = 0; i < segCount; i++) {
    const j = (i + 1) % count;
    const u0 = arcLens[i] / 0.8;
    const u1 = (i === count - 1 && closed ? accum + Math.hypot(samplesXZ[0][0] - samplesXZ[i][0], samplesXZ[0][1] - samplesXZ[i][1]) : arcLens[j]) / 0.8;

    const lA: [number, number, number] = [leftPts[i][0], yTop, leftPts[i][1]];
    const lB: [number, number, number] = [leftPts[j][0], yTop, leftPts[j][1]];
    const rA: [number, number, number] = [rightPts[i][0], yTop, rightPts[i][1]];
    const rB: [number, number, number] = [rightPts[j][0], yTop, rightPts[j][1]];

    const lbA: [number, number, number] = [leftPts[i][0], yBottom, leftPts[i][1]];
    const lbB: [number, number, number] = [leftPts[j][0], yBottom, leftPts[j][1]];
    const rbA: [number, number, number] = [rightPts[i][0], yBottom, rightPts[i][1]];
    const rbB: [number, number, number] = [rightPts[j][0], yBottom, rightPts[j][1]];

    // Top face (+Y normal)
    pushQuad(rA, rB, lB, lA, u0, 0, u1, 1);
    // Left skirt (-normal outward)
    pushQuad(lA, lB, lbB, lbA, u0, 0, u1, 0.2);
    // Right skirt (+normal outward)
    pushQuad(rbA, rbB, rB, rA, u0, 0.8, u1, 1);
  }

  if (!closed) {
    pushQuad(
      [leftPts[0][0], yBottom, leftPts[0][1]],
      [leftPts[0][0], yTop, leftPts[0][1]],
      [rightPts[0][0], yTop, rightPts[0][1]],
      [rightPts[0][0], yBottom, rightPts[0][1]],
      0,
      0,
      0.1,
      1,
    );
    const last = count - 1;
    pushQuad(
      [rightPts[last][0], yBottom, rightPts[last][1]],
      [rightPts[last][0], yTop, rightPts[last][1]],
      [leftPts[last][0], yTop, leftPts[last][1]],
      [leftPts[last][0], yBottom, leftPts[last][1]],
      0,
      0,
      0.1,
      1,
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function sampleGoldCurveRibbon(
  controlPtsXZ: readonly [number, number][],
  halfWidth: number,
  yBottom: number,
  yTop: number,
  divisions = 36,
): THREE.BufferGeometry {
  const curve = new THREE.SplineCurve(controlPtsXZ.map(([x, z]) => new THREE.Vector2(x, z)));
  const pts = curve.getPoints(divisions).map((v): [number, number] => [v.x, v.y]);
  return createGoldRibbonStripGeometry(pts, halfWidth, yBottom, yTop, false);
}

function createGoldRingRibbonGeometry(
  cx: number,
  cz: number,
  innerR: number,
  outerR: number,
  yBottom: number,
  yTop: number,
  segments = 64,
): THREE.BufferGeometry {
  const midR = (innerR + outerR) * 0.5;
  const halfW = (outerR - innerR) * 0.5;
  const pts: [number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * midR, cz + Math.sin(a) * midR]);
  }
  return createGoldRibbonStripGeometry(pts, halfW, yBottom, yTop, true);
}

/**
 * Sculpted Cast-Stone Solid Wave Bench matching `media_1795017982455_f313bc74.jpg` 4-view sheet:
 * - Crescent C-plan (ends sweep forward `+Z`)
 * - Asymmetric sculpted S-wave backrest rising smoothly from left to right
 * - Underside architectural arch reveal flanked by solid grounded end pedestals
 * - Seat surface top at `y = 0.78m` matching `CENTRAL_PARK_SEAT_SPOTS` for 3.85m avatars
 */
function createWaveStoneBenchGeometry(): THREE.BufferGeometry {
  const nU = 36;
  const nV = 28;
  const halfWidth = 1.38;
  const rings: [number, number, number][][] = [];

  for (let iu = 0; iu <= nU; iu++) {
    const u = (iu / nU) * 2 - 1; // -1 (left) .. +1 (right)
    const x = u * halfWidth;
    const absU = Math.abs(u);

    // Subtle crescent plan curve: ends wrap slightly forward (+Z)
    const zCrescent = (u * u - 0.35) * 0.24;
    // Asymmetric sweeping wave crest matching front elevation in `f313bc74.jpg`
    const endDrop = Math.pow(Math.max(0, (absU - 0.74) / 0.26), 1.55) * 0.28;
    const waveBackY = 1.15 + 0.23 * Math.sin(u * 1.7 + 0.35) - endDrop;
    // Recessed underside shadow arch between left & right leg pedestals
    const archSpan = absU < 0.72 ? Math.cos((u / 0.72) * (Math.PI * 0.5)) : 0.0;
    const underY = 0.02 + Math.pow(archSpan, 1.1) * 0.26;
    // Smooth rounded end taper over extreme tips so end-caps blend organically
    const tipInset = absU > 0.86 ? Math.pow((absU - 0.86) / 0.14, 1.8) : 0.0;
    const seatTopY = 0.78 - tipInset * 0.10;
    const profScaleYZ = 1.0 - tipInset * 0.16;

    // Closed cross-section profile in (localY, localZ), ordered CCW around +X
    const rawProf: [number, number][] = [
      [underY, 0.34 * profScaleYZ],
      [underY, 0.42 * profScaleYZ],
      [0.36, 0.47 * profScaleYZ],
      [0.64, 0.48 * profScaleYZ],
      [seatTopY - 0.04, 0.46 * profScaleYZ],
      [seatTopY, 0.38 * profScaleYZ],
      [seatTopY - 0.015, 0.20 * profScaleYZ],
      [seatTopY - 0.02, 0.02],
      [seatTopY + 0.02, -0.14 * profScaleYZ],
      [seatTopY + 0.12, -0.22 * profScaleYZ],
      [(seatTopY + waveBackY) * 0.52, -0.27 * profScaleYZ],
      [waveBackY - 0.08, -0.29 * profScaleYZ],
      [waveBackY, -0.34 * profScaleYZ],
      [waveBackY - 0.02, -0.43 * profScaleYZ],
      [waveBackY - 0.14, -0.47 * profScaleYZ],
      [0.82, -0.46 * profScaleYZ],
      [0.44, -0.42 * profScaleYZ],
      [0.14, -0.38 * profScaleYZ],
      [underY, -0.34 * profScaleYZ],
      [underY, -0.12 * profScaleYZ],
      [underY + (archSpan > 0.05 ? 0.04 : 0.0), 0.12 * profScaleYZ],
    ];

    // Resample profile uniformly into nV points
    const ring: [number, number, number][] = [];
    for (let iv = 0; iv < nV; iv++) {
      const t = (iv / nV) * rawProf.length;
      const i0 = Math.floor(t) % rawProf.length;
      const i1 = (i0 + 1) % rawProf.length;
      const f = t - Math.floor(t);
      const py = rawProf[i0][0] * (1 - f) + rawProf[i1][0] * f;
      const pz = rawProf[i0][1] * (1 - f) + rawProf[i1][1] * f + zCrescent;
      ring.push([x, py, pz]);
    }
    rings.push(ring);
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  for (let iu = 0; iu < nU; iu++) {
    const r0 = rings[iu];
    const r1 = rings[iu + 1];
    const u0 = (iu / nU) * 2.2;
    const u1 = ((iu + 1) / nU) * 2.2;
    for (let iv = 0; iv < nV; iv++) {
      const jv = (iv + 1) % nV;
      const v0 = iv / nV;
      const v1 = (iv + 1) / nV;
      const p00 = r0[iv];
      const p10 = r1[iv];
      const p01 = r0[jv];
      const p11 = r1[jv];
      positions.push(...p00, ...p10, ...p11, ...p00, ...p11, ...p01);
      uvs.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
    }
  }

  // Watertight sculpted end caps at left (-X) and right (+X)
  const capRing = (ring: [number, number, number][], xOffset: number, flip: boolean) => {
    let cy = 0;
    let cz = 0;
    for (const p of ring) {
      cy += p[1];
      cz += p[2];
    }
    cy /= ring.length;
    cz /= ring.length;
    const center: [number, number, number] = [ring[0][0] + xOffset, cy, cz];
    for (let iv = 0; iv < nV; iv++) {
      const a = ring[iv];
      const b = ring[(iv + 1) % nV];
      if (flip) {
        positions.push(...center, ...b, ...a);
        uvs.push(0.5, 0.5, 1, iv / nV, 0, iv / nV);
      } else {
        positions.push(...center, ...a, ...b);
        uvs.push(0.5, 0.5, 0, iv / nV, 1, iv / nV);
      }
    }
  };
  capRing(rings[0], -0.06, true);
  capRing(rings[nU], 0.06, false);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function createParabolicWaterArcGeometry(
  rStart: number,
  yStart: number,
  rEnd: number,
  yEnd: number,
  apexBoost: number,
  angleRad: number,
  tubeRadius: number,
  segments = 14,
): THREE.BufferGeometry {
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const r = rStart + (rEnd - rStart) * t;
    const linearY = yStart + (yEnd - yStart) * t;
    const arcY = linearY + Math.sin(t * Math.PI) * apexBoost;
    pts.push(new THREE.Vector3(cosA * r, arcY, sinA * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, segments, tubeRadius, 6, false);
}

// ============================================================================
// MAIN BUILDER: buildCentralBotanicalPark3D (Enlarged Central Urban Plaza)
// ============================================================================

export function buildCentralBotanicalPark3D(
  options: BuildCentralBotanicalParkOptions,
): CentralBotanicalParkHandle {
  const {
    windUniforms,
    isSoftwareGl,
    leafMaskTexture,
    waterCascadeTex,
    waterRippleTex,
    upgradeMeshToBlitzWorldMaterial,
    createBlitzStrokeMesh,
    bakeStaticGroupMeshes,
  } = options;

  const root = new THREE.Group();
  root.name = 'CentralBotanicalPark3D';

  const staticGroup = new THREE.Group();
  staticGroup.name = 'CentralParkStaticBaked';
  root.add(staticGroup);

  const animatedGroup = new THREE.Group();
  animatedGroup.name = 'CentralParkAnimated';
  root.add(animatedGroup);

  const foliageGroup = new THREE.Group();
  foliageGroup.name = 'CentralParkBotanicalInstanced';
  root.add(foliageGroup);

  const disposableGeos = new Set<THREE.BufferGeometry>();
  const disposableMats = new Set<THREE.Material>();
  const disposableTextures = new Set<THREE.Texture>();

  const registerGeo = (geo: THREE.BufferGeometry) => {
    disposableGeos.add(geo);
    return geo;
  };
  const registerMat = (mat: THREE.Material) => {
    disposableMats.add(mat);
    return mat;
  };
  const registerTex = (tex: THREE.Texture) => {
    disposableTextures.add(tex);
    return tex;
  };

  // Procedural textures
  const terrazzoCheckerTex = registerTex(createTerrazzoCheckerboardTexture());
  const goldInlayTex = registerTex(createGoldInlayTexture());
  const graniteCurbTex = registerTex(createGraniteCurbTexture());
  const waveStoneTex = registerTex(createWaveBenchStoneTexture());
  const antiqueBronzeTex = registerTex(createAntiqueBronzeTexture());
  const brickTex = registerTex(createParkBrickTexture());
  const cobbleTex = registerTex(createParkCobbleTexture());
  const stoneTex = registerTex(createLimestoneTexture());
  const fieldstoneTex = registerTex(createNaturalFieldstoneTexture());
  const timberTex = registerTex(createTimberGrainTexture());
  const barkTex = registerTex(createTreeBarkTexture());
  const cherryBarkTex = registerTex(createCherryBarkTexture());
  const gardenSoilTex = registerTex(createGardenSoilTexture());
  const wickerTex = registerTex(createWickerBasketTexture());

  const pondWaterTex = registerTex(waterRippleTex.clone());
  pondWaterTex.repeat.set(2.4, 2.4);
  pondWaterTex.needsUpdate = true;

  void createBlitzStrokeMesh;

  const addPart = (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    colorHex: string,
    pos: [number, number, number] = [0, 0, 0],
    rot: [number, number, number] = [0, 0, 0],
    opts?: {
      map?: THREE.Texture;
      strokeWidth?: number;
      castShadow?: boolean;
      receiveShadow?: boolean;
      bounce?: number;
      scale?: [number, number, number];
    },
  ): THREE.Mesh => {
    registerGeo(geo);
    const hasVertexColor = Boolean(geo.getAttribute('color'));
    const mat = new THREE.MeshStandardMaterial({
      color: opts?.map ? '#ffffff' : colorHex,
      map: opts?.map ?? null,
      vertexColors: hasVertexColor,
      roughness: 0.76,
      metalness: 0.05,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(pos[0], pos[1], pos[2]);
    m.rotation.set(rot[0], rot[1], rot[2]);
    if (opts?.scale) m.scale.set(opts.scale[0], opts.scale[1], opts.scale[2]);
    m.castShadow = !isSoftwareGl && Boolean(opts?.castShadow);
    m.receiveShadow = !isSoftwareGl && (opts?.receiveShadow ?? true);
    m.frustumCulled = true;
    upgradeMeshToBlitzWorldMaterial(m, windUniforms, opts?.map ? '#ffffff' : colorHex, opts?.bounce ?? 0.22);
    mat.dispose();
    parent.add(m);
    return m;
  };

  const applyPlanarUvs = (geo: THREE.BufferGeometry, tileM = 2.0): THREE.BufferGeometry => {
    const pos = geo.getAttribute('position');
    const norm = geo.getAttribute('normal');
    const uv = geo.getAttribute('uv');
    if (!pos || !uv) return geo;
    for (let i = 0; i < pos.count; i++) {
      const ny = norm ? Math.abs(norm.getY(i)) : 1;
      if (ny > 0.6) {
        uv.setXY(i, pos.getX(i) / tileM, pos.getZ(i) / tileM);
      } else {
        uv.setXY(i, (pos.getX(i) + pos.getZ(i)) / tileM, pos.getY(i) / tileM);
      }
    }
    uv.needsUpdate = true;
    return geo;
  };

  const applyNormalizedDiscUvs = (geo: THREE.BufferGeometry, radius: number): THREE.BufferGeometry => {
    const pos = geo.getAttribute('position');
    const uv = geo.getAttribute('uv');
    if (!pos || !uv) return geo;
    const invDiam = 0.5 / Math.max(0.01, radius);
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) * invDiam + 0.5, pos.getZ(i) * invDiam + 0.5);
    }
    uv.needsUpdate = true;
    return geo;
  };

  const scaleGeometryUvs = (geo: THREE.BufferGeometry, uScale: number, vScale: number): THREE.BufferGeometry => {
    const uv = geo.getAttribute('uv');
    if (!uv) return geo;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * uScale, uv.getY(i) * vScale);
    }
    uv.needsUpdate = true;
    return geo;
  };

  const mp = CENTRAL_PARK_MASTERPLAN;

  // =========================================================================
  // 1. TERRAZZO CHECKERBOARD PROMENADE + SWEEPING GOLD RIBBON INLAYS + GRANITE CURBS
  // =========================================================================
  // Inset terrazzo slab 0.14m inside the 0.36m granite perimeter curb so outer curb & slab side skirts never coplanar-overlap
  const insetPlazaVerts: [number, number][] = (() => {
    const poly = CENTRAL_PARK_PERIMETER_VERTICES;
    const n = poly.length;
    const norms: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % n];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      norms.push([(b[1] - a[1]) / len, -(b[0] - a[0]) / len]);
    }
    const out: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const nPrev = norms[(i - 1 + n) % n];
      const nNext = norms[i];
      let mx = nPrev[0] + nNext[0];
      let mz = nPrev[1] + nNext[1];
      const mLen = Math.hypot(mx, mz) || 1;
      mx /= mLen;
      mz /= mLen;
      const dist = 0.14 / Math.max(0.4, mx * nNext[0] + mz * nNext[1]);
      out.push([poly[i][0] + mx * dist, poly[i][1] + mz * dist]);
    }
    return out;
  })();
  const terrazzoSlabGeo = createHorizontalPolygonSlabGeometry(insetPlazaVerts, -0.04, 0.042, 2.1);
  addPart(staticGroup, terrazzoSlabGeo, '#ffffff', [0, 0, 0], [0, 0, 0], {
    map: terrazzoCheckerTex,
    castShadow: false,
    receiveShadow: true,
    bounce: 0.14,
  });

  // Walkable Beveled Granite/Limestone Perimeter Curbs around all 12 polygon vertices (ZERO barrier fences!)
  const perimeterCurbGeo = createMiteredPerimeterCurbGeometry(CENTRAL_PARK_PERIMETER_VERTICES, 0.36, -0.06, 0.088, 0.035);
  addPart(staticGroup, perimeterCurbGeo, '#ffffff', [0, 0, 0], [0, 0, 0], {
    map: graniteCurbTex,
    castShadow: false,
    receiveShadow: true,
    bounce: 0.16,
  });

  // Sweeping Warm-Gold Ribbon Inlays (#d4ab62) — Staggered Y layers prevent coplanar Z-fighting at ribbon intersections
  const ftn = mp.fountainPlaza;
  const goldRibbonMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: goldInlayTex,
      roughness: 0.32,
      metalness: 0.26,
      emissive: '#4a3816',
      emissiveIntensity: 0.24,
    }),
  );
  const addGoldInlay = (geo: THREE.BufferGeometry) => {
    registerGeo(geo);
    const m = new THREE.Mesh(geo, goldRibbonMat);
    m.castShadow = false;
    m.receiveShadow = !isSoftwareGl;
    m.frustumCulled = true;
    staticGroup.add(m);
  };

  // Concentric fountain brass rings (`yTop = 0.049m`)
  addGoldInlay(createGoldRingRibbonGeometry(ftn.x, ftn.z, 5.25, 5.45, 0.036, 0.049, 64));
  addGoldInlay(createGoldRingRibbonGeometry(ftn.x, ftn.z, 8.25, 8.45, 0.036, 0.049, 72));

  // Diagonal & cardinal radial connectors between Fountain steps and outer ring (`yTop = 0.052m`)
  for (let k = 0; k < 4; k++) {
    const angDiag = (k * Math.PI) / 2 + Math.PI / 4;
    addGoldInlay(
      createGoldRibbonStripGeometry(
        [
          [ftn.x + Math.cos(angDiag) * 5.32, ftn.z + Math.sin(angDiag) * 5.32],
          [ftn.x + Math.cos(angDiag) * 8.38, ftn.z + Math.sin(angDiag) * 8.38],
        ],
        0.085,
        0.036,
        0.052,
      ),
    );
    const angCard = (k * Math.PI) / 2;
    addGoldInlay(
      createGoldRibbonStripGeometry(
        [
          [ftn.x + Math.cos(angCard) * 4.82, ftn.z + Math.sin(angCard) * 4.82],
          [ftn.x + Math.cos(angCard) * 5.38, ftn.z + Math.sin(angCard) * 5.38],
        ],
        0.095,
        0.036,
        0.052,
      ),
    );
  }

  // Sweeping outer promenade arcs weaving around the North Pergola, South Lawn Bed & East/West wings (`yTop = 0.055m`)
  addGoldInlay(
    sampleGoldCurveRibbon(
      [
        [-9.0, -3.2],
        [-2.4, -5.8],
        [4.8, -8.5],
        [12.5, -11.0],
        [18.8, -16.2],
        [24.2, -19.8],
        [34.8, -19.8],
        [40.8, -16.2],
        [46.8, -9.8],
        [53.4, -6.2],
        [57.0, -3.2],
      ],
      0.09,
      0.036,
      0.055,
      56,
    ),
  );
  addGoldInlay(
    sampleGoldCurveRibbon(
      [
        [-9.0, 3.2],
        [-2.4, 5.8],
        [4.8, 8.5],
        [12.5, 11.0],
        [18.8, 16.2],
        [24.2, 19.8],
        [34.8, 19.8],
        [40.8, 16.2],
        [46.8, 9.8],
        [53.4, 6.2],
        [57.0, 3.2],
      ],
      0.09,
      0.036,
      0.055,
      56,
    ),
  );

  // Intersecting graceful promenade cross-arcs (distinct `yTop`: 0.059/0.062/0.065/0.068/0.071m -> zero Z-fighting!)
  addGoldInlay(
    sampleGoldCurveRibbon(
      [
        [-8.6, -7.8],
        [-1.8, -1.6],
        [3.6, 5.2],
        [7.6, 9.6],
      ],
      0.08,
      0.036,
      0.059,
      28,
    ),
  );
  addGoldInlay(
    sampleGoldCurveRibbon(
      [
        [-8.6, 7.8],
        [-1.8, 1.6],
        [3.6, -5.2],
        [7.6, -9.6],
      ],
      0.08,
      0.036,
      0.062,
      28,
    ),
  );
  addGoldInlay(
    sampleGoldCurveRibbon(
      [
        [18.5, -18.8],
        [19.2, -9.2],
        [21.1, 0.0],
        [19.2, 9.2],
        [18.5, 18.8],
      ],
      0.085,
      0.036,
      0.065,
      36,
    ),
  );
  addGoldInlay(
    sampleGoldCurveRibbon(
      [
        [40.5, -18.8],
        [39.6, -9.2],
        [37.9, 0.0],
        [39.6, 9.2],
        [40.5, 18.8],
      ],
      0.085,
      0.036,
      0.065,
      36,
    ),
  );
  addGoldInlay(
    sampleGoldCurveRibbon(
      [
        [49.8, -9.0],
        [53.2, -3.4],
        [56.8, 1.6],
      ],
      0.08,
      0.036,
      0.068,
      20,
    ),
  );
  addGoldInlay(
    sampleGoldCurveRibbon(
      [
        [49.8, 9.0],
        [53.2, 3.4],
        [56.8, -1.6],
      ],
      0.08,
      0.036,
      0.071,
      20,
    ),
  );

  // =========================================================================
  // 2. CIVIC CASCADE FOUNTAIN (`media_1795017977180_39693dad.jpg`) at (29.5, 0.0)
  // =========================================================================
  const ftnGrp = new THREE.Group();
  ftnGrp.position.set(ftn.x, 0, ftn.z);
  staticGroup.add(ftnGrp);

  // 3 Circular Granite Step Risers (`r = 4.85m, 4.46m, 4.08m`, matching `evaluateCentralParkElevation` +0.32m!)
  for (const [rStep, yBot, yTop] of [
    [ftn.apronRadius, 0.03, 0.13],
    [4.46, 0.12, 0.22],
    [4.08, 0.21, 0.32],
  ] as const) {
    const h = yTop - yBot;
    addPart(
      ftnGrp,
      applyPlanarUvs(new THREE.CylinderGeometry(rStep, rStep + 0.04, h, 48), 2.4),
      '#ffffff',
      [0, yBot + h * 0.5, 0],
      [0, 0, 0],
      { map: graniteCurbTex, receiveShadow: true },
    );
  }

  // Carved Ashlar Stone Coping Wall + Recirculation Drain Floor (`outerR = 3.68m <= copingRadius = 3.7m`)
  const copingPts = [
    new THREE.Vector2(0.0, 0.38),
    new THREE.Vector2(3.10, 0.38),
    new THREE.Vector2(3.10, 0.78),
    new THREE.Vector2(3.04, 0.86),
    new THREE.Vector2(3.14, 0.94),
    new THREE.Vector2(3.66, 0.94),
    new THREE.Vector2(3.68, 0.84),
    new THREE.Vector2(3.56, 0.74),
    new THREE.Vector2(3.58, 0.44),
    new THREE.Vector2(3.68, 0.38),
    new THREE.Vector2(3.68, 0.30),
    new THREE.Vector2(3.05, 0.30),
  ];
  addPart(ftnGrp, scaleGeometryUvs(new THREE.LatheGeometry(copingPts, 48), 5.0, 1.0), '#ffffff', [0, 0, 0], [0, 0, 0], {
    map: stoneTex,
    castShadow: true,
    receiveShadow: true,
  });

  // Submerged basin floor & dark recirculation drain ring (`39693dad.jpg` Top Plan View)
  addPart(ftnGrp, new THREE.CylinderGeometry(3.09, 3.09, 0.04, 40), '#5d8594', [0, 0.40, 0]);
  addPart(ftnGrp, new THREE.TorusGeometry(1.18, 0.045, 6, 36), '#3e535c', [0, 0.43, 0], [Math.PI / 2, 0, 0]);

  // Carved Fluted Lower Pedestal + 8 Vertical Scroll Ribs (`y = 0.40..2.12m`)
  const lowerPedPts = [
    new THREE.Vector2(0.0, 0.40),
    new THREE.Vector2(1.06, 0.40),
    new THREE.Vector2(0.98, 0.56),
    new THREE.Vector2(0.76, 0.66),
    new THREE.Vector2(0.70, 0.92),
    new THREE.Vector2(0.52, 1.24),
    new THREE.Vector2(0.42, 1.56),
    new THREE.Vector2(0.58, 1.92),
    new THREE.Vector2(0.84, 2.08),
    new THREE.Vector2(0.0, 2.08),
  ];
  addPart(ftnGrp, scaleGeometryUvs(new THREE.LatheGeometry(lowerPedPts, 32), 3.0, 1.6), '#ffffff', [0, 0, 0], [0, 0, 0], {
    map: stoneTex,
    castShadow: true,
  });

  const fluteFinShape = new THREE.Shape();
  fluteFinShape.moveTo(0.0, 0.0);
  fluteFinShape.quadraticCurveTo(0.24, 0.20, 0.16, 0.56);
  fluteFinShape.quadraticCurveTo(0.10, 0.88, 0.24, 1.12);
  fluteFinShape.lineTo(0.0, 1.16);
  fluteFinShape.closePath();
  const fluteFinGeo = registerGeo(
    new THREE.ExtrudeGeometry(fluteFinShape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.016,
      bevelSegments: 2,
      curveSegments: 8,
    }),
  );
  fluteFinGeo.translate(0, 0, -0.04);
  fluteFinGeo.computeVertexNormals();
  applyPlanarUvs(fluteFinGeo, 1.2);
  for (let fl = 0; fl < 8; fl++) {
    const ang = (fl / 8) * Math.PI * 2;
    addPart(ftnGrp, fluteFinGeo.clone(), '#d6ceb9', [Math.cos(ang) * 0.40, 0.86, Math.sin(ang) * 0.40], [0, -ang, 0], {
      castShadow: true,
    });
  }

  // Vertex-Modulated Scalloped Bowl Factory
  const createScallopedBowlGeometry = (outerR: number, bowlH: number, scallops: number): THREE.BufferGeometry => {
    const bowlPts = [
      new THREE.Vector2(0.24, 0),
      new THREE.Vector2(outerR * 0.36, bowlH * 0.18),
      new THREE.Vector2(outerR * 0.70, bowlH * 0.42),
      new THREE.Vector2(outerR * 0.95, bowlH * 0.76),
      new THREE.Vector2(outerR, bowlH * 0.94),
      new THREE.Vector2(outerR * 0.96, bowlH * 1.04),
      new THREE.Vector2(outerR * 0.85, bowlH * 0.98),
      new THREE.Vector2(outerR * 0.76, bowlH * 0.68),
      new THREE.Vector2(0.24, bowlH * 0.36),
    ];
    const radialSegs = scallops * 4;
    const g = new THREE.LatheGeometry(bowlPts, radialSegs);
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const r = Math.hypot(vx, vz);
      if (r > outerR * 0.45) {
        const theta = Math.atan2(vz, vx);
        const lobe = Math.abs(Math.cos(theta * scallops * 0.5));
        const weight = Math.max(0, (r - outerR * 0.45) / (outerR * 0.55));
        const radialPush = 1.0 + lobe * 0.085 * weight;
        const rimWave = vy > bowlH * 0.8 ? lobe * (bowlH * 0.09) : -lobe * 0.018 * weight;
        pos.setXYZ(i, vx * radialPush, vy + rimWave, vz * radialPush);
      }
    }
    g.computeVertexNormals();
    scaleGeometryUvs(g, 3.0, 1.0);
    return g;
  };

  // Wide Scalloped Lower Bowl (`outerR = 2.04m`, `y = 2.02..2.58m`) + 8 Rim Spouts
  addPart(ftnGrp, createScallopedBowlGeometry(2.04, 0.54, 16), '#ffffff', [0, 2.02, 0], [0, 0, 0], {
    map: stoneTex,
    castShadow: true,
  });
  for (let sp = 0; sp < 8; sp++) {
    const a = (sp / 8) * Math.PI * 2;
    addPart(
      ftnGrp,
      new THREE.BoxGeometry(0.16, 0.09, 0.22),
      '#e2dac8',
      [Math.cos(a) * 2.02, 2.52, Math.sin(a) * 2.02],
      [0, -a + Math.PI / 2, 0],
    );
  }

  // Slim Fluted Upper Stem (`y = 2.48..3.48m`)
  const upperStemPts = [
    new THREE.Vector2(0.0, 2.48),
    new THREE.Vector2(0.46, 2.48),
    new THREE.Vector2(0.32, 2.66),
    new THREE.Vector2(0.24, 3.02),
    new THREE.Vector2(0.28, 3.28),
    new THREE.Vector2(0.44, 3.46),
    new THREE.Vector2(0.0, 3.46),
  ];
  addPart(ftnGrp, scaleGeometryUvs(new THREE.LatheGeometry(upperStemPts, 24), 2.5, 1.2), '#ffffff', [0, 0, 0], [0, 0, 0], {
    map: stoneTex,
    castShadow: true,
  });
  for (let fl = 0; fl < 8; fl++) {
    const ang = (fl / 8) * Math.PI * 2;
    addPart(ftnGrp, new THREE.CylinderGeometry(0.025, 0.032, 0.72, 6), '#d4cbb5', [Math.cos(ang) * 0.25, 2.98, Math.sin(ang) * 0.25]);
  }

  // Upper Crown Basin (`outerR = 1.18m`, `y = 3.40..3.86m`) + 8 Overflow Spouts + Top Finial Nozzle
  addPart(ftnGrp, createScallopedBowlGeometry(1.18, 0.44, 12), '#ffffff', [0, 3.40, 0], [0, 0, 0], {
    map: stoneTex,
    castShadow: true,
  });
  for (let sp = 0; sp < 8; sp++) {
    const a = (sp / 8) * Math.PI * 2;
    addPart(
      ftnGrp,
      new THREE.BoxGeometry(0.12, 0.07, 0.16),
      '#e2dac8',
      [Math.cos(a) * 1.16, 3.80, Math.sin(a) * 1.16],
      [0, -a + Math.PI / 2, 0],
    );
  }
  const crownNozzlePts = [
    new THREE.Vector2(0.0, 3.74),
    new THREE.Vector2(0.28, 3.74),
    new THREE.Vector2(0.18, 3.94),
    new THREE.Vector2(0.24, 4.06),
    new THREE.Vector2(0.13, 4.22),
    new THREE.Vector2(0.0, 4.28),
  ];
  addPart(ftnGrp, scaleGeometryUvs(new THREE.LatheGeometry(crownNozzlePts, 16), 2.0, 1.0), '#ffffff', [0, 0, 0], [0, 0, 0], {
    map: stoneTex,
    castShadow: true,
  });
  addPart(ftnGrp, new THREE.CylinderGeometry(0.045, 0.068, 0.14, 10), '#d4ab62', [0, 4.31, 0]);

  // Animated Fountain Water Pools, 8+8 Parabolic Streams, Central Frothy Jet Plume & Ripple Rings
  const fountainBasinTex = registerTex(waterRippleTex.clone());
  fountainBasinTex.repeat.set(2.8, 2.8);
  fountainBasinTex.needsUpdate = true;

  const fountainCascadeTex = registerTex(waterCascadeTex.clone());
  fountainCascadeTex.repeat.set(1.0, 2.4);
  fountainCascadeTex.needsUpdate = true;

  const cascadeStreamMat = registerMat(
    new THREE.MeshBasicMaterial({
      color: '#e2f8ff',
      map: fountainCascadeTex,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  const frothRingMat = registerMat(
    new THREE.MeshBasicMaterial({
      color: '#f0fbff',
      map: fountainBasinTex,
      transparent: true,
      opacity: 0.56,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );

  // NW Oasis Lake-Matched Translucent Optical-Depth Pools in Main Basin, Lower Bowl & Upper Bowl
  const fountainPools: readonly { r: number; y: number; depth: number; segs: number }[] = [
    { r: 3.10, y: 0.78, depth: 1.25, segs: isSoftwareGl ? 18 : 28 },
    { r: 1.82, y: 2.48, depth: 1.05, segs: isSoftwareGl ? 14 : 20 },
    { r: 1.00, y: 3.76, depth: 0.90, segs: isSoftwareGl ? 10 : 14 },
  ];
  for (const fp of fountainPools) {
    const poolSpan = (fp.r + 0.02) * 2;
    const poolGeo = registerGeo(new THREE.PlaneGeometry(poolSpan, poolSpan, fp.segs, fp.segs));
    poolGeo.rotateX(-Math.PI / 2);
    const poolMat = registerMat(
      createUnifiedWaterSurfaceMaterial({
        kind: 'pool',
        windUniforms,
        isSoftwareGl,
        poolCenterXZ: [ftn.x, ftn.z],
        poolRadiusM: fp.r,
        poolDepthM: fp.depth,
        poolHasSplash: true,
      }),
    );
    const poolMesh = new THREE.Mesh(poolGeo, poolMat);
    poolMesh.name = `CentralParkFountainWater_${fp.r.toFixed(2)}`;
    poolMesh.position.set(ftn.x, fp.y, ftn.z);
    poolMesh.renderOrder = 2;
    poolMesh.userData.isAnimatedWater = true;
    animatedGroup.add(poolMesh);
  }

  // 8 Upper + 8 Lower Parabolic Falling Water Streams + 4 Upper Central Arc Plumes + Vertical Frothy Plume
  const streamGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    streamGeos.push(createParabolicWaterArcGeometry(1.18, 3.80, 1.62, 2.48, 0.14, a, 0.068, 12));
    streamGeos.push(createParabolicWaterArcGeometry(2.04, 2.52, 2.58, 0.78, 0.16, a, 0.088, 14));
  }
  for (let j = 0; j < 4; j++) {
    const a = (j / 4) * Math.PI * 2 + Math.PI / 4;
    streamGeos.push(createParabolicWaterArcGeometry(0.08, 4.36, 0.68, 3.76, 0.88, a, 0.052, 14));
  }
  const mergedStreamsGeo = registerGeo(mergeGeometries(streamGeos, false));
  streamGeos.forEach((g) => g.dispose());
  const fountainStreamsMesh = new THREE.Mesh(mergedStreamsGeo, cascadeStreamMat);
  fountainStreamsMesh.position.set(ftn.x, 0, ftn.z);
  fountainStreamsMesh.userData.isAnimatedWater = true;
  animatedGroup.add(fountainStreamsMesh);

  // Central Vertical Frothy Water Jet Plume (`y = 4.30..5.85m`, feathered spindle taper matching `39693dad.jpg`)
  const plumeOuterGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.055, 0.0),
      new THREE.Vector2(0.145, 0.36),
      new THREE.Vector2(0.17, 0.72),
      new THREE.Vector2(0.115, 1.12),
      new THREE.Vector2(0.05, 1.42),
      new THREE.Vector2(0.014, 1.56),
    ],
    14,
  );
  const plumeInnerGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.032, 0.0),
      new THREE.Vector2(0.085, 0.44),
      new THREE.Vector2(0.095, 0.85),
      new THREE.Vector2(0.052, 1.28),
      new THREE.Vector2(0.01, 1.58),
    ],
    12,
  );
  const mergedPlumeGeo = registerGeo(mergeGeometries([plumeOuterGeo, plumeInnerGeo], false));
  plumeOuterGeo.dispose();
  plumeInnerGeo.dispose();
  const centralPlumeMesh = new THREE.Mesh(mergedPlumeGeo, cascadeStreamMat);
  centralPlumeMesh.position.set(ftn.x, 4.30, ftn.z);
  centralPlumeMesh.userData.isAnimatedWater = true;
  animatedGroup.add(centralPlumeMesh);

  // Frothy Splash & Ripple Rings at stream landing radii
  const rippleRingGeos: THREE.BufferGeometry[] = [];
  for (const [rIn, rOut, y] of [
    [2.32, 2.86, 0.80],
    [1.42, 1.78, 2.50],
    [0.50, 0.84, 3.78],
  ] as const) {
    const rg = new THREE.RingGeometry(rIn, rOut, 40);
    rg.rotateX(-Math.PI / 2);
    rg.translate(0, y, 0);
    rippleRingGeos.push(rg);
  }
  const mergedRippleRingsGeo = registerGeo(mergeGeometries(rippleRingGeos, false));
  rippleRingGeos.forEach((g) => g.dispose());
  const fountainRippleMesh = new THREE.Mesh(mergedRippleRingsGeo, frothRingMat);
  fountainRippleMesh.position.set(ftn.x, 0, ftn.z);
  animatedGroup.add(fountainRippleMesh);

  // =========================================================================
  // 3. CALL THE URBAN PLAZA BUILDINGS (`buddiesUrbanPlazaBuildingsBuilder.ts` & `buddiesBeautySalonBuilder.ts`)
  // =========================================================================
  const wisteriaCollectors = { matrices: [] as THREE.Matrix4[], colors: [] as THREE.Color[] };
  const pondReedCollectors = { matrices: [] as THREE.Matrix4[], colors: [] as THREE.Color[] };
  const shrubCollectors = { matrices: [] as THREE.Matrix4[], colors: [] as THREE.Color[] };

  const buildingsCtx: UrbanPlazaBuildingsContext = {
    staticGroup,
    animatedGroup,
    windUniforms,
    isSoftwareGl,
    addPart,
    applyPlanarUvs,
    applyNormalizedDiscUvs,
    scaleGeometryUvs,
    registerGeo,
    registerMat,
    registerTex,
    textures: {
      stoneTex,
      fieldstoneTex,
      timberTex,
      cobbleTex,
      pondWaterTex,
      brickTex,
    },
    wisteriaCollectors,
    pondReedCollectors,
    shrubCollectors,
  };

  buildBoutiqueRooftopTower3D(buildingsCtx);
  buildCozyBitesCafePavilion3D(buildingsCtx);
  buildTimberPergolaAndLilyPond3D(buildingsCtx);
  buildBeautySalonStudio3D(buildingsCtx);

  // Collect all `isAnimatedWater` meshes added by buildings + fountain so `update()` animates every texture & shader cleanly
  const animatedWaterTextures = new Set<THREE.Texture>([pondWaterTex, fountainBasinTex]);
  const animatedWaterShaders: THREE.ShaderMaterial[] = [];
  animatedGroup.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.userData?.isAnimatedWater) {
      const m = obj.material;
      if (m instanceof THREE.ShaderMaterial && m.uniforms?.uTime) {
        animatedWaterShaders.push(m);
      } else if (m && 'map' in m && (m as THREE.MeshBasicMaterial).map instanceof THREE.Texture) {
        animatedWaterTextures.add((m as THREE.MeshBasicMaterial).map as THREE.Texture);
      }
    }
  });

  // =========================================================================
  // 5. 6 SOLID SCULPTED WAVE STONE BENCHES + 4 CLASSIC TEAK & IRON BENCHES
  // =========================================================================
  const hedgeShrubMatrices: THREE.Matrix4[] = [];
  const hedgeShrubColors: THREE.Color[] = [];
  const upVec = new THREE.Vector3(0, 1, 0);

  const waveBenchGeo = registerGeo(createWaveStoneBenchGeometry());
  const planterBenchLeafMatrices: THREE.Matrix4[] = [];
  const planterBenchLavenderMatrices: THREE.Matrix4[] = [];
  const basketPetalClusters: THREE.Matrix4[] = [];

  const benchFrontLegGeo = registerGeo(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.02, 0.28),
        new THREE.Vector3(0, 0.18, 0.24),
        new THREE.Vector3(0, 0.38, 0.25),
        new THREE.Vector3(0, 0.51, 0.24),
      ]),
      12,
      0.026,
      6,
      false,
    ),
  );
  const benchRearLegGeo = registerGeo(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.02, -0.24),
        new THREE.Vector3(0, 0.20, -0.20),
        new THREE.Vector3(0, 0.48, -0.17),
        new THREE.Vector3(0, 0.76, -0.22),
        new THREE.Vector3(0, 1.02, -0.28),
        new THREE.Vector3(0, 1.07, -0.31),
      ]),
      16,
      0.026,
      6,
      false,
    ),
  );
  const benchSeatApronGeo = registerGeo(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.45, 0.29),
        new THREE.Vector3(0, 0.50, 0.24),
        new THREE.Vector3(0, 0.49, 0.02),
        new THREE.Vector3(0, 0.51, -0.16),
      ]),
      12,
      0.024,
      6,
      false,
    ),
  );
  const benchUnderArchGeo = registerGeo(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.16, 0.24),
        new THREE.Vector3(0, 0.28, 0.02),
        new THREE.Vector3(0, 0.18, -0.20),
      ]),
      10,
      0.017,
      5,
      false,
    ),
  );
  const benchArmrestGeo = registerGeo(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.77, -0.21),
        new THREE.Vector3(0, 0.69, -0.06),
        new THREE.Vector3(0, 0.72, 0.14),
        new THREE.Vector3(0, 0.68, 0.28),
        new THREE.Vector3(0, 0.59, 0.24),
        new THREE.Vector3(0, 0.63, 0.18),
      ]),
      18,
      0.023,
      6,
      false,
    ),
  );

  for (const bench of CENTRAL_PARK_BENCHES) {
    const bGrp = new THREE.Group();
    bGrp.position.set(bench.x, 0.02, bench.z);
    bGrp.rotation.y = bench.rotY;
    staticGroup.add(bGrp);

    if (bench.style === 'solid_wave') {
      // Sculpted Cast-Stone Wave Bench (`f313bc74.jpg`) grounded solidly onto the terrazzo promenade
      addPart(bGrp, waveBenchGeo.clone(), '#ffffff', [0, -0.005, 0], [0, 0, 0], {
        map: waveStoneTex,
        castShadow: true,
        receiveShadow: true,
      });
      continue;
    }

    // Classic Slatted Honey-Teak & Antique Bronze-Iron Bench (`classic_teak`)
    bGrp.scale.setScalar(1.58);
    for (const sx of [-0.88, 0.88]) {
      addPart(bGrp, benchFrontLegGeo.clone(), '#544a40', [sx, 0, 0], [0, 0, 0], { castShadow: true, receiveShadow: true });
      addPart(bGrp, benchRearLegGeo.clone(), '#544a40', [sx, 0, 0], [0, 0, 0], { castShadow: true, receiveShadow: true });
      addPart(bGrp, benchSeatApronGeo.clone(), '#5e5348', [sx, 0, 0], [0, 0, 0], { receiveShadow: true });
      addPart(bGrp, benchUnderArchGeo.clone(), '#544a40', [sx, 0, 0], [0, 0, 0], { receiveShadow: true });
      addPart(bGrp, benchArmrestGeo.clone(), '#685c50', [sx, 0, 0], [0, 0, 0], { receiveShadow: true });
      addPart(bGrp, new THREE.CylinderGeometry(0.04, 0.05, 0.03, 6), '#494139', [sx, 0.015, 0.28], [0, 0, 0], { receiveShadow: true });
      addPart(bGrp, new THREE.CylinderGeometry(0.04, 0.05, 0.03, 6), '#494139', [sx, 0.015, -0.24], [0, 0, 0], { receiveShadow: true });
      addPart(bGrp, new THREE.TorusGeometry(0.078, 0.014, 5, 12), '#5e5348', [sx, 0.37, 0.02], [0, Math.PI * 0.5, 0], { receiveShadow: true });
      addPart(bGrp, new THREE.TorusGeometry(0.052, 0.012, 5, 10), '#685c50', [sx, 0.38, 0.13], [0, Math.PI * 0.5, 0], { receiveShadow: true });
      addPart(bGrp, new THREE.TorusGeometry(0.052, 0.012, 5, 10), '#685c50', [sx, 0.38, -0.09], [0, Math.PI * 0.5, 0], { receiveShadow: true });
    }

    const seatProfile: readonly [number, number, number][] = [
      [0.49, 0.23, 0.18],
      [0.505, 0.12, 0.04],
      [0.495, 0.01, -0.02],
      [0.50, -0.10, -0.08],
    ];
    for (const [sy, sz, tiltX] of seatProfile) {
      addPart(bGrp, applyPlanarUvs(new RoundedBoxGeometry(1.82, 0.036, 0.092, 2, 0.008), 1.0), '#ffffff', [0, sy, sz], [tiltX, 0, 0], {
        map: timberTex,
        castShadow: true,
        receiveShadow: true,
      });
    }
    for (let sl = 0; sl < 4; sl++) {
      addPart(
        bGrp,
        applyPlanarUvs(new RoundedBoxGeometry(1.82, 0.088, 0.036, 2, 0.008), 1.0),
        '#ffffff',
        [0, 0.62 + sl * 0.108, -0.155 - sl * 0.026],
        [-0.24, 0, 0],
        { map: timberTex, castShadow: true, receiveShadow: true },
      );
    }
    for (const rx of [-0.54, 0.0, 0.54]) {
      addPart(bGrp, new RoundedBoxGeometry(0.044, 0.52, 0.026, 2, 0.005), '#544a40', [rx, 0.75, -0.22], [-0.24, 0, 0], { receiveShadow: true });
      for (let rv = 0; rv < 4; rv++) {
        addPart(bGrp, new THREE.SphereGeometry(0.013, 5, 4), '#d4ab62', [rx, 0.62 + rv * 0.108, -0.232 - rv * 0.026]);
      }
    }

    const planterOffsets =
      bench.planterSide === 'both'
        ? [-1.18, 1.18]
        : bench.planterSide === 'left'
        ? [-1.18]
        : bench.planterSide === 'right'
        ? [1.18]
        : [];
    for (const px of planterOffsets) {
      addPart(bGrp, applyPlanarUvs(new RoundedBoxGeometry(0.42, 0.46, 0.44, 2, 0.012), 0.9), '#ffffff', [px, 0.24, -0.02], [0, 0, 0], {
        map: timberTex,
        castShadow: true,
      });
      for (const cx of [-0.20, 0.20]) {
        for (const cz of [-0.21, 0.21]) {
          addPart(bGrp, applyPlanarUvs(new RoundedBoxGeometry(0.068, 0.48, 0.068, 2, 0.010), 0.8), '#ffffff', [px + cx, 0.24, -0.02 + cz], [0, 0, 0], {
            map: timberTex,
          });
        }
      }
      for (let st = -1; st <= 1; st++) {
        addPart(bGrp, applyPlanarUvs(new RoundedBoxGeometry(0.072, 0.38, 0.468, 2, 0.008), 0.8), '#ffffff', [px + st * 0.105, 0.24, -0.02], [0, 0, 0], {
          map: timberTex,
        });
        addPart(bGrp, applyPlanarUvs(new RoundedBoxGeometry(0.448, 0.38, 0.072, 2, 0.008), 0.8), '#ffffff', [px, 0.24, -0.02 + st * 0.108], [0, 0, 0], {
          map: timberTex,
        });
      }
      addPart(bGrp, applyPlanarUvs(createMiteredPlanterLipGeo(0.52, 0.54, 0.075, 0.052), 0.9), '#ffffff', [px, 0.462, -0.02], [0, 0, 0], {
        map: timberTex,
      });
      addPart(bGrp, new THREE.BoxGeometry(0.37, 0.04, 0.39), '#553d29', [px, 0.486, -0.02]);

      const worldHydPos = new THREE.Vector3(px - 0.06, 0.49, 0.06)
        .multiplyScalar(1.58)
        .applyAxisAngle(upVec, bench.rotY)
        .add(new THREE.Vector3(bench.x, 0.02, bench.z));
      const pq = new THREE.Quaternion().setFromAxisAngle(upVec, bench.rotY + px);
      planterBenchLeafMatrices.push(new THREE.Matrix4().compose(worldHydPos, pq, new THREE.Vector3(0.40, 0.40, 0.40)));

      const worldLavPos = new THREE.Vector3(px + 0.06, 0.49, -0.08)
        .multiplyScalar(1.58)
        .applyAxisAngle(upVec, bench.rotY)
        .add(new THREE.Vector3(bench.x, 0.02, bench.z));
      planterBenchLavenderMatrices.push(new THREE.Matrix4().compose(worldLavPos, pq, new THREE.Vector3(0.46, 0.50, 0.46)));
    }
  }

  // =========================================================================
  // 6. 10 ORNATE DUAL-BASKET BRONZE PARK LAMPPOSTS (`media_1795017982455_f313bc74.jpg`)
  // =========================================================================
  // Warm antique gunmetal-bronze PBR material (#5a564e / #6c6452 metallic sheen, NEVER pitch-black!)
  const bronzeMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: antiqueBronzeTex,
      roughness: 0.34,
      metalness: 0.25,
      emissive: '#221e17',
      emissiveIntensity: 0.22,
    }),
  );
  const bronzeDetailMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: '#e6dcc8',
      map: antiqueBronzeTex,
      roughness: 0.38,
      metalness: 0.22,
      emissive: '#1e1a14',
      emissiveIntensity: 0.18,
    }),
  );
  const parkLanternGlassTexs = createLanternGlassTexture();
  const parkEdisonTexs = createEdisonBulbTextures();
  const parkGlowTex = createRadialLanternGlowTexture();
  registerTex(parkLanternGlassTexs.map);
  registerTex(parkLanternGlassTexs.emissiveMap);
  registerTex(parkEdisonTexs.map);
  registerTex(parkEdisonTexs.emissiveMap);
  registerTex(parkGlowTex);

  const lanternGlassMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: parkLanternGlassTexs.map,
      emissive: '#ffcf70',
      emissiveMap: parkLanternGlassTexs.emissiveMap,
      emissiveIntensity: 0.02,
      roughness: 0.16,
      metalness: 0.10,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const brassSocketMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: '#d4a84e',
      roughness: 0.32,
      metalness: 0.62,
    }),
  );
  const lanternBulbMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: '#fff6d8',
      map: parkEdisonTexs.map,
      emissive: '#ffca64',
      emissiveMap: parkEdisonTexs.emissiveMap,
      emissiveIntensity: 0.12,
      roughness: 0.22,
      metalness: 0.05,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const lanternFilamentMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: '#fffef2',
      emissive: '#fff4c6',
      emissiveIntensity: 0.15,
      roughness: 0.15,
      metalness: 0.0,
      toneMapped: false,
    }),
  );

  const addBronzePart = (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    pos: [number, number, number] = [0, 0, 0],
    rot: [number, number, number] = [0, 0, 0],
    opts?: { castShadow?: boolean; detail?: boolean },
  ): THREE.Mesh => {
    registerGeo(geo);
    const m = new THREE.Mesh(geo, opts?.detail ? bronzeDetailMat : bronzeMat);
    m.position.set(pos[0], pos[1], pos[2]);
    m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = !isSoftwareGl && Boolean(opts?.castShadow);
    m.receiveShadow = !isSoftwareGl;
    m.frustumCulled = true;
    parent.add(m);
    return m;
  };

  const lampBracketArmGeo = registerGeo(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.0, 0.0),
        new THREE.Vector3(0, 0.16, 0.12),
        new THREE.Vector3(0, 0.24, 0.36),
        new THREE.Vector3(0, 0.22, 0.58),
      ]),
      12,
      0.025,
      6,
      false,
    ),
  );
  const lampBracketScrollGeo = registerGeo(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.0, 0.06),
        new THREE.Vector3(0, 0.12, 0.26),
        new THREE.Vector3(0, 0.21, 0.42),
        new THREE.Vector3(0, 0.14, 0.48),
        new THREE.Vector3(0, 0.10, 0.42),
      ]),
      12,
      0.015,
      5,
      false,
    ),
  );
  const lampPedestalGeo = registerGeo(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0, 0.11),
        new THREE.Vector2(0.24, 0.11),
        new THREE.Vector2(0.21, 0.22),
        new THREE.Vector2(0.15, 0.40),
        new THREE.Vector2(0.19, 0.56),
        new THREE.Vector2(0.14, 0.72),
        new THREE.Vector2(0.10, 0.88),
        new THREE.Vector2(0.0, 0.88),
      ],
      14,
    ),
  );

  const PARK_LAMP_SCALE = CENTRAL_PARK_LANTERN_GLOW_SPEC.lampScale;
  const PARK_BASKET_FLORA_MULT = PARK_LAMP_SCALE / 1.15;
  const lampLanternGalleryGeo = registerGeo(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0, 3.38),
        new THREE.Vector2(0.088, 3.38),
        new THREE.Vector2(0.135, 3.43),
        new THREE.Vector2(0.165, 3.47),
        new THREE.Vector2(0.145, 3.50),
        new THREE.Vector2(0.0, 3.50),
      ],
      14,
    ),
  );
  const parkBrassSocketGeo = registerGeo(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0, 3.485),
        new THREE.Vector2(0.030, 3.485),
        new THREE.Vector2(0.026, 3.512),
        new THREE.Vector2(0.022, 3.545),
        new THREE.Vector2(0.0, 3.545),
      ],
      10,
    ),
  );
  const parkEdisonBulbGeo = registerGeo(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0, 3.540),
        new THREE.Vector2(0.021, 3.545),
        new THREE.Vector2(0.027, 3.575),
        new THREE.Vector2(0.048, 3.635),
        new THREE.Vector2(0.054, 3.685),
        new THREE.Vector2(0.040, 3.732),
        new THREE.Vector2(0.018, 3.754),
        new THREE.Vector2(0.0, 3.760),
      ],
      12,
    ),
  );
  const parkFilamentCoreGeo = registerGeo(new THREE.CylinderGeometry(0.014, 0.016, 0.095, 8));
  const parkRawGlassCyl = new THREE.CylinderGeometry(0.198, 0.134, 0.43, 4, 1, true);
  parkRawGlassCyl.rotateY(Math.PI / 4);
  const parkLanternGlassGeo = registerGeo(parkRawGlassCyl.toNonIndexed());
  parkRawGlassCyl.dispose();
  parkLanternGlassGeo.computeVertexNormals();
  {
    const gUv = parkLanternGlassGeo.getAttribute('uv');
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
  }

  for (const lamp of CENTRAL_PARK_LAMPPOSTS) {
    const lGrp = new THREE.Group();
    lGrp.position.set(lamp.x, 0.02, lamp.z);
    lGrp.rotation.y = lamp.rotY;
    lGrp.scale.setScalar(PARK_LAMP_SCALE);
    staticGroup.add(lGrp);

    // Square Molded Stone Plinth Pad + Bronze Flange + 4 Anchor Bolts
    addPart(lGrp, applyPlanarUvs(new RoundedBoxGeometry(0.45, 0.11, 0.45, 2, 0.018), 0.9), '#ffffff', [0, 0.055, 0], [0, 0, 0], {
      map: graniteCurbTex,
    });
    addBronzePart(lGrp, new RoundedBoxGeometry(0.36, 0.045, 0.36, 2, 0.010), [0, 0.13, 0]);
    for (const bx of [-0.13, 0.13]) {
      for (const bz of [-0.13, 0.13]) {
        addBronzePart(lGrp, new THREE.CylinderGeometry(0.016, 0.016, 0.04, 6), [bx, 0.16, bz], [0, 0, 0], { detail: true });
      }
    }

    // Turned Fluted Pedestal + Tapered Fluted Bronze Shaft + Decorative Collar Rings + Lantern Gallery Cup
    addBronzePart(lGrp, lampPedestalGeo.clone(), [0, 0, 0], [0, 0, 0], { castShadow: true });
    addBronzePart(lGrp, new THREE.CylinderGeometry(0.068, 0.095, 2.38, 12), [0, 2.04, 0], [0, 0, 0], { castShadow: true });
    for (let fl = 0; fl < 8; fl++) {
      const ang = (fl / 8) * Math.PI * 2;
      addBronzePart(
        lGrp,
        new THREE.CylinderGeometry(0.012, 0.016, 2.15, 5),
        [Math.cos(ang) * 0.078, 1.98, Math.sin(ang) * 0.078],
        [0, 0, 0],
        { detail: true },
      );
    }
    addBronzePart(lGrp, new THREE.TorusGeometry(0.115, 0.025, 6, 14), [0, 3.24, 0], [Math.PI * 0.5, 0, 0]);
    addBronzePart(lGrp, new THREE.CylinderGeometry(0.125, 0.085, 0.14, 12), [0, 3.36, 0]);
    addBronzePart(lGrp, lampLanternGalleryGeo.clone(), [0, 0, 0], [0, 0, 0], { detail: true });

    // Dual Scrolled Crossarms + 3-Chain Hanging Woven Wicker Petunia Baskets
    for (const zSide of [-1, 1] as const) {
      addBronzePart(lGrp, lampBracketArmGeo.clone(), [0, 3.04, 0], [0, zSide > 0 ? 0 : Math.PI, 0]);
      addBronzePart(lGrp, lampBracketScrollGeo.clone(), [0, 2.98, 0], [0, zSide > 0 ? 0 : Math.PI, 0], { detail: true });
      const bz = zSide * 0.56;
      for (let ch = 0; ch < 3; ch++) {
        const cAng = (ch / 3) * Math.PI * 2;
        const topPt = new THREE.Vector3(0, 3.25, bz);
        const botPt = new THREE.Vector3(Math.cos(cAng) * 0.19, 2.68, bz + Math.sin(cAng) * 0.19);
        const mid = topPt.clone().add(botPt).multiplyScalar(0.5);
        const dir = botPt.clone().sub(topPt);
        const chQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        const chE = new THREE.Euler().setFromQuaternion(chQ);
        addBronzePart(lGrp, new THREE.CylinderGeometry(0.007, 0.007, dir.length(), 4), [mid.x, mid.y, mid.z], [chE.x, chE.y, chE.z], {
          detail: true,
        });
      }
      addPart(lGrp, scaleGeometryUvs(new THREE.CylinderGeometry(0.22, 0.12, 0.22, 12), 2.5, 1.0), '#ffffff', [0, 2.58, bz], [0, 0, 0], {
        map: wickerTex,
      });

      const worldBasketPos = new THREE.Vector3(0, 2.58 * PARK_LAMP_SCALE + 0.02, bz * PARK_LAMP_SCALE)
        .applyAxisAngle(upVec, lamp.rotY)
        .add(new THREE.Vector3(lamp.x, 0, lamp.z));
      basketPetalClusters.push(
        new THREE.Matrix4().compose(
          worldBasketPos,
          new THREE.Quaternion(),
          new THREE.Vector3(0.42 * PARK_BASKET_FLORA_MULT, 0.36 * PARK_BASKET_FLORA_MULT, 0.42 * PARK_BASKET_FLORA_MULT),
        ),
      );
      // Trailing petunia lower drape + foliage mound
      basketPetalClusters.push(
        new THREE.Matrix4().compose(
          worldBasketPos.clone().add(new THREE.Vector3(0, -0.06 * PARK_BASKET_FLORA_MULT, 0)),
          new THREE.Quaternion().setFromAxisAngle(upVec, Math.PI * 0.25),
          new THREE.Vector3(0.36 * PARK_BASKET_FLORA_MULT, 0.28 * PARK_BASKET_FLORA_MULT, 0.36 * PARK_BASKET_FLORA_MULT),
        ),
      );
      hedgeShrubMatrices.push(
        new THREE.Matrix4().compose(
          worldBasketPos.clone().add(new THREE.Vector3(0, 0.07 * PARK_BASKET_FLORA_MULT, 0)),
          new THREE.Quaternion(),
          new THREE.Vector3(0.20 * PARK_BASKET_FLORA_MULT, 0.14 * PARK_BASKET_FLORA_MULT, 0.20 * PARK_BASKET_FLORA_MULT),
        ),
      );
      hedgeShrubColors.push(new THREE.Color('#7ecb72'));
    }

    // Ornate Victorian Tapering Square Glass Lantern + Brass Socket + Edison Filament Bulb + Bronze Mullions + Stepped Cap + Finial
    addBronzePart(lGrp, new RoundedBoxGeometry(0.218, 0.022, 0.218, 2, 0.004), [0, 3.475, 0]);
    addBronzePart(lGrp, new RoundedBoxGeometry(0.320, 0.024, 0.320, 2, 0.005), [0, 3.905, 0]);

    const socketMesh = new THREE.Mesh(parkBrassSocketGeo, brassSocketMat);
    socketMesh.frustumCulled = true;
    lGrp.add(socketMesh);

    const bulbMesh = new THREE.Mesh(parkEdisonBulbGeo, lanternBulbMat);
    bulbMesh.renderOrder = 1;
    bulbMesh.frustumCulled = true;
    lGrp.add(bulbMesh);

    const filamentMesh = new THREE.Mesh(parkFilamentCoreGeo, lanternFilamentMat);
    filamentMesh.position.set(0, 3.645, 0);
    filamentMesh.frustumCulled = true;
    lGrp.add(filamentMesh);

    const glassMesh = new THREE.Mesh(parkLanternGlassGeo, lanternGlassMat);
    glassMesh.position.set(0, 3.685, 0);
    glassMesh.renderOrder = 2;
    glassMesh.frustumCulled = true;
    lGrp.add(glassMesh);

    for (let cr = 0; cr < 4; cr++) {
      const ca = (cr / 4) * Math.PI * 2 + Math.PI / 4;
      const p0 = new THREE.Vector3(Math.cos(ca) * 0.142, 3.465, Math.sin(ca) * 0.142);
      const p1 = new THREE.Vector3(Math.cos(ca) * 0.208, 3.915, Math.sin(ca) * 0.208);
      const dir = p1.clone().sub(p0);
      const len = dir.length();
      const mid = p0.clone().add(p1).multiplyScalar(0.5);
      const mQ = new THREE.Quaternion().setFromUnitVectors(upVec, dir.clone().normalize());
      const mE = new THREE.Euler().setFromQuaternion(mQ);
      addBronzePart(
        lGrp,
        new RoundedBoxGeometry(0.024, len, 0.024, 2, 0.004),
        [mid.x, mid.y, mid.z],
        [mE.x, mE.y, mE.z],
      );
    }
    addBronzePart(lGrp, new THREE.CylinderGeometry(0.055, 0.25, 0.22, 4), [0, 4.02, 0], [0, Math.PI / 4, 0]);
    addBronzePart(lGrp, new THREE.SphereGeometry(0.048, 8, 6), [0, 4.18, 0]);
    addBronzePart(lGrp, new THREE.ConeGeometry(0.022, 0.10, 6), [0, 4.26, 0]);
  }

  // Night-reactive Camera-Facing Smooth Radial Billboard Glow Sprites (no clipping glow spheres!)
  const lanternHaloGeo = registerGeo(new THREE.PlaneGeometry(1, 1));
  const lanternBillboard = createLanternBillboardGlowMaterial(parkGlowTex, {
    color: '#ffd984',
    opacity: 0.0,
  });
  registerMat(lanternBillboard.material);
  const lanternHaloInst = new THREE.InstancedMesh(
    lanternHaloGeo,
    lanternBillboard.material,
    CENTRAL_PARK_LAMPPOSTS.length,
  );
  lanternHaloInst.name = 'CentralParkLanternNightGlowInstanced';
  lanternHaloInst.renderOrder = 4;
  const glowY =
    CENTRAL_PARK_LANTERN_GLOW_SPEC.localLanternCenterY * PARK_LAMP_SCALE +
    CENTRAL_PARK_LANTERN_GLOW_SPEC.worldBaseOffsetY;
  const glowSize = CENTRAL_PARK_LANTERN_GLOW_SPEC.billboardBaseSizeMeters;
  CENTRAL_PARK_LAMPPOSTS.forEach((lamp, idx) => {
    lanternHaloInst.setMatrixAt(
      idx,
      new THREE.Matrix4().compose(
        new THREE.Vector3(lamp.x, glowY, lamp.z),
        new THREE.Quaternion(),
        new THREE.Vector3(glowSize, glowSize, glowSize),
      ),
    );
  });
  lanternHaloInst.instanceMatrix.needsUpdate = true;
  computeInstancedBoundingVolumes(lanternHaloInst, { padding: 1.5, frustumCulled: true });
  lanternHaloInst.visible = false;
  animatedGroup.add(lanternHaloInst);

  // =========================================================================
  // 7. 6 BLOOMING PINK SAKURA TREES + 3 MATURE OAKS (`CENTRAL_PARK_CANOPY_TREES`)
  // =========================================================================
  const sakuraCrownClusterMatrices: THREE.Matrix4[] = [];
  const sakuraCrownClusterColors: THREE.Color[] = [];
  const oakCrownClusterMatrices: THREE.Matrix4[] = [];
  const oakCrownClusterColors: THREE.Color[] = [];

  for (const tree of CENTRAL_PARK_CANOPY_TREES) {
    const baseY = 0.03;

    // Promenade trees get carved limestone planter curb + rich dark garden soil bed
    addPart(staticGroup, scaleGeometryUvs(new THREE.TorusGeometry(1.22, 0.11, 6, 20), 6.0, 1.0), '#ffffff', [tree.x, 0.11, tree.z], [Math.PI / 2, 0, 0], {
      map: stoneTex,
      receiveShadow: true,
    });
    addPart(staticGroup, applyPlanarUvs(new THREE.CylinderGeometry(1.16, 1.18, 0.12, 20), 1.4), '#ffffff', [tree.x, 0.07, tree.z], [0, 0, 0], {
      map: gardenSoilTex,
      receiveShadow: true,
    });

    const tGrp = new THREE.Group();
    tGrp.position.set(tree.x, baseY, tree.z);
    tGrp.rotation.y = tree.rotY;
    tGrp.scale.setScalar(tree.scale);
    staticGroup.add(tGrp);

    if (tree.species === 'pink_sakura') {
      const sakuraAoOpts = {
        yGroundEnd: 0.55,
        yCanopyStart: 1.85,
        yCanopyDeep: 3.15,
        yTipStart: 3.85,
        yTipEnd: 5.45,
        groundTint: [0.80, 0.75, 0.71] as const,
        sunTint: [1.0, 0.97, 0.93] as const,
        canopyAoTint: [0.58, 0.50, 0.54] as const,
        tipTint: [0.76, 0.69, 0.72] as const,
      };
      // Graceful sinuous cherry-bark trunk + flared spline buttress roots + smoothly tapered fork limbs
      const trunkCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.04, 0),
        new THREE.Vector3(0.14, 1.1, 0.06),
        new THREE.Vector3(-0.08, 2.25, -0.05),
        new THREE.Vector3(0.06, 3.15, 0.04),
      ]);
      const sakuraTrunkGeo = applyTreeCanopyAoVertexGradient(
        scaleGeometryUvs(createSmoothTaperedTubeGeo(trunkCurve, 16, 0.44, 0.23, 12), 2.2, 2.4),
        sakuraAoOpts,
      );
      addPart(tGrp, sakuraTrunkGeo, '#ffffff', [0, 0, 0], [0, 0, 0], {
        map: cherryBarkTex,
        castShadow: true,
        receiveShadow: true,
        bounce: 0.14,
      });
      for (let r = 0; r < 5; r++) {
        const ra = (r / 5) * Math.PI * 2;
        const rootCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(Math.cos(ra) * 0.14, 0.56, Math.sin(ra) * 0.14),
          new THREE.Vector3(Math.cos(ra) * 0.42, 0.18, Math.sin(ra) * 0.42),
          new THREE.Vector3(Math.cos(ra) * 0.78, -0.05, Math.sin(ra) * 0.78),
        ]);
        const sakuraRootGeo = applyTreeCanopyAoVertexGradient(
          scaleGeometryUvs(createSmoothTaperedTubeGeo(rootCurve, 8, 0.20, 0.055, 8), 1.4, 1.2),
          sakuraAoOpts,
        );
        addPart(
          tGrp,
          sakuraRootGeo,
          '#ffffff',
          [0, 0, 0],
          [0, 0, 0],
          { map: cherryBarkTex, receiveShadow: true, bounce: 0.14 },
        );
      }

      const sakuraBranchAngles = [0.15, 1.22, 2.42, 3.68, 4.95];
      sakuraBranchAngles.forEach((ba, bi) => {
        const reach = 2.15 + (bi % 2) * 0.35;
        const bx = Math.cos(ba) * reach;
        const bz = Math.sin(ba) * reach;
        const bCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.06, 2.86, 0.04),
          new THREE.Vector3(bx * 0.55, 4.15, bz * 0.55),
          new THREE.Vector3(bx, 4.75 + (bi % 2) * 0.28, bz),
        ]);
        const sakuraBranchGeo = applyTreeCanopyAoVertexGradient(
          scaleGeometryUvs(createSmoothTaperedTubeGeo(bCurve, 10, 0.16, 0.085, 8), 1.4, 1.8),
          sakuraAoOpts,
        );
        addPart(tGrp, sakuraBranchGeo, '#ffffff', [0, 0, 0], [0, 0, 0], {
          map: cherryBarkTex,
          castShadow: true,
          receiveShadow: true,
          bounce: 0.14,
        });
        const forkAng = ba + (bi % 2 === 0 ? 0.52 : -0.52);
        const forkCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(bx * 0.52, 4.08, bz * 0.52),
          new THREE.Vector3(Math.cos(forkAng) * reach * 0.85, 5.45, Math.sin(forkAng) * reach * 0.85),
        ]);
        const sakuraForkGeo = applyTreeCanopyAoVertexGradient(
          scaleGeometryUvs(createSmoothTaperedTubeGeo(forkCurve, 7, 0.092, 0.042, 6), 1.0, 1.4),
          sakuraAoOpts,
        );
        addPart(tGrp, sakuraForkGeo, '#ffffff', [0, 0, 0], [0, 0, 0], {
          map: cherryBarkTex,
          receiveShadow: true,
          bounce: 0.14,
        });

        const wC = new THREE.Vector3(bx * 0.92, 4.95, bz * 0.92)
          .multiplyScalar(tree.scale)
          .applyAxisAngle(upVec, tree.rotY)
          .add(new THREE.Vector3(tree.x, baseY, tree.z));
        sakuraCrownClusterMatrices.push(
          new THREE.Matrix4().compose(wC, new THREE.Quaternion(), new THREE.Vector3(1.62 * tree.scale, 1.25 * tree.scale, 1.62 * tree.scale)),
        );
        sakuraCrownClusterColors.push(new THREE.Color(bi % 2 === 0 ? '#ffffff' : '#ffe6f0'));
      });

      for (const [cx, cy, cz, cs, tint] of [
        [0, 6.15, 0, 1.98, '#ffffff'],
        [0.95, 5.55, 0.80, 1.55, '#ffe0ec'],
        [-0.95, 5.65, -0.82, 1.55, '#ffecf4'],
        [-0.85, 5.35, 0.92, 1.45, '#f9d4e6'],
        [0.88, 5.42, -0.86, 1.45, '#ffe8f2'],
      ] as const) {
        const wTop = new THREE.Vector3(cx, cy, cz)
          .multiplyScalar(tree.scale)
          .applyAxisAngle(upVec, tree.rotY)
          .add(new THREE.Vector3(tree.x, baseY, tree.z));
        sakuraCrownClusterMatrices.push(
          new THREE.Matrix4().compose(wTop, new THREE.Quaternion(), new THREE.Vector3(cs * tree.scale, cs * 0.78 * tree.scale, cs * tree.scale)),
        );
        sakuraCrownClusterColors.push(new THREE.Color(tint));
      }
    } else {
      const oakAoOpts = {
        yGroundEnd: 0.68,
        yCanopyStart: 2.05,
        yCanopyDeep: 3.55,
        yTipStart: 4.35,
        yTipEnd: 6.25,
        groundTint: [0.80, 0.75, 0.68] as const,
        sunTint: [1.0, 0.97, 0.91] as const,
        canopyAoTint: [0.49, 0.52, 0.44] as const,
        tipTint: [0.71, 0.73, 0.61] as const,
      };
      // Mature Oak Shade Tree (`mature_oak`) with contoured Lathe trunk + flared buttress roots + tapered branches
      const oakTrunkProfile = [
        new THREE.Vector2(0.0, -0.05),
        new THREE.Vector2(0.84, -0.05),
        new THREE.Vector2(0.68, 0.45),
        new THREE.Vector2(0.56, 1.35),
        new THREE.Vector2(0.48, 2.35),
        new THREE.Vector2(0.45, 3.15),
        new THREE.Vector2(0.40, 3.48),
        new THREE.Vector2(0.0, 3.58),
      ];
      const oakTrunkGeo = applyTreeCanopyAoVertexGradient(
        scaleGeometryUvs(new THREE.LatheGeometry(oakTrunkProfile, 14), 2.5, 2.5),
        oakAoOpts,
      );
      addPart(tGrp, oakTrunkGeo, '#ffffff', [0, 0, 0], [0, 0, 0], {
        map: barkTex,
        castShadow: true,
        receiveShadow: true,
        bounce: 0.14,
      });
      for (let r = 0; r < 6; r++) {
        const ra = (r / 6) * Math.PI * 2;
        const rootCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(Math.cos(ra) * 0.30, 0.68, Math.sin(ra) * 0.30),
          new THREE.Vector3(Math.cos(ra) * 0.66, 0.22, Math.sin(ra) * 0.66),
          new THREE.Vector3(Math.cos(ra) * 1.05, -0.05, Math.sin(ra) * 1.05),
        ]);
        const oakRootGeo = applyTreeCanopyAoVertexGradient(
          scaleGeometryUvs(createSmoothTaperedTubeGeo(rootCurve, 8, 0.25, 0.065, 8), 1.5, 1.2),
          oakAoOpts,
        );
        addPart(
          tGrp,
          oakRootGeo,
          '#ffffff',
          [0, 0, 0],
          [0, 0, 0],
          { map: barkTex, receiveShadow: true, bounce: 0.14 },
        );
      }
      const oakBranchAngles = [0.2, 1.45, 2.7, 3.95, 5.2];
      oakBranchAngles.forEach((ba, bi) => {
        const reach = 2.35 + (bi % 2) * 0.45;
        const bx = Math.cos(ba) * reach;
        const bz = Math.sin(ba) * reach;
        const bCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 3.16, 0),
          new THREE.Vector3(bx * 0.55, 4.65, bz * 0.55),
          new THREE.Vector3(bx, 5.55, bz),
        ]);
        const oakBranchGeo = applyTreeCanopyAoVertexGradient(
          scaleGeometryUvs(createSmoothTaperedTubeGeo(bCurve, 10, 0.21, 0.11, 8), 1.5, 2.0),
          oakAoOpts,
        );
        addPart(tGrp, oakBranchGeo, '#ffffff', [0, 0, 0], [0, 0, 0], {
          map: barkTex,
          castShadow: true,
          receiveShadow: true,
          bounce: 0.14,
        });
        const forkAng = ba + (bi % 2 === 0 ? 0.52 : -0.52);
        const forkCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(bx * 0.52, 4.58, bz * 0.52),
          new THREE.Vector3(Math.cos(forkAng) * reach * 0.85, 6.25, Math.sin(forkAng) * reach * 0.85),
        ]);
        const oakForkGeo = applyTreeCanopyAoVertexGradient(
          scaleGeometryUvs(createSmoothTaperedTubeGeo(forkCurve, 7, 0.115, 0.052, 6), 1.0, 1.5),
          oakAoOpts,
        );
        addPart(tGrp, oakForkGeo, '#ffffff', [0, 0, 0], [0, 0, 0], {
          map: barkTex,
          receiveShadow: true,
          bounce: 0.14,
        });

        const wC = new THREE.Vector3(bx * 0.92, 5.85, bz * 0.92)
          .multiplyScalar(tree.scale)
          .applyAxisAngle(upVec, tree.rotY)
          .add(new THREE.Vector3(tree.x, baseY, tree.z));
        oakCrownClusterMatrices.push(
          new THREE.Matrix4().compose(wC, new THREE.Quaternion(), new THREE.Vector3(1.85 * tree.scale, 1.55 * tree.scale, 1.85 * tree.scale)),
        );
        oakCrownClusterColors.push(new THREE.Color(bi % 2 === 0 ? '#dbe8a4' : '#c9dc8e'));
      });
      for (const [cx, cy, cz, cs, tint] of [
        [0, 7.25, 0, 2.25, '#f2f1be'],
        [1.1, 6.45, 0.85, 1.65, '#e7eaab'],
        [-1.05, 6.55, -0.9, 1.65, '#dfE59e'],
        [-0.9, 6.3, 1.0, 1.55, '#d6e39a'],
      ] as const) {
        const wTop = new THREE.Vector3(cx, cy, cz)
          .multiplyScalar(tree.scale)
          .applyAxisAngle(upVec, tree.rotY)
          .add(new THREE.Vector3(tree.x, baseY, tree.z));
        oakCrownClusterMatrices.push(
          new THREE.Matrix4().compose(wTop, new THREE.Quaternion(), new THREE.Vector3(cs * tree.scale, cs * 0.82 * tree.scale, cs * tree.scale)),
        );
        oakCrownClusterColors.push(new THREE.Color(tint));
      }
    }
  }

  // =========================================================================
  // 8. BOTANICAL BEDS, BUILDING COLLECTORS & SAKURA / OAK CANOPY INSTANCING
  // =========================================================================
  const roseLeafAlphaTex = registerTex(createRoseLeafAlphaTexture());
  const rosePetalAlphaTex = registerTex(createRosePetalAlphaTexture());
  const hydrangeaLeafAlphaTex = registerTex(createHydrangeaLeafAlphaTexture());
  const hydrangeaFloretAlphaTex = registerTex(createHydrangeaFloretAlphaTexture());
  const lavenderLeafAlphaTex = registerTex(createLavenderLeafAlphaTexture());
  const lavenderSpikeAlphaTex = registerTex(createLavenderSpikeAlphaTexture());
  const wisteriaLeafAlphaTex = registerTex(createWisteriaPinnateLeafTexture());
  const wisteriaRacemeAlphaTex = registerTex(createWisteriaRacemeAlphaTexture());

  let instancedMeshesCount = 1; // +1 for lanternHaloInst
  let totalBotanicalInstances = 0;

  const spawnAlphaCutoutFloraBatch = (
    name: string,
    geometry: THREE.BufferGeometry,
    matrices: readonly THREE.Matrix4[],
    bloomColors: readonly THREE.Color[],
    leafAlphaTex: THREE.Texture,
    petalAlphaTex: THREE.Texture,
    windAmp: number,
    flutterAmp: number,
  ) => {
    if (matrices.length === 0) {
      geometry.dispose();
      return;
    }
    registerGeo(geometry);
    const tintAttr = new Float32Array(matrices.length * 3);
    for (let i = 0; i < matrices.length; i++) {
      const c = bloomColors[i] ?? bloomColors[0] ?? new THREE.Color('#ffffff');
      tintAttr[i * 3] = c.r;
      tintAttr[i * 3 + 1] = c.g;
      tintAttr[i * 3 + 2] = c.b;
    }
    geometry.setAttribute('aBloomTint', new THREE.InstancedBufferAttribute(tintAttr, 3));

    const mat = registerMat(createBotanicalAlphaCutoutWindMaterial(leafAlphaTex, petalAlphaTex, windUniforms, windAmp, flutterAmp));
    const inst = new THREE.InstancedMesh(geometry, mat, matrices.length);
    inst.name = name;
    inst.castShadow = false;
    inst.receiveShadow = false;
    for (let i = 0; i < matrices.length; i++) {
      inst.setMatrixAt(i, matrices[i]);
    }
    inst.instanceMatrix.needsUpdate = true;
    computeInstancedBoundingVolumes(inst, { padding: 0.45, frustumCulled: true });
    foliageGroup.add(inst);
    instancedMeshesCount++;
    totalBotanicalInstances += matrices.length;
  };

  const roseMatrices: THREE.Matrix4[] = [];
  const roseColors: THREE.Color[] = [];
  const rosePalette = ['#f48fb1', '#d8436b', '#fbcfe8'];

  const hydrangeaMatrices: THREE.Matrix4[] = [];
  const hydrangeaColors: THREE.Color[] = [];
  const hydrangeaPalette = ['#8cc4f8', '#f5a4c6', '#b398eb'];

  const lavenderMatrices: THREE.Matrix4[] = [];
  const lavenderColors: THREE.Color[] = [];
  const lavenderPalette = ['#8b5cf6', '#a78bfa', '#7e57c2'];

  const isNearPromenadeTreePlanter = (x: number, z: number) =>
    CENTRAL_PARK_CANOPY_TREES.some(
      (t) => Math.hypot(x - t.x, z - t.z) <= 1.24,
    );

  for (const bed of CENTRAL_PARK_BOTANICAL_BEDS) {
    let bedY = 0.04;
    if (isNearPromenadeTreePlanter(bed.x, bed.z)) {
      bedY = 0.12;
    } else {
      // Ground Pergola / Boutique / Cafe border flowers in sleek limestone-edged mulch beds
      bedY = 0.10;
      addPart(staticGroup, scaleGeometryUvs(new THREE.TorusGeometry(0.56, 0.065, 5, 14), 3.0, 1.0), '#ffffff', [bed.x, 0.075, bed.z], [Math.PI / 2, 0, 0], {
        map: stoneTex,
      });
      addPart(staticGroup, applyPlanarUvs(new THREE.CylinderGeometry(0.52, 0.54, 0.08, 14), 1.0), '#ffffff', [bed.x, 0.07, bed.z], [0, 0, 0], {
        map: gardenSoilTex,
      });
    }

    const q = new THREE.Quaternion().setFromAxisAngle(upVec, bed.yaw);
    const mat4 = new THREE.Matrix4().compose(
      new THREE.Vector3(bed.x, bedY, bed.z),
      q,
      new THREE.Vector3(bed.scale, bed.scale, bed.scale),
    );
    if (bed.species === 'english_rose') {
      roseMatrices.push(mat4);
      roseColors.push(new THREE.Color(rosePalette[bed.colorVariant]));
    } else if (bed.species === 'hydrangea') {
      hydrangeaMatrices.push(mat4);
      hydrangeaColors.push(new THREE.Color(hydrangeaPalette[bed.colorVariant]));
    } else {
      lavenderMatrices.push(mat4);
      lavenderColors.push(new THREE.Color(lavenderPalette[bed.colorVariant]));
    }
  }

  for (let i = 0; i < planterBenchLeafMatrices.length; i++) {
    hydrangeaMatrices.push(planterBenchLeafMatrices[i]);
    hydrangeaColors.push(new THREE.Color(hydrangeaPalette[i % hydrangeaPalette.length]));
  }
  for (let i = 0; i < planterBenchLavenderMatrices.length; i++) {
    lavenderMatrices.push(planterBenchLavenderMatrices[i]);
    lavenderColors.push(new THREE.Color(lavenderPalette[i % lavenderPalette.length]));
  }

  // Petunia basket blossoms (purple/magenta/pink hanging clusters)
  const petuniaPalette = ['#d26fd4', '#e87db9', '#b87cf0', '#f4a5d0'];
  for (let i = 0; i < basketPetalClusters.length; i++) {
    roseMatrices.push(basketPetalClusters[i]);
    roseColors.push(new THREE.Color(petuniaPalette[i % petuniaPalette.length]));
  }

  // Ground-anchored `shrubCollectors` from Boutique / Cozy Bites / Pergola buildings (lavender/sage/cream palette)
  for (let i = 0; i < shrubCollectors.matrices.length; i++) {
    hydrangeaMatrices.push(shrubCollectors.matrices[i]);
    hydrangeaColors.push(shrubCollectors.colors[i] ?? new THREE.Color('#c4b5fd'));
  }

  spawnAlphaCutoutFloraBatch('CentralParkEnglishRosesInstanced', buildEnglishRoseBushGeometry(), roseMatrices, roseColors, roseLeafAlphaTex, rosePetalAlphaTex, 0.065, 0.024);
  spawnAlphaCutoutFloraBatch('CentralParkHydrangeasInstanced', buildHydrangeaBushGeometry(), hydrangeaMatrices, hydrangeaColors, hydrangeaLeafAlphaTex, hydrangeaFloretAlphaTex, 0.058, 0.02);
  spawnAlphaCutoutFloraBatch('CentralParkEnglishLavenderInstanced', buildEnglishLavenderClumpGeometry(), lavenderMatrices, lavenderColors, lavenderLeafAlphaTex, lavenderSpikeAlphaTex, 0.088, 0.032);
  spawnAlphaCutoutFloraBatch(
    'CentralParkClimbingWisteriaInstanced',
    buildClimbingWisteriaRacemeGeometry(),
    wisteriaCollectors.matrices,
    wisteriaCollectors.colors,
    wisteriaLeafAlphaTex,
    wisteriaRacemeAlphaTex,
    0.085,
    0.03,
  );
  spawnAlphaCutoutFloraBatch(
    'CentralParkPondReedsInstanced',
    buildCattailReedGeometry(),
    pondReedCollectors.matrices,
    pondReedCollectors.colors,
    roseLeafAlphaTex,
    rosePetalAlphaTex,
    0.095,
    0.025,
  );

  // Billboard wind-swayed canopy clusters for Pink Sakura, Mature Oaks & Organic Boxwood Hedges
  // Calibrated 34 quads/cluster (down from 52, -35% overdraw) with slightly fuller leafScale for identical lush volume.
  const effectiveLeafMask = leafMaskTexture || getSharedFallbackFoliageMaskTexture();
  const clusterGeo = registerGeo(createCanopyLeafClusterGeometry(isSoftwareGl ? 24 : 34));
  const canopyShadowProxyGeo = registerGeo(new THREE.IcosahedronGeometry(1.16, 0));
  const canopyShadowProxyMat = registerMat(
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  );
  const canopyShadowProxies: THREE.InstancedMesh[] = [];
  let canopyShadowsEnabled = !isSoftwareGl;

  const spawnCrownClusters = (
    name: string,
    matrices: THREE.Matrix4[],
    colors: THREE.Color[],
    shadowHex: string,
    midHex: string,
    sunHex: string,
    leafScale: number,
    castDappledShadow = true,
  ) => {
    if (matrices.length === 0) return;
    const mat = registerMat(createCanopyBillboardWindMaterial(effectiveLeafMask, windUniforms, shadowHex, midHex, sunHex, leafScale));
    const inst = new THREE.InstancedMesh(clusterGeo, mat, matrices.length);
    inst.name = name;
    // Never run alpha-tested `discard` leaf cards in the shadow depth pass; use a shared opaque
    // 20-triangle icosahedron proxy per crown cluster for fast Early-Z shadows instead.
    inst.castShadow = false;
    inst.receiveShadow = false;
    for (let i = 0; i < matrices.length; i++) {
      inst.setMatrixAt(i, matrices[i]);
      inst.setColorAt(i, colors[i] ?? new THREE.Color('#ffffff'));
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    const bounds = computeInstancedBoundingVolumes(inst, { padding: 1.4, frustumCulled: true });
    foliageGroup.add(inst);
    instancedMeshesCount++;
    totalBotanicalInstances += matrices.length;

    if (castDappledShadow && !isSoftwareGl) {
      const proxyInst = new THREE.InstancedMesh(canopyShadowProxyGeo, canopyShadowProxyMat, matrices.length);
      proxyInst.name = `${name}ShadowProxy`;
      proxyInst.instanceMatrix = inst.instanceMatrix;
      proxyInst.castShadow = canopyShadowsEnabled;
      proxyInst.visible = canopyShadowsEnabled;
      proxyInst.receiveShadow = false;
      proxyInst.boundingBox = bounds.boundingBox.clone();
      proxyInst.boundingSphere = bounds.boundingSphere.clone();
      proxyInst.frustumCulled = true;
      foliageGroup.add(proxyInst);
      canopyShadowProxies.push(proxyInst);
    }
  };

  spawnCrownClusters('CentralParkSakuraCanopyInstanced', sakuraCrownClusterMatrices, sakuraCrownClusterColors, '#a34873', '#e67fad', '#ffe0ee', 1.60, true);
  spawnCrownClusters('CentralParkOakCanopyInstanced', oakCrownClusterMatrices, oakCrownClusterColors, '#335d2e', '#5c943f', '#a6cf52', 1.70, true);
  spawnCrownClusters('CentralParkHedgeShrubsInstanced', hedgeShrubMatrices, hedgeShrubColors, '#285229', '#4b823c', '#86b84e', 1.62, false);

  // Bake ALL static architecture, terrazzo, gold ribbons, stone curbs, fountain, benches, lamps & tree trunks
  bakeStaticGroupMeshes(staticGroup, { minShadowCasterSpan: 0.45 });

  return {
    group: root,
    stats: {
      instancedMeshes: instancedMeshesCount,
      totalBotanicalInstances,
    },
    setCanopyShadowsEnabled(enabled: boolean) {
      const next = !isSoftwareGl && enabled;
      if (canopyShadowsEnabled === next) return;
      canopyShadowsEnabled = next;
      for (let i = 0; i < canopyShadowProxies.length; i++) {
        canopyShadowProxies[i].castShadow = next;
        canopyShadowProxies[i].visible = next;
      }
    },
    update(timeSec: number, nightFactor01 = 0) {
      const safeTime = Number.isFinite(timeSec) ? timeSec : 0;
      const clampedNight = Math.max(0, Math.min(1, Number.isFinite(nightFactor01) ? nightFactor01 : 0));

      // Scroll Fountain Water Cascades & Frothy Splash Ripple Rings
      fountainCascadeTex.offset.y = -((safeTime * 1.15) % 1.0);
      fountainBasinTex.offset.x = (safeTime * 0.042) % 1.0;
      fountainBasinTex.offset.y = (safeTime * 0.031) % 1.0;

      // Subtle vertical breathing on the central frothy water jet plume & ripple pulse
      centralPlumeMesh.scale.set(
        1.0 + Math.sin(safeTime * 6.5) * 0.04,
        1.0 + Math.sin(safeTime * 4.8) * 0.055,
        1.0 + Math.cos(safeTime * 6.5) * 0.04,
      );
      fountainRippleMesh.rotation.y = safeTime * 0.14;
      frothRingMat.opacity = 0.46 + 0.12 * Math.sin(safeTime * 3.4);

      // Animate all `isAnimatedWater` textures & shaders (including Timber Pergola Lily Pond water!)
      for (const tex of animatedWaterTextures) {
        if (tex === fountainBasinTex) continue;
        tex.offset.x = (safeTime * 0.022) % 1.0;
        tex.offset.y = (safeTime * 0.014 + Math.sin(safeTime * 0.42) * 0.025) % 1.0;
      }
      for (const sh of animatedWaterShaders) {
        if (sh.uniforms.uTime) sh.uniforms.uTime.value = safeTime;
      }

      // Dusk / Night Warm Victorian Lantern Glass, Edison Filament Core & Billboard Glow modulation
      const coreState = evaluateLanternCoreAndSpriteState(clampedNight);
      if (lanternGlassMat instanceof THREE.MeshStandardMaterial) {
        lanternGlassMat.emissiveIntensity = coreState.glassEmissiveIntensity;
      }
      if (lanternBulbMat instanceof THREE.MeshStandardMaterial) {
        lanternBulbMat.emissiveIntensity = coreState.bulbEmissiveIntensity;
      }
      if (lanternFilamentMat instanceof THREE.MeshStandardMaterial) {
        lanternFilamentMat.emissiveIntensity = coreState.filamentEmissiveIntensity;
      }
      if (coreState.active) {
        lanternHaloInst.visible = true;
        lanternBillboard.setOpacity(coreState.billboardOpacity);
        lanternBillboard.setTime(safeTime);
      } else {
        lanternHaloInst.visible = false;
        lanternBillboard.setOpacity(0);
      }
    },
    dispose() {
      root.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.geometry) {
          obj.geometry.dispose();
        }
      });
      for (const g of disposableGeos) g.dispose();
      for (const m of disposableMats) m.dispose();
      for (const t of disposableTextures) t.dispose();
    },
  };
}
