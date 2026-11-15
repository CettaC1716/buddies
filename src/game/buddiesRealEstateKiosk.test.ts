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

test('Real Estate & Furniture Kiosk world coordinates align cleanly with Central Plaza and Hana placement', () => {
  const center = realEstateKioskLocalToWorldPose(0, 0, 0, 0);
  assert.equal(center.x, -100.7);
  assert.equal(center.y, 2.5);
  assert.equal(center.z, -13.8);

  // Front display glass (`localZ = +1.54`) faces East (`+X`) onto Central Plaza
  const frontDoor = realEstateKioskLocalToWorldPose(
    1.41,
    0,
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.entranceDoorFrontLocalZ,
    0,
  );
  assert.ok(frontDoor.x > -98.5 && frontDoor.x < -98.3);
  assert.ok(frontDoor.z < -15.5); // North-East bay corresponds to right entrance door

  // Outdoor A-Frame sidewalk sign sits on the front-right Granite Plaza Paver Base
  const signPose = realEstateKioskLocalToWorldPose(
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.aFrameSignLocal.x,
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.aFrameSignLocal.y,
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.aFrameSignLocal.z,
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.aFrameSignLocal.rotY,
  );
  assert.ok(signPose.x > -98.1 && signPose.x < -97.6);
  assert.ok(signPose.z < -16.3 && signPose.z > -16.9);
  assert.ok(signPose.y > 2.60 && signPose.y < 2.63);

  // Hana stands on the open Central Plaza tiles East (`+X`) of the stepped Granite Plaza Paver Base
  const graniteFrontEdge = realEstateKioskLocalToWorldPose(
    0,
    0,
    0.14 + REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.granitePaverBaseDepthLocal * 0.5,
    0,
  );
  const hana = REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.hanaMerchantWorld;
  assert.ok(
    hana.x - graniteFrontEdge.x >= 1.35,
    `Expected Hana (${hana.x}) to stand >= 1.35m East of granite paver edge (${graniteFrontEdge.x})`,
  );
  assert.equal(hana.y, 2.5);
  assert.equal(hana.rotY, Math.PI / 2);
});

test('Real Estate Kiosk static OBB colliders do not overlap Merchant Hana or her East interaction zone', () => {
  const colliders = computeRealEstateKioskWorldColliders();
  assert.equal(colliders.length, 2);

  const body = colliders.find((c) => c.id === 'lobby_realestate_kiosk_body');
  const sign = colliders.find((c) => c.id === 'lobby_realestate_kiosk_sign');
  assert.ok(body, 'Expected lobby_realestate_kiosk_body collider');
  assert.ok(sign, 'Expected lobby_realestate_kiosk_sign collider');

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
  assert.equal(CENTRAL_PLAZA_INFO_CENTER_KIOSK_SPEC.kioskX, -86.55);
  assert.equal(CENTRAL_PLAZA_INFO_CENTER_KIOSK_SPEC.kioskY, 2.5);
  assert.equal(CENTRAL_PLAZA_INFO_CENTER_KIOSK_SPEC.kioskZ, -9.4);
  assert.equal(CENTRAL_PLAZA_INFO_CENTER_KIOSK_SPEC.kioskRotY, -Math.PI / 2);

  // Local +Z front screen rotated by -PI/2 around Y faces (-1, 0, 0) = West / Left
  const screenDirX = Math.sin(CENTRAL_PLAZA_INFO_CENTER_KIOSK_SPEC.kioskRotY);
  const screenDirZ = Math.cos(CENTRAL_PLAZA_INFO_CENTER_KIOSK_SPEC.kioskRotY);
  assert.ok(Math.abs(screenDirX - -1) < 1e-6);
  assert.ok(Math.abs(screenDirZ) < 1e-6);

  // Circular 0.98m baseplate clears the West balustrade curb face (-85.52) and staircase walkway (z >= -8.40)
  const padRadius = 0.98;
  assert.ok(CENTRAL_PLAZA_INFO_CENTER_KIOSK_SPEC.kioskX + padRadius < -85.52);
  assert.ok(CENTRAL_PLAZA_INFO_CENTER_KIOSK_SPEC.kioskZ + padRadius < -8.4);

  // Approaching from West/Left (-88.3, -9.4) triggers central_plaza proximity; old spot (-86.85, -21.85) does not
  const nearNewSpot = evaluateNearestCityTransitKioskProximity(-88.3, -9.4, 'safezone', 3.5);
  assert.equal(nearNewSpot.isNear, true);
  assert.equal(nearNewSpot.station?.id, 'central_plaza');

  const oldHouseFrontSpot = evaluateNearestCityTransitKioskProximity(-86.85, -21.85, 'safezone', 3.5);
  assert.equal(oldHouseFrontSpot.isNear, false);

  const centralSpec = getCityTransitDestinationById('central_plaza');
  assert.equal(centralSpec.spawnX, -88.55);
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

test('Classic Plaza Manor Model House door triangle sits on front circular medallion between balustrades', async () => {
  const { PLAZA_MODEL_HOUSE_DOOR_TRIGGER, evaluatePlazaModelHouseDoorProximity } = await import(
    './buddiesRealEstateKioskRules'
  );
  assert.equal(PLAZA_MODEL_HOUSE_DOOR_TRIGGER.x, -91.3);
  assert.equal(PLAZA_MODEL_HOUSE_DOOR_TRIGGER.z, -24.26);
  assert.equal(PLAZA_MODEL_HOUSE_DOOR_TRIGGER.houseStyle, 'plaza_manor');

  // Must sit squarely in the portico opening between West (-94.05) and East (-88.55) balustrades
  assert.ok(PLAZA_MODEL_HOUSE_DOOR_TRIGGER.x > -94.05 && PLAZA_MODEL_HOUSE_DOOR_TRIGGER.x < -88.55);

  const atMedallion = evaluatePlazaModelHouseDoorProximity(
    PLAZA_MODEL_HOUSE_DOOR_TRIGGER.x,
    PLAZA_MODEL_HOUSE_DOOR_TRIGGER.z,
  );
  assert.equal(atMedallion.isNear, true);
  assert.equal(atMedallion.distanceM, 0);

  const farPlaza = evaluatePlazaModelHouseDoorProximity(-91.3, -15.0);
  assert.equal(farPlaza.isNear, false);
});
