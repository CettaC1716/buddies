import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export interface CoastalBeachfrontBuildOptions<TWind> {
  parentGroup: THREE.Group;
  roadsGroup: THREE.Group;
  windUniforms: TWind;
  isSoftwareGl: boolean;
  lobbyConcreteTex: THREE.Texture;
  lobbyLouverTex: THREE.Texture;
  createBlitzStrokeMesh: (
    sourceGeometry: THREE.BufferGeometry,
    strokeWidth?: number,
    strokeColorHex?: string,
  ) => THREE.Mesh | null;
  upgradeMeshToBlitzWorldMaterial: (
    mesh: THREE.Mesh,
    windUniforms: TWind,
    tintHex?: string,
    bounceStrength?: number,
  ) => void;
}

export interface CoastalBeachfrontBuildHandle {
  seBeachGroup: THREE.Group;
  beachPergolaGrp: THREE.Group;
  showerStationGrp: THREE.Group;
  juiceKioskGrp: THREE.Group;
  boardwalkY: number;
  coastalTimberTex: THREE.Texture;
  addBeachPart: (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    colorHex: string,
    pos: [number, number, number],
    rot?: [number, number, number],
    strokeW?: number,
    mapTex?: THREE.Texture,
  ) => THREE.Mesh;
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

function finalizeCoastalTex(
  canvas: HTMLCanvasElement,
  wrapS: THREE.Wrapping = THREE.RepeatWrapping,
  wrapT: THREE.Wrapping = THREE.RepeatWrapping,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = wrapS;
  tex.wrapT = wrapT;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Continuous Mid-Res Teak / Driftwood Timber Planks (1024x512):
 * Layered harmonic wood-grain fibers, warm chamfer bevel highlights along every board edge,
 * organic knots, staggered butt joints, and subtle countersunk bronze fasteners.
 */
function createCoastalTimberPlankTexture(): THREE.Texture {
  const { canvas, ctx } = makeCanvas2d(1024, 512);
  if (!canvas || !ctx) return makeFallbackDataTex(206, 170, 124);

  ctx.fillStyle = '#d8ba92';
  ctx.fillRect(0, 0, 1024, 512);
  const plankRows = 10;
  const rowH = 512 / plankRows;
  const tones = ['#e0c49d', '#d3b287', '#e3caa6', '#cea97d', '#dabf98'];

  for (let r = 0; r < plankRows; r++) {
    const y0 = r * rowH;
    const midY = y0 + rowH * 0.5;
    const base = tones[r % tones.length];

    const grad = ctx.createLinearGradient(0, y0, 0, y0 + rowH);
    grad.addColorStop(0.0, '#ebd3af');
    grad.addColorStop(0.14, base);
    grad.addColorStop(0.84, base);
    grad.addColorStop(0.95, '#b69066');
    grad.addColorStop(1.0, '#937049');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0, 1024, rowH);

    // Continuous sweeping organic wood-grain splines across the entire 1024px plank
    for (let g = 0; g < 11; g++) {
      const freq = 0.011 + ((g + r) % 4) * 0.004;
      const amp = 2.2 + (g % 3) * 1.4;
      const phase = r * 1.7 + g * 0.9;
      const gy0 = y0 + 5 + (g / 11) * (rowH - 12);
      ctx.strokeStyle =
        g % 3 === 0 ? 'rgba(116, 80, 44, 0.16)' : 'rgba(246, 226, 194, 0.15)';
      ctx.lineWidth = g % 4 === 0 ? 1.8 : 1.0;
      ctx.beginPath();
      for (let x = 0; x <= 1024; x += 24) {
        const yy = gy0 + Math.sin(x * freq + phase) * amp;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // Subtle concentric oval wood knot per alternating course
    if (r % 2 === 1) {
      const kx = ((r * 263 + 180) % 760) + 120;
      const ky = midY + ((r % 3) - 1) * 7;
      for (let k = 3; k >= 1; k--) {
        ctx.strokeStyle = `rgba(110, 74, 40, ${0.14 + (4 - k) * 0.05})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(kx, ky, k * 14, k * 4.2, 0.06, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Fine bevel groove shadow line + staggered plank butt joint with bronze screw heads
    ctx.fillStyle = '#8b6844';
    ctx.fillRect(0, y0 + rowH - 2, 1024, 2);

    const buttX = ((r * 293 + 96) % 780) + 120;
    ctx.fillStyle = '#99754f';
    ctx.fillRect(buttX, y0 + 1, 2.5, rowH - 3);
    ctx.fillStyle = '#755635';
    for (const sx of [buttX - 8, buttX + 7]) {
      for (const sy of [y0 + 10, y0 + rowH - 13]) {
        ctx.beginPath();
        ctx.arc(sx, sy, 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  return finalizeCoastalTex(canvas);
}

/**
 * Continuous Mid-Res Coastal Painted Cedar Weatherboard (512x512).
 */
function createCoastalWeatherboardTexture(): THREE.Texture {
  const { canvas, ctx } = makeCanvas2d(512, 512);
  if (!canvas || !ctx) return makeFallbackDataTex(244, 237, 224);

  ctx.fillStyle = '#f5eee2';
  ctx.fillRect(0, 0, 512, 512);
  const lapCount = 10;
  const lapH = 512 / lapCount;
  for (let i = 0; i < lapCount; i++) {
    const y = i * lapH;
    const grad = ctx.createLinearGradient(0, y, 0, y + lapH);
    grad.addColorStop(0.0, '#fbf6ec');
    grad.addColorStop(0.72, '#efe6d6');
    grad.addColorStop(0.92, '#c8baa3');
    grad.addColorStop(1.0, '#a3947e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, 512, lapH);

    // Subtle continuous brushed woodgrain undertone under cream paint
    for (let g = 0; g < 6; g++) {
      ctx.strokeStyle = 'rgba(155, 138, 114, 0.12)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      const gy = y + 8 + g * ((lapH - 14) / 6);
      for (let x = 0; x <= 512; x += 32) {
        const yy = gy + Math.sin(x * 0.025 + i + g) * 1.4;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.fillStyle = '#9b8d78';
    ctx.fillRect(0, y + lapH - 2.2, 512, 2.2);
  }
  return finalizeCoastalTex(canvas);
}

/**
 * Continuous Mid-Res Woven Coastal Awning Canvas (512x512).
 */
function createCoastalStripedAwningTexture(): THREE.Texture {
  const { canvas, ctx } = makeCanvas2d(512, 512);
  if (!canvas || !ctx) return makeFallbackDataTex(90, 167, 199);

  const stripes = 8;
  const sw = 512 / stripes;
  for (let i = 0; i < stripes; i++) {
    const isBlue = i % 2 === 0;
    const grad = ctx.createLinearGradient(i * sw, 0, (i + 1) * sw, 0);
    grad.addColorStop(0.0, isBlue ? '#4793b5' : '#efeadd');
    grad.addColorStop(0.5, isBlue ? '#5eaad0' : '#fbf8ef');
    grad.addColorStop(1.0, isBlue ? '#4793b5' : '#efeadd');
    ctx.fillStyle = grad;
    ctx.fillRect(i * sw, 0, sw, 512);

    // Double-stitched seam along stripe boundary
    ctx.strokeStyle = isBlue ? 'rgba(255,255,255,0.22)' : 'rgba(40,80,104,0.18)';
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(i * sw + 3, 0);
    ctx.lineTo(i * sw + 3, 512);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Continuous cross-woven linen canvas micro-threads
  for (let y = 0; y < 512; y += 6) {
    ctx.fillStyle = y % 12 === 0 ? 'rgba(255,255,255,0.09)' : 'rgba(20,40,60,0.05)';
    ctx.fillRect(0, y, 512, 1.5);
  }
  for (let x = 0; x < 512; x += 6) {
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(x, 0, 1.2, 512);
  }
  return finalizeCoastalTex(canvas);
}

/**
 * Continuous Mid-Res Warm Cream Sail Cloth Weave (512x512).
 */
function createCoastalSailClothTexture(): THREE.Texture {
  const { canvas, ctx } = makeCanvas2d(512, 512);
  if (!canvas || !ctx) return makeFallbackDataTex(250, 246, 236);

  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0.0, '#f3ecdd');
  grad.addColorStop(0.5, '#fcf8ef');
  grad.addColorStop(1.0, '#efe6d4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  for (let y = 0; y < 512; y += 5) {
    ctx.fillStyle = y % 10 === 0 ? 'rgba(182, 164, 134, 0.14)' : 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, y, 512, 1.2);
  }
  for (let x = 0; x < 512; x += 5) {
    ctx.fillStyle = x % 10 === 0 ? 'rgba(182, 164, 134, 0.11)' : 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, 0, 1.2, 512);
  }

  // Stitched reinforced sail edge hem border
  ctx.strokeStyle = '#d4c6ad';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 502, 502);
  ctx.strokeStyle = '#9c8b70';
  ctx.setLineDash([7, 5]);
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, 484, 484);
  ctx.setLineDash([]);
  return finalizeCoastalTex(canvas, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping);
}

/**
 * Continuous Mid-Res Rounded River Pebble Shower Floor Mosaic (512x512).
 */
function createShowerPebbleBasinTexture(): THREE.Texture {
  const { canvas, ctx } = makeCanvas2d(512, 512);
  if (!canvas || !ctx) return makeFallbackDataTex(150, 142, 130);

  ctx.fillStyle = '#878074';
  ctx.fillRect(0, 0, 512, 512);
  const stoneTones = [
    ['#ebe6dc', '#b4ac9d'],
    ['#d7d0c4', '#9a9284'],
    ['#c4bcb0', '#877f73'],
    ['#dfd9cd', '#a59e90'],
    ['#b3aba0', '#777066'],
  ];

  for (let py = 18; py < 494; py += 28) {
    for (let px = 18; px < 494; px += 32) {
      const h1 = (px * 37 + py * 73) & 255;
      const h2 = (px * 91 + py * 19) & 255;
      const cx = px + ((h1 % 11) - 5);
      const cy = py + ((h2 % 11) - 5);
      const rx = 10 + (h1 % 6);
      const ry = 8 + (h2 % 5);
      const rot = ((h1 ^ h2) % 9) * 0.35;
      const [lightC, darkC] = stoneTones[(px + py) % stoneTones.length];

      const g = ctx.createRadialGradient(cx - rx * 0.28, cy - ry * 0.28, 1.5, cx, cy, Math.max(rx, ry));
      g.addColorStop(0.0, '#faf7f0');
      g.addColorStop(0.35, lightC);
      g.addColorStop(1.0, darkC);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(72, 66, 58, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }

  // Brushed stainless perimeter channel grate frame
  ctx.strokeStyle = '#9ca6b0';
  ctx.lineWidth = 14;
  ctx.strokeRect(14, 14, 484, 484);
  ctx.strokeStyle = '#5c6670';
  ctx.lineWidth = 3;
  ctx.strokeRect(21, 21, 470, 470);
  return finalizeCoastalTex(canvas, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping);
}

/**
 * Continuous Warm Limestone / Travertine Stone Texture (512x512).
 */
function createCoastalTravertineTexture(): THREE.Texture {
  const { canvas, ctx } = makeCanvas2d(512, 512);
  if (!canvas || !ctx) return makeFallbackDataTex(212, 206, 194);

  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0.0, '#ddd6c9');
  grad.addColorStop(0.5, '#d2cbbd');
  grad.addColorStop(1.0, '#c6beb0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 420; i++) {
    const x = (i * 197 + 23) % 508;
    const y = (i * 313 + 41) % 508;
    const w = 4 + (i % 14);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(118,110,98,0.14)';
    ctx.fillRect(x, y, w, 2);
  }
  ctx.strokeStyle = 'rgba(130, 122, 110, 0.26)';
  ctx.lineWidth = 2;
  for (let s = 128; s < 512; s += 128) {
    ctx.beginPath();
    ctx.moveTo(0, s);
    ctx.lineTo(512, s);
    ctx.moveTo(s, 0);
    ctx.lineTo(s, 512);
    ctx.stroke();
  }
  return finalizeCoastalTex(canvas);
}

/**
 * Continuous Braided Hemp Nautical Rope Texture (256x256).
 */
function createCoastalHempRopeTexture(): THREE.Texture {
  const { canvas, ctx } = makeCanvas2d(256, 256);
  if (!canvas || !ctx) return makeFallbackDataTex(214, 190, 148);

  ctx.fillStyle = '#d6bd92';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = -256; i < 512; i += 24) {
    const grad = ctx.createLinearGradient(i, 0, i + 24, 24);
    grad.addColorStop(0.0, '#ead4ac');
    grad.addColorStop(0.55, '#cdb182');
    grad.addColorStop(1.0, '#9e8154');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 256, 256);
    ctx.stroke();
  }
  return finalizeCoastalTex(canvas);
}

/**
 * Crisp 512x640 Beachside Kiosk Chalkboard Menu Texture.
 */
function createKioskChalkboardTexture(): THREE.Texture {
  const { canvas, ctx } = makeCanvas2d(512, 640);
  if (!canvas || !ctx) return makeFallbackDataTex(34, 41, 43);

  const grad = ctx.createRadialGradient(256, 300, 40, 256, 320, 360);
  grad.addColorStop(0.0, '#2a3336');
  grad.addColorStop(1.0, '#1c2224');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 640);

  ctx.strokeStyle = '#a3784c';
  ctx.lineWidth = 26;
  ctx.strokeRect(13, 13, 486, 614);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, 432, 560);

  ctx.fillStyle = '#fef08a';
  ctx.font = '900 44px "Barlow", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FRESH COCONUT', 256, 116);

  ctx.fillStyle = '#7dd3fc';
  ctx.font = '800 34px "Barlow", sans-serif';
  ctx.fillText('& TROPICAL JUICE', 256, 168);

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(72, 196, 368, 4);

  ctx.textAlign = 'left';
  ctx.font = '700 30px "JetBrains Mono", monospace';
  const items: [string, string][] = [
    ['Young Coconut', '$4'],
    ['Mango Smoothie', '$5'],
    ['Pineapple Crush', '$5'],
    ['Watermelon Ice', '$4'],
    ['Citrus Breeze', '$4'],
    ['Island Detox', '$6'],
  ];
  items.forEach(([name, price], idx) => {
    const y = 260 + idx * 52;
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(name, 64, y);
    ctx.fillStyle = '#fde047';
    ctx.fillText(price, 392, y);
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = '#86efac';
  ctx.font = '800 28px "Barlow", sans-serif';
  ctx.fillText('100% ICE COLD & NATURAL', 256, 580);
  return finalizeCoastalTex(canvas, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping);
}

/**
 * Crisp 512x256 Surfboard Rentals Timber Signboard Texture.
 */
function createSurfRentalSignTexture(): THREE.Texture {
  const { canvas, ctx } = makeCanvas2d(512, 256);
  if (!canvas || !ctx) return makeFallbackDataTex(212, 176, 131);

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#dec096');
  grad.addColorStop(0.5, '#d4b083');
  grad.addColorStop(1.0, '#c69d6d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = '#a88154';
  ctx.fillRect(0, 84, 512, 5);
  ctx.fillRect(0, 168, 512, 5);
  ctx.strokeStyle = '#6e4e2e';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, 500, 244);
  ctx.fillStyle = '#1e293b';
  ctx.font = '900 52px "Barlow", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SURF RENTALS', 256, 108);
  ctx.fillStyle = '#0f4c5c';
  ctx.font = '800 42px "Barlow", sans-serif';
  ctx.fillText('WAX & LESSONS', 256, 192);
  return finalizeCoastalTex(canvas, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping);
}

/**
 * Rounded Box primitive (smooth continuous bevel edges across every timber plank, beam, step & deck).
 */
function makeRoundedBoxGeo(
  w: number,
  h: number,
  d: number,
  radius = Math.min(w, h, d) * 0.16,
  segments = 2,
): THREE.BufferGeometry {
  const r = Math.min(radius, w * 0.45, h * 0.45, d * 0.45);
  return new RoundedBoxGeometry(w, h, d, segments, Math.max(0.004, r));
}

/**
 * Smooth ExtrudeGeometry helper centered along depth axis (`[-depth/2 .. +depth/2]`).
 */
function makeBeveledExtrudeGeo(
  shape: THREE.Shape,
  depth: number,
  bevelSize = 0.012,
  bevelThickness = 0.012,
  bevelSegments = 2,
  curveSegments = 14,
): THREE.BufferGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    curveSegments,
    depth,
    bevelEnabled: bevelSize > 0,
    bevelSize,
    bevelThickness,
    bevelSegments,
  });
  geo.translate(0, 0, -depth * 0.5);
  geo.computeVertexNormals();
  return geo;
}

/**
 * True sloped triangular gable wall pediment with smooth beveled eaves edges.
 */
function makeGablePedimentGeo(width: number, peakH: number, thickness: number): THREE.BufferGeometry {
  const hw = width * 0.5;
  const s = new THREE.Shape();
  s.moveTo(-hw, 0);
  s.lineTo(hw, 0);
  s.lineTo(0, peakH);
  s.closePath();
  return makeBeveledExtrudeGeo(s, thickness, 0.012, 0.012, 2, 4);
}

/**
 * Smooth Lathe-turned circular top / disc with rounded bullnose outer edge (`r` is outer radius).
 */
function makeBullnoseDiscGeo(
  radius: number,
  height: number,
  segs = 24,
  edgeR = Math.min(height * 0.42, 0.025),
): THREE.BufferGeometry {
  const hh = height * 0.5;
  const innerR = Math.max(0.01, radius - edgeR);
  const pts = [
    new THREE.Vector2(0, -hh),
    new THREE.Vector2(innerR, -hh),
    new THREE.Vector2(radius - edgeR * 0.25, -hh + edgeR * 0.3),
    new THREE.Vector2(radius, 0),
    new THREE.Vector2(radius - edgeR * 0.25, hh - edgeR * 0.3),
    new THREE.Vector2(innerR, hh),
    new THREE.Vector2(0, hh),
  ];
  const geo = new THREE.LatheGeometry(pts, segs);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Smooth curved coastal planter urn with flared tapered body & rolled rounded rim (`LatheGeometry`).
 */
function makeCoastalUrnPotGeo(
  rBot: number,
  rTop: number,
  h: number,
  segs = 20,
): THREE.BufferGeometry {
  const hh = h * 0.5;
  const pts = [
    new THREE.Vector2(0, -hh),
    new THREE.Vector2(rBot, -hh),
    new THREE.Vector2(THREE.MathUtils.lerp(rBot, rTop, 0.52) * 1.06, -hh * 0.05),
    new THREE.Vector2(rTop, hh * 0.78),
    new THREE.Vector2(rTop * 1.11, hh * 0.86),
    new THREE.Vector2(rTop * 1.12, hh * 0.96),
    new THREE.Vector2(rTop * 0.96, hh),
    new THREE.Vector2(rTop * 0.86, hh * 0.88),
    new THREE.Vector2(0, hh * 0.85),
  ];
  const geo = new THREE.LatheGeometry(pts, segs);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Smooth woven coastal straw sun-hat (`LatheGeometry`): pinched dome crown + wavy floppy brim.
 */
function makeStrawSunHatGeo(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.0, 0.16),
    new THREE.Vector2(0.09, 0.155),
    new THREE.Vector2(0.16, 0.12),
    new THREE.Vector2(0.19, 0.04),
    new THREE.Vector2(0.21, -0.02),
    new THREE.Vector2(0.31, -0.045),
    new THREE.Vector2(0.39, -0.03),
    new THREE.Vector2(0.41, -0.04),
    new THREE.Vector2(0.38, -0.055),
    new THREE.Vector2(0.20, -0.035),
    new THREE.Vector2(0.17, 0.04),
    new THREE.Vector2(0.0, 0.13),
  ];
  const geo = new THREE.LatheGeometry(pts, 24);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Continuous lofted curved billowing pergola sail cloth (zero segmented box seam gaps).
 */
function makeContinuousCatenarySailGeo(
  width: number,
  depth: number,
  maxSag: number,
  thickness = 0.028,
  segU = 18,
  segV = 6,
): THREE.BufferGeometry {
  const hw = width * 0.5;
  const hd = depth * 0.5;
  const halfT = thickness * 0.5;
  const cols = segU + 1;
  const rows = segV + 1;

  const evalSurfY = (u: number, v: number) => {
    const primary = -Math.sin(u * Math.PI) * maxSag;
    const edgeLift = Math.sin(v * Math.PI) * 0.05;
    return primary - edgeLift;
  };

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Top + Bottom cloth surfaces
  for (let face = 0; face < 2; face++) {
    const offsetY = face === 0 ? halfT : -halfT;
    const baseIdx = (face * rows * cols);
    for (let j = 0; j < rows; j++) {
      const v = j / segV;
      const z = -hd + v * depth;
      for (let i = 0; i < cols; i++) {
        const u = i / segU;
        const x = -hw + u * width;
        positions.push(x, evalSurfY(u, v) + offsetY, z);
        uvs.push(u, v);
      }
    }
    for (let j = 0; j < segV; j++) {
      for (let i = 0; i < segU; i++) {
        const a = baseIdx + j * cols + i;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        if (face === 0) {
          indices.push(a, c, b, b, c, d);
        } else {
          indices.push(a, b, c, b, d, c);
        }
      }
    }
  }

  // Close perimeter hem edges
  const topStart = 0;
  const botStart = rows * cols;
  const stitchEdge = (ring: number[]) => {
    for (let k = 0; k + 1 < ring.length; k++) {
      const t0 = topStart + ring[k];
      const t1 = topStart + ring[k + 1];
      const b0 = botStart + ring[k];
      const b1 = botStart + ring[k + 1];
      indices.push(t0, t1, b0, t1, b1, b0);
    }
  };
  stitchEdge(Array.from({ length: cols }, (_, i) => i)); // z = -hd
  stitchEdge(Array.from({ length: cols }, (_, i) => segV * cols + (cols - 1 - i))); // z = +hd
  stitchEdge(Array.from({ length: rows }, (_, j) => (rows - 1 - j) * cols)); // x = -hw
  stitchEdge(Array.from({ length: rows }, (_, j) => j * cols + segU)); // x = +hw

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.userData.preserveCustomUv = true;
  return geo;
}

/**
 * Continuous gently-curved Kiosk Striped Canopy + Scalloped Wave Valance (`ExtrudeGeometry`).
 */
function makeCurvedAwningShellGeo(
  width: number,
  chordDepth: number,
  archRise: number,
  thickness: number,
): THREE.BufferGeometry {
  const segs = 12;
  const s = new THREE.Shape();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const z = -chordDepth * 0.5 + t * chordDepth;
    const y = Math.sin(t * Math.PI) * archRise;
    if (i === 0) s.moveTo(z, y);
    else s.lineTo(z, y);
  }
  for (let i = segs; i >= 0; i--) {
    const t = i / segs;
    const z = -chordDepth * 0.5 + t * chordDepth;
    const y = Math.sin(t * Math.PI) * archRise - thickness;
    s.lineTo(z, y);
  }
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    steps: 1,
    curveSegments: 12,
    depth: width,
    bevelEnabled: true,
    bevelSize: 0.012,
    bevelThickness: 0.012,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -width * 0.5);
  geo.rotateY(Math.PI / 2);
  // Map U across X width so awning stripes run cleanly front-to-back along curved shell
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  if (pos && uv) {
    const hw = Math.max(0.1, width * 0.5);
    const hd = Math.max(0.1, chordDepth * 0.5);
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) + hw) / (2 * hw), (pos.getZ(i) + hd) / (2 * hd));
    }
    uv.needsUpdate = true;
  }
  geo.computeVertexNormals();
  geo.userData.preserveCustomUv = true;
  return geo;
}

function makeScallopedValanceCurtainGeo(
  width: number,
  height: number,
  thickness: number,
  numScallops = 12,
): THREE.BufferGeometry {
  const hw = width * 0.5;
  const stepW = width / numScallops;
  const scR = stepW * 0.5;
  const topY = height * 0.5;
  const botY = -height * 0.25;

  const s = new THREE.Shape();
  s.moveTo(-hw, topY);
  s.lineTo(hw, topY);
  s.lineTo(hw, botY);
  for (let i = numScallops - 1; i >= 0; i--) {
    const cx = -hw + (i + 0.5) * stepW;
    s.absarc(cx, botY, scR, 0, Math.PI, true);
  }
  s.closePath();

  const geo = makeBeveledExtrudeGeo(s, thickness, 0.008, 0.008, 1, 8);
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  if (pos && uv) {
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) + hw) / width, (pos.getY(i) - botY) / (topY - botY));
    }
    uv.needsUpdate = true;
  }
  geo.userData.preserveCustomUv = true;
  return geo;
}

/**
 * Continuous contoured Paddle Armrest for Coastal Adirondack Chair (`ExtrudeGeometry` bevel).
 */
function makeAdirondackPaddleArmGeo(isRight: boolean): THREE.BufferGeometry {
  const mirror = isRight ? 1 : -1;
  const s = new THREE.Shape();
  s.moveTo(-0.08 * mirror, -0.37);
  s.lineTo(0.08 * mirror, -0.37);
  s.quadraticCurveTo(0.11 * mirror, 0.02, 0.125 * mirror, 0.34);
  s.quadraticCurveTo(0.105 * mirror, 0.44, 0.0, 0.44);
  s.quadraticCurveTo(-0.095 * mirror, 0.44, -0.095 * mirror, 0.33);
  s.quadraticCurveTo(-0.085 * mirror, 0.02, -0.08 * mirror, -0.37);
  s.closePath();

  const geo = makeBeveledExtrudeGeo(s, 0.052, 0.012, 0.012, 2, 12);
  geo.rotateX(Math.PI / 2);
  return geo;
}

/**
 * Continuous sculpted Surfboard Shell with smooth beveled glassed rails (`ExtrudeGeometry`).
 */
function makeSculptedSurfboardGeo(
  width: number,
  height: number,
  thickness: number,
  isSwallowTail = false,
): THREE.BufferGeometry {
  const hw = width * 0.5;
  const hh = height * 0.5;
  const s = new THREE.Shape();

  if (isSwallowTail) {
    s.moveTo(-hw * 0.42, hh * 0.92);
    s.lineTo(0, hh * 0.72);
    s.lineTo(hw * 0.42, hh * 0.92);
    s.bezierCurveTo(hw * 0.92, hh * 0.48, hw * 1.04, -hh * 0.15, hw * 0.72, -hh * 0.72);
    s.quadraticCurveTo(0, -hh * 1.12, -hw * 0.72, -hh * 0.72);
    s.bezierCurveTo(-hw * 1.04, -hh * 0.15, -hw * 0.92, hh * 0.48, -hw * 0.42, hh * 0.92);
  } else {
    s.moveTo(0, hh);
    s.bezierCurveTo(hw * 0.84, hh * 0.56, hw * 1.02, 0.0, hw * 0.68, -hh * 0.78);
    s.quadraticCurveTo(0, -hh * 1.08, -hw * 0.68, -hh * 0.78);
    s.bezierCurveTo(-hw * 1.02, 0.0, -hw * 0.84, hh * 0.56, 0, hh);
  }
  s.closePath();
  return makeBeveledExtrudeGeo(s, thickness, 0.018, 0.018, 2, 16);
}

/**
 * Continuous rounded Torpedo Lifeguard Rescue Buoy (`LatheGeometry`).
 */
function makeTorpedoRescueBuoyGeo(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.0, -0.39),
    new THREE.Vector2(0.06, -0.34),
    new THREE.Vector2(0.105, -0.22),
    new THREE.Vector2(0.115, 0.0),
    new THREE.Vector2(0.105, 0.22),
    new THREE.Vector2(0.06, 0.34),
    new THREE.Vector2(0.0, 0.39),
  ];
  const geo = new THREE.LatheGeometry(pts, 18);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Continuous Metric Triplanar/Box UV Projector:
 * Works seamlessly on rounded boxes, beveled extrusions, curved gables, and timber slats
 * so procedural grain runs uninterrupted along each part's longest dimension.
 */
function applyBeachContinuousBoxUVs(
  geo: THREE.BufferGeometry,
  mapTex?: THREE.Texture,
  timberTex?: THREE.Texture,
  boardwalkTex?: THREE.Texture,
  weatherboardTex?: THREE.Texture,
  concreteTex?: THREE.Texture,
  travertineTex?: THREE.Texture,
) {
  if (!mapTex || geo.userData.preserveCustomUv) return;
  const posAttr = geo.attributes.position as THREE.BufferAttribute | undefined;
  let normAttr = geo.attributes.normal as THREE.BufferAttribute | undefined;
  const uvAttr = geo.attributes.uv as THREE.BufferAttribute | undefined;
  if (!posAttr || !uvAttr) return;
  if (!normAttr) {
    geo.computeVertexNormals();
    normAttr = geo.attributes.normal as THREE.BufferAttribute | undefined;
    if (!normAttr) return;
  }

  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const spanX = bb ? bb.max.x - bb.min.x : 1;
  const spanY = bb ? bb.max.y - bb.min.y : 1;
  const spanZ = bb ? bb.max.z - bb.min.z : 1;
  const verticalDominant = spanY > Math.max(spanX, spanZ) * 1.15;

  const isBoardwalk = mapTex === boardwalkTex;
  const unitM =
    mapTex === weatherboardTex
      ? 1.75
      : mapTex === concreteTex || mapTex === travertineTex
        ? 2.75
        : mapTex === timberTex
          ? 2.1
          : 1.9;

  for (let i = 0; i < posAttr.count; i++) {
    const px = posAttr.getX(i);
    const py = posAttr.getY(i);
    const pz = posAttr.getZ(i);
    const nx = Math.abs(normAttr.getX(i));
    const ny = Math.abs(normAttr.getY(i));
    const nz = Math.abs(normAttr.getZ(i));

    let u: number;
    let v: number;
    if (ny >= nx && ny >= nz) {
      // Top / bottom faces
      if (mapTex === timberTex && !isBoardwalk && spanZ > spanX * 1.1) {
        u = pz / unitM;
        v = px / unitM;
      } else {
        u = px / unitM;
        v = pz / unitM;
      }
    } else if (nx >= nz) {
      // +/- X side faces
      if (mapTex === timberTex && verticalDominant) {
        u = py / unitM;
        v = pz / unitM;
      } else {
        u = pz / unitM;
        v = py / unitM;
      }
    } else {
      // +/- Z front/back faces
      if (mapTex === timberTex && verticalDominant) {
        u = py / unitM;
        v = px / unitM;
      } else {
        u = px / unitM;
        v = py / unitM;
      }
    }
    if (isBoardwalk) {
      u *= 0.28;
      v *= 0.28;
    }
    uvAttr.setXY(i, u, v);
  }
  uvAttr.needsUpdate = true;
}

/**
 * Builds the 1:1 South-East Coastal Beachfront & Park (Boardwalk, Pergola, Outdoor Shower,
 * Kai's Juice & Coconut Kiosk, Surfboard Rental Rack, Lifeguard Watchtower, Timber Sun Loungers
 * & Coastal Adirondack Chairs) using continuous rounded mid-res geometry and procedural canvas textures.
 */
export function buildSouthEastCoastalBeachfront3D<TWind>(
  opts: CoastalBeachfrontBuildOptions<TWind>,
): CoastalBeachfrontBuildHandle {
  const {
    parentGroup,
    roadsGroup,
    windUniforms,
    isSoftwareGl,
    lobbyConcreteTex,
    lobbyLouverTex,
    createBlitzStrokeMesh,
    upgradeMeshToBlitzWorldMaterial,
  } = opts;

  const seBeachGroup = new THREE.Group();
  seBeachGroup.name = 'SouthEastBeachfrontPark3D';
  parentGroup.add(seBeachGroup);

  const coastalTimberTex = createCoastalTimberPlankTexture();
  const boardwalkDeckTex = coastalTimberTex.clone();
  boardwalkDeckTex.wrapS = THREE.RepeatWrapping;
  boardwalkDeckTex.wrapT = THREE.RepeatWrapping;
  boardwalkDeckTex.repeat.set(3.2, 8.5);
  boardwalkDeckTex.needsUpdate = true;

  const coastalWeatherboardTex = createCoastalWeatherboardTexture();
  const coastalAwningTex = createCoastalStripedAwningTexture();
  const coastalSailClothTex = createCoastalSailClothTexture();
  const showerPebbleTex = createShowerPebbleBasinTexture();
  const coastalTravertineTex = createCoastalTravertineTexture();
  const coastalHempRopeTex = createCoastalHempRopeTexture();
  const kioskChalkboardTex = createKioskChalkboardTexture();
  const surfSignTex = createSurfRentalSignTexture();

  const addBeachPart = (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    colorHex: string,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
    strokeW = 0.018,
    mapTex?: THREE.Texture,
  ): THREE.Mesh => {
    applyBeachContinuousBoxUVs(
      geo,
      mapTex,
      coastalTimberTex,
      boardwalkDeckTex,
      coastalWeatherboardTex,
      lobbyConcreteTex,
      coastalTravertineTex,
    );
    const effectiveTint = mapTex ? '#ffffff' : colorHex;
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: effectiveTint,
        map: mapTex || null,
        roughness: 0.72,
      }),
    );
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.rotation.set(rot[0], rot[1], rot[2]);
    mesh.castShadow = !isSoftwareGl;
    mesh.receiveShadow = !isSoftwareGl;
    upgradeMeshToBlitzWorldMaterial(mesh, windUniforms, effectiveTint, 0.08);
    if (strokeW > 0) {
      const st = createBlitzStrokeMesh(geo, strokeW);
      if (st) mesh.add(st);
    }
    parent.add(mesh);
    return mesh;
  };

  // =========================================================================
  // 1. URBAN SEASIDE WALKWAY, WEATHERED TIMBER BOARDWALK, STAIRS, RAMP & ROPE RAILING
  // =========================================================================
  const BOARDWALK_Y = 0.82;
  const COL_DRIFTWOOD = '#b58858';
  const COL_DRIFTWOOD_DARK = '#876139';
  const COL_SAIL_CREAM = '#faf6ec';
  const COL_STAINLESS = '#d8e0e8';
  const COL_STAINLESS_DARK = '#7c8794';

  // 1A. Rounded Limestone/Travertine Walkway & Chamfered Promenade Stairs
  addBeachPart(
    seBeachGroup,
    makeRoundedBoxGeo(2.8, 0.24, 57.5, 0.045, 2),
    '#d8d4c8',
    [76.6, 0.12, 74.25],
    [0, 0, 0],
    0.020,
    coastalTravertineTex,
  );
  addBeachPart(
    seBeachGroup,
    makeRoundedBoxGeo(0.38, 0.30, 57.7, 0.06, 2),
    '#9e9b93',
    [75.22, 0.15, 74.25],
    [0, 0, 0],
    0.016,
    coastalTravertineTex,
  );
  addBeachPart(
    seBeachGroup,
    makeRoundedBoxGeo(0.56, 0.22, 56.5, 0.04, 2),
    '#c4bfb4',
    [77.52, 0.35, 74.25],
    [0, 0, 0],
    0.015,
    coastalTravertineTex,
  );
  addBeachPart(
    seBeachGroup,
    makeRoundedBoxGeo(0.56, 0.22, 56.5, 0.04, 2),
    '#c89d6c',
    [77.82, 0.56, 74.25],
    [0, 0, 0],
    0.015,
    boardwalkDeckTex,
  );

  // West Edge Coastal Travertine Planters (chamfered rounded corners + soil)
  for (const [pzStart, pzLen] of [
    [51.0, 7.5],
    [66.2, 6.5],
    [80.5, 6.5],
    [96.0, 6.5],
  ] as [number, number][]) {
    addBeachPart(
      seBeachGroup,
      makeRoundedBoxGeo(0.96, 0.44, pzLen, 0.075, 2),
      '#c4bfb4',
      [78.55, BOARDWALK_Y + 0.22, pzStart],
      [0, 0, 0],
      0.015,
      coastalTravertineTex,
    );
    addBeachPart(
      seBeachGroup,
      makeRoundedBoxGeo(0.74, 0.10, pzLen - 0.24, 0.02, 1),
      '#4a3525',
      [78.55, BOARDWALK_Y + 0.42, pzStart],
      [0, 0, 0],
      0.008,
    );
  }

  // Smooth Rounded Urban Promenade Streetlamps
  const lampFootGeo = makeBullnoseDiscGeo(0.18, 0.42, 18, 0.04);
  const lampPoleGeo = new THREE.CylinderGeometry(0.075, 0.098, 4.65, 16);
  const lampArmGeo = makeRoundedBoxGeo(0.98, 0.11, 0.16, 0.03, 2);
  const lampHeadGeo = makeRoundedBoxGeo(0.48, 0.07, 0.22, 0.025, 2);
  for (const lz of [49.5, 63.0, 76.5, 91.5]) {
    addBeachPart(seBeachGroup, lampFootGeo, '#383e47', [75.85, 0.44, lz], [0, 0, 0], 0.012);
    addBeachPart(seBeachGroup, lampPoleGeo, '#474f5c', [75.85, 2.75, lz], [0, 0, 0], 0.012);
    addBeachPart(seBeachGroup, lampArmGeo, '#474f5c', [76.26, 5.04, lz], [0, 0, 0], 0.010);
    addBeachPart(seBeachGroup, lampHeadGeo, '#fff1b8', [76.48, 4.96, lz], [0, 0, 0], 0.008);
  }

  // 1B. Elevated Weathered Timber Boardwalk Deck (top y = +0.82m preserved)
  addBeachPart(
    seBeachGroup,
    makeRoundedBoxGeo(14.2, 0.24, 56.5, 0.045, 2),
    '#c89d6c',
    [85.1, BOARDWALK_Y - 0.12, 74.25],
    [0, 0, 0],
    0.020,
    boardwalkDeckTex,
  );
  addBeachPart(
    seBeachGroup,
    makeRoundedBoxGeo(14.42, 0.32, 56.72, 0.05, 2),
    '#9e7448',
    [85.1, BOARDWALK_Y - 0.28, 74.25],
    [0, 0, 0],
    0.018,
    coastalTimberTex,
  );

  // Rounded Concrete Pier Footings & Timber Support Piles
  const pierBaseGeo = makeRoundedBoxGeo(0.78, 0.28, 0.78, 0.06, 2);
  const pierPostGeo = makeRoundedBoxGeo(0.42, 0.48, 0.42, 0.04, 2);
  for (let pz = 46.8; pz <= 101.8; pz += 4.58) {
    for (const px of [78.6, 85.1, 91.6]) {
      addBeachPart(seBeachGroup, pierBaseGeo, '#9c9890', [px, 0.14, pz], [0, 0, 0], 0.014, coastalTravertineTex);
      addBeachPart(seBeachGroup, pierPostGeo, '#8f673e', [px, 0.48, pz], [0, 0, 0], 0.014, coastalTimberTex);
    }
  }

  // 1C. Chamfered Step-Stone Stairs & Sloped Beach Access Ramp
  const mainStepStoneGeo = makeRoundedBoxGeo(0.86, 0.17, 7.0, 0.03, 2);
  const mainStepTreadGeo = makeRoundedBoxGeo(0.92, 0.06, 7.08, 0.022, 2);
  for (let st = 0; st < 5; st++) {
    const sx = 92.58 + st * 0.78;
    const sy = BOARDWALK_Y - (st + 1) * 0.155;
    addBeachPart(seBeachGroup, mainStepStoneGeo, '#c4bfb4', [sx, sy, 73.0], [0, 0, 0], 0.015, coastalTravertineTex);
    addBeachPart(seBeachGroup, mainStepTreadGeo, '#c89d6c', [sx, sy + 0.095, 73.0], [0, 0, 0], 0.013, coastalTimberTex);
  }
  addBeachPart(
    seBeachGroup,
    makeRoundedBoxGeo(4.35, 0.18, 4.0, 0.04, 2),
    '#c89d6c',
    [94.2, 0.42, 67.1],
    [0, 0, -0.195],
    0.016,
    coastalTimberTex,
  );
  const rampCurbGeo = makeRoundedBoxGeo(4.38, 0.32, 0.22, 0.04, 2);
  for (const rz of [65.15, 69.05]) {
    addBeachPart(seBeachGroup, rampCurbGeo, '#8f673e', [94.2, 0.52, rz], [0, 0, -0.195], 0.014, coastalTimberTex);
  }
  const southStepTreadGeo = makeRoundedBoxGeo(0.84, 0.18, 4.8, 0.035, 2);
  for (let st = 0; st < 4; st++) {
    const sx = 92.55 + st * 0.82;
    const sy = BOARDWALK_Y - (st + 1) * 0.185;
    addBeachPart(seBeachGroup, southStepTreadGeo, '#c89d6c', [sx, sy, 96.6], [0, 0, 0], 0.014, coastalTimberTex);
  }

  // 1D. Continuous Curved Nautical Hemp Ropes & Chamfered Bollard Posts
  const railPostGeo = makeRoundedBoxGeo(0.30, 1.38, 0.30, 0.045, 2);
  const railCapGeo = makeRoundedBoxGeo(0.36, 0.09, 0.36, 0.03, 2);
  const railLedGeo = makeRoundedBoxGeo(0.33, 0.12, 0.33, 0.025, 2);
  const railCollarGeo = makeBullnoseDiscGeo(0.18, 0.07, 16, 0.018);

  const buildNauticalRopeRailingRun = (pts: [number, number][]) => {
    for (let i = 0; i < pts.length; i++) {
      const [px, pz] = pts[i];
      addBeachPart(seBeachGroup, railPostGeo, '#a67b4e', [px, BOARDWALK_Y + 0.69, pz], [0, 0, 0], 0.016, coastalTimberTex);
      addBeachPart(seBeachGroup, railCapGeo, '#7d5934', [px, BOARDWALK_Y + 1.40, pz], [0, 0, 0], 0.012, coastalTimberTex);
      addBeachPart(seBeachGroup, railLedGeo, '#ffe596', [px, BOARDWALK_Y + 0.11, pz], [0, 0, 0], 0.008);
      addBeachPart(seBeachGroup, railCollarGeo, '#3b4048', [px, BOARDWALK_Y + 1.15, pz], [0, 0, 0], 0.009);
      addBeachPart(seBeachGroup, railCollarGeo, '#3b4048', [px, BOARDWALK_Y + 0.68, pz], [0, 0, 0], 0.009);

      if (i + 1 < pts.length) {
        const [nx, nz] = pts[i + 1];
        for (const ropeBaseY of [BOARDWALK_Y + 1.15, BOARDWALK_Y + 0.68]) {
          const curvePts: THREE.Vector3[] = [];
          const samples = 6;
          for (let s = 0; s <= samples; s++) {
            const t = s / samples;
            const sag = Math.sin(t * Math.PI) * 0.15;
            curvePts.push(
              new THREE.Vector3(
                THREE.MathUtils.lerp(px, nx, t),
                ropeBaseY - sag,
                THREE.MathUtils.lerp(pz, nz, t),
              ),
            );
          }
          const ropeCurve = new THREE.CatmullRomCurve3(curvePts);
          const ropeGeo = new THREE.TubeGeometry(ropeCurve, 14, 0.044, 10, false);
          ropeGeo.userData.preserveCustomUv = true;
          addBeachPart(seBeachGroup, ropeGeo, '#d6be94', [0, 0, 0], [0, 0, 0], 0.009, coastalHempRopeTex);
        }
      }
    }
  };

  buildNauticalRopeRailingRun([
    [78.5, 46.3],
    [83.0, 46.3],
    [87.5, 46.3],
    [91.9, 46.3],
    [91.9, 50.9],
    [91.9, 55.5],
    [91.9, 60.1],
    [91.9, 64.7],
  ]);
  buildNauticalRopeRailingRun([
    [91.9, 76.8],
    [91.9, 81.1],
    [91.9, 85.4],
    [91.9, 89.7],
    [91.9, 94.0],
  ]);
  buildNauticalRopeRailingRun([
    [91.9, 99.2],
    [91.9, 102.2],
    [87.4, 102.2],
    [82.9, 102.2],
    [78.5, 102.2],
  ]);

  // =========================================================================
  // 2. MINIMALIST TIMBER PERGOLA, CONTINUOUS BILLOWING SAIL CLOTHS & BENCH/TABLES
  // =========================================================================
  const beachPergolaGrp = new THREE.Group();
  beachPergolaGrp.name = 'MinimalistTimberBeachPergola';
  beachPergolaGrp.position.set(84.2, BOARDWALK_Y, 88.5);
  beachPergolaGrp.rotation.y = Math.PI / 2;
  beachPergolaGrp.scale.setScalar(1.42);
  seBeachGroup.add(beachPergolaGrp);

  const PERG_W = 10.4;
  const PERG_D = 6.2;
  const PERG_H = 3.85;

  addBeachPart(
    beachPergolaGrp,
    makeRoundedBoxGeo(PERG_W + 0.6, 0.08, PERG_D + 0.6, 0.025, 2),
    '#cfa576',
    [0, 0.04, 0],
    [0, 0, 0],
    0.015,
    coastalTimberTex,
  );

  const colShoeGeo = makeRoundedBoxGeo(0.40, 0.14, 0.40, 0.025, 2);
  for (const cx of [-4.9, 0.0, 4.9]) {
    for (const cz of [-2.8, 2.8]) {
      const colH = cz > 0 ? PERG_H + 0.14 : PERG_H - 0.14;
      addBeachPart(beachPergolaGrp, colShoeGeo, '#3b4048', [cx, 0.11, cz], [0, 0, 0], 0.010);
      addBeachPart(
        beachPergolaGrp,
        makeRoundedBoxGeo(0.32, colH, 0.32, 0.045, 2),
        COL_DRIFTWOOD,
        [cx, 0.08 + colH * 0.5, cz],
        [0, 0, 0],
        0.018,
        coastalTimberTex,
      );
    }
  }

  const braceGeo = makeRoundedBoxGeo(1.25, 0.16, 0.18, 0.03, 2);
  for (const [bx, dir] of [
    [-4.2, 1],
    [-0.7, -1],
    [0.7, 1],
    [4.2, -1],
  ] as [number, number][]) {
    for (const bz of [-2.8, 2.8]) {
      const braceH = bz > 0 ? PERG_H - 0.32 : PERG_H - 0.58;
      addBeachPart(beachPergolaGrp, braceGeo, COL_DRIFTWOOD_DARK, [bx, braceH, bz], [0, 0, dir * 0.68], 0.012, coastalTimberTex);
    }
  }

  const trellisPostGeo = makeRoundedBoxGeo(0.14, PERG_H - 0.35, 0.14, 0.025, 2);
  const trellisRailGeo = makeRoundedBoxGeo(6.8, 0.10, 0.10, 0.022, 2);
  for (let tx = -3.2; tx <= 3.21; tx += 1.28) {
    addBeachPart(beachPergolaGrp, trellisPostGeo, COL_DRIFTWOOD, [tx, 1.92, -2.8], [0, 0, 0], 0.012, coastalTimberTex);
  }
  for (let ty = 0.85; ty <= 3.15; ty += 0.72) {
    addBeachPart(beachPergolaGrp, trellisRailGeo, COL_DRIFTWOOD_DARK, [0, ty, -2.8], [0, 0, 0], 0.011, coastalTimberTex);
  }

  const pergolaRoofPivot = new THREE.Group();
  pergolaRoofPivot.position.set(0, PERG_H + 0.06, 0);
  pergolaRoofPivot.rotation.x = -0.048;
  beachPergolaGrp.add(pergolaRoofPivot);

  const mainHeaderBeamGeo = makeRoundedBoxGeo(PERG_W + 1.4, 0.26, 0.28, 0.04, 2);
  addBeachPart(pergolaRoofPivot, mainHeaderBeamGeo, COL_DRIFTWOOD_DARK, [0, 0, 2.8], [0, 0, 0], 0.016, coastalTimberTex);
  addBeachPart(pergolaRoofPivot, mainHeaderBeamGeo, COL_DRIFTWOOD_DARK, [0, 0, -2.8], [0, 0, 0], 0.016, coastalTimberTex);
  const tieBeamGeo = makeRoundedBoxGeo(0.26, 0.24, PERG_D + 1.3, 0.038, 2);
  for (const cx of [-4.9, 0.0, 4.9]) {
    addBeachPart(pergolaRoofPivot, tieBeamGeo, COL_DRIFTWOOD_DARK, [cx, 0.12, 0], [0, 0, 0], 0.014, coastalTimberTex);
  }
  const rafterGeo = makeRoundedBoxGeo(0.14, 0.20, PERG_D + 1.4, 0.032, 2);
  for (let rx = -5.2; rx <= 5.21; rx += 0.65) {
    addBeachPart(pergolaRoofPivot, rafterGeo, COL_DRIFTWOOD, [rx, 0.28, 0], [0, 0, 0], 0.011, coastalTimberTex);
  }

  // Continuous smooth doubly-curved linen canvas sail cloths (zero broken segments)
  const sailGeoBack = makeContinuousCatenarySailGeo(4.35, 3.1, 0.46, 0.032, 18, 6);
  const sailGeoFront = makeContinuousCatenarySailGeo(4.35, 3.1, 0.42, 0.032, 18, 6);
  for (const bayCenterX of [-2.45, 2.45]) {
    addBeachPart(pergolaRoofPivot, sailGeoBack, COL_SAIL_CREAM, [bayCenterX, -0.06, -1.05], [0.04, 0, 0], 0.009, coastalSailClothTex);
    addBeachPart(pergolaRoofPivot, sailGeoFront, COL_SAIL_CREAM, [bayCenterX, -0.06, 1.15], [0.04, 0, 0], 0.009, coastalSailClothTex);
  }

  // Built-in Pergola Lounge Bench: sculpted rounded outer rail + 5 slatted planks keeping top y = 0.59 * 1.42 = 0.838m exact!
  const benchPlankGeo = makeRoundedBoxGeo(0.20, 0.12, 3.56, 0.028, 2);
  for (let p = 0; p < 5; p++) {
    const px = -3.6 + (p - 2) * 0.23;
    addBeachPart(beachPergolaGrp, benchPlankGeo, '#d4ae7e', [px, 0.53, -0.2], [0, 0, 0], 0.012, coastalTimberTex);
  }
  addBeachPart(beachPergolaGrp, makeRoundedBoxGeo(1.15, 0.08, 3.60, 0.025, 2), '#b88b5b', [-3.6, 0.48, -0.2], [0, 0, 0], 0.013, coastalTimberTex);
  const benchLegGeo = makeRoundedBoxGeo(0.95, 0.40, 0.18, 0.035, 2);
  for (const lz of [-1.6, 0.0, 1.2]) {
    addBeachPart(beachPergolaGrp, benchLegGeo, COL_DRIFTWOOD_DARK, [-3.6, 0.26, lz], [0, 0, 0], 0.011, coastalTimberTex);
  }

  // 2 Bullnose Coastal Café Tables + 6 Contoured Circular Stools
  const tableTopGeo = makeBullnoseDiscGeo(0.82, 0.09, 24, 0.025);
  const tableColGeo = new THREE.CylinderGeometry(0.10, 0.12, 0.74, 16);
  const tableFootGeo = makeBullnoseDiscGeo(0.41, 0.06, 20, 0.02);
  const stoolTopGeo = makeBullnoseDiscGeo(0.28, 0.07, 22, 0.022);
  const stoolLegGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.44, 14);
  for (const tblX of [-0.8, 2.6]) {
    addBeachPart(beachPergolaGrp, tableTopGeo, '#cfa576', [tblX, 0.82, 0.2], [0, 0, 0], 0.012, coastalTimberTex);
    addBeachPart(beachPergolaGrp, tableColGeo, COL_DRIFTWOOD_DARK, [tblX, 0.44, 0.2], [0, 0, 0], 0.009, coastalTimberTex);
    addBeachPart(beachPergolaGrp, tableFootGeo, COL_DRIFTWOOD_DARK, [tblX, 0.11, 0.2], [0, 0, 0], 0.009, coastalTimberTex);
    for (let cAng = 0; cAng < 3; cAng++) {
      const ang = cAng * ((Math.PI * 2) / 3) + 0.4;
      const chX = tblX + Math.cos(ang) * 1.18;
      const chZ = 0.2 + Math.sin(ang) * 1.18;
      addBeachPart(beachPergolaGrp, stoolTopGeo, '#c89d6c', [chX, 0.50, chZ], [0, 0, 0], 0.009, coastalTimberTex);
      addBeachPart(beachPergolaGrp, stoolLegGeo, COL_DRIFTWOOD_DARK, [chX, 0.26, chZ], [0, 0, 0], 0.008, coastalTimberTex);
    }
  }

  // 5 Lathe Coastal Stone Planter Urns at Pergola corners
  const pergUrnGeo = makeCoastalUrnPotGeo(0.26, 0.36, 0.48, 20);
  pergUrnGeo.userData.preserveCustomUv = true;
  const soilDiscGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.04, 18);
  for (const [potX, potZ] of [
    [-4.3, 2.3],
    [3.8, 2.3],
    [4.4, 1.4],
    [-4.3, -2.2],
    [4.3, -2.2],
  ] as [number, number][]) {
    addBeachPart(beachPergolaGrp, pergUrnGeo, '#d6cec2', [potX, 0.32, potZ], [0, 0, 0], 0.011, coastalTravertineTex);
    addBeachPart(beachPergolaGrp, soilDiscGeo, '#4a3525', [potX, 0.54, potZ], [0, 0, 0], 0.007);
  }

  // =========================================================================
  // 3. OUTDOOR BEACH SHOWER STATION & FOOT WASH (ROUNDED CURBS, GOOSENECK PIPES & URNS)
  // =========================================================================
  const showerStationGrp = new THREE.Group();
  showerStationGrp.name = 'OutdoorBeachShowerStation';
  showerStationGrp.position.set(83.6, BOARDWALK_Y, 72.8);
  showerStationGrp.rotation.y = Math.PI / 2;
  showerStationGrp.scale.setScalar(1.72);
  seBeachGroup.add(showerStationGrp);

  addBeachPart(
    showerStationGrp,
    makeRoundedBoxGeo(3.4, 0.24, 2.15, 0.065, 2),
    '#c8c4bc',
    [0, 0.12, 0.25],
    [0, 0, 0],
    0.016,
    coastalTravertineTex,
  );
  const pebbleFloorGeo = makeRoundedBoxGeo(2.96, 0.06, 1.72, 0.02, 1);
  pebbleFloorGeo.userData.preserveCustomUv = true;
  addBeachPart(showerStationGrp, pebbleFloorGeo, '#ffffff', [0, 0.22, 0.25], [0, 0, 0], 0.009, showerPebbleTex);
  const drainGrateGeo = makeBullnoseDiscGeo(0.28, 0.07, 20, 0.015);
  for (const gx of [-0.82, 0.82]) {
    addBeachPart(showerStationGrp, drainGrateGeo, COL_STAINLESS_DARK, [gx, 0.225, 0.45], [0, 0, 0], 0.008);
  }
  const ledDomeGeo = new THREE.SphereGeometry(0.075, 12, 10);
  for (const [lx, lz] of [
    [-1.1, 1.33],
    [1.1, 1.33],
    [1.71, 0.65],
    [-1.71, 0.65],
  ] as [number, number][]) {
    addBeachPart(showerStationGrp, ledDomeGeo, '#fff0b3', [lx, 0.13, lz], [0, 0, 0], 0);
  }

  // Smooth continuous gooseneck stainless arm Curve (`TubeGeometry`)
  const gooseneckGeo = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 2.76, -0.22),
      new THREE.Vector3(0, 2.78, 0.28),
      new THREE.Vector3(0, 2.75, 0.50),
      new THREE.Vector3(0, 2.60, 0.58),
    ]),
    18,
    0.042,
    14,
    false,
  );
  const footSpigotGeo = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.72, -0.20),
      new THREE.Vector3(0, 0.72, -0.02),
      new THREE.Vector3(0, 0.62, 0.02),
    ]),
    12,
    0.032,
    12,
    false,
  );
  const pillarGeo = makeRoundedBoxGeo(0.32, 2.85, 0.32, 0.045, 2);
  const rainHeadBellGeo = new THREE.CylinderGeometry(0.18, 0.28, 0.09, 24);
  const rainHeadFaceGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.03, 24);
  const turnPlateGeo = makeBullnoseDiscGeo(0.12, 0.06, 20, 0.015);
  const turnKnobGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.11, 16);
  const pegHookGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.032, 0.0),
      new THREE.Vector2(0.024, 0.12),
      new THREE.Vector2(0.040, 0.17),
      new THREE.Vector2(0.032, 0.21),
      new THREE.Vector2(0.0, 0.22),
    ],
    14,
  );

  for (const px of [-0.82, 0.82]) {
    addBeachPart(showerStationGrp, pillarGeo, COL_DRIFTWOOD, [px, 1.62, -0.35], [0, 0, 0], 0.016, coastalTimberTex);
    addBeachPart(showerStationGrp, ledDomeGeo, '#fff0b3', [px + 0.12, 0.34, -0.18], [0, 0, 0], 0);
    addBeachPart(showerStationGrp, gooseneckGeo, COL_STAINLESS, [px, 0, 0], [0, 0, 0], 0.009);
    addBeachPart(showerStationGrp, rainHeadBellGeo, COL_STAINLESS, [px, 2.58, 0.58], [0.18, 0, 0], 0.010);
    addBeachPart(showerStationGrp, rainHeadFaceGeo, COL_STAINLESS_DARK, [px, 2.53, 0.58], [0.18, 0, 0], 0);
    addBeachPart(showerStationGrp, turnPlateGeo, COL_STAINLESS, [px, 1.48, -0.17], [Math.PI / 2, 0, 0], 0.007);
    addBeachPart(showerStationGrp, turnKnobGeo, COL_STAINLESS_DARK, [px, 1.48, -0.13], [Math.PI / 2, 0, 0], 0.006);
    addBeachPart(showerStationGrp, footSpigotGeo, COL_STAINLESS, [px, 0, 0], [0, 0, 0], 0.007);
    addBeachPart(showerStationGrp, makeRoundedBoxGeo(0.10, 0.035, 0.04, 0.01, 1), COL_STAINLESS_DARK, [px, 0.78, -0.12], [0, 0, 0], 0.006);

    const sideDir = px < 0 ? -1 : 1;
    addBeachPart(showerStationGrp, pegHookGeo, COL_DRIFTWOOD_DARK, [px + sideDir * 0.14, 1.98, -0.35], [0, 0, -sideDir * 0.82], 0.007, coastalTimberTex);
  }

  addBeachPart(showerStationGrp, makeRoundedBoxGeo(0.28, 2.82, 0.26, 0.04, 2), COL_DRIFTWOOD, [0, 1.60, -0.42], [0, 0, 0], 0.014, coastalTimberTex);
  addBeachPart(showerStationGrp, new THREE.CylinderGeometry(0.04, 0.04, 2.55, 16), COL_STAINLESS, [0, 1.52, -0.57], [0, 0, 0], 0.007);
  const clampGeo = makeRoundedBoxGeo(0.14, 0.06, 0.08, 0.015, 1);
  for (const clampY of [0.65, 1.45, 2.25, 2.68]) {
    addBeachPart(showerStationGrp, clampGeo, COL_STAINLESS_DARK, [0, clampY, -0.56], [0, 0, 0], 0.006);
  }

  const smallUrnGeo = makeCoastalUrnPotGeo(0.24, 0.32, 0.44, 20);
  smallUrnGeo.userData.preserveCustomUv = true;
  const smallSoilGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.04, 16);
  for (const spX of [-1.98, 1.98]) {
    addBeachPart(showerStationGrp, smallUrnGeo, '#d6cec2', [spX, 0.22, -0.25], [0, 0, 0], 0.011, coastalTravertineTex);
    addBeachPart(showerStationGrp, smallSoilGeo, '#4a3525', [spX, 0.42, -0.25], [0, 0, 0], 0.007);
  }

  for (const wzOffset of [-0.82, 0.82]) {
    const mistGeo = new THREE.CylinderGeometry(0.24, 0.64, 3.85, 20, 1, true);
    const mistMat = new THREE.MeshBasicMaterial({
      color: '#ccf4ff',
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mistMesh = new THREE.Mesh(mistGeo, mistMat);
    mistMesh.position.set(83.6 + 0.58 * 1.72, BOARDWALK_Y + 1.41 * 1.72, 72.8 - wzOffset * 1.72);
    roadsGroup.add(mistMesh);
  }

  // =========================================================================
  // 4. BEACHSIDE JUICE & COCONUT KIOSK (KAI'S BUILDING — GABLED, CURVED AWNING & LATHE STOOLS)
  // =========================================================================
  const juiceKioskGrp = new THREE.Group();
  juiceKioskGrp.name = 'BeachsideJuiceAndCoconutKiosk';
  juiceKioskGrp.position.set(82.0, BOARDWALK_Y, 60.0);
  juiceKioskGrp.rotation.y = Math.PI / 2;
  juiceKioskGrp.scale.setScalar(1.52);
  seBeachGroup.add(juiceKioskGrp);

  const KIOSK_W = 5.0;
  const KIOSK_D = 3.6;
  const KIOSK_WALL_H = 3.15;

  // Sub-deck (stays <= 84.74m in world X so Kai stands flush on the boardwalk at x = 85.8m)
  addBeachPart(
    juiceKioskGrp,
    makeRoundedBoxGeo(KIOSK_W + 0.4, 0.09, KIOSK_D + 0.2, 0.028, 2),
    '#c89d6c',
    [0, 0.055, -0.10],
    [0, 0, 0],
    0.015,
    coastalTimberTex,
  );

  const kioskPostGeo = makeRoundedBoxGeo(0.24, KIOSK_WALL_H, 0.24, 0.04, 2);
  for (const cx of [-2.42, 2.42]) {
    for (const cz of [-1.72, 1.72]) {
      addBeachPart(juiceKioskGrp, kioskPostGeo, COL_DRIFTWOOD, [cx, 0.12 + KIOSK_WALL_H * 0.5, cz], [0, 0, 0], 0.014, coastalTimberTex);
    }
  }

  // Weatherboard Rear Wall & Door
  addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(KIOSK_W - 0.16, KIOSK_WALL_H, 0.22, 0.03, 2), '#f5efe4', [0, 0.12 + KIOSK_WALL_H * 0.5, -1.68], [0, 0, 0], 0.015, coastalWeatherboardTex);
  addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(1.22, 2.28, 0.08, 0.025, 2), COL_DRIFTWOOD, [-0.95, 1.26, -1.80], [0, 0, 0], 0.012, coastalTimberTex);
  addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(1.06, 2.14, 0.10, 0.022, 2), '#eee6d6', [-0.95, 1.26, -1.82], [0, 0, 0], 0.011);
  addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(0.68, 0.42, 0.12, 0.015, 1), '#876139', [-0.95, 0.56, -1.83], [0, 0, 0], 0.008, lobbyLouverTex);
  addBeachPart(juiceKioskGrp, new THREE.SphereGeometry(0.055, 14, 12), '#d97706', [-0.52, 1.18, -1.88], [0, 0, 0], 0.006);
  addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(0.88, 0.38, 0.09, 0.018, 1), COL_DRIFTWOOD, [1.15, 2.48, -1.81], [0, 0, 0], 0.010, lobbyLouverTex);

  // Left & Right Side Walls with True Triangular Extruded Gables + Curved Mini Awnings
  const kioskSideWallGeo = makeRoundedBoxGeo(0.22, KIOSK_WALL_H, KIOSK_D - 0.16, 0.03, 2);
  const kioskGableGeo = makeGablePedimentGeo(KIOSK_D - 0.16, 0.94, 0.20);
  const makeSideAwningGeo = (dir: number) => {
    const g = makeCurvedAwningShellGeo(1.18, 0.68, 0.04, 0.055);
    g.rotateX(0.38);
    g.rotateY(dir * (Math.PI / 2));
    return g;
  };
  const sideAwningGeos = { [-1]: makeSideAwningGeo(-1), [1]: makeSideAwningGeo(1) } as const;
  for (const sx of [-2.38, 2.38]) {
    const dir = sx < 0 ? -1 : 1;
    addBeachPart(juiceKioskGrp, kioskSideWallGeo, '#f5efe4', [sx, 0.12 + KIOSK_WALL_H * 0.5, 0], [0, 0, 0], 0.015, coastalWeatherboardTex);
    addBeachPart(juiceKioskGrp, kioskGableGeo, '#f5efe4', [sx, KIOSK_WALL_H + 0.08, 0], [0, Math.PI / 2, 0], 0.012, coastalWeatherboardTex);
    addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(0.10, 1.24, 1.04, 0.02, 2), COL_DRIFTWOOD, [sx + dir * 0.09, 1.92, 0.05], [0, 0, 0], 0.010, coastalTimberTex);
    addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(0.12, 1.06, 0.86, 0.015, 1), '#a8845c', [sx + dir * 0.10, 1.92, 0.05], [0, 0, 0], 0.009, lobbyLouverTex);
    addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(0.32, 0.24, 1.12, 0.03, 2), COL_DRIFTWOOD, [sx + dir * 0.24, 1.18, 0.05], [0, 0, 0], 0.011, coastalTimberTex);
    addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(0.24, 0.06, 1.02, 0.015, 1), '#4a3525', [sx + dir * 0.24, 1.29, 0.05], [0, 0, 0], 0.007);
    addBeachPart(juiceKioskGrp, sideAwningGeos[dir], '#ffffff', [sx + dir * 0.36, 2.66, 0.05], [0, 0, 0], 0.010, coastalAwningTex);
  }

  for (const [kpX, kpZ] of [
    [-2.58, 2.36],
    [-2.58, -1.42],
  ] as [number, number][]) {
    addBeachPart(juiceKioskGrp, smallUrnGeo, '#d6cec2', [kpX, 0.34, kpZ], [0, 0, 0], 0.011, coastalTravertineTex);
    addBeachPart(juiceKioskGrp, smallSoilGeo, '#4a3525', [kpX, 0.54, kpZ], [0, 0, 0], 0.007);
  }

  // Front Counter Bay + Menu + Rounded Bullnose Service Ledge
  addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(KIOSK_W - 0.2, 1.16, 0.24, 0.03, 2), '#f5efe4', [0, 0.70, 1.66], [0, 0, 0], 0.015, coastalWeatherboardTex);
  addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(1.38, 1.68, 0.22, 0.025, 2), '#f5efe4', [-1.72, 2.12, 1.66], [0, 0, 0], 0.012, coastalWeatherboardTex);
  addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(KIOSK_W - 0.2, 0.42, 0.24, 0.025, 2), '#f5efe4', [0, 3.06, 1.66], [0, 0, 0], 0.012, coastalWeatherboardTex);

  const chalkGeo = makeRoundedBoxGeo(1.16, 1.38, 0.08, 0.02, 2);
  chalkGeo.userData.preserveCustomUv = true;
  addBeachPart(juiceKioskGrp, chalkGeo, '#ffffff', [-1.72, 2.08, 1.80], [0, 0, 0], 0.012, kioskChalkboardTex);

  addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(KIOSK_W + 0.16, 0.14, 0.72, 0.045, 2), '#b88652', [0, 1.32, 1.88], [0, 0, 0], 0.014, coastalTimberTex);
  const corbelGeo = makeRoundedBoxGeo(0.10, 0.28, 0.36, 0.025, 2);
  for (const bx of [-2.1, -0.7, 0.7, 2.1]) {
    addBeachPart(juiceKioskGrp, corbelGeo, COL_DRIFTWOOD_DARK, [bx, 1.12, 1.95], [-0.45, 0, 0], 0.009, coastalTimberTex);
  }

  // Interior Counter Bay, Glass Fruit Trays & Smooth 20-seg Blender
  addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(4.5, 1.15, 1.15, 0.04, 2), '#d8ceb8', [0, 0.70, 0.95], [0, 0, 0], 0.011, coastalTravertineTex);
  addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(2.6, 0.08, 0.36, 0.02, 2), COL_DRIFTWOOD, [0.45, 2.35, 0.25], [0, 0, 0], 0.009, coastalTimberTex);
  const bottleGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.26, 14);
  for (const jx of [-0.4, 0.1, 0.6, 1.1]) {
    addBeachPart(juiceKioskGrp, bottleGeo, '#e2e8f0', [jx, 2.52, 0.25], [0, 0, 0], 0.006);
  }
  const fruitGeo = new THREE.SphereGeometry(0.085, 12, 10);
  for (const [trayX, fruitCol1, fruitCol2] of [
    [-0.25, '#f97316', '#facc15'],
    [0.75, '#84cc16', '#f59e0b'],
  ] as [number, string, string][]) {
    addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(0.82, 0.18, 0.48, 0.03, 2), '#c89d6c', [trayX, 1.44, 1.56], [0, 0, 0], 0.009, coastalTimberTex);
    addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(0.80, 0.26, 0.44, 0.04, 2), '#bae6fd', [trayX, 1.66, 1.56], [0, 0, 0], 0.007);
    for (let fx = -0.24; fx <= 0.25; fx += 0.16) {
      addBeachPart(juiceKioskGrp, fruitGeo, fx < 0 ? fruitCol1 : fruitCol2, [trayX + fx, 1.56, 1.56], [0, 0, 0], 0.005);
    }
  }
  addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(0.32, 0.26, 0.32, 0.04, 2), '#334155', [1.62, 1.50, 1.58], [0, 0, 0], 0.009);
  addBeachPart(juiceKioskGrp, new THREE.CylinderGeometry(0.13, 0.10, 0.36, 18), '#fb923c', [1.62, 1.81, 1.58], [0, 0, 0], 0.007);
  addBeachPart(juiceKioskGrp, makeBullnoseDiscGeo(0.14, 0.06, 18, 0.015), '#1e293b', [1.62, 2.02, 1.58], [0, 0, 0], 0.005);

  // Sculpted Round Wooden Bar Stools with Bullnose Tops & Tubular Torus Footrest Rings
  const barStoolTopGeo = makeBullnoseDiscGeo(0.30, 0.08, 24, 0.025);
  const barStoolLegGeo = new THREE.CylinderGeometry(0.032, 0.026, 0.78, 12);
  const barStoolRingGeo = new THREE.TorusGeometry(0.21, 0.022, 10, 24);
  barStoolRingGeo.rotateX(Math.PI / 2);
  for (const stoolX of [-1.85, -0.85]) {
    const stoolZ = 2.42;
    addBeachPart(juiceKioskGrp, barStoolTopGeo, '#c89d6c', [stoolX, 0.88, stoolZ], [0, 0, 0], 0.011, coastalTimberTex);
    for (const [lx, lz] of [
      [-0.16, -0.16],
      [0.16, -0.16],
      [-0.16, 0.16],
      [0.16, 0.16],
    ] as [number, number][]) {
      addBeachPart(
        juiceKioskGrp,
        barStoolLegGeo,
        COL_DRIFTWOOD_DARK,
        [stoolX + lx, 0.48, stoolZ + lz],
        [lz * 0.25, 0, -lx * 0.25],
        0.007,
        coastalTimberTex,
      );
    }
    addBeachPart(juiceKioskGrp, barStoolRingGeo, COL_DRIFTWOOD_DARK, [stoolX, 0.34, stoolZ], [0, 0, 0], 0.006);
  }

  // Hanging Green Coconuts & Woven Lathe Sun Hat
  const hangingCordGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.55, 10);
  const cocoSphereGeo = new THREE.SphereGeometry(0.15, 14, 12);
  for (const [hx, hz] of [
    [-2.56, 2.45],
    [2.52, 2.45],
  ] as [number, number][]) {
    addBeachPart(juiceKioskGrp, hangingCordGeo, '#a67b4e', [hx, 2.52, hz], [0, 0, 0], 0.006);
    for (const [cx, cy, cz] of [
      [-0.10, 2.22, 0.0],
      [0.10, 2.18, 0.08],
      [0.0, 2.04, -0.06],
    ] as [number, number, number][]) {
      addBeachPart(juiceKioskGrp, cocoSphereGeo, '#65a34e', [hx + cx, cy, hz + cz], [0, 0, 0], 0.009);
    }
  }
  const sunHatGeo = makeStrawSunHatGeo();
  sunHatGeo.userData.preserveCustomUv = true;
  addBeachPart(juiceKioskGrp, sunHatGeo, '#e6c88a', [2.44, 2.05, 1.88], [Math.PI / 2 - 0.15, 0, -0.2], 0.009);

  // Rounded Coconut Crates & Coconuts
  const crateBoxGeo = makeRoundedBoxGeo(1.08, 0.64, 0.82, 0.04, 2);
  const looseCocoGeo = new THREE.SphereGeometry(0.16, 14, 12);
  for (const [crateX, crateZ, crateRot] of [
    [2.05, 2.25, 0.08],
    [2.85, 1.45, -0.12],
  ] as [number, number, number][]) {
    addBeachPart(juiceKioskGrp, crateBoxGeo, '#b58858', [crateX, 0.44, crateZ], [0, crateRot, 0], 0.012, coastalTimberTex);
    for (const [ox, oy, oz] of [
      [-0.26, 0.82, -0.14],
      [0.02, 0.85, 0.12],
      [0.28, 0.80, -0.10],
      [-0.12, 0.96, 0.02],
      [0.18, 0.94, 0.06],
    ] as [number, number, number][]) {
      addBeachPart(juiceKioskGrp, looseCocoGeo, '#68a84f', [crateX + ox, oy, crateZ + oz], [0, 0, 0], 0.009);
    }
  }
  const strawGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.22, 8);
  for (const [lx, lz] of [
    [1.32, 2.42],
    [1.62, 2.56],
    [1.48, 2.24],
  ] as [number, number][]) {
    addBeachPart(juiceKioskGrp, looseCocoGeo, '#68a84f', [lx, 0.27, lz], [0, 0, 0], 0.009);
    addBeachPart(juiceKioskGrp, strawGeo, '#f8fafc', [lx + 0.03, 0.44, lz], [0.2, 0, -0.25], 0);
  }

  // Chamfered Coastal Roof Planes + Rounded Ridge Beam
  const kioskRoofOuterGeo = makeRoundedBoxGeo(KIOSK_W + 0.65, 0.14, 2.38, 0.035, 2);
  const kioskRoofSoffitGeo = makeRoundedBoxGeo(KIOSK_W + 0.55, 0.10, 2.32, 0.025, 2);
  for (const zSide of [-1, 1] as const) {
    addBeachPart(juiceKioskGrp, kioskRoofOuterGeo, '#6d9cb5', [0, KIOSK_WALL_H + 0.56, zSide * 1.02], [zSide * 0.38, 0, 0], 0.016);
    addBeachPart(juiceKioskGrp, kioskRoofSoffitGeo, COL_DRIFTWOOD, [0, KIOSK_WALL_H + 0.48, zSide * 1.02], [zSide * 0.38, 0, 0], 0.011, coastalTimberTex);
  }
  addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(KIOSK_W + 0.70, 0.16, 0.28, 0.045, 2), '#4c7c96', [0, KIOSK_WALL_H + 0.98, 0], [0, 0, 0], 0.013);

  // Continuous Curved Arched Awning + Continuous Extruded Scalloped Valance
  const mainAwningGeo = makeCurvedAwningShellGeo(KIOSK_W + 0.36, 1.82, 0.14, 0.065);
  addBeachPart(juiceKioskGrp, mainAwningGeo, '#ffffff', [0, 2.94, 2.40], [0.40, 0, 0], 0.015, coastalAwningTex);
  const mainValanceGeo = makeScallopedValanceCurtainGeo(KIOSK_W + 0.34, 0.34, 0.045, 12);
  addBeachPart(juiceKioskGrp, mainValanceGeo, '#ffffff', [0, 2.53, 3.22], [0.06, 0, 0], 0.011, coastalAwningTex);

  const awningStrutGeo = makeRoundedBoxGeo(0.10, 0.10, 1.38, 0.025, 2);
  for (const stX of [-2.36, 2.36]) {
    addBeachPart(juiceKioskGrp, awningStrutGeo, COL_DRIFTWOOD_DARK, [stX, 2.42, 2.28], [-0.58, 0, 0], 0.011, coastalTimberTex);
  }

  // =========================================================================
  // 5. SURFBOARD RENTAL RACK & SCULPTED ROUND-RAIL SURFBOARDS
  // =========================================================================
  const surfRackGrp = new THREE.Group();
  surfRackGrp.name = 'SurfboardRentalRackDisplay';
  surfRackGrp.position.set(83.8, BOARDWALK_Y, 49.5);
  surfRackGrp.rotation.y = Math.PI / 2 - 0.18;
  surfRackGrp.scale.setScalar(1.18);
  seBeachGroup.add(surfRackGrp);

  const rackSkidGeo = makeRoundedBoxGeo(0.24, 0.18, 1.48, 0.035, 2);
  const rackLegGeo = makeRoundedBoxGeo(0.18, 2.38, 0.18, 0.035, 2);
  for (const sx of [-1.95, 1.95]) {
    addBeachPart(surfRackGrp, rackSkidGeo, COL_DRIFTWOOD_DARK, [sx, 0.09, 0], [0, 0, 0], 0.012, coastalTimberTex);
    addBeachPart(surfRackGrp, rackLegGeo, COL_DRIFTWOOD, [sx, 1.24, 0.22], [-0.18, 0, 0], 0.014, coastalTimberTex);
    addBeachPart(surfRackGrp, rackLegGeo, COL_DRIFTWOOD, [sx, 1.24, -0.22], [0.18, 0, 0], 0.014, coastalTimberTex);
  }
  addBeachPart(surfRackGrp, makeRoundedBoxGeo(4.35, 0.14, 1.22, 0.032, 2), '#c89d6c', [0, 0.22, 0], [0, 0, 0], 0.014, coastalTimberTex);
  const rackXBraceGeo = makeRoundedBoxGeo(4.15, 0.14, 0.10, 0.025, 2);
  addBeachPart(surfRackGrp, rackXBraceGeo, COL_DRIFTWOOD_DARK, [0, 1.18, -0.26], [0.16, 0, 0.44], 0.012, coastalTimberTex);
  addBeachPart(surfRackGrp, rackXBraceGeo, COL_DRIFTWOOD_DARK, [0, 1.18, -0.26], [0.16, 0, -0.44], 0.012, coastalTimberTex);
  addBeachPart(surfRackGrp, makeRoundedBoxGeo(5.45, 0.16, 0.18, 0.035, 2), COL_DRIFTWOOD, [0, 1.98, 0.0], [0, 0, 0], 0.014, coastalTimberTex);

  const dividerPegGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.68, 14);
  for (let pIdx = 0; pIdx < 6; pIdx++) {
    addBeachPart(surfRackGrp, dividerPegGeo, COL_DRIFTWOOD_DARK, [-1.75 + pIdx * 0.70, 1.98, 0.28], [Math.PI / 2, 0, 0], 0.009, coastalTimberTex);
  }

  const surfboardsSpec: {
    x: number;
    h: number;
    w: number;
    mainCol: string;
    stripeCol: string;
    padCol: string;
    isSwallowTail?: boolean;
    hasWaveArt?: boolean;
  }[] = [
    { x: -1.40, h: 3.15, w: 0.56, mainCol: '#6ec4c8', stripeCol: '#f4d35e', padCol: '#e9c46a' },
    { x: -0.70, h: 3.10, w: 0.54, mainCol: '#f28b6d', stripeCol: '#f6a58c', padCol: '#c85a42' },
    { x: 0.00, h: 2.86, w: 0.52, mainCol: '#95d5b2', stripeCol: '#74c69d', padCol: '#2d3748' },
    { x: 0.70, h: 2.72, w: 0.55, mainCol: '#4a8ec2', stripeCol: '#90e0ef', padCol: '#1e293b', isSwallowTail: true },
    { x: 1.40, h: 2.68, w: 0.52, mainCol: '#f8fafc', stripeCol: '#38bdf8', padCol: '#3b82f6', hasWaveArt: true },
  ];

  const leashGeo = new THREE.TorusGeometry(0.14, 0.025, 10, 20);
  leashGeo.rotateX(Math.PI / 2);
  const finGeo = makeRoundedBoxGeo(0.03, 0.22, 0.16, 0.01, 1);

  for (const sb of surfboardsSpec) {
    const sbGrp = new THREE.Group();
    sbGrp.position.set(sb.x, 0.28, 0.22);
    sbGrp.rotation.x = -0.24;
    surfRackGrp.add(sbGrp);

    const boardGeo = makeSculptedSurfboardGeo(sb.w, sb.h, 0.056, sb.isSwallowTail);
    addBeachPart(sbGrp, boardGeo, sb.mainCol, [0, sb.h * 0.52 + 0.10, 0], [0, 0, 0], 0.014);
    addBeachPart(sbGrp, makeRoundedBoxGeo(sb.w * 0.28, sb.h * 0.78, 0.098, 0.015, 1), sb.stripeCol, [0, sb.h * 0.52 + 0.10, 0.006], [0, 0, 0], 0);
    if (sb.hasWaveArt) {
      addBeachPart(sbGrp, makeRoundedBoxGeo(sb.w * 0.62, sb.h * 0.34, 0.10, 0.02, 1), '#38bdf8', [0, sb.h * 0.32 + 0.10, 0.008], [0, 0, 0], 0);
    }
    addBeachPart(sbGrp, makeRoundedBoxGeo(sb.w * 0.50, 0.40, 0.04, 0.012, 1), sb.padCol, [0, 0.42, 0.048], [0, 0, 0], 0.007);
    for (const fx of [-0.12, 0.12]) {
      addBeachPart(sbGrp, finGeo, '#e2e8f0', [fx, 0.38, -0.08], [0.35, 0, 0], 0.007);
    }
    addBeachPart(surfRackGrp, leashGeo, '#1e293b', [sb.x + 0.08, 0.32, 0.36], [0, 0.3, 0], 0.006);
  }

  const signBoardGeo = makeRoundedBoxGeo(0.72, 0.42, 0.06, 0.016, 2);
  signBoardGeo.userData.preserveCustomUv = true;
  const signWireGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.26, 8);
  for (const signSideX of [-2.42, 2.42]) {
    addBeachPart(surfRackGrp, signWireGeo, '#876139', [signSideX - 0.18, 1.82, 0], [0, 0, 0], 0);
    addBeachPart(surfRackGrp, signWireGeo, '#876139', [signSideX + 0.18, 1.82, 0], [0, 0, 0], 0);
    addBeachPart(surfRackGrp, signBoardGeo, '#ffffff', [signSideX, 1.52, 0], [0, 0, 0], 0.011, surfSignTex);
  }

  addBeachPart(surfRackGrp, makeRoundedBoxGeo(0.38, 0.32, 0.36, 0.035, 2), '#b58858', [2.15, 1.18, 0.12], [0, 0, 0], 0.011, coastalTimberTex);
  const waxGeo = makeRoundedBoxGeo(0.14, 0.16, 0.14, 0.02, 1);
  addBeachPart(surfRackGrp, waxGeo, '#fde047', [2.12, 1.38, 0.08], [0, 0.2, 0], 0.007);
  addBeachPart(surfRackGrp, waxGeo, '#38bdf8', [2.22, 1.38, 0.18], [0, -0.2, 0], 0.007);

  const buoyGrp = new THREE.Group();
  buoyGrp.position.set(2.26, 0.85, 0.26);
  buoyGrp.rotation.y = 0.25;
  surfRackGrp.add(buoyGrp);
  addBeachPart(buoyGrp, new THREE.TorusGeometry(0.36, 0.11, 14, 24), '#f8fafc', [0, 0, 0], [0, 0, 0], 0.012);
  const buoyBandGeo = new THREE.CylinderGeometry(0.118, 0.118, 0.18, 14);
  for (const [bx, by, rotZ] of [
    [0, 0.36, 0],
    [0, -0.36, 0],
    [0.36, 0, Math.PI / 2],
    [-0.36, 0, Math.PI / 2],
  ] as [number, number, number][]) {
    addBeachPart(buoyGrp, buoyBandGeo, '#ef4444', [bx, by, 0], [0, 0, rotZ + Math.PI / 2], 0);
  }

  // =========================================================================
  // 6. LIFEGUARD WATCHTOWER, RESORT SUN LOUNGERS & SCULPTED ADIRONDACK BEACH CHAIRS
  // =========================================================================
  const lifeguardGrp = new THREE.Group();
  lifeguardGrp.name = 'CoastalLifeguardWatchtower';
  lifeguardGrp.position.set(100.5, 0.0, 67.5);
  lifeguardGrp.rotation.y = Math.PI / 2;
  lifeguardGrp.scale.setScalar(1.58);
  seBeachGroup.add(lifeguardGrp);

  const lgStiltGeo = makeRoundedBoxGeo(0.20, 2.35, 0.20, 0.035, 2);
  for (const lx of [-0.95, 0.95]) {
    for (const lz of [-0.95, 0.95]) {
      addBeachPart(lifeguardGrp, lgStiltGeo, COL_DRIFTWOOD, [lx, 1.15, lz], [lz * 0.08, 0, -lx * 0.08], 0.014, coastalTimberTex);
    }
  }
  const lgBraceGeo = makeRoundedBoxGeo(2.15, 0.12, 0.10, 0.02, 2);
  for (const sideZ of [-0.95, 0.95]) {
    addBeachPart(lifeguardGrp, lgBraceGeo, COL_DRIFTWOOD_DARK, [0, 1.18, sideZ], [0, 0, 0.68], 0.011, coastalTimberTex);
    addBeachPart(lifeguardGrp, lgBraceGeo, COL_DRIFTWOOD_DARK, [0, 1.18, sideZ], [0, 0, -0.68], 0.011, coastalTimberTex);
  }
  addBeachPart(lifeguardGrp, makeRoundedBoxGeo(2.85, 0.16, 2.95, 0.04, 2), '#c89d6c', [0, 2.28, 0.10], [0, 0, 0], 0.016, coastalTimberTex);
  addBeachPart(lifeguardGrp, makeRoundedBoxGeo(2.82, 0.08, 0.10, 0.025, 2), '#f5efe4', [0, 3.05, 1.50], [0, 0, 0], 0.011);
  const lgRailGeo = makeRoundedBoxGeo(0.10, 0.08, 2.85, 0.025, 2);
  const lgRailPostGeo = makeRoundedBoxGeo(0.12, 0.78, 0.12, 0.025, 2);
  for (const rx of [-1.35, 1.35]) {
    addBeachPart(lifeguardGrp, lgRailGeo, '#f5efe4', [rx, 3.05, 0.10], [0, 0, 0], 0.011);
    addBeachPart(lifeguardGrp, lgRailPostGeo, COL_DRIFTWOOD, [rx, 2.68, 1.48], [0, 0, 0], 0.009, coastalTimberTex);
  }
  addBeachPart(lifeguardGrp, makeRoundedBoxGeo(1.95, 2.05, 1.95, 0.04, 2), '#f5efe4', [0, 3.38, -0.18], [0, 0, 0], 0.016, coastalWeatherboardTex);
  addBeachPart(lifeguardGrp, makeRoundedBoxGeo(2.02, 0.68, 2.02, 0.035, 2), '#38485c', [0, 3.68, -0.18], [0, 0, 0], 0.011);
  const lgRoofPanelGeo = makeRoundedBoxGeo(2.55, 0.12, 1.55, 0.03, 2);
  for (const rSide of [-1, 1] as const) {
    addBeachPart(lifeguardGrp, lgRoofPanelGeo, '#5aa7c7', [0, 4.56, -0.18 + rSide * 0.62], [rSide * 0.42, 0, 0], 0.014);
  }
  addBeachPart(lifeguardGrp, makeRoundedBoxGeo(2.60, 0.12, 0.20, 0.04, 2), '#3d7e9e', [0, 4.86, -0.18], [0, 0, 0], 0.012);

  const lgLadderRailGeo = makeRoundedBoxGeo(0.10, 2.85, 0.14, 0.025, 2);
  const lgLadderStepGeo = makeRoundedBoxGeo(0.78, 0.07, 0.18, 0.022, 2);
  for (const railX of [-0.42, 0.42]) {
    addBeachPart(lifeguardGrp, lgLadderRailGeo, COL_DRIFTWOOD, [railX, 1.18, 2.15], [-0.58, 0, 0], 0.011, coastalTimberTex);
  }
  for (let step = 0; step < 6; step++) {
    addBeachPart(lifeguardGrp, lgLadderStepGeo, '#c89d6c', [0, 0.34 + step * 0.34, 2.82 - step * 0.23], [0, 0, 0], 0.009, coastalTimberTex);
  }
  const torpedoBuoyGeo = makeTorpedoRescueBuoyGeo();
  torpedoBuoyGeo.userData.preserveCustomUv = true;
  addBeachPart(lifeguardGrp, torpedoBuoyGeo, '#ef4444', [1.44, 2.75, 0.45], [0.35, 0, 0], 0.009);

  // 6B. Resort Slatted Teak Sun Loungers (`beach_lounger_1..7`) — preserves bed top y_local = 0.39 (world 0.741m)
  const loungerRailGeo = makeRoundedBoxGeo(0.09, 0.10, 1.48, 0.025, 2);
  const loungerBedSlatGeo = makeRoundedBoxGeo(0.115, 0.08, 1.44, 0.022, 2);
  const loungerCrossBeamGeo = makeRoundedBoxGeo(0.84, 0.07, 0.09, 0.02, 2);
  const loungerBackRailGeo = makeRoundedBoxGeo(0.08, 0.08, 0.86, 0.022, 2);
  const loungerBackSlatGeo = makeRoundedBoxGeo(0.115, 0.06, 0.82, 0.018, 2);
  const loungerBackCapGeo = makeRoundedBoxGeo(0.86, 0.08, 0.09, 0.028, 2);
  const loungerLegGeo = makeRoundedBoxGeo(0.09, 0.32, 0.09, 0.022, 2);
  const loungerWheelRimGeo = makeBullnoseDiscGeo(0.13, 0.055, 20, 0.015);
  const loungerWheelHubGeo = makeBullnoseDiscGeo(0.045, 0.068, 14, 0.01);

  const buildTimberSunLounger = (wx: number, wz: number, rotY: number) => {
    const lGrp = new THREE.Group();
    lGrp.position.set(wx, 0.04, wz);
    lGrp.rotation.y = rotY;
    lGrp.scale.setScalar(1.798);
    seBeachGroup.add(lGrp);

    // Side rails & cross-bearers
    for (const rx of [-0.395, 0.395]) {
      addBeachPart(lGrp, loungerRailGeo, '#b68959', [rx, 0.34, 0.25], [0, 0, 0], 0.011, coastalTimberTex);
    }
    for (const cz of [-0.42, 0.24, 0.90]) {
      addBeachPart(lGrp, loungerCrossBeamGeo, COL_DRIFTWOOD_DARK, [0, 0.305, cz], [0, 0, 0], 0.008, coastalTimberTex);
    }
    // 5 rounded-edge longitudinal bed slats (top surface flush at y_local = 0.39 -> world 0.741m)
    for (let i = 0; i < 5; i++) {
      const sx = -0.26 + i * 0.13;
      addBeachPart(lGrp, loungerBedSlatGeo, '#cfa576', [sx, 0.35, 0.25], [0, 0, 0], 0.009, coastalTimberTex);
    }
    // Articulated reclined backrest (`rx = +0.68` preserved)
    const backGrp = new THREE.Group();
    backGrp.position.set(0, 0.62, -0.76);
    backGrp.rotation.x = 0.68;
    lGrp.add(backGrp);
    for (const rx of [-0.39, 0.39]) {
      addBeachPart(backGrp, loungerBackRailGeo, '#b68959', [rx, 0, 0], [0, 0, 0], 0.010, coastalTimberTex);
    }
    addBeachPart(backGrp, loungerBackCapGeo, '#b68959', [0, 0, -0.41], [0, 0, 0], 0.010, coastalTimberTex);
    for (let i = 0; i < 5; i++) {
      const sx = -0.26 + i * 0.13;
      addBeachPart(backGrp, loungerBackSlatGeo, '#d5af80', [sx, 0.01, 0], [0, 0, 0], 0.008, coastalTimberTex);
    }
    // 4 chamfered legs + turned wooden rear wheels with bronze axle caps
    for (const lx of [-0.38, 0.38]) {
      addBeachPart(lGrp, loungerLegGeo, COL_DRIFTWOOD_DARK, [lx, 0.16, 0.82], [0, 0, 0], 0.008, coastalTimberTex);
      addBeachPart(lGrp, loungerLegGeo, COL_DRIFTWOOD_DARK, [lx, 0.16, -0.52], [0, 0, 0], 0.008, coastalTimberTex);
      const wxOff = lx + (lx < 0 ? -0.065 : 0.065);
      addBeachPart(lGrp, loungerWheelRimGeo, COL_DRIFTWOOD_DARK, [wxOff, 0.14, -0.68], [0, 0, Math.PI / 2], 0.008, coastalTimberTex);
      addBeachPart(lGrp, loungerWheelHubGeo, '#475569', [wxOff, 0.14, -0.68], [0, 0, Math.PI / 2], 0.006);
    }
  };

  // 6C. Sculpted Coastal Adirondack Beach Chairs (`beach_chair_1..4`) — preserves seat top center 0.768m
  const adSeatSlatGeo = makeRoundedBoxGeo(0.76, 0.065, 0.125, 0.02, 2);
  const adSeatSideRailGeo = makeRoundedBoxGeo(0.06, 0.08, 0.72, 0.02, 2);
  const adArmBracketGeo = makeRoundedBoxGeo(0.08, 0.14, 0.18, 0.025, 2);
  const adFrontLegGeo = makeRoundedBoxGeo(0.09, 0.52, 0.12, 0.025, 2);
  const adRearLegGeo = makeRoundedBoxGeo(0.09, 0.38, 0.14, 0.025, 2);
  const adBackCrossGeo = makeRoundedBoxGeo(0.72, 0.07, 0.07, 0.02, 2);
  const adLeftArmGeo = makeAdirondackPaddleArmGeo(false);
  const adRightArmGeo = makeAdirondackPaddleArmGeo(true);
  const adBackSlatHeights = [0.78, 0.86, 0.90, 0.86, 0.78] as const;
  const adBackSlatGeos = adBackSlatHeights.map((h) => makeRoundedBoxGeo(0.125, h, 0.055, 0.02, 2));

  const buildAdirondackBeachChair = (wx: number, wz: number, rotY: number) => {
    const aGrp = new THREE.Group();
    aGrp.position.set(wx, 0.04, wz);
    aGrp.rotation.y = rotY;
    aGrp.scale.setScalar(1.798);
    seBeachGroup.add(aGrp);

    // 5 contoured tilted seat slats inside seat frame (exact center top = 0.36 + 0.045 preserved)
    const seatGrp = new THREE.Group();
    seatGrp.position.set(0, 0.36, 0.05);
    seatGrp.rotation.x = -0.18;
    aGrp.add(seatGrp);
    for (const rx of [-0.36, 0.36]) {
      addBeachPart(seatGrp, adSeatSideRailGeo, COL_DRIFTWOOD_DARK, [rx, -0.01, 0], [0, 0, 0], 0.008, coastalTimberTex);
    }
    for (let i = 0; i < 5; i++) {
      const sz = -0.28 + i * 0.14;
      const crownDrop = i === 0 ? 0.01 : i === 4 ? -0.005 : 0;
      addBeachPart(seatGrp, adSeatSlatGeo, '#c89d6c', [0, 0.012 + crownDrop, sz], [0, 0, 0], 0.009, coastalTimberTex);
    }

    // 5 Fanned & Arched-Crown Backrest Slats (`rx = -0.32` preserved)
    const backGrp = new THREE.Group();
    backGrp.position.set(0, 0.76, -0.28);
    backGrp.rotation.x = -0.32;
    aGrp.add(backGrp);
    addBeachPart(backGrp, adBackCrossGeo, COL_DRIFTWOOD_DARK, [0, -0.26, -0.025], [0, 0, 0], 0.008, coastalTimberTex);
    addBeachPart(backGrp, adBackCrossGeo, COL_DRIFTWOOD_DARK, [0, 0.16, -0.025], [0, 0, 0], 0.008, coastalTimberTex);
    for (let i = 0; i < 5; i++) {
      const fanOffset = (i - 2) * 0.142;
      const fanRoll = -(i - 2) * 0.048;
      const h = adBackSlatHeights[i];
      addBeachPart(
        backGrp,
        adBackSlatGeos[i],
        '#cfa576',
        [fanOffset, (h - 0.88) * 0.5, 0.012],
        [0, 0, fanRoll],
        0.009,
        coastalTimberTex,
      );
    }

    // Wide Contoured Paddle Armrests + Under-arm Corbels + Chamfered Splayed Legs
    addBeachPart(aGrp, adLeftArmGeo, '#b58858', [-0.42, 0.56, 0.04], [0, 0, 0], 0.009, coastalTimberTex);
    addBeachPart(aGrp, adRightArmGeo, '#b58858', [0.42, 0.56, 0.04], [0, 0, 0], 0.009, coastalTimberTex);
    for (const ax of [-0.42, 0.42]) {
      addBeachPart(aGrp, adArmBracketGeo, COL_DRIFTWOOD_DARK, [ax, 0.49, 0.25], [0.25, 0, 0], 0.007, coastalTimberTex);
      addBeachPart(aGrp, adFrontLegGeo, COL_DRIFTWOOD_DARK, [ax, 0.28, 0.32], [0, 0, 0], 0.008, coastalTimberTex);
      addBeachPart(aGrp, adRearLegGeo, COL_DRIFTWOOD_DARK, [ax, 0.20, -0.28], [0.35, 0, 0], 0.008, coastalTimberTex);
    }
  };

  // Placements matching world colliders and seat interaction spots
  buildTimberSunLounger(100.2, 54.0, Math.PI / 2 - 0.12);
  buildTimberSunLounger(100.2, 57.2, Math.PI / 2 - 0.08);
  buildTimberSunLounger(100.2, 60.4, Math.PI / 2 - 0.05);
  buildTimberSunLounger(101.0, 77.5, Math.PI / 2 + 0.08);
  buildTimberSunLounger(101.0, 80.8, Math.PI / 2 + 0.12);
  buildTimberSunLounger(100.2, 91.5, Math.PI / 2 - 0.10);
  buildTimberSunLounger(100.2, 94.8, Math.PI / 2 - 0.06);

  buildAdirondackBeachChair(96.2, 81.8, Math.PI / 2 + 0.15);
  buildAdirondackBeachChair(96.2, 85.0, Math.PI / 2 + 0.05);
  buildAdirondackBeachChair(96.2, 88.2, Math.PI / 2 - 0.10);
  buildAdirondackBeachChair(97.5, 49.5, Math.PI / 2 - 0.20);

  return {
    seBeachGroup,
    beachPergolaGrp,
    showerStationGrp,
    juiceKioskGrp,
    boardwalkY: BOARDWALK_Y,
    coastalTimberTex,
    addBeachPart,
  };
}
