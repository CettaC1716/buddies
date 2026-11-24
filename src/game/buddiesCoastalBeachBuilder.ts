import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BEACHFRONT_STILT_CABIN_SPEC } from './buddiesPlanetCurvature';

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

function makeFallbackDataTex(
  r: number,
  g: number,
  b: number,
  a = 255,
  colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace,
): THREE.DataTexture {
  const data = new Uint8Array([r, g, b, a]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.colorSpace = colorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function finalizeCoastalTex(
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

export interface PbrTextureTriplet {
  map: THREE.Texture;
  bumpMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

export type PbrTimberVariant =
  | 'coastal_oak'
  | 'boardwalk_deck'
  | 'cabin_cedar'
  | 'galleon_hull'
  | 'pastel_blue_door'
  | 'weatherboard';

const PBR_SIN_LUT_SIZE = 1024;
const PBR_SIN_LUT = (() => {
  const arr = new Float32Array(PBR_SIN_LUT_SIZE);
  for (let i = 0; i < PBR_SIN_LUT_SIZE; i++) {
    arr[i] = Math.sin((i / PBR_SIN_LUT_SIZE) * Math.PI * 2);
  }
  return arr;
})();

function fastLutSin(turns: number): number {
  const idx = ((turns * PBR_SIN_LUT_SIZE) % PBR_SIN_LUT_SIZE + PBR_SIN_LUT_SIZE) & (PBR_SIN_LUT_SIZE - 1);
  return PBR_SIN_LUT[idx];
}

function hash2dPeriodic(ix: number, iy: number, px: number, py: number, seed: number): number {
  const wx = ((ix % px) + px) % px;
  const wy = ((iy % py) + py) % py;
  let h = (wx * 374761393 + wy * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothNoise2dPeriodic(u: number, v: number, px: number, py: number, seed: number): number {
  const x = u * px;
  const y = v * py;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const n00 = hash2dPeriodic(x0, y0, px, py, seed);
  const n10 = hash2dPeriodic(x0 + 1, y0, px, py, seed);
  const n01 = hash2dPeriodic(x0, y0 + 1, px, py, seed);
  const n11 = hash2dPeriodic(x0 + 1, y0 + 1, px, py, seed);
  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

function clampByte(v: number): number {
  return v <= 0 ? 0 : v >= 255 ? 255 : v | 0;
}

function smoothstep01(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

export const SHARED_PBR_WOOD_LIGHTING_UNIFORM = {
  uWoodFillScale: { value: 1.0 },
};

const pbrWoodWarmFillCacheKey = () => 'pbr-wood-warm-fill-v1';

function applyPbrWoodWarmFillCompile(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.uniforms.uWoodFillScale = SHARED_PBR_WOOD_LIGHTING_UNIFORM.uWoodFillScale;
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uWoodFillScale;')
    .replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
vec3 woodWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
float wHemi = clamp( woodWorldNormal.y * 0.5 + 0.5, 0.0, 1.0 );
vec3 warmSandyBounce = mix( vec3( 0.36, 0.25, 0.18 ), vec3( 0.32, 0.29, 0.24 ), wHemi );
reflectedLight.indirectDiffuse += diffuseColor.rgb * warmSandyBounce * uWoodFillScale;`,
    );
}

/**
 * Shared `THREE.MeshStandardMaterial` cache keyed by `(colorHex, map.uuid, bumpMap.uuid, roughness)`
 * (+ roughnessMap/bumpScale/metalness/side) so `bakeStaticGroupMeshes` merges wooden components
 * into minimal GPU draw calls while preserving real-time PBR bump/roughness & shadows.
 */
export function getOrCreatePbrWoodMaterial(
  cache: Map<string, THREE.MeshStandardMaterial>,
  opts: {
    colorHex?: string;
    textures: PbrTextureTriplet;
    roughness?: number;
    bumpScale?: number;
    metalness?: number;
    side?: THREE.Side;
    vertexColors?: boolean;
  },
): THREE.MeshStandardMaterial {
  const vertexColors = opts.vertexColors ?? false;
  const colorHex = vertexColors ? '#ffffff' : (opts.colorHex ?? '#ffffff').toLowerCase();
  const roughness = opts.roughness ?? 0.88;
  const bumpScale = opts.bumpScale ?? 0.032;
  const metalness = opts.metalness ?? 0.02;
  const side = opts.side ?? THREE.FrontSide;
  const key = `${colorHex}_${opts.textures.map.uuid}_${opts.textures.bumpMap.uuid}_${opts.textures.roughnessMap.uuid}_${roughness.toFixed(3)}_${bumpScale.toFixed(4)}_${metalness.toFixed(3)}_${side}_${vertexColors ? 1 : 0}`;
  let mat = cache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      map: opts.textures.map,
      bumpMap: opts.textures.bumpMap,
      bumpScale,
      roughnessMap: opts.textures.roughnessMap,
      roughness,
      metalness,
      vertexColors,
      fog: true,
      side,
    });
    mat.customProgramCacheKey = pbrWoodWarmFillCacheKey;
    mat.onBeforeCompile = applyPbrWoodWarmFillCompile;
    mat.userData.isPbrWoodMaterial = true;
    cache.set(key, mat);
  }
  return mat;
}

/**
 * High-resolution 1:1 UV-locked procedural timber PBR texture generator (`1024x512` / `1024x1024`)
 * outputting synchronized:
 *  - `map`: Sun-baked warm coastal oak / cedar / driftwood / mahogany / pastel-blue painted timber
 *  - `bumpMap`: Chamfered bevel plank grooves, multi-octave curved grain relief, knots & countersunk nails
 *  - `roughnessMap`: Matte tongue-and-groove crevices (`0.94+`) vs warm satin-matte board surfaces (`0.72–0.84`)
 */
export function createPbrTimberTextureSet(variant: PbrTimberVariant): PbrTextureTriplet {
  const isSquare = variant !== 'coastal_oak';
  const width = variant === 'pastel_blue_door' ? 512 : 1024;
  const height = variant === 'pastel_blue_door' ? 512 : isSquare ? 1024 : 512;

  if (typeof document === 'undefined') {
    const fallbackRgb: Record<PbrTimberVariant, [number, number, number]> = {
      coastal_oak: [228, 189, 139],
      boardwalk_deck: [228, 189, 139],
      cabin_cedar: [214, 157, 119],
      galleon_hull: [198, 138, 93],
      pastel_blue_door: [104, 154, 194],
      weatherboard: [232, 222, 206],
    };
    const [r, g, b] = fallbackRgb[variant];
    return {
      map: makeFallbackDataTex(r, g, b, 255, THREE.SRGBColorSpace),
      bumpMap: makeFallbackDataTex(180, 180, 180, 255, THREE.NoColorSpace),
      roughnessMap: makeFallbackDataTex(204, 204, 204, 255, THREE.NoColorSpace),
    };
  }

  const albedoPair = makeCanvas2d(width, height);
  const bumpPair = makeCanvas2d(width, height);
  const roughPair = makeCanvas2d(width, height);
  if (!albedoPair.canvas || !albedoPair.ctx || !bumpPair.canvas || !bumpPair.ctx || !roughPair.canvas || !roughPair.ctx) {
    return {
      map: makeFallbackDataTex(228, 189, 139, 255, THREE.SRGBColorSpace),
      bumpMap: makeFallbackDataTex(180, 180, 180, 255, THREE.NoColorSpace),
      roughnessMap: makeFallbackDataTex(204, 204, 204, 255, THREE.NoColorSpace),
    };
  }

  const albedoImg = albedoPair.ctx.createImageData(width, height);
  const bumpImg = bumpPair.ctx.createImageData(width, height);
  const roughImg = roughPair.ctx.createImageData(width, height);
  if (!albedoImg?.data || !bumpImg?.data || !roughImg?.data) {
    return {
      map: makeFallbackDataTex(228, 189, 139, 255, THREE.SRGBColorSpace),
      bumpMap: makeFallbackDataTex(180, 180, 180, 255, THREE.NoColorSpace),
      roughnessMap: makeFallbackDataTex(204, 204, 204, 255, THREE.NoColorSpace),
    };
  }

  const tonesByVariant: Record<PbrTimberVariant, readonly [number, number, number][]> = {
    coastal_oak: [
      [232, 192, 142],
      [224, 184, 134],
      [238, 200, 148],
      [218, 178, 128],
      [228, 189, 139],
      [222, 182, 132],
    ],
    boardwalk_deck: [
      [234, 196, 146],
      [220, 180, 130],
      [240, 204, 154],
      [212, 172, 122],
      [229, 190, 140],
      [224, 184, 134],
      [238, 200, 150],
      [216, 176, 126],
    ],
    cabin_cedar: [
      [214, 154, 116],
      [204, 144, 108],
      [224, 166, 128],
      [196, 136, 100],
      [218, 160, 122],
    ],
    galleon_hull: [
      [200, 140, 94],
      [192, 133, 88],
      [210, 150, 104],
      [186, 128, 84],
      [196, 137, 92],
    ],
    pastel_blue_door: [
      [104, 154, 194],
      [96, 146, 186],
      [110, 160, 200],
      [92, 140, 180],
    ],
    weatherboard: [
      [234, 224, 208],
      [226, 216, 198],
      [238, 229, 214],
      [222, 212, 194],
    ],
  };

  const rows =
    variant === 'boardwalk_deck'
      ? 16
      : variant === 'galleon_hull'
        ? 14
        : variant === 'pastel_blue_door'
          ? 6
          : 10;
  const rowH = height / rows;
  const palette = tonesByVariant[variant];
  const isLapSiding = variant === 'cabin_cedar' || variant === 'weatherboard';
  const isPainted = variant === 'pastel_blue_door' || variant === 'weatherboard';
  const hasButtJoints = !isLapSiding && variant !== 'pastel_blue_door';
  const hasKnots = !isPainted;

  const rowParams = Array.from({ length: rows }, (_, r) => {
    const buttU1 = ((r * 293 + 117) % 740 + 130) / 1024;
    const buttU2 = (buttU1 + 0.5) % 1.0;
    const knotU = ((r * 419 + 193) % 760 + 130) / 1024;
    const knotFracY = 0.28 + ((r * 37) % 44) / 100;
    const tone = palette[r % palette.length];
    return {
      buttPx1: buttU1 * width,
      buttPx2: buttU2 * width,
      knotPx: knotU * width,
      knotPy: knotFracY * rowH,
      hasKnot: hasKnots && r % 2 === 1,
      tone,
      phase: r * 1.37 + (variant.length * 0.41),
      freq: 5.5 + (r % 4) * 1.4,
    };
  });

  const aData = albedoImg.data;
  const bData = bumpImg.data;
  const rData = roughImg.data;

  for (let py = 0; py < height; py++) {
    const rowFloat = (py / height) * rows;
    const rIdx = Math.min(rows - 1, rowFloat | 0);
    const rp = rowParams[rIdx];
    const rowY = py - rIdx * rowH;
    const rowFrac = rowY / rowH;

    // Distance in pixels to top/bottom horizontal groove
    const dTop = rowY;
    const dBot = rowH - rowY;
    const dHoriz = dTop < dBot ? dTop : dBot;

    for (let px = 0; px < width; px++) {
      const u = px / width;
      const v = py / height;

      // Determine plank segment along X for staggered butt-joint tone shifts
      let dButt = 9999;
      let segMod = 1.0;
      if (hasButtJoints) {
        const d1 = Math.min(Math.abs(px - rp.buttPx1), width - Math.abs(px - rp.buttPx1));
        const d2 = Math.min(Math.abs(px - rp.buttPx2), width - Math.abs(px - rp.buttPx2));
        dButt = d1 < d2 ? d1 : d2;
        const inSegB =
          rp.buttPx1 < rp.buttPx2
            ? px >= rp.buttPx1 && px < rp.buttPx2
            : px >= rp.buttPx1 || px < rp.buttPx2;
        segMod = inSegB ? 0.975 : 1.02;
      }

      const dGroove = dHoriz < dButt ? dHoriz : dButt;

      // Multi-octave organic curved grain + knot flow deflection
      const macroWarp =
        smoothNoise2dPeriodic(u, v, 6, 12, 11) * 0.42 +
        smoothNoise2dPeriodic(u, v, 14, 24, 29) * 0.16;
      let knotDeflect = 0;
      let knotCoreDarken = 0;
      let knotBumpDip = 0;
      let knotRoughAdd = 0;

      if (rp.hasKnot) {
        let dxk = px - rp.knotPx;
        if (dxk > width * 0.5) dxk -= width;
        if (dxk < -width * 0.5) dxk += width;
        const dyk = rowY - rp.knotPy;
        const ellipDist = Math.hypot(dxk * 0.24, dyk * 1.15);
        if (ellipDist < 22) {
          const kEnv = 1.0 - ellipDist / 22;
          const kEnvSq = kEnv * kEnv;
          knotDeflect = (dyk >= 0 ? 1 : -1) * kEnvSq * 0.55;
          knotCoreDarken = kEnvSq * (ellipDist < 7 ? 0.14 : 0.07);
          knotBumpDip = kEnvSq * 0.10;
          knotRoughAdd = kEnvSq * 0.05;
        }
      }

      const grainArg = rowFrac * rp.freq + macroWarp * 1.9 + knotDeflect + rp.phase;
      const ringWave = fastLutSin(grainArg * 0.55) * 0.5 + 0.5;
      const fineFiber = smoothNoise2dPeriodic(u, v, 48, 120, 47);
      const grainContrast = isPainted ? 0.05 : 0.10;
      const grainShade =
        1.0 + (ringWave - 0.5) * grainContrast + (fineFiber - 0.5) * (isPainted ? 0.04 : 0.06);

      // Chamfer bevel & groove profile + lap siding shadow
      let bevelAlbedo = 1.0;
      let baseBump = 0.86 + (ringWave - 0.5) * 0.055 + (fineFiber - 0.5) * 0.03;
      let baseRough = isPainted ? 0.82 : 0.82 + (ringWave - 0.5) * 0.04 + (fineFiber - 0.5) * 0.03;

      if (isLapSiding) {
        // Horizontal clapboard profile: subtle upper tuck, warm belly, soft lower shadow overhang
        if (rowFrac > 0.88) {
          const dropT = (rowFrac - 0.88) / 0.12;
          bevelAlbedo = 1.0 - dropT * 0.22;
          baseBump = 0.88 * (1.0 - dropT * 0.48);
          baseRough = 0.83 + dropT * 0.11;
        } else if (rowFrac < 0.10) {
          const topT = rowFrac / 0.10;
          bevelAlbedo = 0.88 + topT * 0.12;
          baseBump = 0.56 + topT * 0.30;
          baseRough = 0.88 - topT * 0.06;
        } else {
          // Subtle upward tilt luminance gradient on lap face
          bevelAlbedo = 1.02 - rowFrac * 0.03;
          baseBump = 0.76 + rowFrac * 0.14;
        }
      } else {
        // Chamfered tongue-and-groove planks with warm golden-brown seams
        if (dGroove < 2.2) {
          const gT = dGroove / 2.2;
          bevelAlbedo = 0.70 + gT * 0.16;
          baseBump = 0.42 + gT * 0.22;
          baseRough = 0.93 - gT * 0.03;
        } else if (dGroove < 6.5) {
          const bT = smoothstep01(2.2, 6.5, dGroove);
          const edgeRim = dHoriz < 6.5 && dTop < dBot ? 1.04 : 0.96;
          bevelAlbedo = 0.86 + (edgeRim - 0.86) * bT;
          baseBump = 0.64 + (0.86 - 0.64) * bT;
          baseRough = 0.90 - (0.90 - baseRough) * bT;
        } else if (rowFrac < 0.14) {
          bevelAlbedo = 1.03;
        } else if (rowFrac > 0.88) {
          bevelAlbedo = 0.96;
        }
      }

      // Subtle countersunk fastener nail heads near butt joints & mid-joists
      let nailDark = 1.0;
      if (hasButtJoints) {
        const nailY1 = rowH * 0.28;
        const nailY2 = rowH * 0.72;
        const dyN = Math.min(Math.abs(rowY - nailY1), Math.abs(rowY - nailY2));
        if (dyN < 3.6) {
          const joistX1 = (rp.buttPx1 + width * 0.25) % width;
          const joistX2 = (rp.buttPx1 + width * 0.75) % width;
          const dxN = Math.min(
            Math.abs(px - (rp.buttPx1 - 10)),
            Math.abs(px - (rp.buttPx1 + 10)),
            Math.abs(px - (rp.buttPx2 - 10)),
            Math.abs(px - (rp.buttPx2 + 10)),
            Math.abs(px - joistX1),
            Math.abs(px - joistX2),
          );
          if (dxN < 3.6) {
            const nr = Math.hypot(dxN, dyN);
            if (nr < 2.2) {
              nailDark = 0.78;
              baseBump = 0.58;
              baseRough = 0.76;
            } else if (nr < 3.5) {
              nailDark = 0.88;
              baseBump *= 0.82;
            }
          }
        }
      }

      const finalShade = grainShade * bevelAlbedo * segMod * (1.0 - knotCoreDarken) * nailDark;
      const outIdx = (py * width + px) * 4;

      aData[outIdx] = clampByte(rp.tone[0] * finalShade);
      aData[outIdx + 1] = clampByte(rp.tone[1] * finalShade);
      aData[outIdx + 2] = clampByte(rp.tone[2] * finalShade);
      aData[outIdx + 3] = 255;

      const bumpByte = clampByte((baseBump - knotBumpDip) * 255);
      bData[outIdx] = bumpByte;
      bData[outIdx + 1] = bumpByte;
      bData[outIdx + 2] = bumpByte;
      bData[outIdx + 3] = 255;

      const roughByte = clampByte((baseRough + knotRoughAdd) * 255);
      rData[outIdx] = roughByte;
      rData[outIdx + 1] = roughByte;
      rData[outIdx + 2] = roughByte;
      rData[outIdx + 3] = 255;
    }
  }

  albedoPair.ctx.putImageData(albedoImg, 0, 0);
  bumpPair.ctx.putImageData(bumpImg, 0, 0);
  roughPair.ctx.putImageData(roughImg, 0, 0);

  return {
    map: finalizeCoastalTex(albedoPair.canvas, THREE.RepeatWrapping, THREE.RepeatWrapping, THREE.SRGBColorSpace),
    bumpMap: finalizeCoastalTex(bumpPair.canvas, THREE.RepeatWrapping, THREE.RepeatWrapping, THREE.NoColorSpace),
    roughnessMap: finalizeCoastalTex(roughPair.canvas, THREE.RepeatWrapping, THREE.RepeatWrapping, THREE.NoColorSpace),
  };
}

/**
 * Stepped Terracotta-Cedar Wood Shingle Roof PBR Texture Set (`1024x1024`):
 * Staggered split-cedar shingles in warm terracotta/burnt-sienna tones with vertical wood grain,
 * crisp split gaps, and deep stepped horizontal overlap shadows (`bumpMap` + `roughnessMap`).
 */
export function createPbrTerracottaShingleTextures(): PbrTextureTriplet {
  const size = 1024;
  if (typeof document === 'undefined') {
    return {
      map: makeFallbackDataTex(211, 146, 107, 255, THREE.SRGBColorSpace),
      bumpMap: makeFallbackDataTex(180, 180, 180, 255, THREE.NoColorSpace),
      roughnessMap: makeFallbackDataTex(212, 212, 212, 255, THREE.NoColorSpace),
    };
  }

  const albedoPair = makeCanvas2d(size, size);
  const bumpPair = makeCanvas2d(size, size);
  const roughPair = makeCanvas2d(size, size);
  if (!albedoPair.canvas || !albedoPair.ctx || !bumpPair.canvas || !bumpPair.ctx || !roughPair.canvas || !roughPair.ctx) {
    return {
      map: makeFallbackDataTex(211, 146, 107, 255, THREE.SRGBColorSpace),
      bumpMap: makeFallbackDataTex(180, 180, 180, 255, THREE.NoColorSpace),
      roughnessMap: makeFallbackDataTex(212, 212, 212, 255, THREE.NoColorSpace),
    };
  }

  const albedoImg = albedoPair.ctx.createImageData(size, size);
  const bumpImg = bumpPair.ctx.createImageData(size, size);
  const roughImg = roughPair.ctx.createImageData(size, size);
  if (!albedoImg?.data || !bumpImg?.data || !roughImg?.data) {
    return {
      map: makeFallbackDataTex(211, 146, 107, 255, THREE.SRGBColorSpace),
      bumpMap: makeFallbackDataTex(180, 180, 180, 255, THREE.NoColorSpace),
      roughnessMap: makeFallbackDataTex(212, 212, 212, 255, THREE.NoColorSpace),
    };
  }

  // Hand-painted multi-plank coastal wood roof palette:
  // Alternating warm burnt-cedar, terracotta-amber, honey-ochre, and sun-bleached pale cream-driftwood planks!
  const shingleTones: readonly [number, number, number][] = [
    [176, 104, 78],  // Deep burnt cedar plank
    [198, 126, 92],  // Warm terracotta cedar plank
    [234, 210, 174], // Sun-bleached pale cream-driftwood accent plank
    [186, 114, 84],  // Rich chestnut-cedar plank
    [210, 144, 104], // Warm cinnamon-amber plank
    [194, 122, 88],  // Terracotta-sienna plank
    [218, 158, 116], // Honey-ochre plank
    [228, 202, 164], // Pale driftwood-tan accent plank
    [182, 110, 82],  // Warm russet-cedar plank
    [204, 134, 96],  // Sunlit cedar plank
    [214, 148, 108], // Warm amber-oak plank
    [190, 118, 86],  // Weathered cedar plank
  ];

  const rows = 12;
  const cols = 2;
  const colW = size / cols;
  const aData = albedoImg.data;
  const bData = bumpImg.data;
  const rData = roughImg.data;

  for (let py = 0; py < size; py++) {
    const rowFloat = (py / size) * rows;
    const rIdx = Math.min(rows - 1, rowFloat | 0);
    const rowFrac = rowFloat - rIdx;
    const staggerPx = (rIdx % 2) * (colW * 0.5);

    for (let px = 0; px < size; px++) {
      const shiftedX = (px + staggerPx) % size;
      const colFloat = shiftedX / colW;
      const cIdx = Math.min(cols - 1, colFloat | 0);
      const colFrac = colFloat - cIdx;

      // Subtle per-plank tone & horizontal wood grain
      const tileSeed = (rIdx * 13 + cIdx * 7) % 19;
      const baseTone = shingleTones[rIdx % shingleTones.length];
      const plankSegMod = cIdx % 2 === 0 ? 1.015 : 0.985;
      const u = px / size;
      const v = py / size;

      const horizGrain = smoothNoise2dPeriodic(u, v, 14, 84, 73);
      const coarseVar = smoothNoise2dPeriodic(u, v, 8, 24, 91);
      const shadeGrain = (0.94 + horizGrain * 0.10 + (coarseVar - 0.5) * 0.06) * plankSegMod;

      // Subtle staggered butt-joint seam between long horizontal roof planks
      const dSidePx = Math.min(colFrac, 1.0 - colFrac) * colW;
      let sideMul = 1.0;
      let sideBump = 1.0;
      let sideRough = 0.0;
      if (dSidePx < 2.0) {
        const st = dSidePx / 2.0;
        sideMul = 0.76 + st * 0.14;
        sideBump = 0.56 + st * 0.30;
        sideRough = 0.08 * (1.0 - st);
      } else if (dSidePx < 4.5) {
        const bt = smoothstep01(2.0, 4.5, dSidePx);
        sideMul = 0.90 + bt * 0.10;
        sideBump = 0.86 + bt * 0.14;
      }

      // Stepped overlapping horizontal roof plank lip (`rowFrac = 0.0` top underlap -> `0.90` sunlit lip -> `1.0` soft shadow)
      const lipEdge = 0.89 + ((tileSeed % 5) - 2) * 0.005;
      let stepAlbedo = 1.0;
      let stepBump = 0.76;
      let stepRough = 0.84;

      if (rowFrac > lipEdge) {
        const dropT = (rowFrac - lipEdge) / (1.0 - lipEdge);
        stepAlbedo = 0.68 + (1.0 - dropT) * 0.18;
        stepBump = 0.42 + (1.0 - dropT) * 0.24;
        stepRough = 0.93;
      } else if (rowFrac < 0.10) {
        const topT = rowFrac / 0.10;
        stepAlbedo = 0.88 + topT * 0.12;
        stepBump = 0.58 + topT * 0.16;
        stepRough = 0.89 - topT * 0.06;
      } else {
        const slopeT = (rowFrac - 0.10) / (lipEdge - 0.10);
        stepAlbedo = 0.97 + slopeT * 0.05;
        stepBump = 0.68 + slopeT * 0.24;
        stepRough = 0.83 + (1.0 - slopeT) * 0.04;
      }

      const finalShade = shadeGrain * stepAlbedo * sideMul;
      const outIdx = (py * size + px) * 4;

      aData[outIdx] = clampByte(baseTone[0] * finalShade);
      aData[outIdx + 1] = clampByte(baseTone[1] * finalShade);
      aData[outIdx + 2] = clampByte(baseTone[2] * finalShade);
      aData[outIdx + 3] = 255;

      const bVal = clampByte(Math.min(1, stepBump * sideBump + (horizGrain - 0.5) * 0.045) * 255);
      bData[outIdx] = bVal;
      bData[outIdx + 1] = bVal;
      bData[outIdx + 2] = bVal;
      bData[outIdx + 3] = 255;

      const rVal = clampByte(Math.min(0.98, stepRough + sideRough + (horizGrain - 0.5) * 0.04) * 255);
      rData[outIdx] = rVal;
      rData[outIdx + 1] = rVal;
      rData[outIdx + 2] = rVal;
      rData[outIdx + 3] = 255;
    }
  }

  albedoPair.ctx.putImageData(albedoImg, 0, 0);
  bumpPair.ctx.putImageData(bumpImg, 0, 0);
  roughPair.ctx.putImageData(roughImg, 0, 0);

  return {
    map: finalizeCoastalTex(albedoPair.canvas, THREE.RepeatWrapping, THREE.RepeatWrapping, THREE.SRGBColorSpace),
    bumpMap: finalizeCoastalTex(bumpPair.canvas, THREE.RepeatWrapping, THREE.RepeatWrapping, THREE.NoColorSpace),
    roughnessMap: finalizeCoastalTex(roughPair.canvas, THREE.RepeatWrapping, THREE.RepeatWrapping, THREE.NoColorSpace),
  };
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
 * Closed 45°-mitered rectangular perimeter rim/fascia collar in XZ centered at origin (`ExtrudeGeometry`).
 * Eliminates corner butt gaps and overlapping box Z-fighting.
 */
function makeMitredFrameExtrudeGeo(
  outerW: number,
  outerD: number,
  rimThick: number,
  height: number,
  bevelSize = 0.012,
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

  const geo = makeBeveledExtrudeGeo(outer, Math.max(0.01, height - b * 2), b, b, 2, 4);
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Continuous U-shaped mitered sill plate opening toward +Z (for 3-sided kiosk bases seated on deck).
 */
function makeUShapedSillExtrudeGeo(
  outerW: number,
  outerD: number,
  sillThick: number,
  height: number,
  bevelSize = 0.010,
): THREE.BufferGeometry {
  const b = Math.min(bevelSize, sillThick * 0.35, height * 0.35);
  const hw = Math.max(0.05, outerW * 0.5 - b);
  const hd = Math.max(0.05, outerD * 0.5 - b);
  const ihw = Math.max(0.02, outerW * 0.5 - sillThick + b);
  const ihd = Math.max(0.02, outerD * 0.5 - sillThick + b);

  const s = new THREE.Shape();
  // In 2D prior to rotateX(-PI/2): shape y maps to -z, so back (-Z) is +hd and front (+Z) is -hd
  s.moveTo(-hw, -hd);
  s.lineTo(-ihw, -hd);
  s.lineTo(-ihw, ihd);
  s.lineTo(ihw, ihd);
  s.lineTo(ihw, -hd);
  s.lineTo(hw, -hd);
  s.lineTo(hw, hd);
  s.lineTo(-hw, hd);
  s.closePath();

  const geo = makeBeveledExtrudeGeo(s, Math.max(0.01, height - b * 2), b, b, 2, 4);
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
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
 * Scales cylinder side UVs in world meters while keeping end-caps cleanly planar.
 */
export function applyCylinderWoodMetricUvs<T extends THREE.BufferGeometry>(
  geo: T,
  radiusMeters: number,
  heightMeters: number,
  tileU = 2.0,
  tileV = 2.0,
): T {
  const pos = geo.getAttribute('position');
  const norm = geo.getAttribute('normal');
  const uv = geo.getAttribute('uv');
  if (!pos || !norm || !uv) return geo;

  const circ = Math.max(0.4, Math.PI * 2 * radiusMeters);
  const repeatU = Math.max(0.5, circ / tileU);
  const repeatV = Math.max(0.5, heightMeters / tileV);

  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(norm.getY(i)) > 0.72) {
      uv.setXY(i, pos.getX(i) / tileU, pos.getZ(i) / tileV);
    } else {
      // Map cylinder height along U so longitudinal wood grain runs vertically along pilings/poles
      uv.setXY(i, uv.getY(i) * repeatV, uv.getX(i) * repeatU);
    }
  }
  uv.needsUpdate = true;
  geo.userData.preserveCustomUv = true;
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
  extraWoodTexs?: readonly THREE.Texture[],
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
  const isWoodLike =
    mapTex === timberTex ||
    isBoardwalk ||
    Boolean(extraWoodTexs && extraWoodTexs.includes(mapTex));
  const unitM =
    mapTex === weatherboardTex
      ? 2.2
      : mapTex === concreteTex || mapTex === travertineTex
        ? 2.75
        : isBoardwalk
          ? 3.2
          : isWoodLike
            ? 2.15
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
      if (isWoodLike && !isBoardwalk && spanZ > spanX * 1.1) {
        u = pz / unitM;
        v = px / unitM;
      } else {
        u = px / unitM;
        v = pz / unitM;
      }
    } else if (nx >= nz) {
      // +/- X side faces
      if (isWoodLike && verticalDominant) {
        u = py / unitM;
        v = pz / unitM;
      } else {
        u = pz / unitM;
        v = py / unitM;
      }
    } else {
      // +/- Z front/back faces
      if (isWoodLike && verticalDominant) {
        u = py / unitM;
        v = px / unitM;
      } else {
        u = px / unitM;
        v = py / unitM;
      }
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

  const coastalOakSet = createPbrTimberTextureSet('coastal_oak');
  const boardwalkDeckSet = createPbrTimberTextureSet('boardwalk_deck');
  const cabinCedarSet = createPbrTimberTextureSet('cabin_cedar');
  const galleonHullSet = createPbrTimberTextureSet('galleon_hull');
  const pastelDoorSet = createPbrTimberTextureSet('pastel_blue_door');
  const weatherboardSet = createPbrTimberTextureSet('weatherboard');
  const terracottaShingleSet = createPbrTerracottaShingleTextures();

  const coastalTimberTex = coastalOakSet.map;
  const boardwalkDeckTex = boardwalkDeckSet.map;
  const coastalWeatherboardTex = weatherboardSet.map;

  const pbrWoodTripletByMap = new Map<string, PbrTextureTriplet>([
    [coastalOakSet.map.uuid, coastalOakSet],
    [boardwalkDeckSet.map.uuid, boardwalkDeckSet],
    [cabinCedarSet.map.uuid, cabinCedarSet],
    [galleonHullSet.map.uuid, galleonHullSet],
    [pastelDoorSet.map.uuid, pastelDoorSet],
    [weatherboardSet.map.uuid, weatherboardSet],
    [terracottaShingleSet.map.uuid, terracottaShingleSet],
  ]);
  const extraWoodMaps = [
    cabinCedarSet.map,
    galleonHullSet.map,
    pastelDoorSet.map,
    terracottaShingleSet.map,
  ];
  const pbrWoodMatCache = new Map<string, THREE.MeshStandardMaterial>();

  const coastalAwningTex = createCoastalStripedAwningTexture();
  const coastalSailClothTex = createCoastalSailClothTexture();
  const showerPebbleTex = createShowerPebbleBasinTexture();
  const coastalTravertineTex = createCoastalTravertineTexture();
  const coastalHempRopeTex = createCoastalHempRopeTexture();
  const kioskChalkboardTex = createKioskChalkboardTexture();
  const surfSignTex = createSurfRentalSignTexture();

  // Map legacy coastal wood hex shades onto warm sunny honey-pine PBR tint multipliers
  // (never multiplies brown x brown; preserves clear hierarchy between deck vs structural framing)
  const resolvePbrWoodTint = (rawHex: string): string => {
    const h = rawHex.toLowerCase();
    if (h === '#ffffff' || h === '#f5efe4' || h === '#eee6d6') return '#ffffff';
    if (h === '#d5af80' || h === '#d4ae7e' || h === '#cfa576' || h === '#c89d6c' || h === '#f5e2cc') {
      return '#fff6ea';
    }
    if (h === '#ecd4bc') return '#faebd7';
    if (
      h === '#b88b5b' ||
      h === '#b88652' ||
      h === '#b68959' ||
      h === '#b58858' ||
      h === '#a67b4e' ||
      h === '#dfc0a0'
    ) {
      return '#f4dec4';
    }
    if (h === '#cfa984') return '#e6c49e';
    if (h === '#9e7448' || h === '#8f673e' || h === '#876139' || h === '#7d5934' || h === '#b8926e') {
      return '#d8b38c';
    }
    return rawHex;
  };

  const addBeachPart = (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    colorHex: string,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
    strokeW = 0.018,
    mapTex?: THREE.Texture,
    pbrOverrides?: { roughness?: number; bumpScale?: number; metalness?: number; side?: THREE.Side },
  ): THREE.Mesh => {
    applyBeachContinuousBoxUVs(
      geo,
      mapTex,
      coastalTimberTex,
      boardwalkDeckTex,
      coastalWeatherboardTex,
      lobbyConcreteTex,
      coastalTravertineTex,
      extraWoodMaps,
    );
    const pbrTriplet = mapTex ? pbrWoodTripletByMap.get(mapTex.uuid) : undefined;
    if (pbrTriplet) {
      const pbrMat = getOrCreatePbrWoodMaterial(pbrWoodMatCache, {
        colorHex: resolvePbrWoodTint(colorHex),
        textures: pbrTriplet,
        roughness: pbrOverrides?.roughness ?? (pbrTriplet === weatherboardSet ? 0.86 : 0.88),
        bumpScale: pbrOverrides?.bumpScale ?? 0.032,
        metalness: pbrOverrides?.metalness ?? 0.02,
        side: pbrOverrides?.side ?? THREE.FrontSide,
      });
      const mesh = new THREE.Mesh(geo, pbrMat);
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.rotation.set(rot[0], rot[1], rot[2]);
      mesh.castShadow = !isSoftwareGl;
      mesh.receiveShadow = !isSoftwareGl;
      // Zero cartoon outline and zero cel-step shader override on PBR timber!
      parent.add(mesh);
      return mesh;
    }

    void strokeW;
    void createBlitzStrokeMesh;
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

  // Rounded Concrete Pier Footings & Timber Support Piles + Seaward Travertine Retaining Wall down to -1.15m
  addBeachPart(
    seBeachGroup,
    makeRoundedBoxGeo(1.15, 1.65, 56.4, 0.05, 2),
    '#b8b2a6',
    [91.55, -0.32, 74.25],
    [0, 0, 0],
    0.016,
    coastalTravertineTex,
  );
  const pierBaseGeo = makeRoundedBoxGeo(0.78, 0.28, 0.78, 0.06, 2);
  const pierPostGeo = makeRoundedBoxGeo(0.42, 0.48, 0.42, 0.04, 2);
  for (let pz = 46.8; pz <= 101.8; pz += 4.58) {
    for (const px of [78.6, 85.1, 91.6]) {
      addBeachPart(seBeachGroup, pierBaseGeo, '#9c9890', [px, 0.14, pz], [0, 0, 0], 0.014, coastalTravertineTex);
      addBeachPart(seBeachGroup, pierPostGeo, '#8f673e', [px, 0.48, pz], [0, 0, 0], 0.014, coastalTimberTex);
    }
  }

  // 1C. Chamfered Step-Stone Stairs & Sloped Beach Access Ramp (+0.82m Boardwalk -> -1.00m Box 1 Beach Terrace)
  const mainStepTreadGeo = makeRoundedBoxGeo(0.68, 0.06, 7.08, 0.022, 2);
  for (let st = 0; st < 9; st++) {
    const sx = 92.5 + st * 0.58;
    const topY = BOARDWALK_Y - (st + 1) * 0.195;
    const stoneH = Math.max(0.18, topY - -1.12);
    addBeachPart(
      seBeachGroup,
      makeRoundedBoxGeo(0.64, stoneH, 7.0, 0.03, 2),
      '#c4bfb4',
      [sx, -1.12 + stoneH * 0.5, 73.0],
      [0, 0, 0],
      0.015,
      coastalTravertineTex,
    );
    addBeachPart(seBeachGroup, mainStepTreadGeo, '#c89d6c', [sx, topY + 0.03, 73.0], [0, 0, 0], 0.013, coastalTimberTex);
  }
  addBeachPart(
    seBeachGroup,
    makeRoundedBoxGeo(5.75, 0.22, 4.0, 0.04, 2),
    '#c89d6c',
    [94.9, -0.09, 67.1],
    [0, 0, -0.325],
    0.016,
    coastalTimberTex,
  );
  const rampCurbGeo = makeRoundedBoxGeo(5.78, 0.34, 0.22, 0.04, 2);
  for (const rz of [65.15, 69.05]) {
    addBeachPart(seBeachGroup, rampCurbGeo, '#8f673e', [94.9, 0.01, rz], [0, 0, -0.325], 0.014, coastalTimberTex);
  }
  for (let st = 0; st < 9; st++) {
    const sx = 92.5 + st * 0.58;
    const topY = BOARDWALK_Y - (st + 1) * 0.195;
    const stepH = Math.max(0.18, topY - -1.12);
    addBeachPart(
      seBeachGroup,
      makeRoundedBoxGeo(0.64, stepH, 4.8, 0.035, 2),
      '#c89d6c',
      [sx, -1.12 + stepH * 0.5, 96.6],
      [0, 0, 0],
      0.014,
      coastalTimberTex,
    );
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
    addBeachPart(pergolaRoofPivot, tieBeamGeo, COL_DRIFTWOOD_DARK, [cx, 0.16, 0], [0, 0, 0], 0.014, coastalTimberTex);
  }
  const rafterGeo = makeRoundedBoxGeo(0.14, 0.20, PERG_D + 1.4, 0.032, 2);
  for (let rx = -5.2; rx <= 5.21; rx += 0.65) {
    addBeachPart(pergolaRoofPivot, rafterGeo, COL_DRIFTWOOD, [rx, 0.34, 0], [0, 0, 0], 0.011, coastalTimberTex);
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
  const tableColGeo = applyCylinderWoodMetricUvs(new THREE.CylinderGeometry(0.10, 0.12, 0.74, 16), 0.11, 0.74);
  const tableFootGeo = makeBullnoseDiscGeo(0.41, 0.06, 20, 0.02);
  const stoolTopGeo = makeBullnoseDiscGeo(0.28, 0.07, 22, 0.022);
  const stoolLegGeo = applyCylinderWoodMetricUvs(new THREE.CylinderGeometry(0.06, 0.08, 0.44, 14), 0.07, 0.44);
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

  // Continuous U-shaped floor sill plate seated directly into sub-deck (eliminating 0.020m air gap)
  addBeachPart(
    juiceKioskGrp,
    makeUShapedSillExtrudeGeo(KIOSK_W + 0.06, KIOSK_D + 0.06, 0.28, 0.075, 0.014),
    COL_DRIFTWOOD_DARK,
    [0, 0.125, -0.02],
    [0, 0, 0],
    0.011,
    coastalTimberTex,
  );

  const kioskPostGeo = makeRoundedBoxGeo(0.24, KIOSK_WALL_H + 0.05, 0.24, 0.04, 2);
  for (const cx of [-2.42, 2.42]) {
    for (const cz of [-1.72, 1.72]) {
      addBeachPart(juiceKioskGrp, kioskPostGeo, COL_DRIFTWOOD, [cx, 0.095 + (KIOSK_WALL_H + 0.05) * 0.5, cz], [0, 0, 0], 0.014, coastalTimberTex);
    }
  }

  // Weatherboard Rear Wall & Door (inset slightly from post top/bottom and faces so zero coplanar ZF)
  addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(KIOSK_W - 0.24, KIOSK_WALL_H + 0.02, 0.18, 0.03, 2), '#f5efe4', [0, 0.105 + (KIOSK_WALL_H + 0.02) * 0.5, -1.68], [0, 0, 0], 0, coastalWeatherboardTex);
  addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(1.22, 2.30, 0.08, 0.025, 2), COL_DRIFTWOOD, [-0.95, 1.245, -1.78], [0, 0, 0], 0, coastalTimberTex);
  addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(1.06, 2.14, 0.10, 0.022, 2), '#eee6d6', [-0.95, 1.255, -1.80], [0, 0, 0], 0, coastalWeatherboardTex);
  addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(0.68, 0.42, 0.12, 0.015, 1), '#876139', [-0.95, 0.56, -1.81], [0, 0, 0], 0, lobbyLouverTex);
  addBeachPart(juiceKioskGrp, new THREE.SphereGeometry(0.055, 14, 12), '#d97706', [-0.52, 1.18, -1.86], [0, 0, 0], 0.006);
  addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(0.88, 0.38, 0.09, 0.018, 1), COL_DRIFTWOOD, [1.15, 2.48, -1.79], [0, 0, 0], 0, lobbyLouverTex);

  // Left & Right Side Walls with True Triangular Extruded Gables + Curved Mini Awnings
  const kioskSideWallGeo = makeRoundedBoxGeo(0.18, KIOSK_WALL_H + 0.008, KIOSK_D - 0.28, 0.03, 2);
  const kioskGableGeo = makeGablePedimentGeo(KIOSK_D - 0.24, 0.94, 0.18);
  const makeSideAwningGeo = (dir: number) => {
    const g = makeCurvedAwningShellGeo(1.18, 0.68, 0.04, 0.055);
    g.rotateX(0.38);
    g.rotateY(dir * (Math.PI / 2));
    return g;
  };
  const sideAwningGeos = { [-1]: makeSideAwningGeo(-1), [1]: makeSideAwningGeo(1) } as const;
  for (const sx of [-2.38, 2.38]) {
    const dir = sx < 0 ? -1 : 1;
    addBeachPart(juiceKioskGrp, kioskSideWallGeo, '#f5efe4', [sx, 0.10 + (KIOSK_WALL_H + 0.008) * 0.5, 0], [0, 0, 0], 0, coastalWeatherboardTex);
    addBeachPart(juiceKioskGrp, kioskGableGeo, '#f5efe4', [sx, KIOSK_WALL_H + 0.08, 0], [0, Math.PI / 2, 0], 0, coastalWeatherboardTex);
    addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(0.10, 1.24, 1.04, 0.02, 2), COL_DRIFTWOOD, [sx + dir * 0.09, 1.92, 0.05], [0, 0, 0], 0, coastalTimberTex);
    addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(0.12, 1.06, 0.86, 0.015, 1), '#a8845c', [sx + dir * 0.10, 1.92, 0.05], [0, 0, 0], 0, lobbyLouverTex);
    addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(0.32, 0.24, 1.12, 0.03, 2), COL_DRIFTWOOD, [sx + dir * 0.24, 1.18, 0.05], [0, 0, 0], 0, coastalTimberTex);
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

  // Front Counter Bay + Menu + Rounded Bullnose Service Ledge (grounded into sub-deck)
  addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(KIOSK_W - 0.24, 1.20, 0.20, 0.03, 2), '#f5efe4', [0, 0.695, 1.66], [0, 0, 0], 0.015, coastalWeatherboardTex);
  addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(1.38, 1.68, 0.20, 0.025, 2), '#f5efe4', [-1.72, 2.12, 1.66], [0, 0, 0], 0.012, coastalWeatherboardTex);
  addBeachPart(juiceKioskGrp, makeRoundedBoxGeo(KIOSK_W - 0.24, 0.42, 0.20, 0.025, 2), '#f5efe4', [0, 3.06, 1.66], [0, 0, 0], 0.012, coastalWeatherboardTex);

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
  const barStoolLegGeo = applyCylinderWoodMetricUvs(new THREE.CylinderGeometry(0.032, 0.026, 0.78, 12), 0.03, 0.78);
  const barStoolRingGeo = new THREE.TorusGeometry(0.21, 0.022, 10, 24);
  barStoolRingGeo.rotateX(Math.PI / 2);
  for (const stoolX of [-1.85, -0.85]) {
    const stoolZ = 2.42;
    addBeachPart(juiceKioskGrp, barStoolTopGeo, '#c89d6c', [stoolX, 0.88, stoolZ], [0, 0, 0], 0, coastalTimberTex);
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
        0,
        coastalTimberTex,
      );
    }
    addBeachPart(juiceKioskGrp, barStoolRingGeo, COL_DRIFTWOOD_DARK, [stoolX, 0.34, stoolZ], [0, 0, 0], 0, coastalTimberTex);
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

  const dividerPegGeo = applyCylinderWoodMetricUvs(new THREE.CylinderGeometry(0.04, 0.04, 0.68, 14), 0.04, 0.68);
  for (let pIdx = 0; pIdx < 6; pIdx++) {
    addBeachPart(surfRackGrp, dividerPegGeo, COL_DRIFTWOOD_DARK, [-1.75 + pIdx * 0.70, 1.98, 0.28], [Math.PI / 2, 0, 0], 0, coastalTimberTex);
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
  lifeguardGrp.position.set(116.5, -1.0, 67.5);
  lifeguardGrp.rotation.y = Math.PI / 2;
  lifeguardGrp.scale.setScalar(1.58);
  seBeachGroup.add(lifeguardGrp);

  const lgStiltGeo = makeRoundedBoxGeo(0.20, 2.35, 0.20, 0.035, 2);
  for (const lx of [-0.95, 0.95]) {
    for (const lz of [-0.95, 0.95]) {
      addBeachPart(lifeguardGrp, lgStiltGeo, COL_DRIFTWOOD, [lx, 1.15, lz], [lz * 0.08, 0, -lx * 0.08], 0.014, coastalTimberTex);
    }
  }
  const lgBraceGeo = makeRoundedBoxGeo(2.15, 0.12, 0.08, 0.02, 2);
  for (const sideZ of [-0.95, 0.95]) {
    addBeachPart(lifeguardGrp, lgBraceGeo, COL_DRIFTWOOD_DARK, [0, 1.18, sideZ - 0.024], [0, 0, 0.68], 0.011, coastalTimberTex);
    addBeachPart(lifeguardGrp, lgBraceGeo, COL_DRIFTWOOD_DARK, [0, 1.18, sideZ + 0.024], [0, 0, -0.68], 0.011, coastalTimberTex);
  }
  addBeachPart(lifeguardGrp, makeRoundedBoxGeo(2.85, 0.16, 2.95, 0.04, 2), '#c89d6c', [0, 2.28, 0.10], [0, 0, 0], 0, coastalTimberTex);
  // Continuous 45°-mitered U-shaped veranda handrail around Watchtower deck (flipped to open toward -Z)
  const lgURailGeo = makeUShapedSillExtrudeGeo(2.82, 2.90, 0.12, 0.085, 0.018);
  lgURailGeo.rotateY(Math.PI);
  addBeachPart(lifeguardGrp, lgURailGeo, '#f5efe4', [0, 3.05, 0.10], [0, 0, 0], 0, coastalWeatherboardTex);
  const lgRailPostGeo = makeRoundedBoxGeo(0.12, 0.78, 0.12, 0.025, 2);
  for (const rx of [-1.35, 1.35]) {
    addBeachPart(lifeguardGrp, lgRailPostGeo, COL_DRIFTWOOD, [rx, 2.68, 1.48], [0, 0, 0], 0, coastalTimberTex);
  }
  addBeachPart(lifeguardGrp, makeRoundedBoxGeo(1.95, 2.05, 1.95, 0.04, 2), '#f5efe4', [0, 3.38, -0.18], [0, 0, 0], 0, coastalWeatherboardTex);
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
    lGrp.position.set(wx, -1.0 + 0.04, wz);
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
    aGrp.position.set(wx, -1.0 + 0.04, wz);
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

  // Placements matching world colliders and seat interaction spots (+16m seaward on widened sand)
  buildTimberSunLounger(116.2, 54.0, Math.PI / 2 - 0.12);
  buildTimberSunLounger(116.2, 57.2, Math.PI / 2 - 0.08);
  buildTimberSunLounger(116.2, 60.4, Math.PI / 2 - 0.05);
  buildTimberSunLounger(117.0, 77.5, Math.PI / 2 + 0.08);
  buildTimberSunLounger(117.0, 80.8, Math.PI / 2 + 0.12);
  buildTimberSunLounger(116.2, 91.5, Math.PI / 2 - 0.10);
  buildTimberSunLounger(116.2, 94.8, Math.PI / 2 - 0.06);

  buildAdirondackBeachChair(112.2, 81.8, Math.PI / 2 + 0.15);
  buildAdirondackBeachChair(112.2, 85.0, Math.PI / 2 + 0.05);
  buildAdirondackBeachChair(112.2, 88.2, Math.PI / 2 - 0.10);
  buildAdirondackBeachChair(113.5, 49.5, Math.PI / 2 - 0.20);

  // =========================================================================
  // 7. BEACHFRONT STILT TIMBER CABIN ("RUMAH PAPAN PANGGUNG TEPI PANTAI" — 1:1 VIDEO 1)
  // =========================================================================
  const stiltCabinGrp = new THREE.Group();
  stiltCabinGrp.name = 'BeachfrontStiltTimberCabin';
  stiltCabinGrp.position.set(
    BEACHFRONT_STILT_CABIN_SPEC.centerX,
    BEACHFRONT_STILT_CABIN_SPEC.baseSandY,
    BEACHFRONT_STILT_CABIN_SPEC.centerZ,
  );
  seBeachGroup.add(stiltCabinGrp);

  {
    const c = BEACHFRONT_STILT_CABIN_SPEC;
    const deckY = c.deckTopY - c.baseSandY;
    const dMinX = c.deckMinX - c.centerX; // -3.7
    const dMaxX = c.deckMaxX - c.centerX; // +4.8
    const dMinZ = c.deckMinZ - c.centerZ; // -4.0
    const dMaxZ = c.deckMaxZ - c.centerZ; // +4.0
    const dMidX = (dMinX + dMaxX) * 0.5; // +0.55
    const dMidZ = (dMinZ + dMaxZ) * 0.5; // 0.0
    const dW = dMaxX - dMinX; // 8.5
    const dD = dMaxZ - dMinZ; // 8.0

    const cabMinX = c.cabinBodyMinX - c.centerX; // -1.6
    const cabMaxX = c.cabinBodyMaxX - c.centerX; // +2.5
    const cabMinZ = c.cabinBodyMinZ - c.centerZ; // -3.2
    const cabMaxZ = c.cabinBodyMaxZ - c.centerZ; // +1.6
    const cabMidX = (cabMinX + cabMaxX) * 0.5; // +0.45
    const cabMidZ = (cabMinZ + cabMaxZ) * 0.5; // -0.8
    const cabW = cabMaxX - cabMinX; // 4.1
    const cabD = cabMaxZ - cabMinZ; // 4.8

    const stMinZ = c.stairMinZ - c.centerZ; // -2.0
    const stMaxZ = c.stairMaxZ - c.centerZ; // +0.4
    const stMidZ = (stMinZ + stMaxZ) * 0.5; // -0.8
    const stW = stMaxZ - stMinZ; // 2.4

    const coastalTimberDark = galleonHullSet.map;
    const cabinSidingTex = cabinCedarSet.map;
    const shingleRoofTex = terracottaShingleSet.map;
    const pastelDoorTex = pastelDoorSet.map;

    // Helper for dedicated non-timber details (cached per look so bakeStaticGroupMeshes merges cleanly)
    const cabinAccentMatCache = new Map<string, THREE.MeshStandardMaterial>();
    const addCabinAccentMesh = (
      parent: THREE.Object3D,
      geo: THREE.BufferGeometry,
      optsMat: THREE.MeshStandardMaterialParameters,
      pos: [number, number, number],
      rot: [number, number, number] = [0, 0, 0],
      castShadow = true,
      receiveShadow = true,
    ) => {
      const colStr = optsMat.color ? new THREE.Color(optsMat.color).getHexString() : 'ffffff';
      const emStr = optsMat.emissive ? new THREE.Color(optsMat.emissive).getHexString() : '000000';
      const mKey = `${colStr}_${emStr}_${(optsMat.emissiveIntensity ?? 0).toFixed(2)}_${(optsMat.roughness ?? 0.5).toFixed(2)}_${(optsMat.metalness ?? 0).toFixed(2)}`;
      let mat = cabinAccentMatCache.get(mKey);
      if (!mat) {
        mat = new THREE.MeshStandardMaterial({ fog: true, ...optsMat });
        cabinAccentMatCache.set(mKey, mat);
      }
      const m = new THREE.Mesh(geo, mat);
      m.position.set(pos[0], pos[1], pos[2]);
      m.rotation.set(rot[0], rot[1], rot[2]);
      m.castShadow = !isSoftwareGl && castShadow;
      m.receiveShadow = !isSoftwareGl && receiveShadow;
      parent.add(m);
      return m;
    };

    // 7A. Round Timber Stilt Pilings (down to -1.85m into sand & ocean seabed) + Floor Girders + Diagonal Braces
    const stiltPilingGeo = applyCylinderWoodMetricUvs(
      new THREE.CylinderGeometry(0.21, 0.24, 2.66, 16),
      0.22,
      2.66,
    );
    const stiltCollarGeo = applyCylinderWoodMetricUvs(
      new THREE.CylinderGeometry(0.245, 0.255, 0.14, 16),
      0.25,
      0.14,
    );
    const pilingXs = [-3.45, -1.0, 1.5, 4.55] as const;
    const pilingZs = [-3.75, -1.25, 1.25, 3.75] as const;
    for (const px of pilingXs) {
      for (const pz of pilingZs) {
        addBeachPart(stiltCabinGrp, stiltPilingGeo, '#dfc0a0', [px, -0.55, pz], [0, 0, 0], 0, coastalTimberDark, {
          bumpScale: 0.034,
          roughness: 0.9,
        });
        addBeachPart(stiltCabinGrp, stiltCollarGeo, '#b8926e', [px, 0.62, pz], [0, 0, 0], 0, coastalTimberDark);
      }
    }

    // Main horizontal support girders (W-E & N-S) + deck rim fascia
    const girderWEGeo = makeRoundedBoxGeo(dW - 0.16, 0.24, 0.24, 0.03, 2);
    for (const pz of pilingZs) {
      addBeachPart(stiltCabinGrp, girderWEGeo, '#dfc0a0', [dMidX, 0.72, pz], [0, 0, 0], 0, coastalTimberDark);
    }
    const girderNSGeo = makeRoundedBoxGeo(0.22, 0.22, dD - 0.16, 0.03, 2);
    for (const px of [-3.45, 4.55]) {
      addBeachPart(stiltCabinGrp, girderNSGeo, '#dfc0a0', [px, 0.72, dMidZ], [0, 0, 0], 0, coastalTimberDark);
    }

    // Diagonal cross-bracing timbers between outer pilings (East ocean side + South & North flanks)
    const addDiagonalBrace = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => {
      const pA = new THREE.Vector3(ax, ay, az);
      const pB = new THREE.Vector3(bx, by, bz);
      const dir = new THREE.Vector3().subVectors(pB, pA);
      const len = dir.length();
      const braceMesh = addBeachPart(
        stiltCabinGrp,
        makeRoundedBoxGeo(0.11, len, 0.11, 0.02, 1),
        '#b8926e',
        [(ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5],
        [0, 0, 0],
        0,
        coastalTimberDark,
      );
      braceMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    };
    for (let i = 0; i + 1 < pilingZs.length; i++) {
      addDiagonalBrace(4.525, -0.22, pilingZs[i], 4.525, 0.58, pilingZs[i + 1]);
      addDiagonalBrace(4.575, 0.58, pilingZs[i], 4.575, -0.22, pilingZs[i + 1]);
    }
    for (let i = 0; i + 1 < pilingXs.length; i++) {
      for (const sideZ of [-3.75, 3.75] as const) {
        addDiagonalBrace(pilingXs[i], -0.18, sideZ - 0.025, pilingXs[i + 1], 0.58, sideZ - 0.025);
        addDiagonalBrace(pilingXs[i], 0.58, sideZ + 0.025, pilingXs[i + 1], -0.18, sideZ + 0.025);
      }
    }

    // 7B. Walkable Veranda Plank Deck + Continuous 45°-Mitered Perimeter Bullnose Trim & Fascia
    addBeachPart(
      stiltCabinGrp,
      makeRoundedBoxGeo(dW - 0.44, 0.14, dD - 0.44, 0.02, 2),
      '#ffffff',
      [dMidX, deckY - 0.072, dMidZ],
      [0, 0, 0],
      0,
      boardwalkDeckTex,
      { bumpScale: 0.032, roughness: 0.86 },
    );
    // Single closed mitered perimeter bullnose border collar (`ExtrudeGeometry`, zero corner overlaps/gaps)
    addBeachPart(
      stiltCabinGrp,
      makeMitredFrameExtrudeGeo(dW, dD, 0.22, 0.15, 0.018),
      '#f5e2cc',
      [dMidX, deckY - 0.075, dMidZ],
      [0, 0, 0],
      0,
      coastalTimberTex,
    );
    // Single closed mitered perimeter skirt fascia inset beneath overhang
    addBeachPart(
      stiltCabinGrp,
      makeMitredFrameExtrudeGeo(dW - 0.12, dD - 0.12, 0.08, 0.22, 0.012),
      '#dfc0a0',
      [dMidX, deckY - 0.25, dMidZ],
      [0, 0, 0],
      0,
      coastalTimberDark,
    );

    // 7C. 4-Step Timber Staircase Descending West to Golden Beach Sand (world x = 103.5 .. 104.7)
    const stairTreadGeo = makeRoundedBoxGeo(0.35, 0.075, stW - 0.08, 0.022, 2);
    for (let s = 0; s < 4; s++) {
      const topY = (s + 1) * (deckY / 4);
      const sx = -4.75 + s * 0.30;
      addBeachPart(
        stiltCabinGrp,
        stairTreadGeo,
        '#ffffff',
        [sx, topY - 0.0375, stMidZ],
        [0, 0, 0],
        0,
        boardwalkDeckTex,
      );
      const riserH = Math.max(0.08, topY - 0.075);
      addBeachPart(
        stiltCabinGrp,
        makeRoundedBoxGeo(0.24, riserH, stW - 0.16, 0.015, 1),
        '#cfa984',
        [sx + 0.04, riserH * 0.5, stMidZ],
        [0, 0, 0],
        0,
        coastalTimberTex,
      );
    }
    const stairSlopeAngle = Math.atan2(deckY, 1.2);
    const stairSlopeLen = Math.hypot(1.2, deckY) + 0.24;
    const stringerGeo = makeRoundedBoxGeo(stairSlopeLen, 0.22, 0.12, 0.024, 2);
    const stairHandrailGeo = makeRoundedBoxGeo(stairSlopeLen + 0.12, 0.09, 0.13, 0.024, 2);
    const lowerNewelGeo = makeRoundedBoxGeo(0.17, 2.28, 0.17, 0.03, 2);
    const postCapGeo = makeRoundedBoxGeo(0.22, 0.07, 0.22, 0.022, 2);
    for (const szSide of [stMinZ + 0.02, stMaxZ - 0.02]) {
      addBeachPart(stiltCabinGrp, stringerGeo, '#dfc0a0', [-4.30, deckY * 0.44, szSide], [0, 0, stairSlopeAngle], 0, coastalTimberDark);
      addBeachPart(stiltCabinGrp, lowerNewelGeo, '#dfc0a0', [-4.90, 0.77, szSide], [0, 0, 0], 0, coastalTimberDark);
      addBeachPart(stiltCabinGrp, postCapGeo, '#b8926e', [-4.90, 1.93, szSide], [0, 0, 0], 0, coastalTimberDark);
      addBeachPart(stiltCabinGrp, stairHandrailGeo, '#f5e2cc', [-4.26, deckY * 0.5 + 1.86, szSide], [0, 0, stairSlopeAngle], 0, coastalTimberTex);
    }

    // 7D. Veranda Perimeter Railings (1.85m chest-height guard vs 3.30m avatar; Newel Posts, Top/Bottom Rails & Balusters)
    const railPostPlaced = new Set<string>();
    const cabinRailPostGeo = makeRoundedBoxGeo(0.16, 1.91, 0.16, 0.028, 2);
    const cabinBalusterGeo = makeRoundedBoxGeo(0.065, 1.60, 0.065, 0.015, 1);

    const buildCabinRailingRun = (x1: number, z1: number, x2: number, z2: number) => {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.3) return;
      const yaw = Math.atan2(dx, dz);
      const midX = (x1 + x2) * 0.5;
      const midZ = (z1 + z2) * 0.5;
      const railSpan = Math.max(0.2, len - 0.14);

      addBeachPart(
        stiltCabinGrp,
        makeRoundedBoxGeo(0.14, 0.085, railSpan, 0.022, 2),
        '#f5e2cc',
        [midX, deckY + 1.85, midZ],
        [0, yaw, 0],
        0,
        coastalTimberTex,
      );
      addBeachPart(
        stiltCabinGrp,
        makeRoundedBoxGeo(0.095, 0.075, railSpan, 0.018, 1),
        '#cfa984',
        [midX, deckY + 0.18, midZ],
        [0, yaw, 0],
        0,
        coastalTimberTex,
      );

      const postSpans = Math.max(1, Math.round(len / 2.2));
      for (let i = 0; i <= postSpans; i++) {
        const t = i / postSpans;
        const px = x1 + dx * t;
        const pz = z1 + dz * t;
        const key = `${px.toFixed(2)}_${pz.toFixed(2)}`;
        if (!railPostPlaced.has(key)) {
          railPostPlaced.add(key);
          addBeachPart(stiltCabinGrp, cabinRailPostGeo, '#dfc0a0', [px, deckY + 0.955, pz], [0, yaw, 0], 0, coastalTimberDark);
          addBeachPart(stiltCabinGrp, postCapGeo, '#b8926e', [px, deckY + 1.935, pz], [0, yaw, 0], 0, coastalTimberDark);
        }
      }

      const balusterCount = Math.max(2, Math.floor(len / 0.36));
      for (let b = 1; b < balusterCount; b++) {
        const t = b / balusterCount;
        const bx = x1 + dx * t;
        const bz = z1 + dz * t;
        // Skip balusters that collide directly with intermediate newel posts
        const nearPost = Array.from({ length: postSpans + 1 }, (_, i) => i / postSpans).some(
          (pt) => Math.abs(t - pt) * len < 0.16,
        );
        if (nearPost) continue;
        addBeachPart(stiltCabinGrp, cabinBalusterGeo, '#ffffff', [bx, deckY + 1.015, bz], [0, yaw, 0], 0, coastalTimberTex);
      }
    };

    const railEdgeXMin = dMinX + 0.12;
    const railEdgeXMax = dMaxX - 0.12;
    const railEdgeZMin = dMinZ + 0.12;
    const railEdgeZMax = dMaxZ - 0.12;
    buildCabinRailingRun(railEdgeXMin, railEdgeZMin, railEdgeXMax, railEdgeZMin);
    buildCabinRailingRun(railEdgeXMax, railEdgeZMin, railEdgeXMax, railEdgeZMax);
    buildCabinRailingRun(railEdgeXMax, railEdgeZMax, railEdgeXMin, railEdgeZMax);
    buildCabinRailingRun(railEdgeXMin, railEdgeZMin, railEdgeXMin, stMinZ + 0.02);
    buildCabinRailingRun(railEdgeXMin, stMaxZ - 0.02, railEdgeXMin, railEdgeZMax);

    // 7E. Cabin Body: Solid Core + 14 Layered 3D Horizontal Clapboard Courses + Corner Timber Columns + Gables
    const wallH = 5.18; // Eave top Y = 0.96 + 5.18 = 6.14m (fits 4.05m door + lintel cleanly for 3.30m outdoor Buddy)
    const eaveY = deckY + wallH; // 6.14m
    const ridgeH = 1.60;
    const ridgeY = eaveY + ridgeH; // 7.74m

    // Solid interior core wall preventing light leaks behind horizontal plank reliefs
    addBeachPart(
      stiltCabinGrp,
      makeRoundedBoxGeo(cabW - 0.14, wallH - 0.06, cabD - 0.14, 0.02, 1),
      '#cfa984',
      [cabMidX, deckY + wallH * 0.5, cabMidZ],
      [0, 0, 0],
      0,
      cabinSidingTex,
    );

    // Layered 3D horizontal clapboard planks along all 4 cabin walls
    const lapCourses = 14;
    const courseH = wallH / lapCourses;
    const clapNSGeo = makeRoundedBoxGeo(cabW - 0.06, courseH + 0.016, 0.055, 0.014, 1);
    const clapWEGeo = makeRoundedBoxGeo(0.055, courseH + 0.016, cabD - 0.06, 0.014, 1);
    for (let k = 0; k < lapCourses; k++) {
      const cy = deckY + (k + 0.5) * courseH;
      const tint = k % 3 === 0 ? '#ffffff' : k % 3 === 1 ? '#f5e2cc' : '#ecd4bc';
      for (const sideZ of [cabMinZ + 0.02, cabMaxZ - 0.02]) {
        addBeachPart(stiltCabinGrp, clapNSGeo, tint, [cabMidX, cy, sideZ], [0, 0, 0], 0, cabinSidingTex);
      }
      for (const sideX of [cabMinX + 0.02, cabMaxX - 0.02]) {
        addBeachPart(stiltCabinGrp, clapWEGeo, tint, [sideX, cy, cabMidZ], [0, 0, 0], 0, cabinSidingTex);
      }
    }

    // 4 Corner Structural Timber Posts + Base Sill Skirt + Eave Frieze Trim
    const cornerColGeo = makeRoundedBoxGeo(0.22, wallH + 0.04, 0.22, 0.032, 2);
    for (const cx of [cabMinX + 0.05, cabMaxX - 0.05]) {
      for (const cz of [cabMinZ + 0.05, cabMaxZ - 0.05]) {
        addBeachPart(stiltCabinGrp, cornerColGeo, '#dfc0a0', [cx, deckY + wallH * 0.5, cz], [0, 0, 0], 0, coastalTimberDark);
      }
    }
    addBeachPart(
      stiltCabinGrp,
      makeRoundedBoxGeo(cabW + 0.08, 0.14, cabD + 0.08, 0.02, 1),
      '#b8926e',
      [cabMidX, deckY + 0.07, cabMidZ],
      [0, 0, 0],
      0,
      coastalTimberDark,
    );
    addBeachPart(
      stiltCabinGrp,
      makeRoundedBoxGeo(cabW + 0.06, 0.16, cabD + 0.06, 0.02, 1),
      '#dfc0a0',
      [cabMidX, eaveY - 0.08, cabMidZ],
      [0, 0, 0],
      0,
      coastalTimberDark,
    );

    // West & East Triangular Gable Pediments with continuous horizontal clapboard UVs + Attic Louver Vents
    const makeCabinGableGeo = () => {
      const g = makeGablePedimentGeo(cabD - 0.08, ridgeH, 0.14);
      const pos = g.getAttribute('position');
      const uv = g.getAttribute('uv');
      if (pos && uv) {
        for (let i = 0; i < pos.count; i++) {
          uv.setXY(i, (pos.getX(i) + cabD * 0.5) / 2.2, pos.getY(i) / 2.2);
        }
        uv.needsUpdate = true;
      }
      g.userData.preserveCustomUv = true;
      return g;
    };
    const cabinGableGeo = makeCabinGableGeo();
    const atticLouverFrameGeo = makeGablePedimentGeo(1.36, 0.56, 0.08);
    for (const gx of [cabMinX + 0.06, cabMaxX - 0.06]) {
      const dir = gx < cabMidX ? -1 : 1;
      addBeachPart(stiltCabinGrp, cabinGableGeo, '#ffffff', [gx, eaveY - 0.02, cabMidZ], [0, Math.PI / 2, 0], 0, cabinSidingTex);
      addBeachPart(stiltCabinGrp, atticLouverFrameGeo, '#b8926e', [gx + dir * 0.07, eaveY + 0.36, cabMidZ], [0, Math.PI / 2, 0], 0, coastalTimberDark);
      for (let lv = 0; lv < 3; lv++) {
        const lw = 0.98 - lv * 0.28;
        addBeachPart(
          stiltCabinGrp,
          makeRoundedBoxGeo(0.06, 0.055, lw, 0.01, 1),
          '#ffffff',
          [gx + dir * 0.10, eaveY + 0.46 + lv * 0.12, cabMidZ],
          [0, 0, 0],
          0,
          lobbyLouverTex,
        );
      }
    }

    // 7F. Pastel Blue Panel Door + Brass Hardware (West Facade at lx = cabMinX, lz = -0.80, 1:1 Video 1 0:05)
    {
      const doorGrp = new THREE.Group();
      doorGrp.position.set(cabMinX - 0.02, deckY, stMidZ);
      stiltCabinGrp.add(doorGrp);

      // Doorway timber casing (jambs, header lintel & threshold sill sized cleanly to 4.05m door height)
      addBeachPart(doorGrp, makeRoundedBoxGeo(0.14, 4.14, 0.15, 0.024, 2), '#dfc0a0', [-0.03, 2.07, -0.86], [0, 0, 0], 0, coastalTimberDark);
      addBeachPart(doorGrp, makeRoundedBoxGeo(0.14, 4.14, 0.15, 0.024, 2), '#dfc0a0', [-0.03, 2.07, 0.86], [0, 0, 0], 0, coastalTimberDark);
      addBeachPart(doorGrp, makeRoundedBoxGeo(0.16, 0.20, 1.92, 0.028, 2), '#dfc0a0', [-0.04, 4.19, 0], [0, 0, 0], 0, coastalTimberDark);
      addBeachPart(doorGrp, makeRoundedBoxGeo(0.24, 0.08, 1.94, 0.02, 2), '#b8926e', [-0.06, 0.04, 0], [0, 0, 0], 0, coastalTimberDark);

      // Pastel Blue Vertical-Plank Door Slab (`#ffffff` shows true `#6294be` coastal slate-blue wood texture)
      const doorSlabGeo = makeRoundedBoxGeo(0.09, 4.05, 1.56, 0.02, 2);
      addBeachPart(doorGrp, doorSlabGeo, '#ffffff', [-0.02, 2.045, 0], [0, 0, 0], 0, pastelDoorTex, {
        bumpScale: 0.032,
        roughness: 0.85,
      });
      // Upper & Lower recessed door panel moldings
      for (const [py, ph] of [
        [3.02, 1.40],
        [1.12, 1.48],
      ] as const) {
        addBeachPart(doorGrp, makeRoundedBoxGeo(0.04, ph, 1.16, 0.012, 1), '#dceaf7', [-0.06, py, 0], [0, 0, 0], 0, pastelDoorTex);
      }
      // Wrought-iron strap hinges (hinge side) & warm burnished brass doorknob + escutcheon plate
      for (const hy of [1.05, 3.15]) {
        addCabinAccentMesh(
          doorGrp,
          makeRoundedBoxGeo(0.03, 0.12, 0.56, 0.008, 1),
          { color: '#272c36', roughness: 0.52, metalness: 0.55 },
          [-0.08, hy, -0.46],
        );
      }
      addCabinAccentMesh(
        doorGrp,
        makeRoundedBoxGeo(0.03, 0.24, 0.09, 0.008, 1),
        { color: '#d4a246', roughness: 0.34, metalness: 0.72 },
        [-0.08, 1.92, 0.58],
      );
      addCabinAccentMesh(
        doorGrp,
        new THREE.SphereGeometry(0.065, 14, 12),
        { color: '#e5b95c', roughness: 0.28, metalness: 0.78 },
        [-0.14, 1.92, 0.58],
      );
    }

    // 7G. Framed Coastal Windows + Glass + Cross-Mullions + Open Plank Shutters + Planter Boxes
    const addCabinWindow = (
      wx: number,
      wy: number,
      wz: number,
      rotY: number,
      winW: number,
      winH: number,
      withFlowerBox: boolean,
    ) => {
      const wGrp = new THREE.Group();
      wGrp.position.set(wx, wy, wz);
      wGrp.rotation.y = rotY;
      stiltCabinGrp.add(wGrp);

      // Outer timber frame & overhanging windowsill
      addBeachPart(wGrp, makeRoundedBoxGeo(winW + 0.20, winH + 0.20, 0.10, 0.022, 2), '#dfc0a0', [0, 0, 0], [0, 0, 0], 0, coastalTimberDark);
      addBeachPart(wGrp, makeRoundedBoxGeo(winW + 0.32, 0.10, 0.18, 0.022, 2), '#b8926e', [0, -winH * 0.5 - 0.12, 0.04], [0, 0, 0], 0, coastalTimberDark);
      // Warm coastal reflective glass pane
      addCabinAccentMesh(
        wGrp,
        makeRoundedBoxGeo(winW - 0.08, winH - 0.08, 0.06, 0.01, 1),
        { color: '#78a8c4', roughness: 0.16, metalness: 0.14 },
        [0, 0, 0.035],
        [0, 0, 0],
        false,
        true,
      );
      // Center vertical & horizontal timber mullions
      addBeachPart(wGrp, makeRoundedBoxGeo(0.06, winH - 0.04, 0.09, 0.01, 1), '#f5e2cc', [0, 0, 0.045], [0, 0, 0], 0, coastalTimberTex);
      addBeachPart(wGrp, makeRoundedBoxGeo(winW - 0.04, 0.06, 0.09, 0.01, 1), '#f5e2cc', [0, 0.08, 0.045], [0, 0, 0], 0, coastalTimberTex);
      // Open plank side shutters seated flush into window casing + wrought-iron strap hinges (zero floating gap)
      const shutterW = Math.min(0.46, winW * 0.42);
      const shutterGeo = makeRoundedBoxGeo(shutterW, winH + 0.04, 0.06, 0.014, 1);
      const hingeStrapGeo = makeRoundedBoxGeo(0.20, 0.055, 0.025, 0.008, 1);
      for (const sSide of [-1, 1] as const) {
        addBeachPart(
          wGrp,
          shutterGeo,
          '#ffffff',
          [sSide * (winW * 0.5 + shutterW * 0.5 + 0.095), 0, 0.03],
          [0, 0, 0],
          0,
          pastelDoorTex,
        );
        for (const hy of [-winH * 0.28, winH * 0.28]) {
          addCabinAccentMesh(
            wGrp,
            hingeStrapGeo,
            { color: '#272c36', roughness: 0.52, metalness: 0.55 },
            [sSide * (winW * 0.5 + 0.115), hy, 0.060],
          );
        }
      }
      if (withFlowerBox) {
        addBeachPart(
          wGrp,
          makeRoundedBoxGeo(winW + 0.16, 0.24, 0.28, 0.025, 2),
          '#f5e2cc',
          [0, -winH * 0.5 - 0.28, 0.14],
          [0, 0, 0],
          0,
          coastalTimberTex,
        );
        const foliageGeo = new THREE.DodecahedronGeometry(0.14, 1);
        const bloomGeo = new THREE.DodecahedronGeometry(0.085, 0);
        for (let fi = -2; fi <= 2; fi++) {
          const fx = fi * (winW * 0.19);
          addCabinAccentMesh(wGrp, foliageGeo, { color: '#459448', roughness: 0.88 }, [fx, -winH * 0.5 - 0.12, 0.16]);
          if (fi % 2 === 0) {
            addCabinAccentMesh(
              wGrp,
              bloomGeo,
              { color: fi === 0 ? '#fb7185' : '#fef08a', roughness: 0.72 },
              [fx, -winH * 0.5 - 0.02, 0.18],
            );
          }
        }
      }
    };

    // West Porch Window (south of Blue Door), South Veranda Window, East Ocean Picture Window
    addCabinWindow(cabMinX - 0.03, deckY + 2.38, 0.88, -Math.PI / 2, 1.05, 1.32, true);
    addCabinWindow(cabMidX, deckY + 2.42, cabMaxZ + 0.03, 0, 1.68, 1.36, true);
    addCabinWindow(cabMaxX + 0.03, deckY + 2.42, cabMidZ, Math.PI / 2, 1.82, 1.44, true);

    // 7H. Terracotta-Cedar Wood Shingle Roof, Overhang Eaves, Exposed Rafter Tails & Brick Chimney
    const roofPitch = Math.atan2(ridgeH, cabD * 0.5); // ~32.0 deg
    const roofLenX = cabW + 1.50; // 5.60m (0.75m gable overhang on West & East)
    const roofHorizHalfZ = cabD * 0.5 + 0.76; // 3.16m horizontal half-span
    const roofSlopeW = roofHorizHalfZ / Math.cos(roofPitch); // ~3.73m slope chord

    const makeRoofSlopeGeo = (zSide: -1 | 1) => {
      const g = makeRoundedBoxGeo(roofLenX, 0.13, roofSlopeW, 0.025, 2);
      const pos = g.getAttribute('position');
      const uv = g.getAttribute('uv');
      const norm = g.getAttribute('normal');
      if (pos && uv && norm) {
        for (let i = 0; i < pos.count; i++) {
          const px = pos.getX(i);
          const py = pos.getY(i);
          const pz = pos.getZ(i);
          if (Math.abs(norm.getY(i)) >= Math.abs(norm.getX(i)) && Math.abs(norm.getY(i)) >= Math.abs(norm.getZ(i))) {
            // Orient shingles so overlapping bottom lip points downhill toward the outer eave
            uv.setXY(i, px / 2.5, (zSide > 0 ? -pz : pz) / 2.4);
          } else {
            uv.setXY(i, (px + pz) / 2.4, py / 2.4);
          }
        }
        uv.needsUpdate = true;
      }
      g.userData.preserveCustomUv = true;
      return g;
    };

    const slopeCenterZOff = roofHorizHalfZ * 0.5;
    const slopeCenterY = ridgeY - slopeCenterZOff * Math.tan(roofPitch);
    for (const zSide of [-1, 1] as const) {
      const rotX = zSide * roofPitch;
      addBeachPart(
        stiltCabinGrp,
        makeRoofSlopeGeo(zSide),
        '#ffffff',
        [cabMidX, slopeCenterY + 0.04, cabMidZ + zSide * slopeCenterZOff],
        [rotX, 0, 0],
        0,
        shingleRoofTex,
        { bumpScale: 0.034, roughness: 0.88 },
      );
      // Finished warm timber eave soffit deck beneath shingles
      addBeachPart(
        stiltCabinGrp,
        makeRoundedBoxGeo(roofLenX - 0.08, 0.06, roofSlopeW - 0.06, 0.015, 1),
        '#f5e2cc',
        [cabMidX, slopeCenterY - 0.04, cabMidZ + zSide * slopeCenterZOff],
        [rotX, 0, 0],
        0,
        coastalTimberTex,
      );
      // Outer eave fascia trim board
      const eaveOuterZ = cabMidZ + zSide * roofHorizHalfZ;
      const eaveOuterY = ridgeY - roofHorizHalfZ * Math.tan(roofPitch) - 0.04;
      addBeachPart(
        stiltCabinGrp,
        makeRoundedBoxGeo(roofLenX + 0.06, 0.18, 0.08, 0.02, 2),
        '#dfc0a0',
        [cabMidX, eaveOuterY, eaveOuterZ],
        [rotX, 0, 0],
        0,
        coastalTimberDark,
      );
    }

    // Warm Timber Ridge Cap Beam + 4 Pale-Driftwood Exterior Roof Battens per slope (1:1 reference roof)
    addBeachPart(
      stiltCabinGrp,
      makeRoundedBoxGeo(roofLenX + 0.10, 0.16, 0.28, 0.035, 2),
      '#b8926e',
      [cabMidX, ridgeY + 0.09, cabMidZ],
      [0, 0, 0],
      0,
      coastalTimberDark,
    );

    const roofTopBattenGeo = makeRoundedBoxGeo(0.10, 0.055, roofSlopeW - 0.10, 0.014, 1);
    for (const bxOff of [-1.85, -0.62, 0.62, 1.85]) {
      for (const zSide of [-1, 1] as const) {
        addBeachPart(
          stiltCabinGrp,
          roofTopBattenGeo,
          '#f5e2cc',
          [cabMidX + bxOff, slopeCenterY + 0.115, cabMidZ + zSide * slopeCenterZOff],
          [zSide * roofPitch, 0, 0],
          0,
          coastalTimberTex,
        );
      }
    }

    // Gable Slope Bargeboards (West & East ends) + 9 Full-Slope Exposed Rafter Tails per slope
    const bargeGeo = makeRoundedBoxGeo(0.11, 0.22, roofSlopeW + 0.06, 0.025, 2);
    for (const endX of [cabMidX - roofLenX * 0.5 + 0.03, cabMidX + roofLenX * 0.5 - 0.03]) {
      for (const zSide of [-1, 1] as const) {
        addBeachPart(
          stiltCabinGrp,
          bargeGeo,
          '#dfc0a0',
          [endX, slopeCenterY - 0.02, cabMidZ + zSide * slopeCenterZOff],
          [zSide * roofPitch, 0, 0],
          0,
          coastalTimberDark,
        );
      }
    }

    // Exposed rafters (3.64m length >= 0.65m keeps castShadow=true after baking, casting crisp eaves shadows!)
    const cabinRafterGeo = makeRoundedBoxGeo(0.11, 0.16, roofSlopeW - 0.04, 0.024, 2);
    for (let rx = cabMidX - roofLenX * 0.5 + 0.38; rx <= cabMidX + roofLenX * 0.5 - 0.34; rx += 0.60) {
      for (const zSide of [-1, 1] as const) {
        addBeachPart(
          stiltCabinGrp,
          cabinRafterGeo,
          '#b8926e',
          [rx, slopeCenterY - 0.14, cabMidZ + zSide * slopeCenterZOff],
          [zSide * roofPitch, 0, 0],
          0,
          coastalTimberDark,
        );
      }
    }

    // Small Terracotta Brick Chimney on North Slope
    addCabinAccentMesh(
      stiltCabinGrp,
      makeRoundedBoxGeo(0.76, 1.85, 0.76, 0.03, 2),
      { color: '#a85a44', roughness: 0.92, metalness: 0.02 },
      [cabMidX + 0.92, eaveY + 1.25, cabMidZ - 1.15],
    );
    addCabinAccentMesh(
      stiltCabinGrp,
      makeRoundedBoxGeo(0.92, 0.14, 0.92, 0.025, 2),
      { color: '#c4b8a6', roughness: 0.88, metalness: 0.02 },
      [cabMidX + 0.92, eaveY + 2.22, cabMidZ - 1.15],
    );
    addCabinAccentMesh(
      stiltCabinGrp,
      new THREE.CylinderGeometry(0.16, 0.19, 0.34, 12),
      { color: '#784434', roughness: 0.9, metalness: 0.02 },
      [cabMidX + 0.92, eaveY + 2.42, cabMidZ - 1.15],
    );

    // 7I. Video 1 Signature Porch Props: Burlap Sacks ("Karung Goni"), Wooden Crate, Barrel & Warm Lanterns
    // Wooden cargo crate tucked against West cabin wall south of the door
    addBeachPart(
      stiltCabinGrp,
      makeRoundedBoxGeo(0.62, 0.52, 0.62, 0.03, 2),
      '#f5e2cc',
      [cabMinX - 0.42, deckY + 0.26, 0.98],
      [0, 0.12, 0],
      0,
      coastalTimberTex,
    );
    // Pair of cinched burlap sacks (`LatheGeometry`) beside the crate/door (0:04-0:08 Video 1)
    const burlapSackGeo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.24, 0.0),
        new THREE.Vector2(0.32, 0.18),
        new THREE.Vector2(0.29, 0.44),
        new THREE.Vector2(0.11, 0.60),
        new THREE.Vector2(0.18, 0.72),
        new THREE.Vector2(0.0, 0.70),
      ],
      16,
    );
    burlapSackGeo.computeVertexNormals();
    addCabinAccentMesh(
      stiltCabinGrp,
      burlapSackGeo,
      { color: '#c2a476', roughness: 0.95, metalness: 0.0 },
      [cabMinX - 0.38, deckY, 0.26],
      [0.06, 0.3, -0.05],
    );
    addCabinAccentMesh(
      stiltCabinGrp,
      burlapSackGeo,
      { color: '#b39464', roughness: 0.95, metalness: 0.0 },
      [cabMinX - 0.74, deckY, 0.46],
      [-0.08, -0.4, 0.08],
    );

    // Nautical timber barrel & coiled rope on South-East ocean balcony corner
    const cabinBarrelGeo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.28, 0.0),
        new THREE.Vector2(0.35, 0.28),
        new THREE.Vector2(0.35, 0.56),
        new THREE.Vector2(0.28, 0.84),
        new THREE.Vector2(0.0, 0.84),
      ],
      16,
    );
    cabinBarrelGeo.computeVertexNormals();
    addBeachPart(stiltCabinGrp, cabinBarrelGeo, '#dfc0a0', [dMaxX - 0.65, deckY, dMaxZ - 0.65], [0, 0, 0], 0, coastalTimberDark);
    for (const hoopY of [0.16, 0.68]) {
      addCabinAccentMesh(
        stiltCabinGrp,
        new THREE.CylinderGeometry(0.34, 0.34, 0.06, 16),
        { color: '#334155', roughness: 0.5, metalness: 0.55 },
        [dMaxX - 0.65, deckY + hoopY, dMaxZ - 0.65],
      );
    }
    addBeachPart(
      stiltCabinGrp,
      new THREE.TorusGeometry(0.22, 0.05, 10, 18),
      '#d6be94',
      [dMaxX - 1.35, deckY + 0.05, dMaxZ - 0.55],
      [Math.PI / 2, 0, 0],
      0,
      coastalHempRopeTex,
    );

    // Warm Porch & Ocean-Balcony Lanterns
    const addCabinLantern = (lx: number, ly: number, lz: number, bracketDirX: number) => {
      const lGrp = new THREE.Group();
      lGrp.position.set(lx, ly, lz);
      stiltCabinGrp.add(lGrp);
      if (bracketDirX !== 0) {
        addCabinAccentMesh(
          lGrp,
          makeRoundedBoxGeo(0.28, 0.06, 0.06, 0.01, 1),
          { color: '#272c36', roughness: 0.52, metalness: 0.55 },
          [-bracketDirX * 0.14, 0.22, 0],
        );
      }
      addCabinAccentMesh(
        lGrp,
        new THREE.ConeGeometry(0.18, 0.14, 6),
        { color: '#272c36', roughness: 0.5, metalness: 0.55 },
        [0, 0.16, 0],
      );
      addCabinAccentMesh(
        lGrp,
        new THREE.CylinderGeometry(0.11, 0.09, 0.24, 8),
        {
          color: '#ffe08a',
          emissive: '#ffb84d',
          emissiveIntensity: 0.72,
          roughness: 0.28,
        },
        [0, 0, 0],
        [0, 0, 0],
        false,
        false,
      );
      addCabinAccentMesh(
        lGrp,
        new THREE.CylinderGeometry(0.12, 0.10, 0.05, 6),
        { color: '#272c36', roughness: 0.5, metalness: 0.55 },
        [0, -0.14, 0],
      );
    };
    addCabinLantern(cabMinX - 0.22, deckY + 2.68, stMidZ - 1.06, -1);
    addCabinLantern(railEdgeXMax, deckY + 1.50, dMidZ, 0);
  }

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
