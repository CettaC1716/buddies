import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  BEACH_CLUB_COCKTAIL_BAR_SEAT_SPOTS,
  BEACH_CLUB_MASTERPLAN,
  BEACH_CLUB_Z_MAX,
  BEACH_CLUB_Z_MIN,
  classifyBeachClubSurface,
  evaluateBeachClubElevation,
  evaluateBeachClubPoolWaterSdf,
  getBeachClubObstacles,
  getBeachClubStairCorridors,
  isPointInBeachClubPoolWater,
} from './buddiesBeachClubRules';
import { evaluateHarborSeabedDrop, getTerrainElevation } from './buddiesPlanetCurvature';
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

  assert.equal(BEACH_CLUB_MASTERPLAN.cabanas.length, 5);
  assert.equal(BEACH_CLUB_MASTERPLAN.sunkenPods.length, 6);
  assert.equal(BEACH_CLUB_MASTERPLAN.pools.southSeaPool.rotY, 0);

  // South White Calacatta Marble boundary wall spans full arrow length (x = 91.2 .. 123.8)
  const sw = BEACH_CLUB_MASTERPLAN.southBoundaryWall;
  assert.equal(sw.minX, 91.2);
  assert.equal(sw.maxX, 123.8);
  assert.ok(sw.thicknessZ >= 0.85);
  assert.ok(sw.upperTopY >= 3.0);

  // Shifted stair_vip_bar_s sits cleanly North (-Z) of the enlarged Cocktail Bar podium
  const vipBarStair = BEACH_CLUB_MASTERPLAN.stairFlights.find((s) => s.id === 'stair_vip_bar_s')!;
  const bar = BEACH_CLUB_MASTERPLAN.cocktailBar;
  assert.ok(bar.padRadiusM >= 6.4, 'Cocktail Bar podium must be enlarged');
  assert.ok(vipBarStair.maxZ < bar.cz - bar.padRadiusM - 0.5, 'stair_vip_bar_s must sit North (-Z) of Cocktail Bar podium');

  // 8 interactive Cocktail Bar stools stand on the +0.68m terrazzo podium facing inward toward the bar counter
  assert.equal(BEACH_CLUB_COCKTAIL_BAR_SEAT_SPOTS.length, 8);
  for (const spot of BEACH_CLUB_COCKTAIL_BAR_SEAT_SPOTS) {
    assert.ok(Math.abs(evaluateBeachClubElevation(spot.x, spot.z) - bar.padElevY) < 1e-6);
    assert.ok(Math.abs(evaluateBeachClubElevation(spot.standUpX, spot.standUpZ) - bar.padElevY) < 1e-6);
  }
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
  const ePen = evaluateBeachClubElevation(106.0, -35.0);
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
  assert.ok(Math.abs(evaluateBeachClubElevation(cab0.cx, cab0.cz) - cab0.plinthTopY) < 1e-6);

  // 7. Promenade & widened beach sand classifications
  assert.equal(classifyBeachClubSurface(87.5, -20.0), 'stone_road');
  assert.ok(Math.abs(evaluateBeachClubElevation(87.5, -20.0) - 0.02) < 1e-6);
  assert.equal(classifyBeachClubSurface(126.0, -20.0), 'sand');
  assert.equal(classifyBeachClubSurface(40.0, 0.0), 'none');
});

test('getBeachClubObstacles registers DJ Pavilion, Cocktail Bar, South Marble Boundary Wall, Cabana daybeds, Beach Sets, and Palms cleanly', () => {
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
    'beach_club_south_marble_boundary_wall',
  ]) {
    assert.ok(byId.has(requiredId), `Missing expected collider ${requiredId}`);
  }

  for (const cab of BEACH_CLUB_MASTERPLAN.cabanas) {
    assert.ok(byId.has(`${cab.id}_bed`), `Missing cabana bed collider for ${cab.id}`);
  }
  for (const palm of BEACH_CLUB_MASTERPLAN.palms) {
    assert.ok(byId.has(`${palm.id}_trunk`), `Missing palm collider for ${palm.id}`);
  }
  for (const planter of BEACH_CLUB_MASTERPLAN.planters) {
    assert.ok(byId.has(planter.id), `Missing planter collider for ${planter.id}`);
  }
  for (const wallId of [
    'beach_club_retaining_vip_south_mid',
    'beach_club_retaining_weir_n1',
    'beach_club_retaining_weir_n2',
    'beach_club_retaining_weir_s',
  ]) {
    const wall = byId.get(wallId);
    assert.ok(wall, `Missing height-aware retaining wall ${wallId}`);
    assert.equal(wall.isRetainingWall, true);
  }
});

test('every Beach Club staircase has >= 1.8m width, smooth monotonic elevation with zero cliffs, and zero pool water overlap', () => {
  const corridors = getBeachClubStairCorridors();
  assert.equal(corridors.length, BEACH_CLUB_MASTERPLAN.stairFlights.length);

  for (const sf of BEACH_CLUB_MASTERPLAN.stairFlights) {
    const width = sf.axis === 'x' ? sf.maxZ - sf.minZ : sf.maxX - sf.minX;
    assert.ok(width >= 1.8, `Stair ${sf.id} clear width ${width.toFixed(2)}m must be >= 1.8m`);

    const dir = Math.sign(sf.toElevY - sf.fromElevY);
    const steps = 24;
    for (let w = 0; w <= 6; w++) {
      const wf = w / 6;
      let prevE: number | null = null;
      for (let s = -1; s <= steps + 1; s++) {
        const f = s / steps;
        const x =
          sf.axis === 'x'
            ? sf.minX + (sf.maxX - sf.minX) * f
            : sf.minX + 0.1 + (sf.maxX - sf.minX - 0.2) * wf;
        const z =
          sf.axis === 'z'
            ? sf.minZ + (sf.maxZ - sf.minZ) * f
            : sf.minZ + 0.1 + (sf.maxZ - sf.minZ - 0.2) * wf;
        const e = getTerrainElevation(x, z);
        if (prevE !== null) {
          const delta = e - prevE;
          assert.ok(
            Math.abs(delta) <= 0.1,
            `Elevation cliff on ${sf.id} at (${x.toFixed(2)}, ${z.toFixed(2)}): ${prevE.toFixed(3)} -> ${e.toFixed(3)}`,
          );
          if (s >= 1 && s <= steps) {
            assert.ok(
              delta * dir >= -1e-6,
              `Non-monotonic step on ${sf.id} at (${x.toFixed(2)}, ${z.toFixed(2)}): ${prevE.toFixed(3)} -> ${e.toFixed(3)}`,
            );
          }
        }
        prevE = e;

        // Zero pool water overlap across the stair body and immediate entry/exit landings
        const waterSdf = evaluateBeachClubPoolWaterSdf(x, z);
        assert.ok(
          waterSdf >= -1e-6,
          `Stair ${sf.id} overlaps pool water (sdf=${waterSdf.toFixed(3)}) at (${x.toFixed(2)}, ${z.toFixed(2)})`,
        );
      }
    }
  }

  // DJ stage rear steps transition smoothly to both -0.56m west and -0.96m east decks
  const dj = BEACH_CLUB_MASTERPLAN.djStage;
  const cR = Math.cos(dj.rotY);
  const sR = Math.sin(dj.rotY);
  for (const lx of [-2.0, 1.5, 5.0]) {
    let prev = evaluateBeachClubElevation(dj.cx + lx * cR + 4.0 * sR, dj.cz - lx * sR + 4.0 * cR);
    for (let lz = 4.25; lz <= 5.75; lz += 0.25) {
      const wx = dj.cx + lx * cR + lz * sR;
      const wz = dj.cz - lx * sR + lz * cR;
      const cur = evaluateBeachClubElevation(wx, wz);
      assert.ok(cur <= prev + 1e-6, `DJ step must descend monotonically at lx=${lx}, lz=${lz}`);
      assert.ok(prev - cur <= 0.28, `DJ step cliff too steep at lx=${lx}, lz=${lz}: ${prev} -> ${cur}`);
      prev = cur;
    }
  }
});

test('zero Beach Club colliders overlap staircase footprints or block main staircase landings, and retaining walls stay below upper terraces', () => {
  const obstacles = getBeachClubObstacles();

  const obbOverlapsAabb = (
    o: (typeof obstacles)[number],
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
  ): boolean => {
    const c = Math.abs(Math.cos(o.rotY));
    const s = Math.abs(Math.sin(o.rotY));
    const ex = o.halfX * c + o.halfZ * s;
    const ez = o.halfX * s + o.halfZ * c;
    return !(o.x + ex <= minX || o.x - ex >= maxX || o.z + ez <= minZ || o.z - ez >= maxZ);
  };

  for (const sf of BEACH_CLUB_MASTERPLAN.stairFlights) {
    const padX = sf.axis === 'x' ? 1.0 : 0.2;
    const padZ = sf.axis === 'z' ? 1.0 : 0.2;
    for (const obs of obstacles) {
      assert.equal(
        obbOverlapsAabb(obs, sf.minX - padX, sf.maxX + padX, sf.minZ - padZ, sf.maxZ + padZ),
        false,
        `Collider ${obs.id} blocks stair/landing ${sf.id}`,
      );
    }
  }

  // Height-aware retaining walls & lower planters sit strictly below upper terrace elevY
  const byId = new Map(obstacles.map((o) => [o.id, o]));
  const vipWall = byId.get('beach_club_retaining_vip_south_mid')!;
  assert.ok(vipWall.heightY < 0.64 && vipWall.heightY > -0.56);
  const midPlanter = byId.get('bc_planter_mid_w')!;
  assert.ok(midPlanter.heightY < 0.64 && midPlanter.heightY > -0.56);
  for (const weirId of [
    'beach_club_retaining_weir_n1',
    'beach_club_retaining_weir_n2',
    'beach_club_retaining_weir_s',
  ]) {
    const weir = byId.get(weirId)!;
    assert.ok(weir.heightY < -1.0 && weir.heightY > -2.0, `Weir ${weirId} heightY=${weir.heightY}`);
  }

  // All festoon pole anchors sit on dry ground clear of pools, cabanas, and Cocktail Bar
  for (const span of BEACH_CLUB_MASTERPLAN.festoonSpans) {
    for (const [px, pz] of [
      [span.ax, span.az],
      [span.bx, span.bz],
    ]) {
      assert.ok(
        evaluateBeachClubPoolWaterSdf(px, pz) >= 0.2,
        `Festoon ${span.id} pole (${px}, ${pz}) must stay clear of pool water`,
      );
      for (const cab of BEACH_CLUB_MASTERPLAN.cabanas) {
        const insideCab =
          Math.abs(px - cab.cx) <= cab.plinthHalfX && Math.abs(pz - cab.cz) <= cab.plinthHalfZ;
        assert.equal(insideCab, false, `Festoon ${span.id} pole (${px}, ${pz}) overlaps ${cab.id}`);
      }
      const dBar = Math.hypot(
        px - BEACH_CLUB_MASTERPLAN.cocktailBar.cx,
        pz - BEACH_CLUB_MASTERPLAN.cocktailBar.cz,
      );
      assert.ok(
        dBar > BEACH_CLUB_MASTERPLAN.cocktailBar.padRadiusM,
        `Festoon ${span.id} pole (${px}, ${pz}) overlaps Cocktail Bar podium`,
      );
    }
  }
});

test('underlying coastal seabed terrain never pokes through any Beach Club terrace deck, staircase, or pool basin', () => {
  for (let x = 78.5; x <= 121.4; x += 0.5) {
    for (let z = -96.2; z <= 45.2; z += 1.0) {
      const bed = evaluateHarborSeabedDrop(x, z);
      const deck = evaluateBeachClubElevation(x, z);
      assert.ok(
        bed <= deck - 0.01,
        `Terrain poke-through at (${x}, ${z}): bed=${bed.toFixed(3)} > deck=${deck.toFixed(3)}`,
      );
    }
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

    assert.equal(handle.stats.cabanaCount, 5);
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
