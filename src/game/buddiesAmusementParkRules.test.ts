import test from 'node:test';
import assert from 'node:assert/strict';
import type * as THREE from 'three';
import {
  COASTAL_AMUSEMENT_PARK_MASTERPLAN,
  CARNIVAL_MIDWAY_STALLS,
  BIANGLALA_GONDOLA_PALETTE,
  AMUSEMENT_PARK_PALM_TREES,
  getNeTamanRiaShorelineX,
  evaluateAmusementBoardwalkElevation,
  isPointOnAmusementOverwaterPier,
  evaluateAmusementParkRideKinematics,
  getCoastalAmusementParkObstacles,
} from './buddiesAmusementParkRules';

test('Coastal Amusement Park masterplan reclaims northern coastal sand into ocean while keeping z = -15 Harbor Road Entrance clear', () => {
  const mp = COASTAL_AMUSEMENT_PARK_MASTERPLAN;
  // Claims northern Dermaga (z in [-46..-19.2]) and reclaimed northern beach (x up to 126.5m) + overwater pier
  assert.ok(mp.bounds.maxZ <= -19.0, 'Southern entrance must stay clear of z = -15 Harbor Road Entrance');
  assert.ok(mp.bounds.minZ <= -100.0, 'Park must span across the northern beach');
  assert.ok(mp.bianglalaPierDeck.maxX > 120.0, 'Bianglala pier must extend out over East Ocean');
  assert.ok(mp.gazeboFingerJetty.headMaxX > 128.0, 'Seaward finger pier gazebo must extend into ocean');
  // Reclaimed NE beach shoreline curves east past x = 125m across [-96..-54], returning to 110m at Bianglala bay & Harbor
  assert.equal(getNeTamanRiaShorelineX(-32.5), 110.0);
  assert.equal(getNeTamanRiaShorelineX(0.0), 110.0);
  assert.ok(getNeTamanRiaShorelineX(-75.0) >= 126.0);
  assert.ok(mp.rides.bumperCarArena.halfX >= 8.9 && mp.rides.bumperCarArena.halfZ >= 6.0, 'Bumper Car Arena must match ~18m x 12m blueprint');
  assert.ok(mp.rides.bumperCarArena.x + mp.rides.bumperCarArena.halfX > 110.0, 'Bumper Car Arena expands onto reclaimed ocean-to-sand land');
  assert.equal(BIANGLALA_GONDOLA_PALETTE.length, 16);
  assert.ok(CARNIVAL_MIDWAY_STALLS.some((s) => s.kind === 'popcorn_kiosk'));
  assert.ok(CARNIVAL_MIDWAY_STALLS.some((s) => s.kind === 'cotton_candy_cart'));
  assert.ok(AMUSEMENT_PARK_PALM_TREES.some((p) => p.x > 118.0), 'Palms should line reclaimed coastal beach');
});

test('Walkable boardwalk, 5 staircases, dual Kora-Kora stages, and over-water pier elevations transition smoothly', () => {
  // Cobblestone Midway stays at flat 0.0m ground level
  assert.equal(evaluateAmusementBoardwalkElevation(87.5, -32.0), 0.0);
  assert.equal(evaluateAmusementBoardwalkElevation(87.5, -56.0), 0.0);

  // Main Waterfront Boardwalk & Over-Water Pier sit at +1.10m
  assert.equal(evaluateAmusementBoardwalkElevation(109.0, -32.5), 1.1);
  assert.equal(evaluateAmusementBoardwalkElevation(118.2, -32.5), 1.1);
  assert.equal(evaluateAmusementBoardwalkElevation(127.4, -26.6), 1.1);

  // Kora-Kora dual docking platforms (West & East flanks) rise to +2.02m with smooth boarding stairs
  assert.equal(evaluateAmusementBoardwalkElevation(107.0, -57.5), 2.02);
  assert.equal(evaluateAmusementBoardwalkElevation(113.4, -57.5), 2.02);
  const koraWestMid = evaluateAmusementBoardwalkElevation(105.1, -57.5);
  assert.ok(koraWestMid > 1.2 && koraWestMid < 1.95);
  const koraEastMid = evaluateAmusementBoardwalkElevation(115.3, -57.5);
  assert.ok(koraEastMid > 1.2 && koraEastMid < 1.95);

  // Access stairs interpolate smoothly between 0.0m and +1.10m (including new seaward eastBeach steps)
  const midSouthStair = evaluateAmusementBoardwalkElevation(106.0, -19.9);
  assert.ok(midSouthStair > 0.25 && midSouthStair < 0.95);
  const midWestStair = evaluateAmusementBoardwalkElevation(100.3, -32.7);
  assert.ok(midWestStair > 0.25 && midWestStair < 0.95);
  const midEastBeachStair = evaluateAmusementBoardwalkElevation(118.2, -68.0);
  assert.ok(midEastBeachStair > 0.25 && midEastBeachStair < 0.95);

  // Over-water pier check allows walking on cantilevered boardwalk, Bianglala deck & Gazebo jetty, but not raw open ocean
  assert.equal(isPointOnAmusementOverwaterPier(114.0, -32.5), true);
  assert.equal(isPointOnAmusementOverwaterPier(122.0, -32.5), true);
  assert.equal(isPointOnAmusementOverwaterPier(127.4, -26.6), true);
  assert.equal(isPointOnAmusementOverwaterPier(118.0, 0.0), false);
  assert.equal(isPointOnAmusementOverwaterPier(122.0, -60.0), false);
});

test('All 5 ride kinematics stay bounded, upright-compensated, and inside 18m x 12.4m arena limits across time', () => {
  for (const t of [0, 1.25, 3.7, 9.4, 24.8]) {
    const k = evaluateAmusementParkRideKinematics(t);
    assert.ok(Math.abs(k.bianglalaWheelAngleRad + k.bianglalaGondolaCounterAngleRad) < 1e-9);
    assert.ok(Math.abs(k.koraKoraSwingAngleRad) <= 0.60);
    assert.equal(k.komidiPutarHorseBobsM.length, 10);
    for (const bob of k.komidiPutarHorseBobsM) {
      assert.ok(bob >= -0.001 && bob <= 0.40);
    }
    assert.equal(k.ontagAntingChairFlareRad.length, 16);
    for (const flare of k.ontagAntingChairFlareRad) {
      assert.ok(flare > 0.20 && flare < 0.60);
    }
    // All 5 moving Bumper Cars stay strictly inside the conductive floor (±7.6m x ±4.9m) & clear of East Parking Zone (localX > +4.5m)
    assert.equal(k.bumperCars.length, 5);
    for (const car of k.bumperCars) {
      assert.ok(car.localX >= -6.4 && car.localX <= 4.3, `Car ${car.index} localX out of active driving bounds: ${car.localX}`);
      assert.ok(Math.abs(car.localZ) <= 3.9, `Car ${car.index} localZ out of bounds: ${car.localZ}`);
    }
  }

  const k0 = evaluateAmusementParkRideKinematics(0);
  const b0 = k0.bianglalaWheelAngleRad;
  const s0 = k0.koraKoraSwingAngleRad;
  const c0x = k0.bumperCars[0].localX;
  const k1 = evaluateAmusementParkRideKinematics(1.5);
  assert.notEqual(k1.bianglalaWheelAngleRad, b0);
  assert.notEqual(k1.koraKoraSwingAngleRad, s0);
  assert.notEqual(k1.bumperCars[0].localX, c0x);
});

test('Amusement park colliders keep Entrance Archway, Midway spine, staircases, and pairwise hero rides unobstructed', () => {
  const obstacles = getCoastalAmusementParkObstacles();
  assert.ok(obstacles.length >= 30);

  const pointHitsObstacle = (px: number, pz: number) =>
    obstacles.some(
      (o) => Math.abs(px - o.x) <= o.halfX + 0.3 && Math.abs(pz - o.z) <= o.halfZ + 0.3,
    );

  // Center of Entrance Archway (87.5, -20.4) and South Midway promenade are clear
  assert.equal(pointHitsObstacle(87.5, -20.4), false);
  assert.equal(pointHitsObstacle(87.5, -28.0), false);
  assert.equal(pointHitsObstacle(87.5, -35.0), false);
  // Stair openings onto boardwalk & beach are clear
  assert.equal(pointHitsObstacle(106.0, -19.9), false);
  assert.equal(pointHitsObstacle(100.3, -32.7), false);
  assert.equal(pointHitsObstacle(100.3, -47.2), false);
  assert.equal(pointHitsObstacle(108.0, -75.7), false);
  assert.equal(pointHitsObstacle(118.2, -68.0), false);
  // Kora-Kora West & East boarding stages & stairs are clear
  assert.equal(pointHitsObstacle(106.9, -57.5), false);
  assert.equal(pointHitsObstacle(113.5, -57.5), false);

  // Zero OBB overlap among the 5 hero ride cores
  const heroIds = [
    'taman_komidi_putar_core',
    'taman_ontag_anting_base',
    'taman_bumper_car_arena',
    'taman_kora_kora_hull_pit',
    'taman_bianglala_core',
  ];
  const heroes = heroIds.map((id) => obstacles.find((o) => o.id === id)!);
  assert.ok(heroes.every(Boolean));
  for (let i = 0; i < heroes.length; i++) {
    for (let j = i + 1; j < heroes.length; j++) {
      const a = heroes[i];
      const b = heroes[j];
      const overlapX = Math.abs(a.x - b.x) < a.halfX + b.halfX;
      const overlapZ = Math.abs(a.z - b.z) < a.halfZ + b.halfZ;
      assert.equal(overlapX && overlapZ, false, `Hero colliders ${a.id} and ${b.id} must not overlap`);
    }
  }
});

test('DEFAULT_ARENA_MAP_LAYOUT contains zero industrial props overlapping the Taman Ria footprint', async () => {
  const { DEFAULT_ARENA_MAP_LAYOUT } = await import('./buddiesBlitzWorldBuilder');
  const { bounds } = COASTAL_AMUSEMENT_PARK_MASTERPLAN;
  const overlapping = DEFAULT_ARENA_MAP_LAYOUT.props.filter(
    (p) => p.x >= bounds.minX && p.x <= bounds.maxX && p.z >= bounds.minZ && p.z <= bounds.maxZ,
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

  // 5. Kai Fish Market Coconut Palm Trunk & 16-Frond V-Fold Crown Geometry
  const { createKaiPalmTrunkGeometry, createKaiPalmCrownFrondsGeometry } = await import(
    './buddiesAmusementParkBuilder'
  );
  const kaiTrunk = createKaiPalmTrunkGeometry();
  assert.ok(kaiTrunk.topY > 4.5 && kaiTrunk.trunkGeo.getAttribute('position').count >= 150);
  const kaiCrown = createKaiPalmCrownFrondsGeometry();
  const kcNorm = kaiCrown.getAttribute('normal');
  assert.ok(kaiCrown.getAttribute('position').count >= 500);
  for (let i = 0; i < kcNorm.count; i++) {
    assert.ok(Number.isFinite(kcNorm.getX(i)) && Number.isFinite(kcNorm.getY(i)));
  }
});

test('buildCoastalAmusementPark3D builds full hero rides, Kai coconut palms, and frustum-culled InstancedMeshes with valid bounding spheres', async () => {
  const THREE = await import('three');
  const { buildCoastalAmusementPark3D } = await import('./buddiesAmusementParkBuilder');
  const { bakeStaticGroupMeshes, createBlitzStrokeMesh, upgradeMeshToBlitzWorldMaterial } =
    await import('./buddiesBlitzShadersAndAssets');

  // Provide minimal headless 2D canvas stub for procedural CanvasTextures in Node
  const origDocument = (globalThis as { document?: unknown }).document;
  const noop = () => {};
  const stubCtx = new Proxy(
    {
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      measureText: () => ({ width: 100 }),
    },
    {
      get(target, prop) {
        if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
        return noop;
      },
      set() {
        return true;
      },
    },
  );
  if (!origDocument) {
    (globalThis as { document?: unknown }).document = {
      createElement: () => ({ width: 256, height: 256, getContext: () => stubCtx }),
    };
  }

  try {
    const windUniforms = {
      uTime: { value: 0 },
      uWindPhase: { value: 0 },
      uWindDirection: { value: new THREE.Vector2(0.7, 0.7) },
      uWindStrength: { value: 0.5 },
      uWindGust: { value: 0.1 },
      uLightDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
      uLightColor: { value: new THREE.Color('#ffffff') },
      uShadowColor: { value: new THREE.Color('#2a2b36') },
    };

    const handle = buildCoastalAmusementPark3D({
      windUniforms,
      isSoftwareGl: false,
      upgradeMeshToBlitzWorldMaterial,
      createBlitzStrokeMesh,
      bakeStaticGroupMeshes,
    });

    for (const landmark of [
      'BianglalaRotatingWheel',
      'KoraKoraSwingAssembly',
      'KomidiPutarRotatingAssembly',
      'OntagAntingTiltCarrier',
      'TamanRiaKaiCoconutPalmFrondsBatch',
    ]) {
      assert.ok(handle.group.getObjectByName(landmark), `Missing ride/palm landmark: ${landmark}`);
    }

    let instancedCount = 0;
    let totalMeshes = 0;
    handle.group.updateMatrixWorld(true);
    handle.group.traverse((obj) => {
      if ((obj as THREE.InstancedMesh).isInstancedMesh) {
        const inst = obj as THREE.InstancedMesh;
        instancedCount++;
        assert.equal(inst.frustumCulled, true, 'All InstancedMeshes must have frustumCulled=true');
        assert.ok(inst.count > 0);
        assert.ok(inst.boundingSphere && Number.isFinite(inst.boundingSphere.radius) && inst.boundingSphere.radius > 0);
      } else if ((obj as THREE.Mesh).isMesh) {
        totalMeshes++;
      }
    });

    assert.ok(instancedCount >= 14, `Expected >= 14 InstancedMesh batches, got ${instancedCount}`);
    assert.ok(totalMeshes <= 145, `Expected baked draw calls <= 145, got ${totalMeshes}`);

    // Verify dynamic ride update advances transforms cleanly without NaNs
    const wheel = handle.group.getObjectByName('BianglalaRotatingWheel')!;
    const rot0 = wheel.rotation.z;
    handle.update(2.0);
    assert.notEqual(wheel.rotation.z, rot0);

    handle.dispose();
  } finally {
    if (!origDocument) {
      delete (globalThis as { document?: unknown }).document;
    }
  }
});

test('Pier slabs, carnival stalls, palm crowns, staircases, and East parked bumper cars maintain zero overlap', () => {
  const mp = COASTAL_AMUSEMENT_PARK_MASTERPLAN;

  // 1. Over-water timber pier decks abut cleanly edge-to-edge without coplanar slab overlap
  assert.equal(mp.gazeboFingerJetty.walkwayMinX, mp.bianglalaPierDeck.maxX);
  assert.equal(mp.gazeboFingerJetty.headMinX, mp.gazeboFingerJetty.walkwayMaxX);

  // 2. Stalls, stairs & ride envelopes have zero X-Z bounding intersection
  const solids: { name: string; minX: number; maxX: number; minZ: number; maxZ: number }[] = [
    {
      name: 'komidiPutar',
      minX: mp.rides.komidiPutar.x - 5.5,
      maxX: mp.rides.komidiPutar.x + 5.5,
      minZ: mp.rides.komidiPutar.z - 5.5,
      maxZ: mp.rides.komidiPutar.z + 5.5,
    },
    {
      name: 'ontagAnting',
      minX: mp.rides.ontagAnting.x - 7.05,
      maxX: mp.rides.ontagAnting.x + 7.05,
      minZ: mp.rides.ontagAnting.z - 7.05,
      maxZ: mp.rides.ontagAnting.z + 7.05,
    },
    {
      name: 'bumperCarArena',
      minX: mp.rides.bumperCarArena.x - mp.rides.bumperCarArena.halfX - 0.5,
      maxX: mp.rides.bumperCarArena.x + mp.rides.bumperCarArena.halfX + 0.5,
      minZ: mp.rides.bumperCarArena.z - mp.rides.bumperCarArena.halfZ - 0.5,
      maxZ: mp.rides.bumperCarArena.z + mp.rides.bumperCarArena.halfZ + 0.5,
    },
    {
      name: 'koraKora',
      minX: mp.rides.koraKora.x - 6.0,
      maxX: mp.rides.koraKora.x + 6.0,
      minZ: mp.rides.koraKora.z - 7.35,
      maxZ: mp.rides.koraKora.z + 7.35,
    },
  ];
  for (const s of CARNIVAL_MIDWAY_STALLS) {
    const rx = s.kind === 'cotton_candy_cart' ? 1.3 : s.kind === 'popcorn_kiosk' ? 1.5 : 2.0;
    const rz = s.kind === 'cotton_candy_cart' ? 1.0 : s.kind === 'popcorn_kiosk' ? 1.5 : 2.0;
    solids.push({ name: s.id, minX: s.x - rx, maxX: s.x + rx, minZ: s.z - rz, maxZ: s.z + rz });
  }
  for (const [key, st] of Object.entries(mp.stairs)) {
    solids.push({ name: `stair_${key}`, ...st });
  }
  for (let i = 0; i < solids.length; i++) {
    for (let j = i + 1; j < solids.length; j++) {
      const a = solids[i];
      const b = solids[j];
      const overlapX = Math.min(a.maxX, b.maxX) > Math.max(a.minX, b.minX);
      const overlapZ = Math.min(a.maxZ, b.maxZ) > Math.max(a.minZ, b.minZ);
      assert.equal(overlapX && overlapZ, false, `${a.name} overlaps ${b.name}`);
    }
  }

  // 3. Kai coconut palm crowns stay safely inland and clear of ride/building/boardwalk envelopes
  for (const palm of AMUSEMENT_PARK_PALM_TREES) {
    const frondR = 3.25 * palm.scale * 1.48 * 0.9;
    assert.ok(getNeTamanRiaShorelineX(palm.z) - palm.x >= 2.2, `${palm.id} too close to shoreline`);
    const bc = mp.rides.bumperCarArena;
    const clampBx = Math.max(bc.x - bc.halfX, Math.min(palm.x, bc.x + bc.halfX));
    const clampBz = Math.max(bc.z - bc.halfZ, Math.min(palm.z, bc.z + bc.halfZ));
    assert.ok(Math.hypot(palm.x - clampBx, palm.z - clampBz) >= frondR, `${palm.id} clips Bumper Car Arena`);
    const clampBwX = Math.max(mp.mainBoardwalk.minX, Math.min(palm.x, mp.mainBoardwalk.maxX));
    const clampBwZ = Math.max(mp.mainBoardwalk.minZ, Math.min(palm.z, mp.mainBoardwalk.maxZ));
    assert.ok(Math.hypot(palm.x - clampBwX, palm.z - clampBwZ) >= frondR, `${palm.id} clips mainBoardwalk`);
    assert.ok(Math.hypot(palm.x - mp.rides.ontagAnting.x, palm.z - mp.rides.ontagAnting.z) >= 7.5 + frondR, `${palm.id} clips Ontang-Anting`);
  }

  // 4. All 5 moving dodgems stay safely clear of the 4 East parked bumper cars (localX = 6.15)
  const parkedZs = [-3.3, -1.1, 1.1, 3.3];
  for (let t = 0; t <= 20; t += 0.2) {
    const kin = evaluateAmusementParkRideKinematics(t);
    for (const car of kin.bumperCars) {
      for (const pz of parkedZs) {
        assert.ok(
          Math.hypot(car.localX - 6.15, car.localZ - pz) >= 2.2,
          `Moving car ${car.index} grazed parked car at z=${pz}`,
        );
      }
    }
  }
});


