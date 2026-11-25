import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  getKioskWarmCanopyRoofTexture,
  getKioskWarmCedarPlankTexture,
} from './buddiesFashionKioskBuilder';
import { REAL_ESTATE_FURNITURE_KIOSK_LAYOUT } from './buddiesRealEstateKioskRules';
import { computeDeterministicWindowSeed, tagCityWindowMesh } from './buddiesNightLightingRules';

function makeRoundedReBox(w: number, h: number, d: number, r = 0.012, seg = 2): THREE.BufferGeometry {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w * 0.42, h * 0.42, d * 0.42));
}

export interface RealEstateKioskBuilderOptions {
  westPlantGroup: THREE.Group;
  isSoftwareGl: boolean;
  sharedClearGlassMat: THREE.Material;
  createMitredPolylineStripGeometry: (
    pts: [number, number][],
    width: number,
    height: number,
    closed?: boolean,
  ) => THREE.BufferGeometry;
  addLobbyPart: (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    colorHex: string,
    pos: [number, number, number],
    rot?: [number, number, number],
    toonStrokeWidth?: number,
    tex?: THREE.Texture,
    bumpScale?: number,
  ) => THREE.Mesh;
  createBlitzStrokeMesh: (
    geo: THREE.BufferGeometry,
    strokeWidth: number,
  ) => THREE.Mesh | null;
  textures: {
    steelRoofTex?: THREE.Texture;
    granitePaverTex?: THREE.Texture;
    verticalTimberTex?: THREE.Texture;
    timberTex?: THREE.Texture;
    concreteTex?: THREE.Texture;
    louverTex?: THREE.Texture;
  };
}

export interface KioskPartHelper {
  addPart(
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    colorHex: string,
    pos: [number, number, number],
    rot?: [number, number, number],
    toonStrokeWidth?: number,
    tex?: THREE.Texture,
    bumpScale?: number,
    castShad?: boolean,
  ): THREE.Mesh;
}

export type KioskLuminousPartFn = (
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  colorHex: string,
  emissiveHex: string,
  emissiveIntensity: number,
  pos: [number, number, number],
  rot?: [number, number, number],
  tex?: THREE.Texture,
) => THREE.Mesh;

let _cachedAFrameSignTex: THREE.Texture | null = null;
let _cachedBlueprintFrameTex: THREE.Texture | null = null;
let _cachedGalleryFrameTexes: [THREE.Texture, THREE.Texture, THREE.Texture] | null = null;
let _cachedCadScreenTex: THREE.Texture | null = null;

function createCanvas2D(w: number, h: number): {
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

function makeFallbackDataTex(r: number, g: number, b: number): THREE.DataTexture {
  const data = new Uint8Array([r, g, b, 255]);
  const tex = new THREE.DataTexture(data, 1, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Procedural Wooden A-Frame Sidewalk Sign Face (`REAL ESTATE & INTERIOR STUDIO`)
 * matching Quadrant 2 & Quadrant 4 of `screen_722f4ee5.png`.
 */
export function getRealEstateAFrameSignTexture(): THREE.Texture {
  if (_cachedAFrameSignTex) return _cachedAFrameSignTex;
  const { canvas, ctx } = createCanvas2D(256, 360);
  if (!ctx) {
    _cachedAFrameSignTex = makeFallbackDataTex(238, 231, 216);
    return _cachedAFrameSignTex;
  }

  // Warm cream architectural signboard background
  ctx.fillStyle = '#efe8d8';
  ctx.fillRect(0, 0, 256, 360);

  // Subtle double architectural hairline border
  ctx.strokeStyle = '#2c3138';
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, 228, 332);
  ctx.strokeStyle = '#8b6542';
  ctx.lineWidth = 2;
  ctx.strokeRect(23, 23, 210, 314);

  // Minimalist pitched-roof house emblem at top
  ctx.strokeStyle = '#262b32';
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(92, 78);
  ctx.lineTo(128, 48);
  ctx.lineTo(164, 78);
  ctx.stroke();
  ctx.strokeRect(102, 76, 52, 34);
  ctx.fillStyle = '#c28a54';
  ctx.fillRect(121, 90, 14, 20);

  // Bold editorial architectural lettering ("REAL ESTATE & INTERIOR STUDIO")
  ctx.fillStyle = '#1f242b';
  ctx.textAlign = 'center';
  ctx.font = '800 30px "Plus Jakarta Sans", "Barlow", sans-serif';
  ctx.fillText('REAL', 128, 156);
  ctx.fillText('ESTATE', 128, 192);

  // Divider rules + ampersand
  ctx.strokeStyle = '#8b6542';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(52, 218);
  ctx.lineTo(104, 218);
  ctx.moveTo(152, 218);
  ctx.lineTo(204, 218);
  ctx.stroke();

  ctx.fillStyle = '#8b5e34';
  ctx.font = '700 22px Georgia, serif';
  ctx.fillText('&', 128, 225);

  ctx.fillStyle = '#1f242b';
  ctx.font = '800 27px "Plus Jakarta Sans", "Barlow", sans-serif';
  ctx.fillText('INTERIOR', 128, 264);
  ctx.fillText('STUDIO', 128, 298);

  ctx.fillStyle = '#64748b';
  ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('HOMES • PLOTS • FURNITURE', 128, 324);

  const tex = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  _cachedAFrameSignTex = tex;
  return tex;
}

/**
 * Large Framed Master Architectural Floorplan Blueprint mounted behind the Consultation Desk
 * (matching Quadrant 1 Front Elevation View in `screen_722f4ee5.png`).
 */
export function getMasterFloorplanBlueprintTexture(): THREE.Texture {
  if (_cachedBlueprintFrameTex) return _cachedBlueprintFrameTex;
  const { canvas, ctx } = createCanvas2D(384, 256);
  if (!ctx) {
    _cachedBlueprintFrameTex = makeFallbackDataTex(244, 243, 238);
    return _cachedBlueprintFrameTex;
  }

  // Crisp gallery mat & architectural paper sheet
  ctx.fillStyle = '#f6f4ee';
  ctx.fillRect(0, 0, 384, 256);
  ctx.fillStyle = '#ebe6da';
  ctx.fillRect(22, 20, 340, 216);
  ctx.fillStyle = '#fcfbf7';
  ctx.fillRect(32, 28, 320, 200);

  // Subtle CAD grid
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.16)';
  ctx.lineWidth = 1;
  for (let gx = 48; gx < 344; gx += 16) {
    ctx.beginPath();
    ctx.moveTo(gx, 36);
    ctx.lineTo(gx, 220);
    ctx.stroke();
  }
  for (let gy = 44; gy < 220; gy += 16) {
    ctx.beginPath();
    ctx.moveTo(40, gy);
    ctx.lineTo(344, gy);
    ctx.stroke();
  }

  // Architectural 2-story villa floorplan walls & room partitions
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 4;
  ctx.strokeRect(58, 52, 206, 142);

  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(146, 52);
  ctx.lineTo(146, 142);
  ctx.moveTo(58, 128);
  ctx.lineTo(264, 128);
  ctx.moveTo(204, 128);
  ctx.lineTo(204, 194);
  ctx.stroke();

  // Door swing arcs & furniture silhouettes in blueprint
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(146, 108, 18, -Math.PI * 0.5, 0);
  ctx.stroke();
  ctx.strokeRect(74, 68, 48, 28);
  ctx.strokeRect(166, 66, 76, 42);

  // Title block on right column
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.strokeRect(278, 52, 60, 142);
  ctx.fillStyle = '#1e293b';
  ctx.font = '800 11px sans-serif';
  ctx.fillText('RESIDENCE', 284, 72);
  ctx.fillText('PLAN A-01', 284, 86);
  ctx.fillStyle = '#c28a54';
  ctx.fillRect(284, 98, 48, 6);
  ctx.fillStyle = '#64748b';
  ctx.font = '700 9px monospace';
  ctx.fillText('1:50 CAD', 284, 122);
  ctx.fillText('2-STORY', 284, 136);
  ctx.fillText('ESTATE', 284, 150);

  const tex = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  _cachedBlueprintFrameTex = tex;
  return tex;
}

/**
 * Row of 3 Framed Architectural & Interior Design Prints visible through the North Panoramic Side Glass
 * (matching Quadrant 2 Side Profile Elevation View in `screen_722f4ee5.png`).
 */
export function getInteriorGalleryPrintTextures(): [THREE.Texture, THREE.Texture, THREE.Texture] {
  if (_cachedGalleryFrameTexes) return _cachedGalleryFrameTexes;

  const buildPrint = (variant: 0 | 1 | 2): THREE.Texture => {
    const { canvas, ctx } = createCanvas2D(192, 240);
    if (!ctx) return makeFallbackDataTex(242, 239, 232);

    ctx.fillStyle = '#f8f6f0';
    ctx.fillRect(0, 0, 192, 240);
    ctx.strokeStyle = '#d6d0c4';
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 20, 156, 200);

    ctx.strokeStyle = '#262b33';
    ctx.lineWidth = 3;
    if (variant === 0) {
      // Elevation sketch of a modern 2-story house
      ctx.beginPath();
      ctx.moveTo(38, 118);
      ctx.lineTo(96, 72);
      ctx.lineTo(154, 118);
      ctx.stroke();
      ctx.strokeRect(48, 118, 96, 66);
      ctx.fillStyle = '#dce8f2';
      ctx.fillRect(60, 130, 28, 26);
      ctx.fillRect(104, 130, 28, 26);
      ctx.strokeRect(60, 130, 28, 26);
      ctx.strokeRect(104, 130, 28, 26);
    } else if (variant === 1) {
      // Site parcel & courtyard floorplan
      ctx.strokeRect(42, 54, 108, 128);
      ctx.fillStyle = '#d8ead2';
      ctx.fillRect(50, 62, 42, 46);
      ctx.strokeRect(50, 62, 42, 46);
      ctx.beginPath();
      ctx.moveTo(42, 124);
      ctx.lineTo(150, 124);
      ctx.moveTo(98, 62);
      ctx.lineTo(98, 182);
      ctx.stroke();
    } else {
      // Minimalist designer lounge chair & floor lamp interior vignette
      ctx.fillStyle = '#e9dfd0';
      ctx.fillRect(36, 48, 120, 136);
      ctx.fillStyle = '#8b5e34';
      ctx.beginPath();
      ctx.arc(88, 136, 26, 0, Math.PI, false);
      ctx.fill();
      ctx.strokeStyle = '#262b33';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(128, 170);
      ctx.quadraticCurveTo(132, 86, 100, 82);
      ctx.stroke();
    }

    ctx.fillStyle = '#475569';
    ctx.font = '700 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      variant === 0 ? 'VILLA ELEVATION' : variant === 1 ? 'ESTATE FLOORPLAN' : 'INTERIOR COLLECTION',
      96,
      204,
    );

    const tex = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  _cachedGalleryFrameTexes = [buildPrint(0), buildPrint(1), buildPrint(2)];
  return _cachedGalleryFrameTexes;
}

export function getConsultationMonitorScreenTexture(): THREE.Texture {
  if (_cachedCadScreenTex) return _cachedCadScreenTex;
  const { canvas, ctx } = createCanvas2D(256, 160);
  if (!ctx) {
    _cachedCadScreenTex = makeFallbackDataTex(30, 58, 95);
    return _cachedCadScreenTex;
  }

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 256, 160);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(10, 10, 164, 140);
  ctx.fillStyle = '#172554';
  ctx.fillRect(180, 10, 66, 140);

  // 3D wireframe house preview on CAD monitor
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(42, 78);
  ctx.lineTo(92, 42);
  ctx.lineTo(142, 78);
  ctx.stroke();
  ctx.strokeRect(52, 78, 80, 52);
  ctx.strokeStyle = '#b8ff3c';
  ctx.strokeRect(68, 94, 20, 36);
  ctx.strokeRect(100, 92, 20, 20);

  // Spec bars on right sidebar
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(188, 22, 50, 8);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(188, 40, 38, 6);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(188, 56, 46, 5);
  ctx.fillRect(188, 68, 42, 5);
  ctx.fillStyle = '#b8ff3c';
  ctx.fillRect(188, 126, 50, 14);

  const tex = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  _cachedCadScreenTex = tex;
  return tex;
}

/**
 * Builds the Compact Glass & Steel Real Estate & Furniture Showroom Kiosk
 * matching all 4 quadrants of `/public/assets/aistudio/screen_722f4ee5.png`:
 *  1. Front Elevation View: Stepped Granite Plaza Paver Base, Dark Charcoal Steel Frame,
 *     Cantilevered Canopy Roof + Integrated LED Spotlights, 2 Tempered Display Glass bays +
 *     Right Glass Entrance Door, Architectural 2-Story Real Estate Scale Model on display table,
 *     and Interior Consultation Desk with CAD monitor, 2 client stools & framed wall blueprint.
 *  2. Side Profile Elevation View (`+X` North Panoramic Glass Wall): 2 Side Glazing Panels +
 *     rear Timber Cladding Accents & lower louver grille, Interior Furniture Display (sculpted
 *     lounge armchair, round coffee side table, arched floor lamp & 3 framed architectural prints),
 *     plus outdoor wooden A-Frame Sidewalk Sign ("REAL ESTATE & INTERIOR STUDIO").
 *  3. Rear Elevation View (`-Z` West Wall): Solid Vertical Timber Cladding, Rear Staff Door,
 *     Exterior Ventilation Grille, and Electrical Utility Conduits + twin junction boxes.
 */
export function buildRealEstateArchitecturalScaleModel(
  parent: THREE.Object3D,
  partHelper: KioskPartHelper,
  addLuminousPart: KioskLuminousPartFn,
  pos: [number, number, number],
  textures: { timberTex?: THREE.Texture; concreteTex?: THREE.Texture },
): THREE.Group {
  const COL_OAK_LIGHT = '#d8ad7c';
  const COL_TIMBER_DARK = '#8c5a32';
  const scaleModelGrp = new THREE.Group();
  scaleModelGrp.name = 'RealEstateArchitecturalScaleModel';
  scaleModelGrp.position.set(pos[0], pos[1], pos[2]);
  parent.add(scaleModelGrp);

  partHelper.addPart(
    scaleModelGrp,
    makeRoundedReBox(1.34, 0.72, 0.80, 0.020),
    COL_OAK_LIGHT,
    [0, 0.36, 0],
    [0, 0, 0],
    0.008,
    textures.timberTex,
    1.2,
  );
  partHelper.addPart(
    scaleModelGrp,
    makeRoundedReBox(1.58, 0.07, 1.00, 0.018),
    '#ede8dc',
    [0, 0.755, 0],
    [0, 0, 0],
    0.008,
    textures.concreteTex,
    0.8,
  );
  partHelper.addPart(
    scaleModelGrp,
    makeRoundedReBox(1.42, 0.036, 0.86, 0.012),
    '#7fb069',
    [0, 0.808, 0],
    [0, 0, 0],
    0.006,
    undefined,
    0.6,
    false,
  );
  partHelper.addPart(
    scaleModelGrp,
    makeRoundedReBox(0.24, 0.016, 0.30, 0.005),
    '#dfd9cc',
    [0.08, 0.829, 0.27],
    [0, 0, 0],
    0,
    undefined,
    0.4,
    false,
  );
  partHelper.addPart(
    scaleModelGrp,
    makeRoundedReBox(0.36, 0.016, 0.26, 0.005),
    '#d4cfc2',
    [-0.34, 0.829, 0.28],
    [0, 0, 0],
    0,
    undefined,
    0.4,
    false,
  );

  const houseMinGrp = new THREE.Group();
  houseMinGrp.position.set(-0.02, 0.826, -0.03);
  scaleModelGrp.add(houseMinGrp);

  partHelper.addPart(houseMinGrp, makeRoundedReBox(0.82, 0.22, 0.46, 0.012), '#f8f5ec', [0.04, 0.11, -0.02], [0, 0, 0], 0.006);
  partHelper.addPart(houseMinGrp, makeRoundedReBox(0.32, 0.20, 0.24, 0.010), '#efeadd', [-0.31, 0.10, 0.14], [0, 0, 0], 0.005);
  partHelper.addPart(houseMinGrp, makeRoundedReBox(0.56, 0.20, 0.40, 0.012), '#fcfaf3', [0.12, 0.322, -0.02], [0, 0, 0], 0.006);

  const mainRoofGeo = new THREE.ConeGeometry(0.46, 0.17, 4);
  mainRoofGeo.rotateY(Math.PI / 4);
  mainRoofGeo.scale(1.06, 1.0, 0.78);
  partHelper.addPart(houseMinGrp, mainRoofGeo, '#464d57', [0.12, 0.508, -0.02], [0, 0, 0], 0.006);

  const lowerWingRoofGeo = new THREE.ConeGeometry(0.28, 0.12, 4);
  lowerWingRoofGeo.rotateY(Math.PI / 4);
  lowerWingRoofGeo.scale(0.96, 1.0, 0.78);
  partHelper.addPart(houseMinGrp, lowerWingRoofGeo, '#525a66', [-0.27, 0.255, 0.08], [0, 0, 0], 0.005);

  partHelper.addPart(houseMinGrp, new THREE.BoxGeometry(0.08, 0.13, 0.024), COL_TIMBER_DARK, [0.08, 0.07, 0.218], [0, 0, 0], 0.003, undefined, 0.4, false);
  for (const [wx, wy, wz] of [
    [0.27, 0.11, 0.218],
    [-0.07, 0.11, 0.218],
    [0.01, 0.322, 0.188],
    [0.24, 0.322, 0.188],
    [0.458, 0.12, -0.02],
    [0.408, 0.322, -0.02],
  ] as [number, number, number][]) {
    const isSideWin = wx > 0.39;
    addLuminousPart(
      houseMinGrp,
      new THREE.BoxGeometry(isSideWin ? 0.024 : 0.11, 0.085, isSideWin ? 0.12 : 0.024),
      '#fef3c7',
      '#fde68a',
      0.64,
      [wx, wy, wz],
    );
  }

  for (const [tx, tz, tr] of [
    [-0.56, -0.24, 0.105],
    [-0.58, 0.20, 0.088],
    [0.54, 0.22, 0.100],
    [0.56, -0.22, 0.090],
  ] as [number, number, number][]) {
    partHelper.addPart(
      scaleModelGrp,
      new THREE.CylinderGeometry(0.016, 0.020, 0.11, 6),
      '#7c5333',
      [tx, 0.875, tz],
      [0, 0, 0],
      0,
      undefined,
      0.4,
      false,
    );
    partHelper.addPart(
      scaleModelGrp,
      new THREE.SphereGeometry(tr, 10, 8),
      '#4f8a4b',
      [tx, 0.96 + tr * 0.35, tz],
      [0, 0, 0],
      0.004,
      undefined,
      0.5,
      false,
    );
  }
  partHelper.addPart(
    scaleModelGrp,
    makeRoundedReBox(1.24, 0.06, 0.065, 0.022),
    '#589454',
    [0, 0.848, -0.36],
    [0, 0, 0],
    0.003,
    undefined,
    0.4,
    false,
  );
  return scaleModelGrp;
}

export function buildRealEstateConsultationDeskZone(
  parent: THREE.Object3D,
  partHelper: KioskPartHelper,
  addLuminousPart: KioskLuminousPartFn,
  pos: [number, number, number],
  textures: { timberTex?: THREE.Texture },
): THREE.Group {
  const COL_STEEL = '#2b3036';
  const COL_TIMBER = '#c28a54';
  const COL_TIMBER_DARK = '#8c5a32';
  const COL_OAK_LIGHT = '#d8ad7c';
  const consultGrp = new THREE.Group();
  consultGrp.name = 'RealEstateConsultationDeskZone';
  consultGrp.position.set(pos[0], pos[1], pos[2]);
  parent.add(consultGrp);

  partHelper.addPart(
    consultGrp,
    makeRoundedReBox(1.42, 0.06, 0.64, 0.018),
    COL_OAK_LIGHT,
    [0, 0.75, 0],
    [0, 0, 0],
    0.008,
    textures.timberTex,
    1.2,
  );
  // Modesty panel rabbet-inset cleanly inside gables (top/bottom clear of side gable Y)
  partHelper.addPart(
    consultGrp,
    makeRoundedReBox(1.26, 0.64, 0.055, 0.012),
    COL_TIMBER,
    [0, 0.37, 0.26],
    [0, 0, 0],
    0.007,
    textures.timberTex,
    1.2,
  );
  for (const dxSide of [-0.66, 0.66]) {
    partHelper.addPart(
      consultGrp,
      makeRoundedReBox(0.07, 0.72, 0.60, 0.014),
      COL_TIMBER_DARK,
      [dxSide, 0.36, 0],
      [0, 0, 0],
      0.007,
      textures.timberTex,
      1.2,
    );
  }

  const monGrp = new THREE.Group();
  monGrp.position.set(0.32, 0.78, 0.04);
  monGrp.rotation.y = -0.24;
  consultGrp.add(monGrp);
  partHelper.addPart(monGrp, makeRoundedReBox(0.16, 0.018, 0.12, 0.006), '#94a3b8', [0, 0.009, 0], [0, 0, 0], 0.003, undefined, 0.4, false);
  partHelper.addPart(monGrp, makeRoundedReBox(0.04, 0.14, 0.03, 0.008), '#cbd5e1', [0, 0.08, -0.02], [-0.12, 0, 0], 0.003, undefined, 0.4, false);
  partHelper.addPart(monGrp, makeRoundedReBox(0.48, 0.31, 0.03, 0.010), '#1e293b', [0, 0.25, 0], [0, 0, 0], 0.006);
  addLuminousPart(
    monGrp,
    new THREE.PlaneGeometry(0.44, 0.27),
    '#ffffff',
    '#38bdf8',
    0.32,
    [0, 0.25, 0.018],
    [0, 0, 0],
    getConsultationMonitorScreenTexture(),
  );
  partHelper.addPart(consultGrp, makeRoundedReBox(0.26, 0.035, 0.19, 0.008), '#f8fafc', [-0.36, 0.795, 0.06], [0, 0.16, 0], 0.004, undefined, 0.4, false);
  partHelper.addPart(consultGrp, makeRoundedReBox(0.14, 0.16, 0.10, 0.012), COL_STEEL, [-0.52, 0.855, -0.08], [0, 0.22, 0], 0.004, undefined, 0.4, false);

  for (const stoolX of [-0.34, 0.34]) {
    const stGrp = new THREE.Group();
    stGrp.position.set(stoolX, 0, 0.56);
    consultGrp.add(stGrp);
    partHelper.addPart(stGrp, new THREE.CylinderGeometry(0.18, 0.19, 0.024, 14), '#94a3b8', [0, 0.014, 0], [0, 0, 0], 0.004, undefined, 0.4, false);
    partHelper.addPart(stGrp, new THREE.CylinderGeometry(0.026, 0.026, 0.48, 10), '#cbd5e1', [0, 0.26, 0], [0, 0, 0], 0.004, undefined, 0.4, false);
    partHelper.addPart(stGrp, new THREE.TorusGeometry(0.12, 0.012, 6, 16), '#94a3b8', [0, 0.22, 0], [Math.PI / 2, 0, 0], 0, undefined, 0.4, false);
    partHelper.addPart(
      stGrp,
      new THREE.CylinderGeometry(0.185, 0.175, 0.065, 16),
      COL_TIMBER,
      [0, 0.52, 0],
      [0, 0, 0],
      0.006,
      textures.timberTex,
      1.0,
    );
  }

  const agentChairGrp = new THREE.Group();
  agentChairGrp.position.set(0.18, 0, -0.42);
  consultGrp.add(agentChairGrp);
  partHelper.addPart(agentChairGrp, new THREE.CylinderGeometry(0.20, 0.20, 0.025, 12), '#334155', [0, 0.015, 0], [0, 0, 0], 0.004, undefined, 0.4, false);
  partHelper.addPart(agentChairGrp, new THREE.CylinderGeometry(0.028, 0.028, 0.42, 10), '#64748b', [0, 0.23, 0], [0, 0, 0], 0.004, undefined, 0.4, false);
  const backSpineCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.43, 0),
    new THREE.Vector3(0, 0.43, -0.17),
    new THREE.Vector3(0, 0.68, -0.19),
  ]);
  partHelper.addPart(agentChairGrp, new THREE.TubeGeometry(backSpineCurve, 10, 0.018, 8, false), '#64748b', [0, 0, 0], [0, 0, 0], 0.003, undefined, 0.4, false);
  partHelper.addPart(agentChairGrp, makeRoundedReBox(0.42, 0.065, 0.40, 0.020), '#3b424d', [0, 0.46, 0], [0, 0, 0], 0.006);
  partHelper.addPart(agentChairGrp, makeRoundedReBox(0.40, 0.44, 0.065, 0.020), '#3b424d', [0, 0.69, -0.18], [-0.08, 0, 0], 0.006);
  return consultGrp;
}

export function buildShowroomFurnitureLoungeVignette(
  parent: THREE.Object3D,
  partHelper: KioskPartHelper,
  addLuminousPart: KioskLuminousPartFn,
  pos: [number, number, number],
  textures: { timberTex?: THREE.Texture },
): THREE.Group {
  const COL_STEEL = '#2b3036';
  const COL_TIMBER_DARK = '#8c5a32';
  const COL_OAK_LIGHT = '#d8ad7c';
  const furnZoneGrp = new THREE.Group();
  furnZoneGrp.name = 'ShowroomInteriorFurnitureVignette';
  furnZoneGrp.position.set(pos[0], pos[1], pos[2]);
  parent.add(furnZoneGrp);

  partHelper.addPart(
    furnZoneGrp,
    new THREE.CylinderGeometry(0.68, 0.68, 0.014, 24),
    '#d9d2c3',
    [-0.04, 0.008, 0.02],
    [0, 0, 0],
    0.004,
    undefined,
    0.6,
    false,
  );

  const chairGrp = new THREE.Group();
  chairGrp.position.set(0.18, 0.016, -0.22);
  chairGrp.rotation.y = -0.52;
  furnZoneGrp.add(chairGrp);

  for (const [lx, lz, rx, rz] of [
    [-0.22, -0.20, -0.18, 0.16],
    [0.22, -0.20, -0.18, -0.16],
    [-0.22, 0.20, 0.18, 0.16],
    [0.22, 0.20, 0.18, -0.16],
  ] as [number, number, number, number][]) {
    partHelper.addPart(
      chairGrp,
      new THREE.CylinderGeometry(0.020, 0.013, 0.34, 8),
      COL_TIMBER_DARK,
      [lx, 0.17, lz],
      [rx, 0, rz],
      0.004,
      undefined,
      0.5,
      false,
    );
  }
  partHelper.addPart(chairGrp, makeRoundedReBox(0.58, 0.13, 0.54, 0.045, 3), '#59626e', [0, 0.365, 0.02], [0.04, 0, 0], 0.007);
  partHelper.addPart(chairGrp, makeRoundedReBox(0.56, 0.48, 0.13, 0.045, 3), '#4b535e', [0, 0.60, -0.20], [-0.24, 0, 0], 0.007);
  for (const armS of [-1, 1]) {
    partHelper.addPart(
      chairGrp,
      makeRoundedReBox(0.10, 0.21, 0.48, 0.036, 3),
      '#525b67',
      [armS * 0.28, 0.495, -0.01],
      [0.05, 0, armS * -0.08],
      0.006,
    );
  }
  partHelper.addPart(chairGrp, makeRoundedReBox(0.32, 0.18, 0.09, 0.035, 3), '#d4a373', [0, 0.49, -0.11], [-0.20, 0, 0], 0.005);

  const sideTableGrp = new THREE.Group();
  sideTableGrp.position.set(-0.24, 0.016, 0.24);
  furnZoneGrp.add(sideTableGrp);
  partHelper.addPart(
    sideTableGrp,
    new THREE.CylinderGeometry(0.28, 0.27, 0.04, 20),
    COL_OAK_LIGHT,
    [0, 0.39, 0],
    [0, 0, 0],
    0.006,
    textures.timberTex,
    1.1,
  );
  partHelper.addPart(
    sideTableGrp,
    new THREE.CylinderGeometry(0.20, 0.20, 0.02, 16),
    COL_TIMBER_DARK,
    [0, 0.12, 0],
    [0, 0, 0],
    0.004,
  );
  for (const ang of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
    partHelper.addPart(
      sideTableGrp,
      new THREE.CylinderGeometry(0.018, 0.015, 0.38, 8),
      COL_TIMBER_DARK,
      [Math.cos(ang) * 0.19, 0.195, Math.sin(ang) * 0.19],
      [0, 0, 0],
      0.004,
      undefined,
      0.5,
      false,
    );
  }
  partHelper.addPart(sideTableGrp, new THREE.BoxGeometry(0.18, 0.028, 0.14), '#f8fafc', [-0.04, 0.424, 0.02], [0, 0.28, 0], 0.003, undefined, 0.4, false);
  partHelper.addPart(sideTableGrp, new THREE.CylinderGeometry(0.032, 0.028, 0.06, 10), '#e2e8f0', [0.10, 0.44, -0.05], [0, 0, 0], 0.003, undefined, 0.4, false);

  const lampGrp = new THREE.Group();
  lampGrp.position.set(0.32, 0.016, -0.58);
  lampGrp.rotation.y = -0.35;
  furnZoneGrp.add(lampGrp);
  partHelper.addPart(lampGrp, new THREE.CylinderGeometry(0.15, 0.16, 0.03, 16), COL_STEEL, [0, 0.016, 0], [0, 0, 0], 0.005);
  const lampCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.03, 0),
    new THREE.Vector3(0, 0.95, 0.02),
    new THREE.Vector3(-0.04, 1.54, 0.18),
    new THREE.Vector3(-0.10, 1.66, 0.44),
  ]);
  partHelper.addPart(
    lampGrp,
    new THREE.TubeGeometry(lampCurve, 18, 0.016, 8, false),
    '#475569',
    [0, 0, 0],
    [0, 0, 0],
    0.004,
    undefined,
    0.4,
    false,
  );
  partHelper.addPart(
    lampGrp,
    new THREE.ConeGeometry(0.16, 0.20, 16),
    '#f5efe2',
    [-0.10, 1.58, 0.46],
    [0.24, 0, 0],
    0.005,
    undefined,
    0.4,
    false,
  );
  addLuminousPart(
    lampGrp,
    new THREE.SphereGeometry(0.055, 10, 8),
    '#fffbeb',
    '#fde68a',
    0.78,
    [-0.10, 1.51, 0.47],
  );
  return furnZoneGrp;
}

export function buildRealEstateAndFurnitureKiosk3D(
  opts: RealEstateKioskBuilderOptions,
): THREE.Group {
  const COL_STEEL = '#46484d';
  const COL_STEEL_DARK = '#36383d';
  const COL_TIMBER = '#cc935a';
  const COL_TIMBER_DARK = '#99643a';
  const COL_GRANITE_OUTER = '#d3cdc2';
  const COL_GRANITE_INNER = '#eae3d6';
  const COL_WARM_WALL = '#f5efe4';
  const COL_LED_WARM = '#ffefc2';
  const cedarPlankTex = opts.textures.verticalTimberTex ?? getKioskWarmCedarPlankTexture();
  const warmTimberTex = opts.textures.timberTex ?? cedarPlankTex;
  const canopyRoofTex = opts.textures.steelRoofTex ?? getKioskWarmCanopyRoofTexture();

  const kioskGrp = new THREE.Group();
  kioskGrp.name = 'LobbyRealEstateAndFurnitureKiosk';
  kioskGrp.position.set(
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.kioskLocalX,
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.kioskLocalY,
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.kioskLocalZ,
  );
  kioskGrp.rotation.y = REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.kioskRotY;
  kioskGrp.scale.setScalar(REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.kioskScale);
  opts.westPlantGroup.add(kioskGrp);

  const partHelper: KioskPartHelper = {
    addPart(
      parent,
      geo,
      colorHex,
      pos,
      rot = [0, 0, 0],
      toonStrokeWidth = 0.008,
      tex,
      bumpScale = 1.35,
      castShad = true,
    ) {
      void toonStrokeWidth;
      const mesh = opts.addLobbyPart(parent, geo, colorHex, pos, rot, 0, tex, bumpScale);
      mesh.castShadow = !opts.isSoftwareGl && castShad;
      mesh.receiveShadow = !opts.isSoftwareGl;
      return mesh;
    },
  };

  const addLuminousPart = (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    colorHex: string,
    emissiveHex: string,
    emissiveIntensity: number,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
    tex?: THREE.Texture,
  ): THREE.Mesh => {
    const mesh = partHelper.addPart(parent, geo, colorHex, pos, rot, 0, tex, 0.4, false);
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (mat && 'emissive' in mat && mat.emissive instanceof THREE.Color) {
      mat.emissive.set(emissiveHex);
      mat.emissiveIntensity = emissiveIntensity;
    }
    return mesh;
  };

  let glassPaneCounter = 0;
  const addGlassPane = (
    parent: THREE.Object3D,
    w: number,
    h: number,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
    windowId?: string,
  ): THREE.Mesh => {
    const id = windowId ?? `realestate_kiosk_storefront_${glassPaneCounter++}`;
    const gMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), opts.sharedClearGlassMat);
    gMesh.name = `RealEstateKioskStorefrontGlass_${id}`;
    gMesh.position.set(pos[0], pos[1], pos[2]);
    gMesh.rotation.set(rot[0], rot[1], rot[2]);
    gMesh.castShadow = false;
    gMesh.receiveShadow = false;
    tagCityWindowMesh(gMesh, {
      id,
      kind: 'storefront',
      seed: computeDeterministicWindowSeed(id),
      baseColorHex: '#d6f4ff',
      baseOpacity: 0.30,
    });
    parent.add(gMesh);
    return gMesh;
  };

  // =========================================================================
  // 1. STEPPED GRANITE PLAZA PAVER BASE & MITRED DARK CHARCOAL STEEL PLINTH
  //    (Strictly disjoint Y heights so zero coplanar faces ever Z-fight)
  // =========================================================================
  // Outer Granite Plaza Paver Apron (`y in [0.005 .. 0.075]`, `5.18m W x 4.12m D`)
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(
      REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.granitePaverBaseWidthLocal,
      0.070,
      REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.granitePaverBaseDepthLocal,
    ),
    COL_GRANITE_OUTER,
    [0, 0.040, 0.14],
    [0, 0, 0],
    0.009,
    opts.textures.granitePaverTex,
    1.5,
    false,
  );

  // Mitred Dark Charcoal Steel Perimeter Curb (`y in [0.076 .. 0.216]`)
  const perimeterCurbPath: [number, number][] = [
    [-2.13, -1.53],
    [2.13, -1.53],
    [2.13, 1.53],
    [-2.13, 1.53],
  ];
  partHelper.addPart(
    kioskGrp,
    opts.createMitredPolylineStripGeometry(perimeterCurbPath, 0.22, 0.14, true),
    COL_STEEL,
    [0, 0.146, 0],
    [0, 0, 0],
    0.010,
    opts.textures.steelRoofTex,
  );

  // Interior Warm Travertine / Stone Showroom Floor (`y in [0.080 .. 0.220]`, top at `y = 0.220`)
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(4.02, 0.14, 2.82),
    COL_GRANITE_INNER,
    [0, 0.150, 0],
    [0, 0, 0],
    0,
    opts.textures.granitePaverTex,
    1.1,
    false,
  );

  // 4 Corner Structural Dark Charcoal Steel Columns + Upper Mitred Steel Architrave Ring
  for (const cx of [-2.14, 2.14]) {
    for (const cz of [-1.54, 1.54]) {
      partHelper.addPart(
        kioskGrp,
        new THREE.BoxGeometry(0.20, 2.58, 0.20),
        COL_STEEL,
        [cx, 1.51, cz],
        [0, 0, 0],
        0.011,
        opts.textures.steelRoofTex,
      );
    }
  }
  const topRingPath: [number, number][] = [
    [-2.14, -1.54],
    [2.14, -1.54],
    [2.14, 1.54],
    [-2.14, 1.54],
  ];
  partHelper.addPart(
    kioskGrp,
    opts.createMitredPolylineStripGeometry(topRingPath, 0.18, 0.14, true),
    COL_STEEL,
    [0, 2.74, 0],
    [0, 0, 0],
    0.010,
    opts.textures.steelRoofTex,
  );

  // Warm Interior Ceiling Soffit Panel with 6 Recessed Showroom Downlights (visible through glass)
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(4.04, 0.04, 2.84),
    '#f6f2e8',
    [0, 2.68, 0],
    [0, 0, 0],
    0,
    undefined,
    0.4,
    false,
  );
  for (const lx of [-1.25, 0.0, 1.25]) {
    for (const lz of [-0.55, 0.65]) {
      addLuminousPart(
        kioskGrp,
        new THREE.CylinderGeometry(0.065, 0.065, 0.02, 10),
        COL_LED_WARM,
        '#ffe59e',
        0.62,
        [lx, 2.655, lz],
      );
    }
  }

  // =========================================================================
  // 2. FRONT ELEVATION (`+Z = +1.54`, QUADRANT 1):
  //    2 Tempered Display Glass Bays (Left & Center) + Right Glass Entrance Door
  // =========================================================================
  for (const mx of [-0.72, 0.72]) {
    partHelper.addPart(
      kioskGrp,
      new THREE.BoxGeometry(0.11, 2.52, 0.14),
      COL_STEEL,
      [mx, 1.48, 1.54],
      [0, 0, 0],
      0.009,
      opts.textures.steelRoofTex,
    );
  }
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(2.86, 0.06, 0.12),
    COL_STEEL,
    [-0.71, 0.245, 1.54],
    [0, 0, 0],
    0.007,
  );
  addGlassPane(kioskGrp, 1.25, 2.38, [-1.41, 1.47, 1.54], [0, 0, 0], 'realestate_front_left');
  addGlassPane(kioskGrp, 1.32, 2.38, [0.0, 1.47, 1.54], [0, 0, 0], 'realestate_front_center');

  // Right Bay Framed Glass Entrance Door (`x in [+0.78 .. +2.04]`) + Brushed Steel Pull Handle
  partHelper.addPart(kioskGrp, new THREE.BoxGeometry(0.08, 2.40, 0.09), '#383f49', [0.82, 1.42, 1.54], [0, 0, 0], 0.007);
  partHelper.addPart(kioskGrp, new THREE.BoxGeometry(0.08, 2.40, 0.09), '#383f49', [2.00, 1.42, 1.54], [0, 0, 0], 0.007);
  partHelper.addPart(kioskGrp, new THREE.BoxGeometry(1.24, 0.09, 0.09), '#383f49', [1.41, 2.58, 1.54], [0, 0, 0], 0.007);
  partHelper.addPart(kioskGrp, new THREE.BoxGeometry(1.24, 0.08, 0.09), '#383f49', [1.41, 0.25, 1.54], [0, 0, 0], 0.007);
  addGlassPane(kioskGrp, 1.09, 2.22, [1.41, 1.415, 1.54], [0, 0, 0], 'realestate_front_door');
  // Vertical architectural stainless tubular door pull handle + lock escutcheon
  partHelper.addPart(
    kioskGrp,
    new THREE.CylinderGeometry(0.018, 0.018, 0.44, 10),
    '#e2e8f0',
    [0.93, 1.24, 1.60],
    [0, 0, 0],
    0.004,
    undefined,
    0.4,
    false,
  );
  for (const hy of [1.06, 1.42]) {
    partHelper.addPart(
      kioskGrp,
      new THREE.BoxGeometry(0.03, 0.03, 0.07),
      '#cbd5e1',
      [0.93, hy, 1.57],
      [0, 0, 0],
      0.003,
      undefined,
      0.4,
      false,
    );
  }

  // =========================================================================
  // 3. SIDE ELEVATIONS (`+X` NORTH PANORAMIC GLASS & TIMBER ACCENT, `-X` SOUTH GLAZING + TIMBER):
  //    Matches Quadrant 2 (Side Profile) & Quadrant 4 (3/4 Isometric View)
  // =========================================================================
  // North Side (`+X = +2.14`): 2 Front/Center Panoramic Glass Bays (`z in [-0.46 .. +1.44]`) +
  // Rear Vertical Timber Cladding Accent Bay (`z in [-1.44 .. -0.54]`) with lower ventilation louver!
  for (const mz of [-0.50, 0.48]) {
    partHelper.addPart(
      kioskGrp,
      new THREE.BoxGeometry(0.14, 2.52, 0.11),
      COL_STEEL,
      [2.14, 1.48, mz],
      [0, 0, 0],
      0.009,
      opts.textures.steelRoofTex,
    );
  }
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(0.12, 0.06, 1.94),
    COL_STEEL,
    [2.14, 0.245, 0.48],
    [0, 0, 0],
    0.007,
  );
  addGlassPane(kioskGrp, 0.89, 2.38, [2.14, 1.47, 0.99], [0, Math.PI / 2, 0], 'realestate_north_front');
  addGlassPane(kioskGrp, 0.86, 2.38, [2.14, 1.47, -0.01], [0, Math.PI / 2, 0], 'realestate_north_center');
  // Rear bay Timber Cladding Accent on `+X` side + lower louver grille (exact Quadrant 4 isometric match!)
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(0.14, 2.48, 0.88),
    COL_TIMBER,
    [2.12, 1.46, -1.00],
    [0, 0, 0],
    0.010,
    cedarPlankTex,
    1.5,
  );
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(0.05, 0.48, 0.56),
    '#47505c',
    [2.20, 0.62, -1.00],
    [0, 0, 0],
    0.007,
    opts.textures.louverTex,
    1.0,
  );

  // South Side (`-X = -2.14`): Front Display Glass Bay (`z in [+0.18 .. +1.44]`) +
  // Warm Interior/Exterior Vertical Timber Cladding Feature Wall (`z in [-1.44 .. +0.10]`, visible in Quadrant 1 left window!)
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(0.14, 2.52, 0.11),
    COL_STEEL,
    [-2.14, 1.48, 0.14],
    [0, 0, 0],
    0.009,
    opts.textures.steelRoofTex,
  );
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(0.12, 0.06, 1.26),
    COL_STEEL,
    [-2.14, 0.245, 0.82],
    [0, 0, 0],
    0.007,
  );
  addGlassPane(kioskGrp, 1.23, 2.38, [-2.14, 1.47, 0.82], [0, -Math.PI / 2, 0], 'realestate_south_front');
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(0.16, 2.48, 1.54),
    COL_TIMBER,
    [-2.10, 1.46, -0.68],
    [0, 0, 0],
    0.010,
    cedarPlankTex,
    1.5,
  );

  // =========================================================================
  // 4. REAR ELEVATION (`-Z = -1.52`, QUADRANT 3):
  //    Solid Vertical Timber Cladding, Rear Staff Door, Exterior Ventilation Grille & Conduits
  // =========================================================================
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(4.06, 2.52, 0.16),
    COL_TIMBER,
    [0, 1.48, -1.52],
    [0, 0, 0],
    0.012,
    cedarPlankTex,
    1.6,
  );
  // Warm Interior Gallery Drywall Partition lining the front face of the rear wall (`z = -1.39`)
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(3.96, 2.44, 0.06),
    COL_WARM_WALL,
    [0, 1.44, -1.39],
    [0, 0, 0],
    0.006,
    opts.textures.concreteTex,
    0.5,
    false,
  );

  // Rear Staff Door (`x = -1.02` -> right side when viewing Rear Elevation)
  partHelper.addPart(kioskGrp, new THREE.BoxGeometry(1.16, 2.16, 0.04), COL_STEEL, [-1.02, 1.30, -1.62], [0, 0, 0], 0.010);
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(1.02, 2.04, 0.04),
    '#cfd4dc',
    [-1.02, 1.30, -1.66],
    [0, 0, 0],
    0.008,
    opts.textures.concreteTex,
    1.6,
  );
  partHelper.addPart(kioskGrp, new THREE.BoxGeometry(0.15, 0.045, 0.06), COL_STEEL, [-0.62, 1.22, -1.70], [0, 0, 0], 0.005);

  // Exterior Ventilation Grille (`x = +1.18` -> lower-left when viewing Rear Elevation)
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(0.84, 0.72, 0.06),
    '#47505c',
    [1.18, 0.68, -1.63],
    [0, 0, 0],
    0.010,
    opts.textures.louverTex,
    1.0,
  );

  // Surface-Mounted Electrical Utility Conduits & Twin Junction Boxes (Quadrant 3)
  partHelper.addPart(
    kioskGrp,
    new THREE.CylinderGeometry(0.024, 0.024, 2.34, 8),
    '#64748b',
    [0.32, 1.48, -1.63],
    [0, 0, 0],
    0.005,
    undefined,
    0.6,
    false,
  );
  partHelper.addPart(
    kioskGrp,
    new THREE.CylinderGeometry(0.020, 0.020, 0.78, 8),
    '#64748b',
    [0.71, 0.34, -1.63],
    [0, 0, Math.PI / 2],
    0.005,
    undefined,
    0.6,
    false,
  );
  for (const jbx of [0.06, 0.32]) {
    partHelper.addPart(
      kioskGrp,
      new THREE.BoxGeometry(0.16, 0.22, 0.08),
      '#94a3b8',
      [jbx, 0.46, -1.63],
      [0, 0, 0],
      0.006,
      undefined,
      0.6,
      false,
    );
    partHelper.addPart(
      kioskGrp,
      new THREE.CylinderGeometry(0.018, 0.018, 0.30, 6),
      '#475569',
      [jbx, 0.21, -1.63],
      [0, 0, 0],
      0,
      undefined,
      0.6,
      false,
    );
  }

  // =========================================================================
  // 5. CANTILEVERED SLOPED CANOPY ROOF & INTEGRATED WARM LED SPOTLIGHTS
  // =========================================================================
  const roofGrp = new THREE.Group();
  roofGrp.position.set(0, 2.84, 0.14);
  roofGrp.rotation.x = -0.055; // Higher at front (+Z), sloping gently down toward rear (-Z)
  kioskGrp.add(roofGrp);

  partHelper.addPart(
    roofGrp,
    new THREE.BoxGeometry(5.16, 0.18, 4.18),
    COL_STEEL,
    [0, 0.04, 0],
    [0, 0, 0],
    0.013,
    canopyRoofTex,
    2.2,
  );
  partHelper.addPart(roofGrp, new THREE.BoxGeometry(5.26, 0.06, 4.28), COL_STEEL_DARK, [0, 0.15, 0], [0, 0, 0], 0.010, canopyRoofTex, 2.0);
  partHelper.addPart(roofGrp, new THREE.BoxGeometry(4.92, 0.04, 3.94), '#574b41', [0, -0.06, 0], [0, 0, 0], 0.008, warmTimberTex, 1.4);

  // Recessed Warm LED Spotlights along Front & Side Canopy Overhang Soffit
  for (const sx of [-1.85, -0.62, 0.62, 1.85]) {
    for (const sz of [1.72, -1.72]) {
      addLuminousPart(
        roofGrp,
        new THREE.CylinderGeometry(0.075, 0.075, 0.028, 10),
        COL_LED_WARM,
        '#ffe59e',
        0.68,
        [sx, -0.082, sz],
      );
    }
  }
  for (const szSide of [-0.58, 0.58]) {
    for (const sxSide of [-2.26, 2.26]) {
      addLuminousPart(
        roofGrp,
        new THREE.CylinderGeometry(0.070, 0.070, 0.028, 10),
        COL_LED_WARM,
        '#ffe59e',
        0.68,
        [sxSide, -0.082, szSide],
      );
    }
  }

  // =========================================================================
  // 6. INTERIOR ZONE A: REAL ESTATE ARCHITECTURAL SCALE MODEL (`Maket Rumah 2-Lantai`)
  //    Centered behind the Front-Left / Center Display Window (`x = -1.06, z = 0.68`)
  // =========================================================================
  buildRealEstateArchitecturalScaleModel(
    kioskGrp,
    partHelper,
    addLuminousPart,
    [-1.06, 0.22, 0.68],
    opts.textures,
  );

  // =========================================================================
  // 7. INTERIOR ZONE B: REAL ESTATE CONSULTATION DESK, CAD MONITOR, STOOLS & BLUEPRINT
  //    Positioned behind the Center-Right Front Bay (`x = 0.72, z = -0.58`)
  // =========================================================================
  buildRealEstateConsultationDeskZone(
    kioskGrp,
    partHelper,
    addLuminousPart,
    [0.62, 0.22, -0.58],
    opts.textures,
  );

  // Large Framed Master Architectural Floorplan Blueprint on Rear Interior Wall (`z = -1.34`, Quadrant 1)
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(1.42, 0.96, 0.05),
    COL_STEEL,
    [0.52, 1.72, -1.34],
    [0, 0, 0],
    0.008,
  );
  partHelper.addPart(
    kioskGrp,
    new THREE.PlaneGeometry(1.32, 0.86),
    '#ffffff',
    [0.52, 1.72, -1.31],
    [0, 0, 0],
    0,
    getMasterFloorplanBlueprintTexture(),
    0.2,
    false,
  );

  // =========================================================================
  // 8. INTERIOR ZONE C: FURNITURE SHOWROOM VIGNETTE (VISIBLE THROUGH `+X` SIDE GLASS)
  //    Sculpted Mid-Century Lounge Armchair + Round Walnut Coffee Table +
  //    Arched Floor Lamp + Row of 3 Framed Architectural/Interior Wall Prints
  //    (Exact Quadrant 2 Side Profile & Quadrant 4 Isometric Match!)
  // =========================================================================
  buildShowroomFurnitureLoungeVignette(
    kioskGrp,
    partHelper,
    addLuminousPart,
    [1.36, 0.22, 0.56],
    opts.textures,
  );

  // Row of 3 Framed Architectural / Interior Design Prints visible through `+X` Panoramic Side Glass (Quadrant 2)
  // Mounted along an interior gallery display rail/wall facing `+X` (`x = -0.18, y = 1.64, z in [-0.42, 0.12, 0.66]`)
  const galleryTexes = getInteriorGalleryPrintTextures();
  partHelper.addPart(
    kioskGrp,
    new THREE.BoxGeometry(0.08, 2.38, 1.68),
    COL_WARM_WALL,
    [-0.26, 1.41, 0.12],
    [0, 0, 0],
    0.007,
    opts.textures.concreteTex,
    0.5,
  );
  const frameZOffsets = [-0.40, 0.12, 0.64];
  for (let i = 0; i < 3; i++) {
    const fz = frameZOffsets[i];
    partHelper.addPart(
      kioskGrp,
      new THREE.BoxGeometry(0.04, 0.56, 0.42),
      COL_STEEL,
      [-0.20, 1.66, fz],
      [0, 0, 0],
      0.006,
    );
    partHelper.addPart(
      kioskGrp,
      new THREE.PlaneGeometry(0.36, 0.50),
      '#ffffff',
      [-0.176, 1.66, fz],
      [0, Math.PI / 2, 0],
      0,
      galleryTexes[i],
      0.2,
      false,
    );
  }

  // =========================================================================
  // 9. OUTDOOR WOODEN A-FRAME SIDEWALK SIGN ("REAL ESTATE & INTERIOR STUDIO")
  //    Planted on the front-right Granite Plaza Paver Base (`x = 1.88, y = 0.075, z = 1.94`)
  //    Matches Quadrant 2 Side Profile & Quadrant 4 3/4 Isometric View
  // =========================================================================
  const signGrp = new THREE.Group();
  signGrp.name = 'RealEstateAFrameSidewalkSign';
  signGrp.position.set(
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.aFrameSignLocal.x,
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.aFrameSignLocal.y,
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.aFrameSignLocal.z,
  );
  signGrp.rotation.y = REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.aFrameSignLocal.rotY;
  kioskGrp.add(signGrp);

  const signFaceTex = getRealEstateAFrameSignTexture();
  for (const sideZ of [-1, 1]) {
    const tiltRad = sideZ * 0.19;
    const panelZ = sideZ * 0.115;
    // Warm timber A-frame outer board + legs extending cleanly to `y = 0` on the granite base
    partHelper.addPart(
      signGrp,
      new THREE.BoxGeometry(0.60, 0.86, 0.042),
      COL_TIMBER_DARK,
      [0, 0.48, panelZ],
      [-tiltRad, 0, 0],
      0.007,
      opts.textures.timberTex,
      1.2,
    );
    for (const legX of [-0.26, 0.26]) {
      partHelper.addPart(
        signGrp,
        new THREE.BoxGeometry(0.055, 0.14, 0.042),
        COL_TIMBER_DARK,
        [legX, 0.068, sideZ * 0.19],
        [-tiltRad, 0, 0],
        0.005,
        opts.textures.timberTex,
        1.0,
      );
    }
    // Cream signboard insert with crisp `REAL ESTATE & INTERIOR STUDIO` typography on both faces
    partHelper.addPart(
      signGrp,
      new THREE.PlaneGeometry(0.50, 0.72),
      '#ffffff',
      [0, 0.49, panelZ + sideZ * 0.024],
      sideZ > 0 ? [-tiltRad, 0, 0] : [tiltRad, Math.PI, 0],
      0,
      signFaceTex,
      0.2,
      false,
    );
  }
  // Brass / steel spreader hinge bar between A-frame legs
  partHelper.addPart(
    signGrp,
    new THREE.BoxGeometry(0.50, 0.02, 0.24),
    COL_STEEL,
    [0, 0.24, 0],
    [0, 0, 0],
    0.003,
    undefined,
    0.4,
    false,
  );

  return kioskGrp;
}
