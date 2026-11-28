export type ArcadeSlotSymbolId =
  | 'seven'
  | 'diamond'
  | 'star'
  | 'bell'
  | 'coffee'
  | 'cherry';

export interface ArcadeSlotSymbolSpec {
  id: ArcadeSlotSymbolId;
  label: string;
  weight: number;
  tripleMultiplier: number;
  pairMultiplier: number;
  accentHex: string;
  cardBgHex: string;
}

export const ARCADE_SLOT_MIN_BET_LUL = 2;
export const ARCADE_SLOT_BET_TIERS = [2, 5, 10, 25] as const;
export type ArcadeSlotBetTier = (typeof ARCADE_SLOT_BET_TIERS)[number];

/**
 * Weighted 32-stop virtual reel strip.
 * Weights sum strictly to 32 per reel (32^3 = 32,768 uniform combinations):
 *   - 777 Jackpot: 50x | Pair Seven: 4x
 *   - 3x Diamond: 20x  | Pair Diamond: 3x
 *   - 3x Star: 12x     | Pair Star: 2x
 *   - 3x Bell: 8x      | Pair Bell: 2x
 *   - 3x Coffee: 5x    | Pair Coffee: 1x (Push)
 *   - 3x Cherry: 3x    | Pair Cherry: 1x (Push)
 */
export const ARCADE_SLOT_SYMBOLS: ReadonlyArray<ArcadeSlotSymbolSpec> = [
  {
    id: 'seven',
    label: 'LUCKY 7',
    weight: 2,
    tripleMultiplier: 50,
    pairMultiplier: 4,
    accentHex: '#ef4444',
    cardBgHex: '#fef2f2',
  },
  {
    id: 'diamond',
    label: 'DIAMOND',
    weight: 3,
    tripleMultiplier: 20,
    pairMultiplier: 3,
    accentHex: '#06b6d4',
    cardBgHex: '#ecfeff',
  },
  {
    id: 'star',
    label: 'BLITZ STAR',
    weight: 4,
    tripleMultiplier: 12,
    pairMultiplier: 2,
    accentHex: '#eab308',
    cardBgHex: '#fefce8',
  },
  {
    id: 'bell',
    label: 'CAFE BELL',
    weight: 6,
    tripleMultiplier: 8,
    pairMultiplier: 2,
    accentHex: '#f59e0b',
    cardBgHex: '#fffbeb',
  },
  {
    id: 'coffee',
    label: 'ESPRESSO',
    weight: 7,
    tripleMultiplier: 5,
    pairMultiplier: 1,
    accentHex: '#92400e',
    cardBgHex: '#fdf8f3',
  },
  {
    id: 'cherry',
    label: 'CHERRY',
    weight: 10,
    tripleMultiplier: 3,
    pairMultiplier: 1,
    accentHex: '#dc2626',
    cardBgHex: '#fff1f2',
  },
];

export const ARCADE_SLOT_STRIP: ReadonlyArray<ArcadeSlotSymbolId> = ARCADE_SLOT_SYMBOLS.flatMap(
  (spec) => Array.from({ length: spec.weight }, () => spec.id),
);

const SYMBOL_BY_ID: Record<ArcadeSlotSymbolId, ArcadeSlotSymbolSpec> = ARCADE_SLOT_SYMBOLS.reduce(
  (acc, spec) => {
    acc[spec.id] = spec;
    return acc;
  },
  {} as Record<ArcadeSlotSymbolId, ArcadeSlotSymbolSpec>,
);

export type ArcadeSlotOutcomeKind = 'jackpot' | 'triple' | 'pair_win' | 'push' | 'miss';

export interface ArcadeSlotEvaluation {
  reels: [ArcadeSlotSymbolId, ArcadeSlotSymbolId, ArcadeSlotSymbolId];
  outcomeKind: ArcadeSlotOutcomeKind;
  matchedSymbol: ArcadeSlotSymbolSpec | null;
  multiplier: number;
  payoutLul: number;
  netDeltaLul: number;
  xpGained: number;
  headline: string;
}

export interface ArcadeSlotSpinResult {
  ok: boolean;
  reason?: 'invalid_bet' | 'insufficient_lul';
  message: string;
  betLul: number;
  updatedLulBalance: number;
  evaluation: ArcadeSlotEvaluation | null;
}

/**
 * Evaluates a 3-reel slot outcome against the integer paytable.
 */
export function evaluateArcadeSlotCombination(
  reels: readonly [ArcadeSlotSymbolId, ArcadeSlotSymbolId, ArcadeSlotSymbolId],
  betLul: number,
): ArcadeSlotEvaluation {
  const safeBet = Math.max(0, Math.floor(betLul));
  const [r0, r1, r2] = reels;

  if (r0 === r1 && r1 === r2) {
    const spec = SYMBOL_BY_ID[r0];
    const payoutLul = safeBet * spec.tripleMultiplier;
    const isJackpot = r0 === 'seven';
    return {
      reels: [r0, r1, r2],
      outcomeKind: isJackpot ? 'jackpot' : 'triple',
      matchedSymbol: spec,
      multiplier: spec.tripleMultiplier,
      payoutLul,
      netDeltaLul: payoutLul - safeBet,
      xpGained: isJackpot ? 25 : 10,
      headline: isJackpot
        ? `JACKPOT 7-7-7 · +${payoutLul} CerBucks`
        : `TRIPLE ${spec.label} · +${payoutLul} CerBucks`,
    };
  }

  let pairId: ArcadeSlotSymbolId | null = null;
  if (r0 === r1 || r0 === r2) {
    pairId = r0;
  } else if (r1 === r2) {
    pairId = r1;
  }

  if (pairId) {
    const spec = SYMBOL_BY_ID[pairId];
    const payoutLul = safeBet * spec.pairMultiplier;
    const isPush = spec.pairMultiplier === 1;
    return {
      reels: [r0, r1, r2],
      outcomeKind: isPush ? 'push' : 'pair_win',
      matchedSymbol: spec,
      multiplier: spec.pairMultiplier,
      payoutLul,
      netDeltaLul: payoutLul - safeBet,
      xpGained: isPush ? 3 : 5,
      headline: isPush
        ? `PAIR ${spec.label} · MONEY BACK (${payoutLul} CerBucks)`
        : `PAIR ${spec.label} · +${payoutLul} CerBucks`,
    };
  }

  return {
    reels: [r0, r1, r2],
    outcomeKind: 'miss',
    matchedSymbol: null,
    multiplier: 0,
    payoutLul: 0,
    netDeltaLul: -safeBet,
    xpGained: 2,
    headline: `NO MATCH · -${safeBet} CerBucks`,
  };
}

/**
 * Validates stake & balance and spins the 3 weighted arcade slot reels.
 * Optional `rolls` in `[0, 1)` enables deterministic unit testing.
 */
export function spinArcadeSlotReels(
  betLul: number,
  playerLulBalance: number,
  rolls?: readonly [number, number, number],
): ArcadeSlotSpinResult {
  const safeBet = Math.floor(betLul);
  const safeBalance = Math.max(0, Math.floor(playerLulBalance));

  if (!Number.isFinite(betLul) || safeBet < ARCADE_SLOT_MIN_BET_LUL || !Number.isInteger(betLul)) {
    return {
      ok: false,
      reason: 'invalid_bet',
      message: `Minimum stake is ${ARCADE_SLOT_MIN_BET_LUL} CerBucks.`,
      betLul: safeBet,
      updatedLulBalance: safeBalance,
      evaluation: null,
    };
  }

  if (safeBalance < safeBet) {
    return {
      ok: false,
      reason: 'insufficient_lul',
      message: `Need ${safeBet} CerBucks to spin (you have ${safeBalance} CerBucks).`,
      betLul: safeBet,
      updatedLulBalance: safeBalance,
      evaluation: null,
    };
  }

  const pickStop = (uRaw?: number): ArcadeSlotSymbolId => {
    const u = uRaw !== undefined && Number.isFinite(uRaw) ? Math.min(0.999999, Math.max(0, uRaw)) : Math.random();
    const idx = Math.floor(u * ARCADE_SLOT_STRIP.length);
    return ARCADE_SLOT_STRIP[idx] ?? 'cherry';
  };

  const reels: [ArcadeSlotSymbolId, ArcadeSlotSymbolId, ArcadeSlotSymbolId] = [
    pickStop(rolls?.[0]),
    pickStop(rolls?.[1]),
    pickStop(rolls?.[2]),
  ];
  const evaluation = evaluateArcadeSlotCombination(reels, safeBet);
  return {
    ok: true,
    message: evaluation.headline,
    betLul: safeBet,
    updatedLulBalance: safeBalance + evaluation.netDeltaLul,
    evaluation,
  };
}

/**
 * Exact theoretical Return-To-Player across all 32^3 = 32,768 reel combinations.
 */
export function computeArcadeSlotTheoreticalRtp(): number {
  const n = ARCADE_SLOT_STRIP.length;
  let totalReturn = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        totalReturn += evaluateArcadeSlotCombination(
          [ARCADE_SLOT_STRIP[i], ARCADE_SLOT_STRIP[j], ARCADE_SLOT_STRIP[k]],
          1,
        ).payoutLul;
      }
    }
  }
  return totalReturn / (n * n * n);
}
