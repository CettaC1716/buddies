import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TypedEventBus,
  SceneRegistry,
  LazyModuleRegistry,
  createHouseVisitSystem,
  isHouseVisitSolidCollider,
  HOUSE_VISIT_PLAYER_RADIUS,
  type GameEventMap,
} from './index';
import {
  DEFAULT_HOUSE_VISIT_CAMERA_OBSTRUCTION_BOXES,
  HOUSE_VISIT_INDOOR_BOUNDS,
  INDOOR_ORBIT_CAMERA_CONFIG,
} from '../game/buddiesCafeRules';

test('TypedEventBus delivers typed payloads, supports once/unsubscribe, and leaves zero dangling listeners', () => {
  const bus = new TypedEventBus<GameEventMap>();
  const received: string[] = [];

  const unsub = bus.on('scene:mode-changed', (p) => {
    received.push(`${p.previousMode}->${p.nextMode}`);
  });
  bus.once('ui:modal-opened', (p) => {
    received.push(`open:${p.modalId}`);
  });

  bus.emit('scene:mode-changed', { previousMode: 'none', nextMode: 'house_visit' });
  bus.emit('ui:modal-opened', { modalId: 'wardrobe' });
  bus.emit('ui:modal-opened', { modalId: 'casino' }); // should not fire once-handler again

  assert.deepEqual(received, ['none->house_visit', 'open:wardrobe']);
  assert.equal(bus.listenerCount('ui:modal-opened'), 0);

  unsub();
  assert.equal(bus.listenerCount('scene:mode-changed'), 0);
  bus.emit('scene:mode-changed', { previousMode: 'house_visit', nextMode: 'none' });
  assert.equal(received.length, 2);
});

test('SceneRegistry runs clean exit -> enter -> update -> dispose lifecycles', () => {
  const registry = new SceneRegistry();
  const log: string[] = [];

  registry.register({
    id: 'outdoor_city',
    onEnter: (ctx) => log.push(`enter:city(from=${ctx.previousSceneId})`),
    onUpdate: (dt) => log.push(`update:city(${dt})`),
    onExit: (next) => log.push(`exit:city(to=${next})`),
    dispose: () => log.push('dispose:city'),
  });
  registry.register({
    id: 'house_visit',
    onEnter: (ctx) => log.push(`enter:house(from=${ctx.previousSceneId})`),
    onUpdate: (dt) => log.push(`update:house(${dt})`),
    onExit: (next) => log.push(`exit:house(to=${next})`),
    dispose: () => log.push('dispose:house'),
  });

  registry.activate('outdoor_city');
  registry.updateActive(0.016, 1.0);
  registry.activate('house_visit');
  registry.updateActive(0.016, 1.016);
  registry.disposeAll();

  assert.deepEqual(log, [
    'enter:city(from=null)',
    'update:city(0.016)',
    'exit:city(to=house_visit)',
    'enter:house(from=outdoor_city)',
    'update:house(0.016)',
    'exit:house(to=null)',
    'dispose:city',
    'dispose:house',
  ]);
  assert.equal(registry.getActiveId(), null);
});

test('LazyModuleRegistry deduplicates concurrent loads, caches resolved modules, and recovers after transient errors', async () => {
  const registry = new LazyModuleRegistry();
  let calls = 0;

  registry.register('mod:casino', async () => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 5));
    return { ready: true, id: 'casino' };
  });

  const [a, b] = await Promise.all([
    registry.load<{ ready: boolean; id: string }>('mod:casino'),
    registry.load<{ ready: boolean; id: string }>('mod:casino'),
  ]);
  assert.equal(calls, 1);
  assert.strictEqual(a, b);
  assert.equal(registry.hasLoaded('mod:casino'), true);

  // Error recovery: failed attempt should not stick in inflight cache
  let flakyCalls = 0;
  registry.register('mod:flaky', async () => {
    flakyCalls += 1;
    if (flakyCalls === 1) throw new Error('transient network failure');
    return { ok: true };
  });
  await assert.rejects(() => registry.load('mod:flaky'), /transient network failure/);
  const recovered = await registry.load<{ ok: boolean }>('mod:flaky');
  assert.deepEqual(recovered, { ok: true });
  assert.equal(flakyCalls, 2);
});

test('HouseVisitSystem enforces courtyard playable clamping, solid collider classification, grounded floor damping, and instant anti-wall-clipping pull-in', () => {
  const sys = createHouseVisitSystem();
  sys.resetOnEnter(HOUSE_VISIT_INDOOR_BOUNDS.spawnX, HOUSE_VISIT_INDOOR_BOUNDS.spawnZ);

  // 1. Collider classification blocks walls, partitions, courtyard walls, and yard props while ignoring floors
  assert.equal(isHouseVisitSolidCollider({ name: 'Col_Wall_South_L' }), true);
  assert.equal(isHouseVisitSolidCollider({ name: 'Col_Courtyard_S' }), true);
  assert.equal(isHouseVisitSolidCollider({ name: 'Col_Lotus_Pond' }), true);
  assert.equal(isHouseVisitSolidCollider({ name: 'Col_Lantern_Gate' }), true);
  assert.equal(isHouseVisitSolidCollider({ name: 'Col_Floor_House' }), false);
  assert.equal(isHouseVisitSolidCollider({ name: 'Col_Floor_Yard' }), false);

  // 2. Playable bounds clamping keeps player inside courtyard walls
  const pos = { x: -20, z: 20 };
  sys.clampPlayableXZ(pos);
  assert.equal(pos.x, HOUSE_VISIT_INDOOR_BOUNDS.minX + HOUSE_VISIT_PLAYER_RADIUS);
  assert.equal(pos.z, HOUSE_VISIT_INDOOR_BOUNDS.maxZ - HOUSE_VISIT_PLAYER_RADIUS);

  // 3. Exit proximity matches wooden garden gate threshold
  const atSpawn = sys.evaluateExitProximity(
    HOUSE_VISIT_INDOOR_BOUNDS.spawnX,
    HOUSE_VISIT_INDOOR_BOUNDS.spawnZ,
  );
  assert.equal(atSpawn.near, true);
  const insideLiving = sys.evaluateExitProximity(0, 0);
  assert.equal(insideLiving.near, false);

  // 4. Smooth floor transition from courtyard (-0.13..-0.18) up to indoor floor (0.00)
  const initialY = sys.getCurrentFloorY();
  assert.ok(initialY < -0.05);
  for (let i = 0; i < 40; i++) {
    sys.stepFloorY(0, 0, 0.016, true);
  }
  assert.ok(Math.abs(sys.getCurrentFloorY() - 0) < 0.005);

  // 5. Camera instant pull-in on wall obstruction + smooth ease-out when clear (zero heap realloc)
  const cfg = INDOOR_ORBIT_CAMERA_CONFIG.house_visit;
  const blockedPose = sys.resolveDampedCameraPose({
    originY: 145,
    anchorX: 3.0,
    anchorZ: -1.6,
    yaw: -Math.PI * 0.5, // looking East -> camera pulls West against center partition x=0.96
    pitch: cfg.defaultPitch,
    dist: cfg.maxDist,
    dtSec: 0.016,
    obstructionBoxes: DEFAULT_HOUSE_VISIT_CAMERA_OBSTRUCTION_BOXES,
  });
  assert.ok(blockedPose.camX >= 0.96, `Expected camera to stay East of center wall, got ${blockedPose.camX}`);
  const blockedRatio = blockedPose.obstructionRatio;
  assert.ok(blockedRatio < 0.95);

  // Next frame in open courtyard: obstructionRatio eases smoothly outward rather than snapping to 1.0
  const easingPose = sys.resolveDampedCameraPose({
    originY: 145,
    anchorX: 0,
    anchorZ: 5.8,
    yaw: 0,
    pitch: 0.4,
    dist: 2.2,
    dtSec: 0.016,
    obstructionBoxes: DEFAULT_HOUSE_VISIT_CAMERA_OBSTRUCTION_BOXES,
  });
  assert.strictEqual(blockedPose, easingPose, 'Expected reusable scratch camera pose object');
  assert.ok(easingPose.obstructionRatio > blockedRatio && easingPose.obstructionRatio < 1.0);
});
