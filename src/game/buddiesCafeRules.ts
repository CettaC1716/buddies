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
  /**
   * Explicit RESPITE shelf price when this item is sold as a giftable
   * treat in the Central Plaza Bites & Sips storefront (price reset,
   * respite-price-list.md §6). RESPITE prices are explicit values —
   * never derived by formula from priceLul.
   */
  priceRespite: number;
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
    priceRespite: 60,
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
    priceRespite: 50,
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
    priceRespite: 60,
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
    priceRespite: 50,
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
    priceRespite: 50,
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
    priceRespite: 50,
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
    priceRespite: 50,
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
    priceRespite: 50,
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
    priceRespite: 50,
    xpReward: 24,
    shiftBucksReward: 18,
    prepHint: 'Rich warm chocolate mocha',
    accentHex: '#f87171',
  },
];

export const CAFE_EXTERIOR_DOOR_TRIGGER = {
  x: -90.55,
  z: 22.35,
  deckY: 2.5,
  triggerRadius: 2.85,
  exitSpawnX: -90.55,
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
  arcadeSlotMachine: {
    x: 6.32,
    markerY: 2.04,
    promptY: 2.24,
    z: 4.33,
    standX: 5.50,
    standZ: 4.33,
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

// Character facing follows fwd = (cos yaw, -sin yaw) while Bentwood Rattan Chairs open
// along local +Z, so a chair rotated by chairYaw opens at yaw = chairYaw - Math.PI / 2:
// east/left-wing chairs (x=4.46, chairYaw=+PI/2 -> table at x=5.28) face +X (yaw=0);
// west chairs (x=-4.62, chairYaw=-PI/2 -> table at x=-5.45) face -X (yaw=Math.PI).
export const CAFE_INTERIOR_SEAT_SPOTS: ReadonlyArray<CafeInteriorSeatSpot> = [
  { id: 'cafe_east_bistro_1', x: 4.46, z: -0.85, yaw: 0, seatLiftY: 0.19, indicatorHeightY: 0.73 },
  { id: 'cafe_east_bistro_2', x: 4.46, z: 1.55, yaw: 0, seatLiftY: 0.19, indicatorHeightY: 0.73 },
  { id: 'cafe_west_bistro_1', x: -4.62, z: -0.65, yaw: Math.PI, seatLiftY: 0.19, indicatorHeightY: 0.73 },
  { id: 'cafe_west_bistro_2', x: -4.62, z: 1.85, yaw: Math.PI, seatLiftY: 0.19, indicatorHeightY: 0.73 },
  { id: 'cafe_left_wing_1', x: 4.46, z: 7.45, yaw: 0, seatLiftY: 0.19, indicatorHeightY: 0.73 },
];

export const CAFE_CHAIR_STAND_UP_STEP_M = 0.74;

/**
 * Computes a pinch-free stand-up coordinate outside both the solid chair collider
 * and adjacent bistro table collider. When WASD points into or parallel to the table,
 * the exit vector is biased aisleward while preserving lateral movement direction.
 */
export function computeCafeSeatStandUpPosition(
  spot: CafeInteriorSeatSpot,
  moveDirX = 0,
  moveDirZ = 0,
): { x: number; z: number } {
  const tableDirX = Math.cos(spot.yaw);
  const tableDirZ = -Math.sin(spot.yaw);
  const aisleDirX = -tableDirX;
  const aisleDirZ = -tableDirZ;

  const inputLen = Math.hypot(moveDirX, moveDirZ);
  let dirX = aisleDirX;
  let dirZ = aisleDirZ;

  if (inputLen > 0.01) {
    const nx = moveDirX / inputLen;
    const nz = moveDirZ / inputLen;
    const aisleDot = nx * aisleDirX + nz * aisleDirZ;
    if (aisleDot >= 0.45) {
      dirX = nx;
      dirZ = nz;
    } else {
      const latAxisX = -tableDirZ;
      const latAxisZ = tableDirX;
      const latProj = nx * latAxisX + nz * latAxisZ;
      if (Math.abs(latProj) > 0.2) {
        const latSign = latProj >= 0 ? 1 : -1;
        const rawX = aisleDirX * 0.55 + latAxisX * latSign * 0.835;
        const rawZ = aisleDirZ * 0.55 + latAxisZ * latSign * 0.835;
        const rawLen = Math.hypot(rawX, rawZ) || 1;
        dirX = rawX / rawLen;
        dirZ = rawZ / rawLen;
      }
    }
  }

  return clampCafeInteriorPosition(
    spot.x + dirX * CAFE_CHAIR_STAND_UP_STEP_M,
    spot.z + dirZ * CAFE_CHAIR_STAND_UP_STEP_M,
  );
}

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

export type CafeMenuItemId = CafeMenuItemSpec['id'];

export const CAFE_ITEM_CONSUME_DURATION_MS = 8000;
export const CAFE_MAX_BATCH_ORDER_ITEMS = 6;

export interface CafeBatchOrderEntry {
  itemId: CafeMenuItemId;
  quantity: number;
}

export interface CafeConsumerQueueState {
  activeItem: CafeMenuItemSpec | null;
  queuedItems: ReadonlyArray<CafeMenuItemSpec>;
  startedAtMs: number;
  itemEndsAtMs: number;
  totalBatchSize: number;
  consumedCount: number;
}

export interface CafeConsumerRemainingSummary {
  activeItem: CafeMenuItemSpec | null;
  queuedCount: number;
  totalRemainingCount: number;
  remainingActiveMs: number;
  totalRemainingMs: number;
  isConsuming: boolean;
}

export function createInitialCafeConsumerState(): CafeConsumerQueueState {
  return {
    activeItem: null,
    queuedItems: [],
    startedAtMs: 0,
    itemEndsAtMs: 0,
    totalBatchSize: 0,
    consumedCount: 0,
  };
}

export function advanceCafeConsumerState(
  state: CafeConsumerQueueState,
  nowMs = Date.now(),
): {
  nextState: CafeConsumerQueueState;
  finishedItems: CafeMenuItemSpec[];
  batchCompleted: boolean;
} {
  if (!state.activeItem) {
    return {
      nextState: state,
      finishedItems: [],
      batchCompleted: false,
    };
  }
  const finishedItems: CafeMenuItemSpec[] = [];
  let activeItem: CafeMenuItemSpec | null = state.activeItem;
  let queued = state.queuedItems.slice();
  let startedAtMs = state.startedAtMs;
  let itemEndsAtMs = state.itemEndsAtMs;
  let consumedCount = state.consumedCount;

  while (activeItem && nowMs >= itemEndsAtMs) {
    finishedItems.push(activeItem);
    consumedCount += 1;
    if (queued.length > 0) {
      activeItem = queued.shift()!;
      startedAtMs = itemEndsAtMs;
      itemEndsAtMs = startedAtMs + CAFE_ITEM_CONSUME_DURATION_MS;
    } else {
      activeItem = null;
      startedAtMs = 0;
      itemEndsAtMs = 0;
    }
  }

  if (finishedItems.length === 0) {
    return {
      nextState: state,
      finishedItems,
      batchCompleted: false,
    };
  }

  if (!activeItem) {
    return {
      nextState: createInitialCafeConsumerState(),
      finishedItems,
      batchCompleted: true,
    };
  }

  return {
    nextState: {
      activeItem,
      queuedItems: queued,
      startedAtMs,
      itemEndsAtMs,
      totalBatchSize: state.totalBatchSize,
      consumedCount,
    },
    finishedItems,
    batchCompleted: false,
  };
}

export function getCafeConsumerRemainingSummary(
  state: CafeConsumerQueueState,
  nowMs = Date.now(),
): CafeConsumerRemainingSummary {
  const advanced = advanceCafeConsumerState(state, nowMs).nextState;
  if (!advanced.activeItem) {
    return {
      activeItem: null,
      queuedCount: 0,
      totalRemainingCount: 0,
      remainingActiveMs: 0,
      totalRemainingMs: 0,
      isConsuming: false,
    };
  }
  const remainingActiveMs = Math.max(0, advanced.itemEndsAtMs - nowMs);
  const queuedCount = advanced.queuedItems.length;
  return {
    activeItem: advanced.activeItem,
    queuedCount,
    totalRemainingCount: 1 + queuedCount,
    remainingActiveMs,
    totalRemainingMs: remainingActiveMs + queuedCount * CAFE_ITEM_CONSUME_DURATION_MS,
    isConsuming: true,
  };
}

export interface PurchaseCafeOrderBatchResult {
  purchased: boolean;
  reason?:
    | 'still_consuming'
    | 'empty_batch'
    | 'exceeds_max_batch'
    | 'invalid_item'
    | 'insufficient_cyon';
  items: CafeMenuItemSpec[];
  totalPriceCyon: number;
  nextCyon: number;
  xpGained: number;
  nextConsumerState: CafeConsumerQueueState;
}

export function purchaseCafeOrderBatch(
  entries: ReadonlyArray<CafeBatchOrderEntry | CafeMenuItemId>,
  currentCyon: number,
  consumerState: CafeConsumerQueueState,
  nowMs = Date.now(),
): PurchaseCafeOrderBatchResult {
  const advancedState = advanceCafeConsumerState(consumerState, nowMs).nextState;
  if (advancedState.activeItem) {
    return {
      purchased: false,
      reason: 'still_consuming',
      items: [],
      totalPriceCyon: 0,
      nextCyon: currentCyon,
      xpGained: 0,
      nextConsumerState: advancedState,
    };
  }

  const expanded: CafeMenuItemSpec[] = [];
  for (const entry of entries) {
    const itemId = typeof entry === 'string' ? entry : entry.itemId;
    const rawQty = typeof entry === 'string' ? 1 : Math.floor(entry.quantity);
    if (rawQty <= 0) continue;
    const spec = CAFE_MENU_ITEMS.find((m) => m.id === itemId);
    if (!spec) {
      return {
        purchased: false,
        reason: 'invalid_item',
        items: [],
        totalPriceCyon: 0,
        nextCyon: currentCyon,
        xpGained: 0,
        nextConsumerState: advancedState,
      };
    }
    for (let q = 0; q < rawQty; q++) {
      expanded.push(spec);
      if (expanded.length > CAFE_MAX_BATCH_ORDER_ITEMS) {
        return {
          purchased: false,
          reason: 'exceeds_max_batch',
          items: [],
          totalPriceCyon: 0,
          nextCyon: currentCyon,
          xpGained: 0,
          nextConsumerState: advancedState,
        };
      }
    }
  }

  if (expanded.length === 0) {
    return {
      purchased: false,
      reason: 'empty_batch',
      items: [],
      totalPriceCyon: 0,
      nextCyon: currentCyon,
      xpGained: 0,
      nextConsumerState: advancedState,
    };
  }

  let totalPriceCyon = 0;
  let xpGained = 0;
  for (const it of expanded) {
    totalPriceCyon += it.priceLul;
    xpGained += it.xpReward;
  }

  if (currentCyon < totalPriceCyon) {
    return {
      purchased: false,
      reason: 'insufficient_cyon',
      items: expanded,
      totalPriceCyon,
      nextCyon: currentCyon,
      xpGained: 0,
      nextConsumerState: advancedState,
    };
  }

  return {
    purchased: true,
    items: expanded,
    totalPriceCyon,
    nextCyon: currentCyon - totalPriceCyon,
    xpGained,
    nextConsumerState: {
      activeItem: expanded[0],
      queuedItems: expanded.slice(1),
      startedAtMs: nowMs,
      itemEndsAtMs: nowMs + CAFE_ITEM_CONSUME_DURATION_MS,
      totalBatchSize: expanded.length,
      consumedCount: 0,
    },
  };
}

export interface PurchaseCafeFoodResult {
  purchased: boolean;
  reason?: 'insufficient_cyon' | 'item_not_found' | 'still_consuming';
  item: CafeMenuItemSpec | null;
  nextCyon: number;
  xpGained: number;
  nextConsumerState?: CafeConsumerQueueState;
}

export function purchaseCafeMenuItem(
  itemId: CafeMenuItemSpec['id'],
  currentCyon: number,
  consumerState?: CafeConsumerQueueState,
  nowMs = Date.now(),
): PurchaseCafeFoodResult {
  const item = CAFE_MENU_ITEMS.find((m) => m.id === itemId) ?? null;
  if (!item) {
    return {
      purchased: false,
      reason: 'item_not_found',
      item: null,
      nextCyon: currentCyon,
      xpGained: 0,
      nextConsumerState: consumerState,
    };
  }
  const activeState = consumerState ?? createInitialCafeConsumerState();
  const batchRes = purchaseCafeOrderBatch([itemId], currentCyon, activeState, nowMs);
  if (!batchRes.purchased) {
    return {
      purchased: false,
      reason:
        batchRes.reason === 'still_consuming'
          ? 'still_consuming'
          : batchRes.reason === 'insufficient_cyon'
            ? 'insufficient_cyon'
            : 'item_not_found',
      item,
      nextCyon: currentCyon,
      xpGained: 0,
      nextConsumerState: batchRes.nextConsumerState,
    };
  }
  return {
    purchased: true,
    item,
    nextCyon: batchRes.nextCyon,
    xpGained: batchRes.xpGained,
    nextConsumerState: batchRes.nextConsumerState,
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
  | 'atm_machine'
  | 'arcade_slot';

export const CAFE_SEAT_PROXIMITY_RADIUS = 1.85;
export const CAFE_CHAIR_HALF_EXTENT_M = 0.27;

function distanceToAabb2d(
  px: number,
  pz: number,
  cx: number,
  cz: number,
  hw: number,
  hd: number,
): number {
  const dx = Math.max(0, Math.abs(px - cx) - hw);
  const dz = Math.max(0, Math.abs(pz - cz) - hd);
  return Math.hypot(dx, dz);
}

/**
 * Exact 2D surface distance from `(px, pz)` to a cafe chair's physical 3D collider footprint.
 */
export function computeCafeSeatObjectDistance(
  px: number,
  pz: number,
  spot: Pick<CafeInteriorSeatSpot, 'x' | 'z'>,
): number {
  return distanceToAabb2d(
    px,
    pz,
    spot.x,
    spot.z,
    CAFE_CHAIR_HALF_EXTENT_M,
    CAFE_CHAIR_HALF_EXTENT_M,
  );
}

/**
 * Exact 2D surface distance from `(px, pz)` to the physical 3D object footprint of a cafe station.
 */
export function computeCafeStationObjectDistance(
  px: number,
  pz: number,
  kind: CafeStationInteractionKind,
  isWorking: boolean,
  activeOrderCategory: 'drink' | 'pastry' | null = null,
): number {
  switch (kind) {
    case 'rota_board':
      if (isWorking) {
        return Math.hypot(
          px - CAFE_INTERIOR_BOUNDS.workShiftExitPadX,
          pz - CAFE_INTERIOR_BOUNDS.workShiftExitPadZ,
        );
      }
      // Joined Wooden Base Cabinet + Wall-Mounted Work Shift Board collider (`cafe_rota_board`)
      return distanceToAabb2d(px, pz, 3.04, -4.72, 1.02, 0.50);
    case 'atm_machine':
      return distanceToAabb2d(px, pz, -4.25, -4.95, 0.42, 0.36);
    case 'arcade_slot':
      return distanceToAabb2d(px, pz, 6.32, 4.33, 0.38, 0.42);
    case 'order_counter':
      return distanceToAabb2d(px, pz, -0.45, -2.05, 2.54, 0.49);
    case 'exit_door':
      return distanceToAabb2d(
        px,
        pz,
        CAFE_INTERIOR_BOUNDS.exitDoorX,
        CAFE_INTERIOR_BOUNDS.exitDoorZ,
        0.55,
        0.35,
      );
    case 'serve_customer': {
      if (activeOrderCategory === 'pastry') {
        return Math.hypot(
          px - CAFE_APPLIANCE_TARGETS.pastryDisplayCase.x,
          pz - CAFE_APPLIANCE_TARGETS.pastryDisplayCase.z,
        );
      }
      if (activeOrderCategory === 'drink') {
        return Math.hypot(
          px - CAFE_APPLIANCE_TARGETS.drinkEspressoMachine.x,
          pz - CAFE_APPLIANCE_TARGETS.drinkEspressoMachine.z,
        );
      }
      return distanceToAabb2d(px, pz, -0.45, -2.05, 2.54, 0.49);
    }
  }
}

export interface CafeNearestPromptOrSeatResult {
  target: 'none' | 'station' | 'seat';
  stationKind: CafeStationInteractionKind | null;
  seatIndex: number;
  seatSpot: CafeInteriorSeatSpot | null;
  objectDistance: number;
}

/**
 * Unified proximity arbiter inside the Botanical Glasshouse Cafe:
 * When both a Cafe station (such as the Work Shift rota board) and a Cafe chair (`SIT`)
 * are simultaneously within interaction range, resolves strictly to whichever physical
 * 3D object (`bendanya`) is closer to the player.
 */
export function resolveNearestCafePromptOrSeat(
  px: number,
  pz: number,
  isWorking: boolean,
  activeOrderCategory: 'drink' | 'pastry' | null = null,
  isSeatOccupied?: (spot: CafeInteriorSeatSpot) => boolean,
): CafeNearestPromptOrSeatResult {
  const station = detectNearestCafeStation(px, pz, isWorking, activeOrderCategory);
  const stationObjectDist =
    station.kind !== null
      ? computeCafeStationObjectDistance(px, pz, station.kind, isWorking, activeOrderCategory)
      : Infinity;

  let bestSeatIdx = -1;
  let bestSeatObjectDist = Infinity;
  if (!isWorking) {
    for (let i = 0; i < CAFE_INTERIOR_SEAT_SPOTS.length; i++) {
      const spot = CAFE_INTERIOR_SEAT_SPOTS[i];
      if (isSeatOccupied?.(spot)) continue;
      const centerDist = Math.hypot(px - spot.x, pz - spot.z);
      if (centerDist <= CAFE_SEAT_PROXIMITY_RADIUS) {
        const objDist = computeCafeSeatObjectDistance(px, pz, spot);
        if (objDist < bestSeatObjectDist) {
          bestSeatObjectDist = objDist;
          bestSeatIdx = i;
        }
      }
    }
  }

  const hasStation = station.kind !== null;
  const hasSeat = bestSeatIdx !== -1;

  if (hasStation && hasSeat) {
    if (bestSeatObjectDist < stationObjectDist) {
      return {
        target: 'seat',
        stationKind: null,
        seatIndex: bestSeatIdx,
        seatSpot: CAFE_INTERIOR_SEAT_SPOTS[bestSeatIdx],
        objectDistance: bestSeatObjectDist,
      };
    }
    return {
      target: 'station',
      stationKind: station.kind,
      seatIndex: -1,
      seatSpot: null,
      objectDistance: stationObjectDist,
    };
  }

  if (hasStation) {
    return {
      target: 'station',
      stationKind: station.kind,
      seatIndex: -1,
      seatSpot: null,
      objectDistance: stationObjectDist,
    };
  }

  if (hasSeat) {
    return {
      target: 'seat',
      stationKind: null,
      seatIndex: bestSeatIdx,
      seatSpot: CAFE_INTERIOR_SEAT_SPOTS[bestSeatIdx],
      objectDistance: bestSeatObjectDist,
    };
  }

  return {
    target: 'none',
    stationKind: null,
    seatIndex: -1,
    seatSpot: null,
    objectDistance: Infinity,
  };
}

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
          {
            kind: 'arcade_slot' as const,
            x: CAFE_APPLIANCE_TARGETS.arcadeSlotMachine.standX,
            z: CAFE_APPLIANCE_TARGETS.arcadeSlotMachine.standZ,
            radius: 1.95,
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

export type IndoorOrbitRoomKind = 'cafe_interior' | 'house_visit' | 'casino_interior';

export interface HouseCameraObstructionBox {
  name?: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

/**
 * Playable envelope for Private House walk-in exploration (`house_visit`).
 * Spans the full walled courtyard garden (`Col_Courtyard_W/E/N/S`) surrounding
 * the glass apartment (`houseMinX..houseMaxX, houseMinZ..houseMaxZ`).
 * The player spawns outside on the stepping stones right in front of the wooden
 * garden gate (`pintu kayu`) facing inward toward the yard & apartment, and the
 * glowing exit portal sits at that wooden gate threshold.
 */
export const HOUSE_VISIT_INDOOR_BOUNDS = {
  minX: -8.67,
  maxX: 8.67,
  minZ: -6.87,
  maxZ: 7.47,
  houseMinX: -5.3,
  houseMaxX: 5.3,
  houseMinZ: -3.7,
  houseMaxZ: 3.7,
  spawnX: -6.2,
  spawnZ: 6.15,
  spawnYaw: 2.08,
  exitX: -6.95,
  exitZ: 6.92,
  exitY: -0.125,
  exitTriggerRadius: 1.75,
} as const;

/**
 * Vertical scale factor applied to the apartment's walls/ceilings/roof in
 * `buddiesHouseSceneBuilder.ts` (kept in sync here for fallback camera AABBs).
 */
const HOUSE_CAMERA_SHELL_HEIGHT_SCALE = 1.24;

/**
 * Default room-local 3D AABBs of the Glass Modern apartment's solid walls,
 * interior partitions, glass facades, courtyard perimeter walls, and raised
 * roof/ceiling slabs. Used from frame 1 (before async GLB load completes) and
 * in deterministic unit tests so the camera never penetrates any wall or roof.
 */
export const DEFAULT_HOUSE_VISIT_CAMERA_OBSTRUCTION_BOXES: readonly HouseCameraObstructionBox[] = [
  // Courtyard perimeter walls
  { name: 'Col_Courtyard_W', minX: -9.13, maxX: -8.67, minY: -0.3, maxY: 3.0, minZ: -7.4, maxZ: 8.0 },
  { name: 'Col_Courtyard_E', minX: 8.67, maxX: 9.13, minY: -0.3, maxY: 3.0, minZ: -7.4, maxZ: 8.0 },
  { name: 'Col_Courtyard_N', minX: -9.2, maxX: 9.2, minY: -0.3, maxY: 3.0, minZ: -7.33, maxZ: -6.87 },
  { name: 'Col_Courtyard_S', minX: -9.2, maxX: 9.2, minY: -0.3, maxY: 3.0, minZ: 7.47, maxZ: 7.93 },
  // Exterior apartment walls (leaving the south front doorway x in [-1.55, -0.65] open!)
  { name: 'Col_Wall_West', minX: -5.3, maxX: -5.14, minY: 0, maxY: 3.2 * HOUSE_CAMERA_SHELL_HEIGHT_SCALE, minZ: -3.7, maxZ: 3.7 },
  { name: 'Col_Wall_East', minX: 5.14, maxX: 5.3, minY: 0, maxY: 2.85 * HOUSE_CAMERA_SHELL_HEIGHT_SCALE, minZ: -3.7, maxZ: 3.7 },
  { name: 'Col_Wall_South_L', minX: -5.3, maxX: -1.55, minY: 0, maxY: 3.2 * HOUSE_CAMERA_SHELL_HEIGHT_SCALE, minZ: 3.54, maxZ: 3.7 },
  { name: 'Col_Wall_South_R', minX: -0.65, maxX: 5.3, minY: 0, maxY: 2.85 * HOUSE_CAMERA_SHELL_HEIGHT_SCALE, minZ: 3.54, maxZ: 3.7 },
  { name: 'Col_Wall_North_Kitchen', minX: -5.3, maxX: -2.2, minY: 0, maxY: 3.2 * HOUSE_CAMERA_SHELL_HEIGHT_SCALE, minZ: -3.7, maxZ: -3.54 },
  { name: 'Col_Wall_North_Mid', minX: 0.5, maxX: 2.2, minY: 0, maxY: 2.85 * HOUSE_CAMERA_SHELL_HEIGHT_SCALE, minZ: -3.7, maxZ: -3.54 },
  { name: 'Col_Wall_North_East', minX: 4.0, maxX: 5.3, minY: 0, maxY: 2.85 * HOUSE_CAMERA_SHELL_HEIGHT_SCALE, minZ: -3.7, maxZ: -3.54 },
  { name: 'Col_MainSlide_Glass', minX: -2.25, maxX: 0.55, minY: 0, maxY: 3.0 * HOUSE_CAMERA_SHELL_HEIGHT_SCALE, minZ: -3.72, maxZ: -3.52 },
  { name: 'Col_BedSlide_Glass', minX: 2.15, maxX: 4.05, minY: 0, maxY: 2.84 * HOUSE_CAMERA_SHELL_HEIGHT_SCALE, minZ: -3.72, maxZ: -3.52 },
  // Interior partitions (leaving bedroom door z in [-0.8, 0.1] and bath door z in [1.3, 2.2] open!)
  { name: 'Col_Part_Center_N', minX: 0.84, maxX: 0.96, minY: 0, maxY: 3.0 * HOUSE_CAMERA_SHELL_HEIGHT_SCALE, minZ: -3.54, maxZ: -0.8 },
  { name: 'Col_Part_Center_M', minX: 0.84, maxX: 0.96, minY: 0, maxY: 3.0 * HOUSE_CAMERA_SHELL_HEIGHT_SCALE, minZ: 0.1, maxZ: 1.3 },
  { name: 'Col_Part_Center_S', minX: 0.84, maxX: 0.96, minY: 0, maxY: 3.0 * HOUSE_CAMERA_SHELL_HEIGHT_SCALE, minZ: 2.2, maxZ: 3.54 },
  { name: 'Col_Part_BathBed', minX: 0.96, maxX: 5.14, minY: 0, maxY: 2.85 * HOUSE_CAMERA_SHELL_HEIGHT_SCALE, minZ: 0.64, maxZ: 0.76 },
  // Raised ceiling & roof slabs
  { name: 'Ceiling_Main_OakSoffit', minX: -5.66, maxX: 1.06, minY: 2.82 * HOUSE_CAMERA_SHELL_HEIGHT_SCALE, maxY: 3.53 * HOUSE_CAMERA_SHELL_HEIGHT_SCALE, minZ: -4.06, maxZ: 4.06 },
  { name: 'Roof_East_Ceiling', minX: 0.9, maxX: 5.54, minY: 2.85 * HOUSE_CAMERA_SHELL_HEIGHT_SCALE, maxY: 3.25 * HOUSE_CAMERA_SHELL_HEIGHT_SCALE, minZ: -3.92, maxZ: 3.92 },
];

/** Returns true when `(x, z)` lies inside the apartment building footprint. */
export function isPointInsideHouseFootprint(x: number, z: number, pad = 0): boolean {
  return (
    x >= HOUSE_VISIT_INDOOR_BOUNDS.houseMinX - pad &&
    x <= HOUSE_VISIT_INDOOR_BOUNDS.houseMaxX + pad &&
    z >= HOUSE_VISIT_INDOOR_BOUNDS.houseMinZ - pad &&
    z <= HOUSE_VISIT_INDOOR_BOUNDS.houseMaxZ + pad
  );
}

/**
 * Room-local ground surface Y in `house_visit` so the character's feet sit
 * flush on the apartment interior floor (`0.00`), front entry porch (`-0.05`),
 * north wooden deck (`-0.02`), stepping stones (`-0.13`), and courtyard lawn
 * (`-0.18`).
 */
export function getHouseVisitFloorY(x: number, z: number): number {
  if (isPointInsideHouseFootprint(x, z)) {
    return 0;
  }
  // Entry porch directly outside the south glass door
  if (x >= -2.18 && x <= -0.02 && z >= 3.7 && z <= 4.42) {
    return -0.05;
  }
  // North wooden deck behind the apartment
  if (x >= -5.32 && x <= 5.32 && z >= -6.06 && z <= -3.7) {
    return -0.02;
  }
  // Stepping-stone corridor from the wooden garden gate to the entry porch
  if (x >= -7.7 && x <= -1.3 && z >= 4.2 && z <= 7.4) {
    // Line from (-7.03, 6.97) to (-1.51, 4.46)
    const lx = -1.51 - -7.03;
    const lz = 4.46 - 6.97;
    const lenSq = lx * lx + lz * lz;
    const t = clampNum(((x - -7.03) * lx + (z - 6.97) * lz) / lenSq, 0, 1);
    const px = -7.03 + t * lx;
    const pz = 6.97 + t * lz;
    if (Math.hypot(x - px, z - pz) <= 0.62) {
      return -0.13;
    }
  }
  return -0.18;
}

export const CASINO_INDOOR_CAMERA_BOUNDS = {
  minX: -9.85,
  maxX: 9.85,
  minZ: -6.85,
  maxZ: 6.85,
  interiorMaxZ: 6.85,
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
    defaultYaw: -1.16,
    defaultPitch: 0.46,
    defaultDist: 3.75,
    minPitch: 0.14,
    maxPitch: 0.82,
    minDist: 1.85,
    maxDist: 5.4,
    lookHeightOffset: 0.96,
    minCamHeightOffset: 0.44,
    maxCamHeightOffset: 3.50,
    indoorMaxCamHeightOffset: 3.22,
    wallMargin: 0.42,
    cameraCollisionPadding: 0.24,
    wallLookShiftFactor: 0.32,
    maxWallLookShift: 0.55,
  },
  casino_interior: {
    fovDeg: 54,
    defaultYaw: 0.06,
    defaultPitch: 0.48,
    defaultDist: 6.45,
    minPitch: 0.14,
    maxPitch: 0.92,
    minDist: 2.5,
    maxDist: 9.2,
    lookHeightOffset: 0.98,
    minCamHeightOffset: 0.58,
    maxCamHeightOffset: 4.68,
    wallMargin: 0.40,
    wallLookShiftFactor: 0.30,
    maxWallLookShift: 0.72,
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
  /** Optional live 3D wall/partition/roof AABBs (room-local) for `house_visit`. */
  obstructionBoxes?: readonly HouseCameraObstructionBox[];
}

export interface IndoorRoomOrbitCameraPose {
  fovDeg: number;
  camX: number;
  camY: number;
  camZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
  /** Ratio `[0..1]` of unobstructed ray length remaining after wall pull-in. */
  obstructionRatio?: number;
}

function clampNum(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Exact slab intersection of segment `P(t) = A + t * (B - A)` (`t ∈ [0, 1]`)
 * against an axis-aligned box padded by `pad`. Returns the entry `t` if the
 * segment enters the padded box, or `1` if unobstructed. If `A` already lies
 * strictly inside the box, skips that box so the camera never collapses to 0.
 */
function intersectSegmentPaddedAabb(
  ax: number,
  ay: number,
  az: number,
  dx: number,
  dy: number,
  dz: number,
  box: HouseCameraObstructionBox,
  pad: number,
): number {
  const minX = box.minX - pad;
  const maxX = box.maxX + pad;
  const minY = box.minY - pad;
  const maxY = box.maxY + pad;
  const minZ = box.minZ - pad;
  const maxZ = box.maxZ + pad;

  // If the ray origin itself is inside the padded box, ignore it to avoid
  // locking the camera to zero distance when brushing beside a wall.
  if (
    ax > minX &&
    ax < maxX &&
    ay > minY &&
    ay < maxY &&
    az > minZ &&
    az < maxZ
  ) {
    return 1;
  }

  let tmin = 0;
  let tmax = 1;

  // X slab
  if (Math.abs(dx) < 1e-8) {
    if (ax < minX || ax > maxX) return 1;
  } else {
    const inv = 1 / dx;
    let t1 = (minX - ax) * inv;
    let t2 = (maxX - ax) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return 1;
  }

  // Y slab
  if (Math.abs(dy) < 1e-8) {
    if (ay < minY || ay > maxY) return 1;
  } else {
    const inv = 1 / dy;
    let t1 = (minY - ay) * inv;
    let t2 = (maxY - ay) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return 1;
  }

  // Z slab
  if (Math.abs(dz) < 1e-8) {
    if (az < minZ || az > maxZ) return 1;
  } else {
    const inv = 1 / dz;
    let t1 = (minZ - az) * inv;
    let t2 = (maxZ - az) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return 1;
  }

  return tmin >= 0 && tmin <= 1 ? tmin : 1;
}

/**
 * Resolves 3D wall/partition/courtyard/roof obstructions along the segment from
 * `look` to `desiredCam` in room-local coordinates so the `house_visit` camera
 * stays strictly inside the playable space and never clips through any wall.
 */
export function resolveHouseVisitCameraObstruction(
  anchorX: number,
  anchorZ: number,
  lookX: number,
  lookLocalY: number,
  lookZ: number,
  desiredCamX: number,
  desiredCamLocalY: number,
  desiredCamZ: number,
  obstructionBoxes: readonly HouseCameraObstructionBox[],
  padding = INDOOR_ORBIT_CAMERA_CONFIG.house_visit.cameraCollisionPadding,
): {
  lookX: number;
  lookLocalY: number;
  lookZ: number;
  camX: number;
  camLocalY: number;
  camZ: number;
  obstructionRatio: number;
} {
  // 1. Ensure the look target itself never shifts behind a wall from the avatar.
  let safeLookX = lookX;
  let safeLookZ = lookZ;
  const shiftDx = lookX - anchorX;
  const shiftDz = lookZ - anchorZ;
  if (shiftDx * shiftDx + shiftDz * shiftDz > 1e-6) {
    let minShiftT = 1;
    for (let i = 0; i < obstructionBoxes.length; i++) {
      const t = intersectSegmentPaddedAabb(
        anchorX,
        lookLocalY,
        anchorZ,
        shiftDx,
        0,
        shiftDz,
        obstructionBoxes[i],
        padding * 0.75,
      );
      if (t < minShiftT) minShiftT = t;
    }
    if (minShiftT < 1) {
      const safeT = Math.max(0, minShiftT - 0.02);
      safeLookX = anchorX + shiftDx * safeT;
      safeLookZ = anchorZ + shiftDz * safeT;
    }
  }

  // 2. Raycast from `safeLook` to `desiredCam` against every solid wall/partition/roof box.
  const rayDx = desiredCamX - safeLookX;
  const rayDy = desiredCamLocalY - lookLocalY;
  const rayDz = desiredCamZ - safeLookZ;
  const rayLen = Math.hypot(rayDx, rayDy, rayDz);

  let hitT = 1;
  if (rayLen > 1e-5) {
    for (let i = 0; i < obstructionBoxes.length; i++) {
      const t = intersectSegmentPaddedAabb(
        safeLookX,
        lookLocalY,
        safeLookZ,
        rayDx,
        rayDy,
        rayDz,
        obstructionBoxes[i],
        padding,
      );
      if (t < hitT) hitT = t;
    }
  }

  // Keep a small minimum pullback distance so the camera doesn't clip inside the avatar head.
  const minDistFromLook = 0.55;
  const minT = rayLen > minDistFromLook ? minDistFromLook / rayLen : 1;
  const clampedT = hitT < 1 ? Math.max(minT, hitT) : 1;

  const wallMargin = INDOOR_ORBIT_CAMERA_CONFIG.house_visit.wallMargin;
  const camX = clampNum(
    safeLookX + rayDx * clampedT,
    HOUSE_VISIT_INDOOR_BOUNDS.minX + wallMargin,
    HOUSE_VISIT_INDOOR_BOUNDS.maxX - wallMargin,
  );
  const camZ = clampNum(
    safeLookZ + rayDz * clampedT,
    HOUSE_VISIT_INDOOR_BOUNDS.minZ + wallMargin,
    HOUSE_VISIT_INDOOR_BOUNDS.maxZ - wallMargin,
  );
  const camFloorY = getHouseVisitFloorY(camX, camZ);
  const camMaxY =
    isPointInsideHouseFootprint(anchorX, anchorZ) || isPointInsideHouseFootprint(camX, camZ, 0.25)
      ? INDOOR_ORBIT_CAMERA_CONFIG.house_visit.indoorMaxCamHeightOffset
      : INDOOR_ORBIT_CAMERA_CONFIG.house_visit.maxCamHeightOffset;
  const camLocalY = clampNum(
    lookLocalY + rayDy * clampedT,
    camFloorY + INDOOR_ORBIT_CAMERA_CONFIG.house_visit.minCamHeightOffset,
    camMaxY,
  );

  return {
    lookX: safeLookX,
    lookLocalY,
    lookZ: safeLookZ,
    camX,
    camLocalY,
    camZ,
    obstructionRatio: clampedT,
  };
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
 * Computes the elevated 3/4 room-overview orbital camera pose for `cafe_interior`,
 * `casino_interior`, and `house_visit`. Preserves full 360-degree user yaw/pitch
 * rotation & wheel zoom while strictly containing the camera inside playable
 * bounds/walls/ceilings and smoothly sliding the look target inward when backing
 * against a wall.
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
      : input.roomKind === 'casino_interior'
        ? {
            x: clampNum(
              rawCamX,
              CASINO_INDOOR_CAMERA_BOUNDS.minX + cfg.wallMargin,
              CASINO_INDOOR_CAMERA_BOUNDS.maxX - cfg.wallMargin,
            ),
            z: clampNum(
              rawCamZ,
              CASINO_INDOOR_CAMERA_BOUNDS.minZ + cfg.wallMargin,
              CASINO_INDOOR_CAMERA_BOUNDS.maxZ - cfg.wallMargin,
            ),
          }
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
      : input.roomKind === 'casino_interior'
        ? {
            x: clampNum(
              rawLookX,
              CASINO_INDOOR_CAMERA_BOUNDS.minX + cfg.wallMargin,
              CASINO_INDOOR_CAMERA_BOUNDS.maxX - cfg.wallMargin,
            ),
            z: clampNum(
              rawLookZ,
              CASINO_INDOOR_CAMERA_BOUNDS.minZ + cfg.wallMargin,
              CASINO_INDOOR_CAMERA_BOUNDS.interiorMaxZ - cfg.wallMargin,
            ),
          }
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

  if (input.roomKind === 'house_visit') {
    const anchorFloorY = getHouseVisitFloorY(input.anchorX, input.anchorZ);
    const lookLocalY = anchorFloorY + cfg.lookHeightOffset;
    const camMaxLocalY = isPointInsideHouseFootprint(input.anchorX, input.anchorZ)
      ? INDOOR_ORBIT_CAMERA_CONFIG.house_visit.indoorMaxCamHeightOffset
      : cfg.maxCamHeightOffset;
    const desiredCamLocalY = clampNum(
      lookLocalY + adjustedVert,
      anchorFloorY + cfg.minCamHeightOffset,
      camMaxLocalY,
    );
    const boxes =
      input.obstructionBoxes && input.obstructionBoxes.length > 0
        ? input.obstructionBoxes
        : DEFAULT_HOUSE_VISIT_CAMERA_OBSTRUCTION_BOXES;
    const resolved = resolveHouseVisitCameraObstruction(
      input.anchorX,
      input.anchorZ,
      clampedLookXZ.x,
      lookLocalY,
      clampedLookXZ.z,
      clampedCamXZ.x,
      desiredCamLocalY,
      clampedCamXZ.z,
      boxes,
    );
    return {
      fovDeg: cfg.fovDeg,
      camX: resolved.camX,
      camY: input.originY + resolved.camLocalY,
      camZ: resolved.camZ,
      lookX: resolved.lookX,
      lookY: input.originY + resolved.lookLocalY,
      lookZ: resolved.lookZ,
      obstructionRatio: resolved.obstructionRatio,
    };
  }

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

// ============================================================================
// UNIFIED TARI DOORWAY TRANSITION & BARISTA SERVICE CHOREOGRAPHY
// ============================================================================

export const CAFE_TARI_EXTERIOR_DOOR_STOP = {
  x: -90.55,
  z: 22.15,
  yaw: -Math.PI / 2,
  arrivalRadiusM: 0.85,
} as const;

export const CAFE_TARI_INTERIOR_DOOR_ENTRY = {
  x: 0.0,
  z: 4.10,
  yaw: Math.PI / 2,
} as const;

export const CAFE_TARI_INTERIOR_DOOR_EXIT = {
  x: 0.0,
  z: 4.35,
  yaw: -Math.PI / 2,
  triggerRadiusM: 0.65,
} as const;

export const CAFE_TARI_COUNTER_SIDE_FLOOR = {
  x: 2.65,
  z: -0.95,
} as const;

export const CAFE_TARI_COUNTER_SIDE_BACK = {
  x: 2.65,
  z: -3.22,
} as const;

export function shouldOutdoorTariEnterCafe(params: {
  tariInsideCafe: boolean;
  npcX: number;
  npcZ: number;
  targetWpX: number;
  targetWpZ: number;
  pauseTimer: number;
  isInteractingWithPlayer: boolean;
}): boolean {
  if (params.tariInsideCafe || params.isInteractingWithPlayer) return false;
  const targetIsDoor =
    Math.hypot(
      params.targetWpX - CAFE_TARI_EXTERIOR_DOOR_STOP.x,
      params.targetWpZ - CAFE_TARI_EXTERIOR_DOOR_STOP.z,
    ) <= 0.65;
  const distToDoor = Math.hypot(
    params.npcX - CAFE_TARI_EXTERIOR_DOOR_STOP.x,
    params.npcZ - CAFE_TARI_EXTERIOR_DOOR_STOP.z,
  );
  if (targetIsDoor && distToDoor <= CAFE_TARI_EXTERIOR_DOOR_STOP.arrivalRadiusM) {
    return true;
  }
  return params.pauseTimer > 0 && distToDoor <= CAFE_TARI_EXTERIOR_DOOR_STOP.arrivalRadiusM;
}

export function shouldIndoorTariExitCafe(params: {
  tariInsideCafe: boolean;
  npcX: number;
  npcZ: number;
  targetWpX: number;
  targetWpZ: number;
  pauseTimer: number;
  isInteractingWithPlayer: boolean;
  isServingOrder: boolean;
  cafeWorkShiftActive: boolean;
}): boolean {
  if (
    !params.tariInsideCafe ||
    params.cafeWorkShiftActive ||
    params.isInteractingWithPlayer ||
    params.isServingOrder
  ) {
    return false;
  }
  const targetIsDoor =
    Math.hypot(
      params.targetWpX - CAFE_TARI_INTERIOR_DOOR_EXIT.x,
      params.targetWpZ - CAFE_TARI_INTERIOR_DOOR_EXIT.z,
    ) <= 0.6;
  const distToDoor = Math.hypot(
    params.npcX - CAFE_TARI_INTERIOR_DOOR_EXIT.x,
    params.npcZ - CAFE_TARI_INTERIOR_DOOR_EXIT.z,
  );
  if (targetIsDoor && distToDoor <= CAFE_TARI_INTERIOR_DOOR_EXIT.triggerRadiusM) {
    return true;
  }
  return params.pauseTimer > 0 && distToDoor <= CAFE_TARI_INTERIOR_DOOR_EXIT.triggerRadiusM;
}

export type TariCafeServePhase =
  | 'idle'
  | 'walk_side_floor'
  | 'walk_side_back'
  | 'walk_to_prep'
  | 'preparing'
  | 'walk_to_counter'
  | 'serving';

export interface TariCafeServeState {
  phase: TariCafeServePhase;
  itemId: CafeMenuItemId | null;
  itemName: string;
  category: 'drink' | 'pastry';
  phaseTimerSec: number;
}

export function createInitialTariCafeServeState(): TariCafeServeState {
  return {
    phase: 'idle',
    itemId: null,
    itemName: '',
    category: 'drink',
    phaseTimerSec: 0,
  };
}

function isTariBehindCafeCounter(x: number, z: number): boolean {
  return x >= -2.0 && x <= 2.25 && z <= -2.55 && z >= -4.22;
}

export function startTariCafeServeOrder(params: {
  npcX: number;
  npcZ: number;
  itemId: CafeMenuItemId;
  itemName: string;
  category: 'drink' | 'pastry';
}): TariCafeServeState {
  let initialPhase: TariCafeServePhase;
  if (isTariBehindCafeCounter(params.npcX, params.npcZ)) {
    initialPhase = 'walk_to_prep';
  } else if (params.npcX >= 2.15 && params.npcZ <= -2.6) {
    initialPhase = 'walk_side_back';
  } else {
    initialPhase = 'walk_side_floor';
  }
  return {
    phase: initialPhase,
    itemId: params.itemId,
    itemName: params.itemName,
    category: params.category,
    phaseTimerSec: 0,
  };
}

export interface TariCafeServeStepResult {
  nextState: TariCafeServeState;
  x: number;
  z: number;
  yaw: number;
  isMoving: boolean;
  speedMps: number;
  holdingCafeItemId: CafeMenuItemId | null;
  statusLabel: string;
  completedThisFrame: boolean;
}

function stepTariTowardTarget(
  x: number,
  z: number,
  yaw: number,
  targetX: number,
  targetZ: number,
  speedMps: number,
  dt: number,
): { x: number; z: number; yaw: number; arrived: boolean } {
  const dx = targetX - x;
  const dz = targetZ - z;
  const dist = Math.hypot(dx, dz);
  const stepDist = speedMps * dt;
  if (dist <= Math.max(0.14, stepDist)) {
    return { x: targetX, z: targetZ, yaw, arrived: true };
  }
  const nx = dx / dist;
  const nz = dz / dist;
  const desiredYaw = Math.atan2(-nz, nx);
  let dYaw = desiredYaw - yaw;
  while (dYaw > Math.PI) dYaw -= Math.PI * 2;
  while (dYaw < -Math.PI) dYaw += Math.PI * 2;
  const nextYaw = yaw + dYaw * Math.min(1, dt * 10.0);
  return {
    x: x + nx * stepDist,
    z: z + nz * stepDist,
    yaw: nextYaw,
    arrived: false,
  };
}

export function stepTariCafeServeOrder(params: {
  state: TariCafeServeState;
  x: number;
  z: number;
  yaw: number;
  dt: number;
}): TariCafeServeStepResult {
  const { state, dt } = params;
  if (state.phase === 'idle' || !state.itemId) {
    return {
      nextState: state,
      x: params.x,
      z: params.z,
      yaw: params.yaw,
      isMoving: false,
      speedMps: 0,
      holdingCafeItemId: null,
      statusLabel: 'GLASSHOUSE CAFE STAFF',
      completedThisFrame: false,
    };
  }

  const walkSpeed = 1.65;
  const appliance =
    state.category === 'pastry'
      ? CAFE_APPLIANCE_TARGETS.pastryDisplayCase
      : CAFE_APPLIANCE_TARGETS.drinkEspressoMachine;
  const prepX = appliance.standX;
  const prepZ = -3.15;
  const counterX = CAFE_INTERIOR_BOUNDS.baristaCounterStandX;
  const counterZ = -3.22;
  const cleanItemName = state.itemName.trim().toUpperCase() || state.itemId.toUpperCase();

  if (state.phase === 'walk_side_floor') {
    const move = stepTariTowardTarget(
      params.x,
      params.z,
      params.yaw,
      CAFE_TARI_COUNTER_SIDE_FLOOR.x,
      CAFE_TARI_COUNTER_SIDE_FLOOR.z,
      walkSpeed,
      dt,
    );
    return {
      nextState: move.arrived ? { ...state, phase: 'walk_side_back', phaseTimerSec: 0 } : state,
      x: move.x,
      z: move.z,
      yaw: move.yaw,
      isMoving: !move.arrived,
      speedMps: move.arrived ? 0 : walkSpeed,
      holdingCafeItemId: null,
      statusLabel: `TAKING YOUR ${cleanItemName} ORDER`,
      completedThisFrame: false,
    };
  }

  if (state.phase === 'walk_side_back') {
    const move = stepTariTowardTarget(
      params.x,
      params.z,
      params.yaw,
      CAFE_TARI_COUNTER_SIDE_BACK.x,
      CAFE_TARI_COUNTER_SIDE_BACK.z,
      walkSpeed,
      dt,
    );
    return {
      nextState: move.arrived ? { ...state, phase: 'walk_to_prep', phaseTimerSec: 0 } : state,
      x: move.x,
      z: move.z,
      yaw: move.yaw,
      isMoving: !move.arrived,
      speedMps: move.arrived ? 0 : walkSpeed,
      holdingCafeItemId: null,
      statusLabel: `HEADING BEHIND COUNTER`,
      completedThisFrame: false,
    };
  }

  if (state.phase === 'walk_to_prep') {
    const move = stepTariTowardTarget(params.x, params.z, params.yaw, prepX, prepZ, walkSpeed, dt);
    return {
      nextState: move.arrived
        ? { ...state, phase: 'preparing', phaseTimerSec: 1.1 }
        : state,
      x: move.x,
      z: move.z,
      yaw: move.arrived ? -Math.PI / 2 : move.yaw,
      isMoving: !move.arrived,
      speedMps: move.arrived ? 0 : walkSpeed,
      holdingCafeItemId: null,
      statusLabel:
        state.category === 'pastry'
          ? `PACKING ${cleanItemName}`
          : `BREWING ${cleanItemName}`,
      completedThisFrame: false,
    };
  }

  if (state.phase === 'preparing') {
    const nextTimer = Math.max(0, state.phaseTimerSec - dt);
    const donePrep = nextTimer <= 0;
    return {
      nextState: donePrep
        ? { ...state, phase: 'walk_to_counter', phaseTimerSec: 0 }
        : { ...state, phaseTimerSec: nextTimer },
      x: prepX,
      z: prepZ,
      yaw: -Math.PI / 2,
      isMoving: false,
      speedMps: 0,
      holdingCafeItemId: donePrep ? state.itemId : null,
      statusLabel:
        state.category === 'pastry'
          ? `PREPARING ${cleanItemName}`
          : `BREWING ${cleanItemName}`,
      completedThisFrame: false,
    };
  }

  if (state.phase === 'walk_to_counter') {
    const move = stepTariTowardTarget(
      params.x,
      params.z,
      params.yaw,
      counterX,
      counterZ,
      walkSpeed * 0.9,
      dt,
    );
    return {
      nextState: move.arrived
        ? { ...state, phase: 'serving', phaseTimerSec: 2.4 }
        : state,
      x: move.x,
      z: move.z,
      yaw: move.arrived ? -Math.PI / 2 : move.yaw,
      isMoving: !move.arrived,
      speedMps: move.arrived ? 0 : walkSpeed * 0.9,
      holdingCafeItemId: state.itemId,
      statusLabel: `BRINGING YOUR ${cleanItemName}`,
      completedThisFrame: false,
    };
  }

  // phase === 'serving'
  const nextTimer = Math.max(0, state.phaseTimerSec - dt);
  const completed = nextTimer <= 0;
  return {
    nextState: completed ? createInitialTariCafeServeState() : { ...state, phaseTimerSec: nextTimer },
    x: counterX,
    z: counterZ,
    yaw: -Math.PI / 2,
    isMoving: false,
    speedMps: 0,
    holdingCafeItemId: state.itemId,
    statusLabel: `SERVING ${cleanItemName}`,
    completedThisFrame: completed,
  };
}




