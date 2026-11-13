import React, { useState } from 'react';
import { Coffee, Sparkles, Star, Coins, LogOut, Banknote, CheckCircle2, X } from 'lucide-react';
import {
  CAFE_MENU_ITEMS,
  type CafeMenuItemSpec,
  type CafeWorkShiftState,
  type PlayerLevelProgress,
} from '../game/buddiesCafeRules';
import { CafeMenuItemArtwork } from './GlasshouseCafeMenuArtwork';

export interface PlayerLevelXpBadgeProps {
  levelProgress: PlayerLevelProgress;
  playerName: string;
  lulBalance: number;
  shiftBucks: number;
  isWorkingShift: boolean;
}

export const PlayerLevelXpBadge: React.FC<PlayerLevelXpBadgeProps> = ({
  levelProgress,
  playerName,
  lulBalance,
  shiftBucks,
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
                PELAYAN
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
        <div
          data-testid="hud-player-bucks"
          className="flex-1 px-2 py-0.5 bg-[#4ade80] text-[#052e16] border-2 border-black rounded font-mono-tabular font-black text-[10px] flex items-center justify-between"
        >
          <span>BUCKS</span>
          <span>{shiftBucks}</span>
        </div>
      </div>
    </div>
  );
};

export interface CafeInteriorTopHudBarProps {
  shiftState: CafeWorkShiftState;
  shiftBucks: number;
  onStartWorkShift: () => void;
  onStopWorkShift: () => void;
  onServeActiveOrder: () => void;
  onOpenOrderModal: () => void;
  onOpenAtmModal: () => void;
  onExitCafe: () => void;
}

export const CafeInteriorTopHudBar: React.FC<CafeInteriorTopHudBarProps> = ({
  shiftState,
  shiftBucks,
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
          RUMAH KACA CAFE
        </span>

        {!shiftState.isWorking ? (
          <>
            <button
              type="button"
              data-cafe-start-shift-btn="true"
              onClick={onStartWorkShift}
              className="px-2.5 py-1 bg-[#4ade80] hover:bg-[#86efac] text-[#052e16] border-2 border-black text-[10.5px] font-black uppercase cursor-pointer"
            >
              KERJA PELAYAN
            </button>
            <button
              type="button"
              data-cafe-open-menu-btn="true"
              onClick={onOpenOrderModal}
              className="px-2.5 py-1 bg-[#38bdf8] hover:bg-[#7dd3fc] text-[#0f172a] border-2 border-black text-[10.5px] font-black uppercase cursor-pointer"
            >
              PESAN MENU
            </button>
            <button
              type="button"
              data-cafe-open-atm-btn="true"
              onClick={onOpenAtmModal}
              className="px-2.5 py-1 bg-[#facc15] hover:bg-[#fde047] text-[#14161d] border-2 border-black text-[10.5px] font-black uppercase cursor-pointer"
            >
              ATM ({shiftBucks})
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
              SELESAI KERJA
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
          KELUAR
        </button>
      </div>

      {/* Active Customer Order Card while working as PELAYAN */}
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
              PESANAN {shiftState.activeOrder.customerName}
            </div>
            <div className="text-xs font-black uppercase text-[#14161d] leading-tight mt-0.5">
              {shiftState.activeOrder.item.name}
            </div>
            <div className="text-[10px] font-black text-amber-600 font-mono-tabular">
              +{shiftState.activeOrder.item.xpReward + 15} XP · +{shiftState.activeOrder.item.shiftBucksReward} BUCKS
            </div>
          </div>
          <button
            type="button"
            data-cafe-serve-order-btn="true"
            onClick={onServeActiveOrder}
            className="px-3 py-2 bg-[#b8ff3c] hover:bg-[#d9f99d] text-[#14161d] border-2 border-black shadow-[2px_2px_0_#000] text-xs font-black uppercase cursor-pointer active:translate-y-0.5"
          >
            SAJIKAN [E]
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
      aria-label="PESAN SESUATU"
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
              PESAN SESUATU
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
                setFeedback(null);
                onClose();
              }}
              aria-label="Tutup Menu Pesanan"
              className="w-8 h-8 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black font-black flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4 stroke-[3]" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* 2-Column Layout Matching Reference Screenshot: 3x3 Visual Grid (Left) + Item Buy Card (Right) */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-12 gap-3.5">
          {/* Left 3x3 Visual Grid (Image-First, Price Pill Only!) */}
          <div className="sm:col-span-7 grid grid-cols-3 gap-2.5">
            {CAFE_MENU_ITEMS.map((item) => {
              const isSelected = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-cafe-menu-item={item.id}
                  onClick={() => {
                    setSelectedId(item.id);
                    setFeedback(null);
                  }}
                  aria-label={`${item.name} - ${item.priceLul} LUL`}
                  className={`group flex flex-col items-center justify-between p-2 rounded-xl border-[3px] transition-transform cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'bg-[#262b38] border-[#b8ff3c] ring-2 ring-[#b8ff3c] -translate-y-0.5'
                      : 'bg-[#1b1f29] hover:bg-[#232836] border-black'
                  }`}
                >
                  <div className="w-14 h-14 flex items-center justify-center">
                    <CafeMenuItemArtwork itemId={item.id} className="w-13 h-13 drop-shadow-[0_2px_2px_rgba(0,0,0,0.45)]" />
                  </div>
                  <div className="mt-1 w-full py-0.5 px-1.5 bg-[#0f172a] border border-black rounded text-[10.5px] font-black font-mono-tabular text-[#38bdf8] flex items-center justify-center gap-1">
                    <span>◆</span>
                    <span>{item.priceLul}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Detail Panel */}
          <div className="sm:col-span-5 bg-[#1b1f29] border-[3px] border-black rounded-xl p-3.5 flex flex-col items-center justify-between text-center min-h-[260px]">
            {!selectedItem ? (
              <div className="my-auto px-2 space-y-2">
                <Sparkles className="w-8 h-8 text-[#b8ff3c] mx-auto" aria-hidden="true" />
                <p className="text-xs font-bold text-slate-300 leading-relaxed">
                  Pilih item untuk melihat informasi XP &amp; membelinya
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

                <div className="my-2 p-2.5 bg-[#12151d] border-2 border-black rounded-xl">
                  <CafeMenuItemArtwork itemId={selectedItem.id} className="w-24 h-24" />
                </div>

                <div className="space-y-0.5 mb-2">
                  <div className="text-sm font-black uppercase text-white">
                    {selectedItem.name}
                  </div>
                  <div className="text-[11px] font-bold text-slate-400">
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
                    const res = onPurchaseItem(selectedItem);
                    setFeedback({ ok: res.ok, text: res.message });
                  }}
                  className="w-full py-2.5 bg-[#b8ff3c] hover:bg-[#d9f99d] text-[#14161d] border-[3px] border-black shadow-[3px_3px_0_#000] font-black text-xs uppercase tracking-wider cursor-pointer active:translate-y-0.5"
                >
                  PESAN ({selectedItem.priceLul} LUL)
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
  shiftBucks: number;
  lulBalance: number;
  onExchangeBucks: (amount: number) => void;
}

export const GlasshouseCafeAtmModal: React.FC<GlasshouseCafeAtmModalProps> = ({
  isOpen,
  onClose,
  shiftBucks,
  lulBalance,
  onExchangeBucks,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ATM CAFE TUKAR GAJI"
      data-cafe-atm-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 pointer-events-auto"
    >
      <div className="w-full max-w-sm bg-[#14161d] text-white border-[4px] border-[#14161d] ring-3 ring-white shadow-[8px_8px_0_#000] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-[#1e212b] border-b-[3px] border-black">
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4 text-[#facc15]" aria-hidden="true" />
            <h2 className="text-sm font-black uppercase tracking-wider">CAFE ATM · TUKAR GAJI</h2>
          </div>
          <button
            type="button"
            data-cafe-atm-close-btn="true"
            onClick={onClose}
            aria-label="Tutup ATM"
            className="w-7 h-7 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black font-black flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[3]" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-2.5 bg-[#1b1f29] border-2 border-black rounded-xl text-center">
              <div className="text-[9.5px] font-black uppercase text-emerald-400">SHIFT BUCKS</div>
              <div
                data-atm-bucks-balance="true"
                className="text-xl font-black font-mono-tabular text-white mt-0.5"
              >
                {shiftBucks}
              </div>
            </div>
            <div className="p-2.5 bg-[#1b1f29] border-2 border-black rounded-xl text-center">
              <div className="text-[9.5px] font-black uppercase text-[#fec83e]">SALDO LUL</div>
              <div
                data-atm-lul-balance="true"
                className="text-xl font-black font-mono-tabular text-[#fec83e] mt-0.5"
              >
                {lulBalance}
              </div>
            </div>
          </div>

          <div className="text-center text-[11px] font-bold text-slate-300">
            Kurs Tukar: <span className="text-[#b8ff3c] font-black">1 BUCKS = 1 LUL</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={shiftBucks < 25}
              data-atm-exchange-25-btn="true"
              onClick={() => onExchangeBucks(25)}
              className="py-2 bg-[#38bdf8] disabled:bg-slate-700 disabled:text-slate-400 hover:bg-[#7dd3fc] text-[#0f172a] border-2 border-black font-black text-xs uppercase cursor-pointer disabled:cursor-not-allowed"
            >
              TUKAR 25
            </button>
            <button
              type="button"
              disabled={shiftBucks <= 0}
              data-atm-exchange-all-btn="true"
              onClick={() => onExchangeBucks(shiftBucks)}
              className="py-2 bg-[#b8ff3c] disabled:bg-slate-700 disabled:text-slate-400 hover:bg-[#d9f99d] text-[#14161d] border-2 border-black font-black text-xs uppercase cursor-pointer disabled:cursor-not-allowed"
            >
              TUKAR SEMUA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const XpGainCelebrationBanner: React.FC<{
  banner: { id: number; xpGained: number; bucksGained?: number; leveledUpTo: number | null; label: string } | null;
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
            ? `LEVEL UP! SEKARANG LV ${banner.leveledUpTo} (+${banner.xpGained} XP)`
            : `${banner.label} · +${banner.xpGained} XP${
                banner.bucksGained ? ` · +${banner.bucksGained} BUCKS` : ''
              }`}
        </span>
      </div>
    </div>
  );
};
