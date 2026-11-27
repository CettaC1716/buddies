import crypto from 'node:crypto';
import {
  DEFAULT_COMMERCIAL_CONFIG,
  type CityRentalLotStatus,
  type CommercialSystemConfig,
  type ShopBuildingFormId,
} from './buddiesCityRentalLotsRules';
import { MS_PER_DAY } from '../lib/cerriaBrand';

export { MS_PER_DAY };

/**
 * ============================================================================
 * L1 — SHOP LOT RENTAL LIFECYCLE & SIGNED PRICE QUOTE VERIFICATION ENGINE
 * ============================================================================
 * - Dynamic rent pricing via server-signed Ed25519 price quotes (mirrors the
 *   v1.4.0 fish-mint attestation pattern): binds lot + account + amount + term + expiry.
 * - Golden rule: a price change ONLY affects NEW rentals; active rentals lock
 *   their paid rate for the entire term.
 * - Lot states: 'available' | 'rented' | 'grace' | 'freeing'
 * - Extension is always counted from current expiry (never truncating remaining days).
 * - Expiry past grace frees the lot and returns any placed building to the owner's My Things.
 */

export interface SignedRentPriceQuote {
  lotId: string;
  accountId: string;
  amountRespite: number;
  termDays: number;
  expiresAtMs: number;
  signatureHex: string;
  /** Optional public key (PEM or raw hex) for verification */
  signerPublicKeyHex?: string;
}

export interface LotRentalRecord {
  lotId: string;
  renterAccountId: string;
  /** Locked RESPITE rate paid for this active term (unaffected by later config price changes). */
  lockedRentRespite: number;
  termDays: number;
  gracePeriodDays: number;
  startedAtMs: number;
  expiresAtMs: number;
  /** Placed building form on this lot (null if rented but empty). */
  placedBuildingFormId: ShopBuildingFormId | null;
  /** Optional shop billboard logo URL uploaded by the owning player (null = neutral blank). */
  billboardLogoUrl: string | null;
}

export interface LotRentalStore {
  version: 1;
  rentalsByLotId: Record<string, LotRentalRecord>;
  /** Buildings returned to an owner's My Things when a lease expired past grace. */
  returnedToMyThings: Array<{
    accountId: string;
    lotId: string;
    buildingFormId: ShopBuildingFormId;
    returnedAtMs: number;
  }>;
}

export function createEmptyLotRentalStore(): LotRentalStore {
  return {
    version: 1,
    rentalsByLotId: {},
    returnedToMyThings: [],
  };
}

/**
 * Canonical signing payload — MUST stay byte-identical with:
 * - `api/shop-rent-quote.ts`
 * - `contracts/buddies-market/src/lib.rs` (`lot_rent_quote_message`)
 */
export function buildRentQuoteCanonicalMessage(params: {
  lotId: string;
  accountId: string;
  amountRespite: number;
  termDays: number;
  expiresAtMs: number;
}): string {
  return [
    'buddies-lot-rent-v1',
    params.lotId.trim(),
    params.accountId.trim(),
    String(Math.floor(params.amountRespite)),
    String(Math.floor(params.termDays)),
    String(Math.floor(params.expiresAtMs)),
  ].join('|');
}

export function signRentPriceQuote(
  params: {
    lotId: string;
    accountId: string;
    amountRespite: number;
    termDays: number;
    expiresAtMs: number;
  },
  privateKey: crypto.KeyObject,
): SignedRentPriceQuote {
  const msg = buildRentQuoteCanonicalMessage(params);
  const sig = crypto.sign(null, Buffer.from(msg, 'utf8'), privateKey);
  return {
    ...params,
    signatureHex: Buffer.from(sig).toString('hex'),
  };
}

export type QuoteVerificationError =
  | 'expired_quote'
  | 'lot_mismatch'
  | 'account_mismatch'
  | 'amount_mismatch'
  | 'invalid_signature';

export function verifyRentPriceQuote(params: {
  quote: SignedRentPriceQuote;
  expectedLotId: string;
  expectedAccountId: string;
  paidAmountRespite: number;
  publicKey: crypto.KeyObject;
  nowMs?: number;
}): { ok: true } | { ok: false; reason: QuoteVerificationError } {
  const { quote, expectedLotId, expectedAccountId, paidAmountRespite, publicKey } = params;
  const nowMs = params.nowMs ?? Date.now();

  if (nowMs > quote.expiresAtMs) {
    return { ok: false, reason: 'expired_quote' };
  }
  if (quote.lotId.trim() !== expectedLotId.trim()) {
    return { ok: false, reason: 'lot_mismatch' };
  }
  if (quote.accountId.trim() !== expectedAccountId.trim()) {
    return { ok: false, reason: 'account_mismatch' };
  }
  if (Math.floor(paidAmountRespite) !== Math.floor(quote.amountRespite)) {
    return { ok: false, reason: 'amount_mismatch' };
  }

  let sigBytes: Buffer;
  try {
    sigBytes = Buffer.from(quote.signatureHex, 'hex');
    if (sigBytes.length !== 64) {
      return { ok: false, reason: 'invalid_signature' };
    }
  } catch {
    return { ok: false, reason: 'invalid_signature' };
  }

  const msg = buildRentQuoteCanonicalMessage(quote);
  const verified = crypto.verify(null, Buffer.from(msg, 'utf8'), publicKey, sigBytes);
  if (!verified) {
    return { ok: false, reason: 'invalid_signature' };
  }
  return { ok: true };
}

/**
 * Computes the live lifecycle state of a lot at `nowMs`:
 * - no record -> 'available'
 * - nowMs <= expiresAtMs -> 'rented'
 * - expiresAtMs < nowMs <= expiresAtMs + gracePeriodDays -> 'grace'
 * - nowMs > expiresAtMs + gracePeriodDays -> 'freeing' (ready to free & return building)
 */
export function resolveLotLifecycleStatus(
  record: LotRentalRecord | null | undefined,
  nowMs: number = Date.now(),
): CityRentalLotStatus {
  if (!record) return 'available';
  if (nowMs <= record.expiresAtMs) return 'rented';
  const graceEndMs = record.expiresAtMs + record.gracePeriodDays * MS_PER_DAY;
  if (nowMs <= graceEndMs) return 'grace';
  return 'freeing';
}

/**
 * Starts a new rental on an available lot using a verified signed price quote.
 */
export function startLotRentalWithQuote(params: {
  store: LotRentalStore;
  quote: SignedRentPriceQuote;
  paidAmountRespite: number;
  publicKey: crypto.KeyObject;
  config?: CommercialSystemConfig;
  nowMs?: number;
}): { ok: true; store: LotRentalStore; record: LotRentalRecord } | { ok: false; error: string } {
  const nowMs = params.nowMs ?? Date.now();
  const cfg = params.config ?? DEFAULT_COMMERCIAL_CONFIG;

  const existing = params.store.rentalsByLotId[params.quote.lotId];
  const existingStatus = resolveLotLifecycleStatus(existing, nowMs);
  if (existing && existingStatus !== 'freeing') {
    return { ok: false, error: 'Lot is already rented.' };
  }

  const check = verifyRentPriceQuote({
    quote: params.quote,
    expectedLotId: params.quote.lotId,
    expectedAccountId: params.quote.accountId,
    paidAmountRespite: params.paidAmountRespite,
    publicKey: params.publicKey,
    nowMs,
  });
  if (!check.ok) {
    return { ok: false, error: check.reason };
  }

  const record: LotRentalRecord = {
    lotId: params.quote.lotId,
    renterAccountId: params.quote.accountId,
    lockedRentRespite: params.quote.amountRespite,
    termDays: params.quote.termDays,
    gracePeriodDays: cfg.gracePeriodDays,
    startedAtMs: nowMs,
    expiresAtMs: nowMs + params.quote.termDays * MS_PER_DAY,
    placedBuildingFormId: null,
    billboardLogoUrl: null,
  };

  return {
    ok: true,
    record,
    store: {
      ...params.store,
      rentalsByLotId: {
        ...params.store.rentalsByLotId,
        [record.lotId]: record,
      },
    },
  };
}

/**
 * Extends an active or grace-period rental using a verified signed quote.
 * Extension is ALWAYS counted from current `expiresAtMs` (never truncating remaining time).
 */
export function extendLotRentalWithQuote(params: {
  store: LotRentalStore;
  quote: SignedRentPriceQuote;
  paidAmountRespite: number;
  publicKey: crypto.KeyObject;
  nowMs?: number;
}): { ok: true; store: LotRentalStore; record: LotRentalRecord } | { ok: false; error: string } {
  const nowMs = params.nowMs ?? Date.now();
  const existing = params.store.rentalsByLotId[params.quote.lotId];
  if (!existing) {
    return { ok: false, error: 'Lot has no active rental to extend.' };
  }
  const status = resolveLotLifecycleStatus(existing, nowMs);
  if (status === 'freeing') {
    return { ok: false, error: 'Lease has expired past grace period.' };
  }
  if (existing.renterAccountId !== params.quote.accountId) {
    return { ok: false, error: 'Only the active renter can extend this lot.' };
  }

  const check = verifyRentPriceQuote({
    quote: params.quote,
    expectedLotId: existing.lotId,
    expectedAccountId: existing.renterAccountId,
    paidAmountRespite: params.paidAmountRespite,
    publicKey: params.publicKey,
    nowMs,
  });
  if (!check.ok) {
    return { ok: false, error: check.reason };
  }

  const updated: LotRentalRecord = {
    ...existing,
    expiresAtMs: existing.expiresAtMs + params.quote.termDays * MS_PER_DAY,
  };

  return {
    ok: true,
    record: updated,
    store: {
      ...params.store,
      rentalsByLotId: {
        ...params.store.rentalsByLotId,
        [updated.lotId]: updated,
      },
    },
  };
}

/**
 * Sweeps any leases past their grace period (`status === 'freeing'`), freeing the lot
 * back to `'available'` and returning any placed building to the owner's My Things.
 */
export function sweepExpiredLotRentals(
  store: LotRentalStore,
  nowMs: number = Date.now(),
): {
  store: LotRentalStore;
  freedLotIds: string[];
  returnedBuildings: Array<{ accountId: string; lotId: string; buildingFormId: ShopBuildingFormId }>;
} {
  const nextRentals: Record<string, LotRentalRecord> = {};
  const freedLotIds: string[] = [];
  const returnedBuildings: Array<{
    accountId: string;
    lotId: string;
    buildingFormId: ShopBuildingFormId;
  }> = [];
  const nextReturnedLog = [...store.returnedToMyThings];

  for (const [lotId, rec] of Object.entries(store.rentalsByLotId)) {
    const status = resolveLotLifecycleStatus(rec, nowMs);
    if (status === 'freeing') {
      freedLotIds.push(lotId);
      if (rec.placedBuildingFormId) {
        returnedBuildings.push({
          accountId: rec.renterAccountId,
          lotId,
          buildingFormId: rec.placedBuildingFormId,
        });
        nextReturnedLog.push({
          accountId: rec.renterAccountId,
          lotId,
          buildingFormId: rec.placedBuildingFormId,
          returnedAtMs: nowMs,
        });
      }
    } else {
      nextRentals[lotId] = rec;
    }
  }

  return {
    freedLotIds,
    returnedBuildings,
    store: {
      version: 1,
      rentalsByLotId: nextRentals,
      returnedToMyThings: nextReturnedLog,
    },
  };
}

/**
 * Super-admin commercial config update — bound to the configured super-admin wallet.
 * Golden rule: updating `rentPriceRespite` NEVER mutates any existing `LotRentalRecord.lockedRentRespite`.
 */
export function updateCommercialConfigAsAdmin(params: {
  currentConfig: CommercialSystemConfig;
  actorWallet: string;
  superAdminWallet: string;
  patch: Partial<
    Pick<
      CommercialSystemConfig,
      'rentPriceRespite' | 'rentTermDays' | 'gracePeriodDays' | 'quoteExpirySeconds' | 'buildingPricesRespite'
    >
  >;
  nowIso?: string;
}): { ok: true; config: CommercialSystemConfig } | { ok: false; error: string } {
  const actor = params.actorWallet.trim().toLowerCase();
  const admin = params.superAdminWallet.trim().toLowerCase();
  if (!actor || !admin || actor !== admin) {
    return { ok: false, error: 'Unauthorized: super-admin wallet required.' };
  }

  const nextRent = params.patch.rentPriceRespite ?? params.currentConfig.rentPriceRespite;
  const nextTerm = params.patch.rentTermDays ?? params.currentConfig.rentTermDays;
  const nextGrace = params.patch.gracePeriodDays ?? params.currentConfig.gracePeriodDays;
  const nextQuoteExp = params.patch.quoteExpirySeconds ?? params.currentConfig.quoteExpirySeconds;

  if (!Number.isFinite(nextRent) || nextRent <= 0) {
    return { ok: false, error: 'Invalid rent price.' };
  }
  if (!Number.isFinite(nextTerm) || nextTerm < 1) {
    return { ok: false, error: 'Invalid rent term days.' };
  }
  if (!Number.isFinite(nextGrace) || nextGrace < 0) {
    return { ok: false, error: 'Invalid grace period days.' };
  }

  return {
    ok: true,
    config: {
      ...params.currentConfig,
      rentPriceRespite: Math.round(nextRent),
      rentTermDays: Math.round(nextTerm),
      gracePeriodDays: Math.round(nextGrace),
      quoteExpirySeconds: Math.max(30, Math.round(nextQuoteExp)),
      buildingPricesRespite: {
        ...params.currentConfig.buildingPricesRespite,
        ...(params.patch.buildingPricesRespite ?? {}),
      },
      extensionCountedFromExpiry: true,
      updatedAtIso: params.nowIso ?? new Date().toISOString(),
      updatedByWallet: actor,
    },
  };
}
