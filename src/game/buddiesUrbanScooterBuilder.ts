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
  bumpScale?: number;
  opacity?: number;
  transparent?: boolean;
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

const FINISH_GLOSS_BODY: ScooterPartFinish = { roughness: 0.28, metalness: 0.08 };
const FINISH_SATIN_METAL: ScooterPartFinish = { roughness: 0.30, metalness: 0.65 };
const FINISH_DARK_ALLOY: ScooterPartFinish = { roughness: 0.38, metalness: 0.52 };
const FINISH_MATTE_TRIM: ScooterPartFinish = { roughness: 0.72, metalness: 0.06 };
const FINISH_RUBBER_TIRE: ScooterPartFinish = { roughness: 0.86, metalness: 0.03, bumpScale: 0.0045 };
const FINISH_SADDLE_LEATHER: ScooterPartFinish = { roughness: 0.78, metalness: 0.04, bumpScale: 0.003 };
const FINISH_OPTICAL_LENS: ScooterPartFinish = { roughness: 0.12, metalness: 0.18 };
const FINISH_SMOKED_VISOR: ScooterPartFinish = { roughness: 0.10, metalness: 0.24 };

// Warm pearl ivory, matte slate-charcoal, and crisp muted cyan matching reference sheets
const SCOOTER_PEARL_HEX = '#f1eee6';
const SCOOTER_SILVER_TRIM_HEX = '#d6dae0';
const SCOOTER_CHARCOAL_HEX = '#353a42';
const SCOOTER_DEEP_CHARCOAL_HEX = '#262a31';
const SCOOTER_REF_CYAN_HEX = '#62c7c1';

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
 * Warm Pearl Satin Front Shield Texture (matching 3/4 Isometric & Front Elevation reference):
 * - Smooth warm pearl ivory crown fading softly to warm silver-stone along flanks,
 * - Fine slate-charcoal automotive panel shut-lines framing shoulder seam & horizontal headlamp parting groove.
 *   (Outer cyan edge piping is modeled natively as flush continuous 3D geometry!)
 */
function getElectricFrontShieldTexture(): THREE.Texture {
  if (cachedFrontShieldTex) return cachedFrontShieldTex;
  const { canvas, ctx } = makeCanvas2d(512, 512);
  if (!canvas || !ctx) {
    cachedFrontShieldTex = makeFallbackDataTex(241, 238, 230, 255);
    return cachedFrontShieldTex;
  }
  const bg = ctx.createLinearGradient(0, 0, 512, 0);
  bg.addColorStop(0.0, '#dbd6cb');
  bg.addColorStop(0.14, '#ebe7de');
  bg.addColorStop(0.50, '#f5f2eb');
  bg.addColorStop(0.86, '#ebe7de');
  bg.addColorStop(1.0, '#dbd6cb');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 512);

  // Soft vertical studio highlight down shield center
  const vGrad = ctx.createLinearGradient(0, 0, 0, 512);
  vGrad.addColorStop(0.0, 'rgba(255,255,255,0.22)');
  vGrad.addColorStop(0.65, 'rgba(255,255,255,0.04)');
  vGrad.addColorStop(1.0, 'rgba(120,115,105,0.16)');
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle inset cyan edge accent border tracing outer shield shoulders (`u ~ 0.09` & `0.91`)
  for (const sideX of [46, 466]) {
    const dir = sideX < 256 ? 1 : -1;
    ctx.strokeStyle = '#333942';
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sideX, 16);
    ctx.quadraticCurveTo(sideX - dir * 8, 240, sideX + dir * 10, 488);
    ctx.stroke();

    ctx.strokeStyle = SCOOTER_REF_CYAN_HEX;
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(sideX, 16);
    ctx.quadraticCurveTo(sideX - dir * 8, 240, sideX + dir * 10, 488);
    ctx.stroke();
  }

  // Crisp automotive panel shut-lines framing inner shoulder seam & horizontal headlamp parting line
  ctx.strokeStyle = 'rgba(53, 58, 66, 0.42)';
  ctx.lineWidth = 2.5;
  for (const seamX of [62, 450]) {
    const dir = seamX < 256 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(seamX, 24);
    ctx.quadraticCurveTo(seamX - dir * 6, 240, seamX + dir * 8, 482);
    ctx.stroke();
  }
  // Horizontal shut-line running left & right from the horizontal headlamp bar to outer stripe (`v ~ 0.67`)
  ctx.strokeStyle = 'rgba(42, 47, 54, 0.56)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(46, 336);
  ctx.lineTo(132, 344);
  ctx.moveTo(380, 344);
  ctx.lineTo(466, 336);
  ctx.stroke();

  cachedFrontShieldTex = finalizeCanvasTex(canvas);
  return cachedFrontShieldTex;
}

/**
 * Glossy Horizontal Headlamp Lens & Multi-Reflector Optics (matching 3/4 & Front Elevation):
 * - Clean dark charcoal outer gasket housing,
 * - Continuous ice-white/cyan 5-cell linear LED optic array inside smoked polycarbonate lens,
 * - Diagonal specular glass reflection streak.
 */
function getElectricHeadlampBarTexture(): THREE.Texture {
  if (cachedHeadlampBarTex) return cachedHeadlampBarTex;
  const { canvas, ctx } = makeCanvas2d(512, 128);
  if (!canvas || !ctx) {
    cachedHeadlampBarTex = makeFallbackDataTex(225, 248, 255, 255);
    return cachedHeadlampBarTex;
  }
  ctx.fillStyle = '#1c2026';
  ctx.fillRect(0, 0, 512, 128);

  // Inner metallic satin bezel frame
  ctx.strokeStyle = '#647080';
  ctx.lineWidth = 5;
  ctx.strokeRect(10, 12, 492, 104);

  // Wide linear crystal multi-LED cavity (`x = 24 .. 488`)
  const mainGrad = ctx.createLinearGradient(24, 22, 24, 106);
  mainGrad.addColorStop(0.0, '#cfeef2');
  mainGrad.addColorStop(0.45, '#f9feff');
  mainGrad.addColorStop(1.0, '#9bd3dd');
  ctx.fillStyle = mainGrad;
  ctx.fillRect(24, 24, 464, 80);

  // Subtle vertical crystal optic ribs (5 LED cubes)
  ctx.fillStyle = 'rgba(30, 41, 59, 0.28)';
  for (let i = 1; i < 5; i++) {
    ctx.fillRect(24 + i * 92.8 - 2, 24, 4, 80);
  }
  for (let i = 0; i < 5; i++) {
    const cx = 24 + (i + 0.5) * 92.8;
    const pGrad = ctx.createRadialGradient(cx, 64, 4, cx, 64, 38);
    pGrad.addColorStop(0.0, '#ffffff');
    pGrad.addColorStop(0.65, 'rgba(214, 248, 252, 0.72)');
    pGrad.addColorStop(1.0, 'rgba(51, 65, 85, 0.14)');
    ctx.fillStyle = pGrad;
    ctx.fillRect(cx - 42, 26, 84, 76);
  }

  // Crisp glossy diagonal lens reflection streaks
  ctx.fillStyle = 'rgba(255, 255, 255, 0.44)';
  for (const [sx, w] of [
    [98, 44],
    [164, 18],
    [340, 26],
  ]) {
    ctx.beginPath();
    ctx.moveTo(sx, 14);
    ctx.lineTo(sx + w, 14);
    ctx.lineTo(sx + w - 36, 114);
    ctx.lineTo(sx - 36, 114);
    ctx.closePath();
    ctx.fill();
  }

  cachedHeadlampBarTex = finalizeCanvasTex(canvas);
  return cachedHeadlampBarTex;
}

/**
 * Warm Pearl-Ivory Sculpted Rear Body Cowl Texture (`Side Profile & 3/4 Isometric`):
 * - Seamless warm pearl ivory shell matching front shield (`#f2efe7 -> #ded9ce`),
 * - Crisp panel seam crease separating rear quarter fender from lower inner skirt.
 */
function getElectricSideCowlTexture(): THREE.Texture {
  if (cachedSideCowlTex) return cachedSideCowlTex;
  const { canvas, ctx } = makeCanvas2d(512, 256);
  if (!canvas || !ctx) {
    cachedSideCowlTex = makeFallbackDataTex(241, 238, 230, 255);
    return cachedSideCowlTex;
  }
  const baseGrad = ctx.createLinearGradient(0, 0, 0, 256);
  baseGrad.addColorStop(0.0, '#d8d3c8');
  baseGrad.addColorStop(0.30, '#e8e4db');
  baseGrad.addColorStop(0.74, '#f4f1ea');
  baseGrad.addColorStop(1.0, '#e6e2d8');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, 512, 256);

  // Subtle horizontal contour shadow crease along lower hip edge
  ctx.strokeStyle = 'rgba(53, 58, 66, 0.28)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(28, 178);
  ctx.lineTo(410, 194);
  ctx.stroke();

  // Subtle specular highlight ridge along upper shoulder
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(24, 58);
  ctx.lineTo(430, 82);
  ctx.stroke();

  cachedSideCowlTex = finalizeCanvasTex(canvas);
  return cachedSideCowlTex;
}

/**
 * Rear Slim LED Taillight & Amber Outer Indicator Bar Texture (`Rear Elevation` reference).
 */
function getElectricTaillightBarTexture(): THREE.Texture {
  if (cachedTaillightBarTex) return cachedTaillightBarTex;
  const { canvas, ctx } = makeCanvas2d(512, 96);
  if (!canvas || !ctx) {
    cachedTaillightBarTex = makeFallbackDataTex(239, 68, 68, 255);
    return cachedTaillightBarTex;
  }
  ctx.fillStyle = '#1b1f26';
  ctx.fillRect(0, 0, 512, 96);

  // Outer compact amber turn-indicator tips
  for (const [tx, tw] of [
    [10, 62],
    [440, 62],
  ] as [number, number][]) {
    const tGrad = ctx.createLinearGradient(tx, 20, tx, 76);
    tGrad.addColorStop(0.0, '#fde68a');
    tGrad.addColorStop(0.5, '#f59e0b');
    tGrad.addColorStop(1.0, '#b45309');
    ctx.fillStyle = tGrad;
    ctx.fillRect(tx, 22, tw, 52);
  }

  // Central continuous slim ruby-red LED bar
  const rGrad = ctx.createLinearGradient(82, 16, 82, 80);
  rGrad.addColorStop(0.0, '#fca5a5');
  rGrad.addColorStop(0.45, '#ef4444');
  rGrad.addColorStop(1.0, '#991b1b');
  ctx.fillStyle = rGrad;
  ctx.fillRect(80, 18, 352, 60);

  // Inner luminous LED light guide core
  ctx.fillStyle = '#ffe4e6';
  ctx.fillRect(96, 40, 320, 14);

  cachedTaillightBarTex = finalizeCanvasTex(canvas);
  return cachedTaillightBarTex;
}

/**
 * Matte-Charcoal Contoured 2-Up Saddle Upholstery Texture (`Side Profile & 3/4 Isometric` reference).
 * Clean fine leather grain & subtle curved step seam (no bright noisy dashed borders).
 */
function getSaddleLeatherTexture(): THREE.Texture {
  if (cachedSaddleLeatherTex) return cachedSaddleLeatherTex;
  const { canvas, ctx } = makeCanvas2d(512, 256);
  if (!canvas || !ctx) {
    cachedSaddleLeatherTex = makeFallbackDataTex(52, 57, 65, 255);
    return cachedSaddleLeatherTex;
  }
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#272b32');
  grad.addColorStop(0.32, '#3a404a');
  grad.addColorStop(0.68, '#3d434e');
  grad.addColorStop(1.0, '#282c33');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Subtle matte pebble grain micro-stipple
  ctx.fillStyle = 'rgba(18, 22, 28, 0.22)';
  for (let y = 4; y < 252; y += 5) {
    for (let x = 4; x < 508; x += 5) {
      if ((x * 7 + y * 13) % 17 === 0) {
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  // Smooth stitched bolster contour seam separating pillion & rider cushion
  ctx.strokeStyle = 'rgba(22, 26, 32, 0.72)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(222, 18);
  ctx.quadraticCurveTo(246, 128, 222, 238);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(116, 125, 140, 0.32)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(226, 18);
  ctx.quadraticCurveTo(250, 128, 226, 238);
  ctx.stroke();

  cachedSaddleLeatherTex = finalizeCanvasTex(canvas);
  return cachedSaddleLeatherTex;
}

/**
 * Circumferential Commuter Tire Tread Texture (`512x256`, self-tiled cleanly under `ClampToEdgeWrapping`
 * so showroom `addLobbyPart` never overwrites torus UVs).
 */
function getScooterTireTreadTexture(): THREE.Texture {
  if (cachedTireTreadTex) return cachedTireTreadTex;
  const { canvas, ctx } = makeCanvas2d(512, 256);
  if (!canvas || !ctx) {
    cachedTireTreadTex = makeFallbackDataTex(46, 51, 58, 255);
    return cachedTireTreadTex;
  }
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#2a2f37');
  grad.addColorStop(0.24, '#363c46');
  grad.addColorStop(0.50, '#2e333c');
  grad.addColorStop(0.76, '#363c46');
  grad.addColorStop(1.0, '#2a2f37');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Subtle sidewall molding ring lines
  ctx.strokeStyle = '#20242b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 44);
  ctx.lineTo(512, 44);
  ctx.moveTo(0, 212);
  ctx.lineTo(512, 212);
  ctx.stroke();

  // Center circumferential groove + 16 directional chevron sipes across U=0..512
  ctx.fillStyle = '#191d23';
  ctx.fillRect(0, 124, 512, 8);

  ctx.strokeStyle = '#1b1f26';
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  const step = 32;
  for (let x = 0; x <= 512; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 124);
    ctx.lineTo(x + 18, 78);
    ctx.moveTo(x + step * 0.5, 132);
    ctx.lineTo(x + step * 0.5 + 18, 178);
    ctx.stroke();
  }

  cachedTireTreadTex = finalizeCanvasTex(canvas, THREE.ClampToEdgeWrapping);
  return cachedTireTreadTex;
}

/**
 * Perforated Stainless Brake Rotor Texture (`256x256`) for annular brake disc rings.
 */
function getVentilatedDiscRotorTexture(): THREE.Texture {
  if (cachedDiscRotorTex) return cachedDiscRotorTex;
  const { canvas, ctx } = makeCanvas2d(256, 256);
  if (!canvas || !ctx) {
    cachedDiscRotorTex = makeFallbackDataTex(203, 213, 225, 255);
    return cachedDiscRotorTex;
  }
  ctx.fillStyle = '#b9c0ca';
  ctx.fillRect(0, 0, 256, 256);

  const grad = ctx.createRadialGradient(128, 128, 72, 128, 128, 126);
  grad.addColorStop(0.0, '#9ba4b0');
  grad.addColorStop(0.45, '#dde3ea');
  grad.addColorStop(1.0, '#aeb6c2');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(128, 128, 124, 0, Math.PI * 2);
  ctx.fill();

  // Cooling vent drill holes around brushed friction track
  ctx.fillStyle = '#252a32';
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    for (const r of [90, 108]) {
      ctx.beginPath();
      ctx.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  cachedDiscRotorTex = finalizeCanvasTex(canvas, THREE.ClampToEdgeWrapping);
  return cachedDiscRotorTex;
}

/**
 * Fine Satin Brushed-Aluminum Texture (`256x256`, `ClampToEdgeWrapping` UV-safe).
 */
function getBrushedAluminumTexture(): THREE.Texture {
  if (cachedBrushedMetalTex) return cachedBrushedMetalTex;
  const { canvas, ctx } = makeCanvas2d(256, 256);
  if (!canvas || !ctx) {
    cachedBrushedMetalTex = makeFallbackDataTex(222, 226, 231, 255);
    return cachedBrushedMetalTex;
  }
  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0.0, '#d8dde4');
  grad.addColorStop(0.5, '#ebeff4');
  grad.addColorStop(1.0, '#d3d8e0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 3) {
    ctx.fillStyle = y % 6 === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(90,100,115,0.08)';
    ctx.fillRect(0, y, 256, 1);
  }
  cachedBrushedMetalTex = finalizeCanvasTex(canvas, THREE.ClampToEdgeWrapping);
  return cachedBrushedMetalTex;
}

/**
 * Ribbed & Knurled Ergonomic Rubber Handlebar Grip Texture (`256x128`, `ClampToEdgeWrapping`).
 */
function getErgonomicGripTexture(): THREE.Texture {
  if (cachedRubberGripTex) return cachedRubberGripTex;
  const { canvas, ctx } = makeCanvas2d(256, 128);
  if (!canvas || !ctx) {
    cachedRubberGripTex = makeFallbackDataTex(36, 41, 49, 255);
    return cachedRubberGripTex;
  }
  ctx.fillStyle = '#282d35';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#1b1f26';
  ctx.lineWidth = 2;
  for (let x = 0; x < 256; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 128);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.26)';
  ctx.lineWidth = 1.5;
  for (let y = 8; y < 128; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  cachedRubberGripTex = finalizeCanvasTex(canvas, THREE.ClampToEdgeWrapping);
  return cachedRubberGripTex;
}

function getElectricCockpitLcdTexture(): THREE.Texture {
  if (cachedCockpitLcdTex) return cachedCockpitLcdTex;
  const { canvas, ctx } = makeCanvas2d(256, 144);
  if (!canvas || !ctx) {
    cachedCockpitLcdTex = makeFallbackDataTex(14, 32, 48, 255);
    return cachedCockpitLcdTex;
  }
  ctx.fillStyle = '#0c1520';
  ctx.fillRect(0, 0, 256, 144);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 240, 128);

  // Subtle cyan status arc
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(32, 26);
  ctx.quadraticCurveTo(128, 14, 224, 26);
  ctx.stroke();

  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < 4 ? '#2dd4bf' : '#38bdf8';
    ctx.fillRect(22, 104 - i * 15, 22, 10);
  }
  ctx.fillStyle = '#f0fdfa';
  ctx.textAlign = 'center';
  ctx.font = 'bold 50px sans-serif';
  ctx.fillText('28', 130, 86);
  ctx.fillStyle = '#7dd3fc';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('KM/H · READY', 130, 114);

  ctx.fillStyle = '#164e63';
  ctx.fillRect(190, 34, 46, 26);
  ctx.fillStyle = '#67e8f9';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('ECO', 213, 52);

  cachedCockpitLcdTex = finalizeCanvasTex(canvas);
  return cachedCockpitLcdTex;
}

/**
 * Molded Matte-Charcoal Floorboard Rubber Mat with Rounded Border & Horizontal Anti-Slip Ribs
 * (`3/4 Isometric View` reference — clean understated dark traction ribs, NO neon cyan boxes).
 */
function getElectricFloorMatTexture(): THREE.Texture {
  if (cachedElectricFloorMatTex) return cachedElectricFloorMatTex;
  const { canvas, ctx } = makeCanvas2d(256, 512);
  if (!canvas || !ctx) {
    cachedElectricFloorMatTex = makeFallbackDataTex(50, 55, 62, 255);
    return cachedElectricFloorMatTex;
  }
  ctx.fillStyle = '#363b44';
  ctx.fillRect(0, 0, 256, 512);

  // Rounded outer recessed tray border
  ctx.strokeStyle = '#23272e';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(14, 16, 228, 480, 36);
  ctx.stroke();

  ctx.strokeStyle = '#474e59';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(24, 28, 208, 456, 28);
  ctx.stroke();

  // Horizontal transverse anti-slip molded rubber tread ribs across center & front toe zone
  for (let y = 58; y <= 452; y += 26) {
    ctx.fillStyle = '#242830';
    ctx.fillRect(42, y, 172, 9);
    ctx.fillStyle = '#48505c';
    ctx.fillRect(42, y - 2, 172, 3);
  }

  // Subtle twin central tunnel divide seam
  ctx.fillStyle = '#2b3038';
  ctx.fillRect(123, 36, 10, 440);

  cachedElectricFloorMatTex = finalizeCanvasTex(canvas);
  return cachedElectricFloorMatTex;
}

/**
 * Push Scooter Stadium-Rounded Textured High-Grip Footpad (`Top Plan View` reference).
 * Clean fine dark anti-slip matrix with rounded border trim — understated & industrial.
 */
function getKickGeometricGripDeckTexture(): THREE.Texture {
  if (cachedKickGripDeckTex) return cachedKickGripDeckTex;
  const { canvas, ctx } = makeCanvas2d(256, 512);
  if (!canvas || !ctx) {
    cachedKickGripDeckTex = makeFallbackDataTex(44, 49, 57, 255);
    return cachedKickGripDeckTex;
  }
  ctx.fillStyle = '#333841';
  ctx.fillRect(0, 0, 256, 512);

  // Fine high-grip elastomer micro-dot matrix
  ctx.fillStyle = '#242830';
  for (let y = 18; y < 494; y += 7) {
    for (let x = 18; x < 238; x += 7) {
      if ((x + y) % 14 === 0) ctx.fillRect(x, y, 3, 3);
    }
  }

  // Stadium/rounded perimeter trim groove
  ctx.strokeStyle = '#20242b';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(14, 16, 228, 480, 96);
  ctx.stroke();

  ctx.strokeStyle = '#4c5460';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(22, 24, 212, 464, 88);
  ctx.stroke();

  // Subtle geometric diamond tread embossing
  ctx.strokeStyle = 'rgba(76, 84, 96, 0.55)';
  ctx.lineWidth = 2;
  for (let y = 64; y <= 424; y += 30) {
    ctx.beginPath();
    ctx.moveTo(48, y + 15);
    ctx.lineTo(128, y);
    ctx.lineTo(208, y + 15);
    ctx.lineTo(128, y + 30);
    ctx.closePath();
    ctx.stroke();
  }

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
        bumpMap: finish?.bumpScale && tex ? tex : null,
        bumpScale: finish?.bumpScale ?? 0,
        roughness: finish?.roughness ?? 0.36,
        metalness: finish?.metalness ?? 0.18,
        transparent: finish?.transparent ?? false,
        opacity: finish?.opacity ?? 1,
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
  bevelSegments = 4,
): THREE.BufferGeometry {
  const hw = width * 0.5;
  const hl = length * 0.5;
  const r = Math.min(cornerRadius, hw * 0.96, hl * 0.96);
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hl);
  shape.lineTo(hw - r, -hl);
  shape.absarc(hw - r, -hl + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(hw, hl - r);
  shape.absarc(hw - r, hl - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-hw + r, hl);
  shape.absarc(-hw + r, hl - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-hw, -hl + r);
  shape.absarc(-hw + r, -hl + r, r, Math.PI, Math.PI * 1.5, false);

  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    curveSegments: 18,
    depth,
    bevelEnabled: bevelSize > 0,
    bevelThickness: bevelSize,
    bevelSize,
    bevelSegments,
  });
  geo.rotateX(-Math.PI / 2);
  // Normalize UVs cleanly into [0, 1] across top XZ planform so textures match Top Plan 1:1
  const posAttr = geo.getAttribute('position');
  const uvAttr = geo.getAttribute('uv');
  if (posAttr && uvAttr) {
    const spanX = Math.max(1e-4, width + bevelSize * 2);
    const spanZ = Math.max(1e-4, length + bevelSize * 2);
    for (let i = 0; i < posAttr.count; i++) {
      uvAttr.setXY(
        i,
        THREE.MathUtils.clamp((posAttr.getX(i) + spanX * 0.5) / spanX, 0, 1),
        THREE.MathUtils.clamp((posAttr.getZ(i) + spanZ * 0.5) / spanZ, 0, 1),
      );
    }
    uvAttr.needsUpdate = true;
  }
  return geo;
}

interface LoftStation {
  /** Center Y in scooter local space (m). */
  y: number;
  /** Center Z in scooter local space (m). */
  z: number;
  /** Optional Center X offset in scooter local space (m). */
  offsetX?: number;
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

function catmullRomScalar(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function pushOrientedQuad(
  positions: number[],
  indices: number[],
  a: number,
  b: number,
  c: number,
  d: number,
  cx: number,
  cy: number,
  cz: number,
): void {
  const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
  const bx = positions[b * 3], by = positions[b * 3 + 1], bz = positions[b * 3 + 2];
  const vx = positions[c * 3], vy = positions[c * 3 + 1], vz = positions[c * 3 + 2];
  const dx = positions[d * 3], dy = positions[d * 3 + 1], dz = positions[d * 3 + 2];

  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const adx = dx - ax, ady = dy - ay, adz = dz - az;
  const nx = aby * adz - abz * ady;
  const ny = abz * adx - abx * adz;
  const nz = abx * ady - aby * adx;

  const rx = 0.25 * (ax + bx + vx + dx) - cx;
  const ry = 0.25 * (ay + by + vy + dy) - cy;
  const rz = 0.25 * (az + bz + vz + dz) - cz;

  if (nx * rx + ny * ry + nz * rz >= 0) {
    indices.push(a, b, d, b, c, d);
  } else {
    indices.push(a, d, b, d, c, b);
  }
}

function pushOrientedCap(
  positions: number[],
  indices: number[],
  centerIdx: number,
  rowStart: number,
  segs: number,
  outDx: number,
  outDy: number,
  outDz: number,
): void {
  if (segs < 2) return;
  const cx = positions[centerIdx * 3];
  const cy = positions[centerIdx * 3 + 1];
  const cz = positions[centerIdx * 3 + 2];

  let accNx = 0;
  let accNy = 0;
  let accNz = 0;
  for (let r = 0; r < segs; r++) {
    const i1 = rowStart + r;
    const i2 = rowStart + r + 1;
    const u1x = positions[i1 * 3] - cx;
    const u1y = positions[i1 * 3 + 1] - cy;
    const u1z = positions[i1 * 3 + 2] - cz;
    const u2x = positions[i2 * 3] - cx;
    const u2y = positions[i2 * 3 + 1] - cy;
    const u2z = positions[i2 * 3 + 2] - cz;
    accNx += u1y * u2z - u1z * u2y;
    accNy += u1z * u2x - u1x * u2z;
    accNz += u1x * u2y - u1y * u2x;
  }

  const forward = accNx * outDx + accNy * outDy + accNz * outDz >= 0;
  for (let r = 0; r < segs; r++) {
    const i1 = rowStart + r;
    const i2 = rowStart + r + 1;
    if (forward) {
      indices.push(centerIdx, i1, i2);
    } else {
      indices.push(centerIdx, i2, i1);
    }
  }
}

function averageGridSeamNormals(geo: THREE.BufferGeometry, cols: number, stCount: number): void {
  const norm = geo.getAttribute('normal');
  if (!norm) return;
  for (let s = 0; s < stCount; s++) {
    const i0 = s * cols;
    const i1 = s * cols + (cols - 1);
    const nx = norm.getX(i0) + norm.getX(i1);
    const ny = norm.getY(i0) + norm.getY(i1);
    const nz = norm.getZ(i0) + norm.getZ(i1);
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-6) {
      const ix = nx / len;
      const iy = ny / len;
      const iz = nz / len;
      norm.setXYZ(i0, ix, iy, iz);
      norm.setXYZ(i1, ix, iy, iz);
    }
  }
  norm.needsUpdate = true;
}

function resampleLoftStations(
  stations: readonly LoftStation[],
  subdivsPerSpan: number,
  capMode: 'dome' | 'flat',
): LoftStation[] {
  if (stations.length <= 1 || subdivsPerSpan <= 1) {
    return stations.map((s) => ({ ...s }));
  }
  const n = stations.length;
  const out: LoftStation[] = [];
  const getSt = (idx: number) => stations[Math.max(0, Math.min(n - 1, idx))];

  for (let i = 0; i < n - 1; i++) {
    const s0 = getSt(i - 1);
    const s1 = getSt(i);
    const s2 = getSt(i + 1);
    const s3 = getSt(i + 2);
    const steps = i === n - 2 ? subdivsPerSpan + 1 : subdivsPerSpan;
    for (let k = 0; k < steps; k++) {
      const t = k / subdivsPerSpan;
      out.push({
        y: catmullRomScalar(s0.y, s1.y, s2.y, s3.y, t),
        z: catmullRomScalar(s0.z, s1.z, s2.z, s3.z, t),
        offsetX: catmullRomScalar(
          s0.offsetX ?? 0,
          s1.offsetX ?? 0,
          s2.offsetX ?? 0,
          s3.offsetX ?? 0,
          t,
        ),
        rx: Math.max(0.002, catmullRomScalar(s0.rx, s1.rx, s2.rx, s3.rx, t)),
        ryTop: Math.max(0.002, catmullRomScalar(s0.ryTop, s1.ryTop, s2.ryTop, s3.ryTop, t)),
        ryBot: Math.max(0.002, catmullRomScalar(s0.ryBot, s1.ryBot, s2.ryBot, s3.ryBot, t)),
        pitchRad: catmullRomScalar(
          s0.pitchRad ?? 0,
          s1.pitchRad ?? 0,
          s2.pitchRad ?? 0,
          s3.pitchRad ?? 0,
          t,
        ),
        power: Math.max(
          1.6,
          catmullRomScalar(s0.power ?? 2.8, s1.power ?? 2.8, s2.power ?? 2.8, s3.power ?? 2.8, t),
        ),
      });
    }
  }

  if (capMode === 'dome' && out.length >= 2) {
    const first = out[0];
    const next = out[1];
    const startDx = (first.offsetX ?? 0) - (next.offsetX ?? 0);
    const startDy = first.y - next.y;
    const startDz = first.z - next.z;
    const startLen = Math.hypot(startDx, startDy, startDz) || 1;
    const domeS = Math.min(first.rx, first.ryTop + first.ryBot) * 0.28;
    const ux0 = (startDx / startLen) * domeS;
    const uy0 = (startDy / startLen) * domeS;
    const uz0 = (startDz / startLen) * domeS;

    const last = out[out.length - 1];
    const prev = out[out.length - 2];
    const endDx = (last.offsetX ?? 0) - (prev.offsetX ?? 0);
    const endDy = last.y - prev.y;
    const endDz = last.z - prev.z;
    const endLen = Math.hypot(endDx, endDy, endDz) || 1;
    const domeE = Math.min(last.rx, last.ryTop + last.ryBot) * 0.28;
    const ux1 = (endDx / endLen) * domeE;
    const uy1 = (endDy / endLen) * domeE;
    const uz1 = (endDz / endLen) * domeE;

    const mkDome = (base: LoftStation, frac: number, ux: number, uy: number, uz: number): LoftStation => {
      const rad = Math.sqrt(Math.max(0.02, 1 - frac * frac));
      return {
        y: base.y + uy * frac,
        z: base.z + uz * frac,
        offsetX: (base.offsetX ?? 0) + ux * frac,
        rx: Math.max(0.0025, base.rx * rad),
        ryTop: Math.max(0.0025, base.ryTop * rad),
        ryBot: Math.max(0.0025, base.ryBot * rad),
        pitchRad: base.pitchRad,
        power: THREE.MathUtils.lerp(base.power ?? 2.8, 2.0, frac * 0.7),
      };
    };

    return [
      mkDome(first, 0.96, ux0, uy0, uz0),
      mkDome(first, 0.72, ux0, uy0, uz0),
      mkDome(first, 0.36, ux0, uy0, uz0),
      ...out,
      mkDome(last, 0.36, ux1, uy1, uz1),
      mkDome(last, 0.72, ux1, uy1, uz1),
      mkDome(last, 0.96, ux1, uy1, uz1),
    ];
  }

  return out;
}

/**
 * Continuous Spline-Interpolated Multi-Station Automotive Bodywork Loft Builder:
 * Automatically subdivides control stations via Catmull-Rom splines, appends smooth domed end caps,
 * averages seam vertex normals, and produces distortion-free `'front'`, `'side'`, or `'wrap'` UVs.
 */
function createLoftedBodyShellGeo(
  stations: readonly LoftStation[],
  ringSegs = 28,
  uvMode: 'front' | 'side' | 'wrap' = 'wrap',
  subdivsPerSpan = 3,
  capMode: 'dome' | 'flat' = 'dome',
): THREE.BufferGeometry {
  const smoothStations = resampleLoftStations(stations, subdivsPerSpan, capMode);
  const stCount = smoothStations.length;
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
    const st = smoothStations[s];
    const sFrac = stCount > 1 ? s / (stCount - 1) : 0;
    const exp = 2 / Math.max(1.4, st.power ?? 2.8);
    const pitch = st.pitchRad ?? 0;
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const offX = st.offsetX ?? 0;

    for (let r = 0; r <= ringSegs; r++) {
      const rFrac = r / ringSegs;
      const theta = rFrac * Math.PI * 2;
      const ct = Math.cos(theta);
      const stSin = Math.sin(theta);
      const sx = offX + Math.sign(ct) * Math.pow(Math.abs(ct), exp) * st.rx;
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
    const sA = smoothStations[s];
    const sB = smoothStations[s + 1];
    const cx = 0.5 * ((sA.offsetX ?? 0) + (sB.offsetX ?? 0));
    const cy = 0.5 * (sA.y + sB.y);
    const cz = 0.5 * (sA.z + sB.z);
    for (let r = 0; r < ringSegs; r++) {
      pushOrientedQuad(
        positions,
        indices,
        row0 + r,
        row1 + r,
        row1 + r + 1,
        row0 + r + 1,
        cx,
        cy,
        cz,
      );
    }
  }

  const firstSt = smoothStations[0];
  const nextSt = smoothStations[Math.min(1, stCount - 1)];
  const fOffX = firstSt.offsetX ?? 0;
  const nOffX = nextSt.offsetX ?? 0;
  const startOutX = fOffX - nOffX;
  const startOutY = firstSt.y - nextSt.y;
  const startOutZ = firstSt.z - nextSt.z;
  const startOutLen = Math.hypot(startOutX, startOutY, startOutZ) || 1;
  const startCapBump = Math.min(firstSt.rx, firstSt.ryTop + firstSt.ryBot) * 0.25;
  const startCenterIdx = positions.length / 3;
  positions.push(
    fOffX + (startOutX / startOutLen) * startCapBump,
    firstSt.y + (startOutY / startOutLen) * startCapBump,
    firstSt.z + (startOutZ / startOutLen) * startCapBump,
  );
  uvs.push(0.5, 1.0);
  pushOrientedCap(positions, indices, startCenterIdx, 0, ringSegs, startOutX, startOutY, startOutZ);

  const lastSt = smoothStations[stCount - 1];
  const prevSt = smoothStations[Math.max(0, stCount - 2)];
  const lOffX = lastSt.offsetX ?? 0;
  const pOffX = prevSt.offsetX ?? 0;
  const endOutX = lOffX - pOffX;
  const endOutY = lastSt.y - prevSt.y;
  const endOutZ = lastSt.z - prevSt.z;
  const endOutLen = Math.hypot(endOutX, endOutY, endOutZ) || 1;
  const endCapBump = Math.min(lastSt.rx, lastSt.ryTop + lastSt.ryBot) * 0.25;
  const endCenterIdx = positions.length / 3;
  positions.push(
    lOffX + (endOutX / endOutLen) * endCapBump,
    lastSt.y + (endOutY / endOutLen) * endCapBump,
    lastSt.z + (endOutZ / endOutLen) * endCapBump,
  );
  uvs.push(0.5, 0.0);
  const lastRow = (stCount - 1) * cols;
  pushOrientedCap(positions, indices, endCenterIdx, lastRow, ringSegs, endOutX, endOutY, endOutZ);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  averageGridSeamNormals(geo, cols, stCount);
  return geo;
}

interface LoftStationX {
  x: number;
  y: number;
  z: number;
  ry: number;
  rzFront: number;
  rzBack: number;
  rollRad?: number;
  power?: number;
}

/**
 * Lateral (Left-to-Right along X) Continuous Spline Loft Builder for Handlebar Nacelles,
 * Smoked Windscreen Visors, and Cross-Car Cowlings.
 */
function createLoftedXShellGeo(
  stations: readonly LoftStationX[],
  ringSegs = 26,
  subdivsPerSpan = 3,
): THREE.BufferGeometry {
  const n = stations.length;
  const smooth: LoftStationX[] = [];
  const getS = (idx: number) => stations[Math.max(0, Math.min(n - 1, idx))];
  for (let i = 0; i < n - 1; i++) {
    const s0 = getS(i - 1);
    const s1 = getS(i);
    const s2 = getS(i + 1);
    const s3 = getS(i + 2);
    const steps = i === n - 2 ? subdivsPerSpan + 1 : subdivsPerSpan;
    for (let k = 0; k < steps; k++) {
      const t = k / subdivsPerSpan;
      smooth.push({
        x: catmullRomScalar(s0.x, s1.x, s2.x, s3.x, t),
        y: catmullRomScalar(s0.y, s1.y, s2.y, s3.y, t),
        z: catmullRomScalar(s0.z, s1.z, s2.z, s3.z, t),
        ry: Math.max(0.002, catmullRomScalar(s0.ry, s1.ry, s2.ry, s3.ry, t)),
        rzFront: Math.max(0.002, catmullRomScalar(s0.rzFront, s1.rzFront, s2.rzFront, s3.rzFront, t)),
        rzBack: Math.max(0.002, catmullRomScalar(s0.rzBack, s1.rzBack, s2.rzBack, s3.rzBack, t)),
        rollRad: catmullRomScalar(s0.rollRad ?? 0, s1.rollRad ?? 0, s2.rollRad ?? 0, s3.rollRad ?? 0, t),
        power: Math.max(1.6, catmullRomScalar(s0.power ?? 2.8, s1.power ?? 2.8, s2.power ?? 2.8, s3.power ?? 2.8, t)),
      });
    }
  }

  const first = smooth[0];
  const last = smooth[smooth.length - 1];
  const mkXCap = (base: LoftStationX, dx: number, frac: number): LoftStationX => {
    const rad = Math.sqrt(Math.max(0.03, 1 - frac * frac));
    return {
      x: base.x + dx * frac,
      y: base.y,
      z: base.z,
      ry: Math.max(0.0025, base.ry * rad),
      rzFront: Math.max(0.0025, base.rzFront * rad),
      rzBack: Math.max(0.0025, base.rzBack * rad),
      rollRad: base.rollRad,
      power: THREE.MathUtils.lerp(base.power ?? 2.8, 2.0, frac * 0.7),
    };
  };
  const allStations: LoftStationX[] = [
    mkXCap(first, -first.ry * 0.45, 0.94),
    mkXCap(first, -first.ry * 0.45, 0.62),
    ...smooth,
    mkXCap(last, last.ry * 0.45, 0.62),
    mkXCap(last, last.ry * 0.45, 0.94),
  ];

  const stCount = allStations.length;
  const cols = ringSegs + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let s = 0; s < stCount; s++) {
    const st = allStations[s];
    const sFrac = stCount > 1 ? s / (stCount - 1) : 0;
    const exp = 2 / Math.max(1.4, st.power ?? 2.8);
    const roll = st.rollRad ?? 0;
    const cosR = Math.cos(roll);
    const sinR = Math.sin(roll);

    for (let r = 0; r <= ringSegs; r++) {
      const rFrac = r / ringSegs;
      const theta = rFrac * Math.PI * 2;
      const ct = Math.cos(theta);
      const stSin = Math.sin(theta);
      const syLocal = Math.sign(ct) * Math.pow(Math.abs(ct), exp) * st.ry;
      const szLocal =
        Math.sign(stSin) *
        Math.pow(Math.abs(stSin), exp) *
        (stSin >= 0 ? st.rzFront : st.rzBack);

      const wy = st.y + syLocal * cosR - szLocal * sinR;
      const wz = st.z + syLocal * sinR + szLocal * cosR;
      positions.push(st.x, wy, wz);
      uvs.push(sFrac, rFrac);
    }
  }

  for (let s = 0; s < stCount - 1; s++) {
    const row0 = s * cols;
    const row1 = (s + 1) * cols;
    const sA = allStations[s];
    const sB = allStations[s + 1];
    const cx = 0.5 * (sA.x + sB.x);
    const cy = 0.5 * (sA.y + sB.y);
    const cz = 0.5 * (sA.z + sB.z);
    for (let r = 0; r < ringSegs; r++) {
      pushOrientedQuad(
        positions,
        indices,
        row0 + r,
        row1 + r,
        row1 + r + 1,
        row0 + r + 1,
        cx,
        cy,
        cz,
      );
    }
  }

  const firstXSt = allStations[0];
  const nextXSt = allStations[Math.min(1, stCount - 1)];
  const sxOut = firstXSt.x - nextXSt.x;
  const syOut = firstXSt.y - nextXSt.y;
  const szOut = firstXSt.z - nextXSt.z;
  const sLenOut = Math.hypot(sxOut, syOut, szOut) || 1;
  const sBump = Math.min(firstXSt.ry, firstXSt.rzFront + firstXSt.rzBack) * 0.22;
  const startCenterIdx = positions.length / 3;
  positions.push(
    firstXSt.x + (sxOut / sLenOut) * sBump,
    firstXSt.y + (syOut / sLenOut) * sBump,
    firstXSt.z + (szOut / sLenOut) * sBump,
  );
  uvs.push(0, 0.5);
  pushOrientedCap(positions, indices, startCenterIdx, 0, ringSegs, sxOut, syOut, szOut);

  const endSt = allStations[stCount - 1];
  const prevXSt = allStations[Math.max(0, stCount - 2)];
  const exOut = endSt.x - prevXSt.x;
  const eyOut = endSt.y - prevXSt.y;
  const ezOut = endSt.z - prevXSt.z;
  const eLenOut = Math.hypot(exOut, eyOut, ezOut) || 1;
  const eBump = Math.min(endSt.ry, endSt.rzFront + endSt.rzBack) * 0.22;
  const endCenterIdx = positions.length / 3;
  positions.push(
    endSt.x + (exOut / eLenOut) * eBump,
    endSt.y + (eyOut / eLenOut) * eBump,
    endSt.z + (ezOut / eLenOut) * eBump,
  );
  uvs.push(1, 0.5);
  const lastRow = (stCount - 1) * cols;
  pushOrientedCap(positions, indices, endCenterIdx, lastRow, ringSegs, exOut, eyOut, ezOut);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  averageGridSeamNormals(geo, cols, stCount);
  return geo;
}

/**
 * Watertight Thickened Curved Arc Shell Builder (`phi = 0` is `+Y`, `phi = +PI/2` is `+Z`).
 * Produces smooth rounded mudguards, flush curved pill headlamp/taillight bars, and windscreens
 * with zero paper-thin faces or open edges.
 */
function createCurvedArcShellGeo(opts: {
  centerY: number;
  centerZ: number;
  phiStart: number;
  phiEnd: number;
  radius: number | ((u: number) => number);
  halfWidth: number | ((u: number) => number);
  thickness: number;
  crownDrop?: number;
  arcSegs?: number;
  ringSegs?: number;
}): THREE.BufferGeometry {
  const arcSegs = opts.arcSegs ?? 28;
  const ringSegs = opts.ringSegs ?? 20;
  const crownDrop = opts.crownDrop ?? 0.012;
  const evalR = typeof opts.radius === 'function' ? opts.radius : () => opts.radius as number;
  const evalHW = typeof opts.halfWidth === 'function' ? opts.halfWidth : () => opts.halfWidth as number;

  const cols = ringSegs + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const arcMidY: number[] = [];
  const arcMidZ: number[] = [];
  for (let i = 0; i <= arcSegs; i++) {
    const u = i / arcSegs;
    const phi = THREE.MathUtils.lerp(opts.phiStart, opts.phiEnd, u);
    const cosP = Math.cos(phi);
    const sinP = Math.sin(phi);
    const baseR = evalR(u);
    const endTaper = Math.min(1, Math.min(u, 1 - u) / 0.05);
    const taperMul = Math.sin(endTaper * Math.PI * 0.5);
    const hw = Math.max(0.004, evalHW(u) * (0.45 + 0.55 * taperMul));
    const thick = Math.max(0.003, opts.thickness * (0.35 + 0.65 * taperMul));
    const midR = baseR - thick * 0.5;
    arcMidY.push(opts.centerY + (midR - crownDrop * 0.35) * cosP);
    arcMidZ.push(opts.centerZ + (midR - crownDrop * 0.35) * sinP);

    for (let r = 0; r <= ringSegs; r++) {
      const rFrac = r / ringSegs;
      const theta = rFrac * Math.PI * 2;
      const ct = Math.cos(theta);
      const stSin = Math.sin(theta);
      // Superellipse ring in (x, radial thickness) plus wrap crown curvature
      const sx = Math.sign(ct) * Math.pow(Math.abs(ct), 0.58) * hw;
      const sr = Math.sign(stSin) * Math.pow(Math.abs(stSin), 0.65) * (thick * 0.5);
      const wNorm = sx / Math.max(1e-4, hw);
      const radialR = midR + sr - crownDrop * wNorm * wNorm;
      const wy = opts.centerY + radialR * cosP;
      const wz = opts.centerZ + radialR * sinP;
      positions.push(sx, wy, wz);
      uvs.push(0.5 + 0.5 * wNorm, u);
    }
  }

  for (let i = 0; i < arcSegs; i++) {
    const row0 = i * cols;
    const row1 = (i + 1) * cols;
    const cy = 0.5 * (arcMidY[i] + arcMidY[i + 1]);
    const cz = 0.5 * (arcMidZ[i] + arcMidZ[i + 1]);
    for (let r = 0; r < ringSegs; r++) {
      pushOrientedQuad(
        positions,
        indices,
        row0 + r,
        row1 + r,
        row1 + r + 1,
        row0 + r + 1,
        0,
        cy,
        cz,
      );
    }
  }

  // Cap both ends cleanly with automatic outward tangent winding
  const startPhi = opts.phiStart;
  const endPhi = opts.phiEnd;
  const phiSign = endPhi >= startPhi ? 1 : -1;
  for (const [endU, rowIdx, tangentSign] of [
    [0, 0, -phiSign],
    [1, arcSegs * cols, phiSign],
  ] as [number, number, number][]) {
    const phi = THREE.MathUtils.lerp(startPhi, endPhi, endU);
    const midR = evalR(endU) - opts.thickness * 0.5;
    const cy = opts.centerY + midR * Math.cos(phi);
    const cz = opts.centerZ + midR * Math.sin(phi);
    const ty = -Math.sin(phi) * tangentSign;
    const tz = Math.cos(phi) * tangentSign;
    const cIdx = positions.length / 3;
    positions.push(0, cy, cz);
    uvs.push(0.5, endU);
    pushOrientedCap(positions, indices, cIdx, rowIdx, ringSegs, 0, ty, tz);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  averageGridSeamNormals(geo, cols, arcSegs + 1);
  return geo;
}

/**
 * Watertight Swept Tube with Elliptical Cross-Section, Rotation-Minimizing Parallel Frames,
 * and Domed Closed End-Caps (ideal for Grab Rails, Levers, Kickstands, Pinstripes & Straps).
 */
function createTubeSweepWithCapsGeo(
  curve: THREE.Curve<THREE.Vector3>,
  tubularSegs = 28,
  rx = 0.012,
  ry = 0.012,
  radialSegs = 14,
  taperEnds = false,
): THREE.BufferGeometry {
  const cols = radialSegs + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const tangents: THREE.Vector3[] = [];
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    pts.push(curve.getPointAt(t));
    tangents.push(curve.getTangentAt(t).normalize());
  }

  // Parallel-transport (Bishop) normal/binormal frame along the curve
  const t0 = tangents[0];
  const ref = Math.abs(t0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const normal = new THREE.Vector3().crossVectors(t0, ref).normalize();
  const binormal = new THREE.Vector3().crossVectors(t0, normal).normalize();
  const rotQ = new THREE.Quaternion();

  for (let i = 0; i <= tubularSegs; i++) {
    if (i > 0) {
      rotQ.setFromUnitVectors(tangents[i - 1], tangents[i]);
      normal.applyQuaternion(rotQ).normalize();
      binormal.crossVectors(tangents[i], normal).normalize();
    }
    const u = i / tubularSegs;
    const edgeDist = Math.min(u, 1 - u);
    const scale = taperEnds && edgeDist < 0.08 ? 0.35 + 0.65 * (edgeDist / 0.08) : 1.0;

    for (let r = 0; r <= radialSegs; r++) {
      const rFrac = r / radialSegs;
      const theta = rFrac * Math.PI * 2;
      const cx = Math.cos(theta) * rx * scale;
      const cy = Math.sin(theta) * ry * scale;
      const px = pts[i].x + normal.x * cx + binormal.x * cy;
      const py = pts[i].y + normal.y * cx + binormal.y * cy;
      const pz = pts[i].z + normal.z * cx + binormal.z * cy;
      positions.push(px, py, pz);
      uvs.push(rFrac, u);
    }
  }

  for (let i = 0; i < tubularSegs; i++) {
    const row0 = i * cols;
    const row1 = (i + 1) * cols;
    const cx = 0.5 * (pts[i].x + pts[i + 1].x);
    const cy = 0.5 * (pts[i].y + pts[i + 1].y);
    const cz = 0.5 * (pts[i].z + pts[i + 1].z);
    for (let r = 0; r < radialSegs; r++) {
      pushOrientedQuad(
        positions,
        indices,
        row0 + r,
        row1 + r,
        row1 + r + 1,
        row0 + r + 1,
        cx,
        cy,
        cz,
      );
    }
  }

  // Start & end dome center caps with guaranteed outward winding
  const capOffset = Math.min(rx, ry) * 0.45;
  const startCapIdx = positions.length / 3;
  positions.push(
    pts[0].x - tangents[0].x * capOffset,
    pts[0].y - tangents[0].y * capOffset,
    pts[0].z - tangents[0].z * capOffset,
  );
  uvs.push(0.5, 0);
  pushOrientedCap(positions, indices, startCapIdx, 0, radialSegs, -tangents[0].x, -tangents[0].y, -tangents[0].z);

  const endCapIdx = positions.length / 3;
  const lastP = pts[tubularSegs];
  const lastT = tangents[tubularSegs];
  positions.push(
    lastP.x + lastT.x * capOffset,
    lastP.y + lastT.y * capOffset,
    lastP.z + lastT.z * capOffset,
  );
  uvs.push(0.5, 1);
  const lastRow = tubularSegs * cols;
  pushOrientedCap(positions, indices, endCapIdx, lastRow, radialSegs, lastT.x, lastT.y, lastT.z);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  averageGridSeamNormals(geo, cols, tubularSegs + 1);
  return geo;
}

/**
 * Contoured Ergonomic Handlebar Rubber Grip (`LatheGeometry`, 28 radial segs):
 * Inner flange collar, micro-ribbed barrel, slight palm swell, and domed outer cap.
 */
function createContouredErgonomicGripGeo(length: number, radius: number): THREE.BufferGeometry {
  const half = length * 0.5;
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.002, -half),
    new THREE.Vector2(radius * 1.18, -half),
    new THREE.Vector2(radius * 1.22, -half + 0.008),
    new THREE.Vector2(radius * 0.96, -half + 0.012),
    new THREE.Vector2(radius * 1.00, -half * 0.45),
    new THREE.Vector2(radius * 1.10, 0.0),
    new THREE.Vector2(radius * 1.13, half * 0.42),
    new THREE.Vector2(radius * 1.04, half - 0.012),
    new THREE.Vector2(radius * 0.88, half - 0.003),
    new THREE.Vector2(0.002, half),
  ];
  const geo = new THREE.LatheGeometry(pts, 24);
  geo.rotateZ(-Math.PI / 2);
  return geo;
}

/**
 * Builds a precision twin-V-spoke scooter wheel assembly centered at `(0, 0, 0)` in the YZ plane
 * (axle along X axis) with high-res treaded pneumatic/PU tires and hollow ventilated rotor rings.
 */
function buildSpokeWheelAssembly(
  helper: ScooterToonPartHelper,
  outerRadius: number,
  tireTubeRadius: number,
  spokeCount: number,
  tireHex: string,
  rimHex: string,
  hubHex: string,
  discStyle: 'full_front' | 'micro_hub' | 'none' = 'none',
): THREE.Group {
  const wheelGrp = new THREE.Group();
  const torusMajorR = Math.max(0.03, outerRadius - tireTubeRadius);

  // High-res sculpted rounded tire (`22 x 44` segs) with ClampToEdge circumferential tread
  const tireGeo = new THREE.TorusGeometry(torusMajorR, tireTubeRadius, 22, 44);
  tireGeo.rotateY(Math.PI / 2);
  helper.addPart(
    wheelGrp,
    tireGeo,
    tireHex,
    [0, 0, 0],
    [0, 0, 0],
    0.004,
    getScooterTireTreadTexture(),
    1.0,
    true,
    FINISH_RUBBER_TIRE,
  );

  // Sculpted dark charcoal alloy outer rim barrel & satin rim flange lip
  const innerRimR = torusMajorR - tireTubeRadius * 0.68;
  const rimRingGeo = new THREE.TorusGeometry(innerRimR, tireTubeRadius * 0.34, 14, 40);
  rimRingGeo.rotateY(Math.PI / 2);
  helper.addPart(
    wheelGrp,
    rimRingGeo,
    rimHex,
    [0, 0, 0],
    [0, 0, 0],
    0.0025,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );

  const lipPinGeo = new THREE.TorusGeometry(innerRimR + tireTubeRadius * 0.16, tireTubeRadius * 0.085, 8, 40);
  lipPinGeo.rotateY(Math.PI / 2);
  helper.addPart(
    wheelGrp,
    lipPinGeo,
    '#aeb6c2',
    [0, 0, 0],
    [0, 0, 0],
    0,
    undefined,
    1.0,
    false,
    FINISH_SATIN_METAL,
  );

  // Central alloy hub barrel + machined silver axle bearing caps
  const hubWidth = tireTubeRadius * 1.9;
  const hubRadius = outerRadius * 0.22;
  helper.addPart(
    wheelGrp,
    new THREE.CylinderGeometry(hubRadius, hubRadius, hubWidth, 24),
    hubHex,
    [0, 0, 0],
    [0, 0, Math.PI / 2],
    0.003,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );
  helper.addPart(
    wheelGrp,
    new THREE.CylinderGeometry(hubRadius * 0.45, hubRadius * 0.45, hubWidth * 1.15, 20),
    '#adb5c0',
    [0, 0, 0],
    [0, 0, Math.PI / 2],
    0,
    undefined,
    1.0,
    false,
    FINISH_SATIN_METAL,
  );

  // Sculpted rounded Y-split twin alloy spokes (rounded extrude ribs instead of sharp BoxGeometry!)
  const spokeLen = Math.max(0.02, innerRimR - hubRadius * 0.62);
  const spokeMidR = hubRadius * 0.62 + spokeLen * 0.5;
  const spokeArmW = Math.max(0.007, outerRadius * 0.044);
  const spokeThickX = Math.max(0.011, tireTubeRadius * 0.62);
  const singleSpokeGeo = createRoundedRectExtrudeGeo(
    spokeThickX,
    spokeArmW,
    spokeLen,
    Math.min(spokeThickX, spokeArmW) * 0.42,
    0.002,
    2,
  );
  singleSpokeGeo.translate(0, -spokeLen * 0.5, 0);

  for (let i = 0; i < spokeCount; i++) {
    const baseTheta = (i / spokeCount) * Math.PI * 2;
    for (const splay of [-0.095, 0.095]) {
      const theta = baseTheta + splay;
      const sy = Math.cos(theta) * spokeMidR;
      const sz = Math.sin(theta) * spokeMidR;
      helper.addPart(
        wheelGrp,
        singleSpokeGeo,
        rimHex,
        [0, sy, sz],
        [-(baseTheta + splay * 1.7), 0, 0],
        0.0015,
        undefined,
        1.0,
        false,
        FINISH_DARK_ALLOY,
      );
    }
  }

  // Hollow ventilated stainless brake disc ring (open spokes remain visible through center!)
  if (discStyle !== 'none') {
    const discR = discStyle === 'full_front' ? outerRadius * 0.55 : outerRadius * 0.44;
    const innerHoleR = discR * 0.58;
    const discShape = new THREE.Shape();
    discShape.absarc(0, 0, discR, 0, Math.PI * 2, false);
    const holePath = new THREE.Path();
    holePath.absarc(0, 0, innerHoleR, 0, Math.PI * 2, true);
    discShape.holes.push(holePath);

    const discGeo = new THREE.ExtrudeGeometry(discShape, {
      steps: 1,
      curveSegments: 28,
      depth: 0.006,
      bevelEnabled: false,
    });
    discGeo.rotateY(Math.PI / 2);
    const dPos = discGeo.getAttribute('position');
    const dUv = discGeo.getAttribute('uv');
    if (dPos && dUv) {
      for (let i = 0; i < dPos.count; i++) {
        dUv.setXY(
          i,
          THREE.MathUtils.clamp((dPos.getZ(i) + discR) / (discR * 2), 0, 1),
          THREE.MathUtils.clamp((dPos.getY(i) + discR) / (discR * 2), 0, 1),
        );
      }
      dUv.needsUpdate = true;
    }

    helper.addPart(
      wheelGrp,
      discGeo,
      '#ffffff',
      [hubWidth * 0.52, 0, 0],
      [0, 0, 0],
      0.0015,
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
 * of the reference sheets (`~180cm` length, `~125cm` wheelbase, `~78cm` seat, `~115cm` cockpit),
 * built with continuous spline-lofted mid-res shells, seamless panel transitions, and warm pearl/charcoal/cyan finishes.
 */
export function createElectricScooterBike3D(
  options: CreateScooterModelOptions = {},
): ElectricScooterBike3DHandle {
  const helper = options.partHelper ?? makeStandardFallbackHelper();
  const pal = ELECTRIC_SCOOTER_BIKE_SPEC.palette;
  const bodyHex = options.bodyColorHex ?? '#ffffff';
  const solidPearlHex = options.bodyColorHex ?? SCOOTER_PEARL_HEX;
  const accentHex = options.accentColorHex ?? SCOOTER_REF_CYAN_HEX;
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
      const shadGeo = new THREE.PlaneGeometry(0.92, 2.08);
      shadGeo.rotateX(-Math.PI / 2);
      const shadMat = new THREE.MeshBasicMaterial({
        map: getSoftContactShadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.68,
      });
      const shadMesh = new THREE.Mesh(shadGeo, shadMat);
      shadMesh.position.set(0, 0.008, -0.02);
      root.add(shadMesh);
    }
  }

  const chassisGroup = new THREE.Group();
  chassisGroup.name = 'ElectricScooterChassis';
  root.add(chassisGroup);

  // 1) Rear Wheel (`z = -0.61, y = 0.255`) + Hub Motor + Sculpted Brushed-Silver Cast Swingarms + Dual Coil Shocks
  const rearWheelGroup = buildSpokeWheelAssembly(
    helper,
    ELECTRIC_SCOOTER_BIKE_SPEC.wheelOuterRadiusM,
    ELECTRIC_SCOOTER_BIKE_SPEC.tireSectionRadiusM,
    5,
    '#ffffff',
    '#323842',
    '#20252d',
    'none',
  );
  rearWheelGroup.name = 'ElectricScooterRearWheel';
  rearWheelGroup.position.set(0, 0.255, -0.61);
  helper.addPart(
    rearWheelGroup,
    new THREE.CylinderGeometry(0.084, 0.084, 0.098, 22),
    '#272c35',
    [0, 0, 0],
    [0, 0, Math.PI / 2],
    0.0025,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );
  helper.addPart(
    rearWheelGroup,
    new THREE.CylinderGeometry(0.090, 0.090, 0.072, 22),
    '#8e98a6',
    [0, 0, 0],
    [0, 0, Math.PI / 2],
    0,
    undefined,
    1.0,
    false,
    FINISH_SATIN_METAL,
  );
  chassisGroup.add(rearWheelGroup);

  for (const side of [-1, 1]) {
    const swingGeo = createLoftedBodyShellGeo(
      [
        { y: 0.255, z: -0.635, rx: 0.018, ryTop: 0.027, ryBot: 0.027, power: 2.6 },
        { y: 0.262, z: -0.455, rx: 0.022, ryTop: 0.038, ryBot: 0.035, power: 2.8 },
        { y: 0.276, z: -0.235, rx: 0.024, ryTop: 0.044, ryBot: 0.038, power: 2.8 },
      ],
      18,
      'side',
      3,
      'dome',
    );
    helper.addPart(
      chassisGroup,
      swingGeo,
      '#ffffff',
      [side * 0.106, 0, 0],
      [0, 0, 0],
      0.003,
      getBrushedAluminumTexture(),
      1.0,
      true,
      FINISH_SATIN_METAL,
    );
    helper.addPart(
      chassisGroup,
      createRoundedRectExtrudeGeo(0.010, 0.20, 0.018, 0.004, 0.002, 2),
      '#353b45',
      [side * 0.125, 0.255, -0.425],
      [0.03, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_DARK_ALLOY,
    );
    helper.addPart(
      chassisGroup,
      new THREE.CylinderGeometry(0.021, 0.021, 0.028, 18),
      '#c7cdd6',
      [side * 0.122, 0.255, -0.61],
      [0, 0, Math.PI / 2],
      0.002,
      undefined,
      1.0,
      false,
      FINISH_SATIN_METAL,
    );

    // Twin Rear Coil-Over Shock Absorbers
    const shockGrp = new THREE.Group();
    shockGrp.position.set(side * 0.122, 0.420, -0.512);
    shockGrp.rotation.x = 0.52;
    chassisGroup.add(shockGrp);
    helper.addPart(
      shockGrp,
      new THREE.CylinderGeometry(0.012, 0.011, 0.28, 16),
      '#c7cdd6',
      [0, 0, 0],
      [0, 0, 0],
      0.002,
      undefined,
      1.0,
      false,
      FINISH_SATIN_METAL,
    );
    helper.addPart(
      shockGrp,
      new THREE.CylinderGeometry(0.019, 0.019, 0.044, 16),
      '#2d323b',
      [0, 0.115, 0],
      [0, 0, 0],
      0.002,
      undefined,
      1.0,
      false,
      FINISH_DARK_ALLOY,
    );
    for (let c = -4; c <= 3; c++) {
      const ringGeo = new THREE.TorusGeometry(0.022, 0.0052, 10, 20);
      ringGeo.rotateX(Math.PI / 2);
      helper.addPart(
        shockGrp,
        ringGeo,
        '#282d36',
        [0, c * 0.022 - 0.005, 0],
        [0, 0, 0],
        0,
        undefined,
        1.0,
        false,
        FINISH_DARK_ALLOY,
      );
    }
  }
  // Rear brake caliper on right swingarm
  helper.addPart(
    chassisGroup,
    createRoundedRectExtrudeGeo(0.032, 0.054, 0.044, 0.012, 0.004, 3),
    '#414854',
    [0.088, 0.318, -0.682],
    [0.45, 0, 0],
    0.002,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );

  // 2) Watertight Charcoal Structural Inner Bodywork:
  // (a) Full-Depth Sculpted Dashboard / Inner Knee-Shield Column (`y = 0.96 -> 0.24`, zero side air gap behind front shield!)
  const innerDashboardGeo = createLoftedBodyShellGeo(
    [
      { y: 0.958, z: 0.312, rx: 0.136, ryTop: 0.048, ryBot: 0.056, pitchRad: Math.PI / 2, power: 2.9 },
      { y: 0.850, z: 0.352, rx: 0.166, ryTop: 0.068, ryBot: 0.068, pitchRad: Math.PI / 2, power: 3.1 },
      { y: 0.720, z: 0.398, rx: 0.178, ryTop: 0.090, ryBot: 0.088, pitchRad: Math.PI / 2, power: 3.2 },
      { y: 0.610, z: 0.418, rx: 0.184, ryTop: 0.096, ryBot: 0.096, pitchRad: Math.PI / 2, power: 3.2 },
      { y: 0.480, z: 0.386, rx: 0.174, ryTop: 0.082, ryBot: 0.082, pitchRad: Math.PI / 2, power: 3.1 },
      { y: 0.335, z: 0.338, rx: 0.162, ryTop: 0.062, ryBot: 0.072, pitchRad: Math.PI / 2, power: 3.0 },
      { y: 0.242, z: 0.285, rx: 0.156, ryTop: 0.056, ryBot: 0.068, pitchRad: Math.PI / 2, power: 3.0 },
    ],
    28,
    'wrap',
    3,
    'dome',
  );
  helper.addPart(
    chassisGroup,
    innerDashboardGeo,
    SCOOTER_CHARCOAL_HEX,
    [0, 0, 0],
    [0, 0, 0],
    0.005,
    undefined,
    1.0,
    true,
    FINISH_MATTE_TRIM,
  );

  // (b) Horizontal Chassis Floorboard Tub overlapping seamlessly into Dashboard base & Under-Seat tub
  const floorboardTubGeo = createLoftedBodyShellGeo(
    [
      { y: 0.218, z: 0.320, rx: 0.158, ryTop: 0.036, ryBot: 0.032, pitchRad: 0.0, power: 3.1 },
      { y: 0.205, z: 0.055, rx: 0.160, ryTop: 0.036, ryBot: 0.034, pitchRad: 0.0, power: 3.2 },
      { y: 0.216, z: -0.255, rx: 0.154, ryTop: 0.040, ryBot: 0.034, pitchRad: 0.0, power: 3.0 },
    ],
    26,
    'wrap',
    3,
    'dome',
  );
  helper.addPart(
    chassisGroup,
    floorboardTubGeo,
    SCOOTER_CHARCOAL_HEX,
    [0, 0, 0],
    [0, 0, 0],
    0.004,
    undefined,
    1.0,
    true,
    FINISH_MATTE_TRIM,
  );

  // (c) Solid Under-Seat Polymer Battery / Frame Enclosure (`y = 0.22 -> 0.70`, zero void under seat!)
  const underSeatTubGeo = createLoftedBodyShellGeo(
    [
      { y: 0.220, z: -0.215, rx: 0.146, ryTop: 0.095, ryBot: 0.105, pitchRad: Math.PI / 2, power: 3.0 },
      { y: 0.380, z: -0.235, rx: 0.146, ryTop: 0.115, ryBot: 0.125, pitchRad: Math.PI / 2, power: 3.1 },
      { y: 0.560, z: -0.255, rx: 0.148, ryTop: 0.145, ryBot: 0.145, pitchRad: Math.PI / 2, power: 3.1 },
      { y: 0.695, z: -0.250, rx: 0.128, ryTop: 0.155, ryBot: 0.155, pitchRad: Math.PI / 2, power: 2.9 },
    ],
    28,
    'wrap',
    3,
    'dome',
  );
  helper.addPart(
    chassisGroup,
    underSeatTubGeo,
    SCOOTER_CHARCOAL_HEX,
    [0, 0, 0],
    [0, 0, 0],
    0.005,
    undefined,
    1.0,
    true,
    FINISH_MATTE_TRIM,
  );

  // (d) Inner Rear Wheel-Well Overhead Undertray sealing under rear bodywork (`z = -0.35 .. -0.76`)
  const rearWheelWellPanGeo = createLoftedBodyShellGeo(
    [
      { y: 0.605, z: -0.350, rx: 0.152, ryTop: 0.052, ryBot: 0.044, pitchRad: 0.08, power: 2.9 },
      { y: 0.635, z: -0.560, rx: 0.154, ryTop: 0.048, ryBot: 0.042, pitchRad: 0.08, power: 3.0 },
      { y: 0.655, z: -0.765, rx: 0.112, ryTop: 0.038, ryBot: 0.030, pitchRad: 0.10, power: 2.8 },
    ],
    24,
    'wrap',
    3,
    'dome',
  );
  helper.addPart(
    chassisGroup,
    rearWheelWellPanGeo,
    SCOOTER_DEEP_CHARCOAL_HEX,
    [0, 0, 0],
    [0, 0, 0],
    0.003,
    undefined,
    1.0,
    true,
    FINISH_MATTE_TRIM,
  );

  // Molded Anti-Slip Transverse-Rib Floorboard Mat (`y = 0.244`)
  helper.addPart(
    chassisGroup,
    createRoundedRectExtrudeGeo(0.288, 0.46, 0.010, 0.058, 0.004, 4),
    '#ffffff',
    [0, 0.241, 0.055],
    [0, 0, 0],
    0.0025,
    getElectricFloorMatTexture(),
    1.0,
    false,
    FINISH_RUBBER_TIRE,
  );
  // Slanted front toe-board grip mat extension matching 3/4 Iso reference
  helper.addPart(
    chassisGroup,
    createRoundedRectExtrudeGeo(0.258, 0.14, 0.008, 0.042, 0.003, 3),
    SCOOTER_DEEP_CHARCOAL_HEX,
    [0, 0.285, 0.305],
    [-0.68, 0, 0],
    0,
    undefined,
    1.0,
    false,
    FINISH_RUBBER_TIRE,
  );

  // Sculpted Continuous Pearl-White Side Fairing Chin + Lower Rocker Sill Skirts + Cyan Edge Trim + Side Pod Badge
  for (const side of [-1, 1]) {
    const rockerCheekGeo = createLoftedBodyShellGeo(
      [
        { y: 0.588, z: 0.478, offsetX: side * 0.152, rx: 0.032, ryTop: 0.038, ryBot: 0.032, pitchRad: 0.90, power: 2.8 },
        { y: 0.420, z: 0.420, offsetX: side * 0.162, rx: 0.030, ryTop: 0.038, ryBot: 0.032, pitchRad: 0.65, power: 3.0 },
        { y: 0.232, z: 0.305, offsetX: side * 0.166, rx: 0.030, ryTop: 0.034, ryBot: 0.028, pitchRad: 0.20, power: 3.0 },
        { y: 0.205, z: 0.060, offsetX: side * 0.168, rx: 0.030, ryTop: 0.030, ryBot: 0.026, pitchRad: 0.0, power: 3.1 },
        { y: 0.215, z: -0.165, offsetX: side * 0.162, rx: 0.029, ryTop: 0.031, ryBot: 0.026, pitchRad: -0.14, power: 3.0 },
        { y: 0.295, z: -0.252, offsetX: side * 0.148, rx: 0.028, ryTop: 0.032, ryBot: 0.026, pitchRad: -0.45, power: 2.8 },
      ],
      20,
      'wrap',
      3,
      'dome',
    );
    helper.addPart(
      chassisGroup,
      rockerCheekGeo,
      solidPearlHex,
      [0, 0, 0],
      [0, 0, 0],
      0.004,
      undefined,
      1.0,
      true,
      FINISH_GLOSS_BODY,
    );

    // Continuous outer cyan-teal pinstripe flowing cleanly along front apron edge -> rocker sill -> rear cowl
    const pinCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.142, 0.942, 0.330),
      new THREE.Vector3(side * 0.178, 0.775, 0.436),
      new THREE.Vector3(side * 0.190, 0.618, 0.514),
      new THREE.Vector3(side * 0.184, 0.455, 0.440),
      new THREE.Vector3(side * 0.188, 0.242, 0.318),
      new THREE.Vector3(side * 0.190, 0.214, 0.060),
      new THREE.Vector3(side * 0.184, 0.226, -0.165),
      new THREE.Vector3(side * 0.166, 0.290, -0.242),
    ]);
    helper.addPart(
      chassisGroup,
      createTubeSweepWithCapsGeo(pinCurve, 36, 0.0055, 0.0045, 10, true),
      accentHex,
      [0, 0, 0],
      [0, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_GLOSS_BODY,
    );

    // Signature horizontal brushed-silver side trim badge above swingarm pivot (3/4 Iso & Side Profile)
    helper.addPart(
      chassisGroup,
      createRoundedRectExtrudeGeo(0.016, 0.115, 0.020, 0.008, 0.004, 3),
      '#ffffff',
      [side * 0.144, 0.310, -0.245],
      [0.06, 0, 0],
      0.002,
      getBrushedAluminumTexture(),
      1.0,
      false,
      FINISH_SATIN_METAL,
    );
  }

  // 3) Sculpted Continuous Front Shield Shell + Flush Vertical DRL + Flush Curved Headlamp Bar + Steering Collar
  const frontShieldGeo = createLoftedBodyShellGeo(
    [
      { y: 0.960, z: 0.315, rx: 0.144, ryTop: 0.036, ryBot: 0.032, pitchRad: 1.02, power: 2.8 },
      { y: 0.865, z: 0.375, rx: 0.172, ryTop: 0.045, ryBot: 0.040, pitchRad: 1.02, power: 3.0 },
      { y: 0.745, z: 0.448, rx: 0.186, ryTop: 0.048, ryBot: 0.044, pitchRad: 1.05, power: 3.1 },
      { y: 0.618, z: 0.514, rx: 0.192, ryTop: 0.048, ryBot: 0.044, pitchRad: 1.14, power: 3.1 },
      { y: 0.545, z: 0.516, rx: 0.178, ryTop: 0.038, ryBot: 0.036, pitchRad: 1.34, power: 3.0 },
    ],
    32,
    'front',
    4,
    'dome',
  );
  helper.addPart(
    chassisGroup,
    frontShieldGeo,
    bodyHex,
    [0, 0, 0],
    [0, 0, 0],
    0.006,
    options.bodyColorHex ? undefined : getElectricFrontShieldTexture(),
    1.0,
    true,
    FINISH_GLOSS_BODY,
  );

  // Dark Steering Column Neck Pocket Ring bridging chassis shield cleanly into steered nacelle (zero floating gap!)
  helper.addPart(
    chassisGroup,
    new THREE.CylinderGeometry(0.068, 0.076, 0.038, 24),
    SCOOTER_DEEP_CHARCOAL_HEX,
    [0, 0.962, 0.300],
    [0.25, 0, 0],
    0.003,
    undefined,
    1.0,
    false,
    FINISH_MATTE_TRIM,
  );

  // Flush Vertical Capsule DRL Headlight Bar hugging outer front shield curvature cleanly
  const vDrlGrp = new THREE.Group();
  vDrlGrp.position.set(0, 0.808, 0.453);
  vDrlGrp.rotation.x = -0.565;
  chassisGroup.add(vDrlGrp);

  const drlBezelGeo = new THREE.CapsuleGeometry(0.023, 0.172, 10, 20);
  drlBezelGeo.scale(1.0, 1.0, 0.30);
  helper.addPart(
    vDrlGrp,
    drlBezelGeo,
    '#323842',
    [0, 0, 0.004],
    [0, 0, 0],
    0.002,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );
  const drlRimGeo = new THREE.CapsuleGeometry(0.0175, 0.164, 10, 20);
  drlRimGeo.scale(1.0, 1.0, 0.32);
  helper.addPart(
    vDrlGrp,
    drlRimGeo,
    accentHex,
    [0, 0, 0.0075],
    [0, 0, 0],
    0,
    undefined,
    1.0,
    false,
    FINISH_OPTICAL_LENS,
  );
  const drlCoreGeo = new THREE.CapsuleGeometry(0.0115, 0.152, 10, 20);
  drlCoreGeo.scale(1.0, 1.0, 0.36);
  addLuminousScooterPart(
    helper,
    vDrlGrp,
    drlCoreGeo,
    '#f4feff',
    '#9ef2ed',
    0.85,
    [0, 0, 0.011],
  );

  // Flush Wrap-Around Curved Horizontal Headlamp Bar (`y = 0.625`, wrapped tangentially across shield!)
  const headlampBezelGeo = createLoftedXShellGeo(
    [
      { x: -0.156, y: 0.632, z: 0.514, ry: 0.019, rzFront: 0.012, rzBack: 0.028, rollRad: 0.12, power: 2.8 },
      { x: -0.090, y: 0.626, z: 0.544, ry: 0.026, rzFront: 0.014, rzBack: 0.030, rollRad: 0.08, power: 3.0 },
      { x: 0.0, y: 0.623, z: 0.556, ry: 0.028, rzFront: 0.015, rzBack: 0.030, rollRad: 0.0, power: 3.2 },
      { x: 0.090, y: 0.626, z: 0.544, ry: 0.026, rzFront: 0.014, rzBack: 0.030, rollRad: -0.08, power: 3.0 },
      { x: 0.156, y: 0.632, z: 0.514, ry: 0.019, rzFront: 0.012, rzBack: 0.028, rollRad: -0.12, power: 2.8 },
    ],
    22,
    3,
  );
  helper.addPart(
    chassisGroup,
    headlampBezelGeo,
    '#2a2f38',
    [0, 0, 0],
    [0, 0, 0],
    0.0025,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );

  const headlampLensGeo = createLoftedXShellGeo(
    [
      { x: -0.146, y: 0.632, z: 0.518, ry: 0.013, rzFront: 0.013, rzBack: 0.018, power: 2.6 },
      { x: -0.085, y: 0.626, z: 0.548, ry: 0.019, rzFront: 0.015, rzBack: 0.018, power: 3.0 },
      { x: 0.0, y: 0.623, z: 0.560, ry: 0.021, rzFront: 0.016, rzBack: 0.018, power: 3.2 },
      { x: 0.085, y: 0.626, z: 0.548, ry: 0.019, rzFront: 0.015, rzBack: 0.018, power: 3.0 },
      { x: 0.146, y: 0.632, z: 0.518, ry: 0.013, rzFront: 0.013, rzBack: 0.018, power: 2.6 },
    ],
    22,
    3,
  );
  addLuminousScooterPart(
    helper,
    chassisGroup,
    headlampLensGeo,
    '#ffffff',
    '#cfeef2',
    0.72,
    [0, 0, 0],
    [0, 0, 0],
    getElectricHeadlampBarTexture(),
  );

  // Inner Dashboard / Knee-Wall Detailing (`Rear Elevation`: twin sculpted pockets, folding bag hook & key bezel)
  for (const side of [-1, 1]) {
    helper.addPart(
      chassisGroup,
      createRoundedRectExtrudeGeo(0.094, 0.032, 0.096, 0.018, 0.004, 4),
      SCOOTER_DEEP_CHARCOAL_HEX,
      [side * 0.082, 0.772, 0.285],
      [0.24, 0, 0],
      0.002,
      undefined,
      1.0,
      false,
      FINISH_MATTE_TRIM,
    );
    helper.addPart(
      chassisGroup,
      createRoundedRectExtrudeGeo(0.078, 0.014, 0.016, 0.006, 0.002, 3),
      '#1a1e24',
      [side * 0.082, 0.816, 0.270],
      [0.24, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_RUBBER_TIRE,
    );
  }
  // Center chrome/dark folding shopping bag hook & upper spine rib
  helper.addPart(
    chassisGroup,
    createRoundedRectExtrudeGeo(0.032, 0.020, 0.048, 0.008, 0.003, 3),
    '#434b59',
    [0, 0.790, 0.278],
    [0.24, 0, 0],
    0,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );
  const bagHookCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.785, 0.270),
    new THREE.Vector3(0, 0.758, 0.252),
    new THREE.Vector3(0, 0.770, 0.245),
  ]);
  helper.addPart(
    chassisGroup,
    createTubeSweepWithCapsGeo(bagHookCurve, 12, 0.005, 0.005, 10, true),
    SCOOTER_SILVER_TRIM_HEX,
    [0, 0, 0],
    [0, 0, 0],
    0,
    undefined,
    1.0,
    false,
    FINISH_SATIN_METAL,
  );
  // Ignition key cylinder bezel on upper right dashboard
  helper.addPart(
    chassisGroup,
    new THREE.CylinderGeometry(0.015, 0.016, 0.012, 18),
    '#3e4652',
    [0.085, 0.858, 0.264],
    [Math.PI / 2 - 0.24, 0, 0],
    0,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );
  helper.addPart(
    chassisGroup,
    new THREE.CylinderGeometry(0.0085, 0.0085, 0.014, 16),
    '#1c2026',
    [0.085, 0.858, 0.263],
    [Math.PI / 2 - 0.24, 0, 0],
    0,
    undefined,
    1.0,
    false,
    FINISH_SATIN_METAL,
  );

  // 4) Continuous Rear Monocoque Bodywork + 3D Boomerang Hip Pods + Plush Stitched 2-Up Saddle + Aerodynamic Grab Rail
  const rearBodyGeo = createLoftedBodyShellGeo(
    [
      { y: 0.706, z: -0.805, rx: 0.118, ryTop: 0.044, ryBot: 0.042, pitchRad: 0.10, power: 2.8 },
      { y: 0.696, z: -0.665, rx: 0.172, ryTop: 0.060, ryBot: 0.062, pitchRad: 0.12, power: 3.0 },
      { y: 0.672, z: -0.485, rx: 0.190, ryTop: 0.072, ryBot: 0.078, pitchRad: 0.14, power: 3.1 },
      { y: 0.646, z: -0.315, rx: 0.176, ryTop: 0.068, ryBot: 0.078, pitchRad: 0.16, power: 3.0 },
      { y: 0.605, z: -0.195, rx: 0.152, ryTop: 0.056, ryBot: 0.062, pitchRad: 0.24, power: 2.8 },
    ],
    30,
    'side',
    4,
    'dome',
  );
  helper.addPart(
    chassisGroup,
    rearBodyGeo,
    bodyHex,
    [0, 0, 0],
    [0, 0, 0],
    0.006,
    options.bodyColorHex ? undefined : getElectricSideCowlTexture(),
    1.0,
    true,
    FINISH_GLOSS_BODY,
  );

  // Sculpted 3D Boomerang Quarter Cheek Fairings + Seamless Cyan Livery Trim (`media_1794789749436_31ebafbe.jpg`)
  for (const side of [-1, 1]) {
    const hipPodGeo = createLoftedBodyShellGeo(
      [
        { y: 0.654, z: -0.715, offsetX: side * 0.144, rx: 0.022, ryTop: 0.026, ryBot: 0.026, pitchRad: 0.14, power: 2.7 },
        { y: 0.638, z: -0.520, offsetX: side * 0.172, rx: 0.028, ryTop: 0.056, ryBot: 0.060, pitchRad: 0.22, power: 3.0 },
        { y: 0.592, z: -0.305, offsetX: side * 0.168, rx: 0.028, ryTop: 0.066, ryBot: 0.070, pitchRad: 0.34, power: 3.0 },
        { y: 0.505, z: -0.160, offsetX: side * 0.148, rx: 0.020, ryTop: 0.044, ryBot: 0.046, pitchRad: 0.52, power: 2.7 },
      ],
      20,
      'side',
      3,
      'dome',
    );
    helper.addPart(
      chassisGroup,
      hipPodGeo,
      solidPearlHex,
      [0, 0, 0],
      [0, 0, 0],
      0.004,
      undefined,
      1.0,
      true,
      FINISH_GLOSS_BODY,
    );

    // 3D Boomerang cyan stripe framing the side pod upper crest & forward chevron edge (tucked flush on pod!)
    const boomCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.148, 0.668, -0.745),
      new THREE.Vector3(side * 0.192, 0.646, -0.520),
      new THREE.Vector3(side * 0.192, 0.606, -0.295),
      new THREE.Vector3(side * 0.162, 0.502, -0.158),
      new THREE.Vector3(side * 0.152, 0.478, -0.235),
    ]);
    helper.addPart(
      chassisGroup,
      createTubeSweepWithCapsGeo(boomCurve, 28, 0.0050, 0.0040, 10, true),
      accentHex,
      [0, 0, 0],
      [0, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_GLOSS_BODY,
    );
  }

  // Contoured Two-Tier Plush Stitched 2-Up Saddle Seat (`~78cm` rider bucket + `~82cm` passenger pillion)
  const saddleGeo = createLoftedBodyShellGeo(
    [
      { y: 0.774, z: -0.680, rx: 0.122, ryTop: 0.044, ryBot: 0.058, pitchRad: 0.08, power: 2.7 },
      { y: 0.778, z: -0.535, rx: 0.166, ryTop: 0.048, ryBot: 0.066, pitchRad: 0.06, power: 3.0 },
      { y: 0.768, z: -0.400, rx: 0.170, ryTop: 0.046, ryBot: 0.068, pitchRad: 0.08, power: 3.0 },
      { y: 0.728, z: -0.295, rx: 0.174, ryTop: 0.048, ryBot: 0.068, pitchRad: 0.05, power: 3.1 },
      { y: 0.722, z: -0.145, rx: 0.164, ryTop: 0.048, ryBot: 0.066, pitchRad: -0.05, power: 2.9 },
      { y: 0.716, z: -0.025, rx: 0.114, ryTop: 0.044, ryBot: 0.050, pitchRad: -0.22, power: 2.6 },
    ],
    28,
    'side',
    4,
    'dome',
  );
  helper.addPart(
    chassisGroup,
    saddleGeo,
    '#ffffff',
    [0, 0, 0],
    [0, 0, 0],
    0.005,
    getSaddleLeatherTexture(),
    1.0,
    true,
    FINISH_SADDLE_LEATHER,
  );

  // Cast Satin-Silver Aerodynamic Flattened-Oval Wrap-Around Rear Grab Rail (`z = -0.48 .. -0.785`)
  const grabCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.158, 0.742, -0.485),
    new THREE.Vector3(-0.160, 0.780, -0.555),
    new THREE.Vector3(-0.150, 0.808, -0.710),
    new THREE.Vector3(0, 0.818, -0.778),
    new THREE.Vector3(0.150, 0.808, -0.710),
    new THREE.Vector3(0.160, 0.780, -0.555),
    new THREE.Vector3(0.158, 0.742, -0.485),
  ]);
  helper.addPart(
    chassisGroup,
    createTubeSweepWithCapsGeo(grabCurve, 34, 0.0175, 0.0115, 16, true),
    '#ffffff',
    [0, 0, 0],
    [0, 0, 0],
    0.0035,
    getBrushedAluminumTexture(),
    1.0,
    true,
    FINISH_SATIN_METAL,
  );

  // 5) Watertight Flush Curved LED Taillight Bar + Rear Tire-Hugger Mudguard & License Plate Bracket
  const tailHousingGeo = createLoftedXShellGeo(
    [
      { x: -0.148, y: 0.694, z: -0.762, ry: 0.018, rzFront: 0.022, rzBack: 0.014, rollRad: -0.10, power: 2.8 },
      { x: -0.078, y: 0.696, z: -0.806, ry: 0.020, rzFront: 0.022, rzBack: 0.014, rollRad: -0.04, power: 3.0 },
      { x: 0.0, y: 0.697, z: -0.818, ry: 0.021, rzFront: 0.022, rzBack: 0.015, rollRad: 0.0, power: 3.1 },
      { x: 0.078, y: 0.696, z: -0.806, ry: 0.020, rzFront: 0.022, rzBack: 0.014, rollRad: 0.04, power: 3.0 },
      { x: 0.148, y: 0.694, z: -0.762, ry: 0.018, rzFront: 0.022, rzBack: 0.014, rollRad: 0.10, power: 2.8 },
    ],
    20,
    3,
  );
  helper.addPart(
    chassisGroup,
    tailHousingGeo,
    '#20252d',
    [0, 0, 0],
    [0, 0, 0],
    0.002,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );
  const tailLensGeo = createLoftedXShellGeo(
    [
      { x: -0.140, y: 0.694, z: -0.766, ry: 0.013, rzFront: 0.016, rzBack: 0.016, power: 2.8 },
      { x: -0.074, y: 0.696, z: -0.810, ry: 0.015, rzFront: 0.016, rzBack: 0.016, power: 3.0 },
      { x: 0.0, y: 0.697, z: -0.822, ry: 0.016, rzFront: 0.016, rzBack: 0.017, power: 3.1 },
      { x: 0.074, y: 0.696, z: -0.810, ry: 0.015, rzFront: 0.016, rzBack: 0.016, power: 3.0 },
      { x: 0.140, y: 0.694, z: -0.766, ry: 0.013, rzFront: 0.016, rzBack: 0.016, power: 2.8 },
    ],
    20,
    3,
  );
  const brakeLightMesh = addLuminousScooterPart(
    helper,
    chassisGroup,
    tailLensGeo,
    '#ffffff',
    pal.taillightRed,
    0.92,
    [0, 0, 0],
    [0, 0, 0],
    getElectricTaillightBarTexture(),
  );
  // Amber rear turn indicator strips integrated below outer taillight corners
  for (const side of [-1, 1]) {
    addLuminousScooterPart(
      helper,
      chassisGroup,
      createRoundedRectExtrudeGeo(0.032, 0.011, 0.007, 0.004, 0.001, 2),
      pal.indicatorAmber,
      pal.indicatorAmber,
      0.55,
      [side * 0.125, 0.668, -0.768],
      [-Math.PI / 2 - 0.15, 0, -side * 0.25],
    );
  }

  // Curved Arched Rear Mudguard + License Plate Frame + Reflectors (`Rear Elevation` reference)
  const rearFenderGeo = createCurvedArcShellGeo({
    centerY: 0.255,
    centerZ: -0.61,
    phiStart: -1.24,
    phiEnd: -0.68,
    radius: (u) => THREE.MathUtils.lerp(0.322, 0.348, u),
    halfWidth: (u) => THREE.MathUtils.lerp(0.072, 0.098, u),
    thickness: 0.016,
    crownDrop: 0.016,
    arcSegs: 24,
    ringSegs: 18,
  });
  helper.addPart(
    chassisGroup,
    rearFenderGeo,
    SCOOTER_CHARCOAL_HEX,
    [0, 0, 0],
    [0, 0, 0],
    0.004,
    undefined,
    1.0,
    true,
    FINISH_MATTE_TRIM,
  );
  const rearPlateGrp = new THREE.Group();
  rearPlateGrp.position.set(0, 0.505, -0.865);
  rearPlateGrp.rotation.x = 0.44;
  chassisGroup.add(rearPlateGrp);

  helper.addPart(
    rearPlateGrp,
    createRoundedRectExtrudeGeo(0.158, 0.104, 0.012, 0.016, 0.003, 3),
    '#e4e7ec',
    [0, 0, 0],
    [Math.PI / 2, 0, 0],
    0.002,
    undefined,
    1.0,
    false,
    FINISH_SATIN_METAL,
  );
  addLuminousScooterPart(
    helper,
    rearPlateGrp,
    createRoundedRectExtrudeGeo(0.062, 0.018, 0.012, 0.005, 0.002, 2),
    pal.taillightRed,
    pal.taillightRed,
    0.65,
    [0, -0.096, 0.012],
    [Math.PI / 2, 0, 0],
  );
  for (const side of [-1, 1]) {
    helper.addPart(
      rearPlateGrp,
      createRoundedRectExtrudeGeo(0.022, 0.015, 0.008, 0.004, 0.001, 2),
      SCOOTER_DEEP_CHARCOAL_HEX,
      [side * 0.084, 0.006, 0.006],
      [0, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_MATTE_TRIM,
    );
    addLuminousScooterPart(
      helper,
      rearPlateGrp,
      new THREE.CylinderGeometry(0.014, 0.014, 0.010, 16),
      pal.indicatorAmber,
      pal.indicatorAmber,
      0.45,
      [side * 0.092, 0.006, 0.006],
      [0, 0, Math.PI / 2],
    );
  }

  // 6) Articulated Steering Group (Forks, Contoured Mudguard + Riveted Ears, Wheel, Satin-Charcoal Nacelle, Smoked Visor & Mirrors)
  const steeringGroup = new THREE.Group();
  steeringGroup.name = 'ElectricScooterSteeringGroup';
  steeringGroup.position.set(
    ELECTRIC_SCOOTER_BIKE_SPEC.steeringPivot.x,
    ELECTRIC_SCOOTER_BIKE_SPEC.steeringPivot.y,
    ELECTRIC_SCOOTER_BIKE_SPEC.steeringPivot.z,
  );
  chassisGroup.add(steeringGroup);

  // Tapered Steering Column Neck Bridge (seamlessly connecting Nacelle down into Front Shield Collar!)
  helper.addPart(
    steeringGroup,
    new THREE.CylinderGeometry(0.046, 0.056, 0.14, 24),
    SCOOTER_CHARCOAL_HEX,
    [0, 0.018, -0.004],
    [0.25, 0, 0],
    0.003,
    undefined,
    1.0,
    true,
    FINISH_MATTE_TRIM,
  );

  // Telescopic Front Fork Stanchions & Sliders (`(0, -0.705, +0.34)` wheel axle)
  const forkDx = 0.34;
  const forkDy = -0.705;
  const forkAngleX = -Math.atan2(forkDx, -forkDy);
  for (const side of [-1, 1]) {
    helper.addPart(
      steeringGroup,
      new THREE.CylinderGeometry(0.021, 0.019, 0.25, 20),
      '#343a44',
      [side * 0.080, forkDy * 0.87, forkDx * 0.87],
      [forkAngleX, 0, 0],
      0.003,
      undefined,
      1.0,
      false,
      FINISH_DARK_ALLOY,
    );
    helper.addPart(
      steeringGroup,
      new THREE.CylinderGeometry(0.0155, 0.0155, 0.21, 18),
      '#cfd5de',
      [side * 0.080, forkDy * 0.65, forkDx * 0.65],
      [forkAngleX, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_SATIN_METAL,
    );
    helper.addPart(
      steeringGroup,
      new THREE.CylinderGeometry(0.019, 0.019, 0.022, 16),
      '#adb5c0',
      [side * 0.095, forkDy, forkDx],
      [0, 0, Math.PI / 2],
      0.002,
      undefined,
      1.0,
      false,
      FINISH_SATIN_METAL,
    );
  }
  helper.addPart(
    steeringGroup,
    createRoundedRectExtrudeGeo(0.032, 0.056, 0.048, 0.012, 0.004, 3),
    '#434a56',
    [0.068, forkDy + 0.056, forkDx - 0.046],
    [0.3, 0, 0],
    0.002,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );

  // Sculpted Contoured Pearl-White Front Mudguard Fender hovering cleanly OVER the Front Tire (`phi = -0.58 .. +0.94`)
  const frontFenderShellGeo = createCurvedArcShellGeo({
    centerY: forkDy,
    centerZ: forkDx,
    phiStart: -0.58,
    phiEnd: 0.96,
    radius: (u) => 0.288 + Math.sin(u * Math.PI) * 0.006,
    halfWidth: (u) => THREE.MathUtils.lerp(0.072, 0.058, u),
    thickness: 0.017,
    crownDrop: 0.022,
    arcSegs: 28,
    ringSegs: 20,
  });
  helper.addPart(
    steeringGroup,
    frontFenderShellGeo,
    solidPearlHex,
    [0, 0, 0],
    [0, 0, 0],
    0.0045,
    undefined,
    1.0,
    true,
    FINISH_GLOSS_BODY,
  );

  // Twin Sculpted Fender Fork-Mount Gusset Ears & Two Silver Rivets per side (`3/4 Iso & Side View`!)
  for (const side of [-1, 1]) {
    helper.addPart(
      steeringGroup,
      createLoftedBodyShellGeo(
        [
          { y: forkDy + 0.245, z: forkDx - 0.045, offsetX: side * 0.076, rx: 0.008, ryTop: 0.020, ryBot: 0.024, power: 2.8 },
          { y: forkDy + 0.165, z: forkDx - 0.072, offsetX: side * 0.080, rx: 0.008, ryTop: 0.016, ryBot: 0.018, power: 2.6 },
        ],
        14,
        'side',
        2,
        'dome',
      ),
      solidPearlHex,
      [0, 0, 0],
      [0, 0, 0],
      0.0025,
      undefined,
      1.0,
      false,
      FINISH_GLOSS_BODY,
    );
    for (const [ryOff, rzOff] of [
      [0.215, -0.052],
      [0.180, -0.068],
    ]) {
      helper.addPart(
        steeringGroup,
        new THREE.CylinderGeometry(0.005, 0.005, 0.008, 12),
        '#475569',
        [side * 0.086, forkDy + ryOff, forkDx + rzOff],
        [0, 0, Math.PI / 2],
        0,
        undefined,
        1.0,
        false,
        FINISH_SATIN_METAL,
      );
    }
  }

  // Front 5-Twin-Spoke Alloy Wheel Assembly at `(0, -0.705, +0.34)`
  const frontWheelGroup = buildSpokeWheelAssembly(
    helper,
    ELECTRIC_SCOOTER_BIKE_SPEC.wheelOuterRadiusM,
    ELECTRIC_SCOOTER_BIKE_SPEC.tireSectionRadiusM,
    5,
    '#ffffff',
    '#323842',
    '#20252d',
    'full_front',
  );
  frontWheelGroup.name = 'ElectricScooterFrontWheel';
  frontWheelGroup.position.set(0, forkDy, forkDx);
  steeringGroup.add(frontWheelGroup);

  // 6b) Satin Dark Charcoal Handlebar Nacelle (`70cm` span w/ mirrors) + Smoked Glossy Windscreen Visor + Digital Cockpit
  const handlebarNacelleGeo = createLoftedXShellGeo(
    [
      { x: -0.194, y: 0.128, z: -0.036, ry: 0.025, rzFront: 0.028, rzBack: 0.026, rollRad: 0.18, power: 2.6 },
      { x: -0.130, y: 0.126, z: -0.022, ry: 0.036, rzFront: 0.044, rzBack: 0.042, rollRad: 0.24, power: 3.0 },
      { x: 0.0, y: 0.118, z: -0.010, ry: 0.048, rzFront: 0.062, rzBack: 0.064, rollRad: 0.30, power: 3.1 },
      { x: 0.130, y: 0.126, z: -0.022, ry: 0.036, rzFront: 0.044, rzBack: 0.042, rollRad: 0.24, power: 3.0 },
      { x: 0.194, y: 0.128, z: -0.036, ry: 0.025, rzFront: 0.028, rzBack: 0.026, rollRad: 0.18, power: 2.6 },
    ],
    26,
    4,
  );
  helper.addPart(
    steeringGroup,
    handlebarNacelleGeo,
    SCOOTER_CHARCOAL_HEX,
    [0, 0, 0],
    [0, 0, 0],
    0.005,
    undefined,
    1.0,
    true,
    FINISH_MATTE_TRIM,
  );

  // Glossy Smoked Dark Windscreen / Meter Cowling Dome proud atop center nacelle (`3/4 & Front Views`)
  const meterVisorGeo = createLoftedXShellGeo(
    [
      { x: -0.076, y: 0.162, z: -0.018, ry: 0.022, rzFront: 0.022, rzBack: 0.020, rollRad: 0.42, power: 2.8 },
      { x: -0.044, y: 0.186, z: -0.018, ry: 0.036, rzFront: 0.028, rzBack: 0.026, rollRad: 0.44, power: 3.0 },
      { x: 0.0, y: 0.194, z: -0.016, ry: 0.042, rzFront: 0.032, rzBack: 0.028, rollRad: 0.45, power: 3.1 },
      { x: 0.044, y: 0.186, z: -0.018, ry: 0.036, rzFront: 0.028, rzBack: 0.026, rollRad: 0.44, power: 3.0 },
      { x: 0.076, y: 0.162, z: -0.018, ry: 0.022, rzFront: 0.022, rzBack: 0.020, rollRad: 0.42, power: 2.8 },
    ],
    22,
    3,
  );
  helper.addPart(
    steeringGroup,
    meterVisorGeo,
    '#232830',
    [0, 0, 0],
    [0, 0, 0],
    0.003,
    undefined,
    1.0,
    true,
    FINISH_SMOKED_VISOR,
  );

  // Rider-Facing Digital Cockpit Bezel + Speedometer LCD Screen
  helper.addPart(
    steeringGroup,
    createRoundedRectExtrudeGeo(0.148, 0.084, 0.022, 0.018, 0.004, 3),
    '#20252d',
    [0, 0.172, -0.056],
    [Math.PI / 2 - 0.50, 0, 0],
    0.002,
    undefined,
    1.0,
    false,
    FINISH_MATTE_TRIM,
  );
  addLuminousScooterPart(
    helper,
    steeringGroup,
    new THREE.PlaneGeometry(0.132, 0.068),
    '#ffffff',
    '#38bdf8',
    0.55,
    [0, 0.176, -0.068],
    [-0.50, Math.PI, 0],
    getElectricCockpitLcdTexture(),
  );

  // Swept Handlebars, Switchgear Pods, Contoured Grips (`±0.262, 0.132, -0.06`), Ball-End Brake Levers & Teardrop Mirrors
  const bikeGripGeo = createContouredErgonomicGripGeo(0.116, 0.0175);
  for (const side of [-1, 1]) {
    helper.addPart(
      steeringGroup,
      new THREE.CylinderGeometry(0.013, 0.014, 0.16, 16),
      '#58606d',
      [side * 0.175, 0.132, -0.036],
      [0, -side * 0.18, Math.PI / 2],
      0.002,
      undefined,
      1.0,
      false,
      FINISH_SATIN_METAL,
    );
    helper.addPart(
      steeringGroup,
      createRoundedRectExtrudeGeo(0.042, 0.044, 0.038, 0.014, 0.005, 3),
      SCOOTER_DEEP_CHARCOAL_HEX,
      [side * 0.194, 0.114, -0.048],
      [0, -side * 0.18, 0],
      0.002,
      undefined,
      1.0,
      false,
      FINISH_MATTE_TRIM,
    );
    helper.addPart(
      steeringGroup,
      bikeGripGeo,
      '#ffffff',
      [side * 0.262, 0.132, -0.060],
      [0, side > 0 ? -0.18 : Math.PI + 0.18, 0],
      0.0025,
      getErgonomicGripTexture(),
      1.0,
      false,
      FINISH_RUBBER_TIRE,
    );
    helper.addPart(
      steeringGroup,
      new THREE.CylinderGeometry(0.0185, 0.0165, 0.014, 18),
      '#8b95a3',
      [side * 0.322, 0.132, -0.071],
      [0, -side * 0.18, Math.PI / 2],
      0.002,
      undefined,
      1.0,
      false,
      FINISH_SATIN_METAL,
    );

    // Sculpted Ball-End Cast-Alloy Brake Lever
    const leverCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.204, 0.128, -0.030),
      new THREE.Vector3(side * 0.255, 0.124, -0.012),
      new THREE.Vector3(side * 0.308, 0.118, -0.022),
    ]);
    helper.addPart(
      steeringGroup,
      createTubeSweepWithCapsGeo(leverCurve, 14, 0.006, 0.0042, 10, true),
      '#adb5c2',
      [0, 0, 0],
      [0, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_SATIN_METAL,
    );
    helper.addPart(
      steeringGroup,
      new THREE.SphereGeometry(0.0075, 12, 10),
      '#adb5c2',
      [side * 0.310, 0.118, -0.023],
      [0, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_SATIN_METAL,
    );

    // Rubber Mirror Stalk Boot + Swept Stalk + Sculpted Lofted Teardrop Wing Mirror (`70cm` total span)
    helper.addPart(
      steeringGroup,
      new THREE.CylinderGeometry(0.011, 0.013, 0.024, 14),
      '#242830',
      [side * 0.184, 0.156, -0.038],
      [0, 0, -side * 0.35],
      0,
      undefined,
      1.0,
      false,
      FINISH_RUBBER_TIRE,
    );
    const stalkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.185, 0.160, -0.038),
      new THREE.Vector3(side * 0.255, 0.255, -0.044),
      new THREE.Vector3(side * 0.308, 0.305, -0.050),
    ]);
    helper.addPart(
      steeringGroup,
      createTubeSweepWithCapsGeo(stalkCurve, 16, 0.0072, 0.0068, 12, false),
      '#464e5a',
      [0, 0, 0],
      [0, 0, 0],
      0.002,
      undefined,
      1.0,
      false,
      FINISH_SATIN_METAL,
    );

    const mirrorPodGrp = new THREE.Group();
    mirrorPodGrp.position.set(side * 0.336, 0.316, -0.052);
    mirrorPodGrp.rotation.set(0, -side * 0.20, side * 0.16);
    steeringGroup.add(mirrorPodGrp);

    // Aerodynamic lofted teardrop housing (`narrow inner stem -> broad sculpted outer tip`)
    const mirrorHousingGeo = createLoftedXShellGeo(
      [
        { x: -side * 0.046, y: -0.006, z: 0.002, ry: 0.018, rzFront: 0.014, rzBack: 0.010, power: 2.4 },
        { x: -side * 0.012, y: 0.004, z: 0.006, ry: 0.030, rzFront: 0.020, rzBack: 0.014, power: 2.8 },
        { x: side * 0.028, y: 0.008, z: 0.002, ry: 0.032, rzFront: 0.018, rzBack: 0.012, power: 2.8 },
        { x: side * 0.052, y: 0.002, z: -0.002, ry: 0.022, rzFront: 0.012, rzBack: 0.009, power: 2.4 },
      ],
      18,
      2,
    );
    helper.addPart(
      mirrorPodGrp,
      mirrorHousingGeo,
      '#414854',
      [0, 0, 0],
      [0, 0, 0],
      0.0025,
      undefined,
      1.0,
      false,
      FINISH_DARK_ALLOY,
    );
    const mirrorGlassGeo = new THREE.CircleGeometry(0.042, 20);
    mirrorGlassGeo.scale(1.08, 0.60, 1.0);
    helper.addPart(
      mirrorPodGrp,
      mirrorGlassGeo,
      '#9cc7dc',
      [side * 0.006, 0.002, -0.012],
      [0, Math.PI, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_OPTICAL_LENS,
    );
  }

  // 7) Connected Tubular U-Brace Center Kickstand (`z = -0.18, y = 0.165`)
  const kickstandGroup = new THREE.Group();
  kickstandGroup.name = 'ElectricScooterCenterKickstand';
  kickstandGroup.position.set(
    ELECTRIC_SCOOTER_BIKE_SPEC.centerKickstandPivot.x,
    ELECTRIC_SCOOTER_BIKE_SPEC.centerKickstandPivot.y,
    ELECTRIC_SCOOTER_BIKE_SPEC.centerKickstandPivot.z,
  );
  chassisGroup.add(kickstandGroup);

  const standBraceCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.088, 0.0, 0.0),
    new THREE.Vector3(-0.102, -0.085, -0.026),
    new THREE.Vector3(-0.112, -0.158, -0.048),
    new THREE.Vector3(0.0, -0.158, -0.048),
    new THREE.Vector3(0.112, -0.158, -0.048),
    new THREE.Vector3(0.102, -0.085, -0.026),
    new THREE.Vector3(0.088, 0.0, 0.0),
  ]);
  helper.addPart(
    kickstandGroup,
    createTubeSweepWithCapsGeo(standBraceCurve, 28, 0.010, 0.010, 12, false),
    '#2b3038',
    [0, 0, 0],
    [0, 0, 0],
    0.0025,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );
  for (const side of [-1, 1]) {
    helper.addPart(
      kickstandGroup,
      createRoundedRectExtrudeGeo(0.032, 0.046, 0.010, 0.012, 0.002, 3),
      '#1f242b',
      [side * 0.112, -0.162, -0.048],
      [0, 0, 0],
      0.0015,
      undefined,
      1.0,
      false,
      FINISH_RUBBER_TIRE,
    );
  }
  helper.addPart(
    kickstandGroup,
    new THREE.CylinderGeometry(0.0085, 0.0085, 0.186, 12),
    '#343a44',
    [0, -0.085, -0.026],
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
  const frameHex = options.bodyColorHex ?? '#eef1f5';
  const frameTex = options.bodyColorHex ? undefined : getBrushedAluminumTexture();
  const accentHex = options.accentColorHex ?? SCOOTER_REF_CYAN_HEX;
  const trimCharcoal = SCOOTER_CHARCOAL_HEX;
  const deepCharcoal = SCOOTER_DEEP_CHARCOAL_HEX;
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
    SCOOTER_SILVER_TRIM_HEX,
    '#343b46',
    'micro_hub',
  );
  rearWheelGroup.name = 'PushScooterRearWheel';
  rearWheelGroup.position.set(0, 0.10, -0.36);
  deckGroup.add(rearWheelGroup);

  // Sculpted Brushed-Aluminum Rear Dropout Arms + Flush Recessed Cyan Pinstripe Slots
  for (const side of [-1, 1]) {
    const dropoutGeo = createLoftedBodyShellGeo(
      [
        { y: 0.100, z: -0.376, rx: 0.0085, ryTop: 0.015, ryBot: 0.015, offsetX: side * 0.044, power: 2.8 },
        { y: 0.100, z: -0.315, rx: 0.010, ryTop: 0.018, ryBot: 0.017, offsetX: side * 0.048, power: 2.8 },
        { y: 0.097, z: -0.220, rx: 0.0115, ryTop: 0.020, ryBot: 0.018, offsetX: side * 0.056, power: 2.8 },
        { y: 0.096, z: -0.175, rx: 0.013, ryTop: 0.020, ryBot: 0.018, offsetX: side * 0.062, power: 2.8 },
      ],
      22,
      'side',
      3,
      'dome',
    );
    helper.addPart(
      deckGroup,
      dropoutGeo,
      frameHex,
      [0, 0, 0],
      [0, 0, 0],
      0.003,
      frameTex,
      1.0,
      true,
      FINISH_SATIN_METAL,
    );
    // Silver axle acorn cap nut on rear dropout tip
    helper.addPart(
      deckGroup,
      new THREE.CylinderGeometry(0.009, 0.009, 0.008, 16),
      SCOOTER_SILVER_TRIM_HEX,
      [side * 0.052, 0.100, -0.360],
      [0, 0, Math.PI / 2],
      0,
      undefined,
      1.0,
      false,
      FINISH_SATIN_METAL,
    );
    // Thin flush cyan slot pinstripe along dropout arm (tapered capsule ends)
    const dropoutStripeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.0565, 0.099, -0.320),
      new THREE.Vector3(side * 0.0605, 0.098, -0.255),
      new THREE.Vector3(side * 0.0640, 0.097, -0.215),
    ]);
    helper.addPart(
      deckGroup,
      createTubeSweepWithCapsGeo(dropoutStripeCurve, 14, 0.0020, 0.0028, 10, true),
      accentHex,
      [0, 0, 0],
      [0, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_GLOSS_BODY,
    );
  }

  // 2) Low-Clearance Stadium Brushed-Aluminum Deck (`~8cm` clearance) & Textured Diamond Grip Pad
  helper.addPart(
    deckGroup,
    createRoundedRectExtrudeGeo(
      PUSH_KICK_SCOOTER_SPEC.deckWidthM,
      PUSH_KICK_SCOOTER_SPEC.deckLengthM,
      0.028,
      0.075,
      0.0055,
      5,
    ),
    frameHex,
    [0, PUSH_KICK_SCOOTER_SPEC.deckClearanceM, -0.02],
    [0, 0, 0],
    0.004,
    frameTex,
    1.0,
    true,
    FINISH_SATIN_METAL,
  );
  // Dark chamfered deck upper tray border supporting the grip pad
  helper.addPart(
    deckGroup,
    createRoundedRectExtrudeGeo(0.146, 0.466, 0.0055, 0.068, 0.002, 4),
    deepCharcoal,
    [0, 0.108, -0.02],
    [0, 0, 0],
    0.002,
    undefined,
    1.0,
    false,
    FINISH_MATTE_TRIM,
  );
  // Flush Recessed Charcoal Side Channels & Slim Tapered Cyan Pinstripes along Deck Flanks
  for (const side of [-1, 1]) {
    const channelCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.0785, 0.096, -0.175),
      new THREE.Vector3(side * 0.0790, 0.096, -0.020),
      new THREE.Vector3(side * 0.0785, 0.096, 0.125),
    ]);
    helper.addPart(
      deckGroup,
      createTubeSweepWithCapsGeo(channelCurve, 18, 0.0032, 0.0062, 12, true),
      trimCharcoal,
      [0, 0, 0],
      [0, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_MATTE_TRIM,
    );
    const sideAccentCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.0805, 0.096, -0.145),
      new THREE.Vector3(side * 0.0810, 0.096, -0.020),
      new THREE.Vector3(side * 0.0805, 0.096, 0.095),
    ]);
    helper.addPart(
      deckGroup,
      createTubeSweepWithCapsGeo(sideAccentCurve, 18, 0.0020, 0.0026, 10, true),
      accentHex,
      [0, 0, 0],
      [0, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_GLOSS_BODY,
    );
  }
  // Top Textured Geometric Diamond High-Grip Footpad (`y = 0.112`)
  helper.addPart(
    deckGroup,
    createRoundedRectExtrudeGeo(0.132, 0.436, 0.0035, 0.062, 0.001, 4),
    '#ffffff',
    [0, 0.112, -0.02],
    [0, 0, 0],
    0.002,
    getKickGeometricGripDeckTexture(),
    0.85,
    false,
    FINISH_RUBBER_TIRE,
  );

  // 3) Contoured Satin-Charcoal Rear Fender Foot-Brake + Attached Tail Red Safety Reflector
  helper.addPart(
    deckGroup,
    createCurvedArcShellGeo({
      centerY: 0.10,
      centerZ: -0.36,
      phiStart: 0.48,
      phiEnd: -1.48,
      radius: 0.113,
      halfWidth: 0.036,
      thickness: 0.010,
      crownDrop: 0.011,
      arcSegs: 28,
      ringSegs: 18,
    }),
    trimCharcoal,
    [0, 0, 0],
    [0, 0, 0],
    0.003,
    undefined,
    1.0,
    true,
    FINISH_MATTE_TRIM,
  );
  // Fender Hinge Bridge joining rear deck tail (`z = -0.265`) solidly into fender front edge
  helper.addPart(
    deckGroup,
    createLoftedBodyShellGeo(
      [
        { y: 0.112, z: -0.308, rx: 0.032, ryTop: 0.008, ryBot: 0.012, power: 2.6 },
        { y: 0.103, z: -0.275, rx: 0.038, ryTop: 0.011, ryBot: 0.013, power: 2.6 },
        { y: 0.098, z: -0.242, rx: 0.044, ryTop: 0.012, ryBot: 0.014, power: 2.6 },
      ],
      18,
      'wrap',
      2,
      'dome',
    ),
    deepCharcoal,
    [0, 0, 0],
    [0, 0, 0],
    0.002,
    undefined,
    1.0,
    false,
    FINISH_MATTE_TRIM,
  );
  // Molded Foot-Brake Tread Ridges on top crown of rear fender
  for (const phiRidge of [-0.12, -0.26, -0.40]) {
    const rOuter = 0.1185;
    helper.addPart(
      deckGroup,
      createRoundedRectExtrudeGeo(0.038, 0.007, 0.004, 0.003, 0.001, 2),
      '#1e232a',
      [0, 0.10 + rOuter * Math.cos(phiRidge), -0.36 + rOuter * Math.sin(phiRidge)],
      [phiRidge, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_RUBBER_TIRE,
    );
  }
  // Attached Flush Red Tail Reflector on Rear Fender Surface (`phi = -0.88`, zero floating!)
  const phiTail = -0.88;
  const rTail = 0.1185;
  const tailY = 0.10 + rTail * Math.cos(phiTail);
  const tailZ = -0.36 + rTail * Math.sin(phiTail);
  helper.addPart(
    deckGroup,
    createRoundedRectExtrudeGeo(0.030, 0.020, 0.006, 0.007, 0.0015, 3),
    deepCharcoal,
    [0, tailY, tailZ],
    [phiTail, 0, 0],
    0,
    undefined,
    1.0,
    false,
    FINISH_MATTE_TRIM,
  );
  addLuminousScooterPart(
    helper,
    deckGroup,
    createRoundedRectExtrudeGeo(0.024, 0.015, 0.005, 0.005, 0.0012, 3),
    pal.reflectorRed,
    '#ef4444',
    0.72,
    [0, tailY + 0.003 * Math.cos(phiTail), tailZ + 0.003 * Math.sin(phiTail)],
    [phiTail, 0, 0],
  );

  // 4) Sculpted Brushed-Aluminum Gooseneck & Folding Hinge Knuckle (`z = +0.16 .. +0.31`)
  const neckGussetGeo = createLoftedBodyShellGeo(
    [
      { y: 0.098, z: 0.155, rx: 0.036, ryTop: 0.018, ryBot: 0.016, pitchRad: -0.78, power: 2.8 },
      { y: 0.156, z: 0.220, rx: 0.030, ryTop: 0.021, ryBot: 0.019, pitchRad: -0.72, power: 2.8 },
      { y: 0.214, z: 0.278, rx: 0.026, ryTop: 0.022, ryBot: 0.020, pitchRad: -0.66, power: 2.8 },
      { y: 0.248, z: 0.305, rx: 0.025, ryTop: 0.020, ryBot: 0.018, pitchRad: -0.58, power: 2.8 },
    ],
    24,
    'side',
    3,
    'dome',
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
  // Machined Charcoal Folding Hinge Knuckle Cylinder + Side Detent Lock Latch
  helper.addPart(
    deckGroup,
    new THREE.CylinderGeometry(0.024, 0.024, 0.062, 22),
    trimCharcoal,
    [0, 0.214, 0.285],
    [0, 0, Math.PI / 2],
    0.003,
    undefined,
    1.0,
    true,
    FINISH_DARK_ALLOY,
  );
  for (const side of [-1, 1]) {
    helper.addPart(
      deckGroup,
      new THREE.CylinderGeometry(0.011, 0.011, 0.006, 16),
      SCOOTER_SILVER_TRIM_HEX,
      [side * 0.032, 0.214, 0.285],
      [0, 0, Math.PI / 2],
      0,
      undefined,
      1.0,
      false,
      FINISH_SATIN_METAL,
    );
  }
  // Compact Contoured Folding Safety Lock Latch on Left Side
  helper.addPart(
    deckGroup,
    createRoundedRectExtrudeGeo(0.011, 0.042, 0.016, 0.0045, 0.002, 3),
    deepCharcoal,
    [0.032, 0.222, 0.278],
    [0.52, 0, -Math.PI / 2],
    0,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );
  helper.addPart(
    deckGroup,
    createRoundedRectExtrudeGeo(0.006, 0.016, 0.005, 0.0025, 0.001, 2),
    accentHex,
    [0.036, 0.236, 0.272],
    [0.52, 0, -Math.PI / 2],
    0,
    undefined,
    1.0,
    false,
    FINISH_GLOSS_BODY,
  );

  // 5) Headtube Collar, Continuous Ribbed Elastomer Suspension Boot, Fork Blades & Front 200mm Wheel
  const steeringGroup = new THREE.Group();
  steeringGroup.name = 'PushScooterSteeringGroup';
  steeringGroup.position.set(
    PUSH_KICK_SCOOTER_SPEC.steeringPivot.x,
    PUSH_KICK_SCOOTER_SPEC.steeringPivot.y,
    PUSH_KICK_SCOOTER_SPEC.steeringPivot.z,
  );
  deckGroup.add(steeringGroup);

  // Brushed-Aluminum Upper Headtube Collar (clears 200mm front wheel cleanly above `y_local = 0.02`)
  helper.addPart(
    steeringGroup,
    new THREE.CylinderGeometry(0.0255, 0.0275, 0.078, 24),
    frameHex,
    [0, 0.052, -0.011],
    [PUSH_KICK_SCOOTER_SPEC.stemRakeRad, 0, 0],
    0.003,
    frameTex,
    1.0,
    true,
    FINISH_SATIN_METAL,
  );
  // Lower Headset Bearing Ring (dark alloy transition to suspension bellows)
  helper.addPart(
    steeringGroup,
    new THREE.CylinderGeometry(0.0285, 0.0275, 0.014, 24),
    deepCharcoal,
    [0, 0.015, -0.004],
    [PUSH_KICK_SCOOTER_SPEC.stemRakeRad, 0, 0],
    0,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );
  // Subtle Front Vertical Cyan-Framed Badge Flush on Headtube
  helper.addPart(
    steeringGroup,
    createRoundedRectExtrudeGeo(0.014, 0.044, 0.006, 0.006, 0.0015, 3),
    accentHex,
    [0, 0.052, 0.014],
    [Math.PI / 2 + PUSH_KICK_SCOOTER_SPEC.stemRakeRad, 0, 0],
    0,
    undefined,
    1.0,
    false,
    FINISH_GLOSS_BODY,
  );
  addLuminousScooterPart(
    helper,
    steeringGroup,
    createRoundedRectExtrudeGeo(0.0085, 0.032, 0.004, 0.004, 0.001, 2),
    '#edf9fb',
    '#b8f2ee',
    0.45,
    [0, 0.052, 0.0165],
    [Math.PI / 2 + PUSH_KICK_SCOOTER_SPEC.stemRakeRad, 0, 0],
  );

  // Continuous Molded Accordion Ribbed Elastomer Suspension Dust Boot (`LatheGeometry`, zero floating gaps)
  const bootProfile: THREE.Vector2[] = [];
  const bootSteps = 44;
  for (let i = 0; i <= bootSteps; i++) {
    const t = i / bootSteps;
    const yLathe = -0.024 + t * 0.048;
    const ribWave = Math.sin(t * Math.PI * 10);
    const rBase = 0.0205 - t * 0.0015;
    const r = Math.max(0.0155, rBase + Math.max(0, ribWave) * 0.0038 - Math.max(0, -ribWave) * 0.0022);
    bootProfile.push(new THREE.Vector2(r, yLathe));
  }
  const bootGeo = new THREE.LatheGeometry(bootProfile, 24);
  helper.addPart(
    steeringGroup,
    bootGeo,
    '#20252d',
    [0, -0.006, 0.002],
    [PUSH_KICK_SCOOTER_SPEC.stemRakeRad, 0, 0],
    0,
    undefined,
    1.0,
    false,
    FINISH_RUBBER_TIRE,
  );

  // Sculpted Fork Crown Bridge above front tire (`y_local = -0.025`, clears 200mm wheel cleanly!)
  helper.addPart(
    steeringGroup,
    createRoundedRectExtrudeGeo(0.078, 0.044, 0.022, 0.016, 0.005, 4),
    frameHex,
    [0, -0.026, 0.012],
    [PUSH_KICK_SCOOTER_SPEC.stemRakeRad, 0, 0],
    0.003,
    frameTex,
    1.0,
    true,
    FINISH_SATIN_METAL,
  );

  // Sculpted Brushed-Aluminum Front Fork Blades straddling the 200mm PU Wheel (`x = ±0.034`)
  for (const side of [-1, 1]) {
    const forkBladeGeo = createLoftedBodyShellGeo(
      [
        { y: -0.024, z: 0.015, rx: 0.009, ryTop: 0.018, ryBot: 0.018, pitchRad: 1.32, power: 2.8 },
        { y: -0.082, z: 0.030, rx: 0.0085, ryTop: 0.015, ryBot: 0.015, pitchRad: 1.32, power: 2.8 },
        { y: -0.140, z: 0.045, rx: 0.009, ryTop: 0.013, ryBot: 0.013, pitchRad: 1.32, power: 2.8 },
      ],
      20,
      'side',
      3,
      'dome',
    );
    helper.addPart(
      steeringGroup,
      forkBladeGeo,
      frameHex,
      [side * 0.034, 0, 0],
      [0, 0, 0],
      0.003,
      frameTex,
      1.0,
      true,
      FINISH_SATIN_METAL,
    );
    // Silver axle acorn cap nut
    helper.addPart(
      steeringGroup,
      new THREE.CylinderGeometry(0.0085, 0.0085, 0.007, 16),
      SCOOTER_SILVER_TRIM_HEX,
      [side * 0.041, -0.140, 0.045],
      [0, 0, Math.PI / 2],
      0,
      undefined,
      1.0,
      false,
      FINISH_SATIN_METAL,
    );
    // Flush cyan pinstripe inlay on lower fork blade
    const forkStripeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.0415, -0.056, 0.023),
      new THREE.Vector3(side * 0.0415, -0.118, 0.039),
    ]);
    helper.addPart(
      steeringGroup,
      createTubeSweepWithCapsGeo(forkStripeCurve, 12, 0.0018, 0.0024, 10, true),
      accentHex,
      [0, 0, 0],
      [0, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_GLOSS_BODY,
    );
    // Amber Oval Mini Side Reflector on Outer Lower Fork (`Mini front reflector` in Front Elevation)
    addLuminousScooterPart(
      helper,
      steeringGroup,
      createRoundedRectExtrudeGeo(0.004, 0.017, 0.009, 0.004, 0.001, 3),
      '#f59e0b',
      '#d97706',
      0.45,
      [side * 0.0415, -0.092, 0.045],
      [0, 0, -side * Math.PI / 2],
    );
  }

  // Contoured Satin-Charcoal Front Mini Hugger Mudguard (`createCurvedArcShellGeo`)
  helper.addPart(
    steeringGroup,
    createCurvedArcShellGeo({
      centerY: -0.140,
      centerZ: 0.045,
      phiStart: 0.05,
      phiEnd: -1.18,
      radius: 0.111,
      halfWidth: 0.025,
      thickness: 0.008,
      crownDrop: 0.009,
      arcSegs: 22,
      ringSegs: 16,
    }),
    trimCharcoal,
    [0, 0, 0],
    [0, 0, 0],
    0.002,
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
    SCOOTER_SILVER_TRIM_HEX,
    '#343b46',
    'none',
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
    new THREE.CylinderGeometry(0.0215, 0.0235, 0.435, 22),
    trimCharcoal,
    [0, 0.217, 0],
    [0, 0, 0],
    0.003,
    undefined,
    1.0,
    true,
    FINISH_DARK_ALLOY,
  );
  // Compact Quick-Release Height-Adjustment Collar + Contoured Side Cam Lever (`y = 0.435m`)
  helper.addPart(
    foldingNeckGroup,
    new THREE.CylinderGeometry(0.0265, 0.0265, 0.040, 22),
    deepCharcoal,
    [0, 0.435, 0],
    [0, 0, 0],
    0.002,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );
  // Thin silver compression ring grooves on collar
  for (const dyRing of [-0.016, 0.016]) {
    helper.addPart(
      foldingNeckGroup,
      new THREE.CylinderGeometry(0.0272, 0.0272, 0.004, 22),
      SCOOTER_SILVER_TRIM_HEX,
      [0, 0.435 + dyRing, 0],
      [0, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_SATIN_METAL,
    );
  }
  helper.addPart(
    foldingNeckGroup,
    createRoundedRectExtrudeGeo(0.010, 0.032, 0.014, 0.004, 0.002, 3),
    deepCharcoal,
    [0.026, 0.435, -0.004],
    [0, 0, Math.PI / 2],
    0,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );
  helper.addPart(
    foldingNeckGroup,
    createRoundedRectExtrudeGeo(0.005, 0.016, 0.005, 0.002, 0.001, 2),
    accentHex,
    [0.030, 0.435, -0.008],
    [0, 0, Math.PI / 2],
    0,
    undefined,
    1.0,
    false,
    FINISH_GLOSS_BODY,
  );
  // Telescoping Satin-Charcoal Upper Shaft (`0.45 .. 0.70m` along stem -> `~98cm` T-bar height)
  helper.addPart(
    foldingNeckGroup,
    new THREE.CylinderGeometry(0.0185, 0.0195, 0.27, 22),
    '#434b59',
    [0, 0.575, 0],
    [0, 0, 0],
    0.003,
    undefined,
    1.0,
    true,
    FINISH_DARK_ALLOY,
  );

  // Forged Rounded T-Bar Stem Clamp (`y = 0.692m` along stem)
  helper.addPart(
    foldingNeckGroup,
    createRoundedRectExtrudeGeo(0.068, 0.050, 0.044, 0.018, 0.005, 4),
    trimCharcoal,
    [0, 0.690, 0],
    [0, 0, 0],
    0.003,
    undefined,
    1.0,
    true,
    FINISH_DARK_ALLOY,
  );
  helper.addPart(
    foldingNeckGroup,
    new THREE.CylinderGeometry(0.009, 0.009, 0.006, 16),
    SCOOTER_SILVER_TRIM_HEX,
    [0, 0.736, 0],
    [0, 0, 0],
    0,
    undefined,
    1.0,
    false,
    FINISH_SATIN_METAL,
  );
  // Horizontal Brushed-Aluminum T-Bar (`48cm` total width)
  helper.addPart(
    foldingNeckGroup,
    new THREE.CylinderGeometry(0.0135, 0.0135, PUSH_KICK_SCOOTER_SPEC.tBarWidthM, 20),
    frameHex,
    [0, 0.712, 0],
    [0, 0, Math.PI / 2],
    0.003,
    frameTex,
    1.0,
    true,
    FINISH_SATIN_METAL,
  );
  // Smooth Contoured Ergonomic Rubber Grips (LatheGeometry centered at `(±0.18, 0.712, 0)`)
  for (const side of [-1, 1]) {
    helper.addPart(
      foldingNeckGroup,
      createContouredErgonomicGripGeo(0.128, 0.018),
      '#ffffff',
      [side * 0.180, 0.712, 0],
      [0, 0, side < 0 ? Math.PI : 0],
      0.002,
      getErgonomicGripTexture(),
      1.0,
      false,
      FINISH_RUBBER_TIRE,
    );
    // Machined Dark Alloy Bar-End Plug + Silver Collar Ring
    const endPlug = new THREE.SphereGeometry(0.019, 16, 12);
    endPlug.scale(0.55, 1.0, 1.0);
    helper.addPart(
      foldingNeckGroup,
      endPlug,
      '#1b2028',
      [side * 0.244, 0.712, 0],
      [0, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_DARK_ALLOY,
    );
    helper.addPart(
      foldingNeckGroup,
      new THREE.CylinderGeometry(0.0165, 0.0165, 0.010, 18),
      SCOOTER_SILVER_TRIM_HEX,
      [side * 0.114, 0.712, 0],
      [0, 0, Math.PI / 2],
      0,
      undefined,
      1.0,
      false,
      FINISH_SATIN_METAL,
    );
  }
  // Curved Alloy Hand-Brake Perch, Swept Lever with Ball-End, Guide Clips & Bowden Cable
  helper.addPart(
    foldingNeckGroup,
    new THREE.CylinderGeometry(0.017, 0.017, 0.018, 16),
    deepCharcoal,
    [0.098, 0.712, 0],
    [0, 0, Math.PI / 2],
    0,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );
  const kickLeverCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.098, 0.708, -0.012),
    new THREE.Vector3(0.122, 0.704, -0.028),
    new THREE.Vector3(0.158, 0.701, -0.032),
    new THREE.Vector3(0.194, 0.700, -0.024),
  ]);
  helper.addPart(
    foldingNeckGroup,
    createTubeSweepWithCapsGeo(kickLeverCurve, 18, 0.0046, 0.0066, 12, true),
    SCOOTER_SILVER_TRIM_HEX,
    [0, 0, 0],
    [0, 0, 0],
    0,
    undefined,
    1.0,
    false,
    FINISH_SATIN_METAL,
  );
  helper.addPart(
    foldingNeckGroup,
    new THREE.SphereGeometry(0.0072, 12, 10),
    SCOOTER_SILVER_TRIM_HEX,
    [0.195, 0.700, -0.024],
    [0, 0, 0],
    0,
    undefined,
    1.0,
    false,
    FINISH_SATIN_METAL,
  );
  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.102, 0.702, -0.016),
    new THREE.Vector3(0.056, 0.635, 0.024),
    new THREE.Vector3(0.022, 0.505, 0.026),
    new THREE.Vector3(0.016, 0.320, 0.024),
    new THREE.Vector3(0.012, 0.160, 0.024),
  ]);
  helper.addPart(
    foldingNeckGroup,
    createTubeSweepWithCapsGeo(cableCurve, 24, 0.0034, 0.0034, 10, false),
    '#1b2028',
    [0, 0, 0],
    [0, 0, 0],
    0,
    undefined,
    1.0,
    false,
    FINISH_MATTE_TRIM,
  );
  for (const clipY of [0.32, 0.52]) {
    const clipRing = new THREE.TorusGeometry(0.0235, 0.0028, 8, 18);
    clipRing.rotateX(Math.PI / 2);
    helper.addPart(
      foldingNeckGroup,
      clipRing,
      '#1e242d',
      [0, clipY, 0],
      [0, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_DARK_ALLOY,
    );
  }

  // Woven Flat-Ribbon Carrying Strap attached directly around folded mast collars (`Quadrant 3`)
  const carryingStrapGroup = new THREE.Group();
  carryingStrapGroup.name = 'PushScooterCarryingStrap';
  deckGroup.add(carryingStrapGroup);
  const strapCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.292, 0.185),
    new THREE.Vector3(0.016, 0.228, 0.055),
    new THREE.Vector3(0.020, 0.205, -0.095),
    new THREE.Vector3(0.014, 0.242, -0.235),
    new THREE.Vector3(0, 0.324, -0.325),
  ]);
  helper.addPart(
    carryingStrapGroup,
    createTubeSweepWithCapsGeo(strapCurve, 26, 0.011, 0.0032, 12, false),
    '#222730',
    [0, 0, 0],
    [0, 0, 0],
    0.002,
    undefined,
    1.0,
    false,
    FINISH_RUBBER_TIRE,
  );
  for (const [bz, by] of [
    [0.185, 0.292],
    [-0.325, 0.324],
  ] as const) {
    const strapBand = new THREE.TorusGeometry(0.024, 0.005, 8, 18);
    helper.addPart(
      carryingStrapGroup,
      strapBand,
      deepCharcoal,
      [0, by, bz],
      [0, 0, 0],
      0,
      undefined,
      1.0,
      false,
      FINISH_DARK_ALLOY,
    );
  }

  // 7) Connected Retractable Side Kickstand (`x = +0.068, y = 0.084, z = -0.05`)
  const kickstandGroup = new THREE.Group();
  kickstandGroup.name = 'PushScooterSideKickstand';
  kickstandGroup.position.set(
    PUSH_KICK_SCOOTER_SPEC.sideKickstandPivot.x,
    PUSH_KICK_SCOOTER_SPEC.sideKickstandPivot.y,
    PUSH_KICK_SCOOTER_SPEC.sideKickstandPivot.z,
  );
  deckGroup.add(kickstandGroup);

  // Compact pivot lug mounted cleanly against deck underside
  helper.addPart(
    kickstandGroup,
    createRoundedRectExtrudeGeo(0.018, 0.024, 0.016, 0.006, 0.002, 3),
    deepCharcoal,
    [0, 0, 0],
    [0, 0, Math.PI / 2],
    0,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );
  // Swept tubular kickstand leg running directly from pivot `(0,0,0)` into rubber footpad `(0.042, -0.079, -0.032)`
  const kickLegCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.002, 0.0, 0.0),
    new THREE.Vector3(0.022, -0.038, -0.016),
    new THREE.Vector3(0.042, -0.079, -0.032),
  ]);
  helper.addPart(
    kickstandGroup,
    createTubeSweepWithCapsGeo(kickLegCurve, 14, 0.0055, 0.0055, 12, false),
    trimCharcoal,
    [0, 0, 0],
    [0, 0, 0],
    0,
    undefined,
    1.0,
    false,
    FINISH_DARK_ALLOY,
  );
  helper.addPart(
    kickstandGroup,
    createRoundedRectExtrudeGeo(0.022, 0.028, 0.007, 0.010, 0.002, 4),
    '#1c2028',
    [0.042, -0.0805, -0.032],
    [0, 0, 0],
    0,
    undefined,
    1.0,
    false,
    FINISH_RUBBER_TIRE,
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
    const spareWheel = buildSpokeWheelAssembly(partHelper, 0.19, 0.045, 5, '#1e2229', '#475569', '#94a3b8', 'full_front');
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
