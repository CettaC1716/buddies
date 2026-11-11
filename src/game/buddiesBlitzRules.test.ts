import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  BUDDIES_CONSTANTS,
  stepCriticalDampedSpring3D,
  computeTankSpeedStep,
  stepTurretYaw,
  isPowerCoreReady,
  evaluateStackingPadRecipe,
  chooseNextPadSlotIndex,
  getBuildOrderAllowedSlots,
  resolveCursorCommandTarget,
  BUDDY_CLASSES,
  getPropCollisionSpec,
  resolveSolidCollision2D,
  resolveSolidObbCollision2D,
  pointInObb2D,
  computePushableImpulse2D,
  shouldShatterBreakableProp,
  canTriggerCollisionCooldown,
  shouldPlayMoverCollisionSound,
  computeCollisionAudioParams,
  evaluateBlitzFireballState,
  evaluateBlitzSmokePuffState,
  computeMultiStageExplosionSchedule,
  DUMP_TRUCK_MAX_CRATES,
  classifyDumpTruckMeshIsland,
  canLoadCrateIntoDumpTruck,
  evaluateDumpTruckHydraulicCycle,
  stepDumpTruckWheeledPhysics,
  stepMilitaryBaseBoomBarrier,
  stepBuddyJumpPhysics,
  evaluateBuddyMeleeStrike,
  MAX_CHARACTERS_PER_COMMANDER,
  canCommanderBuildCharacter,
  getNextOwnedBuddyForSwap,
  canStartMatchmaking4v4,
  createMatchmaking4v4State,
  hotJoinReplaceAiCommander,
  evaluateBuiltBuddySmartAiDecision,
  AStarBinaryHeap,
  computeManhattanHeuristic,
  computeOctileHeuristic,
  createAStarNavGrid,
  rasterizeObbObstacleToNavGrid,
  rasterizeCircleObstacleToNavGrid,
  findPathAStar,
  evaluateBlitzHitReactionPose,
  evaluateBlitzStunEffectState,
  evaluateBlitzTankShotRecoilPose,
  evaluateBlitzEmissiveHitFlash,
  RAYCAST_MAX_DISTANCE,
  RAYCAST_LAYERS,
  RaycastCollider3D,
  castMuzzleRaycast3D,
  getWeaponProjectileVisualSpec,
  DEFAULT_BULLET_LANE_POOL_SIZE,
  POOL_PEAK_CAPACITIES,
  createFixedObjectPool,
  simulatePooledVsUnpooledBulletLane,
  resolveSolidCratePush2D,
  resolveCrateVsCrateCollision2D,
  CITY_TRAM_SPEC,
  sampleCityTramTrackAtDistance,
  evaluateCityTramConsistState,
  INDIVIDUAL_BASE_LEVEL_SPECS,
  BASE_SKIN_THEMES,
  BASE_GARDEN_PRESETS,
  createIndividualCommanderBasesState,
  applyCommanderBaseUpgrade,
  isTeamAllBasesDestroyed,
  canUnitBoardCityTramAtAnyPoint,
  computeCityTramDisembarkPosition,
  canUnitEnterCommanderBaseGate,
  stepCommanderSlidingGate,
  TEAM_BUDDIES_WEAPON_DESPAWN_SEC,
  TEAM_BUDDIES_DESPAWN_BLINK_WINDOW_SEC,
  TEAM_BUDDIES_CRAFTED_WEAPON_DESPAWN_SEC,
  TEAM_BUDDIES_STACKING_PATTERNS,
  TEAM_BUDDIES_CRATE_SCHEMES,
  evaluateTeamBuddiesDeathDrops,
  evaluateDroppedItemDespawnState,
  evaluateCrateDestructionDrop,
  evaluateSplashDamageOnDroppedItem,
  computeStackingPadWeaponPopOutTrajectory,
  getBuddyWeaponTierRank,
  canUnitLootGroundWeapon,
  doesCraftedEntityDespawnByTimer,
  canBuddyUnitRespawnAtBase,
  canPadSlotsBirthNewBuddy,
  isTeamEliminatedInDeathmatch,
  evaluateTeamBuddiesDeathmatchWinCondition,
  KIOSK_BUILD_PRIORITY_RECIPES,
  getHologramSlotHexColor,
  chooseNextPadSlotIndexForHologram,
  evaluatePadHologramState,
  selectSmartCrateForAiHarvester,
  getCommanderBaseGoldUpgradeSpecs,
  applyCommanderBaseGoldUpgrade,
  KIOSK_CRATE_AIRDROP_SHOP,
  purchaseCrateAirdropWithGold,
  GRASS_CHUNK_STREAM_RADIUS,
  GRASS_CHUNK_FADE_START_RADIUS,
  LAND_MINE_GRASS_Y_OFFSET,
  evaluateGrassChunkVisibilityFactor,
  computeLandMineGrassYOffset,
  isUnitInPersonalCommandCenterArea,
  evaluatePersonalCommandCenterRadarOperator,
  evaluateCommandCenterRadarSpec,
  worldCoordToRadarPercent,
  isPointVisibleOnCommandCenterRadar,
  evaluateNuclearLauncherAccess,
  evaluateClusterBombAccess,
  createInitialNuclearStrikeState,
  beginNuclearStrikeTargeting,
  updateNuclearStrikeTargetCursor,
  confirmNuclearStrikeTargetAndLaunch,
  stepNuclearStrikeSequence,
  computeNuclearStrikeCameraPose,
  SUPPLY_DROP_LOCATIONS,
  computeNextSupplyDropIntervalSec,
  formatSupplyDropCountdownBanner,
  createInitialSupplyDropScheduleState,
  generateSupplyDropLandingPayload,
  stepSupplyDropSchedule,
  canDamageWorldCrate,
  evaluateSpecialMetallicCratePadBoost,
  formatBuddyRoleUiLabel,
  evaluateAutonomousFollowerEscortStep,
  MAX_KIOSK_BUILD_QUEUE,
  enqueueKioskBuildRecipe,
  removeKioskBuildQueueAtIndex,
  advanceKioskBuildQueueOnCraft,
  isCrateInsideOtherOrEnemyBase,
  evaluateKioskSideHologramDisplay,
  evaluatePadCancelKickShatterDrops,
  TANK_MAX_CLIMBABLE_OBSTACLE_HEIGHT,
  getTankClimbableObstacleVerticalHeight,
  isTankClimbableProp,
  evaluateTankClimbableObstacleElevation,
  UNIFIED_WORLD_CRATE_SIZE,
  BUILD_ORDER_SPECS,
  JUMP_BUFFER_DURATION_SEC,
  stepBuddyJumpPhysicsWithBuffer,
  PLAYER_INVINCIBILITY_DURATION_SEC,
  PLAYER_INVINCIBILITY_BLINK_HZ,
  stepPlayerInvincibilityState,
  applyPlayerDamageWithInvincibilityAndKnockback,
  evaluateAiRangedCombatStandoffBehavior,
  MAX_HANDHELD_WEAPON_SLOTS,
  MAX_TACTICAL_ITEM_SLOTS,
  createInitialBuddyTacticalLoadout,
  equipOrSwapDroppedWeaponInLoadout,
  selectHandheldWeaponInLoadout,
  consumeActiveWeaponAmmoOnShot,
  refillLoadoutAmmoFromSource,
  addTacticalSecondaryToLoadout,
  consumeTacticalSecondaryInLoadout,
  getVisibleHudWeaponAndTacticalBadges,
  WARZONE_EXPLOSIVE_BARREL_DROP_INTERVAL_SEC,
  MAX_ACTIVE_WARZONE_EXPLOSIVE_BARRELS,
  stepWarzoneExplosiveBarrelDropTimer,
  INFANTRY_SPEED_BOOST_FACTOR,
  PLAYER_BASE_FOOT_SPEED,
  AI_BASE_FOOT_SPEED,
  CRATE_CARRY_SPEED_MULTIPLIER,
  VEHICLE_SPEED_AND_ACCEL_BOOST_FACTOR,
  AI_TANK_BASE_DRIVE_SPEED,
  ROAD_SPEED_BOOST_MULTIPLIER,
  evaluateRoadSurfaceSpeedBoost,
  computeBuddyFootMoveSpeed,
  stepBlitzTankTrackedPhysics,
  computeSynchronizedWalkCycleStep,
  computeAiPathfindingMovementStep,
  shouldEmitRoadSpeedBoostParticles,
  LASER_BEAM_MAX_DISTANCE,
  LASER_CORE_RADIUS,
  LASER_OUTER_GLOW_RADIUS,
  computeContinuousLaserMuzzleTransform,
  evaluateContinuousLaserBeamStep,
  MODEL_ESTATE_BASE_PLOT_SPEC,
  isIntactModelEstateBasePlot,
  isCommanderBasePlotActive,
  LOBBY_SAFEZONE_BOUNDS,
  LOBBY_FACTION_PORTALS,
  LOBBY_NEAR_TERMINAL_SPEC,
  LOBBY_TRAM_SHELTER_SPEC,
  LOBBY_TRAM_RETURN_PADS,
  PUBLIC_WARZONE_CRATE_PADS,
  isPointInsideLobbySafezone,
  getUnitFootRingTeamColor,
  evaluateLobbyFactionPortalStep,
  evaluateLobbyTramReturnPadStep,
  isUnitNearLobbyTramReturnPad,
  canApplyCombatDamage,
  createInitialNearGamepassSessionState,
  connectNearWalletAndMintGamepass,
  claimEmptyBasePlotWithNearGamepass,
  releaseClaimedOnlineSessionBase,
  PLAYER_WARZONE_MAX_HP,
  PLAYER_WARZONE_MAX_LIVES,
  MAX_HARVESTERS_PER_BASE,
  OPEN_WARZONE_TEAM_CAPACITY,
  formatWarzoneLivesHudLabel,
  evaluatePlayerWarzoneDeathStep,
  evaluateContractHarvesterLifecycle,
  computeHarvesterBaseStandbyPosition,
  LOBBY_GOLD_EXCHANGE_SPEC,
  LOBBY_GOLD_EXCHANGE_CATALOG,
  redeemLobbyGoldExchangeItem,
  evaluateOpenWarzonePopulationBar,
  PUBLIC_PAD_SHIELD_RADIUS,
  getPublicWarzoneCratePadsForTeam,
  evaluatePublicPadShieldZone,
  isUnitWeaponTriggerLockedInSafeShield,
  resolveEnemyPublicPadShieldBarrier2D,
  pickRandomTeamShieldedCratePadSpawn,
  computeTeamMirrorCameraPose,
  computeCameraRelativeMovementVector,
  SAFEZONE_CITY_HALTE_SPAWN,
  evaluateCitySafezoneModeRules,
  findCityTramLeadDistanceNearHalte,
  setSafezonePlotAccessMode,
  addSafezonePlotFriend,
  removeSafezonePlotFriend,
  canUnitEnterSafezonePlotGate,
  evaluateLobbyAndSafezonePeacefulState,
  evaluatePlayerGhostMovementGuard,
  DYNAMIC_CHUNK_CULLING_OUTER_RADIUS,
  DYNAMIC_CHUNK_CULLING_FADE_START_RADIUS,
  PLAYER_SPAWN_BLINK_DURATION_SEC,
  evaluateChunkSynced3DFogOfWar,
} from './buddiesBlitzRules';
import { applyGrassChunkSyncedFogOfWar3D } from './buddiesBlitzMinimap';
import {
  buildStaticWorldStructuresList,
  getPropBaseHeight,
  HALTE_GOLDEN_SCALE_CONFIG,
} from './buddiesBlitzWorldBuilder';
import {
  evaluateRoadNetworkSdf,
  evaluateBlitzGrassMask,
  isPointOnAsphaltRoadOrZebraCross,
  getBaseProceduralGroundElevation,
} from './buddiesPlanetCurvature';
import {
  computeExplosionDucking,
  getTacticalAudioSpec,
  computeSpatialAudioGain,
  isListenerInsideBasePerimeter,
  computeBuildBoxAudioGain,
  soundEngine,
} from './audio';

test('Core camera and physics constants match low-angle horizon chase camera targets', () => {
  assert.equal(BUDDIES_CONSTANTS.camera.fov, 42);
  assert.equal(BUDDIES_CONSTANTS.camera.pseudoOrthoFov, 18);
  assert.deepEqual(BUDDIES_CONSTANTS.camera.chaseOffset, { x: 0, y: 5.2, z: 12.5 });
  assert.equal(BUDDIES_CONSTANTS.camera.chaseLookAtYOffset, 2.4);
  assert.deepEqual(BUDDIES_CONSTANTS.camera.defaultAngleOffset, { x: 4, y: 14, z: 8 });
  assert.equal(BUDDIES_CONSTANTS.physics.drive.speed, 10.8);
  assert.equal(BUDDIES_CONSTANTS.physics.drive.boostMultiplier, 1.9);
  assert.equal(BUDDIES_CONSTANTS.physics.drive.boostMaxSpeed, 20.52);
  assert.equal(BUDDIES_CONSTANTS.physics.drive.rotationSpeed, 4.212);
  assert.equal(BUDDIES_CONSTANTS.physics.cannon.projectileSpeed, 55.0);
  assert.equal(BUDDIES_CONSTANTS.shadersAndLighting.outline.strokeWidth, 0.018);

  // Sunny Morning Bossa (city) & Chill Beat Bossa (warzone) mode switching
  assert.equal(soundEngine.getBgmMode(), 'city');
  soundEngine.setBgmMode('warzone');
  assert.equal(soundEngine.getBgmMode(), 'warzone');
  soundEngine.setBgmMode('city');
  assert.equal(soundEngine.getBgmMode(), 'city');
  soundEngine.stopBgm();
  assert.equal(BUDDIES_CONSTANTS.shadersAndLighting.outline.strokeColor, '#17110f');
});

test('computeTankSpeedStep accelerates on boost and decays 10x faster on release', () => {
  const boosted = computeTankSpeedStep(10.8, true, 0.5);
  assert.ok(boosted > 10.8 && boosted <= 20.52);

  const maxed = computeTankSpeedStep(10.8, true, 2.0);
  assert.equal(maxed, 20.52);

  const decayed = computeTankSpeedStep(20.52, false, 0.05);
  assert.ok(decayed < 20.52 && decayed >= 10.8);
});

test('stepCriticalDampedSpring3D converges smoothly toward target and snaps beyond 6m', () => {
  const step1 = stepCriticalDampedSpring3D(
    { x: 0, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    8.0,
    0.016,
  );
  assert.ok(step1.position.x > 0 && step1.position.x < 2);
  assert.ok(step1.velocity.x > 0);

  // Beyond 6m (distanceSq > 36), snaps directly to target
  const snapped = stepCriticalDampedSpring3D(
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
    { x: 5, y: 0, z: 0 },
    8.0,
    0.016,
  );
  assert.equal(snapped.position.x, 10);
  assert.equal(snapped.velocity.x, 0);
});

test('stepTurretYaw interpolates across shortest angle wrap', () => {
  const next = stepTurretYaw(0, Math.PI / 2, 0.016);
  assert.ok(next > 0 && next < Math.PI / 2);
});

test('isPowerCoreReady triggers when all 4 factory parts are collected', () => {
  assert.equal(isPowerCoreReady(3, 4), false);
  assert.equal(isPowerCoreReady(4, 4), true);
});

test('evaluateStackingPadRecipe evaluates 1..8 crate stacks, Merged Crates, and Super Crate upgrade', () => {
  const singleRed = evaluateStackingPadRecipe([
    'red',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
  ]);
  assert.equal(singleRed.totalCrates, 1);
  assert.equal(singleRed.isMerged, false);
  assert.equal(singleRed.isSuper, false);
  assert.equal(singleRed.shapeKey, '1x1x1');
  assert.equal(singleRed.category, 'lite_weapon');

  const verticalBuddySuper = evaluateStackingPadRecipe([
    'red',
    'empty',
    'empty',
    'empty',
    'super',
    'empty',
    'empty',
    'empty',
  ]);
  assert.equal(verticalBuddySuper.totalCrates, 2);
  assert.equal(verticalBuddySuper.isMerged, true);
  assert.equal(verticalBuddySuper.isSuper, true);
  assert.equal(verticalBuddySuper.shapeKey, '1x1x2');
  assert.equal(verticalBuddySuper.category, 'buddy_t1');
  assert.equal(verticalBuddySuper.spawnType, 'buddy');

  const fullCubeSuperTank = evaluateStackingPadRecipe([
    'red',
    'red',
    'red',
    'red',
    'red',
    'red',
    'red',
    'super',
  ]);
  assert.equal(fullCubeSuperTank.totalCrates, 8);
  assert.equal(fullCubeSuperTank.isMerged, true);
  assert.equal(fullCubeSuperTank.isSuper, true);
  assert.equal(fullCubeSuperTank.shapeKey, '2x2x2');
  assert.equal(fullCubeSuperTank.outputName, 'Tyrant Tank');
});

test('BUDDY_CLASSES defines all 7 Team Buddies classes with Ninja Katana crate slicer', () => {
  assert.equal(Object.keys(BUDDY_CLASSES).length, 7);
  assert.equal(BUDDY_CLASSES.Ninja.canSliceMergedCrates, true);
  assert.equal(BUDDY_CLASSES.Cyborg.vehicleResistant, true);
  assert.equal(BUDDY_CLASSES.SuperBuddie.canFly, true);
});

test('chooseNextPadSlotIndex strictly enforces [Q] build order slots and stops when pattern is full', () => {
  const oneCrate = ['red', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'] as const;
  assert.equal(chooseNextPadSlotIndex(oneCrate, '1x1x1'), -1);
  assert.equal(chooseNextPadSlotIndex(oneCrate, '2x1x1'), 1);
  assert.equal(chooseNextPadSlotIndex(oneCrate, '1x1x2'), 4);
  assert.equal(chooseNextPadSlotIndex(oneCrate, '2x2x1'), 1);
  assert.deepEqual(getBuildOrderAllowedSlots('2x1x2'), [0, 1, 4, 5]);
});

test('resolveCursorCommandTarget maps cursor crosshair onto Crate, Enemy, Base, or Tank orders', () => {
  const baseInput = {
    crates: [{ x: 0, z: 0 }],
    enemies: [{ x: 2, z: -15 }],
    emptyTanks: [{ x: -4, z: 14 }],
    blueBase: { x: 0, z: 22, padX: -6.2, padZ: 16.5 },
    redBase: { x: 0, z: -22, padX: 6.2, padZ: -16.5 },
    currentCommand: 'HARVEST' as const,
  };

  assert.equal(
    resolveCursorCommandTarget({ ...baseInput, cursorX: 0.5, cursorZ: 0.5 }).command,
    'HARVEST',
  );
  assert.equal(
    resolveCursorCommandTarget({ ...baseInput, cursorX: 2.2, cursorZ: -14.8 }).command,
    'ATTACK',
  );
  assert.equal(
    resolveCursorCommandTarget({ ...baseInput, cursorX: 0, cursorZ: 21 }).command,
    'DEFEND',
  );
  assert.equal(
    resolveCursorCommandTarget({ ...baseInput, cursorX: -4, cursorZ: 14 }).command,
    'MOUNT',
  );
});

test('getPropCollisionSpec classifies solid, pushable, and breakable Blitz props accurately', () => {
  const giantTank = getPropCollisionSpec('giant_tank', 1.0);
  assert.equal(giantTank.category, 'solid');
  assert.equal(giantTank.materialTag, 'metal');

  const tree = getPropCollisionSpec('tree_purple', 1.0);
  assert.equal(tree.category, 'solid');
  assert.equal(tree.materialTag, 'tree');

  const wheelbarrow = getPropCollisionSpec('wheelbarrow', 1.0);
  assert.equal(wheelbarrow.category, 'pushable');
  assert.equal(wheelbarrow.materialTag, 'metal');

  const barricade = getPropCollisionSpec('barricade', 1.0);
  assert.equal(barricade.category, 'pushable');
  assert.equal(barricade.materialTag, 'wood');
  assert.equal(barricade.destructible, true);

  const barrel = getPropCollisionSpec('explosive_barrel', 1.0);
  assert.equal(barrel.category, 'breakable');
  assert.equal(barrel.destructible, true);
});

test('resolveSolidCollision2D prevents penetration, slides along tangent, and bounces velocity', () => {
  const res = resolveSolidCollision2D(
    1.2,
    0,
    -10,
    4,
    0.8,
    0,
    0,
    1.0,
    0.4,
  );
  assert.equal(res.collided, true);
  // Pushed outside minDist (0.8 + 1.0 = 1.8)
  assert.ok(Math.hypot(res.x, res.z) >= 1.8);
  // Normal velocity reflected positive, tangential velocity preserved with slight slide friction
  assert.ok(res.vx > 0);
  assert.ok(res.vz > 3.0);
  assert.ok(res.impactSpeed >= 10);
});

test('computePushableImpulse2D transfers momentum and angular impulse to pushable props', () => {
  const res = computePushableImpulse2D(
    0,
    0,
    12,
    0,
    1.4,
    12,
    1.8,
    0.2,
    0,
    0,
    0.9,
    2.0,
    0.5,
  );
  assert.equal(res.collided, true);
  assert.ok(res.propVx > 8);
  assert.ok(res.impactSpeed > 10);
  assert.notEqual(res.angularImpulse, 0);
});

test('shouldShatterBreakableProp and canTriggerCollisionCooldown enforce shatter & 100ms cooldown', () => {
  assert.equal(shouldShatterBreakableProp('barricade', 4.0, true, 25), false);
  assert.equal(shouldShatterBreakableProp('barricade', 11.5, true, 25), true);
  assert.equal(shouldShatterBreakableProp('explosive_barrel', 8.0, true, 18), true);

  assert.equal(canTriggerCollisionCooldown(undefined, 1.0, 0.1), true);
  assert.equal(canTriggerCollisionCooldown(1.0, 1.05, 0.1), false);
  assert.equal(canTriggerCollisionCooldown(1.0, 1.12, 0.1), true);

  const audioLow = computeCollisionAudioParams(1.5, 0.5);
  const audioHigh = computeCollisionAudioParams(14.0, 0.5);
  assert.ok(audioHigh.volume > audioLow.volume);
  assert.ok(audioLow.playbackRate >= 0.9 && audioHigh.playbackRate <= 1.15);

  // Character on foot (`isVehicle = false`) stays silent on large/hard static objects (`isSmallPushable = false`),
  // and ONLY plays collision audio when pushing/sliding small movable objects (`isSmallPushable = true`)
  assert.equal(shouldPlayMoverCollisionSound(false, false, true, 5.0, 0.8), false);
  assert.equal(shouldPlayMoverCollisionSound(false, true, true, 2.5, 0.65), true);
  assert.equal(shouldPlayMoverCollisionSound(true, false, true, 5.0, 0.8), true);
});

test('evaluateBlitzFireballState and evaluateBlitzSmokePuffState match Blitz toon color ramps and expansion', () => {
  const fbStart = evaluateBlitzFireballState(0.0, 0.42, 1.0);
  const fbMid = evaluateBlitzFireballState(0.15, 0.42, 1.0);
  const fbEnd = evaluateBlitzFireballState(0.42, 0.42, 1.0);
  assert.equal(fbStart.colorHex, '#fff7c2');
  assert.ok(fbMid.radiusScale > fbStart.radiusScale * 2.5);
  assert.equal(fbEnd.colorHex, '#d92b2b');
  assert.equal(fbEnd.opacity, 0);

  const smokeStart = evaluateBlitzSmokePuffState(0.0);
  const smokeEnd = evaluateBlitzSmokePuffState(1.0);
  assert.equal(smokeStart.colorHex, '#ff7b00');
  assert.equal(smokeEnd.colorHex, '#3a3f4d');
  assert.equal(smokeEnd.opacity, 0);

  const schedule = computeMultiStageExplosionSchedule(4, 2.5);
  assert.equal(schedule.length, 4);
  assert.equal(schedule[0].delaySec, 0);
  assert.ok(schedule[3].delaySec > schedule[0].delaySec);
  assert.ok(schedule[3].scale > schedule[0].scale);
});

test('classifyDumpTruckMeshIsland removes concrete pipes and separates hydraulic vessel, tailgate, and 4 wheels', () => {
  // 3 Concrete pipes inside the cargo bed (tris=280)
  assert.equal(
    classifyDumpTruckMeshIsland(280, -0.69, 0.7, 0.4, 1.56, 1.89, 3.06),
    'pipe_remove',
  );
  assert.equal(
    classifyDumpTruckMeshIsland(280, -0.68, 0.71, -0.74, 0.42, 2.13, 3.3),
    'pipe_remove',
  );
  assert.equal(
    classifyDumpTruckMeshIsland(280, -0.7, 0.69, -0.36, 0.8, 1.01, 2.18),
    'pipe_remove',
  );

  // Main black dump vessel (tris=490) & rear tailgate (tris=26)
  assert.equal(
    classifyDumpTruckMeshIsland(490, -1.2, 1.2, -1.01, 1.09, -0.02, 4.26),
    'vessel',
  );
  assert.equal(
    classifyDumpTruckMeshIsland(26, -1.11, 1.11, 0.03, 1.03, 0.0, 0.2),
    'tailgate',
  );

  // 4 Rotating Wheels & Truck Cab
  assert.equal(
    classifyDumpTruckMeshIsland(1004, 0.82, 1.35, -2.04, -0.82, 4.17, 5.39),
    'wheel_fl',
  );
  assert.equal(
    classifyDumpTruckMeshIsland(1004, -1.35, -0.83, -2.04, -0.82, 0.68, 1.9),
    'wheel_rr',
  );
  assert.equal(
    classifyDumpTruckMeshIsland(432, -1.17, 1.16, -1.47, 0.89, 3.9, 6.46),
    'chassis',
  );
});

test('canLoadCrateIntoDumpTruck enforces 4-crate limit, blocks loading during hydraulic dump, and requires manual character loading one-by-one', () => {
  assert.equal(DUMP_TRUCK_MAX_CRATES, 4);
  assert.equal(canLoadCrateIntoDumpTruck(0, false, true), true);
  assert.equal(canLoadCrateIntoDumpTruck(3, false, true), true);
  assert.equal(canLoadCrateIntoDumpTruck(4, false, true), false);
  assert.equal(canLoadCrateIntoDumpTruck(2, true, true), false);
  // Automatic truck drive-over scoop is disabled (character must load one-by-one):
  assert.equal(canLoadCrateIntoDumpTruck(0, false, false), false);
});

test('evaluateDumpTruckHydraulicCycle animates lifting, peak crate release, and lowering back to idle', () => {
  const idle = evaluateDumpTruckHydraulicCycle(0, 1.45);
  assert.equal(idle.phase, 'idle');
  assert.equal(idle.vesselTiltRad, 0);

  const lifting = evaluateDumpTruckHydraulicCycle(0.3, 1.45);
  assert.equal(lifting.phase, 'lifting');
  assert.ok(lifting.vesselTiltRad > 0.2 && lifting.vesselTiltRad < 0.76);
  assert.ok(lifting.pistonExtension > 0.3);
  assert.equal(lifting.shouldReleaseCrates, false);

  const dumping = evaluateDumpTruckHydraulicCycle(0.7, 1.45);
  assert.equal(dumping.phase, 'dumping');
  assert.ok(dumping.vesselTiltRad >= 0.72);
  assert.ok(dumping.tailgateOpenRad > 0.7);
  assert.equal(dumping.shouldReleaseCrates, true);

  const lowering = evaluateDumpTruckHydraulicCycle(1.15, 1.45);
  assert.equal(lowering.phase, 'lowering');
  assert.ok(lowering.vesselTiltRad > 0 && lowering.vesselTiltRad < 0.6);

  const done = evaluateDumpTruckHydraulicCycle(1.45, 1.45);
  assert.equal(done.phase, 'idle');
  assert.equal(done.vesselTiltRad, 0);
  assert.equal(done.finished, true);
});

test('stepDumpTruckWheeledPhysics uses Ackermann wheeled steering (no tank pivot spin when stationary, curves only when rolling)', () => {
  // 1. Stationary truck: pressing steer turns front wheels (steerAngle > 0), but hullYaw does NOT spin in place!
  const stationaryTurn = stepDumpTruckWheeledPhysics(
    { forwardSpeed: 0, steerAngle: 0, hullYaw: 0 },
    { throttle: 0, steer: 1, boost: false },
    0.05,
  );
  assert.ok(stationaryTurn.steerAngle > 0.1, 'Front wheels should turn left');
  assert.equal(stationaryTurn.yawRate, 0, 'Stationary truck must not pivot-spin in place like a tank');
  assert.equal(stationaryTurn.hullYaw, 0, 'Hull yaw must remain 0 when stationary');

  // 2. Rolling forward + steering left: curves smoothly with positive yawRate and squat pitch
  const rollingForward = stepDumpTruckWheeledPhysics(
    { forwardSpeed: 8.5, steerAngle: 0.4, hullYaw: 0 },
    { throttle: 1, steer: 1, boost: false },
    0.05,
  );
  assert.ok(rollingForward.forwardSpeed > 8.5, 'Should accelerate forward');
  assert.ok(rollingForward.yawRate > 0.5, 'Should turn left along Ackermann arc while moving forward');
  assert.ok(rollingForward.hullYaw > 0, 'Hull yaw should advance while rolling');
  assert.ok(rollingForward.bodyPitchRad < 0, 'Accelerating should squat rear suspension');

  // 3. Coasting when throttle = 0: smoothly decelerates by rolling resistance instead of instant stop
  const coasting = stepDumpTruckWheeledPhysics(
    { forwardSpeed: 10.0, steerAngle: 0.25, hullYaw: 0.2 },
    { throttle: 0, steer: 0, boost: false },
    0.05,
  );
  assert.ok(coasting.forwardSpeed > 9.5 && coasting.forwardSpeed < 10.0, 'Should coast smoothly on tires');
  assert.ok(coasting.steerAngle < 0.25, 'Front wheels should self-center when steer is released');

  // 4. Reversing + steering left: inverts yawRate naturally like a real wheeled truck backing up
  const reversing = stepDumpTruckWheeledPhysics(
    { forwardSpeed: -4.5, steerAngle: 0.4, hullYaw: 0 },
    { throttle: -1, steer: 1, boost: false },
    0.05,
  );
  assert.ok(reversing.yawRate < -0.3, 'Reversing with left steer should swing nose right (negative yawRate)');
});

test('stepMilitaryBaseBoomBarrier opens to 90 degrees when a unit is within 8m of the gate and closes when clear', () => {
  // 1. Unit far away (12m > 8m): barrier stays closed at 0 rad
  const closed = stepMilitaryBaseBoomBarrier(0, 12.0, 0.05);
  assert.equal(closed.isOpen, false);
  assert.equal(closed.angleRad, 0);

  // 2. Unit approaches within 5.5m (< 8m): barrier smoothly lifts upward toward 90 deg (Math.PI / 2)
  let angle = 0;
  for (let i = 0; i < 30; i++) {
    const step = stepMilitaryBaseBoomBarrier(angle, 5.5, 0.05);
    assert.equal(step.isOpen, true);
    angle = step.angleRad;
  }
  assert.ok(angle > 1.5, 'Boom barrier should reach near 90 degrees when unit stays within 8m');

  // 3. Unit leaves (14m > 8m): barrier smoothly lowers back toward 0 rad
  const lowering = stepMilitaryBaseBoomBarrier(angle, 14.0, 0.1);
  assert.equal(lowering.isOpen, false);
  assert.ok(lowering.angleRad < angle, 'Boom barrier should lower when no unit is within 8m');
});

test('stepBuddyJumpPhysics launches character upward on jump, scales with class/crate, and lands cleanly', () => {
  // 1. Trigger jump from ground
  const launch = stepBuddyJumpPhysics(0, 0, true, true, 1.0, false, 0.05);
  assert.equal(launch.justJumped, true);
  assert.equal(launch.isGrounded, false);
  assert.ok(launch.jumpOffset > 0.35, 'Character should lift off the ground immediately');
  assert.ok(launch.vy > 7.5, 'Vertical velocity should be positive on jump');

  // 2. Carrying a crate reduces initial jump impulse slightly (0.86x)
  const crateLaunch = stepBuddyJumpPhysics(0, 0, true, true, 1.0, true, 0.05);
  assert.ok(crateLaunch.jumpOffset < launch.jumpOffset, 'Carrying a crate should slightly lower jump height');

  // 3. Simulate full jump arc until touchdown
  let offset = launch.jumpOffset;
  let vy = launch.vy;
  let grounded: boolean = launch.isGrounded;
  let peakHeight = offset;
  let landed = false;
  for (let i = 0; i < 40; i++) {
    const step = stepBuddyJumpPhysics(offset, vy, grounded, false, 1.0, false, 0.03);
    offset = step.jumpOffset;
    vy = step.vy;
    grounded = step.isGrounded;
    if (offset > peakHeight) peakHeight = offset;
    if (step.justLanded) {
      landed = true;
      break;
    }
  }
  assert.ok(peakHeight > 1.5 && peakHeight < 2.2, `Expected peak jump height ~1.77m, got ${peakHeight}`);
  assert.equal(landed, true, 'Character should land back on the ground');
  assert.equal(offset, 0);
  assert.equal(grounded, true);
});

test('evaluateBuddyMeleeStrike resolves Team Buddies unarmed punches and front kicks with knockback', () => {
  // Character at (0, 0) facing East (yaw = 0 -> fwd = (+1, 0))
  // 1. Unarmed punch against enemy 1.8m in front
  const punchHit = evaluateBuddyMeleeStrike(0, 0, 0, 1.8, 0.2, 0.65, 'punch');
  assert.equal(punchHit.hit, true);
  assert.equal(punchHit.damage, 8);
  assert.ok(punchHit.knockbackVx > 6.5, 'Punch should knock target forward along facing direction');

  // 2. Unarmed punch misses target behind character (-1.6m)
  const punchBehind = evaluateBuddyMeleeStrike(0, 0, 0, -1.6, 0, 0.65, 'punch');
  assert.equal(punchBehind.hit, false);

  // 3. Team Buddies front kick punts crate 2.2m in front with strong forward velocity & upward hop
  const kickCrate = evaluateBuddyMeleeStrike(0, 0, 0, 2.2, 0, 0.65, 'kick');
  assert.equal(kickCrate.hit, true);
  assert.equal(kickCrate.damage, 14);
  assert.ok(kickCrate.knockbackVx > 15.0, 'Kick should launch crate at high speed');
  assert.ok(kickCrate.upwardHopVy > 4.5, 'Kick should impart upward hop impulse');
});

test('evaluateStackingPadRecipe supports Skyshield Turret (2x1x1 Rare), Dump Truck (2x2x1), and Legend Fighter Plane (2x2x2 Legend)', () => {
  // 2x1x1 with Rare ('super') crate -> Skyshield 35mm Turret
  const skyshieldRecipe = evaluateStackingPadRecipe([
    'red',
    'super',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
  ]);
  assert.equal(skyshieldRecipe.shapeKey, '2x1x1');
  assert.equal(skyshieldRecipe.spawnType, 'skyshield');
  assert.equal(skyshieldRecipe.outputName, 'Skyshield 35mm Turret');

  // 2x2x1 (4 flat crates) -> Blitz Dump Truck
  const dumpTruckRecipe = evaluateStackingPadRecipe([
    'red',
    'red',
    'red',
    'red',
    'empty',
    'empty',
    'empty',
    'empty',
  ]);
  assert.equal(dumpTruckRecipe.shapeKey, '2x2x1');
  assert.equal(dumpTruckRecipe.spawnType, 'truck');
  assert.equal(dumpTruckRecipe.outputName, 'Blitz Dump Truck');

  // 2x2x2 with Legend ('legend') crate -> Blitz Fighter Plane
  const legendPlaneRecipe = evaluateStackingPadRecipe([
    'red',
    'red',
    'red',
    'red',
    'red',
    'red',
    'super',
    'legend',
  ]);
  assert.equal(legendPlaneRecipe.shapeKey, '2x2x2');
  assert.equal(legendPlaneRecipe.isLegend, true);
  assert.equal(legendPlaneRecipe.spawnType, 'plane');
  assert.equal(legendPlaneRecipe.outputName, 'Blitz Fighter Plane');
});

test('getNextOwnedBuddyForSwap strictly swaps ONLY among characters built/owned by the same player (max 4 per commander)', () => {
  assert.equal(MAX_CHARACTERS_PER_COMMANDER, 4);
  assert.equal(canCommanderBuildCharacter(3), true);
  assert.equal(canCommanderBuildCharacter(4), false);

  const squad = [
    { id: 'blue-p1-0', team: 'blue' as const, ownerCommanderId: 0, hp: 100 },
    { id: 'blue-p2-0', team: 'blue' as const, ownerCommanderId: 1, hp: 100 },
    { id: 'blue-p1-1', team: 'blue' as const, ownerCommanderId: 0, hp: 100 },
    { id: 'blue-p3-0', team: 'blue' as const, ownerCommanderId: 2, hp: 100 },
    { id: 'blue-p1-dead', team: 'blue' as const, ownerCommanderId: 0, hp: 0 },
  ];

  // Player 1 (commanderId = 0) pressing [Tab] must ONLY cycle between blue-p1-0 and blue-p1-1, never hijacking P2 or P3!
  const swap1 = getNextOwnedBuddyForSwap(squad, 'blue', 0, 'blue-p1-0');
  assert.equal(swap1?.id, 'blue-p1-1');

  const swap2 = getNextOwnedBuddyForSwap(squad, 'blue', 0, 'blue-p1-1');
  assert.equal(swap2?.id, 'blue-p1-0');
});

test('4v4 Online Matchmaking starts at min 2v2 (4 players) with AI bots and supports live Hot-Join AI replacement', () => {
  assert.equal(canStartMatchmaking4v4(1, 2), false);
  assert.equal(canStartMatchmaking4v4(2, 2), true);

  const lobby = createMatchmaking4v4State(2, 2);
  assert.equal(lobby.matchStarted, true);
  assert.equal(lobby.blueCommanders.filter((c) => c.controller === 'human').length, 2);
  assert.equal(lobby.blueCommanders.filter((c) => c.controller === 'ai').length, 2);
  assert.equal(lobby.redCommanders.filter((c) => c.controller === 'human').length, 2);
  assert.equal(lobby.redCommanders.filter((c) => c.controller === 'ai').length, 2);

  // Hot-join a new human player into Blue team -> immediately replaces P3 [AI Bot] (commanderId = 2)
  const hot1 = hotJoinReplaceAiCommander(lobby, 'blue', 42.5);
  assert.equal(hot1.replacedSlot?.team, 'blue');
  assert.equal(hot1.replacedSlot?.commanderId, 2);
  assert.equal(hot1.replacedSlot?.controller, 'human');
  assert.equal(
    hot1.updatedState.blueCommanders.filter((c) => c.controller === 'human').length,
    3,
  );
  assert.equal(
    hot1.updatedState.blueCommanders.filter((c) => c.controller === 'ai').length,
    1,
  );
});

test('evaluateBuiltBuddySmartAiDecision prioritizes delivering to owner pad, crafting, healing, and unarmed progression', () => {
  // 1. Carrying a crate -> deliver to owner's personal Stacking Pad
  const deliver = evaluateBuiltBuddySmartAiDecision({
    buddyClass: 'Infuntry',
    weaponId: 'unarmed',
    carryingCrate: true,
    hp: 100,
    maxHp: 100,
    commandMode: 'HARVEST',
    ownerBuildOrder: 'AUTO',
    ownerPadHasSpace: true,
    ownerPadReadyToCraft: false,
    ownerIsAiCommander: true,
    ownerAliveBuddyCount: 1,
    ownerHasBuiltTurret: false,
    ownerHasBuiltVehicle: false,
    woundedAllyDist: null,
    nearestEnemyDist: 30,
    nearestFreeCrateDist: 10,
    nearestGroundWeaponDist: null,
    nearestEmptyVehicleDist: null,
  });
  assert.equal(deliver.action, 'DELIVER_TO_OWNER_PAD');
  assert.equal(deliver.recommendedBuildOrder, '1x1x1');

  // 2. Medic near wounded ally -> heals ally
  const medicHeal = evaluateBuiltBuddySmartAiDecision({
    buddyClass: 'Medic',
    weaponId: 'pistol',
    carryingCrate: false,
    hp: 110,
    maxHp: 110,
    commandMode: 'HARVEST',
    ownerBuildOrder: '1x1x2',
    ownerPadHasSpace: true,
    ownerPadReadyToCraft: false,
    ownerIsAiCommander: false,
    ownerAliveBuddyCount: 2,
    ownerHasBuiltTurret: false,
    ownerHasBuiltVehicle: false,
    woundedAllyDist: 8.5,
    nearestEnemyDist: 35,
    nearestFreeCrateDist: 12,
    nearestGroundWeaponDist: null,
    nearestEmptyVehicleDist: null,
  });
  assert.equal(medicHeal.action, 'HEAL_WOUNDED_ALLY');
});

test('getPropCollisionSpec covers all newly integrated Harbor, Construction, Base, and Power Plant GLB props', () => {
  assert.equal(getPropCollisionSpec('forklift', 1.0).category, 'solid');
  assert.equal(getPropCollisionSpec('tank_1b', 1.0).category, 'solid');
  assert.equal(getPropCollisionSpec('pipe_cluster_1b', 1.0).category, 'solid');
  assert.equal(getPropCollisionSpec('giant_pipe_1b', 1.0).category, 'solid');
  assert.equal(getPropCollisionSpec('concrete_pipe', 1.0).category, 'solid');
  assert.equal(getPropCollisionSpec('h_beam', 1.0).category, 'solid');
  assert.equal(getPropCollisionSpec('concrete_fence_1b', 1.0).destructible, true);
  assert.equal(getPropCollisionSpec('barrel_1c', 1.0).category, 'pushable');
  assert.equal(getPropCollisionSpec('fuel_cell', 1.0).category, 'pushable');
  assert.equal(getPropCollisionSpec('circuit_module', 1.0).category, 'pushable');
  assert.equal(getPropCollisionSpec('pallet_1a', 1.0).category, 'none');
  assert.equal(getPropCollisionSpec('pallet_1a', 1.0).materialTag, 'wood');
});

test('resolveSolidObbCollision2D and pointInObb2D accurately resolve rotated rectangular building, container, and vehicle hull collisions', () => {
  // 1. Exterior hit on +X face of an unrotated OBB (halfX = 5, halfZ = 3)
  const hitFace = resolveSolidObbCollision2D(5.8, 0.5, -6.0, 1.0, 1.5, 0, 0, 5.0, 3.0, 0, 0.25);
  assert.equal(hitFace.collided, true);
  assert.ok(Math.abs(hitFace.x - 6.5) < 0.005);
  assert.ok(Math.abs(hitFace.normalX - 1.0) < 1e-6);
  assert.ok(hitFace.vx > 0);

  // 2. Rotated OBB (rotY = Math.PI / 2 swaps world X/Z extents so local halfZ = 3.0 lies along world X)
  const hitRot = resolveSolidObbCollision2D(3.8, 0.0, -5.0, 0.0, 1.2, 0, 0, 5.0, 3.0, Math.PI / 2, 0.25);
  assert.equal(hitRot.collided, true);
  assert.ok(Math.abs(hitRot.x - 4.2) < 0.005);

  // 3. Point inside OBB check for projectile collisions
  assert.equal(pointInObb2D(2.5, 4.5, 0, 0, 5.0, 3.0, Math.PI / 2, 0.2), true);
  assert.equal(pointInObb2D(3.5, 0.0, 0, 0, 5.0, 3.0, Math.PI / 2, 0.2), false);
});

test('A* pathfinding uses binary heap with tie-breaking towards lower h, Manhattan (4-way) & Octile (8-way) heuristics, and expands >=40% fewer tiles than blind search', () => {
  // 1. Binary heap orders by lowest f = g + h, breaking ties on f towards lower h
  const heap = new AStarBinaryHeap();
  heap.push({ idx: 1, g: 4, h: 6, f: 10 });
  heap.push({ idx: 2, g: 7, h: 3, f: 10 }); // Same f = 10, lower h = 3 -> must pop first!
  heap.push({ idx: 3, g: 2, h: 5, f: 7 });  // Lowest f = 7 -> pops very first!

  assert.equal(heap.pop()?.idx, 3);
  assert.equal(heap.pop()?.idx, 2, 'Tie on f = 10 must be broken towards lower h (h = 3 before h = 6)');
  assert.equal(heap.pop()?.idx, 1);

  // 2. Manhattan (4-way) and Octile (8-way) heuristics never overestimate true grid distance
  assert.equal(computeManhattanHeuristic(2, 3, 7, 9), 11);
  const octile = computeOctileHeuristic(0, 0, 3, 4);
  assert.ok(Math.abs(octile - (4 + (Math.SQRT2 - 1) * 3)) < 1e-6);

  // 3. Maze with perimeter wall & gate: A* reconstructs optimal shortest path from parent links
  //    and expands >40% fewer tiles than a blind search!
  const grid = createAStarNavGrid(-30, 30, -30, 30, 1.5); // 40x40 = 1600 tiles
  // Build a wall from x = -30 to x = +10 across z = 0 so the only gate opening is at x > +10
  rasterizeObbObstacleToNavGrid(grid, -10.0, 0.0, 20.0, 0.75, 0, 0.45);
  rasterizeCircleObstacleToNavGrid(grid, 14.0, -7.5, 2.2, 0.35);

  const path4Way = findPathAStar(grid, -12, -15, -12, 15, { allowDiagonal: false });
  assert.equal(path4Way.reachedGoal, true, '4-way Manhattan A* must find path around wall through gate');
  assert.ok(path4Way.waypoints.length > 15);

  const path8Way = findPathAStar(grid, -12, -15, -12, 15, { allowDiagonal: true });
  assert.equal(path8Way.reachedGoal, true, '8-way Octile A* must find path around wall through gate');
  assert.ok(
    path8Way.totalCost < path4Way.totalCost,
    `8-way Octile path cost (${path8Way.totalCost.toFixed(2)}) should be shorter than 4-way Manhattan cost (${path4Way.totalCost.toFixed(2)})`,
  );
  // Verify intermediate waypoints pass around the wall through the gate at x > 10.0
  const gatePassWaypoint = path8Way.waypoints.find((p) => Math.abs(p.z) < 2.0);
  assert.ok(gatePassWaypoint && gatePassWaypoint.x > 10.0, 'Path must route through the open gate at x > 10.0');

  // Verify A* heuristic steering expands significantly fewer tiles than unguided search
  assert.ok(
    path8Way.expandedCount < 650,
    `Expected A* to expand far fewer tiles than blind search on 1600-tile grid, expanded ${path8Way.expandedCount}`,
  );
});

test('Large structures (turbine, crane, buildings, giant tanks/pipes) never wobble/jiggle on shot while small dynamic props use BUDDIES shootImpulse', () => {
  const unshakeableLargeTypes = [
    'turbine',
    'crane',
    'chimney',
    'giant_tank',
    'giant_pipe',
    'giant_pipe_1b',
    'pipe_cluster',
    'pipe_cluster_1b',
    'tank_1a',
    'tank_1b',
    'forklift',
    'h_beam',
    'concrete_pipe',
    'dump_truck',
    'power_core',
    'shipping_container',
    'concrete_fence',
    'concrete_fence_1b',
    'blue_hq',
    'red_hq',
    'blue_barracks',
    'blue_hangar',
  ] as const;

  for (const propType of unshakeableLargeTypes) {
    const spec = getPropCollisionSpec(propType);
    assert.equal(spec.canJiggleOnHit, false, `${propType} must NOT jiggle/wobble when shot or collided`);
    assert.equal(spec.shootImpulse, 0, `${propType} must have shootImpulse === 0`);
  }

  // Dynamic small/medium props match BUDDIES bundled shootImpulse values (10, 6, 5, 4) and allow hit jiggle
  assert.equal(getPropCollisionSpec('wheelbarrow').shootImpulse, 10);
  assert.equal(getPropCollisionSpec('wheelbarrow').canJiggleOnHit, true);
  assert.equal(getPropCollisionSpec('pallet_1a').shootImpulse, 6);
  assert.equal(getPropCollisionSpec('barrel_1c').shootImpulse, 5);
  assert.equal(getPropCollisionSpec('barricade').shootImpulse, 5);
  assert.equal(getPropCollisionSpec('crate_wood').shootImpulse, 5);
  assert.equal(getPropCollisionSpec('traffic_cone').shootImpulse, 4);
  assert.equal(getPropCollisionSpec('traffic_cone').canJiggleOnHit, true);
  assert.equal(getPropCollisionSpec('recycle_bin').shootImpulse, 4);
  assert.equal(getPropCollisionSpec('explosive_barrel').canJiggleOnHit, true);
});

test('Hit-reaction pose, stun star spin, 4-part tank recoil, emissive flash, and explosion audio ducking formulas', () => {
  // 1. Directional hit reaction: peak at t = 0.10s (timer = 0.50s out of 0.60s)
  const playerPeak = evaluateBlitzHitReactionPose(0.50, 0.60, 0, 1, true);
  const enemyPeak = evaluateBlitzHitReactionPose(0.50, 0.60, 0, 1, false);
  assert.ok(Math.abs(playerPeak.hopY - 0.05) < 1e-4);
  assert.ok(Math.abs(enemyPeak.hopY - 0.10) < 1e-4);
  assert.ok(Math.abs(enemyPeak.rotX) > Math.abs(playerPeak.rotX));

  // 2. StunEffect: 1.5s duration, 2 full turns (4*PI rad), pop-in/shrink-out scale
  const stunMid = evaluateBlitzStunEffectState(0.75, 1.5);
  assert.equal(stunMid.active, true);
  assert.equal(stunMid.scale, 1.0);
  assert.ok(Math.abs(stunMid.rotationZ - Math.PI * 2) < 1e-4);
  assert.equal(evaluateBlitzStunEffectState(0, 1.5).active, false);

  // 3. 4-part tank recoil pose
  const recoilPeak = evaluateBlitzTankShotRecoilPose(0.20, 0.24);
  assert.ok(recoilPeak.turretSlideBack > 0.14);
  assert.ok(recoilPeak.barrelSlideBack > 0.14);
  assert.ok(recoilPeak.bodyLiftY > 0.04);
  assert.ok(recoilPeak.cameraKick > 0.10);

  // 4. Emissive yellow hit flash (quadratic decay over 0.15s)
  assert.equal(evaluateBlitzEmissiveHitFlash(0.15, 0.15), 1.0);
  assert.ok(Math.abs(evaluateBlitzEmissiveHitFlash(0.075, 0.15) - 0.25) < 1e-6);

  // 5. Multi-explosion audio ducking within 350ms window (1.0 -> 0.85 -> 0.72 -> 0.60)
  const d1 = computeExplosionDucking(1000, []);
  assert.equal(d1.duckingGain, 1.0);
  const d2 = computeExplosionDucking(1100, d1.updatedTimestampsMs);
  assert.equal(d2.duckingGain, 0.85);
  const d3 = computeExplosionDucking(1200, d2.updatedTimestampsMs);
  assert.equal(d3.duckingGain, 0.72);
  const d4 = computeExplosionDucking(1300, d3.updatedTimestampsMs);
  assert.equal(d4.duckingGain, 0.60);
});

test('castMuzzleRaycast3D casts up to 100 units, skips shooter via layer mask, picks closest hit with point & surface normal, and locks onto enemy character, vehicle, or Skyshield', () => {
  assert.equal(RAYCAST_MAX_DISTANCE, 100.0);
  assert.equal(RAYCAST_LAYERS.DEFAULT_MUZZLE_MASK & RAYCAST_LAYERS.SHOOTER, 0);

  const origin = { x: 0, y: 1.5, z: 0 };
  const dir = { x: 1, y: 0, z: 0 };

  const colliders: RaycastCollider3D[] = [
    // 1. Shooter at t = 0..1 (MUST be skipped by layerMask & shooterId!)
    {
      id: 'player_1',
      layer: RAYCAST_LAYERS.SHOOTER,
      targetKind: 'enemy_character',
      label: 'Shooter',
      shape: 'cylinder',
      center: { x: 0.5, y: 1.5, z: 0 },
      radius: 1.0,
      halfExtents: { x: 1, y: 1.2, z: 1 },
    },
    // 2. Enemy Character at x = 15 (radius 1 -> hit at x = 14, normal = (-1, 0, 0))
    {
      id: 'enemy_commando',
      layer: RAYCAST_LAYERS.ENEMY_CHARACTER,
      targetKind: 'enemy_character',
      label: 'Enemy Commando',
      shape: 'cylinder',
      center: { x: 15, y: 1.5, z: 0 },
      radius: 1.0,
      halfExtents: { x: 1.0, y: 1.2, z: 1.0 },
    },
    // 3. Vehicle OBB farther behind at x = 30 (should lose to closer Enemy Character at x = 15)
    {
      id: 'veh_tank_2',
      layer: RAYCAST_LAYERS.VEHICLE,
      targetKind: 'vehicle',
      label: 'Blitz Battle Tank',
      shape: 'obb',
      center: { x: 30, y: 1.5, z: 0 },
      halfExtents: { x: 2.5, y: 1.4, z: 1.7 },
      rotY: 0,
    },
    // 4. Skyshield Turret at x = 110 (> 100 maxDistance -> out of range!)
    {
      id: 'skyshield_far',
      layer: RAYCAST_LAYERS.SKYSHIELD,
      targetKind: 'skyshield',
      label: 'Far Skyshield',
      shape: 'cylinder',
      center: { x: 110, y: 2.5, z: 0 },
      radius: 2.0,
      halfExtents: { x: 2.0, y: 2.8, z: 2.0 },
    },
  ];

  // Case A: Closest hit is Enemy Character at x = 14 (shooter at x = 0.5 is skipped!)
  const hitEnemy = castMuzzleRaycast3D(origin, dir, colliders, {
    maxDistance: 100,
    layerMask: RAYCAST_LAYERS.DEFAULT_MUZZLE_MASK,
    shooterId: 'player_1',
  });
  assert.equal(hitEnemy.hit, true);
  assert.equal(hitEnemy.colliderId, 'enemy_commando');
  assert.equal(hitEnemy.targetKind, 'enemy_character');
  assert.equal(hitEnemy.isTargetLocked, true, 'Must lock onto enemy character');
  assert.ok(Math.abs(hitEnemy.distance - 14.0) < 1e-4);
  assert.ok(Math.abs(hitEnemy.point.x - 14.0) < 1e-4);
  assert.ok(Math.abs(hitEnemy.normal.x - -1.0) < 1e-4);

  // Case B: Remove enemy -> closest hit is Vehicle OBB at x = 27.5 (30 - 2.5) with normal (-1, 0, 0) & Target Lock
  const hitVehicle = castMuzzleRaycast3D(
    origin,
    dir,
    colliders.filter((c) => c.id !== 'enemy_commando'),
  );
  assert.equal(hitVehicle.hit, true);
  assert.equal(hitVehicle.colliderId, 'veh_tank_2');
  assert.equal(hitVehicle.targetKind, 'vehicle');
  assert.equal(hitVehicle.isTargetLocked, true, 'Must lock onto vehicle');
  assert.ok(Math.abs(hitVehicle.distance - 27.5) < 1e-4);
  assert.ok(Math.abs(hitVehicle.normal.x - -1.0) < 1e-4);

  // Case C: Skyshield Turret within 100 units locks on, while Skyshield at 110 units is beyond maxDistance = 100
  const missFar = castMuzzleRaycast3D(
    origin,
    dir,
    colliders.filter((c) => c.id === 'skyshield_far'),
  );
  assert.equal(missFar.hit, false);
  assert.equal(missFar.distance, 100);
  assert.equal(missFar.isTargetLocked, false);

  const hitSkyshield = castMuzzleRaycast3D(origin, dir, [
    {
      id: 'skyshield_red_0',
      layer: RAYCAST_LAYERS.SKYSHIELD,
      targetKind: 'skyshield',
      team: 'red',
      label: 'Skyshield 35mm Turret',
      shape: 'cylinder',
      center: { x: 42, y: 2.5, z: 0 },
      radius: 2.0,
      halfExtents: { x: 2.0, y: 2.8, z: 2.0 },
    },
  ]);
  assert.equal(hitSkyshield.hit, true);
  assert.equal(hitSkyshield.targetKind, 'skyshield');
  assert.equal(hitSkyshield.isTargetLocked, true, 'Must lock onto enemy Red Skyshield turret');
  assert.ok(Math.abs(hitSkyshield.distance - 40.0) < 1e-4);

  // Case D: Friendly ('blue') Skyshields, friendly vehicles, and friendly Buddy units are NEVER locked onto!
  const friendlyIgnored = castMuzzleRaycast3D(
    origin,
    dir,
    [
      {
        id: 'skyshield_blue_0',
        layer: RAYCAST_LAYERS.SKYSHIELD,
        targetKind: 'skyshield',
        team: 'blue',
        label: 'Friendly Blue Skyshield',
        shape: 'cylinder',
        center: { x: 10, y: 2.5, z: 0 },
        radius: 2.0,
        halfExtents: { x: 2.0, y: 2.8, z: 2.0 },
      },
      {
        id: 'ally_buddy_2',
        layer: RAYCAST_LAYERS.ENEMY_CHARACTER,
        targetKind: 'enemy_character',
        team: 'blue',
        label: 'Friendly Blue Buddy',
        shape: 'cylinder',
        center: { x: 18, y: 1.5, z: 0 },
        radius: 1.0,
        halfExtents: { x: 1.0, y: 1.2, z: 1.0 },
      },
      {
        id: 'ally_tank_1',
        layer: RAYCAST_LAYERS.VEHICLE,
        targetKind: 'vehicle',
        team: 'blue',
        label: 'Friendly Blue Tank',
        shape: 'obb',
        center: { x: 25, y: 1.5, z: 0 },
        halfExtents: { x: 2.5, y: 1.4, z: 1.7 },
        rotY: 0,
      },
    ],
    { shooterTeam: 'blue' },
  );
  assert.equal(friendlyIgnored.hit, false, 'Must skip friendly Skyshield, friendly Buddy, and friendly vehicle');
  assert.equal(friendlyIgnored.isTargetLocked, false, 'Must NEVER lock onto friendly team targets');
});

test('Modern Stylized 3D Tactical Arcade multi-layer Web Audio synthesis spec matches Skyshield, Fighter Jet BRRRT, Bazooka, Explosion, Firearm, and Master Bus requirements', () => {
  const spec = getTacticalAudioSpec();

  // 1. Skyshield Anti-Drone System (C-RAM / Rapid AA Turret)
  assert.equal(spec.skyshield.radarLockChirpStartHz, 1400);
  assert.equal(spec.skyshield.radarLockChirpEndHz, 1800);
  assert.equal(spec.skyshield.radarLockChirpDurationSec, 0.04);
  assert.equal(spec.skyshield.radarLockChirpRepeats, 2);
  assert.equal(spec.skyshield.servoStartHz, 120);
  assert.equal(spec.skyshield.servoEndHz, 220);
  assert.ok(spec.skyshield.burstIntervalMs >= 35 && spec.skyshield.burstIntervalMs <= 45);
  assert.equal(spec.skyshield.shotPunchStartHz, 260);
  assert.equal(spec.skyshield.shotPunchEndHz, 70);
  assert.equal(spec.skyshield.shotPunchDurationSec, 0.03);
  assert.equal(spec.skyshield.shotNoiseBandpassHz, 1400);
  assert.equal(spec.skyshield.shotNoiseQ, 3.0);
  assert.equal(spec.skyshield.shotNoiseDurationSec, 0.035);
  assert.equal(spec.skyshield.flakSubStartHz, 110);
  assert.equal(spec.skyshield.flakSubEndHz, 40);
  assert.equal(spec.skyshield.flakSubDurationSec, 0.12);
  assert.equal(spec.skyshield.flakSnapBandpassHz, 900);

  // 2. Fighter Jet Strafe & Rotary Cannon "BRRRT"
  assert.ok(spec.fighterJet.lfoRateHz >= 55 && spec.fighterJet.lfoRateHz <= 65);
  assert.equal(spec.fighterJet.coreOscHz, 130);
  assert.equal(spec.fighterJet.noiseBandpassHz, 650);
  assert.equal(spec.fighterJet.noiseQ, 2.0);
  assert.ok(spec.fighterJet.burstDurationSec >= 0.35 && spec.fighterJet.burstDurationSec <= 0.5);
  assert.equal(spec.fighterJet.dopplerStartHz, 250);
  assert.equal(spec.fighterJet.dopplerPeakHz, 900);
  assert.equal(spec.fighterJet.dopplerEndHz, 200);

  // 3. Bazooka Launcher
  assert.equal(spec.bazookaLaunch.subStartHz, 180);
  assert.equal(spec.bazookaLaunch.subEndHz, 45);
  assert.equal(spec.bazookaLaunch.subDurationSec, 0.15);
  assert.equal(spec.bazookaLaunch.whooshStartHz, 1200);
  assert.equal(spec.bazookaLaunch.whooshEndHz, 300);
  assert.equal(spec.bazookaLaunch.whooshQ, 2.5);

  // 4. Bazooka & Tank Projectile Explosions
  assert.equal(spec.tacticalExplosion.subStartHz, 90);
  assert.equal(spec.tacticalExplosion.subEndHz, 25);
  assert.equal(spec.tacticalExplosion.durationSec, 0.45);
  assert.equal(spec.tacticalExplosion.rumbleLowPassStartHz, 800);
  assert.equal(spec.tacticalExplosion.rumbleLowPassEndHz, 80);
  assert.equal(spec.tacticalExplosion.usesSoftClipWaveShaper, true);

  // 5. Pistol & Assault Rifle
  assert.equal(spec.firearm.punchStartHz, 300);
  assert.equal(spec.firearm.punchEndHz, 60);
  assert.equal(spec.firearm.punchDurationSec, 0.05);
  assert.equal(spec.firearm.noiseDurationSec, 0.06);
  assert.equal(spec.firearm.noiseLowPassHz, 1800);

  // 6. Master Audio Bus
  assert.equal(spec.masterBus.lowPassCutoffHz, 4500);
});

test('Build box / stacking pad SFX and distant world sounds are strictly muted (gain === 0) when player is outside the base', () => {
  const blueHqX = 0.0;
  const blueHqZ = 86.0;
  const bluePad0X = -16.5;
  const bluePad0Z = 75.5;
  const redHqX = 0.0;
  const redHqZ = -86.0;
  const redPad0X = 16.5;
  const redPad0Z = -75.5;

  // 1. Player outside both bases (e.g. center of map at (0, 0) or outside Blue base gate at (0, 52)):
  //    Build box sounds from Blue pads and Red pads MUST be 100% silent (gain === 0)!
  assert.equal(isListenerInsideBasePerimeter(0, 0, blueHqX, blueHqZ), false);
  assert.equal(isListenerInsideBasePerimeter(0, 52, blueHqX, blueHqZ), false);
  assert.equal(
    computeBuildBoxAudioGain(0, 0, bluePad0X, bluePad0Z, blueHqX, blueHqZ, false),
    0,
  );
  assert.equal(
    computeBuildBoxAudioGain(0, 52, bluePad0X, bluePad0Z, blueHqX, blueHqZ, true),
    0,
  );
  assert.equal(
    computeBuildBoxAudioGain(0, 75.5, redPad0X, redPad0Z, redHqX, redHqZ, false),
    0,
  );

  // 2. Player inside Blue base standing right next to their own pad (-16.5, 75.5): full gain = 1.0
  assert.equal(isListenerInsideBasePerimeter(-16.5, 75.5, blueHqX, blueHqZ), true);
  assert.equal(
    computeBuildBoxAudioGain(-16.5, 75.5, bluePad0X, bluePad0Z, blueHqX, blueHqZ, true),
    1.0,
  );

  // 3. Player inside Blue base at Pad 0 (-16.5, 75.5), while AI Commander 3 crafts at far Pad 3 (+16.5, 75.5 -> 33m away > 16m):
  //    Distant AI pad even inside the same base is muted (gain === 0), and nearby AI pad is attenuated (<= 0.45)
  assert.equal(
    computeBuildBoxAudioGain(-16.5, 75.5, 16.5, 75.5, blueHqX, blueHqZ, false),
    0,
  );
  const nearbyAiPadGain = computeBuildBoxAudioGain(-8.0, 75.5, -5.5, 75.5, blueHqX, blueHqZ, false);
  assert.ok(nearbyAiPadGain > 0 && nearbyAiPadGain <= 0.45);

  // 4. Generic 3D spatial audio distance attenuation (quadratic roll-off and strict cutoff beyond maxDistance)
  assert.equal(computeSpatialAudioGain(0, 0, 2, 0, 20, 4), 1.0);
  assert.equal(computeSpatialAudioGain(0, 0, 20, 0, 20, 4), 0.0);
  assert.equal(computeSpatialAudioGain(0, 0, 35, 0, 20, 4), 0.0);
  const midGain = computeSpatialAudioGain(0, 0, 12, 0, 20, 4); // halfway between 4 and 20 -> (1 - 0.5)^2 = 0.25
  assert.ok(Math.abs(midGain - 0.25) < 1e-6);
});

test('getWeaponProjectileVisualSpec sizes every projectile strictly smaller than its weapon barrel bore and scales monotonically from Pistol to Tank Cannon', () => {
  const pistol = getWeaponProjectileVisualSpec('BlitzPistol');
  const rifle = getWeaponProjectileVisualSpec('BlitzAssaultRifle');
  const planeGatling = getWeaponProjectileVisualSpec('PlaneGatling');
  const skyshield = getWeaponProjectileVisualSpec('Skyshield35mm');
  const bazooka = getWeaponProjectileVisualSpec('Bazooka');
  const tankCannon = getWeaponProjectileVisualSpec('TankCannon');

  // 1. Every projectile's cross-sectional diameter must fit inside its weapon's barrel outer diameter
  for (const spec of [pistol, rifle, planeGatling, skyshield, bazooka, tankCannon]) {
    assert.ok(spec.diameter > 0 && spec.diameter < spec.barrelOuterDiameter);
    assert.ok(spec.length > spec.diameter);
  }

  // 2. Monotonic caliber & length scaling from smallest handheld weapon to largest heavy cannon
  assert.ok(pistol.diameter < rifle.diameter);
  assert.ok(rifle.diameter < planeGatling.diameter);
  assert.ok(planeGatling.diameter < skyshield.diameter);
  assert.ok(skyshield.diameter < bazooka.diameter);
  assert.ok(bazooka.diameter < tankCannon.diameter);

  assert.ok(pistol.length < rifle.length);
  assert.ok(rifle.length < planeGatling.length);
  assert.ok(planeGatling.length < skyshield.length);
  assert.ok(skyshield.length < bazooka.length);
  assert.ok(bazooka.length < tankCannon.length);

  // 3. Correct 3D GLB shell template mapping
  assert.equal(pistol.shellKind, 'fodder');
  assert.equal(rifle.shellKind, 'fodder');
  assert.equal(planeGatling.shellKind, 'fodder');
  assert.equal(skyshield.shellKind, 'player');
  assert.equal(bazooka.shellKind, 'boss');
  assert.equal(tankCannon.shellKind, 'player');
});

test('createFixedObjectPool preallocates peak count up front, resets fields on spawn, marks inactive on death without destroying, recycles 14 slots, and logs a warning on exhaustion', () => {
  assert.equal(DEFAULT_BULLET_LANE_POOL_SIZE, 14);
  assert.equal(POOL_PEAK_CAPACITIES.bulletLane, 14);
  assert.ok(POOL_PEAK_CAPACITIES.bullets >= 14);

  // 1. Verify 14-slot pooled lane recycles the exact same 14 preallocated instances with 0 runtime allocations
  const sim = simulatePooledVsUnpooledBulletLane(140, DEFAULT_BULLET_LANE_POOL_SIZE);
  assert.equal(sim.poolCapacity, 14);
  assert.equal(sim.pooledPreallocatedSlots, 14);
  assert.equal(sim.pooledRuntimeAllocations, 0);
  assert.equal(sim.pooledGarbageDiscarded, 0);
  assert.equal(sim.pooledGcPauseStalls, 0);
  assert.equal(sim.pooledUniqueSlotsUsed, 14);
  assert.equal(sim.pooledRecycledSpawns, 126);
  assert.equal(sim.pooledExhaustionWarnings, 0);
  assert.equal(sim.unpooledAllocations, 140);
  assert.equal(sim.unpooledGarbageDiscarded, 140);
  assert.ok(sim.unpooledGcPauseStalls >= 10);

  // 2. Verify lifecycle: preallocate up front, reset on spawn, mark inactive on death, warn on exhaustion
  interface TestParticle {
    id: number;
    active: boolean;
    x: number;
    life: number;
    visible: boolean;
  }

  let createCalls = 0;
  const warnings: string[] = [];
  const particlePool = createFixedObjectPool<TestParticle>({
    name: 'TestParticles',
    peakCapacity: 3,
    createSlot: (index) => {
      createCalls++;
      return { id: index, active: false, x: 99, life: 99, visible: true };
    },
    resetSlot: (slot) => {
      slot.x = 0;
      slot.life = 1.0;
      slot.visible = true;
    },
    deactivateSlot: (slot) => {
      slot.life = 0;
      slot.visible = false;
    },
    onWarnExhausted: (msg) => {
      warnings.push(msg);
    },
  });

  // Preallocated all 3 slots up front and marked them inactive/hidden
  assert.equal(createCalls, 3);
  assert.equal(particlePool.capacity, 3);
  assert.equal(particlePool.activeCount, 0);
  assert.ok(particlePool.slots.every((s) => !s.active && !s.visible));

  const p0 = particlePool.acquire((s) => {
    s.x = 10;
  });
  const p1 = particlePool.acquire((s) => {
    s.x = 20;
  });
  const p2 = particlePool.acquire((s) => {
    s.x = 30;
  });
  assert.ok(p0 && p1 && p2);
  assert.equal(particlePool.activeCount, 3);
  assert.equal(createCalls, 3); // Zero new allocations on spawn!
  assert.equal(p0.x, 10);
  assert.equal(p0.life, 1.0);
  assert.equal(p0.visible, true);

  // Pool exhaustion: 4th acquire while all 3 are active must log a warning and return null
  const pOverflow = particlePool.acquire();
  assert.equal(pOverflow, null);
  assert.equal(particlePool.exhaustionWarnings, 1);
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0].includes('[ObjectPool:TestParticles] Pool exhausted!'));

  // Death: release marks slot inactive and hides it without destroying the object reference
  particlePool.release(p1);
  assert.equal(p1.active, false);
  assert.equal(p1.visible, false);
  assert.equal(p1.life, 0);
  assert.equal(particlePool.activeCount, 2);

  // Next spawn reuses the exact same `p1` object instance and resets its fields!
  const pReused = particlePool.acquire();
  assert.equal(pReused, p1);
  assert.equal(pReused?.active, true);
  assert.equal(pReused?.x, 0); // Reset by resetSlot!
  assert.equal(pReused?.life, 1.0);
  assert.equal(pReused?.visible, true);
  assert.equal(createCalls, 3); // Still 3 total objects ever created!
});

test('resolveSolidCratePush2D and resolveCrateVsCrateCollision2D enforce rigid solid-box collision without jelly deformation', () => {
  // 1. Pushing the flat front face (-Z) of a grounded solid crate straight along +Z:
  //    must separate mover and crate rigidly, slide crate forward along +Z, keep 0 spin for center push, and keep scale (1, 1, 1)
  const centerPush = resolveSolidCratePush2D(
    0,
    -1.05,
    0,
    6.5,
    0.55,
    2.2,
    0,
    0,
    0,
    0,
    0,
    0.68,
    1.85,
    0.22,
  );
  assert.equal(centerPush.collided, true);
  assert.ok(centerPush.crateZ > 0, 'Crate is pushed forward along +Z');
  assert.ok(centerPush.moverZ < -1.05, 'Mover is separated outside the solid crate face');
  assert.ok(centerPush.crateVz > 3.5, 'Crate receives solid forward sliding velocity');
  assert.equal(centerPush.angularImpulse, 0, 'Center-of-face push slides crate straight without spinning');
  assert.equal(centerPush.scaleX, 1);
  assert.equal(centerPush.scaleY, 1);
  assert.equal(centerPush.scaleZ, 1);

  // 2. Pushing a corner of the solid crate imparts realistic rigid-body angular impulse while keeping scale (1, 1, 1)
  const cornerPush = resolveSolidCratePush2D(
    0.58,
    -1.05,
    0,
    6.5,
    0.55,
    2.2,
    0,
    0,
    0,
    0,
    0,
    0.68,
    1.85,
    0.22,
  );
  assert.equal(cornerPush.collided, true);
  assert.ok(Math.abs(cornerPush.angularImpulse) > 0.2, 'Off-center corner push rotates the rigid box');
  assert.equal(cornerPush.scaleX, 1);
  assert.equal(cornerPush.scaleY, 1);
  assert.equal(cornerPush.scaleZ, 1);

  // 3. Thrown or pushed crate striking another grounded crate separates both boxes and transfers momentum
  const crateHit = resolveCrateVsCrateCollision2D(0, 0, 9.5, 0, 1.1, 0, 0, 0, 1.34, 0.34);
  assert.equal(crateHit.collided, true);
  assert.ok(crateHit.bx - crateHit.ax >= 1.34, 'Crates are separated so they never overlap');
  assert.ok(crateHit.bvx > 5.0, 'Struck crate is knocked forward by the thrown/pushed crate');
});

test('evaluateCityTramConsistState keeps enlarged 1.25x 2-car articulated tram (car1, joint, car2 & all 4 corners) inside the asphalt road around every turn', () => {
  assert.equal(CITY_TRAM_SPEC.carCount, 2);
  // Enlarged 1.25x proportional to standing Buddy character:
  assert.equal(CITY_TRAM_SPEC.carLength, 9.00);
  assert.equal(CITY_TRAM_SPEC.carWidth, 3.58);
  assert.equal(CITY_TRAM_SPEC.carHeight, 4.42);
  const initial = evaluateCityTramConsistState(0);
  const totalLen = initial.totalTrackLength;
  assert.ok(totalLen > 350 && totalLen < 500, `Closed tram loop length should be ~410m, got ${totalLen}`);

  const halfLen = CITY_TRAM_SPEC.carLength * 0.5;
  const halfWid = CITY_TRAM_SPEC.carWidth * 0.5;
  let maxArticulationRad = 0;
  let maxBogieSteerRad = 0;

  // Sample every 0.5m along the entire 360-degree closed road loop
  for (let d = 0; d < totalLen; d += 0.5) {
    const trk = sampleCityTramTrackAtDistance(d);
    assert.ok(
      evaluateRoadNetworkSdf(trk.x, trk.z) < -1.5,
      `Track centerline at d=${d} (${trk.x.toFixed(2)}, ${trk.z.toFixed(2)}) must stay deep inside road`,
    );

    const state = evaluateCityTramConsistState(d);
    maxArticulationRad = Math.max(maxArticulationRad, Math.abs(state.joint.articulationAngle));
    maxBogieSteerRad = Math.max(maxBogieSteerRad, Math.abs(state.car1.frontBogieYaw));

    // Verify curve-pinned couplers: car1.rearCoupler and car2.frontCoupler lie directly on the smooth curve
    // (0 lateral shear / never kinks or breaks when turning!)
    const trkFrontCoupler = sampleCityTramTrackAtDistance(d - halfLen);
    const trkRearCoupler = sampleCityTramTrackAtDistance(d - halfLen - CITY_TRAM_SPEC.jointLength);
    assert.ok(
      Math.hypot(state.car1.rearCouplerX - trkFrontCoupler.x, state.car1.rearCouplerZ - trkFrontCoupler.z) < 1e-4,
      `Car 1 rear coupler must be pinned directly to the road curve at d=${d}`,
    );
    assert.ok(
      Math.hypot(state.car2.frontCouplerX - trkRearCoupler.x, state.car2.frontCouplerZ - trkRearCoupler.z) < 1e-4,
      `Car 2 front coupler must be pinned directly to the road curve at d=${d}`,
    );

    // Joint must remain tightly coupled between Car 1 rear coupler and Car 2 front coupler
    assert.ok(
      state.joint.spanLength > 0.85 && state.joint.spanLength < 1.85,
      `Accordion joint span (${state.joint.spanLength.toFixed(2)}m) must stay coupled at d=${d}`,
    );
    assert.ok(
      evaluateRoadNetworkSdf(state.joint.x, state.joint.z) < -1.2,
      `Articulation joint at d=${d} must stay inside road`,
    );

    // Check both Car 1 and Car 2 centers, bogies, and all 4 physical body corners
    for (const car of [state.car1, state.car2]) {
      assert.ok(evaluateRoadNetworkSdf(car.x, car.z) < -1.0, `Car center must stay inside road at d=${d}`);
      assert.ok(
        evaluateRoadNetworkSdf(car.frontBogieX, car.frontBogieZ) < -1.4,
        `Front bogie must stay inside road at d=${d}`,
      );
      assert.ok(
        evaluateRoadNetworkSdf(car.rearBogieX, car.rearBogieZ) < -1.4,
        `Rear bogie must stay inside road at d=${d}`,
      );

      const rightX = -car.forwardZ;
      const rightZ = car.forwardX;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const cornerX = car.x + car.forwardX * (sx * halfLen) + rightX * (sz * halfWid);
          const cornerZ = car.z + car.forwardZ * (sx * halfLen) + rightZ * (sz * halfWid);
          const sdf = evaluateRoadNetworkSdf(cornerX, cornerZ);
          assert.ok(
            sdf < 0.35,
            `Car corner (${cornerX.toFixed(2)}, ${cornerZ.toFixed(2)}) at d=${d} must remain inside road corridor (sdf=${sdf.toFixed(2)})`,
          );
        }
      }
    }
  }

  assert.ok(
    maxArticulationRad > 0.35,
    `2-car consist must articulate significantly around road bends (maxArticulationRad=${maxArticulationRad.toFixed(2)})`,
  );
  assert.ok(
    maxBogieSteerRad > 0.15,
    `Car bogies must pivot to follow curved rails (maxBogieSteerRad=${maxBogieSteerRad.toFixed(2)})`,
  );
});

test('4v4 Individual Commander Base Complex supports 4 lined-up base plots per team, Level 1->2->3 building & iron fence upgrades, Helipad & Parking build, and skin/garden customization', () => {
  const blueBases = createIndividualCommanderBasesState('blue');
  const redBases = createIndividualCommanderBasesState('red');
  assert.equal(blueBases.length, 4);
  assert.equal(redBases.length, 4);

  // 4 bases lined up along X = [-45, -15, +15, +45] for Blue (South) and [+45, +15, -15, -45] for Red (North)
  assert.deepEqual(
    blueBases.map((b) => b.plotCenterX),
    [-45, -15, 15, 45],
  );
  assert.deepEqual(
    redBases.map((b) => b.plotCenterX),
    [45, 15, -15, -45],
  );

  const b0 = blueBases[0];
  assert.equal(b0.buildingLevel, 1);
  assert.equal(b0.buildingHp, INDIVIDUAL_BASE_LEVEL_SPECS.buildingMaxHpByLevel[0]);
  assert.equal(b0.fenceLevel, 1);
  assert.equal(b0.fenceHp, INDIVIDUAL_BASE_LEVEL_SPECS.fenceTotalMaxHpByLevel[0]);
  assert.equal(b0.hasHelipad, false);
  assert.equal(b0.hasParkingBay, false);

  // 1. Upgrade Building Level 1 -> Level 2 (cost >= 2 crates) -> Level 3 Command Center
  const notEnough = applyCommanderBaseUpgrade(b0, 'upgrade_building', 1);
  assert.equal(notEnough.upgraded, false);

  const upBld2 = applyCommanderBaseUpgrade(b0, 'upgrade_building', 2);
  assert.equal(upBld2.upgraded, true);
  assert.equal(b0.buildingLevel, 2);
  assert.equal(b0.buildingMaxHp, 1000);
  assert.equal(b0.buildingHp, 1000);

  const upBld3 = applyCommanderBaseUpgrade(b0, 'upgrade_building', 4);
  assert.equal(upBld3.upgraded, true);
  assert.equal(b0.buildingLevel, 3);
  assert.equal(b0.buildingMaxHp, 1800);
  assert.equal(b0.buildingHp, 1800);

  // 2. Upgrade Iron Fence Level 1 -> Level 2 -> Level 3
  const upFence2 = applyCommanderBaseUpgrade(b0, 'upgrade_fence', 2);
  assert.equal(upFence2.upgraded, true);
  assert.equal(b0.fenceLevel, 2);
  assert.equal(b0.fenceMaxHp, 1400);

  const upFence3 = applyCommanderBaseUpgrade(b0, 'upgrade_fence', 4);
  assert.equal(upFence3.upgraded, true);
  assert.equal(b0.fenceLevel, 3);
  assert.equal(b0.fenceMaxHp, 2800);

  // 3. Build Vehicle Parking Bay & Helipad
  const builtParking = applyCommanderBaseUpgrade(b0, 'build_parking', 2);
  assert.equal(builtParking.upgraded, true);
  assert.equal(b0.hasParkingBay, true);

  const builtHelipad = applyCommanderBaseUpgrade(b0, 'build_helipad', 4);
  assert.equal(builtHelipad.upgraded, true);
  assert.equal(b0.hasHelipad, true);

  // 4. Verify Skin Themes & Garden Presets catalog and Team Elimination rule
  assert.equal(Object.keys(BASE_SKIN_THEMES).length, 4);
  assert.equal(BASE_GARDEN_PRESETS.length, 4);
  assert.equal(isTeamAllBasesDestroyed(blueBases), false);
  for (const base of blueBases) {
    assert.equal(base.hasSkyshield, true, 'All commander bases start with a pre-installed Skyshield');
    base.destroyed = true;
    base.buildingHp = 0;
  }
  assert.equal(isTeamAllBasesDestroyed(blueBases), true);
});

test('City Tram supports boarding anywhere along its route and disembarking anywhere beside the car', () => {
  const tramState = evaluateCityTramConsistState(120);
  // Standing next to Car 1
  const nearCar1 = canUnitBoardCityTramAtAnyPoint(
    tramState.car1.x + 1.5,
    tramState.car1.z + 1.2,
    tramState,
    2.8,
  );
  assert.equal(nearCar1.canBoard, true);
  assert.equal(nearCar1.carIndex, 0);

  // Standing next to Car 2
  const nearCar2 = canUnitBoardCityTramAtAnyPoint(
    tramState.car2.x - 1.2,
    tramState.car2.z + 1.0,
    tramState,
    2.8,
  );
  assert.equal(nearCar2.canBoard, true);
  assert.equal(nearCar2.carIndex, 1);

  // Far away cannot board
  const farAway = canUnitBoardCityTramAtAnyPoint(0, 0, tramState, 2.8);
  assert.equal(farAway.canBoard, false);

  // Disembark position places player safely outside the car width
  const disembark = computeCityTramDisembarkPosition(tramState.car1, 1);
  const distFromCarCenter = Math.hypot(
    disembark.x - tramState.car1.x,
    disembark.z - tramState.car1.z,
  );
  assert.ok(
    distFromCarCenter > CITY_TRAM_SPEC.carWidth * 0.5 + 0.8,
    'Disembarked player lands safely outside the tram car body',
  );
});

test('Commander Base Automatic Sliding Gate allows ONLY the plot owner and their built characters to enter', () => {
  // Owner of Blue Plot #0 (ownerCommanderId === 0, team === 'blue') can enter Blue Plot #0
  assert.equal(canUnitEnterCommanderBaseGate('blue', 0, 'blue', 0), true);
  // Allied Commander #1 or their characters CANNOT enter Blue Plot #0's sliding gate
  assert.equal(canUnitEnterCommanderBaseGate('blue', 1, 'blue', 0), false);
  assert.equal(canUnitEnterCommanderBaseGate('blue', 2, 'blue', 0), false);
  // Enemy Red Commander #0 CANNOT enter Blue Plot #0's sliding gate
  assert.equal(canUnitEnterCommanderBaseGate('red', 0, 'blue', 0), false);

  // Sliding gate animation opens smoothly when authorized unit is within trigger radius (7.5m)
  let slide = 0;
  for (let i = 0; i < 20; i++) {
    slide = stepCommanderSlidingGate(slide, 3.0, 0.05, 7.5).slideRatio;
  }
  assert.equal(slide, 1, 'Sliding gate opens completely when authorized unit approaches');

  // Sliding gate closes smoothly when no authorized unit is near
  for (let i = 0; i < 25; i++) {
    slide = stepCommanderSlidingGate(slide, 25.0, 0.05, 7.5).slideRatio;
  }
  assert.equal(slide, 0, 'Sliding gate closes completely when authorized unit leaves');
});

test('Team Buddies (PS1) death drop mechanics: primary weapon with remaining ammo, coins, carried items, and NO corpse medkits', () => {
  // 1. Enemy killed while holding Bazooka ('rocket', 7 ammo left), carrying a blue ('super') crate overhead, a cluster bomb, and a time bomb
  const drops = evaluateTeamBuddiesDeathDrops({
    weaponId: 'rocket',
    ammo: 7,
    carryingCrate: 'super',
    secondaryItem: 'cluster_bomb',
    secondaryCount: 2,
    missionItem: 'time_bomb',
    isEnemyKill: true,
    classId: 'Commando',
    killedByChainExplosion: false,
  });

  // Never drops a medkit from a corpse
  assert.equal(
    drops.some((d) => d.kind === 'health'),
    false,
    'Dead characters NEVER drop a Health Pack / Medkit',
  );

  // Primary weapon drop retains exact remainingAmmo (7) and despawn timer
  const weaponDrop = drops.find((d) => d.kind === 'weapon');
  assert.ok(weaponDrop, 'Primary weapon drops on death');
  assert.equal(weaponDrop.weaponId, 'rocket');
  assert.equal(weaponDrop.remainingAmmo, 7);
  assert.equal(weaponDrop.despawnTimerSec, TEAM_BUDDIES_WEAPON_DESPAWN_SEC);
  assert.ok(weaponDrop.vy > 5, 'Primary weapon bounces upward into the air');

  // Enemy kill drops Gold and Silver Coins
  const goldCoin = drops.find((d) => d.kind === 'coin_gold');
  const silverCoin = drops.find((d) => d.kind === 'coin_silver');
  assert.ok(goldCoin && goldCoin.scoreValue === 250, 'Enemy kill drops Gold Coin');
  assert.ok(silverCoin && silverCoin.scoreValue === 100, 'Heavy enemy kill also drops Silver Coin');

  // Carried overhead crate drops intact when not killed by chain explosion
  const crateDrop = drops.find((d) => d.kind === 'crate');
  assert.ok(crateDrop, 'Carried crate is thrown to the ground intact');
  assert.equal(crateDrop.crateKind, 'super');

  // Carried secondary grenade & mission object drop intact
  const secDrop = drops.find((d) => d.kind === 'secondary');
  assert.ok(secDrop && secDrop.secondaryId === 'cluster_bomb');
  assert.equal(secDrop.secondaryCount, 2);
  const missionDrop = drops.find((d) => d.kind === 'mission_item');
  assert.ok(missionDrop && missionDrop.missionItemId === 'time_bomb');

  // 2. If killed by a chain explosion, carried crate is destroyed instead of dropping intact
  const chainDrops = evaluateTeamBuddiesDeathDrops({
    weaponId: 'rifle',
    ammo: 19,
    carryingCrate: 'red',
    secondaryItem: 'none',
    missionItem: 'none',
    isEnemyKill: false,
    killedByChainExplosion: true,
  });
  assert.equal(
    chainDrops.some((d) => d.kind === 'crate'),
    false,
    'Carried crate is destroyed when killed by chain explosion',
  );
  assert.equal(
    chainDrops.some((d) => d.kind === 'coin_gold' || d.kind === 'coin_silver'),
    false,
    'Friendly death does not award enemy kill coins',
  );
});

test('Team Buddies (PS1) despawn timer blinks rapidly before disappearing, medical crates drop Medkits, and splash damage destroys drops', () => {
  // 1. Despawn timer & rapid blink window
  const freshState = evaluateDroppedItemDespawnState(
    10.0,
    TEAM_BUDDIES_WEAPON_DESPAWN_SEC,
    TEAM_BUDDIES_DESPAWN_BLINK_WINDOW_SEC,
  );
  assert.equal(freshState.expired, false);
  assert.equal(freshState.isBlinking, false);
  assert.equal(freshState.visible, true);

  const blinkingState = evaluateDroppedItemDespawnState(
    2.1,
    TEAM_BUDDIES_WEAPON_DESPAWN_SEC,
    TEAM_BUDDIES_DESPAWN_BLINK_WINDOW_SEC,
  );
  assert.equal(blinkingState.expired, false);
  assert.equal(blinkingState.isBlinking, true);

  const expiredState = evaluateDroppedItemDespawnState(
    0,
    TEAM_BUDDIES_WEAPON_DESPAWN_SEC,
    TEAM_BUDDIES_DESPAWN_BLINK_WINDOW_SEC,
  );
  assert.equal(expiredState.expired, true);
  assert.equal(expiredState.visible, false);

  // 2. Medkits ONLY come from white red-cross medical crates ('medical'), while Purple ('legend') crates drop Super Weapons
  assert.equal(evaluateCrateDestructionDrop('medical').dropKind, 'health');
  assert.equal(evaluateCrateDestructionDrop('medical').healAmount, 35);
  assert.equal(evaluateCrateDestructionDrop('red').dropKind, 'ammo');
  assert.equal(evaluateCrateDestructionDrop('super').dropKind, 'ammo');
  assert.equal(evaluateCrateDestructionDrop('legend').dropKind, 'weapon');
  assert.equal(evaluateCrateDestructionDrop('legend').isPurpleSuperWeapon, true);

  // 3. Dropped weapons & crates are vulnerable to follow-up splash damage (Bazooka / Tank / Barrel blast)
  const splashHit = evaluateSplashDamageOnDroppedItem(11.2, 10.5, 10, 10, 6.5, 55, 18);
  assert.equal(splashHit.hit, true);
  assert.equal(splashHit.destroyed, true, 'Close follow-up blast destroys dropped weapon/crate');
  assert.equal(splashHit.nextHp, 0);
  assert.ok(Math.hypot(splashHit.knockbackVx, splashHit.knockbackVz) > 6.0);
});

test('Team Buddies (PS1) 2x2x2 Stacking Pad patterns, Crate Schemes, Color Upgrade Tiers, and Odd-Count Breakdown (3, 5, 7 crates)', () => {
  // 1. Verify all 6 canonical Stacking Pad pattern categories and 4 World Crate Schemes exist
  assert.equal(Object.keys(TEAM_BUDDIES_STACKING_PATTERNS).length, 6);
  assert.equal(Object.keys(TEAM_BUDDIES_CRATE_SCHEMES).length, 4);
  assert.equal(TEAM_BUDDIES_STACKING_PATTERNS['1x1x1'].categoryLabel, 'Light Weapons (Tier 1)');
  assert.equal(TEAM_BUDDIES_STACKING_PATTERNS['2x1x1'].categoryLabel, 'Medium Weapons (Tier 2)');
  assert.equal(TEAM_BUDDIES_STACKING_PATTERNS['1x1x2'].categoryLabel, 'Squad Units (Buddy)');
  assert.equal(TEAM_BUDDIES_STACKING_PATTERNS['2x2x1'].categoryLabel, 'Heavy Weapons / Turrets (Tier 3)');
  assert.equal(TEAM_BUDDIES_STACKING_PATTERNS['2x1x2'].categoryLabel, 'Light Vehicles');
  assert.equal(TEAM_BUDDIES_STACKING_PATTERNS['2x2x2'].categoryLabel, 'Heavy Vehicles & Aircraft');

  // 2. 1 Blue Crate ('super') -> Super Shotgun (Peluru Menyebar & Memantul) with hasBouncingSpread = true
  const oneBlue = evaluateStackingPadRecipe([
    'super',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
  ]);
  assert.equal(oneBlue.shapeKey, '1x1x1');
  assert.equal(oneBlue.hasBouncingSpread, true);
  assert.ok(oneBlue.crateSchemeVariantName.includes('Super Shotgun'));

  // 3. 2 Vertical Blue Crates ('1x1x2') -> Super Buddy (Commando / Robo-Buddy with 2x HP & 2x Speed)
  const twoBlueVertical = evaluateStackingPadRecipe([
    'super',
    'empty',
    'empty',
    'empty',
    'super',
    'empty',
    'empty',
    'empty',
  ]);
  assert.equal(twoBlueVertical.shapeKey, '1x1x2');
  assert.equal(twoBlueVertical.buddyStatMultiplier?.hpMultiplier, 2.0);
  assert.equal(twoBlueVertical.buddyStatMultiplier?.speedMultiplier, 2.0);

  // 4. 8 Blue Crates ('2x2x2') -> Super Tank (Mammoth / Tyrant Tank with 2.2x armor)
  const eightBlue = evaluateStackingPadRecipe([
    'super',
    'super',
    'super',
    'super',
    'super',
    'super',
    'super',
    'super',
  ]);
  assert.equal(eightBlue.shapeKey, '2x2x2');
  assert.equal(eightBlue.vehicleStatMultiplier?.seats, 2);
  assert.equal(eightBlue.vehicleStatMultiplier?.armorMultiplier, 2.2);

  // 5. Odd-Count Breakdown (Jumlah Tanggung: 3, 5, and 7 crates) -> Nearest lower pattern + leftover small weapon drops!
  const oddThree = evaluateStackingPadRecipe([
    'red',
    'red',
    'super',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
  ]);
  assert.equal(oddThree.totalCrates, 3);
  assert.equal(oddThree.isOddStackCount, true);
  assert.equal(oddThree.basePatternCratesUsed, 2);
  assert.equal(oddThree.leftoverWeaponDropsCount, 1);
  assert.equal(oddThree.leftoverWeaponDrops[0].hasBouncingSpread, true);

  const oddFive = evaluateStackingPadRecipe([
    'red',
    'red',
    'red',
    'red',
    'legend',
    'empty',
    'empty',
    'empty',
  ]);
  assert.equal(oddFive.totalCrates, 5);
  assert.equal(oddFive.isOddStackCount, true);
  assert.equal(oddFive.basePatternCratesUsed, 4);
  assert.equal(oddFive.leftoverWeaponDropsCount, 1);
  assert.equal(oddFive.leftoverWeaponDrops[0].isMassDestructionSuperWeapon, true);

  const oddSeven = evaluateStackingPadRecipe([
    'red',
    'red',
    'red',
    'red',
    'red',
    'super',
    'red',
    'empty',
  ]);
  assert.equal(oddSeven.totalCrates, 7);
  assert.equal(oddSeven.isOddStackCount, true);
  assert.equal(oddSeven.basePatternCratesUsed, 4);
  assert.equal(oddSeven.leftoverWeaponDropsCount, 3);
});

test('Team Buddies (PS1) Crafted Ground Weapon Lifecycle: Physics Pop-out, AI Auto-Loot & Tier Upgrade, Enemy Stealing (No Team-Lock), 15-20s Despawn vs Permanent Vehicles/Buddies, and Splash Destruction', () => {
  // 1. Physics Pop-out (`Terpental ke Sekitar Pad`): Weapon pops out of the 2x2 pad center and lands around the pad perimeter border (2.4m..3.4m)
  const pop = computeStackingPadWeaponPopOutTrajectory(-18, 62, 0, 1, 1);
  assert.ok(pop.vy > 5.5, 'Crafted weapon pops upward out of the Stacking Pad');
  assert.ok(
    pop.landingDistFromPadCenter >= 2.4 && pop.landingDistFromPadCenter <= 3.4,
    `Expected landing distance around pad perimeter [2.4..3.4m], got ${pop.landingDistFromPadCenter}`,
  );

  // 2. AI Auto-Loot (`Diambil Otomatis oleh AI Tim`): AI holding Tier 1 Pistol upgrades automatically to Tier 3 Bazooka lying near the pad
  const upgradeCheck = canUnitLootGroundWeapon(
    'blue',
    'pistol',
    'Uzi / Shotgun',
    'rocket',
    'Bazooka / Assault Rifle',
    90,
  );
  assert.equal(upgradeCheck.canLoot, true);
  assert.equal(upgradeCheck.isUpgrade, true);
  assert.ok(upgradeCheck.groundTier > upgradeCheck.currentTier);

  const aiUpgradeDecision = evaluateBuiltBuddySmartAiDecision({
    buddyClass: 'Infuntry',
    weaponId: 'pistol',
    carryingCrate: false,
    hp: 100,
    maxHp: 100,
    commandMode: 'HARVEST',
    ownerBuildOrder: '2x1x1',
    ownerPadHasSpace: true,
    ownerPadReadyToCraft: false,
    ownerIsAiCommander: false,
    ownerAliveBuddyCount: 2,
    ownerHasBuiltTurret: true,
    ownerHasBuiltVehicle: false,
    woundedAllyDist: null,
    nearestEnemyDist: 35,
    nearestFreeCrateDist: 18,
    nearestGroundWeaponDist: 8.5,
    nearestEmptyVehicleDist: null,
    canUpgradeFromGroundWeapon: upgradeCheck.isUpgrade,
  });
  assert.equal(
    aiUpgradeDecision.action,
    'EQUIP_GROUND_WEAPON',
    'AI Buddy holding lower-tier weapon automatically runs to loot higher-tier crafted weapon',
  );

  // 3. Vulnerable to Enemy Stealing (`Rentan Dicuri Lawan` — No Team-Lock): Enemy Red unit can steal Blue-crafted weapon
  const enemyStealCheck = canUnitLootGroundWeapon(
    'red',
    'unarmed',
    'Tangan Kosong',
    'rocket',
    'Nuclear Launcher',
    0,
  );
  assert.equal(enemyStealCheck.teamLocked, false, 'Ground weapons have NO team-lock');
  assert.equal(enemyStealCheck.canLoot, true, 'Infiltrating enemy can steal crafted weapon from pad border');
  assert.equal(getBuddyWeaponTierRank('rocket', 'Nuclear Launcher'), 4);

  // 4. Despawn Timer (15–20s for Weapons) vs Permanent Vehicles & Buddies
  assert.ok(
    TEAM_BUDDIES_CRAFTED_WEAPON_DESPAWN_SEC >= 15 && TEAM_BUDDIES_CRAFTED_WEAPON_DESPAWN_SEC <= 20,
    'Crafted weapon despawn timer is within 15–20 seconds (18.0s)',
  );
  assert.equal(doesCraftedEntityDespawnByTimer('weapon').despawnsByTime, true);
  assert.equal(doesCraftedEntityDespawnByTimer('weapon').despawnTimerSec, 18.0);
  assert.equal(doesCraftedEntityDespawnByTimer('buddy').despawnsByTime, false);
  assert.equal(doesCraftedEntityDespawnByTimer('tank').despawnsByTime, false);
  assert.equal(doesCraftedEntityDespawnByTimer('light_vehicle').despawnsByTime, false);
  assert.equal(doesCraftedEntityDespawnByTimer('plane').despawnsByTime, false);

  // 5. Splash Damage Destruction (`Hancur Terkena Serangan Area`): Enemy shell hitting near pad border blows up idle crafted weapon
  const padSplash = evaluateSplashDamageOnDroppedItem(
    pop.landingX,
    pop.landingZ,
    pop.landingX + 1.1,
    pop.landingZ - 0.8,
    6.5,
    60,
    18,
  );
  assert.equal(padSplash.hit, true);
  assert.equal(padSplash.destroyed, true, 'Idle crafted weapon beside pad explodes when hit by enemy splash damage');
});

test('Team Buddies (PS1) Deathmatch Win Conditions: Base/HQ Destruction & Total Squad Wipeout with No Respawn or Crates', () => {
  // 1. Starter unit vs Crafted Buddy respawn rules
  assert.equal(canBuddyUnitRespawnAtBase(true, false, 400), true, 'Starter unit can respawn while its base stands');
  assert.equal(canBuddyUnitRespawnAtBase(true, true, 0), false, 'Starter unit cannot respawn once its base is destroyed');
  assert.equal(
    canBuddyUnitRespawnAtBase(false, false, 400),
    false,
    'Crafted extra Buddy does not auto-respawn when killed (must be crafted again from crates)',
  );

  // 2. Pad slots check for birthing a new Buddy (1x1x2 or 2x1x2)
  assert.equal(
    canPadSlotsBirthNewBuddy(['red', 'empty', 'empty', 'empty', 'red', 'empty', 'empty', 'empty']),
    true,
    '2 vertical crates (1x1x2) can birth a new Buddy',
  );
  assert.equal(
    canPadSlotsBirthNewBuddy(['red', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty']),
    false,
    '1 crate cannot birth a new Buddy',
  );

  // 3. Win Condition A (`base_destroyed`): Enemy Base HP reaches 0 or all 4 Commander Bases destroyed
  const healthyBlueBases = createIndividualCommanderBasesState('blue');
  const destroyedRedBases = createIndividualCommanderBasesState('red').map((b) => ({
    ...b,
    destroyed: true,
    buildingHp: 0,
  }));
  const emptyPads = [
    ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'] as const,
  ].map((arr) => [...arr]);

  const baseDestroyedWin = evaluateTeamBuddiesDeathmatchWinCondition(
    {
      team: 'blue',
      baseHp: 1800,
      commanderBases: healthyBlueBases,
      aliveUnitCount: 3,
      respawnableUnitCount: 1,
      padSlotsList: emptyPads,
      freeFieldCrateCount: 4,
    },
    {
      team: 'red',
      baseHp: 400,
      commanderBases: destroyedRedBases,
      aliveUnitCount: 2,
      respawnableUnitCount: 0,
      padSlotsList: emptyPads,
      freeFieldCrateCount: 4,
    },
  );
  assert.equal(baseDestroyedWin.isGameOver, true);
  assert.equal(baseDestroyedWin.outcome, 'victory');
  assert.equal(baseDestroyedWin.winningTeam, 'blue');
  assert.equal(baseDestroyedWin.reason, 'base_destroyed');

  // 4. Win Condition B (`squad_wiped_no_respawn_or_crates`): All enemy units wiped out, 0 respawnable units, and no crates to birth a new Buddy
  const intactRedBases = createIndividualCommanderBasesState('red');
  const squadWipedWin = evaluateTeamBuddiesDeathmatchWinCondition(
    {
      team: 'blue',
      baseHp: 1500,
      commanderBases: healthyBlueBases,
      aliveUnitCount: 2,
      respawnableUnitCount: 0,
      padSlotsList: emptyPads,
      freeFieldCrateCount: 0,
    },
    {
      team: 'red',
      baseHp: 900,
      commanderBases: intactRedBases,
      aliveUnitCount: 0,
      respawnableUnitCount: 0,
      padSlotsList: emptyPads,
      freeFieldCrateCount: 0,
    },
  );
  assert.equal(squadWipedWin.isGameOver, true);
  assert.equal(squadWipedWin.outcome, 'victory');
  assert.equal(squadWipedWin.winningTeam, 'blue');
  assert.equal(squadWipedWin.reason, 'squad_wiped_no_respawn_or_crates');

  // 5. Not eliminated if a starter unit is waiting to respawn at an intact base
  const stillRespawning = isTeamEliminatedInDeathmatch({
    team: 'red',
    baseHp: 900,
    commanderBases: intactRedBases,
    aliveUnitCount: 0,
    respawnableUnitCount: 1,
    padSlotsList: emptyPads,
    freeFieldCrateCount: 0,
  });
  assert.equal(stillRespawning.eliminated, false);
});

test('Self-Service Tactical Kiosk: Multi-Color Pad Hologram Slot Matching, Base Gold Upgrades & Crate Airdrop Shop', () => {
  // 1. Multi-color hologram slot hex mapping (Red #ff4d3d, Blue #00d2ff, Gold #ffd700)
  assert.equal(getHologramSlotHexColor('red'), 0xff4d3d);
  assert.equal(getHologramSlotHexColor('super'), 0x00d2ff);
  assert.equal(getHologramSlotHexColor('legend'), 0xffd700);

  // 2. When a mixed-color recipe like Laser Gun (1 Red + 1 Blue on 2x1x1) or Blitz Plane (7 Red/Blue + 1 Legend on 2x2x2) is selected,
  //    throwing a crate fills the slot whose hologram color matches the crate kind first!
  const planeHologram = KIOSK_BUILD_PRIORITY_RECIPES.blitz_plane.slotHologramColors;
  const slots: ('empty' | 'red' | 'super' | 'legend')[] = [
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
  ];
  // Throwing a Legend (Gold) crate first should immediately go into slot 6 (the first Gold hologram slot in blitz_plane)!
  const legendSlotIdx = chooseNextPadSlotIndexForHologram(slots, planeHologram, 'legend', '2x2x2');
  assert.equal(legendSlotIdx, 6, 'Legend crate jumps directly to the first Gold hologram slot (#6)');
  slots[legendSlotIdx] = 'legend';

  // Throwing a Rare (Blue) crate next should go into the first Blue hologram slot (#4)
  const superSlotIdx = chooseNextPadSlotIndexForHologram(slots, planeHologram, 'super', '2x2x2');
  assert.equal(superSlotIdx, 4, 'Super crate jumps to the first Blue hologram slot (#4)');
  slots[superSlotIdx] = 'super';

  // Throwing a Common (Red) crate goes into the first Red hologram slot (#0)
  const redSlotIdx = chooseNextPadSlotIndexForHologram(slots, planeHologram, 'red', '2x2x2');
  assert.equal(redSlotIdx, 0, 'Red crate fills the first Red hologram slot (#0)');

  // 3. Base Upgrade (Command Center + Fence) with expensive Warzone Gold
  const bases = createIndividualCommanderBasesState('blue');
  const myBase = bases[0];
  assert.equal(myBase.buildingLevel, 1);
  assert.equal(myBase.fenceLevel, 1);

  const specsLv1 = getCommanderBaseGoldUpgradeSpecs(myBase);
  assert.equal(specsLv1.upgrade_base_combo.costGold, 1200);

  // Insufficient gold fails cleanly
  const failUpgrade = applyCommanderBaseGoldUpgrade(myBase, 'upgrade_base_combo', 500);
  assert.equal(failUpgrade.upgraded, false);
  assert.equal(myBase.buildingLevel, 1);

  // Upgrading Command Center + Fence with 1500 Gold succeeds and deducts 1200 Gold
  const okUpgradeLv2 = applyCommanderBaseGoldUpgrade(myBase, 'upgrade_base_combo', 1500);
  assert.equal(okUpgradeLv2.upgraded, true);
  assert.equal(okUpgradeLv2.nextGold, 300);
  assert.equal(myBase.buildingLevel, 2);
  assert.equal(myBase.fenceLevel, 2);
  assert.equal(myBase.buildingMaxHp, 1000);
  assert.equal(myBase.fenceMaxHp, 1400);

  // 4. Purchasing Crates by Rarity with Gold triggers Airdrop
  assert.equal(KIOSK_CRATE_AIRDROP_SHOP.red.costGold, 150);
  assert.equal(KIOSK_CRATE_AIRDROP_SHOP.super.costGold, 350);
  assert.equal(KIOSK_CRATE_AIRDROP_SHOP.legend.costGold, 750);
  assert.equal(KIOSK_CRATE_AIRDROP_SHOP.medical.costGold, 200);

  const buyRare = purchaseCrateAirdropWithGold('super', 500);
  assert.equal(buyRare.purchased, true);
  assert.equal(buyRare.airdropCrateKind, 'super');
  assert.equal(buyRare.nextGold, 150);

  const buyLegendFail = purchaseCrateAirdropWithGold('legend', 150);
  assert.equal(buyLegendFail.purchased, false);
  assert.equal(buyLegendFail.airdropCrateKind, null);

  // 5. Smart AI Harvester Crate Selection: NEVER picks 'medical' crates or random wrong-colored crates!
  const infantryHolo = KIOSK_BUILD_PRIORITY_RECIPES.buddy_infantry.slotHologramColors; // Needs 2 'red' crates
  const emptySlots: ('empty' | 'red' | 'super' | 'legend')[] = [
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
  ];
  const fieldCrates = [
    { id: 1, x: 2, z: 0, kind: 'medical' as const, state: 'grounded' }, // Very close (2m), MUST be ignored!
    { id: 2, x: 4, z: 0, kind: 'legend' as const, state: 'grounded' },  // Close (4m), wrong color for Infantry!
    { id: 3, x: 5, z: 0, kind: 'super' as const, state: 'grounded' },   // Close (5m), wrong color for Infantry!
    { id: 4, x: 18, z: 0, kind: 'red' as const, state: 'grounded' },    // 18m away, exact match ('red')!
  ];

  const pickForInfantry = selectSmartCrateForAiHarvester(
    0,
    0,
    fieldCrates,
    emptySlots,
    infantryHolo,
    [],
    true,
  );
  assert.equal(
    pickForInfantry.selectedCrate?.id,
    4,
    'AI must skip closer medical/legend/super crates and pick the required red crate (#4)',
  );

  // 6. Teammate In-Flight Coordination: For Super Commando (1 'super' + 1 'red'), if Teammate #1 is already carrying 'super',
  //    Teammate #2 strictly picks 'red' instead of grabbing a duplicate 'super'!
  const commandoHolo = KIOSK_BUILD_PRIORITY_RECIPES.buddy_commando.slotHologramColors; // ['super', ..., 'red', ...]
  const pickForSecondBuddy = selectSmartCrateForAiHarvester(
    0,
    0,
    fieldCrates,
    emptySlots,
    commandoHolo,
    ['super'],
    true,
  );
  assert.deepEqual(pickForSecondBuddy.neededColors, ['red']);
  assert.equal(
    pickForSecondBuddy.selectedCrate?.id,
    4,
    'Second AI Buddy must fetch the remaining needed red crate (#4) when a teammate is already carrying super',
  );

  // 7. Hologram Disappears Once Build Target Is Fulfilled or Crafted (`evaluatePadHologramState`):
  //    a) Active 1-crate Super Shotgun target ('assault_plasma') at 0/1 crates shows slot 0 ('super') hologram and outer pattern box:
  const holoBeforeFill = evaluatePadHologramState(
    true,
    true,
    'assault_plasma',
    emptySlots,
  );
  assert.equal(holoBeforeFill.isActive, true);
  assert.equal(holoBeforeFill.isFulfilled, false);
  assert.equal(holoBeforeFill.showPatternOutlineBox, true);
  assert.equal(holoBeforeFill.slotGhostColors[0], 'super');

  //    b) Once slot 0 is filled with 'super' (1/1 crates fulfilled), the hologram disappears completely:
  const filledShotgunSlots: ('empty' | 'red' | 'super' | 'legend')[] = [
    'super',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
  ];
  const holoWhenFilled = evaluatePadHologramState(
    true,
    true,
    'assault_plasma',
    filledShotgunSlots,
  );
  assert.equal(holoWhenFilled.isFulfilled, true);
  assert.equal(holoWhenFilled.showPatternOutlineBox, false);
  assert.deepEqual(holoWhenFilled.slotGhostColors, emptySlots);

  //    c) After crafting resets `useCustomHologramRecipe = false` on the emptied pad (0/1 crates),
  //       the hologram stays hidden (`showPatternOutlineBox = false`, all `slotGhostColors = 'empty'`)!
  const holoAfterCraft = evaluatePadHologramState(
    true,
    false,
    'assault_plasma',
    emptySlots,
  );
  assert.equal(holoAfterCraft.isActive, false);
  assert.equal(holoAfterCraft.showPatternOutlineBox, false);
  assert.deepEqual(holoAfterCraft.slotGhostColors, emptySlots);

  // 8. Command Center Level Radar Coverage & Minimap Calibration:
  const radarLv1 = evaluateCommandCenterRadarSpec(1);
  const radarLv2 = evaluateCommandCenterRadarSpec(2);
  const radarLv3 = evaluateCommandCenterRadarSpec(3);
  assert.ok(radarLv1.baseRadarRadius < radarLv2.baseRadarRadius);
  assert.ok(radarLv2.baseRadarRadius < radarLv3.baseRadarRadius);
  assert.equal(radarLv1.fullMapUnlocked, false);
  assert.equal(radarLv3.fullMapUnlocked, true);

  const centerPct = worldCoordToRadarPercent(0, 0);
  assert.equal(centerPct.leftPct, 50);
  assert.equal(centerPct.topPct, 50);

  // At Lv.1, an enemy inside Red Base (0, -81.7) is hidden when player is at Blue Base (-45, 75),
  // but becomes visible once Command Center is upgraded to Lv.3:
  assert.equal(
    isPointVisibleOnCommandCenterRadar(0, -81.7, false, 1, 0, 81.7, -45, 75),
    false,
  );
  assert.equal(
    isPointVisibleOnCommandCenterRadar(0, -81.7, false, 3, 0, 81.7, -45, 75),
    true,
  );

  // 9. Nuclear Launcher Lv.3 Command Center Gate & Silhouette Reveal + LG-88 Laser Rifle Projectile Spec:
  const nukeLv1 = evaluateNuclearLauncherAccess(1);
  const nukeLv2 = evaluateNuclearLauncherAccess(2);
  const nukeLv3 = evaluateNuclearLauncherAccess(3);
  assert.equal(nukeLv1.allowed, false);
  assert.equal(nukeLv1.isRevealed, false);
  assert.equal(nukeLv2.allowed, false);
  assert.equal(nukeLv2.isRevealed, false);
  assert.equal(nukeLv3.allowed, true);
  assert.equal(nukeLv3.isRevealed, true);
  assert.equal(nukeLv3.maxLockRangeMeters, 280.0);
  assert.equal(KIOSK_BUILD_PRIORITY_RECIPES.nuclear_launcher.requiresCommandCenterLevel, 3);
  assert.equal(getWeaponProjectileVisualSpec('NuclearMissile').shellKind, 'boss');
  assert.equal(getWeaponProjectileVisualSpec('BlitzLaserGun').length, 0.72);
});

test('CB-24 Cluster Bomb requires Command Center Lv.3, is Plane-only, and upgrade_super_command_lv3 directly unlocks Lv.3', () => {
  const cbLv1 = evaluateClusterBombAccess(1, true);
  const cbLv2 = evaluateClusterBombAccess(2, true);
  const cbLv3OnFoot = evaluateClusterBombAccess(3, false);
  const cbLv3InPlane = evaluateClusterBombAccess(3, true);

  assert.equal(cbLv1.isRevealed, false);
  assert.equal(cbLv1.allowedToBuild, false);
  assert.equal(cbLv1.canDropNow, false);
  assert.equal(cbLv2.isRevealed, false);
  assert.equal(cbLv2.allowedToBuild, false);
  assert.equal(cbLv3OnFoot.isRevealed, true);
  assert.equal(cbLv3OnFoot.allowedToBuild, true);
  assert.equal(cbLv3OnFoot.canDropNow, false);
  assert.equal(cbLv3InPlane.isRevealed, true);
  assert.equal(cbLv3InPlane.allowedToBuild, true);
  assert.equal(cbLv3InPlane.canDropNow, true);
  assert.equal(KIOSK_BUILD_PRIORITY_RECIPES.cluster_bomb.requiresCommandCenterLevel, 3);
  assert.equal(KIOSK_BUILD_PRIORITY_RECIPES.cluster_bomb.onlyUsableByPlane, true);

  const bases = createIndividualCommanderBasesState('blue');
  const upgRes = applyCommanderBaseGoldUpgrade(bases[0], 'upgrade_super_command_lv3', 2500);
  assert.equal(upgRes.upgraded, true);
  assert.equal(bases[0].buildingLevel, 3);
  assert.equal(bases[0].fenceLevel, 3);
  assert.equal(evaluateNuclearLauncherAccess(bases[0].buildingLevel).isRevealed, true);
  assert.equal(evaluateClusterBombAccess(bases[0].buildingLevel, true).isRevealed, true);
});

test('Nuclear Launcher 4-phase sequence: map zoom-out targeting -> cinematic rocket chase -> pre-impact camera rise (not too far) -> return to origin', () => {
  const originPlayerPos = { x: -45, y: 1.0, z: 75 };
  const launchPos = { x: -48, y: 2.35, z: 70 };
  const initialTarget = { x: -10, y: 0, z: 20 };

  // 0. Starts idle
  let state = createInitialNuclearStrikeState();
  assert.equal(state.phase, 'idle');

  // 1. Activate Nuclear Launcher -> enters 'targeting' (Map Zoom-Out)
  state = beginNuclearStrikeTargeting(originPlayerPos, launchPos, initialTarget);
  assert.equal(state.phase, 'targeting');
  state = stepNuclearStrikeSequence(state, 0.5).state;
  const zoomOutCam = computeNuclearStrikeCameraPose(state);
  assert.ok(zoomOutCam.cameraPos.y > 95, 'Camera zooms out high above map during targeting');

  // Player moves cursor to select target at (12, 0, -45)
  state = updateNuclearStrikeTargetCursor(state, 12, 0, -45, 280);
  assert.equal(state.targetPos.x, 12);
  assert.equal(state.targetPos.z, -45);

  // 2. Confirm target -> transitions to 'tracking_rocket'
  state = confirmNuclearStrikeTargetAndLaunch(state);
  assert.equal(state.phase, 'tracking_rocket');

  // Early/mid flight (u ~ 0.35): camera follows closely behind the flying rocket
  state = stepNuclearStrikeSequence(state, state.flightDurationSec * 0.35).state;
  assert.equal(state.phase, 'tracking_rocket');
  const midFlightCam = computeNuclearStrikeCameraPose(state);
  assert.equal(midFlightCam.isPreImpactRising, false);
  const camToRocketDist = Math.hypot(
    midFlightCam.cameraPos.x - state.rocketPos.x,
    midFlightCam.cameraPos.y - state.rocketPos.y,
    midFlightCam.cameraPos.z - state.rocketPos.z,
  );
  assert.ok(camToRocketDist < 14.0, 'Cinematic camera follows closely behind the flying rocket');

  // 3. Approaching target (u ~ 0.85): camera rises upward and watches impact from close-medium distance (not too far!)
  state = stepNuclearStrikeSequence(state, state.flightDurationSec * 0.5).state;
  assert.equal(state.phase, 'tracking_rocket');
  const preImpactCam = computeNuclearStrikeCameraPose(state);
  assert.equal(preImpactCam.isPreImpactRising, true);
  assert.ok(preImpactCam.cameraPos.y > state.targetPos.y + 10.0, 'Camera rises above target before impact');
  assert.ok(
    preImpactCam.horizontalDistToTarget < 20.0,
    'Camera stays close enough to watch the explosion clearly (not too far)',
  );

  // 4. Rocket reaches target (u = 1.0) -> triggers detonation & transitions to 'watching_explosion'
  const impactStep = stepNuclearStrikeSequence(state, state.flightDurationSec * 0.25);
  state = impactStep.state;
  assert.equal(impactStep.justDetonated, true);
  assert.equal(state.phase, 'watching_explosion');
  const explosionCam = computeNuclearStrikeCameraPose(state);
  assert.ok(
    explosionCam.horizontalDistToTarget >= 12.0 && explosionCam.horizontalDistToTarget <= 18.0,
    'Explosion observation camera is at ideal close-medium distance (~14-16m, not too far)',
  );

  // 5. Finish watching explosion -> transitions to 'returning' -> returns smoothly to original player position
  state = stepNuclearStrikeSequence(state, state.explosionWatchDurationSec + 0.05).state;
  assert.equal(state.phase, 'returning');
  state = stepNuclearStrikeSequence(state, state.returnDurationSec * 0.99).state;
  const nearEndReturnCam = computeNuclearStrikeCameraPose(state, { x: 0, y: 16.5, z: 19.5 });
  assert.ok(Math.abs(nearEndReturnCam.cameraPos.x - originPlayerPos.x) < 1.0);
  assert.ok(Math.abs(nearEndReturnCam.cameraPos.z - (originPlayerPos.z + 19.5)) < 1.0);

  const finishStep = stepNuclearStrikeSequence(state, 0.1);
  assert.equal(finishStep.justCompletedReturn, true);
  assert.equal(finishStep.state.phase, 'idle');
});

test('Chunk-Synced 3D Fog of War & Personal Command Center Radar Operator (Lv.1=45%, Lv.2=75%, Lv.3=100%)', () => {
  // 1. 3D Grass Chunk Visibility & Smooth Inner Edge Scale Transition
  assert.equal(GRASS_CHUNK_STREAM_RADIUS, 21.0);
  assert.equal(GRASS_CHUNK_FADE_START_RADIUS, 18.9);
  const insideVis = evaluateGrassChunkVisibilityFactor(0, 0, 10, 0);
  assert.equal(insideVis.visible, true);
  assert.equal(insideVis.scaleFactor, 1);

  const edgeVis = evaluateGrassChunkVisibilityFactor(0, 0, 20.0, 0);
  assert.equal(edgeVis.visible, true);
  assert.ok(edgeVis.scaleFactor > 0.05 && edgeVis.scaleFactor < 0.95);

  const outsideVis = evaluateGrassChunkVisibilityFactor(0, 0, 22.5, 0);
  assert.equal(outsideVis.visible, false);
  assert.equal(outsideVis.scaleFactor, 0);

  // 2. Land Mine Grass Camouflage Y-Offset (-0.04m in grass, 0m on road/concrete)
  assert.equal(computeLandMineGrassYOffset(0.85), LAND_MINE_GRASS_Y_OFFSET);
  assert.equal(computeLandMineGrassYOffset(0.05), 0);

  // 3. Command Center Radar Levels (45% / 75% / 100%)
  const lv1 = evaluateCommandCenterRadarSpec(1);
  const lv2 = evaluateCommandCenterRadarSpec(2);
  const lv3 = evaluateCommandCenterRadarSpec(3);
  assert.equal(lv1.coveragePct, 45);
  assert.equal(lv2.coveragePct, 75);
  assert.equal(lv3.coveragePct, 100);
  assert.equal(lv1.playerVisionRadius, 21.0);

  // 4. Personal Command Center Radar Operator Responsibility:
  //    Plot 0 is at x = -45.0, buildingZ = 91.5, padZ = 77.8
  const bases = createIndividualCommanderBasesState('blue');
  const myPlot = bases[0];
  assert.equal(myPlot.commandCenterLevel, 1);
  assert.equal(isUnitInPersonalCommandCenterArea(-45.0, 88.0, myPlot), true);
  assert.equal(isUnitInPersonalCommandCenterArea(0.0, 0.0, myPlot), false);

  // Case A: Player is in the field (0, 0), Teammate AI (ownerCommanderId = 1) is standing in our plot -> Radar MUST STAY OFF!
  const withTeammateOnly = evaluatePersonalCommandCenterRadarOperator(
    myPlot,
    [
      {
        id: 101,
        alive: true,
        team: 'blue',
        ownerCommanderId: 1,
        command: 'DEFEND',
        x: -45.0,
        z: 88.0,
      },
    ],
    {
      team: 'blue',
      ownerCommanderId: 0,
      alive: true,
      x: 0,
      z: 0,
    },
  );
  assert.equal(withTeammateOnly.radarActive, false);

  // Case B: Player's own squad unit (ownerCommanderId = 0) is in our plot, but role is HARVEST -> Radar stays OFF
  const withOwnHarvesterAtBase = evaluatePersonalCommandCenterRadarOperator(
    myPlot,
    [
      {
        id: 102,
        alive: true,
        team: 'blue',
        ownerCommanderId: 0,
        command: 'HARVEST',
        x: -45.0,
        z: 88.0,
      },
    ],
    {
      team: 'blue',
      ownerCommanderId: 0,
      alive: true,
      x: 0,
      z: 0,
    },
  );
  assert.equal(withOwnHarvesterAtBase.radarActive, false);

  // Case C: Player's own squad unit (ownerCommanderId = 0) is set to DEFEND and stationed in our Command Center plot -> Radar ACTIVE!
  const withOwnDefenderAtBase = evaluatePersonalCommandCenterRadarOperator(
    myPlot,
    [
      {
        id: 103,
        alive: true,
        team: 'blue',
        ownerCommanderId: 0,
        command: 'DEFEND',
        x: -45.0,
        z: 88.0,
      },
    ],
    {
      team: 'blue',
      ownerCommanderId: 0,
      alive: true,
      x: 0,
      z: 0,
    },
  );
  assert.equal(withOwnDefenderAtBase.radarActive, true);
  assert.equal(withOwnDefenderAtBase.operatorSource, 'own_defend_unit');

  // Case D: Player's main character themselves is inside their own Command Center plot -> Radar ACTIVE!
  const withPlayerAtBase = evaluatePersonalCommandCenterRadarOperator(
    myPlot,
    [],
    {
      team: 'blue',
      ownerCommanderId: 0,
      alive: true,
      x: -45.0,
      z: 88.0,
    },
  );
  assert.equal(withPlayerAtBase.radarActive, true);
  assert.equal(withPlayerAtBase.operatorSource, 'player_in_command_center');

  // Case E: When radarActive = false, enemy outside 21m circle is completely invisible even at Lv.3!
  assert.equal(
    isPointVisibleOnCommandCenterRadar(0, -50, false, 3, -45, 91.5, 0, 0, false),
    false,
  );
  // Enemy within 21m grass chunk circle around player (0, 0) is visible even when radar is OFF:
  assert.equal(
    isPointVisibleOnCommandCenterRadar(10, 10, false, 1, -45, 91.5, 0, 0, false),
    true,
  );
});

test('Dynamic Supply Drop Event alternates between CENTRAL OASIS and HARBOR DOCK every 45-70s, shows 15s countdown banner, and drops 5-8 Gold Coins (@ +150G), 2-3 Medkits, and 1 Indestructible Metallic Box (65% Silver / 35% Gold)', () => {
  // 1. Interval bounds (45-70s)
  assert.equal(computeNextSupplyDropIntervalSec(() => 0), 45.0);
  assert.equal(computeNextSupplyDropIntervalSec(() => 1), 70.0);

  // 2. Countdown banner formatting
  assert.equal(
    formatSupplyDropCountdownBanner('CENTRAL OASIS', 14.2),
    'SUPPLY DROP AT CENTRAL OASIS IN 15 SECONDS!',
  );
  assert.equal(
    formatSupplyDropCountdownBanner('HARBOR DOCK', 5.0),
    'SUPPLY DROP AT HARBOR DOCK IN 5 SECONDS!',
  );

  // 3. Payload generation: 65% Silver Metallic Box vs 35% Shiny Gold Metallic Box
  const silverPayload = generateSupplyDropLandingPayload('CENTRAL_OASIS', () => 0.40);
  assert.equal(silverPayload.locationId, 'CENTRAL_OASIS');
  assert.equal(silverPayload.x, SUPPLY_DROP_LOCATIONS.CENTRAL_OASIS.x);
  assert.equal(silverPayload.z, SUPPLY_DROP_LOCATIONS.CENTRAL_OASIS.z);
  assert.equal(silverPayload.metallicCrateKind, 'silver_metallic');
  assert.equal(silverPayload.indestructible, true);
  assert.equal(silverPayload.goldCoinValue, 150);
  assert.ok(silverPayload.goldCoinCount >= 5 && silverPayload.goldCoinCount <= 8);
  assert.ok(silverPayload.medkitCount >= 2 && silverPayload.medkitCount <= 3);

  const goldPayload = generateSupplyDropLandingPayload('HARBOR_DOCK', () => 0.85);
  assert.equal(goldPayload.locationId, 'HARBOR_DOCK');
  assert.equal(goldPayload.metallicCrateKind, 'gold_metallic');
  assert.equal(goldPayload.indestructible, true);

  // 4. Schedule state stepping alternates CENTRAL_OASIS -> HARBOR_DOCK -> CENTRAL_OASIS
  let sched = createInitialSupplyDropScheduleState(() => 0.0); // 45s initial countdown
  assert.equal(sched.nextLocationId, 'CENTRAL_OASIS');
  assert.equal(sched.warningActive, false);

  for (let i = 0; i < 31; i++) {
    sched = stepSupplyDropSchedule(sched, 1.0, () => 0.2).state;
  }
  // 14s remaining -> warning active!
  assert.equal(sched.warningActive, true);
  assert.ok(sched.bannerText?.includes('CENTRAL OASIS IN 14 SECONDS'));

  for (let i = 0; i < 13; i++) {
    sched = stepSupplyDropSchedule(sched, 1.0, () => 0.2).state;
  }
  const landingStep = stepSupplyDropSchedule(sched, 1.0, () => 0.9); // Lands!
  assert.ok(landingStep.landedPayload !== null);
  assert.equal(landingStep.landedPayload?.locationId, 'CENTRAL_OASIS');
  assert.equal(landingStep.landedPayload?.metallicCrateKind, 'gold_metallic');
  assert.equal(landingStep.state.nextLocationId, 'HARBOR_DOCK');
});

test('Indestructible Metallic Crates cannot be damaged/destroyed and grant instant full Stacking Pad boosts (+300G Overpower Weapon for Silver, +600G 2x2x2 Overpower Vehicle for Gold)', () => {
  // 1. Indestructibility check
  assert.equal(canDamageWorldCrate({ kind: 'red' }), true);
  assert.equal(canDamageWorldCrate({ kind: 'super' }), true);
  assert.equal(canDamageWorldCrate({ kind: 'legend' }), true);
  assert.equal(canDamageWorldCrate({ kind: 'silver_metallic' }), false);
  assert.equal(canDamageWorldCrate({ kind: 'gold_metallic' }), false);
  assert.equal(canDamageWorldCrate({ kind: 'red', indestructible: true }), false);

  // 2. Silver Metallic Box Pad Boost -> Instant Overpower Weapon + 300 G
  const silverBoost = evaluateSpecialMetallicCratePadBoost('silver_metallic');
  assert.equal(silverBoost.kind, 'silver_metallic');
  assert.equal(silverBoost.bonusGold, 300);
  assert.equal(silverBoost.boostType, 'overpower_weapon');
  assert.equal(silverBoost.buildOrder, '2x2x1');

  // 3. Shiny Gold Metallic Box Pad Boost -> Instant 2x2x2 Overpower Vehicle (Heavy Tank) + 600 G
  const goldBoost = evaluateSpecialMetallicCratePadBoost('gold_metallic');
  assert.equal(goldBoost.kind, 'gold_metallic');
  assert.equal(goldBoost.bonusGold, 600);
  assert.equal(goldBoost.boostType, 'overpower_vehicle');
  assert.equal(goldBoost.buildOrder, '2x2x2');
  assert.equal(goldBoost.filledSlots.filter((s) => s !== 'empty').length, 8);
});

test('Role UI formatting uses "Role : <Noun>" and Autonomous Tactical Escort AI eliminates rigid mirroring on Follower role', () => {
  // 1. Role UI format
  assert.equal(formatBuddyRoleUiLabel('HARVEST'), 'Role : Harvester');
  assert.equal(formatBuddyRoleUiLabel('ATTACK'), 'Role : Attacker');
  assert.equal(formatBuddyRoleUiLabel('FOLLOW'), 'Role : Follower');
  assert.equal(formatBuddyRoleUiLabel('DEFEND'), 'Role : Defender');

  // 2. Comfort Zone (2.5m - 4.2m): Follower stays relaxed and does NOT mirror small player shifts
  const inComfortZone = evaluateAutonomousFollowerEscortStep({
    followerId: '2',
    followerX: 0,
    followerZ: 0,
    followerVx: 0,
    followerVz: 0,
    followerYaw: 0,
    followerMaxSpeed: 7.1,
    followerCarryingCrate: false,
    reactionTimerSec: 0,
    idleLookTimerSec: 1.0,
    idleLookYaw: 0.5,
    strafeTimerSec: 0.5,
    strafeSign: 1,
    playerX: 3.2,
    playerZ: 0,
    playerVx: 0,
    playerVz: 0,
    playerCarryingCrate: false,
    alliedFollowers: [],
    nearestEnemy: null,
    nearbyItemsAndCrates: [],
    combatRangeMeters: 15.5,
    dt: 0.05,
  });
  assert.equal(inComfortZone.isInsideComfortZone, true);
  assert.ok(Math.hypot(inComfortZone.vx, inComfortZone.vz) < 0.01, 'Follower inside comfort zone must not mirror small player movements');

  // 3. Delayed Elastic Pursuit: When leader moves > 4.2m away, Follower waits 0.22s reaction delay before pursuing smoothly
  const preReaction = evaluateAutonomousFollowerEscortStep({
    followerId: '2',
    followerX: 0,
    followerZ: 0,
    followerVx: 0,
    followerVz: 0,
    followerYaw: 0,
    followerMaxSpeed: 7.1,
    followerCarryingCrate: false,
    reactionTimerSec: 0,
    idleLookTimerSec: 1.0,
    idleLookYaw: 0,
    strafeTimerSec: 0.5,
    strafeSign: 1,
    playerX: 8.0,
    playerZ: 0,
    playerVx: 5.0,
    playerVz: 0,
    playerCarryingCrate: false,
    alliedFollowers: [],
    nearestEnemy: null,
    nearbyItemsAndCrates: [],
    combatRangeMeters: 15.5,
    dt: 0.10, // < 0.22s reaction threshold
  });
  assert.equal(preReaction.isPursuingPlayer, false);
  assert.ok(preReaction.reactionTimerSec > 0.09);

  const postReaction = evaluateAutonomousFollowerEscortStep({
    followerId: '2',
    followerX: 0,
    followerZ: 0,
    followerVx: preReaction.vx,
    followerVz: preReaction.vz,
    followerYaw: preReaction.yaw,
    followerMaxSpeed: 7.1,
    followerCarryingCrate: false,
    reactionTimerSec: 0.16,
    idleLookTimerSec: 1.0,
    idleLookYaw: 0,
    strafeTimerSec: 0.5,
    strafeSign: 1,
    playerX: 8.0,
    playerZ: 0,
    playerVx: 5.0,
    playerVz: 0,
    playerCarryingCrate: false,
    alliedFollowers: [],
    nearestEnemy: null,
    nearbyItemsAndCrates: [],
    combatRangeMeters: 15.5,
    dt: 0.08, // crosses 0.22s reaction threshold -> pursues!
  });
  assert.equal(postReaction.isPursuingPlayer, true);
  assert.ok(postReaction.vx > 0.2, 'Follower must smoothly accelerate toward leader after reaction delay');

  // 4. Independent Combat Engagement: When enemy enters weapon range, Follower independently aims and strafes
  const combatStep = evaluateAutonomousFollowerEscortStep({
    followerId: '2',
    followerX: 0,
    followerZ: 0,
    followerVx: 0,
    followerVz: 0,
    followerYaw: 0,
    followerMaxSpeed: 7.1,
    followerCarryingCrate: false,
    reactionTimerSec: 0,
    idleLookTimerSec: 1.0,
    idleLookYaw: 0,
    strafeTimerSec: 0.5,
    strafeSign: 1,
    playerX: 3.0,
    playerZ: 0,
    playerVx: 0,
    playerVz: 0,
    playerCarryingCrate: false,
    alliedFollowers: [],
    nearestEnemy: { x: 0, z: -10.0, dist: 10.0 },
    nearbyItemsAndCrates: [],
    combatRangeMeters: 15.5,
    dt: 0.08,
  });
  assert.equal(combatStep.isEngagingEnemy, true);
  assert.equal(combatStep.shouldFire, true);
  assert.ok(Math.hypot(combatStep.vx, combatStep.vz) > 0.2, 'Follower must strafe tactically while engaging enemy');
  assert.ok(combatStep.yaw > 0, 'Follower must smoothly rotate yaw toward enemy at (0, -10)');

  // 5. Proactive Nearby (< 3.0m) Pickup / Crate Collection when out of combat
  const pickupStep = evaluateAutonomousFollowerEscortStep({
    followerId: '2',
    followerX: 0,
    followerZ: 0,
    followerVx: 0,
    followerVz: 0,
    followerYaw: 0,
    followerMaxSpeed: 7.1,
    followerCarryingCrate: false,
    reactionTimerSec: 0,
    idleLookTimerSec: 1.0,
    idleLookYaw: 0,
    strafeTimerSec: 0.5,
    strafeSign: 1,
    playerX: 3.0,
    playerZ: 0,
    playerVx: 0,
    playerVz: 0,
    playerCarryingCrate: false,
    alliedFollowers: [],
    nearestEnemy: null,
    nearbyItemsAndCrates: [{ id: 'crate_99', kind: 'crate', x: 0, z: 2.2, dist: 2.2 }],
    combatRangeMeters: 15.5,
    dt: 0.08,
  });
  assert.equal(pickupStep.targetPickupOrCrateId, 'crate_99');
  assert.ok(pickupStep.vz > 0.2, 'Follower must move toward nearby < 3.0m item/crate');

  // 6. HARVEST role never falls back to FOLLOW_COMMANDER even when pad is temporarily full or no crates are nearby
  const harvestWhenNoCrate = evaluateBuiltBuddySmartAiDecision({
    buddyClass: 'Infuntry',
    weaponId: 'pistol',
    carryingCrate: false,
    hp: 100,
    maxHp: 100,
    commandMode: 'HARVEST',
    ownerBuildOrder: '1x1x2',
    ownerPadHasSpace: false,
    ownerPadReadyToCraft: false,
    ownerIsAiCommander: false,
    ownerAliveBuddyCount: 2,
    ownerHasBuiltTurret: true,
    ownerHasBuiltVehicle: false,
    woundedAllyDist: null,
    nearestEnemyDist: null,
    nearestFreeCrateDist: null,
    nearestGroundWeaponDist: null,
    nearestEmptyVehicleDist: null,
  });
  assert.equal(
    harvestWhenNoCrate.action,
    'HARVEST_CRATE',
    'Unit in HARVEST role must stay on HARVEST_CRATE duty and NEVER fall back to FOLLOW_COMMANDER',
  );

  // 7. Intelligent FOLLOW A* Pathfinder around obstacle wall:
  //    Build a solid fence wall at z = 0 from x = -20 to x = +8 (gate opening at x > +8).
  //    Follower is at (0, -8) and player is at (0, +8) on the other side of the fence.
  //    Instead of walking straight +Z into the wall, Follower uses its own A* pathfinder to steer +X toward the gate!
  const obstacleGrid = createAStarNavGrid(-24, 24, -24, 24, 1.5);
  rasterizeObbObstacleToNavGrid(obstacleGrid, -6.0, 0.0, 14.0, 0.75, 0, 0.45);
  const pathfoundFollow = evaluateAutonomousFollowerEscortStep({
    followerId: '3',
    followerX: 0,
    followerZ: -8,
    followerVx: 0,
    followerVz: 0,
    followerYaw: 0,
    followerMaxSpeed: 7.1,
    followerCarryingCrate: false,
    reactionTimerSec: 0.30,
    idleLookTimerSec: 1.0,
    idleLookYaw: 0,
    strafeTimerSec: 0.5,
    strafeSign: 1,
    playerX: 0,
    playerZ: 8,
    playerVx: -6.0, // Player moving -X, Follower must NOT mirror -X and must instead route +X to the gate!
    playerVz: 0,
    playerCarryingCrate: false,
    alliedFollowers: [],
    nearestEnemy: null,
    nearbyItemsAndCrates: [],
    combatRangeMeters: 15.5,
    navGrid: obstacleGrid,
    dt: 0.08,
  });
  assert.equal(pathfoundFollow.isPursuingPlayer, true);
  assert.equal(pathfoundFollow.usedAStarPathfinding, true);
  assert.ok(pathfoundFollow.pathWaypoints.length > 4);
  assert.ok(
    pathfoundFollow.vx > 0.25,
    'Follower must steer +X toward the open gate via its own A* pathfinder (even while player moves -X)',
  );
});

test('AI excludes crates inside teammate/enemy bases, Kiosk supports max-6 continuous auto-burst build queue, and unarmed Attacker returns to base weapon stock', () => {
  // 1. Base Crate Exclusion: AI belonging to Blue Plot 0 (centerX = -45, centerZ = 75)
  //    - Crate inside Blue Plot 0 (-46.8, 68.5) -> ALLOWED (false)
  //    - Crate inside Teammate Blue Plot 1 (-15.0, 68.5) -> EXCLUDED (true)
  //    - Crate inside Enemy Red Plot 0 (-45.0, -68.5) -> EXCLUDED (true)
  //    - Crate in Open Warzone (0.0, 12.0) -> ALLOWED (false)
  assert.equal(isCrateInsideOtherOrEnemyBase(-46.8, 68.5, 'blue', 0), false);
  assert.equal(isCrateInsideOtherOrEnemyBase(-15.0, 68.5, 'blue', 0), true);
  assert.equal(isCrateInsideOtherOrEnemyBase(15.0, 68.5, 'blue', 0), true);
  assert.equal(isCrateInsideOtherOrEnemyBase(-45.0, -68.5, 'blue', 0), true);
  assert.equal(isCrateInsideOtherOrEnemyBase(0.0, 12.0, 'blue', 0), false);

  const selectedCrate = selectSmartCrateForAiHarvester(
    -20.0,
    55.0,
    [
      // Closer crate, but inside teammate Blue Plot 1 -> MUST BE IGNORED
      { id: 1, kind: 'red' as const, x: -15.0, z: 68.5, state: 'grounded' },
      // Crate inside Enemy Red Base -> MUST BE IGNORED
      { id: 2, kind: 'red' as const, x: -15.0, z: -68.5, state: 'grounded' },
      // Crate in open warzone -> MUST BE SELECTED
      { id: 3, kind: 'red' as const, x: -20.0, z: 25.0, state: 'grounded' },
    ],
    ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    ['red', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    [],
    true,
    'blue',
    0,
  );
  assert.equal(
    selectedCrate.selectedCrate?.id,
    3,
    'AI Harvester must ignore crates inside teammate or enemy bases',
  );

  // 2. Continuous Build Queue (max 6 items) + Auto-Burst when Hologram Fulfilled
  assert.equal(MAX_KIOSK_BUILD_QUEUE, 6);
  let qRes = enqueueKioskBuildRecipe([], 'pistol_uzi');
  qRes = enqueueKioskBuildRecipe(qRes.queue, 'assault_plasma');
  qRes = enqueueKioskBuildRecipe(qRes.queue, 'bazooka');
  qRes = enqueueKioskBuildRecipe(qRes.queue, 'buddy_infantry');
  qRes = enqueueKioskBuildRecipe(qRes.queue, 'gatling_mortar');
  qRes = enqueueKioskBuildRecipe(qRes.queue, 'laser_gun');
  // 7th item should be rejected (capped at 6)
  const overflowQueue = enqueueKioskBuildRecipe(qRes.queue, 'supazooka');
  assert.equal(qRes.queue.length, 6);
  assert.equal(overflowQueue.enqueued, false);
  assert.equal(overflowQueue.queue.length, 6);

  // When 'pistol_uzi' (needs 1 'red' crate in slot 0) has its hologram target fulfilled,
  // evaluatePadHologramState reports isFulfilled = true so the box bursts automatically without kicking [F]
  const uziPadState = evaluatePadHologramState(true, true, 'pistol_uzi', [
    'red',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
  ]);
  assert.equal(uziPadState.isFulfilled, true);

  // Advancing the build queue after auto-bursting 'pistol_uzi' activates 'assault_plasma' next
  const afterFirstCraft = advanceKioskBuildQueueOnCraft(qRes.queue);
  assert.equal(afterFirstCraft.queue.length, 5);
  assert.equal(afterFirstCraft.nextActiveRecipe, 'assault_plasma');

  // Removing index 1 ('bazooka') leaves 4 items
  const afterRemove = removeKioskBuildQueueAtIndex(afterFirstCraft.queue, 1);
  assert.equal(afterRemove.queue.length, 4);
  assert.equal(afterRemove.queue[0], 'assault_plasma');
  assert.equal(afterRemove.queue[1], 'buddy_infantry');

  // 3. Unarmed Attacker AI Intelligence: returns to base weapon stock when unarmed
  const unarmedAttackerWithStockAtBase = evaluateBuiltBuddySmartAiDecision({
    buddyClass: 'Infuntry',
    weaponId: 'unarmed',
    carryingCrate: false,
    hp: 100,
    maxHp: 100,
    commandMode: 'ATTACK',
    ownerBuildOrder: '1x1x1',
    ownerPadHasSpace: true,
    ownerPadReadyToCraft: false,
    ownerIsAiCommander: false,
    ownerAliveBuddyCount: 2,
    ownerHasBuiltTurret: false,
    ownerHasBuiltVehicle: false,
    woundedAllyDist: null,
    nearestEnemyDist: 30,
    nearestFreeCrateDist: 10,
    nearestGroundWeaponDist: 95, // Far away back at base pad stock
    nearestEmptyVehicleDist: null,
  });
  assert.equal(
    unarmedAttackerWithStockAtBase.action,
    'EQUIP_GROUND_WEAPON',
    'Unarmed Attacker must travel back to base weapon stock even when far away (> 36m)',
  );

  const unarmedAttackerWaitingForStock = evaluateBuiltBuddySmartAiDecision({
    buddyClass: 'Infuntry',
    weaponId: 'unarmed',
    carryingCrate: false,
    hp: 100,
    maxHp: 100,
    commandMode: 'ATTACK',
    ownerBuildOrder: '1x1x1',
    ownerPadHasSpace: true,
    ownerPadReadyToCraft: false,
    ownerIsAiCommander: false,
    ownerAliveBuddyCount: 2,
    ownerHasBuiltTurret: false,
    ownerHasBuiltVehicle: false,
    woundedAllyDist: null,
    nearestEnemyDist: 30,
    nearestFreeCrateDist: 10,
    nearestGroundWeaponDist: null, // No weapon dropped yet -> return to base pad stock area
    nearestEmptyVehicleDist: null,
  });
  assert.equal(
    unarmedAttackerWaitingForStock.action,
    'EQUIP_GROUND_WEAPON',
    'Unarmed Attacker without any weapon must return to base weapon stock area instead of charging unarmed',
  );

  // 4. Kiosk Side Platform 3D Hologram Shape & Progress Counter (e.g. "1/4", "1/2")
  const gatlingHolo = evaluateKioskSideHologramDisplay(
    true,
    'gatling_mortar',
    '2x2x1',
    ['super', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    ['gatling_mortar', 'buddy_infantry'],
  );
  assert.equal(gatlingHolo.visible, true);
  assert.equal(gatlingHolo.modelKind, 'gatling_mortar');
  assert.equal(gatlingHolo.progressFractionText, '1/4');
  assert.equal(gatlingHolo.filledCrates, 1);
  assert.equal(gatlingHolo.targetCrates, 4);
  assert.ok(gatlingHolo.subtitleText.includes('1/4'));
  assert.ok(gatlingHolo.titleText.includes('TITAN-6 ROTARY GATLING'));

  const squadHolo = evaluateKioskSideHologramDisplay(
    true,
    'buddy_infantry',
    '1x1x2',
    ['red', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    ['buddy_infantry'],
  );
  assert.equal(squadHolo.modelKind, 'buddy_unit');
  assert.equal(squadHolo.progressFractionText, '1/2');

  // 5. Kicking ([F]) stacked boxes on Crate Pad cancels build and shatters into small items (Pistol, Grenade, Medkit, etc.)
  const emptyCancel = evaluatePadCancelKickShatterDrops([
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
  ]);
  assert.equal(emptyCancel.cancelled, false);
  assert.equal(emptyCancel.drops.length, 0);

  const shatterTwoCrates = evaluatePadCancelKickShatterDrops(
    ['red', 'super', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    () => 0.1,
  );
  assert.equal(shatterTwoCrates.cancelled, true);
  assert.equal(shatterTwoCrates.shatteredCrateCount, 2);
  assert.equal(shatterTwoCrates.drops.length, 4);
  assert.ok(
    shatterTwoCrates.drops.some((d) => d.kind === 'weapon' && d.weaponId === 'pistol'),
    'Shattered pad crates must include Pistol drop',
  );
  assert.ok(
    shatterTwoCrates.drops.some((d) => d.kind === 'secondary' && d.secondaryId === 'hand_grenade'),
    'Shattered pad crates must include Hand Grenade drop',
  );
  assert.ok(
    shatterTwoCrates.drops.some((d) => d.kind === 'health'),
    'Shattered pad crates must include Medkit drop',
  );
});

test('HT-88 Dump Truck 4-crate hydraulic vessel + Kiosk recipe & ST-01 Tank obstacle climbing + turret recoil', () => {
  // 1. HT-88 Dump Truck Kiosk recipe & 4-crate (2x2) vessel capacity + hydraulic cycle
  assert.equal(DUMP_TRUCK_MAX_CRATES, 4);
  const truckRecipe = KIOSK_BUILD_PRIORITY_RECIPES.dump_truck;
  assert.equal(truckRecipe.id, 'dump_truck');
  assert.equal(truckRecipe.buildOrder, '2x2x1');
  assert.equal(truckRecipe.targetCrates, 4);

  const truckHolo = evaluateKioskSideHologramDisplay(
    true,
    'dump_truck',
    '2x2x1',
    ['red', 'red', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    ['dump_truck'],
  );
  assert.equal(truckHolo.visible, true);
  assert.equal(truckHolo.modelKind, 'truck');
  assert.equal(truckHolo.progressFractionText, '2/4');

  const hydPeak = evaluateDumpTruckHydraulicCycle(0.7);
  assert.equal(hydPeak.phase, 'dumping');
  assert.ok(hydPeak.vesselTiltRad > 0.72, 'Hydraulic dump vessel must tilt upward during unload');
  assert.ok(hydPeak.tailgateOpenRad > 0.6, 'Rear tailgate must swing open during hydraulic unload');
  assert.ok(hydPeak.pistonExtension > 0.8, 'Telescoping hydraulic rams must extend during dump');

  // 2. ST-01 Tank climbs over low rocks and stacked pipes (height <= 1.68m), blocked if too tall
  assert.equal(TANK_MAX_CLIMBABLE_OBSTACLE_HEIGHT, 1.68);
  assert.equal(isTankClimbableProp('river_rock', 1.0), true);
  assert.equal(isTankClimbableProp('pipe_cluster', 1.0), true);
  assert.equal(isTankClimbableProp('pipe_cluster_1b', 1.0), true);
  assert.equal(isTankClimbableProp('giant_pipe', 1.0), true);
  assert.equal(isTankClimbableProp('concrete_pipe', 1.0), true);
  assert.equal(isTankClimbableProp('river_rock', 2.5), false); // 0.92 * 2.5 = 2.30m > 1.68m -> too tall!
  assert.equal(isTankClimbableProp('pipe_cluster', 1.6), false); // 1.28 * 1.6 = 2.048m > 1.68m -> too tall!
  assert.equal(isTankClimbableProp('shipping_container', 1.0), false);
  assert.ok((getTankClimbableObstacleVerticalHeight('pipe_cluster', 1.0) ?? 0) > 1.0);

  const climbOverPipe = evaluateTankClimbableObstacleElevation(10, 20, 0, [
    {
      alive: true,
      kind: 'pipe_cluster',
      x: 10,
      z: 20,
      radius: 1.58,
      halfX: 1.25,
      halfZ: 2.35,
      rotY: 0,
      scale: 1.0,
    },
  ]);
  assert.equal(climbOverPipe.isClimbing, true);
  assert.ok(climbOverPipe.climbY > 0.8, 'Tank on top of stacked pipes must elevate smoothly');

  const approachRock = evaluateTankClimbableObstacleElevation(8.9, 20, 0, [
    {
      alive: true,
      kind: 'river_rock',
      x: 10,
      z: 20,
      radius: 1.08,
      rotY: 0,
      scale: 1.0,
    },
  ]);
  assert.equal(approachRock.isClimbing, true);
  assert.ok(approachRock.pitchRad !== 0, 'Tank approaching a rock must pitch its hull');

  // 3. ST-01 Tank 4-part turret + barrel + hull recoil
  const recoilPeak = evaluateBlitzTankShotRecoilPose(0.19, 0.24);
  assert.ok(recoilPeak.turretSlideBack > 0.14, 'Turret must slide backward on cannon shot');
  assert.ok(recoilPeak.turretLiftY > 0.04, 'Turret must lift slightly on cannon shot');
  assert.ok(recoilPeak.turretPitchRad > 0.08, 'Turret must pitch upward on cannon shot');
  assert.ok(recoilPeak.barrelSlideBack > 0.14, 'Barrel must slide backward on cannon shot');
  assert.ok(recoilPeak.bodyLiftY > 0.03, 'Tank hull must hop slightly on cannon shot');
});

test('Unified 1.32m crate size, 0.1s Jump Input Buffer, and Player Invincibility Frames (10 Hz blink + knockback)', () => {
  // 1. Unified 1:1 crate size across ground, carried overhead, and Crate Pad slots/holograms
  assert.equal(UNIFIED_WORLD_CRATE_SIZE, 1.32);
  assert.deepEqual(BUILD_ORDER_SPECS['1x1x1'].ghostBoxCenter, [-0.95, 0.93, -0.95]);
  assert.deepEqual(BUILD_ORDER_SPECS['1x1x1'].ghostBoxSize, [1.34, 1.34, 1.34]);
  assert.deepEqual(BUILD_ORDER_SPECS['1x1x2'].ghostBoxCenter, [-0.95, 1.59, -0.95]);
  assert.deepEqual(BUILD_ORDER_SPECS['1x1x2'].ghostBoxSize, [1.34, 2.66, 1.34]);

  // 2. Jump input buffer (0.1s):
  //    a) Pressing jump while airborne 0.06s before landing buffers the jump, counts down each frame,
  //       fires on the first grounded frame while timer > 0, and resets timer to 0 so one press gives one jump!
  assert.equal(JUMP_BUFFER_DURATION_SEC, 0.1);
  const pressInAir = stepBuddyJumpPhysicsWithBuffer(0.18, -3.5, false, 0, true, 1.0, false, 0.03);
  assert.equal(pressInAir.justJumped, false, 'Still airborne -> buffered, not fired yet');
  assert.equal(pressInAir.jumpBufferTimer, 0.1, 'Press sets buffer timer to 0.1s');

  // Next frame (dt = 0.04s): player touches down while timer is 0.06s (> 0) -> fires jump immediately and resets timer to 0!
  const touchdownFire = stepBuddyJumpPhysicsWithBuffer(
    pressInAir.jumpOffset,
    pressInAir.vy,
    pressInAir.isGrounded,
    pressInAir.jumpBufferTimer,
    false,
    1.0,
    false,
    0.04,
  );
  assert.equal(touchdownFire.justJumped, true, 'Buffered jump must fire on the first grounded frame');
  assert.equal(touchdownFire.isGrounded, false);
  assert.ok(touchdownFire.vy > 9.0);
  assert.equal(touchdownFire.jumpBufferTimer, 0, 'Buffer timer must reset to 0 when jump fires');

  //    b) Pressing jump too early (> 0.1s before landing) expires the buffer timer before touchdown
  let timer = 0.1;
  let offset = 1.2;
  let vy = -2.0;
  let grounded = false;
  for (let i = 0; i < 4; i++) {
    const step = stepBuddyJumpPhysicsWithBuffer(offset, vy, grounded, timer, false, 1.0, false, 0.03);
    offset = step.jumpOffset;
    vy = step.vy;
    grounded = step.isGrounded;
    timer = step.jumpBufferTimer;
    assert.equal(step.justJumped, false);
  }
  assert.equal(timer, 0, 'Buffer timer must count down to 0 after > 0.1s');

  // 3. Player Invincibility Frames (0.5 to 1.0s), 10 Hz blink, and knockback away from damage source
  assert.ok(PLAYER_INVINCIBILITY_DURATION_SEC >= 0.5 && PLAYER_INVINCIBILITY_DURATION_SEC <= 1.0);
  assert.equal(PLAYER_INVINCIBILITY_BLINK_HZ, 10);

  // First hit from source at (0, 0) while player is at (3, 4): applies damage, starts i-frames, knocks player away (+0.6, +0.8)
  const hit1 = applyPlayerDamageWithInvincibilityAndKnockback({
    hp: 30,
    invincibilityTimer: 0,
    x: 3,
    z: 4,
    vx: 0,
    vz: 0,
    vy: 0,
    damage: 10,
    sourceX: 0,
    sourceZ: 0,
  });
  assert.equal(hit1.damageApplied, true);
  assert.equal(hit1.hp, 20);
  assert.equal(hit1.invincibilityTimer, PLAYER_INVINCIBILITY_DURATION_SEC);
  assert.ok(hit1.knockbackDirX > 0.59 && hit1.knockbackDirX < 0.61);
  assert.ok(hit1.knockbackDirZ > 0.79 && hit1.knockbackDirZ < 0.81);
  assert.ok(hit1.vx > 5.0 && hit1.vz > 7.0, 'Must push player away from the damage source');

  // Second hit during the invincibility window is completely ignored!
  const hit2Ignored = applyPlayerDamageWithInvincibilityAndKnockback({
    hp: hit1.hp,
    invincibilityTimer: hit1.invincibilityTimer,
    x: 3.5,
    z: 4.5,
    vx: hit1.vx,
    vz: hit1.vz,
    vy: hit1.vy,
    damage: 15,
    sourceX: 0,
    sourceZ: 0,
  });
  assert.equal(hit2Ignored.damageApplied, false, 'Must ignore all further damage during invincibility window');
  assert.equal(hit2Ignored.hp, 20);

  // Verify 10 Hz blink toggles sprite visibility on and off during the window and restores visible=true when expired
  let blinkTimer = hit1.invincibilityTimer;
  let transitions = 0;
  let prevVis = stepPlayerInvincibilityState(blinkTimer, 0).spriteVisible;
  for (let i = 0; i < 30; i++) {
    const st = stepPlayerInvincibilityState(blinkTimer, 0.025);
    blinkTimer = st.invincibilityTimer;
    if (st.spriteVisible !== prevVis) {
      transitions++;
      prevVis = st.spriteVisible;
    }
  }
  assert.ok(transitions >= 12, `Expected ~15 visibility toggles at 10 Hz over 0.75s, got ${transitions}`);
  assert.equal(blinkTimer, 0);
  assert.equal(stepPlayerInvincibilityState(0, 0.016).spriteVisible, true);
});

test('AI Ranged Combat Standoff, 5-Slot Tactical Loadout (3 Handheld + 2 Tactical, Ammo Badge, Click-to-Swap, Refill), Base Center Pad Drop, and Warzone Explosive Barrel Drops', () => {
  // 1. AI Ranged Combat Intelligence: shoots directly from long range instead of chasing into melee contact
  const rangedHold = evaluateAiRangedCombatStandoffBehavior({
    aiX: 0,
    aiZ: 0,
    enemyX: 14.5,
    enemyZ: 0,
    weaponId: 'rifle',
    ammo: 90,
    strafeSign: 1,
  });
  assert.equal(rangedHold.canShootNow, true, 'Armed AI at 14.5m must fire directly from afar');
  assert.equal(rangedHold.movementMode, 'hold_and_strafe', 'Armed AI at optimal range holds & strafes instead of chasing');

  const rangedKite = evaluateAiRangedCombatStandoffBehavior({
    aiX: 0,
    aiZ: 0,
    enemyX: 4.8,
    enemyZ: 0,
    weaponId: 'rocket',
    ammo: 18,
    strafeSign: -1,
  });
  assert.equal(rangedKite.canShootNow, true, 'Armed AI at 4.8m still fires');
  assert.equal(rangedKite.movementMode, 'retreat_kite', 'Armed AI too close retreats/kites back to standoff distance');
  assert.ok(rangedKite.goalX < 0, 'Goal X must be behind the AI (away from the enemy at +4.8)');

  const unarmedMelee = evaluateAiRangedCombatStandoffBehavior({
    aiX: 0,
    aiZ: 0,
    enemyX: 12.0,
    enemyZ: 0,
    weaponId: 'unarmed',
    ammo: 0,
    strafeSign: 1,
  });
  assert.equal(unarmedMelee.canShootNow, false);
  assert.equal(unarmedMelee.movementMode, 'melee_chase');

  // 2. Dynamic 5-Slot Tactical Loadout (3 Handheld Weapons + 2 Tactical Secondary Items: Hand Grenade & Land Mine)
  assert.equal(MAX_HANDHELD_WEAPON_SLOTS, 3);
  assert.equal(MAX_TACTICAL_ITEM_SLOTS, 2);

  // Starting with only Pistol (60 ammo) -> ONLY Pistol appears in bottom HUD (Rifle/Bazooka hidden when not owned!)
  let loadout = createInitialBuddyTacticalLoadout('pistol', 60, 'none', 0);
  let badges = getVisibleHudWeaponAndTacticalBadges(loadout);
  assert.equal(badges.length, 1, 'Unowned weapons must NOT appear in bottom HUD');
  assert.equal(badges[0].label, 'PISTOL');
  assert.equal(badges[0].ammoCount, 60, 'Badge number must show ammo count, not static slot number');
  assert.equal(badges[0].isActive, true);

  // Attempting to select unowned Bazooka does nothing
  loadout = selectHandheldWeaponInLoadout(loadout, 'bazooka');
  assert.equal(loadout.activeWeaponSlotId, 'pistol');

  // Equip Rifle and Bazooka (up to 3 handheld weapons) + Hand Grenade and Land Mine (2 tactical items)
  loadout = equipOrSwapDroppedWeaponInLoadout(loadout, 'Assault Rifle', 75).updatedLoadout;
  loadout = equipOrSwapDroppedWeaponInLoadout(loadout, 'Bazooka', 16).updatedLoadout;
  loadout = addTacticalSecondaryToLoadout(loadout, 'hand_grenade', 3);
  loadout = addTacticalSecondaryToLoadout(loadout, 'land_mine', 2);

  badges = getVisibleHudWeaponAndTacticalBadges(loadout);
  assert.equal(badges.length, 5, 'Should display 3 carried handheld weapons + 2 tactical secondary items');
  assert.deepEqual(
    badges.map((b) => [b.label, b.ammoCount]),
    [
      ['PISTOL', 60],
      ['RIFLE', 75],
      ['BAZOOKA', 16],
      ['GRANAT', 3],
      ['LAND MINE', 2],
    ],
  );

  // Clicking/swapping a 4th weapon (Laser) when 3 handheld slots are full swaps out the active weapon (Bazooka) and returns it to drop on the ground
  const swapRes = equipOrSwapDroppedWeaponInLoadout(loadout, 'Laser Beam', 50);
  assert.equal(swapRes.action, 'swapped');
  assert.equal(swapRes.droppedPreviousWeapon?.slotId, 'bazooka');
  assert.equal(swapRes.droppedPreviousWeapon?.remainingAmmo, 16);
  loadout = swapRes.updatedLoadout;
  assert.equal(loadout.handheldWeapons.length, 3, 'Handheld weapon slots capped at 3');
  assert.equal(loadout.activeWeaponSlotId, 'laser');

  // Consuming ammo and refilling from enemy kill, crate destroy, and supply drop
  loadout = consumeActiveWeaponAmmoOnShot(loadout);
  assert.equal(loadout.handheldWeapons.find((w) => w.slotId === 'laser')?.ammo, 49);

  loadout = refillLoadoutAmmoFromSource(loadout, 'enemy_kill');
  assert.equal(loadout.handheldWeapons.find((w) => w.slotId === 'laser')?.ammo, 73);
  loadout = refillLoadoutAmmoFromSource(loadout, 'crate_destroy');
  assert.equal(loadout.handheldWeapons.find((w) => w.slotId === 'laser')?.ammo, 93);
  loadout = refillLoadoutAmmoFromSource(loadout, 'supply_drop');
  assert.equal(loadout.handheldWeapons.find((w) => w.slotId === 'laser')?.ammo, 153);

  // Consuming tactical secondary items (Granat & Land Mine)
  const useGrenade = consumeTacticalSecondaryInLoadout(loadout, 'hand_grenade');
  assert.equal(useGrenade.consumed, true);
  assert.equal(useGrenade.updatedLoadout.grenadeCount, 2);

  const useMine = consumeTacticalSecondaryInLoadout(useGrenade.updatedLoadout, 'land_mine');
  assert.equal(useMine.consumed, true);
  assert.equal(useMine.updatedLoadout.landMineCount, 1);

  // 3. Base Crate Pad Pop-Out Inward to Base Center (never flying over the right perimeter fence)
  // Blue base: plotCenterX = -42, padX = -37.2, right fence is at -32.4. Pop-out must go in -X toward plotCenterX!
  const bluePadPop = computeStackingPadWeaponPopOutTrajectory(-37.2, 83.8, 0, 1, 1);
  assert.ok(bluePadPop.vx < 0, 'Blue pad weapon pop-out must launch inward (-X) toward the center of the base');
  assert.ok(
    bluePadPop.landingX < -37.2 && bluePadPop.landingX > -42.0,
    `Blue pad weapon must land in the middle of the base courtyard, got landingX=${bluePadPop.landingX}`,
  );

  // Red base: plotCenterX = 42, padX = 37.2, left fence is at 32.4. Pop-out must go in +X toward plotCenterX!
  const redPadPop = computeStackingPadWeaponPopOutTrajectory(37.2, -83.8, 0, 1, -1);
  assert.ok(redPadPop.vx > 0, 'Red pad weapon pop-out must launch inward (+X) toward the center of the base');
  assert.ok(
    redPadPop.landingX > 37.2 && redPadPop.landingX < 42.0,
    `Red pad weapon must land in the middle of the base courtyard, got landingX=${redPadPop.landingX}`,
  );

  // 4. Random Warzone Explosive Barrel Drop Scheduler
  assert.equal(WARZONE_EXPLOSIVE_BARREL_DROP_INTERVAL_SEC, 8.0);
  assert.equal(MAX_ACTIVE_WARZONE_EXPLOSIVE_BARRELS, 16);
  const step1 = stepWarzoneExplosiveBarrelDropTimer(5.0, 6, 2.0);
  assert.equal(step1.shouldDropBarrel, false);
  assert.equal(step1.nextTimerSec, 7.0);
  const step2 = stepWarzoneExplosiveBarrelDropTimer(step1.nextTimerSec, 6, 1.5);
  assert.equal(step2.shouldDropBarrel, true);
  assert.equal(step2.nextTimerSec, 0);
});

test('Global Movement Speed & Road Speed Boost: +45% Infantry/Harvester speed, reduced crate carry penalty (0.94x), +35% Tank/Truck speed & turn rate, +20% Asphalt/Zebra boost with particles, and synchronized walk cycle & AI anti-overshoot', () => {
  // 1. Infantry & Harvester (Normalized 1.0x human speed: 5.8 m/s Player, 5.0 m/s AI & crate carry multiplier 0.94x)
  assert.equal(INFANTRY_SPEED_BOOST_FACTOR, 1.0);
  assert.ok(Math.abs(PLAYER_BASE_FOOT_SPEED - 5.8) < 1e-6);
  assert.ok(Math.abs(AI_BASE_FOOT_SPEED - 5.0) < 1e-6);
  assert.equal(CRATE_CARRY_SPEED_MULTIPLIER, 0.94);

  // Off-road (0, 0 is grass island) vs On-road (-13, 0 is asphalt highway) vs Zebra Crosswalk (-18, 46.5)
  const offRoadSurface = evaluateRoadSurfaceSpeedBoost(0, 0);
  assert.equal(offRoadSurface.onRoadOrZebra, false);
  assert.equal(offRoadSurface.speedMultiplier, 1.0);

  const playerOffRoadSpeed = computeBuddyFootMoveSpeed({
    isPlayer: true,
    classSpeedMultiplier: 1.0,
    carryingCrate: false,
    onRoadOrZebra: offRoadSurface.onRoadOrZebra,
  });
  assert.ok(Math.abs(playerOffRoadSpeed - 5.8) < 1e-4);

  const harvesterCarryingCrateOffRoad = computeBuddyFootMoveSpeed({
    isPlayer: false,
    classSpeedMultiplier: 1.05,
    carryingCrate: true,
    onRoadOrZebra: false,
  });
  assert.ok(
    Math.abs(harvesterCarryingCrateOffRoad - AI_BASE_FOOT_SPEED * 1.05 * 0.94) < 1e-4,
    'Harvester carrying crate retains 94% of its speed',
  );

  // 2. Road Speed Boost (+20% automatic bonus on asphalt road AND zebra crosswalk)
  assert.equal(ROAD_SPEED_BOOST_MULTIPLIER, 1.2);
  const roadSurface = evaluateRoadSurfaceSpeedBoost(-13, 0);
  assert.equal(roadSurface.onAsphaltRoad, true);
  assert.equal(roadSurface.onRoadOrZebra, true);
  assert.equal(roadSurface.speedMultiplier, 1.2);

  const zebraSurface = evaluateRoadSurfaceSpeedBoost(-18.0, 46.5);
  assert.equal(zebraSurface.onZebraCrosswalk, true);
  assert.equal(zebraSurface.onRoadOrZebra, true);
  assert.equal(zebraSurface.speedMultiplier, 1.2);

  const playerOnRoadSpeed = computeBuddyFootMoveSpeed({
    isPlayer: true,
    classSpeedMultiplier: 1.0,
    carryingCrate: false,
    onRoadOrZebra: roadSurface.onRoadOrZebra,
  });
  assert.ok(Math.abs(playerOnRoadSpeed - 5.8 * 1.2) < 1e-4);

  // 3. Vehicles (+35% top speed, +35% initial acceleration, faster steering turn rate, +20% on road)
  assert.equal(VEHICLE_SPEED_AND_ACCEL_BOOST_FACTOR, 1.35);
  assert.ok(Math.abs(AI_TANK_BASE_DRIVE_SPEED - 6.5 * 1.35) < 1e-6);

  const tankStepOffRoad = stepBlitzTankTrackedPhysics(
    { currentDriveSpeed: 10.8, hullYaw: 0, vx: 0, vz: 0 },
    { throttle: 1, turn: 1, boost: false, onRoad: false },
    0.1,
  );
  const tankStepOnRoad = stepBlitzTankTrackedPhysics(
    { currentDriveSpeed: 10.8, hullYaw: 0, vx: 0, vz: 0 },
    { throttle: 1, turn: 1, boost: false, onRoad: true },
    0.1,
  );
  assert.ok(
    tankStepOnRoad.currentDriveSpeed > tankStepOffRoad.currentDriveSpeed,
    'Tank receives +20% road top speed boost on asphalt road',
  );
  assert.ok(
    Math.hypot(tankStepOnRoad.vx, tankStepOnRoad.vz) > Math.hypot(tankStepOffRoad.vx, tankStepOffRoad.vz),
    'Tank accelerates faster on asphalt road',
  );
  assert.ok(
    Math.abs(tankStepOffRoad.turnRateRadPerSec - 4.212) < 1e-3,
    'Tank base turn rate is increased by +35% (4.212 rad/s)',
  );
  assert.ok(
    tankStepOnRoad.turnRateRadPerSec > tankStepOffRoad.turnRateRadPerSec,
    'Tank turns even more responsively on asphalt roads',
  );

  // Dump Truck top speed (+35% -> 19.17 m/s normal, 24.975 m/s boost, and x1.20 on road)
  let truckVelOffRoad = 0;
  let truckVelOnRoad = 0;
  let truckSteer = 0;
  for (let i = 0; i < 60; i++) {
    truckVelOffRoad = stepDumpTruckWheeledPhysics(
      { forwardSpeed: truckVelOffRoad, steerAngle: 0, hullYaw: 0 },
      { throttle: 1, steer: 0, boost: false, onRoad: false },
      0.05,
    ).forwardSpeed;
    const roadStep = stepDumpTruckWheeledPhysics(
      { forwardSpeed: truckVelOnRoad, steerAngle: truckSteer, hullYaw: 0 },
      { throttle: 1, steer: 1, boost: false, onRoad: true },
      0.05,
    );
    truckVelOnRoad = roadStep.forwardSpeed;
    truckSteer = roadStep.steerAngle;
  }
  assert.ok(Math.abs(truckVelOffRoad - 19.17) < 0.15, `Expected ~19.17 m/s off-road top speed, got ${truckVelOffRoad}`);
  assert.ok(
    Math.abs(truckVelOnRoad - 19.17 * 1.2) < 0.2,
    `Expected ~23.004 m/s on-road top speed, got ${truckVelOnRoad}`,
  );
  assert.ok(truckSteer > 0.50, 'Dump truck maintains wide steering authority even at high speed');
  let stationarySteer = 0;
  for (let i = 0; i < 2; i++) {
    stationarySteer = stepDumpTruckWheeledPhysics(
      { forwardSpeed: 0, steerAngle: stationarySteer, hullYaw: 0 },
      { throttle: 0, steer: 1, boost: false },
      0.06,
    ).steerAngle;
  }
  assert.ok(Math.abs(stationarySteer - 0.58) < 1e-3, 'Dump truck reaches widened 0.58 rad max steer angle in 0.12s');

  // 4. Road Speed Boost dust/wind particle emission cadence
  const emitCheck = shouldEmitRoadSpeedBoostParticles({
    onRoadOrZebra: true,
    isGrounded: true,
    groundSpeed: 14.0,
    accumTimerSec: 0.06,
    dt: 0.03,
    isVehicle: false,
  });
  assert.equal(emitCheck.shouldEmit, true);
  assert.ok(emitCheck.particleCount >= 1);
  const noEmitOffRoad = shouldEmitRoadSpeedBoostParticles({
    onRoadOrZebra: false,
    isGrounded: true,
    groundSpeed: 14.0,
    accumTimerSec: 0.06,
    dt: 0.03,
    isVehicle: false,
  });
  assert.equal(noEmitOffRoad.shouldEmit, false);

  // 5. Walk/Run cycle synchronization (prevents foot sliding at high speeds)
  const slowWalk = computeSynchronizedWalkCycleStep({
    currentWalkCycle: 0,
    actualGroundSpeed: 6.0,
    dt: 0.05,
    carryingCrate: false,
  });
  const fastRunRoad = computeSynchronizedWalkCycleStep({
    currentWalkCycle: 0,
    actualGroundSpeed: 16.0,
    dt: 0.05,
    carryingCrate: false,
  });
  assert.ok(
    fastRunRoad.nextWalkCycle > slowWalk.nextWalkCycle * 1.75,
    'Walk cycle phase advances proportionally to actual ground speed so feet never slide',
  );
  assert.ok(
    fastRunRoad.legSwingAmplitude > slowWalk.legSwingAmplitude,
    'Leg swing stride amplitude opens wider when sprinting on a road',
  );

  // 6. AI Pathfinding anti-overshoot synchronization (never overshoots target even at high speed + road boost)
  const nearTargetStep = computeAiPathfindingMovementStep({
    steerDirX: 1.0,
    steerDirZ: 0.0,
    distToGoal: 0.18,
    desiredSpeed: 16.0, // 0.32m step in 0.02s > 0.18m remaining distance!
    dt: 0.02,
    stopRadius: 0.05,
  });
  assert.equal(nearTargetStep.arrived, false);
  assert.ok(
    nearTargetStep.stepDx <= 0.18 + 1e-6,
    `AI single-frame step must never overshoot remaining distance to goal (got stepDx=${nearTargetStep.stepDx})`,
  );

  const arrivedStep = computeAiPathfindingMovementStep({
    steerDirX: 1.0,
    steerDirZ: 0.0,
    distToGoal: 0.04,
    desiredSpeed: 16.0,
    dt: 0.02,
    stopRadius: 0.05,
  });
  assert.equal(arrivedStep.arrived, true);
  assert.equal(arrivedStep.stepDx, 0);
});

test('Continuous Raycast Laser Beam tracks weapon barrel muzzle in real time while walking/rotating and intersects closest enemy, vehicle, crate, or max range with rapid dual-layer pulsation', () => {
  assert.equal(LASER_BEAM_MAX_DISTANCE, 36.0);
  assert.ok(LASER_CORE_RADIUS > 0 && LASER_CORE_RADIUS < LASER_OUTER_GLOW_RADIUS);

  // 1. Real-time muzzle origin & direction track character position, hand/weapon stance offset, walk bob, and body rotation (yaw)
  const facingEast = computeContinuousLaserMuzzleTransform({
    unitX: 10,
    unitY: 0,
    unitZ: 20,
    yaw: 0, // Facing +X
    walkCycle: 0,
    isMoving: false,
    weaponRecoil: 0,
    weaponScale: 1.08,
  });
  // With yaw = 0 (facing +X), forward offset (+Z in rig) projects along +X, and right-hand stance offset (rigX = -0.12) projects along +Z (-leftZ * -0.12 = +0.12)
  assert.ok(facingEast.muzzleOrigin.x > 11.2, `Muzzle must be in front of character along +X, got ${facingEast.muzzleOrigin.x}`);
  assert.ok(Math.abs(facingEast.muzzleOrigin.z - 20.12) < 1e-4, `Muzzle must include right-hand stance offset (+0.12 Z), got ${facingEast.muzzleOrigin.z}`);
  assert.ok(facingEast.muzzleOrigin.y > 1.3 && facingEast.muzzleOrigin.y < 1.4, `Muzzle height matches held rifle barrel tip, got ${facingEast.muzzleOrigin.y}`);
  assert.ok(Math.abs(facingEast.beamDir.x - 1.0) < 1e-5 && Math.abs(facingEast.beamDir.z) < 1e-5);

  // When character rotates 90 degrees counter-clockwise (yaw = Math.PI / 2 -> facing -Z) and walks forward:
  const facingNorthWalking = computeContinuousLaserMuzzleTransform({
    unitX: 12,
    unitY: 0,
    unitZ: 18,
    yaw: Math.PI / 2, // Facing -Z
    walkCycle: Math.PI / 2,
    isMoving: true,
    legSwingAmplitude: 0.65,
    carryingCrate: false,
    weaponRecoil: 0.3,
    weaponScale: 1.08,
  });
  assert.ok(facingNorthWalking.muzzleOrigin.z < 16.8, 'Muzzle sweeps to -Z in front of rotated character');
  assert.ok(facingNorthWalking.walkBobY > 0.015, 'Walking bob vertically translates muzzle with arm/body stride');
  assert.ok(facingNorthWalking.beamDir.z < -0.99, 'Beam direction sweeps in lockstep with character yaw');

  // 2. Raycast intersection picks closest hit among Crate (peti), Vehicle, and Enemy, or clamps to max distance when unobstructed
  const colliders: RaycastCollider3D[] = [
    {
      id: 'buddy_1',
      layer: RAYCAST_LAYERS.SHOOTER,
      targetKind: 'enemy_character',
      team: 'blue',
      label: 'Shooter',
      shape: 'cylinder',
      center: { x: 10, y: 1.05, z: 20 },
      radius: 0.85,
      halfExtents: { x: 0.85, y: 1.1, z: 0.85 },
    },
    {
      id: 'enemy_far',
      layer: RAYCAST_LAYERS.ENEMY_CHARACTER,
      targetKind: 'enemy_character',
      team: 'red',
      label: 'Enemy Commando',
      shape: 'cylinder',
      center: { x: 32, y: 1.05, z: 20.12 },
      radius: 1.0,
      halfExtents: { x: 1.0, y: 1.2, z: 1.0 },
    },
    {
      id: 'veh_mid',
      layer: RAYCAST_LAYERS.VEHICLE,
      targetKind: 'vehicle',
      team: 'red',
      label: 'Enemy Tank',
      shape: 'obb',
      center: { x: 24, y: 1.15, z: 20.12 },
      halfExtents: { x: 2.48, y: 1.38, z: 1.66 },
      rotY: 0,
    },
    {
      id: 'crate_near',
      layer: RAYCAST_LAYERS.PROP,
      targetKind: 'prop',
      label: 'Peti RED',
      shape: 'obb',
      center: { x: 17, y: 1.2, z: 20.12 },
      halfExtents: { x: 0.68, y: 0.72, z: 0.68 },
      rotY: 0,
    },
  ];

  // Hits the closest obstacle (crate_near at x = 17, front face at x = 16.32)
  const hitCrateStep = evaluateContinuousLaserBeamStep({
    muzzleOrigin: facingEast.muzzleOrigin,
    beamDir: facingEast.beamDir,
    colliders,
    shooterId: 'buddy_1',
    shooterTeam: 'blue',
    maxDistance: LASER_BEAM_MAX_DISTANCE,
    elapsedSec: 0.1,
  });
  assert.equal(hitCrateStep.hit, true);
  assert.equal(hitCrateStep.hitTargetId, 'crate_near', 'Laser beam stops at closest intersected crate (peti)');
  assert.ok(Math.abs(hitCrateStep.endPoint.x - (17 - 0.68)) < 0.05);
  assert.ok(Math.abs(hitCrateStep.beamLength - (hitCrateStep.endPoint.x - facingEast.muzzleOrigin.x)) < 0.02);

  // If crate is removed, beam hits the next closest target (Enemy Tank at x = 24, front face at 21.52)
  const withoutCrate = colliders.filter((c) => c.id !== 'crate_near');
  const hitVehicleStep = evaluateContinuousLaserBeamStep({
    muzzleOrigin: facingEast.muzzleOrigin,
    beamDir: facingEast.beamDir,
    colliders: withoutCrate,
    shooterId: 'buddy_1',
    shooterTeam: 'blue',
    maxDistance: LASER_BEAM_MAX_DISTANCE,
    elapsedSec: 0.18,
  });
  assert.equal(hitVehicleStep.hit, true);
  assert.equal(hitVehicleStep.hitTargetId, 'veh_mid', 'Laser beam stops at enemy vehicle when crate is gone');
  assert.ok(Math.abs(hitVehicleStep.endPoint.x - (24 - 2.48)) < 0.05);

  // When unobstructed, beam extends to exact maxDistance (36.0m) and outer glow pulsates rapidly over time
  const unobstructedStepA = evaluateContinuousLaserBeamStep({
    muzzleOrigin: facingEast.muzzleOrigin,
    beamDir: facingEast.beamDir,
    colliders: [],
    shooterId: 'buddy_1',
    shooterTeam: 'blue',
    maxDistance: LASER_BEAM_MAX_DISTANCE,
    elapsedSec: 0.0,
  });
  const unobstructedStepB = evaluateContinuousLaserBeamStep({
    muzzleOrigin: facingEast.muzzleOrigin,
    beamDir: facingEast.beamDir,
    colliders: [],
    shooterId: 'buddy_1',
    shooterTeam: 'blue',
    maxDistance: LASER_BEAM_MAX_DISTANCE,
    elapsedSec: 0.04,
  });
  assert.equal(unobstructedStepA.hit, false);
  assert.ok(Math.abs(unobstructedStepA.beamLength - LASER_BEAM_MAX_DISTANCE) < 1e-4);
  assert.notEqual(
    unobstructedStepA.outerGlowRadiusScale,
    unobstructedStepB.outerGlowRadiusScale,
    'Outer glow sheath radius pulsates rapidly across frames',
  );
});

test('Model Estate Base Layout retains Bottom-Left Base (blue plot 0), places standalone Kiosks on 7 empty grass plots, and dynamically activates/deactivates full base colliders via NEAR NFT Gamepass Session Base', () => {
  assert.equal(MODEL_ESTATE_BASE_PLOT_SPEC.team, 'blue');
  assert.equal(MODEL_ESTATE_BASE_PLOT_SPEC.commanderIdx, 0);
  assert.equal(isIntactModelEstateBasePlot('blue', 0), true);
  for (const idx of [1, 2, 3]) {
    assert.equal(isIntactModelEstateBasePlot('blue', idx), false);
  }
  for (const idx of [0, 1, 2, 3]) {
    assert.equal(isIntactModelEstateBasePlot('red', idx), false);
  }

  const bluePlots = createIndividualCommanderBasesState('blue');
  const redPlots = createIndividualCommanderBasesState('red');
  const structures = buildStaticWorldStructuresList({
    blueBase: { baseGroup: new THREE.Group(), hqX: 0, hqZ: 74 },
    redBase: { baseGroup: new THREE.Group(), hqX: 0, hqZ: -74 },
    blueCommanderBases: bluePlots,
    redCommanderBases: redPlots,
  });
  const ids = structures.map((s) => s.id);

  // 1. Intact Bottom-Left Base (blue_plot_0_* and bastion_b_0) colliders are preserved
  assert.ok(ids.includes('bastion_b_0'), 'Bottom-Left Skyshield bastion_b_0 collider must remain intact');
  assert.ok(ids.includes('blue_plot_0_building'), 'Bottom-Left Model Estate building collider must remain intact');
  assert.ok(ids.includes('blue_plot_0_kiosk'), 'Bottom-Left Model Estate kiosk collider must remain intact');
  assert.ok(ids.includes('blue_plot_0_fence_w'), 'Bottom-Left Model Estate perimeter fence colliders must remain intact');

  // 2. All 7 empty grass plots have ONLY their standalone Kiosk collider (blue_plot_1..3_kiosk, red_plot_0..3_kiosk) and ZERO ghost building/fence/bastion colliders
  for (const idx of [1, 2, 3]) {
    assert.ok(ids.includes(`blue_plot_${idx}_kiosk`), `Blue plot ${idx} must have its standalone Kiosk collider`);
  }
  for (const idx of [0, 1, 2, 3]) {
    assert.ok(ids.includes(`red_plot_${idx}_kiosk`), `Red plot ${idx} must have its standalone Kiosk collider`);
  }
  for (const id of ids) {
    assert.equal(
      /^red_plot_[0-3]_(building|fence|gate)/.test(id),
      false,
      `Unclaimed North Red base plot must have zero building/fence ghost colliders, found ${id}`,
    );
    assert.equal(
      id.startsWith('bastion_r_'),
      false,
      `Unclaimed North Red Skyshield bastion must have zero ghost colliders, found ${id}`,
    );
    assert.equal(
      /^blue_plot_[123]_(building|fence|gate)/.test(id),
      false,
      `Unclaimed South Blue base plots 1..3 must have zero building/fence ghost colliders, found ${id}`,
    );
    assert.equal(
      /^bastion_b_[123]$/.test(id),
      false,
      `Unclaimed South Blue Skyshield bastions 1..3 must have zero ghost colliders, found ${id}`,
    );
  }
});

test('Lobby Safezone 2 Portals (North Red & South Blue), Modern Urban Tram Stop Shelter Return Pad, Zero Friendly-Fire, Public Warzone Crate Pads, and NEAR NEP-171 Gamepass Online Session Base + AI Harvester Swarm', () => {
  // 1. Lobby Safezone bounds & 2 Faction Portals (North = Red, South = Blue, Center closed)
  assert.equal(isPointInsideLobbySafezone(-85.0, 0.0), true);
  assert.equal(isPointInsideLobbySafezone(0.0, 0.0), false);
  assert.equal(LOBBY_FACTION_PORTALS.length, 2);

  const northPortal = evaluateLobbyFactionPortalStep(-84.0, -15.0);
  assert.ok(northPortal !== null);
  assert.equal(northPortal?.team, 'red');
  assert.ok(northPortal!.spawnZ < -30, 'North portal teleports player to North Red Shielded Pad');

  const southPortal = evaluateLobbyFactionPortalStep(-84.0, 15.0);
  assert.ok(southPortal !== null);
  assert.equal(southPortal?.team, 'blue');
  assert.ok(southPortal!.spawnZ > 30, 'South portal teleports player to South Blue Shielded Pad');

  // Center exit (-84.0, 0.0) has NO portal (sealed off)
  assert.equal(evaluateLobbyFactionPortalStep(-84.0, 0.0), null);

  // 2. Modern Urban Tram Stop Shelter Return Pad in front of Lobby next to lake
  assert.equal(
    isUnitNearLobbyTramReturnPad(
      LOBBY_TRAM_SHELTER_SPEC.returnPadX,
      LOBBY_TRAM_SHELTER_SPEC.returnPadZ,
    ),
    true,
  );
  assert.equal(isUnitNearLobbyTramReturnPad(0, 0), false);
  assert.ok(LOBBY_NEAR_TERMINAL_SPEC.x < LOBBY_SAFEZONE_BOUNDS.maxX);

  // 3. Zero Friendly-Fire & 100% Lobby Safezone Damage Immunity
  assert.equal(canApplyCombatDamage('blue', 'blue', 0, 10, 5, 10), false, 'Blue cannot damage Blue');
  assert.equal(canApplyCombatDamage('red', 'red', 0, -10, 5, -10), false, 'Red cannot damage Red');
  assert.equal(canApplyCombatDamage('blue', 'red', 0, 10, 5, -10), true, 'Blue can damage Red in Warzone');
  assert.equal(
    canApplyCombatDamage('blue', 'red', -85.0, 0.0, 5, -10),
    false,
    'Attacker inside Lobby Safezone cannot deal damage',
  );
  assert.equal(
    canApplyCombatDamage('blue', 'red', 0, 10, -85.0, 0.0),
    false,
    'Victim inside Lobby Safezone cannot take damage',
  );

  // 4. NEAR NEP-171 Gamepass Minting, Claiming Online Session Base on Empty Grass Plot, AI Harvester Swarm, & Releasing Base on Offline
  const bluePlots = createIndividualCommanderBasesState('blue');
  assert.equal(isCommanderBasePlotActive(bluePlots[0]), true, 'Plot 0 Model Estate is always active');
  assert.equal(isCommanderBasePlotActive(bluePlots[1]), false, 'Plot 1 starts as empty grass plot');

  let session = createInitialNearGamepassSessionState();
  session = connectNearWalletAndMintGamepass(session, 'commander-alpha.near');
  assert.equal(session.walletConnected, true);
  assert.equal(session.hasGamepassNft, true);
  assert.ok(session.tokenId?.startsWith('nep171-gamepass-'));

  // Claim Blue Plot 1 with NEAR Gamepass
  const claimRes = claimEmptyBasePlotWithNearGamepass(session, bluePlots, 'blue', 'blue', 1);
  assert.equal(claimRes.claimed, true);
  session = claimRes.updatedSession;
  assert.equal(isCommanderBasePlotActive(bluePlots[1]), true, 'Claimed plot 1 becomes an active full base');
  assert.equal(bluePlots[1].claimedByNearWallet, 'commander-alpha.near');
  assert.equal(session.activeHarvesterSubAccounts.length, 2);
  assert.equal(session.activeHarvesterSubAccounts[0], 'harvester-1.commander-alpha.near');

  // Verify dynamic colliders appear for claimed Blue Plot 1
  const structuresWhileOnline = buildStaticWorldStructuresList({
    blueBase: { baseGroup: new THREE.Group(), hqX: 0, hqZ: 74 },
    blueCommanderBases: bluePlots,
    redCommanderBases: createIndividualCommanderBasesState('red'),
  });
  const onlineIds = structuresWhileOnline.map((s) => s.id);
  assert.ok(onlineIds.includes('blue_plot_1_building'), 'Claimed plot 1 spawns building collider while online');
  assert.ok(onlineIds.includes('blue_plot_1_fence_w'), 'Claimed plot 1 spawns fence colliders while online');

  // Go Offline / Release Base -> Plot 1 reverts to empty grass plot (only Kiosk collider remains)
  releaseClaimedOnlineSessionBase(bluePlots, 1);
  assert.equal(isCommanderBasePlotActive(bluePlots[1]), false, 'Released plot 1 reverts to empty grass plot');
  const structuresAfterOffline = buildStaticWorldStructuresList({
    blueBase: { baseGroup: new THREE.Group(), hqX: 0, hqZ: 74 },
    blueCommanderBases: bluePlots,
    redCommanderBases: createIndividualCommanderBasesState('red'),
  });
  const offlineIds = structuresAfterOffline.map((s) => s.id);
  assert.equal(offlineIds.includes('blue_plot_1_building'), false, 'Building collider removed when offline');
  assert.ok(offlineIds.includes('blue_plot_1_kiosk'), 'Standalone Kiosk collider remains on empty grass plot');

  // 5. Public Warzone Crate Pads (8 Shielded Kiosk-free pads on grass island corners: 4 Blue South + 4 Red North)
  assert.equal(PUBLIC_WARZONE_CRATE_PADS.length, 8);
});

test('5-Lives Deployment System (150 HP), 3-Stage Pure Contract Harvester (Standby -> Active -> Despawn), Lobby Gold Exchange, and 10v10 Open Warzone Population Bar', () => {
  // 1. 150 HP & 5-Lives Deployment System
  assert.equal(PLAYER_WARZONE_MAX_HP, 150);
  assert.equal(BUDDY_CLASSES.Infuntry.maxHp, 150);
  assert.equal(PLAYER_WARZONE_MAX_LIVES, 5);
  assert.equal(formatWarzoneLivesHudLabel(5, 5), '5/5 LIVES');
  assert.equal(formatWarzoneLivesHudLabel(2, 5), '2/5 LIVES');

  // Deaths 1..4 (livesRemaining > 0): respawn in Team Sector Safezone & KEEP claimed Base
  const death1Blue = evaluatePlayerWarzoneDeathStep({
    currentLives: 5,
    playerTeam: 'blue',
    hasClaimedSessionBase: true,
  });
  assert.equal(death1Blue.livesRemaining, 4);
  assert.equal(death1Blue.respawnLocation, 'team_sector_safezone');
  assert.equal(death1Blue.shouldReleaseClaimedBase, false);
  assert.equal(death1Blue.respawnHp, 150);
  assert.ok(death1Blue.spawnZ > 30, 'Blue death 1..4 respawns at one of the 4 South Blue Shielded Pads');

  const death4Red = evaluatePlayerWarzoneDeathStep({
    currentLives: 2,
    playerTeam: 'red',
    hasClaimedSessionBase: true,
  });
  assert.equal(death4Red.livesRemaining, 1);
  assert.equal(death4Red.respawnLocation, 'team_sector_safezone');
  assert.equal(death4Red.shouldReleaseClaimedBase, false);
  assert.ok(death4Red.spawnZ < -30, 'Red death 1..4 respawns at one of the 4 North Red Shielded Pads');

  // 5th Death (livesRemaining === 0): return to Main Lobby Safezone & RELEASE claimed Base back to open grass plot
  const death5Blue = evaluatePlayerWarzoneDeathStep({
    currentLives: 1,
    playerTeam: 'blue',
    hasClaimedSessionBase: true,
  });
  assert.equal(death5Blue.livesRemaining, 0);
  assert.equal(death5Blue.respawnLocation, 'main_lobby_safezone');
  assert.equal(death5Blue.shouldReleaseClaimedBase, true);
  assert.equal(isPointInsideLobbySafezone(death5Blue.spawnX, death5Blue.spawnZ), true);

  // 2. 3-Stage Pure Contract Harvester Lifecycle (Max 2 per Base: STANDBY -> CONTRACT_ACTIVE -> CONTRACT_FULFILLED despawn)
  assert.equal(MAX_HARVESTERS_PER_BASE, 2);
  const stageStandby = evaluateContractHarvesterLifecycle({
    hasActiveBuildContract: false,
    currentPadCrates: 0,
    targetContractCrates: 4,
  });
  assert.equal(stageStandby.stage, 'STANDBY');
  assert.equal(stageStandby.statusLabel, 'STANDBY (WAIT CONTRACT)');
  assert.equal(stageStandby.shouldLeaveBaseForWarzone, false);
  assert.equal(stageStandby.shouldDespawnWithParticles, false);

  const standbyPos0 = computeHarvesterBaseStandbyPosition(-45.0, 77.8, 'blue', 0);
  const standbyPos1 = computeHarvesterBaseStandbyPosition(-45.0, 77.8, 'blue', 1);
  assert.notEqual(standbyPos0.x, standbyPos1.x, 'Two Harvesters have distinct standby positions near Kiosk/Pad');

  const stageActive = evaluateContractHarvesterLifecycle({
    hasActiveBuildContract: true,
    currentPadCrates: 2,
    targetContractCrates: 4,
  });
  assert.equal(stageActive.stage, 'CONTRACT_ACTIVE');
  assert.equal(stageActive.statusLabel, 'CONTRACT ACTIVE (2/4)');
  assert.equal(stageActive.shouldLeaveBaseForWarzone, true);
  assert.equal(stageActive.shouldDespawnWithParticles, false);

  const stageFulfilled = evaluateContractHarvesterLifecycle({
    hasActiveBuildContract: true,
    currentPadCrates: 4,
    targetContractCrates: 4,
  });
  assert.equal(stageFulfilled.stage, 'CONTRACT_FULFILLED');
  assert.equal(stageFulfilled.shouldDespawnWithParticles, true);

  // 3. Lobby Gold Exchange (Redeem Warzone Gold for Skins & VIP Gear)
  assert.equal(isPointInsideLobbySafezone(LOBBY_GOLD_EXCHANGE_SPEC.x, LOBBY_GOLD_EXCHANGE_SPEC.z), true);
  assert.ok(LOBBY_GOLD_EXCHANGE_CATALOG.length >= 6);

  const buySkin = redeemLobbyGoldExchangeItem(1000, [], 'vip_royal_gold_skin');
  assert.equal(buySkin.success, true);
  assert.equal(buySkin.remainingGold, 250);
  assert.ok(buySkin.updatedOwnedItems.includes('vip_royal_gold_skin'));

  // 4. Always-On Open Warzone Population Bar (Max 10 vs 10: 4 Base Owners + 6 Warzone Roamers, strictly real players)
  assert.equal(OPEN_WARZONE_TEAM_CAPACITY.maxTotalPerTeam, 10);
  assert.equal(OPEN_WARZONE_TEAM_CAPACITY.maxBaseOwnersPerTeam, 4);
  assert.equal(OPEN_WARZONE_TEAM_CAPACITY.maxWarzoneRoamersPerTeam, 6);
  const soloPopBar = evaluateOpenWarzonePopulationBar({
    blueClaimedBasesCount: 0,
    redClaimedBasesCount: 0,
    blueExtraRoamers: 0,
    redExtraRoamers: 0,
    playerTeam: 'blue',
    isPlayerInLobby: false,
  });
  assert.equal(soloPopBar.blueOnline, 1);
  assert.equal(soloPopBar.redOnline, 0);
  assert.equal(soloPopBar.blueLabel, 'BLUE 1/10 ONLINE');
  assert.equal(soloPopBar.redLabel, 'RED 0/10 ONLINE');

  const soloBaseOwnerPopBar = evaluateOpenWarzonePopulationBar({
    blueClaimedBasesCount: 1,
    redClaimedBasesCount: 0,
    blueExtraRoamers: 0,
    redExtraRoamers: 0,
    playerTeam: 'blue',
    isPlayerInLobby: false,
    localPlayerHasClaimedBase: true,
  });
  assert.equal(soloBaseOwnerPopBar.blueOnline, 1);
  assert.equal(soloBaseOwnerPopBar.redOnline, 0);
  assert.equal(soloBaseOwnerPopBar.blueLabel, 'BLUE 1/10 ONLINE');
  assert.equal(soloBaseOwnerPopBar.redLabel, 'RED 0/10 ONLINE');

  const popBar = evaluateOpenWarzonePopulationBar({
    blueClaimedBasesCount: 2,
    redClaimedBasesCount: 1,
    blueExtraRoamers: 4,
    redExtraRoamers: 5,
    playerTeam: 'blue',
    isPlayerInLobby: false,
  });
  assert.equal(popBar.blueLabel, 'BLUE 7/10 ONLINE');
  assert.equal(popBar.redLabel, 'RED 6/10 ONLINE');
});

test('8 Grass-Island Shielded Public Crate Pads, Safe Shield Weapon Lock & Enemy Barrier, and 180-Degree Red Team True Mirror Camera POV', () => {
  // 1. Exactly 4 Blue Pads (South) and 4 Red Pads (North) = 8 Pads total, 100% on grass (NOT on asphalt road or crosswalk)
  const bluePads = getPublicWarzoneCratePadsForTeam('blue');
  const redPads = getPublicWarzoneCratePadsForTeam('red');
  assert.equal(bluePads.length, 4);
  assert.equal(redPads.length, 4);
  assert.equal(PUBLIC_WARZONE_CRATE_PADS.length, 8);

  for (const pad of PUBLIC_WARZONE_CRATE_PADS) {
    assert.equal(pad.shieldRadius, PUBLIC_PAD_SHIELD_RADIUS);
    // Center of pad must be 100% on grass (> 0.75) and NOT on asphalt road or zebra cross
    assert.ok(
      evaluateBlitzGrassMask(pad.x, pad.z) > 0.75,
      `${pad.id} center (${pad.x}, ${pad.z}) must have grassMask > 0.75`,
    );
    assert.equal(
      isPointOnAsphaltRoadOrZebraCross(pad.x, pad.z),
      false,
      `${pad.id} center must not be on asphalt road or zebra cross`,
    );
    // Perimeter of 3.6m shield ring must also be 100% on grass and off asphalt
    for (let deg = 0; deg < 360; deg += 45) {
      const rad = (deg * Math.PI) / 180;
      const sx: number = pad.x + Math.cos(rad) * pad.shieldRadius;
      const sz: number = pad.z + Math.sin(rad) * pad.shieldRadius;
      assert.ok(
        evaluateBlitzGrassMask(sx, sz) > 0.75,
        `${pad.id} shield perimeter at ${deg} deg (${sx.toFixed(1)}, ${sz.toFixed(1)}) must be on grass (> 0.75)`,
      );
      assert.equal(
        isPointOnAsphaltRoadOrZebraCross(sx, sz),
        false,
        `${pad.id} shield perimeter at ${deg} deg must not touch asphalt road`,
      );
    }
  }

  // 2. Safe Shield Zone: Enemy Barrier, External Damage Immunity, and Weapon Trigger Lock
  const sampleBluePad = bluePads[0];
  const insideFriendly = evaluatePublicPadShieldZone(sampleBluePad.x, sampleBluePad.z, 'blue');
  assert.equal(insideFriendly.insideAnyShield, true);
  assert.equal(insideFriendly.isFriendlyShield, true);
  assert.equal(insideFriendly.isEnemyShield, false);

  // Weapon Trigger Lock inside Safe Shield (Zero Visual Pollution), unlocked immediately when stepping outside
  assert.equal(isUnitWeaponTriggerLockedInSafeShield(sampleBluePad.x, sampleBluePad.z, 'blue'), true);
  assert.equal(
    isUnitWeaponTriggerLockedInSafeShield(
      sampleBluePad.x,
      sampleBluePad.z - (sampleBluePad.shieldRadius + 0.5),
      'blue',
    ),
    false,
  );

  // Enemy unit attempting to step into Blue Pad shield is pushed outside
  const enemyBarrier = resolveEnemyPublicPadShieldBarrier2D(
    sampleBluePad.x + 1.0,
    sampleBluePad.z,
    'red',
    0.7,
  );
  assert.equal(enemyBarrier.blocked, true);
  const pushedDist = Math.hypot(enemyBarrier.x - sampleBluePad.x, enemyBarrier.z - sampleBluePad.z);
  assert.ok(pushedDist >= sampleBluePad.shieldRadius + 0.69, 'Enemy pushed outside shield perimeter');

  // Friendly unit inside own team's Shielded Pad is 100% immune to external enemy damage
  assert.equal(
    canApplyCombatDamage('red', 'blue', 0, 0, sampleBluePad.x, sampleBluePad.z),
    false,
    'Friendly unit inside Shielded Pad is immune to external enemy gunfire',
  );

  // 3. Random Spawn among the 4 Team Shielded Pads on Portal Entry & Deaths 1..4
  const spawnRed0 = pickRandomTeamShieldedCratePadSpawn('red', 0.1);
  const spawnRed3 = pickRandomTeamShieldedCratePadSpawn('red', 0.9);
  assert.notEqual(spawnRed0.padId, spawnRed3.padId, 'Random selector picks across the 4 team pads');
  assert.equal(evaluatePublicPadShieldZone(spawnRed0.x, spawnRed0.z, 'red').isFriendlyShield, true);

  // 4. 180-Degree Red Team True Mirror Camera POV & Camera-Relative WASD Movement
  const blueCam = computeTeamMirrorCameraPose({
    playerTeam: 'blue',
    focusX: 10,
    focusY: 1,
    focusZ: -40,
    baseOffset: { x: 0, y: 13.6, z: 16.2 },
    fovScale: 1.0,
    visualPlaneAlt: 0,
    isEditorOrTitle: false,
  });
  const redCam = computeTeamMirrorCameraPose({
    playerTeam: 'red',
    focusX: 10,
    focusY: 1,
    focusZ: -40,
    baseOffset: { x: 0, y: 13.6, z: 16.2 },
    fovScale: 1.0,
    visualPlaneAlt: 0,
    isEditorOrTitle: false,
  });
  // Blue camera sits at +Z looking -Z; Red camera sits at -Z looking +Z (180-degree mirror)
  assert.ok(blueCam.cameraPos.z > -40 && blueCam.lookAtPos.z < -40);
  assert.ok(redCam.cameraPos.z < -40 && redCam.lookAtPos.z > -40);
  assert.equal(blueCam.cameraPos.y, redCam.cameraPos.y, 'Identical camera elevation angle');

  // Camera-relative WASD: pressing W (inputForward = +1) advances Blue toward -Z and Red toward +Z (both move UP the screen toward Warzone!)
  const blueForward = computeCameraRelativeMovementVector({
    inputForward: 1,
    inputRight: 0,
    playerTeam: 'blue',
  });
  const redForward = computeCameraRelativeMovementVector({
    inputForward: 1,
    inputRight: 0,
    playerTeam: 'red',
  });
  assert.equal(blueForward.moveX, 0);
  assert.equal(blueForward.moveZ, -1);
  assert.equal(redForward.moveX, 0);
  assert.equal(redForward.moveZ, 1);

  // Pressing D (inputRight = +1) moves Blue toward +X and Red toward -X (both move RIGHT on their respective screen POV!)
  const blueRight = computeCameraRelativeMovementVector({
    inputForward: 0,
    inputRight: 1,
    playerTeam: 'blue',
  });
  const redRight = computeCameraRelativeMovementVector({
    inputForward: 0,
    inputRight: 1,
    playerTeam: 'red',
  });
  assert.equal(blueRight.moveX, 1);
  assert.equal(blueRight.moveZ, 0);
  assert.equal(redRight.moveX, -1);
  assert.equal(redRight.moveZ, 0);
});

test('Claimed Base Plot Gate Authorization: sliding gate opens for plot owner, claimed NEAR Session player, and their AI Harvesters across plots 0..3', () => {
  // 1. Direct ownerCommanderId match opens the gate
  assert.equal(canUnitEnterCommanderBaseGate('blue', 2, 'blue', 2), true);
  assert.equal(canUnitEnterCommanderBaseGate('red', 1, 'red', 1), true);
  assert.equal(canUnitEnterCommanderBaseGate('blue', 0, 'blue', 2), false);

  // 2. Claimed NEAR Session plot authorizes the claiming player & their Harvesters even if unitOwnerCommanderId was 0
  const claimedBluePlot2 = { claimedTeam: 'blue' as const, claimedPlotIndex: 2 };
  assert.equal(canUnitEnterCommanderBaseGate('blue', 0, 'blue', 2, claimedBluePlot2), true);
  assert.equal(canUnitEnterCommanderBaseGate('red', 2, 'blue', 2, claimedBluePlot2), false);

  const claimedRedPlot1 = { claimedTeam: 'red' as const, claimedPlotIndex: 1 };
  assert.equal(canUnitEnterCommanderBaseGate('red', 0, 'red', 1, claimedRedPlot1), true);
  assert.equal(canUnitEnterCommanderBaseGate('blue', 1, 'red', 1, claimedRedPlot1), false);

  // 3. Single Active Recipe Contract (maxQueue = 1)
  const singleContract = enqueueKioskBuildRecipe([], 'nuclear_launcher', 1);
  assert.equal(singleContract.enqueued, true);
  assert.deepEqual(singleContract.queue, ['nuclear_launcher']);

  // 4. Floating CENTRAL PLAZA button at Halte Trem glowing circle strictly triggers inside the circle and disappears when stepping out
  assert.equal(LOBBY_TRAM_SHELTER_SPEC.label, 'CENTRAL PLAZA');
  assert.equal(
    isUnitNearLobbyTramReturnPad(
      LOBBY_TRAM_SHELTER_SPEC.returnPadX,
      LOBBY_TRAM_SHELTER_SPEC.returnPadZ,
    ),
    true,
  );
  assert.equal(
    isUnitNearLobbyTramReturnPad(
      LOBBY_TRAM_SHELTER_SPEC.shelterCenterX,
      LOBBY_TRAM_SHELTER_SPEC.shelterCenterZ,
    ),
    false,
    'Outside the glowing circle on the platform returns false so the floating LOBBY button disappears',
  );

  // 5. Character foot/selection ring strictly reflects team color (Blue #00a8ff / Red #ff3b30, never green/yellow)
  const blueRing = getUnitFootRingTeamColor('blue');
  assert.equal(blueRing.hexString, '#00a8ff');
  assert.equal(blueRing.hexInt, 0x00a8ff);
  const redRing = getUnitFootRingTeamColor('red');
  assert.equal(redRing.hexString, '#ff3b30');
  assert.equal(redRing.hexInt, 0xff3b30);

  // 6. Two Lobby Portal Circles on flat plaza (-84.0, ±15.0) (Gapura 1 = WARZONE with ['RED TEAM', 'BLUE TEAM']; Gapura 2 = SAFEZONE with ['ENTER CITY'])
  const warzonePortalStep = evaluateLobbyFactionPortalStep(-84.0, -15.0);
  assert.ok(warzonePortalStep);
  assert.equal(warzonePortalStep.portalKind, 'warzone');
  assert.deepEqual(warzonePortalStep.floatingButtons, ['RED TEAM', 'BLUE TEAM']);
  assert.equal(warzonePortalStep.floatingButtonLabel, 'RED TEAM');
  assert.equal(warzonePortalStep.autoTeleportOnStep, false);
  assert.equal(warzonePortalStep.requiresFloatingButtonClick, true);
  assert.equal(warzonePortalStep.portalWorldX, -84.0);
  assert.equal(warzonePortalStep.portalWorldZ, -15.0);

  const safezonePortalStep = evaluateLobbyFactionPortalStep(-84.0, 15.0);
  assert.ok(safezonePortalStep);
  assert.equal(safezonePortalStep.portalKind, 'safezone');
  assert.deepEqual(safezonePortalStep.floatingButtons, ['ENTER CITY']);
  assert.equal(safezonePortalStep.floatingButtonLabel, 'ENTER CITY');
  assert.equal(safezonePortalStep.autoTeleportOnStep, false);
  assert.equal(safezonePortalStep.requiresFloatingButtonClick, true);
  assert.equal(safezonePortalStep.portalWorldX, -84.0);
  assert.equal(safezonePortalStep.portalWorldZ, 15.0);
  assert.equal(safezonePortalStep.safezoneSpawnX, SAFEZONE_CITY_HALTE_SPAWN.x);
  assert.equal(safezonePortalStep.safezoneSpawnZ, SAFEZONE_CITY_HALTE_SPAWN.z);

  assert.equal(
    evaluateLobbyFactionPortalStep(-85.5, 0.0),
    null,
    'Stepping outside the portal circle returns null so the floating portal button disappears',
  );

  // 7. Safezone Mode rules & Halte Trem City Tram alignment
  const szRules = evaluateCitySafezoneModeRules('safezone');
  assert.equal(szRules.isPeacefulSafezone, true);
  assert.equal(szRules.cratesEnabled, false);
  assert.equal(szRules.explosiveBarrelsEnabled, false);
  assert.equal(szRules.landMinesEnabled, false);
  assert.equal(szRules.combatAiEnabled, false);
  assert.equal(szRules.baseKiosksEnabled, true, 'Base Kiosks remain enabled in Safezone for non-military CLAIM PLOT & PLOT ACCESS SETTINGS');
  assert.equal(szRules.militaryStackingPadsEnabled, false);
  assert.equal(szRules.skyshieldTurretsEnabled, false);
  assert.equal(szRules.harvestersEnabled, false);
  assert.equal(szRules.supplyDropsEnabled, false);
  assert.equal(szRules.weaponsEnabled, false);
  assert.equal(szRules.combatHudVisible, false);
  assert.equal(szRules.socialTalkEnabled, true);
  assert.equal(szRules.rideTramEnabled, true);

  const halteLeadDist = findCityTramLeadDistanceNearHalte();
  const tramAtHalte = evaluateCityTramConsistState(halteLeadDist);
  const boardAtHalte = canUnitBoardCityTramAtAnyPoint(
    SAFEZONE_CITY_HALTE_SPAWN.x,
    SAFEZONE_CITY_HALTE_SPAWN.z,
    tramAtHalte,
    6.2,
  );
  assert.equal(boardAtHalte.canBoard, true, 'Player spawned at Halte Trem is immediately within Ride Tram range');
});

test('Safezone Non-Military Plot Claiming & Kiosk Gate Access Settings (PUBLIC, FRIENDS ONLY, PRIVATE)', () => {
  // 1. Non-military plot claiming in Safezone mode (zero AI Harvesters, zero Skyshield turrets, zero military building colliders)
  const bluePlots = createIndividualCommanderBasesState('blue');
  let session = createInitialNearGamepassSessionState();
  session = connectNearWalletAndMintGamepass(session, 'owner-alpha.near');

  const claimRes = claimEmptyBasePlotWithNearGamepass(
    session,
    bluePlots,
    'blue',
    'blue',
    1,
    { isSafezoneMode: true },
  );
  assert.equal(claimRes.claimed, true);
  assert.equal(claimRes.updatedSession.activeHarvesterSubAccounts.length, 0, 'Zero AI Harvesters in Safezone mode');
  assert.equal(isCommanderBasePlotActive(bluePlots[1]), true);
  assert.equal(bluePlots[1].safezoneAccessMode, 'PUBLIC');
  assert.equal(claimRes.message.includes('CLAIMED'), true);

  // Verify Safezone static structures for claimed plot 1: fence, gate, sakura planter, and kiosk exist, while military building & bastion colliders are omitted
  const szStructures = buildStaticWorldStructuresList({
    blueBase: { baseGroup: new THREE.Group(), hqX: 0, hqZ: 74 },
    blueCommanderBases: bluePlots,
    redCommanderBases: createIndividualCommanderBasesState('red'),
    isSafezoneMode: true,
  });
  const szIds = szStructures.map((s) => s.id);
  assert.equal(szIds.includes('blue_plot_1_building'), false, 'Military house building collider omitted in Safezone');
  assert.equal(szIds.includes('bastion_b_1'), false, 'Skyshield turret bastion collider omitted in Safezone');
  assert.ok(szIds.includes('blue_plot_1_fence_w'), 'Perimeter fence collider active on claimed Safezone plot');
  assert.ok(szIds.includes('blue_plot_1_gate'), 'Automatic sliding gate collider active on claimed Safezone plot');
  assert.ok(szIds.includes('blue_plot_1_planter_0'), 'Sakura garden planter collider active on claimed Safezone plot');
  assert.ok(szIds.includes('blue_plot_1_kiosk'), 'Kiosk machine collider active on claimed Safezone plot');

  // 2. Gate Access Mode: PUBLIC -> opens for everyone
  setSafezonePlotAccessMode(bluePlots[1], 'PUBLIC');
  assert.equal(
    canUnitEnterCommanderBaseGate('red', 3, 'blue', 1, null, {
      isSafezoneMode: true,
      plot: bluePlots[1],
      unitWalletOrId: 'stranger-visitor.near',
      isPlotOwnerOverride: false,
    }),
    true,
    'PUBLIC mode opens gate for any visitor',
  );

  // 3. Gate Access Mode: FRIENDS_ONLY -> opens only for owner and allowed friends list
  setSafezonePlotAccessMode(bluePlots[1], 'FRIENDS_ONLY');
  addSafezonePlotFriend(bluePlots[1], 'best-buddy.near');
  assert.deepEqual(bluePlots[1].safezoneAllowedFriends, ['best-buddy.near']);

  assert.equal(
    canUnitEnterCommanderBaseGate('blue', 1, 'blue', 1, null, {
      isSafezoneMode: true,
      plot: bluePlots[1],
      unitWalletOrId: 'owner-alpha.near',
      isPlotOwnerOverride: true,
    }),
    true,
    'FRIENDS_ONLY mode opens gate for plot owner',
  );
  assert.equal(
    canUnitEnterCommanderBaseGate('red', 2, 'blue', 1, null, {
      isSafezoneMode: true,
      plot: bluePlots[1],
      unitWalletOrId: 'best-buddy.near',
      isPlotOwnerOverride: false,
    }),
    true,
    'FRIENDS_ONLY mode opens gate for whitelisted friend',
  );
  assert.equal(
    canUnitEnterCommanderBaseGate('red', 2, 'blue', 1, null, {
      isSafezoneMode: true,
      plot: bluePlots[1],
      unitWalletOrId: 'stranger-visitor.near',
      isPlotOwnerOverride: false,
    }),
    false,
    'FRIENDS_ONLY mode blocks non-friend visitor',
  );

  // Removing friend revokes gate access
  removeSafezonePlotFriend(bluePlots[1], 'best-buddy.near');
  assert.equal(
    canUnitEnterSafezonePlotGate({
      plot: bluePlots[1],
      unitWalletOrId: 'best-buddy.near',
      isPlotOwner: false,
    }),
    false,
  );

  // 4. Gate Access Mode: PRIVATE -> opens strictly for plot owner only
  setSafezonePlotAccessMode(bluePlots[1], 'PRIVATE');
  addSafezonePlotFriend(bluePlots[1], 'best-buddy.near');
  assert.equal(
    canUnitEnterCommanderBaseGate('blue', 1, 'blue', 1, null, {
      isSafezoneMode: true,
      plot: bluePlots[1],
      unitWalletOrId: 'owner-alpha.near',
      isPlotOwnerOverride: true,
    }),
    true,
    'PRIVATE mode opens gate for plot owner',
  );
  assert.equal(
    canUnitEnterCommanderBaseGate('blue', 2, 'blue', 1, null, {
      isSafezoneMode: true,
      plot: bluePlots[1],
      unitWalletOrId: 'best-buddy.near',
      isPlotOwnerOverride: false,
    }),
    false,
    'PRIVATE mode locks gate even for friends',
  );
});

test('Lobby & Safezone Combat HUD Cleanup, Hand Weapon Visibility, and Live City Road/Tram View', () => {
  // 1. Inside Lobby (worldMode === 'lobby' or isInsideLobbySafezone === true)
  const lobbyState = evaluateLobbyAndSafezonePeacefulState({
    worldMode: 'lobby',
    isInsideLobbySafezone: true,
    cityArenaMode: 'safezone',
  });
  assert.equal(lobbyState.isInsideLobby, true);
  assert.equal(lobbyState.isLobbyOrSafezone, true);
  assert.equal(lobbyState.combatHudVisible, false);
  assert.equal(lobbyState.populationAndLivesBarVisible, false);
  assert.equal(lobbyState.harvesterContractBadgeVisible, false);
  assert.equal(lobbyState.bottomRightWeaponAndHpHudVisible, false);
  assert.equal(lobbyState.minimapRadarVisible, false, 'Minimap Radar hidden inside Lobby room');
  assert.equal(lobbyState.lobbyGoldExchangeButtonVisible, true, 'Gold Exchange button shown inside Lobby');
  assert.equal(lobbyState.handWeaponMeshVisible, false, 'Pistol/weapon in character hand hidden inside Lobby');
  assert.equal(lobbyState.externalCombatObjectsVisible, false, 'Crates, weapon pads, barrels, turrets & combat AI hidden');
  assert.equal(lobbyState.externalCombatCollidersEnabled, false, 'External combat colliders disabled');
  assert.equal(lobbyState.cityRoadsAndTramVisible, true, 'Asphalt roads, zebra crossings, park & moving City Tram remain visible outside Lobby');

  assert.equal(lobbyState.lobbyPortalsVisible, false, 'Legacy floor portal rings removed');
  assert.equal(lobbyState.halteReturnPadsVisible, false, 'Legacy Halte return rings removed');
  assert.equal(lobbyState.cityKiosksAndUnitsVisible, true, 'City Kiosks & units visible across open Central Plaza and The City');

  const lobbyWorldRules = evaluateCitySafezoneModeRules('lobby');
  assert.equal(lobbyWorldRules.isPeacefulSafezone, true);
  assert.equal(lobbyWorldRules.cratesEnabled, false);
  assert.equal(lobbyWorldRules.explosiveBarrelsEnabled, false);
  assert.equal(lobbyWorldRules.combatAiEnabled, false);
  assert.equal(lobbyWorldRules.skyshieldTurretsEnabled, false);
  assert.equal(lobbyWorldRules.weaponsEnabled, false);

  // 2. In The City Mode outside Lobby (worldMode === 'safezone', isInsideLobbySafezone === false)
  const safezoneState = evaluateLobbyAndSafezonePeacefulState({
    worldMode: 'safezone',
    isInsideLobbySafezone: false,
    cityArenaMode: 'safezone',
  });
  assert.equal(safezoneState.isInsideLobby, false);
  assert.equal(safezoneState.isLobbyOrSafezone, true);
  assert.equal(safezoneState.combatHudVisible, false);
  assert.equal(safezoneState.populationAndLivesBarVisible, false);
  assert.equal(safezoneState.harvesterContractBadgeVisible, false);
  assert.equal(safezoneState.bottomRightWeaponAndHpHudVisible, false);
  assert.equal(safezoneState.minimapRadarVisible, true);
  assert.equal(safezoneState.lobbyGoldExchangeButtonVisible, false);
  assert.equal(safezoneState.handWeaponMeshVisible, false, 'Pistol/weapon in character hand hidden in The City');
  assert.equal(safezoneState.externalCombatObjectsVisible, false);
  assert.equal(safezoneState.externalCombatCollidersEnabled, false);
  assert.equal(safezoneState.cityRoadsAndTramVisible, true);
  assert.equal(safezoneState.lobbyPortalsVisible, false);
  assert.equal(safezoneState.halteReturnPadsVisible, false);
  assert.equal(safezoneState.cityKiosksAndUnitsVisible, true);

  // 3. In Warzone Mode outside Lobby (worldMode === 'warzone', isInsideLobbySafezone === false)
  const warzoneState = evaluateLobbyAndSafezonePeacefulState({
    worldMode: 'warzone',
    isInsideLobbySafezone: false,
    cityArenaMode: 'warzone',
  });
  assert.equal(warzoneState.isInsideLobby, false);
  assert.equal(warzoneState.isLobbyOrSafezone, false);
  assert.equal(warzoneState.combatHudVisible, true);
  assert.equal(warzoneState.populationAndLivesBarVisible, true);
  assert.equal(warzoneState.harvesterContractBadgeVisible, true);
  assert.equal(warzoneState.bottomRightWeaponAndHpHudVisible, true);
  assert.equal(warzoneState.minimapRadarVisible, true);
  assert.equal(warzoneState.lobbyGoldExchangeButtonVisible, false);
  assert.equal(warzoneState.handWeaponMeshVisible, true, 'Hand weapon mesh visible when entering Warzone');
  assert.equal(warzoneState.externalCombatObjectsVisible, true);
  assert.equal(warzoneState.externalCombatCollidersEnabled, true);
  assert.equal(warzoneState.cityRoadsAndTramVisible, true);
  assert.equal(warzoneState.lobbyPortalsVisible, false);
  assert.equal(warzoneState.halteReturnPadsVisible, false);
  assert.equal(warzoneState.cityKiosksAndUnitsVisible, true);
});

test('Swapped Halte Canopy (East/Right x=-60.45) & 2 Crate-Pad LOBBY Rings (West/Left x=-63.4) on Concrete Platform, Lobby Wall Boundary (-76.2), and Ghost Movement Fix', () => {
  // 1. Halte Trem concrete platform stays at [-64.97, -58.37] (width 6.6m, centerX = -61.67, Z length = 15.4m),
  //    Roof Canopy is moved to the Right/East side (canopyCenterX = -60.45, near grass),
  //    and the 2 LOBBY return rings are moved to the Left/West side (x = -63.4, near tram track).
  assert.equal(LOBBY_TRAM_SHELTER_SPEC.centralPlatformLength, 15.4);
  assert.equal(LOBBY_TRAM_SHELTER_SPEC.platformLength, 18.4);
  assert.equal(LOBBY_TRAM_SHELTER_SPEC.platformWidth, 6.6);
  assert.equal(LOBBY_TRAM_SHELTER_SPEC.platformCenterX, -61.67);
  assert.equal(LOBBY_TRAM_SHELTER_SPEC.westEdgeX, -64.97);
  assert.equal(LOBBY_TRAM_SHELTER_SPEC.eastEdgeX, -58.37);
  assert.equal(LOBBY_TRAM_SHELTER_SPEC.canopyCenterX, -60.45);
  assert.equal(LOBBY_TRAM_SHELTER_SPEC.canopyLength, 15.4, 'Roof canopy length remains unchanged');
  assert.equal(LOBBY_TRAM_SHELTER_SPEC.canopyWidth, 2.58, 'Roof canopy width remains unchanged');
  assert.equal(LOBBY_TRAM_SHELTER_SPEC.canopyHeight, 3.35, 'Roof canopy height remains unchanged');

  const canopyWestEdgeX =
    LOBBY_TRAM_SHELTER_SPEC.canopyCenterX - LOBBY_TRAM_SHELTER_SPEC.canopyWidth * 0.5;
  const canopyEastEdgeX =
    LOBBY_TRAM_SHELTER_SPEC.canopyCenterX + LOBBY_TRAM_SHELTER_SPEC.canopyWidth * 0.5;
  const platformWestEdgeX = LOBBY_TRAM_SHELTER_SPEC.westEdgeX;
  const platformEastEdgeX = LOBBY_TRAM_SHELTER_SPEC.eastEdgeX;
  const platformHalfZ = LOBBY_TRAM_SHELTER_SPEC.centralPlatformLength * 0.5;

  assert.ok(
    canopyWestEdgeX >= platformWestEdgeX && canopyEastEdgeX <= platformEastEdgeX,
    'Halte roof canopy sits 100% on the concrete platform (East/Right side near grass)',
  );

  // Verify the entire Halte platform deck never cuts into the East-West asphalt road or zebra cross
  for (const testZ of [-9.2, -7.7, -4.6, 0, 4.6, 7.7, 9.2]) {
    assert.equal(
      isPointOnAsphaltRoadOrZebraCross(LOBBY_TRAM_SHELTER_SPEC.platformCenterX, testZ),
      false,
      `Halte platform at z=${testZ} must not overlap East-West asphalt road or zebra cross`,
    );
  }

  // 2. Exactly 2 Crate-Pad-style LOBBY return circles on the West/Left side of the Halte concrete deck (x = -63.4, z = ±4.6, radius = 1.45), 100% on concrete deck and 0% on asphalt road
  assert.equal(LOBBY_TRAM_RETURN_PADS.length, 2);
  const [northPad, southPad] = LOBBY_TRAM_RETURN_PADS;
  assert.equal(northPad.id, 'north_lobby_pad');
  assert.equal(northPad.x, -63.4);
  assert.equal(northPad.z, -4.6);
  assert.equal(northPad.radius, 1.45);
  assert.equal(northPad.style, 'crate_pad_hologram');
  assert.equal(southPad.id, 'south_lobby_pad');
  assert.equal(southPad.x, -63.4);
  assert.equal(southPad.z, 4.6);
  assert.equal(southPad.radius, 1.45);
  assert.equal(southPad.style, 'crate_pad_hologram');

  for (const pad of LOBBY_TRAM_RETURN_PADS) {
    assert.ok(
      pad.x + pad.radius < canopyWestEdgeX,
      `${pad.id} sits on the open West/Left side of the concrete platform completely clear of the East roof canopy`,
    );
    assert.ok(
      pad.x - pad.radius >= platformWestEdgeX && pad.x + pad.radius <= platformEastEdgeX,
      `${pad.id} sits 100% within the concrete platform width [-64.97, -58.37]`,
    );
    assert.ok(
      Math.abs(pad.z) + pad.radius <= platformHalfZ,
      `${pad.id} sits 100% within the central 15.4m concrete platform length`,
    );
    assert.equal(
      isPointOnAsphaltRoadOrZebraCross(pad.x, pad.z),
      false,
      `${pad.id} center must not be on asphalt road`,
    );
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      const px = pad.x + Math.cos(angle) * pad.radius;
      const pz = pad.z + Math.sin(angle) * pad.radius;
      assert.equal(
        isPointOnAsphaltRoadOrZebraCross(px, pz),
        false,
        `${pad.id} perimeter point (${px.toFixed(2)}, ${pz.toFixed(2)}) must not cut onto asphalt road`,
      );
    }

    const step = evaluateLobbyTramReturnPadStep(pad.x, pad.z);
    assert.ok(step);
    assert.equal(step.padId, pad.id);
    assert.equal(step.floatingButtonLabel, 'CENTRAL PLAZA');
    assert.equal(step.autoTeleportOnStep, false);
    assert.equal(step.requiresFloatingButtonClick, true);
    assert.equal(isUnitNearLobbyTramReturnPad(pad.x, pad.z), true);
  }

  // 3. Lobby Concrete Wall Boundary (maxX = -76.2) & Scene Isolation prevents ENTER CITY / Lobby Safezone leak on grass/road outside wall
  assert.equal(LOBBY_SAFEZONE_BOUNDS.maxX, -76.2);
  assert.equal(
    isPointInsideLobbySafezone(-74.0, 15.0, 'lobby'),
    false,
    'Walking on grass outside Lobby concrete wall (x = -74.0 > -76.2) is NEVER inside Lobby Safezone',
  );
  assert.equal(
    isPointInsideLobbySafezone(-80.0, 15.0, 'warzone'),
    false,
    'When activeScene is warzone, Lobby Safezone never leaks even at x = -80.0',
  );
  assert.equal(
    evaluateLobbyFactionPortalStep(-80.0, 15.0, () => 0.5, 'warzone'),
    null,
    'ENTER CITY / RED TEAM / BLUE TEAM portal prompt never triggers when activeScene is warzone/safezone',
  );

  // 4. Both Lobby Gapura Portals (WARZONE & SAFEZONE) sit 100% on the flat upper Lobby plaza (elevation === 2.50m across full radius) with Crate Pad visual style
  const [warzonePortal, safezonePortal] = LOBBY_FACTION_PORTALS;
  assert.equal(warzonePortal.x, -84.0);
  assert.equal(warzonePortal.z, -15.0);
  assert.equal(warzonePortal.style, 'crate_pad_hologram');
  assert.equal(safezonePortal.x, -84.0);
  assert.equal(safezonePortal.z, 15.0);
  assert.equal(safezonePortal.style, 'crate_pad_hologram');

  for (const portal of LOBBY_FACTION_PORTALS) {
    const centerElev = getBaseProceduralGroundElevation(portal.x, portal.z);
    assert.equal(centerElev, 2.5, `${portal.id} center sits on flat 2.5m Lobby plaza deck`);
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      const px = portal.x + Math.cos(angle) * portal.radius;
      const pz = portal.z + Math.sin(angle) * portal.radius;
      const edgeElev = getBaseProceduralGroundElevation(px, pz);
      assert.equal(
        edgeElev,
        2.5,
        `${portal.id} perimeter (${px.toFixed(2)}, ${pz.toFixed(2)}) sits on 100% flat 2.5m plaza (not on a ramp)`,
      );
    }
  }

  // 5. Ghost Movement Guard: zeroes velocity when no keys are pressed, when TALK input is focused, or during modal/scene transitions
  const idleKeys: Record<string, boolean> = { KeyW: false, KeyS: false, KeyA: false, KeyD: false };
  const idleGuard = evaluatePlayerGhostMovementGuard({
    keysPressed: idleKeys,
    isWindowBlurred: false,
    isTalkInputFocused: false,
    isFloatingButtonOrModalOpen: false,
    moveSpeed: 9.0,
    playerTeam: 'blue',
  });
  assert.equal(idleGuard.vx, 0);
  assert.equal(idleGuard.vz, 0);
  assert.equal(idleGuard.hasActiveMovementInput, false);
  assert.equal(idleGuard.aiTargetPos, null);

  const stuckKeys: Record<string, boolean> = { KeyW: true, KeyD: true };
  const talkInputFocusedGuard = evaluatePlayerGhostMovementGuard({
    keysPressed: stuckKeys,
    isWindowBlurred: false,
    isTalkInputFocused: true,
    isFloatingButtonOrModalOpen: false,
    moveSpeed: 9.0,
    playerTeam: 'blue',
  });
  assert.equal(talkInputFocusedGuard.shouldClearKeys, true);
  assert.equal(stuckKeys.KeyW, false, 'Stuck KeyW is cleared when TALK input is focused');
  assert.equal(stuckKeys.KeyD, false, 'Stuck KeyD is cleared when TALK input is focused');
  assert.equal(talkInputFocusedGuard.inputForward, 0);
  assert.equal(talkInputFocusedGuard.inputRight, 0);
  assert.equal(talkInputFocusedGuard.vx, 0);
  assert.equal(talkInputFocusedGuard.vz, 0);
  assert.equal(talkInputFocusedGuard.aiTargetPos, null);
});

test('DYNAMIC CHUNK CULLING (20.8m): Dynamic entities and minimap dots culled outside 20.8m, allies always visible, and map preview bypasses culling', async () => {
  const {
    DYNAMIC_CHUNK_CULLING_RADIUS,
    isPositionInsideDynamicCullingRadius,
    evaluatePlayerCommandCenterRadarAndMinimapDots,
  } = await import('./buddiesBlitzMinimap');

  assert.equal(DYNAMIC_CHUNK_CULLING_RADIUS, 20.8);

  // 1. Distance checks
  assert.equal(isPositionInsideDynamicCullingRadius(10, 10, 0, 0), true); // dist ~14.14m <= 20.8m
  assert.equal(isPositionInsideDynamicCullingRadius(20.8, 0, 0, 0), true); // dist 20.8m <= 20.8m
  assert.equal(isPositionInsideDynamicCullingRadius(20.9, 0, 0, 0), false); // dist 20.9m > 20.8m
  assert.equal(isPositionInsideDynamicCullingRadius(50, 50, 0, 0), false); // dist ~70.7m > 20.8m

  // 2. Minimap evaluation test
  const playerUnit: any = {
    id: 1,
    team: 'blue',
    isPlayer: true,
    alive: true,
    x: 0,
    z: 0,
  };
  const allyUnitFar: any = {
    id: 2,
    team: 'blue',
    isPlayer: false,
    alive: true,
    x: 100,
    z: 100, // 141m away
  };
  const enemyUnitNear: any = {
    id: 3,
    team: 'red',
    isPlayer: false,
    alive: true,
    x: 12,
    z: 12, // ~16.9m away <= 20.8m
  };
  const enemyUnitFar: any = {
    id: 4,
    team: 'red',
    isPlayer: false,
    alive: true,
    x: 60,
    z: 60, // ~84.8m away > 20.8m
  };

  const crates: any[] = [
    { id: 1, x: 10, z: 10, state: 'ground', isSuper: false }, // near ~14.1m
    { id: 2, x: 80, z: 80, state: 'ground', isSuper: false }, // far ~113m
  ];
  const pickups: any[] = [
    { id: 1, x: 5, z: 5, collected: false, isFromDeathDrop: false }, // near ~7m
    { id: 2, x: 75, z: 75, collected: false, isFromDeathDrop: false }, // far ~106m
  ];
  const barrels: any[] = [
    { id: 1, kind: 'explosive_barrel', alive: true, x: 12, z: 0 }, // near 12m
    { id: 2, kind: 'explosive_barrel', alive: true, x: 90, z: 0 }, // far 90m
  ];

  // In standard play mode:
  const standardResult = evaluatePlayerCommandCenterRadarAndMinimapDots({
    myPlot: {} as any,
    buddyUnits: [playerUnit, allyUnitFar, enemyUnitNear, enemyUnitFar],
    tanks: [],
    playerUnit,
    mountedTank: null,
    teamCommand: 'ATTACK',
    actorX: 0,
    actorZ: 0,
    worldCrates: crates,
    worldPickups: pickups,
    activeMapProps: barrels,
    playMode: 'sandbox',
    bypassDistanceCulling: false,
  });

  const dotIds = standardResult.radarDots.map((d) => d.id);

  // Player and Ally far should ALWAYS be visible
  assert.ok(dotIds.includes('b-1'), 'Player should be on minimap');
  assert.ok(dotIds.includes('b-2'), 'Far ally should ALWAYS be on minimap (no culling for friendly)');

  // Near enemy is on minimap; Far enemy is CULLED
  assert.ok(dotIds.includes('b-3'), 'Near enemy within 26m should be on minimap');
  assert.ok(!dotIds.includes('b-4'), 'Far enemy outside 26m should be CULLED from minimap');

  // Near crate is on minimap; Far crate is CULLED
  assert.ok(dotIds.includes('crate-1'), 'Near crate within 26m should be on minimap');
  assert.ok(!dotIds.includes('crate-2'), 'Far crate outside 26m should be CULLED from minimap');

  // Near pickup is on minimap; Far pickup is CULLED
  assert.ok(dotIds.includes('pickup-1'), 'Near pickup within 26m should be on minimap');
  assert.ok(!dotIds.includes('pickup-2'), 'Far pickup outside 26m should be CULLED from minimap');

  // Near barrel is on minimap; Far barrel is CULLED
  assert.ok(dotIds.includes('barrel-1'), 'Near barrel within 26m should be on minimap');
  assert.ok(!dotIds.includes('barrel-2'), 'Far barrel outside 26m should be CULLED from minimap');

  // In MAP PREVIEW mode: all items and enemies bypass culling!
  const previewResult = evaluatePlayerCommandCenterRadarAndMinimapDots({
    myPlot: {} as any,
    buddyUnits: [playerUnit, allyUnitFar, enemyUnitNear, enemyUnitFar],
    tanks: [],
    playerUnit,
    mountedTank: null,
    teamCommand: 'ATTACK',
    actorX: 0,
    actorZ: 0,
    worldCrates: crates,
    worldPickups: pickups,
    activeMapProps: barrels,
    playMode: 'editor',
    bypassDistanceCulling: true,
  });

  const previewDotIds = previewResult.radarDots.map((d) => d.id);
  assert.ok(previewDotIds.includes('b-4'), 'Far enemy is visible in MAP PREVIEW');
  assert.ok(previewDotIds.includes('crate-2'), 'Far crate is visible in MAP PREVIEW');
  assert.ok(previewDotIds.includes('pickup-2'), 'Far pickup is visible in MAP PREVIEW');
  assert.ok(previewDotIds.includes('barrel-2'), 'Far barrel is visible in MAP PREVIEW');
});

test('Smooth Scale/Fade Chunk Culling (17.5m-20.8m) & 1.5s Spawn Blink without Camera Shake', () => {
  assert.equal(DYNAMIC_CHUNK_CULLING_OUTER_RADIUS, 20.8);
  assert.equal(DYNAMIC_CHUNK_CULLING_FADE_START_RADIUS, 17.5);
  assert.equal(PLAYER_SPAWN_BLINK_DURATION_SEC, 1.5);

  // 1. Inside inner fade radius (<= 17.5m): scaleFactor = 1.0, visible = true
  const inside = evaluateChunkSynced3DFogOfWar(15.0, 0, 0, 0);
  assert.equal(inside.scaleFactor, 1);
  assert.equal(inside.visible, true);

  // 2. Mid-way in transition zone (19.15m, halfway between 17.5m and 20.8m): scaleFactor = 0.5, visible = true
  const midFade = evaluateChunkSynced3DFogOfWar(19.15, 0, 0, 0);
  assert.ok(Math.abs(midFade.scaleFactor - 0.5) < 0.02, `Expected ~0.5 scale at midpoint, got ${midFade.scaleFactor}`);
  assert.equal(midFade.visible, true);

  // 3. Near outer edge (20.5m): small positive scale >= 0.01 still visible before disappearing
  const nearEdge = evaluateChunkSynced3DFogOfWar(20.5, 0, 0, 0);
  assert.ok(nearEdge.scaleFactor > 0.01 && nearEdge.scaleFactor < 0.25);
  assert.equal(nearEdge.visible, true);

  // 4. Outside outer radius (>= 20.8m): scaleFactor = 0, visible = false
  const outside = evaluateChunkSynced3DFogOfWar(21.0, 0, 0, 0);
  assert.equal(outside.scaleFactor, 0);
  assert.equal(outside.visible, false);

  // 5. Verify applyGrassChunkSyncedFogOfWar3D smoothly interpolates mesh.scale toward targetScale and hides only when scale < 0.01
  const crateMidMesh = new THREE.Group();
  const crateOutMesh = new THREE.Group();
  const crateInMesh = new THREE.Group();
  crateOutMesh.scale.setScalar(0.005);
  const testCrates: any[] = [
    { id: 1, x: 10, z: 0, state: 'grounded', mesh: crateInMesh },
    { id: 2, x: 19.15, z: 0, state: 'grounded', mesh: crateMidMesh },
    { id: 3, x: 40, z: 0, state: 'grounded', mesh: crateOutMesh },
  ];
  applyGrassChunkSyncedFogOfWar3D({
    viewerX: 0,
    viewerZ: 0,
    playMode: 'sandbox',
    bypassFogOfWar: false,
    worldCrates: testCrates,
    worldPickups: [],
    activeOrdnanceDevices: [],
    buddyUnits: [],
    tanks: [],
    activeMapProps: [],
    worldMode: 'warzone',
    playerTeam: 'blue',
  });
  assert.equal(crateInMesh.visible, true);
  assert.equal(crateInMesh.scale.x, 1);
  assert.equal(crateMidMesh.visible, true);
  assert.ok(crateMidMesh.scale.x > 0.4 && crateMidMesh.scale.x < 0.9, 'Mid-zone crate smoothly scales down');
  assert.equal(crateOutMesh.visible, false, 'Out-of-range crate with scale < 0.01 becomes invisible');

  // Verify player character root stays hidden when occupying a vehicle (Truck, Plane, or Tank)
  const mountedPlayerRoot = new THREE.Group();
  mountedPlayerRoot.visible = true;
  const mountedPlayerSaluteSprite = { visible: true };
  const testMountedPlayer: any = {
    id: 0,
    isPlayer: true,
    alive: true,
    team: 'blue',
    x: 0,
    z: 0,
    root: mountedPlayerRoot,
    bodyGroup: new THREE.Group(),
    saluteSign: { sprite: mountedPlayerSaluteSprite },
  };
  const testOccupiedVehicle: any = {
    id: 101,
    hp: 100,
    team: 'blue',
    x: 0,
    z: 0,
    occupiedByPlayer: true,
    occupiedByAiId: null,
    root: new THREE.Group(),
    bodyGroup: new THREE.Group(),
  };
  applyGrassChunkSyncedFogOfWar3D({
    viewerX: 0,
    viewerZ: 0,
    playMode: 'sandbox',
    bypassFogOfWar: false,
    worldCrates: [],
    worldPickups: [],
    activeOrdnanceDevices: [],
    buddyUnits: [testMountedPlayer],
    tanks: [testOccupiedVehicle],
    activeMapProps: [],
    worldMode: 'warzone',
    playerTeam: 'blue',
  });
  assert.equal(
    mountedPlayerRoot.visible,
    false,
    'Player unit root must remain hidden while driving a Truck, Plane, or Tank',
  );
  assert.equal(mountedPlayerSaluteSprite.visible, false);

  // 6. Verify 1.5s Spawn Blink toggles character visibility at 10Hz (~30 toggles over 1.5s) and ends with visible = true
  let timer = PLAYER_SPAWN_BLINK_DURATION_SEC;
  let toggles = 0;
  let prevVis = stepPlayerInvincibilityState(timer, 0).spriteVisible;
  for (let i = 0; i < 61; i++) {
    const step = stepPlayerInvincibilityState(timer, 0.025);
    timer = step.invincibilityTimer;
    if (step.spriteVisible !== prevVis) {
      toggles++;
      prevVis = step.spriteVisible;
    }
  }
  assert.ok(toggles >= 24, `Expected >= 24 visibility toggles over 1.5s at 10Hz, got ${toggles}`);
  assert.equal(timer, 0);
  assert.equal(stepPlayerInvincibilityState(0, 0.016).spriteVisible, true);
});

import {
  MERCHANT_CATALOG_ITEMS,
  CUTAWAY_ROOM_BOUNDS,
  createInitialMerchantMarketState,
  evaluateLulToCyonExchangeQuote,
  evaluateMerchantItemQuote,
  executeLulToCyonExchange,
  investInMerchantShop,
  stepFastForwardEconomyTick,
  generateNpcMerchantReply,
  checkObbCollision2D,
  snapFurnitureToGridAndWalls,
  solveFurnitureFreePlacement,
  createPlacedHouseFurnitureItem,
  stepFurnitureSpringWobblePhysics,
  formatDaylightHour,
  evaluateRoomDaylightState,
  evaluateRoomMoodScores,
} from './buddiesMerchantPricing';

test('3-Currency Economy (LUL, CYON, RESPITE), NPC Merchant Dynamic Pricing, Bankruptcy & Investment, and Fast-Forward Simulation', () => {
  let state = createInitialMerchantMarketState();
  assert.equal(state.isShopBroke, false);
  assert.ok(MERCHANT_CATALOG_ITEMS.some((i) => i.currency === 'CYON' && !i.isNft));
  assert.ok(MERCHANT_CATALOG_ITEMS.some((i) => i.currency === 'RESPITE' && i.isNft));

  // 1. LUL -> CYON exchange quote and execution
  const initialQuote = evaluateLulToCyonExchangeQuote(state);
  assert.equal(initialQuote.cyonGranted, 10);
  assert.ok(initialQuote.lulCostFor10Cyon >= 100);
  assert.ok(initialQuote.reasoningTooltip.length > 10);

  const exRes = executeLulToCyonExchange(state, 500, 60);
  assert.equal(exRes.ok, true);
  assert.equal(exRes.updatedCyon, 70);
  assert.equal(exRes.updatedLul, 500 - initialQuote.lulCostFor10Cyon);
  state = exRes.updatedState;

  // 2. Dynamic pricing quote with reasoning tooltip for Non-NFT (CYON) and NFT (RESPITE)
  const chabudai = MERCHANT_CATALOG_ITEMS.find((i) => i.id === 'tatami_tea_table')!;
  const neonTheme = MERCHANT_CATALOG_ITEMS.find((i) => i.id === 'theme_cyber_neon')!;
  const q1 = evaluateMerchantItemQuote(state, chabudai);
  const q2 = evaluateMerchantItemQuote(state, neonTheme);
  assert.ok(q1.buyPrice > 0 && q1.sellbackPrice > 0);
  assert.ok(q1.reasoningTooltip.includes('CYON'));
  assert.ok(q2.reasoningTooltip.includes('RESPITE'));

  // 3. Bankruptcy when treasuryCyon < 20 and player investment recapitalization (+45 CYON dividend & -15% discount)
  const brokeState = { ...state, treasuryCyon: 15 };
  const lastEx = executeLulToCyonExchange(brokeState, 500, 70);
  assert.equal(lastEx.ok, true);
  assert.equal(lastEx.updatedState.isShopBroke, true, 'Shop goes broke when treasuryCyon drops below 20');

  const blockedEx = executeLulToCyonExchange(lastEx.updatedState, 500, 80);
  assert.equal(blockedEx.ok, false, 'Broke shop blocks further LUL -> CYON exchanges until invested');

  const invRes = investInMerchantShop(lastEx.updatedState, 500, 80);
  assert.equal(invRes.ok, true);
  assert.equal(invRes.updatedState.isShopBroke, false);
  assert.equal(invRes.updatedState.investorDiscountActive, true);
  assert.equal(invRes.updatedCyon, 125);

  // 4. Fast-Forward Economy tick & AI dialogue response
  const nextTick = stepFastForwardEconomyTick(invRes.updatedState, 1);
  assert.equal(nextTick.dayCounter, invRes.updatedState.dayCounter + 1);
  const reply = generateNpcMerchantReply(
    'Berapa kurs tukar LUL ke CYON dan rekomendasi tema NFT?',
    'lobby_cafe',
    nextTick,
    { lul: 500, cyon: 125, respite: 45, walletConnected: true },
  );
  assert.ok(reply.length > 20);
});

test('Cutaway House Studio: 10cm Grid + 25cm Wall Snap, 2D SAT OBB Collision, Spiral Free-Spot Search, 120Hz Spring-Wobble, Daylight Arc, and Softmax Mood Meter', () => {
  // 1. Cutaway room bounds match 10.6m x 7.4m x 2.75m studio floorplan
  assert.equal(CUTAWAY_ROOM_BOUNDS.minX, -5.3);
  assert.equal(CUTAWAY_ROOM_BOUNDS.maxX, 5.3);
  assert.equal(CUTAWAY_ROOM_BOUNDS.minZ, -3.7);
  assert.equal(CUTAWAY_ROOM_BOUNDS.maxZ, 3.7);
  assert.equal(CUTAWAY_ROOM_BOUNDS.fullWallHeight, 2.75);

  // 2. 2D Separating Axis Theorem (SAT) OBB overlap check (Qs)
  const obbA = { x: 0, z: 0, hw: 0.8, hd: 0.5, a: 0 };
  const obbBOverlap = { x: 1.1, z: 0.2, hw: 0.6, hd: 0.4, a: Math.PI / 4 };
  const obbBSeparated = { x: 2.2, z: 0, hw: 0.6, hd: 0.4, a: Math.PI / 4 };
  assert.equal(checkObbCollision2D(obbA, obbBOverlap), true);
  assert.equal(checkObbCollision2D(obbA, obbBSeparated), false);

  // 3. 10cm Grid Snap & 25cm Magnetic Wall Snap (ti)
  const [tableSnapX, tableSnapZ] = snapFurnitureToGridAndWalls('tatami_tea_table', 0.14, -0.26, 0);
  assert.equal(tableSnapX, 0.1);
  assert.equal(tableSnapZ, -0.3);

  // Near left wall (minX = -5.3): tatami_tea_table has w = 1.35 (hw = 0.675) -> flush wall x = -5.3 + 0.675 + 0.004 = -4.621
  const [wallSnapX] = snapFurnitureToGridAndWalls('tatami_tea_table', -4.48, 2.0, 0);
  assert.ok(Math.abs(wallSnapX - -4.621) < 0.01, `Expected magnetic snap near left wall (-4.621), got ${wallSnapX}`);

  // 4. Spiral Free-Spot Search (Sr) resolves non-overlapping placement when two items are dropped at the same spot
  const placed1 = createPlacedHouseFurnitureItem('inst_table_1', 'tatami_tea_table', -1.1, 0.5, 0, true);
  const freeSpot2 = solveFurnitureFreePlacement('inst_arcade_1', 'arcade_blitz_cab', -1.1, 0.5, 0, [placed1]);
  assert.equal(freeSpot2.valid, true, 'Spiral search must find a valid non-overlapping floor coordinate');
  const distBetween = Math.hypot(freeSpot2.x - placed1.x, freeSpot2.z - placed1.z);
  assert.ok(distBetween > 0.8, `Second furniture item must be spiral-shifted clear of first item (dist=${distBetween.toFixed(2)}m)`);

  // 5. 120Hz Substepped Spring-Damper Bounce & Acceleration-Driven 2-Axis Harmonic Tilt Wobble (Hc)
  const dragItem = createPlacedHouseFurnitureItem('inst_lamp_1', 'shoji_floor_lamp', -1.5, 0.0, 0, true);
  dragItem.lift = 0.16; // Picked up by cursor
  dragItem.x = -0.5;
  dragItem.z = 0.4;
  const dragPose = stepFurnitureSpringWobblePhysics(dragItem, 0.05);
  assert.ok(dragItem.sy > 0.02, 'Lifted furniture rises smoothly on vertical spring');
  assert.ok(
    Math.abs(dragPose.tiltX) > 1e-4 || Math.abs(dragPose.tiltZ) > 1e-4,
    'Horizontal acceleration induces 2-axis harmonic tilt wobble',
  );

  // Drop item back onto floor (lift = 0) and settle
  dragItem.lift = 0;
  for (let i = 0; i < 60; i++) {
    stepFurnitureSpringWobblePhysics(dragItem, 1 / 60);
  }
  assert.ok(dragItem.sy >= 0 && dragItem.sy < 0.01, 'Dropped furniture settles back onto studio floor');

  // 6. Daylight Time Slider (05:30 - 23:30), 3D Sun/Moon Orbital Arc & Lamp Intensity (uo)
  assert.equal(formatDaylightHour(18.5), '18:30');
  const morningLight = evaluateRoomDaylightState(8.8);
  const noonLight = evaluateRoomDaylightState(12.8);
  const nightLight = evaluateRoomDaylightState(22.2);
  assert.ok(noonLight.sunDir.y > 0.65, 'Midday sun sits high on the orbital arc');
  assert.ok(
    morningLight.beamIntensityLeft + morningLight.beamIntensityBack >
      nightLight.beamIntensityLeft + nightLight.beamIntensityBack,
    'Daytime sun projects volumetric window god-rays whereas nighttime has 0 sun beams',
  );
  assert.ok(nightLight.lampIntensity > noonLight.lampIntensity, 'Nighttime automatically boosts interior warm lamps (uo)');

  // 7. Temperature-Scaled Softmax Mood Meter (Cozy % / Bright % / Moody %)
  const brightMood = evaluateRoomMoodScores({
    themeId: 'theme_japanese_ryokan',
    floorSwatchId: 'floor_whiteoak',
    wallSwatchId: 'wall_chalk',
    hour: 12.8,
  });
  assert.equal(brightMood.cozyPct + brightMood.brightPct + brightMood.moodyPct, 100);
  assert.equal(brightMood.dominantMood, 'bright');

  const moodyNight = evaluateRoomMoodScores({
    themeId: 'theme_cyber_neon',
    floorSwatchId: 'floor_smoked_slate',
    wallSwatchId: 'wall_ink_cyber',
    hour: 22.4,
  });
  assert.equal(moodyNight.cozyPct + moodyNight.brightPct + moodyNight.moodyPct, 100);
  assert.equal(moodyNight.dominantMood, 'moody');
  assert.ok(moodyNight.explanationText.length > 15);
});

test('Procedural interior 3D furniture builders and charbuddies.glb humanoid avatar asset', async () => {
  const fs = await import('node:fs');
  const {
    BUDDIES_FURNITURE_BUILDERS,
    buildOriginalBuddiesCatalogFurnitureMesh,
    buildBuddiesInteriorBackgroundZones,
  } = await import('./buddiesInteriorAssets');

  // 1. All 21 procedural 3D furniture builders produce non-empty merged Three.js Groups
  const builderKeys = Object.keys(BUDDIES_FURNITURE_BUILDERS);
  assert.equal(builderKeys.length, 21);
  for (const key of builderKeys) {
    const grp = BUDDIES_FURNITURE_BUILDERS[key]();
    assert.ok(grp.children.length > 0, `Procedural interior builder '${key}' has 3D meshes`);
  }

  // 2. Background zones (Dining Wr, Bedroom Ur, Study Vr, Back Wall Shelves xc) build cleanly
  const bgZones = buildBuddiesInteriorBackgroundZones();
  assert.ok(bgZones.children.length >= 20, 'Background zones contain all static room furniture');

  // 3. All 7 interactive catalog furniture items build from procedural interior builders
  for (const catId of [
    'tatami_tea_table',
    'sakura_bonsai_pot',
    'shoji_floor_lamp',
    'tactical_sofa_lounge',
    'arcade_blitz_cab',
    'nft_golden_katana_rack',
    'nft_holo_command_globe',
  ]) {
    const meshGrp = buildOriginalBuddiesCatalogFurnitureMesh(catId);
    assert.ok(meshGrp.children.length > 0, `Catalog item '${catId}' builds non-empty 3D group`);
  }

  // 4. Verify both Female (public/assets/charbuddies.glb, 15 meshes) & Male (public/assets/mancharacterbuddies.glb, 13 meshes) 3D human character GLBs have 20 animations & 65 Mixamo joints
  const glbStat = fs.statSync('public/assets/charbuddies.glb');
  assert.ok(glbStat.size > 5_000_000, 'charbuddies.glb (Female character) exists in public/assets/charbuddies.glb');
  const glbBuf = fs.readFileSync('public/assets/charbuddies.glb');
  assert.equal(glbBuf.toString('utf8', 0, 4), 'glTF');
  const glbJsonLen = glbBuf.readUInt32LE(12);
  const glbJson = JSON.parse(glbBuf.toString('utf8', 20, 20 + glbJsonLen));
  assert.equal(glbJson.meshes.length, 15, 'charbuddies.glb contains 15 female human character meshes');
  assert.equal(glbJson.skins[0].joints.length, 65, 'charbuddies.glb contains 65 Mixamo skeleton joints');
  assert.equal(glbJson.animations.length, 72, 'charbuddies.glb contains 72 animations across Female Basic, Rifle 8-Way, Pistol Locomotion Packs, Sitting.fbx, Fishing Pack, and Driving.fbx');
  const femAnimNames = new Set(glbJson.animations.map((a: { name: string }) => a.name));
  assert.ok(femAnimNames.has('sitting.001'), "charbuddies.glb has 'sitting.001' (Sitting.fbx)");
  assert.ok(femAnimNames.has('driving.001'), "charbuddies.glb has 'driving.001' (Driving.fbx)");

  const expectedFemaleBasicLocomotionFrames: Record<string, number> = {
    'idle.001': 251,
    'walk.001': 30,
    'run.001': 22,
    'unarmed_jump.001': 51,
    'unarmed_strafe_left.001': 21,
    'unarmed_strafe_right.001': 21,
    'unarmed_walk_strafe_left.001': 29,
    'unarmed_walk_strafe_right.001': 29,
    'unarmed_turn_left.001': 36,
    'unarmed_turn_right.001': 36,
  };
  for (const [clipName, expectedFrames] of Object.entries(expectedFemaleBasicLocomotionFrames)) {
    const animObj = glbJson.animations.find((a: { name: string }) => a.name === clipName);
    assert.ok(animObj, `charbuddies.glb contains Female Basic Locomotion clip '${clipName}'`);
    const timeAccessor = glbJson.accessors[animObj.samplers[0].input];
    assert.equal(
      timeAccessor.count,
      expectedFrames,
      `charbuddies.glb '${clipName}' has full 30 FPS keyframe count (${expectedFrames})`,
    );
  }

  const manGlbStat = fs.statSync('public/assets/mancharacterbuddies.glb');
  assert.ok(manGlbStat.size > 5_000_000, 'mancharacterbuddies.glb (Male character) exists in public/assets/mancharacterbuddies.glb');
  const manGlbBuf = fs.readFileSync('public/assets/mancharacterbuddies.glb');
  assert.equal(manGlbBuf.toString('utf8', 0, 4), 'glTF');
  const manGlbJsonLen = manGlbBuf.readUInt32LE(12);
  const manGlbJson = JSON.parse(manGlbBuf.toString('utf8', 20, 20 + manGlbJsonLen));
  assert.equal(manGlbJson.meshes.length, 13, 'mancharacterbuddies.glb contains 13 male human character meshes');
  assert.equal(manGlbJson.skins[0].joints.length, 65, 'mancharacterbuddies.glb contains 65 Mixamo skeleton joints');
  assert.equal(manGlbJson.animations.length, 72, 'mancharacterbuddies.glb contains 72 animations across Unarmed, Rifle 8-Way, Pistol Locomotion Packs, Sitting_(1).fbx, Fishing Pack, and Driving.fbx');

  const expectedMaleBasicLocomotionFrames: Record<string, number> = {
    'idle.001': 251,
    'walk.001': 32,
    'run.001': 22,
    'unarmed_jump.001': 66,
    'unarmed_strafe_left.001': 21,
    'unarmed_strafe_right.001': 21,
    'unarmed_walk_strafe_left.001': 32,
    'unarmed_walk_strafe_right.001': 32,
    'unarmed_turn_left.001': 29,
    'unarmed_turn_right.001': 29,
  };
  for (const [clipName, expectedFrames] of Object.entries(expectedMaleBasicLocomotionFrames)) {
    const animObj = manGlbJson.animations.find((a: { name: string }) => a.name === clipName);
    assert.ok(animObj, `mancharacterbuddies.glb contains Male Basic Locomotion clip '${clipName}'`);
    const timeAccessor = manGlbJson.accessors[animObj.samplers[0].input];
    assert.equal(
      timeAccessor.count,
      expectedFrames,
      `mancharacterbuddies.glb '${clipName}' has full 30 FPS keyframe count (${expectedFrames})`,
    );
  }

  const expectedPistolLocomotionFrames: Record<string, number> = {
    'pistol_idle.001': 41,
    'pistol_kneeling_idle.001': 115,
    'pistol_walk.001': 25,
    'pistol_walk_backward.001': 32,
    'pistol_walk_arc.001': 23,
    'pistol_walk_backward_arc.001': 19,
    'pistol_run.001': 16,
    'pistol_run_backward.001': 17,
    'pistol_run_arc.001': 19,
    'pistol_run_backward_arc.001': 16,
    'pistol_strafe_left.001': 18,
    'pistol_strafe_right.001': 19,
    'pistol_jump.001': 61,
  };
  for (const [clipName, expectedFrames] of Object.entries(expectedPistolLocomotionFrames)) {
    const femAnimObj = glbJson.animations.find((a: { name: string }) => a.name === clipName);
    assert.ok(femAnimObj, `charbuddies.glb contains Pistol Locomotion clip '${clipName}'`);
    assert.equal(
      glbJson.accessors[femAnimObj.samplers[0].input].count,
      expectedFrames,
      `charbuddies.glb '${clipName}' has full 30 FPS keyframe count (${expectedFrames})`,
    );
    const manAnimObj = manGlbJson.animations.find((a: { name: string }) => a.name === clipName);
    assert.ok(manAnimObj, `mancharacterbuddies.glb contains Pistol Locomotion clip '${clipName}'`);
    assert.equal(
      manGlbJson.accessors[manAnimObj.samplers[0].input].count,
      expectedFrames,
      `mancharacterbuddies.glb '${clipName}' has full 30 FPS keyframe count (${expectedFrames})`,
    );
  }

  const expectedRifleLocomotionFrames: Record<string, number> = {
    'rifle_idle.001': 64,
    'rifle_aiming_idle.001': 64,
    'rifle_idle_alt.001': 64,
    'rifle_crouch_aiming_idle.001': 64,
    'run_rifle.001': 16,
    'run_forward_left.001': 16,
    'run_forward_right.001': 16,
    'strafe.001': 16,
    'strafe_right.001': 16,
    'stepping_backward.001': 16,
    'run_backward_left.001': 16,
    'run_backward_right.001': 16,
    'sprint_forward.001': 16,
    'sprint_forward_left.001': 16,
    'sprint_forward_right.001': 16,
    'sprint_left.001': 16,
    'sprint_right.001': 16,
    'sprint_backward.001': 16,
    'sprint_backward_left.001': 16,
    'sprint_backward_right.001': 16,
    'stepping_forward.001': 31,
    'walk_forward_left.001': 31,
    'walk_forward_right.001': 31,
    'walk_left.001': 31,
    'strafing.001': 31,
    'walk_backward.001': 31,
    'walk_backward_left.001': 31,
    'walk_backward_right.001': 31,
    'crouch_walking.001': 31,
    'crouch_walk_left.001': 31,
    'crouch_walk_right.001': 31,
    'crouch_walk_backward.001': 31,
    'rifle_turn_left.001': 31,
    'rifle_turn.001': 31,
    'rifle_crouch_turn.001': 39,
    'rifle_crouch_turn_right.001': 39,
    'jump_up.001': 17,
    'fall.001': 31,
    'jumping_down.001': 21,
    'dying.001': 104,
    'death_from_right.001': 100,
    'death_from_back_headshot.001': 112,
  };
  for (const [clipName, expectedFrames] of Object.entries(expectedRifleLocomotionFrames)) {
    const femAnimObj = glbJson.animations.find((a: { name: string }) => a.name === clipName);
    assert.ok(femAnimObj, `charbuddies.glb contains Rifle 8-Way Locomotion clip '${clipName}'`);
    assert.equal(
      glbJson.accessors[femAnimObj.samplers[0].input].count,
      expectedFrames,
      `charbuddies.glb '${clipName}' has full 30 FPS keyframe count (${expectedFrames})`,
    );
    const manAnimObj = manGlbJson.animations.find((a: { name: string }) => a.name === clipName);
    assert.ok(manAnimObj, `mancharacterbuddies.glb contains Rifle 8-Way Locomotion clip '${clipName}'`);
    assert.equal(
      manGlbJson.accessors[manAnimObj.samplers[0].input].count,
      expectedFrames,
      `mancharacterbuddies.glb '${clipName}' has full 30 FPS keyframe count (${expectedFrames})`,
    );
  }

  const femDrivingAnim = glbJson.animations.find((a: { name: string }) => a.name === 'driving.001');
  const manDrivingAnim = manGlbJson.animations.find((a: { name: string }) => a.name === 'driving.001');
  assert.ok(femDrivingAnim, "charbuddies.glb contains 'driving.001' (Piloting.fbx)");
  assert.ok(manDrivingAnim, "mancharacterbuddies.glb contains 'driving.001' (Piloting.fbx)");
  assert.equal(
    glbJson.accessors[femDrivingAnim.samplers[0].input].count,
    292,
    "charbuddies.glb 'driving.001' has full 30 FPS Piloting.fbx keyframe count (292)",
  );
  assert.equal(
    manGlbJson.accessors[manDrivingAnim.samplers[0].input].count,
    292,
    "mancharacterbuddies.glb 'driving.001' has full 30 FPS Piloting.fbx keyframe count (292)",
  );

  const femBoxJogAnim = glbJson.animations.find((a: { name: string }) => a.name === 'jogging_with_box.001');
  const manBoxJogAnim = manGlbJson.animations.find((a: { name: string }) => a.name === 'jogging_with_box.001');
  assert.ok(femBoxJogAnim, "charbuddies.glb contains 'jogging_with_box.001' (Jogging_With_Box.fbx)");
  assert.ok(manBoxJogAnim, "mancharacterbuddies.glb contains 'jogging_with_box.001' (Jogging_With_Box.fbx)");
  assert.equal(
    glbJson.accessors[femBoxJogAnim.samplers[0].input].count,
    24,
    "charbuddies.glb 'jogging_with_box.001' has full 30 FPS Jogging_With_Box.fbx keyframe count (24)",
  );
  assert.equal(
    manGlbJson.accessors[manBoxJogAnim.samplers[0].input].count,
    24,
    "mancharacterbuddies.glb 'jogging_with_box.001' has full 30 FPS Jogging_With_Box.fbx keyframe count (24)",
  );

  const manAnimNames = new Set(manGlbJson.animations.map((a: { name: string }) => a.name));
  assert.equal(femAnimNames.has('wave_goodbye_01.001'), false, "old 'wave_goodbye_01.001' clip removed from charbuddies.glb");
  assert.equal(manAnimNames.has('wave_goodbye_01.001'), false, "old 'wave_goodbye_01.001' clip removed from mancharacterbuddies.glb");
  for (const requiredClip of [
    'idle.001',
    'walk.001',
    'run.001',
    'sitting.001',
    'driving.001',
    'jogging_with_box.001',
    'fishing_idle.001',
    'fishing_cast.001',
    'unarmed_jump.001',
    'unarmed_strafe_left.001',
    'unarmed_strafe_right.001',
    'unarmed_walk_strafe_left.001',
    'unarmed_walk_strafe_right.001',
    'unarmed_turn_left.001',
    'unarmed_turn_right.001',
    'rifle_idle.001',
    'rifle_aiming_idle.001',
    'run_rifle.001',
    'run_forward_left.001',
    'run_forward_right.001',
    'strafe.001',
    'strafe_right.001',
    'stepping_backward.001',
    'run_backward_left.001',
    'run_backward_right.001',
    'sprint_forward.001',
    'sprint_forward_left.001',
    'sprint_forward_right.001',
    'sprint_left.001',
    'sprint_right.001',
    'sprint_backward.001',
    'sprint_backward_left.001',
    'sprint_backward_right.001',
    'pistol_idle.001',
    'pistol_walk.001',
    'pistol_walk_backward.001',
    'pistol_run.001',
    'pistol_run_backward.001',
    'pistol_run_arc.001',
    'pistol_strafe_left.001',
    'pistol_strafe_right.001',
    'pistol_jump.001',
  ]) {
    assert.ok(femAnimNames.has(requiredClip), `charbuddies.glb has '${requiredClip}'`);
    assert.ok(manAnimNames.has(requiredClip), `mancharacterbuddies.glb has '${requiredClip}'`);
  }

  const { setDefaultCharacterGender, getDefaultCharacterGender } = await import(
    './buddiesBlitzShadersAndAssets'
  );
  assert.equal(getDefaultCharacterGender(), 'female');
  setDefaultCharacterGender('male');
  assert.equal(getDefaultCharacterGender(), 'male');
  setDefaultCharacterGender('female');
  assert.equal(getDefaultCharacterGender(), 'female');

  // 5. Verify consolidated bufferViews in both charbuddies.glb and mancharacterbuddies.glb (no redundant .fbx parsing)
  assert.ok(
    glbJson.bufferViews.length < 200,
    `charbuddies.glb animation bufferViews consolidated (${glbJson.bufferViews.length} < 200)`,
  );
  assert.ok(
    manGlbJson.bufferViews.length < 200,
    `mancharacterbuddies.glb animation bufferViews consolidated (${manGlbJson.bufferViews.length} < 200)`,
  );

  // 6. Verify public/assets/ar99-assault.glb binary structure (5 tripo_part meshes + 5 embedded textures, decimated to 8,804 triangles / 2.53 MB)
  const ar99Stat = fs.statSync('public/assets/ar99-assault.glb');
  assert.ok(
    ar99Stat.size > 2_000_000 && ar99Stat.size < 3_500_000,
    'ar99-assault.glb exists in public/assets/ar99-assault.glb with decimated low-poly size (~2.53 MB)',
  );
  const ar99Buf = fs.readFileSync('public/assets/ar99-assault.glb');
  assert.equal(ar99Buf.toString('utf8', 0, 4), 'glTF');
  const ar99JsonLen = ar99Buf.readUInt32LE(12);
  const ar99Json = JSON.parse(ar99Buf.toString('utf8', 20, 20 + ar99JsonLen));
  assert.equal(ar99Json.meshes.length, 5, 'ar99-assault.glb contains 5 modular weapon part meshes');
  assert.equal(ar99Json.textures.length, 5, 'ar99-assault.glb contains 5 embedded basecolor textures');
  assert.equal(ar99Json.materials.length, 5, 'ar99-assault.glb contains 5 materials');

  // 7. Verify stepBuddyJumpPhysicsWithBuffer launches immediately even when dt = 0 (key press event)
  const zeroDtJump = stepBuddyJumpPhysicsWithBuffer(0, 0, true, 0, true, 1.0, false, 0);
  assert.equal(zeroDtJump.justJumped, true, 'Jump press with dt=0 must set justJumped=true');
  assert.equal(zeroDtJump.isGrounded, false, 'Jump press with dt=0 must set isGrounded=false');
  assert.ok(zeroDtJump.vy > 9.0, 'Jump press with dt=0 must preserve positive launch velocity vy');
});

test('NearBlocks Explorer URL builders resolve testnet and mainnet URLs accurately', async () => {
  const { getNearBlocksAccountUrl, getNearBlocksTxUrl } = await import('./buddiesBlitzRules');

  assert.equal(
    getNearBlocksAccountUrl('market.buddiesblitz.testnet', 'testnet'),
    'https://testnet.nearblocks.io/address/market.buddiesblitz.testnet',
  );
  assert.equal(
    getNearBlocksAccountUrl('alice.near', 'mainnet'),
    'https://nearblocks.io/address/alice.near',
  );
  assert.equal(
    getNearBlocksTxUrl('txHash123', 'testnet'),
    'https://testnet.nearblocks.io/txns/txHash123',
  );
});

test('Halte-Ratio Batch Auto-Calibration synchronizes 3D scales and OBB colliders for Kiosks, Halte, Lobby, Beachfront, and Street Props', () => {
  const bluePlots = createIndividualCommanderBasesState('blue');
  const redPlots = createIndividualCommanderBasesState('red');
  const structures = buildStaticWorldStructuresList({
    blueBase: { baseGroup: new THREE.Group(), hqX: 0, hqZ: 74 },
    redBase: { baseGroup: new THREE.Group(), hqX: 0, hqZ: -74 },
    blueCommanderBases: bluePlots,
    redCommanderBases: redPlots,
  });
  const byId = new Map(structures.map((s) => [s.id, s]));

  // 1. All Kiosk colliders (5 Black Transit Kiosks and 8 White Base Plot Kiosks) match the compact Halte-calibrated Kiosk height (~2.55m)
  for (const kioskId of [
    'halte_teleport_kiosk',
    'north_residence_transit_kiosk',
    'south_residence_transit_kiosk',
    'beachfront_harbor_transit_kiosk',
    'nw_fishing_lake_transit_kiosk',
    'blue_plot_0_kiosk',
  ]) {
    const k = byId.get(kioskId);
    assert.ok(k, `Missing calibrated collider for ${kioskId}`);
    assert.equal(k.heightY, HALTE_GOLDEN_SCALE_CONFIG.kioskColliderHeightY);
    assert.ok(k.halfX <= 0.66 && k.halfZ <= 0.90, `${kioskId} footprint must match compact 1.40x scale`);
  }
  assert.equal(byId.has('west_plaza_near_terminal'), false, 'Legacy white Plaza terminal removed');
  assert.equal(byId.has('west_plaza_gold_exchange'), false, 'Legacy white Plaza gold kiosk removed');
  assert.equal(byId.has('west_wall_east_mid'), false, 'Central Plaza East staircase wall removed so players walk freely into The City');

  // 2. Halte canopy windbreak, ticket machine, and passenger bench colliders are present and calibrated
  assert.equal(byId.get('lobby_tram_shelter_windbreak')?.heightY, HALTE_GOLDEN_SCALE_CONFIG.halteCanopyClearanceM);
  assert.ok(byId.get('halte_ticket_machine'), 'Halte ticket machine collider must be registered');
  assert.ok(byId.get('halte_passenger_bench'), 'Halte passenger bench collider must be registered');

  // 3. Street & industrial props are calibrated to Halte-ratio heights and footprints
  assert.equal(getPropBaseHeight('bench'), 1.08);
  assert.equal(getPropBaseHeight('recycle_bin'), 1.22);
  assert.equal(getPropBaseHeight('hydrant'), 1.18);
  assert.equal(getPropBaseHeight('traffic_cone'), 0.86);
  assert.ok((getPropCollisionSpec('bench', 1.0).halfX ?? 99) < 0.85);
});

test('Zero Ghost Command Plot & House Door Triggers Across Central Plaza and Unclaimed Empty Grass Plots', async () => {
  const {
    evaluateBasePlotProximityTriggers,
    COMMANDER_PLOT_OFFSETS_X,
  } = await import('./buddiesBlitzRules');

  const blueBases = createIndividualCommanderBasesState('blue');
  const redBases = createIndividualCommanderBasesState('red');

  // 1. Inside Central Plaza (isPointInsideLobbySafezone === true): ZERO House Plot triggers and ZERO House Door triggers anywhere in the Plaza
  for (const [px, pz] of [
    [-85.5, 0],
    [-81.8, -2.4],
    [-81.8, -8.2],
    [-81.8, 12.6],
    [-93.2, -13.0],
  ] as const) {
    const lobbyRes = evaluateBasePlotProximityTriggers({
      actorX: px,
      actorZ: pz,
      worldMode: 'lobby',
      blueCommanderBases: blueBases,
      redCommanderBases: redBases,
    });
    assert.equal(
      lobbyRes.canTriggerBaseKiosk,
      false,
      `Central Plaza (${px}, ${pz}) must never trigger House Plot Kiosk`,
    );
    assert.equal(
      lobbyRes.canTriggerEnterHouseDoor,
      false,
      `Central Plaza (${px}, ${pz}) must never trigger Enter House door`,
    );
  }

  // 2. On the 7 unclaimed empty grass plots (Blue plots 1..3 and Red plots 0..3):
  //    Enter House door trigger is strictly FALSE even when standing directly at the house door coordinates
  for (let plotIdx = 1; plotIdx < 4; plotIdx++) {
    const plotX = COMMANDER_PLOT_OFFSETS_X[plotIdx];
    const doorZ = 74.0 + 1.85; // Blue front door Z
    const emptyBluePlot = evaluateBasePlotProximityTriggers({
      actorX: plotX,
      actorZ: doorZ,
      worldMode: 'safezone',
      blueCommanderBases: blueBases,
      redCommanderBases: redBases,
    });
    assert.equal(
      emptyBluePlot.canTriggerEnterHouseDoor,
      false,
      `Unclaimed Blue Plot #${plotIdx + 1} at (${plotX}, ${doorZ}) must never trigger Enter House door`,
    );
  }
  for (let plotIdx = 0; plotIdx < 4; plotIdx++) {
    const plotX = -COMMANDER_PLOT_OFFSETS_X[plotIdx];
    const doorZ = -86.0 - 1.85; // Red front door Z
    const emptyRedPlot = evaluateBasePlotProximityTriggers({
      actorX: plotX,
      actorZ: doorZ,
      worldMode: 'safezone',
      blueCommanderBases: blueBases,
      redCommanderBases: redBases,
    });
    assert.equal(
      emptyRedPlot.canTriggerEnterHouseDoor,
      false,
      `Unclaimed Red Plot #${plotIdx + 1} at (${plotX}, ${doorZ}) must never trigger Enter House door`,
    );
  }

  // 3. Only Blue Plot #1 (index 0, where the 3D House is actually built and visible) triggers Enter House within <= 3.5m in Safezone
  const builtHouseDoor = evaluateBasePlotProximityTriggers({
    actorX: COMMANDER_PLOT_OFFSETS_X[0],
    actorZ: 74.0 + 1.85,
    worldMode: 'safezone',
    blueCommanderBases: blueBases,
    redCommanderBases: redBases,
    houseVisibilityByPlot: { blue: [true, false, false, false] },
  });
  assert.equal(builtHouseDoor.canTriggerEnterHouseDoor, true);
  assert.equal(builtHouseDoor.nearestHouseDoorPlotIndex, 0);

  // When houseVisibilityByPlot is false, Enter House never triggers even on Plot #1
  const hiddenHouseDoor = evaluateBasePlotProximityTriggers({
    actorX: COMMANDER_PLOT_OFFSETS_X[0],
    actorZ: 74.0 + 1.85,
    worldMode: 'safezone',
    blueCommanderBases: blueBases,
    redCommanderBases: redBases,
    houseVisibilityByPlot: { blue: [false, false, false, false] },
  });
  assert.equal(hiddenHouseDoor.canTriggerEnterHouseDoor, false);

  // 4. Guest / unverified session never fabricates commander-p1.near or auto-verifies gamepass
  const guestSession = connectNearWalletAndMintGamepass(createInitialNearGamepassSessionState());
  assert.equal(guestSession.walletConnected, false);
  assert.equal(guestSession.walletId, null);
  assert.equal(guestSession.hasGamepassNft, false);
});

test('City Transit Kiosks, Rail-Aligned Halte Shelter Rules, and 3D Tram Ride Cutscene Transition', async () => {
  const {
    CITY_TRANSIT_DESTINATIONS,
    getCityTransitDestinationById,
    evaluateNearestCityTransitKioskProximity,
    evaluateTramRideTransitionStep,
  } = await import('./buddiesBlitzRules');

  // 1. Halte Shelters along the active tram rail loop (Central Plaza, Beachfront Harbor, North Residence, South Residence);
  //    standalone Black Kiosks ONLY (no shelter roof) at NW Fishing Lake and Warzone Arena
  const withShelter = CITY_TRANSIT_DESTINATIONS.filter((d) => d.hasHalteShelter).map((d) => d.id);
  const withoutShelter = CITY_TRANSIT_DESTINATIONS.filter((d) => !d.hasHalteShelter).map(
    (d) => d.id,
  );
  assert.deepEqual(withShelter, [
    'central_plaza',
    'beachfront_harbor',
    'north_residence',
    'south_residence',
  ]);
  assert.deepEqual(withoutShelter, ['nw_fishing_lake', 'warzone_arena']);

  const beachSpec = getCityTransitDestinationById('beachfront_harbor');
  assert.equal(beachSpec.shelterX, 77.5);
  assert.equal(beachSpec.shelterZ, 29.5);
  assert.equal(beachSpec.spawnX, 77.9);
  assert.equal(beachSpec.spawnZ, 29.5);

  const northSpec = getCityTransitDestinationById('north_residence');
  assert.equal(northSpec.shelterX, 6.5);
  assert.equal(northSpec.shelterZ, -46.8);
  assert.equal(northSpec.spawnX, 6.5);
  assert.equal(northSpec.spawnZ, -46.4);
  assert.equal(northSpec.kioskX, 6.5);
  assert.equal(northSpec.kioskZ, -44.95);

  // 2. Proximity evaluation detects each of the 5 City Transit Kiosks within <= 3.5m
  for (const stationId of [
    'central_plaza',
    'beachfront_harbor',
    'nw_fishing_lake',
    'north_residence',
    'south_residence',
  ] as const) {
    const spec = getCityTransitDestinationById(stationId);
    const prox = evaluateNearestCityTransitKioskProximity(
      spec.kioskX + 1.1,
      spec.kioskZ,
      'safezone',
      3.5,
    );
    assert.equal(prox.isNear, true, `Must detect ${stationId} kiosk within 3.5m`);
    assert.equal(prox.station?.id, stationId);
  }

  // 3. In Warzone mode, only the standalone Warzone exit kiosk (-60.55, 2.8) triggers
  const warzoneExitProx = evaluateNearestCityTransitKioskProximity(-60.55, 1.5, 'warzone', 3.5);
  assert.equal(warzoneExitProx.isNear, true);
  assert.equal(warzoneExitProx.station?.id, 'warzone_arena');

  // 4. 3D Tram Ride cutscene smoothly interpolates over 2.5s using easeInOutCubic
  const startStep = evaluateTramRideTransitionStep({
    elapsedSec: 0,
    durationSec: 2.5,
    originStationId: 'central_plaza',
    destinationStationId: 'beachfront_harbor',
  });
  assert.equal(startStep.progress01, 0);
  assert.equal(startStep.isComplete, false);

  const midStep = evaluateTramRideTransitionStep({
    elapsedSec: 1.25,
    durationSec: 2.5,
    originStationId: 'central_plaza',
    destinationStationId: 'beachfront_harbor',
  });
  assert.ok(midStep.progress01 > 0.45 && midStep.progress01 < 0.55);
  assert.equal(midStep.isComplete, false);

  const endStep = evaluateTramRideTransitionStep({
    elapsedSec: 2.5,
    durationSec: 2.5,
    originStationId: 'central_plaza',
    destinationStationId: 'beachfront_harbor',
  });
  assert.equal(endStep.progress01, 1);
  assert.equal(endStep.isComplete, true);
});

test('soundEngine browser AudioContext unlock + BGM scheduler executes with zero mutual recursion on UI clicks and mode switches', async () => {
  const g = globalThis as unknown as {
    window?: Record<string, unknown>;
    fetch?: typeof fetch;
  };
  const prevWindow = g.window;
  const prevFetch = g.fetch;

  const makeAudioParam = () => ({
    value: 0,
    setValueAtTime: () => {},
    linearRampToValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
    setTargetAtTime: () => {},
  });

  const makeMockNode = () => ({
    connect: () => {},
    disconnect: () => {},
    gain: makeAudioParam(),
    frequency: makeAudioParam(),
    Q: makeAudioParam(),
    threshold: makeAudioParam(),
    knee: makeAudioParam(),
    ratio: makeAudioParam(),
    attack: makeAudioParam(),
    release: makeAudioParam(),
    type: 'sine',
    buffer: null as unknown,
    loop: false,
    playbackRate: makeAudioParam(),
    onended: null as null | (() => void),
    start: () => {},
    stop: () => {},
  });

  class MockBrowserAudioContext {
    public state: 'running' | 'suspended' = 'running';
    public currentTime = 0.5;
    public sampleRate = 44100;
    public destination = makeMockNode();
    public resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    public createGain() {
      return makeMockNode();
    }
    public createBiquadFilter() {
      return makeMockNode();
    }
    public createDynamicsCompressor() {
      return makeMockNode();
    }
    public createOscillator() {
      return makeMockNode();
    }
    public createBufferSource() {
      return makeMockNode();
    }
    public createBuffer(_channels: number, length: number, sampleRate: number) {
      const ch = new Float32Array(length);
      return {
        duration: length / sampleRate,
        getChannelData: () => ch,
      };
    }
    public decodeAudioData() {
      return Promise.resolve({});
    }
  }

  try {
    g.fetch = (async () =>
      ({
        ok: false,
        arrayBuffer: async () => new ArrayBuffer(0),
      }) as Response) as typeof fetch;

    g.window = {
      AudioContext: MockBrowserAudioContext,
      addEventListener: () => {},
      removeEventListener: () => {},
    };

    // Previously threw RangeError: Maximum call stack size exceeded when bgmStarted === true!
    soundEngine.startBgm('city');
    soundEngine.playUiClick();
    soundEngine.setBgmMode('warzone');
    assert.equal(soundEngine.getBgmMode(), 'warzone');
    soundEngine.playUiClick();
    soundEngine.setBgmMode('city');
    assert.equal(soundEngine.getBgmMode(), 'city');
  } finally {
    soundEngine.stopBgm();
    if (prevWindow === undefined) {
      delete g.window;
    } else {
      g.window = prevWindow;
    }
    if (prevFetch === undefined) {
      delete g.fetch;
    } else {
      g.fetch = prevFetch;
    }
  }
});

test('Zero-WebGL-context fish perspective triangle rasterizer projects >800 lit, finite, depth-sorted triangles across all 10 species', async () => {
  const { FISH_SPECIES_CATALOG } = await import('./buddiesFishingMarket');
  const { buildShorelineProceduralFishGroup, projectFishGroupTriangles } = await import(
    '../components/ShorelineCatchShowcaseModal'
  );

  assert.equal(FISH_SPECIES_CATALOG.length, 10);
  for (const spec of FISH_SPECIES_CATALOG) {
    const model = buildShorelineProceduralFishGroup(spec.speciesId, spec.colorHex);
    model.updateSwimAnimation(0.45);
    model.group.rotation.y = 0.25;
    model.group.rotation.x = 0.04;

    const tris = projectFishGroupTriangles(model.group, 320, 180, 2.42, 23);
    assert.ok(
      tris.length > 800,
      `Expected >800 visible front/fin triangles for ${spec.speciesId}, got ${tris.length}`,
    );

    for (let i = 0; i < tris.length; i++) {
      const t = tris[i];
      assert.ok(
        Number.isFinite(t.sx0) &&
          Number.isFinite(t.sy0) &&
          Number.isFinite(t.sx1) &&
          Number.isFinite(t.sy1) &&
          Number.isFinite(t.sx2) &&
          Number.isFinite(t.sy2),
        `Projected coordinates must be finite for ${spec.speciesId}`,
      );
      assert.ok(t.r >= 0 && t.r <= 255 && t.g >= 0 && t.g <= 255 && t.b >= 0 && t.b <= 255);
      if (i > 0) {
        assert.ok(
          tris[i - 1].sortDepth >= t.sortDepth,
          'Triangles must be sorted back-to-front by sortDepth descending',
        );
      }
    }

    model.dispose();
  }
});

test('World multiplayer session ID isolates separate tabs/devices while persisting across City <-> Warzone remounts', async () => {
  const { getOrCreateTabMultiplayerSessionId, subscribeToWorldMultiplayer } = await import(
    '../lib/supabaseClient'
  );

  const g = globalThis as unknown as {
    window?: { sessionStorage?: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void } };
  };
  const prevWindow = g.window;

  const makeTabStorage = () => {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
    };
  };

  try {
    const tabAStorage = makeTabStorage();
    const tabBStorage = makeTabStorage();

    g.window = { sessionStorage: tabAStorage };
    const idA1 = getOrCreateTabMultiplayerSessionId();
    const idA2 = getOrCreateTabMultiplayerSessionId();
    assert.ok(idA1.startsWith('mp-'), 'Multiplayer session ID starts with mp-');
    assert.equal(idA1, idA2, 'Same tab keeps identical sessionId across remounts');

    g.window = { sessionStorage: tabBStorage };
    const idB1 = getOrCreateTabMultiplayerSessionId();
    assert.ok(idB1.startsWith('mp-'));
    assert.notEqual(idA1, idB1, 'Separate tab/device gets a distinct multiplayer sessionId');

    let receivedPeersCount = -1;
    const ctrl = subscribeToWorldMultiplayer({
      onPeersChange: (peers) => {
        receivedPeersCount = peers.length;
      },
    });
    assert.equal(ctrl.sessionId, idB1);
    assert.ok(receivedPeersCount === 0 || receivedPeersCount === -1);
    ctrl.publishLocalPose({
      nearAccountId: 'alice.testnet',
      displayName: 'ALICE',
      gender: 'female',
      team: 'blue',
      zoneKey: 'city',
      inWorld: true,
      x: -85.5,
      z: 0,
      vx: 0,
      vz: 0,
      yaw: 0,
      jumpOffset: 0,
      weaponId: 'unarmed',
      carryingCrate: 'none',
      isSitting: false,
      isDriving: false,
      isHiddenInVehicle: false,
      fishingPhase: 'idle',
      isReeling: false,
      rodBend: 0,
      hasClaimedBase: false,
      chatBubbleText: 'Hello!',
    });
    ctrl.unsubscribe();
  } finally {
    if (prevWindow === undefined) {
      delete g.window;
    } else {
      g.window = prevWindow;
    }
  }
});




