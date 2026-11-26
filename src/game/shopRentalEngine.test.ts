import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { DEFAULT_COMMERCIAL_CONFIG } from './buddiesCityRentalLotsRules';
import {
  MS_PER_DAY,
  createEmptyLotRentalStore,
  extendLotRentalWithQuote,
  resolveLotLifecycleStatus,
  signRentPriceQuote,
  startLotRentalWithQuote,
  sweepExpiredLotRentals,
  updateCommercialConfigAsAdmin,
  verifyRentPriceQuote,
} from './shopRentalEngine';

test('L1 quote verification: valid Ed25519 quote passes; forged, expired, mismatched lot/account/amount fail', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const { privateKey: attackerKey } = crypto.generateKeyPairSync('ed25519');
  const nowMs = Date.UTC(2026, 10, 26, 12, 0, 0);

  const validQuote = signRentPriceQuote(
    {
      lotId: 'lot-n-01',
      accountId: 'alice.testnet',
      amountRespite: 50,
      termDays: 30,
      expiresAtMs: nowMs + 300_000,
    },
    privateKey,
  );

  // 1. Valid quote passes
  const ok = verifyRentPriceQuote({
    quote: validQuote,
    expectedLotId: 'lot-n-01',
    expectedAccountId: 'alice.testnet',
    paidAmountRespite: 50,
    publicKey,
    nowMs,
  });
  assert.equal(ok.ok, true);

  // 2. Expired quote fails
  const expired = verifyRentPriceQuote({
    quote: validQuote,
    expectedLotId: 'lot-n-01',
    expectedAccountId: 'alice.testnet',
    paidAmountRespite: 50,
    publicKey,
    nowMs: nowMs + 300_001,
  });
  assert.equal(expired.ok, false);
  if (!expired.ok) assert.equal(expired.reason, 'expired_quote');

  // 3. Mismatched lot fails
  const wrongLot = verifyRentPriceQuote({
    quote: validQuote,
    expectedLotId: 'lot-n-02',
    expectedAccountId: 'alice.testnet',
    paidAmountRespite: 50,
    publicKey,
    nowMs,
  });
  assert.equal(wrongLot.ok, false);
  if (!wrongLot.ok) assert.equal(wrongLot.reason, 'lot_mismatch');

  // 4. Mismatched account fails
  const wrongAcct = verifyRentPriceQuote({
    quote: validQuote,
    expectedLotId: 'lot-n-01',
    expectedAccountId: 'bob.testnet',
    paidAmountRespite: 50,
    publicKey,
    nowMs,
  });
  assert.equal(wrongAcct.ok, false);
  if (!wrongAcct.ok) assert.equal(wrongAcct.reason, 'account_mismatch');

  // 5. Mismatched paid amount fails
  const wrongAmount = verifyRentPriceQuote({
    quote: validQuote,
    expectedLotId: 'lot-n-01',
    expectedAccountId: 'alice.testnet',
    paidAmountRespite: 10,
    publicKey,
    nowMs,
  });
  assert.equal(wrongAmount.ok, false);
  if (!wrongAmount.ok) assert.equal(wrongAmount.reason, 'amount_mismatch');

  // 6. Forged signature (signed with attacker key) fails
  const forgedQuote = signRentPriceQuote(
    {
      lotId: 'lot-n-01',
      accountId: 'alice.testnet',
      amountRespite: 50,
      termDays: 30,
      expiresAtMs: nowMs + 300_000,
    },
    attackerKey,
  );
  const forged = verifyRentPriceQuote({
    quote: forgedQuote,
    expectedLotId: 'lot-n-01',
    expectedAccountId: 'alice.testnet',
    paidAmountRespite: 50,
    publicKey,
    nowMs,
  });
  assert.equal(forged.ok, false);
  if (!forged.ok) assert.equal(forged.reason, 'invalid_signature');
});

test('L1 lifecycle: available -> rented -> extend from expiry -> grace -> freeing -> available + building returned to My Things', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const t0 = Date.UTC(2026, 10, 26, 0, 0, 0);
  let store = createEmptyLotRentalStore();

  assert.equal(resolveLotLifecycleStatus(store.rentalsByLotId['lot-n-02'], t0), 'available');

  // Rent lot-n-02 for 30 days at 50 RESPITE
  const q1 = signRentPriceQuote(
    {
      lotId: 'lot-n-02',
      accountId: 'alice.testnet',
      amountRespite: 50,
      termDays: 30,
      expiresAtMs: t0 + 300_000,
    },
    privateKey,
  );
  const started = startLotRentalWithQuote({
    store,
    quote: q1,
    paidAmountRespite: 50,
    publicKey,
    nowMs: t0,
  });
  assert.equal(started.ok, true);
  if (!started.ok) return;
  store = started.store;
  assert.equal(resolveLotLifecycleStatus(store.rentalsByLotId['lot-n-02'], t0), 'rented');
  assert.equal(store.rentalsByLotId['lot-n-02'].lockedRentRespite, 50);

  // Place a building on the rented lot
  store.rentalsByLotId['lot-n-02'].placedBuildingFormId = 'glass_corner_3story';

  // Golden rule: super admin raises rent price to 75 RESPITE mid-term; active rental stays locked at 50!
  const adminUpd = updateCommercialConfigAsAdmin({
    currentConfig: DEFAULT_COMMERCIAL_CONFIG,
    actorWallet: 'admin.testnet',
    superAdminWallet: 'admin.testnet',
    patch: { rentPriceRespite: 75 },
  });
  assert.equal(adminUpd.ok, true);
  assert.equal(store.rentalsByLotId['lot-n-02'].lockedRentRespite, 50);

  // Non-admin config update must fail
  const nonAdmin = updateCommercialConfigAsAdmin({
    currentConfig: DEFAULT_COMMERCIAL_CONFIG,
    actorWallet: 'random.testnet',
    superAdminWallet: 'admin.testnet',
    patch: { rentPriceRespite: 1 },
  });
  assert.equal(nonAdmin.ok, false);

  // Extend at day 10 -> extension adds 30 days from original day-30 expiry (= day 60, never truncating remaining 20 days!)
  const tDay10 = t0 + 10 * MS_PER_DAY;
  const qExt = signRentPriceQuote(
    {
      lotId: 'lot-n-02',
      accountId: 'alice.testnet',
      amountRespite: 75,
      termDays: 30,
      expiresAtMs: tDay10 + 300_000,
    },
    privateKey,
  );
  const extended = extendLotRentalWithQuote({
    store,
    quote: qExt,
    paidAmountRespite: 75,
    publicKey,
    nowMs: tDay10,
  });
  assert.equal(extended.ok, true);
  if (!extended.ok) return;
  store = extended.store;
  assert.equal(store.rentalsByLotId['lot-n-02'].expiresAtMs, t0 + 60 * MS_PER_DAY);

  // Day 61 -> inside 3-day grace period
  assert.equal(
    resolveLotLifecycleStatus(store.rentalsByLotId['lot-n-02'], t0 + 61 * MS_PER_DAY),
    'grace',
  );

  // Day 64 -> past grace period ('freeing'); sweep frees lot & returns placed building to My Things
  const tDay64 = t0 + 64 * MS_PER_DAY;
  assert.equal(resolveLotLifecycleStatus(store.rentalsByLotId['lot-n-02'], tDay64), 'freeing');
  const swept = sweepExpiredLotRentals(store, tDay64);
  assert.deepEqual(swept.freedLotIds, ['lot-n-02']);
  assert.equal(swept.returnedBuildings.length, 1);
  assert.equal(swept.returnedBuildings[0].accountId, 'alice.testnet');
  assert.equal(swept.returnedBuildings[0].buildingFormId, 'glass_corner_3story');
  assert.equal(resolveLotLifecycleStatus(swept.store.rentalsByLotId['lot-n-02'], tDay64), 'available');
});
