/**
 * Pure gameplay rules, XP/Level progression, Barista Work Shift state machine,
 * Food & Drink Order Catalog, ATM Salary Exchange, and Glasshouse Cafe geometry constants.
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
  xpReward: number;
  shiftBucksReward: number;
  prepHint: string;
  accentHex: string;
}

export const CAFE_MENU_ITEMS: ReadonlyArray<CafeMenuItemSpec> = [
  {
    id: 'latte',
    name: 'Caramel Latte',
    category: 'drink',
    priceLul: 10,
    xpReward: 35,
    shiftBucksReward: 24,
    prepHint: 'Warm steamed milk latte art',
    accentHex: '#f59e0b',
  },
  {
    id: 'croissant',
    name: 'Butter Croissant',
    category: 'pastry',
    priceLul: 3,
    xpReward: 12,
    shiftBucksReward: 12,
    prepHint: 'Flaky golden butter pastry',
    accentHex: '#fbbf24',
  },
  {
    id: 'sandwich',
    name: 'Club Sandwich',
    category: 'pastry',
    priceLul: 10,
    xpReward: 35,
    shiftBucksReward: 24,
    prepHint: 'Fresh botanical club sandwich',
    accentHex: '#4ade80',
  },
  {
    id: 'espresso',
    name: 'Double Espresso',
    category: 'drink',
    priceLul: 3,
    xpReward: 12,
    shiftBucksReward: 12,
    prepHint: 'Rich classic double espresso',
    accentHex: '#92400e',
  },
  {
    id: 'cinnamon_roll',
    name: 'Cinnamon Roll',
    category: 'pastry',
    priceLul: 6,
    xpReward: 22,
    shiftBucksReward: 16,
    prepHint: 'Warm spiced cinnamon roll',
    accentHex: '#d97706',
  },
  {
    id: 'donut',
    name: 'Glazed Donut',
    category: 'pastry',
    priceLul: 2,
    xpReward: 8,
    shiftBucksReward: 10,
    prepHint: 'Sweet classic glazed donut',
    accentHex: '#f472b6',
  },
  {
    id: 'muffin',
    name: 'Blueberry Muffin',
    category: 'pastry',
    priceLul: 4,
    xpReward: 16,
    shiftBucksReward: 14,
    prepHint: 'Soft baked blueberry muffin',
    accentHex: '#60a5fa',
  },
  {
    id: 'iced_latte',
    name: 'Botanical Iced Latte',
    category: 'drink',
    priceLul: 3,
    xpReward: 14,
    shiftBucksReward: 12,
    prepHint: 'Chilled botanical iced coffee',
    accentHex: '#38bdf8',
  },
  {
    id: 'hot_mocha',
    name: 'Hot Choco Mocha',
    category: 'drink',
    priceLul: 6,
    xpReward: 24,
    shiftBucksReward: 18,
    prepHint: 'Rich warm chocolate mocha',
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
  spawnZ: 1.15,
  spawnYaw: Math.PI / 2,
  exitDoorX: 0.0,
  exitDoorZ: 4.55,
  baristaCounterFrontX: -0.2,
  baristaCounterFrontZ: -1.10,
  baristaCounterStandX: -0.2,
  baristaCounterStandZ: -3.35,
  workShiftExitPadX: 1.95,
  workShiftExitPadZ: -3.38,
  workShiftMinX: -1.62,
  workShiftMaxX: 1.95,
  workShiftMinZ: -3.78,
  workShiftMaxZ: -2.96,
  rotaBoardX: 3.04,
  rotaBoardZ: -3.62,
  atmMachineX: -4.25,
  atmMachineZ: -4.15,
} as const;

export const CAFE_APPLIANCE_TARGETS = {
  exitDoor: { x: 0.0, markerY: 0.65, promptY: 1.45, z: 4.55 },
  atmMachine: { x: -4.25, markerY: 1.98, promptY: 2.18, z: -4.82 },
  workShiftBoard: { x: 3.04, markerY: 2.24, promptY: 2.44, z: -4.42 },
  orderPosRegister: { x: -2.23, markerY: 1.56, promptY: 1.76, z: -1.99 },
  drinkEspressoMachine: {
    x: -0.91,
    markerY: 1.72,
    promptY: 1.92,
    z: -2.07,
    standX: -0.88,
    standZ: -2.95,
  },
  pastryDisplayCase: {
    x: 1.01,
    markerY: 1.96,
    promptY: 2.16,
    z: -2.07,
    standX: 0.96,
    standZ: -2.95,
  },
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

/**
 * While the player is actively working a Barista Work Shift (`isWorking === true`),
 * contains their position strictly inside the behind-counter wooden workspace corridor
 * (`x in [-1.62 .. +1.95]`, `z in [-3.78 .. -2.96]`) so they cannot exit past the
 * work-shift exit ring+triangle boundary at `x = 1.95` until they end their shift.
 */
export function clampCafeBaristaWorkShiftPosition(
  rawX: number,
  rawZ: number,
): { x: number; z: number } {
  return {
    x: Math.max(
      CAFE_INTERIOR_BOUNDS.workShiftMinX,
      Math.min(CAFE_INTERIOR_BOUNDS.workShiftMaxX, rawX),
    ),
    z: Math.max(
      CAFE_INTERIOR_BOUNDS.workShiftMinZ,
      Math.min(CAFE_INTERIOR_BOUNDS.workShiftMaxZ, rawZ),
    ),
  };
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
export const CAFE_SHIFT_COMPLETION_BONUS_BUCKS = 25;
export const CAFE_BUCKS_TO_LUL_RATE = 1; // 1 Shift Buck = 1 LUL

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

export interface CafeShiftQueueEntry {
  id: string;
  name: string;
  isSelf: boolean;
}

export interface CafeActiveOtherWorker {
  id: string;
  name: string;
  ordersServed: number;
  maxOrders: number;
}

export interface CafeWorkShiftState {
  isWorking: boolean;
  ordersCompletedInShift: number;
  maxOrdersInShift: number;
  activeOrder: CafeActiveCustomerOrder | null;
  totalOrdersServedEver: number;
  otherActiveWorker?: CafeActiveOtherWorker | null;
  shiftQueue?: ReadonlyArray<CafeShiftQueueEntry>;
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

const AI_CAFE_SHIFT_WORKER_NAMES = [
  'Riko (Citizen)',
  'Mika (Citizen)',
  'Kenji (Citizen)',
] as const;

export function createInitialCafeWorkShiftState(totalOrdersServedEver = 0): CafeWorkShiftState {
  return {
    isWorking: false,
    ordersCompletedInShift: 0,
    maxOrdersInShift: CAFE_SHIFT_MAX_ORDERS,
    activeOrder: null,
    totalOrdersServedEver,
    otherActiveWorker: null,
    shiftQueue: [],
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
  const remainingQueue = (prev.shiftQueue ?? []).filter((entry) => !entry.isSelf);
  const safeSeed = Math.abs(Math.floor(seed));
  const nextNpcName =
    AI_CAFE_SHIFT_WORKER_NAMES[safeSeed % AI_CAFE_SHIFT_WORKER_NAMES.length];
  const queueWithWaitingPeer: ReadonlyArray<CafeShiftQueueEntry> =
    remainingQueue.length > 0
      ? remainingQueue
      : [{ id: `npc-worker-${safeSeed}`, name: nextNpcName, isSelf: false }];

  return {
    isWorking: true,
    ordersCompletedInShift: 0,
    maxOrdersInShift: CAFE_SHIFT_MAX_ORDERS,
    activeOrder: pickNextAiCafeOrder(1, seed, CAFE_SHIFT_MAX_ORDERS),
    totalOrdersServedEver: prev.totalOrdersServedEver,
    otherActiveWorker: null,
    shiftQueue: queueWithWaitingPeer,
  };
}

export interface ServeCafeOrderResult {
  served: boolean;
  servedItem: CafeMenuItemSpec | null;
  customerName: string | null;
  xpGained: number;
  bucksEarned: number;
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
      bucksEarned: 0,
      shiftCompleted: false,
      nextShiftState: prev,
    };
  }
  const servedOrder = prev.activeOrder;
  const completedCount = prev.ordersCompletedInShift + 1;
  const shiftCompleted = completedCount >= prev.maxOrdersInShift;
  const baseXp = servedOrder.item.xpReward + 15;
  const baseBucks = servedOrder.item.shiftBucksReward;
  const xpGained = baseXp + (shiftCompleted ? CAFE_SHIFT_COMPLETION_BONUS_XP : 0);
  const bucksEarned = baseBucks + (shiftCompleted ? CAFE_SHIFT_COMPLETION_BONUS_BUCKS : 0);

  // When 1 round (3 serves) completes, player exits shift and must register again;
  // any waiting worker in queue advances into the active barista slot.
  const currentQueue = (prev.shiftQueue ?? []).filter((entry) => !entry.isSelf);
  const nextQueueWorker = shiftCompleted && currentQueue.length > 0 ? currentQueue[0] : null;
  const remainingQueueAfterPromote =
    shiftCompleted && currentQueue.length > 0 ? currentQueue.slice(1) : currentQueue;

  const nextShiftState: CafeWorkShiftState = shiftCompleted
    ? {
        isWorking: false,
        ordersCompletedInShift: completedCount,
        maxOrdersInShift: prev.maxOrdersInShift,
        activeOrder: null,
        totalOrdersServedEver: prev.totalOrdersServedEver + 1,
        otherActiveWorker: nextQueueWorker
          ? {
              id: nextQueueWorker.id,
              name: nextQueueWorker.name,
              ordersServed: 0,
              maxOrders: CAFE_SHIFT_MAX_ORDERS,
            }
          : null,
        shiftQueue: remainingQueueAfterPromote,
      }
    : {
        isWorking: true,
        ordersCompletedInShift: completedCount,
        maxOrdersInShift: prev.maxOrdersInShift,
        activeOrder: pickNextAiCafeOrder(completedCount + 1, seed + 17, prev.maxOrdersInShift),
        totalOrdersServedEver: prev.totalOrdersServedEver + 1,
        otherActiveWorker: null,
        shiftQueue: prev.shiftQueue ?? [],
      };

  return {
    served: true,
    servedItem: servedOrder.item,
    customerName: servedOrder.customerName,
    xpGained,
    bucksEarned,
    shiftCompleted,
    nextShiftState,
  };
}

export function joinCafeWorkShiftQueue(
  prev: CafeWorkShiftState,
  playerName = 'YOU',
  seed = Date.now(),
): { nextState: CafeWorkShiftState; startedImmediately: boolean; queuePosition: number } {
  if (prev.isWorking) {
    return { nextState: prev, startedImmediately: false, queuePosition: 0 };
  }
  if (!prev.otherActiveWorker) {
    const started = startCafeWorkShift(prev, seed);
    return { nextState: started, startedImmediately: true, queuePosition: 0 };
  }
  const existingQueue = prev.shiftQueue ?? [];
  const existingIdx = existingQueue.findIndex((entry) => entry.isSelf);
  if (existingIdx >= 0) {
    return {
      nextState: prev,
      startedImmediately: false,
      queuePosition: existingIdx + 1,
    };
  }
  const cleanName = playerName.trim() ? `${playerName.trim()} (YOU)` : 'YOU';
  const updatedQueue: ReadonlyArray<CafeShiftQueueEntry> = [
    ...existingQueue,
    { id: 'self-player', name: cleanName, isSelf: true },
  ];
  return {
    nextState: {
      ...prev,
      shiftQueue: updatedQueue,
    },
    startedImmediately: false,
    queuePosition: updatedQueue.length,
  };
}

export function leaveCafeWorkShiftQueue(prev: CafeWorkShiftState): CafeWorkShiftState {
  const existingQueue = prev.shiftQueue ?? [];
  if (!existingQueue.some((entry) => entry.isSelf)) return prev;
  return {
    ...prev,
    shiftQueue: existingQueue.filter((entry) => !entry.isSelf),
  };
}

export function stepOtherActiveCafeWorkerServe(
  prev: CafeWorkShiftState,
  seed = Date.now(),
): {
  nextState: CafeWorkShiftState;
  promotedSelfToWorking: boolean;
  completedWorkerName: string | null;
} {
  if (prev.isWorking || !prev.otherActiveWorker) {
    return {
      nextState: prev,
      promotedSelfToWorking: false,
      completedWorkerName: null,
    };
  }
  const active = prev.otherActiveWorker;
  const nextServed = active.ordersServed + 1;
  if (nextServed < active.maxOrders) {
    return {
      nextState: {
        ...prev,
        otherActiveWorker: {
          ...active,
          ordersServed: nextServed,
        },
      },
      promotedSelfToWorking: false,
      completedWorkerName: null,
    };
  }

  // Active other worker finished all 3 serves in their round!
  const completedName = active.name;
  const currentQueue = prev.shiftQueue ?? [];
  if (currentQueue.length === 0) {
    return {
      nextState: {
        ...prev,
        otherActiveWorker: null,
        shiftQueue: [],
      },
      promotedSelfToWorking: false,
      completedWorkerName: completedName,
    };
  }

  const nextUp = currentQueue[0];
  const restQueue = currentQueue.slice(1);
  if (nextUp.isSelf) {
    const startedSelf = startCafeWorkShift(
      {
        ...prev,
        otherActiveWorker: null,
        shiftQueue: restQueue,
      },
      seed,
    );
    return {
      nextState: startedSelf,
      promotedSelfToWorking: true,
      completedWorkerName: completedName,
    };
  }

  return {
    nextState: {
      ...prev,
      otherActiveWorker: {
        id: nextUp.id,
        name: nextUp.name,
        ordersServed: 0,
        maxOrders: CAFE_SHIFT_MAX_ORDERS,
      },
      shiftQueue: restQueue,
    },
    promotedSelfToWorking: false,
    completedWorkerName: completedName,
  };
}

export function toggleSimulatedOtherCafeWorker(
  prev: CafeWorkShiftState,
  seed = Date.now(),
): CafeWorkShiftState {
  if (prev.isWorking) return prev;
  if (prev.otherActiveWorker) {
    return {
      ...prev,
      otherActiveWorker: null,
      shiftQueue: [],
    };
  }
  const safeSeed = Math.abs(Math.floor(seed));
  const npcName = AI_CAFE_SHIFT_WORKER_NAMES[safeSeed % AI_CAFE_SHIFT_WORKER_NAMES.length];
  return {
    ...prev,
    otherActiveWorker: {
      id: `sim-worker-${safeSeed}`,
      name: npcName,
      ordersServed: 0,
      maxOrders: CAFE_SHIFT_MAX_ORDERS,
    },
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

export interface ExchangeCafeBucksResult {
  exchanged: boolean;
  bucksSpent: number;
  lulReceived: number;
  nextBucks: number;
  nextLul: number;
}

export function exchangeCafeBucksToLul(
  requestedBucks: number,
  currentBucks: number,
  currentLul: number,
): ExchangeCafeBucksResult {
  const cleanBucks = Math.min(
    Math.max(0, Math.floor(requestedBucks)),
    Math.max(0, Math.floor(currentBucks)),
  );
  if (cleanBucks <= 0) {
    return {
      exchanged: false,
      bucksSpent: 0,
      lulReceived: 0,
      nextBucks: currentBucks,
      nextLul: currentLul,
    };
  }
  const lulReceived = cleanBucks * CAFE_BUCKS_TO_LUL_RATE;
  return {
    exchanged: true,
    bucksSpent: cleanBucks,
    lulReceived,
    nextBucks: currentBucks - cleanBucks,
    nextLul: currentLul + lulReceived,
  };
}

export type CafeStationInteractionKind =
  | 'exit_door'
  | 'serve_customer'
  | 'order_counter'
  | 'rota_board'
  | 'atm_machine';

export function detectNearestCafeStation(
  px: number,
  pz: number,
  isWorking: boolean,
  activeOrderCategory: 'drink' | 'pastry' | null = null,
): { kind: CafeStationInteractionKind | null; dist: number } {
  if (isWorking) {
    const dWorkExitPad = Math.hypot(
      px - CAFE_INTERIOR_BOUNDS.workShiftExitPadX,
      pz - CAFE_INTERIOR_BOUNDS.workShiftExitPadZ,
    );
    if (dWorkExitPad <= 0.68) {
      return { kind: 'rota_board', dist: dWorkExitPad };
    }
  }

  const activeAppliance =
    activeOrderCategory === 'pastry'
      ? CAFE_APPLIANCE_TARGETS.pastryDisplayCase
      : activeOrderCategory === 'drink'
        ? CAFE_APPLIANCE_TARGETS.drinkEspressoMachine
        : null;

  const candidates: Array<{ kind: CafeStationInteractionKind; x: number; z: number; radius: number }> = [
    {
      kind: 'exit_door',
      x: CAFE_INTERIOR_BOUNDS.exitDoorX,
      z: CAFE_INTERIOR_BOUNDS.exitDoorZ,
      radius: 1.9,
    },
    {
      kind: 'atm_machine',
      x: CAFE_INTERIOR_BOUNDS.atmMachineX,
      z: CAFE_INTERIOR_BOUNDS.atmMachineZ,
      radius: 2.1,
    },
    {
      kind: 'rota_board',
      x: CAFE_INTERIOR_BOUNDS.rotaBoardX,
      z: CAFE_INTERIOR_BOUNDS.rotaBoardZ,
      radius: 2.25,
    },
    ...(isWorking
      ? [
          ...(activeAppliance
            ? [
                {
                  kind: 'serve_customer' as const,
                  x: activeAppliance.standX,
                  z: activeAppliance.standZ,
                  radius: 2.65,
                },
              ]
            : []),
          {
            kind: 'serve_customer' as const,
            x: CAFE_INTERIOR_BOUNDS.baristaCounterStandX,
            z: CAFE_INTERIOR_BOUNDS.baristaCounterStandZ,
            radius: 2.65,
          },
        ]
      : [
          {
            kind: 'order_counter' as const,
            x: CAFE_APPLIANCE_TARGETS.orderPosRegister.x,
            z: CAFE_INTERIOR_BOUNDS.baristaCounterFrontZ,
            radius: 2.45,
          },
          {
            kind: 'order_counter' as const,
            x: CAFE_INTERIOR_BOUNDS.baristaCounterFrontX,
            z: CAFE_INTERIOR_BOUNDS.baristaCounterFrontZ,
            radius: 2.4,
          },
        ]),
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

export type IndoorOrbitRoomKind = 'cafe_interior' | 'house_visit';

export const HOUSE_VISIT_INDOOR_BOUNDS = {
  minX: -5.3,
  maxX: 5.3,
  minZ: -3.7,
  maxZ: 3.7,
  spawnX: 0.0,
  spawnZ: 0.65,
  spawnYaw: Math.PI / 2,
} as const;

export const INDOOR_ORBIT_CAMERA_CONFIG = {
  cafe_interior: {
    fovDeg: 56,
    defaultYaw: 0.03,
    defaultPitch: 0.49,
    defaultDist: 5.30,
    baristaShiftYaw: -0.52,
    baristaShiftPitch: 0.50,
    baristaShiftDist: 5.10,
    minPitch: 0.14,
    maxPitch: 0.88,
    minDist: 2.2,
    maxDist: 6.4,
    lookHeightOffset: 0.98,
    minCamHeightOffset: 0.55,
    maxCamHeightOffset: 3.72,
    wallMargin: 0.34,
    wallLookShiftFactor: 0.35,
    maxWallLookShift: 0.60,
  },
  house_visit: {
    fovDeg: 56,
    defaultYaw: 0.0,
    defaultPitch: 0.50,
    defaultDist: 4.55,
    minPitch: 0.14,
    maxPitch: 0.84,
    minDist: 2.1,
    maxDist: 5.8,
    lookHeightOffset: 0.96,
    minCamHeightOffset: 0.50,
    maxCamHeightOffset: 3.55,
    wallMargin: 0.42,
    wallLookShiftFactor: 0.32,
    maxWallLookShift: 0.55,
  },
} as const;

export interface IndoorRoomOrbitCameraPoseInput {
  roomKind: IndoorOrbitRoomKind;
  originY: number;
  anchorX: number;
  anchorZ: number;
  yaw: number;
  pitch: number;
  dist: number;
}

export interface IndoorRoomOrbitCameraPose {
  fovDeg: number;
  camX: number;
  camY: number;
  camZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
}

function clampNum(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function clampCafeCameraLineOfSightXZ(
  anchorX: number,
  anchorZ: number,
  rawCamX: number,
  rawCamZ: number,
  margin: number,
): { x: number; z: number } {
  const minX = CAFE_INTERIOR_BOUNDS.minX + margin;
  const maxX = CAFE_INTERIOR_BOUNDS.maxX - margin;
  const minZ = CAFE_INTERIOR_BOUNDS.minZ + margin;
  const hallMaxZ = CAFE_INTERIOR_BOUNDS.courtyardMinZ - margin;
  const wingMinX = CAFE_INTERIOR_BOUNDS.wingMinX + margin;
  const wingMaxZ = CAFE_INTERIOR_BOUNDS.maxZ - margin;

  // Smoothly unlock the East (+X) Wing Z-extension as the anchor crosses into x >= wingMinX,
  // and restrict X >= wingMinX when the anchor is deep inside the East Wing (z > hallMaxZ),
  // guaranteeing 100% unobstructed straight-line sight without crossing the outdoor courtyard notch.
  const wingBlendX = smoothstep01(wingMinX - 0.25, wingMinX + 0.25, anchorX);
  const wingBlendZ = smoothstep01(hallMaxZ - 0.25, hallMaxZ + 0.25, anchorZ);

  const effectiveMaxZ = hallMaxZ + (wingMaxZ - hallMaxZ) * wingBlendX;
  const effectiveMinX = minX + (wingMinX - minX) * wingBlendZ;

  let x = clampNum(rawCamX, effectiveMinX, maxX);
  let z = clampNum(rawCamZ, minZ, effectiveMaxZ);

  if (x < wingMinX && z > hallMaxZ) {
    const pushEast = wingMinX - x;
    const pushNorth = z - hallMaxZ;
    if (pushEast < pushNorth && wingBlendX >= 0.5) {
      x = wingMinX;
    } else {
      z = hallMaxZ;
    }
  }
  return { x, z };
}

/**
 * Computes the elevated 3/4 room-overview orbital camera pose for both `cafe_interior` and
 * `house_visit`. Preserves full 360-degree user yaw/pitch rotation & wheel zoom while strictly
 * containing the camera inside room walls/ceilings and smoothly sliding the look target inward
 * when backing against a wall so the room overview never collapses onto the top of the avatar's head.
 */
export function computeIndoorRoomOrbitCameraPose(
  input: IndoorRoomOrbitCameraPoseInput,
): IndoorRoomOrbitCameraPose {
  const cfg = INDOOR_ORBIT_CAMERA_CONFIG[input.roomKind];
  const safePitch = clampNum(input.pitch, cfg.minPitch, cfg.maxPitch);
  const safeDist = clampNum(input.dist, cfg.minDist, cfg.maxDist);

  const cosPitch = Math.cos(safePitch);
  const sinPitch = Math.sin(safePitch);
  const desiredHoriz = Math.max(0.001, cosPitch * safeDist);
  const desiredVert = sinPitch * safeDist;

  const rawCamX = input.anchorX + Math.sin(input.yaw) * desiredHoriz;
  const rawCamZ = input.anchorZ + Math.cos(input.yaw) * desiredHoriz;

  const clampedCamXZ =
    input.roomKind === 'cafe_interior'
      ? clampCafeCameraLineOfSightXZ(
          input.anchorX,
          input.anchorZ,
          rawCamX,
          rawCamZ,
          cfg.wallMargin,
        )
      : {
          x: clampNum(
            rawCamX,
            HOUSE_VISIT_INDOOR_BOUNDS.minX + cfg.wallMargin,
            HOUSE_VISIT_INDOOR_BOUNDS.maxX - cfg.wallMargin,
          ),
          z: clampNum(
            rawCamZ,
            HOUSE_VISIT_INDOOR_BOUNDS.minZ + cfg.wallMargin,
            HOUSE_VISIT_INDOOR_BOUNDS.maxZ - cfg.wallMargin,
          ),
        };

  const pushX = clampedCamXZ.x - rawCamX;
  const pushZ = clampedCamXZ.z - rawCamZ;

  let shiftX = pushX * cfg.wallLookShiftFactor;
  let shiftZ = pushZ * cfg.wallLookShiftFactor;
  const shiftMag = Math.hypot(shiftX, shiftZ);
  if (shiftMag > cfg.maxWallLookShift && shiftMag > 1e-6) {
    const scale = cfg.maxWallLookShift / shiftMag;
    shiftX *= scale;
    shiftZ *= scale;
  }

  const rawLookX = input.anchorX + shiftX;
  const rawLookZ = input.anchorZ + shiftZ;
  const clampedLookXZ =
    input.roomKind === 'cafe_interior'
      ? clampCafeInteriorPosition(rawLookX, rawLookZ, cfg.wallMargin)
      : {
          x: clampNum(
            rawLookX,
            HOUSE_VISIT_INDOOR_BOUNDS.minX + cfg.wallMargin,
            HOUSE_VISIT_INDOOR_BOUNDS.maxX - cfg.wallMargin,
          ),
          z: clampNum(
            rawLookZ,
            HOUSE_VISIT_INDOOR_BOUNDS.minZ + cfg.wallMargin,
            HOUSE_VISIT_INDOOR_BOUNDS.maxZ - cfg.wallMargin,
          ),
        };

  const actualHoriz = Math.hypot(
    clampedCamXZ.x - clampedLookXZ.x,
    clampedCamXZ.z - clampedLookXZ.z,
  );
  const horizRatio = clampNum(actualHoriz / desiredHoriz, 0.4, 1.0);
  const adjustedVert = desiredVert * (0.80 + 0.20 * horizRatio);

  const lookY = input.originY + cfg.lookHeightOffset;
  const camY = clampNum(
    lookY + adjustedVert,
    input.originY + cfg.minCamHeightOffset,
    input.originY + cfg.maxCamHeightOffset,
  );

  return {
    fovDeg: cfg.fovDeg,
    camX: clampedCamXZ.x,
    camY,
    camZ: clampedCamXZ.z,
    lookX: clampedLookXZ.x,
    lookY,
    lookZ: clampedLookXZ.z,
  };
}


