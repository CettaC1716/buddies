import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  REAL_ESTATE_FURNITURE_KIOSK_LAYOUT,
  REAL_ESTATE_CATALOG_TRIGGER,
  evaluateRealEstateCatalogProximity,
  realEstateKioskLocalToWorldPose,
  computeRealEstateKioskWorldColliders,
  clampAudioVolumePct,
  computeChannelStateAfterSliderChange,
  computeChannelStateAfterToggleMute,
} from './buddiesRealEstateKioskRules';
import { buildRealEstateAndFurnitureKiosk3D } from './buddiesRealEstateKioskBuilder';
import { buildPlazaCommercialArcade3D } from './buddiesPlazaKioskArcadeBuilder';
import { soundEngine } from './audio';
import {
  CENTRAL_PLAZA_INFO_CENTER_KIOSK_SPEC,
  evaluateNearestCityTransitKioskProximity,
  getCityTransitDestinationById,
} from './buddiesBlitzRules';

function createSimpleStripGeo(
  pts: [number, number][],
  width: number,
  height: number,
): THREE.BufferGeometry {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [px, pz] of pts) {
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (pz < minZ) minZ = pz;
    if (pz > maxZ) maxZ = pz;
  }
  return new THREE.BoxGeometry(
    Math.max(0.1, maxX - minX + width),
    height,
    Math.max(0.1, maxZ - minZ + width),
  );
}

test('Unified Arcade Bay 2 (Real Estate Studio) world coordinates align cleanly with Central Plaza and Hana placement', () => {
  const center = realEstateKioskLocalToWorldPose(0, 0, 0, 0);
  assert.equal(center.x, -106.35);
  assert.equal(center.y, 2.5);
  assert.equal(center.z, -4.4);

  // Front entrance door (`localZ = +2.50`) faces East (`+X`) onto Central Plaza
  const frontDoor = realEstateKioskLocalToWorldPose(
    2.33,
    0,
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.entranceDoorFrontLocalZ,
    0,
  );
  assert.ok(frontDoor.x > -103.95 && frontDoor.x < -103.75);
  assert.ok(frontDoor.z < -6.5); // North-East door sits cleanly to the right of Bay 2 storefront window

  // Outdoor A-Frame sidewalk sign sits on the front cobblestone apron
  const signPose = realEstateKioskLocalToWorldPose(
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.aFrameSignLocal.x,
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.aFrameSignLocal.y,
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.aFrameSignLocal.z,
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.aFrameSignLocal.rotY,
  );
  assert.ok(signPose.x > -102.45 && signPose.x < -102.15);
  assert.ok(signPose.z < -5.8 && signPose.z > -6.2);
  assert.ok(signPose.y > 2.53 && signPose.y < 2.56);

  // Hana stands on the open Central Plaza tiles East (`+X`) of the cobblestone apron curb
  const graniteFrontEdge = realEstateKioskLocalToWorldPose(
    0,
    0,
    2.50 + REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.granitePaverBaseDepthLocal,
    0,
  );
  const hana = REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.hanaMerchantWorld;
  assert.ok(
    hana.x - graniteFrontEdge.x >= 0.45,
    `Expected Hana (${hana.x}) to stand >= 0.45m East of cobblestone curb (${graniteFrontEdge.x})`,
  );
  assert.equal(hana.y, 2.5);
  assert.equal(hana.rotY, Math.PI / 2);
});

test('Unified Arcade static OBB colliders maintain 1.50m rear alley clearance and clear Merchant Hana', () => {
  const colliders = computeRealEstateKioskWorldColliders();
  assert.equal(colliders.length, 5);

  const body = colliders.find((c) => c.id === 'lobby_kiosk_arcade_body');
  const bench = colliders.find((c) => c.id === 'lobby_kiosk_arcade_bench');
  const planterS = colliders.find((c) => c.id === 'lobby_kiosk_arcade_planter_s');
  const planterN = colliders.find((c) => c.id === 'lobby_kiosk_arcade_planter_n');
  const sign = colliders.find((c) => c.id === 'lobby_realestate_kiosk_sign');
  assert.ok(body, 'Expected lobby_kiosk_arcade_body collider');
  assert.ok(bench, 'Expected lobby_kiosk_arcade_bench collider');
  assert.ok(planterS, 'Expected lobby_kiosk_arcade_planter_s collider');
  assert.ok(planterN, 'Expected lobby_kiosk_arcade_planter_n collider');
  assert.ok(sign, 'Expected lobby_realestate_kiosk_sign collider');

  // Walkable rear service alley between west_wall_west East face (-110.40) and arcade West wall
  const rearAlleyGapM = body.x - body.halfX - -110.40;
  assert.ok(rearAlleyGapM >= 1.44, `Rear alley gap ${rearAlleyGapM.toFixed(3)}m must fit 2*0.72m player collider`);

  const hana = REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.hanaMerchantWorld;
  const hanaHalf = 0.52;

  for (const obb of colliders) {
    const overlapX = Math.abs(hana.x - obb.x) < hanaHalf + obb.halfX;
    const overlapZ = Math.abs(hana.z - obb.z) < hanaHalf + obb.halfZ;
    assert.equal(
      overlapX && overlapZ,
      false,
      `Merchant Hana OBB must not intersect ${obb.id}`,
    );
  }
});

test('buildPlazaCommercialArcade3D builds unified 3-bay arcade, skylights, furniture, dock and signs with finite geometry', () => {
  const westPlantGroup = new THREE.Group();
  const sharedClearGlassMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.32,
  });

  const arcadeGrp = buildPlazaCommercialArcade3D({
    westPlantGroup,
    isSoftwareGl: true,
    sharedClearGlassMat,
    createMitredPolylineStripGeometry: createSimpleStripGeo,
    addLobbyPart: (parent, geo, colorHex, pos, rot = [0, 0, 0]) => {
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: colorHex }),
      );
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.rotation.set(rot[0], rot[1], rot[2]);
      parent.add(mesh);
      return mesh;
    },
    createBlitzStrokeMesh: () => null,
    textures: {},
  });

  assert.equal(arcadeGrp.name, 'LobbyPlazaCommercialArcade3D');
  assert.ok(arcadeGrp.getObjectByName('FashionMannequinTrenchCoat'));
  assert.ok(arcadeGrp.getObjectByName('RealEstateArchitecturalScaleModel'));
  assert.ok(arcadeGrp.getObjectByName('RealEstateConsultationDeskZone'));
  assert.ok(arcadeGrp.getObjectByName('ShowroomInteriorFurnitureVignette'));
  assert.ok(arcadeGrp.getObjectByName('StaticDisplayElectricScooterBike'));
  assert.ok(arcadeGrp.getObjectByName('StaticDisplayPushKickScooter'));
  assert.ok(arcadeGrp.getObjectByName('ArcadeScooterChargingDockRack'));
  assert.ok(arcadeGrp.getObjectByName('ArcadeFrontCivicBench'));
  assert.ok(arcadeGrp.getObjectByName('ArcadePlanterSouth'));
  assert.ok(arcadeGrp.getObjectByName('ArcadePlanterNorth'));
  assert.ok(arcadeGrp.getObjectByName('FashionBoutiqueAFrameSidewalkSign'));
  assert.ok(arcadeGrp.getObjectByName('RealEstateAFrameSidewalkSign'));
  assert.ok(arcadeGrp.getObjectByName('UrbanScooterAFrameSidewalkSign'));

  let skylightCount = 0;
  let rearDoorCount = 0;
  arcadeGrp.traverse((obj) => {
    if (obj.name === 'ArcadeRoofSkylightMonitor') skylightCount += 1;
    if (obj.name === 'ArcadeRearStaffDoor') rearDoorCount += 1;
    if (obj instanceof THREE.Mesh) {
      const posAttr = obj.geometry.getAttribute('position');
      assert.ok(posAttr, 'Mesh must have position attribute');
      for (let i = 0; i < posAttr.count; i++) {
        assert.ok(Number.isFinite(posAttr.getX(i)));
        assert.ok(Number.isFinite(posAttr.getY(i)));
        assert.ok(Number.isFinite(posAttr.getZ(i)));
      }
    }
  });
  assert.equal(skylightCount, 3, 'Must include 3 rooftop clerestory skylights');
  assert.equal(rearDoorCount, 3, 'Must include 3 rear service staff doors');
});

test('buildRealEstateAndFurnitureKiosk3D builds all 4-quadrant architectural zones with finite geometry', () => {
  const westPlantGroup = new THREE.Group();
  const sharedClearGlassMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.32,
  });

  const kioskGrp = buildRealEstateAndFurnitureKiosk3D({
    westPlantGroup,
    isSoftwareGl: true,
    sharedClearGlassMat,
    createMitredPolylineStripGeometry: createSimpleStripGeo,
    addLobbyPart: (parent, geo, colorHex, pos, rot = [0, 0, 0]) => {
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: colorHex }),
      );
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.rotation.set(rot[0], rot[1], rot[2]);
      parent.add(mesh);
      return mesh;
    },
    createBlitzStrokeMesh: () => null,
    textures: {},
  });

  assert.equal(kioskGrp.name, 'LobbyRealEstateAndFurnitureKiosk');
  assert.ok(kioskGrp.getObjectByName('RealEstateArchitecturalScaleModel'));
  assert.ok(kioskGrp.getObjectByName('RealEstateConsultationDeskZone'));
  assert.ok(kioskGrp.getObjectByName('ShowroomInteriorFurnitureVignette'));
  assert.ok(kioskGrp.getObjectByName('RealEstateAFrameSidewalkSign'));

  let meshCount = 0;
  kioskGrp.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      meshCount += 1;
      const posAttr = obj.geometry.getAttribute('position');
      assert.ok(posAttr && posAttr.count > 0, 'Every mesh must have non-empty positions');
      for (let i = 0; i < posAttr.count; i++) {
        assert.ok(Number.isFinite(posAttr.getX(i)));
        assert.ok(Number.isFinite(posAttr.getY(i)));
        assert.ok(Number.isFinite(posAttr.getZ(i)));
      }
    }
  });
  assert.ok(meshCount >= 55, `Expected composite multi-zone showroom mesh count >= 55, got ${meshCount}`);
});

test('Audio mixer state transitions & SoundEngine independent Music / Sound FX volumes work without cross-muting', () => {
  assert.equal(clampAudioVolumePct(-15), 0);
  assert.equal(clampAudioVolumePct(145), 100);
  assert.equal(clampAudioVolumePct(64.6), 65);
  assert.equal(clampAudioVolumePct(Number.NaN), 100);

  // Dragging slider to 0% auto-mutes while preserving lastNonZeroPct
  const initial = { volumePct: 80, muted: false, lastNonZeroPct: 80 };
  const zeroed = computeChannelStateAfterSliderChange(initial, 0);
  assert.deepEqual(zeroed, { volumePct: 0, muted: true, lastNonZeroPct: 80 });

  // Toggling unmute from 0% restores lastNonZeroPct (80%)
  const restored = computeChannelStateAfterToggleMute(zeroed);
  assert.deepEqual(restored, { volumePct: 80, muted: false, lastNonZeroPct: 80 });

  // Dragging slider while muted automatically unmutes at new level
  const mutedAt80 = computeChannelStateAfterToggleMute(restored);
  assert.equal(mutedAt80.muted, true);
  const draggedTo45 = computeChannelStateAfterSliderChange(mutedAt80, 45);
  assert.deepEqual(draggedTo45, { volumePct: 45, muted: false, lastNonZeroPct: 45 });

  // SoundEngine independent channel volume & mute decoupling
  soundEngine.setMusicVolume(0.65);
  soundEngine.setSfxVolume(0.4);
  soundEngine.musicMuted = false;
  soundEngine.muted = true; // Muting SFX must NOT mute music
  assert.equal(Math.round(soundEngine.musicVolume * 100), 65);
  assert.equal(Math.round(soundEngine.sfxVolume * 100), 40);
  assert.equal(soundEngine.musicMuted, false);
  assert.equal(soundEngine.muted, true);

  // Restore defaults cleanly
  soundEngine.muted = false;
  soundEngine.setMusicVolume(1);
  soundEngine.setSfxVolume(1);
});

test('Central Plaza standalone teleport kiosk sits beside NW staircase balustrade corner facing West (-X)', () => {
  assert.equal(CENTRAL_PLAZA_INFO_CENTER_KIOSK_SPEC.kioskX, -88.80);
  assert.equal(CENTRAL_PLAZA_INFO_CENTER_KIOSK_SPEC.kioskY, 2.5);
  assert.equal(CENTRAL_PLAZA_INFO_CENTER_KIOSK_SPEC.kioskZ, -9.4);
  assert.equal(CENTRAL_PLAZA_INFO_CENTER_KIOSK_SPEC.kioskRotY, -Math.PI / 2);

  // Local +Z front screen rotated by -PI/2 around Y faces (-1, 0, 0) = West / Left
  const screenDirX = Math.sin(CENTRAL_PLAZA_INFO_CENTER_KIOSK_SPEC.kioskRotY);
  const screenDirZ = Math.cos(CENTRAL_PLAZA_INFO_CENTER_KIOSK_SPEC.kioskRotY);
  assert.ok(Math.abs(screenDirX - -1) < 1e-6);
  assert.ok(Math.abs(screenDirZ) < 1e-6);

  // Circular 0.98m baseplate clears the West balustrade curb face (-87.77) and staircase walkway (z >= -8.40)
  const padRadius = 0.98;
  assert.ok(CENTRAL_PLAZA_INFO_CENTER_KIOSK_SPEC.kioskX + padRadius < -87.77);
  assert.ok(CENTRAL_PLAZA_INFO_CENTER_KIOSK_SPEC.kioskZ + padRadius < -8.4);

  // Approaching from West/Left (-90.55, -9.4) triggers central_plaza proximity; old spot (-86.85, -21.85) does not
  const nearNewSpot = evaluateNearestCityTransitKioskProximity(-90.55, -9.4, 'safezone', 3.5);
  assert.equal(nearNewSpot.isNear, true);
  assert.equal(nearNewSpot.station?.id, 'central_plaza');

  const oldHouseFrontSpot = evaluateNearestCityTransitKioskProximity(-86.85, -21.85, 'safezone', 3.5);
  assert.equal(oldHouseFrontSpot.isNear, false);

  const centralSpec = getCityTransitDestinationById('central_plaza');
  assert.equal(centralSpec.spawnX, -90.80);
  assert.equal(centralSpec.spawnZ, -9.4);
});

test('Real Estate Catalog A-frame trigger sits cleanly beside the sidewalk sign and outside Hana proximity', () => {
  const atTrigger = evaluateRealEstateCatalogProximity(
    REAL_ESTATE_CATALOG_TRIGGER.x,
    REAL_ESTATE_CATALOG_TRIGGER.z,
  );
  assert.equal(atTrigger.isNear, true);
  assert.equal(atTrigger.distanceM, 0);

  // Standing beside Hana should NOT trigger the A-frame catalog proximity
  const atHana = evaluateRealEstateCatalogProximity(
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.hanaMerchantWorld.x,
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.hanaMerchantWorld.z,
  );
  assert.equal(atHana.isNear, false);
  assert.ok(
    atHana.distanceM > REAL_ESTATE_CATALOG_TRIGGER.triggerRadius,
    `Expected Hana (${atHana.distanceM.toFixed(2)}m) outside trigger radius (${REAL_ESTATE_CATALOG_TRIGGER.triggerRadius}m)`,
  );

  // Low chevron marker height sits ~0.38m above deckY cleanly
  assert.equal(REAL_ESTATE_CATALOG_TRIGGER.deckY, 2.5);
  assert.equal(REAL_ESTATE_CATALOG_TRIGGER.markerOffsetY, 0.38);
});

test('Glass Modern Model House door triangle sits on front circular medallion between balustrades', async () => {
  const { PLAZA_MODEL_HOUSE_DOOR_TRIGGER, evaluatePlazaModelHouseDoorProximity } = await import(
    './buddiesRealEstateKioskRules'
  );
  assert.equal(PLAZA_MODEL_HOUSE_DOOR_TRIGGER.x, -93.55);
  assert.equal(PLAZA_MODEL_HOUSE_DOOR_TRIGGER.z, -24.26);
  assert.equal(PLAZA_MODEL_HOUSE_DOOR_TRIGGER.houseStyle, 'glass_modern');

  // Must sit squarely in the portico opening between West (-96.30) and East (-90.80) balustrades
  assert.ok(PLAZA_MODEL_HOUSE_DOOR_TRIGGER.x > -96.30 && PLAZA_MODEL_HOUSE_DOOR_TRIGGER.x < -90.80);

  const atMedallion = evaluatePlazaModelHouseDoorProximity(
    PLAZA_MODEL_HOUSE_DOOR_TRIGGER.x,
    PLAZA_MODEL_HOUSE_DOOR_TRIGGER.z,
  );
  assert.equal(atMedallion.isNear, true);
  assert.equal(atMedallion.distanceM, 0);

  const farPlaza = evaluatePlazaModelHouseDoorProximity(-91.3, -15.0);
  assert.equal(farPlaza.isNear, false);
});

test('Merchant Hana shop-front patrol waypoints roam cleanly in front of 3-Bay West Plaza shops without colliding', async () => {
  const {
    HANA_SHOP_FRONT_PATROL_SPEED_MPS,
    HANA_SHOP_FRONT_PATROL_WAYPOINTS,
  } = await import('./buddiesRealEstateKioskRules');
  const { computeScooterShopWorldColliders } = await import('./buddiesUrbanScooterRules');
  const { computeFashionKioskWorldColliders } = await import('./buddiesFashionKioskRules');

  assert.ok(HANA_SHOP_FRONT_PATROL_WAYPOINTS.length >= 4);
  assert.ok(HANA_SHOP_FRONT_PATROL_SPEED_MPS >= 1.1 && HANA_SHOP_FRONT_PATROL_SPEED_MPS <= 1.7);

  const allShopColliders = [
    ...computeRealEstateKioskWorldColliders(),
    ...computeScooterShopWorldColliders(),
    ...computeFashionKioskWorldColliders(),
  ];
  const hanaRadius = 0.56;

  for (const wp of HANA_SHOP_FRONT_PATROL_WAYPOINTS) {
    // Stays in the open West Plaza promenade in front of her arcade
    assert.ok(wp.x >= -101.0 && wp.x <= -95.0, `Expected Hana waypoint x=${wp.x} in West Plaza storefront promenade`);
    assert.ok(wp.z >= -12.0 && wp.z <= 5.0, `Expected Hana waypoint z=${wp.z} across 3-bay arcade front`);
    for (const obb of allShopColliders) {
      const overlapX = Math.abs(wp.x - obb.x) < hanaRadius + obb.halfX;
      const overlapZ = Math.abs(wp.z - obb.z) < hanaRadius + obb.halfZ;
      assert.equal(
        overlapX && overlapZ,
        false,
        `Hana patrol waypoint (${wp.x}, ${wp.z}) must not collide with ${obb.id}`,
      );
    }
  }
});
