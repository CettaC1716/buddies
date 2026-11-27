import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CITY_RENTAL_LOTS,
  CITY_RENTAL_LOT_SIZE_M,
  COMMERCIAL_AVENUE_SPEC,
  COMMERCIAL_SIDEWALK_PATROL_WAYPOINTS,
  COMMERCIAL_SIDEWALK_STRIPS,
  DEFAULT_COMMERCIAL_CONFIG,
  SHOP_BILLBOARD_MESH_SPEC,
  SHOP_BUILDING_FORMS,
  SHOP_BUILDING_FORM_IDS,
  STANDARD_SHOP_FOOTPRINT_SPEC,
  computeStandardShopPlacementForLot,
  evaluateCityRentalLotConflict,
  resolveCityRentalLotsState,
} from './buddiesCityRentalLotsRules';

test('Phase 0 block layout: 16 lots in 4 blocks of 4, back-to-back on block centerline, facing west/east avenues', () => {
  assert.equal(CITY_RENTAL_LOTS.length, 16);

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
  for (const [blockId, blockLots] of byBlock.entries()) {
    assert.equal(blockLots.length, 4, `Block ${blockId} must have 4 lots`);
    const westLots = blockLots.filter((l) => l.facing === 'west');
    const eastLots = blockLots.filter((l) => l.facing === 'east');
    assert.equal(westLots.length, 2, `Block ${blockId} must have 2 west-facing lots`);
    assert.equal(eastLots.length, 2, `Block ${blockId} must have 2 east-facing lots`);
  }
});

test('Phase 0 building fit: all 3 forms fit strictly within the 14x14m package envelope, centred with per-form margins and never touch', () => {
  assert.equal(SHOP_BUILDING_FORM_IDS.length, 3);
  assert.equal(SHOP_BUILDING_FORMS.glass_corner_3story.name, 'Glass Corner 3-Story');
  assert.equal(SHOP_BUILDING_FORMS.canopy_storefront_2story.name, 'Canopy Storefront 2-Story');
  assert.equal(SHOP_BUILDING_FORMS.brick_rooftop_deck.name, 'Brick Block with Rooftop Deck');
  assert.equal(SHOP_BILLBOARD_MESH_SPEC.meshName, 'rooftop_billboard_face');
  assert.equal(SHOP_BILLBOARD_MESH_SPEC.materialName, 'rooftop_billboard_mat');
  assert.equal(STANDARD_SHOP_FOOTPRINT_SPEC.localDepthOffsetTowardRearM, 0);

  for (const formId of SHOP_BUILDING_FORM_IDS) {
    const form = SHOP_BUILDING_FORMS[formId];
    assert.ok(form.footprintWidthM <= STANDARD_SHOP_FOOTPRINT_SPEC.width);
    assert.ok(form.footprintDepthM <= STANDARD_SHOP_FOOTPRINT_SPEC.depth);
    // Package standard: centred placement, so every side margin is (15 - footprint) / 2.
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

test('Phase 0 overlap suppression preserves South-West Model Estate and commercial config defaults match locked values', () => {
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

  // Amendment 2: 2m sidewalks on widened avenues, never encroaching on lot depth
  assert.equal(COMMERCIAL_AVENUE_SPEC.sidewalkWidthM, 2.0);
  assert.equal(COMMERCIAL_AVENUE_SPEC.totalAvenueCrossSectionWidthM, 14.4);
  assert.equal(COMMERCIAL_SIDEWALK_STRIPS.length, 8);
  assert.ok(COMMERCIAL_SIDEWALK_PATROL_WAYPOINTS.length >= 24);
  for (const strip of COMMERCIAL_SIDEWALK_STRIPS) {
    assert.equal(strip.widthM, 2.0);
    for (const lot of CITY_RENTAL_LOTS) {
      const overlapsLot =
        strip.maxX > lot.minX && strip.minX < lot.maxX && strip.maxZ > lot.minZ && strip.minZ < lot.maxZ;
      assert.equal(overlapsLot, false, `Sidewalk ${strip.id} must not take from lot ${lot.slotId}`);
    }
  }
});
