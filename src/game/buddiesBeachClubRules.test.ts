import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  BEACH_CLUB_MASTERPLAN,
  BEACH_CLUB_Z_MAX,
  BEACH_CLUB_Z_MIN,
  classifyBeachClubSurface,
  evaluateBeachClubElevation,
  evaluateBeachClubPoolWaterSdf,
  getBeachClubObstacles,
  isPointInBeachClubPoolWater,
} from './buddiesBeachClubRules';
import { buildCoastalBeachClub3D } from './buddiesBeachClubBuilder';
import {
  bakeStaticGroupMeshes,
  createBlitzStrokeMesh,
  upgradeMeshToBlitzWorldMaterial,
  type BlitzWindUniforms,
} from './buddiesBlitzShadersAndAssets';

function createTestWindUniforms(): BlitzWindUniforms {
  return {
    uTime: { value: 0 },
    uWindPhase: { value: 0 },
    uWindDirection: { value: new THREE.Vector2(Math.SQRT1_2, Math.SQRT1_2) },
    uWindStrength: { value: 0.35 },
    uWindGust: { value: 0.0 },
    uLightDirection: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
    uLightColor: { value: new THREE.Color('#fff4c8') },
    uShadowColor: { value: new THREE.Color('#3b6e52') },
  };
}

function withStubDocument<T>(fn: () => T): T {
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
    return fn();
  } finally {
    if (!origDocument) {
      delete (globalThis as { document?: unknown }).document;
    }
  }
}

test('BEACH_CLUB_MASTERPLAN seamlessly joins Kai Beach (+46.2) and East Outer Sidewalk (x = 78.35)', () => {
  assert.equal(BEACH_CLUB_Z_MIN, -98.0);
  assert.equal(BEACH_CLUB_Z_MAX, 46.2);
  assert.equal(BEACH_CLUB_MASTERPLAN.promenade.maxZ, 46.2);

  // Promenade west boundary (78.35m) meets East Outer Sidewalk (78.33m) and Kai's full boardwalk width (78.2m)
  assert.equal(BEACH_CLUB_MASTERPLAN.promenade.minX, 78.35);
  assert.equal(BEACH_CLUB_MASTERPLAN.stairFlights[0].id, 'stair_prom_kai_boardwalk');
  assert.equal(BEACH_CLUB_MASTERPLAN.stairFlights[0].minX, 78.35);

  // Widened western promenade strip (x = 80.0, z = 29.5) is walkable +0.02m stone_road with zero gap
  assert.ok(Math.abs(evaluateBeachClubElevation(80.0, 29.5) - 0.02) < 1e-6);
  assert.equal(classifyBeachClubSurface(80.0, 29.5), 'stone_road');

  assert.equal(BEACH_CLUB_MASTERPLAN.cabanas.length, 9);
  assert.equal(BEACH_CLUB_MASTERPLAN.sunkenPods.length, 6);
  assert.equal(BEACH_CLUB_MASTERPLAN.pools.southSeaPool.rotY, 0);
});

test('evaluateBeachClubPoolWaterSdf and evaluateBeachClubElevation enforce multi-tiered stepped contours, cascading pools, bridges & decks', () => {
  // 1. Inside Inner Lagoon Pool -> negative pool SDF & carved basin beneath water (-0.60m)
  const lapWaterX = 102.5;
  const lapWaterZ = -35.0;
  assert.ok(evaluateBeachClubPoolWaterSdf(lapWaterX, lapWaterZ) < -0.5);
  assert.equal(isPointInBeachClubPoolWater(lapWaterX, lapWaterZ), true);
  assert.ok(evaluateBeachClubElevation(lapWaterX, lapWaterZ) < -0.8, 'Pool basin must be carved beneath water');
  assert.equal(classifyBeachClubSurface(lapWaterX, lapWaterZ), 'water');

  // 1b. Deleted South Inner Pool area & West Lounge strip (x in [96.4..105.2], z=25.0) is uniformly dry -0.56m lounge terrace with zero floating +0.64m collision shelf
  for (const testX of [96.6, 98.2, 99.6, 102.0, 105.0]) {
    assert.equal(isPointInBeachClubPoolWater(testX, 25.0), false);
    assert.equal(classifyBeachClubSurface(testX, 25.0), 'stone_road');
    assert.ok(
      Math.abs(evaluateBeachClubElevation(testX, 25.0) - -0.56) < 1e-6,
      `Expected -0.56m at (${testX}, 25.0), got ${evaluateBeachClubElevation(testX, 25.0)}`,
    );
  }
  assert.equal(isPointInBeachClubPoolWater(113.6, 25.4), true);
  assert.equal(classifyBeachClubSurface(113.6, 25.4), 'water');

  // 2. Cascade tiers step down North-to-South (+0.36m -> +0.06m -> -0.22m) and Land-to-Sea!
  const cas1 = BEACH_CLUB_MASTERPLAN.pools.cascadeTier1;
  const cas2 = BEACH_CLUB_MASTERPLAN.pools.cascadeTier2;
  const cas3 = BEACH_CLUB_MASTERPLAN.pools.cascadeTier3;
  assert.ok(cas1.waterY > cas2.waterY && cas2.waterY > cas3.waterY);
  assert.ok(evaluateBeachClubElevation(95.0, -92.0) > evaluateBeachClubElevation(95.0, -86.0));
  assert.ok(evaluateBeachClubElevation(95.0, -92.0) > evaluateBeachClubElevation(105.0, -95.2));
  // Ground-level Promenade (+0.02m flush with roadside ground) steps up to VIP Mezzanine (+0.64m), then down to Sunbed Peninsula (-0.54m) > Ocean Terrace (-1.00m) > Beach Sand (-2.0m)
  const eProm = evaluateBeachClubElevation(87.5, 25.0);
  const eVip = evaluateBeachClubElevation(95.0, -30.0);
  const ePen = evaluateBeachClubElevation(108.5, -35.0);
  const eOceanEdge = evaluateBeachClubElevation(108.5, 43.8);
  const eSand = evaluateBeachClubElevation(126.0, 25.0);
  assert.ok(Math.abs(eProm - 0.02) < 1e-6, 'Promenade (+0.02m) must sit flush at roadside ground level');
  assert.ok(Math.abs(eVip - 0.64) < 1e-6, 'VIP Mezzanine must sit at +0.64m');
  assert.ok(Math.abs(ePen - -0.54) < 1e-6, 'Box 1 Sunbed Peninsula must sit at -0.54m (lowered by 1.0m)');
  assert.ok(Math.abs(eOceanEdge - -1.0) < 1e-6, 'Box 1 Seaward Terrace must sit at -1.00m');
  assert.ok(Math.abs(eSand - -2.0) < 1e-6, 'Box 2 Beach Sand must sit at -2.00m (lowered by 2.0m)');
  assert.ok(eVip > eProm && eVip > ePen && ePen > eOceanEdge && eOceanEdge > eSand);
  assert.equal(classifyBeachClubSurface(108.5, -35.0), 'wood');

  // 3. Elevated Crossing Bridge (+0.72m) spans over West pool cleanly (water SDF > 0)
  const br = BEACH_CLUB_MASTERPLAN.crossingBridge;
  const brMidX = (br.minX + br.maxX) * 0.5;
  const brMidZ = (br.minZ + br.maxZ) * 0.5;
  assert.ok(evaluateBeachClubPoolWaterSdf(brMidX, brMidZ) > 0);
  assert.equal(isPointInBeachClubPoolWater(brMidX, brMidZ), false);
  assert.ok(Math.abs(evaluateBeachClubElevation(brMidX, brMidZ) - 0.72) < 1e-6);
  assert.equal(classifyBeachClubSurface(brMidX, brMidZ), 'wood');

  // 4. Translucent Glass Skylight Dance Floor (-0.48m in Box 1)
  const sky = BEACH_CLUB_MASTERPLAN.skylightDanceFloor;
  const skyX = (sky.minX + sky.maxX) * 0.5;
  const skyZ = (sky.minZ + sky.maxZ) * 0.5;
  assert.ok(Math.abs(evaluateBeachClubElevation(skyX, skyZ) - -0.48) < 1e-6);

  // 5. Angled DJ Stage Pavilion (-0.04m in Box 1, +0.52m above -0.56m base deck) remains dry walkable wood above pool water
  const dj = BEACH_CLUB_MASTERPLAN.djStage;
  assert.ok(evaluateBeachClubPoolWaterSdf(dj.cx, dj.cz) > 0);
  assert.ok(Math.abs(evaluateBeachClubElevation(dj.cx, dj.cz) - -0.04) < 1e-6);
  assert.equal(classifyBeachClubSurface(dj.cx, dj.cz), 'wood');

  // 6. Cocktail Bar terrazzo podium (+0.68m) & Cabana plinths (+0.76m)
  const bar = BEACH_CLUB_MASTERPLAN.cocktailBar;
  assert.ok(Math.abs(evaluateBeachClubElevation(bar.cx, bar.cz) - 0.68) < 1e-6);
  const cab0 = BEACH_CLUB_MASTERPLAN.cabanas[0];
  assert.ok(Math.abs(evaluateBeachClubElevation(cab0.cx, cab0.cz) - 0.76) < 1e-6);

  // 7. Promenade & widened beach sand classifications
  assert.equal(classifyBeachClubSurface(87.5, -20.0), 'stone_road');
  assert.ok(Math.abs(evaluateBeachClubElevation(87.5, -20.0) - 0.02) < 1e-6);
  assert.equal(classifyBeachClubSurface(126.0, -20.0), 'sand');
  assert.equal(classifyBeachClubSurface(40.0, 0.0), 'none');
});

test('getBeachClubObstacles registers DJ Pavilion, Cocktail Bar, Cabana daybeds, Beach Sets, and Palms cleanly', () => {
  const obstacles = getBeachClubObstacles();
  const byId = new Map(obstacles.map((o) => [o.id, o]));

  for (const requiredId of [
    'beach_club_dj_glass_box',
    'beach_club_dj_booth',
    'beach_club_dj_speaker_w',
    'beach_club_dj_speaker_e',
    'beach_club_dj_backwall',
    'beach_club_bar_counter',
    'beach_club_bar_backwall',
  ]) {
    assert.ok(byId.has(requiredId), `Missing expected collider ${requiredId}`);
  }

  for (const cab of BEACH_CLUB_MASTERPLAN.cabanas) {
    assert.ok(byId.has(`${cab.id}_bed`), `Missing cabana bed collider for ${cab.id}`);
  }
  for (const palm of BEACH_CLUB_MASTERPLAN.palms) {
    assert.ok(byId.has(`${palm.id}_trunk`), `Missing palm collider for ${palm.id}`);
  }
});

test('buildCoastalBeachClub3D builds batched scene with ZERO PointLights, ZERO wood on Cocktail Bar, animated DJ stage & twilight/night emissives', () => {
  withStubDocument(() => {
    const windUniforms = createTestWindUniforms();
    const preBakeCocktailBarMeshes: THREE.Mesh[] = [];
    const spyingBake: typeof bakeStaticGroupMeshes = (root, opts) => {
      const barPreBake = root.getObjectByName('BeachClubLuxuryCocktailBar_NoWood');
      if (barPreBake) {
        barPreBake.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            preBakeCocktailBarMeshes.push(obj as THREE.Mesh);
          }
        });
      }
      bakeStaticGroupMeshes(root, opts);
    };

    const handle = buildCoastalBeachClub3D({
      windUniforms,
      isSoftwareGl: false,
      upgradeMeshToBlitzWorldMaterial,
      createBlitzStrokeMesh,
      bakeStaticGroupMeshes: spyingBake,
    });

    assert.equal(handle.stats.cabanaCount, 9);
    assert.equal(handle.stats.sunkenPodCount, 6);
    assert.ok(handle.stats.palmCount >= 26);
    assert.ok(handle.stats.festoonBulbCount >= 100);
    assert.ok(handle.stats.instancedBatchCount >= 14);

    // 1. ZERO PointLights anywhere in Beach Club scene graph
    let pointLights = 0;
    handle.group.traverse((obj) => {
      if ((obj as THREE.Light).isLight && obj.type === 'PointLight') {
        pointLights++;
      }
    });
    assert.equal(pointLights, 0, 'Beach Club must use zero THREE.PointLight instances');

    // 2. STRICT ZERO WOOD rule on Modern Luxury Cocktail Bar (`BeachClubLuxuryCocktailBar_NoWood`)
    assert.ok(
      preBakeCocktailBarMeshes.length >= 30,
      `Expected richly detailed Cocktail Bar >=30 parts, got ${preBakeCocktailBarMeshes.length}`,
    );
    for (const mesh of preBakeCocktailBarMeshes) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        const hasPbrWoodBump = Boolean(std.bumpMap && std.roughnessMap);
        assert.equal(
          hasPbrWoodBump,
          false,
          'Cocktail Bar MUST contain zero PBR timber/wood materials!',
        );
      }
    }

    // 3. Twilight / Night update surges pool rims, lanterns, aqua box & animates DJ stage
    handle.update(0.0, { nightFactor01: 0.0, duskDawnFactor01: 0.0 });
    let dayEmissiveMax = 0;
    handle.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (m && typeof m.emissiveIntensity === 'number') {
          dayEmissiveMax = Math.max(dayEmissiveMax, m.emissiveIntensity);
        }
      }
    });

    handle.update(2.5, { nightFactor01: 1.0, duskDawnFactor01: 0.0 });
    let nightEmissiveMax = 0;
    handle.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (m && typeof m.emissiveIntensity === 'number') {
          nightEmissiveMax = Math.max(nightEmissiveMax, m.emissiveIntensity);
        }
      }
    });
    assert.ok(
      nightEmissiveMax > dayEmissiveMax + 1.0,
      `Expected night emissive boost (${nightEmissiveMax} > ${dayEmissiveMax})`,
    );

    handle.dispose();
  });
});
