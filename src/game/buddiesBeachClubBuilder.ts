import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { BlitzWindUniforms } from './buddiesBlitzShadersAndAssets';
import { computeInstancedBoundingVolumes } from './buddiesHubRenderOptimizer';
import {
  createPbrTimberTextureSet,
  getOrCreatePbrWoodMaterial,
  type PbrTextureTriplet,
} from './buddiesCoastalBeachBuilder';
import {
  BEACH_CLUB_MASTERPLAN,
  type BeachClubOrientedRect,
  type BeachClubRect,
} from './buddiesBeachClubRules';

export interface BuildCoastalBeachClubOptions {
  windUniforms: BlitzWindUniforms;
  isSoftwareGl: boolean;
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

export interface CoastalBeachClubStats {
  meshCount: number;
  instancedBatchCount: number;
  festoonBulbCount: number;
  cabanaCount: number;
  sunkenPodCount: number;
  palmCount: number;
}

export interface CoastalBeachClubHandle {
  group: THREE.Group;
  stats: CoastalBeachClubStats;
  update: (
    timeSec: number,
    weatherEnvState?: { nightFactor01?: number; duskDawnFactor01?: number },
  ) => void;
  dispose: () => void;
}

function makeCanvas2d(w: number, h: number): {
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
} {
  if (typeof document === 'undefined') {
    return { canvas: null, ctx: null };
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d') };
}

function makeFallbackDataTex(
  r: number,
  g: number,
  b: number,
  a = 255,
  colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace,
): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array([r, g, b, a]), 1, 1, THREE.RGBAFormat);
  tex.colorSpace = colorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function finalizeClubTexture(
  canvas: HTMLCanvasElement,
  wrapS: THREE.Wrapping = THREE.RepeatWrapping,
  wrapT: THREE.Wrapping = THREE.RepeatWrapping,
  colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = colorSpace;
  tex.wrapS = wrapS;
  tex.wrapT = wrapT;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function applyBoxMetricUvs(
  geo: THREE.BoxGeometry,
  tileU: number,
  tileV: number,
  swapTopAxes = false,
): THREE.BoxGeometry {
  const pos = geo.getAttribute('position');
  const norm = geo.getAttribute('normal');
  const uv = geo.getAttribute('uv');
  if (!pos || !norm || !uv) return geo;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    if (ny >= nx && ny >= nz) {
      uv.setXY(i, (swapTopAxes ? z : x) / tileU, (swapTopAxes ? x : z) / tileV);
    } else if (nx >= nz) {
      uv.setXY(i, z / tileU, y / tileV);
    } else {
      uv.setXY(i, x / tileU, y / tileV);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * Curved Sinuous Wave-Striped Promenade Texture (Aquamarine #22b8cf + Warm Cream Sandstone #e9dfd1)
 * matching Finns Beach Club masterplan (`view-top`) and twilight aerial photo (`Tangkapan_Layar`).
 */
function createBeachClubWavePromenadeTexture(): THREE.Texture {
  const w = 512;
  const h = 1024;
  const { canvas, ctx } = makeCanvas2d(w, h);
  if (!canvas || !ctx) return makeFallbackDataTex(216, 206, 188);

  const img = ctx.createImageData(w, h);
  const data = img.data;
  for (let py = 0; py < h; py++) {
    const v = py / h;
    for (let px = 0; px < w; px++) {
      const u = px / w;
      const idx = (py * w + px) * 4;
      const wavePhase =
        v * 4.0 * Math.PI * 2.0 +
        Math.sin(u * Math.PI * 2.0) * 1.18 +
        Math.cos(u * Math.PI * 4.0) * 0.22;
      const ribbon = Math.sin(wavePhase);
      const isAqua = ribbon > 0.08;
      const edgeGroove = Math.abs(ribbon - 0.08) < 0.045;

      const noise = ((Math.sin(px * 12.9898 + py * 78.233) * 43758.5453) % 1 + 1) % 1;
      const grain = (noise - 0.5) * 12;

      let r = isAqua ? 52 : 233;
      let g = isAqua ? 186 : 221;
      let b = isAqua ? 202 : 204;

      if (isAqua) {
        const shade = Math.sin(u * Math.PI) * 10;
        r += shade * 0.4;
        g += shade * 0.8;
        b += shade;
      }

      if (edgeGroove) {
        r -= 24;
        g -= 24;
        b -= 22;
      }

      data[idx] = Math.max(0, Math.min(255, Math.round(r + grain)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(g + grain)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(b + grain)));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finalizeClubTexture(canvas, THREE.ClampToEdgeWrapping, THREE.RepeatWrapping);
}

/**
 * Honed Bali Limestone Paving Slab Texture (`#e5dbcb`) for stepped terraces and coping edges.
 */
function createLimestoneDeckTexture(): THREE.Texture {
  const s = 512;
  const { canvas, ctx } = makeCanvas2d(s, s);
  if (!canvas || !ctx) return makeFallbackDataTex(228, 218, 200);

  ctx.fillStyle = '#e5dac7';
  ctx.fillRect(0, 0, s, s);

  const cols = 4;
  const rows = 4;
  const cw = s / cols;
  const ch = s / rows;
  for (let ry = 0; ry < rows; ry++) {
    const offset = (ry % 2) * (cw * 0.5);
    for (let cx = -1; cx <= cols; cx++) {
      const shade = 224 + ((cx * 17 + ry * 31) & 15) - 7;
      ctx.fillStyle = `rgb(${shade}, ${shade - 9}, ${shade - 22})`;
      ctx.fillRect(cx * cw + offset + 2, ry * ch + 2, cw - 4, ch - 4);
    }
  }
  ctx.strokeStyle = 'rgba(130, 114, 92, 0.35)';
  ctx.lineWidth = 3;
  for (let ry = 0; ry < rows; ry++) {
    ctx.beginPath();
    ctx.moveTo(0, ry * ch);
    ctx.lineTo(s, ry * ch);
    ctx.stroke();
  }
  return finalizeClubTexture(canvas, THREE.RepeatWrapping, THREE.RepeatWrapping);
}

/**
 * Dark Volcanic Sukabumi/Slate Pool Tile & Infinity Weir Wall Texture (`#1e3a42`)
 * so cascading infinity edges & wet retaining risers read like high-end Bali stone!
 */
function createVolcanicSlatePoolTexture(): THREE.Texture {
  const s = 256;
  const { canvas, ctx } = makeCanvas2d(s, s);
  if (!canvas || !ctx) return makeFallbackDataTex(30, 62, 72);

  ctx.fillStyle = '#183640';
  ctx.fillRect(0, 0, s, s);
  const cols = 8;
  const rows = 8;
  const cw = s / cols;
  const ch = s / rows;
  for (let ry = 0; ry < rows; ry++) {
    for (let cx = 0; cx < cols; cx++) {
      const jitter = ((cx * 29 + ry * 43) & 15) - 7;
      ctx.fillStyle = `rgb(${22 + jitter}, ${66 + jitter}, ${78 + jitter})`;
      ctx.fillRect(cx * cw + 1, ry * ch + 1, cw - 2, ch - 2);
    }
  }
  return finalizeClubTexture(canvas, THREE.RepeatWrapping, THREE.RepeatWrapping);
}

/**
 * Honed White Calacatta Marble Texture (veined `#f8f6f2` with warm grey/gold veins).
 */
function createCalacattaMarbleTexture(): THREE.Texture {
  const s = 512;
  const { canvas, ctx } = makeCanvas2d(s, s);
  if (!canvas || !ctx) return makeFallbackDataTex(246, 243, 238);

  ctx.fillStyle = '#f8f5ef';
  ctx.fillRect(0, 0, s, s);

  for (let i = 0; i < 16; i++) {
    const gx = (i * 197) % s;
    const gy = (i * 131) % s;
    const grad = ctx.createRadialGradient(gx, gy, 10, gx, gy, 140);
    grad.addColorStop(0, 'rgba(220, 214, 204, 0.25)');
    grad.addColorStop(1, 'rgba(248, 245, 239, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
  }

  for (let v = 0; v < 14; v++) {
    ctx.beginPath();
    let x = (v * 67) % s;
    let y = 0;
    ctx.moveTo(x, y);
    for (let step = 1; step <= 16; step++) {
      y = (step / 16) * s;
      x += Math.sin(step * 0.9 + v * 1.7) * 26 + 11;
      ctx.lineTo(x % s, y);
    }
    ctx.strokeStyle = v % 3 === 0 ? 'rgba(186, 158, 108, 0.34)' : 'rgba(155, 150, 142, 0.38)';
    ctx.lineWidth = v % 4 === 0 ? 3.2 : 1.4;
    ctx.stroke();
  }
  return finalizeClubTexture(canvas, THREE.RepeatWrapping, THREE.RepeatWrapping);
}

/**
 * Fluted White Architectural Stone with Vertical Brushed Brass Inlay Texture (Cocktail Bar — ZERO WOOD).
 */
function createFlutedStoneBrassTexture(): THREE.Texture {
  const w = 512;
  const h = 256;
  const { canvas, ctx } = makeCanvas2d(w, h);
  if (!canvas || !ctx) return makeFallbackDataTex(242, 240, 235);

  const fluteCount = 32;
  const fw = w / fluteCount;
  for (let i = 0; i < fluteCount; i++) {
    const x0 = i * fw;
    const isBrassStrip = i % 4 === 0;
    const grad = ctx.createLinearGradient(x0, 0, x0 + fw, 0);
    if (isBrassStrip) {
      grad.addColorStop(0, '#c29b50');
      grad.addColorStop(0.5, '#e8cd8b');
      grad.addColorStop(1, '#a8823c');
    } else {
      grad.addColorStop(0, '#dcd8cf');
      grad.addColorStop(0.48, '#f7f5f0');
      grad.addColorStop(1, '#d4d0c7');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(x0, 0, fw + 0.5, h);
  }
  return finalizeClubTexture(canvas, THREE.RepeatWrapping, THREE.ClampToEdgeWrapping);
}

/**
 * Polished Ivory Terrazzo with Brushed Brass Inlay Rings (Cocktail Bar terrace pad — ZERO WOOD).
 */
function createIvoryTerrazzoBrassInlayTexture(): THREE.Texture {
  const s = 512;
  const { canvas, ctx } = makeCanvas2d(s, s);
  if (!canvas || !ctx) return makeFallbackDataTex(244, 239, 230);

  ctx.fillStyle = '#f3ede2';
  ctx.fillRect(0, 0, s, s);

  const chipColors = ['#d8cdbc', '#c8b99f', '#b8ab9a', '#d7b46a', '#e6dfd3'];
  for (let i = 0; i < 420; i++) {
    const cx = (i * 193 + 37) % s;
    const cy = (i * 277 + 83) % s;
    const r = 1.2 + (i % 4) * 0.9;
    ctx.fillStyle = chipColors[i % chipColors.length];
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = '#caa256';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.5, s * 0.45, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.5, s * 0.34, 0, Math.PI * 2);
  ctx.stroke();

  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(s * 0.5 + Math.cos(ang) * s * 0.34, s * 0.5 + Math.sin(ang) * s * 0.34);
    ctx.lineTo(s * 0.5 + Math.cos(ang) * s * 0.45, s * 0.5 + Math.sin(ang) * s * 0.45);
    ctx.stroke();
  }
  return finalizeClubTexture(canvas, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping);
}

/**
 * Woven Balinese Grass/Thatch Parasol Canopy Texture (`#cbb07a`).
 */
function createWovenParasolTexture(): THREE.Texture {
  const s = 256;
  const { canvas, ctx } = makeCanvas2d(s, s);
  if (!canvas || !ctx) return makeFallbackDataTex(204, 176, 122);

  ctx.fillStyle = '#ccb07a';
  ctx.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 6) {
    ctx.fillStyle = y % 12 === 0 ? 'rgba(150, 120, 72, 0.36)' : 'rgba(232, 212, 166, 0.28)';
    ctx.fillRect(0, y, s, 3);
  }
  for (let x = 0; x < s; x += 8) {
    ctx.fillStyle = 'rgba(128, 98, 56, 0.16)';
    ctx.fillRect(x, 0, 2, s);
  }
  return finalizeClubTexture(canvas, THREE.RepeatWrapping, THREE.RepeatWrapping);
}

/**
 * Soft Radial Warm Amber Glow Texture (`128x128`) for festoon bulb & pod table lantern halos.
 */
function createWarmGlowSpriteTexture(): THREE.Texture {
  const s = 128;
  const { canvas, ctx } = makeCanvas2d(s, s);
  if (!canvas || !ctx) return makeFallbackDataTex(255, 206, 118, 180);

  const grad = ctx.createRadialGradient(s * 0.5, s * 0.5, 2, s * 0.5, s * 0.5, s * 0.5);
  grad.addColorStop(0.0, 'rgba(255, 248, 215, 1.0)');
  grad.addColorStop(0.28, 'rgba(255, 206, 112, 0.72)');
  grad.addColorStop(0.62, 'rgba(255, 164, 62, 0.22)');
  grad.addColorStop(1.0, 'rgba(255, 140, 40, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  return finalizeClubTexture(canvas, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping);
}

/**
 * Kai Fish 1:1 Pinnate Palm Frond Alpha-Cutout Mask Texture (`512x512`).
 */
function createKaiPalmFrondAlphaMaskTexture(): THREE.Texture {
  const { canvas, ctx } = makeCanvas2d(512, 512);
  if (!canvas || !ctx) return makeFallbackDataTex(255, 180, 0, 255, THREE.NoColorSpace);

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 512, 512);

  const pairs = 38;
  for (let i = 0; i < pairs; i++) {
    const t = i / (pairs - 1);
    const yBase = 492 - t * 458;
    const spanEnv = Math.sin(Math.pow(t, 0.78) * Math.PI * 0.94);
    const leafletSpanX = 28 + spanEnv * 206;
    const leafletSweepY = 18 + spanEnv * 46 + t * 22;
    const halfThick = 4.8 * (1.0 - t * 0.42);

    for (const side of [-1, 1] as const) {
      const x0 = 256 + side * 4 * (1.0 - t * 0.65);
      const y0 = yBase + (side < 0 ? 0 : -3);
      const xTip = 256 + side * leafletSpanX;
      const yTip = y0 - leafletSweepY;
      const cx = 256 + side * leafletSpanX * 0.54;
      const cy = y0 - leafletSweepY * 0.68;

      ctx.fillStyle = 'rgb(255, 90, 0)';
      ctx.beginPath();
      ctx.moveTo(x0, y0 - halfThick);
      ctx.quadraticCurveTo(cx, cy - halfThick * 0.85, xTip, yTip);
      ctx.quadraticCurveTo(cx, cy + halfThick * 0.75, x0, y0 + halfThick);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgb(255, 220, 0)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(cx, cy, xTip, yTip);
      ctx.stroke();
    }
  }

  ctx.fillStyle = 'rgb(255, 210, 0)';
  ctx.beginPath();
  ctx.moveTo(252, 42);
  ctx.quadraticCurveTo(256, 18, 256, 6);
  ctx.quadraticCurveTo(256, 18, 260, 42);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgb(255, 255, 0)';
  ctx.beginPath();
  ctx.moveTo(248, 512);
  ctx.lineTo(254.5, 16);
  ctx.lineTo(257.5, 16);
  ctx.lineTo(264, 512);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Kai Fish 1:1 Organic Ringed Coconut Palm Bark Texture (`256x512`).
 */
function createKaiPalmTrunkBarkTexture(): THREE.Texture {
  const { canvas, ctx } = makeCanvas2d(256, 512);
  if (!canvas || !ctx) return makeFallbackDataTex(159, 117, 80);

  ctx.fillStyle = '#9f7550';
  ctx.fillRect(0, 0, 256, 512);
  const ringTones: readonly [string, string, string, string][] = [
    ['#cba178', '#b0845c', '#8e6442', '#614129'],
    ['#be946b', '#a37750', '#835a3b', '#593b25'],
    ['#d2a97f', '#b78b62', '#956a47', '#66452c'],
    ['#c3986e', '#a97d56', '#885f3e', '#5d3e27'],
  ];
  const ringCount = 20;
  const ringH = 512 / ringCount;
  for (let r = 0; r < ringCount; r++) {
    const y = r * ringH;
    const [colHighlight, colMid, colLower, colCrevice] = ringTones[r % ringTones.length];
    const grad = ctx.createLinearGradient(0, y, 0, y + ringH);
    grad.addColorStop(0.0, colHighlight);
    grad.addColorStop(0.24, colMid);
    grad.addColorStop(0.68, colLower);
    grad.addColorStop(0.88, colCrevice);
    grad.addColorStop(1.0, colHighlight);
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, 256, ringH);

    ctx.fillStyle = 'rgba(248, 218, 182, 0.24)';
    ctx.fillRect(0, y + 1.5, 256, 3.0);

    ctx.fillStyle = 'rgba(66, 42, 24, 0.56)';
    ctx.fillRect(0, y + ringH - 3.2, 256, 2.6);
  }
  for (let x = 3; x < 256; x += 8) {
    ctx.fillStyle = x % 16 === 3 ? 'rgba(68, 44, 26, 0.14)' : 'rgba(245, 214, 178, 0.10)';
    ctx.fillRect(x, 0, 2, 512);
  }
  return finalizeClubTexture(canvas, THREE.RepeatWrapping, THREE.RepeatWrapping);
}

/**
 * Kai Fish 1:1 24-Ring Curved Ringed Palm Trunk, Crownshaft Collar & 5 Coconuts + 16-Frond 3D V-Section Pinnate Palm Crown.
 */
function buildCoconutPalmGeometries(): {
  trunkGeo: THREE.BufferGeometry;
  collarAndNutsGeo: THREE.BufferGeometry;
  frondsGeo: THREE.BufferGeometry;
  topY: number;
  topZ: number;
} {
  const rings = 24;
  const radialSegs = 12;
  const vertCount = (rings + 1) * (radialSegs + 1);
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const colors = new Float32Array(vertCount * 3);
  const indices: number[] = [];

  let curY = 0;
  let curZ = 0;
  const totalH = 5.15;
  const stepH = totalH / rings;
  const smooth01 = (e0: number, e1: number, x: number) => {
    const u = Math.max(0, Math.min(1, (x - e0) / Math.max(1e-5, e1 - e0)));
    return u * u * (3 - 2 * u);
  };

  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const tilt = 0.07 + t * 0.17;
    const baseFlare = Math.pow(1.0 - t, 3.0) * 0.09;
    const ringSwell = (r % 2 === 0 ? 0.015 : -0.008) * (1.0 - t * 0.25);
    const radius = 0.28 * (1.0 - t * 0.42) + baseFlare + ringSwell;

    const rootAo = 0.88 + 0.12 * smooth01(0.0, 0.09, t);
    const midSun = Math.sin(Math.max(0, Math.min(1, (t - 0.04) / 0.62)) * Math.PI) * 0.14;
    const canopyAo = smooth01(0.6, 0.96, t);
    const ringToneMod = r % 2 === 0 ? 1.04 : 0.94;

    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);

    for (let s = 0; s <= radialSegs; s++) {
      const u = s / radialSegs;
      const theta = u * Math.PI * 2;
      const cx = Math.cos(theta) * radius;
      const cz = Math.sin(theta) * radius;

      const wx = cx;
      const wy = curY - cz * sinT;
      const wz = curZ + cz * cosT;

      const idx = r * (radialSegs + 1) + s;
      positions[idx * 3] = wx;
      positions[idx * 3 + 1] = wy;
      positions[idx * 3 + 2] = wz;

      const ringSlopeNy = (r % 2 === 0 ? 0.14 : -0.14) * (1.0 - t * 0.3);
      const rawNx = Math.cos(theta);
      const rawNy = -Math.sin(theta) * sinT + ringSlopeNy;
      const rawNz = Math.sin(theta) * cosT;
      const nLen = Math.hypot(rawNx, rawNy, rawNz) || 1;
      normals[idx * 3] = rawNx / nLen;
      normals[idx * 3 + 1] = rawNy / nLen;
      normals[idx * 3 + 2] = rawNz / nLen;

      uvs[idx * 2] = u * 2.0;
      uvs[idx * 2 + 1] = t * 3.5;

      const baseShade = rootAo * (1.0 + midSun) * ringToneMod;
      colors[idx * 3] = Math.max(0.36, baseShade * (1.06 - canopyAo * 0.54));
      colors[idx * 3 + 1] = Math.max(0.3, baseShade * (1.01 - canopyAo * 0.58));
      colors[idx * 3 + 2] = Math.max(0.26, baseShade * (0.94 - canopyAo * 0.6));
    }

    if (r < rings) {
      curY += Math.cos(tilt) * stepH;
      curZ += Math.sin(tilt) * stepH;
    }
  }

  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < radialSegs; s++) {
      const i0 = r * (radialSegs + 1) + s;
      const i1 = i0 + 1;
      const i2 = (r + 1) * (radialSegs + 1) + s;
      const i3 = i2 + 1;
      indices.push(i0, i2, i1);
      indices.push(i1, i2, i3);
    }
  }

  const trunkGeo = new THREE.BufferGeometry();
  trunkGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  trunkGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  trunkGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  trunkGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  trunkGeo.setIndex(indices);
  trunkGeo.userData.__hasCanopyAoVCol = true;

  // Collar + 5 Coconuts merged at (topY, topZ)
  const collarParts: THREE.BufferGeometry[] = [];
  const collarGeo = new THREE.CylinderGeometry(0.22, 0.17, 0.42, 8).toNonIndexed();
  collarGeo.rotateX(0.22);
  collarGeo.translate(0, curY + 0.06, curZ + 0.02);
  collarParts.push(collarGeo);
  for (let c = 0; c < 5; c++) {
    const cAng = (c * Math.PI * 2) / 5;
    const nutGeo = new THREE.SphereGeometry(0.17, 8, 8).toNonIndexed();
    nutGeo.translate(Math.cos(cAng) * 0.21, curY - 0.08, curZ + Math.sin(cAng) * 0.21);
    collarParts.push(nutGeo);
  }
  const collarAndNutsGeo = mergeGeometries(collarParts, false);
  collarParts.forEach((g) => g.dispose());

  // 16 Arching 3D V-Section Pinnate Palm Fronds centered at (0, curY + 0.14, curZ)
  const buildSingleFrondGeo = (
    length: number,
    maxWidth: number,
    riseAngle: number,
    droopDrop: number,
    vFoldHeight: number,
    yaw: number,
    roll: number,
    yOffset: number,
  ): THREE.BufferGeometry => {
    const segsL = 10;
    const colsW = 3;
    const fVertCount = (segsL + 1) * colsW;
    const fPositions = new Float32Array(fVertCount * 3);
    const fNormals = new Float32Array(fVertCount * 3);
    const fUvs = new Float32Array(fVertCount * 2);
    const fIndices: number[] = [];

    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const cosR = Math.cos(roll);
    const sinR = Math.sin(roll);

    for (let i = 0; i <= segsL; i++) {
      const v = i / segsL;
      const zLocal = v * length;
      const yArch =
        yOffset +
        Math.sin(v * Math.PI * 0.62) * Math.sin(riseAngle) * length * 0.52 -
        Math.pow(v, 2.25) * droopDrop;
      const widthEnv = Math.sin(Math.pow(v, 0.72) * Math.PI * 0.92) * 0.85 + 0.15;
      const halfW = maxWidth * 0.5 * widthEnv;
      const foldH = vFoldHeight * Math.sin(v * Math.PI * 0.88);

      for (let c = 0; c < colsW; c++) {
        const u = c / (colsW - 1);
        const sideX = (u - 0.5) * 2.0 * halfW;
        const ridgeY = c === 1 ? foldH : -foldH * 0.35;

        const rx = sideX * cosR - ridgeY * sinR;
        const ry = sideX * sinR + ridgeY * cosR + yArch;
        const rz = zLocal;

        const wx = rx * cosY + rz * sinY;
        const wy = curY + 0.14 + ry;
        const wz = curZ - rx * sinY + rz * cosY;

        const idx = i * colsW + c;
        fPositions[idx * 3] = wx;
        fPositions[idx * 3 + 1] = wy;
        fPositions[idx * 3 + 2] = wz;

        const domeNx = wx * 0.55 + (u - 0.5) * 0.95 * cosY;
        const domeNy = 0.52 - v * 0.88 + (c === 1 ? 0.22 : -0.14);
        const domeNz = (wz - curZ) * 0.55 - (u - 0.5) * 0.95 * sinY;
        const nLen = Math.hypot(domeNx, domeNy, domeNz) || 1;
        fNormals[idx * 3] = domeNx / nLen;
        fNormals[idx * 3 + 1] = domeNy / nLen;
        fNormals[idx * 3 + 2] = domeNz / nLen;

        fUvs[idx * 2] = u;
        fUvs[idx * 2 + 1] = v;
      }
    }

    for (let i = 0; i < segsL; i++) {
      const r0 = i * colsW;
      const r1 = (i + 1) * colsW;
      fIndices.push(r0, r1, r0 + 1);
      fIndices.push(r0 + 1, r1, r1 + 1);
      fIndices.push(r0 + 1, r1 + 1, r0 + 2);
      fIndices.push(r0 + 2, r1 + 1, r1 + 2);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(fPositions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(fNormals, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(fUvs, 2));
    geo.setIndex(fIndices);
    return geo.toNonIndexed();
  };

  const frondGeos: THREE.BufferGeometry[] = [];
  for (let f = 0; f < 6; f++) {
    const yaw = (f * Math.PI * 2) / 6 + 0.18;
    frondGeos.push(
      buildSingleFrondGeo(3.25, 1.48, 0.42, 1.38, 0.22, yaw, (f % 2 === 0 ? 1 : -1) * 0.16, -0.05),
    );
  }
  for (let f = 0; f < 6; f++) {
    const yaw = ((f + 0.5) * Math.PI * 2) / 6;
    frondGeos.push(
      buildSingleFrondGeo(3.05, 1.42, 0.72, 0.88, 0.24, yaw, (f % 2 === 0 ? -1 : 1) * 0.12, 0.12),
    );
  }
  for (let f = 0; f < 4; f++) {
    const yaw = (f * Math.PI * 2) / 4 + 0.42;
    frondGeos.push(buildSingleFrondGeo(2.35, 1.18, 1.08, 0.34, 0.2, yaw, 0.08, 0.26));
  }
  const frondsGeo = mergeGeometries(frondGeos, false);
  frondGeos.forEach((g) => g.dispose());

  return { trunkGeo, collarAndNutsGeo, frondsGeo, topY: curY, topZ: curZ };
}

/**
 * Glowing Cyan-Turquoise Infinity Pool Water ShaderMaterial matching `Tangkapan_Layar` twilight pools.
 */
function createBeachClubPoolShaderMaterial(
  windUniforms: BlitzWindUniforms,
): {
  material: THREE.ShaderMaterial;
  uNightGlow: { value: number };
} {
  const uNightGlow = { value: 0.15 };
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
    side: THREE.FrontSide,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: windUniforms.uTime,
      uNightGlow,
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorldPos;
      varying vec2 vUv;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float ripple = sin(wp.x * 2.1 + uTime * 2.2) * cos(wp.z * 2.3 - uTime * 1.9) * 0.008;
        wp.y += ripple;
        vWorldPos = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uNightGlow;
      varying vec3 vWorldPos;
      varying vec2 vUv;
      #include <fog_pars_fragment>

      void main() {
        float p1 = sin(vWorldPos.x * 1.85 + uTime * 1.2 + cos(vWorldPos.z * 1.45 - uTime * 0.9));
        float p2 = cos(vWorldPos.z * 2.15 - uTime * 1.35 + sin(vWorldPos.x * 1.65 + uTime * 0.8));
        float caustic = smoothstep(0.25, 0.98, (p1 * p2) * 0.5 + 0.5);

        float edgeDist = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
        float rimGlow = 1.0 - smoothstep(0.0, 0.12, edgeDist);

        vec3 dayShallow = vec3(0.07, 0.76, 0.82);
        vec3 dayDeep = vec3(0.03, 0.54, 0.68);
        vec3 baseCol = mix(dayDeep, dayShallow, rimGlow * 0.65 + caustic * 0.35);
        baseCol += vec3(0.14, 0.32, 0.35) * caustic * 0.55;

        vec3 nightPoolGlow = vec3(0.04, 0.88, 0.98) * (0.48 + 0.72 * rimGlow + 0.25 * caustic);
        vec3 finalRgb = mix(baseCol, nightPoolGlow, clamp(uNightGlow, 0.0, 1.0) * 0.88);
        finalRgb += vec3(0.08, 0.95, 1.0) * rimGlow * (0.2 + 0.78 * uNightGlow);

        float alpha = mix(0.76, 0.88, rimGlow * 0.5 + uNightGlow * 0.3);
        gl_FragColor = vec4(finalRgb, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  return { material, uNightGlow };
}

export function buildCoastalBeachClub3D(
  options: BuildCoastalBeachClubOptions,
): CoastalBeachClubHandle {
  const {
    windUniforms,
    isSoftwareGl,
    upgradeMeshToBlitzWorldMaterial,
    createBlitzStrokeMesh,
    bakeStaticGroupMeshes,
  } = options;

  const mp = BEACH_CLUB_MASTERPLAN;
  const rootGroup = new THREE.Group();
  rootGroup.name = 'EastCoastalBeachClub3D';

  const staticClubGroup = new THREE.Group();
  staticClubGroup.name = 'EastCoastalBeachClubStaticGroup';
  rootGroup.add(staticClubGroup);

  const dynamicClubGroup = new THREE.Group();
  dynamicClubGroup.name = 'EastCoastalBeachClubDynamicGroup';
  rootGroup.add(dynamicClubGroup);

  const disposableGeometries: THREE.BufferGeometry[] = [];
  const disposableMaterials: THREE.Material[] = [];
  const disposableTextures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposableGeometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposableMaterials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    disposableTextures.push(t);
    return t;
  };

  // Procedural Surface Textures
  const wavePromTex = trackTex(createBeachClubWavePromenadeTexture());
  const limestoneTex = trackTex(createLimestoneDeckTexture());
  const volcanicSlateTex = trackTex(createVolcanicSlatePoolTexture());
  const calacattaTex = trackTex(createCalacattaMarbleTexture());
  const flutedStoneTex = trackTex(createFlutedStoneBrassTexture());
  const terrazzoInlayTex = trackTex(createIvoryTerrazzoBrassInlayTexture());
  const wovenParasolTex = trackTex(createWovenParasolTexture());
  const warmGlowSpriteTex = trackTex(createWarmGlowSpriteTexture());

  // PBR Timber (strictly for DJ Stage deck/roof, Bridges, Sunbed Peninsula & North Pergola — NEVER Cocktail Bar!)
  const oakPbr: PbrTextureTriplet = createPbrTimberTextureSet('coastal_oak');
  const cedarPbr: PbrTextureTriplet = createPbrTimberTextureSet('cabin_cedar');
  disposableTextures.push(
    oakPbr.map,
    oakPbr.bumpMap,
    oakPbr.roughnessMap,
    cedarPbr.map,
    cedarPbr.bumpMap,
    cedarPbr.roughnessMap,
  );
  const pbrWoodCache = new Map<string, THREE.MeshStandardMaterial>();
  const getWoodMat = (
    variant: 'oak' | 'cedar',
    colorHex = '#ffffff',
    roughness = 0.8,
  ): THREE.MeshStandardMaterial => {
    const mat = getOrCreatePbrWoodMaterial(pbrWoodCache, {
      colorHex,
      textures: variant === 'oak' ? oakPbr : cedarPbr,
      roughness,
      bumpScale: 0.028,
      metalness: 0.02,
    });
    if (!disposableMaterials.includes(mat)) {
      disposableMaterials.push(mat);
    }
    return mat;
  };

  // Shared Night-Scalable Architectural Materials
  const poolCyanLedMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#67e8f9',
      emissive: new THREE.Color('#00e5ff'),
      emissiveIntensity: 0.35,
      roughness: 0.25,
    }),
  );
  const warmAmberGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#fde68a',
      emissive: new THREE.Color('#ffb347'),
      emissiveIntensity: 0.45,
      roughness: 0.2,
    }),
  );
  const djPurpleWashMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#a855f7',
      emissive: new THREE.Color('#9333ea'),
      emissiveIntensity: 0.45,
      roughness: 0.35,
    }),
  );
  const aquaBoxGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: '#7dd3fc',
      emissive: new THREE.Color('#06b6d4'),
      emissiveIntensity: 0.25,
      roughness: 0.14,
      metalness: 0.08,
      transparent: true,
      opacity: isSoftwareGl ? 0.52 : 0.46,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const barTintedGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: '#a5f3fc',
      roughness: 0.12,
      metalness: 0.12,
      transparent: true,
      opacity: isSoftwareGl ? 0.44 : 0.38,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const brushedBrassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#d4af68',
      roughness: 0.26,
      metalness: 0.88,
    }),
  );
  const stainlessSteelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      roughness: 0.24,
      metalness: 0.9,
    }),
  );
  const blackSteelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#1e242c',
      roughness: 0.38,
      metalness: 0.72,
    }),
  );
  const skylightPanelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#a5f3fc',
      emissive: new THREE.Color('#22d3ee'),
      emissiveIntensity: 0.22,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.82,
    }),
  );
  const waterfallCurtainMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#67e8f9',
      emissive: new THREE.Color('#06b6d4'),
      emissiveIntensity: 0.4,
      roughness: 0.15,
      transparent: true,
      opacity: 0.74,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const purpleBeamMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: '#c084fc',
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const warmHaloSpriteMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: warmGlowSpriteTex,
      color: '#ffcf78',
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const { material: poolWaterMat, uNightGlow: poolNightUniform } =
    createBeachClubPoolShaderMaterial(windUniforms);
  trackMat(poolWaterMat);

  let meshCount = 0;

  const addWorldPart = (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    colorHex: string,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
    opts?: {
      tex?: THREE.Texture;
      strokeW?: number;
      castShadow?: boolean;
      receiveShadow?: boolean;
      bounceStrength?: number;
    },
  ): THREE.Mesh => {
    trackGeo(geo);
    const baseMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: colorHex,
        map: opts?.tex ?? null,
        roughness: 0.82,
      }),
    );
    const mesh = new THREE.Mesh(geo, baseMat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.rotation.set(rot[0], rot[1], rot[2]);
    mesh.castShadow = !isSoftwareGl && (opts?.castShadow ?? false);
    mesh.receiveShadow = !isSoftwareGl && (opts?.receiveShadow ?? true);
    upgradeMeshToBlitzWorldMaterial(
      mesh,
      windUniforms,
      colorHex,
      opts?.bounceStrength ?? 0.25,
    );
    if (opts?.strokeW && opts.strokeW > 0) {
      const sMesh = createBlitzStrokeMesh(geo, opts.strokeW, '#3b2f27');
      if (sMesh) mesh.add(sMesh);
    }
    parent.add(mesh);
    meshCount++;
    return mesh;
  };

  const addCustomMatPart = (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
    opts?: { castShadow?: boolean; receiveShadow?: boolean; renderOrder?: number },
  ): THREE.Mesh => {
    trackGeo(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.rotation.set(rot[0], rot[1], rot[2]);
    mesh.castShadow = !isSoftwareGl && (opts?.castShadow ?? false);
    mesh.receiveShadow = !isSoftwareGl && (opts?.receiveShadow ?? true);
    if (opts?.renderOrder !== undefined) {
      mesh.renderOrder = opts.renderOrder;
    }
    parent.add(mesh);
    meshCount++;
    return mesh;
  };

  // ============================================================================
  // 1. GROUND-LEVEL WAVE-STRIPED PALM PROMENADE (+0.02m flush with roadside ground 0.0m)
  // ============================================================================
  const prom = mp.promenade;
  const promW = prom.maxX - prom.minX;
  const promL = prom.maxZ - prom.minZ;
  const promCx = (prom.minX + prom.maxX) * 0.5;
  const promCz = (prom.minZ + prom.maxZ) * 0.5;
  const promSlabH = 0.14;
  const promGeo = new THREE.BoxGeometry(promW, promSlabH, promL);
  const promUv = promGeo.getAttribute('uv');
  const promNorm = promGeo.getAttribute('normal');
  const promPos = promGeo.getAttribute('position');
  if (promUv && promNorm && promPos) {
    for (let i = 0; i < promPos.count; i++) {
      if (Math.abs(promNorm.getY(i)) > 0.75) {
        promUv.setXY(
          i,
          (promPos.getX(i) + promW * 0.5) / promW,
          (promPos.getZ(i) + promL * 0.5) / 14.0,
        );
      }
    }
    promUv.needsUpdate = true;
  }
  addWorldPart(
    staticClubGroup,
    promGeo,
    '#ffffff',
    [promCx, prom.elevY - promSlabH * 0.5, promCz],
    [0, 0, 0],
    {
      tex: wavePromTex,
      receiveShadow: true,
      bounceStrength: 0.2,
    },
  );

  // Subtle flush cream sandstone border curbstones framing Ground-Level Promenade (+0.02m -> +0.05m)
  addWorldPart(
    staticClubGroup,
    applyBoxMetricUvs(new THREE.BoxGeometry(0.28, 0.08, promL), 2.5, 2.5),
    '#efe7da',
    [prom.minX + 0.14, prom.elevY - 0.01, promCz],
    [0, 0, 0],
    { tex: limestoneTex, strokeW: 0.01 },
  );
  addWorldPart(
    staticClubGroup,
    applyBoxMetricUvs(new THREE.BoxGeometry(0.28, 0.08, promL), 2.5, 2.5),
    '#efe7da',
    [prom.maxX - 0.14, prom.elevY - 0.01, promCz],
    [0, 0, 0],
    { tex: limestoneTex, strokeW: 0.01 },
  );

  // ============================================================================
  // 2. SOLID STEPPED TERRACE PLINTHS & RETAINING RISERS (Eliminates "tambak udang" flat ground!)
  //    Each tier is a complete solid architectural podium stepping down Land -> Sea & North -> South:
  //    - North Crown (+1.36m) -> Terrace 2 (+1.06m) -> Terrace 3 (+0.78m)
  //    - VIP Mezzanine (+0.64m) -> Mid Lagoon (+0.44m/+0.42m) -> Oceanfront Lagoon (+0.28m/+0.26m)
  // ============================================================================
  const buildSolidTerraceTierSlab = (
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    topY: number,
    baseY = -2.15,
  ) => {
    const w = maxX - minX;
    const d = maxZ - minZ;
    const h = topY - baseY;
    const cx = (minX + maxX) * 0.5;
    const cz = (minZ + maxZ) * 0.5;
    // Limestone terrace deck surface
    addWorldPart(
      staticClubGroup,
      applyBoxMetricUvs(new THREE.BoxGeometry(w, 0.14, d), 2.8, 2.8),
      '#ebe2d3',
      [cx, topY - 0.07, cz],
      [0, 0, 0],
      { tex: limestoneTex, receiveShadow: true, bounceStrength: 0.18 },
    );
    // Warm sandstone retaining apron underneath so stepped edges never show dark cracks or floating lips!
    if (h > 0.14) {
      addWorldPart(
        staticClubGroup,
        applyBoxMetricUvs(new THREE.BoxGeometry(w - 0.04, h - 0.14, d - 0.04), 2.2, 1.4),
        '#d8ccb8',
        [cx, baseY + (h - 0.14) * 0.5, cz],
        [0, 0, 0],
        { tex: limestoneTex, receiveShadow: true, bounceStrength: 0.12 },
      );
    }
  };

  // Solid flank platforms framing the North Cascade Tiers (West upper walkway & East lowered planter wing)
  buildSolidTerraceTierSlab(91.2, 99.6, -96.2, -89.0, 0.82, -1.65);
  buildSolidTerraceTierSlab(91.2, 99.6, -89.0, -77.4, 0.64, -1.65);
  buildSolidTerraceTierSlab(119.6, 121.0, -96.2, -77.4, -0.22);

  // Solid VIP Cabana Mezzanine Deck (+0.64m continuous platform from Promenade to West Moat!)
  buildSolidTerraceTierSlab(91.2, 96.4, -77.4, 45.2, 0.64, -1.65);
  buildSolidTerraceTierSlab(96.4, 99.6, -77.4, -74.2, 0.64, -1.65); // North-West moat cap
  buildSolidTerraceTierSlab(96.4, 99.6, -17.2, 7.4, 0.64, -1.65); // Center West VIP entrance mezzanine deck

  // North-Central Crosswalk / Promenade Spine at z = -76.2 (transitioning Cascade 3 -> Lowered Mid Lagoon at -0.56m / -0.96m)
  buildSolidTerraceTierSlab(99.6, 112.0, -78.2, -74.8, -0.56);
  buildSolidTerraceTierSlab(112.0, 120.8, -78.2, -74.8, -0.96);
  // Central Crosswalk Spine at z = -17.6 .. -11.2 (DJ Rear Terrace -0.56m stepping via stair_mid_ocean_n to -0.96m East Terrace)
  buildSolidTerraceTierSlab(99.6, 110.8, -17.6, -11.2, -0.56);
  buildSolidTerraceTierSlab(112.4, 120.8, -17.6, -11.2, -0.96);
  // South Inner Lounge Terrace (-0.56m, x in [96.4..105.2]) stepping via stair_mid_ocean_s (x in [105.2..106.4]) to South Oceanfront Pool Deck (-1.00m)
  buildSolidTerraceTierSlab(96.4, 105.2, 7.4, 45.2, -0.56);
  buildSolidTerraceTierSlab(106.4, 121.4, 42.6, 45.2, -1.0); // South-end perimeter terrace joining Kai's -1.00m Upper Beach Terrace!

  // ============================================================================
  // 3. BROAD CASCADING LIMESTONE & TIMBER STAIRWAYS CONNECTING EVERY TIER ("Bertangga-tangga")
  // ============================================================================
  for (const sf of mp.stairFlights) {
    const w = sf.maxX - sf.minX;
    const d = sf.maxZ - sf.minZ;
    const cx = (sf.minX + sf.maxX) * 0.5;
    const cz = (sf.minZ + sf.maxZ) * 0.5;
    const nSteps = Math.max(2, sf.steps);

    for (let s = 0; s < nSteps; s++) {
      const frac0 = s / nSteps;
      const frac1 = (s + 1) / nSteps;
      const topY = sf.fromElevY + (sf.toElevY - sf.fromElevY) * ((frac0 + frac1) * 0.5);
      const minElev = Math.min(sf.fromElevY, sf.toElevY) - 0.12;
      const treadH = Math.max(0.14, topY - minElev);
      const stepCenterY = topY - treadH * 0.5;

      if (sf.axis === 'x') {
        const stepW = w / nSteps;
        const sx = sf.minX + (s + 0.5) * stepW;
        addWorldPart(
          staticClubGroup,
          applyBoxMetricUvs(new THREE.BoxGeometry(stepW + 0.06, treadH, d), 2.0, 2.0),
          s % 2 === 0 ? '#efe7da' : '#e5dac7',
          [sx, stepCenterY, cz],
          [0, 0, 0],
          { tex: limestoneTex, strokeW: 0.01, receiveShadow: true },
        );
      } else {
        const stepD = d / nSteps;
        const sz = sf.minZ + (s + 0.5) * stepD;
        addWorldPart(
          staticClubGroup,
          applyBoxMetricUvs(new THREE.BoxGeometry(w, treadH, stepD + 0.06), 2.0, 2.0),
          s % 2 === 0 ? '#efe7da' : '#e5dac7',
          [cx, stepCenterY, sz],
          [0, 0, 0],
          { tex: limestoneTex, strokeW: 0.01, receiveShadow: true },
        );
      }
    }
  }

  // Lush Stepped Tropical Foliage Planter Borders separating Promenade -> VIP Mezzanine -> Pools
  const foliageLeafMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#348e3a',
      roughness: 0.85,
    }),
  );
  for (const [px, py, pz, pw, pd] of [
    [91.4, 0.78, -81.0, 0.65, 22.0],
    [91.4, 0.78, -39.0, 0.65, 36.0],
    [91.4, 0.78, 8.5, 0.65, 35.0],
    [99.8, -0.48, -32.0, 0.55, 22.0],
  ] as const) {
    addWorldPart(
      staticClubGroup,
      applyBoxMetricUvs(new THREE.BoxGeometry(pw, 0.34, pd), 1.8, 1.8),
      '#e2d8c7',
      [px, py - 0.04, pz],
      [0, 0, 0],
      { tex: limestoneTex, strokeW: 0.01 },
    );
    addCustomMatPart(
      staticClubGroup,
      new RoundedBoxGeometry(pw * 0.86, 0.42, pd - 0.3, 2, 0.14),
      foliageLeafMat,
      [px, py + 0.24, pz],
    );
  }

  // ============================================================================
  // 4. KNIFE-EDGE INFINITY BASINS, CASCADING WATERFALL WEIRS & GLOWING POOLS
  //    Notice: Flush sleek coping (`+0.02m` above water!) + Dark volcanic slate weir walls
  //    so pools look like luxury Bali infinity lagoons, NEVER mud-dike shrimp ponds!
  // ============================================================================
  const buildInfinityPoolBasin = (
    rect: { minX: number; maxX: number; minZ: number; maxZ: number } | BeachClubOrientedRect,
    waterY: number,
    floorY: number,
    options?: {
      isOriented?: boolean;
      eastInfinityWeir?: boolean; // Knife-edge overflow waterfall along ocean-facing East side!
      eastWeirBaseY?: number; // Lowered terrace / beach sand base elevation below the East infinity weir
      southInfinityWeir?: boolean; // Knife-edge overflow waterfall along South cascade step!
      copingMarginY?: number;
    },
  ) => {
    const isOriented = options?.isOriented ?? false;
    const cx = isOriented
      ? (rect as BeachClubOrientedRect).cx
      : ((rect as BeachClubRect).minX + (rect as BeachClubRect).maxX) * 0.5;
    const cz = isOriented
      ? (rect as BeachClubOrientedRect).cz
      : ((rect as BeachClubRect).minZ + (rect as BeachClubRect).maxZ) * 0.5;
    const w = isOriented
      ? (rect as BeachClubOrientedRect).halfX * 2
      : (rect as BeachClubRect).maxX - (rect as BeachClubRect).minX;
    const d = isOriented
      ? (rect as BeachClubOrientedRect).halfZ * 2
      : (rect as BeachClubRect).maxZ - (rect as BeachClubRect).minZ;
    const rotY = isOriented ? (rect as BeachClubOrientedRect).rotY : 0;
    const copingTopY = waterY + (options?.copingMarginY ?? 0.03);

    const grp = new THREE.Group();
    grp.position.set(cx, 0, cz);
    grp.rotation.y = rotY;
    staticClubGroup.add(grp);

    // 1. Deep volcanic-aqua tiled basin bottom
    addWorldPart(
      grp,
      applyBoxMetricUvs(new THREE.BoxGeometry(w, 0.12, d), 2.4, 2.4),
      '#157f94',
      [0, floorY, 0],
      [0, 0, 0],
      { tex: volcanicSlateTex, receiveShadow: true, bounceStrength: 0.1 },
    );

    const wallH = copingTopY - floorY + 0.18;
    const wallCy = floorY + wallH * 0.5 - 0.18;
    const ledY = waterY - 0.08;
    const copingW = 0.24;

    // North & South edges (South becomes sleek dark-slate infinity waterfall lip if southInfinityWeir)
    for (const sgn of [-1, 1]) {
      const isSouthWeir = sgn === 1 && options?.southInfinityWeir;
      addWorldPart(
        grp,
        applyBoxMetricUvs(
          new THREE.BoxGeometry(w + copingW * 2, isSouthWeir ? wallH - 0.02 : wallH, isSouthWeir ? 0.14 : copingW),
          2.0,
          1.4,
        ),
        isSouthWeir ? '#244652' : '#ebe3d5',
        [0, wallCy, sgn * (d * 0.5 + (isSouthWeir ? 0.05 : copingW * 0.5))],
        [0, 0, 0],
        { tex: isSouthWeir ? volcanicSlateTex : limestoneTex },
      );
      addCustomMatPart(
        grp,
        new THREE.BoxGeometry(w - 0.1, 0.05, 0.05),
        poolCyanLedMat,
        [0, ledY, sgn * (d * 0.5 - 0.03)],
      );
    }

    // West & East edges (East becomes razor-sharp knife-edge oceanfront infinity overflow weir!)
    for (const sgn of [-1, 1]) {
      const isEastWeir = sgn === 1 && options?.eastInfinityWeir;
      const eastBaseY = options?.eastWeirBaseY ?? -2.05;
      const weirDropH = isEastWeir ? Math.max(wallH, waterY - eastBaseY) : wallH;
      const weirCy = isEastWeir ? waterY - weirDropH * 0.5 - 0.01 : wallCy;
      addWorldPart(
        grp,
        applyBoxMetricUvs(
          new THREE.BoxGeometry(isEastWeir ? 0.16 : copingW, weirDropH, d),
          2.0,
          1.4,
        ),
        isEastWeir ? '#1e3f4a' : '#ebe3d5',
        [sgn * (w * 0.5 + (isEastWeir ? 0.06 : copingW * 0.5)), weirCy, 0],
        [0, 0, 0],
        { tex: isEastWeir ? volcanicSlateTex : limestoneTex },
      );
      addCustomMatPart(
        grp,
        new THREE.BoxGeometry(0.05, 0.05, d - 0.1),
        poolCyanLedMat,
        [sgn * (w * 0.5 - 0.03), ledY, 0],
      );
      // Translucent shimmering infinity water overflow sheet cascading down East weir onto next terrace / golden sand!
      const curtainBotY = eastBaseY + 0.05;
      if (isEastWeir && waterY > curtainBotY + 0.08) {
        const curtainH = waterY - curtainBotY;
        addCustomMatPart(
          dynamicClubGroup,
          new THREE.PlaneGeometry(d - 0.2, curtainH),
          waterfallCurtainMat,
          [
            cx + Math.cos(rotY) * (w * 0.5 + 0.15),
            (waterY + curtainBotY) * 0.5,
            cz - Math.sin(rotY) * (w * 0.5 + 0.15),
          ],
          [0, Math.PI / 2 + rotY, 0],
          { renderOrder: 3 },
        );
      }
    }

    // 3. Translucent glowing cyan pool water surface
    const waterGeo = new THREE.PlaneGeometry(
      w + (options?.eastInfinityWeir ? 0.1 : 0),
      d + (options?.southInfinityWeir ? 0.08 : 0),
      Math.max(4, Math.round(w / 2.2)),
      Math.max(4, Math.round(d / 2.2)),
    );
    waterGeo.rotateX(-Math.PI / 2);
    addCustomMatPart(dynamicClubGroup, waterGeo, poolWaterMat, [cx, waterY, cz], [0, rotY, 0], {
      castShadow: false,
      receiveShadow: false,
      renderOrder: 2,
    });
  };

  // A. North 3-Tier Grand Stepped Waterfall Cascade (`+0.32m -> +0.02m -> -0.26m`)
  buildInfinityPoolBasin(mp.pools.cascadeTier1, 0.32, -0.04, {
    southInfinityWeir: true,
    eastInfinityWeir: true,
    eastWeirBaseY: -1.02,
    copingMarginY: 0.02,
  });
  buildInfinityPoolBasin(mp.pools.cascadeTier2, 0.02, -0.34, {
    southInfinityWeir: true,
    eastInfinityWeir: true,
    eastWeirBaseY: -1.02,
    copingMarginY: 0.02,
  });
  buildInfinityPoolBasin(mp.pools.cascadeTier3, -0.26, -0.62, {
    southInfinityWeir: true,
    eastInfinityWeir: true,
    eastWeirBaseY: -1.02,
    copingMarginY: 0.02,
  });

  // Glowing Cascading Spillway Curtains between North Cascade Tiers 1 -> 2 -> 3 -> Lowered Mid Deck (-0.56m)
  for (const [zPos, yTop, yBot] of [
    [-89.35, 0.33, 0.01],
    [-83.75, 0.03, -0.27],
    [-78.15, -0.25, -0.56],
  ] as const) {
    const spillH = yTop - yBot;
    addCustomMatPart(
      dynamicClubGroup,
      new THREE.PlaneGeometry(19.6, spillH),
      waterfallCurtainMat,
      [109.6, yBot + spillH * 0.5, zPos],
      [0.12, 0, 0],
      { renderOrder: 3 },
    );
  }

  // North Arrival Crown Open-Air Timber Pergola Pavilion (`z in [-96.2 .. -94.4]`)
  for (const px of [100.5, 105.0, 109.5, 114.0, 118.5]) {
    addCustomMatPart(
      staticClubGroup,
      new THREE.BoxGeometry(0.22, 3.1, 0.22),
      getWoodMat('cedar', '#9f7046', 0.8),
      [px, 0.36 + 1.55, -95.4],
      [0, 0, 0],
      { castShadow: true },
    );
  }
  addCustomMatPart(
    staticClubGroup,
    applyBoxMetricUvs(new THREE.BoxGeometry(19.8, 0.16, 2.1), 2.2, 2.2),
    getWoodMat('oak', '#b68658', 0.78),
    [109.5, 0.36 + 3.14, -95.4],
    [0, 0, 0],
    { castShadow: true },
  );

  // B. West Upper Reflection Moat beside VIP Cabanas (`waterY = +0.52m`) + Lowered Inner Cascade Lagoon (`waterY = -0.60m`)
  //    + Lowered Seaward Oceanfront Infinity Lagoons (`waterY = -0.98m`, 1.02m waterfall drop onto `-2.00m` beach sand)!
  buildInfinityPoolBasin(mp.pools.westFlankNorth, 0.52, 0.14, { copingMarginY: 0.04 });
  buildInfinityPoolBasin(mp.pools.westFlankSouth, 0.52, 0.14, { copingMarginY: 0.04 });

  // Inner Reflection Lagoon (-0.60m) + Seaward North Oceanfront Infinity Lagoons (-0.98m)
  buildInfinityPoolBasin(mp.pools.lapChannels[0], -0.6, -0.96, {
    eastInfinityWeir: true,
    eastWeirBaseY: -1.0,
    copingMarginY: 0.03,
  });
  buildInfinityPoolBasin(mp.pools.lapChannels[1], -0.98, -1.36, {
    eastInfinityWeir: true,
    eastWeirBaseY: -2.04,
    copingMarginY: 0.02,
  });
  buildInfinityPoolBasin(mp.pools.lapChannels[2], -0.98, -1.36, {
    eastInfinityWeir: true,
    eastWeirBaseY: -2.04,
    copingMarginY: 0.02,
  });

  // C. Raised Coastal-Oak Timber Sunbed Peninsula (`x in [105.0..112.2], z in [-75.0..-17.4], top = -0.54m`)
  //    & Full-Width Cross-Water Timber Jetty Bridge (`z in [-49.4..-45.6], top = -0.48m`)
  const pen = mp.sunbedPeninsula;
  addCustomMatPart(
    staticClubGroup,
    applyBoxMetricUvs(new THREE.BoxGeometry(pen.maxX - pen.minX, 0.42, pen.maxZ - pen.minZ), 2.6, 2.6),
    getWoodMat('oak', '#cfa678', 0.8),
    [(pen.minX + pen.maxX) * 0.5, pen.elevY - 0.21, (pen.minZ + pen.maxZ) * 0.5],
    [0, 0, 0],
    { castShadow: false, receiveShadow: true },
  );
  const jetty = mp.northJettyBridge;
  addCustomMatPart(
    staticClubGroup,
    applyBoxMetricUvs(new THREE.BoxGeometry(jetty.maxX - jetty.minX, 0.18, jetty.maxZ - jetty.minZ), 2.2, 2.2),
    getWoodMat('cedar', '#bc8d5f', 0.78),
    [(jetty.minX + jetty.maxX) * 0.5, jetty.elevY - 0.09, (jetty.minZ + jetty.maxZ) * 0.5],
    [0, 0, 0],
    { castShadow: true, receiveShadow: true },
  );

  // D. Straight Aligned South Beachfront Infinity Lagoon (`-1.02m` water -> `-2.00m` beach sand, rotY = 0!)
  buildInfinityPoolBasin(mp.pools.southSeaPool, -1.02, -1.4, {
    isOriented: true,
    eastInfinityWeir: true,
    eastWeirBaseY: -2.04,
    copingMarginY: 0.02,
  });

  // ============================================================================
  // 5. ELEVATED TIMBER CROSSING BRIDGE + GLASS SKYLIGHT DANCE FLOOR
  // ============================================================================
  const bridge = mp.crossingBridge;
  const brW = bridge.maxX - bridge.minX;
  const brD = bridge.maxZ - bridge.minZ;
  const brCx = (bridge.minX + bridge.maxX) * 0.5;
  const brCz = (bridge.minZ + bridge.maxZ) * 0.5;

  const bridgeDeckMesh = new THREE.Mesh(
    trackGeo(applyBoxMetricUvs(new THREE.BoxGeometry(brW, 0.18, brD), 2.2, 2.2)),
    getWoodMat('oak', '#d8b48a', 0.78),
  );
  bridgeDeckMesh.position.set(brCx, bridge.elevY - 0.09, brCz);
  bridgeDeckMesh.castShadow = !isSoftwareGl;
  bridgeDeckMesh.receiveShadow = !isSoftwareGl;
  staticClubGroup.add(bridgeDeckMesh);
  meshCount++;

  for (const sx of [bridge.minX + 0.35, bridge.maxX - 0.35]) {
    addCustomMatPart(
      staticClubGroup,
      new THREE.BoxGeometry(0.45, 0.14, brD),
      getWoodMat('cedar', '#b8895c', 0.8),
      [sx, bridge.elevY - 0.15, brCz],
    );
  }
  for (const sgn of [-1, 1]) {
    addCustomMatPart(
      staticClubGroup,
      new THREE.BoxGeometry(brW - 0.2, 0.06, 0.08),
      brushedBrassMat,
      [brCx, bridge.elevY + 0.04, brCz + sgn * (brD * 0.5 - 0.06)],
    );
  }

  // Translucent Glass Skylight Dance Deck behind DJ Stage (+0.52m)
  const sky = mp.skylightDanceFloor;
  const skyW = sky.maxX - sky.minX;
  const skyD = sky.maxZ - sky.minZ;
  const skyCx = (sky.minX + sky.maxX) * 0.5;
  const skyCz = (sky.minZ + sky.maxZ) * 0.5;

  addCustomMatPart(
    staticClubGroup,
    new THREE.BoxGeometry(skyW + 0.25, 0.24, skyD + 0.25),
    blackSteelMat,
    [skyCx, sky.elevY - 0.12, skyCz],
  );
  const cols = 4;
  const rows = 6;
  const panW = (skyW - 0.35) / cols;
  const panD = (skyD - 0.35) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = sky.minX + 0.18 + (c + 0.5) * panW;
      const pz = sky.minZ + 0.18 + (r + 0.5) * panD;
      addCustomMatPart(
        staticClubGroup,
        new THREE.BoxGeometry(panW - 0.08, 0.05, panD - 0.08),
        skylightPanelMat,
        [px, sky.elevY - 0.015, pz],
        [0, 0, 0],
        { renderOrder: 2 },
      );
    }
  }

  // ============================================================================
  // 6. ANGLED CENTRAL DJ PERFORMANCE STAGE PAVILION (+0.96m Elevated Stage Deck)
  // ============================================================================
  const dj = mp.djStage;
  const djStaticGrp = new THREE.Group();
  djStaticGrp.position.set(dj.cx, 0, dj.cz);
  djStaticGrp.rotation.y = dj.rotY;
  staticClubGroup.add(djStaticGrp);

  const djDynamicGrp = new THREE.Group();
  djDynamicGrp.position.set(dj.cx, 0, dj.cz);
  djDynamicGrp.rotation.y = dj.rotY;
  dynamicClubGroup.add(djDynamicGrp);

  const stageTopY = dj.stageDeckTopY; // -0.04
  const baseY = dj.baseDeckY; // -0.56
  const deckH = stageTopY - baseY; // 0.52m
  const djDeckMesh = new THREE.Mesh(
    trackGeo(applyBoxMetricUvs(new THREE.BoxGeometry(dj.widthM, deckH + 0.24, dj.depthM), 2.4, 2.4)),
    getWoodMat('oak', '#c99e70', 0.8),
  );
  djDeckMesh.position.set(0, baseY + (deckH - 0.24) * 0.5, 0);
  djDeckMesh.castShadow = !isSoftwareGl;
  djDeckMesh.receiveShadow = !isSoftwareGl;
  djStaticGrp.add(djDeckMesh);
  meshCount++;

  // 4 Broad Cascading Timber Stair Risers Down to South Pool Deck (-0.56m)
  const stairFloorY = baseY - 0.16;
  for (let st = 0; st < 4; st++) {
    const stepTop = stageTopY - (st + 1) * 0.125;
    const stepH = Math.max(0.14, stepTop - stairFloorY);
    const stMesh = new THREE.Mesh(
      trackGeo(applyBoxMetricUvs(new THREE.BoxGeometry(8.8, stepH, 0.42), 2.0, 2.0)),
      getWoodMat('oak', '#c49668', 0.82),
    );
    stMesh.position.set(1.5, stairFloorY + stepH * 0.5, dj.depthM * 0.5 + 0.2 + st * 0.38);
    stMesh.receiveShadow = !isSoftwareGl;
    djStaticGrp.add(stMesh);
    meshCount++;
  }

  // Flat Roof Slab: Brown PBR Timber Plank (2 deg slope) + 200mm Light Grey Fascia Roof Cap
  const roofY = stageTopY + 3.45;
  const roofPivot = new THREE.Group();
  roofPivot.position.set(0, roofY, 0);
  roofPivot.rotation.x = THREE.MathUtils.degToRad(2.0);
  djStaticGrp.add(roofPivot);

  const roofTimberMesh = new THREE.Mesh(
    trackGeo(applyBoxMetricUvs(new THREE.BoxGeometry(dj.widthM + 0.4, 0.22, dj.depthM + 0.5), 2.2, 2.2)),
    getWoodMat('cedar', '#a6764c', 0.78),
  );
  roofTimberMesh.castShadow = !isSoftwareGl;
  roofTimberMesh.receiveShadow = !isSoftwareGl;
  roofPivot.add(roofTimberMesh);
  meshCount++;

  addWorldPart(
    roofPivot,
    new THREE.BoxGeometry(dj.widthM + 0.56, 0.2, dj.depthM + 0.66),
    '#d8dee6',
    [0, 0.19, 0],
    [0, 0, 0],
    { strokeW: 0.018, castShadow: true },
  );

  for (const [cx, cz] of [
    [-5.85, -3.85],
    [-2.05, -3.85],
    [5.85, -3.85],
    [5.85, 2.25],
    [-2.05, 1.45],
  ] as const) {
    addCustomMatPart(
      djStaticGrp,
      new THREE.BoxGeometry(0.16, 3.55, 0.16),
      blackSteelMat,
      [cx, stageTopY + 1.775, cz],
      [0, 0, 0],
      { castShadow: true },
    );
  }

  // Cantilevered Aqua Glass Box Lounge (`4.0m W x 3.5m D`, projecting +1.5m forward)
  const gbCx = -4.0;
  const gbCz = -2.85;
  const gbBaseY = stageTopY + 1.15;
  const gbH = 2.15;
  addCustomMatPart(
    djStaticGrp,
    new THREE.BoxGeometry(4.0, 0.14, 3.5),
    blackSteelMat,
    [gbCx, gbBaseY, gbCz],
  );
  addCustomMatPart(
    djStaticGrp,
    new THREE.BoxGeometry(3.96, gbH, 3.46),
    aquaBoxGlassMat,
    [gbCx, gbBaseY + gbH * 0.5 + 0.07, gbCz],
    [0, 0, 0],
    { renderOrder: 3 },
  );
  addCustomMatPart(
    djStaticGrp,
    new THREE.BoxGeometry(4.04, 0.18, 3.54),
    poolCyanLedMat,
    [gbCx, gbBaseY + gbH + 0.12, gbCz],
  );
  addCustomMatPart(
    djStaticGrp,
    new THREE.BoxGeometry(4.04, 0.12, 3.54),
    poolCyanLedMat,
    [gbCx, gbBaseY + 0.02, gbCz],
  );
  addWorldPart(
    djStaticGrp,
    new THREE.BoxGeometry(3.1, 0.45, 0.85),
    '#e2e8f0',
    [gbCx, stageTopY + 0.225, gbCz + 0.8],
    [0, 0, 0],
    { strokeW: 0.01 },
  );

  // Open DJ Stage Bay: Purple Wash Backdrop + Booth + Speakers + 5 Moving Spotlights
  addCustomMatPart(
    djStaticGrp,
    new THREE.BoxGeometry(7.7, 3.25, 0.14),
    djPurpleWashMat,
    [2.0, stageTopY + 1.72, -3.55],
  );
  addCustomMatPart(
    djStaticGrp,
    new THREE.BoxGeometry(7.9, 3.45, 0.18),
    blackSteelMat,
    [2.0, stageTopY + 1.72, -3.72],
  );

  addWorldPart(
    djStaticGrp,
    new THREE.BoxGeometry(2.0, 0.92, 1.0),
    '#f1f5f9',
    [1.8, stageTopY + 0.46, -0.35],
    [0, 0, 0],
    { strokeW: 0.016, castShadow: true },
  );
  addCustomMatPart(
    djStaticGrp,
    new THREE.BoxGeometry(1.82, 0.54, 0.06),
    poolCyanLedMat,
    [1.8, stageTopY + 0.46, 0.16],
  );

  const djPlatters: THREE.Mesh[] = [];
  for (const px of [1.32, 2.28]) {
    const platter = addCustomMatPart(
      djDynamicGrp,
      new THREE.CylinderGeometry(0.18, 0.18, 0.03, 14),
      blackSteelMat,
      [px, stageTopY + 0.94, -0.35],
    );
    djPlatters.push(platter);
  }
  addCustomMatPart(
    djStaticGrp,
    new THREE.BoxGeometry(0.46, 0.06, 0.42),
    stainlessSteelMat,
    [1.8, stageTopY + 0.94, -0.35],
  );
  const djEqBars: THREE.Mesh[] = [];
  for (let b = 0; b < 6; b++) {
    const barMesh = addCustomMatPart(
      djDynamicGrp,
      new THREE.BoxGeometry(0.05, 0.14, 0.04),
      b % 2 === 0 ? poolCyanLedMat : djPurpleWashMat,
      [1.64 + b * 0.065, stageTopY + 1.02, -0.52],
    );
    djEqBars.push(barMesh);
  }

  for (const sx of [-1.45, 4.75]) {
    addWorldPart(
      djStaticGrp,
      new THREE.BoxGeometry(0.72, 1.82, 0.72),
      '#cbd5e1',
      [sx, stageTopY + 0.91, 0.95],
      [0, 0, 0],
      { strokeW: 0.018, castShadow: true },
    );
    for (const wy of [0.52, 1.15]) {
      addCustomMatPart(
        djStaticGrp,
        new THREE.CylinderGeometry(0.24, 0.24, 0.06, 14),
        blackSteelMat,
        [sx, stageTopY + wy, 1.32],
        [Math.PI / 2, 0, 0],
      );
    }
  }

  addCustomMatPart(
    djStaticGrp,
    new THREE.BoxGeometry(7.2, 0.1, 0.14),
    blackSteelMat,
    [1.8, roofY - 0.22, -1.35],
  );
  const djSpotPivots: THREE.Group[] = [];
  for (let sp = 0; sp < 5; sp++) {
    const piv = new THREE.Group();
    piv.position.set(-0.8 + sp * 1.3, roofY - 0.28, -1.35);
    djDynamicGrp.add(piv);
    djSpotPivots.push(piv);

    addCustomMatPart(piv, new THREE.CylinderGeometry(0.11, 0.14, 0.28, 10), blackSteelMat, [0, -0.14, 0]);
    addCustomMatPart(
      piv,
      new THREE.CylinderGeometry(0.11, 0.11, 0.04, 10),
      sp % 2 === 0 ? djPurpleWashMat : poolCyanLedMat,
      [0, -0.29, 0],
    );
    addCustomMatPart(
      piv,
      new THREE.ConeGeometry(0.95, 2.8, 12, 1, true),
      purpleBeamMat,
      [0, -1.68, 0],
      [0, 0, 0],
      { renderOrder: 4 },
    );
  }

  // ============================================================================
  // 7. MODERN LUXURY COCKTAIL BAR (cx=95.6, cz=40.4, rotY=-0.52)
  //    *** STRICTLY ZERO WOOD / TANPA KAYU! ***
  //    Elevated on a 2-tier stepped circular Ivory Terrazzo & Brushed Brass Inlay Podium (+0.68m)
  // ============================================================================
  const bar = mp.cocktailBar;
  const barGrp = new THREE.Group();
  barGrp.name = 'BeachClubLuxuryCocktailBar_NoWood';
  barGrp.position.set(bar.cx, 0, bar.cz);
  barGrp.rotation.y = bar.rotY;
  staticClubGroup.add(barGrp);

  // Lower stepped Terrazzo foundation (-0.65m .. +0.58m) + Upper Podium (+0.68m) matching evaluateBeachClubElevation radius
  addWorldPart(
    barGrp,
    new THREE.CylinderGeometry(bar.padRadiusM + 0.14, bar.padRadiusM + 0.22, 1.23, 28),
    '#ebe2d3',
    [0, -0.035, 0],
    [0, 0, 0],
    { tex: limestoneTex, receiveShadow: true },
  );
  addWorldPart(
    barGrp,
    new THREE.CylinderGeometry(bar.padRadiusM, bar.padRadiusM + 0.14, bar.padElevY + 0.65, 28),
    '#ffffff',
    [0, (bar.padElevY - 0.65) * 0.5, 0],
    [0, 0, 0],
    { tex: terrazzoInlayTex, receiveShadow: true, strokeW: 0.015 },
  );
  addCustomMatPart(
    barGrp,
    new THREE.RingGeometry(bar.padRadiusM - 0.16, bar.padRadiusM - 0.06, 36),
    brushedBrassMat,
    [0, bar.padElevY + 0.005, 0],
    [-Math.PI / 2, 0, 0],
  );

  const barBaseY = bar.padElevY;

  const uCurveSegments = 11;
  const uRadius = 2.05;
  for (let i = 0; i < uCurveSegments; i++) {
    const a0 = -Math.PI * 0.06 + (i / uCurveSegments) * (Math.PI * 1.12);
    const a1 = -Math.PI * 0.06 + ((i + 1) / uCurveSegments) * (Math.PI * 1.12);
    const aMid = (a0 + a1) * 0.5;
    const segLen = uRadius * (a1 - a0) + 0.06;
    const sx = Math.cos(aMid) * uRadius;
    const sz = Math.sin(aMid) * uRadius - 0.15;

    addWorldPart(
      barGrp,
      applyBoxMetricUvs(new THREE.BoxGeometry(segLen, 1.04, 0.44), 0.75, 1.04),
      '#ffffff',
      [sx, barBaseY + 0.52, sz],
      [0, -aMid + Math.PI / 2, 0],
      { tex: flutedStoneTex, strokeW: 0.01, castShadow: true },
    );
    addWorldPart(
      barGrp,
      applyBoxMetricUvs(new THREE.BoxGeometry(segLen + 0.08, 0.08, 0.68), 1.6, 1.6),
      '#ffffff',
      [sx, barBaseY + 1.08, sz],
      [0, -aMid + Math.PI / 2, 0],
      { tex: calacattaTex, strokeW: 0.01 },
    );
  }

  addCustomMatPart(
    barGrp,
    new THREE.TorusGeometry(uRadius + 0.24, 0.032, 8, 28, Math.PI * 1.12),
    warmAmberGlowMat,
    [0, barBaseY + 0.07, -0.15],
    [Math.PI / 2, 0, -Math.PI * 0.06],
  );
  addCustomMatPart(
    barGrp,
    new THREE.TorusGeometry(uRadius + 0.36, 0.025, 8, 28, Math.PI * 1.12),
    brushedBrassMat,
    [0, barBaseY + 0.18, -0.15],
    [Math.PI / 2, 0, -Math.PI * 0.06],
  );

  addWorldPart(
    barGrp,
    applyBoxMetricUvs(new THREE.BoxGeometry(4.3, 2.55, 0.28), 2.4, 2.4),
    '#ffffff',
    [0, barBaseY + 1.275, -1.62],
    [0, 0, 0],
    { tex: calacattaTex, strokeW: 0.015, castShadow: true },
  );
  addCustomMatPart(
    barGrp,
    new THREE.BoxGeometry(3.8, 0.92, 0.68),
    stainlessSteelMat,
    [0, barBaseY + 0.46, -1.16],
  );
  addCustomMatPart(
    barGrp,
    new THREE.BoxGeometry(1.35, 0.9, 0.72),
    stainlessSteelMat,
    [0, barBaseY + 0.45, 0.15],
  );
  for (const shelfY of [barBaseY + 1.38, barBaseY + 1.84]) {
    addCustomMatPart(barGrp, new THREE.BoxGeometry(3.15, 0.04, 0.34), brushedBrassMat, [0, shelfY, -1.34]);
    addCustomMatPart(barGrp, new THREE.BoxGeometry(3.05, 0.03, 0.04), warmAmberGlowMat, [0, shelfY + 0.03, -1.44]);
    const bottlePalette = ['#10b981', '#f59e0b', '#e11d48', '#38bdf8', '#d97706', '#a855f7'];
    for (let b = 0; b < 11; b++) {
      const bx = -1.3 + b * 0.26;
      addWorldPart(
        barGrp,
        new THREE.CylinderGeometry(0.042, 0.048, 0.24 + (b % 3) * 0.04, 8),
        bottlePalette[b % bottlePalette.length],
        [bx, shelfY + 0.15, -1.32],
        [0, 0, 0],
        { strokeW: 0.004 },
      );
    }
  }

  const canopyGroup = new THREE.Group();
  canopyGroup.position.set(0, barBaseY + 2.75, 0.15);
  canopyGroup.rotation.x = THREE.MathUtils.degToRad(-5.0);
  barGrp.add(canopyGroup);

  for (const colX of [-1.72, 1.72]) {
    addCustomMatPart(
      barGrp,
      new THREE.CylinderGeometry(0.065, 0.075, 2.75, 12),
      brushedBrassMat,
      [colX, barBaseY + 1.375, -0.58],
    );
  }
  addCustomMatPart(
    canopyGroup,
    new RoundedBoxGeometry(5.6, 0.12, 3.6, 2, 0.05),
    brushedBrassMat,
    [0, 0, 0],
    [0, 0, 0],
    { castShadow: true },
  );
  for (let rib = -3; rib <= 3; rib++) {
    addCustomMatPart(
      canopyGroup,
      new THREE.BoxGeometry(0.05, 0.07, 3.35),
      brushedBrassMat,
      [rib * 0.78, -0.02, 0],
    );
  }
  addCustomMatPart(
    canopyGroup,
    new RoundedBoxGeometry(5.42, 0.05, 3.42, 2, 0.025),
    barTintedGlassMat,
    [0, 0.08, 0],
    [0, 0, 0],
    { renderOrder: 3 },
  );

  const stoolCount = 7;
  for (let s = 0; s < stoolCount; s++) {
    const a = 0.12 + (s / (stoolCount - 1)) * (Math.PI - 0.24);
    const r = uRadius + 0.78;
    const sx = Math.cos(a) * r;
    const sz = Math.sin(a) * r - 0.15;
    const stool = new THREE.Group();
    stool.position.set(sx, barBaseY, sz);
    stool.rotation.y = -a + Math.PI / 2;
    barGrp.add(stool);

    addCustomMatPart(stool, new THREE.CylinderGeometry(0.22, 0.24, 0.035, 12), brushedBrassMat, [0, 0.018, 0]);
    addCustomMatPart(stool, new THREE.CylinderGeometry(0.032, 0.038, 0.72, 8), brushedBrassMat, [0, 0.38, 0]);
    addWorldPart(stool, new RoundedBoxGeometry(0.42, 0.08, 0.38, 2, 0.03), '#c2936b', [0, 0.76, 0], [0, 0, 0], { strokeW: 0.006 });
    addWorldPart(stool, new RoundedBoxGeometry(0.42, 0.28, 0.07, 2, 0.025), '#c2936b', [0, 0.92, -0.16], [0, 0, 0], { strokeW: 0.006 });
  }

  // ============================================================================
  // 8. 9 MODERN LUXURY VIP CABANA SUITES ON +0.64m MEZZANINE (`screen_57a53910.png`)
  // ============================================================================
  const cabCount = mp.cabanas.length;
  const lougerSetCabanas = mp.cabanas.filter((c) => c.hasLoungerPair);

  const dummy = new THREE.Object3D();
  const buildInstancedBatch = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    matrices: THREE.Matrix4[],
    castShadow = false,
    receiveShadow = true,
  ): THREE.InstancedMesh => {
    trackGeo(geo);
    const inst = new THREE.InstancedMesh(geo, mat, matrices.length);
    for (let i = 0; i < matrices.length; i++) {
      inst.setMatrixAt(i, matrices[i]);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = !isSoftwareGl && castShadow;
    inst.receiveShadow = !isSoftwareGl && receiveShadow;
    computeInstancedBoundingVolumes(inst, { padding: 0.6, frustumCulled: true });
    dynamicClubGroup.add(inst);
    meshCount++;
    return inst;
  };

  const makeWorldBlitzMat = (
    colorHex: string,
    tex?: THREE.Texture,
    specularStrength = 0.22,
  ): THREE.Material => {
    const tmpMesh = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.1, 0.1, 0.1)),
      trackMat(new THREE.MeshStandardMaterial({ color: colorHex, map: tex ?? null, roughness: 0.8 })),
    );
    upgradeMeshToBlitzWorldMaterial(tmpMesh, windUniforms, colorHex, specularStrength);
    return tmpMesh.material as THREE.Material;
  };

  const calacattaMat = makeWorldBlitzMat('#ffffff', calacattaTex);
  const ivoryFabricMat = makeWorldBlitzMat('#f5f1ea');
  const shearCurtainMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#fbf9f5',
      roughness: 0.9,
      transparent: true,
      opacity: 0.88,
    }),
  );
  const turquoiseMeshMat = makeWorldBlitzMat('#2dd4bf');
  const whiteFrameMat = makeWorldBlitzMat('#f1f5f9');
  const parasolStrawMat = makeWorldBlitzMat('#ffffff', wovenParasolTex);

  const plinthMatrices: THREE.Matrix4[] = [];
  const steelPostMatrices: THREE.Matrix4[] = [];
  const louverMatrices: THREE.Matrix4[] = [];
  const curtainMatrices: THREE.Matrix4[] = [];
  const daybedBaseMatrices: THREE.Matrix4[] = [];
  const daybedMattressMatrices: THREE.Matrix4[] = [];
  const brassSideTableMatrices: THREE.Matrix4[] = [];
  const cabLampMatrices: THREE.Matrix4[] = [];

  for (const cab of mp.cabanas) {
    const yBase = cab.plinthTopY;
    // Honed Calacatta Marble Plinth (`0.64m -> 0.76m`)
    dummy.position.set(cab.cx, yBase - 0.12, cab.cz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    plinthMatrices.push(dummy.matrix.clone());

    for (const [px, pz] of [
      [-1.42, -1.46],
      [-1.42, 1.46],
      [1.42, -1.46],
      [1.42, 1.46],
    ] as const) {
      dummy.position.set(cab.cx + px, yBase + 1.225, cab.cz + pz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      steelPostMatrices.push(dummy.matrix.clone());
    }
    for (let lv = 0; lv < 10; lv++) {
      dummy.position.set(cab.cx, yBase + 2.46, cab.cz - 1.25 + lv * 0.275);
      dummy.rotation.set(0.35, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      louverMatrices.push(dummy.matrix.clone());
    }
    for (const [cxOff, czOff] of [
      [-1.36, -1.38],
      [-1.36, 1.38],
      [1.36, -1.38],
      [1.36, 1.38],
    ] as const) {
      dummy.position.set(cab.cx + cxOff, yBase + 1.2, cab.cz + czOff);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      curtainMatrices.push(dummy.matrix.clone());
    }
    dummy.position.set(cab.cx - 0.38, yBase + 0.16, cab.cz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    daybedBaseMatrices.push(dummy.matrix.clone());

    dummy.position.set(cab.cx - 0.34, yBase + 0.39, cab.cz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    daybedMattressMatrices.push(dummy.matrix.clone());

    for (const tz of [-1.08, 1.08]) {
      dummy.position.set(cab.cx - 0.85, yBase + 0.23, cab.cz + tz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      brassSideTableMatrices.push(dummy.matrix.clone());

      dummy.position.set(cab.cx - 0.85, yBase + 0.56, cab.cz + tz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      cabLampMatrices.push(dummy.matrix.clone());
    }
  }

  let instancedBatchCount = 0;
  buildInstancedBatch(applyBoxMetricUvs(new THREE.BoxGeometry(3.1, 0.24, 3.2), 2.0, 2.0), calacattaMat, plinthMatrices, true);
  buildInstancedBatch(new THREE.BoxGeometry(0.11, 2.48, 0.11), blackSteelMat, steelPostMatrices, true);
  buildInstancedBatch(new THREE.BoxGeometry(2.96, 0.05, 0.18), blackSteelMat, louverMatrices, true);
  buildInstancedBatch(new THREE.CylinderGeometry(0.16, 0.24, 2.38, 8), shearCurtainMat, curtainMatrices, false);
  buildInstancedBatch(new RoundedBoxGeometry(1.78, 0.3, 2.02, 2, 0.04), calacattaMat, daybedBaseMatrices, true);
  buildInstancedBatch(new RoundedBoxGeometry(1.72, 0.22, 1.94, 2, 0.06), ivoryFabricMat, daybedMattressMatrices, false);
  buildInstancedBatch(new THREE.BoxGeometry(0.42, 0.44, 0.42), brushedBrassMat, brassSideTableMatrices, false);
  buildInstancedBatch(new THREE.CylinderGeometry(0.08, 0.1, 0.22, 8), warmAmberGlowMat, cabLampMatrices, false, false);
  instancedBatchCount += 8;

  for (const cab of mp.cabanas) {
    const headerY = cab.plinthTopY + 2.48;
    addCustomMatPart(staticClubGroup, new THREE.BoxGeometry(3.04, 0.13, 0.12), blackSteelMat, [cab.cx, headerY, cab.cz - 1.46]);
    addCustomMatPart(staticClubGroup, new THREE.BoxGeometry(3.04, 0.13, 0.12), blackSteelMat, [cab.cx, headerY, cab.cz + 1.46]);
    addCustomMatPart(staticClubGroup, new THREE.BoxGeometry(0.12, 0.13, 3.04), blackSteelMat, [cab.cx - 1.46, headerY, cab.cz]);
    addCustomMatPart(staticClubGroup, new THREE.BoxGeometry(0.12, 0.13, 3.04), blackSteelMat, [cab.cx + 1.46, headerY, cab.cz]);
  }

  if (lougerSetCabanas.length > 0) {
    const cLoungerMatrices: THREE.Matrix4[] = [];
    const cParasolPoleMatrices: THREE.Matrix4[] = [];
    const cParasolCanopyMatrices: THREE.Matrix4[] = [];
    const cParasolBaseMatrices: THREE.Matrix4[] = [];

    for (const cab of lougerSetCabanas) {
      const lx = cab.cx + 2.05;
      const deckY = 0.64;
      for (const lzOff of [-0.62, 0.62]) {
        dummy.position.set(lx, deckY + 0.14, cab.cz + lzOff);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        cLoungerMatrices.push(dummy.matrix.clone());
      }
      dummy.position.set(lx - 0.1, deckY + 0.12, cab.cz + 1.35);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      cParasolBaseMatrices.push(dummy.matrix.clone());

      dummy.position.set(lx - 0.1, deckY + 1.24, cab.cz + 1.15);
      dummy.rotation.set(0.18, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      cParasolPoleMatrices.push(dummy.matrix.clone());

      dummy.position.set(lx, deckY + 2.2, cab.cz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      cParasolCanopyMatrices.push(dummy.matrix.clone());
    }
    buildInstancedBatch(new RoundedBoxGeometry(1.45, 0.22, 0.72, 2, 0.05), ivoryFabricMat, cLoungerMatrices, false);
    buildInstancedBatch(new THREE.BoxGeometry(0.45, 0.24, 0.45), calacattaMat, cParasolBaseMatrices, false);
    buildInstancedBatch(new THREE.CylinderGeometry(0.035, 0.045, 2.3, 8), blackSteelMat, cParasolPoleMatrices, false);
    buildInstancedBatch(new THREE.ConeGeometry(1.15, 0.42, 8), ivoryFabricMat, cParasolCanopyMatrices, true);
    instancedBatchCount += 4;
  }

  // ============================================================================
  // 9. 10 FLOATING SQUARE WHITE SUNKEN LOUNGE PODS + WARM AMBER TABLE LANTERNS
  // ============================================================================
  const podRimMatrices: THREE.Matrix4[] = [];
  const podCushionMatrices: THREE.Matrix4[] = [];
  const podTableMatrices: THREE.Matrix4[] = [];
  const podLanternMatrices: THREE.Matrix4[] = [];
  const haloSpritePositions: { x: number; y: number; z: number; scale: number }[] = [];

  for (const pod of mp.sunkenPods) {
    const wy = pod.waterY;
    dummy.position.set(pod.cx, wy - 0.04, pod.cz);
    dummy.rotation.set(0, pod.rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    podRimMatrices.push(dummy.matrix.clone());

    dummy.position.set(pod.cx, wy + 0.1, pod.cz);
    dummy.rotation.set(0, pod.rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    podCushionMatrices.push(dummy.matrix.clone());

    dummy.position.set(pod.cx, wy + 0.2, pod.cz);
    dummy.rotation.set(0, pod.rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    podTableMatrices.push(dummy.matrix.clone());

    dummy.position.set(pod.cx, wy + 0.42, pod.cz);
    dummy.rotation.set(0, pod.rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    podLanternMatrices.push(dummy.matrix.clone());

    haloSpritePositions.push({ x: pod.cx, y: wy + 0.44, z: pod.cz, scale: 0.95 });
  }

  buildInstancedBatch(new RoundedBoxGeometry(2.65, 0.34, 2.65, 2, 0.06), whiteFrameMat, podRimMatrices, false);
  buildInstancedBatch(new RoundedBoxGeometry(2.12, 0.14, 2.12, 2, 0.05), ivoryFabricMat, podCushionMatrices, false);
  buildInstancedBatch(new THREE.CylinderGeometry(0.46, 0.42, 0.18, 12), calacattaMat, podTableMatrices, false);
  buildInstancedBatch(new THREE.CylinderGeometry(0.1, 0.12, 0.26, 10), warmAmberGlowMat, podLanternMatrices, false, false);
  instancedBatchCount += 4;

  // ============================================================================
  // 10. SEAWARD WOVEN PARASOL SETS & TIMBER PENINSULA TURQUOISE LOUNGERS + PARASOLS
  // ============================================================================
  const sandSetPoleMats: THREE.Matrix4[] = [];
  const sandSetCanopyMats: THREE.Matrix4[] = [];
  const sandLoungerMats: THREE.Matrix4[] = [];
  const poolLoungerMats: THREE.Matrix4[] = [];
  const poolParasolPoleMats: THREE.Matrix4[] = [];
  const poolParasolCanopyMats: THREE.Matrix4[] = [];

  for (const bs of mp.beachSets) {
    if (bs.variant === 'sand_woven') {
      dummy.position.set(bs.cx, bs.elevY + 1.15, bs.cz);
      dummy.rotation.set(0, bs.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      sandSetPoleMats.push(dummy.matrix.clone());

      dummy.position.set(bs.cx, bs.elevY + 2.25, bs.cz);
      dummy.rotation.set(0, bs.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      sandSetCanopyMats.push(dummy.matrix.clone());

      const cosY = Math.cos(bs.rotY);
      const sinY = Math.sin(bs.rotY);
      for (const sideOff of [-0.62, 0.62]) {
        dummy.position.set(
          bs.cx + cosY * sideOff * 0.2 - sinY * sideOff,
          bs.elevY + 0.16,
          bs.cz + sinY * sideOff * 0.2 + cosY * sideOff,
        );
        dummy.rotation.set(0, bs.rotY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        sandLoungerMats.push(dummy.matrix.clone());
      }
    } else {
      // Twin turquoise loungers + Balinese woven parasol on the +0.46m Timber Sunbed Peninsula!
      for (const sideOff of [-0.58, 0.58]) {
        dummy.position.set(bs.cx, bs.elevY + 0.13, bs.cz + sideOff);
        dummy.rotation.set(0, bs.rotY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        poolLoungerMats.push(dummy.matrix.clone());
      }
      dummy.position.set(bs.cx - 0.15, bs.elevY + 1.15, bs.cz);
      dummy.rotation.set(0, bs.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poolParasolPoleMats.push(dummy.matrix.clone());

      dummy.position.set(bs.cx - 0.15, bs.elevY + 2.25, bs.cz);
      dummy.rotation.set(0, bs.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poolParasolCanopyMats.push(dummy.matrix.clone());
    }
  }
  if (sandSetPoleMats.length > 0) {
    buildInstancedBatch(new THREE.CylinderGeometry(0.045, 0.055, 2.4, 8), blackSteelMat, sandSetPoleMats, false);
    buildInstancedBatch(new THREE.ConeGeometry(1.38, 0.62, 10), parasolStrawMat, sandSetCanopyMats, true);
    buildInstancedBatch(new RoundedBoxGeometry(1.88, 0.24, 0.72, 2, 0.06), ivoryFabricMat, sandLoungerMats, false);
    instancedBatchCount += 3;
  }
  if (poolLoungerMats.length > 0) {
    buildInstancedBatch(new RoundedBoxGeometry(1.85, 0.22, 0.72, 2, 0.06), turquoiseMeshMat, poolLoungerMats, false);
    buildInstancedBatch(new THREE.CylinderGeometry(0.045, 0.055, 2.35, 8), blackSteelMat, poolParasolPoleMats, false);
    buildInstancedBatch(new THREE.ConeGeometry(1.35, 0.58, 10), parasolStrawMat, poolParasolCanopyMats, true);
    instancedBatchCount += 3;
  }

  // ============================================================================
  // 11. CRISSCROSS CATENARY FESTOON BULB GARLANDS (`InstancedMesh` + Halos)
  // ============================================================================
  const festoonPoleMatrices: THREE.Matrix4[] = [];
  const festoonBulbMatrices: THREE.Matrix4[] = [];
  const wirePoints: number[] = [];
  let festoonBulbCount = 0;

  for (const span of mp.festoonSpans) {
    for (const [px, py, pz] of [
      [span.ax, span.ay, span.az],
      [span.bx, span.by, span.bz],
    ] as const) {
      const poleBaseY = px >= 112.0 ? -1.04 : px >= 99.6 ? -0.62 : 0.6;
      const poleH = Math.max(2.5, py - poleBaseY);
      dummy.position.set(px, poleBaseY + poleH * 0.5, pz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, poleH / 4.5, 1);
      dummy.updateMatrix();
      festoonPoleMatrices.push(dummy.matrix.clone());
    }

    const cableSubdivs = 14;
    for (let s = 0; s < cableSubdivs; s++) {
      const t0 = s / cableSubdivs;
      const t1 = (s + 1) / cableSubdivs;
      const sag0 = 4 * t0 * (1 - t0) * span.sagM;
      const sag1 = 4 * t1 * (1 - t1) * span.sagM;
      wirePoints.push(
        span.ax + (span.bx - span.ax) * t0,
        span.ay + (span.by - span.ay) * t0 - sag0,
        span.az + (span.bz - span.az) * t0,
        span.ax + (span.bx - span.ax) * t1,
        span.ay + (span.by - span.ay) * t1 - sag1,
        span.az + (span.bz - span.az) * t1,
      );
    }

    for (let b = 1; b < span.bulbCount; b++) {
      const t = b / span.bulbCount;
      const sag = 4 * t * (1 - t) * span.sagM;
      const bx = span.ax + (span.bx - span.ax) * t;
      const by = span.ay + (span.by - span.ay) * t - sag - 0.12;
      const bz = span.az + (span.bz - span.az) * t;
      dummy.position.set(bx, by, bz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      festoonBulbMatrices.push(dummy.matrix.clone());
      haloSpritePositions.push({ x: bx, y: by, z: bz, scale: 0.72 });
      festoonBulbCount++;
    }
  }

  if (festoonPoleMatrices.length > 0) {
    buildInstancedBatch(new THREE.CylinderGeometry(0.055, 0.07, 4.5, 8), blackSteelMat, festoonPoleMatrices, false);
    instancedBatchCount += 1;
  }
  if (wirePoints.length > 0) {
    const wireGeo = trackGeo(new THREE.BufferGeometry());
    wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wirePoints, 3));
    const wireMat = trackMat(new THREE.LineBasicMaterial({ color: '#1e293b' }));
    const wireLines = new THREE.LineSegments(wireGeo, wireMat);
    dynamicClubGroup.add(wireLines);
    meshCount++;
  }
  if (festoonBulbMatrices.length > 0) {
    buildInstancedBatch(new THREE.SphereGeometry(0.09, 6, 6), warmAmberGlowMat, festoonBulbMatrices, false, false);
    instancedBatchCount += 1;
  }
  if (haloSpritePositions.length > 0) {
    const haloGeo = trackGeo(new THREE.PlaneGeometry(1, 1));
    const haloInstA = new THREE.InstancedMesh(haloGeo, warmHaloSpriteMat, haloSpritePositions.length);
    const haloInstB = new THREE.InstancedMesh(haloGeo, warmHaloSpriteMat, haloSpritePositions.length);
    for (let i = 0; i < haloSpritePositions.length; i++) {
      const h = haloSpritePositions[i];
      dummy.position.set(h.x, h.y, h.z);
      dummy.rotation.set(0, Math.PI * 0.25, 0);
      dummy.scale.setScalar(h.scale);
      dummy.updateMatrix();
      haloInstA.setMatrixAt(i, dummy.matrix);
      dummy.rotation.set(0, -Math.PI * 0.25, 0);
      dummy.updateMatrix();
      haloInstB.setMatrixAt(i, dummy.matrix);
    }
    haloInstA.instanceMatrix.needsUpdate = true;
    haloInstB.instanceMatrix.needsUpdate = true;
    computeInstancedBoundingVolumes(haloInstA, { padding: 1.0, frustumCulled: true });
    computeInstancedBoundingVolumes(haloInstB, { padding: 1.0, frustumCulled: true });
    haloInstA.renderOrder = 5;
    haloInstB.renderOrder = 5;
    dynamicClubGroup.add(haloInstA, haloInstB);
    meshCount += 2;
    instancedBatchCount += 2;
  }

  // ============================================================================
  // 12. TWIN PROMENADE COCONUT PALMS & COURTYARD PALM GROVE (1:1 Kai Fish Model!)
  // ============================================================================
  const { trunkGeo, collarAndNutsGeo, frondsGeo } = buildCoconutPalmGeometries();
  const kaiPalmBarkTex = trackTex(createKaiPalmTrunkBarkTexture());
  const kaiPalmFrondTex = trackTex(createKaiPalmFrondAlphaMaskTexture());

  const palmTrunkMat = makeWorldBlitzMat('#ffffff', kaiPalmBarkTex, 0.14);
  const palmCollarMat = makeWorldBlitzMat('#679642');

  const palmFrondShaderMat = trackMat(
    new THREE.ShaderMaterial({
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        uFrondTex: { value: kaiPalmFrondTex },
        uColorA: { value: new THREE.Color('#4d963d') },
        uColorB: { value: new THREE.Color('#a6cf54') },
        uColorRachis: { value: new THREE.Color('#c8e070') },
        uColorShadow: { value: new THREE.Color('#2e642c') },
        uAlphaThreshold: { value: 0.28 },
        uLightDirection: windUniforms.uLightDirection,
        uLightColor: windUniforms.uLightColor,
        uWindPhase: windUniforms.uWindPhase,
        uWindDirection: windUniforms.uWindDirection,
        uWindStrength: windUniforms.uWindStrength,
        uWindGust: windUniforms.uWindGust,
      },
      fog: true,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        uniform float uWindPhase;
        uniform vec2 uWindDirection;
        uniform float uWindStrength;
        uniform float uWindGust;

        varying vec2 vUv;
        varying vec3 vNormalW;
        #include <fog_pars_vertex>

        void main() {
          vUv = uv;
          vec4 instPos = vec4(position, 1.0);
          #ifdef USE_INSTANCING
            instPos = instanceMatrix * instPos;
          #endif
          vec4 worldPos = modelMatrix * instPos;

          float arcFactor = smoothstep(0.06, 1.0, uv.y);
          float edgeFlutter = abs(uv.x - 0.5) * 2.0 * smoothstep(0.15, 0.9, uv.y);
          float seedPhase = worldPos.x * 0.42 + worldPos.z * 0.37 + uv.y * 2.2;
          float phase = uWindPhase + seedPhase;
          float sway = (sin(phase) * 0.38 + uWindGust * 0.24) * uWindStrength * arcFactor;
          float flutter = sin(phase * 2.3 + uv.x * 6.0) * 0.07 * uWindStrength * edgeFlutter;

          worldPos.x += uWindDirection.x * sway;
          worldPos.z += uWindDirection.y * sway;
          worldPos.y += (sin(phase * 0.85) * 0.14 * arcFactor + flutter) * uWindStrength;

          mat3 nMat = mat3(modelMatrix);
          #ifdef USE_INSTANCING
            nMat = nMat * mat3(instanceMatrix);
          #endif
          vNormalW = normalize(nMat * normal);
          vec4 mvPosition = viewMatrix * worldPos;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uFrondTex;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform vec3 uColorRachis;
        uniform vec3 uColorShadow;
        uniform float uAlphaThreshold;
        uniform vec3 uLightDirection;
        uniform vec3 uLightColor;

        varying vec2 vUv;
        varying vec3 vNormalW;
        #include <fog_pars_fragment>

        void main() {
          vec4 maskSample = texture2D(uFrondTex, vUv);
          if (maskSample.r < uAlphaThreshold) discard;

          float rawNdl = dot(normalize(vNormalW), normalize(uLightDirection));
          float litFactor = smoothstep(0.02, 0.86, rawNdl);
          float shadowFactor = smoothstep(-0.48, 0.30, rawNdl);
          float crownHeartAo = mix(0.74, 1.0, smoothstep(0.0, 0.26, vUv.y));
          float tipSunWarmth = smoothstep(0.45, 0.98, vUv.y) * 0.18;
          float centralStemMask = smoothstep(0.88, 0.99, maskSample.g) * (1.0 - smoothstep(0.0, 0.04, abs(vUv.x - 0.5)));

          vec3 leafCol = mix(uColorShadow, uColorA, shadowFactor);
          leafCol = mix(leafCol, uColorB, clamp(litFactor * 0.72 + tipSunWarmth, 0.0, 1.0));
          vec3 finalCol = mix(leafCol, uColorRachis, centralStemMask * 0.58) * crownHeartAo;
          finalCol *= mix(vec3(1.0), uLightColor, 0.45);

          gl_FragColor = vec4(finalCol, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }
      `,
    }),
  );

  const palmTrunkMatrices: THREE.Matrix4[] = [];
  const palmFrondMatrices: THREE.Matrix4[] = [];

  for (const palm of mp.palms) {
    const kaiScale = palm.scale * 1.38;
    dummy.position.set(palm.x, palm.baseY - 0.04, palm.z);
    dummy.rotation.set(0, palm.rotY, 0);
    dummy.scale.setScalar(kaiScale);
    dummy.updateMatrix();
    palmTrunkMatrices.push(dummy.matrix.clone());
    palmFrondMatrices.push(dummy.matrix.clone());
  }
  const palmTrunkInst = buildInstancedBatch(trunkGeo, palmTrunkMat, palmTrunkMatrices, true, true);
  const palmCollarInst = buildInstancedBatch(collarAndNutsGeo, palmCollarMat, palmTrunkMatrices, false, true);
  const palmFrondInst = buildInstancedBatch(frondsGeo, palmFrondShaderMat, palmFrondMatrices, true, false);
  void palmTrunkInst;
  void palmCollarInst;
  void palmFrondInst;
  instancedBatchCount += 3;

  bakeStaticGroupMeshes(staticClubGroup, { minShadowCasterSpan: 0.75 });

  // ============================================================================
  // 13. LIVE NIGHT & TWILIGHT LIGHTING + DJ ANIMATION LOOP (Zero allocations!)
  // ============================================================================
  const update = (
    timeSec: number,
    weatherEnvState?: { nightFactor01?: number; duskDawnFactor01?: number },
  ) => {
    const night = Math.max(0, Math.min(1, weatherEnvState?.nightFactor01 ?? 0));
    const dusk = Math.max(0, Math.min(1, weatherEnvState?.duskDawnFactor01 ?? 0));
    const clubNightMix = Math.max(night, dusk * 0.78);

    poolNightUniform.value = clubNightMix;
    poolCyanLedMat.emissiveIntensity = 0.25 + clubNightMix * 2.15;
    warmAmberGlowMat.emissiveIntensity = 0.35 + clubNightMix * 2.25;
    djPurpleWashMat.emissiveIntensity = 0.35 + clubNightMix * 1.85;
    aquaBoxGlassMat.emissiveIntensity = 0.2 + clubNightMix * 1.45;
    skylightPanelMat.emissiveIntensity = 0.18 + clubNightMix * 1.4;
    waterfallCurtainMat.emissiveIntensity = 0.28 + clubNightMix * 1.35;
    purpleBeamMat.opacity = 0.03 + clubNightMix * 0.16;
    warmHaloSpriteMat.opacity = 0.08 + clubNightMix * 0.56;

    for (let i = 0; i < djPlatters.length; i++) {
      djPlatters[i].rotation.y = timeSec * (i === 0 ? 3.2 : -2.8);
    }
    for (let i = 0; i < djEqBars.length; i++) {
      const pulse = 0.45 + 0.55 * Math.sin(timeSec * (5.2 + i * 0.9) + i * 1.1);
      djEqBars[i].scale.y = 0.35 + pulse * 1.25;
    }
    for (let i = 0; i < djSpotPivots.length; i++) {
      const phase = timeSec * 1.15 + i * 1.1;
      djSpotPivots[i].rotation.z = Math.sin(phase) * 0.28;
      djSpotPivots[i].rotation.x = Math.cos(phase * 0.8) * 0.2 + 0.12;
    }
  };

  update(0, { nightFactor01: 0, duskDawnFactor01: 0 });

  const dispose = () => {
    rootGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const g = (obj as THREE.Mesh).geometry;
        if (g) g.dispose();
      }
    });
    for (const g of disposableGeometries) g.dispose();
    for (const m of disposableMaterials) m.dispose();
    for (const t of disposableTextures) t.dispose();
  };

  return {
    group: rootGroup,
    stats: {
      meshCount,
      instancedBatchCount,
      festoonBulbCount,
      cabanaCount: cabCount,
      sunkenPodCount: mp.sunkenPods.length,
      palmCount: mp.palms.length,
    },
    update,
    dispose,
  };
}
