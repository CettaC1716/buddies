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
  onClose?: () => void;
  onDebitStake: (stakeLul: number) => { ok: boolean; message: string };
  onSettleTableGame: (payoutLul: number, xpGained: number, announceHeadline?: string) => void;
}

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
  onClose,
  onDebitStake,
  onSettleTableGame,
}) => {
  const rawVaultBalance = Math.max(0, Math.floor(lulBalance));

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
  }>({
    ante: 0,
    raise: 0,
    tie: 0,
  });

  const dealerTimerRef = useRef<number | null>(null);
  const bannerTimerRef = useRef<number | null>(null);
  const onSettleLulRef = useRef(onSettleTableGame);

  useEffect(() => {
    onSettleLulRef.current = onSettleTableGame;
  }, [onSettleTableGame]);

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
        const { ante, raise, tie } = committedRoundRef.current;
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
                ? `PUSH + TIE BONUS +${(tie * 11).toLocaleString()} CerBucks!`
                : 'PUSH (BOTH BLACKJACK)',
              tie > 0 ? 'win' : 'push',
            );
          } else {
            // 3 to 2 natural Blackjack payout (2.5x total return on Ante)
            payout = Math.floor(mainStake * 2.5);
            xp = 24;
            setRoundBadgeText('★ BLACKJACK!');
            triggerCenterBanner(
              `★ BLACKJACK 3:2! +${payout.toLocaleString()} CerBucks`,
              'win',
            );
          }

          onSettleLulRef.current(
            payout,
            xp,
            payout > mainStake ? `NATURAL BLACKJACK 21! +${payout} CerBucks` : undefined,
          );

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
            `DEALER BUSTS (${dEval.total}) · +${mainPayout.toLocaleString()} CerBucks!`,
            'win',
          );
        } else if (pEval.total > dEval.total) {
          mainPayout = mainStake * 2;
          xp = 12;
          setRoundBadgeText('★ PLAYER WINS!');
          triggerCenterBanner(
            `PLAYER WINS ${pEval.total} TO ${dEval.total} · +${mainPayout.toLocaleString()} CerBucks!`,
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
              ? `TIE AT ${pEval.total}! BONUS +${tiePayout.toLocaleString()} CerBucks!`
              : `PUSH: TIED AT ${pEval.total}`,
            tie > 0 ? 'win' : 'push',
          );
        }

        const totalPayout = mainPayout + tiePayout;
        const totalRisked = mainStake + tie;
        const headline =
          totalPayout > totalRisked
            ? `BLACKJACK WIN +${totalPayout.toLocaleString()} CerBucks!`
            : undefined;

        onSettleLulRef.current(totalPayout, xp, headline);

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
      triggerCenterBanner(`INSUFFICIENT CerBucks BALANCE`, 'info');
      return;
    }
    soundEngine.playCasinoChipClink(1);
    setAnteBet(safeStagedAnte + selectedChip);
  }, [phase, safeStagedAnte, safeStagedTie, selectedChip, rawVaultBalance, triggerCenterBanner]);

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
      triggerCenterBanner(`INSUFFICIENT CerBucks BALANCE`, 'info');
      return;
    }
    soundEngine.playCasinoChipClink(1);
    setTieSideBet(safeStagedTie + selectedChip);
  }, [phase, safeStagedAnte, safeStagedTie, selectedChip, rawVaultBalance, triggerCenterBanner]);

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
      triggerCenterBanner(`INSUFFICIENT CerBucks BALANCE TO REBET`, 'info');
      return;
    }
    soundEngine.playCasinoChipClink(2);
    setAnteBet(lastRoundBets.ante);
    setTieSideBet(lastRoundBets.tie);
  }, [phase, lastRoundBets, rawVaultBalance, triggerCenterBanner]);

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
        triggerCenterBanner(`PLACE AN ANTE BET FIRST`, 'info');
        return;
      }
      effectiveAnte = fallback;
      setAnteBet(fallback);
    }

    const totalDebit = effectiveAnte + effectiveTie;
    const debitRes = onDebitStake(totalDebit);

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
      onSettleLulRef.current(0, 2);
      return;
    }

    setPhase('PLAYER_TURN');
  }, [
    phase,
    safeStagedAnte,
    safeStagedTie,
    rawVaultBalance,
    selectedChip,
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
      setDealerHoleHidden(false);
      setDoubledRaiseBet(0);
      setPhase('BETTING');
      setRoundBadgeText(`BUST (${pEval.total})`);
      triggerCenterBanner(`BUST! SCORE: ${pEval.total}`, 'loss');
      onSettleLulRef.current(0, 2);
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

    const debitRes = onDebitStake(extraStake);

    if (!debitRes.ok) {
      soundEngine.playUiCancel();
      triggerCenterBanner(`INSUFFICIENT CerBucks BALANCE TO DOUBLE`, 'info');
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
      onSettleLulRef.current(0, 2);
      return;
    }

    resolveDealerAndSettle(nextPlayer, dealerHand, false);
  }, [
    phase,
    playerHand,
    dealerHand,
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
      className="w-full max-w-[1160px] mx-auto rounded-[26px] bg-[#0e121b]/88 backdrop-blur-2xl border border-white/15 shadow-[0_24px_70px_rgba(0,0,0,0.62)] text-white overflow-hidden select-none"
    >
      {/* 1. TOP DEALER HARDWARE RAIL */}
      <div className="w-full px-5 py-3.5 bg-white/[0.03] border-b border-white/10 flex items-center justify-between gap-3">
        {/* Left: 6-Deck Dealing Shoe + Live Balance */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10" title="6-Deck Dealing Shoe">
            <span className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">
              6-DECK
            </span>
            <span className="text-white/25">·</span>
            <span className="text-xs font-mono-tabular font-bold text-slate-200">{shoeCount} CARDS</span>
          </div>


          <div className="flex items-center bg-emerald-400/10 px-3 py-1.5 rounded-full border border-emerald-400/30 font-mono-tabular gap-1.5">
            <span className="text-[9.5px] uppercase tracking-wider text-emerald-300/85 font-bold hidden sm:inline">
              BALANCE:
            </span>
            <span className="text-emerald-400 font-bold text-xs sm:text-sm">
              {displayedAvailableBalance.toLocaleString()} CerBucks
            </span>
          </div>
        </div>

        {/* Center Title */}
        <div className="hidden lg:flex flex-col items-center">
          <span className="text-[11px] font-cinzel tracking-[0.22em] text-amber-300 uppercase font-bold">
            SALON PRIVÉ BLACKJACK
          </span>
        </div>

        {/* Right: Active Bet Readout & Close Button */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center bg-amber-300/10 px-3 py-1.5 rounded-full border border-amber-300/30 font-mono-tabular gap-1.5">
            <span className="text-[9.5px] uppercase tracking-wider text-amber-300/85 font-bold">
              BET:
            </span>
            <span className="text-amber-300 font-bold text-xs sm:text-sm">
              {totalDisplayedBet.toLocaleString()} CerBucks
            </span>
          </div>

          {onClose && (
            <button
              type="button"
              data-grand-casino-close-btn="true"
              onClick={() => {
                soundEngine.playUiCancel();
                onClose();
              }}
              aria-label="Close Blackjack Table"
              title="Close Blackjack Table"
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* BODY: EMERALD FELT TABLE STAGE + CONTROLS */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* Deep Monte Carlo Emerald Felt Playing Surface */}
        <div className="w-full min-h-[500px] sm:min-h-[540px] rounded-2xl flex flex-col justify-between p-4 sm:p-6 relative border border-emerald-400/20 overflow-hidden shadow-inner">
          {/* Full-Bleed SVG Monte Carlo Emerald Felt & Subtle Champagne-Gold Arc */}
          <svg
            viewBox="0 0 1200 720"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none select-none z-0"
            aria-hidden="true"
          >
            <defs>
              <radialGradient id="bj-emerald-felt-grad" cx="50%" cy="40%" r="66%">
                <stop offset="0%" stopColor="#146343" />
                <stop offset="48%" stopColor="#0c462f" />
                <stop offset="85%" stopColor="#072c1d" />
                <stop offset="100%" stopColor="#041c13" />
              </radialGradient>
            </defs>
            <rect x="0" y="0" width="1200" height="720" fill="url(#bj-emerald-felt-grad)" />
            <path
              d="M 46,88 C 56,520 270,688 600,688 C 930,688 1144,520 1154,88"
              fill="none"
              stroke="#fcd34d"
              strokeOpacity="0.18"
              strokeWidth="1.5"
            />
          </svg>

          {/* 2. DEALER HAND STAGE AREA (Top Center) */}
          <div className="flex flex-col items-center justify-center relative z-10">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-cinzel uppercase tracking-widest text-amber-300 font-bold">
                Dealer Hand
              </span>
              <span className="bg-black/45 backdrop-blur-md text-amber-300 border border-amber-300/35 text-[11px] px-2.5 py-0.5 rounded-full font-mono-tabular font-bold">
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

          {/* 3. CURVED GOLD-FOIL CASINO ARC RULES */}
          <div className="w-full max-w-[680px] mx-auto relative z-10 pointer-events-none select-none -my-2">
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
                stroke="#fcd34d"
                strokeOpacity="0.22"
                strokeWidth="1.2"
              />
              <text
                fill="#fcd34d"
                fontSize="18"
                fontWeight="800"
                letterSpacing="5"
                fontFamily="Cinzel, Georgia, serif"
              >
                <textPath href="#bj-felt-arc-title" startOffset="50%" textAnchor="middle">
                  BLACKJACK PAYS 3 TO 2
                </textPath>
              </text>
              <text
                fill="#fef08a"
                fillOpacity="0.8"
                fontSize="11"
                fontWeight="700"
                letterSpacing="2"
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
                className={`px-7 py-2.5 rounded-full text-sm sm:text-base font-cinzel font-extrabold tracking-widest shadow-2xl border backdrop-blur-xl uppercase text-center whitespace-nowrap ${
                  centerBanner.tone === 'win'
                    ? 'bg-emerald-600/90 border-emerald-300/60 text-white'
                    : centerBanner.tone === 'loss'
                      ? 'bg-rose-700/90 border-rose-300/50 text-white'
                      : centerBanner.tone === 'push'
                        ? 'bg-slate-800/90 border-white/25 text-amber-300'
                        : 'bg-slate-900/90 border-amber-300/40 text-amber-300'
                }`}
              >
                {centerBanner.text}
              </div>
            </div>
          )}

          {/* 4. INTERACTIVE BETTING SPOTS ROW (Tie/Bonus 10:1 · Primary Ante · Raise 2x) */}
          <div className="w-full max-w-xl mx-auto flex items-center justify-center gap-6 sm:gap-12 relative z-10 my-1">
            {/* Left: Optional Tie / Bonus Side Bet (Pays 10:1) */}
            <button
              type="button"
              onClick={handleAddTieChip}
              onContextMenu={handleRemoveTieChip}
              title="Place Tie / Bonus Side Bet (Pays 10:1 on Push · Right-click to remove)"
              className={`flex flex-col items-center transition cursor-pointer ${
                safeStagedTie > 0 ? 'opacity-100 scale-105' : 'opacity-80 hover:opacity-100'
              }`}
            >
              <div className="w-15 h-15 sm:w-16 sm:h-16 rounded-full border border-dashed border-amber-300/60 bg-black/25 backdrop-blur-sm flex flex-col items-center justify-center relative">
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
                    <span className="text-[10px] font-mono-tabular text-amber-300 font-bold">
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
                title="Click to add Ante chip · Right-click to remove"
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-amber-300/80 bg-black/30 backdrop-blur-sm shadow-[0_0_24px_rgba(252,211,77,0.25)] hover:shadow-[0_0_32px_rgba(252,211,77,0.45)] flex flex-col items-center justify-center transition active:scale-95 cursor-pointer relative"
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
                  <span className="text-[10px] font-mono-tabular text-amber-200/75 font-bold">
                    + CHIP
                  </span>
                )}
              </button>
              <div className="mt-1.5 bg-black/45 backdrop-blur-md border border-amber-300/35 px-3 py-0.5 rounded-full text-[10px] font-mono-tabular font-bold text-amber-200 tracking-wide">
                Ante: {safeStagedAnte.toLocaleString()} CerBucks
              </div>
            </div>

            {/* Right: RAISE / DOUBLE Spot */}
            <button
              type="button"
              disabled={!canDoubleNow}
              onClick={handleDoubleDown}
              title="Double Down (2x Ante + Draw 1 Card)"
              className={`flex flex-col items-center transition ${
                doubledRaiseBet > 0
                  ? 'opacity-100 scale-105'
                  : canDoubleNow
                    ? 'opacity-95 hover:scale-105 cursor-pointer'
                    : 'opacity-55 cursor-default'
              }`}
            >
              <div className="w-15 h-15 sm:w-16 sm:h-16 rounded-full border border-dashed border-emerald-300/60 bg-black/25 backdrop-blur-sm flex flex-col items-center justify-center">
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
                    <span className="text-[8.5px] font-mono-tabular text-emerald-400 font-bold">
                      2x Ante
                    </span>
                  </>
                )}
              </div>
            </button>
          </div>

          {/* 5. PLAYER HAND STAGE AREA (Bottom Center) */}
          <div className="flex flex-col items-center justify-center relative z-10">
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
              <span className="text-[11px] font-cinzel uppercase tracking-widest text-amber-300 font-bold">
                Player Total
              </span>
              <span className="bg-black/45 backdrop-blur-md text-amber-300 border border-amber-300/35 text-[11px] px-2.5 py-0.5 rounded-full font-mono-tabular font-bold">
                {playerScoreLabel}
              </span>
              {(roundBadgeText || (!hasDealtAtLeastOnce && playerEval.isBlackjack)) && (
                <span className="bg-amber-300 text-slate-950 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                  {roundBadgeText ?? '★ BLACKJACK!'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 6. DARK FROSTED GLASS CHIP TRAY & ACTION CONTROLS */}
        <div className="w-full rounded-2xl bg-white/[0.05] border border-white/10 px-4 py-3 flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Action Controls Row */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={phase !== 'BETTING' || (safeStagedAnte === 0 && safeStagedTie === 0)}
              onClick={handleClearBet}
              className="px-3.5 py-2 rounded-full bg-white/[0.07] hover:bg-white/[0.14] border border-white/15 text-slate-200 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
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
              className="px-3.5 py-2 rounded-full bg-white/[0.07] hover:bg-white/[0.14] border border-white/15 text-slate-200 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
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
              className="px-4 py-2 rounded-full bg-indigo-500/25 hover:bg-indigo-500/40 border border-indigo-400/45 text-indigo-200 text-xs font-bold uppercase tracking-wider transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              DOUBLE
            </button>

            <button
              type="button"
              data-casino-bj-deal-btn="true"
              disabled={phase !== 'BETTING' || (safeStagedAnte <= 0 && rawVaultBalance < 1)}
              onClick={handleDeal}
              className="px-7 py-2.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-xs sm:text-sm uppercase tracking-widest shadow-md transition active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
            >
              DEAL
            </button>

            <button
              type="button"
              data-casino-bj-hit-btn="true"
              disabled={phase !== 'PLAYER_TURN'}
              onClick={handleHit}
              className="px-5 py-2 rounded-full bg-amber-300 hover:bg-amber-200 text-slate-950 text-xs font-extrabold uppercase tracking-wider transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              HIT
            </button>

            <button
              type="button"
              data-casino-bj-stand-btn="true"
              disabled={phase !== 'PLAYER_TURN'}
              onClick={handleStand}
              className="px-5 py-2 rounded-full bg-rose-500/25 hover:bg-rose-500/40 border border-rose-400/45 text-rose-200 text-xs font-extrabold uppercase tracking-wider transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              STAND
            </button>
          </div>

          {/* 5-Chip Striped Clay Selection Rack */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 px-4 py-1.5 bg-white/[0.04] rounded-full border border-white/10">
            {BJ_CLAY_CHIPS.map((chip) => {
              const isSelected = selectedChip === chip.value;
              return (
                <button
                  key={chip.value}
                  type="button"
                  title={`Select ${chip.value} CerBucks Chip`}
                  onClick={() => {
                    soundEngine.playCasinoChipClink(1);
                    setSelectedChip(chip.value);
                  }}
                  className={`relative rounded-full transition-transform cursor-pointer ${
                    isSelected
                      ? '-translate-y-1 scale-110'
                      : 'hover:-translate-y-0.5 hover:scale-105 opacity-90 hover:opacity-100'
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
  );
};
