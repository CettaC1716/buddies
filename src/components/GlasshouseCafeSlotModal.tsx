import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Coins, RotateCw, X } from 'lucide-react';
import { soundEngine } from '../game/audio';
import {
  ARCADE_SLOT_BET_TIERS,
  ARCADE_SLOT_MIN_BET_LUL,
  ARCADE_SLOT_STRIP,
  ARCADE_SLOT_SYMBOLS,
  type ArcadeSlotEvaluation,
  type ArcadeSlotSymbolId,
  spinArcadeSlotReels,
} from '../game/buddiesArcadeSlots';
import type { PlayerLevelProgress } from '../game/buddiesCafeRules';

const SlotSymbolArtwork: React.FC<{ id: ArcadeSlotSymbolId; sizeClass?: string }> = ({
  id,
  sizeClass = 'w-14 h-14',
}) => {
  switch (id) {
    case 'seven':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <rect x="6" y="6" width="52" height="52" rx="12" fill="#fee2e2" stroke="#14161d" strokeWidth="3.5" />
          <path
            d="M19 16h27v9L30 50h-10l15-24H19z"
            fill="#ef4444"
            stroke="#14161d"
            strokeWidth="3.2"
            strokeLinejoin="round"
          />
          <circle cx="48" cy="18" r="3.5" fill="#facc15" stroke="#14161d" strokeWidth="2" />
        </svg>
      );
    case 'diamond':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <polygon
            points="18,12 46,12 56,26 32,54 8,26"
            fill="#22d3ee"
            stroke="#14161d"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <polygon points="18,12 32,26 46,12" fill="#a5f3fc" />
          <polygon points="8,26 32,26 32,54" fill="#06b6d4" />
          <line x1="8" y1="26" x2="56" y2="26" stroke="#14161d" strokeWidth="2.8" />
        </svg>
      );
    case 'star':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <polygon
            points="32,7 39,23 57,25 43,37 47,55 32,45 17,55 21,37 7,25 25,23"
            fill="#facc15"
            stroke="#14161d"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <polygon points="32,14 36,24 46,26 32,34" fill="#fef08a" />
        </svg>
      );
    case 'bell':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <circle cx="32" cy="12" r="4.5" fill="#f59e0b" stroke="#14161d" strokeWidth="3" />
          <path
            d="M18 32c0-10 6-17 14-17s14 7 14 17l5 12H13z"
            fill="#fbbf24"
            stroke="#14161d"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path d="M26 44a6 6 0 0 0 12 0" fill="#d97706" stroke="#14161d" strokeWidth="3" />
        </svg>
      );
    case 'coffee':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <ellipse cx="30" cy="51" rx="20" ry="5" fill="#e2e8f0" stroke="#14161d" strokeWidth="3" />
          <path
            d="M15 24h28v13c0 7-6 12-14 12s-14-5-14-12z"
            fill="#b45309"
            stroke="#14161d"
            strokeWidth="3.4"
            strokeLinejoin="round"
          />
          <path
            d="M43 27h5c4 0 6 3 6 6s-2 6-6 6h-5"
            fill="none"
            stroke="#14161d"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <ellipse cx="29" cy="24" rx="13" ry="3.5" fill="#451a03" stroke="#14161d" strokeWidth="2.5" />
        </svg>
      );
    case 'cherry':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <path
            d="M21 36c3-11 9-18 17-24m8 25c-1-10-3-18-8-25"
            fill="none"
            stroke="#14161d"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <ellipse cx="44" cy="13" rx="8" ry="4.5" fill="#84cc16" stroke="#14161d" strokeWidth="2.8" />
          <circle cx="20" cy="43" r="10.5" fill="#ef4444" stroke="#14161d" strokeWidth="3.4" />
          <circle cx="43" cy="44" r="10.5" fill="#dc2626" stroke="#14161d" strokeWidth="3.4" />
          <circle cx="16.5" cy="39" r="2.6" fill="#fecaca" />
          <circle cx="39.5" cy="40" r="2.6" fill="#fecaca" />
        </svg>
      );
  }
};

export interface GlasshouseCafeSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  lulBalance: number;
  levelProgress: PlayerLevelProgress;
  onDebitStake: (betLul: number) => { ok: boolean; message: string };
  onSettleSpin: (evaluation: ArcadeSlotEvaluation, betLul: number) => void;
}

export const GlasshouseCafeSlotModal: React.FC<GlasshouseCafeSlotModalProps> = ({
  isOpen,
  onClose,
  lulBalance,
  levelProgress,
  onDebitStake,
  onSettleSpin,
}) => {
  const [selectedBet, setSelectedBet] = useState<number>(5);
  const [reels, setReels] = useState<[ArcadeSlotSymbolId, ArcadeSlotSymbolId, ArcadeSlotSymbolId]>([
    'seven',
    'diamond',
    'star',
  ]);
  const [lockedReels, setLockedReels] = useState<[boolean, boolean, boolean]>([true, true, true]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<ArcadeSlotEvaluation | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessionStats, setSessionStats] = useState({ spins: 0, bestWinLul: 0, netLul: 0 });

  const pendingSettlementRef = useRef<{ evaluation: ArcadeSlotEvaluation; betLul: number } | null>(
    null,
  );
  const onSettleSpinRef = useRef(onSettleSpin);
  onSettleSpinRef.current = onSettleSpin;
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
      window.clearInterval(id);
    }
    timersRef.current = [];
  }, []);

  const flushPendingSettlement = useCallback(() => {
    const pending = pendingSettlementRef.current;
    if (!pending) return;
    pendingSettlementRef.current = null;
    onSettleSpinRef.current(pending.evaluation, pending.betLul);
    setSessionStats((prev) => ({
      spins: prev.spins + 1,
      bestWinLul: Math.max(prev.bestWinLul, pending.evaluation.payoutLul),
      netLul: prev.netLul + pending.evaluation.netDeltaLul,
    }));
    setLastResult(pending.evaluation);
    setReels(pending.evaluation.reels);
    setLockedReels([true, true, true]);
    setIsSpinning(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      clearTimers();
      flushPendingSettlement();
      setErrorMsg(null);
    }
  }, [isOpen, clearTimers, flushPendingSettlement]);

  useEffect(() => {
    return () => {
      clearTimers();
      flushPendingSettlement();
    };
  }, [clearTimers, flushPendingSettlement]);

  const handleSpin = useCallback(() => {
    if (isSpinning) return;
    setErrorMsg(null);

    const spin = spinArcadeSlotReels(selectedBet, lulBalance);
    if (!spin.ok || !spin.evaluation) {
      soundEngine.playHit();
      setErrorMsg(spin.message);
      return;
    }

    const debit = onDebitStake(spin.betLul);
    if (!debit.ok) {
      soundEngine.playHit();
      setErrorMsg(debit.message);
      return;
    }

    const targetEval = spin.evaluation;
    const betLul = spin.betLul;
    pendingSettlementRef.current = { evaluation: targetEval, betLul };
    setLastResult(null);
    setIsSpinning(true);
    setLockedReels([false, false, false]);
    soundEngine.playUiConfirm();

    const stripLen = ARCADE_SLOT_STRIP.length;
    let tickStep = 0;
    const lockFlags: [boolean, boolean, boolean] = [false, false, false];

    const intervalId = window.setInterval(() => {
      tickStep++;
      setReels((prev) => [
        lockFlags[0] ? prev[0] : ARCADE_SLOT_STRIP[(tickStep * 3) % stripLen],
        lockFlags[1] ? prev[1] : ARCADE_SLOT_STRIP[(tickStep * 5 + 9) % stripLen],
        lockFlags[2] ? prev[2] : ARCADE_SLOT_STRIP[(tickStep * 7 + 19) % stripLen],
      ]);
      if (tickStep % 2 === 0) {
        soundEngine.playUiClick();
      }
    }, 75);
    timersRef.current.push(intervalId);

    const lockAt = (idx: 0 | 1 | 2, delayMs: number) => {
      const tid = window.setTimeout(() => {
        lockFlags[idx] = true;
        setLockedReels([lockFlags[0], lockFlags[1], lockFlags[2]]);
        setReels((prev) => {
          const next: [ArcadeSlotSymbolId, ArcadeSlotSymbolId, ArcadeSlotSymbolId] = [
            prev[0],
            prev[1],
            prev[2],
          ];
          next[idx] = targetEval.reels[idx];
          return next;
        });
        soundEngine.playUiClick();

        if (idx === 2) {
          window.clearInterval(intervalId);
          flushPendingSettlement();
          if (targetEval.outcomeKind === 'jackpot' || targetEval.outcomeKind === 'triple') {
            soundEngine.playVictory();
            soundEngine.playPickup();
          } else if (targetEval.outcomeKind === 'pair_win') {
            soundEngine.playOrderBell();
          } else if (targetEval.outcomeKind === 'push') {
            soundEngine.playUiConfirm();
          } else {
            soundEngine.playHit();
          }
        }
      }, delayMs);
      timersRef.current.push(tid);
    };

    lockAt(0, 620);
    lockAt(1, 1020);
    lockAt(2, 1420);
  }, [isSpinning, selectedBet, lulBalance, onDebitStake, flushPendingSettlement]);

  const handleClose = useCallback(() => {
    clearTimers();
    flushPendingSettlement();
    soundEngine.playUiCancel();
    onClose();
  }, [clearTimers, flushPendingSettlement, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        handleClose();
      } else if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        handleSpin();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, handleClose, handleSpin]);

  if (!isOpen) return null;

  const isWinningOutcome =
    lastResult !== null &&
    (lastResult.outcomeKind === 'jackpot' ||
      lastResult.outcomeKind === 'triple' ||
      lastResult.outcomeKind === 'pair_win');

  const isMatchedReel = (idx: 0 | 1 | 2): boolean => {
    if (!lastResult || !lastResult.matchedSymbol) return false;
    return reels[idx] === lastResult.matchedSymbol.id;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="NEO-STRIKE SLOTS"
      data-cafe-slot-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 pointer-events-auto"
    >
      <div className="w-full max-w-[600px] bg-[#14161d] text-white border-[4px] border-[#14161d] ring-3 ring-white shadow-[8px_8px_0_#000] rounded-2xl overflow-hidden">
        {/* Header matching Glasshouse Cafe Modal design */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1e212b] border-b-[3px] border-black">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 bg-[#b8ff3c] text-[#14161d] border-2 border-black text-[10px] font-black uppercase">
              LV {levelProgress.level}
            </span>
            <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-white">
              NEO-STRIKE SLOTS
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div
              data-slot-lul-balance="true"
              className="px-2.5 py-1 bg-[#fec83e] text-[#14161d] border-2 border-black font-mono-tabular font-black text-xs flex items-center gap-1"
            >
              <Coins className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
              {lulBalance} LUL
            </div>
            <button
              type="button"
              data-cafe-slot-close-btn="true"
              onClick={handleClose}
              aria-label="Close Slot Machine"
              className="w-8 h-8 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black font-black flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4 stroke-[3]" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Clean White & Cream Cabinet Body */}
        <div className="p-4 bg-white text-[#14161d] space-y-3.5">
          {/* 3-Reel Arcade Window */}
          <div className="p-3.5 rounded-xl bg-[#14161d] border-[3px] border-black shadow-[4px_4px_0_#000]">
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#22d3ee]">
                CENTER PAYLINE · 777 PAYS 50X
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#f9a8d4]">
                2X PAIR · 3X TRIPLE
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {([0, 1, 2] as const).map((idx) => {
                const symId = reels[idx];
                const locked = lockedReels[idx];
                const highlighted = locked && isMatchedReel(idx);
                return (
                  <div
                    key={idx}
                    data-slot-reel={idx}
                    data-slot-symbol={symId}
                    className={`flex flex-col items-center justify-center h-28 rounded-xl border-[3px] border-black transition-all ${
                      highlighted
                        ? 'bg-[#ecfccb] ring-3 ring-[#b8ff3c] scale-[1.02]'
                        : locked
                          ? 'bg-[#fffdf7]'
                          : 'bg-[#f1f5f9] opacity-90'
                    }`}
                  >
                    <SlotSymbolArtwork id={symId} sizeClass="w-16 h-16" />
                    <span className="mt-1 text-[10px] font-black uppercase tracking-wider text-[#14161d]">
                      {ARCADE_SLOT_SYMBOLS.find((s) => s.id === symId)?.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Result Readout Bar */}
            <div
              data-slot-outcome-banner="true"
              className={`mt-3 px-3 py-2 rounded-lg border-2 border-black text-center text-xs font-black uppercase tracking-wider ${
                isSpinning
                  ? 'bg-[#0f172a] text-[#22d3ee]'
                  : lastResult === null
                    ? 'bg-[#1e212b] text-slate-200'
                    : isWinningOutcome
                      ? 'bg-[#b8ff3c] text-[#14161d]'
                      : lastResult.outcomeKind === 'push'
                        ? 'bg-[#fec83e] text-[#14161d]'
                        : 'bg-[#272b38] text-slate-200'
              }`}
            >
              {isSpinning
                ? `SPINNING REELS (${selectedBet} LUL)...`
                : lastResult
                  ? `${lastResult.headline} · +${lastResult.xpGained} XP`
                  : 'PICK YOUR STAKE AND PRESS SPIN'}
            </div>
          </div>

          {errorMsg && (
            <div className="px-3 py-2 rounded-lg bg-[#fee2e2] border-2 border-black text-xs font-black text-[#b91c1c]">
              {errorMsg}
            </div>
          )}

          {/* Stake Tier Picker + Primary Spin CTA */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-stretch">
            <div className="sm:col-span-7 grid grid-cols-4 gap-2">
              {ARCADE_SLOT_BET_TIERS.map((tier) => {
                const active = selectedBet === tier;
                const affordable = lulBalance >= tier;
                return (
                  <button
                    key={tier}
                    type="button"
                    disabled={isSpinning}
                    data-slot-bet-btn={tier}
                    onClick={() => {
                      soundEngine.playUiClick();
                      setSelectedBet(tier);
                      setErrorMsg(null);
                    }}
                    className={`py-2 px-1 rounded-xl border-[3px] border-black font-black text-center cursor-pointer transition-transform active:scale-95 ${
                      active
                        ? 'bg-[#ecfccb] ring-2 ring-[#84cc16] -translate-y-0.5 shadow-[2px_2px_0_#000]'
                        : affordable
                          ? 'bg-[#fffdf7] hover:bg-[#f8fafc] shadow-[2px_2px_0_#000]'
                          : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <div className="text-sm font-black">{tier}</div>
                    <div className="text-[9px] font-black uppercase text-slate-500">LUL</div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={isSpinning || lulBalance < ARCADE_SLOT_MIN_BET_LUL}
              data-slot-spin-btn="true"
              onClick={handleSpin}
              className="sm:col-span-5 py-2.5 px-4 bg-[#b8ff3c] hover:bg-[#c8ff66] disabled:bg-slate-200 disabled:text-slate-500 text-[#14161d] border-[3px] border-black rounded-xl shadow-[3px_3px_0_#000] active:translate-x-[1px] active:translate-y-[1px] font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCw className={`w-4 h-4 stroke-[2.8] ${isSpinning ? 'animate-spin' : ''}`} aria-hidden="true" />
              {isSpinning ? 'SPINNING...' : `SPIN (${selectedBet} LUL)`}
            </button>
          </div>

          {lulBalance < ARCADE_SLOT_MIN_BET_LUL && !isSpinning && (
            <p className="text-[11px] font-bold text-slate-600 text-center">
              Need at least {ARCADE_SLOT_MIN_BET_LUL} LUL to play. Work a barista shift or cash out Shift Bucks at the Cafe ATM.
            </p>
          )}

          {/* Compact Paytable & Session Summary */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
            {ARCADE_SLOT_SYMBOLS.map((spec) => (
              <div
                key={spec.id}
                className="flex flex-col items-center p-1.5 rounded-lg border-2 border-black bg-[#fffdf7]"
              >
                <SlotSymbolArtwork id={spec.id} sizeClass="w-7 h-7" />
                <div className="mt-1 text-[10px] font-black text-[#14161d]">
                  3x: {spec.tripleMultiplier}x
                </div>
                <div className="text-[9px] font-bold text-slate-600">
                  2x: {spec.pairMultiplier}x
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#f8fafc] border-2 border-black text-[11px] font-black uppercase text-slate-700">
            <span>Spins: {sessionStats.spins}</span>
            <span>Best Win: {sessionStats.bestWinLul} LUL</span>
            <span className={sessionStats.netLul >= 0 ? 'text-[#15803d]' : 'text-[#b91c1c]'}>
              Net: {sessionStats.netLul >= 0 ? `+${sessionStats.netLul}` : sessionStats.netLul} LUL
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
