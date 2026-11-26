import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  createEmptyLotRentalStore,
  signRentPriceQuote,
  startLotRentalWithQuote,
} from './shopRentalEngine';
import {
  buildShopLotPlacementSyncPayload,
  placeBuildingFromMyThingsOnLot,
  removeBuildingFromLotToInventory,
  setPlacedBuildingBillboardLogo,
} from './shopPlacementController';

test('Phase 2 placement & billboard flow: place owned building, upload owner-only logo, super-admin blank, remove back to inventory', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const nowMs = Date.UTC(2026, 10, 26, 12, 0, 0);

  const q = signRentPriceQuote(
    {
      lotId: 'lot-n-01',
      accountId: 'alice.testnet',
      amountRespite: 50,
      termDays: 30,
      expiresAtMs: nowMs + 300_000,
    },
    privateKey,
  );
  const rented = startLotRentalWithQuote({
    store: createEmptyLotRentalStore(),
    quote: q,
    paidAmountRespite: 50,
    publicKey,
    nowMs,
  });
  assert.equal(rented.ok, true);
  if (!rented.ok) return;
  let store = rented.store;

  // Cannot place if player does not own the building
  const unowned = placeBuildingFromMyThingsOnLot({
    store,
    lotId: 'lot-n-01',
    accountId: 'alice.testnet',
    buildingFormId: 'brick_rooftop_deck',
    ownedCatalogItemIds: [],
    nowMs,
  });
  assert.equal(unowned.ok, false);

  // Place owned building on active rented lot
  const placed = placeBuildingFromMyThingsOnLot({
    store,
    lotId: 'lot-n-01',
    accountId: 'alice.testnet',
    buildingFormId: 'brick_rooftop_deck',
    ownedCatalogItemIds: ['shop_brick_rooftop_deck'],
    nowMs,
  });
  assert.equal(placed.ok, true);
  if (!placed.ok) return;
  store = placed.store;

  // Another player cannot upload a logo to Alice's building
  const bobLogo = setPlacedBuildingBillboardLogo({
    store,
    lotId: 'lot-n-01',
    actorAccountId: 'bob.testnet',
    logoUrl: 'data:image/png;base64,iVBORw0KGgo=',
    superAdminWallet: 'admin.testnet',
  });
  assert.equal(bobLogo.ok, false);

  // Alice uploads her shop logo -> applied ONLY to lot-n-01
  const aliceLogo = setPlacedBuildingBillboardLogo({
    store,
    lotId: 'lot-n-01',
    actorAccountId: 'alice.testnet',
    logoUrl: 'data:image/png;base64,iVBORw0KGgo=',
    superAdminWallet: 'admin.testnet',
  });
  assert.equal(aliceLogo.ok, true);
  if (!aliceLogo.ok) return;
  store = aliceLogo.store;

  const syncWithLogo = buildShopLotPlacementSyncPayload(store, nowMs);
  assert.equal(syncWithLogo.placedBuildingBySlotId['lot-n-01'], 'brick_rooftop_deck');
  assert.equal(
    syncWithLogo.billboardLogoUrlBySlotId['lot-n-01'],
    'data:image/png;base64,iVBORw0KGgo=',
  );

  // Super admin blanks an abusive logo
  const adminBlank = setPlacedBuildingBillboardLogo({
    store,
    lotId: 'lot-n-01',
    actorAccountId: 'admin.testnet',
    logoUrl: null,
    superAdminWallet: 'admin.testnet',
  });
  assert.equal(adminBlank.ok, true);
  if (!adminBlank.ok) return;
  store = adminBlank.store;
  assert.equal(store.rentalsByLotId['lot-n-01'].billboardLogoUrl, null);

  // Remove building back to My Things inventory
  const removed = removeBuildingFromLotToInventory({
    store,
    lotId: 'lot-n-01',
    accountId: 'alice.testnet',
  });
  assert.equal(removed.ok, true);
  if (!removed.ok) return;
  assert.equal(removed.removedFormId, 'brick_rooftop_deck');
  assert.equal(removed.store.rentalsByLotId['lot-n-01'].placedBuildingFormId, null);
});
