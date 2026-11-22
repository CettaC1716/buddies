import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { BlitzWindUniforms } from './buddiesBlitzShadersAndAssets';
import {
  applyCylinderWoodMetricUvs,
  createPbrTimberTextureSet,
  getOrCreatePbrWoodMaterial,
  type PbrTextureTriplet,
} from './buddiesCoastalBeachBuilder';
import {
  AMUSEMENT_PARK_PALM_TREES,
  AMUSEMENT_PARK_RAILING_RUNS,
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
      u = (swapTopAxes ? wz : wx) / tileMetersU;
      v = (swapTopAxes ? wx : wz) / tileMetersV;
    } else if (nx >= ny && nx >= nz) {
      u = wz / tileMetersU;
      v = y / tileMetersV;
    } else {
      u = wx / tileMetersU;
      v = y / tileMetersV;
    }
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  return geo;
}

function makeRoundedParkBoxGeo(
  w: number,
  h: number,
  d: number,
  radius = Math.min(w, h, d) * 0.16,
  segments = 2,
): THREE.BufferGeometry {
  const r = Math.min(radius, w * 0.45, h * 0.45, d * 0.45);
  return new RoundedBoxGeometry(w, h, d, segments, Math.max(0.004, r));
}

function makeMitredParkRingGeo(
  outerW: number,
  outerD: number,
  rimThick: number,
  height: number,
  bevelSize = 0.014,
): THREE.BufferGeometry {
  const b = Math.min(bevelSize, rimThick * 0.35, height * 0.35);
  const hw = Math.max(0.05, outerW * 0.5 - b);
  const hd = Math.max(0.05, outerD * 0.5 - b);
  const ihw = Math.max(0.02, outerW * 0.5 - rimThick + b);
  const ihd = Math.max(0.02, outerD * 0.5 - rimThick + b);
  const outer = new THREE.Shape();
  outer.moveTo(-hw, -hd);
  outer.lineTo(hw, -hd);
  outer.lineTo(hw, hd);
  outer.lineTo(-hw, hd);
  outer.closePath();
  const inner = new THREE.Path();
  inner.moveTo(-ihw, -ihd);
  inner.lineTo(-ihw, ihd);
  inner.lineTo(ihw, ihd);
  inner.lineTo(ihw, -ihd);
  inner.closePath();
  outer.holes.push(inner);
  const geo = new THREE.ExtrudeGeometry(outer, {
    depth: Math.max(0.01, height - b * 2),
    bevelEnabled: b > 0,
    bevelSize: b,
    bevelThickness: b,
    bevelSegments: 2,
    curveSegments: 4,
  });
  geo.translate(0, 0, -Math.max(0.01, height - b * 2) * 0.5);
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function applyMetricPlanarUvs(
  geo: THREE.BufferGeometry,
  tileU: number,
  tileV: number,
): THREE.BufferGeometry {
  const pos = geo.getAttribute('position');
  const norm = geo.getAttribute('normal');
  const uv = geo.getAttribute('uv');
  if (!pos || !norm || !uv) return geo;
  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i);
    const wy = pos.getY(i);
    const wz = pos.getZ(i);
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    if (ny >= nx && ny >= nz) {
      uv.setXY(i, wx / tileU, wz / tileV);
    } else if (nx >= nz) {
      uv.setXY(i, wz / tileU, wy / tileV);
    } else {
      uv.setXY(i, wx / tileU, wy / tileV);
    }
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
/**
 * Builds a thin cylindrical scalloped trim skirt ring with genuine 3D arched cutouts
 * along its lower perimeter edge, shared across carousel and wave-swinger canopies.
 */
function createScallopedCorniceSkirtGeometry(
  radius: number,
  archCount: number,
  baseHeightM: number,
  scallopDropM: number,
  segsPerArch = 4,
): THREE.BufferGeometry {
  const totalSegs = archCount * segsPerArch;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= totalSegs; i++) {
    const u = i / totalSegs;
    const ang = u * Math.PI * 2;
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);
    const archPhase = (i % segsPerArch) / segsPerArch;
    const archSin = Math.sin(archPhase * Math.PI);
    const bottomY = -scallopDropM * archSin;

    positions.push(cosA * radius, baseHeightM, sinA * radius);
    uvs.push(u * archCount, 1.0);

    positions.push(cosA * (radius - 0.04), bottomY, sinA * (radius - 0.04));
    uvs.push(u * archCount, 0.0);
  }

  for (let i = 0; i < totalSegs; i++) {
    const tl = i * 2;
    const bl = tl + 1;
    const tr = tl + 2;
    const br = tl + 3;
    indices.push(tl, bl, tr, bl, br, tr);
    // Double-sided inward backing so underside looks finished from below
    indices.push(tr, bl, tl, tr, br, bl);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Extrudes an arched facade spandrel plate spanning between the flat horizontal bottom edge
 * at `bottomY` and the upper curved vault arch `archCenterY + archRadius * riseScale * cos(theta)`.
 */
function createBumperCarArchSpandrelGeometry(
  halfSpanX: number,
  bottomY: number,
  archCenterY: number,
  archRadius: number,
  xScale: number,
  riseScale: number,
  thicknessZ: number,
  segments = 28,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-halfSpanX, bottomY);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = -halfSpanX + t * halfSpanX * 2;
    const sinTheta = Math.max(-0.98, Math.min(0.98, x / (archRadius * xScale)));
    const cosTheta = Math.sqrt(Math.max(0.0, 1.0 - sinTheta * sinTheta));
    const yTop = archCenterY + archRadius * cosTheta * riseScale;
    if (i === 0) shape.lineTo(x, yTop);
    else shape.lineTo(x, yTop);
  }
  shape.lineTo(halfSpanX, bottomY);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thicknessZ,
    bevelEnabled: false,
    curveSegments: segments,
  });
  geo.translate(0, 0, -thicknessZ * 0.5);

  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  const peakY = archCenterY + archRadius * riseScale;
  const heightSpan = Math.max(0.2, peakY - bottomY);
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const u = (px + halfSpanX) / (halfSpanX * 2);
    const v = (py - bottomY) / heightSpan;
    uv.setXY(i, Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v)));
  }
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

const CARNIVAL_ATLAS_HEX_TO_CELL: Record<string, number> = {
  '#dc2626': 0,
  '#2563eb': 1,
  '#d97706': 2,
  '#ea580c': 3,
  '#e11d48': 4,
  '#0284c7': 5,
  '#0d9488': 6,
  '#f472b6': 7,
  '#38bdf8': 8,
  '#eab308': 9,
  '#f3c14b': 10,
  '#fffbeb': 11,
  '#fefce8': 11,
  '#fdf2f8': 11,
  '#f0f9ff': 11,
  '#f8fafc': 11,
  '#fff7ed': 11,
  '#b45309': 12,
  '#92400e': 12,
  '#fbcfe8': 13,
  '#ec4899': 13,
  '#e0f2fe': 14,
  '#fef3c7': 15,
};

function getCarnivalAtlasCellUvBounds(cellIdx: number): { u0: number; v0: number; u1: number; v1: number } {
  const col = cellIdx % 4;
  const row = Math.floor(cellIdx / 4);
  const pad = 0.025;
  const u0 = col * 0.25 + pad;
  const u1 = (col + 1) * 0.25 - pad;
  const v1 = 1.0 - row * 0.25 - pad;
  const v0 = 1.0 - (row + 1) * 0.25 + pad;
  return { u0, v0, u1, v1 };
}

function applyAtlasCellUvs<T extends THREE.BufferGeometry>(geo: T, keyHex: string): T {
  const cell = CARNIVAL_ATLAS_HEX_TO_CELL[keyHex] ?? 11;
  const { u0, v0, u1, v1 } = getCarnivalAtlasCellUvBounds(cell);
  const uv = geo.getAttribute('uv');
  if (uv) {
    for (let i = 0; i < uv.count; i++) {
      const lu = Math.max(0, Math.min(1, uv.getX(i) % 1.0001));
      const lv = Math.max(0, Math.min(1, uv.getY(i) % 1.0001));
      uv.setXY(i, u0 + lu * (u1 - u0), v0 + lv * (v1 - v0));
    }
    uv.needsUpdate = true;
  }
  return geo;
}

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
  surfaceAtlasTex?: THREE.Texture,
) {
  const stripesPerSide = 7;
  const apex: [number, number, number] = [0, eaveY + peakH, 0];
  const priCell = CARNIVAL_ATLAS_HEX_TO_CELL[primaryHex] ?? 0;
  const secCell = CARNIVAL_ATLAS_HEX_TO_CELL[secondaryHex] ?? 11;
  const priUv = getCarnivalAtlasCellUvBounds(priCell);
  const secUv = getCarnivalAtlasCellUvBounds(secCell);

  const positions: number[] = [];
  const uvs: number[] = [];

  const nw: [number, number, number] = [-halfW, eaveY, -halfD];
  const sw: [number, number, number] = [-halfW, eaveY, halfD];
  const se: [number, number, number] = [halfW, eaveY, halfD];
  const ne: [number, number, number] = [halfW, eaveY, -halfD];

  for (const [c0, c1] of [
    [nw, sw],
    [sw, se],
    [se, ne],
    [ne, nw],
  ] as const) {
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
      const b = i % 2 === 0 ? priUv : secUv;
      positions.push(...apex, ...e0, ...e1);
      uvs.push((b.u0 + b.u1) * 0.5, b.v1, b.u0, b.v0, b.u1, b.v0);
    }
  }

  const roofGeo = new THREE.BufferGeometry();
  roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  roofGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  roofGeo.computeVertexNormals();
  parent.add(
    makePart(roofGeo, surfaceAtlasTex ? '#ffffff' : primaryHex, {
      map: surfaceAtlasTex,
      strokeWidth: 0,
    }),
  );

  const soffit = makePart(
    makeRoundedParkBoxGeo(halfW * 2 - 0.06, 0.06, halfD * 2 - 0.06, 0.014, 1),
    secondaryHex,
    { strokeWidth: 0.012, castShadow: false },
  );
  soffit.position.set(0, eaveY - 0.01, 0);
  parent.add(soffit);

  const flapH = 0.34;
  const tabGeoW = (halfW * 2) / stripesPerSide;
  const sideInnerSpanD = Math.max(0.2, halfD * 2 - 0.14);
  const tabGeoD = sideInnerSpanD / stripesPerSide;
  for (let i = 0; i < stripesPerSide; i++) {
    const col = i % 2 === 0 ? primaryHex : secondaryHex;
    const fx = -halfW + (i + 0.5) * tabGeoW;
    for (const sz of [-1, 1] as const) {
      const tGeo = makeRoundedParkBoxGeo(tabGeoW - 0.004, flapH, 0.068, 0.010, 1);
      if (surfaceAtlasTex) applyAtlasCellUvs(tGeo, col);
      const tab = makePart(tGeo, surfaceAtlasTex ? '#ffffff' : col, {
        map: surfaceAtlasTex,
        strokeWidth: 0.014,
      });
      tab.position.set(fx, eaveY - flapH * 0.5 + 0.02, sz * (halfD - 0.032));
      parent.add(tab);
    }
    const fz = -sideInnerSpanD * 0.5 + (i + 0.5) * tabGeoD;
    for (const sx of [-1, 1] as const) {
      const tGeo = makeRoundedParkBoxGeo(0.068, flapH, tabGeoD - 0.004, 0.010, 1);
      if (surfaceAtlasTex) applyAtlasCellUvs(tGeo, col);
      const tab = makePart(tGeo, surfaceAtlasTex ? '#ffffff' : col, {
        map: surfaceAtlasTex,
        strokeWidth: 0.014,
      });
      tab.position.set(sx * (halfW - 0.032), eaveY - flapH * 0.5 + 0.02, fz);
      parent.add(tab);
    }
  }
}

/**
 * Builds a smooth, continuous carvel-planked 3D Pirate Galleon Hull,
 * lofted across 22 longitudinal stations x 13 transverse U-rib frames with sweeping sheerline,
 * curved tumblehome bulwarks, keel spine, and planked UVs!
 */
export function createLoftedGalleonHullGeometry(
  length: number,
  maxBeam: number,
): THREE.BufferGeometry {
  const zSteps = 22;
  const uSteps = 12;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const getHullPoint = (sFrac: number, cFrac: number): [number, number, number] => {
    const zn = (sFrac - 0.5) * 2.0;
    const z = zn * (length * 0.5);

    const bowSternTaper =
      zn < 0
        ? Math.pow(Math.max(0.04, 1.0 - Math.pow(-zn, 1.85)), 0.78)
        : Math.pow(Math.max(0.28, 1.0 - Math.pow(zn, 2.35) * 0.66), 0.75);

    const halfW = (maxBeam * 0.5) * bowSternTaper;
    const sheerY = Math.pow(Math.abs(zn), 2.05) * 2.05 + (zn > 0 ? zn * 0.32 : 0);
    const keelY = -1.18 + Math.pow(Math.abs(zn), 2.4) * 0.95;

    const a = Math.abs(cFrac);
    const sign = cFrac < 0 ? -1 : 1;
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
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

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
    indices.push(p0, p1, s0);
    indices.push(s0, p1, s1);

    const outerPort0 = iz * rowStride;
    const outerPort1 = (iz + 1) * rowStride;
    indices.push(outerPort0, outerPort1, p0);
    indices.push(p0, outerPort1, p1);

    const outerStar0 = iz * rowStride + uSteps;
    const outerStar1 = (iz + 1) * rowStride + uSteps;
    indices.push(outerStar0, s0, outerStar1);
    indices.push(s0, s1, outerStar1);
  }

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
 * Legacy helper exported for test compatibility; builds a pinnate V-folded palm frond.
 */
export function createPalmFrondGeometry(length = 3.25, maxWidth = 0.86): THREE.BufferGeometry {
  const segs = 9;
  const positions: number[] = [];

  const spinePt = (t: number): [number, number, number] => {
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

    positions.push(x0, y0, 0, xm, droopY, -w, x1, y1, 0);
    positions.push(x0, y0 - 0.03, 0, x1, y1 - 0.03, 0, xm, droopY - 0.02, -w);

    positions.push(x0, y0, 0, x1, y1, 0, xm, droopY, w);
    positions.push(x0, y0 - 0.03, 0, xm, droopY - 0.02, w, x1, y1 - 0.03, 0);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

// ============================================================================
// KAI FISH MARKET COCONUT PALM TREE GEOMETRY (1:1 MATCH WITH SE BEACHFRONT)
// ============================================================================

/**
 * Builds the exact Kai Fish Market continuous 14-ring smoothly curving tapered palm trunk geometry.
 */
export function createKaiPalmTrunkGeometry(): {
  trunkGeo: THREE.BufferGeometry;
  topY: number;
  topZ: number;
} {
  const rings = 14;
  const radialSegs = 10;
  const vertCount = (rings + 1) * (radialSegs + 1);
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const colors = new Float32Array(vertCount * 3);
  const indices: number[] = [];

  const smoothstep = (e0: number, e1: number, x: number) => {
    const k = Math.max(0, Math.min(1, (x - e0) / Math.max(1e-4, e1 - e0)));
    return k * k * (3 - 2 * k);
  };

  let curY = 0;
  let curZ = 0;
  const totalH = 5.15;
  const stepH = totalH / rings;

  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const tilt = 0.07 + t * 0.17;
    const baseFlare = Math.pow(1.0 - t, 3.0) * 0.09;
    const ringSwell = Math.sin(r * Math.PI) * 0.012;
    const radius = 0.28 * (1.0 - t * 0.42) + baseFlare + ringSwell;

    // Zero-GPU-cost vertex-color canopy AO gradient:
    // subtle warm sand-contact AO at base -> sunlit tawny mid-trunk -> cool-umber canopy shadow under fronds
    const groundRise = smoothstep(0.0, 0.16, t);
    const canopyAo = smoothstep(0.60, 1.0, t);
    const ringMicroAo = 0.965 + 0.035 * Math.sin(r * Math.PI);
    let colR = (0.89 + (1.0 - 0.89) * groundRise) * (1.0 - canopyAo) + 0.52 * canopyAo;
    let colG = (0.85 + (0.97 - 0.85) * groundRise) * (1.0 - canopyAo) + 0.48 * canopyAo;
    let colB = (0.79 + (0.92 - 0.79) * groundRise) * (1.0 - canopyAo) + 0.43 * canopyAo;
    colR *= ringMicroAo;
    colG *= ringMicroAo;
    colB *= ringMicroAo;

    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);

    for (let s = 0; s <= radialSegs; s++) {
      const u = s / radialSegs;
      const theta = u * Math.PI * 2;
      const cx = Math.cos(theta) * radius;
      const cz = Math.sin(theta) * radius;

      const idx = r * (radialSegs + 1) + s;
      positions[idx * 3] = cx;
      positions[idx * 3 + 1] = curY - cz * sinT;
      positions[idx * 3 + 2] = curZ + cz * cosT;

      normals[idx * 3] = Math.cos(theta);
      normals[idx * 3 + 1] = -Math.sin(theta) * sinT;
      normals[idx * 3 + 2] = Math.sin(theta) * cosT;

      uvs[idx * 2] = u * 2.0;
      uvs[idx * 2 + 1] = t * 3.5;

      colors[idx * 3] = colR;
      colors[idx * 3 + 1] = colG;
      colors[idx * 3 + 2] = colB;
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
  return { trunkGeo, topY: curY, topZ: curZ };
}

/**
 * Builds the exact Kai Fish Market 16-frond 3-tier V-fold arching palm crown geometry.
 */
export function createKaiPalmCrownFrondsGeometry(): THREE.BufferGeometry {
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
    const vertCount = (segsL + 1) * colsW;
    const positions = new Float32Array(vertCount * 3);
    const normals = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const indices: number[] = [];

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
        const wy = ry;
        const wz = -rx * sinY + rz * cosY;

        const idx = i * colsW + c;
        positions[idx * 3] = wx;
        positions[idx * 3 + 1] = wy;
        positions[idx * 3 + 2] = wz;

        const domeNx = wx * 0.55 + (u - 0.5) * 0.95 * cosY;
        const domeNy = 0.52 - v * 0.88 + (c === 1 ? 0.22 : -0.14);
        const domeNz = wz * 0.55 - (u - 0.5) * 0.95 * sinY;
        const nLen = Math.hypot(domeNx, domeNy, domeNz) || 1;
        normals[idx * 3] = domeNx / nLen;
        normals[idx * 3 + 1] = domeNy / nLen;
        normals[idx * 3 + 2] = domeNz / nLen;

        uvs[idx * 2] = u;
        uvs[idx * 2 + 1] = v;
      }
    }

    for (let i = 0; i < segsL; i++) {
      const r0 = i * colsW;
      const r1 = (i + 1) * colsW;
      indices.push(r0, r1, r0 + 1);
      indices.push(r0 + 1, r1, r1 + 1);
      indices.push(r0 + 1, r1 + 1, r0 + 2);
      indices.push(r0 + 2, r1 + 1, r1 + 2);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
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

  const merged = mergeGeometries(frondGeos, false);
  frondGeos.forEach((g) => g.dispose());
  return merged;
}

// ============================================================================
// HIGH-RESOLUTION HAND-PAINTED PROCEDURAL CANVAS TEXTURES
// ============================================================================

function createCobblestoneMosaicTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (ctx) {
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
            data[idx] = 166;
            data[idx + 1] = 149;
            data[idx + 2] = 124;
            data[idx + 3] = 255;
          } else {
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

export function createCorrugatedMetalTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 0, 512, 512);
    const ribs = 24;
    const rw = 512 / ribs;
    for (let i = 0; i < ribs; i++) {
      const x = i * rw;
      const g = ctx.createLinearGradient(x, 0, x + rw, 0);
      g.addColorStop(0, '#94a3b8');
      g.addColorStop(0.28, '#e2e8f0');
      g.addColorStop(0.55, '#f1f5f9');
      g.addColorStop(0.85, '#64748b');
      g.addColorStop(1, '#94a3b8');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, rw, 512);
    }
    // Horizontal purlin lap seams
    ctx.fillStyle = 'rgba(51, 65, 85, 0.35)';
    for (let y = 128; y < 512; y += 128) {
      ctx.fillRect(0, y, 512, 3);
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

export function createConductiveMetalFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#64748b');
    grad.addColorStop(0.45, '#94a3b8');
    grad.addColorStop(1, '#475569');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    const grid = 4;
    const cell = 512 / grid;
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        const px = x * cell;
        const py = y * cell;
        ctx.fillStyle = (x + y) % 2 === 0 ? 'rgba(226, 232, 240, 0.14)' : 'rgba(30, 41, 59, 0.14)';
        ctx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3;
        ctx.strokeRect(px, py, cell, cell);
        // Subtle brushed scuff arc
        ctx.strokeStyle = 'rgba(241, 245, 249, 0.16)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px + cell * 0.5, py + cell * 0.5, cell * 0.34, 0.4, 2.2);
        ctx.stroke();
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

function createCeilingWireMeshTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 256);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 5;
    const step = 32;
    for (let i = -256; i <= 512; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 256, 256);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(i, 256);
      ctx.lineTo(i + 256, 0);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 7);
  tex.needsUpdate = true;
  return tex;
}

function createBaroqueCorniceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#faefd6';
    ctx.fillRect(0, 0, 1024, 256);

    ctx.fillStyle = '#9a5b13';
    ctx.fillRect(0, 0, 1024, 28);
    ctx.fillRect(0, 226, 1024, 30);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(0, 8, 1024, 11);
    ctx.fillRect(0, 233, 1024, 11);

    ctx.fillStyle = '#fef08a';
    for (let bx = 12; bx < 1024; bx += 24) {
      ctx.beginPath();
      ctx.arc(bx, 36, 4.5, 0, Math.PI * 2);
      ctx.arc(bx, 218, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < 4; i++) {
      const cx = 128 + i * 256;
      const cy = 127;

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

      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.ellipse(cx - 22, cy - 22, 22, 8, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 24, cy - 16, 18, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0284c7';
      ctx.fillRect(cx - 70, cy + 6, 140, 18);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(cx - 70, cy + 16, 140, 10);
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(cx - 70, cy + 25, 140, 24);

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cx + (i % 2 === 0 ? -10 : 12), cy + 12);
      ctx.lineTo(cx + (i % 2 === 0 ? -2 : 20), cy - 8);
      ctx.lineTo(cx + (i % 2 === 0 ? 4 : 26), cy + 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

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
    ctx.fillText('HARBOR CARNIVAL PIER', 512, 110);

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

function createPalmFrondAlphaMaskTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
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

function createPalmTrunkBarkTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Warm sunlit coastal tawny-ochre layered palm bark matching the painterly beach aesthetic
    ctx.fillStyle = '#b4875e';
    ctx.fillRect(0, 0, 256, 512);
    const ringCount = 22;
    const ringH = 512 / ringCount;
    const ringHighlightTones = ['#cfa67c', '#c3976d', '#d6ae84', '#be9167', '#cca177'];
    const ringMidTones = ['#b2845a', '#a67950', '#ba8c62', '#a1744c', '#ae8158'];
    for (let r = 0; r < ringCount; r++) {
      const y = r * ringH;
      const grad = ctx.createLinearGradient(0, y, 0, y + ringH);
      grad.addColorStop(0.0, ringHighlightTones[r % ringHighlightTones.length]);
      grad.addColorStop(0.42, ringMidTones[r % ringMidTones.length]);
      grad.addColorStop(0.84, '#8d623f');
      grad.addColorStop(0.95, '#764f31');
      grad.addColorStop(1.0, '#c2966c');
      ctx.fillStyle = grad;
      ctx.fillRect(0, y, 256, ringH);

      // Sunlit upper lip bevel + crisp warm umber leaf-scar ring shadow
      ctx.fillStyle = 'rgba(246, 218, 182, 0.28)';
      ctx.fillRect(0, y + 1.5, 256, 2.2);
      ctx.fillStyle = 'rgba(78, 49, 28, 0.44)';
      ctx.fillRect(0, y + ringH - 2.6, 256, 2.4);
    }
    // Delicate fibrous vertical palm bark grain
    for (let x = 3; x < 256; x += 8) {
      ctx.fillStyle = x % 16 === 3 ? 'rgba(84, 54, 32, 0.12)' : 'rgba(244, 214, 178, 0.10)';
      ctx.fillRect(x, 0, 2, 512);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Full-height arched black-and-white checkered header texture for the Bumper Car Arena
 * gable spandrel, filling cleanly all the way up under the vaulted corrugated arch roof.
 */
function createBumperCarArchHeaderTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cols = 20;
    const rows = 10;
    const cw = 1024 / cols;
    const ch = 512 / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isLight = (r + c) % 2 === 0;
        ctx.fillStyle = isLight ? '#f8fafc' : '#181b22';
        ctx.fillRect(c * cw, r * ch, cw, ch);
        if (isLight) {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(c * cw + 1, r * ch + 1, cw - 2, ch - 2);
        }
      }
    }

    // Bottom horizontal steel frame & amber pinstripe
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 482, 1024, 30);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(0, 474, 1024, 8);

    // Centered crisp marquee plaque reading "BUMPER CAR // ARENA" directly beneath arch curve
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(262, 176, 500, 212);
    ctx.fillStyle = '#fffdf7';
    ctx.fillRect(274, 188, 476, 188);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 6;
    ctx.strokeRect(284, 198, 456, 168);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BUMPER CAR', 512, 250);

    ctx.fillStyle = '#b91c1c';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText('// ARENA //', 512, 314);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Dedicated 8-panel vertical Baroque relief artwork for Ontang-Anting's 4-tier octagonal
 * tower column (Sheet 5), featuring crimson velvet insets, gold leaf acanthus frames,
 * and coastal medallions.
 */
function createSwingerColumnPanelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f5e8ce';
    ctx.fillRect(0, 0, 1024, 512);

    ctx.fillStyle = '#78350f';
    ctx.fillRect(0, 0, 1024, 36);
    ctx.fillRect(0, 476, 1024, 36);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, 12, 1024, 12);
    ctx.fillRect(0, 488, 1024, 12);

    const panels = 4;
    const pw = 1024 / panels;
    for (let i = 0; i < panels; i++) {
      const px = i * pw;
      const cx = px + pw * 0.5;
      const cy = 256;

      // Fluted gilt pilaster divider
      ctx.fillStyle = '#b45309';
      ctx.fillRect(px, 36, 18, 440);
      ctx.fillRect(px + pw - 18, 36, 18, 440);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(px + 5, 44, 8, 424);

      // Crimson ornamental inset bay
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(px + 28, 56, pw - 56, 400);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 6;
      ctx.strokeRect(px + 34, 62, pw - 68, 388);

      // Cream cartouche diamond + sunburst oval medallion
      ctx.fillStyle = '#fffbeb';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 68, 146, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 8;
      ctx.stroke();

      ctx.fillStyle = i % 2 === 0 ? '#0284c7' : '#d97706';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 46, 106, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(cx, cy, 24, 0, Math.PI * 2);
      ctx.fill();

      // Corner rosette studs
      for (const rx of [px + 52, px + pw - 52]) {
        for (const ry of [86, 426]) {
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(rx, ry, 10, 0, Math.PI * 2);
          ctx.fill();
        }
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

/**
 * Helical fluted spiral brass texture for Komidi Putar's vertical suspension poles.
 */
function createSpiralBrassPoleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, 0, 256, 512);
    for (let band = -4; band < 10; band++) {
      const yBase = band * 86;
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(0, yBase);
      ctx.lineTo(256, yBase + 64);
      ctx.lineTo(256, yBase + 90);
      ctx.lineTo(0, yBase + 26);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.moveTo(0, yBase + 26);
      ctx.lineTo(256, yBase + 90);
      ctx.lineTo(256, yBase + 102);
      ctx.lineTo(0, yBase + 38);
      ctx.closePath();
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Shared 4x4 (1024x1024) carnival woven tent canvas & painted wood booth siding texture atlas.
 * Batches all striped canopies, gazebo roofs, counters, popcorn booth & gulali cart into 1 material bucket!
 */
function createCarnivalSurfaceAtlasTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const clothPalette = [
      '#dc2626',
      '#2563eb',
      '#d97706',
      '#ea580c',
      '#e11d48',
      '#0284c7',
      '#0d9488',
      '#f472b6',
      '#38bdf8',
      '#eab308',
      '#f3c14b',
      '#fffbeb',
    ];
    for (let idx = 0; idx < 12; idx++) {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      const x0 = col * 256;
      const y0 = row * 256;
      ctx.fillStyle = clothPalette[idx];
      ctx.fillRect(x0, y0, 256, 256);

      for (let y = 0; y < 256; y += 8) {
        ctx.fillStyle = y % 16 === 0 ? 'rgba(255,248,236,0.08)' : 'rgba(68,48,28,0.07)';
        ctx.fillRect(x0, y0 + y, 256, 2);
      }
      for (let x = 0; x < 256; x += 8) {
        ctx.fillStyle = x % 16 === 0 ? 'rgba(255,248,236,0.06)' : 'rgba(68,48,28,0.06)';
        ctx.fillRect(x0 + x, y0, 2, 256);
      }
    }

    const sidingPalette = ['#b46a34', '#f7d4e2', '#e0f0f8', '#faedd0'];
    for (let s = 0; s < 4; s++) {
      const x0 = s * 256;
      const y0 = 3 * 256;
      ctx.fillStyle = sidingPalette[s];
      ctx.fillRect(x0, y0, 256, 256);
      const slats = 8;
      const sw = 256 / slats;
      for (let k = 0; k < slats; k++) {
        const sx = x0 + k * sw;
        ctx.fillStyle = 'rgba(255,248,236,0.12)';
        ctx.fillRect(sx + 2, y0, 3, 256);
        ctx.fillStyle = 'rgba(72,42,18,0.19)';
        ctx.fillRect(sx + sw - 3, y0, 3, 256);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x0, y0 + 8, 256, 8);
      ctx.fillRect(x0, y0 + 240, 256, 8);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Quilted diamond-tufted leather/saddle texture for carousel horses, chariots, and swing chairs.
 */
function createQuiltedSaddleTexture(baseHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.45)';
    ctx.lineWidth = 3;
    const step = 32;
    for (let o = -256; o <= 256; o += step) {
      ctx.beginPath();
      ctx.moveTo(o, 0);
      ctx.lineTo(o + 256, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(o + 256, 0);
      ctx.lineTo(o, 256);
      ctx.stroke();
    }
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 246, 246);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
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

  const plankPbrSet = createPbrTimberTextureSet('boardwalk_deck');
  const coastalOakPbrSet = createPbrTimberTextureSet('coastal_oak');
  const hullWoodPbrSet = createPbrTimberTextureSet('galleon_hull');
  const plankTex = plankPbrSet.map;
  const hullWoodTex = hullWoodPbrSet.map;
  const cobbleTex = createCobblestoneMosaicTexture();
  const checkeredTex = createCheckeredFasciaTexture();
  const bumperArchSignTex = createBumperCarArchHeaderTexture();
  const corrugatedMetalTex = createCorrugatedMetalTexture();
  const conductiveFloorTex = createConductiveMetalFloorTexture();
  const ceilingWireTex = createCeilingWireMeshTexture();
  const baroqueCorniceTex = createBaroqueCorniceTexture();
  const swingerColumnTex = createSwingerColumnPanelTexture();
  const spiralBrassPoleTex = createSpiralBrassPoleTexture();
  const carnivalSurfaceAtlasTex = createCarnivalSurfaceAtlasTexture();
  const quiltedChariotSeatTex = createQuiltedSaddleTexture('#dc2626');
  const bannerTex = createCarnivalBannerTexture();
  const palmFrondMaskTex = createPalmFrondAlphaMaskTexture();
  const palmTrunkBarkTex = createPalmTrunkBarkTexture();

  disposableTextures.push(
    plankPbrSet.map,
    plankPbrSet.bumpMap,
    plankPbrSet.roughnessMap,
    coastalOakPbrSet.map,
    coastalOakPbrSet.bumpMap,
    coastalOakPbrSet.roughnessMap,
    hullWoodPbrSet.map,
    hullWoodPbrSet.bumpMap,
    hullWoodPbrSet.roughnessMap,
    cobbleTex,
    checkeredTex,
    bumperArchSignTex,
    corrugatedMetalTex,
    conductiveFloorTex,
    ceilingWireTex,
    baroqueCorniceTex,
    swingerColumnTex,
    spiralBrassPoleTex,
    carnivalSurfaceAtlasTex,
    quiltedChariotSeatTex,
    bannerTex,
    palmFrondMaskTex,
    palmTrunkBarkTex,
  );

  // Reusable PBR wood material cache (keyed per colorHex, map.uuid, bumpMap.uuid, roughness)
  const pbrWoodMatCache = new Map<string, THREE.MeshStandardMaterial>();
  const pbrWoodTripletByMapUuid = new Map<string, PbrTextureTriplet>([
    [plankPbrSet.map.uuid, plankPbrSet],
    [coastalOakPbrSet.map.uuid, coastalOakPbrSet],
    [hullWoodPbrSet.map.uuid, hullWoodPbrSet],
  ]);
  const getCachedPbrWoodMat = (
    textures: PbrTextureTriplet,
    colorHex = '#ffffff',
    roughness = 0.88,
    bumpScale = 0.032,
    vertexColors = false,
  ): THREE.MeshStandardMaterial => {
    const mat = getOrCreatePbrWoodMaterial(pbrWoodMatCache, {
      colorHex,
      textures,
      roughness,
      bumpScale,
      metalness: 0.02,
      side: THREE.FrontSide,
      vertexColors,
    });
    if (!disposableMaterials.includes(mat)) {
      disposableMaterials.push(mat);
    }
    return mat;
  };

  const resolveParkPbrWoodTint = (rawHex: string): string => {
    const h = rawHex.toLowerCase();
    if (h === '#ffffff') return '#ffffff';
    if (h === '#f5e2cc') return '#fff6ea';
    if (h === '#dfc0a0') return '#f4dec4';
    if (h === '#cfa984') return '#eed3b6';
    if (h === '#b8926e') return '#e2c09b';
    return rawHex;
  };

  const bakePbrVertexTint = (geo: THREE.BufferGeometry, tintHex: string): THREE.BufferGeometry => {
    const out = geo.clone();
    disposableGeometries.push(out);
    const pos = out.getAttribute('position');
    if (pos && pos.count > 0) {
      const col = new THREE.Color(tintHex);
      const colors = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const idx = i * 3;
        colors[idx] = col.r;
        colors[idx + 1] = col.g;
        colors[idx + 2] = col.b;
      }
      out.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    return out;
  };

  void createBlitzStrokeMesh;

  // Reusable placeholder MeshStandardMaterial cache so makePart never allocates redundant materials
  const placeholderMatCache = new Map<string, THREE.MeshStandardMaterial>();
  const getPlaceholderStdMat = (
    colorHex: string,
    map?: THREE.Texture,
    vertexColors = false,
  ): THREE.MeshStandardMaterial => {
    const key = `${colorHex}_${map ? map.uuid : 'nomap'}_${vertexColors ? 1 : 0}`;
    let m = placeholderMatCache.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color: map ? '#ffffff' : colorHex,
        map: map ?? null,
        vertexColors,
        roughness: 0.76,
        metalness: 0.08,
      });
      placeholderMatCache.set(key, m);
      disposableMaterials.push(m);
    }
    return m;
  };

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
      pbrWood?: {
        textures: PbrTextureTriplet;
        colorHex?: string;
        roughness?: number;
        bumpScale?: number;
      };
    },
  ): THREE.Mesh => {
    const autoWoodTriplet = opts?.map ? pbrWoodTripletByMapUuid.get(opts.map.uuid) : undefined;
    const pbrSpec = opts?.pbrWood ?? (autoWoodTriplet ? { textures: autoWoodTriplet, colorHex } : undefined);
    if (pbrSpec) {
      const tintHex = resolveParkPbrWoodTint(pbrSpec.colorHex ?? colorHex);
      const unifiedRoughness = pbrSpec.textures === hullWoodPbrSet ? 0.9 : 0.88;
      const unifiedBump = pbrSpec.textures === hullWoodPbrSet ? 0.034 : 0.032;
      const pbrMat = getCachedPbrWoodMat(
        pbrSpec.textures,
        '#ffffff',
        unifiedRoughness,
        unifiedBump,
        true,
      );
      const mesh = new THREE.Mesh(bakePbrVertexTint(geo, tintHex), pbrMat);
      mesh.castShadow = !isSoftwareGl && (opts?.castShadow ?? true);
      mesh.receiveShadow = !isSoftwareGl && (opts?.receiveShadow ?? true);
      // Zero cartoon outline and zero cel-step shader override on PBR timber!
      return mesh;
    }

    const hasVertexColor = Boolean(geo.getAttribute('color'));
    const mat = getPlaceholderStdMat(colorHex, opts?.map, hasVertexColor);
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
    return mesh;
  };

  const makeInstancedBatch = (
    geo: THREE.BufferGeometry,
    colorHex: string,
    matrices: readonly THREE.Matrix4[],
    opts?: {
      castShadow?: boolean;
      receiveShadow?: boolean;
      bounceStrength?: number;
      basicMat?: THREE.Material;
      pbrWood?: {
        textures: PbrTextureTriplet;
        colorHex?: string;
        roughness?: number;
        bumpScale?: number;
      };
    },
  ): THREE.InstancedMesh | null => {
    if (matrices.length === 0) return null;
    disposableGeometries.push(geo);
    const pbrMat = opts?.pbrWood
      ? getCachedPbrWoodMat(
          opts.pbrWood.textures,
          resolveParkPbrWoodTint(opts.pbrWood.colorHex ?? colorHex),
          opts.pbrWood.roughness ?? 0.88,
          opts.pbrWood.bumpScale ?? 0.032,
        )
      : undefined;
    const mat = opts?.basicMat ?? pbrMat ?? getPlaceholderStdMat(colorHex);
    const inst = new THREE.InstancedMesh(geo, mat, matrices.length);
    if (!opts?.basicMat && !pbrMat) {
      upgradeMeshToBlitzWorldMaterial(inst, windUniforms, colorHex, opts?.bounceStrength ?? 0.18);
    }
    inst.castShadow = !isSoftwareGl && (opts?.castShadow ?? false);
    inst.receiveShadow = !isSoftwareGl && (opts?.receiveShadow ?? true);
    inst.frustumCulled = true;
    for (let i = 0; i < matrices.length; i++) {
      inst.setMatrixAt(i, matrices[i]);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingBox();
    inst.computeBoundingSphere();
    return inst;
  };

  const bulbMat = new THREE.MeshBasicMaterial({ color: '#fef08a' });
  const warmAmberBulbMat = new THREE.MeshBasicMaterial({ color: '#fde047' });
  disposableMaterials.push(bulbMat, warmAmberBulbMat);

  const staticParkGroup = new THREE.Group();
  staticParkGroup.name = 'CoastalAmusementParkStatic';
  rootGroup.add(staticParkGroup);

  const instancedBatchGroup = new THREE.Group();
  instancedBatchGroup.name = 'CoastalAmusementParkInstanced';
  rootGroup.add(instancedBatchGroup);

  // =========================================================================
  // 1. WATERFRONT TIMBER BOARDWALK, OVER-WATER PIER DECK, PILINGS & GAZEBO JETTY
  // =========================================================================
  const deckY = mp.boardwalkDeckY;
  const deckThick = 0.28;

  // Single continuous unified ExtrudeGeometry union for Main Boardwalk + Bianglala Pier + Gazebo Jetty
  // (Eliminates all 4-quadrant seam Z-fighting ZF=813!)
  const bwPoly: [number, number][] = [
    [mp.mainBoardwalk.minX, mp.mainBoardwalk.minZ],
    [mp.mainBoardwalk.maxX, mp.mainBoardwalk.minZ],
    [mp.mainBoardwalk.maxX, mp.bianglalaPierDeck.minZ],
    [mp.bianglalaPierDeck.maxX, mp.bianglalaPierDeck.minZ],
    [mp.bianglalaPierDeck.maxX, mp.gazeboFingerJetty.walkwayMinZ],
    [mp.gazeboFingerJetty.headMinX, mp.gazeboFingerJetty.walkwayMinZ],
    [mp.gazeboFingerJetty.headMinX, mp.gazeboFingerJetty.headMinZ],
    [mp.gazeboFingerJetty.headMaxX, mp.gazeboFingerJetty.headMinZ],
    [mp.gazeboFingerJetty.headMaxX, mp.gazeboFingerJetty.headMaxZ],
    [mp.gazeboFingerJetty.headMinX, mp.gazeboFingerJetty.headMaxZ],
    [mp.gazeboFingerJetty.headMinX, mp.gazeboFingerJetty.walkwayMaxZ],
    [mp.bianglalaPierDeck.maxX, mp.gazeboFingerJetty.walkwayMaxZ],
    [mp.bianglalaPierDeck.maxX, mp.bianglalaPierDeck.maxZ],
    [mp.mainBoardwalk.maxX, mp.bianglalaPierDeck.maxZ],
    [mp.mainBoardwalk.maxX, mp.mainBoardwalk.maxZ],
    [mp.mainBoardwalk.minX, mp.mainBoardwalk.maxZ],
  ];
  const makePolygonDeckGeo = (pts: [number, number][], h: number, outset = 0, bevel = 0) => {
    const s = new THREE.Shape();
    for (let i = 0; i < pts.length; i++) {
      const [px, pz] = pts[i];
      // shape y maps to -z after rotateX(-PI/2)
      if (i === 0) s.moveTo(px, -pz);
      else s.lineTo(px, -pz);
    }
    s.closePath();
    const b = Math.max(0, bevel);
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: Math.max(0.02, h - b * 2),
      bevelEnabled: b > 0 || outset > 0,
      bevelSize: outset > 0 ? outset : b,
      bevelThickness: b,
      bevelSegments: 2,
      curveSegments: 2,
    });
    geo.translate(0, 0, -Math.max(0.02, h - b * 2) * 0.5);
    geo.rotateX(-Math.PI / 2);
    geo.computeVertexNormals();
    return applyMetricPlanarUvs(geo, 3.6, 4.0);
  };

  const unifiedDeckMesh = makePart(makePolygonDeckGeo(bwPoly, deckThick, 0, 0.014), '#ffffff', {
    map: plankTex,
    strokeWidth: 0,
    receiveShadow: true,
  });
  unifiedDeckMesh.position.set(0, deckY - deckThick * 0.5, 0);
  staticParkGroup.add(unifiedDeckMesh);

  const unifiedSkirtMesh = makePart(makePolygonDeckGeo(bwPoly, 0.26, 0.08, 0.014), '#dfc0a0', {
    pbrWood: { textures: coastalOakPbrSet, colorHex: '#cfa984', roughness: 0.94, bumpScale: 0.038 },
    strokeWidth: 0,
  });
  unifiedSkirtMesh.position.set(0, deckY - deckThick - 0.13, 0);
  staticParkGroup.add(unifiedSkirtMesh);

  const addTimberDeckSubBeams = (minX: number, maxX: number, minZ: number, maxZ: number) => {
    const w = Math.max(0.4, maxX - minX - 0.5);
    const d = Math.max(0.4, maxZ - minZ - 0.5);
    const cx = (minX + maxX) * 0.5;
    const cz = (minZ + maxZ) * 0.5;
    const subBeamGeo = applyBoxMetricUvs(new THREE.BoxGeometry(w, 0.18, d), 3.0, 2.2, false, cx, cz);
    const subBeam = makePart(subBeamGeo, '#dfc0a0', {
      pbrWood: { textures: hullWoodPbrSet, colorHex: '#dfc0a0', roughness: 0.95, bumpScale: 0.038 },
      strokeWidth: 0,
    });
    subBeam.position.set(cx, deckY - deckThick - 0.31, cz);
    staticParkGroup.add(subBeam);
  };
  addTimberDeckSubBeams(mp.mainBoardwalk.minX, mp.mainBoardwalk.maxX, mp.mainBoardwalk.minZ, mp.mainBoardwalk.maxZ);
  addTimberDeckSubBeams(mp.mainBoardwalk.maxX + 0.3, mp.bianglalaPierDeck.maxX, mp.bianglalaPierDeck.minZ, mp.bianglalaPierDeck.maxZ);
  addTimberDeckSubBeams(mp.gazeboFingerJetty.headMinX + 0.3, mp.gazeboFingerJetty.headMaxX, mp.gazeboFingerJetty.headMinZ, mp.gazeboFingerJetty.headMaxZ);

  // Heavy cylindrical marine pilings + iron bands + concrete tidal collars (InstancedMesh batched!)
  const pilingMatrices: THREE.Matrix4[] = [];
  const bandMatrices: THREE.Matrix4[] = [];
  const collarMatrices: THREE.Matrix4[] = [];
  const pushPilingAt = (px: number, pz: number) => {
    pilingMatrices.push(new THREE.Matrix4().makeTranslation(px, deckY - 0.28 - 1.7, pz));
    bandMatrices.push(new THREE.Matrix4().makeTranslation(px, deckY - 0.72, pz));
    collarMatrices.push(new THREE.Matrix4().makeTranslation(px, -0.35, pz));
  };

  for (let z = -73.5; z <= -21.8; z += 5.5) {
    pushPilingAt(mp.mainBoardwalk.minX + 0.45, z);
    pushPilingAt((mp.mainBoardwalk.minX + mp.mainBoardwalk.maxX) * 0.5, z);
    if (z < -42.5 || z > -22.5) {
      pushPilingAt(mp.mainBoardwalk.maxX - 0.45, z);
    }
  }
  for (const px of [118.2, 121.4, 124.3]) {
    for (const pz of [-41.6, -37.0, -32.5, -28.0, -23.4]) {
      pushPilingAt(px, pz);
    }
  }
  for (const [px, pz] of [
    [125.5, -28.0],
    [125.5, -25.2],
    [126.5, -29.2],
    [126.5, -24.0],
    [129.3, -29.2],
    [129.3, -24.0],
    [128.0, -26.6],
  ]) {
    pushPilingAt(px, pz);
  }

  const pilingWoodInst = makeInstancedBatch(
    applyCylinderWoodMetricUvs(new THREE.CylinderGeometry(0.26, 0.29, 3.5, 12), 0.275, 3.5),
    '#dfc0a0',
    pilingMatrices,
    {
      castShadow: true,
      receiveShadow: true,
      pbrWood: { textures: hullWoodPbrSet, colorHex: '#f4dec4', roughness: 0.9, bumpScale: 0.034 },
    },
  );
  const pilingBandInst = makeInstancedBatch(
    new THREE.CylinderGeometry(0.285, 0.285, 0.12, 12),
    '#334155',
    bandMatrices,
  );
  const pilingCollarInst = makeInstancedBatch(
    new THREE.CylinderGeometry(0.36, 0.42, 0.72, 12),
    '#64748b',
    collarMatrices,
  );
  if (pilingWoodInst) instancedBatchGroup.add(pilingWoodInst);
  if (pilingBandInst) instancedBatchGroup.add(pilingBandInst);
  if (pilingCollarInst) instancedBatchGroup.add(pilingCollarInst);

  // Diagonal marine timber sway bracing between over-water pier pilings (x > 117)
  const swayDir = new THREE.Vector3();
  const upVec = new THREE.Vector3(0, 1, 0);
  for (const px of [118.2, 124.3]) {
    const zPairs = [
      [-41.6, -37.0],
      [-37.0, -32.5],
      [-32.5, -28.0],
      [-28.0, -23.4],
    ];
    for (const [z0, z1] of zPairs) {
      for (const [ya, yb] of [
        [0.05, 0.65],
        [0.65, 0.05],
      ]) {
        const pA = new THREE.Vector3(px, ya, z0);
        const pB = new THREE.Vector3(px, yb, z1);
        swayDir.subVectors(pB, pA);
        const brace = makePart(
          applyBoxMetricUvs(new THREE.BoxGeometry(0.11, swayDir.length(), 0.11), 1.8, 1.8),
          '#cfa984',
          {
            pbrWood: { textures: hullWoodPbrSet, colorHex: '#cfa984', roughness: 0.96 },
            strokeWidth: 0,
            castShadow: false,
          },
        );
        brace.position.copy(pA).add(pB).multiplyScalar(0.5);
        brace.quaternion.setFromUnitVectors(upVec, swayDir.clone().normalize());
        staticParkGroup.add(brace);
      }
    }
  }

  // Five Architectural Timber Staircases with Individual Plank Treads, Risers & Side Stringers (0.0m <-> +1.10m)
  const addBoardwalkStaircase = (
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    climbAxis: '+x' | '-x' | '-z' | '+z',
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
      } else if (climbAxis === '-x') {
        sw = totalW / steps + 0.04;
        sx = maxX - (frac0 + frac1) * 0.5 * totalW;
      } else if (climbAxis === '-z') {
        sd = totalD / steps + 0.04;
        sz = maxZ - (frac0 + frac1) * 0.5 * totalD;
      } else {
        sd = totalD / steps + 0.04;
        sz = minZ + (frac0 + frac1) * 0.5 * totalD;
      }

      const riserGeo = applyBoxMetricUvs(
        new THREE.BoxGeometry(sw - 0.03, Math.max(0.05, topH - treadThick), sd - 0.03),
        2.4,
        2.0,
        false,
        sx,
        sz,
      );
      const riserMesh = makePart(riserGeo, '#dfc0a0', {
        pbrWood: { textures: coastalOakPbrSet, colorHex: '#dfc0a0' },
        strokeWidth: 0,
      });
      riserMesh.position.set(sx, (topH - treadThick) * 0.5, sz);
      staticParkGroup.add(riserMesh);

      const treadGeo = applyBoxMetricUvs(
        new THREE.BoxGeometry(sw + 0.04, treadThick, sd + 0.04),
        3.6,
        4.0,
        false,
        sx,
        sz,
      );
      const treadMesh = makePart(treadGeo, '#ffffff', { map: plankTex, strokeWidth: 0 });
      treadMesh.position.set(sx, topH - treadThick * 0.5, sz);
      staticParkGroup.add(treadMesh);
    }

    const newelGeo = applyBoxMetricUvs(new THREE.BoxGeometry(0.15, 0.96, 0.15), 1.8, 1.8);
    if (climbAxis === '+x' || climbAxis === '-x') {
      const dirSign = climbAxis === '+x' ? 1 : -1;
      const spanW = totalW - 0.18;
      const slopeLen = Math.hypot(spanW, deckY * 0.9);
      const slopeAng = Math.atan2(deckY * 0.9, spanW) * dirSign;
      const xBot = climbAxis === '+x' ? minX + 0.12 : maxX - 0.12;
      const xTop = climbAxis === '+x' ? maxX - 0.08 : minX + 0.08;
      for (const szSide of [minZ + 0.08, maxZ - 0.08]) {
        const stringer = makePart(
          applyBoxMetricUvs(new THREE.BoxGeometry(slopeLen, 0.2, 0.14), 2.4, 1.8),
          '#dfc0a0',
          {
            pbrWood: { textures: hullWoodPbrSet, colorHex: '#dfc0a0' },
            strokeWidth: 0,
          },
        );
        stringer.position.set((minX + maxX) * 0.5 + dirSign * 0.06, deckY * 0.44, szSide);
        stringer.rotation.z = slopeAng;
        staticParkGroup.add(stringer);

        const handrail = makePart(
          applyBoxMetricUvs(new THREE.BoxGeometry(slopeLen + 0.08, 0.09, 0.12), 2.4, 1.8),
          '#f5e2cc',
          {
            pbrWood: { textures: coastalOakPbrSet, colorHex: '#f5e2cc' },
            strokeWidth: 0,
          },
        );
        handrail.position.set((minX + maxX) * 0.5 + dirSign * 0.04, deckY * 0.5 + 0.9, szSide);
        handrail.rotation.z = slopeAng;
        staticParkGroup.add(handrail);

        const botPost = makePart(newelGeo, '#cfa984', {
          pbrWood: { textures: coastalOakPbrSet, colorHex: '#cfa984' },
          strokeWidth: 0,
        });
        botPost.position.set(xBot, 0.48, szSide);
        staticParkGroup.add(botPost);

        const topPost = makePart(newelGeo, '#cfa984', {
          pbrWood: { textures: coastalOakPbrSet, colorHex: '#cfa984' },
          strokeWidth: 0,
        });
        topPost.position.set(xTop, deckY + 0.44, szSide);
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
        const stringer = makePart(
          applyBoxMetricUvs(new THREE.BoxGeometry(0.14, 0.2, slopeLen), 2.4, 1.8),
          '#dfc0a0',
          {
            pbrWood: { textures: hullWoodPbrSet, colorHex: '#dfc0a0' },
            strokeWidth: 0,
          },
        );
        stringer.position.set(sxSide, deckY * 0.44, (minZ + maxZ) * 0.5 + dirSign * 0.06);
        stringer.rotation.x = slopeAng;
        staticParkGroup.add(stringer);

        const handrail = makePart(
          applyBoxMetricUvs(new THREE.BoxGeometry(0.12, 0.09, slopeLen + 0.08), 2.4, 1.8),
          '#f5e2cc',
          {
            pbrWood: { textures: coastalOakPbrSet, colorHex: '#f5e2cc' },
            strokeWidth: 0,
          },
        );
        handrail.position.set(sxSide, deckY * 0.5 + 0.9, (minZ + maxZ) * 0.5 + dirSign * 0.04);
        handrail.rotation.x = slopeAng;
        staticParkGroup.add(handrail);

        const botPost = makePart(newelGeo, '#cfa984', {
          pbrWood: { textures: coastalOakPbrSet, colorHex: '#cfa984' },
          strokeWidth: 0,
        });
        botPost.position.set(sxSide, 0.48, zBot);
        staticParkGroup.add(botPost);

        const topPost = makePart(newelGeo, '#cfa984', {
          pbrWood: { textures: coastalOakPbrSet, colorHex: '#cfa984' },
          strokeWidth: 0,
        });
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
  addBoardwalkStaircase(
    mp.stairs.eastBeach.minX,
    mp.stairs.eastBeach.maxX,
    mp.stairs.eastBeach.minZ,
    mp.stairs.eastBeach.maxZ,
    '-x',
  );

  // X-Braced Weathered Timber Boardwalk & Pier Railings (1:1 with AMUSEMENT_PARK_RAILING_RUNS, InstancedMesh batched!)
  const railPostMatrices: THREE.Matrix4[] = [];
  const railCapMatrices: THREE.Matrix4[] = [];
  const railDiagMatrices: THREE.Matrix4[] = [];
  const tmpRailPos = new THREE.Vector3();
  const tmpRailQuat = new THREE.Quaternion();
  const tmpRailScale = new THREE.Vector3();
  const tmpRailEuler = new THREE.Euler();

  for (const run of AMUSEMENT_PARK_RAILING_RUNS) {
    const dx = run.x2 - run.x1;
    const dz = run.z2 - run.z1;
    const totalLen = Math.hypot(dx, dz);
    if (totalLen < 0.6) continue;
    const yaw = Math.atan2(dx, dz);
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    const bayCount = Math.max(1, Math.round(totalLen / 2.35));
    const bayLen = totalLen / bayCount;

    const runGrp = new THREE.Group();
    runGrp.position.set(run.x1, deckY, run.z1);
    runGrp.rotation.y = yaw;
    staticParkGroup.add(runGrp);

    const railSpan = Math.max(0.15, totalLen - 0.04);
    const topRail = makePart(
      applyMetricPlanarUvs(makeRoundedParkBoxGeo(0.15, 0.1, railSpan, 0.025, 2), 2.4, 1.8),
      '#f5e2cc',
      {
        pbrWood: { textures: coastalOakPbrSet, colorHex: '#f5e2cc' },
        strokeWidth: 0,
      },
    );
    topRail.position.set(0, 0.98, totalLen * 0.5);
    runGrp.add(topRail);

    const botRail = makePart(
      applyMetricPlanarUvs(makeRoundedParkBoxGeo(0.12, 0.09, railSpan, 0.022, 2), 2.4, 1.8),
      '#dfc0a0',
      {
        pbrWood: { textures: coastalOakPbrSet, colorHex: '#dfc0a0' },
        strokeWidth: 0,
      },
    );
    botRail.position.set(0, 0.2, totalLen * 0.5);
    runGrp.add(botRail);

    const diagLen = Math.hypot(bayLen - 0.16, 0.72);
    const diagTilt = Math.atan2(bayLen - 0.16, 0.72);
    tmpRailScale.set(1, diagLen, 1);

    for (let i = 0; i <= bayCount; i++) {
      const dist = i * bayLen;
      const wx = run.x1 + sinY * dist;
      const wz = run.z1 + cosY * dist;
      tmpRailQuat.setFromAxisAngle(upVec, yaw);

      tmpRailPos.set(wx, deckY + 0.54, wz);
      railPostMatrices.push(new THREE.Matrix4().compose(tmpRailPos, tmpRailQuat, new THREE.Vector3(1, 1, 1)));

      tmpRailPos.set(wx, deckY + 1.1, wz);
      railCapMatrices.push(new THREE.Matrix4().compose(tmpRailPos, tmpRailQuat, new THREE.Vector3(1, 1, 1)));

      if (i < bayCount) {
        const cDist = (i + 0.5) * bayLen;
        const cx = run.x1 + sinY * cDist;
        const cz = run.z1 + cosY * cDist;
        for (const tiltSign of [-1, 1] as const) {
          tmpRailEuler.set(tiltSign * diagTilt, yaw, 0, 'YXZ');
          tmpRailQuat.setFromEuler(tmpRailEuler);
          tmpRailPos.set(cx, deckY + 0.59, cz);
          railDiagMatrices.push(new THREE.Matrix4().compose(tmpRailPos, tmpRailQuat, tmpRailScale));
        }
      }
    }
  }

  const instRailPosts = makeInstancedBatch(
    applyBoxMetricUvs(new THREE.BoxGeometry(0.18, 1.08, 0.18), 1.8, 1.8),
    '#cfa984',
    railPostMatrices,
    {
      castShadow: true,
      receiveShadow: true,
      pbrWood: { textures: coastalOakPbrSet, colorHex: '#eed3b6', roughness: 0.88 },
    },
  );
  const instRailCaps = makeInstancedBatch(
    applyBoxMetricUvs(new THREE.BoxGeometry(0.25, 0.08, 0.25), 1.6, 1.6),
    '#ffffff',
    railCapMatrices,
    {
      pbrWood: { textures: coastalOakPbrSet, colorHex: '#ffffff', roughness: 0.86 },
    },
  );
  const instRailDiags = makeInstancedBatch(
    applyBoxMetricUvs(new THREE.BoxGeometry(0.075, 1.0, 0.085), 1.6, 1.6),
    '#fff6ea',
    railDiagMatrices,
    {
      pbrWood: { textures: coastalOakPbrSet, colorHex: '#fff6ea', roughness: 0.86 },
    },
  );
  if (instRailPosts) instancedBatchGroup.add(instRailPosts);
  if (instRailCaps) instancedBatchGroup.add(instRailCaps);
  if (instRailDiags) instancedBatchGroup.add(instRailDiags);

  // Red-and-White Nautical Lifebuoy Rings & Coastal Boardwalk Benches
  const lifebuoyGeo = new THREE.TorusGeometry(0.32, 0.085, 8, 18);
  for (const [lx, lz, rotY] of [
    [116.72, -52.0, Math.PI / 2],
    [116.72, -62.5, Math.PI / 2],
    [124.52, -35.5, Math.PI / 2],
    [127.4, -23.68, 0],
  ]) {
    const ring = makePart(lifebuoyGeo, '#ef4444', { strokeWidth: 0.012 });
    ring.position.set(lx, deckY + 0.62, lz);
    ring.rotation.y = rotY;
    staticParkGroup.add(ring);
  }

  const addParkBench = (bx: number, by: number, bz: number, yaw: number) => {
    const bGrp = new THREE.Group();
    bGrp.position.set(bx, by, bz);
    bGrp.rotation.y = yaw;
    staticParkGroup.add(bGrp);
    const seat = makePart(
      applyMetricPlanarUvs(makeRoundedParkBoxGeo(1.85, 0.1, 0.56, 0.025, 2), 2.0, 1.8),
      '#f5e2cc',
      { pbrWood: { textures: coastalOakPbrSet, colorHex: '#f5e2cc' }, strokeWidth: 0 },
    );
    seat.position.set(0, 0.44, 0);
    bGrp.add(seat);
    const back = makePart(
      applyMetricPlanarUvs(makeRoundedParkBoxGeo(1.85, 0.44, 0.09, 0.022, 2), 2.0, 1.8),
      '#dfc0a0',
      { pbrWood: { textures: coastalOakPbrSet, colorHex: '#dfc0a0' }, strokeWidth: 0 },
    );
    back.position.set(0, 0.72, -0.24);
    back.rotation.x = -0.15;
    bGrp.add(back);
    for (const lx of [-0.74, 0.74]) {
      const leg = makePart(makeRoundedParkBoxGeo(0.12, 0.44, 0.52, 0.025, 2), '#46403a', { strokeWidth: 0, receiveShadow: true });
      leg.position.set(lx, 0.22, 0);
      bGrp.add(leg);
    }
  };
  addParkBench(103.0, deckY, -24.5, Math.PI / 2);
  addParkBench(103.0, deckY, -39.5, Math.PI / 2);
  addParkBench(103.0, deckY, -65.5, Math.PI / 2);
  addParkBench(83.8, 0.072, -49.5, Math.PI / 2);
  addParkBench(83.8, 0.072, -82.6, Math.PI / 2);

  // Pier-End Striped Gazebo Pavilion & Coastal Pennant Flagpole
  {
    const gx = mp.gazeboFingerJetty.gazeboCenterX;
    const gz = mp.gazeboFingerJetty.gazeboCenterZ;
    const gazGrp = new THREE.Group();
    gazGrp.position.set(gx, deckY, gz);
    staticParkGroup.add(gazGrp);

    const colGeo = new THREE.CylinderGeometry(0.11, 0.13, 3.1, 10);
    for (const [ox, oz] of [
      [-1.45, -2.18],
      [1.45, -2.18],
      [-1.45, 2.18],
      [1.45, 2.18],
    ]) {
      const col = makePart(colGeo, '#faf2e3', { strokeWidth: 0, receiveShadow: true });
      col.position.set(ox, 1.55, oz);
      gazGrp.add(col);
    }

    // Built-in coastal timber bench inside pierhead gazebo
    const gazBench = makePart(
      applyBoxMetricUvs(new THREE.BoxGeometry(0.54, 0.44, 2.4), 2.0, 2.0),
      '#f5e2cc',
      {
        pbrWood: { textures: coastalOakPbrSet, colorHex: '#f5e2cc' },
        strokeWidth: 0,
      },
    );
    gazBench.position.set(1.12, 0.22, 0);
    gazGrp.add(gazBench);

    addStripedCarnivalTentRoof(
      gazGrp,
      1.68,
      2.45,
      3.1,
      1.55,
      '#eab308',
      '#fffbeb',
      makePart,
      carnivalSurfaceAtlasTex,
    );

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
    outerPole.position.set(1.45, 2.4, -2.75);
    gazGrp.add(outerPole);
    const outerFlag = makePart(new THREE.BoxGeometry(0.92, 0.42, 0.05), '#f97316', {
      strokeWidth: 0.012,
    });
    outerFlag.position.set(1.9, 4.55, -2.75);
    gazGrp.add(outerFlag);
  }

  // =========================================================================
  // 2. COBBLESTONE CARNIVAL MIDWAY, ENTRANCE ARCHWAY, FESTOON LIGHTS & STALLS
  // =========================================================================
  {
    // Helper placing mutually disjoint cobblestone walkway bays at 0.072m topY (zero overlap!)
    const addCobbleWalkwayStrip = (minX: number, maxX: number, minZ: number, maxZ: number) => {
      const w = maxX - minX;
      const d = maxZ - minZ;
      const cx = (minX + maxX) * 0.5;
      const cz = (minZ + maxZ) * 0.5;
      const geo = applyBoxMetricUvs(new THREE.BoxGeometry(w, 0.072, d), 3.2, 3.2, false, cx, cz);
      const mesh = makePart(geo, '#ffffff', {
        map: cobbleTex,
        strokeWidth: 0,
        castShadow: false,
      });
      mesh.position.set(cx, 0.036, cz);
      staticParkGroup.add(mesh);
    };

    // Main North-South midway promenade [83.0..92.0] x [-84.5..-19.25]
    addCobbleWalkwayStrip(83.0, 92.0, -84.5, -19.25);
    // East boardwalk & Bianglala approach apron [92.0..101.5] x [-37.1..-21.0]
    addCobbleWalkwayStrip(92.0, 101.5, -37.1, -21.0);
    // Carousel-to-boardwalk threshold apron [98.5..101.5] x [-53.5..-37.1]
    addCobbleWalkwayStrip(98.5, 101.5, -53.5, -37.1);
    // North Forecourt Cobblestone Promenade [92.0..113.5] x [-84.3..-78.0] linking to 18m Bumper Car Arena
    addCobbleWalkwayStrip(92.0, 113.5, -84.3, -78.0);
    // North Boardwalk Stair Threshold [104.5..111.5] x [-78.0..-76.9]
    addCobbleWalkwayStrip(104.5, 111.5, -78.0, -76.9);

    // Limestone promenade curbs strictly along open borders (stop clear of entrance arch plinths!)
    for (const [edgeX, zMin, zMax] of [
      [82.9, -51.5, -21.25],
      [82.9, -84.5, -77.5],
      [92.1, -24.5, -21.25],
      [92.1, -62.5, -54.0],
    ] as const) {
      const cLen = zMax - zMin;
      const curb = makePart(new THREE.BoxGeometry(0.26, 0.1, cLen), '#d6c5a9', {
        strokeWidth: 0.014,
        castShadow: false,
      });
      curb.position.set(edgeX, 0.05, (zMin + zMax) * 0.5);
      staticParkGroup.add(curb);
    }

    // Stepped Circular Stone Plaza Medallions (0.088m topY + beveled stone collar — zero coplanar overlap!)
    const addSteppedCobbleCircle = (cx: number, cz: number, radius: number) => {
      const collar = makePart(
        new THREE.CylinderGeometry(radius + 0.16, radius + 0.24, 0.078, 36),
        '#d6c5a9',
        { strokeWidth: 0.014, castShadow: false },
      );
      collar.position.set(cx, 0.039, cz);
      staticParkGroup.add(collar);

      const discGeo = applyCylinderMetricUvs(
        new THREE.CylinderGeometry(radius, radius + 0.06, 0.088, 36),
        6,
        1,
        3.2,
        cx,
        cz,
      );
      const disc = makePart(discGeo, '#ffffff', {
        map: cobbleTex,
        strokeWidth: 0,
        castShadow: false,
      });
      disc.position.set(cx, 0.044, cz);
      staticParkGroup.add(disc);
    };
    addSteppedCobbleCircle(mp.rides.komidiPutar.x, mp.rides.komidiPutar.z, 8.2);
    addSteppedCobbleCircle(mp.rides.ontagAnting.x, mp.rides.ontagAnting.z, 7.45);

    // Ornate Square Travertine Medallion in Midway Foreground (flush atop 0.072m cobble spine)
    const midSquareRim = makePart(new THREE.BoxGeometry(3.4, 0.14, 3.4), '#d6c5a9', {
      strokeWidth: 0.016,
      castShadow: false,
    });
    midSquareRim.position.set(87.5, 0.07, -58.5);
    staticParkGroup.add(midSquareRim);
    const midSquareInlay = makePart(new THREE.BoxGeometry(2.65, 0.16, 2.65), '#fde68a', {
      strokeWidth: 0.012,
      castShadow: false,
    });
    midSquareInlay.position.set(87.5, 0.08, -58.5);
    staticParkGroup.add(midSquareInlay);
  }

  // Grand Carnival Entrance Archway ("TAMAN RIA DERMAGA") at (87.5, -20.4)
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
        const goreCol = g % 2 === 0 ? '#dc2626' : '#fffbeb';
        const gm = makePart(applyAtlasCellUvs(gore, goreCol), '#ffffff', {
          map: carnivalSurfaceAtlasTex,
          strokeWidth: 0,
        });
        gm.position.set(px, 5.68, 0);
        archGrp.add(gm);
      }

      const finialSocketGeo = new THREE.LatheGeometry(
        [
          new THREE.Vector2(0, 0),
          new THREE.Vector2(0.09, 0),
          new THREE.Vector2(0.06, 0.08),
          new THREE.Vector2(0.07, 0.14),
          new THREE.Vector2(0.032, 0.20),
          new THREE.Vector2(0.030, 0.62),
          new THREE.Vector2(0.055, 0.65),
          new THREE.Vector2(0, 0.72),
        ],
        12,
      );
      const finialMast = makePart(finialSocketGeo, '#eab308', { strokeWidth: 0.01 });
      finialMast.position.set(px, 6.96, 0);
      archGrp.add(finialMast);

      const finialFlag = makePart(makeRoundedParkBoxGeo(0.58, 0.30, 0.05, 0.012, 2), '#facc15', {
        strokeWidth: 0.012,
      });
      finialFlag.position.set(px + 0.30, 7.36, 0);
      archGrp.add(finialFlag);
    }

    const beam = makePart(
      applyBoxMetricUvs(new THREE.BoxGeometry(pillarOffset * 2 + 1.25, 0.46, 0.68), 2.2, 2.2),
      '#cfa984',
      {
        pbrWood: { textures: coastalOakPbrSet, colorHex: '#cfa984', roughness: 0.94 },
        strokeWidth: 0,
      },
    );
    beam.position.set(0, 5.12, 0);
    archGrp.add(beam);

    const signBoard = makePart(new THREE.BoxGeometry(8.1, 1.82, 0.42), '#991b1b', {
      strokeWidth: 0.024,
    });
    signBoard.position.set(0, 5.92, 0);
    archGrp.add(signBoard);

    const archCrest = makePart(
      new THREE.CylinderGeometry(1.8, 1.8, 0.36, 18, 1, false, 0, Math.PI),
      '#eab308',
      { strokeWidth: 0.018 },
    );
    archCrest.rotation.z = Math.PI / 2;
    archCrest.rotation.y = Math.PI / 2;
    archCrest.scale.set(1.0, 1.0, 0.38);
    archCrest.position.set(0, 6.82, 0);
    archGrp.add(archCrest);

    const plaqueGeo = new THREE.PlaneGeometry(7.75, 1.56);
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
      const cartBody = makePart(
        applyAtlasCellUvs(new THREE.BoxGeometry(2.34, 1.04, 1.52), '#38bdf8'),
        '#ffffff',
        { map: carnivalSurfaceAtlasTex, strokeWidth: 0.02 },
      );
      cartBody.position.set(0, 0.78, 0);
      sGrp.add(cartBody);

      const recessedPanel = makePart(
        applyAtlasCellUvs(new THREE.BoxGeometry(2.02, 0.64, 1.58), '#e0f2fe'),
        '#ffffff',
        { map: carnivalSurfaceAtlasTex, strokeWidth: 0.014 },
      );
      recessedPanel.position.set(0, 0.76, 0);
      sGrp.add(recessedPanel);

      const counterTop = makePart(new THREE.BoxGeometry(2.48, 0.14, 1.66), '#ffffff', {
        strokeWidth: 0.016,
      });
      counterTop.position.set(0, 1.34, 0);
      sGrp.add(counterTop);

      const handleBar = makePart(new THREE.CylinderGeometry(0.035, 0.035, 1.25, 8), '#eab308', {
        strokeWidth: 0.01,
      });
      handleBar.rotation.x = Math.PI / 2;
      handleBar.position.set(-1.34, 1.18, 0);
      sGrp.add(handleBar);

      const wheelRimGeo = new THREE.TorusGeometry(0.45, 0.055, 8, 20);
      for (const wz of [-0.82, 0.82]) {
        const rim = makePart(wheelRimGeo, '#cfa984', {
          pbrWood: { textures: coastalOakPbrSet, colorHex: '#cfa984', roughness: 0.94 },
          strokeWidth: 0,
        });
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
          const spk = makePart(
            applyBoxMetricUvs(new THREE.BoxGeometry(0.045, 0.86, 0.045), 1.4, 1.4),
            '#dfc0a0',
            {
              pbrWood: { textures: coastalOakPbrSet, colorHex: '#dfc0a0', roughness: 0.94 },
              strokeWidth: 0,
            },
          );
          spk.position.set(0.28, 0.48, wz);
          spk.rotation.z = (sp * Math.PI) / 4;
          sGrp.add(spk);
        }
      }

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

      addStripedCarnivalTentRoof(
        sGrp,
        1.24,
        0.88,
        2.88,
        0.68,
        '#38bdf8',
        '#f0f9ff',
        makePart,
        carnivalSurfaceAtlasTex,
      );

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
      const base = makePart(
        applyAtlasCellUvs(new THREE.BoxGeometry(2.54, 1.12, 2.54), '#f472b6'),
        '#ffffff',
        { map: carnivalSurfaceAtlasTex, strokeWidth: 0.02 },
      );
      base.position.set(0, 0.56, 0);
      sGrp.add(base);

      const frontInset = makePart(
        applyAtlasCellUvs(new THREE.BoxGeometry(2.14, 0.74, 2.6), '#fbcfe8'),
        '#ffffff',
        { map: carnivalSurfaceAtlasTex, strokeWidth: 0.014 },
      );
      frontInset.position.set(0, 0.56, 0);
      sGrp.add(frontInset);

      const counter = makePart(new THREE.BoxGeometry(2.74, 0.14, 2.74), '#fdf2f8', {
        strokeWidth: 0.016,
      });
      counter.position.set(0, 1.16, 0);
      sGrp.add(counter);

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

      addStripedCarnivalTentRoof(
        sGrp,
        1.44,
        1.44,
        2.86,
        0.92,
        '#f472b6',
        '#fdf2f8',
        makePart,
        carnivalSurfaceAtlasTex,
      );
      return;
    }

    const floorDeck = makePart(
      applyBoxMetricUvs(new THREE.BoxGeometry(3.64, 0.16, 3.24), 2.2, 2.2),
      '#ffffff',
      { map: plankTex, strokeWidth: 0 },
    );
    floorDeck.position.set(0, 0.08, 0);
    sGrp.add(floorDeck);

    const frontCounter = makePart(
      applyAtlasCellUvs(new THREE.BoxGeometry(3.44, 1.0, 0.62), spec.counterHex),
      '#ffffff',
      { map: carnivalSurfaceAtlasTex, strokeWidth: 0.02 },
    );
    frontCounter.position.set(0, 0.66, 1.18);
    sGrp.add(frontCounter);

    const counterLip = makePart(new THREE.BoxGeometry(3.58, 0.12, 0.76), '#fde68a', {
      strokeWidth: 0.016,
    });
    counterLip.position.set(0, 1.2, 1.18);
    sGrp.add(counterLip);

    const backWall = makePart(
      applyAtlasCellUvs(new THREE.BoxGeometry(3.44, 2.52, 0.2), '#fef3c7'),
      '#ffffff',
      { map: carnivalSurfaceAtlasTex, strokeWidth: 0.018 },
    );
    backWall.position.set(0, 1.42, -1.36);
    sGrp.add(backWall);

    const shelf = makePart(
      applyBoxMetricUvs(new THREE.BoxGeometry(3.2, 0.1, 0.42), 2.0, 2.0),
      '#cfa984',
      {
        pbrWood: { textures: coastalOakPbrSet, colorHex: '#cfa984', roughness: 0.94 },
        strokeWidth: 0,
      },
    );
    shelf.position.set(0, 1.88, -1.14);
    sGrp.add(shelf);

    const tentPostGeo = applyCylinderWoodMetricUvs(
      new THREE.CylinderGeometry(0.075, 0.085, 2.75, 8),
      0.08,
      2.75,
    );
    for (const [px, pz] of [
      [-1.62, -1.36],
      [1.62, -1.36],
      [-1.62, 1.36],
      [1.62, 1.36],
    ]) {
      const tp = makePart(tentPostGeo, '#cfa984', {
        pbrWood: { textures: hullWoodPbrSet, colorHex: '#cfa984', roughness: 0.96 },
        strokeWidth: 0,
      });
      tp.position.set(px, 1.52, pz);
      sGrp.add(tp);
    }

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

    addStripedCarnivalTentRoof(
      sGrp,
      1.94,
      1.74,
      2.92,
      1.32,
      spec.stripePrimaryHex,
      spec.stripeSecondaryHex,
      makePart,
      carnivalSurfaceAtlasTex,
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
      localV.applyAxisAngle(upVec, spec.rotY);
      localV.add(new THREE.Vector3(spec.x, 0, spec.z));
      stallBulbPositions.push(localV);
    }
  };

  for (const stall of CARNIVAL_MIDWAY_STALLS) {
    buildCarnivalStall(stall);
  }

  // Overhead Festoon Carnival String Lights (deduplicated pole placement clear of railings, stairs & plazas!)
  const festoonBulbPositions: THREE.Vector3[] = [...stallBulbPositions];
  const festoonPoleGeo = new THREE.CylinderGeometry(0.06, 0.078, 3.65, 8);
  const placedFestoonPoles = new Set<string>();
  const addFestoonSpan = (
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    sagM: number,
    bulbCount: number,
    withPoles: boolean,
  ) => {
    if (withPoles) {
      for (const endP of [p1, p2]) {
        const key = `${endP.x.toFixed(1)},${endP.z.toFixed(1)}`;
        if (placedFestoonPoles.has(key)) continue;
        placedFestoonPoles.add(key);
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
      new THREE.Vector3(mp.mainBoardwalk.minX + 0.32, deckY + 3.65, z1),
      new THREE.Vector3(mp.mainBoardwalk.minX + 0.32, deckY + 3.65, z2),
      0.38,
      6,
      true,
    );
  }
  for (const [z1, z2] of [
    [-42.8, -53.0],
    [-53.0, -64.8],
  ]) {
    addFestoonSpan(
      new THREE.Vector3(mp.mainBoardwalk.maxX - 0.32, deckY + 3.65, z1),
      new THREE.Vector3(mp.mainBoardwalk.maxX - 0.32, deckY + 3.65, z2),
      0.38,
      7,
      true,
    );
  }
  for (const [xA, zA, xB, zB] of [
    [83.1, -23.5, 91.9, -28.5],
    [83.1, -28.5, 91.9, -35.8],
    [83.1, -55.5, 91.9, -61.0],
    [83.1, -78.2, 91.9, -78.2],
  ] as const) {
    addFestoonSpan(
      new THREE.Vector3(xA, 4.2, zA),
      new THREE.Vector3(xB, 4.2, zB),
      0.42,
      7,
      true,
    );
  }

  // Kai Fish Market Coconut Palm Trees (1:1 Ringed Curved Trunks, Canopy AO, 5 Coconuts & Alpha-Cutout Swaying Fronds!)
  const palmFrondShaderMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uFrondTex: { value: palmFrondMaskTex },
        uColorA: { value: new THREE.Color('#5b9641') },
        uColorB: { value: new THREE.Color('#9bd054') },
        uColorRachis: { value: new THREE.Color('#badb6a') },
        uColorShadow: { value: new THREE.Color('#345e2e') },
        uAlphaThreshold: { value: 0.28 },
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
      uniform float uWindPhase;
      uniform vec2 uWindDirection;
      uniform float uWindStrength;
      uniform float uWindGust;

      varying vec2 vUv;
      varying vec3 vNormalW;

      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);

        float arcFactor = smoothstep(0.06, 1.0, uv.y);
        float edgeFlutter = abs(uv.x - 0.5) * 2.0 * smoothstep(0.15, 0.9, uv.y);
        float seedPhase = worldPos.x * 0.42 + worldPos.z * 0.37 + uv.y * 2.2;
        float phase = uWindPhase + seedPhase;
        float sway = (sin(phase) * 0.38 + uWindGust * 0.24) * uWindStrength * arcFactor;
        float flutter = sin(phase * 2.3 + uv.x * 6.0) * 0.07 * uWindStrength * edgeFlutter;

        worldPos.x += uWindDirection.x * sway;
        worldPos.z += uWindDirection.y * sway;
        worldPos.y += (sin(phase * 0.85) * 0.14 * arcFactor + flutter) * uWindStrength;

        vNormalW = normalize(mat3(modelMatrix) * normal);
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
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

      void main() {
        vec4 maskSample = texture2D(uFrondTex, vUv);
        if (maskSample.r < uAlphaThreshold) discard;

        float rawNdl = dot(normalize(vNormalW), normalize(uLightDirection));
        float tipSun = smoothstep(0.12, 0.94, vUv.y);
        float litFactor = smoothstep(-0.08, 0.88, rawNdl);
        float shadowFactor = smoothstep(-0.48, 0.30, rawNdl * 0.82 + tipSun * 0.25);
        float centralStemMask = smoothstep(0.88, 0.99, maskSample.g) * (1.0 - smoothstep(0.0, 0.04, abs(vUv.x - 0.5)));

        vec3 leafCol = mix(uColorShadow, uColorA, shadowFactor);
        leafCol = mix(leafCol, uColorB, clamp(litFactor * 0.58 + tipSun * 0.34, 0.0, 1.0));
        vec3 baseCol = mix(leafCol, uColorRachis, centralStemMask * 0.52);
        vec3 sunMod = mix(vec3(0.86, 0.88, 0.90), uLightColor, 0.74);

        gl_FragColor = vec4(baseCol * sunMod, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
    side: THREE.DoubleSide,
  });
  const palmFrondDepthMat = new THREE.ShaderMaterial({
    uniforms: {
      uFrondTex: { value: palmFrondMaskTex },
      uAlphaThreshold: { value: 0.28 },
      uWindPhase: windUniforms.uWindPhase,
      uWindDirection: windUniforms.uWindDirection,
      uWindStrength: windUniforms.uWindStrength,
      uWindGust: windUniforms.uWindGust,
    },
    vertexShader: /* glsl */ `
      uniform float uWindPhase;
      uniform vec2 uWindDirection;
      uniform float uWindStrength;
      uniform float uWindGust;

      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);

        float arcFactor = smoothstep(0.06, 1.0, uv.y);
        float edgeFlutter = abs(uv.x - 0.5) * 2.0 * smoothstep(0.15, 0.9, uv.y);
        float seedPhase = worldPos.x * 0.42 + worldPos.z * 0.37 + uv.y * 2.2;
        float phase = uWindPhase + seedPhase;
        float sway = (sin(phase) * 0.38 + uWindGust * 0.24) * uWindStrength * arcFactor;
        float flutter = sin(phase * 2.3 + uv.x * 6.0) * 0.07 * uWindStrength * edgeFlutter;

        worldPos.x += uWindDirection.x * sway;
        worldPos.z += uWindDirection.y * sway;
        worldPos.y += (sin(phase * 0.85) * 0.14 * arcFactor + flutter) * uWindStrength;

        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      #include <packing>
      uniform sampler2D uFrondTex;
      uniform float uAlphaThreshold;
      varying vec2 vUv;
      void main() {
        if (texture2D(uFrondTex, vUv).r < uAlphaThreshold) discard;
        gl_FragColor = packDepthToRGBA(gl_FragCoord.z);
      }
    `,
    side: THREE.DoubleSide,
  });
  disposableMaterials.push(palmFrondShaderMat, palmFrondDepthMat);

  {
    const sharedPalmTrunkData = createKaiPalmTrunkGeometry();
    const sharedPalmCrownFrondsGeo = createKaiPalmCrownFrondsGeometry();
    const crownShaftGeo = new THREE.CylinderGeometry(0.22, 0.17, 0.42, 8);
    const coconutGeo = new THREE.SphereGeometry(0.17, 8, 8);
    disposableGeometries.push(sharedPalmTrunkData.trunkGeo, crownShaftGeo, coconutGeo);

    const batchedPalmCrownWorldGeos: THREE.BufferGeometry[] = [];
    const tmpMat = new THREE.Matrix4();
    const tmpPos = new THREE.Vector3();
    const tmpQuat = new THREE.Quaternion();
    const tmpScale = new THREE.Vector3();

    for (const palm of AMUSEMENT_PARK_PALM_TREES) {
      const palmScale = palm.scale * 1.48;
      const pGrp = new THREE.Group();
      pGrp.position.set(palm.x, 0.0, palm.z);
      pGrp.rotation.y = palm.rotY;
      pGrp.scale.setScalar(palmScale);
      staticParkGroup.add(pGrp);

      // 1. Continuous curved ringed trunk with top-of-trunk canopy AO vertex gradient + dappled shadow receiving
      const trunkMesh = makePart(sharedPalmTrunkData.trunkGeo, '#ffffff', {
        map: palmTrunkBarkTex,
        strokeWidth: 0,
        castShadow: true,
        receiveShadow: true,
        bounceStrength: 0.14,
      });
      pGrp.add(trunkMesh);

      // 2. Crownshaft collar & 5 coconuts
      const { topY, topZ } = sharedPalmTrunkData;
      const shaft = makePart(crownShaftGeo, '#527838', { strokeWidth: 0, receiveShadow: true });
      shaft.position.set(0, topY + 0.06, topZ + 0.02);
      shaft.rotation.x = 0.22;
      pGrp.add(shaft);

      for (let c = 0; c < 5; c++) {
        const cAng = (c * Math.PI * 2) / 5;
        const coco = makePart(coconutGeo, c % 2 === 0 ? '#698c3c' : '#846842', {
          strokeWidth: 0,
          receiveShadow: true,
        });
        coco.position.set(Math.cos(cAng) * 0.21, topY - 0.08, topZ + Math.sin(cAng) * 0.21);
        pGrp.add(coco);
      }

      // 3. 16-frond 3D V-fold pinnate crown merged into 1 single draw call
      const crownWorldOffset = new THREE.Vector3(0, (topY + 0.14) * palmScale, topZ * palmScale);
      crownWorldOffset.applyAxisAngle(upVec, palm.rotY);

      const crownGeo = sharedPalmCrownFrondsGeo.clone();
      tmpPos.set(palm.x + crownWorldOffset.x, crownWorldOffset.y, palm.z + crownWorldOffset.z);
      tmpQuat.setFromAxisAngle(upVec, palm.rotY);
      tmpScale.setScalar(palmScale);
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      crownGeo.applyMatrix4(tmpMat);
      batchedPalmCrownWorldGeos.push(crownGeo);
    }

    if (batchedPalmCrownWorldGeos.length > 0) {
      const mergedPalmsGeo = mergeGeometries(batchedPalmCrownWorldGeos, false);
      batchedPalmCrownWorldGeos.forEach((g) => g.dispose());
      sharedPalmCrownFrondsGeo.dispose();
      mergedPalmsGeo.computeBoundingBox();
      mergedPalmsGeo.computeBoundingSphere();
      disposableGeometries.push(mergedPalmsGeo);

      const mergedPalmFrondsMesh = new THREE.Mesh(mergedPalmsGeo, palmFrondShaderMat);
      mergedPalmFrondsMesh.name = 'TamanRiaKaiCoconutPalmFrondsBatch';
      mergedPalmFrondsMesh.castShadow = !isSoftwareGl;
      mergedPalmFrondsMesh.receiveShadow = !isSoftwareGl;
      mergedPalmFrondsMesh.customDepthMaterial = palmFrondDepthMat;
      mergedPalmFrondsMesh.frustumCulled = true;
      rootGroup.add(mergedPalmFrondsMesh);
    } else {
      sharedPalmCrownFrondsGeo.dispose();
    }

    // Two Staved Nautical Wooden Barrels with Iron Hoops on the Boardwalk
    for (const [bx, bz] of [
      [mp.mainBoardwalk.minX + 1.2, -71.8],
      [mp.mainBoardwalk.minX + 2.1, -72.4],
    ]) {
      const bGrp = new THREE.Group();
      bGrp.position.set(bx, deckY, bz);
      staticParkGroup.add(bGrp);

      const barrelGeo = new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.0, 0.0),
          new THREE.Vector2(0.31, 0.0),
          new THREE.Vector2(0.38, 0.28),
          new THREE.Vector2(0.39, 0.58),
          new THREE.Vector2(0.31, 0.86),
          new THREE.Vector2(0.0, 0.86),
        ],
        14,
      );
      const barrelUv = barrelGeo.attributes.uv;
      if (barrelUv) {
        for (let vi = 0; vi < barrelUv.count; vi++) {
          const u = barrelUv.getX(vi);
          const v = barrelUv.getY(vi);
          barrelUv.setXY(vi, v, u * 2.0);
        }
        barrelUv.needsUpdate = true;
      }
      const bBody = makePart(barrelGeo, '#dfc0a0', {
        pbrWood: { textures: hullWoodPbrSet, colorHex: '#dfc0a0', roughness: 0.94 },
        strokeWidth: 0,
      });
      bGrp.add(bBody);

      for (const hy of [0.16, 0.7]) {
        const hoop = makePart(new THREE.CylinderGeometry(0.37, 0.37, 0.065, 14), '#334155', {
          strokeWidth: 0.01,
        });
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

    const legTopZ = bw.rimSeparationZ * 0.5 + 0.56;
    const legVec = new THREE.Vector3();
    const bianglalaBoltMatrices: THREE.Matrix4[] = [];

    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        const fx = sx * bw.footingHalfSpanX;
        const fz = sz * bw.footingHalfSpanZ;

        const padLow = makePart(new THREE.BoxGeometry(2.1, 0.36, 2.1), '#94a3b8', {
          strokeWidth: 0.022,
        });
        padLow.position.set(fx, 0.18, fz);
        baseGrp.add(padLow);

        const padCap = makePart(new THREE.BoxGeometry(1.55, 0.36, 1.55), '#cbd5e1', {
          strokeWidth: 0.018,
        });
        padCap.position.set(fx, 0.54, fz);
        baseGrp.add(padCap);

        for (const bx of [-0.46, 0.46]) {
          for (const bz of [-0.46, 0.46]) {
            bianglalaBoltMatrices.push(
              new THREE.Matrix4().makeTranslation(bw.x + fx + bx, bw.deckY + 0.75, bw.z + fz + bz),
            );
          }
        }

        const pStart = new THREE.Vector3(fx, 0.68, fz);
        const pEnd = new THREE.Vector3(0, bw.axleHeightAboveDeck, sz * legTopZ);
        legVec.subVectors(pEnd, pStart);
        const legMesh = makePart(
          new THREE.CylinderGeometry(0.24, 0.36, legVec.length(), 12),
          '#e2e8f0',
          { strokeWidth: 0.022 },
        );
        legMesh.position.copy(pStart).add(pEnd).multiplyScalar(0.5);
        legMesh.quaternion.setFromUnitVectors(upVec, legVec.clone().normalize());
        baseGrp.add(legMesh);
      }
    }

    const instWheelBolts = makeInstancedBatch(
      new THREE.CylinderGeometry(0.06, 0.06, 0.1, 6),
      '#334155',
      bianglalaBoltMatrices,
    );
    if (instWheelBolts) instancedBatchGroup.add(instWheelBolts);

    // Horizontal & Diagonal K-Bracing Crossbeams on Front & Rear A-Frame Towers (Sheet 2 Side Elevation!)
    for (const sz of [-1, 1] as const) {
      const fracs = [0.32, 0.64];
      for (let f = 0; f < fracs.length; f++) {
        const frac = fracs[f];
        const tieY = 0.68 + (bw.axleHeightAboveDeck - 0.68) * frac;
        const tieHalfX = bw.footingHalfSpanX * (1 - frac);
        const tieZ = sz * (bw.footingHalfSpanZ * (1 - frac) + legTopZ * frac);
        const tieBeam = makePart(new THREE.BoxGeometry(tieHalfX * 2, 0.24, 0.24), '#94a3b8', {
          strokeWidth: 0.018,
        });
        tieBeam.position.set(0, tieY, tieZ);
        baseGrp.add(tieBeam);

        // Diagonal K-brace struts in lower bay
        if (f === 0) {
          for (const sxSide of [-1, 1] as const) {
            const kStart = new THREE.Vector3(sxSide * bw.footingHalfSpanX * 0.88, 1.2, sz * bw.footingHalfSpanZ * 0.88);
            const kEnd = new THREE.Vector3(0, tieY, tieZ);
            legVec.subVectors(kEnd, kStart);
            const kBrace = makePart(
              new THREE.CylinderGeometry(0.085, 0.085, legVec.length(), 6),
              '#cbd5e1',
              { strokeWidth: 0.01 },
            );
            kBrace.position.copy(kStart).add(kEnd).multiplyScalar(0.5);
            kBrace.quaternion.setFromUnitVectors(upVec, legVec.clone().normalize());
            baseGrp.add(kBrace);
          }
        }
      }
    }

    // Timber Boarding Stage + Access Steps + Metal Queue Railings beneath Lower Wheel Arc (Sheet 2!)
    const stage = makePart(
      applyBoxMetricUvs(new THREE.BoxGeometry(7.8, 0.56, 4.6), 3.6, 4.0),
      '#ffffff',
      { map: plankTex, strokeWidth: 0.02 },
    );
    stage.position.set(0, 0.28, 0);
    baseGrp.add(stage);

    for (let s = 0; s < 3; s++) {
      const st = makePart(
        applyBoxMetricUvs(new THREE.BoxGeometry(0.45, 0.16 * (3 - s), 2.4), 3.6, 4.0),
        '#ffffff',
        { map: plankTex, strokeWidth: 0.014 },
      );
      st.position.set(-4.12 - s * 0.44, 0.08 * (3 - s), 0);
      baseGrp.add(st);
    }

    // Angled steel boarding staircase handrails & newel posts flanking the West steps (Sheet 2 Front Elevation!)
    for (const hSideZ of [-1.16, 1.16] as const) {
      const hStart = new THREE.Vector3(-3.92, 1.18, hSideZ);
      const hEnd = new THREE.Vector3(-5.18, 0.72, hSideZ);
      legVec.subVectors(hEnd, hStart);
      const sRail = makePart(
        new THREE.CylinderGeometry(0.036, 0.036, legVec.length(), 8),
        '#cbd5e1',
        { strokeWidth: 0.008 },
      );
      sRail.position.copy(hStart).add(hEnd).multiplyScalar(0.5);
      sRail.quaternion.setFromUnitVectors(upVec, legVec.clone().normalize());
      baseGrp.add(sRail);

      for (const [px, py] of [
        [-3.92, 0.85],
        [-5.18, 0.38],
      ]) {
        const postH = py + 0.34;
        const nPost = makePart(new THREE.CylinderGeometry(0.038, 0.042, postH, 8), '#475569', {
          strokeWidth: 0.008,
        });
        nPost.position.set(px, postH * 0.5, hSideZ);
        baseGrp.add(nPost);
      }
    }

    // Operator Control Console Desk tucked outside wheel sweep (Sheet 2 Top Plan View!)
    {
      const opGrp = new THREE.Group();
      opGrp.position.set(2.45, 0.0, -2.72);
      baseGrp.add(opGrp);

      const opDeck = makePart(
        applyMetricPlanarUvs(makeRoundedParkBoxGeo(1.45, 0.24, 1.05, 0.03, 2), 3.0, 3.0),
        '#ffffff',
        { map: plankTex, strokeWidth: 0.012 },
      );
      opDeck.position.y = 0.12;
      opGrp.add(opDeck);

      const deskBody = makePart(
        applyAtlasCellUvs(new THREE.BoxGeometry(0.92, 0.96, 0.62), '#b45309'),
        '#ffffff',
        { map: carnivalSurfaceAtlasTex, strokeWidth: 0.014 },
      );
      deskBody.position.set(0, 0.72, 0);
      opGrp.add(deskBody);

      const deskConsole = makePart(makeRoundedParkBoxGeo(0.98, 0.12, 0.68, 0.024, 2), '#cbd5e1', {
        strokeWidth: 0.01,
      });
      deskConsole.position.set(0, 1.22, 0);
      deskConsole.rotation.x = 0.16;
      opGrp.add(deskConsole);

      for (const [lx, col] of [
        [-0.26, '#ef4444'],
        [0.0, '#eab308'],
        [0.24, '#22c55e'],
      ] as const) {
        const knob = makePart(new THREE.SphereGeometry(0.055, 8, 8), col, { strokeWidth: 0.006 });
        knob.position.set(lx, 1.32, 0.08);
        opGrp.add(knob);
      }
    }

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

    const spokeGeo = new THREE.CylinderGeometry(0.072, 0.072, bw.wheelRadius, 8);
    const crossbarGeo = new THREE.CylinderGeometry(0.085, 0.085, bw.rimSeparationZ, 8);
    crossbarGeo.rotateX(Math.PI / 2);
    const innerCrossbarGeo = new THREE.CylinderGeometry(0.055, 0.055, bw.rimSeparationZ, 6);
    innerCrossbarGeo.rotateX(Math.PI / 2);
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
          const diag = makePart(
            new THREE.CylinderGeometry(0.045, 0.045, trussVec.length(), 6),
            '#cbd5e1',
            { strokeWidth: 0.008, castShadow: false },
          );
          diag.position.copy(p0).add(p1).multiplyScalar(0.5);
          diag.quaternion.setFromUnitVectors(upVec, trussVec.clone().normalize());
          wheelFrameStatic.add(diag);
        }
      }

      const gx = cosA * bw.wheelRadius;
      const gy = sinA * bw.wheelRadius;
      const cbar = makePart(crossbarGeo, '#94a3b8', { strokeWidth: 0.014 });
      cbar.position.set(gx, gy, 0);
      wheelFrameStatic.add(cbar);

      const innerCbar = makePart(innerCrossbarGeo, '#94a3b8', { strokeWidth: 0.01, castShadow: false });
      innerCbar.position.set(cosA * innerChordR, sinA * innerChordR, 0);
      wheelFrameStatic.add(innerCbar);

      const gondolaPivot = new THREE.Group();
      gondolaPivot.position.set(gx, gy, 0);
      bianglalaWheelPivot.add(gondolaPivot);

      const gColor = BIANGLALA_GONDOLA_PALETTE[i % BIANGLALA_GONDOLA_PALETTE.length];
      for (const hz of [-0.68, 0.68]) {
        const hangerCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0.0, hz),
          new THREE.Vector3(0, -0.42, hz),
          new THREE.Vector3(0, -0.78, hz * 0.84),
        ]);
        const hanger = makePart(new THREE.TubeGeometry(hangerCurve, 10, 0.042, 8, false), '#475569', {
          strokeWidth: 0.01,
        });
        gondolaPivot.add(hanger);

        const pivotCollar = makePart(
          new THREE.CylinderGeometry(0.072, 0.072, 0.10, 10).rotateX(Math.PI / 2),
          '#cbd5e1',
          { strokeWidth: 0.008 },
        );
        pivotCollar.position.set(0, 0, hz);
        gondolaPivot.add(pivotCollar);

        const roofSocket = makePart(
          new THREE.CylinderGeometry(0.068, 0.092, 0.09, 10),
          '#475569',
          { strokeWidth: 0.008 },
        );
        roofSocket.position.set(0, -0.73, hz * 0.84);
        gondolaPivot.add(roofSocket);
      }

      const gDome = makePart(
        new THREE.SphereGeometry(0.86, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.46),
        gColor,
        { strokeWidth: 0.018 },
      );
      gDome.scale.set(1.04, 0.56, 0.88);
      gDome.position.set(0, -0.92, 0);
      gondolaPivot.add(gDome);

      const gEave = makePart(new THREE.CylinderGeometry(0.9, 0.9, 0.11, 16), '#fffbeb', {
        strokeWidth: 0.012,
      });
      gEave.scale.set(1.04, 1.0, 0.88);
      gEave.position.set(0, -0.92, 0);
      gondolaPivot.add(gEave);

      const gPostGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.58, 6);
      for (let m = 0; m < 6; m++) {
        const ma = (m / 6) * Math.PI * 2 + 0.5;
        const gp = makePart(gPostGeo, '#f8fafc', { strokeWidth: 0.008 });
        gp.position.set(Math.cos(ma) * 0.78, -1.21, Math.sin(ma) * 0.66);
        gondolaPivot.add(gp);
      }

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

      bakeStaticGroupMeshes(gondolaPivot);
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

    // Symmetrical Dual Timber Docking Platforms (+2.02m) + Balustrades + Inner Safety Screens + Stairs (Sheet 4!)
    const koraScreenGlassMat = new THREE.MeshStandardMaterial({
      color: '#bae6fd',
      transparent: true,
      opacity: 0.34,
      roughness: 0.12,
      metalness: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    disposableMaterials.push(koraScreenGlassMat);
    const screenParts: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1] as const) {
      const pGeo = new THREE.PlaneGeometry(7.7, 0.92);
      pGeo.rotateY(Math.PI / 2);
      pGeo.translate(sx * 2.22, kk.stageHeightAboveDeck + 0.52, 0);
      screenParts.push(pGeo);
    }
    const mergedScreenGlassGeo = mergeGeometries(screenParts, false);
    screenParts.forEach((g) => g.dispose());
    disposableGeometries.push(mergedScreenGlassGeo);
    kBase.add(new THREE.Mesh(mergedScreenGlassGeo, koraScreenGlassMat));

    for (const sideX of [-1, 1] as const) {
      const flankGeo = applyBoxMetricUvs(
        new THREE.BoxGeometry(2.0, kk.stageHeightAboveDeck, 8.2),
        3.6,
        4.0,
      );
      const flankDeck = makePart(flankGeo, '#ffffff', {
        map: plankTex,
        strokeWidth: 0,
      });
      flankDeck.position.set(sideX * 3.18, kk.stageHeightAboveDeck * 0.5, 0);
      kBase.add(flankDeck);

      // Inner framed clear safety barrier screens flanking the boat pit (Sheet 4 3/4 Isometric!)
      const screenFrameBar = makePart(new THREE.BoxGeometry(0.08, 0.08, 7.95), '#334155', {
        strokeWidth: 0.01,
      });
      screenFrameBar.position.set(sideX * 2.22, kk.stageHeightAboveDeck + 1.0, 0);
      kBase.add(screenFrameBar);
      for (const spz of [-3.9, -1.95, 0, 1.95, 3.9]) {
        const spPost = makePart(new THREE.BoxGeometry(0.09, 1.02, 0.09), '#334155', {
          strokeWidth: 0.01,
        });
        spPost.position.set(sideX * 2.22, kk.stageHeightAboveDeck + 0.51, spz);
        kBase.add(spPost);
      }

      for (const rzSeg of [
        [-4.0, -2.2],
        [2.2, 4.0],
      ] as const) {
        const segL = rzSeg[1] - rzSeg[0];
        const topR = makePart(
          applyBoxMetricUvs(new THREE.BoxGeometry(0.13, 0.09, segL), 1.8, 1.8),
          '#f5e2cc',
          {
            pbrWood: { textures: coastalOakPbrSet, colorHex: '#f5e2cc', roughness: 0.94 },
            strokeWidth: 0,
          },
        );
        topR.position.set(sideX * 4.1, kk.stageHeightAboveDeck + 0.92, (rzSeg[0] + rzSeg[1]) * 0.5);
        kBase.add(topR);
      }

      for (const rz of [-3.92, -2.2, 2.2, 3.92]) {
        const rp = makePart(
          applyBoxMetricUvs(new THREE.BoxGeometry(0.14, 0.95, 0.14), 1.8, 1.8),
          '#cfa984',
          {
            pbrWood: { textures: coastalOakPbrSet, colorHex: '#cfa984', roughness: 0.94 },
            strokeWidth: 0,
          },
        );
        rp.position.set(sideX * 4.1, kk.stageHeightAboveDeck + 0.47, rz);
        kBase.add(rp);
      }

      // Dual Symmetrical Entry/Exit Boarding Stairs (West & East flanks -> +1.10m to +2.02m!)
      for (let s = 0; s < 5; s++) {
        const sh = ((s + 1) / 5) * kk.stageHeightAboveDeck;
        const st = makePart(
          applyBoxMetricUvs(new THREE.BoxGeometry(0.38, sh, 4.3), 3.6, 4.0),
          '#ffffff',
          { map: plankTex, strokeWidth: 0 },
        );
        st.position.set(sideX * (5.76 - s * 0.35), sh * 0.5, 0);
        kBase.add(st);
      }
    }

    // Under-Hull Dual Pneumatic Friction-Drive & Emergency Brake Bogie (Sheet 4!)
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

    // 4-Leg Heavy Steel A-Frame Support Tower + Lattice Cross-Braces + Gold Bearing Medallions (Sheet 4!)
    const topHalfX = 2.55;
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
        leg.quaternion.setFromUnitVectors(upVec, legDir.clone().normalize());
        kBase.add(leg);
      }

      // Lattice cross-struts between front and rear A-frame legs on each side (Sheet 4 Side View!)
      for (const frac of [0.28, 0.56, 0.8]) {
        const ly = 0.36 + (kk.pivotHeightAboveDeck - 0.36) * frac;
        const lx = sx * (kk.towerBaseHalfX * (1 - frac) + topHalfX * frac);
        const lSpanZ = kk.towerBaseHalfZ * (1 - frac) * 2;
        const brace = makePart(new THREE.BoxGeometry(0.18, 0.18, lSpanZ), '#94a3b8', {
          strokeWidth: 0.014,
        });
        brace.position.set(lx, ly, 0);
        kBase.add(brace);
      }

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
    for (const sx of [-1.72, 1.72]) {
      for (const sz of [-3.55, 3.55]) {
        const sTop = new THREE.Vector3(sx * 1.26, 0, 0);
        const sBot = new THREE.Vector3(sx, shipCenterY + 0.95, sz);
        strutVec.subVectors(sBot, sTop);
        const strut = makePart(
          new THREE.CylinderGeometry(0.12, 0.14, strutVec.length(), 8),
          '#e2e8f0',
          { strokeWidth: 0.018 },
        );
        strut.position.copy(sTop).add(sBot).multiplyScalar(0.5);
        strut.quaternion.setFromUnitVectors(upVec, strutVec.clone().normalize());
        koraSwingPivot.add(strut);
      }
    }

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

    const hullGeo = createLoftedGalleonHullGeometry(kk.hullLength, kk.hullWidth);
    const hullMesh = makePart(hullGeo, '#ffffff', {
      map: hullWoodTex,
      strokeWidth: 0,
    });
    hullMesh.position.set(0, shipCenterY + 0.65, 0);
    koraSwingPivot.add(hullMesh);

    // Sweeping Gold Gunwale Trim Tubes, Structural Hull Ribs & Brass Cannon-Port Medallions
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

          // Curved external timber hull rib frame
          const ribH = Math.max(0.75, y - (shipCenterY - 0.35));
          const hullRib = makePart(
            applyBoxMetricUvs(new THREE.BoxGeometry(0.1, ribH, 0.14), 1.6, 1.6),
            '#b8926e',
            {
              pbrWood: { textures: hullWoodPbrSet, colorHex: '#b8926e', roughness: 0.94 },
              strokeWidth: 0,
            },
          );
          hullRib.position.set(x * 0.88, y - ribH * 0.52, z);
          hullRib.rotation.z = sideSign * -0.22;
          koraSwingPivot.add(hullRib);
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

    for (let b = -3; b <= 3; b++) {
      const zn = b / 4.6;
      const z = zn * halfLen;
      const benchW = kk.hullWidth * (1.0 - Math.abs(zn) * 0.46) * 0.72;
      const by = shipCenterY + 0.55 + Math.pow(Math.abs(zn), 2.0) * 1.45;
      const bench = makePart(
        applyBoxMetricUvs(new THREE.BoxGeometry(benchW, 0.34, 0.46), 1.8, 1.8),
        '#f5e2cc',
        {
          pbrWood: { textures: hullWoodPbrSet, colorHex: '#f5e2cc', roughness: 0.95 },
          strokeWidth: 0,
        },
      );
      bench.position.set(0, by, z);
      koraSwingPivot.add(bench);

      const lapBar = makePart(
        new THREE.CylinderGeometry(0.035, 0.035, benchW * 0.92, 6).rotateZ(Math.PI / 2),
        '#cbd5e1',
        { strokeWidth: 0.008 },
      );
      lapBar.position.set(0, by + 0.28, z - 0.18);
      koraSwingPivot.add(lapBar);
    }

    // Carved Sea-Dragon Bow Figurehead (arched spine ridges, sculpted head, jaws, fangs & barbels)
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

    // Dorsal carved dragon scale spines along the curved neck
    for (let ds = 0; ds < 5; ds++) {
      const tSpine = (ds + 0.6) / 5.4;
      const pt = dragonCurve.getPoint(tSpine);
      const tang = dragonCurve.getTangent(tSpine);
      const fin = makePart(new THREE.ConeGeometry(0.11, 0.36, 4), '#fbbf24', {
        strokeWidth: 0.01,
      });
      fin.position.set(0, pt.y + 0.24, pt.z + 0.14);
      fin.rotation.x = Math.atan2(tang.z, tang.y) + 0.65;
      koraSwingPivot.add(fin);
    }

    const dragonBrow = makePart(new THREE.SphereGeometry(0.32, 10, 8), '#d97706', {
      strokeWidth: 0.016,
    });
    dragonBrow.scale.set(0.92, 0.84, 1.32);
    dragonBrow.position.set(0, shipCenterY + 3.98, -halfLen - 1.08);
    koraSwingPivot.add(dragonBrow);

    const dragonSnout = makePart(
      new THREE.ConeGeometry(0.3, 0.88, 8).rotateX(-Math.PI / 2 - 0.12),
      '#eab308',
      { strokeWidth: 0.018 },
    );
    dragonSnout.position.set(0, shipCenterY + 3.95, -halfLen - 1.42);
    koraSwingPivot.add(dragonSnout);

    const dragonJaw = makePart(
      new THREE.ConeGeometry(0.22, 0.7, 8).rotateX(-Math.PI / 2 + 0.32),
      '#b45309',
      { strokeWidth: 0.014 },
    );
    dragonJaw.position.set(0, shipCenterY + 3.64, -halfLen - 1.32);
    koraSwingPivot.add(dragonJaw);

    for (const hx of [-0.22, 0.22]) {
      const horn = makePart(new THREE.ConeGeometry(0.09, 0.72, 6), '#fef08a', {
        strokeWidth: 0.012,
      });
      horn.position.set(hx, shipCenterY + 4.3, -halfLen - 0.78);
      horn.rotation.x = 0.55;
      horn.rotation.z = -hx * 0.8;
      koraSwingPivot.add(horn);

      const eye = makePart(new THREE.SphereGeometry(0.075, 8, 8), '#fde047', { strokeWidth: 0 });
      eye.position.set(hx * 0.96, shipCenterY + 4.02, -halfLen - 1.15);
      koraSwingPivot.add(eye);

      // Ivory dragon fangs & swept side whiskers
      const fang = makePart(new THREE.ConeGeometry(0.038, 0.18, 5), '#fffbeb', {
        strokeWidth: 0.006,
      });
      fang.rotation.x = Math.PI;
      fang.position.set(hx * 0.62, shipCenterY + 3.8, -halfLen - 1.56);
      koraSwingPivot.add(fang);

      const barbelCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(hx * 0.9, shipCenterY + 3.84, -halfLen - 1.52),
        new THREE.Vector3(hx * 1.9, shipCenterY + 3.92, -halfLen - 1.24),
        new THREE.Vector3(hx * 2.15, shipCenterY + 3.74, -halfLen - 0.86),
      ]);
      const barbel = makePart(new THREE.TubeGeometry(barbelCurve, 6, 0.032, 6, false), '#fbbf24', {
        strokeWidth: 0.008,
      });
      koraSwingPivot.add(barbel);
    }

    // Ornate Captain's Stern Poop Castle with Recessed Mullioned Windows & Crenellated Gallery
    const sternGrp = new THREE.Group();
    sternGrp.position.set(0, shipCenterY + 2.88, halfLen - 0.95);
    sternGrp.rotation.x = -0.22;
    koraSwingPivot.add(sternGrp);

    const sternCabin = makePart(
      applyBoxMetricUvs(new THREE.BoxGeometry(2.25, 1.42, 2.05), 1.8, 1.4),
      '#ffffff',
      { map: hullWoodTex, strokeWidth: 0 },
    );
    sternGrp.add(sternCabin);

    const sternRoof = makePart(new THREE.BoxGeometry(2.52, 0.22, 2.3), '#eab308', {
      strokeWidth: 0.018,
    });
    sternRoof.position.set(0, 0.76, 0);
    sternGrp.add(sternRoof);

    // Carved roof gallery crenellation posts around top deck of stern castle
    for (const cx of [-1.14, -0.57, 0, 0.57, 1.14]) {
      for (const cz of [-1.02, 1.02]) {
        const crenel = makePart(
          applyBoxMetricUvs(new THREE.BoxGeometry(0.22, 0.24, 0.14), 1.4, 1.4),
          '#cfa984',
          {
            pbrWood: { textures: hullWoodPbrSet, colorHex: '#cfa984', roughness: 0.95 },
            strokeWidth: 0,
          },
        );
        crenel.position.set(cx, 0.98, cz);
        sternGrp.add(crenel);
      }
    }

    // Recessed mullioned window frames on Port & Starboard cabin walls
    for (const wxSide of [-1, 1] as const) {
      const recessFrame = makePart(
        applyBoxMetricUvs(new THREE.BoxGeometry(0.12, 0.54, 1.46), 1.6, 1.6),
        '#b8926e',
        {
          pbrWood: { textures: hullWoodPbrSet, colorHex: '#b8926e', roughness: 0.94 },
          strokeWidth: 0,
        },
      );
      recessFrame.position.set(wxSide * 1.12, 0.14, 0);
      sternGrp.add(recessFrame);

      for (const wz of [-0.44, 0, 0.44]) {
        const pane = makePart(new THREE.BoxGeometry(0.08, 0.4, 0.32), '#fef08a', {
          strokeWidth: 0.008,
        });
        pane.position.set(wxSide * 1.15, 0.14, wz);
        sternGrp.add(pane);
      }
      const horizMullion = makePart(new THREE.BoxGeometry(0.11, 0.045, 1.38), '#d97706', {
        strokeWidth: 0.008,
      });
      horizMullion.position.set(wxSide * 1.17, 0.14, 0);
      sternGrp.add(horizMullion);
    }

    // Rear Stern Transom arched cabin gallery window
    const rearFrame = makePart(
      applyBoxMetricUvs(new THREE.BoxGeometry(1.56, 0.56, 0.12), 1.6, 1.6),
      '#b8926e',
      {
        pbrWood: { textures: hullWoodPbrSet, colorHex: '#b8926e', roughness: 0.94 },
        strokeWidth: 0,
      },
    );
    rearFrame.position.set(0, 0.14, 1.02);
    sternGrp.add(rearFrame);
    for (const rx of [-0.46, 0, 0.46]) {
      const rPane = makePart(new THREE.BoxGeometry(0.34, 0.42, 0.08), '#fef08a', {
        strokeWidth: 0.008,
      });
      rPane.position.set(rx, 0.14, 1.05);
      sternGrp.add(rPane);
    }
    const rearMullion = makePart(new THREE.BoxGeometry(1.48, 0.045, 0.11), '#eab308', {
      strokeWidth: 0.008,
    });
    rearMullion.position.set(0, 0.14, 1.07);
    sternGrp.add(rearMullion);

    const sternLantern = makePart(new THREE.SphereGeometry(0.24, 10, 10), '#fde047', {
      strokeWidth: 0.014,
    });
    sternLantern.position.set(0, 1.18, 0.88);
    sternGrp.add(sternLantern);

    bakeStaticGroupMeshes(koraSwingPivot, { minShadowCasterSpan: 0.7 });
  }

  // =========================================================================
  // 5. HERO RIDE #3 — KOMIDI PUTAR // VINTAGE CAROUSEL
  // =========================================================================
  const komidiRotatingPivot = new THREE.Group();
  const komidiHorseNodes: { group: THREE.Group; baseY: number }[] = [];
  {
    const kp = mp.rides.komidiPutar;
    const kpStatic = new THREE.Group();
    kpStatic.position.set(kp.x, kp.baseY, kp.z);
    staticParkGroup.add(kpStatic);

    for (const [rad, topH, col] of [
      [5.35, 0.22, '#b98952'],
      [5.05, 0.44, '#cfa065'],
      [4.75, 0.66, '#e2b77b'],
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

    const podium = makePart(
      applyBoxMetricUvs(new THREE.BoxGeometry(1.08, 1.26, 0.98), 2.0, 2.0),
      '#dfc0a0',
      {
        pbrWood: { textures: hullWoodPbrSet, colorHex: '#dfc0a0', roughness: 0.95, bumpScale: 0.038 },
        strokeWidth: 0,
      },
    );
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

    komidiRotatingPivot.name = 'KomidiPutarRotatingAssembly';
    komidiRotatingPivot.position.set(kp.x, kp.baseY + 0.66, kp.z);
    rootGroup.add(komidiRotatingPivot);

    const kpFrameGroup = new THREE.Group();
    komidiRotatingPivot.add(kpFrameGroup);

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

    // 3D scalloped lower trim skirt along the Komidi Putar cornice rim
    const kpScallopGeo = createScallopedCorniceSkirtGeometry(kp.canopyRadius - 0.05, 16, 0.14, 0.24);
    const kpScallop = makePart(kpScallopGeo, '#f59e0b', { strokeWidth: 0.012 });
    kpScallop.position.y = 3.96;
    kpFrameGroup.add(kpScallop);

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

    // Turned Central Canopy Hub Ring + 16 Non-Overlapping Radial Cylindrical Spokes
    const ceilingHubGeo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0, -0.05),
        new THREE.Vector2(0.56, -0.05),
        new THREE.Vector2(0.58, 0.02),
        new THREE.Vector2(0.46, 0.06),
        new THREE.Vector2(0.0, 0.06),
      ],
      20,
    );
    const ceilingHub = makePart(ceilingHubGeo, '#eab308', { strokeWidth: 0.01 });
    ceilingHub.position.y = 3.94;
    kpFrameGroup.add(ceilingHub);

    const spokeLen = kp.canopyRadius - 0.72;
    const radialSpokeGeo = new THREE.CylinderGeometry(0.042, 0.042, spokeLen, 8);
    radialSpokeGeo.rotateX(Math.PI / 2);
    for (let r = 0; r < 16; r++) {
      const ra = (r / 16) * Math.PI * 2;
      const spokeRib = makePart(radialSpokeGeo, '#eab308', { strokeWidth: 0.008 });
      const midR = 0.48 + spokeLen * 0.5;
      spokeRib.position.set(Math.sin(ra) * midR, 3.94, Math.cos(ra) * midR);
      spokeRib.rotation.y = ra;
      kpFrameGroup.add(spokeRib);
    }

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
      const goreHex = g % 2 === 0 ? '#fffbeb' : '#f3c14b';
      const goreMesh = makePart(applyAtlasCellUvs(goreGeo, goreHex), '#ffffff', {
        map: carnivalSurfaceAtlasTex,
        strokeWidth: 0,
      });
      goreMesh.position.y = 5.08;
      kpFrameGroup.add(goreMesh);

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
    kpBulbInst.computeBoundingBox();
    kpBulbInst.computeBoundingSphere();
    kpBulbInst.frustumCulled = true;
    komidiRotatingPivot.add(kpBulbInst);

    const poleGeo = applyCylinderMetricUvs(
      new THREE.CylinderGeometry(0.052, 0.052, 4.02, 10),
      1,
      2,
    );
    const horseCoats = ['#fffbeb', '#f8fafc', '#fed7aa', '#fef3c7', '#f1f5f9'];
    const saddleColors = ['#ef4444', '#0ea5e9', '#a855f7', '#10b981', '#ec4899'];
    let horseIdx = 0;

    for (let slot = 0; slot < 12; slot++) {
      const ang = (slot / 12) * Math.PI * 2;
      const ringR = slot % 2 === 0 ? 3.65 : 2.8;
      const sx = Math.cos(ang) * ringR;
      const sz = Math.sin(ang) * ringR;
      const tangentYaw = -ang;

      const pole = makePart(poleGeo, '#ffffff', {
        map: spiralBrassPoleTex,
        strokeWidth: 0.012,
      });
      pole.position.set(sx, 2.01, sz);
      kpFrameGroup.add(pole);

      if (slot === 3 || slot === 9) {
        const chariot = new THREE.Group();
        chariot.position.set(sx, 0.04, sz);
        chariot.rotation.y = tangentYaw;

        const cShell = makePart(new THREE.CylinderGeometry(0.68, 0.58, 1.18, 14), '#ffffff', {
          map: baroqueCorniceTex,
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

        const cSeat = makePart(
          applyMetricPlanarUvs(makeRoundedParkBoxGeo(0.92, 0.28, 0.68, 0.045, 2), 1.0, 1.0),
          '#ffffff',
          {
            map: quiltedChariotSeatTex,
            strokeWidth: 0.014,
          },
        );
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

        // Dual-layer draped saddle cloth + sculpted quilted cushion + bridle trim (vertex-baked)
        const saddleCloth = makePart(
          makeRoundedParkBoxGeo(0.64, 0.34, 0.56, 0.055, 2),
          '#eab308',
          { strokeWidth: 0.01 },
        );
        saddleCloth.position.set(0, -0.02, -0.02);
        horseGrp.add(saddleCloth);

        const saddle = makePart(new THREE.CylinderGeometry(0.31, 0.31, 0.44, 12), saddleHex, {
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

        const maneShape = new THREE.Shape();
        maneShape.moveTo(0.0, -0.28);
        maneShape.lineTo(-0.08, -0.26);
        maneShape.quadraticCurveTo(-0.14, 0.02, -0.10, 0.28);
        maneShape.quadraticCurveTo(-0.02, 0.35, 0.06, 0.28);
        maneShape.quadraticCurveTo(0.02, 0.0, 0.0, -0.28);
        maneShape.closePath();
        const maneGeo = new THREE.ExtrudeGeometry(maneShape, {
          depth: 0.075,
          bevelEnabled: true,
          bevelSize: 0.012,
          bevelThickness: 0.012,
          bevelSegments: 2,
        });
        maneGeo.translate(0, 0, -0.0375);
        maneGeo.rotateY(Math.PI / 2);
        const mane = makePart(maneGeo, '#eab308', { strokeWidth: 0.012 });
        mane.position.set(0, 0.48, 0.33);
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

        bakeStaticGroupMeshes(horseGrp);
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
      [6.15, 0.24, '#e5d9c3'],
      [5.35, 0.48, '#efe5d4'],
      [4.55, 0.72, '#f8f1e5'],
    ] as const) {
      const s = makePart(new THREE.CylinderGeometry(rad, rad + 0.06, 0.24, 40), col, {
        strokeWidth: 0.02,
      });
      s.position.y = topH - 0.12;
      oaStatic.add(s);
    }

    // Protruding Turnstile Entry/Exit Stairs + Electric Drive Motor Control Box (Sheet 5 Top & Side Views!)
    const turnstilePorch = makePart(new THREE.BoxGeometry(2.3, 0.48, 2.8), '#efe5d4', {
      strokeWidth: 0.018,
    });
    turnstilePorch.position.set(oa.fenceRadius + 0.35, 0.24, 0);
    oaStatic.add(turnstilePorch);
    for (let st = 0; st < 2; st++) {
      const step = makePart(new THREE.BoxGeometry(0.45, 0.16 * (2 - st), 2.4), '#e5d9c3', {
        strokeWidth: 0.014,
      });
      step.position.set(oa.fenceRadius + 1.65 + st * 0.44, 0.08 * (2 - st), 0);
      oaStatic.add(step);
    }
    for (const tz of [-0.55, 0.55]) {
      const tPost = makePart(new THREE.CylinderGeometry(0.08, 0.1, 1.02, 10), '#475569', {
        strokeWidth: 0.012,
      });
      tPost.position.set(oa.fenceRadius + 0.35, 0.96, tz);
      oaStatic.add(tPost);

      const hubRing = makePart(new THREE.CylinderGeometry(0.115, 0.115, 0.10, 12), '#cbd5e1', {
        strokeWidth: 0.008,
      });
      hubRing.position.set(oa.fenceRadius + 0.35, 1.15, tz);
      oaStatic.add(hubRing);

      const tDir = tz > 0 ? -1 : 1;
      const rotorCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(oa.fenceRadius + 0.35, 1.15, tz),
        new THREE.Vector3(oa.fenceRadius + 0.35, 1.15, tz + tDir * 0.42),
        new THREE.Vector3(oa.fenceRadius + 0.08, 1.15, tz + tDir * 0.46),
      ]);
      const tRotor = makePart(new THREE.TubeGeometry(rotorCurve, 8, 0.028, 8, false), '#cbd5e1', {
        strokeWidth: 0.008,
      });
      oaStatic.add(tRotor);
    }
    const motorHousing = makePart(new THREE.BoxGeometry(0.92, 0.98, 0.72), '#334155', {
      strokeWidth: 0.016,
    });
    motorHousing.position.set(oa.fenceRadius - 1.1, 0.74, 2.25);
    oaStatic.add(motorHousing);

    // Ornate Wrought-Iron Safety Perimeter Fence (InstancedMesh posts, ball finials & pickets!)
    const fenceSegs = 24;
    const oaPostMatrices: THREE.Matrix4[] = [];
    const oaBallMatrices: THREE.Matrix4[] = [];
    const oaPicketMatrices: THREE.Matrix4[] = [];

    for (let i = 0; i < fenceSegs; i++) {
      if (i === 0) continue;
      const a0 = (i / fenceSegs) * Math.PI * 2;
      const a1 = ((i + 1) / fenceSegs) * Math.PI * 2;
      const fx = Math.cos(a0) * oa.fenceRadius;
      const fz = Math.sin(a0) * oa.fenceRadius;
      oaPostMatrices.push(new THREE.Matrix4().makeTranslation(oa.x + fx, oa.baseY + 0.54, oa.z + fz));
      oaBallMatrices.push(new THREE.Matrix4().makeTranslation(oa.x + fx, oa.baseY + 1.12, oa.z + fz));

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

        // Scrollwork ring ornament + central vertical tie picket welded cleanly to top & bottom rails
        const scrollRing = makePart(new THREE.TorusGeometry(0.22, 0.024, 6, 12), '#eab308', {
          strokeWidth: 0.006,
          castShadow: false,
        });
        scrollRing.rotation.y = Math.PI / 2;
        scrollRing.position.set(0, 0.56, 0);
        railGrp.add(scrollRing);
        const centerTiePicket = makePart(
          new THREE.CylinderGeometry(0.016, 0.016, 0.78, 6),
          '#334155',
          { strokeWidth: 0.006, castShadow: false },
        );
        centerTiePicket.position.set(0, 0.56, 0);
        railGrp.add(centerTiePicket);

        const sinY = Math.sin(yaw);
        const cosY = Math.cos(yaw);
        for (const pk of [-2, -1, 1, 2]) {
          const offset = pk * (segLen / 6);
          oaPicketMatrices.push(
            new THREE.Matrix4().makeTranslation(
              oa.x + (fx + nx) * 0.5 + sinY * offset,
              oa.baseY + 0.56,
              oa.z + (fz + nz) * 0.5 + cosY * offset,
            ),
          );
        }
      }
    }

    const instOaPosts = makeInstancedBatch(
      new THREE.CylinderGeometry(0.052, 0.062, 1.08, 8),
      '#1e293b',
      oaPostMatrices,
      { castShadow: true },
    );
    const instOaBalls = makeInstancedBatch(
      new THREE.SphereGeometry(0.075, 8, 8),
      '#eab308',
      oaBallMatrices,
    );
    const instOaPickets = makeInstancedBatch(
      new THREE.CylinderGeometry(0.018, 0.018, 0.82, 5),
      '#475569',
      oaPicketMatrices,
    );
    if (instOaPosts) instancedBatchGroup.add(instOaPosts);
    if (instOaBalls) instancedBatchGroup.add(instOaBalls);
    if (instOaPickets) instancedBatchGroup.add(instOaPickets);

    // 4-Tier Telescoping Octagonal Baroque Painted & Gilded Central Column + Vertical Corner Bulbs (Sheet 5!)
    const tiers: readonly [number, number, number, number][] = [
      [1.48, 1.62, 1.68, 1.56],
      [1.22, 1.38, 1.76, 3.28],
      [1.06, 1.16, 1.76, 5.04],
      [0.96, 1.04, 1.56, 6.7],
    ];
    for (const [rTop, rBot, h, cy] of tiers) {
      const colGeo = applyCylinderMetricUvs(new THREE.CylinderGeometry(rTop, rBot, h, 8), 2, 1);
      const colTier = makePart(colGeo, '#ffffff', {
        map: swingerColumnTex,
        strokeWidth: 0.022,
      });
      colTier.position.y = cy;
      oaStatic.add(colTier);

      for (let k = 0; k < 8; k++) {
        const ka = (k / 8) * Math.PI * 2 + Math.PI / 8;
        const rMid = (rTop + rBot) * 0.5;
        const pil = makePart(new THREE.CylinderGeometry(0.075, 0.088, h, 6), '#eab308', {
          strokeWidth: 0.01,
        });
        pil.position.set(Math.cos(ka) * rMid, cy, Math.sin(ka) * rMid);
        oaStatic.add(pil);

        // Vertical light bulbs running up octagonal column ribs (Sheet 5!)
        for (const byOff of [-0.52, 0.0, 0.52]) {
          festoonBulbPositions.push(
            new THREE.Vector3(
              oa.x + Math.cos(ka) * (rMid + 0.09),
              oa.baseY + cy + byOff,
              oa.z + Math.sin(ka) * (rMid + 0.09),
            ),
          );
        }
      }

      const collar = makePart(
        new THREE.CylinderGeometry(rBot + 0.14, rBot + 0.19, 0.22, 8),
        '#d97706',
        { strokeWidth: 0.016 },
      );
      collar.position.y = cy - h * 0.5 + 0.08;
      oaStatic.add(collar);
    }

    const knuckle = makePart(new THREE.SphereGeometry(0.92, 14, 12), '#d97706', {
      strokeWidth: 0.018,
    });
    knuckle.position.set(0, 7.52, 0);
    oaStatic.add(knuckle);

    // Articulated pleated dark-steel hydraulic tilt bellows at the knuckle joint (Sheet 5 Side Elevation!)
    for (let bIdx = 0; bIdx < 3; bIdx++) {
      const bootRing = makePart(
        new THREE.TorusGeometry(0.86 - bIdx * 0.05, 0.095, 8, 18).rotateX(Math.PI / 2),
        '#1e293b',
        { strokeWidth: 0.012 },
      );
      bootRing.position.set(0, 7.36 + bIdx * 0.14, 0);
      bootRing.rotation.z = oa.tiltAngleRad * (bIdx * 0.35);
      oaStatic.add(bootRing);
    }

    ontagTiltCarrier.name = 'OntagAntingTiltCarrier';
    ontagTiltCarrier.position.set(oa.x, oa.baseY + 7.58, oa.z);
    ontagTiltCarrier.rotation.z = oa.tiltAngleRad;
    ontagTiltCarrier.rotation.x = -0.08;
    rootGroup.add(ontagTiltCarrier);

    ontagTiltCarrier.add(ontagSpinCanopy);
    const oaCanopyStatic = new THREE.Group();
    ontagSpinCanopy.add(oaCanopyStatic);

    const oaCorniceGeo = applyCylinderMetricUvs(
      new THREE.CylinderGeometry(oa.canopyRadius, oa.canopyRadius - 0.24, 1.1, 32, 1, false),
      4,
      1,
    );
    const oaCornice = makePart(oaCorniceGeo, '#ffffff', {
      map: baroqueCorniceTex,
      strokeWidth: 0.022,
    });
    oaCornice.position.y = 0.66;
    oaCanopyStatic.add(oaCornice);

    // 3D scalloped lower cornice trim arches matching Sheet 5 Side & 3/4 views
    const oaScallopGeo = createScallopedCorniceSkirtGeometry(oa.canopyRadius - 0.22, 16, 0.14, 0.24);
    const oaScallop = makePart(oaScallopGeo, '#f59e0b', { strokeWidth: 0.012 });
    oaScallop.position.y = 0.08;
    oaCanopyStatic.add(oaScallop);

    // Warm marquee bulb ring along the rotating Ontang-Anting cornice (InstancedMesh!)
    const oaBulbGeo = new THREE.SphereGeometry(0.082, 6, 6);
    const oaBulbInst = new THREE.InstancedMesh(oaBulbGeo, warmAmberBulbMat, 32);
    disposableGeometries.push(oaBulbGeo);
    const oaBulbMat4 = new THREE.Matrix4();
    for (let b = 0; b < 32; b++) {
      const ba = (b / 32) * Math.PI * 2;
      oaBulbMat4.makeTranslation(
        Math.cos(ba) * (oa.canopyRadius - 0.16),
        0.12,
        Math.sin(ba) * (oa.canopyRadius - 0.16),
      );
      oaBulbInst.setMatrixAt(b, oaBulbMat4);
    }
    oaBulbInst.instanceMatrix.needsUpdate = true;
    oaBulbInst.computeBoundingBox();
    oaBulbInst.computeBoundingSphere();
    oaBulbInst.frustumCulled = true;
    ontagSpinCanopy.add(oaBulbInst);

    for (let c = 0; c < 16; c++) {
      const ca = ((c + 0.5) / 16) * Math.PI * 2;
      const crest = makePart(new THREE.SphereGeometry(0.3, 10, 8), '#fbbf24', {
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
      const oaGoreHex = g % 2 === 0 ? '#fff7ed' : '#ea580c';
      const goreMesh = makePart(applyAtlasCellUvs(goreGeo, oaGoreHex), '#ffffff', {
        map: carnivalSurfaceAtlasTex,
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

      // Radial hanger arm bracket baked directly into oaCanopyStatic
      const armBracket = makePart(new THREE.BoxGeometry(0.65, 0.09, 0.12), '#eab308', {
        strokeWidth: 0.008,
      });
      armBracket.position.set(
        Math.cos(ang) * (attachR - 0.22),
        0.2,
        Math.sin(ang) * (attachR - 0.22),
      );
      armBracket.rotation.y = -ang;
      oaCanopyStatic.add(armBracket);

      const swingArm = new THREE.Group();
      chairAnchor.add(swingArm);

      for (const cz of [-0.26, 0.26]) {
        const ch = makePart(chainGeo, '#cbd5e1', { strokeWidth: 0.005, castShadow: false });
        ch.position.set(0, -chainLen * 0.5, cz);
        swingArm.add(ch);
      }
      const spreader = makePart(
        new THREE.CylinderGeometry(0.028, 0.028, 0.58, 6).rotateX(Math.PI / 2),
        '#94a3b8',
        { strokeWidth: 0.008, castShadow: false },
      );
      spreader.position.set(0, -chainLen + 0.54, 0);
      swingArm.add(spreader);

      const seatColor = i % 2 === 0 ? '#dc2626' : '#0284c7';
      const seatPan = makePart(makeRoundedParkBoxGeo(0.54, 0.11, 0.58, 0.032, 2), seatColor, {
        strokeWidth: 0.014,
      });
      seatPan.position.set(0.02, -chainLen, 0);
      swingArm.add(seatPan);

      const seatBack = makePart(makeRoundedParkBoxGeo(0.11, 0.58, 0.58, 0.032, 2), seatColor, {
        strokeWidth: 0.014,
      });
      seatBack.position.set(-0.22, -chainLen + 0.27, 0);
      seatBack.rotation.z = 0.12;
      swingArm.add(seatBack);

      // Sculpted cream bolster headrest pad & stitched cushion piping (vertex-merged cleanly)
      const headBolster = makePart(
        new THREE.CylinderGeometry(0.08, 0.08, 0.44, 8).rotateX(Math.PI / 2),
        '#fffbeb',
        { strokeWidth: 0 },
      );
      headBolster.position.set(-0.21, -chainLen + 0.54, 0);
      swingArm.add(headBolster);

      for (const az of [-0.28, 0.28]) {
        const armCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.20, -chainLen + 0.24, az),
          new THREE.Vector3(0.02, -chainLen + 0.24, az),
          new THREE.Vector3(0.24, -chainLen + 0.24, az),
          new THREE.Vector3(0.24, -chainLen + 0.04, az),
        ]);
        const arm = makePart(new THREE.TubeGeometry(armCurve, 8, 0.024, 8, false), '#e2e8f0', {
          strokeWidth: 0.008,
        });
        swingArm.add(arm);
      }

      // Chrome safety lap bar across the front arms (shares #e2e8f0 bucket for zero extra draw calls!)
      const safetyBar = makePart(
        new THREE.CylinderGeometry(0.022, 0.022, 0.58, 6).rotateX(Math.PI / 2),
        '#e2e8f0',
        { strokeWidth: 0, castShadow: false },
      );
      safetyBar.position.set(0.24, -chainLen + 0.24, 0);
      swingArm.add(safetyBar);

      bakeStaticGroupMeshes(swingArm, { minShadowCasterSpan: 0.6 });
      ontagChairPivots.push(swingArm);
    }

    bakeStaticGroupMeshes(oaCanopyStatic, { minShadowCasterSpan: 0.7 });
  }

  // =========================================================================
  // 7. HERO RIDE #5 — BUMPER CAR ARENA ("BUMPER CAR // ARENA", 1:1 MODEL SHEET 6)
  // =========================================================================
  const bumperCarGroups: THREE.Group[] = [];
  const arenaFloorY = 0.48;
  {
    const bc = mp.rides.bumperCarArena;
    const bcStatic = new THREE.Group();
    bcStatic.position.set(bc.x, bc.baseY, bc.z);
    staticParkGroup.add(bcStatic);

    const w = bc.halfX * 2; // 18.0m wide
    const d = bc.halfZ * 2; // 12.4m deep

    // Stepped Concrete Foundation Plinth + South Entry Steps & Dual Turnstiles (Sheet 6!)
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

    // South Entry/Exit Staircase + Dual Chrome Turnstiles (Sheet 6 Top Plan View!)
    for (let s = 0; s < 3; s++) {
      const step = makePart(new THREE.BoxGeometry(3.2, 0.16 * (3 - s), 0.45), '#cbd5e1', {
        strokeWidth: 0.014,
      });
      step.position.set(0, 0.08 * (3 - s), bc.halfZ + 0.45 + s * 0.42);
      bcStatic.add(step);
    }
    for (const tx of [-0.72, 0.72]) {
      const tPillar = makePart(new THREE.CylinderGeometry(0.08, 0.1, 1.04, 8), '#475569', {
        strokeWidth: 0.012,
      });
      tPillar.position.set(tx, arenaFloorY + 0.52, bc.halfZ - 0.15);
      bcStatic.add(tPillar);
      const tCross = makePart(makeRoundedParkBoxGeo(0.58, 0.06, 0.06, 0.012, 1), '#e2e8f0', {
        strokeWidth: 0.008,
      });
      tCross.position.set(tx * 0.55, arenaFloorY + 0.78, bc.halfZ - 0.15);
      bcStatic.add(tCross);
    }

    // Perimeter Handrail + Instanced Balusters around Concrete Apron (leaving South entry gap clear!)
    const balusterMatrices: THREE.Matrix4[] = [];
    const addArenaPerimeterRail = (x1: number, z1: number, x2: number, z2: number) => {
      const isRear = z1 === z2 && z1 < 0;
      const isFront = z1 === z2 && z1 > 0;
      const adjX1 = isRear ? x1 + 0.045 : isFront && x1 < 0 ? x1 + 0.045 : x1;
      const adjX2 = isRear ? x2 - 0.045 : isFront && x2 > 0 ? x2 - 0.045 : x2;
      const len = Math.hypot(adjX2 - adjX1, z2 - z1);
      const yaw = Math.atan2(adjX2 - adjX1, z2 - z1);
      const railBar = makePart(makeRoundedParkBoxGeo(0.08, 0.07, len, 0.014, 1), '#cbd5e1', {
        strokeWidth: 0.01,
      });
      railBar.position.set((adjX1 + adjX2) * 0.5, arenaFloorY + 0.96, (z1 + z2) * 0.5);
      railBar.rotation.y = yaw;
      bcStatic.add(railBar);

      const count = Math.max(2, Math.round(len / 0.52));
      for (let i = 0; i <= count; i++) {
        const t = i / count;
        balusterMatrices.push(
          new THREE.Matrix4().makeTranslation(
            bc.x + adjX1 + (adjX2 - adjX1) * t,
            bc.baseY + arenaFloorY + 0.48,
            bc.z + z1 + (z2 - z1) * t,
          ),
        );
      }
    };
    const rxE = bc.halfX - 0.25;
    const rzE = bc.halfZ - 0.25;
    addArenaPerimeterRail(-rxE, -rzE, rxE, -rzE);
    addArenaPerimeterRail(-rxE, -rzE, -rxE, rzE);
    addArenaPerimeterRail(rxE, -rzE, rxE, rzE);
    addArenaPerimeterRail(-rxE, rzE, -1.65, rzE);
    addArenaPerimeterRail(1.65, rzE, rxE, rzE);

    const instArenaBalusters = makeInstancedBatch(
      new THREE.CylinderGeometry(0.025, 0.025, 0.96, 6),
      '#94a3b8',
      balusterMatrices,
    );
    if (instArenaBalusters) instancedBatchGroup.add(instArenaBalusters);

    // Brushed Conductive Steel Floor (15.2m x 9.8m) with Metric Metallic Grid Texture!
    const steelFloor = makePart(
      applyBoxMetricUvs(new THREE.BoxGeometry(bc.floorHalfX * 2, 0.06, bc.floorHalfZ * 2), 4.0, 4.0),
      '#ffffff',
      { map: conductiveFloorTex, strokeWidth: 0.016 },
    );
    steelFloor.position.y = arenaFloorY + 0.02;
    bcStatic.add(steelFloor);

    // Continuous 45°-Mitered Impact Buffer Curb & Outer Red Bumper Ring (`ExtrudeGeometry`, zero corner overlaps)
    const curbH = 0.4;
    const curbFrame = makePart(
      makeMitredParkRingGeo(bc.floorHalfX * 2 + 0.92, bc.floorHalfZ * 2 + 0.92, 0.46, curbH, 0.035),
      '#1e293b',
      { strokeWidth: 0.016 },
    );
    curbFrame.position.set(0, arenaFloorY + curbH * 0.5, 0);
    bcStatic.add(curbFrame);

    const redTrimRing = makePart(
      makeMitredParkRingGeo(bc.floorHalfX * 2 + 0.96, bc.floorHalfZ * 2 + 0.96, 0.49, 0.09, 0.022),
      '#ef4444',
      { strokeWidth: 0.01 },
    );
    redTrimRing.position.set(0, arenaFloorY + curbH * 0.56, 0);
    bcStatic.add(redTrimRing);

    // Structural Steel I-Beam Column Grid (3 x 2 bays) + Baseplate Anchor Bolts + Diagonal X-Bracing (Sheet 6!)
    const colH = 4.05;
    const colXs = [-bc.halfX + 0.52, 0, bc.halfX - 0.52];
    const colZs = [-bc.halfZ + 0.52, bc.halfZ - 0.52];
    const colBoltMatrices: THREE.Matrix4[] = [];
    // Single welded 12-vertex beveled I-beam section extrusion (`0.38m` flanges x `0.44m` total depth)
    const iShape = new THREE.Shape([
      new THREE.Vector2(-0.18, -0.21),
      new THREE.Vector2(0.18, -0.21),
      new THREE.Vector2(0.18, -0.145),
      new THREE.Vector2(0.06, -0.145),
      new THREE.Vector2(0.06, 0.145),
      new THREE.Vector2(0.18, 0.145),
      new THREE.Vector2(0.18, 0.21),
      new THREE.Vector2(-0.18, 0.21),
      new THREE.Vector2(-0.18, 0.145),
      new THREE.Vector2(-0.06, 0.145),
      new THREE.Vector2(-0.06, -0.145),
      new THREE.Vector2(-0.18, -0.145),
    ]);
    iShape.closePath();
    const iBeamCoreH = Math.max(0.4, colH - 0.16 - 0.02);
    const iBeamGeo = new THREE.ExtrudeGeometry(iShape, {
      depth: iBeamCoreH,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 2,
    });
    iBeamGeo.rotateX(-Math.PI / 2);
    iBeamGeo.translate(0, 0.01, 0);

    for (let xi = 0; xi < colXs.length; xi++) {
      for (let zi = 0; zi < colZs.length; zi++) {
        // Leave South center column open for clear Front Elevation entry!
        if (xi === 1 && zi === 1) continue;
        const cx = colXs[xi];
        const cz = colZs[zi];

        const iPillar = makePart(iBeamGeo, '#3c485c', {
          strokeWidth: 0.015,
        });
        iPillar.position.set(cx, arenaFloorY + 0.16, cz);
        bcStatic.add(iPillar);

        const baseCap = makePart(makeRoundedParkBoxGeo(0.66, 0.16, 0.66, 0.020, 2), '#64748b', {
          strokeWidth: 0.014,
        });
        baseCap.position.set(cx, arenaFloorY + 0.08, cz);
        bcStatic.add(baseCap);

        for (const bx of [-0.22, 0.22]) {
          for (const bz of [-0.22, 0.22]) {
            colBoltMatrices.push(
              new THREE.Matrix4().makeTranslation(bc.x + cx + bx, bc.baseY + arenaFloorY + 0.19, bc.z + cz + bz),
            );
          }
        }
      }
    }

    const instColBolts = makeInstancedBatch(
      new THREE.CylinderGeometry(0.04, 0.04, 0.08, 6),
      '#1e293b',
      colBoltMatrices,
    );
    if (instColBolts) instancedBatchGroup.add(instColBolts);

    // Diagonal Steel X-Bracing in Side Bays (Sheet 6 Side Elevation!) & Rear Corner Bays
    const xBraceVec = new THREE.Vector3();
    const addXBracePanel = (pA: THREE.Vector3, pB: THREE.Vector3, pC: THREE.Vector3, pD: THREE.Vector3) => {
      for (const [start, end] of [
        [pA, pD],
        [pB, pC],
      ] as const) {
        xBraceVec.subVectors(end, start);
        const strut = makePart(
          new THREE.BoxGeometry(0.11, xBraceVec.length(), 0.11),
          '#475569',
          { strokeWidth: 0.012 },
        );
        strut.position.copy(start).add(end).multiplyScalar(0.5);
        strut.quaternion.setFromUnitVectors(upVec, xBraceVec.clone().normalize());
        bcStatic.add(strut);
      }
    };
    const bLowY = arenaFloorY + 0.35;
    const bTopY = arenaFloorY + colH - 0.15;
    for (const sx of [colXs[0], colXs[2]]) {
      addXBracePanel(
        new THREE.Vector3(sx, bLowY, colZs[0]),
        new THREE.Vector3(sx, bLowY, colZs[1]),
        new THREE.Vector3(sx, bTopY, colZs[0]),
        new THREE.Vector3(sx, bTopY, colZs[1]),
      );
    }
    // Inner Bay Steel Columns + Full Corner X-Brace Corner Frames with Riveted Gusset Plates (Sheet 6!)
    for (const fz of [colZs[0], colZs[1]]) {
      for (const [xL, xR] of [
        [colXs[0], colXs[0] + 2.4],
        [colXs[2] - 2.4, colXs[2]],
      ] as const) {
        const innerX = xL === colXs[0] ? xR : xL;
        const mWeb = makePart(new THREE.BoxGeometry(0.12, colH, 0.26), '#334155', {
          strokeWidth: 0.014,
        });
        mWeb.position.set(innerX, arenaFloorY + colH * 0.5, fz);
        bcStatic.add(mWeb);

        for (const gy of [bLowY, bTopY]) {
          for (const gx of [xL, xR]) {
            const gusset = makePart(new THREE.BoxGeometry(0.32, 0.32, 0.18), '#1e293b', {
              strokeWidth: 0.01,
            });
            gusset.position.set(gx, gy, fz);
            bcStatic.add(gusset);
          }
        }

        addXBracePanel(
          new THREE.Vector3(xL, bLowY, fz),
          new THREE.Vector3(xR, bLowY, fz),
          new THREE.Vector3(xL, bTopY, fz),
          new THREE.Vector3(xR, bTopY, fz),
        );
      }
    }

    // Checkered Header Fascia + True Arched "BUMPER CAR // ARENA" Spandrel Gables (Sheet 6!)
    const fasciaY = arenaFloorY + colH + 0.56;
    const fasciaH = 1.18;
    const fasciaBottomY = fasciaY - fasciaH * 0.5;
    const fasciaTopY = fasciaY + fasciaH * 0.5;
    const addArenaHeaderPanel = (
      px: number,
      py: number,
      pz: number,
      len: number,
      height: number,
      thick: number,
      alongZ: boolean,
      tex: THREE.Texture,
      repeatSingle: boolean,
    ) => {
      const boxW = alongZ ? thick : len;
      const boxD = alongZ ? len : thick;
      const frame = makePart(makeRoundedParkBoxGeo(boxW, height, boxD, 0.03, 2), '#1e293b', {
        strokeWidth: 0.022,
      });
      frame.position.set(px, py, pz);
      bcStatic.add(frame);

      const faceGeo = new THREE.PlaneGeometry(len - 0.08, height - 0.08);
      if (!repeatSingle) {
        const uvAttr = faceGeo.getAttribute('uv');
        const repeatX = Math.max(1, Math.round((len - 0.08) / 4.2));
        for (let k = 0; k < uvAttr.count; k++) {
          uvAttr.setX(k, uvAttr.getX(k) * repeatX);
        }
        uvAttr.needsUpdate = true;
      }

      for (const faceSign of [-1, 1] as const) {
        const face = makePart(faceGeo, '#ffffff', {
          map: tex,
          strokeWidth: 0,
          castShadow: false,
        });
        if (alongZ) {
          face.position.set(px + faceSign * (thick * 0.5 + 0.004), py, pz);
          face.rotation.y = faceSign > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          face.position.set(px, py, pz + faceSign * (thick * 0.5 + 0.004));
          face.rotation.y = faceSign > 0 ? 0 : Math.PI;
        }
        bcStatic.add(face);
      }
    };

    for (const sx of [-1, 1] as const) {
      addArenaHeaderPanel(
        sx * (bc.halfX - 0.14),
        fasciaY,
        0,
        d + 0.24,
        fasciaH,
        0.28,
        true,
        checkeredTex,
        false,
      );
    }

    // Curved Vaulted Corrugated Metallic Roof (open-ended so checkered spandrels shine cleanly!)
    const vaultRadius = bc.halfX + 0.25;
    const vaultArc = (Math.PI * 2) / 3;
    const vaultCosEdge = Math.cos(vaultArc * 0.5);
    const vaultRiseScale = 0.38;
    const vaultXScale = 1.16;
    const vaultGeo = new THREE.CylinderGeometry(
      vaultRadius,
      vaultRadius,
      d + 0.5,
      32,
      1,
      true,
      -vaultArc * 0.5,
      vaultArc,
    );
    vaultGeo.rotateX(-Math.PI / 2);
    vaultGeo.scale(vaultXScale, vaultRiseScale, 1.0);
    // Scale vault UV tiling cleanly for corrugated steel standing ribs
    const vUv = vaultGeo.getAttribute('uv');
    for (let i = 0; i < vUv.count; i++) {
      vUv.setXY(i, vUv.getX(i) * 4.5, vUv.getY(i) * 3.0);
    }
    vUv.needsUpdate = true;

    const vaultCenterY = fasciaTopY - vaultRadius * vaultCosEdge * vaultRiseScale + 0.04;
    const vaultRoof = makePart(vaultGeo, '#ffffff', {
      map: corrugatedMetalTex,
      strokeWidth: 0.024,
    });
    vaultRoof.position.set(0, vaultCenterY, 0);
    bcStatic.add(vaultRoof);

    // True Arched Checkered Spandrel Gables + Curved Steel Trim Rims on Both North & South Elevations (Sheet 6!)
    const spandrelGeo = createBumperCarArchSpandrelGeometry(
      bc.halfX + 0.08,
      fasciaBottomY,
      vaultCenterY - 0.02,
      vaultRadius,
      vaultXScale,
      vaultRiseScale,
      0.26,
      28,
    );
    const archTrimGeo = new THREE.CylinderGeometry(
      vaultRadius + 0.06,
      vaultRadius + 0.06,
      0.22,
      28,
      1,
      true,
      -vaultArc * 0.5,
      vaultArc,
    );
    archTrimGeo.rotateX(-Math.PI / 2);
    archTrimGeo.scale(vaultXScale, vaultRiseScale, 1.0);

    for (const sz of [-1, 1] as const) {
      const zFace = sz * (bc.halfZ - 0.14);
      const spandrel = makePart(spandrelGeo, '#ffffff', {
        map: bumperArchSignTex,
        strokeWidth: 0.02,
      });
      spandrel.position.set(0, 0, zFace);
      bcStatic.add(spandrel);

      const archTrim = makePart(archTrimGeo, '#334155', { strokeWidth: 0.014 });
      archTrim.position.set(0, vaultCenterY + 0.03, sz * (bc.halfZ + 0.24));
      bcStatic.add(archTrim);
    }

    // Standing-Seam Exterior Ribs + Internal Steel Roof Trusses + Pendant Dome Floodlights
    const trussBottomY = arenaFloorY + colH + 0.05;
    const vaultApexY = vaultCenterY + vaultRadius * vaultRiseScale;
    for (const rz of [-bc.halfZ + 0.45, -2.1, 2.1, bc.halfZ - 0.45]) {
      const ribGeo = new THREE.CylinderGeometry(
        vaultRadius + 0.055,
        vaultRadius + 0.055,
        0.14,
        24,
        1,
        true,
        -vaultArc * 0.5,
        vaultArc,
      );
      ribGeo.rotateX(-Math.PI / 2);
      ribGeo.scale(1.16, vaultRiseScale, 1.0);
      const rib = makePart(ribGeo, '#64748b', { strokeWidth: 0.012 });
      rib.position.set(0, vaultCenterY + 0.02, rz);
      bcStatic.add(rib);

      // Horizontal steel truss bottom chord + vertical king/queen-post struts under the arch!
      const tieChord = makePart(new THREE.BoxGeometry(w - 0.8, 0.14, 0.14), '#475569', {
        strokeWidth: 0.01,
      });
      tieChord.position.set(0, trussBottomY, rz);
      bcStatic.add(tieChord);

      for (const kx of [-4.2, 0, 4.2]) {
        const archFrac = Math.max(0, 1.0 - (kx / bc.halfX) * (kx / bc.halfX));
        const postH = Math.max(0.25, (vaultApexY - trussBottomY) * (0.45 + 0.55 * archFrac));
        const kingPost = makePart(new THREE.BoxGeometry(0.11, postH, 0.11), '#64748b', {
          strokeWidth: 0.008,
        });
        kingPost.position.set(kx, trussBottomY + postH * 0.5, rz);
        bcStatic.add(kingPost);
      }
    }

    // Open Overhead Conductive Ceiling Wire Mesh Grid (translucent wire-mesh grid revealing trusses above!)
    const meshPlaneGeo = new THREE.PlaneGeometry(bc.floorHalfX * 2, bc.floorHalfZ * 2);
    meshPlaneGeo.rotateX(Math.PI / 2);
    const wireMeshMat = new THREE.MeshBasicMaterial({
      map: ceilingWireTex,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    disposableGeometries.push(meshPlaneGeo);
    disposableMaterials.push(wireMeshMat);
    const ceilingWireMesh = new THREE.Mesh(meshPlaneGeo, wireMeshMat);
    ceilingWireMesh.position.set(0, trussBottomY - 0.08, 0);
    bcStatic.add(ceilingWireMesh);

    // 6 Industrial Domed Pendant Floodlights suspended from the roof trusses!
    const lampCordGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.58, 6);
    const lampShadeGeo = new THREE.ConeGeometry(0.32, 0.24, 12, 1, true);
    const lampBulbGeo = new THREE.SphereGeometry(0.11, 8, 8);
    for (const lx of [-4.2, 0, 4.2]) {
      for (const lz of [-2.1, 2.1]) {
        const cord = makePart(lampCordGeo, '#1e293b', { strokeWidth: 0, castShadow: false });
        cord.position.set(lx, trussBottomY - 0.34, lz);
        bcStatic.add(cord);

        const shade = makePart(lampShadeGeo, '#334155', { strokeWidth: 0.01, castShadow: false });
        shade.position.set(lx, trussBottomY - 0.68, lz);
        bcStatic.add(shade);

        const bulb = new THREE.Mesh(lampBulbGeo, bulbMat);
        bulb.position.set(lx, trussBottomY - 0.78, lz);
        bcStatic.add(bulb);
      }
    }

    // Helper: Build a detailed 1950s Retro Bumper Car with Rubber Ring & Overhead Power Pickup Pole
    const buildBumperCarMeshGroup = (carColor: string): THREE.Group => {
      const carGrp = new THREE.Group();

      const rubberRing = makePart(
        new THREE.TorusGeometry(0.74, 0.21, 12, 24).rotateX(Math.PI / 2),
        '#181b22',
        { strokeWidth: 0.018 },
      );
      rubberRing.scale.set(0.95, 1.0, 1.3);
      rubberRing.position.y = 0.21;
      carGrp.add(rubberRing);

      const chromeBelt = makePart(
        new THREE.TorusGeometry(0.75, 0.045, 8, 24).rotateX(Math.PI / 2),
        '#f1f5f9',
        { strokeWidth: 0.01 },
      );
      chromeBelt.scale.set(0.95, 1.0, 1.3);
      chromeBelt.position.y = 0.34;
      carGrp.add(chromeBelt);

      const shell = makePart(new THREE.CylinderGeometry(0.6, 0.74, 0.36, 20), carColor, {
        strokeWidth: 0.018,
      });
      shell.scale.set(0.94, 1.0, 1.28);
      shell.position.y = 0.38;
      carGrp.add(shell);

      const hood = makePart(new THREE.SphereGeometry(0.5, 14, 10), carColor, {
        strokeWidth: 0.016,
      });
      hood.scale.set(1.02, 0.5, 1.18);
      hood.position.set(0, 0.5, 0.34);
      carGrp.add(hood);

      const grille = makePart(makeRoundedParkBoxGeo(0.46, 0.14, 0.12, 0.035, 2), '#e2e8f0', {
        strokeWidth: 0.01,
      });
      grille.position.set(0, 0.42, 0.90);
      carGrp.add(grille);

      for (const hx of [-0.31, 0.31]) {
        const bezel = makePart(
          new THREE.CylinderGeometry(0.1, 0.1, 0.1, 10).rotateX(Math.PI / 2),
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

      const coaming = makePart(
        new THREE.TorusGeometry(0.42, 0.055, 8, 16).rotateX(Math.PI / 2),
        '#fffbeb',
        { strokeWidth: 0.01 },
      );
      coaming.scale.set(1.0, 1.0, 1.12);
      coaming.position.set(0, 0.58, -0.14);
      carGrp.add(coaming);

      const seat = makePart(makeRoundedParkBoxGeo(0.6, 0.4, 0.24, 0.055, 2), '#1e293b', {
        strokeWidth: 0.014,
      });
      seat.position.set(0, 0.66, -0.34);
      carGrp.add(seat);

      // Anchored Steering Wheel Group: Column + Center Hub Boss + 3 Spokes + Rim (no floating torus!)
      const steeringGrp = new THREE.Group();
      steeringGrp.position.set(0, 0.68, 0.12);
      steeringGrp.rotation.x = -0.62;
      carGrp.add(steeringGrp);

      const steerShaft = makePart(new THREE.CylinderGeometry(0.026, 0.034, 0.40, 8), '#475569', {
        strokeWidth: 0.008,
      });
      steerShaft.rotation.x = Math.PI / 2;
      steerShaft.position.set(0, 0, -0.20);
      steeringGrp.add(steerShaft);

      const steerHub = makePart(new THREE.CylinderGeometry(0.044, 0.048, 0.045, 10), '#cbd5e1', {
        strokeWidth: 0.008,
      });
      steerHub.rotation.x = Math.PI / 2;
      steeringGrp.add(steerHub);

      for (let sp = 0; sp < 3; sp++) {
        const sAng = (sp / 3) * Math.PI * 2;
        const steerSpoke = makePart(new THREE.CylinderGeometry(0.014, 0.014, 0.13, 6), '#cbd5e1', {
          strokeWidth: 0.006,
        });
        steerSpoke.position.set(Math.sin(sAng) * 0.065, Math.cos(sAng) * 0.065, 0);
        steerSpoke.rotation.z = -sAng;
        steeringGrp.add(steerSpoke);
      }

      const wheelRim = makePart(new THREE.TorusGeometry(0.13, 0.028, 6, 12), '#f8fafc', {
        strokeWidth: 0.008,
      });
      steeringGrp.add(wheelRim);

      const springBase = makePart(new THREE.CylinderGeometry(0.065, 0.075, 0.22, 8), '#eab308', {
        strokeWidth: 0.008,
      });
      springBase.position.set(0, 0.56, -0.72);
      carGrp.add(springBase);

      // Scaled to 1.65x body height (~1.42m tall), so local pole height 1.75m meets arena ceiling wire at y ~ 4.02m cleanly
      const powerPole = makePart(new THREE.CylinderGeometry(0.022, 0.028, 1.75, 6), '#cbd5e1', {
        strokeWidth: 0.006,
        castShadow: false,
      });
      powerPole.position.set(0, 1.50, -0.76);
      powerPole.rotation.x = -0.06;
      carGrp.add(powerPole);

      bakeStaticGroupMeshes(carGrp, { minShadowCasterSpan: 0.5 });
      carGrp.scale.set(1.42, 1.65, 1.42);
      return carGrp;
    };

    // 5 Dynamic Moving Dodgem Bumper Cars
    for (let c = 0; c < BUMPER_CAR_PALETTE.length; c++) {
      const carGrp = buildBumperCarMeshGroup(BUMPER_CAR_PALETTE[c]);
      carGrp.position.set(bc.x, bc.baseY + arenaFloorY + 0.05, bc.z);
      rootGroup.add(carGrp);
      bumperCarGroups.push(carGrp);
    }

    // 3 Static Bumper Cars neatly staged in the East Parking Zone without curb/lane overlap
    for (const [pz, pYaw, pColor] of [
      [-3.1, -Math.PI * 0.42, '#f43f5e'],
      [0.0, -Math.PI * 0.50, '#38bdf8'],
      [3.1, -Math.PI * 0.58, '#facc15'],
    ] as const) {
      const parkedCar = buildBumperCarMeshGroup(pColor);
      parkedCar.position.set(5.65, arenaFloorY + 0.05, pz);
      parkedCar.rotation.y = pYaw;
      bcStatic.add(parkedCar);
    }
  }

  // Batch all Festoon, Stall & Ontang-Anting Column Carnival Bulbs into 1 Single InstancedMesh
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
    festoonInst.computeBoundingBox();
    festoonInst.computeBoundingSphere();
    festoonInst.frustumCulled = true;
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
    rootGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const geo = (obj as THREE.Mesh).geometry;
        if (geo) geo.dispose();
      }
    });
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
