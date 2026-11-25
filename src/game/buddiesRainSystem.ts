import * as THREE from 'three';

export interface RainControllerState {
  intensity: number;
  targetIntensity: number;
  windX: number;
  targetWindX: number;
  windZ: number;
  targetWindZ: number;
}

export interface GpuRainSystemOptions {
  isSoftwareGl?: boolean;
  particleCount?: number;
  baseSpanXZ?: number;
  baseSpanY?: number;
  initialIntensity?: number;
  initialWindX?: number;
  initialWindZ?: number;
}

export interface GpuRainUpdateParams {
  dt: number;
  timeSec: number;
  centerX: number;
  centerY: number;
  centerZ: number;
  spanXZ?: number;
  spanY?: number;
  minGroundY?: number;
  viewportHeightPx?: number;
  pixelRatio?: number;
  rainColor?: THREE.Color;
  rainShadowColor?: THREE.Color;
  immediate?: boolean;
}

export interface DynamicRainController {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.ShaderMaterial;
  readonly particleCount: number;
  readonly state: RainControllerState;
  setTarget(target: { intensity?: number; windX?: number; windZ?: number }): void;
  setIntensity(intensity: number): void;
  setWind(windX: number, windZ: number): void;
  update(params: GpuRainUpdateParams): RainControllerState;
  dispose(): void;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function clampRange(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function lerpScalar(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function createDeterministicRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const GPU_RAIN_VERTEX_SHADER = /* glsl */ `
  attribute vec3 aOffset;
  attribute float aSpeed;
  attribute float aPhase;
  attribute float aRandom;

  uniform float uTime;
  uniform vec3 uCenter;
  uniform vec3 uBoxSize;
  uniform vec2 uWind;
  uniform float uIntensity;
  uniform float uMinGroundY;
  uniform float uViewportHeight;
  uniform float uPixelRatio;

  varying vec2 vStreakDir;
  varying float vTopDownMix;
  varying float vAlpha;
  varying float vRandom;
  varying float vPointSizePx;

  void main() {
    float intensity = clamp(uIntensity, 0.0, 1.0);
    if (intensity <= 0.004 || aRandom > intensity) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      vAlpha = 0.0;
      vStreakDir = vec2(0.0, 1.0);
      vTopDownMix = 0.0;
      vRandom = aRandom;
      vPointSizePx = 0.0;
      return;
    }

    vec3 halfBox = uBoxSize * 0.5;
    float fallDist = aSpeed * uTime + aPhase * 1.45;
    float driftTime = uTime + aPhase * 0.25;
    float flutter = sin(uTime * 1.35 + aPhase) * 0.14;

    float rawX = aOffset.x * uBoxSize.x + uWind.x * driftTime + flutter;
    float rawZ = aOffset.z * uBoxSize.z + uWind.y * driftTime - flutter * 0.6;
    float rawY = aOffset.y * uBoxSize.y - fallDist;

    float minX = uCenter.x - halfBox.x;
    float minY = uCenter.y - halfBox.y;
    float minZ = uCenter.z - halfBox.z;

    float wx = mod(rawX - minX, uBoxSize.x) + minX;
    float wy = mod(rawY - minY, uBoxSize.y) + minY;
    float wz = mod(rawZ - minZ, uBoxSize.z) + minZ;

    // Fade gently near box boundaries & ground floor without popping
    float radialXZ = length(vec2(wx - uCenter.x, wz - uCenter.z));
    float radialFade = 1.0 - smoothstep(halfBox.x * 0.76, halfBox.x * 0.99, radialXZ);
    float topFade = 1.0 - smoothstep(uCenter.y + halfBox.y - 3.2, uCenter.y + halfBox.y, wy);
    float bottomFade = smoothstep(minY, minY + 2.2, wy) * smoothstep(uMinGroundY - 0.35, uMinGroundY + 0.75, wy);

    // Smooth per-particle fade-in as uIntensity crosses aRandom
    float thresholdFade = smoothstep(aRandom, min(1.0, aRandom + 0.08), intensity);

    vec3 worldPos = vec3(wx, wy, wz);
    vec4 viewPos = viewMatrix * vec4(worldPos, 1.0);
    if (viewPos.z > -0.35) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      vAlpha = 0.0;
      vStreakDir = vec2(0.0, 1.0);
      vTopDownMix = 0.0;
      vRandom = aRandom;
      vPointSizePx = 0.0;
      return;
    }

    vec3 vel3D = normalize(vec3(uWind.x, -aSpeed, uWind.y));
    vec3 viewVel = (viewMatrix * vec4(vel3D, 0.0)).xyz;
    float xyLen = length(viewVel.xy);
    vTopDownMix = 1.0 - smoothstep(0.14, 0.62, xyLen);

    float fallbackAngle = 0.48 + sin(aPhase) * 0.16;
    vec2 fallbackDir = vec2(cos(fallbackAngle), sin(fallbackAngle));
    // gl_PointCoord.y grows downward while view-space +Y grows upward
    vec2 projDir = xyLen > 0.02 ? vec2(viewVel.x, -viewVel.y) / xyLen : fallbackDir;
    vStreakDir = normalize(mix(fallbackDir, projDir, smoothstep(0.03, 0.24, xyLen)));

    float camDist = max(1.0, -viewPos.z);
    float seedVar = fract(aPhase * 1.73205 + aRandom * 3.14159);
    float worldLen = mix(0.95, 1.85, clamp((camDist - 16.0) / 85.0, 0.0, 1.0))
      * (0.82 + 0.34 * seedVar)
      * (0.86 + 0.28 * intensity);
    float projScale = (max(uViewportHeight, 240.0) * 0.5 * projectionMatrix[1][1]) / camDist;
    float rawPx = worldLen * projScale;

    float minPx = mix(9.5, 13.5, vTopDownMix) * max(uPixelRatio, 1.0);
    float maxPx = 54.0 * max(uPixelRatio, 1.0);
    gl_PointSize = clamp(rawPx, minPx, maxPx);

    vPointSizePx = gl_PointSize;
    vRandom = seedVar;
    vAlpha = radialFade * topFade * bottomFade * thresholdFade * (0.58 + 0.42 * seedVar);

    gl_Position = projectionMatrix * viewPos;
  }
`;

export const GPU_RAIN_FRAGMENT_SHADER = /* glsl */ `
  uniform float uIntensity;
  uniform vec3 uRainColor;
  uniform vec3 uRainShadowColor;

  varying vec2 vStreakDir;
  varying float vTopDownMix;
  varying float vAlpha;
  varying float vRandom;
  varying float vPointSizePx;

  void main() {
    if (vAlpha <= 0.005) discard;

    vec2 p = gl_PointCoord - 0.5;
    vec2 dir = normalize(vStreakDir);
    vec2 perp = vec2(-dir.y, dir.x);
    float along = dot(p, dir);
    float across = dot(p, perp);

    // Keep at least ~0.9px half-width so streaks never vanish at steep/distant angles
    float minUvHalfW = 0.90 / max(vPointSizePx, 4.0);
    float halfW = max(minUvHalfW, mix(0.048, 0.092, vTopDownMix));
    float halfL = mix(0.46, 0.26, vTopDownMix);

    float coreAcross = 1.0 - smoothstep(halfW * 0.20, halfW * 1.45, abs(across));
    float softHalo = 1.0 - smoothstep(halfW * 0.55, halfW * 2.55, abs(across));
    float alongMask =
      smoothstep(-halfL, -halfL * 0.22, along) *
      (1.0 - smoothstep(halfL * 0.34, halfL, along));

    // Subtle raindrop head for crisp readability in top-down & steep downward views
    vec2 headDelta = p - dir * (halfL * 0.22);
    float headSpot = exp(-dot(headDelta, headDelta) * mix(165.0, 50.0, vTopDownMix));

    float coreShape = max(coreAcross * alongMask, headSpot * (0.34 + 0.56 * vTopDownMix));
    float haloShape = softHalo * alongMask * 0.34;
    float mask = clamp(coreShape + haloShape, 0.0, 1.0);
    if (mask <= 0.01) discard;

    vec3 col = mix(uRainShadowColor, uRainColor, clamp(coreShape * 1.12, 0.0, 1.0));
    float intensityBoost = 0.65 + 0.35 * clamp(uIntensity, 0.0, 1.0);
    float alpha = mask * vAlpha * intensityBoost * mix(0.62, 0.72, vTopDownMix);
    if (alpha <= 0.008) discard;

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.85));
  }
`;

/**
 * Builds a single-draw-call GPU-driven rain particle system (`THREE.Points` + `ShaderMaterial`)
 * with static `BufferGeometry` attributes (`aOffset`, `aSpeed`, `aPhase`, `aRandom`) and a
 * lightweight `lerp`-smoothed `DynamicRainController` (zero per-frame CPU buffer updates).
 */
export function createGpuRainSystem(options?: GpuRainSystemOptions): DynamicRainController {
  const isSoftwareGl = Boolean(options?.isSoftwareGl);
  const particleCount = clampRange(
    Math.round(options?.particleCount ?? (isSoftwareGl ? 1600 : 2800)),
    1500,
    4000,
  );
  const baseSpanXZ = Math.max(24, options?.baseSpanXZ ?? 86.0);
  const baseSpanY = Math.max(16, options?.baseSpanY ?? 30.0);

  const rng = createDeterministicRng(20261125);

  const positions = new Float32Array(particleCount * 3);
  const offsets = new Float32Array(particleCount * 3);
  const speeds = new Float32Array(particleCount);
  const phases = new Float32Array(particleCount);
  const randoms = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    // Keep position static at origin; shader computes exact world position from static attributes
    positions[i * 3] = 0;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;

    offsets[i * 3] = rng() - 0.5;
    offsets[i * 3 + 1] = rng();
    offsets[i * 3 + 2] = rng() - 0.5;

    speeds[i] = 19.5 + rng() * 9.5;
    phases[i] = rng() * Math.PI * 2;
    randoms[i] = rng();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 3));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 12, 0), 9999);

  const initialIntensity = clamp01(options?.initialIntensity ?? 0);
  const initialWindX = Number.isFinite(options?.initialWindX) ? (options?.initialWindX as number) : 0;
  const initialWindZ = Number.isFinite(options?.initialWindZ) ? (options?.initialWindZ as number) : 0;

  const state: RainControllerState = {
    intensity: initialIntensity,
    targetIntensity: initialIntensity,
    windX: initialWindX,
    targetWindX: initialWindX,
    windZ: initialWindZ,
    targetWindZ: initialWindZ,
  };

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCenter: { value: new THREE.Vector3(0, 12, 0) },
      uBoxSize: { value: new THREE.Vector3(baseSpanXZ, baseSpanY, baseSpanXZ) },
      uWind: { value: new THREE.Vector2(initialWindX, initialWindZ) },
      uIntensity: { value: initialIntensity },
      uMinGroundY: { value: -0.25 },
      uViewportHeight: { value: 720 },
      uPixelRatio: { value: 1.0 },
      uRainColor: { value: new THREE.Color('#dceeff') },
      uRainShadowColor: { value: new THREE.Color('#5a7594') },
      // Legacy compatibility aliases read by external tests/inspectors
      uSpanXZ: { value: baseSpanXZ },
      uRainIntensity: { value: initialIntensity },
    },
    vertexShader: GPU_RAIN_VERTEX_SHADER,
    fragmentShader: GPU_RAIN_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'WeatherRainPointsGPU';
  points.frustumCulled = false;
  points.renderOrder = 12;
  points.visible = initialIntensity > 0.015;

  const setTarget = (target: { intensity?: number; windX?: number; windZ?: number }) => {
    if (target.intensity !== undefined && Number.isFinite(target.intensity)) {
      state.targetIntensity = clamp01(target.intensity);
    }
    if (target.windX !== undefined && Number.isFinite(target.windX)) {
      state.targetWindX = clampRange(target.windX, -25, 25);
    }
    if (target.windZ !== undefined && Number.isFinite(target.windZ)) {
      state.targetWindZ = clampRange(target.windZ, -25, 25);
    }
  };

  const setIntensity = (intensity: number) => {
    setTarget({ intensity });
  };

  const setWind = (windX: number, windZ: number) => {
    setTarget({ windX, windZ });
  };

  const update = (params: GpuRainUpdateParams): RainControllerState => {
    const safeDt = clampRange(Number.isFinite(params.dt) ? params.dt : 0, 0, 0.15);
    if (params.immediate) {
      state.intensity = state.targetIntensity;
      state.windX = state.targetWindX;
      state.windZ = state.targetWindZ;
    } else if (safeDt > 0) {
      const intensityAlpha = 1 - Math.exp(-safeDt * 6.5);
      const windAlpha = 1 - Math.exp(-safeDt * 4.5);
      state.intensity = lerpScalar(state.intensity, state.targetIntensity, intensityAlpha);
      state.windX = lerpScalar(state.windX, state.targetWindX, windAlpha);
      state.windZ = lerpScalar(state.windZ, state.targetWindZ, windAlpha);
    }

    const spanXZ = Math.max(24, params.spanXZ ?? baseSpanXZ);
    const spanY = Math.max(16, params.spanY ?? baseSpanY);

    material.uniforms.uTime.value = params.timeSec;
    material.uniforms.uCenter.value.set(params.centerX, params.centerY, params.centerZ);
    material.uniforms.uBoxSize.value.set(spanXZ, spanY, spanXZ);
    material.uniforms.uWind.value.set(state.windX, state.windZ);
    material.uniforms.uIntensity.value = state.intensity;
    material.uniforms.uMinGroundY.value = params.minGroundY ?? -0.25;
    if (params.viewportHeightPx !== undefined && params.viewportHeightPx > 0) {
      material.uniforms.uViewportHeight.value = params.viewportHeightPx;
    }
    if (params.pixelRatio !== undefined && params.pixelRatio > 0) {
      material.uniforms.uPixelRatio.value = params.pixelRatio;
    }
    if (params.rainColor) {
      material.uniforms.uRainColor.value.copy(params.rainColor);
    }
    if (params.rainShadowColor) {
      material.uniforms.uRainShadowColor.value.copy(params.rainShadowColor);
    }

    material.uniforms.uSpanXZ.value = spanXZ;
    material.uniforms.uRainIntensity.value = state.intensity;

    return state;
  };

  const dispose = () => {
    geometry.dispose();
    material.dispose();
  };

  return {
    points,
    geometry,
    material,
    particleCount,
    state,
    setTarget,
    setIntensity,
    setWind,
    update,
    dispose,
  };
}
