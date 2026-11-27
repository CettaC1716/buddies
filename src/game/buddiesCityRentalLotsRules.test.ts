import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CITY_RENTAL_LOTS,
  CITY_RENTAL_LOT_SIZE_M,
  COMMERCIAL_AVENUE_SPEC,
  COMMERCIAL_BLOCK_PERIMETERS,
  COMMERCIAL_SIDEWALK_PATROL_WAYPOINTS,
  COMMERCIAL_SIDEWALK_STRIPS,
  DEFAULT_COMMERCIAL_CONFIG,
  SHOP_BILLBOARD_MESH_SPEC,
  SHOP_BUILDING_FORMS,
  SHOP_BUILDING_FORM_IDS,
  STANDARD_SHOP_FOOTPRINT_SPEC,
  buildPlacedShopBuildingColliders,
  computePlacedShopCollidersSignature,
  computeStandardShopPlacementForLot,
  evaluateCityRentalLotConflict,
  resolveCityRentalLotsState,
} from './buddiesCityRentalLotsRules';

test('Phase 0 block layout: 16 lots (20x20m) fill 100% of all 4 commercial block interiors facing west/east avenues', () => {
  assert.equal(CITY_RENTAL_LOTS.length, 16);
  assert.equal(CITY_RENTAL_LOT_SIZE_M.width, 20.0);
  assert.equal(CITY_RENTAL_LOT_SIZE_M.depth, 20.0);

  const byBlock = new Map<string, typeof CITY_RENTAL_LOTS[number][]>();
  for (const lot of CITY_RENTAL_LOTS) {
    const arr = byBlock.get(lot.blockId) ?? [];
    arr.push(lot);
    byBlock.set(lot.blockId, arr);
    assert.equal(lot.width, CITY_RENTAL_LOT_SIZE_M.width);
    assert.equal(lot.depth, CITY_RENTAL_LOT_SIZE_M.depth);
    assert.ok(lot.facing === 'west' || lot.facing === 'east');
    assert.equal(lot.frontDirZ, 0);
    assert.equal(lot.frontDirX, lot.facing === 'west' ? -1 : 1);
    assert.ok(
      (COMMERCIAL_AVENUE_SPEC.widenedAvenueXs as readonly number[]).includes(lot.facingAvenueX),
      `Lot ${lot.slotId} must face one of the widened avenues`,
    );
  }

  assert.equal(byBlock.size, 4);
  for (const perim of COMMERCIAL_BLOCK_PERIMETERS) {
    const blockLots = byBlock.get(perim.blockId) ?? [];
    assert.equal(blockLots.length, 4, `Block ${perim.blockId} must have 4 lots`);
    const westLots = blockLots.filter((l) => l.facing === 'west');
    const eastLots = blockLots.filter((l) => l.facing === 'east');
    assert.equal(westLots.length, 2, `Block ${perim.blockId} must have 2 west-facing lots`);
    assert.equal(eastLots.length, 2, `Block ${perim.blockId} must have 2 east-facing lots`);

    // 4 lots (20x20m = 400 m2 each) fill 100% of the 40m x 40m block interior framed by the 4-sided city sidewalk
    const innerArea = (perim.xInnerMax - perim.xInnerMin) * (perim.zInnerMax - perim.zInnerMin);
    const lotsArea = blockLots.reduce((acc, l) => acc + l.width * l.depth, 0);
    assert.ok(Math.abs(innerArea - lotsArea) < 1e-4, `Lots in ${perim.blockId} must fill 100% of block interior`);
  }
});

test('Phase 0 building fit: all 3 scaled shop forms fit strictly within 19.6x19.6m package cap on 20x20m lots and never overlap', () => {
  assert.equal(SHOP_BUILDING_FORM_IDS.length, 3);
  assert.equal(SHOP_BUILDING_FORMS.glass_corner_3story.name, 'Glass Corner 3-Story');
  assert.equal(SHOP_BUILDING_FORMS.canopy_storefront_2story.name, 'Canopy Storefront 2-Story');
  assert.equal(SHOP_BUILDING_FORMS.brick_rooftop_deck.name, 'Brick Block with Rooftop Deck');
  assert.equal(SHOP_BILLBOARD_MESH_SPEC.meshName, 'rooftop_billboard_face');
  assert.equal(SHOP_BILLBOARD_MESH_SPEC.materialName, 'rooftop_billboard_mat');
  assert.equal(STANDARD_SHOP_FOOTPRINT_SPEC.localDepthOffsetTowardRearM, 0);

  for (const formId of SHOP_BUILDING_FORM_IDS) {
    const form = SHOP_BUILDING_FORMS[formId];
    assert.ok(form.glbScale > 1.3, `${formId} must be scaled up to fill 20x20m lot`);
    assert.ok(form.footprintWidthM >= 18.5 && form.footprintWidthM <= STANDARD_SHOP_FOOTPRINT_SPEC.width);
    assert.ok(form.footprintDepthM >= 18.5 && form.footprintDepthM <= STANDARD_SHOP_FOOTPRINT_SPEC.depth);
    const expectedMargin = +(((CITY_RENTAL_LOT_SIZE_M.width - form.footprintWidthM) / 2).toFixed(3));
    assert.ok(expectedMargin >= STANDARD_SHOP_FOOTPRINT_SPEC.sideMarginM);
    for (const lot of CITY_RENTAL_LOTS) {
      const bounds = computeStandardShopPlacementForLot(lot, formId);
      assert.equal(bounds.fitsStrictlyInsideLot, true, `${formId} must fit lot ${lot.slotId}`);
      assert.equal(bounds.frontApronMarginM, expectedMargin);
      assert.equal(bounds.rearMarginM, expectedMargin);
      assert.equal(bounds.leftMarginM, expectedMargin);
      assert.equal(bounds.rightMarginM, expectedMargin);
      assert.equal(bounds.centerX, lot.x);
      assert.equal(bounds.centerZ, lot.z);
    }
  }

  // Pairwise non-touch check across all 16 placed buildings
  const placements = CITY_RENTAL_LOTS.map((lot) => computeStandardShopPlacementForLot(lot));
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const a = placements[i];
      const b = placements[j];
      const overlaps =
        a.maxX > b.minX && a.minX < b.maxX && a.maxZ > b.minZ && a.minZ < b.maxZ;
      assert.equal(overlaps, false, `Buildings on ${a.slotId} and ${b.slotId} must never touch`);
    }
  }
});

test('Phase 0 overlap suppression, 4.8m block sidewalks, and commercial config defaults match locked values', () => {
  const conflicts = CITY_RENTAL_LOTS.map((lot) => evaluateCityRentalLotConflict(lot));
  const suppressed = conflicts.filter((c) => c.hasConflict);
  assert.equal(suppressed.length, 2, 'SW block west-facing lots overlap Model Estate blue_0');
  assert.deepEqual(
    suppressed.map((c) => c.slotId).sort(),
    ['lot-s-01', 'lot-s-05'],
  );

  // Resting state: unrented lots show empty land, no building
  const resolved = resolveCityRentalLotsState({});
  assert.equal(resolved.filter((r) => r.isVisibleInWorld).length, 14);
  assert.equal(resolved.filter((r) => r.showShopBuilding).length, 0);

  // Locked commercial config starting defaults
  assert.equal(DEFAULT_COMMERCIAL_CONFIG.rentPriceRespite, 50);
  assert.equal(DEFAULT_COMMERCIAL_CONFIG.rentTermDays, 30);
  assert.equal(DEFAULT_COMMERCIAL_CONFIG.gracePeriodDays, 3);
  assert.equal(DEFAULT_COMMERCIAL_CONFIG.extensionCountedFromExpiry, true);
  assert.equal(DEFAULT_COMMERCIAL_CONFIG.buildingPricesRespite.glass_corner_3story, 250);
  assert.equal(DEFAULT_COMMERCIAL_CONFIG.buildingPricesRespite.canopy_storefront_2story, 200);
  assert.equal(DEFAULT_COMMERCIAL_CONFIG.buildingPricesRespite.brick_rooftop_deck, 200);

  // 4.80m curbed tram-style block sidewalks on widened avenues, never encroaching on lot area
  assert.equal(COMMERCIAL_AVENUE_SPEC.sidewalkWidthM, 4.8);
  assert.equal(COMMERCIAL_AVENUE_SPEC.totalAvenueCrossSectionWidthM, 20.0);
  assert.equal(COMMERCIAL_SIDEWALK_STRIPS.length, 8);
  assert.ok(COMMERCIAL_SIDEWALK_PATROL_WAYPOINTS.length >= 24);
  for (const strip of COMMERCIAL_SIDEWALK_STRIPS) {
    assert.equal(strip.widthM, 4.8);
    for (const lot of CITY_RENTAL_LOTS) {
      const overlapsLot =
        strip.maxX > lot.minX && strip.minX < lot.maxX && strip.maxZ > lot.minZ && strip.minZ < lot.maxZ;
      assert.equal(overlapsLot, false, `Sidewalk ${strip.id} must not overlap lot ${lot.slotId}`);
    }
  }
});

test('buildPlacedShopBuildingColliders generates solid wall-only OBB colliders strictly for placed or previewed shops', () => {
  // Empty lots -> 0 colliders
  const emptyResolved = resolveCityRentalLotsState({ blueCommanderBases: [], redCommanderBases: [] });
  assert.equal(buildPlacedShopBuildingColliders(emptyResolved).length, 0);
  assert.equal(computePlacedShopCollidersSignature(emptyResolved), 'none');

  // Single placed building -> 1 wall collider leaving outer paving walkable
  const singleResolved = resolveCityRentalLotsState({
    blueCommanderBases: [],
    redCommanderBases: [],
    rentedSlotIds: ['lot-n-01'],
    placedBuildingBySlotId: { 'lot-n-01': 'canopy_storefront_2story' },
  });
  const singleColliders = buildPlacedShopBuildingColliders(singleResolved);
  assert.equal(singleColliders.length, 1);
  const c = singleColliders[0];
  assert.equal(c.slotId, 'lot-n-01');
  assert.equal(c.x, -40.0);
  assert.equal(c.z, -70.33);
  assert.ok(c.halfX > 6.0 && c.halfX < 8.0, 'Wall collider must block building core while leaving paving walkable');
  assert.ok(c.halfZ > 6.0 && c.halfZ < 8.0);
  assert.equal(computePlacedShopCollidersSignature(singleResolved), 'lot-n-01:canopy_storefront_2story');

  // QA previewAllBuildingsFit -> all 16 solid building colliders active
  const previewResolved = resolveCityRentalLotsState({
    blueCommanderBases: [],
    redCommanderBases: [],
    previewAllBuildingsFit: true,
  });
  assert.equal(buildPlacedShopBuildingColliders(previewResolved).length, 16);
});
