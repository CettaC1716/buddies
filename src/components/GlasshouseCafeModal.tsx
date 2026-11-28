import React, { useEffect, useState } from 'react';
import {
  Coffee,
  Star,
  Coins,
  LogOut,
  Banknote,
  CheckCircle2,
  X,
  ClipboardList,
  Users,
  UserCheck,
  Zap,
  Bell,
  Clock,
  User,
  MessageSquare,
  MessageCircle,
} from 'lucide-react';
import {
  CAFE_MAX_BATCH_ORDER_ITEMS,
  CAFE_MENU_ITEMS,
  CAFE_SHIFT_MAX_ORDERS,
  type CafeActiveCustomerOrder,
  type CafeBatchOrderEntry,
  type CafeConsumerRemainingSummary,
  type CafeMenuItemId,
  type CafeMenuItemSpec,
  type CafeWorkShiftState,
  type PlayerLevelProgress,
} from '../game/buddiesCafeRules';
import { CafeMenuItemArtwork } from './GlasshouseCafeMenuArtwork';
import { type NearbyEntityUser } from './SocialChatModal';
import { soundEngine } from '../game/audio';
import {
  resolveNpcCitizenIdFromEntity,
  resolveNpcPhotoUrl,
  useNpcPortraitVersion,
} from '../game/npcPortraitRegistry';

export interface PlayerLevelXpBadgeProps {
  levelProgress: PlayerLevelProgress;
  playerName: string;
  lulBalance: number;
  isWorkingShift: boolean;
}

export const PlayerLevelXpBadge: React.FC<PlayerLevelXpBadgeProps> = ({
  levelProgress,
  playerName,
  lulBalance,
  isWorkingShift,
}) => {
  const pct = Math.round(levelProgress.progress01 * 100);
  return (
    <div
      data-player-level-badge="true"
      data-player-level={levelProgress.level}
      data-player-xp={levelProgress.totalXp}
      className="pointer-events-auto flex flex-col gap-2 bg-[#f6f4f0]/92 backdrop-blur-xl text-slate-900 border border-white/80 shadow-[0_12px_32px_rgba(15,23,42,0.18)] px-3 py-2.5 rounded-2xl min-w-[210px] max-w-[250px] select-none"
    >
      <div className="flex items-center gap-2.5">
        <div
          data-testid="hud-player-level"
          className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-sm flex flex-col items-center justify-center text-white"
        >
          <span className="text-[8px] font-bold leading-none tracking-wider opacity-90">LV</span>
          <span className="text-base font-extrabold font-mono-tabular leading-none">
            {levelProgress.level}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide truncate text-slate-900">
              {playerName || 'CITIZEN'}
            </span>
            {isWorkingShift && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-[8.5px] font-bold uppercase tracking-wider leading-none shrink-0">
                BARISTA
              </span>
            )}
          </div>

          <div className="mt-1.5 relative w-full h-3.5 bg-stone-200/90 rounded-full overflow-hidden">
            <div
              data-testid="hud-player-xp-fill"
              className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[8.5px] font-bold font-mono-tabular text-slate-800">
              {levelProgress.currentLevelXp}/{levelProgress.xpForNextLevel} XP
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <div
          data-testid="hud-player-lul"
          className="flex-1 px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200/80 rounded-full font-mono-tabular font-bold text-[10.5px] flex items-center justify-between"
        >
          <span>LUL</span>
          <span>{lulBalance}</span>
        </div>
      </div>
    </div>
  );
};

export interface CafeInteriorTopHudBarProps {
  shiftState: CafeWorkShiftState;
  onStartWorkShift: () => void;
  onStopWorkShift: () => void;
  onServeActiveOrder: () => void;
  onOpenOrderModal: () => void;
  onOpenAtmModal: () => void;
  onExitCafe: () => void;
}

export const CafeInteriorTopHudBar: React.FC<CafeInteriorTopHudBarProps> = ({
  shiftState,
  onStartWorkShift,
  onStopWorkShift,
  onServeActiveOrder,
  onOpenOrderModal,
  onOpenAtmModal,
  onExitCafe,
}) => {
  return (
    <div
      data-cafe-interior-hud="true"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-40 pointer-events-auto flex flex-col items-center gap-2 select-none"
    >
      <div className="flex flex-wrap items-center justify-center gap-1.5 bg-[#f6f4f0]/92 backdrop-blur-xl text-slate-900 border border-white/80 shadow-[0_12px_32px_rgba(15,23,42,0.18)] px-3 py-1.5 rounded-full">
        <span className="px-2.5 py-1 rounded-full bg-amber-100/90 text-amber-950 border border-amber-200/80 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
          <Coffee className="w-3 h-3 text-amber-700" aria-hidden="true" />
          GLASSHOUSE CAFE
        </span>

        {!shiftState.isWorking ? (
          <>
            <button
              type="button"
              data-cafe-start-shift-btn="true"
              onClick={onStartWorkShift}
              className="px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm text-[10.5px] font-bold uppercase tracking-wide cursor-pointer transition-colors"
            >
              WORK SHIFT
            </button>
            <button
              type="button"
              data-cafe-open-menu-btn="true"
              onClick={onOpenOrderModal}
              className="px-3 py-1 rounded-full bg-white hover:bg-stone-100 text-slate-800 border border-stone-200/90 shadow-sm text-[10.5px] font-bold uppercase tracking-wide cursor-pointer transition-colors"
            >
              ORDER MENU
            </button>
            <button
              type="button"
              data-cafe-open-atm-btn="true"
              onClick={onOpenAtmModal}
              className="px-3 py-1 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/90 shadow-sm text-[10.5px] font-bold uppercase tracking-wide cursor-pointer transition-colors"
            >
              ATM
            </button>
          </>
        ) : (
          <>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase">
              SHIFT {shiftState.ordersCompletedInShift}/{shiftState.maxOrdersInShift}
            </span>
            <button
              type="button"
              data-cafe-stop-shift-btn="true"
              onClick={onStopWorkShift}
              className="px-3 py-1 rounded-full bg-stone-200 hover:bg-stone-300 text-slate-800 text-[10px] font-bold uppercase cursor-pointer transition-colors"
            >
              END SHIFT
            </button>
          </>
        )}

        <button
          type="button"
          data-cafe-exit-btn="true"
          onClick={onExitCafe}
          className="px-3 py-1 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-sm text-[10.5px] font-bold uppercase flex items-center gap-1 cursor-pointer transition-colors"
        >
          <LogOut className="w-3 h-3" aria-hidden="true" />
          EXIT
        </button>
      </div>

      {/* Active Customer Order Card while working as BARISTA */}
      {shiftState.isWorking && shiftState.activeOrder && (
        <div
          data-cafe-active-order-card="true"
          className="flex items-center gap-3 bg-[#f6f4f0]/95 backdrop-blur-xl text-slate-900 border border-white/80 shadow-[0_14px_36px_rgba(15,23,42,0.18)] px-3.5 py-2 rounded-2xl"
        >
          <div className="w-10 h-10 bg-white border border-stone-200/80 shadow-sm rounded-xl flex items-center justify-center shrink-0">
            <CafeMenuItemArtwork itemId={shiftState.activeOrder.item.id} className="w-8 h-8" />
          </div>
          <div className="min-w-[120px]">
            <div className="text-[9.5px] font-bold uppercase text-emerald-700 tracking-wider leading-none">
              ORDER FOR {shiftState.activeOrder.customerName}
            </div>
            <div className="text-xs font-extrabold uppercase text-slate-900 leading-tight mt-0.5">
              {shiftState.activeOrder.item.name}
            </div>
            <div className="text-[10px] font-bold text-amber-700 font-mono-tabular">
              +{shiftState.activeOrder.item.xpReward + 15} XP
            </div>
          </div>
          <button
            type="button"
            data-cafe-serve-order-btn="true"
            onClick={() => {
              soundEngine.playUiConfirm();
              onServeActiveOrder();
            }}
            className="px-3.5 py-2 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm text-xs font-bold uppercase tracking-wide cursor-pointer active:scale-95 transition-all"
          >
            SERVE [E]
          </button>
        </div>
      )}
    </div>
  );
};

export interface GlasshouseCafeOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  lulBalance: number;
  levelProgress: PlayerLevelProgress;
  consumerSummary?: CafeConsumerRemainingSummary | null;
  onPurchaseItem: (item: CafeMenuItemSpec) => { ok: boolean; message: string };
  onPurchaseBatch?: (entries: CafeBatchOrderEntry[]) => { ok: boolean; message: string };
}

export const GlasshouseCafeOrderModal: React.FC<GlasshouseCafeOrderModalProps> = ({
  isOpen,
  onClose,
  lulBalance,
  levelProgress,
  consumerSummary,
  onPurchaseItem,
  onPurchaseBatch,
}) => {
  const [selectedId, setSelectedId] = useState<CafeMenuItemSpec['id'] | null>(null);
  const [batchCounts, setBatchCounts] = useState<Partial<Record<CafeMenuItemId, number>>>({});
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setBatchCounts({});
      setFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConsuming = Boolean(consumerSummary?.isConsuming && consumerSummary.activeItem);
  const selectedItem = CAFE_MENU_ITEMS.find((it) => it.id === selectedId) ?? null;

  const batchItems: Array<{ item: CafeMenuItemSpec; qty: number }> = [];
  let totalBatchQty = 0;
  let totalBatchLul = 0;
  let totalBatchXp = 0;
  for (const item of CAFE_MENU_ITEMS) {
    const qty = batchCounts[item.id] ?? 0;
    if (qty > 0) {
      batchItems.push({ item, qty });
      totalBatchQty += qty;
      totalBatchLul += item.priceLul * qty;
      totalBatchXp += item.xpReward * qty;
    }
  }

  const updateBatchQty = (itemId: CafeMenuItemId, delta: number) => {
    setFeedback(null);
    setBatchCounts((prev) => {
      const cur = prev[itemId] ?? 0;
      const otherQty = totalBatchQty - cur;
      const maxForItem = Math.max(0, CAFE_MAX_BATCH_ORDER_ITEMS - otherQty);
      const next = Math.max(0, Math.min(maxForItem, cur + delta));
      const copy = { ...prev };
      if (next <= 0) {
        delete copy[itemId];
      } else {
        copy[itemId] = next;
      }
      return copy;
    });
  };

  const selectedBatchQty = selectedItem ? batchCounts[selectedItem.id] ?? 0 : 0;

  const handleConfirmOrder = () => {
    if (isConsuming) {
      soundEngine.playHit();
      setFeedback({
        ok: false,
        text: 'Finish the food/drink in your hand before ordering again!',
      });
      return;
    }
    if (totalBatchQty > 0 && onPurchaseBatch) {
      const entries: CafeBatchOrderEntry[] = batchItems.map(({ item, qty }) => ({
        itemId: item.id,
        quantity: qty,
      }));
      const res = onPurchaseBatch(entries);
      if (res.ok) {
        setBatchCounts({});
        setFeedback(null);
        onClose();
      } else {
        setFeedback({ ok: false, text: res.message });
      }
      return;
    }
    if (!selectedItem) return;
    const res = onPurchaseBatch
      ? onPurchaseBatch([{ itemId: selectedItem.id, quantity: 1 }])
      : onPurchaseItem(selectedItem);
    if (res.ok) {
      setBatchCounts({});
      setFeedback(null);
      onClose();
    } else {
      setFeedback({ ok: false, text: res.message });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ORDER SOMETHING"
      data-cafe-order-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/45 backdrop-blur-sm pointer-events-auto"
    >
      <div className="w-full max-w-[720px] rounded-[26px] bg-[#f6f4f0]/96 backdrop-blur-2xl border border-white/80 shadow-[0_24px_64px_rgba(15,23,42,0.28)] text-slate-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-amber-50/90 via-[#f6f4f0] to-stone-100/80 border-b border-stone-200/80">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200/80 text-[10.5px] font-bold uppercase tracking-wide">
              LV {levelProgress.level}
            </span>
            <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-slate-900">
              ORDER SOMETHING
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200/80 shadow-xs font-mono-tabular font-bold text-xs flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
              {lulBalance} LUL
            </div>
            <button
              type="button"
              data-cafe-order-close-btn="true"
              onClick={() => {
                soundEngine.playUiCancel();
                setFeedback(null);
                onClose();
              }}
              aria-label="Close Order Menu"
              className="w-8 h-8 rounded-full bg-white hover:bg-stone-100 text-slate-600 hover:text-slate-900 border border-stone-200/80 shadow-xs flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Consumption Lock Banner */}
        {isConsuming && consumerSummary?.activeItem && (
          <div
            data-cafe-consuming-lock-banner="true"
            className="px-5 py-3 bg-amber-50/95 text-amber-950 border-b border-amber-200/80 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-white border border-amber-200/80 shadow-xs rounded-xl flex items-center justify-center shrink-0">
                <CafeMenuItemArtwork itemId={consumerSummary.activeItem.id} className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase truncate text-amber-950">
                  Finish the {consumerSummary.activeItem.name} in your hand before ordering again!
                </div>
                <div className="text-[11px] font-medium text-amber-800">
                  {Math.max(1, Math.ceil(consumerSummary.remainingActiveMs / 1000))}s left
                  {consumerSummary.queuedCount > 0
                    ? ` • +${consumerSummary.queuedCount} more item${consumerSummary.queuedCount === 1 ? '' : 's'} in batch queue`
                    : ''}
                </div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-amber-900 text-amber-100 font-mono-tabular text-[11px] font-bold shrink-0">
              {Math.max(1, Math.ceil(consumerSummary.totalRemainingMs / 1000))}s
            </span>
          </div>
        )}

        {/* 2-Column Layout */}
        <div className="p-5 grid grid-cols-1 sm:grid-cols-12 gap-4">
          {/* Left 3x3 Visual Grid (Clean White Cafe Cards) */}
          <div className="sm:col-span-7 grid grid-cols-3 gap-2.5">
            {CAFE_MENU_ITEMS.map((item) => {
              const isSelected = item.id === selectedId;
              const qtyInBatch = batchCounts[item.id] ?? 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-cafe-menu-item={item.id}
                  onClick={() => {
                    soundEngine.playUiClick();
                    setSelectedId(item.id);
                    setFeedback(null);
                  }}
                  aria-label={`${item.name} - ${item.priceLul} LUL`}
                  className={`relative group flex flex-col items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'bg-amber-50/90 border-amber-500 ring-2 ring-amber-400/40 -translate-y-0.5 shadow-md'
                      : 'bg-white hover:bg-stone-50 border-stone-200/80 shadow-sm hover:shadow'
                  }`}
                >
                  {qtyInBatch > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 px-2 py-0.5 bg-amber-600 text-white rounded-full text-[10px] font-bold font-mono-tabular shadow-sm">
                      ×{qtyInBatch}
                    </span>
                  )}
                  <div className="w-14 h-14 flex items-center justify-center">
                    <CafeMenuItemArtwork itemId={item.id} className="w-13 h-13 drop-shadow-sm" />
                  </div>
                  <div className="mt-1.5 w-full py-1 px-2 bg-stone-100/90 rounded-full text-[10.5px] font-bold font-mono-tabular text-amber-900 flex items-center justify-center gap-1">
                    <span className="text-amber-600">◆</span>
                    <span>{item.priceLul}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Detail Panel + Batch Cart */}
          <div className="sm:col-span-5 bg-white text-slate-900 border border-stone-200/80 shadow-sm rounded-2xl p-4 flex flex-col items-center justify-between text-center min-h-[296px]">
            {!selectedItem && totalBatchQty === 0 ? (
              <div className="my-auto px-2 space-y-1.5">
                <p className="text-xs font-semibold text-stone-600 leading-relaxed">
                  Select an item to order immediately or add it to a Batch Order (max {CAFE_MAX_BATCH_ORDER_ITEMS} items)
                </p>
              </div>
            ) : (
              <>
                {selectedItem && (
                  <>
                    <div className="w-full flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-bold uppercase">
                        +{selectedItem.xpReward} XP
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-[10px] font-bold font-mono-tabular">
                        {selectedItem.priceLul} LUL
                      </span>
                    </div>

                    <div className="my-2 p-2.5 bg-[#f6f4f0] border border-stone-200/70 rounded-2xl">
                      <CafeMenuItemArtwork itemId={selectedItem.id} className="w-20 h-20" />
                    </div>

                    <div className="space-y-0.5 mb-2.5">
                      <div className="text-sm font-extrabold uppercase text-slate-900">
                        {selectedItem.name}
                      </div>
                      <div className="text-[11px] font-medium text-stone-500">
                        {selectedItem.prepHint}
                      </div>
                    </div>

                    {/* Batch Order Stepper */}
                    <div className="w-full mb-2.5 flex items-center justify-between gap-1.5 bg-[#f6f4f0] border border-stone-200/80 rounded-full px-3 py-1.5">
                      <span className="text-[10px] font-bold uppercase text-stone-600">
                        Batch ({totalBatchQty}/{CAFE_MAX_BATCH_ORDER_ITEMS})
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isConsuming || selectedBatchQty <= 0}
                          onClick={() => {
                            soundEngine.playUiClick();
                            updateBatchQty(selectedItem.id, -1);
                          }}
                          data-cafe-batch-minus-btn="true"
                          className="w-6 h-6 bg-white hover:bg-stone-100 disabled:opacity-40 border border-stone-300/80 rounded-full font-bold text-xs text-slate-700 cursor-pointer transition-colors"
                        >
                          -
                        </button>
                        <span className="w-5 text-center font-mono-tabular font-bold text-xs text-slate-900">
                          {selectedBatchQty}
                        </span>
                        <button
                          type="button"
                          disabled={isConsuming || totalBatchQty >= CAFE_MAX_BATCH_ORDER_ITEMS}
                          onClick={() => {
                            soundEngine.playUiClick();
                            updateBatchQty(selectedItem.id, 1);
                          }}
                          data-cafe-batch-plus-btn="true"
                          className="px-2.5 h-6 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-full font-bold text-[10px] uppercase cursor-pointer transition-colors"
                        >
                          +Batch
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {totalBatchQty > 0 && (
                  <div
                    data-cafe-batch-summary="true"
                    className="w-full mb-2.5 p-2.5 bg-[#f6f4f0] border border-stone-200/80 rounded-xl text-left space-y-1.5 max-h-24 overflow-y-auto"
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase text-stone-600">
                      <span>Batch Cart ({totalBatchQty} {totalBatchQty === 1 ? 'item' : 'items'})</span>
                      <span className="text-emerald-700">+{totalBatchXp} XP</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {batchItems.map(({ item, qty }) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => updateBatchQty(item.id, -qty)}
                          className="px-2 py-0.5 bg-white hover:bg-rose-50 border border-stone-200/90 hover:border-rose-200 rounded-full text-[10px] font-semibold text-slate-800 flex items-center gap-1 cursor-pointer transition-colors"
                          title="Remove from batch"
                        >
                          <span>
                            {item.name} ×{qty}
                          </span>
                          <span className="font-bold text-rose-600">×</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {feedback && (
                  <div
                    data-cafe-order-feedback="true"
                    className={`w-full mb-2.5 px-3 py-1.5 rounded-xl border text-[11px] font-semibold ${
                      feedback.ok
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    {feedback.text}
                  </div>
                )}

                <button
                  type="button"
                  disabled={isConsuming || (totalBatchQty === 0 && !selectedItem)}
                  data-cafe-buy-selected-btn="true"
                  onClick={handleConfirmOrder}
                  className="w-full py-2.5 px-4 rounded-full bg-amber-700 hover:bg-amber-800 disabled:bg-stone-200 disabled:text-stone-400 text-white shadow-sm font-bold text-xs uppercase tracking-wider cursor-pointer active:scale-[0.98] transition-all"
                >
                  {isConsuming
                    ? 'FINISH CURRENT ITEM...'
                    : totalBatchQty > 0
                      ? `ORDER BATCH (${totalBatchQty} • ${totalBatchLul} LUL)`
                      : selectedItem
                        ? `ORDER (${selectedItem.priceLul} LUL)`
                        : 'SELECT AN ITEM'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export interface GlasshouseCafeAtmModalProps {
  isOpen: boolean;
  onClose: () => void;
  lulBalance: number;
  cyonBalance: number;
  /** LUL charged for one 10-CYON packet at today's merchant rate. */
  lulCostFor10Cyon: number;
  treasuryCyon: number;
  onExchangePackets: (packets: number) => { ok: boolean; message: string };
}

export const GlasshouseCafeAtmModal: React.FC<GlasshouseCafeAtmModalProps> = ({
  isOpen,
  onClose,
  lulBalance,
  cyonBalance,
  lulCostFor10Cyon,
  treasuryCyon,
  onExchangePackets,
}) => {
  const [amountText, setAmountText] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAmountText('');
      setFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const rate = Math.max(1, Math.floor(lulCostFor10Cyon));
  const amount = Math.max(0, Math.floor(Number(amountText) || 0));
  const maxPackets = Math.max(
    0,
    Math.min(Math.floor(lulBalance / rate), Math.floor(treasuryCyon / 10)),
  );
  const packets = Math.max(0, Math.min(Math.floor(amount / rate), maxPackets));
  const receiveCyon = packets * 10;
  const costLul = packets * rate;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="CAFE ATM EXCHANGE"
      data-cafe-atm-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm pointer-events-auto"
    >
      <div className="w-full max-w-sm rounded-[26px] bg-[#f6f4f0]/96 backdrop-blur-2xl border border-white/80 shadow-[0_24px_64px_rgba(15,23,42,0.28)] text-slate-900 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-amber-50/90 via-[#f6f4f0] to-stone-100/80 border-b border-stone-200/80">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
              <Banknote className="w-4 h-4" aria-hidden="true" />
            </span>
            <h2 className="text-sm font-extrabold uppercase tracking-tight text-slate-900">
              CAFE ATM · EXCHANGE
            </h2>
          </div>
          <button
            type="button"
            data-cafe-atm-close-btn="true"
            onClick={() => {
              soundEngine.playUiCancel();
              onClose();
            }}
            aria-label="Close ATM"
            className="w-8 h-8 rounded-full bg-white hover:bg-stone-100 text-slate-600 hover:text-slate-900 border border-stone-200/80 shadow-xs flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-3.5 text-slate-900">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 bg-white border border-stone-200/80 rounded-2xl text-center shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-wide text-amber-700">LUL BALANCE</div>
              <div
                data-atm-lul-balance="true"
                className="text-xl font-extrabold font-mono-tabular text-slate-900 mt-0.5"
              >
                {lulBalance}
              </div>
            </div>
            <div className="p-3 bg-white border border-stone-200/80 rounded-2xl text-center shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-wide text-sky-700">CYON BALANCE</div>
              <div
                data-atm-cyon-balance="true"
                className="text-xl font-extrabold font-mono-tabular text-sky-600 mt-0.5"
              >
                {cyonBalance}
              </div>
            </div>
          </div>

          <div className="text-center text-[11px] font-medium text-stone-600">
            Exchange Rate:{' '}
            <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold">
              {rate} LUL = 10 CYON
            </span>{' '}
            · Shop stock: {treasuryCyon} CYON
          </div>

          <label className="block text-[10.5px] font-bold uppercase tracking-wider text-stone-500">
            You pay (LUL)
          </label>
          <div className="flex gap-2 -mt-1.5">
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={amountText}
              onChange={(e) => {
                setAmountText(e.target.value.replace(/[^0-9]/g, ''));
                setFeedback(null);
              }}
              placeholder="0"
              className="min-w-0 flex-1 rounded-2xl bg-white border border-stone-300/90 focus:border-amber-500 focus:ring-2 focus:ring-amber-400/30 px-3.5 py-2 text-lg font-bold outline-none transition-all"
            />
            <button
              type="button"
              className="shrink-0 px-4 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white shadow-sm font-bold text-xs uppercase cursor-pointer transition-colors"
              onClick={() => {
                setAmountText(String(maxPackets * rate));
                setFeedback(null);
              }}
            >
              MAX
            </button>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-white border border-stone-200/80 shadow-xs px-3.5 py-2.5">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-stone-500">
              You receive
            </span>
            <span className="text-lg font-extrabold text-sky-600 font-mono-tabular">{receiveCyon} CYON</span>
          </div>
          <p className="text-[11px] font-medium text-stone-500 leading-relaxed">
            {packets > 0
              ? `${packets} packet${packets > 1 ? 's' : ''} × ${rate} LUL — exactly ${costLul} LUL will be charged, the rest stays in your balance.`
              : `Enter at least ${rate} LUL to exchange one packet.`}
          </p>

          <button
            type="button"
            disabled={packets < 1}
            data-atm-exchange-btn="true"
            onClick={() => setFeedback(onExchangePackets(packets))}
            className="w-full py-2.5 rounded-full bg-amber-700 disabled:bg-stone-200 disabled:text-stone-400 hover:bg-amber-800 text-white shadow-sm font-bold text-xs uppercase tracking-wider cursor-pointer disabled:cursor-not-allowed transition-colors"
          >
            EXCHANGE
          </button>
          {feedback ? (
            <div
              className={`rounded-2xl px-3.5 py-2 text-center text-xs font-semibold border ${
                feedback.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {feedback.message}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export const XpGainCelebrationBanner: React.FC<{
  banner: { id: number; xpGained: number; leveledUpTo: number | null; label: string } | null;
}> = ({ banner }) => {
  if (!banner) return null;
  return (
    <div
      data-xp-celebration-banner="true"
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none animate-bounce"
    >
      <div className="flex items-center gap-2 bg-[#f6f4f0]/95 backdrop-blur-xl text-slate-900 border border-white/80 shadow-[0_14px_36px_rgba(15,23,42,0.22)] px-4 py-2 rounded-full">
        {banner.leveledUpTo ? (
          <Star className="w-5 h-5 text-amber-500 fill-amber-400" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
        )}
        <span className="text-xs font-extrabold uppercase tracking-wide">
          {banner.leveledUpTo
            ? `LEVEL UP! NOW LV ${banner.leveledUpTo} (+${banner.xpGained} XP)`
            : `${banner.label} · +${banner.xpGained} XP`}
        </span>
      </div>
    </div>
  );
};

export type UnifiedBottomDockActionMode =
  | 'none'
  | 'work_shift'
  | 'sit'
  | 'stand_up'
  | 'nearby_entity';

export interface CafeWorkShiftBottomDockProps {
  isVisible: boolean;
  actionMode?: UnifiedBottomDockActionMode;
  isExpanded: boolean;
  shiftState: CafeWorkShiftState;
  nearbyEntity?: NearbyEntityUser | null;
  isEntityMenuExpanded?: boolean;
  canCycleNearbyEntity?: boolean;
  onToggleExpand: () => void;
  onToggleEntityMenu?: () => void;
  onTriggerSitOrStand?: () => void;
  onOpenEntityProfile?: (entity: NearbyEntityUser) => void;
  hasOwnedPairedAnimations?: boolean;
  onInteractEntity?: (entity: NearbyEntityUser) => void;
  onTalkMerchant?: (entity: NearbyEntityUser) => void;
  onTalkCitizen?: (entity: NearbyEntityUser) => void;
  onWhisperEntity?: (entity: NearbyEntityUser) => void;
  onCycleNearbyEntity?: () => void;
  onOpenRotaModal: () => void;
  onStartOrQueueShift: () => void;
  onLeaveShiftQueue: () => void;
  onOpenAtmModal: () => void;
}

export const CafeWorkShiftBottomDock: React.FC<CafeWorkShiftBottomDockProps> = ({
  isVisible,
  actionMode,
  isExpanded,
  shiftState,
  nearbyEntity,
  isEntityMenuExpanded = false,
  canCycleNearbyEntity = false,
  onToggleExpand,
  onToggleEntityMenu,
  onTriggerSitOrStand,
  onOpenEntityProfile,
  hasOwnedPairedAnimations = false,
  onInteractEntity,
  onTalkMerchant,
  onTalkCitizen,
  onWhisperEntity,
  onCycleNearbyEntity,
  onOpenRotaModal,
  onStartOrQueueShift,
  onLeaveShiftQueue,
  onOpenAtmModal,
}) => {
  useNpcPortraitVersion();
  // Dock to the measured right edge of the world chat bar on desktop —
  // the same shared bottom-bar slot the in-world prompt buttons use.
  const [dockLeftPx, setDockLeftPx] = useState<number | null>(null);
  useEffect(() => {
    if (!isVisible) return;
    const measure = () => {
      if (window.innerWidth < 1024) {
        setDockLeftPx(null);
        return;
      }
      const chatBarEl = document.querySelector('[data-buddies-chat-bar="true"]');
      const chatRect = chatBarEl?.getBoundingClientRect();
      setDockLeftPx(chatRect && chatRect.width > 0 ? Math.round(chatRect.right) + 14 : null);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isVisible]);

  if (!isVisible) return null;

  const resolvedMode: UnifiedBottomDockActionMode = actionMode ?? 'work_shift';
  if (resolvedMode === 'none') return null;
  if (resolvedMode === 'nearby_entity' && !nearbyEntity) return null;

  const isWorkShiftMode = resolvedMode === 'work_shift';
  const isNearbyEntityMode = resolvedMode === 'nearby_entity' && Boolean(nearbyEntity);
  const hasOtherActiveWorker = Boolean(shiftState.otherActiveWorker);
  const queueList = shiftState.shiftQueue ?? [];
  const selfQueueIndex = queueList.findIndex((entry) => entry.isSelf);
  const isSelfInQueue = selfQueueIndex >= 0;
  const selfQueueNumber = selfQueueIndex + 1;

  const cleanEntityName = nearbyEntity
    ? nearbyEntity.name.replace(/\s*\((ANDA|YOU|KAMU)\)/gi, '').trim()
    : '';
  const entityLower = cleanEntityName.toLowerCase();
  const isMerchantEntity = Boolean(
    nearbyEntity &&
      (nearbyEntity.isMerchant ||
        nearbyEntity.id === 'npc_hana' ||
        nearbyEntity.id === 'npc_cafe' ||
        nearbyEntity.id === 'npc_kai' ||
        nearbyEntity.id === 'npc_beach' ||
        nearbyEntity.id === 'city_plaza_nadia' ||
        nearbyEntity.id === 'npc_nadia'),
  );
  const isCitizenNpcEntity = Boolean(nearbyEntity && nearbyEntity.isNpc && !isMerchantEntity);
  const isWhisperablePlayer = Boolean(
    nearbyEntity &&
      !nearbyEntity.isNpc &&
      !nearbyEntity.isSelf &&
      !cleanEntityName.toUpperCase().startsWith('BUDDY #'),
  );
  const isFemaleNpcPortrait = Boolean(
    nearbyEntity &&
      (entityLower.includes('hana') ||
        entityLower.includes('nadia') ||
        entityLower.includes('mira') ||
        entityLower.includes('tari') ||
        (nearbyEntity.isNpc && nearbyEntity.gender === 'female')),
  );

  return (
    <aside
      aria-label={
        isNearbyEntityMode && nearbyEntity
          ? `Nearby: ${cleanEntityName}`
          : isWorkShiftMode
            ? 'Cafe Work Shift'
            : resolvedMode === 'stand_up'
              ? 'Stand Up'
              : 'Sit'
      }
      data-unified-bottom-action-dock={resolvedMode}
      data-cafe-giliran-kerja-dock={isWorkShiftMode ? 'true' : undefined}
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed bottom-[70px] left-1/2 -translate-x-1/2 lg:bottom-3 lg:left-[570px] lg:translate-x-0 z-40 flex flex-col items-center lg:items-start gap-1.5 pointer-events-auto select-none"
      style={dockLeftPx !== null ? { left: dockLeftPx } : undefined}
    >
      {/* Upward Expanded Action Stack (Work Shift Mode Only) */}
      {isWorkShiftMode && isExpanded && (
        <div
          data-cafe-giliran-kerja-menu="true"
          className="flex flex-col items-center gap-1.5 mb-1"
        >
          {/* Active Worker Status Strip when someone else is working */}
          {shiftState.otherActiveWorker && (
            <div className="rounded-2xl min-w-[232px] px-3 py-1.5 bg-[#0e121b]/88 backdrop-blur-xl border border-white/15 shadow-lg text-center text-white">
              <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider">
                <span className="text-sky-300 truncate">
                  WORKING: {shiftState.otherActiveWorker.name}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-sky-400/20 text-sky-200 border border-sky-300/30 font-mono-tabular">
                  {shiftState.otherActiveWorker.ordersServed}/{shiftState.otherActiveWorker.maxOrders}
                </span>
              </div>
            </div>
          )}

          {/* 1. View Rota */}
          <button
            type="button"
            data-cafe-rota-lihat-giliran-btn="true"
            onClick={onOpenRotaModal}
            className="rounded-2xl min-w-[232px] h-10 px-2.5 bg-[#f6f4f0]/95 hover:bg-white backdrop-blur-xl border border-white/80 shadow-[0_8px_24px_rgba(15,23,42,0.18)] flex items-center text-slate-900 font-bold uppercase text-xs tracking-wide cursor-pointer active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-2.5 w-full">
              <span className="w-6 h-6 rounded-full bg-stone-200/80 text-slate-800 flex items-center justify-center shrink-0">
                <ClipboardList className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
              <span className="flex-1 text-left">View Rota</span>
            </div>
          </button>

          {/* 2. Start Work (when idle) OR Join Queue / Leave Queue (when someone is working) */}
          {!hasOtherActiveWorker ? (
            <button
              type="button"
              data-cafe-rota-mulai-kerja-btn="true"
              onClick={onStartOrQueueShift}
              className="rounded-2xl min-w-[232px] h-10 px-2.5 bg-[#f6f4f0]/95 hover:bg-white backdrop-blur-xl border border-emerald-300/80 shadow-[0_8px_24px_rgba(15,23,42,0.18)] flex items-center text-emerald-900 font-bold uppercase text-xs tracking-wide cursor-pointer active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-2.5 w-full">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
                <span className="flex-1 text-left text-emerald-800">Start Work</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9.5px] font-mono-tabular">
                  0/{CAFE_SHIFT_MAX_ORDERS}
                </span>
              </div>
            </button>
          ) : !isSelfInQueue ? (
            <button
              type="button"
              data-cafe-rota-ikut-antrian-btn="true"
              onClick={onStartOrQueueShift}
              className="rounded-2xl min-w-[232px] h-10 px-2.5 bg-[#f6f4f0]/95 hover:bg-white backdrop-blur-xl border border-sky-300/80 shadow-[0_8px_24px_rgba(15,23,42,0.18)] flex items-center text-sky-900 font-bold uppercase text-xs tracking-wide cursor-pointer active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-2.5 w-full">
                <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                  <Users className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
                <span className="flex-1 text-left text-sky-800">Join Queue</span>
                <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[9.5px] font-mono-tabular">
                  #{queueList.length + 1}
                </span>
              </div>
            </button>
          ) : (
            <button
              type="button"
              data-cafe-rota-keluar-antrian-btn="true"
              onClick={onLeaveShiftQueue}
              className="rounded-2xl min-w-[232px] h-10 px-2.5 bg-[#f6f4f0]/95 hover:bg-white backdrop-blur-xl border border-amber-300/80 shadow-[0_8px_24px_rgba(15,23,42,0.18)] flex items-center text-amber-900 font-bold uppercase text-xs tracking-wide cursor-pointer active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-2.5 w-full">
                <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Users className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
                <span className="flex-1 text-left text-amber-800">
                  Queue #{selfQueueNumber} · Leave
                </span>
              </div>
            </button>
          )}

          {/* 3. ATM Shortcut (LUL to CYON exchange) */}
          <button
            type="button"
            data-cafe-rota-atm-btn="true"
            onClick={onOpenAtmModal}
            className="rounded-2xl min-w-[232px] h-10 px-2.5 bg-[#f6f4f0]/95 hover:bg-white backdrop-blur-xl border border-white/80 shadow-[0_8px_24px_rgba(15,23,42,0.18)] flex items-center text-slate-900 font-bold uppercase text-xs tracking-wide cursor-pointer active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-2.5 w-full">
              <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Zap className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
              <span className="flex-1 text-left">ATM · Exchange</span>
            </div>
          </button>
        </div>
      )}

      {/* Upward Expanded Action Stack (Nearby / Selected Character Mode) */}
      {isNearbyEntityMode && nearbyEntity && isEntityMenuExpanded && (
        <div
          data-nearby-entity-action-menu="true"
          className="flex flex-col items-center lg:items-start gap-1.5 mb-1"
        >
          <button
            type="button"
            data-nearby-entity-profile-btn="true"
            onClick={() => onOpenEntityProfile?.(nearbyEntity)}
            className="rounded-2xl min-w-[232px] h-10 px-2.5 bg-[#0e121b]/88 hover:bg-[#171d2a] backdrop-blur-xl border border-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.35)] flex items-center text-white font-bold uppercase text-xs tracking-wide cursor-pointer active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-2.5 w-full">
              <span className="w-6 h-6 rounded-full bg-sky-400/20 text-sky-300 flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
              <span className="flex-1 text-left">Profile</span>
            </div>
          </button>

          {hasOwnedPairedAnimations && onInteractEntity && (
            <button
              type="button"
              data-nearby-entity-interact-btn="true"
              onClick={() => onInteractEntity(nearbyEntity)}
              className="rounded-2xl min-w-[232px] h-10 px-2.5 bg-[#0e121b]/88 hover:bg-[#171d2a] backdrop-blur-xl border border-rose-400/30 shadow-[0_8px_24px_rgba(0,0,0,0.35)] flex items-center text-white font-bold uppercase text-xs tracking-wide cursor-pointer active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-2.5 w-full">
                <span className="w-6 h-6 rounded-full bg-rose-400/20 text-rose-300 flex items-center justify-center shrink-0">
                  <Users className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
                <span className="flex-1 text-left text-rose-300">Interact</span>
              </div>
            </button>
          )}

          {isMerchantEntity && (
            <button
              type="button"
              data-nearby-entity-talk-btn="true"
              onClick={() => onTalkMerchant?.(nearbyEntity)}
              className="rounded-2xl min-w-[232px] h-10 px-2.5 bg-[#0e121b]/88 hover:bg-[#171d2a] backdrop-blur-xl border border-amber-400/30 shadow-[0_8px_24px_rgba(0,0,0,0.35)] flex items-center text-white font-bold uppercase text-xs tracking-wide cursor-pointer active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-2.5 w-full">
                <span className="w-6 h-6 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
                <span className="flex-1 text-left text-amber-300">Talk</span>
              </div>
            </button>
          )}

          {isCitizenNpcEntity && nearbyEntity && (
            <button
              type="button"
              data-nearby-citizen-talk-btn="true"
              onClick={() => onTalkCitizen?.(nearbyEntity)}
              className="rounded-2xl min-w-[232px] h-10 px-2.5 bg-[#0e121b]/88 hover:bg-[#171d2a] backdrop-blur-xl border border-amber-400/30 shadow-[0_8px_24px_rgba(0,0,0,0.35)] flex items-center text-white font-bold uppercase text-xs tracking-wide cursor-pointer active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-2.5 w-full">
                <span className="w-6 h-6 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
                <span className="flex-1 text-left text-amber-300">Talk</span>
              </div>
            </button>
          )}

          {isWhisperablePlayer && (
            <button
              type="button"
              data-nearby-entity-whisper-btn="true"
              onClick={() => onWhisperEntity?.(nearbyEntity)}
              className="rounded-2xl min-w-[232px] h-10 px-2.5 bg-[#0e121b]/88 hover:bg-[#171d2a] backdrop-blur-xl border border-emerald-400/30 shadow-[0_8px_24px_rgba(0,0,0,0.35)] flex items-center text-white font-bold uppercase text-xs tracking-wide cursor-pointer active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-2.5 w-full">
                <span className="w-6 h-6 rounded-full bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
                <span className="flex-1 text-left text-emerald-300">Talk</span>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Unified Primary Trigger Bar: Nearby Entity OR Work Shift OR Sit / Stand Up */}
      {isNearbyEntityMode && nearbyEntity ? (
        <div
          role="button"
          tabIndex={0}
          data-target-name-bar="true"
          data-nearby-entity-bar={String(nearbyEntity.id)}
          onClick={() => {
            soundEngine.playUiClick();
            onToggleEntityMenu?.();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              soundEngine.playUiClick();
              onToggleEntityMenu?.();
            }
          }}
          className="rounded-full inline-flex items-center h-11 min-w-[232px] max-w-[300px] bg-[#0e121b]/88 backdrop-blur-xl border border-white/15 shadow-[0_12px_32px_rgba(0,0,0,0.4)] px-2 text-white cursor-pointer hover:bg-[#171d2a] active:scale-95 transition-all"
        >
          <div className="flex items-center justify-between gap-2.5 w-full min-w-0">
            <span className="w-7 h-7 bg-sky-400/20 text-sky-300 border border-white/15 rounded-full flex items-center justify-center overflow-hidden shrink-0 font-bold text-xs">
              {(() => {
                const npcCid = resolveNpcCitizenIdFromEntity(nearbyEntity);
                if (npcCid) {
                  return (
                    <img
                      src={resolveNpcPhotoUrl(npcCid, 'avatar')}
                      alt={cleanEntityName}
                      className="w-full h-full object-cover object-center"
                    />
                  );
                }
                if (isFemaleNpcPortrait) {
                  return (
                    <img
                      src="/assets/avatar_nadia.jpg"
                      alt={cleanEntityName}
                      className="w-full h-full object-cover"
                    />
                  );
                }
                if (nearbyEntity.isNpc) {
                  return (
                    <img
                      src="/assets/avatar_hiro.jpg"
                      alt={cleanEntityName}
                      className="w-full h-full object-cover"
                    />
                  );
                }
                return <span>{cleanEntityName.slice(0, 1).toUpperCase()}</span>;
              })()}
            </span>

            <span className="flex-1 text-center font-bold text-[13px] tracking-wide uppercase text-white truncate whitespace-nowrap px-1">
              {cleanEntityName}
            </span>

            {canCycleNearbyEntity ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  soundEngine.playUiClick();
                  onCycleNearbyEntity?.();
                }}
                title="Switch Target"
                aria-label="Next Target"
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-amber-300 flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer transition-colors"
              >
                &gt;
              </button>
            ) : (
              <span className="w-7 h-7 rounded-full bg-white/10 text-amber-300 flex items-center justify-center font-bold text-xs shrink-0">
                {isEntityMenuExpanded ? '▾' : '▸'}
              </span>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          data-cafe-giliran-kerja-bar={isWorkShiftMode ? 'true' : undefined}
          data-bottom-sit-action-btn={!isWorkShiftMode ? 'true' : undefined}
          onClick={isWorkShiftMode ? onToggleExpand : onTriggerSitOrStand}
          className="rounded-full inline-flex items-center h-11 min-w-[232px] bg-[#f6f4f0]/95 hover:bg-white backdrop-blur-xl border border-white/80 shadow-[0_12px_32px_rgba(15,23,42,0.2)] px-2 text-slate-900 cursor-pointer active:scale-95 transition-all"
        >
          <div className="flex items-center justify-between gap-2.5 w-full">
            {isWorkShiftMode ? (
              <>
                <span className="w-7 h-7 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center shrink-0">
                  <ClipboardList className="w-4 h-4" aria-hidden="true" />
                </span>

                <span className="flex-1 text-center font-bold text-[13px] tracking-wide uppercase text-slate-900 whitespace-nowrap">
                  Work Shift
                  {isSelfInQueue ? ` (#${selfQueueNumber})` : ''}
                </span>

                <span className="w-7 h-7 rounded-full bg-stone-200/80 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                  {isExpanded ? '▾' : '▸'}
                </span>
              </>
            ) : (
              <>
                <span className="w-7 h-7 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center shrink-0">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M7 4v9h10" />
                    <path d="M7 13v7" />
                    <path d="M17 13v7" />
                    <path d="M7 16h10" />
                  </svg>
                </span>

                <span className="flex-1 text-center font-bold text-[13px] tracking-wide uppercase text-slate-900 whitespace-nowrap">
                  {resolvedMode === 'stand_up' ? 'Stand Up' : 'Sit'}
                </span>

                <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                  ▸
                </span>
              </>
            )}
          </div>
        </button>
      )}
    </aside>
  );
};

export interface GlasshouseCafeRotaModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftState: CafeWorkShiftState;
  playerName: string;
  onStartOrQueueShift: () => void;
  onLeaveShiftQueue: () => void;
  onToggleSimulatedWorker: () => void;
}

export const GlasshouseCafeRotaModal: React.FC<GlasshouseCafeRotaModalProps> = ({
  isOpen,
  onClose,
  shiftState,
  playerName,
  onStartOrQueueShift,
  onLeaveShiftQueue,
  onToggleSimulatedWorker,
}) => {
  if (!isOpen) return null;

  const hasOtherActiveWorker = Boolean(shiftState.otherActiveWorker);
  const queueList = shiftState.shiftQueue ?? [];
  const selfQueueIndex = queueList.findIndex((entry) => entry.isSelf);
  const isSelfInQueue = selfQueueIndex >= 0;

  const activeWorkerName = shiftState.isWorking
    ? `${playerName || 'YOU'} (YOU)`
    : shiftState.otherActiveWorker
      ? shiftState.otherActiveWorker.name
      : null;
  const activeOrdersServed = shiftState.isWorking
    ? shiftState.ordersCompletedInShift
    : shiftState.otherActiveWorker
      ? shiftState.otherActiveWorker.ordersServed
      : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="CAFE WORK ROTA"
      data-cafe-rota-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm pointer-events-auto"
    >
      <div className="w-full max-w-md rounded-[26px] bg-[#f6f4f0]/96 backdrop-blur-2xl border border-white/80 shadow-[0_24px_64px_rgba(15,23,42,0.28)] text-slate-900 overflow-hidden select-none">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-amber-50/90 via-[#f6f4f0] to-stone-100/80 border-b border-stone-200/80">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
              <ClipboardList className="w-4 h-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-tight leading-tight text-slate-900">
                CAFE WORK ROTA
              </h2>
              <p className="text-[11px] font-medium text-stone-500">
                1 Round = {CAFE_SHIFT_MAX_ORDERS}x Serves · Re-register After Shift
              </p>
            </div>
          </div>
          <button
            type="button"
            data-cafe-rota-close-btn="true"
            onClick={() => {
              soundEngine.playUiCancel();
              onClose();
            }}
            aria-label="Close Work Rota"
            className="w-8 h-8 rounded-full bg-white hover:bg-stone-100 text-slate-600 hover:text-slate-900 border border-stone-200/80 shadow-xs flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-3.5">
          {/* Active Worker Card (1 Round = 3 Serves) */}
          <div className="p-3.5 bg-white border border-stone-200/80 shadow-sm rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-amber-800">
                CURRENT ACTIVE BARISTA
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-[10px] font-mono-tabular font-bold text-emerald-700">
                ROUND {activeOrdersServed}/{CAFE_SHIFT_MAX_ORDERS} SERVES
              </span>
            </div>

            {activeWorkerName ? (
              <div className="flex items-center justify-between gap-2 bg-[#f6f4f0] border border-stone-200/70 px-3 py-2 rounded-xl">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[9.5px] shrink-0">
                    ON
                  </span>
                  <span className="text-xs font-bold uppercase text-slate-900 truncate">
                    {activeWorkerName}
                  </span>
                </div>

                {/* 3-Serve Round Progress Indicators */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {[1, 2, 3].map((step) => {
                    const done = activeOrdersServed >= step;
                    return (
                      <span
                        key={step}
                        className={`w-6 h-6 rounded-full font-mono-tabular font-bold text-[10px] flex items-center justify-center ${
                          done
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'bg-stone-200/90 text-stone-500'
                        }`}
                      >
                        {step}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="px-3 py-2.5 bg-[#f6f4f0] border border-dashed border-stone-300 rounded-xl text-center text-xs font-medium text-stone-500">
                No barista currently working. Shift slot is open!
              </div>
            )}
          </div>

          {/* Queue List */}
          <div className="p-3.5 bg-white border border-stone-200/80 shadow-sm rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-amber-800">
                UPCOMING SHIFT QUEUE ({queueList.length})
              </span>
              {!shiftState.isWorking && (
                <button
                  type="button"
                  data-cafe-rota-simulate-worker-btn="true"
                  onClick={onToggleSimulatedWorker}
                  className="px-2.5 py-1 rounded-full bg-stone-100 hover:bg-stone-200 text-slate-700 border border-stone-200/80 text-[9.5px] font-bold uppercase cursor-pointer transition-colors"
                >
                  {hasOtherActiveWorker ? 'Clear Active Worker' : 'Simulate Busy Shift'}
                </button>
              )}
            </div>

            {queueList.length === 0 ? (
              <div className="px-3 py-2.5 bg-[#f6f4f0] rounded-xl text-center text-[11px] font-medium text-stone-500">
                No one waiting in the queue.
              </div>
            ) : (
              <div className="space-y-1.5">
                {queueList.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border ${
                      entry.isSelf
                        ? 'bg-sky-50 border-sky-200 text-sky-900'
                        : 'bg-[#f6f4f0] border-stone-200/70 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-mono-tabular font-bold text-[10px]">
                        #{idx + 1}
                      </span>
                      <span className="text-xs font-bold uppercase">{entry.name}</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase text-stone-500">
                      {entry.isSelf ? 'IN QUEUE' : 'READY'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Primary Action Button */}
          {!shiftState.isWorking && (
            <div className="pt-1">
              {!hasOtherActiveWorker ? (
                <button
                  type="button"
                  data-cafe-rota-modal-start-btn="true"
                  onClick={() => {
                    onStartOrQueueShift();
                    onClose();
                  }}
                  className="w-full py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-bold text-xs uppercase tracking-wider cursor-pointer active:scale-[0.98] transition-all"
                >
                  START WORK (1 ROUND = {CAFE_SHIFT_MAX_ORDERS} SERVES)
                </button>
              ) : !isSelfInQueue ? (
                <button
                  type="button"
                  data-cafe-rota-modal-queue-btn="true"
                  onClick={onStartOrQueueShift}
                  className="w-full py-2.5 rounded-full bg-sky-600 hover:bg-sky-700 text-white shadow-sm font-bold text-xs uppercase tracking-wider cursor-pointer active:scale-[0.98] transition-all"
                >
                  JOIN SHIFT QUEUE (#{queueList.length + 1})
                </button>
              ) : (
                <button
                  type="button"
                  data-cafe-rota-modal-leave-queue-btn="true"
                  onClick={onLeaveShiftQueue}
                  className="w-full py-2.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-sm font-bold text-xs uppercase tracking-wider cursor-pointer active:scale-[0.98] transition-all"
                >
                  QUEUED AT #{selfQueueIndex + 1} · CLICK TO LEAVE
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export interface CafeOrderSlideBannerProps {
  isVisible: boolean;
  activeOrder: CafeActiveCustomerOrder | null;
  onOpenOrderDetails: () => void;
}

export const CafeOrderSlideBanner: React.FC<CafeOrderSlideBannerProps> = ({
  isVisible,
  activeOrder,
  onOpenOrderDetails,
}) => {
  if (!activeOrder) return null;

  return (
    <div
      data-cafe-order-slide-banner="true"
      data-banner-visible={isVisible ? 'true' : 'false'}
      className={`fixed top-3 left-3 z-40 transition-all duration-300 ease-out select-none ${
        isVisible
          ? 'translate-x-0 opacity-100 pointer-events-auto'
          : '-translate-x-[120%] opacity-0 pointer-events-none'
      }`}
    >
      <button
        type="button"
        onClick={onOpenOrderDetails}
        className="flex items-center gap-3 bg-[#f6f4f0]/95 hover:bg-white backdrop-blur-xl text-slate-900 border border-white/80 shadow-[0_14px_36px_rgba(15,23,42,0.2)] px-4 py-2.5 rounded-2xl max-w-[330px] text-left cursor-pointer active:scale-95 transition-all"
      >
        <span className="w-10 h-10 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-center shrink-0">
          <Coffee className="w-5 h-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-[13px] font-bold leading-snug text-slate-900">
            You received an order from{' '}
            <span className="text-emerald-700 font-extrabold">{activeOrder.customerName}</span>!
          </p>
          <p className="text-[10.5px] font-medium text-stone-500 truncate mt-0.5">
            Click to view order details ({activeOrder.orderNumber}/{activeOrder.maxOrdersInShift})
          </p>
        </div>
      </button>
    </div>
  );
};

export interface CafeOrderNotificationBellButtonProps {
  isVisible: boolean;
  hasUnread: boolean;
  shiftState: CafeWorkShiftState;
  shiftRemainingSeconds: number;
  onOpenOrderDetails: () => void;
}

export const CafeOrderNotificationBellButton: React.FC<CafeOrderNotificationBellButtonProps> = ({
  isVisible,
  hasUnread,
  shiftState,
  shiftRemainingSeconds,
  onOpenOrderDetails,
}) => {
  if (!isVisible || !shiftState.isWorking || !shiftState.activeOrder) return null;

  const clampedSec = Math.max(0, Math.floor(shiftRemainingSeconds));
  const mm = String(Math.floor(clampedSec / 60)).padStart(2, '0');
  const ss = String(clampedSec % 60).padStart(2, '0');
  const isLowTime = clampedSec <= 20;

  return (
    <>
      {/* Compact Top-Center Shift Progress Pills (Serve Counter 0/3 + 02:00 Countdown) */}
      <div
        data-cafe-shift-top-pills="true"
        className="fixed top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 pointer-events-none select-none"
      >
        <div className="px-3.5 py-1.5 rounded-full bg-[#f6f4f0]/95 backdrop-blur-xl text-slate-900 border border-white/80 shadow-[0_8px_24px_rgba(15,23,42,0.16)] flex items-center gap-1.5 text-xs font-bold font-mono-tabular">
          <Coffee className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
          <span>
            {shiftState.ordersCompletedInShift}/{shiftState.maxOrdersInShift}
          </span>
        </div>
        <div
          data-cafe-shift-countdown="true"
          className={`px-3.5 py-1.5 rounded-full backdrop-blur-xl border shadow-[0_8px_24px_rgba(15,23,42,0.16)] flex items-center gap-1.5 text-xs font-bold font-mono-tabular ${
            isLowTime
              ? 'bg-rose-50/95 border-rose-300 text-rose-700'
              : 'bg-[#f6f4f0]/95 border-white/80 text-slate-900'
          }`}
        >
          <Clock
            className={`w-3.5 h-3.5 ${isLowTime ? 'text-rose-600' : 'text-sky-600'}`}
            aria-hidden="true"
          />
          <span>
            {mm}:{ss}
          </span>
        </div>
      </div>

      {/* Left-Side Order Notification Bell Icon */}
      <div className="fixed left-3 top-[38%] -translate-y-1/2 z-40 pointer-events-auto select-none">
        <button
          type="button"
          data-cafe-order-notif-bell-btn="true"
          onClick={onOpenOrderDetails}
          title="View Customer Order"
          aria-label="View Customer Order"
          className={`relative w-11 h-11 bg-[#f6f4f0]/95 hover:bg-white backdrop-blur-xl text-slate-900 border ${
            hasUnread ? 'border-emerald-400 ring-2 ring-emerald-400/40' : 'border-white/80'
          } shadow-[0_12px_28px_rgba(15,23,42,0.2)] rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-all`}
        >
          <Bell
            className={`w-5 h-5 text-amber-800 ${hasUnread ? 'bb-bell-ring' : ''}`}
            aria-hidden="true"
          />
          <span
            data-cafe-order-notif-badge="true"
            className={`absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-emerald-500 text-white rounded-full font-mono-tabular font-bold text-[10px] flex items-center justify-center shadow-sm ${hasUnread ? 'animate-pulse' : ''}`}
          >
            1
          </span>
        </button>
      </div>
    </>
  );
};

export interface GlasshouseCafeOrderNotificationModalProps {
  isOpen: boolean;
  activeOrder: CafeActiveCustomerOrder | null;
  onClose: () => void;
}

export const GlasshouseCafeOrderNotificationModal: React.FC<
  GlasshouseCafeOrderNotificationModalProps
> = ({ isOpen, activeOrder, onClose }) => {
  if (!isOpen || !activeOrder) return null;

  const stationLabel =
    activeOrder.item.category === 'pastry'
      ? 'Pastry Display (Right Side of Counter)'
      : 'Drink Machine (Left Side of Counter)';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Customer Order Details"
      data-cafe-order-notification-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm pointer-events-auto select-none"
    >
      <div className="relative w-full max-w-md rounded-[26px] bg-[#f6f4f0]/96 backdrop-blur-2xl border border-white/80 shadow-[0_24px_64px_rgba(15,23,42,0.28)] text-slate-900 overflow-hidden px-6 py-6 text-center">
        {/* Close Button (Top Right) */}
        <button
          type="button"
          data-cafe-order-notif-close-btn="true"
          onClick={() => {
            soundEngine.playUiCancel();
            onClose();
          }}
          aria-label="Close Order Details"
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white hover:bg-stone-100 text-slate-600 hover:text-slate-900 border border-stone-200/80 shadow-xs flex items-center justify-center cursor-pointer active:scale-95 transition-all"
        >
          <X className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
        </button>

        {/* Header Title */}
        <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-emerald-700">
          YOU RECEIVED AN ORDER FROM
        </h2>

        {/* Centered Framed Item Card with Customer Name */}
        <div className="mt-3.5 mx-auto w-42 h-42 bg-white border border-stone-200/80 shadow-sm rounded-2xl flex flex-col items-center justify-between p-3.5">
          <span className="text-xs font-bold text-slate-900 tracking-wide truncate max-w-full">
            {activeOrder.customerName}
          </span>
          <div className="my-auto flex items-center justify-center">
            <CafeMenuItemArtwork
              itemId={activeOrder.item.id}
              className="w-24 h-24 drop-shadow-sm"
            />
          </div>
        </div>

        {/* Item Name */}
        <div className="mt-4 text-base sm:text-lg font-extrabold uppercase tracking-tight text-slate-900">
          {activeOrder.item.name}
        </div>

        {/* Subtle Accent Divider Line */}
        <div className="mt-2.5 mx-auto w-32 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent rounded-full" />

        {/* Item Description & Station Hint */}
        <p className="mt-3 text-xs font-medium text-stone-600 leading-relaxed">
          {activeOrder.item.prepHint}
        </p>

        <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200/80 text-[10.5px] font-bold uppercase text-amber-900">
          <span>Prepare at: {stationLabel}</span>
        </div>

        {/* Bottom Counter (e.g. (1/3)) */}
        <div className="mt-4 text-xs font-bold font-mono-tabular text-stone-500">
          ({activeOrder.orderNumber}/{activeOrder.maxOrdersInShift})
        </div>
      </div>
    </div>
  );
};

export interface GlasshouseCafePrepModalProps {
  isOpen: boolean;
  category: 'pastry' | 'drink';
  onClose: () => void;
  onPrepareItem: (item: CafeMenuItemSpec) => { ok: boolean; message: string };
}

export const GlasshouseCafePrepModal: React.FC<GlasshouseCafePrepModalProps> = ({
  isOpen,
  category,
  onClose,
  onPrepareItem,
}) => {
  const [selectedId, setSelectedId] = useState<CafeMenuItemSpec['id'] | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  if (!isOpen) return null;

  const groupItems = CAFE_MENU_ITEMS.filter((it) => it.category === category);
  const selectedItem = groupItems.find((it) => it.id === selectedId) ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="SELECT AN ITEM"
      data-cafe-prep-modal="true"
      data-cafe-prep-category={category}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/45 backdrop-blur-sm pointer-events-auto select-none"
    >
      <div className="w-full max-w-[680px] rounded-[26px] bg-[#f6f4f0]/96 backdrop-blur-2xl border border-white/80 shadow-[0_24px_64px_rgba(15,23,42,0.28)] text-slate-900 overflow-hidden">
        {/* Header */}
        <div className="relative flex items-center justify-center px-5 py-4 bg-gradient-to-r from-amber-50/90 via-[#f6f4f0] to-stone-100/80 border-b border-stone-200/80">
          <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-slate-900 text-center">
            SELECT AN ITEM
          </h2>
          <button
            type="button"
            data-cafe-prep-close-btn="true"
            onClick={() => {
              soundEngine.playUiCancel();
              setSelectedId(null);
              setFeedback(null);
              onClose();
            }}
            aria-label="Close"
            className="absolute right-4 w-8 h-8 rounded-full bg-white hover:bg-stone-100 text-slate-600 hover:text-slate-900 border border-stone-200/80 shadow-xs flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
          </button>
        </div>

        {/* 2-Column Layout */}
        <div className="p-5 grid grid-cols-1 sm:grid-cols-12 gap-4">
          {/* Left Item Grid (Filtered by Pastry Display 'pastry' or Drink Machine 'drink') */}
          <div className="sm:col-span-7 flex flex-col justify-between min-h-[250px]">
            <div className="grid grid-cols-4 gap-2.5 content-start">
              {groupItems.map((item) => {
                const isSelected = item.id === selectedId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-cafe-prep-item={item.id}
                    onClick={() => {
                      soundEngine.playUiClick();
                      setSelectedId(item.id);
                      setFeedback(null);
                    }}
                    aria-label={item.name}
                    className={`aspect-square flex items-center justify-center p-2 rounded-2xl border transition-all cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-400/40 -translate-y-0.5 shadow-md'
                        : 'bg-white hover:bg-stone-50 border-stone-200/80 shadow-sm hover:shadow'
                    }`}
                  >
                    <CafeMenuItemArtwork
                      itemId={item.id}
                      className="w-13 h-13 drop-shadow-sm"
                    />
                  </button>
                );
              })}
            </div>

            {/* Bottom Page Dot Indicator */}
            <div className="pt-3 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-amber-600" />
            </div>
          </div>

          {/* Right Detail Panel */}
          <div className="sm:col-span-5 bg-white text-slate-900 border border-stone-200/80 shadow-sm rounded-2xl p-4 flex flex-col items-center justify-between text-center min-h-[250px]">
            {!selectedItem ? (
              <div className="my-auto px-3">
                <p className="text-xs sm:text-sm font-semibold text-stone-500 leading-relaxed">
                  Select an item to view its details
                </p>
              </div>
            ) : (
              <>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-amber-700">
                  {category === 'pastry' ? 'PASTRY DISPLAY' : 'DRINK MACHINE'}
                </div>

                <div className="my-2 p-3 bg-[#f6f4f0] border border-stone-200/70 rounded-2xl">
                  <CafeMenuItemArtwork itemId={selectedItem.id} className="w-24 h-24" />
                </div>

                <div className="space-y-1 mb-2.5">
                  <div className="text-sm font-extrabold uppercase text-slate-900">
                    {selectedItem.name}
                  </div>
                  <div className="text-xs font-medium text-stone-500">
                    {selectedItem.prepHint}
                  </div>
                </div>

                {feedback && (
                  <div
                    data-cafe-prep-feedback="true"
                    className={`w-full mb-2.5 px-3 py-1.5 rounded-xl border text-[11px] font-semibold ${
                      feedback.ok
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    {feedback.text}
                  </div>
                )}

                <button
                  type="button"
                  data-cafe-prep-submit-btn="true"
                  onClick={() => {
                    soundEngine.playUiConfirm();
                    const res = onPrepareItem(selectedItem);
                    if (!res.ok) {
                      setFeedback({ ok: false, text: res.message });
                    } else {
                      setSelectedId(null);
                      setFeedback(null);
                    }
                  }}
                  className="w-full py-2.5 rounded-full bg-amber-700 hover:bg-amber-800 text-white shadow-sm font-bold text-xs uppercase tracking-wider cursor-pointer active:scale-[0.98] transition-all"
                >
                  PREPARE
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};



