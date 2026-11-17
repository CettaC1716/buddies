export type CasinoRouletteBetType =
  | 'red'
  | 'black'
  | 'even'
  | 'odd'
  | 'low'
  | 'high'
  | 'zero';

export const CASINO_CHIP_TIERS = [5, 10, 25, 50] as const;
export type CasinoChipTier = (typeof CASINO_CHIP_TIERS)[number];

const ROULETTE_RED_NUMBERS = new Set<number>([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export type RoulettePocketColor = 'red' | 'black' | 'green';

export interface CasinoRouletteSpinResult {
  ok: boolean;
  reason?: 'invalid_bet' | 'insufficient_lul';
  message: string;
  betType: CasinoRouletteBetType;
  stakeLul: number;
  pocketNumber: number;
  pocketColor: RoulettePocketColor;
  won: boolean;
  payoutLul: number;
  netDeltaLul: number;
  xpGained: number;
}

export function getRoulettePocketColor(pocketNumber: number): RoulettePocketColor {
  if (pocketNumber === 0) return 'green';
  return ROULETTE_RED_NUMBERS.has(pocketNumber) ? 'red' : 'black';
}

export function spinCasinoRouletteWheel(
  betType: CasinoRouletteBetType,
  stakeLul: number,
  playerLulBalance: number,
  rollOverride?: number,
): CasinoRouletteSpinResult {
  const safeStake = Math.floor(stakeLul);
  const safeBal = Math.max(0, Math.floor(playerLulBalance));

  if (!Number.isFinite(stakeLul) || safeStake < 1 || !Number.isInteger(stakeLul)) {
    return {
      ok: false,
      reason: 'invalid_bet',
      message: 'Minimum Roulette bet is 1 LUL.',
      betType,
      stakeLul: safeStake,
      pocketNumber: 0,
      pocketColor: 'green',
      won: false,
      payoutLul: 0,
      netDeltaLul: 0,
      xpGained: 0,
    };
  }

  if (safeBal < safeStake) {
    return {
      ok: false,
      reason: 'insufficient_lul',
      message: `Need ${safeStake} LUL to spin Roulette (you have ${safeBal} LUL).`,
      betType,
      stakeLul: safeStake,
      pocketNumber: 0,
      pocketColor: 'green',
      won: false,
      payoutLul: 0,
      netDeltaLul: 0,
      xpGained: 0,
    };
  }

  const u =
    rollOverride !== undefined && Number.isFinite(rollOverride)
      ? Math.min(0.999999, Math.max(0, rollOverride))
      : Math.random();
  const pocketNumber = Math.floor(u * 37);
  const pocketColor = getRoulettePocketColor(pocketNumber);

  let won = false;
  let multiplier = 0;

  if (betType === 'zero') {
    won = pocketNumber === 0;
    multiplier = won ? 36 : 0;
  } else if (pocketNumber !== 0) {
    if (betType === 'red') won = pocketColor === 'red';
    else if (betType === 'black') won = pocketColor === 'black';
    else if (betType === 'even') won = pocketNumber % 2 === 0;
    else if (betType === 'odd') won = pocketNumber % 2 === 1;
    else if (betType === 'low') won = pocketNumber >= 1 && pocketNumber <= 18;
    else if (betType === 'high') won = pocketNumber >= 19 && pocketNumber <= 36;
    multiplier = won ? 2 : 0;
  }

  const payoutLul = safeStake * multiplier;
  const netDeltaLul = payoutLul - safeStake;
  const xpGained = won ? (betType === 'zero' ? 30 : 8) : 2;
  const message = won
    ? `#${pocketNumber} (${pocketColor.toUpperCase()}) · WIN +${payoutLul} LUL!`
    : `#${pocketNumber} (${pocketColor.toUpperCase()}) · HOUSE TAKES -${safeStake} LUL`;

  return {
    ok: true,
    message,
    betType,
    stakeLul: safeStake,
    pocketNumber,
    pocketColor,
    won,
    payoutLul,
    netDeltaLul,
    xpGained,
  };
}

export type CardSuit = '♠' | '♥' | '♦' | '♣';
export type CardRank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface PlayingCard {
  rank: CardRank;
  suit: CardSuit;
}

export interface CasinoBlackjackState {
  phase: 'player_turn' | 'settled';
  stakeLul: number;
  deck: PlayingCard[];
  playerHand: PlayingCard[];
  dealerHand: PlayingCard[];
  outcome: 'blackjack' | 'win' | 'push' | 'lose' | null;
  payoutLul: number;
  xpGained: number;
  headline: string;
}

const SUITS: readonly CardSuit[] = ['♠', '♥', '♦', '♣'];
const RANKS: readonly CardRank[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
];

export function createShuffledBlackjackDeck(rng: () => number = Math.random): PlayingCard[] {
  const deck: PlayingCard[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.min(0.999999, Math.max(0, rng())) * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}

export function evaluateBlackjackHandTotal(hand: ReadonlyArray<PlayingCard>): {
  total: number;
  isSoft: boolean;
  isBlackjack: boolean;
  isBust: boolean;
} {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    if (c.rank === 'A') {
      total += 11;
      aces += 1;
    } else if (c.rank === 'K' || c.rank === 'Q' || c.rank === 'J') {
      total += 10;
    } else {
      total += Number(c.rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return {
    total,
    isSoft: aces > 0,
    isBlackjack: hand.length === 2 && total === 21,
    isBust: total > 21,
  };
}

export function dealCasinoBlackjackHand(
  stakeLul: number,
  deckOverride?: PlayingCard[],
): CasinoBlackjackState {
  const safeStake = Math.max(1, Math.floor(stakeLul));
  const deck = deckOverride ? [...deckOverride] : createShuffledBlackjackDeck();
  const p0 = deck.pop()!;
  const d0 = deck.pop()!;
  const p1 = deck.pop()!;
  const d1 = deck.pop()!;
  const playerHand = [p0, p1];
  const dealerHand = [d0, d1];

  const pEval = evaluateBlackjackHandTotal(playerHand);
  const dEval = evaluateBlackjackHandTotal(dealerHand);

  if (pEval.isBlackjack || dEval.isBlackjack) {
    if (pEval.isBlackjack && dEval.isBlackjack) {
      return {
        phase: 'settled',
        stakeLul: safeStake,
        deck,
        playerHand,
        dealerHand,
        outcome: 'push',
        payoutLul: safeStake,
        xpGained: 4,
        headline: `DOUBLE BLACKJACK · PUSH (${safeStake} LUL BACK)`,
      };
    }
    if (pEval.isBlackjack) {
      const payoutLul = Math.floor(safeStake * 2.5);
      return {
        phase: 'settled',
        stakeLul: safeStake,
        deck,
        playerHand,
        dealerHand,
        outcome: 'blackjack',
        payoutLul,
        xpGained: 20,
        headline: `NATURAL BLACKJACK 21! +${payoutLul} LUL`,
      };
    }
    return {
      phase: 'settled',
      stakeLul: safeStake,
      deck,
      playerHand,
      dealerHand,
      outcome: 'lose',
      payoutLul: 0,
      xpGained: 2,
      headline: `DEALER BLACKJACK · -${safeStake} LUL`,
    };
  }

  return {
    phase: 'player_turn',
    stakeLul: safeStake,
    deck,
    playerHand,
    dealerHand,
    outcome: null,
    payoutLul: 0,
    xpGained: 0,
    headline: `YOUR HAND: ${pEval.total} · HIT OR STAND`,
  };
}

export function hitCasinoBlackjackHand(state: CasinoBlackjackState): CasinoBlackjackState {
  if (state.phase !== 'player_turn' || state.deck.length === 0) return state;
  const deck = [...state.deck];
  const nextCard = deck.pop()!;
  const playerHand = [...state.playerHand, nextCard];
  const pEval = evaluateBlackjackHandTotal(playerHand);

  if (pEval.isBust) {
    return {
      ...state,
      phase: 'settled',
      deck,
      playerHand,
      outcome: 'lose',
      payoutLul: 0,
      xpGained: 2,
      headline: `BUST (${pEval.total}) · -${state.stakeLul} LUL`,
    };
  }

  if (pEval.total === 21) {
    return standCasinoBlackjackHand({
      ...state,
      deck,
      playerHand,
    });
  }

  return {
    ...state,
    deck,
    playerHand,
    headline: `YOUR HAND: ${pEval.total} · HIT OR STAND`,
  };
}

export function standCasinoBlackjackHand(state: CasinoBlackjackState): CasinoBlackjackState {
  if (state.phase !== 'player_turn') return state;
  const deck = [...state.deck];
  const dealerHand = [...state.dealerHand];

  while (evaluateBlackjackHandTotal(dealerHand).total < 17 && deck.length > 0) {
    dealerHand.push(deck.pop()!);
  }

  const pTotal = evaluateBlackjackHandTotal(state.playerHand).total;
  const dEval = evaluateBlackjackHandTotal(dealerHand);

  if (dEval.isBust || pTotal > dEval.total) {
    const payoutLul = state.stakeLul * 2;
    return {
      ...state,
      phase: 'settled',
      deck,
      dealerHand,
      outcome: 'win',
      payoutLul,
      xpGained: 10,
      headline: dEval.isBust
        ? `DEALER BUST (${dEval.total}) · WIN +${payoutLul} LUL!`
        : `YOU WIN ${pTotal} VS ${dEval.total} · +${payoutLul} LUL!`,
    };
  }

  if (pTotal === dEval.total) {
    return {
      ...state,
      phase: 'settled',
      deck,
      dealerHand,
      outcome: 'push',
      payoutLul: state.stakeLul,
      xpGained: 4,
      headline: `PUSH AT ${pTotal} · ${state.stakeLul} LUL RETURNED`,
    };
  }

  return {
    ...state,
    phase: 'settled',
    deck,
    dealerHand,
    outcome: 'lose',
    payoutLul: 0,
    xpGained: 2,
    headline: `DEALER WINS ${dEval.total} VS ${pTotal} · -${state.stakeLul} LUL`,
  };
}

// =============================================================================
// INTERACTIVE EUROPEAN ROULETTE (SINGLE-ZERO WHEEL, INSIDE/OUTSIDE BETS, 200-DRAW STATS)
// =============================================================================

export const ROULETTE_WHEEL_ORDER: readonly number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14,
  31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export const ROULETTE_TABLE_ROWS: readonly (readonly number[])[] = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];

export type RouletteBetKind =
  | 'straight'
  | 'split'
  | 'street'
  | 'corner'
  | 'first4'
  | 'column'
  | 'dozen'
  | 'red'
  | 'black'
  | 'even'
  | 'odd'
  | 'low'
  | 'high';

export interface RoulettePlacedBet {
  id: string;
  kind: RouletteBetKind;
  label: string;
  numbers: number[];
  multiplier: number;
  amountLul: number;
}

export const ROULETTE_PAYTABLE_ROWS: ReadonlyArray<{
  label: string;
  payoutText: string;
}> = [
  { label: 'COLOR (R / B / 0)', payoutText: '2x | 2x | 36x' },
  { label: 'NUMBER (STRAIGHT)', payoutText: '36x' },
  { label: 'SPLIT (2 NUMS)', payoutText: '18x' },
  { label: '3 LINE (STREET)', payoutText: '12x' },
  { label: 'CORNER (4 NUMS)', payoutText: '9x' },
  { label: 'FIRST 4 (0,1,2,3)', payoutText: '9x' },
  { label: 'DOZENS (12 NUMS)', payoutText: '3x' },
  { label: 'COLUMN (2:1)', payoutText: '3x' },
  { label: 'ODD / EVEN', payoutText: '2x' },
  { label: 'HIGH / LOW', payoutText: '2x' },
  { label: 'NEIGHBOURS (±2)', payoutText: '5 × 36x' },
];

export function getRouletteBetMultiplier(kind: RouletteBetKind): number {
  switch (kind) {
    case 'straight':
      return 36;
    case 'split':
      return 18;
    case 'street':
      return 12;
    case 'corner':
    case 'first4':
      return 9;
    case 'column':
    case 'dozen':
      return 3;
    case 'red':
    case 'black':
    case 'even':
    case 'odd':
    case 'low':
    case 'high':
      return 2;
  }
}

export function getWheelNeighbours(centerNumber: number, radius = 2): number[] {
  const idx = ROULETTE_WHEEL_ORDER.indexOf(centerNumber);
  if (idx === -1) return [centerNumber];
  const n = ROULETTE_WHEEL_ORDER.length;
  const out: number[] = [];
  for (let offset = -radius; offset <= radius; offset++) {
    out.push(ROULETTE_WHEEL_ORDER[(idx + offset + n) % n]);
  }
  return out;
}

export function evaluateRouletteBets(
  bets: ReadonlyArray<RoulettePlacedBet>,
  winningNumber: number,
): {
  totalStake: number;
  totalPayout: number;
  netDelta: number;
  xpGained: number;
  winningBetCount: number;
} {
  let totalStake = 0;
  let totalPayout = 0;
  let winningBetCount = 0;
  for (const bet of bets) {
    totalStake += bet.amountLul;
    if (bet.numbers.includes(winningNumber)) {
      totalPayout += bet.amountLul * bet.multiplier;
      winningBetCount += 1;
    }
  }
  const netDelta = totalPayout - totalStake;
  const xpGained =
    totalStake <= 0 ? 0 : totalPayout > 0 ? Math.min(45, 6 + winningBetCount * 4) : 2;
  return {
    totalStake,
    totalPayout,
    netDelta,
    xpGained,
    winningBetCount,
  };
}

export function createInitialRouletteHistory200(): number[] {
  // Deterministic 200-draw European roulette baseline via LCG so initial hot/cold & % charts look realistic
  const out: number[] = [];
  let seed = 13374209;
  for (let i = 0; i < 200; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    out.push(seed % 37);
  }
  return out;
}

export interface RouletteTelemetryStats {
  totalDraws: number;
  counts: number[]; // length 37, index 0..36
  redPct: number;
  blackPct: number;
  zeroPct: number;
  dozen1Pct: number;
  dozen2Pct: number;
  dozen3Pct: number;
  hotNumbers: Array<{ num: number; count: number }>;
  coldNumbers: Array<{ num: number; count: number }>;
}

export function computeRouletteStats(history: ReadonlyArray<number>): RouletteTelemetryStats {
  const counts = new Array<number>(37).fill(0);
  let redCount = 0;
  let blackCount = 0;
  let zeroCount = 0;
  let d1 = 0;
  let d2 = 0;
  let d3 = 0;

  for (const n of history) {
    if (n >= 0 && n <= 36) {
      counts[n] += 1;
      const col = getRoulettePocketColor(n);
      if (col === 'green') zeroCount += 1;
      else if (col === 'red') redCount += 1;
      else blackCount += 1;

      if (n >= 1 && n <= 12) d1 += 1;
      else if (n >= 13 && n <= 24) d2 += 1;
      else if (n >= 25 && n <= 36) d3 += 1;
    }
  }

  const totalDraws = Math.max(1, history.length);
  const nonZeroTotal = Math.max(1, d1 + d2 + d3);
  const entries = counts.map((count, num) => ({ num, count }));
  const hotNumbers = [...entries]
    .sort((a, b) => b.count - a.count || a.num - b.num)
    .slice(0, 4);
  const coldNumbers = [...entries]
    .sort((a, b) => a.count - b.count || a.num - b.num)
    .slice(0, 4);

  return {
    totalDraws: history.length,
    counts,
    redPct: Math.round((redCount / totalDraws) * 100),
    blackPct: Math.round((blackCount / totalDraws) * 100),
    zeroPct: Math.round((zeroCount / totalDraws) * 100),
    dozen1Pct: Math.round((d1 / nonZeroTotal) * 100),
    dozen2Pct: Math.round((d2 / nonZeroTotal) * 100),
    dozen3Pct: Math.round((d3 / nonZeroTotal) * 100),
    hotNumbers,
    coldNumbers,
  };
}

// =============================================================================
// 3 ADDITIONAL BANK-SPECIFIC SLOT GAMES (LUCKY DRAW 777, SAPPHIRE 5-LINE, FORTUNE WHEEL)
// =============================================================================

export type LuckyDrawTileKind = 'mult' | 'push' | 'miss' | 'mystery' | 'respin' | 'vault_boost';

export interface LuckyDrawTileSpec {
  index: number;
  gridRow: number; // 0..3 inside 4x4 layout
  gridCol: number; // 0..3 inside 4x4 layout
  kind: LuckyDrawTileKind;
  label: string;
  sublabel: string;
  multiplier: number;
  weight: number;
  bgHex: string;
  badgeHex: string;
  iconKey: 'seven' | 'diamond' | 'star' | 'bell' | 'cherry' | 'mystery' | 'vault';
}

// 12 perimeter tiles ordered clockwise around a 4x4 grid leaving center 2x2 (r=1..2, c=1..2) for x777 VAULT
export const LUCKY_DRAW_TILES: ReadonlyArray<LuckyDrawTileSpec> = [
  { index: 0, gridRow: 0, gridCol: 0, kind: 'mult', label: '10x', sublabel: 'SUPER 7', multiplier: 10, weight: 2, bgHex: '#fde047', badgeHex: '#ef4444', iconKey: 'seven' },
  { index: 1, gridRow: 0, gridCol: 1, kind: 'push', label: '1x', sublabel: 'PUSH', multiplier: 1, weight: 14, bgHex: '#f7efe0', badgeHex: '#64748b', iconKey: 'cherry' },
  { index: 2, gridRow: 0, gridCol: 2, kind: 'mult', label: '3x', sublabel: 'STAR', multiplier: 3, weight: 9, bgHex: '#fef3c7', badgeHex: '#eab308', iconKey: 'star' },
  { index: 3, gridRow: 0, gridCol: 3, kind: 'vault_boost', label: '+25%', sublabel: 'VAULT', multiplier: 1, weight: 8, bgHex: '#f3e8ff', badgeHex: '#a855f7', iconKey: 'vault' },
  { index: 4, gridRow: 1, gridCol: 3, kind: 'mult', label: '5x', sublabel: 'GEM', multiplier: 5, weight: 5, bgHex: '#e0f2fe', badgeHex: '#0ea5e9', iconKey: 'diamond' },
  { index: 5, gridRow: 2, gridCol: 3, kind: 'miss', label: '0x', sublabel: 'MISS', multiplier: 0, weight: 26, bgHex: '#e2e8f0', badgeHex: '#475569', iconKey: 'cherry' },
  { index: 6, gridRow: 3, gridCol: 3, kind: 'mult', label: '7x', sublabel: 'LUCKY 7', multiplier: 7, weight: 3, bgHex: '#fee2e2', badgeHex: '#dc2626', iconKey: 'seven' },
  { index: 7, gridRow: 3, gridCol: 2, kind: 'respin', label: 'FREE', sublabel: 'RE-SPIN', multiplier: 0, weight: 10, bgHex: '#dcfce7', badgeHex: '#16a34a', iconKey: 'star' },
  { index: 8, gridRow: 3, gridCol: 1, kind: 'mult', label: '2x', sublabel: 'BELL', multiplier: 2, weight: 13, bgHex: '#ffedd5', badgeHex: '#f97316', iconKey: 'bell' },
  { index: 9, gridRow: 3, gridCol: 0, kind: 'miss', label: '0x', sublabel: 'MISS', multiplier: 0, weight: 24, bgHex: '#e2e8f0', badgeHex: '#475569', iconKey: 'cherry' },
  { index: 10, gridRow: 2, gridCol: 0, kind: 'mystery', label: '???', sublabel: 'MYSTERY', multiplier: 0, weight: 7, bgHex: '#fae8ff', badgeHex: '#d946ef', iconKey: 'mystery' },
  { index: 11, gridRow: 1, gridCol: 0, kind: 'mult', label: '4x', sublabel: 'STAR', multiplier: 4, weight: 7, bgHex: '#fef9c3', badgeHex: '#ca8a04', iconKey: 'star' },
];

export interface LuckyDrawSpinEvaluation {
  tile: LuckyDrawTileSpec;
  resolvedMultiplier: number;
  payoutLul: number;
  vaultJackpotTriggered: boolean;
  vaultBonusLul: number;
  nextVaultProgressPct: number;
  grantsFreeRespin: boolean;
  xpGained: number;
  headline: string;
}

export function spinLuckyDrawTile(
  betLul: number,
  currentVaultPct: number,
  isFreeRespin = false,
  rollOverride?: number,
): LuckyDrawSpinEvaluation {
  const safeBet = Math.max(2, Math.floor(betLul));
  const totalWeight = LUCKY_DRAW_TILES.reduce((acc, t) => acc + t.weight, 0);
  const u =
    rollOverride !== undefined && Number.isFinite(rollOverride)
      ? Math.min(0.999999, Math.max(0, rollOverride))
      : Math.random();
  let cursor = u * totalWeight;
  let picked = LUCKY_DRAW_TILES[LUCKY_DRAW_TILES.length - 1];
  for (const t of LUCKY_DRAW_TILES) {
    cursor -= t.weight;
    if (cursor <= 0) {
      picked = t;
      break;
    }
  }

  let resolvedMult = picked.multiplier;
  if (picked.kind === 'mystery') {
    const mysteryPool = [2, 3, 4, 5, 8, 10];
    resolvedMult = mysteryPool[Math.floor(Math.random() * mysteryPool.length)] ?? 3;
  }

  const grantsFreeRespin = picked.kind === 'respin';
  const basePayout = safeBet * resolvedMult;
  const vaultGain = picked.kind === 'vault_boost' ? 25 : isFreeRespin ? 6 : 10;
  const rawVaultNext = Math.min(100, Math.max(0, Math.round(currentVaultPct)) + vaultGain);
  const vaultJackpotTriggered = rawVaultNext >= 100;
  const vaultBonusLul = vaultJackpotTriggered ? safeBet * 777 : 0;
  const nextVaultProgressPct = vaultJackpotTriggered ? 0 : rawVaultNext;
  const totalPayout = basePayout + vaultBonusLul;

  let headline = '';
  if (vaultJackpotTriggered) {
    headline = `VAULT 100%! x777 JACKPOT +${totalPayout.toLocaleString()} LUL!`;
  } else if (grantsFreeRespin) {
    headline = 'FREE RE-SPIN UNLOCKED · VAULT CHARGED!';
  } else if (picked.kind === 'mystery') {
    headline = `MYSTERY BOX ${resolvedMult}x · +${totalPayout} LUL!`;
  } else if (picked.kind === 'vault_boost') {
    headline = `VAULT +25% SURGE · +${totalPayout} LUL BACK`;
  } else if (totalPayout > safeBet) {
    headline = `LANDED ON ${picked.label} ${picked.sublabel} · +${totalPayout} LUL!`;
  } else if (totalPayout === safeBet) {
    headline = `1x PUSH · ${totalPayout} LUL RETURNED`;
  } else {
    headline = isFreeRespin ? 'FREE RE-SPIN MISSED · TRY AGAIN' : `MISS · -${safeBet} LUL`;
  }

  const xpGained = vaultJackpotTriggered ? 60 : totalPayout > safeBet ? 10 : grantsFreeRespin ? 5 : 2;

  return {
    tile: picked,
    resolvedMultiplier: resolvedMult,
    payoutLul: totalPayout,
    vaultJackpotTriggered,
    vaultBonusLul,
    nextVaultProgressPct,
    grantsFreeRespin,
    xpGained,
    headline,
  };
}

// Game 3: Sapphire 5-Line 3x3 Slot Matrix
export type SapphireSymbolId = 'seven' | 'diamond' | 'star' | 'bell' | 'coffee' | 'cherry';

export interface SapphireSymbolSpec {
  id: SapphireSymbolId;
  label: string;
  weight: number;
  lineMultiplier: number;
  accentHex: string;
}

export const SAPPHIRE_5LINE_SYMBOLS: ReadonlyArray<SapphireSymbolSpec> = [
  { id: 'seven', label: 'SAPPHIRE 7', weight: 2, lineMultiplier: 25, accentHex: '#ef4444' },
  { id: 'diamond', label: 'BLUE GEM', weight: 4, lineMultiplier: 12, accentHex: '#38bdf8' },
  { id: 'star', label: 'STARLIGHT', weight: 5, lineMultiplier: 8, accentHex: '#eab308' },
  { id: 'bell', label: 'ROYAL BELL', weight: 7, lineMultiplier: 5, accentHex: '#f59e0b' },
  { id: 'coffee', label: 'GOLD CUP', weight: 8, lineMultiplier: 3, accentHex: '#92400e' },
  { id: 'cherry', label: 'CHERRY', weight: 10, lineMultiplier: 2, accentHex: '#ec4899' },
];

export const SAPPHIRE_5_PAYLINES: ReadonlyArray<{
  id: string;
  label: string;
  cells: readonly [number, number, number]; // flat indices 0..8 in 3x3 row-major grid
  colorHex: string;
}> = [
  { id: 'top', label: 'TOP ROW', cells: [0, 1, 2], colorHex: '#ef4444' },
  { id: 'mid', label: 'MID ROW', cells: [3, 4, 5], colorHex: '#22c55e' },
  { id: 'bot', label: 'BOT ROW', cells: [6, 7, 8], colorHex: '#38bdf8' },
  { id: 'diag_tl', label: 'DIAG ↘', cells: [0, 4, 8], colorHex: '#facc15' },
  { id: 'diag_bl', label: 'DIAG ↗', cells: [6, 4, 2], colorHex: '#e879f9' },
];

export interface Sapphire5LineEvaluation {
  grid: SapphireSymbolId[]; // length 9
  winningLines: Array<{
    lineId: string;
    label: string;
    symbolId: SapphireSymbolId;
    multiplier: number;
    payoutLul: number;
    cells: readonly [number, number, number];
    colorHex: string;
  }>;
  payoutLul: number;
  xpGained: number;
  headline: string;
}

export function spinSapphire5LineMatrix(betLul: number): Sapphire5LineEvaluation {
  const safeBet = Math.max(2, Math.floor(betLul));
  const totalWeight = SAPPHIRE_5LINE_SYMBOLS.reduce((acc, s) => acc + s.weight, 0);
  const pickOne = (): SapphireSymbolId => {
    let cursor = Math.random() * totalWeight;
    for (const s of SAPPHIRE_5LINE_SYMBOLS) {
      cursor -= s.weight;
      if (cursor <= 0) return s.id;
    }
    return 'cherry';
  };
  const grid = Array.from({ length: 9 }, () => pickOne());
  const byId = Object.fromEntries(SAPPHIRE_5LINE_SYMBOLS.map((s) => [s.id, s])) as Record<
    SapphireSymbolId,
    SapphireSymbolSpec
  >;

  const winningLines: Sapphire5LineEvaluation['winningLines'] = [];
  for (const line of SAPPHIRE_5_PAYLINES) {
    const [a, b, c] = line.cells;
    if (grid[a] === grid[b] && grid[b] === grid[c]) {
      const spec = byId[grid[a]];
      const linePayout = safeBet * spec.lineMultiplier;
      winningLines.push({
        lineId: line.id,
        label: line.label,
        symbolId: spec.id,
        multiplier: spec.lineMultiplier,
        payoutLul: linePayout,
        cells: line.cells,
        colorHex: line.colorHex,
      });
    }
  }

  const payoutLul = winningLines.reduce((acc, w) => acc + w.payoutLul, 0);
  const xpGained =
    winningLines.length === 0 ? 2 : Math.min(35, 6 + winningLines.length * 8);
  const headline =
    winningLines.length > 0
      ? `${winningLines.length} PAYLINE HIT! +${payoutLul} LUL`
      : `NO 3-IN-A-ROW LINE · -${safeBet} LUL`;

  return { grid, winningLines, payoutLul, xpGained, headline };
}

// Game 4: Emerald Fortune Spin Wheel (8 crisp cel-shaded segments)
export interface FortuneWheelSector {
  index: number;
  label: string;
  multiplier: number;
  weight: number;
  fillHex: string;
  textHex: string;
}

export const FORTUNE_WHEEL_SECTORS: ReadonlyArray<FortuneWheelSector> = [
  { index: 0, label: '50x JP', multiplier: 50, weight: 2, fillHex: '#fec83e', textHex: '#14161d' },
  { index: 1, label: 'MISS', multiplier: 0, weight: 24, fillHex: '#334155', textHex: '#f8fafc' },
  { index: 2, label: '3x', multiplier: 3, weight: 16, fillHex: '#38bdf8', textHex: '#14161d' },
  { index: 3, label: '8x', multiplier: 8, weight: 8, fillHex: '#e879f9', textHex: '#14161d' },
  { index: 4, label: '2x', multiplier: 2, weight: 22, fillHex: '#b8ff3c', textHex: '#14161d' },
  { index: 5, label: 'MISS', multiplier: 0, weight: 22, fillHex: '#1e293b', textHex: '#cbd5e1' },
  { index: 6, label: '15x', multiplier: 15, weight: 5, fillHex: '#fb7185', textHex: '#14161d' },
  { index: 7, label: '5x', multiplier: 5, weight: 12, fillHex: '#34d399', textHex: '#14161d' },
];

export interface FortuneWheelSpinResult {
  sector: FortuneWheelSector;
  payoutLul: number;
  xpGained: number;
  headline: string;
}

export function spinEmeraldFortuneWheel(
  betLul: number,
  rollOverride?: number,
): FortuneWheelSpinResult {
  const safeBet = Math.max(2, Math.floor(betLul));
  const totalWeight = FORTUNE_WHEEL_SECTORS.reduce((acc, s) => acc + s.weight, 0);
  const u =
    rollOverride !== undefined && Number.isFinite(rollOverride)
      ? Math.min(0.999999, Math.max(0, rollOverride))
      : Math.random();
  let cursor = u * totalWeight;
  let picked = FORTUNE_WHEEL_SECTORS[FORTUNE_WHEEL_SECTORS.length - 1];
  for (const s of FORTUNE_WHEEL_SECTORS) {
    cursor -= s.weight;
    if (cursor <= 0) {
      picked = s;
      break;
    }
  }
  const payoutLul = safeBet * picked.multiplier;
  const xpGained = picked.multiplier >= 15 ? 25 : picked.multiplier > 0 ? 8 : 2;
  const headline =
    payoutLul > 0
      ? `WHEEL LANDED ON ${picked.label} · +${payoutLul} LUL!`
      : `WHEEL LANDED ON MISS · -${safeBet} LUL`;
  return {
    sector: picked,
    payoutLul,
    xpGained,
    headline,
  };
}

