import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAFE_GLOBAL_SCALE_SPEC } from './buddiesCafeRules';

export interface CafeAssetStyler {
  styleOpaque: (
    mesh: THREE.Mesh,
    geo: THREE.BufferGeometry,
    colorHex: string,
    strokeW?: number,
    opts?: {
      tex?: THREE.Texture | null;
      bumpMap?: THREE.Texture | null;
      bumpScale?: number;
      roughness?: number;
      metalness?: number;
      clearcoat?: number;
      clearcoatRoughness?: number;
      sheen?: number;
      sheenRoughness?: number;
      flatShading?: boolean;
      doubleSided?: boolean;
      tintTex?: boolean;
      boxUV?: boolean;
      emissiveHex?: string;
      emissiveIntensity?: number;
      castShadow?: boolean;
      receiveShadow?: boolean;
    },
  ) => THREE.Mesh;
  clearGlassMat: THREE.Material;
  frostedGlassMat?: THREE.Material;
  /** Defaults to true (interior close-up PBR); set to false on exterior Central Plaza to bake 100% into vertex colors with +0 extra draw calls. */
  preserveTextures?: boolean;
  /** Optional vertex-attribute tagger when clearGlassMat & frostedGlassMat share a single unified Plaza/Conservatory glass material. */
  tagFrostedGlassGeometry?: (geo: THREE.BufferGeometry) => THREE.BufferGeometry;
}

/**
 * Tags a geometry's `color` attribute (`r = 0.50`) so `createUnifiedPlazaAndConservatoryGlassMaterial`
 * renders double-sided milky frosted conservatory glass on tagged panes while keeping untagged Plaza
 * glass (`r = 1.0`, auto-filled by `bakeStaticGroupMeshes`) crystal-clear — all inside ONE draw call!
 */
export function tagFrostedGlassGeometry(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const target = geo.index ? geo.toNonIndexed() : geo.clone();
  const pos = target.getAttribute('position');
  if (pos && pos.count > 0) {
    const colArr = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const idx = i * 3;
      colArr[idx] = 0.5;
      colArr[idx + 1] = 1.0;
      colArr[idx + 2] = 1.0;
    }
    target.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  }
  return target;
}

/**
 * Single shared glass material for Central Plaza (`westPlantGroup`) that renders BOTH:
 * - Crystal-clear `#d6f4ff` glass (`vFrostMaskFlag == 0.0`) on Plaza balustrades, kiosks & pastry cases, AND
 * - Double-sided milky frosted conservatory glass (`sedikit buram`, `vFrostMaskFlag == 1.0`) on Rumah Kaca Cafe panes,
 * allowing `bakeStaticGroupMeshes(westPlantGroup)` to merge ALL glass into 1 pre-existing static mesh (`+0` extra draw calls)!
 */
export function createUnifiedPlazaAndConservatoryGlassMaterial(): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#d6f4ff',
    vertexColors: true,
    transparent: true,
    opacity: 0.34,
    roughness: 0.14,
    metalness: 0.06,
    clearcoat: 0.72,
    clearcoatRoughness: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  mat.customProgramCacheKey = () => 'plaza-unified-clear-and-frosted-glass-v1';
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vFrostWorldPos;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vFrostWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vFrostWorldPos;
float cafeUniFrostHash31( vec3 p ) {
  p = fract( p * 0.1031 );
  p += dot( p, p.yzx + 33.33 );
  return fract( ( p.x + p.y ) * p.z );
}
float cafeUniFrostSmoothNoise( vec3 x ) {
  vec3 i = floor( x );
  vec3 f = fract( x );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix(
    mix(
      mix( cafeUniFrostHash31( i + vec3( 0.0, 0.0, 0.0 ) ), cafeUniFrostHash31( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ),
      mix( cafeUniFrostHash31( i + vec3( 0.0, 1.0, 0.0 ) ), cafeUniFrostHash31( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ),
      f.y
    ),
    mix(
      mix( cafeUniFrostHash31( i + vec3( 0.0, 0.0, 1.0 ) ), cafeUniFrostHash31( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ),
      mix( cafeUniFrostHash31( i + vec3( 0.0, 1.0, 1.0 ) ), cafeUniFrostHash31( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ),
      f.y
    ),
    f.z
  );
}`,
      )
      .replace(
        '#include <color_fragment>',
        `float vFrostMaskFlag = 1.0 - step( 0.80, vColor.r );`,
      )
      .replace(
        '#include <opaque_fragment>',
        `if ( vFrostMaskFlag > 0.5 ) {
  vec3 frostViewDir = normalize( vViewPosition );
  float frostNdotV = abs( dot( normalize( normal ), frostViewDir ) );
  float frostFresnel = pow( clamp( 1.0 - frostNdotV, 0.0, 1.0 ), 2.0 );
  float frostCloud = cafeUniFrostSmoothNoise( vFrostWorldPos * 1.85 ) * 0.52 + cafeUniFrostSmoothNoise( vFrostWorldPos * 4.8 ) * 0.30;
  float frostSatin = cafeUniFrostSmoothNoise( vFrostWorldPos * 26.0 ) * 0.18;
  float frostDiag = 0.5 + 0.5 * sin( ( vFrostWorldPos.x * 0.85 + vFrostWorldPos.y * 1.25 + vFrostWorldPos.z * 0.85 ) * 2.9 );
  float frostPattern = clamp( frostCloud + frostSatin + frostDiag * 0.10, 0.0, 1.0 );
  vec3 milkyFrostTint = mix( vec3( 0.83, 0.93, 0.98 ), vec3( 0.96, 0.99, 1.0 ), frostPattern );
  outgoingLight = mix( outgoingLight, milkyFrostTint, clamp( 0.32 + frostPattern * 0.18 + frostFresnel * 0.34, 0.0, 0.84 ) );
  diffuseColor.a = clamp( 0.24 + frostPattern * 0.11 + frostFresnel * 0.22, 0.24, 0.54 );
}
#include <opaque_fragment>`,
      );
  };

  return mat;
}

/**
 * Double-sided (`THREE.DoubleSide`) subtle frosted conservatory glass (`sedikit buram`):
 * - Uses continuous 3D world-space multi-octave satin frost noise + diagonal conservatory sheen
 *   so wall bays, arched fanlights, double doors, curved barrel-vault roofs, and gable caps
 *   all render uniform, distortion-free frosted glass from BOTH inside and outside views!
 * - Symmetric `abs(dot(normal, viewDir))` Fresnel softly increases milky frost glow on curved vaults & side bays.
 */
export function createFrostedConservatoryGlassMaterial(): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#e6f4f9',
    transparent: true,
    opacity: 0.28,
    roughness: 0.46,
    metalness: 0.04,
    clearcoat: 0.85,
    clearcoatRoughness: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  });

  mat.customProgramCacheKey = () => 'cafe-double-sided-frosted-glass-v2';
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vFrostWorldPos;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vFrostWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vFrostWorldPos;
float cafeFrostHash31( vec3 p ) {
  p = fract( p * 0.1031 );
  p += dot( p, p.yzx + 33.33 );
  return fract( ( p.x + p.y ) * p.z );
}
float cafeFrostSmoothNoise( vec3 x ) {
  vec3 i = floor( x );
  vec3 f = fract( x );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix(
    mix(
      mix( cafeFrostHash31( i + vec3( 0.0, 0.0, 0.0 ) ), cafeFrostHash31( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ),
      mix( cafeFrostHash31( i + vec3( 0.0, 1.0, 0.0 ) ), cafeFrostHash31( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ),
      f.y
    ),
    mix(
      mix( cafeFrostHash31( i + vec3( 0.0, 0.0, 1.0 ) ), cafeFrostHash31( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ),
      mix( cafeFrostHash31( i + vec3( 0.0, 1.0, 1.0 ) ), cafeFrostHash31( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ),
      f.y
    ),
    f.z
  );
}`,
      )
      .replace(
        '#include <opaque_fragment>',
        `{
  vec3 frostViewDir = normalize( vViewPosition );
  float frostNdotV = abs( dot( normalize( normal ), frostViewDir ) );
  float frostFresnel = pow( clamp( 1.0 - frostNdotV, 0.0, 1.0 ), 2.0 );
  float frostCloud = cafeFrostSmoothNoise( vFrostWorldPos * 1.85 ) * 0.52 + cafeFrostSmoothNoise( vFrostWorldPos * 4.8 ) * 0.30;
  float frostSatin = cafeFrostSmoothNoise( vFrostWorldPos * 26.0 ) * 0.18;
  float frostDiag = 0.5 + 0.5 * sin( ( vFrostWorldPos.x * 0.85 + vFrostWorldPos.y * 1.25 + vFrostWorldPos.z * 0.85 ) * 2.9 );
  float frostPattern = clamp( frostCloud + frostSatin + frostDiag * 0.10, 0.0, 1.0 );
  vec3 milkyFrostTint = mix( vec3( 0.83, 0.93, 0.98 ), vec3( 0.96, 0.99, 1.0 ), frostPattern );
  outgoingLight = mix( outgoingLight, milkyFrostTint, clamp( 0.32 + frostPattern * 0.18 + frostFresnel * 0.34, 0.0, 0.84 ) );
  diffuseColor.a = clamp( 0.24 + frostPattern * 0.11 + frostFresnel * 0.22, 0.24, 0.54 );
}
#include <opaque_fragment>`,
      );
  };

  return mat;
}

export function createDefaultCafeAssetStyler(): CafeAssetStyler {
  const clearGlassMat = new THREE.MeshPhysicalMaterial({
    color: '#dff6ff',
    transparent: true,
    opacity: 0.22,
    roughness: 0.08,
    metalness: 0.04,
    clearcoat: 0.65,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const frostedGlassMat = createFrostedConservatoryGlassMaterial();

  const outlineMat = new THREE.MeshBasicMaterial({
    color: '#12121e',
    side: THREE.BackSide,
  });

  return {
    clearGlassMat,
    frostedGlassMat,
    preserveTextures: true,
    styleOpaque: (mesh, geo, colorHex, strokeW = 0.005, opts) => {
      const usePhysical =
        (opts?.clearcoat ?? 0) > 0 || (opts?.sheen ?? 0) > 0 || (opts?.metalness ?? 0) > 0.15;
      const matParams: THREE.MeshPhysicalMaterialParameters = {
        color: opts?.tex && !opts?.tintTex ? '#ffffff' : colorHex,
        map: opts?.tex ?? null,
        bumpMap: opts?.bumpMap ?? null,
        bumpScale: opts?.bumpScale ?? 0.008,
        roughness: opts?.roughness ?? 0.62,
        metalness: opts?.metalness ?? 0.05,
        flatShading: opts?.flatShading ?? false,
        side: opts?.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
        emissive: opts?.emissiveHex ? new THREE.Color(opts.emissiveHex) : new THREE.Color(0x000000),
        emissiveIntensity: opts?.emissiveIntensity ?? 0,
      };
      if (usePhysical) {
        matParams.clearcoat = opts?.clearcoat ?? 0.28;
        matParams.clearcoatRoughness = opts?.clearcoatRoughness ?? 0.24;
        if (opts?.sheen) {
          matParams.sheen = opts.sheen;
          matParams.sheenRoughness = opts.sheenRoughness ?? 0.48;
          matParams.sheenColor = new THREE.Color('#fff7eb');
        }
        mesh.material = new THREE.MeshPhysicalMaterial(matParams);
      } else {
        mesh.material = new THREE.MeshStandardMaterial(matParams);
      }
      mesh.castShadow = opts?.castShadow ?? false;
      mesh.receiveShadow = opts?.receiveShadow ?? true;
      mesh.raycast = () => {};
      if (strokeW > 0 && geo.attributes.position) {
        const stroke = new THREE.Mesh(geo, outlineMat);
        stroke.scale.setScalar(1 + Math.min(0.032, strokeW * 2.0));
        stroke.raycast = () => {};
        mesh.add(stroke);
      }
      return mesh;
    },
  };
}

// ---------------------------------------------------------------------------
// HANA MODEL HOUSE-GRADE ROUNDED GEOMETRY & TRIPLANAR UV HELPERS
// ---------------------------------------------------------------------------

/** Welds coincident vertices and recomputes smooth vertex normals (`Ee` in Hana's House). */
export function weldSmoothGeo(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  geo.deleteAttribute('normal');
  const merged = mergeVertices(geo, 1e-4);
  merged.computeVertexNormals();
  return merged;
}

/** Projects distortion-free triplanar UVs in meters across rounded boxes & extruded shapes (`ir` in Hana's House). */
export function applyBoxProjectedUvs(geo: THREE.BufferGeometry, uvScale = 1.0): THREE.BufferGeometry {
  const target = geo.index ? geo.toNonIndexed() : geo;
  const pos = target.attributes.position;
  const uvs = new Float32Array(pos.count * 2);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    e1.subVectors(c, b);
    e2.subVectors(a, b);
    normal.crossVectors(e1, e2);
    const nx = Math.abs(normal.x);
    const ny = Math.abs(normal.y);
    const nz = Math.abs(normal.z);

    for (let k = 0; k < 3; k++) {
      const v = k === 0 ? a : k === 1 ? b : c;
      let u = 0;
      let w = 0;
      if (nx >= ny && nx >= nz) {
        u = v.z * Math.sign(normal.x || 1);
        w = v.y;
      } else if (ny >= nz) {
        u = v.x;
        w = v.z * Math.sign(normal.y || 1);
      } else {
        u = -v.x * Math.sign(normal.z || 1);
        w = v.y;
      }
      uvs[(i + k) * 2] = u * uvScale;
      uvs[(i + k) * 2 + 1] = w * uvScale;
    }
  }
  target.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  target.computeVertexNormals();
  return target;
}

/** Rounded-corner box (`RoundedBoxGeometry`) with automatic clamp radius + triplanar UVs. */
export function makeRoundedBoxGeo(
  w: number,
  h: number,
  d: number,
  radius = 0.022,
  segments = 3,
  uvScale = 0.65,
): THREE.BufferGeometry {
  const safeR = Math.min(radius, Math.min(w, h, d) / 2.05);
  const raw = new RoundedBoxGeometry(w, h, d, segments, Math.max(0.002, safeR));
  return applyBoxProjectedUvs(raw, uvScale);
}

/** Crowned upholstery cushion (`Je` in Hana's House) for plush banquette seats & pads. */
export function makePuffedCushionGeo(
  w: number,
  h: number,
  d: number,
  radius = 0.055,
  crown = 0.024,
): THREE.BufferGeometry {
  const raw = new RoundedBoxGeometry(w, h, d, 4, Math.min(radius, Math.min(w, h, d) / 2.02));
  const pos = raw.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i) / Math.max(0.01, w * 0.5);
    const nz = pos.getZ(i) / Math.max(0.01, d * 0.5);
    const y = pos.getY(i);
    if (y > 0) {
      const dome = Math.max(0, 1 - nx * nx) * Math.max(0, 1 - nz * nz);
      pos.setY(i, y + crown * dome * (y / Math.max(0.01, h * 0.5)));
    }
  }
  const smooth = weldSmoothGeo(raw);
  return applyBoxProjectedUvs(smooth, 0.8);
}

/** Turned LatheGeometry with calibrated cylindrical UVs (`Ft` in Hana's House). */
export function makeTurnedLatheGeo(profile: Array<[number, number]>, segs = 28): THREE.LatheGeometry {
  const lathe = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segs,
  );
  const maxR = Math.max(0.05, ...profile.map((p) => p[0]));
  const maxY = Math.max(0.05, ...profile.map((p) => p[1]));
  const uv = lathe.attributes.uv;
  const pos = lathe.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * Math.max(1.5, Math.PI * 2 * maxR * 3), (pos.getY(i) / maxY) * 1.4);
  }
  lathe.computeVertexNormals();
  return lathe;
}

/** Sculpted folded & gracefully arched botanical leaf (`Ro` in Hana's House) calibrated for veined leaf texture. */
export function makeCurvedBotanicalLeafGeo(
  length: number,
  width: number,
  opts: { fold?: number; arch?: number; notched?: boolean } = {},
): THREE.BufferGeometry {
  const fold = opts.fold ?? 0.22;
  const arch = opts.arch ?? 0.14;
  const cols = 6;
  const rows = 8;
  const geo = new THREE.PlaneGeometry(width, length, cols, rows);
  geo.translate(0, length * 0.5, 0);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const rawX = pos.getX(i);
    const y = pos.getY(i);
    const t = Math.max(0, Math.min(1, y / Math.max(0.001, length))); // 0 base -> 1 tip
    const uLat = rawX / Math.max(0.001, width * 0.5); // -1 .. +1
    // Ovate leaf silhouette envelope
    let widthEnv = Math.sin(Math.pow(t, 0.68) * Math.PI);
    // Monstera fenestration notches on outer edge bands
    if (opts.notched && Math.abs(uLat) > 0.55) {
      const notchWave = Math.sin(t * Math.PI * 5.0);
      if (notchWave < -0.25) {
        widthEnv *= 0.42;
      }
    }
    const x = rawX * Math.max(0.06, widthEnv);
    const foldZ = Math.abs(uLat) * fold * width * 0.5 * (1 - t * 0.35);
    const archZ = -arch * length * t * t;
    pos.setXYZ(i, x, y * (1 - 0.14 * t * t), foldZ + archZ);
    uv.setXY(i, uLat * 0.5 + 0.5, t);
  }
  geo.computeVertexNormals();
  return geo;
}

function addPart(
  parent: THREE.Object3D,
  styler: CafeAssetStyler,
  geo: THREE.BufferGeometry,
  colorHex: string,
  pos: [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
  strokeW = 0.005,
  opts?: Parameters<CafeAssetStyler['styleOpaque']>[4],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geo);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.rotation.set(rot[0], rot[1], rot[2]);
  styler.styleOpaque(mesh, geo, colorHex, strokeW, opts);
  parent.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------
// HANA-GRADE 512px PROCEDURAL TACTILE TEXTURE GENERATORS (Zero external assets)
// ---------------------------------------------------------------------------

function seededRand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createHerringboneParquetTexture(repeatX = 6, repeatY = 5): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  if (ctx) {
    const rnd = seededRand(81294);
    ctx.fillStyle = '#bc8447';
    ctx.fillRect(0, 0, S, S);
    const tones = ['#c89356', '#b77f42', '#d39f63', '#ae773c', '#c18a4e'];
    const stripW = 32;
    const plankL = 96;
    ctx.save();
    for (let row = -6; row < 22; row++) {
      for (let col = -6; col < 22; col++) {
        const isA = (row + col) % 2 === 0;
        const px = col * stripW;
        const py = row * stripW;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(isA ? Math.PI / 4 : -Math.PI / 4);
        ctx.fillStyle = tones[Math.abs(row * 7 + col * 13) % tones.length];
        ctx.fillRect(0, 0, plankL, stripW - 1);
        ctx.strokeStyle = '#6f461f';
        ctx.lineWidth = 2;
        ctx.strokeRect(0.5, 0.5, plankL - 1, stripW - 1.5);
        // Subtle cathedral & streak grain inside each parquet strip
        for (let g = 0; g < 3; g++) {
          ctx.strokeStyle = g % 2 === 0 ? 'rgba(104,64,26,0.22)' : 'rgba(246,214,165,0.16)';
          ctx.lineWidth = 1.1;
          const gy = 6 + g * 8 + (rnd() - 0.5) * 3;
          ctx.beginPath();
          ctx.moveTo(4, gy);
          ctx.bezierCurveTo(plankL * 0.33, gy + 2, plankL * 0.66, gy - 2, plankL - 4, gy);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}

export function createWarmOakWoodTexture(repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  if (ctx) {
    const rnd = seededRand(20261112);
    ctx.fillStyle = '#c89558';
    ctx.fillRect(0, 0, S, S);
    const planks = 6;
    const ph = S / planks;
    for (let p = 0; p < planks; p++) {
      ctx.fillStyle = p % 2 === 0 ? 'rgba(246,222,178,0.14)' : 'rgba(145,98,46,0.12)';
      ctx.fillRect(0, p * ph, S, ph);
      ctx.fillStyle = 'rgba(110,72,30,0.24)';
      ctx.fillRect(0, p * ph, S, 1.5);
    }
    for (let k = 0; k < 180; k++) {
      const y0 = rnd() * S;
      ctx.strokeStyle = rnd() > 0.48 ? 'rgba(245,220,174,0.28)' : 'rgba(128,84,38,0.26)';
      ctx.lineWidth = 0.8 + rnd() * 2.5;
      ctx.beginPath();
      ctx.moveTo(-8, y0);
      for (let x = 0; x <= S + 16; x += 28) {
        ctx.lineTo(x, y0 + Math.sin((x / S) * Math.PI * (1 + rnd())) * 4.0 + (rnd() - 0.5) * 2.0);
      }
      ctx.stroke();
    }
    for (let k = 0; k < 5; k++) {
      const kx = 48 + rnd() * (S - 96);
      const ky = 40 + rnd() * (S - 80);
      for (let r = 10; r > 1.5; r -= 2.2) {
        ctx.strokeStyle = 'rgba(110,72,30,0.20)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(kx, ky, r * 2.8, r * 0.9, 0.1, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}

export function createFlutedOakTexture(repeatX = 3, repeatY = 1): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  if (ctx) {
    const rnd = seededRand(40119);
    ctx.fillStyle = '#ad753f';
    ctx.fillRect(0, 0, S, S);
    const slats = 16;
    const sw = S / slats;
    for (let i = 0; i < slats; i++) {
      const grad = ctx.createLinearGradient(i * sw, 0, (i + 1) * sw, 0);
      grad.addColorStop(0, '#5a3616');
      grad.addColorStop(0.16, '#b57b42');
      grad.addColorStop(0.48, '#d49a5f');
      grad.addColorStop(0.84, '#9a6331');
      grad.addColorStop(1, '#4f2e12');
      ctx.fillStyle = grad;
      ctx.fillRect(i * sw, 0, sw, S);
      // Vertical grain highlights along each half-round oak dowel
      for (let g = 0; g < 6; g++) {
        const gx = i * sw + 4 + rnd() * (sw - 8);
        ctx.strokeStyle = g % 2 === 0 ? 'rgba(255,228,185,0.16)' : 'rgba(90,54,22,0.18)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx + (rnd() - 0.5) * 3, S);
        ctx.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}

export function createCarraraMarbleTexture(): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  if (ctx) {
    const rnd = seededRand(99201);
    const bg = ctx.createLinearGradient(0, 0, S, S);
    bg.addColorStop(0, '#f9f6f0');
    bg.addColorStop(0.5, '#f2ede3');
    bg.addColorStop(1, '#ede6da');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, S, S);
    // Primary grey mineral veins
    for (let i = 0; i < 14; i++) {
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(132, 136, 146, 0.34)' : 'rgba(176, 168, 154, 0.24)';
      ctx.lineWidth = i % 3 === 0 ? 3.2 : 1.6;
      const sx = rnd() * S;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.bezierCurveTo(sx + (rnd() - 0.5) * 140, S * 0.35, sx + (rnd() - 0.5) * 140, S * 0.68, sx + (rnd() - 0.5) * 90, S);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

export function createStonewareCeramicTexture(): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  if (ctx) {
    const rnd = seededRand(718293);
    const grad = ctx.createLinearGradient(0, 0, 0, S);
    grad.addColorStop(0, '#fcf9f2');
    grad.addColorStop(0.55, '#f0e7d8');
    grad.addColorStop(1, '#dfd1bc');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 6) {
      ctx.fillStyle = (y / 6) % 2 === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(165,148,125,0.20)';
      ctx.fillRect(0, y, S, 2.5);
    }
    for (let k = 0; k < 1800; k++) {
      ctx.fillStyle = rnd() > 0.35 ? 'rgba(118,98,76,0.26)' : 'rgba(255,252,244,0.28)';
      ctx.beginPath();
      ctx.arc(rnd() * S, rnd() * S, 0.8 + rnd() * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

export function createStitchedLeatherTexture(): THREE.CanvasTexture {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  if (ctx) {
    const rnd = seededRand(33812);
    const grad = ctx.createLinearGradient(0, 0, 0, S);
    grad.addColorStop(0, '#cb7c4a');
    grad.addColorStop(0.5, '#bb6d3d');
    grad.addColorStop(1, '#a95e30');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, S, S);
    for (let k = 0; k < 1400; k++) {
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,220,185,0.10)' : 'rgba(85,40,15,0.12)';
      ctx.fillRect(rnd() * S, rnd() * S, 2.5, 2.5);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = 4;
  return tex;
}

export function createBotanicalLeafTexture(): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, S, 0);
    grad.addColorStop(0, '#448a42');
    grad.addColorStop(0.45, '#59a653');
    grad.addColorStop(0.5, '#9ed988');
    grad.addColorStop(0.55, '#59a653');
    grad.addColorStop(1, '#448a42');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(232,250,206,0.85)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(S * 0.5, 0);
    ctx.lineTo(S * 0.5, S);
    ctx.stroke();
    for (let k = 1; k <= 9; k++) {
      const y0 = (k / 10) * S;
      const yTip = Math.min(S, y0 + S * 0.08);
      ctx.strokeStyle = 'rgba(218,246,192,0.62)';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(S * 0.5, y0);
      ctx.quadraticCurveTo(S * 0.28, y0 + 10, S * 0.04, yTip);
      ctx.moveTo(S * 0.5, y0);
      ctx.quadraticCurveTo(S * 0.72, y0 + 10, S * 0.96, yTip);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  return tex;
}

export function createBrushedMetalTexture(): THREE.CanvasTexture {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  if (ctx) {
    const rnd = seededRand(884120);
    const grad = ctx.createLinearGradient(0, 0, S, S);
    grad.addColorStop(0, '#cfd6df');
    grad.addColorStop(0.5, '#eaedf2');
    grad.addColorStop(1, '#bac3cf');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, S, S);
    for (let k = 0; k < 300; k++) {
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.24)' : 'rgba(85,95,110,0.20)';
      ctx.fillRect(0, rnd() * S, S, 1 + rnd() * 1.4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = 4;
  return tex;
}

export function createSandstoneFlagstoneTexture(repeatX = 4, repeatY = 3): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  if (ctx) {
    const rnd = seededRand(61294);
    ctx.fillStyle = '#9e9282';
    ctx.fillRect(0, 0, S, S);
    const tones = ['#ddd4c5', '#d2c7b6', '#e3dacb', '#c8bcab', '#dad0c0'];
    const rows = 6;
    const rowH = S / rows;
    for (let r = 0; r < rows; r++) {
      let x = -(r % 2) * 42;
      let colIdx = 0;
      while (x < S) {
        const w = 78 + Math.floor(rnd() * 44);
        ctx.fillStyle = tones[(r * 5 + colIdx * 3) % tones.length];
        ctx.fillRect(x + 3, r * rowH + 3, w - 6, rowH - 6);
        ctx.strokeStyle = 'rgba(118,106,92,0.45)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 3, r * rowH + 3, w - 6, rowH - 6);
        x += w;
        colIdx += 1;
      }
    }
    for (let k = 0; k < 1800; k++) {
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,250,242,0.12)' : 'rgba(95,84,72,0.12)';
      ctx.fillRect(rnd() * S, rnd() * S, 2.2, 2.2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}

export function createRattanCaneTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#8b6337';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#dcb87e';
    ctx.lineWidth = 3;
    const step = 16;
    for (let i = -128; i < 256; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 128, 128);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i + 128, 0);
      ctx.lineTo(i, 128);
      ctx.stroke();
    }
    ctx.strokeStyle = '#c89e62';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 128; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 128);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(128, i);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

export function createChalkboardMenuTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 512, 256);
    grad.addColorStop(0, '#21272a');
    grad.addColorStop(0.5, '#2b3236');
    grad.addColorStop(1, '#1d2225');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    ctx.strokeStyle = 'rgba(240, 238, 228, 0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(14, 14, 484, 228);

    ctx.fillStyle = '#f3efe0';
    ctx.font = 'italic bold 30px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Menu', 256, 46);

    ctx.strokeStyle = 'rgba(243, 239, 224, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(185, 56);
    ctx.lineTo(327, 56);
    ctx.stroke();

    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'left';
    const leftItems = [
      ['Espresso', '3 LUL'],
      ['Caramel Latte', '10 LUL'],
      ['Hot Choco Mocha', '6 LUL'],
      ['Botanical Iced', '3 LUL'],
    ];
    leftItems.forEach(([name, price], i) => {
      const y = 94 + i * 36;
      ctx.fillStyle = '#e7e2d3';
      ctx.fillText(name, 36, y);
      ctx.fillStyle = '#facc15';
      ctx.fillText(price, 200, y);
    });

    const rightItems = [
      ['Pastries', ''],
      ['Butter Croissant', '3 LUL'],
      ['Cinnamon Roll', '6 LUL'],
      ['Club Sandwich', '10 LUL'],
    ];
    rightItems.forEach(([name, price], i) => {
      const y = 94 + i * 36;
      ctx.fillStyle = i === 0 ? '#a7f3d0' : '#e7e2d3';
      ctx.fillText(name, 286, y);
      if (price) {
        ctx.fillStyle = '#facc15';
        ctx.fillText(price, 434, y);
      }
    });
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWorkShiftBoardFaceTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 568;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (ctx) {
    // Satin off-white magnetic enamel face
    ctx.fillStyle = '#edf1f4';
    ctx.fillRect(0, 0, W, H);

    // Subtle recessed inner frame shadow
    ctx.strokeStyle = '#9aa5b1';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, W - 16, H - 16);

    // Top Station Operations Navy Header Band
    ctx.fillStyle = '#263850';
    ctx.fillRect(14, 14, W - 28, 62);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 25px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('STATION OPERATIONS // SHIFT ROSTER & PERSONNEL BOARD', 32, 46);

    // Sub-header row: Digital LED Clock + Active Shift Status
    ctx.fillStyle = '#1f2937';
    ctx.font = 'italic 700 22px sans-serif';
    ctx.fillText('Digital LED Clock', 112, 112);

    // Digital LED Clock Housing (08:00:00)
    ctx.fillStyle = '#1c242b';
    ctx.fillRect(318, 86, 178, 48);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.strokeRect(318, 86, 178, 48);
    ctx.fillStyle = '#334155';
    ctx.font = '700 30px monospace';
    ctx.fillText('88:88:88', 334, 111);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('08:00:00', 334, 111);

    // ACTIVE SHIFT illuminated badge
    ctx.fillStyle = '#2d4f3e';
    ctx.fillRect(516, 86, 98, 48);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(516, 86, 98, 48);
    ctx.fillStyle = '#a7f3d0';
    ctx.font = '800 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ACTIVE', 565, 103);
    ctx.fillText('SHIFT', 565, 121);

    // Magnetic Roster Grid (Left 70% panel: x = 28..732, y = 148..540)
    const gx = 28;
    const gy = 148;
    const gw = 704;
    const gh = 392;
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(gx, gy, gw, gh);

    // Table header bands
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(gx, gy, gw, 50);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(gx, gy, gw, gh);

    const colPersonnelW = 156;
    const colTimeSlotW = 34;
    const numTimeCols = 9;
    const colTimeTotalW = colTimeSlotW * numTimeCols; // 306
    const colZoneSubW = 122; // split into 2 sub-cols

    // Vertical column dividers
    const xTimeStart = gx + colPersonnelW;
    const xZone1Start = xTimeStart + colTimeTotalW;
    const xZone2Start = xZone1Start + colZoneSubW;

    ctx.beginPath();
    ctx.moveTo(xTimeStart, gy);
    ctx.lineTo(xTimeStart, gy + gh);
    ctx.moveTo(xZone1Start, gy);
    ctx.lineTo(xZone1Start, gy + gh);
    ctx.moveTo(xZone2Start, gy);
    ctx.lineTo(xZone2Start, gy + gh);
    // Mid-header horizontal split for Time 1..9 & Zone sub-tags
    ctx.moveTo(xTimeStart, gy + 25);
    ctx.lineTo(xZone2Start, gy + 25);
    ctx.stroke();

    // Time sub-columns 1..9
    ctx.font = '700 14px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    for (let t = 0; t < numTimeCols; t++) {
      const cx = xTimeStart + t * colTimeSlotW;
      if (t > 0) {
        ctx.beginPath();
        ctx.moveTo(cx, gy + 25);
        ctx.lineTo(cx, gy + gh);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      ctx.fillText(String(t + 1), cx + colTimeSlotW * 0.5, gy + 38);
    }

    // Zone sub-columns
    const xZoneSubMid = xZone1Start + 72;
    ctx.beginPath();
    ctx.moveTo(xZoneSubMid, gy + 25);
    ctx.lineTo(xZoneSubMid, gy + gh);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = '800 16px sans-serif';
    ctx.fillText('Personnel', gx + colPersonnelW * 0.5, gy + 26);
    ctx.fillText('Time', xTimeStart + colTimeTotalW * 0.5, gy + 14);
    ctx.font = '800 14px sans-serif';
    ctx.fillText('Zone Tags', xZone1Start + colZoneSubW * 0.5, gy + 14);
    ctx.font = '700 12px sans-serif';
    ctx.fillText('Position', xZone1Start + 36, gy + 38);
    ctx.fillText('Out', xZoneSubMid + 25, gy + 38);
    ctx.font = '800 15px sans-serif';
    ctx.fillText('Zone Tags', xZone2Start + (gx + gw - xZone2Start) * 0.5, gy + 26);

    // 13 Roster Rows
    const bodyStartY = gy + 50;
    const rows = 13;
    const rowH = (gh - 50) / rows;
    for (let r = 0; r < rows; r++) {
      const ry = bodyStartY + r * rowH;
      if (r % 2 === 1) {
        ctx.fillStyle = 'rgba(203, 213, 225, 0.38)';
        ctx.fillRect(gx + 1, ry, gw - 2, rowH);
      }
      ctx.beginPath();
      ctx.moveTo(gx, ry);
      ctx.lineTo(gx + gw, ry);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.3;
      ctx.stroke();

      if (r < 4) {
        ctx.fillStyle = '#0f172a';
        ctx.font = '700 14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`Personnel ${r + 1}`, gx + 10, ry + rowH * 0.54);
      }
    }

    // Right Accessory Bay Panel border (Key Rack + Magnetic Clips + Document Pocket)
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(752, 148, 244, 392);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.strokeRect(752, 148, 244, 392);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Lazy singleton shared textures so multiple builders reuse GPU memory cleanly
let cachedTextures: {
  oak?: THREE.CanvasTexture;
  stoneware?: THREE.CanvasTexture;
  leather?: THREE.CanvasTexture;
  leaf?: THREE.CanvasTexture;
  metal?: THREE.CanvasTexture;
} = {};

function getSharedTextures(styler?: CafeAssetStyler): {
  oak: THREE.CanvasTexture | null;
  stoneware: THREE.CanvasTexture | null;
  leather: THREE.CanvasTexture | null;
  leaf: THREE.CanvasTexture | null;
  metal: THREE.CanvasTexture | null;
} {
  if (styler?.preserveTextures === false || typeof document === 'undefined') {
    return { oak: null, stoneware: null, leather: null, leaf: null, metal: null };
  }
  if (!cachedTextures.oak) {
    cachedTextures = {
      oak: createWarmOakWoodTexture(1, 1),
      stoneware: createStonewareCeramicTexture(),
      leather: createStitchedLeatherTexture(),
      leaf: createBotanicalLeafTexture(),
      metal: createBrushedMetalTexture(),
    };
  }
  return cachedTextures as Required<typeof cachedTextures>;
}

// ---------------------------------------------------------------------------
// 1:1 SCULPTED ROUNDED PROP BUILDERS (Hana Model House Craftsmanship)
// ---------------------------------------------------------------------------

/** Commercial Coffee Grinder with chamfered housing, lathe collar & touchscreen nose */
export function buildCommercialCoffeeGrinder(styler: CafeAssetStyler, scale = 1.0): THREE.Group {
  const g = new THREE.Group();
  const { metal } = getSharedTextures();

  // Chamfered base plate & spun horseshoe drip tray
  addPart(g, styler, makeRoundedBoxGeo(0.22, 0.032, 0.28, 0.01), '#545c66', [0, 0.016, 0.02], [0, 0, 0], 0.004, {
    tex: metal,
    metalness: 0.48,
    roughness: 0.34,
    clearcoat: 0.3,
  });
  addPart(g, styler, makeTurnedLatheGeo([[0.0, 0], [0.105, 0], [0.108, 0.016], [0.092, 0.018], [0, 0.012]], 20), '#9ca3af', [0, 0.026, 0.14], [0, 0, 0], 0.003, {
    tex: metal,
    metalness: 0.56,
    roughness: 0.28,
  });

  // Tapered spun-metal body (smooth LatheGeometry)
  const bodyGeo = makeTurnedLatheGeo([
    [0.095, 0.0],
    [0.108, 0.03],
    [0.098, 0.16],
    [0.084, 0.30],
    [0.068, 0.33],
    [0.0, 0.33],
  ], 24);
  addPart(g, styler, bodyGeo, '#d4d8df', [0, 0.03, -0.02], [0, 0, 0], 0.004, {
    tex: metal,
    metalness: 0.42,
    roughness: 0.30,
    clearcoat: 0.35,
  });

  // Rounded charcoal touchscreen nose & chute
  addPart(g, styler, makeRoundedBoxGeo(0.115, 0.135, 0.09, 0.018), '#262b34', [0, 0.25, 0.07], [-0.15, 0, 0], 0.004, { roughness: 0.40, clearcoat: 0.25 });
  addPart(g, styler, makeRoundedBoxGeo(0.082, 0.052, 0.014, 0.004), '#60a5fa', [0, 0.27, 0.114], [-0.15, 0, 0], 0, {
    emissiveHex: '#38bdf8',
    emissiveIntensity: 0.52,
  });
  addPart(g, styler, new THREE.CylinderGeometry(0.018, 0.014, 0.06, 12), '#4b5563', [0, 0.17, 0.10], [0.25, 0, 0], 0.003);

  // Conical clear bean hopper + roasted espresso beans + turned lid
  const hopperMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.044, 0.20, 22),
    styler.clearGlassMat,
  );
  hopperMesh.position.set(0, 0.46, -0.02);
  hopperMesh.castShadow = false;
  hopperMesh.receiveShadow = false;
  hopperMesh.raycast = () => {};
  g.add(hopperMesh);
  addPart(g, styler, new THREE.CylinderGeometry(0.082, 0.042, 0.10, 18), '#3b2416', [0, 0.41, -0.02], [0, 0, 0], 0.003, { roughness: 0.72 });
  addPart(g, styler, makeTurnedLatheGeo([[0, 0], [0.11, 0], [0.11, 0.018], [0.02, 0.032], [0, 0.036]], 22), '#4b5563', [0, 0.56, -0.02], [0, 0, 0], 0.004, {
    metalness: 0.48,
    clearcoat: 0.35,
  });

  g.scale.setScalar(scale);
  return g;
}

/** Dual-Group Commercial Espresso Machine with Rounded Walnut Cheek Panels, Steel Housing & Turned Porcelain Cups */
export function buildDualGroupEspressoMachine(styler: CafeAssetStyler, scale = 1.0): THREE.Group {
  const g = new THREE.Group();
  const { oak, metal, stoneware } = getSharedTextures();

  // Main brushed steel rounded chassis + warm walnut side cheeks
  addPart(g, styler, makeRoundedBoxGeo(0.86, 0.36, 0.48, 0.032, 3), '#dce3ec', [0, 0.22, -0.02], [0, 0, 0], 0.004, {
    tex: metal,
    tintTex: true,
    metalness: 0.56,
    roughness: 0.26,
    clearcoat: 0.42,
  });
  for (const sx of [-0.44, 0.44]) {
    addPart(g, styler, makeRoundedBoxGeo(0.048, 0.38, 0.50, 0.016, 3), '#8a5628', [sx, 0.21, -0.02], [0, 0, 0], 0.004, {
      tex: oak,
      tintTex: true,
      roughness: 0.50,
      clearcoat: 0.26,
    });
  }
  // Cup-warmer top tray & brushed tubular guard rail
  addPart(g, styler, makeRoundedBoxGeo(0.82, 0.04, 0.44, 0.014, 3), '#94a3b8', [0, 0.41, -0.02], [0, 0, 0], 0.004, {
    tex: metal,
    metalness: 0.62,
    clearcoat: 0.35,
  });
  const railPts = [
    new THREE.Vector3(-0.38, 0.44, 0.16),
    new THREE.Vector3(-0.38, 0.47, -0.20),
    new THREE.Vector3(0.38, 0.47, -0.20),
    new THREE.Vector3(0.38, 0.44, 0.16),
  ];
  addPart(g, styler, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), 20, 0.008, 8, false), '#e2e8f0', [0, 0, 0], [0, 0, 0], 0.002, {
    metalness: 0.72,
    roughness: 0.22,
  });

  // Rounded stainless drip tray & grate
  addPart(g, styler, makeRoundedBoxGeo(0.84, 0.06, 0.18, 0.018, 3), '#64748b', [0, 0.03, 0.22], [0, 0, 0], 0.004, {
    tex: metal,
    metalness: 0.52,
    roughness: 0.32,
  });

  // Pressure dial gauge in center + twin chrome group heads, portafilters & curved steam wands
  addPart(g, styler, new THREE.CylinderGeometry(0.032, 0.032, 0.02, 16), '#f8fafc', [0, 0.32, 0.225], [Math.PI / 2, 0, 0], 0.002, {
    clearcoat: 0.65,
  });
  for (const gx of [-0.22, 0.22]) {
    addPart(g, styler, makeTurnedLatheGeo([[0.045, 0], [0.056, 0.02], [0.056, 0.07], [0.042, 0.085]], 18), '#475569', [gx, 0.20, 0.24], [0, 0, 0], 0.003, {
      metalness: 0.68,
      clearcoat: 0.4,
    });
    addPart(g, styler, new THREE.CylinderGeometry(0.016, 0.012, 0.14, 10), '#5c3c20', [gx, 0.20, 0.31], [Math.PI / 2, 0, 0], 0.003, {
      tex: oak,
      roughness: 0.5,
    });
    const wandCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(gx + 0.13, 0.26, 0.21),
      new THREE.Vector3(gx + 0.15, 0.19, 0.25),
      new THREE.Vector3(gx + 0.16, 0.11, 0.27),
    ]);
    addPart(g, styler, new THREE.TubeGeometry(wandCurve, 10, 0.007, 8, false), '#e2e8f0', [0, 0, 0], [0, 0, 0], 0.002, {
      metalness: 0.72,
    });
  }

  // Two rows of turned porcelain espresso cups & saucers on cup-warmer tray
  const saucerGeo = makeTurnedLatheGeo([[0, 0], [0.028, 0.002], [0.046, 0.012], [0.043, 0.015], [0, 0.005]], 16);
  const cupGeo = makeTurnedLatheGeo([[0, 0], [0.024, 0], [0.036, 0.052], [0.033, 0.054], [0, 0.008]], 16);
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 4; c++) {
      const cx = -0.27 + c * 0.18;
      const cz = -0.10 + r * 0.16;
      addPart(g, styler, saucerGeo, '#f8fafc', [cx, 0.432, cz], [0, 0, 0], 0.002, { tex: stoneware, clearcoat: 0.6 });
      addPart(g, styler, cupGeo, '#ffffff', [cx, 0.438, cz], [0, 0, 0], 0.002, { tex: stoneware, clearcoat: 0.65 });
    }
  }
  g.scale.setScalar(scale);
  return g;
}

/** Curved Glass Bakery & Pastry Display Case with Rounded Wood Base & Sculpted Croissants/Cinnamon Rolls */
export function buildCurvedBakeryDisplayCase(styler: CafeAssetStyler, flutedTex?: THREE.Texture | null, scale = 1.0): THREE.Group {
  const g = new THREE.Group();
  const W = 1.15;
  const D = 0.68;
  const { metal } = getSharedTextures();

  // Rounded fluted oak base cabinet + polished stainless rim
  addPart(g, styler, makeRoundedBoxGeo(W, 0.22, D, 0.022, 3), '#b87f47', [0, 0.11, 0], [0, 0, 0], 0.005, {
    tex: flutedTex,
    roughness: 0.58,
    clearcoat: 0.2,
  });
  addPart(g, styler, makeRoundedBoxGeo(W + 0.03, 0.042, D + 0.03, 0.014, 3), '#cbd5e1', [0, 0.23, 0], [0, 0, 0], 0.004, {
    tex: metal,
    metalness: 0.56,
    roughness: 0.26,
    clearcoat: 0.4,
  });

  // Rounded stainless side pillars + top light hood
  for (const sx of [-W * 0.49, W * 0.49]) {
    addPart(g, styler, makeRoundedBoxGeo(0.036, 0.62, D * 0.96, 0.012, 2), '#94a3b8', [sx, 0.54, 0], [0, 0, 0], 0.003, {
      metalness: 0.52,
      clearcoat: 0.35,
    });
  }
  addPart(g, styler, makeRoundedBoxGeo(W, 0.048, 0.34, 0.016, 3), '#cbd5e1', [0, 0.85, -D * 0.22], [0, 0, 0], 0.004, {
    tex: metal,
    metalness: 0.52,
    clearcoat: 0.4,
  });

  // Smooth curved quarter-cylinder front glass canopy
  const curvedGlassGeo = new THREE.CylinderGeometry(D * 0.85, D * 0.85, W - 0.04, 22, 1, true, 0, Math.PI * 0.46);
  curvedGlassGeo.rotateZ(Math.PI / 2);
  const curvedGlassMesh = new THREE.Mesh(curvedGlassGeo, styler.clearGlassMat);
  curvedGlassMesh.position.set(0, 0.25, -D * 0.36);
  curvedGlassMesh.castShadow = false;
  curvedGlassMesh.receiveShadow = false;
  curvedGlassMesh.raycast = () => {};
  g.add(curvedGlassMesh);

  // 3 Illuminated Pastry Shelves with Sculpted Golden Croissants, Glazed Cinnamon Rolls & Domed Muffins
  const pastryColors = ['#e09f4e', '#d97706', '#9a4612', '#f59e0b'];
  const shelfHeights = [0.27, 0.47, 0.66];
  const shelfDepths = [0.46, 0.40, 0.32];
  shelfHeights.forEach((sy, sIdx) => {
    const sd = shelfDepths[sIdx];
    addPart(g, styler, makeRoundedBoxGeo(W - 0.08, 0.022, sd, 0.008, 2), '#f1f5f9', [0, sy, -0.06], [0, 0, 0], 0.002, {
      metalness: 0.25,
      roughness: 0.28,
      clearcoat: 0.45,
    });
    for (let p = 0; p < 5; p++) {
      const px = -W * 0.36 + p * (W * 0.18);
      const col = pastryColors[(sIdx + p) % pastryColors.length];
      if ((sIdx + p) % 3 === 0) {
        // Sculpted Multi-Ring Crescent Croissant
        const croisGrp = new THREE.Group();
        croisGrp.position.set(px, sy + 0.028, -0.02);
        croisGrp.rotation.y = (p % 2 === 0 ? 0.25 : -0.25);
        g.add(croisGrp);
        for (let seg = -2; seg <= 2; seg++) {
          const rad = 0.024 - Math.abs(seg) * 0.005;
          const ang = seg * 0.42;
          addPart(
            croisGrp,
            styler,
            new THREE.SphereGeometry(rad, 10, 8),
            col,
            [Math.sin(ang) * 0.042, 0, Math.cos(ang) * 0.018 - 0.018],
            [0, 0, 0],
            0.002,
            { roughness: 0.45, clearcoat: 0.28 },
          );
        }
      } else if ((sIdx + p) % 3 === 1) {
        // Swirled Glazed Cinnamon Roll
        addPart(g, styler, new THREE.CylinderGeometry(0.048, 0.052, 0.042, 16), col, [px, sy + 0.032, -0.02], [0, 0, 0], 0.003, { roughness: 0.55 });
        addPart(g, styler, new THREE.TorusGeometry(0.025, 0.009, 8, 16), '#fef3c7', [px, sy + 0.054, -0.02], [Math.PI / 2, 0, 0], 0.002, {
          clearcoat: 0.65,
          roughness: 0.25,
        });
      } else {
        // Domed Artisan Brioche Muffin
        addPart(g, styler, makeTurnedLatheGeo([[0, 0], [0.036, 0], [0.044, 0.035], [0.048, 0.046], [0.036, 0.064], [0, 0.068]], 16), col, [px, sy + 0.011, -0.02], [0, 0, 0], 0.003, {
          roughness: 0.52,
          clearcoat: 0.22,
        });
      }
    }
  });

  g.scale.setScalar(scale);
  return g;
}

/** Vintage Spun Brushed Brass Dome Pendant Ceiling Lamp (`LatheGeometry` with Rolled Lip) */
export function buildBrassPendantLamp(styler: CafeAssetStyler, dropHeight = 1.25): THREE.Group {
  const g = new THREE.Group();
  const { metal } = getSharedTextures();
  // Ceiling canopy disc
  addPart(g, styler, makeTurnedLatheGeo([[0, 0], [0.085, 0], [0.082, 0.022], [0.03, 0.038], [0, 0.038]], 18), '#e0b252', [0, dropHeight, 0], [0, 0, 0], 0.003, {
    tex: metal,
    tintTex: true,
    metalness: 0.68,
    roughness: 0.24,
    clearcoat: 0.45,
  });
  // Braided cord
  addPart(g, styler, new THREE.CylinderGeometry(0.010, 0.010, dropHeight, 8), '#4a3726', [0, dropHeight * 0.5, 0], [0, 0, 0], 0.002);
  // Turned brass socket collar
  addPart(g, styler, makeTurnedLatheGeo([[0.024, 0], [0.048, 0.02], [0.042, 0.08], [0.032, 0.11]], 16), '#e5b858', [0, 0.14, 0], [0, 0, 0], 0.003, {
    tex: metal,
    tintTex: true,
    metalness: 0.70,
    roughness: 0.22,
  });
  // Smooth bell-curved brass dome shade with rolled outer lip
  const shadeGeo = makeTurnedLatheGeo([
    [0.042, 0.145],
    [0.12, 0.125],
    [0.195, 0.065],
    [0.232, -0.012],
    [0.240, -0.020],
    [0.226, -0.022],
  ], 28);
  addPart(g, styler, shadeGeo, '#ebb952', [0, 0.04, 0], [0, 0, 0], 0.004, {
    tex: metal,
    tintTex: true,
    metalness: 0.68,
    roughness: 0.24,
    clearcoat: 0.45,
    doubleSided: true,
  });
  // Warm glowing Edison filament bulb
  addPart(g, styler, new THREE.SphereGeometry(0.065, 14, 12), '#fff1b8', [0, -0.01, 0], [0, 0, 0], 0.002, {
    emissiveHex: '#fde047',
    emissiveIntensity: 0.98,
    roughness: 0.18,
  });
  return g;
}

/** Hanging Rounded-Oak Framed Chalkboard Menu */
export function buildHangingChalkboardMenu(
  styler: CafeAssetStyler,
  menuTex: THREE.Texture | null,
  width = 2.4,
  height = 1.05,
): THREE.Group {
  const g = new THREE.Group();
  const { oak } = getSharedTextures(styler);
  addPart(g, styler, makeRoundedBoxGeo(width + 0.16, height + 0.16, 0.065, 0.018, 3), '#9c6838', [0, 0, -0.02], [0, 0, 0], 0.005, {
    tex: oak,
    tintTex: true,
    roughness: 0.54,
    clearcoat: 0.18,
  });
  addPart(g, styler, new THREE.PlaneGeometry(width, height), '#242b2e', [0, 0, 0.015], [0, 0, 0], 0, {
    tex: menuTex,
    roughness: 0.85,
    metalness: 0.02,
  });
  if (styler.preserveTextures === false) {
    // Crisp 3D chalk header & 2-column menu/price strips so Zero-Draw-Call vertex-color baking keeps legible chalkboard detail
    addPart(g, styler, new THREE.BoxGeometry(0.56, 0.065, 0.006), '#f3efe0', [0, height * 0.34, 0.020], [0, 0, 0], 0);
    addPart(g, styler, new THREE.BoxGeometry(0.76, 0.014, 0.006), '#d4af37', [0, height * 0.24, 0.020], [0, 0, 0], 0);
    for (let row = 0; row < 4; row++) {
      const ry = height * 0.09 - row * (height * 0.145);
      // Left coffee column (item + gold price)
      addPart(g, styler, new THREE.BoxGeometry(width * 0.26, 0.036, 0.006), '#e7e2d3', [-width * 0.28, ry, 0.020], [0, 0, 0], 0);
      addPart(g, styler, new THREE.BoxGeometry(width * 0.09, 0.036, 0.006), '#facc15', [-width * 0.07, ry, 0.020], [0, 0, 0], 0);
      // Right pastry column (item + gold price)
      addPart(g, styler, new THREE.BoxGeometry(width * 0.26, 0.036, 0.006), row === 0 ? '#a7f3d0' : '#e7e2d3', [width * 0.17, ry, 0.020], [0, 0, 0], 0);
      if (row > 0) {
        addPart(g, styler, new THREE.BoxGeometry(width * 0.09, 0.036, 0.006), '#facc15', [width * 0.38, ry, 0.020], [0, 0, 0], 0);
      }
    }
  }
  for (const cx of [-width * 0.38, width * 0.38]) {
    addPart(g, styler, new THREE.CylinderGeometry(0.012, 0.012, 0.65, 8), '#3b3f46', [cx, height * 0.5 + 0.34, -0.01], [0, 0, 0], 0.003, { metalness: 0.6 });
  }
  return g;
}

/** Bentwood Rattan Cane Armchair with Bullnose Seat, Curved Cane Panel & Swept Arched Tubes */
export function buildBentwoodRattanChair(
  styler: CafeAssetStyler,
  rattanTex: THREE.Texture | null,
  scale = 1.0,
): THREE.Group {
  const g = new THREE.Group();
  const woodHex = '#b57f48';
  const { oak } = getSharedTextures();

  // 4 turned tapered oak legs with gentle splay
  for (const [lx, lz] of [
    [-0.22, -0.22],
    [0.22, -0.22],
    [-0.23, 0.22],
    [0.23, 0.22],
  ]) {
    addPart(g, styler, new THREE.CylinderGeometry(0.023, 0.016, 0.44, 12), woodHex, [lx, 0.22, lz], [0, 0, 0], 0.003, {
      tex: oak,
      roughness: 0.52,
      clearcoat: 0.2,
    });
  }
  // Lathe bullnose timber seat hoop + woven cane inset pad
  addPart(
    g,
    styler,
    makeTurnedLatheGeo([[0, 0], [0.255, 0], [0.275, 0.016], [0.275, 0.032], [0.255, 0.048], [0, 0.048]], 28),
    woodHex,
    [0, 0.415, 0],
    [0, 0, 0],
    0.004,
    { tex: oak, roughness: 0.52, clearcoat: 0.22 },
  );
  addPart(
    g,
    styler,
    makeTurnedLatheGeo([[0, 0], [0.22, 0], [0.225, 0.04], [0.21, 0.056], [0, 0.058]], 24),
    '#d9b57d',
    [0, 0.416, 0],
    [0, 0, 0],
    0.002,
    { tex: rattanTex, roughness: 0.72 },
  );

  // Smooth sweeping arched bentwood backrest hoop + curved rattan backrest pad
  const backCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.23, 0.44, -0.20),
    new THREE.Vector3(-0.22, 0.78, -0.24),
    new THREE.Vector3(0.0, 0.90, -0.25),
    new THREE.Vector3(0.22, 0.78, -0.24),
    new THREE.Vector3(0.23, 0.44, -0.20),
  ]);
  addPart(g, styler, new THREE.TubeGeometry(backCurve, 22, 0.022, 10, false), woodHex, [0, 0, 0], [0, 0, 0], 0.004, {
    tex: oak,
    roughness: 0.52,
    clearcoat: 0.2,
  });
  addPart(g, styler, makeRoundedBoxGeo(0.34, 0.32, 0.032, 0.014, 3), '#d9b57d', [0, 0.69, -0.23], [0.06, 0, 0], 0.003, {
    tex: rattanTex,
    roughness: 0.72,
  });

  // Bentwood sweeping armrests
  for (const side of [-1, 1]) {
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.22, 0.66, -0.22),
      new THREE.Vector3(side * 0.28, 0.63, 0.04),
      new THREE.Vector3(side * 0.24, 0.44, 0.16),
    ]);
    addPart(g, styler, new THREE.TubeGeometry(armCurve, 14, 0.018, 9, false), woodHex, [0, 0, 0], [0, 0, 0], 0.003, {
      tex: oak,
      roughness: 0.52,
    });
  }
  g.scale.setScalar(scale);
  return g;
}

/** Round Oak Bistro Table with Turned Cast-Iron Pedestal, Bullnose Oak Top & Ceramic Coffee Set */
export function buildRoundOakBistroTable(
  styler: CafeAssetStyler,
  scale = 1.0,
  withCoffeeSet = true,
): THREE.Group {
  const g = new THREE.Group();
  const { oak, stoneware, leaf } = getSharedTextures();

  // Turned cast-iron pedestal base + flared collar column
  const pedestalGeo = makeTurnedLatheGeo([
    [0.0, 0.0],
    [0.34, 0.0],
    [0.33, 0.024],
    [0.24, 0.046],
    [0.075, 0.075],
    [0.052, 0.22],
    [0.046, 0.68],
    [0.14, 0.72],
    [0.0, 0.72],
  ], 26);
  addPart(g, styler, pedestalGeo, '#21262e', [0, 0, 0], [0, 0, 0], 0.004, {
    metalness: 0.48,
    roughness: 0.38,
    clearcoat: 0.3,
  });

  // Turned bullnose honey-oak tabletop (32 segs + oak grain + satin clearcoat)
  const topGeo = makeTurnedLatheGeo([
    [0.0, 0.0],
    [0.52, 0.0],
    [0.545, 0.015],
    [0.548, 0.032],
    [0.545, 0.046],
    [0.52, 0.058],
    [0.0, 0.058],
  ], 32);
  addPart(g, styler, topGeo, '#c58f54', [0, 0.72, 0], [0, 0, 0], 0.005, {
    tex: oak,
    roughness: 0.48,
    clearcoat: 0.26,
    clearcoatRoughness: 0.32,
  });

  if (withCoffeeSet) {
    const saucerGeo = makeTurnedLatheGeo([[0, 0], [0.04, 0.002], [0.064, 0.012], [0.06, 0.015], [0, 0.005]], 18);
    const cupGeo = makeTurnedLatheGeo([[0, 0], [0.030, 0], [0.044, 0.054], [0.040, 0.056], [0, 0.008]], 18);
    for (const cx of [-0.21, 0.21]) {
      addPart(g, styler, saucerGeo, '#f8fafc', [cx, 0.78, 0.05], [0, 0, 0], 0.002, { tex: stoneware, clearcoat: 0.6 });
      addPart(g, styler, cupGeo, '#ffffff', [cx, 0.786, 0.05], [0, 0, 0], 0.002, { tex: stoneware, clearcoat: 0.65 });
      addPart(g, styler, new THREE.CylinderGeometry(0.036, 0.036, 0.006, 14), '#8a5832', [cx, 0.832, 0.05], [0, 0, 0], 0, { roughness: 0.2 });
    }
    // Turned translucent glass bud vase + sculpted green botanical leaves
    const vaseGeo = makeTurnedLatheGeo([[0, 0], [0.036, 0], [0.046, 0.035], [0.022, 0.095], [0.028, 0.12], [0.024, 0.12], [0.018, 0.095]], 18);
    addPart(g, styler, vaseGeo, '#7dd3fc', [0, 0.78, -0.10], [0, 0, 0], 0.002, { clearcoat: 0.75, roughness: 0.18 });
    for (let lf = 0; lf < 3; lf++) {
      const ang = (lf / 3) * Math.PI * 2 + 0.4;
      addPart(
        g,
        styler,
        makeCurvedBotanicalLeafGeo(0.11, 0.065, { fold: 0.25, arch: 0.18 }),
        '#4ca146',
        [Math.cos(ang) * 0.015, 0.89, -0.10 + Math.sin(ang) * 0.015],
        [0.48, -ang, 0],
        0.002,
        { tex: leaf, doubleSided: true },
      );
    }
  }
  g.scale.setScalar(scale);
  return g;
}

/** Tufted Caramel Leather Banquette with Puffed Crowned Cushion & High-Segment Bolsters */
export function buildTuftedLeatherBanquette(
  styler: CafeAssetStyler,
  length = 2.65,
  scale = 1.0,
): THREE.Group {
  const g = new THREE.Group();
  const { oak, leather } = getSharedTextures();
  const leatherHex = '#b86c3c';
  const leatherLightHex = '#c97b49';

  // Chamfered oak plinth base
  addPart(g, styler, makeRoundedBoxGeo(length, 0.24, 0.62, 0.022, 3), '#9a6838', [0, 0.12, 0], [0, 0, 0], 0.005, {
    tex: oak,
    roughness: 0.56,
    clearcoat: 0.18,
  });
  // Puffed crowned caramel leather cushion seat (`Je` from Hana's House!)
  addPart(
    g,
    styler,
    makePuffedCushionGeo(length + 0.02, 0.18, 0.64, 0.055, 0.028),
    leatherLightHex,
    [0, 0.33, 0.02],
    [0, 0, 0],
    0.005,
    { tex: leather, roughness: 0.46, sheen: 0.28, sheenRoughness: 0.45 },
  );
  // Smooth vertical channel-tufted backrest bolsters
  const flutes = Math.max(6, Math.round(length * 3.8));
  const fluteW = (length - 0.06) / flutes;
  for (let i = 0; i < flutes; i++) {
    const fx = -length * 0.5 + 0.03 + (i + 0.5) * fluteW;
    addPart(
      g,
      styler,
      new THREE.CapsuleGeometry(fluteW * 0.48, 0.54, 6, 12),
      i % 2 === 0 ? leatherHex : leatherLightHex,
      [fx, 0.72, -0.22],
      [0, 0, 0],
      0.004,
      { tex: leather, roughness: 0.46, sheen: 0.26, sheenRoughness: 0.48 },
    );
  }
  // Rounded oak surround trim panel
  addPart(g, styler, makeRoundedBoxGeo(length + 0.04, 0.92, 0.085, 0.024, 3), '#7a4e26', [0, 0.48, -0.31], [0, 0, 0], 0.004, {
    tex: oak,
    roughness: 0.58,
    clearcoat: 0.16,
  });
  g.scale.setScalar(scale);
  return g;
}

/** Wheel-Thrown Ceramic Potted Monstera / Fiddle-Leaf Fig on Rounded 4-Legged Oak Stand */
export function buildPottedMonsteraOnStand(
  styler: CafeAssetStyler,
  scale = 1.0,
  variant: 'monstera' | 'fiddle' = 'monstera',
): THREE.Group {
  const g = new THREE.Group();
  const { oak, stoneware, leaf } = getSharedTextures();

  // Rounded 4-legged cross-braced wooden plant stand
  for (const [lx, lz] of [
    [-0.17, -0.17],
    [0.17, -0.17],
    [-0.17, 0.17],
    [0.17, 0.17],
  ]) {
    addPart(g, styler, new THREE.CylinderGeometry(0.021, 0.017, 0.34, 10), '#8b5e34', [lx, 0.17, lz], [0, 0, 0], 0.003, {
      tex: oak,
      roughness: 0.55,
    });
  }
  addPart(g, styler, makeRoundedBoxGeo(0.36, 0.036, 0.36, 0.012, 2), '#9a6a3c', [0, 0.22, 0], [0, 0, 0], 0.003, {
    tex: oak,
    roughness: 0.55,
  });

  // Wheel-thrown stoneware ceramic pot with rolled lip (`LatheGeometry`)
  const potGeo = makeTurnedLatheGeo([
    [0.0, 0.0],
    [0.17, 0.0],
    [0.195, 0.06],
    [0.222, 0.24],
    [0.230, 0.32],
    [0.236, 0.34],
    [0.205, 0.345],
    [0.195, 0.31],
  ], 26);
  addPart(g, styler, potGeo, '#ebe3d5', [0, 0.23, 0], [0, 0, 0], 0.005, {
    tex: stoneware,
    roughness: 0.38,
    clearcoat: 0.52,
    clearcoatRoughness: 0.22,
  });
  addPart(g, styler, new THREE.CylinderGeometry(0.195, 0.195, 0.035, 18), '#463122', [0, 0.54, 0], [0, 0, 0], 0, {
    roughness: 0.92,
  });

  const leafColors = variant === 'monstera' ? ['#4a9e4e', '#5cb55f', '#3c8540'] : ['#529e4c', '#64b25c', '#41833c'];
  const leafCount = variant === 'monstera' ? 8 : 10;
  const leafLen = variant === 'monstera' ? 0.38 : 0.30;
  const leafW = variant === 'monstera' ? 0.34 : 0.22;

  for (let i = 0; i < leafCount; i++) {
    const ang = (i / leafCount) * Math.PI * 2 + (i % 2) * 0.24;
    const tier = i % 2;
    const stemH = (variant === 'fiddle' ? 0.56 : 0.40) + tier * 0.24;
    const reachR = 0.20 + (1 - tier) * 0.14;
    const lx = Math.cos(ang) * reachR;
    const lz = Math.sin(ang) * reachR;

    // Graceful arching TubeGeometry petiole stem
    const petioleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.54, 0),
      new THREE.Vector3(lx * 0.45, 0.54 + stemH * 0.58, lz * 0.45),
      new THREE.Vector3(lx, 0.54 + stemH * 0.86, lz),
    ]);
    addPart(g, styler, new THREE.TubeGeometry(petioleCurve, 10, 0.015, 7, false), '#3b7335', [0, 0, 0], [0, 0, 0], 0.002);

    // Sculpted folded, veined botanical leaf blade!
    const leafGeo = makeCurvedBotanicalLeafGeo(leafLen, leafW, {
      fold: 0.26,
      arch: variant === 'monstera' ? 0.22 : 0.15,
      notched: variant === 'monstera',
    });
    addPart(
      g,
      styler,
      leafGeo,
      leafColors[i % leafColors.length],
      [lx, 0.54 + stemH * 0.85, lz],
      [Math.PI * 0.34 + (1 - tier) * 0.14, -ang + Math.PI / 2, 0],
      0.003,
      { tex: leaf, roughness: 0.44, doubleSided: true },
    );
  }
  g.scale.setScalar(scale);
  return g;
}

/** Hanging Macrame Woven Basket Planter with 16 Arched Folded Fern Fronds */
export function buildHangingMacrameFern(styler: CafeAssetStyler, dropLen = 0.72, scale = 1.0): THREE.Group {
  const g = new THREE.Group();
  const { leaf } = getSharedTextures();

  addPart(g, styler, new THREE.CylinderGeometry(0.012, 0.012, 0.24, 8), '#4a3726', [0, dropLen + 0.10, 0], [0, 0, 0], 0.002);
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const mx = Math.cos(ang) * 0.11;
    const mz = Math.sin(ang) * 0.11;
    addPart(
      g,
      styler,
      new THREE.CylinderGeometry(0.008, 0.008, dropLen, 7),
      '#b89464',
      [mx, dropLen * 0.48, mz],
      [Math.sin(ang) * 0.22, 0, -Math.cos(ang) * 0.22],
      0.002,
    );
  }
  // Turned terracotta/wicker basket bowl
  const basketGeo = makeTurnedLatheGeo([
    [0.0, -0.14],
    [0.10, -0.13],
    [0.18, -0.05],
    [0.20, 0.04],
    [0.19, 0.06],
    [0.175, 0.03],
  ], 20);
  addPart(g, styler, basketGeo, '#a67442', [0, 0.04, 0], [0, 0, 0], 0.004, { roughness: 0.72 });

  // 16 Radiating sculpted cascading fern fronds (curved leaf geometry instead of cones!)
  const fernPalette = ['#4b923f', '#5ea64f', '#3b7a32'];
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    const pitch = i % 2 === 0 ? 1.15 : 1.52;
    const frondGeo = makeCurvedBotanicalLeafGeo(0.46, 0.16, { fold: 0.18, arch: 0.28, notched: true });
    addPart(
      g,
      styler,
      frondGeo,
      fernPalette[i % fernPalette.length],
      [Math.cos(ang) * 0.14, 0.08, Math.sin(ang) * 0.14],
      [pitch, -ang + Math.PI / 2, 0],
      0.003,
      { tex: leaf, roughness: 0.48, doubleSided: true },
    );
  }
  g.scale.setScalar(scale);
  return g;
}

/** Organic Cascading Purple Wisteria Vine Cluster with Clustered Blossoms & Veined Leaves */
export function buildWisteriaCluster(styler: CafeAssetStyler, dropH = 0.68, scale = 1.0): THREE.Group {
  const g = new THREE.Group();
  const { leaf } = getSharedTextures();
  const leafPalette = ['#4b8a42', '#5c9e50', '#3d7536'];
  const wisteriaPalette = ['#9b7ede', '#b398eb', '#8060cc', '#cbb5f5'];

  // Layered canopy of 5 curved foliage leaves
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    const leafGeo = makeCurvedBotanicalLeafGeo(0.30, 0.18, { fold: 0.2, arch: 0.16 });
    addPart(
      g,
      styler,
      leafGeo,
      leafPalette[i % leafPalette.length],
      [Math.cos(ang) * 0.08, 0.04, Math.sin(ang) * 0.08],
      [1.15, -ang + Math.PI / 2, 0],
      0.003,
      { tex: leaf, roughness: 0.5, doubleSided: true },
    );
  }

  // 3 Layered drooping flower racemes made of overlapping blossom florets
  const subOffsets: [number, number, number][] = [
    [0, 1.0, 0],
    [-0.12, 0.78, 0.08],
    [0.12, 0.82, -0.06],
  ];
  const blossomGeo = new THREE.SphereGeometry(0.052, 9, 7);
  subOffsets.forEach(([ox, factor, oz], rIdx) => {
    const h = dropH * factor;
    const tiers = 5;
    for (let t = 0; t < tiers; t++) {
      const frac = t / (tiers - 1);
      const y = -0.08 - frac * h;
      const tierSpread = (1 - frac * 0.72) * 0.068 * factor;
      const beadCount = frac > 0.75 ? 1 : 3;
      const beadScale = (1.0 - frac * 0.45) * factor;
      for (let b = 0; b < beadCount; b++) {
        const bAng = (b / Math.max(1, beadCount)) * Math.PI * 2 + rIdx * 0.9 + t * 0.7;
        const bx = ox + (beadCount === 1 ? 0 : Math.cos(bAng) * tierSpread);
        const bz = oz + (beadCount === 1 ? 0 : Math.sin(bAng) * tierSpread);
        const m = addPart(
          g,
          styler,
          blossomGeo,
          wisteriaPalette[(rIdx + t + b) % wisteriaPalette.length],
          [bx, y, bz],
          [0, 0, 0],
          0.002,
          { roughness: 0.55 },
        );
        m.scale.set(beadScale, beadScale * 1.25, beadScale);
      }
    }
  });
  g.scale.setScalar(scale);
  return g;
}

/** Complete 1:1 Espresso Bar & Credenza Assembly with Rounded Bullnose Marble & Fluted Oak */
export function buildCompleteEspressoBarAssembly(
  styler: CafeAssetStyler,
  flutedTex: THREE.Texture | null,
  marbleTex: THREE.Texture | null,
  menuTex: THREE.Texture | null,
  scale = 1.0,
): THREE.Group {
  const g = new THREE.Group();
  const COUNTER_W = 5.2;
  // Shifted forward from 0.92 -> 1.74 (+0.82m) so the counter's back face sits 100% flush on the front border of the dark walnut barista floor (-2.47m), giving a spacious 1.76m clear barista workspace!
  const FRONT_Z = 1.74;
  const WING_Z = 0.49;
  const WING_LEN = 2.46;
  const { oak, metal, stoneware } = getSharedTextures(styler);

  // A. Rounded Fluted Oak Front Barista Counter + L-Wing (with genuine 3D vertical oak flutes!)
  addPart(g, styler, makeRoundedBoxGeo(COUNTER_W, 0.92, 0.92, 0.024, 3), '#ad753f', [0, 0.46, FRONT_Z], [0, 0, 0], 0.005, {
    tex: flutedTex,
    roughness: 0.56,
    clearcoat: 0.16,
  });
  addPart(g, styler, makeRoundedBoxGeo(0.92, 0.92, WING_LEN, 0.024, 3), '#ad753f', [-COUNTER_W * 0.5 + 0.46, 0.46, WING_Z], [0, 0, 0], 0.005, {
    tex: flutedTex,
    roughness: 0.56,
    clearcoat: 0.16,
  });
  const fluteGeo = new THREE.BoxGeometry(0.055, 0.82, 0.022);
  let fluteIdx = 0;
  for (let fx = -COUNTER_W * 0.5 + 0.14; fx <= COUNTER_W * 0.5 - 0.14; fx += 0.145) {
    addPart(
      g,
      styler,
      fluteGeo,
      fluteIdx % 2 === 0 ? '#c48a50' : '#945f2e',
      [fx, 0.46, FRONT_Z + 0.465],
      [0, 0, 0],
      0,
      { roughness: 0.54 },
    );
    fluteIdx++;
  }
  const sideFluteGeo = new THREE.BoxGeometry(0.022, 0.82, 0.055);
  for (let fz = -0.66; fz <= FRONT_Z + 0.36; fz += 0.145) {
    addPart(
      g,
      styler,
      sideFluteGeo,
      fluteIdx % 2 === 0 ? '#c48a50' : '#945f2e',
      [-COUNTER_W * 0.5 - 0.005, 0.46, fz],
      [0, 0, 0],
      0,
      { roughness: 0.54 },
    );
    fluteIdx++;
  }

  // Bullnose Rounded White Carrara Marble Countertops with glossy clearcoat
  addPart(g, styler, makeRoundedBoxGeo(COUNTER_W + 0.16, 0.09, 1.08, 0.026, 3), '#f5f2eb', [0, 0.965, FRONT_Z], [0, 0, 0], 0.005, {
    tex: marbleTex,
    roughness: 0.26,
    clearcoat: 0.62,
    clearcoatRoughness: 0.18,
  });
  addPart(g, styler, makeRoundedBoxGeo(1.06, 0.09, WING_LEN + 0.10, 0.026, 3), '#f5f2eb', [-COUNTER_W * 0.5 + 0.46, 0.965, WING_Z], [0, 0, 0], 0.005, {
    tex: marbleTex,
    roughness: 0.26,
    clearcoat: 0.62,
    clearcoatRoughness: 0.18,
  });

  // Brushed Brass Foot Rail & Turned Mounting Brackets along front edge
  addPart(g, styler, new THREE.CylinderGeometry(0.022, 0.022, COUNTER_W - 0.3, 12), '#d4a64a', [0, 0.14, FRONT_Z + 0.54], [0, 0, Math.PI / 2], 0.003, {
    tex: metal,
    metalness: 0.72,
    roughness: 0.24,
    clearcoat: 0.4,
  });
  for (const bx of [-2.2, -0.7, 0.8, 2.2]) {
    addPart(g, styler, new THREE.CylinderGeometry(0.016, 0.016, 0.14, 8), '#c4963f', [bx, 0.07, FRONT_Z + 0.54], [0, 0, 0], 0.002, { metalness: 0.7 });
  }

  // Props ON Front Counter (y = 1.01m, human-scaled to barista avatar):
  // 1) Rounded POS Touchscreen Cash Register
  addPart(g, styler, makeRoundedBoxGeo(0.30, 0.08, 0.26, 0.016, 2), '#1f242c', [-1.85, 1.05, FRONT_Z + 0.06], [0, 0, 0], 0.003, { clearcoat: 0.25 });
  addPart(g, styler, makeRoundedBoxGeo(0.28, 0.22, 0.04, 0.014, 2), '#111827', [-1.85, 1.22, FRONT_Z + 0.03], [0.28, 0, 0], 0.003, { clearcoat: 0.35 });
  addPart(g, styler, makeRoundedBoxGeo(0.23, 0.16, 0.012, 0.004, 2), '#38bdf8', [-1.85, 1.22, FRONT_Z + 0.05], [0.28, 0, 0], 0, {
    emissiveHex: '#0ea5e9',
    emissiveIntensity: 0.48,
  });

  // 2) Dual-Group Espresso Machine + Commercial Grinder + Stacked Paper Cups
  const frontEsp = buildDualGroupEspressoMachine(styler, 0.92);
  frontEsp.position.set(-0.48, 1.01, FRONT_Z - 0.02);
  g.add(frontEsp);
  const frontGrinder = buildCommercialCoffeeGrinder(styler, 0.86);
  frontGrinder.position.set(0.24, 1.01, FRONT_Z + 0.02);
  g.add(frontGrinder);
  for (let s = 0; s < 3; s++) {
    addPart(g, styler, new THREE.CylinderGeometry(0.042, 0.032, 0.19, 14), '#f5ead6', [-1.25 + s * 0.11, 1.105, FRONT_Z + 0.11], [0, 0, 0], 0.002, { tex: stoneware });
  }

  // 3) Curved Glass Bakery & Pastry Display Case (human-proportioned countertop showcase)
  const pastryCase = buildCurvedBakeryDisplayCase(styler, flutedTex, 0.84);
  pastryCase.position.set(1.52, 1.01, FRONT_Z - 0.02);
  g.add(pastryCase);

  // B. Back Espresso Credenza Wall (z = -0.95) + Full-Depth Rear Cabinet & Marble Infill (zero rear gap to conservatory wall!)
  addPart(g, styler, makeRoundedBoxGeo(COUNTER_W, 0.92, 0.72, 0.022, 3), '#a8703c', [0, 0.46, -0.95], [0, 0, 0], 0.005, {
    tex: oak,
    tintTex: true,
    roughness: 0.56,
  });
  addPart(g, styler, makeRoundedBoxGeo(COUNTER_W, 0.92, 0.42, 0.016, 2), '#966232', [0, 0.46, -1.46], [0, 0, 0], 0.004, {
    tex: oak,
    tintTex: true,
    roughness: 0.58,
  });
  for (const fx of [-1.2, -0.45]) {
    addPart(g, styler, makeRoundedBoxGeo(0.68, 0.76, 0.045, 0.014, 2), '#b8c2ce', [fx, 0.45, -0.58], [0, 0, 0], 0.003, {
      tex: metal,
      tintTex: true,
      metalness: 0.5,
      roughness: 0.3,
      clearcoat: 0.35,
    });
  }
  addPart(g, styler, makeRoundedBoxGeo(COUNTER_W + 0.12, 0.09, 1.24, 0.024, 3), '#f5f2eb', [0, 0.965, -1.16], [0, 0, 0], 0.005, {
    tex: marbleTex,
    roughness: 0.26,
    clearcoat: 0.62,
  });

  // Full-height rear architectural backing behind walnut menu wall so zero empty cavity exists behind the bar
  addPart(g, styler, makeRoundedBoxGeo(COUNTER_W - 0.10, 1.88, 0.40, 0.018, 2), '#7c4e29', [0, 1.86, -1.46], [0, 0, 0], 0.004, {
    tex: oak,
    tintTex: true,
    roughness: 0.56,
  });

  // Back Espresso Machine + 2 Commercial Grinders
  const backEsp = buildDualGroupEspressoMachine(styler, 0.90);
  backEsp.position.set(-1.35, 1.01, -0.95);
  g.add(backEsp);
  const bg1 = buildCommercialCoffeeGrinder(styler, 0.86);
  bg1.position.set(-0.35, 1.01, -0.92);
  g.add(bg1);
  const bg2 = buildCommercialCoffeeGrinder(styler, 0.86);
  bg2.position.set(0.15, 1.01, -0.92);
  g.add(bg2);
  const jarGeo = makeTurnedLatheGeo([[0, 0], [0.075, 0], [0.082, 0.02], [0.082, 0.19], [0.065, 0.21], [0.072, 0.23], [0, 0.235]], 18);
  for (let j = 0; j < 4; j++) {
    addPart(g, styler, jarGeo, j % 2 === 0 ? '#dfb076' : '#f2ece0', [0.85 + j * 0.28, 1.01, -0.95], [0, 0, 0], 0.003, {
      tex: stoneware,
      tintTex: true,
      clearcoat: 0.45,
    });
  }

  // C. Timber Rear Partition Frame + Hanging Chalkboard Menu + 2 Floating Oak Bean Shelves
  addPart(g, styler, makeRoundedBoxGeo(COUNTER_W + 0.2, 2.75, 0.11, 0.022, 3), '#8c5d34', [0, 1.38, -1.36], [0, 0, 0], 0.005, {
    tex: oak,
    tintTex: true,
    roughness: 0.60,
  });
  const menuBoard = buildHangingChalkboardMenu(styler, menuTex, 2.55, 1.05);
  menuBoard.position.set(-0.75, 2.18, -1.26);
  g.add(menuBoard);
  for (const sy of [1.85, 2.38]) {
    addPart(g, styler, makeRoundedBoxGeo(1.45, 0.06, 0.24, 0.014, 2), '#b57f48', [1.45, sy, -1.20], [0, 0, 0], 0.004, { tex: oak });
    for (let k = 0; k < 4; k++) {
      addPart(g, styler, makeRoundedBoxGeo(0.16, 0.26, 0.12, 0.016, 2), k % 2 === 0 ? '#c29b68' : '#966b43', [0.95 + k * 0.32, sy + 0.16, -1.20], [0, 0, 0], 0.003, {
        roughness: 0.65,
      });
    }
  }

  // D. 3 Vintage Brass Dome Pendant Lamps hanging directly above Front Counter
  for (const lx of [-1.55, 0.0, 1.55]) {
    const lamp = buildBrassPendantLamp(styler, 1.38);
    lamp.position.set(lx, 2.42, FRONT_Z);
    g.add(lamp);
  }

  g.scale.setScalar(scale);
  return g;
}

function createAtmHeaderMarqueeTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) {
    const bg = ctx.createLinearGradient(0, 0, 0, 128);
    bg.addColorStop(0, '#274576');
    bg.addColorStop(0.48, '#385f9e');
    bg.addColorStop(1, '#233d69');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 128);

    // Soft backlit center glow
    const glow = ctx.createRadialGradient(256, 64, 16, 256, 64, 250);
    glow.addColorStop(0, 'rgba(147, 197, 253, 0.28)');
    glow.addColorStop(1, 'rgba(30, 58, 138, 0.0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 512, 128);

    // Crisp inner marquee bezel line
    ctx.strokeStyle = 'rgba(191, 219, 254, 0.55)';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, 496, 112);

    // Bold industrial "ATM // CASH" typography
    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 58px "Barlow", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(147, 197, 253, 0.75)';
    ctx.shadowBlur = 10;
    ctx.fillText('ATM // CASH', 256, 66);
    ctx.shadowBlur = 0;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createAtmMonitorScreenTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 384;
  const ctx = c.getContext('2d');
  if (ctx) {
    // Cool silver-slate LCD glass base matching the 4-view reference sheet
    const bg = ctx.createLinearGradient(0, 0, 512, 384);
    bg.addColorStop(0, '#8ea2b8');
    bg.addColorStop(0.45, '#b6c7d8');
    bg.addColorStop(0.75, '#95a9be');
    bg.addColorStop(1, '#7a8ea4');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 384);

    // Subtle UI header & side FDK prompt ticks under the glass sheen
    ctx.fillStyle = 'rgba(30, 41, 59, 0.34)';
    ctx.fillRect(0, 0, 512, 50);
    ctx.fillStyle = 'rgba(248, 250, 252, 0.86)';
    ctx.font = 'bold 20px "Barlow", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('STANDARD BANK // CASH & LUL', 24, 32);

    for (let i = 0; i < 4; i++) {
      const y = 96 + i * 68;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.22)';
      ctx.fillRect(14, y - 13, 92, 26);
      ctx.fillRect(406, y - 13, 92, 26);
    }

    // Crisp diagonal glass reflection bands ("Angled screen reflections display")
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.56)';
    ctx.beginPath();
    ctx.moveTo(140, 0);
    ctx.lineTo(260, 0);
    ctx.lineTo(95, 384);
    ctx.lineTo(-25, 384);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
    ctx.beginPath();
    ctx.moveTo(290, 0);
    ctx.lineTo(348, 0);
    ctx.lineTo(184, 384);
    ctx.lineTo(126, 384);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 506, 378);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createAtmNfcPadTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#242c3a';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, 112, 112);

    // Contactless RFID / NFC radio wave arcs
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (let r = 1; r <= 3; r++) {
      ctx.beginPath();
      ctx.arc(46, 68, r * 13, -0.68, 0.68);
      ctx.stroke();
    }
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(98, 28, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

let cachedAtmUiTextures: {
  marquee?: THREE.CanvasTexture | null;
  screen?: THREE.CanvasTexture | null;
  nfc?: THREE.CanvasTexture | null;
} = {};

function getAtmUiTextures(styler: CafeAssetStyler): {
  marquee: THREE.CanvasTexture | null;
  screen: THREE.CanvasTexture | null;
  nfc: THREE.CanvasTexture | null;
} {
  if (styler.preserveTextures === false || typeof document === 'undefined') {
    return { marquee: null, screen: null, nfc: null };
  }
  if (!cachedAtmUiTextures.marquee) {
    cachedAtmUiTextures = {
      marquee: createAtmHeaderMarqueeTexture(),
      screen: createAtmMonitorScreenTexture(),
      nfc: createAtmNfcPadTexture(),
    };
  }
  return {
    marquee: cachedAtmUiTextures.marquee ?? null,
    screen: cachedAtmUiTextures.screen ?? null,
    nfc: cachedAtmUiTextures.nfc ?? null,
  };
}

function makeExtrudedSideProfileGeo(
  pointsZY: ReadonlyArray<[number, number]>,
  thicknessX: number,
  bevel = 0.008,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(pointsZY[0][0], pointsZY[0][1]);
  for (let i = 1; i < pointsZY.length; i++) {
    shape.lineTo(pointsZY[i][0], pointsZY[i][1]);
  }
  shape.closePath();
  const innerDepth = Math.max(0.004, thicknessX - bevel * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: innerDepth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -innerDepth * 0.5);
  // Rotate -90 deg around Y so 2D shape (x=zProfile, y=yProfile) maps 1:1 to 3D (y=yProfile, z=zProfile) with centered X thickness!
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * 1:1 Industrial Bank Cash ATM ("STANDARD BANK CASH ATM // 4-VIEW INDUSTRIAL MODEL SHEET")
 * Real-world 1:1 dimensions at scale=1.0:
 *   - Height: 1.75m (175cm)
 *   - Outer Cabinet Width: 0.79m (790mm), Inner Bay Width: 0.66m
 *   - Side Profile Depth: Rear spine z=-0.28m .. +0.08m, Cantilevered keypad nose z=+0.36m, Tapered vault base
 *   - Complete Front, Side, Rear Vault Service Door & 3/4 Isometric detailing
 */
export function buildStandardBankCashAtm(styler: CafeAssetStyler, scale = 1.0): THREE.Group {
  const g = new THREE.Group();
  const { metal } = getSharedTextures(styler);
  const { marquee: marqueeTex, screen: screenTex, nfc: nfcTex } = getAtmUiTextures(styler);

  const COL_SILVER_BODY = '#d5d9e0';
  const COL_SILVER_PANEL = '#cbd0d8';
  const COL_NAVY_TRIM = '#2c394e';
  const COL_SLATE_DARK = '#343e4f';
  const COL_CHARCOAL = '#1f2631';
  const COL_CHROME = '#9aa5b4';

  // 1. Lower Recessed Heavy Vault Plinth Base (y = 0.00 .. 0.042m)
  addPart(g, styler, makeRoundedBoxGeo(0.75, 0.044, 0.50, 0.008, 2), '#222731', [0, 0.022, -0.02], [0, 0, 0], 0.004, {
    roughness: 0.68,
    metalness: 0.16,
  });

  // 2. Full-Height Sculpted Unibody Side Casing Cheeks (x = +/-0.362m -> 0.79m outer width)
  const sideCheekProfile: [number, number][] = [
    [-0.28, 0.04],
    [-0.28, 1.732],
    [-0.258, 1.75],
    [0.215, 1.75],
    [0.23, 1.732],
    [0.23, 1.53],
    [0.145, 1.515],
    [0.355, 0.905],
    [0.362, 0.87],
    [0.345, 0.765],
    [0.245, 0.742],
    [0.195, 0.04],
  ];
  const cheekGeo = makeExtrudedSideProfileGeo(sideCheekProfile, 0.066, 0.007);
  for (const side of [-1, 1]) {
    addPart(g, styler, cheekGeo, COL_SILVER_BODY, [side * 0.362, 0, 0], [0, 0, 0], 0.005, {
      tex: metal,
      tintTex: true,
      roughness: 0.42,
      metalness: 0.20,
      clearcoat: 0.22,
    });
  }

  // Navy-Slate Ergonomic Cheek Trim wrapping the forward-leaning monitor hood & cantilevered keypad nose
  const navyTrimProfile: [number, number][] = [
    [0.075, 1.518],
    [0.148, 1.518],
    [0.358, 0.905],
    [0.365, 0.87],
    [0.348, 0.762],
    [0.242, 0.740],
    [0.215, 0.820],
    [0.285, 0.885],
  ];
  const navyTrimGeo = makeExtrudedSideProfileGeo(navyTrimProfile, 0.071, 0.005);
  for (const side of [-1, 1]) {
    addPart(g, styler, navyTrimGeo, COL_NAVY_TRIM, [side * 0.362, 0, 0], [0, 0, 0], 0.004, {
      roughness: 0.46,
      metalness: 0.24,
      clearcoat: 0.2,
    });
    // Subtle glowing cyan-blue LED accent light bar along inner ergonomic cheek contour
    addPart(
      g,
      styler,
      makeRoundedBoxGeo(0.010, 0.54, 0.012, 0.003, 1),
      '#bae6fd',
      [side * 0.323, 1.21, 0.242],
      [-0.33, 0, 0],
      0,
      {
        emissiveHex: '#38bdf8',
        emissiveIntensity: 0.62,
        roughness: 0.2,
      },
    );
  }

  // Side Casing Recessed Grip Handle & 12 Horizontal Ventilation Louver Slots (Left & Right Sides)
  const sideLouverGeo = new THREE.BoxGeometry(0.010, 0.008, 0.125);
  for (const side of [-1, 1]) {
    addPart(g, styler, makeRoundedBoxGeo(0.012, 0.048, 0.125, 0.004, 1), COL_SLATE_DARK, [side * 0.396, 0.65, -0.02], [0, 0, 0], 0.002, {
      roughness: 0.5,
    });
    addPart(g, styler, new THREE.BoxGeometry(0.014, 0.022, 0.098), COL_CHARCOAL, [side * 0.398, 0.65, -0.02], [0, 0, 0], 0);
    for (let v = 0; v < 12; v++) {
      addPart(g, styler, sideLouverGeo, '#3b4352', [side * 0.396, 0.13 + v * 0.022, -0.14], [0, 0, 0], 0, {
        roughness: 0.6,
      });
    }
  }

  // 3. Central Rear Cabinet Spine + Tapered Lower Safe Vault Pedestal (x in [-0.33, +0.33])
  const centerBodyProfile: [number, number][] = [
    [-0.28, 0.04],
    [-0.28, 1.75],
    [0.09, 1.75],
    [0.09, 1.52],
    [0.245, 0.742],
    [0.195, 0.04],
  ];
  addPart(g, styler, makeExtrudedSideProfileGeo(centerBodyProfile, 0.665, 0.005), COL_SILVER_BODY, [0, 0, 0], [0, 0, 0], 0.004, {
    tex: metal,
    tintTex: true,
    roughness: 0.42,
    metalness: 0.20,
    clearcoat: 0.2,
  });

  // Lower Pedestal Safe Vault Front Access Door + Circular Keylock Cylinder (aligned parallel to +0.071 rad tapered front slope)
  addPart(g, styler, makeRoundedBoxGeo(0.61, 0.57, 0.014, 0.005, 2), COL_SILVER_PANEL, [0, 0.375, 0.224], [0.071, 0, 0], 0.004, {
    tex: metal,
    tintTex: true,
    roughness: 0.40,
    metalness: 0.22,
  });
  addPart(g, styler, new THREE.CylinderGeometry(0.021, 0.023, 0.016, 16), COL_CHROME, [-0.245, 0.375, 0.234], [Math.PI / 2 + 0.071, 0, 0], 0.002, {
    metalness: 0.55,
    roughness: 0.26,
  });
  addPart(g, styler, new THREE.BoxGeometry(0.005, 0.017, 0.018), '#0f172a', [-0.245, 0.375, 0.237], [0.071, 0, 0], 0);

  // 4. Top Illuminated "ATM // CASH" Header Canopy Box (y = 1.52 .. 1.75m, overhanging to z = +0.23m)
  addPart(g, styler, makeRoundedBoxGeo(0.67, 0.23, 0.21, 0.014, 2), COL_SILVER_BODY, [0, 1.635, 0.125], [0, 0, 0], 0.004, {
    tex: metal,
    tintTex: true,
    roughness: 0.40,
    metalness: 0.20,
  });
  addPart(g, styler, makeRoundedBoxGeo(0.65, 0.168, 0.022, 0.008, 2), COL_CHARCOAL, [0, 1.635, 0.224], [0, 0, 0], 0.003);
  addPart(g, styler, makeRoundedBoxGeo(0.615, 0.136, 0.012, 0.005, 2), '#2b4d85', [0, 1.635, 0.232], [0, 0, 0], 0.002, {
    emissiveHex: '#1d4ed8',
    emissiveIntensity: 0.34,
    roughness: 0.26,
  });
  if (marqueeTex) {
    // Full-UV planar backlit marquee decal so "ATM // CASH" renders razor-sharp across the entire illuminated sign
    addPart(g, styler, new THREE.PlaneGeometry(0.60, 0.128), '#ffffff', [0, 1.635, 0.240], [0, 0, 0], 0, {
      tex: marqueeTex,
      emissiveHex: '#3b82f6',
      emissiveIntensity: 0.38,
      roughness: 0.20,
      clearcoat: 0.60,
    });
  } else {
    // Clean 3D micro-bar typography silhouette for vertex-baked exterior views (+0 draw calls)
    for (const gx of [-0.19, -0.11, -0.01, 0.02, 0.13, 0.21]) {
      addPart(g, styler, new THREE.BoxGeometry(gx === -0.01 || gx === 0.02 ? 0.012 : 0.055, 0.048, 0.006), '#f8fafc', [gx, 1.635, 0.241], [0, 0, gx === -0.01 || gx === 0.02 ? -0.28 : 0], 0, {
        emissiveHex: '#e0f2fe',
        emissiveIntensity: 0.35,
      });
    }
  }

  // 5. Overhead Security CCTV Dome Camera & Speaker Soffit (y = 1.44 .. 1.52m)
  addPart(g, styler, makeRoundedBoxGeo(0.65, 0.088, 0.08, 0.008, 2), COL_SILVER_PANEL, [0, 1.48, 0.135], [0.22, 0, 0], 0.003, {
    roughness: 0.44,
    metalness: 0.2,
  });
  addPart(g, styler, new THREE.CylinderGeometry(0.030, 0.032, 0.014, 16), COL_SLATE_DARK, [0, 1.472, 0.172], [Math.PI / 2 + 0.22, 0, 0], 0.002, {
    metalness: 0.45,
    roughness: 0.3,
  });
  addPart(g, styler, new THREE.SphereGeometry(0.022, 16, 12), '#0f172a', [0, 1.470, 0.178], [0, 0, 0], 0, {
    roughness: 0.10,
    metalness: 0.15,
    clearcoat: 0.95,
  });
  addPart(g, styler, new THREE.SphereGeometry(0.007, 10, 8), '#38bdf8', [0, 1.470, 0.196], [0, 0, 0], 0, {
    emissiveHex: '#0284c7',
    emissiveIntensity: 0.5,
  });
  const soffitDotGeo = new THREE.BoxGeometry(0.016, 0.006, 0.008);
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      addPart(g, styler, soffitDotGeo, '#334155', [side * (0.13 + k * 0.032), 1.478, 0.174], [0.22, 0, 0], 0);
    }
  }

  // 6. Angled Touchscreen Monitor + Anti-Glare Privacy Shields + 8 Tactile FDK Bezel Keys (y = 1.02 .. 1.43m)
  const monitorBay = new THREE.Group();
  monitorBay.position.set(0, 1.225, 0.158);
  monitorBay.rotation.x = -0.33;
  g.add(monitorBay);

  addPart(monitorBay, styler, makeRoundedBoxGeo(0.64, 0.40, 0.048, 0.010, 2), COL_SLATE_DARK, [0, 0, 0], [0, 0, 0], 0.004, {
    roughness: 0.50,
    metalness: 0.22,
  });
  // Left & Right Privacy Anti-Glare Side Shields
  for (const side of [-1, 1]) {
    addPart(monitorBay, styler, makeRoundedBoxGeo(0.024, 0.39, 0.088, 0.006, 2), '#475569', [side * 0.304, 0, 0.034], [0, 0, 0], 0.003, {
      metalness: 0.38,
      roughness: 0.34,
    });
  }
  // Recessed LCD Screen with Angled Glass Reflection Sheen
  addPart(monitorBay, styler, makeRoundedBoxGeo(0.45, 0.32, 0.014, 0.006, 1), '#1e293b', [0, 0, 0.022], [0, 0, 0], 0.002);
  addPart(
    monitorBay,
    styler,
    new THREE.PlaneGeometry(0.43, 0.30),
    screenTex ? '#ffffff' : '#9fb4ca',
    [0, 0, 0.031],
    [0, 0, 0],
    0,
    {
      tex: screenTex,
      roughness: 0.14,
      metalness: 0.10,
      clearcoat: 0.88,
      clearcoatRoughness: 0.12,
      emissiveHex: '#64748b',
      emissiveIntensity: 0.18,
    },
  );
  // 4 Left + 4 Right Tactile Metallic Function Keys (FDK)
  const fdkGeo = makeRoundedBoxGeo(0.030, 0.020, 0.014, 0.004, 1);
  for (const side of [-1, 1]) {
    for (let b = 0; b < 4; b++) {
      addPart(monitorBay, styler, fdkGeo, '#cbd5e1', [side * 0.256, -0.102 + b * 0.068, 0.026], [0, 0, 0], 0.002, {
        metalness: 0.50,
        roughness: 0.26,
      });
    }
  }

  // 7. Transaction Fascia: Receipt Printer Slot (Left) + Flashing Green LED Card Slot (Right)
  const transFascia = new THREE.Group();
  transFascia.position.set(0, 0.975, 0.242);
  transFascia.rotation.x = -0.20;
  g.add(transFascia);

  addPart(transFascia, styler, makeRoundedBoxGeo(0.645, 0.105, 0.052, 0.008, 2), COL_SLATE_DARK, [0, 0, 0], [0, 0, 0], 0.003, {
    roughness: 0.48,
    metalness: 0.22,
  });
  // Receipt Printer Slot (Left)
  addPart(transFascia, styler, makeRoundedBoxGeo(0.165, 0.042, 0.018, 0.005, 2), COL_CHROME, [-0.165, 0.004, 0.026], [0, 0, 0], 0.002, {
    metalness: 0.52,
    roughness: 0.28,
  });
  addPart(transFascia, styler, new THREE.BoxGeometry(0.132, 0.009, 0.020), '#0f172a', [-0.165, 0.004, 0.028], [0, 0, 0], 0);

  // Card Insertion Slot with Green LED Beacon Throat (Right)
  addPart(transFascia, styler, makeRoundedBoxGeo(0.148, 0.062, 0.018, 0.006, 2), COL_CHARCOAL, [0.175, -0.002, 0.025], [0, 0, 0], 0.002);
  addPart(transFascia, styler, makeRoundedBoxGeo(0.118, 0.042, 0.022, 0.007, 2), '#4ade80', [0.175, -0.002, 0.030], [0, 0, 0], 0.002, {
    emissiveHex: '#22c55e',
    emissiveIntensity: 0.85,
    roughness: 0.20,
    clearcoat: 0.70,
  });
  addPart(transFascia, styler, new THREE.BoxGeometry(0.086, 0.008, 0.026), '#052e16', [0.175, -0.002, 0.032], [0, 0, 0], 0);

  // 8. Cantilevered Keypad Ledge + Shielded 4x4 PIN Keypad + Contactless NFC / RFID Reader Pad
  const keypadLedge = new THREE.Group();
  keypadLedge.position.set(0, 0.865, 0.268);
  keypadLedge.rotation.x = 0.20;
  g.add(keypadLedge);

  addPart(keypadLedge, styler, makeRoundedBoxGeo(0.655, 0.062, 0.195, 0.014, 2), COL_SLATE_DARK, [0, 0, 0], [0, 0, 0], 0.004, {
    roughness: 0.46,
    metalness: 0.24,
  });
  // Recessed Brushed Steel PIN Pad Base
  addPart(keypadLedge, styler, makeRoundedBoxGeo(0.168, 0.014, 0.132, 0.005, 1), COL_CHROME, [-0.015, 0.030, 0.008], [0, 0, 0], 0.002, {
    metalness: 0.55,
    roughness: 0.26,
  });
  // Raised Tactile Metal Privacy Cover Shields around PIN Keypad (Left, Right, Back)
  for (const side of [-1, 1]) {
    addPart(keypadLedge, styler, makeRoundedBoxGeo(0.015, 0.034, 0.136, 0.004, 1), '#64748b', [-0.015 + side * 0.088, 0.044, 0.006], [0, 0, 0], 0.002, {
      metalness: 0.48,
      roughness: 0.30,
    });
  }
  addPart(keypadLedge, styler, makeRoundedBoxGeo(0.192, 0.036, 0.016, 0.004, 1), '#64748b', [-0.015, 0.045, -0.056], [0, 0, 0], 0.002, {
    metalness: 0.48,
    roughness: 0.30,
  });
  // 4x4 Tactile Metallic PIN Keys (including Cancel Red, Clear Yellow, Enter Green on column 4)
  const pinKeyGeo = new THREE.BoxGeometry(0.026, 0.010, 0.020);
  const actionKeyColors = ['#ef4444', '#facc15', '#22c55e', '#e2e8f0'];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const keyHex = col === 3 ? actionKeyColors[row] : '#e2e8f0';
      addPart(
        keypadLedge,
        styler,
        pinKeyGeo,
        keyHex,
        [-0.068 + col * 0.035, 0.038, -0.034 + row * 0.027],
        [0, 0, 0],
        0.001,
        { metalness: col === 3 ? 0.2 : 0.45, roughness: 0.30 },
      );
    }
  }

  // Contactless NFC / RFID Reader Pad (Right of PIN Keypad)
  addPart(keypadLedge, styler, makeRoundedBoxGeo(0.092, 0.014, 0.098, 0.006, 1), COL_CHARCOAL, [0.185, 0.031, 0.012], [0, 0, 0], 0.002);
  addPart(
    keypadLedge,
    styler,
    new THREE.PlaneGeometry(0.078, 0.084),
    nfcTex ? '#ffffff' : '#334155',
    [0.185, 0.039, 0.012],
    [-Math.PI / 2, 0, 0],
    0,
    {
      tex: nfcTex,
      roughness: 0.35,
      emissiveHex: '#22c55e',
      emissiveIntensity: nfcTex ? 0.12 : 0.22,
    },
  );

  // 9. Cash Withdrawal Dispensing Slot Shutter (Recessed directly below cantilevered keypad nose, y = 0.68 .. 0.78m)
  addPart(g, styler, makeRoundedBoxGeo(0.65, 0.11, 0.09, 0.010, 2), COL_SILVER_PANEL, [0, 0.775, 0.275], [0, 0, 0], 0.003, {
    roughness: 0.44,
    metalness: 0.20,
  });
  addPart(g, styler, makeRoundedBoxGeo(0.43, 0.090, 0.036, 0.008, 2), COL_SLATE_DARK, [0, 0.772, 0.312], [0, 0, 0], 0.003);
  addPart(g, styler, new THREE.BoxGeometry(0.37, 0.056, 0.026), '#111827', [0, 0.772, 0.320], [0, 0, 0], 0);
  addPart(g, styler, makeRoundedBoxGeo(0.35, 0.038, 0.022, 0.004, 1), COL_CHROME, [0, 0.772, 0.323], [0, 0, 0], 0.002, {
    metalness: 0.52,
    roughness: 0.28,
  });
  addPart(g, styler, new THREE.BoxGeometry(0.31, 0.008, 0.026), '#0f172a', [0, 0.772, 0.325], [0, 0, 0], 0);

  // 10. Rear Heavy-Duty Reinforced Steel Vault Service Door (REAR ELEVATION VIEW, z = -0.28m)
  addPart(g, styler, makeRoundedBoxGeo(0.56, 1.34, 0.016, 0.006, 2), COL_SILVER_PANEL, [0, 0.77, -0.282], [0, 0, 0], 0.004, {
    tex: metal,
    tintTex: true,
    roughness: 0.44,
    metalness: 0.24,
  });
  // Dual Heavy-Duty Hinges on right side of Rear View (x = -0.278)
  for (const hy of [1.20, 0.28]) {
    addPart(g, styler, new THREE.CylinderGeometry(0.015, 0.015, 0.14, 12), COL_CHROME, [-0.282, hy, -0.292], [0, 0, 0], 0.002, {
      metalness: 0.55,
      roughness: 0.28,
    });
    addPart(g, styler, new THREE.BoxGeometry(0.048, 0.11, 0.010), COL_CHROME, [-0.262, hy, -0.288], [0, 0, 0], 0.002);
  }
  // Dual Combination Dial / Digital Locks + Key Tumbler Lock
  for (const dy of [0.98, 0.76]) {
    addPart(g, styler, new THREE.CylinderGeometry(0.042, 0.046, 0.022, 18), COL_CHARCOAL, [0.06, dy, -0.294], [Math.PI / 2, 0, 0], 0.002, {
      metalness: 0.35,
      roughness: 0.36,
    });
    addPart(g, styler, new THREE.CylinderGeometry(0.018, 0.018, 0.028, 14), COL_CHROME, [0.06, dy, -0.296], [Math.PI / 2, 0, 0], 0.001, {
      metalness: 0.6,
      roughness: 0.24,
    });
  }
  addPart(g, styler, new THREE.CylinderGeometry(0.018, 0.018, 0.018, 12), COL_CHROME, [0.165, 0.76, -0.292], [Math.PI / 2, 0, 0], 0.002);
  addPart(g, styler, new THREE.BoxGeometry(0.008, 0.055, 0.014), COL_CHARCOAL, [0.165, 0.72, -0.293], [0, 0, 0], 0);

  // Rear Ventilation Louvers + Ethernet LAN Port + Power Conduit + Circuit Breaker Switch
  const rearLouverGeo = new THREE.BoxGeometry(0.13, 0.008, 0.010);
  for (let i = 0; i < 5; i++) {
    addPart(g, styler, rearLouverGeo, '#3b4352', [-0.08, 1.08 + i * 0.022, -0.290], [0, 0, 0], 0);
  }
  for (const lx of [-0.11, 0.11]) {
    for (let i = 0; i < 6; i++) {
      addPart(g, styler, rearLouverGeo, '#3b4352', [lx, 0.26 + i * 0.022, -0.290], [0, 0, 0], 0);
    }
  }
  // Ethernet LAN, Power Socket & Breaker Switch
  addPart(g, styler, new THREE.BoxGeometry(0.042, 0.042, 0.014), COL_CHARCOAL, [-0.07, 0.14, -0.291], [0, 0, 0], 0.001);
  addPart(g, styler, new THREE.BoxGeometry(0.052, 0.042, 0.014), COL_CHARCOAL, [-0.14, 0.14, -0.291], [0, 0, 0], 0.001);
  addPart(g, styler, new THREE.BoxGeometry(0.016, 0.024, 0.018), '#ef4444', [-0.195, 0.14, -0.293], [0, 0, 0], 0);

  g.scale.setScalar(scale);
  return g;
}

function createArcadeHeaderMarqueeTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 144;
  const ctx = c.getContext('2d');
  if (ctx) {
    const bg = ctx.createLinearGradient(0, 0, 0, 144);
    bg.addColorStop(0, '#091e2c');
    bg.addColorStop(0.5, '#12364d');
    bg.addColorStop(1, '#081a28');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 144);

    // Subtle horizontal scanline/grid bars matching model sheet marquee
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.lineWidth = 2;
    for (let y = 16; y < 130; y += 12) {
      ctx.beginPath();
      ctx.moveTo(12, y);
      ctx.lineTo(500, y);
      ctx.stroke();
    }

    // Outer cyan & inner magenta neon frame
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 500, 132);
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 3;
    ctx.strokeRect(14, 14, 484, 116);

    // Bold glowing Cyan "NEO-STRIKE" headline
    ctx.fillStyle = '#a5f3fc';
    ctx.font = '900 50px "Barlow", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 14;
    ctx.fillText('NEO-STRIKE', 256, 54);

    // Glowing Magenta/Pink "ARCADE" subtitle
    ctx.fillStyle = '#f9a8d4';
    ctx.font = '900 32px "Barlow", "Arial Black", sans-serif';
    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = 12;
    ctx.fillText('ARCADE', 256, 102);
    ctx.shadowBlur = 0;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createArcadeMonitorScreenTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 384;
  const ctx = c.getContext('2d');
  if (ctx) {
    // Illuminated CRT / Curved LCD ice-cyan phosphor glow matching the 4-view model sheet
    const bg = ctx.createLinearGradient(0, 0, 512, 384);
    bg.addColorStop(0, '#5ea8c8');
    bg.addColorStop(0.45, '#99d5ea');
    bg.addColorStop(0.75, '#72bbd8');
    bg.addColorStop(1, '#4d92b4');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 384);

    // Subtle CRT scanlines
    ctx.fillStyle = 'rgba(15, 23, 42, 0.08)';
    for (let y = 0; y < 384; y += 6) {
      ctx.fillRect(0, y, 512, 2);
    }

    // Crisp diagonal glass reflection bands matching the 4-view reference sheet
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
    ctx.beginPath();
    ctx.moveTo(130, 0);
    ctx.lineTo(255, 0);
    ctx.lineTo(80, 384);
    ctx.lineTo(-45, 384);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
    ctx.beginPath();
    ctx.moveTo(290, 0);
    ctx.lineTo(355, 0);
    ctx.lineTo(180, 384);
    ctx.lineTo(115, 384);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Rounded dark CRT mask border
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 502, 374);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

let cachedArcadeUiTextures: {
  marquee?: THREE.CanvasTexture | null;
  screen?: THREE.CanvasTexture | null;
} = {};

function getArcadeUiTextures(styler: CafeAssetStyler): {
  marquee: THREE.CanvasTexture | null;
  screen: THREE.CanvasTexture | null;
} {
  if (styler.preserveTextures === false || typeof document === 'undefined') {
    return { marquee: null, screen: null };
  }
  if (!cachedArcadeUiTextures.marquee) {
    cachedArcadeUiTextures = {
      marquee: createArcadeHeaderMarqueeTexture(),
      screen: createArcadeMonitorScreenTexture(),
    };
  }
  return {
    marquee: cachedArcadeUiTextures.marquee ?? null,
    screen: cachedArcadeUiTextures.screen ?? null,
  };
}

/**
 * 1:1 Industrial Standalone Arcade Cabinet Machine ("STANDALONE ARCADE CABINET MACHINE - 4-VIEW INDUSTRIAL MODEL SHEET")
 * Real-world 1:1 dimensions at scale=1.0:
 *   - Outer Cabinet Width: 0.79m (790mm)
 *   - Total Height: 1.80m (1800mm: 600mm lower pedestal, 180mm control deck, 900mm monitor bay, 120mm marquee header)
 *   - Rear vertical spine at z = -0.30m (100% flat & flush against wall with zero rear gap)
 *   - Illuminated "NEO-STRIKE ARCADE" marquee header, dual speaker soffit grilles, angled CRT/LCD gaming monitor,
 *     2-player joysticks + 12 push buttons control deck, double coin door acceptor mechanism with red illuminated
 *     reject buttons, lower speaker kick plates, diagonal Cyan/Magenta side graphic decals, and full rear service door + louvers.
 */
export function buildStandaloneArcadeCabinet(styler: CafeAssetStyler, scale = 1.0): THREE.Group {
  const g = new THREE.Group();
  g.name = 'StandaloneArcadeCabinet3D';
  const { metal } = getSharedTextures(styler);
  const { marquee: marqueeTex, screen: screenTex } = getArcadeUiTextures(styler);

  const COL_CABINET_DARK = '#232730';
  const COL_CABINET_PANEL = '#2d323e';
  const COL_BEZEL_SLATE = '#1a1e26';
  const COL_CYAN_NEON = '#22d3ee';
  const COL_MAGENTA_NEON = '#ec4899';
  const COL_CHROME = '#cbd5e1';

  // 1. 4 Heavy-Duty Rubber Leveling Feet + Recessed Plinth Base (y = 0.00 .. 0.036m)
  const footGeo = new THREE.CylinderGeometry(0.032, 0.036, 0.018, 12);
  for (const fx of [-0.31, 0.31]) {
    for (const fz of [-0.23, 0.13]) {
      addPart(g, styler, footGeo, '#111318', [fx, 0.009, fz], [0, 0, 0], 0.002, {
        roughness: 0.85,
      });
    }
  }
  addPart(g, styler, makeRoundedBoxGeo(0.74, 0.032, 0.48, 0.006, 2), '#171a21', [0, 0.024, -0.05], [0, 0, 0], 0.004, {
    roughness: 0.72,
    metalness: 0.16,
  });

  // 2. Full-Height Sculpted Side Cheeks (x = +/-0.362m, thickness = 0.066m -> 0.79m outer width)
  // Rear spine sits dead-vertical at z = -0.30m from y = 0.03m to y = 1.64m so the back is 100% flush against the wall!
  const sideCheekProfile: [number, number][] = [
    [-0.30, 0.03],
    [-0.30, 1.64],
    [-0.27, 1.67],
    [0.14, 1.80],
    [0.22, 1.80],
    [0.22, 1.62],
    [0.05, 1.55],
    [0.16, 0.94],
    [0.37, 0.88],
    [0.35, 0.70],
    [0.19, 0.62],
    [0.19, 0.03],
  ];
  const cheekGeo = makeExtrudedSideProfileGeo(sideCheekProfile, 0.066, 0.006);
  for (const side of [-1, 1]) {
    addPart(g, styler, cheekGeo, COL_CABINET_DARK, [side * 0.362, 0, 0], [0, 0, 0], 0.005, {
      tex: metal,
      tintTex: true,
      roughness: 0.48,
      metalness: 0.18,
      clearcoat: 0.22,
    });
  }

  // Cyan Outer T-Molding Perimeter Trim + Magenta Inner Accent Trim along both Side Cheeks
  const cyanTrimProfile: [number, number][] = [
    [-0.303, 0.03],
    [-0.303, 1.645],
    [-0.272, 1.675],
    [0.14, 1.804],
    [0.225, 1.804],
    [0.225, 1.616],
    [0.056, 1.546],
    [0.166, 0.944],
    [0.376, 0.884],
    [0.355, 0.696],
    [0.195, 0.618],
    [0.195, 0.03],
    [0.175, 0.03],
    [0.175, 0.625],
    [0.335, 0.706],
    [0.354, 0.870],
    [0.146, 0.932],
    [0.034, 1.556],
    [0.204, 1.626],
    [0.204, 1.784],
    [0.138, 1.784],
    [-0.282, 1.638],
    [-0.282, 0.03],
  ];
  const cyanTrimGeo = makeExtrudedSideProfileGeo(cyanTrimProfile, 0.070, 0.003);
  for (const side of [-1, 1]) {
    addPart(g, styler, cyanTrimGeo, COL_CYAN_NEON, [side * 0.362, 0, 0], [0, 0, 0], 0.002, {
      emissiveHex: '#06b6d4',
      emissiveIntensity: 0.42,
      roughness: 0.25,
    });
  }

  // Side Graphic Decal ("Side Graphic Decal Tampak Samping" - Diagonal Cyan & Magenta geometric stripes on left & right outer faces)
  const sideCyanStripeProfile: [number, number][] = [
    [0.24, 0.56],
    [0.31, 0.68],
    [-0.27, 0.96],
    [-0.27, 0.79],
  ];
  const sideMagentaStripeProfile: [number, number][] = [
    [0.19, 0.48],
    [0.23, 0.54],
    [-0.27, 0.77],
    [-0.27, 0.71],
  ];
  const sideCyanStripeGeo = makeExtrudedSideProfileGeo(sideCyanStripeProfile, 0.008, 0.001);
  const sideMagentaStripeGeo = makeExtrudedSideProfileGeo(sideMagentaStripeProfile, 0.008, 0.001);
  for (const side of [-1, 1]) {
    addPart(g, styler, sideCyanStripeGeo, COL_CYAN_NEON, [side * 0.395, 0, 0], [0, 0, 0], 0.002, {
      emissiveHex: '#0891b2',
      emissiveIntensity: 0.38,
      roughness: 0.28,
    });
    addPart(g, styler, sideMagentaStripeGeo, COL_MAGENTA_NEON, [side * 0.395, 0, 0], [0, 0, 0], 0.002, {
      emissiveHex: '#db2777',
      emissiveIntensity: 0.38,
      roughness: 0.28,
    });
    // Lower rear side service latch detail shown on Side Profile Elevation
    addPart(g, styler, makeRoundedBoxGeo(0.010, 0.075, 0.058, 0.002, 1), '#151820', [side * 0.395, 0.11, -0.18], [0, 0, 0], 0.002);
  }

  // 3. Central Cabinet Body Core (x in [-0.33, +0.33])
  const centerBodyProfile: [number, number][] = [
    [-0.30, 0.03],
    [-0.30, 1.64],
    [-0.27, 1.67],
    [0.14, 1.80],
    [0.21, 1.80],
    [0.21, 1.62],
    [0.04, 1.55],
    [0.15, 0.94],
    [0.35, 0.88],
    [0.33, 0.70],
    [0.18, 0.62],
    [0.18, 0.03],
  ];
  addPart(g, styler, makeExtrudedSideProfileGeo(centerBodyProfile, 0.665, 0.004), COL_CABINET_PANEL, [0, 0, 0], [0, 0, 0], 0.004, {
    tex: metal,
    tintTex: true,
    roughness: 0.50,
    metalness: 0.16,
  });

  // 4. Illuminated Marquee Header ("NEO-STRIKE ARCADE", y = 1.62 .. 1.79m, z = +0.215m)
  addPart(g, styler, makeRoundedBoxGeo(0.66, 0.165, 0.024, 0.006, 2), COL_BEZEL_SLATE, [0, 1.708, 0.212], [0, 0, 0], 0.003);
  addPart(g, styler, makeRoundedBoxGeo(0.635, 0.142, 0.014, 0.004, 2), '#0d2b3e', [0, 1.708, 0.220], [0, 0, 0], 0.002, {
    emissiveHex: '#0891b2',
    emissiveIntensity: 0.35,
    roughness: 0.24,
  });
  if (marqueeTex) {
    addPart(g, styler, new THREE.PlaneGeometry(0.62, 0.132), '#ffffff', [0, 1.708, 0.228], [0, 0, 0], 0, {
      tex: marqueeTex,
      emissiveHex: '#38bdf8',
      emissiveIntensity: 0.42,
      roughness: 0.20,
      clearcoat: 0.65,
    });
  } else {
    // 3D geometric neon typography bars for vertex-baked views
    for (const gx of [-0.21, -0.13, -0.05, 0.04, 0.12, 0.20]) {
      addPart(g, styler, new THREE.BoxGeometry(0.055, 0.036, 0.006), '#67e8f9', [gx, 1.728, 0.229], [0, 0, 0], 0, {
        emissiveHex: '#22d3ee',
        emissiveIntensity: 0.5,
      });
    }
    for (const gx of [-0.11, -0.03, 0.05, 0.12]) {
      addPart(g, styler, new THREE.BoxGeometry(0.05, 0.024, 0.006), '#f472b6', [gx, 1.682, 0.229], [0, 0, 0], 0, {
        emissiveHex: '#ec4899',
        emissiveIntensity: 0.5,
      });
    }
  }

  // 5. Under-Marquee Stereo Speaker Grille Soffit (y = 1.54 .. 1.62m)
  const speakerSoffit = new THREE.Group();
  speakerSoffit.position.set(0, 1.582, 0.128);
  speakerSoffit.rotation.x = 0.38;
  g.add(speakerSoffit);
  addPart(speakerSoffit, styler, makeRoundedBoxGeo(0.65, 0.085, 0.04, 0.005, 1), COL_BEZEL_SLATE, [0, 0, 0], [0, 0, 0], 0.002);
  const slotGeo = new THREE.BoxGeometry(0.14, 0.006, 0.008);
  for (const side of [-1, 1]) {
    for (let s = 0; s < 4; s++) {
      addPart(speakerSoffit, styler, slotGeo, '#0f1319', [side * 0.18, -0.018 + s * 0.012, 0.018], [0, 0, 0], 0);
    }
  }

  // 6. Illuminated Angled CRT / Curved LCD Gaming Monitor (y = 0.95 .. 1.53m)
  const monitorBay = new THREE.Group();
  monitorBay.position.set(0, 1.245, 0.118);
  monitorBay.rotation.x = -0.20;
  g.add(monitorBay);

  // Molded outer monitor bezel + cyan inner accent border
  addPart(monitorBay, styler, makeRoundedBoxGeo(0.64, 0.54, 0.055, 0.016, 2), COL_BEZEL_SLATE, [0, 0, 0], [0, 0, 0], 0.004, {
    roughness: 0.52,
    metalness: 0.20,
  });
  addPart(monitorBay, styler, makeRoundedBoxGeo(0.56, 0.45, 0.024, 0.022, 2), COL_CYAN_NEON, [0, 0, 0.020], [0, 0, 0], 0.002, {
    emissiveHex: '#06b6d4',
    emissiveIntensity: 0.32,
  });
  addPart(monitorBay, styler, makeRoundedBoxGeo(0.535, 0.425, 0.022, 0.020, 2), '#111827', [0, 0, 0.024], [0, 0, 0], 0.002);
  addPart(
    monitorBay,
    styler,
    new THREE.PlaneGeometry(0.50, 0.39),
    screenTex ? '#ffffff' : '#8fd0e8',
    [0, 0, 0.036],
    [0, 0, 0],
    0,
    {
      tex: screenTex,
      roughness: 0.14,
      metalness: 0.08,
      clearcoat: 0.90,
      clearcoatRoughness: 0.10,
      emissiveHex: '#38bdf8',
      emissiveIntensity: 0.26,
    },
  );

  // 7. Control Deck - 2-Player Joysticks & 12 Arcade Push Buttons (y = 0.70 .. 0.91m, z = 0.15 .. 0.37m)
  const controlDeck = new THREE.Group();
  controlDeck.position.set(0, 0.875, 0.255);
  controlDeck.rotation.x = 0.18;
  g.add(controlDeck);

  // Control console surface plate + Cyan/Magenta front apron molding
  addPart(controlDeck, styler, makeRoundedBoxGeo(0.66, 0.055, 0.23, 0.010, 2), COL_BEZEL_SLATE, [0, 0, 0], [0, 0, 0], 0.004, {
    roughness: 0.44,
    metalness: 0.22,
  });
  addPart(controlDeck, styler, makeRoundedBoxGeo(0.668, 0.018, 0.236, 0.005, 1), COL_CYAN_NEON, [0, 0.016, 0.002], [0, 0, 0], 0.002, {
    emissiveHex: '#06b6d4',
    emissiveIntensity: 0.35,
  });
  addPart(controlDeck, styler, makeRoundedBoxGeo(0.668, 0.016, 0.024, 0.004, 1), COL_MAGENTA_NEON, [0, -0.016, 0.108], [0, 0, 0], 0.002, {
    emissiveHex: '#ec4899',
    emissiveIntensity: 0.38,
  });

  // 2-Player Joysticks (Player 1 Left Red Ball-Top, Player 2 Right Cyan-Blue Ball-Top)
  const washerGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.006, 14);
  const shaftGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.058, 10);
  const ballGeo = new THREE.SphereGeometry(0.020, 14, 12);
  const playerConfigs: Array<{ joyX: number; ballHex: string; btnBaseX: number }> = [
    { joyX: -0.235, ballHex: '#ef4444', btnBaseX: -0.135 },
    { joyX: 0.055, ballHex: '#38bdf8', btnBaseX: 0.155 },
  ];
  const btnColors = ['#ef4444', '#facc15', '#38bdf8', '#22c55e', '#fb923c', '#ec4899'];
  const btnBezelGeo = new THREE.CylinderGeometry(0.013, 0.015, 0.008, 12);
  const btnCapGeo = new THREE.CylinderGeometry(0.010, 0.010, 0.012, 12);

  for (const pc of playerConfigs) {
    // Dust washer + Chrome shaft + Glossy Ball Top
    addPart(controlDeck, styler, washerGeo, '#0f172a', [pc.joyX, 0.030, 0.012], [0, 0, 0], 0.001);
    addPart(controlDeck, styler, shaftGeo, COL_CHROME, [pc.joyX, 0.056, 0.012], [0, 0, 0], 0.001, {
      metalness: 0.70,
      roughness: 0.20,
    });
    addPart(controlDeck, styler, ballGeo, pc.ballHex, [pc.joyX, 0.088, 0.012], [0, 0, 0], 0.002, {
      roughness: 0.15,
      clearcoat: 0.90,
      emissiveHex: pc.ballHex,
      emissiveIntensity: 0.22,
    });

    // 6 Arcade Push Buttons arranged in 2 ergonomic curved rows of 3
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const bx = pc.btnBaseX + col * 0.036;
        const bz = (row === 0 ? -0.012 : 0.026) - (col === 1 ? 0.006 : 0);
        const colHex = btnColors[(row * 3 + col) % btnColors.length];
        addPart(controlDeck, styler, btnBezelGeo, '#111827', [bx, 0.030, bz], [0, 0, 0], 0.001);
        addPart(controlDeck, styler, btnCapGeo, colHex, [bx, 0.034, bz], [0, 0, 0], 0.001, {
          emissiveHex: colHex,
          emissiveIntensity: 0.28,
          roughness: 0.22,
        });
      }
    }
  }

  // 1P / 2P Start & Coin Credit Micro-Buttons along upper deck center
  for (const sx of [-0.18, -0.03, 0.03, 0.18]) {
    addPart(controlDeck, styler, btnCapGeo, sx < 0 ? '#f8fafc' : '#38bdf8', [sx, 0.032, -0.062], [0, 0, 0], 0.001, {
      emissiveHex: '#e2e8f0',
      emissiveIntensity: 0.20,
    });
  }

  // 8. Lower Front Cabinet Panel: Neon V-Chevrons, Double Coin Door Acceptor Mechanism & Speaker Kick Plates
  // Diagonal Cyan & Magenta V-chevron accent bars flanking the coin door
  const chevronBarGeo = makeRoundedBoxGeo(0.18, 0.014, 0.010, 0.003, 1);
  for (const side of [-1, 1]) {
    addPart(g, styler, chevronBarGeo, COL_CYAN_NEON, [side * 0.225, 0.34, 0.192], [0, 0, -side * 0.62], 0.001, {
      emissiveHex: '#06b6d4',
      emissiveIntensity: 0.40,
    });
    addPart(g, styler, chevronBarGeo, COL_MAGENTA_NEON, [side * 0.225, 0.315, 0.192], [0, 0, -side * 0.62], 0.001, {
      emissiveHex: '#ec4899',
      emissiveIntensity: 0.40,
    });
    // Horizontal lower continuation toward coin door
    addPart(g, styler, makeRoundedBoxGeo(0.08, 0.014, 0.010, 0.003, 1), COL_CYAN_NEON, [side * 0.135, 0.285, 0.192], [0, 0, 0], 0.001, {
      emissiveHex: '#06b6d4',
      emissiveIntensity: 0.40,
    });
    addPart(g, styler, makeRoundedBoxGeo(0.08, 0.014, 0.010, 0.003, 1), COL_MAGENTA_NEON, [side * 0.135, 0.262, 0.192], [0, 0, 0], 0.001, {
      emissiveHex: '#ec4899',
      emissiveIntensity: 0.40,
    });
  }

  // Double Coin Door Acceptor Mechanism (Center lower front, y = 0.14 .. 0.58m, z = 0.194m)
  addPart(g, styler, makeRoundedBoxGeo(0.22, 0.44, 0.022, 0.008, 2), '#1b1f28', [0, 0.36, 0.192], [0, 0, 0], 0.004, {
    roughness: 0.46,
    metalness: 0.30,
  });
  // Upper Coin Acceptor Door + 2 Illuminated Red/Orange Coin Reject Buttons
  addPart(g, styler, makeRoundedBoxGeo(0.185, 0.20, 0.014, 0.005, 1), '#252b37', [0, 0.46, 0.202], [0, 0, 0], 0.003);
  for (const cx of [-0.042, 0.042]) {
    // Glowing red/orange coin insert/reject button bezel & backlit button
    addPart(g, styler, makeRoundedBoxGeo(0.044, 0.052, 0.012, 0.003, 1), '#111827', [cx, 0.505, 0.208], [0, 0, 0], 0.001);
    addPart(g, styler, makeRoundedBoxGeo(0.032, 0.038, 0.014, 0.003, 1), '#f97316', [cx, 0.505, 0.212], [0, 0, 0], 0.001, {
      emissiveHex: '#ef4444',
      emissiveIntensity: 0.85,
      roughness: 0.20,
    });
    // Coin return pocket below each reject button
    addPart(g, styler, makeRoundedBoxGeo(0.044, 0.046, 0.012, 0.003, 1), '#111827', [cx, 0.405, 0.208], [0, 0, 0], 0.002);
  }
  // Lower Cash Vault Door + Keylock Cylinder
  addPart(g, styler, makeRoundedBoxGeo(0.185, 0.18, 0.014, 0.005, 1), '#252b37', [0, 0.25, 0.202], [0, 0, 0], 0.003);
  for (const ky of [0.465, 0.31]) {
    addPart(g, styler, new THREE.CylinderGeometry(0.010, 0.010, 0.014, 10), COL_CHROME, [0.068, ky, 0.208], [Math.PI / 2, 0, 0], 0.001, {
      metalness: 0.65,
    });
  }

  // Lower Speaker Kick Plates (Left & Right perforated grilles at y = 0.088m)
  for (const side of [-1, 1]) {
    addPart(g, styler, makeRoundedBoxGeo(0.15, 0.072, 0.014, 0.006, 2), '#151820', [side * 0.22, 0.088, 0.192], [0, 0, 0], 0.002, {
      roughness: 0.70,
    });
  }

  // 9. Rear Elevation ("Tampak Belakang", z = -0.30m): Upper Louvers, Flush Service Maintenance Door & Power Conduit Port
  // Upper Ventilation Cooling Louvers (2 columns of 6 horizontal slots)
  const rearLouverGeo = new THREE.BoxGeometry(0.20, 0.010, 0.010);
  for (const lx of [-0.14, 0.14]) {
    for (let i = 0; i < 6; i++) {
      addPart(g, styler, rearLouverGeo, '#14171f', [lx, 1.41 + i * 0.024, -0.302], [0, 0, 0], 0);
    }
  }

  // Rear Flush Service Maintenance Door with Keylock & Hinges (y = 0.38 .. 1.28m)
  addPart(g, styler, makeRoundedBoxGeo(0.46, 0.88, 0.014, 0.008, 2), '#262b36', [0, 0.83, -0.302], [0, 0, 0], 0.004, {
    tex: metal,
    tintTex: true,
    roughness: 0.48,
    metalness: 0.22,
  });
  // Left-side dual service door hinges
  for (const hy of [1.12, 0.54]) {
    addPart(g, styler, new THREE.BoxGeometry(0.018, 0.065, 0.016), '#151820', [-0.23, hy, -0.305], [0, 0, 0], 0.002);
  }
  // Right-side Keylock cylinder + keyhole slot
  addPart(g, styler, new THREE.CylinderGeometry(0.018, 0.018, 0.016, 12), COL_CHROME, [0.175, 0.78, -0.306], [Math.PI / 2, 0, 0], 0.002, {
    metalness: 0.6,
  });
  addPart(g, styler, new THREE.BoxGeometry(0.006, 0.028, 0.018), '#0f172a', [0.175, 0.76, -0.307], [0, 0, 0], 0);

  // Lower Left Cooling Louvers & Lower Right Power Cable Conduit Entry Port
  const lowerLouverGeo = new THREE.BoxGeometry(0.18, 0.010, 0.010);
  for (let i = 0; i < 5; i++) {
    addPart(g, styler, lowerLouverGeo, '#14171f', [-0.16, 0.10 + i * 0.022, -0.302], [0, 0, 0], 0);
  }
  addPart(g, styler, makeRoundedBoxGeo(0.14, 0.11, 0.014, 0.004, 1), '#1b1f28', [0.17, 0.14, -0.302], [0, 0, 0], 0.002);
  addPart(g, styler, new THREE.BoxGeometry(0.036, 0.048, 0.016), '#0f172a', [0.17, 0.135, -0.305], [0, 0, 0], 0.001);
  addPart(g, styler, new THREE.BoxGeometry(0.016, 0.022, 0.018), '#ef4444', [0.17, 0.135, -0.307], [0, 0, 0], 0);

  g.scale.setScalar(scale);
  return g;
}


// ---------------------------------------------------------------------------
// SHARED 1:1 L-SHAPED BOTANICAL GLASSHOUSE ARCHITECTURE SHELL
// Used IDENTICALLY for BOTH Exterior South Plaza AND Interior Cafe Room!
// ---------------------------------------------------------------------------

export interface LShapedGlasshouseShellConfig {
  xWest: number;
  xWingEast: number;
  xEast: number;
  /** Continuous outer Main Hall wall (opposite side of projecting wing) */
  zBack: number;
  /** Recessed courtyard wall where the entrance double doors sit */
  zRecessed: number;
  /** Outer projecting gable end of L-Wing */
  zWingTip: number;
  /** -1 if Wing projects toward -Z (Exterior North), +1 if +Z (Interior South) */
  wingDir: -1 | 1;
  /** -1 if Wing sits on xWest side (Exterior), +1 if Wing sits on xEast/+X side (Interior Left when facing +Z door) */
  wingSide?: -1 | 1;
  doorX: number;
  doorHalfW: number;
  eavesY: number;
  ridgeY: number;
  kneeH: number;
  baysBack: number;
  baysEast: number;
  baysWest: number;
  baysWingTip: number;
  baysWingInner: number;
  baysCourtyardLeft: number;
  baysCourtyardRight: number;
  floorY: number;
  openDoorsOutward?: boolean;
  includeStoneApronAndPorch?: boolean;
  includeCourtyardNotchPatio?: boolean;
  courtyardPatioParent?: THREE.Object3D;
  parquetTex?: THREE.Texture | null;
}

export function buildLShapedGlasshouseArchitecture(
  parent: THREE.Object3D,
  styler: CafeAssetStyler,
  cfg: LShapedGlasshouseShellConfig,
): void {
  const COL_BRONZE = '#45382e';
  const COL_BRONZE_DARK = '#2e241d';
  const COL_BRONZE_LIGHT = '#5e4d3f';
  const COL_PANEL_INSET = '#544437';
  const COL_STONE_APRON = '#d6cfc2';
  const COL_STONE_TRIM = '#b9b0a1';

  const archGlassMat = styler.frostedGlassMat ?? styler.clearGlassMat;
  const prepFrostGeo = (geo: THREE.BufferGeometry): THREE.BufferGeometry =>
    styler.tagFrostedGlassGeometry ? styler.tagFrostedGlassGeometry(geo) : geo;
  const flagstoneTex =
    styler.preserveTextures === false || typeof document === 'undefined'
      ? null
      : createSandstoneFlagstoneTexture(0.95, 0.95);

  const sx: -1 | 1 = cfg.wingSide ?? -1;
  const xOuterWing = sx === -1 ? cfg.xWest : cfg.xEast;
  const xOpposite = sx === -1 ? cfg.xEast : cfg.xWest;
  const xJunction = cfg.xWingEast;

  const mainW = cfg.xEast - cfg.xWest;
  const mainD = Math.abs(cfg.zBack - cfg.zRecessed);
  const mainMidX = (cfg.xWest + cfg.xEast) * 0.5;
  const mainMidZ = (cfg.zBack + cfg.zRecessed) * 0.5;

  const wingW = Math.abs(xOuterWing - xJunction);
  const wingD = Math.abs(cfg.zWingTip - cfg.zRecessed);
  const wingMidX = (xOuterWing + xJunction) * 0.5;
  const wingMidZ = (cfg.zWingTip + cfg.zRecessed) * 0.5;

  const RIDGE_Z = mainMidZ;
  const RIDGE_X = wingMidX;
  const halfMainD = mainD * 0.5;
  const halfWingW = wingW * 0.5;
  const dir = cfg.wingDir;

  const inwardX = (u: number) => RIDGE_X - sx * u * halfWingW;
  const outerX = (u: number) => RIDGE_X + sx * u * halfWingW;

  // 1. L-SHAPED SANDSTONE APRON, COURTYARD PATIO & HERRINGBONE PARQUET FLOOR
  if (cfg.includeStoneApronAndPorch) {
    addPart(parent, styler, makeRoundedBoxGeo(mainW + 0.70, 0.045, mainD + 0.70, 0.015, 2), COL_STONE_APRON, [mainMidX, cfg.floorY + 0.02, mainMidZ], [0, 0, 0], 0.006, {
      tex: flagstoneTex,
      roughness: 0.85,
    });
    addPart(parent, styler, makeRoundedBoxGeo(wingW + 0.70, 0.045, wingD + 0.40, 0.015, 2), COL_STONE_APRON, [wingMidX, cfg.floorY + 0.02, wingMidZ - dir * 0.2], [0, 0, 0], 0.006, {
      tex: flagstoneTex,
      roughness: 0.85,
    });
    // Entrance porch stepping out onto courtyard
    addPart(parent, styler, makeRoundedBoxGeo(4.40, 0.052, 1.80, 0.018, 2), '#cfc6b6', [cfg.doorX, cfg.floorY + 0.025, cfg.zRecessed + dir * 0.85], [0, 0, 0], 0.006, {
      tex: flagstoneTex,
      roughness: 0.84,
    });
    addPart(parent, styler, makeRoundedBoxGeo(4.65, 0.028, 2.02, 0.012, 2), COL_STONE_TRIM, [cfg.doorX, cfg.floorY + 0.014, cfg.zRecessed + dir * 0.85], [0, 0, 0], 0.005, {
      roughness: 0.88,
    });
  }

  if (cfg.includeCourtyardNotchPatio) {
    const patioHost = cfg.courtyardPatioParent ?? parent;
    const patioW = Math.abs(xOpposite - xJunction) + 0.35;
    const patioD = Math.abs(cfg.zWingTip - cfg.zRecessed) + 0.35;
    const patioMidX = (xJunction + xOpposite) * 0.5;
    const patioMidZ = (cfg.zRecessed + cfg.zWingTip) * 0.5;
    addPart(patioHost, styler, makeRoundedBoxGeo(patioW, 0.08, patioD, 0.02, 2), '#d6cfc2', [patioMidX, cfg.floorY - 0.04, patioMidZ], [0, 0, 0], 0, {
      tex: flagstoneTex,
      roughness: 0.86,
    });
    addPart(patioHost, styler, makeRoundedBoxGeo(3.4, 0.06, 1.35, 0.018, 2), '#cfc6b6', [cfg.doorX, cfg.floorY + 0.02, cfg.zRecessed + dir * 0.72], [0, 0, 0], 0, {
      tex: flagstoneTex,
      roughness: 0.84,
    });
  }

  // Continuous Seamless Monolithic L-Shaped Honey-Oak Herringbone Parquet Floor
  const xOppIn = xOpposite + sx * 0.08;
  const xOutIn = xOuterWing - sx * 0.08;
  const xJuncIn = xJunction + sx * 0.08;
  const zBackIn = cfg.zBack + dir * 0.08;
  const zTipIn = cfg.zWingTip - dir * 0.08;
  const zRecIn = cfg.zRecessed - dir * 0.08;
  const lFloorShape = new THREE.Shape([
    new THREE.Vector2(xOppIn, -zBackIn),
    new THREE.Vector2(xOutIn, -zBackIn),
    new THREE.Vector2(xOutIn, -zTipIn),
    new THREE.Vector2(xJuncIn, -zTipIn),
    new THREE.Vector2(xJuncIn, -zRecIn),
    new THREE.Vector2(xOppIn, -zRecIn),
  ]);
  lFloorShape.closePath();
  const rawFloorGeo = new THREE.ExtrudeGeometry(lFloorShape, {
    depth: 0.04,
    bevelEnabled: false,
  });
  rawFloorGeo.rotateX(-Math.PI / 2);
  const seamlessParquetGeo = applyBoxProjectedUvs(rawFloorGeo, 0.65);
  addPart(parent, styler, seamlessParquetGeo, '#c89254', [0, cfg.floorY + 0.01, 0], [0, 0, 0], 0, {
    tex: cfg.parquetTex,
    roughness: 0.48,
    clearcoat: 0.14,
  });

  if (styler.preserveTextures === false) {
    // Zero-Draw-Call 3D Multi-Tone Herringbone Chevron Parquet Planks (bakes 100% into vertex-color buffer!)
    const mainMinX = Math.min(xOppIn, xOutIn) + 0.18;
    const mainMaxX = Math.max(xOppIn, xOutIn) - 0.18;
    const mainMinZ = Math.min(zBackIn, zRecIn) + 0.18;
    const mainMaxZ = Math.max(zBackIn, zRecIn) - 0.18;
    const wingMinX = Math.min(xOutIn, xJuncIn) + 0.18;
    const wingMaxX = Math.max(xOutIn, xJuncIn) - 0.18;
    const wingMinZ = Math.min(zRecIn, zTipIn) + 0.18;
    const wingMaxZ = Math.max(zRecIn, zTipIn) - 0.18;
    const allMinX = Math.min(mainMinX, wingMinX);
    const allMaxX = Math.max(mainMaxX, wingMaxX);
    const allMinZ = Math.min(mainMinZ, wingMinZ);
    const allMaxZ = Math.max(mainMaxZ, wingMaxZ);

    const isInsideL = (px: number, pz: number) =>
      (px >= mainMinX && px <= mainMaxX && pz >= mainMinZ && pz <= mainMaxZ) ||
      (px >= wingMinX && px <= wingMaxX && pz >= wingMinZ && pz <= wingMaxZ);

    const shadeBuckets: [number[], number[], number[]] = [[], [], []];
    const shadeHexes = ['#d8a164', '#b67d42', '#cc9355'] as const;
    const colPitch = 0.78;
    const rowPitch = 0.39;
    const halfLen = 0.50;
    const halfWid = 0.135;
    const cos45 = Math.SQRT1_2;
    const plankY = cfg.floorY + 0.055;

    let colIdx = 0;
    for (let gx = allMinX + 0.35; gx <= allMaxX - 0.35; gx += colPitch) {
      const sign = colIdx % 2 === 0 ? 1 : -1;
      const ux = cos45;
      const uz = sign * cos45;
      const vx = -uz;
      const vz = ux;
      let rowIdx = 0;
      for (let gz = allMinZ + 0.25; gz <= allMaxZ - 0.25; gz += rowPitch) {
        const c0x = gx - ux * halfLen - vx * halfWid;
        const c0z = gz - uz * halfLen - vz * halfWid;
        const c1x = gx + ux * halfLen - vx * halfWid;
        const c1z = gz + uz * halfLen - vz * halfWid;
        const c2x = gx + ux * halfLen + vx * halfWid;
        const c2z = gz + uz * halfLen + vz * halfWid;
        const c3x = gx - ux * halfLen + vx * halfWid;
        const c3z = gz - uz * halfLen + vz * halfWid;
        if (
          isInsideL(c0x, c0z) &&
          isInsideL(c1x, c1z) &&
          isInsideL(c2x, c2z) &&
          isInsideL(c3x, c3z)
        ) {
          const bArr = shadeBuckets[(colIdx * 2 + rowIdx) % 3];
          bArr.push(
            c0x, plankY, c0z,
            c3x, plankY, c3z,
            c2x, plankY, c2z,
            c0x, plankY, c0z,
            c2x, plankY, c2z,
            c1x, plankY, c1z,
          );
        }
        rowIdx++;
      }
      colIdx++;
    }

    for (let s = 0; s < 3; s++) {
      const posArr = shadeBuckets[s];
      if (posArr.length === 0) continue;
      const chevronGeo = new THREE.BufferGeometry();
      chevronGeo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
      const normArr = new Float32Array(posArr.length);
      for (let k = 1; k < normArr.length; k += 3) normArr[k] = 1;
      chevronGeo.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
      addPart(parent, styler, chevronGeo, shadeHexes[s], [0, 0, 0], [0, 0, 0], 0, {
        roughness: 0.50,
      });
    }
  }

  // 2. DARK BRONZE ROUNDED PANELLED KNEE-WALLS, MULLIONS & ARCHED WINDOW BAYS
  const buildWallSegmentWithBays = (x1: number, z1: number, x2: number, z2: number, bays: number) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.1 || bays < 1) return;
    const wallGrp = new THREE.Group();
    wallGrp.position.set((x1 + x2) * 0.5, cfg.floorY, (z1 + z2) * 0.5);
    wallGrp.rotation.y = -Math.atan2(dz, dx);
    parent.add(wallGrp);

    // Rounded Plinth + Knee-Wall + Chamfered Sill Coping + Eaves Cornice
    addPart(wallGrp, styler, makeRoundedBoxGeo(len + 0.04, 0.14, 0.28, 0.02, 2), COL_BRONZE_DARK, [0, 0.11, 0], [0, 0, 0], 0.005, {
      metalness: 0.28,
      roughness: 0.46,
    });
    addPart(wallGrp, styler, makeRoundedBoxGeo(len, cfg.kneeH - 0.18, 0.22, 0.018, 2), COL_BRONZE, [0, 0.18 + (cfg.kneeH - 0.18) * 0.5, 0], [0, 0, 0], 0.006, {
      metalness: 0.24,
      roughness: 0.52,
    });
    addPart(wallGrp, styler, makeRoundedBoxGeo(len + 0.06, 0.085, 0.27, 0.022, 2), COL_BRONZE_DARK, [0, cfg.kneeH, 0], [0, 0, 0], 0.005, {
      metalness: 0.28,
      roughness: 0.45,
    });
    addPart(wallGrp, styler, makeRoundedBoxGeo(len + 0.08, 0.14, 0.22, 0.025, 2), COL_BRONZE, [0, cfg.eavesY, 0], [0, 0, 0], 0.006, {
      metalness: 0.26,
      roughness: 0.46,
    });
    addPart(wallGrp, styler, makeRoundedBoxGeo(len + 0.12, 0.06, 0.26, 0.018, 2), COL_BRONZE_DARK, [0, cfg.eavesY + 0.09, 0], [0, 0, 0], 0.005, {
      metalness: 0.28,
      roughness: 0.45,
    });

    const bayW = len / bays;
    const glassH = cfg.eavesY - cfg.kneeH - 0.06;
    const glassMidY = cfg.kneeH + glassH * 0.5 + 0.03;

    const pane = new THREE.Mesh(prepFrostGeo(new THREE.PlaneGeometry(len - 0.08, glassH)), archGlassMat);
    pane.position.set(0, glassMidY, 0);
    pane.castShadow = false;
    pane.receiveShadow = false;
    pane.renderOrder = 2;
    pane.raycast = () => {};
    wallGrp.add(pane);

    for (let b = 0; b <= bays; b++) {
      const mx = -len * 0.5 + b * bayW;
      addPart(wallGrp, styler, makeRoundedBoxGeo(0.11, cfg.eavesY - 0.04, 0.14, 0.022, 2), COL_BRONZE, [mx, cfg.eavesY * 0.5, 0], [0, 0, 0], 0.005, {
        metalness: 0.26,
        roughness: 0.46,
      });
      if (b < bays) {
        const bx = mx + bayW * 0.5;
        // Beveled raised dado panel inset on knee-wall
        addPart(wallGrp, styler, makeRoundedBoxGeo(Math.max(0.24, bayW - 0.24), cfg.kneeH - 0.34, 0.25, 0.02, 2), COL_PANEL_INSET, [bx, 0.42, 0], [0, 0, 0], 0.004, {
          roughness: 0.55,
        });
        // Smooth Victorian segmental transom arch
        const archPts: THREE.Vector3[] = [];
        const halfSpan = Math.max(0.2, (bayW - 0.14) * 0.5);
        for (let s = 0; s <= 12; s++) {
          const ang = Math.PI * (1 - s / 12);
          archPts.push(new THREE.Vector3(bx + Math.cos(ang) * halfSpan, cfg.eavesY - 0.46 + Math.sin(ang) * 0.38, 0));
        }
        addPart(
          wallGrp,
          styler,
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(archPts), 14, 0.032, 8, false),
          COL_BRONZE_LIGHT,
          [0, 0, 0],
          [0, 0, 0],
          0.004,
          { metalness: 0.25 },
        );
      }
    }
  };

  // Perimeter L-shape walls:
  const cMinX = Math.min(xJunction, xOpposite);
  const cMaxX = Math.max(xJunction, xOpposite);
  buildWallSegmentWithBays(cfg.xWest, cfg.zBack, cfg.xEast, cfg.zBack, cfg.baysBack);
  buildWallSegmentWithBays(xOpposite, cfg.zRecessed, xOpposite, cfg.zBack, cfg.baysEast);
  buildWallSegmentWithBays(xOuterWing, cfg.zWingTip, xOuterWing, cfg.zBack, cfg.baysWest);
  buildWallSegmentWithBays(Math.min(xOuterWing, xJunction), cfg.zWingTip, Math.max(xOuterWing, xJunction), cfg.zWingTip, cfg.baysWingTip);
  buildWallSegmentWithBays(xJunction, cfg.zWingTip, xJunction, cfg.zRecessed, cfg.baysWingInner);
  buildWallSegmentWithBays(cMinX, cfg.zRecessed, cfg.doorX - cfg.doorHalfW, cfg.zRecessed, cfg.baysCourtyardLeft);
  buildWallSegmentWithBays(cfg.doorX + cfg.doorHalfW, cfg.zRecessed, cMaxX, cfg.zRecessed, cfg.baysCourtyardRight);

  // Grand Entrance Double Doors & Semicircular Sunburst Fanlight Arch
  const doorGrp = new THREE.Group();
  doorGrp.position.set(cfg.doorX, cfg.floorY, cfg.zRecessed);
  parent.add(doorGrp);

  for (const sx of [-cfg.doorHalfW, cfg.doorHalfW]) {
    addPart(doorGrp, styler, makeRoundedBoxGeo(0.16, cfg.eavesY + 0.08, 0.22, 0.025, 2), COL_BRONZE_DARK, [sx, (cfg.eavesY + 0.08) * 0.5, 0], [0, 0, 0], 0.006, {
      metalness: 0.28,
      roughness: 0.44,
    });
  }
  addPart(doorGrp, styler, makeRoundedBoxGeo(cfg.doorHalfW * 2 + 0.22, 0.15, 0.22, 0.025, 2), COL_BRONZE_DARK, [0, cfg.eavesY, 0], [0, 0, 0], 0.006, {
    metalness: 0.28,
    roughness: 0.44,
  });

  const fanOuterPts: THREE.Vector3[] = [];
  const fanInnerPts: THREE.Vector3[] = [];
  for (let s = 0; s <= 18; s++) {
    const ang = (Math.PI * s) / 18;
    fanOuterPts.push(new THREE.Vector3(Math.cos(ang) * cfg.doorHalfW, cfg.eavesY + Math.sin(ang) * cfg.doorHalfW, 0));
    fanInnerPts.push(new THREE.Vector3(Math.cos(ang) * (cfg.doorHalfW * 0.54), cfg.eavesY + Math.sin(ang) * (cfg.doorHalfW * 0.54), 0));
  }
  addPart(doorGrp, styler, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fanOuterPts), 20, 0.075, 10, false), COL_BRONZE_DARK, [0, 0, 0], [0, 0, 0], 0.006);
  addPart(doorGrp, styler, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fanInnerPts), 14, 0.036, 8, false), COL_BRONZE_LIGHT, [0, 0, 0], [0, 0, 0], 0.005);
  for (const frac of [0.20, 0.40, 0.60, 0.80]) {
    const theta = Math.PI * frac;
    const radMid = cfg.doorHalfW * 0.77;
    addPart(
      doorGrp,
      styler,
      new THREE.CylinderGeometry(0.022, 0.022, cfg.doorHalfW * 0.44, 8),
      COL_BRONZE_LIGHT,
      [Math.cos(theta) * radMid, cfg.eavesY + Math.sin(theta) * radMid, 0],
      [0, 0, theta - Math.PI / 2],
      0.004,
    );
  }
  const fanGlass = new THREE.Mesh(prepFrostGeo(new THREE.CircleGeometry(cfg.doorHalfW - 0.04, 22, 0, Math.PI)), archGlassMat);
  fanGlass.position.set(0, cfg.eavesY, 0);
  fanGlass.castShadow = false;
  fanGlass.receiveShadow = false;
  fanGlass.renderOrder = 2;
  fanGlass.raycast = () => {};
  doorGrp.add(fanGlass);

  // Twin Open Glass Double Doors swung outward toward courtyard (`dir`)
  const swingAngle = cfg.openDoorsOutward === false ? 0.0 : dir * 1.38;
  for (const side of [-1, 1]) {
    const leafPivot = new THREE.Group();
    leafPivot.position.set(side * (cfg.doorHalfW - 0.06), 0.048, 0);
    leafPivot.rotation.y = side * swingAngle;
    doorGrp.add(leafPivot);

    const leafW = cfg.doorHalfW - 0.08;
    const leafCenterX = -side * leafW * 0.5;
    addPart(leafPivot, styler, makeRoundedBoxGeo(leafW, 0.72, 0.07, 0.015, 2), COL_BRONZE, [leafCenterX, 0.36, 0], [0, 0, 0], 0.004);
    addPart(leafPivot, styler, makeRoundedBoxGeo(0.09, cfg.eavesY - 0.16, 0.07, 0.015, 2), COL_BRONZE_DARK, [leafCenterX - side * (leafW * 0.5 - 0.04), (cfg.eavesY - 0.16) * 0.5, 0], [0, 0, 0], 0.004);
    addPart(leafPivot, styler, makeRoundedBoxGeo(0.09, cfg.eavesY - 0.16, 0.07, 0.015, 2), COL_BRONZE_DARK, [leafCenterX + side * (leafW * 0.5 - 0.04), (cfg.eavesY - 0.16) * 0.5, 0], [0, 0, 0], 0.004);
    addPart(leafPivot, styler, makeRoundedBoxGeo(leafW, 0.11, 0.07, 0.015, 2), COL_BRONZE_DARK, [leafCenterX, cfg.eavesY - 0.20, 0], [0, 0, 0], 0.004);
    addPart(leafPivot, styler, new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8), '#d4af37', [leafCenterX - side * (leafW * 0.36), 1.32, dir * 0.055], [0, 0, 0], 0.003, {
      metalness: 0.75,
      roughness: 0.24,
    });
    const dPane = new THREE.Mesh(prepFrostGeo(new THREE.PlaneGeometry(leafW - 0.18, cfg.eavesY - 0.98)), archGlassMat);
    dPane.position.set(leafCenterX, 1.92, 0);
    dPane.castShadow = false;
    dPane.receiveShadow = false;
    dPane.renderOrder = 2;
    dPane.raycast = () => {};
    leafPivot.add(dPane);
  }

  // 3. L-SHAPED INTERSECTING CURVED BARREL-VAULT GLASS ROOF + CRESTING & TURNED FINIALS
  const vaultY = (u: number) => {
    const clamped = Math.max(0, Math.min(1, u));
    return cfg.floorY + cfg.eavesY + (cfg.ridgeY - cfg.eavesY) * Math.sqrt(Math.max(0, 1 - clamped * clamped));
  };

  const roofGlassPos: number[] = [];
  const pushRoofQuad = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    d: [number, number, number],
  ) => {
    roofGlassPos.push(
      a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2],
      a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2],
    );
  };

  const SEGS = 10;
  for (let s = 0; s < SEGS; s++) {
    const u0 = s / SEGS;
    const u1 = (s + 1) / SEGS;
    const y0 = vaultY(u0);
    const y1 = vaultY(u1);

    // Main Hall — Courtyard slope
    const zC0 = RIDGE_Z + dir * u0 * halfMainD;
    const zC1 = RIDGE_Z + dir * u1 * halfMainD;
    const xC0 = inwardX(u0);
    const xC1 = inwardX(u1);
    pushRoofQuad([xC0, y0, zC0], [xOpposite, y0, zC0], [xOpposite, y1, zC1], [xC1, y1, zC1]);

    // Main Hall — Outer Back slope
    const zB0 = RIDGE_Z - dir * u0 * halfMainD;
    const zB1 = RIDGE_Z - dir * u1 * halfMainD;
    const xB0 = outerX(u0);
    const xB1 = outerX(u1);
    pushRoofQuad([xOpposite, y0, zB0], [xB0, y0, zB0], [xB1, y1, zB1], [xOpposite, y1, zB1]);

    // Projecting L-Wing — Inner Courtyard-facing slope
    const xE0 = inwardX(u0);
    const xE1 = inwardX(u1);
    const zE0 = RIDGE_Z + dir * u0 * halfMainD;
    const zE1 = RIDGE_Z + dir * u1 * halfMainD;
    pushRoofQuad([xE0, y0, cfg.zWingTip], [xE0, y0, zE0], [xE1, y1, zE1], [xE1, y1, cfg.zWingTip]);

    // Projecting L-Wing — Outer Long-Wall slope
    const xW0 = outerX(u0);
    const xW1 = outerX(u1);
    const zW0 = RIDGE_Z - dir * u0 * halfMainD;
    const zW1 = RIDGE_Z - dir * u1 * halfMainD;
    pushRoofQuad([xW0, y0, zW0], [xW0, y0, cfg.zWingTip], [xW1, y1, cfg.zWingTip], [xW1, y1, zW1]);
  }

  const roofGlassGeo = new THREE.BufferGeometry();
  roofGlassGeo.setAttribute('position', new THREE.Float32BufferAttribute(roofGlassPos, 3));
  roofGlassGeo.computeVertexNormals();
  const roofGlassMesh = new THREE.Mesh(prepFrostGeo(roofGlassGeo), archGlassMat);
  roofGlassMesh.castShadow = false;
  roofGlassMesh.receiveShadow = false;
  roofGlassMesh.renderOrder = 2;
  roofGlassMesh.raycast = () => {};
  parent.add(roofGlassMesh);

  // Curved Glazed Barrel-Vault Gable End Caps
  const addBarrelGableEnd = (isWingGable: boolean) => {
    const pts: THREE.Vector2[] = [];
    const halfSpan = isWingGable ? halfWingW : halfMainD;
    for (let s = 0; s <= 18; s++) {
      const t = (s / 18) * 2 - 1;
      pts.push(new THREE.Vector2(t * halfSpan, vaultY(Math.abs(t)) - (cfg.floorY + cfg.eavesY)));
    }
    const gShape = new THREE.Shape(pts);
    gShape.closePath();
    const gablePane = new THREE.Mesh(prepFrostGeo(new THREE.ShapeGeometry(gShape)), archGlassMat);
    gablePane.castShadow = false;
    gablePane.receiveShadow = false;
    gablePane.renderOrder = 2;
    if (isWingGable) {
      gablePane.position.set(RIDGE_X, cfg.floorY + cfg.eavesY, cfg.zWingTip);
    } else {
      gablePane.position.set(xOpposite, cfg.floorY + cfg.eavesY, RIDGE_Z);
      gablePane.rotation.y = Math.PI / 2;
    }
    gablePane.raycast = () => {};
    parent.add(gablePane);

    const arcPts: THREE.Vector3[] = [];
    for (let s = 0; s <= 18; s++) {
      const t = (s / 18) * 2 - 1;
      const y = vaultY(Math.abs(t));
      if (isWingGable) {
        arcPts.push(new THREE.Vector3(RIDGE_X + t * halfWingW, y, cfg.zWingTip));
      } else {
        arcPts.push(new THREE.Vector3(xOpposite, y, RIDGE_Z + t * halfMainD));
      }
    }
    addPart(parent, styler, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arcPts), 20, 0.062, 8, false), COL_BRONZE_DARK, [0, 0, 0], [0, 0, 0], 0.005);
    for (const frac of [-0.5, 0, 0.5]) {
      const h = vaultY(Math.abs(frac)) - (cfg.floorY + cfg.eavesY);
      if (isWingGable) {
        addPart(parent, styler, makeRoundedBoxGeo(0.06, h, 0.08, 0.012, 2), COL_BRONZE, [RIDGE_X + frac * halfWingW, cfg.floorY + cfg.eavesY + h * 0.5, cfg.zWingTip], [0, 0, 0], 0.004);
      } else {
        addPart(parent, styler, makeRoundedBoxGeo(0.08, h, 0.06, 0.012, 2), COL_BRONZE, [xOpposite, cfg.floorY + cfg.eavesY + h * 0.5, RIDGE_Z + frac * halfMainD], [0, 0, 0], 0.004);
      }
    }
  };
  addBarrelGableEnd(true);
  addBarrelGableEnd(false);

  const addVaultArchRib = (points: THREE.Vector3[], rad = 0.048) => {
    addPart(parent, styler, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 16, rad, 8, false), COL_BRONZE, [0, 0, 0], [0, 0, 0], 0.004, {
      metalness: 0.25,
    });
  };

  // Main Hall transverse arch ribs along X (from Wing junction xJunction to xOpposite)
  const mainRibCount = Math.max(3, Math.round(Math.abs(xOpposite - xJunction) / 2.6));
  for (let i = 0; i < mainRibCount; i++) {
    const rx = xJunction + (i / mainRibCount) * (xOpposite - xJunction);
    const cPts: THREE.Vector3[] = [];
    const bPts: THREE.Vector3[] = [];
    for (let s = 0; s <= 10; s++) {
      const u = s / 10;
      cPts.push(new THREE.Vector3(rx, vaultY(u), RIDGE_Z + dir * u * halfMainD));
      bPts.push(new THREE.Vector3(rx, vaultY(u), RIDGE_Z - dir * u * halfMainD));
    }
    addVaultArchRib(cPts);
    addVaultArchRib(bPts);
  }
  // Projecting L-Wing transverse arch ribs along Z
  const wingRibCount = Math.max(2, Math.round(wingD / 2.3));
  for (let i = 1; i <= wingRibCount; i++) {
    const rz = cfg.zWingTip + (cfg.zRecessed - cfg.zWingTip) * (i / wingRibCount);
    const ePts: THREE.Vector3[] = [];
    const wPts: THREE.Vector3[] = [];
    for (let s = 0; s <= 10; s++) {
      const u = s / 10;
      ePts.push(new THREE.Vector3(inwardX(u), vaultY(u), rz));
      wPts.push(new THREE.Vector3(outerX(u), vaultY(u), rz));
    }
    addVaultArchRib(ePts);
    addVaultArchRib(wPts);
  }

  // Mitered Hip & Valley Curved Rafters at exact L-junction
  const hipPts: THREE.Vector3[] = [];
  const valleyPts: THREE.Vector3[] = [];
  for (let s = 0; s <= 10; s++) {
    const u = s / 10;
    hipPts.push(new THREE.Vector3(outerX(u), vaultY(u), RIDGE_Z - dir * u * halfMainD));
    valleyPts.push(new THREE.Vector3(inwardX(u), vaultY(u), RIDGE_Z + dir * u * halfMainD));
  }
  addVaultArchRib(hipPts, 0.060);
  addVaultArchRib(valleyPts, 0.060);

  // Horizontal Mid-Vault Purlins following the L-contour at u = 0.55
  const midU = 0.55;
  const midY = vaultY(midU);
  const addPurlin = (x1: number, z1: number, x2: number, z2: number) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    if (len < 0.05) return;
    addPart(
      parent,
      styler,
      makeRoundedBoxGeo(len, 0.06, 0.06, 0.012, 2),
      COL_BRONZE_LIGHT,
      [(x1 + x2) * 0.5, midY, (z1 + z2) * 0.5],
      [0, -Math.atan2(z2 - z1, x2 - x1), 0],
      0.004,
    );
  };
  addPurlin(inwardX(midU), RIDGE_Z + dir * midU * halfMainD, xOpposite, RIDGE_Z + dir * midU * halfMainD);
  addPurlin(outerX(midU), RIDGE_Z - dir * midU * halfMainD, xOpposite, RIDGE_Z - dir * midU * halfMainD);
  addPurlin(inwardX(midU), cfg.zWingTip, inwardX(midU), RIDGE_Z + dir * midU * halfMainD);
  addPurlin(outerX(midU), cfg.zWingTip, outerX(midU), RIDGE_Z - dir * midU * halfMainD);

  // Continuous Rounded Ridge Beams + Cresting Spikes + Lathe Spire Finials
  const ewRidgeLen = Math.abs(xOpposite - RIDGE_X);
  const nsRidgeLen = Math.abs(RIDGE_Z - cfg.zWingTip);
  const ridgeBeamY = cfg.floorY + cfg.ridgeY + 0.04;
  addPart(parent, styler, makeRoundedBoxGeo(ewRidgeLen, 0.14, 0.14, 0.025, 2), COL_BRONZE_DARK, [(RIDGE_X + xOpposite) * 0.5, ridgeBeamY, RIDGE_Z], [0, 0, 0], 0.005);
  addPart(parent, styler, makeRoundedBoxGeo(0.14, 0.14, nsRidgeLen, 0.025, 2), COL_BRONZE_DARK, [RIDGE_X, ridgeBeamY, (cfg.zWingTip + RIDGE_Z) * 0.5], [0, 0, 0], 0.005);

  const spikeGeo = makeTurnedLatheGeo([[0, 0], [0.055, 0], [0.022, 0.09], [0.042, 0.14], [0, 0.24]], 8);
  const xMinR = Math.min(RIDGE_X, xOpposite);
  const xMaxR = Math.max(RIDGE_X, xOpposite);
  for (let cx = xMinR + 0.35; cx <= xMaxR - 0.35; cx += 0.48) {
    addPart(parent, styler, spikeGeo, COL_BRONZE_DARK, [cx, cfg.floorY + cfg.ridgeY + 0.10, RIDGE_Z], [0, 0, 0], 0.003);
  }
  const zMinR = Math.min(cfg.zWingTip, RIDGE_Z);
  const zMaxR = Math.max(cfg.zWingTip, RIDGE_Z);
  for (let cz = zMinR + 0.35; cz <= zMaxR - 0.35; cz += 0.48) {
    addPart(parent, styler, spikeGeo, COL_BRONZE_DARK, [RIDGE_X, cfg.floorY + cfg.ridgeY + 0.10, cz], [0, Math.PI / 2, 0], 0.003);
  }

  // Turned Spire Finials at Ridge Junction & Gable Ends
  const finialGeo = makeTurnedLatheGeo([
    [0, 0],
    [0.085, 0],
    [0.055, 0.22],
    [0.095, 0.32],
    [0.048, 0.42],
    [0.058, 0.48],
    [0, 0.82],
  ], 14);
  for (const [fx, fz] of [
    [RIDGE_X, RIDGE_Z],
    [xOpposite, RIDGE_Z],
    [RIDGE_X, cfg.zWingTip],
  ]) {
    addPart(parent, styler, finialGeo, COL_BRONZE_DARK, [fx, cfg.floorY + cfg.ridgeY + 0.08, fz], [0, 0, 0], 0.005);
  }
}

// ---------------------------------------------------------------------------
// GRAND SOUTH PLAZA L-SHAPED BOTANICAL GLASSHOUSE CAFE (Exterior on South Plaza)
// ---------------------------------------------------------------------------

/**
 * 1:1 Industrial Wall-Mounted Work Shift Board (`180cm × 100cm × 10cm` model sheet):
 * - Satin off-white powder-coated steel low-profile casing (`1.80m W × 1.00m H × 0.10m D`)
 * - 45° angled LED illumination hood visor across top edge
 * - Station Operations header, Digital LED Clock (`08:00:00`), `ACTIVE SHIFT` status badge,
 *   Magnetic Roster Grid, 9-peg Brass Key Tag Rack, 2 Magnetic Clip Holders, Clear Acrylic
 *   Document Pocket, Wall-Mounting Anchor Bolts & Lower Cable Conduits.
 */
export function buildWallMountedWorkShiftBoard(
  styler: CafeAssetStyler,
  scale = 1.0,
): THREE.Group {
  const g = new THREE.Group();
  const W = 1.80;
  const H = 1.00;
  const D = 0.10;
  const { metal } = getSharedTextures(styler);
  const useTex = styler.preserveTextures !== false && typeof document !== 'undefined';
  const boardTex = useTex ? createWorkShiftBoardFaceTexture() : null;

  // 1. Satin off-white powder-coated steel main chassis (centered on X, bottom at y = 0, back at z = -D/2)
  addPart(g, styler, makeRoundedBoxGeo(W, H, D, 0.016, 3), '#e7ecef', [0, H * 0.5, 0], [0, 0, 0], 0.005, {
    tex: metal,
    tintTex: true,
    metalness: 0.28,
    roughness: 0.34,
    clearcoat: 0.30,
  });

  // Dark charcoal inner bezel frame around recessed magnetic roster bay
  const bezelThick = 0.026;
  addPart(g, styler, makeRoundedBoxGeo(W - 0.036, bezelThick, 0.022, 0.004, 2), '#2b313a', [0, H - 0.03, D * 0.5 + 0.004], [0, 0, 0], 0.003);
  addPart(g, styler, makeRoundedBoxGeo(W - 0.036, bezelThick, 0.022, 0.004, 2), '#2b313a', [0, 0.03, D * 0.5 + 0.004], [0, 0, 0], 0.003);
  addPart(g, styler, makeRoundedBoxGeo(bezelThick, H - 0.04, 0.022, 0.004, 2), '#2b313a', [-W * 0.5 + 0.03, H * 0.5, D * 0.5 + 0.004], [0, 0, 0], 0.003);
  addPart(g, styler, makeRoundedBoxGeo(bezelThick, H - 0.04, 0.022, 0.004, 2), '#2b313a', [W * 0.5 - 0.03, H * 0.5, D * 0.5 + 0.004], [0, 0, 0], 0.003);

  // 2. Printed Magnetic Roster & Station Operations Faceplate
  const faceMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.08, H - 0.08),
    new THREE.MeshStandardMaterial({
      color: boardTex ? '#ffffff' : '#e2e8f0',
      map: boardTex,
      roughness: 0.36,
      metalness: 0.08,
      fog: false,
    }),
  );
  faceMesh.position.set(0, H * 0.5, D * 0.5 + 0.006);
  faceMesh.raycast = () => {};
  g.add(faceMesh);

  // 3. 45° Top LED Illumination Hood Visor + Warm-Cyan LED Light Diffuser Strip
  addPart(
    g,
    styler,
    makeRoundedBoxGeo(W + 0.02, 0.026, 0.115, 0.006, 2),
    '#eef2f6',
    [0, H + 0.006, D * 0.5 + 0.038],
    [0.24, 0, 0],
    0.004,
    { tex: metal, tintTex: true, metalness: 0.34, roughness: 0.28, clearcoat: 0.35 },
  );
  // Angled side gusset cheeks for 45° hood visor
  for (const sx of [-W * 0.5, W * 0.5]) {
    addPart(
      g,
      styler,
      makeRoundedBoxGeo(0.014, 0.075, 0.095, 0.003, 2),
      '#dce3ea',
      [sx, H - 0.024, D * 0.5 + 0.032],
      [0, 0, 0],
      0.003,
      { metalness: 0.32, roughness: 0.32 },
    );
  }
  addPart(
    g,
    styler,
    new THREE.BoxGeometry(W - 0.08, 0.010, 0.026),
    '#e0f2fe',
    [0, H - 0.008, D * 0.5 + 0.048],
    [0, 0, 0],
    0,
    { emissiveHex: '#7dd3fc', emissiveIntensity: 0.72, roughness: 0.15 },
  );

  // 4. 3D Relief Accessories on Right Bay (x in [+0.42 .. +0.80]):
  // 4A. Key Peg Rack with 2 Interlocking Rails & Brass Key Tags (5 top + 4 second row)
  for (const ry of [0.69, 0.58]) {
    addPart(g, styler, new THREE.BoxGeometry(0.36, 0.014, 0.014), '#cbd5e1', [0.61, ry, D * 0.5 + 0.012], [0, 0, 0], 0.002, {
      metalness: 0.55,
      roughness: 0.28,
    });
  }
  const tagGeo = makeRoundedBoxGeo(0.034, 0.056, 0.010, 0.008, 2);
  const pegGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.018, 8);
  for (let i = 0; i < 5; i++) {
    const kx = 0.47 + i * 0.068;
    addPart(g, styler, pegGeo, '#94a3b8', [kx, 0.69, D * 0.5 + 0.018], [Math.PI / 2, 0, 0], 0);
    if (i !== 3) {
      addPart(g, styler, tagGeo, '#caa252', [kx, 0.648, D * 0.5 + 0.018], [0, 0, 0], 0.002, {
        metalness: 0.66,
        roughness: 0.28,
      });
    }
  }
  for (let i = 0; i < 4; i++) {
    const kx = 0.47 + i * 0.068;
    addPart(g, styler, pegGeo, '#94a3b8', [kx, 0.58, D * 0.5 + 0.018], [Math.PI / 2, 0, 0], 0);
    addPart(g, styler, tagGeo, '#c49a47', [kx, 0.538, D * 0.5 + 0.018], [0, 0, 0], 0.002, {
      metalness: 0.66,
      roughness: 0.28,
    });
  }

  // 4B. Twin Magnetic Clip Holders (`x = 0.52` & `x = 0.70`, `y = 0.40`)
  for (const cx of [0.52, 0.70]) {
    addPart(g, styler, makeRoundedBoxGeo(0.11, 0.11, 0.016, 0.006, 2), '#475569', [cx, 0.395, D * 0.5 + 0.014], [0, 0, 0], 0.003, {
      metalness: 0.48,
      roughness: 0.34,
    });
    addPart(g, styler, makeRoundedBoxGeo(0.058, 0.028, 0.022, 0.004, 2), '#94a3b8', [cx, 0.442, D * 0.5 + 0.020], [0, 0, 0], 0.002, {
      metalness: 0.68,
      roughness: 0.24,
    });
  }

  // 4C. Clear Acrylic Document Pocket (`x = 0.61, y = 0.185`) + White Shift Sheet Insert
  addPart(g, styler, new THREE.BoxGeometry(0.28, 0.19, 0.008), '#f8fafc', [0.61, 0.19, D * 0.5 + 0.011], [0, 0, 0], 0.002, {
    roughness: 0.65,
  });
  const acrylicPocket = new THREE.Mesh(
    makeRoundedBoxGeo(0.32, 0.22, 0.026, 0.006, 2),
    styler.clearGlassMat,
  );
  acrylicPocket.position.set(0.61, 0.185, D * 0.5 + 0.022);
  acrylicPocket.raycast = () => {};
  g.add(acrylicPocket);

  // 5. Side Wall-Mounting Anchor Bolts & Lower Cable Conduit Entry Tubes (1:1 Detail Section)
  for (const sx of [-W * 0.5 + 0.06, W * 0.5 - 0.06]) {
    for (const by of [0.22, 0.78]) {
      addPart(g, styler, new THREE.CylinderGeometry(0.012, 0.012, 0.06, 10), '#94a3b8', [sx, by, -D * 0.5 - 0.025], [Math.PI / 2, 0, 0], 0.002, {
        metalness: 0.7,
      });
    }
  }
  for (const cx of [0.54, 0.66]) {
    addPart(g, styler, new THREE.CylinderGeometry(0.016, 0.016, 0.09, 10), '#64748b', [cx, -0.04, -0.01], [0, 0, 0], 0.002, {
      metalness: 0.62,
      roughness: 0.32,
    });
  }

  g.scale.setScalar(scale);
  return g;
}

/**
 * Seamless Wooden Base Cabinet + Full-Height Rear Backing Wall + 1:1 Wall-Mounted Work Shift Board.
 * Joins 100% flush to the right end of `buildCompleteEspressoBarAssembly` with zero side gap
 * and extends all the way back to the conservatory rear wall with zero rear gap.
 */
export function buildJoinedShiftBoardCounterWing(
  styler: CafeAssetStyler,
  marbleTex: THREE.Texture | null,
  scaleOrExtraTex: number | THREE.Texture | null = 1.0,
  maybeScale?: number,
): THREE.Group {
  const scale = typeof scaleOrExtraTex === 'number' ? scaleOrExtraTex : (maybeScale ?? 1.0);
  const g = new THREE.Group();
  const { oak, metal } = getSharedTextures(styler);

  // Local origin: x = 0 sits at the exact right face of the bartender back credenza (`x = +2.60` in bar local space).
  // Overlap `-0.03m` into the bartender credenza so there is 0.00m side seam, and span `W = 2.08m` to the right!
  // Depth spans from front face `z = +0.49` (matching bartender back credenza front face `-0.95 + 0.36 = -0.59`) all the way back to `z = -0.52` (flush against conservatory rear wall, 0.00m rear gap!).
  const W = 2.08;
  const cx = W * 0.5 - 0.02;
  const D = 1.02;
  const cz = -0.02;

  // 1. Warm Oak Lower Credenza Box Cabinet (same 0.92m height & warm oak finish as bartender back bar)
  addPart(g, styler, makeRoundedBoxGeo(W, 0.92, D, 0.022, 3), '#a8703c', [cx, 0.46, cz], [0, 0, 0], 0.005, {
    tex: oak,
    tintTex: true,
    roughness: 0.56,
  });

  // Twin recessed stainless/oak service doors on front face (`z = +0.495`) matching bartender back bar
  for (const dx of [cx - 0.48, cx + 0.48]) {
    addPart(g, styler, makeRoundedBoxGeo(0.82, 0.74, 0.036, 0.014, 2), '#8f5c2e', [dx, 0.46, cz + D * 0.5 + 0.006], [0, 0, 0], 0.003, {
      tex: oak,
      tintTex: true,
      roughness: 0.52,
      clearcoat: 0.18,
    });
    addPart(g, styler, new THREE.CylinderGeometry(0.009, 0.009, 0.18, 10), '#cbd5e1', [dx + (dx < cx ? 0.30 : -0.30), 0.52, cz + D * 0.5 + 0.032], [0, 0, 0], 0.002, {
      tex: metal,
      metalness: 0.68,
      roughness: 0.24,
    });
  }

  // 2. Continuous Bullnose White Carrara Marble Countertop (`y = 0.965m`, seamlessly joining bartender marble slab!)
  addPart(g, styler, makeRoundedBoxGeo(W + 0.08, 0.09, D + 0.08, 0.024, 3), '#f5f2eb', [cx + 0.02, 0.965, cz], [0, 0, 0], 0.005, {
    tex: marbleTex,
    roughness: 0.26,
    clearcoat: 0.62,
  });

  // 3. Full-Depth Warm Walnut Rear Mounting Wall Panel (`y = 0.96..2.42m`, flush to rear conservatory wall so board anchor bolts mount into solid wood with zero gap behind!)
  addPart(g, styler, makeRoundedBoxGeo(W, 1.48, 0.44, 0.020, 3), '#7c4e29', [cx, 1.70, cz - D * 0.5 + 0.22], [0, 0, 0], 0.005, {
    tex: oak,
    tintTex: true,
    roughness: 0.54,
    clearcoat: 0.16,
  });

  // 4. 1:1 Industrial Wall-Mounted Work Shift Board (`1.80m × 1.00m × 0.10m`) mounted cleanly above the marble countertop
  const board = buildWallMountedWorkShiftBoard(styler, 1.0);
  board.position.set(cx + 0.02, 1.10, cz - D * 0.5 + 0.49);
  g.add(board);

  g.scale.setScalar(scale);
  return g;
}

export function buildSouthPlazaLShapedGlasshouseCafe(styler: CafeAssetStyler): THREE.Group {
  const root = new THREE.Group();
  root.name = 'LobbyLShapedBotanicalGlasshouseCafe';
  root.position.set(0, 2.50, 0);

  const useTex = styler.preserveTextures !== false && typeof document !== 'undefined';
  const herringboneTex = useTex ? createHerringboneParquetTexture(1.35, 1.35) : null;
  const flutedTex = useTex ? createFlutedOakTexture(1.5, 1) : null;
  const marbleTex = useTex ? createCarraraMarbleTexture() : null;
  const rattanTex = useTex ? createRattanCaneTexture() : null;
  const menuTex = useTex ? createChalkboardMenuTexture() : null;

  const DOOR_X = 2.20;
  buildLShapedGlasshouseArchitecture(root, styler, {
    xWest: -12.80,
    xWingEast: -2.40,
    xEast: 12.80,
    zBack: 36.80,
    zRecessed: 23.20,
    zWingTip: 14.00,
    wingDir: -1,
    doorX: DOOR_X,
    doorHalfW: CAFE_GLOBAL_SCALE_SPEC.exteriorDoorHalfW,
    eavesY: CAFE_GLOBAL_SCALE_SPEC.exteriorEavesY,
    ridgeY: CAFE_GLOBAL_SCALE_SPEC.exteriorRidgeY,
    kneeH: 0.98,
    baysBack: 8,
    baysEast: 4,
    baysWest: 7,
    baysWingTip: 3,
    baysWingInner: 3,
    baysCourtyardLeft: 1,
    baysCourtyardRight: 3,
    floorY: 0,
    openDoorsOutward: true,
    includeStoneApronAndPorch: true,
    parquetTex: herringboneTex,
  });

  // 4. RATIONAL GLOBAL PLAYER-SCALE INTERIOR COFFEE SHOP ASSETS (Calibrated to 3.312m Buddy Player & Outdoor Plaza Tables, Zero Static Dummy NPCs!)
  const barGroup = buildCompleteEspressoBarAssembly(
    styler,
    flutedTex,
    marbleTex,
    menuTex,
    CAFE_GLOBAL_SCALE_SPEC.exteriorEspressoBarScale,
  );
  barGroup.position.set(3.20, 0.06, 33.45);
  barGroup.rotation.y = Math.PI;
  root.add(barGroup);

  // Seamless Joined Wooden Cabinet + 1:1 Wall-Mounted Work Shift Board flush to the bartender bar
  const exteriorShiftWing = buildJoinedShiftBoardCounterWing(
    styler,
    marbleTex,
    CAFE_GLOBAL_SCALE_SPEC.exteriorEspressoBarScale,
  );
  exteriorShiftWing.position.set(
    3.20 - 2.60 * CAFE_GLOBAL_SCALE_SPEC.exteriorEspressoBarScale,
    0.06,
    33.45 + 1.12 * CAFE_GLOBAL_SCALE_SPEC.exteriorEspressoBarScale,
  );
  exteriorShiftWing.rotation.y = Math.PI;
  root.add(exteriorShiftWing);

  // Matching 1:1 Industrial Bank Cash ATM inside South Plaza Glasshouse Cafe (flush to rear wall, +0 extra static draw calls)
  const exteriorAtm = buildStandardBankCashAtm(styler, CAFE_GLOBAL_SCALE_SPEC.exteriorAtmScale);
  exteriorAtm.position.set(8.85, 0.06, 36.22);
  exteriorAtm.rotation.y = Math.PI;
  root.add(exteriorAtm);

  // Matching 1:1 Standalone Arcade Cabinet Machine flush against West (+X interior equivalent) conservatory wall
  const exteriorArcade = buildStandaloneArcadeCabinet(styler, CAFE_GLOBAL_SCALE_SPEC.exteriorAtmScale);
  exteriorArcade.position.set(-12.22, 0.06, 24.50);
  exteriorArcade.rotation.y = Math.PI / 2;
  root.add(exteriorArcade);

  const addBanquetteLoungeSet = (bx: number, bz: number, rotY: number, twoFacingChairs = true) => {
    const bSet = new THREE.Group();
    bSet.position.set(bx, 0.06, bz);
    bSet.rotation.y = rotY;
    root.add(bSet);

    const sofa = buildTuftedLeatherBanquette(styler, 2.35, CAFE_GLOBAL_SCALE_SPEC.exteriorBanquetteScale);
    sofa.position.set(0, 0, -0.76);
    bSet.add(sofa);

    const tbl = buildRoundOakBistroTable(styler, CAFE_GLOBAL_SCALE_SPEC.exteriorTableScale, true);
    tbl.position.set(0, 0, 0.78);
    bSet.add(tbl);

    if (twoFacingChairs) {
      for (const side of [-1, 1]) {
        const ch = buildBentwoodRattanChair(styler, rattanTex, CAFE_GLOBAL_SCALE_SPEC.exteriorChairScale);
        ch.position.set(side * 1.02, 0, 1.98);
        ch.rotation.y = Math.PI + side * 0.34;
        bSet.add(ch);
      }
    } else {
      const ch = buildBentwoodRattanChair(styler, rattanTex, CAFE_GLOBAL_SCALE_SPEC.exteriorChairScale);
      ch.position.set(0, 0, 2.10);
      ch.rotation.y = Math.PI;
      bSet.add(ch);
    }
  };
  // East Wall Banquette Lounge & Projecting West L-Wing Banquette Lounge
  addBanquetteLoungeSet(11.30, 30.85, -Math.PI / 2, false);
  addBanquetteLoungeSet(-11.30, 24.60, Math.PI / 2, true);

  const addBistroPairSet = (tx: number, tz: number, ang = 0) => {
    const pSet = new THREE.Group();
    pSet.position.set(tx, 0.06, tz);
    pSet.rotation.y = ang;
    root.add(pSet);
    pSet.add(buildRoundOakBistroTable(styler, CAFE_GLOBAL_SCALE_SPEC.exteriorTableScale, true));
    const cL = buildBentwoodRattanChair(styler, rattanTex, CAFE_GLOBAL_SCALE_SPEC.exteriorChairScale);
    cL.position.set(-1.38, 0, 0);
    cL.rotation.y = Math.PI / 2;
    pSet.add(cL);
    const cR = buildBentwoodRattanChair(styler, rattanTex, CAFE_GLOBAL_SCALE_SPEC.exteriorChairScale);
    cR.position.set(1.38, 0, 0);
    cR.rotation.y = -Math.PI / 2;
    pSet.add(cR);
  };
  // Spacious Global-Scale Bistro Pair Sets matching Outdoor Plaza Table & Chair proportions 1:1
  addBistroPairSet(-1.15, 26.25, 0.18);
  addBistroPairSet(6.45, 26.25, -0.18);
  addBistroPairSet(-6.35, 18.10, 0.12);
  addBistroPairSet(-6.20, 31.40, -0.22);

  const plantPlacements: Array<{ x: number; z: number; scale: number; variant: 'monstera' | 'fiddle' }> = [
    // Flanking entrance planters outside front double doors (proportional to 3.312m player!)
    { x: 0.05, z: 21.95, scale: 1.76, variant: 'monstera' },
    { x: 4.35, z: 21.95, scale: 1.74, variant: 'fiddle' },
    // Interior conservatory corner specimen planters
    { x: -11.45, z: 15.35, scale: CAFE_GLOBAL_SCALE_SPEC.exteriorPlantScale, variant: 'monstera' },
    { x: -3.75, z: 15.35, scale: 1.80, variant: 'fiddle' },
    { x: -11.45, z: 35.25, scale: 1.90, variant: 'monstera' },
    { x: 11.45, z: 35.25, scale: CAFE_GLOBAL_SCALE_SPEC.exteriorPlantScale, variant: 'monstera' },
    { x: 11.45, z: 24.75, scale: 1.80, variant: 'fiddle' },
    { x: -2.45, z: 34.85, scale: 1.82, variant: 'fiddle' },
  ];
  for (const pp of plantPlacements) {
    const pot = buildPottedMonsteraOnStand(styler, pp.scale, pp.variant);
    pot.position.set(pp.x, 0.06, pp.z);
    root.add(pot);
  }

  const hangingFernSpots: [number, number, number][] = [
    [7.4, 4.32, 25.0],
    [10.2, 4.42, 30.2],
    [-4.8, 4.32, 16.0],
    [-9.8, 4.32, 16.0],
    [-4.6, 4.42, 21.8],
    [-0.6, 4.32, 24.8],
  ];
  for (const [fx, fy, fz] of hangingFernSpots) {
    const fern = buildHangingMacrameFern(styler, 0.86, 1.65);
    fern.position.set(fx, fy, fz);
    root.add(fern);
  }

  const wisteriaSpots: [number, number, number, number][] = [
    [-1.4, 4.48, 24.1, 0.96],
    [0.1, 4.50, 24.2, 1.02],
    [4.4, 4.50, 24.2, 0.98],
    [7.2, 4.48, 24.1, 1.05],
    [10.2, 4.48, 24.1, 0.96],
    [11.4, 4.55, 26.8, 1.02],
    [11.4, 4.55, 31.8, 1.06],
    [0.8, 5.85, 32.8, 1.15],
    [4.2, 5.85, 32.8, 1.12],
    [-4.2, 4.58, 15.2, 1.04],
    [-7.6, 5.95, 15.8, 1.16],
    [-11.0, 4.58, 15.2, 1.02],
    [-3.5, 4.55, 18.8, 1.00],
    [-3.5, 4.55, 22.0, 0.98],
    [-11.4, 4.55, 19.4, 1.04],
    [-11.4, 4.55, 29.8, 1.05],
    [-7.6, 6.05, 26.5, 1.18],
  ];
  wisteriaSpots.forEach(([wx, wy, wz, drop], idx) => {
    const w = buildWisteriaCluster(styler, drop, 1.65);
    w.position.set(wx, wy, wz);
    w.rotation.y = idx * 0.7;
    root.add(w);
  });

  return root;
}
