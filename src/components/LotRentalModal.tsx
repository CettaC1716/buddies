import React from 'react';
import { Building2, CalendarDays, MapPin, Store, X } from 'lucide-react';
import {
  CITY_RENTAL_LOTS,
  DEFAULT_COMMERCIAL_CONFIG,
  SHOP_BUILDING_FORMS,
} from '../game/buddiesCityRentalLotsRules';
import {
  MS_PER_DAY,
  resolveLotLifecycleStatus,
  type LotRentalStore,
} from '../game/shopRentalEngine';
import { soundEngine } from '../game/audio';

export interface LotRentalModalProps {
  open: boolean;
  lotId: string | null;
  store: LotRentalStore;
  /** Trimmed account id of the local player ('' when playing as a guest). */
  accountId: string;
  onClose: () => void;
  onRent: () => void;
  onExtend: () => void;
  onEnd: () => void;
  /** Places a free simulation building of the given form on this lot. */
  onPlaceBuilding: (formId: string) => void;
  /** Removes the building currently placed on this lot. */
  onRemoveBuilding: () => void;
  /**
   * True when the placed building's catalog item is owned by the account
   * (a real My Things building); false for a free simulation build, which
   * simply disappears when the rental ends instead of returning anywhere.
   */
  placedBuildingOwned: boolean;
}

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Shop lot rental front door — SIMULATION build for quality control.
 * Renting here is free: no RESPITE is charged and records live in the local
 * simulation store. The production flow will swap the button handlers to the
 * signed-quote engine without changing this panel's layout.
 */
export const LotRentalModal: React.FC<LotRentalModalProps> = ({
  open,
  lotId,
  store,
  accountId,
  onClose,
  onRent,
  onExtend,
  onEnd,
  onPlaceBuilding,
  onRemoveBuilding,
  placedBuildingOwned,
}) => {
  if (!open || !lotId) return null;
  const spec = CITY_RENTAL_LOTS.find((lot) => lot.slotId === lotId);
  if (!spec) return null;

  const record = store.rentalsByLotId[lotId] ?? null;
  const nowMs = Date.now();
  const lifecycle = resolveLotLifecycleStatus(record, nowMs);
  const isAvailable = !record || lifecycle === 'freeing';
  const isMine =
    Boolean(record) &&
    Boolean(accountId) &&
    record!.renterAccountId.trim().toLowerCase() === accountId.trim().toLowerCase();
  const isGrace = Boolean(record) && lifecycle === 'grace';
  const graceEndMs = record ? record.expiresAtMs + record.gracePeriodDays * MS_PER_DAY : 0;
  const placedForm =
    record?.placedBuildingFormId != null
      ? SHOP_BUILDING_FORMS[record.placedBuildingFormId]
      : null;

  const statusChip = isAvailable
    ? { label: 'Available', classes: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' }
    : isGrace
      ? { label: 'Grace period', classes: 'bg-amber-500/15 text-amber-300 border-amber-400/30' }
      : isMine
        ? { label: 'Rented by you', classes: 'bg-lime-500/15 text-lime-300 border-lime-400/30' }
        : {
            label: 'Rented by another player',
            classes: 'bg-rose-500/15 text-rose-300 border-rose-400/30',
          };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Shop lot ${spec.shortCode} rental`}
      data-lot-rental-modal="true"
      onClick={() => {
        soundEngine.playUiCancel();
        onClose();
      }}
      className="fixed inset-0 z-[210] flex items-center justify-center p-3 sm:p-5 bg-black/40 pointer-events-auto select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-slate-950/95 border border-white/12 shadow-2xl backdrop-blur-xl text-white overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-white/10 bg-white/[0.03]">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-extrabold tracking-wide">
                SHOP LOT {spec.shortCode}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest bg-amber-400 text-slate-950">
                SIMULATION
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusChip.classes}`}
              >
                {statusChip.label}
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/55">
              <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {spec.facingRoadLabel} · Commercial district
            </p>
          </div>
          <button
            type="button"
            aria-label="Close lot rental panel"
            data-lot-rental-close="true"
            onClick={() => {
              soundEngine.playUiCancel();
              onClose();
            }}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-xs font-semibold text-amber-300 bg-amber-400/10 border border-amber-300/25 rounded-lg px-3 py-2">
            Quality test build — renting is free, no RESPITE is charged.
          </p>

          {/* Status block */}
          {record && !isAvailable && (
            <div className="rounded-xl bg-white/[0.04] border border-white/10 px-3.5 py-3 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-white/85">
                <CalendarDays className="w-3.5 h-3.5 text-lime-300 shrink-0" aria-hidden="true" />
                <span className="text-white/50 w-20 shrink-0">Started</span>
                <span className="font-semibold">{formatDateTime(record.startedAtMs)}</span>
              </div>
              <div className="flex items-center gap-2 text-white/85">
                <CalendarDays className="w-3.5 h-3.5 text-lime-300 shrink-0" aria-hidden="true" />
                <span className="text-white/50 w-20 shrink-0">Expires</span>
                <span className="font-semibold">{formatDateTime(record.expiresAtMs)}</span>
              </div>
              {isGrace && (
                <div className="flex items-center gap-2 text-amber-200">
                  <CalendarDays className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span className="text-amber-200/60 w-20 shrink-0">Grace ends</span>
                  <span className="font-semibold">{formatDateTime(graceEndMs)}</span>
                </div>
              )}
              {!isMine && (
                <p className="pt-1 text-white/50">
                  This lot is rented by another player. It becomes available again after the
                  grace period ends.
                </p>
              )}
            </div>
          )}

          {/* Placed building note */}
          {placedForm && (
            <div className="rounded-xl bg-white/[0.04] border border-white/10 px-3.5 py-3 text-xs text-white/85">
              <div className="flex items-center gap-2 font-semibold">
                <Store className="w-3.5 h-3.5 text-lime-300 shrink-0" aria-hidden="true" />
                {placedForm.name}
              </div>
              <p className="mt-1 text-white/50">
                {placedBuildingOwned
                  ? 'A building is placed on this lot. Ending the rental returns it to My Things.'
                  : 'This is a simulation building — ending the rental removes it.'}
              </p>
            </div>
          )}

          {/* Build a shop — simulation (own active rental only) */}
          {record && isMine && !isAvailable && (
            <div className="rounded-xl bg-white/[0.04] border border-white/10 px-3.5 py-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-white/85">
                <Building2 className="w-3.5 h-3.5 text-lime-300 shrink-0" aria-hidden="true" />
                BUILD A SHOP — SIMULATION
              </div>
              {placedForm ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-white/70 min-w-0 truncate">
                    {placedForm.name}
                  </span>
                  <button
                    type="button"
                    data-lot-rental-remove-building="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      onRemoveBuilding();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/40 text-rose-200 text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    Remove building
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {Object.values(SHOP_BUILDING_FORMS).map((form) => (
                    <div key={form.id} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-white/70 min-w-0 truncate">{form.name}</span>
                      <button
                        type="button"
                        data-lot-rental-place-building={form.id}
                        onClick={() => {
                          soundEngine.playUiClick();
                          onPlaceBuilding(form.id);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-lime-500 hover:bg-lime-400 text-slate-950 text-xs font-extrabold transition-colors cursor-pointer shrink-0"
                      >
                        Place
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-white/45">
                Simulation buildings are free test builds — they are not added to My Things.
              </p>
            </div>
          )}

          {/* Terms block */}
          <div className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.04] border border-white/10 px-3.5 py-3 text-xs">
            <span className="text-white/70">
              Term{' '}
              <span className="font-bold text-white">{DEFAULT_COMMERCIAL_CONFIG.rentTermDays} days</span>
            </span>
            <span className="text-white/25" aria-hidden="true">
              ·
            </span>
            <span className="text-white/70">
              Grace period{' '}
              <span className="font-bold text-white">
                {DEFAULT_COMMERCIAL_CONFIG.gracePeriodDays} days
              </span>
            </span>
            <span className="text-white/25" aria-hidden="true">
              ·
            </span>
            <span className="text-white/70">
              Price: <span className="font-bold text-emerald-300">FREE (simulation)</span>
            </span>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            {isAvailable &&
              (accountId ? (
                <button
                  type="button"
                  data-lot-rental-rent="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onRent();
                  }}
                  className="w-full py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 text-sm font-extrabold transition-colors cursor-pointer"
                >
                  Rent this lot — free
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled
                    className="w-full py-2.5 rounded-xl bg-white/10 text-white/40 text-sm font-extrabold cursor-not-allowed"
                  >
                    Rent this lot — free
                  </button>
                  <p className="text-center text-xs text-white/50">Sign in to rent (simulation)</p>
                </>
              ))}

            {record && isMine && !isAvailable && (
              <>
                <button
                  type="button"
                  data-lot-rental-extend="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onExtend();
                  }}
                  className="w-full py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 text-sm font-extrabold transition-colors cursor-pointer"
                >
                  Extend +{record.termDays} days — free
                </button>
                <button
                  type="button"
                  data-lot-rental-end="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onEnd();
                  }}
                  className="w-full py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/40 text-rose-200 text-sm font-bold transition-colors cursor-pointer"
                >
                  End rental now
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
