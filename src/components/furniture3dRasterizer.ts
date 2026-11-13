import * as THREE from 'three';

export interface TexturePixelSource {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

const texturePixelCache = new WeakMap<object, TexturePixelSource>();

const SRGB_TO_LINEAR_LUT = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const srgb = i / 255;
  SRGB_TO_LINEAR_LUT[i] =
    srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

const TONEMAP_MAX_LINEAR = 4.0;
const TONEMAP_LUT_SIZE = 2048;
const LINEAR_TONEMAP_TO_SRGB_LUT = new Uint8ClampedArray(TONEMAP_LUT_SIZE + 1);
for (let i = 0; i <= TONEMAP_LUT_SIZE; i++) {
  const linearVal = (i / TONEMAP_LUT_SIZE) * TONEMAP_MAX_LINEAR;
  const mapped = (linearVal * 1.06) / (1 + linearVal * 0.28);
  const clamped = Math.min(1, Math.max(0, mapped));
  const srgb =
    clamped <= 0.0031308
      ? clamped * 12.92
      : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  LINEAR_TONEMAP_TO_SRGB_LUT[i] = Math.max(0, Math.min(255, Math.round(srgb * 255)));
}

function linearToneMapByte(linearVal: number): number {
  if (linearVal <= 0) return 0;
  if (linearVal >= TONEMAP_MAX_LINEAR) {
    return LINEAR_TONEMAP_TO_SRGB_LUT[TONEMAP_LUT_SIZE];
  }
  const idx = Math.round((linearVal / TONEMAP_MAX_LINEAR) * TONEMAP_LUT_SIZE);
  return LINEAR_TONEMAP_TO_SRGB_LUT[idx];
}

function linearDirectByte(linearVal: number): number {
  const v = Math.max(0, Math.min(1, linearVal));
  const srgb = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(srgb * 255)));
}

function resolveTexturePixels(tex: THREE.Texture | null | undefined): TexturePixelSource | null {
  if (!tex || !tex.image) return null;
  const img = tex.image as {
    width?: number;
    height?: number;
    data?: Uint8ClampedArray | Uint8Array;
    getContext?: (type: string) => CanvasRenderingContext2D | null;
  };
  const cached = texturePixelCache.get(tex.image);
  if (cached) return cached;

  const w = Number(img.width) || 0;
  const h = Number(img.height) || 0;
  if (w <= 0 || h <= 0) return null;

  // Raw ImageData or plain RGBA buffer (works both in browser and Node unit tests)
  if (img.data && img.data.length >= w * h * 4) {
    const data =
      img.data instanceof Uint8ClampedArray ? img.data : new Uint8ClampedArray(img.data);
    const source: TexturePixelSource = { width: w, height: h, data };
    texturePixelCache.set(tex.image, source);
    return source;
  }

  // HTMLCanvasElement
  if (typeof img.getContext === 'function') {
    const ctx = img.getContext('2d');
    if (ctx) {
      const imgData = ctx.getImageData(0, 0, w, h);
      const source: TexturePixelSource = { width: w, height: h, data: imgData.data };
      texturePixelCache.set(tex.image, source);
      return source;
    }
  }

  // HTMLImageElement / ImageBitmap fallback in browser
  if (typeof document !== 'undefined') {
    try {
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext('2d');
      if (ctx) {
        ctx.drawImage(tex.image as CanvasImageSource, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const source: TexturePixelSource = { width: w, height: h, data: imgData.data };
        texturePixelCache.set(tex.image, source);
        return source;
      }
    } catch {
      return null;
    }
  }

  return null;
}

function wrapUvCoord(val: number, wrapping: THREE.Wrapping): number {
  if (wrapping === THREE.ClampToEdgeWrapping) {
    return val < 0 ? 0 : val > 1 ? 1 : val;
  }
  if (wrapping === THREE.MirroredRepeatWrapping) {
    const m = Math.abs(val) % 2;
    return m <= 1 ? m : 2 - m;
  }
  // RepeatWrapping (default in buddiesInteriorAssets)
  const frac = val - Math.floor(val);
  return frac < 0 ? frac + 1 : frac;
}

interface RasterTri {
  sx0: number;
  sy0: number;
  invW0: number;
  sx1: number;
  sy1: number;
  invW1: number;
  sx2: number;
  sy2: number;
  invW2: number;
  u0OverW: number;
  v0OverW: number;
  u1OverW: number;
  v1OverW: number;
  u2OverW: number;
  v2OverW: number;
  nx0: number;
  ny0: number;
  nz0: number;
  nx1: number;
  ny1: number;
  nz1: number;
  nx2: number;
  ny2: number;
  nz2: number;
  vx: number;
  vy: number;
  vz: number;
  baseR: number;
  baseG: number;
  baseB: number;
  roughness: number;
  metalness: number;
  alpha: number;
  isBasic: boolean;
  isDoubleSide: boolean;
  tex: TexturePixelSource | null;
  texIsSrgb: boolean;
  texRepeatX: number;
  texRepeatY: number;
  texOffsetX: number;
  texOffsetY: number;
  texWrapS: THREE.Wrapping;
  texWrapT: THREE.Wrapping;
  texFlipY: boolean;
  sortDepth: number;
}

interface WireSegment {
  sx0: number;
  sy0: number;
  invW0: number;
  sx1: number;
  sy1: number;
  invW1: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

function drawWireSegmentToBuffer(
  seg: WireSegment,
  pixels: Uint8ClampedArray,
  zBuffer: Float32Array,
  width: number,
  height: number,
): void {
  let x0 = Math.round(seg.sx0);
  let y0 = Math.round(seg.sy0);
  const x1 = Math.round(seg.sx1);
  const y1 = Math.round(seg.sy1);
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  const steps = Math.max(1, Math.max(dx, dy));
  let step = 0;

  while (true) {
    if (x0 >= 0 && x0 < width && y0 >= 0 && y0 < height) {
      const t = step / steps;
      const invW = seg.invW0 + (seg.invW1 - seg.invW0) * t;
      const z = invW > 1e-6 ? 1 / invW : 1e6;
      const idx = y0 * width + x0;
      if (z <= zBuffer[idx] + 0.008) {
        zBuffer[idx] = Math.min(zBuffer[idx], z);
        const p = idx * 4;
        pixels[p] = seg.r;
        pixels[p + 1] = seg.g;
        pixels[p + 2] = seg.b;
        pixels[p + 3] = seg.a;
      }
    }
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
    step++;
  }
}

// Normalized 3-point studio lighting vectors
const L1x = -0.4362;
const L1y = 0.6688;
const L1z = 0.6019;
const L2x = 0.7181;
const L2y = -0.35;
const L2z = -0.599;
const L3x = 0.0;
const L3y = -0.5;
const L3z = 0.866;

function rasterizeTriangleToBuffer(
  tri: RasterTri,
  pixels: Uint8ClampedArray,
  zBuffer: Float32Array,
  width: number,
  height: number,
  writeDepth: boolean,
): void {
  const { sx0, sy0, sx1, sy1, sx2, sy2 } = tri;
  const area = (sx1 - sx0) * (sy2 - sy0) - (sx2 - sx0) * (sy1 - sy0);
  if (Math.abs(area) < 1e-3) return;
  const invArea = 1 / area;

  const minX = Math.max(0, Math.floor(Math.min(sx0, sx1, sx2)));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(sx0, sx1, sx2)));
  const minY = Math.max(0, Math.floor(Math.min(sy0, sy1, sy2)));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(sy0, sy1, sy2)));
  if (minX > maxX || minY > maxY) return;

  const sign = area > 0 ? 1 : -1;
  const invAbsArea = Math.abs(invArea);

  const pxStart = minX + 0.5;
  const pyStart = minY + 0.5;

  // Canonical edge(a, b, p) = (b.x - a.x)*(p.y - a.y) - (b.y - a.y)*(p.x - a.x),
  // which is positive inside the triangle when multiplied by `sign = sign(area)`.
  const stepX0 = -(sy2 - sy1) * sign;
  const stepY0 = (sx2 - sx1) * sign;
  const stepX1 = -(sy0 - sy2) * sign;
  const stepY1 = (sx0 - sx2) * sign;
  const stepX2 = -(sy1 - sy0) * sign;
  const stepY2 = (sx1 - sx0) * sign;

  let rowW0 = ((sx2 - sx1) * (pyStart - sy1) - (sy2 - sy1) * (pxStart - sx1)) * sign;
  let rowW1 = ((sx0 - sx2) * (pyStart - sy2) - (sy0 - sy2) * (pxStart - sx2)) * sign;
  let rowW2 = ((sx1 - sx0) * (pyStart - sy0) - (sy1 - sy0) * (pxStart - sx0)) * sign;

  const tex = tri.tex;
  const texW = tex ? tex.width : 0;
  const texH = tex ? tex.height : 0;
  const texData = tex ? tex.data : null;

  const basicR = tri.isBasic && !tex ? linearDirectByte(tri.baseR) : 0;
  const basicG = tri.isBasic && !tex ? linearDirectByte(tri.baseG) : 0;
  const basicB = tri.isBasic && !tex ? linearDirectByte(tri.baseB) : 0;
  const alphaByte = Math.max(0, Math.min(255, Math.round(tri.alpha * 255)));

  // Half vector for studio specular
  let hx = L1x + tri.vx;
  let hy = L1y + tri.vy;
  let hz = L1z + tri.vz;
  const invHLen = 1 / Math.max(1e-6, Math.sqrt(hx * hx + hy * hy + hz * hz));
  hx *= invHLen;
  hy *= invHLen;
  hz *= invHLen;

  const specStrength =
    tri.roughness < 0.28
      ? 0.28
      : tri.roughness < 0.45
        ? 0.14
        : tri.roughness < 0.65
          ? 0.06
          : 0.02;
  const specPow = tri.roughness < 0.28 ? 28 : 14;
  const fresnelScale = tri.isDoubleSide ? 0.04 : 0.1;

  for (let py = minY; py <= maxY; py++) {
    let w0 = rowW0;
    let w1 = rowW1;
    let w2 = rowW2;
    const rowOffset = py * width;

    for (let px = minX; px <= maxX; px++) {
      if (w0 >= -1e-4 && w1 >= -1e-4 && w2 >= -1e-4) {
        const l0 = w0 * invAbsArea;
        const l1 = w1 * invAbsArea;
        const l2 = w2 * invAbsArea;
        const invW = l0 * tri.invW0 + l1 * tri.invW1 + l2 * tri.invW2;
        if (invW > 1e-6) {
          const z = 1 / invW;
          const idx = rowOffset + px;
          const prevZ = zBuffer[idx];
          if (writeDepth ? z < prevZ : z <= prevZ + 0.002) {
            if (writeDepth) {
              zBuffer[idx] = z;
            }

            let albedoR = tri.baseR;
            let albedoG = tri.baseG;
            let albedoB = tri.baseB;

            if (texData && texW > 0 && texH > 0) {
              const rawU =
                (l0 * tri.u0OverW + l1 * tri.u1OverW + l2 * tri.u2OverW) * z;
              const rawV =
                (l0 * tri.v0OverW + l1 * tri.v1OverW + l2 * tri.v2OverW) * z;
              const u = wrapUvCoord(rawU * tri.texRepeatX + tri.texOffsetX, tri.texWrapS);
              const v = wrapUvCoord(rawV * tri.texRepeatY + tri.texOffsetY, tri.texWrapT);
              const tx = Math.min(texW - 1, Math.max(0, Math.floor(u * (texW - 1))));
              const ty = Math.min(
                texH - 1,
                Math.max(0, Math.floor((tri.texFlipY ? 1 - v : v) * (texH - 1))),
              );
              const tIdx = (ty * texW + tx) * 4;
              if (tri.texIsSrgb) {
                albedoR *= SRGB_TO_LINEAR_LUT[texData[tIdx]];
                albedoG *= SRGB_TO_LINEAR_LUT[texData[tIdx + 1]];
                albedoB *= SRGB_TO_LINEAR_LUT[texData[tIdx + 2]];
              } else {
                albedoR *= texData[tIdx] / 255;
                albedoG *= texData[tIdx + 1] / 255;
                albedoB *= texData[tIdx + 2] / 255;
              }
            }

            let outR: number;
            let outG: number;
            let outB: number;

            if (tri.isBasic) {
              if (texData) {
                outR = linearDirectByte(albedoR);
                outG = linearDirectByte(albedoG);
                outB = linearDirectByte(albedoB);
              } else {
                outR = basicR;
                outG = basicG;
                outB = basicB;
              }
            } else {
              let nx = l0 * tri.nx0 + l1 * tri.nx1 + l2 * tri.nx2;
              let ny = l0 * tri.ny0 + l1 * tri.ny1 + l2 * tri.ny2;
              let nz = l0 * tri.nz0 + l1 * tri.nz1 + l2 * tri.nz2;
              const invN = 1 / Math.max(1e-6, Math.sqrt(nx * nx + ny * ny + nz * nz));
              nx *= invN;
              ny *= invN;
              nz *= invN;

              const diff1 = Math.max(0, nx * L1x + ny * L1y + nz * L1z);
              const diff2 = Math.max(0, nx * L2x + ny * L2y + nz * L2z);
              const diff3 = Math.max(0, nx * L3x + ny * L3y + nz * L3z);

              const ndoth = Math.max(0, nx * hx + ny * hy + nz * hz);
              const spec = Math.pow(ndoth, specPow) * specStrength;

              const ndotv = Math.max(0, Math.min(1, nx * tri.vx + ny * tri.vy + nz * tri.vz));
              const oneMinusNdotV = 1 - ndotv;
              const fresnel = oneMinusNdotV * oneMinusNdotV * oneMinusNdotV * fresnelScale;

              // Warm balanced studio key/fill + slight metalness tint on specular
              const diffuseGain = 0.31 + diff1 * 0.72 + diff2 * 0.22 + diff3 * 0.22;
              const metalTintR = 1 - tri.metalness + tri.metalness * albedoR;
              const metalTintG = 1 - tri.metalness + tri.metalness * albedoG;
              const metalTintB = 1 - tri.metalness + tri.metalness * albedoB;
              const metalRim = tri.metalness > 0.15 ? fresnel * 1.45 : fresnel;

              const linR =
                albedoR * diffuseGain + spec * metalTintR + metalRim * 0.22;
              const linG =
                albedoG * (0.32 + diff1 * 0.7 + diff2 * 0.26 + diff3 * 0.23) +
                spec * metalTintG +
                metalRim * 0.28;
              const linB =
                albedoB * (0.34 + diff1 * 0.66 + diff2 * 0.32 + diff3 * 0.26) +
                spec * metalTintB +
                metalRim * 0.36;

              outR = linearToneMapByte(linR);
              outG = linearToneMapByte(linG);
              outB = linearToneMapByte(linB);
            }

            const p = idx * 4;
            if (writeDepth || alphaByte >= 254) {
              pixels[p] = outR;
              pixels[p + 1] = outG;
              pixels[p + 2] = outB;
              pixels[p + 3] = alphaByte;
            } else {
              const srcA = tri.alpha;
              const invA = 1 - srcA;
              const dstA = pixels[p + 3] / 255;
              const finalA = srcA + dstA * invA;
              if (finalA > 1e-4) {
                pixels[p] = Math.round((outR * srcA + pixels[p] * dstA * invA) / finalA);
                pixels[p + 1] = Math.round(
                  (outG * srcA + pixels[p + 1] * dstA * invA) / finalA,
                );
                pixels[p + 2] = Math.round(
                  (outB * srcA + pixels[p + 2] * dstA * invA) / finalA,
                );
                pixels[p + 3] = Math.min(255, Math.round(finalA * 255));
              }
            }
          }
        }
      }

      w0 += stepX0;
      w1 += stepX1;
      w2 += stepX2;
    }

    rowW0 += stepY0;
    rowW1 += stepY1;
    rowW2 += stepY2;
  }
}

/**
 * Centers and scales an arbitrary Three.js furniture group so its largest axis
 * spans `targetSpan` world units around the origin, preserving proportions.
 */
export function prepareStudioFurnitureGroup(
  meshGroup: THREE.Group,
  targetSpan = 1.48,
): THREE.Group {
  meshGroup.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(meshGroup);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;

  const wrapper = new THREE.Group();
  meshGroup.position.set(-center.x, -center.y, -center.z);
  wrapper.add(meshGroup);
  wrapper.scale.setScalar(targetSpan / maxDim);
  wrapper.updateMatrixWorld(true);
  return wrapper;
}

/**
 * Projects and software-rasterizes a Three.js Group into a preallocated RGBA pixel buffer
 * with Z-buffering, UV texture sampling, vertex colors, wireframe meshes, and studio lighting.
 * Skips BackSide ShaderMaterial toon-outline shells that would otherwise occlude textured surfaces.
 */
export function rasterizeTexturedGroupToBuffer(
  group: THREE.Group,
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  cameraZ = 2.75,
  fovDeg = 24,
  zBufferReuse?: Float32Array,
): number {
  const totalPixels = width * height;
  if (pixels.length < totalPixels * 4) return 0;

  pixels.fill(0);
  const zBuffer =
    zBufferReuse && zBufferReuse.length >= totalPixels
      ? zBufferReuse
      : new Float32Array(totalPixels);
  zBuffer.fill(Number.POSITIVE_INFINITY);

  group.updateMatrixWorld(true);

  const camY = 0.0;
  const camZ = Math.max(0.8, cameraZ);
  const halfW = width * 0.5;
  const halfH = height * 0.5;
  const focal = halfH / Math.tan(((fovDeg * Math.PI) / 180) * 0.5);

  const transparentTris: RasterTri[] = [];
  const wireSegments: WireSegment[] = [];
  let drawnTriangles = 0;

  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || !mesh.geometry) return;

    const geo = mesh.geometry;
    const posAttr = geo.getAttribute('position');
    if (!posAttr) return;
    const normAttr = geo.getAttribute('normal');
    const uvAttr = geo.getAttribute('uv');
    const colAttr = geo.getAttribute('color');
    const indexAttr = geo.getIndex();

    const mw = mesh.matrixWorld.elements;
    const matList = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const groups =
      geo.groups && geo.groups.length > 0
        ? geo.groups
        : [
            {
              start: 0,
              count: indexAttr ? indexAttr.count : posAttr.count,
              materialIndex: 0,
            },
          ];

    for (const grp of groups) {
      const resolvedMat = Array.isArray(mesh.material)
        ? matList[grp.materialIndex ?? 0]
        : mesh.material;
      const mat = resolvedMat as
        | (THREE.Material & {
            color?: THREE.Color;
            map?: THREE.Texture | null;
            roughness?: number;
            metalness?: number;
            vertexColors?: boolean;
            wireframe?: boolean;
            isMeshBasicMaterial?: boolean;
            isShaderMaterial?: boolean;
          })
        | undefined;
      if (!mat || mat.visible === false) continue;
      // Skip ShaderMaterial / BackSide outline shells (`createBlitzStrokeMesh`)
      if (mat.isShaderMaterial || mat.side === THREE.BackSide) continue;

      const isBasic = Boolean(mat.isMeshBasicMaterial);
      const isDoubleSide = mat.side === THREE.DoubleSide;
      const isWireframe = Boolean(mat.wireframe);
      const useVertColors = Boolean(mat.vertexColors && colAttr);
      const matR = mat.color ? mat.color.r : 1;
      const matG = mat.color ? mat.color.g : 1;
      const matB = mat.color ? mat.color.b : 1;
      const roughness = !isBasic && typeof mat.roughness === 'number' ? mat.roughness : 0.48;
      const metalness = !isBasic && typeof mat.metalness === 'number' ? mat.metalness : 0.0;
      const alpha = mat.transparent ? (mat.opacity ?? 0.9) : 1;

      const texMap = mat.map ?? null;
      const texPixels = texMap ? resolveTexturePixels(texMap) : null;
      const texIsSrgb = !texMap || texMap.colorSpace === THREE.SRGBColorSpace || !texMap.colorSpace;
      const texRepeatX = texMap ? texMap.repeat.x : 1;
      const texRepeatY = texMap ? texMap.repeat.y : 1;
      const texOffsetX = texMap ? texMap.offset.x : 0;
      const texOffsetY = texMap ? texMap.offset.y : 0;
      const texWrapS = texMap ? texMap.wrapS : THREE.RepeatWrapping;
      const texWrapT = texMap ? texMap.wrapT : THREE.RepeatWrapping;
      const texFlipY = texMap ? texMap.flipY : true;

      const startIdx = Math.max(0, grp.start);
      const endIdx = Math.min(indexAttr ? indexAttr.count : posAttr.count, grp.start + grp.count);

      for (let idxPos = startIdx; idxPos + 2 < endIdx; idxPos += 3) {
        const i0 = indexAttr ? indexAttr.getX(idxPos) : idxPos;
        const i1 = indexAttr ? indexAttr.getX(idxPos + 1) : idxPos + 1;
        const i2 = indexAttr ? indexAttr.getX(idxPos + 2) : idxPos + 2;

        const lx0 = posAttr.getX(i0);
        const ly0 = posAttr.getY(i0);
        const lz0 = posAttr.getZ(i0);
        const x0 = mw[0] * lx0 + mw[4] * ly0 + mw[8] * lz0 + mw[12];
        const y0 = mw[1] * lx0 + mw[5] * ly0 + mw[9] * lz0 + mw[13];
        const z0 = mw[2] * lx0 + mw[6] * ly0 + mw[10] * lz0 + mw[14];

        const lx1 = posAttr.getX(i1);
        const ly1 = posAttr.getY(i1);
        const lz1 = posAttr.getZ(i1);
        const x1 = mw[0] * lx1 + mw[4] * ly1 + mw[8] * lz1 + mw[12];
        const y1 = mw[1] * lx1 + mw[5] * ly1 + mw[9] * lz1 + mw[13];
        const z1 = mw[2] * lx1 + mw[6] * ly1 + mw[10] * lz1 + mw[14];

        const lx2 = posAttr.getX(i2);
        const ly2 = posAttr.getY(i2);
        const lz2 = posAttr.getZ(i2);
        const x2 = mw[0] * lx2 + mw[4] * ly2 + mw[8] * lz2 + mw[12];
        const y2 = mw[1] * lx2 + mw[5] * ly2 + mw[9] * lz2 + mw[13];
        const z2 = mw[2] * lx2 + mw[6] * ly2 + mw[10] * lz2 + mw[14];

        const d0 = camZ - z0;
        const d1 = camZ - z1;
        const d2 = camZ - z2;
        if (d0 < 0.15 || d1 < 0.15 || d2 < 0.15) continue;

        const sx0 = halfW + (x0 / d0) * focal;
        const sy0 = halfH - ((y0 - camY) / d0) * focal;
        const sx1 = halfW + (x1 / d1) * focal;
        const sy1 = halfH - ((y1 - camY) / d1) * focal;
        const sx2 = halfW + (x2 / d2) * focal;
        const sy2 = halfH - ((y2 - camY) / d2) * focal;

        if (isWireframe) {
          const wr = linearDirectByte(matR);
          const wg = linearDirectByte(matG);
          const wb = linearDirectByte(matB);
          const wa = Math.max(0, Math.min(255, Math.round(alpha * 255)));
          const invW0 = 1 / d0;
          const invW1 = 1 / d1;
          const invW2 = 1 / d2;
          wireSegments.push(
            { sx0, sy0, invW0, sx1, sy1, invW1, r: wr, g: wg, b: wb, a: wa },
            { sx0: sx1, sy0: sy1, invW0: invW1, sx1: sx2, sy1: sy2, invW1: invW2, r: wr, g: wg, b: wb, a: wa },
            { sx0: sx2, sy0: sy2, invW0: invW2, sx1: sx0, sy1: sy0, invW1: invW0, r: wr, g: wg, b: wb, a: wa },
          );
          drawnTriangles++;
          continue;
        }

        const e1x = x1 - x0;
        const e1y = y1 - y0;
        const e1z = z1 - z0;
        const e2x = x2 - x0;
        const e2y = y2 - y0;
        const e2z = z2 - z0;

        let fnx = e1y * e2z - e1z * e2y;
        let fny = e1z * e2x - e1x * e2z;
        let fnz = e1x * e2y - e1y * e2x;
        const nLenSq = fnx * fnx + fny * fny + fnz * fnz;
        if (nLenSq < 1e-12) continue;
        const invNLen = 1 / Math.sqrt(nLenSq);
        fnx *= invNLen;
        fny *= invNLen;
        fnz *= invNLen;

        const cxW = (x0 + x1 + x2) * (1 / 3);
        const cyW = (y0 + y1 + y2) * (1 / 3);
        const czW = (z0 + z1 + z2) * (1 / 3);

        let vx = -cxW;
        let vy = camY - cyW;
        let vz = camZ - czW;
        const invVLen = 1 / Math.max(1e-6, Math.sqrt(vx * vx + vy * vy + vz * vz));
        vx *= invVLen;
        vy *= invVLen;
        vz *= invVLen;

        const rawNdotV = fnx * vx + fny * vy + fnz * vz;
        let flipNormal = 1;
        if (isDoubleSide) {
          if (rawNdotV < 0) {
            flipNormal = -1;
          }
        } else if (rawNdotV <= 0) {
          continue;
        }

        let nx0 = fnx * flipNormal;
        let ny0 = fny * flipNormal;
        let nz0 = fnz * flipNormal;
        let nx1 = nx0;
        let ny1 = ny0;
        let nz1 = nz0;
        let nx2 = nx0;
        let ny2 = ny0;
        let nz2 = nz0;

        if (normAttr) {
          const lnx0 = normAttr.getX(i0);
          const lny0 = normAttr.getY(i0);
          const lnz0 = normAttr.getZ(i0);
          nx0 = (mw[0] * lnx0 + mw[4] * lny0 + mw[8] * lnz0) * flipNormal;
          ny0 = (mw[1] * lnx0 + mw[5] * lny0 + mw[9] * lnz0) * flipNormal;
          nz0 = (mw[2] * lnx0 + mw[6] * lny0 + mw[10] * lnz0) * flipNormal;

          const lnx1 = normAttr.getX(i1);
          const lny1 = normAttr.getY(i1);
          const lnz1 = normAttr.getZ(i1);
          nx1 = (mw[0] * lnx1 + mw[4] * lny1 + mw[8] * lnz1) * flipNormal;
          ny1 = (mw[1] * lnx1 + mw[5] * lny1 + mw[9] * lnz1) * flipNormal;
          nz1 = (mw[2] * lnx1 + mw[6] * lny1 + mw[10] * lnz1) * flipNormal;

          const lnx2 = normAttr.getX(i2);
          const lny2 = normAttr.getY(i2);
          const lnz2 = normAttr.getZ(i2);
          nx2 = (mw[0] * lnx2 + mw[4] * lny2 + mw[8] * lnz2) * flipNormal;
          ny2 = (mw[1] * lnx2 + mw[5] * lny2 + mw[9] * lnz2) * flipNormal;
          nz2 = (mw[2] * lnx2 + mw[6] * lny2 + mw[10] * lnz2) * flipNormal;
        }

        let baseR = matR;
        let baseG = matG;
        let baseB = matB;
        if (useVertColors && colAttr) {
          baseR *= (colAttr.getX(i0) + colAttr.getX(i1) + colAttr.getX(i2)) * (1 / 3);
          baseG *= (colAttr.getY(i0) + colAttr.getY(i1) + colAttr.getY(i2)) * (1 / 3);
          baseB *= (colAttr.getZ(i0) + colAttr.getZ(i1) + colAttr.getZ(i2)) * (1 / 3);
        }

        const invW0 = 1 / d0;
        const invW1 = 1 / d1;
        const invW2 = 1 / d2;

        const u0 = uvAttr ? uvAttr.getX(i0) : 0;
        const v0 = uvAttr ? uvAttr.getY(i0) : 0;
        const u1 = uvAttr ? uvAttr.getX(i1) : 0;
        const v1 = uvAttr ? uvAttr.getY(i1) : 0;
        const u2 = uvAttr ? uvAttr.getX(i2) : 0;
        const v2 = uvAttr ? uvAttr.getY(i2) : 0;

        const tri: RasterTri = {
          sx0,
          sy0,
          invW0,
          sx1,
          sy1,
          invW1,
          sx2,
          sy2,
          invW2,
          u0OverW: u0 * invW0,
          v0OverW: v0 * invW0,
          u1OverW: u1 * invW1,
          v1OverW: v1 * invW1,
          u2OverW: u2 * invW2,
          v2OverW: v2 * invW2,
          nx0,
          ny0,
          nz0,
          nx1,
          ny1,
          nz1,
          nx2,
          ny2,
          nz2,
          vx,
          vy,
          vz,
          baseR,
          baseG,
          baseB,
          roughness,
          metalness,
          alpha,
          isBasic,
          isDoubleSide,
          tex: texPixels,
          texIsSrgb,
          texRepeatX,
          texRepeatY,
          texOffsetX,
          texOffsetY,
          texWrapS,
          texWrapT,
          texFlipY,
          sortDepth: (d0 + d1 + d2) * (1 / 3),
        };

        if (alpha < 0.995) {
          transparentTris.push(tri);
        } else {
          rasterizeTriangleToBuffer(tri, pixels, zBuffer, width, height, true);
        }
        drawnTriangles++;
      }
    }
  });

  if (transparentTris.length > 0) {
    transparentTris.sort((a, b) => b.sortDepth - a.sortDepth);
    for (let i = 0; i < transparentTris.length; i++) {
      rasterizeTriangleToBuffer(transparentTris[i], pixels, zBuffer, width, height, false);
    }
  }

  for (let i = 0; i < wireSegments.length; i++) {
    drawWireSegmentToBuffer(wireSegments[i], pixels, zBuffer, width, height);
  }

  return drawnTriangles;
}

const canvasScratchCache = new WeakMap<
  CanvasRenderingContext2D,
  { width: number; height: number; imageData: ImageData; zBuffer: Float32Array }
>();

/**
 * Renders any textured 3D Three.js Group onto a standard 2D Canvas (`CanvasRenderingContext2D`)
 * using our pure CPU Z-buffered UV-textured rasterizer (zero WebGL contexts).
 */
export function renderTexturedGroupTo2dCanvas(
  ctx: CanvasRenderingContext2D,
  group: THREE.Group,
  width: number,
  height: number,
  cameraZ = 2.75,
  fovDeg = 24,
): number {
  const pixelW = Math.max(1, Math.round(width));
  const pixelH = Math.max(1, Math.round(height));
  let scratch = canvasScratchCache.get(ctx);
  if (!scratch || scratch.width !== pixelW || scratch.height !== pixelH) {
    scratch = {
      width: pixelW,
      height: pixelH,
      imageData: ctx.createImageData(pixelW, pixelH),
      zBuffer: new Float32Array(pixelW * pixelH),
    };
    canvasScratchCache.set(ctx, scratch);
  }

  const count = rasterizeTexturedGroupToBuffer(
    group,
    scratch.imageData.data,
    pixelW,
    pixelH,
    cameraZ,
    fovDeg,
    scratch.zBuffer,
  );
  // Save & reset transform temporarily so putImageData writes exact backing-buffer pixels,
  // or clear and draw via ImageBitmap/Canvas when DPR transform is used.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.putImageData(scratch.imageData, 0, 0);
  ctx.restore();
  return count;
}
