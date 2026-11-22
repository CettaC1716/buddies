import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { soundEngine } from '../game/audio';

export interface CasinoRouletteInteractivePanelProps {
  isActive: boolean;
  lulBalance: number;
  respiteBalance?: number;
  onClose?: () => void;
  onDebitStake: (stakeLul: number) => { ok: boolean; message: string };
  onSettleTableGame: (payoutLul: number, xpGained: number, announceHeadline?: string) => void;
  onDebitRespite?: (stakeRespite: number) => { ok: boolean; message: string };
  onSettleRespite?: (payoutRespite: number, xpGained: number, announceHeadline?: string) => void;
}

type RouletteCurrencyMode = 'LUL' | 'RESPITE';

// Authentic 38-Pocket American Dual-Zero Clockwise Sequence
const AMERICAN_WHEEL_ORDER: readonly string[] = [
  '0', '28', '9', '26', '30', '11', '7', '20', '32', '17', '5', '22', '34', '15', '3', '24', '36', '13', '1',
  '00', '27', '10', '25', '29', '12', '8', '19', '31', '18', '6', '21', '33', '16', '4', '23', '35', '14', '2',
];

const RED_POCKETS = new Set<string>([
  '1', '3', '5', '7', '9', '12', '14', '16', '18',
  '19', '21', '23', '25', '27', '30', '32', '34', '36',
]);

const TABLE_MATRIX_ROWS: readonly (readonly string[])[] = [
  ['3', '6', '9', '12', '15', '18', '21', '24', '27', '30', '33', '36'],
  ['2', '5', '8', '11', '14', '17', '20', '23', '26', '29', '32', '35'],
  ['1', '4', '7', '10', '13', '16', '19', '22', '25', '28', '31', '34'],
];

const ALL_1_TO_36 = Array.from({ length: 36 }, (_, idx) => String(idx + 1));
const COL_3_POCKETS = [...TABLE_MATRIX_ROWS[0]];
const COL_2_POCKETS = [...TABLE_MATRIX_ROWS[1]];
const COL_1_POCKETS = [...TABLE_MATRIX_ROWS[2]];
const DOZEN_1_POCKETS = ALL_1_TO_36.slice(0, 12);
const DOZEN_2_POCKETS = ALL_1_TO_36.slice(12, 24);
const DOZEN_3_POCKETS = ALL_1_TO_36.slice(24, 36);
const LOW_POCKETS = ALL_1_TO_36.slice(0, 18);
const HIGH_POCKETS = ALL_1_TO_36.slice(18, 36);
const EVEN_POCKETS = ALL_1_TO_36.filter((p) => Number(p) % 2 === 0);
const ODD_POCKETS = ALL_1_TO_36.filter((p) => Number(p) % 2 === 1);
const RED_POCKET_LIST = ALL_1_TO_36.filter((p) => RED_POCKETS.has(p));
const BLACK_POCKET_LIST = ALL_1_TO_36.filter((p) => !RED_POCKETS.has(p));

type AuraBetKind = 'straight' | 'split' | 'corner' | 'column' | 'dozen' | 'even_money';

interface AuraBetSpotSpec {
  id: string;
  kind: AuraBetKind;
  label: string;
  pockets: readonly string[];
  totalReturnMultiplier: number; // Stake included: Straight=36, Split=18, Corner=9, Dozen/Col=3, EvenMoney=2
}

interface ChipDenomSpec {
  value: number;
  shortLabel: string;
  gradStart: string;
  gradEnd: string;
  rimSideHex: string;
  stripeHex: string;
  centerFillHex: string;
  textHex: string;
}

const AURA_CHIP_RACK: readonly ChipDenomSpec[] = [
  {
    value: 1,
    shortLabel: '1',
    gradStart: '#e2e8f0',
    gradEnd: '#475569',
    rimSideHex: '#1e293b',
    stripeHex: '#0f172a',
    centerFillHex: '#cbd5e1',
    textHex: '#0f172a',
  },
  {
    value: 5,
    shortLabel: '5',
    gradStart: '#f87171',
    gradEnd: '#991b1b',
    rimSideHex: '#5c0d0d',
    stripeHex: '#ffffff',
    centerFillHex: '#7f1d1d',
    textHex: '#ffffff',
  },
  {
    value: 25,
    shortLabel: '25',
    gradStart: '#34d399',
    gradEnd: '#065f46',
    rimSideHex: '#033829',
    stripeHex: '#022c22',
    centerFillHex: '#6ee7b7',
    textHex: '#022c22',
  },
  {
    value: 100,
    shortLabel: '100',
    gradStart: '#334155',
    gradEnd: '#090d16',
    rimSideHex: '#020617',
    stripeHex: '#38bdf8',
    centerFillHex: '#0f172a',
    textHex: '#7df4ff',
  },
  {
    value: 500,
    shortLabel: '500',
    gradStart: '#c084fc',
    gradEnd: '#581c87',
    rimSideHex: '#3b0764',
    stripeHex: '#fef08a',
    centerFillHex: '#4c1d95',
    textHex: '#ffffff',
  },
  {
    value: 1000,
    shortLabel: '1K',
    gradStart: '#fde047',
    gradEnd: '#a16207',
    rimSideHex: '#5c3409',
    stripeHex: '#713f12',
    centerFillHex: '#fef08a',
    textHex: '#422006',
  },
];

const INITIAL_RECENT_HISTORY: readonly string[] = ['14', '31', '9', '0', '22', '00', '3', '17'];
const DEFLECTOR_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;

function getPocketColorCategory(pocket: string): 'green' | 'red' | 'black' {
  if (pocket === '0' || pocket === '00') return 'green';
  return RED_POCKETS.has(pocket) ? 'red' : 'black';
}

function getPocketBadgeBgClass(pocket: string): string {
  const cat = getPocketColorCategory(pocket);
  if (cat === 'green') return 'bg-[#0c6b40] border-[#34d399]/50';
  if (cat === 'red') return 'bg-[#b22020] border-red-400/40';
  return 'bg-[#1c222c] border-slate-500/40';
}

function formatCompactChipAmount(amount: number): string {
  if (amount >= 10000) return `${Math.round(amount / 1000)}K`;
  if (amount >= 1000) {
    const k = amount / 1000;
    return Number.isInteger(k) ? `${k}K` : `${k.toFixed(1)}K`;
  }
  return String(amount);
}

function pickChipVisualForAmount(amount: number): ChipDenomSpec {
  for (let i = AURA_CHIP_RACK.length - 1; i >= 0; i--) {
    if (amount >= AURA_CHIP_RACK[i].value) {
      return AURA_CHIP_RACK[i];
    }
  }
  return AURA_CHIP_RACK[0];
}

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDegClockwiseFromTop: number,
): { x: number; y: number } {
  const rad = ((angleDegClockwiseFromTop - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function buildAnnularSectorPath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startDeg: number,
  endDeg: number,
): string {
  const p1 = polarToCartesian(cx, cy, rOuter, startDeg);
  const p2 = polarToCartesian(cx, cy, rOuter, endDeg);
  const p3 = polarToCartesian(cx, cy, rInner, endDeg);
  const p4 = polarToCartesian(cx, cy, rInner, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

const RackPokerChipSvg: React.FC<{ chip: ChipDenomSpec; selected: boolean }> = ({
  chip,
  selected,
}) => {
  const gradId = `aura-rack-chip-${chip.value}`;
  return (
    <svg viewBox="0 0 56 56" className="w-10 h-10 sm:w-11 sm:h-11 shrink-0" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={chip.gradStart} />
          <stop offset="100%" stopColor={chip.gradEnd} />
        </linearGradient>
      </defs>
      {/* Selected Cyan Halo Ring Inside SVG (Zero CSS Ring Ghosting!) */}
      {selected && (
        <circle
          cx="28"
          cy="28"
          r="26"
          fill="none"
          stroke="#00f0ff"
          strokeWidth="2.6"
          opacity="0.95"
        />
      )}
      {/* 3D Bottom Cylinder Lip Shadow & Thickness */}
      <ellipse cx="28" cy="31.5" rx="22" ry="21.5" fill="rgba(0,0,0,0.6)" />
      <circle cx="28" cy="29.5" r="21.5" fill={chip.rimSideHex} />
      {/* Top Beveled Chip Face */}
      <circle
        cx="28"
        cy="26.5"
        r="21.5"
        fill={`url(#${gradId})`}
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="1"
      />
      {/* Dashed Casino Inlay Ring */}
      <circle
        cx="28"
        cy="26.5"
        r="16"
        fill={chip.centerFillHex}
        stroke={chip.stripeHex}
        strokeWidth="2"
        strokeDasharray="4 3"
      />
      {/* Top Specular Gloss Arc */}
      <path
        d="M 13 18 A 18 18 0 0 1 43 18"
        fill="none"
        stroke="rgba(255,255,255,0.38)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <text
        x="28"
        y="27"
        fill={chip.textHex}
        fontSize={chip.shortLabel.length >= 3 ? '10.5' : '12'}
        fontWeight="900"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {chip.shortLabel}
      </text>
    </svg>
  );
};

const FeltStackedChipSvg: React.FC<{ amount: number; compact?: boolean }> = ({
  amount,
  compact = false,
}) => {
  const chip = pickChipVisualForAmount(amount);
  const layers = Math.min(4, Math.max(1, Math.ceil(Math.log2(amount / chip.value + 1))));
  const label = formatCompactChipAmount(amount);
  const sizeCls = compact ? 'w-6 h-6' : 'w-7 h-7';

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
      <svg viewBox="0 0 44 48" className={`${sizeCls} drop-shadow-[0_3px_5px_rgba(0,0,0,0.85)]`} aria-hidden="true">
        <ellipse cx="22" cy="40" rx="17" ry="14" fill="rgba(0,0,0,0.55)" />
        {Array.from({ length: layers }, (_, idx) => {
          const cy = 34 - idx * 3.8;
          return (
            <g key={idx}>
              <ellipse cx="22" cy={cy + 2.2} rx="16.5" ry="13.5" fill={chip.rimSideHex} />
              <ellipse
                cx="22"
                cy={cy}
                rx="16.5"
                ry="13.5"
                fill={chip.gradStart}
                stroke="#ffffff"
                strokeWidth="0.9"
              />
              <ellipse
                cx="22"
                cy={cy}
                rx="12"
                ry="9.6"
                fill={chip.centerFillHex}
                stroke={chip.stripeHex}
                strokeWidth="1.5"
                strokeDasharray="3 2.2"
              />
            </g>
          );
        })}
        <text
          x="22"
          y={34 - (layers - 1) * 3.8 + 0.5}
          fill={chip.textHex}
          fontSize={label.length >= 3 ? '8.5' : '10'}
          fontWeight="900"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {label}
        </text>
      </svg>
    </div>
  );
};

export const CasinoRouletteInteractivePanel: React.FC<CasinoRouletteInteractivePanelProps> = ({
  isActive,
  lulBalance,
  respiteBalance = 0,
  onClose,
  onDebitStake,
  onSettleTableGame,
  onDebitRespite,
  onSettleRespite,
}) => {
  const canUseRespite = Boolean(onDebitRespite && onSettleRespite);
  const [currencyMode, setCurrencyMode] = useState<RouletteCurrencyMode>(() =>
    lulBalance <= 0 && respiteBalance > 0 && onDebitRespite && onSettleRespite ? 'RESPITE' : 'LUL',
  );

  const rawVaultBalance =
    currencyMode === 'RESPITE' && canUseRespite
      ? Math.max(0, Math.floor(respiteBalance))
      : Math.max(0, Math.floor(lulBalance));

  const [selectedChip, setSelectedChip] = useState<number>(25);
  const [activeBets, setActiveBets] = useState<Record<string, number>>({});
  const [betHistoryStack, setBetHistoryStack] = useState<Array<Record<string, number>>>([]);
  const [previousRoundBets, setPreviousRoundBets] = useState<Record<string, number>>({});
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [showPaytableModal, setShowPaytableModal] = useState<boolean>(false);
  const [hoveredSpot, setHoveredSpot] = useState<AuraBetSpotSpec | null>(null);
  const [recentHistory, setRecentHistory] = useState<string[]>(() => [...INITIAL_RECENT_HISTORY]);

  const [ballStatusText, setBallStatusText] = useState<string>('PLACE BETS TO BEGIN');
  const [settledBanner, setSettledBanner] = useState<{
    pocket: string;
    colorCategory: 'green' | 'red' | 'black';
    headline: string;
    payoutAmount: number;
    won: boolean;
  } | null>(null);

  // Imperative SVG Group Refs for 60 FPS Smooth Rotor & Ball Animation (Zero Inline CSS Styles!)
  const rotorGroupRef = useRef<SVGGElement | null>(null);
  const turretGroupRef = useRef<SVGGElement | null>(null);
  const ballGroupRef = useRef<SVGGElement | null>(null);

  const rotorDegRef = useRef<number>(0);
  const ballDegRef = useRef<number>(0);
  const ballRadiusRef = useRef<number>(121);
  const ballVisibleRef = useRef<boolean>(false);

  const spinAnimRef = useRef<{
    active: boolean;
    startMs: number;
    durationMs: number;
    startRotorDeg: number;
    targetRotorDeg: number;
    startBallDeg: number;
    targetBallDeg: number;
    lastTickIndex: number;
    winningPocket: string;
    committedBets: Record<string, number>;
    committedCurrency: RouletteCurrencyMode;
  } | null>(null);

  const onSettleLulRef = useRef(onSettleTableGame);
  const onSettleRespiteRef = useRef(onSettleRespite);
  useEffect(() => {
    onSettleLulRef.current = onSettleTableGame;
    onSettleRespiteRef.current = onSettleRespite;
  }, [onSettleTableGame, onSettleRespite]);

  // Build Complete Spot Registry
  const spotRegistry = useMemo(() => {
    const map = new Map<string, AuraBetSpotSpec>();
    const register = (spec: AuraBetSpotSpec) => {
      map.set(spec.id, spec);
    };

    register({
      id: 'straight:0',
      kind: 'straight',
      label: 'STRAIGHT 0 (35:1)',
      pockets: ['0'],
      totalReturnMultiplier: 36,
    });
    register({
      id: 'straight:00',
      kind: 'straight',
      label: 'STRAIGHT 00 (35:1)',
      pockets: ['00'],
      totalReturnMultiplier: 36,
    });
    register({
      id: 'split:0_00',
      kind: 'split',
      label: 'SPLIT 0 / 00 (17:1)',
      pockets: ['0', '00'],
      totalReturnMultiplier: 18,
    });

    for (const p of ALL_1_TO_36) {
      register({
        id: `straight:${p}`,
        kind: 'straight',
        label: `STRAIGHT #${p} (35:1)`,
        pockets: [p],
        totalReturnMultiplier: 36,
      });
    }

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 11; c++) {
        const a = TABLE_MATRIX_ROWS[r][c];
        const b = TABLE_MATRIX_ROWS[r][c + 1];
        register({
          id: `split:h_${a}_${b}`,
          kind: 'split',
          label: `SPLIT ${a}/${b} (17:1)`,
          pockets: [a, b],
          totalReturnMultiplier: 18,
        });
      }
    }

    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 12; c++) {
        const topP = TABLE_MATRIX_ROWS[r][c];
        const botP = TABLE_MATRIX_ROWS[r + 1][c];
        register({
          id: `split:v_${botP}_${topP}`,
          kind: 'split',
          label: `SPLIT ${botP}/${topP} (17:1)`,
          pockets: [botP, topP],
          totalReturnMultiplier: 18,
        });
      }
    }

    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 11; c++) {
        const tl = TABLE_MATRIX_ROWS[r][c];
        const tr = TABLE_MATRIX_ROWS[r][c + 1];
        const bl = TABLE_MATRIX_ROWS[r + 1][c];
        const br = TABLE_MATRIX_ROWS[r + 1][c + 1];
        register({
          id: `corner:${bl}_${tl}_${br}_${tr}`,
          kind: 'corner',
          label: `CORNER ${bl}/${tl}/${br}/${tr} (8:1)`,
          pockets: [bl, tl, br, tr],
          totalReturnMultiplier: 9,
        });
      }
    }

    register({
      id: 'col:col3',
      kind: 'column',
      label: 'TOP COLUMN (2:1)',
      pockets: COL_3_POCKETS,
      totalReturnMultiplier: 3,
    });
    register({
      id: 'col:col2',
      kind: 'column',
      label: 'MIDDLE COLUMN (2:1)',
      pockets: COL_2_POCKETS,
      totalReturnMultiplier: 3,
    });
    register({
      id: 'col:col1',
      kind: 'column',
      label: 'BOTTOM COLUMN (2:1)',
      pockets: COL_1_POCKETS,
      totalReturnMultiplier: 3,
    });

    register({
      id: 'dozen:1st12',
      kind: 'dozen',
      label: '1ST 12 (2:1)',
      pockets: DOZEN_1_POCKETS,
      totalReturnMultiplier: 3,
    });
    register({
      id: 'dozen:2nd12',
      kind: 'dozen',
      label: '2ND 12 (2:1)',
      pockets: DOZEN_2_POCKETS,
      totalReturnMultiplier: 3,
    });
    register({
      id: 'dozen:3rd12',
      kind: 'dozen',
      label: '3RD 12 (2:1)',
      pockets: DOZEN_3_POCKETS,
      totalReturnMultiplier: 3,
    });

    register({
      id: 'even_money:low',
      kind: 'even_money',
      label: '1-18 LOW (1:1)',
      pockets: LOW_POCKETS,
      totalReturnMultiplier: 2,
    });
    register({
      id: 'even_money:even',
      kind: 'even_money',
      label: 'EVEN (1:1)',
      pockets: EVEN_POCKETS,
      totalReturnMultiplier: 2,
    });
    register({
      id: 'even_money:red',
      kind: 'even_money',
      label: 'RED (1:1)',
      pockets: RED_POCKET_LIST,
      totalReturnMultiplier: 2,
    });
    register({
      id: 'even_money:black',
      kind: 'even_money',
      label: 'BLACK (1:1)',
      pockets: BLACK_POCKET_LIST,
      totalReturnMultiplier: 2,
    });
    register({
      id: 'even_money:odd',
      kind: 'even_money',
      label: 'ODD (1:1)',
      pockets: ODD_POCKETS,
      totalReturnMultiplier: 2,
    });
    register({
      id: 'even_money:high',
      kind: 'even_money',
      label: '19-36 HIGH (1:1)',
      pockets: HIGH_POCKETS,
      totalReturnMultiplier: 2,
    });

    return map;
  }, []);

  // Precompute 38-pocket SVG geometry centered at (160, 160)
  const wheelPocketsGeometry = useMemo(() => {
    const stepDeg = 360 / AMERICAN_WHEEL_ORDER.length;
    return AMERICAN_WHEEL_ORDER.map((pocket, index) => {
      const centerDeg = index * stepDeg;
      const startDeg = centerDeg - stepDeg / 2;
      const endDeg = centerDeg + stepDeg / 2;
      const outerPath = buildAnnularSectorPath(160, 160, 82, 118, startDeg, endDeg);
      const innerPocketPath = buildAnnularSectorPath(160, 160, 68, 82, startDeg, endDeg);
      const labelPos = polarToCartesian(160, 160, 102, centerDeg);
      const fretOuter = polarToCartesian(160, 160, 118, startDeg);
      const fretInner = polarToCartesian(160, 160, 68, startDeg);
      const cat = getPocketColorCategory(pocket);
      const fillHex = cat === 'green' ? '#0c6b40' : cat === 'red' ? '#b01919' : '#1b2028';
      const deepHex = cat === 'green' ? '#07472a' : cat === 'red' ? '#7c1010' : '#0f1319';
      return {
        pocket,
        index,
        centerDeg,
        outerPath,
        innerPocketPath,
        labelX: labelPos.x,
        labelY: labelPos.y,
        fretX1: fretInner.x,
        fretY1: fretInner.y,
        fretX2: fretOuter.x,
        fretY2: fretOuter.y,
        fillHex,
        deepHex,
      };
    });
  }, []);

  const totalStagedWager = useMemo(() => {
    let sum = 0;
    for (const amt of Object.values(activeBets)) {
      if (amt > 0) sum += amt;
    }
    return sum;
  }, [activeBets]);

  const activeSpotsCount = useMemo(() => {
    let count = 0;
    for (const amt of Object.values(activeBets)) {
      if (amt > 0) count += 1;
    }
    return count;
  }, [activeBets]);

  const availableVaultAfterStage = isSpinning
    ? rawVaultBalance
    : Math.max(0, rawVaultBalance - totalStagedWager);

  const hoveredPocketSet = useMemo(() => {
    if (!hoveredSpot) return new Set<string>();
    return new Set<string>(hoveredSpot.pockets);
  }, [hoveredSpot]);

  const syncWheelSvgAttributes = useCallback(() => {
    const deg = rotorDegRef.current;
    if (rotorGroupRef.current) {
      rotorGroupRef.current.setAttribute('transform', `rotate(${deg.toFixed(2)} 160 160)`);
    }
    if (turretGroupRef.current) {
      turretGroupRef.current.setAttribute('transform', `rotate(${deg.toFixed(2)} 160 160)`);
    }
    if (ballGroupRef.current) {
      if (!ballVisibleRef.current) {
        ballGroupRef.current.setAttribute('opacity', '0');
      } else {
        const pos = polarToCartesian(160, 160, ballRadiusRef.current, ballDegRef.current);
        ballGroupRef.current.setAttribute('opacity', '1');
        ballGroupRef.current.setAttribute(
          'transform',
          `translate(${pos.x.toFixed(2)} ${pos.y.toFixed(2)})`,
        );
      }
    }
  }, []);

  const settleCompletedSpin = useCallback(
    (
      winningPocket: string,
      committedBets: Record<string, number>,
      committedCurrency: RouletteCurrencyMode,
    ) => {
      let totalStake = 0;
      let totalPayout = 0;
      let winningSpots = 0;

      for (const [spotId, betAmount] of Object.entries(committedBets)) {
        if (betAmount <= 0) continue;
        totalStake += betAmount;
        const spec = spotRegistry.get(spotId);
        if (spec && spec.pockets.includes(winningPocket)) {
          totalPayout += betAmount * spec.totalReturnMultiplier;
          winningSpots += 1;
        }
      }

      const xpGained =
        totalStake <= 0 ? 0 : totalPayout > 0 ? Math.min(50, 8 + winningSpots * 5) : 2;
      const colorCat = getPocketColorCategory(winningPocket);
      const colorUpper = colorCat.toUpperCase();

      const headline =
        totalPayout > 0
          ? `#${winningPocket} (${colorUpper}) · ROUND WON +${totalPayout.toLocaleString()} ${committedCurrency}!`
          : `#${winningPocket} (${colorUpper}) · NO PAYOUT THIS ROUND`;

      if (committedCurrency === 'RESPITE' && onSettleRespiteRef.current) {
        onSettleRespiteRef.current(totalPayout, xpGained, headline);
      } else {
        onSettleLulRef.current(totalPayout, xpGained, headline);
      }

      if (totalPayout > 0) {
        soundEngine.playCasinoJackpotFanfare(totalPayout >= totalStake * 12);
      } else {
        soundEngine.playRouletteBallBounce(0.35);
      }

      setBallStatusText(`POCKET CONFIRMED: ${winningPocket} (${colorUpper})`);
      setSettledBanner({
        pocket: winningPocket,
        colorCategory: colorCat,
        headline:
          totalPayout > 0
            ? `ROUND WON! +${totalPayout.toLocaleString()} ${committedCurrency}`
            : 'NO PAYOUT THIS ROUND',
        payoutAmount: totalPayout,
        won: totalPayout > 0,
      });
      setRecentHistory((prev) => [winningPocket, ...prev].slice(0, 8));
      setActiveBets({});
      setBetHistoryStack([]);
      setIsSpinning(false);
    },
    [spotRegistry],
  );

  // 60 FPS Rotor & Ball Spin Loop
  useEffect(() => {
    if (!isActive) return;

    let rafId = 0;
    const tick = (now: number) => {
      const spin = spinAnimRef.current;
      if (spin && spin.active) {
        const elapsed = now - spin.startMs;
        const t = Math.min(1, Math.max(0, elapsed / spin.durationMs));
        const easeRotor = 1 - Math.pow(1 - t, 3.6);
        rotorDegRef.current =
          spin.startRotorDeg + (spin.targetRotorDeg - spin.startRotorDeg) * easeRotor;

        const easeBall = 1 - Math.pow(1 - t, 2.85);
        ballDegRef.current =
          spin.startBallDeg + (spin.targetBallDeg - spin.startBallDeg) * easeBall;

        if (t < 0.68) {
          ballRadiusRef.current = 123;
        } else if (t < 0.89) {
          const dropT = (t - 0.68) / 0.21;
          const deflectHop = Math.sin(dropT * Math.PI * 5) * (1 - dropT) * 4.5;
          ballRadiusRef.current = 123 - 47 * dropT + deflectHop;
        } else {
          const settleT = (t - 0.89) / 0.11;
          const pocketBounce = Math.abs(Math.sin(settleT * Math.PI * 2)) * (1 - settleT) * 2.5;
          ballRadiusRef.current = 76 + pocketBounce;
        }
        ballVisibleRef.current = true;

        const tickBucket = Math.floor(Math.abs(ballDegRef.current) / 26);
        if (tickBucket !== spin.lastTickIndex) {
          spin.lastTickIndex = tickBucket;
          if (t >= 0.68) {
            soundEngine.playRouletteBallBounce(Math.max(0.2, 1 - t));
          } else {
            soundEngine.playWheelPegTick(Math.max(0.15, 1 - t));
          }
        }

        syncWheelSvgAttributes();

        if (t >= 1) {
          spin.active = false;
          spinAnimRef.current = null;
          settleCompletedSpin(
            spin.winningPocket,
            spin.committedBets,
            spin.committedCurrency,
          );
        } else {
          rafId = requestAnimationFrame(tick);
        }
      }
    };

    syncWheelSvgAttributes();
    if (spinAnimRef.current?.active) {
      rafId = requestAnimationFrame(tick);
    }
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [isActive, isSpinning, syncWheelSvgAttributes, settleCompletedSpin]);

  // Betting Actions
  const placeChipOnSpot = useCallback(
    (spotId: string) => {
      if (isSpinning) return;
      if (totalStagedWager + selectedChip > rawVaultBalance) {
        soundEngine.playUiCancel();
        setBallStatusText(
          `INSUFFICIENT ${currencyMode} BALANCE FOR ${selectedChip.toLocaleString()} ${currencyMode} CHIP`,
        );
        return;
      }

      soundEngine.playCasinoChipClink(1);
      setSettledBanner(null);
      setBetHistoryStack((prev) => [...prev, { ...activeBets }]);
      setActiveBets((prev) => ({
        ...prev,
        [spotId]: (prev[spotId] ?? 0) + selectedChip,
      }));
      const spec = spotRegistry.get(spotId);
      if (spec) {
        setBallStatusText(`${spec.label} · +${selectedChip} ${currencyMode}`);
      }
    },
    [isSpinning, totalStagedWager, selectedChip, rawVaultBalance, currencyMode, activeBets, spotRegistry],
  );

  const removeSpotBetOnRightClick = useCallback(
    (e: React.MouseEvent, spotId: string) => {
      e.preventDefault();
      if (isSpinning) return;
      const existing = activeBets[spotId] ?? 0;
      if (existing <= 0) return;
      soundEngine.playUiCancel();
      setBetHistoryStack((prev) => [...prev, { ...activeBets }]);
      setActiveBets((prev) => {
        const next = { ...prev };
        if (existing <= selectedChip) {
          delete next[spotId];
        } else {
          next[spotId] = existing - selectedChip;
        }
        return next;
      });
    },
    [isSpinning, activeBets, selectedChip],
  );

  const handleUndoBet = useCallback(() => {
    if (isSpinning || betHistoryStack.length === 0) return;
    soundEngine.playUiCancel();
    const prevSnapshot = betHistoryStack[betHistoryStack.length - 1];
    setBetHistoryStack((prev) => prev.slice(0, -1));
    setActiveBets(prevSnapshot);
    setBallStatusText('LAST CHIP REMOVED');
  }, [isSpinning, betHistoryStack]);

  const handleClearBets = useCallback(() => {
    if (isSpinning || totalStagedWager === 0) return;
    soundEngine.playUiCancel();
    setBetHistoryStack((prev) => [...prev, { ...activeBets }]);
    setActiveBets({});
    setBallStatusText('PLACE BETS TO BEGIN');
  }, [isSpinning, totalStagedWager, activeBets]);

  const handleDoubleBets = useCallback(() => {
    if (isSpinning || totalStagedWager === 0) return;
    if (totalStagedWager * 2 > rawVaultBalance) {
      soundEngine.playUiCancel();
      setBallStatusText(`INSUFFICIENT ${currencyMode} BALANCE TO DOUBLE`);
      return;
    }
    soundEngine.playUiConfirm();
    setBetHistoryStack((prev) => [...prev, { ...activeBets }]);
    setActiveBets((prev) => {
      const doubled: Record<string, number> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (v > 0) doubled[k] = v * 2;
      }
      return doubled;
    });
    setBallStatusText(`WAGER DOUBLED · ${(totalStagedWager * 2).toLocaleString()} ${currencyMode}`);
  }, [isSpinning, totalStagedWager, rawVaultBalance, currencyMode, activeBets]);

  const handleRebet = useCallback(() => {
    if (isSpinning) return;
    let prevTotal = 0;
    for (const v of Object.values(previousRoundBets)) {
      if (v > 0) prevTotal += v;
    }
    if (prevTotal === 0) {
      soundEngine.playUiCancel();
      setBallStatusText('NO PREVIOUS ROUND BETS');
      return;
    }
    if (prevTotal > rawVaultBalance) {
      soundEngine.playUiCancel();
      setBallStatusText(`INSUFFICIENT ${currencyMode} BALANCE TO REBET`);
      return;
    }
    soundEngine.playUiConfirm();
    setBetHistoryStack((prev) => [...prev, { ...activeBets }]);
    setActiveBets({ ...previousRoundBets });
    setSettledBanner(null);
    setBallStatusText(`PREVIOUS BETS RESTORED (${prevTotal.toLocaleString()} ${currencyMode})`);
  }, [isSpinning, previousRoundBets, rawVaultBalance, currencyMode, activeBets]);

  const handleSpinWheel = useCallback(() => {
    if (isSpinning) return;
    if (totalStagedWager <= 0) {
      soundEngine.playUiCancel();
      setBallStatusText('PLACE AT LEAST ONE CHIP ON THE TABLE');
      return;
    }

    const debitResult =
      currencyMode === 'RESPITE' && onDebitRespite
        ? onDebitRespite(totalStagedWager)
        : onDebitStake(totalStagedWager);

    if (!debitResult.ok) {
      soundEngine.playUiCancel();
      setBallStatusText(debitResult.message.toUpperCase());
      return;
    }

    soundEngine.playUiConfirm();
    const committedBets = { ...activeBets };
    setPreviousRoundBets(committedBets);
    setSettledBanner(null);
    setBallStatusText('BALL IN MOTION · TURRET SPINNING');

    const winIdx = Math.floor(Math.random() * AMERICAN_WHEEL_ORDER.length);
    const winningPocket = AMERICAN_WHEEL_ORDER[winIdx];
    const pocketStepDeg = 360 / AMERICAN_WHEEL_ORDER.length;

    const startRotor = rotorDegRef.current;
    const extraRotorSpins = 5 * 360 + Math.random() * 180 + 90;
    const targetRotor = startRotor + extraRotorSpins;

    const finalPocketWorldDeg =
      (((targetRotor + winIdx * pocketStepDeg) % 360) + 360) % 360;
    const startBall = ((ballDegRef.current % 360) + 360) % 360;
    const targetBall = finalPocketWorldDeg - 5 * 360;

    ballVisibleRef.current = true;
    spinAnimRef.current = {
      active: true,
      startMs: performance.now(),
      durationMs: 4200,
      startRotorDeg: startRotor,
      targetRotorDeg: targetRotor,
      startBallDeg: startBall,
      targetBallDeg: targetBall,
      lastTickIndex: -1,
      winningPocket,
      committedBets,
      committedCurrency: currencyMode,
    };
    setIsSpinning(true);
  }, [isSpinning, totalStagedWager, currencyMode, onDebitRespite, onDebitStake, activeBets]);

  const renderSpotChip = (spotId: string, compact = false) => {
    const amount = activeBets[spotId] ?? 0;
    if (amount <= 0) return null;
    return <FeltStackedChipSvg amount={amount} compact={compact} />;
  };

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="relative w-full max-w-[1320px] mx-auto select-none my-auto rounded-[26px] bg-[#0e121b]/88 backdrop-blur-2xl border border-white/15 shadow-[0_24px_70px_rgba(0,0,0,0.62)] text-white overflow-hidden"
    >
      {/* TOP HEADER BAR */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-white/[0.03] border-b border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-2 text-amber-300 min-w-0">
            <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0" aria-hidden="true">
              <rect
                x="2.5"
                y="2.5"
                width="15"
                height="15"
                rx="3"
                fill="none"
                stroke="#fcd34d"
                strokeWidth="1.7"
              />
              <circle cx="6.5" cy="6.5" r="1.2" fill="#fcd34d" />
              <circle cx="13.5" cy="6.5" r="1.2" fill="#fcd34d" />
              <circle cx="10" cy="10" r="1.3" fill="#fcd34d" />
              <circle cx="6.5" cy="13.5" r="1.2" fill="#fcd34d" />
              <circle cx="13.5" cy="13.5" r="1.2" fill="#fcd34d" />
            </svg>
            <span className="font-mono-tabular text-[11px] sm:text-xs tracking-[0.15em] font-bold uppercase text-amber-300 truncate">
              AURA LUXURY TABLE · AMERICAN DUAL-ZERO
            </span>
          </div>
        </div>

        {/* Integrated Limits, Currency Switch, Vault & Close Button */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 font-mono-tabular text-xs">
          <div className="hidden sm:flex items-center gap-1.5 text-slate-300">
            <span className="text-amber-300/80 text-[10px] uppercase">LIMITS:</span>
            <span className="text-white font-bold">1 - 5,000</span>
          </div>

          <div className="hidden sm:block h-3.5 w-px bg-white/15" />

          {canUseRespite && (
            <button
              type="button"
              disabled={isSpinning}
              title="Switch Betting Currency (LUL / RESPITE)"
              onClick={() => {
                if (isSpinning) return;
                soundEngine.playUiClick();
                setActiveBets({});
                setBetHistoryStack([]);
                setCurrencyMode((prev) => (prev === 'LUL' ? 'RESPITE' : 'LUL'));
              }}
              className="px-3 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-amber-300/35 text-amber-300 text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors"
            >
              {currencyMode} ⇄
            </button>
          )}

          <div className="flex items-center gap-1.5 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/30">
            <span className="text-[10px] text-emerald-300 uppercase tracking-wider font-bold">
              VAULT
            </span>
            <span className="text-emerald-400 font-bold text-xs sm:text-sm tracking-wide">
              {availableVaultAfterStage.toLocaleString()} {currencyMode}
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
              aria-label="Close Roulette Table"
              title="Close Roulette Table"
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* MAIN BODY */}
      <div className="p-4 sm:p-5 flex flex-col gap-3.5">
        {/* EMERALD FELT ARENA */}
        <div className="relative w-full rounded-2xl bg-gradient-to-b from-[#0b3a26]/95 via-[#072b1c]/95 to-[#051f15]/95 border border-emerald-400/20 p-4 sm:p-5 flex flex-col gap-4 shadow-inner">
          {/* UPPER ROW: 3D PRECISION ROULETTE WHEEL (LEFT) + FELT BETTING GRID (RIGHT) */}
          <div className="flex flex-col lg:flex-row gap-5 items-center justify-between">
            {/* LEFT: MULTI-BEVEL 3D SVG PRECISION ROULETTE WHEEL CYLINDER */}
            <div className="flex flex-col items-center justify-center relative shrink-0">
              <div className="font-mono-tabular text-[10px] text-emerald-100/80 uppercase tracking-[0.16em] mb-1.5 flex items-center gap-1.5">
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
                  <path
                    d="M 8 2 A 6 6 0 1 1 3.2 4.4"
                    fill="none"
                    stroke="#fcd34d"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                  <polygon points="8,0.6 10.8,3.2 7.5,3.8" fill="#fcd34d" />
                </svg>
                <span>PRECISION BALANCED ROTOR</span>
              </div>

              {/* High-Precision 3D Beveled SVG Wheel */}
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full shadow-[0_18px_38px_rgba(0,0,0,0.65)] flex items-center justify-center">
                <svg
                  viewBox="0 0 320 320"
                  className="w-full h-full"
                  aria-label="Aura 3D American Dual-Zero Roulette Wheel"
                >
                  <defs>
                    <linearGradient id="aura-mahogany-rim" x1="12%" y1="8%" x2="88%" y2="92%">
                      <stop offset="0%" stopColor="#5e2714" />
                      <stop offset="48%" stopColor="#341409" />
                      <stop offset="100%" stopColor="#140602" />
                    </linearGradient>
                    <linearGradient id="aura-brass-rim" x1="15%" y1="10%" x2="85%" y2="90%">
                      <stop offset="0%" stopColor="#fff1b8" />
                      <stop offset="32%" stopColor="#d9a441" />
                      <stop offset="68%" stopColor="#f7d77e" />
                      <stop offset="100%" stopColor="#784d12" />
                    </linearGradient>
                    <radialGradient id="aura-ball-track" cx="50%" cy="50%" r="50%">
                      <stop offset="72%" stopColor="#0e1217" />
                      <stop offset="88%" stopColor="#1c232d" />
                      <stop offset="100%" stopColor="#090c10" />
                    </radialGradient>
                    <radialGradient id="aura-inner-cone" cx="38%" cy="35%" r="65%">
                      <stop offset="0%" stopColor="#422817" />
                      <stop offset="65%" stopColor="#1f130b" />
                      <stop offset="100%" stopColor="#110905" />
                    </radialGradient>
                    <radialGradient id="aura-turret-dome" cx="35%" cy="32%" r="68%">
                      <stop offset="0%" stopColor="#fff6c7" />
                      <stop offset="38%" stopColor="#e5c158" />
                      <stop offset="76%" stopColor="#9c6c1e" />
                      <stop offset="100%" stopColor="#593a0a" />
                    </radialGradient>
                    <linearGradient id="aura-turret-arm" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#fff7cc" />
                      <stop offset="52%" stopColor="#e5c158" />
                      <stop offset="100%" stopColor="#784d12" />
                    </linearGradient>
                    <radialGradient id="aura-ivory-ball" cx="35%" cy="30%" r="68%">
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="45%" stopColor="#f8fafc" />
                      <stop offset="82%" stopColor="#cbd5e1" />
                      <stop offset="100%" stopColor="#64748b" />
                    </radialGradient>
                  </defs>

                  <circle cx="160" cy="160" r="158" fill="url(#aura-mahogany-rim)" />
                  <circle
                    cx="160"
                    cy="160"
                    r="156.5"
                    fill="none"
                    stroke="rgba(255,230,195,0.22)"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx="160"
                    cy="160"
                    r="143"
                    fill="url(#aura-brass-rim)"
                    stroke="#3d2011"
                    strokeWidth="2"
                  />
                  <circle
                    cx="160"
                    cy="160"
                    r="140"
                    fill="none"
                    stroke="rgba(255,255,255,0.45)"
                    strokeWidth="1"
                  />
                  <circle
                    cx="160"
                    cy="160"
                    r="131"
                    fill="url(#aura-ball-track)"
                    stroke="#593a0a"
                    strokeWidth="1.5"
                  />
                  {DEFLECTOR_ANGLES.map((ang) => (
                    <g key={ang} transform={`rotate(${ang} 160 160)`}>
                      <polygon
                        points="160,24 164.5,27.5 160,31 155.5,27.5"
                        fill="#f7d77e"
                        stroke="#593a0a"
                        strokeWidth="0.8"
                      />
                    </g>
                  ))}

                  <g ref={rotorGroupRef} transform="rotate(0 160 160)">
                    <circle cx="160" cy="160" r="119" fill="#140d08" />
                    {wheelPocketsGeometry.map((seg) => {
                      const isHovered = hoveredPocketSet.has(seg.pocket);
                      const isSettledWinner = settledBanner?.pocket === seg.pocket;
                      return (
                        <g key={seg.pocket}>
                          <path
                            d={seg.outerPath}
                            fill={seg.fillHex}
                            stroke={
                              isSettledWinner
                                ? '#fde047'
                                : isHovered
                                  ? '#34d399'
                                  : '#b88c34'
                            }
                            strokeWidth={isSettledWinner || isHovered ? '1.8' : '0.7'}
                          />
                          <path
                            d={seg.innerPocketPath}
                            fill={seg.deepHex}
                            stroke="#8c5e1c"
                            strokeWidth="0.55"
                          />
                          <line
                            x1={seg.fretX1}
                            y1={seg.fretY1}
                            x2={seg.fretX2}
                            y2={seg.fretY2}
                            stroke="#e5c158"
                            strokeWidth="0.95"
                          />
                          <text
                            x={seg.labelX}
                            y={seg.labelY}
                            fill={isSettledWinner ? '#fef08a' : '#f8fafc'}
                            fontSize="8.5"
                            fontWeight="800"
                            textAnchor="middle"
                            dominantBaseline="central"
                            transform={`rotate(${seg.centerDeg} ${seg.labelX} ${seg.labelY})`}
                          >
                            {seg.pocket}
                          </text>
                        </g>
                      );
                    })}
                    <circle
                      cx="160"
                      cy="160"
                      r="68"
                      fill="url(#aura-inner-cone)"
                      stroke="#c9933b"
                      strokeWidth="1.8"
                    />
                    <circle
                      cx="160"
                      cy="160"
                      r="56"
                      fill="none"
                      stroke="rgba(247,215,126,0.2)"
                      strokeWidth="1"
                    />
                  </g>

                  <g ref={ballGroupRef} opacity="0" transform="translate(160 37)">
                    <circle cx="1.8" cy="2.6" r="6.8" fill="rgba(0,0,0,0.65)" />
                    <circle
                      cx="0"
                      cy="0"
                      r="6.5"
                      fill="url(#aura-ivory-ball)"
                      stroke="rgba(255,255,255,0.8)"
                      strokeWidth="0.6"
                    />
                    <circle cx="-2" cy="-2.2" r="1.8" fill="#ffffff" />
                  </g>

                  <g ref={turretGroupRef} transform="rotate(0 160 160)">
                    <circle cx="162" cy="164" r="39" fill="rgba(0,0,0,0.62)" />
                    <circle
                      cx="160"
                      cy="160"
                      r="38"
                      fill="url(#aura-turret-dome)"
                      stroke="#fff1b8"
                      strokeWidth="1.2"
                    />
                    <circle
                      cx="160"
                      cy="160"
                      r="29"
                      fill="none"
                      stroke="rgba(92,52,9,0.45)"
                      strokeWidth="1.2"
                    />
                    <rect
                      x="133"
                      y="157.2"
                      width="54"
                      height="5.6"
                      rx="2.8"
                      fill="url(#aura-turret-arm)"
                      stroke="#6d4d12"
                      strokeWidth="0.7"
                    />
                    <rect
                      x="157.2"
                      y="133"
                      width="5.6"
                      height="54"
                      rx="2.8"
                      fill="url(#aura-turret-arm)"
                      stroke="#6d4d12"
                      strokeWidth="0.7"
                    />
                    <circle
                      cx="160"
                      cy="160"
                      r="13"
                      fill="url(#aura-turret-dome)"
                      stroke="#fff6c7"
                      strokeWidth="1"
                    />
                    <circle cx="160" cy="160" r="4.8" fill="#3d2011" />
                  </g>
                </svg>
              </div>

              {/* Ball Status Pill Tag Directly Below Wheel */}
              <div className="mt-2.5 font-mono-tabular text-[11px] bg-black/40 backdrop-blur-md border border-emerald-400/35 text-emerald-300 px-4 py-1 rounded-full flex items-center gap-1.5 max-w-[290px]">
                <span className="text-amber-300 text-[10px]">↻</span>
                <span className="truncate font-semibold">{ballStatusText}</span>
              </div>
            </div>

            {/* RIGHT: CASINO GREEN FELT BETTING LAYOUT */}
            <div className="flex-1 w-full max-w-full overflow-x-auto pb-1 flex flex-col gap-2">
              {/* Felt Header Strip */}
              <div className="flex items-center justify-between px-1 pb-1.5 border-b border-white/10 text-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-mono-tabular text-[11px] text-amber-300 uppercase font-bold tracking-[0.14em]">
                    AMERICAN ROULETTE BOARD
                  </span>
                  {hoveredSpot && (
                    <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-emerald-400/15 border border-emerald-400/30 text-emerald-300 font-mono-tabular text-[10px] font-bold">
                      {hoveredSpot.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono-tabular text-[10px] text-emerald-200/80 uppercase tracking-wider">
                    STRAIGHT-UP PAYS 35:1
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setShowPaytableModal(true);
                    }}
                    className="text-[10px] uppercase font-mono-tabular font-bold px-3 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-amber-300/35 text-amber-300 transition-all cursor-pointer"
                  >
                    ? PAYTABLE
                  </button>
                </div>
              </div>

              {/* Technical Betting Grid Board */}
              <div className="flex gap-1.5 min-w-[620px] text-white font-mono-tabular">
                {/* Dual Zero Column (0, 0/00 Split, and 00) */}
                <div className="relative flex flex-col gap-1.5 w-16 shrink-0">
                  {(['0', '00'] as const).map((zeroPocket) => {
                    const spotId = `straight:${zeroPocket}`;
                    const spec = spotRegistry.get(spotId)!;
                    const isHighlighted =
                      hoveredPocketSet.has(zeroPocket) || settledBanner?.pocket === zeroPocket;
                    return (
                      <button
                        key={zeroPocket}
                        type="button"
                        onMouseEnter={() => setHoveredSpot(spec)}
                        onMouseLeave={() => setHoveredSpot(null)}
                        onClick={() => placeChipOnSpot(spotId)}
                        onContextMenu={(e) => removeSpotBetOnRightClick(e, spotId)}
                        className={`relative h-16 bg-emerald-700/85 hover:bg-emerald-600/90 active:scale-95 rounded-xl text-white font-bold flex flex-col items-center justify-center border transition-all cursor-pointer ${
                          isHighlighted
                            ? 'border-amber-300 ring-2 ring-amber-300/70 brightness-125'
                            : 'border-emerald-400/40'
                        }`}
                      >
                        <span className="text-lg leading-none font-black">{zeroPocket}</span>
                        <span className="text-[9px] text-emerald-200 mt-0.5">35:1</span>
                        {renderSpotChip(spotId)}
                      </button>
                    );
                  })}

                  {/* 0 / 00 Split Hotspot */}
                  <button
                    type="button"
                    title="Split 0 / 00 (17:1)"
                    onMouseEnter={() => setHoveredSpot(spotRegistry.get('split:0_00') ?? null)}
                    onMouseLeave={() => setHoveredSpot(null)}
                    onClick={() => placeChipOnSpot('split:0_00')}
                    onContextMenu={(e) => removeSpotBetOnRightClick(e, 'split:0_00')}
                    className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-3.5 z-20 rounded-full flex items-center justify-center hover:bg-amber-300/35 cursor-pointer"
                  >
                    {renderSpotChip('split:0_00', true)}
                  </button>
                </div>

                {/* 1 to 36 Grid Matrix (3 Rows x 12 Cols) + Split & Corner Hotspots */}
                <div className="relative flex-1 flex flex-col gap-1.5">
                  {TABLE_MATRIX_ROWS.map((rowPockets, rowIdx) => (
                    <div key={rowIdx} className="grid grid-cols-12 gap-1 h-10">
                      {rowPockets.map((pocket, colIdx) => {
                        const spotId = `straight:${pocket}`;
                        const spec = spotRegistry.get(spotId)!;
                        const isRed = RED_POCKETS.has(pocket);
                        const isHighlighted =
                          hoveredPocketSet.has(pocket) || settledBanner?.pocket === pocket;
                        const nextColPocket =
                          colIdx < 11 ? TABLE_MATRIX_ROWS[rowIdx][colIdx + 1] : null;
                        const belowRowPocket =
                          rowIdx < 2 ? TABLE_MATRIX_ROWS[rowIdx + 1][colIdx] : null;
                        const diagPocket =
                          rowIdx < 2 && colIdx < 11
                            ? TABLE_MATRIX_ROWS[rowIdx + 1][colIdx + 1]
                            : null;

                        const hSplitId = nextColPocket
                          ? `split:h_${pocket}_${nextColPocket}`
                          : null;
                        const vSplitId = belowRowPocket
                          ? `split:v_${belowRowPocket}_${pocket}`
                          : null;
                        const cornerId =
                          belowRowPocket && nextColPocket && diagPocket
                            ? `corner:${belowRowPocket}_${pocket}_${diagPocket}_${nextColPocket}`
                            : null;

                        return (
                          <div key={pocket} className="relative h-full">
                            <button
                              type="button"
                              onMouseEnter={() => setHoveredSpot(spec)}
                              onMouseLeave={() => setHoveredSpot(null)}
                              onClick={() => placeChipOnSpot(spotId)}
                              onContextMenu={(e) => removeSpotBetOnRightClick(e, spotId)}
                              className={`relative w-full h-full rounded-lg flex items-center justify-center font-bold text-sm border transition-all cursor-pointer ${
                                isRed
                                  ? 'bg-rose-700/90 hover:bg-rose-600 border-rose-400/35'
                                  : 'bg-slate-900/85 hover:bg-slate-800 border-white/15'
                              } ${
                                isHighlighted
                                  ? 'ring-2 ring-amber-300 border-amber-300 brightness-125'
                                  : ''
                              }`}
                            >
                              <span>{pocket}</span>
                              {renderSpotChip(spotId)}
                            </button>

                            {hSplitId && (
                              <button
                                type="button"
                                title={spotRegistry.get(hSplitId)?.label}
                                onMouseEnter={() =>
                                  setHoveredSpot(spotRegistry.get(hSplitId) ?? null)
                                }
                                onMouseLeave={() => setHoveredSpot(null)}
                                onClick={() => placeChipOnSpot(hSplitId)}
                                onContextMenu={(e) => removeSpotBetOnRightClick(e, hSplitId)}
                                className="absolute -right-1.5 top-1.5 bottom-1.5 w-2.5 z-20 rounded-full hover:bg-amber-300/45 flex items-center justify-center cursor-pointer"
                              >
                                {renderSpotChip(hSplitId, true)}
                              </button>
                            )}

                            {vSplitId && (
                              <button
                                type="button"
                                title={spotRegistry.get(vSplitId)?.label}
                                onMouseEnter={() =>
                                  setHoveredSpot(spotRegistry.get(vSplitId) ?? null)
                                }
                                onMouseLeave={() => setHoveredSpot(null)}
                                onClick={() => placeChipOnSpot(vSplitId)}
                                onContextMenu={(e) => removeSpotBetOnRightClick(e, vSplitId)}
                                className="absolute left-1.5 right-1.5 -bottom-1.5 h-2.5 z-20 rounded-full hover:bg-amber-300/45 flex items-center justify-center cursor-pointer"
                              >
                                {renderSpotChip(vSplitId, true)}
                              </button>
                            )}

                            {cornerId && (
                              <button
                                type="button"
                                title={spotRegistry.get(cornerId)?.label}
                                onMouseEnter={() =>
                                  setHoveredSpot(spotRegistry.get(cornerId) ?? null)
                                }
                                onMouseLeave={() => setHoveredSpot(null)}
                                onClick={() => placeChipOnSpot(cornerId)}
                                onContextMenu={(e) => removeSpotBetOnRightClick(e, cornerId)}
                                className="absolute -right-2 -bottom-2 w-3.5 h-3.5 z-30 rounded-full hover:bg-emerald-300/60 flex items-center justify-center cursor-pointer"
                              >
                                {renderSpotChip(cornerId, true)}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* 2:1 Column Bets */}
                <div className="flex flex-col gap-1.5 w-14 shrink-0">
                  {(['col:col3', 'col:col2', 'col:col1'] as const).map((colId) => {
                    const spec = spotRegistry.get(colId)!;
                    return (
                      <button
                        key={colId}
                        type="button"
                        onMouseEnter={() => setHoveredSpot(spec)}
                        onMouseLeave={() => setHoveredSpot(null)}
                        onClick={() => placeChipOnSpot(colId)}
                        onContextMenu={(e) => removeSpotBetOnRightClick(e, colId)}
                        className="relative h-10 bg-white/[0.06] hover:bg-white/[0.14] rounded-lg flex items-center justify-center font-bold text-xs uppercase tracking-wider text-amber-300 border border-amber-300/30 cursor-pointer transition-colors"
                      >
                        <span>2:1</span>
                        {renderSpotChip(colId)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Outside Bets: Dozens (1st 12, 2nd 12, 3rd 12) */}
              <div className="flex gap-1.5 min-w-[620px] pl-[70px] pr-[62px] font-mono-tabular">
                {(
                  [
                    { id: 'dozen:1st12', text: '1ST 12 (PAYS 2:1)' },
                    { id: 'dozen:2nd12', text: '2ND 12 (PAYS 2:1)' },
                    { id: 'dozen:3rd12', text: '3RD 12 (PAYS 2:1)' },
                  ] as const
                ).map((doz) => {
                  const spec = spotRegistry.get(doz.id)!;
                  return (
                    <button
                      key={doz.id}
                      type="button"
                      onMouseEnter={() => setHoveredSpot(spec)}
                      onMouseLeave={() => setHoveredSpot(null)}
                      onClick={() => placeChipOnSpot(doz.id)}
                      onContextMenu={(e) => removeSpotBetOnRightClick(e, doz.id)}
                      className="relative flex-1 h-9 bg-white/[0.06] hover:bg-white/[0.14] rounded-lg flex items-center justify-center font-bold text-xs uppercase tracking-wider text-slate-100 border border-white/15 cursor-pointer transition-colors"
                    >
                      <span>{doz.text}</span>
                      {renderSpotChip(doz.id)}
                    </button>
                  );
                })}
              </div>

              {/* Outside Bets: Even-Money (1-18, EVEN, RED, BLACK, ODD, 19-36) */}
              <div className="flex gap-1.5 min-w-[620px] pl-[70px] pr-[62px] font-mono-tabular">
                {(
                  [
                    {
                      id: 'even_money:low',
                      text: '1-18',
                      cls: 'bg-white/[0.06] hover:bg-white/[0.14] border-white/15 text-slate-100',
                      dotCls: '',
                    },
                    {
                      id: 'even_money:even',
                      text: 'EVEN',
                      cls: 'bg-white/[0.06] hover:bg-white/[0.14] border-white/15 text-slate-100',
                      dotCls: '',
                    },
                    {
                      id: 'even_money:red',
                      text: 'RED',
                      cls: 'bg-rose-700/90 hover:bg-rose-600 border-rose-400/40 text-white',
                      dotCls: 'bg-rose-300',
                    },
                    {
                      id: 'even_money:black',
                      text: 'BLACK',
                      cls: 'bg-slate-900/90 hover:bg-slate-800 border-white/15 text-white',
                      dotCls: 'bg-slate-400',
                    },
                    {
                      id: 'even_money:odd',
                      text: 'ODD',
                      cls: 'bg-white/[0.06] hover:bg-white/[0.14] border-white/15 text-slate-100',
                      dotCls: '',
                    },
                    {
                      id: 'even_money:high',
                      text: '19-36',
                      cls: 'bg-white/[0.06] hover:bg-white/[0.14] border-white/15 text-slate-100',
                      dotCls: '',
                    },
                  ] as const
                ).map((ev) => {
                  const spec = spotRegistry.get(ev.id)!;
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onMouseEnter={() => setHoveredSpot(spec)}
                      onMouseLeave={() => setHoveredSpot(null)}
                      onClick={() => placeChipOnSpot(ev.id)}
                      onContextMenu={(e) => removeSpotBetOnRightClick(e, ev.id)}
                      className={`relative flex-1 h-9 rounded-lg flex items-center justify-center gap-1.5 font-bold text-xs uppercase tracking-wider border cursor-pointer transition-colors ${ev.cls}`}
                    >
                      {ev.dotCls && (
                        <span className={`w-2.5 h-2.5 rounded-full inline-block ${ev.dotCls}`} />
                      )}
                      <span>{ev.text}</span>
                      {renderSpotChip(ev.id)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* WINNER ANNOUNCEMENT BANNER */}
          {settledBanner && (
            <div className="w-full bg-black/45 backdrop-blur-md border border-emerald-400/35 text-white px-4 py-2.5 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl border text-white flex flex-col items-center justify-center font-bold ${getPocketBadgeBgClass(
                    settledBanner.pocket,
                  )}`}
                >
                  <span className="text-base leading-none font-black">
                    {settledBanner.pocket}
                  </span>
                  <span className="text-[8px] uppercase tracking-wider">
                    {settledBanner.colorCategory}
                  </span>
                </div>
                <div>
                  <div className="font-mono-tabular text-[10px] text-amber-300 tracking-wider uppercase font-bold">
                    BALL SETTLED IN CYLINDER
                  </div>
                  <div
                    className={`text-sm sm:text-base font-bold ${
                      settledBanner.won ? 'text-emerald-400' : 'text-white'
                    }`}
                  >
                    {settledBanner.headline}
                  </div>
                </div>
              </div>
              <div className="text-right font-mono-tabular">
                <div className="text-[10px] text-emerald-200/80 uppercase">ROUND PAYOUT</div>
                <div
                  className={`text-lg sm:text-xl font-black ${
                    settledBanner.won ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {settledBanner.won
                    ? `+${settledBanner.payoutAmount.toLocaleString()} ${currencyMode}`
                    : `0 ${currencyMode}`}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CONTROLS ROW: CHIP TRAY + BET RECAP + ACTIONS */}
        <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-3 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3">
          {/* CHIP TRAY */}
          <div className="flex items-center gap-1.5 sm:gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10">
            <span className="font-mono-tabular text-[10px] text-amber-300 uppercase tracking-wider pr-1 font-bold hidden sm:inline">
              CHIPS:
            </span>
            {AURA_CHIP_RACK.map((chip) => {
              const isSelected = selectedChip === chip.value;
              return (
                <button
                  key={chip.value}
                  type="button"
                  title={`Select ${chip.value.toLocaleString()} ${currencyMode} Chip`}
                  onClick={() => {
                    soundEngine.playUiClick();
                    setSelectedChip(chip.value);
                  }}
                  className={`relative rounded-full flex items-center justify-center transition-transform cursor-pointer ${
                    isSelected ? '-translate-y-0.5 scale-110' : 'hover:scale-105 opacity-90 hover:opacity-100'
                  }`}
                >
                  <RackPokerChipSvg chip={chip} selected={isSelected} />
                </button>
              );
            })}
          </div>

          {/* BET RECAP STATUS */}
          <div className="flex items-center gap-2 text-xs font-mono-tabular">
            <div className="px-3.5 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 flex flex-col items-center min-w-[98px]">
              <span className="text-[9px] text-amber-300 uppercase">TOTAL WAGER</span>
              <span className="text-white font-bold">
                {totalStagedWager.toLocaleString()} {currencyMode}
              </span>
            </div>
            <div className="px-3.5 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 flex flex-col items-center min-w-[88px]">
              <span className="text-[9px] text-emerald-300 uppercase">SPOTS ACTIVE</span>
              <span className="text-white font-bold">{activeSpotsCount}</span>
            </div>
          </div>

          {/* ACTION BUTTON CLUSTER */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              type="button"
              disabled={isSpinning || betHistoryStack.length === 0}
              onClick={handleUndoBet}
              className="px-3 py-2 rounded-full bg-white/[0.07] hover:bg-white/[0.14] border border-white/15 disabled:opacity-35 text-slate-200 font-mono-tabular font-bold text-[11px] uppercase tracking-wider transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              ↶ UNDO
            </button>
            <button
              type="button"
              disabled={isSpinning || totalStagedWager === 0}
              onClick={handleClearBets}
              className="px-3 py-2 rounded-full bg-white/[0.07] hover:bg-white/[0.14] border border-white/15 disabled:opacity-35 text-slate-200 font-mono-tabular font-bold text-[11px] uppercase tracking-wider transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              ✕ CLEAR
            </button>
            <button
              type="button"
              disabled={isSpinning || totalStagedWager === 0}
              onClick={handleDoubleBets}
              className="px-3 py-2 rounded-full bg-white/[0.07] hover:bg-white/[0.14] border border-white/15 disabled:opacity-35 text-slate-200 font-mono-tabular font-bold text-[11px] uppercase tracking-wider transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              +2 DOUBLE
            </button>
            <button
              type="button"
              disabled={isSpinning}
              onClick={handleRebet}
              className="px-3 py-2 rounded-full bg-white/[0.07] hover:bg-white/[0.14] border border-white/15 disabled:opacity-35 text-slate-200 font-mono-tabular font-bold text-[11px] uppercase tracking-wider transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              ↻ REBET
            </button>

            {/* SPIN WHEEL PILL BUTTON */}
            <button
              type="button"
              data-casino-spin-roulette-btn="true"
              disabled={isSpinning}
              onClick={handleSpinWheel}
              className="px-6 py-2.5 rounded-full bg-amber-300 hover:bg-amber-200 disabled:opacity-50 text-slate-950 font-cinzel text-xs sm:text-sm uppercase font-black tracking-[0.1em] shadow-md flex items-center gap-2 active:scale-95 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              <span>▶</span>
              <span>{isSpinning ? 'SPINNING...' : 'SPIN WHEEL'}</span>
            </button>
          </div>
        </div>

        {/* BOTTOM HISTORY BAR */}
        <div className="px-1 flex items-center justify-between flex-wrap gap-2 text-[10px] font-mono-tabular text-slate-400">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-amber-300 uppercase tracking-wider font-bold">
              RECENT RESULTS:
            </span>
            <div className="flex items-center gap-1">
              {recentHistory.map((num, idx) => (
                <span
                  key={`${idx}-${num}`}
                  className={`px-2 py-0.5 rounded-full border text-white font-bold ${getPocketBadgeBgClass(
                    num,
                  )} ${idx === 0 ? 'ring-1 ring-amber-300' : ''}`}
                >
                  {num}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-emerald-300 font-semibold">
              RIGHT-CLICK A SPOT TO REMOVE CHIPS
            </span>
            <span className="text-amber-300 font-bold">HOUSE EDGE: 5.26%</span>
          </div>
        </div>
      </div>

      {/* PAYTABLE & ODDS MODAL */}
      {showPaytableModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowPaytableModal(false)}
        >
          <div
            className="rounded-[26px] bg-[#0e121b]/95 backdrop-blur-2xl border border-white/15 shadow-[0_24px_70px_rgba(0,0,0,0.62)] max-w-xl w-full p-5 flex flex-col gap-4 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="font-cinzel text-amber-300 text-base font-bold tracking-wider uppercase">
                AMERICAN ROULETTE ODDS &amp; PAYOUTS
              </span>
              <button
                type="button"
                onClick={() => setShowPaytableModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 font-bold cursor-pointer flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-mono-tabular">
              {[
                { title: 'STRAIGHT UP (1 NUMBER)', desc: '0, 00, or 1–36', odds: '35 to 1' },
                { title: 'SPLIT (2 NUMBERS)', desc: '0/00 or 2 adjacent numbers', odds: '17 to 1' },
                { title: 'CORNER (4 NUMBERS)', desc: 'Intersection of 4 numbers', odds: '8 to 1' },
                { title: 'DOZENS (1ST, 2ND, 3RD 12)', desc: '1–12, 13–24, or 25–36', odds: '2 to 1' },
                { title: 'COLUMNS (2:1)', desc: '12 numbers per column row', odds: '2 to 1' },
                { title: 'RED / BLACK / EVEN / ODD / 1-18 / 19-36', desc: '18-number outside bet', odds: '1 to 1' },
              ].map((item) => (
                <div
                  key={item.title}
                  className="bg-white/[0.05] p-3 rounded-2xl border border-white/10"
                >
                  <div className="text-amber-300 font-bold text-[11px]">{item.title}</div>
                  <div className="flex items-center justify-between mt-1 text-slate-300 text-[11px]">
                    <span>{item.desc}</span>
                    <span className="text-emerald-400 font-bold">{item.odds}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPaytableModal(false)}
                className="px-5 py-2 rounded-full bg-amber-300 hover:bg-amber-200 text-slate-950 font-mono-tabular font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors"
              >
                RETURN TO TABLE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
