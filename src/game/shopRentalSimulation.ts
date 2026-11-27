import { DEFAULT_COMMERCIAL_CONFIG } from './buddiesCityRentalLotsRules';
import {
  MS_PER_DAY,
  resolveLotLifecycleStatus,
  type LotRentalRecord,
  type LotRentalStore,
} from './shopRentalEngine';

/**
 * ============================================================================
 * SHOP LOT RENTAL — SIMULATION ADAPTER (QC build, no payment)
 * ============================================================================
 * Browser-safe counterpart of the signed-quote engine in shopRentalEngine.ts.
 * The production flow starts/extends rentals only against a server-signed
 * Ed25519 price quote (verified with node:crypto, a server-side concern).
 * For quality-control testing the owner asked for the rental front door to
 * work as a pure simulation: identical LotRentalRecord shape and lifecycle
 * semantics as the engine, but no quote and no charge — every simulated
 * rental locks `lockedRentRespite: 0` and uses the shared commercial config
 * for term / grace durations.
 */

function sameAccount(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  return Boolean(left) && Boolean(right) && left === right;
}

/**
 * Starts a free simulated rental on an available lot.
 * Mirrors `startLotRentalWithQuote`: fails while any non-'freeing' record
 * exists; a 'freeing' (past-grace) record is replaced by the new rental.
 */
export function startSimulatedLotRental(params: {
  store: LotRentalStore;
  lotId: string;
  accountId: string;
  nowMs?: number;
}): { ok: true; store: LotRentalStore; record: LotRentalRecord } | { ok: false; error: string } {
  const nowMs = params.nowMs ?? Date.now();
  const accountId = params.accountId.trim();
  if (!accountId) {
    return { ok: false, error: 'Sign in to rent a lot.' };
  }

  const existing = params.store.rentalsByLotId[params.lotId];
  const existingStatus = resolveLotLifecycleStatus(existing, nowMs);
  if (existing && existingStatus !== 'freeing') {
    return { ok: false, error: 'Lot is already rented.' };
  }

  const cfg = DEFAULT_COMMERCIAL_CONFIG;
  const record: LotRentalRecord = {
    lotId: params.lotId,
    renterAccountId: accountId,
    lockedRentRespite: 0,
    termDays: cfg.rentTermDays,
    gracePeriodDays: cfg.gracePeriodDays,
    startedAtMs: nowMs,
    expiresAtMs: nowMs + cfg.rentTermDays * MS_PER_DAY,
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
 * Extends a simulated rental by one full term, counted from the current
 * expiry (never truncating remaining time — same rule as the engine).
 * Only the renter may extend, and only while 'rented' or in 'grace'.
 */
export function extendSimulatedLotRental(params: {
  store: LotRentalStore;
  lotId: string;
  accountId: string;
  nowMs?: number;
}): { ok: true; store: LotRentalStore; record: LotRentalRecord } | { ok: false; error: string } {
  const nowMs = params.nowMs ?? Date.now();
  const existing = params.store.rentalsByLotId[params.lotId];
  if (!existing) {
    return { ok: false, error: 'Lot has no active rental to extend.' };
  }
  if (!sameAccount(existing.renterAccountId, params.accountId)) {
    return { ok: false, error: 'Only the active renter can extend this lot.' };
  }
  const status = resolveLotLifecycleStatus(existing, nowMs);
  if (status !== 'rented' && status !== 'grace') {
    return { ok: false, error: 'Lease has expired past grace period.' };
  }

  const updated: LotRentalRecord = {
    ...existing,
    expiresAtMs: existing.expiresAtMs + existing.termDays * MS_PER_DAY,
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
 * Ends a simulated rental immediately. Only the renter may end it.
 * The record is removed entirely; any placed building is freed with it
 * because placement state derives from rental records.
 */
export function endSimulatedLotRental(params: {
  store: LotRentalStore;
  lotId: string;
  accountId: string;
}): { ok: true; store: LotRentalStore } | { ok: false; error: string } {
  const existing = params.store.rentalsByLotId[params.lotId];
  if (!existing) {
    return { ok: false, error: 'Lot has no active rental.' };
  }
  if (!sameAccount(existing.renterAccountId, params.accountId)) {
    return { ok: false, error: 'Only the active renter can end this rental.' };
  }

  const nextRentals = { ...params.store.rentalsByLotId };
  delete nextRentals[params.lotId];

  return {
    ok: true,
    store: {
      ...params.store,
      rentalsByLotId: nextRentals,
    },
  };
}
