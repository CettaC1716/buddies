import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Coins, RotateCw, Sparkles, Trophy, X } from 'lucide-react';
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
  const uid = useId();
  switch (id) {
    case 'seven':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-seven-badge`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="55%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
            <linearGradient id={`${uid}-seven-body`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff6b6b" />
              <stop offset="48%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#991b1b" />
            </linearGradient>
          </defs>
          <ellipse cx="32" cy="56" rx="18" ry="4" fill="rgba(120,53,15,0.22)" />
          <rect
            x="8"
            y="7"
            width="48"
            height="48"
            rx="14"
            fill={`url(#${uid}-seven-badge)`}
            stroke="#451a03"
            strokeWidth="3"
          />
          <rect
            x="12"
            y="11"
            width="40"
            height="40"
            rx="10"
            fill="#fffbeb"
            stroke="#d97706"
            strokeWidth="1.8"
          />
          <path
            d="M19 19h26v8.5L31 50h-9.5L35 27.5H19z"
            transform="translate(0, 2.5)"
            fill="#7f1d1d"
          />
          <path
            d="M19 17.5h26V26L31 48.5h-9.5L35 26H19z"
            fill={`url(#${uid}-seven-body)`}
            stroke="#450a0a"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <path d="M21.5 20h20.5l-1.2 2.6H21.5z" fill="#fecaca" opacity="0.85" />
          <circle cx="46" cy="17" r="3" fill="#fef08a" />
        </svg>
      );
    case 'diamond':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-gem-top`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ecfeff" />
              <stop offset="100%" stopColor="#67e8f9" />
            </linearGradient>
            <linearGradient id={`${uid}-gem-body`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="55%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#0369a1" />
            </linearGradient>
          </defs>
          <ellipse cx="32" cy="56" rx="16" ry="3.8" fill="rgba(12,74,110,0.22)" />
          <polygon
            points="18,12 46,12 57,26 32,54 7,26"
            fill={`url(#${uid}-gem-body)`}
            stroke="#083344"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <polygon points="18,12 46,12 57,26 7,26" fill={`url(#${uid}-gem-top)`} />
          <polygon points="23,12 41,12 45,26 19,26" fill="#ffffff" opacity="0.7" />
          <polygon points="7,26 19,26 32,54" fill="#0284c7" opacity="0.75" />
          <polygon points="45,26 57,26 32,54" fill="#0369a1" opacity="0.85" />
          <polygon points="19,26 45,26 32,54" fill="#38bdf8" opacity="0.85" />
          <line x1="7" y1="26" x2="57" y2="26" stroke="#083344" strokeWidth="2.4" />
          <polyline
            points="18,12 19,26 32,54 45,26 46,12"
            fill="none"
            stroke="#083344"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="24" cy="19" r="2.2" fill="#ffffff" />
        </svg>
      );
    case 'star':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-star-gold`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
          <ellipse cx="32" cy="56" rx="17" ry="3.8" fill="rgba(146,64,14,0.22)" />
          <polygon
            points="32,9 39.5,23.5 56,25.8 43.8,37.2 46.8,53.5 32,45.5 17.2,53.5 20.2,37.2 8,25.8 24.5,23.5"
            transform="translate(0, 2)"
            fill="#92400e"
          />
          <polygon
            points="32,7 39.5,22 56,24.4 43.8,36 46.8,52.5 32,44.5 17.2,52.5 20.2,36 8,24.4 24.5,22"
            fill={`url(#${uid}-star-gold)`}
            stroke="#451a03"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <polygon
            points="32,12 36.8,22.5 48,24.2 32,32 25.5,22.5"
            fill="#fef9c3"
            opacity="0.78"
          />
          <circle cx="28" cy="24" r="2.3" fill="#ffffff" opacity="0.9" />
        </svg>
      );
    case 'bell':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-bell-brass`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="45%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
          </defs>
          <ellipse cx="32" cy="56" rx="17" ry="3.8" fill="rgba(120,53,15,0.22)" />
          <circle cx="32" cy="11.5" r="5" fill="#f59e0b" stroke="#451a03" strokeWidth="2.8" />
          <circle cx="32" cy="46.5" r="6.5" fill="#92400e" />
          <path
            d="M25.5 45a6.5 6.5 0 0 0 13 0z"
            fill="#b45309"
            stroke="#451a03"
            strokeWidth="2.8"
          />
          <path
            d="M17.5 32c0-10.5 6.2-17.5 14.5-17.5S46.5 21.5 46.5 32l5.5 12.5H12z"
            fill={`url(#${uid}-bell-brass)`}
            stroke="#451a03"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M23 20.5c-2.8 3.2-4.2 7.5-4.2 12l-2.2 6.5h4.2l1.6-6.5c0-4.2 1.2-8 3.6-10.8z"
            fill="#fef9c3"
            opacity="0.8"
          />
          <rect x="13" y="40.5" width="38" height="4" rx="2" fill="#fde68a" opacity="0.65" />
        </svg>
      );
    case 'coffee':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-cup-body`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fffbeb" />
              <stop offset="60%" stopColor="#fde68a" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          <ellipse cx="31" cy="55" rx="21" ry="4.5" fill="rgba(120,53,15,0.2)" />
          <ellipse
            cx="30"
            cy="50.5"
            rx="20"
            ry="5.5"
            fill="#fef3c7"
            stroke="#451a03"
            strokeWidth="2.8"
          />
          <path
            d="M43 27.5h5.2c4 0 6.5 2.8 6.5 6.2s-2.5 6.3-6.5 6.3H43"
            fill="none"
            stroke="#451a03"
            strokeWidth="5.2"
            strokeLinecap="round"
          />
          <path
            d="M43 27.5h5.2c4 0 6.5 2.8 6.5 6.2s-2.5 6.3-6.5 6.3H43"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M15 23.5h30v13.5c0 8-6.5 13-15 13s-15-5-15-13z"
            fill={`url(#${uid}-cup-body)`}
            stroke="#451a03"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <ellipse
            cx="30"
            cy="23.5"
            rx="15"
            ry="4.8"
            fill="#78350f"
            stroke="#451a03"
            strokeWidth="2.6"
          />
          <ellipse cx="30" cy="23.5" rx="11" ry="2.8" fill="#b45309" />
          <path
            d="M25 15.5c0-2.6 2.5-2.8 2.5-5.4M33 14.5c0-2.6 2.5-2.8 2.5-5.4"
            fill="none"
            stroke="#d97706"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'cherry':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <defs>
            <radialGradient id={`${uid}-cherry-left`} cx="35%" cy="32%" r="68%">
              <stop offset="0%" stopColor="#fca5a5" />
              <stop offset="40%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#991b1b" />
            </radialGradient>
            <radialGradient id={`${uid}-cherry-right`} cx="35%" cy="32%" r="68%">
              <stop offset="0%" stopColor="#fda4af" />
              <stop offset="42%" stopColor="#e11d48" />
              <stop offset="100%" stopColor="#881337" />
            </radialGradient>
          </defs>
          <ellipse cx="32" cy="56" rx="19" ry="3.8" fill="rgba(136,19,55,0.2)" />
          <path
            d="M21 36c3-12 9-19 17.5-25.5M45 37c-1-10.5-3-19-6.5-26.5"
            fill="none"
            stroke="#365314"
            strokeWidth="3.4"
            strokeLinecap="round"
          />
          <path
            d="M38 11c5-3.5 13-2 15.5 2.5-4.5 4-12.5 3.5-15.5-2.5z"
            fill="#84cc16"
            stroke="#365314"
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          <circle
            cx="20.5"
            cy="43"
            r="11.5"
            fill={`url(#${uid}-cherry-left)`}
            stroke="#450a0a"
            strokeWidth="3"
          />
          <circle
            cx="43.5"
            cy="44.5"
            r="11.5"
            fill={`url(#${uid}-cherry-right)`}
            stroke="#450a0a"
            strokeWidth="3"
          />
          <ellipse
            cx="16.8"
            cy="38.5"
            rx="3.2"
            ry="2"
            transform="rotate(-28 16.8 38.5)"
            fill="#ffffff"
            opacity="0.88"
          />
          <ellipse
            cx="39.8"
            cy="40"
            rx="3.2"
            ry="2"
            transform="rotate(-28 39.8 40)"
            fill="#ffffff"
            opacity="0.88"
          />
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
      <div className="w-full max-w-[620px] max-h-[calc(100vh-1.5rem)] overflow-y-auto bg-[#14161d] text-white border-[4px] border-[#14161d] ring-3 ring-white shadow-[8px_8px_0_#000] rounded-2xl overflow-hidden">
        {/* Header matching Glasshouse Cafe Modal design — preserved intact */}
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

        {/* Redesigned Tactile Arcade Kiosk Body */}
        <div className="bg-gradient-to-b from-[#fdf6e7] to-[#f5ead4] text-[#14161d]">
          {/* Wooden Arcade Booth with Scalloped Green Awning */}
          <div className="p-3.5 pb-2">
            <div className="rounded-2xl overflow-hidden border-[3px] border-[#3b1806] shadow-[0_5px_0_#3b1806]">
              {/* Striped Green Canopy Awning + Wooden Marquee Sign */}
              <div className="relative pt-2.5 pb-3.5 px-3 overflow-hidden bg-[repeating-linear-gradient(90deg,#84cc16_0px,#84cc16_38px,#16a34a_38px,#16a34a_76px)] border-b-[3px] border-[#14532d]">
                {/* Top Sunlit Sheen */}
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-white/40 to-transparent"
                />

                {/* Center Wooden Jackpot Plaque */}
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-b from-[#b45309] via-[#9a3412] to-[#7c2d12] border-[2.5px] border-[#fef3c7] shadow-[0_3px_0_#451a03]">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-[#fde047] shrink-0" aria-hidden="true" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-[#fef08a] drop-shadow-[0_1px_0_#451a03] whitespace-nowrap">
                      777 Jackpot Pays 50x
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold text-[#ffedd5] whitespace-nowrap">
                    <span>Center Payline</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#fde047]">2x Pair</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#bef264]">3x Triple</span>
                  </div>
                </div>

                {/* Scalloped Valance Trim along Bottom of Awning */}
                <svg
                  viewBox="0 0 480 12"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 w-full h-2.5 text-[#7c2d12]"
                >
                  <path
                    d="M0,12 L0,2 Q20,12 40,2 Q60,12 80,2 Q100,12 120,2 Q140,12 160,2 Q180,12 200,2 Q220,12 240,2 Q260,12 280,2 Q300,12 320,2 Q340,12 360,2 Q380,12 400,2 Q420,12 440,2 Q460,12 480,2 L480,12 Z"
                    fill="currentColor"
                  />
                </svg>
              </div>

              {/* Warm Wood-Plank Reel Stage */}
              <div className="relative px-3.5 pt-3.5 pb-3 bg-[repeating-linear-gradient(90deg,rgba(69,26,3,0.16)_0px,rgba(69,26,3,0.16)_2px,transparent_2px,transparent_48px),linear-gradient(180deg,#8c2d0e_0%,#b45309_52%,#7c2d12_100%)]">
                {/* 3 Cream-Beveled Reel Windows with Overlapping Glossy Plaques */}
                <div className="grid grid-cols-3 gap-3 pb-2.5">
                  {([0, 1, 2] as const).map((idx) => {
                    const symId = reels[idx];
                    const symSpec = ARCADE_SLOT_SYMBOLS.find((s) => s.id === symId);
                    const locked = lockedReels[idx];
                    const highlighted = locked && isMatchedReel(idx);
                    const showTopJackpotTag = symId === 'seven' && locked;

                    return (
                      <div
                        key={idx}
                        data-slot-reel={idx}
                        data-slot-symbol={symId}
                        className={`relative flex flex-col items-center justify-center h-28 pb-3 rounded-xl border-[3px] transition-transform duration-150 ${
                          highlighted
                            ? 'bg-gradient-to-b from-[#fef08a] via-[#fbbf24] to-[#f59e0b] border-[#fffbeb] ring-3 ring-[#b8ff3c] -translate-y-0.5 shadow-[0_5px_0_#451a03]'
                            : locked
                              ? 'bg-gradient-to-b from-[#fffdf7] via-[#fef3c7] to-[#fde68a] border-[#fffbeb] shadow-[0_4px_0_#451a03]'
                              : 'bg-gradient-to-b from-[#fffbeb] via-[#fef3c7] to-[#fed7aa] border-[#fde68a] opacity-95 scale-[0.98] shadow-[0_3px_0_#451a03]'
                        }`}
                      >
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-1 rounded-lg border border-amber-900/15"
                        />

                        {(highlighted || showTopJackpotTag) && (
                          <div
                            className={`absolute -top-2 -right-2 z-10 px-1.5 py-0.5 rounded-lg border-2 border-[#1e293b] font-mono-tabular font-black text-[9.5px] uppercase shadow-[0_2px_0_#0f172a] ${
                              highlighted
                                ? 'bg-[#b8ff3c] text-[#14161d]'
                                : 'bg-[#0ea5e9] text-white'
                            }`}
                          >
                            {highlighted && lastResult ? `${lastResult.multiplier}x` : '50x'}
                          </div>
                        )}

                        <div
                          className={`transition-transform duration-150 ${
                            !locked ? 'scale-95 opacity-90' : highlighted ? 'scale-105' : ''
                          }`}
                        >
                          <SlotSymbolArtwork id={symId} sizeClass="w-16 h-16" />
                        </div>

                        {/* Overlapping Glossy Bottom Plaque */}
                        <div
                          className={`absolute -bottom-2.5 inset-x-2.5 py-0.5 px-1.5 rounded-full border-2 text-center shadow-[0_2px_0_#451a03] ${
                            highlighted
                              ? 'bg-gradient-to-b from-[#bef264] to-[#65a30d] border-white text-[#14161d]'
                              : 'bg-gradient-to-b from-[#fbbf24] via-[#f59e0b] to-[#c2410c] border-[#fffbeb] text-white'
                          }`}
                        >
                          <span className="block text-[9.5px] font-black uppercase tracking-wider truncate drop-shadow-[0_1px_0_rgba(69,26,3,0.65)]">
                            {symSpec?.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Wooden Counter Ledge Outcome Readout */}
                <div
                  data-slot-outcome-banner="true"
                  className={`mt-2.5 px-3 py-2 rounded-xl border-2 text-center text-xs font-black uppercase tracking-wider transition-colors ${
                    isSpinning
                      ? 'bg-[#451a03] border-[#fbbf24] text-[#fef08a]'
                      : lastResult === null
                        ? 'bg-[#451a03]/90 border-[#d97706] text-[#ffedd5]'
                        : isWinningOutcome
                          ? 'bg-gradient-to-b from-[#d9f99d] to-[#84cc16] border-[#14532d] text-[#14161d] shadow-[0_2px_0_#14532d]'
                          : lastResult.outcomeKind === 'push'
                            ? 'bg-gradient-to-b from-[#fef08a] to-[#f59e0b] border-[#451a03] text-[#14161d]'
                            : 'bg-[#3b1806] border-[#9a3412] text-[#fed7aa]'
                  }`}
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    {isWinningOutcome && !isSpinning && (
                      <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <span>
                      {isSpinning
                        ? `Spinning Reels (${selectedBet} LUL)...`
                        : lastResult
                          ? `${lastResult.headline} · +${lastResult.xpGained} XP`
                          : 'Pick your stake and press Spin'}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Lower Control & Paytable Deck */}
          <div className="px-3.5 pb-3.5 pt-1.5 space-y-2.5">
            {errorMsg && (
              <div className="px-3 py-2 rounded-xl bg-[#fee2e2] border-2 border-[#7f1d1d] text-xs font-black text-[#991b1b]">
                {errorMsg}
              </div>
            )}

            {/* Tactile Stake Tier Picker + Glossy Primary Spin CTA */}
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
                      className={`relative py-2 px-1.5 rounded-xl border-[2.5px] font-mono-tabular font-black text-center cursor-pointer transition-transform duration-150 active:translate-y-0.5 whitespace-nowrap ${
                        active
                          ? 'bg-gradient-to-b from-[#fde047] via-[#f59e0b] to-[#c2410c] border-[#451a03] text-white -translate-y-0.5 shadow-[0_3px_0_#451a03] ring-2 ring-[#fef08a]'
                          : affordable
                            ? 'bg-gradient-to-b from-[#fffdf7] to-[#fde68a] hover:from-[#fffbeb] hover:to-[#fcd34d] border-[#78350f] text-[#451a03] shadow-[0_3px_0_#78350f]'
                            : 'bg-[#efe8d8] border-[#cbbfa8] text-[#8c7f6a]'
                      }`}
                    >
                      <div
                        className={`text-sm font-black leading-tight ${
                          active ? 'drop-shadow-[0_1px_0_#451a03]' : ''
                        }`}
                      >
                        {tier}
                      </div>
                      <div
                        className={`text-[9.5px] font-black uppercase leading-tight ${
                          active ? 'text-[#fef9c3]' : affordable ? 'text-[#92400e]' : 'text-[#8c7f6a]'
                        }`}
                      >
                        LUL
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={isSpinning || lulBalance < ARCADE_SLOT_MIN_BET_LUL}
                data-slot-spin-btn="true"
                onClick={handleSpin}
                className="relative sm:col-span-5 py-2.5 px-4 rounded-xl border-[3px] font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-transform duration-150 active:translate-y-0.5 whitespace-nowrap enabled:bg-gradient-to-b enabled:from-[#d9f99d] enabled:via-[#84cc16] enabled:to-[#4d7c0f] enabled:hover:brightness-105 enabled:border-[#1a2e05] enabled:text-[#14161d] enabled:shadow-[0_4px_0_#1a2e05] disabled:bg-[#e5dec9] disabled:border-[#a89f88] disabled:text-[#78716c] disabled:cursor-not-allowed"
              >
                <RotateCw
                  className={`w-4 h-4 stroke-[2.8] shrink-0 ${isSpinning ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span className="font-mono-tabular">
                  {isSpinning ? 'Spinning...' : `Spin (${selectedBet} LUL)`}
                </span>
              </button>
            </div>

            {lulBalance < ARCADE_SLOT_MIN_BET_LUL && !isSpinning && (
              <p className="text-[11px] font-bold text-[#78350f] text-center bg-[#fef3c7]/80 border border-[#f59e0b]/50 rounded-lg py-1 px-2.5">
                Need at least {ARCADE_SLOT_MIN_BET_LUL} LUL to play. Work a barista shift or cash out Shift Bucks at the Cafe ATM.
              </p>
            )}

            {/* Warm Cream Paytable Tiles */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {ARCADE_SLOT_SYMBOLS.map((spec) => {
                const isMatchedTile = lastResult?.matchedSymbol?.id === spec.id;
                const isJackpotSymbol = spec.id === 'seven';
                return (
                  <div
                    key={spec.id}
                    className={`flex flex-col items-center py-1.5 px-1 rounded-xl border-2 transition-colors ${
                      isMatchedTile
                        ? 'bg-[#ecfccb] border-[#4d7c0f] shadow-[0_2px_0_#365314]'
                        : isJackpotSymbol
                          ? 'bg-gradient-to-b from-[#fffbeb] to-[#fde68a] border-[#b45309] shadow-[0_2px_0_#78350f]'
                          : 'bg-[#fffdf7] border-[#d6c5a3] shadow-[0_2px_0_#b8a47e]'
                    }`}
                  >
                    <SlotSymbolArtwork id={spec.id} sizeClass="w-8 h-8" />
                    <div className="mt-0.5 text-[10px] font-black font-mono-tabular text-[#451a03] whitespace-nowrap">
                      3x: {spec.tripleMultiplier}x
                    </div>
                    <div className="text-[9px] font-bold font-mono-tabular text-[#92400e] whitespace-nowrap">
                      2x: {spec.pairMultiplier}x
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Clean Session Ledger Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[#efe4ce] border border-[#cbb894] text-[11px] font-extrabold font-mono-tabular text-[#573614]">
              <span>Spins: {sessionStats.spins}</span>
              <span aria-hidden="true" className="text-[#a88b60]">·</span>
              <span>Best Win: {sessionStats.bestWinLul} LUL</span>
              <span aria-hidden="true" className="text-[#a88b60]">·</span>
              <span
                className={
                  sessionStats.netLul > 0
                    ? 'text-[#15803d] font-black'
                    : sessionStats.netLul < 0
                      ? 'text-[#b91c1c] font-black'
                      : 'text-[#573614] font-black'
                }
              >
                Net: {sessionStats.netLul >= 0 ? `+${sessionStats.netLul}` : sessionStats.netLul} LUL
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
