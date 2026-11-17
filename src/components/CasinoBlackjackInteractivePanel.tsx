import React, { useCallback, useEffect, useRef, useState } from 'react';
import { soundEngine } from '../game/audio';
import {
  type CardRank,
  type CardSuit,
  type PlayingCard,
  evaluateBlackjackHandTotal,
} from '../game/buddiesGrandCasinoGames';

export interface CasinoBlackjackInteractivePanelProps {
  isActive: boolean;
  lulBalance: number;
  respiteBalance?: number;
  onClose?: () => void;
  onDebitStake: (stakeLul: number) => { ok: boolean; message: string };
  onSettleTableGame: (payoutLul: number, xpGained: number, announceHeadline?: string) => void;
  onDebitRespite?: (stakeRespite: number) => { ok: boolean; message: string };
  onSettleRespite?: (payoutRespite: number, xpGained: number, announceHeadline?: string) => void;
}

type BjCurrencyMode = 'LUL' | 'RESPITE';
type BjPhase = 'BETTING' | 'PLAYER_TURN' | 'DEALER_TURN';

interface BjChipSpec {
  value: number;
  label: string;
  outerHex: string;
  stripeHex: string;
  innerHex: string;
  ringHex: string;
  textHex: string;
  tiltClass: string;
}

const BJ_CLAY_CHIPS: readonly BjChipSpec[] = [
  {
    value: 1,
    label: '1',
    outerHex: '#2563eb',
    stripeHex: '#f8fafc',
    innerHex: '#1d4ed8',
    ringHex: '#bfdbfe',
    textHex: '#ffffff',
    tiltClass: '-rotate-6',
  },
  {
    value: 5,
    label: '5',
    outerHex: '#dc2626',
    stripeHex: '#f8fafc',
    innerHex: '#b91c1c',
    ringHex: '#fecaca',
    textHex: '#ffffff',
    tiltClass: '-rotate-3',
  },
  {
    value: 25,
    label: '25',
    outerHex: '#15803d',
    stripeHex: '#f8fafc',
    innerHex: '#047857',
    ringHex: '#a7f3d0',
    textHex: '#ffffff',
    tiltClass: '-rotate-1',
  },
  {
    value: 100,
    label: '100',
    outerHex: '#111827',
    stripeHex: '#f59e0b',
    innerHex: '#090d16',
    ringHex: '#fbbf24',
    textHex: '#fcd34d',
    tiltClass: 'rotate-1',
  },
  {
    value: 500,
    label: '500',
    outerHex: '#7c3aed',
    stripeHex: '#f472b6',
    innerHex: '#581c87',
    ringHex: '#f9a8d4',
    textHex: '#fce7f3',
    tiltClass: 'rotate-3',
  },
];

const SUITS: readonly CardSuit[] = ['♠', '♥', '♦', '♣'];
const RANKS: readonly CardRank[] = [
  '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A',
];
const STRIPE_ANGLES = [0, 40, 80, 120, 160, 200, 240, 280, 320] as const;

function buildSixDeckShoe(): PlayingCard[] {
  const shoe: PlayingCard[] = [];
  for (let d = 0; d < 6; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        shoe.push({ rank, suit });
      }
    }
  }
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shoe[i];
    shoe[i] = shoe[j];
    shoe[j] = tmp;
  }
  return shoe;
}

function pickBjChipSpecForAmount(amount: number): BjChipSpec {
  for (let i = BJ_CLAY_CHIPS.length - 1; i >= 0; i--) {
    if (amount >= BJ_CLAY_CHIPS[i].value) return BJ_CLAY_CHIPS[i];
  }
  return BJ_CLAY_CHIPS[0];
}

function formatCompactVal(amount: number): string {
  if (amount >= 1000) {
    const k = amount / 1000;
    return Number.isInteger(k) ? `${k}K` : `${k.toFixed(1)}K`;
  }
  return String(amount);
}

const ClayStripedChipSvg: React.FC<{
  spec: BjChipSpec;
  displayText?: string;
  selected?: boolean;
  sizeClass?: string;
}> = ({ spec, displayText, selected = false, sizeClass = 'w-11 h-11 sm:w-12 sm:h-12' }) => {
  const text = displayText ?? spec.label;
  return (
    <svg viewBox="0 0 60 60" className={`${sizeClass} shrink-0`} aria-hidden="true">
      {selected && (
        <>
          <circle cx="30" cy="30" r="28.5" fill="rgba(250,204,21,0.24)" />
          <circle cx="30" cy="30" r="27" fill="none" stroke="#fde047" strokeWidth="2.4" />
        </>
      )}
      {/* 3D Clay Bottom Thickness Shadow */}
      <ellipse cx="30" cy="33.5" rx="23.5" ry="22.5" fill="rgba(0,0,0,0.62)" />
      <circle cx="30" cy="31" r="23" fill="#090d14" />
      {/* Main Outer Clay Body */}
      <circle cx="30" cy="28.5" r="23" fill={spec.outerHex} />
      {/* 9 Casino Edge Stripes */}
      {STRIPE_ANGLES.map((deg) => (
        <g key={deg} transform={`rotate(${deg} 30 28.5)`}>
          <rect x="27.4" y="5.6" width="5.2" height="5.2" rx="1" fill={spec.stripeHex} />
        </g>
      ))}
      {/* Inner Medallion Inlay */}
      <circle
        cx="30"
        cy="28.5"
        r="16.5"
        fill={spec.innerHex}
        stroke={spec.ringHex}
        strokeWidth="1.5"
        strokeDasharray="3.5 2.5"
      />
      {/* Top Gloss Highlight */}
      <path
        d="M 15 19 A 18 18 0 0 1 45 19"
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <text
        x="30"
        y="29"
        fill={spec.textHex}
        fontSize={text.length >= 4 ? '10' : text.length === 3 ? '11.5' : '13'}
        fontWeight="900"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {text}
      </text>
    </svg>
  );
};

const LuxuryPlayingCardSvg: React.FC<{
  card: PlayingCard;
  hidden?: boolean;
  uid: string;
}> = ({ card, hidden = false, uid }) => {
  const gradId = `bj-card-face-${uid}`;
  const backGradId = `bj-card-back-${uid}`;
  const isRed = card.suit === '♥' || card.suit === '♦';
  const inkHex = isRed ? '#dc2626' : '#0f172a';
  const isCourt = card.rank === 'J' || card.rank === 'Q' || card.rank === 'K';

  if (hidden) {
    return (
      <div className="bj-card-deal-anim w-[72px] h-[102px] sm:w-[80px] sm:h-[112px] shrink-0 drop-shadow-[0_14px_20px_rgba(0,0,0,0.78)]">
        <svg viewBox="0 0 84 118" className="w-full h-full" aria-label="Hidden Dealer Hole Card">
          <defs>
            <radialGradient id={backGradId} cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="#9f1239" />
              <stop offset="68%" stopColor="#4c0519" />
              <stop offset="100%" stopColor="#1f020a" />
            </radialGradient>
          </defs>
          <rect
            x="1.5"
            y="1.5"
            width="81"
            height="115"
            rx="8"
            fill={`url(#${backGradId})`}
            stroke="#fde047"
            strokeWidth="2.6"
          />
          <rect
            x="6.5"
            y="6.5"
            width="71"
            height="105"
            rx="5"
            fill="none"
            stroke="rgba(253,224,71,0.55)"
            strokeWidth="1.2"
            strokeDasharray="4 3"
          />
          {/* Royal Filigree Diamond Crest */}
          <polygon
            points="42,26 60,59 42,92 24,59"
            fill="rgba(0,0,0,0.28)"
            stroke="rgba(253,224,71,0.45)"
            strokeWidth="1.1"
          />
          <circle
            cx="42"
            cy="55"
            r="14"
            fill="#14070b"
            stroke="#fde047"
            strokeWidth="1.4"
          />
          <text
            x="42"
            y="55.5"
            fill="#fde047"
            fontSize="15"
            fontWeight="900"
            textAnchor="middle"
            dominantBaseline="central"
          >
            ♠
          </text>
          <text
            x="42"
            y="79"
            fill="#fef08a"
            fontSize="6.8"
            fontWeight="800"
            letterSpacing="1.6"
            textAnchor="middle"
          >
            GOLDEN
          </text>
        </svg>
      </div>
    );
  }

  return (
    <div className="bj-card-deal-anim w-[72px] h-[102px] sm:w-[80px] sm:h-[112px] shrink-0 drop-shadow-[0_14px_20px_rgba(0,0,0,0.78)]">
      <svg
        viewBox="0 0 84 118"
        className="w-full h-full"
        aria-label={`${card.rank} of ${card.suit}`}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="68%" stopColor="#faf7f0" />
            <stop offset="100%" stopColor="#ece3d3" />
          </linearGradient>
        </defs>
        <rect
          x="1.5"
          y="1.5"
          width="81"
          height="115"
          rx="8"
          fill={`url(#${gradId})`}
          stroke="#d4af37"
          strokeWidth="2"
        />
        <rect
          x="5.5"
          y="5.5"
          width="73"
          height="107"
          rx="5"
          fill="none"
          stroke="rgba(212,175,55,0.28)"
          strokeWidth="0.9"
        />

        {/* Top-Left Corner Index */}
        <text
          x="13"
          y="19"
          fill={inkHex}
          fontSize={card.rank === '10' ? '13.5' : '15'}
          fontWeight="900"
          textAnchor="middle"
        >
          {card.rank}
        </text>
        <text x="13" y="32.5" fill={inkHex} fontSize="13" fontWeight="800" textAnchor="middle">
          {card.suit}
        </text>

        {/* Center Suit / Court Emblem */}
        {isCourt && (
          <polygon
            points="31,42 36,35 42,40 48,35 53,42"
            fill="#d97706"
            stroke="#92400e"
            strokeWidth="0.8"
          />
        )}
        <text
          x="42"
          y={isCourt ? '64' : '61'}
          fill={inkHex}
          fontSize="34"
          fontWeight="900"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {card.suit}
        </text>

        {/* Rotated Bottom-Right Corner Index */}
        <g transform="rotate(180 42 59)">
          <text
            x="13"
            y="19"
            fill={inkHex}
            fontSize={card.rank === '10' ? '13.5' : '15'}
            fontWeight="900"
            textAnchor="middle"
          >
            {card.rank}
          </text>
          <text x="13" y="32.5" fill={inkHex} fontSize="13" fontWeight="800" textAnchor="middle">
            {card.suit}
          </text>
        </g>
      </svg>
    </div>
  );
};

export const CasinoBlackjackInteractivePanel: React.FC<CasinoBlackjackInteractivePanelProps> = ({
  lulBalance,
  respiteBalance = 0,
  onClose,
  onDebitStake,
  onSettleTableGame,
  onDebitRespite,
  onSettleRespite,
}) => {
  const canUseRespite = Boolean(onDebitRespite && onSettleRespite);
  const [currencyMode, setCurrencyMode] = useState<BjCurrencyMode>(() =>
    lulBalance <= 0 && respiteBalance > 0 && onDebitRespite && onSettleRespite ? 'RESPITE' : 'LUL',
  );

  const rawVaultBalance =
    currencyMode === 'RESPITE' && canUseRespite
      ? Math.max(0, Math.floor(respiteBalance))
      : Math.max(0, Math.floor(lulBalance));

  const shoeRef = useRef<PlayingCard[]>(buildSixDeckShoe());
  const [shoeCount, setShoeCount] = useState<number>(() => shoeRef.current.length);

  const [phase, setPhase] = useState<BjPhase>('BETTING');
  const [selectedChip, setSelectedChip] = useState<number>(() =>
    rawVaultBalance >= 100 ? 100 : rawVaultBalance >= 25 ? 25 : rawVaultBalance >= 5 ? 5 : 1,
  );
  const [anteBet, setAnteBet] = useState<number>(() =>
    rawVaultBalance >= 25 ? 25 : rawVaultBalance >= 5 ? 5 : rawVaultBalance >= 1 ? 1 : 0,
  );
  const [tieSideBet, setTieSideBet] = useState<number>(0);
  const [doubledRaiseBet, setDoubledRaiseBet] = useState<number>(0);
  const [lastRoundBets, setLastRoundBets] = useState<{ ante: number; tie: number }>({
    ante: 25,
    tie: 0,
  });

  // Showcase royal Blackjack hand on table before first deal (just like reference HTML!)
  const [dealerHand, setDealerHand] = useState<PlayingCard[]>([
    { rank: 'K', suit: '♠' },
    { rank: '8', suit: '♦' },
  ]);
  const [playerHand, setPlayerHand] = useState<PlayingCard[]>([
    { rank: 'A', suit: '♠' },
    { rank: 'J', suit: '♥' },
  ]);
  const [dealerHoleHidden, setDealerHoleHidden] = useState<boolean>(true);
  const [hasDealtAtLeastOnce, setHasDealtAtLeastOnce] = useState<boolean>(false);

  const [roundBadgeText, setRoundBadgeText] = useState<string | null>(null);
  const [centerBanner, setCenterBanner] = useState<{
    text: string;
    tone: 'win' | 'loss' | 'push' | 'info';
  } | null>(null);

  const committedRoundRef = useRef<{
    ante: number;
    raise: number;
    tie: number;
    currency: BjCurrencyMode;
  }>({
    ante: 0,
    raise: 0,
    tie: 0,
    currency: 'LUL',
  });

  const dealerTimerRef = useRef<number | null>(null);
  const bannerTimerRef = useRef<number | null>(null);
  const onSettleLulRef = useRef(onSettleTableGame);
  const onSettleRespiteRef = useRef(onSettleRespite);

  useEffect(() => {
    onSettleLulRef.current = onSettleTableGame;
    onSettleRespiteRef.current = onSettleRespite;
  }, [onSettleTableGame, onSettleRespite]);

  useEffect(() => {
    return () => {
      if (dealerTimerRef.current !== null) window.clearTimeout(dealerTimerRef.current);
      if (bannerTimerRef.current !== null) window.clearTimeout(bannerTimerRef.current);
    };
  }, []);

  // Clamp staged bets if external balance drops while in BETTING phase
  const safeStagedAnte =
    phase === 'BETTING' ? Math.min(anteBet, rawVaultBalance) : anteBet;
  const safeStagedTie =
    phase === 'BETTING'
      ? Math.min(tieSideBet, Math.max(0, rawVaultBalance - safeStagedAnte))
      : tieSideBet;
  const totalDisplayedBet = safeStagedAnte + safeStagedTie + doubledRaiseBet;
  const displayedAvailableBalance =
    phase === 'BETTING'
      ? Math.max(0, rawVaultBalance - safeStagedAnte - safeStagedTie)
      : rawVaultBalance;

  const triggerCenterBanner = useCallback(
    (text: string, tone: 'win' | 'loss' | 'push' | 'info') => {
      if (bannerTimerRef.current !== null) {
        window.clearTimeout(bannerTimerRef.current);
      }
      setCenterBanner({ text, tone });
      bannerTimerRef.current = window.setTimeout(() => {
        setCenterBanner(null);
      }, 2500);
    },
    [],
  );

  const drawFromShoe = useCallback((): PlayingCard => {
    if (shoeRef.current.length < 52) {
      shoeRef.current = buildSixDeckShoe();
    }
    const card = shoeRef.current.pop()!;
    setShoeCount(shoeRef.current.length);
    return card;
  }, []);

  // Resolve Dealer Hand & Settle Wallet
  const resolveDealerAndSettle = useCallback(
    (
      currentPlayerHand: PlayingCard[],
      initialDealerHand: PlayingCard[],
      playerNaturalBj: boolean,
    ) => {
      setPhase('DEALER_TURN');
      setDealerHoleHidden(false);

      const stepDealer = (workingDealer: PlayingCard[]) => {
        const dEval = evaluateBlackjackHandTotal(workingDealer);
        const pEval = evaluateBlackjackHandTotal(currentPlayerHand);
        const { ante, raise, tie, currency } = committedRoundRef.current;
        const mainStake = ante + raise;

        if (playerNaturalBj) {
          const dealerNaturalBj = dEval.isBlackjack;
          let payout = 0;
          let xp = 6;
          if (dealerNaturalBj) {
            payout = mainStake + (tie > 0 ? tie * 11 : 0);
            xp = 8;
            setRoundBadgeText('PUSH 21');
            triggerCenterBanner(
              tie > 0
                ? `PUSH + TIE BONUS +${(tie * 11).toLocaleString()} ${currency}!`
                : 'PUSH (BOTH BLACKJACK)',
              tie > 0 ? 'win' : 'push',
            );
          } else {
            // 3 to 2 natural Blackjack payout (2.5x total return on Ante)
            payout = Math.floor(mainStake * 2.5);
            xp = 24;
            setRoundBadgeText('★ BLACKJACK!');
            triggerCenterBanner(
              `★ BLACKJACK 3:2! +${payout.toLocaleString()} ${currency}`,
              'win',
            );
          }

          if (currency === 'RESPITE' && onSettleRespiteRef.current) {
            onSettleRespiteRef.current(
              payout,
              xp,
              payout > mainStake ? `NATURAL BLACKJACK 21! +${payout} RESPITE` : undefined,
            );
          } else {
            onSettleLulRef.current(
              payout,
              xp,
              payout > mainStake ? `NATURAL BLACKJACK 21! +${payout} LUL` : undefined,
            );
          }

          if (payout > mainStake) soundEngine.playCasinoJackpotFanfare(true);
          else soundEngine.playCasinoChipClink(1);

          setDoubledRaiseBet(0);
          setPhase('BETTING');
          return;
        }

        if (dEval.total < 17) {
          dealerTimerRef.current = window.setTimeout(() => {
            soundEngine.playCardDealFlip();
            const nextCard = drawFromShoe();
            const nextDealer = [...workingDealer, nextCard];
            setDealerHand(nextDealer);
            stepDealer(nextDealer);
          }, 430);
          return;
        }

        // Settle final comparison
        let mainPayout = 0;
        let tiePayout = 0;
        let xp = 2;

        if (dEval.isBust) {
          mainPayout = mainStake * 2;
          xp = 12;
          setRoundBadgeText('★ PLAYER WINS!');
          triggerCenterBanner(
            `DEALER BUSTS (${dEval.total}) · +${mainPayout.toLocaleString()} ${currency}!`,
            'win',
          );
        } else if (pEval.total > dEval.total) {
          mainPayout = mainStake * 2;
          xp = 12;
          setRoundBadgeText('★ PLAYER WINS!');
          triggerCenterBanner(
            `PLAYER WINS ${pEval.total} TO ${dEval.total} · +${mainPayout.toLocaleString()} ${currency}!`,
            'win',
          );
        } else if (pEval.total < dEval.total) {
          mainPayout = 0;
          xp = 2;
          setRoundBadgeText('DEALER WINS');
          triggerCenterBanner(`DEALER WINS ${dEval.total} TO ${pEval.total}`, 'loss');
        } else {
          // Push! Return mainStake + pay 10:1 (11x return) on Tie Side Bet if placed!
          mainPayout = mainStake;
          tiePayout = tie > 0 ? tie * 11 : 0;
          xp = tie > 0 ? 18 : 4;
          setRoundBadgeText(tie > 0 ? '★ TIE BONUS 10:1!' : 'PUSH');
          triggerCenterBanner(
            tie > 0
              ? `TIE AT ${pEval.total}! BONUS +${tiePayout.toLocaleString()} ${currency}!`
              : `PUSH: TIED AT ${pEval.total}`,
            tie > 0 ? 'win' : 'push',
          );
        }

        const totalPayout = mainPayout + tiePayout;
        const totalRisked = mainStake + tie;
        const headline =
          totalPayout > totalRisked
            ? `BLACKJACK WIN +${totalPayout.toLocaleString()} ${currency}!`
            : undefined;

        if (currency === 'RESPITE' && onSettleRespiteRef.current) {
          onSettleRespiteRef.current(totalPayout, xp, headline);
        } else {
          onSettleLulRef.current(totalPayout, xp, headline);
        }

        if (totalPayout > totalRisked) {
          soundEngine.playCasinoJackpotFanfare(false);
        } else {
          soundEngine.playSoftTap();
        }

        setDoubledRaiseBet(0);
        setPhase('BETTING');
      };

      dealerTimerRef.current = window.setTimeout(() => {
        stepDealer(initialDealerHand);
      }, 420);
    },
    [drawFromShoe, triggerCenterBanner],
  );

  // Betting Spot Interactions
  const handleAddAnteChip = useCallback(() => {
    if (phase !== 'BETTING') return;
    if (safeStagedAnte + safeStagedTie + selectedChip > rawVaultBalance) {
      soundEngine.playUiCancel();
      triggerCenterBanner(`SALDO ${currencyMode} TIDAK CUKUP`, 'info');
      return;
    }
    soundEngine.playCasinoChipClink(1);
    setAnteBet(safeStagedAnte + selectedChip);
  }, [phase, safeStagedAnte, safeStagedTie, selectedChip, rawVaultBalance, currencyMode, triggerCenterBanner]);

  const handleRemoveAnteChip = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (phase !== 'BETTING' || safeStagedAnte <= 0) return;
      soundEngine.playUiCancel();
      setAnteBet(Math.max(0, safeStagedAnte - selectedChip));
    },
    [phase, safeStagedAnte, selectedChip],
  );

  const handleAddTieChip = useCallback(() => {
    if (phase !== 'BETTING') return;
    if (safeStagedAnte + safeStagedTie + selectedChip > rawVaultBalance) {
      soundEngine.playUiCancel();
      triggerCenterBanner(`SALDO ${currencyMode} TIDAK CUKUP`, 'info');
      return;
    }
    soundEngine.playCasinoChipClink(1);
    setTieSideBet(safeStagedTie + selectedChip);
  }, [phase, safeStagedAnte, safeStagedTie, selectedChip, rawVaultBalance, currencyMode, triggerCenterBanner]);

  const handleRemoveTieChip = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (phase !== 'BETTING' || safeStagedTie <= 0) return;
      soundEngine.playUiCancel();
      setTieSideBet(Math.max(0, safeStagedTie - selectedChip));
    },
    [phase, safeStagedTie, selectedChip],
  );

  const handleClearBet = useCallback(() => {
    if (phase !== 'BETTING') return;
    soundEngine.playUiCancel();
    setAnteBet(0);
    setTieSideBet(0);
    setRoundBadgeText(null);
  }, [phase]);

  const handleRebet = useCallback(() => {
    if (phase !== 'BETTING') return;
    const needed = lastRoundBets.ante + lastRoundBets.tie;
    if (needed <= 0 || needed > rawVaultBalance) {
      soundEngine.playUiCancel();
      triggerCenterBanner(`SALDO ${currencyMode} TIDAK CUKUP UNTUK REBET`, 'info');
      return;
    }
    soundEngine.playCasinoChipClink(2);
    setAnteBet(lastRoundBets.ante);
    setTieSideBet(lastRoundBets.tie);
  }, [phase, lastRoundBets, rawVaultBalance, currencyMode, triggerCenterBanner]);

  const handleDeal = useCallback(() => {
    if (phase !== 'BETTING') return;

    let effectiveAnte = safeStagedAnte;
    const effectiveTie = safeStagedTie;
    if (effectiveAnte <= 0) {
      // Convenience: if player clicks DEAL directly with 0 staged Ante, auto-stage selectedChip (or min affordable chip)
      const fallback =
        rawVaultBalance >= selectedChip
          ? selectedChip
          : rawVaultBalance >= 5
            ? 5
            : rawVaultBalance >= 1
              ? 1
              : 0;
      if (fallback <= 0) {
        soundEngine.playUiCancel();
        triggerCenterBanner(`PASANG TARUHAN ANTE TERLEBIH DAHULU`, 'info');
        return;
      }
      effectiveAnte = fallback;
      setAnteBet(fallback);
    }

    const totalDebit = effectiveAnte + effectiveTie;
    const debitRes =
      currencyMode === 'RESPITE' && onDebitRespite
        ? onDebitRespite(totalDebit)
        : onDebitStake(totalDebit);

    if (!debitRes.ok) {
      soundEngine.playUiCancel();
      triggerCenterBanner(debitRes.message.toUpperCase(), 'info');
      return;
    }

    soundEngine.playCardDealFlip();
    setHasDealtAtLeastOnce(true);
    setLastRoundBets({ ante: effectiveAnte, tie: effectiveTie });
    setDoubledRaiseBet(0);
    setRoundBadgeText(null);
    setCenterBanner(null);

    committedRoundRef.current = {
      ante: effectiveAnte,
      raise: 0,
      tie: effectiveTie,
      currency: currencyMode,
    };

    const p0 = drawFromShoe();
    const d0 = drawFromShoe();
    const p1 = drawFromShoe();
    const d1 = drawFromShoe();
    const nextPlayer = [p0, p1];
    const nextDealer = [d0, d1];

    setPlayerHand(nextPlayer);
    setDealerHand(nextDealer);
    setDealerHoleHidden(true);

    const pEval = evaluateBlackjackHandTotal(nextPlayer);
    const dEval = evaluateBlackjackHandTotal(nextDealer);

    if (pEval.isBlackjack) {
      resolveDealerAndSettle(nextPlayer, nextDealer, true);
      return;
    }

    if (dEval.isBlackjack) {
      // Dealer natural 21 immediately settles
      setDealerHoleHidden(false);
      setPhase('BETTING');
      setRoundBadgeText('DEALER BJ 21');
      triggerCenterBanner('DEALER NATURAL BLACKJACK 21', 'loss');
      if (currencyMode === 'RESPITE' && onSettleRespiteRef.current) {
        onSettleRespiteRef.current(0, 2);
      } else {
        onSettleLulRef.current(0, 2);
      }
      return;
    }

    setPhase('PLAYER_TURN');
  }, [
    phase,
    safeStagedAnte,
    safeStagedTie,
    rawVaultBalance,
    selectedChip,
    currencyMode,
    onDebitRespite,
    onDebitStake,
    drawFromShoe,
    resolveDealerAndSettle,
    triggerCenterBanner,
  ]);

  const handleHit = useCallback(() => {
    if (phase !== 'PLAYER_TURN') return;
    soundEngine.playCardDealFlip();
    const nextCard = drawFromShoe();
    const nextPlayer = [...playerHand, nextCard];
    setPlayerHand(nextPlayer);

    const pEval = evaluateBlackjackHandTotal(nextPlayer);
    if (pEval.isBust) {
      const { currency } = committedRoundRef.current;
      setDealerHoleHidden(false);
      setDoubledRaiseBet(0);
      setPhase('BETTING');
      setRoundBadgeText(`BUST (${pEval.total})`);
      triggerCenterBanner(`BUST! SCORE: ${pEval.total}`, 'loss');
      if (currency === 'RESPITE' && onSettleRespiteRef.current) {
        onSettleRespiteRef.current(0, 2);
      } else {
        onSettleLulRef.current(0, 2);
      }
      return;
    }

    if (pEval.total === 21) {
      resolveDealerAndSettle(nextPlayer, dealerHand, false);
    }
  }, [phase, drawFromShoe, playerHand, dealerHand, resolveDealerAndSettle, triggerCenterBanner]);

  const handleStand = useCallback(() => {
    if (phase !== 'PLAYER_TURN') return;
    soundEngine.playCardDealFlip();
    resolveDealerAndSettle(playerHand, dealerHand, false);
  }, [phase, playerHand, dealerHand, resolveDealerAndSettle]);

  const handleDoubleDown = useCallback(() => {
    if (phase !== 'PLAYER_TURN' || playerHand.length !== 2) return;
    const extraStake = committedRoundRef.current.ante;
    const curMode = committedRoundRef.current.currency;

    const debitRes =
      curMode === 'RESPITE' && onDebitRespite
        ? onDebitRespite(extraStake)
        : onDebitStake(extraStake);

    if (!debitRes.ok) {
      soundEngine.playUiCancel();
      triggerCenterBanner(`SALDO ${curMode} TIDAK CUKUP UNTUK DOUBLE`, 'info');
      return;
    }

    soundEngine.playCasinoChipClink(2);
    soundEngine.playCardDealFlip();
    committedRoundRef.current.raise = extraStake;
    setDoubledRaiseBet(extraStake);

    const nextCard = drawFromShoe();
    const nextPlayer = [...playerHand, nextCard];
    setPlayerHand(nextPlayer);

    const pEval = evaluateBlackjackHandTotal(nextPlayer);
    if (pEval.isBust) {
      setDealerHoleHidden(false);
      setDoubledRaiseBet(0);
      setPhase('BETTING');
      setRoundBadgeText(`BUST (${pEval.total})`);
      triggerCenterBanner(`BUSTED ON DOUBLE (${pEval.total})`, 'loss');
      if (curMode === 'RESPITE' && onSettleRespiteRef.current) {
        onSettleRespiteRef.current(0, 2);
      } else {
        onSettleLulRef.current(0, 2);
      }
      return;
    }

    resolveDealerAndSettle(nextPlayer, dealerHand, false);
  }, [
    phase,
    playerHand,
    dealerHand,
    onDebitRespite,
    onDebitStake,
    drawFromShoe,
    resolveDealerAndSettle,
    triggerCenterBanner,
  ]);

  const dealerVisibleScore = dealerHoleHidden
    ? `${evaluateBlackjackHandTotal(dealerHand.slice(0, 1)).total} + ?`
    : String(evaluateBlackjackHandTotal(dealerHand).total);

  const playerEval = evaluateBlackjackHandTotal(playerHand);
  const playerScoreLabel = playerEval.isBlackjack ? '21 (BJ)' : String(playerEval.total);

  const canDoubleNow =
    phase === 'PLAYER_TURN' &&
    playerHand.length === 2 &&
    rawVaultBalance >= committedRoundRef.current.ante;

  const anteChipSpec = pickBjChipSpecForAmount(Math.max(1, safeStagedAnte));
  const tieChipSpec = pickBjChipSpecForAmount(Math.max(1, safeStagedTie));
  const raiseChipSpec = pickBjChipSpecForAmount(Math.max(1, doubledRaiseBet));

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="bj-viewport-3d w-full max-w-[1220px] mx-auto flex flex-col items-center justify-center px-1 sm:px-3 select-none"
    >
      {/* 3D Perspective Curved Semi-Circular Blackjack Table Stage */}
      <div className="bj-tilted-table-stage w-full relative">
        {/* Outermost Padded Saddle-Leather Semi-Circular Bumper Rail */}
        <div className="bj-bumper-rail w-full p-2.5 sm:p-4 relative">
          {/* Metallic Gold-Brass Bevel Channel */}
          <div className="bj-brass-channel-bevel p-1 sm:p-1.5 w-full">
            {/* Deep Monte Carlo Emerald Felt Playing Surface */}
            <div className="bj-felt-surface w-full min-h-[630px] sm:min-h-[680px] flex flex-col justify-between p-3 sm:p-5 relative border border-emerald-800/80 overflow-hidden">
              {/* Force-Dark-Proof Full-Bleed SVG Monte Carlo Emerald Felt & Gold Pinstripe Rim */}
              <svg
                viewBox="0 0 1200 720"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full pointer-events-none select-none z-0"
                aria-hidden="true"
              >
                <defs>
                  <radialGradient id="bj-emerald-felt-grad" cx="50%" cy="40%" r="66%">
                    <stop offset="0%" stopColor="#1b7a53" />
                    <stop offset="42%" stopColor="#0f593b" />
                    <stop offset="78%" stopColor="#083b27" />
                    <stop offset="100%" stopColor="#042417" />
                  </radialGradient>
                </defs>
                <rect x="0" y="0" width="1200" height="720" fill="url(#bj-emerald-felt-grad)" />
                {/* Subtle Gold-Foil Semi-Circular Inner Table Pinstripe */}
                <path
                  d="M 46,88 C 56,520 270,688 600,688 C 930,688 1144,520 1154,88"
                  fill="none"
                  stroke="#fbbf24"
                  strokeOpacity="0.22"
                  strokeWidth="2"
                />
                <path
                  d="M 62,92 C 74,504 282,672 600,672 C 918,672 1126,504 1138,92"
                  fill="none"
                  stroke="#fde68a"
                  strokeOpacity="0.1"
                  strokeWidth="1"
                  strokeDasharray="6 6"
                />
              </svg>

              {/* 1. TOP DEALER HARDWARE RAIL (6-Deck Shoe, Balance, Dealer Chip Bank, Bet, Discard Tray, Close) */}
              <div className="bj-dealer-top-bar w-full rounded-lg px-3 py-2 flex items-center justify-between gap-2 border-t border-amber-300/30 relative z-20">
                {/* Left: 6-Deck Dealing Shoe + Live Balance */}
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="flex items-center gap-2" title="6-Deck Dealing Shoe">
                    <div className="w-13 sm:w-15 h-10 bg-gradient-to-br from-neutral-800 via-neutral-900 to-black rounded border-2 border-amber-600/50 shadow-inner flex flex-col justify-between p-1">
                      <div className="flex justify-between items-center text-[7px] text-amber-400 font-mono-tabular tracking-tight font-bold">
                        <span>6-DECK</span>
                        <span className="text-amber-200/70">VIP</span>
                      </div>
                      <div className="w-full h-3 bg-red-900/90 border border-red-500/50 rounded-xs flex items-center justify-center">
                        <div className="w-7 h-1 bg-white/75 rounded-full" />
                      </div>
                    </div>
                    <div className="hidden sm:flex flex-col text-left font-mono-tabular">
                      <span className="text-[8px] uppercase tracking-wider text-amber-200/75 font-bold">
                        SHOE
                      </span>
                      <span className="text-xs font-bold text-amber-300">{shoeCount} CARDS</span>
                    </div>
                  </div>

                  {canUseRespite && (
                    <button
                      type="button"
                      disabled={phase !== 'BETTING'}
                      title="Ganti Mata Uang Taruhan (LUL / RESPITE)"
                      onClick={() => {
                        if (phase !== 'BETTING') return;
                        soundEngine.playUiClick();
                        setAnteBet(0);
                        setTieSideBet(0);
                        setCurrencyMode((prev) => (prev === 'LUL' ? 'RESPITE' : 'LUL'));
                      }}
                      className="px-2 py-1 rounded bg-black/65 border border-amber-500/45 text-amber-300 hover:border-amber-300 font-mono-tabular text-[10px] font-bold uppercase cursor-pointer disabled:opacity-40"
                    >
                      {currencyMode} ⇄
                    </button>
                  )}

                  <div className="flex items-center bg-black/65 px-2.5 sm:px-3 py-1 rounded-lg border border-amber-500/40 shadow-inner font-mono-tabular gap-1.5">
                    <span className="text-[9px] uppercase tracking-widest text-amber-300/85 font-cinzel font-bold hidden sm:inline">
                      BALANCE:
                    </span>
                    <span className="text-emerald-400 font-bold text-xs sm:text-sm">
                      {displayedAvailableBalance.toLocaleString()} {currencyMode}
                    </span>
                  </div>
                </div>

                {/* Center: Dealer Bank Chip Inventory Tubes */}
                <div className="hidden lg:flex flex-col items-center">
                  <div className="text-[8px] font-cinzel tracking-[0.24em] text-amber-300/90 uppercase font-bold mb-0.5">
                    DEALER BANK INVENTORY
                  </div>
                  <div className="bg-neutral-950/90 px-2.5 py-1 rounded-lg border-2 border-amber-600/40 flex items-center gap-1.5">
                    {[
                      'bg-blue-600 border-blue-400',
                      'bg-red-600 border-red-400',
                      'bg-emerald-500 border-emerald-300',
                      'bg-neutral-900 border-amber-400',
                      'bg-purple-700 border-purple-400',
                    ].map((tubeColor, idx) => (
                      <div
                        key={idx}
                        className="bj-dealer-rack-tube w-6 h-8 rounded-xs flex flex-col-reverse items-center justify-start p-0.5 overflow-hidden"
                      >
                        <div className={`w-4.5 h-1.5 rounded-xs mb-0.5 border ${tubeColor}`} />
                        <div className={`w-4.5 h-1.5 rounded-xs mb-0.5 border ${tubeColor}`} />
                        <div className={`w-4.5 h-1.5 rounded-xs mb-0.5 border ${tubeColor}`} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Active Bet Readout, Discard Tray & Close Button */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-black/65 px-2.5 sm:px-3 py-1 rounded-lg border border-amber-500/40 shadow-inner font-mono-tabular gap-1.5">
                    <span className="text-[9px] uppercase tracking-widest text-amber-300/85 font-cinzel font-bold">
                      BET:
                    </span>
                    <span className="text-amber-300 font-bold text-xs sm:text-sm">
                      {totalDisplayedBet.toLocaleString()} {currencyMode}
                    </span>
                  </div>

                  <div
                    className="hidden sm:flex w-12 h-10 bg-neutral-900/85 border-2 border-neutral-700/80 rounded items-end justify-center p-1 shadow-inner"
                    title="Acrylic Discard Rack"
                  >
                    <div className="w-9 h-4.5 bg-red-950/90 border border-red-700/50 rounded-xs flex items-center justify-center text-[7px] font-mono-tabular text-white/60">
                      USED
                    </div>
                  </div>

                  {onClose && (
                    <button
                      type="button"
                      data-grand-casino-close-btn="true"
                      onClick={() => {
                        soundEngine.playUiCancel();
                        onClose();
                      }}
                      aria-label="Tutup Meja Blackjack"
                      title="Tutup Meja Blackjack"
                      className="w-8 h-8 rounded-lg bg-gradient-to-b from-[#991b1b] to-[#450a0a] hover:brightness-125 border border-[#f87171]/60 text-white font-bold text-xs flex items-center justify-center shadow cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* 2. DEALER HAND STAGE AREA (Top Center) */}
              <div className="flex flex-col items-center justify-center relative z-10 pt-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-cinzel uppercase tracking-widest text-amber-300 font-bold drop-shadow">
                    Dealer Hand
                  </span>
                  <span className="bg-black/85 text-amber-300 border border-amber-500/50 text-[11px] px-2.5 py-0.5 rounded-full font-mono-tabular font-bold shadow">
                    {dealerVisibleScore}
                  </span>
                </div>

                <div className="flex items-center justify-center -space-x-5 min-h-[104px] sm:min-h-[112px]">
                  {dealerHand.map((card, idx) => (
                    <LuxuryPlayingCardSvg
                      key={`dealer-${idx}-${card.rank}-${card.suit}`}
                      uid={`dealer-${idx}`}
                      card={card}
                      hidden={idx === 1 && dealerHoleHidden}
                    />
                  ))}
                </div>
              </div>

              {/* 3. CURVED GOLD-FOIL CASINO ARC RULES (Dedicated Band — Never Overlaps Cards) */}
              <div className="w-full max-w-[700px] mx-auto relative z-10 pointer-events-none select-none -my-2">
                <svg
                  viewBox="0 0 860 92"
                  className="w-full h-12 sm:h-14 overflow-visible"
                  aria-hidden="true"
                >
                  <defs>
                    <path id="bj-felt-arc-title" d="M 110,18 Q 430,72 750,18" />
                    <path id="bj-felt-arc-sub" d="M 65,44 Q 430,104 795,44" />
                  </defs>
                  <path
                    d="M 125,26 Q 430,80 735,26"
                    fill="none"
                    stroke="#fbbf24"
                    strokeOpacity="0.28"
                    strokeWidth="1.2"
                  />
                  <text
                    fill="#fde047"
                    fontSize="19"
                    fontWeight="800"
                    letterSpacing="5.5"
                    fontFamily="Cinzel, Georgia, serif"
                  >
                    <textPath href="#bj-felt-arc-title" startOffset="50%" textAnchor="middle">
                      BLACKJACK PAYS 3 TO 2
                    </textPath>
                  </text>
                  <text
                    fill="#fef08a"
                    fillOpacity="0.86"
                    fontSize="11.5"
                    fontWeight="700"
                    letterSpacing="2.2"
                    fontFamily="Cinzel, Georgia, serif"
                  >
                    <textPath href="#bj-felt-arc-sub" startOffset="50%" textAnchor="middle">
                      DEALER MUST DRAW TO 16 AND STAND ON ALL 17S · TIE BONUS 10 TO 1
                    </textPath>
                  </text>
                </svg>
              </div>

              {/* Dynamic Center Outcome Banner */}
              {centerBanner && (
                <div className="absolute top-[46%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
                  <div
                    className={`px-7 py-2 rounded-full text-sm sm:text-lg font-cinzel font-black tracking-widest shadow-2xl border-2 uppercase text-center whitespace-nowrap ${
                      centerBanner.tone === 'win'
                        ? 'bg-emerald-700 border-emerald-300 text-amber-100'
                        : centerBanner.tone === 'loss'
                          ? 'bg-rose-800 border-rose-300 text-white'
                          : centerBanner.tone === 'push'
                            ? 'bg-neutral-800 border-neutral-400 text-amber-300'
                            : 'bg-neutral-900 border-amber-400 text-amber-300'
                    }`}
                  >
                    {centerBanner.text}
                  </div>
                </div>
              )}

              {/* 4. INTERACTIVE BETTING SPOTS ROW (Tie/Bonus 10:1 · Primary Ante · Raise 2x) */}
              <div className="w-full max-w-xl mx-auto flex items-center justify-center gap-6 sm:gap-12 relative z-10 my-0.5">
                {/* Left: Optional Tie / Bonus Side Bet (Pays 10:1) */}
                <button
                  type="button"
                  onClick={handleAddTieChip}
                  onContextMenu={handleRemoveTieChip}
                  title="Pasang Side Bet Tie / Bonus (Membayar 10:1 saat Push · Klik kanan kurangi)"
                  className={`flex flex-col items-center transition cursor-pointer ${
                    safeStagedTie > 0 ? 'opacity-100 scale-105' : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className="w-15 h-15 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-amber-300/70 bg-emerald-950/75 flex flex-col items-center justify-center shadow-inner relative">
                    {safeStagedTie > 0 ? (
                      <ClayStripedChipSvg
                        spec={tieChipSpec}
                        displayText={formatCompactVal(safeStagedTie)}
                        sizeClass="w-11 h-11"
                      />
                    ) : (
                      <>
                        <span className="text-[8px] sm:text-[9px] font-bold text-amber-200 uppercase tracking-wider">
                          Tie / Bonus
                        </span>
                        <span className="text-[10px] font-mono-tabular text-amber-400 font-bold">
                          10:1
                        </span>
                      </>
                    )}
                  </div>
                </button>

                {/* Center: Primary ANTE Betting Circle */}
                <div className="flex flex-col items-center relative">
                  <button
                    type="button"
                    onClick={handleAddAnteChip}
                    onContextMenu={handleRemoveAnteChip}
                    title="Klik untuk tambah chip Ante · Klik kanan untuk kurangi"
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-amber-400 bg-emerald-950/90 shadow-[0_0_24px_rgba(251,191,36,0.4)] hover:shadow-[0_0_32px_rgba(251,191,36,0.7)] flex flex-col items-center justify-center transition active:scale-95 cursor-pointer relative"
                  >
                    <span className="text-[9px] font-bold text-amber-300 uppercase tracking-wider mb-0.5">
                      ANTE
                    </span>
                    {safeStagedAnte > 0 ? (
                      <ClayStripedChipSvg
                        spec={anteChipSpec}
                        displayText={formatCompactVal(safeStagedAnte)}
                        sizeClass="w-11 h-11 sm:w-13 sm:h-13"
                      />
                    ) : (
                      <span className="text-[10px] font-mono-tabular text-amber-200/70 font-bold">
                        + CHIP
                      </span>
                    )}
                  </button>
                  <div className="mt-1 bg-red-900/95 border border-amber-400/80 px-2.5 py-0.5 rounded text-[10px] font-mono-tabular font-bold text-amber-200 shadow tracking-wide">
                    Ante: {safeStagedAnte.toLocaleString()} {currencyMode}
                  </div>
                </div>

                {/* Right: RAISE / DOUBLE Spot */}
                <button
                  type="button"
                  disabled={!canDoubleNow}
                  onClick={handleDoubleDown}
                  title="Double Down (2x Ante + Ambil 1 Kartu)"
                  className={`flex flex-col items-center transition ${
                    doubledRaiseBet > 0
                      ? 'opacity-100 scale-105'
                      : canDoubleNow
                        ? 'opacity-95 hover:scale-105 cursor-pointer'
                        : 'opacity-65 cursor-default'
                  }`}
                >
                  <div className="w-15 h-15 sm:w-16 sm:h-16 rounded-xl border-2 border-dashed border-amber-300/70 bg-emerald-950/75 flex flex-col items-center justify-center shadow-inner">
                    {doubledRaiseBet > 0 ? (
                      <ClayStripedChipSvg
                        spec={raiseChipSpec}
                        displayText={formatCompactVal(doubledRaiseBet)}
                        sizeClass="w-11 h-11"
                      />
                    ) : (
                      <>
                        <span className="text-[9px] sm:text-[10px] font-bold text-amber-200 uppercase tracking-widest">
                          RAISE
                        </span>
                        <span className="text-[8px] font-mono-tabular text-emerald-400 font-bold">
                          2x Ante
                        </span>
                      </>
                    )}
                  </div>
                </button>
              </div>

              {/* 5. PLAYER HAND STAGE AREA (Bottom Center) */}
              <div className="flex flex-col items-center justify-center relative z-10 pb-1">
                <div className="flex items-center justify-center -space-x-5 min-h-[108px] sm:min-h-[116px] mb-1.5">
                  {playerHand.map((card, idx) => (
                    <LuxuryPlayingCardSvg
                      key={`player-${idx}-${card.rank}-${card.suit}`}
                      uid={`player-${idx}`}
                      card={card}
                      hidden={false}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <span className="text-[11px] font-cinzel uppercase tracking-widest text-amber-300 font-bold drop-shadow">
                    Player Total
                  </span>
                  <span className="bg-black/85 text-amber-300 border border-amber-500/50 text-[11px] px-2.5 py-0.5 rounded-full font-mono-tabular font-bold shadow">
                    {playerScoreLabel}
                  </span>
                  {(roundBadgeText || (!hasDealtAtLeastOnce && playerEval.isBlackjack)) && (
                    <span className="bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shadow border border-yellow-200">
                      {roundBadgeText ?? '★ BLACKJACK!'}
                    </span>
                  )}
                </div>
              </div>

              {/* 6. CURVED BRASS CHIP TRAY & FANNED ACTION CONTROLS ALONG BOTTOM RIM */}
              <div className="w-full max-w-3xl mx-auto bj-chip-groove-tray px-3 py-2.5 sm:px-5 sm:py-3 relative z-30 flex flex-col items-center justify-center gap-2.5">
                {/* Fanned Action Controls Row */}
                <div className="flex items-center justify-center gap-2 sm:gap-2.5 flex-wrap relative z-20">
                  <button
                    type="button"
                    disabled={phase !== 'BETTING' || (safeStagedAnte === 0 && safeStagedTie === 0)}
                    onClick={handleClearBet}
                    className="bj-tactile-btn px-3 py-1.5 rounded-lg text-amber-200 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 -rotate-3 hover:rotate-0 transition disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
                      <path
                        d="M3 4h10M6 4V2.5h4V4M5 4l.7 9.5h4.6L11 4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span>CLEAR</span>
                  </button>

                  <button
                    type="button"
                    disabled={
                      phase !== 'BETTING' ||
                      lastRoundBets.ante + lastRoundBets.tie <= 0 ||
                      lastRoundBets.ante + lastRoundBets.tie > rawVaultBalance
                    }
                    onClick={handleRebet}
                    className="bj-tactile-btn px-3 py-1.5 rounded-lg text-amber-200 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 -rotate-1 hover:rotate-0 transition disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
                      <path
                        d="M13 8a5 5 0 1 1-1.4-3.5M13 2.5v3h-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>REBET</span>
                  </button>

                  <button
                    type="button"
                    disabled={!canDoubleNow}
                    onClick={handleDoubleDown}
                    className="bj-tactile-btn px-3.5 py-1.5 rounded-lg bg-gradient-to-b from-indigo-600 to-indigo-900 border-indigo-400 text-white text-xs font-black uppercase tracking-wider -rotate-1 hover:rotate-0 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    DOUBLE
                  </button>

                  <button
                    type="button"
                    data-casino-bj-deal-btn="true"
                    disabled={phase !== 'BETTING' || (safeStagedAnte <= 0 && rawVaultBalance < 1)}
                    onClick={handleDeal}
                    className="bj-deal-btn px-6 py-2 rounded-xl text-white font-black text-sm uppercase tracking-widest transition disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                  >
                    DEAL
                  </button>

                  <button
                    type="button"
                    data-casino-bj-hit-btn="true"
                    disabled={phase !== 'PLAYER_TURN'}
                    onClick={handleHit}
                    className="bj-tactile-btn px-3.5 py-1.5 rounded-lg bg-gradient-to-b from-amber-600 to-amber-800 border-amber-400 text-white text-xs font-black uppercase tracking-wider rotate-1 hover:rotate-0 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    HIT
                  </button>

                  <button
                    type="button"
                    data-casino-bj-stand-btn="true"
                    disabled={phase !== 'PLAYER_TURN'}
                    onClick={handleStand}
                    className="bj-tactile-btn px-3.5 py-1.5 rounded-lg bg-gradient-to-b from-rose-600 to-rose-900 border-rose-400 text-white text-xs font-black uppercase tracking-wider rotate-3 hover:rotate-0 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    STAND
                  </button>
                </div>

                {/* 5-Chip Striped Clay Selection Rack */}
                <div className="flex items-center justify-center gap-2.5 sm:gap-4 px-5 py-1.5 bg-black/55 rounded-full border border-amber-500/40 shadow-inner">
                  {BJ_CLAY_CHIPS.map((chip) => {
                    const isSelected = selectedChip === chip.value;
                    return (
                      <button
                        key={chip.value}
                        type="button"
                        title={`Pilih Chip ${chip.value} ${currencyMode}`}
                        onClick={() => {
                          soundEngine.playCasinoChipClink(1);
                          setSelectedChip(chip.value);
                        }}
                        className={`relative rounded-full transition-transform cursor-pointer ${
                          chip.tiltClass
                        } ${
                          isSelected
                            ? '-translate-y-1.5 scale-110'
                            : 'hover:-translate-y-1 hover:scale-105'
                        }`}
                      >
                        <ClayStripedChipSvg spec={chip} selected={isSelected} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
