import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  ELECTRIC_SCOOTER_BIKE_SPEC,
  PUSH_KICK_SCOOTER_SPEC,
  URBAN_SCOOTER_CATALOG_ITEMS,
  URBAN_SCOOTER_SHOP_LAYOUT,
  URBAN_SCOOTER_SHOP_TRIGGER,
  evaluateUrbanScooterShopProximity,
  kioskLocalToWorldPose,
  computeScooterWheelSpinDeltaRad,
  computeScooterShopWorldColliders,
  getNearBlocksNftTokenUrl,
} from './buddiesUrbanScooterRules';
import {
  createElectricScooterBike3D,
  createPushKickScooter3D,
  buildUrbanScooterShowroomKiosk3D,
} from './buddiesUrbanScooterBuilder';
import {
  prepareStudioFurnitureGroup,
  rasterizeTexturedGroupToBuffer,
} from '../components/furniture3dRasterizer';
import { computeRealEstateKioskWorldColliders } from './buddiesRealEstateKioskRules';
import {
  FASHION_APPAREL_KIOSK_LAYOUT,
  computeFashionKioskWorldColliders,
  computeWestPromenadeKioskSymmetryMetrics,
} from './buddiesFashionKioskRules';
import { buildFashionAndApparelKiosk3D } from './buddiesFashionKioskBuilder';

test('4-view industrial model sheet dimensions match Electric Scooter Bike & Push Kick Scooter specs', () => {
  // Electric Scooter Bike (`screen_8a1fbcde.png`)
  assert.equal(ELECTRIC_SCOOTER_BIKE_SPEC.currency, 'RESPITE');
  assert.equal(ELECTRIC_SCOOTER_BIKE_SPEC.isNft, true);
  assert.equal(ELECTRIC_SCOOTER_BIKE_SPEC.lengthM, 1.80);
  assert.equal(ELECTRIC_SCOOTER_BIKE_SPEC.wheelbaseM, 1.25);
  assert.equal(
    +(ELECTRIC_SCOOTER_BIKE_SPEC.frontWheelAxle.z - ELECTRIC_SCOOTER_BIKE_SPEC.rearWheelAxle.z).toFixed(2),
    1.25,
  );
  assert.equal(ELECTRIC_SCOOTER_BIKE_SPEC.seatHeightM, 0.78);
  assert.equal(ELECTRIC_SCOOTER_BIKE_SPEC.handlebarHeightM, 1.15);
  assert.equal(ELECTRIC_SCOOTER_BIKE_SPEC.mirrorSpanWidthM, 0.70);
  assert.equal(ELECTRIC_SCOOTER_BIKE_SPEC.groundClearanceM, 0.16);

  // Push / Kick Scooter (`screen_e2bde276.png`)
  assert.equal(PUSH_KICK_SCOOTER_SPEC.currency, 'RESPITE');
  assert.equal(PUSH_KICK_SCOOTER_SPEC.isNft, true);
  assert.equal(PUSH_KICK_SCOOTER_SPEC.lengthM, 0.92);
  assert.equal(PUSH_KICK_SCOOTER_SPEC.foldedLengthM, 0.85);
  assert.equal(PUSH_KICK_SCOOTER_SPEC.foldedHeightM, 0.32);
  assert.equal(PUSH_KICK_SCOOTER_SPEC.tBarWidthM, 0.48);
  assert.equal(PUSH_KICK_SCOOTER_SPEC.deckClearanceM, 0.08);
  assert.equal(PUSH_KICK_SCOOTER_SPEC.wheelOuterRadiusM, 0.10);
});

test('2 front outdoor scooter displays are non-rideable static props and leave entrance door & plaza clear', () => {
  assert.equal(URBAN_SCOOTER_SHOP_LAYOUT.frontStaticDisplays.length, 2);
  const [bikeDisp, kickDisp] = URBAN_SCOOTER_SHOP_LAYOUT.frontStaticDisplays;

  assert.equal(bikeDisp.kind, 'electric_scooter_bike');
  assert.equal(bikeDisp.isStaticDisplay, true);
  assert.equal(bikeDisp.isRideable, false);
  assert.equal(bikeDisp.currency, 'RESPITE');

  assert.equal(kickDisp.kind, 'push_kick_scooter');
  assert.equal(kickDisp.isStaticDisplay, true);
  assert.equal(kickDisp.isRideable, false);
  assert.equal(kickDisp.currency, 'RESPITE');

  // Both displays sit strictly in front of the Left & Center display windows (`localX < entranceDoorLocalXMin`)
  assert.ok(bikeDisp.localX + bikeDisp.plinthHalfWidthLocal < URBAN_SCOOTER_SHOP_LAYOUT.entranceDoorLocalXMin);
  assert.ok(kickDisp.localX + kickDisp.plinthHalfWidthLocal < URBAN_SCOOTER_SHOP_LAYOUT.entranceDoorLocalXMin);

  // Check world coordinates sit cleanly on the Central Plaza upper deck (`y = 2.50m`) in front of `x = -98.42` glass
  const bikeWorld = kioskLocalToWorldPose(bikeDisp.localX, bikeDisp.localY, bikeDisp.localZ, bikeDisp.localRotY);
  const kickWorld = kioskLocalToWorldPose(kickDisp.localX, kickDisp.localY, kickDisp.localZ, kickDisp.localRotY);

  assert.equal(bikeWorld.y, 2.5);
  assert.equal(kickWorld.y, 2.5);
  assert.ok(bikeWorld.x > -98.0 && bikeWorld.x < -94.0);
  assert.ok(kickWorld.x > -98.0 && kickWorld.x < -94.0);
  assert.ok(Math.hypot(bikeWorld.x - kickWorld.x, bikeWorld.z - kickWorld.z) > 1.85);

  const colliders = computeScooterShopWorldColliders();
  assert.equal(colliders.length, 4);
  for (const col of colliders) {
    assert.ok(col.heightY > 3.5, `Expected Central Plaza collider ${col.id} above y=2.50m deck`);
  }
});

test('3D scooter & showroom builders assemble articulated hierarchies without NaN vertices', () => {
  const bike = createElectricScooterBike3D({ parked: true, steerAngleRad: -0.14 });
  bike.root.updateMatrixWorld(true);
  const bikeBox = new THREE.Box3().setFromObject(bike.root);
  const bikeSize = bikeBox.getSize(new THREE.Vector3());
  assert.ok(bikeSize.z > 1.65 && bikeSize.z < 2.15, `Unexpected bike length: ${bikeSize.z}`);
  assert.ok(bikeSize.y > 1.15 && bikeSize.y < 1.55, `Unexpected bike height: ${bikeSize.y}`);
  assert.ok(bikeSize.x > 0.60 && bikeSize.x < 0.95, `Unexpected bike width: ${bikeSize.x}`);

  // Verify every mesh has finite position, normal, and UV attributes
  let bikeMeshCount = 0;
  bike.root.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (!m.isMesh) return;
    bikeMeshCount++;
    const pos = m.geometry.getAttribute('position');
    const norm = m.geometry.getAttribute('normal');
    const uv = m.geometry.getAttribute('uv');
    assert.ok(pos && pos.count > 0);
    assert.ok(norm && norm.count === pos.count);
    assert.ok(uv && uv.count === pos.count);
    for (let i = 0; i < pos.count; i++) {
      assert.ok(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getY(i)) && Number.isFinite(pos.getZ(i)));
      assert.ok(Number.isFinite(norm.getX(i)) && Number.isFinite(norm.getY(i)) && Number.isFinite(norm.getZ(i)));
      assert.ok(Number.isFinite(uv.getX(i)) && Number.isFinite(uv.getY(i)));
    }
  });
  assert.ok(bikeMeshCount >= 20, `Expected rich composite 3D scooter bike mesh count, got ${bikeMeshCount}`);

  // Test articulated kickstand, steering, and wheel spin helpers
  bike.setParked(false);
  assert.ok(bike.kickstandGroup.rotation.x > 1.0);
  bike.spinWheels(Math.PI * ELECTRIC_SCOOTER_BIKE_SPEC.wheelOuterRadiusM);
  assert.ok(Math.abs(bike.frontWheelGroup.rotation.x - Math.PI) < 1e-4);

  const kick = createPushKickScooter3D({ parked: true, folded: false });
  kick.root.updateMatrixWorld(true);
  const kickUprightBox = new THREE.Box3().setFromObject(kick.root);
  const kickUprightSize = kickUprightBox.getSize(new THREE.Vector3());

  kick.setFolded(true);
  kick.root.updateMatrixWorld(true);
  const kickFoldedBox = new THREE.Box3().setFromObject(kick.root);
  const kickFoldedSize = kickFoldedBox.getSize(new THREE.Vector3());
  assert.ok(
    kickFoldedSize.y < kickUprightSize.y * 0.55,
    `Expected folded kick scooter height (${kickFoldedSize.y}) << upright height (${kickUprightSize.y})`,
  );
  assert.equal(kick.carryingStrapGroup.visible, true);

  // Verify studio rasterizer renders both models cleanly and skips hidden subgroups (`carryingStrapGroup.visible = false`)
  const studioBike = prepareStudioFurnitureGroup(
    createElectricScooterBike3D({ parked: true, steerAngleRad: -0.14, includeContactShadow: false }).root,
    1.24,
  );
  studioBike.rotation.set(0.22, 0.64, 0);
  const pixels = new Uint8ClampedArray(320 * 240 * 4);
  const triCount = rasterizeTexturedGroupToBuffer(studioBike, pixels, 320, 240, 2.86, 24);
  assert.ok(triCount > 800, `Expected >800 rasterized triangles for scooter bike, got ${triCount}`);
  let nonEmptyPixels = 0;
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] > 0) nonEmptyPixels++;
  }
  assert.ok(nonEmptyPixels > 2200, `Expected substantial scooter silhouette coverage, got ${nonEmptyPixels} px`);

  const kickUprightStudio = createPushKickScooter3D({ parked: true, folded: false, includeContactShadow: false });
  assert.equal(kickUprightStudio.carryingStrapGroup.visible, false);
  const uprightKickTris = rasterizeTexturedGroupToBuffer(
    prepareStudioFurnitureGroup(kickUprightStudio.root, 0.90),
    pixels,
    320,
    240,
    2.86,
    24,
  );
  kickUprightStudio.setFolded(true);
  assert.equal(kickUprightStudio.carryingStrapGroup.visible, true);
  const foldedKickTris = rasterizeTexturedGroupToBuffer(
    prepareStudioFurnitureGroup(kickUprightStudio.root, 1.12),
    pixels,
    320,
    240,
    2.86,
    24,
  );
  assert.ok(
    foldedKickTris > uprightKickTris,
    `Expected folded kick scooter (${foldedKickTris} tris, strap visible) > upright (${uprightKickTris} tris, strap hidden)`,
  );

  // Verify full showroom kiosk builds both static displays flagged non-rideable
  const westPlantGroup = new THREE.Group();
  const showroom = buildUrbanScooterShowroomKiosk3D({
    westPlantGroup,
    isSoftwareGl: true,
    sharedClearGlassMat: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3 }),
    createMitredPolylineStripGeometry: () => new THREE.BoxGeometry(1, 0.2, 1),
    addLobbyPart: (parent, geo, colorHex, pos, rot = [0, 0, 0]) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colorHex }));
      m.position.set(pos[0], pos[1], pos[2]);
      m.rotation.set(rot[0], rot[1], rot[2]);
      parent.add(m);
      return m;
    },
    createBlitzStrokeMesh: () => null,
    textures: {},
  });

  const bikeSlot = showroom.getObjectByName('StaticDisplayElectricScooterBike');
  const kickSlot = showroom.getObjectByName('StaticDisplayPushKickScooter');
  assert.ok(bikeSlot);
  assert.ok(kickSlot);
  assert.equal(bikeSlot!.userData.isRideable, false);
  assert.equal(kickSlot!.userData.isRideable, false);
  assert.equal(computeScooterWheelSpinDeltaRad('push_kick_scooter', 0.20, 1.0), 2.0);
});

test('low 3D interaction triangle sits clear beside A-Frame sign and NFT Explorer URL points to NearBlocks', () => {
  const signWorld = kioskLocalToWorldPose(
    URBAN_SCOOTER_SHOP_LAYOUT.aFrameSignLocal.x,
    URBAN_SCOOTER_SHOP_LAYOUT.aFrameSignLocal.y,
    URBAN_SCOOTER_SHOP_LAYOUT.aFrameSignLocal.z,
    URBAN_SCOOTER_SHOP_LAYOUT.aFrameSignLocal.rotY,
  );

  // Marker sits right beside the bottom-right of the A-Frame sidewalk sign at low floor elevation (+0.38m)
  assert.equal(URBAN_SCOOTER_SHOP_TRIGGER.deckY, 2.5);
  assert.equal(URBAN_SCOOTER_SHOP_TRIGGER.markerOffsetY, 0.38);
  assert.ok(URBAN_SCOOTER_SHOP_TRIGGER.x > signWorld.x, 'Marker should sit slightly East (in front) of A-Frame sign');
  assert.ok(URBAN_SCOOTER_SHOP_TRIGGER.z < signWorld.z - 0.5, 'Marker should sit clearly North (right side) of A-Frame sign over plaza tiles');

  // Ensure the player can stand directly on the interaction triangle without colliding with any OBB
  const colliders = computeScooterShopWorldColliders();
  for (const col of colliders) {
    const cosR = Math.cos(-col.rotY);
    const sinR = Math.sin(-col.rotY);
    const dx = URBAN_SCOOTER_SHOP_TRIGGER.x - col.x;
    const dz = URBAN_SCOOTER_SHOP_TRIGGER.z - col.z;
    const localX = dx * cosR - dz * sinR;
    const localZ = dx * sinR + dz * cosR;
    const isInsideObb = Math.abs(localX) < col.halfX && Math.abs(localZ) < col.halfZ;
    assert.equal(isInsideObb, false, `Interaction triangle must not sit inside OBB collider ${col.id}`);
  }

  // Proximity trigger check
  const atMarker = evaluateUrbanScooterShopProximity(
    URBAN_SCOOTER_SHOP_TRIGGER.x,
    URBAN_SCOOTER_SHOP_TRIGGER.z,
  );
  assert.equal(atMarker.isNear, true);
  assert.equal(atMarker.distanceM, 0);

  const nearbyPlaza = evaluateUrbanScooterShopProximity(
    URBAN_SCOOTER_SHOP_TRIGGER.x + 2.4,
    URBAN_SCOOTER_SHOP_TRIGGER.z + 1.2,
  );
  assert.equal(nearbyPlaza.isNear, true);

  const farPlaza = evaluateUrbanScooterShopProximity(-85.0, 0.0);
  assert.equal(farPlaza.isNear, false);

  // Exclusive showroom NFT catalog priced in RESPITE + NearBlocks NFT Token Explorer URLs
  assert.equal(URBAN_SCOOTER_CATALOG_ITEMS.length, 2);
  const [bikeItem, kickItem] = URBAN_SCOOTER_CATALOG_ITEMS;
  assert.equal(bikeItem.currency, 'RESPITE');
  assert.equal(bikeItem.priceRespite, 30);
  assert.equal(bikeItem.isNft, true);
  assert.equal(
    getNearBlocksNftTokenUrl('market.buddiesblitz.testnet', bikeItem.tokenId, 'testnet'),
    'https://testnet.nearblocks.io/nft-token/market.buddiesblitz.testnet/nep245%3Avehicle%3Aurban_electric_scooter_bike',
  );
  assert.equal(
    getNearBlocksNftTokenUrl('market.buddiesblitz.near', bikeItem.tokenId, 'mainnet'),
    'https://nearblocks.io/nft-token/market.buddiesblitz.near/nep245%3Avehicle%3Aurban_electric_scooter_bike',
  );

  assert.equal(kickItem.currency, 'RESPITE');
  assert.equal(kickItem.priceRespite, 15);
  assert.equal(kickItem.isNft, true);
  assert.equal(
    getNearBlocksNftTokenUrl('market.buddiesblitz.testnet', kickItem.tokenId, 'testnet'),
    'https://testnet.nearblocks.io/nft-token/market.buddiesblitz.testnet/nep245%3Avehicle%3Aurban_push_kick_scooter',
  );
});

test('West Promenade 3 kiosks (Real Estate, Scooter, Fashion) have exact symmetrical spacing and disjoint OBB colliders', () => {
  const sym = computeWestPromenadeKioskSymmetryMetrics();
  assert.equal(sym.northRealEstateZ, -13.8);
  assert.equal(sym.centerScooterZ, -4.4);
  assert.equal(sym.southFashionZ, 5.0);
  assert.equal(sym.northToCenterSpanM, 9.4);
  assert.equal(sym.centerToSouthSpanM, 9.4);
  assert.equal(sym.isSymmetrical, true);

  // Build Fashion & Apparel Boutique Kiosk 3D group and verify key architectural & merchandising sub-assemblies
  const westPlantGroup = new THREE.Group();
  const fashionKiosk = buildFashionAndApparelKiosk3D({
    westPlantGroup,
    isSoftwareGl: true,
    sharedClearGlassMat: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3 }),
    createMitredPolylineStripGeometry: () => new THREE.BoxGeometry(1, 0.2, 1),
    addLobbyPart: (parent, geo, colorHex, pos, rot = [0, 0, 0]) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colorHex }));
      m.position.set(pos[0], pos[1], pos[2]);
      m.rotation.set(rot[0], rot[1], rot[2]);
      parent.add(m);
      return m;
    },
    createBlitzStrokeMesh: () => null,
    textures: {},
  });

  assert.equal(fashionKiosk.position.z, FASHION_APPAREL_KIOSK_LAYOUT.kioskLocalZ);
  assert.ok(fashionKiosk.getObjectByName('FashionMannequinTrenchCoat'));
  assert.ok(fashionKiosk.getObjectByName('FashionMannequinALineDress'));
  assert.ok(fashionKiosk.getObjectByName('FashionMannequinTailoredMidi'));
  assert.ok(fashionKiosk.getObjectByName('FashionBoutiqueMainGarmentRack'));
  assert.ok(fashionKiosk.getObjectByName('FashionBoutiqueSideGarmentRack'));
  assert.ok(fashionKiosk.getObjectByName('FashionApparelAccessoriesDisplay'));
  assert.ok(fashionKiosk.getObjectByName('FashionBoutiqueAFrameSidewalkSign'));

  // Verify the 3 kiosk body OBB colliders sit cleanly separated along Z and clear of South lamppost w4 (z = 11.6)
  const reBody = computeRealEstateKioskWorldColliders().find((c) => c.id === 'lobby_realestate_kiosk_body')!;
  const scBody = computeScooterShopWorldColliders().find((c) => c.id === 'lobby_scooter_kiosk_body')!;
  const faBody = computeFashionKioskWorldColliders().find((c) => c.id === 'lobby_fashion_kiosk_body')!;

  assert.ok(reBody.z + reBody.halfZ < scBody.z - scBody.halfZ, 'Real Estate and Scooter kiosk bodies must not overlap');
  assert.ok(scBody.z + scBody.halfZ < faBody.z - faBody.halfZ, 'Scooter and Fashion kiosk bodies must not overlap');
  assert.ok(faBody.z + faBody.halfZ < 11.6 - 0.28, 'Fashion kiosk body must sit cleanly North of lamppost w4');
});

