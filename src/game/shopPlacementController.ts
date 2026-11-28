import {
  SHOP_BUILDING_FORMS,
  type ShopBuildingFormId,
} from './buddiesCityRentalLotsRules';
import {
  resolveLotLifecycleStatus,
  type LotRentalStore,
} from './shopRentalEngine';

/**
 * ============================================================================
 * PHASE 2 — SHOP BUILDING PLACEMENT & BILLBOARD LOGO FLOW
 * ============================================================================
 * Pure, testable controller for:
 * - Placing an owned shop building from My Things onto the player's active rented lot
 * - Removing a placed building back to the owner's My Things inventory
 * - Uploading a custom shop logo to the owner's placed building billboard ONLY
 * - Super-admin moderation: blanking an abusive logo back to neutral blank
 */

export const SHOP_LOT_PLACEMENT_SYNC_EVENT = 'shop-lot-placement-state-sync';

export interface ShopLotPlacementSyncPayload {
  rentedSlotIds: string[];
  lotStatusBySlotId: Record<string, 'available' | 'rented' | 'grace' | 'freeing'>;
  placedBuildingBySlotId: Record<string, ShopBuildingFormId | null>;
  billboardLogoUrlBySlotId: Record<string, string | null>;
  selectedSlotId?: string | null;
  previewFormBySlotId?: Record<string, ShopBuildingFormId | null>;
}

export function buildShopLotPlacementSyncPayload(
  store: LotRentalStore,
  nowMs: number = Date.now(),
  selectedSlotId: string | null = null,
  previewFormBySlotId?: Record<string, ShopBuildingFormId | null>,
): ShopLotPlacementSyncPayload {
  const rentedSlotIds: string[] = [];
  const lotStatusBySlotId: Record<string, 'available' | 'rented' | 'grace' | 'freeing'> = {};
  const placedBuildingBySlotId: Record<string, ShopBuildingFormId | null> = {};
  const billboardLogoUrlBySlotId: Record<string, string | null> = {};

  for (const [lotId, rec] of Object.entries(store.rentalsByLotId)) {
    const st = resolveLotLifecycleStatus(rec, nowMs);
    lotStatusBySlotId[lotId] = st;
    if (st === 'rented' || st === 'grace') {
      rentedSlotIds.push(lotId);
      placedBuildingBySlotId[lotId] = rec.placedBuildingFormId;
      billboardLogoUrlBySlotId[lotId] = rec.billboardLogoUrl;
    }
  }

  return {
    rentedSlotIds,
    lotStatusBySlotId,
    placedBuildingBySlotId,
    billboardLogoUrlBySlotId,
    selectedSlotId,
    previewFormBySlotId,
  };
}

export function placeBuildingFromMyThingsOnLot(params: {
  store: LotRentalStore;
  lotId: string;
  accountId: string;
  buildingFormId: ShopBuildingFormId;
  ownedCatalogItemIds: readonly string[];
  nowMs?: number;
}): { ok: true; store: LotRentalStore } | { ok: false; error: string } {
  const nowMs = params.nowMs ?? Date.now();
  const rec = params.store.rentalsByLotId[params.lotId];
  if (!rec) {
    return { ok: false, error: 'You must rent this lot before placing a building.' };
  }
  if (rec.renterAccountId.trim().toLowerCase() !== params.accountId.trim().toLowerCase()) {
    return { ok: false, error: 'Only the active lot renter can place a building here.' };
  }
  const status = resolveLotLifecycleStatus(rec, nowMs);
  if (status !== 'rented' && status !== 'grace') {
    return { ok: false, error: 'This lot lease has expired.' };
  }

  const formSpec = SHOP_BUILDING_FORMS[params.buildingFormId];
  if (!formSpec || !params.ownedCatalogItemIds.includes(formSpec.catalogItemId)) {
    return { ok: false, error: 'You do not own this building in My Things.' };
  }

  return {
    ok: true,
    store: {
      ...params.store,
      rentalsByLotId: {
        ...params.store.rentalsByLotId,
        [params.lotId]: {
          ...rec,
          placedBuildingFormId: params.buildingFormId,
        },
      },
    },
  };
}

export function removeBuildingFromLotToInventory(params: {
  store: LotRentalStore;
  lotId: string;
  accountId: string;
}):
  | { ok: true; store: LotRentalStore; removedFormId: ShopBuildingFormId }
  | { ok: false; error: string } {
  const rec = params.store.rentalsByLotId[params.lotId];
  if (!rec) {
    return { ok: false, error: 'Lot has no active rental.' };
  }
  if (rec.renterAccountId.trim().toLowerCase() !== params.accountId.trim().toLowerCase()) {
    return { ok: false, error: 'Only the lot owner can remove this building.' };
  }
  if (!rec.placedBuildingFormId) {
    return { ok: false, error: 'No building is currently placed on this lot.' };
  }

  const removedFormId = rec.placedBuildingFormId;
  return {
    ok: true,
    removedFormId,
    store: {
      ...params.store,
      rentalsByLotId: {
        ...params.store.rentalsByLotId,
        [params.lotId]: {
          ...rec,
          placedBuildingFormId: null,
          billboardLogoUrl: null,
        },
      },
    },
  };
}

/**
 * Sets or blanks the rooftop billboard logo on a placed building:
 * - Owning renter may upload a valid logo URL / data URL (applied ONLY to their placed building).
 * - Super admin may blank an abusive logo (`logoUrl: null`) on any lot.
 */
export function setPlacedBuildingBillboardLogo(params: {
  store: LotRentalStore;
  lotId: string;
  actorAccountId: string;
  logoUrl: string | null;
  superAdminWallet?: string | null;
}): { ok: true; store: LotRentalStore } | { ok: false; error: string } {
  const rec = params.store.rentalsByLotId[params.lotId];
  if (!rec || !rec.placedBuildingFormId) {
    return { ok: false, error: 'No placed building on this lot.' };
  }

  const actor = params.actorAccountId.trim().toLowerCase();
  const owner = rec.renterAccountId.trim().toLowerCase();
  const admin = (params.superAdminWallet || '').trim().toLowerCase();
  const isOwner = Boolean(actor) && actor === owner;
  const isSuperAdmin = Boolean(actor) && Boolean(admin) && actor === admin;

  if (params.logoUrl === null) {
    if (!isOwner && !isSuperAdmin) {
      return { ok: false, error: 'Unauthorized to blank this billboard logo.' };
    }
    return {
      ok: true,
      store: {
        ...params.store,
        rentalsByLotId: {
          ...params.store.rentalsByLotId,
          [params.lotId]: {
            ...rec,
            billboardLogoUrl: null,
          },
        },
      },
    };
  }

  if (!isOwner) {
    return { ok: false, error: 'Only the building owner can upload a billboard logo.' };
  }

  const cleanUrl = params.logoUrl.trim();
  const isValidImageUrl =
    cleanUrl.startsWith('data:image/') ||
    cleanUrl.startsWith('https://') ||
    cleanUrl.startsWith('/assets/');
  if (!isValidImageUrl) {
    return { ok: false, error: 'Invalid logo image URL.' };
  }

  return {
    ok: true,
    store: {
      ...params.store,
      rentalsByLotId: {
        ...params.store.rentalsByLotId,
        [params.lotId]: {
          ...rec,
          billboardLogoUrl: cleanUrl,
        },
      },
    },
  };
}
