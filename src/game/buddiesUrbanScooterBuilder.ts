import * as THREE from 'three';
import {
  ELECTRIC_SCOOTER_BIKE_SPEC,
  PUSH_KICK_SCOOTER_SPEC,
  URBAN_SCOOTER_SHOP_LAYOUT,
  computeScooterWheelSpinDeltaRad,
} from './buddiesUrbanScooterRules';

export interface ScooterPartFinish {
  roughness?: number;
  metalness?: number;
}

export interface ScooterToonPartHelper {
  addPart: (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    colorHex: string,
    pos: [number, number, number],
    rot?: [number, number, number],
    toonStrokeWidth?: number,
    tex?: THREE.Texture,
    bumpScale?: number,
    castShad?: boolean,
    finish?: ScooterPartFinish,
  ) => THREE.Mesh;
  isSoftwareGl?: boolean;
}

export interface CreateScooterModelOptions {
  /** Optional world/lobby toon part builder so world showcase meshes match Blitz toon shading. */
  partHelper?: ScooterToonPartHelper;
  /** Whether the kickstand is deployed (`true` for parked showcase, `false` when ridden). */
  parked?: boolean;
  /** Initial handlebar steering yaw in radians. */
  steerAngleRad?: number;
  /** Include soft ground contact shadow disc at `y = 0.008` (default `true`). */
  includeContactShadow?: boolean;
  /** Custom primary body color override (defaults to model-sheet Pearl White / Satin Silver). */
  bodyColorHex?: string;
  /** Custom pinstripe accent color override (defaults to model-sheet Cyan/Teal `#14b8a6`). */
  accentColorHex?: string;
}

export interface CreatePushKickScooterOptions extends CreateScooterModelOptions {
  /** Render in compact folded state (`85cm x 32cm` with carrying strap, per Quadrant 3 of sheet). */
  folded?: boolean;
}

export interface ElectricScooterBike3DHandle {
  root: THREE.Group;
  chassisGroup: THREE.Group;
  steeringGroup: THREE.Group;
  frontWheelGroup: THREE.Group;
  rearWheelGroup: THREE.Group;
  kickstandGroup: THREE.Group;
  brakeLightMesh: THREE.Mesh;
  setParked: (parked: boolean) => void;
  setSteerAngle: (angleRad: number) => void;
  setBraking: (braking: boolean) => void;
  spinWheels: (forwardDistanceM: number, worldScale?: number) => void;
}

export interface PushKickScooter3DHandle {
  root: THREE.Group;
  deckGroup: THREE.Group;
  leanGroup: THREE.Group;
  foldingNeckGroup: THREE.Group;
  steeringGroup: THREE.Group;
  frontWheelGroup: THREE.Group;
  rearWheelGroup: THREE.Group;
  kickstandGroup: THREE.Group;
  carryingStrapGroup: THREE.Group;
  setParked: (parked: boolean) => void;
  setFolded: (folded: boolean) => void;
  setSteerAngle: (angleRad: number) => void;
  spinWheels: (forwardDistanceM: number, worldScale?: number) => void;
}

export interface BuildUrbanScooterShowroomOptions {
  westPlantGroup: THREE.Group;
  isSoftwareGl: boolean;
  sharedClearGlassMat: THREE.Material;
  createMitredPolylineStripGeometry: (
    pts: [number, number][],
    width: number,
    height: number,
    closedLoop?: boolean,
  ) => THREE.BufferGeometry;
  addLobbyPart: (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    colorHex: string,
    pos: [number, number, number],
    rot?: [number, number, number],
    bevel?: number,
    tex?: THREE.Texture,
    bumpScale?: number,
  ) => THREE.Mesh;
  createBlitzStrokeMesh: (
    sourceGeometry: THREE.BufferGeometry,
    strokeWidth?: number,
    strokeColorHex?: string,
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

// Cached procedural CanvasTextures so world & studio scooter instances share memory cleanly
let cachedContactShadowTex: THREE.Texture | null = null;
let cachedCockpitLcdTex: THREE.Texture | null = null;
let cachedKickGripDeckTex: THREE.Texture | null = null;
let cachedElectricFloorMatTex: THREE.Texture | null = null;
let cachedFrontShieldTex: THREE.Texture | null = null;
let cachedHeadlampBarTex: THREE.Texture | null = null;
let cachedSideCowlTex: THREE.Texture | null = null;
let cachedSaddleLeatherTex: THREE.Texture | null = null;
let cachedTireTreadTex: THREE.Texture | null = null;
let cachedDiscRotorTex: THREE.Texture | null = null;
let cachedBrushedMetalTex: THREE.Texture | null = null;
let cachedRubberGripTex: THREE.Texture | null = null;
let cachedTaillightBarTex: THREE.Texture | null = null;
let cachedShowroomAFrameTex: THREE.Texture | null = null;
let cachedShowroomFasciaTex: THREE.Texture | null = null;
let cachedShowroomBackwallTex: THREE.Texture | null = null;

const FINISH_GLOSS_BODY: ScooterPartFinish = { roughness: 0.22, metalness: 0.08 };
const FINISH_SATIN_METAL: ScooterPartFinish = { roughness: 0.28, metalness: 0.68 };
const FINISH_DARK_ALLOY: ScooterPartFinish = { roughness: 0.34, metalness: 0.56 };
const FINISH_MATTE_TRIM: ScooterPartFinish = { roughness: 0.68, metalness: 0.08 };
const FINISH_RUBBER_TIRE: ScooterPartFinish = { roughness: 0.84, metalness: 0.03 };
const FINISH_SADDLE_LEATHER: ScooterPartFinish = { roughness: 0.74, metalness: 0.04 };
const FINISH_OPTICAL_LENS: ScooterPartFinish = { roughness: 0.14, metalness: 0.16 };

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
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

function makeFallbackDataTex(r: number, g: number, b: number, a = 255): THREE.DataTexture {
  const data = new Uint8Array([r, g, b, a]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function finalizeCanvasTex(
  canvas: HTMLCanvasElement,
  wrap: THREE.Wrapping = THREE.ClampToEdgeWrapping,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = wrap;
  tex.wrapT = wrap;
  tex.needsUpdate = true;
  return tex;
}

function getSoftContactShadowTexture(): THREE.Texture {
  if (cachedContactShadowTex) return cachedContactShadowTex;
  const { canvas, ctx } = makeCanvas2d(128, 128);
  if (!canvas || !ctx) {
    cachedContactShadowTex = makeFallbackDataTex(0, 0, 0, 110);
    return cachedContactShadowTex;
  }
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0.0, 'rgba(15, 23, 42, 0.56)');
  grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.24)');
  grad.addColorStop(1.0, 'rgba(15, 23, 42, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  cachedContactShadowTex = finalizeCanvasTex(canvas);
  return cachedContactShadowTex;
}

/**
 * Pearl-White Aerodynamic Front Shield Texture (`screen_8a1fbcde.png` Front & 3/4 Views):
 * - Smooth pearl-alabaster center crown with satin metallic edge falloff,
 * - Outer cyan-teal (`#14b8a6`) aerodynamic pinstripe running symmetrically along left & right flanks,
 * - Crisp panel shut-line & recessed vertical stadium DRL bezel shadow.
 */
function getElectricFrontShieldTexture(): THREE.Texture {
  if (cachedFrontShieldTex) return cachedFrontShieldTex;
  const { canvas, ctx } = makeCanvas2d(512, 512);
  if (!canvas || !ctx) {
    cachedFrontShieldTex = makeFallbackDataTex(242, 246, 250, 255);
    return cachedFrontShieldTex;
  }
  const bg = ctx.createLinearGradient(0, 0, 512, 0);
  bg.addColorStop(0.0, '#d8e1ec');
  bg.addColorStop(0.14, '#edf2f7');
  bg.addColorStop(0.50, '#f8fafc');
  bg.addColorStop(0.86, '#edf2f7');
  bg.addColorStop(1.0, '#d8e1ec');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle vertical specular crown sheen down the center of the shield
  const vGrad = ctx.createLinearGradient(0, 0, 0, 512);
  vGrad.addColorStop(0.0, 'rgba(255,255,255,0.28)');
  vGrad.addColorStop(0.68, 'rgba(255,255,255,0.06)');
  vGrad.addColorStop(1.0, 'rgba(148,163,184,0.22)');
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, 512, 512);

  // Outer aerodynamic cyan-teal contour pinstripes on left (`u ~ 0.11`) & right (`u ~ 0.89`) flanks
  for (const sideX of [58, 454]) {
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(sideX, 18);
    ctx.quadraticCurveTo(sideX + (sideX < 256 ? -10 : 10), 260, sideX + (sideX < 256 ? 8 : -8), 494);
    ctx.stroke();

    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(sideX, 18);
    ctx.quadraticCurveTo(sideX + (sideX < 256 ? -10 : 10), 260, sideX + (sideX < 256 ? 8 : -8), 494);
    ctx.stroke();
  }

  // Subtle automotive panel shut-lines inboard of the cyan stripes
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.38)';
  ctx.lineWidth = 2.5;
  for (const seamX of [74, 438]) {
    ctx.beginPath();
    ctx.moveTo(seamX, 24);
    ctx.quadraticCurveTo(seamX + (seamX < 256 ? -8 : 8), 260, seamX + (seamX < 256 ? 6 : -6), 488);
    ctx.stroke();
  }

  // Lower horizontal crease line right above the flush headlamp bar
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(64, 466);
  ctx.quadraticCurveTo(256, 480, 448, 466);
  ctx.stroke();

  cachedFrontShieldTex = finalizeCanvasTex(canvas);
  return cachedFrontShieldTex;
}

/**
 * Glossy Horizontal Headlamp Lens & Multi-Reflector Optics (`screen_8a1fbcde.png` Front & 3/4 Views):
 * - Smoked dark chrome internal bezel,
 * - 3 jewel-like LED projector segments in center,
 * - Corner amber LED turn indicator pods,
 * - Crisp diagonal glossy polycarbonate lens reflection streak.
 */
function getElectricHeadlampBarTexture(): THREE.Texture {
  if (cachedHeadlampBarTex) return cachedHeadlampBarTex;
  const { canvas, ctx } = makeCanvas2d(512, 128);
  if (!canvas || !ctx) {
    cachedHeadlampBarTex = makeFallbackDataTex(225, 248, 255, 255);
    return cachedHeadlampBarTex;
  }
  ctx.fillStyle = '#121822';
  ctx.fillRect(0, 0, 512, 128);

  // Outer chrome/cyan inner reflector frame
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 5;
  ctx.strokeRect(8, 10, 496, 108);

  // Left & Right corner amber turn-indicator segments
  for (const [ax, aw] of [
    [16, 66],
    [430, 66],
  ] as [number, number][]) {
    const aGrad = ctx.createLinearGradient(ax, 20, ax, 108);
    aGrad.addColorStop(0.0, '#fde68a');
    aGrad.addColorStop(0.5, '#f59e0b');
    aGrad.addColorStop(1.0, '#b45309');
    ctx.fillStyle = aGrad;
    ctx.fillRect(ax, 22, aw, 84);
  }

  // Central triple LED projector array (`x = 94 .. 418`)
  const mainGrad = ctx.createLinearGradient(94, 18, 94, 110);
  mainGrad.addColorStop(0.0, '#cffafe');
  mainGrad.addColorStop(0.5, '#f8fafc');
  mainGrad.addColorStop(1.0, '#93c5fd');
  ctx.fillStyle = mainGrad;
  ctx.fillRect(92, 20, 328, 88);

  // Projector cell dividers + bright optical cores
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(198, 20, 6, 88);
  ctx.fillRect(308, 20, 6, 88);
  for (const cx of [145, 256, 366]) {
    const pGrad = ctx.createRadialGradient(cx, 64, 4, cx, 64, 42);
    pGrad.addColorStop(0.0, '#ffffff');
    pGrad.addColorStop(0.6, 'rgba(186, 230, 253, 0.75)');
    pGrad.addColorStop(1.0, 'rgba(30, 41, 59, 0.15)');
    ctx.fillStyle = pGrad;
    ctx.fillRect(cx - 46, 22, 92, 84);
  }

  // Signature glossy diagonal headlamp lens specular reflection
  ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
  ctx.beginPath();
  ctx.moveTo(118, 14);
  ctx.lineTo(170, 14);
  ctx.lineTo(128, 114);
  ctx.lineTo(76, 114);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(334, 14);
  ctx.lineTo(362, 14);
  ctx.lineTo(322, 114);
  ctx.lineTo(294, 114);
  ctx.closePath();
  ctx.fill();

  cachedHeadlampBarTex = finalizeCanvasTex(canvas);
  return cachedHeadlampBarTex;
}

/**
 * Sculpted Rear Side Cowl Texture (`screen_8a1fbcde.png` Side Profile & 3/4 Isometric):
 * - Pearl-white upper body shell + satin-silver metallic lower sculpt,
 * - Signature angled cyan-teal boomerang accent stripe & crisp panel crease!
 * UV orientation: `u = 0` (rear tail `z = -0.80`) -> `u = 1` (front knee `z = -0.02`), `v = 0` (bottom) -> `v = 1` (top).
 */
function getElectricSideCowlTexture(): THREE.Texture {
  if (cachedSideCowlTex) return cachedSideCowlTex;
  const { canvas, ctx } = makeCanvas2d(512, 256);
  if (!canvas || !ctx) {
    cachedSideCowlTex = makeFallbackDataTex(241, 245, 249, 255);
    return cachedSideCowlTex;
  }
  // Base pearl-white automotive finish
  const baseGrad = ctx.createLinearGradient(0, 0, 0, 256);
  baseGrad.addColorStop(0.0, '#dce4ee');
  baseGrad.addColorStop(0.35, '#eef3f8');
  baseGrad.addColorStop(0.75, '#f8fafc');
  baseGrad.addColorStop(1.0, '#e2e8f0');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, 512, 256);

  // Lower satin-metallic recessed scallop along the bottom-front edge
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(180, 256);
  ctx.lineTo(512, 256);
  ctx.lineTo(512, 186);
  ctx.lineTo(340, 198);
  ctx.closePath();
  ctx.fill();

  // Signature Boomerang Cyan-Teal Accent Trim (`u` rear=36 -> front-knee=438, then angling down-forward to 486)
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(34, 92);
  ctx.lineTo(384, 118);
  ctx.lineTo(466, 214);
  ctx.stroke();

  ctx.strokeStyle = '#2dd4bf';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(34, 92);
  ctx.lineTo(384, 118);
  ctx.lineTo(466, 214);
  ctx.stroke();

  // Subtle upper highlight crease above the boomerang stripe
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(38, 82);
  ctx.lineTo(388, 108);
  ctx.stroke();

  cachedSideCowlTex = finalizeCanvasTex(canvas);
  return cachedSideCowlTex;
}

/**
 * Rear Slim LED Taillight & Turn-Signal Strip Texture (`screen_8a1fbcde.png` Rear Elevation).
 */
function getElectricTaillightBarTexture(): THREE.Texture {
  if (cachedTaillightBarTex) return cachedTaillightBarTex;
  const { canvas, ctx } = makeCanvas2d(512, 96);
  if (!canvas || !ctx) {
    cachedTaillightBarTex = makeFallbackDataTex(239, 68, 68, 255);
    return cachedTaillightBarTex;
  }
  ctx.fillStyle = '#181c24';
  ctx.fillRect(0, 0, 512, 96);

  // Outer amber turn-indicator end strips
  for (const [tx, tw] of [
    [12, 74],
    [426, 74],
  ] as [number, number][]) {
    const tGrad = ctx.createLinearGradient(tx, 18, tx, 78);
    tGrad.addColorStop(0.0, '#fde68a');
    tGrad.addColorStop(0.5, '#f59e0b');
    tGrad.addColorStop(1.0, '#b45309');
    ctx.fillStyle = tGrad;
    ctx.fillRect(tx, 20, tw, 56);
  }

  // Central ruby-red neon LED light bar
  const rGrad = ctx.createLinearGradient(96, 14, 96, 82);
  rGrad.addColorStop(0.0, '#fca5a5');
  rGrad.addColorStop(0.45, '#ef4444');
  rGrad.addColorStop(1.0, '#991b1b');
  ctx.fillStyle = rGrad;
  ctx.fillRect(94, 16, 324, 64);

  // Inner bright LED light-guide tube
  ctx.fillStyle = '#ffe4e6';
  ctx.fillRect(108, 38, 296, 16);

  cachedTaillightBarTex = finalizeCanvasTex(canvas);
  return cachedTaillightBarTex;
}

/**
 * Matte-Charcoal Faux-Leather 2-Up Saddle Texture with Contrast French Stitching (`screen_8a1fbcde.png`).
 */
function getSaddleLeatherTexture(): THREE.Texture {
  if (cachedSaddleLeatherTex) return cachedSaddleLeatherTex;
  const { canvas, ctx } = makeCanvas2d(512, 256);
  if (!canvas || !ctx) {
    cachedSaddleLeatherTex = makeFallbackDataTex(38, 43, 51, 255);
    return cachedSaddleLeatherTex;
  }
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#1e232b');
  grad.addColorStop(0.32, '#2d333e');
  grad.addColorStop(0.68, '#2d333e');
  grad.addColorStop(1.0, '#1e232b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Subtle leather grain micro-stipple
  ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
  for (let y = 4; y < 252; y += 6) {
    for (let x = 4; x < 508; x += 6) {
      if ((x * 7 + y * 13) % 18 === 0) {
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  // Pillion-to-rider bolster seam (`u ~ 0.46`) + perimeter french stitching
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([7, 5]);
  ctx.strokeRect(18, 28, 476, 200);

  ctx.beginPath();
  ctx.moveTo(232, 26);
  ctx.quadraticCurveTo(252, 128, 232, 230);
  ctx.stroke();
  ctx.setLineDash([]);

  cachedSaddleLeatherTex = finalizeCanvasTex(canvas);
  return cachedSaddleLeatherTex;
}

/**
 * Directional Urban Commuter Tire Tread Texture (`256x256`, tiled cleanly around Torus tires).
 */
function getScooterTireTreadTexture(): THREE.Texture {
  if (cachedTireTreadTex) return cachedTireTreadTex;
  const { canvas, ctx } = makeCanvas2d(256, 256);
  if (!canvas || !ctx) {
    cachedTireTreadTex = makeFallbackDataTex(30, 34, 41, 255);
    return cachedTireTreadTex;
  }
  // Sidewall & crown shading
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#1b1f27');
  grad.addColorStop(0.25, '#262c36');
  grad.addColorStop(0.50, '#20252e');
  grad.addColorStop(0.75, '#262c36');
  grad.addColorStop(1.0, '#1b1f27');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Circumferential center rain groove + diagonal V-sipes
  ctx.fillStyle = '#11141a';
  ctx.fillRect(0, 123, 256, 10);

  ctx.strokeStyle = '#12161d';
  ctx.lineWidth = 5;
  for (let x = -16; x < 272; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 124);
    ctx.lineTo(x + 18, 72);
    ctx.moveTo(x + 12, 132);
    ctx.lineTo(x + 30, 184);
    ctx.stroke();
  }

  const tex = finalizeCanvasTex(canvas, THREE.RepeatWrapping);
  tex.repeat.set(4, 1);
  cachedTireTreadTex = tex;
  return cachedTireTreadTex;
}

/**
 * Drilled Stainless-Steel Brake Disc Rotor Texture (`256x256`).
 */
function getVentilatedDiscRotorTexture(): THREE.Texture {
  if (cachedDiscRotorTex) return cachedDiscRotorTex;
  const { canvas, ctx } = makeCanvas2d(256, 256);
  if (!canvas || !ctx) {
    cachedDiscRotorTex = makeFallbackDataTex(203, 213, 225, 255);
    return cachedDiscRotorTex;
  }
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(0, 0, 256, 256);

  // Outer machined friction track
  ctx.beginPath();
  ctx.arc(128, 128, 122, 0, Math.PI * 2);
  ctx.fillStyle = '#e2e8f0';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#94a3b8';
  ctx.stroke();

  // Dark inner carrier spider
  ctx.beginPath();
  ctx.arc(128, 128, 66, 0, Math.PI * 2);
  ctx.fillStyle = '#334155';
  ctx.fill();

  // Cooling drill holes along friction ring
  ctx.fillStyle = '#1e293b';
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const r1 = 86;
    const r2 = 104;
    ctx.beginPath();
    ctx.arc(128 + Math.cos(a) * r1, 128 + Math.sin(a) * r1, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(128 + Math.cos(a + 0.14) * r2, 128 + Math.sin(a + 0.14) * r2, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  cachedDiscRotorTex = finalizeCanvasTex(canvas);
  return cachedDiscRotorTex;
}

/**
 * Fine Satin Brushed-Aluminum Texture (`256x256`) for Push Scooter Deck, Neck, Fork & Cast Swingarm.
 */
function getBrushedAluminumTexture(): THREE.Texture {
  if (cachedBrushedMetalTex) return cachedBrushedMetalTex;
  const { canvas, ctx } = makeCanvas2d(256, 256);
  if (!canvas || !ctx) {
    cachedBrushedMetalTex = makeFallbackDataTex(220, 227, 236, 255);
    return cachedBrushedMetalTex;
  }
  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0.0, '#d5dde7');
  grad.addColorStop(0.5, '#ecf1f7');
  grad.addColorStop(1.0, '#cfd8e4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle anisotropic brushed hairline streaks
  for (let y = 0; y < 256; y += 3) {
    ctx.fillStyle = y % 6 === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(100,116,139,0.10)';
    ctx.fillRect(0, y, 256, 1);
  }
  cachedBrushedMetalTex = finalizeCanvasTex(canvas, THREE.RepeatWrapping);
  return cachedBrushedMetalTex;
}

/**
 * Knurled Ergonomic Rubber Handlebar Grip Texture (`128x128`).
 */
function getErgonomicGripTexture(): THREE.Texture {
  if (cachedRubberGripTex) return cachedRubberGripTex;
  const { canvas, ctx } = makeCanvas2d(128, 128);
  if (!canvas || !ctx) {
    cachedRubberGripTex = makeFallbackDataTex(35, 40, 48, 255);
    return cachedRubberGripTex;
  }
  ctx.fillStyle = '#232831';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#171b22';
  ctx.lineWidth = 2;
  for (let i = -128; i < 256; i += 12) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 128, 128);
    ctx.moveTo(i + 128, 0);
    ctx.lineTo(i, 128);
    ctx.stroke();
  }
  cachedRubberGripTex = finalizeCanvasTex(canvas, THREE.RepeatWrapping);
  return cachedRubberGripTex;
}

function getElectricCockpitLcdTexture(): THREE.Texture {
  if (cachedCockpitLcdTex) return cachedCockpitLcdTex;
  const { canvas, ctx } = makeCanvas2d(256, 144);
  if (!canvas || !ctx) {
    cachedCockpitLcdTex = makeFallbackDataTex(14, 32, 48, 255);
    return cachedCockpitLcdTex;
  }
  ctx.fillStyle = '#09131f';
  ctx.fillRect(0, 0, 256, 144);
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 240, 128);

  // Cyan power arc across top
  ctx.strokeStyle = '#0ea5e9';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(32, 26);
  ctx.quadraticCurveTo(128, 14, 224, 26);
  ctx.stroke();

  // Battery gauge bars on left
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < 4 ? '#14b8a6' : '#38bdf8';
    ctx.fillRect(22, 104 - i * 15, 22, 10);
  }
  // Speedometer readout in center
  ctx.fillStyle = '#ecfeff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 50px sans-serif';
  ctx.fillText('28', 130, 86);
  ctx.fillStyle = '#67e8f9';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('KM/H · READY', 130, 114);

  // Mode badge on right
  ctx.fillStyle = '#134e4a';
  ctx.fillRect(190, 34, 46, 26);
  ctx.fillStyle = '#5eead4';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('ECO', 213, 52);

  cachedCockpitLcdTex = finalizeCanvasTex(canvas);
  return cachedCockpitLcdTex;
}

function getElectricFloorMatTexture(): THREE.Texture {
  if (cachedElectricFloorMatTex) return cachedElectricFloorMatTex;
  const { canvas, ctx } = makeCanvas2d(256, 256);
  if (!canvas || !ctx) {
    cachedElectricFloorMatTex = makeFallbackDataTex(38, 43, 52, 255);
    return cachedElectricFloorMatTex;
  }
  ctx.fillStyle = '#252b35';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#384150';
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, 232, 232);
  // Longitudinal anti-slip rubber grip channels matching 3/4 isometric floorboard detail
  for (let x = 34; x <= 222; x += 20) {
    ctx.fillStyle = '#181c23';
    ctx.fillRect(x - 5, 26, 10, 204);
    ctx.fillStyle = '#333b48';
    ctx.fillRect(x - 5, 26, 2, 204);
  }
  ctx.strokeStyle = '#14b8a6';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, 216, 216);

  cachedElectricFloorMatTex = finalizeCanvasTex(canvas);
  return cachedElectricFloorMatTex;
}

/**
 * Geometric High-Grip Deck Texture (`screen_e2bde276.png` Quadrant 3 Top Plan & Quadrant 4 3/4 Isometric).
 */
function getKickGeometricGripDeckTexture(): THREE.Texture {
  if (cachedKickGripDeckTex) return cachedKickGripDeckTex;
  const { canvas, ctx } = makeCanvas2d(256, 512);
  if (!canvas || !ctx) {
    cachedKickGripDeckTex = makeFallbackDataTex(36, 41, 49, 255);
    return cachedKickGripDeckTex;
  }
  ctx.fillStyle = '#262b34';
  ctx.fillRect(0, 0, 256, 512);

  // Fine silicon-carbide grip-tape stipple
  ctx.fillStyle = '#1c2027';
  for (let y = 16; y < 496; y += 8) {
    for (let x = 16; x < 240; x += 8) {
      if ((x + y) % 16 === 0) ctx.fillRect(x, y, 3, 3);
    }
  }

  // Molded perimeter track
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 6;
  ctx.strokeRect(18, 20, 220, 472);

  // Precision geometric diamond / hex grip lattice matching reference Top Plan
  ctx.strokeStyle = '#384152';
  ctx.lineWidth = 3;
  for (let y = 44; y <= 468; y += 28) {
    ctx.beginPath();
    ctx.moveTo(34, y + 14);
    ctx.lineTo(128, y);
    ctx.lineTo(222, y + 14);
    ctx.lineTo(128, y + 28);
    ctx.closePath();
    ctx.stroke();
  }

  // Subtle front & rear cyan precision alignment ticks
  ctx.fillStyle = '#14b8a6';
  ctx.fillRect(123, 30, 10, 44);
  ctx.fillRect(123, 438, 10, 44);

  cachedKickGripDeckTex = finalizeCanvasTex(canvas);
  return cachedKickGripDeckTex;
}

function getShowroomAFrameSignTexture(): THREE.Texture {
  if (cachedShowroomAFrameTex) return cachedShowroomAFrameTex;
  const { canvas, ctx } = makeCanvas2d(256, 384);
  if (!canvas || !ctx) {
    cachedShowroomAFrameTex = makeFallbackDataTex(24, 30, 38, 255);
    return cachedShowroomAFrameTex;
  }
  ctx.fillStyle = '#181e27';
  ctx.fillRect(0, 0, 256, 384);
  ctx.strokeStyle = '#14b8a6';
  ctx.lineWidth = 8;
  ctx.strokeRect(14, 14, 228, 356);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, 208, 336);

  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(92, 82, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(164, 82, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(92, 82);
  ctx.lineTo(146, 82);
  ctx.lineTo(158, 50);
  ctx.lineTo(172, 50);
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('URBAN', 128, 150);
  ctx.fillText('SCOOTER', 128, 186);

  ctx.fillStyle = '#2dd4bf';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('E-BIKE & KICK SCOOTER', 128, 224);

  ctx.fillStyle = '#334155';
  ctx.fillRect(42, 246, 172, 3);

  ctx.fillStyle = '#0f766e';
  ctx.fillRect(38, 270, 180, 44);
  ctx.fillStyle = '#ecfeff';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('NFT · RESPITE', 128, 299);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('CITY MOBILITY SHOP', 128, 340);

  cachedShowroomAFrameTex = finalizeCanvasTex(canvas);
  return cachedShowroomAFrameTex;
}

function getShowroomFasciaTexture(): THREE.Texture {
  if (cachedShowroomFasciaTex) return cachedShowroomFasciaTex;
  const { canvas, ctx } = makeCanvas2d(512, 96);
  if (!canvas || !ctx) {
    cachedShowroomFasciaTex = makeFallbackDataTex(26, 32, 40, 255);
    return cachedShowroomFasciaTex;
  }
  ctx.fillStyle = '#1b2028';
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = '#14b8a6';
  ctx.fillRect(0, 84, 512, 8);
  ctx.fillRect(0, 4, 512, 4);

  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('URBAN SCOOTER SHOWROOM', 256, 52);
  ctx.fillStyle = '#5eead4';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('ELECTRIC SCOOTER BIKE  ·  PUSH SCOOTER  ·  RESPITE NFT', 256, 75);

  cachedShowroomFasciaTex = finalizeCanvasTex(canvas);
  return cachedShowroomFasciaTex;
}

function getShowroomBackwallGraphicTexture(): THREE.Texture {
  if (cachedShowroomBackwallTex) return cachedShowroomBackwallTex;
  const { canvas, ctx } = makeCanvas2d(512, 256);
  if (!canvas || !ctx) {
    cachedShowroomBackwallTex = makeFallbackDataTex(22, 30, 42, 255);
    return cachedShowroomBackwallTex;
  }
  ctx.fillStyle = '#141b24';
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  for (let x = 32; x < 512; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  for (let y = 32; y < 256; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#14b8a6';
  ctx.lineWidth = 5;
  ctx.strokeRect(12, 12, 488, 232);

  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(88, 174, 30, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(198, 174, 30, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(88, 174);
  ctx.lineTo(132, 174);
  ctx.lineTo(154, 124);
  ctx.lineTo(202, 124);
  ctx.moveTo(188, 174);
  ctx.lineTo(172, 86);
  ctx.lineTo(152, 86);
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'left';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('E-MOBILITY LAB', 248, 96);
  ctx.fillStyle = '#2dd4bf';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('ZERO-EMISSION CITY TRANSIT', 248, 128);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('• URBAN ELECTRIC SCOOTER', 248, 164);
  ctx.fillText('• FOLDABLE KICK SCOOTER', 248, 188);
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('• OFFICIAL RESPITE NFT GEAR', 248, 214);

  cachedShowroomBackwallTex = finalizeCanvasTex(canvas);
  return cachedShowroomBackwallTex;
}

function makeStandardFallbackHelper(): ScooterToonPartHelper {
  return {
    addPart(
      parent,
      geo,
      colorHex,
      pos,
      rot = [0, 0, 0],
      _stroke = 0,
      tex,
      _bump = 1,
      castShad = true,
      finish,
    ) {
      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        map: tex ?? null,
        roughness: finish?.roughness ?? 0.36,
        metalness: finish?.metalness ?? 0.18,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.rotation.set(rot[0], rot[1], rot[2]);
      mesh.castShadow = castShad;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    },
  };
}

function addLuminousScooterPart(
  helper: ScooterToonPartHelper,
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  colorHex: string,
  emissiveHex: string,
  emissiveIntensity: number,
  pos: [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
  tex?: THREE.Texture,
): THREE.Mesh {
  const mesh = helper.addPart(
    parent,
    geo,
    colorHex,
    pos,
    rot,
    0,
    tex,
    1.0,
    false,
    FINISH_OPTICAL_LENS,
  );
  const mat = mesh.material as THREE.MeshStandardMaterial;
  if (mat && 'emissive' in mat && mat.emissive instanceof THREE.Color) {
    mat.emissive.set(emissiveHex);
    mat.emissiveIntensity = emissiveIntensity;
  }
  return mesh;
}

function createRoundedRectExtrudeGeo(
  width: number,
  length: number,
  depth: number,
  cornerRadius: number,
  bevelSize = 0.008,
): THREE.BufferGeometry {
  const hw = width * 0.5;
  const hl = length * 0.5;
  const r = Math.min(cornerRadius, hw * 0.9, hl * 0.9);
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hl);
  shape.lineTo(hw - r, -hl);
  shape.quadraticCurveTo(hw, -hl, hw, -hl + r);
  shape.lineTo(hw, hl - r);
  shape.quadraticCurveTo(hw, hl, hw - r, hl);
  shape.lineTo(-hw + r, hl);
  shape.quadraticCurveTo(-hw, hl, -hw, hl - r);
  shape.lineTo(-hw, -hl + r);
  shape.quadraticCurveTo(-hw, -hl, -hw + r, -hl);

  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth,
    bevelEnabled: bevelSize > 0,
    bevelThickness: bevelSize,
    bevelSize,
    bevelSegments: 3,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

interface LoftStation {
  /** Center Y in scooter local space (m). */
  y: number;
  /** Center Z in scooter local space (m). */
  z: number;
  /** Half-width along X (m). */
  rx: number;
  /** Upper vertical radius (+local Y) (m). */
  ryTop: number;
  /** Lower vertical radius (-local Y) (m). */
  ryBot: number;
  /** Cross-section pitch rotation in YZ plane (`radians`, tilting local Y toward Z). */
  pitchRad?: number;
  /** Superellipse corner sharpness (`2.0` = ellipse, `3.2` = rounded automotive squircle). */
  power?: number;
}

/**
 * Parametric Multi-Station Automotive Bodywork Loft Builder:
 * Connects an array of 3D cross-section stations smoothly with clean vertex normals,
 * closed end-caps, and distortion-free `'front'`, `'side'`, or `'wrap'` UV coordinates.
 */
function createLoftedBodyShellGeo(
  stations: readonly LoftStation[],
  ringSegs = 20,
  uvMode: 'front' | 'side' | 'wrap' = 'wrap',
): THREE.BufferGeometry {
  const stCount = stations.length;
  const cols = ringSegs + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  const rawPts: Array<{ x: number; y: number; z: number; sFrac: number; rFrac: number }> = [];

  for (let s = 0; s < stCount; s++) {
    const st = stations[s];
    const sFrac = stCount > 1 ? s / (stCount - 1) : 0;
    const exp = 2 / Math.max(1.4, st.power ?? 2.8);
    const pitch = st.pitchRad ?? 0;
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);

    for (let r = 0; r <= ringSegs; r++) {
      const rFrac = r / ringSegs;
      const theta = rFrac * Math.PI * 2;
      const ct = Math.cos(theta);
      const stSin = Math.sin(theta);
      const sx = Math.sign(ct) * Math.pow(Math.abs(ct), exp) * st.rx;
      const syLocal =
        Math.sign(stSin) *
        Math.pow(Math.abs(stSin), exp) *
        (stSin >= 0 ? st.ryTop : st.ryBot);

      const wy = st.y + syLocal * cosP;
      const wz = st.z + syLocal * sinP;
      rawPts.push({ x: sx, y: wy, z: wz, sFrac, rFrac });
      if (sx < minX) minX = sx;
      if (sx > maxX) maxX = sx;
      if (wy < minY) minY = wy;
      if (wy > maxY) maxY = wy;
      if (wz < minZ) minZ = wz;
      if (wz > maxZ) maxZ = wz;
    }
  }

  const spanX = Math.max(1e-4, maxX - minX);
  const spanY = Math.max(1e-4, maxY - minY);
  const spanZ = Math.max(1e-4, maxZ - minZ);

  for (let i = 0; i < rawPts.length; i++) {
    const p = rawPts[i];
    positions.push(p.x, p.y, p.z);
    if (uvMode === 'front') {
      uvs.push((p.x - minX) / spanX, 1 - p.sFrac);
    } else if (uvMode === 'side') {
      uvs.push((p.z - minZ) / spanZ, (p.y - minY) / spanY);
    } else {
      uvs.push(p.rFrac, p.sFrac);
    }
  }

  for (let s = 0; s < stCount - 1; s++) {
    const row0 = s * cols;
    const row1 = (s + 1) * cols;
    for (let r = 0; r < ringSegs; r++) {
      const a = row0 + r;
      const b = row1 + r;
      const c = row1 + r + 1;
      const d = row0 + r + 1;
      indices.push(a, b, d, b, c, d);
    }
  }

  // Start cap (`s = 0`) and End cap (`s = stCount - 1`)
  const startCenterIdx = positions.length / 3;
  positions.push(0, stations[0].y, stations[0].z);
  uvs.push(0.5, 1.0);
  for (let r = 0; r < ringSegs; r++) {
    indices.push(startCenterIdx, r + 1, r);
  }

  const lastSt = stations[stCount - 1];
  const endCenterIdx = positions.length / 3;
  positions.push(0, lastSt.y, lastSt.z);
  uvs.push(0.5, 0.0);
  const lastRow = (stCount - 1) * cols;
  for (let r = 0; r < ringSegs; r++) {
    indices.push(endCenterIdx, lastRow + r, lastRow + r + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a split-spoke scooter wheel assembly centered at `(0, 0, 0)` in the YZ rolling plane
 * (axle along X axis, so spinning `wheelGroup.rotation.x += deltaRad` rolls forward `+Z`).
 */
function buildSpokeWheelAssembly(
  helper: ScooterToonPartHelper,
  outerRadius: number,
  tireTubeRadius: number,
  spokeCount: number,
  tireHex: string,
  rimHex: string,
  hubHex: string,
  includeFrontDisc: boolean,
): THREE.Group {
  const wheelGrp = new THREE.Group();
  const torusMajorR = Math.max(0.03, outerRadius - tireTubeRadius);

  // Sculpted pneumatic / PU tire with directional tread texture
  const tireGeo = new THREE.TorusGeometry(torusMajorR, tireTubeRadius, 14, 28);
  tireGeo.rotateY(Math.PI / 2);
  helper.addPart(
    wheelGrp,
    tireGeo,
    tireHex,
    [0, 0, 0],
    [0, 0, 0],
    0.005,
    getScooterTireTreadTexture(),
    1.0,
    true,
    FINISH_RUBBER_TIRE,
  );

  // Outer machined alloy rim flange + inner dark barrel ring
  const innerRimR = torusMajorR - tireTubeRadius * 0.72;
  const rimRingGeo = new THREE.TorusGeometry(innerRimR, tireTubeRadius * 0.34, 10, 26);
  rimRingGeo.rotateY(Math.PI / 2);
  helper.addPart(
    wheelGrp,
    rimRingGeo,
    rimHex,
    [0, 0, 0],
    [0, 0, 0],
    0.003,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );

  // Fine satin-silver machined rim-lip pinstripe (signature industrial wheel detail)
  const lipPinGeo = new THREE.TorusGeometry(innerRimR + tireTubeRadius * 0.16, tireTubeRadius * 0.09, 6, 26);
  lipPinGeo.rotateY(Math.PI / 2);
  helper.addPart(
    wheelGrp,
    lipPinGeo,
    '#cbd5e1',
    [0, 0, 0],
    [0, 0, 0],
    0,
    undefined,
    1.0,
    false,
    FINISH_SATIN_METAL,
  );

  // Central alloy hub barrel + left/right machined bearing caps
  const hubWidth = tireTubeRadius * 1.95;
  const hubRadius = outerRadius * 0.23;
  helper.addPart(
    wheelGrp,
    new THREE.CylinderGeometry(hubRadius, hubRadius, hubWidth, 14),
    hubHex,
    [0, 0, 0],
    [0, 0, Math.PI / 2],
    0.004,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );
  helper.addPart(
    wheelGrp,
    new THREE.CylinderGeometry(hubRadius * 0.48, hubRadius * 0.48, hubWidth * 1.14, 12),
    '#94a3b8',
    [0, 0, 0],
    [0, 0, Math.PI / 2],
    0,
    undefined,
    1.0,
    false,
    FINISH_SATIN_METAL,
  );

  // Twin V-Split Sculpted Alloy Spokes matching both 4-view reference sheets
  const spokeLen = Math.max(0.02, innerRimR - hubRadius * 0.55);
  const spokeMidR = hubRadius * 0.55 + spokeLen * 0.5;
  const spokeArmW = Math.max(0.007, outerRadius * 0.046);
  const spokeThickX = Math.max(0.011, tireTubeRadius * 0.68);
  for (let i = 0; i < spokeCount; i++) {
    const baseTheta = (i / spokeCount) * Math.PI * 2;
    for (const splay of [-0.085, 0.085]) {
      const theta = baseTheta + splay;
      const sy = Math.cos(theta) * spokeMidR;
      const sz = Math.sin(theta) * spokeMidR;
      helper.addPart(
        wheelGrp,
        new THREE.BoxGeometry(spokeThickX, spokeLen, spokeArmW),
        rimHex,
        [0, sy, sz],
        [-(baseTheta + splay * 1.65), 0, 0],
        0.002,
        undefined,
        1.0,
        false,
        FINISH_DARK_ALLOY,
      );
    }
  }

  // Drilled ventilated stainless brake disc rotor
  if (includeFrontDisc) {
    const discR = outerRadius * 0.54;
    helper.addPart(
      wheelGrp,
      new THREE.CylinderGeometry(discR, discR, 0.007, 20),
      '#ffffff',
      [hubWidth * 0.54, 0, 0],
      [0, 0, Math.PI / 2],
      0.002,
      getVentilatedDiscRotorTexture(),
      1.0,
      false,
      FINISH_SATIN_METAL,
    );
  }

  return wheelGrp;
}

/**
 * Creates the Modern Urban Electric Scooter ("Scooter Bike") matching all 4 views
 * of `screen_8a1fbcde.png` (`~180cm` length, `~125cm` wheelbase, `~78cm` seat, `~115cm` cockpit).
 */
export function createElectricScooterBike3D(
  options: CreateScooterModelOptions = {},
): ElectricScooterBike3DHandle {
  const helper = options.partHelper ?? makeStandardFallbackHelper();
  const pal = ELECTRIC_SCOOTER_BIKE_SPEC.palette;
  const bodyHex = options.bodyColorHex ?? '#ffffff';
  const accentHex = options.accentColorHex ?? pal.accentCyan;
  const isParkedInit = options.parked ?? true;

  const root = new THREE.Group();
  root.name = 'ModernUrbanElectricScooterBike3D';

  // Soft ground contact shadow (`y = 0.006`)
  if (options.includeContactShadow !== false) {
    if (options.partHelper) {
      helper.addPart(
        root,
        createRoundedRectExtrudeGeo(0.46, 1.66, 0.004, 0.18, 0),
        '#1a2029',
        [0, 0.003, -0.01],
        [0, 0, 0],
        0,
        undefined,
        1.0,
        false,
        FINISH_MATTE_TRIM,
      );
    } else {
      const shadGeo = new THREE.PlaneGeometry(0.88, 2.04);
      shadGeo.rotateX(-Math.PI / 2);
      const shadMat = new THREE.MeshBasicMaterial({
        map: getSoftContactShadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.72,
      });
      const shadMesh = new THREE.Mesh(shadGeo, shadMat);
      shadMesh.position.set(0, 0.008, -0.02);
      root.add(shadMesh);
    }
  }

  const chassisGroup = new THREE.Group();
  chassisGroup.name = 'ElectricScooterChassis';
  root.add(chassisGroup);

  // 1) Rear Wheel (`z = -0.61, y = 0.255`) + Brushless Hub Motor + Cast Aluminum Swingarm + Dual Shocks
  const rearWheelGroup = buildSpokeWheelAssembly(
    helper,
    ELECTRIC_SCOOTER_BIKE_SPEC.wheelOuterRadiusM,
    ELECTRIC_SCOOTER_BIKE_SPEC.tireSectionRadiusM,
    5,
    '#ffffff',
    pal.alloyWheelDark,
    '#1f242d',
    false,
  );
  rearWheelGroup.name = 'ElectricScooterRearWheel';
  rearWheelGroup.position.set(0, 0.255, -0.61);
  helper.addPart(
    rearWheelGroup,
    new THREE.CylinderGeometry(0.118, 0.118, 0.098, 16),
    '#232832',
    [0, 0, 0],
    [0, 0, Math.PI / 2],
    0.003,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );
  chassisGroup.add(rearWheelGroup);

  // Sculpted Tapered Satin-Silver Cast-Aluminum Swingarm Arms + Dual Coil-Spring Rear Shocks
  for (const side of [-1, 1]) {
    const swingGeo = createLoftedBodyShellGeo(
      [
        { y: 0.255, z: -0.635, rx: 0.018, ryTop: 0.028, ryBot: 0.028, power: 2.6 },
        { y: 0.262, z: -0.45, rx: 0.022, ryTop: 0.040, ryBot: 0.036, power: 2.8 },
        { y: 0.275, z: -0.22, rx: 0.024, ryTop: 0.046, ryBot: 0.038, power: 2.8 },
      ],
      12,
      'side',
    );
    helper.addPart(
      chassisGroup,
      swingGeo,
      '#ffffff',
      [side * 0.106, 0, 0],
      [0, 0, 0],
      0.004,
      getBrushedAluminumTexture(),
      1.0,
      true,
      FINISH_SATIN_METAL,
    );
    // Swingarm recessed charcoal pocket accent (matching Side Profile view)
    helper.addPart(
      chassisGroup,
      new THREE.BoxGeometry(0.010, 0.022, 0.22),
      '#333b47',
      [side * 0.126, 0.264, -0.42],
      [0.03, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_DARK_ALLOY,
    );
    helper.addPart(
      chassisGroup,
      new THREE.CylinderGeometry(0.022, 0.022, 0.028, 12),
      '#cbd5e1',
      [side * 0.124, 0.255, -0.61],
      [0, 0, Math.PI / 2],
      0.002,
      undefined,
      1.0,
      false,
      FINISH_SATIN_METAL,
    );

    // Dual Coil-Over Rear Shock Absorbers (`z = -0.59, y = 0.29` -> `z = -0.43, y = 0.54`)
    const shockGrp = new THREE.Group();
    shockGrp.position.set(side * 0.122, 0.415, -0.508);
    shockGrp.rotation.x = 0.54;
    chassisGroup.add(shockGrp);
    helper.addPart(
      shockGrp,
      new THREE.CylinderGeometry(0.012, 0.011, 0.28, 10),
      '#cbd5e1',
      [0, 0, 0],
      [0, 0, 0],
      0.002,
      undefined,
      1.0,
      false,
      FINISH_SATIN_METAL,
    );
    for (let c = -4; c <= 4; c++) {
      const ringGeo = new THREE.TorusGeometry(0.022, 0.0052, 6, 14);
      ringGeo.rotateX(Math.PI / 2);
      helper.addPart(
        shockGrp,
        ringGeo,
        '#2b313c',
        [0, c * 0.022, 0],
        [0, 0, 0],
        0,
        undefined,
        1.0,
        false,
        FINISH_DARK_ALLOY,
      );
    }
  }

  // 2) Sculpted Step-Through Floorboard (`~16cm` Ground Clearance), Underbelly Pan & Continuous Cyan Rocker Trim
  const underbellyGeo = createLoftedBodyShellGeo(
    [
      { y: 0.205, z: -0.20, rx: 0.155, ryTop: 0.042, ryBot: 0.040, power: 3.0 },
      { y: 0.198, z: 0.04, rx: 0.172, ryTop: 0.044, ryBot: 0.038, power: 3.2 },
      { y: 0.205, z: 0.29, rx: 0.168, ryTop: 0.044, ryBot: 0.040, power: 3.0 },
      { y: 0.265, z: 0.40, rx: 0.148, ryTop: 0.042, ryBot: 0.036, pitchRad: -0.45, power: 2.8 },
    ],
    16,
    'wrap',
  );
  helper.addPart(
    chassisGroup,
    underbellyGeo,
    pal.trimCharcoal,
    [0, 0, 0],
    [0, 0, 0],
    0.006,
    undefined,
    1.0,
    true,
    FINISH_MATTE_TRIM,
  );

  // Textured Anti-Slip Rubber Floorboard Footmat (`y = 0.246`)
  helper.addPart(
    chassisGroup,
    createRoundedRectExtrudeGeo(0.315, 0.52, 0.012, 0.065, 0.003),
    '#ffffff',
    [0, 0.240, 0.055],
    [0, 0, 0],
    0.003,
    getElectricFloorMatTexture(),
    0.8,
    false,
    FINISH_RUBBER_TIRE,
  );

  // Continuous Pearl-White Lower Rocker Skirts + Unbroken Cyan Pinstripe flowing from Front Shield to Rear Cowl
  const rockerCurvePts: [number, number, number][] = [
    [0.168, 0.285, -0.22],
    [0.176, 0.222, -0.06],
    [0.178, 0.218, 0.16],
    [0.175, 0.242, 0.33],
    [0.168, 0.375, 0.44],
    [0.174, 0.565, 0.53],
  ];
  for (const side of [-1, 1]) {
    const skirtPts = rockerCurvePts.map(([x, y, z]) => new THREE.Vector3(side * x, y, z));
    const skirtCurve = new THREE.CatmullRomCurve3(skirtPts);
    helper.addPart(
      chassisGroup,
      new THREE.TubeGeometry(skirtCurve, 22, 0.024, 8, false),
      options.bodyColorHex ?? pal.bodyPearlWhite,
      [0, 0, 0],
      [0, 0, 0],
      0.004,
      undefined,
      1.0,
      false,
      FINISH_GLOSS_BODY,
    );
    const pinPts = rockerCurvePts.map(
      ([x, y, z]) => new THREE.Vector3(side * (x + 0.015), y + 0.006, z + 0.004),
    );
    const pinCurve = new THREE.CatmullRomCurve3(pinPts);
    helper.addPart(
      chassisGroup,
      new THREE.TubeGeometry(pinCurve, 22, 0.0065, 6, false),
      accentHex,
      [0, 0, 0],
      [0, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_GLOSS_BODY,
    );
    // Retractable fold-out passenger footpeg on lower rear frame
    helper.addPart(
      chassisGroup,
      new THREE.BoxGeometry(0.028, 0.018, 0.088),
      '#64748b',
      [side * 0.168, 0.295, -0.24],
      [0.18, 0, 0],
      0.002,
      undefined,
      1.0,
      false,
      FINISH_SATIN_METAL,
    );
  }

  // 3) Lofted Aerodynamic Front Shield, Flush Vertical DRL, Glossy Headlamp Bar & Inner Leg-Shield
  // 3a) Continuous Lofted Pearl-White Front Shield (`y = 0.99, z = 0.31` -> `y = 0.58, z = 0.56` -> `y = 0.42, z = 0.46`)
  const frontShieldGeo = createLoftedBodyShellGeo(
    [
      { y: 0.995, z: 0.305, rx: 0.142, ryTop: 0.028, ryBot: 0.026, pitchRad: 0.96, power: 2.8 },
      { y: 0.890, z: 0.382, rx: 0.178, ryTop: 0.044, ryBot: 0.036, pitchRad: 0.96, power: 3.0 },
      { y: 0.755, z: 0.472, rx: 0.194, ryTop: 0.052, ryBot: 0.040, pitchRad: 0.98, power: 3.1 },
      { y: 0.635, z: 0.542, rx: 0.192, ryTop: 0.052, ryBot: 0.038, pitchRad: 1.18, power: 3.1 },
      { y: 0.560, z: 0.546, rx: 0.182, ryTop: 0.044, ryBot: 0.034, pitchRad: 1.48, power: 3.0 },
    ],
    22,
    'front',
  );
  helper.addPart(
    chassisGroup,
    frontShieldGeo,
    bodyHex,
    [0, 0, 0],
    [0, 0, 0],
    0.008,
    options.bodyColorHex ? undefined : getElectricFrontShieldTexture(),
    1.0,
    true,
    FINISH_GLOSS_BODY,
  );

  // Flush Vertical Pill-Shaped LED DRL Headlight Bar centered cleanly on the Front Shield (`screen_8a1fbcde.png`)
  const vDrlGrp = new THREE.Group();
  vDrlGrp.position.set(0, 0.805, 0.482);
  vDrlGrp.rotation.x = -0.575;
  chassisGroup.add(vDrlGrp);

  helper.addPart(
    vDrlGrp,
    new THREE.CapsuleGeometry(0.028, 0.168, 6, 12),
    '#1e293b',
    [0, 0, 0.004],
    [0, 0, 0],
    0.003,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );
  helper.addPart(
    vDrlGrp,
    new THREE.CapsuleGeometry(0.022, 0.162, 6, 12),
    accentHex,
    [0, 0, 0.011],
    [0, 0, 0],
    0,
    undefined,
    1.0,
    false,
    FINISH_OPTICAL_LENS,
  );
  addLuminousScooterPart(
    helper,
    vDrlGrp,
    new THREE.CapsuleGeometry(0.014, 0.150, 6, 12),
    '#f0fdff',
    '#67e8f9',
    0.95,
    [0, 0, 0.018],
  );

  // 3b) Wrap-Around Curved Horizontal Headlamp Bar (`y = 0.595, z = 0.558`) with Glossy Multi-Reflector Optics
  const headlampArcGeo = new THREE.CylinderGeometry(
    0.228,
    0.222,
    0.056,
    24,
    1,
    true,
    -Math.PI * 0.28,
    Math.PI * 0.56,
  );
  addLuminousScooterPart(
    helper,
    chassisGroup,
    headlampArcGeo,
    '#ffffff',
    '#bae6fd',
    0.78,
    [0, 0.598, 0.362],
    [0.06, 0, 0],
    getElectricHeadlampBarTexture(),
  );
  // Crisp cyan-teal lower brow accent directly under the horizontal headlamp bar
  const browPinGeo = new THREE.CylinderGeometry(
    0.230,
    0.230,
    0.010,
    22,
    1,
    true,
    -Math.PI * 0.28,
    Math.PI * 0.56,
  );
  helper.addPart(
    chassisGroup,
    browPinGeo,
    accentHex,
    [0, 0.566, 0.362],
    [0.06, 0, 0],
    0,
    undefined,
    1.0,
    false,
    FINISH_GLOSS_BODY,
  );

  // 3c) Recessed Dark-Charcoal Front Wheel-Well Arch & Inner Rider Leg-Shield Apron
  const innerLegShieldGeo = createLoftedBodyShellGeo(
    [
      { y: 0.255, z: 0.320, rx: 0.160, ryTop: 0.028, ryBot: 0.024, pitchRad: 1.35, power: 3.0 },
      { y: 0.460, z: 0.355, rx: 0.172, ryTop: 0.036, ryBot: 0.032, pitchRad: 1.42, power: 3.0 },
      { y: 0.720, z: 0.345, rx: 0.174, ryTop: 0.036, ryBot: 0.032, pitchRad: 1.66, power: 3.0 },
      { y: 0.965, z: 0.300, rx: 0.138, ryTop: 0.028, ryBot: 0.026, pitchRad: 1.72, power: 2.8 },
    ],
    16,
    'wrap',
  );
  helper.addPart(
    chassisGroup,
    innerLegShieldGeo,
    pal.trimCharcoal,
    [0, 0, 0],
    [0, 0, 0],
    0.005,
    undefined,
    1.0,
    true,
    FINISH_MATTE_TRIM,
  );
  // Inner rider utility bag hook & illuminated cyan smart-key ignition ring (visible in Rear & 3/4 views)
  helper.addPart(
    chassisGroup,
    new THREE.BoxGeometry(0.026, 0.048, 0.030),
    '#64748b',
    [0, 0.74, 0.302],
    [-0.14, 0, 0],
    0.002,
    undefined,
    1.0,
    false,
    FINISH_SATIN_METAL,
  );
  addLuminousScooterPart(
    helper,
    chassisGroup,
    new THREE.CylinderGeometry(0.022, 0.022, 0.018, 12),
    '#14b8a6',
    '#22d3ee',
    0.55,
    [0.088, 0.76, 0.305],
    [Math.PI / 2 - 0.14, 0, 0],
  );

  // 4) Lofted Rear Body Shell, Tapered Under-Seat Tub, Stitched 2-Up Saddle & Cast Grab Rail
  // 4a) Satin-Charcoal Under-Seat Front Tub rising cleanly from rear of floorboard (`z = -0.29 .. -0.09`)
  const underSeatTubGeo = createLoftedBodyShellGeo(
    [
      { y: 0.255, z: -0.185, rx: 0.132, ryTop: 0.040, ryBot: 0.024, pitchRad: 1.45, power: 2.8 },
      { y: 0.465, z: -0.195, rx: 0.140, ryTop: 0.048, ryBot: 0.040, pitchRad: 1.52, power: 2.8 },
      { y: 0.675, z: -0.210, rx: 0.146, ryTop: 0.046, ryBot: 0.042, pitchRad: 1.55, power: 2.8 },
    ],
    16,
    'wrap',
  );
  helper.addPart(
    chassisGroup,
    underSeatTubGeo,
    '#374151',
    [0, 0, 0],
    [0, 0, 0],
    0.005,
    undefined,
    1.0,
    true,
    FINISH_MATTE_TRIM,
  );

  // 4b) Organic Upswept Pearl-White Rear Body Shell with Boomerang Cyan Livery (`z = -0.80 .. -0.06`)
  const rearBodyGeo = createLoftedBodyShellGeo(
    [
      { y: 0.692, z: -0.800, rx: 0.118, ryTop: 0.036, ryBot: 0.034, pitchRad: 0.12, power: 2.8 },
      { y: 0.678, z: -0.680, rx: 0.168, ryTop: 0.056, ryBot: 0.052, pitchRad: 0.16, power: 3.0 },
      { y: 0.648, z: -0.480, rx: 0.194, ryTop: 0.072, ryBot: 0.074, pitchRad: 0.20, power: 3.1 },
      { y: 0.595, z: -0.260, rx: 0.190, ryTop: 0.088, ryBot: 0.095, pitchRad: 0.26, power: 3.0 },
      { y: 0.435, z: -0.105, rx: 0.174, ryTop: 0.092, ryBot: 0.110, pitchRad: 0.52, power: 2.9 },
      { y: 0.285, z: -0.040, rx: 0.164, ryTop: 0.050, ryBot: 0.042, pitchRad: 0.72, power: 2.8 },
    ],
    22,
    'side',
  );
  helper.addPart(
    chassisGroup,
    rearBodyGeo,
    bodyHex,
    [0, 0, 0],
    [0, 0, 0],
    0.008,
    options.bodyColorHex ? undefined : getElectricSideCowlTexture(),
    1.0,
    true,
    FINISH_GLOSS_BODY,
  );

  // 4c) Contoured Lofted 2-Up Ergonomic Saddle (`~78cm` Rider Bucket + `~82.5cm` Pillion Step, Stitched Leather)
  const saddleGeo = createLoftedBodyShellGeo(
    [
      { y: 0.775, z: -0.695, rx: 0.115, ryTop: 0.034, ryBot: 0.028, pitchRad: 0.06, power: 2.6 },
      { y: 0.790, z: -0.560, rx: 0.158, ryTop: 0.042, ryBot: 0.036, pitchRad: 0.05, power: 2.9 },
      { y: 0.785, z: -0.405, rx: 0.166, ryTop: 0.044, ryBot: 0.038, pitchRad: 0.08, power: 3.0 },
      { y: 0.742, z: -0.320, rx: 0.172, ryTop: 0.040, ryBot: 0.042, pitchRad: 0.04, power: 3.0 },
      { y: 0.736, z: -0.145, rx: 0.164, ryTop: 0.044, ryBot: 0.044, pitchRad: -0.04, power: 2.9 },
      { y: 0.748, z: 0.015, rx: 0.096, ryTop: 0.034, ryBot: 0.032, pitchRad: -0.18, power: 2.5 },
    ],
    20,
    'side',
  );
  helper.addPart(
    chassisGroup,
    saddleGeo,
    '#ffffff',
    [0, 0, 0],
    [0, 0, 0],
    0.006,
    getSaddleLeatherTexture(),
    1.0,
    true,
    FINISH_SADDLE_LEATHER,
  );

  // 4d) Cast Satin-Silver Wrap-Around Passenger Grab Rail (`z = -0.50 .. -0.82, y = 0.835`)
  const grabCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.162, 0.775, -0.50),
    new THREE.Vector3(-0.154, 0.826, -0.74),
    new THREE.Vector3(0, 0.838, -0.815),
    new THREE.Vector3(0.154, 0.826, -0.74),
    new THREE.Vector3(0.162, 0.775, -0.50),
  ]);
  helper.addPart(
    chassisGroup,
    new THREE.TubeGeometry(grabCurve, 24, 0.0165, 10, false),
    '#ffffff',
    [0, 0, 0],
    [0, 0, 0],
    0.004,
    getBrushedAluminumTexture(),
    1.0,
    true,
    FINISH_SATIN_METAL,
  );

  // 5) Flush Curved Slim LED Taillight Bar + Rear Turn Strips + Tapered Rear Mudguard Fender
  const tailArcGeo = new THREE.CylinderGeometry(
    0.168,
    0.164,
    0.036,
    20,
    1,
    true,
    Math.PI * 0.72,
    Math.PI * 0.56,
  );
  const brakeLightMesh = addLuminousScooterPart(
    helper,
    chassisGroup,
    tailArcGeo,
    '#ffffff',
    pal.taillightRed,
    0.92,
    [0, 0.692, -0.648],
    [0.10, 0, 0],
    getElectricTaillightBarTexture(),
  );

  // Sculpted Rear Mudguard Fender, License Plate Bracket & Reflectors (`z = -0.74 .. -0.90, y = 0.36 .. 0.64`)
  const rearFenderGrp = new THREE.Group();
  rearFenderGrp.position.set(0, 0.515, -0.805);
  rearFenderGrp.rotation.x = 0.46;
  chassisGroup.add(rearFenderGrp);

  const rearMudGeo = createLoftedBodyShellGeo(
    [
      { y: -0.14, z: -0.01, rx: 0.072, ryTop: 0.012, ryBot: 0.012, pitchRad: 1.57, power: 2.6 },
      { y: 0.0, z: 0.0, rx: 0.092, ryTop: 0.015, ryBot: 0.015, pitchRad: 1.57, power: 2.8 },
      { y: 0.14, z: 0.01, rx: 0.105, ryTop: 0.018, ryBot: 0.018, pitchRad: 1.57, power: 2.8 },
    ],
    14,
    'wrap',
  );
  helper.addPart(
    rearFenderGrp,
    rearMudGeo,
    pal.trimCharcoal,
    [0, 0, 0],
    [0, 0, 0],
    0.004,
    undefined,
    1.0,
    true,
    FINISH_MATTE_TRIM,
  );
  helper.addPart(
    rearFenderGrp,
    createRoundedRectExtrudeGeo(0.168, 0.112, 0.012, 0.018, 0.002),
    '#e2e8f0',
    [0, 0.015, -0.022],
    [Math.PI / 2, 0, 0],
    0.002,
    undefined,
    1.0,
    false,
    FINISH_SATIN_METAL,
  );
  addLuminousScooterPart(
    helper,
    rearFenderGrp,
    new THREE.BoxGeometry(0.068, 0.020, 0.014),
    pal.taillightRed,
    pal.taillightRed,
    0.55,
    [0, -0.095, -0.020],
  );
  for (const side of [-1, 1]) {
    addLuminousScooterPart(
      helper,
      rearFenderGrp,
      new THREE.CylinderGeometry(0.015, 0.015, 0.014, 12),
      pal.indicatorAmber,
      pal.indicatorAmber,
      0.55,
      [side * 0.096, 0.055, 0],
      [0, 0, Math.PI / 2],
    );
  }

  // 6) Articulated Steering Group (Lower Fork Tubes inside Wheel-Well + Curved Fender + Front Wheel + Winged Cockpit + Mirrors)
  const steeringGroup = new THREE.Group();
  steeringGroup.name = 'ElectricScooterSteeringGroup';
  steeringGroup.position.set(
    ELECTRIC_SCOOTER_BIKE_SPEC.steeringPivot.x,
    ELECTRIC_SCOOTER_BIKE_SPEC.steeringPivot.y,
    ELECTRIC_SCOOTER_BIKE_SPEC.steeringPivot.z,
  );
  chassisGroup.add(steeringGroup);

  // Telescopic Front Fork Legs cleanly terminated inside wheel-well (`y = -0.43` -> `-0.705`, never poking through front shield!)
  const forkDx = 0.34;
  const forkDy = -0.705;
  const forkAngleX = Math.atan2(forkDx, -forkDy);
  for (const side of [-1, 1]) {
    // Lower dark-gunmetal fork slider (`-0.705 .. -0.52`)
    helper.addPart(
      steeringGroup,
      new THREE.CylinderGeometry(0.021, 0.019, 0.24, 12),
      '#334155',
      [side * 0.080, forkDy * 0.88, forkDx * 0.88],
      [forkAngleX, 0, 0],
      0.003,
      undefined,
      1.0,
      false,
      FINISH_DARK_ALLOY,
    );
    // Upper chrome stanchion tucked cleanly under wheel-well (`-0.56 .. -0.40`)
    helper.addPart(
      steeringGroup,
      new THREE.CylinderGeometry(0.015, 0.015, 0.19, 10),
      '#cbd5e1',
      [side * 0.080, forkDy * 0.67, forkDx * 0.67],
      [forkAngleX, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_SATIN_METAL,
    );
  }
  // Hydraulic Front Disc Brake Caliper on Right Fork Slider
  helper.addPart(
    steeringGroup,
    new THREE.BoxGeometry(0.034, 0.064, 0.052),
    '#475569',
    [0.066, forkDy + 0.052, forkDx - 0.044],
    [0.3, 0, 0],
    0.002,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );

  // Sculpted Aerodynamic Pearl-White Front Mudguard Fender hugging Front Tire Arc
  const frontFenderArc = new THREE.TorusGeometry(0.278, 0.046, 10, 20, Math.PI * 0.68);
  frontFenderArc.rotateY(Math.PI / 2);
  frontFenderArc.scale(1.58, 1.0, 1.0);
  helper.addPart(
    steeringGroup,
    frontFenderArc,
    options.bodyColorHex ?? pal.bodyPearlWhite,
    [0, forkDy, forkDx],
    [-Math.PI * 0.24, 0, 0],
    0.005,
    undefined,
    1.0,
    true,
    FINISH_GLOSS_BODY,
  );

  // Front 5-Split-Spoke Alloy Wheel Assembly at `(0, -0.705, +0.34)` -> world `(0, 0.255, +0.64)`
  const frontWheelGroup = buildSpokeWheelAssembly(
    helper,
    ELECTRIC_SCOOTER_BIKE_SPEC.wheelOuterRadiusM,
    ELECTRIC_SCOOTER_BIKE_SPEC.tireSectionRadiusM,
    5,
    '#ffffff',
    pal.alloyWheelDark,
    '#1f242d',
    true,
  );
  frontWheelGroup.name = 'ElectricScooterFrontWheel';
  frontWheelGroup.position.set(0, forkDy, forkDx);
  steeringGroup.add(frontWheelGroup);

  // 6b) Sleek Sculpted Gull-Wing Handlebar Shroud & Hooded Digital LCD Cockpit (`1.04 .. 1.16m` world height)
  // Front Pearl-White Sculpted Handlebar Brow (`createLoftedBodyShellGeo` along X span!)
  const handlebarFrontBrow = createLoftedBodyShellGeo(
    [
      { y: 0.055, z: -0.005, rx: 0.082, ryTop: 0.022, ryBot: 0.018, power: 2.6 },
      { y: 0.105, z: 0.010, rx: 0.168, ryTop: 0.036, ryBot: 0.030, power: 3.0 },
      { y: 0.142, z: -0.012, rx: 0.184, ryTop: 0.032, ryBot: 0.028, power: 3.0 },
      { y: 0.168, z: -0.038, rx: 0.112, ryTop: 0.022, ryBot: 0.020, power: 2.6 },
    ],
    18,
    'wrap',
  );
  helper.addPart(
    steeringGroup,
    handlebarFrontBrow,
    options.bodyColorHex ?? pal.bodyPearlWhite,
    [0, 0, 0],
    [0, 0, 0],
    0.006,
    undefined,
    1.0,
    true,
    FINISH_GLOSS_BODY,
  );
  // Glossy Smoked Center Meter Visor Inset on Front of Handlebar Shroud (`screen_8a1fbcde.png` Front & 3/4 views)
  const frontMeterVisorGeo = createLoftedBodyShellGeo(
    [
      { y: 0.108, z: 0.026, rx: 0.068, ryTop: 0.014, ryBot: 0.012, power: 2.8 },
      { y: 0.148, z: 0.008, rx: 0.074, ryTop: 0.014, ryBot: 0.012, power: 2.8 },
      { y: 0.178, z: -0.018, rx: 0.062, ryTop: 0.012, ryBot: 0.010, power: 2.6 },
    ],
    14,
    'front',
  );
  helper.addPart(
    steeringGroup,
    frontMeterVisorGeo,
    '#1e293b',
    [0, 0, 0],
    [0, 0, 0],
    0.003,
    undefined,
    1.0,
    false,
    FINISH_OPTICAL_LENS,
  );

  // Hooded Satin-Charcoal Digital Cockpit Cluster + Illuminated Speedometer LCD (`Digital cockpit display`)
  const cockpitHoodGeo = createLoftedBodyShellGeo(
    [
      { y: 0.110, z: -0.058, rx: 0.118, ryTop: 0.030, ryBot: 0.024, power: 2.8 },
      { y: 0.156, z: -0.046, rx: 0.104, ryTop: 0.036, ryBot: 0.026, power: 2.8 },
      { y: 0.188, z: -0.018, rx: 0.084, ryTop: 0.020, ryBot: 0.018, power: 2.6 },
    ],
    16,
    'wrap',
  );
  helper.addPart(
    steeringGroup,
    cockpitHoodGeo,
    '#1e242d',
    [0, 0, 0],
    [0, 0, 0],
    0.004,
    undefined,
    1.0,
    true,
    FINISH_MATTE_TRIM,
  );
  addLuminousScooterPart(
    helper,
    steeringGroup,
    new THREE.PlaneGeometry(0.136, 0.072),
    '#ffffff',
    '#38bdf8',
    0.55,
    [0, 0.152, -0.074],
    [-0.48, Math.PI, 0],
    getElectricCockpitLcdTexture(),
  );

  // Swept Handlebars, Switchgear Pods, Knurled Grips, Curved Brake Levers & Teardrop Aerodynamic Mirrors (`70cm` span)
  for (const side of [-1, 1]) {
    helper.addPart(
      steeringGroup,
      new THREE.CylinderGeometry(0.013, 0.014, 0.16, 10),
      '#64748b',
      [side * 0.175, 0.132, -0.036],
      [0, -side * 0.18, Math.PI / 2],
      0.002,
      undefined,
      1.0,
      false,
      FINISH_SATIN_METAL,
    );
    // Sculpted Switchgear Pod with Cyan Mode Button
    helper.addPart(
      steeringGroup,
      createRoundedRectExtrudeGeo(0.044, 0.048, 0.044, 0.012, 0.004),
      '#232830',
      [side * 0.192, 0.112, -0.048],
      [0, -side * 0.18, 0],
      0.003,
      undefined,
      1.0,
      false,
      FINISH_MATTE_TRIM,
    );
    // Ergonomic Knurled Rubber Grip + Alloy Bar-End Cap (`x = ±0.21 .. ±0.31m`)
    helper.addPart(
      steeringGroup,
      new THREE.CylinderGeometry(0.0185, 0.0165, 0.115, 12),
      '#ffffff',
      [side * 0.262, 0.132, -0.060],
      [0, -side * 0.18, Math.PI / 2],
      0.003,
      getErgonomicGripTexture(),
      1.0,
      false,
      FINISH_RUBBER_TIRE,
    );
    helper.addPart(
      steeringGroup,
      new THREE.CylinderGeometry(0.0195, 0.0175, 0.014, 12),
      '#94a3b8',
      [side * 0.322, 0.132, -0.071],
      [0, -side * 0.18, Math.PI / 2],
      0.002,
      undefined,
      1.0,
      false,
      FINISH_SATIN_METAL,
    );
    // Curved Cast-Alloy Brake Lever
    const leverCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.205, 0.128, -0.032),
      new THREE.Vector3(side * 0.255, 0.125, -0.016),
      new THREE.Vector3(side * 0.305, 0.122, -0.026),
    ]);
    helper.addPart(
      steeringGroup,
      new THREE.TubeGeometry(leverCurve, 10, 0.0055, 6, false),
      '#cbd5e1',
      [0, 0, 0],
      [0, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_SATIN_METAL,
    );

    // Slender Swept Mirror Stalk + Teardrop Aerodynamic Mirror Housing (`x = ±0.35m` -> exact `70cm` span!)
    const stalkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.182, 0.158, -0.038),
      new THREE.Vector3(side * 0.258, 0.258, -0.044),
      new THREE.Vector3(side * 0.308, 0.308, -0.050),
    ]);
    helper.addPart(
      steeringGroup,
      new THREE.TubeGeometry(stalkCurve, 10, 0.0072, 8, false),
      '#475569',
      [0, 0, 0],
      [0, 0, 0],
      0.002,
      undefined,
      1.0,
      false,
      FINISH_SATIN_METAL,
    );

    const mirrorPodGrp = new THREE.Group();
    mirrorPodGrp.position.set(side * 0.334, 0.316, -0.052);
    mirrorPodGrp.rotation.set(0, -side * 0.22, side * 0.12);
    steeringGroup.add(mirrorPodGrp);

    const mirrorShellGeo = new THREE.SphereGeometry(0.054, 14, 10);
    mirrorShellGeo.scale(1.10, 0.64, 0.40);
    helper.addPart(
      mirrorPodGrp,
      mirrorShellGeo,
      '#475569',
      [0, 0, 0],
      [0, 0, 0],
      0.003,
      undefined,
      1.0,
      false,
      FINISH_DARK_ALLOY,
    );
    const mirrorGlassGeo = new THREE.CircleGeometry(0.044, 14);
    mirrorGlassGeo.scale(1.06, 0.58, 1.0);
    helper.addPart(
      mirrorPodGrp,
      mirrorGlassGeo,
      '#bae6fd',
      [0, 0, -0.022],
      [0, Math.PI, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_OPTICAL_LENS,
    );
  }

  // 7) Articulated Center Kickstand (`z = -0.18, y = 0.165`)
  const kickstandGroup = new THREE.Group();
  kickstandGroup.name = 'ElectricScooterCenterKickstand';
  kickstandGroup.position.set(
    ELECTRIC_SCOOTER_BIKE_SPEC.centerKickstandPivot.x,
    ELECTRIC_SCOOTER_BIKE_SPEC.centerKickstandPivot.y,
    ELECTRIC_SCOOTER_BIKE_SPEC.centerKickstandPivot.z,
  );
  chassisGroup.add(kickstandGroup);

  for (const side of [-1, 1]) {
    helper.addPart(
      kickstandGroup,
      new THREE.CylinderGeometry(0.011, 0.010, 0.185, 8),
      '#252a33',
      [side * 0.095, -0.082, -0.032],
      [0.34, 0, -side * 0.12],
      0.003,
      undefined,
      1.0,
      false,
      FINISH_DARK_ALLOY,
    );
    helper.addPart(
      kickstandGroup,
      new THREE.BoxGeometry(0.036, 0.012, 0.064),
      '#1e222a',
      [side * 0.106, -0.159, -0.052],
      [0, 0, 0],
      0.002,
      undefined,
      1.0,
      false,
      FINISH_DARK_ALLOY,
    );
  }
  helper.addPart(
    kickstandGroup,
    new THREE.CylinderGeometry(0.008, 0.008, 0.19, 6),
    '#333944',
    [0, -0.09, -0.035],
    [0, 0, Math.PI / 2],
    0,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );

  const setParked = (parked: boolean) => {
    kickstandGroup.rotation.x = parked ? 0 : 1.32;
  };
  const setSteerAngle = (angleRad: number) => {
    steeringGroup.rotation.y = angleRad;
  };
  const setBraking = (braking: boolean) => {
    const mat = brakeLightMesh.material as THREE.MeshStandardMaterial;
    if (mat && 'emissiveIntensity' in mat) {
      mat.emissiveIntensity = braking ? 1.85 : 0.92;
    }
  };
  const spinWheels = (forwardDistanceM: number, worldScale = 1.0) => {
    const dRad = computeScooterWheelSpinDeltaRad('electric_scooter_bike', forwardDistanceM, worldScale);
    frontWheelGroup.rotation.x += dRad;
    rearWheelGroup.rotation.x += dRad;
  };

  setParked(isParkedInit);
  if (options.steerAngleRad) setSteerAngle(options.steerAngleRad);

  return {
    root,
    chassisGroup,
    steeringGroup,
    frontWheelGroup,
    rearWheelGroup,
    kickstandGroup,
    brakeLightMesh,
    setParked,
    setSteerAngle,
    setBraking,
    spinWheels,
  };
}

/**
 * Creates the Modern Urban Push Scooter ("Kick Scooter") matching all 4 views
 * of `screen_e2bde276.png` (`~92cm` length, `~74cm` wheelbase, `~98cm` T-bar, `200mm` PU wheels,
 * plus exact `85cm x 32cm` compact folded state with carrying strap).
 */
export function createPushKickScooter3D(
  options: CreatePushKickScooterOptions = {},
): PushKickScooter3DHandle {
  const helper = options.partHelper ?? makeStandardFallbackHelper();
  const pal = PUSH_KICK_SCOOTER_SPEC.palette;
  const frameHex = options.bodyColorHex ?? '#ffffff';
  const frameTex = options.bodyColorHex ? undefined : getBrushedAluminumTexture();
  const accentHex = options.accentColorHex ?? pal.accentCyan;
  const isFoldedInit = options.folded ?? false;
  const isParkedInit = isFoldedInit ? false : (options.parked ?? true);

  const root = new THREE.Group();
  root.name = 'ModernUrbanPushKickScooter3D';

  if (options.includeContactShadow !== false) {
    if (options.partHelper) {
      helper.addPart(
        root,
        createRoundedRectExtrudeGeo(0.24, 0.88, 0.004, 0.10, 0),
        '#1a2029',
        [0, 0.003, 0],
        [0, 0, 0],
        0,
        undefined,
        1.0,
        false,
        FINISH_MATTE_TRIM,
      );
    } else {
      const shadGeo = new THREE.PlaneGeometry(0.42, 1.08);
      shadGeo.rotateX(-Math.PI / 2);
      const shadMat = new THREE.MeshBasicMaterial({
        map: getSoftContactShadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.66,
      });
      const shadMesh = new THREE.Mesh(shadGeo, shadMat);
      shadMesh.position.set(0, 0.007, 0);
      root.add(shadMesh);
    }
  }

  const leanGroup = new THREE.Group();
  leanGroup.name = 'PushScooterLeanGroup';
  root.add(leanGroup);

  const deckGroup = new THREE.Group();
  deckGroup.name = 'PushScooterDeckGroup';
  leanGroup.add(deckGroup);

  // 1) Rear 200mm 5-Split-Spoke PU Wheel (`z = -0.36, y = 0.10`) + Drilled Rear Micro-Disc Rotor
  const rearWheelGroup = buildSpokeWheelAssembly(
    helper,
    PUSH_KICK_SCOOTER_SPEC.wheelOuterRadiusM,
    PUSH_KICK_SCOOTER_SPEC.tireSectionRadiusM,
    5,
    '#ffffff',
    pal.wheelCoreAlloy,
    '#334155',
    true,
  );
  rearWheelGroup.name = 'PushScooterRearWheel';
  rearWheelGroup.position.set(0, 0.10, -0.36);
  deckGroup.add(rearWheelGroup);

  // Sculpted Brushed-Aluminum Rear Dropout Arms + Recessed Cyan Pinstripe Slots (`screen_e2bde276.png` Side & 3/4)
  for (const side of [-1, 1]) {
    const dropoutGeo = createLoftedBodyShellGeo(
      [
        { y: 0.098, z: -0.375, rx: 0.009, ryTop: 0.015, ryBot: 0.015, power: 2.6 },
        { y: 0.098, z: -0.285, rx: 0.011, ryTop: 0.019, ryBot: 0.017, power: 2.8 },
        { y: 0.096, z: -0.195, rx: 0.013, ryTop: 0.020, ryBot: 0.018, power: 2.8 },
      ],
      12,
      'side',
    );
    helper.addPart(
      deckGroup,
      dropoutGeo,
      frameHex,
      [side * 0.044, 0, 0],
      [0, 0, 0],
      0.003,
      frameTex,
      1.0,
      true,
      FINISH_SATIN_METAL,
    );
    helper.addPart(
      deckGroup,
      new THREE.BoxGeometry(0.008, 0.007, 0.095),
      accentHex,
      [side * 0.053, 0.098, -0.285],
      [0, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_GLOSS_BODY,
    );
  }

  // 2) Low-Clearance Brushed-Aluminum Deck (`~8cm` ground clearance) & Geometric High-Grip Footpad
  helper.addPart(
    deckGroup,
    createRoundedRectExtrudeGeo(
      PUSH_KICK_SCOOTER_SPEC.deckWidthM,
      PUSH_KICK_SCOOTER_SPEC.deckLengthM,
      0.030,
      0.068,
      0.005,
    ),
    frameHex,
    [0, PUSH_KICK_SCOOTER_SPEC.deckClearanceM, -0.02],
    [0, 0, 0],
    0.005,
    frameTex,
    1.0,
    true,
    FINISH_SATIN_METAL,
  );
  // Satin-Charcoal Perimeter Bumper Trim + Cyan Pinstripe Accents along Deck Flanks (offset outside ±0.084 bevel)
  for (const side of [-1, 1]) {
    helper.addPart(
      deckGroup,
      new THREE.BoxGeometry(0.006, 0.017, 0.36),
      pal.stemCharcoal,
      [side * 0.0865, 0.095, -0.02],
      [0, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_MATTE_TRIM,
    );
    helper.addPart(
      deckGroup,
      new THREE.BoxGeometry(0.006, 0.0065, 0.28),
      accentHex,
      [side * 0.0895, 0.096, -0.02],
      [0, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_GLOSS_BODY,
    );
  }
  // Top Textured Geometric Diamond High-Grip Footpad (`y = 0.114`)
  helper.addPart(
    deckGroup,
    createRoundedRectExtrudeGeo(0.132, 0.435, 0.004, 0.054, 0.001),
    '#ffffff',
    [0, 0.112, -0.02],
    [0, 0, 0],
    0.002,
    getKickGeometricGripDeckTexture(),
    0.6,
    false,
    FINISH_RUBBER_TIRE,
  );

  // 3) Curved Satin-Charcoal Rear Fender Foot-Brake + Integrated Flush Red Safety Reflector
  const rearFenderArc = new THREE.TorusGeometry(0.115, 0.019, 10, 18, Math.PI * 0.64);
  rearFenderArc.rotateY(Math.PI / 2);
  rearFenderArc.scale(1.48, 1.0, 1.0);
  helper.addPart(
    deckGroup,
    rearFenderArc,
    pal.stemCharcoal,
    [0, 0.10, -0.36],
    [Math.PI * 0.36, 0, 0],
    0.004,
    undefined,
    1.0,
    true,
    FINISH_MATTE_TRIM,
  );
  addLuminousScooterPart(
    helper,
    deckGroup,
    new THREE.BoxGeometry(0.026, 0.014, 0.012),
    pal.reflectorRed,
    pal.reflectorRed,
    0.72,
    [0, 0.165, -0.462],
    [-0.4, 0, 0],
  );

  // 4) Sculpted Chamfered Brushed-Aluminum Gooseneck & Folding Joint Safety Lock (`z = +0.16 .. +0.30`)
  const neckGussetGeo = createLoftedBodyShellGeo(
    [
      { y: 0.098, z: 0.155, rx: 0.036, ryTop: 0.020, ryBot: 0.018, pitchRad: 0.65, power: 3.0 },
      { y: 0.152, z: 0.232, rx: 0.029, ryTop: 0.024, ryBot: 0.022, pitchRad: 0.85, power: 3.0 },
      { y: 0.198, z: 0.285, rx: 0.028, ryTop: 0.026, ryBot: 0.024, pitchRad: 1.05, power: 3.0 },
    ],
    14,
    'side',
  );
  helper.addPart(
    deckGroup,
    neckGussetGeo,
    frameHex,
    [0, 0, 0],
    [0, 0, 0],
    0.004,
    frameTex,
    1.0,
    true,
    FINISH_SATIN_METAL,
  );
  // Machined Charcoal Folding Hinge Knuckle + Cyan Quick-Release Safety Lock Lever
  helper.addPart(
    deckGroup,
    createRoundedRectExtrudeGeo(0.062, 0.060, 0.054, 0.014, 0.004),
    pal.stemCharcoal,
    [0, 0.172, 0.282],
    [-0.22, 0, 0],
    0.004,
    undefined,
    1.0,
    true,
    FINISH_DARK_ALLOY,
  );
  helper.addPart(
    deckGroup,
    new THREE.BoxGeometry(0.014, 0.044, 0.020),
    accentHex,
    [0.035, 0.202, 0.276],
    [-0.35, 0, 0],
    0.002,
    undefined,
    1.0,
    false,
    FINISH_GLOSS_BODY,
  );

  // 5) Lower Headtube, Ribbed Elastomer Front Suspension Fork & Front 200mm PU Wheel
  const steeringGroup = new THREE.Group();
  steeringGroup.name = 'PushScooterSteeringGroup';
  steeringGroup.position.set(
    PUSH_KICK_SCOOTER_SPEC.steeringPivot.x,
    PUSH_KICK_SCOOTER_SPEC.steeringPivot.y,
    PUSH_KICK_SCOOTER_SPEC.steeringPivot.z,
  );
  deckGroup.add(steeringGroup);

  // Chamfered Brushed-Aluminum Headtube with Front Cyan-Framed Reflector Badge (`Pinstripe accents`)
  helper.addPart(
    steeringGroup,
    new THREE.CylinderGeometry(0.026, 0.027, 0.108, 16),
    frameHex,
    [0, 0.016, -0.005],
    [PUSH_KICK_SCOOTER_SPEC.stemRakeRad, 0, 0],
    0.004,
    frameTex,
    1.0,
    true,
    FINISH_SATIN_METAL,
  );
  helper.addPart(
    steeringGroup,
    new THREE.BoxGeometry(0.022, 0.064, 0.012),
    accentHex,
    [0, 0.018, 0.022],
    [PUSH_KICK_SCOOTER_SPEC.stemRakeRad, 0, 0],
    0,
    undefined,
    1.0,
    false,
    FINISH_GLOSS_BODY,
  );
  addLuminousScooterPart(
    helper,
    steeringGroup,
    new THREE.BoxGeometry(0.014, 0.048, 0.014),
    '#f0fdff',
    '#67e8f9',
    0.7,
    [0, 0.018, 0.025],
    [PUSH_KICK_SCOOTER_SPEC.stemRakeRad, 0, 0],
  );

  // Accordion Ribbed Elastomer Front Suspension Dust Boot (`Front suspension fork`)
  for (let b = 0; b < 4; b++) {
    const bootRing = new THREE.TorusGeometry(0.021, 0.0050, 6, 14);
    bootRing.rotateX(Math.PI / 2);
    helper.addPart(
      steeringGroup,
      bootRing,
      '#1e222a',
      [0, -0.040 - b * 0.010, 0.010 + b * 0.0025],
      [PUSH_KICK_SCOOTER_SPEC.stemRakeRad, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_RUBBER_TIRE,
    );
  }

  // Sculpted Brushed-Aluminum Front Fork Blades + Cyan Pinstripes straddling the 200mm PU Wheel
  for (const side of [-1, 1]) {
    helper.addPart(
      steeringGroup,
      new THREE.BoxGeometry(0.015, 0.128, 0.032),
      frameHex,
      [side * 0.035, -0.105, 0.034],
      [-0.24, 0, 0],
      0.003,
      frameTex,
      1.0,
      true,
      FINISH_SATIN_METAL,
    );
    helper.addPart(
      steeringGroup,
      new THREE.BoxGeometry(0.017, 0.075, 0.008),
      accentHex,
      [side * 0.036, -0.105, 0.036],
      [-0.24, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_GLOSS_BODY,
    );
  }
  // Mini Front Reflector on Fork Crown
  addLuminousScooterPart(
    helper,
    steeringGroup,
    new THREE.BoxGeometry(0.024, 0.016, 0.010),
    pal.reflectorFront,
    '#e0f2fe',
    0.6,
    [0, -0.056, 0.038],
    [-0.18, 0, 0],
  );
  // Curved Satin-Charcoal Front Mudguard Fender
  const kickFrontFender = new THREE.TorusGeometry(0.114, 0.018, 8, 16, Math.PI * 0.54);
  kickFrontFender.rotateY(Math.PI / 2);
  kickFrontFender.scale(1.42, 1.0, 1.0);
  helper.addPart(
    steeringGroup,
    kickFrontFender,
    pal.stemCharcoal,
    [0, -0.14, 0.045],
    [-Math.PI * 0.16, 0, 0],
    0.003,
    undefined,
    1.0,
    true,
    FINISH_MATTE_TRIM,
  );

  const frontWheelGroup = buildSpokeWheelAssembly(
    helper,
    PUSH_KICK_SCOOTER_SPEC.wheelOuterRadiusM,
    PUSH_KICK_SCOOTER_SPEC.tireSectionRadiusM,
    5,
    '#ffffff',
    pal.wheelCoreAlloy,
    '#334155',
    false,
  );
  frontWheelGroup.name = 'PushScooterFrontWheel';
  frontWheelGroup.position.set(0, -0.14, 0.045);
  steeringGroup.add(frontWheelGroup);

  // 6) Satin-Charcoal Folding Steering Mast, Height-Adjustment Latch & Ergonomic 48cm T-Bar
  const foldingNeckGroup = new THREE.Group();
  foldingNeckGroup.name = 'PushScooterFoldingStemGroup';
  foldingNeckGroup.position.set(0, 0.045, -0.01);
  foldingNeckGroup.rotation.x = PUSH_KICK_SCOOTER_SPEC.stemRakeRad;
  steeringGroup.add(foldingNeckGroup);

  // Lower Satin-Charcoal Anodized Mast Tube (`0 .. 0.43m` along stem)
  helper.addPart(
    foldingNeckGroup,
    new THREE.CylinderGeometry(0.022, 0.024, 0.43, 14),
    pal.stemCharcoal,
    [0, 0.215, 0],
    [0, 0, 0],
    0.004,
    undefined,
    1.0,
    true,
    FINISH_DARK_ALLOY,
  );
  // Quick-Release Height-Adjustment Collar Latch (`y = 0.435m` along stem)
  helper.addPart(
    foldingNeckGroup,
    new THREE.CylinderGeometry(0.028, 0.028, 0.044, 14),
    '#1e242d',
    [0, 0.435, 0],
    [0, 0, 0],
    0.003,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );
  helper.addPart(
    foldingNeckGroup,
    new THREE.BoxGeometry(0.036, 0.022, 0.038),
    accentHex,
    [0.020, 0.435, 0.008],
    [0, 0, 0],
    0.002,
    undefined,
    1.0,
    false,
    FINISH_GLOSS_BODY,
  );
  // Telescoping Satin-Charcoal Upper Shaft (`0.45 .. 0.70m` along stem -> `~98cm` T-bar height)
  helper.addPart(
    foldingNeckGroup,
    new THREE.CylinderGeometry(0.0185, 0.0195, 0.27, 14),
    '#3d4554',
    [0, 0.575, 0],
    [0, 0, 0],
    0.0035,
    undefined,
    1.0,
    true,
    FINISH_DARK_ALLOY,
  );

  // Forged Center T-Bar Stem Clamp (`y = 0.71m` along stem)
  helper.addPart(
    foldingNeckGroup,
    createRoundedRectExtrudeGeo(0.072, 0.056, 0.046, 0.016, 0.004),
    pal.stemCharcoal,
    [0, 0.688, 0],
    [0, 0, 0],
    0.004,
    undefined,
    1.0,
    true,
    FINISH_DARK_ALLOY,
  );
  // Horizontal Brushed-Aluminum T-Bar (`48cm` total width)
  helper.addPart(
    foldingNeckGroup,
    new THREE.CylinderGeometry(0.014, 0.014, PUSH_KICK_SCOOTER_SPEC.tBarWidthM, 12),
    frameHex,
    [0, 0.712, 0],
    [0, 0, Math.PI / 2],
    0.003,
    frameTex,
    1.0,
    true,
    FINISH_SATIN_METAL,
  );
  // Ergonomic Palm-Contoured Knurled Rubber Grips (`x = ±0.12 .. ±0.24`)
  for (const side of [-1, 1]) {
    helper.addPart(
      foldingNeckGroup,
      new THREE.CylinderGeometry(0.019, 0.0165, 0.126, 12),
      '#ffffff',
      [side * 0.18, 0.712, 0],
      [0, 0, Math.PI / 2],
      0.003,
      getErgonomicGripTexture(),
      1.0,
      false,
      FINISH_RUBBER_TIRE,
    );
    // Ergonomic palm-rest wing pad on rear side of grip
    helper.addPart(
      foldingNeckGroup,
      new THREE.BoxGeometry(0.095, 0.014, 0.028),
      pal.gripDark,
      [side * 0.188, 0.708, -0.012],
      [0.18, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_RUBBER_TIRE,
    );
    helper.addPart(
      foldingNeckGroup,
      new THREE.CylinderGeometry(0.022, 0.019, 0.016, 12),
      '#181c23',
      [side * 0.242, 0.712, 0],
      [0, 0, Math.PI / 2],
      0.002,
      undefined,
      1.0,
      false,
      FINISH_DARK_ALLOY,
    );
  }
  // Curved Alloy Hand-Brake Lever & Bowden Brake Cable (matching Front & 3/4 views)
  const kickLeverCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.102, 0.706, -0.016),
    new THREE.Vector3(0.148, 0.702, -0.032),
    new THREE.Vector3(0.196, 0.700, -0.026),
  ]);
  helper.addPart(
    foldingNeckGroup,
    new THREE.TubeGeometry(kickLeverCurve, 10, 0.005, 6, false),
    '#94a3b8',
    [0, 0, 0],
    [0, 0, 0],
    0,
    undefined,
    1.0,
    false,
    FINISH_SATIN_METAL,
  );
  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.105, 0.70, -0.018),
    new THREE.Vector3(0.052, 0.62, 0.026),
    new THREE.Vector3(0.016, 0.46, 0.022),
    new THREE.Vector3(0.0, 0.22, 0.018),
  ]);
  helper.addPart(
    foldingNeckGroup,
    new THREE.TubeGeometry(cableCurve, 14, 0.0035, 6, false),
    '#181c23',
    [0, 0, 0],
    [0, 0, 0],
    0,
    undefined,
    1.0,
    false,
    FINISH_MATTE_TRIM,
  );

  // Woven Carrying Strap shown in Compact Folded State (`85cm x 32cm`, Quadrant 3 of `screen_e2bde276.png`)
  const carryingStrapGroup = new THREE.Group();
  carryingStrapGroup.name = 'PushScooterCarryingStrap';
  deckGroup.add(carryingStrapGroup);
  const strapCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.24, 0.22),
    new THREE.Vector3(0.012, 0.17, 0.04),
    new THREE.Vector3(0.012, 0.16, -0.14),
    new THREE.Vector3(0, 0.23, -0.32),
  ]);
  helper.addPart(
    carryingStrapGroup,
    new THREE.TubeGeometry(strapCurve, 16, 0.009, 6, false),
    '#1e242d',
    [0, 0, 0],
    [0, 0, 0],
    0.002,
    undefined,
    1.0,
    false,
    FINISH_RUBBER_TIRE,
  );

  // 7) Retractable Side Kickstand (`x = +0.068, y = 0.084, z = -0.05`)
  const kickstandGroup = new THREE.Group();
  kickstandGroup.name = 'PushScooterSideKickstand';
  kickstandGroup.position.set(
    PUSH_KICK_SCOOTER_SPEC.sideKickstandPivot.x,
    PUSH_KICK_SCOOTER_SPEC.sideKickstandPivot.y,
    PUSH_KICK_SCOOTER_SPEC.sideKickstandPivot.z,
  );
  deckGroup.add(kickstandGroup);

  helper.addPart(
    kickstandGroup,
    new THREE.CylinderGeometry(0.007, 0.006, 0.105, 8),
    '#333944',
    [0.022, -0.042, -0.018],
    [0.32, 0, -0.44],
    0.002,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );
  helper.addPart(
    kickstandGroup,
    new THREE.BoxGeometry(0.022, 0.009, 0.032),
    '#1e2229',
    [0.042, -0.084, -0.034],
    [0, 0, 0],
    0,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );

  let currentParked = isParkedInit;
  let currentFolded = isFoldedInit;

  const syncPose = () => {
    if (currentFolded) {
      foldingNeckGroup.rotation.x = -1.50;
      kickstandGroup.rotation.x = 1.38;
      leanGroup.rotation.z = 0;
      carryingStrapGroup.visible = true;
    } else {
      foldingNeckGroup.rotation.x = PUSH_KICK_SCOOTER_SPEC.stemRakeRad;
      carryingStrapGroup.visible = false;
      kickstandGroup.rotation.x = currentParked ? 0 : 1.38;
      leanGroup.rotation.z = currentParked ? PUSH_KICK_SCOOTER_SPEC.parkedLeanRollRad : 0;
    }
  };

  const setParked = (parked: boolean) => {
    currentParked = parked;
    syncPose();
  };
  const setFolded = (folded: boolean) => {
    currentFolded = folded;
    syncPose();
  };
  const setSteerAngle = (angleRad: number) => {
    steeringGroup.rotation.y = angleRad;
  };
  const spinWheels = (forwardDistanceM: number, worldScale = 1.0) => {
    const dRad = computeScooterWheelSpinDeltaRad('push_kick_scooter', forwardDistanceM, worldScale);
    frontWheelGroup.rotation.x += dRad;
    rearWheelGroup.rotation.x += dRad;
  };

  syncPose();
  if (options.steerAngleRad) setSteerAngle(options.steerAngleRad);

  return {
    root,
    deckGroup,
    leanGroup,
    foldingNeckGroup,
    steeringGroup,
    frontWheelGroup,
    rearWheelGroup,
    kickstandGroup,
    carryingStrapGroup,
    setParked,
    setFolded,
    setSteerAngle,
    spinWheels,
  };
}

/**
 * Helper: Builds a sculpted Urban Commuter Helmet with Tinted Visor & Cyan Accent Stripe
 * for the Scooter Showroom interior shelves and podiums.
 */
function addShowroomUrbanHelmet(
  helper: ScooterToonPartHelper,
  parent: THREE.Object3D,
  pos: [number, number, number],
  rotY: number,
  shellHex: string,
  accentHex = '#14b8a6',
): THREE.Group {
  const hGrp = new THREE.Group();
  hGrp.position.set(pos[0], pos[1], pos[2]);
  hGrp.rotation.y = rotY;
  parent.add(hGrp);

  // Wooden/steel helmet stand base
  helper.addPart(hGrp, new THREE.CylinderGeometry(0.08, 0.09, 0.02, 10), '#334155', [0, 0.01, 0], [0, 0, 0], 0.003, undefined, 1.0, false);
  helper.addPart(hGrp, new THREE.CylinderGeometry(0.016, 0.016, 0.08, 8), '#94a3b8', [0, 0.05, 0], [0, 0, 0], 0, undefined, 1.0, false);
  // Rounded open-face urban helmet shell
  const domeGeo = new THREE.SphereGeometry(0.135, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.68);
  domeGeo.scale(0.94, 1.0, 1.12);
  helper.addPart(hGrp, domeGeo, shellHex, [0, 0.16, 0], [0.08, 0, 0], 0.005, undefined, 1.0, false);
  // Center aerodynamic cyan racing stripe
  const stripeGeo = new THREE.BoxGeometry(0.028, 0.09, 0.24);
  helper.addPart(hGrp, stripeGeo, accentHex, [0, 0.255, -0.01], [0.08, 0, 0], 0, undefined, 1.0, false);
  // Dark tinted flip-down polycarbonate visor
  const visorGeo = new THREE.CylinderGeometry(0.132, 0.138, 0.078, 12, 1, true, -Math.PI * 0.36, Math.PI * 0.72);
  helper.addPart(hGrp, visorGeo, '#0f172a', [0, 0.155, 0.022], [0.12, 0, 0], 0.003, undefined, 1.0, false);

  return hGrp;
}

/**
 * Builds the complete Central Plaza Urban Scooter & E-Mobility Showroom (`screenshot_12_f23594d9.png`)
 * along with the 2 non-rideable static showcase scooters displayed in front of its glass storefront.
 */
export function buildUrbanScooterShowroomKiosk3D(
  opts: BuildUrbanScooterShowroomOptions,
): THREE.Group {
  const COL_KIOSK_STEEL = '#2b3036';
  const COL_KIOSK_WOOD = '#c28a54';
  const COL_KIOSK_LED = '#ffefc2';
  const COL_CYAN_ACCENT = '#14b8a6';

  const scooterShopGrp = new THREE.Group();
  scooterShopGrp.name = 'LobbyUrbanScooterShowroomKiosk';
  scooterShopGrp.position.set(
    URBAN_SCOOTER_SHOP_LAYOUT.kioskLocalX,
    URBAN_SCOOTER_SHOP_LAYOUT.kioskLocalY,
    URBAN_SCOOTER_SHOP_LAYOUT.kioskLocalZ,
  );
  scooterShopGrp.rotation.y = URBAN_SCOOTER_SHOP_LAYOUT.kioskRotY;
  scooterShopGrp.scale.setScalar(URBAN_SCOOTER_SHOP_LAYOUT.kioskScale);
  opts.westPlantGroup.add(scooterShopGrp);

  const partHelper: ScooterToonPartHelper = {
    isSoftwareGl: opts.isSoftwareGl,
    addPart(
      parent,
      geo,
      colorHex,
      pos,
      rot = [0, 0, 0],
      toonStrokeWidth = 0.008,
      tex,
      bumpScale = 1.4,
      castShad = true,
    ) {
      const m = opts.addLobbyPart(parent, geo, colorHex, pos, rot, 0, tex, bumpScale);
      m.castShadow = !opts.isSoftwareGl && castShad;
      if (toonStrokeWidth > 0) {
        const st = opts.createBlitzStrokeMesh(geo, toonStrokeWidth);
        if (st) m.add(st);
      }
      return m;
    },
  };

  const addGlassPane = (
    parent: THREE.Object3D,
    w: number,
    h: number,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
  ) => {
    const gMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), opts.sharedClearGlassMat);
    gMesh.position.set(pos[0], pos[1], pos[2]);
    gMesh.rotation.set(rot[0], rot[1], rot[2]);
    gMesh.castShadow = false;
    gMesh.receiveShadow = false;
    parent.add(gMesh);
    return gMesh;
  };

  // 1) Non-Overlapping 4-Sided Mitred Steel Perimeter Plinth & Showroom Floor Slab
  const perimeterCurbPath: [number, number][] = [
    [-2.13, -1.53],
    [2.13, -1.53],
    [2.13, 1.53],
    [-2.13, 1.53],
  ];
  partHelper.addPart(
    scooterShopGrp,
    opts.createMitredPolylineStripGeometry(perimeterCurbPath, 0.22, 0.19, true),
    COL_KIOSK_STEEL,
    [0, 0.105, 0],
    [0, 0, 0],
    0.011,
    opts.textures.steelRoofTex,
  );
  partHelper.addPart(
    scooterShopGrp,
    new THREE.BoxGeometry(4.02, 0.19, 2.82),
    '#dde3ea',
    [0, 0.115, 0],
    [0, 0, 0],
    0,
    opts.textures.granitePaverTex,
    1.2,
    false,
  );

  // 4 Corner Dark Charcoal Steel Columns (`x = ±2.14, z = ±1.54`) + Upper Mitred Steel Architrave Ring
  for (const cx of [-2.14, 2.14]) {
    for (const cz of [-1.54, 1.54]) {
      partHelper.addPart(
        scooterShopGrp,
        new THREE.BoxGeometry(0.20, 2.62, 0.20),
        COL_KIOSK_STEEL,
        [cx, 1.51, cz],
        [0, 0, 0],
        0.011,
        opts.textures.steelRoofTex,
      );
    }
  }
  const frameRectPath: [number, number][] = [
    [-2.14, -1.54],
    [2.14, -1.54],
    [2.14, 1.54],
    [-2.14, 1.54],
  ];
  partHelper.addPart(
    scooterShopGrp,
    opts.createMitredPolylineStripGeometry(frameRectPath, 0.18, 0.14, true),
    COL_KIOSK_STEEL,
    [0, 2.74, 0],
    [0, 0, 0],
    0.010,
    opts.textures.steelRoofTex,
  );

  // 2) Front Elevation (`+Z = +1.54`): 2 Panoramic Display Glass Bays (Left & Center) + Right Glass Entrance Door
  for (const mx of [-0.72, 0.72]) {
    partHelper.addPart(
      scooterShopGrp,
      new THREE.BoxGeometry(0.12, 2.54, 0.14),
      COL_KIOSK_STEEL,
      [mx, 1.48, 1.54],
      [0, 0, 0],
      0.009,
      opts.textures.steelRoofTex,
    );
  }
  partHelper.addPart(
    scooterShopGrp,
    new THREE.BoxGeometry(2.86, 0.06, 0.12),
    COL_KIOSK_STEEL,
    [-0.71, 0.24, 1.54],
    [0, 0, 0],
    0.007,
  );
  addGlassPane(scooterShopGrp, 1.30, 2.40, [-1.43, 1.48, 1.54], [0, 0, 0]);
  addGlassPane(scooterShopGrp, 1.32, 2.40, [0.0, 1.48, 1.54], [0, 0, 0]);

  // Right Bay Framed Glass Entrance Door (`x in [+0.78 .. +2.04]`)
  partHelper.addPart(scooterShopGrp, new THREE.BoxGeometry(0.08, 2.40, 0.08), '#3b424c', [0.82, 1.42, 1.54], [0, 0, 0], 0.007);
  partHelper.addPart(scooterShopGrp, new THREE.BoxGeometry(0.08, 2.40, 0.08), '#3b424c', [2.00, 1.42, 1.54], [0, 0, 0], 0.007);
  partHelper.addPart(scooterShopGrp, new THREE.BoxGeometry(1.24, 0.09, 0.08), '#3b424c', [1.41, 2.58, 1.54], [0, 0, 0], 0.007);
  partHelper.addPart(scooterShopGrp, new THREE.BoxGeometry(1.24, 0.08, 0.08), '#3b424c', [1.41, 0.25, 1.54], [0, 0, 0], 0.007);
  addGlassPane(scooterShopGrp, 1.10, 2.24, [1.41, 1.42, 1.54], [0, 0, 0]);
  partHelper.addPart(scooterShopGrp, new THREE.BoxGeometry(0.04, 0.22, 0.09), '#cbd5e1', [0.90, 1.18, 1.56], [0, 0, 0], 0.005, undefined, 1.0, false);
  partHelper.addPart(scooterShopGrp, new THREE.BoxGeometry(0.14, 0.035, 0.12), '#e2e8f0', [0.95, 1.20, 1.59], [0, 0, 0], 0.005, undefined, 1.0, false);

  // 3) Side Profile Panoramic Glass Walls (`±X = ±2.14`)
  for (const sideX of [-2.14, 2.14]) {
    for (const mz of [-0.52, 0.48]) {
      partHelper.addPart(scooterShopGrp, new THREE.BoxGeometry(0.14, 2.54, 0.12), COL_KIOSK_STEEL, [sideX, 1.48, mz], [0, 0, 0], 0.009, opts.textures.steelRoofTex);
    }
    partHelper.addPart(scooterShopGrp, new THREE.BoxGeometry(0.12, 0.06, 2.86), COL_KIOSK_STEEL, [sideX, 0.24, 0.0], [0, 0, 0], 0.007);
    addGlassPane(scooterShopGrp, 2.86, 2.40, [sideX, 1.48, 0.0], [0, Math.PI / 2, 0]);
  }

  // 4) Rear Elevation (`-Z = -1.52`): Solid Vertical Timber Cladding, Staff Door, Grille & Utility Conduits
  partHelper.addPart(scooterShopGrp, new THREE.BoxGeometry(4.06, 2.56, 0.16), COL_KIOSK_WOOD, [0, 1.49, -1.52], [0, 0, 0], 0.012, opts.textures.verticalTimberTex, 1.6);
  partHelper.addPart(scooterShopGrp, new THREE.BoxGeometry(1.16, 2.16, 0.04), COL_KIOSK_STEEL, [-1.02, 1.29, -1.62], [0, 0, 0], 0.010);
  partHelper.addPart(scooterShopGrp, new THREE.BoxGeometry(1.02, 2.04, 0.04), '#c8ccd2', [-1.02, 1.29, -1.66], [0, 0, 0], 0.008, opts.textures.concreteTex, 1.8);
  partHelper.addPart(scooterShopGrp, new THREE.BoxGeometry(0.14, 0.05, 0.06), '#2b3036', [-0.62, 1.22, -1.70], [0, 0, 0], 0.005);
  partHelper.addPart(scooterShopGrp, new THREE.BoxGeometry(0.84, 0.72, 0.06), '#47505c', [1.18, 0.68, -1.63], [0, 0, 0], 0.010, opts.textures.louverTex, 1.0);
  partHelper.addPart(scooterShopGrp, new THREE.CylinderGeometry(0.024, 0.024, 2.36, 8), '#64748b', [0.32, 1.46, -1.63], [0, 0, 0], 0.005, undefined, 1.0, false);
  partHelper.addPart(scooterShopGrp, new THREE.CylinderGeometry(0.022, 0.022, 0.78, 8), '#64748b', [0.71, 0.30, -1.63], [0, 0, Math.PI / 2], 0.005, undefined, 1.0, false);

  // 5) Cantilevered Sloped Canopy Roof, Integrated LED Spotlights & Architectural Showroom Fascia Plaque
  const roofGrp = new THREE.Group();
  roofGrp.position.set(0, 2.84, 0.14);
  roofGrp.rotation.x = -0.055;
  scooterShopGrp.add(roofGrp);

  partHelper.addPart(roofGrp, new THREE.BoxGeometry(5.16, 0.18, 4.18), COL_KIOSK_STEEL, [0, 0.04, 0], [0, 0, 0], 0.013, opts.textures.steelRoofTex, 2.4);
  partHelper.addPart(roofGrp, new THREE.BoxGeometry(5.26, 0.06, 4.28), '#1e2228', [0, 0.15, 0], [0, 0, 0], 0.010);
  partHelper.addPart(roofGrp, new THREE.BoxGeometry(4.92, 0.04, 3.94), '#3b4048', [0, -0.06, 0], [0, 0, 0], 0.008);
  // Subtle cyan trim line along front canopy edge
  partHelper.addPart(roofGrp, new THREE.BoxGeometry(5.18, 0.024, 0.03), COL_CYAN_ACCENT, [0, 0.04, 2.095], [0, 0, 0], 0, undefined, 1.0, false);
  // Front Architectural Showroom Fascia Signboard ("URBAN SCOOTER SHOWROOM")
  partHelper.addPart(roofGrp, new THREE.BoxGeometry(3.48, 0.44, 0.09), '#1b2028', [-0.36, 0.36, 1.88], [0.055, 0, 0], 0.008);
  partHelper.addPart(
    roofGrp,
    new THREE.PlaneGeometry(3.34, 0.38),
    '#ffffff',
    [-0.36, 0.36, 1.932],
    [0.055, 0, 0],
    0,
    getShowroomFasciaTexture(),
    0.2,
    false,
  );

  for (const sx of [-1.85, -0.62, 0.62, 1.85]) {
    for (const sz of [1.65, 0.45, -0.65]) {
      partHelper.addPart(roofGrp, new THREE.CylinderGeometry(0.075, 0.075, 0.03, 10), COL_KIOSK_LED, [sx, -0.08, sz], [0, 0, 0], 0.004, undefined, 1.0, false);
    }
  }

  // 6) URBAN SCOOTER SHOWROOM INTERIOR ARCHITECTURE (Visible through 3-sided glass walls)
  // Rear Interior Wall + Timber Accent Slat Wall
  partHelper.addPart(scooterShopGrp, new THREE.BoxGeometry(0.14, 2.38, 1.48), COL_KIOSK_WOOD, [-1.92, 1.40, -0.45], [0, 0, 0], 0.009, opts.textures.verticalTimberTex, 1.5);
  partHelper.addPart(scooterShopGrp, new THREE.BoxGeometry(3.84, 2.42, 0.08), '#222832', [0, 1.42, -1.36], [0, 0, 0], 0.008);
  // Backlit E-Mobility Blueprint Feature Wall Panel (`x = -0.58, y = 1.66, z = -1.30`)
  partHelper.addPart(scooterShopGrp, new THREE.BoxGeometry(2.16, 1.08, 0.05), '#111827', [-0.58, 1.68, -1.30], [0, 0, 0], 0.006);
  partHelper.addPart(
    scooterShopGrp,
    new THREE.PlaneGeometry(2.06, 0.98),
    '#ffffff',
    [-0.58, 1.68, -1.27],
    [0, 0, 0],
    0,
    getShowroomBackwallGraphicTexture(),
    0.2,
    false,
  );

  // 4-Bay Smart Lithium Battery Swap Charging Station (`x = +1.18, y = 0.22 .. 1.92, z = -1.16`)
  const chargerDockGrp = new THREE.Group();
  chargerDockGrp.position.set(1.18, 0.22, -1.14);
  scooterShopGrp.add(chargerDockGrp);
  partHelper.addPart(chargerDockGrp, new THREE.BoxGeometry(0.92, 1.68, 0.36), '#1e2530', [0, 0.84, 0], [0, 0, 0], 0.008);
  partHelper.addPart(chargerDockGrp, new THREE.BoxGeometry(0.94, 0.05, 0.38), COL_CYAN_ACCENT, [0, 1.66, 0], [0, 0, 0], 0, undefined, 1.0, false);
  for (const [bx, by] of [
    [-0.22, 0.62],
    [0.22, 0.62],
    [-0.22, 1.18],
    [0.22, 1.18],
  ] as [number, number][]) {
    // Removable black & cyan scooter battery module
    partHelper.addPart(chargerDockGrp, new THREE.BoxGeometry(0.30, 0.38, 0.14), '#0f172a', [bx, by, 0.14], [0, 0, 0], 0.004, undefined, 1.0, false);
    addLuminousScooterPart(partHelper, chargerDockGrp, new THREE.BoxGeometry(0.22, 0.035, 0.15), '#22d3ee', '#22d3ee', 0.9, [bx, by + 0.11, 0.145]);
  }

  // Left Window Showcase Podium: Compact Folded Push Scooter (`85cm` folded geometry!) + 2 Urban Helmets
  const leftPodiumGrp = new THREE.Group();
  leftPodiumGrp.position.set(-1.38, 0.22, 0.56);
  scooterShopGrp.add(leftPodiumGrp);
  partHelper.addPart(leftPodiumGrp, new THREE.BoxGeometry(1.12, 0.42, 0.68), '#262c36', [0, 0.21, 0], [0, 0, 0], 0.008);
  partHelper.addPart(leftPodiumGrp, new THREE.BoxGeometry(1.16, 0.05, 0.72), COL_KIOSK_WOOD, [0, 0.445, 0], [0, 0, 0], 0.006, opts.textures.timberTex);
  partHelper.addPart(leftPodiumGrp, new THREE.BoxGeometry(1.14, 0.02, 0.70), COL_CYAN_ACCENT, [0, 0.41, 0], [0, 0, 0], 0, undefined, 1.0, false);

  const indoorFoldedKick = createPushKickScooter3D({
    partHelper,
    folded: true,
    parked: false,
    includeContactShadow: false,
  });
  indoorFoldedKick.root.position.set(0, 0.47, 0.04);
  indoorFoldedKick.root.rotation.y = Math.PI * 0.46;
  indoorFoldedKick.root.scale.setScalar(0.95);
  leftPodiumGrp.add(indoorFoldedKick.root);

  // Center Showroom Tech & NFT Counter (`x = -0.10, z = -0.12`)
  const counterGrp = new THREE.Group();
  counterGrp.position.set(-0.08, 0.22, -0.18);
  scooterShopGrp.add(counterGrp);
  partHelper.addPart(counterGrp, new THREE.BoxGeometry(1.36, 0.76, 0.58), '#2b313c', [0, 0.38, 0], [0, 0, 0], 0.008);
  partHelper.addPart(counterGrp, new THREE.BoxGeometry(1.42, 0.06, 0.64), COL_KIOSK_WOOD, [0, 0.79, 0], [0, 0, 0], 0.007, opts.textures.timberTex);
  partHelper.addPart(counterGrp, new THREE.BoxGeometry(1.38, 0.03, 0.02), COL_CYAN_ACCENT, [0, 0.72, 0.295], [0, 0, 0], 0, undefined, 1.0, false);
  // Sleek NFT Terminal Screen + Urban Helmets on Counter
  partHelper.addPart(counterGrp, new THREE.BoxGeometry(0.34, 0.24, 0.04), '#0f172a', [0.34, 0.96, 0.06], [-0.28, -0.18, 0], 0.005);
  addLuminousScooterPart(partHelper, counterGrp, new THREE.PlaneGeometry(0.29, 0.19), '#22d3ee', '#22d3ee', 0.65, [0.336, 0.962, 0.082], [-0.28, -0.18, 0]);
  addShowroomUrbanHelmet(partHelper, counterGrp, [-0.38, 0.82, 0.02], 0.35, '#f1f5f9', COL_CYAN_ACCENT);
  addShowroomUrbanHelmet(partHelper, counterGrp, [-0.02, 0.82, 0.04], -0.22, '#272d38', '#38bdf8');

  // Right Side Window Gear & Spare Wheel Display Rack (`x = +1.48, z = +0.02`)
  const gearRackGrp = new THREE.Group();
  gearRackGrp.position.set(1.52, 0.22, 0.02);
  gearRackGrp.rotation.y = Math.PI / 2;
  scooterShopGrp.add(gearRackGrp);
  partHelper.addPart(gearRackGrp, new THREE.BoxGeometry(1.24, 0.08, 0.46), COL_KIOSK_WOOD, [0, 0.04, 0], [0, 0, 0], 0.007, opts.textures.timberTex);
  for (const ux of [-0.56, 0.56]) {
    partHelper.addPart(gearRackGrp, new THREE.CylinderGeometry(0.022, 0.022, 1.56, 8), '#64748b', [ux, 0.82, 0], [0, 0, 0], 0.004, undefined, 1.0, false);
  }
  for (const sy of [0.58, 1.08, 1.56]) {
    partHelper.addPart(gearRackGrp, new THREE.BoxGeometry(1.22, 0.05, 0.44), COL_KIOSK_WOOD, [0, sy, 0], [0, 0, 0], 0.006, opts.textures.timberTex);
  }
  addShowroomUrbanHelmet(partHelper, gearRackGrp, [-0.30, 1.11, 0.02], 0.12, '#f8fafc', COL_CYAN_ACCENT);
  addShowroomUrbanHelmet(partHelper, gearRackGrp, [0.28, 1.11, 0.02], -0.15, '#334155', COL_CYAN_ACCENT);
  // Display spare spoke-core scooter wheels on lower shelf
  for (const wx of [-0.28, 0.28]) {
    const spareWheel = buildSpokeWheelAssembly(partHelper, 0.19, 0.045, 5, '#1e2229', '#475569', '#94a3b8', true);
    spareWheel.position.set(wx, 0.80, 0);
    spareWheel.rotation.y = Math.PI / 2;
    gearRackGrp.add(spareWheel);
  }

  // 7) Outdoor A-Frame Sidewalk Sign ("URBAN SCOOTER · E-BIKE & KICK SCOOTER · NFT RESPITE")
  const signGrp = new THREE.Group();
  signGrp.position.set(
    URBAN_SCOOTER_SHOP_LAYOUT.aFrameSignLocal.x,
    URBAN_SCOOTER_SHOP_LAYOUT.aFrameSignLocal.y,
    URBAN_SCOOTER_SHOP_LAYOUT.aFrameSignLocal.z,
  );
  signGrp.rotation.y = URBAN_SCOOTER_SHOP_LAYOUT.aFrameSignLocal.rotY;
  scooterShopGrp.add(signGrp);

  for (const sideZ of [-1, 1]) {
    const legAngle = sideZ * 0.20;
    const panelZ = sideZ * 0.11;
    partHelper.addPart(
      signGrp,
      new THREE.BoxGeometry(0.58, 0.88, 0.04),
      COL_KIOSK_STEEL,
      [0, 0.44, panelZ],
      [-legAngle, 0, 0],
      0.007,
      opts.textures.steelRoofTex,
    );
    partHelper.addPart(
      signGrp,
      new THREE.BoxGeometry(0.49, 0.68, 0.048),
      '#ffffff',
      [0, 0.48, panelZ + sideZ * 0.006],
      [-legAngle, 0, 0],
      0.005,
      getShowroomAFrameSignTexture(),
      0.3,
      false,
    );
  }

  // 8) 2 HERO OUTDOOR NON-RIDEABLE STATIC DISPLAY SCOOTERS IN FRONT OF THE SHOP
  for (const disp of URBAN_SCOOTER_SHOP_LAYOUT.frontStaticDisplays) {
    const displaySlotGrp = new THREE.Group();
    displaySlotGrp.name =
      disp.kind === 'electric_scooter_bike'
        ? 'StaticDisplayElectricScooterBike'
        : 'StaticDisplayPushKickScooter';
    displaySlotGrp.position.set(disp.localX, disp.localY, disp.localZ);
    displaySlotGrp.rotation.y = disp.localRotY;
    displaySlotGrp.userData = {
      isStaticScooterDisplay: true,
      isRideable: false,
      scooterId: disp.id,
      scooterKind: disp.kind,
      currency: disp.currency,
      isNft: disp.isNft,
    };
    scooterShopGrp.add(displaySlotGrp);

    // Sleek low-profile architectural dark-steel & stone showcase pad (`h = 0.032`)
    const plinthW = disp.plinthHalfWidthLocal * 2;
    const plinthL = disp.plinthHalfLengthLocal * 2;
    const plinthH = disp.plinthHeightLocal * 0.72;
    partHelper.addPart(
      displaySlotGrp,
      createRoundedRectExtrudeGeo(plinthW, plinthL, plinthH * 0.78, 0.08, 0.006),
      '#242a33',
      [0, 0.003, 0],
      [0, 0, 0],
      0.005,
      opts.textures.steelRoofTex,
    );
    partHelper.addPart(
      displaySlotGrp,
      createRoundedRectExtrudeGeo(plinthW - 0.08, plinthL - 0.08, plinthH * 0.26, 0.06, 0.002),
      '#dce2ea',
      [0, plinthH * 0.76, 0],
      [0, 0, 0],
      0,
      opts.textures.granitePaverTex,
      0.9,
      false,
    );
    // Crisp cyan front edge accent bar on the showcase plinth
    partHelper.addPart(
      displaySlotGrp,
      new THREE.BoxGeometry(plinthW * 0.64, 0.010, 0.020),
      COL_CYAN_ACCENT,
      [0, plinthH * 0.56, plinthL * 0.49],
      [0, 0, 0],
      0,
      undefined,
      1.0,
      false,
    );

    if (disp.kind === 'electric_scooter_bike') {
      const bikeHandle = createElectricScooterBike3D({
        partHelper,
        parked: true,
        steerAngleRad: disp.steerAngleRad,
        includeContactShadow: false,
      });
      bikeHandle.root.position.set(0, plinthH, 0);
      bikeHandle.root.scale.setScalar(disp.localScale);
      bikeHandle.root.userData = { isStaticScooterDisplay: true, isRideable: false };
      displaySlotGrp.add(bikeHandle.root);
    } else {
      const kickHandle = createPushKickScooter3D({
        partHelper,
        parked: true,
        folded: false,
        steerAngleRad: disp.steerAngleRad,
        includeContactShadow: false,
      });
      kickHandle.root.position.set(0, plinthH, 0);
      kickHandle.root.scale.setScalar(disp.localScale);
      kickHandle.root.userData = { isStaticScooterDisplay: true, isRideable: false };
      displaySlotGrp.add(kickHandle.root);
    }
  }

  return scooterShopGrp;
}
