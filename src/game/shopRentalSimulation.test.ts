import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyLotRentalStore, MS_PER_DAY, type LotRentalRecord } from './shopRentalEngine';
import {
  endSimulatedLotRental,
  extendSimulatedLotRental,
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
