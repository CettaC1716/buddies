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
} from 'lucide-react';
import {
  CAFE_MENU_ITEMS,
  CAFE_SHIFT_MAX_ORDERS,
  type CafeActiveCustomerOrder,
  type CafeMenuItemSpec,
  type CafeWorkShiftState,
  type PlayerLevelProgress,
} from '../game/buddiesCafeRules';
import { CafeMenuItemArtwork } from './GlasshouseCafeMenuArtwork';
import { soundEngine } from '../game/audio';

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
      className="pointer-events-auto flex flex-col gap-1.5 bg-[#14161d] text-white border-[3px] border-[#14161d] ring-2 ring-white shadow-[4px_4px_0_#14161d] px-2.5 py-2 rounded-xl min-w-[205px] max-w-[245px] select-none"
    >
      <div className="flex items-center gap-2">
        <div
          data-testid="hud-player-level"
          className="w-9 h-9 shrink-0 rounded-lg bg-[#38bdf8] border-2 border-black shadow-[2px_2px_0_#000] flex flex-col items-center justify-center text-[#0f172a]"
        >
          <span className="text-[8px] font-black leading-none tracking-wider">LV</span>
          <span className="text-base font-black font-mono-tabular leading-none">
            {levelProgress.level}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-black uppercase tracking-wide truncate text-white">
              {playerName || 'CITIZEN'}
            </span>
            {isWorkingShift && (
              <span className="px-1.5 py-0.5 bg-[#b8ff3c] text-[#14161d] border border-black text-[8px] font-black uppercase tracking-wider leading-none shrink-0">
                BARISTA
              </span>
            )}
          </div>

          <div className="mt-1 relative w-full h-3 bg-[#090b10] border-2 border-black rounded-sm overflow-hidden">
            <div
              data-testid="hud-player-xp-fill"
              className="h-full bg-[#b8ff3c] transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[8.5px] font-black font-mono-tabular text-white drop-shadow-[0_1px_1px_#000]">
              {levelProgress.currentLevelXp}/{levelProgress.xpForNextLevel} XP
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <div
          data-testid="hud-player-lul"
          className="flex-1 px-2 py-0.5 bg-[#fec83e] text-[#14161d] border-2 border-black rounded font-mono-tabular font-black text-[10px] flex items-center justify-between"
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
      <div className="flex flex-wrap items-center justify-center gap-1.5 bg-[#14161d] text-white border-[3px] border-black ring-2 ring-white shadow-[4px_4px_0_#000] px-3 py-1.5 rounded-xl">
        <span className="px-2 py-0.5 bg-[#b8ff3c] text-[#14161d] border border-black text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
          <Coffee className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
          GLASSHOUSE CAFE
        </span>

        {!shiftState.isWorking ? (
          <>
            <button
              type="button"
              data-cafe-start-shift-btn="true"
              onClick={onStartWorkShift}
              className="px-2.5 py-1 bg-[#4ade80] hover:bg-[#86efac] text-[#052e16] border-2 border-black text-[10.5px] font-black uppercase cursor-pointer"
            >
              WORK SHIFT
            </button>
            <button
              type="button"
              data-cafe-open-menu-btn="true"
              onClick={onOpenOrderModal}
              className="px-2.5 py-1 bg-[#38bdf8] hover:bg-[#7dd3fc] text-[#0f172a] border-2 border-black text-[10.5px] font-black uppercase cursor-pointer"
            >
              ORDER MENU
            </button>
            <button
              type="button"
              data-cafe-open-atm-btn="true"
              onClick={onOpenAtmModal}
              className="px-2.5 py-1 bg-[#facc15] hover:bg-[#fde047] text-[#14161d] border-2 border-black text-[10.5px] font-black uppercase cursor-pointer"
            >
              ATM
            </button>
          </>
        ) : (
          <>
            <span className="px-2 py-0.5 bg-[#22c55e] text-white border border-black text-[10px] font-black uppercase">
              SHIFT {shiftState.ordersCompletedInShift}/{shiftState.maxOrdersInShift}
            </span>
            <button
              type="button"
              data-cafe-stop-shift-btn="true"
              onClick={onStopWorkShift}
              className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white border-2 border-black text-[10px] font-black uppercase cursor-pointer"
            >
              END SHIFT
            </button>
          </>
        )}

        <button
          type="button"
          data-cafe-exit-btn="true"
          onClick={onExitCafe}
          className="px-2.5 py-1 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black text-[10.5px] font-black uppercase flex items-center gap-1 cursor-pointer"
        >
          <LogOut className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
          EXIT
        </button>
      </div>

      {/* Active Customer Order Card while working as BARISTA */}
      {shiftState.isWorking && shiftState.activeOrder && (
        <div
          data-cafe-active-order-card="true"
          className="flex items-center gap-2.5 bg-white text-[#14161d] border-[3px] border-black shadow-[4px_4px_0_#000] px-3 py-1.5 rounded-xl"
        >
          <div className="w-10 h-10 bg-[#0f172a] border-2 border-black rounded-lg flex items-center justify-center shrink-0">
            <CafeMenuItemArtwork itemId={shiftState.activeOrder.item.id} className="w-8 h-8" />
          </div>
          <div className="min-w-[120px]">
            <div className="text-[9px] font-black uppercase text-emerald-700 tracking-wider leading-none">
              ORDER FOR {shiftState.activeOrder.customerName}
            </div>
            <div className="text-xs font-black uppercase text-[#14161d] leading-tight mt-0.5">
              {shiftState.activeOrder.item.name}
            </div>
            <div className="text-[10px] font-black text-amber-600 font-mono-tabular">
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
            className="px-3 py-2 bg-[#b8ff3c] hover:bg-[#d9f99d] text-[#14161d] border-2 border-black shadow-[2px_2px_0_#000] text-xs font-black uppercase cursor-pointer active:translate-y-0.5"
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
  onPurchaseItem: (item: CafeMenuItemSpec) => { ok: boolean; message: string };
}

export const GlasshouseCafeOrderModal: React.FC<GlasshouseCafeOrderModalProps> = ({
  isOpen,
  onClose,
  lulBalance,
  levelProgress,
  onPurchaseItem,
}) => {
  const [selectedId, setSelectedId] = useState<CafeMenuItemSpec['id'] | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  if (!isOpen) return null;

  const selectedItem = CAFE_MENU_ITEMS.find((it) => it.id === selectedId) ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ORDER SOMETHING"
      data-cafe-order-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 pointer-events-auto"
    >
      <div className="w-full max-w-[680px] bg-[#14161d] text-white border-[4px] border-[#14161d] ring-3 ring-white shadow-[8px_8px_0_#000] rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1e212b] border-b-[3px] border-black">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 bg-[#b8ff3c] text-[#14161d] border-2 border-black text-[10px] font-black uppercase">
              LV {levelProgress.level}
            </span>
            <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-white">
              ORDER SOMETHING
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1 bg-[#fec83e] text-[#14161d] border-2 border-black font-mono-tabular font-black text-xs flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
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
              className="w-8 h-8 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black font-black flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4 stroke-[3]" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* 2-Column Layout: White Body Background + Cream Cards (Header Preserved) */}
        <div className="p-4 bg-white text-[#14161d] grid grid-cols-1 sm:grid-cols-12 gap-3.5">
          {/* Left 3x3 Visual Grid (Cream Cards) */}
          <div className="sm:col-span-7 grid grid-cols-3 gap-2.5">
            {CAFE_MENU_ITEMS.map((item) => {
              const isSelected = item.id === selectedId;
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
                  className={`group flex flex-col items-center justify-between p-2 rounded-xl border-[3px] transition-transform cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'bg-[#eef8d8] border-[#14161d] ring-2 ring-[#b8ff3c] -translate-y-0.5 shadow-[2px_2px_0_#000]'
                      : 'bg-[#f7efe0] hover:bg-[#efe3cc] border-black shadow-[2px_2px_0_#000]'
                  }`}
                >
                  <div className="w-14 h-14 flex items-center justify-center">
                    <CafeMenuItemArtwork itemId={item.id} className="w-13 h-13 drop-shadow-[0_2px_2px_rgba(0,0,0,0.28)]" />
                  </div>
                  <div className="mt-1 w-full py-0.5 px-1.5 bg-[#0f172a] border border-black rounded text-[10.5px] font-black font-mono-tabular text-[#38bdf8] flex items-center justify-center gap-1">
                    <span>◆</span>
                    <span>{item.priceLul}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Detail Panel (Cream Card) */}
          <div className="sm:col-span-5 bg-[#f7efe0] text-[#14161d] border-[3px] border-black shadow-[3px_3px_0_#000] rounded-xl p-3.5 flex flex-col items-center justify-between text-center min-h-[260px]">
            {!selectedItem ? (
              <div className="my-auto px-2">
                <p className="text-xs font-extrabold text-[#14161d] leading-relaxed">
                  Select an item to view XP info &amp; purchase it
                </p>
              </div>
            ) : (
              <>
                <div className="w-full flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-[#b8ff3c] text-[#14161d] border border-black text-[10px] font-black uppercase">
                    +{selectedItem.xpReward} XP
                  </span>
                  <span className="px-2 py-0.5 bg-[#fec83e] text-[#14161d] border border-black text-[10px] font-black font-mono-tabular">
                    {selectedItem.priceLul} LUL
                  </span>
                </div>

                <div className="my-2 p-2.5 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0_#000]">
                  <CafeMenuItemArtwork itemId={selectedItem.id} className="w-24 h-24" />
                </div>

                <div className="space-y-0.5 mb-2">
                  <div className="text-sm font-black uppercase text-[#14161d]">
                    {selectedItem.name}
                  </div>
                  <div className="text-[11px] font-bold text-slate-600">
                    {selectedItem.prepHint}
                  </div>
                </div>

                {feedback && (
                  <div
                    data-cafe-order-feedback="true"
                    className={`w-full mb-2 px-2 py-1 border-2 border-black text-[10.5px] font-black ${
                      feedback.ok
                        ? 'bg-[#dcfce7] text-emerald-950'
                        : 'bg-[#fee2e2] text-red-900'
                    }`}
                  >
                    {feedback.text}
                  </div>
                )}

                <button
                  type="button"
                  data-cafe-buy-selected-btn="true"
                  onClick={() => {
                    soundEngine.playUiConfirm();
                    const res = onPurchaseItem(selectedItem);
                    setFeedback({ ok: res.ok, text: res.message });
                  }}
                  className="w-full py-2.5 bg-[#b8ff3c] hover:bg-[#d9f99d] text-[#14161d] border-[3px] border-black shadow-[3px_3px_0_#000] font-black text-xs uppercase tracking-wider cursor-pointer active:translate-y-0.5"
                >
                  ORDER ({selectedItem.priceLul} LUL)
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 pointer-events-auto"
    >
      <div className="w-full max-w-sm bg-[#14161d] text-white border-[4px] border-[#14161d] ring-3 ring-white shadow-[8px_8px_0_#000] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-[#1e212b] border-b-[3px] border-black">
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4 text-[#facc15]" aria-hidden="true" />
            <h2 className="text-sm font-black uppercase tracking-wider">CAFE ATM · EXCHANGE</h2>
          </div>
          <button
            type="button"
            data-cafe-atm-close-btn="true"
            onClick={() => {
              soundEngine.playUiCancel();
              onClose();
            }}
            aria-label="Close ATM"
            className="w-7 h-7 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black font-black flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[3]" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 space-y-3 bg-white text-slate-900">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-2.5 bg-[#1b1f29] border-2 border-black rounded-xl text-center shadow-[3px_3px_0_#000]">
              <div className="text-[9.5px] font-black uppercase text-[#fec83e]">LUL BALANCE</div>
              <div
                data-atm-lul-balance="true"
                className="text-xl font-black font-mono-tabular text-[#fec83e] mt-0.5"
              >
                {lulBalance}
              </div>
            </div>
            <div className="p-2.5 bg-[#1b1f29] border-2 border-black rounded-xl text-center shadow-[3px_3px_0_#000]">
              <div className="text-[9.5px] font-black uppercase text-[#38bdf8]">CYON BALANCE</div>
              <div
                data-atm-cyon-balance="true"
                className="text-xl font-black font-mono-tabular text-[#38bdf8] mt-0.5"
              >
                {cyonBalance}
              </div>
            </div>
          </div>

          <div className="text-center text-[11px] font-bold text-slate-700">
            Exchange Rate:{' '}
            <span className="inline-block px-1.5 py-0.5 bg-[#b8ff3c] text-black border border-black font-black">
              {rate} LUL = 10 CYON
            </span>{' '}
            · Shop stock: {treasuryCyon} CYON
          </div>

          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
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
              className="min-w-0 flex-1 rounded-xl border-2 border-black px-3 py-2 text-lg font-black outline-none"
            />
            <button
              type="button"
              className="shrink-0 px-4 bg-[#14161d] text-white border-2 border-black shadow-[2px_2px_0_#000] font-black text-xs uppercase cursor-pointer"
              onClick={() => {
                setAmountText(String(maxPackets * rate));
                setFeedback(null);
              }}
            >
              MAX
            </button>
          </div>

          <div className="flex items-center justify-between rounded-xl border-2 border-black px-3 py-2 bg-[#f8fafc]">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              You receive
            </span>
            <span className="text-lg font-black text-[#0284c7]">{receiveCyon} CYON</span>
          </div>
          <p className="text-[11px] font-semibold text-slate-500">
            {packets > 0
              ? `${packets} packet${packets > 1 ? 's' : ''} × ${rate} LUL — exactly ${costLul} LUL will be charged, the rest stays in your balance.`
              : `Enter at least ${rate} LUL to exchange one packet.`}
          </p>

          <button
            type="button"
            disabled={packets < 1}
            data-atm-exchange-btn="true"
            onClick={() => setFeedback(onExchangePackets(packets))}
            className="w-full py-2.5 bg-[#b8ff3c] disabled:bg-slate-200 disabled:text-slate-400 hover:bg-[#d9f99d] text-[#14161d] border-2 border-black shadow-[2px_2px_0_#000] disabled:shadow-none font-black text-xs uppercase cursor-pointer disabled:cursor-not-allowed"
          >
            EXCHANGE
          </button>
          {feedback ? (
            <div
              className={`rounded-xl px-3 py-2 text-center text-xs font-bold border-2 border-black ${
                feedback.ok ? 'bg-[#EAF7EE] text-[#1E7A3C]' : 'bg-[#FDECEA] text-[#B3402A]'
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
      <div className="flex items-center gap-2 bg-[#14161d] text-white border-[3px] border-[#b8ff3c] ring-2 ring-black shadow-[4px_4px_0_#000] px-4 py-2 rounded-xl">
        {banner.leveledUpTo ? (
          <Star className="w-5 h-5 text-[#facc15] fill-[#facc15]" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-[#b8ff3c]" aria-hidden="true" />
        )}
        <span className="text-xs font-black uppercase tracking-wider">
          {banner.leveledUpTo
            ? `LEVEL UP! NOW LV ${banner.leveledUpTo} (+${banner.xpGained} XP)`
            : `${banner.label} · +${banner.xpGained} XP`}
        </span>
      </div>
    </div>
  );
};

export interface CafeWorkShiftBottomDockProps {
  isVisible: boolean;
  isExpanded: boolean;
  shiftState: CafeWorkShiftState;
  onToggleExpand: () => void;
  onOpenRotaModal: () => void;
  onStartOrQueueShift: () => void;
  onLeaveShiftQueue: () => void;
  onOpenAtmModal: () => void;
}

export const CafeWorkShiftBottomDock: React.FC<CafeWorkShiftBottomDockProps> = ({
  isVisible,
  isExpanded,
  shiftState,
  onToggleExpand,
  onOpenRotaModal,
  onStartOrQueueShift,
  onLeaveShiftQueue,
  onOpenAtmModal,
}) => {
  if (!isVisible) return null;

  const hasOtherActiveWorker = Boolean(shiftState.otherActiveWorker);
  const queueList = shiftState.shiftQueue ?? [];
  const selfQueueIndex = queueList.findIndex((entry) => entry.isSelf);
  const isSelfInQueue = selfQueueIndex >= 0;
  const selfQueueNumber = selfQueueIndex + 1;

  return (
    <aside
      aria-label="Cafe Work Shift"
      data-cafe-giliran-kerja-dock="true"
      className="fixed bottom-[70px] left-1/2 -translate-x-1/2 lg:bottom-3 lg:left-[542px] lg:translate-x-0 z-40 flex flex-col items-center lg:items-start gap-1.5 pointer-events-auto select-none"
    >
      {/* Upward Expanded Action Stack */}
      {isExpanded && (
        <div
          data-cafe-giliran-kerja-menu="true"
          className="flex flex-col items-center gap-1.5 mb-1"
        >
          {/* Active Worker Status Strip when someone else is working */}
          {shiftState.otherActiveWorker && (
            <div className="rounded-[10px] min-w-[228px] px-2.5 py-1 bg-[#0b0d13] border-2 border-[#38bdf8] shadow-[3px_3px_0_#000] text-center">
              <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider">
                <span className="text-[#38bdf8] truncate">
                  WORKING: {shiftState.otherActiveWorker.name}
                </span>
                <span className="px-1.5 py-0.5 bg-[#38bdf8] text-[#0b0d13] border border-black font-mono-tabular">
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
            className="rounded-[10px] min-w-[228px] h-10 px-2 bg-[#14161d] hover:bg-[#1e222d] border-2 border-white shadow-[3px_3px_0_#000] flex items-center text-white font-black uppercase text-xs tracking-wider cursor-pointer active:translate-y-0.5"
          >
            <div className="flex items-center gap-2.5 w-full">
              <span className="w-6 h-6 bg-white text-[#0b0d13] border-2 border-black flex items-center justify-center shrink-0">
                <ClipboardList className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
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
              className="rounded-[10px] min-w-[228px] h-10 px-2 bg-[#14161d] hover:bg-[#1e222d] border-2 border-[#b8ff3c] shadow-[3px_3px_0_#000] flex items-center text-white font-black uppercase text-xs tracking-wider cursor-pointer active:translate-y-0.5"
            >
              <div className="flex items-center gap-2.5 w-full">
                <span className="w-6 h-6 bg-[#b8ff3c] text-[#0b0d13] border-2 border-black flex items-center justify-center shrink-0">
                  <UserCheck className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                </span>
                <span className="flex-1 text-left text-[#b8ff3c]">Start Work</span>
                <span className="px-1.5 py-0.5 bg-[#b8ff3c] text-[#0b0d13] border border-black text-[9.5px] font-mono-tabular">
                  0/{CAFE_SHIFT_MAX_ORDERS}
                </span>
              </div>
            </button>
          ) : !isSelfInQueue ? (
            <button
              type="button"
              data-cafe-rota-ikut-antrian-btn="true"
              onClick={onStartOrQueueShift}
              className="rounded-[10px] min-w-[228px] h-10 px-2 bg-[#14161d] hover:bg-[#1e222d] border-2 border-[#38bdf8] shadow-[3px_3px_0_#000] flex items-center text-white font-black uppercase text-xs tracking-wider cursor-pointer active:translate-y-0.5"
            >
              <div className="flex items-center gap-2.5 w-full">
                <span className="w-6 h-6 bg-[#38bdf8] text-[#0b0d13] border-2 border-black flex items-center justify-center shrink-0">
                  <Users className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                </span>
                <span className="flex-1 text-left text-[#38bdf8]">Join Queue</span>
                <span className="px-1.5 py-0.5 bg-[#38bdf8] text-[#0b0d13] border border-black text-[9.5px] font-mono-tabular">
                  #{queueList.length + 1}
                </span>
              </div>
            </button>
          ) : (
            <button
              type="button"
              data-cafe-rota-keluar-antrian-btn="true"
              onClick={onLeaveShiftQueue}
              className="rounded-[10px] min-w-[228px] h-10 px-2 bg-[#14161d] hover:bg-[#1e222d] border-2 border-[#facc15] shadow-[3px_3px_0_#000] flex items-center text-white font-black uppercase text-xs tracking-wider cursor-pointer active:translate-y-0.5"
            >
              <div className="flex items-center gap-2.5 w-full">
                <span className="w-6 h-6 bg-[#facc15] text-[#0b0d13] border-2 border-black flex items-center justify-center shrink-0">
                  <Users className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                </span>
                <span className="flex-1 text-left text-[#facc15]">
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
            className="rounded-[10px] min-w-[228px] h-10 px-2 bg-[#14161d] hover:bg-[#1e222d] border-2 border-white shadow-[3px_3px_0_#000] flex items-center text-white font-black uppercase text-xs tracking-wider cursor-pointer active:translate-y-0.5"
          >
            <div className="flex items-center gap-2.5 w-full">
              <span className="w-6 h-6 bg-[#facc15] text-[#0b0d13] border-2 border-black flex items-center justify-center shrink-0">
                <Zap className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
              </span>
              <span className="flex-1 text-left">ATM · Exchange</span>
            </div>
          </button>
        </div>
      )}

      {/* Bottom Primary Trigger Bar: Work Shift */}
      <button
        type="button"
        data-cafe-giliran-kerja-bar="true"
        onClick={onToggleExpand}
        className="rounded-[10px] inline-flex items-center h-11 min-w-[236px] bg-[#14161d] border-[3px] border-[#14161d] ring-2 ring-white shadow-[4px_4px_0_#14161d] px-2 text-white cursor-pointer hover:brightness-110 active:scale-95 transition-transform"
      >
        <div className="flex items-center justify-between gap-2.5 w-full">
          <span className="w-7 h-7 bg-[#38bdf8] text-[#0b0d13] border-2 border-[#0b0d13] rounded-[6px] shadow-[2px_2px_0_#0b0d13] flex items-center justify-center shrink-0">
            <ClipboardList className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
          </span>

          <span className="flex-1 text-center font-black text-[13px] tracking-wider uppercase text-white whitespace-nowrap">
            Work Shift
            {isSelfInQueue ? ` (#${selfQueueNumber})` : ''}
          </span>

          <span className="min-w-[24px] h-6 px-1.5 bg-[#facc15] text-[#0b0d13] border-2 border-[#0b0d13] rounded-[6px] shadow-[2px_2px_0_#0b0d13] flex items-center justify-center font-black text-xs shrink-0">
            {isExpanded ? '▾' : '▸'}
          </span>
        </div>
      </button>
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 pointer-events-auto"
    >
      <div className="w-full max-w-md bg-[#14161d] text-white border-[4px] border-[#14161d] ring-3 ring-white shadow-[8px_8px_0_#000] rounded-2xl overflow-hidden select-none">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1e212b] border-b-[3px] border-black">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 bg-[#38bdf8] text-[#0b0d13] border-2 border-black flex items-center justify-center">
              <ClipboardList className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider leading-tight">
                CAFE WORK ROTA
              </h2>
              <p className="text-[10px] font-bold text-slate-300">
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
            className="w-7 h-7 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black font-black flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[3]" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 space-y-3.5">
          {/* Active Worker Card (1 Round = 3 Serves) */}
          <div className="p-3 bg-[#1b1f29] border-2 border-black rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#38bdf8]">
                CURRENT ACTIVE BARISTA
              </span>
              <span className="px-2 py-0.5 bg-[#0b0d13] border border-black text-[10px] font-mono-tabular font-black text-[#b8ff3c]">
                ROUND {activeOrdersServed}/{CAFE_SHIFT_MAX_ORDERS} SERVES
              </span>
            </div>

            {activeWorkerName ? (
              <div className="flex items-center justify-between gap-2 bg-[#12151d] border-2 border-black px-3 py-2 rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-6 h-6 bg-[#b8ff3c] text-[#0b0d13] border border-black flex items-center justify-center font-black text-[10px] shrink-0">
                    ON
                  </span>
                  <span className="text-xs font-black uppercase text-white truncate">
                    {activeWorkerName}
                  </span>
                </div>

                {/* 3-Serve Round Progress Indicators */}
                <div className="flex items-center gap-1 shrink-0">
                  {[1, 2, 3].map((step) => {
                    const done = activeOrdersServed >= step;
                    return (
                      <span
                        key={step}
                        className={`w-6 h-6 border-2 border-black font-mono-tabular font-black text-[10px] flex items-center justify-center ${
                          done
                            ? 'bg-[#b8ff3c] text-[#0b0d13]'
                            : 'bg-[#1e222d] text-slate-400'
                        }`}
                      >
                        {step}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="px-3 py-2.5 bg-[#12151d] border-2 border-dashed border-slate-600 rounded-lg text-center text-xs font-bold text-slate-300">
                No barista currently working. Shift slot is open!
              </div>
            )}
          </div>

          {/* Queue List */}
          <div className="p-3 bg-[#1b1f29] border-2 border-black rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#facc15]">
                UPCOMING SHIFT QUEUE ({queueList.length})
              </span>
              {!shiftState.isWorking && (
                <button
                  type="button"
                  data-cafe-rota-simulate-worker-btn="true"
                  onClick={onToggleSimulatedWorker}
                  className="px-2 py-0.5 bg-[#262b38] hover:bg-[#323846] text-slate-200 border border-black text-[9.5px] font-black uppercase cursor-pointer"
                >
                  {hasOtherActiveWorker ? 'Clear Active Worker' : 'Simulate Busy Shift'}
                </button>
              )}
            </div>

            {queueList.length === 0 ? (
              <div className="px-3 py-2 bg-[#12151d] border border-black rounded-lg text-center text-[11px] font-bold text-slate-400">
                No one waiting in the queue.
              </div>
            ) : (
              <div className="space-y-1.5">
                {queueList.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between px-3 py-1.5 border-2 border-black rounded-lg ${
                      entry.isSelf
                        ? 'bg-[#172554] text-[#7dd3fc]'
                        : 'bg-[#12151d] text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-[#facc15] text-[#0b0d13] border border-black font-mono-tabular font-black text-[10px]">
                        #{idx + 1}
                      </span>
                      <span className="text-xs font-black uppercase">{entry.name}</span>
                    </div>
                    <span className="text-[10px] font-black uppercase text-slate-300">
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
                  className="w-full py-2.5 bg-[#b8ff3c] hover:bg-[#d9f99d] text-[#0b0d13] border-[3px] border-black shadow-[3px_3px_0_#000] font-black text-xs uppercase tracking-wider cursor-pointer active:translate-y-0.5"
                >
                  START WORK (1 ROUND = {CAFE_SHIFT_MAX_ORDERS} SERVES)
                </button>
              ) : !isSelfInQueue ? (
                <button
                  type="button"
                  data-cafe-rota-modal-queue-btn="true"
                  onClick={onStartOrQueueShift}
                  className="w-full py-2.5 bg-[#38bdf8] hover:bg-[#7dd3fc] text-[#0b0d13] border-[3px] border-black shadow-[3px_3px_0_#000] font-black text-xs uppercase tracking-wider cursor-pointer active:translate-y-0.5"
                >
                  JOIN SHIFT QUEUE (#{queueList.length + 1})
                </button>
              ) : (
                <button
                  type="button"
                  data-cafe-rota-modal-leave-queue-btn="true"
                  onClick={onLeaveShiftQueue}
                  className="w-full py-2.5 bg-[#facc15] hover:bg-[#fde047] text-[#0b0d13] border-[3px] border-black shadow-[3px_3px_0_#000] font-black text-xs uppercase tracking-wider cursor-pointer active:translate-y-0.5"
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
        className="flex items-center gap-3 bg-[#14161d]/95 hover:bg-[#1e222d] text-white border-[3px] border-[#14161d] ring-2 ring-white shadow-[5px_5px_0_#0b0d13] px-3.5 py-2.5 rounded-r-xl rounded-bl-xl max-w-[330px] text-left cursor-pointer active:scale-95 transition-transform"
      >
        <span className="w-10 h-10 bg-[#38bdf8] text-[#0b0d13] border-2 border-black shadow-[2px_2px_0_#000] rounded-lg flex items-center justify-center shrink-0">
          <Coffee className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-[13px] font-black leading-snug text-white">
            You received an order from{' '}
            <span className="text-[#b8ff3c]">{activeOrder.customerName}</span>!
          </p>
          <p className="text-[10px] font-bold text-slate-300 truncate mt-0.5">
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
        <div className="-skew-x-6 px-3 py-1 bg-[#14161d]/95 text-white border-2 border-white shadow-[3px_3px_0_#000] flex items-center gap-1.5">
          <div className="skew-x-6 flex items-center gap-1.5 text-xs font-black font-mono-tabular">
            <Coffee className="w-3.5 h-3.5 text-[#b8ff3c] stroke-[2.5]" aria-hidden="true" />
            <span>
              {shiftState.ordersCompletedInShift}/{shiftState.maxOrdersInShift}
            </span>
          </div>
        </div>
        <div
          data-cafe-shift-countdown="true"
          className={`-skew-x-6 px-3 py-1 bg-[#14161d]/95 border-2 ${
            isLowTime ? 'border-[#ff3b30] text-[#ff3b30]' : 'border-white text-white'
          } shadow-[3px_3px_0_#000] flex items-center gap-1.5`}
        >
          <div className="skew-x-6 flex items-center gap-1.5 text-xs font-black font-mono-tabular">
            <Clock
              className={`w-3.5 h-3.5 stroke-[2.5] ${
                isLowTime ? 'text-[#ff3b30]' : 'text-[#38bdf8]'
              }`}
              aria-hidden="true"
            />
            <span>
              {mm}:{ss}
            </span>
          </div>
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
          className={`relative w-11 h-11 bg-[#14161d] hover:bg-[#1e222d] text-white border-[3px] border-[#14161d] ring-2 ${
            hasUnread ? 'ring-[#b8ff3c] animate-pulse' : 'ring-white'
          } shadow-[4px_4px_0_#0b0d13] rounded-xl flex items-center justify-center cursor-pointer active:scale-95 transition-transform`}
        >
          <Bell className="w-5 h-5 text-white fill-white/90 stroke-[2.2]" aria-hidden="true" />
          <span
            data-cafe-order-notif-badge="true"
            className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-[#38bdf8] text-[#0b0d13] border-2 border-[#0b0d13] rounded-full font-mono-tabular font-black text-[10px] flex items-center justify-center shadow-[1px_1px_0_#000]"
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 pointer-events-auto select-none"
    >
      <div className="relative w-full max-w-md bg-[#14161d] text-white border-[4px] border-[#14161d] ring-3 ring-white shadow-[8px_8px_0_#000] rounded-2xl overflow-hidden px-5 py-6 text-center">
        {/* Close Button (Top Right) */}
        <button
          type="button"
          data-cafe-order-notif-close-btn="true"
          onClick={() => {
            soundEngine.playUiCancel();
            onClose();
          }}
          aria-label="Close Order Details"
          className="absolute top-3.5 right-3.5 w-8 h-8 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black shadow-[2px_2px_0_#000] font-black flex items-center justify-center rounded-full cursor-pointer active:scale-95"
        >
          <X className="w-4 h-4 stroke-[3]" aria-hidden="true" />
        </button>

        {/* Header Title */}
        <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-[#4ade80]">
          YOU RECEIVED AN ORDER FROM
        </h2>

        {/* Centered Framed Item Card with Customer Name */}
        <div className="mt-3 mx-auto w-40 h-40 bg-[#1b1f29] border-2 border-white/85 shadow-[4px_4px_0_#000] rounded-xl flex flex-col items-center justify-between p-3">
          <span className="text-xs font-black text-white tracking-wide truncate max-w-full">
            {activeOrder.customerName}
          </span>
          <div className="my-auto flex items-center justify-center">
            <CafeMenuItemArtwork
              itemId={activeOrder.item.id}
              className="w-24 h-24 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]"
            />
          </div>
        </div>

        {/* Item Name */}
        <div className="mt-4 text-base sm:text-lg font-black uppercase tracking-wider text-white">
          {activeOrder.item.name}
        </div>

        {/* Green Accent Divider Line */}
        <div className="mt-2.5 mx-auto w-56 h-[3px] bg-[#4ade80] rounded-full" />

        {/* Item Description & Station Hint */}
        <p className="mt-3 text-xs font-bold text-slate-200 leading-relaxed">
          {activeOrder.item.prepHint}
        </p>

        <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 bg-[#1b1f29] border-2 border-black rounded-lg text-[10.5px] font-black uppercase text-[#b8ff3c]">
          <span>Prepare at: {stationLabel}</span>
        </div>

        {/* Bottom Counter (e.g. (1/3)) */}
        <div className="mt-4 text-xs font-black font-mono-tabular text-slate-300">
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 pointer-events-auto select-none"
    >
      <div className="w-full max-w-[660px] bg-[#14161d] text-white border-[4px] border-[#14161d] ring-3 ring-white shadow-[8px_8px_0_#000] rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="relative flex items-center justify-center px-4 py-3.5 bg-[#1e212b] border-b-[3px] border-black">
          <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-white text-center">
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
            className="absolute right-3.5 w-8 h-8 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black font-black flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[3]" aria-hidden="true" />
          </button>
        </div>

        {/* 2-Column Layout: White Body Background + Cream Cards (Header Preserved) */}
        <div className="p-4 bg-white text-[#14161d] grid grid-cols-1 sm:grid-cols-12 gap-3.5">
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
                    className={`aspect-square flex items-center justify-center p-2 rounded-xl border-[3px] transition-transform cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'bg-[#eef8d8] border-[#14161d] ring-2 ring-[#b8ff3c] -translate-y-0.5 shadow-[2px_2px_0_#000]'
                        : 'bg-[#f7efe0] hover:bg-[#efe3cc] border-black shadow-[2px_2px_0_#000]'
                    }`}
                  >
                    <CafeMenuItemArtwork
                      itemId={item.id}
                      className="w-13 h-13 drop-shadow-[0_2px_2px_rgba(0,0,0,0.28)]"
                    />
                  </button>
                );
              })}
            </div>

            {/* Bottom Page Dot Indicator */}
            <div className="pt-3 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-[#14161d]" />
            </div>
          </div>

          {/* Right Detail Panel (Cream Card) */}
          <div className="sm:col-span-5 bg-[#f7efe0] text-[#14161d] border-[3px] border-black shadow-[3px_3px_0_#000] rounded-xl p-4 flex flex-col items-center justify-between text-center min-h-[250px]">
            {!selectedItem ? (
              <div className="my-auto px-3">
                <p className="text-xs sm:text-sm font-extrabold text-[#14161d] leading-relaxed">
                  Select an item to view its details
                </p>
              </div>
            ) : (
              <>
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                  {category === 'pastry' ? 'PASTRY DISPLAY' : 'DRINK MACHINE'}
                </div>

                <div className="my-2 p-3 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0_#000]">
                  <CafeMenuItemArtwork itemId={selectedItem.id} className="w-24 h-24" />
                </div>

                <div className="space-y-1 mb-2">
                  <div className="text-sm font-black uppercase text-[#14161d]">
                    {selectedItem.name}
                  </div>
                  <div className="text-xs font-bold text-slate-600">
                    {selectedItem.prepHint}
                  </div>
                </div>

                {feedback && (
                  <div
                    data-cafe-prep-feedback="true"
                    className={`w-full mb-2 px-2 py-1 border-2 border-black text-[10.5px] font-black ${
                      feedback.ok
                        ? 'bg-[#dcfce7] text-emerald-950'
                        : 'bg-[#fee2e2] text-red-900'
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
                  className="w-full py-2.5 bg-[#b8ff3c] hover:bg-[#d9f99d] text-[#14161d] border-[3px] border-black shadow-[3px_3px_0_#000] font-black text-xs uppercase tracking-wider cursor-pointer active:translate-y-0.5"
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



