import {
  clamp,
  lerp,
  PooledSlot,
  FixedObjectPool,
  createFixedObjectPool,
} from './buddiesBlitzRules';

/**
 * Single keyframe on a normalized particle lifetime curve (`t` in `[0, 1]`).
 */
export interface CurveKeyframe {
  /** Normalized particle age `t = age / lifetime` clamped to `[0, 1]` */
  t: number;
  /** Output value at normalized age `t` */
  value: number;
}

/**
 * Tunable configuration for a single fixed-pool particle emitter.
 */
export interface ParticleEmitterConfig {
  /** Fixed number of particle slots preallocated up front in the pool */
  poolCapacity: number;
  /** Continuous emission rate in particles per second (`>= 0`) */
  emissionRate: number;
  /** Particle lifetime range `[minLifetimeSec, maxLifetimeSec]` */
  lifetimeRange: [number, number];
  /** Normalized/base 3D emission direction vector */
  direction: { x: number; y: number; z: number };
  /** Cone half-angle spread around `direction` in radians (`0` = laser line, `Math.PI` = omnidirectional sphere) */
  directionSpreadRad: number;
  /** Initial speed range `[minSpeed, maxSpeed]` in world units/sec */
  speedRange: [number, number];
  /** 3D gravity acceleration vector in world units/sec² (e.g. `{ x: 0, y: -9.8, z: 0 }`) */
  gravity: { x: number; y: number; z: number };
  /** Linear/exponential air drag damping coefficient (`1/sec`, `>= 0`) */
  drag: number;
  /** Particle size curve evaluated over normalized life `t ∈ [0, 1]` */
  sizeCurve: readonly CurveKeyframe[];
  /** Particle opacity curve (`0..1`) evaluated over normalized life `t ∈ [0, 1]` */
  opacityCurve: readonly CurveKeyframe[];
  /** Emitter world-space origin `{ x, y, z }` */
  origin: { x: number; y: number; z: number };
  /** Optional start color hex (`0xrrggbb`) at `t = 0` */
  colorStartHex: number;
  /** Optional end color hex (`0xrrggbb`) at `t = 1` */
  colorEndHex: number;
}

/**
 * Preallocated particle slot managed by `createFixedObjectPool`.
 */
export interface PooledParticleSlot extends PooledSlot {
  readonly id: number;
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  lifetime: number;
  normalizedAge: number;
  size: number;
  opacity: number;
  colorHex: number;
}

export interface ParticleStepSummary {
  spawnedThisStep: number;
  expiredThisStep: number;
  activeCount: number;
}

export interface PooledParticleEmitter {
  readonly pool: FixedObjectPool<PooledParticleSlot>;
  getConfig(): ParticleEmitterConfig;
  setConfig(patch: Partial<Omit<ParticleEmitterConfig, 'poolCapacity'>>): ParticleEmitterConfig;
  setOrigin(x: number, y: number, z: number): void;
  emitOne(
    overrideOrigin?: { x: number; y: number; z: number },
    overrideDirection?: { x: number; y: number; z: number },
  ): PooledParticleSlot | null;
  emitBurst(
    count: number,
    overrideOrigin?: { x: number; y: number; z: number },
    overrideDirection?: { x: number; y: number; z: number },
  ): number;
  step(dt: number): ParticleStepSummary;
  reset(): void;
}

export const DEFAULT_PARTICLE_POOL_CAPACITY = 128;

/**
 * Helper to build a 3-point curve (`t = 0`, `t = midT`, `t = 1`) for size or opacity over a particle's life.
 */
export function createThreePointCurve(
  startValue: number,
  midValue: number,
  endValue: number,
  midT = 0.35,
): CurveKeyframe[] {
  const clampedMidT = clamp(midT, 0.05, 0.95);
  return [
    { t: 0, value: startValue },
    { t: clampedMidT, value: midValue },
    { t: 1, value: endValue },
  ];
}

export const DEFAULT_PARTICLE_EMITTER_CONFIG: ParticleEmitterConfig = {
  poolCapacity: DEFAULT_PARTICLE_POOL_CAPACITY,
  emissionRate: 28,
  lifetimeRange: [0.65, 1.45],
  direction: { x: 0, y: 1, z: 0 },
  directionSpreadRad: (32 * Math.PI) / 180,
  speedRange: [4.5, 9.5],
  gravity: { x: 0, y: -9.8, z: 0 },
  drag: 1.25,
  sizeCurve: [
    { t: 0, value: 0.35 },
    { t: 0.3, value: 0.95 },
    { t: 1, value: 0.12 },
  ],
  opacityCurve: [
    { t: 0, value: 0.95 },
    { t: 0.25, value: 1.0 },
    { t: 0.75, value: 0.65 },
    { t: 1, value: 0.0 },
  ],
  origin: { x: 0, y: 1.8, z: -12 },
  colorStartHex: 0xb8ff3c,
  colorEndHex: 0x00d2ff,
};

/**
 * Evaluates a piecewise-linear curve over normalized particle lifetime `t ∈ [0, 1]`.
 */
export function evaluateParticleCurve(
  curve: readonly CurveKeyframe[],
  normalizedAge: number,
): number {
  if (!curve || curve.length === 0) return 1;
  const t = clamp(normalizedAge, 0, 1);
  if (curve.length === 1) return curve[0].value;

  if (t <= curve[0].t) return curve[0].value;
  const last = curve[curve.length - 1];
  if (t >= last.t) return last.value;

  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i];
    const b = curve[i + 1];
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t;
      if (span <= 1e-6) return b.value;
      const alpha = (t - a.t) / span;
      return lerp(a.value, b.value, alpha);
    }
  }
  return last.value;
}

/**
 * Interpolates two 24-bit RGB hex colors (`0xrrggbb`) at normalized factor `t ∈ [0, 1]`.
 */
export function lerpColorHex(startHex: number, endHex: number, t: number): number {
  const f = clamp(t, 0, 1);
  const r1 = (startHex >> 16) & 0xff;
  const g1 = (startHex >> 8) & 0xff;
  const b1 = startHex & 0xff;

  const r2 = (endHex >> 16) & 0xff;
  const g2 = (endHex >> 8) & 0xff;
  const b2 = endHex & 0xff;

  const r = Math.round(lerp(r1, r2, f));
  const g = Math.round(lerp(g1, g2, f));
  const b = Math.round(lerp(b1, b2, f));
  return (r << 16) | (g << 8) | b;
}

/**
 * Normalizes a 3D vector, falling back to `{ x: 0, y: 1, z: 0 }` if near-zero length.
 */
export function normalizeDirection3D(dir: { x: number; y: number; z: number }): {
  x: number;
  y: number;
  z: number;
} {
  const len = Math.hypot(dir.x, dir.y, dir.z);
  if (len <= 1e-6) {
    return { x: 0, y: 1, z: 0 };
  }
  return {
    x: dir.x / len,
    y: dir.y / len,
    z: dir.z / len,
  };
}

/**
 * Samples a unit 3D direction vector uniformly inside a cone of half-angle `spreadRad` (`[0, Math.PI]`)
 * around `baseDirection`, using two random numbers `u1, u2 ∈ [0, 1)`.
 */
export function sampleDirectionInCone3D(
  baseDirection: { x: number; y: number; z: number },
  spreadRad: number,
  u1: number,
  u2: number,
): { x: number; y: number; z: number } {
  const axis = normalizeDirection3D(baseDirection);
  const clampedSpread = clamp(spreadRad, 0, Math.PI);
  if (clampedSpread <= 1e-6) {
    return axis;
  }

  const cosMax = Math.cos(clampedSpread);
  const cosTheta = 1 - clamp(u1, 0, 1) * (1 - cosMax);
  const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
  const phi = clamp(u2, 0, 1) * Math.PI * 2;

  // Construct an orthonormal basis (tx, ty, tz) and (bx, by, bz) perpendicular to `axis`
  const refX = Math.abs(axis.y) < 0.99 ? 0 : 1;
  const refY = Math.abs(axis.y) < 0.99 ? 1 : 0;
  const refZ = 0;

  let tx = refY * axis.z - refZ * axis.y;
  let ty = refZ * axis.x - refX * axis.z;
  let tz = refX * axis.y - refY * axis.x;
  const tLen = Math.hypot(tx, ty, tz) || 1;
  tx /= tLen;
  ty /= tLen;
  tz /= tLen;

  const bx = axis.y * tz - axis.z * ty;
  const by = axis.z * tx - axis.x * tz;
  const bz = axis.x * ty - axis.y * tx;

  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const dx = axis.x * cosTheta + (tx * cosPhi + bx * sinPhi) * sinTheta;
  const dy = axis.y * cosTheta + (ty * cosPhi + by * sinPhi) * sinTheta;
  const dz = axis.z * cosTheta + (tz * cosPhi + bz * sinPhi) * sinTheta;

  return normalizeDirection3D({ x: dx, y: dy, z: dz });
}

function sanitizeCurve(curve: readonly CurveKeyframe[], fallback: readonly CurveKeyframe[]): CurveKeyframe[] {
  if (!curve || curve.length === 0) {
    return fallback.map((pt) => ({ t: clamp(pt.t, 0, 1), value: pt.value }));
  }
  return [...curve]
    .map((pt) => ({ t: clamp(Number.isFinite(pt.t) ? pt.t : 0, 0, 1), value: Number.isFinite(pt.value) ? pt.value : 0 }))
    .sort((a, b) => a.t - b.t);
}

function sanitizeEmitterConfig(
  raw: Partial<ParticleEmitterConfig>,
  base: ParticleEmitterConfig = DEFAULT_PARTICLE_EMITTER_CONFIG,
): ParticleEmitterConfig {
  const poolCapacity = Math.max(1, Math.floor(raw.poolCapacity ?? base.poolCapacity));
  const emissionRate = Math.max(0, Number.isFinite(raw.emissionRate) ? raw.emissionRate! : base.emissionRate);

  const rawLifeMin = raw.lifetimeRange ? raw.lifetimeRange[0] : base.lifetimeRange[0];
  const rawLifeMax = raw.lifetimeRange ? raw.lifetimeRange[1] : base.lifetimeRange[1];
  const minLife = Math.max(0.02, Math.min(rawLifeMin, rawLifeMax));
  const maxLife = Math.max(minLife, Math.max(rawLifeMin, rawLifeMax));

  const rawSpdMin = raw.speedRange ? raw.speedRange[0] : base.speedRange[0];
  const rawSpdMax = raw.speedRange ? raw.speedRange[1] : base.speedRange[1];
  const minSpd = Math.max(0, Math.min(rawSpdMin, rawSpdMax));
  const maxSpd = Math.max(minSpd, Math.max(rawSpdMin, rawSpdMax));

  const direction = normalizeDirection3D(raw.direction ?? base.direction);
  const directionSpreadRad = clamp(
    Number.isFinite(raw.directionSpreadRad) ? raw.directionSpreadRad! : base.directionSpreadRad,
    0,
    Math.PI,
  );

  const gravity = {
    x: Number.isFinite(raw.gravity?.x) ? raw.gravity!.x : base.gravity.x,
    y: Number.isFinite(raw.gravity?.y) ? raw.gravity!.y : base.gravity.y,
    z: Number.isFinite(raw.gravity?.z) ? raw.gravity!.z : base.gravity.z,
  };

  const drag = Math.max(0, Number.isFinite(raw.drag) ? raw.drag! : base.drag);

  const sizeCurve = sanitizeCurve(raw.sizeCurve ?? base.sizeCurve, base.sizeCurve);
  const opacityCurve = sanitizeCurve(raw.opacityCurve ?? base.opacityCurve, base.opacityCurve);

  const origin = {
    x: Number.isFinite(raw.origin?.x) ? raw.origin!.x : base.origin.x,
    y: Number.isFinite(raw.origin?.y) ? raw.origin!.y : base.origin.y,
    z: Number.isFinite(raw.origin?.z) ? raw.origin!.z : base.origin.z,
  };

  const colorStartHex = raw.colorStartHex ?? base.colorStartHex;
  const colorEndHex = raw.colorEndHex ?? base.colorEndHex;

  return {
    poolCapacity,
    emissionRate,
    lifetimeRange: [minLife, maxLife],
    direction,
    directionSpreadRad,
    speedRange: [minSpd, maxSpd],
    gravity,
    drag,
    sizeCurve,
    opacityCurve,
    origin,
    colorStartHex,
    colorEndHex,
  };
}

export interface CreatePooledParticleEmitterOptions {
  config?: Partial<ParticleEmitterConfig>;
  /** Optional custom random number generator returning `[0, 1)` for deterministic unit tests */
  rng?: () => number;
  /** Optional callback invoked when the preallocated pool runs out of slots */
  onWarnExhausted?: (message: string, poolName: string, peakCapacity: number) => void;
}

/**
 * Creates a single particle emitter backed by a fixed preallocated pool (`createFixedObjectPool`).
 * Supports tunable emission rate, lifetime range, direction spread, initial speed range,
 * gravity and drag, and size and opacity curves over each particle's normalized lifetime.
 */
export function createPooledParticleEmitter(
  options: CreatePooledParticleEmitterOptions = {},
): PooledParticleEmitter {
  let config = sanitizeEmitterConfig(options.config ?? {}, DEFAULT_PARTICLE_EMITTER_CONFIG);
  const rng = options.rng ?? Math.random;
  let emissionAccumulator = 0;

  const pool = createFixedObjectPool<PooledParticleSlot>({
    name: 'TunableParticleEmitterPool',
    peakCapacity: config.poolCapacity,
    onWarnExhausted: options.onWarnExhausted,
    createSlot: (index) => ({
      id: index,
      active: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      age: 0,
      lifetime: 1,
      normalizedAge: 0,
      size: 0,
      opacity: 0,
      colorHex: config.colorStartHex,
    }),
    resetSlot: (slot) => {
      slot.x = config.origin.x;
      slot.y = config.origin.y;
      slot.z = config.origin.z;
      slot.vx = 0;
      slot.vy = 0;
      slot.vz = 0;
      slot.age = 0;
      slot.lifetime = config.lifetimeRange[0];
      slot.normalizedAge = 0;
      slot.size = Math.max(0, evaluateParticleCurve(config.sizeCurve, 0));
      slot.opacity = clamp(evaluateParticleCurve(config.opacityCurve, 0), 0, 1);
      slot.colorHex = config.colorStartHex;
    },
    deactivateSlot: (slot) => {
      slot.vx = 0;
      slot.vy = 0;
      slot.vz = 0;
      slot.age = 0;
      slot.normalizedAge = 1;
      slot.size = 0;
      slot.opacity = 0;
    },
  });

  const emitOne = (
    overrideOrigin?: { x: number; y: number; z: number },
    overrideDirection?: { x: number; y: number; z: number },
  ): PooledParticleSlot | null => {
    return pool.acquire((slot) => {
      const origin = overrideOrigin ?? config.origin;
      const baseDir = overrideDirection ? normalizeDirection3D(overrideDirection) : config.direction;

      const lifeT = clamp(rng(), 0, 1);
      const lifetime = lerp(config.lifetimeRange[0], config.lifetimeRange[1], lifeT);

      const dir = sampleDirectionInCone3D(baseDir, config.directionSpreadRad, rng(), rng());
      const speedT = clamp(rng(), 0, 1);
      const speed = lerp(config.speedRange[0], config.speedRange[1], speedT);

      slot.x = origin.x;
      slot.y = origin.y;
      slot.z = origin.z;
      slot.vx = dir.x * speed;
      slot.vy = dir.y * speed;
      slot.vz = dir.z * speed;
      slot.age = 0;
      slot.lifetime = Math.max(0.02, lifetime);
      slot.normalizedAge = 0;
      slot.size = Math.max(0, evaluateParticleCurve(config.sizeCurve, 0));
      slot.opacity = clamp(evaluateParticleCurve(config.opacityCurve, 0), 0, 1);
      slot.colorHex = config.colorStartHex;
    });
  };

  const emitBurst = (
    count: number,
    overrideOrigin?: { x: number; y: number; z: number },
    overrideDirection?: { x: number; y: number; z: number },
  ): number => {
    const target = Math.max(0, Math.floor(count));
    let spawned = 0;
    for (let i = 0; i < target; i++) {
      const p = emitOne(overrideOrigin, overrideDirection);
      if (!p) break;
      spawned++;
    }
    return spawned;
  };

  const step = (dt: number): ParticleStepSummary => {
    const safeDt = Math.max(0, Math.min(dt, 0.25));
    let expiredThisStep = 0;
    let spawnedThisStep = 0;

    // 1. Advance existing active particles in the preallocated pool
    const dragFactor = Math.exp(-Math.max(0, config.drag) * safeDt);
    const slots = pool.slots;
    for (let i = 0; i < slots.length; i++) {
      const p = slots[i];
      if (!p.active) continue;

      p.age += safeDt;
      if (p.age >= p.lifetime) {
        pool.release(p);
        expiredThisStep++;
        continue;
      }

      // Apply gravity acceleration then air drag damping
      p.vx = (p.vx + config.gravity.x * safeDt) * dragFactor;
      p.vy = (p.vy + config.gravity.y * safeDt) * dragFactor;
      p.vz = (p.vz + config.gravity.z * safeDt) * dragFactor;

      // Integrate world position
      p.x += p.vx * safeDt;
      p.y += p.vy * safeDt;
      p.z += p.vz * safeDt;

      // Evaluate normalized life curves (`sizeCurve` and `opacityCurve`)
      const normAge = clamp(p.age / p.lifetime, 0, 1);
      p.normalizedAge = normAge;
      p.size = Math.max(0, evaluateParticleCurve(config.sizeCurve, normAge));
      p.opacity = clamp(evaluateParticleCurve(config.opacityCurve, normAge), 0, 1);
      p.colorHex = lerpColorHex(config.colorStartHex, config.colorEndHex, normAge);
    }

    // 2. Spawn new particles from the fixed pool according to tunable `emissionRate`
    if (config.emissionRate > 0 && safeDt > 0) {
      emissionAccumulator += safeDt * config.emissionRate;
      const toEmit = Math.floor(emissionAccumulator);
      if (toEmit > 0) {
        emissionAccumulator -= toEmit;
        for (let i = 0; i < toEmit; i++) {
          const spawned = emitOne();
          if (!spawned) break;
          spawnedThisStep++;
        }
      }
    }

    return {
      spawnedThisStep,
      expiredThisStep,
      activeCount: pool.activeCount,
    };
  };

  return {
    pool,
    getConfig(): ParticleEmitterConfig {
      return {
        ...config,
        lifetimeRange: [...config.lifetimeRange] as [number, number],
        direction: { ...config.direction },
        speedRange: [...config.speedRange] as [number, number],
        gravity: { ...config.gravity },
        sizeCurve: config.sizeCurve.map((pt) => ({ ...pt })),
        opacityCurve: config.opacityCurve.map((pt) => ({ ...pt })),
        origin: { ...config.origin },
      };
    },
    setConfig(patch: Partial<Omit<ParticleEmitterConfig, 'poolCapacity'>>): ParticleEmitterConfig {
      config = sanitizeEmitterConfig({ ...config, ...patch, poolCapacity: config.poolCapacity }, config);
      return this.getConfig();
    },
    setOrigin(x: number, y: number, z: number): void {
      config.origin.x = x;
      config.origin.y = y;
      config.origin.z = z;
    },
    emitOne,
    emitBurst,
    step,
    reset(): void {
      emissionAccumulator = 0;
      pool.releaseAll();
    },
  };
}
