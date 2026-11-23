import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  CITY_VIEW_DISTRICTS,
  RADAR_WORLD_HALF_EXTENT,
  worldCoordToRadarPercent,
} from './buddiesBlitzRules';
import { CENTRAL_PARK_MASTERPLAN, CENTRAL_PARK_SEAT_SPOTS } from './buddiesCentralParkRules';
import {
  SALON_EXTERIOR_DOOR_TRIGGER,
  SALON_INTERIOR_BOUNDS,
  SALON_INTERIOR_SEAT_SPOTS,
  clampSalonInteriorPosition,
} from './buddiesBeautySalonRules';
import { CAFE_INTERIOR_BOUNDS, CAFE_INTERIOR_SEAT_SPOTS } from './buddiesCafeRules';
import { CASINO_INTERIOR_BOUNDS, CASINO_INTERIOR_SEAT_SPOTS } from './buddiesGrandCasinoRules';
import { evaluateNwLakeSdf } from './buddiesPlanetCurvature';
import {
  CITY_MINIMAP_POIS,
  CITY_NAV_MAX_COORD,
  CITY_NAV_MIN_COORD,
  CLICK_TO_WALK_MAX_DRAG_PX,
  CLICK_TO_WALK_RUN_START_DISTANCE_M,
  CLICK_TO_WALK_WALK_DECEL_DISTANCE_M,
  PLAYER_WALK_SPEED_SCALE,
  buildCityNavGrid,
  cancelClickToWalkState,
  createClickToWalkIndicator3D,
  createIdleClickToWalkState,
  hasManualMovementConflict,
  isCleanClickTap,
  isWorldPointStrictlyWalkable,
  pickClosestInteractiveSeatAtPoint,
  planCityClickToWalkRoute,
  planInteriorClickToWalkRoute,
  radarPercentToWorldCoord,
  resolvePlayerLocomotionGait,
  samplePolylineBreadcrumbs,
  snapWorldPointToWalkable,
  startClickToWalkState,
  stepClickToWalkSteering,
  summarizeClickToWalkForHud,
  verifyRouteClearOfStructures,
} from './buddiesClickToWalkRules';

test('minimap percentage <-> world coordinate roundtrip stays accurate across city bounds and POIs', () => {
  const centerPct = worldCoordToRadarPercent(0, 0);
  const centerWorld = radarPercentToWorldCoord(centerPct.leftPct, centerPct.topPct);
  assert.ok(Math.abs(centerWorld.x) < 1e-6);
  assert.ok(Math.abs(centerWorld.z) < 1e-6);

  const sampleCoords: ReadonlyArray<readonly [number, number]> = [
    [-125, -125],
    [125, 125],
    [-90.55, 22.35],
    [29.5, 14.0], // GLOW STUDIO
    [85.8, 60.0], // KAI
    [101.0, -61.0], // PARK
    [-76.18, -70.6], // Grand Casino entrance
    [-100.9, -3.15], // HANA
  ];

  for (const [wx, wz] of sampleCoords) {
    const pct = worldCoordToRadarPercent(wx, wz, RADAR_WORLD_HALF_EXTENT);
    const back = radarPercentToWorldCoord(pct.leftPct, pct.topPct, RADAR_WORLD_HALF_EXTENT);
    assert.ok(
      Math.abs(back.x - wx) < 1e-6 && Math.abs(back.z - wz) < 1e-6,
      `Expected roundtrip (${wx}, ${wz}) -> (${pct.leftPct.toFixed(2)}%, ${pct.topPct.toFixed(2)}%) -> (${back.x}, ${back.z})`,
    );
  }

  // Clamp out-of-range / NaN percentages cleanly
  assert.deepEqual(radarPercentToWorldCoord(Number.NaN, Number.POSITIVE_INFINITY), {
    x: 0,
    z: 0,
  });
  const topLeft = radarPercentToWorldCoord(-10, -10);
  assert.deepEqual(topLeft, { x: -RADAR_WORLD_HALF_EXTENT, z: -RADAR_WORLD_HALF_EXTENT });

  // Verify GLOW STUDIO POI is registered at (29.5, 15.0) alongside HANA, CAFE, KAI, PARK
  const ids = CITY_MINIMAP_POIS.map((p) => p.id);
  assert.deepEqual(ids, ['hana', 'cafe', 'glow_studio', 'kai', 'park']);
  const glow = CITY_MINIMAP_POIS.find((p) => p.id === 'glow_studio')!;
  assert.equal(glow.x, 29.5);
  assert.equal(glow.z, 15.0);
  assert.equal(glow.walkTargetX, SALON_EXTERIOR_DOOR_TRIGGER.x);
  assert.equal(glow.walkTargetZ, SALON_EXTERIOR_DOOR_TRIGGER.z);
});

test('isCleanClickTap distinguishes clicks/taps (<= 6px) from camera orbit drags', () => {
  assert.equal(CLICK_TO_WALK_MAX_DRAG_PX, 6);
  assert.equal(isCleanClickTap(100, 200, 100, 200), true);
  assert.equal(isCleanClickTap(100, 200, 103, 204), true); // 5px <= 6px
  assert.equal(isCleanClickTap(100, 200, 106, 200), true); // 6px <= 6px
  assert.equal(isCleanClickTap(100, 200, 107, 200), false); // 7px > 6px
  assert.equal(isCleanClickTap(100, 200, 105, 205), false); // ~7.07px > 6px
  assert.equal(isCleanClickTap(Number.NaN, 0, 0, 0), false);
});

test('buildCityNavGrid covers [-125, +125] and snaps clicks inside OBBs, fountain, lake & ocean to closest walkable point', () => {
  const nav = buildCityNavGrid({ mode: 'foot', worldMode: 'safezone' });
  assert.equal(nav.grid.minX, CITY_NAV_MIN_COORD);
  assert.equal(nav.grid.maxX, CITY_NAV_MAX_COORD);
  assert.equal(nav.grid.minZ, CITY_NAV_MIN_COORD);
  assert.equal(nav.grid.maxZ, CITY_NAV_MAX_COORD);

  // 1. Inside Central Fountain (29.5, 0.0)
  assert.equal(isWorldPointStrictlyWalkable(nav, 29.5, 0.0), false);
  const snapFountain = snapWorldPointToWalkable(nav, 29.5, 0.0);
  assert.equal(snapFountain.snapped, true);
  assert.ok(
    Math.hypot(snapFountain.x - 29.5, snapFountain.z - 0.0) >= 3.7,
    `Expected fountain snap outside r=3.7m basin, got (${snapFountain.x}, ${snapFountain.z})`,
  );
  assert.equal(isWorldPointStrictlyWalkable(nav, snapFountain.x, snapFountain.z), true);

  // 2. Inside Beauty Salon / Glow Studio (29.5, 14.0)
  assert.equal(isWorldPointStrictlyWalkable(nav, 29.5, 14.0), false);
  const snapSalon = snapWorldPointToWalkable(nav, 29.5, 14.0, {
    preferApproachX: 29.5,
    preferApproachZ: 6.0,
  });
  assert.equal(snapSalon.snapped, true);
  assert.equal(isWorldPointStrictlyWalkable(nav, snapSalon.x, snapSalon.z), true);
  assert.ok(snapSalon.snapDistanceM < 10.0);

  // 3. Inside Boutique Tower (12.2, -0.4)
  assert.equal(isWorldPointStrictlyWalkable(nav, 12.2, -0.4), false);
  const snapBoutique = snapWorldPointToWalkable(nav, 12.2, -0.4);
  assert.equal(snapBoutique.snapped, true);
  assert.equal(isWorldPointStrictlyWalkable(nav, snapBoutique.x, snapBoutique.z), true);

  // 4. Inside Grand Casino (-88.8, -70.6)
  assert.equal(isWorldPointStrictlyWalkable(nav, -88.8, -70.6), false);
  const snapCasino = snapWorldPointToWalkable(nav, -88.8, -70.6);
  assert.equal(snapCasino.snapped, true);
  assert.equal(isWorldPointStrictlyWalkable(nav, snapCasino.x, snapCasino.z), true);
  assert.ok(snapCasino.snapDistanceM < 20.0);

  // 5. Inside NW Oasis Lake (-31.0, 0.0)
  assert.ok(evaluateNwLakeSdf(-31.0, 0.0) < 0);
  assert.equal(isWorldPointStrictlyWalkable(nav, -31.0, 0.0), false);
  const snapLake = snapWorldPointToWalkable(nav, -31.0, 0.0);
  assert.equal(snapLake.snapped, true);
  assert.ok(evaluateNwLakeSdf(snapLake.x, snapLake.z) >= 0.25);
  assert.equal(isWorldPointStrictlyWalkable(nav, snapLake.x, snapLake.z), true);

  // 6. Inside East Ocean (122.0, 60.0)
  assert.equal(isWorldPointStrictlyWalkable(nav, 122.0, 60.0), false);
  const snapOcean = snapWorldPointToWalkable(nav, 122.0, 60.0);
  assert.equal(snapOcean.snapped, true);
  assert.ok(snapOcean.x <= 111.0);
  assert.equal(isWorldPointStrictlyWalkable(nav, snapOcean.x, snapOcean.z), true);
});

test('long-distance cross-map A* routes stay collision-free across Central Fountain, Beauty Salon, Boutique, Casino & Oasis Lake', () => {
  const nav = buildCityNavGrid({ mode: 'foot', worldMode: 'safezone' });
  const scooterNav = buildCityNavGrid({ mode: 'scooter', worldMode: 'safezone' });

  const longRoutes: Array<{
    name: string;
    from: [number, number];
    to: [number, number];
    grid: ReturnType<typeof buildCityNavGrid>;
  }> = [
    {
      name: 'West Plaza (-95, 0) -> Glow Studio (29.5, 14.0 snapped)',
      from: [-95.0, 0.0],
      to: [CENTRAL_PARK_MASTERPLAN.beautySalon.x, CENTRAL_PARK_MASTERPLAN.beautySalon.z],
      grid: nav,
    },
    {
      name: 'Central Plaza (-90, -10) -> Kai Fish Market (87.8, 60.0)',
      from: [-90.0, -10.0],
      to: [87.8, 60.0],
      grid: nav,
    },
    {
      name: 'Grand Casino (-76.18, -70.6) -> Taman Ria (98.5, -61.0)',
      from: [-76.18, -70.6],
      to: [98.5, -61.0],
      grid: nav,
    },
    {
      name: 'Central Park West Gate (-9.5, 0) -> East Gate (57.3, 0) avoiding Boutique, Fountain & Cozy Cafe',
      from: [-9.5, 0.0],
      to: [57.3, 0.0],
      grid: nav,
    },
    {
      name: 'Scooter: Glasshouse Cafe (-90.55, 22.35) -> Glow Studio Door (26.97, 9.55)',
      from: [-90.55, 22.35],
      to: [SALON_EXTERIOR_DOOR_TRIGGER.x, SALON_EXTERIOR_DOOR_TRIGGER.z],
      grid: scooterNav,
    },
    {
      name: 'Model Estate (-45.0, 62.0) -> All POIs',
      from: [-45.0, 62.0],
      to: [CITY_MINIMAP_POIS[0].walkTargetX, CITY_MINIMAP_POIS[0].walkTargetZ],
      grid: nav,
    },
  ];

  for (const r of longRoutes) {
    const t0 = performance.now();
    const plan = planCityClickToWalkRoute(r.grid, r.from[0], r.from[1], r.to[0], r.to[1]);
    const elapsedMs = performance.now() - t0;

    assert.equal(plan.reachable, true, `${r.name} should be reachable`);
    assert.ok(plan.waypoints.length >= 1, `${r.name} should yield >= 1 waypoint`);
    assert.ok(
      plan.expandedCount < 25000,
      `${r.name} expanded too many nodes (${plan.expandedCount})`,
    );
    assert.ok(elapsedMs < 5000, `${r.name} took too long (${elapsedMs.toFixed(1)}ms)`);

    // Warm path replan remains bounded even under heavy parallel worker contention
    const tWarm0 = performance.now();
    const warmPlan = planCityClickToWalkRoute(r.grid, r.from[0], r.from[1], r.to[0], r.to[1]);
    const warmElapsedMs = performance.now() - tWarm0;
    assert.equal(warmPlan.expandedCount, plan.expandedCount);
    assert.ok(warmElapsedMs < 2500, `${r.name} warm replan took too long (${warmElapsedMs.toFixed(1)}ms)`);

    const clearance = verifyRouteClearOfStructures(
      r.grid,
      plan.waypoints,
      plan.startX,
      plan.startZ,
    );
    assert.equal(
      clearance.clear,
      true,
      `${r.name} violated structure/terrain clearance: ${clearance.violationReason}`,
    );
  }

  // Verify every minimap POI is reachable from Central Plaza & from Fountain Promenade
  for (const poi of CITY_MINIMAP_POIS) {
    const fromPlaza = planCityClickToWalkRoute(nav, -90.8, -9.4, poi.walkTargetX, poi.walkTargetZ);
    assert.equal(fromPlaza.reachable, true, `POI ${poi.id} must be reachable from Central Plaza`);
    const check = verifyRouteClearOfStructures(
      nav,
      fromPlaza.waypoints,
      fromPlaza.startX,
      fromPlaza.startZ,
    );
    assert.equal(check.clear, true, `POI ${poi.id} route clear failed: ${check.violationReason}`);
  }
});

test('interior click-to-walk routes stay strictly inside walls and traverse 2-story Beauty Salon staircase', () => {
  // 1. Beauty Salon 1F -> 2F Spa Bed
  const spaSeat = SALON_INTERIOR_SEAT_SPOTS.find((s) => s.id === 'salon_2f_spa_facial_bed')!;
  const upRoute = planInteriorClickToWalkRoute({
    room: 'salon_interior',
    startX: SALON_INTERIOR_BOUNDS.spawnX,
    startZ: SALON_INTERIOR_BOUNDS.spawnZ,
    startFloorY: 0,
    goalX: spaSeat.standUpX,
    goalZ: spaSeat.standUpZ,
    goalFloorY: SALON_INTERIOR_BOUNDS.secondFloorY,
  });
  assert.equal(upRoute.reachable, true);
  assert.equal(upRoute.targetFloorY, SALON_INTERIOR_BOUNDS.secondFloorY);
  assert.ok(
    upRoute.waypoints.some((w) => w.floorY === 1.5),
    'Expected 1F->2F Salon route to ascend through mid-landing (1.5m)',
  );

  // Verify every point on 1F->2F path stays inside salon envelope without falling off mezzanine
  let curFloorY = 0;
  for (const wp of upRoute.waypoints) {
    const clamped = clampSalonInteriorPosition(wp.x, wp.z, curFloorY);
    assert.ok(
      Math.hypot(clamped.x - wp.x, clamped.z - wp.z) < 0.45,
      `Salon waypoint (${wp.x.toFixed(2)}, ${wp.z.toFixed(2)}) at floorY=${curFloorY} strayed outside bounds -> (${clamped.x.toFixed(2)}, ${clamped.z.toFixed(2)})`,
    );
    curFloorY = clamped.floorY;
  }
  assert.equal(curFloorY, SALON_INTERIOR_BOUNDS.secondFloorY);

  // 2. Beauty Salon 2F -> 1F Exit Door
  const downRoute = planInteriorClickToWalkRoute({
    room: 'salon_interior',
    startX: 4.1,
    startZ: -1.6,
    startFloorY: SALON_INTERIOR_BOUNDS.secondFloorY,
    goalX: SALON_INTERIOR_BOUNDS.exitDoorX,
    goalZ: SALON_INTERIOR_BOUNDS.exitDoorZ,
    goalFloorY: 0,
  });
  assert.equal(downRoute.reachable, true);
  assert.equal(downRoute.targetFloorY, 0);
  assert.ok(downRoute.waypoints.some((w) => w.floorY === 1.5));

  // 3. CozyBites Cafe interior route around barista counter & tables
  const cafeRoute = planInteriorClickToWalkRoute({
    room: 'cafe_interior',
    startX: CAFE_INTERIOR_BOUNDS.spawnX,
    startZ: CAFE_INTERIOR_BOUNDS.spawnZ,
    goalX: 3.7,
    goalZ: -0.85,
  });
  assert.equal(cafeRoute.reachable, true);
  assert.ok(cafeRoute.waypoints.length >= 1);

  // 4. Grand Casino interior route
  const casinoRoute = planInteriorClickToWalkRoute({
    room: 'casino_interior',
    startX: CASINO_INTERIOR_BOUNDS.spawnX,
    startZ: CASINO_INTERIOR_BOUNDS.spawnZ,
    goalX: 3.5,
    goalZ: 2.8,
  });
  assert.equal(casinoRoute.reachable, true);
  assert.ok(casinoRoute.waypoints.length >= 1);
});

test('WASD / Arrow / Virtual Joystick input immediately cancels click-to-walk priority & arrival triggers pending seat sit', () => {
  assert.equal(hasManualMovementConflict({}), false);
  assert.equal(hasManualMovementConflict({ keys: { ShiftLeft: true } }), false); // Sprint doesn't cancel
  assert.equal(hasManualMovementConflict({ keys: { KeyW: true } }), true);
  assert.equal(hasManualMovementConflict({ keys: { ArrowDown: true } }), true);
  assert.equal(hasManualMovementConflict({ joystickMag: 0.4 }), true);

  let state = startClickToWalkState({
    source: 'world',
    startX: 0,
    startZ: 0,
    rawTargetX: 10,
    rawTargetZ: 0,
    targetX: 10,
    targetZ: 0,
    waypoints: [
      { x: 5, z: 0 },
      { x: 10, z: 0 },
    ],
    targetLabel: 'Bench',
    pendingInteraction: {
      kind: 'sit',
      seatId: 'urban_wave_bench_west_n',
      seatX: 0.5,
      seatZ: -8.8,
    },
  });

  // 1. Normal step moves toward first waypoint
  const step1 = stepClickToWalkSteering({
    state,
    x: 0,
    z: 0,
    dt: 0.016,
    manualInputActive: false,
  });
  assert.equal(step1.cancelledByManualInput, false);
  assert.equal(step1.arrived, false);
  assert.ok(step1.dirX > 0.99);
  state = step1.nextState;

  // 2. Pressing WASD cancels auto-walk cleanly
  const cancelStep = stepClickToWalkSteering({
    state,
    x: 1,
    z: 0,
    dt: 0.016,
    manualInputActive: hasManualMovementConflict({ keys: { KeyA: true } }),
  });
  assert.equal(cancelStep.cancelledByManualInput, true);
  assert.equal(cancelStep.nextState.active, false);
  assert.equal(cancelStep.dirX, 0);
  assert.equal(cancelStep.dirZ, 0);

  // 3. Arrival triggers pending sit interaction
  const nearTarget = startClickToWalkState({
    source: 'world',
    startX: 9.8,
    startZ: 0,
    rawTargetX: 10,
    rawTargetZ: 0,
    targetX: 10,
    targetZ: 0,
    waypoints: [{ x: 10, z: 0 }],
    pendingInteraction: {
      kind: 'sit',
      seatId: 'urban_wave_bench_west_n',
      seatX: 0.5,
      seatZ: -8.8,
    },
  });
  const arriveStep = stepClickToWalkSteering({
    state: nearTarget,
    x: 9.7,
    z: 0,
    dt: 0.016,
    manualInputActive: false,
  });
  assert.equal(arriveStep.arrived, true);
  assert.equal(arriveStep.nextState.active, false);
  assert.equal(arriveStep.pendingInteractionToTrigger?.kind, 'sit');

  // 4. Seat picker & HUD summary
  const pickedParkSeat = pickClosestInteractiveSeatAtPoint({
    hitX: CENTRAL_PARK_SEAT_SPOTS[0].x + 0.25,
    hitZ: CENTRAL_PARK_SEAT_SPOTS[0].z - 0.15,
    seats: CENTRAL_PARK_SEAT_SPOTS,
  });
  assert.equal(pickedParkSeat?.id, CENTRAL_PARK_SEAT_SPOTS[0].id);

  const pickedCafeSeat = pickClosestInteractiveSeatAtPoint({
    hitX: CAFE_INTERIOR_SEAT_SPOTS[0].x,
    hitZ: CAFE_INTERIOR_SEAT_SPOTS[0].z,
    seats: CAFE_INTERIOR_SEAT_SPOTS,
  });
  assert.equal(pickedCafeSeat?.id, CAFE_INTERIOR_SEAT_SPOTS[0].id);

  const pickedCasinoSeat = pickClosestInteractiveSeatAtPoint({
    hitX: CASINO_INTERIOR_SEAT_SPOTS[0].x,
    hitZ: CASINO_INTERIOR_SEAT_SPOTS[0].z,
    seats: CASINO_INTERIOR_SEAT_SPOTS,
  });
  assert.equal(pickedCasinoSeat?.id, CASINO_INTERIOR_SEAT_SPOTS[0].id);

  const hud = summarizeClickToWalkForHud(state, 2, 0, false);
  assert.equal(hud.active, true);
  assert.equal(hud.remainingDistanceM, 8);
  assert.equal(hud.targetLabel, 'Bench');

  const cancelled = cancelClickToWalkState(state);
  assert.equal(cancelled.active, false);
  assert.deepEqual(cancelled, createIdleClickToWalkState());
});

test('3D destination target ring & polyline breadcrumb chevrons update and dispose cleanly', () => {
  const crumbs = samplePolylineBreadcrumbs(
    0,
    0,
    [
      { x: 10, z: 0 },
      { x: 10, z: 10 },
    ],
    0,
    10,
    2.5,
    0.2,
  );
  assert.ok(crumbs.length >= 4);
  for (const c of crumbs) {
    assert.ok(Number.isFinite(c.x) && Number.isFinite(c.z) && Number.isFinite(c.yaw));
  }

  const scene = new THREE.Scene();
  const indicator = createClickToWalkIndicator3D(scene);
  assert.equal(indicator.root.visible, false);

  const walkState = startClickToWalkState({
    source: 'minimap',
    startX: 0,
    startZ: 0,
    rawTargetX: 20,
    rawTargetZ: 0,
    targetX: 20,
    targetZ: 0,
    waypoints: [
      { x: 10, z: 0 },
      { x: 20, z: 0 },
    ],
  });

  indicator.update({
    state: walkState,
    playerX: 0,
    playerZ: 0,
    timeSec: 1.25,
    sampleGroundY: () => 0.04,
  });
  assert.equal(indicator.root.visible, true);

  indicator.update({
    state: createIdleClickToWalkState(),
    playerX: 0,
    playerZ: 0,
    timeSec: 1.5,
    sampleGroundY: () => 0.04,
  });
  assert.equal(indicator.root.visible, false);

  indicator.dispose();
  assert.equal(scene.children.includes(indicator.root), false);
});

test('3D aerial City View clicks across Kota and every CITY_VIEW_DISTRICTS focus resolve collision-free walkable routes', () => {
  const nav = buildCityNavGrid({ mode: 'foot', worldMode: 'safezone' });
  const startX = -90.8;
  const startZ = -9.4;

  // Drag >= 6px must be treated as aerial orbit/pan drag, never triggering click-to-walk
  assert.equal(isCleanClickTap(320, 240, 327, 240), false);
  assert.equal(isCleanClickTap(320, 240, 323, 244), true);

  for (const dist of CITY_VIEW_DISTRICTS) {
    const plan = planCityClickToWalkRoute(
      nav,
      startX,
      startZ,
      dist.lookAtPos.x,
      dist.lookAtPos.z,
    );
    assert.equal(plan.reachable, true, `City View district ${dist.id} should be reachable`);
    assert.ok(plan.waypoints.length >= 1, `City View district ${dist.id} needs >= 1 waypoint`);
    assert.equal(
      isWorldPointStrictlyWalkable(nav, plan.targetX, plan.targetZ, 0.36),
      true,
      `City View snapped target for ${dist.id} must be walkable`,
    );
    const clearance = verifyRouteClearOfStructures(
      nav,
      plan.waypoints,
      plan.startX,
      plan.startZ,
    );
    assert.equal(
      clearance.clear,
      true,
      `City View route to ${dist.id} violated clearance: ${clearance.violationReason}`,
    );
  }
});

test('resolvePlayerLocomotionGait walks on short click & WASD without Shift, runs on far click & WASD+Shift', () => {
  // 1. WASD without Shift -> ALWAYS walk
  const wasdNoShift = resolvePlayerLocomotionGait({
    isClickToWalk: false,
    isShiftHeld: false,
    isIndoor: false,
    clickTotalDistanceM: 0,
    clickRemainingDistanceM: 0,
  });
  assert.equal(wasdNoShift.gait, 'walk');
  assert.equal(wasdNoShift.speedMultiplier, PLAYER_WALK_SPEED_SCALE);

  // 2. WASD with Shift -> RUN
  const wasdShift = resolvePlayerLocomotionGait({
    isClickToWalk: false,
    isShiftHeld: true,
    isIndoor: false,
    clickTotalDistanceM: 0,
    clickRemainingDistanceM: 0,
  });
  assert.equal(wasdShift.gait, 'run');
  assert.equal(wasdShift.speedMultiplier, 1.0);

  // 3. Click-to-Walk a few meters away (< 9m) -> WALK
  const shortClick = resolvePlayerLocomotionGait({
    isClickToWalk: true,
    isShiftHeld: false,
    isIndoor: false,
    clickTotalDistanceM: 5.0,
    clickRemainingDistanceM: 4.2,
  });
  assert.equal(shortClick.gait, 'walk');
  assert.equal(shortClick.speedMultiplier, PLAYER_WALK_SPEED_SCALE);

  // 4. Click-to-Walk far away (>= 9m) -> RUN until final deceleration band
  const farClickMid = resolvePlayerLocomotionGait({
    isClickToWalk: true,
    isShiftHeld: false,
    isIndoor: false,
    clickTotalDistanceM: CLICK_TO_WALK_RUN_START_DISTANCE_M + 8,
    clickRemainingDistanceM: 12.0,
  });
  assert.equal(farClickMid.gait, 'run');
  assert.equal(farClickMid.speedMultiplier, 1.0);

  // 5. Far Click-to-Walk eases back into WALK on final approach
  const farClickArriving = resolvePlayerLocomotionGait({
    isClickToWalk: true,
    isShiftHeld: false,
    isIndoor: false,
    clickTotalDistanceM: CLICK_TO_WALK_RUN_START_DISTANCE_M + 8,
    clickRemainingDistanceM: CLICK_TO_WALK_WALK_DECEL_DISTANCE_M - 0.5,
  });
  assert.equal(farClickArriving.gait, 'walk');
  assert.equal(farClickArriving.speedMultiplier, PLAYER_WALK_SPEED_SCALE);
});
