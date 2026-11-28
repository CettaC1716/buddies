import React, { useEffect, useState } from 'react';
import { soundEngine } from '../game/audio';
import {
  CasinoCloseBadgeSvg,
  CasinoCoinCrestSvg,
  CasinoCrownCrestSvg,
  CasinoTrophyCrestSvg,
} from './CasinoArcadeArtwork';
import type { ArcadeSlotEvaluation } from '../game/buddiesArcadeSlots';
import {
  CASINO_SLOT_VARIANT_META,
  type CasinoSlotGameVariant,
} from '../game/buddiesGrandCasinoRules';
import type { PlayerLevelProgress } from '../game/buddiesCafeRules';
import { CasinoBlackjackInteractivePanel } from './CasinoBlackjackInteractivePanel';
import { CasinoRouletteInteractivePanel } from './CasinoRouletteInteractivePanel';
import { CasinoSlotMachinesPanel } from './CasinoSlotMachinesPanel';

export type CasinoTab = 'slots' | 'roulette' | 'blackjack' | 'cashier' | 'bar';

export interface GrandCasinoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: CasinoTab;
  slotVariant?: CasinoSlotGameVariant;
  lulBalance: number;
  levelProgress: PlayerLevelProgress;
  onDebitStake: (stakeLul: number) => { ok: boolean; message: string };
  onSettleSlots: (evaluation: ArcadeSlotEvaluation) => void;
  onSettleTableGame: (payoutLul: number, xpGained: number, announceHeadline?: string) => void;
  onOrderLoungeDrink?: (
    drinkName: string,
    costLul: number,
    xpReward: number,
  ) => { ok: boolean; message: string };
}

const LOUNGE_BAR_MENU: ReadonlyArray<{
  id: string;
  name: string;
  subtitle: string;
  costLul: number;
  xpReward: number;
  glassFill: string;
  garnishFill: string;
}> = [
  {
    id: 'espresso_martini',
    name: 'Vintage Espresso Martini',
    subtitle: 'Single-origin roast shaken with Madagascar vanilla cream',
    costLul: 15,
    xpReward: 24,
    glassFill: '#92400e',
    garnishFill: '#fde68a',
  },
  {
    id: 'monte_carlo_spritz',
    name: 'Monte Carlo Gold Spritz',
    subtitle: 'Sparkling blood-orange aperitif garnished with gold citrus',
    costLul: 25,
    xpReward: 40,
    glassFill: '#f97316',
    garnishFill: '#fec83e',
  },
  {
    id: 'velvet_negroni_zero',
    name: 'Velvet Negroni Reserve',
    subtitle: 'Botanical cedar & hibiscus infusion over crystal sphere ice',
    costLul: 35,
    xpReward: 58,
    glassFill: '#e11d48',
    garnishFill: '#fda4af',
  },
  {
    id: 'royal_champagne_flute',
    name: 'Salon Privé Grand Brut',
    subtitle: 'Chilled Grand Cru flute for high-roller celebrations',
    costLul: 50,
    xpReward: 90,
    glassFill: '#facc15',
    garnishFill: '#b8ff3c',
  },
];

const LoungeCocktailSvg: React.FC<{ glassFill: string; garnishFill: string }> = ({
  glassFill,
  garnishFill,
}) => (
  <svg viewBox="0 0 48 48" className="w-10 h-10 shrink-0" aria-hidden="true">
    <polygon
      points="9,12 39,12 24,27"
      fill={glassFill}
      stroke="#14161d"
      strokeWidth="2.8"
      strokeLinejoin="round"
    />
    <line x1="24" y1="27" x2="24" y2="41" stroke="#14161d" strokeWidth="3" strokeLinecap="round" />
    <line x1="15" y1="41" x2="33" y2="41" stroke="#14161d" strokeWidth="3.2" strokeLinecap="round" />
    <circle cx="35" cy="12" r="5" fill={garnishFill} stroke="#14161d" strokeWidth="2.2" />
    <line x1="21" y1="15" x2="14" y2="6" stroke="#14161d" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

export const GrandCasinoModal: React.FC<GrandCasinoModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'slots',
  slotVariant = 'lucky_draw',
  lulBalance,
  levelProgress,
  onDebitStake,
  onSettleSlots,
  onSettleTableGame,
  onOrderLoungeDrink,
}) => {
  // Strictly single station/game per modal open (no cross-game navigation tabs)
  const activeStation: CasinoTab = initialTab;
  const activeSlotMeta = CASINO_SLOT_VARIANT_META[slotVariant];

  // Cashier & Lounge Bar feedback
  const [cashierStatusMsg, setCashierStatusMsg] = useState<string>(
    'SALON PRIVÉ VAULT · TABLE CHIPS & 3D ROYALE SLOTS IN CerBucks',
  );
  const [barStatusMsg, setBarStatusMsg] = useState<string>(
    'SELECT A SIGNATURE COCKTAIL TO ORDER & EARN BONUS XP',
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        soundEngine.playUiClick();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const headerConfig = (() => {
    switch (activeStation) {
      case 'slots':
        return {
          badgeText: 'SLOT ARCADE',
          badgeBgClass: 'bg-sky-400/15 text-sky-300 border-sky-400/30',
          title: activeSlotMeta.title,
        };
      case 'roulette':
        return {
          badgeText: 'ROULETTE',
          badgeBgClass: 'bg-amber-300/15 text-amber-300 border-amber-300/30',
          title: 'EUROPEAN ROULETTE',
        };
      case 'blackjack':
        return {
          badgeText: 'BLACKJACK 21',
          badgeBgClass: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30',
          title: 'SALON PRIVÉ BLACKJACK',
        };
      case 'cashier':
        return {
          badgeText: 'CASHIER CAGE',
          badgeBgClass: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30',
          title: 'CHIP VAULT & EXCHANGE',
        };
      case 'bar':
        return {
          badgeText: 'LOUNGE BAR',
          badgeBgClass: 'bg-amber-300/15 text-amber-300 border-amber-300/30',
          title: 'SIGNATURE COCKTAIL BAR',
        };
    }
  })();

  const handleCashierVipComplimentaryVoucher = () => {
    const voucherKey = `bb_casino_daily_voucher_v1:${new Date().toISOString().slice(0, 10)}`;
    try {
      if (window.localStorage.getItem(voucherKey) === '1') {
        soundEngine.playHit();
        setCashierStatusMsg('DAILY COMPLIMENTARY HIGH-ROLLER VOUCHER ALREADY CLAIMED TODAY');
        return;
      }
      window.localStorage.setItem(voucherKey, '1');
    } catch {
      // ignore storage errors
    }
    const bonusLul = 25 + Math.min(50, levelProgress.level * 5);
    soundEngine.playCasinoJackpotFanfare(false);
    onSettleTableGame(bonusLul, 15, `CASHIER CAGE VIP VOUCHER +${bonusLul} CerBucks!`);
    setCashierStatusMsg(`ISSUED +${bonusLul} CerBucks COMPLIMENTARY VIP VOUCHER!`);
  };

  const handleOrderDrink = (drink: (typeof LOUNGE_BAR_MENU)[number]) => {
    if (onOrderLoungeDrink) {
      const res = onOrderLoungeDrink(drink.name, drink.costLul, drink.xpReward);
      if (!res.ok) {
        soundEngine.playHit();
        setBarStatusMsg(res.message.toUpperCase());
        return;
      }
      soundEngine.playOrderBell();
      setBarStatusMsg(res.message.toUpperCase());
      return;
    }
    const debit = onDebitStake(drink.costLul);
    if (!debit.ok) {
      soundEngine.playHit();
      setBarStatusMsg(debit.message.toUpperCase());
      return;
    }
    soundEngine.playOrderBell();
    onSettleTableGame(0, drink.xpReward, `ENJOYED ${drink.name.toUpperCase()} (+${drink.xpReward} XP)`);
    setBarStatusMsg(`SERVED ${drink.name.toUpperCase()} · +${drink.xpReward} XP!`);
  };

  // Floating 3D Perspective Grand Royale Slot Cabinet stage over dimmed glassmorphism backdrop
  if (activeStation === 'slots') {
    return (
      <div
        data-grand-casino-modal="true"
        data-casino-active-station={activeStation}
        role="dialog"
        aria-modal="true"
        aria-label={headerConfig.title}
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 select-none pointer-events-auto overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            soundEngine.playUiCancel();
            onClose();
          }
        }}
      >
        <div aria-hidden="true" className="casino-glassmorph-scrim fixed inset-0 pointer-events-none" />
        <div
          className="relative z-10 w-full max-w-[1180px] my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <CasinoSlotMachinesPanel
            variant={slotVariant}
            isActive={isOpen && activeStation === 'slots'}
            lulBalance={lulBalance}
            onClose={onClose}
            onDebitLul={onDebitStake}
            onSettleLul={onSettleTableGame}
            onSettleClassicEvaluation={onSettleSlots}
          />
        </div>
      </div>
    );
  }

  if (activeStation === 'roulette') {
    return (
      <div
        data-grand-casino-modal="true"
        data-casino-active-station={activeStation}
        role="dialog"
        aria-modal="true"
        aria-label={headerConfig.title}
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 select-none pointer-events-auto overflow-y-auto overflow-x-hidden"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            soundEngine.playUiCancel();
            onClose();
          }
        }}
      >
        <div aria-hidden="true" className="casino-glassmorph-scrim fixed inset-0 pointer-events-none" />
        <div
          className="relative z-10 w-full max-w-[1360px] my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <CasinoRouletteInteractivePanel
            isActive={isOpen && activeStation === 'roulette'}
            lulBalance={lulBalance}
            onClose={onClose}
            onDebitStake={onDebitStake}
            onSettleTableGame={onSettleTableGame}
          />
        </div>
      </div>
    );
  }

  if (activeStation === 'blackjack') {
    return (
      <div
        data-grand-casino-modal="true"
        data-casino-active-station={activeStation}
        role="dialog"
        aria-modal="true"
        aria-label={headerConfig.title}
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 select-none pointer-events-auto overflow-y-auto overflow-x-hidden"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            soundEngine.playUiCancel();
            onClose();
          }
        }}
      >
        <div aria-hidden="true" className="casino-glassmorph-scrim fixed inset-0 pointer-events-none" />
        <div
          className="relative z-10 w-full max-w-[1260px] my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <CasinoBlackjackInteractivePanel
            isActive={isOpen && activeStation === 'blackjack'}
            lulBalance={lulBalance}
            onClose={onClose}
            onDebitStake={onDebitStake}
            onSettleTableGame={onSettleTableGame}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      data-grand-casino-modal="true"
      data-casino-active-station={activeStation}
      role="dialog"
      aria-modal="true"
      aria-label={headerConfig.title}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-sm select-none pointer-events-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          soundEngine.playUiCancel();
          onClose();
        }
      }}
    >
      <div
        className="relative z-10 w-full max-w-[680px] max-h-[92vh] flex flex-col rounded-[26px] bg-[#0e121b]/88 backdrop-blur-2xl border border-white/15 shadow-[0_24px_70px_rgba(0,0,0,0.62)] text-white overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dark Luxury Frosted Glass Header */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 bg-white/[0.03] border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider shrink-0 ${headerConfig.badgeBgClass}`}
            >
              {headerConfig.badgeText}
            </span>
            <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-white truncate">
              {headerConfig.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-300/15 text-amber-300 border border-amber-300/30 font-mono-tabular font-bold text-xs">
              <CasinoCoinCrestSvg className="w-4 h-4 shrink-0" />
              <span>{lulBalance.toLocaleString()} CerBucks</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 font-bold text-xs">
              <CasinoTrophyCrestSvg className="w-4 h-4 shrink-0" />
              <span>LV.{levelProgress.level}</span>
            </div>
            <button
              type="button"
              data-grand-casino-close-btn="true"
              onClick={() => {
                soundEngine.playUiCancel();
                onClose();
              }}
              aria-label="Exit Grand Casino Modal"
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white active:scale-95 transition-all flex items-center justify-center cursor-pointer"
            >
              <CasinoCloseBadgeSvg className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Single-Station Body Content (Zero Cross-Game Tabs) */}
        <div className="p-5 overflow-y-auto">
          {activeStation === 'cashier' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/[0.05] border border-white/10 space-y-3.5">
                <div className="flex items-center gap-2">
                  <CasinoCrownCrestSvg className="w-5 h-5 shrink-0" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-amber-300">
                    CASHIER CAGE &amp; SLOT VAULT
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-white/[0.05] border border-white/10">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      TABLE CHIPS (CerBucks)
                    </div>
                    <div className="text-xl font-extrabold font-mono-tabular text-amber-300 mt-0.5">
                      {lulBalance.toLocaleString()} CerBucks
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/[0.05] border border-emerald-400/25">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/90">
                      3D ROYALE SLOTS (CerBucks)
                    </div>
                    <div className="text-xl font-extrabold font-mono-tabular text-emerald-400 mt-0.5">
                      {lulBalance.toLocaleString()} CerBucks
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                  <button
                    type="button"
                    data-casino-cashier-voucher-btn="true"
                    onClick={handleCashierVipComplimentaryVoucher}
                    className="flex-1 min-w-[200px] px-4 py-2.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs uppercase tracking-wider cursor-pointer active:scale-[0.98] transition-all shadow-sm"
                  >
                    CLAIM DAILY VIP (+CerBucks)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { chip: '1–5 CerBucks', accentClass: 'text-sky-300 border-sky-400/25', tier: 'SAPPHIRE SLOT' },
                  { chip: '10–25 CerBucks', accentClass: 'text-emerald-300 border-emerald-400/25', tier: 'EMERALD SLOT' },
                  { chip: '50–100 CerBucks', accentClass: 'text-rose-300 border-rose-400/25', tier: 'RUBY VIP' },
                  { chip: '250 CerBucks', accentClass: 'text-amber-300 border-amber-300/30', tier: 'GRAND ROYALE' },
                ].map((c) => (
                  <div
                    key={c.tier}
                    className={`p-3 rounded-2xl bg-white/[0.05] border text-center ${c.accentClass}`}
                  >
                    <div className="text-[9.5px] font-bold tracking-wider uppercase opacity-85">{c.tier}</div>
                    <div className="text-sm font-extrabold font-mono-tabular text-white mt-0.5">{c.chip}</div>
                  </div>
                ))}
              </div>

              <div className="px-4 py-2.5 rounded-2xl bg-white/[0.05] border border-amber-300/25 text-amber-300 text-center text-xs font-bold uppercase tracking-wide">
                {cashierStatusMsg}
              </div>
            </div>
          )}

          {activeStation === 'bar' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {LOUNGE_BAR_MENU.map((drink) => (
                  <div
                    key={drink.id}
                    className="flex flex-col justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.05] border border-white/10 hover:border-amber-300/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
                        <LoungeCocktailSvg
                          glassFill={drink.glassFill}
                          garnishFill={drink.garnishFill}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold uppercase text-white leading-snug">
                          {drink.name}
                        </div>
                        <div className="text-[11px] font-medium text-slate-300 mt-0.5 leading-snug">
                          {drink.subtitle}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2.5 border-t border-white/10">
                      <span className="text-[11px] font-bold font-mono-tabular text-emerald-400">
                        +{drink.xpReward} XP
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOrderDrink(drink)}
                        className="px-4 py-1.5 rounded-full bg-amber-300 hover:bg-amber-200 text-slate-950 font-bold text-[11px] uppercase tracking-wide cursor-pointer active:scale-95 transition-all"
                      >
                        ORDER ({drink.costLul} CerBucks)
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-4 py-2.5 rounded-2xl bg-white/[0.05] border border-amber-300/25 text-amber-300 text-center text-xs font-bold uppercase tracking-wide">
                {barStatusMsg}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

