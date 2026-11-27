import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  SALON_EXTERIOR_DOOR_TRIGGER,
  SALON_EXTERIOR_WALL_THICKNESS,
  SALON_GLB_SCALE,
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
  // Entrance threshold (z = 8.46, exitSpawnZ = 8.26) sits strictly North of the
  // scaled GLB body's front face (obb front = z 9.13, model wall face z 9.35)
  assert.ok(SALON_EXTERIOR_DOOR_TRIGGER.z < salonObb.z - salonObb.halfZ);
  assert.ok(SALON_EXTERIOR_DOOR_TRIGGER.exitSpawnZ < salonObb.z - salonObb.halfZ);
  // The door anchor x is unchanged and the OBB tracks the scaled GLB walls
  assert.equal(SALON_EXTERIOR_DOOR_TRIGGER.doorX, 25.74);
  assert.ok(Math.abs(salonObb.halfX - (4.4 * SALON_GLB_SCALE + 0.2)) < 0.01);
  assert.ok(Math.abs(salonObb.x - 29.54) < 1e-6);
  // Interior floorplan faithfully reflects the GLB exterior: the model's
  // walls span 8.80m with SALON_EXTERIOR_WALL_THICKNESS (0.15m) of wall on
  // every side, leaving the 8.50m terrazzo — scaled into scene units.
  const extWidth = 8.8 * SALON_GLB_SCALE;
  const intWidth = SALON_INTERIOR_BOUNDS.maxX - SALON_INTERIOR_BOUNDS.minX;
  const intDepth = SALON_INTERIOR_BOUNDS.maxZ - SALON_INTERIOR_BOUNDS.minZ;
  assert.ok(
    Math.abs(intWidth - (extWidth - SALON_EXTERIOR_WALL_THICKNESS * 2 * SALON_GLB_SCALE)) < 0.01,
    `Interior width (${intWidth}) must match GLB exterior width (${extWidth}) minus 2x wall thickness, scaled`,
  );
  assert.ok(
    Math.abs(intDepth - (extWidth - SALON_EXTERIOR_WALL_THICKNESS * 2 * SALON_GLB_SCALE)) < 0.01,
    `Interior depth (${intDepth}) must match GLB exterior depth minus 2x wall thickness, scaled`,
  );
});

test('Beauty Salon L-shaped staircase climbs continuously 1F (0.0m) -> Landing (3.09m) -> 2F (4.92m) and back down', () => {
  // Ground floor start outside the flight A mouth (West end of the North wall)
  let y = 0.0;
  y = resolveSalonInteriorFloorY(-1.35, -3.87, y);
  assert.equal(y, 0.0);

  // Ascend Flight A (-1.10 -> +3.29 @ z = -3.87)
  const flightASamples = [-1.1, -0.25, 0.6, 1.45, 2.3, 3.29];
  let prevSampleY = -1;
  for (const sx of flightASamples) {
    const res = clampSalonInteriorPosition(sx, -3.87, y);
    assert.ok(res.floorY >= prevSampleY - 1e-6, `Expected monotonic climb on Flight A at x=${sx}`);
    prevSampleY = res.floorY;
    y = res.floorY;
  }
  assert.ok(Math.abs(y - SALON_INTERIOR_BOUNDS.midLandingY) < 1e-4, `Expected midLandingY=3.09, got ${y}`);

  // Turn East onto the Mid-Landing corner (3.55, -3.87)
  const landing = clampSalonInteriorPosition(3.55, -3.87, y);
  assert.equal(landing.floorY, SALON_INTERIOR_BOUNDS.midLandingY);
  y = landing.floorY;

  // Ascend Flight B (-3.09 -> -1.35 @ x = 3.55)
  const flightBSamples = [-3.09, -2.65, -2.2, -1.75, -1.35];
  for (const sz of flightBSamples) {
    const res = clampSalonInteriorPosition(3.55, sz, y);
    assert.ok(res.floorY >= y - 1e-6, `Expected monotonic climb on Flight B at z=${sz}`);
    y = res.floorY;
  }
  assert.ok(Math.abs(y - SALON_INTERIOR_BOUNDS.secondFloorY) < 1e-4, `Expected secondFloorY=4.92, got ${y}`);

  // Walk onto the 2F mezzanine: stair-arrival strip and the spa suite deck
  const stripPos = clampSalonInteriorPosition(3.55, -0.85, y);
  assert.equal(stripPos.floorY, SALON_INTERIOR_BOUNDS.secondFloorY);
  const spaPos = clampSalonInteriorPosition(-0.45, -2.24, y);
  assert.equal(spaPos.floorY, SALON_INTERIOR_BOUNDS.secondFloorY);

  // The open void over the ground-floor showroom must not be walkable on 2F:
  // clamping pulls the player back onto the deck union, still at 2F height
  const voidGuard = clampSalonInteriorPosition(0.0, 2.5, y);
  assert.equal(voidGuard.floorY, SALON_INTERIOR_BOUNDS.secondFloorY);
  const b = SALON_INTERIOR_BOUNDS;
  const inDeck =
    (voidGuard.x >= b.mezzanineRear.minX - 0.01 &&
      voidGuard.x <= b.mezzanineRear.maxX + 0.01 &&
      voidGuard.z >= b.mezzanineRear.minZ - 0.01 &&
      voidGuard.z <= b.mezzanineRear.maxZ + 0.01) ||
    (voidGuard.x >= b.mezzanineFrontWing.minX - 0.01 &&
      voidGuard.x <= b.mezzanineFrontWing.maxX + 0.01 &&
      voidGuard.z >= b.mezzanineFrontWing.minZ - 0.01 &&
      voidGuard.z <= b.mezzanineFrontWing.maxZ + 0.01) ||
    (voidGuard.x >= b.mezzanineSouthWing.minX - 0.01 &&
      voidGuard.x <= b.mezzanineSouthWing.maxX + 0.01 &&
      voidGuard.z >= b.mezzanineSouthWing.minZ - 0.01 &&
      voidGuard.z <= b.mezzanineSouthWing.maxZ + 0.01) ||
    (voidGuard.x >= b.mezzanineEastStrip.minX - 0.01 &&
      voidGuard.x <= b.mezzanineEastStrip.maxX + 0.01 &&
      voidGuard.z >= b.mezzanineEastStrip.minZ - 0.01 &&
      voidGuard.z <= b.mezzanineEastStrip.maxZ + 0.01);
  assert.ok(inDeck, `Player walked off the 2F mezzanine into the void at (${voidGuard.x}, ${voidGuard.z})`);

  // Descend back down Flight B (-1.60 -> -3.09 @ x = 3.55)
  let descY: number = SALON_INTERIOR_BOUNDS.secondFloorY;
  for (const sz of [-1.6, -2.2, -2.8, -3.09]) {
    const res = clampSalonInteriorPosition(3.55, sz, descY);
    assert.ok(res.floorY <= descY + 1e-6, `Expected monotonic descent at z=${sz}`);
    descY = res.floorY;
  }
  assert.ok(Math.abs(descY - SALON_INTERIOR_BOUNDS.midLandingY) < 1e-4);
});

test('Rectangular GLB envelope clamps avatars & floor-isolated seating/exit prompts resolve cleanly', () => {
  // Attempt to walk far outside the envelope
  const clamped = clampSalonInteriorPosition(99, 99, 0.0);
  assert.ok(clamped.x <= SALON_INTERIOR_BOUNDS.maxX - SALON_INTERIOR_BOUNDS.wallMargin + 1e-6);
  assert.ok(clamped.z <= SALON_INTERIOR_BOUNDS.maxZ - SALON_INTERIOR_BOUNDS.wallMargin + 1e-6);
  assert.equal(clamped.floorY, 0.0);

  // Near 1F Exit Door (the model's main door, South wall)
  const exitPrompt = resolveNearestSalonPromptOrSeat(
    SALON_STATION_TARGETS.exitDoor.x - 0.5,
    SALON_STATION_TARGETS.exitDoor.z,
    0.0,
  );
  assert.equal(exitPrompt.target, 'station');
  assert.equal(exitPrompt.stationKind, 'exit_door');

  // On 2F above the vanity row, the 1F exit door and 1F vanities stay silent;
  // the nearest seat is the 2F lounge sofa
  const upperCheck = resolveNearestSalonPromptOrSeat(3.64, 2.0, SALON_INTERIOR_BOUNDS.secondFloorY);
  assert.notEqual(upperCheck.stationKind, 'exit_door');
  if (upperCheck.seatSpot) {
    assert.equal(upperCheck.seatSpot.floorLevel, '2f');
  }

  // Stand-up positions for all 6 seats remain within walkable floor level & clear of the seat itself
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
    anchorX: SALON_STATION_TARGETS.spaSuite.x,
    anchorZ: SALON_STATION_TARGETS.spaSuite.z,
    floorY: SALON_INTERIOR_BOUNDS.secondFloorY,
    yaw: 0.62,
    pitch: 0.48,
    dist: 6.4,
  });
  assert.ok(pose2f.lookY >= SALON_ORIGIN_Y + SALON_INTERIOR_BOUNDS.secondFloorY + 0.9);
  assert.ok(pose2f.camY > pose1f.camY + 2.0);
});

test('buildBeautySalonInterior mounts the Glow GLB at the interior origin with the seat-coin handle contract', () => {
  const salon = withMockDocumentCanvas(() => buildBeautySalonInterior());

  // Root sits at the isolated interior origin; the GLB mount child carries
  // the shared salon scale (the model itself loads async in the browser,
  // so its meshes are not counted synchronously here).
  assert.equal(salon.root.name, 'BeautyGlowSalonInterior3D');
  assert.equal(salon.root.position.y, SALON_ORIGIN_Y);
  const glbMount = salon.root.getObjectByName('BeautyGlowSalonInteriorGlb3D');
  assert.ok(glbMount, 'Expected the interior GLB mount group');
  assert.ok(Math.abs(glbMount.scale.x - SALON_GLB_SCALE) < 1e-9);

  // One floating seat-coin indicator per sittable seat spot
  assert.equal(salon.floorSpotIndicators.length, SALON_INTERIOR_SEAT_SPOTS.length);

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

  assert.ok(meshCount >= 4, `Expected the exit pad + seat coin meshes, got ${meshCount}`);
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
  salon.updateVisuals(2.5, null, SALON_INTERIOR_BOUNDS.secondFloorY);
  salon.dispose();
});
