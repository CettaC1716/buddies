import * as THREE from 'three';
import { attachClearStorefrontGlassNightShader } from './buddiesNightLightingRules';
import {
  createCityWindowSpec,
  tagCityWindowMesh,
} from './buddiesWindowAuditRules';
import { CENTRAL_PARK_MASTERPLAN } from './buddiesCentralParkRules';
import {
  applyGrainUvs,
  buildArchedCasementWindow,
  buildRooftopGardenPlanterBox,
  buildTubularDoorPull,
  buildUrnBoxwoodPlanter,
  createBeveledBox,
  createCreamStuccoTexture,
  createHoneyOakTimberTexture,
  createMiteredPerimeterCurbGeo,
  createMiteredSignFrameGeo,
  createWarmWindowGlowTexture,
  getOrCreateBuildingCanvasTexture,
  makeBuildingCanvasTexture,
  type UrbanPlazaBuildingsContext,
} from './buddiesUrbanPlazaBuildingsBuilder';

// ============================================================================
// BEAUTY SALON PALETTE & GEOMETRIC CONSTANTS
// ============================================================================

const COL_SALON_BLUSH = '#e0baa8';
const COL_SALON_BLUSH_DARK = '#cca08c';
const COL_SALON_OAK = '#d4a672';
const COL_SALON_BRONZE = '#4f433b';
const COL_SALON_BRASS = '#d8ab4c';
const COL_SALON_AWNING = '#f6eee0';
const COL_SALON_AWNING_TRIM = '#dcc3ae';
const COL_SALON_MARBLE = '#f7f1e8';

const PODIUM_HALF_W = 4.20;
const PODIUM_HALF_D = 3.40;
const CORNER_CURVE_R = 1.65;
const CURVE_CENTER_X = -PODIUM_HALF_W + CORNER_CURVE_R; // -2.55
const CURVE_CENTER_Z = PODIUM_HALF_D - CORNER_CURVE_R; // +1.75

interface CurvePointXZ {
  x: number;
  z: number;
  nx: number;
  nz: number;
  arcS: number;
}

// ============================================================================
// CURVED PERIMETER & SWEPT RIBBON GEOMETRY HELPERS
// ============================================================================

/**
 * Generates an open curve path in XZ with analytic outward normals and cumulative arc length.
 * Used for concentric curved bulkheads, sills, panoramic 3D glass, and headers around the
 * Front-Left (`-X, +Z`) rounded corner.
 */
function sampleCornerWindowCurve(
  zLeftStart: number,
  xFrontEnd: number,
  arcSegs = 18,
  straightSegs = 2,
): CurvePointXZ[] {
  const pts: CurvePointXZ[] = [];
  const pushPt = (x: number, z: number, nx: number, nz: number) => {
    const prev = pts[pts.length - 1];
    const arcS = prev ? prev.arcS + Math.hypot(x - prev.x, z - prev.z) : 0;
    pts.push({ x, z, nx, nz, arcS });
  };

  // 1. Left (-X) straight run from zLeftStart to arc start (CURVE_CENTER_Z)
  for (let i = 0; i <= straightSegs; i++) {
    const t = i / straightSegs;
    const z = zLeftStart + (CURVE_CENTER_Z - zLeftStart) * t;
    pushPt(-PODIUM_HALF_W, z, -1, 0);
  }

  // 2. Smooth 90-degree quarter circle around Front-Left corner (theta: PI -> PI/2)
  for (let i = 1; i <= arcSegs; i++) {
    const t = i / arcSegs;
    const theta = Math.PI - t * (Math.PI * 0.5);
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    pushPt(
      CURVE_CENTER_X + cosT * CORNER_CURVE_R,
      CURVE_CENTER_Z + sinT * CORNER_CURVE_R,
      cosT,
      sinT,
    );
  }

  // 3. Front (+Z) straight run from arc end (CURVE_CENTER_X) to xFrontEnd
  for (let i = 1; i <= straightSegs; i++) {
    const t = i / straightSegs;
    const x = CURVE_CENTER_X + (xFrontEnd - CURVE_CENTER_X) * t;
    pushPt(x, PODIUM_HALF_D, 0, 1);
  }

  return pts;
}

/**
 * Generates closed perimeter points for the 1F podium (Front-Left curved corner R = 1.65m,
 * subtle chamfered corners elsewhere) offset cleanly outward by `offsetOut`.
 */
function buildClosedPodiumLoop(offsetOut: number, arcSegs = 16): Array<{ x: number; z: number; nx: number; nz: number; miter: number; arcS: number }> {
  const hw = PODIUM_HALF_W;
  const hd = PODIUM_HALF_D;
  const r = CORNER_CURVE_R + offsetOut;
  const ch = 0.08;
  const raw: Array<{ x: number; z: number; nx: number; nz: number; miter: number }> = [];

  // Left (-X) straight from rear chamfer to arc tangent
  raw.push({ x: -hw - offsetOut, z: -hd + ch, nx: -1, nz: 0, miter: 1 });
  // Arc from PI -> PI/2 around (CURVE_CENTER_X, CURVE_CENTER_Z)
  for (let i = 0; i <= arcSegs; i++) {
    const theta = Math.PI - (i / arcSegs) * (Math.PI * 0.5);
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    raw.push({
      x: CURVE_CENTER_X + c * r,
      z: CURVE_CENTER_Z + s * r,
      nx: c,
      nz: s,
      miter: 1,
    });
  }
  // Front-Right (+X, +Z) beveled corner
  raw.push({ x: hw - ch + offsetOut, z: hd + offsetOut, nx: 0, nz: 1, miter: 1 });
  raw.push({ x: hw + offsetOut, z: hd - ch + offsetOut, nx: 1, nz: 0, miter: 1 });
  // Rear-Right (+X, -Z) beveled corner
  raw.push({ x: hw + offsetOut, z: -hd + ch - offsetOut, nx: 1, nz: 0, miter: 1 });
  raw.push({ x: hw - ch + offsetOut, z: -hd - offsetOut, nx: 0, nz: -1, miter: 1 });
  // Rear-Left (-X, -Z) beveled corner
  raw.push({ x: -hw + ch - offsetOut, z: -hd - offsetOut, nx: 0, nz: -1, miter: 1 });

  const out: Array<{ x: number; z: number; nx: number; nz: number; miter: number; arcS: number }> = [];
  let accum = 0;
  for (let i = 0; i < raw.length; i++) {
    if (i > 0) {
      accum += Math.hypot(raw[i].x - raw[i - 1].x, raw[i].z - raw[i - 1].z);
    }
    out.push({ ...raw[i], arcS: accum });
  }
  return out;
}

/**
 * Sweeps a watertight rectangular cross-section `(inOff .. outOff, yBot .. yTop)` along an open
 * curve with analytic outward normals and proper CCW triangle winding.
 */
function createSweptCurvePrismGeo(
  pts: readonly CurvePointXZ[],
  inOff: number,
  outOff: number,
  yBot: number,
  yTop: number,
  uvTileM = 1.6,
  capEnds = true,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const pushQuad = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    d: [number, number, number],
    u0: number,
    v0: number,
    u1: number,
    v1: number,
  ) => {
    positions.push(...a, ...b, ...c, ...a, ...c, ...d);
    uvs.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
  };

  const h = yTop - yBot;
  const vH = h / uvTileM;

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const u0 = p0.arcS / uvTileM;
    const u1 = p1.arcS / uvTileM;

    const ob0: [number, number, number] = [p0.x + p0.nx * outOff, yBot, p0.z + p0.nz * outOff];
    const ob1: [number, number, number] = [p1.x + p1.nx * outOff, yBot, p1.z + p1.nz * outOff];
    const ot0: [number, number, number] = [p0.x + p0.nx * outOff, yTop, p0.z + p0.nz * outOff];
    const ot1: [number, number, number] = [p1.x + p1.nx * outOff, yTop, p1.z + p1.nz * outOff];

    const ib0: [number, number, number] = [p0.x + p0.nx * inOff, yBot, p0.z + p0.nz * inOff];
    const ib1: [number, number, number] = [p1.x + p1.nx * inOff, yBot, p1.z + p1.nz * inOff];
    const it0: [number, number, number] = [p0.x + p0.nx * inOff, yTop, p0.z + p0.nz * inOff];
    const it1: [number, number, number] = [p1.x + p1.nx * inOff, yTop, p1.z + p1.nz * inOff];

    // Outer face
    pushQuad(ob0, ob1, ot1, ot0, u0, 0, u1, vH);
    // Inner face
    pushQuad(ib1, ib0, it0, it1, u1, 0, u0, vH);
    // Top face
    pushQuad(ot0, ot1, it1, it0, u0, 0, u1, (outOff - inOff) / uvTileM);
    // Bottom face
    pushQuad(ib0, ib1, ob1, ob0, u0, 0, u1, (outOff - inOff) / uvTileM);
  }

  if (capEnds && pts.length >= 2) {
    const pS = pts[0];
    const pE = pts[pts.length - 1];
    const sIb: [number, number, number] = [pS.x + pS.nx * inOff, yBot, pS.z + pS.nz * inOff];
    const sOb: [number, number, number] = [pS.x + pS.nx * outOff, yBot, pS.z + pS.nz * outOff];
    const sOt: [number, number, number] = [pS.x + pS.nx * outOff, yTop, pS.z + pS.nz * outOff];
    const sIt: [number, number, number] = [pS.x + pS.nx * inOff, yTop, pS.z + pS.nz * inOff];
    pushQuad(sIb, sOb, sOt, sIt, 0, 0, 0.25, vH);

    const eIb: [number, number, number] = [pE.x + pE.nx * inOff, yBot, pE.z + pE.nz * inOff];
    const eOb: [number, number, number] = [pE.x + pE.nx * outOff, yBot, pE.z + pE.nz * outOff];
    const eOt: [number, number, number] = [pE.x + pE.nx * outOff, yTop, pE.z + pE.nz * outOff];
    const eIt: [number, number, number] = [pE.x + pE.nx * inOff, yTop, pE.z + pE.nz * inOff];
    pushQuad(eOb, eIb, eIt, eOt, 0, 0, 0.25, vH);
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
 * Extrudes a closed horizontal podium slab (with curved Front-Left corner) spanning `yBot .. yTop`.
 */
function createCurvedPodiumSlabGeo(
  offsetOut: number,
  yBot: number,
  yTop: number,
  bevel = 0.008,
): THREE.BufferGeometry {
  const hw = PODIUM_HALF_W + offsetOut;
  const hd = PODIUM_HALF_D + offsetOut;
  const r = CORNER_CURVE_R + offsetOut;
  const ch = 0.08;

  // Shape coordinates (sx = x, sy = -z), traced CCW
  const shape = new THREE.Shape();
  shape.moveTo(-hw, hd - ch);
  shape.lineTo(-hw, -CURVE_CENTER_Z);
  shape.absarc(CURVE_CENTER_X, -CURVE_CENTER_Z, r, Math.PI, Math.PI * 1.5, false);
  shape.lineTo(hw - ch, -hd);
  shape.lineTo(hw, -hd + ch);
  shape.lineTo(hw, hd - ch);
  shape.lineTo(hw - ch, hd);
  shape.lineTo(-hw + ch, hd);
  shape.closePath();

  const rawDepth = Math.max(0.01, yTop - yBot - bevel * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: rawDepth,
    bevelEnabled: bevel > 0.001,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 18,
  });
  geo.rotateX(-Math.PI * 0.5);
  geo.translate(0, yBot + bevel, 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Extrudes a hollow closed perimeter molding/curb/handrail ring following the curved podium outline
 * from `innerOffset` to `outerOffset`, spanning `yBot .. yTop`.
 */
function createCurvedPodiumRingGeo(
  innerOffset: number,
  outerOffset: number,
  yBot: number,
  yTop: number,
  bevel = 0.006,
): THREE.BufferGeometry {
  const makeLoop = (off: number, clockwise: boolean): THREE.Path => {
    const hw = PODIUM_HALF_W + off;
    const hd = PODIUM_HALF_D + off;
    const r = Math.max(0.25, CORNER_CURVE_R + off);
    const ch = 0.08;
    const path = new THREE.Path();
    if (!clockwise) {
      path.moveTo(-hw, hd - ch);
      path.lineTo(-hw, -CURVE_CENTER_Z);
      path.absarc(CURVE_CENTER_X, -CURVE_CENTER_Z, r, Math.PI, Math.PI * 1.5, false);
      path.lineTo(hw - ch, -hd);
      path.lineTo(hw, -hd + ch);
      path.lineTo(hw, hd - ch);
      path.lineTo(hw - ch, hd);
      path.lineTo(-hw + ch, hd);
      path.closePath();
    } else {
      path.moveTo(-hw + ch, hd);
      path.lineTo(hw - ch, hd);
      path.lineTo(hw, hd - ch);
      path.lineTo(hw, -hd + ch);
      path.lineTo(hw - ch, -hd);
      path.lineTo(CURVE_CENTER_X, -hd);
      path.absarc(CURVE_CENTER_X, -CURVE_CENTER_Z, r, Math.PI * 1.5, Math.PI, true);
      path.lineTo(-hw, hd - ch);
      path.closePath();
    }
    return path;
  };

  const outerShape = new THREE.Shape(makeLoop(outerOffset, false).getPoints(18));
  outerShape.holes.push(makeLoop(innerOffset, true));

  const safeBevel = Math.min(bevel, (outerOffset - innerOffset) * 0.25, (yTop - yBot) * 0.25);
  const geo = new THREE.ExtrudeGeometry(outerShape, {
    depth: Math.max(0.01, yTop - yBot - safeBevel * 2),
    bevelEnabled: safeBevel > 0.001,
    bevelThickness: safeBevel,
    bevelSize: safeBevel,
    bevelSegments: 1,
    curveSegments: 18,
  });
  geo.rotateX(-Math.PI * 0.5);
  geo.translate(0, yBot + safeBevel, 0);
  geo.computeVertexNormals();
  return geo;
}

// ============================================================================
// PROCEDURAL CANVAS TEXTURES FOR BEAUTY SALON
// ============================================================================

function createBlushSandstoneTexture(ctx: UrbanPlazaBuildingsContext): THREE.Texture {
  return getOrCreateBuildingCanvasTexture(ctx, 'salon_blush_sandstone_512', 512, 512, (c, w, h) => {
    c.fillStyle = '#e0baa8';
    c.fillRect(0, 0, w, h);
    const tones = ['#e8c6b6', '#daB29f', '#eed0c2', '#d3a895', '#e4c0b0'];
    const rows = 8;
    const cols = 4;
    const cw = w / cols;
    const ch = h / rows;
    for (let r = 0; r < rows; r++) {
      const shift = (r % 2) * (cw * 0.5);
      for (let col = -1; col <= cols; col++) {
        const x = col * cw + shift;
        const y = r * ch;
        c.fillStyle = tones[(r * 3 + col * 5 + 24) % tones.length];
        c.fillRect(x + 2, y + 2, cw - 4, ch - 4);
        // Soft sunlit top bevel & warm underside shadow
        c.fillStyle = 'rgba(255, 248, 240, 0.24)';
        c.fillRect(x + 2, y + 2, cw - 4, 2.8);
        c.fillStyle = 'rgba(138, 92, 74, 0.14)';
        c.fillRect(x + 2, y + ch - 4.5, cw - 4, 2.5);
      }
    }
    // Soft hand-painted blush travertine trowel blooms
    for (let i = 0; i < 72; i++) {
      const x = (i * 107 + 23) % w;
      const y = (i * 163 + 41) % h;
      const rad = 14 + (i % 20);
      const grad = c.createRadialGradient(x, y, 1, x, y, rad);
      grad.addColorStop(0, i % 2 === 0 ? 'rgba(255, 246, 238, 0.14)' : 'rgba(164, 112, 92, 0.10)');
      grad.addColorStop(1, 'rgba(224, 186, 168, 0)');
      c.fillStyle = grad;
      c.beginPath();
      c.arc(x, y, rad, 0, Math.PI * 2);
      c.fill();
    }
    for (let s = 0; s < 360; s++) {
      c.fillStyle = s % 2 === 0 ? 'rgba(140, 96, 78, 0.08)' : 'rgba(255, 248, 242, 0.14)';
      c.fillRect((s * 97) % w, (s * 173) % h, 2, 2);
    }
  });
}

function createSalonTerrazzoFloorTexture(ctx: UrbanPlazaBuildingsContext): THREE.Texture {
  return getOrCreateBuildingCanvasTexture(ctx, 'salon_terrazzo_floor_512', 512, 512, (c, w, h) => {
    c.fillStyle = '#f5ede2';
    c.fillRect(0, 0, w, h);
    const chips = ['#e5bba9', '#d8a68a', '#ffffff', '#cfb29a', '#edd4c6'];
    for (let i = 0; i < 650; i++) {
      const x = (i * 137 + (i % 9) * 29) % w;
      const y = (i * 211 + (i % 11) * 19) % h;
      const sz = 2 + (i % 4) * 1.4;
      c.fillStyle = chips[i % chips.length];
      c.beginPath();
      c.arc(x, y, sz * 0.65, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = 'rgba(200, 178, 160, 0.35)';
    c.lineWidth = 2;
    for (let g = 0; g <= 4; g++) {
      const p = (g / 4) * w;
      c.beginPath();
      c.moveTo(p, 0);
      c.lineTo(p, h);
      c.moveTo(0, p);
      c.lineTo(w, p);
      c.stroke();
    }
  });
}

function createSalonRooftopTurfTexture(ctx: UrbanPlazaBuildingsContext): THREE.Texture {
  return getOrCreateBuildingCanvasTexture(ctx, 'salon_rooftop_turf_256', 256, 256, (c, w, h) => {
    c.fillStyle = '#6db056';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 64; i++) {
      const x = (i * 83 + 17) % w;
      const y = (i * 139 + 29) % h;
      const rad = 12 + (i % 18);
      const grad = c.createRadialGradient(x, y, 1, x, y, rad);
      grad.addColorStop(0, i % 2 === 0 ? 'rgba(154, 214, 108, 0.22)' : 'rgba(72, 134, 58, 0.18)');
      grad.addColorStop(1, 'rgba(109, 176, 86, 0)');
      c.fillStyle = grad;
      c.beginPath();
      c.arc(x, y, rad, 0, Math.PI * 2);
      c.fill();
    }
    const blades = ['#7cc064', '#5c9c4b', '#87ca70', '#63a450'];
    for (let i = 0; i < 720; i++) {
      c.fillStyle = blades[i % blades.length];
      c.fillRect((i * 73) % w, (i * 131) % h, 2, 3.5);
    }
  });
}

function createSalonSignTexture(
  ctx: UrbanPlazaBuildingsContext,
  title: string,
  fontPx: number,
  bgHex = '#f5e9dc',
  borderHex = '#caa492',
): THREE.Texture {
  return makeBuildingCanvasTexture(
    ctx,
    1024,
    192,
    (c, w, h) => {
      c.fillStyle = bgHex;
      c.fillRect(0, 0, w, h);

      c.strokeStyle = borderHex;
      c.lineWidth = 8;
      c.strokeRect(10, 10, w - 20, h - 20);
      c.strokeStyle = '#9c7868';
      c.lineWidth = 2.5;
      c.strokeRect(20, 20, w - 40, h - 40);

      c.fillStyle = '#40342f';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = `700 ${fontPx}px Georgia, "Times New Roman", serif`;
      c.fillText(title, w * 0.5, h * 0.53);
    },
    false,
  );
}

function createSalonChalkboardTexture(ctx: UrbanPlazaBuildingsContext): THREE.Texture {
  return makeBuildingCanvasTexture(
    ctx,
    512,
    640,
    (c, w, h) => {
      c.fillStyle = '#2f3439';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = '#d7b59e';
      c.lineWidth = 5;
      c.strokeRect(18, 18, w - 36, h - 36);

      c.textAlign = 'center';
      c.fillStyle = '#f8e9dc';
      c.font = '800 44px Georgia, serif';
      c.fillText('GLOW STUDIO', w * 0.5, 86);

      c.fillStyle = '#f3b7c8';
      c.font = '700 24px Georgia, serif';
      c.fillText('BEAUTY & SKINCARE', w * 0.5, 132);

      c.strokeStyle = '#9ea6ad';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(64, 162);
      c.lineTo(w - 64, 162);
      c.stroke();

      const services: readonly string[] = [
        'HYDRA GLOW FACIAL',
        'SILK BLOWOUT & HAIR',
        'GEL MANICURE & SPA',
        'LASH LIFT & BROW BAR',
        'WALK-INS WELCOME',
      ];
      services.forEach((svc, idx) => {
        c.fillStyle = idx === services.length - 1 ? '#fde68a' : '#f1efea';
        c.font = idx === services.length - 1 ? '700 28px Georgia, serif' : '600 27px "Barlow", sans-serif';
        c.fillText(svc, w * 0.5, 224 + idx * 72);
      });
    },
    false,
  );
}

// ============================================================================
// SALON ARCHITECTURAL MICRO-PROPS & INTERIOR DETAILS
// ============================================================================

function buildBeautyWallSconce(
  parent: THREE.Object3D,
  ctx: UrbanPlazaBuildingsContext,
  pos: [number, number, number],
  rotY: number,
): void {
  const grp = new THREE.Group();
  grp.position.set(pos[0], pos[1], pos[2]);
  grp.rotation.y = rotY;
  parent.add(grp);

  // Backplate + warm glowing glass column + brass top/bottom caps
  ctx.addPart(grp, createBeveledBox(0.11, 0.34, 0.03, 0.008), COL_SALON_BRONZE, [0, 0, 0.015]);
  ctx.addPart(grp, createBeveledBox(0.09, 0.20, 0.08, 0.014), '#ffefc4', [0, 0, 0.065]);
  ctx.addPart(grp, createBeveledBox(0.12, 0.036, 0.10, 0.008), COL_SALON_BRASS, [0, 0.11, 0.065]);
  ctx.addPart(grp, createBeveledBox(0.12, 0.036, 0.10, 0.008), COL_SALON_BRASS, [0, -0.11, 0.065]);
}

function buildSleekCreamAwning(
  parent: THREE.Object3D,
  ctx: UrbanPlazaBuildingsContext,
  width: number,
  depth: number,
  dropH: number,
  pos: [number, number, number],
  rotY: number,
): void {
  const grp = new THREE.Group();
  grp.position.set(pos[0], pos[1], pos[2]);
  grp.rotation.y = rotY;
  parent.add(grp);

  const slopeLen = Math.hypot(depth, dropH);
  const tilt = Math.atan2(dropH, depth);
  const recvShadow = !ctx.isSoftwareGl;
  ctx.addPart(
    grp,
    createBeveledBox(width, 0.055, slopeLen, 0.010),
    COL_SALON_AWNING,
    [0, -dropH * 0.5, depth * 0.5],
    [tilt, 0, 0],
    { castShadow: recvShadow, receiveShadow: recvShadow },
  );
  // Crisp front valance band & side cheek returns
  ctx.addPart(grp, createBeveledBox(width + 0.02, 0.09, 0.045, 0.008), COL_SALON_AWNING_TRIM, [0, -dropH - 0.025, depth], [0, 0, 0], {
    receiveShadow: recvShadow,
  });
  for (const sx of [-width * 0.45, width * 0.45]) {
    ctx.addPart(grp, createBeveledBox(0.035, 0.035, depth * 0.90, 0.006), COL_SALON_BRONZE, [sx, -dropH * 0.90, depth * 0.45]);
  }
}

function buildModernGlazedDoorway(
  parent: THREE.Object3D,
  glassHost: THREE.Object3D,
  ctx: UrbanPlazaBuildingsContext,
  opts: {
    pos: [number, number, number];
    rotY: number;
    width: number;
    height: number;
    windowId: string;
    windowCol: number;
    clearGlassMat: THREE.Material;
    oakTex?: THREE.Texture;
    handleOnLeft?: boolean;
  },
): void {
  const grp = new THREE.Group();
  grp.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
  grp.rotation.y = opts.rotY;
  parent.add(grp);

  const w = opts.width;
  const h = opts.height;
  const recvShadow = !ctx.isSoftwareGl;
  // Stone threshold step
  ctx.addPart(grp, createBeveledBox(w + 0.36, 0.06, 0.44, 0.012), COL_SALON_BLUSH, [0, 0.03, 0.14], [0, 0, 0], {
    receiveShadow: recvShadow,
  });
  // Champagne-oak door frame (outer jambs, top header, lower kick-rail & upper transom) with warm timber grain
  const jambW = 0.11;
  const frameColor = opts.oakTex ? '#ffffff' : COL_SALON_OAK;
  for (const sx of [-w * 0.5 + jambW * 0.5, w * 0.5 - jambW * 0.5]) {
    ctx.addPart(
      grp,
      applyGrainUvs(createBeveledBox(jambW, h, 0.24, 0.010), 'y', 1.4),
      frameColor,
      [sx, h * 0.5 + 0.05, -0.02],
      [0, 0, 0],
      { map: opts.oakTex, receiveShadow: recvShadow },
    );
  }
  ctx.addPart(
    grp,
    applyGrainUvs(createBeveledBox(w, 0.14, 0.24, 0.010), 'x', 1.4),
    frameColor,
    [0, h - 0.02, -0.02],
    [0, 0, 0],
    { map: opts.oakTex, receiveShadow: recvShadow },
  );
  ctx.addPart(
    grp,
    applyGrainUvs(createBeveledBox(w - jambW * 2 + 0.02, 0.42, 0.09, 0.008), 'x', 1.2),
    frameColor,
    [0, 0.27, 0.01],
    [0, 0, 0],
    { map: opts.oakTex, receiveShadow: recvShadow },
  );
  ctx.addPart(
    grp,
    applyGrainUvs(createBeveledBox(w - jambW * 2 + 0.02, 0.065, 0.09, 0.008), 'x', 1.2),
    frameColor,
    [0, h - 0.62, 0.01],
    [0, 0, 0],
    { map: opts.oakTex, receiveShadow: recvShadow },
  );

  // C-shaped brass pull handle on stile
  const handleX = (opts.handleOnLeft ?? true) ? -w * 0.26 : w * 0.26;
  buildTubularDoorPull(grp, ctx, [handleX, 1.56, 0.055], 0.56, COL_SALON_BRASS, 0.085);

  // Unbaked 3D transparent clear glass panel in glassHost
  const gGrp = new THREE.Group();
  gGrp.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
  gGrp.rotation.y = opts.rotY;
  glassHost.add(gGrp);

  const glassGeo = new THREE.BoxGeometry(w - jambW * 2, h - 0.54, 0.028);
  ctx.registerGeo(glassGeo);
  const gMesh = new THREE.Mesh(glassGeo, opts.clearGlassMat);
  gMesh.position.set(0, 0.48 + (h - 0.54) * 0.5, 0.0);
  gMesh.castShadow = false;
  gMesh.receiveShadow = false;
  tagCityWindowMesh(
    gMesh,
    createCityWindowSpec(opts.windowId, 'storefront', '#d6f4ff', 1, opts.windowCol),
  );
  gGrp.add(gMesh);
}

function buildSidewalkChalkboardEasel(
  parent: THREE.Object3D,
  ctx: UrbanPlazaBuildingsContext,
  pos: [number, number, number],
  rotY: number,
  chalkTex: THREE.Texture,
  oakTex: THREE.Texture,
): void {
  const grp = new THREE.Group();
  grp.position.set(pos[0], pos[1], pos[2]);
  grp.rotation.y = rotY;
  grp.scale.setScalar(1.22);
  parent.add(grp);

  // A-frame front & back oak boards + chalkboard face
  ctx.addPart(
    grp,
    applyGrainUvs(createBeveledBox(0.68, 0.96, 0.045, 0.008), 'y', 1.0),
    '#ffffff',
    [0, 0.48, 0.14],
    [-0.22, 0, 0],
    { map: oakTex, castShadow: true },
  );
  ctx.addPart(
    grp,
    applyGrainUvs(createBeveledBox(0.68, 0.96, 0.045, 0.008), 'y', 1.0),
    '#ffffff',
    [0, 0.48, -0.14],
    [0.22, 0, 0],
    { map: oakTex, castShadow: true },
  );
  ctx.addPart(grp, new THREE.PlaneGeometry(0.56, 0.78), '#ffffff', [0, 0.52, 0.168], [-0.22, 0, 0], {
    map: chalkTex,
  });
  ctx.addPart(grp, new THREE.PlaneGeometry(0.56, 0.78), '#ffffff', [0, 0.52, -0.168], [0.22, Math.PI, 0], {
    map: chalkTex,
  });
}

function buildRainwaterDownspout(
  parent: THREE.Object3D,
  ctx: UrbanPlazaBuildingsContext,
  pos: [number, number, number],
  rotY: number,
  topY: number,
): void {
  const grp = new THREE.Group();
  grp.position.set(pos[0], pos[1], pos[2]);
  grp.rotation.y = rotY;
  parent.add(grp);

  const col = '#766d64';
  const shaftH = topY - 0.36;
  const recvShadow = !ctx.isSoftwareGl;
  // Main vertical metal pipe + flared collector hopper at cornice + outward ground shoe
  ctx.addPart(grp, new THREE.CylinderGeometry(0.052, 0.052, shaftH, 10), col, [0, 0.24 + shaftH * 0.5, 0.06], [0, 0, 0], {
    castShadow: recvShadow,
    receiveShadow: recvShadow,
  });
  ctx.addPart(grp, new THREE.CylinderGeometry(0.11, 0.06, 0.16, 10), col, [0, topY - 0.08, 0.06]);
  // Offset neck entering cornice
  ctx.addPart(grp, new THREE.CylinderGeometry(0.048, 0.048, 0.16, 8), col, [0, topY - 0.02, -0.02], [Math.PI * 0.35, 0, 0]);
  // Outward discharge elbow shoe at base
  ctx.addPart(grp, new THREE.CylinderGeometry(0.054, 0.058, 0.22, 8), col, [0, 0.15, 0.12], [Math.PI * 0.34, 0, 0]);
  // Wall mounting collar straps
  for (const sy of [0.95, 2.25, 3.55]) {
    ctx.addPart(grp, new THREE.CylinderGeometry(0.068, 0.068, 0.045, 10), '#5a524b', [0, sy, 0.06]);
    ctx.addPart(grp, new THREE.BoxGeometry(0.16, 0.04, 0.05), '#5a524b', [0, sy, 0.02]);
  }
}

function buildOliveTreePot(
  parent: THREE.Object3D,
  ctx: UrbanPlazaBuildingsContext,
  pos: [number, number, number],
  scale = 1.0,
): void {
  const grp = new THREE.Group();
  grp.position.set(pos[0], pos[1], pos[2]);
  grp.scale.setScalar(scale);
  parent.add(grp);

  const potPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.20, 0.0),
    new THREE.Vector2(0.26, 0.42),
    new THREE.Vector2(0.29, 0.46),
    new THREE.Vector2(0.29, 0.52),
    new THREE.Vector2(0.22, 0.52),
    new THREE.Vector2(0.20, 0.45),
    new THREE.Vector2(0.0, 0.45),
  ];
  ctx.addPart(grp, new THREE.LatheGeometry(potPts, 14), '#cfb5a5', [0, 0, 0], [0, 0, 0], { castShadow: true });
  ctx.addPart(grp, new THREE.CylinderGeometry(0.22, 0.22, 0.04, 12), '#5a4332', [0, 0.47, 0]);

  // Slender branching olive trunks
  for (const [bx, bz, tiltX, tiltZ] of [
    [0.0, 0.0, 0.05, -0.04],
    [0.05, 0.03, -0.14, 0.16],
    [-0.05, -0.02, 0.14, -0.15],
  ] as const) {
    ctx.addPart(grp, new THREE.CylinderGeometry(0.022, 0.035, 0.85, 6), '#7c624d', [bx, 0.86, bz], [tiltX, 0, tiltZ]);
  }

  // Soft silvery-sage olive foliage canopy clusters
  const foliagePts: readonly [number, number, number, number, string][] = [
    [0.0, 1.48, 0.0, 0.34, '#678d5b'],
    [-0.22, 1.32, 0.14, 0.26, '#7ba16d'],
    [0.22, 1.38, -0.12, 0.27, '#5c8051'],
    [0.08, 1.64, 0.14, 0.25, '#86ab78'],
    [-0.14, 1.56, -0.16, 0.24, '#739766'],
  ];
  for (const [fx, fy, fz, rad, col] of foliagePts) {
    ctx.addPart(grp, new THREE.SphereGeometry(rad, 9, 8), col, [fx, fy, fz], [0, 0, 0], { castShadow: true });
  }
}

// ============================================================================
// VISIBLE SALON INTERIOR FIXTURES (`y = 0.06 .. 3.55m`)
// ============================================================================

function buildSalonInteriorFixtures(
  parent: THREE.Object3D,
  ctx: UrbanPlazaBuildingsContext,
  oakTex: THREE.Texture,
  floorTex: THREE.Texture,
): void {
  const grp = new THREE.Group();
  grp.name = 'BeautySalonInterior';
  parent.add(grp);

  // 1. Interior Terrazzo Floor, Cream Walls & Bright Illuminated Ceiling
  const floorGeo = createCurvedPodiumSlabGeo(-0.22, 0.02, 0.075, 0.004);
  ctx.applyPlanarUvs(floorGeo, 1.8);
  ctx.addPart(grp, floorGeo, '#ffffff', [0, 0, 0], [0, 0, 0], { map: floorTex, receiveShadow: true, bounce: 2.54 });

  const ceilingGeo = createCurvedPodiumSlabGeo(-0.22, 3.50, 3.58, 0.004);
  ctx.addPart(grp, ceilingGeo, '#fdf6ec', [0, 0, 0], [0, 0, 0], { bounce: 2.60 });

  // Interior backdrop partition wall at z = -2.25m (bright sunlit cream behind vanity & display niches)
  ctx.addPart(grp, createBeveledBox(6.8, 3.44, 0.14, 0.010), '#f7efe4', [-0.35, 1.78, -2.25], [0, 0, 0], { bounce: 2.66 });
  // Right-side decorative partition wall at x = +1.36m supporting arched niche facing -X toward curved window
  ctx.addPart(grp, createBeveledBox(0.14, 3.44, 2.25, 0.010), '#f5eadb', [1.36, 1.78, -1.12], [0, 0, 0], { bounce: 2.66 });

  // 2. Arched Backlit Display Wall Niches stocked with pastel skincare bottles & perfume jars
  const buildDisplayNiche = (nx: number, nz: number, rotY: number) => {
    const nGrp = new THREE.Group();
    nGrp.position.set(nx, 0.08, nz);
    nGrp.rotation.y = rotY;
    grp.add(nGrp);

    // Cream cabinet surround + arched warm backlit inner panel (#fff2de)
    ctx.addPart(nGrp, createBeveledBox(1.36, 2.40, 0.24, 0.014), '#ebd9c8', [0, 1.20, 0], [0, 0, 0], { bounce: 2.62 });
    ctx.addPart(nGrp, createBeveledBox(1.06, 1.85, 0.04, 0.008), '#fff1d9', [0, 1.32, 0.11], [0, 0, 0], { bounce: 2.92 });
    ctx.addPart(
      nGrp,
      new THREE.CylinderGeometry(0.53, 0.53, 0.04, 16, 1, false, 0, Math.PI),
      '#fff1d9',
      [0, 2.24, 0.11],
      [Math.PI * 0.5, 0, 0],
      { bounce: 2.92 },
    );
    // Arched oak trim border
    ctx.addPart(nGrp, new THREE.TorusGeometry(0.54, 0.036, 6, 16, Math.PI), COL_SALON_OAK, [0, 2.24, 0.13], [0, 0, 0], {
      bounce: 2.60,
    });

    // 4 Display Shelves stocked with pastel skincare bottles, serum droppers & perfume jars
    const bottleCols = ['#f6b4c8', '#d7c3f4', '#b4e3d4', '#f8d6a8', '#fffaf4', '#f39ebc'];
    for (let sh = 0; sh < 4; sh++) {
      const sy = 0.58 + sh * 0.46;
      ctx.addPart(nGrp, createBeveledBox(1.04, 0.032, 0.18, 0.006), '#ffffff', [0, sy, 0.16], [0, 0, 0], {
        map: oakTex,
        bounce: 2.62,
      });
      for (let b = 0; b < 5; b++) {
        const bx = -0.38 + b * 0.19;
        const bCol = bottleCols[(sh * 3 + b) % bottleCols.length];
        const bH = b % 2 === 0 ? 0.16 : 0.12;
        const bR = b % 3 === 0 ? 0.045 : 0.034;
        ctx.addPart(nGrp, new THREE.CylinderGeometry(bR, bR * 1.05, bH, 8), bCol, [bx, sy + 0.016 + bH * 0.5, 0.18], [0, 0, 0], {
          bounce: 2.68,
        });
        ctx.addPart(
          nGrp,
          new THREE.CylinderGeometry(bR * 0.55, bR * 0.55, 0.035, 7),
          COL_SALON_BRASS,
          [bx, sy + 0.016 + bH + 0.018, 0.18],
          [0, 0, 0],
          { bounce: 2.68 },
        );
      }
    }
  };
  buildDisplayNiche(-2.85, -2.04, 0.0);
  buildDisplayNiche(1.18, -0.82, -Math.PI * 0.5);

  // Chic Reception Desk & Floral Vase inside right entrance vestibule (visible through glass doors)
  const recGrp = new THREE.Group();
  recGrp.position.set(2.48, 0.075, -1.15);
  grp.add(recGrp);
  ctx.addPart(recGrp, createBeveledBox(1.42, 0.96, 0.52, 0.014), '#f3e5d6', [0, 0.48, 0], [0, 0, 0], {
    castShadow: true,
    bounce: 2.64,
  });
  ctx.addPart(recGrp, createBeveledBox(1.50, 0.06, 0.58, 0.012), COL_SALON_MARBLE, [0, 0.99, 0], [0, 0, 0], { bounce: 2.64 });
  ctx.addPart(recGrp, new THREE.CylinderGeometry(0.08, 0.06, 0.18, 10), '#d9b4a2', [-0.42, 1.11, 0], [0, 0, 0], { bounce: 2.64 });
  ctx.addPart(recGrp, new THREE.SphereGeometry(0.13, 8, 7), '#f3a4bf', [-0.42, 1.24, 0], [0, 0, 0], { bounce: 2.64 });

  // 3. Center White Marble Display Pedestal Table with Makeup Brush Cup & Bottles (curved corner foreground!)
  const pedGrp = new THREE.Group();
  pedGrp.position.set(-2.05, 0.075, 1.35);
  grp.add(pedGrp);

  ctx.addPart(pedGrp, new THREE.CylinderGeometry(0.64, 0.66, 0.06, 20), COL_SALON_BRASS, [0, 0.03, 0], [0, 0, 0], { bounce: 2.68 });
  ctx.addPart(pedGrp, new THREE.CylinderGeometry(0.60, 0.62, 0.84, 20), COL_SALON_MARBLE, [0, 0.48, 0], [0, 0, 0], {
    castShadow: true,
    receiveShadow: true,
    bounce: 2.68,
  });
  ctx.addPart(pedGrp, new THREE.CylinderGeometry(0.68, 0.66, 0.07, 20), '#fcf9f5', [0, 0.935, 0], [0, 0, 0], {
    castShadow: true,
    bounce: 2.68,
  });
  ctx.addPart(pedGrp, new THREE.TorusGeometry(0.67, 0.016, 6, 20), COL_SALON_BRASS, [0, 0.90, 0], [Math.PI * 0.5, 0, 0], {
    bounce: 2.68,
  });

  // Makeup Brush Cup + 7 Angled Brushes + Display Bottles on Pedestal Table
  ctx.addPart(pedGrp, new THREE.CylinderGeometry(0.085, 0.075, 0.17, 12), '#e5c9a8', [0.14, 1.055, 0.08], [0, 0, 0], {
    bounce: 2.68,
  });
  for (let br = 0; br < 7; br++) {
    const ba = (br / 7) * Math.PI * 2;
    const tilt = 0.22;
    ctx.addPart(
      pedGrp,
      new THREE.CylinderGeometry(0.010, 0.008, 0.24, 5),
      '#d8ab6a',
      [0.14 + Math.cos(ba) * 0.025, 1.15, 0.08 + Math.sin(ba) * 0.025],
      [Math.sin(ba) * tilt, 0, -Math.cos(ba) * tilt],
      { bounce: 2.68 },
    );
    ctx.addPart(
      pedGrp,
      new THREE.SphereGeometry(0.022, 6, 5),
      br % 2 === 0 ? '#5c4338' : '#e6a8b8',
      [0.14 + Math.cos(ba) * 0.05, 1.26, 0.08 + Math.sin(ba) * 0.05],
      [0, 0, 0],
      { bounce: 2.68 },
    );
  }
  for (const [bx, bz, bh, col] of [
    [-0.18, 0.12, 0.20, '#f4b6c8'],
    [-0.08, -0.14, 0.16, '#d9c4f2'],
    [-0.28, -0.05, 0.13, '#b8e0d2'],
    [0.24, -0.16, 0.15, '#f6d6aa'],
  ] as const) {
    ctx.addPart(pedGrp, new THREE.CylinderGeometry(0.048, 0.052, bh, 10), col, [bx, 0.97 + bh * 0.5, bz], [0, 0, 0], {
      bounce: 2.68,
    });
    ctx.addPart(
      pedGrp,
      new THREE.CylinderGeometry(0.025, 0.025, 0.04, 8),
      COL_SALON_BRASS,
      [bx, 0.97 + bh + 0.02, bz],
      [0, 0, 0],
      { bounce: 2.68 },
    );
  }

  // 4. Hollywood Bulb-Lit Vanity Mirror + Counter + Cushioned Seat (`x = -0.85, z = -1.65`)
  const vanGrp = new THREE.Group();
  vanGrp.position.set(-0.92, 0.075, -1.65);
  grp.add(vanGrp);

  ctx.addPart(vanGrp, createBeveledBox(1.56, 0.84, 0.50, 0.014), '#f8f2ea', [0, 0.42, 0], [0, 0, 0], {
    castShadow: true,
    bounce: 2.64,
  });
  ctx.addPart(vanGrp, createBeveledBox(1.64, 0.06, 0.56, 0.012), COL_SALON_MARBLE, [0, 0.87, 0], [0, 0, 0], { bounce: 2.64 });
  // Drawer pulls
  for (const dx of [-0.46, 0.46]) {
    ctx.addPart(vanGrp, createBeveledBox(0.58, 0.20, 0.03, 0.008), '#eedfce', [dx, 0.68, 0.255], [0, 0, 0], { bounce: 2.64 });
    ctx.addPart(vanGrp, createBeveledBox(0.14, 0.025, 0.025, 0.005), COL_SALON_BRASS, [dx, 0.68, 0.275], [0, 0, 0], {
      bounce: 2.64,
    });
  }
  // Mirror frame + reflective pane + 14 warm Hollywood vanity bulbs
  ctx.addPart(vanGrp, createBeveledBox(1.26, 1.32, 0.08, 0.014), '#fdfaf5', [0, 1.56, -0.18], [0, 0, 0], { bounce: 2.66 });
  ctx.addPart(vanGrp, new THREE.BoxGeometry(1.04, 1.10, 0.025), '#c9e0ee', [0, 1.56, -0.135], [0, 0, 0], { bounce: 2.64 });
  for (let ly = 0; ly < 5; ly++) {
    const by = 1.04 + ly * 0.26;
    ctx.addPart(vanGrp, new THREE.SphereGeometry(0.036, 7, 6), '#fff4c8', [-0.57, by, -0.12], [0, 0, 0], { bounce: 2.95 });
    ctx.addPart(vanGrp, new THREE.SphereGeometry(0.036, 7, 6), '#fff4c8', [0.57, by, -0.12], [0, 0, 0], { bounce: 2.95 });
  }
  for (let lx = 0; lx < 5; lx++) {
    const bx = -0.44 + lx * 0.22;
    ctx.addPart(vanGrp, new THREE.SphereGeometry(0.036, 7, 6), '#fff4c8', [bx, 2.16, -0.12], [0, 0, 0], { bounce: 2.95 });
  }
  // Plush blush-pink vanity stool
  ctx.addPart(vanGrp, new THREE.CylinderGeometry(0.24, 0.26, 0.14, 14), '#e8b4c0', [0, 0.46, 0.56], [0, 0, 0], { bounce: 2.62 });
  ctx.addPart(vanGrp, new THREE.CylinderGeometry(0.04, 0.05, 0.36, 8), COL_SALON_BRASS, [0, 0.21, 0.56], [0, 0, 0], {
    bounce: 2.62,
  });
  ctx.addPart(vanGrp, new THREE.CylinderGeometry(0.22, 0.24, 0.035, 12), COL_SALON_BRASS, [0, 0.018, 0.56], [0, 0, 0], {
    bounce: 2.62,
  });

  // 5. Round Lit Mirror Station + Counter + Seat (`x = +0.54, z = -1.55`)
  const rndGrp = new THREE.Group();
  rndGrp.position.set(0.54, 0.075, -1.55);
  grp.add(rndGrp);

  ctx.addPart(rndGrp, createBeveledBox(1.04, 0.80, 0.46, 0.014), '#ffffff', [0, 0.40, 0], [0, 0, 0], {
    map: oakTex,
    bounce: 2.64,
  });
  ctx.addPart(rndGrp, createBeveledBox(1.10, 0.055, 0.52, 0.012), COL_SALON_MARBLE, [0, 0.825, 0], [0, 0, 0], {
    bounce: 2.64,
  });
  // Circular mirror with glowing LED rim halo
  ctx.addPart(rndGrp, new THREE.CylinderGeometry(0.46, 0.46, 0.04, 24), '#fff3c9', [0, 1.48, -0.16], [Math.PI * 0.5, 0, 0], {
    bounce: 2.95,
  });
  ctx.addPart(rndGrp, new THREE.CylinderGeometry(0.41, 0.41, 0.05, 24), '#cae0ed', [0, 1.48, -0.15], [Math.PI * 0.5, 0, 0], {
    bounce: 2.64,
  });
  ctx.addPart(rndGrp, new THREE.TorusGeometry(0.44, 0.022, 6, 24), COL_SALON_BRASS, [0, 1.48, -0.14], [0, 0, 0], {
    bounce: 2.64,
  });
  // Stool
  ctx.addPart(rndGrp, new THREE.CylinderGeometry(0.22, 0.22, 0.12, 12), '#e6d4c4', [0, 0.45, 0.54], [0, 0, 0], { bounce: 2.62 });
  ctx.addPart(rndGrp, new THREE.CylinderGeometry(0.038, 0.045, 0.36, 8), COL_SALON_BRASS, [0, 0.20, 0.54], [0, 0, 0], {
    bounce: 2.62,
  });
  ctx.addPart(rndGrp, new THREE.CylinderGeometry(0.20, 0.22, 0.035, 12), COL_SALON_BRASS, [0, 0.018, 0.54], [0, 0, 0], {
    bounce: 2.62,
  });

  // 6. Warm Hanging Pendant Lamps suspended from ceiling over display table & reception
  for (const [px, pz, drop] of [
    [-2.05, 1.35, 0.92],
    [0.05, 0.25, 0.82],
    [2.35, 0.85, 0.86],
  ] as const) {
    ctx.addPart(grp, new THREE.CylinderGeometry(0.012, 0.012, drop, 6), COL_SALON_BRASS, [px, 3.50 - drop * 0.5, pz], [0, 0, 0], {
      bounce: 2.64,
    });
    ctx.addPart(grp, new THREE.CylinderGeometry(0.05, 0.22, 0.18, 14), COL_SALON_BRASS, [px, 3.50 - drop, pz], [0, 0, 0], {
      bounce: 2.64,
    });
    ctx.addPart(grp, new THREE.SphereGeometry(0.075, 10, 8), '#fff3c4', [px, 3.50 - drop - 0.06, pz], [0, 0, 0], {
      bounce: 2.95,
    });
  }
}

// ============================================================================
// ROOFTOP GARDEN LOUNGE & PLANTERS (`y = 8.42m`)
// ============================================================================

function buildSalonRooftopGarden(
  parent: THREE.Object3D,
  ctx: UrbanPlazaBuildingsContext,
  originX: number,
  originZ: number,
  groupYaw: number,
  oakTex: THREE.Texture,
  turfTex: THREE.Texture,
): void {
  const roofY = 8.42;
  const rGrp = new THREE.Group();
  rGrp.position.set(0, roofY, 0);
  parent.add(rGrp);

  // 1. Stone perimeter deck & lush manicured green rooftop turf court
  ctx.addPart(rGrp, createBeveledBox(6.22, 0.06, 4.32, 0.012), '#e5d4c3', [0, 0.0, 0], [0, 0, 0], {
    receiveShadow: true,
  });
  ctx.addPart(
    rGrp,
    ctx.applyPlanarUvs(createBeveledBox(5.15, 0.03, 3.25, 0.010), 1.8),
    '#ffffff',
    [0, 0.025, 0],
    [0, 0, 0],
    { map: turfTex, receiveShadow: true },
  );

  // 2. Perimeter Hedge Planters & Corner Potted Palms / Greenery
  const hedgePlanterSpecs: readonly [number, number, number, number, number][] = [
    [0, -1.78, 3.85, 0.46, 0],
    [-2.65, 0, 2.35, 0.46, Math.PI * 0.5],
    [2.65, 0, 2.35, 0.46, Math.PI * 0.5],
    [-1.62, 1.78, 1.75, 0.46, 0],
    [1.62, 1.78, 1.75, 0.46, 0],
  ];
  for (const [hx, hz, len, dep, rotY] of hedgePlanterSpecs) {
    buildRooftopGardenPlanterBox(rGrp, ctx, originX, originZ, groupYaw, hx, 0.03, hz, len, dep, rotY, oakTex);
  }
  for (const [px, pz, sc] of [
    [-2.58, 1.68, 0.78],
    [2.58, 1.68, 0.78],
    [-2.58, -1.68, 0.76],
    [2.58, -1.68, 0.76],
  ] as const) {
    buildOliveTreePot(rGrp, ctx, [px, 0.03, pz], sc);
  }
  // Spiky sculptural palm/agave accent planter at front center parapet
  buildUrnBoxwoodPlanter(rGrp, ctx, [0, 0.03, 1.72], 0.78, 'cone', '#d4b4a2');

  // 3. 2-Seat Cushioned Sofa + Coffee Table (Right / East side of rooftop)
  const sofaGrp = new THREE.Group();
  sofaGrp.position.set(1.26, 0.04, -0.58);
  sofaGrp.rotation.y = -0.18;
  rGrp.add(sofaGrp);

  // Oak sofa base + back + armrests
  ctx.addPart(sofaGrp, applyGrainUvs(createBeveledBox(1.66, 0.24, 0.74, 0.014), 'x', 1.2), '#ffffff', [0, 0.14, 0], [0, 0, 0], {
    map: oakTex,
    castShadow: true,
  });
  ctx.addPart(sofaGrp, applyGrainUvs(createBeveledBox(1.66, 0.54, 0.12, 0.012), 'x', 1.2), '#ffffff', [0, 0.48, -0.31], [0, 0, 0], {
    map: oakTex,
  });
  for (const ax of [-0.77, 0.77]) {
    ctx.addPart(sofaGrp, applyGrainUvs(createBeveledBox(0.12, 0.38, 0.74, 0.012), 'z', 1.2), '#ffffff', [ax, 0.34, 0], [0, 0, 0], {
      map: oakTex,
    });
  }
  // Plush cream seat & back cushions + blush accent pillow
  for (const cx of [-0.36, 0.36]) {
    ctx.addPart(sofaGrp, createBeveledBox(0.69, 0.12, 0.60, 0.025), '#faf2e6', [cx, 0.31, 0.03]);
    ctx.addPart(sofaGrp, createBeveledBox(0.68, 0.38, 0.13, 0.025), '#f7ede0', [cx, 0.52, -0.18], [-0.12, 0, 0]);
  }
  ctx.addPart(sofaGrp, createBeveledBox(0.28, 0.24, 0.10, 0.02), '#e8b4c0', [-0.52, 0.48, -0.05], [0, 0.25, 0.18]);

  // Coffee table in front of sofa
  ctx.addPart(sofaGrp, createBeveledBox(1.02, 0.055, 0.52, 0.012), COL_SALON_MARBLE, [0, 0.36, 0.88], [0, 0, 0], {
    castShadow: true,
  });
  for (const [lx, lz] of [
    [-0.42, 0.68],
    [0.42, 0.68],
    [-0.42, 1.08],
    [0.42, 1.08],
  ] as const) {
    ctx.addPart(sofaGrp, new THREE.CylinderGeometry(0.024, 0.02, 0.34, 6), COL_SALON_OAK, [lx, 0.17, lz]);
  }
  ctx.addPart(sofaGrp, new THREE.CylinderGeometry(0.10, 0.08, 0.025, 10), '#fff9f2', [0, 0.40, 0.88]);
  ctx.addPart(sofaGrp, new THREE.CylinderGeometry(0.045, 0.035, 0.07, 8), '#e6b8c4', [0.05, 0.435, 0.88]);

  // 4. Round Bistro Table + 3 Chairs (Left / West side of rooftop)
  const bisGrp = new THREE.Group();
  bisGrp.position.set(-1.32, 0.04, 0.25);
  rGrp.add(bisGrp);

  ctx.addPart(bisGrp, new THREE.CylinderGeometry(0.24, 0.28, 0.04, 12), COL_SALON_BRONZE, [0, 0.02, 0]);
  ctx.addPart(bisGrp, new THREE.CylinderGeometry(0.04, 0.05, 0.68, 8), COL_SALON_BRONZE, [0, 0.36, 0]);
  ctx.addPart(bisGrp, new THREE.CylinderGeometry(0.50, 0.50, 0.045, 18), COL_SALON_MARBLE, [0, 0.71, 0], [0, 0, 0], {
    castShadow: true,
  });
  ctx.addPart(bisGrp, new THREE.CylinderGeometry(0.055, 0.04, 0.11, 10), '#dfb8a8', [0, 0.78, 0]);
  ctx.addPart(bisGrp, new THREE.SphereGeometry(0.085, 7, 6), '#f3a4bf', [0, 0.85, 0]);

  for (let c = 0; c < 3; c++) {
    const ang = (c / 3) * Math.PI * 2 + 0.35;
    const chGrp = new THREE.Group();
    chGrp.position.set(Math.sin(ang) * 0.76, 0, Math.cos(ang) * 0.76);
    chGrp.rotation.y = ang + Math.PI;
    bisGrp.add(chGrp);

    for (const [lx, lz] of [
      [-0.14, -0.14],
      [0.14, -0.14],
      [-0.14, 0.14],
      [0.14, 0.14],
    ] as const) {
      ctx.addPart(chGrp, new THREE.CylinderGeometry(0.018, 0.014, 0.42, 5), COL_SALON_BRONZE, [lx, 0.21, lz]);
    }
    ctx.addPart(chGrp, new THREE.CylinderGeometry(0.20, 0.20, 0.04, 12), '#ffffff', [0, 0.43, 0], [0, 0, 0], {
      map: oakTex,
      castShadow: true,
    });
    ctx.addPart(chGrp, new THREE.CylinderGeometry(0.16, 0.16, 0.03, 12), '#faf2e6', [0, 0.46, 0]);
    ctx.addPart(chGrp, new THREE.TorusGeometry(0.17, 0.02, 6, 12, Math.PI), COL_SALON_OAK, [0, 0.65, -0.15], [-0.14, 0, 0]);
    for (const bx of [-0.13, 0, 0.13]) {
      ctx.addPart(chGrp, new THREE.CylinderGeometry(0.014, 0.014, 0.24, 5), COL_SALON_OAK, [bx, 0.56, -0.14], [-0.14, 0, 0]);
    }
  }
}

// ============================================================================
// MAIN EXPORT: buildBeautySalonStudio3D
// ============================================================================

/**
 * Builds the 2-story curved-corner "BEAUTY & GLOW / GLOW STUDIO" Beauty Salon on
 * Central Urban Plaza's South promenade (`29.5, 14.0`, facing North `-Z` toward the Fountain).
 */
export function buildBeautySalonStudio3D(ctx: UrbanPlazaBuildingsContext): void {
  const bs = CENTRAL_PARK_MASTERPLAN.beautySalon;
  const grp = new THREE.Group();
  grp.name = 'UrbanPlazaBeautySalon3D';
  grp.position.set(bs.x, 0, bs.z);
  grp.rotation.y = bs.yaw;
  ctx.staticGroup.add(grp);

  // Unbaked mirror group in animatedGroup so all transparent 1F & lit 2F glass meshes keep cityWindowSpec
  const glassHost = new THREE.Group();
  glassHost.name = 'UrbanPlazaBeautySalonGlassHost';
  glassHost.position.set(bs.x, 0, bs.z);
  glassHost.rotation.y = bs.yaw;
  ctx.animatedGroup.add(glassHost);

  const clearStorefrontGlassMat = new THREE.MeshStandardMaterial({
    color: '#d6f4ff',
    transparent: true,
    opacity: 0.28,
    roughness: 0.08,
    metalness: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  attachClearStorefrontGlassNightShader(clearStorefrontGlassMat, { yMin: 0.88, yMax: 3.46 });
  ctx.registerMat(clearStorefrontGlassMat);

  // Procedural CanvasTextures
  const blushStoneTex = createBlushSandstoneTexture(ctx);
  const stuccoTex = createCreamStuccoTexture(ctx);
  const oakTex = createHoneyOakTimberTexture(ctx);
  const floorTex = createSalonTerrazzoFloorTexture(ctx);
  const turfTex = createSalonRooftopTurfTexture(ctx);
  const casementGlowTex = createWarmWindowGlowTexture(ctx, 'casement');
  const glowStudioSignTex = createSalonSignTexture(ctx, 'GLOW STUDIO', 96);
  const beautyGlowSignTex = createSalonSignTexture(ctx, 'BEAUTY & GLOW', 82);
  const beautyCareSignTex = createSalonSignTexture(ctx, 'BEAUTY & CARE', 82);
  const chalkTex = createSalonChalkboardTexture(ctx);

  const gfH = bs.groundFloorHeight; // 4.92
  const sfH = bs.secondFloorHeight; // 8.35
  const recvShadow = !ctx.isSoftwareGl;

  // =========================================================================
  // 1. GROUND FLOOR PODIUM, CURVED PANORAMIC WINDOWS & FACADE ("GLOW STUDIO")
  // =========================================================================

  // Continuous curved-corner blush-stone ground plinth (y = 0.00 .. 0.26m)
  const plinthGeo = createCurvedPodiumSlabGeo(0.06, 0.0, 0.26, 0.014);
  ctx.applyPlanarUvs(plinthGeo, 2.0);
  ctx.addPart(grp, plinthGeo, '#ffffff', [0, 0, 0], [0, 0, 0], {
    map: blushStoneTex,
    castShadow: recvShadow,
    receiveShadow: recvShadow,
  });

  // Curved panoramic window span: Left (-X, z=-1.65) -> Front-Left curve -> Front (+Z, x=+1.25)
  const showcaseCurve = sampleCornerWindowCurve(-1.65, 1.25, 18, 2);

  // Curved blush-stone lower bulkhead (y = 0.24 .. 0.74m) + molded overhanging sill (y = 0.70 .. 0.82m)
  ctx.addPart(grp, createSweptCurvePrismGeo(showcaseCurve, -0.24, 0.0, 0.24, 0.74, 1.8), '#ffffff', [0, 0, 0], [0, 0, 0], {
    map: blushStoneTex,
    castShadow: recvShadow,
    receiveShadow: recvShadow,
  });
  ctx.addPart(grp, createSweptCurvePrismGeo(showcaseCurve, -0.26, 0.065, 0.70, 0.82, 1.8), '#ffffff', [0, 0, 0], [0, 0, 0], {
    map: blushStoneTex,
    castShadow: recvShadow,
    receiveShadow: recvShadow,
  });
  // Curved oak bottom & top window frame rails
  ctx.addPart(grp, createSweptCurvePrismGeo(showcaseCurve, -0.13, -0.02, 0.82, 0.88, 1.4), '#ffffff', [0, 0, 0], [0, 0, 0], {
    map: oakTex,
    receiveShadow: recvShadow,
  });
  ctx.addPart(grp, createSweptCurvePrismGeo(showcaseCurve, -0.13, -0.02, 3.46, 3.53, 1.4), '#ffffff', [0, 0, 0], [0, 0, 0], {
    map: oakTex,
    receiveShadow: recvShadow,
  });
  // Curved blush-stone window head lintel (y = 3.52 .. 3.74m)
  ctx.addPart(grp, createSweptCurvePrismGeo(showcaseCurve, -0.24, 0.04, 3.52, 3.74, 1.8), '#ffffff', [0, 0, 0], [0, 0, 0], {
    map: blushStoneTex,
    castShadow: recvShadow,
    receiveShadow: recvShadow,
  });

  // Split panoramic transparent 3D glass into 5 clean seamless segments tagged with cityWindowSpec
  const splitCurves: ReadonlyArray<{ pts: CurvePointXZ[]; id: string }> = [
    { pts: showcaseCurve.slice(0, 3), id: 'beauty-salon-1f-glass-left' },
    { pts: showcaseCurve.slice(2, 12), id: 'beauty-salon-1f-glass-curve-a' },
    { pts: showcaseCurve.slice(11, 21), id: 'beauty-salon-1f-glass-curve-b' },
    { pts: showcaseCurve.slice(20, 22), id: 'beauty-salon-1f-glass-front-a' },
    { pts: showcaseCurve.slice(21, 23), id: 'beauty-salon-1f-glass-front-b' },
  ];
  splitCurves.forEach((seg, idx) => {
    const glassGeo = createSweptCurvePrismGeo(seg.pts, -0.095, -0.065, 0.88, 3.46, 2.0, true);
    ctx.registerGeo(glassGeo);
    const glassMesh = new THREE.Mesh(glassGeo, clearStorefrontGlassMat);
    glassMesh.castShadow = false;
    glassMesh.receiveShadow = false;
    tagCityWindowMesh(
      glassMesh,
      createCityWindowSpec(seg.id, 'storefront', '#d6f4ff', 1, idx),
    );
    glassHost.add(glassMesh);
  });

  // Champagne-oak vertical mullions along the panoramic curve (at exact segment seams + midpoints)
  const mullionSampleIndices = [0, 2, 11, 20, 21, 22];
  for (const mIdx of mullionSampleIndices) {
    const pt = showcaseCurve[mIdx];
    const isEndJamb = mIdx === 0 || mIdx === showcaseCurve.length - 1;
    const yaw = Math.atan2(pt.nx, pt.nz);
    const mW = isEndJamb ? 0.11 : 0.068;
    const mD = isEndJamb ? 0.26 : 0.115;
    const off = isEndJamb ? -0.13 : -0.075;
    ctx.addPart(
      grp,
      applyGrainUvs(createBeveledBox(mW, 2.70, mD, 0.008), 'y', 1.4),
      '#ffffff',
      [pt.x + pt.nx * off, 2.17, pt.z + pt.nz * off],
      [0, yaw, 0],
      { map: oakTex, castShadow: true },
    );
  }

  // 1F Solid Stucco Walls & Entrance Doorways (x in [-4.40..+4.40], z in [-3.40..+3.40], y = 0.24..3.74m)
  const wallH = 3.50;
  const wallCenterY = 0.24 + wallH * 0.5;
  const addStuccoWall = (w: number, h: number, d: number, pos: [number, number, number]) => {
    ctx.addPart(
      grp,
      ctx.applyPlanarUvs(createBeveledBox(w, h, d, 0.012), 2.2),
      '#ffffff',
      pos,
      [0, 0, 0],
      { map: stuccoTex, castShadow: true, receiveShadow: true },
    );
  };

  // Front (+Z = +3.40) divider pier between curved glass (+1.25) and front doorway (+1.62), header & right corner pier
  addStuccoWall(0.37, wallH, 0.26, [1.435, wallCenterY, PODIUM_HALF_D - 0.13]);
  addStuccoWall(1.82, 0.22, 0.26, [2.53, 3.63, PODIUM_HALF_D - 0.13]);
  addStuccoWall(0.76, wallH, 0.26, [3.82, wallCenterY, PODIUM_HALF_D - 0.13]);
  // Right (+X = +4.20) side profile piers flanking centered side doorway (z in [-0.88 .. +0.88])
  addStuccoWall(0.26, wallH, 2.52, [PODIUM_HALF_W - 0.13, wallCenterY, 2.14]);
  addStuccoWall(0.26, wallH, 2.52, [PODIUM_HALF_W - 0.13, wallCenterY, -2.14]);
  addStuccoWall(0.26, 0.24, 1.76, [PODIUM_HALF_W - 0.13, 3.62, 0]);
  // Left (-X = -4.20) rear pier sealing from panoramic window (-1.65) to rear corner (-3.40)
  addStuccoWall(0.26, wallH, 1.75, [-PODIUM_HALF_W + 0.13, wallCenterY, -2.525]);
  // Rear (-Z = -3.40) walls flanking centered rear glazed doorway (x in [-0.82 .. +0.82])
  addStuccoWall(3.38, wallH, 0.26, [-2.51, wallCenterY, -PODIUM_HALF_D + 0.13]);
  addStuccoWall(3.38, wallH, 0.26, [2.51, wallCenterY, -PODIUM_HALF_D + 0.13]);
  addStuccoWall(1.64, 0.24, 0.26, [0, 3.62, -PODIUM_HALF_D + 0.13]);

  // Modern Wood & Glass Entrance Doorways + Sleek Cream Awnings + Brass C-Handles
  buildModernGlazedDoorway(grp, glassHost, ctx, {
    pos: [2.53, 0.0, PODIUM_HALF_D - 0.06],
    rotY: 0,
    width: 1.80,
    height: 3.48,
    windowId: 'beauty-salon-1f-door-front',
    windowCol: 10,
    clearGlassMat: clearStorefrontGlassMat,
    oakTex,
    handleOnLeft: true,
  });
  buildSleekCreamAwning(grp, ctx, 2.10, 0.78, 0.28, [2.53, 3.74, PODIUM_HALF_D], 0);

  buildModernGlazedDoorway(grp, glassHost, ctx, {
    pos: [PODIUM_HALF_W - 0.06, 0.0, 0.0],
    rotY: Math.PI * 0.5,
    width: 1.74,
    height: 3.46,
    windowId: 'beauty-salon-1f-door-side',
    windowCol: 11,
    clearGlassMat: clearStorefrontGlassMat,
    oakTex,
    handleOnLeft: false,
  });
  buildSleekCreamAwning(grp, ctx, 2.02, 0.74, 0.28, [PODIUM_HALF_W, 3.74, 0.0], Math.PI * 0.5);

  buildModernGlazedDoorway(grp, glassHost, ctx, {
    pos: [0.0, 0.0, -PODIUM_HALF_D + 0.06],
    rotY: Math.PI,
    width: 1.62,
    height: 3.46,
    windowId: 'beauty-salon-1f-door-rear',
    windowCol: 12,
    clearGlassMat: clearStorefrontGlassMat,
    oakTex,
    handleOnLeft: true,
  });
  buildSleekCreamAwning(grp, ctx, 1.92, 0.72, 0.28, [0.0, 3.74, -PODIUM_HALF_D], Math.PI);

  // Continuous 1F Curved Architrave, "GLOW STUDIO" Frieze Band & Projecting 2F Balcony Cornice (`y = 3.54..4.94m`)
  const architraveGeo = createCurvedPodiumRingGeo(-0.24, 0.075, 3.56, 3.74, 0.008);
  ctx.applyPlanarUvs(architraveGeo, 2.0);
  ctx.addPart(grp, architraveGeo, '#ffffff', [0, 0, 0], [0, 0, 0], {
    map: blushStoneTex,
    castShadow: recvShadow,
    receiveShadow: recvShadow,
  });

  const friezeGeo = createCurvedPodiumRingGeo(-0.24, 0.02, 3.74, 4.68, 0.008);
  ctx.applyPlanarUvs(friezeGeo, 2.2);
  ctx.addPart(grp, friezeGeo, '#ffffff', [0, 0, 0], [0, 0, 0], {
    map: stuccoTex,
    castShadow: recvShadow,
    receiveShadow: recvShadow,
  });

  const corniceMidGeo = createCurvedPodiumRingGeo(-0.24, 0.12, 4.68, 4.82, 0.010);
  ctx.applyPlanarUvs(corniceMidGeo, 2.0);
  ctx.addPart(grp, corniceMidGeo, '#ffffff', [0, 0, 0], [0, 0, 0], {
    map: blushStoneTex,
    castShadow: recvShadow,
    receiveShadow: recvShadow,
  });

  // 2F Balcony Terrace Slab (`y = 4.82 .. 4.94m`, projecting `+0.18m` outward)
  const terraceSlabGeo = createCurvedPodiumSlabGeo(0.18, 4.82, gfH + 0.02, 0.012);
  ctx.applyPlanarUvs(terraceSlabGeo, 2.0);
  ctx.addPart(grp, terraceSlabGeo, '#e9d7c5', [0, 0, 0], [0, 0, 0], {
    map: blushStoneTex,
    castShadow: recvShadow,
    receiveShadow: recvShadow,
  });

  // Crisp "GLOW STUDIO" Signboards on Front (+Z) & Left (-X) Frieze
  ctx.addPart(grp, new THREE.PlaneGeometry(4.30, 0.70), '#ffffff', [0.68, 4.21, PODIUM_HALF_D + 0.042], [0, 0, 0], {
    map: glowStudioSignTex,
  });
  ctx.addPart(grp, createMiteredSignFrameGeo(4.30, 0.70, 0.06, 0.03), COL_SALON_BLUSH_DARK, [0.68, 4.21, PODIUM_HALF_D + 0.028]);

  ctx.addPart(grp, new THREE.PlaneGeometry(3.30, 0.70), '#ffffff', [-PODIUM_HALF_W - 0.042, 4.21, -0.82], [0, -Math.PI * 0.5, 0], {
    map: glowStudioSignTex,
  });
  ctx.addPart(grp, createMiteredSignFrameGeo(3.30, 0.70, 0.06, 0.03), COL_SALON_BLUSH_DARK, [-PODIUM_HALF_W - 0.028, 4.21, -0.82], [0, -Math.PI * 0.5, 0]);

  // Glowing Sconces, Topiary Trees, Rainwater Downspout & 2 Sidewalk A-Frame Chalkboard Easels
  buildBeautyWallSconce(grp, ctx, [3.84, 2.34, PODIUM_HALF_D], 0);
  buildBeautyWallSconce(grp, ctx, [1.44, 2.34, PODIUM_HALF_D], 0);
  buildBeautyWallSconce(grp, ctx, [PODIUM_HALF_W, 2.34, -1.16], Math.PI * 0.5);
  buildBeautyWallSconce(grp, ctx, [PODIUM_HALF_W, 2.34, 1.16], Math.PI * 0.5);
  buildBeautyWallSconce(grp, ctx, [PODIUM_HALF_W, 2.34, 2.85], Math.PI * 0.5);
  buildBeautyWallSconce(grp, ctx, [PODIUM_HALF_W, 2.34, -2.85], Math.PI * 0.5);
  buildBeautyWallSconce(grp, ctx, [-PODIUM_HALF_W, 2.34, -2.50], -Math.PI * 0.5);
  buildBeautyWallSconce(grp, ctx, [-1.18, 2.34, -PODIUM_HALF_D], Math.PI);
  buildBeautyWallSconce(grp, ctx, [1.18, 2.34, -PODIUM_HALF_D], Math.PI);

  buildRainwaterDownspout(grp, ctx, [PODIUM_HALF_W, 0.0, -1.78], Math.PI * 0.5, 4.74);

  // Spherical topiaries flanking doorways and corners (stone pots)
  const topiarySpots: readonly [number, number][] = [
    [3.84, PODIUM_HALF_D + 0.40],
    [1.38, PODIUM_HALF_D + 0.40],
    [PODIUM_HALF_W + 0.40, -1.24],
    [PODIUM_HALF_W + 0.40, 1.24],
    [PODIUM_HALF_W + 0.40, -2.95],
    [-PODIUM_HALF_W - 0.40, -2.50],
    [-1.24, -PODIUM_HALF_D - 0.40],
    [1.24, -PODIUM_HALF_D - 0.40],
  ];
  for (const [tx, tz] of topiarySpots) {
    buildUrnBoxwoodPlanter(grp, ctx, [tx, 0.02, tz], 0.96, 'sphere', '#d5baaa');
  }

  // 2 Sidewalk A-Frame Chalkboard Easels near the curved storefront corner
  buildSidewalkChalkboardEasel(grp, ctx, [-0.65, 0.02, PODIUM_HALF_D + 0.58], -0.22, chalkTex, oakTex);
  buildSidewalkChalkboardEasel(grp, ctx, [-PODIUM_HALF_W - 0.58, 0.02, -0.15], -Math.PI * 0.5 + 0.22, chalkTex, oakTex);

  // Visible Interior Salon Showcase
  buildSalonInteriorFixtures(grp, ctx, oakTex, floorTex);

  // =========================================================================
  // 2. 2ND FLOOR WRAP-AROUND BALCONY TERRACE & INSET UPPER STORY
  // =========================================================================
  const deckY = gfH + 0.02; // 4.94

  // Continuous curved-corner stone parapet curb + dark-bronze top/bottom balustrade rails
  const terraceCurbGeo = createCurvedPodiumRingGeo(0.0, 0.14, deckY, deckY + 0.14, 0.008);
  ctx.applyPlanarUvs(terraceCurbGeo, 1.8);
  ctx.addPart(grp, terraceCurbGeo, '#ffffff', [0, 0, 0], [0, 0, 0], {
    map: blushStoneTex,
    castShadow: recvShadow,
    receiveShadow: recvShadow,
  });

  const railBottomGeo = createCurvedPodiumRingGeo(0.045, 0.095, deckY + 0.18, deckY + 0.22, 0.004);
  ctx.addPart(grp, railBottomGeo, COL_SALON_BRONZE, [0, 0, 0]);
  const railTopGeo = createCurvedPodiumRingGeo(0.04, 0.10, deckY + 0.84, deckY + 0.89, 0.006);
  ctx.addPart(grp, railTopGeo, COL_SALON_BRONZE, [0, 0, 0]);

  // Evenly spaced vertical dark-bronze pickets & posts along the curved-corner perimeter
  const railLoop = buildClosedPodiumLoop(0.07, 16);
  const picketGeo = new THREE.BoxGeometry(0.024, 0.66, 0.024);
  const postGeo = new THREE.BoxGeometry(0.052, 0.74, 0.052);
  let postCounter = 0;
  for (let i = 0; i < railLoop.length; i++) {
    const pA = railLoop[i];
    const pB = railLoop[(i + 1) % railLoop.length];
    const segLen = Math.hypot(pB.x - pA.x, pB.z - pA.z);
    const steps = Math.max(1, Math.round(segLen / 0.21));
    for (let s = 0; s < steps; s++) {
      const f = s / steps;
      const px = pA.x + (pB.x - pA.x) * f;
      const pz = pA.z + (pB.z - pA.z) * f;
      const isPost = (s === 0 && segLen > 0.35) || postCounter % 7 === 0;
      ctx.addPart(
        grp,
        isPost ? postGeo.clone() : picketGeo.clone(),
        COL_SALON_BRONZE,
        [px, deckY + (isPost ? 0.51 : 0.52), pz],
      );
      postCounter++;
    }
  }
  picketGeo.dispose();
  postGeo.dispose();

  // 2F Inset Upper Story Stucco Box (`x in [-3.25..+3.25]`, `z in [-2.30..+2.30]`, `y = 4.94..8.35m`)
  const upperW = 6.50;
  const upperD = 4.60;
  const halfUW = upperW * 0.5;
  const halfUD = upperD * 0.5;
  const upperH = sfH - deckY; // 3.41

  ctx.addPart(
    grp,
    ctx.applyPlanarUvs(createBeveledBox(upperW + 0.14, 0.18, upperD + 0.14, 0.012), 2.0),
    '#ffffff',
    [0, deckY + 0.09, 0],
    [0, 0, 0],
    { map: blushStoneTex },
  );
  ctx.addPart(
    grp,
    ctx.applyPlanarUvs(createBeveledBox(upperW, upperH - 0.24, upperD, 0.016), 2.4),
    '#ffffff',
    [0, deckY + 0.16 + (upperH - 0.24) * 0.5, 0],
    [0, 0, 0],
    { map: stuccoTex, castShadow: true, receiveShadow: true },
  );

  // 2F Tall Arched Multi-Pane Windows & French Door (Front 3 bays, Left 2 bays, Right 1 bay, Rear 2 bays)
  let upperWinIdx = 0;
  const archTheme = {
    trimHex: COL_SALON_BLUSH,
    sillHex: COL_SALON_BLUSH_DARK,
    mullionHex: COL_SALON_OAK,
    archMuntinFan: true,
    glassTex: casementGlowTex,
    glassHost,
    windowKind: 'upper_floor' as const,
    windowRow: 2,
  };

  // Front (+Z = +2.30): flanking arched windows + central French door
  for (const wx of [-1.95, 1.95]) {
    buildArchedCasementWindow(grp, ctx, {
      ...archTheme,
      pos: [wx, deckY + 0.44, halfUD],
      rotY: 0,
      width: 1.08,
      rectHeight: 1.56,
      windowId: `beauty-salon-2f-front-${upperWinIdx}`,
      windowCol: upperWinIdx++,
    });
  }
  buildArchedCasementWindow(grp, ctx, {
    ...archTheme,
    pos: [0, deckY + 0.14, halfUD],
    rotY: 0,
    width: 1.14,
    rectHeight: 1.88,
    omitSill: true,
    windowId: `beauty-salon-2f-front-door`,
    windowCol: upperWinIdx++,
  });
  for (const sx of [-0.98, 0.98]) {
    buildBeautyWallSconce(grp, ctx, [sx, deckY + 1.55, halfUD], 0);
  }

  // Left (-X = -3.45, 3/4 Isometric Show Side): 2 arched windows + sconces
  for (const wz of [-1.05, 1.05]) {
    buildArchedCasementWindow(grp, ctx, {
      ...archTheme,
      pos: [-halfUW, deckY + 0.44, wz],
      rotY: -Math.PI * 0.5,
      width: 1.06,
      rectHeight: 1.56,
      windowId: `beauty-salon-2f-left-${upperWinIdx}`,
      windowCol: upperWinIdx++,
    });
  }
  for (const sz of [-1.92, 0.0, 1.92]) {
    buildBeautyWallSconce(grp, ctx, [-halfUW, deckY + 1.55, sz], -Math.PI * 0.5);
  }

  // Right (+X = +3.45, Side Profile Elevation): 1 centered arched window w/ Juliet rail + twin sconces
  buildArchedCasementWindow(grp, ctx, {
    ...archTheme,
    pos: [halfUW, deckY + 0.44, 0],
    rotY: Math.PI * 0.5,
    width: 1.18,
    rectHeight: 1.58,
    withJulietBar: true,
    windowId: `beauty-salon-2f-right-0`,
    windowCol: upperWinIdx++,
  });
  for (const sz of [-1.12, 1.12]) {
    buildBeautyWallSconce(grp, ctx, [halfUW, deckY + 1.55, sz], Math.PI * 0.5);
  }

  // Rear (-Z = -2.30): 2 arched windows + center sconce
  for (const wx of [-1.65, 1.65]) {
    buildArchedCasementWindow(grp, ctx, {
      ...archTheme,
      pos: [wx, deckY + 0.44, -halfUD],
      rotY: Math.PI,
      width: 1.08,
      rectHeight: 1.54,
      windowId: `beauty-salon-2f-rear-${upperWinIdx}`,
      windowCol: upperWinIdx++,
    });
  }
  buildBeautyWallSconce(grp, ctx, [0, deckY + 1.55, -halfUD], Math.PI);

  // 2F Terrace Corner Potted Olive Trees & Rectangular Greenery Planter Boxes
  for (const [ox, oz] of [
    [-3.54, 2.52],
    [3.65, 2.80],
    [-3.65, -2.80],
    [3.65, -2.80],
  ] as const) {
    buildOliveTreePot(grp, ctx, [ox, deckY, oz], 0.92);
  }
  buildRooftopGardenPlanterBox(grp, ctx, bs.x, bs.z, bs.yaw, -1.52, deckY, 2.92, 1.44, 0.44, 0, oakTex);
  buildRooftopGardenPlanterBox(grp, ctx, bs.x, bs.z, bs.yaw, 1.52, deckY, 2.92, 1.44, 0.44, 0, oakTex);
  buildRooftopGardenPlanterBox(grp, ctx, bs.x, bs.z, bs.yaw, -3.76, deckY, -0.35, 1.85, 0.44, Math.PI * 0.5, oakTex);
  buildRooftopGardenPlanterBox(grp, ctx, bs.x, bs.z, bs.yaw, 3.76, deckY, 0.0, 1.85, 0.44, Math.PI * 0.5, oakTex);
  buildRooftopGardenPlanterBox(grp, ctx, bs.x, bs.z, bs.yaw, 0.0, deckY, -2.92, 2.10, 0.44, 0, oakTex);

  // =========================================================================
  // 3. TOP CROWN CORNICE, ATTIC PARAPET ("BEAUTY & GLOW" / "BEAUTY & CARE") & ROOFTOP GARDEN
  // =========================================================================
  ctx.addPart(
    grp,
    ctx.applyPlanarUvs(createBeveledBox(upperW + 0.24, 0.14, upperD + 0.24, 0.014), 2.0),
    '#ffffff',
    [0, sfH - 0.14, 0],
    [0, 0, 0],
    { map: blushStoneTex, castShadow: recvShadow, receiveShadow: recvShadow },
  );
  ctx.addPart(
    grp,
    ctx.applyPlanarUvs(createBeveledBox(upperW + 0.46, 0.16, upperD + 0.46, 0.014), 2.0),
    '#ffffff',
    [0, sfH, 0],
    [0, 0, 0],
    { map: blushStoneTex, castShadow: recvShadow, receiveShadow: recvShadow },
  );

  // Continuous 45-degree mitered attic parapet wall (`y = 8.42 .. 9.58m`) + coping cap (`y = 9.56 .. 9.70m`)
  ctx.addPart(
    grp,
    ctx.applyPlanarUvs(createMiteredPerimeterCurbGeo(upperW + 0.18, upperD + 0.18, 0.24, 1.14), 2.2),
    '#ffffff',
    [0, 9.01, 0],
    [0, 0, 0],
    { map: stuccoTex, castShadow: recvShadow, receiveShadow: recvShadow },
  );
  ctx.addPart(
    grp,
    ctx.applyPlanarUvs(createMiteredPerimeterCurbGeo(upperW + 0.36, upperD + 0.36, 0.32, 0.14), 2.0),
    '#ffffff',
    [0, 9.63, 0],
    [0, 0, 0],
    { map: blushStoneTex, castShadow: recvShadow, receiveShadow: recvShadow },
  );

  // Top Parapet Signage: "BEAUTY & GLOW" (Front + Rear) and "BEAUTY & CARE" (Left 3/4 Isometric side)
  ctx.addPart(grp, new THREE.PlaneGeometry(5.30, 0.72), '#ffffff', [0, 9.01, halfUD + 0.114], [0, 0, 0], {
    map: beautyGlowSignTex,
  });
  ctx.addPart(grp, createMiteredSignFrameGeo(5.30, 0.72, 0.055, 0.026), COL_SALON_BLUSH_DARK, [0, 9.01, halfUD + 0.100]);
  ctx.addPart(grp, new THREE.PlaneGeometry(5.30, 0.72), '#ffffff', [0, 9.01, -halfUD - 0.114], [0, Math.PI, 0], {
    map: beautyGlowSignTex,
  });
  ctx.addPart(grp, createMiteredSignFrameGeo(5.30, 0.72, 0.055, 0.026), COL_SALON_BLUSH_DARK, [0, 9.01, -halfUD - 0.100], [0, Math.PI, 0]);
  ctx.addPart(grp, new THREE.PlaneGeometry(3.70, 0.72), '#ffffff', [-halfUW - 0.114, 9.01, 0], [0, -Math.PI * 0.5, 0], {
    map: beautyCareSignTex,
  });
  ctx.addPart(grp, createMiteredSignFrameGeo(3.70, 0.72, 0.055, 0.026), COL_SALON_BLUSH_DARK, [-halfUW - 0.100, 9.01, 0], [0, -Math.PI * 0.5, 0]);

  // Walkable Landscaped Rooftop Garden
  buildSalonRooftopGarden(grp, ctx, bs.x, bs.z, bs.yaw, oakTex, turfTex);
}
