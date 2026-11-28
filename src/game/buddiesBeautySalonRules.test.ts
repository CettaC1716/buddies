import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SALON_EXTERIOR_DOOR_TRIGGER,
  SALON_EXTERIOR_GLB_SCALE,
  SALON_EXTERIOR_WALL_THICKNESS,
  SALON_GLB_SCALE,
  SALON_INTERIOR_BOUNDS,
  SALON_INTERIOR_COLLIDERS,
  SALON_INTERIOR_SEAT_SPOTS,
  clampSalonInteriorPosition,
  resolveSalonInteriorFloorY,
} from './buddiesBeautySalonRules';
import { getCentralParkObstacles } from './buddiesCentralParkRules';

test('Beauty Salon exterior door threshold sits clear on North Promenade', () => {
  const salonObb = getCentralParkObstacles().find((o) => o.id === 'urban_plaza_beauty_salon');
  assert.ok(salonObb, 'Expected exterior Beauty Salon OBB obstacle');
  // Entrance threshold (z = 8.46, exitSpawnZ = 8.26) sits strictly North of the
  // scaled GLB body's front face (obb front = z 9.13, model wall face z 9.35)
  assert.ok(SALON_EXTERIOR_DOOR_TRIGGER.z < salonObb.z - salonObb.halfZ);
  assert.ok(SALON_EXTERIOR_DOOR_TRIGGER.exitSpawnZ < salonObb.z - salonObb.halfZ);
  // The door anchor x is unchanged and the OBB tracks the 1.40x exterior GLB walls
  assert.equal(SALON_EXTERIOR_DOOR_TRIGGER.doorX, 25.74);
  assert.ok(Math.abs(salonObb.halfX - (4.4 * SALON_EXTERIOR_GLB_SCALE + 0.2)) < 0.01);
  assert.ok(Math.abs(salonObb.x - 29.87) < 1e-6);
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

test('Rectangular GLB envelope clamps avatars & seat/collider registry stays floor-consistent', () => {
  // Attempt to walk far outside the envelope
  const clamped = clampSalonInteriorPosition(99, 99, 0.0);
  assert.ok(clamped.x <= SALON_INTERIOR_BOUNDS.maxX - SALON_INTERIOR_BOUNDS.wallMargin + 1e-6);
  assert.ok(clamped.z <= SALON_INTERIOR_BOUNDS.maxZ - SALON_INTERIOR_BOUNDS.wallMargin + 1e-6);
  assert.equal(clamped.floorY, 0.0);

  assert.equal(SALON_INTERIOR_SEAT_SPOTS.length, 6);

  assert.ok(SALON_INTERIOR_COLLIDERS.some((c) => c.id === 'salon_1f_reception_front' && c.floorLevel === '1f'));
  assert.ok(SALON_INTERIOR_COLLIDERS.some((c) => c.id === 'salon_2f_spa_bed' && c.floorLevel === '2f'));
});
