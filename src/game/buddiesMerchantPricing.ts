/**
 * ============================================================================
 * BUDDIES BLITZ 3D — NPC MERCHANT PRICING RULES & 3-CURRENCY ECONOMY
 * ============================================================================
 * Readable single-file economy engine for NEAR Hackathon Track: `games` & `nfts`.
 *
 * Three-Tier Currency Architecture (Non-Crypto vs NEAR Protocol Crypto):
 *  1. `LUL` (Lulling)   — Non-crypto activity currency earned from mini-games such as
 *                         East Beach Fishing and Warzone battles. Exchangeable into `CYON`.
 *  2. `CYON` (Halcyon)  — Non-crypto currency obtained by exchanging `LUL -> CYON`
 *                         at the Exchange Merchant. Used to buy non-NFT items such as
 *                         Outfits (future expansion) & standard interior furniture.
 *  3. `RESPITE`         — Crypto smart contract coin (`NEP-141` Fungible Token on NEAR Protocol:
 *                         `market.buddiesblitz.testnet`). Obtained via one-way `NEAR Testnet -> RESPITE`
 *                         utility swap (`swap_near_for_respite`) at Hana's ATM or P2P NFT sales on
 *                         Kai's Market. Used for House Ownership Deeds, Family AI, & Collector NFTs.
 * ============================================================================
 */

import { BaseGardenPresetId, BaseSkinThemeId } from './buddiesBlitzRules';

export type MerchantLocationId = 'lobby_cafe' | 'beach_house';

export type HouseInteriorSlotId = 'center_table' | 'left_wall' | 'right_wall' | 'corner_plant' | 'trophy_pedestal';

export interface MerchantCatalogItem {
  id: string;
  tokenId: string; // NEP-245 multi-token ID (for NFT items) or catalog SKU
  name: string;
  category: 'non_nft_furniture' | 'nft_house_theme' | 'nft_collector_furniture' | 'fishing_gear';
  currency: 'CYON' | 'RESPITE';
  basePrice: number;
  targetStock: number;
  initialStock: number;
  isNft: boolean;
  description: string;
  merchantId?: MerchantLocationId;
  isEquippableRod?: boolean;
  iconEmoji?: string;
  interiorSlot?: HouseInteriorSlotId;
  skinThemeId?: BaseSkinThemeId;
  gardenPresetId?: BaseGardenPresetId;
  /** 2D OBB footprint rectangles `[offsetX, offsetZ, width, depth]` in meters */
  footprints?: readonly [number, number, number, number][];
  /** Item height in meters used for spring-damper wobble pivot `Gc(item)` */
  height?: number;
  /** Default 3D floor coordinates inside the cutaway room */
  defaultPose?: { x: number; z: number; ry: number };
}

export const MERCHANT_CATALOG_ITEMS: readonly MerchantCatalogItem[] = [
  // --- NON-NFT FURNITURE (Bought with CYON) ---
  {
    id: 'tatami_tea_table',
    tokenId: 'item:tatami_tea_table',
    name: 'Chabudai Low Tea Table',
    category: 'non_nft_furniture',
    currency: 'CYON',
    basePrice: 35,
    targetStock: 10,
    initialStock: 10,
    isNft: false,
    description: 'Japanese low wooden tea table complete with zabuton floor cushions & warm candle.',
    interiorSlot: 'center_table',
    footprints: [[0, 0, 1.35, 1.15]],
    height: 0.55,
    defaultPose: { x: -2.6, z: -0.9, ry: 0 },
  },
  {
    id: 'sakura_bonsai_pot',
    tokenId: 'item:sakura_bonsai_pot',
    name: 'Indoor Sakura Bonsai',
    category: 'non_nft_furniture',
    currency: 'CYON',
    basePrice: 40,
    targetStock: 10,
    initialStock: 9,
    isNft: false,
    description: 'Ceramic Sakura bonsai pot & organic tropical greenery for a private house corner.',
    interiorSlot: 'corner_plant',
    footprints: [[0, 0, 0.65, 0.65]],
    height: 1.65,
    defaultPose: { x: 0.6, z: -3.0, ry: 0 },
  },
  {
    id: 'shoji_floor_lamp',
    tokenId: 'item:shoji_floor_lamp',
    name: 'Andon Shoji Arc Lamp',
    category: 'non_nft_furniture',
    currency: 'CYON',
    basePrice: 50,
    targetStock: 8,
    initialStock: 8,
    isNft: false,
    description: 'Shoji paper & brass arc floor lamp that automatically illuminates in the evening and night.',
    interiorSlot: 'left_wall',
    footprints: [[0, 0, 0.58, 0.58]],
    height: 1.95,
    defaultPose: { x: -4.6, z: -2.9, ry: Math.PI / 4 },
  },
  {
    id: 'tactical_sofa_lounge',
    tokenId: 'item:tactical_sofa_lounge',
    name: 'Velvet L-Sectional Sofa',
    category: 'non_nft_furniture',
    currency: 'CYON',
    basePrice: 85,
    targetStock: 6,
    initialStock: 6,
    isNft: false,
    description: 'Plush L-sectional sofa with throw pillows for the Private House living room.',
    interiorSlot: 'right_wall',
    footprints: [
      [0, 0, 2.4, 0.92],
      [0.75, 0.68, 0.9, 0.62],
    ],
    height: 0.88,
    defaultPose: { x: -2.6, z: -2.4, ry: 0 },
  },
  {
    id: 'arcade_blitz_cab',
    tokenId: 'item:arcade_blitz_cab',
    name: 'Retro Blitz Arcade Cabinet',
    category: 'non_nft_furniture',
    currency: 'CYON',
    basePrice: 110,
    targetStock: 5,
    initialStock: 4,
    isNft: false,
    description: 'Glowing neon retro arcade cabinet with an illuminated CRT screen for the studio room.',
    interiorSlot: 'trophy_pedestal',
    footprints: [[0, 0, 0.92, 0.88]],
    height: 1.95,
    defaultPose: { x: 3.6, z: -2.6, ry: 0 },
  },

  // --- EXCLUSIVE NFT HOUSE THEMES & COLLECTOR ITEMS (Bought with RESPITE) ---
  {
    id: 'theme_japanese_zen',
    tokenId: 'nep245:theme:japanese_zen',
    name: 'Japanese Sakura Style (Default)',
    category: 'nft_house_theme',
    currency: 'RESPITE',
    basePrice: 10,
    targetStock: 12,
    initialStock: 12,
    isNft: true,
    description: 'Classic Japanese architectural house theme with a Sakura Grove garden & stone lanterns.',
    skinThemeId: 'military_standard',
    gardenPresetId: 'sakura_grove',
  },
  {
    id: 'theme_cyber_neon',
    tokenId: 'nep245:theme:cyber_neon',
    name: 'Cyber Neon Shinjuku Theme NFT',
    category: 'nft_house_theme',
    currency: 'RESPITE',
    basePrice: 15,
    targetStock: 5,
    initialStock: 4,
    isNft: true,
    description: 'Exclusive House Theme: Transforms house exterior and interior into electric cyan neon.',
    skinThemeId: 'cyber_neon',
    gardenPresetId: 'zen_rock',
  },
  {
    id: 'theme_royal_gold',
    tokenId: 'nep245:theme:royal_gold',
    name: 'Imperial Golden Shogun Theme NFT',
    category: 'nft_house_theme',
    currency: 'RESPITE',
    basePrice: 25,
    targetStock: 3,
    initialStock: 2,
    isNft: true,
    description: 'Exclusive House Theme: Gold-leaf facade paired with a Sakura garden.',
    skinThemeId: 'royal_gold',
    gardenPresetId: 'golden_park',
  },
  {
    id: 'nft_golden_katana_rack',
    tokenId: 'nep245:furniture:golden_katana_rack',
    name: 'Shogun Katana Credenza NFT',
    category: 'nft_collector_furniture',
    currency: 'RESPITE',
    basePrice: 12,
    targetStock: 4,
    initialStock: 3,
    isNft: true,
    description: 'Collector Furniture: Wooden credenza and golden katana display rack.',
    interiorSlot: 'left_wall',
    footprints: [[0, 0, 1.65, 0.55]],
    height: 1.35,
    defaultPose: { x: -4.5, z: 0.2, ry: Math.PI / 2 },
  },
  {
    id: 'nft_holo_command_globe',
    tokenId: 'nep245:furniture:holo_command_globe',
    name: 'Hologram Planet Projection Table NFT',
    category: 'nft_collector_furniture',
    currency: 'RESPITE',
    basePrice: 18,
    targetStock: 4,
    initialStock: 3,
    isNft: true,
    description: 'Collector Furniture: Circular table with a rotating 3D planet hologram.',
    interiorSlot: 'center_table',
    footprints: [[0, 0, 1.35, 1.35]],
    height: 1.45,
    defaultPose: { x: 3.2, z: 2.0, ry: 0 },
  },

  // --- MERCHANT KAI EXCLUSIVE FISHING GEAR & TACKLE CATALOG (East Beach House) ---
  {
    id: 'fishing_rod_carbon_pro',
    tokenId: 'item:fishing_rod_carbon_pro',
    name: 'Shoreline Carbon Pro Rod',
    category: 'fishing_gear',
    merchantId: 'beach_house',
    isEquippableRod: true,
    currency: 'CYON',
    basePrice: 45,
    targetStock: 10,
    initialStock: 10,
    isNft: false,
    description: 'Carbon spinning rod with smooth line tension control. Stored in your Bag.',
  },
  {
    id: 'fishing_reel_twinpower',
    tokenId: 'item:fishing_reel_twinpower',
    name: 'Twin-Drag Saltwater Reel',
    category: 'fishing_gear',
    merchantId: 'beach_house',
    currency: 'CYON',
    basePrice: 60,
    targetStock: 8,
    initialStock: 8,
    isNft: false,
    description: 'Precision saltwater reel that reduces line snap risk during strong surges.',
  },
  {
    id: 'fishing_lure_luminous_minnow',
    tokenId: 'item:fishing_lure_luminous_minnow',
    name: 'Luminous Minnow Lure Box',
    category: 'fishing_gear',
    merchantId: 'beach_house',
    currency: 'CYON',
    basePrice: 30,
    targetStock: 12,
    initialStock: 12,
    isNft: false,
    description: 'Glow lure set crafted to attract rare coastal and lake fish.',
  },
  {
    id: 'fishing_cooler_icebox',
    tokenId: 'item:fishing_cooler_icebox',
    name: 'Shoreline Marine Ice Cooler',
    category: 'fishing_gear',
    merchantId: 'beach_house',
    currency: 'CYON',
    basePrice: 55,
    targetStock: 8,
    initialStock: 8,
    isNft: false,
    description: 'Insulated marine cooler box to keep fresh catches in your Bag.',
  },
  {
    id: 'nft_golden_poseidon_rod',
    tokenId: 'nep245:fishing:golden_poseidon_rod',
    name: 'Poseidon Golden Kraken Rod NFT',
    category: 'fishing_gear',
    merchantId: 'beach_house',
    isEquippableRod: true,
    currency: 'RESPITE',
    basePrice: 15,
    targetStock: 4,
    initialStock: 4,
    isNft: true,
    description: 'Collector Rod: Gold-anodized deep-sea rod built for Mythic catches.',
  },
  {
    id: 'nft_sonar_fishfinder_pro',
    tokenId: 'nep245:fishing:sonar_fishfinder_pro',
    name: 'Shoreline Sonar Fishfinder NFT',
    category: 'fishing_gear',
    merchantId: 'beach_house',
    currency: 'RESPITE',
    basePrice: 12,
    targetStock: 5,
    initialStock: 5,
    isNft: true,
    description: 'Collector Tackle: Portable acoustic sonar for spotting trophy fish.',
  },
];

export interface MerchantAgentMarketState {
  cafeWalletId: string;
  beachWalletId: string;
  npcContractId: string;
  dayCounter: number;
  treasuryCyon: number;
  treasuryLulPool: number;
  isShopBroke: boolean;
  investorDiscountActive: boolean;
  investorCount: number;
  recentLulExchangedVolume: number;
  stockByItemId: Record<string, number>;
  demandByItemId: Record<string, number>;
  lastMarketHeadline: string;
}

export function createInitialMerchantMarketState(): MerchantAgentMarketState {
  const stockByItemId: Record<string, number> = {};
  const demandByItemId: Record<string, number> = {};
  for (const item of MERCHANT_CATALOG_ITEMS) {
    stockByItemId[item.id] = item.initialStock;
    demandByItemId[item.id] = 0;
  }
  return {
    cafeWalletId: 'cafe-merchant.buddiesblitz.near',
    beachWalletId: 'beach-merchant.buddiesblitz.near',
    npcContractId: 'items.buddiesblitz.near',
    dayCounter: 1,
    treasuryCyon: 650,
    treasuryLulPool: 5000,
    isShopBroke: false,
    investorDiscountActive: false,
    investorCount: 0,
    recentLulExchangedVolume: 0,
    stockByItemId,
    demandByItemId,
    lastMarketHeadline: 'Market is stable. LUL -> CYON exchange rate is normal and home furniture is in stock.',
  };
}

/**
 * Dynamic LUL -> CYON ATM Exchange Rate.
 * If players flood the merchant with LUL, LUL loses purchasing power (takes more LUL per 10 CYON).
 */
export function evaluateLulToCyonExchangeQuote(state: MerchantAgentMarketState): {
  lulCostFor10Cyon: number;
  cyonGranted: number;
  canExchange: boolean;
  reasoningTooltip: string;
} {
  const floodPressure = Math.floor(state.recentLulExchangedVolume / 400);
  const scarcityPressure = state.treasuryCyon < 200 ? Math.round((200 - state.treasuryCyon) / 25) : 0;
  const baseLulCost = 100;
  const rawCost = baseLulCost + floodPressure * 12 + scarcityPressure * 10;
  const discountedCost = state.investorDiscountActive ? Math.round(rawCost * 0.85) : rawCost;
  const lulCostFor10Cyon = Math.max(70, Math.min(260, discountedCost));
  const canExchange = !state.isShopBroke && state.treasuryCyon >= 10;

  const reasons: string[] = [
    `Agent Treasury: ${state.treasuryCyon} CYON`,
    `LUL Pool: ${state.treasuryLulPool} LUL`,
  ];
  if (floodPressure > 0) {
    reasons.push(`Market flooded with LUL (+${floodPressure * 12} LUL anti-bot slippage)`);
  } else {
    reasons.push('Balanced LUL volume (base rate 100 LUL = 10 CYON)');
  }
  if (scarcityPressure > 0) {
    reasons.push(`NPC CYON reserves running low (+${scarcityPressure * 10} LUL)`);
  }
  if (state.investorDiscountActive) {
    reasons.push('Investor Discount Active (-15%)');
  }
  if (state.isShopBroke) {
    reasons.push('SHOP TEMPORARILY CLOSED: NPC CYON reserves depleted! Capital investment needed.');
  }

  return {
    lulCostFor10Cyon,
    cyonGranted: 10,
    canExchange,
    reasoningTooltip: reasons.join(' · '),
  };
}

/**
 * Dynamic Item Pricing Rule (Stock + Recent Demand + Investor Discount).
 * Lives in this single readable file and produces a transparent tooltip for judges.
 */
export function evaluateMerchantItemQuote(
  state: MerchantAgentMarketState,
  item: MerchantCatalogItem,
): {
  buyPrice: number;
  sellbackPrice: number;
  stock: number;
  reasoningTooltip: string;
} {
  const stock = state.stockByItemId[item.id] ?? item.initialStock;
  const demand = state.demandByItemId[item.id] ?? 0;

  // Scarcity multiplier: fewer items in stock -> higher price; surplus stock -> cheaper price
  const stockRatio = (item.targetStock - stock) / Math.max(1, item.targetStock);
  const stockFactor = 1 + stockRatio * 0.45;
  // Demand multiplier: recent purchases push price up; sellbacks push price down
  const demandFactor = 1 + demand * 0.1;

  let multiplier = Math.max(0.55, Math.min(2.15, stockFactor * demandFactor));
  if (state.investorDiscountActive) {
    multiplier *= 0.85;
  }

  const buyPrice = Math.max(1, Math.round(item.basePrice * multiplier));
  const sellbackPrice = Math.max(1, Math.round(buyPrice * 0.65));

  const pctDiff = Math.round((buyPrice / item.basePrice - 1) * 100);
  const pctLabel = pctDiff > 0 ? `+${pctDiff}%` : `${pctDiff}%`;

  const stockNote =
    stock === 0
      ? 'Out of Stock (High pre-order markup)'
      : stock < item.targetStock * 0.6
      ? `Low Stock (${stock}/${item.targetStock})`
      : stock > item.targetStock * 1.2
      ? `Abundant Stock (${stock}/${item.targetStock} -> Discount)`
      : `Normal Stock (${stock}/${item.targetStock})`;

  const demandNote =
    demand > 0
      ? `High Demand (+${demand})`
      : demand < 0
      ? `Frequently Sold by Players (${demand})`
      : 'Stable Demand';

  const reasoningTooltip = `${stockNote} · ${demandNote} · Price ${pctLabel} from base (${item.basePrice} ${item.currency})${
    state.investorDiscountActive ? ' · Investor Discount -15%' : ''
  }`;

  return {
    buyPrice,
    sellbackPrice,
    stock,
    reasoningTooltip,
  };
}

/**
 * Exchange LUL -> CYON at the NPC Merchant.
 * If NPC runs out of CYON (< 20 CYON), the merchant goes broke until someone invests!
 */
export function executeLulToCyonExchange(
  state: MerchantAgentMarketState,
  playerLul: number,
  playerCyon: number,
): {
  ok: boolean;
  updatedState: MerchantAgentMarketState;
  updatedLul: number;
  updatedCyon: number;
  message: string;
} {
  if (state.isShopBroke) {
    return {
      ok: false,
      updatedState: state,
      updatedLul: playerLul,
      updatedCyon: playerCyon,
      message: 'My shop CYON reserves are depleted! Please invest capital first to reopen the shop.',
    };
  }
  const quote = evaluateLulToCyonExchangeQuote(state);
  if (playerLul < quote.lulCostFor10Cyon) {
    return {
      ok: false,
      updatedState: state,
      updatedLul: playerLul,
      updatedCyon: playerCyon,
      message: `Not enough LUL! Need ${quote.lulCostFor10Cyon} LUL to exchange for ${quote.cyonGranted} CYON.`,
    };
  }

  const nextTreasuryCyon = Math.max(0, state.treasuryCyon - quote.cyonGranted);
  const brokeNow = nextTreasuryCyon < 20;

  const updatedState: MerchantAgentMarketState = {
    ...state,
    treasuryCyon: nextTreasuryCyon,
    treasuryLulPool: state.treasuryLulPool + quote.lulCostFor10Cyon,
    recentLulExchangedVolume: state.recentLulExchangedVolume + quote.lulCostFor10Cyon,
    isShopBroke: brokeNow,
    lastMarketHeadline: brokeNow
      ? 'NPC TREASURY DEPLETED! Excessive LUL exchanges drained shop CYON reserves.'
      : `Exchange complete: ${quote.lulCostFor10Cyon} LUL -> +${quote.cyonGranted} CYON.`,
  };

  return {
    ok: true,
    updatedState,
    updatedLul: playerLul - quote.lulCostFor10Cyon,
    updatedCyon: playerCyon + quote.cyonGranted,
    message: brokeNow
      ? `Exchanged +${quote.cyonGranted} CYON! However, my shop CYON reserves are now depleted—investor needed!`
      : `Successfully exchanged ${quote.lulCostFor10Cyon} LUL for +${quote.cyonGranted} CYON!`,
  };
}

/**
 * Recapitalize / Invest in a broke (or low-liquidity) NPC Merchant shop.
 */
export function investInMerchantShop(
  state: MerchantAgentMarketState,
  playerLul: number,
  playerCyon: number,
): {
  ok: boolean;
  updatedState: MerchantAgentMarketState;
  updatedLul: number;
  updatedCyon: number;
  message: string;
} {
  const investCostLul = 300;
  if (playerLul < investCostLul) {
    return {
      ok: false,
      updatedState: state,
      updatedLul: playerLul,
      updatedCyon: playerCyon,
      message: `Need ${investCostLul} LUL to inject investment capital into the NPC Merchant treasury.`,
    };
  }

  const dividendCyon = 45;
  const updatedState: MerchantAgentMarketState = {
    ...state,
    treasuryCyon: state.treasuryCyon + 450,
    treasuryLulPool: Math.max(1000, state.treasuryLulPool - 600),
    recentLulExchangedVolume: Math.max(0, state.recentLulExchangedVolume - 400),
    isShopBroke: false,
    investorDiscountActive: true,
    investorCount: state.investorCount + 1,
    lastMarketHeadline: 'Shop reopened! Investor injected liquidity & unlocked a -15% discount.',
  };

  return {
    ok: true,
    updatedState,
    updatedLul: playerLul - investCostLul,
    updatedCyon: playerCyon + dividendCyon,
    message: `Thank you Investor! The shop is back open, and you received +${dividendCyon} CYON dividend & a -15% price discount!`,
  };
}

/**
 * Fast-Forward 1 Day Tick (7 ticks = 1 Week of simulated trading).
 * Allows Hackathon judges to watch prices, stock, and merchant solvency evolve live.
 */
export function stepFastForwardEconomyTick(
  state: MerchantAgentMarketState,
  seedStep: number,
): MerchantAgentMarketState {
  const nextDay = state.dayCounter + 1;
  const nextStock = { ...state.stockByItemId };
  const nextDemand = { ...state.demandByItemId };

  // Deterministic pseudo-random wave per day so judges see clear supply/demand swings
  const wave = Math.sin(nextDay * 1.35 + seedStep * 0.7);

  for (let i = 0; i < MERCHANT_CATALOG_ITEMS.length; i++) {
    const item = MERCHANT_CATALOG_ITEMS[i];
    const itemWave = Math.cos(nextDay * 1.1 + i * 1.7);
    const curStock = nextStock[item.id] ?? item.initialStock;
    const curDemand = nextDemand[item.id] ?? 0;

    if (itemWave > 0.25) {
      // NPC traders buy up this item -> stock drops, demand rises
      nextStock[item.id] = Math.max(0, curStock - (item.isNft ? 1 : 2));
      nextDemand[item.id] = Math.min(5, curDemand + 1);
    } else if (itemWave < -0.25) {
      // Players flood the market with this item -> stock rises, price drops
      nextStock[item.id] = Math.min(item.targetStock * 2, curStock + (item.isNft ? 1 : 3));
      nextDemand[item.id] = Math.max(-4, curDemand - 1);
    }
  }

  let nextTreasuryCyon = state.treasuryCyon;
  let nextLulVolume = state.recentLulExchangedVolume;
  let headline = '';

  if (nextDay % 4 === 0) {
    // Simulate a market flood that drains merchant CYON reserves (triggers bankruptcy test case!)
    nextTreasuryCyon = 12;
    nextLulVolume += 900;
    headline = `Day ${nextDay}: Players flooded the market with LUL! NPC CYON reserves drained (${nextTreasuryCyon} CYON) — Shop nearly bankrupt!`;
  } else if (wave > 0) {
    nextTreasuryCyon = Math.max(35, nextTreasuryCyon - 65);
    nextLulVolume += 280;
    headline = `Day ${nextDay}: Demand for House Themes & Furniture surged! Item prices rose due to low stock.`;
  } else {
    nextTreasuryCyon = Math.min(900, nextTreasuryCyon + 140);
    nextLulVolume = Math.max(0, nextLulVolume - 220);
    headline = `Day ${nextDay}: Abundant supply in NPC warehouse. Furniture prices discounted!`;
  }

  const isShopBroke = nextTreasuryCyon < 20;

  return {
    ...state,
    dayCounter: nextDay,
    treasuryCyon: nextTreasuryCyon,
    recentLulExchangedVolume: nextLulVolume,
    isShopBroke,
    stockByItemId: nextStock,
    demandByItemId: nextDemand,
    lastMarketHeadline: headline,
  };
}

/* ============================================================================
 * CHAT NEGOTIATION ENGINE (F1 pilot: raw fish sold to Kai for LUL)
 * The AI negotiates words; this engine owns every number. Offers open below
 * the standard formula value, rise in shrinking steps, and can never pass a
 * hard ceiling — no dialogue, prompt, or modified client can move a price
 * outside the envelope computed here.
 * ==========================================================================*/

export interface NegotiationEnvelope {
  /** Standard formula value of the goods (the public reference price). */
  baseValue: number;
  /** First offer the NPC makes. */
  openOffer: number;
  /** Absolute maximum the NPC may ever pay in this session. */
  ceiling: number;
  /** Raise steps as fractions of baseValue, applied in order. */
  stepPcts: readonly number[];
}

export function evaluateNegotiationEnvelope(baseValue: number): NegotiationEnvelope {
  const v = Math.max(1, Math.round(baseValue));
  const openOffer = Math.max(1, Math.round(v * 0.8));
  const ceiling = Math.max(openOffer, Math.round(v * 1.15));
  return { baseValue: v, openOffer, ceiling, stepPcts: [0.07, 0.05, 0.03] };
}

export interface NegotiationSession {
  baseValue: number;
  ceiling: number;
  currentOffer: number;
  roundsUsed: number;
  maxRounds: number;
  /** True once the current offer is the NPC's last one. */
  isFinalOffer: boolean;
  agreedPrice: number | null;
  closed: 'agreed' | 'walked_away' | null;
}

export function createNegotiationSession(baseValue: number): NegotiationSession {
  const env = evaluateNegotiationEnvelope(baseValue);
  return {
    baseValue: env.baseValue,
    ceiling: env.ceiling,
    currentOffer: env.openOffer,
    roundsUsed: 0,
    maxRounds: env.stepPcts.length,
    isFinalOffer: false,
    agreedPrice: null,
    closed: null,
  };
}

/** NPC raises its offer by the next shrinking step, clamped to the ceiling. */
export function negotiateRaise(session: NegotiationSession): NegotiationSession {
  if (session.closed || session.agreedPrice !== null) return session;
  const env = evaluateNegotiationEnvelope(session.baseValue);
  if (session.roundsUsed >= session.maxRounds || session.currentOffer >= session.ceiling) {
    return { ...session, isFinalOffer: true };
  }
  const step = Math.max(
    1,
    Math.round(session.baseValue * env.stepPcts[session.roundsUsed]),
  );
  const nextOffer = Math.min(session.ceiling, session.currentOffer + step);
  const roundsUsed = session.roundsUsed + 1;
  return {
    ...session,
    currentOffer: nextOffer,
    roundsUsed,
    isFinalOffer: roundsUsed >= session.maxRounds || nextOffer >= session.ceiling,
  };
}

/**
 * Applies a price named by the player. At or below the ceiling the NPC
 * accepts the player's own price (a deal is a deal); above the ceiling the
 * NPC simply moves one raise step toward it.
 */
export function negotiatePlayerCounter(
  session: NegotiationSession,
  playerAsk: number,
): { session: NegotiationSession; outcome: 'agreed' | 'raised' | 'final' } {
  if (session.closed || session.agreedPrice !== null) {
    return { session, outcome: 'final' };
  }
  const ask = Math.round(playerAsk);
  if (Number.isFinite(ask) && ask >= 1 && ask <= session.ceiling) {
    return {
      session: { ...session, agreedPrice: ask, closed: 'agreed' },
      outcome: 'agreed',
    };
  }
  const raised = negotiateRaise(session);
  return { session: raised, outcome: raised.isFinalOffer ? 'final' : 'raised' };
}

/** Player accepts the NPC's current offer. */
export function negotiateAccept(session: NegotiationSession): NegotiationSession {
  if (session.closed || session.agreedPrice !== null) return session;
  return { ...session, agreedPrice: session.currentOffer, closed: 'agreed' };
}

/** Session ends without a deal; the last offer stays readable on the card. */
export function negotiateWalkAway(session: NegotiationSession): NegotiationSession {
  if (session.closed) return session;
  return { ...session, closed: 'walked_away' };
}

/** Clamps any externally proposed price (e.g. an LLM move) into the envelope. */
export function clampNegotiationOffer(session: NegotiationSession, price: number): number {
  const p = Math.round(price);
  if (!Number.isFinite(p)) return session.currentOffer;
  return Math.max(session.currentOffer, Math.min(session.ceiling, p));
}

export interface NpcConciergeLiveContext {
  playerNearAccount?: string;
  nearBalance?: number;
  hasHouseOwnership?: boolean;
  hanaWelcomeNearClaimed?: boolean;
  caughtFishCount?: number;
  recruitedFamilyCount?: number;
  fishMarketListings?: ReadonlyArray<{
    speciesName: string;
    rarity: string;
    weightKg: number;
    priceRespite: number;
    sellerNearAccount: string;
  }>;
  fishSalesStats?: {
    topSale: {
      speciesName: string;
      weightKg: number | null;
      priceRespite: number;
      buyerAccount: string;
      sellerAccount: string | null;
    } | null;
    recentSale: {
      speciesName: string;
      weightKg: number | null;
      priceRespite: number;
      buyerAccount: string;
      sellerAccount: string | null;
    } | null;
    totalSalesCount: number;
  } | null;
}

/**
 * Conversational Game Concierge for Hana (Central Plaza Cafe) & Kai (Beachfront Harbor).
 * Answers questions in clear, natural English using live player, shop, and Fish NFT market data.
 */
export function generateNpcMerchantReply(
  userMessage: string,
  location: MerchantLocationId,
  state: MerchantAgentMarketState,
  balances: { lul: number; cyon: number; respite: number; walletConnected: boolean },
  liveContext?: NpcConciergeLiveContext,
): string {
  const q = userMessage.trim().toLowerCase();
  const locName = location === 'lobby_cafe' ? 'Central Plaza Cafe' : 'Beachfront Harbor';
  const npcName = location === 'lobby_cafe' ? 'Hana' : 'Kai';
  const quote = evaluateLulToCyonExchangeQuote(state);
  const guestNotice = !balances.walletConnected
    ? ' Sign in first to unlock the Exchange and Catalog.'
    : '';

  if (!q) {
    return `Hi, I am ${npcName} at ${locName}. Ask me about places in the city, fishing, Fish NFT sales, currencies, houses, or the Warzone.`;
  }

  // 1. Shop support / investor bailout when shop reserve is low
  if (
    (state.isShopBroke || state.treasuryCyon < 250) &&
    /\b(invest|bailout|support|reopen|modal|suntik)\b/.test(q)
  ) {
    return `Our shop reserve at ${locName} is currently ${state.treasuryCyon} CYON. Investing 300 LUL restores 450 CYON to the shop, pays you a 45 CYON bonus, and unlocks a 15% catalog discount.${guestNotice}`;
  }

  // 2. Most Expensive / Record / Sold / Rarest Fish NFT (Live Market Data)
  const mentionsFishOrNft =
    /\b(fish|nft|ikan|catch|tangkapan|arowana|coelacanth|marlin|koi|tuna)\b/.test(q);
  const asksTopOrSold =
    /\b(most expensive|expensive|highest|top|record|sold|sale|sales|rarest|mythic|best|termahal|paling mahal|terjual|laku|rekor|langka)\b/.test(
      q,
    );
  if (
    (mentionsFishOrNft && asksTopOrSold) ||
    q.includes('most expensive') ||
    q.includes('paling mahal') ||
    q.includes('termahal') ||
    q.includes('terjual')
  ) {
    const stats = liveContext?.fishSalesStats;
    const listings = liveContext?.fishMarketListings ?? [];
    const highestListing =
      listings.length > 0
        ? [...listings].sort((a, b) => b.priceRespite - a.priceRespite)[0]
        : null;

    if (stats?.topSale && stats.totalSalesCount > 0) {
      const top = stats.topSale;
      const weightText = top.weightKg ? ` (${top.weightKg.toFixed(2)} kg)` : '';
      const sellerText = top.sellerAccount ? ` from ${top.sellerAccount}` : '';
      const activeTail = highestListing
        ? ` Right now, the highest active listing on Kai's Fish Market is ${highestListing.speciesName} (${highestListing.weightKg.toFixed(2)} kg) at ${highestListing.priceRespite} RESPITE.`
        : '';
      return `The most expensive Fish NFT sold so far is ${top.speciesName}${weightText}, bought by ${top.buyerAccount}${sellerText} for ${top.priceRespite} RESPITE (${stats.totalSalesCount} total sales completed).${activeTail}`;
    }

    if (highestListing) {
      return `No Fish NFT has been sold yet, so the record is still open. The highest active listing on Kai's Fish Market right now is ${highestListing.speciesName} (${highestListing.weightKg.toFixed(2)} kg, ${highestListing.rarity}) listed by ${highestListing.sellerNearAccount} for ${highestListing.priceRespite} RESPITE.`;
    }

    return `No Fish NFTs have been sold or listed on Kai's market yet—you can set the first record. Aim for the Mythic Astral Dragon Arowana at NW Fishing Lake or the Mythic Nebula Coelacanth at Beachfront Harbor, both most active at night.`;
  }

  // 3. Cheapest / Active Fish Market Listings
  if (
    q.includes('fish market') ||
    q.includes('pasar ikan') ||
    (mentionsFishOrNft &&
      /\b(cheapest|lowest|floor|for sale|listed|listing|listings|buy|termurah|paling murah|dijual|beli)\b/.test(
        q,
      ))
  ) {
    const listings = liveContext?.fishMarketListings ?? [];
    if (listings.length > 0) {
      const sorted = [...listings].sort((a, b) => a.priceRespite - b.priceRespite);
      const cheapest = sorted[0];
      const priciest = sorted[sorted.length - 1];
      return `There ${listings.length === 1 ? 'is 1 Fish NFT' : `are ${listings.length} Fish NFTs`} listed on Kai's Fish Market right now. Prices start at ${cheapest.priceRespite} RESPITE for ${cheapest.speciesName} (${cheapest.weightKg.toFixed(2)} kg) up to ${priciest.priceRespite} RESPITE.`;
    }
    return `There are currently 0 Fish NFTs listed on Kai's Fish Market at Beachfront Harbor. Catch a fish, mint it as an NFT in your Bag or at Kai's counter, and list it for RESPITE.`;
  }

  // 4. Welcome Bonus / Claim 0.30 NEAR
  if (
    /\b(claim|free near|welcome bonus|starter|bonus|faucet|0\.30|0\.3|klaim|gratis|hadiah)\b/.test(q)
  ) {
    if (!balances.walletConnected) {
      return `New players get a one-time 0.30 NEAR welcome bonus from Hana at Central Plaza Cafe. Sign in with Google first to create your wallet, then click Claim 0.30 NEAR in Hana's chat.`;
    }
    if (liveContext?.hanaWelcomeNearClaimed) {
      return `You have already claimed your 0.30 NEAR welcome bonus. You can swap NEAR into RESPITE anytime in the Exchange tab (1 NEAR = 100 RESPITE).`;
    }
    return `Your 0.30 NEAR welcome bonus is ready to claim. Visit Hana at Central Plaza Cafe and click Claim 0.30 NEAR inside the Chat Session tab.`;
  }

  // 5. Specific Place & Direction Queries ("Where is...", "Dimana...", "How do I get to...")
  const isAskingLocation =
    /\b(where|how to get|how do i get|find|direction|directions|go to|dimana|di mana|lokasi|arah|kemana|ke mana|tempat)\b/.test(
      q,
    );

  if (isAskingLocation && /\b(kai|beach|harbor|ocean|sea|coast|pantai|laut|pelabuhan)\b/.test(q)) {
    return `Merchant Kai and the ocean fishing dock are at Beachfront Harbor in the southeast. Open any black Transit Kiosk (press B), choose Travel and Districts, and take the tram to Beachfront Harbor.`;
  }

  if (isAskingLocation && /\b(lake|oasis|freshwater|pond|danau|kolam)\b/.test(q)) {
    return `The freshwater fishing spot is NW Fishing Lake in the northwest corner of the city. Open any black Transit Kiosk (press B) and travel to NW Fishing Lake, or walk northwest from Central Plaza.`;
  }

  if (isAskingLocation && /\b(hana|cafe|plaza|center|kafe|tengah)\b/.test(q)) {
    return `Merchant Hana is at Central Plaza Cafe right in the heart of the city. Use any black Transit Kiosk and pick Central Plaza to return directly to the cafe.`;
  }

  if (isAskingLocation && /\b(warzone|arena|combat|battle|fight|perang|tempur)\b/.test(q)) {
    return `To enter the Warzone Arena, open any black Transit Kiosk (press B), select Warzone Arena, and pick Blue Team or Red Team to ride the tram into battle.`;
  }

  if (isAskingLocation && /\b(house|home|plot|residential|sample|model|rumah|kavling)\b/.test(q)) {
    return `Residential house plots line the North and South avenues of the city, and you can tour an open Model House on the southwest plot. Once you own a house, you can also enter straight from any Transit Kiosk via My House.`;
  }

  if (isAskingLocation && /\b(fish|fishing|mancing|memancing|ikan)\b/.test(q)) {
    return `There are two fishing spots: Beachfront Harbor in the southeast for saltwater fish (also where Kai's shop is) and NW Fishing Lake in the northwest for freshwater fish. Use any black Transit Kiosk (press B) to travel to either spot.`;
  }

  if (/\b(kiosk|teleport|portal|tram|train|station|halte|kereta)\b/.test(q)) {
    return `Black Transit Kiosks stand beside every tram shelter across the city. Walk up to a kiosk and press B (or click it) to ride the tram between districts, deploy to the Warzone Arena, enter My House, or open the Shop.`;
  }

  // 6. Controls & Keybindings
  if (
    /\b(control|controls|key|keys|keyboard|shortcut|button|how to move|walk|camera|kontrol|tombol|cara jalan|gerak)\b/.test(
      q,
    )
  ) {
    return `Move with WASD or click on the ground, and drag to rotate the camera. Press B for the Transit Kiosk, F to cast your fishing rod by water or build on a Warzone pad, E to grab supply crates, and G to enter vehicles.`;
  }

  // 7. Player's Own Wallet, Balance, Login, or Guest Status
  if (
    /\b(my balance|my wallet|my account|register|sign up|signup|login|sign in|google|wallet|account|guest|daftar|akun|saldo)\b/.test(
      q,
    )
  ) {
    if (!balances.walletConnected) {
      return `You are currently exploring in Guest Mode. Click Sign In to register with Google or connect an external wallet—you will get your own wallet address, 0.30 NEAR from Hana, and full access to the Exchange and Catalog.`;
    }
    const addr = liveContext?.playerNearAccount ? ` (${liveContext.playerNearAccount})` : '';
    const nearPart =
      typeof liveContext?.nearBalance === 'number'
        ? `${liveContext.nearBalance.toFixed(2)} NEAR, `
        : '';
    return `Your wallet${addr} is active with ${nearPart}${balances.lul} LUL, ${balances.cyon} CYON, and ${balances.respite} RESPITE. Open the Wallet button at the top right anytime to copy your address, send RESPITE, or check your items.`;
  }

  // 8. Currencies & Exchange (LUL, CYON, RESPITE, NEAR)
  if (
    /\b(lul|cyon|respite|near|coin|coins|money|currency|currencies|exchange|swap|rate|tukar|kurs|uang|koin)\b/.test(
      q,
    )
  ) {
    return `Earn LUL in the Warzone or by selling regular fish to Kai, then exchange ${quote.lulCostFor10Cyon} LUL for ${quote.cyonGranted} CYON in the Exchange tab to buy standard gear and furniture. Swap NEAR into RESPITE (1 NEAR = 100 RESPITE) or sell Fish NFTs on Kai's market to use RESPITE for a Private House, Family Member companions, and collector items. Balance: ${balances.lul} LUL, ${balances.cyon} CYON, ${balances.respite} RESPITE.${guestNotice}`;
  }

  // 9. Family Member Companions
  if (
    /\b(family|companion|helper|harvester|recruit|hire|agent|pendamping|asisten)\b/.test(q)
  ) {
    const activeCount = liveContext?.recruitedFamilyCount ?? 0;
    const countNote =
      activeCount > 0 ? ` You currently have ${activeCount} active Family Member companion(s).` : '';
    return `You can hire a Family Member companion in Hana's Catalog for 15 RESPITE (1 Week), 45 RESPITE (1 Month), or 180 RESPITE (1 Year). Once hired, assign them to collect Warzone crates, fish along the shore, or guard your base.${countNote}${guestNotice}`;
  }

  // 10. Private House, Plots & 3D Furniture Studio
  if (
    /\b(house|home|furniture|decor|decorate|interior|studio|plot|theme|gate|friend|rumah|dekor|perabot|katalog|catalog)\b/.test(
      q,
    )
  ) {
    const houseNote = liveContext?.hasHouseOwnership
      ? ' You already own a Private House—claim any open city plot or enter via the Transit Kiosk.'
      : '';
    return `Buy a Private House in Hana's Catalog for 25 RESPITE to claim a residential plot in the city and unlock your 3D interior studio. Place CYON or collector RESPITE furniture, customize lighting and wall finishes, and set your gate to Public, Friends Only, or Private.${houseNote}${guestNotice}`;
  }

  // 11. Fishing, Rods, Species & Minting
  if (
    /\b(fish|fishing|rod|reel|lure|bait|lake|beach|kai|water|mint|nft|mancing|memancing|ikan|joran|pantai)\b/.test(
      q,
    )
  ) {
    const bagCount =
      typeof liveContext?.caughtFishCount === 'number'
        ? ` You currently have ${liveContext.caughtFishCount}/20 fish in your Bag.`
        : '';
    return `Open your Bag (top right) to equip your Fishing Rod, walk to Beachfront Harbor or NW Fishing Lake, and press F to cast. Wait for the bite alert (!), keep the tension bar inside the green zone, then sell fish to Kai for LUL or mint rare catches as NFTs to sell on Kai's market for RESPITE.${bagCount}${guestNotice}`;
  }

  // 12. Warzone Combat, Crates & Vehicles
  if (
    /\b(warzone|fight|battle|combat|crate|box|weapon|rifle|bazooka|tank|vehicle|truck|plane|blue|red|hq|perang|senjata|kotak|tank)\b/.test(
      q,
    )
  ) {
    return `Enter the Warzone from any Transit Kiosk and pick Blue Team or Red Team (5 lives per match). Grab supply boxes with E, stack them on your base pad, and press F or open the Base Kiosk to build rifles, bazookas, tanks, planes, and HQ upgrades while earning LUL.`;
  }

  // 13. Live Shop Stock, Market Day & Dynamic Pricing
  if (
    /\b(price|prices|market|stock|supply|demand|day|reserve|discount|cost|harga|pasar|stok|diskon)\b/.test(
      q,
    )
  ) {
    const discountNote = state.investorDiscountActive
      ? ' A 15% supporter discount is currently active on catalog items.'
      : '';
    return `We are on Market Day ${state.dayCounter} with ${state.treasuryCyon} CYON in shop reserve, and the current rate is ${quote.lulCostFor10Cyon} LUL for ${quote.cyonGranted} CYON. Catalog prices adjust dynamically with item stock and player demand.${discountNote}${guestNotice}`;
  }

  // 14. Where am I / Who are you / City Overview
  if (
    /\b(where am i|where is this|what is this|what place|who are you|location|lobby|city|map|apa ini|siapa kamu)\b/.test(
      q,
    )
  ) {
    return `You are at ${locName} in Buddies Blitz, and I am ${npcName}. From here you can explore the peaceful city, fish at Beachfront Harbor or NW Fishing Lake, decorate a Private House, or ride the tram into the Warzone Arena.${guestNotice}`;
  }

  // 15. General How to Play / Beginner Guide
  if (
    /\b(how to play|guide|help|hint|tips|tutorial|what to do|start|objective|petunjuk|cara main|mulai|bantuan)\b/.test(
      q,
    )
  ) {
    return `Start by claiming your 0.30 NEAR welcome bonus from Hana at Central Plaza Cafe, then use any black Transit Kiosk (press B) to explore. Earn LUL by fishing or fighting in the Warzone, exchange LUL for CYON to buy gear, and use RESPITE (from NEAR swaps or selling Fish NFTs at Kai's harbor) to own a Private House.${guestNotice}`;
  }

  // 16. Greetings
  if (
    /^(hi|hello|hey|halo|hallo|yo|sup|pagi|siang|sore|malam|greetings|good morning|good afternoon|good evening|selamat)\b/.test(
      q,
    )
  ) {
    if (!balances.walletConnected) {
      return `Hi Buddy, welcome to ${locName}. You are in Guest Mode right now—feel free to explore and ask me anything about places, fishing, Fish NFT records, currencies, houses, or the Warzone.`;
    }
    return `Hi Buddy, welcome to ${locName}. I am ${npcName}—ask me where anything is, which Fish NFT sold for the highest price, how currencies work, or what to do next.`;
  }

  // 17. Friendly Concierge Fallback
  return `I can help with anything in Buddies Blitz. Try asking where Kai or the fishing lake is, what the most expensive Fish NFT sold for, how LUL, CYON, and RESPITE work, or how to get a Private House.`;
}

/**
 * ============================================================================
 * 3D CUTAWAY PRIVATE HOUSE INTERIOR STUDIO ENGINE
 * ============================================================================
 */

export const CUTAWAY_ROOM_BOUNDS = {
  minX: -5.3, // A = -5.3
  maxX: 5.3, // J = 5.3 (10.6m width)
  minZ: -3.7, // T = -3.7
  maxZ: 3.7, // N = 3.7 (7.4m depth)
  wallThickness: 0.22, // L = 0.22
  fullWallHeight: 4.0, // ee = 4.0 (Tall 4.0m manor/pavilion ceiling height)
  cutawayWallHeight: 0.45, // Yn = 0.45 (Front & Right cutaway walls)
  partitionWallHeight: 1.3, // _a = 1.3 (Interior divider wall)
  partitionX: 1.45, // fe = 1.45
  partitionZ: 0.95, // lt = 0.95
  partitionThickness: 0.14, // U = 0.14
  slatEndZ: 0.95, // ko = 0.95
  windowLeft: { z0: 1.3, z1: 2.8, y0: 0.55, y1: 2.4 }, // y
  windowBack: { x0: -2.35, x1: 0.75, y0: 0.1, y1: 2.5 }, // k
  doorPassZ: { z0: -0.25, z1: 0.85 }, // Da
  doorPassX: { x0: 2.25, x1: 3.25 }, // Ia
} as const;

export interface OrientedFootprint2D {
  x: number;
  z: number;
  hw: number;
  hd: number;
  a: number;
}

export interface PlacedHouseFurnitureItem {
  instanceId: string;
  catalogId: string;
  x: number;
  z: number;
  ry: number;
  sx: number;
  sz: number;
  sry: number;
  sy: number;
  vy: number;
  lift: number;
  tx: number;
  tz: number;
  wx: number;
  wz: number;
  pvx: number;
  pvz: number;
  appear: number;
}

export function getCatalogFurnitureItem(catalogId: string): MerchantCatalogItem | undefined {
  return MERCHANT_CATALOG_ITEMS.find((it) => it.id === catalogId);
}

/**
 * Spring-damper natural frequency & coupling parameters (`Gc(item)`, `#L471`).
 */
export function computeFurnitureSpringParams(catalogId: string): {
  hp: number;
  om: number;
  k: number;
} {
  const item = getCatalogFurnitureItem(catalogId);
  const h = (item?.height ?? 1.0) + 0.15;
  return {
    hp: h,
    om: 7.5 / Math.sqrt(Math.max(h, 0.4)),
    k: 1.0 / Math.sqrt(Math.max(h, 0.6)),
  };
}

/**
 * Builds rotated 2D OBB footprints for a furniture item at `(x, z, ry)` (`cn`, `#L480`).
 */
export function buildFurnitureFootprintObbs(
  catalogId: string,
  x: number,
  z: number,
  ry: number,
): OrientedFootprint2D[] {
  const item = getCatalogFurnitureItem(catalogId);
  const fps = item?.footprints ?? [[0, 0, 1.0, 1.0]];
  const cosA = Math.cos(ry);
  const sinA = Math.sin(ry);
  return fps.map(([ox, oz, w, d]) => ({
    x: x + ox * cosA + oz * sinA,
    z: z - ox * sinA + oz * cosA,
    hw: w / 2,
    hd: d / 2,
    a: ry,
  }));
}

/**
 * 2D Separating Axis Theorem (SAT) OBB overlap test (`Qs(a, b)`, `#L481`).
 */
export function checkObbCollision2D(e: OrientedFootprint2D, t: OrientedFootprint2D): boolean {
  const o = Math.cos(e.a);
  const a = Math.sin(e.a);
  const n = Math.cos(t.a);
  const r = Math.sin(t.a);
  const s = t.x - e.x;
  const l = t.z - e.z;
  const axes: readonly [number, number][] = [
    [o, -a],
    [a, o],
    [n, -r],
    [r, n],
  ];
  for (const [c, u] of axes) {
    const d = e.hw * Math.abs(c * o - u * a) + e.hd * Math.abs(c * a + u * o);
    const p = t.hw * Math.abs(c * n - u * r) + t.hd * Math.abs(c * r + u * n);
    if (Math.abs(s * c + l * u) >= d + p - 0.004) {
      return false;
    }
  }
  return true;
}

function getObbAxisExtents(obb: OrientedFootprint2D): { ex: number; ez: number } {
  const cosA = Math.abs(Math.cos(obb.a));
  const sinA = Math.abs(Math.sin(obb.a));
  return {
    ex: obb.hw * cosA + obb.hd * sinA,
    ez: obb.hw * sinA + obb.hd * cosA,
  };
}

function isObbInsideCutawayRoom(obb: OrientedFootprint2D): boolean {
  const { ex, ez } = getObbAxisExtents(obb);
  const leftPad = obb.z - ez < CUTAWAY_ROOM_BOUNDS.slatEndZ ? 0.05 : 0.004;
  const minXAllowed = CUTAWAY_ROOM_BOUNDS.minX + leftPad;
  const maxXAllowed = CUTAWAY_ROOM_BOUNDS.maxX - 0.02;
  const minZAllowed = CUTAWAY_ROOM_BOUNDS.minZ + 0.004;
  const maxZAllowed = CUTAWAY_ROOM_BOUNDS.maxZ - 0.02;
  return (
    obb.x - ex >= minXAllowed - 1e-4 &&
    obb.x + ex <= maxXAllowed + 1e-4 &&
    obb.z - ez >= minZAllowed - 1e-4 &&
    obb.z + ez <= maxZAllowed + 1e-4
  );
}

const PARTITION_WALL_OBBS: readonly OrientedFootprint2D[] = [];

const MAGNET_WALL_PLANES = [
  {
    ax: 'x' as const,
    p: CUTAWAY_ROOM_BOUNDS.minX,
    s: 1,
    a0: CUTAWAY_ROOM_BOUNDS.minZ,
    a1: CUTAWAY_ROOM_BOUNDS.maxZ,
    pad: (zMin: number) => (zMin < CUTAWAY_ROOM_BOUNDS.slatEndZ ? 0.05 : 0.004),
  },
  {
    ax: 'z' as const,
    p: CUTAWAY_ROOM_BOUNDS.minZ,
    s: 1,
    a0: CUTAWAY_ROOM_BOUNDS.minX,
    a1: CUTAWAY_ROOM_BOUNDS.maxX,
    pad: () => 0.004,
  },
];

/**
 * 10cm (`0.1m`) grid rounding + 25cm (`0.25m`) magnetic wall snap (`ti`, `#L495`).
 */
export function snapFurnitureToGridAndWalls(
  catalogId: string,
  rawX: number,
  rawZ: number,
  ry: number,
): [number, number] {
  const snappedX = Math.round(rawX * 10) / 10;
  const snappedZ = Math.round(rawZ * 10) / 10;
  let dx = 0;
  let dz = 0;
  let bestXDist = 0.25;
  let bestZDist = 0.25;

  for (const obb of buildFurnitureFootprintObbs(catalogId, snappedX, snappedZ, ry)) {
    const { ex, ez } = getObbAxisExtents(obb);
    const minX = obb.x - ex;
    const maxX = obb.x + ex;
    const minZ = obb.z - ez;
    const maxZ = obb.z + ez;

    for (const wall of MAGNET_WALL_PLANES) {
      const spanMin = wall.ax === 'x' ? minZ : minX;
      const spanMax = wall.ax === 'x' ? maxZ : maxX;
      if (spanMax < wall.a0 || spanMin > wall.a1) continue;
      const planePos = wall.p + (wall.pad ? wall.pad(minZ) : 0);
      const dist =
        wall.s > 0
          ? (wall.ax === 'x' ? minX : minZ) - planePos
          : planePos - (wall.ax === 'x' ? maxX : maxZ);
      if (dist >= 0 && dist < 0.25) {
        if (wall.ax === 'x' && dist < bestXDist) {
          bestXDist = dist;
          dx = -wall.s * dist;
        }
        if (wall.ax === 'z' && dist < bestZDist) {
          bestZDist = dist;
          dz = -wall.s * dist;
        }
      }
    }
  }

  return [Number((snappedX + dx).toFixed(3)), Number((snappedZ + dz).toFixed(3))];
}

/**
 * Checks whether placing `catalogId` at `(x, z, ry)` is inside room bounds,
 * clear of partition walls, and non-overlapping with other placed items (`ei`, `#L487`).
 */
export function isFurniturePlacementValid(
  selfInstanceId: string | null,
  catalogId: string,
  x: number,
  z: number,
  ry: number,
  placedItems: readonly PlacedHouseFurnitureItem[],
): boolean {
  const candidateObbs = buildFurnitureFootprintObbs(catalogId, x, z, ry);
  if (!candidateObbs.every(isObbInsideCutawayRoom)) {
    return false;
  }
  for (const c of candidateObbs) {
    for (const wallObb of PARTITION_WALL_OBBS) {
      if (checkObbCollision2D(c, wallObb)) {
        return false;
      }
    }
  }
  for (const other of placedItems) {
    if (other.instanceId === selfInstanceId) continue;
    const otherObbs = buildFurnitureFootprintObbs(other.catalogId, other.x, other.z, other.ry);
    for (const c of candidateObbs) {
      for (const u of otherObbs) {
        if (checkObbCollision2D(c, u)) {
          return false;
        }
      }
    }
  }
  return true;
}

/**
 * Spiral Free-Spot Search (`Sr`, `#L496`):
 * Snaps to 10cm grid + 25cm wall magnet, checks validity, and if blocked,
 * searches outward in concentric rings (`r = 0.1 .. 1.2m`) for the nearest free coordinate.
 */
export function solveFurnitureFreePlacement(
  selfInstanceId: string | null,
  catalogId: string,
  rawX: number,
  rawZ: number,
  ry: number,
  placedItems: readonly PlacedHouseFurnitureItem[],
): {
  x: number;
  z: number;
  ry: number;
  valid: boolean;
  footprints: OrientedFootprint2D[];
} {
  const [snapX, snapZ] = snapFurnitureToGridAndWalls(catalogId, rawX, rawZ, ry);
  if (isFurniturePlacementValid(selfInstanceId, catalogId, snapX, snapZ, ry, placedItems)) {
    return {
      x: snapX,
      z: snapZ,
      ry,
      valid: true,
      footprints: buildFurnitureFootprintObbs(catalogId, snapX, snapZ, ry),
    };
  }

  for (let r = 0.1; r <= 1.21; r += 0.1) {
    const samples = Math.max(8, Math.round(r * 40));
    for (let s = 0; s < samples; s++) {
      const ang = (s / samples) * Math.PI * 2;
      const cx = snapX + Math.cos(ang) * r;
      const cz = snapZ + Math.sin(ang) * r;
      const [dx, dz] = snapFurnitureToGridAndWalls(catalogId, cx, cz, ry);
      if (isFurniturePlacementValid(selfInstanceId, catalogId, dx, dz, ry, placedItems)) {
        return {
          x: dx,
          z: dz,
          ry,
          valid: true,
          footprints: buildFurnitureFootprintObbs(catalogId, dx, dz, ry),
        };
      }
    }
  }

  return {
    x: snapX,
    z: snapZ,
    ry,
    valid: false,
    footprints: buildFurnitureFootprintObbs(catalogId, snapX, snapZ, ry),
  };
}

/**
 * Creates a new `PlacedHouseFurnitureItem` at `(x, z, ry)` with optional pop-in bounce (`sn`, `#L472`).
 */
export function createPlacedHouseFurnitureItem(
  instanceId: string,
  catalogId: string,
  x: number,
  z: number,
  ry = 0,
  instant = false,
): PlacedHouseFurnitureItem {
  return {
    instanceId,
    catalogId,
    x,
    z,
    ry,
    sx: x,
    sz: z,
    sry: ry,
    sy: instant ? 0 : 0.65,
    vy: 0,
    lift: 0,
    tx: 0,
    tz: 0,
    wx: 0,
    wz: 0,
    pvx: 0,
    pvz: 0,
    appear: instant ? 1 : 0,
  };
}

/**
 * Creates the initial cutaway room furniture layout.
 * Newly purchased Modern Japanese Wooden Pavilion houses start 100% empty
 * so citizens furnish them with their own CYON (regular) or RESPITE (NFT) items.
 */
export function createInitialPlacedHouseFurniture(): PlacedHouseFurnitureItem[] {
  return [];
}

/**
 * 120 Hz Substepped Spring-Damper Bounce & Acceleration-Driven Tilt Wobble (`Hc`, `#L501`).
 * Mutates `item` in-place and returns the computed 3D render transform (`posX`, `posY`, `posZ`, `rotY`, `tiltAxisX`, `tiltAxisZ`, `tiltAngle`, `scale`).
 */
export function stepFurnitureSpringWobblePhysics(
  item: PlacedHouseFurnitureItem,
  dt: number,
): {
  posX: number;
  posY: number;
  posZ: number;
  rotY: number;
  tiltX: number;
  tiltZ: number;
  scale: number;
} {
  const safeDt = Math.max(0.0005, Math.min(0.05, dt));
  const posAlpha = 1 - Math.exp(-safeDt * 16);
  const rotAlpha = 1 - Math.exp(-safeDt * 14);

  item.appear = Math.min(1, item.appear + safeDt * 2.6);

  const prevSx = item.sx;
  const prevSz = item.sz;

  item.sx += (item.x - item.sx) * posAlpha;
  item.sz += (item.z - item.sz) * posAlpha;

  let dAng = item.ry - item.sry;
  dAng = Math.atan2(Math.sin(dAng), Math.cos(dAng));
  item.sry += dAng * rotAlpha;

  // 120 Hz substepped vertical lift spring & floor bounce (`sy`, `vy`, `lift`)
  for (let rem = safeDt; rem > 1e-6; rem -= 1 / 120) {
    const subDt = Math.min(rem, 1 / 120);
    item.vy += ((item.lift - item.sy) * 220 - item.vy * 16) * subDt;
    item.sy += item.vy * subDt;
    if (!item.lift && item.sy < 0) {
      item.sy = 0;
      item.vy = Math.abs(item.vy) * 0.3;
      if (item.vy < 0.08) {
        item.vy = 0;
      }
    }
  }

  // 120 Hz substepped acceleration-driven 2-axis harmonic tilt wobble (`tx`, `tz`, `wx`, `wz`)
  const sw = computeFurnitureSpringParams(item.catalogId);
  const airFactor = Math.max(0, Math.min(1, item.sy / 0.1));
  const velAlpha = 1 - Math.exp(-safeDt / 0.05);
  const oldPvx = item.pvx;
  const oldPvz = item.pvz;
  item.pvx += ((item.sx - prevSx) / safeDt - item.pvx) * velAlpha;
  item.pvz += ((item.sz - prevSz) / safeDt - item.pvz) * velAlpha;

  let ax = (item.pvx - oldPvx) / safeDt;
  let az = (item.pvz - oldPvz) / safeDt;
  const accMag = Math.hypot(ax, az);
  if (accMag > 30) {
    ax *= 30 / accMag;
    az *= 30 / accMag;
  }

  const targetTx = -(ax / 160 + item.pvx * 0.007) * sw.k * airFactor;
  const targetTz = -(az / 160 + item.pvz * 0.007) * sw.k * airFactor;
  const om = sw.om;
  const damp = 0.95 + (0.3 - 0.95) * airFactor;

  for (let rem = safeDt; rem > 1e-6; rem -= 1 / 120) {
    const subDt = Math.min(rem, 1 / 120);
    item.wx += (-om * om * (item.tx - targetTx) - 2 * damp * om * item.wx) * subDt;
    item.wz += (-om * om * (item.tz - targetTz) - 2 * damp * om * item.wz) * subDt;
    item.tx += item.wx * subDt;
    item.tz += item.wz * subDt;
  }

  const tiltMag = Math.hypot(item.tx, item.tz);
  const satScale = tiltMag > 1e-6 ? (0.13 * Math.tanh(tiltMag / 0.13)) / tiltMag : 0;

  // Back-out ease for appear scale (`vl(appear)`)
  const t = 1 - item.appear;
  const scale = Math.max(0.001, 1 - t * t * (2.7 * t - 1.7));

  return {
    posX: item.sx,
    posY: item.sy + (1 - item.appear) * 0.5,
    posZ: item.sz,
    rotY: item.sry,
    tiltX: item.tx * satScale,
    tiltZ: item.tz * satScale,
    scale,
  };
}

/**
 * Formats a decimal hour (`5.5 .. 23.5`) into `HH:MM` (`fo(e)`, `#L504`).
 */
export function formatDaylightHour(hour: number): string {
  const clamped = ((hour % 24) + 24) % 24;
  const totalMinutes = Math.round(clamped * 60);
  const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export interface RoomDaylightState {
  hour: number;
  formattedTime: string;
  sunAngleRad: number;
  sunDir: { x: number; y: number; z: number };
  moonDir: { x: number; y: number; z: number };
  sunIntensity: number;
   sunColorHex: string;
  hemiIntensity: number;
  hemiSkyHex: string;
  hemiGroundHex: string;
  lampIntensity: number; // `uo` (0 at midday, 1 at night)
  skyTopHex: string;
  skyHorizonHex: string;
  beamIntensityLeft: number;
  beamIntensityBack: number;
  dayFactor: number;
  goldenFactor: number;
  morningFactor: number;
}

const DAYLIGHT_KEYFRAMES = [
  { h: 5.5, sun: 0.0, sc: '#ff8a5a', hemi: 0.18, hs: '#3a4d88', hg: '#1b1a22', lamps: 1.0, skyT: '#0d1733', skyH: '#27365e' },
  { h: 6.4, sun: 0.8, sc: '#ff9860', hemi: 0.26, hs: '#6a7db4', hg: '#2a2426', lamps: 0.7, skyT: '#3a5694', skyH: '#f0a888' },
  { h: 7.8, sun: 2.4, sc: '#ffc690', hemi: 0.34, hs: '#a7bbe2', hg: '#3a3026', lamps: 0.0, skyT: '#6f98d4', skyH: '#f6d6b6' },
  { h: 10.5, sun: 2.8, sc: '#ffe6c6', hemi: 0.42, hs: '#b9cbeb', hg: '#40362c', lamps: 0.0, skyT: '#6f9fe0', skyH: '#dbe8f6' },
  { h: 13.0, sun: 3.0, sc: '#fff3e2', hemi: 0.46, hs: '#c3d4f0', hg: '#443a2f', lamps: 0.0, skyT: '#6a9de2', skyH: '#e2ecf8' },
  { h: 16.2, sun: 2.8, sc: '#ffe2b6', hemi: 0.42, hs: '#b5c4e6', hg: '#40362c', lamps: 0.0, skyT: '#6a94d6', skyH: '#efdcc0' },
  { h: 18.4, sun: 2.6, sc: '#ffb46c', hemi: 0.36, hs: '#97a8d6', hg: '#3d3026', lamps: 0.4, skyT: '#5a78b8', skyH: '#f7b98a' },
  { h: 19.4, sun: 1.0, sc: '#ff8848', hemi: 0.28, hs: '#6f80b6', hg: '#2e2626', lamps: 0.85, skyT: '#34497e', skyH: '#e88a6a' },
  { h: 20.4, sun: 0.0, sc: '#ff7a40', hemi: 0.22, hs: '#4b5e98', hg: '#231f24', lamps: 1.0, skyT: '#1c2a52', skyH: '#4a4f7a' },
  { h: 23.5, sun: 0.0, sc: '#ff7a40', hemi: 0.16, hs: '#34467c', hg: '#1a1820', lamps: 1.0, skyT: '#0b1430', skyH: '#1f2c52' },
] as const;

function smoothstep01(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerpHexColor(hexA: string, hexB: string, t: number): string {
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

/**
 * Evaluates sun/moon arc direction, volumetric window light beam intensity,
 * and interior lamp activation for `hour` in `[5.5, 23.5]` (`Cr`, `zt`, `l0`, `#L502-L526`).
 */
export function evaluateRoomDaylightState(rawHour: number): RoomDaylightState {
  const hour = Math.max(5.5, Math.min(23.5, rawHour));
  let idx = 0;
  while (idx < DAYLIGHT_KEYFRAMES.length - 2 && hour > DAYLIGHT_KEYFRAMES[idx + 1].h) {
    idx++;
  }
  const k0 = DAYLIGHT_KEYFRAMES[idx];
  const k1 = DAYLIGHT_KEYFRAMES[idx + 1];
  const u = smoothstep01(k0.h, k1.h, hour);

  const sun = k0.sun + (k1.sun - k0.sun) * u;
  const hemi = k0.hemi + (k1.hemi - k0.hemi) * u;
  const lamps = k0.lamps + (k1.lamps - k0.lamps) * u;

  // Tilted sun arc `Go = -0.7`, sunrise `Ut = 6`, sunset `Fo = 19.6`
  const Go = -0.7;
  const Ut = 6.0;
  const Fo = 19.6;
  const sunAngleRad = ((hour - Ut) / (Fo - Ut)) * Math.PI;
  const sunDir = {
    x: -Math.cos(sunAngleRad),
    y: Math.sin(sunAngleRad) * Math.cos(Go),
    z: Math.sin(sunAngleRad) * Math.sin(Go),
  };

  const moonAngleRad = (((hour < Ut ? hour + 24 : hour) - Fo) / 10) * Math.PI * 0.9;
  const moonDir = {
    x: -Math.cos(moonAngleRad),
    y: Math.sin(moonAngleRad) * Math.cos(Go),
    z: Math.sin(moonAngleRad) * Math.sin(Go),
  };

  const effectiveSun = sun * (sunDir.y > 0.02 ? 1 : smoothstep01(-0.05, 0.02, sunDir.y));
  // Left window normal outward is (-1, 0, 0) -> dot with sunDir is -sunDir.x
  const dotLeft = -sunDir.x;
  // Back window normal outward is (0, 0, -1) -> dot with sunDir is -sunDir.z
  const dotBack = -sunDir.z;

  const beamIntensityLeft =
    dotLeft > 0.05 && effectiveSun > 0.05
      ? smoothstep01(0.05, 0.3, dotLeft) *
        smoothstep01(0.02, 0.12, sunDir.y) *
        Math.min(1, effectiveSun / 1.6)
      : 0;
  const beamIntensityBack =
    dotBack > 0.05 && effectiveSun > 0.05
      ? smoothstep01(0.05, 0.3, dotBack) *
        smoothstep01(0.02, 0.12, sunDir.y) *
        Math.min(1, effectiveSun / 1.6) *
        0.8
      : 0;

  const daylightWindow = smoothstep01(Ut, Ut + 0.7, hour) * (1 - smoothstep01(Fo - 0.7, Fo, hour));
  const elev = Math.max(0, Math.sin(sunAngleRad));
  const dayFactor = daylightWindow * (0.35 + 0.65 * elev);
  const goldenFactor = daylightWindow * (1 - smoothstep01(0.25, 0.6, elev));
  const morningFactor = daylightWindow * (hour < 11 ? 1 : 0);

  return {
    hour,
    formattedTime: formatDaylightHour(hour),
    sunAngleRad,
    sunDir,
    moonDir,
    sunIntensity: effectiveSun,
    sunColorHex: lerpHexColor(k0.sc, k1.sc, u),
    hemiIntensity: hemi,
    hemiSkyHex: lerpHexColor(k0.hs, k1.hs, u),
    hemiGroundHex: lerpHexColor(k0.hg, k1.hg, u),
    lampIntensity: lamps,
    skyTopHex: lerpHexColor(k0.skyT, k1.skyT, u),
    skyHorizonHex: lerpHexColor(k0.skyH, k1.skyH, u),
    beamIntensityLeft,
    beamIntensityBack,
    dayFactor,
    goldenFactor,
    morningFactor,
  };
}

export type HouseSurfaceSlotId = 'floor' | 'wall' | 'slats';

export interface HouseSurfaceSwatch {
  id: string;
  slot: HouseSurfaceSlotId;
  name: string;
  colorHex: string;
  secondaryHex: string;
  L: number; // Luminance [0..1]
  warm: number; // Warmth [-1..1]
  tx: number; // Texture/tactility [0..1]
}

export const HOUSE_SURFACE_SWATCHES: readonly HouseSurfaceSwatch[] = [
  // Floor Swatches
  { id: 'floor_tatami_oak', slot: 'floor', name: 'Honey Tatami & Oak', colorHex: '#c99a62', secondaryHex: '#93612e', L: 0.62, warm: 0.62, tx: 0.65 },
  { id: 'floor_whiteoak', slot: 'floor', name: 'Nordic White Oak', colorHex: '#dcc7a4', secondaryHex: '#b99a70', L: 0.82, warm: 0.28, tx: 0.45 },
  { id: 'floor_smoked_slate', slot: 'floor', name: 'Smoked Cyber Slate', colorHex: '#2b303a', secondaryHex: '#1c2026', L: 0.18, warm: -0.35, tx: 0.45 },
  { id: 'floor_imperial_gold', slot: 'floor', name: 'Calacatta Gold Marble', colorHex: '#ede6d6', secondaryHex: '#c9a15e', L: 0.88, warm: 0.45, tx: 0.35 },

  // Wall Swatches
  { id: 'wall_limewash', slot: 'wall', name: 'Sand Shoji Limewash', colorHex: '#e3d2b6', secondaryHex: '#c9b393', L: 0.74, warm: 0.55, tx: 0.65 },
  { id: 'wall_chalk', slot: 'wall', name: 'Gallery Chalk White', colorHex: '#f1ede4', secondaryHex: '#dcd6c8', L: 0.9, warm: 0.2, tx: 0.15 },
  { id: 'wall_ink_cyber', slot: 'wall', name: 'Midnight Ink Blue', colorHex: '#1e293b', secondaryHex: '#0f172a', L: 0.14, warm: -0.6, tx: 0.2 },
  { id: 'wall_clay_gold', slot: 'wall', name: 'Terracotta Imperial', colorHex: '#c48d3f', secondaryHex: '#8f5f14', L: 0.52, warm: 0.85, tx: 0.6 },

  // Slat & Woodwork Swatches
  { id: 'slats_walnut', slot: 'slats', name: 'Kyoto Walnut Slats', colorHex: '#7c5238', secondaryHex: '#4c2e1d', L: 0.34, warm: 0.55, tx: 0.65 },
  { id: 'slats_neon_cyan', slot: 'slats', name: 'Shinjuku Neon Trim', colorHex: '#00f5d4', secondaryHex: '#0f766e', L: 0.55, warm: -0.5, tx: 0.3 },
  { id: 'slats_shogun_brass', slot: 'slats', name: 'Gilded Shogun Brass', colorHex: '#eab308', secondaryHex: '#a16207', L: 0.68, warm: 0.8, tx: 0.4 },
];

/**
 * Evaluates Softmax Mood Probabilities (`Cozy %`, `Bright %`, `Moody %`) and natural-language
 * explanation from the active surface materials, theme, and time of day (`Li`, `c0`, `#L628-L633`).
 */
export function evaluateRoomMoodScores(params: {
  themeId: string;
  floorSwatchId?: string;
  wallSwatchId?: string;
  slatsSwatchId?: string;
  hour: number;
}): {
  cozyPct: number;
  brightPct: number;
  moodyPct: number;
  dominantMood: 'cozy' | 'bright' | 'moody';
  explanationText: string;
} {
  const floorSw =
    HOUSE_SURFACE_SWATCHES.find((s) => s.id === params.floorSwatchId) ??
    (params.themeId === 'theme_cyber_neon'
      ? HOUSE_SURFACE_SWATCHES[2]
      : params.themeId === 'theme_royal_gold'
      ? HOUSE_SURFACE_SWATCHES[3]
      : HOUSE_SURFACE_SWATCHES[0]);
  const wallSw =
    HOUSE_SURFACE_SWATCHES.find((s) => s.id === params.wallSwatchId) ??
    (params.themeId === 'theme_cyber_neon'
      ? HOUSE_SURFACE_SWATCHES[6]
      : params.themeId === 'theme_royal_gold'
      ? HOUSE_SURFACE_SWATCHES[7]
      : HOUSE_SURFACE_SWATCHES[4]);
  const slatsSw =
    HOUSE_SURFACE_SWATCHES.find((s) => s.id === params.slatsSwatchId) ??
    (params.themeId === 'theme_cyber_neon'
      ? HOUSE_SURFACE_SWATCHES[9]
      : params.themeId === 'theme_royal_gold'
      ? HOUSE_SURFACE_SWATCHES[10]
      : HOUSE_SURFACE_SWATCHES[8]);

  // Weighted surface luminance, warmth, and texture averages
  const L = wallSw.L * 0.48 + floorSw.L * 0.36 + slatsSw.L * 0.16;
  const W = wallSw.warm * 0.48 + floorSw.warm * 0.36 + slatsSw.warm * 0.16;
  const X = wallSw.tx * 0.48 + floorSw.tx * 0.36 + slatsSw.tx * 0.16;

  const dl = evaluateRoomDaylightState(params.hour);

  const rawScores = {
    bright:
      0.55 * L +
      0.55 * dl.dayFactor -
      0.25 * Math.max(0, W - 0.4) -
      0.15 * dl.goldenFactor,
    cozy:
      0.45 * (W * 0.5 + 0.5) +
      0.3 * X +
      0.35 * Math.max(dl.goldenFactor * 0.8, dl.lampIntensity * (1 - dl.dayFactor) * 0.7) +
      0.1 * (1 - Math.abs(L - 0.6) * 2) -
      0.1,
    moody:
      0.6 * (1 - L) +
      0.35 * (1 - dl.dayFactor) +
      0.15 * Math.max(0, -W),
  };

  // Temperature-scaled Softmax (T = 0.25)
  const expCozy = Math.exp(rawScores.cozy / 0.25);
  const expBright = Math.exp(rawScores.bright / 0.25);
  const expMoody = Math.exp(rawScores.moody / 0.25);
  const sumExp = expCozy + expBright + expMoody;

  let cozyPct = Math.round((expCozy / sumExp) * 100);
  let brightPct = Math.round((expBright / sumExp) * 100);
  let moodyPct = Math.round((expMoody / sumExp) * 100);

  const dominantMood: 'cozy' | 'bright' | 'moody' =
    cozyPct >= brightPct && cozyPct >= moodyPct
      ? 'cozy'
      : brightPct >= cozyPct && brightPct >= moodyPct
      ? 'bright'
      : 'moody';

  const remainder = 100 - (cozyPct + brightPct + moodyPct);
  if (dominantMood === 'cozy') cozyPct += remainder;
  else if (dominantMood === 'bright') brightPct += remainder;
  else moodyPct += remainder;

  const lightPhrase =
    dl.dayFactor > 0.75
      ? 'bright midday sun'
      : dl.goldenFactor > 0.5
      ? 'warm afternoon Golden Hour glow'
      : dl.morningFactor > 0.5
      ? 'fresh morning light'
      : dl.lampIntensity > 0.6
      ? 'warm floor lamp glow'
      : 'soft twilight';

  const explanationText =
    dominantMood === 'bright'
      ? `${wallSw.name} and ${floorSw.name} reflect the ${lightPhrase} across the room — feeling Bright (${brightPct}%).`
      : dominantMood === 'cozy'
      ? `The textures of ${floorSw.name}, ${slatsSw.name}, and ${lightPhrase} create a warm & inviting vibe (Cozy ${cozyPct}%).`
      : `The surface of ${wallSw.name} absorbs light alongside the ${lightPhrase}, evoking a dramatic atmosphere (Moody ${moodyPct}%).`;

  return {
    cozyPct,
    brightPct,
    moodyPct,
    dominantMood,
    explanationText,
  };
}

