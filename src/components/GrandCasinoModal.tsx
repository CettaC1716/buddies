import React, { useEffect, useState } from 'react';
import { soundEngine } from '../game/audio';
import {
  ArcadePushButton,
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
  respiteBalance: number;
  levelProgress: PlayerLevelProgress;
  onDebitStake: (stakeLul: number) => { ok: boolean; message: string };
  onDebitSlotRespite: (stakeRespite: number) => { ok: boolean; message: string };
  onSettleSlots: (evaluation: ArcadeSlotEvaluation) => void;
  onSettleSlotRespite: (
    payoutRespite: number,
    xpGained: number,
    announceHeadline?: string,
  ) => void;
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
  respiteBalance,
  levelProgress,
  onDebitStake,
  onDebitSlotRespite,
  onSettleSlots,
  onSettleSlotRespite,
  onSettleTableGame,
  onOrderLoungeDrink,
}) => {
  // Strictly single station/game per modal open (no cross-game navigation tabs)
  const activeStation: CasinoTab = initialTab;
  const activeSlotMeta = CASINO_SLOT_VARIANT_META[slotVariant];

  // Cashier & Lounge Bar feedback
  const [cashierStatusMsg, setCashierStatusMsg] = useState<string>(
    'SALON PRIVÉ VAULT · TABLE CHIPS IN LUL · 3D ROYALE SLOTS IN RESPITE',
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
          badgeBgClass: 'bg-[#38bdf8]',
          title: activeSlotMeta.title,
        };
      case 'roulette':
        return {
          badgeText: 'ROULETTE',
          badgeBgClass: 'bg-[#fec83e]',
          title: 'EUROPEAN ROULETTE',
        };
      case 'blackjack':
        return {
          badgeText: 'BLACKJACK 21',
          badgeBgClass: 'bg-[#38bdf8]',
          title: 'SALON PRIVÉ BLACKJACK',
        };
      case 'cashier':
        return {
          badgeText: 'CASHIER CAGE',
          badgeBgClass: 'bg-[#b8ff3c]',
          title: 'CHIP VAULT & EXCHANGE',
        };
      case 'bar':
        return {
          badgeText: 'LOUNGE BAR',
          badgeBgClass: 'bg-[#f472b6]',
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
    const bonusRespite = 15;
    soundEngine.playCasinoJackpotFanfare(false);
    onSettleTableGame(bonusLul, 15, `CASHIER CAGE VIP VOUCHER +${bonusLul} LUL & +${bonusRespite} RESPITE!`);
    onSettleSlotRespite(bonusRespite, 0);
    setCashierStatusMsg(
      `ISSUED +${bonusLul} LUL & +${bonusRespite} RESPITE COMPLIMENTARY VIP VOUCHER!`,
    );
  };

  const handleCashierExchangeLulToRespite = () => {
    const lulCost = 50;
    const respiteOut = 5;
    const debit = onDebitStake(lulCost);
    if (!debit.ok) {
      soundEngine.playHit();
      setCashierStatusMsg(`NEED ${lulCost} LUL TO EXCHANGE FOR ${respiteOut} RESPITE SLOT CREDITS`);
      return;
    }
    soundEngine.playCasinoChipClink(2);
    onSettleSlotRespite(respiteOut, 6, `CASHIER EXCHANGE +${respiteOut} RESPITE SLOT CREDITS`);
    setCashierStatusMsg(`EXCHANGED ${lulCost} LUL → +${respiteOut} RESPITE SLOT CREDITS!`);
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
            respiteBalance={respiteBalance}
            lulBalance={lulBalance}
            onClose={onClose}
            onDebitRespite={onDebitSlotRespite}
            onSettleRespite={onSettleSlotRespite}
            onQuickTopUpRespite={handleCashierExchangeLulToRespite}
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
            respiteBalance={respiteBalance}
            onClose={onClose}
            onDebitStake={onDebitStake}
            onSettleTableGame={onSettleTableGame}
            onDebitRespite={onDebitSlotRespite}
            onSettleRespite={onSettleSlotRespite}
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
            respiteBalance={respiteBalance}
            onClose={onClose}
            onDebitStake={onDebitStake}
            onSettleTableGame={onSettleTableGame}
            onDebitRespite={onDebitSlotRespite}
            onSettleRespite={onSettleSlotRespite}
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 select-none pointer-events-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          soundEngine.playUiCancel();
          onClose();
        }
      }}
    >
      <div aria-hidden="true" className="casino-glassmorph-scrim fixed inset-0 pointer-events-none" />
      <div
        className="relative z-10 w-full max-w-[660px] max-h-[92vh] flex flex-col bg-[#14161d] text-white border-[4px] border-[#14161d] ring-3 ring-white shadow-[8px_8px_0_#000] rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Global Anime-Arcade Header (Aligned with DailyMissionsModal) */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 bg-[#1e212b] border-b-[3px] border-black">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`px-2 py-0.5 text-[#14161d] border-2 border-black text-[10px] font-black uppercase shrink-0 ${headerConfig.badgeBgClass}`}
            >
              {headerConfig.badgeText}
            </span>
            <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-white truncate">
              {headerConfig.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#fec83e] text-[#14161d] border-2 border-black rounded-lg shadow-[2px_2px_0_#000] font-mono-tabular font-black text-xs">
              <CasinoCoinCrestSvg className="w-4 h-4 shrink-0" />
              <span>{lulBalance.toLocaleString()} LUL</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-[#b8ff3c] text-[#14161d] border-2 border-black rounded-lg shadow-[2px_2px_0_#000] font-black text-xs">
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
              className="w-9 h-9 bg-gradient-to-b from-[#ff6b6b] to-[#dc2626] hover:brightness-110 text-white border-[2.5px] border-black rounded-lg shadow-[0_3px_0_#000] active:translate-y-[2px] active:shadow-[0_1px_0_#000] font-black flex items-center justify-center cursor-pointer"
            >
              <CasinoCloseBadgeSvg className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Single-Station Body Content (Zero Cross-Game Tabs) */}
        <div className="p-4 overflow-y-auto bg-white text-[#14161d]">
          {activeStation === 'cashier' && (
            <div className="space-y-3.5">
              <div className="p-4 bg-[#f7efe0] border-[3px] border-black rounded-xl shadow-[4px_4px_0_#000] space-y-3">
                <div className="flex items-center gap-2">
                  <CasinoCrownCrestSvg className="w-5 h-5 shrink-0" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-[#14161d]">
                    CASHIER CAGE &amp; RESPITE SLOT VAULT
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-2.5 bg-white border-2 border-black rounded-lg">
                    <div className="text-[10px] font-black uppercase text-slate-500">
                      TABLE CHIPS (LUL)
                    </div>
                    <div className="text-xl font-black font-mono-tabular text-[#14161d]">
                      {lulBalance.toLocaleString()} LUL
                    </div>
                  </div>
                  <div className="p-2.5 bg-[#0f172a] border-2 border-black rounded-lg text-white">
                    <div className="text-[10px] font-black uppercase text-cyan-300">
                      3D ROYALE SLOT CREDITS (RESPITE)
                    </div>
                    <div className="text-xl font-black font-mono-tabular text-emerald-400">
                      {respiteBalance.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      RESPITE
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <ArcadePushButton
                    onClick={handleCashierVipComplimentaryVoucher}
                    variant="lime"
                    dataAttrs={{ 'data-casino-cashier-voucher-btn': 'true' }}
                  >
                    <span>CLAIM DAILY VIP (+LUL &amp; +15 RESPITE)</span>
                  </ArcadePushButton>
                  <ArcadePushButton
                    onClick={handleCashierExchangeLulToRespite}
                    variant="sky"
                    dataAttrs={{ 'data-casino-cashier-respite-exchange-btn': 'true' }}
                  >
                    <span>50 LUL → +5 RESPITE</span>
                  </ArcadePushButton>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { chip: '1–5 RESPITE', bgClass: 'bg-[#38bdf8]', tier: 'SAPPHIRE SLOT' },
                  { chip: '10–25 RESPITE', bgClass: 'bg-[#34d399]', tier: 'EMERALD SLOT' },
                  { chip: '50–100 RESPITE', bgClass: 'bg-[#fb7185]', tier: 'RUBY VIP' },
                  { chip: '250 RESPITE', bgClass: 'bg-[#fec83e]', tier: 'GRAND ROYALE' },
                ].map((c) => (
                  <div
                    key={c.tier}
                    className={`p-2.5 border-[3px] border-black rounded-xl shadow-[3px_3px_0_#000] text-center text-[#14161d] ${c.bgClass}`}
                  >
                    <div className="text-[9.5px] font-black tracking-wider uppercase">{c.tier}</div>
                    <div className="text-sm font-black font-mono-tabular mt-0.5">{c.chip}</div>
                  </div>
                ))}
              </div>

              <div className="px-3 py-2 bg-[#1e212b] text-[#fec83e] border-[3px] border-black rounded-lg text-center text-xs font-black uppercase">
                {cashierStatusMsg}
              </div>
            </div>
          )}

          {activeStation === 'bar' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {LOUNGE_BAR_MENU.map((drink) => (
                  <div
                    key={drink.id}
                    className="flex flex-col justify-between gap-2.5 p-3 bg-[#f7efe0] border-[3px] border-black rounded-xl shadow-[3px_3px_0_#000]"
                  >
                    <div className="flex items-start gap-2.5">
                      <LoungeCocktailSvg
                        glassFill={drink.glassFill}
                        garnishFill={drink.garnishFill}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-black uppercase text-[#14161d] leading-snug">
                          {drink.name}
                        </div>
                        <div className="text-[11px] font-bold text-slate-600 mt-0.5 leading-snug">
                          {drink.subtitle}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t-2 border-black/15">
                      <span className="text-[10.5px] font-black font-mono-tabular text-[#047857]">
                        +{drink.xpReward} XP
                      </span>
                      <ArcadePushButton
                        onClick={() => handleOrderDrink(drink)}
                        variant="gold"
                        className="px-3 py-1.5 text-[11px]"
                      >
                        <span>ORDER ({drink.costLul} LUL)</span>
                      </ArcadePushButton>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-3 py-2 bg-[#1e212b] text-[#fec83e] border-[3px] border-black rounded-lg text-center text-xs font-black uppercase">
                {barStatusMsg}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

