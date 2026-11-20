import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  SALON_EXTERIOR_DOOR_TRIGGER,
  SALON_INTERIOR_BOUNDS,
  SALON_INTERIOR_COLLIDERS,
  SALON_INTERIOR_SEAT_SPOTS,
  SALON_ORIGIN_Y,
  SALON_STATION_TARGETS,
  clampSalonInteriorPosition,
  computeSalonOrbitCameraPose,
  computeSalonSeatStandUpPosition,
  resolveNearestSalonPromptOrSeat,
  resolveSalonInteriorFloorY,
} from './buddiesBeautySalonRules';
import { buildBeautySalonInterior } from './buddiesBeautySalonInteriorBuilder';
import { LIGHTING_HYGIENE_LIMITS } from './buddiesHubRenderOptimizer';
import { getCentralParkObstacles } from './buddiesCentralParkRules';
import { isFlatIndoorZoneKey } from './buddiesRemotePresenceSync';
import { classifyFootstepSurface } from './buddiesAmbientAudioRules';

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
      createImageData: (w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      }),
      getImageData: (_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      }),
      measureText: () => ({ width: 24 }),
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

test('Beauty Salon exterior door threshold sits clear on North Promenade & zone/audio rules stay consistent', () => {
  assert.equal(SALON_ORIGIN_Y, 355.0);
  assert.equal(isFlatIndoorZoneKey('salon:beauty_glow'), true);
  assert.equal(classifyFootstepSurface(0, 0, 'salon_interior'), 'stone_road');

  const salonObb = getCentralParkObstacles().find((o) => o.id === 'urban_plaza_beauty_salon');
  assert.ok(salonObb, 'Expected exterior Beauty Salon OBB obstacle');
  // Entrance threshold (z = 9.55, exitSpawnZ = 9.35) sits strictly North of exterior front face (z = 10.40)
  assert.ok(SALON_EXTERIOR_DOOR_TRIGGER.z < salonObb.z - salonObb.halfZ);
  assert.ok(SALON_EXTERIOR_DOOR_TRIGGER.exitSpawnZ < salonObb.z - salonObb.halfZ);
});

test('Beauty Salon 2-story U-turn staircase climbs continuously 1F (0.0m) -> Landing (1.5m) -> 2F (3.0m) and back down', () => {
  // Ground floor start outside stair mouth
  let y = 0.0;
  y = resolveSalonInteriorFloorY(-0.4, -2.52, y);
  assert.equal(y, 0.0);

  // Ascend Lower Flight (-0.85 -> -3.25 @ z = -2.52)
  const lowerSamples = [-0.85, -1.45, -2.05, -2.65, -3.25];
  let prevSampleY = -1;
  for (const sx of lowerSamples) {
    const res = clampSalonInteriorPosition(sx, -2.52, y);
    assert.ok(res.floorY >= prevSampleY - 1e-6, `Expected monotonic climb on Lower Flight at x=${sx}`);
    prevSampleY = res.floorY;
    y = res.floorY;
  }
  assert.ok(Math.abs(y - SALON_INTERIOR_BOUNDS.midLandingY) < 1e-4, `Expected midLandingY=1.50, got ${y}`);

  // Turn North onto Mid-Landing (-3.95, -2.52 -> -4.38)
  const midTurn = clampSalonInteriorPosition(-3.95, -4.38, y);
  assert.equal(midTurn.floorY, 1.5);
  y = midTurn.floorY;

  // Ascend Upper Flight (-3.25 -> -0.85 @ z = -4.38)
  const upperSamples = [-3.25, -2.65, -2.05, -1.45, -0.85];
  for (const sx of upperSamples) {
    const res = clampSalonInteriorPosition(sx, -4.38, y);
    assert.ok(res.floorY >= y - 1e-6, `Expected monotonic climb on Upper Flight at x=${sx}`);
    y = res.floorY;
  }
  assert.ok(Math.abs(y - SALON_INTERIOR_BOUNDS.secondFloorY) < 1e-4, `Expected secondFloorY=3.00, got ${y}`);

  // Walk onto 2F Spa Suite & Consultation Lounge; verify cannot walk past interior glass balustrade over void
  const spaPos = clampSalonInteriorPosition(1.45, -2.20, y);
  assert.equal(spaPos.floorY, 3.0);

  const balustradeGuard = clampSalonInteriorPosition(1.0, 1.8, y);
  assert.ok(
    balustradeGuard.z <= SALON_INTERIOR_BOUNDS.mezzanineRear.maxZ + 0.01 ||
      balustradeGuard.x >= SALON_INTERIOR_BOUNDS.mezzanineFrontWing.minX,
    `Player walked off 2F mezzanine void guard to (${balustradeGuard.x}, ${balustradeGuard.z})`,
  );

  // Descend back down Upper Flight (-1.2 -> -3.25 @ z = -4.38)
  let descY = 3.0;
  for (const sx of [-1.2, -1.9, -2.6, -3.25]) {
    const res = clampSalonInteriorPosition(sx, -4.38, descY);
    assert.ok(res.floorY <= descY + 1e-6, `Expected monotonic descent at x=${sx}`);
    descY = res.floorY;
  }
  assert.ok(Math.abs(descY - 1.5) < 1e-4);
});

test('Curved Front-Left storefront clamps avatars smoothly & floor-isolated seating/exit prompts resolve cleanly', () => {
  // Attempt to walk outside the curved corner at (-6.0, +5.0)
  const curved = clampSalonInteriorPosition(-6.0, 5.0, 0.0);
  const radial = Math.hypot(
    curved.x - SALON_INTERIOR_BOUNDS.curveCenterX,
    curved.z - SALON_INTERIOR_BOUNDS.curveCenterZ,
  );
  assert.ok(
    radial <= SALON_INTERIOR_BOUNDS.curveRadius - SALON_INTERIOR_BOUNDS.wallMargin + 1e-4,
    `Expected curved corner clamp <= ${(SALON_INTERIOR_BOUNDS.curveRadius - SALON_INTERIOR_BOUNDS.wallMargin).toFixed(2)}, got ${radial.toFixed(3)}`,
  );

  // Near 1F Exit Door
  const exitPrompt = resolveNearestSalonPromptOrSeat(
    SALON_STATION_TARGETS.exitDoor.x - 0.5,
    SALON_STATION_TARGETS.exitDoor.z,
    0.0,
  );
  assert.equal(exitPrompt.target, 'station');
  assert.equal(exitPrompt.stationKind, 'exit_door');

  // Same XY on 2F does not trigger 1F exit door or 1F vanities!
  const upperCheck = resolveNearestSalonPromptOrSeat(2.75, -3.72, 3.0);
  assert.notEqual(upperCheck.stationKind, 'exit_door');
  if (upperCheck.seatSpot) {
    assert.equal(upperCheck.seatSpot.floorLevel, '2f');
  }

  // Stand-up positions for all 6 seats remain within walkable floor level & clear of seat OBBs
  assert.equal(SALON_INTERIOR_SEAT_SPOTS.length, 6);
  for (const spot of SALON_INTERIOR_SEAT_SPOTS) {
    const up = computeSalonSeatStandUpPosition(spot);
    assert.equal(up.floorY, spot.floorY);
    assert.ok(Math.hypot(up.x - spot.x, up.z - spot.z) >= 0.5);
  }

  assert.ok(SALON_INTERIOR_COLLIDERS.some((c) => c.id === 'salon_1f_reception_front' && c.floorLevel === '1f'));
  assert.ok(SALON_INTERIOR_COLLIDERS.some((c) => c.id === 'salon_2f_spa_bed' && c.floorLevel === '2f'));
});

test('computeSalonOrbitCameraPose frames both 1F showroom and 2F mezzanine without wall clipping', () => {
  const pose1f = computeSalonOrbitCameraPose({
    originY: SALON_ORIGIN_Y,
    anchorX: SALON_INTERIOR_BOUNDS.spawnX,
    anchorZ: SALON_INTERIOR_BOUNDS.spawnZ,
    floorY: 0,
    yaw: 0.62,
    pitch: 0.48,
    dist: 6.4,
  });
  assert.ok(pose1f.camY > SALON_ORIGIN_Y + 1.5);
  assert.ok(pose1f.camX >= SALON_INTERIOR_BOUNDS.minX + 0.45);
  assert.ok(pose1f.camZ >= SALON_INTERIOR_BOUNDS.minZ + 0.45);

  const pose2f = computeSalonOrbitCameraPose({
    originY: SALON_ORIGIN_Y,
    anchorX: 1.45,
    anchorZ: -2.65,
    floorY: SALON_INTERIOR_BOUNDS.secondFloorY,
    yaw: 0.62,
    pitch: 0.48,
    dist: 6.4,
  });
  assert.ok(pose2f.lookY >= SALON_ORIGIN_Y + 3.8);
  assert.ok(pose2f.camY > pose1f.camY + 2.0);
});

test('buildBeautySalonInterior constructs finite 3D meshes, <=2 PointLights, 0 SpotLights, and disposes cleanly', () => {
  const salon = withMockDocumentCanvas(() => buildBeautySalonInterior());
  let meshCount = 0;
  const pointLights: THREE.PointLight[] = [];
  const spotLights: THREE.SpotLight[] = [];

  salon.root.traverse((obj) => {
    if ((obj as THREE.PointLight).isPointLight) pointLights.push(obj as THREE.PointLight);
    if ((obj as THREE.SpotLight).isSpotLight) spotLights.push(obj as THREE.SpotLight);
    if ((obj as THREE.Mesh).isMesh) {
      meshCount++;
      const mesh = obj as THREE.Mesh;
      const pos = mesh.geometry?.getAttribute('position');
      if (pos) {
        for (let i = 0; i < pos.count; i++) {
          assert.ok(Number.isFinite(pos.getX(i)), `Non-finite X vertex in ${mesh.name}`);
          assert.ok(Number.isFinite(pos.getY(i)), `Non-finite Y vertex in ${mesh.name}`);
          assert.ok(Number.isFinite(pos.getZ(i)), `Non-finite Z vertex in ${mesh.name}`);
        }
      }
    }
  });

  assert.ok(meshCount >= 20, `Expected rich Beauty Salon interior mesh hierarchy, got ${meshCount}`);
  assert.equal(spotLights.length, 0);
  assert.ok(
    pointLights.length <= LIGHTING_HYGIENE_LIMITS.maxSalonInteriorPointLights,
    `Expected <= ${LIGHTING_HYGIENE_LIMITS.maxSalonInteriorPointLights} PointLights, got ${pointLights.length}`,
  );
  for (const pt of pointLights) {
    assert.equal(pt.castShadow, false);
    assert.ok(pt.decay >= 1.2 && pt.decay <= 1.8);
  }

  salon.updateVisuals(1.25, 'exit_door', 0.0);
  salon.updateVisuals(2.50, null, 3.0);
  salon.dispose();
});
