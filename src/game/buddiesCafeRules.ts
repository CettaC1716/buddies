/**
 * Pure gameplay rules, XP/Level progression, Barista Work Shift state machine,
 * Food & Drink Order Catalog (paid in LUL or CYON) and Glasshouse Cafe geometry constants.
 */

export interface CafeMenuItemSpec {
  id:
    | 'latte'
    | 'croissant'
    | 'sandwich'
    | 'espresso'
    | 'cinnamon_roll'
    | 'donut'
    | 'muffin'
    | 'iced_latte'
    | 'hot_mocha';
  name: string;
  category: 'drink' | 'pastry';
  priceLul: number;
  priceCyon: number;
  xpReward: number;
  prepHint: string;
  accentHex: string;
}

export const CAFE_MENU_ITEMS: ReadonlyArray<CafeMenuItemSpec> = [
  {
    id: 'latte',
    name: 'Caramel Latte',
    category: 'drink',
    priceLul: 10,
    priceCyon: 10,
    xpReward: 35,
    prepHint: 'Warm milk latte art',
    accentHex: '#f59e0b',
  },
  {
    id: 'croissant',
    name: 'Butter Croissant',
    category: 'pastry',
    priceLul: 3,
    priceCyon: 3,
    xpReward: 12,
    prepHint: 'Crispy butter pastry',
    accentHex: '#fbbf24',
  },
  {
    id: 'sandwich',
    name: 'Club Sandwich',
    category: 'pastry',
    priceLul: 10,
    priceCyon: 10,
    xpReward: 35,
    prepHint: 'Fresh layered garden sandwich',
    accentHex: '#4ade80',
  },
  {
    id: 'espresso',
    name: 'Double Espresso',
    category: 'drink',
    priceLul: 3,
    priceCyon: 3,
    xpReward: 12,
    prepHint: 'Classic strong coffee',
    accentHex: '#92400e',
  },
  {
    id: 'cinnamon_roll',
    name: 'Cinnamon Roll',
    category: 'pastry',
    priceLul: 6,
    priceCyon: 6,
    xpReward: 22,
    prepHint: 'Cinnamon swirl roll',
    accentHex: '#d97706',
  },
  {
    id: 'donut',
    name: 'Glazed Donut',
    category: 'pastry',
    priceLul: 2,
    priceCyon: 2,
    xpReward: 8,
    prepHint: 'Sweet glazed donut',
    accentHex: '#f472b6',
  },
  {
    id: 'muffin',
    name: 'Blueberry Muffin',
    category: 'pastry',
    priceLul: 4,
    priceCyon: 4,
    xpReward: 16,
    prepHint: 'Soft berry muffin',
    accentHex: '#60a5fa',
  },
  {
    id: 'iced_latte',
    name: 'Botanical Iced Latte',
    category: 'drink',
    priceLul: 3,
    priceCyon: 3,
    xpReward: 14,
    prepHint: 'Chilled iced milk coffee',
    accentHex: '#38bdf8',
  },
  {
    id: 'hot_mocha',
    name: 'Hot Choco Mocha',
    category: 'drink',
    priceLul: 6,
    priceCyon: 6,
    xpReward: 24,
    prepHint: 'Warm chocolate mocha',
    accentHex: '#f87171',
  },
];

export const CAFE_EXTERIOR_DOOR_TRIGGER = {
  x: -88.30,
  z: 22.35,
  deckY: 2.5,
  triggerRadius: 2.85,
  exitSpawnX: -88.30,
  exitSpawnZ: 20.55,
  exitSpawnYaw: Math.PI,
} as const;

export const CAFE_ORIGIN_Y = 215.0;

export const CAFE_INTERIOR_BOUNDS = {
  minX: -6.8,
  maxX: 6.8,
  minZ: -5.25,
  maxZ: 9.65,
  wingMinX: 1.65,
  courtyardMinZ: 5.25,
  spawnX: 0.0,
  spawnZ: 2.65,
  spawnYaw: Math.PI / 2,
  exitDoorX: 0.0,
  exitDoorZ: 4.55,
  baristaCounterFrontX: -0.2,
  baristaCounterFrontZ: -1.10,
  baristaCounterStandX: -0.2,
  baristaCounterStandZ: -3.35,
  rotaBoardX: 3.35,
  rotaBoardZ: -3.80,
  atmMachineX: -5.10,
  atmMachineZ: -3.55,
} as const;

/**
 * Clamps an indoor player position strictly inside the 1:1 L-shaped glasshouse footprint
 * (exact 180-degree rotation of the South Plaza exterior L-shape):
 *   Main Hall: x in [-6.8, +6.8], z in [-5.25, +5.25]
 *   Projecting Left/East Wing: x in [+1.65, +6.8], z in [+5.25, +9.65]
 */
export function clampCafeInteriorPosition(
  rawX: number,
  rawZ: number,
  wallMargin = 0.42,
): { x: number; z: number } {
  let x = Math.max(
    CAFE_INTERIOR_BOUNDS.minX + wallMargin,
    Math.min(CAFE_INTERIOR_BOUNDS.maxX - wallMargin, rawX),
  );
  let z = Math.max(
    CAFE_INTERIOR_BOUNDS.minZ + wallMargin,
    Math.min(CAFE_INTERIOR_BOUNDS.maxZ - wallMargin, rawZ),
  );
  const cornerX = CAFE_INTERIOR_BOUNDS.wingMinX + wallMargin;
  const cornerZ = CAFE_INTERIOR_BOUNDS.courtyardMinZ - wallMargin;
  if (x < cornerX && z > cornerZ) {
    const pushEast = cornerX - x;
    const pushNorth = z - cornerZ;
    if (pushEast < pushNorth) {
      x = cornerX;
    } else {
      z = cornerZ;
    }
  }
  return { x, z };
}

export const CAFE_GLOBAL_SCALE_SPEC = {
  // True rendered GLB avatar heights: 3.38m rig * 0.98 bodyGroup = 3.312m on Plaza; * 0.55 indoor scale = 1.822m inside Cafe & Hana's House
  plazaPlayerHeightM: 3.312,
  interiorPlayerHeightM: 1.822,
  exteriorTableScale: 1.74,
  exteriorChairScale: 1.74,
  exteriorBanquetteScale: 1.76,
  exteriorEspressoBarScale: 1.72,
  exteriorAtmScale: 1.74,
  exteriorPlantScale: 1.86,
  exteriorEavesY: 4.55,
  exteriorRidgeY: 6.95,
  exteriorDoorHalfW: 1.52,
  interiorTableScale: 0.96,
  interiorChairScale: 0.96,
  interiorBanquetteScale: 0.98,
  interiorEspressoBarScale: 0.96,
  interiorAtmScale: 1.0,
  interiorPlantScale: 1.04,
  interiorSeatIndicatorBlueRadiusM: 0.085,
  interiorSeatIndicatorGreenRadiusM: 0.098,
} as const;

export interface CafeInteriorSeatSpot {
  id: string;
  x: number;
  z: number;
  yaw: number;
  seatLiftY: number;
  indicatorHeightY: number;
}

export const CAFE_INTERIOR_SEAT_SPOTS: ReadonlyArray<CafeInteriorSeatSpot> = [
  { id: 'cafe_east_bistro_1', x: 4.46, z: -0.85, yaw: Math.PI, seatLiftY: 0.19, indicatorHeightY: 0.73 },
  { id: 'cafe_east_bistro_2', x: 4.46, z: 1.55, yaw: Math.PI, seatLiftY: 0.19, indicatorHeightY: 0.73 },
  { id: 'cafe_west_bistro_1', x: -4.62, z: -0.65, yaw: 0, seatLiftY: 0.19, indicatorHeightY: 0.73 },
  { id: 'cafe_west_bistro_2', x: -4.62, z: 1.85, yaw: 0, seatLiftY: 0.19, indicatorHeightY: 0.73 },
  { id: 'cafe_left_wing_1', x: 4.46, z: 7.45, yaw: Math.PI, seatLiftY: 0.19, indicatorHeightY: 0.73 },
];

export const CAFE_SHIFT_MAX_ORDERS = 3;
export const CAFE_SHIFT_COMPLETION_BONUS_XP = 30;
export const CAFE_SERVE_XP_BONUS = 15;
export const CAFE_CYON_XP_MULTIPLIER = 2.5;

/** XP a working waiter earns for serving this item. Working earns XP only — no Bucks, no LUL. */
export function cafeWorkXpForItem(item: CafeMenuItemSpec): number {
  return item.xpReward + CAFE_SERVE_XP_BONUS;
}

/** XP for buying this item with CYON: 2.5x the XP of working (serving) the same item. */
export function cafeCyonPurchaseXpForItem(item: CafeMenuItemSpec): number {
  return Math.round(cafeWorkXpForItem(item) * CAFE_CYON_XP_MULTIPLIER);
}

export interface PlayerLevelProgress {
  level: number;
  totalXp: number;
  currentLevelXp: number;
  xpForNextLevel: number;
  progress01: number;
}

export function xpRequiredForLevelStep(level: number): number {
  const safeLv = Math.max(1, Math.floor(level));
  return Math.round(80 + (safeLv - 1) * 45 + Math.pow(safeLv - 1, 1.35) * 18);
}

export function computeLevelProgress(totalXpInput: number): PlayerLevelProgress {
  let remaining = Math.max(0, Math.floor(totalXpInput));
  let level = 1;
  while (level < 999) {
    const step = xpRequiredForLevelStep(level);
    if (remaining < step) {
      return {
        level,
        totalXp: Math.max(0, Math.floor(totalXpInput)),
        currentLevelXp: remaining,
        xpForNextLevel: step,
        progress01: Math.max(0, Math.min(1, remaining / step)),
      };
    }
    remaining -= step;
    level += 1;
  }
  const capStep = xpRequiredForLevelStep(level);
  return {
    level,
    totalXp: Math.max(0, Math.floor(totalXpInput)),
    currentLevelXp: capStep,
    xpForNextLevel: capStep,
    progress01: 1,
  };
}

export interface XpGainResult {
  xpAdded: number;
  previousLevel: number;
  newLevel: number;
  leveledUp: boolean;
  levelsGained: number;
  progress: PlayerLevelProgress;
}

export function applyPlayerXpGain(currentTotalXp: number, gainXp: number): XpGainResult {
  const prev = computeLevelProgress(currentTotalXp);
  const safeGain = Math.max(0, Math.round(gainXp));
  const next = computeLevelProgress(prev.totalXp + safeGain);
  return {
    xpAdded: safeGain,
    previousLevel: prev.level,
    newLevel: next.level,
    leveledUp: next.level > prev.level,
    levelsGained: Math.max(0, next.level - prev.level),
    progress: next,
  };
}

export interface CafeActiveCustomerOrder {
  orderId: string;
  customerName: string;
  item: CafeMenuItemSpec;
  orderNumber: number;
  maxOrdersInShift: number;
}

export interface CafeWorkShiftState {
  isWorking: boolean;
  ordersCompletedInShift: number;
  maxOrdersInShift: number;
  activeOrder: CafeActiveCustomerOrder | null;
  totalOrdersServedEver: number;
}

const AI_CAFE_CUSTOMER_NAMES = [
  'Sora',
  'Mika',
  'Kenji',
  'Lina',
  'Rafi',
  'Nadia',
  'Taro',
  'Ayu',
] as const;

export function createInitialCafeWorkShiftState(totalOrdersServedEver = 0): CafeWorkShiftState {
  return {
    isWorking: false,
    ordersCompletedInShift: 0,
    maxOrdersInShift: CAFE_SHIFT_MAX_ORDERS,
    activeOrder: null,
    totalOrdersServedEver,
  };
}

export function pickNextAiCafeOrder(
  orderNumber: number,
  seed = Date.now(),
  maxOrdersInShift = CAFE_SHIFT_MAX_ORDERS,
): CafeActiveCustomerOrder {
  const safeSeed = Math.abs(Math.floor(seed));
  const item = CAFE_MENU_ITEMS[(safeSeed + orderNumber * 3) % CAFE_MENU_ITEMS.length];
  const customerName = AI_CAFE_CUSTOMER_NAMES[(safeSeed + orderNumber) % AI_CAFE_CUSTOMER_NAMES.length];
  return {
    orderId: `order-${orderNumber}-${safeSeed}`,
    customerName,
    item,
    orderNumber,
    maxOrdersInShift,
  };
}

export function startCafeWorkShift(
  prev: CafeWorkShiftState,
  seed = Date.now(),
): CafeWorkShiftState {
  return {
    isWorking: true,
    ordersCompletedInShift: 0,
    maxOrdersInShift: CAFE_SHIFT_MAX_ORDERS,
    activeOrder: pickNextAiCafeOrder(1, seed, CAFE_SHIFT_MAX_ORDERS),
    totalOrdersServedEver: prev.totalOrdersServedEver,
  };
}

export interface ServeCafeOrderResult {
  served: boolean;
  servedItem: CafeMenuItemSpec | null;
  customerName: string | null;
  xpGained: number;
  shiftCompleted: boolean;
  nextShiftState: CafeWorkShiftState;
}

export function serveActiveCafeOrder(
  prev: CafeWorkShiftState,
  seed = Date.now(),
): ServeCafeOrderResult {
  if (!prev.isWorking || !prev.activeOrder) {
    return {
      served: false,
      servedItem: null,
      customerName: null,
      xpGained: 0,
      shiftCompleted: false,
      nextShiftState: prev,
    };
  }
  const servedOrder = prev.activeOrder;
  const completedCount = prev.ordersCompletedInShift + 1;
  const shiftCompleted = completedCount >= prev.maxOrdersInShift;
  const xpGained =
    cafeWorkXpForItem(servedOrder.item) +
    (shiftCompleted ? CAFE_SHIFT_COMPLETION_BONUS_XP : 0);

  const nextShiftState: CafeWorkShiftState = shiftCompleted
    ? {
        isWorking: false,
        ordersCompletedInShift: completedCount,
        maxOrdersInShift: prev.maxOrdersInShift,
        activeOrder: null,
        totalOrdersServedEver: prev.totalOrdersServedEver + 1,
      }
    : {
        isWorking: true,
        ordersCompletedInShift: completedCount,
        maxOrdersInShift: prev.maxOrdersInShift,
        activeOrder: pickNextAiCafeOrder(completedCount + 1, seed + 17, prev.maxOrdersInShift),
        totalOrdersServedEver: prev.totalOrdersServedEver + 1,
      };

  return {
    served: true,
    servedItem: servedOrder.item,
    customerName: servedOrder.customerName,
    xpGained,
    shiftCompleted,
    nextShiftState,
  };
}

export interface PurchaseCafeFoodResult {
  purchased: boolean;
  reason?: 'insufficient_lul' | 'item_not_found';
  item: CafeMenuItemSpec | null;
  nextLul: number;
  xpGained: number;
}

export function purchaseCafeMenuItem(
  itemId: CafeMenuItemSpec['id'],
  currentLul: number,
): PurchaseCafeFoodResult {
  const item = CAFE_MENU_ITEMS.find((m) => m.id === itemId) ?? null;
  if (!item) {
    return {
      purchased: false,
      reason: 'item_not_found',
      item: null,
      nextLul: currentLul,
      xpGained: 0,
    };
  }
  if (currentLul < item.priceLul) {
    return {
      purchased: false,
      reason: 'insufficient_lul',
      item,
      nextLul: currentLul,
      xpGained: 0,
    };
  }
  return {
    purchased: true,
    item,
    nextLul: currentLul - item.priceLul,
    xpGained: item.xpReward,
  };
}

export interface PurchaseCafeFoodCyonResult {
  purchased: boolean;
  reason?: 'insufficient_cyon' | 'item_not_found';
  item: CafeMenuItemSpec | null;
  nextCyon: number;
  xpGained: number;
}

export function purchaseCafeMenuItemWithCyon(
  itemId: CafeMenuItemSpec['id'],
  currentCyon: number,
): PurchaseCafeFoodCyonResult {
  const item = CAFE_MENU_ITEMS.find((m) => m.id === itemId) ?? null;
  if (!item) {
    return {
      purchased: false,
      reason: 'item_not_found',
      item: null,
      nextCyon: currentCyon,
      xpGained: 0,
    };
  }
  if (currentCyon < item.priceCyon) {
    return {
      purchased: false,
      reason: 'insufficient_cyon',
      item,
      nextCyon: currentCyon,
      xpGained: 0,
    };
  }
  return {
    purchased: true,
    item,
    nextCyon: currentCyon - item.priceCyon,
    xpGained: cafeCyonPurchaseXpForItem(item),
  };
}

export type CafeStationInteractionKind =
  | 'exit_door'
  | 'serve_customer'
  | 'order_counter'
  | 'rota_board';

export function detectNearestCafeStation(
  px: number,
  pz: number,
  isWorking: boolean,
): { kind: CafeStationInteractionKind | null; dist: number } {
  const candidates: Array<{ kind: CafeStationInteractionKind; x: number; z: number; radius: number }> = [
    {
      kind: 'exit_door',
      x: CAFE_INTERIOR_BOUNDS.exitDoorX,
      z: CAFE_INTERIOR_BOUNDS.exitDoorZ,
      radius: 1.9,
    },
    {
      kind: 'rota_board',
      x: CAFE_INTERIOR_BOUNDS.rotaBoardX,
      z: CAFE_INTERIOR_BOUNDS.rotaBoardZ,
      radius: 2.1,
    },
    isWorking
      ? {
          kind: 'serve_customer',
          x: CAFE_INTERIOR_BOUNDS.baristaCounterStandX,
          z: CAFE_INTERIOR_BOUNDS.baristaCounterStandZ,
          radius: 2.6,
        }
      : {
          kind: 'order_counter',
          x: CAFE_INTERIOR_BOUNDS.baristaCounterFrontX,
          z: CAFE_INTERIOR_BOUNDS.baristaCounterFrontZ,
          radius: 2.4,
        },
  ];

  let bestKind: CafeStationInteractionKind | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = Math.hypot(px - c.x, pz - c.z);
    if (d <= c.radius && d < bestDist) {
      bestKind = c.kind;
      bestDist = d;
    }
  }
  return { kind: bestKind, dist: bestDist };
}

/**
 * Exact 2D distance (in meters) outside the L-shaped glasshouse interior footprint:
 * - Returns `0` for any point inside the Main Hall (`[-6.8..6.8] x [-5.25..5.25]`)
 *   or inside the Projecting Left (+X) Wing (`[1.65..6.8] x [5.25..9.65]`).
 * - Returns `> 0` for any outdoor background object (courtyard patio, parasol table, balustrade, garden).
 */
export function computeCafeExteriorDistance(localX: number, localZ: number): number {
  const dxMain = Math.max(Math.abs(localX) - CAFE_INTERIOR_BOUNDS.maxX, 0);
  const dzMain = Math.max(Math.abs(localZ) - CAFE_INTERIOR_BOUNDS.courtyardMinZ, 0);
  const dMain = Math.hypot(dxMain, dzMain);

  const dxWing = Math.max(
    Math.max(CAFE_INTERIOR_BOUNDS.wingMinX - localX, localX - CAFE_INTERIOR_BOUNDS.maxX),
    0,
  );
  const dzWing = Math.max(
    Math.max(CAFE_INTERIOR_BOUNDS.courtyardMinZ - localZ, localZ - CAFE_INTERIOR_BOUNDS.maxZ),
    0,
  );
  const dWing = Math.hypot(dxWing, dzWing);

  return Math.min(dMain, dWing);
}

function smoothstep01(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Computes the soft exterior mist & defocus blend factor (`0` strictly inside the room so indoor
 * visuals stay 100% sharp; `0.30..0.88` outside the glasshouse ramping smoothly with distance).
 */
export function computeCafeExteriorMistFactor(localX: number, localZ: number): number {
  const distOutside = computeCafeExteriorDistance(localX, localZ);
  if (distOutside <= 0.001) return 0;
  return Math.min(0.88, 0.30 + smoothstep01(0.15, 9.0, distOutside) * 0.58);
}

