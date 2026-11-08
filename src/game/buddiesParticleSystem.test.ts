import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPooledParticleEmitter,
  evaluateParticleCurve,
  createThreePointCurve,
  sampleDirectionInCone3D,
} from './buddiesParticleSystem';

test('evaluateParticleCurve interpolates size and opacity curves across normalized lifetime [0, 1]', () => {
  const sizeCurve = createThreePointCurve(0.2, 1.0, 0.0, 0.5);
  assert.equal(evaluateParticleCurve(sizeCurve, 0), 0.2);
  assert.ok(Math.abs(evaluateParticleCurve(sizeCurve, 0.25) - 0.6) < 1e-6);
  assert.equal(evaluateParticleCurve(sizeCurve, 0.5), 1.0);
  assert.ok(Math.abs(evaluateParticleCurve(sizeCurve, 0.75) - 0.5) < 1e-6);
  assert.equal(evaluateParticleCurve(sizeCurve, 1.0), 0.0);
});

test('sampleDirectionInCone3D respects zero spread and cone half-angle bounds', () => {
  const exact = sampleDirectionInCone3D({ x: 0, y: 1, z: 0 }, 0, 0.7, 0.3);
  assert.ok(Math.abs(exact.x) < 1e-6);
  assert.ok(Math.abs(exact.y - 1) < 1e-6);
  assert.ok(Math.abs(exact.z) < 1e-6);

  const spreadRad = Math.PI / 6; // 30 degrees
  for (let i = 0; i < 20; i++) {
    const u1 = (i + 0.5) / 20;
    const u2 = ((i * 7) % 20) / 20;
    const dir = sampleDirectionInCone3D({ x: 0, y: 1, z: 0 }, spreadRad, u1, u2);
    const len = Math.hypot(dir.x, dir.y, dir.z);
    assert.ok(Math.abs(len - 1) < 1e-5, 'Sampled direction must be unit length');
    const angle = Math.acos(Math.min(1, Math.max(-1, dir.y)));
    assert.ok(angle <= spreadRad + 1e-4, `Sampled cone angle ${angle} exceeds spread ${spreadRad}`);
  }
});

test('createPooledParticleEmitter enforces fixed preallocated pool, emission rate, lifetime/speed ranges, direction spread, gravity/drag, and size/opacity curves', () => {
  let seq = 0;
  const deterministicRng = () => {
    seq = (seq + 1) % 10;
    return seq / 10;
  };

  const warnings: string[] = [];
  const emitter = createPooledParticleEmitter({
    rng: deterministicRng,
    onWarnExhausted: (msg) => warnings.push(msg),
    config: {
      poolCapacity: 8,
      emissionRate: 20, // 20 particles/sec => dt=0.1s spawns 2 particles
      lifetimeRange: [0.5, 1.0],
      direction: { x: 0, y: 1, z: 0 },
      directionSpreadRad: Math.PI / 8,
      speedRange: [4.0, 8.0],
      gravity: { x: 0, y: -10.0, z: 0 },
      drag: 1.5,
      sizeCurve: [
        { t: 0, value: 0.4 },
        { t: 0.5, value: 1.2 },
        { t: 1, value: 0.1 },
      ],
      opacityCurve: [
        { t: 0, value: 1.0 },
        { t: 0.5, value: 0.8 },
        { t: 1, value: 0.0 },
      ],
      origin: { x: 2, y: 3, z: -4 },
    },
  });

  // 1. Preallocated pool capacity is fixed up front
  assert.equal(emitter.pool.capacity, 8);
  assert.equal(emitter.pool.slots.length, 8);
  assert.equal(emitter.pool.activeCount, 0);

  // 2. Step by 0.1s -> emissionRate 20 spawns exactly 2 particles from the pool
  const step1 = emitter.step(0.1);
  assert.equal(step1.spawnedThisStep, 2);
  assert.equal(emitter.pool.activeCount, 2);

  const p0 = emitter.pool.slots[0];
  assert.equal(p0.active, true);
  assert.equal(p0.x, 2);
  assert.equal(p0.y, 3);
  assert.equal(p0.z, -4);
  assert.ok(p0.lifetime >= 0.5 && p0.lifetime <= 1.0);
  const initialSpeed = Math.hypot(p0.vx, p0.vy, p0.vz);
  assert.ok(initialSpeed >= 4.0 - 1e-4 && initialSpeed <= 8.0 + 1e-4);
  assert.ok(Math.abs(p0.size - 0.4) < 1e-5);
  assert.ok(Math.abs(p0.opacity - 1.0) < 1e-5);

  // 3. Step again to verify gravity, drag, and size/opacity curve progression over particle life
  const prevVy = p0.vy;
  emitter.step(0.1);
  assert.equal(emitter.pool.activeCount, 4);
  assert.ok(p0.age > 0);
  assert.ok(p0.vy < prevVy, 'Gravity and drag must reduce upward vy');
  assert.ok(p0.size > 0.4, 'Size curve must grow toward peak at t=0.5');
  assert.ok(p0.opacity < 1.0 && p0.opacity > 0.0, 'Opacity curve must decay over lifetime');

  // 4. Exhaust the 8-slot pool and verify no new slots are allocated and warning is logged
  const burstSpawned = emitter.emitBurst(10);
  assert.equal(burstSpawned, 4); // Only 4 remaining slots in the 8-slot pool
  assert.equal(emitter.pool.activeCount, 8);
  assert.equal(emitter.pool.slots.length, 8);
  assert.ok(warnings.length >= 1);

  // 5. Advance past max lifetime (1.0s) in steps -> all particles expire and return to pool for reuse
  for (let i = 0; i < 6; i++) {
    emitter.setConfig({ emissionRate: 0 });
    emitter.step(0.2);
  }
  assert.equal(emitter.pool.activeCount, 0);

  // 6. Re-emitting reuses the exact same preallocated slot references
  const reused = emitter.emitOne();
  assert.equal(reused, emitter.pool.slots[0]);
  assert.equal(emitter.pool.activeCount, 1);
});
