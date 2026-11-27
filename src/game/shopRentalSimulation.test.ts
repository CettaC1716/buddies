import assert from 'node:assert/strict';
import test from 'node:test';
import type { ShopBuildingFormId } from './buddiesCityRentalLotsRules';
import { createEmptyLotRentalStore, MS_PER_DAY, type LotRentalRecord } from './shopRentalEngine';
import {
  endSimulatedLotRental,
  extendSimulatedLotRental,
  placeSimulatedBuildingOnLot,
  removeSimulatedBuildingFromLot,
  startSimulatedLotRental,
} from './shopRentalSimulation';

const NOW = Date.UTC(2026, 10, 27, 9, 0, 0);

test('simulation start: free record with config term/grace on an available lot', () => {
  const res = startSimulatedLotRental({
    store: createEmptyLotRentalStore(),
    lotId: 'lot-n-01',
    accountId: 'alice.testnet',
    nowMs: NOW,
  });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  const rec = res.store.rentalsByLotId['lot-n-01'];
  assert.equal(rec.renterAccountId, 'alice.testnet');
  assert.equal(rec.lockedRentRespite, 0);
  assert.equal(rec.termDays, 30);
  assert.equal(rec.gracePeriodDays, 3);
  assert.equal(rec.startedAtMs, NOW);
  assert.equal(rec.expiresAtMs, NOW + 30 * MS_PER_DAY);
  assert.equal(rec.placedBuildingFormId, null);
  assert.equal(rec.billboardLogoUrl, null);
});

test('simulation start: rejected while the lot is actively rented', () => {
  const first = startSimulatedLotRental({
    store: createEmptyLotRentalStore(),
    lotId: 'lot-s-03',
    accountId: 'alice.testnet',
    nowMs: NOW,
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;

  const second = startSimulatedLotRental({
    store: first.store,
    lotId: 'lot-s-03',
    accountId: 'bob.testnet',
    nowMs: NOW + MS_PER_DAY,
  });
  assert.equal(second.ok, false);

  // Still rented inside the grace window too (expiry + 2 days, grace is 3).
  const inGrace = startSimulatedLotRental({
    store: first.store,
    lotId: 'lot-s-03',
    accountId: 'bob.testnet',
    nowMs: NOW + 32 * MS_PER_DAY,
  });
  assert.equal(inGrace.ok, false);
});

test('simulation start: replaces a past-grace (freeing) record', () => {
  const stale: LotRentalRecord = {
    lotId: 'lot-n-05',
    renterAccountId: 'old.testnet',
    lockedRentRespite: 0,
    termDays: 30,
    gracePeriodDays: 3,
    startedAtMs: NOW - 40 * MS_PER_DAY,
    expiresAtMs: NOW - 10 * MS_PER_DAY,
    placedBuildingFormId: 'brick_rooftop_deck',
    billboardLogoUrl: null,
  };
  const store = {
    ...createEmptyLotRentalStore(),
    rentalsByLotId: { 'lot-n-05': stale },
  };
  const res = startSimulatedLotRental({
    store,
    lotId: 'lot-n-05',
    accountId: 'alice.testnet',
    nowMs: NOW,
  });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  const rec = res.store.rentalsByLotId['lot-n-05'];
  assert.equal(rec.renterAccountId, 'alice.testnet');
  assert.equal(rec.startedAtMs, NOW);
  assert.equal(rec.placedBuildingFormId, null);
});

test('simulation start: guest without an account is rejected', () => {
  const res = startSimulatedLotRental({
    store: createEmptyLotRentalStore(),
    lotId: 'lot-n-02',
    accountId: '   ',
    nowMs: NOW,
  });
  assert.equal(res.ok, false);
});

test('simulation extend: adds a full term from the old expiry, renter only', () => {
  const started = startSimulatedLotRental({
    store: createEmptyLotRentalStore(),
    lotId: 'lot-n-07',
    accountId: 'alice.testnet',
    nowMs: NOW,
  });
  assert.equal(started.ok, true);
  if (!started.ok) return;

  const byStranger = extendSimulatedLotRental({
    store: started.store,
    lotId: 'lot-n-07',
    accountId: 'bob.testnet',
    nowMs: NOW + MS_PER_DAY,
  });
  assert.equal(byStranger.ok, false);

  const extended = extendSimulatedLotRental({
    store: started.store,
    lotId: 'lot-n-07',
    accountId: 'alice.testnet',
    nowMs: NOW + MS_PER_DAY,
  });
  assert.equal(extended.ok, true);
  if (!extended.ok) return;
  // From-expiry rule: 30d original term + 30d extension, NOT now + 30d.
  assert.equal(
    extended.store.rentalsByLotId['lot-n-07'].expiresAtMs,
    NOW + 60 * MS_PER_DAY,
  );

  // Extending inside the grace window is allowed and also counts from expiry.
  const graceExtend = extendSimulatedLotRental({
    store: started.store,
    lotId: 'lot-n-07',
    accountId: 'alice.testnet',
    nowMs: NOW + 31 * MS_PER_DAY,
  });
  assert.equal(graceExtend.ok, true);
});

test('simulation extend: rejected once past grace and on lots with no rental', () => {
  const stale: LotRentalRecord = {
    lotId: 'lot-s-01',
    renterAccountId: 'alice.testnet',
    lockedRentRespite: 0,
    termDays: 30,
    gracePeriodDays: 3,
    startedAtMs: NOW - 40 * MS_PER_DAY,
    expiresAtMs: NOW - 10 * MS_PER_DAY,
    placedBuildingFormId: null,
    billboardLogoUrl: null,
  };
  const store = {
    ...createEmptyLotRentalStore(),
    rentalsByLotId: { 'lot-s-01': stale },
  };
  const pastGrace = extendSimulatedLotRental({
    store,
    lotId: 'lot-s-01',
    accountId: 'alice.testnet',
    nowMs: NOW,
  });
  assert.equal(pastGrace.ok, false);

  const noRental = extendSimulatedLotRental({
    store: createEmptyLotRentalStore(),
    lotId: 'lot-s-02',
    accountId: 'alice.testnet',
    nowMs: NOW,
  });
  assert.equal(noRental.ok, false);
});

test('simulation place building: free test build on own rented lot, record otherwise untouched', () => {
  const started = startSimulatedLotRental({
    store: createEmptyLotRentalStore(),
    lotId: 'lot-n-04',
    accountId: 'alice.testnet',
    nowMs: NOW,
  });
  assert.equal(started.ok, true);
  if (!started.ok) return;
  // Give the record a billboard logo first: placing must not disturb it.
  const withLogo = {
    ...started.store,
    rentalsByLotId: {
      ...started.store.rentalsByLotId,
      'lot-n-04': {
        ...started.store.rentalsByLotId['lot-n-04'],
        billboardLogoUrl: 'https://example.com/logo.png',
      },
    },
  };

  const placed = placeSimulatedBuildingOnLot({
    store: withLogo,
    lotId: 'lot-n-04',
    accountId: 'alice.testnet',
    buildingFormId: 'glass_corner_3story',
    nowMs: NOW + MS_PER_DAY,
  });
  assert.equal(placed.ok, true);
  if (!placed.ok) return;
  const rec = placed.store.rentalsByLotId['lot-n-04'];
  // No ownership was involved — the form lands purely from the simulation call.
  assert.equal(rec.placedBuildingFormId, 'glass_corner_3story');
  assert.equal(rec.billboardLogoUrl, 'https://example.com/logo.png');
  assert.equal(rec.startedAtMs, NOW);
  assert.equal(rec.expiresAtMs, NOW + 30 * MS_PER_DAY);
  assert.equal(rec.renterAccountId, 'alice.testnet');
  assert.equal(rec.lockedRentRespite, 0);

  // Placing inside the grace window is allowed too.
  const gracePlaced = placeSimulatedBuildingOnLot({
    store: started.store,
    lotId: 'lot-n-04',
    accountId: 'alice.testnet',
    buildingFormId: 'canopy_storefront_2story',
    nowMs: NOW + 31 * MS_PER_DAY,
  });
  assert.equal(gracePlaced.ok, true);
});

test('simulation place building: rejected for non-renter, unrented lot, bad form, and past-grace lease', () => {
  const started = startSimulatedLotRental({
    store: createEmptyLotRentalStore(),
    lotId: 'lot-s-05',
    accountId: 'alice.testnet',
    nowMs: NOW,
  });
  assert.equal(started.ok, true);
  if (!started.ok) return;

  const byStranger = placeSimulatedBuildingOnLot({
    store: started.store,
    lotId: 'lot-s-05',
    accountId: 'bob.testnet',
    buildingFormId: 'brick_rooftop_deck',
    nowMs: NOW,
  });
  assert.equal(byStranger.ok, false);

  const noRecord = placeSimulatedBuildingOnLot({
    store: createEmptyLotRentalStore(),
    lotId: 'lot-s-06',
    accountId: 'alice.testnet',
    buildingFormId: 'brick_rooftop_deck',
    nowMs: NOW,
  });
  assert.equal(noRecord.ok, false);

  const badForm = placeSimulatedBuildingOnLot({
    store: started.store,
    lotId: 'lot-s-05',
    accountId: 'alice.testnet',
    buildingFormId: 'castle_9story' as ShopBuildingFormId,
    nowMs: NOW,
  });
  assert.equal(badForm.ok, false);

  // Expiry + 10 days with a 3-day grace => 'freeing', placement closed.
  const pastGrace = placeSimulatedBuildingOnLot({
    store: started.store,
    lotId: 'lot-s-05',
    accountId: 'alice.testnet',
    buildingFormId: 'brick_rooftop_deck',
    nowMs: NOW + 40 * MS_PER_DAY,
  });
  assert.equal(pastGrace.ok, false);
});

test('simulation remove building: clears form and logo, renter only, needs a placed building', () => {
  const withBuilding: LotRentalRecord = {
    lotId: 'lot-n-06',
    renterAccountId: 'alice.testnet',
    lockedRentRespite: 0,
    termDays: 30,
    gracePeriodDays: 3,
    startedAtMs: NOW,
    expiresAtMs: NOW + 30 * MS_PER_DAY,
    placedBuildingFormId: 'brick_rooftop_deck',
    billboardLogoUrl: 'https://example.com/logo.png',
  };
  const store = {
    ...createEmptyLotRentalStore(),
    rentalsByLotId: { 'lot-n-06': withBuilding },
  };

  const byStranger = removeSimulatedBuildingFromLot({
    store,
    lotId: 'lot-n-06',
    accountId: 'bob.testnet',
  });
  assert.equal(byStranger.ok, false);

  const removed = removeSimulatedBuildingFromLot({
    store,
    lotId: 'lot-n-06',
    accountId: 'alice.testnet',
  });
  assert.equal(removed.ok, true);
  if (!removed.ok) return;
  assert.equal(removed.removedFormId, 'brick_rooftop_deck');
  const rec = removed.store.rentalsByLotId['lot-n-06'];
  assert.equal(rec.placedBuildingFormId, null);
  assert.equal(rec.billboardLogoUrl, null);
  // The rental itself survives the removal.
  assert.equal(rec.expiresAtMs, NOW + 30 * MS_PER_DAY);

  const removeAgain = removeSimulatedBuildingFromLot({
    store: removed.store,
    lotId: 'lot-n-06',
    accountId: 'alice.testnet',
  });
  assert.equal(removeAgain.ok, false);

  const noRecord = removeSimulatedBuildingFromLot({
    store: createEmptyLotRentalStore(),
    lotId: 'lot-n-08',
    accountId: 'alice.testnet',
  });
  assert.equal(noRecord.ok, false);
});

test('simulation end: removes the record, renter only', () => {
  const started = startSimulatedLotRental({
    store: createEmptyLotRentalStore(),
    lotId: 'lot-s-08',
    accountId: 'alice.testnet',
    nowMs: NOW,
  });
  assert.equal(started.ok, true);
  if (!started.ok) return;

  const byStranger = endSimulatedLotRental({
    store: started.store,
    lotId: 'lot-s-08',
    accountId: 'bob.testnet',
  });
  assert.equal(byStranger.ok, false);
  assert.ok(started.store.rentalsByLotId['lot-s-08']);

  const ended = endSimulatedLotRental({
    store: started.store,
    lotId: 'lot-s-08',
    accountId: 'alice.testnet',
  });
  assert.equal(ended.ok, true);
  if (!ended.ok) return;
  assert.equal(ended.store.rentalsByLotId['lot-s-08'], undefined);

  const endAgain = endSimulatedLotRental({
    store: ended.store,
    lotId: 'lot-s-08',
    accountId: 'alice.testnet',
  });
  assert.equal(endAgain.ok, false);
});
