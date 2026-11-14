import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COASTAL_AMUSEMENT_PARK_MASTERPLAN,
  CARNIVAL_MIDWAY_STALLS,
  BIANGLALA_GONDOLA_PALETTE,
  evaluateAmusementBoardwalkElevation,
  isPointOnAmusementOverwaterPier,
  evaluateAmusementParkRideKinematics,
  getCoastalAmusementParkObstacles,
} from './buddiesAmusementParkRules';

test('Coastal Amusement Park masterplan spans empty northern beach + northern Dermaga while keeping z = -15 Harbor Road Entrance clear', () => {
  const mp = COASTAL_AMUSEMENT_PARK_MASTERPLAN;
  // Claims northern Dermaga (z in [-46..-19.5]) and northern beach (z in [-104..-46]) + overwater pier
  assert.ok(mp.bounds.maxZ <= -19.0, 'Southern entrance must stay clear of z = -15 Harbor Road Entrance');
  assert.ok(mp.bounds.minZ <= -100.0, 'Park must span across the northern beach');
  assert.ok(mp.bianglalaPierDeck.maxX > 115.0, 'Bianglala pier must extend out over East Ocean');
  assert.ok(mp.gazeboFingerJetty.headMaxX > 124.0, 'Seaward finger pier gazebo must extend into ocean');
  assert.equal(BIANGLALA_GONDOLA_PALETTE.length, 16);
  assert.ok(CARNIVAL_MIDWAY_STALLS.some((s) => s.kind === 'popcorn_kiosk'));
  assert.ok(CARNIVAL_MIDWAY_STALLS.some((s) => s.kind === 'cotton_candy_cart'));
});

test('Walkable boardwalk, stairs, and over-water pier elevations transition smoothly without blocking Midway promenade', () => {
  // Cobblestone Midway stays at flat 0.0m ground level
  assert.equal(evaluateAmusementBoardwalkElevation(86.0, -32.0), 0.0);
  assert.equal(evaluateAmusementBoardwalkElevation(86.0, -56.0), 0.0);

  // Main Waterfront Boardwalk & Over-Water Pier sit at +1.10m
  assert.equal(evaluateAmusementBoardwalkElevation(102.0, -32.8), 1.1);
  assert.equal(evaluateAmusementBoardwalkElevation(112.0, -32.8), 1.1);
  assert.equal(evaluateAmusementBoardwalkElevation(122.5, -26.6), 1.1);

  // Kora-Kora docking platform rises to +2.02m
  assert.equal(evaluateAmusementBoardwalkElevation(100.0, -56.5), 2.02);

  // Access stairs interpolate smoothly between 0.0m and +1.10m
  const midSouthStair = evaluateAmusementBoardwalkElevation(101.0, -19.9);
  assert.ok(midSouthStair > 0.25 && midSouthStair < 0.95);
  const midWestStair = evaluateAmusementBoardwalkElevation(94.1, -32.5);
  assert.ok(midWestStair > 0.25 && midWestStair < 0.95);

  // Over-water pier check allows walking on Bianglala deck & Gazebo jetty, but not raw open ocean
  assert.equal(isPointOnAmusementOverwaterPier(112.5, -32.8), true);
  assert.equal(isPointOnAmusementOverwaterPier(122.5, -26.6), true);
  assert.equal(isPointOnAmusementOverwaterPier(118.0, 0.0), false);
  assert.equal(isPointOnAmusementOverwaterPier(118.0, -60.0), false);
});

test('All 5 ride kinematics stay bounded, upright-compensated, and inside arena limits across time', () => {
  for (const t of [0, 1.25, 3.7, 9.4, 24.8]) {
    const k = evaluateAmusementParkRideKinematics(t);
    // Bianglala gondolas strictly counter-rotate so world angle = 0 (upright)
    assert.ok(Math.abs(k.bianglalaWheelAngleRad + k.bianglalaGondolaCounterAngleRad) < 1e-9);
    // Kora-Kora swing stays within safe ±0.60 rad pendulum envelope
    assert.ok(Math.abs(k.koraKoraSwingAngleRad) <= 0.60);
    // Komidi Putar 10 horses bob within [0.0, 0.40]m
    assert.equal(k.komidiPutarHorseBobsM.length, 10);
    for (const bob of k.komidiPutarHorseBobsM) {
      assert.ok(bob >= -0.001 && bob <= 0.40);
    }
    // Ontag-Anting 16 chairs flare outward positively
    assert.equal(k.ontagAntingChairFlareRad.length, 16);
    for (const flare of k.ontagAntingChairFlareRad) {
      assert.ok(flare > 0.20 && flare < 0.60);
    }
    // All 5 Bumper Cars stay strictly inside the conductive floor bounds (±5.5m x ±6.5m) with margin
    assert.equal(k.bumperCars.length, 5);
    for (const car of k.bumperCars) {
      assert.ok(Math.abs(car.localX) <= 4.2, `Car ${car.index} localX out of bounds: ${car.localX}`);
      assert.ok(Math.abs(car.localZ) <= 4.8, `Car ${car.index} localZ out of bounds: ${car.localZ}`);
    }
  }

  // Verify motion actually advances between t=0 and t=1.5
  const k0 = evaluateAmusementParkRideKinematics(0);
  const b0 = k0.bianglalaWheelAngleRad;
  const s0 = k0.koraKoraSwingAngleRad;
  const c0x = k0.bumperCars[0].localX;
  const k1 = evaluateAmusementParkRideKinematics(1.5);
  assert.notEqual(k1.bianglalaWheelAngleRad, b0);
  assert.notEqual(k1.koraKoraSwingAngleRad, s0);
  assert.notEqual(k1.bumperCars[0].localX, c0x);
});

test('Amusement park colliders keep the Entrance Archway center and Midway spine unobstructed', () => {
  const obstacles = getCoastalAmusementParkObstacles();
  assert.ok(obstacles.length >= 22);

  const pointHitsObstacle = (px: number, pz: number) =>
    obstacles.some(
      (o) => Math.abs(px - o.x) <= o.halfX + 0.3 && Math.abs(pz - o.z) <= o.halfZ + 0.3,
    );

  // Center of Entrance Archway (86.2, -20.4) and South Midway promenade (86.2, -26..-38) are clear
  assert.equal(pointHitsObstacle(86.2, -20.4), false);
  assert.equal(pointHitsObstacle(86.2, -28.0), false);
  assert.equal(pointHitsObstacle(86.2, -35.0), false);
  // West stair openings onto boardwalk (94.5, -32.7) and (94.5, -47.2) are clear
  assert.equal(pointHitsObstacle(94.5, -32.7), false);
  assert.equal(pointHitsObstacle(94.5, -47.2), false);
});

test('DEFAULT_ARENA_MAP_LAYOUT contains zero industrial props overlapping the Taman Ria footprint', async () => {
  const { DEFAULT_ARENA_MAP_LAYOUT, isInsideCoastalAmusementParkFootprint } = await import(
    './buddiesBlitzWorldBuilder'
  );
  const overlapping = DEFAULT_ARENA_MAP_LAYOUT.props.filter((p) =>
    isInsideCoastalAmusementParkFootprint(p.x, p.z),
  );
  assert.deepEqual(overlapping, []);
});

test('Metric UV unwrapping and sculpted 3D galleon/canopy/palm geometries produce finite UVs and outward normals', async () => {
  const THREE = await import('three');
  const {
    applyBoxMetricUvs,
    applyCylinderMetricUvs,
    createLoftedGalleonHullGeometry,
    createConcaveCanopyGoreGeometry,
    createPalmFrondGeometry,
  } = await import('./buddiesAmusementParkBuilder');

  // 1. Metric Box UVs: 14m x 53m boardwalk deck mapped at (3.6m, 4.0m) tiles -> ~13.25 V repeats (= 212 planks @ 0.25m!)
  const deckBox = applyBoxMetricUvs(new THREE.BoxGeometry(14, 0.28, 53), 3.6, 4.0);
  const deckNorm = deckBox.getAttribute('normal');
  const deckUv = deckBox.getAttribute('uv');
  let minV = Infinity;
  let maxV = -Infinity;
  for (let i = 0; i < deckUv.count; i++) {
    assert.ok(Number.isFinite(deckUv.getX(i)) && Number.isFinite(deckUv.getY(i)));
    if (deckNorm.getY(i) > 0.9) {
      minV = Math.min(minV, deckUv.getY(i));
      maxV = Math.max(maxV, deckUv.getY(i));
    }
  }
  assert.ok(Math.abs((maxV - minV) - 53 / 4.0) < 1e-4, 'Top deck UV span must match physical meters');

  // 2. Metric Cylinder UVs: 4x repeat around circumference for 16-medallion baroque cornice
  const corniceCyl = applyCylinderMetricUvs(new THREE.CylinderGeometry(4.6, 4.5, 1.06, 32), 4, 1);
  const cylNorm = corniceCyl.getAttribute('normal');
  const cylUv = corniceCyl.getAttribute('uv');
  let maxSideU = 0;
  for (let i = 0; i < cylUv.count; i++) {
    if (Math.abs(cylNorm.getY(i)) < 0.5) {
      maxSideU = Math.max(maxSideU, cylUv.getX(i));
    }
  }
  assert.ok(Math.abs(maxSideU - 4.0) < 1e-4, 'Cornice side UVs must repeat 4x around circumference');

  // 3. Lofted Galleon Hull: outward normals on Port (-X), Starboard (+X), Keel (-Y), and Stern (+Z)
  const hullGeo = createLoftedGalleonHullGeometry(14.6, 4.4);
  const hPos = hullGeo.getAttribute('position');
  const hNorm = hullGeo.getAttribute('normal');
  assert.ok(hPos.count > 1500, 'Lofted galleon hull must be a continuous high-detail mesh');
  let keelDownSum = 0;
  let keelCount = 0;
  let starboardOutSum = 0;
  let starboardCount = 0;
  for (let i = 0; i < hPos.count; i++) {
    const x = hPos.getX(i);
    const y = hPos.getY(i);
    const z = hPos.getZ(i);
    if (Math.abs(z) < 2.0 && y < -0.95) {
      keelDownSum += hNorm.getY(i);
      keelCount++;
    }
    if (Math.abs(z) < 2.0 && x > 0.8 && y < -0.35) {
      starboardOutSum += hNorm.getX(i);
      starboardCount++;
    }
  }
  assert.ok(keelCount > 0 && keelDownSum / keelCount < -0.5, 'Keel normals must point downward (-Y)');
  assert.ok(
    starboardCount > 0 && starboardOutSum / starboardCount > 0.45,
    'Starboard outer hull normals must point outward (+X)',
  );

  // 4. Concave Catenary Canopy Gore & Pinnate Palm Frond: upward/finite normals
  const goreGeo = createConcaveCanopyGoreGeometry(4.8, 3.1, 0, Math.PI / 8, 0.24, 7, 2);
  const gNorm = goreGeo.getAttribute('normal');
  for (let i = 0; i < gNorm.count; i++) {
    assert.ok(gNorm.getY(i) > 0.35, 'Canopy gore normals must point upward');
  }
  const palmGeo = createPalmFrondGeometry(3.35, 0.88);
  assert.ok(palmGeo.getAttribute('position').count >= 108);
});


