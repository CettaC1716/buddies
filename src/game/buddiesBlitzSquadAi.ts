import {
  AStarNavGrid,
  createAStarNavGrid,
  rasterizeObbObstacleToNavGrid,
  rasterizeCircleObstacleToNavGrid,
  findPathAStar,
  COMMANDERS_PER_TEAM,
  BUILD_ORDER_SPECS,
  KIOSK_BUILD_PRIORITY_RECIPES,
  PadSlotHologramPattern,
  selectSmartCrateForAiHarvester,
  isCrateInsideOtherOrEnemyBase,
  canUnitLootGroundWeapon,
  evaluateBuiltBuddySmartAiDecision,
  BuildOrderTarget,
  TeamCommandMode,
  KioskBuildPriorityRecipeId,
  CrateSlotType,
  WorldCrateKind,
  IndividualCommanderBaseState,
  isTankClimbableProp,
} from './buddiesBlitzRules';
import {
  evaluateOuterEmbankmentSdf,
  evaluateSeHarborSdf,
  evaluateNwLakeSdf,
  getPlanetShortestDelta,
  getPlanetShortestDistance,
  wrapPlanetCoord,
} from './buddiesPlanetCurvature';
import {
  BuddyUnit,
  TankVehicle,
  WorldCrate,
  WorldPickup,
  DestructibleTree,
  ActiveMapPropPhysics,
  StaticWorldStructureObb,
} from './buddiesBlitzTypes';

/**
 * Rebuilds the cached 2D A* Navigation Grids for Foot Units (`BuddyUnit`) and Tracked Vehicles (`TankVehicle`).
 */
export function buildArenaNavGrids(params: {
  staticStructures: ReadonlyArray<StaticWorldStructureObb>;
  trees: ReadonlyArray<DestructibleTree>;
  activeMapProps: ReadonlyArray<ActiveMapPropPhysics>;
}): { footGrid: AStarNavGrid; vehicleGrid: AStarNavGrid } {
  const { staticStructures, trees, activeMapProps } = params;
  const footGrid = createAStarNavGrid(-112, 112, -112, 112, 1.5);
  const vehicleGrid = createAStarNavGrid(-112, 112, -112, 112, 1.5);
  const footPad = 0.5;
  const vehiclePad = 0.92;

  // 1. Rasterize Outer Embankment, East Harbor Deep Water, and Centered Oasis Lake
  for (let row = 0; row < footGrid.rows; row++) {
    const wz = footGrid.minZ + (row + 0.5) * footGrid.cellSize;
    for (let col = 0; col < footGrid.cols; col++) {
      const wx = footGrid.minX + (col + 0.5) * footGrid.cellSize;
      const idx = row * footGrid.cols + col;
      if (
        evaluateOuterEmbankmentSdf(wx, wz) > -0.85 ||
        evaluateSeHarborSdf(wx, wz).waterSdf < 0.25
      ) {
        footGrid.blocked[idx] = 1;
        vehicleGrid.blocked[idx] = 1;
      } else if (evaluateNwLakeSdf(wx, wz) < 0.25) {
        // Foot units walk around the Centered Oasis Lake; tracked tanks can ford across it
        footGrid.blocked[idx] = 1;
      }
    }
  }

  // 2. Rasterize Static World OBB Structures
  for (let i = 0; i < staticStructures.length; i++) {
    const st = staticStructures[i];
    if (st.id.endsWith('_gate')) continue;
    const isThinGateOrFence = st.id.includes('_fence_') || st.id.startsWith('gate_post_');
    rasterizeObbObstacleToNavGrid(
      footGrid,
      st.x,
      st.z,
      st.halfX,
      st.halfZ,
      st.rotY,
      isThinGateOrFence ? 0.28 : footPad,
    );
    rasterizeObbObstacleToNavGrid(
      vehicleGrid,
      st.x,
      st.z,
      st.halfX,
      st.halfZ,
      st.rotY,
      isThinGateOrFence ? 0.38 : vehiclePad,
    );
  }

  // 3. Rasterize Living Tree Trunks
  for (let i = 0; i < trees.length; i++) {
    const tr = trees[i];
    if (!tr.alive) continue;
    const trunkR = 0.88 * tr.scale;
    rasterizeCircleObstacleToNavGrid(footGrid, tr.x, tr.z, trunkR, footPad * 0.75);
    rasterizeCircleObstacleToNavGrid(vehicleGrid, tr.x, tr.z, trunkR, vehiclePad * 0.75);
  }

  // 4. Rasterize Solid Map Props (tracked tanks can climb low rocks & stacked pipes <= 1.68m!)
  for (let i = 0; i < activeMapProps.length; i++) {
    const mp = activeMapProps[i];
    if (!mp.alive || mp.category !== 'solid') continue;
    const tankCanClimb = isTankClimbableProp(mp.kind, mp.scale);
    if (mp.halfX !== undefined && mp.halfZ !== undefined) {
      rasterizeObbObstacleToNavGrid(footGrid, mp.x, mp.z, mp.halfX, mp.halfZ, mp.rotY, footPad);
      if (!tankCanClimb) {
        rasterizeObbObstacleToNavGrid(
          vehicleGrid,
          mp.x,
          mp.z,
          mp.halfX,
          mp.halfZ,
          mp.rotY,
          vehiclePad * 0.8,
        );
      }
    } else {
      rasterizeCircleObstacleToNavGrid(footGrid, mp.x, mp.z, mp.radius, footPad * 0.8);
      if (!tankCanClimb) {
        rasterizeCircleObstacleToNavGrid(vehicleGrid, mp.x, mp.z, mp.radius, vehiclePad * 0.75);
      }
    }
  }

  return { footGrid, vehicleGrid };
}

export interface AStarPageableAgent {
  id: number;
  x: number;
  z: number;
  navPath?: Array<{ x: number; z: number }>;
  navWaypointIndex?: number;
  navLastGoalX?: number;
  navLastGoalZ?: number;
  navRepathTimer?: number;
  navStuckTimer?: number;
  navLastProgressX?: number;
  navLastProgressZ?: number;
}

/**
 * Computes A* waypoint steering direction `(dirX, dirZ)` and `distToGoal` for an AI character or AI vehicle.
 */
export function computeUnitAStarSteeringDirection(
  agent: AStarPageableAgent,
  goalX: number,
  goalZ: number,
  dt: number,
  isTrackedTank: boolean,
  canFly: boolean,
  getNavGrid: (isTrackedTank: boolean) => AStarNavGrid,
  canRepathNow: () => boolean,
  onRepathExecuted: () => void,
): { dirX: number; dirZ: number; distToGoal: number } {
  const totalDx = getPlanetShortestDelta(goalX, agent.x);
  const totalDz = getPlanetShortestDelta(goalZ, agent.z);
  const distToGoal = Math.hypot(totalDx, totalDz);
  if (distToGoal < 0.001) {
    return { dirX: 0, dirZ: 0, distToGoal: 0 };
  }

  if (canFly || (distToGoal < 1.85 && (agent.navStuckTimer ?? 0) <= 0.3)) {
    return { dirX: totalDx / distToGoal, dirZ: totalDz / distToGoal, distToGoal };
  }

  if (agent.navLastProgressX === undefined || agent.navLastProgressZ === undefined) {
    agent.navLastProgressX = agent.x;
    agent.navLastProgressZ = agent.z;
    agent.navStuckTimer = 0;
  } else {
    const moved = Math.hypot(
      getPlanetShortestDelta(agent.x, agent.navLastProgressX),
      getPlanetShortestDelta(agent.z, agent.navLastProgressZ),
    );
    if (moved > 0.38) {
      agent.navLastProgressX = agent.x;
      agent.navLastProgressZ = agent.z;
      agent.navStuckTimer = 0;
    } else {
      agent.navStuckTimer = (agent.navStuckTimer ?? 0) + dt;
    }
  }

  agent.navRepathTimer = (agent.navRepathTimer ?? 0) - dt;
  const goalShift =
    agent.navLastGoalX === undefined || agent.navLastGoalZ === undefined
      ? Infinity
      : Math.hypot(goalX - agent.navLastGoalX, goalZ - agent.navLastGoalZ);
  const pathExhausted =
    !agent.navPath ||
    agent.navWaypointIndex === undefined ||
    agent.navWaypointIndex >= agent.navPath.length;
  const isStuck = (agent.navStuckTimer ?? 0) > 0.34;

  if ((goalShift > 1.85 || pathExhausted || agent.navRepathTimer <= 0 || isStuck) && canRepathNow()) {
    onRepathExecuted();
    const grid = getNavGrid(isTrackedTank);
    const aStarRes = findPathAStar(grid, agent.x, agent.z, goalX, goalZ, {
      allowDiagonal: true,
      maxIterations: 2400,
    });
    agent.navPath = aStarRes.waypoints;
    agent.navWaypointIndex = 0;
    agent.navLastGoalX = goalX;
    agent.navLastGoalZ = goalZ;
    agent.navRepathTimer = 0.42 + (agent.id % 5) * 0.06;
    if (isStuck) {
      agent.navStuckTimer = 0;
      agent.navLastProgressX = agent.x;
      agent.navLastProgressZ = agent.z;
    }
  }

  // Calibrated waypoint reach & pass-through check for +45% foot / +35% vehicle / +20% road speeds
  const waypointReachDist = isTrackedTank ? 2.45 : 1.65;
  while (
    agent.navPath &&
    agent.navWaypointIndex !== undefined &&
    agent.navWaypointIndex < agent.navPath.length - 1
  ) {
    const wp = agent.navPath[agent.navWaypointIndex];
    const wpDx = getPlanetShortestDelta(wp.x, agent.x);
    const wpDz = getPlanetShortestDelta(wp.z, agent.z);
    const wpDist = Math.hypot(wpDx, wpDz);
    const nextWp = agent.navPath[agent.navWaypointIndex + 1];
    const segX = getPlanetShortestDelta(nextWp.x, wp.x);
    const segZ = getPlanetShortestDelta(nextWp.z, wp.z);
    const passedWaypoint =
      wpDist < waypointReachDist * 1.35 && (-wpDx * segX + -wpDz * segZ) > 0;
    if (wpDist < waypointReachDist || passedWaypoint) {
      agent.navWaypointIndex++;
    } else {
      break;
    }
  }

  let steerX = goalX;
  let steerZ = goalZ;
  if (
    agent.navPath &&
    agent.navWaypointIndex !== undefined &&
    agent.navWaypointIndex < agent.navPath.length - 1
  ) {
    const wp = agent.navPath[agent.navWaypointIndex];
    steerX = wp.x;
    steerZ = wp.z;
  }

  const sdx = getPlanetShortestDelta(steerX, agent.x);
  const sdz = getPlanetShortestDelta(steerZ, agent.z);
  const sLen = Math.max(0.001, Math.hypot(sdx, sdz));
  return { dirX: sdx / sLen, dirZ: sdz / sLen, distToGoal };
}

export interface SquadAiTargetScanResult {
  ownerIdx: number;
  ownedCharCount: number;
  ownerTargetCount: number;
  nearestWoundedAlly: BuddyUnit | null;
  woundedAllyDist: number | null;
  nearestEnemy: BuddyUnit | null;
  nearestEnemyDist: number | null;
  ownerHologramPattern: PadSlotHologramPattern | null;
  inFlightCarriedCrates: Array<Exclude<WorldCrateKind, 'medical'>>;
  bestCrate: WorldCrate | null;
  nearestFreeCrateDist: number | null;
  unfilledSlotColors: Array<'red' | 'super' | 'legend'>;
  nearestWeaponPickup: WorldPickup | null;
  nearestGroundWeaponDist: number | null;
  canUpgradeFromGroundWeapon: boolean;
  freeTank: TankVehicle | null;
  nearestEmptyVehicleDist: number | null;
  aiDecision: ReturnType<typeof evaluateBuiltBuddySmartAiDecision>;
}

/**
 * Evaluates Squad AI perception & utility decision (`Harvester`, `Attacker`, `Defender`, `Follower`, `Mount`)
 * for an individual Buddy unit `b`.
 */
export function evaluateSquadAiUnitPerceptionAndDecision(params: {
  unit: BuddyUnit;
  buddyUnits: ReadonlyArray<BuddyUnit>;
  worldCrates: ReadonlyArray<WorldCrate>;
  worldPickups: ReadonlyArray<WorldPickup>;
  tanks: ReadonlyArray<TankVehicle>;
  mountedTank: TankVehicle | null;
  ridingTramCarIdx: 0 | 1 | null;
  ownerSlots: ReadonlyArray<CrateSlotType>;
  ownerHasBuiltTurret: boolean;
  buildOrder: BuildOrderTarget;
  teamCommand: TeamCommandMode;
  useCustomHologramRecipe: boolean;
  activePriorityRecipe: KioskBuildPriorityRecipeId;
  onDropWrongCarriedCrate: (dropKind: WorldCrateKind) => void;
}): SquadAiTargetScanResult {
  const {
    unit: b,
    buddyUnits,
    worldCrates,
    worldPickups,
    tanks,
    mountedTank,
    ridingTramCarIdx,
    ownerSlots,
    ownerHasBuiltTurret,
    buildOrder,
    teamCommand,
    useCustomHologramRecipe,
    activePriorityRecipe,
    onDropWrongCarriedCrate,
  } = params;

  const ownerIdx = Math.max(0, Math.min(COMMANDERS_PER_TEAM - 1, b.ownerCommanderId));
  const ownedCharCount = buddyUnits.filter(
    (u) => u.team === b.team && u.ownerCommanderId === ownerIdx && u.alive,
  ).length;
  const hasLegendOnPad = ownerSlots.some((s) => s === 'legend');
  const ownerTargetCount =
    b.team === 'blue' && ownerIdx === 0
      ? BUILD_ORDER_SPECS[buildOrder].targetCrates
      : ownedCharCount < 2
        ? 2
        : hasLegendOnPad
          ? 8
          : ownerIdx % 2 === 0
            ? 4
            : 2;

  let nearestWoundedAlly: BuddyUnit | null = null;
  let woundedAllyDist: number | null = null;
  for (let i = 0; i < buddyUnits.length; i++) {
    const u = buddyUnits[i];
    if (u.alive && u.team === b.team && u.id !== b.id && u.hp < u.maxHp * 0.78) {
      const d = getPlanetShortestDistance(u.x, u.z, b.x, b.z);
      if (woundedAllyDist === null || d < woundedAllyDist) {
        woundedAllyDist = d;
        nearestWoundedAlly = u;
      }
    }
  }

  let nearestEnemy: BuddyUnit | null = null;
  let nearestEnemyDist: number | null = null;
  for (let i = 0; i < buddyUnits.length; i++) {
    const u = buddyUnits[i];
    if (
      u.alive &&
      u.team !== b.team &&
      !(u.isPlayer && (mountedTank || ridingTramCarIdx !== null))
    ) {
      const d = getPlanetShortestDistance(u.x, u.z, b.x, b.z);
      if (nearestEnemyDist === null || d < nearestEnemyDist) {
        nearestEnemyDist = d;
        nearestEnemy = u;
      }
    }
  }

  const isPlayerMainPadOwner = b.team === 'blue' && ownerIdx === 0;
  const ownerHologramPattern: PadSlotHologramPattern | null =
    isPlayerMainPadOwner &&
    useCustomHologramRecipe &&
    KIOSK_BUILD_PRIORITY_RECIPES[activePriorityRecipe]
      ? KIOSK_BUILD_PRIORITY_RECIPES[activePriorityRecipe].slotHologramColors
      : null;

  const inFlightCarriedCrates: Array<Exclude<WorldCrateKind, 'medical'>> = [];
  for (let i = 0; i < buddyUnits.length; i++) {
    const u = buddyUnits[i];
    if (
      u.alive &&
      u.team === b.team &&
      u.ownerCommanderId === ownerIdx &&
      u.id !== b.id &&
      u.carryingCrate !== 'none' &&
      u.carryingCrate !== 'medical'
    ) {
      inFlightCarriedCrates.push(u.carryingCrate);
    }
  }

  if (b.carryingCrate === 'medical') {
    onDropWrongCarriedCrate(b.carryingCrate);
  }

  const padCratesNow = ownerSlots.filter((s) => s !== 'empty').length;
  let smartCratePick = selectSmartCrateForAiHarvester(
    b.x,
    b.z,
    worldCrates,
    ownerSlots,
    ownerHologramPattern,
    inFlightCarriedCrates,
    true,
    b.team,
    ownerIdx,
  );
  // If a custom hologram recipe is active on the pad but either all its specific slots are filled
  // or its required crate rarity hasn't dropped yet while the 8-slot pad still has open slots,
  // fall back to harvesting available non-medical crates so Harvesters never stall or act like Followers!
  if (
    smartCratePick.selectedCrate === null &&
    ownerHologramPattern !== null &&
    padCratesNow < ownerSlots.length
  ) {
    smartCratePick = selectSmartCrateForAiHarvester(
      b.x,
      b.z,
      worldCrates,
      ownerSlots,
      null,
      inFlightCarriedCrates,
      false,
      b.team,
      ownerIdx,
    );
  }
  const bestCrate: WorldCrate | null = smartCratePick.selectedCrate;
  const nearestFreeCrateDist: number | null = smartCratePick.distance;

  let nearestWeaponPickup: WorldPickup | null = null;
  let nearestGroundWeaponDist: number | null = null;
  let canUpgradeFromGroundWeapon = false;
  for (let i = 0; i < worldPickups.length; i++) {
    const pk = worldPickups[i];
    if (pk.kind === 'weapon') {
      if (isCrateInsideOtherOrEnemyBase(pk.x, pk.z, b.team, ownerIdx)) continue;
      const pkWid: 'pistol' | 'rifle' | 'rocket' =
        pk.weaponName.includes('Bazooka') ||
        pk.weaponName.includes('Supazooka') ||
        pk.weaponName.includes('Rocket') ||
        pk.weaponName.includes('Nuclear') ||
        pk.weaponName.includes('Ion') ||
        pk.weaponName.includes('Homing')
          ? 'rocket'
          : pk.weaponName.includes('Rifle') ||
              pk.weaponName.includes('Shotgun') ||
              pk.weaponName.includes('Plasma') ||
              pk.weaponName.includes('Gatling') ||
              pk.weaponName.includes('Photon') ||
              pk.weaponName.includes('Laser')
            ? 'rifle'
            : 'pistol';
      const lootCheck = canUnitLootGroundWeapon(
        b.team,
        b.weaponId === 'fishing_rod' ? 'unarmed' : b.weaponId,
        b.weaponName,
        pkWid,
        pk.weaponName,
        b.ammo,
      );
      if (!lootCheck.canLoot) continue;
      const d = getPlanetShortestDistance(pk.x, pk.z, b.x, b.z);
      if (nearestGroundWeaponDist === null || d < nearestGroundWeaponDist) {
        nearestGroundWeaponDist = d;
        nearestWeaponPickup = pk;
        canUpgradeFromGroundWeapon = lootCheck.isUpgrade;
      }
    }
  }

  const freeTank =
    tanks.find(
      (t) =>
        t.team === b.team && !t.occupiedByPlayer && t.occupiedByAiId === null && t.hp > 0,
    ) ?? null;
  const nearestEmptyVehicleDist = freeTank
    ? getPlanetShortestDistance(freeTank.x, freeTank.z, b.x, b.z)
    : null;

  const isAiCmd = !(b.team === 'blue' && ownerIdx === 0);
  const padHasMatchingSpace = isAiCmd
    ? padCratesNow < ownerTargetCount ||
      (b.carryingCrate !== 'none' && padCratesNow < ownerSlots.length)
    : padCratesNow < ownerSlots.length;
  const ownerHasBuiltVehicle = tanks.some((t) => t.team === b.team && t.hp > 0);

  const aiDecision = evaluateBuiltBuddySmartAiDecision({
    buddyClass: b.classId,
    weaponId:
      b.weaponId === 'bazooka'
        ? 'rocket'
        : b.weaponId === 'fishing_rod'
          ? 'unarmed'
          : b.weaponId,
    carryingCrate: b.carryingCrate !== 'none',
    hp: b.hp,
    maxHp: b.maxHp,
    commandMode: b.team === 'blue' && ownerIdx === 0 ? (b.assignedRole ?? teamCommand) : 'HARVEST',
    ownerBuildOrder: b.team === 'blue' && ownerIdx === 0 ? buildOrder : 'AUTO',
    ownerPadHasSpace: padHasMatchingSpace,
    ownerPadReadyToCraft:
      ownerHologramPattern !== null
        ? padCratesNow >= ownerTargetCount && smartCratePick.unfilledSlotColors.length === 0
        : padCratesNow >= ownerTargetCount,
    ownerIsAiCommander: isAiCmd,
    ownerAliveBuddyCount: ownedCharCount,
    ownerHasBuiltTurret,
    ownerHasBuiltVehicle,
    woundedAllyDist,
    nearestEnemyDist,
    nearestFreeCrateDist,
    nearestGroundWeaponDist,
    nearestEmptyVehicleDist,
    canUpgradeFromGroundWeapon,
  });

  return {
    ownerIdx,
    ownedCharCount,
    ownerTargetCount,
    nearestWoundedAlly,
    woundedAllyDist,
    nearestEnemy,
    nearestEnemyDist,
    ownerHologramPattern,
    inFlightCarriedCrates,
    bestCrate,
    nearestFreeCrateDist,
    unfilledSlotColors: smartCratePick.unfilledSlotColors,
    nearestWeaponPickup,
    nearestGroundWeaponDist,
    canUpgradeFromGroundWeapon,
    freeTank,
    nearestEmptyVehicleDist,
    aiDecision,
  };
}

/**
 * Computes the defend standby coordinates inside the owner's Personal Command Center area
 * so a squad unit assigned to `DEFEND` stands guard at its owner's Command Center and activates
 * the Personal Command Center Radar.
 */
export function getCommanderDefendStationCoords(
  team: 'blue' | 'red',
  ownerPlot: IndividualCommanderBaseState | undefined,
  fallbackPadX: number,
  fallbackPadZ: number,
): { x: number; z: number } {
  if (ownerPlot && !ownerPlot.destroyed) {
    const sign = team === 'blue' ? 1 : -1;
    return {
      x: wrapPlanetCoord(ownerPlot.buildingX),
      z: wrapPlanetCoord(ownerPlot.buildingZ - sign * 4.2),
    };
  }
  return {
    x: fallbackPadX,
    z: fallbackPadZ + (team === 'blue' ? -5.0 : 5.0),
  };
}
