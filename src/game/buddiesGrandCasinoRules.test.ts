import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CASINO_BLACKJACK_TABLES,
  CASINO_CASHIER_BOOTH,
  CASINO_INTERIOR_BOUNDS,
  CASINO_INTERIOR_COLLIDERS,
  CASINO_INTERIOR_SEAT_SPOTS,
  CASINO_LUXURY_BAR,
  CASINO_ORIGIN_Y,
  CASINO_ROULETTE_TABLE,
  CASINO_SLOT_PLACEMENTS,
  CASINO_STATION_TARGETS,
  GRAND_CASINO_DOOR_TRIGGER,
  clampCasinoInteriorPosition,
  computeCasinoSeatStandUpPosition,
  detectNearestCasinoStation,
  evaluateGrandCasinoDoorProximity,
  getCasinoGameKindForSeat,
  resolveNearestCasinoPromptOrSeat,
} from './buddiesGrandCasinoRules';

test('activates the outdoor entrance interaction triangle only outside warzone & indoor modes', () => {
  const nearLobby = evaluateGrandCasinoDoorProximity(
    GRAND_CASINO_DOOR_TRIGGER.x,
    GRAND_CASINO_DOOR_TRIGGER.z,
    'lobby',
    'none',
  );
  assert.equal(nearLobby.isNear, true);
  assert.equal(nearLobby.distanceM, 0);

  const nearWarzone = evaluateGrandCasinoDoorProximity(
    GRAND_CASINO_DOOR_TRIGGER.x,
    GRAND_CASINO_DOOR_TRIGGER.z,
    'warzone',
    'none',
  );
  assert.equal(nearWarzone.isNear, false);

  const alreadyInside = evaluateGrandCasinoDoorProximity(
    GRAND_CASINO_DOOR_TRIGGER.x,
    GRAND_CASINO_DOOR_TRIGGER.z,
    'lobby',
    'casino_interior',
  );
  assert.equal(alreadyInside.isNear, false);
});

test('matches the 1:1 luxury single-story hall counts (20 slots, 3 blackjack tables, 32 seats)', () => {
  assert.equal(CASINO_ORIGIN_Y, 285.0);
  assert.equal(CASINO_SLOT_PLACEMENTS.length, 20);
  assert.equal(CASINO_BLACKJACK_TABLES.length, 3);
  assert.equal(CASINO_INTERIOR_SEAT_SPOTS.length, 32);
  assert.ok(CASINO_INTERIOR_COLLIDERS.length >= 38);
});

test('clamps interior walking coordinates inside the hall perimeter walls', () => {
  const clampedMin = clampCasinoInteriorPosition(-50, -50);
  assert.ok(clampedMin.x > CASINO_INTERIOR_BOUNDS.minX);
  assert.ok(clampedMin.z > CASINO_INTERIOR_BOUNDS.minZ);

  const clampedMax = clampCasinoInteriorPosition(50, 50);
  assert.ok(clampedMax.x < CASINO_INTERIOR_BOUNDS.maxX);
  assert.ok(clampedMax.z < CASINO_INTERIOR_BOUNDS.maxZ);
});

test('computes safe aisle stand-up positions away from slots and tables', () => {
  const slotSeat = CASINO_INTERIOR_SEAT_SPOTS[0];
  const standPos = computeCasinoSeatStandUpPosition(slotSeat);
  assert.ok(standPos.x > slotSeat.x);
  assert.ok(Math.abs(Math.hypot(standPos.x - slotSeat.x, standPos.z - slotSeat.z) - 0.66) < 0.01);
});

test('detects all 6 interactive casino station zones and arbitrates seats cleanly', () => {
  assert.equal(
    detectNearestCasinoStation(
      CASINO_STATION_TARGETS.exitDoor.x,
      CASINO_STATION_TARGETS.exitDoor.z,
    ).kind,
    'exit_door',
  );

  assert.equal(
    detectNearestCasinoStation(
      CASINO_CASHIER_BOOTH.x,
      CASINO_STATION_TARGETS.cashierCage.interactZ,
    ).kind,
    'cashier_cage',
  );

  assert.equal(
    detectNearestCasinoStation(
      CASINO_LUXURY_BAR.x,
      CASINO_STATION_TARGETS.luxuryBar.interactZ,
    ).kind,
    'luxury_bar',
  );

  // Standing players only reach service stations; game stations are detected
  // in seated mode (includeGames = true), matching the sit-to-play design.
  assert.equal(
    detectNearestCasinoStation(
      CASINO_ROULETTE_TABLE.x,
      CASINO_ROULETTE_TABLE.z + 1.0,
    ).kind,
    null,
  );

  assert.equal(
    detectNearestCasinoStation(
      CASINO_ROULETTE_TABLE.x,
      CASINO_ROULETTE_TABLE.z + 1.0,
      true,
    ).kind,
    'roulette_table',
  );

  assert.equal(
    detectNearestCasinoStation(
      CASINO_BLACKJACK_TABLES[0].x,
      CASINO_BLACKJACK_TABLES[0].z - 0.9,
      true,
    ).kind,
    'blackjack_table',
  );

  assert.equal(
    detectNearestCasinoStation(
      CASINO_STATION_TARGETS.slotNorthBank.interactX,
      CASINO_STATION_TARGETS.slotNorthBank.interactZ,
      true,
    ).kind,
    'slot_machine',
  );

  const seatWinner = resolveNearestCasinoPromptOrSeat(
    CASINO_INTERIOR_SEAT_SPOTS[20].x,
    CASINO_INTERIOR_SEAT_SPOTS[20].z,
  );
  assert.equal(seatWinner.target, 'seat');
  assert.equal(seatWinner.seatSpot?.id, CASINO_INTERIOR_SEAT_SPOTS[20].id);

  // The roulette stool is the activation path for roulette: sitting there
  // resolves to the roulette game.
  const rouletteSeat = CASINO_INTERIOR_SEAT_SPOTS[29];
  assert.equal(rouletteSeat.chairKind, 'roulette_stool');
  const rouletteWinner = resolveNearestCasinoPromptOrSeat(rouletteSeat.x, rouletteSeat.z);
  assert.equal(rouletteWinner.target, 'seat');
  assert.equal(rouletteWinner.seatSpot?.id, rouletteSeat.id);
  assert.equal(getCasinoGameKindForSeat(rouletteSeat.chairKind), 'roulette_table');
});

test('buildGrandCasino3D constructs Beaux-Arts textured limestone, mansard slate, verdigris dome, and instanced foliage cleanly', async () => {
  const THREE = await import('three');
  const { buildGrandCasino3D } = await import('./buddiesGrandCasinoBuilder');
  const { updateCityWindowNightLighting } = await import('./buddiesNightLightingRules');
  const { bakeStaticGroupMeshes, createBlitzStrokeMesh, upgradeMeshToBlitzWorldMaterial } = await import('./buddiesBlitzShadersAndAssets');

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
      uWindStrength: { value: 0.3 },
      uWindGust: { value: 0.15 },
      uLightDirection: { value: new THREE.Vector3(0.4, 0.85, 0.3).normalize() },
      uLightColor: { value: new THREE.Color('#fff4c8') },
      uShadowColor: { value: new THREE.Color('#3b6e52') },
    };
    const glassMat = new THREE.MeshBasicMaterial({ color: '#cceef5', transparent: true, opacity: 0.45 });
    const casino = buildGrandCasino3D({
      windUniforms,
      isSoftwareGl: false,
      sharedGlassMat: glassMat,
      tagFrostedGlassGeometry: (geo) => geo,
      upgradeMeshToBlitzWorldMaterial,
      createBlitzStrokeMesh,
      bakeStaticGroupMeshes,
      createLeafPetalShrubInstanced: (matrices, meshName) => {
        const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), matrices.length);
        inst.name = meshName;
        return inst;
      },
      createFlowerPetalClusterInstanced: (specs, meshName) => {
        const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), specs.length);
        inst.name = meshName;
        return inst;
      },
    });
    assert.equal(casino.group.name, 'NorthGrandCasinoDistrict3D');
    let bakedMeshes = 0;
    let shrubsCount = 0;
    casino.group.traverse((o) => {
      if (o instanceof THREE.InstancedMesh && o.name === 'GrandCasinoLeafPetalShrubsInstanced') {
        shrubsCount = o.count;
      } else if (o instanceof THREE.Mesh) {
        bakedMeshes++;
      }
    });
    assert.ok(bakedMeshes >= 5 && bakedMeshes <= 24, `Expected batched static Casino meshes, got ${bakedMeshes}`);
    assert.ok(shrubsCount >= 18, `Expected >= 18 topiary/garden shrub instances, got ${shrubsCount}`);

    // Verify Casino 3D windows stay cool sky-tinted in daytime (0 emissive) and stagger lit vs off at night
    const upperInst = casino.group.getObjectByName('GrandCasinoUpperWindowsInstanced') as InstanceType<typeof THREE.InstancedMesh> | undefined;
    assert.ok(upperInst, 'Expected GrandCasinoUpperWindowsInstanced batch');
    const emissiveAttr = upperInst.geometry.getAttribute('instanceEmissive') as InstanceType<typeof THREE.InstancedBufferAttribute> | undefined;
    assert.ok(emissiveAttr, 'Expected per-instance instanceEmissive attribute on Casino InstancedMesh');
    updateCityWindowNightLighting(casino.group, 0.02, 0);
    const upperMat = upperInst.material as InstanceType<typeof THREE.MeshStandardMaterial>;
    assert.equal(upperMat.emissiveIntensity, 0, 'Casino upper windows must have 0 emissive during daytime');
    const dayWinCol = new THREE.Color();
    upperInst.getColorAt(0, dayWinCol);
    assert.ok(dayWinCol.b > dayWinCol.r, 'Daytime Casino window tint should be cool blue-sky rather than warm yellow');
    for (let i = 0; i < upperInst.count; i++) {
      assert.equal(emissiveAttr.getX(i), 0, 'Daytime per-instance emissive R must be 0');
      assert.equal(emissiveAttr.getY(i), 0, 'Daytime per-instance emissive G must be 0');
    }

    updateCityWindowNightLighting(casino.group, 1.0, 2.0);
    const nightLitCols = new Set<string>();
    const tmpCol = new THREE.Color();
    let litEmissiveCount = 0;
    let offEmissiveCount = 0;
    for (let i = 0; i < upperInst.count; i++) {
      upperInst.getColorAt(i, tmpCol);
      nightLitCols.add(tmpCol.getHexString());
      if (emissiveAttr.getX(i) > 0.2) litEmissiveCount++;
      else if (emissiveAttr.getX(i) === 0 && emissiveAttr.getY(i) === 0 && emissiveAttr.getZ(i) === 0) {
        offEmissiveCount++;
      }
    }
    assert.ok(nightLitCols.size >= 2, 'Night Casino upper windows must display staggered lit vs dark rooms');
    assert.ok(litEmissiveCount >= 3, `Expected multiple self-illuminated Casino upper windows at night, got ${litEmissiveCount}`);
    assert.ok(offEmissiveCount >= 1, `Expected dark unlit Casino upper windows with 0 emissive, got ${offEmissiveCount}`);

    casino.dispose();
    glassMat.dispose();
  } finally {
    (globalThis as { document?: unknown }).document = origDocument;
  }
});
