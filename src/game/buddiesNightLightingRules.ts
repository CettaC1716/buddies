import * as THREE from 'three';
import { shouldRefreshNightLightingFrame } from './buddiesPerfOptimizations';

export type CityWindowKind =
  | 'upper_floor'
  | 'storefront'
  | 'civic'
  | 'dormer'
  | 'conservatory';

export type CityWindowGlowRoomState = 'on' | 'dim' | 'warm-amber' | 'off';

export interface CityWindowSpec {
  id: string;
  kind: CityWindowKind;
  seed: number;
  baseColorHex?: string;
  baseEmissiveHex?: string;
  baseEmissiveIntensity?: number;
  baseOpacity?: number;
  intensityScale?: number;
}

export interface StaggeredNightWindowGlowEval {
  roomState: CityWindowGlowRoomState;
  profileState: CityWindowGlowRoomState;
  isLit: boolean;
  emissiveHex: string;
  emissiveIntensity: number;
  tintHex: string;
  duskActivation01: number;
  shimmerFactor: number;
}

export interface StorefrontNightIlluminationEval {
  isNightActive: boolean;
  emissiveHex: string;
  emissiveIntensity: number;
  glassOpacity: number;
  interiorFixtureScale: number;
  tintHex: string;
}

const DAYTIME_CUTOFF_NIGHT_FACTOR = 0.05;

const BRIGHT_WARM_COLORS = ['#ffe4b0', '#ffd994', '#fff0c8', '#ffdf9e'] as const;
const WARM_AMBER_COLORS = ['#ffb34d', '#ffa136', '#ffc266', '#ff9b30'] as const;
const DIM_WARM_COLORS = ['#eec07a', '#e6b268', '#ffd28e', '#ddb170'] as const;
const DAY_GLASS_COLORS = ['#b8def7', '#c4e4fa', '#a9d5f2', '#d0ebfc'] as const;
const OFF_NIGHT_GLASS_COLOR = '#2e435e';

const STOREFRONT_DAY_TINT_HEX = '#d6f4ff';
const STOREFRONT_NIGHT_TINT_HEX = '#fff1d9';
const STOREFRONT_NIGHT_RIM_HEX = '#ffe3b3';
const CONSERVATORY_NIGHT_WARM_HEX = '#ffdba0';

const WINDOW_NAME_REGEX =
  /(?:^|[^a-z])(window|pane|glass|skylight|dormer|fanlight|transom|shoji|storefront|glazing)(?:[^a-z]|$)/i;
const EXCLUDED_NAME_REGEX =
  /(_Outline|glasses|eyeglasses|hourglass|sunglass|glassTable|wineglass|cocktail|pitcher|carafe|coaster|jar|bottle|mug|cup)/i;

const SCRATCH_COLOR_A = new THREE.Color();
const SCRATCH_COLOR_B = new THREE.Color();
const SCRATCH_EVAL: StaggeredNightWindowGlowEval = {
  roomState: 'off',
  profileState: 'off',
  isLit: false,
  emissiveHex: '#000000',
  emissiveIntensity: 0,
  tintHex: DAY_GLASS_COLORS[0],
  duskActivation01: 0,
  shimmerFactor: 1,
};
const SCRATCH_STOREFRONT_EVAL: StorefrontNightIlluminationEval = {
  isNightActive: false,
  emissiveHex: '#000000',
  emissiveIntensity: 0,
  glassOpacity: 0.34,
  interiorFixtureScale: 0.45,
  tintHex: STOREFRONT_DAY_TINT_HEX,
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function mixSeed32(seed: number): number {
  let x = seed | 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

function seedToUnit01(seed: number, salt = 0): number {
  const mixed = mixSeed32((seed | 0) ^ Math.imul((salt | 0) + 1, 0x9e3779b9));
  return mixed / 4294967296;
}

/**
 * Computes a stable non-negative 32-bit seed from a window identifier and optional grid indices.
 */
export function computeDeterministicWindowSeed(
  windowId: string,
  row = 0,
  col = 0,
): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < windowId.length; i++) {
    hash ^= windowId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= Math.imul((row | 0) + 0x27d4eb2d, 0x165667b1);
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= Math.imul((col | 0) + 0x1b873593, 0xcc9e2d51);
  return mixSeed32(hash);
}

/**
 * Deterministic animation phase offset [0, 2*PI) for building glow manifest entries.
 */
export function computeManifestWindowPhaseOffset(windowId: string, row = 0, col = 0): number {
  const seed = computeDeterministicWindowSeed(windowId, row, col);
  const raw = seedToUnit01(seed, 17) * Math.PI * 2;
  return Math.round(raw * 1000) / 1000;
}

/**
 * Deterministic intensity multiplier around `baseScale` so adjacent panes avoid flat uniformity.
 */
export function computeManifestWindowIntensityScale(
  windowId: string,
  baseScale = 1.0,
  row = 0,
  col = 0,
): number {
  const seed = computeDeterministicWindowSeed(windowId, row, col);
  const factor = 0.84 + seedToUnit01(seed, 29) * 0.28;
  return Math.round(baseScale * factor * 1000) / 1000;
}

function resolveRoomProfile(
  seed: number,
  kind: CityWindowKind,
): {
  profile: CityWindowGlowRoomState;
  emissiveHex: string;
  peakIntensity: number;
  dayTintHex: string;
} {
  const uProfile = seedToUnit01(seed, 1);
  const uColor = seedToUnit01(seed, 2);
  const uIntensity = seedToUnit01(seed, 3);
  const dayTintHex = DAY_GLASS_COLORS[Math.floor(seedToUnit01(seed, 4) * DAY_GLASS_COLORS.length)];

  if (kind === 'civic') {
    // Public halls stay mostly lit (~88%) with warm inviting interior tungsten.
    if (uProfile < 0.56) {
      return {
        profile: 'on',
        emissiveHex: BRIGHT_WARM_COLORS[Math.floor(uColor * BRIGHT_WARM_COLORS.length)],
        peakIntensity: 0.72 + uIntensity * 0.16,
        dayTintHex,
      };
    }
    if (uProfile < 0.78) {
      return {
        profile: 'warm-amber',
        emissiveHex: WARM_AMBER_COLORS[Math.floor(uColor * WARM_AMBER_COLORS.length)],
        peakIntensity: 0.60 + uIntensity * 0.16,
        dayTintHex,
      };
    }
    if (uProfile < 0.88) {
      return {
        profile: 'dim',
        emissiveHex: DIM_WARM_COLORS[Math.floor(uColor * DIM_WARM_COLORS.length)],
        peakIntensity: 0.30 + uIntensity * 0.12,
        dayTintHex,
      };
    }
    return {
      profile: 'off',
      emissiveHex: '#000000',
      peakIntensity: 0,
      dayTintHex,
    };
  }

  if (kind === 'dormer') {
    // Attic / roof dormers (~70% lit) skew slightly cozier and amber.
    if (uProfile < 0.26) {
      return {
        profile: 'on',
        emissiveHex: BRIGHT_WARM_COLORS[Math.floor(uColor * BRIGHT_WARM_COLORS.length)],
        peakIntensity: 0.70 + uIntensity * 0.16,
        dayTintHex,
      };
    }
    if (uProfile < 0.52) {
      return {
        profile: 'warm-amber',
        emissiveHex: WARM_AMBER_COLORS[Math.floor(uColor * WARM_AMBER_COLORS.length)],
        peakIntensity: 0.58 + uIntensity * 0.18,
        dayTintHex,
      };
    }
    if (uProfile < 0.70) {
      return {
        profile: 'dim',
        emissiveHex: DIM_WARM_COLORS[Math.floor(uColor * DIM_WARM_COLORS.length)],
        peakIntensity: 0.26 + uIntensity * 0.14,
        dayTintHex,
      };
    }
    return {
      profile: 'off',
      emissiveHex: '#000000',
      peakIntensity: 0,
      dayTintHex,
    };
  }

  // Default 'upper_floor' apartment/office distribution: ~75% occupancy (target 65-80%).
  if (uProfile < 0.34) {
    return {
      profile: 'on',
      emissiveHex: BRIGHT_WARM_COLORS[Math.floor(uColor * BRIGHT_WARM_COLORS.length)],
      peakIntensity: 0.76 + uIntensity * 0.18,
      dayTintHex,
    };
  }
  if (uProfile < 0.58) {
    return {
      profile: 'warm-amber',
      emissiveHex: WARM_AMBER_COLORS[Math.floor(uColor * WARM_AMBER_COLORS.length)],
      peakIntensity: 0.62 + uIntensity * 0.18,
      dayTintHex,
    };
  }
  if (uProfile < 0.75) {
    return {
      profile: 'dim',
      emissiveHex: DIM_WARM_COLORS[Math.floor(uColor * DIM_WARM_COLORS.length)],
      peakIntensity: 0.26 + uIntensity * 0.15,
      dayTintHex,
    };
  }
  return {
    profile: 'off',
    emissiveHex: '#000000',
    peakIntensity: 0,
    dayTintHex,
  };
}

function evaluateStaggeredNightWindowGlowInto(
  out: StaggeredNightWindowGlowEval,
  seed: number,
  nightFactor01: number,
  elapsedSec: number,
  kind: CityWindowKind = 'upper_floor',
): StaggeredNightWindowGlowEval {
  const n = clamp01(nightFactor01);
  const { profile, emissiveHex, peakIntensity, dayTintHex } = resolveRoomProfile(seed, kind);

  out.profileState = profile;

  // Strictly zero emissive blow-out during daytime (nightFactor01 <= 0.05):
  // keep crisp stylized reflective/tinted daytime glass.
  if (n <= DAYTIME_CUTOFF_NIGHT_FACTOR) {
    out.roomState = 'off';
    out.isLit = false;
    out.emissiveHex = '#000000';
    out.emissiveIntensity = 0;
    out.tintHex = dayTintHex;
    out.duskActivation01 = 0;
    out.shimmerFactor = 1;
    return out;
  }

  if (profile === 'off') {
    out.roomState = 'off';
    out.isLit = false;
    out.emissiveHex = '#000000';
    out.emissiveIntensity = 0;
    out.tintHex = OFF_NIGHT_GLASS_COLOR;
    out.duskActivation01 = 0;
    out.shimmerFactor = 1;
    return out;
  }

  const uThreshold = seedToUnit01(seed, 5);
  const uSpan = seedToUnit01(seed, 6);
  const uFreq = seedToUnit01(seed, 7);
  const uPhase = seedToUnit01(seed, 8);

  const turnOnThreshold =
    kind === 'civic' ? 0.055 + uThreshold * 0.22 : 0.06 + uThreshold * 0.34;
  const fadeSpan = 0.22 + uSpan * 0.14;
  const duskActivation01 = smoothstep(turnOnThreshold, turnOnThreshold + fadeSpan, n);

  if (duskActivation01 <= 0.001) {
    out.roomState = 'off';
    out.isLit = false;
    out.emissiveHex = '#000000';
    out.emissiveIntensity = 0;
    out.tintHex = dayTintHex;
    out.duskActivation01 = 0;
    out.shimmerFactor = 1;
    return out;
  }

  const safeElapsed = Number.isFinite(elapsedSec) ? elapsedSec : 0;
  const shimmerAmp = profile === 'dim' ? 0.05 : 0.035;
  const shimmerFreq = 0.24 + uFreq * 0.38;
  const shimmerPhase = uPhase * Math.PI * 2;
  const shimmerFactor = 1 + Math.sin(safeElapsed * shimmerFreq + shimmerPhase) * shimmerAmp;

  out.roomState = profile;
  out.isLit = true;
  out.emissiveHex = emissiveHex;
  out.emissiveIntensity = peakIntensity * duskActivation01 * shimmerFactor;
  out.tintHex = emissiveHex;
  out.duskActivation01 = duskActivation01;
  out.shimmerFactor = shimmerFactor;
  return out;
}

/**
 * Evaluates staggered warm interior emissive window illumination for a deterministic seed.
 * Daytime (`nightFactor01 <= 0.05`) guarantees strictly `0` emissive so glass stays crisp.
 */
export function evaluateStaggeredNightWindowGlow(
  seed: number,
  nightFactor01: number,
  elapsedSec: number,
  kind: CityWindowKind = 'upper_floor',
): StaggeredNightWindowGlowEval {
  const result: StaggeredNightWindowGlowEval = {
    roomState: 'off',
    profileState: 'off',
    isLit: false,
    emissiveHex: '#000000',
    emissiveIntensity: 0,
    tintHex: DAY_GLASS_COLORS[0],
    duskActivation01: 0,
    shimmerFactor: 1,
  };
  return evaluateStaggeredNightWindowGlowInto(result, seed, nightFactor01, elapsedSec, kind);
}

function evaluateStorefrontDisplayGlowInto(
  out: StorefrontNightIlluminationEval,
  seed: number,
  nightFactor01: number,
  elapsedSec: number,
  isConservatory = false,
): StorefrontNightIlluminationEval {
  const n = clamp01(nightFactor01);
  if (n <= DAYTIME_CUTOFF_NIGHT_FACTOR) {
    out.isNightActive = false;
    out.emissiveHex = '#000000';
    out.emissiveIntensity = 0;
    out.glassOpacity = isConservatory ? 0.34 : 0.30;
    out.interiorFixtureScale = 0.45;
    out.tintHex = STOREFRONT_DAY_TINT_HEX;
    return out;
  }

  const fade = smoothstep(0.055, 0.62, n);
  const safeElapsed = Number.isFinite(elapsedSec) ? elapsedSec : 0;
  const breath =
    1 +
    Math.sin(safeElapsed * (0.28 + seedToUnit01(seed, 11) * 0.16) + seedToUnit01(seed, 12) * 6.28) *
      0.025;

  // Storefront glass intentionally stays clear & low-emissive (<= 0.095 clear, <= 0.18 conservatory)
  // so interior mannequins, racks, scale models, croissants, and espresso bars are never washed out.
  const maxGlassEmissive = isConservatory ? 0.16 : 0.085;
  out.isNightActive = true;
  out.emissiveHex = isConservatory ? CONSERVATORY_NIGHT_WARM_HEX : STOREFRONT_NIGHT_RIM_HEX;
  out.emissiveIntensity = maxGlassEmissive * fade * breath;
  out.glassOpacity = isConservatory ? 0.34 + 0.06 * fade : 0.30 - 0.04 * fade;
  out.interiorFixtureScale = 0.45 + 0.55 * fade * breath;
  out.tintHex = STOREFRONT_NIGHT_TINT_HEX;
  return out;
}

/**
 * Evaluates balanced day/night glazing and interior fixture scaling for street-level storefronts
 * and glasshouse conservatories without blowing out interior props.
 */
export function evaluateStorefrontDisplayGlow(
  seed: number,
  nightFactor01: number,
  elapsedSec: number,
  isConservatory = false,
): StorefrontNightIlluminationEval {
  const result: StorefrontNightIlluminationEval = {
    isNightActive: false,
    emissiveHex: '#000000',
    emissiveIntensity: 0,
    glassOpacity: 0.30,
    interiorFixtureScale: 0.45,
    tintHex: STOREFRONT_DAY_TINT_HEX,
  };
  return evaluateStorefrontDisplayGlowInto(
    result,
    seed,
    nightFactor01,
    elapsedSec,
    isConservatory,
  );
}

/**
 * Attaches canonical `cityWindowSpec` metadata to a mesh or object.
 */
export function tagCityWindowMesh(mesh: THREE.Object3D, spec: CityWindowSpec): void {
  if (!mesh.userData) {
    mesh.userData = {};
  }
  mesh.userData.cityWindowSpec = spec;
}

/**
 * Attaches per-instance `cityWindowSpec` entries to an InstancedMesh.
 */
export function tagCityWindowInstancedMesh(
  mesh: THREE.InstancedMesh,
  specs: readonly CityWindowSpec[],
): void {
  if (!mesh.userData) {
    mesh.userData = {};
  }
  mesh.userData.cityWindowInstancedSpecs = specs;
}

type MaterialKind = 'standard' | 'basic' | 'shader_emissive' | 'shader_toon' | 'unsupported';

interface CachedWindowSlot {
  spec: CityWindowSpec;
  material: THREE.Material;
  materialKind: MaterialKind;
  baseColor: THREE.Color;
  baseEmissive: THREE.Color;
  baseEmissiveIntensity: number;
  baseOpacity: number;
  intensityScale: number;
  lastAppliedKey: string;
}

interface CachedInstancedSlot {
  mesh: THREE.InstancedMesh;
  specs: CityWindowSpec[];
  baseColors: THREE.Color[];
  material: THREE.Material;
  materialKind: MaterialKind;
  baseEmissiveIntensity: number;
  emissiveAttr: THREE.InstancedBufferAttribute | null;
}

/**
 * Equips an instanced window geometry + `MeshStandardMaterial` pair with a per-instance
 * `instanceEmissive` attribute so staggered rooms self-illuminate cleanly in one batch
 * without lighting `'off'` sibling instances.
 */
export function enableInstancedWindowEmissiveAttribute(
  geometry: THREE.BufferGeometry,
  material: THREE.MeshStandardMaterial,
  count: number,
): THREE.InstancedBufferAttribute {
  const emissiveAttr = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  emissiveAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('instanceEmissive', emissiveAttr);

  if (!material.userData) {
    material.userData = {};
  }
  if (!material.userData.cityInstancedEmissiveHooked) {
    material.userData.cityInstancedEmissiveHooked = true;
    material.customProgramCacheKey = () => 'city-instanced-window-emissive-v1';
    const prevCompile = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      if (typeof prevCompile === 'function') {
        prevCompile(shader, renderer);
      }
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute vec3 instanceEmissive;\nvarying vec3 vInstanceEmissive;',
        )
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvInstanceEmissive = instanceEmissive;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vInstanceEmissive;')
        .replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vInstanceEmissive * mix(vec3(0.35), clamp(diffuseColor.rgb, 0.0, 1.0), 0.78);',
        );
    };
  }
  return emissiveAttr;
}

/**
 * Equips a shared clear storefront `MeshStandardMaterial` with a zero-extra-light,
 * zero-extra-draw-call `onBeforeCompile` shader driven by `cityGlassNightUniform` (`uNightFactor01`).
 * Daytime (`nightFactor01 <= 0.05`) stays completely unchanged; at night, adds a subtle warm
 * top-down gallery light curtain and grazing Fresnel rim reflection while keeping center glass
 * clear so illuminated storefront interiors shine through.
 */
export function attachClearStorefrontGlassNightShader(
  mat: THREE.MeshStandardMaterial,
  opts?: { yMin?: number; yMax?: number },
): THREE.MeshStandardMaterial {
  if (!mat.userData) {
    mat.userData = {};
  }
  if (!mat.userData.cityGlassNightUniform) {
    mat.userData.cityGlassNightUniform = { value: 0.0 };
  }
  mat.userData.preserveSharedMaterial = true;
  if (mat.userData.cityClearStorefrontGlassHooked) {
    return mat;
  }
  mat.userData.cityClearStorefrontGlassHooked = true;

  const nightUniform = mat.userData.cityGlassNightUniform as { value: number };
  const yMinUniform = { value: typeof opts?.yMin === 'number' ? opts.yMin : 0.25 };
  const yMaxUniform = { value: typeof opts?.yMax === 'number' ? opts.yMax : 4.05 };
  const prevCompile = mat.onBeforeCompile;

  mat.customProgramCacheKey = () => 'city-clear-storefront-glass-v1';
  mat.onBeforeCompile = (shader, renderer) => {
    if (typeof prevCompile === 'function') {
      prevCompile(shader, renderer);
    }
    shader.uniforms.uNightFactor01 = nightUniform;
    shader.uniforms.uSfYMin = yMinUniform;
    shader.uniforms.uSfYMax = yMaxUniform;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vSfGlassWorldPos;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vSfGlassWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uNightFactor01;
uniform float uSfYMin;
uniform float uSfYMax;
varying vec3 vSfGlassWorldPos;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `float sfNightFade = smoothstep( 0.05, 0.58, clamp( uNightFactor01, 0.0, 1.0 ) );
if ( sfNightFade > 0.001 ) {
  vec3 sfViewDir = normalize( vViewPosition );
  vec3 sfNorm = normalize( normal );
  float sfNdotV = abs( dot( sfNorm, sfViewDir ) );
  float sfFresnel = pow( clamp( 1.0 - sfNdotV, 0.0, 1.0 ), 1.65 );
  float sfYNorm = clamp( ( vSfGlassWorldPos.y - uSfYMin ) / max( 0.25, uSfYMax - uSfYMin ), 0.0, 1.0 );
  float sfTopCurtain = smoothstep( 0.42, 1.0, sfYNorm );
  float sfBottomSillRim = ( 1.0 - smoothstep( 0.0, 0.14, sfYNorm ) ) * 0.45;
  float sfSheen = clamp( sfTopCurtain * 0.36 + sfFresnel * 0.40 + sfBottomSillRim * 0.16 + 0.04, 0.0, 0.72 );
  vec3 sfWarmAmber = mix( vec3( 1.0, 0.85, 0.56 ), vec3( 1.0, 0.94, 0.78 ), sfTopCurtain * 0.65 + sfFresnel * 0.35 );
  outgoingLight += sfWarmAmber * ( sfSheen * sfNightFade * 0.82 );
  diffuseColor.a = clamp( diffuseColor.a + ( sfTopCurtain * 0.10 + sfFresnel * 0.12 ) * sfNightFade, 0.18, 0.54 );
}
#include <opaque_fragment>`,
      );
  };

  return mat;
}

interface CachedGlassShaderUniform {
  uniform: { value: number };
}

interface CachedWindowRegistry {
  scannedChildren: WeakSet<THREE.Object3D>;
  seenUniformRefs: Set<object>;
  distinctSeedsPerMat: Map<THREE.Material, Set<number>>;
  fallbackIndex: number;
  slots: CachedWindowSlot[];
  instancedSlots: CachedInstancedSlot[];
  glassUniforms: CachedGlassShaderUniform[];
  hasAppliedInitial: boolean;
  prevWasDay: boolean;
  prevNightFactor: number;
  prevElapsedSec: number;
}

const REGISTRY_CACHE = new WeakMap<THREE.Object3D, CachedWindowRegistry>();

function inferCityWindowSpecFromMesh(mesh: THREE.Mesh, fallbackIndex: number): CityWindowSpec | null {
  const userData = mesh.userData as Record<string, unknown> | undefined;
  if (userData?.excludeFromNightWindowLighting === true || userData?.isModelStroke === true) {
    return null;
  }

  const rawSpec = userData?.cityWindowSpec as Partial<CityWindowSpec> | undefined;
  if (rawSpec && typeof rawSpec.id === 'string' && typeof rawSpec.kind === 'string') {
    const seed =
      typeof rawSpec.seed === 'number' && Number.isFinite(rawSpec.seed)
        ? rawSpec.seed
        : computeDeterministicWindowSeed(rawSpec.id);
    return {
      id: rawSpec.id,
      kind: rawSpec.kind as CityWindowKind,
      seed,
      baseColorHex: rawSpec.baseColorHex,
      baseEmissiveHex: rawSpec.baseEmissiveHex,
      baseEmissiveIntensity: rawSpec.baseEmissiveIntensity,
      baseOpacity: rawSpec.baseOpacity,
      intensityScale: rawSpec.intensityScale,
    };
  }

  const name = mesh.name || '';
  if (!name || EXCLUDED_NAME_REGEX.test(name) || !WINDOW_NAME_REGEX.test(name)) {
    return null;
  }

  const lower = name.toLowerCase();
  let kind: CityWindowKind = 'upper_floor';
  if (lower.includes('storefront') || lower.includes('showcase') || lower.includes('shop')) {
    kind = 'storefront';
  } else if (lower.includes('conservatory') || lower.includes('frosted')) {
    kind = 'conservatory';
  } else if (lower.includes('dormer') || lower.includes('skylight') || lower.includes('gable')) {
    kind = 'dormer';
  } else if (lower.includes('civic') || lower.includes('municipal') || lower.includes('casino') || lower.includes('foyer')) {
    kind = 'civic';
  }

  const id = `${name}#${fallbackIndex}`;
  return {
    id,
    kind,
    seed: computeDeterministicWindowSeed(id),
  };
}

function classifyMaterial(mat: THREE.Material): MaterialKind {
  if (mat instanceof THREE.ShaderMaterial) {
    if (mat.uniforms?.uEmissive?.value instanceof THREE.Color) {
      return 'shader_emissive';
    }
    if (mat.uniforms?.uBaseColor?.value instanceof THREE.Color) {
      return 'shader_toon';
    }
    return 'unsupported';
  }
  const maybeEmissive = mat as THREE.MeshStandardMaterial;
  if ('emissive' in maybeEmissive && maybeEmissive.emissive instanceof THREE.Color) {
    return 'standard';
  }
  if (mat instanceof THREE.MeshBasicMaterial || 'color' in mat) {
    return 'basic';
  }
  return 'unsupported';
}

function captureBaseColor(mat: THREE.Material, hexOverride?: string): THREE.Color {
  if (hexOverride) {
    return new THREE.Color(hexOverride);
  }
  if (mat instanceof THREE.ShaderMaterial && mat.uniforms?.uBaseColor?.value instanceof THREE.Color) {
    return mat.uniforms.uBaseColor.value.clone();
  }
  const anyMat = mat as { color?: THREE.Color };
  if (anyMat.color instanceof THREE.Color) {
    return anyMat.color.clone();
  }
  return new THREE.Color('#c8e6fa');
}

function cloneMaterialPreservingSharedEnvUniforms(mat: THREE.Material): THREE.Material {
  if (mat instanceof THREE.ShaderMaterial) {
    const srcUniforms = mat.uniforms;
    const cloned = mat.clone();
    // Keep global animated/sunlight uniforms bound by reference when present.
    if (srcUniforms.uLightDirection) cloned.uniforms.uLightDirection = srcUniforms.uLightDirection;
    if (srcUniforms.uLightColor) cloned.uniforms.uLightColor = srcUniforms.uLightColor;
    if (srcUniforms.uMap) cloned.uniforms.uMap = srcUniforms.uMap;
    return cloned;
  }
  return mat.clone();
}

function scanSubtreesIntoRegistry(
  subtrees: ReadonlyArray<THREE.Object3D>,
  registry: CachedWindowRegistry,
): number {
  const discoveredRaw: {
    mesh: THREE.Mesh;
    spec: CityWindowSpec;
    materialIndex: number;
    material: THREE.Material;
  }[] = [];
  const startSlots = registry.slots.length;
  const startInstanced = registry.instancedSlots.length;
  const startUniforms = registry.glassUniforms.length;

  const trackGlassUniform = (mat: THREE.Material) => {
    const nightUni = mat.userData?.cityGlassNightUniform as { value: number } | undefined;
    if (
      nightUni &&
      typeof nightUni.value === 'number' &&
      !registry.seenUniformRefs.has(nightUni)
    ) {
      registry.seenUniformRefs.add(nightUni);
      registry.glassUniforms.push({ uniform: nightUni });
    }
    if (mat instanceof THREE.ShaderMaterial) {
      const shaderNightUni = mat.uniforms?.uNightFactor01 as { value: number } | undefined;
      if (
        shaderNightUni &&
        typeof shaderNightUni.value === 'number' &&
        !registry.seenUniformRefs.has(shaderNightUni)
      ) {
        registry.seenUniformRefs.add(shaderNightUni);
        registry.glassUniforms.push({ uniform: shaderNightUni });
      }
    }
  };

  for (let sIdx = 0; sIdx < subtrees.length; sIdx++) {
    subtrees[sIdx].traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (let i = 0; i < mats.length; i++) {
        if (mats[i]) trackGlassUniform(mats[i]);
      }

      if (obj instanceof THREE.InstancedMesh) {
        const explicitArray = obj.userData?.cityWindowInstancedSpecs as
          | readonly CityWindowSpec[]
          | undefined;
        const singleSpec = obj.userData?.cityWindowSpec as CityWindowSpec | undefined;
        if (explicitArray || singleSpec) {
          const count = obj.count;
          const specs: CityWindowSpec[] = [];
          const baseColors: THREE.Color[] = [];
          const targetMat = mats[0];
          if (!targetMat) return;
          const hadInstanceColor = Boolean(obj.instanceColor);
          const fallbackColor = captureBaseColor(targetMat, singleSpec?.baseColorHex);
          // Three.js multiplies mat.color * instanceColor. When initializing instanceColor on a
          // mesh whose material holds the base tint, shift mat.color to white so daytime isn't squared.
          const anyTargetMat = targetMat as { color?: THREE.Color };
          if (!hadInstanceColor && anyTargetMat.color instanceof THREE.Color) {
            anyTargetMat.color.set('#ffffff');
          }
          for (let idx = 0; idx < count; idx++) {
            const itemSpec = explicitArray?.[idx];
            const spec: CityWindowSpec = itemSpec
              ? itemSpec
              : {
                  id: `${singleSpec!.id}#${idx}`,
                  kind: singleSpec!.kind,
                  seed: computeDeterministicWindowSeed(singleSpec!.id, idx, 0),
                  baseColorHex: singleSpec!.baseColorHex,
                  intensityScale: singleSpec!.intensityScale,
                };
            specs.push(spec);
            if (hadInstanceColor && obj.instanceColor) {
              const c = new THREE.Color();
              obj.getColorAt(idx, c);
              baseColors.push(c);
            } else {
              baseColors.push(
                spec.baseColorHex ? new THREE.Color(spec.baseColorHex) : fallbackColor.clone(),
              );
            }
          }
          // Ensure instanceColor buffer exists once during cache construction (never per-frame).
          if (!hadInstanceColor) {
            for (let idx = 0; idx < count; idx++) {
              obj.setColorAt(idx, baseColors[idx]);
            }
            if (obj.instanceColor) {
              obj.instanceColor.needsUpdate = true;
            }
          }
          const stdMat = targetMat as THREE.MeshStandardMaterial;
          const emissiveAttr = obj.geometry?.getAttribute?.('instanceEmissive');
          registry.instancedSlots.push({
            mesh: obj,
            specs,
            baseColors,
            material: targetMat,
            materialKind: classifyMaterial(targetMat),
            baseEmissiveIntensity:
              typeof stdMat.emissiveIntensity === 'number' ? stdMat.emissiveIntensity : 0,
            emissiveAttr:
              emissiveAttr instanceof THREE.InstancedBufferAttribute ? emissiveAttr : null,
          });
        }
        return;
      }

      const spec = inferCityWindowSpecFromMesh(obj, registry.fallbackIndex++);
      if (!spec) return;

      for (let i = 0; i < mats.length; i++) {
        const mat = mats[i];
        if (!mat) continue;
        discoveredRaw.push({
          mesh: obj,
          spec,
          materialIndex: Array.isArray(obj.material) ? i : -1,
          material: mat,
        });
      }
    });
  }

  if (discoveredRaw.length > 0) {
    // Count distinct seeds sharing each material across all scanned meshes for non-storefront/
    // non-shared-shader windows so each apartment/civic/dormer window can glow & fade independently.
    const distinctSeedsPerMat = registry.distinctSeedsPerMat;
    for (let i = 0; i < discoveredRaw.length; i++) {
      const entry = discoveredRaw[i];
      if (
        entry.spec.kind === 'storefront' ||
        entry.spec.kind === 'conservatory' ||
        entry.material.userData?.preserveSharedMaterial === true ||
        entry.material.userData?.cityGlassNightUniform
      ) {
        continue;
      }
      let set = distinctSeedsPerMat.get(entry.material);
      if (!set) {
        set = new Set<number>();
        distinctSeedsPerMat.set(entry.material, set);
      }
      set.add(entry.spec.seed);
    }

    const clonedMatBySeedKey = new Map<string, THREE.Material>();

    for (let i = 0; i < discoveredRaw.length; i++) {
      const entry = discoveredRaw[i];
      let targetMat = entry.material;
      const sharedSet = distinctSeedsPerMat.get(targetMat);
      if (sharedSet && sharedSet.size > 1) {
        const cloneKey = `${targetMat.uuid}:${entry.spec.seed}:${entry.spec.kind}`;
        let cloned = clonedMatBySeedKey.get(cloneKey);
        if (!cloned) {
          cloned = cloneMaterialPreservingSharedEnvUniforms(targetMat);
          clonedMatBySeedKey.set(cloneKey, cloned);
        }
        if (entry.materialIndex >= 0 && Array.isArray(entry.mesh.material)) {
          entry.mesh.material[entry.materialIndex] = cloned;
        } else {
          entry.mesh.material = cloned;
        }
        targetMat = cloned;
      }

      const stdMat = targetMat as THREE.MeshStandardMaterial;
      const baseColor = captureBaseColor(targetMat, entry.spec.baseColorHex);
      const baseEmissive =
        entry.spec.baseEmissiveHex
          ? new THREE.Color(entry.spec.baseEmissiveHex)
          : 'emissive' in stdMat && stdMat.emissive instanceof THREE.Color
            ? stdMat.emissive.clone()
            : new THREE.Color('#000000');

      registry.slots.push({
        spec: entry.spec,
        material: targetMat,
        materialKind: classifyMaterial(targetMat),
        baseColor,
        baseEmissive,
        baseEmissiveIntensity:
          typeof entry.spec.baseEmissiveIntensity === 'number'
            ? entry.spec.baseEmissiveIntensity
            : typeof stdMat.emissiveIntensity === 'number'
              ? stdMat.emissiveIntensity
              : 0,
        baseOpacity:
          typeof entry.spec.baseOpacity === 'number'
            ? entry.spec.baseOpacity
            : typeof targetMat.opacity === 'number'
              ? targetMat.opacity
              : 1,
        intensityScale:
          typeof entry.spec.intensityScale === 'number' && Number.isFinite(entry.spec.intensityScale)
            ? entry.spec.intensityScale
            : 1.0,
        lastAppliedKey: '',
      });
    }
  }

  return (
    registry.slots.length -
    startSlots +
    (registry.instancedSlots.length - startInstanced) +
    (registry.glassUniforms.length - startUniforms)
  );
}

function collectWindowRegistry(root: THREE.Object3D): CachedWindowRegistry {
  const registry: CachedWindowRegistry = {
    scannedChildren: new WeakSet<THREE.Object3D>(),
    seenUniformRefs: new Set<object>(),
    distinctSeedsPerMat: new Map<THREE.Material, Set<number>>(),
    fallbackIndex: 0,
    slots: [],
    instancedSlots: [],
    glassUniforms: [],
    hasAppliedInitial: false,
    prevWasDay: false,
    prevNightFactor: -1,
    prevElapsedSec: -1,
  };
  const initialTargets: THREE.Object3D[] = [];
  if (root instanceof THREE.Mesh) {
    initialTargets.push(root);
  }
  const children = root.children;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    registry.scannedChildren.add(child);
    initialTargets.push(child);
  }
  if (initialTargets.length > 0) {
    scanSubtreesIntoRegistry(initialTargets, registry);
  }
  return registry;
}

function getOrBuildWindowRegistry(root: THREE.Object3D): {
  registry: CachedWindowRegistry;
  grew: boolean;
} {
  let registry = REGISTRY_CACHE.get(root);
  if (!registry) {
    registry = collectWindowRegistry(root);
    REGISTRY_CACHE.set(root, registry);
    return { registry, grew: true };
  }
  // Incrementally scan ONLY newly added top-level children so dynamic scene.add/remove
  // of crates, pickups, or scooters never triggers a full-scene traversal stall.
  let newChildren: THREE.Object3D[] | null = null;
  const children = root.children;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!registry.scannedChildren.has(child)) {
      registry.scannedChildren.add(child);
      if (!newChildren) newChildren = [];
      newChildren.push(child);
    }
  }
  const added = newChildren ? scanSubtreesIntoRegistry(newChildren, registry) : 0;
  return { registry, grew: added > 0 };
}

/**
 * Forces re-discovery of window meshes under `root` on the next `updateCityWindowNightLighting` call.
 */
export function invalidateCityWindowNightLightingCache(root: THREE.Object3D): void {
  REGISTRY_CACHE.delete(root);
}

/**
 * Returns the cached count of discovered window/glass slots under `root`.
 */
export function getCityWindowNightLightingRegistrySize(root: THREE.Object3D): number {
  const { registry } = getOrBuildWindowRegistry(root);
  return registry.slots.length + registry.instancedSlots.length + registry.glassUniforms.length;
}

function applySlotToMaterial(
  slot: CachedWindowSlot,
  isDay: boolean,
  emissiveHex: string,
  emissiveIntensity: number,
  tintHex: string,
  targetOpacity: number,
  duskBlend01: number,
  isLit: boolean,
): void {
  const mat = slot.material;
  const kind = slot.materialKind;
  if (kind === 'unsupported') return;

  if (kind === 'standard') {
    const stdMat = mat as THREE.MeshStandardMaterial;
    if (isDay) {
      stdMat.color.copy(slot.baseColor);
      stdMat.emissive.setRGB(0, 0, 0);
      stdMat.emissiveIntensity = 0;
      if (stdMat.transparent && slot.spec.kind === 'storefront') {
        stdMat.opacity = targetOpacity;
      }
      return;
    }

    if (isLit) {
      stdMat.emissive.set(emissiveHex);
      stdMat.emissiveIntensity = emissiveIntensity;
      SCRATCH_COLOR_A.set(tintHex);
      stdMat.color.copy(slot.baseColor).lerp(SCRATCH_COLOR_A, 0.42 * duskBlend01);
    } else {
      stdMat.emissive.setRGB(0, 0, 0);
      stdMat.emissiveIntensity = 0;
      SCRATCH_COLOR_A.set(OFF_NIGHT_GLASS_COLOR);
      stdMat.color.copy(slot.baseColor).lerp(SCRATCH_COLOR_A, 0.72 * duskBlend01);
    }
    if (stdMat.transparent && (slot.spec.kind === 'storefront' || slot.spec.kind === 'conservatory')) {
      stdMat.opacity = targetOpacity;
    }
    return;
  }

  if (kind === 'basic') {
    const basicMat = mat as THREE.MeshBasicMaterial;
    if (isDay) {
      basicMat.color.copy(slot.baseColor);
      if (basicMat.transparent && (slot.spec.kind === 'storefront' || slot.spec.kind === 'conservatory')) {
        basicMat.opacity = targetOpacity;
      }
      return;
    }
    if (isLit) {
      SCRATCH_COLOR_A.set(tintHex);
      const warmWeight = Math.min(0.88, 0.30 + emissiveIntensity * 0.65);
      basicMat.color.copy(slot.baseColor).lerp(SCRATCH_COLOR_A, warmWeight);
    } else {
      SCRATCH_COLOR_A.set(OFF_NIGHT_GLASS_COLOR);
      basicMat.color.copy(slot.baseColor).lerp(SCRATCH_COLOR_A, 0.68 * duskBlend01);
    }
    if (basicMat.transparent && (slot.spec.kind === 'storefront' || slot.spec.kind === 'conservatory')) {
      basicMat.opacity = targetOpacity;
    }
    return;
  }

  if (kind === 'shader_emissive') {
    const shaderMat = mat as THREE.ShaderMaterial;
    const uEmissive = shaderMat.uniforms.uEmissive?.value as THREE.Color | undefined;
    const uEmissiveIntensity = shaderMat.uniforms.uEmissiveIntensity as
      | { value: number }
      | undefined;
    const uBaseColor = shaderMat.uniforms.uBaseColor?.value as THREE.Color | undefined;

    if (isDay) {
      if (uEmissive) uEmissive.setRGB(0, 0, 0);
      if (uEmissiveIntensity) uEmissiveIntensity.value = 0;
      if (uBaseColor) uBaseColor.copy(slot.baseColor);
      return;
    }

    if (isLit) {
      if (uEmissive) {
        if (uEmissiveIntensity) {
          uEmissive.set(emissiveHex);
          uEmissiveIntensity.value = emissiveIntensity;
        } else {
          // upgradeMeshToBlitzWorldMaterial adds `uEmissive` directly in fragment shader.
          uEmissive.set(emissiveHex).multiplyScalar(emissiveIntensity);
        }
      }
      if (uBaseColor) {
        SCRATCH_COLOR_A.set(tintHex);
        uBaseColor.copy(slot.baseColor).lerp(SCRATCH_COLOR_A, 0.45 * duskBlend01);
      }
    } else {
      if (uEmissive) uEmissive.setRGB(0, 0, 0);
      if (uEmissiveIntensity) uEmissiveIntensity.value = 0;
      if (uBaseColor) {
        SCRATCH_COLOR_A.set(OFF_NIGHT_GLASS_COLOR);
        uBaseColor.copy(slot.baseColor).lerp(SCRATCH_COLOR_A, 0.72 * duskBlend01);
      }
    }
    return;
  }

  if (kind === 'shader_toon') {
    const shaderMat = mat as THREE.ShaderMaterial;
    const uBaseColor = shaderMat.uniforms.uBaseColor?.value as THREE.Color | undefined;
    if (!uBaseColor) return;
    if (isDay) {
      uBaseColor.copy(slot.baseColor);
      return;
    }
    if (isLit) {
      SCRATCH_COLOR_A.set(tintHex);
      const lift = Math.min(1.0, 0.42 + emissiveIntensity * 0.62);
      uBaseColor.copy(slot.baseColor).lerp(SCRATCH_COLOR_A, lift);
    } else {
      SCRATCH_COLOR_A.set(OFF_NIGHT_GLASS_COLOR);
      uBaseColor.copy(slot.baseColor).lerp(SCRATCH_COLOR_A, 0.72 * duskBlend01);
    }
  }
}

/**
 * Updates all cached window & storefront glass meshes and shared conservatory shader uniforms under `root`.
 * Allocates zero heap objects during frame updates once the root cache is initialized.
 */
export function updateCityWindowNightLighting(
  root: THREE.Object3D,
  nightFactor01: number,
  elapsedSec: number,
): number {
  const n = clamp01(nightFactor01);
  const safeElapsed = Number.isFinite(elapsedSec) ? elapsedSec : 0;
  const isDay = n <= DAYTIME_CUTOFF_NIGHT_FACTOR;
  const duskBlend = isDay ? 0 : smoothstep(DAYTIME_CUTOFF_NIGHT_FACTOR, 0.75, n);
  const { registry, grew } = getOrBuildWindowRegistry(root);

  if (
    !shouldRefreshNightLightingFrame({
      isDay,
      nightFactor: n,
      elapsedSec: safeElapsed,
      hasAppliedInitial: registry.hasAppliedInitial,
      prevWasDay: registry.prevWasDay,
      prevNightFactor: registry.prevNightFactor,
      prevElapsedSec: registry.prevElapsedSec,
      registryGrew: grew,
    })
  ) {
    return registry.slots.length + registry.instancedSlots.length;
  }

  registry.hasAppliedInitial = true;
  registry.prevWasDay = isDay;
  registry.prevNightFactor = n;
  registry.prevElapsedSec = safeElapsed;

  for (let i = 0; i < registry.glassUniforms.length; i++) {
    registry.glassUniforms[i].uniform.value = n;
  }

  for (let i = 0; i < registry.slots.length; i++) {
    const slot = registry.slots[i];
    const kind = slot.spec.kind;

    if (kind === 'storefront' || kind === 'conservatory') {
      const evalStorefront = evaluateStorefrontDisplayGlowInto(
        SCRATCH_STOREFRONT_EVAL,
        slot.spec.seed,
        n,
        safeElapsed,
        kind === 'conservatory',
      );
      applySlotToMaterial(
        slot,
        isDay,
        evalStorefront.emissiveHex,
        evalStorefront.emissiveIntensity * slot.intensityScale,
        evalStorefront.tintHex,
        evalStorefront.glassOpacity,
        duskBlend,
        evalStorefront.isNightActive,
      );
      continue;
    }

    const evalWin = evaluateStaggeredNightWindowGlowInto(
      SCRATCH_EVAL,
      slot.spec.seed,
      n,
      safeElapsed,
      kind,
    );
    applySlotToMaterial(
      slot,
      isDay,
      evalWin.emissiveHex,
      evalWin.emissiveIntensity * slot.intensityScale,
      evalWin.tintHex,
      slot.baseOpacity,
      evalWin.duskActivation01 > 0 ? evalWin.duskActivation01 : duskBlend,
      evalWin.isLit,
    );
  }

  for (let i = 0; i < registry.instancedSlots.length; i++) {
    const instSlot = registry.instancedSlots[i];
    const instMesh = instSlot.mesh;
    const count = instSlot.specs.length;
    const emissiveAttr = instSlot.emissiveAttr;

    if (instSlot.materialKind === 'standard') {
      const stdMat = instSlot.material as THREE.MeshStandardMaterial;
      if (emissiveAttr || isDay) {
        stdMat.emissive.setRGB(0, 0, 0);
        stdMat.emissiveIntensity = 0;
      } else {
        stdMat.emissive.set(BRIGHT_WARM_COLORS[0]);
        stdMat.emissiveIntensity = 0.045 * duskBlend;
      }
    }

    for (let idx = 0; idx < count; idx++) {
      const spec = instSlot.specs[idx];
      const baseColor = instSlot.baseColors[idx];
      if (isDay) {
        instMesh.setColorAt(idx, baseColor);
        if (emissiveAttr) emissiveAttr.setXYZ(idx, 0, 0, 0);
        continue;
      }
      const evalWin = evaluateStaggeredNightWindowGlowInto(
        SCRATCH_EVAL,
        spec.seed,
        n,
        safeElapsed,
        spec.kind,
      );
      if (evalWin.isLit) {
        SCRATCH_COLOR_A.set(evalWin.emissiveHex);
        const boost = emissiveAttr ? 1 : 1 + evalWin.emissiveIntensity * 0.72;
        SCRATCH_COLOR_B.copy(baseColor).lerp(SCRATCH_COLOR_A, 0.85).multiplyScalar(boost);
        instMesh.setColorAt(idx, SCRATCH_COLOR_B);
        if (emissiveAttr) {
          const eGain = evalWin.emissiveIntensity * 1.15;
          emissiveAttr.setXYZ(
            idx,
            SCRATCH_COLOR_A.r * eGain,
            SCRATCH_COLOR_A.g * eGain,
            SCRATCH_COLOR_A.b * eGain,
          );
        }
      } else {
        SCRATCH_COLOR_A.set(OFF_NIGHT_GLASS_COLOR);
        SCRATCH_COLOR_B.copy(baseColor).lerp(SCRATCH_COLOR_A, 0.78 * duskBlend);
        instMesh.setColorAt(idx, SCRATCH_COLOR_B);
        if (emissiveAttr) emissiveAttr.setXYZ(idx, 0, 0, 0);
      }
    }

    if (instMesh.instanceColor) {
      instMesh.instanceColor.needsUpdate = true;
    }
    if (emissiveAttr) {
      emissiveAttr.needsUpdate = true;
    }
  }

  return registry.slots.length + registry.instancedSlots.length;
}
