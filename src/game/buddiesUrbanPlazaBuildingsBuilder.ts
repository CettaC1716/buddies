import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CENTRAL_PARK_MASTERPLAN } from './buddiesCentralParkRules';
import { createUnifiedWaterSurfaceMaterial, type BlitzWindUniforms } from './buddiesBlitzShadersAndAssets';
import {
  attachClearStorefrontGlassNightShader,
} from './buddiesNightLightingRules';
import {
  computeAuditedFacadeWindowTransform,
  createCityWindowSpec,
  tagCityWindowMesh,
  type CityWindowKind,
} from './buddiesWindowAuditRules';

export type UrbanPlazaAddPartFn = (
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  colorHex: string,
  pos?: [number, number, number],
  rot?: [number, number, number],
  opts?: {
    map?: THREE.Texture;
    strokeWidth?: number;
    castShadow?: boolean;
    receiveShadow?: boolean;
    bounce?: number;
    scale?: [number, number, number];
  },
) => THREE.Mesh;

export interface UrbanPlazaBuildingsContext {
  staticGroup: THREE.Object3D;
  animatedGroup: THREE.Object3D;
  windUniforms: BlitzWindUniforms;
  isSoftwareGl: boolean;
  addPart: UrbanPlazaAddPartFn;
  applyPlanarUvs: (geo: THREE.BufferGeometry, tileM?: number) => THREE.BufferGeometry;
  applyNormalizedDiscUvs: (geo: THREE.BufferGeometry, radius: number) => THREE.BufferGeometry;
  scaleGeometryUvs: (geo: THREE.BufferGeometry, uScale: number, vScale: number) => THREE.BufferGeometry;
  registerGeo: (geo: THREE.BufferGeometry) => THREE.BufferGeometry;
  registerMat: (mat: THREE.Material) => THREE.Material;
  registerTex: (tex: THREE.Texture) => THREE.Texture;
  textures: {
    stoneTex: THREE.Texture;
    fieldstoneTex: THREE.Texture;
    timberTex: THREE.Texture;
    cobbleTex: THREE.Texture;
    pondWaterTex: THREE.Texture;
    brickTex: THREE.Texture;
  };
  wisteriaCollectors: {
    matrices: THREE.Matrix4[];
    colors: THREE.Color[];
  };
  pondReedCollectors: {
    matrices: THREE.Matrix4[];
    colors: THREE.Color[];
  };
  shrubCollectors: {
    matrices: THREE.Matrix4[];
    colors: THREE.Color[];
  };
}

const UP_AXIS = new THREE.Vector3(0, 1, 0);

/** Clamped RoundedBoxGeometry preventing corner radius inversion on thin trims. */
export function createBeveledBox(
  w: number,
  h: number,
  d: number,
  radius = 0.014,
  segments = 2,
): RoundedBoxGeometry {
  const safeR = Math.min(radius, Math.min(w, h, d) * 0.42);
  return new RoundedBoxGeometry(w, h, d, segments, Math.max(0.002, safeR));
}

/**
 * Extrudes a single-piece 45°-mitered rectangular perimeter curb/frame resting on XZ (`y in [-h/2 .. +h/2]`)
 * with zero corner butt-overlaps.
 */
export function createMiteredPerimeterCurbGeo(
  outerW: number,
  outerD: number,
  wallThickness: number,
  height: number,
  bevelSize = 0.008,
): THREE.BufferGeometry {
  const hw = outerW * 0.5;
  const hd = outerD * 0.5;
  const ihw = Math.max(0.04, hw - wallThickness);
  const ihd = Math.max(0.04, hd - wallThickness);
  const outer = new THREE.Shape();
  outer.moveTo(-hw, -hd);
  outer.lineTo(hw, -hd);
  outer.lineTo(hw, hd);
  outer.lineTo(-hw, hd);
  outer.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-ihw, -ihd);
  hole.lineTo(ihw, -ihd);
  hole.lineTo(ihw, ihd);
  hole.lineTo(-ihw, ihd);
  hole.closePath();
  outer.holes.push(hole);
  const bevel = Math.min(bevelSize, wallThickness * 0.25, height * 0.25);
  const geo = new THREE.ExtrudeGeometry(outer, {
    depth: Math.max(0.01, height - bevel * 2),
    bevelEnabled: bevel > 0.001,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 2,
  });
  geo.rotateX(-Math.PI * 0.5);
  geo.translate(0, -height * 0.5 + bevel, 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Extrudes a mitered U-shaped perimeter curb opening along `-Z` (e.g., 2F roof terrace curb)
 * as a single continuous polygon with zero corner seams.
 */
function createMiteredUParapetGeo(
  outerHalfW: number,
  zBack: number,
  zFront: number,
  wallThickness: number,
  height: number,
): THREE.BufferGeometry {
  const ihw = outerHalfW - wallThickness;
  const izFront = zFront - wallThickness;
  const shape = new THREE.Shape();
  // Shape lies in XY where shape Y maps to -Z after rotateX(-PI/2)
  shape.moveTo(-outerHalfW, -zBack);
  shape.lineTo(-ihw, -zBack);
  shape.lineTo(-ihw, -izFront);
  shape.lineTo(ihw, -izFront);
  shape.lineTo(ihw, -zBack);
  shape.lineTo(outerHalfW, -zBack);
  shape.lineTo(outerHalfW, -zFront);
  shape.lineTo(-outerHalfW, -zFront);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height - 0.016,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 1,
  });
  geo.rotateX(-Math.PI * 0.5);
  geo.translate(0, -height * 0.5 + 0.008, 0);
  geo.computeVertexNormals();
  return geo;
}

/** Vertical mitered frame around a rectangular wall sign or chalkboard (faces +Z). */
export function createMiteredSignFrameGeo(
  innerW: number,
  innerH: number,
  borderWidth: number,
  depth: number,
): THREE.BufferGeometry {
  const hw = innerW * 0.5 + borderWidth;
  const hh = innerH * 0.5 + borderWidth;
  const ihw = innerW * 0.5;
  const ihh = innerH * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, -hh);
  shape.lineTo(hw, -hh);
  shape.lineTo(hw, hh);
  shape.lineTo(-hw, hh);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-ihw, -ihh);
  hole.lineTo(ihw, -ihh);
  hole.lineTo(ihw, ihh);
  hole.lineTo(-ihw, ihh);
  hole.closePath();
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 1,
  });
  geo.translate(0, 0, -depth * 0.5);
  geo.computeVertexNormals();
  return geo;
}

/** Builds a continuous bent tubular door pull welded via circular standoff bosses into the door stile. */
export function buildTubularDoorPull(
  parent: THREE.Object3D,
  ctx: UrbanPlazaBuildingsContext,
  pos: [number, number, number],
  pullHeight: number,
  colorHex: string,
  projZ = 0.075,
): void {
  const halfH = pullHeight * 0.5;
  const curve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0, halfH, 0.0),
      new THREE.Vector3(0, halfH, projZ * 0.85),
      new THREE.Vector3(0, halfH - 0.03, projZ),
      new THREE.Vector3(0, -halfH + 0.03, projZ),
      new THREE.Vector3(0, -halfH, projZ * 0.85),
      new THREE.Vector3(0, -halfH, 0.0),
    ],
    false,
    'centripetal',
    0.25,
  );
  ctx.addPart(parent, new THREE.TubeGeometry(curve, 22, 0.020, 8, false), colorHex, pos);
  for (const sy of [-halfH, halfH]) {
    const boss = new THREE.CylinderGeometry(0.030, 0.032, 0.018, 10);
    boss.rotateX(Math.PI * 0.5);
    ctx.addPart(parent, boss, colorHex, [pos[0], pos[1] + sy, pos[2] + 0.006]);
  }
}

// ============================================================================
// SHARED PROCEDURAL CANVAS & GEOMETRY HELPERS
// ============================================================================

function createCanvas2D(
  w: number,
  h: number,
): {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
} {
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return { canvas, ctx: canvas.getContext('2d') };
  }
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h);
    return { canvas, ctx: canvas.getContext('2d') };
  }
  return {
    canvas: { width: w, height: h } as unknown as HTMLCanvasElement,
    ctx: null,
  };
}

export function makeBuildingCanvasTexture(
  bCtx: UrbanPlazaBuildingsContext,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeat = true,
): THREE.Texture {
  const { canvas, ctx } = createCanvas2D(w, h);
  if (ctx) {
    draw(ctx as CanvasRenderingContext2D, w, h);
  }
  const tex = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return bCtx.registerTex(tex);
}

export function composeWorldCollectorMatrix(
  originX: number,
  originZ: number,
  groupYaw: number,
  lx: number,
  ly: number,
  lz: number,
  localYaw = 0,
  scale: [number, number, number] = [1, 1, 1],
): THREE.Matrix4 {
  const cosY = Math.cos(groupYaw);
  const sinY = Math.sin(groupYaw);
  const wx = originX + lx * cosY + lz * sinY;
  const wz = originZ - lx * sinY + lz * cosY;
  const q = new THREE.Quaternion().setFromAxisAngle(UP_AXIS, groupYaw + localYaw);
  return new THREE.Matrix4().compose(
    new THREE.Vector3(wx, ly, wz),
    q,
    new THREE.Vector3(scale[0], scale[1], scale[2]),
  );
}

/**
 * Aligns UVs along the chosen grain axis ('x' | 'y' | 'z') on BoxGeometry / planar meshes
 * so timber wood grain flows lengthwise along beams, posts, and rafters without stretching.
 */
export function applyGrainUvs(
  geo: THREE.BufferGeometry,
  grainAxis: 'x' | 'y' | 'z',
  tileM = 1.6,
): THREE.BufferGeometry {
  const pos = geo.getAttribute('position');
  const norm = geo.getAttribute('normal');
  const uv = geo.getAttribute('uv');
  if (!pos || !uv) return geo;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = norm ? Math.abs(norm.getX(i)) : 0;
    const ny = norm ? Math.abs(norm.getY(i)) : 1;
    if (grainAxis === 'y') {
      const across = nx > 0.5 ? z : x;
      uv.setXY(i, y / tileM, across / tileM);
    } else if (grainAxis === 'x') {
      const across = ny > 0.5 ? z : y;
      uv.setXY(i, x / tileM, across / tileM);
    } else {
      const across = ny > 0.5 ? x : y;
      uv.setXY(i, z / tileM, across / tileM);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * Builds a clean, watertight rectangular beam swept along a 3D point list with crisp face normals
 * and lengthwise wood-grain UVs (zero ExtrudeGeometry bevel singularities or NaN normals).
 */
function createSweptRectBeamGeometry(
  pts: readonly THREE.Vector3[],
  width: number,
  height: number,
  uvTileM = 1.6,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  const arcLen: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    arcLen.push(arcLen[i - 1] + pts[i].distanceTo(pts[i - 1]));
  }

  const hw = width * 0.5;
  const hh = height * 0.5;
  const frames: {
    tl: THREE.Vector3;
    tr: THREE.Vector3;
    br: THREE.Vector3;
    bl: THREE.Vector3;
    side: THREE.Vector3;
    up: THREE.Vector3;
    tangent: THREE.Vector3;
  }[] = [];

  for (let i = 0; i < pts.length; i++) {
    const pPrev = pts[Math.max(0, i - 1)];
    const pNext = pts[Math.min(pts.length - 1, i + 1)];
    const tangent = new THREE.Vector3().subVectors(pNext, pPrev);
    if (tangent.lengthSq() < 1e-8) {
      tangent.set(1, 0, 0);
    } else {
      tangent.normalize();
    }
    const side =
      Math.abs(tangent.y) < 0.99
        ? new THREE.Vector3().crossVectors(tangent, UP_AXIS).normalize()
        : new THREE.Vector3(1, 0, 0);
    const up = new THREE.Vector3().crossVectors(side, tangent).normalize();
    const c = pts[i];
    frames.push({
      tl: c.clone().addScaledVector(side, -hw).addScaledVector(up, hh),
      tr: c.clone().addScaledVector(side, hw).addScaledVector(up, hh),
      br: c.clone().addScaledVector(side, hw).addScaledVector(up, -hh),
      bl: c.clone().addScaledVector(side, -hw).addScaledVector(up, -hh),
      side,
      up,
      tangent,
    });
  }

  const pushQuad = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    d: THREE.Vector3,
    n: THREE.Vector3,
    u0: number,
    u1: number,
    v0: number,
    v1: number,
  ) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    positions.push(a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
    for (let k = 0; k < 6; k++) normals.push(n.x, n.y, n.z);
    uvs.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
  };

  for (let i = 0; i < frames.length - 1; i++) {
    const f0 = frames[i];
    const f1 = frames[i + 1];
    const u0 = arcLen[i] / uvTileM;
    const u1 = arcLen[i + 1] / uvTileM;
    const avgUp = f0.up.clone().add(f1.up).normalize();
    const avgDown = avgUp.clone().negate();
    const avgRight = f0.side.clone().add(f1.side).normalize();
    const avgLeft = avgRight.clone().negate();

    pushQuad(f0.tl, f1.tl, f1.tr, f0.tr, avgUp, u0, u1, 0, 0.45);
    pushQuad(f0.tr, f1.tr, f1.br, f0.br, avgRight, u0, u1, 0.45, 0.95);
    pushQuad(f0.br, f1.br, f1.bl, f0.bl, avgDown, u0, u1, 0, 0.45);
    pushQuad(f0.bl, f1.bl, f1.tl, f0.tl, avgLeft, u0, u1, 0.45, 0.95);
  }

  // Watertight start & end caps
  const first = frames[0];
  const last = frames[frames.length - 1];
  pushQuad(first.tr, first.br, first.bl, first.tl, first.tangent.clone().negate(), 0, 0.25, 0, 0.25);
  pushQuad(last.tl, last.bl, last.br, last.tr, last.tangent, 0, 0.25, 0, 0.25);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

// ============================================================================
// ARCHITECTURAL PROCEDURAL TEXTURES (NO BLACK WOOD!)
// ============================================================================

export function createHoneyPineDeckTexture(ctx: UrbanPlazaBuildingsContext): THREE.Texture {
  return makeBuildingCanvasTexture(ctx, 512, 512, (c, w, h) => {
    c.fillStyle = '#c5925b';
    c.fillRect(0, 0, w, h);
    const plankTones = ['#cca06c', '#b78655', '#d4a774', '#be8e5b', '#c69562'];
    const rows = 8;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const py = r * rh;
      const splitX = ((r * 193 + 96) % (w - 140)) + 70;
      for (const [sx, sw, shadeIdx] of [
        [0, splitX, r * 3],
        [splitX, w - splitX, r * 3 + 1],
      ] as const) {
        c.fillStyle = plankTones[shadeIdx % plankTones.length];
        c.fillRect(sx + 1.5, py + 1.5, Math.max(2, sw - 3), rh - 3);
        // Sun-warmed upper bevel highlight
        c.fillStyle = 'rgba(255, 240, 212, 0.22)';
        c.fillRect(sx + 2, py + 2, Math.max(2, sw - 4), 3.5);
      }
      // Subtle honey-amber longitudinal wood grain
      for (let g = 0; g < 10; g++) {
        const gy = py + 6 + (g / 10) * (rh - 12);
        c.strokeStyle = g % 3 === 0 ? 'rgba(138, 92, 46, 0.16)' : 'rgba(255, 234, 198, 0.16)';
        c.lineWidth = 1.4;
        c.beginPath();
        c.moveTo(0, gy);
        c.bezierCurveTo(w * 0.33, gy + Math.sin(r + g) * 2.2, w * 0.66, gy - Math.cos(r + g) * 2.2, w, gy);
        c.stroke();
      }
      // Warm cinnamon plank joint groove (NEVER black)
      c.fillStyle = '#8b5d36';
      c.fillRect(0, py + rh - 2.5, w, 2.5);
      c.fillRect(splitX - 1.5, py + 1.5, 2.5, rh - 3);
    }
  });
}

export function createHoneyOakTimberTexture(ctx: UrbanPlazaBuildingsContext): THREE.Texture {
  return makeBuildingCanvasTexture(ctx, 512, 512, (c, w, h) => {
    c.fillStyle = '#c48f58';
    c.fillRect(0, 0, w, h);
    const bandTones = ['#cf9b64', '#b9834e', '#d6a46d', '#c18b55'];
    const bands = 6;
    const bh = h / bands;
    for (let b = 0; b < bands; b++) {
      const py = b * bh;
      c.fillStyle = bandTones[b % bandTones.length];
      c.fillRect(0, py, w, bh);
      for (let g = 0; g < 14; g++) {
        const gy = py + 4 + (g / 14) * (bh - 8);
        c.strokeStyle = g % 3 === 0 ? 'rgba(128, 82, 38, 0.16)' : 'rgba(255, 232, 194, 0.18)';
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(0, gy);
        c.lineTo(w * 0.5, gy + Math.sin(b * 1.4 + g) * 2.5);
        c.lineTo(w, gy);
        c.stroke();
      }
      c.fillStyle = 'rgba(136, 89, 44, 0.22)';
      c.fillRect(0, py + bh - 2, w, 2);
    }
  });
}

function createTerracottaStorefrontTexture(ctx: UrbanPlazaBuildingsContext): THREE.Texture {
  return makeBuildingCanvasTexture(ctx, 256, 256, (c, w, h) => {
    c.fillStyle = '#9e3b33';
    c.fillRect(0, 0, w, h);
    const tones = ['#a64139', '#97362e', '#ad473f', '#9e3b33'];
    for (let i = 0; i < 6; i++) {
      c.fillStyle = tones[i % tones.length];
      c.fillRect(0, (i * h) / 6, w, h / 6);
      c.fillStyle = 'rgba(255, 224, 210, 0.08)';
      c.fillRect(0, (i * h) / 6 + 2, w, 2);
    }
    for (let s = 0; s < 320; s++) {
      c.fillStyle = s % 2 === 0 ? 'rgba(255, 216, 200, 0.06)' : 'rgba(85, 24, 18, 0.07)';
      c.fillRect((s * 73) % w, (s * 139) % h, 2, 2);
    }
  });
}

export function createCreamStuccoTexture(ctx: UrbanPlazaBuildingsContext): THREE.Texture {
  return makeBuildingCanvasTexture(ctx, 256, 256, (c, w, h) => {
    c.fillStyle = '#efe4ce';
    c.fillRect(0, 0, w, h);
    let seed = 918273;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 650; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const rw = 4 + rnd() * 14;
      const rh = 3 + rnd() * 10;
      c.fillStyle = i % 2 === 0 ? 'rgba(255, 252, 245, 0.14)' : 'rgba(206, 188, 156, 0.11)';
      c.fillRect(x, y, rw, rh);
    }
  });
}

function createStripedAwningTexture(
  ctx: UrbanPlazaBuildingsContext,
  stripeA: string,
  stripeB: string,
): THREE.Texture {
  return makeBuildingCanvasTexture(ctx, 512, 256, (c, w, h) => {
    const stripeCount = 12;
    const sw = w / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      c.fillStyle = i % 2 === 0 ? stripeA : stripeB;
      c.fillRect(i * sw, 0, sw + 0.5, h);
    }
    // Subtle woven canvas threads
    for (let y = 0; y < h; y += 6) {
      c.fillStyle = y % 12 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(60,42,20,0.05)';
      c.fillRect(0, y, w, 2);
    }
    const bottomGrad = c.createLinearGradient(0, h * 0.72, 0, h);
    bottomGrad.addColorStop(0, 'rgba(0,0,0,0)');
    bottomGrad.addColorStop(1, 'rgba(65,42,18,0.14)');
    c.fillStyle = bottomGrad;
    c.fillRect(0, h * 0.72, w, h * 0.28);
  });
}

export function createWarmWindowGlowTexture(
  ctx: UrbanPlazaBuildingsContext,
  kind: 'boutique' | 'cafe' | 'casement',
): THREE.Texture {
  return makeBuildingCanvasTexture(
    ctx,
    256,
    256,
    (c, w, h) => {
      // Crisp cool-neutral daytime glass / backlit interior backdrop so daytime facades
      // read as clean sky-tinted glass while dusk/night `uEmissive` supplies warm tungsten glow.
      const grad = c.createRadialGradient(w * 0.5, h * 0.42, 16, w * 0.5, h * 0.5, w * 0.68);
      if (kind === 'casement') {
        grad.addColorStop(0, '#eef6fc');
        grad.addColorStop(0.55, '#d3e8f7');
        grad.addColorStop(1, '#aecfe8');
      } else {
        grad.addColorStop(0, '#f2f7fb');
        grad.addColorStop(0.55, '#d9e8f4');
        grad.addColorStop(1, '#b5cfe3');
      }
      c.fillStyle = grad;
      c.fillRect(0, 0, w, h);

      if (kind === 'casement') {
        // Subtle cool tailored interior drape shadows along jamb edges
        c.fillStyle = 'rgba(46, 66, 92, 0.18)';
        c.fillRect(0, 0, 26, h);
        c.fillRect(w - 26, 0, 26, h);
      } else if (kind === 'boutique') {
        // Clean neutral architectural boutique interior depth & cool overhead spots
        c.fillStyle = 'rgba(72, 92, 114, 0.18)';
        c.fillRect(0, h * 0.72, w, h * 0.28);
        c.fillStyle = 'rgba(248, 252, 255, 0.44)';
        c.beginPath();
        c.arc(w * 0.32, h * 0.22, 22, 0, Math.PI * 2);
        c.arc(w * 0.68, h * 0.22, 22, 0, Math.PI * 2);
        c.fill();
      } else if (kind === 'cafe') {
        // Crisp neutral pastry wall shelving & balanced recessed spotlight circles
        c.fillStyle = 'rgba(68, 86, 108, 0.18)';
        c.fillRect(14, h * 0.56, w - 28, 10);
        c.fillRect(14, h * 0.76, w - 28, 12);
        c.fillStyle = 'rgba(248, 252, 255, 0.42)';
        c.beginPath();
        c.arc(w * 0.5, h * 0.24, 24, 0, Math.PI * 2);
        c.fill();
      }

      // Crisp diagonal glass specular reflection streak
      c.strokeStyle = 'rgba(255, 255, 255, 0.34)';
      c.lineWidth = 14;
      c.beginPath();
      c.moveTo(w * 0.16, h * 0.85);
      c.lineTo(w * 0.46, h * 0.12);
      c.moveTo(w * 0.32, h * 0.88);
      c.lineTo(w * 0.58, h * 0.22);
      c.stroke();
    },
    false,
  );
}

function createClearStorefrontGlassTexture(ctx: UrbanPlazaBuildingsContext): THREE.Texture {
  return makeBuildingCanvasTexture(
    ctx,
    256,
    256,
    (c, w, h) => {
      c.clearRect(0, 0, w, h);
      // Translucent icy sky-blue tint across the glass sheet
      const tintGrad = c.createLinearGradient(0, 0, w, h);
      tintGrad.addColorStop(0, 'rgba(220, 244, 255, 0.72)');
      tintGrad.addColorStop(0.5, 'rgba(232, 248, 255, 0.64)');
      tintGrad.addColorStop(1, 'rgba(208, 238, 252, 0.76)');
      c.fillStyle = tintGrad;
      c.fillRect(0, 0, w, h);

      // Subtle diagonal exterior specular window reflection streaks
      c.strokeStyle = 'rgba(255, 255, 255, 0.96)';
      c.lineWidth = 14;
      c.beginPath();
      c.moveTo(w * 0.14, h * 0.86);
      c.lineTo(w * 0.44, h * 0.10);
      c.moveTo(w * 0.31, h * 0.89);
      c.lineTo(w * 0.56, h * 0.22);
      c.stroke();

      c.lineWidth = 6;
      c.strokeStyle = 'rgba(255, 255, 255, 0.78)';
      c.beginPath();
      c.moveTo(w * 0.62, h * 0.78);
      c.lineTo(w * 0.82, h * 0.28);
      c.stroke();
    },
    false,
  );
}

function createDisplayAlcoveBackdropTexture(
  ctx: UrbanPlazaBuildingsContext,
  kind: 'boutique' | 'cafe',
): THREE.Texture {
  return makeBuildingCanvasTexture(
    ctx,
    256,
    256,
    (c, w, h) => {
      const grad = c.createLinearGradient(0, 0, 0, h);
      if (kind === 'boutique') {
        grad.addColorStop(0, '#f7f1e6');
        grad.addColorStop(0.55, '#ede2cf');
        grad.addColorStop(1, '#dfd0b8');
      } else {
        grad.addColorStop(0, '#f9f1e2');
        grad.addColorStop(0.55, '#eee0c8');
        grad.addColorStop(1, '#dec9aa');
      }
      c.fillStyle = grad;
      c.fillRect(0, 0, w, h);

      // Soft warm ceiling display spotlight pools above interior merchandise
      const drawSpot = (cx: number, cy: number, r: number) => {
        const spot = c.createRadialGradient(cx, cy, 4, cx, cy, r);
        spot.addColorStop(0, 'rgba(255, 248, 224, 0.72)');
        spot.addColorStop(1, 'rgba(255, 248, 224, 0)');
        c.fillStyle = spot;
        c.beginPath();
        c.arc(cx, cy, r, 0, Math.PI * 2);
        c.fill();
      };

      if (kind === 'boutique') {
        drawSpot(w * 0.27, h * 0.22, 68);
        drawSpot(w * 0.73, h * 0.22, 68);
        // Subtle architectural wall panelling trim & baseboard
        c.strokeStyle = 'rgba(154, 128, 96, 0.22)';
        c.lineWidth = 3;
        c.strokeRect(18, 22, w * 0.5 - 26, h * 0.68);
        c.strokeRect(w * 0.5 + 8, 22, w * 0.5 - 26, h * 0.68);
        c.fillStyle = 'rgba(136, 108, 78, 0.24)';
        c.fillRect(0, h * 0.84, w, h * 0.16);
      } else {
        drawSpot(w * 0.5, h * 0.24, 82);
        // Warm timber bakery wall shelves behind tiered cake stands
        c.fillStyle = 'rgba(148, 102, 60, 0.42)';
        c.fillRect(16, h * 0.50, w - 32, 10);
        c.fillRect(16, h * 0.70, w - 32, 10);
        c.fillStyle = 'rgba(116, 78, 44, 0.28)';
        c.fillRect(0, h * 0.84, w, h * 0.16);
      }
    },
    false,
  );
}

function createClearStorefrontGlassMaterial(
  ctx: UrbanPlazaBuildingsContext,
  streakTex: THREE.Texture,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: '#d6f4ff',
    map: streakTex,
    transparent: true,
    opacity: 0.30,
    roughness: 0.08,
    metalness: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  attachClearStorefrontGlassNightShader(mat, { yMin: 0.82, yMax: 4.07 });
  return ctx.registerMat(mat) as THREE.MeshStandardMaterial;
}

function createCozyBitesSignTexture(ctx: UrbanPlazaBuildingsContext): THREE.Texture {
  return makeBuildingCanvasTexture(
    ctx,
    1024,
    160,
    (c, w, h) => {
      c.fillStyle = '#efe2ca';
      c.fillRect(0, 0, w, h);

      // Classical molded border trim
      c.strokeStyle = '#9a8262';
      c.lineWidth = 8;
      c.strokeRect(10, 10, w - 20, h - 20);
      c.strokeStyle = '#6d573d';
      c.lineWidth = 3;
      c.strokeRect(20, 20, w - 40, h - 40);

      // Decorative corner rosettes
      c.fillStyle = '#8b6d46';
      for (const [rx, ry] of [
        [36, 36],
        [w - 36, 36],
        [36, h - 36],
        [w - 36, h - 36],
      ] as const) {
        c.beginPath();
        c.arc(rx, ry, 5, 0, Math.PI * 2);
        c.fill();
      }

      // Crisp European Cafe typography
      c.fillStyle = '#2d241d';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = '800 66px Georgia, "Times New Roman", serif';
      c.fillText('COZY BITES & SIPS', w * 0.5, h * 0.52);
    },
    false,
  );
}

function createCafeChalkboardMenuTexture(ctx: UrbanPlazaBuildingsContext): THREE.Texture {
  return makeBuildingCanvasTexture(
    ctx,
    512,
    640,
    (c, w, h) => {
      c.fillStyle = '#31393d';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = '#d4b78a';
      c.lineWidth = 5;
      c.strokeRect(18, 18, w - 36, h - 36);

      c.textAlign = 'center';
      c.fillStyle = '#f8e6b8';
      c.font = '800 38px Georgia, serif';
      c.fillText('COZY BITES', w * 0.5, 76);

      c.fillStyle = '#c5d7cf';
      c.font = '700 24px Georgia, serif';
      c.fillText('FRESH PASTRIES & COFFEE', w * 0.5, 118);

      c.strokeStyle = '#9aa8a4';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(56, 145);
      c.lineTo(w - 56, 145);
      c.stroke();

      c.textAlign = 'left';
      const items: readonly [string, string][] = [
        ['Butter Croissant', '$4.50'],
        ['Almond Brioche', '$5.25'],
        ['Lemon Fruit Tart', '$5.75'],
        ['Vanilla Espresso', '$4.25'],
        ['Matcha Oat Latte', '$5.50'],
        ['Berry Iced Tea', '$4.00'],
      ];
      items.forEach(([label, price], idx) => {
        const y = 205 + idx * 62;
        c.fillStyle = '#f3f1e8';
        c.font = '600 27px "Barlow", sans-serif';
        c.fillText(label, 52, y);
        c.textAlign = 'right';
        c.fillStyle = '#f8d882';
        c.fillText(price, w - 52, y);
        c.textAlign = 'left';
      });

      // Decorative cup sketch at bottom
      c.strokeStyle = '#f8e6b8';
      c.lineWidth = 4;
      c.beginPath();
      c.roundRect(w * 0.5 - 32, 545, 64, 40, [4, 4, 22, 22]);
      c.stroke();
      c.beginPath();
      c.arc(w * 0.5 + 36, 563, 12, -Math.PI * 0.5, Math.PI * 0.5);
      c.stroke();
    },
    false,
  );
}

// ============================================================================
// SHARED ARCHITECTURAL MICRO-PROPS & DETAILS
// ============================================================================

function buildScallopedValance(
  parent: THREE.Object3D,
  ctx: UrbanPlazaBuildingsContext,
  width: number,
  pos: [number, number, number],
  rotY: number,
  colorA: string,
  colorB: string,
): void {
  const grp = new THREE.Group();
  grp.position.set(pos[0], pos[1], pos[2]);
  grp.rotation.y = rotY;
  parent.add(grp);

  const count = Math.max(6, Math.round(width / 0.28));
  const step = width / count;
  const tabRadius = step * 0.5;
  for (let i = 0; i < count; i++) {
    const lx = -width * 0.5 + (i + 0.5) * step;
    const col = i % 2 === 0 ? colorA : colorB;
    const tabGeo = new THREE.CylinderGeometry(tabRadius, tabRadius, 0.032, 10, 1, false, 0, Math.PI);
    tabGeo.rotateX(Math.PI * 0.5);
    tabGeo.rotateZ(Math.PI);
    ctx.addPart(grp, tabGeo, col, [lx, 0, 0]);
  }
}

function buildSlopedStripedAwning(
  parent: THREE.Object3D,
  ctx: UrbanPlazaBuildingsContext,
  opts: {
    width: number;
    depth: number;
    dropH: number;
    pos: [number, number, number];
    rotY: number;
    stripeTex: THREE.Texture;
    colorA: string;
    colorB: string;
  },
): void {
  const grp = new THREE.Group();
  grp.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
  grp.rotation.y = opts.rotY;
  parent.add(grp);

  const slopeLen = Math.hypot(opts.depth, opts.dropH);
  const tilt = Math.atan2(opts.dropH, opts.depth);
  const roofGeo = ctx.applyPlanarUvs(new THREE.BoxGeometry(opts.width, 0.048, slopeLen), 1.4);
  ctx.addPart(
    grp,
    roofGeo,
    '#ffffff',
    [0, -opts.dropH * 0.5, opts.depth * 0.5],
    [tilt, 0, 0],
    { map: opts.stripeTex, castShadow: true },
  );

  // Side triangular fabric cheek gussets
  const gussetShape = new THREE.Shape();
  gussetShape.moveTo(0, 0);
  gussetShape.lineTo(opts.depth, -opts.dropH);
  gussetShape.lineTo(0, -opts.dropH);
  gussetShape.closePath();
  const gussetGeo = new THREE.ExtrudeGeometry(gussetShape, {
    depth: 0.028,
    bevelEnabled: false,
    curveSegments: 2,
  });
  gussetGeo.rotateY(-Math.PI * 0.5);
  gussetGeo.computeVertexNormals();
  for (const sx of [-opts.width * 0.5 + 0.02, opts.width * 0.5 - 0.02]) {
    ctx.addPart(grp, gussetGeo.clone(), opts.colorA, [sx, 0, 0]);
  }
  gussetGeo.dispose();

  // Dark-bronze awning arm brackets beneath canopy
  for (const bx of [-opts.width * 0.4, opts.width * 0.4]) {
    ctx.addPart(grp, new THREE.BoxGeometry(0.036, 0.036, opts.depth * 0.92), '#48413a', [
      bx,
      -opts.dropH * 0.92,
      opts.depth * 0.46,
    ]);
  }

  // 3D scalloped cloth valance along front lip
  buildScallopedValance(
    grp,
    ctx,
    opts.width,
    [0, -opts.dropH - 0.015, opts.depth],
    0,
    opts.colorA,
    opts.colorB,
  );
}

export function buildUrnBoxwoodPlanter(
  parent: THREE.Object3D,
  ctx: UrbanPlazaBuildingsContext,
  pos: [number, number, number],
  scale = 1.0,
  style: 'sphere' | 'cone' = 'sphere',
  potColorHex = '#b86242',
): void {
  const grp = new THREE.Group();
  grp.position.set(pos[0], pos[1], pos[2]);
  grp.scale.setScalar(scale);
  parent.add(grp);

  // Tapered terracotta planter pot with molded collar rim & soil mound
  const potPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.18, 0.0),
    new THREE.Vector2(0.24, 0.36),
    new THREE.Vector2(0.27, 0.40),
    new THREE.Vector2(0.27, 0.46),
    new THREE.Vector2(0.21, 0.46),
    new THREE.Vector2(0.19, 0.40),
    new THREE.Vector2(0.0, 0.40),
  ];
  ctx.addPart(grp, new THREE.LatheGeometry(potPts, 14), potColorHex, [0, 0, 0], [0, 0, 0], {
    castShadow: true,
  });
  ctx.addPart(grp, new THREE.CylinderGeometry(0.21, 0.21, 0.04, 12), '#5b4331', [0, 0.41, 0]);

  // Woody trunk stub
  ctx.addPart(grp, new THREE.CylinderGeometry(0.025, 0.035, 0.22, 6), '#7b583d', [0, 0.50, 0]);

  if (style === 'cone') {
    ctx.addPart(grp, new THREE.ConeGeometry(0.24, 0.68, 12), '#4e8d3f', [0, 0.88, 0], [0, 0, 0], {
      castShadow: true,
    });
    ctx.addPart(grp, new THREE.SphereGeometry(0.14, 9, 7), '#5fa14b', [0, 0.64, 0]);
  } else {
    // Organic multi-lobe clipped spherical boxwood topiary
    ctx.addPart(grp, new THREE.SphereGeometry(0.26, 12, 10), '#4d8c3e', [0, 0.72, 0], [0, 0, 0], {
      castShadow: true,
    });
    ctx.addPart(grp, new THREE.SphereGeometry(0.16, 9, 7), '#62a64e', [0.10, 0.78, 0.08]);
    ctx.addPart(grp, new THREE.SphereGeometry(0.15, 9, 7), '#579844', [-0.11, 0.68, -0.07]);
  }
}

function buildClassicTeakBench(
  parent: THREE.Object3D,
  ctx: UrbanPlazaBuildingsContext,
  pos: [number, number, number],
  rotY: number,
  timberTex: THREE.Texture,
): void {
  const bGrp = new THREE.Group();
  bGrp.position.set(pos[0], pos[1], pos[2]);
  bGrp.rotation.y = rotY;
  // Scale to 1.68x (~0.79m seat height) matching Park Wave Bench & 3.30m outdoor avatar ergonomics
  bGrp.scale.setScalar(1.68);
  parent.add(bGrp);

  for (const sx of [-0.66, 0.66]) {
    ctx.addPart(bGrp, createBeveledBox(0.06, 0.46, 0.46, 0.010), '#3d454d', [sx, 0.23, 0], [0, 0, 0], {
      castShadow: true,
    });
    ctx.addPart(bGrp, createBeveledBox(0.06, 0.52, 0.06, 0.010), '#3d454d', [sx, 0.68, -0.20], [-0.16, 0, 0]);
    ctx.addPart(bGrp, createBeveledBox(0.06, 0.05, 0.44, 0.010), '#4c5660', [sx, 0.64, 0]);
  }
  for (const sz of [-0.14, 0.0, 0.14]) {
    const slatGeo = applyGrainUvs(createBeveledBox(1.48, 0.042, 0.11, 0.010), 'x', 1.2);
    ctx.addPart(bGrp, slatGeo, '#ffffff', [0, 0.47, sz], [0, 0, 0], {
      map: timberTex,
      castShadow: true,
    });
  }
  for (const by of [0.68, 0.84]) {
    const backGeo = applyGrainUvs(createBeveledBox(1.48, 0.11, 0.04, 0.010), 'x', 1.2);
    ctx.addPart(bGrp, backGeo, '#ffffff', [0, by, -0.21], [-0.16, 0, 0], {
      map: timberTex,
      castShadow: true,
    });
  }
}

function buildBoutiqueMannequinSilhouette(
  parent: THREE.Object3D,
  ctx: UrbanPlazaBuildingsContext,
  pos: [number, number, number],
  dressHex: string,
): void {
  const grp = new THREE.Group();
  grp.position.set(pos[0], pos[1], pos[2]);
  parent.add(grp);

  // Sleek brass display base & stand + tailored A-line dress skirt/bodice + seamless neck collar -> head knob
  // Sized (`max r = 0.152m`) so scaled 1.16x mannequins fit cleanly inside the 0.37m storefront vitrine cavity behind front glass.
  ctx.addPart(grp, new THREE.CylinderGeometry(0.115, 0.130, 0.04, 12), '#c59c4a', [0, 0.02, 0], [0, 0, 0], { bounce: 2.68 });
  ctx.addPart(grp, new THREE.CylinderGeometry(0.020, 0.024, 0.72, 8), '#c59c4a', [0, 0.38, 0], [0, 0, 0], { bounce: 2.68 });
  ctx.addPart(grp, new THREE.CylinderGeometry(0.095, 0.152, 0.56, 14), dressHex, [0, 0.82, 0], [0, 0, 0], { bounce: 2.68 });
  ctx.addPart(grp, new THREE.CylinderGeometry(0.135, 0.092, 0.34, 14), dressHex, [0, 1.25, 0], [0, 0, 0], { bounce: 2.68 });
  const neckCollarGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.0, 1.40),
      new THREE.Vector2(0.088, 1.40),
      new THREE.Vector2(0.052, 1.44),
      new THREE.Vector2(0.042, 1.50),
      new THREE.Vector2(0.048, 1.54),
      new THREE.Vector2(0.0, 1.54),
    ],
    14,
  );
  ctx.addPart(grp, neckCollarGeo, '#f0e2ca', [0, 0, 0], [0, 0, 0], { bounce: 2.68 });
  ctx.addPart(grp, new THREE.SphereGeometry(0.080, 10, 8), '#f0e2ca', [0, 1.56, 0], [0, 0, 0], { bounce: 2.68 });
}

export function buildArchedCasementWindow(
  parent: THREE.Object3D,
  ctx: UrbanPlazaBuildingsContext,
  opts: {
    pos: [number, number, number];
    rotY: number;
    width: number;
    rectHeight: number;
    glassTex: THREE.Texture;
    glassHost?: THREE.Object3D;
    windowId?: string;
    windowKind?: CityWindowKind;
    windowRow?: number;
    windowCol?: number;
    withBalcony?: boolean;
    withJulietBar?: boolean;
    withFlowerBox?: boolean;
    omitSill?: boolean;
    trimHex?: string;
    sillHex?: string;
    mullionHex?: string;
    archMuntinFan?: boolean;
    withAwning?: {
      stripeTex: THREE.Texture;
      colorA: string;
      colorB: string;
    };
  },
): void {
  const grp = new THREE.Group();
  grp.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
  grp.rotation.y = opts.rotY;
  parent.add(grp);

  const w = opts.width;
  const h = opts.rectHeight;
  const archR = w * 0.5;
  const sillColor = opts.sillHex ?? '#ded2b9';
  const trimColor = opts.trimHex ?? '#e2d6be';
  const archColor = opts.trimHex ?? '#dfd2b8';
  const keystoneColor = opts.sillHex ?? '#d6c8ac';
  const mullionColor = opts.mullionHex ?? '#463f38';
  const audited = computeAuditedFacadeWindowTransform({
    wallFacePos: [0, 0, 0],
    wallNormal: '+Z',
    depth: 0.09,
    flushClearance: 0.002,
    frameDepth: 0.09,
    glassDepth: 0.028,
    mullionDepth: 0.038,
    glassRecessFromFrameFront: 0.056,
  });
  const glassDepth = audited.extrusions.glassDepth;
  const glassZ = audited.extrusions.glassCenterOutward;
  const mullionDepth = audited.extrusions.mullionDepth;
  const mullionZ = audited.extrusions.mullionCenterOutward;

  // Molded limestone/blush-stone sill & surround frame (offset proud >= 0.03m to prevent Z-fighting)
  if (!opts.omitSill) {
    const needsDeepSill = Boolean(opts.withFlowerBox && !opts.withBalcony);
    const sillDepth = needsDeepSill ? 0.25 : 0.18;
    const sillZ = needsDeepSill ? 0.105 : 0.07;
    ctx.addPart(grp, new THREE.BoxGeometry(w + 0.24, 0.11, sillDepth), sillColor, [0, -0.055, sillZ], [0, 0, 0], {
      castShadow: true,
    });
  }
  for (const sx of [-w * 0.5 - 0.045, w * 0.5 + 0.045]) {
    ctx.addPart(grp, new THREE.BoxGeometry(0.09, h, 0.09), trimColor, [sx, h * 0.5, 0.045]);
  }
  // Semicircular limestone arch hood trim + keystone (keystone tucked when awning crowns arch)
  const archRingGeo = new THREE.TorusGeometry(archR + 0.045, 0.055, 6, 16, Math.PI);
  ctx.addPart(grp, archRingGeo, archColor, [0, h, 0.04]);
  if (!opts.withAwning) {
    ctx.addPart(grp, new THREE.BoxGeometry(0.13, 0.16, 0.11), keystoneColor, [0, h + archR + 0.05, 0.055]);
  }

  // Warm glowing window glass (solid 3D box + extruded fanlight placed in unbaked glassHost when provided)
  const glassParent = (() => {
    if (!opts.glassHost) return grp;
    const gBay = new THREE.Group();
    gBay.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
    gBay.rotation.y = opts.rotY;
    opts.glassHost.add(gBay);
    return gBay;
  })();
  const glassSpec = opts.windowId
    ? createCityWindowSpec(
        opts.windowId,
        opts.windowKind ?? 'upper_floor',
        opts.windowKind === 'storefront' ? '#e8f4fc' : '#cfe7fa',
        opts.windowRow ?? 0,
        opts.windowCol ?? 0,
      )
    : null;

  const rectGlass = new THREE.BoxGeometry(w, h, glassDepth);
  const rectMesh = ctx.addPart(glassParent, rectGlass, '#ffffff', [0, h * 0.5, glassZ], [0, 0, 0], {
    map: opts.glassTex,
  });
  if (glassSpec) tagCityWindowMesh(rectMesh, glassSpec);

  const fanShape = new THREE.Shape();
  fanShape.absarc(0, 0, archR, 0, Math.PI, false);
  fanShape.closePath();
  const fanGlass = new THREE.ExtrudeGeometry(fanShape, {
    depth: glassDepth,
    bevelEnabled: false,
    curveSegments: 16,
  });
  fanGlass.translate(0, 0, -glassDepth * 0.5);
  ctx.applyNormalizedDiscUvs(fanGlass, archR);
  const fanMesh = ctx.addPart(glassParent, fanGlass, '#ffffff', [0, h, glassZ], [0, 0, 0], {
    map: opts.glassTex,
  });
  if (glassSpec) tagCityWindowMesh(fanMesh, glassSpec);

  // Crisp dark-bronze or champagne-oak mullions proud of glass without exceeding outer frame
  ctx.addPart(grp, new THREE.BoxGeometry(0.042, h + archR, mullionDepth), mullionColor, [0, (h + archR) * 0.5, mullionZ]);
  ctx.addPart(grp, new THREE.BoxGeometry(w, 0.048, mullionDepth), mullionColor, [0, h, mullionZ]);
  ctx.addPart(grp, new THREE.BoxGeometry(w, 0.036, mullionDepth), mullionColor, [0, h * 0.48, mullionZ]);
  if (opts.archMuntinFan) {
    for (const ang of [Math.PI * 0.25, Math.PI * 0.75]) {
      ctx.addPart(
        grp,
        new THREE.BoxGeometry(0.028, archR, mullionDepth * 0.9),
        mullionColor,
        [Math.cos(ang) * archR * 0.5, h + Math.sin(ang) * archR * 0.5, mullionZ],
        [0, 0, ang - Math.PI * 0.5],
      );
    }
  }
  if (opts.withJulietBar) {
    const jW = w + 0.16;
    ctx.addPart(grp, new THREE.BoxGeometry(jW, 0.036, 0.036), '#3c3631', [0, 0.44, 0.16]);
    ctx.addPart(grp, new THREE.BoxGeometry(jW, 0.028, 0.028), '#3c3631', [0, 0.08, 0.16]);
    for (let b = 0; b < 5; b++) {
      const bx = -jW * 0.42 + (b / 4) * (jW * 0.84);
      ctx.addPart(grp, new THREE.BoxGeometry(0.022, 0.38, 0.022), '#3c3631', [bx, 0.26, 0.16]);
    }
    for (const sx of [-jW * 0.48, jW * 0.48]) {
      ctx.addPart(grp, new THREE.BoxGeometry(0.028, 0.028, 0.16), '#3c3631', [sx, 0.44, 0.08]);
    }
  }

  // Optional Wrought-Iron Juliet Balcony & Flower Box
  if (opts.withBalcony) {
    const bW = w + 0.24;
    const bD = 0.38;
    ctx.addPart(grp, new THREE.BoxGeometry(bW, 0.07, bD), '#dcd0b6', [0, 0.035, bD * 0.5 + 0.06], [0, 0, 0], {
      castShadow: true,
    });
    // Antique wrought-iron rails (#3c434d, zero strokeWidth so never pitch-black blob)
    ctx.addPart(grp, new THREE.BoxGeometry(bW, 0.04, 0.04), '#3c434d', [0, 0.56, bD + 0.06]);
    for (const sx of [-bW * 0.48, bW * 0.48]) {
      ctx.addPart(grp, new THREE.BoxGeometry(0.04, 0.54, 0.04), '#3c434d', [sx, 0.29, bD + 0.06]);
      ctx.addPart(grp, new THREE.BoxGeometry(0.035, 0.04, bD), '#3c434d', [sx, 0.56, bD * 0.5 + 0.06]);
    }
    const barCount = 5;
    for (let b = 0; b < barCount; b++) {
      const bx = -bW * 0.38 + (b / (barCount - 1)) * (bW * 0.76);
      ctx.addPart(grp, new THREE.BoxGeometry(0.024, 0.50, 0.024), '#3c434d', [bx, 0.29, bD + 0.06]);
    }
  }

  if (opts.withFlowerBox) {
    const boxZ = opts.withBalcony ? 0.25 : 0.145;
    const boxY = opts.withBalcony ? 0.14 : 0.075;
    const boxD = opts.withBalcony ? 0.18 : 0.17;
    ctx.addPart(grp, new THREE.BoxGeometry(w * 0.92, 0.15, boxD), '#8f5f3b', [0, boxY, boxZ]);
    ctx.addPart(grp, new THREE.BoxGeometry(w * 0.86, 0.04, boxD - 0.04), '#57402e', [0, boxY + 0.075, boxZ]);
    // Lush foliage + pastel pink/lavender/cream flower tufts (zero strawberries)
    const fCols = ['#f39dbb', '#c084fc', '#fde68a', '#f9a8d4', '#a78bfa'];
    for (let f = 0; f < 5; f++) {
      const fx = -w * 0.34 + (f / 4) * (w * 0.68);
      ctx.addPart(grp, new THREE.SphereGeometry(0.08, 7, 6), '#4b8f42', [fx, boxY + 0.12, boxZ]);
      ctx.addPart(grp, new THREE.SphereGeometry(0.052, 6, 5), fCols[f % fCols.length], [
        fx + (f % 2 === 0 ? 0.02 : -0.02),
        boxY + 0.17,
        boxZ + 0.02,
      ]);
    }
  }

  if (opts.withAwning) {
    buildSlopedStripedAwning(grp, ctx, {
      width: w + 0.28,
      depth: 0.56,
      dropH: 0.22,
      pos: [0, h + archR + 0.25, 0.04],
      rotY: 0,
      stripeTex: opts.withAwning.stripeTex,
      colorA: opts.withAwning.colorA,
      colorB: opts.withAwning.colorB,
    });
  }
}

function buildCornerQuoins(
  parent: THREE.Object3D,
  ctx: UrbanPlazaBuildingsContext,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  startY: number,
  endY: number,
): void {
  const courseH = 0.34;
  const count = Math.floor((endY - startY) / courseH);
  const corners: readonly [number, number, number, number][] = [
    [minX, minZ, 1, 1],
    [maxX, minZ, -1, 1],
    [minX, maxZ, 1, -1],
    [maxX, maxZ, -1, -1],
  ];
  for (let i = 0; i < count; i++) {
    const cy = startY + (i + 0.5) * courseH;
    const isLongX = i % 2 === 0;
    const lenX = isLongX ? 0.50 : 0.30;
    const lenZ = isLongX ? 0.30 : 0.50;
    for (const [cx, cz, dirX, dirZ] of corners) {
      ctx.addPart(
        parent,
        new THREE.BoxGeometry(lenX, courseH - 0.045, 0.05),
        '#dfd3b8',
        [cx + dirX * (lenX * 0.5 - 0.02), cy, cz - dirZ * 0.012],
      );
      ctx.addPart(
        parent,
        new THREE.BoxGeometry(0.05, courseH - 0.045, lenZ),
        '#dfd3b8',
        [cx - dirX * 0.012, cy, cz + dirZ * (lenZ * 0.5 - 0.02)],
      );
    }
  }
}

function buildWroughtIronRailingRun(
  parent: THREE.Object3D,
  ctx: UrbanPlazaBuildingsContext,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  baseY: number,
  height = 0.80,
): void {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  if (len < 0.08) return;
  const cx = (x1 + x2) * 0.5;
  const cz = (z1 + z2) * 0.5;
  const yaw = Math.atan2(-dz, dx);
  const railColor = '#3a414b';

  // Top & bottom horizontal bars
  ctx.addPart(parent, new THREE.BoxGeometry(len, 0.042, 0.042), railColor, [cx, baseY + height, cz], [
    0,
    yaw,
    0,
  ]);
  ctx.addPart(parent, new THREE.BoxGeometry(len, 0.032, 0.032), railColor, [cx, baseY + 0.08, cz], [
    0,
    yaw,
    0,
  ]);

  // Corner/intermediate stanchion posts + slender vertical balusters
  const postCount = Math.max(2, Math.round(len / 1.45) + 1);
  for (let p = 0; p < postCount; p++) {
    const f = p / (postCount - 1);
    const px = x1 + dx * f;
    const pz = z1 + dz * f;
    ctx.addPart(parent, new THREE.BoxGeometry(0.055, height + 0.04, 0.055), railColor, [
      px,
      baseY + height * 0.5 + 0.01,
      pz,
    ]);
    ctx.addPart(parent, new THREE.SphereGeometry(0.042, 7, 5), '#4e5662', [px, baseY + height + 0.05, pz]);
  }

  const balusterCount = Math.max(2, Math.floor(len / 0.24));
  for (let b = 1; b < balusterCount; b++) {
    const f = b / balusterCount;
    ctx.addPart(parent, new THREE.BoxGeometry(0.022, height - 0.08, 0.022), railColor, [
      x1 + dx * f,
      baseY + height * 0.5 + 0.04,
      z1 + dz * f,
    ]);
  }
}

function buildPerchedSongbird(
  parent: THREE.Object3D,
  ctx: UrbanPlazaBuildingsContext,
  pos: [number, number, number],
  yaw: number,
): void {
  const grp = new THREE.Group();
  grp.position.set(pos[0], pos[1], pos[2]);
  grp.rotation.y = yaw;
  parent.add(grp);

  const bodyGeo = new THREE.SphereGeometry(0.068, 8, 6);
  bodyGeo.scale(0.85, 0.85, 1.35);
  ctx.addPart(grp, bodyGeo, '#9e7b5e', [0, 0.068, 0]);
  ctx.addPart(grp, new THREE.SphereGeometry(0.052, 7, 6), '#e8dcc8', [0, 0.056, 0.025]);
  ctx.addPart(grp, new THREE.SphereGeometry(0.048, 7, 6), '#8b684d', [0, 0.125, 0.055]);
  ctx.addPart(grp, new THREE.ConeGeometry(0.018, 0.05, 5), '#e2a43b', [0, 0.125, 0.115], [Math.PI * 0.5, 0, 0]);
  ctx.addPart(grp, new THREE.BoxGeometry(0.04, 0.018, 0.095), '#78573e', [0, 0.095, -0.09], [0.35, 0, 0]);
}

export function buildRooftopGardenPlanterBox(
  parent: THREE.Object3D,
  ctx: UrbanPlazaBuildingsContext,
  originX: number,
  originZ: number,
  groupYaw: number,
  lx: number,
  ly: number,
  lz: number,
  len: number,
  depth: number,
  rotY: number,
  timberTex: THREE.Texture,
): void {
  const grp = new THREE.Group();
  grp.position.set(lx, ly, lz);
  grp.rotation.y = rotY;
  parent.add(grp);

  // Honey-oak timber planter trough + mitered overhanging rim + dark soil bed (ZERO strawberries)
  const boxGeo = applyGrainUvs(createBeveledBox(len, 0.34, depth, 0.012), 'x', 1.2);
  ctx.addPart(grp, boxGeo, '#ffffff', [0, 0.17, 0], [0, 0, 0], { map: timberTex, castShadow: true });
  ctx.addPart(grp, createMiteredPerimeterCurbGeo(len + 0.06, depth + 0.06, 0.075, 0.046), '#c9935b', [0, 0.355, 0]);
  ctx.addPart(grp, new THREE.BoxGeometry(len - 0.10, 0.04, depth - 0.10), '#5a4331', [0, 0.335, 0]);

  const shrubCount = Math.max(2, Math.round(len / 0.55));
  const bloomTints = ['#c4b5fd', '#ddd6fe', '#f5f3ff', '#dbeafe', '#f8f4e8'];
  for (let s = 0; s < shrubCount; s++) {
    const offX = -len * 0.34 + (shrubCount === 1 ? 0 : (s / (shrubCount - 1)) * (len * 0.68));
    const cosR = Math.cos(rotY);
    const sinR = Math.sin(rotY);
    const px = lx + offX * cosR;
    const pz = lz - offX * sinR;

    // Ground-anchored instanced hydrangea/lavender herb shrub at soil surface (`y=0` base, scale 0.46..0.54 per #82)
    const sc = 0.46 + (s % 3) * 0.04;
    ctx.shrubCollectors.matrices.push(
      composeWorldCollectorMatrix(originX, originZ, groupYaw, px, ly + 0.35, pz, s * 1.1, [sc, sc * 0.85, sc]),
    );
    ctx.shrubCollectors.colors.push(new THREE.Color(bloomTints[s % bloomTints.length]));

    // Direct lush green herb domes + pastel lavender spikes (strictly NO red berries)
    ctx.addPart(grp, new THREE.SphereGeometry(0.13, 8, 6), '#529342', [offX, 0.42, 0]);
    ctx.addPart(grp, new THREE.ConeGeometry(0.042, 0.15, 6), s % 2 === 0 ? '#a78bfa' : '#e9d5ff', [
      offX + 0.04,
      0.54,
      0.03,
    ]);
  }
}

// ============================================================================
// 1. BOUTIQUE & ROOFTOP GARDEN TOWER (`buildBoutiqueRooftopTower3D`)
// ============================================================================

export function buildBoutiqueRooftopTower3D(ctx: UrbanPlazaBuildingsContext): void {
  const bt = CENTRAL_PARK_MASTERPLAN.boutiqueTower;
  const grp = new THREE.Group();
  grp.name = 'UrbanPlazaBoutiqueTower3D';
  grp.position.set(bt.x, 0, bt.z);
  grp.rotation.y = bt.yaw;
  ctx.staticGroup.add(grp);

  // Unbaked mirror group in animatedGroup so individual window glass meshes preserve cityWindowSpec
  const glassHost = new THREE.Group();
  glassHost.name = 'UrbanPlazaBoutiqueTowerGlassHost';
  glassHost.position.set(bt.x, 0, bt.z);
  glassHost.rotation.y = bt.yaw;
  ctx.animatedGroup.add(glassHost);

  // Bespoke high-craft building textures (registered via ctx.registerTex)
  const terracottaTex = createTerracottaStorefrontTexture(ctx);
  const stuccoTex = createCreamStuccoTexture(ctx);
  const honeyPineDeckTex = createHoneyPineDeckTexture(ctx);
  const honeyOakTex = createHoneyOakTimberTexture(ctx);
  const yellowAwningTex = createStripedAwningTexture(ctx, '#efc24c', '#fcf2da');
  const boutiqueGlowTex = createWarmWindowGlowTexture(ctx, 'boutique');
  const boutiqueBackdropTex = createDisplayAlcoveBackdropTexture(ctx, 'boutique');
  const clearStorefrontGlassTex = createClearStorefrontGlassTexture(ctx);
  const clearStorefrontGlassMat = createClearStorefrontGlassMaterial(ctx, clearStorefrontGlassTex);
  const casementGlowTex = createWarmWindowGlowTexture(ctx, 'casement');

  const W = 9.2; // local X span [-4.6 .. +4.6] -> World Z [-5.0 .. +4.2]
  const D = 8.4; // local Z span [-4.2 .. +4.2] -> World X [8.0 .. 16.4]
  const halfW = W * 0.5; // 4.6
  const halfD = D * 0.5; // 4.2
  const gfH = bt.groundFloorHeight; // 4.35

  // -------------------------------------------------------------------------
  // 1F VENETIAN / TERRACOTTA-RED BOUTIQUE STOREFRONT (`y = 0 .. 4.35m`)
  // -------------------------------------------------------------------------
  // Grounded limestone plinth skirt
  ctx.addPart(
    grp,
    ctx.applyPlanarUvs(new THREE.BoxGeometry(W + 0.16, 0.34, D + 0.16), 1.8),
    '#ffffff',
    [0, 0.17, 0],
    [0, 0, 0],
    { map: ctx.textures.stoneTex, receiveShadow: true },
  );

  // Main 1F structural terracotta-red storefront core (inset 0.48m so recessed display windows & mannequins sit completely inside!)
  ctx.addPart(
    grp,
    ctx.applyPlanarUvs(new THREE.BoxGeometry(W - 0.96, gfH - 0.68, D - 0.96), 2.2),
    '#ffffff',
    [0, 0.34 + (gfH - 0.68) * 0.5, 0],
    [0, 0, 0],
    { map: terracottaTex, castShadow: true },
  );

  // Outer terracotta-red wainscoting lower belt (y = 0.34 .. 0.72m)
  ctx.addPart(
    grp,
    ctx.applyPlanarUvs(new THREE.BoxGeometry(W, 0.38, D), 2.0),
    '#ffffff',
    [0, 0.53, 0],
    [0, 0, 0],
    { map: terracottaTex, castShadow: true },
  );

  // Solid 1F corner & center pilaster masonry returns connecting core walls cleanly into pilasters (zero corner gaps)
  const core1FH = gfH - 0.68; // 4.52m (`y = 0.34 .. 4.86`) -> returns span `y = 0.34 .. 4.54` inside cornice
  const return1FH = gfH - 1.00; // 4.20m (`y = 0.34 .. 4.54`)
  const return1FY = 0.34 + return1FH * 0.5; // 2.44
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      const cornerPier = ctx.addPart(
        grp,
        ctx.applyPlanarUvs(new THREE.BoxGeometry(0.52, return1FH, 0.52), 2.2),
        '#ffffff',
        [sx * (halfW - 0.26), return1FY, sz * (halfD - 0.26)],
        [0, 0, 0],
        { map: terracottaTex, castShadow: true },
      );
      cornerPier.name = `Boutique1FCornerPier_${sx > 0 ? 'E' : 'W'}_${sz > 0 ? 'S' : 'N'}`;
    }
    const sideCenterReturn = ctx.addPart(
      grp,
      ctx.applyPlanarUvs(new THREE.BoxGeometry(0.34, return1FH, 0.28), 2.2),
      '#ffffff',
      [sx * (halfW - 0.33), return1FY, 0],
      [0, 0, 0],
      { map: terracottaTex, castShadow: true },
    );
    sideCenterReturn.name = `Boutique1FPilasterReturn_${sx > 0 ? 'SidePos' : 'SideNeg'}`;
  }
  for (const sz of [-1, 1] as const) {
    for (const px of [-1.25, 1.25] as const) {
      const frontRearReturn = ctx.addPart(
        grp,
        ctx.applyPlanarUvs(new THREE.BoxGeometry(0.28, return1FH, 0.34), 2.2),
        '#ffffff',
        [px, return1FY, sz * (halfD - 0.33)],
        [0, 0, 0],
        { map: terracottaTex, castShadow: true },
      );
      frontRearReturn.name = `Boutique1FPilasterReturn_${sz > 0 ? 'Front' : 'Rear'}_${px > 0 ? 'R' : 'L'}`;
    }
  }
  // Front door jamb masonry reveals + upper door spandrel (`y = 4.20 .. 4.54`) sealing entrance recess to core
  for (const dx of [-1.12, 1.12] as const) {
    const doorReveal = ctx.addPart(
      grp,
      ctx.applyPlanarUvs(new THREE.BoxGeometry(0.22, 4.06, 0.36), 2.2),
      '#ffffff',
      [dx, 2.11, halfD - 0.32],
      [0, 0, 0],
      { map: terracottaTex, castShadow: true },
    );
    doorReveal.name = `Boutique1FDoorReveal_${dx > 0 ? 'R' : 'L'}`;
  }
  const doorSpandrel = ctx.addPart(
    grp,
    ctx.applyPlanarUvs(new THREE.BoxGeometry(2.24, 0.34, 0.52), 2.2),
    '#ffffff',
    [0, 4.37, halfD - 0.24],
    [0, 0, 0],
    { map: terracottaTex, castShadow: true },
  );
  doorSpandrel.name = 'Boutique1FDoorSpandrel';

  // Corner & bay fluted pilasters on all 4 ground-floor elevations (scaled to 5.20m 1F height)
  const pilasterH = gfH - 1.06;
  const pilasterY = 0.36 + pilasterH * 0.5;
  const frontPilasterXs = [-4.48, -1.25, 1.25, 4.48];
  for (const px of frontPilasterXs) {
    for (const pz of [halfD - 0.08, -halfD + 0.08]) {
      ctx.addPart(grp, createBeveledBox(0.32, pilasterH, 0.24, 0.012), '#a84239', [px, pilasterY, pz], [0, 0, 0], {
        castShadow: true,
      });
      ctx.addPart(grp, createBeveledBox(0.38, 0.14, 0.28, 0.012), '#b85046', [px, pilasterY + pilasterH * 0.5 - 0.04, pz]);
      ctx.addPart(grp, createBeveledBox(0.38, 0.12, 0.28, 0.012), '#c7beaa', [px, 0.42, pz]);
    }
  }
  for (const pz of [-halfD + 0.12, 0.0, halfD - 0.12]) {
    for (const px of [-halfW + 0.08, halfW - 0.08]) {
      ctx.addPart(grp, createBeveledBox(0.24, pilasterH, 0.32, 0.012), '#a84239', [px, pilasterY, pz], [0, 0, 0], {
        castShadow: true,
      });
      ctx.addPart(grp, createBeveledBox(0.28, 0.14, 0.38, 0.012), '#b85046', [px, pilasterY + pilasterH * 0.5 - 0.04, pz]);
    }
  }
  void core1FH;

  // East Front (+Z_local): Tall 4.02m Clear Glass Double Entrance Doors (scaled for 3.30m outdoor avatars)
  ctx.addPart(grp, createBeveledBox(2.45, 0.08, 0.52, 0.014), '#dfd4be', [0, 0.04, halfD + 0.18]);
  for (const dx of [-1.08, 1.08]) {
    ctx.addPart(grp, createBeveledBox(0.16, 4.06, 0.24, 0.014), '#543c2c', [dx, 2.11, halfD - 0.04]);
  }
  ctx.addPart(grp, createBeveledBox(2.32, 0.18, 0.24, 0.014), '#543c2c', [0, 4.11, halfD - 0.04]);
  // Double glass entrance door leaves (3.94m clear opening) + transom rail + bent tubular brass pulls
  const frontDoorGlass = ctx.addPart(
    glassHost,
    new THREE.BoxGeometry(2.00, 3.94, 0.028),
    '#ffffff',
    [0, 2.05, halfD - 0.02],
    [0, 0, 0],
    { map: boutiqueGlowTex },
  );
  tagCityWindowMesh(frontDoorGlass, {
    ...createCityWindowSpec('boutique-1f-entry-door', 'civic', '#e8f4fc', 1, 0),
    intensityScale: 0.65,
  });
  ctx.addPart(grp, createBeveledBox(0.085, 3.94, 0.06, 0.008), '#543c2c', [0, 2.05, halfD + 0.01]);
  ctx.addPart(grp, createBeveledBox(2.02, 0.075, 0.06, 0.008), '#543c2c', [0, 3.24, halfD + 0.01]);
  for (const hx of [-0.14, 0.14]) {
    buildTubularDoorPull(grp, ctx, [hx, 1.66, halfD + 0.035], 0.56, '#d4a644', 0.085);
  }

  // Helper to mount illuminated 1F storefront showcase windows with interior mannequins seated inside recessed niche
  let storeBayIdx = 0;
  const addStoreDisplayBay = (
    bayPos: [number, number, number],
    rotY: number,
    bayW: number,
    dressColors: readonly [string, string],
  ) => {
    const bayIdx = storeBayIdx;
    storeBayIdx += 1;

    const bayGrp = new THREE.Group();
    bayGrp.name = `Boutique1FDisplayBay_${bayIdx}`;
    bayGrp.position.set(bayPos[0], bayPos[1], bayPos[2]);
    bayGrp.rotation.y = rotY;
    grp.add(bayGrp);

    const glassBayGrp = new THREE.Group();
    glassBayGrp.name = `Boutique1FDisplayGlassBay_${bayIdx}`;
    glassBayGrp.position.set(bayPos[0], bayPos[1], bayPos[2]);
    glassBayGrp.rotation.y = rotY;
    glassHost.add(glassBayGrp);

    // `bayW` includes +0.04m overlap at each flanking pilaster/pier; `clearW` is the exact pilaster-to-pilaster opening
    const clearW = bayW - 0.08;

    // Molded wainscoting frame + warm window sill spanning full depth (`z = -0.03 .. +0.46`) into core & pilasters
    const sillMesh = ctx.addPart(bayGrp, createBeveledBox(bayW + 0.02, 0.12, 0.49, 0.012), '#dfd3bb', [0, 0.76, 0.215]);
    sillMesh.name = 'Boutique1FDisplaySill';
    ctx.addPart(bayGrp, createBeveledBox(clearW - 0.10, 0.26, 0.06, 0.008), '#883029', [0, 0.54, 0.40]);

    // Warm illuminated boutique gallery alcove backing wall behind the mannequins (`z = -0.010 .. +0.016`)
    const backdropMesh = ctx.addPart(
      bayGrp,
      new THREE.BoxGeometry(clearW - 0.04, 3.14, 0.026),
      '#ffffff',
      [0, 2.39, 0.003],
      [0, 0, 0],
      { map: boutiqueBackdropTex, bounce: 2.72 },
    );
    backdropMesh.name = 'Boutique1FDisplayBackdrop';
    // Recessed warm tungsten LED cove bar mounted under vitrine header soffit
    const ledStripMesh = ctx.addPart(
      bayGrp,
      new THREE.BoxGeometry(clearW - 0.24, 0.045, 0.09),
      '#fff1cc',
      [0, 3.93, 0.20],
      [0, 0, 0],
      { bounce: 2.95 },
    );
    ledStripMesh.name = 'Boutique1FDisplayLedCove';

    // Interior boutique mannequins (`z = 0.200`, radius <= 0.176m -> `z in [0.024 .. 0.376]`) seated strictly behind front glass (`z in [0.388 .. 0.412]`)
    const mLeft = new THREE.Group();
    mLeft.name = 'BoutiqueMannequin_Left';
    mLeft.scale.setScalar(1.16);
    mLeft.position.set(-bayW * 0.24, 0.82, 0.200);
    bayGrp.add(mLeft);
    buildBoutiqueMannequinSilhouette(mLeft, ctx, [0, 0, 0], dressColors[0]);
    const mRight = new THREE.Group();
    mRight.name = 'BoutiqueMannequin_Right';
    mRight.scale.setScalar(1.16);
    mRight.position.set(bayW * 0.24, 0.82, 0.200);
    bayGrp.add(mRight);
    buildBoutiqueMannequinSilhouette(mRight, ctx, [0, 0, 0], dressColors[1]);

    // Clear reflective 3D storefront showcase glass mounted AT the front mullion rabbet (`z = 0.400`, behind outer bronze mullions `0.4075..0.4625`)
    const bayGlassGeo = new THREE.BoxGeometry(bayW, 3.14, 0.024);
    ctx.registerGeo(bayGlassGeo);
    const bayGlassMesh = new THREE.Mesh(bayGlassGeo, clearStorefrontGlassMat);
    bayGlassMesh.name = `Boutique1FDisplayGlass_${bayIdx}`;
    bayGlassMesh.position.set(0, 2.39, 0.400);
    bayGlassMesh.castShadow = false;
    bayGlassMesh.receiveShadow = false;
    bayGlassMesh.renderOrder = 2;
    glassBayGrp.add(bayGlassMesh);
    tagCityWindowMesh(
      bayGlassMesh,
      createCityWindowSpec(`boutique-1f-bay-${bayIdx}`, 'storefront', '#d6f4ff', 1, bayIdx + 1),
    );

    // Full-depth dark-bronze side jamb returns (`z = -0.03 .. +0.46`, embedded +4.5cm inside flanking pilasters)
    for (const jx of [-clearW * 0.5, clearW * 0.5]) {
      const jambMesh = ctx.addPart(bayGrp, new THREE.BoxGeometry(0.09, 3.28, 0.49), '#463f38', [jx, 2.42, 0.215]);
      jambMesh.name = 'Boutique1FDisplayJamb';
    }
    // Slim dark-bronze exterior window mullions, transom, head & sill rails embedded into side jambs & pilasters
    ctx.addPart(bayGrp, new THREE.BoxGeometry(0.05, 3.22, 0.055), '#463f38', [0, 2.42, 0.435]);
    const transomMesh = ctx.addPart(bayGrp, new THREE.BoxGeometry(bayW, 0.05, 0.055), '#463f38', [0, 3.24, 0.435]);
    transomMesh.name = 'Boutique1FDisplayTransom';
    const topRailMesh = ctx.addPart(bayGrp, new THREE.BoxGeometry(bayW, 0.05, 0.055), '#463f38', [0, 3.935, 0.435]);
    topRailMesh.name = 'Boutique1FDisplayTopRail';
    const bottomRailMesh = ctx.addPart(bayGrp, new THREE.BoxGeometry(bayW, 0.05, 0.055), '#463f38', [0, 0.845, 0.435]);
    bottomRailMesh.name = 'Boutique1FDisplayBottomRail';
    const headerMesh = ctx.addPart(bayGrp, createBeveledBox(bayW + 0.02, 0.14, 0.49, 0.010), '#7e2d26', [0, 4.02, 0.215]);
    headerMesh.name = 'Boutique1FDisplayHeader';
  };

  // East Front Left & Right Display Bays (clear 2.91m between ±1.41 and ±4.32 pilasters; bayW 2.99m embeds +4cm each side)
  addStoreDisplayBay([-2.865, 0, halfD - 0.46], 0, 2.99, ['#d87a90', '#e8d8be']);
  addStoreDisplayBay([2.865, 0, halfD - 0.46], 0, 2.99, ['#5d9792', '#f2cad6']);
  // South Side & North Side Display Bays (clear 3.76m between ±0.16 and ±3.92 pilasters; bayW 3.84m embeds +4cm each side)
  addStoreDisplayBay([-halfW + 0.46, 0, -2.04], -Math.PI * 0.5, 3.84, ['#e2a4b4', '#d8cba8']);
  addStoreDisplayBay([-halfW + 0.46, 0, 2.04], -Math.PI * 0.5, 3.84, ['#73a8a2', '#f4d3b8']);
  addStoreDisplayBay([halfW - 0.46, 0, -2.04], Math.PI * 0.5, 3.84, ['#d87a90', '#d8cba8']);
  addStoreDisplayBay([halfW - 0.46, 0, 2.04], Math.PI * 0.5, 3.84, ['#5d9792', '#e8d8be']);
  // West Rear Facade Bays (clear 2.91m between ±1.41 and ±4.32 pilasters + wall-seated 3.65m service door)
  addStoreDisplayBay([-2.865, 0, -halfD + 0.46], Math.PI, 2.99, ['#e8d8be', '#73a8a2']);
  addStoreDisplayBay([2.865, 0, -halfD + 0.46], Math.PI, 2.99, ['#d87a90', '#e8d8be']);
  ctx.addPart(grp, createBeveledBox(1.36, 3.65, 0.14, 0.010), '#792d27', [0, 1.88, -halfD + 0.43]);
  ctx.addPart(grp, new THREE.SphereGeometry(0.044, 8, 6), '#d4a644', [0.46, 1.66, -halfD + 0.34]);

  // Yellow & Cream Striped Scalloped Awnings clearing 3.30m avatars (bottom ~3.92m)
  buildSlopedStripedAwning(grp, ctx, {
    width: 8.85,
    depth: 0.92,
    dropH: 0.46,
    pos: [0, 4.38, halfD + 0.02],
    rotY: 0,
    stripeTex: yellowAwningTex,
    colorA: '#efc24c',
    colorB: '#fcf2da',
  });
  buildSlopedStripedAwning(grp, ctx, {
    width: 7.75,
    depth: 0.82,
    dropH: 0.44,
    pos: [-halfW - 0.02, 4.38, 0],
    rotY: -Math.PI * 0.5,
    stripeTex: yellowAwningTex,
    colorA: '#efc24c',
    colorB: '#fcf2da',
  });
  buildSlopedStripedAwning(grp, ctx, {
    width: 7.75,
    depth: 0.82,
    dropH: 0.44,
    pos: [halfW + 0.02, 4.38, 0],
    rotY: Math.PI * 0.5,
    stripeTex: yellowAwningTex,
    colorA: '#efc24c',
    colorB: '#fcf2da',
  });

  // Projecting "Teal Vintage Trim" Molded Dentil Cornice (`#4a7c7a`, y = 4.52 .. 5.23m)
  ctx.addPart(grp, createBeveledBox(W + 0.30, 0.38, D + 0.30, 0.016), '#4a7c7a', [0, 4.71, 0], [0, 0, 0], {
    castShadow: true,
  });
  for (const pz of [halfD + 0.16, -halfD - 0.16]) {
    for (const px of [-2.85, 0, 2.85]) {
      ctx.addPart(grp, createBeveledBox(2.15, 0.22, 0.04, 0.008), '#5a8e8c', [px, 4.71, pz]);
    }
  }
  for (const px of [-halfW - 0.16, halfW + 0.16]) {
    for (const pz of [-2.0, 2.0]) {
      ctx.addPart(grp, createBeveledBox(0.04, 0.22, 2.95, 0.008), '#5a8e8c', [px, 4.71, pz]);
    }
  }
  const dentilSpanX = W + 0.26;
  const dentilCountX = 24;
  for (let i = 0; i < dentilCountX; i++) {
    const dx = -dentilSpanX * 0.47 + (i / (dentilCountX - 1)) * (dentilSpanX * 0.94);
    ctx.addPart(grp, new THREE.BoxGeometry(0.14, 0.10, 0.10), '#3b6765', [dx, 4.94, halfD + 0.20]);
    ctx.addPart(grp, new THREE.BoxGeometry(0.14, 0.10, 0.10), '#3b6765', [dx, 4.94, -halfD - 0.20]);
  }
  const dentilSpanZ = D + 0.26;
  const dentilCountZ = 22;
  for (let i = 0; i < dentilCountZ; i++) {
    const dz = -dentilSpanZ * 0.47 + (i / (dentilCountZ - 1)) * (dentilSpanZ * 0.94);
    ctx.addPart(grp, new THREE.BoxGeometry(0.10, 0.10, 0.14), '#3b6765', [-halfW - 0.20, 4.94, dz]);
    ctx.addPart(grp, new THREE.BoxGeometry(0.10, 0.10, 0.14), '#3b6765', [halfW + 0.20, 4.94, dz]);
  }
  ctx.addPart(grp, createBeveledBox(W + 0.54, 0.16, D + 0.54, 0.016), '#4a7c7a', [0, 5.07, 0], [0, 0, 0], {
    castShadow: true,
  });
  ctx.addPart(
    grp,
    ctx.applyPlanarUvs(createBeveledBox(W + 0.62, 0.08, D + 0.62, 0.016), 2.0),
    '#ffffff',
    [0, 5.19, 0],
    [0, 0, 0],
    { map: ctx.textures.stoneTex, receiveShadow: true },
  );

  // Street-Level 1.68x Classic Bench & Symmetrical Spherical Boxwood Urn Planters (grounded at y = 0)
  buildClassicTeakBench(grp, ctx, [-2.85, 0, halfD + 0.72], 0, honeyOakTex);
  buildUrnBoxwoodPlanter(grp, ctx, [-1.32, 0, halfD + 0.44], 1.0, 'sphere');
  buildUrnBoxwoodPlanter(grp, ctx, [1.32, 0, halfD + 0.44], 1.0, 'sphere');
  buildUrnBoxwoodPlanter(grp, ctx, [-4.32, 0, halfD + 0.44], 0.92, 'sphere');
  buildUrnBoxwoodPlanter(grp, ctx, [4.32, 0, halfD + 0.44], 0.92, 'sphere');
  buildUrnBoxwoodPlanter(grp, ctx, [-halfW - 0.42, 0, halfD - 0.42], 0.90, 'cone');
  buildUrnBoxwoodPlanter(grp, ctx, [halfW + 0.42, 0, halfD - 0.42], 0.90, 'cone');

  // -------------------------------------------------------------------------
  // 2F & 3F CREAM STUCCO TOWER + STEPPED NORTH-EAST WING
  // -------------------------------------------------------------------------
  const towerMinX = -4.35;
  const towerMaxX = 1.25;
  const towerCX = (towerMinX + towerMaxX) * 0.5; // -1.55
  const towerW = towerMaxX - towerMinX; // 5.60
  const towerMinZ = -4.05;
  const towerMaxZ = 0.75;
  const towerCZ = (towerMinZ + towerMaxZ) * 0.5; // -1.65
  const towerD = towerMaxZ - towerMinZ; // 4.80
  const towerTopY = 11.49;

  ctx.addPart(
    grp,
    ctx.applyPlanarUvs(new THREE.BoxGeometry(towerW, towerTopY - gfH, towerD), 2.4),
    '#ffffff',
    [towerCX, gfH + (towerTopY - gfH) * 0.5, towerCZ],
    [0, 0, 0],
    { map: stuccoTex, castShadow: true, receiveShadow: true },
  );
  buildCornerQuoins(grp, ctx, towerMinX, towerMaxX, towerMinZ, towerMaxZ, gfH + 0.08, towerTopY - 0.42);

  // 3F Molded Stone Crown Cornice (`y = 11.09 .. 11.53m`)
  ctx.addPart(grp, createBeveledBox(towerW + 0.28, 0.14, towerD + 0.28, 0.016), '#dfd2b8', [
    towerCX,
    11.16,
    towerCZ,
  ]);
  ctx.addPart(grp, createBeveledBox(towerW + 0.52, 0.24, towerD + 0.52, 0.018), '#e8dcc3', [
    towerCX,
    11.35,
    towerCZ,
  ]);
  ctx.addPart(grp, createBeveledBox(towerW + 0.58, 0.08, towerD + 0.58, 0.016), '#d6c8ae', [
    towerCX,
    11.49,
    towerCZ,
  ]);

  // Stepped 2F Setback Wing: lx in [+1.25 .. +4.35], lz in [-4.05 .. +1.95]
  const wingMinX = 1.25;
  const wingMaxX = 4.35;
  const wingCX = (wingMinX + wingMaxX) * 0.5; // +2.80
  const wingW = wingMaxX - wingMinX; // 3.10
  const wingMinZ = -4.05;
  const wingMaxZ = 1.95;
  const wingCZ = (wingMinZ + wingMaxZ) * 0.5; // -1.05
  const wingD = wingMaxZ - wingMinZ; // 6.00
  const wingTopY = bt.terraceWingHeight; // 8.30

  ctx.addPart(
    grp,
    ctx.applyPlanarUvs(new THREE.BoxGeometry(wingW, wingTopY - gfH, wingD), 2.4),
    '#ffffff',
    [wingCX, gfH + (wingTopY - gfH) * 0.5, wingCZ],
    [0, 0, 0],
    { map: stuccoTex, castShadow: true, receiveShadow: true },
  );
  buildCornerQuoins(grp, ctx, wingMinX, wingMaxX, wingMinZ, wingMaxZ, gfH + 0.08, wingTopY - 0.34);
  ctx.addPart(grp, createBeveledBox(wingW + 0.34, 0.24, wingD + 0.34, 0.016), '#e5d8be', [
    wingCX,
    wingTopY - 0.12,
    wingCZ,
  ]);

  // Arched Casement Windows on 2F & 3F Tower + 2F Wing (all tagged in unbaked glassHost)
  let archWinCol = 0;
  for (const levelY of [5.95, 8.95]) {
    const is3F = levelY > 7.8;
    const rowIdx = is3F ? 3 : 2;
    for (const wx of [-2.95, -0.15]) {
      buildArchedCasementWindow(grp, ctx, {
        pos: [wx, levelY, towerMaxZ],
        rotY: 0,
        width: 1.18,
        rectHeight: 1.28,
        glassTex: casementGlowTex,
        glassHost,
        windowId: `boutique-${rowIdx}f-front-${archWinCol}`,
        windowKind: 'upper_floor',
        windowRow: rowIdx,
        windowCol: archWinCol++,
        withBalcony: is3F && wx < -1.0,
        withFlowerBox: is3F && wx < -1.0,
      });
    }
    for (const wz of [-2.75, -0.55]) {
      buildArchedCasementWindow(grp, ctx, {
        pos: [towerMinX, levelY, wz],
        rotY: -Math.PI * 0.5,
        width: 1.12,
        rectHeight: 1.24,
        glassTex: casementGlowTex,
        glassHost,
        windowId: `boutique-${rowIdx}f-west-${archWinCol}`,
        windowKind: 'upper_floor',
        windowRow: rowIdx,
        windowCol: archWinCol++,
        withBalcony: is3F,
        withFlowerBox: is3F,
      });
    }
    for (const wx of [-2.95, -0.15]) {
      buildArchedCasementWindow(grp, ctx, {
        pos: [wx, levelY, towerMinZ],
        rotY: Math.PI,
        width: 1.14,
        rectHeight: 1.24,
        glassTex: casementGlowTex,
        glassHost,
        windowId: `boutique-${rowIdx}f-rear-${archWinCol}`,
        windowKind: 'upper_floor',
        windowRow: rowIdx,
        windowCol: archWinCol++,
        withBalcony: is3F,
      });
    }
  }
  buildArchedCasementWindow(grp, ctx, {
    pos: [towerMaxX, 9.00, -1.65],
    rotY: Math.PI * 0.5,
    width: 1.16,
    rectHeight: 1.24,
    glassTex: casementGlowTex,
    glassHost,
    windowId: 'boutique-3f-east-0',
    windowKind: 'upper_floor',
    windowRow: 3,
    windowCol: archWinCol++,
    withBalcony: true,
    withFlowerBox: true,
    withAwning: { stripeTex: yellowAwningTex, colorA: '#efc24c', colorB: '#fcf2da' },
  });

  buildArchedCasementWindow(grp, ctx, {
    pos: [wingCX, 6.00, wingMaxZ],
    rotY: 0,
    width: 1.12,
    rectHeight: 1.18,
    glassTex: casementGlowTex,
    glassHost,
    windowId: 'boutique-2f-wing-front-0',
    windowKind: 'upper_floor',
    windowRow: 2,
    windowCol: archWinCol++,
    withFlowerBox: true,
    withAwning: { stripeTex: yellowAwningTex, colorA: '#efc24c', colorB: '#fcf2da' },
  });
  buildArchedCasementWindow(grp, ctx, {
    pos: [wingMaxX, 6.00, -1.15],
    rotY: Math.PI * 0.5,
    width: 1.14,
    rectHeight: 1.18,
    glassTex: casementGlowTex,
    glassHost,
    windowId: 'boutique-2f-wing-east-0',
    windowKind: 'upper_floor',
    windowRow: 2,
    windowCol: archWinCol++,
    withBalcony: true,
    withFlowerBox: true,
    withAwning: { stripeTex: yellowAwningTex, colorA: '#efc24c', colorB: '#fcf2da' },
  });
  // 2F Wing-to-Terrace Door centered cleanly at z = 1.11 between tower junction (0.75) and corner quoins (1.47)
  ctx.addPart(grp, createBeveledBox(0.08, 2.02, 0.66, 0.010), '#7a5638', [wingMinX - 0.042, gfH + 1.05, 1.11]);
  const terraceDoorGlass = ctx.addPart(
    glassHost,
    new THREE.BoxGeometry(0.028, 1.48, 0.50),
    '#ffffff',
    [wingMinX - 0.094, gfH + 1.18, 1.11],
    [0, 0, 0],
    { map: casementGlowTex },
  );
  tagCityWindowMesh(
    terraceDoorGlass,
    createCityWindowSpec('boutique-2f-terrace-door', 'upper_floor', '#cfe7fa', 2, archWinCol),
  );
  buildSlopedStripedAwning(grp, ctx, {
    width: 0.70,
    depth: 0.48,
    dropH: 0.26,
    pos: [wingMinX - 0.02, gfH + 2.34, 1.11],
    rotY: -Math.PI * 0.5,
    stripeTex: yellowAwningTex,
    colorA: '#efc24c',
    colorB: '#fcf2da',
  });

  // 2F Open L-Shaped Terrace Deck + Continuous Mitered U-Parapet Curb (zero butt-overlaps!)
  ctx.addPart(
    grp,
    ctx.applyPlanarUvs(new THREE.BoxGeometry(5.55, 0.06, 3.26), 2.1),
    '#ffffff',
    [-1.55, gfH + 0.06, 2.41],
    [0, 0, 0],
    { map: honeyPineDeckTex, receiveShadow: true },
  );
  ctx.addPart(
    grp,
    ctx.applyPlanarUvs(new THREE.BoxGeometry(3.06, 0.06, 2.06), 2.1),
    '#ffffff',
    [2.80, gfH + 0.06, 3.01],
    [0, 0, 0],
    { map: honeyPineDeckTex, receiveShadow: true },
  );
  const c2Y = gfH + 0.14;
  ctx.addPart(grp, createMiteredUParapetGeo(4.44, 0.82, 4.19, 0.18, 0.14), '#dfd2b8', [0, c2Y, 0]);
  const r2Y = gfH + 0.20;
  buildWroughtIronRailingRun(grp, ctx, -4.35, 0.82, -4.35, 4.10, r2Y, 0.78);
  buildWroughtIronRailingRun(grp, ctx, -4.35, 4.10, 4.35, 4.10, r2Y, 0.78);
  buildWroughtIronRailingRun(grp, ctx, 4.35, 4.10, 4.35, 1.98, r2Y, 0.78);

  // 2F Wing Upper Terrace Deck & Railing
  ctx.addPart(
    grp,
    ctx.applyPlanarUvs(new THREE.BoxGeometry(wingW - 0.16, 0.05, wingD - 0.16), 2.0),
    '#ffffff',
    [wingCX, wingTopY + 0.025, wingCZ],
    [0, 0, 0],
    { map: honeyPineDeckTex, receiveShadow: true },
  );
  buildWroughtIronRailingRun(grp, ctx, wingMinX + 0.05, wingMaxZ - 0.04, wingMaxX - 0.05, wingMaxZ - 0.04, wingTopY + 0.04, 0.78);
  buildWroughtIronRailingRun(grp, ctx, wingMaxX - 0.04, wingMaxZ - 0.04, wingMaxX - 0.04, wingMinZ + 0.05, wingTopY + 0.04, 0.78);
  buildWroughtIronRailingRun(grp, ctx, wingMaxX - 0.04, wingMinZ + 0.05, wingMinX + 0.05, wingMinZ + 0.05, wingTopY + 0.04, 0.78);

  // 2F Terrace Planters, Topiaries & Songbirds
  buildRooftopGardenPlanterBox(grp, ctx, bt.x, bt.z, bt.yaw, -2.55, gfH + 0.09, 3.60, 2.25, 0.50, 0, honeyOakTex);
  buildRooftopGardenPlanterBox(grp, ctx, bt.x, bt.z, bt.yaw, 2.55, gfH + 0.09, 3.60, 2.25, 0.50, 0, honeyOakTex);
  buildUrnBoxwoodPlanter(grp, ctx, [-3.95, gfH + 0.09, 3.62], 0.88, 'sphere');
  buildUrnBoxwoodPlanter(grp, ctx, [3.95, gfH + 0.09, 3.62], 0.88, 'cone');
  buildUrnBoxwoodPlanter(grp, ctx, [3.95, gfH + 0.09, 2.40], 0.84, 'sphere');
  buildUrnBoxwoodPlanter(grp, ctx, [wingMaxX - 0.52, wingTopY + 0.05, wingMaxZ - 0.52], 0.82, 'sphere');
  buildUrnBoxwoodPlanter(grp, ctx, [wingMinX + 0.52, wingTopY + 0.05, wingMinZ + 0.52], 0.82, 'cone');
  buildPerchedSongbird(grp, ctx, [-1.85, r2Y + 0.80, 4.10], 0.35);
  buildPerchedSongbird(grp, ctx, [3.35, wingTopY + 0.84, wingMaxZ - 0.04], -0.4);

  // 3F Crown Rooftop Garden (`y = 11.53m`) + Continuous 45°-Mitered Perimeter Coping Ring
  const r3Y = towerTopY + 0.04;
  ctx.addPart(
    grp,
    ctx.applyPlanarUvs(new THREE.BoxGeometry(towerW - 0.16, 0.06, towerD - 0.16), 2.1),
    '#ffffff',
    [towerCX, towerTopY + 0.04, towerCZ],
    [0, 0, 0],
    { map: honeyPineDeckTex, receiveShadow: true },
  );
  ctx.addPart(
    grp,
    createMiteredPerimeterCurbGeo(towerW + 0.22, towerD + 0.22, 0.18, 0.14),
    '#dfd2b8',
    [towerCX, r3Y + 0.05, towerCZ],
  );

  const rail3Base = r3Y + 0.10;
  buildWroughtIronRailingRun(grp, ctx, towerMinX + 0.04, towerMaxZ - 0.04, towerMaxX - 0.04, towerMaxZ - 0.04, rail3Base, 0.68);
  buildWroughtIronRailingRun(grp, ctx, towerMaxX - 0.04, towerMaxZ - 0.04, towerMaxX - 0.04, towerMinZ + 0.04, rail3Base, 0.68);
  buildWroughtIronRailingRun(grp, ctx, towerMaxX - 0.04, towerMinZ + 0.04, towerMinX + 0.04, towerMinZ + 0.04, rail3Base, 0.68);
  buildWroughtIronRailingRun(grp, ctx, towerMinX + 0.04, towerMinZ + 0.04, towerMinX + 0.04, towerMaxZ - 0.04, rail3Base, 0.68);

  // 3F Rooftop Garden Timber Planters, Terracotta Topiary Urns & Perched Songbirds (ZERO STRAWBERRIES!)
  buildRooftopGardenPlanterBox(grp, ctx, bt.x, bt.z, bt.yaw, towerCX, r3Y + 0.03, towerMaxZ - 0.56, 2.85, 0.48, 0, honeyOakTex);
  buildRooftopGardenPlanterBox(grp, ctx, bt.x, bt.z, bt.yaw, towerCX, r3Y + 0.03, towerMinZ + 0.56, 2.85, 0.48, Math.PI, honeyOakTex);
  buildRooftopGardenPlanterBox(grp, ctx, bt.x, bt.z, bt.yaw, towerMinX + 0.56, r3Y + 0.03, towerCZ, 2.15, 0.46, Math.PI * 0.5, honeyOakTex);
  buildUrnBoxwoodPlanter(grp, ctx, [towerMinX + 0.52, r3Y + 0.03, towerMaxZ - 0.52], 0.94, 'sphere');
  buildUrnBoxwoodPlanter(grp, ctx, [towerMaxX - 0.52, r3Y + 0.03, towerMaxZ - 0.52], 0.94, 'cone');
  buildUrnBoxwoodPlanter(grp, ctx, [towerMinX + 0.52, r3Y + 0.03, towerMinZ + 0.52], 0.94, 'sphere');
  buildUrnBoxwoodPlanter(grp, ctx, [towerMaxX - 0.52, r3Y + 0.03, towerMinZ + 0.52], 0.94, 'sphere');

  buildPerchedSongbird(grp, ctx, [towerCX - 0.85, rail3Base + 0.70, towerMaxZ - 0.04], 0.25);
  buildPerchedSongbird(grp, ctx, [towerMaxX - 0.04, rail3Base + 0.70, towerCZ + 0.45], -1.25);
  buildPerchedSongbird(grp, ctx, [towerMinX + 0.04, rail3Base + 0.70, towerCZ - 0.55], 1.15);
}

// ============================================================================
// 2. COZY BITES & SIPS CAFE PAVILION (`buildCozyBitesCafePavilion3D`)
// ============================================================================

function buildCafeWallSconce(
  parent: THREE.Object3D,
  ctx: UrbanPlazaBuildingsContext,
  pos: [number, number, number],
  rotY: number,
): void {
  const grp = new THREE.Group();
  grp.position.set(pos[0], pos[1], pos[2]);
  grp.rotation.y = rotY;
  parent.add(grp);

  ctx.addPart(grp, new THREE.CylinderGeometry(0.08, 0.08, 0.04, 8), '#584e42', [0, 0, 0.02], [Math.PI * 0.5, 0, 0]);
  ctx.addPart(grp, new THREE.BoxGeometry(0.04, 0.04, 0.16), '#584e42', [0, 0, 0.10]);
  ctx.addPart(grp, new THREE.CylinderGeometry(0.075, 0.05, 0.18, 6), '#ffe49e', [0, 0.10, 0.18]);
  ctx.addPart(grp, new THREE.ConeGeometry(0.11, 0.09, 6), '#4a433b', [0, 0.22, 0.18]);
}

function buildBistroTableWithChairs(
  parent: THREE.Object3D,
  ctx: UrbanPlazaBuildingsContext,
  pos: [number, number, number],
  chairYawOffset: number,
  timberTex: THREE.Texture,
): void {
  const grp = new THREE.Group();
  grp.position.set(pos[0], pos[1], pos[2]);
  // Scale to 1.68x (~0.77m seat, ~1.31m tabletop) matching Glasshouse Cafe outdoor set & 3.30m avatars
  grp.scale.setScalar(1.68);
  parent.add(grp);

  // Weighted cast-iron base, fluted column & marble-cream bistro top with brass rim
  ctx.addPart(grp, new THREE.CylinderGeometry(0.24, 0.28, 0.04, 12), '#3e444c', [0, 0.02, 0]);
  ctx.addPart(grp, new THREE.CylinderGeometry(0.04, 0.055, 0.72, 8), '#434a53', [0, 0.38, 0], [0, 0, 0], {
    castShadow: true,
  });
  ctx.addPart(grp, new THREE.CylinderGeometry(0.43, 0.43, 0.036, 16), '#d2ab5b', [0, 0.755, 0]);
  ctx.addPart(grp, new THREE.CylinderGeometry(0.41, 0.41, 0.042, 16), '#f5eee2', [0, 0.762, 0], [0, 0, 0], {
    castShadow: true,
  });

  // Tabletop porcelain coffee cup & pastry saucer
  ctx.addPart(grp, new THREE.CylinderGeometry(0.08, 0.06, 0.016, 10), '#ffffff', [-0.11, 0.79, 0.08]);
  ctx.addPart(grp, new THREE.CylinderGeometry(0.044, 0.035, 0.065, 8), '#faf8f2', [-0.11, 0.825, 0.08]);
  ctx.addPart(grp, new THREE.CylinderGeometry(0.095, 0.075, 0.016, 10), '#ffffff', [0.12, 0.79, -0.06]);
  ctx.addPart(grp, new THREE.SphereGeometry(0.045, 7, 5), '#d49a56', [0.12, 0.815, -0.06]);

  // 2 Bentwood Cafe Chairs facing the table
  for (const side of [-1, 1] as const) {
    const chGrp = new THREE.Group();
    const dist = 0.54;
    const ang = chairYawOffset + (side > 0 ? 0 : Math.PI);
    chGrp.position.set(Math.sin(ang) * dist, 0, Math.cos(ang) * dist);
    chGrp.rotation.y = ang + Math.PI;
    grp.add(chGrp);

    // 4 slim splayed bentwood legs
    for (const [lx, lz] of [
      [-0.14, -0.14],
      [0.14, -0.14],
      [-0.14, 0.14],
      [0.14, 0.14],
    ] as const) {
      ctx.addPart(chGrp, new THREE.CylinderGeometry(0.017, 0.014, 0.45, 5), '#9b683e', [lx, 0.225, lz]);
    }
    // Round wooden/rattan seat pad
    const seatGeo = ctx.applyPlanarUvs(new THREE.CylinderGeometry(0.19, 0.19, 0.035, 12), 0.8);
    ctx.addPart(chGrp, seatGeo, '#ffffff', [0, 0.46, 0], [0, 0, 0], { map: timberTex, castShadow: true });
    // Arched bentwood loop backrest
    const hoopGeo = new THREE.TorusGeometry(0.17, 0.018, 6, 14, Math.PI);
    ctx.addPart(chGrp, hoopGeo, '#9b683e', [0, 0.68, -0.15], [-0.14, 0, 0]);
    for (const bx of [-0.15, 0, 0.15]) {
      ctx.addPart(chGrp, new THREE.CylinderGeometry(0.013, 0.013, 0.28, 5), '#9b683e', [bx, 0.59, -0.14], [-0.14, 0, 0]);
    }
  }
}

export function buildCozyBitesCafePavilion3D(ctx: UrbanPlazaBuildingsContext): void {
  const cf = CENTRAL_PARK_MASTERPLAN.cozyCafePavilion;
  const grp = new THREE.Group();
  grp.name = 'UrbanPlazaCozyBitesCafe3D';
  grp.position.set(cf.x, 0, cf.z);
  grp.rotation.y = cf.yaw; // -PI/2 -> +Z_local faces West (-X toward Fountain); +X_local faces South (+Z toward bistroTables sn/ss)
  ctx.staticGroup.add(grp);

  // Unbaked mirror group in animatedGroup so cafe storefront & skylight glass keep cityWindowSpec
  const cafeGlassHost = new THREE.Group();
  cafeGlassHost.name = 'UrbanPlazaCozyBitesCafeGlassHost';
  cafeGlassHost.position.set(cf.x, 0, cf.z);
  cafeGlassHost.rotation.y = cf.yaw;
  ctx.animatedGroup.add(cafeGlassHost);

  const stuccoTex = createCreamStuccoTexture(ctx);
  const honeyOakTex = createHoneyOakTimberTexture(ctx);
  const cafeAwningTex = createStripedAwningTexture(ctx, '#efe5d2', '#b89f82');
  const cafeGlowTex = createWarmWindowGlowTexture(ctx, 'cafe');
  const cafeBackdropTex = createDisplayAlcoveBackdropTexture(ctx, 'cafe');
  const cafeClearGlassTex = createClearStorefrontGlassTexture(ctx);
  const cafeClearGlassMat = createClearStorefrontGlassMaterial(ctx, cafeClearGlassTex);
  const signTex = createCozyBitesSignTexture(ctx);
  const menuTex = createCafeChalkboardMenuTexture(ctx);

  // Synced cleanly with cozyCafePavilion (`halfX: 3.6, halfZ: 4.1, totalHeight: 7.25`) for 3.30m avatars
  const W = 8.2; // local X span [-4.1 .. +4.1] -> World Z [-4.7 .. +3.5]
  const D = 7.2; // local Z span [-3.6 .. +3.6] -> World X [41.6 .. 48.8]
  const halfW = W * 0.5; // 4.1
  const halfD = D * 0.5; // 3.6
  const wallTopY = 5.28;

  // Grounded sandstone plinth base (`y = 0 .. 0.40m`)
  ctx.addPart(
    grp,
    ctx.applyPlanarUvs(createBeveledBox(W + 0.18, 0.40, D + 0.18, 0.016), 1.8),
    '#ffffff',
    [0, 0.20, 0],
    [0, 0, 0],
    { map: ctx.textures.stoneTex, receiveShadow: true },
  );

  // Main Pavilion Cream Sandstone Body (inset 0.36m so pastry showcase displays & interior counters sit recessed cleanly inside!)
  ctx.addPart(
    grp,
    ctx.applyPlanarUvs(new THREE.BoxGeometry(W - 0.72, wallTopY - 0.40, D - 0.72), 2.2),
    '#ffffff',
    [0, 0.40 + (wallTopY - 0.40) * 0.5, 0],
    [0, 0, 0],
    { map: stuccoTex, castShadow: true, receiveShadow: true },
  );

  // Lower classical dado knee wall belt (`y = 0.40 .. 0.96m`)
  ctx.addPart(
    grp,
    ctx.applyPlanarUvs(createBeveledBox(W, 0.56, D, 0.014), 2.0),
    '#ffffff',
    [0, 0.68, 0],
    [0, 0, 0],
    { map: ctx.textures.stoneTex, castShadow: true },
  );

  // Solid corner masonry piers + middle pilaster returns bridging core walls (`±3.74, ±3.24`) cleanly into pilasters
  const bodyH = wallTopY - 0.40;
  const bodyY = 0.40 + bodyH * 0.5;
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      const cornerPier = ctx.addPart(
        grp,
        ctx.applyPlanarUvs(new THREE.BoxGeometry(0.38, bodyH, 0.38), 2.2),
        '#ffffff',
        [sx * (halfW - 0.21), bodyY, sz * (halfD - 0.21)],
        [0, 0, 0],
        { map: stuccoTex, castShadow: true, receiveShadow: true },
      );
      cornerPier.name = `CozyBitesCornerPier_${sx > 0 ? 'S' : 'N'}_${sz > 0 ? 'W' : 'E'}`;
    }
    const sideCenterReturn = ctx.addPart(
      grp,
      ctx.applyPlanarUvs(new THREE.BoxGeometry(0.28, bodyH, 0.32), 2.2),
      '#ffffff',
      [sx * (halfW - 0.26), bodyY, 0],
      [0, 0, 0],
      { map: stuccoTex, castShadow: true, receiveShadow: true },
    );
    sideCenterReturn.name = `CozyBitesPilasterReturn_${sx > 0 ? 'South' : 'North'}`;
  }
  const rearCenterReturn = ctx.addPart(
    grp,
    ctx.applyPlanarUvs(new THREE.BoxGeometry(0.32, bodyH, 0.28), 2.2),
    '#ffffff',
    [0, bodyY, -(halfD - 0.26)],
    [0, 0, 0],
    { map: stuccoTex, castShadow: true, receiveShadow: true },
  );
  rearCenterReturn.name = 'CozyBitesPilasterReturn_Rear';

  // West Front flush stucco piers, door backing & upper header sealing showcase bay & entry door cleanly (`z = 3.20 .. 3.60`)
  const westFrontCenterPier = ctx.addPart(
    grp,
    ctx.applyPlanarUvs(new THREE.BoxGeometry(0.57, bodyH, 0.40), 2.2),
    '#ffffff',
    [-0.235, bodyY, halfD - 0.20],
    [0, 0, 0],
    { map: stuccoTex, castShadow: true, receiveShadow: true },
  );
  westFrontCenterPier.name = 'CozyBitesWestCenterPier';
  const westFrontRightWall = ctx.addPart(
    grp,
    ctx.applyPlanarUvs(new THREE.BoxGeometry(2.21, bodyH, 0.40), 2.2),
    '#ffffff',
    [2.755, bodyY, halfD - 0.20],
    [0, 0, 0],
    { map: stuccoTex, castShadow: true, receiveShadow: true },
  );
  westFrontRightWall.name = 'CozyBitesWestRightWall';
  const westFrontDoorBack = ctx.addPart(
    grp,
    ctx.applyPlanarUvs(new THREE.BoxGeometry(1.70, 3.76, 0.24), 2.2),
    '#ffffff',
    [0.85, 2.28, halfD - 0.28],
    [0, 0, 0],
    { map: stuccoTex, castShadow: true, receiveShadow: true },
  );
  westFrontDoorBack.name = 'CozyBitesWestDoorBacking';
  const westFrontUpperHeader = ctx.addPart(
    grp,
    ctx.applyPlanarUvs(new THREE.BoxGeometry(7.72, 1.12, 0.40), 2.2),
    '#ffffff',
    [0, 4.72, halfD - 0.20],
    [0, 0, 0],
    { map: stuccoTex, castShadow: true, receiveShadow: true },
  );
  westFrontUpperHeader.name = 'CozyBitesWestUpperHeader';

  // Classical Corner & Bay Pilasters
  const pilH = wallTopY - 0.40;
  const pilY = 0.40 + pilH * 0.5;
  for (const px of [-halfW + 0.12, 0.0, halfW - 0.12]) {
    for (const pz of [-halfD + 0.06, halfD - 0.06]) {
      if (px === 0.0 && pz > 0) continue; // Keep West front center clean for entry/pastry split
      ctx.addPart(grp, createBeveledBox(0.36, pilH, 0.22, 0.012), '#e5d6ba', [px, pilY, pz], [0, 0, 0], {
        castShadow: true,
      });
      ctx.addPart(grp, createBeveledBox(0.42, 0.16, 0.26, 0.012), '#d9c9aa', [px, wallTopY - 0.08, pz]);
    }
  }
  for (const pz of [-halfD + 0.12, 0.0, halfD - 0.12]) {
    for (const px of [-halfW + 0.06, halfW - 0.06]) {
      ctx.addPart(grp, createBeveledBox(0.22, pilH, 0.36, 0.012), '#e5d6ba', [px, pilY, pz], [0, 0, 0], {
        castShadow: true,
      });
      ctx.addPart(grp, createBeveledBox(0.26, 0.16, 0.42, 0.012), '#d9c9aa', [px, wallTopY - 0.08, pz]);
    }
  }

  // Stepped Classical Frieze, Cornice & Flat Limestone Roof (`y = 5.28 .. 7.25m`)
  ctx.addPart(grp, createBeveledBox(W + 0.26, 0.24, D + 0.26, 0.016), '#dfd0b4', [0, 5.40, 0]);
  ctx.addPart(grp, createBeveledBox(W + 0.18, 0.96, D + 0.18, 0.018), '#ebe0cb', [0, 6.00, 0], [0, 0, 0], {
    castShadow: true,
  });
  ctx.addPart(grp, createBeveledBox(W + 0.44, 0.24, D + 0.44, 0.018), '#e2d4b8', [0, 6.60, 0], [0, 0, 0], {
    castShadow: true,
  });
  // Recessed flat limestone roof (`#d7c8ab`) + continuous 45°-mitered perimeter parapet (`y = 6.72 .. 7.25m`)
  ctx.addPart(grp, new THREE.BoxGeometry(W + 0.16, 0.14, D + 0.16), '#d7c8ab', [0, 6.79, 0], [0, 0, 0], {
    receiveShadow: true,
  });
  ctx.addPart(grp, createMiteredPerimeterCurbGeo(W + 0.44, D + 0.44, 0.26, 0.44), '#dfd2b8', [0, 7.03, 0]);
  // Rooftop skylight & HVAC architectural vent trim
  ctx.addPart(grp, createBeveledBox(2.35, 0.20, 1.75, 0.014), '#cec0a4', [-0.7, 6.95, 0]);
  const cafeSkylightMesh = ctx.addPart(
    cafeGlassHost,
    createBeveledBox(2.10, 0.18, 1.50, 0.012),
    '#a8cce0',
    [-0.7, 7.10, 0],
  );
  tagCityWindowMesh(
    cafeSkylightMesh,
    createCityWindowSpec('cozy-cafe-roof-skylight', 'dormer', '#a8cce0', 2, 0),
  );
  ctx.addPart(grp, createBeveledBox(1.15, 0.28, 0.95, 0.014), '#b8ac95', [1.95, 6.99, -0.45]);
  ctx.addPart(grp, createBeveledBox(1.26, 0.07, 1.06, 0.010), '#8f836f', [1.95, 7.14, -0.45]);

  // High-Res "COZY BITES & SIPS" Signboard Plaques seated inside continuous mitered frames (`y = 6.00m`)
  ctx.addPart(grp, new THREE.PlaneGeometry(5.6, 0.72), '#ffffff', [0, 6.00, halfD + 0.12], [0, 0, 0], {
    map: signTex,
  });
  ctx.addPart(grp, createMiteredSignFrameGeo(5.6, 0.72, 0.11, 0.08), '#d8cbb2', [0, 6.00, halfD + 0.11]);
  ctx.addPart(
    grp,
    new THREE.PlaneGeometry(5.4, 0.72),
    '#ffffff',
    [halfW + 0.12, 6.00, 0],
    [0, Math.PI * 0.5, 0],
    { map: signTex },
  );
  ctx.addPart(grp, createMiteredSignFrameGeo(5.4, 0.72, 0.11, 0.08), '#d8cbb2', [halfW + 0.11, 6.00, 0], [0, Math.PI * 0.5, 0]);
  ctx.addPart(
    grp,
    new THREE.PlaneGeometry(5.4, 0.72),
    '#ffffff',
    [-halfW - 0.12, 6.00, 0],
    [0, -Math.PI * 0.5, 0],
    { map: signTex },
  );
  ctx.addPart(grp, createMiteredSignFrameGeo(5.4, 0.72, 0.11, 0.08), '#d8cbb2', [-halfW - 0.11, 6.00, 0], [0, -Math.PI * 0.5, 0]);

  // West Front Entrance (`+Z_local`, facing Fountain): Tall 4.02m Clear Timber-Framed Glazed Entry Door
  ctx.addPart(grp, createBeveledBox(1.90, 0.08, 0.48, 0.014), '#d8cbb2', [0.85, 0.04, halfD + 0.14]);
  ctx.addPart(grp, createBeveledBox(1.68, 4.08, 0.24, 0.016), '#a57144', [0.85, 2.12, halfD - 0.10]);
  const cafeDoorGlass = ctx.addPart(
    cafeGlassHost,
    new THREE.BoxGeometry(1.32, 3.30, 0.028),
    '#ffffff',
    [0.85, 2.16, halfD + 0.03],
    [0, 0, 0],
    { map: cafeGlowTex },
  );
  tagCityWindowMesh(cafeDoorGlass, {
    ...createCityWindowSpec('cozy-cafe-1f-entry-door', 'civic', '#e8f4fc', 1, 0),
    intensityScale: 0.65,
  });
  ctx.addPart(grp, createBeveledBox(1.36, 0.075, 0.055, 0.008), '#7c512f', [0.85, 3.10, halfD + 0.055]);
  ctx.addPart(grp, createBeveledBox(1.36, 0.24, 0.055, 0.008), '#8a5934', [0.85, 0.62, halfD + 0.055]);
  buildTubularDoorPull(grp, ctx, [0.36, 1.66, halfD + 0.055], 0.52, '#d4a644', 0.08);

  // Showcase Window Helper with Interior Bakery Counter & Pastry Stand Silhouettes seated inside tall recessed bay
  let cafeBayIdx = 0;
  const addCafeShowcaseBay = (pos: [number, number, number], rotY: number, bayW: number) => {
    const bayIdx = cafeBayIdx;
    cafeBayIdx += 1;

    const bGrp = new THREE.Group();
    bGrp.name = `CozyBitesShowcaseBay_${bayIdx}`;
    bGrp.position.set(pos[0], pos[1], pos[2]);
    bGrp.rotation.y = rotY;
    grp.add(bGrp);

    const glassBayGrp = new THREE.Group();
    glassBayGrp.name = `CozyBitesShowcaseGlassBay_${bayIdx}`;
    glassBayGrp.position.set(pos[0], pos[1], pos[2]);
    glassBayGrp.rotation.y = rotY;
    cafeGlassHost.add(glassBayGrp);

    // `bayW` includes +0.04m embed into flanking pilasters/piers at each side; `clearW` is the exact clear span
    const clearW = bayW - 0.08;

    // Sill (`y = 0.96`) and lintel (`y = 4.14`) seal full depth (`local z = -0.04 .. +0.38`) from core wall to outer pilaster plane
    const sillMesh = ctx.addPart(bGrp, createBeveledBox(bayW + 0.02, 0.12, 0.42, 0.012), '#ddd0b6', [0, 0.96, 0.17]);
    sillMesh.name = 'CozyBitesShowcaseSill';

    // Warm interior bakery showcase wall backdrop flush against core (`z = -0.030 .. +0.014`)
    const backdropMesh = ctx.addPart(
      bGrp,
      new THREE.BoxGeometry(clearW - 0.04, 3.04, 0.044),
      '#ffffff',
      [0, 2.55, -0.008],
      [0, 0, 0],
      { map: cafeBackdropTex, bounce: 2.72 },
    );
    backdropMesh.name = 'CozyBitesShowcaseBackdrop';
    // Recessed warm tungsten LED cove bar mounted under showcase lintel soffit
    const cafeLedMesh = ctx.addPart(
      bGrp,
      new THREE.BoxGeometry(clearW - 0.24, 0.045, 0.08),
      '#fff1cc',
      [0, 4.04, 0.16],
      [0, 0, 0],
      { bounce: 2.95 },
    );
    cafeLedMesh.name = 'CozyBitesShowcaseLedCove';

    // Interior pastry counter & tiered cake stands seated inside recess (`z in [0.035 .. 0.265]`, strictly behind front glass `0.302..0.326`)
    const displayGrp = new THREE.Group();
    displayGrp.name = 'CozyBitesShowcaseDisplay';
    bGrp.add(displayGrp);
    ctx.addPart(displayGrp, createBeveledBox(bayW * 0.88, 0.54, 0.14, 0.010), '#96653f', [0, 1.28, 0.14], [0, 0, 0], {
      bounce: 2.66,
    });
    for (const sx of [-bayW * 0.24, 0, bayW * 0.24]) {
      ctx.addPart(displayGrp, new THREE.CylinderGeometry(0.115, 0.080, 0.10, 10), '#fff5e4', [sx, 1.60, 0.15], [0, 0, 0], {
        bounce: 2.66,
      });
      ctx.addPart(displayGrp, new THREE.SphereGeometry(0.082, 8, 6), '#e49f6e', [sx, 1.71, 0.15], [0, 0, 0], {
        bounce: 2.66,
      });
    }

    // Clear reflective 3D storefront showcase glass mounted AT front mullion plane (`z = 0.314`, behind outer rails/mullions `0.310..0.380`)
    const showcaseGlassGeo = new THREE.BoxGeometry(bayW, 3.04, 0.024);
    ctx.registerGeo(showcaseGlassGeo);
    const showcaseGlass = new THREE.Mesh(showcaseGlassGeo, cafeClearGlassMat);
    showcaseGlass.name = `CozyBitesShowcaseGlass_${bayIdx}`;
    showcaseGlass.position.set(0, 2.55, 0.314);
    showcaseGlass.castShadow = false;
    showcaseGlass.receiveShadow = false;
    showcaseGlass.renderOrder = 2;
    glassBayGrp.add(showcaseGlass);
    tagCityWindowMesh(
      showcaseGlass,
      createCityWindowSpec(`cozy-cafe-1f-bay-${bayIdx}`, 'storefront', '#d6f4ff', 1, bayIdx + 1),
    );

    // Full-depth side jamb returns (`local z = -0.045 .. +0.385`, embedded +5cm into flanking pilasters/piers)
    for (const jx of [-clearW * 0.5, clearW * 0.5]) {
      const jambMesh = ctx.addPart(bGrp, new THREE.BoxGeometry(0.10, 3.16, 0.43), '#6b482c', [jx, 2.55, 0.17]);
      jambMesh.name = 'CozyBitesShowcaseJamb';
    }
    const topRail = ctx.addPart(bGrp, new THREE.BoxGeometry(bayW, 0.08, 0.07), '#6b482c', [0, 4.04, 0.345]);
    topRail.name = 'CozyBitesShowcaseTopRail';
    const bottomRail = ctx.addPart(bGrp, new THREE.BoxGeometry(bayW, 0.07, 0.07), '#6b482c', [0, 1.04, 0.345]);
    bottomRail.name = 'CozyBitesShowcaseBottomRail';
    ctx.addPart(bGrp, new THREE.BoxGeometry(0.055, 3.04, 0.055), '#6b482c', [0, 2.54, 0.345]);
    const transomMesh = ctx.addPart(bGrp, new THREE.BoxGeometry(bayW, 0.055, 0.055), '#6b482c', [0, 3.16, 0.345]);
    transomMesh.name = 'CozyBitesShowcaseTransom';
    const lintelMesh = ctx.addPart(bGrp, createBeveledBox(bayW + 0.02, 0.12, 0.42, 0.012), '#ddd0b6', [0, 4.14, 0.17]);
    lintelMesh.name = 'CozyBitesShowcaseLintel';
  };

  // West Front Wide Pastry Showcase Window (clear 3.28m between -3.80 corner pilaster & -0.52 center pier; bayW 3.36m)
  addCafeShowcaseBay([-2.16, 0, halfD - 0.33], 0, 3.36);
  buildSlopedStripedAwning(grp, ctx, {
    width: 3.36,
    depth: 0.86,
    dropH: 0.42,
    pos: [-2.16, 4.74, halfD],
    rotY: 0,
    stripeTex: cafeAwningTex,
    colorA: '#efe5d2',
    colorB: '#b89f82',
  });

  // South Side (facing South Bistro Patio): 2 Pastry Showcase Bays (clear 3.12m between ±0.18 & ±3.30 pilasters; bayW 3.20m)
  addCafeShowcaseBay([halfW - 0.33, 0, -1.74], Math.PI * 0.5, 3.20);
  addCafeShowcaseBay([halfW - 0.33, 0, 1.74], Math.PI * 0.5, 3.20);
  buildSlopedStripedAwning(grp, ctx, {
    width: 3.12,
    depth: 0.84,
    dropH: 0.42,
    pos: [halfW + 0.02, 4.74, -1.74],
    rotY: Math.PI * 0.5,
    stripeTex: cafeAwningTex,
    colorA: '#efe5d2',
    colorB: '#b89f82',
  });
  buildSlopedStripedAwning(grp, ctx, {
    width: 3.12,
    depth: 0.84,
    dropH: 0.42,
    pos: [halfW + 0.02, 4.74, 1.74],
    rotY: Math.PI * 0.5,
    stripeTex: cafeAwningTex,
    colorA: '#efe5d2',
    colorB: '#b89f82',
  });

  // North Side & East Rear Windows + Awning
  addCafeShowcaseBay([-halfW + 0.33, 0, -1.74], -Math.PI * 0.5, 3.20);
  addCafeShowcaseBay([-halfW + 0.33, 0, 1.74], -Math.PI * 0.5, 3.20);
  buildSlopedStripedAwning(grp, ctx, {
    width: 3.12,
    depth: 0.80,
    dropH: 0.42,
    pos: [-halfW - 0.02, 4.74, 1.74],
    rotY: -Math.PI * 0.5,
    stripeTex: cafeAwningTex,
    colorA: '#efe5d2',
    colorB: '#b89f82',
  });
  // East Rear (clear 3.62m between ±0.18 center pilaster & ±3.80 corner pilasters; bayW 3.70m)
  addCafeShowcaseBay([-1.99, 0, -halfD + 0.33], Math.PI, 3.70);
  addCafeShowcaseBay([1.99, 0, -halfD + 0.33], Math.PI, 3.70);

  // Wall-Mounted Chalkboard Menu Plaque seated cleanly in mitered wooden frame (right of West door) + Sconces
  ctx.addPart(grp, new THREE.PlaneGeometry(0.96, 1.24), '#ffffff', [2.55, 2.42, halfD + 0.035], [0, 0, 0], {
    map: menuTex,
  });
  ctx.addPart(grp, createMiteredSignFrameGeo(0.96, 1.24, 0.08, 0.06), '#785233', [2.55, 2.42, halfD + 0.025]);
  buildCafeWallSconce(grp, ctx, [-0.22, 2.82, halfD], 0);
  buildCafeWallSconce(grp, ctx, [1.82, 2.82, halfD], 0);
  buildCafeWallSconce(grp, ctx, [halfW + 0.02, 2.82, 0], Math.PI * 0.5);

  // Freestanding Sidewalk A-Frame Chalkboard Menu Sign (1.45x human scale beside West entry)
  const afGrp = new THREE.Group();
  afGrp.position.set(-0.22, 0, halfD + 0.54);
  afGrp.rotation.y = 0.32;
  afGrp.scale.setScalar(1.45);
  grp.add(afGrp);
  ctx.addPart(afGrp, createBeveledBox(0.66, 0.96, 0.05, 0.008), '#8c5f3b', [0, 0.48, 0.14], [-0.22, 0, 0], {
    castShadow: true,
  });
  ctx.addPart(afGrp, createBeveledBox(0.66, 0.96, 0.05, 0.008), '#8c5f3b', [0, 0.48, -0.14], [0.22, 0, 0], {
    castShadow: true,
  });
  ctx.addPart(afGrp, new THREE.PlaneGeometry(0.56, 0.78), '#ffffff', [0, 0.52, 0.17], [-0.22, 0, 0], {
    map: menuTex,
  });

  // Corner Boxwood Planters flanking Cafe corners
  buildUrnBoxwoodPlanter(grp, ctx, [-3.82, 0, halfD + 0.36], 0.94, 'sphere');
  buildUrnBoxwoodPlanter(grp, ctx, [3.82, 0, halfD + 0.36], 0.94, 'sphere');
  buildUrnBoxwoodPlanter(grp, ctx, [halfW + 0.36, 0, -3.55], 0.94, 'sphere');
  buildUrnBoxwoodPlanter(grp, ctx, [halfW + 0.36, 0, 3.55], 0.94, 'cone');

  // 4 Complete Outdoor Bistro Table + 2 Bentwood Chair Sets at exact Masterplan coordinates
  for (const tbl of CENTRAL_PARK_MASTERPLAN.bistroTables) {
    // Orient West front patio tables' chairs North-South (`0`), South patio tables' chairs East-West (`Math.PI / 2`)
    const isWestPatio = tbl.x < cf.x - 2.0;
    const chairYaw = isWestPatio ? 0.18 : Math.PI * 0.5;
    buildBistroTableWithChairs(ctx.staticGroup, ctx, [tbl.x, 0, tbl.z], chairYaw, honeyOakTex);
  }
}

// ============================================================================
// 3. TIMBER PERGOLA & WATER LILY POND (`buildTimberPergolaAndLilyPond3D`)
// ============================================================================

export function buildTimberPergolaAndLilyPond3D(ctx: UrbanPlazaBuildingsContext): void {
  const pp = CENTRAL_PARK_MASTERPLAN.pergolaPond;
  const grp = new THREE.Group();
  grp.name = 'UrbanPlazaPergolaLilyPond3D';
  grp.position.set(pp.centerX, 0, pp.centerZ);
  grp.rotation.y = pp.yaw;
  ctx.staticGroup.add(grp);

  const honeyOakTex = createHoneyOakTimberTexture(ctx);
  const innerR = 2.75;
  const outerR = 3.32;
  const waterY = pp.waterY; // 0.24

  // -------------------------------------------------------------------------
  // CIRCULAR WATER LILY POND BASIN, COBBLE BED, LIMESTONE COPING & ANIMATED WATER
  // -------------------------------------------------------------------------
  // Outer cobble apron skirt stepped above 0.042m terrazzo (y = 0.018..0.058m) + basin floor below waterY (0.045..0.095m)
  const apronGeo = ctx.applyPlanarUvs(new THREE.CylinderGeometry(3.64, 3.72, 0.04, 44), 1.8);
  ctx.addPart(grp, apronGeo, '#ffffff', [0, 0.038, 0], [0, 0, 0], {
    map: ctx.textures.cobbleTex,
    receiveShadow: true,
    castShadow: false,
  });

  // Visible sunken cobblestone basin floor (underneath translucent NW-Lake-matched water disc)
  const bedGeo = ctx.applyPlanarUvs(new THREE.CylinderGeometry(innerR + 0.04, innerR + 0.04, 0.05, 44), 1.6);
  ctx.addPart(grp, bedGeo, '#ffffff', [0, 0.070, 0], [0, 0, 0], {
    map: ctx.textures.cobbleTex,
    receiveShadow: true,
    castShadow: false,
  });

  // Lathe carved limestone pond coping wall (stepped base + wide overhanging rim)
  const copingPts = [
    new THREE.Vector2(innerR - 0.02, 0.04),
    new THREE.Vector2(innerR, 0.36),
    new THREE.Vector2(innerR - 0.04, 0.42),
    new THREE.Vector2(innerR + 0.06, 0.45),
    new THREE.Vector2(outerR + 0.06, 0.45),
    new THREE.Vector2(outerR + 0.08, 0.36),
    new THREE.Vector2(outerR, 0.32),
    new THREE.Vector2(outerR, 0.04),
  ];
  const copingGeo = ctx.scaleGeometryUvs(new THREE.LatheGeometry(copingPts, 48), 6.0, 1.0);
  ctx.addPart(grp, copingGeo, '#ffffff', [0, 0, 0], [0, 0, 0], {
    map: ctx.textures.stoneTex,
    castShadow: true,
    receiveShadow: true,
  });

  // NW Oasis Lake-Matched Translucent Optical-Depth Water Disc in ctx.animatedGroup (`isAnimatedWater = true`)
  const waterSpan = (innerR + 0.03) * 2;
  const waterSegs = ctx.isSoftwareGl ? 18 : 28;
  const waterGeo = new THREE.PlaneGeometry(waterSpan, waterSpan, waterSegs, waterSegs);
  waterGeo.rotateX(-Math.PI * 0.5);
  ctx.registerGeo(waterGeo);

  const waterMat = createUnifiedWaterSurfaceMaterial({
    kind: 'pool',
    windUniforms: ctx.windUniforms,
    isSoftwareGl: ctx.isSoftwareGl,
    poolCenterXZ: [pp.centerX, pp.centerZ],
    poolRadiusM: innerR + 0.015,
    poolDepthM: 1.32,
    poolHasSplash: false,
  });
  ctx.registerMat(waterMat);

  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.name = 'UrbanPlazaLilyPondWater';
  waterMesh.position.set(pp.centerX, waterY, pp.centerZ);
  waterMesh.renderOrder = 2;
  waterMesh.userData.isAnimatedWater = true;
  ctx.animatedGroup.add(waterMesh);

  // 12 Notched Circular Green Lily Pads + 5 Cupped Pink/White Lotus Blooms
  const lilyPads: readonly [number, number, number, string, 'pink' | 'white' | 'none'][] = [
    [-1.45, 0.55, 0.38, '#4ba847', 'pink'],
    [-0.95, 0.92, 0.30, '#5bb955', 'none'],
    [-1.68, 0.05, 0.27, '#3f953d', 'none'],
    [1.35, -0.78, 0.41, '#4ba847', 'white'],
    [1.76, -0.35, 0.31, '#5bb955', 'none'],
    [0.92, -1.08, 0.28, '#3f953d', 'none'],
    [-0.78, -1.36, 0.37, '#4ba847', 'pink'],
    [-1.24, -1.04, 0.29, '#5bb955', 'none'],
    [0.58, 1.32, 0.36, '#4ba847', 'pink'],
    [1.04, 1.06, 0.28, '#5bb955', 'none'],
    [1.62, 0.62, 0.34, '#3f953d', 'white'],
    [-0.12, 1.62, 0.26, '#5bb955', 'none'],
  ];

  const lotusPetalShape = new THREE.Shape();
  lotusPetalShape.moveTo(0, 0);
  lotusPetalShape.quadraticCurveTo(0.055, 0.06, 0.032, 0.13);
  lotusPetalShape.lineTo(0, 0.16);
  lotusPetalShape.lineTo(-0.032, 0.13);
  lotusPetalShape.quadraticCurveTo(-0.055, 0.06, 0, 0);
  const lotusPetalGeo = new THREE.ExtrudeGeometry(lotusPetalShape, {
    depth: 0.012,
    bevelEnabled: false,
    curveSegments: 5,
  });
  lotusPetalGeo.computeVertexNormals();

  for (const [lx, lz, rad, padCol, lotusKind] of lilyPads) {
    const padGeo = new THREE.CylinderGeometry(rad, rad * 0.96, 0.02, 18, 1, false, 0.24, Math.PI * 1.84);
    ctx.addPart(grp, padGeo, padCol, [lx, waterY + 0.022, lz], [0, lx * 2.1 + lz, 0]);
    if (lotusKind !== 'none') {
      const outerCol = lotusKind === 'pink' ? '#f79ec3' : '#fdf7f0';
      const innerCol = lotusKind === 'pink' ? '#ffd5e7' : '#ffffff';
      for (let p = 0; p < 6; p++) {
        const ang = (p / 6) * Math.PI * 2;
        ctx.addPart(
          grp,
          lotusPetalGeo.clone(),
          outerCol,
          [lx + Math.cos(ang) * 0.03, waterY + 0.038, lz + Math.sin(ang) * 0.03],
          [0.98, -ang + Math.PI * 0.5, 0],
        );
      }
      for (let p = 0; p < 5; p++) {
        const ang = (p / 5) * Math.PI * 2 + 0.35;
        ctx.addPart(
          grp,
          lotusPetalGeo.clone(),
          innerCol,
          [lx + Math.cos(ang) * 0.018, waterY + 0.048, lz + Math.sin(ang) * 0.018],
          [0.54, -ang + Math.PI * 0.5, 0],
          { scale: [0.76, 0.85, 0.76] },
        );
      }
      ctx.addPart(grp, new THREE.SphereGeometry(0.038, 7, 5), '#facc15', [lx, waterY + 0.075, lz]);
    }
  }
  lotusPetalGeo.dispose();

  // Shoreline Cattails / Reeds (`ctx.pondReedCollectors`, ground-anchored y = 0)
  const reedAngles = [0.22, 0.36, 1.92, 2.08, 2.24, 3.65, 3.82, 5.25, 5.42, 5.58];
  reedAngles.forEach((ang, idx) => {
    const r = innerR - 0.24 - (idx % 2) * 0.12;
    const rx = Math.cos(ang) * r;
    const rz = -Math.sin(ang) * r;
    const sc = 0.80 + (idx % 3) * 0.12;
    ctx.pondReedCollectors.matrices.push(
      composeWorldCollectorMatrix(pp.centerX, pp.centerZ, pp.yaw, rx, 0.08, rz, ang, [sc, sc, sc]),
    );
    ctx.pondReedCollectors.colors.push(new THREE.Color('#ffffff'));
  });

  // -------------------------------------------------------------------------
  // NATURAL HONEY-OAK TIMBER PERGOLA (`#b9834e`, NEVER DARK/BLACK)
  // -------------------------------------------------------------------------
  const postRadius = 3.16;
  const evalBeamY = (ang: number): number => {
    const t = Math.max(0, Math.min(1, ang / Math.PI));
    return 4.18 + 0.48 * Math.sin(t * Math.PI);
  };

  // 4 Stout Honey-Oak Posts on Carved Stone Plinth Pedestals at horseshoe corners
  const postAngles = [-0.06, 1.06, Math.PI - 1.06, Math.PI + 0.06];
  const kneeShape = new THREE.Shape();
  kneeShape.moveTo(0, 0);
  kneeShape.lineTo(0, 0.92);
  kneeShape.lineTo(0.92, 0.92);
  kneeShape.lineTo(0.92, 0.78);
  kneeShape.quadraticCurveTo(0.32, 0.64, 0.14, 0);
  kneeShape.closePath();
  const baseKneeGeo = new THREE.ExtrudeGeometry(kneeShape, {
    depth: 0.11,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 10,
  });
  baseKneeGeo.translate(0, 0, -0.055);
  baseKneeGeo.computeVertexNormals();
  ctx.applyPlanarUvs(baseKneeGeo, 1.4);

  for (const ang of postAngles) {
    const px = Math.cos(ang) * postRadius;
    const pz = -Math.sin(ang) * postRadius;
    const topY = evalBeamY(ang);
    const rotY = ang;

    // Carved limestone pedestal plinth + molded cap collar
    ctx.addPart(
      grp,
      ctx.applyPlanarUvs(new THREE.BoxGeometry(0.54, 0.60, 0.54), 1.4),
      '#ffffff',
      [px, 0.30, pz],
      [0, rotY, 0],
      { map: ctx.textures.stoneTex, castShadow: true, receiveShadow: true },
    );
    ctx.addPart(
      grp,
      ctx.applyPlanarUvs(new THREE.BoxGeometry(0.62, 0.09, 0.62), 1.4),
      '#ffffff',
      [px, 0.635, pz],
      [0, rotY, 0],
      { map: ctx.textures.stoneTex },
    );

    // Natural honey-oak post shaft & base/capital collars
    const shaftH = topY - 0.68;
    const postGeo = applyGrainUvs(new THREE.BoxGeometry(0.26, shaftH, 0.26), 'y', 1.6);
    ctx.addPart(grp, postGeo, '#ffffff', [px, 0.68 + shaftH * 0.5, pz], [0, rotY, 0], {
      map: honeyOakTex,
      castShadow: true,
    });
    ctx.addPart(grp, new THREE.BoxGeometry(0.32, 0.10, 0.32), '#c48d56', [px, 0.73, pz], [0, rotY, 0]);
    ctx.addPart(grp, new THREE.BoxGeometry(0.32, 0.10, 0.32), '#c48d56', [px, topY - 0.08, pz], [0, rotY, 0]);

    // Radial timber cross-header bridging inner & outer curved arc beams at each post
    const headerGeo = applyGrainUvs(new THREE.BoxGeometry(0.96, 0.22, 0.18), 'x', 1.4);
    ctx.addPart(grp, headerGeo, '#ffffff', [px, topY + 0.02, pz], [0, rotY, 0], {
      map: honeyOakTex,
      castShadow: true,
    });

    // Curved ExtrudeGeometry timber knee braces springing along the horseshoe arc (strictly inside beam span!)
    const tangentYaw = ang + Math.PI * 0.5;
    const kneeDirs: readonly number[] = ang < 0.2 ? [1] : ang > Math.PI - 0.2 ? [-1] : [-1, 1];
    for (const dirSign of kneeDirs) {
      const kGeo = baseKneeGeo.clone();
      ctx.addPart(
        grp,
        kGeo,
        '#ffffff',
        [px, topY - 0.90, pz],
        [0, tangentYaw + (dirSign < 0 ? Math.PI : 0), 0],
        { map: honeyOakTex, castShadow: true },
      );
    }

    // Intertwined Twisting Woody Climbing Wisteria Vines spiraling up each post
    for (const strand of [0, Math.PI]) {
      const vinePts: THREE.Vector3[] = [];
      for (let st = 0; st <= 14; st++) {
        const f = st / 14;
        const spAng = ang + strand + f * Math.PI * 3.2;
        vinePts.push(
          new THREE.Vector3(
            px + Math.cos(spAng) * 0.17,
            0.68 + f * (topY - 0.68),
            pz + Math.sin(spAng) * 0.17,
          ),
        );
      }
      const vineGeo = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(vinePts),
        16,
        strand === 0 ? 0.048 : 0.032,
        6,
        false,
      );
      ctx.addPart(grp, vineGeo, strand === 0 ? '#7c5d43' : '#8b6a4e', [0, 0, 0]);
    }
  }
  baseKneeGeo.dispose();

  // Inner & Outer Concentric Curved Arched Laminated Timber Tie-Beams (`r = 2.84m` & `r = 3.48m`)
  const arcSteps = 28;
  const arcStart = -0.14;
  const arcEnd = Math.PI + 0.14;
  for (const arcR of [2.84, 3.48]) {
    const beamPts: THREE.Vector3[] = [];
    for (let i = 0; i <= arcSteps; i++) {
      const ang = arcStart + (i / arcSteps) * (arcEnd - arcStart);
      beamPts.push(new THREE.Vector3(Math.cos(ang) * arcR, evalBeamY(ang) + 0.02, -Math.sin(ang) * arcR));
    }
    const arcBeamGeo = createSweptRectBeamGeometry(beamPts, 0.13, 0.24, 1.5);
    ctx.addPart(grp, arcBeamGeo, '#ffffff', [0, 0, 0], [0, 0, 0], {
      map: honeyOakTex,
      castShadow: true,
    });
  }

  // 13 Fanned Radial Overhead Rafters (0177d761.jpg Top Plan View!) + Chamfered Tails
  const rafterCount = 13;
  const rafterInnerR = 1.92;
  const rafterOuterR = 4.32;
  const rafterLen = rafterOuterR - rafterInnerR;
  const rafterMidR = (rafterInnerR + rafterOuterR) * 0.5;
  for (let i = 0; i < rafterCount; i++) {
    const ang = -0.08 + (i / (rafterCount - 1)) * (Math.PI + 0.16);
    const ry = evalBeamY(ang) + 0.21;
    const rx = Math.cos(ang) * rafterMidR;
    const rz = -Math.sin(ang) * rafterMidR;

    const rafGeo = applyGrainUvs(new THREE.BoxGeometry(rafterLen, 0.19, 0.105), 'x', 1.5);
    ctx.addPart(grp, rafGeo, '#ffffff', [rx, ry, rz], [0, ang, 0], {
      map: honeyOakTex,
      castShadow: true,
    });

    // Clean chamfered rafter-tail bevel caps on inner & outer ends
    for (const [endR, dirSign] of [
      [rafterInnerR - 0.03, -1],
      [rafterOuterR + 0.03, 1],
    ] as const) {
      ctx.addPart(
        grp,
        new THREE.BoxGeometry(0.12, 0.13, 0.102),
        '#b9834e',
        [Math.cos(ang) * endR, ry + 0.02, -Math.sin(ang) * endR],
        [0, ang, dirSign * -0.22],
      );
    }

    // Hang 3 Climbing Wisteria Racemes beneath each radial rafter/eave (39 racemes)
    const racemePalette = ['#cbb2f3', '#b391ee', '#d8c7fa', '#c09ef2'];
    for (const [rRad, rScale, rOff] of [
      [2.18, 0.96, 0],
      [3.16, 1.08, 1],
      [4.05, 0.88, 2],
    ] as const) {
      if ((i + rOff) % 5 === 4 && rRad === 3.16) continue; // natural organic rhythm
      const wx = Math.cos(ang) * rRad;
      const wz = -Math.sin(ang) * rRad;
      ctx.wisteriaCollectors.matrices.push(
        composeWorldCollectorMatrix(pp.centerX, pp.centerZ, pp.yaw, wx, ry - 0.10, wz, ang + rOff, [
          rScale,
          rScale,
          rScale,
        ]),
      );
      ctx.wisteriaCollectors.colors.push(new THREE.Color(racemePalette[(i + rOff) % racemePalette.length]));
    }
  }

  // 3 Secondary Concentric Curved Timber Purlins resting cleanly atop the 13 fanned rafters
  for (const purlinR of [2.32, 3.16, 4.00]) {
    const pPts: THREE.Vector3[] = [];
    for (let i = 0; i <= arcSteps; i++) {
      const ang = arcStart + (i / arcSteps) * (arcEnd - arcStart);
      pPts.push(new THREE.Vector3(Math.cos(ang) * purlinR, evalBeamY(ang) + 0.34, -Math.sin(ang) * purlinR));
    }
    const purlinGeo = createSweptRectBeamGeometry(pPts, 0.085, 0.085, 1.5);
    ctx.addPart(grp, purlinGeo, '#ffffff', [0, 0, 0], [0, 0, 0], {
      map: honeyOakTex,
      castShadow: true,
    });
  }

  // Overhead Woody Wisteria Vine Runners weaving along the arched beams & lush Wisteria foliage clusters
  for (const [vineR, phase] of [
    [2.76, 0.2],
    [3.54, 1.6],
  ] as const) {
    const topVinePts: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
      const frac = i / 20;
      const ang = arcStart + frac * (arcEnd - arcStart);
      const rJitter = vineR + Math.sin(frac * Math.PI * 6 + phase) * 0.09;
      const yJitter = evalBeamY(ang) + 0.18 + Math.cos(frac * Math.PI * 5 + phase) * 0.12;
      topVinePts.push(new THREE.Vector3(Math.cos(ang) * rJitter, yJitter, -Math.sin(ang) * rJitter));
    }
    const topVineGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(topVinePts), 24, 0.036, 5, false);
    ctx.addPart(grp, topVineGeo, '#7c5d43', [0, 0, 0]);
  }

  // Delicate Climbing Wisteria Pinnate Leaf Clusters along the overhead woody runners & post vines
  // (replaces bulky blobs with organic feathery leaf sprays; main drooping foliage comes from wisteriaCollectors!)
  const leafBladeShape = new THREE.Shape();
  leafBladeShape.moveTo(0, 0);
  leafBladeShape.quadraticCurveTo(0.065, 0.09, 0.024, 0.22);
  leafBladeShape.lineTo(0, 0.27);
  leafBladeShape.lineTo(-0.024, 0.22);
  leafBladeShape.quadraticCurveTo(-0.065, 0.09, 0, 0);
  const leafBladeGeo = new THREE.ExtrudeGeometry(leafBladeShape, {
    depth: 0.008,
    bevelEnabled: false,
    curveSegments: 4,
  });
  leafBladeGeo.computeVertexNormals();

  const foliageCols = ['#5a9e46', '#6eb455', '#4c8c3a', '#7ac062'];
  for (let i = 0; i < 24; i++) {
    const frac = i / 23;
    const ang = arcStart + 0.05 + frac * (arcEnd - arcStart - 0.10);
    const rF = 2.65 + (i % 3) * 0.44;
    const fy = evalBeamY(ang) + 0.30 + (i % 2) * 0.06;
    const fx = Math.cos(ang) * rF;
    const fz = -Math.sin(ang) * rF;
    for (let b = 0; b < 4; b++) {
      const bAng = ang + (b / 4) * Math.PI * 2 + i * 0.4;
      ctx.addPart(
        grp,
        leafBladeGeo.clone(),
        foliageCols[(i + b) % foliageCols.length],
        [fx + Math.cos(bAng) * 0.08, fy, fz + Math.sin(bAng) * 0.08],
        [0.95 + (b % 2) * 0.25, bAng, 0],
      );
    }
  }
  leafBladeGeo.dispose();
}
