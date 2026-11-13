import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  CAFE_GLOBAL_SCALE_SPEC,
  CAFE_INTERIOR_BOUNDS,
  CAFE_MENU_ITEMS,
  CAFE_SHIFT_COMPLETION_BONUS_XP,
  CAFE_SHIFT_MAX_ORDERS,
  applyPlayerXpGain,
  clampCafeInteriorPosition,
  computeCafeExteriorDistance,
  computeCafeExteriorMistFactor,
  computeLevelProgress,
  createInitialCafeWorkShiftState,
  detectNearestCafeStation,
  purchaseCafeMenuItem,
  purchaseCafeMenuItemWithCyon,
  cafeCyonPurchaseXpForItem,
  prepareActiveCafeOrder,
  serveActiveCafeOrder,
  startCafeWorkShift,
  xpRequiredForLevelStep,
} from './buddiesCafeRules';
import {
  DEFAULT_ARENA_MAP_LAYOUT,
  buildStaticWorldStructuresList,
  isInsideSouthPlazaGlasshouseFootprint,
} from './buddiesBlitzWorldBuilder';

test('Botanical Glasshouse Cafe menu contains 9 distinct food & drink items matching ORDER SOMETHING', () => {
  assert.equal(CAFE_MENU_ITEMS.length, 9);
  const ids = new Set(CAFE_MENU_ITEMS.map((i) => i.id));
  assert.equal(ids.size, 9);
  for (const item of CAFE_MENU_ITEMS) {
    assert.ok(item.priceLul > 0);
    assert.ok(item.xpReward > 0);
    assert.ok(item.priceCyon > 0);
  }
});

test('Level and XP progression computes level-ups accurately and monotonically', () => {
  const lv1Req = xpRequiredForLevelStep(1);
  assert.equal(lv1Req, 80);

  const p0 = computeLevelProgress(0);
  assert.equal(p0.level, 1);
  assert.equal(p0.currentLevelXp, 0);
  assert.equal(p0.xpForNextLevel, 80);
  assert.equal(p0.progress01, 0);

  const gain1 = applyPlayerXpGain(50, 35);
  assert.equal(gain1.previousLevel, 1);
  assert.equal(gain1.newLevel, 2);
  assert.equal(gain1.leveledUp, true);
  assert.equal(gain1.levelsGained, 1);
  assert.equal(gain1.progress.currentLevelXp, 5);

  // Multi-level jump
  const gainMulti = applyPlayerXpGain(0, 500);
  assert.ok(gainMulti.newLevel >= 3);
  assert.equal(gainMulti.leveledUp, true);
});

test('Barista Work Shift lifecycle spawns AI orders, rewards XP only (no Bucks, no LUL), and grants shift completion bonus', () => {
  const init = createInitialCafeWorkShiftState(0);
  assert.equal(init.isWorking, false);
  assert.equal(init.activeOrder, null);

  let shift = startCafeWorkShift(init, 101);
  assert.equal(shift.isWorking, true);
  assert.ok(shift.activeOrder !== null);
  assert.equal(shift.activeOrder.orderNumber, 1);

  // Serving without preparing at a station must fail
  const r0 = serveActiveCafeOrder(shift, 100);
  assert.equal(r0.served, false);

  // Serve orders 1 and 2 (prepare the ordered item first)
  shift = prepareActiveCafeOrder(shift, shift.activeOrder!.item.id);
  const r1 = serveActiveCafeOrder(shift, 102);
  assert.equal(r1.served, true);
  assert.equal(r1.shiftCompleted, false);
  assert.ok(r1.xpGained > 0);
  shift = r1.nextShiftState;
  assert.equal(shift.isWorking, true);
  assert.equal(shift.ordersCompletedInShift, 1);

  shift = prepareActiveCafeOrder(shift, shift.activeOrder!.item.id);
  const r2 = serveActiveCafeOrder(shift, 103);
  assert.equal(r2.served, true);
  assert.equal(r2.shiftCompleted, false);
  shift = r2.nextShiftState;
  assert.equal(shift.ordersCompletedInShift, 2);

  // Serve 3rd (final) order -> shift completed + bonus
  const finalItem = shift.activeOrder!.item;
  shift = prepareActiveCafeOrder(shift, finalItem.id);
  const r3 = serveActiveCafeOrder(shift, 104);
  assert.equal(r3.served, true);
  assert.equal(r3.shiftCompleted, true);
  assert.equal(r3.xpGained, finalItem.xpReward + 15 + CAFE_SHIFT_COMPLETION_BONUS_XP);
  assert.equal(r3.nextShiftState.isWorking, false);
  assert.equal(r3.nextShiftState.activeOrder, null);
  assert.equal(r3.nextShiftState.totalOrdersServedEver, CAFE_SHIFT_MAX_ORDERS);
});

test('Food Purchase deducts LUL for base XP, or CYON for 2.5x the work XP', () => {
  const failBuy = purchaseCafeMenuItem('latte', 5);
  assert.equal(failBuy.purchased, false);
  assert.equal(failBuy.reason, 'insufficient_lul');

  const okBuy = purchaseCafeMenuItem('latte', 42);
  assert.equal(okBuy.purchased, true);
  assert.equal(okBuy.nextLul, 32);
  assert.equal(okBuy.xpGained, 35);

  const latte = CAFE_MENU_ITEMS.find((i) => i.id === 'latte')!;
  const failCyon = purchaseCafeMenuItemWithCyon('latte', 5);
  assert.equal(failCyon.purchased, false);
  assert.equal(failCyon.reason, 'insufficient_cyon');
  assert.equal(failCyon.nextCyon, 5);

  const okCyon = purchaseCafeMenuItemWithCyon('latte', 42);
  assert.equal(okCyon.purchased, true);
  assert.equal(okCyon.nextCyon, 32);
  // CYON purchase XP = 2.5 x work (serve) XP for the same item: (35 + 15) * 2.5 = 125
  assert.equal(okCyon.xpGained, cafeCyonPurchaseXpForItem(latte));
  assert.equal(okCyon.xpGained, 125);
});

test('Cafe interior station proximity detector identifies Rota, Counter/Serve, ATM (LUL to CYON), and Exit Door cleanly', () => {
  assert.equal(detectNearestCafeStation(0.0, 4.4, false).kind, 'exit_door');
  assert.equal(detectNearestCafeStation(-5.1, -3.5, false).kind, 'atm_machine');
  assert.equal(detectNearestCafeStation(3.2, -3.7, false).kind, 'rota_board');
  assert.equal(detectNearestCafeStation(-0.2, -1.2, false).kind, 'order_counter');
  assert.equal(detectNearestCafeStation(-0.2, -3.38, true).kind, 'serve_customer');
  assert.equal(detectNearestCafeStation(0.0, 1.5, false).kind, null);
});

test('L-Shaped Cafe interior boundary clamp allows Main Hall and Left (+X) Projecting Wing while excluding courtyard notch', () => {
  // Inside Main Hall near Exit Door
  const doorSpot = clampCafeInteriorPosition(0.0, 4.55);
  assert.equal(doorSpot.x, 0.0);
  assert.equal(doorSpot.z, 4.55);

  // Inside Left (+X) Projecting Wing (beyond z = 5.25)
  const wingSpot = clampCafeInteriorPosition(4.2, 7.6);
  assert.equal(wingSpot.x, 4.2);
  assert.equal(wingSpot.z, 7.6);

  // Outside in Right (-X) Courtyard Notch (x < 1.65, z > 5.25) -> clamped cleanly back onto glass wall boundary
  const notchPushNorth = clampCafeInteriorPosition(-2.5, 5.6);
  assert.equal(notchPushNorth.z, 5.25 - 0.42);
  const notchPushEast = clampCafeInteriorPosition(1.8, 8.2);
  assert.equal(notchPushEast.x, 1.65 + 0.42);
});

test('Interior focus stays 0% mist across Main Hall & Left Wing while outdoor background objects receive soft mist fade', () => {
  // Strictly inside Main Hall & Left (+X) Wing -> 0 exterior distance and 0 mist
  assert.equal(computeCafeExteriorDistance(0, 0), 0);
  assert.equal(computeCafeExteriorMistFactor(0, 0), 0);
  assert.equal(computeCafeExteriorMistFactor(-5.2, -3.5), 0);
  assert.equal(computeCafeExteriorMistFactor(4.65, 7.45), 0);

  // Outdoor background objects -> positive exterior distance & monotonically increasing mist factor
  const nearCourtyardPlantMist = computeCafeExteriorMistFactor(-1.45, 5.95);
  const outdoorParasolMist = computeCafeExteriorMistFactor(-3.4, 7.8);
  const outerFenceMist = computeCafeExteriorMistFactor(-10.8, 2.2);
  const distantLawnMist = computeCafeExteriorMistFactor(0, 18.0);

  assert.ok(nearCourtyardPlantMist >= 0.30);
  assert.ok(outdoorParasolMist > nearCourtyardPlantMist);
  assert.ok(outerFenceMist > outdoorParasolMist);
  assert.ok(distantLawnMist >= outerFenceMist && distantLawnMist <= 0.88);
});

test('Global Cafe Scale Spec matches true rendered GLB avatar heights (3.312m Plaza, 1.822m Interior) and provides spacious >=1.6m barista workspace', async () => {
  const baseTableTopHeightM = 0.778;
  const baseChairSeatHeightM = 0.474;
  const baseChairBackHeightM = 0.922;
  const baseEspressoCounterHeightM = 1.01;

  // Verify exact GLB avatar calibration: 3.38m rig * 0.98 bodyGroup = 3.312m Plaza; * 0.55 = 1.822m Interior
  assert.ok(Math.abs(CAFE_GLOBAL_SCALE_SPEC.plazaPlayerHeightM - 3.38 * 0.98) < 0.005);
  assert.ok(Math.abs(CAFE_GLOBAL_SCALE_SPEC.interiorPlayerHeightM - 3.38 * 0.98 * 0.55) < 0.005);

  // Exterior South Plaza Cafe relative to 3.312m Global Buddy Player & Outdoor Parasol Tables
  const extTableRatio =
    (baseTableTopHeightM * CAFE_GLOBAL_SCALE_SPEC.exteriorTableScale) /
    CAFE_GLOBAL_SCALE_SPEC.plazaPlayerHeightM;
  const extSeatRatio =
    (baseChairSeatHeightM * CAFE_GLOBAL_SCALE_SPEC.exteriorChairScale) /
    CAFE_GLOBAL_SCALE_SPEC.plazaPlayerHeightM;
  const extChairBackRatio =
    (baseChairBackHeightM * CAFE_GLOBAL_SCALE_SPEC.exteriorChairScale) /
    CAFE_GLOBAL_SCALE_SPEC.plazaPlayerHeightM;
  const extBarRatio =
    (baseEspressoCounterHeightM * CAFE_GLOBAL_SCALE_SPEC.exteriorEspressoBarScale) /
    CAFE_GLOBAL_SCALE_SPEC.plazaPlayerHeightM;

  assert.ok(extTableRatio >= 0.38 && extTableRatio <= 0.43, `extTableRatio=${extTableRatio}`);
  assert.ok(extSeatRatio >= 0.23 && extSeatRatio <= 0.27, `extSeatRatio=${extSeatRatio}`);
  assert.ok(extChairBackRatio >= 0.46 && extChairBackRatio <= 0.52, `extChairBackRatio=${extChairBackRatio}`);
  assert.ok(extBarRatio >= 0.49 && extBarRatio <= 0.55, `extBarRatio=${extBarRatio}`);
  assert.ok(
    CAFE_GLOBAL_SCALE_SPEC.exteriorEavesY > CAFE_GLOBAL_SCALE_SPEC.plazaPlayerHeightM + 0.85,
    'Exterior conservatory eaves & doorway clear the 3.312m player head comfortably',
  );

  // Interior Cafe relative to 1.822m (0.55x) Indoor Buddy Player (matching Hana Model House 1:1)
  const intTableHeightM = baseTableTopHeightM * CAFE_GLOBAL_SCALE_SPEC.interiorTableScale + 0.02;
  const intChairSeatHeightM = baseChairSeatHeightM * CAFE_GLOBAL_SCALE_SPEC.interiorChairScale + 0.02;
  const intChairBackHeightM = baseChairBackHeightM * CAFE_GLOBAL_SCALE_SPEC.interiorChairScale + 0.02;
  const intBarHeightM = baseEspressoCounterHeightM * CAFE_GLOBAL_SCALE_SPEC.interiorEspressoBarScale + 0.036;

  assert.ok(intTableHeightM >= 0.73 && intTableHeightM <= 0.79, `intTableHeightM=${intTableHeightM}`);
  assert.ok(intChairSeatHeightM >= 0.45 && intChairSeatHeightM <= 0.49, `intChairSeatHeightM=${intChairSeatHeightM}`);
  assert.ok(intChairBackHeightM >= 0.86 && intChairBackHeightM <= 0.93, `intChairBackHeightM=${intChairBackHeightM}`);
  assert.ok(intBarHeightM >= 0.96 && intBarHeightM <= 1.04, `intBarHeightM=${intBarHeightM}`);

  // Verify front barista counter is shifted forward to z = -2.11 (back collider edge -2.61) leaving >= 1.60m clear aisle behind counter!
  const { CAFE_INTERIOR_COLLIDERS } = await import('./buddiesCafeInteriorBuilder');
  const frontBarCol = CAFE_INTERIOR_COLLIDERS.find((c) => c.id === 'cafe_barista_counter')!;
  const backBarCol = CAFE_INTERIOR_COLLIDERS.find((c) => c.id === 'cafe_back_bar')!;
  const clearAisleDepthM = (frontBarCol.z - frontBarCol.hd) - (backBarCol.z + backBarCol.hd);
  assert.ok(
    clearAisleDepthM >= 1.60,
    `Expected spacious >= 1.60m barista workspace aisle behind front counter, got ${clearAisleDepthM.toFixed(2)}m`,
  );
  assert.ok(
    CAFE_INTERIOR_BOUNDS.baristaCounterStandZ > backBarCol.z + backBarCol.hd + 0.5 &&
      CAFE_INTERIOR_BOUNDS.baristaCounterStandZ < frontBarCol.z - frontBarCol.hd - 0.5,
    'Barista stand position is centered comfortably inside the widened workspace',
  );
});

test('South Plaza L-Shaped Glasshouse Cafe contains zero overlapping map trees and aligns lampposts w3 & w4 horizontally at z = 11.6', () => {
  assert.equal(isInsideSouthPlazaGlasshouseFootprint(-99.9, 25.4), true);
  assert.equal(isInsideSouthPlazaGlasshouseFootprint(-93.3, 11.6), false);

  const overlappingProps = DEFAULT_ARENA_MAP_LAYOUT.props.filter((p) =>
    isInsideSouthPlazaGlasshouseFootprint(p.x, p.z),
  );
  assert.equal(overlappingProps.length, 0);
  assert.equal(DEFAULT_ARENA_MAP_LAYOUT.props.some((p) => p.id === 491), false);

  const structures = buildStaticWorldStructuresList({
    blueBase: { hqX: 0, hqZ: 86, baseGroup: new THREE.Group() },
    redBase: { hqX: 0, hqZ: -86, baseGroup: new THREE.Group() },
    blueCommanderBases: [],
    redCommanderBases: [],
    isSafezoneMode: true,
  });
  const lampW3 = structures.find((s) => s.id === 'lobby_vintage_lamppost_w3');
  const lampW4 = structures.find((s) => s.id === 'lobby_vintage_lamppost_w4');
  assert.ok(lampW3 && lampW4);
  assert.equal(lampW3.z, 11.6);
  assert.equal(lampW4.z, 11.6);
  assert.equal(lampW3.z, lampW4.z);
  assert.equal(lampW3.x, -93.3);
  assert.equal(lampW4.x, -102.9);
});

test('South Plaza L-Shaped Glasshouse Cafe merges 2,000+ raw 3D meshes into Central Plaza with +0 net extra static draw calls', () => {
  // Dynamic import avoids top-level circular init order issues in standalone test runner
  return Promise.all([
    import('./buddiesBlitzShadersAndAssets'),
    import('./buddiesLShapedCafeAssets'),
  ]).then(([shadersMod, cafeAssetsMod]) => {
    const sharedGlassMat = cafeAssetsMod.createUnifiedPlazaAndConservatoryGlassMaterial();
    const windUniforms: import('./buddiesBlitzShadersAndAssets').BlitzWindUniforms = {
      uTime: { value: 0 },
      uWindPhase: { value: 0 },
      uWindDirection: { value: new THREE.Vector2(1, 0) },
      uWindStrength: { value: 0.2 },
      uWindGust: { value: 0 },
      uLightDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
      uLightColor: { value: new THREE.Color('#ffffff') },
      uShadowColor: { value: new THREE.Color('#2a2b36') },
    };

    const populateBaselinePlaza = (group: THREE.Group) => {
      // 1) Shadow-casting Plaza bench/curb part + stroke
      const curbGeo = new THREE.BoxGeometry(2.4, 0.5, 0.8);
      const curbMesh = new THREE.Mesh(
        curbGeo,
        new THREE.MeshStandardMaterial({ color: '#d8d4ca' }),
      );
      curbMesh.castShadow = true;
      curbMesh.receiveShadow = true;
      shadersMod.upgradeMeshToBlitzWorldMaterial(curbMesh, windUniforms, '#d8d4ca', 0.12);
      const curbStroke = shadersMod.createBlitzStrokeMesh(curbGeo, 0.01);
      if (curbStroke) curbMesh.add(curbStroke);
      group.add(curbMesh);

      // 2) Small non-shadow-casting Plaza detail part + stroke
      const trimGeo = new THREE.BoxGeometry(0.24, 0.06, 0.24);
      const trimMesh = new THREE.Mesh(
        trimGeo,
        new THREE.MeshStandardMaterial({ color: '#4f5b69' }),
      );
      trimMesh.castShadow = false;
      trimMesh.receiveShadow = true;
      shadersMod.upgradeMeshToBlitzWorldMaterial(trimMesh, windUniforms, '#4f5b69', 0.12);
      const trimStroke = shadersMod.createBlitzStrokeMesh(trimGeo, 0.008);
      if (trimStroke) trimMesh.add(trimStroke);
      group.add(trimMesh);

      // 3) Plaza clear glass balustrade panel
      const glassPanel = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.84, 0.10), sharedGlassMat);
      glassPanel.castShadow = false;
      glassPanel.receiveShadow = false;
      group.add(glassPanel);
    };

    const countMeshes = (root: THREE.Object3D): number => {
      let n = 0;
      root.traverse((obj) => {
        if (obj instanceof THREE.Mesh) n++;
      });
      return n;
    };

    const plazaWithoutCafe = new THREE.Group();
    populateBaselinePlaza(plazaWithoutCafe);
    shadersMod.bakeStaticGroupMeshes(plazaWithoutCafe, { minShadowCasterSpan: 0.55 });
    const baselineDrawCalls = countMeshes(plazaWithoutCafe);
    assert.equal(baselineDrawCalls, 4);

    const plazaWithCafe = new THREE.Group();
    populateBaselinePlaza(plazaWithCafe);
    const styler = shadersMod.createZeroDrawCallPlazaCafeStyler(
      sharedGlassMat,
      windUniforms,
      false,
    );
    const cafeGroup = cafeAssetsMod.buildSouthPlazaLShapedGlasshouseCafe(styler);
    const rawCafeMeshCount = countMeshes(cafeGroup);
    assert.ok(
      rawCafeMeshCount > 2000,
      `Expected >2,000 raw cafe 3D meshes & outlines before baking, got ${rawCafeMeshCount}`,
    );

    plazaWithCafe.add(cafeGroup);
    shadersMod.bakeStaticGroupMeshes(plazaWithCafe, { minShadowCasterSpan: 0.55 });
    const withCafeDrawCalls = countMeshes(plazaWithCafe);

    // Adding the entire 2,000+ part Rumah Kaca Cafe adds literally +0 extra static draw calls!
    assert.equal(withCafeDrawCalls - baselineDrawCalls, 0);
    assert.equal(withCafeDrawCalls, 4);

    // Verify unified glass mesh preserves both clear Plaza glass (r=1.0) and frosted Cafe glass (r=0.5)
    let foundClearGlassVert = false;
    let foundFrostedGlassVert = false;
    plazaWithCafe.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material === sharedGlassMat) {
        const colAttr = obj.geometry.getAttribute('color');
        assert.ok(colAttr && colAttr.count > 100);
        for (let i = 0; i < colAttr.count; i++) {
          const r = colAttr.getX(i);
          if (r > 0.95) foundClearGlassVert = true;
          if (Math.abs(r - 0.5) < 0.05) foundFrostedGlassVert = true;
        }
      }
    });
    assert.equal(foundClearGlassVert, true);
    assert.equal(foundFrostedGlassVert, true);
  });
});

test('Standard Bank Cash ATM matches 4-view industrial model sheet 1:1 dimensions (0.79m W x 1.75m H, grounded at y=0)', async () => {
  const cafeAssetsMod = await import('./buddiesLShapedCafeAssets');
  const clearGlassMat = new THREE.MeshBasicMaterial();
  const simpleStyler: import('./buddiesLShapedCafeAssets').CafeAssetStyler = {
    clearGlassMat,
    preserveTextures: false,
    styleOpaque: (mesh, _geo, colorHex) => {
      mesh.material = new THREE.MeshStandardMaterial({ color: colorHex });
      return mesh;
    },
  };

  const atm = cafeAssetsMod.buildStandardBankCashAtm(simpleStyler, CAFE_GLOBAL_SCALE_SPEC.interiorAtmScale);
  atm.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(atm);
  const size = new THREE.Vector3();
  box.getSize(size);

  let meshCount = 0;
  atm.traverse((o) => {
    if (o instanceof THREE.Mesh) meshCount++;
  });

  // Composite multi-part industrial ATM (plinth, cheeks, navy trim, marquee, CCTV dome, screen + 8 FDK keys, card/receipt slots, 4x4 PIN pad + shields + NFC, cash shutter, rear vault door + hinges + dual locks + louvers)
  assert.ok(meshCount >= 65, `Expected detailed multi-part industrial ATM (>=65 meshes before baking), got ${meshCount}`);
  assert.ok(Math.abs(box.min.y) <= 0.015, `Expected grounded base at y~0, got min.y=${box.min.y}`);
  assert.ok(size.x >= 0.77 && size.x <= 0.83, `Expected ~0.79m outer cabinet width, got ${size.x.toFixed(3)}m`);
  assert.ok(size.y >= 1.73 && size.y <= 1.78, `Expected ~1.75m industrial ATM height, got ${size.y.toFixed(3)}m`);
  assert.ok(size.z >= 0.62 && size.z <= 0.70, `Expected cantilevered ~0.66m depth profile, got ${size.z.toFixed(3)}m`);

  // Ergonomic 1:1 proportion relative to 1.822m indoor avatar (ATM ~96% of standing adult height)
  const heightRatio = size.y / CAFE_GLOBAL_SCALE_SPEC.interiorPlayerHeightM;
  assert.ok(heightRatio >= 0.93 && heightRatio <= 0.99, `Expected ergonomic 0.96 ATM-to-avatar ratio, got ${heightRatio.toFixed(3)}`);
});

test('Cafe interior seat indicators are compact (<=0.20m diameter, <45% of old 0.46m size) and hover cleanly above chair cushions', async () => {
  const { CAFE_INTERIOR_SEAT_SPOTS } = await import('./buddiesCafeRules');
  const blueDiameterM = CAFE_GLOBAL_SCALE_SPEC.interiorSeatIndicatorBlueRadiusM * 2;
  const greenDiameterM = CAFE_GLOBAL_SCALE_SPEC.interiorSeatIndicatorGreenRadiusM * 2;

  assert.ok(
    blueDiameterM >= 0.14 && blueDiameterM <= 0.18,
    `Expected compact idle blue seat indicator diameter (0.14m..0.18m), got ${blueDiameterM.toFixed(3)}m`,
  );
  assert.ok(
    greenDiameterM > blueDiameterM && greenDiameterM <= 0.205,
    `Expected compact active green seat indicator diameter (<=0.205m), got ${greenDiameterM.toFixed(3)}m`,
  );

  for (const spot of CAFE_INTERIOR_SEAT_SPOTS) {
    // Must hover above the ~0.475m chair seat cushion and stay well below the ~0.90m backrest top
    assert.ok(
      spot.indicatorHeightY >= 0.65 && spot.indicatorHeightY <= 0.76,
      `Expected compact seat indicator height in [0.65, 0.76], got ${spot.indicatorHeightY}`,
    );
  }
});

test('syncScreenSpaceBillboardQuad faces camera squarely and locks nametag screen size (146x33px) across indoor 0.55x zoom/pan and outdoor 1.0x views', async () => {
  const {
    NAMEPLATE_SCREEN_SPEC,
    syncScreenSpaceBillboardQuad,
  } = await import('./buddiesBillboardRules');

  const viewportW = 1440;
  const viewportH = 900;
  const camera = new THREE.PerspectiveCamera(46, viewportW / viewportH, 0.1, 300);

  const scene = new THREE.Scene();
  const playerRoot = new THREE.Group();
  // Simulate Rumah Kaca Cafe indoor 0.55x character scale + arbitrary player yaw
  playerRoot.scale.setScalar(0.55);
  playerRoot.rotation.y = 1.15;
  playerRoot.position.set(1.2, 60, 0.8);
  scene.add(playerRoot);

  const nametagQuad = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial(),
  );
  nametagQuad.position.set(0, NAMEPLATE_SCREEN_SPEC.standingHeadAnchorLocalY, 0);
  playerRoot.add(nametagQuad);

  const measureProjectedPixelBox = () => {
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    const corners = [
      new THREE.Vector3(-0.5, -0.5, 0),
      new THREE.Vector3(0.5, -0.5, 0),
      new THREE.Vector3(0.5, 0.5, 0),
      new THREE.Vector3(-0.5, 0.5, 0),
    ];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const c of corners) {
      c.applyMatrix4(nametagQuad.matrixWorld).project(camera);
      const px = (c.x * 0.5 + 0.5) * viewportW;
      const py = (-c.y * 0.5 + 0.5) * viewportH;
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
    return { widthPx: maxX - minX, heightPx: maxY - minY };
  };

  const scenarios = [
    // 1. Close indoor zoom inside Rumah Kaca Cafe (~1.8m from camera)
    { scale: 0.55, camPos: [1.2, 62.1, 2.6] as const, lookAt: [1.2, 61.1, 0.8] as const },
    // 2. Far indoor zoom + lateral orbit inside Rumah Kaca Cafe (~5.4m from camera, off-center)
    { scale: 0.55, camPos: [-2.8, 63.4, 4.7] as const, lookAt: [0.4, 61.0, 0.2] as const },
    // 3. Outdoor Central Plaza view (1.0x character scale, ~18m distance)
    { scale: 1.0, camPos: [9.5, 69.0, 15.8] as const, lookAt: [1.2, 61.5, 0.8] as const },
  ];

  const quadWorldQuat = new THREE.Quaternion();
  for (const sc of scenarios) {
    playerRoot.scale.setScalar(sc.scale);
    camera.position.set(sc.camPos[0], sc.camPos[1], sc.camPos[2]);
    camera.lookAt(sc.lookAt[0], sc.lookAt[1], sc.lookAt[2]);
    camera.updateMatrixWorld(true);

    syncScreenSpaceBillboardQuad(
      nametagQuad,
      camera,
      viewportH,
      NAMEPLATE_SCREEN_SPEC.playerAndPeerWidthPx,
      NAMEPLATE_SCREEN_SPEC.playerAndPeerHeightPx,
    );
    scene.updateMatrixWorld(true);
    nametagQuad.getWorldQuaternion(quadWorldQuat);

    // Quad world rotation must match camera world rotation (dot product |q1 · q2| ~ 1.0)
    const quatDot = Math.abs(quadWorldQuat.dot(camera.quaternion));
    assert.ok(quatDot > 0.999999, `Expected quad world rotation == camera rotation, got dot=${quatDot}`);

    const { widthPx, heightPx } = measureProjectedPixelBox();
    assert.ok(
      Math.abs(widthPx - NAMEPLATE_SCREEN_SPEC.playerAndPeerWidthPx) < 0.05,
      `Expected locked ${NAMEPLATE_SCREEN_SPEC.playerAndPeerWidthPx}px width, got ${widthPx.toFixed(4)}px`,
    );
    assert.ok(
      Math.abs(heightPx - NAMEPLATE_SCREEN_SPEC.playerAndPeerHeightPx) < 0.05,
      `Expected locked ${NAMEPLATE_SCREEN_SPEC.playerAndPeerHeightPx}px height, got ${heightPx.toFixed(4)}px`,
    );
  }
});

test('syncUprightCylindricalBillboard rotates upright sprites/markers strictly around world Y so they stay vertical under steep camera pitch', async () => {
  const { syncUprightCylindricalBillboard } = await import('./buddiesBillboardRules');

  const scene = new THREE.Scene();
  const parentGrp = new THREE.Group();
  parentGrp.rotation.y = -0.85;
  parentGrp.position.set(-6.0, 0, 12.0);
  scene.add(parentGrp);

  const uprightSprite = new THREE.Group();
  uprightSprite.position.set(0, 3.25, 0);
  parentGrp.add(uprightSprite);

  const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 300);
  // Steep overhead pitch looking downward at an oblique horizontal angle
  camera.position.set(4.5, 22.0, 21.0);
  camera.lookAt(-6.0, 1.5, 12.0);
  camera.updateMatrixWorld(true);

  syncUprightCylindricalBillboard(uprightSprite, camera, 0);
  scene.updateMatrixWorld(true);

  // Transform local up (0, 1, 0) to world space: must remain strictly (0, 1, 0) with zero tilt
  const worldUp = new THREE.Vector3(0, 1, 0)
    .applyQuaternion(uprightSprite.getWorldQuaternion(new THREE.Quaternion()))
    .normalize();
  assert.ok(Math.abs(worldUp.x) < 1e-6, `Expected zero X tilt on upright billboard, got ${worldUp.x}`);
  assert.ok(Math.abs(worldUp.y - 1) < 1e-6, `Expected world up Y = 1, got ${worldUp.y}`);
  assert.ok(Math.abs(worldUp.z) < 1e-6, `Expected zero Z roll on upright billboard, got ${worldUp.z}`);

  // Transform local forward (0, 0, 1) to world space: must point horizontally toward camera XZ
  const worldFwd = new THREE.Vector3(0, 0, 1)
    .applyQuaternion(uprightSprite.getWorldQuaternion(new THREE.Quaternion()))
    .normalize();
  const expectedHoriz = new THREE.Vector3(4.5 - -6.0, 0, 21.0 - 12.0).normalize();
  assert.ok(worldFwd.dot(expectedHoriz) > 0.999999, 'Expected upright billboard to face camera horizontally in XZ');
});


test('syncScreenSpaceBillboardQuad faces camera squarely and locks nametag screen size (146x33px) across indoor 0.55x zoom/pan and outdoor 1.0x views', async () => {
  const {
    NAMEPLATE_SCREEN_SPEC,
    syncScreenSpaceBillboardQuad,
  } = await import('./buddiesBillboardRules');

  const viewportW = 1440;
  const viewportH = 900;
  const camera = new THREE.PerspectiveCamera(46, viewportW / viewportH, 0.1, 300);

  const scene = new THREE.Scene();
  const playerRoot = new THREE.Group();
  // Simulate Rumah Kaca Cafe indoor 0.55x character scale + arbitrary player yaw
  playerRoot.scale.setScalar(0.55);
  playerRoot.rotation.y = 1.15;
  playerRoot.position.set(1.2, 60, 0.8);
  scene.add(playerRoot);

  const nametagQuad = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial(),
  );
  nametagQuad.position.set(0, NAMEPLATE_SCREEN_SPEC.standingHeadAnchorLocalY, 0);
  playerRoot.add(nametagQuad);

  const measureProjectedPixelBox = () => {
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    const corners = [
      new THREE.Vector3(-0.5, -0.5, 0),
      new THREE.Vector3(0.5, -0.5, 0),
      new THREE.Vector3(0.5, 0.5, 0),
      new THREE.Vector3(-0.5, 0.5, 0),
    ];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const c of corners) {
      c.applyMatrix4(nametagQuad.matrixWorld).project(camera);
      const px = (c.x * 0.5 + 0.5) * viewportW;
      const py = (-c.y * 0.5 + 0.5) * viewportH;
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
    return { widthPx: maxX - minX, heightPx: maxY - minY };
  };

  const scenarios = [
    // 1. Close indoor zoom inside Rumah Kaca Cafe (~1.8m from camera)
    { scale: 0.55, camPos: [1.2, 62.1, 2.6] as const, lookAt: [1.2, 61.1, 0.8] as const },
    // 2. Far indoor zoom + lateral orbit inside Rumah Kaca Cafe (~5.4m from camera, off-center)
    { scale: 0.55, camPos: [-2.8, 63.4, 4.7] as const, lookAt: [0.4, 61.0, 0.2] as const },
    // 3. Outdoor Central Plaza view (1.0x character scale, ~18m distance)
    { scale: 1.0, camPos: [9.5, 69.0, 15.8] as const, lookAt: [1.2, 61.5, 0.8] as const },
  ];

  const quadWorldQuat = new THREE.Quaternion();
  for (const sc of scenarios) {
    playerRoot.scale.setScalar(sc.scale);
    camera.position.set(sc.camPos[0], sc.camPos[1], sc.camPos[2]);
    camera.lookAt(sc.lookAt[0], sc.lookAt[1], sc.lookAt[2]);
    camera.updateMatrixWorld(true);

    syncScreenSpaceBillboardQuad(
      nametagQuad,
      camera,
      viewportH,
      NAMEPLATE_SCREEN_SPEC.playerAndPeerWidthPx,
      NAMEPLATE_SCREEN_SPEC.playerAndPeerHeightPx,
    );
    scene.updateMatrixWorld(true);
    nametagQuad.getWorldQuaternion(quadWorldQuat);

    // Quad world rotation must match camera world rotation (dot product |q1 · q2| ~ 1.0)
    const quatDot = Math.abs(quadWorldQuat.dot(camera.quaternion));
    assert.ok(quatDot > 0.999999, `Expected quad world rotation == camera rotation, got dot=${quatDot}`);

    const { widthPx, heightPx } = measureProjectedPixelBox();
    assert.ok(
      Math.abs(widthPx - NAMEPLATE_SCREEN_SPEC.playerAndPeerWidthPx) < 0.05,
      `Expected locked ${NAMEPLATE_SCREEN_SPEC.playerAndPeerWidthPx}px width, got ${widthPx.toFixed(4)}px`,
    );
    assert.ok(
      Math.abs(heightPx - NAMEPLATE_SCREEN_SPEC.playerAndPeerHeightPx) < 0.05,
      `Expected locked ${NAMEPLATE_SCREEN_SPEC.playerAndPeerHeightPx}px height, got ${heightPx.toFixed(4)}px`,
    );
  }
});

test('syncUprightCylindricalBillboard rotates upright sprites/markers strictly around world Y so they stay vertical under steep camera pitch', async () => {
  const { syncUprightCylindricalBillboard } = await import('./buddiesBillboardRules');

  const scene = new THREE.Scene();
  const parentGrp = new THREE.Group();
  parentGrp.rotation.y = -0.85;
  parentGrp.position.set(-6.0, 0, 12.0);
  scene.add(parentGrp);

  const uprightSprite = new THREE.Group();
  uprightSprite.position.set(0, 3.25, 0);
  parentGrp.add(uprightSprite);

  const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 300);
  // Steep overhead pitch looking downward at an oblique horizontal angle
  camera.position.set(4.5, 22.0, 21.0);
  camera.lookAt(-6.0, 1.5, 12.0);
  camera.updateMatrixWorld(true);

  syncUprightCylindricalBillboard(uprightSprite, camera, 0);
  scene.updateMatrixWorld(true);

  // Transform local up (0, 1, 0) to world space: must remain strictly (0, 1, 0) with zero tilt
  const worldUp = new THREE.Vector3(0, 1, 0)
    .applyQuaternion(uprightSprite.getWorldQuaternion(new THREE.Quaternion()))
    .normalize();
  assert.ok(Math.abs(worldUp.x) < 1e-6, `Expected zero X tilt on upright billboard, got ${worldUp.x}`);
  assert.ok(Math.abs(worldUp.y - 1) < 1e-6, `Expected world up Y = 1, got ${worldUp.y}`);
  assert.ok(Math.abs(worldUp.z) < 1e-6, `Expected zero Z roll on upright billboard, got ${worldUp.z}`);

  // Transform local forward (0, 0, 1) to world space: must point horizontally toward camera XZ
  const worldFwd = new THREE.Vector3(0, 0, 1)
    .applyQuaternion(uprightSprite.getWorldQuaternion(new THREE.Quaternion()))
    .normalize();
  const expectedHoriz = new THREE.Vector3(4.5 - -6.0, 0, 21.0 - 12.0).normalize();
  assert.ok(worldFwd.dot(expectedHoriz) > 0.999999, 'Expected upright billboard to face camera horizontally in XZ');
});



