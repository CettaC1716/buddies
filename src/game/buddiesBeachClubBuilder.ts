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
  evaluateBeachClubElevation,
  type BeachClubOrientedRect,
  type BeachClubRect,
} from './buddiesBeachClubRules';
import {
  EAST_WATER_SURFACE_Y,
  evaluateHarborSeabedDrop,
} from './buddiesPlanetCurvature';

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
        v * 2.5 * Math.PI * 2.0 +
        u * 1.35 * Math.PI +
        Math.sin(u * Math.PI * 2.0) * 1.45 +
        Math.cos(u * Math.PI * 4.0) * 0.25;
      const ribbon = Math.sin(wavePhase);
      const isAqua = ribbon > 0.16;
      const edgeGroove = Math.abs(ribbon - 0.16) < 0.05;
      const paverJoint = !isAqua && ((py % 64 < 2) || (px % 96 < 2));

      const noise = ((Math.sin(px * 12.9898 + py * 78.233) * 43758.5453) % 1 + 1) % 1;
      const grain = (noise - 0.5) * 10;

      let r = isAqua ? 84 : 241;
      let g = isAqua ? 204 : 231;
      let b = isAqua ? 216 : 215;

      if (isAqua) {
        const shade = Math.sin(u * Math.PI) * 14 + Math.cos(wavePhase) * 8;
        r += shade * 0.45;
        g += shade * 0.85;
        b += shade;
      }

      if (edgeGroove) {
        r -= 28;
        g -= 26;
        b -= 24;
      } else if (paverJoint) {
        r -= 14;
        g -= 13;
        b -= 12;
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
 * 1:1 Grand Panoramic Iridescent Aurora LED Media Wall Texture (`1024x512`)
 * matching the Grand Luxury DJ Performance Building model sheet:
 * luminous cyan-turquoise, pastel sky-blue, soft violet & magenta gradient waves + subtle LED tile matrix.
 */
function createDjPanoramicLedWallTexture(): THREE.Texture {
  const w = 1024;
  const h = 512;
  const { canvas, ctx } = makeCanvas2d(w, h);
  if (!canvas || !ctx) return makeFallbackDataTex(140, 210, 245);

  // Diagonal luminous aurora base gradient (lavender-violet corners -> bright aqua-cyan center -> pastel rose-violet)
  const baseGrad = ctx.createLinearGradient(0, 0, w, h);
  baseGrad.addColorStop(0.0, '#b58ef8');
  baseGrad.addColorStop(0.28, '#8ad8f8');
  baseGrad.addColorStop(0.55, '#a8f0f6');
  baseGrad.addColorStop(0.78, '#c5a4f8');
  baseGrad.addColorStop(1.0, '#e3a6f4');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, w, h);

  // Soft swirling iridescent aurora clouds & light blooms
  const blooms: readonly [number, number, number, string][] = [
    [w * 0.22, h * 0.62, w * 0.34, 'rgba(110, 240, 245, 0.55)'],
    [w * 0.52, h * 0.42, w * 0.38, 'rgba(255, 255, 255, 0.45)'],
    [w * 0.78, h * 0.30, w * 0.32, 'rgba(218, 128, 255, 0.55)'],
    [w * 0.16, h * 0.20, w * 0.26, 'rgba(155, 130, 255, 0.48)'],
    [w * 0.68, h * 0.78, w * 0.30, 'rgba(120, 232, 248, 0.48)'],
  ];
  for (const [bx, by, br, col] of blooms) {
    const rg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    rg.addColorStop(0, col);
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
  }

  // Sweeping diagonal light ribbons
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(130,245,255,0.24)';
    ctx.lineWidth = 18 + (i % 3) * 14;
    ctx.beginPath();
    ctx.moveTo(-40, h * (0.2 + i * 0.14));
    ctx.bezierCurveTo(
      w * 0.32,
      h * (0.05 + ((i * 23) % 40) / 100),
      w * 0.68,
      h * (0.95 - ((i * 19) % 45) / 100),
      w + 40,
      h * (0.15 + ((i * 17) % 70) / 100),
    );
    ctx.stroke();
  }

  // Subtle architectural LED cabinet panel seams & fine horizontal scanlines
  ctx.strokeStyle = 'rgba(20, 24, 38, 0.14)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= w; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += 128) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(16, 22, 36, 0.055)';
  for (let y = 0; y < h; y += 4) {
    ctx.fillRect(0, y, w, 1);
  }

  return finalizeClubTexture(canvas, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping);
}

/**
 * Perforated Dark Steel Concert Line-Array & Subwoofer Audio Tower Grille Texture (`256x512`).
 */
function createConcertSpeakerGrilleTexture(): THREE.Texture {
  const w = 256;
  const h = 512;
  const { canvas, ctx } = makeCanvas2d(w, h);
  if (!canvas || !ctx) return makeFallbackDataTex(34, 38, 44);

  ctx.fillStyle = '#20242b';
  ctx.fillRect(0, 0, w, h);

  // Recessed metallic side rigging rails
  ctx.fillStyle = '#383e48';
  ctx.fillRect(0, 0, 18, h);
  ctx.fillRect(w - 18, 0, 18, h);
  ctx.fillStyle = '#14171c';
  ctx.fillRect(18, 0, 4, h);
  ctx.fillRect(w - 22, 0, 4, h);

  // Stacked acoustic speaker module bays with recessed woofer silhouettes
  const bays = 4;
  const bayH = h / bays;
  for (let b = 0; b < bays; b++) {
    const y0 = b * bayH;
    ctx.fillStyle = '#181c22';
    ctx.fillRect(24, y0 + 8, w - 48, bayH - 16);

    // Subtle circular woofer cones visible behind perforated acoustic steel mesh
    for (const cx of [w * 0.35, w * 0.65]) {
      const cy = y0 + bayH * 0.5;
      const rg = ctx.createRadialGradient(cx, cy, 4, cx, cy, 34);
      rg.addColorStop(0, '#0d1014');
      rg.addColorStop(0.55, '#252a32');
      rg.addColorStop(1, '#14181e');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(cx, cy, 34, 0, Math.PI * 2);
      ctx.fill();
    }

    // Horizontal brushed steel bay divider + tiny green/cyan amp status LED
    ctx.fillStyle = '#3f4652';
    ctx.fillRect(18, y0, w - 36, 5);
    ctx.fillStyle = b % 2 === 0 ? '#22d3ee' : '#4ade80';
    ctx.fillRect(w - 32, y0 + 12, 6, 4);
  }

  // Fine perforated acoustic mesh dots across the front
  ctx.fillStyle = 'rgba(8, 10, 14, 0.45)';
  for (let y = 4; y < h; y += 6) {
    for (let x = 24; x < w - 24; x += 6) {
      ctx.fillRect(x, y, 2, 2);
    }
  }

  return finalizeClubTexture(canvas, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping);
}

/**
 * Honed Warm Ivory Terrazzo Stage Floor with Rectangular Brass/Travertine Expansion Grid (`512x512`)
 * matching the Grand DJ Performance Building Top Plan View.
 */
function createDjStageTerrazzoInlayTexture(): THREE.Texture {
  const s = 512;
  const { canvas, ctx } = makeCanvas2d(s, s);
  if (!canvas || !ctx) return makeFallbackDataTex(238, 232, 220);

  ctx.fillStyle = '#eee8dc';
  ctx.fillRect(0, 0, s, s);

  const chipColors = ['#d8cfbe', '#c7bca8', '#b8ad99', '#f7f3ea', '#c9a66b'];
  for (let i = 0; i < 650; i++) {
    const cx = ((i * 73 + 19) % s);
    const cy = ((i * 139 + 41) % s);
    const r = 1.4 + (i % 4) * 1.1;
    ctx.fillStyle = chipColors[i % chipColors.length];
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Crisp architectural stone/brass bay grid matching Top Plan View
  ctx.strokeStyle = 'rgba(176, 146, 94, 0.62)';
  ctx.lineWidth = 4;
  for (const pos of [4, s / 3, (s * 2) / 3, s - 4]) {
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, s);
    ctx.stroke();
  }
  for (const pos of [4, s * 0.5, s - 4]) {
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(s, pos);
    ctx.stroke();
  }

  return finalizeClubTexture(canvas, THREE.RepeatWrapping, THREE.RepeatWrapping);
}

/**
 * Rich Matte Architectural Charcoal-Steel Panel Texture (`512x512`) for the DJ Monumental Canopy.
 */
function createArchitecturalCharcoalSteelTexture(): THREE.Texture {
  const s = 512;
  const { canvas, ctx } = makeCanvas2d(s, s);
  if (!canvas || !ctx) return makeFallbackDataTex(52, 56, 62);

  const g = ctx.createLinearGradient(0, 0, s, s);
  g.addColorStop(0, '#555d68');
  g.addColorStop(0.5, '#454c56');
  g.addColorStop(1, '#5d6672');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);

  // Subtle architectural brushed-metal grain & standing-seam architectural panel lines
  for (let i = 0; i < 420; i++) {
    const x = (i * 97) % s;
    const y = (i * 53) % s;
    const w = 18 + (i % 5) * 14;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.032)' : 'rgba(0,0,0,0.045)';
    ctx.fillRect(x, y, w, 2);
  }
  ctx.strokeStyle = 'rgba(14, 16, 20, 0.35)';
  ctx.lineWidth = 2;
  for (let p = 64; p < s; p += 64) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, s);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let p = 66; p < s; p += 64) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, s);
    ctx.stroke();
  }
  return finalizeClubTexture(canvas, THREE.RepeatWrapping, THREE.RepeatWrapping);
}

/**
 * Painterly Water-Worn Coastal Granite Boulder Texture (`512x512`) matching reference shoreline rocks:
 * pale sunlit sea-grey crown, mineral speckles, and soft darker wet water-line shading near the base.
 */
function createCoastalGraniteBoulderTexture(): THREE.Texture {
  const s = 512;
  const { canvas, ctx } = makeCanvas2d(s, s);
  if (!canvas || !ctx) return makeFallbackDataTex(172, 184, 192);

  // Vertical gradient: pale sunlit top (#cfd9df) -> mid cool sea-granite (#a5b2bc) -> darker wet base (#75848e)
  const vg = ctx.createLinearGradient(0, 0, 0, s);
  vg.addColorStop(0.0, '#d2dce2');
  vg.addColorStop(0.45, '#b2bfc8');
  vg.addColorStop(0.78, '#8d9ca6');
  vg.addColorStop(1.0, '#6e7e88');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, s, s);

  // Soft painterly mineral mottling & subtle granite veins
  for (let i = 0; i < 320; i++) {
    const cx = (i * 89 + 17) % s;
    const cy = (i * 131 + 29) % s;
    const rx = 6 + (i % 7) * 5;
    const ry = 4 + (i % 5) * 4;
    ctx.fillStyle =
      i % 3 === 0
        ? 'rgba(235, 242, 246, 0.14)'
        : i % 3 === 1
          ? 'rgba(92, 106, 118, 0.12)'
          : 'rgba(130, 146, 132, 0.08)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, (i % 6) * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  return finalizeClubTexture(canvas, THREE.RepeatWrapping, THREE.ClampToEdgeWrapping);
}

/**
 * Safely merges multiple sub-geometries into a single non-indexed BufferGeometry with guaranteed position/normal/uv.
 */
function mergeOrganicParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const normalized: THREE.BufferGeometry[] = [];
  for (const raw of parts) {
    const g = raw.index ? raw.toNonIndexed() : raw.clone();
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    if (!g.getAttribute('uv')) {
      const count = g.getAttribute('position').count;
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    for (const key of Object.keys(g.attributes)) {
      if (key !== 'position' && key !== 'normal' && key !== 'uv') {
        g.deleteAttribute(key);
      }
    }
    normalized.push(g);
    raw.dispose();
  }
  const merged = mergeGeometries(normalized, false);
  for (const g of normalized) g.dispose();
  if (!merged) return new THREE.SphereGeometry(0.25, 8, 6);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Smooth Water-Worn Sculpted Coastal Granite Boulder (`20x14` organically deformed sphere — ZERO sharp low-poly facets).
 */
function createSculptedCoastalBoulderGeometry(variant: 0 | 1 | 2): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1.0, 20, 14);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const seed = variant * 2.17 + 0.65;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const n1 = Math.sin(x * 2.3 + seed) * Math.cos(z * 2.1 - seed) * 0.14;
    const n2 = Math.sin((x + z) * 3.7 + y * 2.4 + seed) * 0.065;
    const n3 = Math.cos(x * 1.4 - z * 1.9 + seed * 1.3) * 0.09;
    const radial = 1.0 + n1 + n2 + n3;
    x *= radial * (variant === 1 ? 1.18 : 1.0);
    z *= radial * (variant === 2 ? 1.22 : 0.96);
    // Natural flat-seated base + gently domed water-worn boulder crown
    y = y < 0 ? y * 0.42 : Math.pow(y, 0.88) * 0.78;
    y += n1 * 0.12;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Layered Horizontal Underwater Coral Reef Rock Shelf (2-tier water-eroded rounded reef pads matching reference).
 */
function createReefShelfGeometry(): THREE.BufferGeometry {
  const basePad = createSculptedCoastalBoulderGeometry(1);
  basePad.scale(1.65, 0.46, 0.95);
  basePad.translate(0, 0.05, 0);

  const upperLedge = createSculptedCoastalBoulderGeometry(2);
  upperLedge.scale(1.12, 0.36, 0.68);
  upperLedge.rotateY(0.32);
  upperLedge.translate(0.18, 0.28, -0.06);

  const sideStone = createSculptedCoastalBoulderGeometry(0);
  sideStone.scale(0.62, 0.38, 0.56);
  sideStone.translate(-0.92, 0.12, 0.28);

  return mergeOrganicParts([basePad, upperLedge, sideStone]);
}

/**
 * Multi-Branch Sculpted Staghorn Coral (organic tapered curved trunk + 8 radiating branches & secondary twigs).
 */
function createBranchingCoralGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const addBranch = (
    x0: number,
    y0: number,
    z0: number,
    len: number,
    rBot: number,
    rTop: number,
    tiltX: number,
    tiltZ: number,
  ) => {
    const seg = new THREE.CylinderGeometry(rTop, rBot, len, 7, 2);
    seg.translate(0, len * 0.5, 0);
    seg.rotateX(tiltX);
    seg.rotateZ(tiltZ);
    seg.translate(x0, y0, z0);
    parts.push(seg);

    // Rounded organic coral polyp tip
    const tip = new THREE.SphereGeometry(rTop * 1.15, 7, 5);
    const tipVec = new THREE.Vector3(0, len, 0)
      .applyEuler(new THREE.Euler(tiltX, 0, tiltZ))
      .add(new THREE.Vector3(x0, y0, z0));
    tip.translate(tipVec.x, tipVec.y, tipVec.z);
    parts.push(tip);
    return tipVec;
  };

  // Rooted coral stem splitting into sweeping staghorn forks
  addBranch(0, 0, 0, 0.22, 0.075, 0.055, 0.04, -0.05);
  const dirs: readonly [number, number, number][] = [
    [0.48, 0.32, 0.42],
    [-0.44, 0.38, 0.38],
    [0.26, -0.52, 0.40],
    [-0.32, -0.46, 0.35],
    [0.58, -0.18, 0.32],
    [-0.55, 0.14, 0.34],
  ];
  for (let i = 0; i < dirs.length; i++) {
    const [tx, tz, l] = dirs[i];
    const mid = addBranch(0, 0.16, 0, l, 0.048, 0.032, tx, tz);
    // Secondary upward-forking coral twig
    addBranch(mid.x, mid.y - 0.04, mid.z, l * 0.62, 0.03, 0.02, tx * 0.45 + 0.14, tz * 0.45 - 0.12);
  }
  return mergeOrganicParts(parts);
}

/**
 * Clustered Tubular Sea Anemone / Hollow Sponge Coral (`LatheGeometry` flared tubes matching reference bottom-left).
 */
function createTubeCoralClusterGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const profile = [
    new THREE.Vector2(0.03, 0.0),
    new THREE.Vector2(0.055, 0.08),
    new THREE.Vector2(0.048, 0.24),
    new THREE.Vector2(0.072, 0.36),
    new THREE.Vector2(0.082, 0.42),
    new THREE.Vector2(0.058, 0.43),
    new THREE.Vector2(0.042, 0.32),
  ];
  const specs: readonly [number, number, number, number, number][] = [
    [0.0, 0.0, 1.15, 0.06, -0.04],
    [0.11, 0.06, 0.92, 0.26, -0.22],
    [-0.10, 0.08, 0.84, 0.22, 0.28],
    [0.05, -0.11, 0.78, -0.28, -0.12],
    [-0.08, -0.09, 0.68, -0.24, 0.24],
  ];
  for (const [ox, oz, sc, rx, rz] of specs) {
    const tube = new THREE.LatheGeometry(profile, 10);
    tube.scale(sc, sc, sc);
    tube.rotateX(rx);
    tube.rotateZ(rz);
    tube.translate(ox, 0, oz);
    parts.push(tube);
  }
  return mergeOrganicParts(parts);
}

/**
 * Lush Multi-Blade Arched Underwater Seagrass / Kelp Clump (9 gracefully bent tapered blades).
 */
function createSeagrassClumpGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const bladeCount = 9;
  for (let b = 0; b < bladeCount; b++) {
    const ang = (b / bladeCount) * Math.PI * 2 + (b % 2) * 0.25;
    const h = 0.44 + (b % 3) * 0.14;
    const w = 0.085 + (b % 2) * 0.025;
    const blade = new THREE.PlaneGeometry(w, h, 1, 5);
    const pos = blade.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const py = pos.getY(i) + h * 0.5; // 0..h
      const t = Math.max(0, Math.min(1, py / h));
      // Taper smoothly to a pointed leaf tip + graceful parabolic outward arch
      const px = pos.getX(i) * (1.0 - Math.pow(t, 1.65) * 0.92);
      const bendZ = Math.pow(t, 1.8) * (0.18 + (b % 3) * 0.06);
      pos.setXYZ(i, px, py * (1.0 - t * 0.08), bendZ);
    }
    blade.rotateY(ang);
    blade.translate(Math.cos(ang) * 0.04, 0, Math.sin(ang) * 0.04);
    parts.push(blade);
  }
  return mergeOrganicParts(parts);
}

/**
 * Organic 5-Arm Coastal Starfish resting naturally on sand & shallow reefs.
 */
function createStarfishGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const disc = new THREE.SphereGeometry(0.085, 10, 6);
  disc.scale(1.0, 0.36, 1.0);
  disc.translate(0, 0.028, 0);
  parts.push(disc);

  for (let a = 0; a < 5; a++) {
    const ang = (a / 5) * Math.PI * 2;
    const arm = new THREE.ConeGeometry(0.048, 0.22, 7);
    arm.scale(1.0, 1.0, 0.45);
    arm.rotateX(Math.PI * 0.5);
    arm.translate(0, 0.024, 0.12);
    arm.rotateY(ang);
    parts.push(arm);
  }
  return mergeOrganicParts(parts);
}

/**
 * Sculpted Coastal Red Crab (domed oval carapace + 2 curved front pincer claws + 6 splayed walking legs).
 */
function createCoastalCrabGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // Sculpted domed oval crab shell
  const body = new THREE.SphereGeometry(0.13, 12, 8);
  body.scale(1.25, 0.52, 0.92);
  body.translate(0, 0.075, 0);
  parts.push(body);

  // Twin curved front pincer arms & chelae
  for (const sgn of [-1, 1]) {
    const upperArm = new THREE.CylinderGeometry(0.022, 0.026, 0.12, 6);
    upperArm.rotateZ(sgn * 1.15);
    upperArm.rotateY(sgn * 0.45);
    upperArm.translate(sgn * 0.15, 0.075, 0.09);
    parts.push(upperArm);

    const claw = new THREE.SphereGeometry(0.044, 8, 6);
    claw.scale(1.2, 0.72, 0.85);
    claw.rotateY(sgn * -0.4);
    claw.translate(sgn * 0.17, 0.085, 0.16);
    parts.push(claw);

    // 3 splayed walking legs per side (6 total)
    for (let leg = 0; leg < 3; leg++) {
      const zOff = 0.03 - leg * 0.065;
      const femur = new THREE.CylinderGeometry(0.013, 0.015, 0.13, 5);
      femur.rotateZ(sgn * 1.25);
      femur.translate(sgn * 0.17, 0.065, zOff);
      parts.push(femur);

      const tibia = new THREE.CylinderGeometry(0.008, 0.013, 0.11, 5);
      tibia.rotateZ(sgn * 0.42);
      tibia.translate(sgn * 0.24, 0.03, zOff);
      parts.push(tibia);
    }

    // Tiny raised eyestalks
    const eye = new THREE.CylinderGeometry(0.01, 0.012, 0.045, 5);
    eye.translate(sgn * 0.045, 0.125, 0.09);
    parts.push(eye);
  }
  return mergeOrganicParts(parts);
}

/**
 * Streamlined Shallow-Water Tropical Fish (fusiform body + forked caudal tail fin + dorsal & pectoral fins).
 */
function createShallowFishGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // Sleek streamlined body oriented along +Z
  const body = new THREE.SphereGeometry(0.085, 10, 8);
  body.scale(0.45, 0.78, 2.35);
  parts.push(body);

  // Forked V-shaped caudal tail fin at -Z
  for (const sgn of [-1, 1]) {
    const tailLobe = new THREE.ConeGeometry(0.042, 0.15, 4);
    tailLobe.scale(0.28, 1.0, 1.0);
    tailLobe.rotateX(-Math.PI * 0.5 + sgn * 0.36);
    tailLobe.translate(0, sgn * 0.032, -0.22);
    parts.push(tailLobe);
  }

  // Swept dorsal fin on top
  const dorsal = new THREE.ConeGeometry(0.035, 0.12, 4);
  dorsal.scale(0.24, 1.0, 1.6);
  dorsal.rotateX(-0.42);
  dorsal.translate(0, 0.075, -0.02);
  parts.push(dorsal);

  // Twin side pectoral fins
  for (const sgn of [-1, 1]) {
    const pec = new THREE.ConeGeometry(0.025, 0.09, 4);
    pec.scale(0.25, 1.0, 1.0);
    pec.rotateZ(sgn * 1.15);
    pec.rotateY(sgn * -0.4);
    pec.translate(sgn * 0.045, -0.018, 0.05);
    parts.push(pec);
  }
  return mergeOrganicParts(parts);
}

/**
 * Spiny Coastal Sea Urchin resting beside shallow reef boulders (matching reference bottom-left).
 */
function createSeaUrchinGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const core = new THREE.SphereGeometry(0.08, 8, 6);
  core.scale(1.0, 0.65, 1.0);
  core.translate(0, 0.045, 0);
  parts.push(core);

  for (let ring = 0; ring < 2; ring++) {
    const count = ring === 0 ? 10 : 8;
    const elev = ring === 0 ? 0.52 : 1.08;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + ring * 0.3;
      const spine = new THREE.ConeGeometry(0.009, 0.17, 4);
      spine.translate(0, 0.085, 0);
      spine.rotateZ(Math.PI * 0.5 - elev);
      spine.rotateY(ang);
      spine.translate(0, 0.045, 0);
      parts.push(spine);
    }
  }
  return mergeOrganicParts(parts);
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

  // Subtle flush cream sandstone border curbstones framing Ground-Level Promenade (+0.02m -> +0.05m),
  // cleanly broken at every staircase entrance so curbs never clip across steps!
  const westCurbLen = 43.8 - prom.minZ;
  addWorldPart(
    staticClubGroup,
    applyBoxMetricUvs(new THREE.BoxGeometry(0.28, 0.08, westCurbLen), 2.5, 2.5),
    '#efe7da',
    [prom.minX + 0.14, prom.elevY - 0.01, (prom.minZ + 43.8) * 0.5],
    [0, 0, 0],
    { tex: limestoneTex, strokeW: 0.01 },
  );
  for (const [cz0, cz1] of [
    [prom.minZ, -95.5],
    [-92.6, -67.6],
    [-63.8, -17.0],
    [-12.0, 25.4],
    [30.6, 43.8],
  ] as const) {
    const segLen = cz1 - cz0;
    if (segLen > 0.2) {
      addWorldPart(
        staticClubGroup,
        applyBoxMetricUvs(new THREE.BoxGeometry(0.28, 0.08, segLen), 2.5, 2.5),
        '#efe7da',
        [prom.maxX - 0.14, prom.elevY - 0.01, (cz0 + cz1) * 0.5],
        [0, 0, 0],
        { tex: limestoneTex, strokeW: 0.01 },
      );
    }
  }

  // ============================================================================
  // 2. SOLID STEPPED TERRACE PLINTHS & RETAINING RISERS (1:1 with BEACH_CLUB_MASTERPLAN.terraceTiers)
  //    Every dry terrace tier & sub-pool podium is solidly grounded down to -2.15m with zero holes,
  //    zero buried stair steps, and zero Z-fighting overlaps:
  //    - North Arrival (+0.82m / +0.64m) & Cascade Pergola Crown (+0.36m)
  //    - VIP Cabana Mezzanine (+0.64m) -> Mid Lagoon & Lounge (-0.56m) -> Oceanfront Lagoon (-0.96m / -1.00m)
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
    // 2nd terrace (-0.56m) uses crisp white Calacatta marble; other terraces use warm Bali limestone
    const isSecondTerrace = Math.abs(topY - -0.56) < 0.05;
    addWorldPart(
      staticClubGroup,
      applyBoxMetricUvs(new THREE.BoxGeometry(w, 0.14, d), 2.8, 2.8),
      isSecondTerrace ? '#ffffff' : '#ebe2d3',
      [cx, topY - 0.07, cz],
      [0, 0, 0],
      { tex: isSecondTerrace ? calacattaTex : limestoneTex, receiveShadow: true, bounceStrength: 0.18 },
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

  // Helper for solid masonry foundations beneath elevated pool basins (zero floating moats/cascades!)
  const buildSubBasinRetainingPodium = (
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    topY: number,
    baseY = -2.15,
  ) => {
    const h = topY - baseY;
    if (h <= 0.05) return;
    addWorldPart(
      staticClubGroup,
      applyBoxMetricUvs(new THREE.BoxGeometry(maxX - minX, h, maxZ - minZ), 2.2, 1.4),
      '#d5c8b4',
      [(minX + maxX) * 0.5, baseY + h * 0.5, (minZ + maxZ) * 0.5],
      [0, 0, 0],
      { tex: limestoneTex, receiveShadow: true, bounceStrength: 0.12 },
    );
  };

  // North Arrival Courtyard (+0.82m), North VIP Walk (+0.64m) & Dry North Pergola Walkway (+0.36m)
  buildSolidTerraceTierSlab(91.2, 99.6, -96.2, -89.0, 0.82, -2.15);
  buildSolidTerraceTierSlab(91.2, 99.6, -89.0, -77.4, 0.64, -2.15);
  buildSolidTerraceTierSlab(99.6, 120.6, -96.2, -94.0, 0.36, -2.15); // Dry pergola landing flush with cascadeTier1.minZ=-94.0

  // Solid VIP Cabana Mezzanine Deck (+0.64m continuous platform from Promenade to West Moat & Cliff Edge)
  buildSolidTerraceTierSlab(91.2, 96.4, -77.4, 45.02, 0.64, -2.15);
  buildSolidTerraceTierSlab(96.4, 99.6, -77.4, -74.2, 0.64, -2.15); // North-West moat cap
  buildSolidTerraceTierSlab(96.4, 99.6, -51.2, -49.4, 0.64, -2.15); // North flank beside stair_vip_mid_n
  buildSolidTerraceTierSlab(96.4, 99.6, -45.6, -45.0, 0.64, -2.15); // South flank beside stair_vip_mid_n
  buildSolidTerraceTierSlab(96.4, 99.6, -17.2, 7.4, 0.64, -2.15); // Center West VIP entrance mezzanine deck
  // Solid retaining foundations under West Reflection Moats (water +0.52m, floor +0.14m -> grounded to -2.15m)
  buildSubBasinRetainingPodium(96.4, 99.5, -74.2, -51.2, 0.08, -2.15);
  buildSubBasinRetainingPodium(96.4, 99.5, -45.0, -17.2, 0.08, -2.15);

  // West dry walkway strip bordering pool_north_inner_lagoon (x: 99.6..100.4, z: -49.4..-17.6; z <= -49.4 is covered by North Calacatta Plaza)
  buildSolidTerraceTierSlab(99.6, 100.4, -49.4, -17.6, -0.56, -2.15);
  // Central Crosswalk Spine at z = -17.6..-11.2 (-0.56m West -> stair_mid_ocean_n [110.8..112.4] -> -0.96m East, flush w/ stair_beach_c at 120.6)
  buildSolidTerraceTierSlab(99.6, 110.8, -17.6, -11.2, -0.56, -2.15);
  buildSolidTerraceTierSlab(112.4, 120.6, -17.6, -11.2, -0.96, -2.15);
  // Central DJ & Skylight Dance Plaza at z = -11.2..7.4 (-0.56m Mid Plaza + -0.96m Oceanfront Terrace flush w/ stair_beach_cs at 120.8)
  buildSolidTerraceTierSlab(99.6, 112.0, -11.2, 7.4, -0.56, -2.15);
  buildSolidTerraceTierSlab(112.0, 120.8, -11.2, 7.4, -0.96, -2.15);
  // South Inner Lounge Terrace (-0.56m) -> stair_mid_ocean_s [105.2..106.4] -> 2.0m Dry Poolside Promenade (-1.00m) + North/South rims of southSeaPool
  buildSolidTerraceTierSlab(96.4, 105.2, 7.4, 45.02, -0.56, -2.15);
  buildSolidTerraceTierSlab(106.4, 108.4, 7.4, 42.6, -1.0, -2.15); // Poolside promenade west of southSeaPool (clear of stair_mid_ocean_s)
  buildSolidTerraceTierSlab(108.4, 120.6, 7.4, 8.2, -1.0, -2.15); // North rim of southSeaPool
  buildSolidTerraceTierSlab(106.4, 120.8, 42.6, 45.02, -1.0, -2.15); // South-end perimeter terrace flush w/ stair_beach_s at 120.8

  // ============================================================================
  // 2B. TALL, THICK WHITE CALACATTA MARBLE DIVIDING WALL BETWEEN KAI'S BEACH & BEACH CLUB
  //     Spans x = 91.2 .. 123.8 along z = 45.52 (0.92m thick core + 1.08m coping & 1.14m pilasters)
  // ============================================================================
  const sw = mp.southBoundaryWall;
  const swUpperW = sw.stepX - sw.minX;
  const swUpperCx = (sw.minX + sw.stepX) * 0.5;
  const swUpperH = sw.upperTopY - sw.baseY;
  // Upper section (VIP Mezzanine & Mid Lounge Terrace: x = 91.2 .. 106.4, top = +3.35m)
  addWorldPart(
    staticClubGroup,
    applyBoxMetricUvs(new THREE.BoxGeometry(swUpperW, swUpperH - 0.18, sw.thicknessZ), 2.6, 2.6),
    '#ffffff',
    [swUpperCx, sw.baseY + (swUpperH - 0.18) * 0.5, sw.cz],
    [0, 0, 0],
    { tex: calacattaTex, strokeW: 0.015, castShadow: true, receiveShadow: true },
  );
  // Overhanging White Calacatta Marble crown coping + brushed-brass reveal band on Upper section
  addWorldPart(
    staticClubGroup,
    applyBoxMetricUvs(new THREE.BoxGeometry(swUpperW + 0.16, 0.2, sw.thicknessZ + 0.18), 2.4, 2.4),
    '#ffffff',
    [swUpperCx, sw.upperTopY - 0.1, sw.cz],
    [0, 0, 0],
    { tex: calacattaTex, strokeW: 0.014, castShadow: true, receiveShadow: true },
  );
  addCustomMatPart(
    staticClubGroup,
    new THREE.BoxGeometry(swUpperW + 0.08, 0.06, sw.thicknessZ + 0.08),
    brushedBrassMat,
    [swUpperCx, sw.upperTopY - 0.23, sw.cz],
    [0, 0, 0],
    { castShadow: true, receiveShadow: true },
  );

  // Lower oceanfront section (South Ocean Lagoon & Beachfront Stair: x = 106.4 .. 123.8, top = +2.55m)
  const swLowerW = sw.maxX - sw.stepX;
  const swLowerCx = (sw.stepX + sw.maxX) * 0.5;
  const swLowerH = sw.lowerTopY - sw.baseY;
  addWorldPart(
    staticClubGroup,
    applyBoxMetricUvs(new THREE.BoxGeometry(swLowerW, swLowerH - 0.18, sw.thicknessZ), 2.6, 2.6),
    '#ffffff',
    [swLowerCx, sw.baseY + (swLowerH - 0.18) * 0.5, sw.cz],
    [0, 0, 0],
    { tex: calacattaTex, strokeW: 0.015, castShadow: true, receiveShadow: true },
  );
  addWorldPart(
    staticClubGroup,
    applyBoxMetricUvs(new THREE.BoxGeometry(swLowerW + 0.16, 0.2, sw.thicknessZ + 0.18), 2.4, 2.4),
    '#ffffff',
    [swLowerCx, sw.lowerTopY - 0.1, sw.cz],
    [0, 0, 0],
    { tex: calacattaTex, strokeW: 0.014, castShadow: true, receiveShadow: true },
  );
  addCustomMatPart(
    staticClubGroup,
    new THREE.BoxGeometry(swLowerW + 0.08, 0.06, sw.thicknessZ + 0.08),
    brushedBrassMat,
    [swLowerCx, sw.lowerTopY - 0.23, sw.cz],
    [0, 0, 0],
    { castShadow: true, receiveShadow: true },
  );

  // Molded White Calacatta Marble base plinth skirting both sides along the full 32.6m length
  const swFullW = sw.maxX - sw.minX;
  const swFullCx = (sw.minX + sw.maxX) * 0.5;
  addWorldPart(
    staticClubGroup,
    applyBoxMetricUvs(new THREE.BoxGeometry(swFullW + 0.08, 3.05, sw.thicknessZ + 0.12), 2.6, 2.0),
    '#ffffff',
    [swFullCx, sw.baseY + 1.525, sw.cz],
    [0, 0, 0],
    { tex: calacattaTex, strokeW: 0.012, receiveShadow: true },
  );

  // 8 Classical White Calacatta Marble Square Pilasters / Boundary Columns with stepped capitals
  for (const px of [91.6, 96.4, 101.4, 106.4, 111.0, 115.6, 120.2, 123.4]) {
    const pTopY = px <= sw.stepX + 0.05 ? sw.upperTopY + 0.14 : sw.lowerTopY + 0.14;
    const pH = pTopY - sw.baseY;
    addWorldPart(
      staticClubGroup,
      applyBoxMetricUvs(new THREE.BoxGeometry(0.84, pH - 0.16, sw.thicknessZ + 0.22), 2.0, 2.4),
      '#ffffff',
      [px, sw.baseY + (pH - 0.16) * 0.5, sw.cz],
      [0, 0, 0],
      { tex: calacattaTex, strokeW: 0.014, castShadow: true, receiveShadow: true },
    );
    addWorldPart(
      staticClubGroup,
      applyBoxMetricUvs(new THREE.BoxGeometry(0.98, 0.18, sw.thicknessZ + 0.34), 1.8, 1.8),
      '#ffffff',
      [px, pTopY - 0.08, sw.cz],
      [0, 0, 0],
      { tex: calacattaTex, strokeW: 0.012, castShadow: true, receiveShadow: true },
    );
  }

  // Sleek Coastal Brushed-Brass & Low-Iron Glass Balustrade along the +0.64m South VIP Cliff Edge
  // (x=96.26, z in [14.2..25.0], aligned 1:1 with beach_club_retaining_vip_south_mid and clear of both south stairs!)
  const vipRailMinZ = 14.2;
  const vipRailMaxZ = 25.0;
  const vipRailLen = vipRailMaxZ - vipRailMinZ;
  const vipRailCz = (vipRailMinZ + vipRailMaxZ) * 0.5;
  const vipRailX = 96.26;
  const vipRailBaseY = 0.64;
  // Low honed limestone curb plinth
  addWorldPart(
    staticClubGroup,
    applyBoxMetricUvs(new THREE.BoxGeometry(0.18, 0.1, vipRailLen), 2.0, 1.0),
    '#efe7da',
    [vipRailX, vipRailBaseY + 0.05, vipRailCz],
    [0, 0, 0],
    { tex: limestoneTex, strokeW: 0.008, receiveShadow: true },
  );
  // Brushed-brass top handrail & bottom channel
  addCustomMatPart(
    staticClubGroup,
    new THREE.BoxGeometry(0.06, 0.045, vipRailLen),
    brushedBrassMat,
    [vipRailX, vipRailBaseY + 0.92, vipRailCz],
    [0, 0, 0],
    { castShadow: true, receiveShadow: true },
  );
  addCustomMatPart(
    staticClubGroup,
    new THREE.BoxGeometry(0.05, 0.04, vipRailLen),
    brushedBrassMat,
    [vipRailX, vipRailBaseY + 0.12, vipRailCz],
    [0, 0, 0],
    { receiveShadow: true },
  );
  // Brushed-brass stanchion posts every ~2.7m + clear coastal glass panels between posts
  const railBays = 4;
  const railBayLen = vipRailLen / railBays;
  for (let i = 0; i <= railBays; i++) {
    const pz = vipRailMinZ + i * railBayLen;
    addCustomMatPart(
      staticClubGroup,
      new THREE.BoxGeometry(0.055, 0.84, 0.055),
      brushedBrassMat,
      [vipRailX, vipRailBaseY + 0.5, pz],
      [0, 0, 0],
      { castShadow: true, receiveShadow: true },
    );
    if (i < railBays) {
      addCustomMatPart(
        staticClubGroup,
        new THREE.BoxGeometry(0.025, 0.74, railBayLen - 0.08),
        barTintedGlassMat,
        [vipRailX, vipRailBaseY + 0.51, pz + railBayLen * 0.5],
        [0, 0, 0],
        { receiveShadow: false, renderOrder: 3 },
      );
    }
  }

  // ============================================================================
  // 3. BROAD CASCADING LIMESTONE & TIMBER STAIRWAYS CONNECTING EVERY TIER ("Bertangga-tangga")
  //    Exact flush non-overlapping treads (zero side Z-fighting) grounded solidly into lower tiers!
  // ============================================================================
  for (const sf of mp.stairFlights) {
    const inset0 = 0.015;
    const effMinX = sf.axis === 'x' ? sf.minX + inset0 : sf.minX;
    const effMinZ = sf.axis === 'z' ? sf.minZ + inset0 : sf.minZ;
    const w = sf.maxX - effMinX;
    const d = sf.maxZ - effMinZ;
    const cx = (effMinX + sf.maxX) * 0.5;
    const cz = (effMinZ + sf.maxZ) * 0.5;
    const nSteps = Math.max(2, sf.steps);
    const minElev = Math.max(-2.12, Math.min(sf.fromElevY, sf.toElevY) - 0.55);

    for (let s = 0; s < nSteps; s++) {
      const frac0 = s / nSteps;
      const frac1 = (s + 1) / nSteps;
      const topY = sf.fromElevY + (sf.toElevY - sf.fromElevY) * ((frac0 + frac1) * 0.5);
      const treadH = Math.max(0.14, topY - minElev);
      const stepCenterY = topY - treadH * 0.5;

      if (sf.axis === 'x') {
        const stepW = w / nSteps;
        const sx = effMinX + (s + 0.5) * stepW;
        addWorldPart(
          staticClubGroup,
          applyBoxMetricUvs(new THREE.BoxGeometry(stepW - 0.004, treadH, d - 0.01), 2.0, 2.0),
          s % 2 === 0 ? '#efe7da' : '#e5dac7',
          [sx, stepCenterY, cz],
          [0, 0, 0],
          { tex: limestoneTex, strokeW: 0.01, castShadow: true, receiveShadow: true },
        );
      } else {
        const stepD = d / nSteps;
        const sz = effMinZ + (s + 0.5) * stepD;
        addWorldPart(
          staticClubGroup,
          applyBoxMetricUvs(new THREE.BoxGeometry(w - 0.01, treadH, stepD - 0.004), 2.0, 2.0),
          s % 2 === 0 ? '#efe7da' : '#e5dac7',
          [cx, stepCenterY, sz],
          [0, 0, 0],
          { tex: limestoneTex, strokeW: 0.01, castShadow: true, receiveShadow: true },
        );
      }
    }
  }

  // Lush Stepped Tropical Foliage Planter Borders (1:1 synced with BEACH_CLUB_MASTERPLAN.planters!)
  // Layered dark-emerald base hedge + dense sculpted tropical bush mounds + warm coral/gold tropical blooms!
  const foliageLeafMat = makeWorldBlitzMat('#2e7d36', undefined, 0.16);
  const tropicalBushMidMat = makeWorldBlitzMat('#43a849', undefined, 0.14);
  const tropicalBushSunMat = makeWorldBlitzMat('#6bc452', undefined, 0.12);
  const tropicalBloomMat = makeWorldBlitzMat('#f97316', undefined, 0.1);
  const bushMidMatrices: THREE.Matrix4[] = [];
  const bushSunMatrices: THREE.Matrix4[] = [];
  const bloomMatrices: THREE.Matrix4[] = [];
  const planterDummy = new THREE.Object3D();

  for (let pIdx = 0; pIdx < mp.planters.length; pIdx++) {
    const pl = mp.planters[pIdx];
    const stoneBaseY = pl.baseY - 0.08;
    const stoneTopY = pl.baseY + 0.32;
    const stoneH = stoneTopY - stoneBaseY;
    const bushH = Math.max(0.26, pl.topY - stoneTopY + 0.08);
    addWorldPart(
      staticClubGroup,
      applyBoxMetricUvs(new THREE.BoxGeometry(pl.widthX, stoneH, pl.lengthZ), 1.8, 1.8),
      '#e5dccb',
      [pl.cx, stoneBaseY + stoneH * 0.5, pl.cz],
      [0, 0, 0],
      { tex: limestoneTex, strokeW: 0.01, castShadow: true, receiveShadow: true },
    );
    addCustomMatPart(
      staticClubGroup,
      new RoundedBoxGeometry(pl.widthX * 0.86, bushH, Math.max(0.4, pl.lengthZ - 0.25), 2, 0.14),
      foliageLeafMat,
      [pl.cx, pl.topY - bushH * 0.48, pl.cz],
      [0, 0, 0],
      { castShadow: true, receiveShadow: true },
    );

    // Populate dense sculpted tropical shrub mounds along the planter length
    const countZ = Math.max(2, Math.round(pl.lengthZ / 1.05));
    const zSpan = Math.max(0.2, pl.lengthZ - 0.6);
    for (let k = 0; k < countZ; k++) {
      const frac = countZ === 1 ? 0.5 : k / (countZ - 1);
      const pz = pl.cz - zSpan * 0.5 + frac * zSpan;
      const seed = pIdx * 31 + k * 17;
      const jitterX = (Math.sin(seed * 1.7) * 0.5) * Math.max(0.1, pl.widthX * 0.32);
      const sScale = 0.82 + ((Math.sin(seed * 2.3) + 1) * 0.5) * 0.42;

      planterDummy.position.set(pl.cx + jitterX, pl.topY + 0.16 * sScale, pz);
      planterDummy.rotation.set(0, seed * 0.9, 0);
      planterDummy.scale.set(
        Math.min(1.15, pl.widthX * 0.62 * sScale),
        0.78 * sScale,
        0.95 * sScale,
      );
      planterDummy.updateMatrix();
      if (k % 2 === 0) {
        bushMidMatrices.push(planterDummy.matrix.clone());
      } else {
        bushSunMatrices.push(planterDummy.matrix.clone());
      }

      if (k % 3 === 1) {
        planterDummy.position.set(pl.cx - jitterX * 0.6, pl.topY + 0.34 * sScale, pz + 0.12);
        planterDummy.rotation.set(0.2, seed * 1.3, 0.15);
        planterDummy.scale.set(0.85, 0.9, 0.85);
        planterDummy.updateMatrix();
        bloomMatrices.push(planterDummy.matrix.clone());
      }
    }
  }
  const addPlanterInstBatch = (geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[]) => {
    if (mats.length === 0) return;
    trackGeo(geo);
    const inst = new THREE.InstancedMesh(geo, mat, mats.length);
    for (let i = 0; i < mats.length; i++) inst.setMatrixAt(i, mats[i]);
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = !isSoftwareGl;
    inst.receiveShadow = !isSoftwareGl;
    computeInstancedBoundingVolumes(inst, { padding: 0.5, frustumCulled: true });
    dynamicClubGroup.add(inst);
    meshCount++;
  };
  addPlanterInstBatch(new THREE.IcosahedronGeometry(0.48, 1), tropicalBushMidMat, bushMidMatrices);
  addPlanterInstBatch(new THREE.IcosahedronGeometry(0.44, 1), tropicalBushSunMat, bushSunMatrices);
  addPlanterInstBatch(new THREE.DodecahedronGeometry(0.14, 0), tropicalBloomMat, bloomMatrices);

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

  // A. North White Calacatta Marble Plaza (-0.56m flat terrace replacing the old North cascade pools, North canal/sea pools, & North timber deck)
  buildSolidTerraceTierSlab(99.6, 120.6, -94.0, -49.4, -0.56, -2.15);

  // North Arrival Crown Open-Air Timber Pergola Pavilion (`z in [-96.2 .. -94.0]`, clear of stair_cascade_e1 at x<=101.6!)
  const cas1 = mp.pools.cascadeTier1;
  const pergolaZ = -95.1;
  const pergolaBaseY = cas1.deckY; // +0.36m solid dry terrace slab
  for (const px of [102.2, 106.2, 110.2, 114.2, 118.2]) {
    addCustomMatPart(
      staticClubGroup,
      new THREE.BoxGeometry(0.22, 3.1, 0.22),
      getWoodMat('cedar', '#9f7046', 0.8),
      [px, pergolaBaseY + 1.55, pergolaZ],
      [0, 0, 0],
      { castShadow: true, receiveShadow: true },
    );
  }
  // Twin perimeter oak header beams + open slatted cedar rafters casting dappled pergola shadows
  for (const bzOff of [-0.82, 0.82]) {
    addCustomMatPart(
      staticClubGroup,
      applyBoxMetricUvs(new THREE.BoxGeometry(17.2, 0.18, 0.18), 2.2, 2.2),
      getWoodMat('oak', '#b68658', 0.78),
      [110.2, pergolaBaseY + 3.12, pergolaZ + bzOff],
      [0, 0, 0],
      { castShadow: true, receiveShadow: true },
    );
  }
  for (let rx = 102.0; rx <= 118.5; rx += 0.92) {
    addCustomMatPart(
      staticClubGroup,
      applyBoxMetricUvs(new THREE.BoxGeometry(0.11, 0.12, 2.05), 2.0, 2.0),
      getWoodMat('cedar', '#a7764a', 0.8),
      [rx, pergolaBaseY + 3.24, pergolaZ],
      [0, 0, 0],
      { castShadow: true, receiveShadow: true },
    );
  }

  // B. West Upper Reflection Moat beside VIP Cabanas (`waterY = +0.52m`) + Lowered Inner Cascade Lagoon (`waterY = -0.60m`)
  //    + Lowered Seaward Oceanfront Infinity Lagoons (`waterY = -0.98m`, 1.02m waterfall drop onto `-2.00m` beach sand)!
  buildInfinityPoolBasin(mp.pools.westFlankNorth, 0.52, 0.14, { copingMarginY: 0.04 });
  buildInfinityPoolBasin(mp.pools.westFlankSouth, 0.52, 0.14, { copingMarginY: 0.04 });

  // Inner Reflection Lagoon (-0.60m, raised +0.055m coping margin above -0.56m terrace) + Seaward Oceanfront Lagoons (-0.98m)
  buildInfinityPoolBasin(mp.pools.lapChannels[0], -0.6, -0.96, {
    eastInfinityWeir: false,
    copingMarginY: 0.055,
  });
  for (const seaChan of mp.pools.lapChannels.slice(1)) {
    buildSubBasinRetainingPodium(seaChan.minX, seaChan.maxX, seaChan.minZ, seaChan.maxZ, -1.42, -2.15);
    buildInfinityPoolBasin(seaChan, -0.98, -1.36, {
      eastInfinityWeir: true,
      eastWeirBaseY: -2.04,
      copingMarginY: 0.04,
    });
  }

  // C. Raised Coastal-Oak Timber Sunbed Peninsula (`x in [105.0..112.2], z in [-75.0..-17.4], top = -0.54m`)
  //    & Full-Width Cross-Water Timber Jetty Bridge (`z in [-49.4..-45.6], top = -0.48m`)
  const pen = mp.sunbedPeninsula;
  const penW = pen.maxX - pen.minX;
  const penD = pen.maxZ - pen.minZ;
  const penCx = (pen.minX + pen.maxX) * 0.5;
  const penCz = (pen.minZ + pen.maxZ) * 0.5;
  addCustomMatPart(
    staticClubGroup,
    applyBoxMetricUvs(new THREE.BoxGeometry(penW, 0.22, penD), 2.6, 2.6),
    getWoodMat('oak', '#cfa678', 0.8),
    [penCx, pen.elevY - 0.11, penCz],
    [0, 0, 0],
    { castShadow: false, receiveShadow: true },
  );
  // Solid masonry foundation skirt beneath Timber Sunbed Peninsula so it anchors into the -1.36m pool bed!
  buildSubBasinRetainingPodium(pen.minX + 0.04, pen.maxX - 0.04, pen.minZ + 0.04, pen.maxZ - 0.04, pen.elevY - 0.22, -1.55);

  const jetty = mp.northJettyBridge;
  addCustomMatPart(
    staticClubGroup,
    applyBoxMetricUvs(new THREE.BoxGeometry(jetty.maxX - jetty.minX, 0.18, jetty.maxZ - jetty.minZ), 2.2, 2.2),
    getWoodMat('cedar', '#bc8d5f', 0.78),
    [(jetty.minX + jetty.maxX) * 0.5, jetty.elevY - 0.09, (jetty.minZ + jetty.maxZ) * 0.5],
    [0, 0, 0],
    { castShadow: true, receiveShadow: true },
  );
  // Cedar timber support pilings anchoring North Jetty Bridge cleanly into the lagoon floor (-1.48m)
  const jettyPilingTopY = jetty.elevY - 0.18;
  const jettyPilingH = jettyPilingTopY - -1.48;
  for (const jpx of [102.6, 114.6, 118.8]) {
    for (const jpz of [jetty.minZ + 0.32, jetty.maxZ - 0.32]) {
      addCustomMatPart(
        staticClubGroup,
        new THREE.CylinderGeometry(0.11, 0.12, jettyPilingH, 8),
        getWoodMat('cedar', '#996c44', 0.82),
        [jpx, -1.48 + jettyPilingH * 0.5, jpz],
        [0, 0, 0],
        { castShadow: true, receiveShadow: true },
      );
    }
  }

  // D. Straight Aligned South Beachfront Infinity Lagoon (`-1.02m` water -> `-2.00m` beach sand, rotY = 0!)
  const southPool = mp.pools.southSeaPool;
  buildSubBasinRetainingPodium(
    southPool.cx - southPool.halfX,
    southPool.cx + southPool.halfX,
    southPool.cz - southPool.halfZ,
    southPool.cz + southPool.halfZ,
    -1.46,
    -2.15,
  );
  buildInfinityPoolBasin(southPool, southPool.waterY ?? -1.02, -1.4, {
    isOriented: true,
    eastInfinityWeir: true,
    eastWeirBaseY: -2.04,
    copingMarginY: 0.045,
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

  for (const sgn of [-1, 1]) {
    addCustomMatPart(
      staticClubGroup,
      new THREE.BoxGeometry(brW - 0.2, 0.06, 0.08),
      brushedBrassMat,
      [brCx, bridge.elevY + 0.04, brCz + sgn * (brD * 0.5 - 0.06)],
      [0, 0, 0],
      { castShadow: true, receiveShadow: true },
    );
  }

  // Translucent Glass Skylight Dance Deck behind DJ Stage (-0.48m on -0.56m plaza)
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
    [0, 0, 0],
    { receiveShadow: true },
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
        { receiveShadow: true, renderOrder: 2 },
      );
    }
  }

  // ============================================================================
  // 6. GRAND LUXURY DJ PERFORMANCE BUILDING (cx=104.2, cz=-3.2, rotY=+PI/2 facing East beach & dance floor)
  //    1:1 High-Fidelity Geometry & Custom Procedural Textures matching the 4-View Architectural Model Sheet:
  //    - Multi-tiered Travertine & Terrazzo Stage Terrace (3 chamfered wrap-around travertine steps, shadow-gap risers, warm LED step strips, 3-bay inlaid terrazzo floor)
  //    - Monumental Tapered Cantilevered Dark Charcoal-Steel Canopy (ExtrudeGeometry wedge pitched upward 8.5 deg, recessed soffit tray, 4 recessed linear LED bars, 6 yoke spotlights)
  //    - 4 Fluted Structural Steel Columns (central shaft + 8 vertical fluting ribs + bolted square steel base plates + angled steel canopy gussets)
  //    - Grand Panoramic Iridescent Aurora LED Media Wall (custom 1024x512 aurora wave texture inside deep multi-stepped beveled dark steel bezel + side acoustic louvers)
  //    - Calacatta Marble Master DJ Console (dark steel kick-plinth & C-frame, bookmatched marble slabs, Pioneer CDJ-3000 dual decks w/ OLED screens, 4-ch mixer, booth monitors)
  //    - Concert Line-Array Audio Towers (multi-tier perforated-grille wing racks, angled floor subs, & suspended 4-element curved J-array line-array hangs)
  //    - Enclosed 2-Level Backstage Sound Engineering Control Room & VIP Viewing Mezzanine + 7-Riser Steel Access Stairs with Clear Glass Balustrade
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

  const stageTopY = dj.stageDeckTopY; // -0.04 (+0.52m above -0.56m white marble plaza)
  const djDeckBottomY = -1.12;
  const djDeckTotalH = stageTopY - djDeckBottomY;

  // Dedicated high-resolution procedural textures & materials for the Grand DJ Building
  const djLedWallTex = trackTex(createDjPanoramicLedWallTexture());
  const djSpeakerGrilleTex = trackTex(createConcertSpeakerGrilleTexture());
  const djTerrazzoGridTex = trackTex(createDjStageTerrazzoInlayTexture());
  const djCharcoalSteelTex = trackTex(createArchitecturalCharcoalSteelTexture());

  const djCanopySteelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: djCharcoalSteelTex,
      roughness: 0.5,
      metalness: 0.32,
    }),
  );
  const djCanopySoffitMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#2e343d',
      roughness: 0.58,
      metalness: 0.28,
    }),
  );
  const djLedWallMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: djLedWallTex,
      emissive: '#ffffff',
      emissiveMap: djLedWallTex,
      emissiveIntensity: 0.72,
      roughness: 0.22,
      metalness: 0.08,
    }),
  );
  const djSpeakerGrilleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: djSpeakerGrilleTex,
      roughness: 0.52,
      metalness: 0.42,
    }),
  );
  const djLinearLightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#fff8e7',
      emissive: '#ffe9b8',
      emissiveIntensity: 1.35,
      roughness: 0.15,
    }),
  );

  // 1. MULTI-TIERED TRAVERTINE & TERRAZZO STAGE TERRACE (matches Top Plan & 3/4 Isometric!)
  addWorldPart(
    djStaticGrp,
    applyBoxMetricUvs(new THREE.BoxGeometry(dj.widthM, djDeckTotalH, dj.depthM), 3.5, 3.5),
    '#ffffff',
    [0, djDeckBottomY + djDeckTotalH * 0.5, 0],
    [0, 0, 0],
    { tex: djTerrazzoGridTex, strokeW: 0.014, castShadow: true, receiveShadow: true },
  );
  // Raised travertine border curb framing the terrazzo stage bay (matches Top Plan border)
  for (const bz of [-dj.depthM * 0.5 + 0.22, dj.depthM * 0.5 - 0.22]) {
    addWorldPart(
      djStaticGrp,
      applyBoxMetricUvs(new THREE.BoxGeometry(dj.widthM, 0.05, 0.44), 2.4, 1.0),
      '#e9e1d2',
      [0, stageTopY + 0.025, bz],
      [0, 0, 0],
      { tex: limestoneTex, receiveShadow: true },
    );
  }
  // 3 Broad Wrap-Around Chamfered Travertine Steps with Dark Recessed Shadow-Gap Risers & Warm LED Under-Step Strips
  const stepDepth = 0.48;
  for (let st = 0; st < 3; st++) {
    const stepTop = stageTopY - (st + 1) * 0.172;
    const stepH = Math.max(0.14, stepTop - djDeckBottomY);
    const pad = (st + 1) * stepDepth;
    const stepW = dj.widthM + pad * 2;
    const stepD = dj.depthM + pad;
    addWorldPart(
      djStaticGrp,
      applyBoxMetricUvs(new THREE.BoxGeometry(stepW, stepH, stepD), 2.6, 2.6),
      '#e8e0d0',
      [0, djDeckBottomY + stepH * 0.5, pad * 0.5],
      [0, 0, 0],
      { tex: limestoneTex, strokeW: 0.01, castShadow: true, receiveShadow: true },
    );
    // Crisp recessed dark shadow reveal + warm amber LED strip tucked under each front step nosing
    addCustomMatPart(
      djStaticGrp,
      new THREE.BoxGeometry(stepW - 0.08, 0.028, 0.035),
      warmAmberGlowMat,
      [0, stepTop - 0.04, dj.depthM * 0.5 + pad + 0.012],
    );
  }

  // 2. MONUMENTAL TAPERED CANTILEVERED DARK CHARCOAL-STEEL CANOPY (ExtrudeGeometry wedge matching Side Profile!)
  const roofY = stageTopY + 5.72;
  const djCanopyW = dj.widthM + 0.85; // 14.85m
  const djCanopyD = dj.depthM + 1.35; // 9.95m
  const roofPivot = new THREE.Group();
  roofPivot.position.set(0, roofY, 0.45);
  roofPivot.rotation.x = THREE.MathUtils.degToRad(-8.5); // dramatic upward architectural cantilever toward beach!
  djStaticGrp.add(roofPivot);

  // Sculpted tapered wedge cross-section in YZ extruded across X (thick 0.52m angled front brow -> slim 0.28m rear overhang!)
  const canopyShape = new THREE.Shape();
  const halfD = djCanopyD * 0.5;
  canopyShape.moveTo(-halfD, -0.14); // rear bottom
  canopyShape.lineTo(halfD - 0.22, -0.26); // front soffit chamfer
  canopyShape.lineTo(halfD + 0.16, 0.24); // angled overhanging front brow lip!
  canopyShape.lineTo(-halfD - 0.08, 0.14); // rear top lip
  canopyShape.closePath();
  const canopyExtrudeGeo = new THREE.ExtrudeGeometry(canopyShape, {
    depth: djCanopyW,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  // Rotate so extrusion depth runs along X [-djCanopyW/2 .. +djCanopyW/2] and shape X runs along +Z
  canopyExtrudeGeo.rotateY(-Math.PI / 2);
  canopyExtrudeGeo.translate(djCanopyW * 0.5, 0, 0);
  canopyExtrudeGeo.computeVertexNormals();
  addCustomMatPart(roofPivot, canopyExtrudeGeo, djCanopySteelMat, [0, 0, 0], [0, 0, 0], {
    castShadow: true,
    receiveShadow: true,
  });

  // Recessed dark coffered soffit ceiling tray + perimeter metallic drip fascia
  addCustomMatPart(
    roofPivot,
    new THREE.BoxGeometry(djCanopyW - 0.9, 0.06, djCanopyD - 1.1),
    djCanopySoffitMat,
    [0, -0.22, 0.05],
  );
  // 4 Recessed Linear Warm-White Architectural LED Light Bars running front-to-back in soffit channels (exact Front Elevation!)
  for (const lx of [-3.6, -1.2, 1.2, 3.6]) {
    addCustomMatPart(
      roofPivot,
      new THREE.BoxGeometry(0.28, 0.05, djCanopyD - 2.35),
      blackSteelMat,
      [lx, -0.24, 0.18],
    );
    addCustomMatPart(
      roofPivot,
      new THREE.BoxGeometry(0.14, 0.04, djCanopyD - 2.55),
      djLinearLightMat,
      [lx, -0.265, 0.18],
    );
  }
  // Underside transverse structural steel ceiling beams tying into the columns
  for (const bz of [-2.05, 1.35]) {
    addCustomMatPart(
      roofPivot,
      new THREE.BoxGeometry(djCanopyW - 1.4, 0.16, 0.24),
      blackSteelMat,
      [0, -0.28, bz - 0.45],
      [0, 0, 0],
      { castShadow: true },
    );
  }

  // 3. FOUR MONUMENTAL FLUTED STRUCTURAL STEEL COLUMNS (bolted base plates + 8 vertical fluting ribs + upper steel gussets)
  for (const [cx, cz, colH] of [
    [-5.15, 1.35, 5.88],
    [5.15, 1.35, 5.88],
    [-5.15, -2.05, 5.36],
    [5.15, -2.05, 5.36],
  ] as const) {
    // Central cylindrical steel core
    addCustomMatPart(
      djStaticGrp,
      new THREE.CylinderGeometry(0.24, 0.26, colH, 16),
      djCanopySteelMat,
      [cx, stageTopY + colH * 0.5, cz],
      [0, 0, 0],
      { castShadow: true, receiveShadow: true },
    );
    // 8 architectural vertical fluting ribs around column shaft (matches Front Elevation & 3/4 Isometric!)
    for (let fl = 0; fl < 8; fl++) {
      const ang = (fl / 8) * Math.PI * 2;
      addCustomMatPart(
        djStaticGrp,
        new THREE.BoxGeometry(0.055, colH - 0.18, 0.055),
        blackSteelMat,
        [cx + Math.cos(ang) * 0.25, stageTopY + colH * 0.5, cz + Math.sin(ang) * 0.25],
        [0, ang, 0],
      );
    }
    // Bolted square steel base mounting plate & collar on stage terrace
    addCustomMatPart(
      djStaticGrp,
      new THREE.BoxGeometry(0.74, 0.14, 0.74),
      blackSteelMat,
      [cx, stageTopY + 0.07, cz],
    );
    addCustomMatPart(
      djStaticGrp,
      new THREE.CylinderGeometry(0.32, 0.34, 0.22, 16),
      djCanopySteelMat,
      [cx, stageTopY + 0.22, cz],
    );
    // Upper angled steel capital collar meeting the sloped canopy soffit
    addCustomMatPart(
      djStaticGrp,
      new THREE.BoxGeometry(0.68, 0.24, 0.72),
      blackSteelMat,
      [cx, stageTopY + colH - 0.12, cz],
    );
  }

  // 4. GRAND PANORAMIC IRIDESCENT AURORA LED MEDIA WALL (deep beveled proscenium frame + side acoustic louvers)
  const ledWallY = stageTopY + 2.48;
  const ledWallZ = -1.78;
  // Outer deep proscenium steel surround
  addCustomMatPart(
    djStaticGrp,
    new THREE.BoxGeometry(8.65, 4.35, 0.38),
    djCanopySteelMat,
    [0, ledWallY, ledWallZ - 0.12],
    [0, 0, 0],
    { castShadow: true, receiveShadow: true },
  );
  // Inner crisp matte-black bezel frame
  addCustomMatPart(
    djStaticGrp,
    new THREE.BoxGeometry(8.25, 3.98, 0.28),
    blackSteelMat,
    [0, ledWallY, ledWallZ - 0.02],
  );
  // High-res iridescent aurora LED screen panel (`1024x512` custom gradient wave & LED tile texture!)
  addCustomMatPart(
    djStaticGrp,
    new THREE.PlaneGeometry(7.92, 3.68),
    djLedWallMat,
    [0, ledWallY, ledWallZ + 0.135],
  );
  // Side angled vertical dark-steel acoustic louver fins bridging the LED wall cleanly to the speaker wings
  for (const sgn of [-1, 1]) {
    for (let lv = 0; lv < 4; lv++) {
      addCustomMatPart(
        djStaticGrp,
        new THREE.BoxGeometry(0.08, 4.15, 0.32),
        blackSteelMat,
        [sgn * (4.42 + lv * 0.24), ledWallY, ledWallZ + lv * 0.12],
        [0, sgn * -0.35, 0],
      );
    }
  }

  // 5. CALACATTA MARBLE MASTER DJ CONSOLE (1:1 with Front Elevation, Top Plan & 3/4 Isometric!)
  const consoleZ = 0.96;
  // Recessed dark matte-steel kick-plinth base
  addCustomMatPart(
    djStaticGrp,
    new THREE.BoxGeometry(2.96, 0.18, 1.06),
    blackSteelMat,
    [0, stageTopY + 0.09, consoleZ],
  );
  // Outer structural matte-black steel C-frame shell
  addCustomMatPart(
    djStaticGrp,
    new THREE.BoxGeometry(3.16, 1.36, 1.24),
    blackSteelMat,
    [0, stageTopY + 0.84, consoleZ],
    [0, 0, 0],
    { castShadow: true, receiveShadow: true },
  );
  // Inset bookmatched White Calacatta Marble front facade, side panels & overhanging mitered marble top deck
  addWorldPart(
    djStaticGrp,
    applyBoxMetricUvs(new THREE.BoxGeometry(2.94, 1.18, 0.08), 2.2, 1.6),
    '#ffffff',
    [0, stageTopY + 0.84, consoleZ + 0.61],
    [0, 0, 0],
    { tex: calacattaTex, strokeW: 0.01, castShadow: true },
  );
  for (const sgn of [-1, 1]) {
    addWorldPart(
      djStaticGrp,
      applyBoxMetricUvs(new THREE.BoxGeometry(0.08, 1.18, 1.08), 1.4, 1.6),
      '#ffffff',
      [sgn * 1.56, stageTopY + 0.84, consoleZ],
      [0, 0, 0],
      { tex: calacattaTex },
    );
  }
  addWorldPart(
    djStaticGrp,
    applyBoxMetricUvs(new THREE.BoxGeometry(3.24, 0.11, 1.32), 2.4, 1.4),
    '#ffffff',
    [0, stageTopY + 1.55, consoleZ],
    [0, 0, 0],
    { tex: calacattaTex, strokeW: 0.01, castShadow: true, receiveShadow: true },
  );

  // Detailed Pioneer CDJ-3000 Dual Decks + 4-Channel DJM Mixer + Twin Studio Booth Monitor Speakers
  const djPlatters: THREE.Mesh[] = [];
  const deckTopY = stageTopY + 1.62;
  for (const px of [-0.74, 0.74]) {
    // CDJ chassis body
    addCustomMatPart(djStaticGrp, new THREE.BoxGeometry(0.62, 0.09, 0.66), blackSteelMat, [px, deckTopY + 0.045, consoleZ]);
    // Glowing cyan jog-wheel perimeter ring
    addCustomMatPart(
      djStaticGrp,
      new THREE.TorusGeometry(0.215, 0.014, 8, 22),
      poolCyanLedMat,
      [px, deckTopY + 0.1, consoleZ + 0.05],
      [Math.PI / 2, 0, 0],
    );
    // Spinning dark metallic jog wheel platter
    const platter = addCustomMatPart(
      djDynamicGrp,
      new THREE.CylinderGeometry(0.2, 0.21, 0.036, 18),
      djCanopySteelMat,
      [px, deckTopY + 0.105, consoleZ + 0.05],
    );
    djPlatters.push(platter);
    // Angled full-color OLED waveform display screen on top rear of each CDJ
    addCustomMatPart(
      djStaticGrp,
      new THREE.BoxGeometry(0.38, 0.03, 0.22),
      djLedWallMat,
      [px, deckTopY + 0.12, consoleZ - 0.19],
      [0.24, 0, 0],
    );
  }
  // Center 4-Channel DJ Mixer Chassis + Rotary EQ Strip + Animated Dual Stereo VU Bars
  addCustomMatPart(djStaticGrp, new THREE.BoxGeometry(0.68, 0.09, 0.66), djCanopySteelMat, [0, deckTopY + 0.045, consoleZ]);
  addCustomMatPart(djStaticGrp, new THREE.BoxGeometry(0.56, 0.02, 0.12), stainlessSteelMat, [0, deckTopY + 0.1, consoleZ + 0.22]);
  const djEqBars: THREE.Mesh[] = [];
  for (let b = 0; b < 8; b++) {
    const barMesh = addCustomMatPart(
      djDynamicGrp,
      new THREE.BoxGeometry(0.042, 0.18, 0.036),
      b % 2 === 0 ? poolCyanLedMat : djPurpleWashMat,
      [-0.24 + b * 0.068, deckTopY + 0.16, consoleZ - 0.2],
    );
    djEqBars.push(barMesh);
  }
  // Twin angled compact DJ booth monitor speakers flanking the console ends
  for (const sgn of [-1, 1]) {
    addCustomMatPart(
      djStaticGrp,
      new THREE.BoxGeometry(0.34, 0.44, 0.3),
      djSpeakerGrilleMat,
      [sgn * 1.34, deckTopY + 0.22, consoleZ - 0.26],
      [-0.18, sgn * -0.45, 0],
      { castShadow: true },
    );
  }

  // 6. CONCERT LINE-ARRAY AUDIO TOWERS (Left & Right Wings — 1:1 with Front Elevation, Top Plan & 3/4 Isometric!)
  for (const sgn of [-1, 1]) {
    // A. Tall Multi-Tier Perforated-Grille Concert Subwoofer & Amplifier Wing Rack Tower (x = ±6.15)
    addCustomMatPart(
      djStaticGrp,
      new THREE.BoxGeometry(1.18, 2.75, 1.12),
      djSpeakerGrilleMat,
      [sgn * 6.15, stageTopY + 1.375, -0.35],
      [0, 0, 0],
      { castShadow: true, receiveShadow: true },
    );
    // Steel protective rack exoskeleton bars & top bumper cap around the wing tower
    addCustomMatPart(djStaticGrp, new THREE.BoxGeometry(1.26, 0.1, 1.2), blackSteelMat, [sgn * 6.15, stageTopY + 2.78, -0.35]);
    addCustomMatPart(djStaticGrp, new THREE.BoxGeometry(1.26, 0.1, 1.2), blackSteelMat, [sgn * 6.15, stageTopY + 1.38, -0.35]);

    // B. Angled Floor Concert Subwoofer Cabinets flanking the LED Media Wall (angled ±26 deg inward like Top Plan!)
    addCustomMatPart(
      djStaticGrp,
      new THREE.BoxGeometry(1.05, 1.18, 0.96),
      djSpeakerGrilleMat,
      [sgn * 3.85, stageTopY + 0.59, -0.52],
      [0, sgn * -0.45, 0],
      { castShadow: true, receiveShadow: true },
    );

    // C. Suspended 4-Element Curved J-Array Concert Line-Array Speaker Hang off Front Column!
    // Steel rigging arm & flying bumper bar bolted to front fluted column
    addCustomMatPart(
      djStaticGrp,
      new THREE.BoxGeometry(0.95, 0.1, 0.14),
      blackSteelMat,
      [sgn * 4.78, stageTopY + 4.42, 1.32],
    );
    addCustomMatPart(
      djStaticGrp,
      new THREE.BoxGeometry(0.88, 0.08, 0.68),
      blackSteelMat,
      [sgn * 4.55, stageTopY + 4.35, 1.32],
      [0, sgn * -0.22, 0],
    );
    // 4 progressively curved individual concert line-array speaker enclosures forming an authentic J-array!
    for (let elem = 0; elem < 4; elem++) {
      const pitchDown = 0.06 + elem * 0.11;
      const ey = stageTopY + 4.14 - elem * 0.36;
      const ez = 1.32 - Math.pow(elem, 1.45) * 0.045;
      addCustomMatPart(
        djStaticGrp,
        new THREE.BoxGeometry(0.84, 0.31, 0.62),
        djSpeakerGrilleMat,
        [sgn * 4.55, ey, ez],
        [pitchDown, sgn * -0.22, 0],
        { castShadow: true },
      );
      // Side brushed-steel rigging link straps on each line-array box
      for (const sideX of [-0.43, 0.43]) {
        addCustomMatPart(
          djStaticGrp,
          new THREE.BoxGeometry(0.035, 0.33, 0.12),
          stainlessSteelMat,
          [sgn * 4.55 + sideX, ey, ez + 0.14],
          [pitchDown, sgn * -0.22, 0],
        );
      }
    }
  }

  // 7. ENCLOSED 2-LEVEL BACKSTAGE SOUND ENGINEERING CONTROL ROOM & VIP VIEWING MEZZANINE (Side Profile & Top Plan!)
  const backZ = -3.05;
  // Lower enclosed backstage equipment & cable-channel room
  addCustomMatPart(
    djStaticGrp,
    new THREE.BoxGeometry(10.2, 2.3, 2.15),
    djCanopySteelMat,
    [0, stageTopY + 1.15, backZ],
    [0, 0, 0],
    { castShadow: true, receiveShadow: true },
  );
  // Upper VIP Viewing Mezzanine / Sound Control Booth with recessed glazed observation windows & steel mullions
  addCustomMatPart(
    djStaticGrp,
    new THREE.BoxGeometry(10.2, 2.35, 2.15),
    djCanopySteelMat,
    [0, stageTopY + 3.45, backZ],
    [0, 0, 0],
    { castShadow: true, receiveShadow: true },
  );
  // Panoramic tinted observation windows on rear & side facades of control room
  addCustomMatPart(
    djStaticGrp,
    new THREE.BoxGeometry(6.8, 1.45, 0.08),
    barTintedGlassMat,
    [0, stageTopY + 3.48, backZ - 1.1],
    [0, 0, 0],
    { renderOrder: 3 },
  );
  for (const mx of [-3.4, -1.7, 0, 1.7, 3.4]) {
    addCustomMatPart(djStaticGrp, new THREE.BoxGeometry(0.08, 1.52, 0.12), blackSteelMat, [mx, stageTopY + 3.48, backZ - 1.1]);
  }
  // 3 Detailed Backstage Equipment Rack Cabinets along the side-rear alcove (matches Side Profile & Top Plan!)
  for (const rx of [-3.6, 0, 3.6]) {
    addCustomMatPart(
      djStaticGrp,
      new THREE.BoxGeometry(1.15, 2.05, 0.62),
      djSpeakerGrilleMat,
      [rx, stageTopY + 1.05, backZ - 1.24],
    );
  }

  // 8. REAL 7-RISER STEPPED STEEL BACKSTAGE ACCESS STAIRS WITH CLEAR GLASS BALUSTRADE (Right Wing — matches Side Profile & 3/4 Isometric!)
  const stairX = 6.25;
  const stairRisers = 7;
  const stairTotalH = 2.15;
  const stairTotalRun = 2.85;
  // Upper landing deck connecting stairs to backstage control mezzanine
  addCustomMatPart(
    djStaticGrp,
    new THREE.BoxGeometry(1.45, 0.14, 1.45),
    djCanopySteelMat,
    [stairX, stageTopY + stairTotalH, -3.45],
    [0, 0, 0],
    { castShadow: true, receiveShadow: true },
  );
  // 7 Individual stepped dark-steel stair treads climbing smoothly from stage deck to backstage landing
  for (let r = 0; r < stairRisers; r++) {
    const frac = (r + 1) / stairRisers;
    const treadY = stageTopY + frac * stairTotalH;
    const treadZ = -0.15 - frac * stairTotalRun;
    addCustomMatPart(
      djStaticGrp,
      new THREE.BoxGeometry(1.36, 0.075, 0.44),
      blackSteelMat,
      [stairX, treadY, treadZ],
      [0, 0, 0],
      { castShadow: true, receiveShadow: true },
    );
  }
  // Twin diagonal steel stair stringer beams + clear glass balustrade panels + steel stanchions & continuous top handrail
  const stringerLen = Math.hypot(stairTotalRun, stairTotalH);
  const stringerPitch = Math.atan2(stairTotalH, stairTotalRun);
  for (const sideOff of [-0.68, 0.68]) {
    addCustomMatPart(
      djStaticGrp,
      new THREE.BoxGeometry(0.08, 0.24, stringerLen),
      blackSteelMat,
      [stairX + sideOff, stageTopY + stairTotalH * 0.5, -0.15 - stairTotalRun * 0.5],
      [stringerPitch, 0, 0],
      { castShadow: true },
    );
    // Clear architectural glass balustrade panel following the stair slope
    addCustomMatPart(
      djStaticGrp,
      new THREE.BoxGeometry(0.04, 1.02, stringerLen - 0.1),
      barTintedGlassMat,
      [stairX + sideOff, stageTopY + stairTotalH * 0.5 + 0.62, -0.15 - stairTotalRun * 0.5],
      [stringerPitch, 0, 0],
      { renderOrder: 3 },
    );
    // Continuous sloped matte-black steel top handrail
    addCustomMatPart(
      djStaticGrp,
      new THREE.BoxGeometry(0.07, 0.06, stringerLen + 0.16),
      blackSteelMat,
      [stairX + sideOff, stageTopY + stairTotalH * 0.5 + 1.15, -0.15 - stairTotalRun * 0.5],
      [stringerPitch, 0, 0],
    );
    // Vertical steel stanchion posts at bottom, middle, and top landing
    for (const [py, pz] of [
      [stageTopY + 0.6, -0.15],
      [stageTopY + stairTotalH * 0.5 + 0.6, -0.15 - stairTotalRun * 0.5],
      [stageTopY + stairTotalH + 0.6, -3.05],
    ] as const) {
      addCustomMatPart(djStaticGrp, new THREE.BoxGeometry(0.06, 1.18, 0.06), blackSteelMat, [stairX + sideOff, py, pz]);
    }
  }

  // 9. SIX YOKE-MOUNTED CONCERT MOVING-HEAD SPOTLIGHTS under Front Canopy Truss (matches Front Elevation!)
  const djSpotPivots: THREE.Group[] = [];
  for (let sp = 0; sp < 6; sp++) {
    const sx = -4.25 + sp * 1.7;
    const sy = roofY + 0.08;
    const sz = 2.05;
    // Fixed yoke mounting bracket on canopy truss
    addCustomMatPart(djStaticGrp, new THREE.BoxGeometry(0.32, 0.1, 0.22), blackSteelMat, [sx, sy + 0.05, sz]);

    const piv = new THREE.Group();
    piv.position.set(sx, sy - 0.05, sz);
    djDynamicGrp.add(piv);
    djSpotPivots.push(piv);

    // U-yoke side arms + cylindrical moving-head fixture barrel + glowing optic lens + volumetric wash cone
    for (const armX of [-0.14, 0.14]) {
      addCustomMatPart(piv, new THREE.BoxGeometry(0.035, 0.26, 0.05), blackSteelMat, [armX, -0.12, 0]);
    }
    addCustomMatPart(piv, new THREE.CylinderGeometry(0.13, 0.17, 0.36, 12), djCanopySteelMat, [0, -0.22, 0]);
    addCustomMatPart(
      piv,
      new THREE.CylinderGeometry(0.13, 0.13, 0.04, 12),
      sp % 2 === 0 ? djPurpleWashMat : poolCyanLedMat,
      [0, -0.41, 0],
    );
    addCustomMatPart(
      piv,
      new THREE.ConeGeometry(1.38, 5.15, 14, 1, true),
      purpleBeamMat,
      [0, -2.95, 0],
      [0, 0, 0],
      { renderOrder: 4 },
    );
  }

  // ============================================================================
  // 7. ENLARGED MODERN LUXURY COCKTAIL BAR (cx=96.2, cz=38.2, rotY=+PI/2 facing East beach)
  //    *** STRICTLY ZERO WOOD / TANPA KAYU! ***
  //    Enlarged for comfortable avatar seating on a 2-tier circular Ivory Terrazzo & Brass Podium (+0.68m)
  // ============================================================================
  const bar = mp.cocktailBar;
  const barGrp = new THREE.Group();
  barGrp.name = 'BeachClubLuxuryCocktailBar_NoWood';
  barGrp.position.set(bar.cx, 0, bar.cz);
  barGrp.rotation.y = bar.rotY;
  staticClubGroup.add(barGrp);

  // Lower stepped Terrazzo foundation (-0.68m .. +0.58m) + Upper Podium (+0.68m) matching evaluateBeachClubElevation radius
  addWorldPart(
    barGrp,
    new THREE.CylinderGeometry(bar.padRadiusM + 0.18, bar.padRadiusM + 0.28, 1.26, 36),
    '#ebe2d3',
    [0, -0.05, 0],
    [0, 0, 0],
    { tex: limestoneTex, receiveShadow: true },
  );
  addWorldPart(
    barGrp,
    new THREE.CylinderGeometry(bar.padRadiusM, bar.padRadiusM + 0.18, bar.padElevY + 0.68, 36),
    '#ffffff',
    [0, (bar.padElevY - 0.68) * 0.5, 0],
    [0, 0, 0],
    { tex: terrazzoInlayTex, receiveShadow: true, strokeW: 0.015 },
  );
  addCustomMatPart(
    barGrp,
    new THREE.RingGeometry(bar.padRadiusM - 0.2, bar.padRadiusM - 0.06, 44),
    brushedBrassMat,
    [0, bar.padElevY + 0.006, 0],
    [-Math.PI / 2, 0, 0],
  );

  const barBaseY = bar.padElevY;

  // Curved Horseshoe Fluted White Stone Bar Counter + Overhanging Calacatta Marble Slab (top at +1.82m)
  const uCurveSegments = 15;
  const uRadius = bar.uRadiusM;
  const uCenterZ = bar.uCenterZM;
  for (let i = 0; i < uCurveSegments; i++) {
    const a0 = -Math.PI * 0.06 + (i / uCurveSegments) * (Math.PI * 1.12);
    const a1 = -Math.PI * 0.06 + ((i + 1) / uCurveSegments) * (Math.PI * 1.12);
    const aMid = (a0 + a1) * 0.5;
    const segLen = uRadius * (a1 - a0) + 0.1;
    const sx = Math.cos(aMid) * uRadius;
    const sz = Math.sin(aMid) * uRadius + uCenterZ;

    // Fluted white stone body with vertical brass inlay texture
    addWorldPart(
      barGrp,
      applyBoxMetricUvs(new THREE.BoxGeometry(segLen, 1.68, 0.72), 0.78, 1.68),
      '#ffffff',
      [sx, barBaseY + 0.84, sz],
      [0, -aMid + Math.PI / 2, 0],
      { tex: flutedStoneTex, strokeW: 0.012, castShadow: true },
    );
    // Overhanging Calacatta marble countertop slab
    addWorldPart(
      barGrp,
      applyBoxMetricUvs(new THREE.BoxGeometry(segLen + 0.14, 0.14, 1.12), 1.8, 1.8),
      '#ffffff',
      [sx, barBaseY + 1.75, sz],
      [0, -aMid + Math.PI / 2, 0],
      { tex: calacattaTex, strokeW: 0.012, castShadow: true },
    );
  }

  // Concealed warm amber LED strips (under marble overhang + toe-kick) & brushed-brass wrap-around footrest
  addCustomMatPart(
    barGrp,
    new THREE.TorusGeometry(uRadius + 0.42, 0.038, 8, 36, Math.PI * 1.12),
    warmAmberGlowMat,
    [0, barBaseY + 1.66, uCenterZ],
    [Math.PI / 2, 0, -Math.PI * 0.06],
  );
  addCustomMatPart(
    barGrp,
    new THREE.TorusGeometry(uRadius + 0.38, 0.036, 8, 36, Math.PI * 1.12),
    warmAmberGlowMat,
    [0, barBaseY + 0.09, uCenterZ],
    [Math.PI / 2, 0, -Math.PI * 0.06],
  );
  addCustomMatPart(
    barGrp,
    new THREE.TorusGeometry(uRadius + 0.58, 0.036, 8, 36, Math.PI * 1.12),
    brushedBrassMat,
    [0, barBaseY + 0.3, uCenterZ],
    [Math.PI / 2, 0, -Math.PI * 0.06],
  );

  // Tall Calacatta Marble Back Wall (+4.85m) with Brushed Brass Perimeter Frame
  addWorldPart(
    barGrp,
    applyBoxMetricUvs(new THREE.BoxGeometry(7.35, 4.85, 0.44), 2.8, 2.8),
    '#ffffff',
    [0, barBaseY + 2.425, -2.78],
    [0, 0, 0],
    { tex: calacattaTex, strokeW: 0.015, castShadow: true },
  );
  addCustomMatPart(barGrp, new THREE.BoxGeometry(7.48, 0.09, 0.5), brushedBrassMat, [0, barBaseY + 4.87, -2.78]);
  for (const trimX of [-3.7, 3.7]) {
    addCustomMatPart(barGrp, new THREE.BoxGeometry(0.09, 4.88, 0.5), brushedBrassMat, [trimX, barBaseY + 2.44, -2.78]);
  }

  // Stainless-Steel Bartender Back Counter, Center Prep Island & Sleek POS Terminal
  addCustomMatPart(
    barGrp,
    new THREE.BoxGeometry(6.45, 1.44, 0.96),
    stainlessSteelMat,
    [0, barBaseY + 0.72, -2.02],
  );
  addCustomMatPart(
    barGrp,
    new THREE.BoxGeometry(2.35, 1.38, 1.12),
    stainlessSteelMat,
    [0, barBaseY + 0.69, 0.28],
  );
  // POS terminal on the right-hand marble counter
  addCustomMatPart(
    barGrp,
    new THREE.BoxGeometry(0.48, 0.36, 0.07),
    stainlessSteelMat,
    [2.18, barBaseY + 2.0, 1.65],
    [-0.28, -0.35, 0],
  );

  // 2-Tier Illuminated Brushed-Brass Bottle Display Shelves stocked with colorful glass bottles
  for (const shelfY of [barBaseY + 2.35, barBaseY + 3.25]) {
    addCustomMatPart(barGrp, new THREE.BoxGeometry(5.55, 0.06, 0.48), brushedBrassMat, [0, shelfY, -2.32]);
    addCustomMatPart(barGrp, new THREE.BoxGeometry(5.38, 0.045, 0.06), warmAmberGlowMat, [0, shelfY + 0.045, -2.5]);
    const bottlePalette = ['#10b981', '#f59e0b', '#e11d48', '#38bdf8', '#d97706', '#a855f7'];
    for (let b = 0; b < 17; b++) {
      const bx = -2.32 + b * 0.29;
      addWorldPart(
        barGrp,
        new THREE.CylinderGeometry(0.064, 0.074, 0.4 + (b % 3) * 0.07, 8),
        bottlePalette[b % bottlePalette.length],
        [bx, shelfY + 0.24, -2.3],
        [0, 0, 0],
        { strokeW: 0.005 },
      );
    }
  }

  // Curved Cantilevered Tinted Sea-Glass & Brushed-Brass Ribbed Canopy (+5.12m clearance above podium, ZERO WOOD)
  const canopyGroup = new THREE.Group();
  canopyGroup.position.set(0, barBaseY + 5.14, 0.32);
  canopyGroup.rotation.x = THREE.MathUtils.degToRad(-6.0);
  barGrp.add(canopyGroup);

  // 2 Tall Brushed-Brass Structural Support Columns with base & top collars
  for (const colX of [-3.12, 3.12]) {
    addCustomMatPart(
      barGrp,
      new THREE.CylinderGeometry(0.115, 0.13, 5.05, 14),
      brushedBrassMat,
      [colX, barBaseY + 2.525, -1.04],
      [0, 0, 0],
      { castShadow: true, receiveShadow: true },
    );
    addCustomMatPart(
      barGrp,
      new THREE.CylinderGeometry(0.19, 0.22, 0.16, 14),
      brushedBrassMat,
      [colX, barBaseY + 0.08, -1.04],
    );
  }

  // Open curved elliptical/arched brushed-brass canopy perimeter fascia + arched ribs (NO solid opaque slab!)
  const canopyWidth = 9.75;
  const canopyDepth = 6.55;
  const canopyArcSteps = 12;
  const archRise = 0.46;
  for (let i = 0; i < canopyArcSteps; i++) {
    const t0 = -1 + (2 * i) / canopyArcSteps;
    const t1 = -1 + (2 * (i + 1)) / canopyArcSteps;
    const tm = (t0 + t1) * 0.5;
    const x0 = t0 * (canopyWidth * 0.5);
    const x1 = t1 * (canopyWidth * 0.5);
    const xm = (x0 + x1) * 0.5;
    const y0 = Math.cos(t0 * Math.PI * 0.5) * archRise;
    const y1 = Math.cos(t1 * Math.PI * 0.5) * archRise;
    const ym = (y0 + y1) * 0.5;
    const segW = Math.hypot(x1 - x0, y1 - y0) + 0.06;
    const tiltZ = Math.atan2(y1 - y0, x1 - x0);
    // Gently bow the front edge outward (+Z) like the 4-view model sheet
    const frontBowZ = Math.cos(tm * Math.PI * 0.5) * 0.56;
    const localDepth = canopyDepth + frontBowZ;
    const localCenterZ = frontBowZ * 0.5;

    // Translucent tinted sea-glass canopy panel
    addCustomMatPart(
      canopyGroup,
      new THREE.BoxGeometry(segW, 0.065, localDepth),
      barTintedGlassMat,
      [xm, ym + 0.08, localCenterZ],
      [0, 0, tiltZ],
      { renderOrder: 3 },
    );
    // Front & rear brushed-brass curved fascia beams
    addCustomMatPart(
      canopyGroup,
      new THREE.BoxGeometry(segW + 0.02, 0.16, 0.14),
      brushedBrassMat,
      [xm, ym, localCenterZ + localDepth * 0.5],
      [0, 0, tiltZ],
      { castShadow: true, receiveShadow: true },
    );
    addCustomMatPart(
      canopyGroup,
      new THREE.BoxGeometry(segW + 0.02, 0.16, 0.14),
      brushedBrassMat,
      [xm, ym, localCenterZ - localDepth * 0.5],
      [0, 0, tiltZ],
      { castShadow: true, receiveShadow: true },
    );
  }
  // Longitudinal brushed-brass structural ribs under the curved glass canopy
  for (let rib = -4; rib <= 4; rib++) {
    const t = rib / 4.2;
    const rx = t * (canopyWidth * 0.5);
    const ry = Math.cos(t * Math.PI * 0.5) * archRise - 0.035;
    const frontBowZ = Math.cos(t * Math.PI * 0.5) * 0.56;
    const ribDepth = canopyDepth + frontBowZ - 0.08;
    addCustomMatPart(
      canopyGroup,
      new THREE.BoxGeometry(0.085, 0.11, ribDepth),
      brushedBrassMat,
      [rx, ry, frontBowZ * 0.5],
      [0, 0, 0],
      { castShadow: true },
    );
  }
  // Curved brushed-brass inner shade-slat header over the rear bartender aisle (NO WOOD)
  addCustomMatPart(
    canopyGroup,
    new RoundedBoxGeometry(7.45, 0.11, 1.9, 2, 0.045),
    brushedBrassMat,
    [0, archRise + 0.16, -1.8],
    [0, 0, 0],
    { castShadow: true, receiveShadow: true },
  );

  // 8 Avatar-Proportioned Luxury Brass & Tan-Leather Barstools (1:1 synced with BEACH_CLUB_COCKTAIL_BAR_SEAT_SPOTS)
  const stoolCount = bar.stoolCount;
  for (let s = 0; s < stoolCount; s++) {
    const a = 0.14 + (s / (stoolCount - 1)) * (Math.PI - 0.28);
    const r = bar.stoolRadiusM;
    const sx = Math.cos(a) * r;
    const sz = Math.sin(a) * r + uCenterZ;
    const stool = new THREE.Group();
    stool.position.set(sx, barBaseY, sz);
    stool.rotation.y = -a + Math.PI / 2;
    barGrp.add(stool);

    addCustomMatPart(stool, new THREE.CylinderGeometry(0.36, 0.39, 0.06, 16), brushedBrassMat, [0, 0.03, 0]);
    addCustomMatPart(stool, new THREE.CylinderGeometry(0.056, 0.066, 1.06, 12), brushedBrassMat, [0, 0.55, 0]);
    addCustomMatPart(stool, new THREE.TorusGeometry(0.26, 0.026, 8, 18), brushedBrassMat, [0, 0.42, 0], [Math.PI / 2, 0, 0]);
    addWorldPart(stool, new RoundedBoxGeometry(0.72, 0.14, 0.66, 2, 0.045), '#c2936b', [0, 1.12, 0], [0, 0, 0], {
      strokeW: 0.008,
      castShadow: true,
    });
    // Backrest sits on outer (+Z) edge of stool so guests sit facing inward toward the bar counter!
    addWorldPart(stool, new RoundedBoxGeometry(0.72, 0.46, 0.12, 2, 0.04), '#c2936b', [0, 1.38, 0.28], [0, 0, 0], {
      strokeW: 0.008,
      castShadow: true,
    });
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
  const daybedPillowMatrices: THREE.Matrix4[] = [];
  const brassSideTableMatrices: THREE.Matrix4[] = [];
  const cabLampMatrices: THREE.Matrix4[] = [];

  // Avatar-proportioned VIP Cabana Suite height (4.15m pergola clearance for 3.31m avatar!)
  const cabPergolaH = 4.15;
  for (const cab of mp.cabanas) {
    const yBase = cab.plinthTopY;
    // Honed Calacatta Marble Plinth (`0.64m -> 0.76m`)
    dummy.position.set(cab.cx, yBase - 0.12, cab.cz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    plinthMatrices.push(dummy.matrix.clone());

    for (const [px, pz] of [
      [-1.46, -1.46],
      [-1.46, 1.46],
      [1.46, -1.46],
      [1.46, 1.46],
    ] as const) {
      dummy.position.set(cab.cx + px, yBase + cabPergolaH * 0.5, cab.cz + pz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      steelPostMatrices.push(dummy.matrix.clone());
    }
    for (let lv = 0; lv < 10; lv++) {
      dummy.position.set(cab.cx, yBase + cabPergolaH + 0.02, cab.cz - 1.25 + lv * 0.275);
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
      dummy.position.set(cab.cx + cxOff, yBase + cabPergolaH * 0.49, cab.cz + czOff);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      curtainMatrices.push(dummy.matrix.clone());
    }
    // King-size plush double daybed + twin backrest pillows
    dummy.position.set(cab.cx - 0.38, yBase + 0.21, cab.cz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    daybedBaseMatrices.push(dummy.matrix.clone());

    dummy.position.set(cab.cx - 0.34, yBase + 0.52, cab.cz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    daybedMattressMatrices.push(dummy.matrix.clone());

    for (const pzOff of [-0.46, 0.46]) {
      dummy.position.set(cab.cx - 0.96, yBase + 0.8, cab.cz + pzOff);
      dummy.rotation.set(0, 0, -0.25);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      daybedPillowMatrices.push(dummy.matrix.clone());
    }

    // Geometric brushed-brass side tables + warm amber lanterns
    for (const tz of [-1.08, 1.08]) {
      dummy.position.set(cab.cx - 0.85, yBase + 0.31, cab.cz + tz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      brassSideTableMatrices.push(dummy.matrix.clone());

      dummy.position.set(cab.cx - 0.85, yBase + 0.76, cab.cz + tz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      cabLampMatrices.push(dummy.matrix.clone());
    }
  }

  let instancedBatchCount = 0;
  buildInstancedBatch(applyBoxMetricUvs(new THREE.BoxGeometry(3.1, 0.24, 3.2), 2.0, 2.0), calacattaMat, plinthMatrices, true);
  buildInstancedBatch(new THREE.BoxGeometry(0.14, cabPergolaH, 0.14), blackSteelMat, steelPostMatrices, true);
  buildInstancedBatch(new THREE.BoxGeometry(2.96, 0.06, 0.2), blackSteelMat, louverMatrices, true);
  buildInstancedBatch(new THREE.CylinderGeometry(0.18, 0.28, cabPergolaH - 0.14, 8), shearCurtainMat, curtainMatrices, false);
  buildInstancedBatch(new RoundedBoxGeometry(1.78, 0.42, 2.02, 2, 0.04), calacattaMat, daybedBaseMatrices, true);
  buildInstancedBatch(new RoundedBoxGeometry(1.72, 0.28, 1.94, 2, 0.06), ivoryFabricMat, daybedMattressMatrices, false);
  buildInstancedBatch(new RoundedBoxGeometry(0.32, 0.44, 0.76, 2, 0.06), whiteFrameMat, daybedPillowMatrices, false);
  buildInstancedBatch(new THREE.BoxGeometry(0.46, 0.62, 0.46), brushedBrassMat, brassSideTableMatrices, false);
  buildInstancedBatch(new THREE.CylinderGeometry(0.1, 0.12, 0.28, 8), warmAmberGlowMat, cabLampMatrices, false, false);
  instancedBatchCount += 9;

  // Matte-black steel post-and-beam pergola headers with subtle architectural beam overhangs (matches 4-view model sheet!)
  for (const cab of mp.cabanas) {
    const headerY = cab.plinthTopY + cabPergolaH + 0.02;
    addCustomMatPart(staticClubGroup, new THREE.BoxGeometry(3.48, 0.16, 0.15), blackSteelMat, [cab.cx, headerY, cab.cz - 1.46], [0, 0, 0], { castShadow: true });
    addCustomMatPart(staticClubGroup, new THREE.BoxGeometry(3.48, 0.16, 0.15), blackSteelMat, [cab.cx, headerY, cab.cz + 1.46], [0, 0, 0], { castShadow: true });
    addCustomMatPart(staticClubGroup, new THREE.BoxGeometry(0.15, 0.16, 3.48), blackSteelMat, [cab.cx - 1.46, headerY, cab.cz], [0, 0, 0], { castShadow: true });
    addCustomMatPart(staticClubGroup, new THREE.BoxGeometry(0.15, 0.16, 3.48), blackSteelMat, [cab.cx + 1.46, headerY, cab.cz], [0, 0, 0], { castShadow: true });
  }

  // Solid Honed White Calacatta Marble Coping & Ledge along East edge of South Sunken Pod Pool
  // (matches the East pool boundary collider 1:1 so there is zero invisible ghost collide along the pool!)
  {
    const sp = mp.pools.southSeaPool;
    const ledgeW = 1.25;
    const ledgeD = sp.halfZ * 2;
    const ledgeTopY = (sp.waterY ?? -1.02) + 0.04;
    const ledgeBaseY = -2.15;
    const ledgeH = ledgeTopY - ledgeBaseY;
    const localX = sp.halfX + ledgeW * 0.5;
    const cosR = Math.cos(sp.rotY);
    const sinR = Math.sin(sp.rotY);
    addWorldPart(
      staticClubGroup,
      applyBoxMetricUvs(new THREE.BoxGeometry(ledgeW, ledgeH, ledgeD), 2.2, 2.2),
      '#ffffff',
      [sp.cx + localX * cosR, ledgeBaseY + ledgeH * 0.5, sp.cz - localX * sinR],
      [0, sp.rotY, 0],
      { tex: calacattaTex, strokeW: 0.012, castShadow: true, receiveShadow: true },
    );
  }

  // Cabana Lounger Pairs & Minimalist White Canvas Parasols placed on the spacious open 2nd terrace (-0.56m white marble)
  // so the +0.64m VIP Cabana mezzanine walkway stays 100% unobstructed for avatars!
  if (lougerSetCabanas.length > 0) {
    const cLoungerMatrices: THREE.Matrix4[] = [];
    const cParasolPoleMatrices: THREE.Matrix4[] = [];
    const cParasolCanopyMatrices: THREE.Matrix4[] = [];
    const cParasolBaseMatrices: THREE.Matrix4[] = [];

    for (const cab of lougerSetCabanas) {
      const lx = 101.2; // centered on the wide open -0.56m South 2nd terrace (x=96.4..105.2), leaving >3m clear walkways on both sides!
      const deckY = -0.56;
      for (const lzOff of [-0.62, 0.62]) {
        dummy.position.set(lx, deckY + 0.16, cab.cz + lzOff);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        cLoungerMatrices.push(dummy.matrix.clone());
      }
      // Marble parasol base & tall vertical mast squarely centered between the twin loungers
      dummy.position.set(lx, deckY + 0.11, cab.cz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      cParasolBaseMatrices.push(dummy.matrix.clone());

      dummy.position.set(lx, deckY + 1.82, cab.cz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      cParasolPoleMatrices.push(dummy.matrix.clone());

      dummy.position.set(lx, deckY + 3.58, cab.cz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      cParasolCanopyMatrices.push(dummy.matrix.clone());
    }
    buildInstancedBatch(new RoundedBoxGeometry(1.28, 0.32, 0.72, 2, 0.06), ivoryFabricMat, cLoungerMatrices, false, true);
    buildInstancedBatch(new THREE.BoxGeometry(0.42, 0.22, 0.42), calacattaMat, cParasolBaseMatrices, false, true);
    buildInstancedBatch(new THREE.CylinderGeometry(0.048, 0.058, 3.56, 8), blackSteelMat, cParasolPoleMatrices, true, true);
    buildInstancedBatch(new THREE.ConeGeometry(1.48, 0.56, 10), ivoryFabricMat, cParasolCanopyMatrices, true, true);
    instancedBatchCount += 4;
  }

  // ============================================================================
  // 9. 6 FLOATING SQUARE WHITE SUNKEN LOUNGE PODS + WARM AMBER TABLE LANTERNS & THROW PILLOWS
  //    Outer masonry rim grounded cleanly onto the -1.40m pool basin floor!
  // ============================================================================
  const podRimMatrices: THREE.Matrix4[] = [];
  const podCushionMatrices: THREE.Matrix4[] = [];
  const podPillowMatrices: THREE.Matrix4[] = [];
  const podTableMatrices: THREE.Matrix4[] = [];
  const podLanternMatrices: THREE.Matrix4[] = [];
  const haloSpritePositions: { x: number; y: number; z: number; scale: number }[] = [];

  for (const pod of mp.sunkenPods) {
    const wy = pod.waterY;
    // Outer frame spans -1.37m (rooted in -1.34m pool floor) up to -0.89m (+13cm proud of water)
    dummy.position.set(pod.cx, wy - 0.11, pod.cz);
    dummy.rotation.set(0, pod.rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    podRimMatrices.push(dummy.matrix.clone());

    dummy.position.set(pod.cx, wy + 0.1, pod.cz);
    dummy.rotation.set(0, pod.rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    podCushionMatrices.push(dummy.matrix.clone());

    // 4 warm terracotta throw pillows around the pod perimeter
    const cPod = Math.cos(pod.rotY);
    const sPod = Math.sin(pod.rotY);
    for (const [plx, plz] of [
      [-0.78, -0.78],
      [0.78, -0.78],
      [-0.78, 0.78],
      [0.78, 0.78],
    ] as const) {
      dummy.position.set(pod.cx + plx * cPod + plz * sPod, wy + 0.24, pod.cz - plx * sPod + plz * cPod);
      dummy.rotation.set(0.22, pod.rotY + Math.atan2(plx, plz), 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      podPillowMatrices.push(dummy.matrix.clone());
    }

    dummy.position.set(pod.cx, wy + 0.2, pod.cz);
    dummy.rotation.set(0, pod.rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    podTableMatrices.push(dummy.matrix.clone());

    dummy.position.set(pod.cx, wy + 0.44, pod.cz);
    dummy.rotation.set(0, pod.rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    podLanternMatrices.push(dummy.matrix.clone());

    haloSpritePositions.push({ x: pod.cx, y: wy + 0.46, z: pod.cz, scale: 1.05 });
  }

  const warmTerracottaMat = makeWorldBlitzMat('#e08e5a');
  buildInstancedBatch(new RoundedBoxGeometry(2.65, 0.48, 2.65, 2, 0.06), whiteFrameMat, podRimMatrices, false, true);
  buildInstancedBatch(new RoundedBoxGeometry(2.12, 0.14, 2.12, 2, 0.05), ivoryFabricMat, podCushionMatrices, false, true);
  buildInstancedBatch(new RoundedBoxGeometry(0.36, 0.22, 0.36, 2, 0.06), warmTerracottaMat, podPillowMatrices, false, true);
  buildInstancedBatch(new THREE.CylinderGeometry(0.46, 0.42, 0.18, 12), calacattaMat, podTableMatrices, false, true);
  buildInstancedBatch(new THREE.CylinderGeometry(0.11, 0.13, 0.3, 10), warmAmberGlowMat, podLanternMatrices, false, false);
  instancedBatchCount += 5;

  // ============================================================================
  // 10. SEAWARD WOVEN PARASOL SETS & TIMBER PENINSULA TURQUOISE LOUNGERS + PARASOLS
  //     Scaled up to 3.65m parasol height so 3.31m avatars walk comfortably underneath!
  // ============================================================================
  const sandSetPoleMats: THREE.Matrix4[] = [];
  const sandSetCanopyMats: THREE.Matrix4[] = [];
  const sandLoungerMats: THREE.Matrix4[] = [];
  const sandPillowMats: THREE.Matrix4[] = [];
  const poolLoungerMats: THREE.Matrix4[] = [];
  const poolPillowMats: THREE.Matrix4[] = [];
  const poolParasolPoleMats: THREE.Matrix4[] = [];
  const poolParasolCanopyMats: THREE.Matrix4[] = [];

  for (const bs of mp.beachSets) {
    if (bs.variant === 'sand_woven') {
      dummy.position.set(bs.cx, bs.elevY + 1.82, bs.cz);
      dummy.rotation.set(0, bs.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      sandSetPoleMats.push(dummy.matrix.clone());

      dummy.position.set(bs.cx, bs.elevY + 3.65, bs.cz);
      dummy.rotation.set(0, bs.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      sandSetCanopyMats.push(dummy.matrix.clone());

      // Align 1.88m lounger length along East-West ocean axis (yaw ≈ 0) with twin beds spaced cleanly side-by-side
      const loungerYaw = bs.rotY + Math.PI / 2;
      const cosL = Math.cos(loungerYaw);
      const sinL = Math.sin(loungerYaw);
      for (const sideOff of [-0.6, 0.6]) {
        const lx = bs.cx + sinL * sideOff;
        const lz = bs.cz + cosL * sideOff;
        dummy.position.set(lx, bs.elevY + 0.16, lz);
        dummy.rotation.set(0, loungerYaw, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        sandLoungerMats.push(dummy.matrix.clone());

        // Raised backrest pillow on landward (-X) end so guests recline facing the ocean (+X)
        dummy.position.set(lx - cosL * 0.64, bs.elevY + 0.36, lz + sinL * 0.64);
        dummy.rotation.set(0, loungerYaw, -0.32);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        sandPillowMats.push(dummy.matrix.clone());
      }
    } else {
      // Twin turquoise loungers facing East (+X, yaw=0) with 0.44m center aisle on the -0.54m Timber Sunbed Peninsula!
      for (const sideOff of [-0.58, 0.58]) {
        dummy.position.set(bs.cx, bs.elevY + 0.15, bs.cz + sideOff);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        poolLoungerMats.push(dummy.matrix.clone());

        dummy.position.set(bs.cx - 0.64, bs.elevY + 0.34, bs.cz + sideOff);
        dummy.rotation.set(0, 0, -0.32);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        poolPillowMats.push(dummy.matrix.clone());
      }
      dummy.position.set(bs.cx - 0.15, bs.elevY + 1.82, bs.cz);
      dummy.rotation.set(0, bs.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poolParasolPoleMats.push(dummy.matrix.clone());

      dummy.position.set(bs.cx - 0.15, bs.elevY + 3.65, bs.cz);
      dummy.rotation.set(0, bs.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poolParasolCanopyMats.push(dummy.matrix.clone());
    }
  }
  if (sandSetPoleMats.length > 0) {
    buildInstancedBatch(new THREE.CylinderGeometry(0.055, 0.068, 3.64, 8), blackSteelMat, sandSetPoleMats, true, true);
    buildInstancedBatch(new THREE.ConeGeometry(1.62, 0.74, 10), parasolStrawMat, sandSetCanopyMats, true, true);
    buildInstancedBatch(new RoundedBoxGeometry(1.88, 0.32, 0.72, 2, 0.06), ivoryFabricMat, sandLoungerMats, false, true);
    buildInstancedBatch(new RoundedBoxGeometry(0.48, 0.2, 0.62, 2, 0.05), whiteFrameMat, sandPillowMats, false, true);
    instancedBatchCount += 4;
  }
  if (poolLoungerMats.length > 0) {
    buildInstancedBatch(new RoundedBoxGeometry(1.85, 0.3, 0.72, 2, 0.06), turquoiseMeshMat, poolLoungerMats, false, true);
    buildInstancedBatch(new RoundedBoxGeometry(0.46, 0.18, 0.6, 2, 0.05), ivoryFabricMat, poolPillowMats, false, true);
    buildInstancedBatch(new THREE.CylinderGeometry(0.055, 0.068, 3.64, 8), blackSteelMat, poolParasolPoleMats, true, true);
    buildInstancedBatch(new THREE.ConeGeometry(1.58, 0.7, 10), parasolStrawMat, poolParasolCanopyMats, true, true);
    instancedBatchCount += 4;
  }

  // ============================================================================
  // 10B. SCULPTED ORGANIC COASTAL GRANITE BOULDERS, LAYERED REEF SHELVES & SHALLOW MARINE ECOSYSTEM
  //      - Real pale-champagne beach sand & crystal-clear turquoise water rendered directly by CurvedPlanetGround & Ocean shaders (ZERO pasted sand planes!)
  //      - Every boulder, reef outcrop, branching coral, tubular anemone, 9-blade seagrass clump, 5-arm starfish,
  //        multi-leg coastal crab, sea urchin & swimming fish is grounded to exact `evaluateHarborSeabedDrop(x, z)`!
  // ============================================================================
  const coastalGraniteTex = trackTex(createCoastalGraniteBoulderTexture());
  const coastalBoulderMat = makeWorldBlitzMat('#ffffff', coastalGraniteTex, 0.16);
  const coastalReefRockMat = makeWorldBlitzMat('#d9e3e8', coastalGraniteTex, 0.14);
  const reefBranchPinkMat = makeWorldBlitzMat('#e879a9', undefined, 0.14);
  const reefBranchLilacMat = makeWorldBlitzMat('#8b7cf6', undefined, 0.14);
  const reefTubeVioletMat = makeWorldBlitzMat('#6366f1', undefined, 0.14);
  const reefTubeGoldMat = makeWorldBlitzMat('#eab308', undefined, 0.14);
  const reefSeagrassMat = makeWorldBlitzMat('#2eb85c', undefined, 0.16);
  const reefStarfishMat = makeWorldBlitzMat('#ea7c49', undefined, 0.12);
  const shoreCrabMat = makeWorldBlitzMat('#d9463e', undefined, 0.12);
  const reefUrchinMat = makeWorldBlitzMat('#4a2c38', undefined, 0.1);
  const shallowFishMat = makeWorldBlitzMat('#183a54', undefined, 0.1);

  const boulderMatsA: THREE.Matrix4[] = [];
  const boulderMatsB: THREE.Matrix4[] = [];
  const reefShelfMats: THREE.Matrix4[] = [];
  const branchPinkMats: THREE.Matrix4[] = [];
  const branchLilacMats: THREE.Matrix4[] = [];
  const tubeVioletMats: THREE.Matrix4[] = [];
  const tubeGoldMats: THREE.Matrix4[] = [];
  const seagrassMats: THREE.Matrix4[] = [];
  const starfishMats: THREE.Matrix4[] = [];
  const crabMats: THREE.Matrix4[] = [];
  const urchinMats: THREE.Matrix4[] = [];

  interface ShallowFishSwimSpec {
    cx: number;
    cz: number;
    y: number;
    radiusX: number;
    radiusZ: number;
    speed: number;
    phase: number;
    scale: number;
  }
  const fishSwimSpecs: ShallowFishSwimSpec[] = [];

  // 1. Sculpted smooth pale-grey coastal granite boulders along dry/wet shoreline & palm edges (100% clear of all 4 beach stairs!)
  const shoreBoulderSpecs: readonly [number, number, number, number, number, number, boolean][] = [
    // [x, z, sx, sy, sz, rotY, isVariantB]
    [125.6, -88.5, 1.65, 1.05, 1.42, 0.4, false],
    [127.3, -86.6, 0.78, 0.52, 0.72, 1.9, true],
    [131.6, -79.2, 1.95, 1.15, 1.55, 0.9, false],
    [132.8, -77.1, 0.85, 0.48, 0.76, 2.5, true],
    [126.2, -56.2, 1.48, 0.88, 1.26, 1.2, true],
    [133.2, -46.8, 1.15, 0.62, 1.02, 0.7, false],
    [132.8, -32.4, 1.52, 0.84, 1.28, 2.1, true],
    [127.8, -8.5, 1.45, 0.92, 1.22, 0.5, false], // cleanly clear of stair_beach_c (z=-17.2..-11.4)!
    [132.2, 15.8, 1.68, 0.96, 1.42, 1.6, false],
    [133.6, 17.6, 0.76, 0.44, 0.68, 2.8, true],
    [126.8, 37.8, 1.78, 1.05, 1.52, 0.3, false],
    [132.8, 39.8, 1.32, 0.72, 1.15, 1.4, true],
  ];
  for (const [bx, bz, sx, sy, sz, rotY, isB] of shoreBoulderSpecs) {
    const bedY = evaluateHarborSeabedDrop(bx, bz);
    dummy.position.set(bx, bedY + sy * 0.14, bz);
    dummy.rotation.set(0, rotY, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    (isB ? boulderMatsB : boulderMatsA).push(dummy.matrix.clone());
  }

  // 2. Layered Underwater Coral Reef Outcrops perched right in the crystal-clear turquoise shallows (x = 135.5..143.5)
  //    Each reef shelf hosts multi-branch staghorn coral, hollow flared tubular anemones, swaying seagrass & sea urchins!
  const reefOutcrops: readonly [number, number, number, number][] = [
    // [x, z, scale, rotY]
    [137.4, -71.5, 1.15, 0.35],
    [139.2, -55.0, 1.32, -0.42],
    [136.8, -39.5, 1.05, 0.85],
    [139.8, -23.5, 1.38, 0.18],
    [137.2, -6.5, 1.18, -0.62],
    [140.2, 8.5, 1.35, 0.48],
    [137.6, 23.5, 1.22, -0.28],
    [139.6, 35.5, 1.28, 0.72],
  ];
  for (let i = 0; i < reefOutcrops.length; i++) {
    const [rx, rz, sc, rotY] = reefOutcrops[i];
    const bedY = evaluateHarborSeabedDrop(rx, rz);
    dummy.position.set(rx, bedY + 0.04, rz);
    dummy.rotation.set(0, rotY, 0);
    dummy.scale.set(sc, sc, sc);
    dummy.updateMatrix();
    reefShelfMats.push(dummy.matrix.clone());

    const reefTopY = bedY + 0.34 * sc;
    // Branching pink & lilac staghorn coral gardens atop the reef shelf
    for (let c = 0; c < 3; c++) {
      const ang = rotY + (c / 3) * Math.PI * 2 + 0.4;
      const cx = rx + Math.cos(ang) * 0.65 * sc;
      const cz = rz + Math.sin(ang) * 0.45 * sc;
      dummy.position.set(cx, reefTopY - 0.04, cz);
      dummy.rotation.set(0, ang * 1.4, 0);
      dummy.scale.setScalar(0.95 + (c % 2) * 0.32);
      dummy.updateMatrix();
      ((i + c) % 2 === 0 ? branchPinkMats : branchLilacMats).push(dummy.matrix.clone());
    }

    // Hollow flared tubular violet & gold sea anemones on & beside the reef shelf
    for (let t = 0; t < 2; t++) {
      const ang = rotY + t * Math.PI + 0.9;
      const tx = rx + Math.cos(ang) * 0.92 * sc;
      const tz = rz + Math.sin(ang) * 0.62 * sc;
      const tBedY = t === 0 ? reefTopY - 0.08 : evaluateHarborSeabedDrop(tx, tz);
      dummy.position.set(tx, tBedY, tz);
      dummy.rotation.set(0, ang, 0);
      dummy.scale.setScalar(1.05 + t * 0.25);
      dummy.updateMatrix();
      ((i + t) % 2 === 0 ? tubeVioletMats : tubeGoldMats).push(dummy.matrix.clone());
    }

    // Lush arched multi-blade seagrass clumps & spiny sea urchins tucked around the reef base
    for (let g = 0; g < 3; g++) {
      const ang = rotY + g * 2.1 + 0.2;
      const gx = rx + Math.cos(ang) * (1.45 * sc);
      const gz = rz + Math.sin(ang) * (1.15 * sc);
      const gBedY = evaluateHarborSeabedDrop(gx, gz);
      dummy.position.set(gx, gBedY - 0.02, gz);
      dummy.rotation.set(0, ang, 0);
      dummy.scale.setScalar(1.0 + (g % 2) * 0.35);
      dummy.updateMatrix();
      seagrassMats.push(dummy.matrix.clone());
    }
    const ux = rx - Math.cos(rotY) * 1.55 * sc;
    const uz = rz + Math.sin(rotY) * 1.1 * sc;
    dummy.position.set(ux, evaluateHarborSeabedDrop(ux, uz), uz);
    dummy.rotation.set(0, i * 1.3, 0);
    dummy.scale.setScalar(1.15);
    dummy.updateMatrix();
    urchinMats.push(dummy.matrix.clone());

    // Smooth stepping-stone submerged pebbles near each reef (like reference center-left)
    for (let p = 0; p < 2; p++) {
      const px = rx - 1.9 - p * 0.85;
      const pz = rz + (p === 0 ? 1.6 : -1.4);
      const pBedY = evaluateHarborSeabedDrop(px, pz);
      dummy.position.set(px, pBedY + 0.04, pz);
      dummy.rotation.set(0, i + p * 1.7, 0);
      dummy.scale.set(0.65 + p * 0.22, 0.32, 0.56 + p * 0.16);
      dummy.updateMatrix();
      boulderMatsB.push(dummy.matrix.clone());
    }

    // Small schools of streamlined shallow-water fish circling gently around each turquoise reef
    for (let f = 0; f < 3; f++) {
      const fBedY = evaluateHarborSeabedDrop(rx + 0.5, rz);
      const swimY = Math.min(EAST_WATER_SURFACE_Y - 0.14, fBedY + 0.26 + f * 0.09);
      fishSwimSpecs.push({
        cx: rx + (f - 1) * 0.9,
        cz: rz + (f % 2 === 0 ? 1.2 : -1.2),
        y: swimY,
        radiusX: 1.15 + f * 0.35,
        radiusZ: 1.65 + f * 0.45,
        speed: (0.42 + (f % 3) * 0.14) * (i % 2 === 0 ? 1 : -1),
        phase: i * 1.35 + f * 2.1,
        scale: 0.9 + (f % 2) * 0.28,
      });
    }
  }

  // 3. Sculpted 5-Arm Starfish & Multi-Leg Red Coastal Crabs along the pale wet shoreline sand!
  for (let z = -82; z <= 38; z += 11.5) {
    const seed = Math.abs(Math.round(z * 7));
    // Sculpted red beach crab on damp shoreline sand
    const crabX = 128.8 + (seed % 5) * 0.88;
    const crabZ = z + 1.8;
    dummy.position.set(crabX, evaluateHarborSeabedDrop(crabX, crabZ) + 0.01, crabZ);
    dummy.rotation.set(0, (seed % 9) * 0.7, 0);
    dummy.scale.setScalar(1.05 + (seed % 3) * 0.15);
    dummy.updateMatrix();
    crabMats.push(dummy.matrix.clone());

    // Organic 5-arm coral starfish in shallow swash / wet sand margin (guaranteed clear of submerged reef boulders!)
    const starX = 132.2 + (seed % 3) * 0.75;
    const starZ = z - 2.6;
    const clearOfReefs = reefOutcrops.every(([rx, rz]) => Math.hypot(starX - rx, starZ - rz) > 3.4);
    if (clearOfReefs) {
      dummy.position.set(starX, evaluateHarborSeabedDrop(starX, starZ) + 0.015, starZ);
      dummy.rotation.set(0, seed * 1.1, 0);
      dummy.scale.setScalar(1.15 + (seed % 2) * 0.25);
      dummy.updateMatrix();
      starfishMats.push(dummy.matrix.clone());
    }
  }

  // Build instanced batches using our sculpted organic multi-part BufferGeometries!
  if (boulderMatsA.length > 0) {
    buildInstancedBatch(createSculptedCoastalBoulderGeometry(0), coastalBoulderMat, boulderMatsA, true, true);
    instancedBatchCount++;
  }
  if (boulderMatsB.length > 0) {
    buildInstancedBatch(createSculptedCoastalBoulderGeometry(1), coastalBoulderMat, boulderMatsB, true, true);
    instancedBatchCount++;
  }
  if (reefShelfMats.length > 0) {
    buildInstancedBatch(createReefShelfGeometry(), coastalReefRockMat, reefShelfMats, false, true);
    instancedBatchCount++;
  }
  if (branchPinkMats.length > 0) {
    buildInstancedBatch(createBranchingCoralGeometry(), reefBranchPinkMat, branchPinkMats, false, true);
    instancedBatchCount++;
  }
  if (branchLilacMats.length > 0) {
    buildInstancedBatch(createBranchingCoralGeometry(), reefBranchLilacMat, branchLilacMats, false, true);
    instancedBatchCount++;
  }
  if (tubeVioletMats.length > 0) {
    buildInstancedBatch(createTubeCoralClusterGeometry(), reefTubeVioletMat, tubeVioletMats, false, true);
    instancedBatchCount++;
  }
  if (tubeGoldMats.length > 0) {
    buildInstancedBatch(createTubeCoralClusterGeometry(), reefTubeGoldMat, tubeGoldMats, false, true);
    instancedBatchCount++;
  }
  if (seagrassMats.length > 0) {
    const seagrassGeo = createSeagrassClumpGeometry();
    const seagrassSideMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#2eb85c',
        roughness: 0.65,
        side: THREE.DoubleSide,
      }),
    );
    void reefSeagrassMat;
    buildInstancedBatch(seagrassGeo, seagrassSideMat, seagrassMats, false, true);
    instancedBatchCount++;
  }
  if (starfishMats.length > 0) {
    buildInstancedBatch(createStarfishGeometry(), reefStarfishMat, starfishMats, false, true);
    instancedBatchCount++;
  }
  if (crabMats.length > 0) {
    buildInstancedBatch(createCoastalCrabGeometry(), shoreCrabMat, crabMats, true, true);
    instancedBatchCount++;
  }
  if (urchinMats.length > 0) {
    buildInstancedBatch(createSeaUrchinGeometry(), reefUrchinMat, urchinMats, false, true);
    instancedBatchCount++;
  }
  const shallowFishInitMats = fishSwimSpecs.map((f) => {
    dummy.position.set(f.cx, f.y, f.cz);
    dummy.rotation.set(0, f.phase, 0);
    dummy.scale.setScalar(f.scale);
    dummy.updateMatrix();
    return dummy.matrix.clone();
  });
  const shallowFishInst =
    shallowFishInitMats.length > 0
      ? buildInstancedBatch(createShallowFishGeometry(), shallowFishMat, shallowFishInitMats, false, false)
      : null;
  if (shallowFishInst) {
    instancedBatchCount++;
  }
  const fishAnimDummy = new THREE.Object3D();

  // ============================================================================
  // 11. CRISSCROSS CATENARY FESTOON BULB GARLANDS (`InstancedMesh` + Halos)
  //     Deduplicated poles anchored 1:1 to exact ground elevation via evaluateBeachClubElevation!
  // ============================================================================
  const festoonPoleMatrices: THREE.Matrix4[] = [];
  const seenFestoonPoles = new Set<string>();
  const festoonBulbMatrices: THREE.Matrix4[] = [];
  const wirePoints: number[] = [];
  let festoonBulbCount = 0;

  for (const span of mp.festoonSpans) {
    for (const [px, py, pz] of [
      [span.ax, span.ay, span.az],
      [span.bx, span.by, span.bz],
    ] as const) {
      const poleKey = `${Math.round(px * 10)}_${Math.round(pz * 10)}`;
      if (!seenFestoonPoles.has(poleKey)) {
        seenFestoonPoles.add(poleKey);
        const poleBaseY = evaluateBeachClubElevation(px, pz) - 0.08;
        const poleH = Math.max(2.5, py - poleBaseY);
        dummy.position.set(px, poleBaseY + poleH * 0.5, pz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, poleH / 4.5, 1);
        dummy.updateMatrix();
        festoonPoleMatrices.push(dummy.matrix.clone());
      }
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
    buildInstancedBatch(new THREE.CylinderGeometry(0.055, 0.07, 4.5, 8), blackSteelMat, festoonPoleMatrices, true, true);
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
  const palmRingMatrices: THREE.Matrix4[] = [];

  for (const palm of mp.palms) {
    const kaiScale = palm.scale * 1.38;
    dummy.position.set(palm.x, palm.baseY - 0.06, palm.z);
    dummy.rotation.set(0, palm.rotY, 0);
    dummy.scale.setScalar(kaiScale);
    dummy.updateMatrix();
    palmTrunkMatrices.push(dummy.matrix.clone());
    palmFrondMatrices.push(dummy.matrix.clone());

    // Low limestone planter collar grounding each palm base cleanly on promenade & terraced decks
    dummy.position.set(palm.x, palm.baseY + 0.04, palm.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    palmRingMatrices.push(dummy.matrix.clone());
  }
  const palmRingMat = makeWorldBlitzMat('#e8dfd0', limestoneTex, 0.16);
  const palmTrunkInst = buildInstancedBatch(trunkGeo, palmTrunkMat, palmTrunkMatrices, true, true);
  const palmCollarInst = buildInstancedBatch(collarAndNutsGeo, palmCollarMat, palmTrunkMatrices, false, true);
  const palmFrondInst = buildInstancedBatch(frondsGeo, palmFrondShaderMat, palmFrondMatrices, true, false);
  const palmRingInst = buildInstancedBatch(
    new THREE.CylinderGeometry(0.56, 0.62, 0.14, 12),
    palmRingMat,
    palmRingMatrices,
    false,
    true,
  );
  void palmTrunkInst;
  void palmCollarInst;
  void palmFrondInst;
  void palmRingInst;
  instancedBatchCount += 4;

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
    djLedWallMat.emissiveIntensity = 0.68 + clubNightMix * 1.15 + Math.sin(timeSec * 2.4) * 0.08;
    djLinearLightMat.emissiveIntensity = 1.15 + clubNightMix * 1.85;
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
    if (shallowFishInst) {
      for (let i = 0; i < fishSwimSpecs.length; i++) {
        const f = fishSwimSpecs[i];
        const a = f.phase + timeSec * f.speed;
        const fx = f.cx + Math.cos(a) * f.radiusX;
        const fz = f.cz + Math.sin(a) * f.radiusZ;
        const vx = -Math.sin(a) * f.radiusX * f.speed;
        const vz = Math.cos(a) * f.radiusZ * f.speed;
        fishAnimDummy.position.set(fx, f.y + Math.sin(timeSec * 2.2 + f.phase) * 0.025, fz);
        fishAnimDummy.rotation.set(0, Math.atan2(vx, vz) + Math.sin(timeSec * 8.5 + i) * 0.06, 0);
        fishAnimDummy.scale.setScalar(f.scale);
        fishAnimDummy.updateMatrix();
        shallowFishInst.setMatrixAt(i, fishAnimDummy.matrix);
      }
      shallowFishInst.instanceMatrix.needsUpdate = true;
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
