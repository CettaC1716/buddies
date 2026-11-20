import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { buildBotanicalGlasshouseCafeInterior } from './buddiesCafeInteriorBuilder';
import { CENTRAL_PARK_LAMPPOSTS } from './buddiesCentralParkRules';
import { CITY_LAMP_MANIFEST } from './buddiesCityLightingAndTrafficRules';
import { FixedPointLightPool, LIGHTING_HYGIENE_LIMITS } from './buddiesHubRenderOptimizer';
import {
  POINT_LIGHT_AUDIT_SPECS,
  PROXIMITY_LIGHT_POOL_DEFAULTS,
  ProximityPointLightManager,
  buildAuditedOutdoorLightManifest,
  computeOffsetBelowCapY,
  computeProximityCameraFocus,
  computeSmoothCubicDistanceFade,
  evaluateProximityOutdoorDrive,
} from './buddiesProximityLightManager';

test('audited PointLight & SpotLight specs enforce downward cap clearance, zero SpotLights, and physical decay', () => {
  assert.equal(POINT_LIGHT_AUDIT_SPECS.spotLightCountInCodebase, 0);

  // Downward offset helper clamps strictly within [-0.35, -0.22] below opaque cap bottom
  assert.equal(computeOffsetBelowCapY(5.0, 0.14), 4.78); // -0.22m
  assert.equal(computeOffsetBelowCapY(6.35, 0.72), 6.0); // -0.35m

  const manifest = buildAuditedOutdoorLightManifest();
  assert.ok(manifest.length >= CITY_LAMP_MANIFEST.length + CENTRAL_PARK_LAMPPOSTS.length + 10);

  const ids = new Set<string>();
  for (const anchor of manifest) {
    assert.ok(!ids.has(anchor.id), `Duplicate light anchor id: ${anchor.id}`);
    ids.add(anchor.id);

    assert.ok(
      anchor.capOffsetY >= -0.35 && anchor.capOffsetY <= -0.22,
      `capOffsetY out of [-0.35, -0.22] for ${anchor.id}: ${anchor.capOffsetY}`,
    );
    assert.ok(anchor.y > anchor.groundY, `Light origin must sit above ground for ${anchor.id}`);
    assert.ok(anchor.baseIntensity > 0 && anchor.baseIntensity <= 3.5);
    assert.ok(anchor.distance >= 6.0 && anchor.distance <= 20.0);
    assert.ok(anchor.decay >= 1.2 && anchor.decay <= 2.0);
  }

  // Verify coverage of Central Park, Urban Plaza, Casino entrance, Arcade, and Glasshouse Cafe
  assert.ok(manifest.some((a) => a.id === 'central_park_lamp_west_nw'));
  assert.ok(manifest.some((a) => a.id === 'urban_plaza_boutique_front'));
  assert.ok(manifest.some((a) => a.id === 'urban_plaza_cozy_cafe_west'));
  assert.ok(manifest.some((a) => a.id === 'urban_plaza_fountain_pool'));
  assert.ok(manifest.some((a) => a.id === 'casino_porte_cochere_chandelier'));
  assert.ok(manifest.some((a) => a.id === 'arcade_storefront_fashion'));
  assert.ok(manifest.some((a) => a.id === 'arcade_storefront_realestate'));
  assert.ok(manifest.some((a) => a.id === 'arcade_storefront_scooter'));
  assert.ok(manifest.some((a) => a.id === 'municipal_hall_portico'));
  assert.ok(manifest.some((a) => a.id === 'glasshouse_cafe_exterior_porch'));
});

function withMockDocumentCanvas<T>(fn: () => T): T {
  const prevDoc = (globalThis as { document?: unknown }).document;
  if (prevDoc !== undefined) return fn();
  const noopGrad = { addColorStop: () => {} };
  const ctxProxy = new Proxy(
    {
      fillStyle: '#000',
      strokeStyle: '#000',
      lineWidth: 1,
      font: '12px sans-serif',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      globalAlpha: 1,
      createLinearGradient: () => noopGrad,
      createRadialGradient: () => noopGrad,
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      getImageData: (_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      }),
      measureText: () => ({ width: 20 }),
    },
    {
      get(target, prop) {
        if (prop in target) return (target as Record<PropertyKey, unknown>)[prop];
        return () => {};
      },
    },
  );
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({ width: 256, height: 256, getContext: () => ctxProxy }),
  };
  try {
    return fn();
  } finally {
    delete (globalThis as { document?: unknown }).document;
  }
}

test('Cafe interior PointLights sit cleanly below brass pendant shades & eaves with explicit decay', () => {
  const cafe = withMockDocumentCanvas(() => buildBotanicalGlasshouseCafeInterior());
  const pointLights: THREE.PointLight[] = [];
  const spotLights: THREE.SpotLight[] = [];

  cafe.root.traverse((obj) => {
    if ((obj as THREE.PointLight).isPointLight) pointLights.push(obj as THREE.PointLight);
    if ((obj as THREE.SpotLight).isSpotLight) spotLights.push(obj as THREE.SpotLight);
  });

  assert.equal(spotLights.length, 0);
  assert.equal(pointLights.length, LIGHTING_HYGIENE_LIMITS.maxCafeInteriorPointLights);

  const counterPt = pointLights.find((pt) => pt.position.z < 0);
  const wingPt = pointLights.find((pt) => pt.position.z > 0);
  assert.ok(counterPt, 'Expected counter warm PointLight');
  assert.ok(wingPt, 'Expected L-wing warm PointLight');

  // Brass pendant dome shade rim sits at ~2.34m; counter light sits cleanly below it
  assert.ok(counterPt.position.y <= 2.20, `Counter light ${counterPt.position.y} must clear pendant shades`);
  assert.ok(counterPt.position.y >= 1.85);
  assert.ok(wingPt.position.y <= 3.0, `Wing light ${wingPt.position.y} must clear eaves/botanicals`);
  assert.equal(counterPt.castShadow, false);
  assert.equal(wingPt.castShadow, false);
  assert.ok(counterPt.decay >= 1.2 && counterPt.decay <= 1.8);
  assert.ok(wingPt.decay >= 1.2 && wingPt.decay <= 1.8);

  cafe.dispose();
});

test('smooth cubic distance fadeout and daytime/dusk/night/storm modulation have zero sharp cutoffs', () => {
  const fadeStart = 26.88;
  const cutoff = 42.0;

  assert.equal(computeSmoothCubicDistanceFade(0, fadeStart, cutoff), 1);
  assert.equal(computeSmoothCubicDistanceFade(fadeStart, fadeStart, cutoff), 1);
  assert.equal(computeSmoothCubicDistanceFade(cutoff, fadeStart, cutoff), 0);
  assert.equal(computeSmoothCubicDistanceFade(cutoff + 10, fadeStart, cutoff), 0);

  // Strictly monotonic smooth cubic rolloff
  const samples = [27, 30, 34, 38, 41].map((d) =>
    computeSmoothCubicDistanceFade(d, fadeStart, cutoff),
  );
  for (let i = 1; i < samples.length; i++) {
    assert.ok(samples[i] < samples[i - 1], 'Fade curve must decrease monotonically');
  }
  const midFade = computeSmoothCubicDistanceFade((fadeStart + cutoff) * 0.5, fadeStart, cutoff);
  assert.ok(Math.abs(midFade - 0.5) < 1e-4);

  // Clear daytime (nightFactor01 <= 0.05) stays cleanly off (0)
  const day = evaluateProximityOutdoorDrive(
    { phase: 'day', nightFactor01: 0.03, duskDawnFactor01: 0, rainFactor01: 0, fogFactor01: 0 },
    'day',
  );
  assert.equal(day.drive01, 0);

  // Dusk, night, and heavy rain ramp up smoothly
  const dusk = evaluateProximityOutdoorDrive(
    { phase: 'dusk', nightFactor01: 0.55, duskDawnFactor01: 0.85, rainFactor01: 0, fogFactor01: 0 },
    'dusk',
  );
  const night = evaluateProximityOutdoorDrive(
    { phase: 'night', nightFactor01: 1.0, duskDawnFactor01: 0.1, rainFactor01: 0, fogFactor01: 0 },
    'night',
  );
  const stormDay = evaluateProximityOutdoorDrive(
    { phase: 'day', nightFactor01: 0, duskDawnFactor01: 0, rainFactor01: 0.92, fogFactor01: 0.3 },
    'day',
  );
  assert.ok(dusk.drive01 > 0.3 && dusk.drive01 < night.drive01);
  assert.ok(night.drive01 >= 0.95);
  assert.ok(stormDay.drive01 >= 0.5);
});

test('ProximityPointLightManager keeps NUM_POINT_LIGHTS constant, smoothly transitions cells, and coordinates with FixedPointLightPool', () => {
  const scene = new THREE.Scene();
  const laserPool = new FixedPointLightPool(scene, 2);
  const manager = new ProximityPointLightManager(scene, {
    poolSize: 4,
    maxCombinedWithLaser: 6,
  });

  const countScenePointLights = (): number => {
    let n = 0;
    scene.traverse((obj) => {
      if ((obj as THREE.PointLight).isPointLight) n++;
    });
    return n;
  };

  assert.equal(manager.lights.length, PROXIMITY_LIGHT_POOL_DEFAULTS.outdoorPoolSize);
  assert.equal(countScenePointLights(), 6);
  for (const pt of manager.lights) {
    assert.equal(pt.castShadow, false);
    assert.equal(pt.intensity, 0);
  }
  assert.ok(manager.groundPoolMesh, 'Expected GPU-instanced supplemental ground light pools');
  assert.equal(manager.groundPoolMesh.visible, false);

  // 1. Daytime update keeps all outdoor PointLights and ground pools cleanly off
  const daySnap = manager.update({
    focusPos: { x: 29.5, y: 2.2, z: 0.0 },
    dt: 0.016,
    timeSec: 1.0,
    weatherEnvState: { phase: 'day', nightFactor01: 0, duskDawnFactor01: 0, rainFactor01: 0, fogFactor01: 0 },
    fallbackPreset: 'day',
    activeAllowed: true,
    activeLaserCount: 0,
  });
  assert.equal(daySnap.activePointLightCount, 0);
  assert.equal(daySnap.groundPoolVisible, false);
  assert.equal(countScenePointLights(), 6);

  // 2. Nighttime in Urban Plaza activates <= 4 nearest plaza/park emitters + ground pools
  const nightWeather = {
    phase: 'night' as const,
    nightFactor01: 1.0,
    duskDawnFactor01: 0.1,
    rainFactor01: 0,
    fogFactor01: 0,
    cityLightsScale: 1.0,
  };
  let prevSnap = manager.update({
    focusPos: { x: 17.5, y: 2.2, z: 0.0 },
    dt: 0.016,
    timeSec: 2.0,
    weatherEnvState: nightWeather,
    fallbackPreset: 'night',
    activeAllowed: true,
    activeLaserCount: 0,
  });
  assert.equal(prevSnap.activePointLightCount, 4);
  assert.equal(prevSnap.groundPoolVisible, true);
  assert.ok(
    prevSnap.slots.some((s) => s.anchorId?.startsWith('urban_plaza_') || s.anchorId?.startsWith('central_park_')),
  );

  // 3. Walk smoothly across Urban Plaza toward Cozy Bites Cafe (zero sudden slot intensity spikes!)
  let maxSingleFrameJump = 0;
  for (let step = 1; step <= 90; step++) {
    const x = 17.5 + (step / 90) * 24.0; // walk 24m east to Cozy Bites Cafe
    const snap = manager.update({
      focusPos: { x, y: 2.2, z: 0.0 },
      dt: 0.016,
      timeSec: 2.0 + step * 0.016,
      weatherEnvState: nightWeather,
      fallbackPreset: 'night',
      activeAllowed: true,
      activeLaserCount: 0,
    });
    for (let i = 0; i < 4; i++) {
      const delta = Math.abs(snap.slots[i].intensity - prevSnap.slots[i].intensity);
      if (delta > maxSingleFrameJump) maxSingleFrameJump = delta;
    }
    assert.equal(countScenePointLights(), 6, 'Scene PointLight count must never change');
    prevSnap = snap;
  }
  assert.ok(
    maxSingleFrameJump < 0.65,
    `Expected smooth intensity ramp across cell traversal, got max jump ${maxSingleFrameJump}`,
  );
  assert.ok(
    prevSnap.slots.some((s) => s.anchorId === 'urban_plaza_cozy_cafe_west'),
    'Expected Cozy Bites Cafe west anchor to win after walking east',
  );

  // 4. Coordinate with active combat lasers (`FixedPointLightPool` uses 2 -> total <= 6)
  laserPool.beginFrame();
  laserPool.submit({ x: 40, y: 1.5, z: 0, colorHex: 0x00f2ff, intensity: 2.2, distance: 6.0 });
  laserPool.submit({ x: 42, y: 1.5, z: 1, colorHex: 0xff3864, intensity: 2.4, distance: 6.0 });
  const activeLasers = laserPool.commitFrame({ x: 41.5, y: 2.2, z: 0 }, true);
  assert.equal(activeLasers, 2);

  const combatSnap = manager.update({
    focusPos: { x: 41.5, y: 2.2, z: 0 },
    dt: 0.016,
    timeSec: 5.0,
    weatherEnvState: nightWeather,
    fallbackPreset: 'night',
    activeAllowed: true,
    activeLaserCount: laserPool.getActiveCount(),
  });
  assert.ok(combatSnap.totalActiveScenePointLights <= 6);
  assert.equal(countScenePointLights(), 6);

  // 5. Indoor room mode zeroes all outdoor slots and hides ground pools with 0 shader recompiles
  const indoorSnap = manager.update({
    focusPos: { x: 41.5, y: 2.2, z: 0 },
    dt: 0.016,
    timeSec: 5.1,
    weatherEnvState: nightWeather,
    fallbackPreset: 'night',
    activeAllowed: false,
    activeLaserCount: 0,
  });
  assert.equal(indoorSnap.activePointLightCount, 0);
  assert.equal(indoorSnap.groundPoolVisible, false);
  assert.equal(countScenePointLights(), 6);

  // 6. Camera focus helper covers gameplay, parkView raycast, and overview altitude
  const focusPlay = computeProximityCameraFocus({
    viewCenterX: 12,
    viewCenterZ: -4,
    cameraPos: { x: 12, y: 13.6, z: 12 },
    activeUnitPos: { x: 12, z: -4 },
    isFullMapOverview: false,
    isParkView: false,
    isShowcaseMode: false,
  });
  assert.ok(Math.abs(focusPlay.x - 12) < 1e-4 && focusPlay.z > -4 && focusPlay.z < 12);

  const focusOverview = computeProximityCameraFocus({
    viewCenterX: 0,
    viewCenterZ: 0,
    cameraPos: { x: 0, y: 145, z: 0 },
    isFullMapOverview: true,
  });
  assert.equal(focusOverview.y, 145);

  manager.dispose();
  assert.equal(countScenePointLights(), 2); // only laserPool's 2 lights remain
});
