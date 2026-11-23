import * as THREE from 'three';
import { bakeStaticGroupMeshes } from './buddiesBlitzShadersAndAssets';
import { computeInstancedBoundingVolumes } from './buddiesHubRenderOptimizer';
import {
  buildGlowingDoorFloorArrowPad,
  consolidateCafeStaticGroupMaterials,
  createInteriorCafeStyler,
} from './buddiesCafeInteriorBuilder';
import {
  type CafeAssetStyler,
  applyBoxProjectedUvs,
  createBrushedMetalTexture,
  createCarraraMarbleTexture,
  createFlutedOakTexture,
  createFrostedConservatoryGlassMaterial,
  createWarmOakWoodTexture,
  makePuffedCushionGeo,
  makeRoundedBoxGeo,
} from './buddiesLShapedCafeAssets';
import {
  SALON_INTERIOR_BOUNDS,
  SALON_INTERIOR_SEAT_SPOTS,
  SALON_ORIGIN_Y,
  type SalonStationInteractionKind,
} from './buddiesBeautySalonRules';

export interface SalonInteriorSceneHandle {
  root: THREE.Group;
  floorSpotIndicators: Array<{
    coinRoot: THREE.Group;
    blueCoin: THREE.Object3D;
    greenCoin: THREE.Object3D;
  }>;
  updateVisuals: (
    timeSec: number,
    activeStationKind?: SalonStationInteractionKind | null,
    playerFloorY?: number,
  ) => void;
  dispose: () => void;
}

const COL_BLUSH = '#dcb6a4';
const COL_BLUSH_DARK = '#c89b87';
const COL_CREAM = '#f7efe4';
const COL_IVORY = '#fcf8f2';
const COL_CHAMPAGNE = '#ecd6c3';
const COL_OAK = '#cfa16e';
const COL_BRASS = '#d8ab4c';
const COL_BRONZE = '#3e3733';
const COL_VELVET_PINK = '#e8b4c0';
const COL_VELVET_CREAM = '#f2e3d8';
const COL_SPA_LEATHER = '#f7f1e7';
const COL_STEEL = '#949ca3';
const COL_GLOW_BULB = '#fff3c4';

interface SalonAssetPalette {
  styler: CafeAssetStyler;
  oakTex: THREE.Texture;
  flutedTex: THREE.Texture;
  marbleTex: THREE.Texture;
  stuccoTex: THREE.Texture;
  metalTex: THREE.Texture;
  terrazzoTex: THREE.Texture;
  rugTex: THREE.Texture;
  glowStudioTex: THREE.Texture;
  beautyGlowTex: THREE.Texture;
}

// ============================================================================
// PROCEDURAL SALON CANVAS TEXTURES
// ============================================================================

function makeSalonCanvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repX = 1,
  repY = 1,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    draw(ctx, w, h);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repX, repY);
  tex.needsUpdate = true;
  return tex;
}

function createSalonStuccoTexture(): THREE.CanvasTexture {
  return makeSalonCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#f8f1e7';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 480; i++) {
        const s1 = Math.sin(i * 19.31 + 1.2) * 43758.5453;
        const s2 = Math.sin(i * 73.17 + 4.7) * 29143.21;
        const px = (s1 - Math.floor(s1)) * w;
        const py = (s2 - Math.floor(s2)) * h;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(218, 198, 180, 0.22)' : 'rgba(255, 252, 246, 0.24)';
        ctx.fillRect(px, py, 2.5, 2.5);
      }
    },
    2,
    2,
  );
}

function createSalonTerrazzoGoldGridTexture(): THREE.CanvasTexture {
  return makeSalonCanvasTexture(
    512,
    512,
    (ctx) => {
      ctx.fillStyle = '#f5ede2';
      ctx.fillRect(0, 0, 512, 512);
      // Warm terrazzo mineral chips
      const chipCols = ['#d9b8a5', '#e4d3c1', '#c79c86', '#fffbf5', '#d0c2b4', '#e0a9b3'];
      for (let i = 0; i < 620; i++) {
        const s1 = Math.sin(i * 12.9898) * 43758.5453;
        const s2 = Math.sin(i * 78.233) * 19341.123;
        const rx = (s1 - Math.floor(s1)) * 512;
        const ry = (s2 - Math.floor(s2)) * 512;
        const rad = 1.4 + ((i * 7) % 10) * 0.28;
        ctx.fillStyle = chipCols[i % chipCols.length];
        ctx.beginPath();
        ctx.arc(rx, ry, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      // Signature brushed gold rectangular tile inlay borders (1 tile = ~2.6m x 2.6m)
      ctx.strokeStyle = '#d3a858';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, 502, 502);
    },
    1,
    1,
  );
}

function applySalonPlanarXZUvs(geo: THREE.BufferGeometry, tileSizeM: number): THREE.BufferGeometry {
  const target = geo.index ? geo.toNonIndexed() : geo;
  const pos = target.getAttribute('position');
  if (pos) {
    const uvs = new Float32Array(pos.count * 2);
    const inv = 1 / Math.max(0.25, tileSizeM);
    for (let i = 0; i < pos.count; i++) {
      uvs[i * 2] = pos.getX(i) * inv;
      uvs[i * 2 + 1] = pos.getZ(i) * inv;
    }
    target.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }
  return target;
}

function createWovenWoolRugTexture(): THREE.CanvasTexture {
  return makeSalonCanvasTexture(
    256,
    256,
    (ctx) => {
      ctx.fillStyle = '#efe4d6';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = 'rgba(182, 152, 128, 0.14)';
      for (let y = 0; y < 256; y += 6) {
        ctx.fillRect(0, y, 256, 2);
      }
      for (let x = 0; x < 256; x += 6) {
        ctx.fillRect(x, 0, 2, 256);
      }
      ctx.strokeStyle = '#d8c2ae';
      ctx.lineWidth = 14;
      ctx.strokeRect(12, 12, 232, 232);
    },
    1,
    1,
  );
}

function createSalonSignTextTexture(title: string, bgHex = '#fbf2e6'): THREE.CanvasTexture {
  return makeSalonCanvasTexture(
    512,
    128,
    (ctx) => {
      ctx.fillStyle = bgHex;
      ctx.fillRect(0, 0, 512, 128);
      ctx.strokeStyle = '#d7b79e';
      ctx.lineWidth = 8;
      ctx.strokeRect(6, 6, 500, 116);
      ctx.fillStyle = '#3b332f';
      ctx.font = '800 50px "Georgia", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(title, 256, 66);
    },
    1,
    1,
  );
}

// ============================================================================
// GEOMETRY & PRIMITIVE PLACEMENT HELPERS
// ============================================================================

function addSalonMesh(
  parent: THREE.Object3D,
  styler: CafeAssetStyler,
  geo: THREE.BufferGeometry,
  colorHex: string,
  pos: [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
  opts?: {
    tex?: THREE.Texture | null;
    roughness?: number;
    metalness?: number;
    clearcoat?: number;
    sheen?: number;
    emissiveHex?: string;
    emissiveIntensity?: number;
    strokeW?: number;
    doubleSided?: boolean;
  },
): THREE.Mesh {
  const m = new THREE.Mesh(geo);
  styler.styleOpaque(m, geo, colorHex, opts?.strokeW ?? 0.008, {
    tex: opts?.tex ?? null,
    roughness: opts?.roughness ?? 0.56,
    metalness: opts?.metalness ?? 0.04,
    clearcoat: opts?.clearcoat ?? 0,
    sheen: opts?.sheen ?? 0,
    emissiveHex: opts?.emissiveHex,
    emissiveIntensity: opts?.emissiveIntensity,
    doubleSided: opts?.doubleSided,
    castShadow: false,
    receiveShadow: true,
    tintTex: true,
  });
  m.position.set(pos[0], pos[1], pos[2]);
  m.rotation.set(rot[0], rot[1], rot[2]);
  parent.add(m);
  return m;
}

/**
 * Generates an extruded floor slab (`y = yBottom .. yTop`) matching the Beauty Salon
 * interior footprint with a smooth Front-Left (`-X, +Z`) rounded corner.
 */
function createSalonCurvedSlabGeo(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  curveR: number,
  yBottom: number,
  yTop: number,
  arcSegs = 16,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const cx = minX + curveR;
  const cz = maxZ - curveR;
  shape.moveTo(maxX, -minZ);
  shape.lineTo(minX, -minZ);
  shape.lineTo(minX, -cz);
  for (let i = 1; i <= arcSegs; i++) {
    const t = i / arcSegs;
    const theta = Math.PI - t * (Math.PI * 0.5);
    const wx = cx + Math.cos(theta) * curveR;
    const wz = cz + Math.sin(theta) * curveR;
    shape.lineTo(wx, -wz);
  }
  shape.lineTo(maxX, -maxZ);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.02, yTop - yBottom),
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 1,
    curveSegments: 10,
  });
  geo.rotateX(-Math.PI * 0.5);
  geo.translate(0, yBottom, 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sweeps a curved quarter-circle architectural ribbon around Front-Left (`-X, +Z`)
 * connecting `-X` storefront straight run seamlessly to `+Z` straight end.
 */
function buildCurvedQuarterCornerBand(
  parent: THREE.Object3D,
  styler: CafeAssetStyler,
  cx: number,
  cz: number,
  rInner: number,
  rOuter: number,
  yBottom: number,
  yTop: number,
  colorHex: string,
  tex?: THREE.Texture | null,
  segs = 18,
): void {
  const shape = new THREE.Shape();
  // Note after rotateX(-PI/2): local shape +Y maps to -Z, so negate Z
  for (let i = 0; i <= segs; i++) {
    const theta = Math.PI - (i / segs) * (Math.PI * 0.5);
    const wx = cx + Math.cos(theta) * rOuter;
    const wz = cz + Math.sin(theta) * rOuter;
    if (i === 0) shape.moveTo(wx, -wz);
    else shape.lineTo(wx, -wz);
  }
  for (let i = segs; i >= 0; i--) {
    const theta = Math.PI - (i / segs) * (Math.PI * 0.5);
    const wx = cx + Math.cos(theta) * rInner;
    const wz = cz + Math.sin(theta) * rInner;
    shape.lineTo(wx, -wz);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.02, yTop - yBottom),
    bevelEnabled: false,
    curveSegments: 10,
  });
  geo.rotateX(-Math.PI * 0.5);
  geo.translate(0, yBottom, 0);
  geo.computeVertexNormals();
  applyBoxProjectedUvs(geo, 0.85);
  addSalonMesh(parent, styler, geo, colorHex, [0, 0, 0], [0, 0, 0], {
    tex: tex ?? null,
    roughness: 0.62,
  });
}

// ============================================================================
// SHELL, CURVED CORNER WINDOW, BALCONIES & EXTERIOR CUTAWAY (SHEETS 1 & 2)
// ============================================================================

function buildSalonShellAndFacade(
  staticGroup: THREE.Object3D,
  glassGroup: THREE.Object3D,
  glassMat: THREE.Material,
  p: SalonAssetPalette,
): void {
  const b = SALON_INTERIOR_BOUNDS;
  const styler = p.styler;

  // 1. Cutaway Sidewalk Terrazzo Border Terrace + 1F Interior Terrazzo & Gold Grid Slab
  const terraceGeo = applySalonPlanarXZUvs(
    createSalonCurvedSlabGeo(
      b.minX - 1.35,
      b.maxX + 1.35,
      b.minZ - 1.05,
      b.maxZ + 1.15,
      b.curveRadius + 1.25,
      -0.22,
      -0.02,
    ),
    2.8,
  );
  addSalonMesh(staticGroup, styler, terraceGeo, '#ece2d6', [0, 0, 0], [0, 0, 0], {
    tex: p.terrazzoTex,
    roughness: 0.72,
  });

  const floorGeo = applySalonPlanarXZUvs(
    createSalonCurvedSlabGeo(b.minX, b.maxX, b.minZ, b.maxZ, b.curveRadius, -0.08, 0.0),
    2.6,
  );
  addSalonMesh(staticGroup, styler, floorGeo, '#ffffff', [0, 0, 0], [0, 0, 0], {
    tex: p.terrazzoTex,
    roughness: 0.36,
    clearcoat: 0.35,
  });

  // 2. Back-Right (-Z) Full 2-Story Wall (`z = -4.10`) & Back-Left (-X) Straight Wall (`x = -6.00`)
  const fullW = b.maxX - b.minX; // 12.00m
  addSalonMesh(
    staticGroup,
    styler,
    makeRoundedBoxGeo(fullW + 0.24, 6.45, 0.24, 0.015, 2),
    COL_CREAM,
    [0.0, 3.16, b.minZ - 0.12],
    [0, 0, 0],
    { tex: p.stuccoTex, roughness: 0.72 },
  );
  // Blush cornice coping & baseboard along -Z wall
  addSalonMesh(staticGroup, styler, makeRoundedBoxGeo(fullW + 0.28, 0.16, 0.28, 0.012, 2), COL_BLUSH, [0, 6.42, b.minZ - 0.12]);
  addSalonMesh(staticGroup, styler, makeRoundedBoxGeo(fullW + 0.02, 0.18, 0.06, 0.008, 2), COL_BLUSH, [0, 0.09, b.minZ + 0.03]);

  // -X Back-Left straight stucco wall behind Shelves (solid 1F + pierced 3 Arched Windows on 2F)
  // Lower straight wall (`z = -4.10 .. +2.30`, `y = 0 .. 3.00`)
  const leftStraightLen = b.curveCenterZ - b.minZ; // 6.40m
  const leftStraightCenterZ = (b.minZ + b.curveCenterZ) * 0.5; // -0.90m
  addSalonMesh(
    staticGroup,
    styler,
    makeRoundedBoxGeo(0.24, 3.04, leftStraightLen + 0.02, 0.014, 2),
    COL_CREAM,
    [b.minX - 0.12, 1.50, leftStraightCenterZ],
    [0, 0, 0],
    { tex: p.stuccoTex, roughness: 0.72 },
  );
  // 2F Pier Pillars & Headers around 3 Tall Arched Multi-Pane Windows on -X wall (`z = -2.55, -0.85, +0.85`)
  const winCentersZ = [-2.55, -0.85, 0.85];
  const winW = 1.16;
  // Piers between arched windows spanning z in [-4.10 .. +2.30]
  const xPiers: Array<[number, number]> = [
    [-3.615, 0.98],
    [-1.70, 0.56],
    [0.0, 0.56],
    [1.865, 0.88],
  ];
  for (const [pz, pLen] of xPiers) {
    addSalonMesh(
      staticGroup,
      styler,
      makeRoundedBoxGeo(0.24, 3.40, pLen, 0.012, 2),
      COL_CREAM,
      [b.minX - 0.12, 4.70, pz],
      [0, 0, 0],
      { tex: p.stuccoTex },
    );
  }
  // Below-window sill apron & upper lintel header along -X 2F (`y = 3.00..3.48` & `y = 5.55..6.40`)
  addSalonMesh(staticGroup, styler, makeRoundedBoxGeo(0.24, 0.50, leftStraightLen + 0.04, 0.012, 2), COL_CREAM, [b.minX - 0.12, 3.24, leftStraightCenterZ]);
  addSalonMesh(staticGroup, styler, makeRoundedBoxGeo(0.26, 0.90, leftStraightLen + 0.04, 0.012, 2), COL_CREAM, [b.minX - 0.12, 5.95, leftStraightCenterZ]);
  addSalonMesh(staticGroup, styler, makeRoundedBoxGeo(0.30, 0.16, leftStraightLen + 0.10, 0.012, 2), COL_BLUSH, [b.minX - 0.12, 6.42, leftStraightCenterZ]);

  for (const wz of winCentersZ) {
    buildInteriorArchedWindowAssembly(staticGroup, glassGroup, glassMat, p, b.minX - 0.12, 3.48, wz, Math.PI * 0.5, winW, 1.56);
  }
  // Cylindrical Brass Wall Sconces between -X 2F Arched Windows
  for (const sz of [-3.38, -1.70, 0.0]) {
    buildInteriorBrassSconce(staticGroup, p, [b.minX + 0.04, 4.48, sz], Math.PI * 0.5);
    buildInteriorBrassSconce(staticGroup, p, [b.minX - 0.28, 4.48, sz], -Math.PI * 0.5);
  }

  // 3. Curved Front-Left Panoramic Corner Glazing (`x = -4.20 .. -6.00, z = +2.30 .. +4.10`, Sheet 2!)
  const cx = b.curveCenterX;
  const cz = b.curveCenterZ;
  // Curved bulkhead base (`y = 0 .. 0.64`) + sill + fascia header (`y = 2.86 .. 3.42`)
  buildCurvedQuarterCornerBand(staticGroup, styler, cx, cz, b.curveRadius - 0.02, b.curveRadius + 0.24, 0.0, 0.64, COL_CHAMPAGNE, p.oakTex);
  buildCurvedQuarterCornerBand(staticGroup, styler, cx, cz, b.curveRadius - 0.06, b.curveRadius + 0.28, 0.62, 0.70, COL_BLUSH);
  buildCurvedQuarterCornerBand(staticGroup, styler, cx, cz, b.curveRadius - 0.04, b.curveRadius + 0.26, 2.84, 3.42, COL_CREAM, p.stuccoTex);
  buildCurvedQuarterCornerBand(staticGroup, styler, cx, cz, b.curveRadius - 0.08, b.curveRadius + 0.30, 2.82, 2.90, COL_BLUSH);
  buildCurvedQuarterCornerBand(staticGroup, styler, cx, cz, b.curveRadius - 0.08, b.curveRadius + 0.30, 3.40, 3.48, COL_BLUSH);

  // Curved glass panels & oak mullions around the 90deg arc (`theta: PI -> PI/2`)
  const arcSegs = 12;
  const rGlass = b.curveRadius + 0.11;
  for (let i = 0; i < arcSegs; i++) {
    const t0 = Math.PI - (i / arcSegs) * (Math.PI * 0.5);
    const t1 = Math.PI - ((i + 1) / arcSegs) * (Math.PI * 0.5);
    const x0 = cx + Math.cos(t0) * rGlass;
    const z0 = cz + Math.sin(t0) * rGlass;
    const x1 = cx + Math.cos(t1) * rGlass;
    const z1 = cz + Math.sin(t1) * rGlass;
    const mx = (x0 + x1) * 0.5;
    const mz = (z0 + z1) * 0.5;
    const segLen = Math.hypot(x1 - x0, z1 - z0) + 0.02;
    const paneRot = Math.atan2(z1 - z0, x1 - x0);
    const gMesh = new THREE.Mesh(new THREE.BoxGeometry(segLen, 2.12, 0.03), glassMat);
    gMesh.position.set(mx, 1.76, mz);
    gMesh.rotation.y = -paneRot;
    gMesh.raycast = () => {};
    glassGroup.add(gMesh);

    if (i % 4 === 0 || i === arcSegs - 1) {
      const mTheta = i === arcSegs - 1 ? t1 : t0;
      addSalonMesh(
        staticGroup,
        styler,
        makeRoundedBoxGeo(0.08, 2.16, 0.12, 0.01, 2),
        COL_OAK,
        [cx + Math.cos(mTheta) * rGlass, 1.76, cz + Math.sin(mTheta) * rGlass],
        [0, Math.atan2(Math.cos(mTheta), Math.sin(mTheta)), 0],
        { tex: p.oakTex },
      );
    }
  }

  // Front Cutaway Floor Trim along +Z (`z = +5.20`, low architectural edge so camera has 100% open view into showroom)
  addSalonMesh(staticGroup, styler, makeRoundedBoxGeo(b.maxX - cx, 0.14, 0.20, 0.012, 2), COL_BLUSH, [(cx + b.maxX) * 0.5, 0.05, b.maxZ + 0.08]);

  // 4. Right (+X) Entrance Doorway, Canopy Awning, GLOW STUDIO Signage, 2F French Door & BEAUTY & GLOW Header (Sheets 1 & 2)
  const rxWall = b.maxX + 0.12;
  // North half of +X wall (`z = -4.10 .. +1.77`) solid 2-story wall pierced by 2F French Balcony Door (`z = +0.45`)
  addSalonMesh(staticGroup, styler, makeRoundedBoxGeo(0.24, 3.04, 5.88, 0.014, 2), COL_CREAM, [rxWall, 1.50, -1.16], [0, 0, 0], { tex: p.stuccoTex });
  addSalonMesh(staticGroup, styler, makeRoundedBoxGeo(0.24, 3.40, 3.98, 0.014, 2), COL_CREAM, [rxWall, 4.70, -2.12], [0, 0, 0], { tex: p.stuccoTex });
  // +X 2F pier South of French door (`z = +1.04 .. +1.76`) + Lintel over French Door (`z = -0.14 .. +1.04`)
  addSalonMesh(staticGroup, styler, makeRoundedBoxGeo(0.24, 3.40, 0.74, 0.014, 2), COL_CREAM, [rxWall, 4.70, 1.40], [0, 0, 0], { tex: p.stuccoTex });
  addSalonMesh(staticGroup, styler, makeRoundedBoxGeo(0.24, 1.15, 1.32, 0.014, 2), COL_CREAM, [rxWall, 5.82, 0.45], [0, 0, 0], { tex: p.stuccoTex });
  // 2F Arched French Door (`x = rxWall, z = +0.45`) opening onto East Exterior Balcony
  buildInteriorArchedWindowAssembly(staticGroup, glassGroup, glassMat, p, rxWall, 3.04, 0.45, Math.PI * 0.5, 1.18, 1.85);
  buildInteriorBrassSconce(staticGroup, p, [b.maxX - 0.04, 4.48, -0.35], -Math.PI * 0.5);
  buildInteriorBrassSconce(staticGroup, p, [b.maxX - 0.04, 4.48, 1.25], -Math.PI * 0.5);

  // 1F Entry Vestibule Piers around Entrance Doorway (`z = +2.45`, opening width `1.36m`: `1.77 .. 3.13`)
  addSalonMesh(staticGroup, styler, makeRoundedBoxGeo(0.24, 3.42, 0.24, 0.012, 2), COL_CREAM, [rxWall, 1.71, 1.66], [0, 0, 0], { tex: p.stuccoTex });
  addSalonMesh(staticGroup, styler, makeRoundedBoxGeo(0.24, 3.42, 0.98, 0.012, 2), COL_CREAM, [rxWall, 1.71, 3.62], [0, 0, 0], { tex: p.stuccoTex });
  // Doorway header & `"GLOW STUDIO"` fascia signboard (`z = +1.35 .. +4.10`)
  addSalonMesh(staticGroup, styler, makeRoundedBoxGeo(0.26, 0.96, 2.76, 0.012, 2), COL_CREAM, [rxWall, 2.94, 2.72], [0, 0, 0], { tex: p.stuccoTex });
  addSalonMesh(staticGroup, styler, makeRoundedBoxGeo(0.32, 0.12, 2.84, 0.010, 2), COL_BLUSH, [rxWall, 3.44, 2.72]);
  addSalonMesh(staticGroup, styler, makeRoundedBoxGeo(0.06, 0.52, 2.45, 0.008, 2), '#ffffff', [rxWall + 0.15, 2.98, 2.65], [0, Math.PI * 0.5, 0], { tex: p.glowStudioTex, roughness: 0.45 });
  // Side-view Beauty & Glow roof header (`z = -2.30 .. +1.76, y = 6.48`) facing `+X`
  addSalonMesh(staticGroup, styler, makeRoundedBoxGeo(0.32, 0.85, 4.10, 0.012, 2), COL_BLUSH, [rxWall, 6.48, -0.27]);
  addSalonMesh(staticGroup, styler, makeRoundedBoxGeo(0.06, 0.60, 3.65, 0.008, 2), '#ffffff', [rxWall + 0.17, 6.48, -0.27], [0, Math.PI * 0.5, 0], { tex: p.beautyGlowTex, roughness: 0.42 });

  // Timber & Glass Entry Door (`x = rxWall`, slightly hinged open outward 22deg at `z = 1.80`!) + C-handle
  const doorPivot = new THREE.Group();
  doorPivot.position.set(rxWall + 0.02, 0.02, 1.80);
  doorPivot.rotation.y = 0.34;
  staticGroup.add(doorPivot);
  addSalonMesh(doorPivot, styler, makeRoundedBoxGeo(0.07, 2.38, 1.24, 0.010, 2), COL_OAK, [0, 1.19, 0.64], [0, 0, 0], { tex: p.oakTex });
  const doorPane = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.56, 0.84), glassMat);
  doorPane.position.set(0, 1.38, 0.64);
  doorPane.raycast = () => {};
  glassGroup.add(doorPane);
  // C-shaped brass pull handle on inside of door
  addSalonMesh(doorPivot, styler, new THREE.CylinderGeometry(0.018, 0.018, 0.46, 8), COL_BRASS, [-0.07, 1.12, 1.06], [0, 0, 0], { metalness: 0.72, roughness: 0.28 });

  // Sconces inside Entry Vestibule + Exterior Angled Cream Awning & Boxwood Topiary outside door
  buildInteriorBrassSconce(staticGroup, p, [b.maxX - 0.04, 1.85, 1.62], -Math.PI * 0.5);
  buildInteriorBrassSconce(staticGroup, p, [b.maxX - 0.04, 1.85, 3.30], -Math.PI * 0.5);
  // Outside awning (`x = rxWall .. rxWall + 0.96, y = 2.58 -> 2.32`)
  addSalonMesh(staticGroup, styler, makeRoundedBoxGeo(1.05, 0.06, 2.15, 0.010, 2), '#f4ecde', [rxWall + 0.52, 2.48, 2.45], [0, 0, -0.24], { roughness: 0.78 });
  // Outside boxwood topiary pot beside entrance door
  buildSalonPottedPlant(staticGroup, p, [rxWall + 0.42, 0.0, 3.45], 0.92, 'topiary');

  // 5. Exterior Wrap-Around 2F Terrace Balcony (`-X` side & `+X` side w/ Olive Trees & Dark Bronze Railings)
  buildExterior2FTerraceBalconies(staticGroup, p);

  // 6. Mezzanine L-Shaped Structural Slab (`y = 2.86 .. 3.00m`, Sheet 1)
  // Rect A: x in [-0.85 .. +6.00], z in [-4.10 .. -0.75]
  addSalonMesh(
    staticGroup,
    styler,
    makeRoundedBoxGeo(6.86, 0.14, 3.36, 0.012, 2),
    '#ebe0d2',
    [2.575, 2.93, -2.425],
    [0, 0, 0],
    { tex: p.oakTex, roughness: 0.48 },
  );
  // Rect B: x in [+2.85 .. +6.00], z in [-0.75 .. +1.65]
  addSalonMesh(
    staticGroup,
    styler,
    makeRoundedBoxGeo(3.16, 0.14, 2.41, 0.012, 2),
    '#ebe0d2',
    [4.425, 2.93, 0.45],
    [0, 0, 0],
    { tex: p.oakTex, roughness: 0.48 },
  );
  // Warm golden LED cove reveal under mezzanine edge
  addSalonMesh(staticGroup, styler, new THREE.BoxGeometry(3.72, 0.03, 0.04), COL_GLOW_BULB, [1.00, 2.855, -0.75], [0, 0, 0], { emissiveHex: '#ffdca0', emissiveIntensity: 1.4 });
  addSalonMesh(staticGroup, styler, new THREE.BoxGeometry(0.04, 0.03, 2.40), COL_GLOW_BULB, [2.85, 2.855, 0.45], [0, 0, 0], { emissiveHex: '#ffdca0', emissiveIntensity: 1.4 });
}

function buildInteriorArchedWindowAssembly(
  staticGroup: THREE.Object3D,
  glassGroup: THREE.Object3D,
  glassMat: THREE.Material,
  p: SalonAssetPalette,
  wx: number,
  wy: number,
  wz: number,
  rotY: number,
  width: number,
  rectH: number,
): void {
  const wg = new THREE.Group();
  wg.position.set(wx, wy, wz);
  wg.rotation.y = rotY;
  staticGroup.add(wg);

  const halfW = width * 0.5;
  addSalonMesh(wg, p.styler, makeRoundedBoxGeo(width + 0.18, 0.10, 0.34, 0.012, 2), COL_BLUSH_DARK, [0, -0.04, 0]);
  for (const sx of [-halfW - 0.05, halfW + 0.05]) {
    addSalonMesh(wg, p.styler, makeRoundedBoxGeo(0.10, rectH, 0.28, 0.010, 2), COL_BLUSH, [sx, rectH * 0.5, 0]);
  }
  addSalonMesh(wg, p.styler, new THREE.TorusGeometry(halfW + 0.04, 0.055, 7, 16, Math.PI), COL_BLUSH, [0, rectH, 0]);
  // Oak inner frame & cruciform muntins
  addSalonMesh(wg, p.styler, new THREE.BoxGeometry(0.045, rectH + halfW * 0.92, 0.14), COL_OAK, [0, (rectH + halfW * 0.92) * 0.5, 0], [0, 0, 0], { tex: p.oakTex });
  for (const hy of [rectH * 0.45, rectH]) {
    addSalonMesh(wg, p.styler, new THREE.BoxGeometry(width - 0.04, 0.045, 0.14), COL_OAK, [0, hy, 0], [0, 0, 0], { tex: p.oakTex });
  }

  // Clear transparent 3D glazing (synced into glassGroup in world/local space!)
  const rectGlass = new THREE.Mesh(new THREE.BoxGeometry(width - 0.08, rectH, 0.02), glassMat);
  rectGlass.position.set(wx, wy + rectH * 0.5, wz);
  rectGlass.rotation.y = rotY;
  rectGlass.raycast = () => {};
  glassGroup.add(rectGlass);
}

function buildInteriorBrassSconce(
  parent: THREE.Object3D,
  p: SalonAssetPalette,
  pos: [number, number, number],
  rotY: number,
): void {
  const sg = new THREE.Group();
  sg.position.set(pos[0], pos[1], pos[2]);
  sg.rotation.y = rotY;
  parent.add(sg);
  addSalonMesh(sg, p.styler, new THREE.BoxGeometry(0.08, 0.12, 0.03), COL_BRASS, [0, 0, 0.015], [0, 0, 0], { metalness: 0.72, roughness: 0.28 });
  addSalonMesh(sg, p.styler, new THREE.CylinderGeometry(0.042, 0.042, 0.24, 12), COL_GLOW_BULB, [0, 0.04, 0.06], [0, 0, 0], { emissiveHex: '#ffdf9e', emissiveIntensity: 1.5 });
}

function buildExterior2FTerraceBalconies(
  staticGroup: THREE.Object3D,
  p: SalonAssetPalette,
): void {
  const deckY = 3.00;
  // Left (-X) outer balcony slab (`x = -7.18 .. -6.00, z = -3.95 .. +2.30`)
  addSalonMesh(staticGroup, p.styler, makeRoundedBoxGeo(1.18, 0.14, 6.26, 0.015, 2), COL_BLUSH, [-6.62, deckY - 0.05, -0.825]);
  // Right (+X) outer French Door balcony (`x = +6.00 .. +7.18, z = -1.25 .. +1.75`)
  addSalonMesh(staticGroup, p.styler, makeRoundedBoxGeo(1.18, 0.14, 3.02, 0.015, 2), COL_BLUSH, [6.66, deckY - 0.05, 0.25]);

  // Bronze vertical-picket railings on both exterior balconies
  const picketGeo = new THREE.BoxGeometry(0.025, 0.82, 0.025);
  const addPicketRun = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const midX = (x0 + x1) * 0.5;
    const midZ = (z0 + z1) * 0.5;
    const ang = Math.atan2(x1 - x0, z1 - z0);
    addSalonMesh(staticGroup, p.styler, new THREE.BoxGeometry(0.05, 0.04, len + 0.04), COL_BRONZE, [midX, deckY + 0.86, midZ], [0, ang, 0]);
    const steps = Math.max(2, Math.round(len / 0.24));
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      addSalonMesh(
        staticGroup,
        p.styler,
        picketGeo.clone(),
        COL_BRONZE,
        [x0 + (x1 - x0) * f, deckY + 0.44, z0 + (z1 - z0) * f],
      );
    }
  };
  addPicketRun(-7.16, -3.90, -7.16, 2.26);
  addPicketRun(-7.16, -3.90, -6.04, -3.90);
  addPicketRun(-7.16, 2.26, -6.04, 2.26);
  addPicketRun(7.20, -1.20, 7.20, 1.70);
  addPicketRun(6.04, -1.20, 7.20, -1.20);
  addPicketRun(6.04, 1.70, 7.20, 1.70);
  picketGeo.dispose();

  // Balcony Olive Trees & Trailing Greenery Planters
  buildSalonPottedPlant(staticGroup, p, [-6.62, deckY + 0.02, 1.80], 0.92, 'olive');
  buildSalonPottedPlant(staticGroup, p, [-6.62, deckY + 0.02, -3.15], 0.84, 'olive');
  buildSalonPottedPlant(staticGroup, p, [6.66, deckY + 0.02, 1.25], 0.86, 'olive');
  addSalonMesh(staticGroup, p.styler, makeRoundedBoxGeo(0.42, 0.36, 1.32, 0.012, 2), COL_OAK, [-6.65, deckY + 0.20, -0.85], [0, 0, 0], { tex: p.oakTex });
  for (let i = 0; i < 6; i++) {
    addSalonMesh(staticGroup, p.styler, new THREE.SphereGeometry(0.18 + (i % 2) * 0.04, 8, 7), i % 2 === 0 ? '#6e9460' : '#80a66f', [-6.65 + (i % 2 === 0 ? -0.04 : 0.05), deckY + 0.46, -1.37 + i * 0.21]);
  }
}

// ============================================================================
// 1F ASSET 1: ARCHED BACKLIT DISPLAY SHELVING (SHEET 3)
// ============================================================================

function buildArchedBacklitShelvingRow(
  parent: THREE.Object3D,
  glassGroup: THREE.Object3D,
  glassMat: THREE.Material,
  p: SalonAssetPalette,
): void {
  const bayCentersZ = [-0.85, 0.35, 1.55];
  const shelfX = -5.72;
  const bottleCols = ['#f6b4c8', '#d7c3f4', '#b4e3d4', '#f8d6a8', '#fffaf4', '#f39ebc'];

  for (let bi = 0; bi < bayCentersZ.length; bi++) {
    const bay = new THREE.Group();
    bay.position.set(shelfX, 0.0, bayCentersZ[bi]);
    bay.rotation.y = Math.PI * 0.5;
    parent.add(bay);

    const w = 1.12;
    const d = 0.46;
    // Lower Stock Credenza Cabinet (`y = 0.06 .. 0.72`) + Brass recessed toe-kick (`0 .. 0.06`)
    addSalonMesh(bay, p.styler, makeRoundedBoxGeo(w - 0.04, 0.06, d - 0.06, 0.008, 1), COL_BRASS, [0, 0.03, -0.02], [0, 0, 0], { metalness: 0.65, roughness: 0.30 });
    addSalonMesh(bay, p.styler, makeRoundedBoxGeo(w, 0.66, d, 0.012, 2), COL_CREAM, [0, 0.39, 0]);
    for (const dx of [-0.28, 0.28]) {
      addSalonMesh(bay, p.styler, makeRoundedBoxGeo(0.52, 0.56, 0.025, 0.006, 2), COL_IVORY, [dx, 0.39, d * 0.5 + 0.01]);
      addSalonMesh(bay, p.styler, new THREE.SphereGeometry(0.020, 8, 7), COL_BRASS, [dx + (dx < 0 ? 0.18 : -0.18), 0.58, d * 0.5 + 0.035], [0, 0, 0], { metalness: 0.75 });
    }

    // Side stiles + Backlit Arched Niche Backdrop (`y = 0.72 .. 2.75`)
    for (const sx of [-w * 0.5 + 0.06, w * 0.5 - 0.06]) {
      addSalonMesh(bay, p.styler, makeRoundedBoxGeo(0.11, 1.56, d - 0.02, 0.010, 2), COL_CHAMPAGNE, [sx, 1.50, 0], [0, 0, 0], { tex: p.oakTex });
    }
    // Warm golden LED backlit alcove plane
    addSalonMesh(bay, p.styler, makeRoundedBoxGeo(w - 0.16, 1.54, 0.04, 0.006, 1), '#fff0cf', [0, 1.49, -d * 0.5 + 0.06], [0, 0, 0], { emissiveHex: '#ffe0a2', emissiveIntensity: 1.15 });
    addSalonMesh(bay, p.styler, new THREE.CylinderGeometry(w * 0.5 - 0.08, w * 0.5 - 0.08, 0.04, 18, 1, false, 0, Math.PI), '#fff0cf', [0, 2.24, -d * 0.5 + 0.06], [Math.PI * 0.5, 0, 0], { emissiveHex: '#ffe0a2', emissiveIntensity: 1.22 });
    // Arched surround cap + Brushed Brass Inlay Arch Trim
    addSalonMesh(bay, p.styler, new THREE.TorusGeometry(w * 0.5 - 0.04, 0.055, 8, 18, Math.PI), COL_CHAMPAGNE, [0, 2.24, 0.04], [0, 0, 0], { tex: p.oakTex });
    addSalonMesh(bay, p.styler, new THREE.TorusGeometry(w * 0.5 - 0.09, 0.018, 6, 18, Math.PI), COL_BRASS, [0, 2.24, d * 0.5 - 0.01], [0, 0, 0], { metalness: 0.72 });

    // 4 Tempered Glass Floating Shelves + Curated Bottles, Jars & Gift Boxes
    for (let sh = 0; sh < 4; sh++) {
      const sy = 1.04 + sh * 0.38;
      // Glass floating shelf in glassGroup (world coords matching bay!)
      const gShelf = new THREE.Mesh(new THREE.BoxGeometry(w - 0.18, 0.022, d - 0.12), glassMat);
      gShelf.position.set(shelfX + 0.04, sy, bayCentersZ[bi]);
      gShelf.rotation.y = Math.PI * 0.5;
      gShelf.raycast = () => {};
      glassGroup.add(gShelf);
      // Slim brushed brass shelf bracket lip
      addSalonMesh(bay, p.styler, new THREE.BoxGeometry(w - 0.18, 0.016, 0.02), COL_BRASS, [0, sy - 0.004, d * 0.5 - 0.07], [0, 0, 0], { metalness: 0.7 });

      // Populate items
      for (let it = 0; it < 5; it++) {
        const ix = -0.36 + it * 0.18;
        const col = bottleCols[(bi * 5 + sh * 3 + it) % bottleCols.length];
        if (sh === 0 && (it === 0 || it === 4)) {
          // Gift box w/ ribbon
          addSalonMesh(bay, p.styler, makeRoundedBoxGeo(0.14, 0.10, 0.12, 0.008, 1), col, [ix, sy + 0.06, 0.04]);
          addSalonMesh(bay, p.styler, new THREE.BoxGeometry(0.145, 0.02, 0.03), COL_BRASS, [ix, sy + 0.115, 0.04]);
        } else if (sh === 1 && it % 2 === 1) {
          // Squat serum cream jar
          addSalonMesh(bay, p.styler, new THREE.CylinderGeometry(0.045, 0.045, 0.065, 10), col, [ix, sy + 0.045, 0.04], [0, 0, 0], { clearcoat: 0.5 });
          addSalonMesh(bay, p.styler, new THREE.CylinderGeometry(0.048, 0.048, 0.02, 10), COL_BRASS, [ix, sy + 0.085, 0.04], [0, 0, 0], { metalness: 0.68 });
        } else {
          // Skincare perfume / dropper bottle
          const bH = 0.13 + ((bi + it) % 3) * 0.035;
          const bR = 0.034 + (it % 2) * 0.009;
          addSalonMesh(bay, p.styler, new THREE.CylinderGeometry(bR * 0.92, bR, bH, 10), col, [ix, sy + 0.012 + bH * 0.5, 0.04], [0, 0, 0], { clearcoat: 0.6 });
          addSalonMesh(bay, p.styler, new THREE.CylinderGeometry(bR * 0.52, bR * 0.52, 0.036, 8), COL_BRASS, [ix, sy + 0.012 + bH + 0.018, 0.04], [0, 0, 0], { metalness: 0.72 });
        }
      }
    }
  }
}

// ============================================================================
// 1F ASSET 2: CURVED RECEPTION & CONSULTATION COUNTER (SHEET 4)
// ============================================================================

function buildCurvedReceptionCounter(
  parent: THREE.Object3D,
  p: SalonAssetPalette,
): void {
  const rg = new THREE.Group();
  rg.position.set(-3.35, 0.0, 0.45);
  parent.add(rg);

  // Counter C-curve wraps theta from -PI/2 (North wing) -> 0 (+X front belly) -> +PI/2 (South wing)
  const buildArcRing = (
    rIn: number,
    rOut: number,
    y0: number,
    y1: number,
    colorHex: string,
    tex?: THREE.Texture | null,
    startAng = -Math.PI * 0.5,
    endAng = Math.PI * 0.5,
    segs = 22,
  ) => {
    const sh = new THREE.Shape();
    for (let i = 0; i <= segs; i++) {
      const a = startAng + (i / segs) * (endAng - startAng);
      const x = Math.cos(a) * rOut;
      const z = Math.sin(a) * rOut;
      if (i === 0) sh.moveTo(x, -z);
      else sh.lineTo(x, -z);
    }
    for (let i = segs; i >= 0; i--) {
      const a = startAng + (i / segs) * (endAng - startAng);
      const x = Math.cos(a) * rIn;
      const z = Math.sin(a) * rIn;
      sh.lineTo(x, -z);
    }
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.02, y1 - y0), bevelEnabled: false, curveSegments: 12 });
    g.rotateX(-Math.PI * 0.5);
    g.translate(0, y0, 0);
    g.computeVertexNormals();
    applyBoxProjectedUvs(g, 0.9);
    addSalonMesh(rg, p.styler, g, colorHex, [0, 0, 0], [0, 0, 0], { tex: tex ?? null, roughness: 0.45 });
  };

  // Brushed brass kickplate + fluted champagne body + Calacatta marble top + customer transaction ledge
  buildArcRing(0.50, 0.96, 0.0, 0.08, COL_BRASS);
  buildArcRing(0.48, 0.94, 0.08, 0.97, '#f2dfd0', p.flutedTex);
  buildArcRing(0.44, 1.00, 0.97, 1.03, '#ffffff', p.marbleTex);
  buildArcRing(0.78, 1.03, 1.03, 1.08, '#ffffff', p.marbleTex, -0.55, 0.55, 12);

  // Vertical rounded timber flutes along outer arc face for authentic Sheet 4 ribbed silhouette
  const fluteCount = 26;
  const fluteGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.87, 6);
  for (let i = 0; i < fluteCount; i++) {
    const a = -Math.PI * 0.48 + (i / (fluteCount - 1)) * Math.PI * 0.96;
    addSalonMesh(rg, p.styler, fluteGeo.clone(), COL_CHAMPAGNE, [Math.cos(a) * 0.945, 0.525, Math.sin(a) * 0.945], [0, 0, 0], { tex: p.oakTex, strokeW: 0.004 });
  }
  fluteGeo.dispose();

  // Rear Staff Workspace: Center Cash Drawer Box + Staff Shelf Dividers + Rear Monitor
  addSalonMesh(rg, p.styler, makeRoundedBoxGeo(0.32, 0.14, 0.54, 0.008, 1), COL_OAK, [0.32, 0.78, 0], [0, 0, 0], { tex: p.oakTex });
  addSalonMesh(rg, p.styler, new THREE.BoxGeometry(0.03, 0.02, 0.12), COL_BRASS, [0.15, 0.78, 0]);
  // Staff PC Monitor & Base on top (`facing -X` staff!)
  addSalonMesh(rg, p.styler, makeRoundedBoxGeo(0.04, 0.28, 0.42, 0.008, 1), '#3c4048', [0.64, 1.24, -0.22], [0, 0.15, 0.12]);
  addSalonMesh(rg, p.styler, makeRoundedBoxGeo(0.14, 0.10, 0.12, 0.006, 1), '#5c626e', [0.66, 1.07, -0.22], [0, 0.15, 0]);
  // Keypad + Perfume Tester Tray (`6` bottles) + Decorative Floral Vase (`Sheet 4`)
  addSalonMesh(rg, p.styler, makeRoundedBoxGeo(0.12, 0.05, 0.09, 0.005, 1), '#454a52', [0.74, 1.06, 0.14], [0, -0.15, -0.30]);
  addSalonMesh(rg, p.styler, makeRoundedBoxGeo(0.24, 0.025, 0.34, 0.006, 1), COL_OAK, [0.58, 1.05, 0.44], [0, -0.25, 0], { tex: p.oakTex });
  for (let b = 0; b < 6; b++) {
    const bx = 0.53 + (b % 2) * 0.09;
    const bz = 0.34 + Math.floor(b / 2) * 0.10;
    addSalonMesh(rg, p.styler, new THREE.CylinderGeometry(0.024, 0.026, 0.09, 8), b % 2 === 0 ? '#f6b4c8' : '#e6d39a', [bx, 1.11, bz]);
    addSalonMesh(rg, p.styler, new THREE.CylinderGeometry(0.012, 0.012, 0.025, 7), COL_BRASS, [bx, 1.165, bz]);
  }
  // Floral vase near North tip
  addSalonMesh(rg, p.styler, new THREE.CylinderGeometry(0.075, 0.058, 0.17, 10), '#e7d5c6', [0.16, 1.12, -0.68]);
  addSalonMesh(rg, p.styler, new THREE.SphereGeometry(0.14, 8, 7), '#f2b5c6', [0.16, 1.26, -0.68]);
}

// ============================================================================
// 1F CENTERPIECE MARBLE TABLE & FLANKING PLINTHS (SHEET 1)
// ============================================================================

function buildCenterpieceDisplayIsland(
  parent: THREE.Object3D,
  p: SalonAssetPalette,
): void {
  const cg = new THREE.Group();
  cg.position.set(0.65, 0.0, 1.75);
  parent.add(cg);

  // Main Center Square/Rounded Calacatta Marble Table
  addSalonMesh(cg, p.styler, makeRoundedBoxGeo(0.76, 0.05, 0.76, 0.012, 2), COL_BRASS, [0, 0.025, 0], [0, 0, 0], { metalness: 0.68 });
  addSalonMesh(cg, p.styler, makeRoundedBoxGeo(0.70, 0.76, 0.70, 0.018, 2), '#f2e8dc', [0, 0.42, 0]);
  addSalonMesh(cg, p.styler, makeRoundedBoxGeo(1.18, 0.06, 1.18, 0.018, 2), '#ffffff', [0, 0.83, 0], [0, 0, 0], { tex: p.marbleTex, clearcoat: 0.45 });

  // Centerpiece Vase + Bottles/Brushes
  addSalonMesh(cg, p.styler, new THREE.CylinderGeometry(0.10, 0.08, 0.20, 12), '#e5cec0', [0, 0.96, 0]);
  addSalonMesh(cg, p.styler, new THREE.SphereGeometry(0.20, 10, 8), '#f4b5c6', [0, 1.14, 0]);
  addSalonMesh(cg, p.styler, new THREE.SphereGeometry(0.12, 8, 7), '#84a973', [-0.14, 1.08, 0.12]);
  for (const [bx, bz, col] of [
    [-0.34, 0.28, '#f5c2d1'],
    [0.32, 0.30, '#d8c5f0'],
    [-0.30, -0.32, '#f7d8a8'],
    [0.34, -0.28, '#c5e2d5'],
  ] as const) {
    addSalonMesh(cg, p.styler, new THREE.CylinderGeometry(0.04, 0.044, 0.14, 9), col, [bx, 0.93, bz]);
    addSalonMesh(cg, p.styler, new THREE.CylinderGeometry(0.02, 0.02, 0.035, 7), COL_BRASS, [bx, 1.015, bz]);
  }

  // 3 Flanking Calacatta Marble Display Plinths (matching Sheet 1 front showroom composition)
  for (const [px, pz, ph] of [
    [-0.86, -0.10, 0.56],
    [0.86, -0.10, 0.64],
    [0.0, 0.86, 0.52],
  ] as const) {
    addSalonMesh(cg, p.styler, makeRoundedBoxGeo(0.46, 0.04, 0.46, 0.008, 1), COL_BRASS, [px, 0.02, pz], [0, 0, 0], { metalness: 0.68 });
    addSalonMesh(cg, p.styler, makeRoundedBoxGeo(0.42, ph, 0.42, 0.012, 2), '#ffffff', [px, 0.04 + ph * 0.5, pz], [0, 0, 0], { tex: p.marbleTex, clearcoat: 0.4 });
    addSalonMesh(cg, p.styler, new THREE.CylinderGeometry(0.042, 0.044, 0.15, 9), '#f6b4c8', [px - 0.06, 0.04 + ph + 0.075, pz]);
    addSalonMesh(cg, p.styler, new THREE.CylinderGeometry(0.038, 0.040, 0.11, 9), '#d9c4f2', [px + 0.07, 0.04 + ph + 0.055, pz + 0.06]);
    addSalonMesh(cg, p.styler, new THREE.CylinderGeometry(0.022, 0.022, 0.03, 7), COL_BRASS, [px - 0.06, 0.04 + ph + 0.16, pz]);
  }
}

// ============================================================================
// 1F ASSET 3: 3x HOLLYWOOD MAKEUP VANITY STATIONS & SWIVEL STOOLS (SHEET 6)
// ============================================================================

function buildHollywoodVanityRow(
  parent: THREE.Object3D,
  p: SalonAssetPalette,
): THREE.Mesh[] {
  const bulbMeshes: THREE.Mesh[] = [];
  const xs = [0.90, 2.65, 4.40];

  for (const vx of xs) {
    const vg = new THREE.Group();
    vg.position.set(vx, 0.0, -3.60);
    parent.add(vg);

    // 1. Vanity Desk (`1.22m x 0.50m x 0.78m`) w/ Tapered Legs & Brass Ferrules
    for (const lx of [-0.55, 0.55]) {
      for (const lz of [-0.20, 0.20]) {
        addSalonMesh(vg, p.styler, new THREE.CylinderGeometry(0.024, 0.016, 0.48, 8), COL_OAK, [lx, 0.26, lz], [0, 0, 0], { tex: p.oakTex });
        addSalonMesh(vg, p.styler, new THREE.CylinderGeometry(0.018, 0.015, 0.08, 8), COL_BRASS, [lx, 0.04, lz], [0, 0, 0], { metalness: 0.72 });
      }
    }
    addSalonMesh(vg, p.styler, makeRoundedBoxGeo(1.18, 0.26, 0.46, 0.012, 2), COL_CHAMPAGNE, [0, 0.62, 0]);
    addSalonMesh(vg, p.styler, makeRoundedBoxGeo(1.24, 0.045, 0.52, 0.010, 2), '#ffffff', [0, 0.77, 0], [0, 0, 0], { tex: p.marbleTex, clearcoat: 0.4 });
    // Ribbed Pastel Drawers + Brass Pull Knobs
    for (const dx of [-0.39, 0.39]) {
      for (const dy of [0.555, 0.675]) {
        addSalonMesh(vg, p.styler, makeRoundedBoxGeo(0.34, 0.095, 0.025, 0.005, 1), '#f4dfd2', [dx, dy, 0.235], [0, 0, 0], { tex: p.flutedTex });
        addSalonMesh(vg, p.styler, new THREE.SphereGeometry(0.014, 7, 6), COL_BRASS, [dx, dy, 0.255], [0, 0, 0], { metalness: 0.75 });
      }
    }
    addSalonMesh(vg, p.styler, makeRoundedBoxGeo(0.36, 0.12, 0.025, 0.005, 1), '#f4dfd2', [0, 0.665, 0.235]);
    addSalonMesh(vg, p.styler, new THREE.SphereGeometry(0.014, 7, 6), COL_BRASS, [0, 0.665, 0.255]);

    // 2. Circular Brushed Brass Hollywood Vanity Mirror + 12 Warm LED Globe Bulbs
    addSalonMesh(vg, p.styler, makeRoundedBoxGeo(0.36, 0.035, 0.12, 0.006, 1), COL_BRASS, [0, 0.81, -0.14], [0, 0, 0], { metalness: 0.72 });
    addSalonMesh(vg, p.styler, new THREE.CylinderGeometry(0.03, 0.035, 0.10, 8), COL_BRASS, [0, 0.86, -0.14], [0, 0, 0], { metalness: 0.72 });
    addSalonMesh(vg, p.styler, new THREE.TorusGeometry(0.41, 0.028, 8, 28), COL_BRASS, [0, 1.32, -0.14], [0, 0, 0], { metalness: 0.75, roughness: 0.25 });
    addSalonMesh(vg, p.styler, new THREE.CylinderGeometry(0.39, 0.39, 0.024, 24), '#d8ecf6', [0, 1.32, -0.155], [Math.PI * 0.5, 0, 0], { roughness: 0.12, metalness: 0.35, clearcoat: 0.8 });

    const bulbCount = 12;
    for (let bi = 0; bi < bulbCount; bi++) {
      const ang = (bi / bulbCount) * Math.PI * 2;
      const bulb = addSalonMesh(
        vg,
        p.styler,
        new THREE.SphereGeometry(0.030, 8, 6),
        COL_GLOW_BULB,
        [Math.cos(ang) * 0.345, 1.32 + Math.sin(ang) * 0.345, -0.115],
        [0, 0, 0],
        { emissiveHex: '#ffe39a', emissiveIntensity: 1.55, strokeW: 0.003 },
      );
      bulbMeshes.push(bulb);
    }

    // 3. Cosmetic Organizers (Brush Jars, Eyeshadow Palette, Bottles)
    addSalonMesh(vg, p.styler, new THREE.CylinderGeometry(0.042, 0.038, 0.095, 10), '#ead4c6', [0.43, 0.84, 0.04]);
    for (let br = 0; br < 4; br++) {
      const ba = (br / 4) * Math.PI * 2;
      addSalonMesh(vg, p.styler, new THREE.CylinderGeometry(0.006, 0.005, 0.14, 5), COL_OAK, [0.43 + Math.cos(ba) * 0.015, 0.91, 0.04 + Math.sin(ba) * 0.015], [Math.sin(ba) * 0.2, 0, -Math.cos(ba) * 0.2]);
    }
    addSalonMesh(vg, p.styler, makeRoundedBoxGeo(0.16, 0.025, 0.12, 0.004, 1), '#5c4b47', [-0.42, 0.805, 0.06], [0, 0.24, 0]);
    addSalonMesh(vg, p.styler, new THREE.CylinderGeometry(0.025, 0.028, 0.09, 8), '#f5b5c8', [0.30, 0.84, -0.05]);

    // 4. Pink Velvet Swivel Pedestal Stool at `z = -2.72` (relative `+0.88`)
    const sg = new THREE.Group();
    sg.position.set(0, 0, 0.88);
    vg.add(sg);
    addSalonMesh(sg, p.styler, new THREE.CylinderGeometry(0.21, 0.24, 0.035, 16), COL_BRASS, [0, 0.018, 0], [0, 0, 0], { metalness: 0.72 });
    addSalonMesh(sg, p.styler, new THREE.CylinderGeometry(0.034, 0.052, 0.38, 10), COL_BRASS, [0, 0.21, 0], [0, 0, 0], { metalness: 0.72 });
    addSalonMesh(sg, p.styler, makeRoundedBoxGeo(0.44, 0.12, 0.42, 0.045, 2), COL_VELVET_PINK, [0, 0.45, 0], [0, 0, 0], { sheen: 0.55, roughness: 0.78 });
    // Curved wrap-around velvet backrest facing -Z mirror (back at +Z!)
    addSalonMesh(sg, p.styler, makePuffedCushionGeo(0.42, 0.28, 0.10, 0.035), COL_VELVET_PINK, [0, 0.62, 0.17], [0.12, 0, 0], { sheen: 0.55, roughness: 0.78 });
  }
  return bulbMeshes;
}

// ============================================================================
// ASSET 4: U-TURN MEZZANINE STAIRCASE & TEMPERED GLASS RAILINGS (SHEET 5)
// ============================================================================

function buildStaircaseAndMezzanineGlassRailings(
  staticGroup: THREE.Object3D,
  glassGroup: THREE.Object3D,
  glassMat: THREE.Material,
  p: SalonAssetPalette,
): void {
  const b = SALON_INTERIOR_BOUNDS;
  const s = b.stair;

  // 1. Mid-Landing Deck (`x = -4.65 .. -3.20`, `z = -3.90 .. -1.45`, `y = 1.50m`) + Support Under-Cabinet
  addSalonMesh(
    staticGroup,
    p.styler,
    makeRoundedBoxGeo(1.46, 0.14, 2.46, 0.012, 2),
    COL_OAK,
    [-3.925, 1.43, -2.675],
    [0, 0, 0],
    { tex: p.oakTex },
  );
  // Central Dividing Rail Wall between Lower & Upper Flights (`z = -2.675`, `x = -3.20 .. -0.85`)
  addSalonMesh(staticGroup, p.styler, makeRoundedBoxGeo(2.38, 1.38, 0.14, 0.010, 2), COL_CREAM, [-2.025, 0.69, -2.675]);

  // 2. Lower Flight (`9` Oak Treads w/ LED Strip Reveal, climbing -X from -0.85 @ 0m to -3.20 @ 1.50m)
  const steps = 9;
  const run = s.lowerStartX - s.lowerEndX; // 2.35
  const rise = b.midLandingY; // 1.50
  const stepDx = run / steps;
  const stepDy = rise / steps;
  for (let i = 0; i < steps; i++) {
    const tx = s.lowerStartX - (i + 0.5) * stepDx;
    const ty = (i + 1) * stepDy;
    addSalonMesh(staticGroup, p.styler, makeRoundedBoxGeo(stepDx + 0.04, 0.06, 0.98, 0.008, 1), COL_OAK, [tx, ty - 0.03, -1.95], [0, 0, 0], { tex: p.oakTex });
    addSalonMesh(staticGroup, p.styler, new THREE.BoxGeometry(0.025, 0.02, 0.90), COL_GLOW_BULB, [tx + stepDx * 0.45, ty - 0.068, -1.95], [0, 0, 0], { emissiveHex: '#ffe1a4', emissiveIntensity: 1.4, strokeW: 0.002 });
  }
  // Structural steel angled stringers under Lower Flight
  const flightLen = Math.hypot(run, rise);
  const flightAng = Math.atan2(rise, run);
  for (const sz of [-2.38, -1.52]) {
    addSalonMesh(staticGroup, p.styler, makeRoundedBoxGeo(flightLen, 0.14, 0.06, 0.008, 1), '#5c6066', [-2.025, 0.66, sz], [0, 0, -flightAng], { metalness: 0.55 });
  }

  // 3. Upper Flight (`9` Oak Treads w/ LED Strip Reveal, climbing +X from -3.20 @ 1.50m to -0.85 @ 3.00m)
  for (let i = 0; i < steps; i++) {
    const tx = s.upperStartX + (i + 0.5) * stepDx;
    const ty = b.midLandingY + (i + 1) * stepDy;
    addSalonMesh(staticGroup, p.styler, makeRoundedBoxGeo(stepDx + 0.04, 0.06, 0.98, 0.008, 1), COL_OAK, [tx, ty - 0.03, -3.40], [0, 0, 0], { tex: p.oakTex });
    addSalonMesh(staticGroup, p.styler, new THREE.BoxGeometry(0.025, 0.02, 0.90), COL_GLOW_BULB, [tx - stepDx * 0.45, ty - 0.068, -3.40], [0, 0, 0], { emissiveHex: '#ffe1a4', emissiveIntensity: 1.4, strokeW: 0.002 });
  }
  for (const sz of [-3.84, -2.96]) {
    addSalonMesh(staticGroup, p.styler, makeRoundedBoxGeo(flightLen, 0.14, 0.06, 0.008, 1), '#5c6066', [-2.025, 2.16, sz], [0, 0, flightAng], { metalness: 0.55 });
  }

  // 4. Tempered Glass Railing Panels + Brushed Brass Standoffs & Handrail Cap
  const railH = 0.96;
  const addGlassRailingRun = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dz = z1 - z0;
    const len3 = Math.hypot(dx, dy, dz);
    const lenXZ = Math.hypot(dx, dz);
    const mx = (x0 + x1) * 0.5;
    const my = (y0 + y1) * 0.5 + railH * 0.5;
    const mz = (z0 + z1) * 0.5;
    const yaw = Math.atan2(dx, dz);
    const pitch = Math.atan2(dy, Math.max(0.001, lenXZ));

    const rg = new THREE.Group();
    rg.position.set(mx, my + railH * 0.5, mz);
    rg.rotation.order = 'YXZ';
    rg.rotation.y = yaw;
    rg.rotation.x = -pitch;
    staticGroup.add(rg);
    // Brushed Brass Top Handrail Cap
    addSalonMesh(rg, p.styler, makeRoundedBoxGeo(0.055, 0.045, len3 + 0.04, 0.01, 2), COL_BRASS, [0, 0, 0], [0, 0, 0], { metalness: 0.72, roughness: 0.25 });

    // Standoff Posts (Bottom/Mid/End)
    for (const pzOff of [-len3 * 0.45, 0, len3 * 0.45]) {
      addSalonMesh(rg, p.styler, new THREE.CylinderGeometry(0.018, 0.018, railH * 0.82, 8), COL_BRASS, [0, -railH * 0.48, pzOff], [0, 0, 0], { metalness: 0.72 });
    }

    // Tempered Glass Balustrade Panel
    const gMesh = new THREE.Mesh(new THREE.BoxGeometry(0.025, railH - 0.12, len3), glassMat);
    gMesh.position.set(mx, my, mz);
    gMesh.rotation.order = 'YXZ';
    gMesh.rotation.y = yaw;
    gMesh.rotation.x = -pitch;
    gMesh.raycast = () => {};
    glassGroup.add(gMesh);
  };

  // Lower Flight South Glass Railing + Mid-Landing West Railing + Upper Flight Center & South Stairwell Edge
  addGlassRailingRun(-0.85, 0.0, -1.45, -3.20, 1.50, -1.45);
  addGlassRailingRun(-3.20, 1.50, -1.45, -4.65, 1.50, -1.45);
  addGlassRailingRun(-4.65, 1.50, -1.45, -4.65, 1.50, -3.90);
  addGlassRailingRun(-3.20, 1.50, -2.90, -0.85, 3.00, -2.90);

  // Continuous 2F Mezzanine Atrium Glass Balustrade (`y = 3.00m` wrapping entire L-deck interior edges!)
  addGlassRailingRun(-0.85, 3.00, -2.90, -0.85, 3.00, -0.75);
  addGlassRailingRun(-0.85, 3.00, -0.75, 2.85, 3.00, -0.75);
  addGlassRailingRun(2.85, 3.00, -0.75, 2.85, 3.00, 1.65);
  addGlassRailingRun(2.85, 3.00, 1.65, 5.90, 3.00, 1.65);
}

// ============================================================================
// 2F ASSET 5: CONSULTATION LOUNGE LOVESEAT & MARBLE COFFEE TABLE (SHEET 7)
// ============================================================================

function buildConsultationLoungeSuite(
  parent: THREE.Object3D,
  glassGroup: THREE.Object3D,
  glassMat: THREE.Material,
  p: SalonAssetPalette,
): void {
  const yFloor = SALON_INTERIOR_BOUNDS.secondFloorY;
  // 1. Woven Wool Area Rug (`x = +4.35, z = -1.65`)
  addSalonMesh(parent, p.styler, makeRoundedBoxGeo(2.20, 0.020, 2.20, 0.008, 1), '#ffffff', [4.35, yFloor + 0.01, -1.65], [0, 0, 0], { tex: p.rugTex, roughness: 0.92, strokeW: 0.005 });

  // 2. Curved Channel-Stitched Velvet Loveseat (`1.62m wide x 0.85m deep`, facing +Z at `4.35, -2.42`)
  const sf = new THREE.Group();
  sf.position.set(4.35, yFloor, -2.42);
  parent.add(sf);

  // 4 Tapered Brushed Brass Legs
  for (const [lx, lz, rx, rz] of [
    [-0.68, 0.30, 0.08, -0.08],
    [0.68, 0.30, 0.08, 0.08],
    [-0.64, -0.32, -0.08, -0.08],
    [0.64, -0.32, -0.08, 0.08],
  ] as const) {
    addSalonMesh(sf, p.styler, new THREE.CylinderGeometry(0.022, 0.012, 0.24, 8), COL_BRASS, [lx, 0.12, lz], [rx, 0, rz], { metalness: 0.72 });
  }
  // Curved Under-Deck Frame & Plush Velvet Seat Cushion
  addSalonMesh(sf, p.styler, makeRoundedBoxGeo(1.56, 0.12, 0.76, 0.04, 2), '#e8d7cc', [0, 0.27, 0]);
  addSalonMesh(sf, p.styler, makePuffedCushionGeo(1.48, 0.14, 0.68, 0.05), COL_VELVET_CREAM, [0, 0.39, 0.04], [0, 0, 0], { sheen: 0.60, roughness: 0.80 });
  // Curved Channel-Stitched Backrest & Side Wings (`9` vertical tufted channels curving gently forward at ends!)
  for (let i = 0; i < 9; i++) {
    const f = (i - 4) / 4; // -1 .. +1
    const cx = f * 0.68;
    const cz = -0.30 + f * f * 0.18;
    const cYaw = -f * 0.42;
    const ribH = 0.60 - Math.abs(f) * 0.10;
    addSalonMesh(sf, p.styler, makePuffedCushionGeo(0.185, ribH, 0.14, 0.045), COL_VELVET_CREAM, [cx, 0.26 + ribH * 0.5, cz], [-0.08, cYaw, 0], { sheen: 0.60, roughness: 0.80, strokeW: 0.005 });
  }
  for (const sx of [-0.74, 0.74]) {
    addSalonMesh(sf, p.styler, makePuffedCushionGeo(0.15, 0.42, 0.54, 0.045), COL_VELVET_CREAM, [sx, 0.46, 0.04], [0, 0, 0], { sheen: 0.60, roughness: 0.80 });
  }

  // 3. Oval Calacatta Marble Coffee Table (`1.00m x 0.55m x 0.42m`, at `x = +4.35, z = -0.88`)
  const tb = new THREE.Group();
  tb.position.set(4.35, yFloor, -0.88);
  parent.add(tb);
  // Brushed Brass Cross-Base & Legs
  addSalonMesh(tb, p.styler, makeRoundedBoxGeo(0.76, 0.025, 0.38, 0.008, 2), COL_BRASS, [0, 0.018, 0], [0, 0, 0], { metalness: 0.72 });
  for (const [lx, lz] of [
    [-0.36, -0.17],
    [0.36, -0.17],
    [-0.36, 0.17],
    [0.36, 0.17],
  ] as const) {
    addSalonMesh(tb, p.styler, new THREE.CylinderGeometry(0.015, 0.015, 0.38, 8), COL_BRASS, [lx, 0.20, lz], [0, 0, 0], { metalness: 0.72 });
  }
  // Oval/Pill Calacatta Marble Tabletop
  addSalonMesh(tb, p.styler, makeRoundedBoxGeo(1.00, 0.042, 0.55, 0.020, 3), '#ffffff', [0, 0.40, 0], [0, 0, 0], { tex: p.marbleTex, clearcoat: 0.45 });
  // Coffee Table Props: Ceramic Teacup & Saucer, 2 Lookbook Binders, Fluted Glass Vase w/ Blossoms
  addSalonMesh(tb, p.styler, new THREE.CylinderGeometry(0.065, 0.045, 0.012, 12), '#ffffff', [-0.30, 0.428, 0.04]);
  addSalonMesh(tb, p.styler, new THREE.CylinderGeometry(0.036, 0.028, 0.055, 10), '#f7ede3', [-0.30, 0.46, 0.04]);
  addSalonMesh(tb, p.styler, makeRoundedBoxGeo(0.24, 0.032, 0.19, 0.006, 1), '#d6b6a5', [0.02, 0.436, 0.05], [0, 0.14, 0]);
  addSalonMesh(tb, p.styler, makeRoundedBoxGeo(0.22, 0.028, 0.17, 0.006, 1), '#c59d8a', [0.03, 0.464, 0.03], [0, -0.08, 0]);
  // Glass Vase in glassGroup
  const vaseG = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.048, 0.13, 12), glassMat);
  vaseG.position.set(4.35 + 0.30, yFloor + 0.485, -0.88 - 0.08);
  vaseG.raycast = () => {};
  glassGroup.add(vaseG);
  addSalonMesh(tb, p.styler, new THREE.SphereGeometry(0.11, 8, 7), '#f4b6c6', [0.30, 0.60, -0.08]);
}

// ============================================================================
// 2F ASSET 6: SPA FACIAL TREATMENT BED, CREDENZA & TOWEL CART (SHEET 8)
// ============================================================================

function buildSpaFacialSuite(
  parent: THREE.Object3D,
  p: SalonAssetPalette,
): void {
  const yFloor = SALON_INTERIOR_BOUNDS.secondFloorY;

  // 1. Ergonomic Articulating Hydraulic Spa Facial Treatment Bed (`x = +1.38, z = -2.08`, `rotY = -0.22`)
  const bg = new THREE.Group();
  bg.position.set(1.38, yFloor, -2.08);
  bg.rotation.y = -0.22;
  parent.add(bg);

  // Heavy Brushed-Steel Pedestal & Hydraulic Lift Column
  addSalonMesh(bg, p.styler, makeRoundedBoxGeo(0.64, 0.06, 0.96, 0.024, 2), '#686e75', [0, 0.03, 0], [0, 0, 0], { metalness: 0.65, roughness: 0.32 });
  addSalonMesh(bg, p.styler, makeRoundedBoxGeo(0.28, 0.42, 0.32, 0.04, 2), COL_STEEL, [0, 0.27, -0.04], [0, 0, 0], { metalness: 0.70, roughness: 0.28 });
  // Under-seat articulated frame + Seat cushion (`z = -0.10 .. +0.26`)
  addSalonMesh(bg, p.styler, makeRoundedBoxGeo(0.70, 0.14, 0.56, 0.045, 2), COL_SPA_LEATHER, [0, 0.54, 0.06], [0, 0, 0], { roughness: 0.58, clearcoat: 0.15 });
  // Reclined Backrest (`tilted -38 deg`) + Contoured Headrest w/ Breathing Cradle
  addSalonMesh(bg, p.styler, makeRoundedBoxGeo(0.70, 0.14, 0.68, 0.045, 2), COL_SPA_LEATHER, [0, 0.80, -0.44], [0.62, 0, 0], { roughness: 0.58, clearcoat: 0.15 });
  addSalonMesh(bg, p.styler, makeRoundedBoxGeo(0.54, 0.12, 0.32, 0.045, 2), COL_SPA_LEATHER, [0, 1.07, -0.78], [0.58, 0, 0]);
  // Headrest cutout collar
  addSalonMesh(bg, p.styler, new THREE.TorusGeometry(0.08, 0.026, 7, 16), '#dfd5c7', [0, 1.13, -0.75], [Math.PI * 0.5 + 0.58, 0, 0]);
  // Angled Footrest (`tilted gently down forward`)
  addSalonMesh(bg, p.styler, makeRoundedBoxGeo(0.66, 0.13, 0.56, 0.042, 2), COL_SPA_LEATHER, [0, 0.50, 0.58], [-0.18, 0, 0]);
  // Curved Upholstered Armrests
  for (const sx of [-0.40, 0.40]) {
    addSalonMesh(bg, p.styler, makeRoundedBoxGeo(0.10, 0.08, 0.52, 0.032, 2), COL_SPA_LEATHER, [sx, 0.68, -0.08], [0.24, 0, 0]);
  }

  // 2. Companion Wooden Spa Storage Credenza (`x = +1.30, z = -3.56`, Sheet 8)
  const cr = new THREE.Group();
  cr.position.set(1.30, yFloor, -3.56);
  parent.add(cr);
  addSalonMesh(cr, p.styler, makeRoundedBoxGeo(1.58, 0.78, 0.48, 0.012, 2), COL_OAK, [0, 0.39, 0], [0, 0, 0], { tex: p.oakTex });
  for (const dx of [-0.46, 0.02]) {
    addSalonMesh(cr, p.styler, makeRoundedBoxGeo(0.42, 0.60, 0.025, 0.006, 1), '#d6aa77', [dx, 0.38, 0.245], [0, 0, 0], { tex: p.oakTex });
    addSalonMesh(cr, p.styler, new THREE.SphereGeometry(0.015, 7, 6), COL_BRASS, [dx + 0.14, 0.44, 0.265]);
  }
  // Open Right Cubby w/ Rolled Towels
  addSalonMesh(cr, p.styler, makeRoundedBoxGeo(0.46, 0.54, 0.40, 0.008, 1), '#966b43', [0.50, 0.40, 0.03]);
  for (const [rx, ry] of [
    [0.42, 0.49],
    [0.57, 0.49],
    [0.42, 0.29],
    [0.57, 0.29],
  ] as const) {
    addSalonMesh(cr, p.styler, new THREE.CylinderGeometry(0.065, 0.065, 0.30, 10), '#faf5ee', [rx, ry, 0.06], [Math.PI * 0.5, 0, 0]);
  }
  // Credenza Countertop Items: Folded Towel Stack, Ceramic Bowl & Treatment Bottles
  addSalonMesh(cr, p.styler, makeRoundedBoxGeo(0.30, 0.14, 0.24, 0.035, 2), '#fbf7f1', [-0.48, 0.85, 0.02]);
  addSalonMesh(cr, p.styler, new THREE.CylinderGeometry(0.11, 0.065, 0.10, 12), '#ebe2d8', [0.36, 0.83, 0.04]);
  for (const [bx, bh] of [
    [-0.14, 0.14],
    [-0.02, 0.11],
  ] as const) {
    addSalonMesh(cr, p.styler, new THREE.CylinderGeometry(0.032, 0.034, bh, 8), '#c58c56', [bx, 0.78 + bh * 0.5, 0]);
    addSalonMesh(cr, p.styler, new THREE.CylinderGeometry(0.012, 0.012, 0.035, 6), '#f7f4ee', [bx, 0.78 + bh + 0.018, 0]);
  }

  // 3. Metal Towel Warmer Utility Trolley on Casters (`x = +2.76, z = -2.85`, Sheet 8)
  const tc = new THREE.Group();
  tc.position.set(2.76, yFloor, -2.85);
  parent.add(tc);
  for (const [cx, cz] of [
    [-0.22, -0.17],
    [0.22, -0.17],
    [-0.22, 0.17],
    [0.22, 0.17],
  ] as const) {
    addSalonMesh(tc, p.styler, new THREE.CylinderGeometry(0.026, 0.026, 0.022, 10), '#4a4e54', [cx, 0.026, cz], [0, 0, Math.PI * 0.5]);
    addSalonMesh(tc, p.styler, new THREE.CylinderGeometry(0.016, 0.016, 0.76, 8), COL_STEEL, [cx, 0.43, cz], [0, 0, 0], { metalness: 0.72 });
  }
  addSalonMesh(tc, p.styler, makeRoundedBoxGeo(0.46, 0.04, 0.36, 0.008, 1), COL_OAK, [0, 0.18, 0], [0, 0, 0], { tex: p.oakTex });
  addSalonMesh(tc, p.styler, makeRoundedBoxGeo(0.46, 0.04, 0.36, 0.008, 1), COL_OAK, [0, 0.74, 0], [0, 0, 0], { tex: p.oakTex });
  // Heated Towel UV Cabinet Box between mid & top shelf
  addSalonMesh(tc, p.styler, makeRoundedBoxGeo(0.40, 0.24, 0.32, 0.012, 2), '#e8ecef', [0, 0.54, 0], [0, 0, 0], { roughness: 0.28, metalness: 0.22 });
  addSalonMesh(tc, p.styler, new THREE.CylinderGeometry(0.032, 0.034, 0.12, 8), '#c58c56', [-0.08, 0.82, 0.02]);

  // 4. Floor-to-Ceiling Sheer Curtains on Brushed Brass Rods (`z = -3.96`, behind Spa)
  addSalonMesh(parent, p.styler, new THREE.CylinderGeometry(0.016, 0.016, 3.60, 8), COL_BRASS, [1.38, yFloor + 2.95, -3.96], [0, 0, Math.PI * 0.5], { metalness: 0.72 });
  for (const cx of [-0.20, 2.85]) {
    for (let fold = 0; fold < 4; fold++) {
      addSalonMesh(
        parent,
        p.styler,
        makeRoundedBoxGeo(0.14, 2.86, 0.12, 0.04, 2),
        fold % 2 === 0 ? '#faf4ec' : '#efe3d5',
        [cx + fold * 0.12, yFloor + 1.48, -3.94 + (fold % 2) * 0.03],
        [0, 0, 0],
        { sheen: 0.45, roughness: 0.85, strokeW: 0.004 },
      );
    }
  }

  // 5. 2F Potted Olive / Ficus Plants beside Spa
  buildSalonPottedPlant(parent, p, [-0.28, yFloor, -1.25], 0.86, 'olive');
  buildSalonPottedPlant(parent, p, [3.02, yFloor, -3.52], 0.88, 'olive');
}

// ============================================================================
// SHARED PROPS: POTTED OLIVE / TOPIARY PLANTS & PENDANT LAMPS
// ============================================================================

function buildSalonPottedPlant(
  parent: THREE.Object3D,
  p: SalonAssetPalette,
  pos: [number, number, number],
  scale: number,
  kind: 'olive' | 'topiary',
): void {
  const pg = new THREE.Group();
  pg.position.set(pos[0], pos[1], pos[2]);
  pg.scale.setScalar(scale);
  parent.add(pg);

  addSalonMesh(pg, p.styler, new THREE.CylinderGeometry(0.24, 0.18, 0.36, 14), '#d8b7a5', [0, 0.18, 0]);
  addSalonMesh(pg, p.styler, new THREE.CylinderGeometry(0.21, 0.21, 0.03, 12), '#5a4332', [0, 0.355, 0]);
  addSalonMesh(pg, p.styler, new THREE.CylinderGeometry(0.032, 0.045, 0.68, 8), '#785f4b', [0, 0.64, 0]);
  if (kind === 'topiary') {
    addSalonMesh(pg, p.styler, new THREE.SphereGeometry(0.32, 12, 10), '#5f8b4c', [0, 1.08, 0], [0, 0, 0], { roughness: 0.78 });
  } else {
    for (const [fx, fy, fz, rad, col] of [
      [0.0, 1.18, 0.0, 0.28, '#678d5b'],
      [-0.16, 1.06, 0.12, 0.22, '#7ba16d'],
      [0.18, 1.10, -0.10, 0.22, '#5c8051'],
      [0.05, 1.32, 0.10, 0.20, '#86ab78'],
    ] as const) {
      addSalonMesh(pg, p.styler, new THREE.SphereGeometry(rad, 9, 8), col, [fx, fy, fz], [0, 0, 0], { roughness: 0.78 });
    }
  }
}

function buildHangingBrassPendants(staticGroup: THREE.Object3D, p: SalonAssetPalette): void {
  const specs: Array<[number, number, number, number]> = [
    [-3.00, 0.55, 3.65, 2.55],
    [-3.75, -0.25, 3.65, 2.72],
    [0.65, 1.75, 4.45, 3.10],
    [1.38, -2.08, 6.25, 5.15],
  ];
  for (const [px, pz, ceilY, dropY] of specs) {
    const rodLen = Math.max(0.25, ceilY - dropY);
    addSalonMesh(staticGroup, p.styler, new THREE.CylinderGeometry(0.012, 0.012, rodLen, 6), COL_BRASS, [px, dropY + rodLen * 0.5, pz], [0, 0, 0], { metalness: 0.75, strokeW: 0.002 });
    addSalonMesh(staticGroup, p.styler, new THREE.CylinderGeometry(0.04, 0.18, 0.16, 14), COL_BRASS, [px, dropY, pz], [0, 0, 0], { metalness: 0.72 });
    addSalonMesh(staticGroup, p.styler, new THREE.SphereGeometry(0.075, 10, 8), COL_GLOW_BULB, [px, dropY - 0.06, pz], [0, 0, 0], { emissiveHex: '#ffe3a6', emissiveIntensity: 1.55, strokeW: 0.003 });
  }
}

// ============================================================================
// MAIN BUILDER EXPORT: buildBeautySalonInterior()
// ============================================================================

export function buildBeautySalonInterior(): SalonInteriorSceneHandle {
  const root = new THREE.Group();
  root.name = 'BeautyGlowSalonInterior3D';
  root.position.set(0, SALON_ORIGIN_Y, 0);
  root.visible = false;

  const styler = createInteriorCafeStyler(true);
  const glassMat = createFrostedConservatoryGlassMaterial();
  glassMat.opacity = 0.26;
  glassMat.color.set('#dff3fa');

  const oakTex = createWarmOakWoodTexture(1, 1);
  const flutedTex = createFlutedOakTexture(2.0, 1.0);
  const marbleTex = createCarraraMarbleTexture();
  const stuccoTex = createSalonStuccoTexture();
  const metalTex = createBrushedMetalTexture();
  const terrazzoTex = createSalonTerrazzoGoldGridTexture();
  const rugTex = createWovenWoolRugTexture();
  const glowStudioTex = createSalonSignTextTexture('GLOW STUDIO');
  const beautyGlowTex = createSalonSignTextTexture('BEAUTY & GLOW', '#f4e8db');

  const palette: SalonAssetPalette = {
    styler,
    oakTex,
    flutedTex,
    marbleTex,
    stuccoTex,
    metalTex,
    terrazzoTex,
    rugTex,
    glowStudioTex,
    beautyGlowTex,
  };

  // 1. Soft Warm Ivory Architectural Cutaway Studio Backdrop SkyDome
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(62, 20, 14),
    new THREE.MeshBasicMaterial({
      color: '#f7efe5',
      side: THREE.BackSide,
      fog: false,
    }),
  );
  skyDome.raycast = () => {};
  root.add(skyDome);

  // 2. Crisp Daylight Interior Fill + Maximum 2 Warm PointLights (strictly within LIGHTING_HYGIENE_LIMITS!)
  const salonHemi = new THREE.HemisphereLight('#fffaf2', '#cfa998', 1.28);
  salonHemi.position.set(0, 11, 0);
  root.add(salonHemi);

  const salonSun = new THREE.DirectionalLight('#fff2da', 1.15);
  salonSun.position.set(6, 12, 8);
  salonSun.castShadow = false;
  root.add(salonSun);

  const groundShowroomPt = new THREE.PointLight('#ffdfae', 1.15, 14.5, 1.35);
  groundShowroomPt.position.set(-1.6, 2.35, 0.25);
  groundShowroomPt.castShadow = false;
  root.add(groundShowroomPt);

  const upperMezzaninePt = new THREE.PointLight('#ffe6be', 1.05, 14.0, 1.35);
  upperMezzaninePt.position.set(2.2, 5.05, -2.1);
  upperMezzaninePt.castShadow = false;
  root.add(upperMezzaninePt);

  // 3. Build All 1F + 2F Static Architecture, Assets, and Transparent 3D Glass
  const staticIndoorGroup = new THREE.Group();
  staticIndoorGroup.name = 'BeautySalonStaticBakedGroup';
  root.add(staticIndoorGroup);

  const glassGroup = new THREE.Group();
  glassGroup.name = 'BeautySalonTransparentGlassGroup';
  root.add(glassGroup);

  buildSalonShellAndFacade(staticIndoorGroup, glassGroup, glassMat, palette);
  buildArchedBacklitShelvingRow(staticIndoorGroup, glassGroup, glassMat, palette);
  buildCurvedReceptionCounter(staticIndoorGroup, palette);
  buildCenterpieceDisplayIsland(staticIndoorGroup, palette);
  buildHollywoodVanityRow(staticIndoorGroup, palette);
  buildStaircaseAndMezzanineGlassRailings(staticIndoorGroup, glassGroup, glassMat, palette);
  buildConsultationLoungeSuite(staticIndoorGroup, glassGroup, glassMat, palette);
  buildSpaFacialSuite(staticIndoorGroup, palette);
  buildSalonPottedPlant(staticIndoorGroup, palette, [-4.65, 0.0, 2.85], 0.85, 'topiary');
  buildHangingBrassPendants(staticIndoorGroup, palette);

  // Consolidate & bake static interior meshes into ~15 crisp draw calls while preserving 3D outlines!
  consolidateCafeStaticGroupMaterials(staticIndoorGroup, {
    disableCastShadow: true,
    foldLightClearcoat: true,
  });
  bakeStaticGroupMeshes(staticIndoorGroup, { minShadowCasterSpan: 999 });

  // 4. Exit Door Glowing Floor Pad at 1F Timber/Glass Vestibule (`x = +5.30, z = +3.10`)
  const exitPad = buildGlowingDoorFloorArrowPad();
  exitPad.group.position.set(SALON_INTERIOR_BOUNDS.exitDoorX, 0.032, SALON_INTERIOR_BOUNDS.exitDoorZ);
  exitPad.group.rotation.y = Math.PI * 0.5;
  root.add(exitPad.group);

  // 5. GPU-Instanced Compact Floating Seat Discs above 1F Vanity Stools + 2F Lounge Sofa + 2F Spa Facial Bed
  const seatCount = SALON_INTERIOR_SEAT_SPOTS.length;
  const outerCoinGeo = new THREE.CylinderGeometry(1, 1, 1, 24);
  outerCoinGeo.rotateX(Math.PI * 0.5);
  const outerCoinMat = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    fog: false,
  });
  const outerCoinInst = new THREE.InstancedMesh(outerCoinGeo, outerCoinMat, seatCount);
  outerCoinInst.count = seatCount;
  outerCoinInst.name = 'SalonSeatOuterCoinInstanced';
  outerCoinInst.raycast = () => {};
  root.add(outerCoinInst);

  const innerCoinGeo = new THREE.CylinderGeometry(0.68, 0.68, 1, 20);
  innerCoinGeo.rotateX(Math.PI * 0.5);
  const innerCoinMat = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
    fog: false,
  });
  const innerCoinInst = new THREE.InstancedMesh(innerCoinGeo, innerCoinMat, seatCount);
  innerCoinInst.count = seatCount;
  innerCoinInst.name = 'SalonSeatInnerCoinInstanced';
  innerCoinInst.raycast = () => {};
  root.add(innerCoinInst);

  const floorSpotIndicators = SALON_INTERIOR_SEAT_SPOTS.map((spot) => {
    const coinRoot = new THREE.Group();
    coinRoot.position.set(spot.x, spot.indicatorHeightY, spot.z);
    const blueCoin = new THREE.Group();
    const greenCoin = new THREE.Group();
    greenCoin.visible = false;
    coinRoot.add(blueCoin, greenCoin);
    return { coinRoot, blueCoin, greenCoin };
  });

  const coinPosTmp = new THREE.Vector3();
  const coinQuatTmp = new THREE.Quaternion();
  const coinScaleTmp = new THREE.Vector3();
  const coinMatTmp = new THREE.Matrix4();
  const coinYAxis = new THREE.Vector3(0, 1, 0);
  const blueOuter = new THREE.Color('#38bdf8');
  const blueInner = new THREE.Color('#7dd3fc');
  const greenOuter = new THREE.Color('#b8ff3c');
  const greenInner = new THREE.Color('#d9f99d');

  const syncSeatCoins = (timeSec: number, playerFloorY: number) => {
    const onSecondFloor = playerFloorY >= 1.95;
    for (let idx = 0; idx < seatCount; idx++) {
      const spot = SALON_INTERIOR_SEAT_SPOTS[idx];
      const entry = floorSpotIndicators[idx];
      const matchFloor = onSecondFloor === (spot.floorLevel === '2f');
      if (!entry.coinRoot.visible || !matchFloor) {
        coinPosTmp.set(spot.x, spot.indicatorHeightY, spot.z);
        coinQuatTmp.identity();
        coinScaleTmp.set(0, 0, 0);
        coinMatTmp.compose(coinPosTmp, coinQuatTmp, coinScaleTmp);
        outerCoinInst.setMatrixAt(idx, coinMatTmp);
        innerCoinInst.setMatrixAt(idx, coinMatTmp);
        continue;
      }
      const isGreen = entry.greenCoin.visible;
      const baseY = spot.indicatorHeightY;
      const posY = baseY + Math.sin(timeSec * 3.4 + idx * 0.9) * 0.024;
      const rotY = timeSec * 2.1 + idx * 0.6;
      const r = isGreen ? 0.165 : 0.142;
      const thick = isGreen ? 0.020 : 0.018;

      coinPosTmp.set(spot.x, posY, spot.z);
      coinQuatTmp.setFromAxisAngle(coinYAxis, rotY);

      coinScaleTmp.set(r, r, thick);
      coinMatTmp.compose(coinPosTmp, coinQuatTmp, coinScaleTmp);
      outerCoinInst.setMatrixAt(idx, coinMatTmp);
      outerCoinInst.setColorAt(idx, isGreen ? greenOuter : blueOuter);

      coinScaleTmp.set(r, r, thick + 0.003);
      coinMatTmp.compose(coinPosTmp, coinQuatTmp, coinScaleTmp);
      innerCoinInst.setMatrixAt(idx, coinMatTmp);
      innerCoinInst.setColorAt(idx, isGreen ? greenInner : blueInner);
    }
    outerCoinInst.instanceMatrix.needsUpdate = true;
    innerCoinInst.instanceMatrix.needsUpdate = true;
    if (outerCoinInst.instanceColor) outerCoinInst.instanceColor.needsUpdate = true;
    if (innerCoinInst.instanceColor) innerCoinInst.instanceColor.needsUpdate = true;
  };
  syncSeatCoins(0, 0);
  computeInstancedBoundingVolumes(outerCoinInst, { padding: 0.25, frustumCulled: true });
  computeInstancedBoundingVolumes(innerCoinInst, { padding: 0.25, frustumCulled: true });

  const updateVisuals = (
    timeSec: number,
    activeStationKind: SalonStationInteractionKind | null = null,
    playerFloorY = 0,
  ) => {
    const isNearExit = activeStationKind === 'exit_door';
    exitPad.pulseMat.color.set(isNearExit ? '#b8ff3c' : '#38bdf8');
    exitPad.innerDiscMat.color.set(isNearExit ? '#84cc16' : '#0ea5e9');
    exitPad.arrowMat.color.set(isNearExit ? '#b8ff3c' : '#38bdf8');
    exitPad.chevronArrow.scale.setScalar(isNearExit ? 1.14 : 1.0);
    exitPad.pulseMat.opacity = 0.55 + Math.sin(timeSec * 3.8) * 0.25;
    exitPad.chevronArrow.position.y = 0.65 + Math.sin(timeSec * 3.5) * 0.12;
    exitPad.chevronArrow.rotation.y = timeSec * 1.4;
    syncSeatCoins(timeSec, playerFloorY);
  };

  const ownedTextures: THREE.Texture[] = [
    oakTex,
    flutedTex,
    marbleTex,
    stuccoTex,
    metalTex,
    terrazzoTex,
    rugTex,
    glowStudioTex,
    beautyGlowTex,
  ];

  const dispose = () => {
    const disposedGeos = new Set<THREE.BufferGeometry>();
    const disposedMats = new Set<THREE.Material>();
    root.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry && !disposedGeos.has(m.geometry)) {
        disposedGeos.add(m.geometry);
        m.geometry.dispose();
      }
      if (m.material) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          if (!disposedMats.has(mat)) {
            disposedMats.add(mat);
            mat.dispose();
          }
        }
      }
    });
    for (const tex of ownedTextures) {
      tex.dispose();
    }
  };

  return {
    root,
    floorSpotIndicators,
    updateVisuals,
    dispose,
  };
}
