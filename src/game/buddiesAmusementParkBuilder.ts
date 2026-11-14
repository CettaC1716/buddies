import * as THREE from 'three';
import type { BlitzWindUniforms } from './buddiesBlitzShadersAndAssets';
import {
  AMUSEMENT_PARK_PALM_TREES,
  BIANGLALA_GONDOLA_PALETTE,
  BUMPER_CAR_PALETTE,
  CARNIVAL_MIDWAY_STALLS,
  COASTAL_AMUSEMENT_PARK_MASTERPLAN,
  CarnivalStallSpec,
  evaluateAmusementParkRideKinematics,
} from './buddiesAmusementParkRules';

export interface BuildCoastalAmusementParkOptions {
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

export interface CoastalAmusementParkHandle {
  group: THREE.Group;
  update: (timeSec: number) => void;
  dispose: () => void;
}

// ============================================================================
// METRIC VERTEX UV & PROCEDURAL ARCHITECTURAL GEOMETRY HELPERS
// (BlitzWorldMaterial samples raw vertex `uv`, so UVs must be scaled in geometry!)
// ============================================================================

/**
 * Recomputes world-metric planar UVs on a BoxGeometry so textures tile at exact
 * physical meter scales across arbitrarily sized boxes without stretching!
 */
export function applyBoxMetricUvs(
  geo: THREE.BoxGeometry,
  tileMetersU: number,
  tileMetersV: number,
  swapTopAxes = false,
  originX = 0,
  originZ = 0,
): THREE.BoxGeometry {
  const pos = geo.getAttribute('position');
  const norm = geo.getAttribute('normal');
  const uv = geo.getAttribute('uv');
  if (!pos || !norm || !uv) return geo;

  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i) + originX;
    const y = pos.getY(i);
    const wz = pos.getZ(i) + originZ;
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));

    let u = 0;
    let v = 0;
    if (ny >= nx && ny >= nz) {
      // Top / Bottom faces: continuous world planar (X, Z)
      u = (swapTopAxes ? wz : wx) / tileMetersU;
      v = (swapTopAxes ? wx : wz) / tileMetersV;
    } else if (nx >= ny && nx >= nz) {
      // +X / -X side faces: planar (Z, Y)
      u = wz / tileMetersU;
      v = y / tileMetersV;
    } else {
      // +Z / -Z front/back faces: planar (X, Y)
      u = wx / tileMetersU;
      v = y / tileMetersV;
    }
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * Scales cylinder side UVs by (repeatU, repeatV) while mapping top/bottom caps
 * cleanly in continuous world-metric planar coordinates.
 */
export function applyCylinderMetricUvs(
  geo: THREE.CylinderGeometry,
  sideRepeatU: number,
  sideRepeatV: number,
  capTileMeters = 2.4,
  originX = 0,
  originZ = 0,
): THREE.CylinderGeometry {
  const pos = geo.getAttribute('position');
  const norm = geo.getAttribute('normal');
  const uv = geo.getAttribute('uv');
  if (!pos || !norm || !uv) return geo;

  for (let i = 0; i < pos.count; i++) {
    const ny = Math.abs(norm.getY(i));
    if (ny > 0.75) {
      uv.setXY(
        i,
        (pos.getX(i) + originX) / capTileMeters,
        (pos.getZ(i) + originZ) / capTileMeters,
      );
    } else {
      uv.setXY(i, uv.getX(i) * sideRepeatU, uv.getY(i) * sideRepeatV);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * Builds a single-color gore slice of a concave circus/carousel conical canopy
 * (zero ConeGeometry apex UV distortion, graceful catenary sag, and clean normals!).
 */
export function createConcaveCanopyGoreGeometry(
  radius: number,
  height: number,
  angle0: number,
  angle1: number,
  sagAmount = 0.22,
  radialSteps = 7,
  subSlices = 2,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];

  const samplePoint = (t: number, a: number): [number, number, number] => {
    // t = 0 at apex (0, height, 0), t = 1 at outer eave (radius, 0, ...)
    const r = radius * Math.pow(t, 0.96);
    const catenarySag = sagAmount * Math.sin(t * Math.PI);
    const y = height * (1 - t) - catenarySag;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  };

  for (let s = 0; s < subSlices; s++) {
    const aL = angle0 + ((angle1 - angle0) * s) / subSlices;
    const aR = angle0 + ((angle1 - angle0) * (s + 1)) / subSlices;

    for (let r = 0; r < radialSteps; r++) {
      const t0 = r / radialSteps;
      const t1 = (r + 1) / radialSteps;

      const p00 = samplePoint(t0, aL);
      const p01 = samplePoint(t0, aR);
      const p10 = samplePoint(t1, aL);
      const p11 = samplePoint(t1, aR);

      // Counter-clockwise outer upward winding
      if (r === 0) {
        positions.push(...p00, ...p11, ...p10);
        uvs.push(0.5, 1, 1, 1 - t1, 0, 1 - t1);
      } else {
        positions.push(...p00, ...p01, ...p11);
        uvs.push(0, 1 - t0, 1, 1 - t0, 1, 1 - t1);
        positions.push(...p00, ...p11, ...p10);
        uvs.push(0, 1 - t0, 1, 1 - t1, 0, 1 - t1);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a crisp striped pyramidal/hipped carnival tent canopy with ZERO affine UV
 * triangle-pinch distortion by subdividing each of the 4 sloped roof faces into
 * exact vertical stripe bands + scalloped perimeter valance tabs!
 */
function addStripedCarnivalTentRoof(
  parent: THREE.Group,
  halfW: number,
  halfD: number,
  eaveY: number,
  peakH: number,
  primaryHex: string,
  secondaryHex: string,
  makePart: (
    geo: THREE.BufferGeometry,
    colorHex: string,
    opts?: {
      map?: THREE.Texture;
      strokeWidth?: number;
      castShadow?: boolean;
      receiveShadow?: boolean;
    },
  ) => THREE.Mesh,
) {
  const stripesPerSide = 7;
  const apex: [number, number, number] = [0, eaveY + peakH, 0];

  const buildSlopedFace = (
    c0: [number, number, number],
    c1: [number, number, number],
  ) => {
    const posPrimary: number[] = [];
    const posSecondary: number[] = [];

    for (let i = 0; i < stripesPerSide; i++) {
      const u0 = i / stripesPerSide;
      const u1 = (i + 1) / stripesPerSide;
      const e0: [number, number, number] = [
        c0[0] + (c1[0] - c0[0]) * u0,
        eaveY,
        c0[2] + (c1[2] - c0[2]) * u0,
      ];
      const e1: [number, number, number] = [
        c0[0] + (c1[0] - c0[0]) * u1,
        eaveY,
        c0[2] + (c1[2] - c0[2]) * u1,
      ];
      const bucket = i % 2 === 0 ? posPrimary : posSecondary;
      bucket.push(...apex, ...e0, ...e1);
    }

    return { posPrimary, posSecondary };
  };

  // 4 corners around Y (CCW from top: NW -> SW -> SE -> NE so apex->c0->c1 faces outward!)
  const nw: [number, number, number] = [-halfW, eaveY, -halfD];
  const sw: [number, number, number] = [-halfW, eaveY, halfD];
  const se: [number, number, number] = [halfW, eaveY, halfD];
  const ne: [number, number, number] = [halfW, eaveY, -halfD];

  const allPri: number[] = [];
  const allSec: number[] = [];
  for (const [pA, pB] of [
    [nw, sw],
    [sw, se],
    [se, ne],
    [ne, nw],
  ] as const) {
    const res = buildSlopedFace(pA, pB);
    allPri.push(...res.posPrimary);
    allSec.push(...res.posSecondary);
  }

  for (const [arr, hex] of [
    [allPri, primaryHex],
    [allSec, secondaryHex],
  ] as const) {
    if (arr.length === 0) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    g.computeVertexNormals();
    // Open sheet roof: strokeWidth 0 prevents BackSide black stroke bleed when viewed from below
    parent.add(makePart(g, hex, { strokeWidth: 0 }));
  }

  // Warm canvas soffit underside closing the eave base cleanly from below
  const soffit = makePart(
    new THREE.BoxGeometry(halfW * 2 - 0.06, 0.06, halfD * 2 - 0.06),
    secondaryHex,
    { strokeWidth: 0.012, castShadow: false },
  );
  soffit.position.set(0, eaveY - 0.01, 0);
  parent.add(soffit);

  // Crisp 3D Scalloped Valance Flaps hanging along all 4 eaves
  const flapH = 0.34;
  const tabGeoW = (halfW * 2) / stripesPerSide;
  const tabGeoD = (halfD * 2) / stripesPerSide;
  for (let i = 0; i < stripesPerSide; i++) {
    const col = i % 2 === 0 ? primaryHex : secondaryHex;
    const fx = -halfW + (i + 0.5) * tabGeoW;
    for (const sz of [-1, 1] as const) {
      const tab = makePart(new THREE.BoxGeometry(tabGeoW + 0.01, flapH, 0.07), col, {
        strokeWidth: 0.014,
      });
      tab.position.set(fx, eaveY - flapH * 0.5 + 0.02, sz * (halfD - 0.03));
      parent.add(tab);
    }
    const fz = -halfD + (i + 0.5) * tabGeoD;
    for (const sx of [-1, 1] as const) {
      const tab = makePart(new THREE.BoxGeometry(0.07, flapH, tabGeoD + 0.01), col, {
        strokeWidth: 0.014,
      });
      tab.position.set(sx * (halfW - 0.03), eaveY - flapH * 0.5 + 0.02, fz);
      parent.add(tab);
    }
  }
}

/**
 * Builds a smooth, continuous carvel-planked 3D Pirate Galleon Hull (zero boxy stair-stepping!),
 * lofted across 22 longitudinal stations x 13 transverse U-rib frames with sweeping sheerline,
 * curved tumblehome bulwarks, keel spine, and planked UVs!
 */
export function createLoftedGalleonHullGeometry(
  length: number,
  maxBeam: number,
): THREE.BufferGeometry {
  const zSteps = 22;
  const uSteps = 12; // cross-section from port gunwale (-1) -> keel (0) -> starboard gunwale (+1)
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const getHullPoint = (sFrac: number, cFrac: number): [number, number, number] => {
    // sFrac in [0..1] along Z (-length/2 .. +length/2), cFrac in [-1..+1] across section
    const zn = (sFrac - 0.5) * 2.0; // -1 (North Bow) .. +1 (South Stern)
    const z = zn * (length * 0.5);

    // Taper smoothly to a sharp bow at zn = -1 and a rounded transom stern at zn = +1
    const bowSternTaper =
      zn < 0
        ? Math.pow(Math.max(0.04, 1.0 - Math.pow(-zn, 1.85)), 0.78)
        : Math.pow(Math.max(0.28, 1.0 - Math.pow(zn, 2.35) * 0.66), 0.75);

    const halfW = (maxBeam * 0.5) * bowSternTaper;
    const sheerY = Math.pow(Math.abs(zn), 2.05) * 2.05 + (zn > 0 ? zn * 0.32 : 0);
    const keelY = -1.18 + Math.pow(Math.abs(zn), 2.4) * 0.95;

    // Cross-sectional U-rib profile from keel (cFrac=0) to gunwale (|cFrac|=1)
    const a = Math.abs(cFrac);
    const sign = cFrac < 0 ? -1 : 1;
    // Slight tumblehome curve near gunwale
    const widthProfile = Math.sin(a * Math.PI * 0.54) / Math.sin(Math.PI * 0.54);
    const x = sign * halfW * widthProfile;
    const y = keelY + (sheerY - keelY) * Math.pow(a, 1.65);
    return [x, y, z];
  };

  for (let iz = 0; iz <= zSteps; iz++) {
    const sFrac = iz / zSteps;
    for (let iu = 0; iu <= uSteps; iu++) {
      const cFrac = (iu / uSteps) * 2.0 - 1.0;
      const [x, y, z] = getHullPoint(sFrac, cFrac);
      positions.push(x, y, z);
      uvs.push(sFrac * 4.5, (iu / uSteps) * 2.0);
    }
  }

  const rowStride = uSteps + 1;
  for (let iz = 0; iz < zSteps; iz++) {
    for (let iu = 0; iu < uSteps; iu++) {
      const a = iz * rowStride + iu;
      const b = a + 1;
      const c = (iz + 1) * rowStride + iu;
      const d = c + 1;
      // Outward-facing CCW hull winding: (-X on port, -Y at keel, +X on starboard)
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  // Close the curved recessed inner deck & transom stern so hull is 100% solid watertight!
  const deckBaseIdx = positions.length / 3;
  for (let iz = 0; iz <= zSteps; iz++) {
    const sFrac = iz / zSteps;
    const [xPort, yGunwale, z] = getHullPoint(sFrac, -1);
    const [xStar] = getHullPoint(sFrac, 1);
    const deckY = yGunwale - 0.32;
    positions.push(xPort * 0.92, deckY, z);
    uvs.push(sFrac * 4.5, 0.2);
    positions.push(xStar * 0.92, deckY, z);
    uvs.push(sFrac * 4.5, 0.8);
  }
  for (let iz = 0; iz < zSteps; iz++) {
    const p0 = deckBaseIdx + iz * 2;
    const s0 = p0 + 1;
    const p1 = p0 + 2;
    const s1 = p0 + 3;
    // Upward-facing (+Y) inner deck winding
    indices.push(p0, p1, s0);
    indices.push(s0, p1, s1);

    // Connect inner gunwale lip down to deck on Port (+X inward) & Starboard (-X inward)
    const outerPort0 = iz * rowStride;
    const outerPort1 = (iz + 1) * rowStride;
    indices.push(outerPort0, outerPort1, p0);
    indices.push(p0, outerPort1, p1);

    const outerStar0 = iz * rowStride + uSteps;
    const outerStar1 = (iz + 1) * rowStride + uSteps;
    indices.push(outerStar0, s0, outerStar1);
    indices.push(s0, s1, outerStar1);
  }

  // Outward-facing (+Z) Transom stern cap (iz = zSteps)
  const sternRingStart = zSteps * rowStride;
  const sternCenterIdx = positions.length / 3;
  const [, sternTopY, sternZ] = getHullPoint(1.0, 1.0);
  positions.push(0, sternTopY - 0.35, sternZ);
  uvs.push(0.5, 0.5);
  for (let iu = 0; iu < uSteps; iu++) {
    indices.push(sternCenterIdx, sternRingStart + iu, sternRingStart + iu + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  const nonIdx = geo.toNonIndexed();
  geo.dispose();
  nonIdx.computeVertexNormals();
  return nonIdx;
}

/**
 * Builds an authentic drooping pinnate tropical coconut palm frond geometry
 * (arched central rachis spine + 9 pairs of V-folded drooping feather leaflets!).
 */
export function createPalmFrondGeometry(length = 3.25, maxWidth = 0.86): THREE.BufferGeometry {
  const segs = 9;
  const positions: number[] = [];

  const spinePt = (t: number): [number, number, number] => {
    // Extends outward along +X, rising gently then cascading gracefully downward
    const x = t * length;
    const y = Math.sin(t * Math.PI * 0.72) * 0.58 - Math.pow(t, 2.25) * 1.38;
    return [x, y, 0];
  };

  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const [x0, y0] = spinePt(t0);
    const [x1, y1] = spinePt(t1);
    const xm = (x0 + x1) * 0.5 + 0.08;

    const env = Math.sin(Math.pow(t0 + 0.06, 0.72) * Math.PI);
    const w = maxWidth * Math.max(0.14, env);
    const droopY = (y0 + y1) * 0.5 - w * 0.38;

    // Left pinnate leaflet blade (two-sided via upper & slight ridge)
    positions.push(x0, y0, 0, xm, droopY, -w, x1, y1, 0);
    positions.push(x0, y0 - 0.03, 0, x1, y1 - 0.03, 0, xm, droopY - 0.02, -w);

    // Right pinnate leaflet blade
    positions.push(x0, y0, 0, x1, y1, 0, xm, droopY, w);
    positions.push(x0, y0 - 0.03, 0, xm, droopY - 0.02, w, x1, y1 - 0.03, 0);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

// ============================================================================
// HIGH-RESOLUTION 1024PX HAND-PAINTED PROCEDURAL CANVAS TEXTURES
// ============================================================================

function createBoardwalkPlankTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#d9b37c';
    ctx.fillRect(0, 0, 1024, 1024);

    const rows = 16; // Mapped at 4.0m tileV -> each plank = exact 0.25m realistic width!
    const rowH = 1024 / rows;
    for (let r = 0; r < rows; r++) {
      const y = r * rowH;
      const tone = ((r * 53 + 11) % 7) - 3;
      const cr = 216 + tone * 5;
      const cg = 175 + tone * 4;
      const cb = 119 + tone * 3;
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctx.fillRect(0, y + 2, 1024, rowH - 4);

      // Warm sunlit top plank bevel highlight + shaded lower bevel
      ctx.fillStyle = 'rgba(255, 243, 214, 0.34)';
      ctx.fillRect(0, y + 3, 1024, 3);
      ctx.fillStyle = 'rgba(110, 68, 30, 0.24)';
      ctx.fillRect(0, y + rowH - 5, 1024, 3);

      // Fine organic wood grain fibers & knots
      for (let g = 0; g < 9; g++) {
        const gy = y + 7 + ((g * 11 + r * 5) % Math.max(8, rowH - 14));
        ctx.fillStyle = g % 2 === 0 ? 'rgba(132, 84, 38, 0.15)' : 'rgba(248, 224, 180, 0.14)';
        ctx.fillRect(0, gy, 1024, 1.6);
      }

      // Crisp dark weathered seam between planks
      ctx.fillStyle = '#6b4421';
      ctx.fillRect(0, y, 1024, 3.2);

      // Realistic staggered plank butt-joints & tiny countersunk brass deck screws
      const j1 = ((r * 293 + 96) % 820) + 102;
      const j2 = (j1 + 512) % 1024;
      for (const jx of [j1, j2]) {
        ctx.fillStyle = '#6b4421';
        ctx.fillRect(jx, y, 2.8, rowH);
        ctx.fillStyle = 'rgba(92, 56, 24, 0.65)';
        for (const sy of [0.28, 0.72]) {
          ctx.beginPath();
          ctx.arc((jx - 8 + 1024) % 1024, y + rowH * sy, 2.1, 0, Math.PI * 2);
          ctx.arc((jx + 10) % 1024, y + rowH * sy, 2.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function createHullWoodPlankTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#8b4c24';
    ctx.fillRect(0, 0, 512, 512);
    const rows = 12;
    const rowH = 512 / rows;
    for (let r = 0; r < rows; r++) {
      const y = r * rowH;
      const d = ((r * 29) % 5) - 2;
      ctx.fillStyle = `rgb(${144 + d * 6}, ${82 + d * 4}, ${38 + d * 3})`;
      ctx.fillRect(0, y + 2, 512, rowH - 3);
      ctx.fillStyle = 'rgba(255, 210, 150, 0.18)';
      ctx.fillRect(0, y + 3, 512, 2);
      ctx.fillStyle = '#4a2510';
      ctx.fillRect(0, y, 512, 2.6);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function createCobblestoneMosaicTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Seamless periodic Voronoi polygonal flagstone paving (1024x1024)!
    const gridN = 9;
    const cellPx = 1024 / gridN;
    const seeds: { x: number; y: number; tone: number; warm: number }[][] = [];

    for (let gy = 0; gy < gridN; gy++) {
      seeds[gy] = [];
      for (let gx = 0; gx < gridN; gx++) {
        const s1 = Math.sin(gx * 127.1 + gy * 311.7) * 43758.5453;
        const s2 = Math.sin(gx * 269.5 + gy * 183.3) * 24634.6345;
        const s3 = Math.sin(gx * 419.2 + gy * 71.9) * 19543.1234;
        const f1 = s1 - Math.floor(s1);
        const f2 = s2 - Math.floor(s2);
        const f3 = s3 - Math.floor(s3);
        seeds[gy][gx] = {
          x: (gx + 0.18 + f1 * 0.64) * cellPx,
          y: (gy + 0.18 + f2 * 0.64) * cellPx,
          tone: f3,
          warm: f1,
        };
      }
    }

    // Rasterize at 256x256 and upscale smoothly with crisp mortar bevels for instant generation
    const res = 256;
    const off = document.createElement('canvas');
    off.width = res;
    off.height = res;
    const octx = off.getContext('2d');
    if (octx) {
      const img = octx.createImageData(res, res);
      const data = img.data;
      const scale = 1024 / res;

      for (let py = 0; py < res; py++) {
        const wy = (py + 0.5) * scale;
        const cy = Math.floor(wy / cellPx);
        for (let px = 0; px < res; px++) {
          const wx = (px + 0.5) * scale;
          const cx = Math.floor(wx / cellPx);

          let d1 = 1e9;
          let d2 = 1e9;
          let bestTone = 0.5;
          let bestWarm = 0.5;
          let bestDx = 0;
          let bestDy = 0;

          for (let oy = -1; oy <= 1; oy++) {
            const ny = (cy + oy + gridN) % gridN;
            const wrapY = (cy + oy - ny) * cellPx;
            for (let ox = -1; ox <= 1; ox++) {
              const nx = (cx + ox + gridN) % gridN;
              const wrapX = (cx + ox - nx) * cellPx;
              const seed = seeds[ny][nx];
              const dx = wx - (seed.x + wrapX);
              const dy = wy - (seed.y + wrapY);
              const dist = Math.hypot(dx, dy);
              if (dist < d1) {
                d2 = d1;
                d1 = dist;
                bestTone = seed.tone;
                bestWarm = seed.warm;
                bestDx = dx;
                bestDy = dy;
              } else if (dist < d2) {
                d2 = dist;
              }
            }
          }

          const edgeGap = d2 - d1;
          const idx = (py * res + px) * 4;
          if (edgeGap < 6.8) {
            // Recessed sandy limestone mortar joint
            data[idx] = 166;
            data[idx + 1] = 149;
            data[idx + 2] = 124;
            data[idx + 3] = 255;
          } else {
            // Sunlit limestone flagstone with subtle directional bevel highlight
            const bevel = edgeGap < 14.5 ? (bestDx + bestDy < 0 ? 10 : -9) : 0;
            const base = 224 + (bestTone - 0.5) * 24 + bevel;
            data[idx] = Math.min(252, Math.max(175, Math.round(base + 8 + bestWarm * 5)));
            data[idx + 1] = Math.min(246, Math.max(168, Math.round(base + 1)));
            data[idx + 2] = Math.min(232, Math.max(150, Math.round(base - 15)));
            data[idx + 3] = 255;
          }
        }
      }
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, 0, 1024, 1024);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function createCheckeredFasciaTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cols = 16;
    const rows = 4;
    const cw = 1024 / cols;
    const ch = 256 / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isLight = (r + c) % 2 === 0;
        ctx.fillStyle = isLight ? '#f8fafc' : '#181b22';
        ctx.fillRect(c * cw, r * ch, cw, ch);
        if (isLight) {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
          ctx.lineWidth = 2;
          ctx.strokeRect(c * cw + 1, r * ch + 1, cw - 2, ch - 2);
        }
      }
    }
    // Brushed metallic upper & lower trim moldings + gold racing pinstripe
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 1024, 16);
    ctx.fillRect(0, 240, 1024, 16);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(0, 16, 1024, 6);
    ctx.fillRect(0, 234, 1024, 6);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function createBaroqueCorniceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Rich ivory & gold Rococo background
    ctx.fillStyle = '#faefd6';
    ctx.fillRect(0, 0, 1024, 256);

    // Molded gold cornice & dentil bead bands
    ctx.fillStyle = '#9a5b13';
    ctx.fillRect(0, 0, 1024, 28);
    ctx.fillRect(0, 226, 1024, 30);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(0, 8, 1024, 11);
    ctx.fillRect(0, 233, 1024, 11);

    // Gold pearl beading row
    ctx.fillStyle = '#fef08a';
    for (let bx = 12; bx < 1024; bx += 24) {
      ctx.beginPath();
      ctx.arc(bx, 36, 4.5, 0, Math.PI * 2);
      ctx.arc(bx, 218, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4 High-Detail Painted Coastal Cartouche Medallions per repeat (repeated 4x around ride = 16 medallions!)
    for (let i = 0; i < 4; i++) {
      const cx = 128 + i * 256;
      const cy = 127;

      // Acanthus scroll side flourishes
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 7;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(cx + sx * 96, cy - 18, 22, 0, Math.PI * 1.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + sx * 96, cy + 20, 20, Math.PI * 0.5, Math.PI * 2);
        ctx.stroke();
      }

      // Outer baroque gilded frame
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 88, 66, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 80, 58, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 73, 51, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hand-painted scenic coastal vignette inside oval
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, 66, 45, 0, 0, Math.PI * 2);
      ctx.clip();

      const skyGrad = ctx.createLinearGradient(cx, cy - 45, cx, cy + 8);
      skyGrad.addColorStop(0, '#7dd3fc');
      skyGrad.addColorStop(0.65, '#bae6fd');
      skyGrad.addColorStop(1, '#fef3c7');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(cx - 70, cy - 48, 140, 58);

      // Soft clouds & distant island
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.ellipse(cx - 22, cy - 22, 22, 8, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 24, cy - 16, 18, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Turquoise sea + white surf + golden sand
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(cx - 70, cy + 6, 140, 18);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(cx - 70, cy + 16, 140, 10);
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(cx - 70, cy + 25, 140, 24);

      // Tiny white sailboat silhouette on alternate medallions
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cx + (i % 2 === 0 ? -10 : 12), cy + 12);
      ctx.lineTo(cx + (i % 2 === 0 ? -2 : 20), cy - 8);
      ctx.lineTo(cx + (i % 2 === 0 ? 4 : 26), cy + 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Ornate pilaster divider jewel between ovals
      const divX = cx + 128;
      if (divX < 1024) {
        ctx.fillStyle = '#b45309';
        ctx.fillRect(divX - 11, 44, 22, 166);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(divX - 6, 50, 12, 154);
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(divX, cy, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function createCarnivalBannerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#881337';
    ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 16;
    ctx.strokeRect(14, 14, 996, 228);

    ctx.fillStyle = '#fffbeb';
    ctx.fillRect(36, 36, 952, 184);
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 6;
    ctx.strokeRect(46, 46, 932, 164);

    // Decorative corner rosettes
    ctx.fillStyle = '#eab308';
    for (const [rx, ry] of [
      [74, 74],
      [950, 74],
      [74, 182],
      [950, 182],
    ]) {
      ctx.beginPath();
      ctx.arc(rx, ry, 14, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#991b1b';
    ctx.font = 'bold 78px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TAMAN RIA DERMAGA', 512, 110);

    ctx.fillStyle = '#0369a1';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('COASTAL BOARDWALK & CARNIVAL PARK', 512, 174);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// ============================================================================
// MAIN 3D COASTAL AMUSEMENT PARK & OVER-WATER BOARDWALK BUILDER
// ============================================================================

export function buildCoastalAmusementPark3D(
  options: BuildCoastalAmusementParkOptions,
): CoastalAmusementParkHandle {
  const {
    windUniforms,
    isSoftwareGl,
    upgradeMeshToBlitzWorldMaterial,
    createBlitzStrokeMesh,
    bakeStaticGroupMeshes,
  } = options;

  const mp = COASTAL_AMUSEMENT_PARK_MASTERPLAN;
  const rootGroup = new THREE.Group();
  rootGroup.name = 'CoastalAmusementPark3D';

  const disposableTextures: THREE.Texture[] = [];
  const disposableGeometries: THREE.BufferGeometry[] = [];
  const disposableMaterials: THREE.Material[] = [];

  const plankTex = createBoardwalkPlankTexture();
  const hullWoodTex = createHullWoodPlankTexture();
  const cobbleTex = createCobblestoneMosaicTexture();
  const checkeredTex = createCheckeredFasciaTexture();
  const baroqueCorniceTex = createBaroqueCorniceTexture();
  const bannerTex = createCarnivalBannerTexture();

  disposableTextures.push(
    plankTex,
    hullWoodTex,
    cobbleTex,
    checkeredTex,
    baroqueCorniceTex,
    bannerTex,
  );

  const makePart = (
    geo: THREE.BufferGeometry,
    colorHex: string,
    opts?: {
      map?: THREE.Texture;
      strokeWidth?: number;
      castShadow?: boolean;
      receiveShadow?: boolean;
      bounceStrength?: number;
      polygonOffset?: boolean;
    },
  ): THREE.Mesh => {
    const mat = new THREE.MeshStandardMaterial({
      color: opts?.map ? '#ffffff' : colorHex,
      map: opts?.map ?? null,
      roughness: 0.76,
      metalness: 0.08,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = !isSoftwareGl && (opts?.castShadow ?? true);
    mesh.receiveShadow = !isSoftwareGl && (opts?.receiveShadow ?? true);
    upgradeMeshToBlitzWorldMaterial(
      mesh,
      windUniforms,
      opts?.map ? '#ffffff' : colorHex,
      opts?.bounceStrength ?? 0.18,
    );
    if (opts?.polygonOffset && mesh.material instanceof THREE.Material) {
      mesh.material.polygonOffset = true;
      mesh.material.polygonOffsetFactor = -2;
      mesh.material.polygonOffsetUnits = -2;
    }
    const sw = opts?.strokeWidth ?? 0.022;
    if (sw > 0) {
      const stroke = createBlitzStrokeMesh(geo, sw);
      if (stroke) mesh.add(stroke);
    }
    return mesh;
  };

  const bulbMat = new THREE.MeshBasicMaterial({ color: '#fef08a' });
  const warmAmberBulbMat = new THREE.MeshBasicMaterial({ color: '#fde047' });
  disposableMaterials.push(bulbMat, warmAmberBulbMat);

  const staticParkGroup = new THREE.Group();
  staticParkGroup.name = 'CoastalAmusementParkStatic';
  rootGroup.add(staticParkGroup);

  // =========================================================================
  // 1. WATERFRONT TIMBER BOARDWALK, OVER-WATER PIER DECK, PILINGS & GAZEBO JETTY
  // =========================================================================
  const deckY = mp.boardwalkDeckY;
  const deckThick = 0.28;

  const addTimberDeckSection = (
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    topY: number,
    planksRunEastWest = true,
  ) => {
    const w = maxX - minX;
    const d = maxZ - minZ;
    const cx = (minX + maxX) * 0.5;
    const cz = (minZ + maxZ) * 0.5;

    // 4.0m tileV / 16 rows = exact 0.25m continuous world plank width across the entire 53m boardwalk & pier!
    const deckGeo = applyBoxMetricUvs(
      new THREE.BoxGeometry(w, deckThick, d),
      3.6,
      4.0,
      !planksRunEastWest,
      cx,
      cz,
    );
    const deckMesh = makePart(deckGeo, '#ffffff', {
      map: plankTex,
      strokeWidth: 0.022,
      receiveShadow: true,
    });
    deckMesh.position.set(cx, topY - deckThick * 0.5, cz);
    staticParkGroup.add(deckMesh);

    // Heavy weathered timber fascia girder + lower cross-beam ledger under deck edge
    const skirtGeo = new THREE.BoxGeometry(w + 0.18, 0.26, d + 0.18);
    const skirtMesh = makePart(skirtGeo, '#784c28', { strokeWidth: 0.018 });
    skirtMesh.position.set(cx, topY - deckThick - 0.12, cz);
    staticParkGroup.add(skirtMesh);

    const subBeamGeo = new THREE.BoxGeometry(w + 0.06, 0.18, d + 0.06);
    const subBeam = makePart(subBeamGeo, '#5c381c', { strokeWidth: 0.014 });
    subBeam.position.set(cx, topY - deckThick - 0.32, cz);
    staticParkGroup.add(subBeam);
  };

  addTimberDeckSection(
    mp.mainBoardwalk.minX,
    mp.mainBoardwalk.maxX,
    mp.mainBoardwalk.minZ,
    mp.mainBoardwalk.maxZ,
    deckY,
    true,
  );
  addTimberDeckSection(
    109.6,
    mp.bianglalaPierDeck.maxX,
    mp.bianglalaPierDeck.minZ,
    mp.bianglalaPierDeck.maxZ,
    deckY,
    true,
  );
  addTimberDeckSection(
    mp.gazeboFingerJetty.walkwayMinX,
    mp.gazeboFingerJetty.walkwayMaxX,
    mp.gazeboFingerJetty.walkwayMinZ,
    mp.gazeboFingerJetty.walkwayMaxZ,
    deckY,
    false,
  );
  addTimberDeckSection(
    mp.gazeboFingerJetty.headMinX,
    mp.gazeboFingerJetty.headMaxX,
    mp.gazeboFingerJetty.headMinZ,
    mp.gazeboFingerJetty.headMaxZ,
    deckY,
    true,
  );

  // Heavy cylindrical marine pilings + iron bands + barnacle/concrete tidal collars + cross-bracing!
  const pilingGeo = new THREE.CylinderGeometry(0.26, 0.29, 3.5, 12);
  const pilingBandGeo = new THREE.CylinderGeometry(0.285, 0.285, 0.12, 12);
  const pilingCollarGeo = new THREE.CylinderGeometry(0.36, 0.42, 0.72, 12);
  const addPiling = (px: number, pz: number) => {
    const pMesh = makePart(pilingGeo, '#6b4423', { strokeWidth: 0.018 });
    pMesh.position.set(px, deckY - 0.28 - 1.7, pz);
    staticParkGroup.add(pMesh);

    const band = makePart(pilingBandGeo, '#334155', { strokeWidth: 0.012 });
    band.position.set(px, deckY - 0.72, pz);
    staticParkGroup.add(band);

    const collar = makePart(pilingCollarGeo, '#64748b', { strokeWidth: 0.016 });
    collar.position.set(px, -0.35, pz);
    staticParkGroup.add(collar);
  };

  for (let z = -73.0; z <= -22.0; z += 5.5) {
    addPiling(95.7, z);
    addPiling(102.4, z);
    if (z < -41.5 || z > -24.0) {
      addPiling(109.0, z);
    }
  }
  for (const px of [111.0, 114.2, 117.1]) {
    for (const pz of [-40.6, -36.5, -32.8, -29.0, -25.0]) {
      addPiling(px, pz);
    }
  }
  for (const [px, pz] of [
    [119.2, -28.0],
    [119.2, -25.2],
    [120.4, -29.0],
    [120.4, -24.2],
    [125.0, -29.0],
    [125.0, -24.2],
    [122.7, -26.6],
  ]) {
    addPiling(px, pz);
  }

  // Four Architectural Timber Staircases with Individual Plank Treads, Risers & Side Stringers (0.0m -> +1.10m)
  const addBoardwalkStaircase = (
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    climbAxis: '+x' | '-z' | '+z',
  ) => {
    const steps = 6;
    const totalW = maxX - minX;
    const totalD = maxZ - minZ;

    for (let s = 0; s < steps; s++) {
      const frac0 = s / steps;
      const frac1 = (s + 1) / steps;
      const topH = deckY * frac1;
      const treadThick = 0.075;
      let sx = (minX + maxX) * 0.5;
      let sz = (minZ + maxZ) * 0.5;
      let sw = totalW;
      let sd = totalD;

      if (climbAxis === '+x') {
        sw = totalW / steps + 0.04;
        sx = minX + (frac0 + frac1) * 0.5 * totalW;
      } else if (climbAxis === '-z') {
        sd = totalD / steps + 0.04;
        sz = maxZ - (frac0 + frac1) * 0.5 * totalD;
      } else {
        sd = totalD / steps + 0.04;
        sz = minZ + (frac0 + frac1) * 0.5 * totalD;
      }

      // Shaded structural riser body
      const riserGeo = new THREE.BoxGeometry(sw - 0.03, Math.max(0.05, topH - treadThick), sd - 0.03);
      const riserMesh = makePart(riserGeo, '#8b5e34', { strokeWidth: 0.014 });
      riserMesh.position.set(sx, (topH - treadThick) * 0.5, sz);
      staticParkGroup.add(riserMesh);

      // Textured overhanging plank tread nose aligned seamlessly to world boardwalk planks
      const treadGeo = applyBoxMetricUvs(
        new THREE.BoxGeometry(sw + 0.04, treadThick, sd + 0.04),
        3.6,
        4.0,
        false,
        sx,
        sz,
      );
      const treadMesh = makePart(treadGeo, '#ffffff', { map: plankTex, strokeWidth: 0.016 });
      treadMesh.position.set(sx, topH - treadThick * 0.5, sz);
      staticParkGroup.add(treadMesh);
    }

    // Sloped side stringer cheeks, handrails & anchored newel posts framing the staircase
    const newelGeo = new THREE.BoxGeometry(0.15, 0.96, 0.15);
    if (climbAxis === '+x') {
      const spanW = totalW - 0.18;
      const slopeLen = Math.hypot(spanW, deckY * 0.9);
      const slopeAng = Math.atan2(deckY * 0.9, spanW);
      for (const szSide of [minZ + 0.08, maxZ - 0.08]) {
        const stringer = makePart(new THREE.BoxGeometry(slopeLen, 0.20, 0.14), '#784c28', {
          strokeWidth: 0.016,
        });
        stringer.position.set((minX + maxX) * 0.5 + 0.06, deckY * 0.44, szSide);
        stringer.rotation.z = slopeAng;
        staticParkGroup.add(stringer);

        const handrail = makePart(new THREE.BoxGeometry(slopeLen + 0.08, 0.09, 0.12), '#a67542', {
          strokeWidth: 0.014,
        });
        handrail.position.set((minX + maxX) * 0.5 + 0.04, deckY * 0.5 + 0.90, szSide);
        handrail.rotation.z = slopeAng;
        staticParkGroup.add(handrail);

        const botPost = makePart(newelGeo, '#7c4f28', { strokeWidth: 0.014 });
        botPost.position.set(minX + 0.12, 0.48, szSide);
        staticParkGroup.add(botPost);

        const topPost = makePart(newelGeo, '#7c4f28', { strokeWidth: 0.014 });
        topPost.position.set(maxX - 0.08, deckY + 0.44, szSide);
        staticParkGroup.add(topPost);
      }
    } else {
      const dirSign = climbAxis === '+z' ? 1 : -1;
      const spanD = totalD - 0.18;
      const slopeLen = Math.hypot(spanD, deckY * 0.9);
      const slopeAng = Math.atan2(deckY * 0.9, spanD) * -dirSign;
      const zBot = climbAxis === '+z' ? minZ + 0.12 : maxZ - 0.12;
      const zTop = climbAxis === '+z' ? maxZ - 0.08 : minZ + 0.08;
      for (const sxSide of [minX + 0.08, maxX - 0.08]) {
        const stringer = makePart(new THREE.BoxGeometry(0.14, 0.20, slopeLen), '#784c28', {
          strokeWidth: 0.016,
        });
        stringer.position.set(sxSide, deckY * 0.44, (minZ + maxZ) * 0.5 + dirSign * 0.06);
        stringer.rotation.x = slopeAng;
        staticParkGroup.add(stringer);

        const handrail = makePart(new THREE.BoxGeometry(0.12, 0.09, slopeLen + 0.08), '#a67542', {
          strokeWidth: 0.014,
        });
        handrail.position.set(sxSide, deckY * 0.5 + 0.90, (minZ + maxZ) * 0.5 + dirSign * 0.04);
        handrail.rotation.x = slopeAng;
        staticParkGroup.add(handrail);

        const botPost = makePart(newelGeo, '#7c4f28', { strokeWidth: 0.014 });
        botPost.position.set(sxSide, 0.48, zBot);
        staticParkGroup.add(botPost);

        const topPost = makePart(newelGeo, '#7c4f28', { strokeWidth: 0.014 });
        topPost.position.set(sxSide, deckY + 0.44, zTop);
        staticParkGroup.add(topPost);
      }
    }
  };

  addBoardwalkStaircase(
    mp.stairs.southDermaga.minX,
    mp.stairs.southDermaga.maxX,
    mp.stairs.southDermaga.minZ,
    mp.stairs.southDermaga.maxZ,
    '-z',
  );
  addBoardwalkStaircase(
    mp.stairs.westBianglala.minX,
    mp.stairs.westBianglala.maxX,
    mp.stairs.westBianglala.minZ,
    mp.stairs.westBianglala.maxZ,
    '+x',
  );
  addBoardwalkStaircase(
    mp.stairs.westCarousel.minX,
    mp.stairs.westCarousel.maxX,
    mp.stairs.westCarousel.minZ,
    mp.stairs.westCarousel.maxZ,
    '+x',
  );
  addBoardwalkStaircase(
    mp.stairs.northBeach.minX,
    mp.stairs.northBeach.maxX,
    mp.stairs.northBeach.minZ,
    mp.stairs.northBeach.maxZ,
    '+z',
  );

  // X-Braced Weathered Timber Boardwalk & Pier Railings
  const railPostGeo = new THREE.BoxGeometry(0.18, 1.08, 0.18);
  const railPostCapGeo = new THREE.BoxGeometry(0.25, 0.08, 0.25);
  const addXBracedRailingRun = (x1: number, z1: number, x2: number, z2: number, baseY: number) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const totalLen = Math.hypot(dx, dz);
    if (totalLen < 0.6) return;
    const yaw = Math.atan2(dx, dz);
    const bayCount = Math.max(1, Math.round(totalLen / 2.35));
    const bayLen = totalLen / bayCount;

    const runGrp = new THREE.Group();
    runGrp.position.set(x1, baseY, z1);
    runGrp.rotation.y = yaw;
    staticParkGroup.add(runGrp);

    const topRail = makePart(new THREE.BoxGeometry(0.15, 0.10, totalLen), '#b5834d', {
      strokeWidth: 0.016,
    });
    topRail.position.set(0, 0.98, totalLen * 0.5);
    runGrp.add(topRail);

    const botRail = makePart(new THREE.BoxGeometry(0.12, 0.09, totalLen), '#8b5e34', {
      strokeWidth: 0.014,
    });
    botRail.position.set(0, 0.20, totalLen * 0.5);
    runGrp.add(botRail);

    const diagLen = Math.hypot(bayLen - 0.16, 0.72);
    const diagTilt = Math.atan2(bayLen - 0.16, 0.72);
    const diagBarGeo = new THREE.BoxGeometry(0.075, diagLen, 0.085);

    for (let i = 0; i <= bayCount; i++) {
      const pz = i * bayLen;
      const post = makePart(railPostGeo, '#7c4f28', { strokeWidth: 0.016 });
      post.position.set(0, 0.54, pz);
      runGrp.add(post);

      const cap = makePart(railPostCapGeo, '#d9ab73', { strokeWidth: 0.012 });
      cap.position.set(0, 1.10, pz);
      runGrp.add(cap);

      if (i < bayCount) {
        const cz = (i + 0.5) * bayLen;
        const d1 = makePart(diagBarGeo, '#c4925a', { strokeWidth: 0.012 });
        d1.position.set(0, 0.59, cz);
        d1.rotation.x = diagTilt;
        runGrp.add(d1);

        const d2 = makePart(diagBarGeo, '#c4925a', { strokeWidth: 0.012 });
        d2.position.set(0, 0.59, cz);
        d2.rotation.x = -diagTilt;
        runGrp.add(d2);
      }
    }
  };

  addXBracedRailingRun(95.35, -21.2, 95.35, -29.6, deckY);
  addXBracedRailingRun(95.35, -35.8, 95.35, -44.0, deckY);
  addXBracedRailingRun(95.35, -50.4, 95.35, -73.8, deckY);
  addXBracedRailingRun(95.35, -21.2, 97.9, -21.2, deckY);
  addXBracedRailingRun(105.1, -21.2, 109.45, -21.2, deckY);
  addXBracedRailingRun(95.35, -73.8, 97.9, -73.8, deckY);
  addXBracedRailingRun(104.3, -73.8, 109.45, -73.8, deckY);
  addXBracedRailingRun(109.45, -21.2, 109.45, -24.4, deckY);
  addXBracedRailingRun(109.45, -41.2, 109.45, -73.8, deckY);
  addXBracedRailingRun(109.45, -24.55, 117.45, -24.55, deckY);
  addXBracedRailingRun(109.45, -41.05, 117.45, -41.05, deckY);
  addXBracedRailingRun(117.45, -41.05, 117.45, -28.5, deckY);
  addXBracedRailingRun(117.45, -24.95, 119.95, -24.95, deckY);
  addXBracedRailingRun(117.45, -28.25, 119.95, -28.25, deckY);
  addXBracedRailingRun(119.95, -23.85, 125.45, -23.85, deckY);
  addXBracedRailingRun(119.95, -29.35, 125.45, -29.35, deckY);
  addXBracedRailingRun(125.45, -29.35, 125.45, -23.85, deckY);

  // Pier-End Striped Gazebo Pavilion & Coastal Pennant Flagpole
  {
    const gx = mp.gazeboFingerJetty.gazeboCenterX;
    const gz = mp.gazeboFingerJetty.gazeboCenterZ;
    const gazGrp = new THREE.Group();
    gazGrp.position.set(gx, deckY, gz);
    staticParkGroup.add(gazGrp);

    const colGeo = new THREE.CylinderGeometry(0.11, 0.13, 3.1, 10);
    for (const [ox, oz] of [
      [-1.78, -1.78],
      [1.78, -1.78],
      [-1.78, 1.78],
      [1.78, 1.78],
    ]) {
      const col = makePart(colGeo, '#f8fafc', { strokeWidth: 0.016 });
      col.position.set(ox, 1.55, oz);
      gazGrp.add(col);
    }

    addStripedCarnivalTentRoof(gazGrp, 2.02, 2.02, 3.1, 1.55, '#eab308', '#fffbeb', makePart);

    const finialPole = makePart(new THREE.CylinderGeometry(0.045, 0.065, 0.85, 8), '#d97706', {
      strokeWidth: 0.012,
    });
    finialPole.position.set(0, 4.95, 0);
    gazGrp.add(finialPole);

    const flag = makePart(new THREE.BoxGeometry(0.75, 0.34, 0.05), '#ef4444', {
      strokeWidth: 0.012,
    });
    flag.position.set(0.38, 5.22, 0);
    gazGrp.add(flag);

    const outerPole = makePart(new THREE.CylinderGeometry(0.06, 0.08, 4.8, 8), '#e2e8f0', {
      strokeWidth: 0.016,
    });
    outerPole.position.set(2.45, 2.4, -2.35);
    gazGrp.add(outerPole);
    const outerFlag = makePart(new THREE.BoxGeometry(0.92, 0.42, 0.05), '#f97316', {
      strokeWidth: 0.012,
    });
    outerFlag.position.set(2.9, 4.55, -2.35);
    gazGrp.add(outerFlag);
  }

  // =========================================================================
  // 2. COBBLESTONE CARNIVAL MIDWAY, ENTRANCE ARCHWAY, FESTOON LIGHTS & STALLS
  // =========================================================================
  {
    // Main Cobblestone Midway Spine with continuous world 3.2m x 3.2m metric flagstone UVs (zero slab seams!)
    const spineGeo = applyBoxMetricUvs(
      new THREE.BoxGeometry(8.2, 0.078, 76.5),
      3.2,
      3.2,
      false,
      86.3,
      -58.3,
    );
    const spineMesh = makePart(spineGeo, '#ffffff', {
      map: cobbleTex,
      strokeWidth: 0,
      castShadow: false,
      polygonOffset: true,
    });
    spineMesh.position.set(86.3, 0.039, -58.3);
    staticParkGroup.add(spineMesh);

    // Chiseled limestone edge curbs framing only the outer promenade edges (never cutting across ride/stair plazas!)
    for (const [edgeX, zMin, zMax] of [
      [82.15, -59.5, -20.1],
      [82.15, -96.5, -75.8],
      [90.45, -25.8, -20.1],
      [90.45, -96.5, -60.5],
    ] as const) {
      const cLen = zMax - zMin;
      const curb = makePart(new THREE.BoxGeometry(0.26, 0.10, cLen), '#d6c5a9', {
        strokeWidth: 0.014,
        castShadow: false,
      });
      curb.position.set(edgeX, 0.05, (zMin + zMax) * 0.5);
      staticParkGroup.add(curb);
    }

    // Circular Cobblestone Plazas around Komidi Putar & Ontag-Anting + Boardwalk Stair Apron (coplanar UV-matched!)
    const carouselPlazaGeo = applyCylinderMetricUvs(
      new THREE.CylinderGeometry(7.25, 7.35, 0.076, 36),
      6,
      1,
      3.2,
      mp.rides.komidiPutar.x,
      mp.rides.komidiPutar.z,
    );
    const carouselPlaza = makePart(carouselPlazaGeo, '#ffffff', {
      map: cobbleTex,
      strokeWidth: 0,
      castShadow: false,
      polygonOffset: true,
    });
    carouselPlaza.position.set(mp.rides.komidiPutar.x, 0.038, mp.rides.komidiPutar.z);
    staticParkGroup.add(carouselPlaza);

    const swingerPlazaGeo = applyCylinderMetricUvs(
      new THREE.CylinderGeometry(7.85, 7.95, 0.076, 36),
      6,
      1,
      3.2,
      mp.rides.ontagAnting.x,
      mp.rides.ontagAnting.z,
    );
    const swingerPlaza = makePart(swingerPlazaGeo, '#ffffff', {
      map: cobbleTex,
      strokeWidth: 0,
      castShadow: false,
      polygonOffset: true,
    });
    swingerPlaza.position.set(mp.rides.ontagAnting.x, 0.038, mp.rides.ontagAnting.z);
    staticParkGroup.add(swingerPlaza);

    const stairApronGeo = applyBoxMetricUvs(
      new THREE.BoxGeometry(5.1, 0.078, 34.0),
      3.2,
      3.2,
      false,
      92.95,
      -42.8,
    );
    const stairApron = makePart(stairApronGeo, '#ffffff', {
      map: cobbleTex,
      strokeWidth: 0,
      castShadow: false,
      polygonOffset: true,
    });
    stairApron.position.set(92.95, 0.039, -42.8);
    staticParkGroup.add(stairApron);

    // Ornate Square Travertine Planter / Medallion in Midway Foreground (Sheet 1 & Sheet 3 Top Plan!)
    const midSquareRim = makePart(new THREE.BoxGeometry(3.4, 0.24, 3.4), '#d6c5a9', {
      strokeWidth: 0.018,
    });
    midSquareRim.position.set(86.2, 0.12, -59.5);
    staticParkGroup.add(midSquareRim);
    const midSquareInlay = makePart(new THREE.BoxGeometry(2.65, 0.27, 2.65), '#fde68a', {
      strokeWidth: 0.014,
    });
    midSquareInlay.position.set(86.2, 0.135, -59.5);
    staticParkGroup.add(midSquareInlay);
  }

  // Grand Carnival Entrance Archway ("TAMAN RIA DERMAGA") at (86.2, -20.4)
  {
    const archGrp = new THREE.Group();
    archGrp.position.set(mp.entranceArch.x, 0, mp.entranceArch.z);
    staticParkGroup.add(archGrp);

    const pillarOffset = mp.entranceArch.clearHalfSpanX + mp.entranceArch.pillarHalfSize;
    for (const side of [-1, 1] as const) {
      const px = side * pillarOffset;
      const plinth = makePart(new THREE.BoxGeometry(1.52, 0.62, 1.52), '#d6c5a9', {
        strokeWidth: 0.022,
      });
      plinth.position.set(px, 0.31, 0);
      archGrp.add(plinth);

      const plinthCap = makePart(new THREE.BoxGeometry(1.64, 0.14, 1.64), '#eab308', {
        strokeWidth: 0.016,
      });
      plinthCap.position.set(px, 0.66, 0);
      archGrp.add(plinthCap);

      // Fluted ivory-and-gold carnival turret column
      const tower = makePart(
        applyCylinderMetricUvs(new THREE.CylinderGeometry(0.46, 0.54, 4.95, 16), 2, 1),
        '#fffbeb',
        { strokeWidth: 0.022 },
      );
      tower.position.set(px, 3.18, 0);
      archGrp.add(tower);

      for (const ringY of [1.9, 3.2, 4.5]) {
        const ring = makePart(new THREE.CylinderGeometry(0.54, 0.54, 0.14, 16), '#eab308', {
          strokeWidth: 0.014,
        });
        ring.position.set(px, ringY, 0);
        archGrp.add(ring);
      }

      // Striped turret roof cone built from crisp gores
      for (let g = 0; g < 8; g++) {
        const gore = createConcaveCanopyGoreGeometry(
          0.84,
          1.42,
          (g / 8) * Math.PI * 2,
          ((g + 1) / 8) * Math.PI * 2,
          0.08,
          4,
          1,
        );
        const gm = makePart(gore, g % 2 === 0 ? '#dc2626' : '#fffbeb', { strokeWidth: 0 });
        gm.position.set(px, 5.68, 0);
        archGrp.add(gm);
      }

      const finialFlag = makePart(new THREE.BoxGeometry(0.58, 0.3, 0.05), '#facc15', {
        strokeWidth: 0.012,
      });
      finialFlag.position.set(px + 0.29, 7.32, 0);
      archGrp.add(finialFlag);
    }

    const beam = makePart(new THREE.BoxGeometry(pillarOffset * 2 + 1.25, 0.46, 0.68), '#b45309', {
      strokeWidth: 0.022,
    });
    beam.position.set(0, 5.12, 0);
    archGrp.add(beam);

    const signBoard = makePart(new THREE.BoxGeometry(7.9, 1.82, 0.42), '#991b1b', {
      strokeWidth: 0.024,
    });
    signBoard.position.set(0, 5.92, 0);
    archGrp.add(signBoard);

    const archCrest = makePart(new THREE.CylinderGeometry(1.8, 1.8, 0.36, 18, 1, false, 0, Math.PI), '#eab308', {
      strokeWidth: 0.018,
    });
    archCrest.rotation.z = Math.PI / 2;
    archCrest.rotation.y = Math.PI / 2;
    archCrest.scale.set(1.0, 1.0, 0.38);
    archCrest.position.set(0, 6.82, 0);
    archGrp.add(archCrest);

    const plaqueGeo = new THREE.PlaneGeometry(7.55, 1.56);
    const plaqueFront = makePart(plaqueGeo, '#ffffff', { map: bannerTex, strokeWidth: 0 });
    plaqueFront.position.set(0, 5.92, 0.23);
    archGrp.add(plaqueFront);

    const plaqueBack = makePart(plaqueGeo, '#ffffff', { map: bannerTex, strokeWidth: 0 });
    plaqueBack.position.set(0, 5.92, -0.23);
    plaqueBack.rotation.y = Math.PI;
    archGrp.add(plaqueBack);
  }

  // Festive Carnival Stalls, Pastel Pink Popcorn Kiosk & Sky-Blue Cotton Candy ("Gulali") Cart
  const stallBulbPositions: THREE.Vector3[] = [];
  const buildCarnivalStall = (spec: CarnivalStallSpec) => {
    const sGrp = new THREE.Group();
    sGrp.position.set(spec.x, 0, spec.z);
    sGrp.rotation.y = spec.rotY;
    staticParkGroup.add(sGrp);

    if (spec.kind === 'cotton_candy_cart') {
      // Iconic Vintage Sky-Blue Cotton Candy ("Gulali") Cart with 3 Fluffy Multi-Lobe Pink Clouds!
      const cartBody = makePart(new THREE.BoxGeometry(2.34, 1.04, 1.52), '#38bdf8', {
        strokeWidth: 0.02,
      });
      cartBody.position.set(0, 0.78, 0);
      sGrp.add(cartBody);

      const recessedPanel = makePart(new THREE.BoxGeometry(2.02, 0.64, 1.58), '#e0f2fe', {
        strokeWidth: 0.014,
      });
      recessedPanel.position.set(0, 0.76, 0);
      sGrp.add(recessedPanel);

      const counterTop = makePart(new THREE.BoxGeometry(2.48, 0.14, 1.66), '#ffffff', {
        strokeWidth: 0.016,
      });
      counterTop.position.set(0, 1.34, 0);
      sGrp.add(counterTop);

      // Push handle bar
      const handleBar = makePart(new THREE.CylinderGeometry(0.035, 0.035, 1.25, 8), '#eab308', {
        strokeWidth: 0.01,
      });
      handleBar.rotation.x = Math.PI / 2;
      handleBar.position.set(-1.34, 1.18, 0);
      sGrp.add(handleBar);

      // Spoked Vintage Wooden/Brass Cart Wheels
      const wheelRimGeo = new THREE.TorusGeometry(0.45, 0.055, 8, 20);
      for (const wz of [-0.82, 0.82]) {
        const rim = makePart(wheelRimGeo, '#b45309', { strokeWidth: 0.016 });
        rim.position.set(0.28, 0.48, wz);
        sGrp.add(rim);

        const hub = makePart(
          new THREE.CylinderGeometry(0.11, 0.11, 0.14, 10).rotateX(Math.PI / 2),
          '#eab308',
          { strokeWidth: 0.012 },
        );
        hub.position.set(0.28, 0.48, wz);
        sGrp.add(hub);

        for (let sp = 0; sp < 4; sp++) {
          const spk = makePart(new THREE.BoxGeometry(0.045, 0.86, 0.045), '#d97706', {
            strokeWidth: 0.008,
          });
          spk.position.set(0.28, 0.48, wz);
          spk.rotation.z = (sp * Math.PI) / 4;
          sGrp.add(spk);
        }
      }

      // Stainless cotton-candy bowl + dome
      const spinner = makePart(new THREE.CylinderGeometry(0.44, 0.36, 0.28, 14), '#f1f5f9', {
        strokeWidth: 0.016,
      });
      spinner.position.set(-0.22, 1.54, 0);
      sGrp.add(spinner);

      const poleGeo = new THREE.CylinderGeometry(0.042, 0.042, 1.52, 8);
      for (const [px, pz] of [
        [-1.06, -0.68],
        [1.06, -0.68],
        [-1.06, 0.68],
        [1.06, 0.68],
      ]) {
        const p = makePart(poleGeo, '#eab308', { strokeWidth: 0.012 });
        p.position.set(px, 2.12, pz);
        sGrp.add(p);
      }

      addStripedCarnivalTentRoof(sGrp, 1.24, 0.88, 2.88, 0.68, '#38bdf8', '#f0f9ff', makePart);

      // 3 Lush Sculpted Cotton Candy Clouds ("Gulali") made of smooth overlapping spheres!
      const stickGeo = new THREE.CylinderGeometry(0.028, 0.022, 1.05, 8);
      const gulaliSpecs: readonly [number, number, number, number, string][] = [
        [-0.72, 3.66, -0.22, -0.18, '#f9a8d4'],
        [0.04, 3.92, 0.14, 0.06, '#f472b6'],
        [0.76, 3.64, -0.16, 0.2, '#fbcfe8'],
      ];
      for (const [gx, gy, gz, tiltZ, gCol] of gulaliSpecs) {
        const cloudGrp = new THREE.Group();
        cloudGrp.position.set(gx, gy, gz);
        cloudGrp.rotation.z = tiltZ;
        sGrp.add(cloudGrp);

        const st = makePart(stickGeo, '#fef3c7', { strokeWidth: 0.008 });
        st.position.set(0, -0.58, 0);
        cloudGrp.add(st);

        for (const [ox, oy, oz, r] of [
          [0, 0, 0, 0.36],
          [-0.16, -0.12, 0.1, 0.26],
          [0.18, -0.1, -0.08, 0.27],
          [0.04, 0.22, 0.05, 0.26],
          [-0.08, 0.14, -0.14, 0.24],
        ]) {
          const lobe = makePart(new THREE.SphereGeometry(r, 12, 10), gCol, {
            strokeWidth: 0.014,
          });
          lobe.position.set(ox, oy, oz);
          cloudGrp.add(lobe);
        }
      }
      return;
    }

    if (spec.kind === 'popcorn_kiosk') {
      const base = makePart(new THREE.BoxGeometry(2.54, 1.12, 2.54), '#f472b6', {
        strokeWidth: 0.02,
      });
      base.position.set(0, 0.56, 0);
      sGrp.add(base);

      const frontInset = makePart(new THREE.BoxGeometry(2.14, 0.74, 2.6), '#fbcfe8', {
        strokeWidth: 0.014,
      });
      frontInset.position.set(0, 0.56, 0);
      sGrp.add(frontInset);

      const counter = makePart(new THREE.BoxGeometry(2.74, 0.14, 2.74), '#fdf2f8', {
        strokeWidth: 0.016,
      });
      counter.position.set(0, 1.16, 0);
      sGrp.add(counter);

      // Golden popcorn heap + red/white popcorn bucket inside display case
      const kettle = makePart(new THREE.CylinderGeometry(0.28, 0.24, 0.36, 10), '#eab308', {
        strokeWidth: 0.014,
      });
      kettle.position.set(0, 1.72, 0);
      sGrp.add(kettle);

      const popcornMound = makePart(new THREE.SphereGeometry(0.58, 12, 8), '#fde047', {
        strokeWidth: 0.014,
      });
      popcornMound.scale.set(1.2, 0.52, 1.1);
      popcornMound.position.set(0, 1.34, 0.25);
      sGrp.add(popcornMound);

      const postGeo = new THREE.CylinderGeometry(0.065, 0.065, 1.68, 8);
      for (const [px, pz] of [
        [-1.16, -1.16],
        [1.16, -1.16],
        [-1.16, 1.16],
        [1.16, 1.16],
      ]) {
        const post = makePart(postGeo, '#ffffff', { strokeWidth: 0.014 });
        post.position.set(px, 2.02, pz);
        sGrp.add(post);
      }

      addStripedCarnivalTentRoof(sGrp, 1.44, 1.44, 2.86, 0.92, '#f472b6', '#fdf2f8', makePart);
      return;
    }

    // Standard Striped Carnival Game / Snack Pavilion Tent (with crisp undistorted striped roof!)
    const floorDeck = makePart(new THREE.BoxGeometry(3.64, 0.16, 3.24), '#c4955c', {
      strokeWidth: 0.018,
    });
    floorDeck.position.set(0, 0.08, 0);
    sGrp.add(floorDeck);

    // Paneled wooden front counter + side counters
    const frontCounter = makePart(new THREE.BoxGeometry(3.44, 1.0, 0.62), spec.counterHex, {
      strokeWidth: 0.02,
    });
    frontCounter.position.set(0, 0.66, 1.18);
    sGrp.add(frontCounter);

    const counterLip = makePart(new THREE.BoxGeometry(3.58, 0.12, 0.76), '#fde68a', {
      strokeWidth: 0.016,
    });
    counterLip.position.set(0, 1.2, 1.18);
    sGrp.add(counterLip);

    const backWall = makePart(new THREE.BoxGeometry(3.44, 2.52, 0.2), '#fef3c7', {
      strokeWidth: 0.018,
    });
    backWall.position.set(0, 1.42, -1.36);
    sGrp.add(backWall);

    const shelf = makePart(new THREE.BoxGeometry(3.2, 0.1, 0.42), '#b45309', {
      strokeWidth: 0.014,
    });
    shelf.position.set(0, 1.88, -1.14);
    sGrp.add(shelf);

    const tentPostGeo = new THREE.CylinderGeometry(0.075, 0.085, 2.75, 8);
    for (const [px, pz] of [
      [-1.62, -1.36],
      [1.62, -1.36],
      [-1.62, 1.36],
      [1.62, 1.36],
    ]) {
      const tp = makePart(tentPostGeo, '#78350f', { strokeWidth: 0.016 });
      tp.position.set(px, 1.52, pz);
      sGrp.add(tp);
    }

    // Interior Carnival Game Props (Ring-Toss Bottles, Can Pyramids, Plush Bears/Balls)
    const propColors = ['#ef4444', '#38bdf8', '#facc15', '#34d399', '#f472b6'];
    for (let pIdx = 0; pIdx < 5; pIdx++) {
      const px = -1.12 + pIdx * 0.56;
      const pCol = propColors[pIdx % propColors.length];
      if (spec.accentType === 'plush_prizes') {
        const plushBody = makePart(new THREE.SphereGeometry(0.2, 10, 8), pCol, {
          strokeWidth: 0.014,
        });
        plushBody.position.set(px, 2.12, -1.12);
        sGrp.add(plushBody);
        const plushHead = makePart(new THREE.SphereGeometry(0.14, 8, 8), pCol, {
          strokeWidth: 0.012,
        });
        plushHead.position.set(px, 2.38, -1.12);
        sGrp.add(plushHead);
      } else {
        const bottle = makePart(new THREE.CylinderGeometry(0.085, 0.115, 0.34, 8), pCol, {
          strokeWidth: 0.012,
        });
        bottle.position.set(px, 1.43, 1.18);
        sGrp.add(bottle);
      }
    }

    // Crisp Subdivision Striped Hip Roof + Scalloped Valance + Finial Pennant!
    addStripedCarnivalTentRoof(
      sGrp,
      1.94,
      1.74,
      2.92,
      1.32,
      spec.stripePrimaryHex,
      spec.stripeSecondaryHex,
      makePart,
    );

    const flagPole = makePart(new THREE.CylinderGeometry(0.038, 0.05, 0.62, 6), '#d97706', {
      strokeWidth: 0.012,
    });
    flagPole.position.set(0, 4.48, 0);
    sGrp.add(flagPole);

    const pennant = makePart(new THREE.BoxGeometry(0.54, 0.26, 0.04), spec.stripePrimaryHex, {
      strokeWidth: 0.012,
    });
    pennant.position.set(0.27, 4.66, 0);
    sGrp.add(pennant);

    for (let b = -2; b <= 2; b++) {
      const localV = new THREE.Vector3(b * 0.72, 2.58, 1.72);
      localV.applyAxisAngle(new THREE.Vector3(0, 1, 0), spec.rotY);
      localV.add(new THREE.Vector3(spec.x, 0, spec.z));
      stallBulbPositions.push(localV);
    }
  };

  for (const stall of CARNIVAL_MIDWAY_STALLS) {
    buildCarnivalStall(stall);
  }

  // Overhead Festoon Carnival String Lights
  const festoonBulbPositions: THREE.Vector3[] = [...stallBulbPositions];
  const festoonPoleGeo = new THREE.CylinderGeometry(0.06, 0.078, 3.65, 8);
  const addFestoonSpan = (
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    sagM: number,
    bulbCount: number,
    withPoles: boolean,
  ) => {
    if (withPoles) {
      for (const endP of [p1, p2]) {
        const pole = makePart(festoonPoleGeo, '#334155', { strokeWidth: 0.014 });
        pole.position.set(endP.x, endP.y - 1.82, endP.z);
        staticParkGroup.add(pole);
      }
    }
    const mid = p1.clone().add(p2).multiplyScalar(0.5);
    mid.y -= sagM;
    const curve = new THREE.CatmullRomCurve3([p1, mid, p2]);
    const cableGeo = new THREE.TubeGeometry(curve, 12, 0.022, 5, false);
    const cable = makePart(cableGeo, '#1e293b', { strokeWidth: 0, castShadow: false });
    staticParkGroup.add(cable);

    for (let i = 1; i <= bulbCount; i++) {
      const pt = curve.getPoint(i / (bulbCount + 1));
      pt.y -= 0.08;
      festoonBulbPositions.push(pt);
    }
  };

  for (const [z1, z2] of [
    [-21.5, -29.3],
    [-36.1, -43.7],
    [-50.7, -58.2],
    [-58.2, -65.8],
    [-65.8, -73.5],
  ]) {
    addFestoonSpan(
      new THREE.Vector3(95.4, deckY + 3.65, z1),
      new THREE.Vector3(95.4, deckY + 3.65, z2),
      0.38,
      6,
      true,
    );
  }
  for (const [z1, z2] of [
    [-41.5, -49.5],
    [-63.5, -73.2],
  ]) {
    addFestoonSpan(
      new THREE.Vector3(109.4, deckY + 3.65, z1),
      new THREE.Vector3(109.4, deckY + 3.65, z2),
      0.38,
      6,
      true,
    );
  }
  for (const [zA, zB] of [
    [-23.5, -28.5],
    [-28.5, -34.5],
    [-34.5, -40.0],
    [-53.0, -58.5],
    [-75.0, -80.0],
  ]) {
    addFestoonSpan(
      new THREE.Vector3(82.3, 4.2, zA),
      new THREE.Vector3(90.2, 4.2, zB),
      0.42,
      7,
      true,
    );
  }

  // Sculpted Tropical Coconut Palm Trees (Drooping Pinnate Fronds!) & Staved Nautical Barrels
  {
    const palmFrondGeo = createPalmFrondGeometry(3.35, 0.88);
    const coconutGeo = new THREE.SphereGeometry(0.17, 8, 8);

    for (const palm of AMUSEMENT_PARK_PALM_TREES) {
      const pGrp = new THREE.Group();
      pGrp.position.set(palm.x, 0, palm.z);
      pGrp.rotation.y = palm.rotY;
      pGrp.scale.setScalar(palm.scale);
      staticParkGroup.add(pGrp);

      // Flared sandy root collar + 8 ringed tapering curved trunk segments
      const rootCollar = makePart(new THREE.CylinderGeometry(0.32, 0.46, 0.42, 10), '#784925', {
        strokeWidth: 0.018,
      });
      rootCollar.position.set(0, 0.2, 0);
      pGrp.add(rootCollar);

      let curX = 0;
      let curY = 0.26;
      const trunkSegs = 8;
      for (let s = 0; s < trunkSegs; s++) {
        const rBot = 0.31 * (1 - s * 0.052);
        const rTop = 0.28 * (1 - (s + 1) * 0.048);
        const segH = 0.84;
        const lean = 0.06 + s * 0.036;
        const seg = makePart(
          new THREE.CylinderGeometry(rTop, rBot, segH, 10),
          s % 2 === 0 ? '#8c5a32' : '#7a4b26',
          { strokeWidth: 0.018 },
        );
        seg.position.set(curX + Math.sin(lean) * segH * 0.5, curY + Math.cos(lean) * segH * 0.5, 0);
        seg.rotation.z = -lean;
        pGrp.add(seg);

        // Bark ring ridge
        const ring = makePart(
          new THREE.TorusGeometry(rTop * 1.02, 0.025, 6, 10).rotateX(Math.PI / 2),
          '#693e1e',
          { strokeWidth: 0 },
        );
        ring.position.set(curX + Math.sin(lean) * segH * 0.92, curY + Math.cos(lean) * segH * 0.92, 0);
        ring.rotation.z = -lean;
        pGrp.add(ring);

        curX += Math.sin(lean) * (segH - 0.05);
        curY += Math.cos(lean) * (segH - 0.05);
      }

      // Green crownshaft + 4 golden-brown coconuts
      const crownShaft = makePart(new THREE.CylinderGeometry(0.22, 0.19, 0.48, 10), '#4d9c2a', {
        strokeWidth: 0.014,
      });
      crownShaft.position.set(curX, curY + 0.18, 0);
      pGrp.add(crownShaft);

      for (let c = 0; c < 4; c++) {
        const ang = (c / 4) * Math.PI * 2 + 0.4;
        const coco = makePart(coconutGeo, '#6b3e18', { strokeWidth: 0.012 });
        coco.position.set(curX + Math.cos(ang) * 0.24, curY + 0.02, Math.sin(ang) * 0.24);
        pGrp.add(coco);
      }

      // 11 Lush Arching Feather-Pinnate Palm Fronds (curved rachis spine + V-folded leaflets!)
      const rachisSpineGeo = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(1.15, 0.44, 0),
          new THREE.Vector3(2.25, 0.08, 0),
          new THREE.Vector3(3.32, -0.92, 0),
        ]),
        8,
        0.042,
        5,
        false,
      );
      for (let f = 0; f < 11; f++) {
        const fAng = (f / 11) * Math.PI * 2 + (f % 2) * 0.12;
        const isUpper = f % 2 === 0;
        const fHolder = new THREE.Group();
        fHolder.position.set(curX, curY + (isUpper ? 0.34 : 0.22), 0);
        fHolder.rotation.y = fAng;

        const frond = makePart(palmFrondGeo, isUpper ? '#4bb532' : '#389623', {
          strokeWidth: 0,
        });
        frond.rotation.z = isUpper ? 0.22 : -0.06;
        frond.scale.setScalar(isUpper ? 0.94 : 1.05);
        fHolder.add(frond);

        const spine = makePart(rachisSpineGeo, '#65a30d', {
          strokeWidth: 0.008,
          castShadow: false,
        });
        spine.rotation.z = isUpper ? 0.22 : -0.06;
        spine.scale.setScalar(isUpper ? 0.94 : 1.05);
        fHolder.add(spine);

        pGrp.add(fHolder);
      }
    }

    // Two Staved Nautical Wooden Barrels with Iron Hoops on the Boardwalk Foreground
    for (const [bx, bz] of [
      [96.4, -71.8],
      [97.3, -72.4],
    ]) {
      const bGrp = new THREE.Group();
      bGrp.position.set(bx, deckY, bz);
      staticParkGroup.add(bGrp);

      const bBody = makePart(
        new THREE.LatheGeometry(
          [
            new THREE.Vector2(0.0, 0.0),
            new THREE.Vector2(0.31, 0.0),
            new THREE.Vector2(0.38, 0.28),
            new THREE.Vector2(0.39, 0.58),
            new THREE.Vector2(0.31, 0.86),
            new THREE.Vector2(0.0, 0.86),
          ],
          14,
        ),
        '#8b5a2b',
        { strokeWidth: 0.018 },
      );
      bGrp.add(bBody);

      for (const hy of [0.16, 0.70]) {
        const hoop = makePart(
          new THREE.CylinderGeometry(0.37, 0.37, 0.065, 14),
          '#334155',
          { strokeWidth: 0.01 },
        );
        hoop.position.y = hy;
        bGrp.add(hoop);
      }
    }
  }

  // =========================================================================
  // 3. HERO RIDE #1 — BIANGLALA // GIANT FERRIS WHEEL (1:1 MODEL SHEET 2)
  // =========================================================================
  const bianglalaWheelPivot = new THREE.Group();
  const bianglalaGondolaGroups: THREE.Group[] = [];
  {
    const bw = mp.rides.bianglala;
    const baseGrp = new THREE.Group();
    baseGrp.position.set(bw.x, bw.deckY, bw.z);
    staticParkGroup.add(baseGrp);

    // 4 Stepped Chamfered Reinforced Concrete Pier Footing Pads + Gusset Plates
    const legTopZ = bw.rimSeparationZ * 0.5 + 0.52;
    const legVec = new THREE.Vector3();
    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        const fx = sx * bw.footingHalfSpanX;
        const fz = sz * bw.footingHalfSpanZ;

        const padLow = makePart(new THREE.BoxGeometry(2.05, 0.36, 2.05), '#94a3b8', {
          strokeWidth: 0.022,
        });
        padLow.position.set(fx, 0.18, fz);
        baseGrp.add(padLow);

        const padCap = makePart(new THREE.BoxGeometry(1.55, 0.34, 1.55), '#cbd5e1', {
          strokeWidth: 0.018,
        });
        padCap.position.set(fx, 0.52, fz);
        baseGrp.add(padCap);

        const pStart = new THREE.Vector3(fx, 0.62, fz);
        const pEnd = new THREE.Vector3(0, bw.axleHeightAboveDeck, sz * legTopZ);
        legVec.subVectors(pEnd, pStart);
        const legLen = legVec.length();
        const legMesh = makePart(
          new THREE.CylinderGeometry(0.24, 0.36, legLen, 12),
          '#e2e8f0',
          { strokeWidth: 0.022 },
        );
        legMesh.position.copy(pStart).add(pEnd).multiplyScalar(0.5);
        legMesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          legVec.clone().normalize(),
        );
        baseGrp.add(legMesh);
      }
    }

    // Horizontal & Diagonal K-Bracing Crossbeams on Front & Rear A-Frame Towers
    for (const sz of [-1, 1] as const) {
      for (const frac of [0.34, 0.66]) {
        const tieY = 0.62 + (bw.axleHeightAboveDeck - 0.62) * frac;
        const tieHalfX = bw.footingHalfSpanX * (1 - frac);
        const tieZ = sz * (bw.footingHalfSpanZ * (1 - frac) + legTopZ * frac);
        const tieBeam = makePart(new THREE.BoxGeometry(tieHalfX * 2, 0.24, 0.24), '#94a3b8', {
          strokeWidth: 0.018,
        });
        tieBeam.position.set(0, tieY, tieZ);
        baseGrp.add(tieBeam);
      }
    }

    // Timber Boarding Stage + Steps + Metal Queue Railings beneath Lower Wheel Arc (Sheet 2!)
    const stage = makePart(
      applyBoxMetricUvs(new THREE.BoxGeometry(7.8, 0.56, 4.6), 3.6, 4.0),
      '#ffffff',
      { map: plankTex, strokeWidth: 0.02 },
    );
    stage.position.set(0, 0.28, 0);
    baseGrp.add(stage);

    for (const railZ of [-2.18, 2.18]) {
      const qRail = makePart(new THREE.BoxGeometry(6.8, 0.78, 0.08), '#cbd5e1', {
        strokeWidth: 0.014,
      });
      qRail.position.set(0, 0.95, railZ);
      baseGrp.add(qRail);
    }

    const axleShaft = makePart(
      new THREE.CylinderGeometry(0.38, 0.38, bw.rimSeparationZ + 1.65, 16).rotateX(Math.PI / 2),
      '#475569',
      { strokeWidth: 0.022 },
    );
    axleShaft.position.set(0, bw.axleHeightAboveDeck, 0);
    baseGrp.add(axleShaft);

    // Animated Rotating Wheel Truss Assembly
    bianglalaWheelPivot.name = 'BianglalaRotatingWheel';
    bianglalaWheelPivot.position.set(bw.x, bw.deckY + bw.axleHeightAboveDeck, bw.z);
    rootGroup.add(bianglalaWheelPivot);

    const wheelFrameStatic = new THREE.Group();
    bianglalaWheelPivot.add(wheelFrameStatic);

    const rimHalfZ = bw.rimSeparationZ * 0.5;
    const innerChordR = bw.wheelRadius - 1.75;
    for (const zSide of [-rimHalfZ, rimHalfZ]) {
      const outerRim = makePart(new THREE.TorusGeometry(bw.wheelRadius, 0.17, 10, 64), '#f1f5f9', {
        strokeWidth: 0.022,
      });
      outerRim.position.z = zSide;
      wheelFrameStatic.add(outerRim);

      const innerRim = makePart(new THREE.TorusGeometry(innerChordR, 0.12, 8, 64), '#cbd5e1', {
        strokeWidth: 0.018,
      });
      innerRim.position.z = zSide;
      wheelFrameStatic.add(innerRim);

      const midRing = makePart(
        new THREE.TorusGeometry(bw.wheelRadius * 0.48, 0.095, 8, 40),
        '#94a3b8',
        { strokeWidth: 0.016 },
      );
      midRing.position.z = zSide;
      wheelFrameStatic.add(midRing);

      // Multi-ringed Sunburst Gold & Tangerine Hub Medallion (Sheet 1 & Sheet 2!)
      const hubOuter = makePart(new THREE.CylinderGeometry(1.52, 1.52, 0.24, 24), '#d97706', {
        strokeWidth: 0.022,
      });
      hubOuter.rotation.x = Math.PI / 2;
      hubOuter.position.z = zSide + Math.sign(zSide) * 0.14;
      wheelFrameStatic.add(hubOuter);

      const hubMid = makePart(new THREE.CylinderGeometry(1.12, 1.12, 0.28, 24), '#fbbf24', {
        strokeWidth: 0.018,
      });
      hubMid.rotation.x = Math.PI / 2;
      hubMid.position.z = zSide + Math.sign(zSide) * 0.18;
      wheelFrameStatic.add(hubMid);

      const hubCore = makePart(new THREE.CylinderGeometry(0.64, 0.64, 0.34, 20), '#fb923c', {
        strokeWidth: 0.016,
      });
      hubCore.rotation.x = Math.PI / 2;
      hubCore.position.z = zSide + Math.sign(zSide) * 0.22;
      wheelFrameStatic.add(hubCore);
    }

    // 16 Radial Spokes + Zig-Zag Perimeter Truss Webbing + Gondola Cabins
    const spokeGeo = new THREE.CylinderGeometry(0.072, 0.072, bw.wheelRadius, 8);
    const crossbarGeo = new THREE.CylinderGeometry(0.085, 0.085, bw.rimSeparationZ, 8);
    crossbarGeo.rotateX(Math.PI / 2);
    const trussVec = new THREE.Vector3();

    for (let i = 0; i < bw.gondolaCount; i++) {
      const ang = (i / bw.gondolaCount) * Math.PI * 2;
      const nextAng = ((i + 1) / bw.gondolaCount) * Math.PI * 2;
      const midAng = (ang + nextAng) * 0.5;
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);

      for (const zSide of [-rimHalfZ, rimHalfZ]) {
        const spoke = makePart(spokeGeo, '#e2e8f0', { strokeWidth: 0.012 });
        spoke.position.set(cosA * bw.wheelRadius * 0.5, sinA * bw.wheelRadius * 0.5, zSide);
        spoke.rotation.z = ang - Math.PI / 2;
        wheelFrameStatic.add(spoke);

        // Zig-zag diagonal truss diagonals between innerChordR and outerRim (1:1 Sheet 2!)
        const pInA = new THREE.Vector3(Math.cos(ang) * innerChordR, Math.sin(ang) * innerChordR, zSide);
        const pOutMid = new THREE.Vector3(
          Math.cos(midAng) * bw.wheelRadius,
          Math.sin(midAng) * bw.wheelRadius,
          zSide,
        );
        const pInB = new THREE.Vector3(
          Math.cos(nextAng) * innerChordR,
          Math.sin(nextAng) * innerChordR,
          zSide,
        );

        for (const [p0, p1] of [
          [pInA, pOutMid],
          [pOutMid, pInB],
        ] as const) {
          trussVec.subVectors(p1, p0);
          const dLen = trussVec.length();
          const diag = makePart(new THREE.CylinderGeometry(0.045, 0.045, dLen, 6), '#cbd5e1', {
            strokeWidth: 0.008,
            castShadow: false,
          });
          diag.position.copy(p0).add(p1).multiplyScalar(0.5);
          diag.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            trussVec.clone().normalize(),
          );
          wheelFrameStatic.add(diag);
        }
      }

      const gx = cosA * bw.wheelRadius;
      const gy = sinA * bw.wheelRadius;
      const cbar = makePart(crossbarGeo, '#94a3b8', { strokeWidth: 0.014 });
      cbar.position.set(gx, gy, 0);
      wheelFrameStatic.add(cbar);

      // Sculpted Vintage Sightseeing Gondola Cabin
      const gondolaPivot = new THREE.Group();
      gondolaPivot.position.set(gx, gy, 0);
      bianglalaWheelPivot.add(gondolaPivot);

      const gColor = BIANGLALA_GONDOLA_PALETTE[i % BIANGLALA_GONDOLA_PALETTE.length];
      for (const hz of [-0.68, 0.68]) {
        const hanger = makePart(new THREE.CylinderGeometry(0.042, 0.042, 0.68, 6), '#475569', {
          strokeWidth: 0.01,
        });
        hanger.position.set(0, -0.34, hz);
        gondolaPivot.add(hanger);
      }

      // Domed cupola roof + cream eave molding
      const gDome = makePart(
        new THREE.SphereGeometry(0.86, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.46),
        gColor,
        { strokeWidth: 0.018 },
      );
      gDome.scale.set(1.04, 0.56, 0.88);
      gDome.position.set(0, -0.92, 0);
      gondolaPivot.add(gDome);

      const gEave = makePart(new THREE.CylinderGeometry(0.90, 0.90, 0.11, 16), '#fffbeb', {
        strokeWidth: 0.012,
      });
      gEave.scale.set(1.04, 1.0, 0.88);
      gEave.position.set(0, -0.92, 0);
      gondolaPivot.add(gEave);

      // 6 Window Mullion Stanchions + Interior Passenger Bench
      const gPostGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.58, 6);
      for (let m = 0; m < 6; m++) {
        const ma = (m / 6) * Math.PI * 2 + 0.5;
        const gp = makePart(gPostGeo, '#f8fafc', { strokeWidth: 0.008 });
        gp.position.set(Math.cos(ma) * 0.78, -1.21, Math.sin(ma) * 0.66);
        gondolaPivot.add(gp);
      }

      // Rounded Tapered Lower Gondola Tub + Cream Beltline + Bench
      const gTub = makePart(new THREE.CylinderGeometry(0.86, 0.68, 0.74, 16), gColor, {
        strokeWidth: 0.02,
      });
      gTub.scale.set(1.04, 1.0, 0.88);
      gTub.position.set(0, -1.84, 0);
      gondolaPivot.add(gTub);

      const gRimBand = makePart(new THREE.CylinderGeometry(0.88, 0.87, 0.13, 16), '#fffbeb', {
        strokeWidth: 0.012,
      });
      gRimBand.scale.set(1.04, 1.0, 0.88);
      gRimBand.position.set(0, -1.52, 0);
      gondolaPivot.add(gRimBand);

      const gBench = makePart(new THREE.BoxGeometry(0.92, 0.14, 0.42), '#d97706', {
        strokeWidth: 0.01,
      });
      gBench.position.set(0, -1.72, 0);
      gondolaPivot.add(gBench);

      bakeStaticGroupMeshes(gondolaPivot, { minShadowCasterSpan: 0.6 });
      bianglalaGondolaGroups.push(gondolaPivot);
    }

    bakeStaticGroupMeshes(wheelFrameStatic, { minShadowCasterSpan: 0.8 });
  }

  // =========================================================================
  // 4. HERO RIDE #2 — KORA-KORA // SWINGING PIRATE SHIP (1:1 MODEL SHEET 4)
  // =========================================================================
  const koraSwingPivot = new THREE.Group();
  {
    const kk = mp.rides.koraKora;
    const kBase = new THREE.Group();
    kBase.position.set(kk.x, kk.deckY, kk.z);
    staticParkGroup.add(kBase);

    // Raised Plank-Textured Timber Docking Stage on Both Flanks + Balustrades
    for (const sideX of [-1, 1] as const) {
      const flankGeo = applyBoxMetricUvs(
        new THREE.BoxGeometry(2.05, kk.stageHeightAboveDeck, 8.8),
        3.6,
        4.0,
      );
      const flankDeck = makePart(flankGeo, '#ffffff', {
        map: plankTex,
        strokeWidth: 0.02,
      });
      flankDeck.position.set(sideX * 2.92, kk.stageHeightAboveDeck * 0.5, 0);
      kBase.add(flankDeck);

      // Balustrade posts + top & mid rails along docking stage
      const topR = makePart(new THREE.BoxGeometry(0.13, 0.09, 8.6), '#a67542', {
        strokeWidth: 0.014,
      });
      topR.position.set(sideX * 3.84, kk.stageHeightAboveDeck + 0.92, 0);
      kBase.add(topR);

      for (let rz = -4.1; rz <= 4.11; rz += 1.64) {
        const rp = makePart(new THREE.BoxGeometry(0.14, 0.95, 0.14), '#784c28', {
          strokeWidth: 0.012,
        });
        rp.position.set(sideX * 3.84, kk.stageHeightAboveDeck + 0.47, rz);
        kBase.add(rp);
      }
    }

    // West Boarding Staircase from Boardwalk (+1.10m) up to Docking Stage (+2.02m)
    for (let s = 0; s < 5; s++) {
      const sh = ((s + 1) / 5) * kk.stageHeightAboveDeck;
      const st = makePart(
        applyBoxMetricUvs(new THREE.BoxGeometry(0.42, sh, 4.2), 3.6, 4.0),
        '#ffffff',
        { map: plankTex, strokeWidth: 0.016 },
      );
      st.position.set(-5.48 + s * 0.39, sh * 0.5, 0);
      kBase.add(st);
    }

    // Detailed Under-Hull Dual Pneumatic Friction-Drive & Emergency Brake Bogie (Sheet 4!)
    const bogieFrame = makePart(new THREE.BoxGeometry(1.45, 0.28, 3.2), '#334155', {
      strokeWidth: 0.018,
    });
    bogieFrame.position.set(0, 0.22, 0);
    kBase.add(bogieFrame);

    for (const tz of [-0.96, 0.96]) {
      const tire = makePart(
        new THREE.TorusGeometry(0.44, 0.18, 10, 20).rotateY(Math.PI / 2),
        '#181b22',
        { strokeWidth: 0.018 },
      );
      tire.position.set(0, 0.62, tz);
      kBase.add(tire);

      const hub = makePart(
        new THREE.CylinderGeometry(0.28, 0.28, 0.42, 12).rotateZ(Math.PI / 2),
        '#94a3b8',
        { strokeWidth: 0.014 },
      );
      hub.position.set(0, 0.62, tz);
      kBase.add(hub);
    }

    // 4-Leg Heavy Steel A-Frame Support Tower + Gold Sunburst Bearing Medallions
    const topHalfX = 2.48;
    const legDir = new THREE.Vector3();
    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        const footPad = makePart(new THREE.BoxGeometry(1.35, 0.42, 1.35), '#94a3b8', {
          strokeWidth: 0.02,
        });
        footPad.position.set(sx * kk.towerBaseHalfX, 0.21, sz * kk.towerBaseHalfZ);
        kBase.add(footPad);

        const p0 = new THREE.Vector3(sx * kk.towerBaseHalfX, 0.36, sz * kk.towerBaseHalfZ);
        const p1 = new THREE.Vector3(sx * topHalfX, kk.pivotHeightAboveDeck, 0);
        legDir.subVectors(p1, p0);
        const leg = makePart(
          new THREE.CylinderGeometry(0.24, 0.34, legDir.length(), 12),
          '#dbe4ee',
          { strokeWidth: 0.022 },
        );
        leg.position.copy(p0).add(p1).multiplyScalar(0.5);
        leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), legDir.clone().normalize());
        kBase.add(leg);
      }

      // Ornate Gold & Amber Pivot Bearing Medallion on East & West Hubs (Sheet 1 & Sheet 4!)
      const hubOuter = makePart(new THREE.CylinderGeometry(0.95, 0.95, 0.28, 20), '#d97706', {
        strokeWidth: 0.022,
      });
      hubOuter.rotation.z = Math.PI / 2;
      hubOuter.position.set(sx * (topHalfX + 0.22), kk.pivotHeightAboveDeck, 0);
      kBase.add(hubOuter);

      const hubInner = makePart(new THREE.CylinderGeometry(0.62, 0.62, 0.34, 18), '#fbbf24', {
        strokeWidth: 0.016,
      });
      hubInner.rotation.z = Math.PI / 2;
      hubInner.position.set(sx * (topHalfX + 0.26), kk.pivotHeightAboveDeck, 0);
      kBase.add(hubInner);
    }

    const topAxle = makePart(
      new THREE.CylinderGeometry(0.34, 0.34, topHalfX * 2 + 0.95, 14).rotateZ(Math.PI / 2),
      '#334155',
      { strokeWidth: 0.022 },
    );
    topAxle.position.set(0, kk.pivotHeightAboveDeck, 0);
    kBase.add(topAxle);

    // Animated Swinging Pendulum & Lofted Carvel-Planked Pirate Galleon Hull
    koraSwingPivot.name = 'KoraKoraSwingAssembly';
    koraSwingPivot.position.set(kk.x, kk.deckY + kk.pivotHeightAboveDeck, kk.z);
    rootGroup.add(koraSwingPivot);

    const shipCenterY = -kk.pendulumLength;
    const strutVec = new THREE.Vector3();
    for (const sx of [-1.68, 1.68]) {
      for (const sz of [-3.45, 3.45]) {
        const sTop = new THREE.Vector3(sx * 1.26, 0, 0);
        const sBot = new THREE.Vector3(sx, shipCenterY + 0.95, sz);
        strutVec.subVectors(sBot, sTop);
        const strut = makePart(
          new THREE.CylinderGeometry(0.12, 0.14, strutVec.length(), 8),
          '#e2e8f0',
          { strokeWidth: 0.018 },
        );
        strut.position.copy(sTop).add(sBot).multiplyScalar(0.5);
        strut.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          strutVec.clone().normalize(),
        );
        koraSwingPivot.add(strut);
      }
    }

    // Central steel lattice mast hanger with horizontal rungs (Sheet 4 Side Elevation!)
    for (const sx of [-0.66, 0.66]) {
      const mast = makePart(
        new THREE.CylinderGeometry(0.1, 0.11, kk.pendulumLength - 1.1, 8),
        '#cbd5e1',
        { strokeWidth: 0.016 },
      );
      mast.position.set(sx, -kk.pendulumLength * 0.5 + 0.45, 0);
      koraSwingPivot.add(mast);
    }
    for (let ry = -2.2; ry >= -kk.pendulumLength + 2.2; ry -= 1.8) {
      const rung = makePart(new THREE.BoxGeometry(1.32, 0.12, 0.12), '#94a3b8', {
        strokeWidth: 0.012,
      });
      rung.position.set(0, ry, 0);
      koraSwingPivot.add(rung);
    }

    // Smooth Continuous Lofted Carvel-Planked Galleon Hull Mesh!
    const hullGeo = createLoftedGalleonHullGeometry(kk.hullLength, kk.hullWidth);
    const hullMesh = makePart(hullGeo, '#ffffff', {
      map: hullWoodTex,
      strokeWidth: 0.024,
    });
    hullMesh.position.set(0, shipCenterY + 0.65, 0);
    koraSwingPivot.add(hullMesh);

    // Sweeping Gold Baroque Gunwale Trim Tubes & Brass Cannon-Port Medallions along Both Hull Sides
    const halfLen = kk.hullLength * 0.5;
    for (const sideSign of [-1, 1] as const) {
      const railPts: THREE.Vector3[] = [];
      for (let k = 0; k <= 10; k++) {
        const zn = (k / 10) * 2.0 - 1.0;
        const z = zn * halfLen;
        const taper =
          zn < 0
            ? Math.pow(Math.max(0.05, 1.0 - Math.pow(-zn, 1.85)), 0.78)
            : Math.pow(Math.max(0.28, 1.0 - Math.pow(zn, 2.35) * 0.66), 0.75);
        const x = sideSign * (kk.hullWidth * 0.5) * taper;
        const y = shipCenterY + 0.65 + Math.pow(Math.abs(zn), 2.05) * 2.05 + (zn > 0 ? zn * 0.32 : 0);
        railPts.push(new THREE.Vector3(x, y, z));

        if (k >= 2 && k <= 8) {
          const portRing = makePart(
            new THREE.CylinderGeometry(0.18, 0.18, 0.08, 12).rotateZ(Math.PI / 2),
            '#fbbf24',
            { strokeWidth: 0.01 },
          );
          portRing.position.set(x * 0.96, y - 0.42, z);
          koraSwingPivot.add(portRing);
        }
      }
      const gunwaleCurve = new THREE.CatmullRomCurve3(railPts);
      const gunwaleTube = makePart(
        new THREE.TubeGeometry(gunwaleCurve, 20, 0.095, 8, false),
        '#eab308',
        { strokeWidth: 0.014 },
      );
      koraSwingPivot.add(gunwaleTube);
    }

    // 7 Tiered Wooden Passenger Benches + Safety Lap Bars inside the Galleon
    for (let b = -3; b <= 3; b++) {
      const zn = b / 4.6;
      const z = zn * halfLen;
      const benchW = kk.hullWidth * (1.0 - Math.abs(zn) * 0.46) * 0.72;
      const by = shipCenterY + 0.55 + Math.pow(Math.abs(zn), 2.0) * 1.45;
      const bench = makePart(new THREE.BoxGeometry(benchW, 0.34, 0.46), '#d9a05b', {
        strokeWidth: 0.014,
      });
      bench.position.set(0, by, z);
      koraSwingPivot.add(bench);

      const lapBar = makePart(new THREE.CylinderGeometry(0.035, 0.035, benchW * 0.92, 6).rotateZ(Math.PI / 2), '#cbd5e1', {
        strokeWidth: 0.008,
      });
      lapBar.position.set(0, by + 0.28, z - 0.18);
      koraSwingPivot.add(lapBar);
    }

    // Sculpted S-Curved Sea-Dragon Figurehead on North Bow (z = -halfLen)
    const dragonCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, shipCenterY + 2.35, -halfLen + 0.35),
      new THREE.Vector3(0, shipCenterY + 2.95, -halfLen - 0.35),
      new THREE.Vector3(0, shipCenterY + 3.68, -halfLen - 0.62),
      new THREE.Vector3(0, shipCenterY + 3.92, -halfLen - 1.05),
    ]);
    const dragonNeck = makePart(
      new THREE.TubeGeometry(dragonCurve, 12, 0.28, 10, false),
      '#d97706',
      { strokeWidth: 0.02 },
    );
    koraSwingPivot.add(dragonNeck);

    const dragonSnout = makePart(new THREE.ConeGeometry(0.32, 0.86, 8).rotateX(-Math.PI / 2 - 0.15), '#eab308', {
      strokeWidth: 0.018,
    });
    dragonSnout.position.set(0, shipCenterY + 3.96, -halfLen - 1.38);
    koraSwingPivot.add(dragonSnout);

    const dragonJaw = makePart(new THREE.ConeGeometry(0.22, 0.68, 8).rotateX(-Math.PI / 2 + 0.28), '#b45309', {
      strokeWidth: 0.014,
    });
    dragonJaw.position.set(0, shipCenterY + 3.68, -halfLen - 1.28);
    koraSwingPivot.add(dragonJaw);

    for (const hx of [-0.22, 0.22]) {
      const horn = makePart(new THREE.ConeGeometry(0.09, 0.68, 6), '#fef08a', {
        strokeWidth: 0.012,
      });
      horn.position.set(hx, shipCenterY + 4.28, -halfLen - 0.78);
      horn.rotation.x = 0.55;
      horn.rotation.z = -hx * 0.8;
      koraSwingPivot.add(horn);
    }

    // Ornate Captain's Stern Poop Cabin + Mullioned Lantern Windows + Stern Lantern (z = +halfLen)
    const sternCabin = makePart(new THREE.BoxGeometry(2.15, 1.38, 1.95), '#6d3b1a', {
      strokeWidth: 0.022,
    });
    sternCabin.position.set(0, shipCenterY + 2.88, halfLen - 0.95);
    sternCabin.rotation.x = -0.22;
    koraSwingPivot.add(sternCabin);

    const sternRoof = makePart(new THREE.BoxGeometry(2.38, 0.22, 2.15), '#eab308', {
      strokeWidth: 0.018,
    });
    sternRoof.position.set(0, shipCenterY + 3.62, halfLen - 0.95);
    sternRoof.rotation.x = -0.22;
    koraSwingPivot.add(sternRoof);

    const sternWindows = makePart(new THREE.BoxGeometry(2.22, 0.44, 1.25), '#fef08a', {
      strokeWidth: 0.014,
    });
    sternWindows.position.set(0, shipCenterY + 3.02, halfLen - 0.92);
    sternWindows.rotation.x = -0.22;
    koraSwingPivot.add(sternWindows);

    const sternLantern = makePart(new THREE.SphereGeometry(0.24, 10, 10), '#fde047', {
      strokeWidth: 0.014,
    });
    sternLantern.position.set(0, shipCenterY + 4.02, halfLen - 0.05);
    koraSwingPivot.add(sternLantern);

    bakeStaticGroupMeshes(koraSwingPivot, { minShadowCasterSpan: 0.7 });
  }

  // =========================================================================
  // 5. HERO RIDE #3 — KOMIDI PUTAR // VINTAGE CAROUSEL (1:1 MODEL SHEET 6)
  // =========================================================================
  const komidiRotatingPivot = new THREE.Group();
  const komidiHorseNodes: { group: THREE.Group; baseY: number }[] = [];
  {
    const kp = mp.rides.komidiPutar;
    const kpStatic = new THREE.Group();
    kpStatic.position.set(kp.x, kp.baseY, kp.z);
    staticParkGroup.add(kpStatic);

    // 3-Step Circular Hardwood & Polished Brass Podium
    for (const [rad, topH, col] of [
      [5.20, 0.22, '#b98952'],
      [4.90, 0.44, '#cfa065'],
      [4.60, 0.66, '#e2b77b'],
    ] as const) {
      const stepCyl = makePart(new THREE.CylinderGeometry(rad, rad + 0.05, 0.22, 40), col, {
        strokeWidth: 0.02,
      });
      stepCyl.position.y = topH - 0.11;
      kpStatic.add(stepCyl);

      const brassLip = makePart(
        new THREE.TorusGeometry(rad + 0.01, 0.028, 6, 40).rotateX(Math.PI / 2),
        '#eab308',
        { strokeWidth: 0.008 },
      );
      brassLip.position.y = topH - 0.01;
      kpStatic.add(brassLip);
    }

    // Brass Ball-Top Stanchions & Sagging Crimson Velvet Safety Rope Barrier
    const stanchionCount = 20;
    const stanchionGeo = new THREE.CylinderGeometry(0.042, 0.055, 0.96, 8);
    const ballTopGeo = new THREE.SphereGeometry(0.075, 8, 8);
    for (let s = 0; s < stanchionCount; s++) {
      if (s === 0 || s === 10) continue;
      const a0 = (s / stanchionCount) * Math.PI * 2;
      const a1 = ((s + 1) / stanchionCount) * Math.PI * 2;
      const sx = Math.cos(a0) * kp.fenceRadius;
      const sz = Math.sin(a0) * kp.fenceRadius;
      const post = makePart(stanchionGeo, '#eab308', { strokeWidth: 0.012 });
      post.position.set(sx, 0.48, sz);
      kpStatic.add(post);

      const ball = makePart(ballTopGeo, '#fbbf24', { strokeWidth: 0.008 });
      ball.position.set(sx, 0.98, sz);
      kpStatic.add(ball);

      if (s + 1 !== 10 && s + 1 !== stanchionCount) {
        const nx = Math.cos(a1) * kp.fenceRadius;
        const nz = Math.sin(a1) * kp.fenceRadius;
        const rCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(sx, 0.84, sz),
          new THREE.Vector3((sx + nx) * 0.5, 0.68, (sz + nz) * 0.5),
          new THREE.Vector3(nx, 0.84, nz),
        ]);
        const rope = makePart(new THREE.TubeGeometry(rCurve, 6, 0.032, 6, false), '#b91c1c', {
          strokeWidth: 0.008,
        });
        kpStatic.add(rope);
      }
    }

    // Carved Vintage Wooden Operator Ticket Podium (Sheet 6!)
    const podium = makePart(new THREE.BoxGeometry(1.08, 1.26, 0.98), '#92400e', {
      strokeWidth: 0.02,
    });
    podium.position.set(kp.ticketPodiumX, 0.63, kp.ticketPodiumZ);
    staticParkGroup.add(podium);
    const podiumPanel = makePart(new THREE.BoxGeometry(0.82, 0.84, 1.03), '#fde68a', {
      strokeWidth: 0.012,
    });
    podiumPanel.position.set(kp.ticketPodiumX, 0.63, kp.ticketPodiumZ);
    staticParkGroup.add(podiumPanel);
    const podiumTop = makePart(new THREE.BoxGeometry(1.22, 0.16, 1.12), '#eab308', {
      strokeWidth: 0.016,
    });
    podiumTop.position.set(kp.ticketPodiumX, 1.32, kp.ticketPodiumZ);
    staticParkGroup.add(podiumTop);

    // Rotating Turntable Assembly
    komidiRotatingPivot.name = 'KomidiPutarRotatingAssembly';
    komidiRotatingPivot.position.set(kp.x, kp.baseY + 0.66, kp.z);
    rootGroup.add(komidiRotatingPivot);

    const kpFrameGroup = new THREE.Group();
    komidiRotatingPivot.add(kpFrameGroup);

    // Ornate 8-Sided Baroque Central Column with Gilded Corner Pilasters & 8 Scenic Panels!
    const centerColGeo = applyCylinderMetricUvs(
      new THREE.CylinderGeometry(1.32, 1.44, 3.68, 16),
      2,
      1,
    );
    const centerCol = makePart(centerColGeo, '#ffffff', {
      map: baroqueCorniceTex,
      strokeWidth: 0.022,
    });
    centerCol.position.y = 1.84;
    kpFrameGroup.add(centerCol);

    for (let p = 0; p < 8; p++) {
      const pa = (p / 8) * Math.PI * 2;
      const pilaster = makePart(new THREE.CylinderGeometry(0.11, 0.13, 3.72, 8), '#eab308', {
        strokeWidth: 0.012,
      });
      pilaster.position.set(Math.cos(pa) * 1.38, 1.84, Math.sin(pa) * 1.38);
      kpFrameGroup.add(pilaster);
    }

    const upperColFlair = makePart(new THREE.CylinderGeometry(2.25, 1.35, 0.76, 16), '#eab308', {
      strokeWidth: 0.02,
    });
    upperColFlair.position.y = 3.96;
    kpFrameGroup.add(upperColFlair);

    // 16-Medallion Baroque Gilded Cornice + 16 Sculpted Rococo Shell Crests!
    const corniceGeo = applyCylinderMetricUvs(
      new THREE.CylinderGeometry(kp.canopyRadius, kp.canopyRadius - 0.1, 1.06, 32, 1, false),
      4,
      1,
    );
    const cornice = makePart(corniceGeo, '#ffffff', {
      map: baroqueCorniceTex,
      strokeWidth: 0.022,
    });
    cornice.position.y = 4.56;
    kpFrameGroup.add(cornice);

    for (let c = 0; c < 16; c++) {
      const ca = ((c + 0.5) / 16) * Math.PI * 2;
      const crest = makePart(new THREE.SphereGeometry(0.32, 10, 8), '#fbbf24', {
        strokeWidth: 0.014,
      });
      crest.scale.set(1.35, 0.85, 0.35);
      crest.position.set(
        Math.cos(ca) * (kp.canopyRadius + 0.03),
        5.12,
        Math.sin(ca) * (kp.canopyRadius + 0.03),
      );
      crest.rotation.y = -ca + Math.PI / 2;
      kpFrameGroup.add(crest);
    }

    const ceilingDisc = makePart(
      new THREE.CylinderGeometry(kp.canopyRadius - 0.14, kp.canopyRadius - 0.14, 0.12, 32),
      '#fef3c7',
      { strokeWidth: 0.014 },
    );
    ceilingDisc.position.y = 4.02;
    kpFrameGroup.add(ceilingDisc);

    // True Concave Catenary 16-Gore Cream & Champagne-Gold Circus Canopy + Raised Gold Ribs!
    for (let g = 0; g < 16; g++) {
      const a0 = (g / 16) * Math.PI * 2;
      const a1 = ((g + 1) / 16) * Math.PI * 2;
      const goreGeo = createConcaveCanopyGoreGeometry(
        kp.canopyRadius + 0.14,
        3.12,
        a0,
        a1,
        0.24,
        7,
        2,
      );
      const goreMesh = makePart(goreGeo, g % 2 === 0 ? '#fffbeb' : '#f3c14b', {
        strokeWidth: 0,
      });
      goreMesh.position.y = 5.08;
      kpFrameGroup.add(goreMesh);

      // Gilded radial seam rib along each gore boundary
      const ribPts: THREE.Vector3[] = [];
      for (let rt = 0; rt <= 5; rt++) {
        const t = rt / 5;
        const r = (kp.canopyRadius + 0.15) * Math.pow(t, 0.96);
        const y = 5.08 + 3.12 * (1 - t) - 0.24 * Math.sin(t * Math.PI) + 0.03;
        ribPts.push(new THREE.Vector3(Math.cos(a0) * r, y, Math.sin(a0) * r));
      }
      const ribTube = makePart(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ribPts), 8, 0.036, 6, false),
        '#d97706',
        { strokeWidth: 0.008 },
      );
      kpFrameGroup.add(ribTube);
    }

    // Tiered Brass Bell Finial & Gilded Crest on Canopy Apex (Sheet 6!)
    const crownBell = makePart(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.76, 0.0),
          new THREE.Vector2(0.52, 0.34),
          new THREE.Vector2(0.28, 0.68),
          new THREE.Vector2(0.38, 0.88),
          new THREE.Vector2(0.14, 1.18),
          new THREE.Vector2(0.0, 1.32),
        ],
        16,
      ),
      '#eab308',
      { strokeWidth: 0.02 },
    );
    crownBell.position.y = 7.98;
    kpFrameGroup.add(crownBell);

    // Warm Carnival Light Bulbs Ring under Carousel Cornice
    const kpBulbGeo = new THREE.SphereGeometry(0.088, 6, 6);
    const kpBulbInst = new THREE.InstancedMesh(kpBulbGeo, warmAmberBulbMat, 32);
    disposableGeometries.push(kpBulbGeo);
    const tmpMat4 = new THREE.Matrix4();
    for (let b = 0; b < 32; b++) {
      const ba = (b / 32) * Math.PI * 2;
      tmpMat4.makeTranslation(
        Math.cos(ba) * (kp.canopyRadius - 0.05),
        4.01,
        Math.sin(ba) * (kp.canopyRadius - 0.05),
      );
      kpBulbInst.setMatrixAt(b, tmpMat4);
    }
    kpBulbInst.instanceMatrix.needsUpdate = true;
    kpBulbInst.computeBoundingSphere();
    komidiRotatingPivot.add(kpBulbInst);

    // 10 Sculpted Prancing Carousel Horses + 2 Curved Baroque Sleigh Chariots
    const poleGeo = new THREE.CylinderGeometry(0.048, 0.048, 4.02, 8);
    const horseCoats = ['#fffbeb', '#f8fafc', '#fed7aa', '#fef3c7', '#f1f5f9'];
    const saddleColors = ['#ef4444', '#0ea5e9', '#a855f7', '#10b981', '#ec4899'];
    let horseIdx = 0;

    for (let slot = 0; slot < 12; slot++) {
      const ang = (slot / 12) * Math.PI * 2;
      const ringR = slot % 2 === 0 ? 3.55 : 2.75;
      const sx = Math.cos(ang) * ringR;
      const sz = Math.sin(ang) * ringR;
      const tangentYaw = -ang;

      const pole = makePart(poleGeo, '#eab308', { strokeWidth: 0.012 });
      pole.position.set(sx, 2.01, sz);
      kpFrameGroup.add(pole);

      if (slot === 3 || slot === 9) {
        const chariot = new THREE.Group();
        chariot.position.set(sx, 0.04, sz);
        chariot.rotation.y = tangentYaw;

        const cShell = makePart(new THREE.CylinderGeometry(0.68, 0.58, 1.18, 14), '#eab308', {
          strokeWidth: 0.018,
        });
        cShell.scale.set(0.92, 0.72, 1.38);
        cShell.position.y = 0.48;
        chariot.add(cShell);

        const cBackCrest = makePart(new THREE.SphereGeometry(0.62, 12, 8), '#d97706', {
          strokeWidth: 0.016,
        });
        cBackCrest.scale.set(0.92, 1.15, 0.36);
        cBackCrest.position.set(0, 0.78, -0.74);
        chariot.add(cBackCrest);

        const cSeat = makePart(new THREE.BoxGeometry(0.92, 0.28, 0.68), '#dc2626', {
          strokeWidth: 0.014,
        });
        cSeat.position.set(0, 0.62, -0.22);
        chariot.add(cSeat);

        kpFrameGroup.add(chariot);
      } else {
        const horseGrp = new THREE.Group();
        const baseHorseY = 1.06;
        horseGrp.position.set(sx, baseHorseY, sz);
        horseGrp.rotation.y = tangentYaw;

        const coatHex = horseCoats[horseIdx % horseCoats.length];
        const saddleHex = saddleColors[horseIdx % saddleColors.length];

        // Sculpted muscular chest, barrel torso & hindquarters
        const torso = makePart(new THREE.CapsuleGeometry(0.26, 0.66, 8, 12), coatHex, {
          strokeWidth: 0.016,
        });
        torso.rotation.x = Math.PI / 2;
        horseGrp.add(torso);

        const chest = makePart(new THREE.SphereGeometry(0.29, 10, 10), coatHex, {
          strokeWidth: 0.014,
        });
        chest.position.set(0, 0.05, 0.34);
        horseGrp.add(chest);

        const croup = makePart(new THREE.SphereGeometry(0.28, 10, 10), coatHex, {
          strokeWidth: 0.014,
        });
        croup.position.set(0, 0.04, -0.34);
        horseGrp.add(croup);

        // Gilded & painted saddlecloth + breastplate strap
        const saddle = makePart(new THREE.CylinderGeometry(0.30, 0.30, 0.42, 12), saddleHex, {
          strokeWidth: 0.014,
        });
        saddle.rotation.x = Math.PI / 2;
        saddle.position.set(0, 0.07, -0.02);
        horseGrp.add(saddle);

        const strap = makePart(new THREE.TorusGeometry(0.28, 0.032, 6, 12), '#eab308', {
          strokeWidth: 0.008,
        });
        strap.position.set(0, 0.08, 0.34);
        strap.rotation.x = 0.4;
        horseGrp.add(strap);

        // Arched neck, sculpted equine head, muzzle, ears & golden flowing mane
        const neck = makePart(new THREE.CylinderGeometry(0.14, 0.24, 0.64, 10), coatHex, {
          strokeWidth: 0.016,
        });
        neck.position.set(0, 0.38, 0.44);
        neck.rotation.x = 0.44;
        horseGrp.add(neck);

        const head = makePart(new THREE.CapsuleGeometry(0.13, 0.28, 6, 10), coatHex, {
          strokeWidth: 0.014,
        });
        head.position.set(0, 0.66, 0.66);
        head.rotation.x = 1.18;
        horseGrp.add(head);

        for (const ex of [-0.07, 0.07]) {
          const ear = makePart(new THREE.ConeGeometry(0.045, 0.14, 6), coatHex, {
            strokeWidth: 0.008,
          });
          ear.position.set(ex, 0.84, 0.56);
          horseGrp.add(ear);
        }

        const mane = makePart(new THREE.BoxGeometry(0.09, 0.56, 0.20), '#eab308', {
          strokeWidth: 0.012,
        });
        mane.position.set(0, 0.46, 0.33);
        mane.rotation.x = 0.44;
        horseGrp.add(mane);

        const tailCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0.12, -0.56),
          new THREE.Vector3(0, 0.04, -0.78),
          new THREE.Vector3(0, -0.32, -0.92),
        ]);
        const tail = makePart(new THREE.TubeGeometry(tailCurve, 8, 0.075, 7, false), '#eab308', {
          strokeWidth: 0.012,
        });
        horseGrp.add(tail);

        // 4 Jointed Prancing Legs + Golden Hooves
        const thighGeo = new THREE.CylinderGeometry(0.068, 0.052, 0.34, 8);
        const shinGeo = new THREE.CylinderGeometry(0.048, 0.042, 0.32, 8);
        for (const [lx, lz, aUpper, aLower] of [
          [-0.14, 0.38, -0.68, 0.45],
          [0.14, 0.38, -0.42, 0.25],
          [-0.14, -0.38, 0.52, -0.35],
          [0.14, -0.38, 0.32, -0.18],
        ]) {
          const legPivot = new THREE.Group();
          legPivot.position.set(lx, -0.14, lz);
          legPivot.rotation.x = aUpper;
          const thigh = makePart(thighGeo, coatHex, { strokeWidth: 0.01 });
          thigh.position.y = -0.16;
          legPivot.add(thigh);

          const knee = new THREE.Group();
          knee.position.y = -0.32;
          knee.rotation.x = aLower;
          const shin = makePart(shinGeo, coatHex, { strokeWidth: 0.01 });
          shin.position.y = -0.15;
          knee.add(shin);

          const hoof = makePart(new THREE.CylinderGeometry(0.048, 0.056, 0.08, 8), '#eab308', {
            strokeWidth: 0.008,
          });
          hoof.position.y = -0.32;
          knee.add(hoof);

          legPivot.add(knee);
          horseGrp.add(legPivot);
        }

        bakeStaticGroupMeshes(horseGrp, { minShadowCasterSpan: 0.5 });
        komidiRotatingPivot.add(horseGrp);
        komidiHorseNodes.push({ group: horseGrp, baseY: baseHorseY });
        horseIdx++;
      }
    }

    bakeStaticGroupMeshes(kpFrameGroup, { minShadowCasterSpan: 0.6 });
  }

  // =========================================================================
  // 6. HERO RIDE #4 — ONTAG-ANTING // WAVE SWINGER (1:1 MODEL SHEET 5)
  // =========================================================================
  const ontagTiltCarrier = new THREE.Group();
  const ontagSpinCanopy = new THREE.Group();
  const ontagChairPivots: THREE.Group[] = [];
  {
    const oa = mp.rides.ontagAnting;
    const oaStatic = new THREE.Group();
    oaStatic.position.set(oa.x, oa.baseY, oa.z);
    staticParkGroup.add(oaStatic);

    // 3-Step Circular Travertine Podium Foundation
    for (const [rad, topH, col] of [
      [5.95, 0.24, '#e5d9c3'],
      [5.15, 0.48, '#efe5d4'],
      [4.35, 0.72, '#f8f1e5'],
    ] as const) {
      const s = makePart(new THREE.CylinderGeometry(rad, rad + 0.06, 0.24, 40), col, {
        strokeWidth: 0.02,
      });
      s.position.y = topH - 0.12;
      oaStatic.add(s);
    }

    // Ornate Wrought-Iron Picket & Scrollwork Safety Perimeter Fence + Entry Turnstile Gate (Sheet 5!)
    const fenceSegs = 24;
    const fPostGeo = new THREE.CylinderGeometry(0.052, 0.062, 1.08, 8);
    const picketGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.82, 5);
    for (let i = 0; i < fenceSegs; i++) {
      if (i === 0) continue; // East Turnstile Gate opening
      const a0 = (i / fenceSegs) * Math.PI * 2;
      const a1 = ((i + 1) / fenceSegs) * Math.PI * 2;
      const fx = Math.cos(a0) * oa.fenceRadius;
      const fz = Math.sin(a0) * oa.fenceRadius;
      const fp = makePart(fPostGeo, '#1e293b', { strokeWidth: 0.012 });
      fp.position.set(fx, 0.54, fz);
      oaStatic.add(fp);

      const postFinial = makePart(new THREE.SphereGeometry(0.075, 8, 8), '#eab308', {
        strokeWidth: 0.008,
      });
      postFinial.position.set(fx, 1.12, fz);
      oaStatic.add(postFinial);

      if (i + 1 < fenceSegs) {
        const nx = Math.cos(a1) * oa.fenceRadius;
        const nz = Math.sin(a1) * oa.fenceRadius;
        const segLen = Math.hypot(nx - fx, nz - fz);
        const yaw = Math.atan2(nx - fx, nz - fz);

        const railGrp = new THREE.Group();
        railGrp.position.set((fx + nx) * 0.5, 0, (fz + nz) * 0.5);
        railGrp.rotation.y = yaw;
        oaStatic.add(railGrp);

        for (const ry of [0.18, 0.94]) {
          const rBar = makePart(new THREE.BoxGeometry(0.05, 0.05, segLen), '#334155', {
            strokeWidth: 0.01,
          });
          rBar.position.y = ry;
          railGrp.add(rBar);
        }
        for (let pk = -2; pk <= 2; pk++) {
          const p = makePart(picketGeo, '#475569', { strokeWidth: 0.006, castShadow: false });
          p.position.set(0, 0.56, pk * (segLen / 6));
          railGrp.add(p);
        }
      }
    }

    // 4-Tier Telescoping Octagonal Baroque Painted & Gilded Central Column (1:1 Sheet 5!)
    const tiers: readonly [number, number, number, number][] = [
      [1.48, 1.62, 1.68, 1.56],
      [1.22, 1.38, 1.76, 3.28],
      [1.06, 1.16, 1.76, 5.04],
      [0.96, 1.04, 1.56, 6.70],
    ];
    for (const [rTop, rBot, h, cy] of tiers) {
      const colGeo = applyCylinderMetricUvs(
        new THREE.CylinderGeometry(rTop, rBot, h, 8),
        2,
        1,
      );
      const colTier = makePart(colGeo, '#ffffff', {
        map: baroqueCorniceTex,
        strokeWidth: 0.022,
      });
      colTier.position.y = cy;
      oaStatic.add(colTier);

      // 8 Protruding Gold Corner Pilasters around Octagonal Tier
      for (let k = 0; k < 8; k++) {
        const ka = (k / 8) * Math.PI * 2 + Math.PI / 8;
        const rMid = (rTop + rBot) * 0.5;
        const pil = makePart(new THREE.CylinderGeometry(0.075, 0.088, h, 6), '#eab308', {
          strokeWidth: 0.01,
        });
        pil.position.set(Math.cos(ka) * rMid, cy, Math.sin(ka) * rMid);
        oaStatic.add(pil);
      }

      const collar = makePart(
        new THREE.CylinderGeometry(rBot + 0.14, rBot + 0.19, 0.22, 8),
        '#d97706',
        { strokeWidth: 0.016 },
      );
      collar.position.y = cy - h * 0.5 + 0.08;
      oaStatic.add(collar);
    }

    // Sculpted Tilted Knuckle Joint + Tilted Rotating Baroque Umbrella Canopy & 16 Swing Chairs
    const knuckle = makePart(new THREE.SphereGeometry(0.92, 14, 12), '#d97706', {
      strokeWidth: 0.018,
    });
    knuckle.position.set(0, 7.52, 0);
    oaStatic.add(knuckle);

    ontagTiltCarrier.name = 'OntagAntingTiltCarrier';
    ontagTiltCarrier.position.set(oa.x, oa.baseY + 7.58, oa.z);
    ontagTiltCarrier.rotation.z = oa.tiltAngleRad;
    ontagTiltCarrier.rotation.x = -0.08;
    rootGroup.add(ontagTiltCarrier);

    ontagTiltCarrier.add(ontagSpinCanopy);
    const oaCanopyStatic = new THREE.Group();
    ontagSpinCanopy.add(oaCanopyStatic);

    // 16-Medallion Scalloped Baroque Cornice + 16 Gilded Rococo Crests + Paneled Underside Soffit!
    const oaCorniceGeo = applyCylinderMetricUvs(
      new THREE.CylinderGeometry(oa.canopyRadius, oa.canopyRadius - 0.24, 1.10, 32, 1, false),
      4,
      1,
    );
    const oaCornice = makePart(oaCorniceGeo, '#ffffff', {
      map: baroqueCorniceTex,
      strokeWidth: 0.022,
    });
    oaCornice.position.y = 0.66;
    oaCanopyStatic.add(oaCornice);

    for (let c = 0; c < 16; c++) {
      const ca = ((c + 0.5) / 16) * Math.PI * 2;
      const crest = makePart(new THREE.SphereGeometry(0.30, 10, 8), '#fbbf24', {
        strokeWidth: 0.014,
      });
      crest.scale.set(1.35, 0.85, 0.35);
      crest.position.set(
        Math.cos(ca) * (oa.canopyRadius + 0.02),
        1.22,
        Math.sin(ca) * (oa.canopyRadius + 0.02),
      );
      crest.rotation.y = -ca + Math.PI / 2;
      oaCanopyStatic.add(crest);
    }

    const oaUnderCone = makePart(
      new THREE.CylinderGeometry(oa.canopyRadius - 0.22, 1.02, 0.72, 24),
      '#faefd6',
      { strokeWidth: 0.016 },
    );
    oaUnderCone.position.y = -0.15;
    oaCanopyStatic.add(oaUnderCone);

    // Concave Catenary 16-Gore Coral-Ochre & Warm Ivory Umbrella Canopy + Raised Gold Ribs!
    for (let g = 0; g < 16; g++) {
      const a0 = (g / 16) * Math.PI * 2;
      const a1 = ((g + 1) / 16) * Math.PI * 2;
      const goreGeo = createConcaveCanopyGoreGeometry(
        oa.canopyRadius + 0.14,
        2.32,
        a0,
        a1,
        0.18,
        6,
        2,
      );
      const goreMesh = makePart(goreGeo, g % 2 === 0 ? '#fff7ed' : '#ea580c', {
        strokeWidth: 0,
      });
      goreMesh.position.y = 1.18;
      oaCanopyStatic.add(goreMesh);

      const ribPts: THREE.Vector3[] = [];
      for (let rt = 0; rt <= 4; rt++) {
        const t = rt / 4;
        const r = (oa.canopyRadius + 0.15) * Math.pow(t, 0.96);
        const y = 1.18 + 2.32 * (1 - t) - 0.18 * Math.sin(t * Math.PI) + 0.03;
        ribPts.push(new THREE.Vector3(Math.cos(a0) * r, y, Math.sin(a0) * r));
      }
      const ribTube = makePart(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ribPts), 6, 0.034, 6, false),
        '#eab308',
        { strokeWidth: 0.008 },
      );
      oaCanopyStatic.add(ribTube);
    }

    // Ornate Gilded Baroque Onion-Dome Crown Finial (Sheet 5!)
    const oaCrown = makePart(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.72, 0.0),
          new THREE.Vector2(0.56, 0.22),
          new THREE.Vector2(0.68, 0.55),
          new THREE.Vector2(0.42, 0.92),
          new THREE.Vector2(0.14, 1.18),
          new THREE.Vector2(0.0, 1.32),
        ],
        16,
      ),
      '#eab308',
      { strokeWidth: 0.018 },
    );
    oaCrown.position.y = 3.32;
    oaCanopyStatic.add(oaCrown);

    // 16 Detailed Chain-Suspended Wave-Swinger Bucket Chairs
    const chainLen = 4.35;
    const chainGeo = new THREE.CylinderGeometry(0.022, 0.022, chainLen, 6);
    for (let i = 0; i < oa.chairCount; i++) {
      const ang = (i / oa.chairCount) * Math.PI * 2;
      const attachR = oa.canopyRadius - 0.34;
      const chairAnchor = new THREE.Group();
      chairAnchor.position.set(Math.cos(ang) * attachR, 0.12, Math.sin(ang) * attachR);
      chairAnchor.rotation.y = -ang;
      ontagSpinCanopy.add(chairAnchor);

      const swingArm = new THREE.Group();
      chairAnchor.add(swingArm);

      // Spreader bar + twin steel suspension chains
      for (const cz of [-0.26, 0.26]) {
        const ch = makePart(chainGeo, '#cbd5e1', { strokeWidth: 0.005, castShadow: false });
        ch.position.set(0, -chainLen * 0.5, cz);
        swingArm.add(ch);
      }
      const spreader = makePart(new THREE.CylinderGeometry(0.028, 0.028, 0.58, 6).rotateX(Math.PI / 2), '#94a3b8', {
        strokeWidth: 0.008,
        castShadow: false,
      });
      spreader.position.set(0, -chainLen + 0.54, 0);
      swingArm.add(spreader);

      // Contoured bucket seat + curved backrest + tubular armrests + safety lap bar
      const seatColor = i % 2 === 0 ? '#dc2626' : '#0284c7';
      const seatPan = makePart(new THREE.BoxGeometry(0.54, 0.11, 0.58), seatColor, {
        strokeWidth: 0.014,
      });
      seatPan.position.set(0.02, -chainLen, 0);
      swingArm.add(seatPan);

      const seatBack = makePart(new THREE.BoxGeometry(0.11, 0.58, 0.58), seatColor, {
        strokeWidth: 0.014,
      });
      seatBack.position.set(-0.22, -chainLen + 0.27, 0);
      seatBack.rotation.z = 0.12;
      swingArm.add(seatBack);

      for (const az of [-0.28, 0.28]) {
        const arm = makePart(new THREE.BoxGeometry(0.46, 0.05, 0.05), '#e2e8f0', {
          strokeWidth: 0.008,
        });
        arm.position.set(0.02, -chainLen + 0.24, az);
        swingArm.add(arm);
      }

      bakeStaticGroupMeshes(swingArm, { minShadowCasterSpan: 0.6 });
      ontagChairPivots.push(swingArm);
    }

    bakeStaticGroupMeshes(oaCanopyStatic, { minShadowCasterSpan: 0.7 });
  }

  // =========================================================================
  // 7. HERO RIDE #5 — BUMPER CAR ARENA ("BOM-BOM CAR", 1:1 SHEET 1 & SHEET 3)
  // =========================================================================
  const bumperCarGroups: THREE.Group[] = [];
  const arenaFloorY = 0.48;
  {
    const bc = mp.rides.bumperCarArena;
    const bcStatic = new THREE.Group();
    bcStatic.position.set(bc.x, bc.baseY, bc.z);
    staticParkGroup.add(bcStatic);

    const w = bc.halfX * 2;
    const d = bc.halfZ * 2;

    // Stepped Concrete Foundation Plinth + West Entry Steps
    const plinthLower = makePart(new THREE.BoxGeometry(w + 1.0, 0.24, d + 1.0), '#cbd5e1', {
      strokeWidth: 0.022,
    });
    plinthLower.position.y = 0.12;
    bcStatic.add(plinthLower);

    const plinthUpper = makePart(new THREE.BoxGeometry(w, 0.24, d), '#94a3b8', {
      strokeWidth: 0.022,
    });
    plinthUpper.position.y = 0.36;
    bcStatic.add(plinthUpper);

    // Dark Brushed Conductive Steel Floor
    const steelFloor = makePart(
      new THREE.BoxGeometry(bc.floorHalfX * 2, 0.06, bc.floorHalfZ * 2),
      '#334155',
      { strokeWidth: 0.016 },
    );
    steelFloor.position.y = arenaFloorY + 0.02;
    bcStatic.add(steelFloor);

    // Cushioned Arena Bumper Curb with Red/Chrome Trim Strip
    const curbH = 0.40;
    for (const sx of [-1, 1] as const) {
      const cSide = makePart(
        new THREE.BoxGeometry(0.44, curbH, bc.floorHalfZ * 2 + 0.44),
        '#1e293b',
        { strokeWidth: 0.016 },
      );
      cSide.position.set(sx * (bc.floorHalfX + 0.22), arenaFloorY + curbH * 0.5, 0);
      bcStatic.add(cSide);

      const trim = makePart(
        new THREE.BoxGeometry(0.48, 0.09, bc.floorHalfZ * 2 + 0.46),
        '#ef4444',
        { strokeWidth: 0.01 },
      );
      trim.position.set(sx * (bc.floorHalfX + 0.22), arenaFloorY + curbH * 0.56, 0);
      bcStatic.add(trim);
    }
    for (const sz of [-1, 1] as const) {
      const cEnd = makePart(new THREE.BoxGeometry(bc.floorHalfX * 2, curbH, 0.44), '#1e293b', {
        strokeWidth: 0.016,
      });
      cEnd.position.set(0, arenaFloorY + curbH * 0.5, sz * (bc.floorHalfZ + 0.22));
      bcStatic.add(cEnd);

      const trim = makePart(new THREE.BoxGeometry(bc.floorHalfX * 2, 0.09, 0.48), '#ef4444', {
        strokeWidth: 0.01,
      });
      trim.position.set(0, arenaFloorY + curbH * 0.56, sz * (bc.floorHalfZ + 0.22));
      bcStatic.add(trim);
    }

    // 6 Fluted Dark-Titanium Steel Columns + Corner Gusset Brackets
    const colH = 4.08;
    const colGeo = new THREE.BoxGeometry(0.44, colH, 0.44);
    for (const sx of [-1, 1] as const) {
      for (const cz of [-bc.halfZ + 0.55, 0, bc.halfZ - 0.55]) {
        const col = makePart(colGeo, '#1e293b', { strokeWidth: 0.02 });
        col.position.set(sx * (bc.halfX - 0.52), arenaFloorY + colH * 0.5, cz);
        bcStatic.add(col);

        const cap = makePart(new THREE.BoxGeometry(0.62, 0.18, 0.62), '#475569', {
          strokeWidth: 0.014,
        });
        cap.position.set(sx * (bc.halfX - 0.52), arenaFloorY + 0.1, cz);
        bcStatic.add(cap);
      }
    }

    // Crisp Metric-Mapped Black-and-White Checkered Fascia + Framed Raised Central Marquee!
    // (Mapped onto PlaneGeometry faces with solid dark-titanium frame boxes so ZERO checker smearing occurs on top/side edges!)
    const fasciaY = arenaFloorY + colH + 0.54;
    const fasciaH = 1.12;
    const addFramedCheckeredPanel = (
      px: number,
      py: number,
      pz: number,
      len: number,
      height: number,
      thick: number,
      alongZ: boolean,
    ) => {
      const boxW = alongZ ? thick : len;
      const boxD = alongZ ? len : thick;
      const frame = makePart(new THREE.BoxGeometry(boxW, height, boxD), '#1e293b', {
        strokeWidth: 0.022,
      });
      frame.position.set(px, py, pz);
      bcStatic.add(frame);

      const faceGeo = new THREE.PlaneGeometry(len - 0.08, height - 0.08);
      const uvAttr = faceGeo.getAttribute('uv');
      const repeatX = Math.max(1, Math.round((len - 0.08) / 4.2));
      for (let k = 0; k < uvAttr.count; k++) {
        uvAttr.setX(k, uvAttr.getX(k) * repeatX);
      }
      uvAttr.needsUpdate = true;

      for (const faceSign of [-1, 1] as const) {
        const face = makePart(faceGeo, '#ffffff', {
          map: checkeredTex,
          strokeWidth: 0,
          castShadow: false,
        });
        if (alongZ) {
          face.position.set(px + faceSign * (thick * 0.5 + 0.012), py, pz);
          face.rotation.y = faceSign > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          face.position.set(px, py, pz + faceSign * (thick * 0.5 + 0.012));
          face.rotation.y = faceSign > 0 ? 0 : Math.PI;
        }
        bcStatic.add(face);
      }
    };

    for (const sx of [-1, 1] as const) {
      addFramedCheckeredPanel(sx * (bc.halfX - 0.14), fasciaY, 0, d + 0.24, fasciaH, 0.28, true);
      addFramedCheckeredPanel(sx * (bc.halfX - 0.06), fasciaY + 0.26, 0, 5.4, 1.52, 0.36, true);
    }
    for (const sz of [-1, 1] as const) {
      addFramedCheckeredPanel(0, fasciaY, sz * (bc.halfZ - 0.14), w + 0.24, fasciaH, 0.28, false);
      addFramedCheckeredPanel(0, fasciaY + 0.26, sz * (bc.halfZ - 0.06), 5.2, 1.52, 0.36, false);
    }

    // Upward-Arched Corrugated Silver-Blue Metallic Barrel-Vault Roof + Standing-Seam Ribs
    const fasciaTopY = fasciaY + fasciaH * 0.5;
    const vaultRadius = bc.halfX + 0.22;
    const vaultArc = (Math.PI * 2) / 3;
    const vaultCosEdge = Math.cos(vaultArc * 0.5);
    const vaultRiseScale = 0.42;
    const vaultGeo = new THREE.CylinderGeometry(
      vaultRadius,
      vaultRadius,
      d + 0.44,
      28,
      1,
      false,
      -vaultArc * 0.5,
      vaultArc,
    );
    vaultGeo.rotateX(-Math.PI / 2);
    vaultGeo.scale(1.16, vaultRiseScale, 1.0);
    const vaultCenterY = fasciaTopY - vaultRadius * vaultCosEdge * vaultRiseScale + 0.04;
    const vaultRoof = makePart(vaultGeo, '#dbeafe', { strokeWidth: 0.024 });
    vaultRoof.position.set(0, vaultCenterY, 0);
    bcStatic.add(vaultRoof);

    for (let rz = -bc.halfZ + 1.4; rz <= bc.halfZ - 1.3; rz += 1.95) {
      const ribGeo = new THREE.CylinderGeometry(
        vaultRadius + 0.055,
        vaultRadius + 0.055,
        0.13,
        24,
        1,
        false,
        -vaultArc * 0.5,
        vaultArc,
      );
      ribGeo.rotateX(-Math.PI / 2);
      ribGeo.scale(1.16, vaultRiseScale, 1.0);
      const rib = makePart(ribGeo, '#94a3b8', { strokeWidth: 0.012 });
      rib.position.set(0, vaultCenterY + 0.02, rz);
      bcStatic.add(rib);
    }

    const ceilingPlate = makePart(new THREE.BoxGeometry(w - 0.5, 0.10, d - 0.5), '#64748b', {
      strokeWidth: 0.014,
    });
    ceilingPlate.position.set(0, arenaFloorY + colH + 0.06, 0);
    bcStatic.add(ceilingPlate);

    // 5 Sculpted 1950s Retro Dodgem Bumper Cars (Mint, Sunny Yellow, Coral Red, Cobalt Blue, Warm Orange)
    for (let c = 0; c < BUMPER_CAR_PALETTE.length; c++) {
      const carColor = BUMPER_CAR_PALETTE[c];
      const carGrp = new THREE.Group();
      carGrp.position.set(bc.x, bc.baseY + arenaFloorY + 0.05, bc.z);

      // Thick Black Rubber Bumper Donut Skirt + Chrome Fender Trim Ring
      const rubberRing = makePart(
        new THREE.TorusGeometry(0.74, 0.21, 12, 24).rotateX(Math.PI / 2),
        '#181b22',
        { strokeWidth: 0.018 },
      );
      rubberRing.scale.set(0.95, 1.0, 1.30);
      rubberRing.position.y = 0.21;
      carGrp.add(rubberRing);

      const chromeBelt = makePart(
        new THREE.TorusGeometry(0.75, 0.045, 8, 24).rotateX(Math.PI / 2),
        '#f1f5f9',
        { strokeWidth: 0.01 },
      );
      chromeBelt.scale.set(0.95, 1.0, 1.30);
      chromeBelt.position.y = 0.34;
      carGrp.add(chromeBelt);

      // Sculpted Curvy Retro Body Shell + Chrome Front Grille + Twin Glowing Headlights
      const shell = makePart(new THREE.CylinderGeometry(0.60, 0.74, 0.36, 20), carColor, {
        strokeWidth: 0.018,
      });
      shell.scale.set(0.94, 1.0, 1.28);
      shell.position.y = 0.38;
      carGrp.add(shell);

      const hood = makePart(new THREE.SphereGeometry(0.50, 14, 10), carColor, {
        strokeWidth: 0.016,
      });
      hood.scale.set(1.02, 0.50, 1.18);
      hood.position.set(0, 0.50, 0.34);
      carGrp.add(hood);

      const grille = makePart(new THREE.BoxGeometry(0.46, 0.14, 0.08), '#e2e8f0', {
        strokeWidth: 0.01,
      });
      grille.position.set(0, 0.42, 0.92);
      carGrp.add(grille);

      for (const hx of [-0.31, 0.31]) {
        const bezel = makePart(
          new THREE.CylinderGeometry(0.10, 0.10, 0.10, 10).rotateX(Math.PI / 2),
          '#e2e8f0',
          { strokeWidth: 0.01 },
        );
        bezel.position.set(hx, 0.48, 0.84);
        carGrp.add(bezel);

        const lamp = makePart(new THREE.SphereGeometry(0.082, 8, 8), '#fef08a', {
          strokeWidth: 0.008,
        });
        lamp.position.set(hx, 0.48, 0.88);
        carGrp.add(lamp);
      }

      // Wrap-around cream cockpit coaming, seat backrest & chrome steering wheel
      const coaming = makePart(
        new THREE.TorusGeometry(0.42, 0.055, 8, 16).rotateX(Math.PI / 2),
        '#fffbeb',
        { strokeWidth: 0.01 },
      );
      coaming.scale.set(1.0, 1.0, 1.12);
      coaming.position.set(0, 0.58, -0.14);
      carGrp.add(coaming);

      const seat = makePart(new THREE.BoxGeometry(0.60, 0.40, 0.24), '#1e293b', {
        strokeWidth: 0.014,
      });
      seat.position.set(0, 0.66, -0.34);
      carGrp.add(seat);

      const wheelRim = makePart(new THREE.TorusGeometry(0.13, 0.028, 6, 12), '#f8fafc', {
        strokeWidth: 0.008,
      });
      wheelRim.position.set(0, 0.68, 0.12);
      wheelRim.rotation.x = -0.62;
      carGrp.add(wheelRim);

      // Rear Spring-Mounted Overhead Conductive Power Pole
      const springBase = makePart(new THREE.CylinderGeometry(0.065, 0.075, 0.22, 8), '#eab308', {
        strokeWidth: 0.008,
      });
      springBase.position.set(0, 0.56, -0.72);
      carGrp.add(springBase);

      const powerPole = makePart(new THREE.CylinderGeometry(0.022, 0.028, 3.55, 6), '#cbd5e1', {
        strokeWidth: 0.006,
        castShadow: false,
      });
      powerPole.position.set(0, 2.28, -0.78);
      powerPole.rotation.x = -0.06;
      carGrp.add(powerPole);

      bakeStaticGroupMeshes(carGrp, { minShadowCasterSpan: 0.5 });
      rootGroup.add(carGrp);
      bumperCarGroups.push(carGrp);
    }
  }

  // Batch all Festoon & Stall Carnival Bulbs into 1 Single InstancedMesh
  if (festoonBulbPositions.length > 0) {
    const bulbSphereGeo = new THREE.SphereGeometry(0.085, 6, 6);
    disposableGeometries.push(bulbSphereGeo);
    const festoonInst = new THREE.InstancedMesh(
      bulbSphereGeo,
      bulbMat,
      festoonBulbPositions.length,
    );
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < festoonBulbPositions.length; i++) {
      const p = festoonBulbPositions[i];
      m4.makeTranslation(p.x, p.y, p.z);
      festoonInst.setMatrixAt(i, m4);
    }
    festoonInst.instanceMatrix.needsUpdate = true;
    festoonInst.computeBoundingSphere();
    rootGroup.add(festoonInst);
  }

  // Bake all static architecture into merged material buckets for minimal draw calls
  bakeStaticGroupMeshes(staticParkGroup, { minShadowCasterSpan: 0.65 });

  const update = (timeSec: number) => {
    const k = evaluateAmusementParkRideKinematics(timeSec);

    bianglalaWheelPivot.rotation.z = k.bianglalaWheelAngleRad;
    for (let i = 0; i < bianglalaGondolaGroups.length; i++) {
      bianglalaGondolaGroups[i].rotation.z = k.bianglalaGondolaCounterAngleRad;
    }

    koraSwingPivot.rotation.x = k.koraKoraSwingAngleRad;

    komidiRotatingPivot.rotation.y = k.komidiPutarAngleRad;
    for (let i = 0; i < komidiHorseNodes.length; i++) {
      const node = komidiHorseNodes[i];
      node.group.position.y = node.baseY + (k.komidiPutarHorseBobsM[i] ?? 0);
    }

    ontagSpinCanopy.rotation.y = k.ontagAntingSpinAngleRad;
    for (let i = 0; i < ontagChairPivots.length; i++) {
      ontagChairPivots[i].rotation.z = k.ontagAntingChairFlareRad[i] ?? 0.38;
    }

    const arenaCx = mp.rides.bumperCarArena.x;
    const arenaCz = mp.rides.bumperCarArena.z;
    const carY = mp.rides.bumperCarArena.baseY + arenaFloorY + 0.05;
    for (let i = 0; i < bumperCarGroups.length; i++) {
      const state = k.bumperCars[i];
      const grp = bumperCarGroups[i];
      if (!state || !grp) continue;
      grp.position.set(arenaCx + state.localX, carY, arenaCz + state.localZ);
      grp.rotation.y = state.yaw;
    }
  };

  update(0);

  const dispose = () => {
    for (const tex of disposableTextures) tex.dispose();
    for (const geo of disposableGeometries) geo.dispose();
    for (const mat of disposableMaterials) mat.dispose();
  };

  return {
    group: rootGroup,
    update,
    dispose,
  };
}
