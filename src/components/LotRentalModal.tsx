import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  Check,
  Hammer,
  MapPin,
  RefreshCw,
  ScanLine,
  Sparkles,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import {
  CITY_RENTAL_LOTS,
  DEFAULT_COMMERCIAL_CONFIG,
  SHOP_BUILDING_FORMS,
  type ShopBuildingFormId,
  type ShopBuildingFormSpec,
} from '../game/buddiesCityRentalLotsRules';
import {
  MS_PER_DAY,
  resolveLotLifecycleStatus,
  type LotRentalStore,
} from '../game/shopRentalEngine';
import {
  loadPersistedStorefrontCatalogMap,
  resolveLotStorefrontConfig,
  savePersistedStorefrontCatalogMap,
  type LotStorefrontConfig,
  type StorefrontCatalogMap,
  type StoreSaleReceipt,
} from '../game/shopStorefrontCatalogEngine';
import { ShopStorefrontTabletModal } from './ShopStorefrontTabletModal';
import { soundEngine } from '../game/audio';

export interface LotRentalModalProps {
  open: boolean;
  lotId: string | null;
  store: LotRentalStore;
  /** Trimmed account id of the local player ('' when playing as a guest). */
  accountId: string;
  /** Owned merchant / real-estate catalog item ids (e.g. shop_glass_corner_3story). */
  ownedMerchantItemIds: readonly string[];
  /** Connected wallet RESPITE balance for instant atomic settlement in the Storefront Tablet. */
  respiteBalance?: number;
  /** Currently previewed ShopBuildingFormId projected onto the 3D kiosk hologram. */
  previewBuildingFormId: ShopBuildingFormId | null;
  /** Updates the 3D kiosk hologram to reflect the chosen shop building form. */
  onPreviewBuildingForm: (formId: ShopBuildingFormId | null) => void;
  /** Opens the Real Estate Catalog directly on the Shops tab when player has no Shop NFTs. */
  onOpenShopCatalog?: () => void;
  onClose: () => void;
  onRent: () => void;
  onExtend: () => void;
  onEnd: () => void;
  /** Starts constructing the chosen shop building on this lot. */
  onPlaceBuilding: (formId: string) => void;
  /** Removes the building currently placed on this lot. */
  onRemoveBuilding: () => void;
  /** Updates the 3D rooftop billboard logo URL on the placed building. */
  onUpdateBillboardLogo?: (logoUrl: string | null) => void;
  /** Settles an atomic storefront purchase between buyer wallet and store owner wallet. */
  onSettleAtomicPurchase?: (params: {
    grossRespite: number;
    ownerSettledRespite: number;
    cityFeeRespite: number;
    isSelfOwnerPurchase: boolean;
    purchasedInventoryItemIds: string[];
  }) => void;
  /**
   * True when the placed building's catalog item is owned by the account
   * (a real My Things building); false for a free simulation build.
   */
  placedBuildingOwned: boolean;
}

function formatDateTimeShort(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ALL_SHOP_FORMS: readonly ShopBuildingFormSpec[] = Object.values(SHOP_BUILDING_FORMS);
const NFT_SCAN_DURATION_MS = 680;

/**
 * Commercial Lot Rental & Shop Blueprint Scanner panel (when lot is unbuilt),
 * and Landscape Editorial Tablet Storefront (when a shop building is placed on the lot).
 */
export const LotRentalModal: React.FC<LotRentalModalProps> = ({
  open,
  lotId,
  store,
  accountId,
  ownedMerchantItemIds,
  respiteBalance = 1250,
  previewBuildingFormId,
  onPreviewBuildingForm,
  onOpenShopCatalog,
  onClose,
  onRent,
  onExtend,
  onEnd,
  onPlaceBuilding,
  onRemoveBuilding,
  onUpdateBillboardLogo,
  onSettleAtomicPurchase,
  placedBuildingOwned,
}) => {
  const [scanPhase, setScanPhase] = useState<'idle' | 'scanning' | 'done'>('idle');
  const [scanNonce, setScanNonce] = useState<number>(0);
  const [selectedFormId, setSelectedFormId] = useState<ShopBuildingFormId | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [storefrontMap, setStorefrontMap] = useState<StorefrontCatalogMap>(() =>
    loadPersistedStorefrontCatalogMap(),
  );

  const spec = useMemo(
    () => (lotId ? CITY_RENTAL_LOTS.find((lot) => lot.slotId === lotId) ?? null : null),
    [lotId],
  );

  const record = lotId ? store.rentalsByLotId[lotId] ?? null : null;
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

  const ownedShopForms = useMemo(() => {
    const ownedSet = new Set(ownedMerchantItemIds);
    return ALL_SHOP_FORMS.filter((form) => ownedSet.has(form.catalogItemId));
  }, [ownedMerchantItemIds]);

  const canScanAndBuild = open && Boolean(spec) && Boolean(record) && isMine && !isAvailable && !placedForm;

  // Trigger NFT ownership scan whenever an owned unbuilt lot opens, finishes renting, or user rescans
  useEffect(() => {
    if (!canScanAndBuild) {
      setScanPhase('idle');
      setSelectedFormId(null);
      return;
    }
    setScanPhase('scanning');
    setSelectedFormId(null);
    onPreviewBuildingForm(null);
    const timer = window.setTimeout(() => {
      setScanPhase('done');
    }, NFT_SCAN_DURATION_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canScanAndBuild, lotId, scanNonce]);

  // Keep local selection synced if preview is cleared externally
  useEffect(() => {
    if (!open) {
      setSelectedFormId(null);
    }
  }, [open]);

  if (!open || !lotId || !spec) return null;

  // When a Shop Building is standing on this lot, open the Landscape Editorial Tablet Storefront!
  if (record && !isAvailable && placedForm) {
    const activeStoreConfig = resolveLotStorefrontConfig(
      storefrontMap,
      lotId,
      placedForm.id,
    );

    const persistLotStoreConfig = (nextCfg: LotStorefrontConfig) => {
      setStorefrontMap((prev) => {
        const next = { ...prev, [lotId]: nextCfg };
        savePersistedStorefrontCatalogMap(next);
        return next;
      });
    };

    return (
      <ShopStorefrontTabletModal
        lotId={lotId}
        buildingFormId={placedForm.id}
        config={activeStoreConfig}
        isOwner={isMine}
        ownerAccountId={record.renterAccountId}
        visitorAccountId={accountId || 'guest'}
        respiteBalance={respiteBalance > 0 ? respiteBalance : 1250}
        ownedMerchantItemIds={ownedMerchantItemIds}
        billboardLogoUrl={record.billboardLogoUrl}
        leaseExpiresText={formatDateTimeShort(isGrace ? graceEndMs : record.expiresAtMs)}
        isGracePeriod={isGrace}
        termDays={record.termDays}
        onClose={onClose}
        onUpdateConfig={persistLotStoreConfig}
        onUpdateBillboardLogo={(logoUrl) => {
          onUpdateBillboardLogo?.(logoUrl);
        }}
        onAtomicPurchase={(purchase) => {
          const qtyByItemId: Record<string, number> = {};
          const purchasedInventoryItemIds: string[] = [];
          const newReceipts: StoreSaleReceipt[] = [];
          let unitsBought = 0;

          for (const line of purchase.items) {
            qtyByItemId[line.item.id] = (qtyByItemId[line.item.id] || 0) + line.quantity;
            unitsBought += line.quantity;
            if (line.item.linkedInventoryItemId) {
              purchasedInventoryItemIds.push(line.item.linkedInventoryItemId);
            }
            const lineGross = line.unitPriceRespite * line.quantity;
            const lineCityFee = Math.max(1, Math.round(lineGross * 0.025));
            newReceipts.push({
              id: `sale_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              lotId,
              itemId: line.item.id,
              itemTitle: line.item.title,
              colorLabel: line.colorLabel,
              tierLabel: line.tierLabel,
              quantity: line.quantity,
              grossRespite: lineGross,
              ownerSettledRespite: Math.max(0, lineGross - lineCityFee),
              cityFeeRespite: lineCityFee,
              buyerAccountId: accountId || 'guest',
              sellerAccountId: record.renterAccountId,
              timestampMs: Date.now(),
            });
          }

          const updatedItems = activeStoreConfig.items.map((it) => {
            const bought = qtyByItemId[it.id] || 0;
            if (!bought) return it;
            return {
              ...it,
              escrowStockCount: Math.max(0, it.escrowStockCount - bought),
            };
          });

          persistLotStoreConfig({
            ...activeStoreConfig,
            items: updatedItems,
            totalSettledOwnerRespite:
              activeStoreConfig.totalSettledOwnerRespite + purchase.ownerSettledRespite,
            totalCityFeeRespite:
              activeStoreConfig.totalCityFeeRespite + purchase.cityFeeRespite,
            totalUnitsSold: activeStoreConfig.totalUnitsSold + unitsBought,
            recentSales: [...newReceipts, ...activeStoreConfig.recentSales].slice(0, 20),
          });

          onSettleAtomicPurchase?.({
            grossRespite: purchase.grossRespite,
            ownerSettledRespite: purchase.ownerSettledRespite,
            cityFeeRespite: purchase.cityFeeRespite,
            isSelfOwnerPurchase: isMine,
            purchasedInventoryItemIds,
          });
        }}
        onExtendLease={onExtend}
        onEndLease={onEnd}
        onRemoveBuilding={onRemoveBuilding}
      />
    );
  }

  const selectedForm =
    selectedFormId != null
      ? ownedShopForms.find((f) => f.id === selectedFormId) ?? null
      : null;

  const statusMeta = isAvailable
    ? { label: 'Available to rent', dotClass: 'bg-emerald-400', textClass: 'text-emerald-300' }
    : isGrace
      ? { label: 'Grace period', dotClass: 'bg-amber-400', textClass: 'text-amber-300' }
      : isMine
        ? { label: 'Your active lease', dotClass: 'bg-cyan-400', textClass: 'text-cyan-300' }
        : { label: 'Leased by another player', dotClass: 'bg-rose-400', textClass: 'text-rose-300' };

  const handleClose = () => {
    soundEngine.playUiCancel();
    onPreviewBuildingForm(null);
    onClose();
  };

  const handleSelectCatalogForm = (form: ShopBuildingFormSpec) => {
    soundEngine.playUiClick();
    if (selectedFormId === form.id) {
      setSelectedFormId(null);
      onPreviewBuildingForm(null);
      return;
    }
    setSelectedFormId(form.id);
    onPreviewBuildingForm(form.id);
  };

  const handleConfirmBuild = () => {
    if (!selectedForm) return;
    soundEngine.playUiClick();
    onPlaceBuilding(selectedForm.id);
    // Close modal immediately so the player watches the 3D kiosk hologram loading animation materialize the GLB
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Shop lot ${spec.shortCode} rental`}
      data-lot-rental-modal="true"
      onClick={handleClose}
      className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center sm:justify-start p-3 sm:p-6 bg-black/25 sm:bg-black/15 pointer-events-auto select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[392px] max-h-[86vh] flex flex-col rounded-[28px] bg-gradient-to-b from-[#171d2c]/92 via-[#111622]/90 to-[#0c101a]/94 border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_24px_70px_rgba(0,0,0,0.58)] backdrop-blur-2xl text-white overflow-hidden"
      >
        {/* Top Frosted Header (Cerria OS App Sheet Style) */}
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3.5 border-b border-white/10 bg-white/[0.03] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400/25 via-cyan-400/20 to-sky-500/20 border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] flex items-center justify-center shrink-0">
              <Store className="w-5 h-5 text-cyan-200" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold tracking-tight text-white truncate">
                Commercial Lot {spec.shortCode}
              </h2>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-white/60 truncate">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusMeta.dotClass}`} />
                <span className={`font-medium ${statusMeta.textClass}`}>{statusMeta.label}</span>
                <span className="text-white/30" aria-hidden="true">
                  ·
                </span>
                <MapPin className="w-3 h-3 text-white/45 shrink-0" aria-hidden="true" />
                <span className="truncate">{spec.facingRoadLabel}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close lot rental panel"
            data-lot-rental-close="true"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Sheet Body */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {/* Available Lot Flow */}
          {isAvailable && (
            <>
              <div className="rounded-2xl bg-white/[0.05] border border-white/12 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/55">Plot Footprint</span>
                  <span className="font-semibold text-white">
                    {spec.width}m × {spec.depth}m Commercial
                  </span>
                </div>
                <div className="h-px bg-white/10" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/55">Lease Term</span>
                  <span className="font-semibold text-white">
                    {DEFAULT_COMMERCIAL_CONFIG.rentTermDays} days ·{' '}
                    {DEFAULT_COMMERCIAL_CONFIG.gracePeriodDays}d grace
                  </span>
                </div>
                <div className="h-px bg-white/10" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/55">Rental Fee</span>
                  <span className="font-semibold text-emerald-300">Free (Simulation)</span>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-white/60">
                Rent this plot to scan your wallet for owned Shop Building NFTs, preview them live
                on the kiosk hologram, and construct your storefront.
              </p>

              {accountId ? (
                <button
                  type="button"
                  data-lot-rental-rent="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onRent();
                  }}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:brightness-110 active:scale-[0.99] text-slate-950 text-sm font-extrabold tracking-tight shadow-[0_10px_28px_rgba(16,185,129,0.28)] transition-all cursor-pointer"
                >
                  Rent Lot {spec.shortCode} — Free
                </button>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled
                    className="w-full py-3 rounded-2xl bg-white/8 border border-white/10 text-white/35 text-sm font-bold cursor-not-allowed"
                  >
                    Rent Lot {spec.shortCode} — Free
                  </button>
                  <p className="text-center text-xs text-white/50">Sign in to rent this plot</p>
                </div>
              )}
            </>
          )}

          {/* Rented By Another Player */}
          {record && !isMine && !isAvailable && (
            <div className="rounded-2xl bg-white/[0.05] border border-white/12 p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-white/55">Lease Started</span>
                <span className="font-semibold text-white/90">
                  {formatDateTimeShort(record.startedAtMs)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/55">Expires</span>
                <span className="font-semibold text-white/90">
                  {formatDateTimeShort(record.expiresAtMs)}
                </span>
              </div>
              {isGrace && (
                <div className="flex items-center justify-between text-amber-200">
                  <span className="text-amber-200/70">Grace Ends</span>
                  <span className="font-semibold">{formatDateTimeShort(graceEndMs)}</span>
                </div>
              )}
              <p className="pt-2 border-t border-white/10 text-white/55 leading-relaxed">
                This commercial plot is currently leased by another player. It reopens once the
                lease and grace period expire.
              </p>
            </div>
          )}

          {/* Owned Active Lease — Placed Building View */}
          {record && isMine && !isAvailable && placedForm && (
            <div className="rounded-2xl bg-white/[0.05] border border-white/14 p-3.5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl bg-slate-900/80 border border-white/12 overflow-hidden flex items-center justify-center shrink-0">
                  {!brokenImages[placedForm.id] ? (
                    <img
                      src={placedForm.renderImagePath}
                      alt={placedForm.name}
                      onError={() =>
                        setBrokenImages((prev) => ({ ...prev, [placedForm.id]: true }))
                      }
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Building2 className="w-7 h-7 text-cyan-300/75" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                    Active Storefront
                  </p>
                  <h3 className="text-sm font-bold text-white truncate">{placedForm.name}</h3>
                  <p className="mt-0.5 text-xs text-white/55">
                    {placedForm.stories} Floors · {placedForm.footprintWidthM}×
                    {placedForm.footprintDepthM}m
                  </p>
                </div>
              </div>
              <p className="text-xs text-white/55 leading-relaxed">
                {placedBuildingOwned
                  ? 'Linked to your owned Shop Building NFT. Removing or ending the lease returns it to My Things.'
                  : 'Placed on this commercial plot. Removing it frees the plot for another blueprint.'}
              </p>
              <button
                type="button"
                data-lot-rental-remove-building="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  onRemoveBuilding();
                }}
                className="w-full py-2.5 rounded-xl bg-rose-500/14 hover:bg-rose-500/24 border border-rose-400/35 text-rose-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                Remove Building
              </button>
            </div>
          )}

          {/* Owned Active Lease — NFT Ownership Scan + Blueprint Catalog */}
          {record && isMine && !isAvailable && !placedForm && (
            <div className="space-y-3">
              {/* Scanning State */}
              {scanPhase === 'scanning' && (
                <div
                  data-lot-rental-scanning="true"
                  className="rounded-2xl bg-gradient-to-b from-cyan-500/10 via-white/[0.04] to-emerald-500/10 border border-cyan-300/25 p-5 flex flex-col items-center text-center space-y-3 overflow-hidden relative"
                >
                  <div className="w-12 h-12 rounded-2xl bg-cyan-400/15 border border-cyan-300/35 flex items-center justify-center shadow-[0_0_24px_rgba(34,211,238,0.28)]">
                    <ScanLine className="w-6 h-6 text-cyan-300 animate-pulse" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Scanning Building NFTs...</p>
                    <p className="mt-1 text-xs text-white/60">
                      Checking owned commercial blueprints in your wallet
                    </p>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-cyan-400 via-emerald-300 to-cyan-400 animate-pulse" />
                  </div>
                </div>
              )}

              {/* Scan Complete — Owned Blueprints Catalog */}
              {scanPhase === 'done' && ownedShopForms.length > 0 && (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-white/80">
                        Owned Building Catalog
                      </h3>
                      <p className="text-[11px] text-white/50">
                        {ownedShopForms.length} NFT blueprint
                        {ownedShopForms.length > 1 ? 's' : ''} detected · Select to project hologram
                      </p>
                    </div>
                    <button
                      type="button"
                      title="Rescan wallet NFTs"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setScanNonce((n) => n + 1);
                      }}
                      className="w-8 h-8 rounded-xl bg-white/8 hover:bg-white/16 border border-white/12 flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {ownedShopForms.map((form) => {
                      const isSelected =
                        selectedFormId === form.id || previewBuildingFormId === form.id;
                      return (
                        <button
                          key={form.id}
                          type="button"
                          data-lot-rental-catalog-item={form.id}
                          onClick={() => handleSelectCatalogForm(form)}
                          className={`w-full text-left rounded-2xl p-2.5 border transition-all cursor-pointer flex items-center gap-3 ${
                            isSelected
                              ? 'bg-cyan-400/14 border-cyan-300/70 shadow-[0_0_24px_rgba(34,211,238,0.18)]'
                              : 'bg-white/[0.045] hover:bg-white/[0.08] border-white/12 hover:border-white/25'
                          }`}
                        >
                          <div className="w-16 h-16 rounded-xl bg-[#0b101b] border border-white/12 overflow-hidden flex items-center justify-center shrink-0 relative">
                            {!brokenImages[form.id] ? (
                              <img
                                src={form.renderImagePath}
                                alt={form.name}
                                onError={() =>
                                  setBrokenImages((prev) => ({ ...prev, [form.id]: true }))
                                }
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Building2 className="w-6 h-6 text-cyan-300/75" aria-hidden="true" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-[13.5px] font-bold text-white truncate">
                              {form.name}
                            </p>
                            <p className="mt-0.5 text-[11.5px] text-white/60">
                              {form.stories} Floors · {form.footprintWidthM}×{form.footprintDepthM}m
                            </p>
                            <p className="mt-1 text-[11px] text-cyan-200/80 truncate">
                              {isSelected ? 'Projecting live on kiosk hologram' : form.subtitle}
                            </p>
                          </div>

                          <div
                            className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-cyan-400 border-cyan-300 text-slate-950'
                                : 'border-white/20 bg-white/5 text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Primary Build CTA — Active only when a blueprint is selected */}
                  <button
                    type="button"
                    disabled={!selectedForm}
                    data-lot-rental-place-building={selectedForm?.id ?? ''}
                    onClick={handleConfirmBuild}
                    className={`w-full py-3 rounded-2xl text-sm font-extrabold tracking-tight flex items-center justify-center gap-2 transition-all ${
                      selectedForm
                        ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 hover:brightness-110 active:scale-[0.99] text-slate-950 shadow-[0_10px_28px_rgba(34,211,238,0.28)] cursor-pointer'
                        : 'bg-white/8 border border-white/12 text-white/35 cursor-not-allowed'
                    }`}
                  >
                    <Hammer className="w-4 h-4" aria-hidden="true" />
                    {selectedForm ? `Build ${selectedForm.name}` : 'Select a Building to Build'}
                  </button>
                </>
              )}

              {/* Scan Complete — No Shop Building NFTs Owned */}
              {scanPhase === 'done' && ownedShopForms.length === 0 && (
                <div className="rounded-2xl bg-white/[0.045] border border-white/12 p-5 text-center space-y-3">
                  <div className="w-11 h-11 mx-auto rounded-2xl bg-white/8 border border-white/14 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-amber-300" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">No Shop Building NFTs Found</p>
                    <p className="mt-1 text-xs text-white/55 leading-relaxed">
                      Acquire a Shop Building blueprint from the Real Estate Catalog, then rescan
                      this kiosk to construct on Lot {spec.shortCode}.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    {onOpenShopCatalog && (
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          onPreviewBuildingForm(null);
                          onOpenShopCatalog();
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:brightness-110 text-slate-950 text-xs font-extrabold transition-all cursor-pointer"
                      >
                        Open Shop Catalog
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setScanNonce((n) => n + 1);
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/18 border border-white/15 text-white/85 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                      Rescan
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Compact Lease Footer for Active Own Rental */}
        {record && isMine && !isAvailable && (
          <div className="px-5 py-3.5 border-t border-white/10 bg-white/[0.025] space-y-2.5 shrink-0">
            <div className="flex items-center justify-between text-[11.5px] text-white/60">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-cyan-300/80" aria-hidden="true" />
                {isGrace ? 'Grace ends' : 'Lease expires'}
              </span>
              <span className="font-semibold text-white/85">
                {formatDateTimeShort(isGrace ? graceEndMs : record.expiresAtMs)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-lot-rental-extend="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  onExtend();
                }}
                className="py-2 rounded-xl bg-white/10 hover:bg-white/18 border border-white/15 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Extend +{record.termDays}d
              </button>
              <button
                type="button"
                data-lot-rental-end="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  onPreviewBuildingForm(null);
                  onEnd();
                }}
                className="py-2 rounded-xl bg-rose-500/14 hover:bg-rose-500/24 border border-rose-400/30 text-rose-200 text-xs font-bold transition-colors cursor-pointer"
              >
                End Lease
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
