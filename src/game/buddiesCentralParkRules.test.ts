import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  CENTRAL_PARK_BENCHES,
  CENTRAL_PARK_BOTANICAL_BEDS,
  CENTRAL_PARK_CANOPY_TREES,
  CENTRAL_PARK_FENCE_RUNS,
  CENTRAL_PARK_LAMPPOSTS,
  CENTRAL_PARK_MASTERPLAN,
  CENTRAL_PARK_PERIMETER_VERTICES,
  CENTRAL_PARK_PROP_RELOCATION_MANIFEST,
  CENTRAL_PARK_SEAT_SPOTS,
  CENTRAL_PARK_TREE_RELOCATION_MANIFEST,
  evaluateCentralParkElevation,
  getCentralParkGrassExclusionBoxes,
  getCentralParkObstacles,
  isPointInsideCentralIslandEnvelope,
  isPointInsideCentralParkPolygon,
} from './buddiesCentralParkRules';
import { DEFAULT_ARENA_MAP_LAYOUT } from './buddiesBlitzWorldBuilder';
import {
  CENTRAL_PARK_TRANSIT_KIOSK_SPEC,
  PUBLIC_WARZONE_CRATE_PADS,
  pointInObb2D,
} from './buddiesBlitzRules';
import {
  evaluateBlitzGrassMask,
  evaluateHaltePlatformSdf,
  evaluateNwLakeSdf,
  evaluateOuterEmbankmentSdf,
  evaluateRoadNetworkSdf,
  evaluateSeHarborSdf,
  evaluateWestPowerPlantSdf,
} from './buddiesPlanetCurvature';

test('Lossless tree relocation preserves all 51 map trees with zero central-island overlap and valid SDF & pairwise clearances', () => {
  const trees = DEFAULT_ARENA_MAP_LAYOUT.props.filter(
    (p) => p.kind === 'tree_purple' || p.kind === 'tree_gold',
  );
  const purpleTrees = trees.filter((p) => p.kind === 'tree_purple');
  const goldTrees = trees.filter((p) => p.kind === 'tree_gold');

  assert.equal(trees.length, 51, 'Zero trees may be deleted from DEFAULT_ARENA_MAP_LAYOUT');
  assert.equal(purpleTrees.length, 24, 'All 24 pink/purple sakura trees must remain intact');
  assert.equal(goldTrees.length, 27, 'All 27 golden trees must remain intact');

  const byId = new Map(DEFAULT_ARENA_MAP_LAYOUT.props.map((p) => [p.id, p]));
  for (const entry of CENTRAL_PARK_TREE_RELOCATION_MANIFEST) {
    const actual = byId.get(entry.id);
    assert.ok(actual, `Relocated tree #${entry.id} must exist in DEFAULT_ARENA_MAP_LAYOUT`);
    assert.equal(actual.kind, entry.kind);
    assert.equal(actual.x, entry.toX, `Tree #${entry.id} x must match relocation manifest`);
    assert.equal(actual.z, entry.toZ, `Tree #${entry.id} z must match relocation manifest`);
  }
  for (const propEntry of CENTRAL_PARK_PROP_RELOCATION_MANIFEST) {
    const actual = byId.get(propEntry.id);
    assert.ok(actual, `Relocated prop #${propEntry.id} must exist in DEFAULT_ARENA_MAP_LAYOUT`);
    assert.equal(actual.kind, propEntry.kind);
    assert.equal(actual.x, propEntry.toX);
    assert.equal(actual.z, propEntry.toZ);
  }

  const centralProps = DEFAULT_ARENA_MAP_LAYOUT.props.filter((p) =>
    isPointInsideCentralIslandEnvelope(p.x, p.z),
  );
  assert.deepEqual(centralProps, [], 'No legacy props or trees may remain inside the Central Urban Plaza island');

  for (const t of trees) {
    assert.ok(evaluateRoadNetworkSdf(t.x, t.z) >= 2.2, `Tree #${t.id} too close to asphalt road`);
    assert.ok(evaluateNwLakeSdf(t.x, t.z) >= 1.0, `Tree #${t.id} inside NW lake`);
    assert.ok(evaluateOuterEmbankmentSdf(t.x, t.z) <= -1.8, `Tree #${t.id} on embankment cliff`);
    assert.ok(evaluateHaltePlatformSdf(t.x, t.z) >= 1.2, `Tree #${t.id} on tram/sidewalk platform`);
    assert.ok(evaluateSeHarborSdf(t.x, t.z).waterSdf >= 2.0, `Tree #${t.id} in East ocean`);
    assert.ok(evaluateWestPowerPlantSdf(t.x, t.z) >= 1.5, `Tree #${t.id} inside West Plaza`);
    assert.ok(evaluateBlitzGrassMask(t.x, t.z) >= 0.6, `Tree #${t.id} outside green grass mask`);
    const minPad = Math.min(...PUBLIC_WARZONE_CRATE_PADS.map((pad) => Math.hypot(t.x - pad.x, t.z - pad.z)));
    assert.ok(minPad >= 4.8, `Tree #${t.id} overlaps Warzone Shield Pad (dist=${minPad.toFixed(2)})`);
  }

  let minPairDist = Infinity;
  for (let i = 0; i < trees.length; i++) {
    for (let j = i + 1; j < trees.length; j++) {
      const d = Math.hypot(trees[i].x - trees[j].x, trees[i].z - trees[j].z);
      if (d < minPairDist) minPairDist = d;
      assert.ok(d >= 7.5, `Trees #${trees[i].id} and #${trees[j].id} too crowded (${d.toFixed(2)}m)`);
    }
  }
  assert.ok(minPairDist >= 7.5);
});

test('Central Urban Plaza masterplan geometry, buildings, fountain, pergola pond, lawn bed, benches, lamps & sakura trees stay inside polygon and clear of roads', () => {
  assert.equal(CENTRAL_PARK_PERIMETER_VERTICES.length, 12);
  assert.equal(CENTRAL_PARK_FENCE_RUNS.length, 0, 'Open walkable Urban Plaza must have zero perimeter iron fences');

  for (const [vx, vz] of CENTRAL_PARK_PERIMETER_VERTICES) {
    assert.ok(
      evaluateRoadNetworkSdf(vx, vz) >= -1.1,
      `Perimeter vertex (${vx}, ${vz}) extends past road curb shoulder`,
    );
    assert.ok(
      evaluateHaltePlatformSdf(vx, vz) >= 0.35,
      `Perimeter vertex (${vx}, ${vz}) encroaches tram sidewalk`,
    );
  }

  const checkInsideAndClear = (label: string, x: number, z: number, roadMargin = 1.2) => {
    assert.equal(isPointInsideCentralParkPolygon(x, z), true, `${label} (${x},${z}) must sit inside Urban Plaza polygon`);
    assert.ok(evaluateRoadNetworkSdf(x, z) >= roadMargin, `${label} too close to asphalt road`);
    assert.ok(evaluateHaltePlatformSdf(x, z) >= 0.8, `${label} too close to tram sidewalk`);
  };

  const mp = CENTRAL_PARK_MASTERPLAN;
  checkInsideAndClear('Civic Cascade Fountain', mp.fountainPlaza.x, mp.fountainPlaza.z, 10.0);
  checkInsideAndClear('Timber Pergola & Lily Pond', mp.pergolaPond.centerX, mp.pergolaPond.centerZ, 4.0);
  checkInsideAndClear('Boutique Rooftop Tower', mp.boutiqueTower.x, mp.boutiqueTower.z, 4.0);
  checkInsideAndClear('Cozy Bites Cafe Pavilion', mp.cozyCafePavilion.x, mp.cozyCafePavilion.z, 4.0);
  checkInsideAndClear('Beauty Salon Studio', mp.beautySalon.x, mp.beautySalon.z, 4.0);

  // Verify building footprint corners sit cleanly inside the 12-vertex plaza polygon
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    checkInsideAndClear(
      `Boutique Tower corner (${sx},${sz})`,
      mp.boutiqueTower.x + sx * mp.boutiqueTower.halfX,
      mp.boutiqueTower.z + sz * mp.boutiqueTower.halfZ,
      1.2,
    );
    checkInsideAndClear(
      `Cozy Cafe corner (${sx},${sz})`,
      mp.cozyCafePavilion.x + sx * mp.cozyCafePavilion.halfX,
      mp.cozyCafePavilion.z + sz * mp.cozyCafePavilion.halfZ,
      1.2,
    );
    checkInsideAndClear(
      `Beauty Salon corner (${sx},${sz})`,
      mp.beautySalon.x + sx * mp.beautySalon.halfX,
      mp.beautySalon.z + sz * mp.beautySalon.halfZ,
      1.2,
    );
  }

  assert.equal(mp.bistroTables.length, 4, 'Cozy Bites patio must include 4 outdoor bistro tables');
  for (const tbl of mp.bistroTables) {
    checkInsideAndClear(tbl.id, tbl.x, tbl.z, 2.0);
  }

  const waveBenches = CENTRAL_PARK_BENCHES.filter((b) => b.style === 'solid_wave');
  const teakBenches = CENTRAL_PARK_BENCHES.filter((b) => b.style === 'classic_teak');
  assert.equal(waveBenches.length, 6, 'Expected 6 sculpted solid_wave stone benches');
  assert.equal(teakBenches.length, 4, 'Expected 4 classic_teak benches');
  for (const bench of CENTRAL_PARK_BENCHES) {
    checkInsideAndClear(bench.id, bench.x, bench.z, 1.8);
  }

  assert.equal(CENTRAL_PARK_LAMPPOSTS.length, 10, 'Expected 10 dual-basket bronze lampposts');
  for (const lamp of CENTRAL_PARK_LAMPPOSTS) {
    checkInsideAndClear(lamp.id, lamp.x, lamp.z, 1.5);
  }

  const sakuraTrees = CENTRAL_PARK_CANOPY_TREES.filter((t) => t.species === 'pink_sakura');
  const oakTrees = CENTRAL_PARK_CANOPY_TREES.filter((t) => t.species === 'mature_oak');
  assert.ok(sakuraTrees.length >= 6, `Expected >= 6 pink_sakura trees, got ${sakuraTrees.length}`);
  assert.equal(oakTrees.length, 3, `Expected 3 mature_oak trees, got ${oakTrees.length}`);
  for (const tree of CENTRAL_PARK_CANOPY_TREES) {
    checkInsideAndClear(tree.id, tree.x, tree.z, 2.5);
  }

  // Relocated oak tree must sit cleanly off the Beauty Salon plot with ample pairwise tree & building clearance
  const relocatedOak = CENTRAL_PARK_CANOPY_TREES.find((t) => t.id === 'urban_oak_lawn_sw')!;
  assert.ok(relocatedOak, 'Expected relocated oak urban_oak_lawn_sw');
  assert.ok(
    Math.hypot(relocatedOak.x - mp.beautySalon.x, relocatedOak.z - mp.beautySalon.z) >= 12.0,
    'Relocated oak must sit well clear of the Beauty Salon plot',
  );
  for (const tree of CENTRAL_PARK_CANOPY_TREES) {
    if (tree.id !== relocatedOak.id) {
      assert.ok(
        Math.hypot(tree.x - relocatedOak.x, tree.z - relocatedOak.z) >= 7.5,
        `Relocated oak too close to ${tree.id}`,
      );
    }
  }
  const flankingWest = CENTRAL_PARK_CANOPY_TREES.find((t) => t.id === 'urban_sakura_south_sw')!;
  const flankingEast = CENTRAL_PARK_CANOPY_TREES.find((t) => t.id === 'urban_oak_southeast')!;
  assert.ok(
    mp.beautySalon.x - mp.beautySalon.halfX - flankingWest.x >= 4.6,
    'West flanking sakura trunk must keep >= 4.6m clearance from Beauty Salon west wall',
  );
  assert.ok(
    flankingEast.x - (mp.beautySalon.x + mp.beautySalon.halfX) >= 4.6,
    'East flanking oak trunk must keep >= 4.6m clearance from Beauty Salon east wall',
  );

  for (const bed of CENTRAL_PARK_BOTANICAL_BEDS) {
    checkInsideAndClear(bed.id, bed.x, bed.z, 1.4);
  }
  assert.ok(CENTRAL_PARK_BOTANICAL_BEDS.some((b) => b.species === 'english_rose'));
  assert.ok(CENTRAL_PARK_BOTANICAL_BEDS.some((b) => b.species === 'hydrangea'));
  assert.ok(CENTRAL_PARK_BOTANICAL_BEDS.some((b) => b.species === 'english_lavender'));

  assert.ok(mp.fountainPlaza.plazaOuterRadius >= 8.0);
  for (const [gateName, gate] of Object.entries(mp.gates)) {
    assert.ok(gate.halfWidth >= 3.0, `Gate ${gateName} halfWidth must be >= 3.0m`);
  }
});

test('Urban Plaza promenade corridors, Fountain step elevation, OBB colliders, grass exclusions & seats validate cleanly', () => {
  const mp = CENTRAL_PARK_MASTERPLAN;
  const obstacles = getCentralParkObstacles();
  const ids = new Set(obstacles.map((o) => o.id));
  for (const expectedId of [
    'central_park_stone_fountain',
    'urban_plaza_boutique_tower',
    'urban_plaza_cozy_cafe',
    'central_park_duck_pond',
    'urban_plaza_beauty_salon',
    ...mp.bistroTables.map((t) => t.id),
    ...CENTRAL_PARK_BENCHES.map((b) => b.id),
    ...CENTRAL_PARK_LAMPPOSTS.map((l) => l.id),
    ...CENTRAL_PARK_CANOPY_TREES.map((t) => t.id),
  ]) {
    assert.ok(ids.has(expectedId), `Missing expected Urban Plaza collider ${expectedId}`);
  }

  // Open walkable corridors across all gates & around Fountain / Buildings / Pergola / Lawn Bed
  const walkableWaypoints: [string, number, number][] = [
    ['West Gate', mp.gates.west.x, mp.gates.west.z],
    ['West Esplanade Center', 0.0, 0.0],
    ['Boutique East Promenade', 21.0, 0.0],
    ['Fountain West Step Apron', mp.fountainPlaza.x - 4.5, 0.0],
    ['Fountain East Step Apron', mp.fountainPlaza.x + 4.5, 0.0],
    ['Cozy Cafe West Approach', 38.0, 0.0],
    ['East Gate', mp.gates.east.x, mp.gates.east.z],
    ['North Gate', mp.gates.north.x, mp.gates.north.z],
    ['Pergola South Promenade', 29.5, -9.2],
    ['South Lawn North Promenade', 29.5, 8.2],
    ['Beauty Salon West Promenade', mp.beautySalon.x - mp.beautySalon.halfX - 1.8, mp.beautySalon.z],
    ['Beauty Salon East Promenade', mp.beautySalon.x + mp.beautySalon.halfX + 1.8, mp.beautySalon.z],
    ['South Gate', mp.gates.south.x, mp.gates.south.z],
  ];
  for (const [label, wx, wz] of walkableWaypoints) {
    for (const obb of obstacles) {
      assert.equal(
        pointInObb2D(wx, wz, obb.x, obb.z, obb.halfX, obb.halfZ, obb.rotY, 0.25),
        false,
        `Walkable point ${label} (${wx}, ${wz}) blocked by ${obb.id}`,
      );
    }
  }

  // Verify zero relocated benches, lamps, botanical beds, or trees overlap the Beauty Salon OBB
  const salonObb = obstacles.find((o) => o.id === 'urban_plaza_beauty_salon')!;
  assert.ok(salonObb);
  for (const item of [
    ...CENTRAL_PARK_BENCHES,
    ...CENTRAL_PARK_LAMPPOSTS,
    ...CENTRAL_PARK_BOTANICAL_BEDS,
    ...CENTRAL_PARK_CANOPY_TREES,
  ]) {
    assert.equal(
      pointInObb2D(item.x, item.z, salonObb.x, salonObb.z, salonObb.halfX, salonObb.halfZ, salonObb.rotY, 1.0),
      false,
      `Plaza prop ${item.id} encroaches Beauty Salon OBB`,
    );
  }

  // Fountain step elevation smoothly ramps from 0.0m outside apron up to +0.32m near coping rim
  const fp = mp.fountainPlaza;
  assert.equal(evaluateCentralParkElevation(0.0, 0.0), 0.0);
  assert.equal(evaluateCentralParkElevation(fp.x + fp.apronRadius + 0.5, fp.z), 0.0);
  const stepLow = evaluateCentralParkElevation(fp.x + fp.apronRadius - 0.15, fp.z);
  const stepMid = evaluateCentralParkElevation(fp.x + (fp.apronRadius + fp.copingRadius) * 0.5, fp.z);
  const stepTop = evaluateCentralParkElevation(fp.x + fp.copingRadius + 0.05, fp.z);
  assert.ok(stepLow > 0.0 && stepLow < stepMid);
  assert.ok(stepMid < stepTop && stepTop <= 0.32);
  assert.equal(stepTop, 0.32);

  // Every seat spot stand-up position is clear of all colliders
  assert.equal(CENTRAL_PARK_SEAT_SPOTS.length, CENTRAL_PARK_BENCHES.length);
  for (const spot of CENTRAL_PARK_SEAT_SPOTS) {
    for (const obb of obstacles) {
      assert.equal(
        pointInObb2D(spot.standUpX, spot.standUpZ, obb.x, obb.z, obb.halfX, obb.halfZ, obb.rotY, 0.15),
        false,
        `Seat ${spot.id} stand-up (${spot.standUpX}, ${spot.standUpZ}) blocked by ${obb.id}`,
      );
    }
  }

  // Grass exclusions cover the enlarged 12-vertex Urban Plaza tightly in <= 6 boxes
  const exclusions = getCentralParkGrassExclusionBoxes();
  assert.ok(exclusions.length >= 4 && exclusions.length <= 6);
  for (const ex of exclusions) {
    assert.ok(Number.isFinite(ex.x) && Number.isFinite(ex.z) && ex.halfLen > 0 && ex.halfWidth > 0);
  }
  const pointInExclusions = (px: number, pz: number) =>
    exclusions.some((b) => {
      const dx = px - b.x;
      const dz = pz - b.z;
      const c = Math.cos(b.yaw);
      const s = Math.sin(b.yaw);
      const af = Math.abs(dx * c - dz * s) - b.halfLen;
      const ar = Math.abs(dx * s + dz * c) - b.halfWidth;
      return af <= 0 && ar <= 0;
    });
  for (const [qx, qz] of [
    [-8.5, 5.0],
    [5.0, -8.5],
    [12.2, -0.4],
    [19.5, -18.5],
    [29.5, 0.0],
    [29.5, 14.0],
    [29.5, -14.8],
    [45.2, -0.6],
    [42.0, 18.0],
    [55.5, 5.5],
  ] as const) {
    assert.equal(pointInExclusions(qx, qz), true, `Urban Plaza interior point (${qx}, ${qz}) must be excluded from wild grass`);
  }

  // Central Park standalone Transit Kiosk & arrival spawn sit cleanly on open plaza terrazzo clear of all obstacles
  assert.equal(
    isPointInsideCentralParkPolygon(CENTRAL_PARK_TRANSIT_KIOSK_SPEC.kioskX, CENTRAL_PARK_TRANSIT_KIOSK_SPEC.kioskZ),
    true,
    'Central Park Transit Kiosk must sit inside the 12-vertex Central Park plaza polygon',
  );
  assert.equal(
    isPointInsideCentralParkPolygon(CENTRAL_PARK_TRANSIT_KIOSK_SPEC.spawnX, CENTRAL_PARK_TRANSIT_KIOSK_SPEC.spawnZ),
    true,
    'Central Park Transit Kiosk arrival spawn must sit inside the 12-vertex Central Park plaza polygon',
  );
  for (const obb of obstacles) {
    assert.equal(
      pointInObb2D(
        CENTRAL_PARK_TRANSIT_KIOSK_SPEC.kioskX,
        CENTRAL_PARK_TRANSIT_KIOSK_SPEC.kioskZ,
        obb.x,
        obb.z,
        obb.halfX,
        obb.halfZ,
        obb.rotY,
        0.95,
      ),
      false,
      `Central Park Transit Kiosk overlaps or sits too close to ${obb.id}`,
    );
    assert.equal(
      pointInObb2D(
        CENTRAL_PARK_TRANSIT_KIOSK_SPEC.spawnX,
        CENTRAL_PARK_TRANSIT_KIOSK_SPEC.spawnZ,
        obb.x,
        obb.z,
        obb.halfX,
        obb.halfZ,
        obb.rotY,
        0.55,
      ),
      false,
      `Central Park Transit arrival spawn blocked by ${obb.id}`,
    );
  }
});

test('buildCentralBotanicalPark3D constructs Terrazzo plaza, Cascade Fountain, Wave benches, Bronze lamps, Sakura & Oak InstancedMeshes with zero NaNs and clean dispose', async () => {
  const { buildCentralBotanicalPark3D } = await import('./buddiesCentralParkBuilder');
  const {
    bakeStaticGroupMeshes,
    createBlitzStrokeMesh,
    getSharedFallbackFoliageMaskTexture,
    getWaterBasinRippleTexture,
    getWaterCascadeSheetTexture,
    upgradeMeshToBlitzWorldMaterial,
  } = await import('./buddiesBlitzShadersAndAssets');

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
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({ width: 256, height: 256, getContext: () => stubCtx }),
  };

  try {
    const windUniforms = {
      uTime: { value: 0 },
      uWindPhase: { value: 0 },
      uWindDirection: { value: new THREE.Vector2(0.7071, 0.7071) },
      uWindStrength: { value: 0.32 },
      uWindGust: { value: 0.15 },
      uLightDirection: { value: new THREE.Vector3(0.4, 0.85, 0.3).normalize() },
      uLightColor: { value: new THREE.Color('#fff4c8') },
      uShadowColor: { value: new THREE.Color('#3b6e52') },
    };

    const park = buildCentralBotanicalPark3D({
      windUniforms,
      isSoftwareGl: false,
      leafMaskTexture: getSharedFallbackFoliageMaskTexture(),
      waterCascadeTex: getWaterCascadeSheetTexture(),
      waterRippleTex: getWaterBasinRippleTexture(),
      upgradeMeshToBlitzWorldMaterial,
      createBlitzStrokeMesh,
      bakeStaticGroupMeshes,
    });

    assert.equal(park.group.name, 'CentralBotanicalPark3D');
    assert.ok(park.stats.instancedMeshes >= 7, `Expected >= 7 instanced batches, got ${park.stats.instancedMeshes}`);
    assert.ok(park.stats.totalBotanicalInstances >= 180, `Expected >= 180 botanical instances, got ${park.stats.totalBotanicalInstances}`);

    const instancedNames: string[] = [];
    const instanceCounts = new Map<string, number>();
    let meshCount = 0;

    park.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        meshCount++;
        const geo = obj.geometry;
        for (const attrName of ['position', 'normal', 'uv'] as const) {
          const attr = geo.getAttribute(attrName);
          if (attr) {
            const arr = attr.array as ArrayLike<number>;
            for (let i = 0; i < arr.length; i++) {
              assert.equal(Number.isFinite(arr[i]), true, `Non-finite ${attrName} value on mesh ${obj.name}`);
            }
          }
        }
      }

      if (obj instanceof THREE.InstancedMesh) {
        instancedNames.push(obj.name);
        instanceCounts.set(obj.name, obj.count);
        assert.equal(obj.frustumCulled, true, `InstancedMesh ${obj.name} must enable frustumCulled`);
        assert.ok(obj.boundingSphere && Number.isFinite(obj.boundingSphere.radius) && obj.boundingSphere.radius > 0);
        const imArr = obj.instanceMatrix.array;
        for (let i = 0; i < imArr.length; i++) {
          assert.equal(Number.isFinite(imArr[i]), true, `Non-finite instanceMatrix on ${obj.name}`);
        }
        const mat = obj.material as THREE.ShaderMaterial;
        if (mat.isShaderMaterial) {
          assert.equal(mat.fog, true, `ShaderMaterial on ${obj.name} must support linear scene.fog`);
        }
        if (
          obj.name === 'CentralParkEnglishRosesInstanced' ||
          obj.name === 'CentralParkHydrangeasInstanced' ||
          obj.name === 'CentralParkEnglishLavenderInstanced' ||
          obj.name === 'CentralParkClimbingWisteriaInstanced' ||
          obj.name === 'CentralParkPondReedsInstanced'
        ) {
          assert.ok(obj.geometry.getAttribute('aPartKind'), `${obj.name} must expose aPartKind for leaf/petal venation`);
        }
      }
    });

    assert.ok(meshCount >= 10, `Expected baked static + animated + instanced meshes, got ${meshCount}`);
    assert.equal(instancedNames.includes('CentralParkIronPicketsInstanced'), false, 'Open Urban Plaza must have zero iron perimeter fences');
    for (const expectedName of [
      'CentralParkSakuraCanopyInstanced',
      'CentralParkOakCanopyInstanced',
      'CentralParkHedgeShrubsInstanced',
      'CentralParkEnglishRosesInstanced',
      'CentralParkHydrangeasInstanced',
      'CentralParkEnglishLavenderInstanced',
      'CentralParkLanternNightGlowInstanced',
    ]) {
      assert.ok(instancedNames.includes(expectedName), `Missing expected InstancedMesh ${expectedName}`);
    }
    assert.ok((instanceCounts.get('CentralParkSakuraCanopyInstanced') ?? 0) >= 48, 'Expected 6 sakura trees * >= 8 crown clusters');
    assert.ok((instanceCounts.get('CentralParkOakCanopyInstanced') ?? 0) >= 24, 'Expected 3 oak trees * >= 8 crown clusters');
    assert.equal(instanceCounts.get('CentralParkLanternNightGlowInstanced'), 10, 'Expected 10 lamppost halos');
    // Beauty Salon exterior is the owner Glow Studio GLB mount (the procedural
    // glass host only appears if the GLB fails to load and the fallback runs).
    assert.ok(park.group.getObjectByName('UrbanPlazaBeautySalonGlb3D'), 'Missing Beauty Salon GLB mount');

    // Verify flanking tree canopies clear Beauty Salon 1F podium and 2F upper story with zero clipping
    const bs = CENTRAL_PARK_MASTERPLAN.beautySalon;
    const salonBox1F = new THREE.Box3(
      new THREE.Vector3(bs.x - bs.halfX, 0, bs.z - bs.halfZ),
      new THREE.Vector3(bs.x + bs.halfX, bs.groundFloorHeight + 0.02, bs.z + bs.halfZ),
    );
    const salonBox2F = new THREE.Box3(
      new THREE.Vector3(bs.x - bs.upperHalfX, bs.groundFloorHeight + 0.02, bs.z - bs.upperHalfZ),
      new THREE.Vector3(bs.x + bs.upperHalfX, bs.totalHeight, bs.z + bs.upperHalfZ),
    );
    const mat4 = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    for (const canopyName of ['CentralParkSakuraCanopyInstanced', 'CentralParkOakCanopyInstanced']) {
      const canopyInst = park.group.getObjectByName(canopyName) as THREE.InstancedMesh;
      for (let i = 0; i < canopyInst.count; i++) {
        canopyInst.getMatrixAt(i, mat4);
        mat4.decompose(pos, new THREE.Quaternion(), scl);
        const approxRadius = Math.max(scl.x, scl.z) * 1.15;
        assert.ok(
          salonBox1F.distanceToPoint(pos) > approxRadius,
          `${canopyName}#${i} clips Beauty Salon 1F podium`,
        );
        assert.ok(
          salonBox2F.distanceToPoint(pos) > approxRadius,
          `${canopyName}#${i} clips Beauty Salon 2F upper story`,
        );
      }
    }

    const haloInst = park.group.getObjectByName('CentralParkLanternNightGlowInstanced') as THREE.InstancedMesh;
    assert.equal(
      haloInst.geometry.getAttribute('position').count,
      4,
      'Central Park lantern glow must be a camera-facing billboard quad, not a 0.46m low-poly sphere',
    );
    const haloMat = haloInst.material as THREE.ShaderMaterial;
    assert.equal(haloMat.isShaderMaterial, true);
    assert.equal(haloMat.blending, THREE.AdditiveBlending);
    assert.equal(haloMat.depthWrite, false);
    assert.equal(haloMat.transparent, true);
    assert.equal(haloMat.fog, true);

    park.update(0.0, 0.0);
    assert.equal(haloInst.visible, false, 'Lantern halos should remain off at noon');
    assert.equal(haloMat.uniforms.uOpacity.value, 0);

    park.update(1.0, 0.05);
    assert.equal(haloInst.visible, false, 'Lantern halos must remain hidden when nightFactor01 <= 0.05');
    assert.equal(haloMat.uniforms.uOpacity.value, 0);

    park.update(1.5, 0.14);
    assert.equal(haloInst.visible, true, 'Lantern halos should ramp on smoothly past 0.05');
    const earlyDuskOp = haloMat.uniforms.uOpacity.value as number;
    assert.ok(earlyDuskOp > 0 && earlyDuskOp < 0.35);

    park.update(2.4, 0.85);
    assert.equal(haloInst.visible, true, 'Lantern halos should illuminate at dusk/night');
    assert.ok((haloMat.uniforms.uOpacity.value as number) > 0.35);
    assert.ok(haloMat.opacity > 0.35);

    park.dispose();
  } finally {
    (globalThis as { document?: unknown }).document = origDocument;
  }
});
