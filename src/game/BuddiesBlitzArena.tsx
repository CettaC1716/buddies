import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  BUDDIES_CONSTANTS,
  LIGHTING_PRESETS,
  LightingPresetKey,
  stepCriticalDampedSpring3D,
  stepTurretYaw,
  clamp,
  Vec3,
  CrateSlotType,
  evaluateStackingPadRecipe,
  chooseNextPadSlotIndex,
  BuildOrderTarget,
  BUILD_ORDER_SPECS,
  resolveCursorCommandTarget,
  BUDDY_CLASSES,
  BuddyClassId,
  TeamCommandMode,
  CollisionMaterialTag,
  getPropCollisionSpec,
  resolveSolidCollision2D,
  resolveSolidObbCollision2D,
  pointInObb2D,
  computePushableImpulse2D,
  shouldShatterBreakableProp,
  canTriggerCollisionCooldown,
  shouldPlayMoverCollisionSound,
  DUMP_TRUCK_MAX_CRATES,
  canLoadCrateIntoDumpTruck,
  evaluateDumpTruckHydraulicCycle,
  stepDumpTruckWheeledPhysics,
  UNIFIED_WORLD_CRATE_SIZE,
  JUMP_BUFFER_DURATION_SEC,
  stepBuddyJumpPhysics,
  stepBuddyJumpPhysicsWithBuffer,
  PLAYER_INVINCIBILITY_DURATION_SEC,
  PLAYER_SPAWN_BLINK_DURATION_SEC,
  stepPlayerInvincibilityState,
  applyPlayerDamageWithInvincibilityAndKnockback,
  evaluateBuddyMeleeStrike,
  MAX_CHARACTERS_PER_COMMANDER,
  COMMANDERS_PER_TEAM,
  canCommanderBuildCharacter,
  getNextOwnedBuddyForSwap,
  Matchmaking4v4State,
  createMatchmaking4v4State,
  hotJoinReplaceAiCommander,
  AStarNavGrid,
  evaluateBlitzHitReactionPose,
  evaluateBlitzStunEffectState,
  RAYCAST_LAYERS,
  RAYCAST_MAX_DISTANCE,
  RaycastCollider3D,
  MuzzleRaycastResult,
  castMuzzleRaycast3D,
  getWeaponProjectileVisualSpec,
  createFixedObjectPool,
  POOL_PEAK_CAPACITIES,
  resolveSolidCratePush2D,
  resolveCrateVsCrateCollision2D,
  CITY_TRAM_SPEC,
  BaseSkinThemeId,
  BaseGardenPresetId,
  BASE_SKIN_THEMES,
  BASE_GARDEN_PRESETS,
  IndividualCommanderBaseState,
  createIndividualCommanderBasesState,
  applyCommanderBaseUpgrade,
  canUnitBoardCityTramAtAnyPoint,
  computeCityTramDisembarkPosition,
  canUnitEnterCommanderBaseGate,
  BuddySecondaryItemId,
  BuddyMissionItemId,
  WorldCrateKind,
  TEAM_BUDDIES_WEAPON_DESPAWN_SEC,
  TEAM_BUDDIES_CRAFTED_WEAPON_DESPAWN_SEC,
  evaluateTeamBuddiesDeathDrops,
  evaluateDroppedItemDespawnState,
  evaluateCrateDestructionDrop,
  evaluateSplashDamageOnDroppedItem,
  computeStackingPadWeaponPopOutTrajectory,
  canUnitLootGroundWeapon,
  canBuddyUnitRespawnAtBase,
  KioskBuildPriorityRecipeId,
  KIOSK_BUILD_PRIORITY_RECIPES,
  getHologramSlotHexColor,
  chooseNextPadSlotIndexForHologram,
  evaluatePadHologramState,
  MAX_KIOSK_BUILD_QUEUE,
  enqueueKioskBuildRecipe,
  removeKioskBuildQueueAtIndex,
  advanceKioskBuildQueueOnCraft,
  isCrateInsideOtherOrEnemyBase,
  KioskSideHologramModelKind,
  evaluateKioskSideHologramDisplay,
  evaluatePadCancelKickShatterDrops,
  isUnitInPersonalCommandCenterArea,
  KioskBaseGoldUpgradeId,
  applyCommanderBaseGoldUpgrade,
  purchaseCrateAirdropWithGold,
  computeLandMineGrassYOffset,
  evaluateNuclearLauncherAccess,
  evaluateClusterBombAccess,
  NuclearStrikeSequenceState,
  createInitialNuclearStrikeState,
  beginNuclearStrikeTargeting,
  updateNuclearStrikeTargetCursor,
  confirmNuclearStrikeTargetAndLaunch,
  stepNuclearStrikeSequence,
  computeNuclearStrikeCameraPose,
  SUPPLY_DROP_LOCATIONS,
  SupplyDropScheduleState,
  createInitialSupplyDropScheduleState,
  stepSupplyDropSchedule,
  canDamageWorldCrate,
  evaluateSpecialMetallicCratePadBoost,
  formatBuddyRoleUiLabel,
  stepFollowerSmoothYaw,
  evaluateAutonomousFollowerEscortStep,
  evaluateBlitzTankShotRecoilPose,
  isTankClimbableProp,
  evaluateTankClimbableObstacleElevation,
  evaluateAiRangedCombatStandoffBehavior,
  MAX_HANDHELD_WEAPON_SLOTS,
  HandheldWeaponSlotId,
  TacticalSecondarySlotId,
  resolveHandheldWeaponSlotSpec,
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
  AI_TANK_BASE_DRIVE_SPEED,
  evaluateRoadSurfaceSpeedBoost,
  computeBuddyFootMoveSpeed,
  stepBlitzTankTrackedPhysics,
  computeSynchronizedWalkCycleStep,
  computeAiPathfindingMovementStep,
  shouldEmitRoadSpeedBoostParticles,
  LASER_BEAM_MAX_DISTANCE,
  LASER_CORE_RADIUS,
  LASER_OUTER_GLOW_RADIUS,
  LASER_DAMAGE_TICK_INTERVAL_SEC,
  LASER_DAMAGE_PER_TICK,
  LASER_AMMO_CONSUME_INTERVAL_SEC,
  computeContinuousLaserMuzzleTransform,
  evaluateContinuousLaserBeamStep,
  LOBBY_NEAR_TERMINAL_SPEC,
  LOBBY_TRAM_SHELTER_SPEC,
  LOBBY_SAFEZONE_BOUNDS,
  PUBLIC_WARZONE_CRATE_PADS,
  isCommanderBasePlotActive,
  isPointInsideLobbySafezone,
  getUnitFootRingTeamColor,
  pickRandomTeamShieldedCratePadSpawn,
  evaluateLobbyFactionPortalStep,
  isUnitNearLobbyTramReturnPad,
  canApplyCombatDamage,
  NearGamepassSessionState,
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
  LobbyGoldExchangeItemId,
  redeemLobbyGoldExchangeItem,
  evaluateOpenWarzonePopulationBar,
  PUBLIC_PAD_SHIELD_RADIUS,
  evaluatePublicPadShieldZone,
  isUnitWeaponTriggerLockedInSafeShield,
  resolveEnemyPublicPadShieldBarrier2D,
  computeTeamMirrorCameraPose,
  CityArenaMode,
  WorldMode,
  SafezonePlotAccessMode,
  setSafezonePlotAccessMode,
  addSafezonePlotFriend,
  removeSafezonePlotFriend,
  SAFEZONE_CITY_HALTE_SPAWN,
  evaluateCitySafezoneModeRules,
  findCityTramLeadDistanceNearHalte,
  evaluatePlayerGhostMovementGuard,
} from './buddiesBlitzRules';
import {
  evaluateOuterEmbankmentSdf,
  evaluateRoadNetworkSdf,
  evaluateNwLakeSdf,
  evaluateSeHarborSdf,
  evaluateBlitzGrassMask,
} from './buddiesPlanetCurvature';
import {
  soundEngine,
  computeSpatialAudioGain,
  computeBuildBoxAudioGain,
} from './audio';
import {
  loadAllRealBlitzAssets,
  createBlitzInfiniteGrassSystem,
  createTolanCurvedPlanetEnvironment,
  applyPlanetCurvatureToObject,
  computePlanetYOffset,
  getTerrainElevation,
  wrapPlanetCoord,
  getPlanetShortestDelta,
  getPlanetShortestDistance,
  PLANET_CURVATURE_STRENGTH,
  resetTerrainSculptGrid,
  serializeTerrainSculptGrid,
  populateRealBlitzTreeFromGlb,
  populateRealBlitzTankFromGlb,
  populateRealBlitzDumpTruckFromGlb,
  stepBlitzDumpTruckAnimation,
  syncBlitzDumpTruckCargoVisuals,
  populateRealBlitzCrateBoxFromGlb,
  buildProceduralBlitzPlane,
  stepBlitzPlaneAnimation,
  buildProceduralRobloxBuddyAvatar,
  upgradeBuddyRigWithCharBuddiesGlb,
  CharacterGender,
  setDefaultCharacterGender,
  getDefaultCharacterGender,
  populateAr99AssaultFromGlb,
  updateCharacterWeaponStance,
  RobloxBuddyRig,
  BlitzWeaponId,
  stepBlitzTankTracks,
  spawnRealBlitzPropFromGlb,
  stepRealBlitzPropsAnimation,
  getBlitzDefaultLightDirection,
  LoadedBlitzAssets,
  BlitzWindUniforms,
  createBlitzExplosionSystem,
  createBlitzStunEffectMesh,
  buildMilitaryBaseMasterplan,
  syncMilitaryBasePlotsVisuals,
  stepMilitaryBaseMasterplanAnimation,
  populateMilitaryBaseGardenTreesFromGlb,
  getSharedFallbackFoliageMaskTexture,
  buildProceduralSkyshieldTurret,
  getBaseSkyshieldTurrets,
  SkyshieldTurretController,
  buildRealBlitzBulletTemplates,
  Blitz3dBulletTemplates,
  createProceduralCityTramConsist,
  bakeStaticGroupMeshes,
  buildCraftedWeaponPickupMesh,
  buildTeamBuddiesDropPickupMesh,
  buildSelfServiceTacticalKioskMesh,
  buildProceduralNuclearMissileMesh,
  buildProceduralNuclearLauncherTurret,
  NuclearLauncherTurretRig,
} from './buddiesBlitzShadersAndAssets';
import {
  buildOriginalBuddiesCatalogFurnitureMesh,
  buildBuddiesInteriorBackgroundZones,
  BUDDIES_SLOT_MATERIALS,
} from './buddiesInteriorAssets';
import {
  CUTAWAY_ROOM_BOUNDS,
  PlacedHouseFurnitureItem,
  HOUSE_SURFACE_SWATCHES,
  buildFurnitureFootprintObbs,
  solveFurnitureFreePlacement,
  createPlacedHouseFurnitureItem,
  createInitialPlacedHouseFurniture,
  stepFurnitureSpringWobblePhysics,
  evaluateRoomDaylightState,
} from './buddiesMerchantPricing';
import {
  GameState,
  PlayMode,
  PlacedMapProp,
  ArenaMapLayout,
  RadarDot,
  FloatingWorldPrompt,
  HudSnapshot,
  BuddiesBlitzArenaProps,
  WorldCrate,
  WorldPickup,
  DestructibleTree,
  ActiveMapPropPhysics,
  DebrisChunk3D,
  TankVehicle,
  BuddyUnit,
  Projectile,
  ExplosionParticle,
  ActiveLaserBeam3D,
  ActiveOrdnanceDevice3D,
  StaticWorldStructureObb,
  COMMAND_CYCLE,
  BLUE_BUDDY_ROTATION,
} from './buddiesBlitzTypes';
import {
  evaluatePlayerCommandCenterRadarAndMinimapDots,
  applyGrassChunkSyncedFogOfWar3D,
  evaluateChunkSynced3DFogOfWar,
} from './buddiesBlitzMinimap';
import {
  buildArenaNavGrids,
  computeUnitAStarSteeringDirection,
  evaluateSquadAiUnitPerceptionAndDecision,
  getCommanderDefendStationCoords,
} from './buddiesBlitzSquadAi';
import {
  createGroundLockAuraTexture,
  createHudLockReticleTexture,
  computePlayerMuzzleAndAimDirection,
  buildArenaRaycastColliders,
} from './buddiesBlitzCombat';
import {
  MAP_STORAGE_KEY,
  buildTeamBaseQuadrant,
  DEFAULT_ARENA_MAP_LAYOUT,
  cloneDefaultLayout,
  loadSavedArenaLayout,
  getPropBaseHeight,
  createBillboardSign,
  createGlassmorphicNameplate,
  buildStaticWorldStructuresList,
} from './buddiesBlitzWorldBuilder';

export type {
  GameState,
  PlayMode,
  PlacedMapProp,
  ArenaMapLayout,
  RadarDot,
  FloatingWorldPrompt,
  HudSnapshot,
  BuddiesBlitzArenaProps,
};
export {
  MAP_STORAGE_KEY,
  buildTeamBaseQuadrant,
  DEFAULT_ARENA_MAP_LAYOUT,
};

export const BuddiesBlitzArena: React.FC<BuddiesBlitzArenaProps> = ({
  gameState,
  playMode,
  worldMode = 'warzone',
  initialTeam = 'blue',
  deployedFromLobby = false,
  onRequestWorldModeChange,
  lightingPreset,
  cameraFovMode,
  resetTrigger,
  onHudUpdate,
  onGameOver,
  onTogglePause,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const gameStateRef = useRef<GameState>(gameState);
  const playModeRef = useRef<PlayMode>(playMode);
  const worldModeRef = useRef<WorldMode>(worldMode);
  const initialTeamRef = useRef<'blue' | 'red'>(initialTeam);
  const deployedFromLobbyRef = useRef<boolean>(deployedFromLobby);
  const onRequestWorldModeChangeRef = useRef(onRequestWorldModeChange);
  const lightingPresetRef = useRef<LightingPresetKey>(lightingPreset);
  const cameraFovModeRef = useRef<'webgl35' | 'roblox18'>(cameraFovMode);

  useEffect(() => {
    worldModeRef.current = worldMode;
  }, [worldMode]);

  useEffect(() => {
    initialTeamRef.current = initialTeam;
  }, [initialTeam]);

  useEffect(() => {
    deployedFromLobbyRef.current = deployedFromLobby;
  }, [deployedFromLobby]);

  useEffect(() => {
    onRequestWorldModeChangeRef.current = onRequestWorldModeChange;
  }, [onRequestWorldModeChange]);

  const applyLightingRef = useRef<((preset: LightingPresetKey) => void) | null>(null);
  const applyFovModeRef = useRef<((mode: 'webgl35' | 'roblox18') => void) | null>(null);
  const applyPlayModeRef = useRef<((mode: PlayMode) => void) | null>(null);
  const resetArenaRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    playModeRef.current = playMode;
    if (applyPlayModeRef.current) {
      applyPlayModeRef.current(playMode);
    }
  }, [playMode]);

  useEffect(() => {
    lightingPresetRef.current = lightingPreset;
    if (applyLightingRef.current) {
      applyLightingRef.current(lightingPreset);
    }
  }, [lightingPreset]);

  useEffect(() => {
    cameraFovModeRef.current = cameraFovMode;
    if (applyFovModeRef.current) {
      applyFovModeRef.current(cameraFovMode);
    }
  }, [cameraFovMode]);

  useEffect(() => {
    if (resetTrigger > 0 && resetArenaRef.current) {
      resetArenaRef.current();
    }
  }, [resetTrigger]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Renderer & Software-WebGL Adaptation
    const isSoftwareGl = (() => {
      const probeGl = document.createElement('canvas').getContext('webgl2');
      if (!probeGl) return true;
      const ext = probeGl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probeGl.RENDERER;
      const gpu = String(probeGl.getParameter(param) || '');
      probeGl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render|Mesa OffScreen/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    // Enable real-time shadow maps on hardware GPUs; skip shadow pass on CPU software WebGL
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = !isSoftwareGl;

    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Direct 60 FPS DOM Overlay for Contextual Floating Prompts (Static Anchor, No Bobbing, No Jitter, Zero React Re-render)
    const promptOverlay = document.createElement('div');
    promptOverlay.setAttribute('aria-label', 'Contextual 3D Floating Prompts Direct DOM');
    promptOverlay.style.position = 'fixed';
    promptOverlay.style.inset = '0';
    promptOverlay.style.pointerEvents = 'none';
    promptOverlay.style.zIndex = '25';
    promptOverlay.style.overflow = 'hidden';
    container.appendChild(promptOverlay);

    const createPromptButton = (htmlContent: string, title: string, actionDetail?: string) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.tabIndex = -1;
      btn.title = title;
      btn.setAttribute('aria-label', title);
      btn.style.position = 'absolute';
      btn.style.left = '0px';
      btn.style.top = '0px';
      btn.style.margin = '0';
      btn.style.padding = '0';
      btn.style.border = 'none';
      btn.style.background = 'transparent';
      btn.style.outline = 'none';
      btn.style.cursor = 'pointer';
      btn.style.pointerEvents = 'auto';
      btn.style.userSelect = 'none';
      btn.style.display = 'none';
      btn.style.willChange = 'transform';
      btn.style.transition = 'none';
      btn.innerHTML = htmlContent;
      if (actionDetail) {
        btn.onpointerdown = (e) => {
          e.stopPropagation();
          resetAllPlayerMovementInputs();
        };
        btn.onclick = (e) => {
          e.stopPropagation();
          resetAllPlayerMovementInputs();
          window.dispatchEvent(new CustomEvent('buddy-action', { detail: actionDetail }));
        };
      }
      promptOverlay.appendChild(btn);
      return btn;
    };

    const POLYGON_ICON_HTML = `<svg viewBox="0 0 64 64" style="width:24px; height:24px; filter:drop-shadow(0 1.5px 3px rgba(0,0,0,0.35)); display:block; pointer-events:none;" aria-hidden="true"><polygon points="15,10 46,5 60,22 60,48 45,60 18,57 5,40" fill="#ffffff" /><polygon points="18,14 45,9 57,24 57,46 44,56 20,53 9,39" fill="#14161d" /><polygon points="22,20 44,16 54,27 54,44 43,53 22,50 14,38" fill="#ffffff" /><circle cx="34.5" cy="34.5" r="7.5" fill="#14161d" /></svg>`;
    const HAND_ICON_HTML = `<span style="display:inline-flex; align-items:center; justify-content:center; padding:2px 6px; background:#facc15; color:#14161d; font-family:'Barlow',sans-serif; font-weight:900; font-size:10px; border:2px solid #14161d; box-shadow:2px 2px 0 #14161d; user-select:none; pointer-events:none;">E</span>`;

    const kioskPromptBtn = createPromptButton(POLYGON_ICON_HTML, 'KIOSK [B]');
    kioskPromptBtn.onpointerdown = (e) => {
      e.stopPropagation();
      resetAllPlayerMovementInputs();
    };
    kioskPromptBtn.onclick = (e) => {
      e.stopPropagation();
      resetAllPlayerMovementInputs();
      soundEngine.playUiClick();
      emitHudImmediately();
      window.dispatchEvent(new CustomEvent('toggle-kiosk-ui'));
    };
    const cratePromptBtn = createPromptButton(HAND_ICON_HTML, 'GRAB [E]', 'pickupOrThrow');
    const padCraftPromptBtn = createPromptButton(POLYGON_ICON_HTML, 'KICK CANCEL [F]', 'kickOrCraft');
    const padDepositPromptBtn = createPromptButton(HAND_ICON_HTML, 'LOAD PAD [E]', 'pickupOrThrow');
    const LOBBY_TRAM_BTN_HTML = `<span style="display:inline-flex; align-items:center; justify-content:center; padding:7px 18px; background:#facc15; color:#000000; font-family:'Barlow',sans-serif; font-weight:900; font-size:12px; letter-spacing:0.06em; text-transform:uppercase; border:2px solid #000000; box-shadow:3px 3px 0 #000000; transform:skewX(-6deg); user-select:none; pointer-events:none;"><span style="display:inline-block; transform:skewX(6deg);">TO LOBBY</span></span>`;
    const lobbyTramPromptBtn = createPromptButton(LOBBY_TRAM_BTN_HTML, 'TO LOBBY', 'teleportToLobby');
    lobbyTramPromptBtn.setAttribute('data-lobby-tram-floating-btn', 'true');

    const LOBBY_RED_PORTAL_BTN_HTML = `<span style="display:inline-flex; align-items:center; justify-content:center; padding:7px 18px; background:#ff3b30; color:#ffffff; font-family:'Barlow',sans-serif; font-weight:900; font-size:12px; letter-spacing:0.06em; text-transform:uppercase; border:2px solid #000000; box-shadow:3px 3px 0 #000000; transform:skewX(-6deg); user-select:none; pointer-events:none;"><span style="display:inline-block; transform:skewX(6deg);">RED TEAM</span></span>`;
    const lobbyRedPortalPromptBtn = createPromptButton(
      LOBBY_RED_PORTAL_BTN_HTML,
      'RED TEAM',
      'confirmLobbyPortalRed',
    );
    lobbyRedPortalPromptBtn.setAttribute('data-lobby-portal-floating-btn', 'red');

    const LOBBY_BLUE_PORTAL_BTN_HTML = `<span style="display:inline-flex; align-items:center; justify-content:center; padding:7px 18px; background:#00a8ff; color:#ffffff; font-family:'Barlow',sans-serif; font-weight:900; font-size:12px; letter-spacing:0.06em; text-transform:uppercase; border:2px solid #000000; box-shadow:3px 3px 0 #000000; transform:skewX(-6deg); user-select:none; pointer-events:none;"><span style="display:inline-block; transform:skewX(6deg);">BLUE TEAM</span></span>`;
    const lobbyBluePortalPromptBtn = createPromptButton(
      LOBBY_BLUE_PORTAL_BTN_HTML,
      'BLUE TEAM',
      'confirmLobbyPortalBlue',
    );
    lobbyBluePortalPromptBtn.setAttribute('data-lobby-portal-floating-btn', 'blue');

    const LOBBY_ENTER_CITY_BTN_HTML = `<span style="display:inline-flex; align-items:center; justify-content:center; padding:7px 18px; background:#10b981; color:#000000; font-family:'Barlow',sans-serif; font-weight:900; font-size:12px; letter-spacing:0.06em; text-transform:uppercase; border:2px solid #000000; box-shadow:3px 3px 0 #000000; transform:skewX(-6deg); user-select:none; pointer-events:none;"><span style="display:inline-block; transform:skewX(6deg);">ENTER CITY</span></span>`;
    const lobbyEnterCityPromptBtn = createPromptButton(
      LOBBY_ENTER_CITY_BTN_HTML,
      'ENTER CITY',
      'confirmLobbyEnterSafezoneCity',
    );
    lobbyEnterCityPromptBtn.setAttribute('data-lobby-portal-floating-btn', 'enter-city');

    const RIDE_TRAM_BTN_HTML = `<span style="display:inline-flex; align-items:center; justify-content:center; padding:5px 14px; background:#facc15; color:#0f172a; font-family:'Barlow',sans-serif; font-weight:900; font-size:12px; letter-spacing:0.06em; text-transform:uppercase; border:3px solid #14161d; box-shadow:3px 3px 0 #14161d, 0 0 14px rgba(250,204,21,0.75); transform:skewX(-12deg); user-select:none; pointer-events:none;"><span style="display:inline-block; transform:skewX(12deg);">RIDE</span></span>`;
    const rideTramPromptBtn = createPromptButton(
      RIDE_TRAM_BTN_HTML,
      'RIDE',
      'rideCityTram',
    );
    rideTramPromptBtn.setAttribute('data-ride-tram-floating-btn', 'true');

    const EXIT_TRAM_BTN_HTML = `<span style="display:inline-flex; align-items:center; justify-content:center; padding:5px 14px; background:#f97316; color:#ffffff; font-family:'Barlow',sans-serif; font-weight:900; font-size:12px; letter-spacing:0.06em; text-transform:uppercase; border:3px solid #14161d; box-shadow:3px 3px 0 #14161d, 0 0 14px rgba(249,115,22,0.75); transform:skewX(-12deg); user-select:none; pointer-events:none;"><span style="display:inline-block; transform:skewX(12deg);">EXIT</span></span>`;
    const exitTramPromptBtn = createPromptButton(
      EXIT_TRAM_BTN_HTML,
      'EXIT',
      'exitCityTram',
    );
    exitTramPromptBtn.setAttribute('data-exit-tram-floating-btn', 'true');

    const NPC_MERCHANT_BTN_HTML = `<span style="display:inline-flex; align-items:center; justify-content:center; padding:5px 14px; background:#b8ff3c; color:#0f172a; font-family:'Barlow',sans-serif; font-weight:900; font-size:12px; letter-spacing:0.06em; text-transform:uppercase; border:3px solid #14161d; box-shadow:3px 3px 0 #14161d, 0 0 14px rgba(184,255,60,0.75); transform:skewX(-12deg); user-select:none; pointer-events:none;"><span style="display:inline-block; transform:skewX(12deg);">TALK</span></span>`;
    const npcMerchantPromptBtn = createPromptButton(
      NPC_MERCHANT_BTN_HTML,
      'TALK',
      'talkToNearestNpcMerchant',
    );
    npcMerchantPromptBtn.setAttribute('data-npc-merchant-floating-btn', 'true');

    const ENTER_HOUSE_BTN_HTML = `<span style="display:inline-flex; align-items:center; justify-content:center; padding:5px 14px; background:#2bb3b1; color:#0f172a; font-family:'Barlow',sans-serif; font-weight:900; font-size:12px; letter-spacing:0.06em; text-transform:uppercase; border:3px solid #14161d; box-shadow:3px 3px 0 #14161d, 0 0 14px rgba(43,179,177,0.75); transform:skewX(-12deg); user-select:none; pointer-events:none;"><span style="display:inline-block; transform:skewX(12deg);">ENTER HOUSE [E]</span></span>`;
    const enterHousePromptBtn = createPromptButton(
      ENTER_HOUSE_BTN_HTML,
      'ENTER HOUSE [E]',
      'enterPrivateHouseInterior',
    );
    enterHousePromptBtn.setAttribute('data-enter-house-floating-btn', 'true');

    // Green Holographic Ground Selection Ring for Clicked Character (#22c55e)
    const characterSelectionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.70, 0.96, 36),
      new THREE.MeshBasicMaterial({
        color: 0x22c55e,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    );
    characterSelectionRing.rotation.x = -Math.PI / 2;
    characterSelectionRing.position.y = 0.04;
    characterSelectionRing.visible = false;

    let selectedCharacterTarget: {
      id: string | number;
      name: string;
      isNpc: boolean;
      team: 'blue' | 'red';
      status: string;
      root: THREE.Object3D;
      nameplate?: { sprite: THREE.Sprite } | null;
      isSelf?: boolean;
    } | null = null;

    const clearCharacterSelection = () => {
      if (selectedCharacterTarget?.nameplate?.sprite) {
        selectedCharacterTarget.nameplate.sprite.visible = false;
      }
      if (playerUnit?.nameplate?.sprite) {
        playerUnit.nameplate.sprite.visible = false;
      }
      for (let bi = 0; bi < buddyUnits.length; bi++) {
        const np = buddyUnits[bi].nameplate;
        if (np?.sprite) {
          np.sprite.visible = false;
        }
      }
      if (lobbyCafeNpc?.npcNameplate?.sprite) {
        lobbyCafeNpc.npcNameplate.sprite.visible = false;
      }
      if (beachHouseNpc?.npcNameplate?.sprite) {
        beachHouseNpc.npcNameplate.sprite.visible = false;
      }

      selectedCharacterTarget = null;
      characterSelectionRing.visible = false;
      if (playerUnit) syncUnitFootRingTeamColor(playerUnit);
      buddyUnits.forEach((b) => syncUnitFootRingTeamColor(b));
    };

    let activeClickedTeleportKiosk: 'none' | 'lobby_warzone' | 'lobby_safezone' | 'halte_to_lobby' = 'none';
    let currentNearTeleportKiosk: 'none' | 'lobby_warzone' | 'lobby_safezone' | 'halte_to_lobby' = 'none';

    const teleportKioskHexBtn = createPromptButton(POLYGON_ICON_HTML, 'KIOSK TELEPORT');
    teleportKioskHexBtn.setAttribute('data-teleport-kiosk-hex-btn', 'true');
    teleportKioskHexBtn.onpointerdown = (e) => {
      e.stopPropagation();
      resetAllPlayerMovementInputs();
    };
    teleportKioskHexBtn.onclick = (e) => {
      e.stopPropagation();
      resetAllPlayerMovementInputs();
      const targetKind =
        currentNearTeleportKiosk !== 'none' ? currentNearTeleportKiosk : activeClickedTeleportKiosk;
      if (targetKind !== 'none') {
        soundEngine.playUiClick();
        activeClickedTeleportKiosk = targetKind;
        syncTeleportKiosksGreenFootRing(targetKind);
        clearCharacterSelection();
        window.dispatchEvent(
          new CustomEvent('open-teleport-kiosk-modal', { detail: { kind: targetKind } }),
        );
      }
    };

    const syncTeleportKiosksGreenFootRing = (
      activeKind: 'none' | 'lobby_warzone' | 'lobby_safezone' | 'halte_to_lobby',
    ) => {
      const wzKiosk = scene.getObjectByName('LobbyWarzoneTeleportKiosk3D');
      const szKiosk = scene.getObjectByName('LobbySafezoneTeleportKiosk3D');
      const halteKiosk = scene.getObjectByName('HalteLobbyTeleportKiosk3D');

      if (wzKiosk?.userData?.greenFootRing) {
        (wzKiosk.userData.greenFootRing as THREE.Mesh).visible = activeKind === 'lobby_warzone';
      }
      if (szKiosk?.userData?.greenFootRing) {
        (szKiosk.userData.greenFootRing as THREE.Mesh).visible = activeKind === 'lobby_safezone';
      }
      if (halteKiosk?.userData?.greenFootRing) {
        (halteKiosk.userData.greenFootRing as THREE.Mesh).visible = activeKind === 'halte_to_lobby';
      }
    };

    const clearTeleportKioskSelection = () => {
      activeClickedTeleportKiosk = 'none';
      syncTeleportKiosksGreenFootRing('none');
      teleportKioskHexBtn.style.display = 'none';
      lobbyRedPortalPromptBtn.style.display = 'none';
      lobbyBluePortalPromptBtn.style.display = 'none';
      lobbyEnterCityPromptBtn.style.display = 'none';
      lobbyTramPromptBtn.style.display = 'none';
      window.dispatchEvent(new CustomEvent('close-teleport-kiosk-modal'));
    };

    const onCloseTeleportKioskUi = () => {
      activeClickedTeleportKiosk = 'none';
      syncTeleportKiosksGreenFootRing('none');
      lobbyRedPortalPromptBtn.style.display = 'none';
      lobbyBluePortalPromptBtn.style.display = 'none';
      lobbyEnterCityPromptBtn.style.display = 'none';
      lobbyTramPromptBtn.style.display = 'none';
    };
    window.addEventListener('close-teleport-kiosk-ui', onCloseTeleportKioskUi);

    const onWindowClearCharacterSelection = () => {
      clearCharacterSelection();
    };
    window.addEventListener('clear-character-selection', onWindowClearCharacterSelection);

    // =========================================================================
    // LOBBY BENCH & SEAT SPOTS + FLOATING 3D DISC INDICATORS & 3RD-PERSON SITTING CAMERA
    // =========================================================================
    interface LobbySeatSpot {
      id: string;
      x: number;
      z: number;
      yaw: number;
      seatLiftY: number;
      indicatorHeightY: number;
    }

    const LOBBY_SEAT_SPOTS: readonly LobbySeatSpot[] = [
      // 6 Integrated Concrete Planter Benches around the Lobby Plaza
      { id: 'lobby_bench_en', x: -82.54, z: -24.5, yaw: Math.PI, seatLiftY: -0.05, indicatorHeightY: 1.08 },
      { id: 'lobby_bench_es', x: -82.54, z: 24.8, yaw: Math.PI, seatLiftY: -0.05, indicatorHeightY: 1.08 },
      { id: 'lobby_bench_wn', x: -98.26, z: -24.5, yaw: 0, seatLiftY: -0.05, indicatorHeightY: 1.08 },
      { id: 'lobby_bench_ws', x: -98.26, z: 24.8, yaw: 0, seatLiftY: -0.05, indicatorHeightY: 1.08 },
      { id: 'lobby_bench_n', x: -90.5, z: -31.24, yaw: -Math.PI / 2, seatLiftY: -0.05, indicatorHeightY: 1.08 },
      { id: 'lobby_bench_s', x: -90.5, z: 31.24, yaw: Math.PI / 2, seatLiftY: -0.05, indicatorHeightY: 1.08 },
      // 3 Café Counter Bar Stools
      { id: 'lobby_stool_1', x: -95.16, z: -11.25, yaw: 0, seatLiftY: 0.12, indicatorHeightY: 1.32 },
      { id: 'lobby_stool_2', x: -95.16, z: -12.38, yaw: 0, seatLiftY: 0.12, indicatorHeightY: 1.32 },
      { id: 'lobby_stool_3', x: -95.16, z: -13.50, yaw: 0, seatLiftY: 0.12, indicatorHeightY: 1.32 },
      // Pergola Bench
      { id: 'lobby_pergola_seat', x: -100.1, z: 12.1, yaw: 0, seatLiftY: -0.04, indicatorHeightY: 1.08 },
    ];

    let activeSeatedSpot: LobbySeatSpot | null = null;
    let currentNearestLobbySeat: LobbySeatSpot | null = null;
    let seatedCameraYaw = -Math.PI / 2 + 0.35;
    let seatedCameraPitch = 0.22;
    let seatedCameraDist = 4.2;
    let isOrbitingSeatedCamera = false;
    let seatedOrbitDragStart = { x: 0, y: 0, yaw: 0, pitch: 0.22 };

    const SEAT_DISC_GREEN_HTML = `<span style="display:inline-flex; align-items:center; justify-content:center; width:40px; height:40px; border-radius:50%; background:linear-gradient(145deg, #4ade80 0%, #16a34a 100%); border:3.5px solid #ffffff; box-shadow:3px 2px 0 #dcfce7, 0 5px 14px rgba(0,0,0,0.45); transform:perspective(110px) rotateY(-18deg) rotateX(8deg); pointer-events:none; user-select:none;"><span style="width:16px; height:16px; border-radius:50%; border:2.5px solid rgba(255,255,255,0.92); background:#15803d;"></span></span>`;
    const SEAT_DISC_BLUE_HTML = `<span style="display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:50%; background:linear-gradient(145deg, #38bdf8 0%, #0284c7 100%); border:3px solid #ffffff; box-shadow:2.5px 2px 0 #e0f2fe, 0 4px 10px rgba(0,0,0,0.38); transform:perspective(110px) rotateY(-14deg) rotateX(6deg); pointer-events:none; user-select:none;"><span style="width:13px; height:13px; border-radius:50%; border:2px solid rgba(255,255,255,0.9); background:#0369a1;"></span></span>`;

    const CHAIR_SVG_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><path d="M7 4v9h10"/><path d="M7 13v7"/><path d="M17 13v7"/><path d="M7 16h10"/></svg>`;
    const getSitBarHtml = (label: string) =>
      `<span style="display:inline-flex; align-items:center; height:42px; min-width:210px; background:rgba(38,32,28,0.82); backdrop-filter:blur(8px); border:1.5px solid rgba(255,255,255,0.75); border-radius:22px; padding:0 14px 0 4px; box-shadow:0 6px 18px rgba(0,0,0,0.45); color:#ffffff; font-family:'Barlow',sans-serif; font-weight:700; font-size:15px; letter-spacing:0.03em; pointer-events:none; user-select:none;"><span style="display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:50%; background:rgba(255,255,255,0.14); border:1.5px solid rgba(255,255,255,0.85); margin-right:12px;">${CHAIR_SVG_ICON}</span><span style="flex:1; text-align:center;">${label}</span><span style="margin-left:12px; font-weight:900; font-size:16px; opacity:0.9;">&gt;</span></span>`;

    const sitOnLobbySeat = (spot: LobbySeatSpot) => {
      if (!playerUnit || !playerUnit.alive) return;
      if (mountedTank) handleToggleMountTank();
      if (ridingTramCarIdx !== null) disembarkFromCityTram();
      soundEngine.playUiClick();
      resetAllPlayerMovementInputs();
      clearTeleportKioskSelection();
      activeSeatedSpot = spot;
      playerUnit.x = spot.x;
      playerUnit.z = spot.z;
      playerUnit.vx = 0;
      playerUnit.vz = 0;
      playerUnit.yaw = spot.yaw;
      playerUnit.isSitting = true;
      playerUnit.isDriving = false;
      // Set 3rd-person perspective camera facing the seated character from the open plaza diagonal
      seatedCameraYaw = spot.yaw + Math.PI / 2 + 0.36;
      seatedCameraPitch = 0.22;
      seatedCameraDist = 4.2;
      updateCharacterWeaponStance(
        playerUnit.rig,
        playerUnit.weaponId,
        playerUnit.walkCycle,
        false,
        playerUnit.carryingCrate !== 'none',
        0,
        0,
        0,
        'right',
        0,
        0,
        0.76,
        0,
        true,
        'front',
        1,
        playerUnit.yaw,
        0,
        true,
        false,
      );
      emitHudImmediately();
    };

    const standUpFromLobbySeat = () => {
      if (!playerUnit) return;
      if (activeSeatedSpot) {
        playerUnit.x = wrapPlanetCoord(activeSeatedSpot.x + Math.cos(activeSeatedSpot.yaw) * 0.88);
        playerUnit.z = wrapPlanetCoord(activeSeatedSpot.z - Math.sin(activeSeatedSpot.yaw) * 0.88);
      }
      activeSeatedSpot = null;
      isOrbitingSeatedCamera = false;
      playerUnit.isSitting = false;
      soundEngine.playUiClick();
      emitHudImmediately();
    };

    const seatIndicatorBtns: { btn: HTMLButtonElement; state: 'none' | 'blue' | 'green' }[] =
      LOBBY_SEAT_SPOTS.map((spot) => {
        const btn = createPromptButton(SEAT_DISC_BLUE_HTML, 'Sit on Chair');
        btn.setAttribute('data-seat-indicator-id', spot.id);
        btn.onpointerdown = (e) => {
          e.stopPropagation();
          resetAllPlayerMovementInputs();
        };
        btn.onclick = (e) => {
          e.stopPropagation();
          sitOnLobbySeat(spot);
        };
        return { btn, state: 'blue' };
      });

    const bottomSitActionBtn = createPromptButton(getSitBarHtml('Sit'), 'Sit');
    bottomSitActionBtn.setAttribute('data-bottom-sit-action-btn', 'true');
    bottomSitActionBtn.onpointerdown = (e) => {
      e.stopPropagation();
      resetAllPlayerMovementInputs();
    };
    bottomSitActionBtn.onclick = (e) => {
      e.stopPropagation();
      if (playerUnit?.isSitting && activeSeatedSpot) {
        standUpFromLobbySeat();
      } else if (currentNearestLobbySeat) {
        sitOnLobbySeat(currentNearestLobbySeat);
      }
    };

    const onSelectTeleportKioskEvent = (e: Event) => {
      const customEv = e as CustomEvent<{ kind: 'lobby_warzone' | 'lobby_safezone' | 'halte_to_lobby' }>;
      const k = customEv.detail?.kind;
      if (k) {
        soundEngine.playUiClick();
        activeClickedTeleportKiosk = k;
        syncTeleportKiosksGreenFootRing(k);
        clearCharacterSelection();
        window.dispatchEvent(new CustomEvent('open-teleport-kiosk-modal', { detail: { kind: k } }));
      }
    };
    window.addEventListener('select-teleport-kiosk', onSelectTeleportKioskEvent);

    // Listen for select-character-by-id event to synchronize 3D selection ring and nameplate from React HUD
    const onSelectCharacterById = (e: Event) => {
      const customEv = e as CustomEvent<{ id: string | number }>;
      const targetId = customEv.detail?.id;
      if (targetId === undefined || targetId === null) return;
      let found: typeof selectedCharacterTarget = null;
      if (targetId === playerUnit.id) {
        found = {
          id: playerUnit.id,
          name: 'YOU',
          isNpc: false,
          team: playerUnit.team,
          status: 'Your Profile (Self)',
          root: playerUnit.root,
          nameplate: playerUnit.nameplate,
          isSelf: true,
        };
      } else if (targetId === 'npc_cafe' || targetId === 'npc_hana') {
        if (lobbyCafeNpc) {
          found = {
            id: 'npc_cafe',
            name: 'HANA (BARISTA)',
            isNpc: true,
            team: 'blue',
            status: 'Barista & Exchange Agent NPC',
            root: lobbyCafeNpc.npcGrp,
            nameplate: lobbyCafeNpc.npcNameplate,
            isSelf: false,
          };
        }
      } else if (targetId === 'npc_beach' || targetId === 'npc_kai') {
        if (beachHouseNpc) {
          found = {
            id: 'npc_beach',
            name: 'KAI (BEACH MERCHANT)',
            isNpc: true,
            team: 'blue',
            status: 'Beach House Merchant NPC',
            root: beachHouseNpc.npcGrp,
            nameplate: beachHouseNpc.npcNameplate,
            isSelf: false,
          };
        }
      } else {
        const u = buddyUnits.find((b) => String(b.id) === String(targetId) && b.alive);
        if (u) {
          found = {
            id: u.id,
            name: u.isPlayer ? 'YOU' : `BUDDY #${u.id}`,
            isNpc: false,
            team: u.team,
            status: u.carryingCrate !== 'none' ? 'Carrying Crate' : u.weaponName || 'Chilling',
            root: u.root,
            nameplate: u.nameplate,
            isSelf: false,
          };
        }
      }
      if (found) {
        clearCharacterSelection();
        selectedCharacterTarget = found;
        if (found.nameplate?.sprite) {
          found.nameplate.sprite.visible = true;
        }
        const groundElev = getTerrainElevation(found.root.position.x, found.root.position.z);
        characterSelectionRing.position.set(found.root.position.x, groundElev + 0.04, found.root.position.z);
        characterSelectionRing.visible = true;
      }
    };
    window.addEventListener('select-character-by-id', onSelectCharacterById);

    const socialSpeechBubbleEl = document.createElement('div');
    socialSpeechBubbleEl.setAttribute('data-social-speech-bubble', 'true');
    socialSpeechBubbleEl.style.position = 'absolute';
    socialSpeechBubbleEl.style.left = '0px';
    socialSpeechBubbleEl.style.top = '0px';
    socialSpeechBubbleEl.style.display = 'none';
    socialSpeechBubbleEl.style.pointerEvents = 'none';
    socialSpeechBubbleEl.style.userSelect = 'none';
    socialSpeechBubbleEl.style.padding = '5px 12px';
    socialSpeechBubbleEl.style.background = '#ffffff';
    socialSpeechBubbleEl.style.color = '#0f172a';
    socialSpeechBubbleEl.style.fontFamily = "'Barlow', sans-serif";
    socialSpeechBubbleEl.style.fontWeight = '800';
    socialSpeechBubbleEl.style.fontSize = '12px';
    socialSpeechBubbleEl.style.borderRadius = '12px';
    socialSpeechBubbleEl.style.border = '2.5px solid #14161d';
    socialSpeechBubbleEl.style.boxShadow = '2.5px 2.5px 0 #14161d';
    socialSpeechBubbleEl.style.maxWidth = '220px';
    socialSpeechBubbleEl.style.textAlign = 'center';
    socialSpeechBubbleEl.style.whiteSpace = 'nowrap';
    promptOverlay.appendChild(socialSpeechBubbleEl);

    const onUpdateSocialBubbleStyle = (ev: Event) => {
      const detail = (ev as CustomEvent<{ bgColor?: string; textColor?: string }>).detail;
      if (detail?.bgColor) {
        socialSpeechBubbleEl.style.background = detail.bgColor;
      }
      if (detail?.textColor) {
        socialSpeechBubbleEl.style.color = detail.textColor;
      }
    };
    window.addEventListener('update-social-bubble-style', onUpdateSocialBubbleStyle);

    let isKioskPromptActive = false;
    let activeCratePromptId: number | null = null;
    let isPadCraftPromptActive = false;
    let isPadDepositPromptActive = false;
    let isKioskModalOpenCanvas = false;
    let resetAllPlayerMovementInputs: () => void = () => {};

    const onKioskUiToggled = () => {
      isKioskModalOpenCanvas = !isKioskModalOpenCanvas;
      resetAllPlayerMovementInputs();
    };
    const onKioskUiClosed = () => {
      isKioskModalOpenCanvas = false;
      resetAllPlayerMovementInputs();
    };
    const onKioskUiSynced = (ev: Event) => {
      const customEv = ev as CustomEvent<{ isOpen?: boolean }>;
      const nextOpen = Boolean(customEv.detail?.isOpen);
      if (isKioskModalOpenCanvas !== nextOpen) {
        isKioskModalOpenCanvas = nextOpen;
        resetAllPlayerMovementInputs();
      }
    };
    window.addEventListener('toggle-kiosk-ui', onKioskUiToggled);
    window.addEventListener('close-kiosk-ui', onKioskUiClosed);
    window.addEventListener('sync-kiosk-ui', onKioskUiSynced);
    let updateDirectDomPrompts: () => void = () => {};

    // 2. Scene, Camera & Authentic Buddies Blitz Warm Afternoon Sun Lighting
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#8cdcf0');
    scene.add(characterSelectionRing);

    const camera = new THREE.PerspectiveCamera(
      BUDDIES_CONSTANTS.camera.fov,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      BUDDIES_CONSTANTS.camera.near,
      BUDDIES_CONSTANTS.camera.far,
    );

    const hemiLight = new THREE.HemisphereLight('#fffdf0', '#3d7068', 1.2);
    scene.add(hemiLight);

    // Bundled Blitz Sun Spherical Angles: phi = 0.63, theta = 0.72, radius = 50 -> warm afternoon light (#ffe6b1)
    const blitzSunOffset = getBlitzDefaultLightDirection().multiplyScalar(52);
    const dirLight = new THREE.DirectionalLight('#ffe6b1', 2.05);
    dirLight.position.copy(blitzSunOffset);
    dirLight.castShadow = true;
    const shadowMapRes = 1024;
    dirLight.shadow.mapSize.set(shadowMapRes, shadowMapRes);
    const d = 54;
    dirLight.shadow.camera.near = 2;
    dirLight.shadow.camera.far = 160;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0004;
    scene.add(dirLight);
    scene.add(dirLight.target);

    const applyLightingPreset = (presetKey: LightingPresetKey) => {
      if (presetKey === 'day') {
        dirLight.color.set('#ffe6b1');
        dirLight.intensity = 2.05;
        hemiLight.color.set('#fffdf0');
        hemiLight.groundColor.set('#3d7068');
        scene.background = new THREE.Color('#8cdcf0');
        if (scene.fog instanceof THREE.FogExp2) {
          scene.fog.color.set('#8cdcf0');
          scene.fog.density = 0.0011;
        }
        return;
      }
      const p = LIGHTING_PRESETS[presetKey] || LIGHTING_PRESETS.day;
      dirLight.color.set(p.lightColor);
      dirLight.intensity = p.lightIntensity;
      hemiLight.groundColor.set(p.shadowColor);
      hemiLight.color.set(p.revealColor);
      const bgCol = new THREE.Color(p.shadowColor).lerp(new THREE.Color(p.fogColorA), 0.35);
      scene.background = bgCol;
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(bgCol);
      }
    };
    applyLightingRef.current = applyLightingPreset;
    applyLightingPreset(lightingPresetRef.current);

    const applyFovMode = (mode: 'webgl35' | 'roblox18') => {
      camera.fov = mode === 'roblox18' ? BUDDIES_CONSTANTS.camera.robloxPseudoOrthoFov : BUDDIES_CONSTANTS.camera.fov;
      camera.updateProjectionMatrix();
    };
    applyFovModeRef.current = applyFovMode;

    // 3. Cel-Shaded Materials & Hard Black Ink Outlines (#17110f)
    const toonSteps = new Uint8Array([105, 200, 255]);
    const toonGradientMap = new THREE.DataTexture(toonSteps, 3, 1, THREE.RedFormat);
    toonGradientMap.minFilter = THREE.NearestFilter;
    toonGradientMap.magFilter = THREE.NearestFilter;
    toonGradientMap.needsUpdate = true;

    const makeToonMat = (hex: number | string) =>
      new THREE.MeshToonMaterial({
        color: hex,
        gradientMap: toonGradientMap,
      });

    const inkOutlineMat = new THREE.MeshBasicMaterial({
      color: 0x12121e,
      side: THREE.BackSide,
    });
    const flashWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const frozenIceMat = makeToonMat(0x80e5ff);

    const matRedCrate = makeToonMat('#ff3b30');
    const matSuperCrate = makeToonMat('#00d2ff');
    const matLegendCrate = makeToonMat('#ffd700');
    const matSilverMetallicCrate = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.92,
      roughness: 0.14,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.18,
    });
    const matGoldMetallicCrate = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.94,
      roughness: 0.12,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.24,
    });
    const getCrateFallbackMaterial = (kind: WorldCrateKind): THREE.Material =>
      kind === 'medical'
        ? matWhite
        : kind === 'gold_metallic'
          ? matGoldMetallicCrate
          : kind === 'silver_metallic'
            ? matSilverMetallicCrate
            : kind === 'legend'
              ? matLegendCrate
              : kind === 'super'
                ? matSuperCrate
                : matRedCrate;
    const matBlueTeam = makeToonMat('#2979ff');
    const matRedTeam = makeToonMat('#ff3b30');
    const matTankHighlight = makeToonMat('#b8ff3c');
    const matYellow = makeToonMat('#ffbe18');
    const matDarkSteel = makeToonMat('#222533');
    const matWhite = makeToonMat('#faf7f5');
    const matSkin = makeToonMat('#ffd19a');

    const addOutlinedPart = (
      parent: THREE.Object3D,
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      pos: [number, number, number],
      rot: [number, number, number] = [0, 0, 0],
      outlineScale = 1.08,
      castShadow = true,
    ): THREE.Mesh => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.rotation.set(rot[0], rot[1], rot[2]);
      mesh.frustumCulled = true;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      mesh.userData.baseMaterial = mat;

      const outline = new THREE.Mesh(geo, inkOutlineMat);
      outline.scale.setScalar(outlineScale);
      outline.frustumCulled = true;
      mesh.add(outline);

      parent.add(mesh);
      return mesh;
    };

    const shadowDiscGeo = new THREE.CircleGeometry(1.1, 18);
    shadowDiscGeo.rotateX(-Math.PI / 2);
    const shadowDiscMat = new THREE.MeshBasicMaterial({
      color: 0x12121e,
      transparent: true,
      opacity: 0.0,
      visible: false,
      depthWrite: false,
    });

    // =========================================================================
    // 4. TOLAN'S WORLD CURVED PLANET ENVIRONMENT, PONDS, FLORA & SKY SUNBEAMS
    // =========================================================================
    const windUniforms: BlitzWindUniforms = {
      uTime: { value: 0 },
      uWindPhase: { value: 0 },
      uWindDirection: { value: new THREE.Vector2(0.7071, 0.7071) },
      uWindStrength: { value: 0.32 },
      uWindGust: { value: 0.0 },
      uLightDirection: { value: getBlitzDefaultLightDirection() },
      uLightColor: { value: new THREE.Color('#fff4c8') },
      uShadowColor: { value: new THREE.Color('#3b6e52') },
      uPlanetPivot: { value: new THREE.Vector3(0, 0, 12.5) },
      uCurvatureStrength: { value: PLANET_CURVATURE_STRENGTH },
    };

    const tolanPlanetEnv = createTolanCurvedPlanetEnvironment(scene, windUniforms, isSoftwareGl);

    // 4A. Modern Urban Street Tram (100% Low-Floor LRV — 1 Rangkaian 2 Gerbong) circulating the road network
    const cityTram = createProceduralCityTramConsist(scene, windUniforms, isSoftwareGl);
    let cityTramDistance = 328.0; // Starts entering the South Collector Road curve right in front of Blue Base!
    cityTram.update(cityTramDistance, 0, 0, 0, 0);

    // Drop Zone Circles removed ("oh ya drop box itu random di area warzone hapus saja lingkaran dropzone itu")
    const buildDropZonePad = (x: number, z: number, _colorMat: THREE.Material) => {
      const g = new THREE.Group();
      g.position.set(x, 0.06, z);
      g.visible = false;
      return g;
    };
    const centerDropZoneGroup = buildDropZonePad(0, 0, matRedCrate);
    const westSuperDropZoneGroup = buildDropZonePad(-53.5, 0.0, matSuperCrate);
    const eastSuperDropZoneGroup = buildDropZonePad(60.0, 0.0, matSuperCrate);

    // 4A-2. Dynamic Supply Drop Ground Beacon Ring (Central Oasis & Harbor Dock)
    const supplyDropBeaconGroup = new THREE.Group();
    const supplyBeaconOuterRingGeo = new THREE.RingGeometry(3.4, 4.1, 36);
    supplyBeaconOuterRingGeo.rotateX(-Math.PI / 2);
    const supplyBeaconOuterRingMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const supplyBeaconOuterRing = new THREE.Mesh(supplyBeaconOuterRingGeo, supplyBeaconOuterRingMat);
    supplyDropBeaconGroup.add(supplyBeaconOuterRing);

    const supplyBeaconInnerDiscGeo = new THREE.RingGeometry(1.1, 1.55, 28);
    supplyBeaconInnerDiscGeo.rotateX(-Math.PI / 2);
    const supplyBeaconInnerDiscMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const supplyBeaconInnerRing = new THREE.Mesh(supplyBeaconInnerDiscGeo, supplyBeaconInnerDiscMat);
    supplyDropBeaconGroup.add(supplyBeaconInnerRing);

    const supplyBeaconBeamGeo = new THREE.CylinderGeometry(0.32, 1.25, 16.0, 16, 1, true);
    const supplyBeaconBeamMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const supplyBeaconBeam = new THREE.Mesh(supplyBeaconBeamGeo, supplyBeaconBeamMat);
    supplyBeaconBeam.position.y = 8.0;
    supplyDropBeaconGroup.add(supplyBeaconBeam);
    supplyDropBeaconGroup.visible = false;
    scene.add(supplyDropBeaconGroup);

    // =========================================================================
    // 4B. CURVED PLANET INFINITE GRASS + FLOATING DANDELION SEEDS SHADER
    // =========================================================================
    const blitzGrassSystem = createBlitzInfiniteGrassSystem(scene, windUniforms, isSoftwareGl);
    let loadedBlitzAssets: LoadedBlitzAssets | null = null;
    const realPropsGroup = new THREE.Group();
    realPropsGroup.name = 'RealBlitzFactoryProps';
    scene.add(realPropsGroup);

    // 3D Map Editor Placement Cursor Ring on Ground
    const editorCursorGroup = new THREE.Group();
    editorCursorGroup.name = 'MapEditorCursor';
    editorCursorGroup.visible = playModeRef.current === 'editor';
    const cursorOuterRing = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 1.85, 28),
      new THREE.MeshBasicMaterial({ color: 0xb4ff39, side: THREE.DoubleSide }),
    );
    cursorOuterRing.rotation.x = -Math.PI / 2;
    cursorOuterRing.position.y = 0.12;
    editorCursorGroup.add(cursorOuterRing);

    const cursorDirArrow = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.18, 1.9),
      new THREE.MeshBasicMaterial({ color: 0x00d2ff }),
    );
    cursorDirArrow.position.set(0, 0.16, 0.95);
    editorCursorGroup.add(cursorDirArrow);
    scene.add(editorCursorGroup);

    // =========================================================================
    // 5. TWO 1:1 SYMMETRIC 4-PLOT BASE COMPLEXES (BLUE SOUTH vs RED NORTH)
    //    + COMPACT 4-COLUMN (2x2) STACKING PAD IN EACH INDIVIDUAL BASE PLOT
    // =========================================================================
    const buildSingleStackingPadMesh = (
      team: 'blue' | 'red',
      padX: number,
      padZ: number,
      commanderIdx: number,
    ) => {
      const isModelEstate = team === 'blue' && commanderIdx === 0;
      const teamMat = team === 'blue' ? matBlueTeam : matRedTeam;
      const baseYaw = team === 'blue' ? 0 : Math.PI;
      const padGroup = new THREE.Group();
      padGroup.position.set(padX, 0.04, padZ);
      padGroup.rotation.y = baseYaw;
      padGroup.visible = true;
      scene.add(padGroup);

      // Compact 4.2m x 4.2m 4-Column (2x2) Stacking Pad — visible when plot is Model Estate or Claimed via NEAR Gamepass
      const padStaticGroup = new THREE.Group();
      padStaticGroup.visible = isModelEstate;
      const tileOffsets: [number, number][] = [
        [-0.95, -0.95],
        [0.95, -0.95],
        [-0.95, 0.95],
        [0.95, 0.95],
      ];
      padGroup.add(padStaticGroup);
      addOutlinedPart(padStaticGroup, new THREE.BoxGeometry(4.2, 0.18, 4.2), matDarkSteel, [0, 0.09, 0], [0, 0, 0], 1.05, false);

      tileOffsets.forEach(([tx, tz]) => {
        const tile = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 1.7), teamMat);
        tile.position.set(tx, 0.24, tz);
        padStaticGroup.add(tile);
        const arrow = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.85), matWhite);
        arrow.position.set(tx, 0.28, tz);
        padStaticGroup.add(arrow);
      });

      bakeStaticGroupMeshes(padStaticGroup);

      // Self-Service Tactical Kiosk placed on ALL 8 Base Plots (1 Model Estate + 7 Empty Grass Plots) at identical local coordinates!
      const kioskMesh = buildSelfServiceTacticalKioskMesh(windUniforms, isSoftwareGl);
      kioskMesh.position.set(1.22, 0.0, -6.48);
      kioskMesh.rotation.y = -Math.PI / 2;
      kioskMesh.visible = true;
      padGroup.add(kioskMesh);
      padGroup.updateMatrixWorld(true);

      const mergedCage = new THREE.Mesh(
        new THREE.BoxGeometry(3.85, 2.95, 3.85),
        new THREE.MeshBasicMaterial({ color: 0xb4ff39, wireframe: true, transparent: true, opacity: 0.7 }),
      );
      mergedCage.position.set(0, 1.65, 0);
      mergedCage.visible = false;
      padGroup.add(mergedCage);

      const ghostPatternBox = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({
          color: 0x00d2ff,
          wireframe: true,
          transparent: true,
          opacity: 0.85,
        }),
      );
      ghostPatternBox.visible = isModelEstate;
      padGroup.add(ghostPatternBox);

      const slotMeshes: THREE.Group[] = [];
      const ghostSlotMeshes: THREE.Mesh[] = [];
      const slotGeo = new THREE.BoxGeometry(
        UNIFIED_WORLD_CRATE_SIZE,
        UNIFIED_WORLD_CRATE_SIZE,
        UNIFIED_WORLD_CRATE_SIZE,
      );
      const ghostSlotGeo = new THREE.BoxGeometry(
        UNIFIED_WORLD_CRATE_SIZE,
        UNIFIED_WORLD_CRATE_SIZE,
        UNIFIED_WORLD_CRATE_SIZE,
      );
      const ghostCoreGeo = new THREE.BoxGeometry(
        UNIFIED_WORLD_CRATE_SIZE - 0.08,
        UNIFIED_WORLD_CRATE_SIZE - 0.08,
        UNIFIED_WORLD_CRATE_SIZE - 0.08,
      );

      for (let i = 0; i < 8; i++) {
        const layer = i < 4 ? 0 : 1;
        const [tx, tz] = tileOffsets[i % 4];
        const slotY = 0.93 + layer * UNIFIED_WORLD_CRATE_SIZE;
        const slotGrp = new THREE.Group();
        slotGrp.position.set(tx, slotY, tz);
        slotGrp.visible = false;
        addOutlinedPart(slotGrp, slotGeo, matRedCrate, [0, 0, 0], [0, 0, 0], 1.07, true);
        populateRealBlitzCrateBoxFromGlb(
          slotGrp,
          'red',
          loadedBlitzAssets,
          windUniforms,
          isSoftwareGl,
          UNIFIED_WORLD_CRATE_SIZE,
        );
        padGroup.add(slotGrp);
        slotMeshes.push(slotGrp);

        const slotWireMat = new THREE.MeshBasicMaterial({
          color: 0xff4d3d,
          wireframe: true,
          transparent: true,
          opacity: 0.88,
        });
        const slotCoreMat = new THREE.MeshBasicMaterial({
          color: 0xff4d3d,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
        });
        const gm = new THREE.Mesh(ghostSlotGeo, slotWireMat);
        gm.position.set(tx, slotY, tz);
        gm.visible = false;
        const coreMesh = new THREE.Mesh(ghostCoreGeo, slotCoreMat);
        gm.add(coreMesh);
        gm.userData.coreMat = slotCoreMat;
        padGroup.add(gm);
        ghostSlotMeshes.push(gm);
      }

      const padSign = createBillboardSign(5.4, 1.35);
      padSign.sprite.position.set(0, 4.5, 0);
      padSign.sprite.visible = false;

      const kioskHoloSign = createBillboardSign(3.6, 0.98);
      kioskHoloSign.sprite.position.set(-0.65, 4.35, 0.28);
      kioskHoloSign.sprite.visible = false;

      return {
        commanderIdx,
        padGroup,
        padStaticGroup,
        kioskMesh,
        kioskHoloSign,
        padX,
        padZ,
        worldX: padX,
        worldZ: padZ,
        slotMeshes,
        ghostSlotMeshes,
        ghostPatternBox,
        mergedCage,
        padSign,
      };
    };

    const buildBaseHqAndPad = (team: 'blue' | 'red', hqX: number, hqZ: number, _padX: number, _padZ: number) => {
      const sign = team === 'blue' ? 1 : -1;
      const baseYaw = team === 'blue' ? Math.PI / 2 : -Math.PI / 2;
      const baseGroup = new THREE.Group();
      baseGroup.position.set(hqX, 0, hqZ);
      baseGroup.rotation.y = baseYaw;
      scene.add(baseGroup);

      buildMilitaryBaseMasterplan(baseGroup, team, windUniforms, isSoftwareGl);

      const hpSign = createBillboardSign(5.5, 1.35);
      hpSign.sprite.position.set(-1.8, 8.8, -1.2);
      hpSign.sprite.visible = false;

      // Build 4 Compact 2x2 Stacking Pads (Pad P1..P4) flush against the right fence (relZ = +7.3) of the 4 Individual Base Plots at x = sign * [-37.7, -7.7, +22.3, +52.3], z = sign * 77.8
      const padOffsetsX = [-37.7, -7.7, 22.3, 52.3];
      const commanderPads = padOffsetsX.map((ox, idx) =>
        buildSingleStackingPadMesh(team, hqX + sign * ox, hqZ - sign * 8.2, idx),
      );
      const primaryPad = commanderPads[0];

      return {
        baseGroup,
        hpSign,
        commanderPads,
        padGroup: primaryPad.padGroup,
        kioskMesh: primaryPad.kioskMesh,
        hqX,
        hqZ,
        padX: primaryPad.padX,
        padZ: primaryPad.padZ,
        slotMeshes: primaryPad.slotMeshes,
        ghostSlotMeshes: primaryPad.ghostSlotMeshes,
        ghostPatternBox: primaryPad.ghostPatternBox,
        mergedCage: primaryPad.mergedCage,
        padSign: primaryPad.padSign,
      };
    };

    const blueBase = buildBaseHqAndPad('blue', 0.0, 86.0, -37.7, 77.8);
    const redBase = buildBaseHqAndPad('red', 0.0, -86.0, 37.7, -77.8);

    // 5B. 8 SHIELDED PUBLIC WARZONE CRATE PADS (4 BLUE SOUTH + 4 RED NORTH ON GRASS ISLAND CORNERS, TANPA KIOSK)
    const buildPublicWarzoneCratePadMesh = (spec: (typeof PUBLIC_WARZONE_CRATE_PADS)[number]) => {
      const teamMat = spec.teamBias === 'blue' ? matBlueTeam : matRedTeam;
      const shieldColorHex = spec.teamBias === 'blue' ? 0x38bdf8 : 0xff453a;
      const shieldRadius = spec.shieldRadius ?? PUBLIC_PAD_SHIELD_RADIUS;
      const padGroup = new THREE.Group();
      padGroup.position.set(spec.x, 0.04, spec.z);
      scene.add(padGroup);

      const padStaticGroup = new THREE.Group();
      padGroup.add(padStaticGroup);
      addOutlinedPart(
        padStaticGroup,
        new THREE.BoxGeometry(4.2, 0.18, 4.2),
        matDarkSteel,
        [0, 0.09, 0],
        [0, 0, 0],
        1.05,
        false,
      );
      const tileOffsets: [number, number][] = [
        [-0.95, -0.95],
        [0.95, -0.95],
        [-0.95, 0.95],
        [0.95, 0.95],
      ];
      tileOffsets.forEach(([tx, tz]) => {
        const tile = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 1.7), teamMat);
        tile.position.set(tx, 0.24, tz);
        padStaticGroup.add(tile);
        const arrow = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.85), matWhite);
        arrow.position.set(tx, 0.28, tz);
        padStaticGroup.add(arrow);
      });
      bakeStaticGroupMeshes(padStaticGroup);

      // Safe Shield Floor Ring & Thin Cylindrical Light Curtain (100% on Grass Island Corner)
      const shieldFloorRingGeo = new THREE.RingGeometry(shieldRadius - 0.22, shieldRadius, 48);
      shieldFloorRingGeo.rotateX(-Math.PI / 2);
      const shieldFloorRingMat = new THREE.MeshBasicMaterial({
        color: shieldColorHex,
        transparent: true,
        opacity: 0.82,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const shieldFloorRing = new THREE.Mesh(shieldFloorRingGeo, shieldFloorRingMat);
      shieldFloorRing.position.y = 0.03;
      padGroup.add(shieldFloorRing);

      const shieldInnerDiscGeo = new THREE.CircleGeometry(shieldRadius - 0.22, 48);
      shieldInnerDiscGeo.rotateX(-Math.PI / 2);
      const shieldInnerDiscMat = new THREE.MeshBasicMaterial({
        color: shieldColorHex,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const shieldInnerDisc = new THREE.Mesh(shieldInnerDiscGeo, shieldInnerDiscMat);
      shieldInnerDisc.position.y = 0.02;
      padGroup.add(shieldInnerDisc);

      const shieldCurtainHeight = 2.9;
      const shieldCurtainGeo = new THREE.CylinderGeometry(
        shieldRadius,
        shieldRadius,
        shieldCurtainHeight,
        48,
        1,
        true,
      );
      const shieldCurtainMat = new THREE.MeshBasicMaterial({
        color: shieldColorHex,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const shieldCurtainMesh = new THREE.Mesh(shieldCurtainGeo, shieldCurtainMat);
      shieldCurtainMesh.position.y = shieldCurtainHeight * 0.5 + 0.03;
      padGroup.add(shieldCurtainMesh);

      const shieldTopRimGeo = new THREE.TorusGeometry(shieldRadius, 0.042, 8, 48);
      shieldTopRimGeo.rotateX(Math.PI / 2);
      const shieldTopRimMat = new THREE.MeshBasicMaterial({
        color: shieldColorHex,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
      });
      const shieldTopRimMesh = new THREE.Mesh(shieldTopRimGeo, shieldTopRimMat);
      shieldTopRimMesh.position.y = shieldCurtainHeight + 0.03;
      padGroup.add(shieldTopRimMesh);

      const slotMeshes: THREE.Group[] = [];
      const slotGeo = new THREE.BoxGeometry(
        UNIFIED_WORLD_CRATE_SIZE,
        UNIFIED_WORLD_CRATE_SIZE,
        UNIFIED_WORLD_CRATE_SIZE,
      );
      for (let i = 0; i < 8; i++) {
        const layer = i < 4 ? 0 : 1;
        const [tx, tz] = tileOffsets[i % 4];
        const slotY = 0.93 + layer * UNIFIED_WORLD_CRATE_SIZE;
        const slotGrp = new THREE.Group();
        slotGrp.position.set(tx, slotY, tz);
        slotGrp.visible = false;
        addOutlinedPart(slotGrp, slotGeo, matRedCrate, [0, 0, 0], [0, 0, 0], 1.07, true);
        populateRealBlitzCrateBoxFromGlb(
          slotGrp,
          'red',
          loadedBlitzAssets,
          windUniforms,
          isSoftwareGl,
          UNIFIED_WORLD_CRATE_SIZE,
        );
        padGroup.add(slotGrp);
        slotMeshes.push(slotGrp);
      }

      const padSign = createBillboardSign(4.8, 1.15);
      padSign.sprite.position.set(0, 3.85, 0);
      padSign.sprite.visible = false;

      return {
        spec,
        padGroup,
        shieldCurtainMat,
        shieldFloorRingMat,
        worldX: spec.x,
        worldZ: spec.z,
        slotMeshes,
        padSign,
      };
    };
    const publicWarzonePads = PUBLIC_WARZONE_CRATE_PADS.map((spec) =>
      buildPublicWarzoneCratePadMesh(spec),
    );

    const INTERACT_ENTER_RADIUS = 2.6;
    const INTERACT_EXIT_RADIUS = 2.9;
    const scratchKioskWorldPos = new THREE.Vector3();
    const getKioskWorldCenterForPlot = (team: 'blue' | 'red', padIdx = 0): THREE.Vector3 => {
      const baseObj = team === 'blue' ? blueBase : redBase;
      const pad = baseObj.commanderPads[padIdx] ?? baseObj.commanderPads[0];
      pad.kioskMesh.updateWorldMatrix(true, false);
      return pad.kioskMesh.getWorldPosition(scratchKioskWorldPos);
    };
    const getBlueKioskWorldCenter = (padIdx = 0): THREE.Vector3 =>
      getKioskWorldCenterForPlot('blue', padIdx);

    // =========================================================================
    // 6. MAP LAYOUT STATE & REAL .GLB PROP / TREE BUILDER (8-10 UNIT TALL TREES!)
    // =========================================================================
    const loadSavedLayout = (): ArenaMapLayout => loadSavedArenaLayout();

    let currentMapLayout: ArenaMapLayout = loadSavedLayout();
    const trees: DestructibleTree[] = [];
    const activeMapProps: ActiveMapPropPhysics[] = [];
    let navGridDirty = true;
    let cachedFootNavGrid: AStarNavGrid | null = null;
    let cachedVehicleNavGrid: AStarNavGrid | null = null;
    const collisionCooldownMap = new Map<string, number>();
    let nextEntityId = 500;
    let editorRotY = 0;
    let editorScale = 1.0;

    const registerMapPropPhysics = (prop: PlacedMapProp, wrapper: THREE.Group) => {
      const spec = getPropCollisionSpec(prop.kind, prop.scale);
      if (spec.category === 'none') return;
      activeMapProps.push({
        id: prop.id,
        kind: prop.kind,
        wrapper,
        x: prop.x,
        z: prop.z,
        vx: 0,
        vz: 0,
        rotY: prop.rotY,
        rotVelY: 0,
        scale: prop.scale,
        category: spec.category,
        materialTag: spec.materialTag,
        radius: spec.radius,
        halfX: spec.halfX,
        halfZ: spec.halfZ,
        heightY: getPropBaseHeight(prop.kind) * prop.scale,
        mass: spec.mass,
        restitution: spec.restitution,
        destructible: spec.destructible,
        hp: spec.maxHp,
        maxHp: spec.maxHp,
        shootImpulse: spec.shootImpulse,
        canJiggleOnHit: spec.canJiggleOnHit,
        alive: true,
        jiggleTimer: 0,
        jiggleDirX: 0,
        jiggleDirZ: 1,
      });
    };

    const spawnSingleMapProp = (prop: PlacedMapProp) => {
      if (playModeRef.current !== 'editor') {
        const overlapsPublicShieldPad = PUBLIC_WARZONE_CRATE_PADS.some(
          (pad) =>
            Math.hypot(prop.x - pad.x, prop.z - pad.z) <
            (pad.shieldRadius ?? PUBLIC_PAD_SHIELD_RADIUS) + 1.1,
        );
        // Prevent any default tree/prop from spawning inside the widened East Halte Trem platform deck or its 2 LOBBY return pads
        const overlapsHaltePlatform =
          prop.x >= -65.3 && prop.x <= -57.9 && Math.abs(prop.z) <= 9.6;
        if (overlapsPublicShieldPad || overlapsHaltePlatform) {
          return;
        }
      }
      if (prop.kind === 'tree_purple' || prop.kind === 'tree_gold') {
        const isPurple = prop.kind === 'tree_purple';
        const grp = new THREE.Group();
        grp.position.set(prop.x, 0, prop.z);
        grp.rotation.y = prop.rotY;
        grp.userData.baseRotY = prop.rotY;
        const shadow = new THREE.Mesh(shadowDiscGeo, shadowDiscMat);
        shadow.name = 'ContactShadowDisc';
        shadow.position.y = 0.02;
        shadow.scale.setScalar(2.35 * prop.scale);
        grp.add(shadow);
        scene.add(grp);

        populateRealBlitzTreeFromGlb(
          grp,
          loadedBlitzAssets
            ? isPurple
              ? loadedBlitzAssets.tree1bGltf?.scene ?? null
              : loadedBlitzAssets.tree1aGltf?.scene ?? null
            : null,
          isPurple,
          loadedBlitzAssets ? loadedBlitzAssets.treeFoliageTex : getSharedFallbackFoliageMaskTexture(),
          windUniforms,
          isSoftwareGl,
          prop.scale,
        );

        trees.push({
          id: nextEntityId++,
          propId: prop.id,
          isPurple,
          scale: prop.scale,
          mesh: grp,
          x: prop.x,
          z: prop.z,
          hp: 45,
          maxHp: 45,
          alive: true,
          hitFlashTimer: 0,
          jiggleTimer: 0,
          jiggleIntensity: 0,
          jiggleDirX: 0,
          jiggleDirZ: 1,
        });
        return;
      }

      if (prop.kind === 'river_rock') {
        const rockGrp = new THREE.Group();
        const sc = prop.scale;
        const stoneGeo = new THREE.SphereGeometry(0.68, 12, 10);
        const mainRock = new THREE.Mesh(
          stoneGeo,
          new THREE.MeshToonMaterial({ color: '#7b8d7e' }),
        );
        mainRock.scale.set(1.28 * sc, 0.74 * sc, 1.08 * sc);
        mainRock.position.y = 0.24 * sc;
        mainRock.frustumCulled = true;
        rockGrp.add(mainRock);

        const mossCap = new THREE.Mesh(
          stoneGeo,
          new THREE.MeshToonMaterial({ color: '#82cc59' }),
        );
        mossCap.scale.set(0.96 * sc, 0.4 * sc, 0.84 * sc);
        mossCap.position.set(0, 0.5 * sc, 0);
        mossCap.frustumCulled = true;
        rockGrp.add(mossCap);

        const sidePebble = new THREE.Mesh(
          stoneGeo,
          new THREE.MeshToonMaterial({ color: '#5f7063' }),
        );
        sidePebble.scale.set(0.62 * sc, 0.46 * sc, 0.58 * sc);
        sidePebble.position.set(0.65 * sc, 0.14 * sc, 0.32 * sc);
        sidePebble.frustumCulled = true;
        rockGrp.add(sidePebble);

        bakeStaticGroupMeshes(rockGrp, { minShadowCasterSpan: 0.45 });
        rockGrp.position.set(prop.x, getTerrainElevation(prop.x, prop.z), prop.z);
        rockGrp.rotation.y = prop.rotY;
        rockGrp.userData.propId = prop.id;
        rockGrp.userData.worldX = prop.x;
        rockGrp.userData.worldZ = prop.z;
        rockGrp.userData.baseRotY = prop.rotY;
        realPropsGroup.add(rockGrp);
        registerMapPropPhysics(prop, rockGrp);
        return;
      }

      if (prop.kind === 'flower_cluster') {
        const cluster = new THREE.Group();
        const sc = prop.scale;
        const stemGeo = new THREE.CylinderGeometry(0.032, 0.038, 0.28, 5);
        const blossomGeo = new THREE.CylinderGeometry(0.2, 0.12, 0.08, 7);
        const centerGeo = new THREE.SphereGeometry(0.085, 6, 6);
        const stemMat = new THREE.MeshToonMaterial({ color: '#4ca854' });
        const centerMat = new THREE.MeshBasicMaterial({ color: '#fff6a1' });
        const colors = ['#2998ff', '#ffe033', '#ff70c6'];
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2;
          const rad = i === 0 ? 0.05 : 0.4 + (i % 2) * 0.24;
          const bx = Math.cos(ang) * rad;
          const bz = Math.sin(ang) * rad;
          const h = 0.24 + (i % 3) * 0.07;

          const stem = new THREE.Mesh(stemGeo, stemMat);
          stem.position.set(bx, h * 0.5, bz);
          stem.frustumCulled = true;
          cluster.add(stem);

          const head = new THREE.Mesh(
            blossomGeo,
            new THREE.MeshBasicMaterial({ color: colors[(prop.id + i) % colors.length] }),
          );
          head.position.set(bx, h, bz);
          head.frustumCulled = true;
          cluster.add(head);

          const center = new THREE.Mesh(centerGeo, centerMat);
          center.position.set(bx, h + 0.05, bz);
          center.frustumCulled = true;
          cluster.add(center);
        }
        bakeStaticGroupMeshes(cluster, { minShadowCasterSpan: 0.45 });
        cluster.scale.setScalar(sc);
        cluster.position.set(prop.x, getTerrainElevation(prop.x, prop.z), prop.z);
        cluster.rotation.y = prop.rotY;
        cluster.userData.propId = prop.id;
        cluster.userData.worldX = prop.x;
        cluster.userData.worldZ = prop.z;
        cluster.userData.baseRotY = prop.rotY;
        realPropsGroup.add(cluster);
        return;
      }

      // In Sandbox / Match mode, any 'dump_truck' placed on the map becomes a real drivable Dump Truck vehicle!
      if (prop.kind === 'dump_truck' && playModeRef.current !== 'editor') {
        const existingTruck = tanks.find(
          (v) => v.vehicleKind === 'truck' && (v.mapPropId === prop.id || Math.hypot(v.x - prop.x, v.z - prop.z) < 2.2),
        );
        if (!existingTruck) {
          const truckTeam = prop.x <= 0 ? 'blue' : 'red';
          const mapTruck = createBlitzDumpTruckVehicle(prop.x, prop.z, truckTeam, prop.rotY);
          mapTruck.mapPropId = prop.id;
          tanks.push(mapTruck);
        }
        return;
      }

      if (!loadedBlitzAssets) {
        const placeholderWrapper = new THREE.Group();
        placeholderWrapper.position.set(prop.x, 0, prop.z);
        placeholderWrapper.rotation.y = prop.rotY;
        placeholderWrapper.userData.propId = prop.id;
        placeholderWrapper.userData.worldX = prop.x;
        placeholderWrapper.userData.worldZ = prop.z;
        placeholderWrapper.userData.baseRotY = prop.rotY;
        realPropsGroup.add(placeholderWrapper);
        registerMapPropPhysics(prop, placeholderWrapper);
        return;
      }
      const gltfMap: Record<
        Exclude<PlacedMapProp['kind'], 'tree_purple' | 'tree_gold' | 'river_rock' | 'flower_cluster'>,
        typeof loadedBlitzAssets.turbineGltf
      > = {
        turbine: loadedBlitzAssets.turbineGltf,
        power_core: loadedBlitzAssets.powerCoreGltf,
        concrete_fence: loadedBlitzAssets.concreteFenceGltf,
        barricade: loadedBlitzAssets.barricadeGltf,
        explosive_barrel: loadedBlitzAssets.explosiveBarrelGltf,
        hydrant: loadedBlitzAssets.hydrantGltf,
        lamppost_1a: loadedBlitzAssets.lamppost1aGltf,
        lamppost_1b: loadedBlitzAssets.lamppost1bGltf,
        bench: loadedBlitzAssets.benchGltf,
        chimney: loadedBlitzAssets.chimneyGltf,
        giant_tank: loadedBlitzAssets.giantTankGltf,
        dump_truck: loadedBlitzAssets.dumpTruckGltf,
        crane: loadedBlitzAssets.craneGltf,
        recycle_bin: loadedBlitzAssets.recycleBinGltf,
        traffic_cone: loadedBlitzAssets.trafficConeGltf,
        wheelbarrow: loadedBlitzAssets.wheelbarrowGltf,
        tank_1a: loadedBlitzAssets.tank1aGltf,
        tank_1b: loadedBlitzAssets.tank1bGltf,
        pipe_cluster: loadedBlitzAssets.pipeCluster1aGltf,
        pipe_cluster_1b: loadedBlitzAssets.pipeCluster1bGltf,
        giant_pipe: loadedBlitzAssets.giantPipe1aGltf,
        giant_pipe_1b: loadedBlitzAssets.giantPipe1bGltf,
        concrete_fence_1b: loadedBlitzAssets.concreteFence1bGltf,
        concrete_pipe: loadedBlitzAssets.concretePipeGltf,
        barrel_1c: loadedBlitzAssets.barrel1cGltf,
        pallet_1a: loadedBlitzAssets.pallet1aGltf,
        h_beam: loadedBlitzAssets.hBeamGltf,
        forklift: loadedBlitzAssets.forkliftGltf,
        fuel_cell: loadedBlitzAssets.fuelGltf,
        circuit_module: loadedBlitzAssets.circuitGltf,
      };
      const targetGltf = gltfMap[prop.kind];
      const baseH = getPropBaseHeight(prop.kind) * prop.scale;
      const wrapper = spawnRealBlitzPropFromGlb(
        realPropsGroup,
        targetGltf,
        prop.x,
        prop.z,
        prop.rotY,
        baseH,
        windUniforms,
        isSoftwareGl,
      );
      if (wrapper) {
        wrapper.userData.propId = prop.id;
        wrapper.userData.worldX = prop.x;
        wrapper.userData.worldZ = prop.z;
        wrapper.userData.baseRotY = prop.rotY;
        registerMapPropPhysics(prop, wrapper);
      }
    };

    const rebuildMapFromLayout = (layout: ArenaMapLayout) => {
      // 1. Reposition Blue HQ, 4 Blue Stacking Pads, Red HQ, 4 Red Stacking Pads, and Central Drop Zone
      blueBase.hqX = layout.blueHq.x;
      blueBase.hqZ = layout.blueHq.z;
      blueBase.baseGroup.position.set(layout.blueHq.x, 0, layout.blueHq.z);
      blueBase.baseGroup.rotation.y = Math.PI / 2;

      const padOffsetsX = [-37.7, -7.7, 22.3, 52.3];
      blueBase.commanderPads.forEach((cp, idx) => {
        cp.padX = layout.blueHq.x + padOffsetsX[idx];
        cp.padZ = layout.blueHq.z - 8.2;
        cp.worldX = cp.padX;
        cp.worldZ = cp.padZ;
        cp.padGroup.position.set(cp.padX, 0.04, cp.padZ);
        cp.padGroup.rotation.y = 0;
      });
      blueBase.padX = blueBase.commanderPads[0].padX;
      blueBase.padZ = blueBase.commanderPads[0].padZ;

      redBase.hqX = layout.redHq.x;
      redBase.hqZ = layout.redHq.z;
      redBase.baseGroup.position.set(layout.redHq.x, 0, layout.redHq.z);
      redBase.baseGroup.rotation.y = -Math.PI / 2;

      redBase.commanderPads.forEach((cp, idx) => {
        cp.padX = layout.redHq.x - padOffsetsX[idx];
        cp.padZ = layout.redHq.z + 8.2;
        cp.worldX = cp.padX;
        cp.worldZ = cp.padZ;
        cp.padGroup.position.set(cp.padX, 0.04, cp.padZ);
        cp.padGroup.rotation.y = Math.PI;
      });
      redBase.padX = redBase.commanderPads[0].padX;
      redBase.padZ = redBase.commanderPads[0].padZ;

      centerDropZoneGroup.position.set(layout.centerDropZone.x, 0.06, layout.centerDropZone.z);

      // 2. Clear existing trees & props (and any unmounted map-prop dump trucks if in editor mode)
      trees.forEach((t) => scene.remove(t.mesh));
      trees.length = 0;
      activeMapProps.length = 0;
      for (let i = realPropsGroup.children.length - 1; i >= 0; i--) {
        realPropsGroup.remove(realPropsGroup.children[i]);
      }
      if (playModeRef.current === 'editor') {
        for (let i = tanks.length - 1; i >= 0; i--) {
          if (tanks[i].mapPropId !== undefined && tanks[i] !== mountedTank) {
            scene.remove(tanks[i].root);
            tanks.splice(i, 1);
          }
        }
      }

      // 3. Spawn all trees & props from layout
      layout.props.forEach((p) => spawnSingleMapProp(p));
      navGridDirty = true;
    };

    // =========================================================================
    // 7. BUILDER FOR CHIBI/BLOCKY TEAM BUDDIES CHARACTERS & REAL .GLB BLITZ TANKS
    // =========================================================================
    const createBuddyCharacterUnit = (
      team: 'blue' | 'red',
      isPlayer: boolean,
      classId: BuddyClassId,
      spawnX: number,
      spawnZ: number,
      ownerCommanderId = 0,
      startUnarmed = true,
      isStarterCommanderUnit = true,
    ): BuddyUnit => {
      const root = new THREE.Group();
      root.rotation.order = 'YXZ';
      root.position.set(spawnX, 0, spawnZ);
      scene.add(root);

      const shadow = new THREE.Mesh(shadowDiscGeo, shadowDiscMat);
      shadow.position.y = 0.02;
      shadow.scale.setScalar(0.8);
      root.add(shadow);

      const footColorHex = getUnitFootRingTeamColor(team).hexInt;
      const ringMat = new THREE.MeshBasicMaterial({
        color: footColorHex,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const teamRing = new THREE.Mesh(new THREE.RingGeometry(0.76, 0.86, 48), ringMat);
      teamRing.name = 'unitFootTeamRing';
      teamRing.rotation.x = -Math.PI / 2;
      teamRing.position.y = 0.04;
      const innerFootDiscMat = new THREE.MeshBasicMaterial({
        color: footColorHex,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const innerFootDisc = new THREE.Mesh(new THREE.CircleGeometry(0.76, 48), innerFootDiscMat);
      innerFootDisc.name = 'unitFootInnerGlowDisc';
      innerFootDisc.position.z = -0.005;
      teamRing.add(innerFootDisc);
      root.add(teamRing);

      const bodyGroup = new THREE.Group();
      bodyGroup.rotation.order = 'YXZ';
      bodyGroup.scale.setScalar(1.16);
      root.add(bodyGroup);

      const rig = buildProceduralRobloxBuddyAvatar(
        bodyGroup,
        team,
        windUniforms,
        isSoftwareGl,
        false,
      );
      const {
        headMesh,
        leftArmPivot,
        rightArmPivot,
        leftLegPivot,
        rightLegPivot,
        weaponMesh,
      } = rig;
      headMesh.userData.defaultMat = headMesh.material;

      // Overhead Carried 3D Crate (visible when carrying a crate in front of chest between both hands; inverse-scaled by 1/1.16 so world size is 1:1 UNIFIED_WORLD_CRATE_SIZE!)
      const overheadCrateGroup = new THREE.Group();
      overheadCrateGroup.name = 'BuddyOverheadCrateGroup';
      overheadCrateGroup.position.set(0, 1.96, 0.72);
      overheadCrateGroup.scale.setScalar(1 / 1.16);
      overheadCrateGroup.visible = false;
      bodyGroup.add(overheadCrateGroup);
      const overheadCrateBox = addOutlinedPart(
        overheadCrateGroup,
        new THREE.BoxGeometry(
          UNIFIED_WORLD_CRATE_SIZE,
          UNIFIED_WORLD_CRATE_SIZE,
          UNIFIED_WORLD_CRATE_SIZE,
        ),
        matRedCrate,
        [0, 0, 0],
      );
      populateRealBlitzCrateBoxFromGlb(
        overheadCrateGroup,
        'red',
        loadedBlitzAssets,
        windUniforms,
        isSoftwareGl,
        UNIFIED_WORLD_CRATE_SIZE,
      );

      // Overhead AI Salute Sign (pops up above AI Buddy head when [V] command is issued!)
      const saluteSign = createBillboardSign(3.4, 0.92);
      saluteSign.sprite.position.set(0, 4.15, 0);
      saluteSign.sprite.visible = false;

      // MMORPG Glassmorphic Nameplate with Default Rookie Emblem (Single-Line Above Head)
      const nameplate = createGlassmorphicNameplate(
        2.8,
        0.72,
        isPlayer ? 'YOU' : `BUDDY #${nextEntityId}`,
        '',
        false,
      );
      nameplate.sprite.position.set(0, 4.35, 0);
      nameplate.sprite.visible = false;
      root.add(nameplate.sprite);

      const stunMesh = createBlitzStunEffectMesh();
      stunMesh.name = 'BuddyStunEffect';
      stunMesh.position.set(0, 3.6, 0);
      bodyGroup.add(stunMesh);

      const initialWeaponId: BlitzWeaponId = startUnarmed
        ? 'unarmed'
        : classId === 'Commando' || classId === 'Cyborg' || classId === 'SuperBuddie'
        ? 'bazooka'
        : classId === 'Infuntry' || classId === 'Stealthy'
        ? 'rifle'
        : 'pistol';
      const initialWeaponName =
        initialWeaponId === 'unarmed'
          ? 'Unarmed (Fists)'
          : initialWeaponId === 'bazooka'
          ? 'BlitzRocketLauncher'
          : initialWeaponId === 'rifle'
          ? 'BlitzAssaultRifle'
          : 'BlitzPistol';
      const initialSecondaryItem: BuddySecondaryItemId = startUnarmed
        ? 'none'
        : classId === 'Stealthy' || classId === 'Ninja'
          ? 'land_mine'
          : 'hand_grenade';
      const initialSecondaryCount = initialSecondaryItem === 'none' ? 0 : 2;
      const initialAmmo = initialWeaponId === 'unarmed' ? 0 : initialWeaponId === 'bazooka' ? 18 : 120;
      const tacticalLoadout = createInitialBuddyTacticalLoadout(
        initialWeaponId,
        initialAmmo,
        initialSecondaryItem,
        initialSecondaryCount,
      );
      updateCharacterWeaponStance(rig, initialWeaponId, 0, false, false, 0, 0);

      return {
        id: nextEntityId++,
        team,
        ownerCommanderId,
        isStarterCommanderUnit,
        isPlayer,
        classId,
        root,
        bodyGroup,
        rig,
        headMesh,
        leftArmPivot,
        rightArmPivot,
        leftLegPivot,
        rightLegPivot,
        weaponMesh,
        overheadCrateGroup,
        overheadCrateBox,
        saluteSign,
        nameplate,
        teamRing,
        x: spawnX,
        y: 0,
        z: spawnZ,
        vx: 0,
        vy: 0,
        vz: 0,
        jumpOffset: 0,
        isGrounded: true,
        jumpBufferTimer: 0,
        invincibilityTimer: 0,
        yaw: team === 'blue' ? Math.PI / 2 : -Math.PI / 2,
        hp: isPlayer ? PLAYER_WARZONE_MAX_HP : 100,
        maxHp: isPlayer ? PLAYER_WARZONE_MAX_HP : 100,
        weaponId: initialWeaponId,
        weaponName: initialWeaponName,
        weaponRecoil: 0,
        punchTimer: 0,
        punchHand: 'right',
        kickTimer: 0,
        ammo: initialAmmo,
        carryingCrate: 'none',
        secondaryItem: initialSecondaryItem,
        secondaryCount: initialSecondaryCount,
        tacticalLoadout,
        missionItem: 'none',
        walkCycle: 0,
        shootCooldown: 0,
        hitFlashTimer: 0,
        hitReactionTimer: 0,
        hitReactionDirX: 0,
        hitReactionDirZ: 1,
        stunTimer: 0,
        stunMesh,
        isFrozen: false,
        frozenTimer: 0,
        saluteTimer: 0,
        aiTargetCrateId: null,
        assignedRole: team === 'blue' && ownerCommanderId === 0 ? teamCommand : 'HARVEST',
        followerReactionTimer: 0,
        followerIdleLookTimer: 1.5,
        followerIdleLookYaw: team === 'blue' ? Math.PI / 2 : -Math.PI / 2,
        followerStrafeTimer: 0.8,
        followerStrafeSign: 1,
        alive: true,
        respawnTimer: 0,
      };
    };

    // =========================================================================
    // 1B. STANDING 3D NPC MERCHANTS (LOBBY MINI CAFÉ & EAST BEACH HOUSE)
    //     + 3D PRIVATE HOUSE INTERIOR ROOM (WITH DYNAMIC FURNITURE SLOTS)
    // =========================================================================
    const buildStandingNpcMerchant3D = (
      wx: number,
      wy: number,
      wz: number,
      rotY: number,
      teamStyle: 'blue' | 'red',
      titleText: string,
      _subText: string,
      preferredGender: CharacterGender = 'female',
    ) => {
      const npcGrp = new THREE.Group();
      npcGrp.rotation.order = 'YXZ';
      const actualGroundY = wy !== undefined && wy !== 0 ? wy : getTerrainElevation(wx, wz);
      npcGrp.position.set(wx, actualGroundY, wz);
      npcGrp.rotation.y = rotY;
      scene.add(npcGrp);

      const npcRing = new THREE.Mesh(
        new THREE.RingGeometry(0.82, 0.96, 48),
        new THREE.MeshBasicMaterial({
          color: 0x22c55e,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.92,
        }),
      );
      npcRing.rotation.x = -Math.PI / 2;
      npcRing.position.y = 0.04;
      npcGrp.add(npcRing);

      const bodyGrp = new THREE.Group();
      bodyGrp.rotation.order = 'YXZ';
      bodyGrp.scale.setScalar(1.18);
      npcGrp.add(bodyGrp);

      const npcRig = buildProceduralRobloxBuddyAvatar(
        bodyGrp,
        teamStyle,
        windUniforms,
        isSoftwareGl,
        false,
        preferredGender,
      );
      npcRig.weaponRigGroup.visible = false;
      npcRig.pistolGroup.visible = false;

      // MMORPG Crystal-Clear Glassmorphism Nameplate with Special Golden NPC Crown Crest Emblem (Single-Line Above Head)
      const npcNameplate = createGlassmorphicNameplate(
        2.9,
        0.74,
        titleText.split('//')[0].trim(),
        '',
        true,
      );
      npcNameplate.sprite.position.set(0, 4.38, 0);
      npcNameplate.sprite.visible = false;
      npcGrp.add(npcNameplate.sprite);

      // Stylized 3D Anime MMORPG Floating Exclamation Mark Indicator ('!')
      const exclamationGroup = new THREE.Group();
      exclamationGroup.name = 'NpcExclamationMark';
      exclamationGroup.position.set(0, 3.25, 0);

      // Glow backing disc / halo ring
      const haloDisc = new THREE.Mesh(
        new THREE.RingGeometry(0.18, 0.58, 24),
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.38,
          depthWrite: false,
        }),
      );
      haloDisc.name = 'HaloDisc';
      exclamationGroup.add(haloDisc);

      // Diamond / Diamond-rhombus background badge
      const badgeGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.08, 4);
      badgeGeo.rotateX(Math.PI / 2);
      badgeGeo.rotateZ(Math.PI / 4);
      const badgeMesh = new THREE.Mesh(
        badgeGeo,
        new THREE.MeshStandardMaterial({
          color: 0x0284c7,
          roughness: 0.25,
          metalness: 0.1,
          emissive: 0x0369a1,
          emissiveIntensity: 0.35,
        }),
      );
      badgeMesh.scale.set(0.85, 1.25, 1.0);
      exclamationGroup.add(badgeMesh);

      // Upper pillar bar of '!'
      const barGeo = new THREE.CylinderGeometry(0.085, 0.055, 0.52, 12);
      const markMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.2,
        metalness: 0.05,
        emissive: 0xe0f2fe,
        emissiveIntensity: 0.5,
      });
      const barMesh = new THREE.Mesh(barGeo, markMat);
      barMesh.position.set(0, 0.11, 0.06);
      exclamationGroup.add(barMesh);

      // Lower dot of '!'
      const dotGeo = new THREE.SphereGeometry(0.065, 12, 12);
      const dotMesh = new THREE.Mesh(dotGeo, markMat);
      dotMesh.position.set(0, -0.25, 0.06);
      exclamationGroup.add(dotMesh);

      npcGrp.add(exclamationGroup);

      return { npcGrp, bodyGrp, npcRig, npcNameplate, exclamationGroup };
    };

    const lobbyCafeNpc = buildStandingNpcMerchant3D(
      -94.0,
      1.42,
      -13.8,
      Math.PI / 2,
      'blue',
      'HANA',
      'MINI CAFÉ MERCHANT',
      'female',
    );
    const beachHouseNpc = buildStandingNpcMerchant3D(
      85.8,
      0.82,
      60.0,
      Math.PI / 2,
      'red',
      'KAI',
      'BEACH HOUSE MERCHANT',
      'male',
    );

    // =========================================================================
    // 3D PRIVATE HOUSE INTERIOR CUTAWAY STUDIO (`buddies-blitz.com/interior` BUDDIES Port)
    // World Origin: (0, 145, 0) | Cutaway Plinth: 10.6m x 7.4m x 2.75m
    // =========================================================================
    const HOUSE_ORIGIN_Y = 145.0;
    const houseInteriorRoomGrp = new THREE.Group();
    houseInteriorRoomGrp.name = 'PrivateHouseInteriorRoom3D';
    houseInteriorRoomGrp.position.set(0, HOUSE_ORIGIN_Y, 0);
    houseInteriorRoomGrp.visible = false;
    scene.add(houseInteriorRoomGrp);

    // Studio Backdrop Dome around (0, 145, 0) so the cutaway house sits in a rich dusk/day sky
    const houseSkyBackdropMat = new THREE.MeshBasicMaterial({
      color: '#1e293b',
      side: THREE.BackSide,
      fog: false,
    });
    const houseSkyBackdropDome = new THREE.Mesh(
      new THREE.SphereGeometry(52, 24, 16),
      houseSkyBackdropMat,
    );
    houseSkyBackdropDome.raycast = () => {};
    houseInteriorRoomGrp.add(houseSkyBackdropDome);

    // Procedural Canvas Texture Generator for Floor (Plank Wood / Tatami / Marble) & Wall Art
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const floorCanvasTex = new THREE.CanvasTexture(floorCanvas);
    floorCanvasTex.wrapS = THREE.RepeatWrapping;
    floorCanvasTex.wrapT = THREE.RepeatWrapping;
    floorCanvasTex.repeat.set(4, 3);

    const redrawFloorTexture = (primaryHex: string, secondaryHex: string, isMarbleOrSlate = false) => {
      const ctx = floorCanvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = primaryHex;
      ctx.fillRect(0, 0, 512, 512);
      if (isMarbleOrSlate) {
        ctx.strokeStyle = secondaryHex;
        ctx.lineWidth = 3;
        for (let i = 0; i < 4; i++) {
          const p = i * 128;
          ctx.strokeRect(p + 2, 2, 124, 508);
          ctx.strokeRect(2, p + 2, 508, 124);
        }
      } else {
        // Staggered timber planks + tatami weave grain (`slotLay k==1` in buddies-blitz.com/interior)
        const rows = 8;
        const rowH = 512 / rows;
        for (let r = 0; r < rows; r++) {
          const y = r * rowH;
          ctx.fillStyle = r % 2 === 0 ? primaryHex : secondaryHex;
          ctx.globalAlpha = 0.16;
          ctx.fillRect(0, y, 512, rowH - 3);
          ctx.globalAlpha = 0.45;
          ctx.fillStyle = secondaryHex;
          ctx.fillRect(0, y + rowH - 3, 512, 3);
          const staggerX = ((r * 173) % 240) + 60;
          ctx.fillRect(staggerX, y, 3, rowH);
          ctx.fillRect((staggerX + 240) % 512, y, 3, rowH);
        }
        ctx.globalAlpha = 1.0;
      }
      floorCanvasTex.needsUpdate = true;
    };
    redrawFloorTexture('#c99a62', '#93612e', false);

    const interiorWallMat = new THREE.MeshStandardMaterial({
      color: '#e3d2b6',
      roughness: 0.85,
    });
    const interiorTrimMat = new THREE.MeshStandardMaterial({
      color: '#7c5238',
      roughness: 0.55,
    });
    const interiorFloorMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: floorCanvasTex,
      roughness: 0.58,
    });
    const darkPlinthMat = new THREE.MeshStandardMaterial({
      color: '#23272e',
      roughness: 0.45,
      metalness: 0.4,
    });
    const capWallMat = new THREE.MeshStandardMaterial({
      color: '#2d333e',
      roughness: 0.6,
    });
    const mullionDarkMat = new THREE.MeshStandardMaterial({
      color: '#1b1c1f',
      roughness: 0.4,
      metalness: 0.5,
    });
    const plinthGlowMat = new THREE.MeshBasicMaterial({
      color: '#ffb468',
      fog: false,
    });
    const lampWarmEmissiveMat = new THREE.MeshBasicMaterial({
      color: '#ffd6a0',
      fog: false,
    });

    // Dedicated Interior Hemisphere & Sun/Lamp Lights inside houseInteriorRoomGrp
    const houseHemiLight = new THREE.HemisphereLight('#97a8d6', '#3d3026', 0.65);
    houseHemiLight.position.set(0, 6.0, 0);
    houseInteriorRoomGrp.add(houseHemiLight);

    const houseSunLight = new THREE.DirectionalLight('#ffb46c', 1.65);
    houseSunLight.position.set(-8.0, 7.5, -5.0);
    houseInteriorRoomGrp.add(houseSunLight);
    houseInteriorRoomGrp.add(houseSunLight.target);

    const houseWarmLampPointLight = new THREE.PointLight('#ffc27a', 0.8, 12.0);
    houseWarmLampPointLight.position.set(-1.5, 2.1, -1.2);
    houseInteriorRoomGrp.add(houseWarmLampPointLight);

    // 1. Cutaway Studio Plinth + Warm Underglow Strips (`#L351-L352`)
    const {
      minX: A,
      maxX: J,
      minZ: T,
      maxZ: N,
      wallThickness: L,
      fullWallHeight: ee,
      cutawayWallHeight: Yn,
      partitionWallHeight: _a,
      partitionX: fe,
      partitionZ: lt,
      partitionThickness: U,
      slatEndZ: ko,
      windowLeft: winL,
      windowBack: winB,
      doorPassZ: Da,
      doorPassX: Ia,
    } = CUTAWAY_ROOM_BOUNDS;

    const plinthUpper = new THREE.Mesh(
      new THREE.BoxGeometry(J - A + 1.35, 0.24, N - T + 1.35),
      capWallMat,
    );
    plinthUpper.position.set(0, -0.14, 0);
    plinthUpper.raycast = () => {};
    houseInteriorRoomGrp.add(plinthUpper);

    const plinthLower = new THREE.Mesh(
      new THREE.BoxGeometry(J - A + 0.68, 0.42, N - T + 0.68),
      darkPlinthMat,
    );
    plinthLower.position.set(0, -0.46, 0);
    plinthLower.raycast = () => {};
    houseInteriorRoomGrp.add(plinthLower);

    // Underglow LED Rim Strips around the studio plinth
    for (const [gx, gz, gw, gd] of [
      [0, N + 0.62, J - A + 1.1, 0.04],
      [0, T - 0.62, J - A + 1.1, 0.04],
      [A - 0.62, 0, 0.04, N - T + 1.1],
      [J + 0.62, 0, 0.04, N - T + 1.1],
    ] as const) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(gw, 0.028, gd), plinthGlowMat);
      strip.position.set(gx, -0.265, gz);
      strip.raycast = () => {};
      houseInteriorRoomGrp.add(strip);
    }

    // Main Room Floor (10.6m x 7.4m)
    const roomFloor = new THREE.Mesh(new THREE.BoxGeometry(J - A, 0.04, N - T), interiorFloorMat);
    roomFloor.position.set(0, -0.02, 0);
    houseInteriorRoomGrp.add(roomFloor);

    // Helper to add a box wall segment with dark top coping (`Se` in buddies-blitz.com/interior `#L356`)
    const addCutawayWallSegment = (
      x0: number,
      x1: number,
      y0: number,
      y1: number,
      z0: number,
      z1: number,
      mat: THREE.Material = interiorWallMat,
    ) => {
      const w = x1 - x0;
      const h = y1 - y0;
      const d = z1 - z0;
      const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      wallMesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      wallMesh.raycast = () => {};
      houseInteriorRoomGrp.add(wallMesh);

      const capMesh = new THREE.Mesh(new THREE.BoxGeometry(w + 0.01, 0.025, d + 0.01), capWallMat);
      capMesh.position.set((x0 + x1) / 2, y1 + 0.012, (z0 + z1) / 2);
      capMesh.raycast = () => {};
      houseInteriorRoomGrp.add(capMesh);
    };

    // Left Wall (`wallL`, height `ee = 2.75m`) with Left Shoji Window Aperture (`winL`)
    addCutawayWallSegment(A - L, A, 0, ee, T, winL.z0);
    addCutawayWallSegment(A - L, A, 0, ee, winL.z1, N);
    addCutawayWallSegment(A - L, A, 0, winL.y0, winL.z0, winL.z1);
    addCutawayWallSegment(A - L, A, winL.y1, ee, winL.z0, winL.z1);

    // Back Wall (`wallB`, height `ee = 2.75m`) with Panoramic Shoji Window Aperture (`winB`)
    addCutawayWallSegment(A - L, winB.x0, 0, ee, T - L, T);
    addCutawayWallSegment(winB.x1, J + L, 0, ee, T - L, T);
    addCutawayWallSegment(winB.x0, winB.x1, 0, winB.y0, T - L, T);
    addCutawayWallSegment(winB.x0, winB.x1, winB.y1, ee, T - L, T);

    // Low Cutaway Front & Right Walls (`Yn = 0.45m`) so camera has an unobstructed isometric view
    addCutawayWallSegment(A - L, -0.65, 0, Yn, N, N + L);
    addCutawayWallSegment(0.65, J + L, 0, Yn, N, N + L);
    addCutawayWallSegment(J, J + L, 0, Yn, T, N);

    // Interior Half-Height Partition Walls (`_a = 1.3m`) with Doorway Passages (`Da`, `Ia`)
    addCutawayWallSegment(fe - U / 2, fe + U / 2, 0, _a, T, Da.z0);
    addCutawayWallSegment(fe - U / 2, fe + U / 2, 0, _a, Da.z1, N);
    addCutawayWallSegment(fe + U / 2, Ia.x0, 0, _a, lt - U / 2, lt + U / 2);
    addCutawayWallSegment(Ia.x1, J, 0, _a, lt - U / 2, lt + U / 2);

    // Vertical Wooden Slat Wall (`slats`, `#L364`) along Left Wall from z = T to z = ko (0.95)
    const slatCount = 54;
    const slatSpan = ko - (T + 0.02);
    const slatStep = slatSpan / slatCount;
    for (let d = 0; d < slatCount; d++) {
      const sz = T + 0.02 + slatStep * (d + 0.5);
      const slat = new THREE.Mesh(
        new THREE.BoxGeometry(0.036, ee - 0.02, 0.042),
        interiorTrimMat,
      );
      slat.position.set(A + 0.022, ee / 2, sz);
      slat.raycast = () => {};
      houseInteriorRoomGrp.add(slat);
    }

    // Window Mullions, Glass Panes, & Sine-Wave Pleated Sheer Curtains (`Bs` & `mr`, `#L360-L363`)
    const windowGlassMat = new THREE.MeshBasicMaterial({
      color: '#cfe9ff',
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const leftGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(winL.z1 - winL.z0 - 0.04, winL.y1 - winL.y0 - 0.04),
      windowGlassMat,
    );
    leftGlass.rotation.y = Math.PI / 2;
    leftGlass.position.set(A - L / 2, (winL.y0 + winL.y1) / 2, (winL.z0 + winL.z1) / 2);
    leftGlass.raycast = () => {};
    houseInteriorRoomGrp.add(leftGlass);

    const backGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(winB.x1 - winB.x0 - 0.04, winB.y1 - winB.y0 - 0.04),
      windowGlassMat,
    );
    backGlass.position.set((winB.x0 + winB.x1) / 2, (winB.y0 + winB.y1) / 2, T - L / 2);
    backGlass.raycast = () => {};
    houseInteriorRoomGrp.add(backGlass);

    // Back Window Shoji Mullion Bars
    for (let s = 0; s <= 4; s++) {
      const mx = winB.x0 + ((winB.x1 - winB.x0) * s) / 4;
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, winB.y1 - winB.y0, 0.06),
        mullionDarkMat,
      );
      bar.position.set(mx, (winB.y0 + winB.y1) / 2, T - L / 2);
      bar.raycast = () => {};
      houseInteriorRoomGrp.add(bar);
    }

    // Sine-Wave Pleated Sheer Curtain Builder (`mr` from buddies-blitz.com/interior `#L360`)
    const sheerCurtainMat = new THREE.MeshStandardMaterial({
      color: '#f4efe6',
      roughness: 0.9,
      transparent: true,
      opacity: 0.84,
      side: THREE.DoubleSide,
    });
    const addSineWaveSheerCurtain = (
      width: number,
      height: number,
      posX: number,
      posZ: number,
      rotY: number,
      folds = 9,
      phase = 0,
    ) => {
      const geo = new THREE.PlaneGeometry(width, height, 36, 1);
      const posAttr = geo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const f = posAttr.getX(i) / width + 0.5;
        posAttr.setZ(i, Math.sin(f * Math.PI * folds + phase) * 0.032 * (0.6 + 0.4 * f));
      }
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, sheerCurtainMat);
      mesh.rotation.y = rotY;
      mesh.position.set(posX, height / 2 + 0.04, posZ);
      mesh.raycast = () => {};
      houseInteriorRoomGrp.add(mesh);
    };
    addSineWaveSheerCurtain(0.52, 2.48, A + 0.1, winL.z0 + 0.02, Math.PI / 2, 9, 0);
    addSineWaveSheerCurtain(0.56, 2.5, winB.x0 - 0.05, T + 0.1, 0, 10, 1.0);
    addSineWaveSheerCurtain(0.56, 2.5, winB.x1 + 0.05, T + 0.1, 0, 10, 2.2);

    // Framed Dynamic Wall Art on Back Wall (`gc` & `yc` from buddies-blitz.com/interior `#L443-L444`)
    const wallArtCanvas = document.createElement('canvas');
    wallArtCanvas.width = 256;
    wallArtCanvas.height = 340;
    const wallArtTex = new THREE.CanvasTexture(wallArtCanvas);
    const redrawWallArtCanvas = (palette: readonly string[]) => {
      const ctx = wallArtCanvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = palette[0] ?? '#ece5d8';
      ctx.fillRect(0, 0, 256, 340);
      ctx.fillStyle = palette[1] ?? '#c99a62';
      ctx.fillRect(0, 198, 256, 142);
      const drawOrganicBlob = (cx: number, cy: number, rx: number, ry: number, col: string, ph: number) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        for (let h = 0; h <= 24; h++) {
          const ang = (h / 24) * Math.PI * 2;
          const m = 1 + 0.12 * Math.sin(ang * 3 + ph) + 0.06 * Math.sin(ang * 5 - ph);
          const x = cx + Math.cos(ang) * rx * m;
          const y = cy + Math.sin(ang) * ry * m;
          if (h === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.fill();
      };
      drawOrganicBlob(92, 105, 68, 48, palette[2] ?? '#b5613d', 1);
      drawOrganicBlob(176, 210, 62, 54, palette[3] ?? '#24334c', 2);
      drawOrganicBlob(74, 248, 48, 36, palette[4] ?? '#c48d2f', 3);
      wallArtTex.needsUpdate = true;
    };
    redrawWallArtCanvas(['#ece5d8', '#d4bf9e', '#b5613d', '#24334c', '#c48d2f']);

    const wallArtFrame = new THREE.Group();
    const frameBox = new THREE.Mesh(new THREE.BoxGeometry(0.98, 1.24, 0.04), interiorTrimMat);
    const artPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.76, 1.02),
      new THREE.MeshBasicMaterial({ map: wallArtTex }),
    );
    artPlane.position.z = 0.024;
    const pictureLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.025, 0.08),
      lampWarmEmissiveMat,
    );
    pictureLight.position.set(0, 0.68, 0.06);
    wallArtFrame.add(frameBox, artPlane, pictureLight);
    wallArtFrame.position.set(3.4, 1.68, T + 0.03);
    wallArtFrame.traverse((c) => {
      c.raycast = () => {};
    });
    houseInteriorRoomGrp.add(wallArtFrame);

    // 2. Radial 3D Wipe Wave Ring (`uWipe`, `#L305`, `#L604-L608`)
    const radialWipeRingMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const radialWipeRingMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.88, 1.0, 48),
      radialWipeRingMat,
    );
    radialWipeRingMesh.rotation.x = -Math.PI / 2;
    radialWipeRingMesh.position.set(0, 0.035, 0);
    radialWipeRingMesh.visible = false;
    radialWipeRingMesh.raycast = () => {};
    houseInteriorRoomGrp.add(radialWipeRingMesh);
    let houseRadialWipeRadius = -1;

    const triggerHouseRadialWipe = (hexColor = '#38bdf8', originX = 0, originZ = 0) => {
      houseRadialWipeRadius = 0.05;
      radialWipeRingMesh.position.set(originX, 0.035, originZ);
      radialWipeRingMat.color.set(hexColor);
      radialWipeRingMat.opacity = 0.92;
      radialWipeRingMesh.visible = true;
    };

    // 3. 3D Solar/Lunar Orbital Arc + Volumetric Window God-Rays & Dust Motes (`si`, `Kc`, `#L527-L551`)
    const sunArcGroup = new THREE.Group();
    houseInteriorRoomGrp.add(sunArcGroup);
    const SUN_ARC_RADIUS = 8.6;
    const SUN_ARC_TILT = -0.7;
    const sunArcCenter = new THREE.Vector3(0, 0, -0.6);
    const evalSolarArcVec = (angleRad: number, out = new THREE.Vector3()) =>
      out.set(
        -Math.cos(angleRad),
        Math.sin(angleRad) * Math.cos(SUN_ARC_TILT),
        Math.sin(angleRad) * Math.sin(SUN_ARC_TILT),
      );

    // 36 Dashed Arc Markers arching over the cutaway house
    const arcDashMat = new THREE.MeshBasicMaterial({
      color: '#fde68a',
      transparent: true,
      opacity: 0.45,
      fog: false,
    });
    for (let i = 0; i < 36; i++) {
      const a0 = (i / 35) * Math.PI;
      const p0 = sunArcCenter.clone().addScaledVector(evalSolarArcVec(a0), SUN_ARC_RADIUS);
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.035), arcDashMat);
      dash.position.copy(p0);
      dash.lookAt(
        sunArcCenter
          .clone()
          .addScaledVector(evalSolarArcVec(a0 + 0.05), SUN_ARC_RADIUS),
      );
      dash.raycast = () => {};
      sunArcGroup.add(dash);
    }

    const sunOrbMat = new THREE.MeshBasicMaterial({ color: '#ffb46c', fog: false });
    const sunOrbHaloMat = new THREE.MeshBasicMaterial({
      color: '#fde047',
      transparent: true,
      opacity: 0.35,
      fog: false,
    });
    const sunOrbGroup = new THREE.Group();
    const sunCoreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), sunOrbMat);
    const sunHaloMesh = new THREE.Mesh(new THREE.SphereGeometry(0.58, 16, 12), sunOrbHaloMat);
    sunOrbGroup.add(sunCoreMesh, sunHaloMesh);
    sunOrbGroup.traverse((c) => {
      c.raycast = () => {};
    });
    sunArcGroup.add(sunOrbGroup);

    // Volumetric Window Light Shafts + Drifting Dust/Sakura Motes (`si`, `#L527`)
    const godRayBeamMat = new THREE.MeshBasicMaterial({
      color: '#ffe0b0',
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const leftWindowBeamMesh = new THREE.Mesh(
      new THREE.ConeGeometry(1.35, 4.8, 16, 1, true),
      godRayBeamMat,
    );
    leftWindowBeamMesh.position.set(A + 1.8, 1.25, (winL.z0 + winL.z1) / 2);
    leftWindowBeamMesh.rotation.z = -Math.PI / 3;
    leftWindowBeamMesh.raycast = () => {};
    houseInteriorRoomGrp.add(leftWindowBeamMesh);

    const backWindowBeamMesh = new THREE.Mesh(
      new THREE.ConeGeometry(1.75, 5.2, 16, 1, true),
      godRayBeamMat,
    );
    backWindowBeamMesh.position.set((winB.x0 + winB.x1) / 2, 1.25, T + 2.1);
    backWindowBeamMesh.rotation.x = Math.PI / 3;
    backWindowBeamMesh.raycast = () => {};
    houseInteriorRoomGrp.add(backWindowBeamMesh);

    const DUST_MOTE_COUNT = 110;
    const dustPositions = new Float32Array(DUST_MOTE_COUNT * 3);
    const dustSeeds = Array.from({ length: DUST_MOTE_COUNT }, (_, idx) => ({
      rx: ((idx * 73) % 100) / 100,
      ry: ((idx * 41) % 100) / 100,
      rz: ((idx * 89) % 100) / 100,
      sp: 0.4 + ((idx * 29) % 60) / 100,
    }));
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: '#ffe6b8',
      size: 0.085,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    dustPoints.raycast = () => {};
    houseInteriorRoomGrp.add(dustPoints);

    // 4. 3D Floor Footprint Outline Indicators (`ui`, `#L552-L556`: Cyan when valid, Red/Orange when blocked)
    const footprintOutlineMeshes = [0, 1].map(() => {
      const grp = new THREE.Group();
      const fillMat = new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const borderMat = new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const fillPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
        fillMat,
      );
      const ringPlane = new THREE.Mesh(
        new THREE.RingGeometry(0.45, 0.5, 4).rotateX(-Math.PI / 2).rotateY(Math.PI / 4),
        borderMat,
      );
      ringPlane.position.y = 0.004;
      grp.add(fillPlane, ringPlane);
      grp.position.y = 0.025;
      grp.visible = false;
      grp.traverse((c) => {
        c.raycast = () => {};
      });
      houseInteriorRoomGrp.add(grp);
      return { grp, fillMat, borderMat };
    });

    const syncFootprintOutlines = (
      catalogId: string | null,
      x: number,
      z: number,
      ry: number,
      valid: boolean,
      visible: boolean,
    ) => {
      const obbs = catalogId && visible ? buildFurnitureFootprintObbs(catalogId, x, z, ry) : [];
      const hex = valid ? '#38bdf8' : '#ff554a';
      footprintOutlineMeshes.forEach((slot, idx) => {
        const obb = obbs[idx];
        if (!obb) {
          slot.grp.visible = false;
          return;
        }
        slot.grp.visible = true;
        slot.grp.position.set(obb.x, 0.025, obb.z);
        slot.grp.rotation.y = obb.a;
        slot.grp.scale.set(obb.hw * 2, 1, obb.hd * 2);
        slot.fillMat.color.set(hex);
        slot.borderMat.color.set(hex);
      });
    };

    // 5. Verbatim Bundled 3D Furniture Builders (`lc..Dc`, `Je`, `io`, `Ft`, `Ro`, `Eo`) from `buddies-blitz.com/interior`
    let buddiesBackgroundZonesPopulated = false;

    const buildCatalogFurnitureMesh = (catalogId: string): THREE.Group =>
      buildOriginalBuddiesCatalogFurnitureMesh(catalogId);

    // 6. Active Placed 3D Furniture Items + 120 Hz Spring-Damper Wobble Physics Container
    const placedFurnitureContainer = new THREE.Group();
    houseInteriorRoomGrp.add(placedFurnitureContainer);

    let housePlacedItems: PlacedHouseFurnitureItem[] = createInitialPlacedHouseFurniture();
    const houseFurnitureMeshMap = new Map<string, THREE.Group>();
    let selectedHouseFurnitureId: string | null = housePlacedItems[0]?.instanceId ?? null;
    let draggingHouseFurnitureId: string | null = null;
    let isOrbitingHouseCamera = false;
    let isPanningHouseCamera = false;
    let houseOrbitDragStart = { x: 0, y: 0, yaw: -0.58, pitch: 0.48, tx: -0.4, tz: -0.2 };

    // Cutaway Camera Spherical State (`Mo[0]` in buddies-blitz.com/interior: isometric cutaway angle)
    let houseCamYaw = -0.56;
    let houseCamPitch = 0.48;
    let houseCamDist = 12.6;
    const houseCamTarget = new THREE.Vector3(-0.3, 1.05, -0.2);

    const emitHouseInteriorStateToUi = () => {
      window.dispatchEvent(
        new CustomEvent('house-interior-state-updated', {
          detail: {
            placedItems: housePlacedItems.map((it) => ({ ...it })),
            selectedInstanceId: selectedHouseFurnitureId,
          },
        }),
      );
    };

    const syncHousePlacedFurnitureMeshes = () => {
      if (!buddiesBackgroundZonesPopulated) {
        buddiesBackgroundZonesPopulated = true;
        houseInteriorRoomGrp.add(buildBuddiesInteriorBackgroundZones());
      }
      const activeIds = new Set(housePlacedItems.map((it) => it.instanceId));
      for (const [id, meshGrp] of houseFurnitureMeshMap.entries()) {
        if (!activeIds.has(id)) {
          placedFurnitureContainer.remove(meshGrp);
          houseFurnitureMeshMap.delete(id);
        }
      }
      for (const item of housePlacedItems) {
        if (!houseFurnitureMeshMap.has(item.instanceId)) {
          const meshGrp = buildCatalogFurnitureMesh(item.catalogId);
          meshGrp.position.set(item.sx, item.sy, item.sz);
          meshGrp.rotation.y = item.sry;
          meshGrp.traverse((child) => {
            child.userData.houseFurnitureInstanceId = item.instanceId;
          });
          placedFurnitureContainer.add(meshGrp);
          houseFurnitureMeshMap.set(item.instanceId, meshGrp);
        }
      }
    };

    // Daylight State (`5.5 .. 23.5`, default `18.5` Golden Hour)
    let houseTargetDaylightHour = 18.5;
    let houseCurrentDaylightHour = 18.5;

    const applyHouseDaylightVisuals = (hour: number, timeSec: number) => {
      const dl = evaluateRoomDaylightState(hour);
      houseSkyBackdropMat.color.set(dl.skyTopHex);
      houseHemiLight.color.set(dl.hemiSkyHex);
      houseHemiLight.groundColor.set(dl.hemiGroundHex);
      houseHemiLight.intensity = dl.hemiIntensity * 1.65;

      houseSunLight.color.set(dl.sunColorHex);
      houseSunLight.intensity = Math.max(0.25, dl.sunIntensity * 0.72);
      houseSunLight.position.set(
        dl.sunDir.x * 16,
        Math.max(2.5, dl.sunDir.y * 16),
        dl.sunDir.z * 16,
      );

      // Update 3D Sun Orb along the tilted orbital arc (`Kc`, `#L551`)
      const clampedArcAngle = clamp(dl.sunAngleRad, 0, Math.PI);
      const orbPos = sunArcCenter
        .clone()
        .addScaledVector(evalSolarArcVec(clampedArcAngle), SUN_ARC_RADIUS);
      sunOrbGroup.position.copy(orbPos);
      sunOrbMat.color.set(dl.sunColorHex);

      // Update Interior Lamps & Plinth Underglow (`uo = dl.lampIntensity`)
      houseWarmLampPointLight.intensity = 0.25 + dl.lampIntensity * 1.45;
      lampWarmEmissiveMat.color
        .set('#d8cfbf')
        .lerp(new THREE.Color('#ffcf98'), dl.lampIntensity);

      // Update Volumetric Window God-Rays & Floating Dust Motes (`si`, `#L527`)
      const maxBeam = Math.max(dl.beamIntensityLeft, dl.beamIntensityBack);
      leftWindowBeamMesh.visible = dl.beamIntensityLeft > 0.02;
      backWindowBeamMesh.visible = dl.beamIntensityBack > 0.02;
      godRayBeamMat.color.set(dl.sunColorHex);
      godRayBeamMat.opacity = Math.min(0.26, maxBeam * 0.22);

      dustPoints.visible = maxBeam > 0.02;
      if (dustPoints.visible) {
        const posAttr = dustGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < DUST_MOTE_COUNT; i++) {
          const s = dustSeeds[i];
          const px = A + 0.6 + ((s.rx + Math.sin(timeSec * 0.15 + i) * 0.08 + 1) % 1) * (J - A - 1.2);
          const py = 0.2 + ((s.ry + timeSec * 0.02 * (s.sp - 0.5) + 1) % 1) * 2.3;
          const pz = T + 0.5 + ((s.rz + Math.cos(timeSec * 0.12 + i) * 0.08 + 1) % 1) * (N - T - 1.0);
          posAttr.setXYZ(i, px, py, pz);
        }
        posAttr.needsUpdate = true;
      }
    };
    applyHouseDaylightVisuals(houseCurrentDaylightHour, 0);

    let npcCameraMode: 'none' | 'npc_merchant' | 'house_interior' = 'none';
    let npcCameraLocation: 'lobby_cafe' | 'beach_house' = 'lobby_cafe';

    const onSyncNpcCameraMode = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{
          mode?: 'none' | 'npc_merchant' | 'house_interior';
          location?: 'lobby_cafe' | 'beach_house';
          themeId?: string;
          daylightHour?: number;
          floorSwatchId?: string;
          wallSwatchId?: string;
          slatsSwatchId?: string;
          spawnCatalogId?: string;
          rotateSelectedDelta?: number;
          removeSelected?: boolean;
          resetCamera?: boolean;
          placement?: {
            center_table: string | null;
            left_wall: string | null;
            right_wall: string | null;
            corner_plant: string | null;
            trophy_pedestal: string | null;
            rotationStepBySlot?: Record<string, number>;
          };
        }>
      ).detail;
      if (!detail) return;
      if (detail.mode) {
        npcCameraMode = detail.mode;
        houseInteriorRoomGrp.visible = detail.mode === 'house_interior';
        if (detail.mode === 'house_interior') {
          syncHousePlacedFurnitureMeshes();
        }
        resetAllPlayerMovementInputs();
        if (detail.mode !== 'house_interior') {
          draggingHouseFurnitureId = null;
          syncFootprintOutlines(null, 0, 0, 0, true, false);
        }
      }
      if (detail.location) {
        npcCameraLocation = detail.location;
      }
      if (typeof detail.daylightHour === 'number') {
        houseTargetDaylightHour = clamp(detail.daylightHour, 5.5, 23.5);
      }
      if (detail.resetCamera) {
        houseCamYaw = -0.56;
        houseCamPitch = 0.48;
        houseCamDist = 12.6;
        houseCamTarget.set(-0.3, 1.05, -0.2);
      }
      if (detail.floorSwatchId) {
        const sw = HOUSE_SURFACE_SWATCHES.find((s) => s.id === detail.floorSwatchId);
        if (sw) {
          redrawFloorTexture(
            sw.colorHex,
            sw.secondaryHex,
            sw.id.includes('slate') || sw.id.includes('gold'),
          );
          triggerHouseRadialWipe(sw.colorHex, -0.7, -1.5);
        }
      }
      if (detail.wallSwatchId) {
        const sw = HOUSE_SURFACE_SWATCHES.find((s) => s.id === detail.wallSwatchId);
        if (sw) {
          interiorWallMat.color.set(sw.colorHex);
          triggerHouseRadialWipe(sw.colorHex, -2.5, -3.5);
        }
      }
      if (detail.slatsSwatchId) {
        const sw = HOUSE_SURFACE_SWATCHES.find((s) => s.id === detail.slatsSwatchId);
        if (sw) {
          interiorTrimMat.color.set(sw.colorHex);
          BUDDIES_SLOT_MATERIALS.joinery.color.set(sw.colorHex);
          triggerHouseRadialWipe(sw.colorHex, A + 0.1, -1.8);
        }
      }
      if (detail.themeId) {
        if (detail.themeId === 'theme_cyber_neon') {
          interiorWallMat.color.set('#1e293b');
          interiorTrimMat.color.set('#00f5d4');
          BUDDIES_SLOT_MATERIALS.joinery.color.set('#35302c');
          BUDDIES_SLOT_MATERIALS.upholstery.color.set('#223257');
          BUDDIES_SLOT_MATERIALS.accent.color.set('#00f5d4');
          BUDDIES_SLOT_MATERIALS.rug.color.set('#3c3e43');
          redrawFloorTexture('#2b303a', '#00f5d4', true);
          redrawWallArtCanvas(['#0f172a', '#1e293b', '#00f5d4', '#38bdf8', '#a855f7']);
          triggerHouseRadialWipe('#00f5d4', 0, 0);
        } else if (detail.themeId === 'theme_royal_gold') {
          interiorWallMat.color.set('#fef9c3');
          interiorTrimMat.color.set('#d97706');
          BUDDIES_SLOT_MATERIALS.joinery.color.set('#c99a62');
          BUDDIES_SLOT_MATERIALS.upholstery.color.set('#ede7dc');
          BUDDIES_SLOT_MATERIALS.accent.color.set('#c48d2f');
          BUDDIES_SLOT_MATERIALS.rug.color.set('#d9ccb5');
          redrawFloorTexture('#ede6d6', '#c9a15e', true);
          redrawWallArtCanvas(['#fef9c3', '#fde047', '#d97706', '#92400e', '#f59e0b']);
          triggerHouseRadialWipe('#facc15', 0, 0);
        } else {
          interiorWallMat.color.set('#e3d2b6');
          interiorTrimMat.color.set('#7c5238');
          BUDDIES_SLOT_MATERIALS.joinery.color.set('#7c5238');
          BUDDIES_SLOT_MATERIALS.upholstery.color.set('#ede7dc');
          BUDDIES_SLOT_MATERIALS.accent.color.set('#b5613d');
          BUDDIES_SLOT_MATERIALS.rug.color.set('#d9ccb5');
          redrawFloorTexture('#c99a62', '#93612e', false);
          redrawWallArtCanvas(['#ece5d8', '#d4bf9e', '#b5613d', '#24334c', '#c48d2f']);
          triggerHouseRadialWipe('#38bdf8', 0, 0);
        }
      }
      // Spawn / Toggle a furniture item into the 3D room using Spiral Free-Spot Search (`Sr`)
      if (detail.spawnCatalogId) {
        const catId = detail.spawnCatalogId;
        const solved = solveFurnitureFreePlacement(
          null,
          catId,
          houseCamTarget.x,
          houseCamTarget.z,
          0,
          housePlacedItems,
        );
        const newInstId = `inst_${catId}_${Date.now()}`;
        const newItem = createPlacedHouseFurnitureItem(
          newInstId,
          catId,
          solved.x,
          solved.z,
          solved.ry,
          false,
        );
        housePlacedItems.push(newItem);
        selectedHouseFurnitureId = newInstId;
        syncHousePlacedFurnitureMeshes();
        syncFootprintOutlines(catId, solved.x, solved.z, solved.ry, solved.valid, true);
        emitHouseInteriorStateToUi();
      }
      // Rotate selected furniture by 45° (`Math.PI / 4`)
      if (typeof detail.rotateSelectedDelta === 'number' && selectedHouseFurnitureId) {
        const sel = housePlacedItems.find((it) => it.instanceId === selectedHouseFurnitureId);
        if (sel) {
          const nextRy = sel.ry + detail.rotateSelectedDelta * (Math.PI / 4);
          const solved = solveFurnitureFreePlacement(
            sel.instanceId,
            sel.catalogId,
            sel.x,
            sel.z,
            nextRy,
            housePlacedItems,
          );
          sel.x = solved.x;
          sel.z = solved.z;
          sel.ry = nextRy;
          sel.vy = Math.max(sel.vy, 1.35);
          syncFootprintOutlines(sel.catalogId, sel.x, sel.z, sel.ry, solved.valid, true);
          emitHouseInteriorStateToUi();
        }
      }
      // Remove selected furniture back to inventory tray
      if (detail.removeSelected && selectedHouseFurnitureId) {
        housePlacedItems = housePlacedItems.filter(
          (it) => it.instanceId !== selectedHouseFurnitureId,
        );
        selectedHouseFurnitureId = housePlacedItems[0]?.instanceId ?? null;
        syncHousePlacedFurnitureMeshes();
        syncFootprintOutlines(null, 0, 0, 0, true, false);
        emitHouseInteriorStateToUi();
      }
      // Backwards-compatible slot synchronization when slots are assigned via legacy slot buttons
      if (detail.placement) {
        const rots = detail.placement.rotationStepBySlot ?? {};
        const slotCoords: Record<string, [number, number]> = {
          center_table: [-2.6, -0.9],
          left_wall: [-4.4, -2.5],
          right_wall: [-2.4, -2.3],
          corner_plant: [0.6, -3.0],
          trophy_pedestal: [3.4, -2.4],
        };
        const nextList: PlacedHouseFurnitureItem[] = [];
        for (const [slotKey, [sx, sz]] of Object.entries(slotCoords)) {
          const cid = (detail.placement as unknown as Record<string, string | null>)[slotKey];
          if (!cid) continue;
          const ry = ((rots[slotKey] ?? 0) * Math.PI) / 2;
          const existing = housePlacedItems.find((p) => p.instanceId === `slot_${slotKey}`);
          if (existing && existing.catalogId === cid) {
            existing.x = sx;
            existing.z = sz;
            existing.ry = ry;
            nextList.push(existing);
          } else {
            const solved = solveFurnitureFreePlacement(
              `slot_${slotKey}`,
              cid,
              sx,
              sz,
              ry,
              nextList,
            );
            nextList.push(
              createPlacedHouseFurnitureItem(
                `slot_${slotKey}`,
                cid,
                solved.x,
                solved.z,
                ry,
                false,
              ),
            );
          }
        }
        housePlacedItems = nextList;
        if (!housePlacedItems.some((p) => p.instanceId === selectedHouseFurnitureId)) {
          selectedHouseFurnitureId = housePlacedItems[0]?.instanceId ?? null;
        }
        syncHousePlacedFurnitureMeshes();
        emitHouseInteriorStateToUi();
      }
    };
    window.addEventListener('sync-npc-camera-mode', onSyncNpcCameraMode);

    const createBlitzTankVehicle = (spawnX: number, spawnZ: number, isSuper: boolean, team: 'blue' | 'red'): TankVehicle => {
      const root = new THREE.Group();
      root.position.set(spawnX, getTerrainElevation(spawnX, spawnZ), spawnZ);
      scene.add(root);

      const tankScale = isSuper ? 2.75 : 2.45;
      const shadow = new THREE.Mesh(shadowDiscGeo, shadowDiscMat);
      shadow.position.y = 0.02;
      shadow.scale.set(3.4, 3.0, 1);
      root.add(shadow);

      const bodyGroup = new THREE.Group();
      root.add(bodyGroup);

      const stunMesh = createBlitzStunEffectMesh();
      stunMesh.position.set(0, 2.95, 0);
      bodyGroup.add(stunMesh);

      const turretGroup = new THREE.Group();
      turretGroup.position.set(-0.03 * tankScale, 0.82 * tankScale, 0);
      bodyGroup.add(turretGroup);

      // Open-Top Rider Mesh (Visible ONLY when a Buddy is mounted inside the Tank!)
      const riderGroup = new THREE.Group();
      riderGroup.visible = false;
      turretGroup.add(riderGroup);
      const tankRiderAvatar = new THREE.Group();
      tankRiderAvatar.position.set(-0.12, -1.02, 0);
      tankRiderAvatar.rotation.y = Math.PI / 2;
      tankRiderAvatar.scale.setScalar(1.06);
      riderGroup.add(tankRiderAvatar);
      riderGroup.userData.riderRig = buildProceduralRobloxBuddyAvatar(
        tankRiderAvatar,
        team,
        windUniforms,
        isSoftwareGl,
        true,
      );

      const barrelGroup = new THREE.Group();
      barrelGroup.position.set(1.15 * tankScale, 0.21 * tankScale, 0);
      turretGroup.add(barrelGroup);

      const muzzleFlash = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xb8ff3c }),
      );
      muzzleFlash.position.set(0.28 * tankScale, 0.04 * tankScale, 0);
      muzzleFlash.visible = false;
      barrelGroup.add(muzzleFlash);

      // Populate immediately (uses real buddy-tank.glb + buddy-track.json when loaded, or 1:1 ST-01 procedural fallback if still loading)
      populateRealBlitzTankFromGlb(
        bodyGroup,
        turretGroup,
        barrelGroup,
        riderGroup,
        muzzleFlash,
        loadedBlitzAssets?.playerGltf?.scene ?? null,
        loadedBlitzAssets?.playerTrackPoints ?? null,
        windUniforms,
        isSuper,
        isSoftwareGl,
      );

      return {
        id: nextEntityId++,
        vehicleKind: 'tank',
        isSuper,
        team,
        root,
        bodyGroup,
        turretGroup,
        barrelGroup,
        riderGroup,
        muzzleFlash,
        x: spawnX,
        z: spawnZ,
        vx: 0,
        vz: 0,
        hullYaw: -Math.PI / 2,
        turretYaw: -Math.PI / 2,
        currentDriveSpeed: BUDDIES_CONSTANTS.physics.drive.speed,
        recoilTimer: 0,
        hp: isSuper ? 60 : 40,
        maxHp: isSuper ? 60 : 40,
        storedCrates: [],
        occupiedByPlayer: false,
        occupiedByAiId: null,
        hitFlashTimer: 0,
        hitReactionTimer: 0,
        hitReactionDirX: 0,
        hitReactionDirZ: 1,
        stunTimer: 0,
        stunMesh,
        lowHpSmokeTimer: 0,
      };
    };

    const createBlitzPlaneVehicle = (spawnX: number, spawnZ: number, team: 'blue' | 'red'): TankVehicle => {
      const root = new THREE.Group();
      root.position.set(spawnX, 0, spawnZ);
      scene.add(root);

      const shadow = new THREE.Mesh(shadowDiscGeo, shadowDiscMat);
      shadow.name = 'ContactShadowDisc';
      shadow.position.y = 0.02;
      shadow.scale.set(3.6, 3.2, 1);
      root.add(shadow);

      const bodyGroup = new THREE.Group();
      root.add(bodyGroup);

      const stunMesh = createBlitzStunEffectMesh();
      stunMesh.position.set(0, 2.45, 0);
      bodyGroup.add(stunMesh);

      const turretGroup = new THREE.Group();
      bodyGroup.add(turretGroup);

      // Open-Cockpit Pilot Rider Mesh (Visible when a Buddy is piloting the BlitzPlane!)
      const riderGroup = new THREE.Group();
      riderGroup.visible = false;
      turretGroup.add(riderGroup);
      const planeRiderAvatar = new THREE.Group();
      planeRiderAvatar.position.set(-0.12, -0.96, 0);
      planeRiderAvatar.rotation.y = Math.PI / 2;
      planeRiderAvatar.scale.setScalar(1.12);
      riderGroup.add(planeRiderAvatar);
      riderGroup.userData.riderRig = buildProceduralRobloxBuddyAvatar(
        planeRiderAvatar,
        team,
        windUniforms,
        isSoftwareGl,
        true,
      );

      const barrelGroup = new THREE.Group();
      turretGroup.add(barrelGroup);

      const muzzleFlash = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xb8ff3c }),
      );
      muzzleFlash.visible = false;
      barrelGroup.add(muzzleFlash);

      buildProceduralBlitzPlane(
        bodyGroup,
        turretGroup,
        barrelGroup,
        riderGroup,
        muzzleFlash,
        windUniforms,
        isSoftwareGl,
      );
      // Initialize plane parked on the ground (altitude = 0) facing NORTH (+Math.PI / 2) up the road!
      bodyGroup.rotation.y = Math.PI / 2;
      stepBlitzPlaneAnimation(bodyGroup, 0.016, 0, 0, 0, false, 0, 0);

      return {
        id: nextEntityId++,
        vehicleKind: 'plane',
        isSuper: false,
        team,
        root,
        bodyGroup,
        turretGroup,
        barrelGroup,
        riderGroup,
        muzzleFlash,
        x: spawnX,
        z: spawnZ,
        vx: 0,
        vz: 0,
        hullYaw: Math.PI / 2,
        turretYaw: 0,
        currentDriveSpeed: BUDDIES_CONSTANTS.physics.drive.speed * 1.35,
        altitude: 0,
        targetAltitude: 0,
        verticalSpeed: 0,
        forwardSpeed: 0,
        recoilTimer: 0,
        hp: 50,
        maxHp: 50,
        storedCrates: [],
        occupiedByPlayer: false,
        occupiedByAiId: null,
        hitFlashTimer: 0,
        hitReactionTimer: 0,
        hitReactionDirX: 0,
        hitReactionDirZ: 1,
        stunTimer: 0,
        stunMesh,
        lowHpSmokeTimer: 0,
      };
    };

    const createBlitzDumpTruckVehicle = (
      spawnX: number,
      spawnZ: number,
      team: 'blue' | 'red',
      initialYaw = 0.65,
    ): TankVehicle => {
      const root = new THREE.Group();
      root.position.set(spawnX, getTerrainElevation(spawnX, spawnZ), spawnZ);
      scene.add(root);

      const shadow = new THREE.Mesh(shadowDiscGeo, shadowDiscMat);
      shadow.name = 'ContactShadowDisc';
      shadow.position.y = 0.02;
      shadow.scale.set(3.8, 2.8, 1);
      root.add(shadow);

      const bodyGroup = new THREE.Group();
      bodyGroup.rotation.y = initialYaw;
      root.add(bodyGroup);

      const stunMesh = createBlitzStunEffectMesh();
      stunMesh.position.set(0, 3.15, 0);
      bodyGroup.add(stunMesh);

      const turretGroup = new THREE.Group();
      bodyGroup.add(turretGroup);

      // Hidden Driver Container inside the HT-88 Dump Truck Cab (driver is never visible inside the enclosed cab so the head never clips through the roof)
      const riderGroup = new THREE.Group();
      riderGroup.visible = false;
      turretGroup.add(riderGroup);

      const barrelGroup = new THREE.Group();
      turretGroup.add(barrelGroup);

      const muzzleFlash = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xb8ff3c }),
      );
      muzzleFlash.visible = false;
      barrelGroup.add(muzzleFlash);

      populateRealBlitzDumpTruckFromGlb(
        bodyGroup,
        turretGroup,
        riderGroup,
        loadedBlitzAssets,
        windUniforms,
        isSoftwareGl,
      );
      syncBlitzDumpTruckCargoVisuals(bodyGroup, []);

      return {
        id: nextEntityId++,
        vehicleKind: 'truck',
        isSuper: false,
        team,
        root,
        bodyGroup,
        turretGroup,
        barrelGroup,
        riderGroup,
        muzzleFlash,
        x: spawnX,
        z: spawnZ,
        vx: 0,
        vz: 0,
        hullYaw: initialYaw,
        turretYaw: 0,
        currentDriveSpeed: BUDDIES_CONSTANTS.physics.drive.speed * 1.04,
        dumpAnimTimer: 0,
        dumpReleasedInCycle: false,
        dumpTargetMode: 'ground',
        recoilTimer: 0,
        hp: 55,
        maxHp: 55,
        storedCrates: [],
        occupiedByPlayer: false,
        occupiedByAiId: null,
        hitFlashTimer: 0,
        hitReactionTimer: 0,
        hitReactionDirX: 0,
        hitReactionDirZ: 1,
        stunTimer: 0,
        stunMesh,
        lowHpSmokeTimer: 0,
      };
    };

    // =========================================================================
    // 8. WORLD STATE: CRATES, PICKUPS, BUDDIES, TANKS, BASE HP & STACKING PADS
    // =========================================================================
    const worldCrates: WorldCrate[] = [];
    const worldPickups: WorldPickup[] = [];
    const buddyUnits: BuddyUnit[] = [];
    const tanks: TankVehicle[] = [];

    rebuildMapFromLayout(currentMapLayout);

    // Load all real bundled Blitz .glb models & .ktx2 textures via GLTFLoader + DRACOLoader + KTX2Loader
    let isDisposed = false;
    let earlyLoadedCharGltf: LoadedBlitzAssets['charBuddiesGltf'] = null;
    let earlyLoadedManGltf: LoadedBlitzAssets['manCharacterBuddiesGltf'] = null;
    loadAllRealBlitzAssets(renderer, (charGltf, manGltf) => {
      if (isDisposed) return;
      earlyLoadedCharGltf = charGltf;
      earlyLoadedManGltf = manGltf;
      const earlyCharGltf =
        getDefaultCharacterGender() === 'male' ? manGltf ?? charGltf : charGltf;
      if (earlyCharGltf && playerUnit) {
        upgradeBuddyRigWithCharBuddiesGlb(playerUnit.rig, earlyCharGltf);
        updateCharacterWeaponStance(
          playerUnit.rig,
          playerUnit.weaponId,
          playerUnit.walkCycle,
          false,
          playerUnit.carryingCrate !== 'none',
          playerUnit.saluteTimer,
          playerUnit.weaponRecoil,
        );
      }
      // Stagger remaining AI & NPC character skeleton clones across animation frames so main thread never blocks
      const pendingUnits = buddyUnits.filter((b) => !b.isPlayer);
      let staggerIdx = 0;
      const stepStaggeredUpgrades = () => {
        if (isDisposed) return;
        const activeChar =
          getDefaultCharacterGender() === 'male'
            ? earlyLoadedManGltf ?? earlyLoadedCharGltf
            : earlyLoadedCharGltf;
        if (staggerIdx < pendingUnits.length) {
          const b = pendingUnits[staggerIdx++];
          if (activeChar) {
            upgradeBuddyRigWithCharBuddiesGlb(b.rig, activeChar);
            updateCharacterWeaponStance(
              b.rig,
              b.weaponId,
              b.walkCycle,
              false,
              b.carryingCrate !== 'none',
              b.saluteTimer,
              b.weaponRecoil,
            );
          }
          requestAnimationFrame(stepStaggeredUpgrades);
        } else if (earlyLoadedCharGltf || earlyLoadedManGltf) {
          if (earlyLoadedCharGltf) {
            upgradeBuddyRigWithCharBuddiesGlb(lobbyCafeNpc.npcRig, earlyLoadedCharGltf);
          }
          const kaiEarlyGltf = earlyLoadedManGltf ?? earlyLoadedCharGltf;
          if (kaiEarlyGltf) {
            upgradeBuddyRigWithCharBuddiesGlb(beachHouseNpc.npcRig, kaiEarlyGltf);
          }
          lobbyCafeNpc.npcRig.weaponRigGroup.visible = false;
          beachHouseNpc.npcRig.weaponRigGroup.visible = false;
          if (activeChar) {
            tanks.forEach((t) => {
              if (t.riderGroup.userData.riderRig) {
                upgradeBuddyRigWithCharBuddiesGlb(t.riderGroup.userData.riderRig, activeChar);
              }
            });
          }
        }
      };
      requestAnimationFrame(stepStaggeredUpgrades);
    })
      .then((assets) => {
        if (isDisposed) return;
        loadedBlitzAssets = assets;
        document.body.dataset.assetsLoaded = 'true';

        // 1. Rebuild all trees (8-10 units tall with lush canopies), courtyard garden trees & real .glb props from currentMapLayout
        rebuildMapFromLayout(currentMapLayout);
        populateMilitaryBaseGardenTreesFromGlb(blueBase.baseGroup, assets, windUniforms, isSoftwareGl);
        populateMilitaryBaseGardenTreesFromGlb(redBase.baseGroup, assets, windUniforms, isSoftwareGl);

        // 2. Populate any active Tanks & Dump Trucks with real buddy-tank.glb or dump-truck.glb (without concrete pipes!)
        const activeCharGltf =
          getDefaultCharacterGender() === 'male'
            ? assets.manCharacterBuddiesGltf ?? assets.charBuddiesGltf
            : assets.charBuddiesGltf;
        tanks.forEach((t) => {
          if (t.riderGroup.userData.riderRig) {
            upgradeBuddyRigWithCharBuddiesGlb(
              t.riderGroup.userData.riderRig,
              activeCharGltf,
            );
          }
          if (t.vehicleKind === 'plane') return;
          if (t.vehicleKind === 'truck') {
            populateRealBlitzDumpTruckFromGlb(
              t.bodyGroup,
              t.turretGroup,
              t.riderGroup,
              assets,
              windUniforms,
              isSoftwareGl,
            );
            syncBlitzDumpTruckCargoVisuals(t.bodyGroup, t.storedCrates);
            return;
          }
          populateRealBlitzTankFromGlb(
            t.bodyGroup,
            t.turretGroup,
            t.barrelGroup,
            t.riderGroup,
            t.muzzleFlash,
            assets.playerGltf?.scene ?? null,
            assets.playerTrackPoints,
            windUniforms,
            t.isSuper,
            isSoftwareGl,
          );
        });

        // 3. Populate all active Dropped Crates, Overhead Carried Crates, and Pad Slots with real Buddies Blitz wooden-box.glb & metal-box-1a.glb!
        worldCrates.forEach((c) => {
          populateRealBlitzCrateBoxFromGlb(
            c.boxVisualGroup,
            c.kind,
            assets,
            windUniforms,
            isSoftwareGl,
            UNIFIED_WORLD_CRATE_SIZE,
          );
        });
        worldPickups.forEach((pk) => {
          pk.mesh.traverse((obj) => {
            if (obj.userData?.rifleGroupRef) {
              populateAr99AssaultFromGlb(
                obj.userData.rifleGroupRef as THREE.Group,
                assets.ar99AssaultGltf,
                isSoftwareGl,
              );
            }
          });
        });
        buddyUnits.forEach((b) => {
          upgradeBuddyRigWithCharBuddiesGlb(
            b.rig,
            activeCharGltf,
            assets.ar99AssaultGltf,
          );
          updateCharacterWeaponStance(
            b.rig,
            b.weaponId,
            b.walkCycle,
            false,
            b.carryingCrate !== 'none',
            b.saluteTimer,
            b.weaponRecoil,
          );
          if (b.isPlayer) {
            const hidePlayerHandWeapon =
              !qcForceWeaponVisible &&
              (worldModeRef.current === 'lobby' ||
                worldModeRef.current === 'safezone' ||
                cityArenaMode === 'safezone');
            if (hidePlayerHandWeapon) {
              b.rig.weaponRigGroup.visible = false;
              b.rig.pistolGroup.visible = false;
              b.rig.rifleGroup.visible = false;
              b.rig.bazookaGroup.visible = false;
              if (b.rig.laserGroup) b.rig.laserGroup.visible = false;
              if (b.rig.gatlingGroup) b.rig.gatlingGroup.visible = false;
              b.weaponMesh.visible = false;
            }
          }
          if (b.carryingCrate !== 'none') {
            populateRealBlitzCrateBoxFromGlb(
              b.overheadCrateGroup,
              b.carryingCrate,
              assets,
              windUniforms,
              isSoftwareGl,
              UNIFIED_WORLD_CRATE_SIZE,
            );
          }
        });
        upgradeBuddyRigWithCharBuddiesGlb(
          lobbyCafeNpc.npcRig,
          assets.charBuddiesGltf,
        );
        upgradeBuddyRigWithCharBuddiesGlb(
          beachHouseNpc.npcRig,
          assets.manCharacterBuddiesGltf ?? assets.charBuddiesGltf,
        );
        lobbyCafeNpc.npcRig.weaponRigGroup.visible = false;
        beachHouseNpc.npcRig.weaponRigGroup.visible = false;
        syncPadVisuals(blueBase, bluePadSlots, 'BLUE', blueBaseHp);
        syncPadVisuals(redBase, redPadSlots, 'RED', redBaseHp);

        // 4. Populate Projectile Pool with Real 3D Bullet Shells from blitz-shell.glb (Bullet_Boss, Bullet_Player, Bullet_Fodder)
        const bulletTemplates: Blitz3dBulletTemplates | null = buildRealBlitzBulletTemplates(
          assets.bulletGltf,
          windUniforms,
        );
        if (bulletTemplates) {
          for (const p of projectiles) {
            const bossShell = bulletTemplates.bossShell.clone(true);
            const playerShell = bulletTemplates.playerShell.clone(true);
            const fodderShell = bulletTemplates.fodderShell.clone(true);
            bossShell.visible = false;
            playerShell.visible = false;
            fodderShell.visible = false;
            p.mesh.add(bossShell);
            p.mesh.add(playerShell);
            p.mesh.add(fodderShell);
            p.bossShell = bossShell;
            p.playerShell = playerShell;
            p.fodderShell = fodderShell;
            p.has3dShells = true;
          }
        }

        // Optional ?tank=1 or ?truck=1 inspection flag
        if (window.location.search.includes('tank=1') && tanks.length === 0) {
          tanks.push(createBlitzTankVehicle(3.8, 12.2, false, 'blue'));
        }
      })
      .catch(() => {
        // Fallback procedural meshes remain active if optional GLB assets are unavailable
      });

    // 1. Clean Zero-Prebuilt Start: All 4 Stacking Pads per Base start completely empty (0/8 crates)
    const createEmptyPadSlots = (): CrateSlotType[] => [
      'empty',
      'empty',
      'empty',
      'empty',
      'empty',
      'empty',
      'empty',
      'empty',
    ];
    let bluePadSlotsList: CrateSlotType[][] = [
      createEmptyPadSlots(),
      createEmptyPadSlots(),
      createEmptyPadSlots(),
      createEmptyPadSlots(),
    ];
    let redPadSlotsList: CrateSlotType[][] = [
      createEmptyPadSlots(),
      createEmptyPadSlots(),
      createEmptyPadSlots(),
      createEmptyPadSlots(),
    ];
    let bluePadSlots: CrateSlotType[] = bluePadSlotsList[0];
    let redPadSlots: CrateSlotType[] = redPadSlotsList[0];
    const aiBuildOrders: BuildOrderTarget[] = ['1x1x2', '2x2x1', '2x1x1', '2x2x2'];
    let matchmakingState: Matchmaking4v4State = createMatchmaking4v4State(2, 2);
    let blueCommanderBases: IndividualCommanderBaseState[] = createIndividualCommanderBasesState('blue');
    let redCommanderBases: IndividualCommanderBaseState[] = createIndividualCommanderBasesState('red');
    let buildOrder: BuildOrderTarget = '1x1x2';
    let activePriorityRecipe: KioskBuildPriorityRecipeId = 'buddy_infantry';
    let blueBuildQueue: KioskBuildPriorityRecipeId[] = ['buddy_infantry'];
    let useCustomHologramRecipe = true;
    let gold = 1500;
    let kioskStatusMessage: string | null = null;
    let kioskStatusTimer = 0;
    let warzoneGoldSpawnTimer = 0;
    let warzoneExplosiveBarrelSpawnTimer = 0;
    let supplyDropSchedule: SupplyDropScheduleState = createInitialSupplyDropScheduleState();
    let supplyDropBeaconLingeringTimer = 0;
    let teamCommand: TeamCommandMode = 'HARVEST';
    let blueBaseHp = 2000;
    let redBaseHp = 2000;
    let score = 0;
    let bestScore = 0;
    let enemiesDefeated = 0;
    let blueBuddyClassIdx = 0;
    let mountedTank: TankVehicle | null = null;
    let ridingTramCarIdx: 0 | 1 | null = null;
    let crateSpawnTimer = 0;
    let superCrateSpawnTimer = 0;
    let legendCrateSpawnTimer = 0;
    let medicalCrateSpawnTimer = 0;
    let redCraftTimer = 0;

    // Pick a random open Warzone coordinate (outside Oasis Lake & roads) for random Warzone Drop Boxes
    const pickRandomWarzoneDropCoord = (): { x: number; z: number } => {
      for (let attempt = 0; attempt < 16; attempt++) {
        const rx = -62.0 + Math.random() * 126.0; // x in [-62.0, +64.0] across the expanded Warzone
        const rz = -42.0 + Math.random() * 84.0; // z in [-42.0, +42.0]
        if (evaluateNwLakeSdf(rx, rz) > 2.5 && evaluateRoadNetworkSdf(rx, rz) > 1.2) {
          return { x: Number(rx.toFixed(2)), z: Number(rz.toFixed(2)) };
        }
      }
      return {
        x: Number(((Math.random() - 0.5) * 32.0).toFixed(2)),
        z: Number(((Math.random() - 0.5) * 32.0).toFixed(2)),
      };
    };

    let publicWarzonePadSlotsList: CrateSlotType[][] = PUBLIC_WARZONE_CRATE_PADS.map(() =>
      createEmptyPadSlots(),
    );
    let nearSessionState: NearGamepassSessionState = createInitialNearGamepassSessionState();
    let sessionHarvesterUnitIds: number[] = [];
    let playerWarzoneLives = PLAYER_WARZONE_MAX_LIVES;
    let hasActiveBuildContract = false;
    let lobbyGoldExchangeOwnedItems: LobbyGoldExchangeItemId[] = [];
    let cityArenaMode: CityArenaMode = worldModeRef.current === 'safezone' ? 'safezone' : 'warzone';
    let qcForceWeaponVisible = false;
    let socialTalkMessage: string | null = null;
    let socialTalkTimer = 0;

    const findNearestBaseKiosk = (actorX: number, actorZ: number) => {
      let bestTeam: 'blue' | 'red' = 'blue';
      let bestPlotIdx = 0;
      let bestDist = 9999;
      let bestWorldX = 0;
      let bestWorldZ = 0;
      let isLobbyTerminal = false;

      for (const team of ['blue', 'red'] as const) {
        const baseObj = team === 'blue' ? blueBase : redBase;
        for (let idx = 0; idx < baseObj.commanderPads.length; idx++) {
          const kPos = getKioskWorldCenterForPlot(team, idx);
          const d = getPlanetShortestDistance(actorX, actorZ, kPos.x, kPos.z);
          if (d < bestDist) {
            bestDist = d;
            bestTeam = team;
            bestPlotIdx = idx;
            bestWorldX = kPos.x;
            bestWorldZ = kPos.z;
            isLobbyTerminal = false;
          }
        }
      }

      if (worldModeRef.current !== 'lobby') {
        const dLobbyTerm = getPlanetShortestDistance(
          actorX,
          actorZ,
          LOBBY_NEAR_TERMINAL_SPEC.x,
          LOBBY_NEAR_TERMINAL_SPEC.z,
        );
        if (dLobbyTerm < bestDist) {
          bestDist = dLobbyTerm;
          bestTeam = playerUnit ? playerUnit.team : 'blue';
          bestPlotIdx = 1;
          bestWorldX = LOBBY_NEAR_TERMINAL_SPEC.x;
          bestWorldZ = LOBBY_NEAR_TERMINAL_SPEC.z;
          isLobbyTerminal = true;
        }
      }

      const plotState = (bestTeam === 'blue' ? blueCommanderBases : redCommanderBases)[bestPlotIdx];
      return {
        team: bestTeam,
        plotIdx: bestPlotIdx,
        plotIndex: bestPlotIdx,
        dist: bestDist,
        distance: bestDist,
        worldX: bestWorldX,
        worldZ: bestWorldZ,
        x: bestWorldX,
        z: bestWorldZ,
        plotState,
        isLobbyTerminal,
      };
    };

    const syncPublicWarzonePadVisual = (padIdx: number) => {
      const padObj = publicWarzonePads[padIdx];
      const slots = publicWarzonePadSlotsList[padIdx];
      if (!padObj || !slots) return;
      const ev = evaluateStackingPadRecipe(slots);
      for (let i = 0; i < 8; i++) {
        const s = slots[i];
        const slotGrp = padObj.slotMeshes[i];
        if (s === 'empty') {
          slotGrp.visible = false;
        } else {
          slotGrp.visible = true;
          if (slotGrp.userData.blitzBoxKind !== s) {
            populateRealBlitzCrateBoxFromGlb(
              slotGrp,
              s,
              loadedBlitzAssets,
              windUniforms,
              isSoftwareGl,
              UNIFIED_WORLD_CRATE_SIZE,
            );
          }
        }
      }
      padObj.padSign.updateText(
        ev.totalCrates === 0
          ? padObj.spec.label
          : `${padObj.spec.label} · ${ev.outputName.toUpperCase()}`,
        ev.totalCrates === 0
          ? 'PUBLIC PAD (NO KIOSK) · [E] STACK CRATES MANUALLY'
          : `[F] KICK CRAFT (${ev.totalCrates}/8 CRATES) · FREE-TO-PLAY`,
        ev.legendCount > 0 ? '#ffd700' : ev.isSuper ? '#00d2ff' : '#facc15',
        clamp(ev.totalCrates / 8, 0, 1),
      );
    };

    const syncSingleCommanderPadVisual = (
      padMeshObj: ReturnType<typeof buildSingleStackingPadMesh>,
      slots: CrateSlotType[],
      isBlue: boolean,
      commanderIdx: number,
      activeOrder: BuildOrderTarget,
    ) => {
      const ev = evaluateStackingPadRecipe(slots);
      const orderSpec = BUILD_ORDER_SPECS[activeOrder];
      const plotState = (isBlue ? blueCommanderBases : redCommanderBases)[commanderIdx];
      const isSafezone = cityArenaMode === 'safezone';
      const isPlotActive = isCommanderBasePlotActive(plotState);
      padMeshObj.padGroup.visible = true;
      padMeshObj.kioskMesh.visible = true;
      padMeshObj.padStaticGroup.visible = !isSafezone && isPlotActive;
      padMeshObj.padSign.sprite.visible = !isSafezone;
      const isLocalPlayerPad =
        (isBlue && commanderIdx === 0) || Boolean(plotState?.isClaimedOnlineSession);
      const holoState = evaluatePadHologramState(
        !isSafezone && isLocalPlayerPad && isPlotActive,
        useCustomHologramRecipe,
        activePriorityRecipe,
        slots,
      );

      if (!isSafezone && isPlotActive && holoState.showPatternOutlineBox) {
        padMeshObj.ghostPatternBox.visible = true;
        padMeshObj.ghostPatternBox.scale.set(
          orderSpec.ghostBoxSize[0],
          orderSpec.ghostBoxSize[1],
          orderSpec.ghostBoxSize[2],
        );
        padMeshObj.ghostPatternBox.position.set(
          orderSpec.ghostBoxCenter[0],
          orderSpec.ghostBoxCenter[1],
          orderSpec.ghostBoxCenter[2],
        );
      } else {
        padMeshObj.ghostPatternBox.visible = false;
      }

      for (let i = 0; i < 8; i++) {
        const s = slots[i];
        const slotGrp = padMeshObj.slotMeshes[i];
        const ghostMesh = padMeshObj.ghostSlotMeshes[i];
        const requiredSlotKind: CrateSlotType = holoState.slotGhostColors[i];
        const isAllowedInPattern = !isSafezone && isPlotActive && requiredSlotKind !== 'empty';

        if (isSafezone || !isPlotActive || s === 'empty') {
          slotGrp.visible = false;
          ghostMesh.visible = isAllowedInPattern;
          if (isAllowedInPattern) {
            const holoHex = getHologramSlotHexColor(requiredSlotKind);
            (ghostMesh.material as THREE.MeshBasicMaterial).color.setHex(holoHex);
            const coreMat = ghostMesh.userData.coreMat as THREE.MeshBasicMaterial | undefined;
            if (coreMat) {
              coreMat.color.setHex(holoHex);
            }
          }
        } else {
          slotGrp.visible = true;
          if (slotGrp.userData.blitzBoxKind !== s) {
            populateRealBlitzCrateBoxFromGlb(
              slotGrp,
              s,
              loadedBlitzAssets,
              windUniforms,
              isSoftwareGl,
              UNIFIED_WORLD_CRATE_SIZE,
            );
          }
          ghostMesh.visible = false;
        }
      }

      padMeshObj.mergedCage.visible = !isSafezone && isPlotActive && ev.isMerged;
      const activeRecipeSpec =
        isLocalPlayerPad && useCustomHologramRecipe
          ? KIOSK_BUILD_PRIORITY_RECIPES[activePriorityRecipe]
          : null;
      const targetMax = activeRecipeSpec ? activeRecipeSpec.targetCrates : orderSpec.targetCrates;
      const activeLabel = activeRecipeSpec ? activeRecipeSpec.name : orderSpec.label;
      const cmdSlot = (isBlue ? matchmakingState.blueCommanders : matchmakingState.redCommanders)[commanderIdx];
      const bLv = plotState ? `LV.${plotState.buildingLevel}` : 'LV.1';
      const fLv = plotState ? `FENCE LV.${plotState.fenceLevel}` : 'FENCE LV.1';
      const slotTag = cmdSlot
        ? `BASE ${isBlue ? 'P' : 'R'}${commanderIdx + 1} (${bLv} · ${fLv})`
        : `BASE ${isBlue ? 'P' : 'R'}${commanderIdx + 1}`;
      const isBaseUpgradeOrder =
        activeOrder === 'upgrade_building' ||
        activeOrder === 'upgrade_fence' ||
        activeOrder === 'build_parking' ||
        activeOrder === 'build_helipad';
      padMeshObj.padSign.updateText(
        !isPlotActive
          ? `EMPTY PLOT ${isBlue ? 'BLUE' : 'RED'} #${commanderIdx + 1}`
          : ev.totalCrates === 0
          ? isLocalPlayerPad
            ? useCustomHologramRecipe
              ? `BASE ${isBlue ? 'P' : 'R'}${commanderIdx + 1} (${bLv}) [B/Q] ${activeLabel.toUpperCase()}`
              : `BASE ${isBlue ? 'P' : 'R'}${commanderIdx + 1} (${bLv}) · SELECT TARGET [B/Q]`
            : slotTag
          : `${slotTag} · ${isBaseUpgradeOrder ? orderSpec.label.toUpperCase() : ev.outputName.toUpperCase()}`,
        !isPlotActive
          ? `PRESS [B] AT KIOSK TERMINAL TO CLAIM SESSION BASE`
          : ev.totalCrates === 0
          ? isLocalPlayerPad && !useCustomHologramRecipe
            ? `SELECT RECIPE IN KIOSK [B] · [E] LOAD PAD`
            : `0/${targetMax} CRATES · [B] KIOSK · [E] LOAD PAD`
          : `[F] KICK CANCEL (${ev.totalCrates}/${targetMax} CRATES) · [B] KIOSK`,
        !isPlotActive ? '#38bdf8' : ev.legendCount > 0 ? '#ffd700' : ev.isSuper ? '#00d2ff' : '#b4ff39',
        !isPlotActive ? 0 : clamp(ev.totalCrates / Math.max(1, targetMax), 0, 1),
      );

      // Update Kiosk Side Platform 3D Hologram Shape + Progress Counter
      const kioskHoloState = evaluateKioskSideHologramDisplay(
        !isSafezone && isLocalPlayerPad && isPlotActive ? useCustomHologramRecipe : false,
        activePriorityRecipe,
        activeOrder,
        slots,
        !isSafezone && isLocalPlayerPad && isPlotActive ? blueBuildQueue : [],
      );
      const sideHolo = padMeshObj.kioskMesh?.userData?.sideHologram as
        | {
            holoRoot: THREE.Group;
            holoTurntable: THREE.Group;
            holoModels: Record<KioskSideHologramModelKind, THREE.Group>;
            holoSolidMat: THREE.MeshBasicMaterial;
            holoWireMat: THREE.MeshBasicMaterial;
            holoRingMat: THREE.MeshBasicMaterial;
            holoBeamMat: THREE.MeshBasicMaterial;
            activeModelKind: KioskSideHologramModelKind;
          }
        | undefined;
      if (sideHolo) {
        sideHolo.holoRoot.visible = !isSafezone && isPlotActive && kioskHoloState.visible;
        for (const [mKey, mGrp] of Object.entries(sideHolo.holoModels)) {
          mGrp.visible = mKey === kioskHoloState.modelKind;
        }
        sideHolo.activeModelKind = kioskHoloState.modelKind;
        sideHolo.holoSolidMat.color.setHex(kioskHoloState.hologramColorInt);
        sideHolo.holoWireMat.color.setHex(kioskHoloState.hologramColorInt);
        sideHolo.holoRingMat.color.setHex(kioskHoloState.hologramColorInt);
        sideHolo.holoBeamMat.color.setHex(kioskHoloState.hologramColorInt);
      }
      if (padMeshObj.kioskHoloSign) {
        if (isSafezone) {
          const accessLabel = (plotState?.safezoneAccessMode ?? 'PUBLIC').replace('_', ' ');
          padMeshObj.kioskHoloSign.updateText(
            `PLOT ${isBlue ? 'BLUE' : 'RED'} #${commanderIdx + 1}`,
            isPlotActive ? `ACCESS: ${accessLabel} · [B] SETTINGS` : '[B] CLAIM PLOT',
            '#10b981',
            1,
          );
        } else if (!isPlotActive) {
          padMeshObj.kioskHoloSign.updateText(
            `KAVLING ${isBlue ? 'BIRU' : 'MERAH'} #${commanderIdx + 1}`,
            '[B] CLAIM NEAR BASE',
            '#00ec97',
            1,
          );
        } else {
          padMeshObj.kioskHoloSign.updateText(
            kioskHoloState.titleText,
            kioskHoloState.subtitleText,
            kioskHoloState.hologramHexColor,
            kioskHoloState.progressRatio,
          );
        }
      }
    };

    const syncPadVisuals = (
      baseObj: ReturnType<typeof buildBaseHqAndPad>,
      slots: CrateSlotType[],
      teamLabel: string,
      hp: number,
    ) => {
      const isBlue = teamLabel === 'BLUE';
      const isSafezone = cityArenaMode === 'safezone';
      if (isBlue) {
        bluePadSlotsList[0] = slots;
        bluePadSlots = bluePadSlotsList[0];
        for (let idx = 0; idx < 4; idx++) {
          if (baseObj.commanderPads[idx]) {
            syncSingleCommanderPadVisual(
              baseObj.commanderPads[idx],
              bluePadSlotsList[idx],
              true,
              idx,
              buildOrder,
            );
          }
        }
        syncMilitaryBasePlotsVisuals(baseObj.baseGroup, blueCommanderBases, 'blue', isSafezone);
      } else {
        redPadSlotsList[0] = slots;
        redPadSlots = redPadSlotsList[0];
        for (let idx = 0; idx < 4; idx++) {
          if (baseObj.commanderPads[idx]) {
            syncSingleCommanderPadVisual(
              baseObj.commanderPads[idx],
              redPadSlotsList[idx],
              false,
              idx,
              buildOrder,
            );
          }
        }
        syncMilitaryBasePlotsVisuals(baseObj.baseGroup, redCommanderBases, 'red', isSafezone);
      }
      for (let pi = 0; pi < publicWarzonePads.length; pi++) {
        syncPublicWarzonePadVisual(pi);
        publicWarzonePads[pi].padGroup.visible = !isSafezone;
      }
      baseObj.hpSign.sprite.visible = !isSafezone;
      baseObj.hpSign.updateText(
        `${teamLabel} ESTATE`,
        `${hp} TOTAL HP`,
        isBlue ? '#00d2ff' : '#ff3b30',
        clamp(hp / 2000, 0, 1),
      );
    };

    const spawnWorldCrate = (
      kind: WorldCrateKind,
      x: number,
      z: number,
      startGrounded = false,
      forceSpawn = startGrounded,
    ): WorldCrate | null => {
      const isSpecialMetallic = kind === 'silver_metallic' || kind === 'gold_metallic';
      if (!isSpecialMetallic && !forceSpawn && !startGrounded && worldCrates.length >= 38) {
        return null;
      }
      const wx = wrapPlanetCoord(x);
      const wz = wrapPlanetCoord(z);
      const groundY = getTerrainElevation(wx, wz) + 0.66;
      const g = new THREE.Group();
      const startY = startGrounded ? groundY : groundY + 16 + Math.random() * 4;
      g.position.set(wx, startY, wz);
      scene.add(g);

      const boxVisualGroup = new THREE.Group();
      g.add(boxVisualGroup);

      addOutlinedPart(
        boxVisualGroup,
        new THREE.BoxGeometry(
          UNIFIED_WORLD_CRATE_SIZE,
          UNIFIED_WORLD_CRATE_SIZE,
          UNIFIED_WORLD_CRATE_SIZE,
        ),
        getCrateFallbackMaterial(kind),
        [0, 0, 0],
      );
      populateRealBlitzCrateBoxFromGlb(
        boxVisualGroup,
        kind,
        loadedBlitzAssets,
        windUniforms,
        isSoftwareGl,
        UNIFIED_WORLD_CRATE_SIZE,
      );

      // White Parachute dome while falling
      const chuteGeo = new THREE.SphereGeometry(1.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const parachuteMesh = new THREE.Mesh(chuteGeo, matWhite);
      parachuteMesh.position.set(0, 1.6, 0);
      parachuteMesh.visible = !startGrounded;
      g.add(parachuteMesh);

      const createdCrate: WorldCrate = {
        id: nextEntityId++,
        kind,
        indestructible: isSpecialMetallic,
        mesh: g,
        boxVisualGroup,
        parachuteMesh,
        x: wx,
        y: startY,
        z: wz,
        vx: 0,
        vy: 0,
        vz: 0,
        rotY: 0,
        rotVelY: 0,
        hp: isSpecialMetallic ? 999999 : kind === 'legend' ? 45 : kind === 'super' ? 35 : 22,
        state: startGrounded ? 'grounded' : 'falling',
        carrierId: null,
        squashTimer: 0,
      };
      worldCrates.push(createdCrate);
      return createdCrate;
    };

    interface SpawnWorldPickupOptions {
      weaponId?: 'pistol' | 'rifle' | 'rocket';
      vx?: number;
      vy?: number;
      vz?: number;
      remainingAmmo?: number;
      secondaryId?: Exclude<BuddySecondaryItemId, 'none'>;
      secondaryCount?: number;
      missionItemId?: Exclude<BuddyMissionItemId, 'none'>;
      scoreValue?: number;
      healAmount?: number;
      hp?: number;
      isFromDeathDrop?: boolean;
      despawnTimerSec?: number;
    }

    const spawnWorldPickup = (
      kind: WorldPickup['kind'],
      weaponName: string,
      x: number,
      z: number,
      options?: SpawnWorldPickupOptions,
    ) => {
      const wx = wrapPlanetCoord(x);
      const wz = wrapPlanetCoord(z);
      const baseY = getTerrainElevation(wx, wz) + 0.75;
      const startY = (options?.vy ?? 0) > 0 ? baseY + 0.35 : baseY;
      const g = new THREE.Group();
      g.position.set(wx, startY, wz);
      scene.add(g);

      if (
        kind === 'coin_gold' ||
        kind === 'coin_silver' ||
        kind === 'secondary' ||
        kind === 'mission_item' ||
        kind === 'health'
      ) {
        const subId = options?.secondaryId ?? options?.missionItemId;
        const dropModel = buildTeamBuddiesDropPickupMesh(kind, subId, windUniforms, isSoftwareGl);
        g.add(dropModel);
      } else if (kind === 'ammo') {
        addOutlinedPart(g, new THREE.BoxGeometry(0.75, 0.55, 0.55), matYellow, [0, 0, 0]);
      } else if (kind === 'powerup') {
        addOutlinedPart(g, new THREE.IcosahedronGeometry(0.62, 0), matTankHighlight, [0, 0, 0]);
      } else {
        // 3D Crafted or Dropped Weapon Pickup on a glowing pedestal displaying the actual 3D weapon model!
        addOutlinedPart(g, new THREE.CylinderGeometry(0.7, 0.8, 0.16, 12), matYellow, [0, -0.55, 0]);
        const weaponModel = buildCraftedWeaponPickupMesh(weaponName, windUniforms, isSoftwareGl);
        g.add(weaponModel);
      }

      const totalLife =
        options?.despawnTimerSec ??
        (options?.isFromDeathDrop
          ? TEAM_BUDDIES_WEAPON_DESPAWN_SEC
          : kind === 'weapon'
          ? TEAM_BUDDIES_CRAFTED_WEAPON_DESPAWN_SEC
          : 0);

      worldPickups.push({
        id: nextEntityId++,
        kind,
        weaponName,
        mesh: g,
        x: wx,
        y: startY,
        z: wz,
        vx: options?.vx ?? 0,
        vy: options?.vy ?? 0,
        vz: options?.vz ?? 0,
        bobPhase: Math.random() * Math.PI * 2,
        collected: false,
        remainingAmmo: options?.remainingAmmo,
        secondaryId: options?.secondaryId,
        secondaryCount: options?.secondaryCount,
        missionItemId: options?.missionItemId,
        scoreValue: options?.scoreValue,
        healAmount: options?.healAmount,
        hp: options?.hp ?? 18,
        isFromDeathDrop: Boolean(options?.isFromDeathDrop || totalLife > 0),
        lifeRemainingSec: totalLife > 0 ? totalLife : 999999,
        totalLifeSec: totalLife,
      });
    };

    const syncUnitFieldsFromLoadout = (u: BuddyUnit) => {
      const ld = u.tacticalLoadout;
      if (ld.activeWeaponSlotId === 'unarmed' || ld.handheldWeapons.length === 0) {
        u.weaponId = 'unarmed';
        u.weaponName = 'Unarmed (Fists)';
        u.ammo = 0;
      } else {
        const activeSlot =
          ld.handheldWeapons.find((w) => w.slotId === ld.activeWeaponSlotId && w.ammo > 0) ??
          ld.handheldWeapons.find((w) => w.ammo > 0);
        if (activeSlot) {
          ld.activeWeaponSlotId = activeSlot.slotId;
          u.weaponId = activeSlot.slotId;
          u.weaponName = activeSlot.weaponName;
          u.ammo = activeSlot.ammo;
        } else {
          ld.activeWeaponSlotId = 'unarmed';
          u.weaponId = 'unarmed';
          u.weaponName = 'Unarmed (Fists)';
          u.ammo = 0;
        }
      }
      if (ld.clusterBombCount > 0) {
        u.secondaryItem = 'cluster_bomb';
        u.secondaryCount = ld.clusterBombCount;
      } else if (ld.grenadeCount > 0) {
        u.secondaryItem = 'hand_grenade';
        u.secondaryCount = ld.grenadeCount;
      } else if (ld.landMineCount > 0) {
        u.secondaryItem = 'land_mine';
        u.secondaryCount = ld.landMineCount;
      } else {
        u.secondaryItem = 'none';
        u.secondaryCount = 0;
      }
    };

    const spawnWarzoneExplosiveBarrel = (x: number, z: number, startGrounded = false) => {
      const wx = wrapPlanetCoord(x);
      const wz = wrapPlanetCoord(z);
      const propId = nextEntityId++;
      const rotY = Math.random() * Math.PI * 2;
      const baseH = getPropBaseHeight('explosive_barrel');

      let wrapper: THREE.Group | null = null;
      if (loadedBlitzAssets?.explosiveBarrelGltf) {
        wrapper = spawnRealBlitzPropFromGlb(
          realPropsGroup,
          loadedBlitzAssets.explosiveBarrelGltf,
          wx,
          wz,
          rotY,
          baseH,
          windUniforms,
          isSoftwareGl,
        );
      }
      if (!wrapper) {
        wrapper = new THREE.Group();
        addOutlinedPart(
          wrapper,
          new THREE.CylinderGeometry(0.46, 0.46, 1.18, 12),
          new THREE.MeshToonMaterial({ color: '#e11d48' }),
          [0, 0.59, 0],
        );
        addOutlinedPart(
          wrapper,
          new THREE.CylinderGeometry(0.48, 0.48, 0.22, 12),
          matYellow,
          [0, 0.62, 0],
        );
        wrapper.position.set(wx, getTerrainElevation(wx, wz), wz);
        wrapper.rotation.y = rotY;
        realPropsGroup.add(wrapper);
      }

      const startAlt = startGrounded ? 0 : 18.5;
      wrapper.userData.propId = propId;
      wrapper.userData.worldX = wx;
      wrapper.userData.worldZ = wz;
      wrapper.userData.baseRotY = rotY;
      wrapper.userData.dropAltitudeY = startAlt;

      const parachuteMesh = new THREE.Mesh(
        new THREE.ConeGeometry(1.15, 0.72, 10, 1, true),
        new THREE.MeshToonMaterial({ color: '#ff3b30', side: THREE.DoubleSide }),
      );
      parachuteMesh.position.y = 2.05;
      parachuteMesh.rotation.x = Math.PI;
      parachuteMesh.visible = !startGrounded;
      wrapper.add(parachuteMesh);

      const colSpec = getPropCollisionSpec('explosive_barrel', 1.0);
      activeMapProps.push({
        id: propId,
        kind: 'explosive_barrel',
        wrapper,
        x: wx,
        z: wz,
        vx: 0,
        vz: 0,
        rotY,
        rotVelY: 0,
        scale: 1.0,
        category: colSpec.category,
        materialTag: colSpec.materialTag,
        radius: colSpec.radius,
        heightY: 1.5,
        mass: colSpec.mass,
        restitution: colSpec.restitution,
        destructible: colSpec.destructible,
        hp: colSpec.maxHp,
        maxHp: colSpec.maxHp,
        shootImpulse: colSpec.shootImpulse,
        canJiggleOnHit: colSpec.canJiggleOnHit,
        alive: true,
        jiggleTimer: 0,
        jiggleDirX: 0,
        jiggleDirZ: 1,
        isWarzoneDropBarrel: true,
        fallingFromSky: !startGrounded,
        y: getTerrainElevation(wx, wz) + startAlt,
        vy: startGrounded ? 0 : -8.5,
        parachuteMesh,
      });
    };

    /**
     * Team Buddies (PS1) Battlefield Death Item Drop Handler:
     * - Drops held Primary Weapon with its exact `remainingAmmo` (bouncing onto the ground)
     * - Drops Gold / Silver Coins + Ammo Refill Pack when an enemy is killed
     * - Refills player's carried weapon ammo upon enemy defeat
     * - Throws any carried overhead Crate, Secondary Grenade/Bomb/Mine, or Mission Object intact onto the ground
     * - NEVER drops a Medkit from a corpse (`Tidak Ada Drop Medkit dari Mayat`)!
     */
    const handleBuddyDeathDrops = (victim: BuddyUnit, killedByChainExplosion = false) => {
      if (
        victim.team === 'red' &&
        playerUnit &&
        playerUnit.alive &&
        cityArenaMode === 'warzone' &&
        worldModeRef.current === 'warzone' &&
        !isPointInsideLobbySafezone(playerUnit.x, playerUnit.z)
      ) {
        playerUnit.tacticalLoadout = refillLoadoutAmmoFromSource(
          playerUnit.tacticalLoadout,
          'enemy_kill',
        );
        syncUnitFieldsFromLoadout(playerUnit);
      }

      const drops = evaluateTeamBuddiesDeathDrops({
        weaponId:
          victim.weaponId === 'bazooka'
            ? 'rocket'
            : victim.weaponId === 'rifle'
              ? 'rifle'
              : victim.weaponId === 'pistol'
                ? 'pistol'
                : 'unarmed',
        ammo: victim.ammo,
        carryingCrate: victim.carryingCrate,
        secondaryItem: victim.secondaryItem,
        secondaryCount: victim.secondaryCount,
        missionItem: victim.missionItem,
        isEnemyKill: victim.team === 'red',
        classId: victim.classId,
        killedByChainExplosion,
      });

      // Clear carried items from the fallen character
      victim.carryingCrate = 'none';
      victim.overheadCrateGroup.visible = false;
      victim.secondaryItem = 'none';
      victim.secondaryCount = 0;
      victim.missionItem = 'none';

      for (const d of drops) {
        const dropX = wrapPlanetCoord(victim.x + d.offsetX);
        const dropZ = wrapPlanetCoord(victim.z + d.offsetZ);
        if (d.kind === 'crate' && d.crateKind) {
          spawnWorldCrate(d.crateKind, dropX, dropZ, true);
          const droppedCrate = worldCrates[worldCrates.length - 1];
          if (droppedCrate) {
            droppedCrate.vx = d.vx;
            droppedCrate.vy = d.vy;
            droppedCrate.vz = d.vz;
            droppedCrate.rotVelY = (Math.random() - 0.5) * 6.5;
            droppedCrate.hp = d.hp;
          }
        } else if (d.kind !== 'crate') {
          spawnWorldPickup(d.kind, d.label, dropX, dropZ, {
            vx: d.vx,
            vy: d.vy,
            vz: d.vz,
            remainingAmmo: d.remainingAmmo,
            secondaryId: d.secondaryId,
            secondaryCount: d.secondaryCount,
            missionItemId: d.missionItemId,
            scoreValue: d.scoreValue,
            hp: d.hp,
            isFromDeathDrop: d.despawnTimerSec > 0,
            despawnTimerSec: d.despawnTimerSec,
          });
        }
      }

      if (victim.team === 'red' && !killedByChainExplosion) {
        spawnWorldPickup(
          'ammo',
          'AMMO PACK (+40 ROUNDS)',
          wrapPlanetCoord(victim.x + (Math.random() - 0.5) * 1.4),
          wrapPlanetCoord(victim.z + (Math.random() - 0.5) * 1.4),
          {
            vx: (Math.random() - 0.5) * 2.8,
            vy: 4.8,
            vz: (Math.random() - 0.5) * 2.8,
            remainingAmmo: 40,
          },
        );
        if (Math.random() < 0.55) {
          const dropGrenade = Math.random() < 0.55;
          spawnWorldPickup(
            'secondary',
            dropGrenade ? 'HG-04 Frag Grenade' : 'TM-89 Land Mine',
            wrapPlanetCoord(victim.x + (Math.random() - 0.5) * 1.6),
            wrapPlanetCoord(victim.z + (Math.random() - 0.5) * 1.6),
            {
              secondaryId: dropGrenade ? 'hand_grenade' : 'land_mine',
              secondaryCount: 2,
              vx: (Math.random() - 0.5) * 2.8,
              vy: 4.9,
              vz: (Math.random() - 0.5) * 2.8,
            },
          );
        }
      }
    };

    const rewardPlayerOnCrateDestroyed = (cx: number, cz: number) => {
      if (playerUnit && playerUnit.alive) {
        playerUnit.tacticalLoadout = refillLoadoutAmmoFromSource(
          playerUnit.tacticalLoadout,
          'crate_destroy',
        );
        syncUnitFieldsFromLoadout(playerUnit);
      }
      spawnWorldPickup(
        'ammo',
        'AMMO PACK (+40 ROUNDS)',
        wrapPlanetCoord(cx + (Math.random() - 0.5) * 1.1),
        wrapPlanetCoord(cz + (Math.random() - 0.5) * 1.1),
        {
          vx: (Math.random() - 0.5) * 2.6,
          vy: 4.8,
          vz: (Math.random() - 0.5) * 2.6,
          remainingAmmo: 40,
        },
      );
      if (Math.random() < 0.45) {
        const dropGrenade = Math.random() < 0.55;
        spawnWorldPickup(
          'secondary',
          dropGrenade ? 'HG-04 Frag Grenade' : 'TM-89 Land Mine',
          wrapPlanetCoord(cx + (Math.random() - 0.5) * 1.3),
          wrapPlanetCoord(cz + (Math.random() - 0.5) * 1.3),
          {
            secondaryId: dropGrenade ? 'hand_grenade' : 'land_mine',
            secondaryCount: 2,
            vx: (Math.random() - 0.5) * 2.8,
            vy: 5.0,
            vz: (Math.random() - 0.5) * 2.8,
          },
        );
      }
    };

    // Player Buddy (Commander 0 / P1) + Dynamic Mode Switching (SANDBOX = NO NPCs, EDITOR = NO NPCs, MATCH = 4v4 WITH AI)
    let playerUnit = createBuddyCharacterUnit('blue', true, 'Infuntry', -16.5, 71.0, 0, true);
    buddyUnits.push(playerUnit);

    const clearAllNonPlayerNpcs = () => {
      for (let i = buddyUnits.length - 1; i >= 0; i--) {
        const b = buddyUnits[i];
        if (!b.isPlayer) {
          for (const t of tanks) {
            if (t.occupiedByAiId === b.id) {
              t.occupiedByAiId = null;
              if (!t.occupiedByPlayer) t.riderGroup.visible = false;
            }
          }
          scene.remove(b.root);
          buddyUnits.splice(i, 1);
        }
      }
    };

    const ensureMatchAiSquadsSpawned = () => {
      // Emptied base plots have no static spawn points; in Match mode, spawn enemy combatants in the open Warzone
      const redClasses: BuddyClassId[] = ['Infuntry', 'Commando', 'Ninja', 'Medic'];
      for (let cmdId = 0; cmdId < COMMANDERS_PER_TEAM; cmdId++) {
        const hasRedCmdUnit = buddyUnits.some(
          (b) => b.team === 'red' && b.ownerCommanderId === cmdId && b.alive,
        );
        if (!hasRedCmdUnit) {
          const dropSpot = pickRandomWarzoneDropCoord();
          buddyUnits.push(
            createBuddyCharacterUnit(
              'red',
              false,
              redClasses[cmdId % redClasses.length],
              dropSpot.x,
              dropSpot.z,
              cmdId,
              false,
            ),
          );
        }
      }
    };

    const activeLaserBeams: ActiveLaserBeam3D[] = [];
    const activeOrdnanceDevices: ActiveOrdnanceDevice3D[] = [];
    let cachedStaticWorldStructures: StaticWorldStructureObb[] | null = null;
    let cachedStaticWorldStructuresKey = '';
    let snapCameraAndStartSpawnBlink: (unit: BuddyUnit) => void = (unit) => {
      unit.invincibilityTimer = PLAYER_SPAWN_BLINK_DURATION_SEC;
    };

    const spawnInitialSquadsAndObjects = () => {
      // Clear any old dynamic meshes
      worldCrates.forEach((c) => scene.remove(c.mesh));
      worldCrates.length = 0;
      worldPickups.forEach((p) => scene.remove(p.mesh));
      worldPickups.length = 0;
      buddyUnits.forEach((b) => scene.remove(b.root));
      buddyUnits.length = 0;
      tanks.forEach((t) => scene.remove(t.root));
      tanks.length = 0;
      for (let bi = activeMapProps.length - 1; bi >= 0; bi--) {
        if (activeMapProps[bi].isWarzoneDropBarrel) {
          realPropsGroup.remove(activeMapProps[bi].wrapper);
          activeMapProps.splice(bi, 1);
        }
      }
      warzoneExplosiveBarrelSpawnTimer = 0;
      collisionCooldownMap.clear();

      // 1. Clean Zero-Prebuilt Start: All 4 Stacking Pads per Base start at 0/8 crates, and 4v4 Matchmaking starts with 2 Human + 2 AI per team
      bluePadSlotsList = [
        createEmptyPadSlots(),
        createEmptyPadSlots(),
        createEmptyPadSlots(),
        createEmptyPadSlots(),
      ];
      redPadSlotsList = [
        createEmptyPadSlots(),
        createEmptyPadSlots(),
        createEmptyPadSlots(),
        createEmptyPadSlots(),
      ];
      bluePadSlots = bluePadSlotsList[0];
      redPadSlots = redPadSlotsList[0];
      matchmakingState = createMatchmaking4v4State(2, 2);
      blueCommanderBases = createIndividualCommanderBasesState('blue');
      redCommanderBases = createIndividualCommanderBasesState('red');
      blueBaseHp = 2000;
      redBaseHp = 2000;
      score = 0;
      gold = playModeRef.current === 'sandbox' ? 2500 : 1200;
      playerWarzoneLives = PLAYER_WARZONE_MAX_LIVES;
      activePriorityRecipe = Object.keys(
        KIOSK_BUILD_PRIORITY_RECIPES,
      )[0] as KioskBuildPriorityRecipeId;
      blueBuildQueue = [];
      useCustomHologramRecipe = false;
      hasActiveBuildContract = false;
      kioskStatusMessage = null;
      kioskStatusTimer = 0;
      supplyDropSchedule = createInitialSupplyDropScheduleState();
      supplyDropBeaconLingeringTimer = 0;
      supplyDropBeaconGroup.visible = false;
      enemiesDefeated = 0;
      mountedTank = null;
      ridingTramCarIdx = null;

      const initWorldMode = worldModeRef.current;
      const isPeacefulWorld = initWorldMode === 'safezone' || initWorldMode === 'lobby';
      cityArenaMode = isPeacefulWorld ? 'safezone' : 'warzone';
      if (promptOverlay) {
        promptOverlay.setAttribute('data-city-arena-mode', cityArenaMode);
        promptOverlay.setAttribute('data-world-mode', initWorldMode);
      }

      // 2. Skyshield Turrets: enabled ONLY in Warzone mode; disabled in Safezone and Lobby modes!
      for (const bGroup of [blueBase.baseGroup, redBase.baseGroup]) {
        const turrets = getBaseSkyshieldTurrets(bGroup);
        turrets.forEach((st) => {
          st.isBuilt = initWorldMode === 'warzone';
          st.maxHp = 280;
          st.hp = 280;
          st.root.visible = initWorldMode === 'warzone';
        });
      }

      // 3. Main Player Character initialization based on Clean Scene Remount worldMode ('lobby' | 'warzone' | 'safezone')
      const startTeam = initialTeamRef.current ?? 'blue';
      let startX = blueBase.commanderPads[0].padX - 3.6;
      let startZ = blueBase.commanderPads[0].padZ - 2.8;
      let startYaw = 0;
      if (initWorldMode === 'lobby') {
        startX = LOBBY_SAFEZONE_BOUNDS.spawnX;
        startZ = LOBBY_SAFEZONE_BOUNDS.spawnZ;
        startYaw = Math.PI;
      } else if (initWorldMode === 'safezone') {
        startX = SAFEZONE_CITY_HALTE_SPAWN.x;
        startZ = SAFEZONE_CITY_HALTE_SPAWN.z;
        startYaw = SAFEZONE_CITY_HALTE_SPAWN.yaw;
      } else if (deployedFromLobbyRef.current || startTeam === 'red') {
        const padSpawn = pickRandomTeamShieldedCratePadSpawn(startTeam);
        startX = padSpawn.spawnX;
        startZ = padSpawn.spawnZ;
        startYaw = padSpawn.spawnYaw;
      }

      playerUnit = createBuddyCharacterUnit(
        startTeam,
        true,
        'Infuntry',
        startX,
        startZ,
        0,
        true,
      );
      playerUnit.yaw = startYaw;
      if (initWorldMode === 'warzone') {
        playerUnit.tacticalLoadout = createInitialBuddyTacticalLoadout('pistol', 180);
        syncUnitFieldsFromLoadout(playerUnit);
        updateCharacterWeaponStance(playerUnit.rig, playerUnit.weaponId, 0, false, false, 0, 0);
      } else {
        playerUnit.tacticalLoadout = createInitialBuddyTacticalLoadout('unarmed', 0);
        syncUnitFieldsFromLoadout(playerUnit);
        updateCharacterWeaponStance(playerUnit.rig, 'unarmed', 0, false, false, 0, 0);
        playerUnit.rig.weaponRigGroup.visible = false;
        playerUnit.rig.pistolGroup.visible = false;
      }
      buddyUnits.push(playerUnit);
      syncUnitFootRingTeamColor(playerUnit);
      snapCameraAndStartSpawnBlink(playerUnit);

      if (initWorldMode === 'safezone' || initWorldMode === 'lobby') {
        cityTramDistance = findCityTramLeadDistanceNearHalte();
        cityTram.update(cityTramDistance, 0, playerUnit.x, playerUnit.z, 0);
      }

      // 4. Zero-Prebuilt Start for Vehicles: NO Tank, NO Dump Truck, and NO Plane are pre-spawned at match start!
      const isPlaneShowcase =
        typeof window !== 'undefined' &&
        Boolean(new URLSearchParams(window.location.search).get('planeview'));
      if (isPlaneShowcase && initWorldMode === 'warzone') {
        tanks.push(createBlitzPlaneVehicle(-33.0, 76.8, 'blue'));
      }

      // 5. When worldMode === 'warzone', run full Warzone combat AI, crate spawners, barrels, and Contract Harvesters!
      //    When worldMode === 'safezone' or 'lobby', do NOT initialize any combat AI, crates, barrels, or Harvesters!
      if (initWorldMode === 'warzone') {
        if (playModeRef.current !== 'editor' && !isPlaneShowcase) {
          ensureMatchAiSquadsSpawned();
        }

        // 6. Initial Common ('red') and White Medical ('medical') Crates ONLY in Warzone mode
        spawnWorldCrate('red', -46.8, 68.5, true);
        spawnWorldCrate('red', -43.2, 68.5, true);
        spawnWorldCrate('medical', -28.0, 58.0, true);
        const isOverviewQuery =
          typeof window !== 'undefined' &&
          (new URLSearchParams(window.location.search).get('fullmap') === '1' ||
            Boolean(new URLSearchParams(window.location.search).get('planeview')));
        if (!isOverviewQuery) {
          for (const initKind of ['red', 'red', 'super', 'super', 'legend', 'medical'] as const) {
            const dropSpot = pickRandomWarzoneDropCoord();
            spawnWorldCrate(initKind, dropSpot.x, dropSpot.z, false);
          }
          for (let gi = 0; gi < 6; gi++) {
            const goldSpot = pickRandomWarzoneDropCoord();
            const isGold = gi % 3 !== 2;
            spawnWorldPickup(
              isGold ? 'coin_gold' : 'coin_silver',
              isGold ? 'EMAS WARZONE (+250G)' : 'PERAK WARZONE (+100G)',
              goldSpot.x,
              goldSpot.z,
              { scoreValue: isGold ? 250 : 100, vy: 3.5 },
            );
          }
          for (let bi = 0; bi < 5; bi++) {
            const barrelSpot = pickRandomWarzoneDropCoord();
            spawnWarzoneExplosiveBarrel(barrelSpot.x, barrelSpot.z, bi < 2);
          }
        }
      }

      trees.forEach((t) => {
        t.alive = true;
        t.hp = t.maxHp;
        t.jiggleTimer = 0;
        t.jiggleIntensity = 0;
        t.mesh.visible = true;
      });

      // Reset any pushed or shattered map props back to their saved layout positions
      for (const mp of activeMapProps) {
        if (mp.isWarzoneDropBarrel) continue;
        const orig = currentMapLayout.props.find((p) => p.id === mp.id);
        if (orig) {
          mp.x = orig.x;
          mp.z = orig.z;
          mp.rotY = orig.rotY;
          mp.wrapper.userData.worldX = orig.x;
          mp.wrapper.userData.worldZ = orig.z;
          mp.wrapper.userData.baseRotY = orig.rotY;
        }
        mp.vx = 0;
        mp.vz = 0;
        mp.rotVelY = 0;
        mp.hp = mp.maxHp;
        mp.alive = true;
        mp.jiggleTimer = 0;
        mp.wrapper.visible = mp.kind === 'explosive_barrel' ? initWorldMode === 'warzone' : true;
      }

      publicWarzonePadSlotsList = PUBLIC_WARZONE_CRATE_PADS.map(() => createEmptyPadSlots());
      nearSessionState = createInitialNearGamepassSessionState();
      sessionHarvesterUnitIds = [];

      // Spawn 2 Pure Harvesters at Blue Base Plot 0 in STANDBY (WAIT CONTRACT) state ONLY in Warzone mode!
      const isOverviewQuery =
        typeof window !== 'undefined' &&
        (new URLSearchParams(window.location.search).get('fullmap') === '1' ||
          Boolean(new URLSearchParams(window.location.search).get('planeview')));
      if (initWorldMode === 'warzone' && !isOverviewQuery) {
        const pad0 = blueBase.commanderPads[0];
        for (let hi = 0; hi < MAX_HARVESTERS_PER_BASE; hi++) {
          const sbPos = computeHarvesterBaseStandbyPosition(pad0.worldX, pad0.worldZ, 'blue', hi);
          const hUnit = createBuddyCharacterUnit(
            'blue',
            false,
            'Infuntry',
            sbPos.x,
            sbPos.z,
            0,
            false,
            false,
          );
          hUnit.weaponId = 'unarmed';
          hUnit.weaponName = 'Pure Harvester (Unarmed)';
          hUnit.ammo = 0;
          hUnit.assignedRole = 'HARVEST';
          hUnit.hasIndividualRoleAssigned = true;
          hUnit.saluteTimer = 6.0;
          hUnit.saluteSign.updateText(
            'STANDBY (WAIT CONTRACT)',
            'SELECT RECIPE IN KIOSK [B]',
            '#facc15',
            1,
          );
          hUnit.saluteSign.sprite.visible = true;
          buddyUnits.push(hUnit);
          sessionHarvesterUnitIds.push(hUnit.id);
        }
      }

      syncCityArenaModeWorldVisibility(cityArenaMode);
    };

    const spawnContractHarvestersForPlot = (
      team: 'blue' | 'red',
      plotIdx: number,
      desiredTotal = MAX_HARVESTERS_PER_BASE,
    ) => {
      const targetBaseObj = team === 'blue' ? blueBase : redBase;
      const padInfo = targetBaseObj.commanderPads[plotIdx] ?? targetBaseObj.commanderPads[0];
      const existingHarvesters = buddyUnits.filter(
        (u) =>
          u.alive &&
          !u.isPlayer &&
          u.team === team &&
          u.ownerCommanderId === plotIdx &&
          (u.assignedRole === 'HARVEST' || sessionHarvesterUnitIds.includes(u.id)),
      );
      const toSpawn = Math.max(0, Math.min(MAX_HARVESTERS_PER_BASE, desiredTotal) - existingHarvesters.length);
      for (let hi = 0; hi < toSpawn; hi++) {
        const slotIdx = existingHarvesters.length + hi;
        const sbPos = computeHarvesterBaseStandbyPosition(
          padInfo.worldX,
          padInfo.worldZ,
          team,
          slotIdx,
        );
        const hUnit = createBuddyCharacterUnit(
          team,
          false,
          'Infuntry',
          sbPos.x,
          sbPos.z,
          plotIdx,
          false,
          false,
        );
        hUnit.weaponId = 'unarmed';
        hUnit.weaponName = 'Pure Harvester (Unarmed)';
        hUnit.ammo = 0;
        hUnit.assignedRole = 'HARVEST';
        hUnit.hasIndividualRoleAssigned = true;
        hUnit.saluteTimer = 5.0;
        hUnit.saluteSign.updateText(
          hasActiveBuildContract ? 'CONTRACT ACTIVE' : 'STANDBY (WAIT CONTRACT)',
          hasActiveBuildContract ? 'FETCHING CRATES IN WARZONE' : 'SELECT RECIPE IN KIOSK [B]',
          hasActiveBuildContract ? '#b8ff3c' : '#facc15',
          1,
        );
        hUnit.saluteSign.sprite.visible = true;
        buddyUnits.push(hUnit);
        if (!sessionHarvesterUnitIds.includes(hUnit.id)) {
          sessionHarvesterUnitIds.push(hUnit.id);
        }
      }
    };

    const despawnContractHarvestersOnFulfilled = (
      team: 'blue' | 'red',
      plotIdx: number,
      craftedName: string,
    ) => {
      let despawnedCount = 0;
      for (let i = buddyUnits.length - 1; i >= 0; i--) {
        const u = buddyUnits[i];
        if (
          !u.isPlayer &&
          u.team === team &&
          u.ownerCommanderId === plotIdx &&
          (u.assignedRole === 'HARVEST' || sessionHarvesterUnitIds.includes(u.id))
        ) {
          if (u.carryingCrate !== 'none') {
            spawnWorldCrate(u.carryingCrate, u.x, u.z, true);
            u.carryingCrate = 'none';
          }
          spawnBurstParticles(u.x, 1.5, u.z, 22);
          scratchExplosionPos.set(u.x, getTerrainElevation(u.x, u.z) + 0.85, u.z);
          blitzExplosionSystem.spawnBlitzExplosion(scratchExplosionPos, 0.72, 'crate');
          scene.remove(u.root);
          sessionHarvesterUnitIds = sessionHarvesterUnitIds.filter((id) => id !== u.id);
          buddyUnits.splice(i, 1);
          despawnedCount++;
        }
      }
      if (despawnedCount > 0) {
        kioskStatusMessage = `CONTRACT FULFILLED! ${craftedName.toUpperCase()} crafted & ${despawnedCount} AI Harvesters despawned! Spawn new Harvesters at Base for the next contract.`;
        kioskStatusTimer = 5.5;
      }
    };

    const releaseActiveNearSessionBaseAndHarvesters = (reasonBanner?: string) => {
      if (nearSessionState.claimedTeam && nearSessionState.claimedPlotIndex !== null) {
        const plots =
          nearSessionState.claimedTeam === 'blue' ? blueCommanderBases : redCommanderBases;
        releaseClaimedOnlineSessionBase(plots, nearSessionState.claimedPlotIndex);
        if (nearSessionState.claimedTeam === 'blue') {
          bluePadSlotsList[nearSessionState.claimedPlotIndex] = createEmptyPadSlots();
        } else {
          redPadSlotsList[nearSessionState.claimedPlotIndex] = createEmptyPadSlots();
        }
      }
      if (sessionHarvesterUnitIds.length > 0) {
        for (let i = buddyUnits.length - 1; i >= 0; i--) {
          if (sessionHarvesterUnitIds.includes(buddyUnits[i].id)) {
            scene.remove(buddyUnits[i].root);
            buddyUnits.splice(i, 1);
          }
        }
        sessionHarvesterUnitIds = [];
      }
      nearSessionState = {
        ...nearSessionState,
        claimedTeam: null,
        claimedPlotIndex: null,
        activeHarvesterSubAccounts: [],
        sessionStatusBanner:
          reasonBanner ??
          (nearSessionState.hasGamepassNft
            ? `OFFLINE: Base Plot reverted to an empty lot. Visit a Kiosk on your team's plot to Claim an Online Session Base.`
            : nearSessionState.sessionStatusBanner),
      };
      if (playerUnit) {
        playerUnit.ownerCommanderId = 0;
      }
      navGridDirty = true;
      cachedStaticWorldStructures = null;
      syncPadVisuals(blueBase, bluePadSlotsList[0], 'BLUE', blueBaseHp);
      syncPadVisuals(redBase, redPadSlotsList[0], 'RED', redBaseHp);
    };

    const syncUnitFootRingTeamColor = (u: BuddyUnit | null | undefined) => {
      if (!u || !u.teamRing) return;
      const isLobbyOrSafezone = worldModeRef.current === 'lobby' || worldModeRef.current === 'safezone';

      if (u.isPlayer) {
        // Karakter Sendiri (Local Player):
        if (isLobbyOrSafezone) {
          // Di Lobby & Safezone City: Hapus warna merah/biru bekas Warzone.
          // Beri cincin warna netral lembut (putih/perak #e2e8f0 semi-transparan) secara permanen.
          u.teamRing.visible = true;
          const mat = u.teamRing.material as THREE.MeshBasicMaterial;
          if (mat) {
            if (mat.color && mat.color.getHex() !== 0xe2e8f0) {
              mat.color.setHex(0xe2e8f0);
            }
            mat.opacity = 0.55;
          }
          const innerDisc = u.teamRing.children[0] as THREE.Mesh | undefined;
          if (innerDisc && innerDisc.material) {
            const innerMat = innerDisc.material as THREE.MeshBasicMaterial;
            if (innerMat.color && innerMat.color.getHex() !== 0xe2e8f0) {
              innerMat.color.setHex(0xe2e8f0);
            }
            innerMat.opacity = 0.12;
          }
          u.teamRing.userData.teamColorHex = '#e2e8f0';
        } else {
          // Di Warzone Arena: Baru gunakan cincin Merah atau Biru sesuai tim.
          u.teamRing.visible = true;
          const spec = getUnitFootRingTeamColor(u.team);
          const mat = u.teamRing.material as THREE.MeshBasicMaterial;
          if (mat) {
            if (mat.color && mat.color.getHex() !== spec.hexInt) {
              mat.color.setHex(spec.hexInt);
            }
            mat.opacity = 0.9;
          }
          const innerDisc = u.teamRing.children[0] as THREE.Mesh | undefined;
          if (innerDisc && innerDisc.material) {
            const innerMat = innerDisc.material as THREE.MeshBasicMaterial;
            if (innerMat.color && innerMat.color.getHex() !== spec.hexInt) {
              innerMat.color.setHex(spec.hexInt);
            }
            innerMat.opacity = 0.14;
          }
          u.teamRing.userData.teamColorHex = spec.hexString;
        }
      } else {
        // Pemain Lain (Other Players / Buddy units):
        if (isLobbyOrSafezone) {
          // Di Lobby & Safezone City: Normalnya tanpa cincin (visible = false).
          // Cincin Hijau (#22c55e) di bawah kaki pemain lain hanya muncul saat pemain tersebut sedang diklik, dan hilang saat klik dilepas.
          const isSelected = selectedCharacterTarget && String(selectedCharacterTarget.id) === String(u.id);
          if (isSelected) {
            u.teamRing.visible = true;
            const mat = u.teamRing.material as THREE.MeshBasicMaterial;
            if (mat) {
              if (mat.color && mat.color.getHex() !== 0x22c55e) {
                mat.color.setHex(0x22c55e);
              }
              mat.opacity = 0.95;
            }
            const innerDisc = u.teamRing.children[0] as THREE.Mesh | undefined;
            if (innerDisc && innerDisc.material) {
              const innerMat = innerDisc.material as THREE.MeshBasicMaterial;
              if (innerMat.color && innerMat.color.getHex() !== 0x22c55e) {
                innerMat.color.setHex(0x22c55e);
              }
              innerMat.opacity = 0.20;
            }
            u.teamRing.userData.teamColorHex = '#22c55e';
          } else {
            u.teamRing.visible = false;
          }
        } else {
          // Di Warzone Arena: Tampilkan cincin Merah atau Biru sesuai tim.
          u.teamRing.visible = true;
          const spec = getUnitFootRingTeamColor(u.team);
          const mat = u.teamRing.material as THREE.MeshBasicMaterial;
          if (mat) {
            if (mat.color && mat.color.getHex() !== spec.hexInt) {
              mat.color.setHex(spec.hexInt);
            }
            mat.opacity = 0.9;
          }
          const innerDisc = u.teamRing.children[0] as THREE.Mesh | undefined;
          if (innerDisc && innerDisc.material) {
            const innerMat = innerDisc.material as THREE.MeshBasicMaterial;
            if (innerMat.color && innerMat.color.getHex() !== spec.hexInt) {
              innerMat.color.setHex(spec.hexInt);
            }
            innerMat.opacity = 0.14;
          }
          u.teamRing.userData.teamColorHex = spec.hexString;
        }
      }

      if (u === playerUnit && promptOverlay) {
        promptOverlay.setAttribute('data-player-foot-ring-color', u.teamRing.userData.teamColorHex || '#e2e8f0');
        promptOverlay.setAttribute('data-player-team', u.team);
        promptOverlay.setAttribute('data-player-x', u.x.toFixed(1));
        promptOverlay.setAttribute('data-player-z', u.z.toFixed(1));
      }
    };

    const enterLobbySafezone = () => {
      resetAllPlayerMovementInputs();
      if (mountedTank) {
        mountedTank.occupiedByPlayer = false;
        mountedTank.riderGroup.visible = false;
        mountedTank = null;
      }
      ridingTramCarIdx = null;
      playerUnit.carryingCrate = 'none';
      playerUnit.overheadCrateGroup.visible = false;
      releaseActiveNearSessionBaseAndHarvesters(
        'SAFEZONE LOBBY ACTIVE (100% Damage-Free). Session Base Plot automatically reverted to an empty grass lot.',
      );
      playerUnit.x = -85.5;
      playerUnit.z = 0.0;
      playerUnit.vx = 0;
      playerUnit.vz = 0;
      playerUnit.vy = 0;
      playerUnit.yaw = 0;
      playerUnit.alive = true;
      snapCameraAndStartSpawnBlink(playerUnit);
      playerUnit.maxHp = PLAYER_WARZONE_MAX_HP;
      playerUnit.hp = playerUnit.maxHp;
      playerWarzoneLives = PLAYER_WARZONE_MAX_LIVES;
      hasActiveBuildContract = false;
      playerUnit.root.visible = true;
      syncCityArenaModeWorldVisibility('safezone');
      playerUnit.weaponId = 'unarmed';
      playerUnit.rig.weaponRigGroup.visible = false;
      playerUnit.rig.pistolGroup.visible = false;
      syncUnitFootRingTeamColor(playerUnit);
      soundEngine.playPickup();
      spawnBurstParticles(playerUnit.x, 1.5, playerUnit.z, 16);
      playerUnit.saluteTimer = 2.6;
      playerUnit.saluteSign.updateText(
        'SAFEZONE LOBBY',
        'STEP ON THE NORTH (RED) OR SOUTH (BLUE) PORTAL & CLICK TEAM BUTTON!',
        '#38bdf8',
        1,
      );
      playerUnit.saluteSign.sprite.visible = true;
      kioskStatusTimer = 5.5;
      emitHudImmediately();
      if (onRequestWorldModeChangeRef.current && worldModeRef.current !== 'lobby') {
        onRequestWorldModeChangeRef.current('lobby', playerUnit.team);
      }
    };

    const syncCityArenaModeWorldVisibility = (mode: CityArenaMode) => {
      resetAllPlayerMovementInputs();
      cityArenaMode = mode;
      const rules = evaluateCitySafezoneModeRules(mode);
      if (promptOverlay) {
        promptOverlay.setAttribute('data-city-arena-mode', mode);
      }
      // 1. Crates & Pickups
      for (const c of worldCrates) {
        c.mesh.visible = rules.cratesEnabled;
      }
      for (const pk of worldPickups) {
        pk.mesh.visible = rules.cratesEnabled;
      }
      // 2. Ordnance / Land Mines / Grenades
      for (const ord of activeOrdnanceDevices) {
        ord.mesh.visible = rules.landMinesEnabled;
      }
      // 3. Explosive Barrels in Map Props
      for (const mp of activeMapProps) {
        if (mp.kind === 'explosive_barrel') {
          mp.wrapper.visible = mp.alive && rules.explosiveBarrelsEnabled;
        }
      }
      // 4. Combat AI Buddies & Combat Vehicles
      for (const b of buddyUnits) {
        if (!b.isPlayer) {
          b.root.visible = b.alive && rules.combatAiEnabled;
          if (!rules.combatAiEnabled && b.saluteSign) {
            b.saluteSign.sprite.visible = false;
          }
        }
      }
      for (const t of tanks) {
        t.root.visible = t.hp > 0 && rules.combatAiEnabled;
      }
      // 5. Skyshield Turrets, Base Kiosks, Pads & Public Warzone Crate Pads
      for (const bGroup of [blueBase.baseGroup, redBase.baseGroup]) {
        const turrets = getBaseSkyshieldTurrets(bGroup);
        turrets.forEach((st) => {
          st.isBuilt = rules.skyshieldTurretsEnabled;
          st.root.visible = rules.skyshieldTurretsEnabled;
        });
      }
      for (const cp of [...blueBase.commanderPads, ...redBase.commanderPads]) {
        cp.kioskMesh.visible = true;
        cp.padGroup.visible = true;
        cp.padStaticGroup.visible = rules.militaryStackingPadsEnabled;
      }
      for (const pubPad of publicWarzonePads) {
        pubPad.padGroup.visible = rules.cratesEnabled;
      }
      blueBase.hpSign.sprite.visible = rules.militaryStackingPadsEnabled;
      redBase.hpSign.sprite.visible = rules.militaryStackingPadsEnabled;
      if (!rules.supplyDropsEnabled) {
        supplyDropBeaconGroup.visible = false;
      }
      // 6. Disable & Hide Hand Weapons in Lobby and Safezone Mode
      if (!rules.weaponsEnabled && playerUnit) {
        playerUnit.isFiringLaser = false;
        playerUnit.carryingCrate = 'none';
        playerUnit.overheadCrateGroup.visible = false;
        playerUnit.weaponId = 'unarmed';
        playerUnit.rig.weaponRigGroup.visible = false;
        playerUnit.rig.pistolGroup.visible = false;
        playerUnit.rig.rifleGroup.visible = false;
        playerUnit.rig.bazookaGroup.visible = false;
        if (playerUnit.rig.laserGroup) playerUnit.rig.laserGroup.visible = false;
        if (playerUnit.rig.gatlingGroup) playerUnit.rig.gatlingGroup.visible = false;
        playerUnit.weaponMesh.visible = false;
      }
      cachedStaticWorldStructures = null;
      navGridDirty = true;
      syncPadVisuals(blueBase, bluePadSlotsList[0], 'BLUE', blueBaseHp);
      syncPadVisuals(redBase, redPadSlotsList[0], 'RED', redBaseHp);
    };

    const enterSafezoneCityFromLobby = () => {
      resetAllPlayerMovementInputs();
      if (mountedTank) {
        mountedTank.occupiedByPlayer = false;
        mountedTank.riderGroup.visible = false;
        mountedTank = null;
      }
      ridingTramCarIdx = null;
      releaseActiveNearSessionBaseAndHarvesters();
      syncCityArenaModeWorldVisibility('safezone');
      playerUnit.alive = true;
      playerUnit.maxHp = PLAYER_WARZONE_MAX_HP;
      playerUnit.hp = playerUnit.maxHp;
      playerUnit.x = SAFEZONE_CITY_HALTE_SPAWN.x;
      playerUnit.z = SAFEZONE_CITY_HALTE_SPAWN.z;
      playerUnit.vx = 0;
      playerUnit.vz = 0;
      playerUnit.vy = 0;
      playerUnit.yaw = SAFEZONE_CITY_HALTE_SPAWN.yaw;
      snapCameraAndStartSpawnBlink(playerUnit);
      playerUnit.root.visible = true;
      playerUnit.weaponId = 'unarmed';
      playerUnit.rig.weaponRigGroup.visible = false;
      playerUnit.rig.pistolGroup.visible = false;
      syncUnitFootRingTeamColor(playerUnit);
      cityTramDistance = findCityTramLeadDistanceNearHalte();
      cityTram.update(cityTramDistance, 0, playerUnit.x, playerUnit.z, 0);
      soundEngine.playPickup();
      spawnBurstParticles(playerUnit.x, 1.5, playerUnit.z, 18);
      playerUnit.saluteTimer = 3.2;
      playerUnit.saluteSign.updateText(
        'SAFEZONE CITY',
        'SPAWNED AT TRAM STOP · CLICK [RIDE TRAM] & USE SOCIAL TALK!',
        '#10b981',
        1,
      );
      playerUnit.saluteSign.sprite.visible = true;
      kioskStatusMessage =
        'SAFEZONE CITY ACTIVE: Peaceful city with no weapons or combat AI. Board the Tram at the Stop [RIDE TRAM / F] or claim a garden plot at a Kiosk [B]!';
      kioskStatusTimer = 5.5;
      emitHudImmediately();
      if (onRequestWorldModeChangeRef.current) {
        onRequestWorldModeChangeRef.current('safezone', playerUnit.team);
      }
    };

    const confirmLobbyFactionPortalDeploy = (requestedTeam?: 'red' | 'blue') => {
      resetAllPlayerMovementInputs();
      const steppedPortal = evaluateLobbyFactionPortalStep(playerUnit.x, playerUnit.z);
      if (steppedPortal?.portalKind === 'safezone' && !requestedTeam) {
        enterSafezoneCityFromLobby();
        return;
      }
      const targetTeam: 'red' | 'blue' | null = requestedTeam ?? steppedPortal?.team ?? null;
      if (!targetTeam) return;
      syncCityArenaModeWorldVisibility('warzone');
      const randomPadSpawn = (() => {
        const p = pickRandomTeamShieldedCratePadSpawn(targetTeam);
        return {
          spawnX: p.spawnX,
          spawnZ: p.spawnZ,
          spawnYaw: p.spawnYaw,
          sectorLabel: `${targetTeam === 'red' ? 'NORTHERN SECTOR · RED BASE SECTOR' : 'SOUTHERN SECTOR · BLUE BASE SECTOR'} · ${p.label}`,
          label:
            targetTeam === 'red'
              ? 'ENTER NORTHERN SECTOR (RED TEAM)'
              : 'ENTER SOUTHERN SECTOR (BLUE TEAM)',
        };
      })();

      if (playerUnit.team !== targetTeam) {
        releaseActiveNearSessionBaseAndHarvesters();
      }
      playerUnit.team = targetTeam;
      if (playerUnit.tacticalLoadout.handheldWeapons.length === 0) {
        playerUnit.tacticalLoadout = createInitialBuddyTacticalLoadout('pistol', 180);
      } else if (playerUnit.tacticalLoadout.activeWeaponSlotId === 'unarmed') {
        playerUnit.tacticalLoadout.activeWeaponSlotId =
          playerUnit.tacticalLoadout.handheldWeapons[0].slotId;
      }
      syncUnitFieldsFromLoadout(playerUnit);
      syncUnitFootRingTeamColor(playerUnit);
      playerWarzoneLives = PLAYER_WARZONE_MAX_LIVES;
      playerUnit.maxHp = Math.max(playerUnit.maxHp, PLAYER_WARZONE_MAX_HP);
      playerUnit.hp = playerUnit.maxHp;
      playerUnit.x = randomPadSpawn.spawnX;
      playerUnit.z = randomPadSpawn.spawnZ;
      playerUnit.vx = 0;
      playerUnit.vz = 0;
      playerUnit.yaw = randomPadSpawn.spawnYaw;
      snapCameraAndStartSpawnBlink(playerUnit);
      soundEngine.playBuildBoxCraft(true);
      spawnBurstParticles(playerUnit.x, 1.6, playerUnit.z, 24);
      playerUnit.saluteTimer = 0;
      updateCharacterWeaponStance(playerUnit.rig, playerUnit.weaponId, 0, false, false, 0, 0);
      playerUnit.saluteSign.updateText(
        targetTeam === 'red' ? 'RED TEAM (5/5 LIVES)' : 'BLUE TEAM (5/5 LIVES)',
        randomPadSpawn.sectorLabel,
        targetTeam === 'red' ? '#ff3b30' : '#00a8ff',
        1,
      );
      playerUnit.saluteSign.sprite.visible = true;
      kioskStatusMessage = `${randomPadSpawn.label} AKTIF! Tim: ${targetTeam.toUpperCase()} (${formatWarzoneLivesHudLabel(playerWarzoneLives, PLAYER_WARZONE_MAX_LIVES)}).`;
      kioskStatusTimer = 5.5;
      emitHudImmediately();
      if (onRequestWorldModeChangeRef.current) {
        onRequestWorldModeChangeRef.current('warzone', targetTeam);
      }
    };

    const handlePlayerWarzoneDeath = (unit: BuddyUnit) => {
      const deathStep = evaluatePlayerWarzoneDeathStep({
        currentLives: playerWarzoneLives,
        playerTeam: unit.team,
        hasClaimedSessionBase: nearSessionState.claimedPlotIndex !== null,
      });
      playerWarzoneLives = deathStep.livesAfterRespawn;
      if (deathStep.isEliminatedToLobby) {
        enterLobbySafezone();
        kioskStatusMessage = deathStep.statusMessage;
        kioskStatusTimer = 6.5;
        emitHudImmediately();
        return;
      }
      unit.alive = true;
      unit.maxHp = PLAYER_WARZONE_MAX_HP;
      unit.hp = unit.maxHp;
      unit.tacticalLoadout = createInitialBuddyTacticalLoadout('unarmed', 0);
      syncUnitFieldsFromLoadout(unit);
      unit.x = deathStep.spawnX;
      unit.z = deathStep.spawnZ;
      unit.vx = 0;
      unit.vz = 0;
      unit.yaw = deathStep.spawnYaw;
      unit.root.visible = true;
      snapCameraAndStartSpawnBlink(unit);
      spawnBurstParticles(unit.x, 1.5, unit.z, 18);
      unit.saluteTimer = 3.2;
      unit.saluteSign.updateText(
        formatWarzoneLivesHudLabel(deathStep.livesRemaining, deathStep.maxLives),
        'RESPAWN SEKTOR TIM (BASE TETAP AMAN)',
        unit.team === 'red' ? '#ff453a' : '#38bdf8',
        1,
      );
      unit.saluteSign.sprite.visible = true;
      kioskStatusMessage = deathStep.statusMessage;
      kioskStatusTimer = 5.5;
      emitHudImmediately();
    };

    spawnInitialSquadsAndObjects();

    // =========================================================================
    // 9. PREALLOCATED OBJECT POOLS FOR BULLETS, EXPLOSION PARTICLES & DEBRIS
    //    - Preallocates the peak count up front
    //    - Takes an inactive instance and resets its fields on spawn
    //    - Marks it inactive on death instead of destroying it (zero GC pauses)
    //    - Logs a warning if any pool ever runs out of preallocated slots
    // =========================================================================
    // Unit 1x1x1 bounding sphere (radius = 0.5) so slot.mesh.scale.set(diameter, diameter, length)
    // sets the exact weapon-proportional caliber (X, Y) and length (Z) in world meters!
    const projGeo = new THREE.SphereGeometry(0.5, 10, 10);
    const playerProjMat = new THREE.MeshBasicMaterial({ color: 0xb8ff3c });
    const iceProjMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
    const enemyProjMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
    const hiddenCarrierProjMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    const scratchSpawnOrigin = new THREE.Vector3();
    const scratchSpawnDir = new THREE.Vector3();
    const scratchExplosionPos = new THREE.Vector3();
    const scratchHitBurstDir = new THREE.Vector3();

    const projectilePool = createFixedObjectPool<Projectile>({
      name: 'Bullets',
      peakCapacity: POOL_PEAK_CAPACITIES.bullets,
      createSlot: () => {
        const m = new THREE.Mesh(projGeo, playerProjMat);
        m.visible = false;
        scene.add(m);
        return {
          active: false,
          isPlayerTeam: true,
          weaponType: 'BlitzPistol',
          mesh: m,
          pos: new THREE.Vector3(),
          vel: new THREE.Vector3(),
          life: 0,
          damage: 8,
        };
      },
      resetSlot: (slot) => {
        slot.isPlayerTeam = true;
        slot.weaponType = 'BlitzPistol';
        slot.pos.set(0, 0, 0);
        slot.vel.set(0, 0, 0);
        slot.life = 1.25;
        slot.damage = 8;
        if (slot.bossShell) slot.bossShell.visible = false;
        if (slot.playerShell) slot.playerShell.visible = false;
        if (slot.fodderShell) slot.fodderShell.visible = false;
        if (slot.nukeShell) slot.nukeShell.visible = false;
        slot.mesh.visible = true;
      },
      deactivateSlot: (slot) => {
        slot.life = 0;
        slot.vel.set(0, 0, 0);
        if (slot.bossShell) slot.bossShell.visible = false;
        if (slot.playerShell) slot.playerShell.visible = false;
        if (slot.fodderShell) slot.fodderShell.visible = false;
        if (slot.nukeShell) slot.nukeShell.visible = false;
        slot.mesh.visible = false;
      },
    });
    const projectiles = projectilePool.slots;

    const activeNuclearLaunchers: NuclearLauncherTurretRig[] = [];
    let nukeStrikeState: NuclearStrikeSequenceState = createInitialNuclearStrikeState();
    let nukeLastMouseNdc = { x: 0, y: 0 };
    let emitHudImmediately: () => void = () => {};

    // 3D Tactical Nuclear Target Reticle (visible on the zoomed-out map during `nukeStrikeState.phase === 'targeting'`)
    const nukeTargetReticleGroup = new THREE.Group();
    nukeTargetReticleGroup.name = 'NuclearTargetReticle3D';
    nukeTargetReticleGroup.visible = false;
    {
      const outerRingMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const outerBlastRing = new THREE.Mesh(new THREE.RingGeometry(10.5, 11.4, 48), outerRingMat);
      outerBlastRing.rotation.x = -Math.PI / 2;
      outerBlastRing.position.y = 0.14;
      nukeTargetReticleGroup.add(outerBlastRing);

      const midRingMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const midLockRing = new THREE.Mesh(new THREE.RingGeometry(3.8, 4.45, 36), midRingMat);
      midLockRing.rotation.x = -Math.PI / 2;
      midLockRing.position.y = 0.18;
      midLockRing.name = 'MidLockRing';
      nukeTargetReticleGroup.add(midLockRing);

      const crossGeo = new THREE.PlaneGeometry(9.6, 0.36);
      const crossH = new THREE.Mesh(crossGeo, midRingMat);
      crossH.rotation.x = -Math.PI / 2;
      crossH.position.y = 0.2;
      nukeTargetReticleGroup.add(crossH);

      const crossV = new THREE.Mesh(crossGeo, midRingMat);
      crossV.rotation.x = -Math.PI / 2;
      crossV.rotation.z = Math.PI / 2;
      crossV.position.y = 0.2;
      nukeTargetReticleGroup.add(crossV);

      const centerCoreMat = new THREE.MeshBasicMaterial({
        color: 0xff3b30,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const centerDisc = new THREE.Mesh(new THREE.CircleGeometry(1.15, 24), centerCoreMat);
      centerDisc.rotation.x = -Math.PI / 2;
      centerDisc.position.y = 0.22;
      nukeTargetReticleGroup.add(centerDisc);

      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xff4d3d,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
      });
      const laserPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.95, 42, 16, 1, true), beamMat);
      laserPillar.position.y = 21.0;
      nukeTargetReticleGroup.add(laserPillar);
    }
    scene.add(nukeTargetReticleGroup);

    // Dedicated 3D Cinematic Flying Rocket (`MLRS-MK5 'ATLAS' Nuke Rocket`) for Phase 2 (`tracking_rocket`)
    const nukeCinematicRocketGroup = new THREE.Group();
    nukeCinematicRocketGroup.name = 'NuclearCinematicRocket3D';
    nukeCinematicRocketGroup.visible = false;
    {
      const nukeBody = buildProceduralNuclearMissileMesh(windUniforms, isSoftwareGl);
      nukeBody.scale.setScalar(2.1);
      nukeCinematicRocketGroup.add(nukeBody);

      const plumeMat = new THREE.MeshBasicMaterial({
        color: 0xffa726,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      });
      const plumeCone = new THREE.Mesh(new THREE.ConeGeometry(0.48, 2.6, 14), plumeMat);
      plumeCone.rotation.x = -Math.PI / 2;
      plumeCone.position.set(0, 0, -2.1);
      plumeCone.name = 'RocketExhaustPlume';
      nukeCinematicRocketGroup.add(plumeCone);
    }
    scene.add(nukeCinematicRocketGroup);

    let planeClusterBombCooldown = 0;

    const fireProjectile = (
      isPlayerTeam: boolean,
      weaponType: string,
      origin: THREE.Vector3,
      dir: THREE.Vector3,
      speed: number,
      damage: number,
    ) => {
      projectilePool.acquire((slot) => {
        slot.isPlayerTeam = isPlayerTeam;
        slot.weaponType = weaponType;
        slot.pos.copy(origin);
        slot.vel.copy(dir).normalize().multiplyScalar(speed);
        slot.life = weaponType === 'NuclearMissile' ? 4.8 : 1.25;
        slot.damage = damage;

        const visSpec = getWeaponProjectileVisualSpec(weaponType);
        if (weaponType === 'NuclearMissile') {
          if (!slot.nukeShell) {
            const nukeMesh = buildProceduralNuclearMissileMesh(windUniforms, isSoftwareGl);
            nukeMesh.scale.setScalar(1.35);
            slot.mesh.add(nukeMesh);
            slot.nukeShell = nukeMesh;
          }
          slot.mesh.material = hiddenCarrierProjMat;
          if (slot.bossShell) slot.bossShell.visible = false;
          if (slot.playerShell) slot.playerShell.visible = false;
          if (slot.fodderShell) slot.fodderShell.visible = false;
          slot.nukeShell.visible = true;
          slot.mesh.scale.set(1, 1, 1);
        } else if (slot.has3dShells && slot.bossShell && slot.playerShell && slot.fodderShell) {
          slot.mesh.material = hiddenCarrierProjMat;
          slot.bossShell.visible = visSpec.shellKind === 'boss';
          slot.playerShell.visible = visSpec.shellKind === 'player';
          slot.fodderShell.visible = visSpec.shellKind === 'fodder';
          if (slot.nukeShell) slot.nukeShell.visible = false;
          slot.mesh.scale.set(visSpec.diameter, visSpec.diameter, visSpec.length);
        } else {
          if (slot.nukeShell) slot.nukeShell.visible = false;
          slot.mesh.material = !isPlayerTeam
            ? enemyProjMat
            : weaponType === 'Ice Gun' || weaponType === 'BlitzLaserGun'
            ? iceProjMat
            : playerProjMat;
          slot.mesh.scale.set(visSpec.diameter, visSpec.diameter, visSpec.length);
        }
        slot.mesh.position.copy(origin);
        slot.mesh.lookAt(
          origin.x + slot.vel.x,
          origin.y + slot.vel.y,
          origin.z + slot.vel.z,
        );
      });
    };

    const expGeo = new THREE.SphereGeometry(0.32, 8, 8);
    const explosionParticlePool = createFixedObjectPool<ExplosionParticle>({
      name: 'ExplosionParticles',
      peakCapacity: POOL_PEAK_CAPACITIES.explosionParticles,
      createSlot: (i) => {
        const mat = new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0xfec83e : 0xb4ff39,
          transparent: true,
          opacity: 1,
        });
        const m = new THREE.Mesh(expGeo, mat);
        m.visible = false;
        scene.add(m);
        return {
          active: false,
          mesh: m,
          vel: new THREE.Vector3(),
          life: 0,
          maxLife: 0.45,
        };
      },
      resetSlot: (ep) => {
        ep.life = 0;
        ep.maxLife = 0.45;
        ep.vel.set(0, 0, 0);
        (ep.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
        ep.mesh.visible = true;
      },
      deactivateSlot: (ep) => {
        ep.life = 0;
        ep.vel.set(0, 0, 0);
        ep.mesh.visible = false;
      },
    });
    const explosionParticles = explosionParticlePool.slots;

    // 3D Debris Chunks Pool (Wood Planks, Concrete Blocks & Metal Fragments with Black Ink Outlines!)
    const debrisBoxGeo = new THREE.BoxGeometry(0.48, 0.16, 0.28);
    const debrisChunkPool = createFixedObjectPool<DebrisChunk3D>({
      name: 'DebrisChunks3D',
      peakCapacity: POOL_PEAK_CAPACITIES.debrisChunks,
      createSlot: () => {
        const mat = makeToonMat('#d69a56');
        const mesh = new THREE.Mesh(debrisBoxGeo, mat);
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.visible = false;
        const outline = new THREE.Mesh(debrisBoxGeo, inkOutlineMat);
        outline.scale.setScalar(1.1);
        mesh.add(outline);
        scene.add(mesh);
        return {
          active: false,
          mesh,
          mat,
          pos: new THREE.Vector3(),
          vel: new THREE.Vector3(),
          rotVel: new THREE.Vector3(),
          life: 0,
          maxLife: 2.2,
          baseScale: new THREE.Vector3(1, 1, 1),
        };
      },
      resetSlot: (dc) => {
        dc.life = 0;
        dc.maxLife = 2.2;
        dc.pos.set(0, 0, 0);
        dc.vel.set(0, 0, 0);
        dc.rotVel.set(0, 0, 0);
        dc.baseScale.set(1, 1, 1);
        dc.mesh.visible = true;
      },
      deactivateSlot: (dc) => {
        dc.life = 0;
        dc.vel.set(0, 0, 0);
        dc.rotVel.set(0, 0, 0);
        dc.mesh.visible = false;
      },
    });
    const debrisChunks = debrisChunkPool.slots;

    const spawnDebrisChunks = (
      x: number,
      y: number,
      z: number,
      materialKind: 'wood' | 'concrete' | 'metal',
      count = 12,
      biasVx = 0,
      biasVz = 0,
    ) => {
      const palette =
        materialKind === 'wood'
          ? [0xd99b52, 0xb87638, 0xe8b574, 0x8c5322]
          : materialKind === 'concrete'
          ? [0x8b959e, 0x6c757d, 0xaab2b8, 0x525a61]
          : [0xff453a, 0x2b2d3c, 0xff9f0a, 0x636675];

      for (let spawned = 0; spawned < count; spawned++) {
        const dc = debrisChunkPool.acquire((slot) => {
          slot.maxLife = 1.65 + Math.random() * 0.85;
          slot.mat.color.setHex(palette[spawned % palette.length]);

          if (materialKind === 'wood') {
            // Elongated wood planks & splinters
            slot.baseScale.set(0.85 + Math.random() * 0.75, 0.45 + Math.random() * 0.35, 0.65 + Math.random() * 0.5);
          } else if (materialKind === 'concrete') {
            // Chunky concrete/brick blocks
            slot.baseScale.set(0.75 + Math.random() * 0.6, 0.85 + Math.random() * 0.65, 0.75 + Math.random() * 0.6);
          } else {
            // Bent barrel metal plates
            slot.baseScale.set(0.8 + Math.random() * 0.65, 0.35 + Math.random() * 0.3, 0.8 + Math.random() * 0.65);
          }
          slot.mesh.scale.copy(slot.baseScale);
          slot.pos.set(
            x + (Math.random() - 0.5) * 0.65,
            Math.max(0.25, y + Math.random() * 0.85),
            z + (Math.random() - 0.5) * 0.65,
          );
          slot.mesh.position.copy(slot.pos);
          slot.mesh.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI,
          );

          const ang = Math.random() * Math.PI * 2;
          const outSpd = 3.2 + Math.random() * 6.8;
          slot.vel.set(
            Math.cos(ang) * outSpd + biasVx * 0.45,
            5.2 + Math.random() * 6.5,
            Math.sin(ang) * outSpd + biasVz * 0.45,
          );
          slot.rotVel.set(
            (Math.random() - 0.5) * 16,
            (Math.random() - 0.5) * 16,
            (Math.random() - 0.5) * 16,
          );
        });
        if (!dc) break;
      }
    };

    // 5-Layer Original Buddies Blitz Toon Explosion & Muzzle Flash System
    const blitzExplosionSystem = createBlitzExplosionSystem(scene, getTerrainElevation, {
      stampGrassShockwave: (wx, wz, radius, strength) => {
        blitzGrassSystem.stampExplosionShockwave(wx, wz, radius, strength);
      },
      onSpawnDebris: (wx, wy, wz, matKind, count) => {
        spawnDebrisChunks(wx, wy, wz, matKind, count);
      },
    });

    const spawnCollisionContactParticles = (
      x: number,
      y: number,
      z: number,
      normalX: number,
      normalZ: number,
      materialTag: CollisionMaterialTag,
      impactSpeed: number,
    ) => {
      const count = clamp(Math.round(3 + impactSpeed * 0.65), 3, 12);
      const baseAngle = Math.atan2(normalZ, normalX);
      for (let spawned = 0; spawned < count; spawned++) {
        const ep = explosionParticlePool.acquire((slot) => {
          slot.maxLife = 0.24 + Math.random() * 0.22;
          slot.mesh.position.set(
            x + (Math.random() - 0.5) * 0.25,
            y + 0.35 + Math.random() * 0.45,
            z + (Math.random() - 0.5) * 0.25,
          );
          slot.mesh.scale.setScalar(0.42 + Math.random() * 0.55);
          const mat = slot.mesh.material as THREE.MeshBasicMaterial;
          if (materialTag === 'metal') {
            mat.color.setHex(spawned % 2 === 0 ? 0xffa822 : 0xfff078);
          } else if (materialTag === 'tree') {
            mat.color.setHex(spawned % 2 === 0 ? 0x8be24b : 0xb57cff);
          } else if (materialTag === 'wood') {
            mat.color.setHex(spawned % 2 === 0 ? 0xdba05e : 0xf2c98a);
          } else {
            mat.color.setHex(spawned % 2 === 0 ? 0xd6a868 : 0xb5bec6);
          }
          const ang = baseAngle + (Math.random() - 0.5) * 1.35;
          const spd = (2.5 + Math.random() * 4.5) * clamp(impactSpeed / 6.0, 0.6, 1.7);
          slot.vel.set(Math.cos(ang) * spd, 2.4 + Math.random() * 4.2, Math.sin(ang) * spd);
        });
        if (!ep) break;
      }
    };

    const spawnBurstParticles = (x: number, y: number, z: number, count = 12) => {
      const terrainY = getTerrainElevation(x, z);
      for (let spawned = 0; spawned < count; spawned++) {
        const ep = explosionParticlePool.acquire((slot) => {
          slot.maxLife = 0.35 + Math.random() * 0.25;
          slot.mesh.position.set(x, terrainY + y, z);
          slot.mesh.scale.setScalar(0.7 + Math.random() * 0.8);
          (slot.mesh.material as THREE.MeshBasicMaterial).color.setHex(
            spawned % 2 === 0 ? 0xfec83e : 0xb4ff39,
          );
          const angle = Math.random() * Math.PI * 2;
          const spd = 3 + Math.random() * 7;
          slot.vel.set(Math.cos(angle) * spd, 4 + Math.random() * 6, Math.sin(angle) * spd);
        });
        if (!ep) break;
      }
    };

    const roadDustTimerByEntity = new Map<string, number>();
    const spawnRoadBoostDustWindParticles = (
      entityKey: string,
      onRoadOrZebra: boolean,
      isGrounded: boolean,
      wx: number,
      wz: number,
      vx: number,
      vz: number,
      dt: number,
      isVehicle: boolean,
      halfTrackOrFootSpan = 0.42,
    ) => {
      const groundSpeed = Math.hypot(vx, vz);
      const prevTimer = roadDustTimerByEntity.get(entityKey) ?? 0;
      const check = shouldEmitRoadSpeedBoostParticles({
        onRoadOrZebra,
        isGrounded,
        groundSpeed,
        accumTimerSec: prevTimer,
        dt,
        isVehicle,
      });
      roadDustTimerByEntity.set(entityKey, check.nextTimerSec);
      if (!check.shouldEmit) return;

      const terrainY = getTerrainElevation(wx, wz);
      const invSpd = groundSpeed > 0.01 ? 1 / groundSpeed : 0;
      const fwdX = vx * invSpd;
      const fwdZ = vz * invSpd;
      const rightX = -fwdZ;
      const rightZ = fwdX;

      for (let i = 0; i < check.particleCount; i++) {
        const sideSign = i % 2 === 0 ? -1 : 1;
        const ep = explosionParticlePool.acquire((slot) => {
          slot.maxLife = isVehicle ? 0.26 + Math.random() * 0.14 : 0.21 + Math.random() * 0.12;
          const px = wx - fwdX * (isVehicle ? 0.85 : 0.25) + rightX * sideSign * halfTrackOrFootSpan;
          const pz = wz - fwdZ * (isVehicle ? 0.85 : 0.25) + rightZ * sideSign * halfTrackOrFootSpan;
          slot.mesh.position.set(
            px + (Math.random() - 0.5) * 0.18,
            terrainY + (isVehicle ? 0.22 : 0.14),
            pz + (Math.random() - 0.5) * 0.18,
          );
          slot.mesh.scale.setScalar(isVehicle ? 0.58 + Math.random() * 0.38 : 0.42 + Math.random() * 0.28);
          (slot.mesh.material as THREE.MeshBasicMaterial).color.setHex(
            i % 2 === 0 ? 0xe2e8f0 : 0xcbd5e1,
          );
          const backSpd = groundSpeed * 0.24 + Math.random() * 1.4;
          const latSpd = sideSign * (0.45 + Math.random() * 0.65);
          slot.vel.set(
            -fwdX * backSpd + rightX * latSpd,
            1.15 + Math.random() * 1.35,
            -fwdZ * backSpd + rightZ * latSpd,
          );
        });
        if (!ep) break;
      }
    };

    // Directional Muzzle Sparks & Bazooka Rear Exhaust Backblast Spawner
    const spawnDirectionalSparks = (
      x: number,
      y: number,
      z: number,
      dirX: number,
      dirZ: number,
      count = 10,
      baseSpeed = 12,
      spread = 0.55,
    ) => {
      const baseAngle = Math.atan2(dirZ, dirX);
      for (let spawned = 0; spawned < count; spawned++) {
        const ep = explosionParticlePool.acquire((slot) => {
          slot.maxLife = 0.22 + Math.random() * 0.22;
          slot.mesh.position.set(
            x + (Math.random() - 0.5) * 0.2,
            y + (Math.random() - 0.5) * 0.2,
            z + (Math.random() - 0.5) * 0.2,
          );
          slot.mesh.scale.setScalar(0.45 + Math.random() * 0.65);
          (slot.mesh.material as THREE.MeshBasicMaterial).color.setHex(
            spawned % 2 === 0 ? 0xff9922 : 0xffe866,
          );
          const ang = baseAngle + (Math.random() - 0.5) * spread;
          const spd = baseSpeed * (0.65 + Math.random() * 0.7);
          slot.vel.set(Math.cos(ang) * spd, 1.5 + (Math.random() - 0.3) * 4.5, Math.sin(ang) * spd);
        });
        if (!ep) break;
      }
    };

    // Target Fire / Thermal Ignition Particle Spawner (for LG-88 Laser Gun target hits & Cluster Bomb / Incendiary blasts)
    const FIRE_PARTICLE_COLORS = [0xff2a00, 0xff5e00, 0xff9500, 0xffe600];
    const spawnTargetFireParticles = (
      x: number,
      y: number,
      z: number,
      count = 14,
      spreadRadius = 0.48,
    ) => {
      for (let i = 0; i < count; i++) {
        const ep = explosionParticlePool.acquire((slot) => {
          slot.maxLife = 0.34 + Math.random() * 0.28;
          const ang = Math.random() * Math.PI * 2;
          const r = Math.random() * spreadRadius;
          slot.mesh.position.set(
            x + Math.cos(ang) * r,
            y + 0.12 + Math.random() * 0.45,
            z + Math.sin(ang) * r,
          );
          slot.mesh.scale.setScalar(0.52 + Math.random() * 0.72);
          (slot.mesh.material as THREE.MeshBasicMaterial).color.setHex(
            FIRE_PARTICLE_COLORS[i % FIRE_PARTICLE_COLORS.length],
          );
          // High upward buoyancy velocity so flames flicker and rise on the target
          const horizSpd = 0.8 + Math.random() * 2.2;
          slot.vel.set(
            Math.cos(ang) * horizSpd,
            5.8 + Math.random() * 5.2,
            Math.sin(ang) * horizSpd,
          );
        });
        if (!ep) break;
      }
    };

    // 3D Coherent Photon Laser Beam Spawner & Persistent Continuous Raycast Dual-Layer Beam Controllers
    const laserOuterCylGeo = new THREE.CylinderGeometry(
      LASER_OUTER_GLOW_RADIUS,
      LASER_OUTER_GLOW_RADIUS,
      1.0,
      14,
      1,
      true,
    );
    const laserCoronaCylGeo = new THREE.CylinderGeometry(
      LASER_OUTER_GLOW_RADIUS * 1.65,
      LASER_OUTER_GLOW_RADIUS * 1.65,
      1.0,
      12,
      1,
      true,
    );
    const laserCoreCylGeo = new THREE.CylinderGeometry(
      LASER_CORE_RADIUS,
      LASER_CORE_RADIUS,
      1.0,
      10,
      1,
      false,
    );
    const laserHitSphereGeo = new THREE.SphereGeometry(0.26, 10, 10);
    const laserMuzzleCoreSphereGeo = new THREE.SphereGeometry(0.085, 10, 10);
    const laserMuzzleGlowSphereGeo = new THREE.SphereGeometry(0.19, 12, 12);
    const laserHitCoreSphereGeo = new THREE.SphereGeometry(0.115, 10, 10);
    const laserHitGlowSphereGeo = new THREE.SphereGeometry(0.28, 12, 12);
    const laserHitRingGeo = new THREE.RingGeometry(0.13, 0.34, 16);
    const laserSparkConeGeo = new THREE.ConeGeometry(0.028, 0.30, 5);
    laserSparkConeGeo.translate(0, 0.15, 0);
    const laserUpAxis = new THREE.Vector3(0, 1, 0);
    const laserForwardAxis = new THREE.Vector3(0, 0, 1);

    interface ContinuousLaserBeamVisual {
      group: THREE.Group;
      coreMesh: THREE.Mesh;
      outerGlowMesh: THREE.Mesh;
      coronaMesh: THREE.Mesh;
      coreMat: THREE.MeshBasicMaterial;
      outerMat: THREE.MeshBasicMaterial;
      coronaMat: THREE.MeshBasicMaterial;
      muzzleFxGroup: THREE.Group;
      muzzleGlowMesh: THREE.Mesh;
      muzzleSparkSpikes: THREE.Mesh[];
      muzzleLight: THREE.PointLight;
      hitFxGroup: THREE.Group;
      hitGlowMesh: THREE.Mesh;
      hitRingMesh: THREE.Mesh;
      hitSparkSpikes: THREE.Mesh[];
      hitLight: THREE.PointLight;
    }

    const continuousLaserVisuals = new Map<number, ContinuousLaserBeamVisual>();

    const getOrCreateContinuousLaserVisual = (
      unitId: number,
      team: 'blue' | 'red',
    ): ContinuousLaserBeamVisual => {
      const existing = continuousLaserVisuals.get(unitId);
      if (existing) return existing;

      const glowColorHex = team === 'blue' ? 0x00f2ff : 0xff3864;
      const coronaColorHex = team === 'blue' ? 0x29b6ff : 0xff6b3d;

      const group = new THREE.Group();
      group.name = `ContinuousLaserBeam_${unitId}`;
      group.visible = false;

      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.98,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const outerMat = new THREE.MeshBasicMaterial({
        color: glowColorHex,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const coronaMat = new THREE.MeshBasicMaterial({
        color: coronaColorHex,
        transparent: true,
        opacity: 0.36,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const coreMesh = new THREE.Mesh(laserCoreCylGeo, coreMat);
      coreMesh.renderOrder = 16;
      const outerGlowMesh = new THREE.Mesh(laserOuterCylGeo, outerMat);
      outerGlowMesh.renderOrder = 15;
      const coronaMesh = new THREE.Mesh(laserCoronaCylGeo, coronaMat);
      coronaMesh.renderOrder = 14;
      group.add(coronaMesh, outerGlowMesh, coreMesh);

      // Muzzle Light & Radial Spark Assembly (sticks to startPoint at barrel tip)
      const muzzleFxGroup = new THREE.Group();
      const muzzleCoreMesh = new THREE.Mesh(laserMuzzleCoreSphereGeo, coreMat);
      const muzzleGlowMesh = new THREE.Mesh(laserMuzzleGlowSphereGeo, outerMat);
      muzzleFxGroup.add(muzzleCoreMesh, muzzleGlowMesh);

      const muzzleSparkSpikes: THREE.Mesh[] = [];
      for (let i = 0; i < 6; i++) {
        const spike = new THREE.Mesh(laserSparkConeGeo, i % 2 === 0 ? coreMat : outerMat);
        const ang = (i / 6) * Math.PI * 2;
        spike.rotation.z = ang;
        spike.rotation.x = 0.42;
        muzzleFxGroup.add(spike);
        muzzleSparkSpikes.push(spike);
      }
      const muzzleLight = new THREE.PointLight(glowColorHex, 2.2, 5.5);
      muzzleFxGroup.add(muzzleLight);
      group.add(muzzleFxGroup);

      // Hit-Point Light, Shock Ring & Radial Spark Assembly (sticks to closest raycast endPoint)
      const hitFxGroup = new THREE.Group();
      const hitCoreMesh = new THREE.Mesh(laserHitCoreSphereGeo, coreMat);
      const hitGlowMesh = new THREE.Mesh(laserHitGlowSphereGeo, outerMat);
      const hitRingMesh = new THREE.Mesh(laserHitRingGeo, outerMat);
      hitFxGroup.add(hitCoreMesh, hitGlowMesh, hitRingMesh);

      const hitSparkSpikes: THREE.Mesh[] = [];
      for (let i = 0; i < 6; i++) {
        const spike = new THREE.Mesh(laserSparkConeGeo, i % 2 === 0 ? coreMat : outerMat);
        const ang = (i / 6) * Math.PI * 2 + 0.25;
        spike.rotation.z = ang;
        spike.rotation.x = -0.58;
        hitFxGroup.add(spike);
        hitSparkSpikes.push(spike);
      }
      const hitLight = new THREE.PointLight(glowColorHex, 2.6, 6.5);
      hitFxGroup.add(hitLight);
      group.add(hitFxGroup);

      scene.add(group);
      const created: ContinuousLaserBeamVisual = {
        group,
        coreMesh,
        outerGlowMesh,
        coronaMesh,
        coreMat,
        outerMat,
        coronaMat,
        muzzleFxGroup,
        muzzleGlowMesh,
        muzzleSparkSpikes,
        muzzleLight,
        hitFxGroup,
        hitGlowMesh,
        hitRingMesh,
        hitSparkSpikes,
        hitLight,
      };
      continuousLaserVisuals.set(unitId, created);
      return created;
    };

    const spawnLaserBeamEffect = (startPos: THREE.Vector3, endPos: THREE.Vector3) => {
      const delta = new THREE.Vector3().subVectors(endPos, startPos);
      const dist = Math.max(0.5, delta.length());
      const mid = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
      const dir = delta.clone().divideScalar(dist);

      const group = new THREE.Group();
      const outerMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.98,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const outerBeam = new THREE.Mesh(laserOuterCylGeo, outerMat);
      outerBeam.scale.set(1, dist, 1);
      outerBeam.position.copy(mid);
      outerBeam.quaternion.setFromUnitVectors(laserUpAxis, dir);
      group.add(outerBeam);

      const coreBeam = new THREE.Mesh(laserCoreCylGeo, coreMat);
      coreBeam.scale.set(1, dist, 1);
      coreBeam.position.copy(mid);
      coreBeam.quaternion.setFromUnitVectors(laserUpAxis, dir);
      group.add(coreBeam);

      const hitFlare = new THREE.Mesh(laserHitSphereGeo, outerMat);
      hitFlare.position.copy(endPos);
      group.add(hitFlare);

      scene.add(group);
      activeLaserBeams.push({
        group,
        outerMat,
        coreMat,
        life: 0,
        maxLife: 0.16,
      });
    };

    // TITAN-6 Rotary Gatling Ejected Brass Shell Casings + Hot Barrel Sparks
    const spawnGatlingBrassAndSparks = (
      muzzleX: number,
      muzzleY: number,
      muzzleZ: number,
      fwdX: number,
      fwdZ: number,
      rightX: number,
      rightZ: number,
    ) => {
      spawnDirectionalSparks(muzzleX, muzzleY, muzzleZ, fwdX, fwdZ, 12, 18, 0.62);
      // Eject 2 glinting brass 7.62mm shell casings to the right of the TITAN-6 receiver
      for (let i = 0; i < 2; i++) {
        debrisChunkPool.acquire((slot) => {
          slot.maxLife = 0.65 + Math.random() * 0.35;
          slot.mat.color.setHex(i === 0 ? 0xfacc15 : 0xeab308);
          slot.baseScale.set(0.16, 0.08, 0.28);
          slot.mesh.scale.copy(slot.baseScale);
          slot.pos.set(
            muzzleX - fwdX * 0.55 + rightX * 0.22,
            muzzleY + 0.04,
            muzzleZ - fwdZ * 0.55 + rightZ * 0.22,
          );
          slot.mesh.position.copy(slot.pos);
          const ejectSpd = 3.4 + Math.random() * 2.4;
          slot.vel.set(
            rightX * ejectSpd - fwdX * (0.6 + Math.random() * 0.8),
            3.2 + Math.random() * 2.2,
            rightZ * ejectSpd - fwdZ * (0.6 + Math.random() * 0.8),
          );
          slot.rotVel.set(
            (Math.random() - 0.5) * 24,
            (Math.random() - 0.5) * 24,
            (Math.random() - 0.5) * 24,
          );
        });
      }
    };

    // Preallocated Pool of 220 Ground Tank Track Tread Marks (left & right caterpillar ruts in grass/dirt)
    interface TankTrackMark {
      active: boolean;
      mesh: THREE.Mesh;
      mat: THREE.MeshBasicMaterial;
      life: number;
      maxLife: number;
    }
    const trackMarkGeo = new THREE.BoxGeometry(0.42, 0.04, 0.84);
    const tankTrackMarkPool = createFixedObjectPool<TankTrackMark>({
      name: 'TankTrackMarks',
      peakCapacity: POOL_PEAK_CAPACITIES.tankTrackMarks,
      createSlot: () => {
        const mat = new THREE.MeshBasicMaterial({
          color: 0x12360c,
          transparent: true,
          opacity: 0.82,
        });
        const m = new THREE.Mesh(trackMarkGeo, mat);
        m.visible = false;
        scene.add(m);
        return {
          active: false,
          mesh: m,
          mat,
          life: 0,
          maxLife: 16.0,
        };
      },
      resetSlot: (tm) => {
        tm.life = 0;
        tm.maxLife = 16.0;
        tm.mat.opacity = 0.82;
        tm.mesh.visible = true;
      },
      deactivateSlot: (tm) => {
        tm.life = 0;
        tm.mesh.visible = false;
      },
    });
    const tankTrackMarks = tankTrackMarkPool.slots;

    const spawnSingleTreadMark = (wx: number, wz: number, yaw: number) => {
      tankTrackMarkPool.acquire((slot) => {
        const wrappedX = wrapPlanetCoord(wx);
        const wrappedZ = wrapPlanetCoord(wz);
        const onRoad = evaluateRoadNetworkSdf(wrappedX, wrappedZ) < 0;
        slot.mat.color.setHex(onRoad ? 0x5c3818 : 0x10330b);
        slot.mesh.position.set(wrappedX, onRoad ? 0.064 : 0.085, wrappedZ);
        slot.mesh.rotation.set(0, yaw, 0);
      });
    };

    const tankTreadDistAccum = new Map<number, number>();
    const recordTankMovementAndTracks = (
      tank: TankVehicle,
      prevX: number,
      prevZ: number,
      prevYaw: number,
    ) => {
      const dx = getPlanetShortestDelta(tank.x, prevX);
      const dz = getPlanetShortestDelta(tank.z, prevZ);
      const fwdX = Math.cos(tank.hullYaw);
      const fwdZ = -Math.sin(tank.hullYaw);
      const fwdMove = dx * fwdX + dz * fwdZ;
      const yawDelta = tank.hullYaw - prevYaw;
      const deltaLeft = fwdMove - yawDelta * 1.45;
      const deltaRight = fwdMove + yawDelta * 1.45;

      // 1. Revolve the 18-segment left & right caterpillar tracks and spin all 8 wheels!
      stepBlitzTankTracks(tank.bodyGroup, deltaLeft, deltaRight);

      // 2. Stamp dual track ruts into the 3D grass field & spawn ground tread decals
      const stepDist = Math.hypot(dx, dz) + Math.abs(yawDelta) * 1.1;
      if (stepDist > 0.008) {
        const halfTrackW = tank.isSuper ? 1.54 : 1.38;
        const rightX = Math.sin(tank.hullYaw);
        const rightZ = Math.cos(tank.hullYaw);
        const leftX = tank.x - rightX * halfTrackW;
        const leftZ = tank.z - rightZ * halfTrackW;
        const rgtX = tank.x + rightX * halfTrackW;
        const rgtZ = tank.z + rightZ * halfTrackW;

        // Stamp grass crushing under both caterpillar tracks when moving
        if (stepDist > 0.03) {
          blitzGrassSystem.stampTankTracks(leftX, leftZ, rgtX, rgtZ);
        }

        if (tank.vehicleKind !== 'truck') {
          const prevAcc = tankTreadDistAccum.get(tank.id) || 0;
          const nextAcc = prevAcc + stepDist;
          if (nextAcc >= 0.46) {
            tankTreadDistAccum.set(tank.id, nextAcc % 0.46);
            spawnSingleTreadMark(leftX, leftZ, tank.hullYaw);
            spawnSingleTreadMark(rgtX, rgtZ, tank.hullYaw);
          } else {
            tankTreadDistAccum.set(tank.id, nextAcc);
          }
        }
      }
    };

    // Dynamic Mode Switch Handler (Sandbox <-> Map Preview Live Free Camera <-> Run Match With AI)
    const editorPan = { x: 0, z: 2.0 };
    let editorZoom = 1.0;
    let editorOrbitYaw = 0.0;
    let editorOrbitPitch = 0.68;
    let previousNonEditorPlayMode: PlayMode = 'sandbox';

    applyPlayModeRef.current = (nextMode: PlayMode) => {
      editorCursorGroup.visible = false;

      if (nextMode === 'editor') {
        editorPan.x = playerUnit ? playerUnit.x : 0;
        editorPan.z = playerUnit ? playerUnit.z : 1.5;
        editorZoom = 1.0;
        editorOrbitYaw = 0.0;
        editorOrbitPitch = 0.68;
        return;
      }

      if (previousNonEditorPlayMode !== nextMode) {
        projectilePool.releaseAll();
        if (nextMode === 'match') {
          ensureMatchAiSquadsSpawned();
        } else {
          clearAllNonPlayerNpcs();
          blueBaseHp = 2000;
          redBaseHp = 2000;
          syncPadVisuals(blueBase, bluePadSlots, 'BLUE', blueBaseHp);
          syncPadVisuals(redBase, redPadSlots, 'RED', redBaseHp);
        }
      }
      previousNonEditorPlayMode = nextMode;
    };

    // =========================================================================
    // 10. INTERACTION HANDLERS:
    //     [E] PICKUP / THROW CRATE TO 2x2x2 PAD (STRICTLY WITHIN [Q] GHOST SLOTS)
    //     [F] KICK OPEN CRATE OR CRAFT STACKING PAD (WEAPON / AI BUDDY / BLITZ TANK)
    //     [G] MOUNT / DISMOUNT OPEN-TOP BLITZ TANK
    //     [Q] CYCLE BUILD ORDER GHOST WIREFRAME · [V] CURSOR AI COMMAND + SALUTE
    // =========================================================================
    const getPlayerAudioListenerPos = (): { x: number; z: number } => {
      if (mountedTank) {
        return { x: mountedTank.x, z: mountedTank.z };
      }
      return { x: playerUnit.x, z: playerUnit.z };
    };

    const playSpatialSoundAt = (
      sourceX: number,
      sourceZ: number,
      maxDistance: number,
      refDistance: number,
      fn: () => void,
    ): void => {
      const listener = getPlayerAudioListenerPos();
      const gain = computeSpatialAudioGain(
        listener.x,
        listener.z,
        sourceX,
        sourceZ,
        maxDistance,
        refDistance,
      );
      soundEngine.withSpatialGain(gain, fn);
    };

    const playBuildBoxSoundAtPad = (
      team: 'blue' | 'red',
      padX: number,
      padZ: number,
      isPlayerAction: boolean,
      fn: () => void,
    ): void => {
      const listener = getPlayerAudioListenerPos();
      const baseObj = team === 'blue' ? blueBase : redBase;
      const gain = computeBuildBoxAudioGain(
        listener.x,
        listener.z,
        padX,
        padZ,
        baseObj.hqX,
        baseObj.hqZ,
        isPlayerAction,
      );
      soundEngine.withSpatialGain(gain, fn);
    };

    const addCrateToPadSlots = (
      team: 'blue' | 'red',
      kind: WorldCrateKind,
      commanderIdx = 0,
      strictColorOnly = false,
    ): boolean => {
      if (kind === 'medical') return false;
      const slotsList = team === 'blue' ? bluePadSlotsList : redPadSlotsList;
      const isPlayerMainPad =
        (team === 'blue' && commanderIdx === 0) ||
        (nearSessionState.claimedTeam === team && nearSessionState.claimedPlotIndex === commanderIdx);

      // Special Indestructible Supply Drop Metallic Box Instant Full Boost!
      if (kind === 'silver_metallic' || kind === 'gold_metallic') {
        const specialBoost = evaluateSpecialMetallicCratePadBoost(kind);
        slotsList[commanderIdx] = [...specialBoost.filledSlots];
        if (isPlayerMainPad) {
          buildOrder = specialBoost.buildOrder;
          useCustomHologramRecipe = false;
        } else {
          aiBuildOrders[commanderIdx % aiBuildOrders.length] = specialBoost.buildOrder;
        }
        if (team === 'blue') {
          gold += specialBoost.bonusGold;
          score += specialBoost.bonusScore;
          kioskStatusMessage = specialBoost.rewardLabel;
          kioskStatusTimer = 5.5;
          if (playerUnit && playerUnit.alive) {
            playerUnit.saluteTimer = 2.6;
            playerUnit.saluteSign.updateText(
              kind === 'gold_metallic' ? 'SHINY GOLD BOX BOOST!' : 'SILVER BOX BOOST!',
              `+${specialBoost.bonusGold}G & INSTANT OVERPOWER CRAFT!`,
              kind === 'gold_metallic' ? '#facc15' : '#38bdf8',
              1,
            );
            playerUnit.saluteSign.sprite.visible = true;
          }
          syncPadVisuals(blueBase, bluePadSlotsList[0], 'BLUE', blueBaseHp);
        } else {
          syncPadVisuals(redBase, redPadSlotsList[0], 'RED', redBaseHp);
        }
        craftFromCommanderPad(team, commanderIdx, isPlayerMainPad);
        if (kind === 'silver_metallic' && worldPickups.length > 0) {
          const latestPickup = worldPickups[worldPickups.length - 1];
          if (latestPickup && latestPickup.kind === 'weapon') {
            latestPickup.weaponName =
              specialBoost.overpowerWeaponName ?? 'LG-88 Photon Lance (Overpower Tier)';
            latestPickup.remainingAmmo = 180;
          }
        }
        return true;
      }

      const slots = slotsList[commanderIdx] || slotsList[0];
      const activePattern: BuildOrderTarget = isPlayerMainPad
        ? useCustomHologramRecipe
          ? buildOrder
          : 'AUTO'
        : aiBuildOrders[commanderIdx % aiBuildOrders.length];
      let nextIdx =
        isPlayerMainPad && useCustomHologramRecipe && KIOSK_BUILD_PRIORITY_RECIPES[activePriorityRecipe]
          ? chooseNextPadSlotIndexForHologram(
              slots,
              KIOSK_BUILD_PRIORITY_RECIPES[activePriorityRecipe].slotHologramColors,
              kind,
              buildOrder,
              strictColorOnly,
            )
          : chooseNextPadSlotIndex(slots, activePattern);
      if (nextIdx === -1 && isPlayerMainPad && !strictColorOnly) {
        nextIdx = chooseNextPadSlotIndex(slots, 'AUTO');
      }
      if (nextIdx === -1) return false;
      slots[nextIdx] = kind;
      if (team === 'blue') {
        syncPadVisuals(blueBase, bluePadSlotsList[0], 'BLUE', blueBaseHp);
        // Auto-Burst & Continuous Queue Build: when the active hologram target on Blue Pad P1 is fulfilled,
        // the stacked boxes burst and craft the item automatically without needing to be kicked ([F])!
        const isHoloFulfilled =
          useCustomHologramRecipe &&
          evaluatePadHologramState(true, useCustomHologramRecipe, activePriorityRecipe, slots)
            .isFulfilled;
        const isManualOrderFulfilled =
          !useCustomHologramRecipe &&
          buildOrder !== 'AUTO' &&
          evaluateStackingPadRecipe(slots).totalCrates >=
            (BUILD_ORDER_SPECS[buildOrder]?.targetCrates ?? 8);
        if (isPlayerMainPad && (isHoloFulfilled || isManualOrderFulfilled)) {
          craftFromCommanderPad('blue', 0, true);
        }
      } else {
        syncPadVisuals(redBase, redPadSlotsList[0], 'RED', redBaseHp);
      }
      return true;
    };

    const startDumpTruckHydraulicUnload = (
      truck: TankVehicle,
      preferredMode?: 'pad' | 'ground',
    ) => {
      if ((truck.dumpAnimTimer ?? 0) > 0) return;
      const distToPad = getPlanetShortestDistance(truck.x, truck.z, blueBase.padX, blueBase.padZ);
      truck.dumpTargetMode =
        preferredMode ?? (distToPad <= 9.5 ? 'pad' : 'ground');
      truck.dumpAnimTimer = 0.001;
      truck.dumpReleasedInCycle = truck.storedCrates.length === 0;
      soundEngine.playHydraulicLift();
    };

    const handlePlayerPickupOrThrowCrate = () => {
      if (mountedTank) {
        if (mountedTank.vehicleKind === 'truck') {
          if ((mountedTank.dumpAnimTimer ?? 0) > 0) return;
          // Pressing [E] inside the Dump Truck operates the hydraulic dump bed to unload crates
          // (Trucks no longer auto-scoop crates from the ground — the character must load crates one-by-one on foot!)
          startDumpTruckHydraulicUnload(
            mountedTank,
            mountedTank.storedCrates.length > 0 ? undefined : 'ground',
          );
          return;
        }

        if (mountedTank.storedCrates.length > 0) {
          const distToPad = getPlanetShortestDistance(mountedTank.x, mountedTank.z, blueBase.padX, blueBase.padZ);
          if (distToPad <= 9.0) {
            while (mountedTank.storedCrates.length > 0) {
              const cKind = mountedTank.storedCrates[0];
              if (!addCrateToPadSlots('blue', cKind, 0)) break;
              mountedTank.storedCrates.shift();
            }
            soundEngine.playPickup();
            return;
          }
        }
        return;
      }

      if (!playerUnit.alive || ridingTramCarIdx !== null) return;

      // Case A: Already carrying a crate above head -> Load 1 crate into nearby Dump Truck, or Throw toward Stacking Pad / forward!
      if (playerUnit.carryingCrate !== 'none') {
        const carriedKind = playerUnit.carryingCrate;
        const fwdX = Math.cos(playerUnit.yaw);
        const fwdZ = -Math.sin(playerUnit.yaw);
        const throwX = wrapPlanetCoord(playerUnit.x + fwdX * 2.4);
        const throwZ = wrapPlanetCoord(playerUnit.z + fwdZ * 2.4);

        // Priority 1: Manual One-by-One Loading into nearest Dump Truck Vessel (within 2.9m)!
        let targetTruck: TankVehicle | null = null;
        let bestTruckDist = INTERACT_EXIT_RADIUS;
        for (const v of tanks) {
          if (
            v.vehicleKind === 'truck' &&
            v.hp > 0 &&
            canLoadCrateIntoDumpTruck(v.storedCrates.length, (v.dumpAnimTimer ?? 0) > 0, true)
          ) {
            const rearX = wrapPlanetCoord(v.x - Math.cos(v.hullYaw) * 1.45);
            const rearZ = wrapPlanetCoord(v.z + Math.sin(v.hullYaw) * 1.45);
            const dPlayer = Math.min(
              getPlanetShortestDistance(playerUnit.x, playerUnit.z, v.x, v.z),
              getPlanetShortestDistance(playerUnit.x, playerUnit.z, rearX, rearZ),
            );
            const dThrow = Math.min(
              getPlanetShortestDistance(throwX, throwZ, v.x, v.z),
              getPlanetShortestDistance(throwX, throwZ, rearX, rearZ),
            );
            const effDist = Math.min(dPlayer, dThrow);
            if (effDist <= bestTruckDist) {
              bestTruckDist = effDist;
              targetTruck = v;
            }
          }
        }

        if (targetTruck && carriedKind !== 'medical') {
          playerUnit.carryingCrate = 'none';
          playerUnit.overheadCrateGroup.visible = false;
          targetTruck.storedCrates.push(carriedKind);
          syncBlitzDumpTruckCargoVisuals(targetTruck.bodyGroup, targetTruck.storedCrates);
          spawnBurstParticles(targetTruck.x, 1.85, targetTruck.z, 10);
          soundEngine.playPickup();
          return;
        }

        playerUnit.carryingCrate = 'none';
        playerUnit.overheadCrateGroup.visible = false;
        soundEngine.playCrateThrow();

        const nearestKioskInfo = findNearestBaseKiosk(playerUnit.x, playerUnit.z);
        const targetCmdPlot =
          nearestKioskInfo.team === 'blue'
            ? blueCommanderBases[nearestKioskInfo.plotIndex]
            : redCommanderBases[nearestKioskInfo.plotIndex];
        const targetCmdPad =
          nearestKioskInfo.team === 'blue'
            ? blueBase.commanderPads[nearestKioskInfo.plotIndex]
            : redBase.commanderPads[nearestKioskInfo.plotIndex];
        if (
          targetCmdPlot &&
          targetCmdPad &&
          isCommanderBasePlotActive(targetCmdPlot) &&
          getPlanetShortestDistance(playerUnit.x, playerUnit.z, targetCmdPad.padX, targetCmdPad.padZ) <=
            INTERACT_EXIT_RADIUS + 1.2
        ) {
          if (addCrateToPadSlots(nearestKioskInfo.team, carriedKind, nearestKioskInfo.plotIndex)) {
            score += carriedKind === 'legend' ? 95 : carriedKind === 'super' ? 60 : 30;
            spawnBurstParticles(targetCmdPad.padX, 1.8, targetCmdPad.padZ, 10);
            soundEngine.playPickup();
            return;
          }
        }

        // Check Public Warzone Crate Pads (No Kiosk — Free-to-Play players can stack crates & kick [F] to craft weapons!)
        for (let pwi = 0; pwi < publicWarzonePads.length; pwi++) {
          const pubPad = publicWarzonePads[pwi];
          if (
            getPlanetShortestDistance(playerUnit.x, playerUnit.z, pubPad.worldX, pubPad.worldZ) <=
              INTERACT_EXIT_RADIUS + 1.2 &&
            carriedKind !== 'medical'
          ) {
            const pSlots = publicWarzonePadSlotsList[pwi];
            const nextSlotIdx = chooseNextPadSlotIndex(pSlots, 'AUTO');
            if (nextSlotIdx !== -1) {
              pSlots[nextSlotIdx] =
                carriedKind === 'legend' || carriedKind === 'gold_metallic'
                  ? 'legend'
                  : carriedKind === 'super' || carriedKind === 'silver_metallic'
                    ? 'super'
                    : 'red';
              syncPublicWarzonePadVisual(pwi);
              score += carriedKind === 'legend' ? 95 : carriedKind === 'super' ? 60 : 30;
              spawnBurstParticles(pubPad.worldX, 1.8, pubPad.worldZ, 10);
              soundEngine.playPickup();
              return;
            }
          }
        }

        // Otherwise throw crate forward onto the ground with momentum (never lost to worldCrates cap or wall clipping)
        let launchX = wrapPlanetCoord(playerUnit.x + fwdX * 0.95);
        let launchZ = wrapPlanetCoord(playerUnit.z + fwdZ * 0.95);
        const throwCheckObbs = getStaticWorldStructures();
        for (let oi = 0; oi < throwCheckObbs.length; oi++) {
          const obb = throwCheckObbs[oi];
          if (pointInObb2D(launchX, launchZ, obb.x, obb.z, obb.halfX, obb.halfZ, obb.rotY, 0.72)) {
            launchX = playerUnit.x;
            launchZ = playerUnit.z;
            break;
          }
        }
        const thrownCrate = spawnWorldCrate(carriedKind, launchX, launchZ, true, true);
        if (thrownCrate) {
          const groundY = getTerrainElevation(launchX, launchZ) + 0.66;
          thrownCrate.y = groundY + 1.15;
          thrownCrate.mesh.position.set(launchX, thrownCrate.y, launchZ);
          thrownCrate.rotY = playerUnit.yaw;
          thrownCrate.mesh.rotation.y = thrownCrate.rotY;
          thrownCrate.vx = fwdX * 10.6 + playerUnit.vx * 0.35;
          thrownCrate.vz = fwdZ * 10.6 + playerUnit.vz * 0.35;
          thrownCrate.vy = 4.2;
          thrownCrate.rotVelY = (Math.random() - 0.5) * 2.4;
          thrownCrate.squashTimer = 0;
          thrownCrate.mesh.scale.set(1, 1, 1);
          thrownCrate.mesh.visible = true;
        }
        return;
      }

      // Case B: Not carrying -> Find nearest grounded crate within 2.9m and lift it overhead!
      let nearestCrate: WorldCrate | null = null;
      let bestDist = INTERACT_EXIT_RADIUS;
      for (const c of worldCrates) {
        if (c.state === 'grounded' || c.state === 'falling') {
          const d = getPlanetShortestDistance(c.x, c.z, playerUnit.x, playerUnit.z);
          if (d <= bestDist) {
            bestDist = d;
            nearestCrate = c;
          }
        }
      }

      if (nearestCrate) {
        playerUnit.carryingCrate = nearestCrate.kind;
        if (playerUnit.overheadCrateGroup.userData.blitzBoxKind !== nearestCrate.kind) {
          populateRealBlitzCrateBoxFromGlb(
            playerUnit.overheadCrateGroup,
            nearestCrate.kind,
            loadedBlitzAssets,
            windUniforms,
            isSoftwareGl,
            UNIFIED_WORLD_CRATE_SIZE,
          );
        } else {
          playerUnit.overheadCrateBox.material = getCrateFallbackMaterial(nearestCrate.kind);
        }
        playerUnit.overheadCrateGroup.visible = true;
        scene.remove(nearestCrate.mesh);
        const idx = worldCrates.indexOf(nearestCrate);
        if (idx !== -1) worldCrates.splice(idx, 1);
        soundEngine.playPickup();
        return;
      }

      // Case B.2: Standing beside the Self-Service Tactical Kiosk (icon active or dist <= 2.9m) -> Open Tactical Kiosk UI!
      const kioskWorldPos = getBlueKioskWorldCenter(0);
      const distToKiosk = getPlanetShortestDistance(
        playerUnit.x,
        playerUnit.z,
        kioskWorldPos.x,
        kioskWorldPos.z,
      );
      if (isKioskPromptActive || distToKiosk <= INTERACT_EXIT_RADIUS) {
        soundEngine.playUiClick();
        emitHudImmediately();
        window.dispatchEvent(new CustomEvent('toggle-kiosk-ui'));
        return;
      }

      // Case C: Standing in the West Lobby Safe Zone Plaza (x in [-104.5, -75.0], |z| <= 38) -> Interact with the 2 Artisanal Kiosks & Pergola Pavilion!
      if (playerUnit.x <= -75.0 && playerUnit.x >= -104.5 && Math.abs(playerUnit.z) <= 38.0) {
        const skinCycle: BaseSkinThemeId[] = ['military_standard', 'cyber_neon', 'desert_ops', 'royal_gold'];
        const gardenCycle: BaseGardenPresetId[] = ['sakura_grove', 'zen_rock', 'golden_park', 'tactical_plaza'];
        const myBase = blueCommanderBases[0];
        if (playerUnit.z < -13.8) {
          const nextSkin = skinCycle[(skinCycle.indexOf(myBase.skinTheme) + 1) % skinCycle.length];
          myBase.skinTheme = nextSkin;
          playerUnit.saluteTimer = 2.0;
          playerUnit.saluteSign.updateText('KIOSK 1: HOUSE SKIN', BASE_SKIN_THEMES[nextSkin].name.toUpperCase(), '#38bdf8', 1);
          playerUnit.saluteSign.sprite.visible = true;
        } else if (playerUnit.z > 2.0) {
          const nextGarden = gardenCycle[(gardenCycle.indexOf(myBase.gardenPreset) + 1) % gardenCycle.length];
          myBase.gardenPreset = nextGarden;
          const gardenSpec = BASE_GARDEN_PRESETS.find((g) => g.id === nextGarden) || BASE_GARDEN_PRESETS[0];
          playerUnit.saluteTimer = 2.0;
          playerUnit.saluteSign.updateText('PAVILION: BASE GARDEN', gardenSpec.name.toUpperCase(), '#4ade80', 1);
          playerUnit.saluteSign.sprite.visible = true;
        } else {
          const nextSkin = skinCycle[(skinCycle.indexOf(myBase.skinTheme) + 1) % skinCycle.length];
          myBase.skinTheme = nextSkin;
          myBase.fenceHp = myBase.fenceMaxHp;
          playerUnit.saluteTimer = 2.0;
          playerUnit.saluteSign.updateText('KIOSK 2: FENCE SKIN', `${BASE_SKIN_THEMES[nextSkin].name.toUpperCase()} + FULL HP`, '#facc15', 1);
          playerUnit.saluteSign.sprite.visible = true;
        }
        soundEngine.playPowerCore();
        spawnBurstParticles(playerUnit.x, 2.2, playerUnit.z, 16);
        syncPadVisuals(blueBase, bluePadSlots, 'BLUE', blueBaseHp);
      }
    };

    const ensureBlueNuclearLauncherDeployed = (): NuclearLauncherTurretRig => {
      let nl = activeNuclearLaunchers.find((n) => n.team === 'blue');
      if (!nl) {
        nl = buildProceduralNuclearLauncherTurret(windUniforms, isSoftwareGl, 'blue');
        const nlX = wrapPlanetCoord(blueBase.padX - 6.2);
        const nlZ = wrapPlanetCoord(blueBase.padZ - 5.4);
        nl.root.position.set(nlX, getTerrainElevation(nlX, nlZ), nlZ);
        scene.add(nl.root);
        activeNuclearLaunchers.push(nl);
        spawnBurstParticles(nlX, 2.6, nlZ, 26);
      }
      return nl;
    };

    const craftFromCommanderPad = (
      team: 'blue' | 'red',
      commanderIdx = 0,
      isPlayerAction = false,
    ): boolean => {
      const isBlue = team === 'blue';
      const sign = isBlue ? 1 : -1;
      const baseObj = isBlue ? blueBase : redBase;
      const commanderBases = isBlue ? blueCommanderBases : redCommanderBases;
      const plotBase = commanderBases[commanderIdx] || commanderBases[0];
      if (plotBase && plotBase.destroyed) return false;

      const slotsList = isBlue ? bluePadSlotsList : redPadSlotsList;
      const slots = slotsList[commanderIdx] || slotsList[0];
      const padEval = evaluateStackingPadRecipe(slots);
      if (padEval.totalCrates === 0) return false;

      const activeOrder: BuildOrderTarget =
        (isBlue && commanderIdx === 0) ||
        (nearSessionState.claimedTeam === team && nearSessionState.claimedPlotIndex === commanderIdx)
          ? buildOrder
          : aiBuildOrders[commanderIdx % aiBuildOrders.length];

      const padMeshObj = baseObj.commanderPads[commanderIdx] || baseObj.commanderPads[0];
      playBuildBoxSoundAtPad(team, padMeshObj.padX, padMeshObj.padZ, isPlayerAction, () => {
        soundEngine.playBuildBoxCraft(!isPlayerAction);
      });
      spawnBurstParticles(padMeshObj.padX, 2.0, padMeshObj.padZ, 18);
      spawnDebrisChunks(
        padMeshObj.padX,
        1.15,
        padMeshObj.padZ,
        padEval.isSuper ? 'metal' : 'wood',
        10,
      );
      scratchExplosionPos.set(padMeshObj.padX, 1.15, padMeshObj.padZ);
      blitzExplosionSystem.spawnBlitzExplosion(scratchExplosionPos, 0.78, 'crate');

      const advanceBluePlayerBuildQueue = () => {
        if (!isBlue || (commanderIdx !== 0 && commanderIdx !== nearSessionState.claimedPlotIndex)) return;
        const qAdv = advanceKioskBuildQueueOnCraft(blueBuildQueue);
        blueBuildQueue = qAdv.queue;
        if (qAdv.hasMoreQueued && qAdv.nextActiveRecipe) {
          activePriorityRecipe = qAdv.nextActiveRecipe;
          useCustomHologramRecipe = true;
          hasActiveBuildContract = true;
          const nextSpec = KIOSK_BUILD_PRIORITY_RECIPES[activePriorityRecipe];
          if (nextSpec) {
            buildOrder = nextSpec.buildOrder;
            kioskStatusMessage = `CRAFTED! NEXT IN QUEUE (${blueBuildQueue.length}/${MAX_KIOSK_BUILD_QUEUE}): ${nextSpec.name.toUpperCase()}`;
            kioskStatusTimer = 4.5;
          }
        } else {
          useCustomHologramRecipe = false;
          hasActiveBuildContract = false;
        }
      };

      // Handle Base Upgrade & Facility Build Orders ('upgrade_building', 'upgrade_fence', 'build_parking', 'build_helipad')
      if (
        activeOrder === 'upgrade_building' ||
        activeOrder === 'upgrade_fence' ||
        activeOrder === 'build_parking' ||
        activeOrder === 'build_helipad'
      ) {
        const upgRes = applyCommanderBaseUpgrade(plotBase, activeOrder, padEval.totalCrates);
        if (!upgRes.upgraded) return false;
        if (isBlue) {
          blueBaseHp = blueCommanderBases.reduce((acc, b) => acc + b.buildingHp, 0);
          score += 320;
        } else {
          redBaseHp = redCommanderBases.reduce((acc, b) => acc + b.buildingHp, 0);
        }
        slotsList[commanderIdx] = createEmptyPadSlots();
        advanceBluePlayerBuildQueue();
        if (isBlue) {
          bluePadSlots = bluePadSlotsList[0];
          syncPadVisuals(blueBase, bluePadSlots, 'BLUE', blueBaseHp);
          emitHudImmediately();
        } else {
          redPadSlots = redPadSlotsList[0];
          syncPadVisuals(redBase, redPadSlots, 'RED', redBaseHp);
        }
        return true;
      }

      const spawnX = wrapPlanetCoord(padMeshObj.padX - sign * 3.4);
      const spawnZ = wrapPlanetCoord(padMeshObj.padZ - sign * 2.2);

      // Personal Helipad (relZ = -5.6, lx = 6.8, opposite Crate Pad) & Roofless Vehicle Parking Bay (relZ = -5.6, lx = 13.8, opposite Kiosk)
      // Both face RIGHT (+relZ / +X for Blue Base) across toward the Kiosk & central exit driveway!
      const heliX = wrapPlanetCoord(padMeshObj.padX - sign * 12.9);
      const heliZ = wrapPlanetCoord(padMeshObj.padZ + sign * 1.4);
      const bayX = wrapPlanetCoord(padMeshObj.padX - sign * 12.9);
      const bayZ = wrapPlanetCoord(padMeshObj.padZ - sign * 5.6);
      const bayParallelYaw = isBlue ? 0 : Math.PI;
      const customBlueRecipe: KioskBuildPriorityRecipeId | null =
        isBlue && commanderIdx === 0 && useCustomHologramRecipe ? activePriorityRecipe : null;

      if (customBlueRecipe === 'nuclear_launcher') {
        ensureBlueNuclearLauncherDeployed();
        score += 500;
        kioskStatusMessage =
          "MLRS-MK5 'ATLAS' NUCLEAR LAUNCHER DEPLOYED! PRESS [N] OR [E] AT LAUNCHER TO TARGET!";
        kioskStatusTimer = 5.0;
      } else if (
        customBlueRecipe === 'hand_grenade' ||
        customBlueRecipe === 'land_mine' ||
        customBlueRecipe === 'cluster_bomb'
      ) {
        if (playerUnit && playerUnit.alive) {
          if (customBlueRecipe === 'hand_grenade' || customBlueRecipe === 'land_mine') {
            playerUnit.tacticalLoadout = addTacticalSecondaryToLoadout(
              playerUnit.tacticalLoadout,
              customBlueRecipe,
              3,
            );
            syncUnitFieldsFromLoadout(playerUnit);
          } else {
            playerUnit.secondaryItem = customBlueRecipe;
            playerUnit.secondaryCount = Math.min(
              9,
              (playerUnit.secondaryItem === customBlueRecipe ? playerUnit.secondaryCount : 0) + 3,
            );
          }
        }
        const popSec = computeStackingPadWeaponPopOutTrajectory(
          padMeshObj.padX,
          padMeshObj.padZ,
          0,
          1,
          sign,
        );
        spawnWorldPickup(
          'secondary',
          customBlueRecipe === 'hand_grenade'
            ? 'HG-04 Frag Grenade'
            : customBlueRecipe === 'land_mine'
              ? 'TM-89 Land Mine'
              : 'CB-24 Cluster Bomb',
          popSec.startX,
          popSec.startZ,
          {
            secondaryId: customBlueRecipe,
            secondaryCount: 3,
            vx: popSec.vx,
            vy: popSec.vy,
            vz: popSec.vz,
            despawnTimerSec: TEAM_BUDDIES_CRAFTED_WEAPON_DESPAWN_SEC,
          },
        );
        score += 180;
      } else if (customBlueRecipe === 'laser_gun' || customBlueRecipe === 'gatling_mortar') {
        const isGat = customBlueRecipe === 'gatling_mortar';
        const popSpecial = computeStackingPadWeaponPopOutTrajectory(
          padMeshObj.padX,
          padMeshObj.padZ,
          0,
          1,
          sign,
        );
        spawnWorldPickup(
          'weapon',
          isGat ? 'TITAN-6 Rotary Gatling' : 'LG-88 Photon Lance',
          popSpecial.startX,
          popSpecial.startZ,
          {
            weaponId: 'rifle',
            remainingAmmo: isGat ? 240 : 140,
            vx: popSpecial.vx,
            vy: popSpecial.vy,
            vz: popSpecial.vz,
            despawnTimerSec: TEAM_BUDDIES_CRAFTED_WEAPON_DESPAWN_SEC,
          },
        );
        score += isGat ? 320 : 220;
      } else if (padEval.spawnType === 'plane') {
        // 8 Crates (2x2x2) with Legend Crate -> Auto-build Helipad in Plot & Spawn Pesawat Pengebom / Blitz Fighter Plane facing RIGHT!
        plotBase.hasHelipad = true;
        const newPlane = createBlitzPlaneVehicle(heliX, heliZ, team);
        newPlane.maxHp = 620;
        newPlane.hp = 620;
        newPlane.hullYaw = bayParallelYaw;
        newPlane.bodyGroup.rotation.y = newPlane.hullYaw;
        tanks.push(newPlane);
        spawnBurstParticles(heliX, 2.2, heliZ, 22);
        if (isBlue) score += 650;
      } else if (padEval.spawnType === 'tank') {
        // 8 Crates (2x2x2) -> Heavy Tank (2 Kursi) or Super Tank (Laser / Mammoth Tyrant Tank with 2.2x Armor when Blue Crates used)!
        plotBase.hasParkingBay = true;
        const newTank = createBlitzTankVehicle(bayX, bayZ, padEval.isSuper, team);
        const armorMult = padEval.vehicleStatMultiplier?.armorMultiplier ?? (padEval.isSuper ? 2.2 : 1.0);
        newTank.maxHp = Math.round(260 * armorMult);
        newTank.hp = newTank.maxHp;
        newTank.hullYaw = bayParallelYaw;
        newTank.turretYaw = bayParallelYaw;
        newTank.bodyGroup.rotation.y = newTank.hullYaw;
        newTank.turretGroup.rotation.y = 0;
        tanks.push(newTank);
        spawnBurstParticles(bayX, 2.0, bayZ, 20);
        if (isBlue) score += padEval.isSuper ? 500 : 350;
      } else if (padEval.spawnType === 'truck') {
        // 4 Flat Crates (2x2x1) -> Senjata Berat / Auto-Turret (Tier 3) + Drivable Blitz Dump Truck!
        plotBase.hasParkingBay = true;
        const newTruck = createBlitzDumpTruckVehicle(bayX, bayZ, team, bayParallelYaw);
        if (padEval.isSuper) {
          newTruck.maxHp = 480;
          newTruck.hp = 480;
        }
        tanks.push(newTruck);
        // Also pop out Tier 3 Heavy Weapon (Gatling Gun / Homing Missile Launcher) to the pad perimeter border!
        const tier3WeaponLabel = padEval.isSuper
          ? 'Homing Missile Launcher (Tier 3 Super)'
          : 'Gatling Gun / Mortar (Tier 3)';
        const pop3 = computeStackingPadWeaponPopOutTrajectory(
          padMeshObj.padX,
          padMeshObj.padZ,
          0,
          1,
          sign,
        );
        spawnWorldPickup('weapon', tier3WeaponLabel, pop3.startX, pop3.startZ, {
          weaponId: padEval.isSuper ? 'rocket' : 'rifle',
          remainingAmmo: 160,
          vx: pop3.vx,
          vy: pop3.vy,
          vz: pop3.vz,
          despawnTimerSec: TEAM_BUDDIES_CRAFTED_WEAPON_DESPAWN_SEC,
        });
        spawnBurstParticles(bayX, 2.0, bayZ, 18);
        if (isBlue) score += 280;
      } else if (padEval.spawnType === 'skyshield') {
        // 2 Horizontal Crates (2x1x1) with Blue/Purple -> Rebuild/Repair Skyshield 35mm Turret + Pop out Medium Tier-2 Super Weapon to pad border!
        const turrets = getBaseSkyshieldTurrets(baseObj.baseGroup);
        const ownTurret = turrets[commanderIdx % Math.max(1, turrets.length)];
        const targetTurret =
          ownTurret && !ownTurret.isBuilt
            ? ownTurret
            : turrets.find((st) => !st.isBuilt) || ownTurret;
        if (targetTurret) {
          targetTurret.isBuilt = true;
          targetTurret.maxHp = padEval.isLegend ? 420 : 320;
          targetTurret.hp = targetTurret.maxHp;
          targetTurret.root.visible = true;
          const tIdx = turrets.indexOf(targetTurret);
          const teamBases = isBlue ? blueCommanderBases : redCommanderBases;
          if (tIdx >= 0 && teamBases[tIdx]) {
            teamBases[tIdx].hasSkyshield = true;
          }
          plotBase.hasSkyshield = true;
          const twx = isBlue ? baseObj.hqX + targetTurret.localZ : baseObj.hqX - targetTurret.localZ;
          const twz = isBlue ? baseObj.hqZ - targetTurret.localX : baseObj.hqZ + targetTurret.localX;
          spawnBurstParticles(twx, 3.2, twz, 24);
        }
        const popSky = computeStackingPadWeaponPopOutTrajectory(
          padMeshObj.padX,
          padMeshObj.padZ,
          0,
          1,
          sign,
        );
        spawnWorldPickup(
          'weapon',
          padEval.isLegend ? 'Ion Cannon Rifle (Tier 2 Legend)' : 'Laser Gun / Super Bazooka (Tier 2)',
          popSky.startX,
          popSky.startZ,
          {
            weaponId: 'rocket',
            remainingAmmo: 60,
            vx: popSky.vx,
            vy: popSky.vy,
            vz: popSky.vz,
            despawnTimerSec: TEAM_BUDDIES_CRAFTED_WEAPON_DESPAWN_SEC,
          },
        );
        if (isBlue) score += 320;
      } else if (padEval.spawnType === 'buddy') {
        // 2 Vertical (1x1x2 -> Unit Pasukan / Super Buddy 2x HP & Speed) or 4 Vertical (2x1x2 -> Kendaraan Ringan Mini-Tank 1 Kursi + Super Unit)
        if (padEval.shapeKey === '2x1x2') {
          // 4 Vertical Wall Crates (2x1x2) -> Spawn Kendaraan Ringan: Agile 1-Seat Mini-Tank (or Super Laser Mini-Tank with Blue crates)!
          plotBase.hasParkingBay = true;
          const miniTank = createBlitzTankVehicle(bayX, bayZ, padEval.isSuper, team);
          miniTank.bodyGroup.scale.multiplyScalar(0.8);
          miniTank.maxHp = padEval.isSuper ? 320 : 180;
          miniTank.hp = miniTank.maxHp;
          miniTank.hullYaw = bayParallelYaw;
          miniTank.turretYaw = bayParallelYaw;
          miniTank.bodyGroup.rotation.y = miniTank.hullYaw;
          miniTank.turretGroup.rotation.y = 0;
          tanks.push(miniTank);
          spawnBurstParticles(bayX, 1.8, bayZ, 16);
        }
        const ownedAlive = buddyUnits.filter(
          (b) => b.team === team && b.alive && b.ownerCommanderId === commanderIdx,
        );
        if (canCommanderBuildCharacter(ownedAlive.length, MAX_CHARACTERS_PER_COMMANDER)) {
          let chosenClass: BuddyClassId = BLUE_BUDDY_ROTATION[blueBuddyClassIdx % BLUE_BUDDY_ROTATION.length];
          blueBuddyClassIdx++;
          if (isBlue && commanderIdx === 0 && useCustomHologramRecipe) {
            if (activePriorityRecipe === 'buddy_ninja') chosenClass = 'Ninja';
            else if (activePriorityRecipe === 'buddy_infantry') chosenClass = 'Infuntry';
            else if (activePriorityRecipe === 'buddy_commando') chosenClass = 'Commando';
            else if (activePriorityRecipe === 'buddy_super_wall') chosenClass = 'SuperBuddie';
          } else if (padEval.category === 'buddy_t2') {
            chosenClass = padEval.isSuper ? 'SuperBuddie' : 'Cyborg';
          } else if (padEval.isLegend) {
            chosenClass = 'Ninja';
          } else if (padEval.isSuper) {
            chosenClass = 'Commando';
          }
          const newBuddy = createBuddyCharacterUnit(
            team,
            false,
            chosenClass,
            wrapPlanetCoord(spawnX + (Math.random() - 0.5) * 2),
            wrapPlanetCoord(spawnZ + (Math.random() - 0.5) * 2),
            commanderIdx,
            false,
            false,
          );
          // Team Buddies Upgrade Tier: Vertical stack of 2 Blue ('super') crates births a Super Buddy with 2x HP (200+ HP)!
          if (padEval.isSuper) {
            const hpMult = padEval.buddyStatMultiplier?.hpMultiplier ?? 2.0;
            newBuddy.maxHp = Math.max(200, Math.round(100 * hpMult));
            newBuddy.hp = newBuddy.maxHp;
            newBuddy.weaponId = padEval.isLegend ? 'bazooka' : 'rifle';
            newBuddy.weaponName = padEval.isLegend
              ? 'Nuclear Launcher (Super Weapon)'
              : 'Super Shotgun (Spread + Bounce)';
            newBuddy.ammo = 160;
          }
          buddyUnits.push(newBuddy);
          if (isBlue) score += 220;
        } else {
          // Commander already has 4/4 characters -> Heal & upgrade weapons of all 4 owned characters!
          ownedAlive.forEach((ob) => {
            if (padEval.isSuper) {
              ob.maxHp = Math.max(ob.maxHp, 200);
            }
            ob.hp = ob.maxHp;
            const upgWeaponName = padEval.isSuper ? 'BlitzRocketLauncher' : 'BlitzAssaultRifle';
            ob.tacticalLoadout = equipOrSwapDroppedWeaponInLoadout(
              ob.tacticalLoadout,
              upgWeaponName,
              240,
            ).updatedLoadout;
            syncUnitFieldsFromLoadout(ob);
          });
          if (isBlue) score += 180;
        }
      } else {
        // 1x1x1 (Senjata Ringan Tier 1) or 2x1x1 (Senjata Menengah Tier 2):
        // Team Buddies Physics Pop-out (`Terpental ke Sekitar Pad`): Weapon pops out from the Stacking Pad
        // and lands around the pad perimeter border so the pad is immediately free to stack crates again!
        const wName = padEval.crateSchemeVariantName || padEval.outputName;
        const mappedWeaponId: 'pistol' | 'rifle' | 'rocket' =
          padEval.weaponId === 'rocket'
            ? 'rocket'
            : padEval.weaponId === 'rifle'
            ? 'rifle'
            : 'pistol';
        const popMain = computeStackingPadWeaponPopOutTrajectory(
          padMeshObj.padX,
          padMeshObj.padZ,
          0,
          1 + (padEval.leftoverWeaponDrops?.length ?? 0),
          sign,
        );
        spawnWorldPickup('weapon', wName, popMain.startX, popMain.startZ, {
          weaponId: mappedWeaponId,
          remainingAmmo: padEval.isLegend ? 24 : padEval.isSuper ? 120 : 90,
          vx: popMain.vx,
          vy: popMain.vy,
          vz: popMain.vz,
          despawnTimerSec: TEAM_BUDDIES_CRAFTED_WEAPON_DESPAWN_SEC,
        });
        if (isBlue) score += 140;
      }

      // Team Buddies Odd-Stack Breakdown (`Catatan Mekanis: Jumlah Tanggung 3, 5, 6, atau 7 Peti`):
      // Excess crates beyond the nearest valid lower pattern (1, 2, or 4 crates) pop out around the pad perimeter border!
      if (padEval.leftoverWeaponDrops && padEval.leftoverWeaponDrops.length > 0) {
        const totalPopCount = 1 + padEval.leftoverWeaponDrops.length;
        padEval.leftoverWeaponDrops.forEach((leftover, idx) => {
          const popExtra = computeStackingPadWeaponPopOutTrajectory(
            padMeshObj.padX,
            padMeshObj.padZ,
            idx + 1,
            totalPopCount,
            sign,
          );
          spawnWorldPickup('weapon', leftover.outputName, popExtra.startX, popExtra.startZ, {
            weaponId: leftover.weaponId,
            remainingAmmo: leftover.isLegend ? 16 : leftover.isSuper ? 80 : 60,
            vx: popExtra.vx,
            vy: popExtra.vy,
            vz: popExtra.vz,
            despawnTimerSec: TEAM_BUDDIES_CRAFTED_WEAPON_DESPAWN_SEC,
          });
        });
        if (isPlayerAction && playerUnit) {
          playerUnit.saluteTimer = 2.0;
          playerUnit.saluteSign.updateText(
            `ODD STACK (${padEval.totalCrates} CRATES)`,
            `${padEval.outputName.toUpperCase()} + ${padEval.leftoverWeaponDrops.length} WEAPON DROPS!`,
            '#facc15',
            1,
          );
          playerUnit.saluteSign.sprite.visible = true;
        }
      }

      slotsList[commanderIdx] = createEmptyPadSlots();
      if (padEval.spawnType === 'buddy') {
        // Crafting a Buddy on the Pad spawns/replenishes Pure Harvesters (max 2 per Base)
        spawnContractHarvestersForPlot(team, commanderIdx, MAX_HARVESTERS_PER_BASE);
      } else {
        // CONTRACT FULFILLED: Box shatters into ordered weapon/vehicle -> Contract Harvesters automatically shatter/despawn with particles!
        despawnContractHarvestersOnFulfilled(team, commanderIdx, padEval.outputName);
      }
      advanceBluePlayerBuildQueue();
      if (isBlue) {
        bluePadSlots = bluePadSlotsList[0];
        syncPadVisuals(blueBase, bluePadSlots, 'BLUE', blueBaseHp);
        emitHudImmediately();
      } else {
        redPadSlots = redPadSlotsList[0];
        syncPadVisuals(redBase, redPadSlots, 'RED', redBaseHp);
      }
      return true;
    };

    const disembarkFromCityTram = () => {
      if (ridingTramCarIdx === null) return false;
      const tramNow = cityTram.getState();
      const carPose = ridingTramCarIdx === 0 ? tramNow.car1 : tramNow.car2;
      const rightExit = computeCityTramDisembarkPosition(carPose, 1);
      const leftExit = computeCityTramDisembarkPosition(carPose, -1);
      const isRightSafe =
        evaluateOuterEmbankmentSdf(rightExit.x, rightExit.z) < -1.0 &&
        evaluateNwLakeSdf(rightExit.x, rightExit.z) > 0.3 &&
        evaluateSeHarborSdf(rightExit.x, rightExit.z).waterSdf > 0.3;
      const chosenExit = isRightSafe ? rightExit : leftExit;
      soundEngine.playUiClick();
      soundEngine.updateVehicleMovementLoop(0, false, false);
      playerUnit.x = wrapPlanetCoord(chosenExit.x);
      playerUnit.z = wrapPlanetCoord(chosenExit.z);
      playerUnit.vx = 0;
      playerUnit.vz = 0;
      playerUnit.root.position.set(
        playerUnit.x,
        getTerrainElevation(playerUnit.x, playerUnit.z),
        playerUnit.z,
      );
      playerUnit.root.visible = true;
      playerUnit.saluteTimer = 1.25;
      playerUnit.saluteSign.updateText('EXITED TRAM!', 'COMBAT READY', '#00d2ff', 1);
      playerUnit.saluteSign.sprite.visible = true;
      ridingTramCarIdx = null;
      return true;
    };

    const handlePlayerJump = () => {
      if (ridingTramCarIdx !== null) {
        disembarkFromCityTram();
        return;
      }
      if (mountedTank || !playerUnit || !playerUnit.alive) return;
      if (playerUnit.isSitting && activeSeatedSpot) {
        playerUnit.x = wrapPlanetCoord(activeSeatedSpot.x + Math.cos(activeSeatedSpot.yaw) * 0.88);
        playerUnit.z = wrapPlanetCoord(activeSeatedSpot.z - Math.sin(activeSeatedSpot.yaw) * 0.88);
        activeSeatedSpot = null;
        isOrbitingSeatedCamera = false;
      }
      playerUnit.isSitting = false;
      playerUnit.isDriving = false;
      // Set jump input buffer to 0.1s; if already grounded on this frame, fire immediately and reset buffer to 0
      playerUnit.jumpBufferTimer = JUMP_BUFFER_DURATION_SEC;
      const spec = BUDDY_CLASSES[playerUnit.classId];
      const jumpStep = stepBuddyJumpPhysicsWithBuffer(
        playerUnit.jumpOffset,
        playerUnit.vy,
        playerUnit.isGrounded,
        playerUnit.jumpBufferTimer,
        true,
        spec.jumpMultiplier,
        playerUnit.carryingCrate !== 'none',
        0.016,
      );
      playerUnit.jumpBufferTimer = jumpStep.jumpBufferTimer;
      if (jumpStep.justJumped) {
        playerUnit.jumpOffset = jumpStep.jumpOffset;
        playerUnit.vy = jumpStep.vy;
        playerUnit.isGrounded = false;
        soundEngine.playJump();
        const groundY = getTerrainElevation(playerUnit.x, playerUnit.z);
        spawnBurstParticles(playerUnit.x, groundY + 0.18, playerUnit.z, 6);
      }
    };

    const performBuddyMeleeAttack = (attacker: BuddyUnit, kind: 'punch' | 'kick'): boolean => {
      if (!attacker.alive) return false;
      if (
        worldModeRef.current === 'lobby' ||
        worldModeRef.current === 'safezone' ||
        cityArenaMode === 'safezone' ||
        isPointInsideLobbySafezone(attacker.x, attacker.z)
      ) {
        return false;
      }
      if (kind === 'punch' && isUnitWeaponTriggerLockedInSafeShield(attacker.x, attacker.z, attacker.team)) {
        return false;
      }

      const listener = getPlayerAudioListenerPos();
      const meleeAudioGain = attacker.isPlayer
        ? 1.0
        : computeSpatialAudioGain(listener.x, listener.z, attacker.x, attacker.z, 18.0, 4.0) * 0.65;
      const playMeleeAudio = (fn: () => void) => {
        soundEngine.withSpatialGain(meleeAudioGain, fn);
      };

      if (kind === 'punch') {
        attacker.punchHand = attacker.punchHand === 'right' ? 'left' : 'right';
        attacker.punchTimer = 0.24;
        attacker.shootCooldown = 0.25;
      } else {
        attacker.kickTimer = 0.34;
      }

      const fwdX = Math.cos(attacker.yaw);
      const fwdZ = -Math.sin(attacker.yaw);
      const strikeWorldX = wrapPlanetCoord(attacker.x + fwdX * 1.15);
      const strikeWorldZ = wrapPlanetCoord(attacker.z + fwdZ * 1.15);
      const strikeGroundY = getTerrainElevation(strikeWorldX, strikeWorldZ) + attacker.jumpOffset;

      let hitAny = false;
      let hitCrate = false;

      // 1. Check Grounded Crates (Team Buddies Kick punts crates across the field; repeated hits smash open into pickups!)
      for (let ci = worldCrates.length - 1; ci >= 0; ci--) {
        const c = worldCrates[ci];
        if (c.state !== 'grounded') continue;
        const strike = evaluateBuddyMeleeStrike(
          attacker.x,
          attacker.z,
          attacker.yaw,
          c.x,
          c.z,
          0.85,
          kind,
        );
        if (!strike.hit) continue;

        hitAny = true;
        hitCrate = true;
        c.squashTimer = 0;
        c.mesh.scale.set(1, 1, 1);
        if (canDamageWorldCrate(c)) {
          c.hp -= kind === 'kick' ? 6 : 8;
        }

        if (canDamageWorldCrate(c) && c.hp <= 0) {
          playMeleeAudio(() => {
            soundEngine.playWoodBreak(10.5);
            soundEngine.playBarrelExplosion();
          });
          blitzExplosionSystem.spawnBlitzExplosion(
            new THREE.Vector3(c.x, getTerrainElevation(c.x, c.z) + 0.55, c.z),
            0.72,
            'crate',
          );
          spawnDebrisChunks(
            c.x,
            0.55,
            c.z,
            c.kind === 'super' ? 'metal' : 'wood',
            11,
            fwdX * 3.2,
            fwdZ * 3.2,
          );
          spawnBurstParticles(c.x, 0.9, c.z, 10);
          const crateDrop = evaluateCrateDestructionDrop(c.kind);
          spawnWorldPickup(crateDrop.dropKind, crateDrop.label, c.x, c.z, {
            weaponId: crateDrop.weaponId,
            remainingAmmo: crateDrop.remainingAmmo,
            vy: crateDrop.isPurpleSuperWeapon ? 6.8 : 5.4,
          });
          rewardPlayerOnCrateDestroyed(c.x, c.z);
          scene.remove(c.mesh);
          worldCrates.splice(ci, 1);
        } else {
          const mult = kind === 'kick' ? 1.0 : 0.62;
          c.vx = strike.knockbackVx * mult;
          c.vz = strike.knockbackVz * mult;
          c.vy = Math.max(c.vy, strike.upwardHopVy);
          c.rotVelY = (Math.random() - 0.5) * (kind === 'kick' ? 10.5 : 6.5);
          playMeleeAudio(() => {
            if (c.kind === 'super' || !canDamageWorldCrate(c)) {
              soundEngine.playMetalImpact(kind === 'kick' ? 10.5 : 7.5);
            } else {
              soundEngine.playWoodHit(kind === 'kick' ? 10.5 : 7.5);
            }
          });
          spawnBurstParticles(c.x, c.y + 0.35, c.z, kind === 'kick' ? 8 : 5);
        }
      }

      // 2. Check Enemy / Other Buddy Characters (Melee Damage + Knockback + Mid-Air Launch on Kick!)
      for (const other of buddyUnits) {
        if (!other.alive || other === attacker || other.team === attacker.team) continue;
        if (other.isPlayer && (mountedTank || ridingTramCarIdx !== null)) continue;
        if (!canApplyCombatDamage(attacker.team, other.team, attacker.x, attacker.z, other.x, other.z)) {
          continue;
        }
        const strike = evaluateBuddyMeleeStrike(
          attacker.x,
          attacker.z,
          attacker.yaw,
          other.x,
          other.z,
          0.88,
          kind,
        );
        if (!strike.hit) continue;

        hitAny = true;
        if (other.isPlayer) {
          const iFrameRes = applyPlayerDamageWithInvincibilityAndKnockback({
            hp: other.hp,
            invincibilityTimer: other.invincibilityTimer ?? 0,
            x: other.x,
            z: other.z,
            vx: other.vx,
            vz: other.vz,
            vy: other.vy,
            damage: strike.damage,
            sourceX: attacker.x,
            sourceZ: attacker.z,
            facingYaw: other.yaw,
            invincibilityDurationSec: PLAYER_INVINCIBILITY_DURATION_SEC,
          });
          if (!iFrameRes.damageApplied) {
            continue;
          }
          other.hp = iFrameRes.hp;
          other.invincibilityTimer = iFrameRes.invincibilityTimer;
          other.vx = iFrameRes.vx;
          other.vz = iFrameRes.vz;
          other.vy = iFrameRes.vy;
          other.jumpOffset = Math.max(other.jumpOffset, 0.08);
          other.isGrounded = false;
        } else {
          other.hp -= strike.damage;
          other.vx += strike.knockbackVx;
          other.vz += strike.knockbackVz;
        }
        other.hitFlashTimer = 0.15;
        other.hitReactionTimer = 0.60;
        other.hitReactionDirX = fwdX;
        other.hitReactionDirZ = fwdZ;
        if (kind === 'kick') {
          other.vy = Math.max(other.vy, strike.upwardHopVy * 0.85);
          other.jumpOffset = Math.max(other.jumpOffset, 0.12);
          other.isGrounded = false;
        }
        playMeleeAudio(() => {
          soundEngine.playEnemyHit();
        });
        spawnBurstParticles(other.x, other.y + 1.15, other.z, 10);

        if (other.hp <= 0) {
          other.alive = false;
          other.respawnTimer = 6.0;
          other.root.visible = false;
          playMeleeAudio(() => {
            soundEngine.playBarrelExplosion();
          });
          blitzExplosionSystem.spawnBlitzExplosion(
            new THREE.Vector3(other.x, getTerrainElevation(other.x, other.z) + 0.85, other.z),
            0.85,
            'fodder',
          );
          spawnBurstParticles(other.x, 1.4, other.z, 16);
          handleBuddyDeathDrops(other, false);
          if (other.team === 'red') {
            enemiesDefeated++;
            score += 150;
            gold += 150;
          } else if (other.isPlayer) {
            handlePlayerWarzoneDeath(other);
          }
          checkMatchDeathmatchWinCondition();
        }
      }

      // 3. Check Pushable & Breakable Map Props (Wheelbarrow, Barricade, Explosive Barrel, Concrete Fence, etc.)
      for (const mp of activeMapProps) {
        if (!mp.alive) continue;
        const strike = evaluateBuddyMeleeStrike(
          attacker.x,
          attacker.z,
          attacker.yaw,
          mp.x,
          mp.z,
          Math.max(0.75, mp.radius * 0.9),
          kind,
        );
        if (!strike.hit) continue;

        hitAny = true;
        if (mp.canJiggleOnHit) {
          mp.jiggleTimer = 0.35;
        }
        if (mp.category === 'pushable') {
          const massDiv = Math.max(0.65, mp.mass * 0.45);
          mp.vx += strike.knockbackVx / massDiv;
          mp.vz += strike.knockbackVz / massDiv;
          mp.rotVelY += (Math.random() - 0.5) * 9.0;
          playMeleeAudio(() => {
            soundEngine.playMaterialImpact(mp.materialTag, kind === 'kick' ? 10.0 : 7.5);
          });
          spawnCollisionContactParticles(
            strikeWorldX,
            strikeGroundY + 0.8,
            strikeWorldZ,
            -fwdX,
            -fwdZ,
            mp.materialTag,
            8.5,
          );
        } else if (mp.category === 'breakable' || (mp.category === 'solid' && mp.destructible)) {
          mp.hp -= strike.damage;
          if (mp.category !== 'solid') {
            mp.vx += strike.knockbackVx * 0.45;
            mp.vz += strike.knockbackVz * 0.45;
          }
          if (shouldShatterBreakableProp(mp.kind, 0, false, mp.hp)) {
            mp.alive = false;
            mp.wrapper.visible = false;
            score += 50;
            if (mp.kind === 'explosive_barrel') {
              triggerBarrelExplosion(mp.x, mp.z);
            } else if (mp.materialTag === 'wood') {
              playMeleeAudio(() => {
                soundEngine.playWoodBreak(11.5);
              });
              spawnDebrisChunks(mp.x, 0.55, mp.z, 'wood', 12, fwdX * 3.0, fwdZ * 3.0);
              spawnBurstParticles(mp.x, 0.9, mp.z, 10);
            } else {
              playMeleeAudio(() => {
                soundEngine.playHeavyThud(11.5, false);
              });
              spawnDebrisChunks(mp.x, 0.55, mp.z, 'concrete', 12, fwdX * 3.0, fwdZ * 3.0);
              spawnBurstParticles(mp.x, 0.9, mp.z, 10);
            }
          } else {
            playMeleeAudio(() => {
              soundEngine.playMaterialImpact(mp.materialTag, 8.5);
            });
            spawnCollisionContactParticles(
              strikeWorldX,
              strikeGroundY + 0.8,
              strikeWorldZ,
              -fwdX,
              -fwdZ,
              mp.materialTag,
              8.5,
            );
          }
        }
      }

      if (kind === 'punch') {
        playMeleeAudio(() => {
          soundEngine.playPunch(hitAny);
        });
        if (hitAny && attacker.isPlayer) {
          shakeTrauma = Math.min(1, shakeTrauma + 0.06);
        }
      } else {
        playMeleeAudio(() => {
          soundEngine.playKick(hitAny);
        });
        if (hitAny && attacker.isPlayer) {
          shakeTrauma = Math.min(1, shakeTrauma + 0.11);
        } else if (!hitAny) {
          spawnBurstParticles(strikeWorldX, strikeGroundY + 0.55, strikeWorldZ, 3);
        }
      }

      return hitCrate || hitAny;
    };

    const cancelAndShatterBluePadBuild = (): boolean => {
      const slots = bluePadSlotsList[0];
      const shatterRes = evaluatePadCancelKickShatterDrops(slots);
      if (!shatterRes.cancelled || shatterRes.shatteredCrateCount === 0) return false;

      const padEval = evaluateStackingPadRecipe(slots);
      soundEngine.playKick(true);
      soundEngine.playBuildBoxCraft(false);
      shakeTrauma = Math.min(1, shakeTrauma + 0.14);

      spawnBurstParticles(blueBase.padX, 1.85, blueBase.padZ, 22);
      spawnDebrisChunks(
        blueBase.padX,
        1.15,
        blueBase.padZ,
        padEval.isSuper ? 'metal' : 'wood',
        14,
      );
      scratchExplosionPos.set(blueBase.padX, 1.15, blueBase.padZ);
      blitzExplosionSystem.spawnBlitzExplosion(scratchExplosionPos, 0.72, 'crate');

      // Pop out small items (Pistol, Granat, Medkit, Land Mine, Ammo, Coin) from the shattered boxes!
      for (let i = 0; i < shatterRes.drops.length; i++) {
        const drop = shatterRes.drops[i];
        const pop = computeStackingPadWeaponPopOutTrajectory(
          blueBase.padX,
          blueBase.padZ,
          i,
          shatterRes.drops.length,
          1,
        );
        spawnWorldPickup(drop.kind, drop.label, pop.startX, pop.startZ, {
          weaponId: drop.weaponId,
          remainingAmmo: drop.remainingAmmo,
          secondaryId: drop.secondaryId,
          secondaryCount: drop.secondaryCount,
          scoreValue: drop.coinValue,
          vx: pop.vx,
          vy: pop.vy,
          vz: pop.vz,
        });
      }

      // Clear pad slots and cancel the active build at the front of the queue
      bluePadSlotsList[0] = createEmptyPadSlots();
      bluePadSlots = bluePadSlotsList[0];
      if (blueBuildQueue.length > 0) {
        const qAdv = advanceKioskBuildQueueOnCraft(blueBuildQueue);
        blueBuildQueue = qAdv.queue;
        if (qAdv.hasMoreQueued && qAdv.nextActiveRecipe) {
          activePriorityRecipe = qAdv.nextActiveRecipe;
          useCustomHologramRecipe = true;
          const nextSpec = KIOSK_BUILD_PRIORITY_RECIPES[activePriorityRecipe];
          if (nextSpec) {
            buildOrder = nextSpec.buildOrder;
          }
        } else {
          useCustomHologramRecipe = false;
        }
      } else {
        useCustomHologramRecipe = false;
      }

      kioskStatusMessage =
        'BUILD CANCELLED! PAD CRATES SHATTERED INTO SMALL PICKUPS (PISTOL, GRENADE, MEDKIT)!';
      kioskStatusTimer = 4.5;

      if (playerUnit && playerUnit.alive) {
        playerUnit.saluteTimer = 2.0;
        playerUnit.saluteSign.updateText(
          'BUILD CANCELLED!',
          'CRATES SHATTERED INTO PISTOL / GRENADE / MEDKIT!',
          '#fb923c',
          1,
        );
        playerUnit.saluteSign.sprite.visible = true;
      }

      syncPadVisuals(blueBase, bluePadSlots, 'BLUE', blueBaseHp);
      emitHudImmediately();
      return true;
    };

    const craftFromPublicWarzonePad = (pubIdx: number): boolean => {
      const pubPad = publicWarzonePads[pubIdx];
      const pSlots = publicWarzonePadSlotsList[pubIdx];
      if (!pubPad || !pSlots) return false;
      const padEval = evaluateStackingPadRecipe(pSlots);
      if (padEval.totalCrates <= 0) return false;
      soundEngine.playBuildBoxCraft(padEval.isSuper);
      spawnBurstParticles(pubPad.worldX, 1.9, pubPad.worldZ, 20);
      scratchExplosionPos.set(pubPad.worldX, 1.15, pubPad.worldZ);
      blitzExplosionSystem.spawnBlitzExplosion(scratchExplosionPos, 0.72, 'crate');
      const pop = computeStackingPadWeaponPopOutTrajectory(pubPad.worldX, pubPad.worldZ, 0, 1, 1);
      const craftedWeaponName =
        padEval.totalCrates >= 4
          ? padEval.isSuper
            ? 'LG-88 Photon Lance'
            : 'TITAN-6 Rotary Gatling'
          : padEval.isSuper
            ? 'Blitz Bazooka'
            : 'Blitz Assault Rifle';
      spawnWorldPickup('weapon', craftedWeaponName, pop.startX, pop.startZ, {
        weaponId: craftedWeaponName === 'Blitz Bazooka' ? 'rocket' : 'rifle',
        remainingAmmo: padEval.isSuper ? 180 : 120,
        vx: pop.vx,
        vy: pop.vy,
        vz: pop.vz,
        despawnTimerSec: TEAM_BUDDIES_CRAFTED_WEAPON_DESPAWN_SEC,
      });
      publicWarzonePadSlotsList[pubIdx] = createEmptyPadSlots();
      syncPublicWarzonePadVisual(pubIdx);
      kioskStatusMessage = `PUBLIC WARZONE PAD: Berhasil merakit ${craftedWeaponName.toUpperCase()} tanpa Kiosk!`;
      kioskStatusTimer = 4.2;
      emitHudImmediately();
      return true;
    };

    const handlePlayerKickOrCraft = () => {
      if (ridingTramCarIdx !== null) {
        disembarkFromCityTram();
        emitHudImmediately();
        return;
      }
      if (!mountedTank && playerUnit && playerUnit.alive) {
        const tramCheck = canUnitBoardCityTramAtAnyPoint(
          playerUnit.x,
          playerUnit.z,
          cityTram.getState(),
          cityArenaMode === 'safezone' ? 6.2 : 3.4,
        );
        if (tramCheck.canBoard) {
          soundEngine.playPickup();
          ridingTramCarIdx = tramCheck.carIndex;
          playerUnit.vx = 0;
          playerUnit.vz = 0;
          playerUnit.root.visible = true;
          playerUnit.overheadCrateGroup.visible = playerUnit.carryingCrate !== 'none';
          emitHudImmediately();
          return;
        }
      }
      if (cityArenaMode === 'safezone') {
        return;
      }
      const actorX = mountedTank ? mountedTank.x : playerUnit.x;
      const actorZ = mountedTank ? mountedTank.z : playerUnit.z;
      const distToPad = getPlanetShortestDistance(actorX, actorZ, blueBase.padX, blueBase.padZ);
      const padEval = evaluateStackingPadRecipe(bluePadSlots);
      const nearestKiosk = findNearestBaseKiosk(actorX, actorZ);
      const distToKiosk = nearestKiosk.distance;

      // Check if kicking a Public Warzone Crate Pad with stacked boxes -> craft weapon directly!
      for (let pwi = 0; pwi < publicWarzonePads.length; pwi++) {
        const pubPad = publicWarzonePads[pwi];
        const pubSlots = publicWarzonePadSlotsList[pwi];
        if (
          getPlanetShortestDistance(actorX, actorZ, pubPad.worldX, pubPad.worldZ) <=
            INTERACT_EXIT_RADIUS + 0.8 &&
          pubSlots.some((s) => s !== 'empty')
        ) {
          craftFromPublicWarzonePad(pwi);
          return;
        }
      }

      if (mountedTank) {
        if ((isPadCraftPromptActive || distToPad <= INTERACT_EXIT_RADIUS) && padEval.totalCrates > 0) {
          cancelAndShatterBluePadBuild();
        } else if (isKioskPromptActive || distToKiosk <= INTERACT_EXIT_RADIUS) {
          soundEngine.playUiClick();
          emitHudImmediately();
          window.dispatchEvent(new CustomEvent('toggle-kiosk-ui'));
        }
        return;
      }

      if (!playerUnit || !playerUnit.alive) return;

      // If Kiosk icon is active / within 2.9m and not kicking stacked boxes on the Pad, [F] opens Tactical Kiosk modal!
      if (
        (isKioskPromptActive || distToKiosk <= INTERACT_EXIT_RADIUS) &&
        !((isPadCraftPromptActive || distToPad <= INTERACT_EXIT_RADIUS) && padEval.totalCrates > 0)
      ) {
        soundEngine.playUiClick();
        emitHudImmediately();
        window.dispatchEvent(new CustomEvent('toggle-kiosk-ui'));
        return;
      }

      // Always execute the Team Buddies Front Leg Kick on foot!
      const hitTarget = performBuddyMeleeAttack(playerUnit, 'kick');

      // Kicking ([F]) stacked boxes on the Crate Pad cancels the build and shatters the boxes into small items (Pistol, Grenade, Medkit, etc.)!
      if (!hitTarget && (isPadCraftPromptActive || distToPad <= INTERACT_EXIT_RADIUS) && padEval.totalCrates > 0) {
        cancelAndShatterBluePadBuild();
      }
    };

    const handleToggleMountTank = () => {
      // Disembark anywhere if currently riding the City Tram!
      if (ridingTramCarIdx !== null) {
        disembarkFromCityTram();
        return;
      }

      // Dismount if currently riding a Tank
      if (mountedTank) {
        soundEngine.playUiClick();
        soundEngine.updateVehicleMovementLoop(0, false, false);
        mountedTank.occupiedByPlayer = false;
        mountedTank.riderGroup.visible = false;
        playerUnit.x = wrapPlanetCoord(mountedTank.x - 2.6);
        playerUnit.z = wrapPlanetCoord(mountedTank.z + 1.2);
        playerUnit.root.position.set(playerUnit.x, getTerrainElevation(playerUnit.x, playerUnit.z), playerUnit.z);
        playerUnit.root.visible = true;
        mountedTank = null;
        return;
      }

      // Otherwise check if near the 2-Car City Tram anywhere along its route OR near any Tank/Plane/Truck!
      if (!playerUnit.alive || ridingTramCarIdx !== null) return;
      const tramBoard = canUnitBoardCityTramAtAnyPoint(
        playerUnit.x,
        playerUnit.z,
        cityTram.getState(),
        3.2,
      );
      let nearestTank: TankVehicle | null = null;
      let bestDist = 7.8;
      for (const t of tanks) {
        if (!t.occupiedByPlayer && t.hp > 0) {
          const d = getPlanetShortestDistance(t.x, t.z, playerUnit.x, playerUnit.z);
          if (d < bestDist) {
            bestDist = d;
            nearestTank = t;
          }
        }
      }

      if (tramBoard.canBoard && (!nearestTank || tramBoard.distanceMeters < bestDist)) {
        soundEngine.playPickup();
        ridingTramCarIdx = tramBoard.carIndex;
        playerUnit.vx = 0;
        playerUnit.vz = 0;
        playerUnit.root.visible = true;
        playerUnit.overheadCrateGroup.visible = playerUnit.carryingCrate !== 'none';
        return;
      }

      if (nearestTank) {
        soundEngine.playPickup();
        if (nearestTank.occupiedByAiId !== null) {
          const aiRider = buddyUnits.find((b) => b.id === nearestTank!.occupiedByAiId);
          if (aiRider) {
            aiRider.x = wrapPlanetCoord(nearestTank.x + 2.4);
            aiRider.z = wrapPlanetCoord(nearestTank.z + 1.2);
            aiRider.root.visible = true;
          }
          nearestTank.occupiedByAiId = null;
        }
        if (
          nearestTank.vehicleKind !== 'truck' &&
          playerUnit.carryingCrate !== 'none' &&
          playerUnit.carryingCrate !== 'medical' &&
          canLoadCrateIntoDumpTruck(
            nearestTank.storedCrates.length,
            (nearestTank.dumpAnimTimer ?? 0) > 0,
            true,
          )
        ) {
          nearestTank.storedCrates.push(playerUnit.carryingCrate);
          playerUnit.carryingCrate = 'none';
          playerUnit.overheadCrateGroup.visible = false;
        }
        mountedTank = nearestTank;
        nearestTank.occupiedByPlayer = true;
        playerUnit.isSitting = false;
        playerUnit.isDriving = false;
        activeSeatedSpot = null;
        clearCharacterSelection();
        const activeMountChar =
          getDefaultCharacterGender() === 'male'
            ? earlyLoadedManGltf ?? earlyLoadedCharGltf
            : earlyLoadedCharGltf;
        if (activeMountChar && nearestTank.riderGroup.userData.riderRig) {
          upgradeBuddyRigWithCharBuddiesGlb(
            nearestTank.riderGroup.userData.riderRig,
            activeMountChar,
          );
        }
        nearestTank.riderGroup.visible = nearestTank.vehicleKind !== 'truck';
        playerUnit.root.visible = false;
        playerUnit.saluteSign.sprite.visible = false;
      }
    };

    const handleCycleBuildOrder = () => {
      soundEngine.playUiClick();
      const recipeKeys = Object.keys(KIOSK_BUILD_PRIORITY_RECIPES) as KioskBuildPriorityRecipeId[];
      const curRecipeIdx = recipeKeys.indexOf(activePriorityRecipe);
      const nextRecipeId = recipeKeys[(curRecipeIdx + 1) % recipeKeys.length];
      activePriorityRecipe = nextRecipeId;
      if (blueBuildQueue.length > 0) {
        blueBuildQueue = [nextRecipeId, ...blueBuildQueue.slice(1)];
      } else {
        blueBuildQueue = [nextRecipeId];
      }
      useCustomHologramRecipe = true;
      const recipeSpec = KIOSK_BUILD_PRIORITY_RECIPES[nextRecipeId];
      buildOrder = recipeSpec.buildOrder;

      // Repack any existing crates on Blue Pad P1 into the new color-coded hologram slots!
      const existingCrates = bluePadSlots.filter((s) => s !== 'empty') as ('red' | 'super' | 'legend')[];
      bluePadSlots = ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'];
      bluePadSlotsList[0] = bluePadSlots;
      for (const kind of existingCrates) {
        const slotIdx = chooseNextPadSlotIndexForHologram(
          bluePadSlots,
          recipeSpec.slotHologramColors,
          kind,
          buildOrder,
        );
        if (slotIdx !== -1) {
          bluePadSlots[slotIdx] = kind;
        } else {
          spawnWorldCrate(kind, blueBase.padX - 3.2, blueBase.padZ - 1.5, true);
        }
      }
      syncPadVisuals(blueBase, bluePadSlots, 'BLUE', blueBaseHp);
    };

    const triggerAlliedSalute = (saluteLabel: string) => {
      for (const b of buddyUnits) {
        if (b.team === 'blue' && !b.isPlayer && b.alive && b.ownerCommanderId === 0) {
          b.saluteTimer = 1.65;
          b.saluteSign.updateText('HORMAT!', saluteLabel, '#b8ff3c', 1);
          b.saluteSign.sprite.visible = true;
        }
      }
    };

    const syncSquadRoleWithTeamCommand = (
      nextCmd: TeamCommandMode,
      forceAllOwnedUnits: boolean,
    ) => {
      const myPlot = blueCommanderBases[0];
      for (const b of buddyUnits) {
        if (b.team === 'blue' && !b.isPlayer && b.alive && b.ownerCommanderId === 0) {
          const isStationedRadarDefender =
            b.assignedRole === 'DEFEND' &&
            myPlot &&
            isUnitInPersonalCommandCenterArea(b.x, b.z, myPlot);
          if (forceAllOwnedUnits || (!b.hasIndividualRoleAssigned && !isStationedRadarDefender)) {
            b.assignedRole = nextCmd;
          }
        }
      }
    };

    const handleCursorOrCycleTeamCommand = (useCursorTarget: boolean) => {
      soundEngine.playUiClick();
      const freeBlueTanks = tanks.filter(
        (t) => t.team === 'blue' && !t.occupiedByPlayer && t.occupiedByAiId === null && t.hp > 0,
      );

      if (useCursorTarget) {
        const res = resolveCursorCommandTarget({
          cursorX: aimWorldPoint.x,
          cursorZ: aimWorldPoint.z,
          crates: worldCrates.filter((c) => c.state === 'grounded' || c.state === 'falling'),
          enemies: buddyUnits.filter((b) => b.team === 'red' && b.alive),
          emptyTanks: freeBlueTanks,
          blueBase: { x: blueBase.hqX, z: blueBase.hqZ, padX: blueBase.padX, padZ: blueBase.padZ },
          redBase: { x: redBase.hqX, z: redBase.hqZ, padX: redBase.padX, padZ: redBase.padZ },
          currentCommand: teamCommand,
        });
        teamCommand = res.command;
        playerUnit.assignedRole = teamCommand;
        syncSquadRoleWithTeamCommand(teamCommand, true);
        triggerAlliedSalute(res.saluteLabel);
      } else {
        const idx = COMMAND_CYCLE.indexOf(teamCommand);
        teamCommand = COMMAND_CYCLE[(idx + 1) % COMMAND_CYCLE.length];
        playerUnit.assignedRole = teamCommand;
        syncSquadRoleWithTeamCommand(teamCommand, false);
        const roleUiLabel = formatBuddyRoleUiLabel(teamCommand).toUpperCase();
        playerUnit.saluteTimer = 1.65;
        playerUnit.saluteSign.updateText('PERAN UNIT', roleUiLabel, '#38bdf8', 1);
        playerUnit.saluteSign.sprite.visible = true;
        triggerAlliedSalute(roleUiLabel);
      }
    };

    /**
     * Always-On Open Warzone (24/7):
     * No match timer or Game Over screen — bases and Warzone AI combatants automatically replenish
     * so players can freely enter/exit between the Lobby Safezone and Warzone at any time.
     */
    const checkMatchDeathmatchWinCondition = () => {
      if (blueBaseHp <= 0) {
        blueBaseHp = 2000;
        syncPadVisuals(blueBase, bluePadSlots, 'BLUE', blueBaseHp);
      }
      if (redBaseHp <= 0) {
        redBaseHp = 2000;
        score += 500;
        gold += 350;
        syncPadVisuals(redBase, redPadSlots, 'RED', redBaseHp);
      }
      if (playModeRef.current !== 'editor') {
        ensureMatchAiSquadsSpawned();
      }
    };

    const handleSwapBuddy = () => {
      if (mountedTank) return;
      const swapped = getNextOwnedBuddyForSwap(
        buddyUnits.map((b) => ({
          id: String(b.id),
          team: b.team,
          ownerCommanderId: b.ownerCommanderId,
          hp: b.alive ? b.hp : 0,
          unit: b,
        })),
        'blue',
        0,
        String(playerUnit.id),
      );
      const nextBuddy = swapped ? swapped.unit : null;
      if (!nextBuddy || nextBuddy.id === playerUnit.id) return;
      soundEngine.playUiClick();
      playerUnit.assignedRole = playerUnit.assignedRole ?? teamCommand;
      playerUnit.hasIndividualRoleAssigned = true;
      playerUnit.isPlayer = false;
      syncUnitFootRingTeamColor(playerUnit);
      nextBuddy.isPlayer = true;
      syncUnitFootRingTeamColor(nextBuddy);
      playerUnit = nextBuddy;
      teamCommand = playerUnit.assignedRole ?? 'HARVEST';
      playerUnit.assignedRole = teamCommand;
      playerUnit.saluteTimer = 1.65;
      playerUnit.saluteSign.updateText(
        `AKTIF: ${playerUnit.classId.toUpperCase()}`,
        formatBuddyRoleUiLabel(teamCommand).toUpperCase(),
        '#b4ff39',
        1,
      );
      playerUnit.saluteSign.sprite.visible = true;
    };

    const handleHotJoinPlayer = () => {
      // Replace an AI Commander on Blue first, or Red if Blue is already 4/4 human!
      const blueHasAi = matchmakingState.blueCommanders.some((s) => s.controller === 'ai');
      const targetTeam: 'blue' | 'red' = blueHasAi ? 'blue' : 'red';
      const teamLabel = targetTeam === 'blue' ? 'BLUE' : 'RED';
      const existingHumans = (
        targetTeam === 'blue' ? matchmakingState.blueCommanders : matchmakingState.redCommanders
      ).filter((s) => s.controller === 'human').length;
      if (existingHumans >= COMMANDERS_PER_TEAM) return;
      const newPlayerName = `${teamLabel}_Player_${existingHumans + 1}`;
      const res = hotJoinReplaceAiCommander(matchmakingState, targetTeam, runElapsedSec, newPlayerName);
      if (res.replacedSlot !== null) {
        matchmakingState = res.updatedState;
        const replacedId = res.replacedSlot.commanderId;
        soundEngine.playPowerCore();
        syncPadVisuals(blueBase, bluePadSlots, 'BLUE', blueBaseHp);
        syncPadVisuals(redBase, redPadSlots, 'RED', redBaseHp);
        for (const b of buddyUnits) {
          if (b.team === targetTeam && b.ownerCommanderId === replacedId && b.alive) {
            b.saluteTimer = 2.2;
            b.saluteSign.updateText('PEMAIN JOIN!', `GANTIKAN AI P${replacedId + 1}`, '#38bdf8', 1);
            b.saluteSign.sprite.visible = true;
            spawnBurstParticles(b.x, 1.4, b.z, 14);
          }
        }
      }
    };

    const handleSelectTacticalWeapon = (weaponId: BlitzWeaponId) => {
      if (!playerUnit || !playerUnit.alive) return;
      soundEngine.playUiClick();
      if (weaponId === 'fishing_rod') {
        playerUnit.weaponId = 'fishing_rod';
        playerUnit.weaponName = 'Joran Fishing';
        playerUnit.weaponRecoil = 0.85;
      } else if (weaponId === 'unarmed') {
        playerUnit.tacticalLoadout = selectHandheldWeaponInLoadout(
          playerUnit.tacticalLoadout,
          'unarmed',
        );
        syncUnitFieldsFromLoadout(playerUnit);
        playerUnit.weaponRecoil = 0;
      } else {
        const ownsWeapon = playerUnit.tacticalLoadout.handheldWeapons.some(
          (w) => w.slotId === weaponId,
        );
        if (!ownsWeapon) {
          return;
        }
        playerUnit.tacticalLoadout = selectHandheldWeaponInLoadout(
          playerUnit.tacticalLoadout,
          weaponId as HandheldWeaponSlotId,
        );
        syncUnitFieldsFromLoadout(playerUnit);
        playerUnit.weaponRecoil = 0.38;
      }
      updateCharacterWeaponStance(
        playerUnit.rig,
        playerUnit.weaponId,
        playerUnit.walkCycle,
        false,
        playerUnit.carryingCrate !== 'none',
        playerUnit.saluteTimer,
        playerUnit.weaponRecoil,
        playerUnit.punchTimer,
        playerUnit.punchHand,
        playerUnit.kickTimer,
        playerUnit.jumpOffset,
      );
      emitHudImmediately();
    };

    // =========================================================================
    // 10B. SANDBOX QUICK TEST ACTIONS & MAP EDITOR PLACEMENT HANDLERS
    // =========================================================================
    const handleSandboxQuickDropCrate = (kind: 'red' | 'super' | 'legend') => {
      soundEngine.playPickup();
      const actorX = mountedTank ? mountedTank.x : playerUnit.x;
      const actorZ = mountedTank ? mountedTank.z : playerUnit.z;
      const fwdX = mountedTank ? Math.cos(mountedTank.hullYaw) : Math.sin(playerUnit.yaw);
      const fwdZ = mountedTank ? -Math.sin(mountedTank.hullYaw) : Math.cos(playerUnit.yaw);
      const rightX = -fwdZ;
      const rightZ = fwdX;
      const sideOffset = kind === 'red' ? -1.35 : kind === 'super' ? 0 : 1.35;
      const dropX = wrapPlanetCoord(actorX + fwdX * 2.8 + rightX * sideOffset);
      const dropZ = wrapPlanetCoord(actorZ + fwdZ * 2.8 + rightZ * sideOffset);
      spawnWorldCrate(kind, dropX, dropZ, true);
      spawnBurstParticles(dropX, 1.0, dropZ, 8);
    };

    const handleSandboxQuickSpawnTank = () => {
      soundEngine.playPowerCore();
      const actorX = mountedTank ? mountedTank.x : playerUnit.x;
      const actorZ = mountedTank ? mountedTank.z : playerUnit.z;
      const fwdX = mountedTank ? Math.cos(mountedTank.hullYaw) : Math.sin(playerUnit.yaw);
      const fwdZ = mountedTank ? -Math.sin(mountedTank.hullYaw) : Math.cos(playerUnit.yaw);
      const spawnX = wrapPlanetCoord(actorX + fwdX * 3.8);
      const spawnZ = wrapPlanetCoord(actorZ + fwdZ * 3.8);
      const newTank = createBlitzTankVehicle(spawnX, spawnZ, false, 'blue');
      tanks.push(newTank);
      spawnBurstParticles(spawnX, 1.6, spawnZ, 16);
    };

    const handleSandboxQuickSpawnSuperTank = () => {
      soundEngine.playPowerCore();
      const actorX = mountedTank ? mountedTank.x : playerUnit.x;
      const actorZ = mountedTank ? mountedTank.z : playerUnit.z;
      const fwdX = mountedTank ? Math.cos(mountedTank.hullYaw) : Math.sin(playerUnit.yaw);
      const fwdZ = mountedTank ? -Math.sin(mountedTank.hullYaw) : Math.cos(playerUnit.yaw);
      const spawnX = wrapPlanetCoord(actorX + fwdX * 3.8);
      const spawnZ = wrapPlanetCoord(actorZ + fwdZ * 3.8);
      const newTank = createBlitzTankVehicle(spawnX, spawnZ, true, 'blue');
      tanks.push(newTank);
      spawnBurstParticles(spawnX, 1.8, spawnZ, 20);
    };

    const applyCharacterGenderSwitch = (nextGender: CharacterGender) => {
      soundEngine.playUiClick();
      setDefaultCharacterGender(nextGender);
      if (promptOverlay) {
        promptOverlay.setAttribute('data-character-gender', nextGender);
      }
      const charGltfRef = loadedBlitzAssets?.charBuddiesGltf ?? earlyLoadedCharGltf;
      const manGltfRef = loadedBlitzAssets?.manCharacterBuddiesGltf ?? earlyLoadedManGltf;
      const targetGltf =
        nextGender === 'male' ? manGltfRef ?? charGltfRef : charGltfRef;
      if (targetGltf && playerUnit) {
        upgradeBuddyRigWithCharBuddiesGlb(
          playerUnit.rig,
          targetGltf,
          loadedBlitzAssets?.ar99AssaultGltf,
        );
        updateCharacterWeaponStance(
          playerUnit.rig,
          playerUnit.weaponId,
          playerUnit.walkCycle,
          false,
          playerUnit.carryingCrate !== 'none',
          playerUnit.saluteTimer,
          playerUnit.weaponRecoil,
          playerUnit.punchTimer,
          playerUnit.punchHand,
          playerUnit.kickTimer,
          playerUnit.jumpOffset,
          0.76,
          0,
          playerUnit.alive,
          'front',
          1,
          playerUnit.yaw,
          0,
          Boolean(playerUnit.isSitting),
          Boolean(playerUnit.isDriving),
        );
        if (mountedTank?.riderGroup.userData.riderRig) {
          upgradeBuddyRigWithCharBuddiesGlb(mountedTank.riderGroup.userData.riderRig, targetGltf);
        }
      }
      if (playerUnit && playerUnit.alive) {
        playerUnit.saluteTimer = 1.8;
        playerUnit.saluteSign.updateText(
          nextGender === 'male' ? 'KARAKTER PRIA AKTIF' : 'KARAKTER WANITA AKTIF',
          nextGender === 'male' ? 'MANCHARACTERBUDDIES.GLB' : 'CHARBUDDIES.GLB',
          nextGender === 'male' ? '#38bdf8' : '#b8ff3c',
          1,
        );
        playerUnit.saluteSign.sprite.visible = true;
      }
      emitHudImmediately();
    };

    const handleToggleSitting = (forceGender: CharacterGender | null = null) => {
      if (!playerUnit || !playerUnit.alive) return;
      if (forceGender && getDefaultCharacterGender() !== forceGender) {
        applyCharacterGenderSwitch(forceGender);
      }
      if (mountedTank) handleToggleMountTank();
      if (ridingTramCarIdx !== null) disembarkFromCityTram();
      soundEngine.playUiClick();
      playerUnit.isSitting = forceGender ? true : !playerUnit.isSitting;
      if (playerUnit.isSitting) {
        playerUnit.isDriving = false;
        playerUnit.vx = 0;
        playerUnit.vz = 0;
        playerUnit.saluteTimer = 2.0;
        playerUnit.saluteSign.updateText(
          'ANIMASI SITTING AKTIF',
          '[C] ATAU WASD UNTUK BERDIRI',
          getDefaultCharacterGender() === 'male' ? '#38bdf8' : '#f472b6',
          1,
        );
        playerUnit.saluteSign.sprite.visible = true;
      }
      updateCharacterWeaponStance(
        playerUnit.rig,
        playerUnit.weaponId,
        playerUnit.walkCycle,
        false,
        playerUnit.carryingCrate !== 'none',
        playerUnit.saluteTimer,
        playerUnit.weaponRecoil,
        playerUnit.punchTimer,
        playerUnit.punchHand,
        playerUnit.kickTimer,
        playerUnit.jumpOffset,
        0.76,
        0,
        true,
        'front',
        1,
        playerUnit.yaw,
        0,
        Boolean(playerUnit.isSitting),
        Boolean(playerUnit.isDriving),
      );
      emitHudImmediately();
    };

    const handleToggleDriving = (forceGender: CharacterGender | null = null) => {
      if (!playerUnit || !playerUnit.alive) return;
      if (forceGender && getDefaultCharacterGender() !== forceGender) {
        applyCharacterGenderSwitch(forceGender);
      }
      if (mountedTank) handleToggleMountTank();
      if (ridingTramCarIdx !== null) disembarkFromCityTram();
      soundEngine.playUiClick();
      playerUnit.isDriving = forceGender ? true : !playerUnit.isDriving;
      if (playerUnit.isDriving) {
        playerUnit.isSitting = false;
        playerUnit.vx = 0;
        playerUnit.vz = 0;
        playerUnit.saluteTimer = 2.0;
        playerUnit.saluteSign.updateText(
          'ANIMASI DRIVING AKTIF',
          'DRIVING.FBX • WASD UNTUK BERDIRI',
          getDefaultCharacterGender() === 'male' ? '#38bdf8' : '#b8ff3c',
          1,
        );
        playerUnit.saluteSign.sprite.visible = true;
      }
      updateCharacterWeaponStance(
        playerUnit.rig,
        playerUnit.weaponId,
        playerUnit.walkCycle,
        false,
        playerUnit.carryingCrate !== 'none',
        playerUnit.saluteTimer,
        playerUnit.weaponRecoil,
        playerUnit.punchTimer,
        playerUnit.punchHand,
        playerUnit.kickTimer,
        playerUnit.jumpOffset,
        0.76,
        0,
        true,
        'front',
        1,
        playerUnit.yaw,
        0,
        Boolean(playerUnit.isSitting),
        Boolean(playerUnit.isDriving),
      );
      emitHudImmediately();
    };

    const handleQcEquipWeapon = (
      slotId: 'unarmed' | 'pistol' | 'rifle' | 'bazooka' | 'laser' | 'gatling' | 'fishing_rod',
    ) => {
      if (mountedTank) handleToggleMountTank();
      if (ridingTramCarIdx !== null) {
        disembarkFromCityTram();
      }
      if (slotId === 'unarmed') {
        qcForceWeaponVisible = false;
        handleSelectTacticalWeapon('unarmed');
        return;
      }
      if (slotId === 'fishing_rod') {
        qcForceWeaponVisible = true;
        playerUnit.isSitting = false;
        handleSelectTacticalWeapon('fishing_rod');
        soundEngine.playPickup();
        const fwdX = Math.cos(playerUnit.yaw);
        const fwdZ = -Math.sin(playerUnit.yaw);
        const castX = wrapPlanetCoord(playerUnit.x + fwdX * 3.2);
        const castZ = wrapPlanetCoord(playerUnit.z + fwdZ * 3.2);
        const castY = getTerrainElevation(castX, castZ) + 0.35;
        spawnBurstParticles(castX, castY, castZ, 12);
        playerUnit.saluteTimer = 2.0;
        playerUnit.saluteSign.updateText(
          'JORAN FISHING AKTIF',
          'FISHING CAST & FISHING IDLE',
          '#38bdf8',
          1,
        );
        playerUnit.saluteSign.sprite.visible = true;
        emitHudImmediately();
        return;
      }
      qcForceWeaponVisible = true;
      const weaponCatalogMap: Record<
        Exclude<typeof slotId, 'unarmed' | 'fishing_rod'>,
        { name: string; ammo: number }
      > = {
        pistol: { name: 'BlitzPistol', ammo: 120 },
        rifle: { name: 'AR-99 Assault Rifle', ammo: 180 },
        bazooka: { name: 'BlitzRocketLauncher', ammo: 24 },
        laser: { name: 'LG-88 Photon Lance', ammo: 200 },
        gatling: { name: 'TITAN-6 Rotary Gatling', ammo: 300 },
      };
      const spec = weaponCatalogMap[slotId];
      playerUnit.tacticalLoadout = equipOrSwapDroppedWeaponInLoadout(
        playerUnit.tacticalLoadout,
        spec.name,
        spec.ammo,
      ).updatedLoadout;
      syncUnitFieldsFromLoadout(playerUnit);
      handleSelectTacticalWeapon(slotId);
      const fwdX = Math.cos(playerUnit.yaw);
      const fwdZ = -Math.sin(playerUnit.yaw);
      const pY = getTerrainElevation(playerUnit.x, playerUnit.z) + 1.44;
      const mPos = new THREE.Vector3(
        wrapPlanetCoord(playerUnit.x + fwdX * 1.45),
        pY,
        wrapPlanetCoord(playerUnit.z + fwdZ * 1.45),
      );
      if (slotId === 'pistol') {
        soundEngine.playTacticalFirearm('pistol');
        fireProjectile(true, 'BlitzPistol', mPos, new THREE.Vector3(fwdX, 0, fwdZ), 46, 14);
      } else if (slotId === 'rifle') {
        soundEngine.playTacticalFirearm('rifle');
        fireProjectile(true, 'BlitzAssaultRifle', mPos, new THREE.Vector3(fwdX, 0, fwdZ), 56, 18);
      } else if (slotId === 'bazooka') {
        soundEngine.playBazookaLaunch();
        fireProjectile(true, 'BlitzRocketLauncher', mPos, new THREE.Vector3(fwdX, 0, fwdZ), 36, 48);
      } else if (slotId === 'laser') {
        const endPos = new THREE.Vector3(
          wrapPlanetCoord(playerUnit.x + fwdX * 18.0),
          getTerrainElevation(playerUnit.x + fwdX * 18.0, playerUnit.z + fwdZ * 18.0) + 1.1,
          wrapPlanetCoord(playerUnit.z + fwdZ * 18.0),
        );
        soundEngine.playLaserGunFire();
        spawnLaserBeamEffect(mPos, endPos);
        spawnTargetFireParticles(endPos.x, endPos.y, endPos.z, 18, 0.65);
        fireProjectile(true, 'BlitzLaserGun', mPos, new THREE.Vector3(fwdX, 0, fwdZ), 68, 18);
      } else if (slotId === 'gatling') {
        const rightX = Math.sin(playerUnit.yaw);
        const rightZ = Math.cos(playerUnit.yaw);
        soundEngine.playGatlingGunFire();
        spawnGatlingBrassAndSparks(mPos.x, mPos.y, mPos.z, fwdX, fwdZ, rightX, rightZ);
        fireProjectile(true, 'Titan6Gatling', mPos, new THREE.Vector3(fwdX, 0, fwdZ), 62, 14);
      }
      emitHudImmediately();
    };

    const handleQcBoardVehicle = (
      kind: 'tank' | 'super_tank' | 'truck' | 'plane' | 'tram' | 'dismount',
    ) => {
      if (kind === 'dismount') {
        if (mountedTank) handleToggleMountTank();
        if (ridingTramCarIdx !== null) disembarkFromCityTram();
        emitHudImmediately();
        return;
      }
      if (mountedTank) handleToggleMountTank();
      if (ridingTramCarIdx !== null) disembarkFromCityTram();
      if (kind === 'tram') {
        soundEngine.playPickup();
        ridingTramCarIdx = 0;
        playerUnit.vx = 0;
        playerUnit.vz = 0;
        playerUnit.root.visible = true;
        playerUnit.overheadCrateGroup.visible = false;
        emitHudImmediately();
        return;
      }
      soundEngine.playPowerCore();
      let newVeh: TankVehicle;
      if (kind === 'tank') {
        newVeh = createBlitzTankVehicle(playerUnit.x, playerUnit.z, false, 'blue');
      } else if (kind === 'super_tank') {
        newVeh = createBlitzTankVehicle(playerUnit.x, playerUnit.z, true, 'blue');
      } else if (kind === 'truck') {
        newVeh = createBlitzDumpTruckVehicle(playerUnit.x, playerUnit.z, 'blue', playerUnit.yaw);
      } else {
        newVeh = createBlitzPlaneVehicle(playerUnit.x, playerUnit.z, 'blue');
        newVeh.altitude = 9.5;
        newVeh.targetAltitude = 11.5;
        newVeh.forwardSpeed = 10.5;
      }
      tanks.push(newVeh);
      mountedTank = newVeh;
      newVeh.occupiedByPlayer = true;
      playerUnit.isSitting = false;
      playerUnit.isDriving = false;
      activeSeatedSpot = null;
      clearCharacterSelection();
      const activeMountChar =
        getDefaultCharacterGender() === 'male'
          ? earlyLoadedManGltf ?? earlyLoadedCharGltf
          : earlyLoadedCharGltf;
      if (activeMountChar && newVeh.riderGroup.userData.riderRig) {
        upgradeBuddyRigWithCharBuddiesGlb(
          newVeh.riderGroup.userData.riderRig,
          activeMountChar,
        );
      }
      newVeh.riderGroup.visible = newVeh.vehicleKind !== 'truck';
      playerUnit.root.visible = false;
      playerUnit.saluteSign.sprite.visible = false;
      spawnBurstParticles(newVeh.x, 1.8, newVeh.z, 18);
      emitHudImmediately();
    };

    const handleSandboxQuickSpawnPlane = () => {
      soundEngine.playPowerCore();
      const actorX = mountedTank ? mountedTank.x : playerUnit.x;
      const actorZ = mountedTank ? mountedTank.z : playerUnit.z;
      const fwdX = mountedTank ? Math.cos(mountedTank.hullYaw) : Math.sin(playerUnit.yaw);
      const fwdZ = mountedTank ? -Math.sin(mountedTank.hullYaw) : Math.cos(playerUnit.yaw);
      const spawnX = wrapPlanetCoord(actorX + fwdX * 3.8);
      const spawnZ = wrapPlanetCoord(actorZ + fwdZ * 3.8);
      const newPlane = createBlitzPlaneVehicle(spawnX, spawnZ, 'blue');
      tanks.push(newPlane);
      spawnBurstParticles(spawnX, 2.0, spawnZ, 18);
    };

    const handleSandboxQuickSpawnTruck = () => {
      soundEngine.playPowerCore();
      const actorX = mountedTank ? mountedTank.x : playerUnit.x;
      const actorZ = mountedTank ? mountedTank.z : playerUnit.z;
      const actorYaw = mountedTank ? mountedTank.hullYaw : playerUnit.yaw;
      const fwdX = Math.cos(actorYaw);
      const fwdZ = -Math.sin(actorYaw);
      const spawnX = wrapPlanetCoord(actorX + fwdX * 2.8);
      const spawnZ = wrapPlanetCoord(actorZ + fwdZ * 2.8);
      const newTruck = createBlitzDumpTruckVehicle(spawnX, spawnZ, 'blue', actorYaw);
      tanks.push(newTruck);
      spawnBurstParticles(spawnX, 1.8, spawnZ, 16);
    };

    // Deploy 3D Secondary Ordnance (CB-24 Cluster Bomb exclusively from Blitz Plane, HG-04 Frag Grenade, TM-89 Land Mine)
    const dropClusterBombFromPlane = (plane: TankVehicle) => {
      soundEngine.playBazookaLaunch();
      const alt = Math.max(4.5, plane.altitude ?? 8.5);
      const groundY = getTerrainElevation(plane.x, plane.z);
      const fwdX = Math.cos(plane.hullYaw);
      const fwdZ = -Math.sin(plane.hullYaw);
      const mesh = buildTeamBuddiesDropPickupMesh(
        'secondary',
        'cluster_bomb',
        windUniforms,
        isSoftwareGl,
      );
      mesh.scale.setScalar(1.45);
      const startPos = new THREE.Vector3(
        wrapPlanetCoord(plane.x + fwdX * 1.2),
        groundY + alt - 0.3,
        wrapPlanetCoord(plane.z + fwdZ * 1.2),
      );
      mesh.position.copy(startPos);
      mesh.rotation.y = plane.hullYaw;
      scene.add(mesh);
      activeOrdnanceDevices.push({
        kind: 'cluster_bomb',
        mesh,
        pos: startPos,
        vel: new THREE.Vector3(
          fwdX * Math.max(9.5, (plane.forwardSpeed ?? 10) * 0.95),
          -6.5,
          fwdZ * Math.max(9.5, (plane.forwardSpeed ?? 10) * 0.95),
        ),
        fuseTimer: 2.4,
        isGrounded: false,
      });
      kioskStatusMessage = 'CB-24 CLUSTER BOMB DROPPED FROM FIGHTER PLANE!';
      kioskStatusTimer = 3.5;
    };

    const handleUseTacticalSecondaryItem = (preferredKind?: TacticalSecondarySlotId) => {
      if (!playerUnit || !playerUnit.alive) return;
      if (isUnitWeaponTriggerLockedInSafeShield(playerUnit.x, playerUnit.z, playerUnit.team)) {
        return;
      }
      const chosenKind: TacticalSecondarySlotId | 'none' =
        preferredKind &&
        ((preferredKind === 'hand_grenade' && playerUnit.tacticalLoadout.grenadeCount > 0) ||
          (preferredKind === 'land_mine' && playerUnit.tacticalLoadout.landMineCount > 0))
          ? preferredKind
          : playerUnit.tacticalLoadout.grenadeCount > 0
            ? 'hand_grenade'
            : playerUnit.tacticalLoadout.landMineCount > 0
              ? 'land_mine'
              : 'none';

      if (chosenKind === 'none') return;

      const cons = consumeTacticalSecondaryInLoadout(playerUnit.tacticalLoadout, chosenKind);
      if (!cons.consumed) return;
      playerUnit.tacticalLoadout = cons.updatedLoadout;
      syncUnitFieldsFromLoadout(playerUnit);

      const fwdX = Math.cos(playerUnit.yaw);
      const fwdZ = -Math.sin(playerUnit.yaw);
      const groundY = getTerrainElevation(playerUnit.x, playerUnit.z);

      if (chosenKind === 'hand_grenade') {
        soundEngine.playPickup();
        const mesh = buildTeamBuddiesDropPickupMesh(
          'secondary',
          'hand_grenade',
          windUniforms,
          isSoftwareGl,
        );
        mesh.scale.setScalar(1.25);
        const startPos = new THREE.Vector3(
          wrapPlanetCoord(playerUnit.x + fwdX * 1.1),
          groundY + 1.45,
          wrapPlanetCoord(playerUnit.z + fwdZ * 1.1),
        );
        mesh.position.copy(startPos);
        scene.add(mesh);
        activeOrdnanceDevices.push({
          kind: 'hand_grenade',
          mesh,
          pos: startPos,
          vel: new THREE.Vector3(fwdX * 12.5, 6.8, fwdZ * 12.5),
          fuseTimer: 1.65,
          isGrounded: false,
        });
      } else if (chosenKind === 'land_mine') {
        soundEngine.playPickup();
        const mesh = buildTeamBuddiesDropPickupMesh(
          'secondary',
          'land_mine',
          windUniforms,
          isSoftwareGl,
        );
        mesh.scale.setScalar(1.3);
        const mx = wrapPlanetCoord(playerUnit.x + fwdX * 1.6);
        const mz = wrapPlanetCoord(playerUnit.z + fwdZ * 1.6);
        const mineGrassOffsetY = computeLandMineGrassYOffset(evaluateBlitzGrassMask(mx, mz));
        const startPos = new THREE.Vector3(
          mx,
          getTerrainElevation(mx, mz) + 0.05 + mineGrassOffsetY,
          mz,
        );
        mesh.position.copy(startPos);
        scene.add(mesh);
        activeOrdnanceDevices.push({
          kind: 'land_mine',
          mesh,
          pos: startPos,
          vel: new THREE.Vector3(0, 0, 0),
          fuseTimer: 18.0,
          isGrounded: true,
        });
      }
      emitHudImmediately();
    };

    const handleUseSecondaryOrdnance = () => {
      const secId = playerUnit?.secondaryItem ?? 'none';
      const isInPlane = Boolean(mountedTank && mountedTank.vehicleKind === 'plane');

      // If piloting the Blitz Plane, pressing [X] drops the CB-24 Cluster Bomb (if unlocked / equipped)
      if (isInPlane && mountedTank) {
        const bLv = blueCommanderBases[0]?.buildingLevel ?? 1;
        const clusterAccess = evaluateClusterBombAccess(bLv, true);
        if (!clusterAccess.allowedToBuild) {
          soundEngine.playHit();
          kioskStatusMessage = clusterAccess.statusMessage;
          kioskStatusTimer = 4.5;
          return;
        }
        dropClusterBombFromPlane(mountedTank);
        if (playerUnit.secondaryItem === 'cluster_bomb' && playerUnit.secondaryCount > 0) {
          playerUnit.secondaryCount = Math.max(0, playerUnit.secondaryCount - 1);
        }
        return;
      }

      if (!playerUnit || !playerUnit.alive) {
        return;
      }

      // STRICT RULE: CB-24 Cluster Bomb can ONLY be used by the Blitz Fighter Plane!
      if (
        secId === 'cluster_bomb' &&
        playerUnit.tacticalLoadout.grenadeCount <= 0 &&
        playerUnit.tacticalLoadout.landMineCount <= 0
      ) {
        soundEngine.playHit();
        playerUnit.saluteTimer = 2.8;
        playerUnit.saluteSign.updateText(
          'FIGHTER PLANE ONLY!',
          'CLUSTER BOMB CAN ONLY BE DROPPED FROM PLANE [G]!',
          '#ff9f0a',
          1,
        );
        playerUnit.saluteSign.sprite.visible = true;
        kioskStatusMessage =
          'PLANE ONLY! Board a Fighter Plane (Blitz Plane) [G] to drop the CB-24 Cluster Bomb!';
        kioskStatusTimer = 4.5;
        return;
      }

      handleUseTacticalSecondaryItem();
    };

    const handleSandboxUnlockBaseLv3 = () => {
      const plot0 = blueCommanderBases[0];
      if (plot0) {
        plot0.buildingLevel = 3;
        plot0.commandCenterLevel = 3;
        plot0.buildingMaxHp = 960;
        plot0.buildingHp = 960;
        plot0.fenceLevel = 3;
        plot0.fenceMaxHp = 680;
        plot0.fenceHp = 680;
        blueBaseHp = blueCommanderBases.reduce((acc, b) => acc + b.buildingHp, 0);
        syncPadVisuals(blueBase, bluePadSlots, 'BLUE', blueBaseHp);
      }
      soundEngine.playPowerCore();
      kioskStatusMessage =
        'COMMAND CENTER LV.3 TERBUKA! Nuclear Launcher & CB-24 Cluster Bomb Aktif!';
      kioskStatusTimer = 5.0;
    };

    const startNuclearStrikeTargetingMode = () => {
      const currentCmdLevel = blueCommanderBases[0]?.buildingLevel ?? 1;
      const nukeAccess = evaluateNuclearLauncherAccess(currentCmdLevel);
      if (!nukeAccess.allowed) {
        soundEngine.playHit();
        kioskStatusMessage = nukeAccess.statusMessage;
        kioskStatusTimer = 5.0;
        return;
      }

      const nl = ensureBlueNuclearLauncherDeployed();
      const nlX = nl.root.position.x;
      const nlZ = nl.root.position.z;
      const nlY = getTerrainElevation(nlX, nlZ);

      // Pick a smart initial target on the battlefield (nearest enemy tank/unit or central arena road toward Red Base)
      let defaultTargetX = 0;
      let defaultTargetZ = 18;
      let bestEnemyDist = 999;
      for (const t of tanks) {
        if (t.team === 'red' && t.hp > 0) {
          const d = Math.hypot(t.x - nlX, t.z - nlZ);
          if (d < bestEnemyDist) {
            bestEnemyDist = d;
            defaultTargetX = t.x;
            defaultTargetZ = t.z;
          }
        }
      }
      if (bestEnemyDist >= 999) {
        for (const b of buddyUnits) {
          if (b.team === 'red' && b.alive) {
            const d = Math.hypot(b.x - nlX, b.z - nlZ);
            if (d < bestEnemyDist) {
              bestEnemyDist = d;
              defaultTargetX = b.x;
              defaultTargetZ = b.z;
            }
          }
        }
      }

      const activeFocus = mountedTank ? mountedTank : playerUnit;
      const originPos: Vec3 = {
        x: activeFocus.x,
        y: getTerrainElevation(activeFocus.x, activeFocus.z) + 1.0,
        z: activeFocus.z,
      };
      const launchPos: Vec3 = {
        x: nlX,
        y: nlY + 2.35,
        z: nlZ,
      };
      const initialTargetPos: Vec3 = {
        x: defaultTargetX,
        y: getTerrainElevation(defaultTargetX, defaultTargetZ),
        z: defaultTargetZ,
      };

      nukeStrikeState = beginNuclearStrikeTargeting(originPos, launchPos, initialTargetPos);
      nukeLastMouseNdc = { x: mouseNdc.x, y: mouseNdc.y };
      nukeTargetReticleGroup.visible = true;
      nukeCinematicRocketGroup.visible = false;
      soundEngine.playPowerCore();
      window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
      emitHudImmediately();
    };

    const confirmAndLaunchNuclearStrike = () => {
      if (nukeStrikeState.phase !== 'targeting') return;
      const nl = ensureBlueNuclearLauncherDeployed();
      const dx = nukeStrikeState.targetPos.x - nl.root.position.x;
      const dz = nukeStrikeState.targetPos.z - nl.root.position.z;
      const targetYaw = Math.atan2(dx, dz);
      nl.yawGroup.rotation.y = targetYaw;
      nl.pitchGroup.rotation.x = -0.58;

      nukeStrikeState = confirmNuclearStrikeTargetAndLaunch(nukeStrikeState);
      nukeTargetReticleGroup.visible = false;
      nukeCinematicRocketGroup.visible = true;

      const launchOrigin = new THREE.Vector3(
        nukeStrikeState.launchPos.x,
        nukeStrikeState.launchPos.y,
        nukeStrikeState.launchPos.z,
      );
      const launchDir = new THREE.Vector3(
        nukeStrikeState.rocketTangent.x,
        nukeStrikeState.rocketTangent.y,
        nukeStrikeState.rocketTangent.z,
      ).normalize();
      blitzExplosionSystem.spawnBlitzMuzzleFlash(launchOrigin, launchDir, 1.85, 'bazooka');
      spawnBurstParticles(launchOrigin.x, launchOrigin.y, launchOrigin.z, 24);
      spawnTargetFireParticles(launchOrigin.x, launchOrigin.y, launchOrigin.z, 18, 1.25);
      soundEngine.playBazookaLaunch();
      kioskStatusMessage = "ROKET NUKLIR MLRS-MK5 'ATLAS' MELUNCUR KE TITIK TARGET!";
      kioskStatusTimer = 4.5;
      emitHudImmediately();
    };

    const triggerNuclearStrikeDetonation = (tx: number, ty: number, tz: number) => {
      nukeCinematicRocketGroup.visible = false;
      nukeTargetReticleGroup.visible = false;

      // 1. Primary HQ-scale Nuclear Fireball & Shockwave
      const impactCenter = new THREE.Vector3(tx, ty + 0.4, tz);
      blitzExplosionSystem.spawnBlitzExplosion(impactCenter, 3.35, 'hq');

      // 2. Ring of 6 Secondary Nuclear Thermal Fireballs + Massive Rising Fire Column
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const rx = wrapPlanetCoord(tx + Math.cos(ang) * 4.8);
        const rz = wrapPlanetCoord(tz + Math.sin(ang) * 4.8);
        const ry = getTerrainElevation(rx, rz);
        blitzExplosionSystem.spawnBlitzExplosion(new THREE.Vector3(rx, ry + 0.3, rz), 1.85, 'cannon');
      }
      spawnTargetFireParticles(tx, ty, tz, 48, 3.6);
      spawnBurstParticles(tx, ty + 1.8, tz, 46);
      spawnDirectionalSparks(tx, ty + 0.8, tz, 0, 1, 28, 22, 2.2);

      // 3. Thunderous Dual-Layer Nuclear Explosion Audio & Camera Shake
      soundEngine.playBarrelExplosion();
      soundEngine.playTacticalExplosion(2.85);
      shakeTrauma = 0.92;
      blitzGrassSystem.stampExplosionShockwave(tx, tz, 24.0, 1.0);

      // 4. Heavy 24m Radius Nuclear Blast Damage to Enemy Units, Vehicles, Props, Trees & Red Base
      const blastRadius = 24.0;
      for (const t of tanks) {
        if (t.team === 'blue' || t.hp <= 0) continue;
        const d = getPlanetShortestDistance(tx, tz, t.x, t.z);
        if (d <= blastRadius) {
          const dmg = Math.round(240 * (1 - (d / blastRadius) * 0.55));
          t.hp = Math.max(0, t.hp - dmg);
          t.hitFlashTimer = 0.45;
          if (t.hp <= 0) {
            blitzExplosionSystem.spawnBlitzExplosion(new THREE.Vector3(t.x, ty + 1.0, t.z), 1.65, 'cannon');
          }
        }
      }
      for (const b of buddyUnits) {
        if (b.team === 'blue' || !b.alive) continue;
        const d = getPlanetShortestDistance(tx, tz, b.x, b.z);
        if (d <= blastRadius) {
          b.hp = 0;
          b.alive = false;
          b.respawnTimer = 8.0;
          b.root.visible = false;
          enemiesDefeated++;
          score += 250;
        }
      }
      for (const other of activeMapProps) {
        if (!other.alive) continue;
        const d = getPlanetShortestDistance(other.x, other.z, tx, tz);
        if (d < 16.0) {
          if (other.category === 'pushable' && d > 0.05) {
            const dx = getPlanetShortestDelta(other.x, tx) / d;
            const dz = getPlanetShortestDelta(other.z, tz) / d;
            const push = (1 - d / 16.0) * 18.0;
            other.vx += dx * push;
            other.vz += dz * push;
            other.rotVelY += (Math.random() - 0.5) * 12.0;
          } else if (other.category === 'breakable' || (other.category === 'solid' && other.destructible)) {
            other.alive = false;
            other.wrapper.visible = false;
          }
        }
      }
      if (getPlanetShortestDistance(tx, tz, redBase.hqX, redBase.hqZ) <= 28.0) {
        redBaseHp = Math.max(0, redBaseHp - 480);
        syncPadVisuals(redBase, redPadSlots, 'RED', redBaseHp);
      }
    };

    const handleEditorDeleteNearest = (worldX: number, worldZ: number) => {
      let nearestIdx = -1;
      let bestDist = 4.8;
      currentMapLayout.props.forEach((p, idx) => {
        const d = getPlanetShortestDistance(p.x, p.z, worldX, worldZ);
        if (d < bestDist) {
          bestDist = d;
          nearestIdx = idx;
        }
      });
      if (nearestIdx === -1 && currentMapLayout.props.length > 0) {
        // Fallback if triggered via UI button: remove last placed object
        nearestIdx = currentMapLayout.props.length - 1;
      }
      if (nearestIdx !== -1) {
        const removed = currentMapLayout.props.splice(nearestIdx, 1)[0];
        soundEngine.playHit();
        spawnBurstParticles(removed.x, 1.2, removed.z, 8);
        rebuildMapFromLayout(currentMapLayout);
      }
    };

    const handleEditorClearAllProps = () => {
      soundEngine.playHit();
      currentMapLayout.props = [];
      rebuildMapFromLayout(currentMapLayout);
    };

    const handleEditorRotate = () => {
      soundEngine.playUiClick();
      editorRotY = (editorRotY + Math.PI / 4) % (Math.PI * 2);
      // Also rotate nearest prop within 4.2m of cursor if hovering over one
      let nearest: PlacedMapProp | null = null;
      let bestDist = 4.2;
      for (const p of currentMapLayout.props) {
        const d = getPlanetShortestDistance(p.x, p.z, aimWorldPoint.x, aimWorldPoint.z);
        if (d < bestDist) {
          bestDist = d;
          nearest = p;
        }
      }
      if (nearest) {
        nearest.rotY = (nearest.rotY + Math.PI / 4) % (Math.PI * 2);
        rebuildMapFromLayout(currentMapLayout);
      }
    };

    const handleEditorScaleStep = (delta: number) => {
      soundEngine.playUiClick();
      editorScale = Math.round(clamp(editorScale + delta, 0.5, 2.5) * 100) / 100;
      let nearest: PlacedMapProp | null = null;
      let bestDist = 4.2;
      for (const p of currentMapLayout.props) {
        const d = getPlanetShortestDistance(p.x, p.z, aimWorldPoint.x, aimWorldPoint.z);
        if (d < bestDist) {
          bestDist = d;
          nearest = p;
        }
      }
      if (nearest) {
        nearest.scale = editorScale;
        rebuildMapFromLayout(currentMapLayout);
      }
    };

    const handleEditorSaveLayout = () => {
      soundEngine.playPowerCore();
      currentMapLayout.sculptData = serializeTerrainSculptGrid();
      try {
        localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(currentMapLayout));
      } catch {
        // Ignore storage quota errors
      }
    };

    const handleEditorResetLayout = () => {
      soundEngine.playUiClick();
      resetTerrainSculptGrid();
      try {
        localStorage.removeItem(MAP_STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
      currentMapLayout = cloneDefaultLayout();
      rebuildMapFromLayout(currentMapLayout);
    };

    // =========================================================================
    // 11. INPUT LISTENERS (WASD, MOUSE AIM, SCROLL ZOOM, CLICK SHOOT / EDITOR)
    // =========================================================================
    const keys: Record<string, boolean> = {};
    const mouseNdc = new THREE.Vector2(0, 0);
    const raycaster = new THREE.Raycaster();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.2);
    const aimWorldPoint = new THREE.Vector3(0, 0.2, 0);
    let isPointerDown = false;
    let isEditorPanning = false;
    let isEditorOrbiting = false;
    let panDragStart = { x: 0, y: 0, panX: 0, panZ: 0 };
    let orbitDragStart = { x: 0, y: 0, yaw: 0, pitch: 0.68 };
    // Default camera zoom & maximum zoom-out limit matching Lobby close-up framing (0.86)
    let cameraZoom = 0.86;

    resetAllPlayerMovementInputs = () => {
      for (const k of Object.keys(keys)) {
        keys[k] = false;
      }
      isPointerDown = false;
      isEditorPanning = false;
      isEditorOrbiting = false;
      if (playerUnit) {
        playerUnit.vx = 0;
        playerUnit.vz = 0;
        playerUnit.vy = 0;
        playerUnit.jumpBufferTimer = 0;
        playerUnit.isFiringLaser = false;
      }
      if (mountedTank) {
        mountedTank.vx = 0;
        mountedTank.vz = 0;
        mountedTank.forwardSpeed = 0;
      }
    };

    const onWindowBlurOrVisibilityReset = () => {
      resetAllPlayerMovementInputs();
    };
    const onDocumentFocusIn = (e: FocusEvent) => {
      const targetEl = e.target as HTMLElement | null;
      if (
        targetEl &&
        (targetEl.tagName === 'INPUT' ||
          targetEl.tagName === 'TEXTAREA' ||
          targetEl.isContentEditable)
      ) {
        resetAllPlayerMovementInputs();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const targetEl = e.target as HTMLElement | null;
      if (
        targetEl &&
        (targetEl.tagName === 'INPUT' ||
          targetEl.tagName === 'TEXTAREA' ||
          targetEl.isContentEditable)
      ) {
        resetAllPlayerMovementInputs();
        return;
      }
      if (isKioskModalOpenCanvas) {
        if (e.code === 'Escape' || e.code === 'KeyB') {
          e.preventDefault();
          resetAllPlayerMovementInputs();
          window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
          return;
        }
        const isMovementKey =
          e.code === 'KeyW' ||
          e.code === 'KeyA' ||
          e.code === 'KeyS' ||
          e.code === 'KeyD' ||
          e.code === 'ArrowUp' ||
          e.code === 'ArrowDown' ||
          e.code === 'ArrowLeft' ||
          e.code === 'ArrowRight' ||
          e.code === 'ShiftLeft' ||
          e.code === 'ShiftRight' ||
          e.code === 'Space';
        if (!isMovementKey) {
          return;
        }
      }
      keys[e.code] = true;
      if (gameStateRef.current !== 'playing') return;

      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        onTogglePause();
        return;
      }

      if (playModeRef.current === 'editor') {
        if (e.code === 'KeyR') {
          e.preventDefault();
          handleEditorRotate();
        } else if (e.code === 'BracketLeft') {
          e.preventDefault();
          handleEditorScaleStep(-0.15);
        } else if (e.code === 'BracketRight') {
          e.preventDefault();
          handleEditorScaleStep(0.15);
        } else if (e.code === 'Delete' || e.code === 'Backspace') {
          e.preventDefault();
          handleEditorDeleteNearest(aimWorldPoint.x, aimWorldPoint.z);
        }
        return;
      }

      if (nukeStrikeState.phase === 'targeting') {
        if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
          e.preventDefault();
          confirmAndLaunchNuclearStrike();
          return;
        }
        return;
      }

      if (e.code === 'KeyN') {
        e.preventDefault();
        startNuclearStrikeTargetingMode();
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (mountedTank && mountedTank.vehicleKind === 'plane') {
          mountedTank.targetAltitude = Math.min(14.5, Math.max(12.2, (mountedTank.targetAltitude ?? 0) + 4.5));
          mountedTank.forwardSpeed = Math.max(mountedTank.forwardSpeed ?? 0, 8.5);
        } else if (!mountedTank) {
          handlePlayerJump();
        }
      }

      if (e.code === 'KeyC' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
        if (mountedTank && mountedTank.vehicleKind === 'plane') {
          mountedTank.targetAltitude = 0;
        } else if (e.code === 'KeyC' && !mountedTank && ridingTramCarIdx === null) {
          handleToggleSitting(null);
        }
      }

      if (e.code === 'KeyE') {
        e.preventDefault();
        const actorX = mountedTank ? mountedTank.x : playerUnit.x;
        const actorZ = mountedTank ? mountedTank.z : playerUnit.z;

        // Teleport Kiosk triggers on KeyE
        if (worldModeRef.current !== 'lobby') {
          const distToHalteKiosk = getPlanetShortestDistance(actorX, actorZ, -61.95, 0.0);
          if (distToHalteKiosk <= 4.8 || isUnitNearLobbyTramReturnPad(actorX, actorZ)) {
            enterLobbySafezone();
            return;
          }
        } else {
          const dWarzoneKiosk = getPlanetShortestDistance(actorX, actorZ, -81.8, -8.2);
          if (dWarzoneKiosk <= 4.8) {
            confirmLobbyFactionPortalDeploy('red');
            return;
          }
          const dSafezoneKiosk = getPlanetShortestDistance(actorX, actorZ, -81.8, -14.8);
          if (dSafezoneKiosk <= 4.8) {
            enterSafezoneCityFromLobby();
            return;
          }
        }
        if (
          getPlanetShortestDistance(
            actorX,
            actorZ,
            LOBBY_NEAR_TERMINAL_SPEC.x,
            LOBBY_NEAR_TERMINAL_SPEC.z,
          ) <= LOBBY_NEAR_TERMINAL_SPEC.interactRadius
        ) {
          soundEngine.playUiClick();
          nearSessionState = connectNearWalletAndMintGamepass(nearSessionState);
          kioskStatusMessage = nearSessionState.sessionStatusBanner;
          kioskStatusTimer = 5.5;
          emitHudImmediately();
          window.dispatchEvent(new CustomEvent('toggle-kiosk-ui'));
          return;
        }
        const blueNl = activeNuclearLaunchers.find((n) => n.team === 'blue');
        if (
          blueNl &&
          getPlanetShortestDistance(playerUnit.x, playerUnit.z, blueNl.root.position.x, blueNl.root.position.z) < 6.8
        ) {
          startNuclearStrikeTargetingMode();
          return;
        }
        if (mountedTank && mountedTank.vehicleKind === 'plane') {
          mountedTank.targetAltitude = Math.min(14.5, Math.max(12.2, (mountedTank.targetAltitude ?? 0) + 4.5));
          mountedTank.forwardSpeed = Math.max(mountedTank.forwardSpeed ?? 0, 8.5);
        } else {
          handlePlayerPickupOrThrowCrate();
        }
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        if (mountedTank && mountedTank.vehicleKind === 'plane') {
          handleUseSecondaryOrdnance();
        } else {
          handlePlayerKickOrCraft();
        }
      } else if (e.code === 'KeyX') {
        e.preventDefault();
        handleUseSecondaryOrdnance();
      } else if (e.code === 'KeyG') {
        e.preventDefault();
        handleToggleMountTank();
      } else if (e.code === 'KeyQ') {
        e.preventDefault();
        handleCycleBuildOrder();
      } else if (e.code === 'KeyB') {
        e.preventDefault();
        const actorX = mountedTank ? mountedTank.x : playerUnit.x;
        const actorZ = mountedTank ? mountedTank.z : playerUnit.z;
        if (isUnitNearLobbyTramReturnPad(actorX, actorZ)) {
          enterLobbySafezone();
          return;
        }
        const nearestKiosk = findNearestBaseKiosk(actorX, actorZ);
        const nearNearTerminal =
          getPlanetShortestDistance(
            actorX,
            actorZ,
            LOBBY_NEAR_TERMINAL_SPEC.x,
            LOBBY_NEAR_TERMINAL_SPEC.z,
          ) <= LOBBY_NEAR_TERMINAL_SPEC.interactRadius;
        if (isKioskPromptActive || nearestKiosk.distance <= INTERACT_EXIT_RADIUS || nearNearTerminal) {
          soundEngine.playUiClick();
          emitHudImmediately();
          window.dispatchEvent(new CustomEvent('toggle-kiosk-ui'));
        }
      } else if (e.code === 'KeyV') {
        e.preventDefault();
        handleCursorOrCycleTeamCommand(true);
      } else if (e.code === 'Tab') {
        e.preventDefault();
        handleSwapBuddy();
      } else if (e.code === 'Digit1' || e.code === 'Numpad1') {
        e.preventDefault();
        const slot0 = playerUnit.tacticalLoadout.handheldWeapons[0];
        if (slot0) {
          handleSelectTacticalWeapon(playerUnit.weaponId === slot0.slotId ? 'unarmed' : slot0.slotId);
        } else {
          handleSelectTacticalWeapon('pistol');
        }
      } else if (e.code === 'Digit2' || e.code === 'Numpad2') {
        e.preventDefault();
        const slot1 = playerUnit.tacticalLoadout.handheldWeapons[1];
        if (slot1) {
          handleSelectTacticalWeapon(playerUnit.weaponId === slot1.slotId ? 'unarmed' : slot1.slotId);
        } else {
          handleSelectTacticalWeapon('rifle');
        }
      } else if (e.code === 'Digit3' || e.code === 'Numpad3') {
        e.preventDefault();
        const slot2 = playerUnit.tacticalLoadout.handheldWeapons[2];
        if (slot2) {
          handleSelectTacticalWeapon(playerUnit.weaponId === slot2.slotId ? 'unarmed' : slot2.slotId);
        } else {
          handleSelectTacticalWeapon('bazooka');
        }
      } else if (e.code === 'Digit4' || e.code === 'Numpad4') {
        e.preventDefault();
        if (playerUnit.tacticalLoadout.grenadeCount > 0) {
          handleUseTacticalSecondaryItem('hand_grenade');
        } else {
          handleSelectTacticalWeapon('unarmed');
        }
      } else if (e.code === 'Digit5' || e.code === 'Numpad5') {
        e.preventDefault();
        if (playerUnit.tacticalLoadout.landMineCount > 0) {
          handleUseTacticalSecondaryItem('land_mine');
        }
      } else if (e.code === 'Digit0' || e.code === 'Backquote') {
        e.preventDefault();
        handleSelectTacticalWeapon('unarmed');
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };

    const updateMouseWorldAim = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      mouseNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouseNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const houseFloorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -HOUSE_ORIGIN_Y);
    const scratchHouseHitPoint = new THREE.Vector3();

    const onPointerMove = (e: PointerEvent) => {
      updateMouseWorldAim(e.clientX, e.clientY);
      if (npcCameraMode === 'house_interior') {
        if (draggingHouseFurnitureId) {
          const draggedItem = housePlacedItems.find(
            (it) => it.instanceId === draggingHouseFurnitureId,
          );
          if (draggedItem) {
            raycaster.setFromCamera(mouseNdc, camera);
            if (raycaster.ray.intersectPlane(houseFloorPlane, scratchHouseHitPoint)) {
              const solved = solveFurnitureFreePlacement(
                draggedItem.instanceId,
                draggedItem.catalogId,
                scratchHouseHitPoint.x,
                scratchHouseHitPoint.z,
                draggedItem.ry,
                housePlacedItems,
              );
              draggedItem.x = solved.x;
              draggedItem.z = solved.z;
              syncFootprintOutlines(
                draggedItem.catalogId,
                solved.x,
                solved.z,
                draggedItem.ry,
                solved.valid,
                true,
              );
            }
          }
          return;
        }
        if (isOrbitingHouseCamera) {
          const dx = e.clientX - houseOrbitDragStart.x;
          const dy = e.clientY - houseOrbitDragStart.y;
          houseCamYaw = clamp(houseOrbitDragStart.yaw - dx * 0.0065, -1.45, 1.45);
          houseCamPitch = clamp(houseOrbitDragStart.pitch + dy * 0.0055, 0.18, 1.22);
          return;
        }
        if (isPanningHouseCamera) {
          const dx = e.clientX - houseOrbitDragStart.x;
          const dy = e.clientY - houseOrbitDragStart.y;
          const cosY = Math.cos(houseCamYaw);
          const sinY = Math.sin(houseCamYaw);
          houseCamTarget.x = clamp(
            houseOrbitDragStart.tx - (dx * cosY + dy * sinY) * 0.014,
            -3.6,
            3.6,
          );
          houseCamTarget.z = clamp(
            houseOrbitDragStart.tz + (dx * sinY - dy * cosY) * 0.014,
            -2.4,
            2.4,
          );
          return;
        }
        return;
      }
      if (playModeRef.current === 'editor') {
        if (isEditorPanning) {
          const dx = e.clientX - panDragStart.x;
          const dy = e.clientY - panDragStart.y;
          const panFactor = 0.065 * editorZoom;
          const cosY = Math.cos(editorOrbitYaw);
          const sinY = Math.sin(editorOrbitYaw);
          const worldDx = -dx * cosY - dy * sinY;
          const worldDz = dx * sinY - dy * cosY;
          editorPan.x = wrapPlanetCoord(panDragStart.panX + worldDx * panFactor);
          editorPan.z = wrapPlanetCoord(panDragStart.panZ + worldDz * panFactor);
        } else if (isEditorOrbiting) {
          const dx = e.clientX - orbitDragStart.x;
          const dy = e.clientY - orbitDragStart.y;
          editorOrbitYaw = orbitDragStart.yaw - dx * 0.0075;
          editorOrbitPitch = clamp(orbitDragStart.pitch + dy * 0.0065, 0.22, 1.38);
        }
        return;
      }
      if (isOrbitingSeatedCamera && playerUnit?.isSitting && activeSeatedSpot) {
        const dx = e.clientX - seatedOrbitDragStart.x;
        const dy = e.clientY - seatedOrbitDragStart.y;
        seatedCameraYaw = seatedOrbitDragStart.yaw - dx * 0.007;
        seatedCameraPitch = clamp(seatedOrbitDragStart.pitch + dy * 0.0055, 0.06, 0.85);
      }
    };

    const scratchPickupPt = new THREE.Vector3();
    const scratchCharHitPos = new THREE.Vector3();

    const onPointerDown = (e: PointerEvent) => {
      if (gameStateRef.current !== 'playing') return;
      updateMouseWorldAim(e.clientX, e.clientY);

      if (npcCameraMode === 'house_interior') {
        if (e.button === 0) {
          raycaster.setFromCamera(mouseNdc, camera);
          const hits = raycaster.intersectObjects(placedFurnitureContainer.children, true);
          const hitInstId = hits.find(
            (h) => typeof h.object.userData?.houseFurnitureInstanceId === 'string',
          )?.object.userData.houseFurnitureInstanceId as string | undefined;

          if (hitInstId) {
            const hitItem = housePlacedItems.find((it) => it.instanceId === hitInstId);
            if (hitItem) {
              soundEngine.playUiClick();
              selectedHouseFurnitureId = hitInstId;
              draggingHouseFurnitureId = hitInstId;
              hitItem.lift = 0.16;
              syncFootprintOutlines(hitItem.catalogId, hitItem.x, hitItem.z, hitItem.ry, true, true);
              emitHouseInteriorStateToUi();
              return;
            }
          }
          // Dragging on empty space orbits the cutaway dollhouse camera (`buddies-blitz.com/interior`)
          isOrbitingHouseCamera = true;
          houseOrbitDragStart = {
            x: e.clientX,
            y: e.clientY,
            yaw: houseCamYaw,
            pitch: houseCamPitch,
            tx: houseCamTarget.x,
            tz: houseCamTarget.z,
          };
        } else if (e.button === 1 || e.button === 2) {
          isPanningHouseCamera = true;
          houseOrbitDragStart = {
            x: e.clientX,
            y: e.clientY,
            yaw: houseCamYaw,
            pitch: houseCamPitch,
            tx: houseCamTarget.x,
            tz: houseCamTarget.z,
          };
        }
        return;
      }

      if (playModeRef.current === 'editor') {
        if (e.button === 0) {
          isEditorPanning = true;
          panDragStart = {
            x: e.clientX,
            y: e.clientY,
            panX: editorPan.x,
            panZ: editorPan.z,
          };
        } else if (e.button === 1 || e.button === 2) {
          isEditorOrbiting = true;
          orbitDragStart = {
            x: e.clientX,
            y: e.clientY,
            yaw: editorOrbitYaw,
            pitch: editorOrbitPitch,
          };
        }
        return;
      }

      if (nukeStrikeState.phase === 'targeting') {
        if (e.button === 0) {
          raycaster.setFromCamera(mouseNdc, camera);
          if (raycaster.ray.intersectPlane(groundPlane, aimWorldPoint)) {
            nukeStrikeState = updateNuclearStrikeTargetCursor(
              nukeStrikeState,
              aimWorldPoint.x,
              getTerrainElevation(aimWorldPoint.x, aimWorldPoint.z),
              aimWorldPoint.z,
              280.0,
            );
          }
          confirmAndLaunchNuclearStrike();
        } else if (e.button === 2) {
          soundEngine.playUiClick();
          nukeStrikeState = createInitialNuclearStrikeState();
          nukeTargetReticleGroup.visible = false;
        }
        return;
      }

      if (e.button === 0) {
        raycaster.setFromCamera(mouseNdc, camera);

        // 1. Raycast Check for Teleport Kiosks (Lobby Warzone, Lobby Safezone, and Halte Lobby)
        // Strictly separated from Base Command Plot Kiosks — clicking Teleport Kiosks NEVER opens Base Claim / Kiosk UI!
        const teleKiosks: { mesh: THREE.Object3D; kind: 'lobby_warzone' | 'lobby_safezone' | 'halte_to_lobby' }[] = [];
        const wzKiosk = scene.getObjectByName('LobbyWarzoneTeleportKiosk3D');
        if (wzKiosk && wzKiosk.visible) teleKiosks.push({ mesh: wzKiosk, kind: 'lobby_warzone' });
        const szKiosk = scene.getObjectByName('LobbySafezoneTeleportKiosk3D');
        if (szKiosk && szKiosk.visible) teleKiosks.push({ mesh: szKiosk, kind: 'lobby_safezone' });
        const halteKiosk = scene.getObjectByName('HalteLobbyTeleportKiosk3D');
        if (halteKiosk && halteKiosk.visible) teleKiosks.push({ mesh: halteKiosk, kind: 'halte_to_lobby' });

        const teleHitBox = new THREE.Box3();
        let hitTeleKind: 'lobby_warzone' | 'lobby_safezone' | 'halte_to_lobby' | null = null;
        for (const tk of teleKiosks) {
          tk.mesh.updateWorldMatrix(true, false);
          tk.mesh.getWorldPosition(scratchKioskWorldPos);
          const kx = scratchKioskWorldPos.x;
          const ky = scratchKioskWorldPos.y;
          const kz = scratchKioskWorldPos.z;
          teleHitBox.min.set(kx - 1.85, ky - 0.25, kz - 1.85);
          teleHitBox.max.set(kx + 1.85, ky + 4.5, kz + 1.85);
          if (raycaster.ray.intersectsBox(teleHitBox)) {
            const actorX = mountedTank ? mountedTank.x : playerUnit.x;
            const actorZ = mountedTank ? mountedTank.z : playerUnit.z;
            const distToKiosk = getPlanetShortestDistance(actorX, actorZ, kx, kz);
            if (distToKiosk <= 16.0) {
              hitTeleKind = tk.kind;
              break;
            }
          }
        }
        if (hitTeleKind) {
          soundEngine.playUiClick();
          activeClickedTeleportKiosk = hitTeleKind;
          syncTeleportKiosksGreenFootRing(hitTeleKind);
          if (selectedCharacterTarget) {
            clearCharacterSelection();
            window.dispatchEvent(new CustomEvent('character-deselected'));
            window.dispatchEvent(new CustomEvent('close-character-profile-modal'));
          }
          window.dispatchEvent(
            new CustomEvent('open-teleport-kiosk-modal', { detail: { kind: hitTeleKind } }),
          );
          return;
        } else if (activeClickedTeleportKiosk !== 'none') {
          clearTeleportKioskSelection();
        }

        // 2. Base Command Plot Kiosks (Command Plot Claim / Base Upgrades in Warzone)
        const kioskHitBox = new THREE.Box3();
        for (const cp of [...blueBase.commanderPads, ...redBase.commanderPads]) {
          if (cp && cp.kioskMesh.visible) {
            cp.kioskMesh.updateWorldMatrix(true, false);
            cp.kioskMesh.getWorldPosition(scratchKioskWorldPos);
            const kx = scratchKioskWorldPos.x;
            const ky = scratchKioskWorldPos.y;
            const kz = scratchKioskWorldPos.z;
            kioskHitBox.min.set(kx - 1.65, ky - 0.25, kz - 1.65);
            kioskHitBox.max.set(kx + 1.65, ky + 4.25, kz + 1.65);
            if (raycaster.ray.intersectsBox(kioskHitBox)) {
              const actorX = mountedTank ? mountedTank.x : playerUnit.x;
              const actorZ = mountedTank ? mountedTank.z : playerUnit.z;
              const distToKiosk = getPlanetShortestDistance(actorX, actorZ, kx, kz);
              if (isKioskPromptActive || distToKiosk <= INTERACT_EXIT_RADIUS + 0.6) {
                soundEngine.playUiClick();
                emitHudImmediately();
                window.dispatchEvent(new CustomEvent('toggle-kiosk-ui'));
              }
              return;
            }
          }
        }

        // Click-to-Swap Dropped Weapon ("dan juga bisa swap senjata dengan cara mengklik senjata yang drop itu"):
        // Clicking directly on a dropped weapon in the 3D world equips or swaps it into the player's 3-slot handheld inventory!
        if (!mountedTank && playerUnit && playerUnit.alive) {
          raycaster.ray.intersectPlane(groundPlane, aimWorldPoint);
          let clickedWeaponIdx = -1;
          let bestClickScore = 1.65;
          for (let pi = 0; pi < worldPickups.length; pi++) {
            const pk = worldPickups[pi];
            if (pk.kind !== 'weapon' || pk.collected) continue;
            const distToPlayer = getPlanetShortestDistance(playerUnit.x, playerUnit.z, pk.x, pk.z);
            if (distToPlayer > 16.0) continue;
            scratchPickupPt.set(pk.x, pk.y, pk.z);
            const rayDist = raycaster.ray.distanceToPoint(scratchPickupPt);
            const groundDist = getPlanetShortestDistance(aimWorldPoint.x, aimWorldPoint.z, pk.x, pk.z);
            const clickDist = Math.min(rayDist, groundDist);
            if (clickDist <= bestClickScore) {
              bestClickScore = clickDist;
              clickedWeaponIdx = pi;
            }
          }
          if (clickedWeaponIdx !== -1) {
            const pk = worldPickups[clickedWeaponIdx];
            const swapRes = equipOrSwapDroppedWeaponInLoadout(
              playerUnit.tacticalLoadout,
              pk.weaponName,
              pk.remainingAmmo,
            );
            playerUnit.tacticalLoadout = swapRes.updatedLoadout;
            syncUnitFieldsFromLoadout(playerUnit);
            playerUnit.weaponRecoil = 0.38;
            soundEngine.playPickup();
            spawnBurstParticles(pk.x, pk.y, pk.z, 10);
            if (swapRes.action === 'swapped' && swapRes.droppedPreviousWeapon) {
              const prev = swapRes.droppedPreviousWeapon;
              const prevWid: 'pistol' | 'rifle' | 'rocket' =
                prev.slotId === 'bazooka'
                  ? 'rocket'
                  : prev.slotId === 'pistol'
                    ? 'pistol'
                    : 'rifle';
              spawnWorldPickup('weapon', prev.weaponName, pk.x, pk.z, {
                weaponId: prevWid,
                remainingAmmo: prev.remainingAmmo,
                vx: (Math.random() - 0.5) * 2.2,
                vy: 4.2,
                vz: (Math.random() - 0.5) * 2.2,
                despawnTimerSec: TEAM_BUDDIES_CRAFTED_WEAPON_DESPAWN_SEC,
              });
            }
            playerUnit.saluteTimer = 1.65;
            playerUnit.saluteSign.updateText(
              swapRes.action === 'swapped' ? 'WEAPON SWAPPED!' : 'WEAPON EQUIPPED!',
              `${playerUnit.weaponName.toUpperCase()} (${playerUnit.ammo})`,
              '#b8ff3c',
              1,
            );
            playerUnit.saluteSign.sprite.visible = true;
            scene.remove(pk.mesh);
            worldPickups.splice(clickedWeaponIdx, 1);
            emitHudImmediately();
            return;
          }
        }

        // Raycast Click Selection on Other Characters / NPCs / Self (Avakin MMORPG Interaction Style)
        // If clicking a unit or oneself, highlight body with neon green aura, selection ring, nameplate, and floating menu
        raycaster.setFromCamera(mouseNdc, camera);
        let clickedCharacter: {
          id: string | number;
          name: string;
          isNpc: boolean;
          team: 'blue' | 'red';
          status: string;
          root: THREE.Object3D;
          nameplate?: { sprite: THREE.Sprite } | null;
          isSelf?: boolean;
        } | null = null;
        let bestCharDist = 2.4;

        // 1. Check AI Buddy Units
        for (let bi = 0; bi < buddyUnits.length; bi++) {
          const u = buddyUnits[bi];
          if (!u.alive) continue;
          u.root.getWorldPosition(scratchCharHitPos);
          scratchCharHitPos.y += 1.4; // Center of torso
          const rayDist = raycaster.ray.distanceToPoint(scratchCharHitPos);
          if (rayDist < bestCharDist) {
            bestCharDist = rayDist;
            clickedCharacter = {
              id: u.id,
              name: u.isPlayer ? 'YOU' : `BUDDY #${u.id} (${u.classId.toUpperCase()})`,
              isNpc: false,
              team: u.team,
              status: u.carryingCrate !== 'none' ? 'Carrying Crate' : u.weaponName || 'Chilling',
              root: u.root,
              nameplate: u.nameplate,
              isSelf: Boolean(u.isPlayer),
            };
          }
        }

        // 2. Also check Player Unit directly
        if (playerUnit && playerUnit.alive) {
          playerUnit.root.getWorldPosition(scratchCharHitPos);
          scratchCharHitPos.y += 1.4;
          const rayDist = raycaster.ray.distanceToPoint(scratchCharHitPos);
          if (rayDist < bestCharDist) {
            bestCharDist = rayDist;
            clickedCharacter = {
              id: playerUnit.id,
              name: 'YOU',
              isNpc: false,
              team: playerUnit.team,
              status: playerUnit.carryingCrate !== 'none' ? 'Carrying Crate' : playerUnit.weaponName || 'Chilling',
              root: playerUnit.root,
              nameplate: playerUnit.nameplate,
              isSelf: true,
            };
          }
        }

        // 3. Check Standing NPCs (Hana Cafe & Kai Beach House)
        for (const npc of [
          {
            id: 'npc_cafe',
            name: 'HANA',
            team: 'blue' as const,
            status: 'Official Merchant',
            grp: lobbyCafeNpc.npcGrp,
            nameplate: lobbyCafeNpc.npcNameplate,
            active: worldModeRef.current === 'lobby',
          },
          {
            id: 'npc_beach',
            name: 'KAI',
            team: 'red' as const,
            status: 'Beach Merchant',
            grp: beachHouseNpc.npcGrp,
            nameplate: beachHouseNpc.npcNameplate,
            active: worldModeRef.current !== 'lobby',
          },
        ]) {
          if (!npc.active) continue;
          npc.grp.getWorldPosition(scratchCharHitPos);
          scratchCharHitPos.y += 1.4;
          const rayDist = raycaster.ray.distanceToPoint(scratchCharHitPos);
          if (rayDist < bestCharDist) {
            bestCharDist = rayDist;
            clickedCharacter = {
              id: npc.id,
              name: npc.name,
              isNpc: true,
              team: npc.team,
              status: npc.status,
              root: npc.grp,
              nameplate: npc.nameplate,
              isSelf: false,
            };
          }
        }

        if (clickedCharacter) {
          soundEngine.playUiClick();
          clearTeleportKioskSelection();
          if (selectedCharacterTarget && selectedCharacterTarget.root !== clickedCharacter.root) {
            clearCharacterSelection();
          }
          selectedCharacterTarget = clickedCharacter;
          if (playerUnit) syncUnitFootRingTeamColor(playerUnit);
          buddyUnits.forEach((b) => syncUnitFootRingTeamColor(b));

          // SHOW ONLY THE CLICKED CHARACTER'S GLASSMORPHIC NAMEPLATE!
          if (clickedCharacter.nameplate?.sprite) {
            clickedCharacter.nameplate.sprite.visible = true;
          }

          // Flat green selection ring on the floor under the character's feet
          const groundElev = getTerrainElevation(clickedCharacter.root.position.x, clickedCharacter.root.position.z);
          characterSelectionRing.position.set(
            clickedCharacter.root.position.x,
            groundElev + 0.04,
            clickedCharacter.root.position.z,
          );
          characterSelectionRing.visible = true;

          // Dispatch selection event to show bottom HUD in React
          window.dispatchEvent(
            new CustomEvent('character-selected', {
              detail: {
                user: {
                  id: clickedCharacter.id,
                  name: clickedCharacter.name,
                  isNpc: clickedCharacter.isNpc,
                  team: clickedCharacter.team,
                  distance: getPlanetShortestDistance(
                    playerUnit?.x ?? 0,
                    playerUnit?.z ?? 0,
                    clickedCharacter.root.position.x,
                    clickedCharacter.root.position.z,
                  ),
                  status: clickedCharacter.status,
                },
              },
            }),
          );

          isPointerDown = false;
          return;
        } else {
          clearTeleportKioskSelection();
          if (selectedCharacterTarget) {
            // Clicked outside characters -> deselect and notify React
            clearCharacterSelection();
            window.dispatchEvent(new CustomEvent('character-deselected'));
            window.dispatchEvent(new CustomEvent('close-character-profile-modal'));
          }
        }

        if (playerUnit?.isSitting && activeSeatedSpot) {
          isOrbitingSeatedCamera = true;
          seatedOrbitDragStart = {
            x: e.clientX,
            y: e.clientY,
            yaw: seatedCameraYaw,
            pitch: seatedCameraPitch,
          };
        }

        isPointerDown = true;
      } else if (e.button === 2) {
        handlePlayerPickupOrThrowCrate();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (npcCameraMode === 'house_interior') {
        if (draggingHouseFurnitureId) {
          const droppedItem = housePlacedItems.find(
            (it) => it.instanceId === draggingHouseFurnitureId,
          );
          if (droppedItem) {
            droppedItem.lift = 0;
            soundEngine.playPickup();
          }
          draggingHouseFurnitureId = null;
          emitHouseInteriorStateToUi();
        }
        isOrbitingHouseCamera = false;
        isPanningHouseCamera = false;
        return;
      }
      if (playModeRef.current === 'editor') {
        isEditorPanning = false;
        isEditorOrbiting = false;
        return;
      }

      if (e.button === 0) {
        isPointerDown = false;
        isOrbitingSeatedCamera = false;
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (npcCameraMode === 'house_interior') {
        if (draggingHouseFurnitureId || (e.shiftKey && selectedHouseFurnitureId)) {
          const targetId = draggingHouseFurnitureId ?? selectedHouseFurnitureId;
          const item = housePlacedItems.find((it) => it.instanceId === targetId);
          if (item) {
            const stepDir = e.deltaY > 0 ? 1 : -1;
            const nextRy = item.ry + stepDir * (Math.PI / 4);
            const solved = solveFurnitureFreePlacement(
              item.instanceId,
              item.catalogId,
              item.x,
              item.z,
              nextRy,
              housePlacedItems,
            );
            item.x = solved.x;
            item.z = solved.z;
            item.ry = nextRy;
            item.vy = Math.max(item.vy, 1.15);
            syncFootprintOutlines(item.catalogId, item.x, item.z, item.ry, solved.valid, true);
            soundEngine.playUiClick();
            emitHouseInteriorStateToUi();
          }
        } else {
          houseCamDist = clamp(houseCamDist + Math.sign(e.deltaY) * 0.65, 6.2, 18.5);
        }
        return;
      }
      if (playModeRef.current === 'editor') {
        editorZoom = clamp(editorZoom + Math.sign(e.deltaY) * 0.1, 0.35, 2.2);
      } else if (playerUnit?.isSitting && activeSeatedSpot) {
        seatedCameraDist = clamp(seatedCameraDist + Math.sign(e.deltaY) * 0.35, 2.6, 6.2);
      } else {
        // Batas kamera zoom-in (0.58) hingga batas maksimal zoom-out (0.86)
        cameraZoom = clamp(cameraZoom + Math.sign(e.deltaY) * 0.07, 0.58, 0.86);
      }
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    // External HUD buttons trigger actions via CustomEvent
    const onBuddyActionEvent = (e: Event) => {
      const ce = e as CustomEvent<string>;
      const act = ce.detail;
      if (act === 'pickupOrThrow') handlePlayerPickupOrThrowCrate();
      else if (act === 'jump') handlePlayerJump();
      else if (act === 'kickOrCraft') handlePlayerKickOrCraft();
      else if (act === 'mountOrDismount') handleToggleMountTank();
      else if (act === 'cycleBuildOrder') handleCycleBuildOrder();
      else if (act === 'cycleCommand') handleCursorOrCycleTeamCommand(false);
      else if (act === 'swapBuddy') handleSwapBuddy();
      else if (act === 'selectWeaponUnarmed') handleSelectTacticalWeapon('unarmed');
      else if (act === 'selectWeaponPistol') handleSelectTacticalWeapon('pistol');
      else if (act === 'selectWeaponRifle') handleSelectTacticalWeapon('rifle');
      else if (act === 'selectWeaponBazooka') handleSelectTacticalWeapon('bazooka');
      else if (act === 'selectWeaponLaser') handleSelectTacticalWeapon('laser');
      else if (act === 'selectWeaponGatling') handleSelectTacticalWeapon('gatling');
      else if (act === 'useHandGrenade') handleUseTacticalSecondaryItem('hand_grenade');
      else if (act === 'useLandMine') handleUseTacticalSecondaryItem('land_mine');
      else if (act === 'hotJoinPlayer') handleHotJoinPlayer();
      else if (act === 'sandboxDropRedCrate') handleSandboxQuickDropCrate('red');
      else if (act === 'sandboxDropSuperCrate') handleSandboxQuickDropCrate('super');
      else if (act === 'sandboxDropLegendCrate') handleSandboxQuickDropCrate('legend');
      else if (act === 'sandboxSpawnTank') handleSandboxQuickSpawnTank();
      else if (act === 'sandboxSpawnSuperTank') handleSandboxQuickSpawnSuperTank();
      else if (act === 'sandboxSpawnPlane') handleSandboxQuickSpawnPlane();
      else if (act === 'sandboxSpawnTruck') handleSandboxQuickSpawnTruck();
      else if (act === 'setCharacterGender:female') applyCharacterGenderSwitch('female');
      else if (act === 'setCharacterGender:male') applyCharacterGenderSwitch('male');
      else if (act === 'toggleCharacterGender')
        applyCharacterGenderSwitch(getDefaultCharacterGender() === 'male' ? 'female' : 'male');
      else if (act === 'toggleSitting') handleToggleSitting(null);
      else if (act === 'qcToggleSitting') handleToggleSitting('female');
      else if (act === 'qcToggleSittingMale') handleToggleSitting('male');
      else if (act === 'toggleDriving') handleToggleDriving(null);
      else if (act === 'qcToggleDrivingFemale') handleToggleDriving('female');
      else if (act === 'qcToggleDrivingMale') handleToggleDriving('male');
      else if (act === 'qcEquipWeapon:unarmed') handleQcEquipWeapon('unarmed');
      else if (act === 'qcEquipWeapon:pistol' || act === 'sandboxEquipPistol')
        handleQcEquipWeapon('pistol');
      else if (act === 'qcEquipWeapon:rifle' || act === 'sandboxEquipRifle')
        handleQcEquipWeapon('rifle');
      else if (act === 'qcEquipWeapon:bazooka' || act === 'sandboxEquipBazooka')
        handleQcEquipWeapon('bazooka');
      else if (act === 'qcEquipWeapon:laser') handleQcEquipWeapon('laser');
      else if (act === 'qcEquipWeapon:gatling') handleQcEquipWeapon('gatling');
      else if (act === 'qcEquipWeapon:fishing_rod') handleQcEquipWeapon('fishing_rod');
      else if (act === 'qcBoardVehicle:tank') handleQcBoardVehicle('tank');
      else if (act === 'qcBoardVehicle:super_tank') handleQcBoardVehicle('super_tank');
      else if (act === 'qcBoardVehicle:truck') handleQcBoardVehicle('truck');
      else if (act === 'qcBoardVehicle:plane') handleQcBoardVehicle('plane');
      else if (act === 'qcBoardVehicle:tram') handleQcBoardVehicle('tram');
      else if (act === 'qcBoardVehicle:dismount') handleQcBoardVehicle('dismount');
      else if (act === 'useSecondaryOrdnance') handleUseSecondaryOrdnance();
      else if (act === 'sandboxUnlockBaseLv3') handleSandboxUnlockBaseLv3();
      else if (act === 'sandboxEquipLaserGun') {
        qcForceWeaponVisible = true;
        if (mountedTank) handleToggleMountTank();
        playerUnit.tacticalLoadout = equipOrSwapDroppedWeaponInLoadout(
          playerUnit.tacticalLoadout,
          'LG-88 Photon Lance',
          200,
        ).updatedLoadout;
        syncUnitFieldsFromLoadout(playerUnit);
        handleSelectTacticalWeapon('laser');
        const fwdX = Math.cos(playerUnit.yaw);
        const fwdZ = -Math.sin(playerUnit.yaw);
        const pY = getTerrainElevation(playerUnit.x, playerUnit.z) + 1.48;
        const mPos = new THREE.Vector3(
          wrapPlanetCoord(playerUnit.x + fwdX * 1.48),
          pY,
          wrapPlanetCoord(playerUnit.z + fwdZ * 1.48),
        );
        const endPos = new THREE.Vector3(
          wrapPlanetCoord(playerUnit.x + fwdX * 18.0),
          getTerrainElevation(playerUnit.x + fwdX * 18.0, playerUnit.z + fwdZ * 18.0) + 1.1,
          wrapPlanetCoord(playerUnit.z + fwdZ * 18.0),
        );
        soundEngine.playLaserGunFire();
        spawnLaserBeamEffect(mPos, endPos);
        spawnTargetFireParticles(endPos.x, endPos.y, endPos.z, 18, 0.65);
        fireProjectile(true, 'BlitzLaserGun', mPos, new THREE.Vector3(fwdX, 0, fwdZ), 68, 18);
        spawnWorldPickup(
          'weapon',
          'LG-88 Photon Lance',
          wrapPlanetCoord(playerUnit.x + fwdX * 2.8),
          wrapPlanetCoord(playerUnit.z + fwdZ * 2.8),
          { weaponId: 'rifle', remainingAmmo: 160, despawnTimerSec: 60 },
        );
      } else if (act === 'sandboxEquipGatlingGun') {
        qcForceWeaponVisible = true;
        if (mountedTank) handleToggleMountTank();
        playerUnit.tacticalLoadout = equipOrSwapDroppedWeaponInLoadout(
          playerUnit.tacticalLoadout,
          'TITAN-6 Rotary Gatling',
          300,
        ).updatedLoadout;
        syncUnitFieldsFromLoadout(playerUnit);
        handleSelectTacticalWeapon('gatling');
        const fwdX = Math.cos(playerUnit.yaw);
        const fwdZ = -Math.sin(playerUnit.yaw);
        const rightX = Math.sin(playerUnit.yaw);
        const rightZ = Math.cos(playerUnit.yaw);
        const pY = getTerrainElevation(playerUnit.x, playerUnit.z) + 1.44;
        const mPos = new THREE.Vector3(
          wrapPlanetCoord(playerUnit.x + fwdX * 1.52),
          pY,
          wrapPlanetCoord(playerUnit.z + fwdZ * 1.52),
        );
        soundEngine.playGatlingGunFire();
        spawnGatlingBrassAndSparks(mPos.x, mPos.y, mPos.z, fwdX, fwdZ, rightX, rightZ);
        fireProjectile(true, 'Titan6Gatling', mPos, new THREE.Vector3(fwdX, 0, fwdZ), 62, 14);
        spawnWorldPickup(
          'weapon',
          'TITAN-6 Rotary Gatling',
          wrapPlanetCoord(playerUnit.x + fwdX * 2.8),
          wrapPlanetCoord(playerUnit.z + fwdZ * 2.8),
          { weaponId: 'rifle', remainingAmmo: 240, despawnTimerSec: 60 },
        );
      } else if (act === 'sandboxGiveHandGrenade') {
        if (mountedTank) handleToggleMountTank();
        playerUnit.tacticalLoadout = addTacticalSecondaryToLoadout(
          playerUnit.tacticalLoadout,
          'hand_grenade',
          5,
        );
        syncUnitFieldsFromLoadout(playerUnit);
        handleUseTacticalSecondaryItem('hand_grenade');
      } else if (act === 'sandboxGiveLandMine') {
        if (mountedTank) handleToggleMountTank();
        playerUnit.tacticalLoadout = addTacticalSecondaryToLoadout(
          playerUnit.tacticalLoadout,
          'land_mine',
          5,
        );
        syncUnitFieldsFromLoadout(playerUnit);
        handleUseTacticalSecondaryItem('land_mine');
      } else if (act === 'sandboxSpawnPlaneWithClusterBomb') {
        handleSandboxUnlockBaseLv3();
        playerUnit.secondaryItem = 'cluster_bomb';
        playerUnit.secondaryCount = 6;
        if (!mountedTank || mountedTank.vehicleKind !== 'plane') {
          if (mountedTank) handleToggleMountTank();
          const newPlane = createBlitzPlaneVehicle(playerUnit.x, playerUnit.z, 'blue');
          newPlane.altitude = 9.5;
          newPlane.targetAltitude = 11.5;
          newPlane.forwardSpeed = 10.5;
          tanks.push(newPlane);
          mountedTank = newPlane;
          newPlane.occupiedByPlayer = true;
          playerUnit.isSitting = false;
          playerUnit.isDriving = false;
          activeSeatedSpot = null;
          clearCharacterSelection();
          const activeMountChar =
            getDefaultCharacterGender() === 'male'
              ? earlyLoadedManGltf ?? earlyLoadedCharGltf
              : earlyLoadedCharGltf;
          if (activeMountChar && newPlane.riderGroup.userData.riderRig) {
            upgradeBuddyRigWithCharBuddiesGlb(
              newPlane.riderGroup.userData.riderRig,
              activeMountChar,
            );
          }
          newPlane.riderGroup.visible = true;
          playerUnit.root.visible = false;
          playerUnit.saluteSign.sprite.visible = false;
        }
        if (mountedTank && mountedTank.vehicleKind === 'plane') {
          dropClusterBombFromPlane(mountedTank);
        }
      } else if (act === 'sandboxDeployNuclearLauncher' || act === 'startNuclearStrikeTargeting') {
        if (act === 'sandboxDeployNuclearLauncher') {
          handleSandboxUnlockBaseLv3();
        }
        startNuclearStrikeTargetingMode();
      } else if (act === 'confirmNuclearStrikeTarget') {
        if (nukeStrikeState.phase === 'targeting') {
          confirmAndLaunchNuclearStrike();
        }
      } else if (act === 'cancelNuclearStrikeTarget') {
        soundEngine.playUiClick();
        nukeStrikeState = createInitialNuclearStrikeState();
        nukeTargetReticleGroup.visible = false;
        nukeCinematicRocketGroup.visible = false;
      } else if (act === 'planeClimbStep') {
        if (mountedTank && mountedTank.vehicleKind === 'plane') {
          soundEngine.playPickup();
          mountedTank.targetAltitude = Math.min(19.5, Math.max(13.8, (mountedTank.targetAltitude ?? 0) + 6.5));
          mountedTank.altitude = Math.min(19.5, Math.max(10.5, (mountedTank.altitude ?? 0) + 6.5));
          mountedTank.verticalSpeed = 8.5;
          mountedTank.forwardSpeed = Math.max(mountedTank.forwardSpeed ?? 0, 8.5);
        }
      } else if (act === 'planeDescendStep') {
        if (mountedTank && mountedTank.vehicleKind === 'plane') {
          soundEngine.playUiClick();
          mountedTank.targetAltitude = 0;
          mountedTank.verticalSpeed = -7.5;
        }
      } else if (act === 'toggleKioskUi') {
        const actorX = mountedTank ? mountedTank.x : playerUnit.x;
        const actorZ = mountedTank ? mountedTank.z : playerUnit.z;
        const nearestKiosk = findNearestBaseKiosk(actorX, actorZ);
        const nearNearTerminal =
          getPlanetShortestDistance(
            actorX,
            actorZ,
            LOBBY_NEAR_TERMINAL_SPEC.x,
            LOBBY_NEAR_TERMINAL_SPEC.z,
          ) <= LOBBY_NEAR_TERMINAL_SPEC.interactRadius;
        if (isKioskPromptActive || nearestKiosk.distance <= INTERACT_EXIT_RADIUS || nearNearTerminal) {
          soundEngine.playUiClick();
          emitHudImmediately();
          window.dispatchEvent(new CustomEvent('toggle-kiosk-ui'));
        }
      } else if (act === 'nearConnectAndMint') {
        soundEngine.playPickup();
        nearSessionState = connectNearWalletAndMintGamepass(nearSessionState);
        kioskStatusMessage = nearSessionState.sessionStatusBanner;
        kioskStatusTimer = 5.5;
        if (playerUnit && playerUnit.alive) {
          playerUnit.saluteTimer = 2.5;
          playerUnit.saluteSign.updateText(
            'NEP-171 GAMEPASS MINTED!',
            `${nearSessionState.walletId} · ${nearSessionState.tokenId}`,
            '#38bdf8',
            1,
          );
          playerUnit.saluteSign.sprite.visible = true;
        }
        emitHudImmediately();
      } else if (act === 'nearClaimBasePlot') {
        const actorX = mountedTank ? mountedTank.x : playerUnit.x;
        const actorZ = mountedTank ? mountedTank.z : playerUnit.z;
        const nearestKiosk = findNearestBaseKiosk(actorX, actorZ);
        const isSafezone = cityArenaMode === 'safezone';
        if (!nearSessionState.walletConnected || !nearSessionState.hasGamepassNft) {
          nearSessionState = connectNearWalletAndMintGamepass(nearSessionState);
        }
        const targetTeam = nearestKiosk.team;
        const targetPlotIdx =
          !isSafezone && nearestKiosk.team === 'blue' && nearestKiosk.plotIndex === 0
            ? 1
            : nearestKiosk.plotIndex;
        if (playerUnit.team !== targetTeam) {
          playerUnit.team = targetTeam;
        }
        releaseActiveNearSessionBaseAndHarvesters();
        const targetPlots = targetTeam === 'blue' ? blueCommanderBases : redCommanderBases;
        const claimRes = claimEmptyBasePlotWithNearGamepass(
          nearSessionState,
          targetPlots,
          playerUnit.team,
          targetTeam,
          targetPlotIdx,
          { isSafezoneMode: isSafezone },
        );
        if (!claimRes.claimed) {
          soundEngine.playHit();
          kioskStatusMessage = claimRes.message;
          kioskStatusTimer = 5.0;
          emitHudImmediately();
          return;
        }
        nearSessionState = claimRes.updatedSession;
        const effectiveTeam = nearSessionState.claimedTeam ?? targetTeam;
        const effectivePlotIdx = nearSessionState.claimedPlotIndex ?? targetPlotIdx;
        playerUnit.team = effectiveTeam;
        playerUnit.ownerCommanderId = effectivePlotIdx;
        syncUnitFootRingTeamColor(playerUnit);
        const targetBaseObj = effectiveTeam === 'blue' ? blueBase : redBase;
        const turrets = getBaseSkyshieldTurrets(targetBaseObj.baseGroup);
        if (turrets[effectivePlotIdx]) {
          turrets[effectivePlotIdx].isBuilt = !isSafezone;
          turrets[effectivePlotIdx].maxHp = 280;
          turrets[effectivePlotIdx].hp = 280;
          turrets[effectivePlotIdx].root.visible = !isSafezone;
        }
        const padInfo = targetBaseObj.commanderPads[effectivePlotIdx] ?? targetBaseObj.commanderPads[0];
        sessionHarvesterUnitIds = [];
        hasActiveBuildContract = !isSafezone && blueBuildQueue.length > 0 && useCustomHologramRecipe;
        if (!isSafezone) {
          spawnContractHarvestersForPlot(effectiveTeam, effectivePlotIdx, MAX_HARVESTERS_PER_BASE);
        }
        navGridDirty = true;
        cachedStaticWorldStructures = null;
        // Ensure player is not wedged between the standalone Kiosk and newly materialized perimeter fence/planter OBBs
        if (!mountedTank && playerUnit && playerUnit.alive && !nearestKiosk.isLobbyTerminal) {
          const plotOffsetsX = [-45.0, -15.0, 15.0, 45.0] as const;
          const sign = effectiveTeam === 'blue' ? 1 : -1;
          const pwx = targetBaseObj.hqX + sign * plotOffsetsX[effectivePlotIdx];
          const kioskWorldX = pwx + sign * 8.52;
          const kioskWorldZ = targetBaseObj.hqZ - sign * 14.68;
          const distToClaimedKiosk = getPlanetShortestDistance(
            playerUnit.x,
            playerUnit.z,
            kioskWorldX,
            kioskWorldZ,
          );
          if (distToClaimedKiosk <= 4.2) {
            const relFromPlotCenter = sign * (playerUnit.x - pwx);
            let needsSafeCourtyardSnap = relFromPlotCenter > 7.35;
            if (!needsSafeCourtyardSnap) {
              const updatedObbs = getStaticWorldStructures();
              for (const st of updatedObbs) {
                if (!st.id.startsWith(`${effectiveTeam}_plot_${effectivePlotIdx}_`)) continue;
                const check = resolveSolidObbCollision2D(
                  playerUnit.x,
                  playerUnit.z,
                  0,
                  0,
                  0.68,
                  st.x,
                  st.z,
                  st.halfX,
                  st.halfZ,
                  st.rotY,
                  0,
                );
                if (check.collided) {
                  needsSafeCourtyardSnap = true;
                  break;
                }
              }
            }
            if (needsSafeCourtyardSnap) {
              playerUnit.x = wrapPlanetCoord(pwx + sign * 6.8);
              playerUnit.z = wrapPlanetCoord(kioskWorldZ);
              playerUnit.vx = 0;
              playerUnit.vz = 0;
              playerUnit.root.position.set(
                playerUnit.x,
                getTerrainElevation(playerUnit.x, playerUnit.z),
                playerUnit.z,
              );
            }
          }
        }
        syncPadVisuals(blueBase, bluePadSlotsList[0], 'BLUE', blueBaseHp);
        syncPadVisuals(redBase, redPadSlotsList[0], 'RED', redBaseHp);
        soundEngine.playBuildBoxCraft(true);
        spawnBurstParticles(padInfo.worldX, 2.2, padInfo.worldZ, 28);
        kioskStatusMessage = claimRes.message;
        kioskStatusTimer = 6.0;
        emitHudImmediately();
      } else if (act === 'nearReleaseBasePlot') {
        soundEngine.playUiClick();
        releaseActiveNearSessionBaseAndHarvesters(
          'DISCONNECTED: Wallet disconnected & Base Plot reverted to an empty green grass lot.',
        );
        nearSessionState = {
          ...createInitialNearGamepassSessionState(),
          sessionStatusBanner:
            'DISCONNECTED: Wallet disconnected & Base Plot reverted to an empty green grass lot.',
        };
        kioskStatusMessage = nearSessionState.sessionStatusBanner;
        kioskStatusTimer = 5.0;
        emitHudImmediately();
      } else if (act.startsWith('setSafezoneAccessMode:')) {
        const modeRaw = act.slice('setSafezoneAccessMode:'.length).trim() as SafezonePlotAccessMode;
        if (modeRaw === 'PUBLIC' || modeRaw === 'FRIENDS_ONLY' || modeRaw === 'PRIVATE') {
          soundEngine.playUiClick();
          const actorX = mountedTank ? mountedTank.x : playerUnit.x;
          const actorZ = mountedTank ? mountedTank.z : playerUnit.z;
          const nearestKiosk = findNearestBaseKiosk(actorX, actorZ);
          const pTeam = nearSessionState.claimedTeam ?? nearestKiosk.team;
          const pIdx = nearSessionState.claimedPlotIndex ?? nearestKiosk.plotIndex;
          const plot = (pTeam === 'blue' ? blueCommanderBases : redCommanderBases)[pIdx];
          if (plot) {
            setSafezonePlotAccessMode(plot, modeRaw);
            kioskStatusMessage = `PLOT ACCESS: ${modeRaw.replace('_', ' ')}`;
            kioskStatusTimer = 4.0;
            syncPadVisuals(blueBase, bluePadSlotsList[0], 'BLUE', blueBaseHp);
            syncPadVisuals(redBase, redPadSlotsList[0], 'RED', redBaseHp);
            emitHudImmediately();
          }
        }
      } else if (act.startsWith('addSafezoneFriend:')) {
        const friendId = act.slice('addSafezoneFriend:'.length).trim();
        soundEngine.playUiClick();
        const actorX = mountedTank ? mountedTank.x : playerUnit.x;
        const actorZ = mountedTank ? mountedTank.z : playerUnit.z;
        const nearestKiosk = findNearestBaseKiosk(actorX, actorZ);
        const pTeam = nearSessionState.claimedTeam ?? nearestKiosk.team;
        const pIdx = nearSessionState.claimedPlotIndex ?? nearestKiosk.plotIndex;
        const plot = (pTeam === 'blue' ? blueCommanderBases : redCommanderBases)[pIdx];
        if (plot) {
          const res = addSafezonePlotFriend(plot, friendId);
          kioskStatusMessage = res.message;
          kioskStatusTimer = 4.0;
          emitHudImmediately();
        }
      } else if (act.startsWith('removeSafezoneFriend:')) {
        const friendId = act.slice('removeSafezoneFriend:'.length).trim();
        soundEngine.playUiClick();
        const actorX = mountedTank ? mountedTank.x : playerUnit.x;
        const actorZ = mountedTank ? mountedTank.z : playerUnit.z;
        const nearestKiosk = findNearestBaseKiosk(actorX, actorZ);
        const pTeam = nearSessionState.claimedTeam ?? nearestKiosk.team;
        const pIdx = nearSessionState.claimedPlotIndex ?? nearestKiosk.plotIndex;
        const plot = (pTeam === 'blue' ? blueCommanderBases : redCommanderBases)[pIdx];
        if (plot) {
          const res = removeSafezonePlotFriend(plot, friendId);
          kioskStatusMessage = res.message;
          kioskStatusTimer = 4.0;
          emitHudImmediately();
        }
      } else if (act === 'teleportToLobby') {
        clearTeleportKioskSelection();
        enterLobbySafezone();
      } else if (act === 'confirmLobbyPortalRed') {
        clearTeleportKioskSelection();
        confirmLobbyFactionPortalDeploy('red');
      } else if (act === 'confirmLobbyPortalBlue') {
        clearTeleportKioskSelection();
        confirmLobbyFactionPortalDeploy('blue');
      } else if (act === 'confirmLobbyEnterSafezoneCity') {
        clearTeleportKioskSelection();
        enterSafezoneCityFromLobby();
      } else if (act === 'confirmLobbyPortal') {
        confirmLobbyFactionPortalDeploy();
      } else if (act === 'rideCityTram') {
        if (!mountedTank && playerUnit && playerUnit.alive && ridingTramCarIdx === null) {
          const tramBoard = canUnitBoardCityTramAtAnyPoint(
            playerUnit.x,
            playerUnit.z,
            cityTram.getState(),
            8.5,
          );
          soundEngine.playPickup();
          ridingTramCarIdx = tramBoard.canBoard ? tramBoard.carIndex : 0;
          playerUnit.vx = 0;
          playerUnit.vz = 0;
          playerUnit.root.visible = true;
          playerUnit.overheadCrateGroup.visible = false;
          emitHudImmediately();
        }
      } else if (act === 'exitCityTram') {
        if (ridingTramCarIdx !== null) {
          disembarkFromCityTram();
          emitHudImmediately();
        }
      } else if (act.startsWith('socialTalk:')) {
        const msg = act.slice('socialTalk:'.length).trim().slice(0, 64);
        if (msg.length > 0 && playerUnit && playerUnit.alive) {
          soundEngine.playUiClick();
          socialTalkMessage = msg;
          socialTalkTimer = 7.5;
          socialSpeechBubbleEl.textContent = msg;
          playerUnit.saluteTimer = 7.5;
          playerUnit.saluteSign.updateText('SOCIAL TALK', msg, '#38bdf8', 1);
          playerUnit.saluteSign.sprite.visible = true;
          emitHudImmediately();
        }
      } else if (act === 'stepIntoLobbyRedPortal' || act === 'stepIntoLobbyWarzonePortal') {
        if (mountedTank) handleToggleMountTank();
        ridingTramCarIdx = null;
        playerUnit.x = -84.0;
        playerUnit.z = -15.0;
        playerUnit.vx = 0;
        playerUnit.vz = 0;
        syncUnitFootRingTeamColor(playerUnit);
        emitHudImmediately();
      } else if (act === 'stepIntoLobbyBluePortal' || act === 'stepIntoLobbySafezonePortal') {
        if (mountedTank) handleToggleMountTank();
        ridingTramCarIdx = null;
        playerUnit.x = -84.0;
        playerUnit.z = 15.0;
        playerUnit.vx = 0;
        playerUnit.vz = 0;
        syncUnitFootRingTeamColor(playerUnit);
        emitHudImmediately();
      } else if (act === 'teleportToHalteLobby' || act === 'teleportToHalteLobbyNorth') {
        if (mountedTank) handleToggleMountTank();
        ridingTramCarIdx = null;
        playerUnit.x = LOBBY_TRAM_SHELTER_SPEC.returnPadX;
        playerUnit.z = LOBBY_TRAM_SHELTER_SPEC.returnPadZ;
        playerUnit.vx = 0;
        playerUnit.vz = 0;
        playerUnit.yaw = Math.PI;
        soundEngine.playPickup();
        emitHudImmediately();
      } else if (act === 'teleportToHalteLobbySouth') {
        if (mountedTank) handleToggleMountTank();
        ridingTramCarIdx = null;
        playerUnit.x = LOBBY_TRAM_SHELTER_SPEC.southReturnPadX;
        playerUnit.z = LOBBY_TRAM_SHELTER_SPEC.southReturnPadZ;
        playerUnit.vx = 0;
        playerUnit.vz = 0;
        playerUnit.yaw = Math.PI;
        soundEngine.playPickup();
        emitHudImmediately();
      } else if (act.startsWith('kioskSelectRecipe:')) {
        const recipeId = act.slice('kioskSelectRecipe:'.length) as KioskBuildPriorityRecipeId;
        const activeCmdPlots =
          nearSessionState.claimedTeam === 'red' ? redCommanderBases : blueCommanderBases;
        const currentCmdLevel =
          activeCmdPlots[nearSessionState.claimedPlotIndex ?? 0]?.buildingLevel ?? 1;
        if (recipeId === 'nuclear_launcher') {
          const nukeAccess = evaluateNuclearLauncherAccess(currentCmdLevel);
          if (!nukeAccess.allowed) {
            soundEngine.playHit();
            kioskStatusMessage = nukeAccess.statusMessage;
            kioskStatusTimer = 5.5;
            emitHudImmediately();
            return;
          }
          if (activeNuclearLaunchers.some((n) => n.team === (nearSessionState.claimedTeam ?? 'blue'))) {
            startNuclearStrikeTargetingMode();
            return;
          }
        }
        if (recipeId === 'cluster_bomb') {
          const clusterAccess = evaluateClusterBombAccess(
            currentCmdLevel,
            Boolean(mountedTank && mountedTank.vehicleKind === 'plane'),
          );
          if (!clusterAccess.allowedToBuild) {
            soundEngine.playHit();
            kioskStatusMessage = clusterAccess.statusMessage;
            kioskStatusTimer = 5.5;
            emitHudImmediately();
            return;
          }
        }
        const spec = KIOSK_BUILD_PRIORITY_RECIPES[recipeId];
        if (spec) {
          const wasEmptyQueue = blueBuildQueue.length === 0 || !useCustomHologramRecipe;
          const enq = enqueueKioskBuildRecipe([], recipeId, 1);
          if (!enq.enqueued) {
            soundEngine.playHit();
            kioskStatusMessage = enq.statusMessage;
            kioskStatusTimer = 4.5;
            emitHudImmediately();
            return;
          }
          soundEngine.playUiClick();
          blueBuildQueue = enq.queue;
          activePriorityRecipe = enq.activeRecipe;
          useCustomHologramRecipe = true;
          hasActiveBuildContract = true;
          const activeSpec = KIOSK_BUILD_PRIORITY_RECIPES[activePriorityRecipe];
          buildOrder = activeSpec.buildOrder;

          // Ensure up to 2 Contract Harvesters are present at the player's active Base Plot and switch them from STANDBY to CONTRACT ACTIVE!
          const activePlotTeam = nearSessionState.claimedTeam ?? 'blue';
          const activePlotIdx = nearSessionState.claimedPlotIndex ?? 0;
          spawnContractHarvestersForPlot(activePlotTeam, activePlotIdx, MAX_HARVESTERS_PER_BASE);
          for (const u of buddyUnits) {
            if (
              u.alive &&
              !u.isPlayer &&
              u.team === activePlotTeam &&
              u.ownerCommanderId === activePlotIdx &&
              (u.assignedRole === 'HARVEST' || sessionHarvesterUnitIds.includes(u.id))
            ) {
              u.saluteTimer = 4.5;
              u.saluteSign.updateText(
                'CONTRACT ACTIVE',
                `${activeSpec.name.toUpperCase()} (${activeSpec.targetCrates} BOX)`,
                '#b8ff3c',
                1,
              );
              u.saluteSign.sprite.visible = true;
            }
          }

          if (wasEmptyQueue || blueBuildQueue.length === 1) {
            const existingCrates = bluePadSlots.filter((s) => s !== 'empty') as (
              | 'red'
              | 'super'
              | 'legend'
            )[];
            bluePadSlots = ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'];
            bluePadSlotsList[0] = bluePadSlots;
            for (const kind of existingCrates) {
              const slotIdx = chooseNextPadSlotIndexForHologram(
                bluePadSlots,
                activeSpec.slotHologramColors,
                kind,
                buildOrder,
              );
              if (slotIdx !== -1) {
                bluePadSlots[slotIdx] = kind;
              } else {
                spawnWorldCrate(kind, blueBase.padX - 3.2, blueBase.padZ - 1.5, true);
              }
            }
          }
          syncPadVisuals(blueBase, bluePadSlots, 'BLUE', blueBaseHp);
          spawnBurstParticles(blueBase.padX, 1.6, blueBase.padZ, 12);
          kioskStatusMessage = `${enq.statusMessage} · AI Harvesters deployed to gather ${activeSpec.targetCrates} crates in the Warzone!`;
          kioskStatusTimer = 4.5;
          if (
            evaluatePadHologramState(
              true,
              useCustomHologramRecipe,
              activePriorityRecipe,
              bluePadSlotsList[0],
            ).isFulfilled
          ) {
            craftFromCommanderPad('blue', 0, true);
          } else {
            emitHudImmediately();
          }
        }
      } else if (act.startsWith('kioskRemoveQueueIndex:')) {
        const rmIdx = Number(act.slice('kioskRemoveQueueIndex:'.length));
        if (!Number.isNaN(rmIdx)) {
          soundEngine.playUiClick();
          const res = removeKioskBuildQueueAtIndex(blueBuildQueue, rmIdx);
          blueBuildQueue = res.queue;
          if (res.activeRecipe) {
            activePriorityRecipe = res.activeRecipe;
            useCustomHologramRecipe = true;
            hasActiveBuildContract = true;
            buildOrder = KIOSK_BUILD_PRIORITY_RECIPES[activePriorityRecipe].buildOrder;
          } else {
            useCustomHologramRecipe = false;
            hasActiveBuildContract = false;
          }
          syncPadVisuals(blueBase, bluePadSlots, 'BLUE', blueBaseHp);
          emitHudImmediately();
        }
      } else if (act === 'kioskClearQueue') {
        soundEngine.playUiClick();
        blueBuildQueue = [];
        useCustomHologramRecipe = false;
        hasActiveBuildContract = false;
        syncPadVisuals(blueBase, bluePadSlots, 'BLUE', blueBaseHp);
        kioskStatusMessage = 'BUILD QUEUE CLEARED · AI Harvesters returned to STANDBY (WAIT CONTRACT)';
        kioskStatusTimer = 3.5;
        emitHudImmediately();
      } else if (act === 'spawnContractHarvester') {
        soundEngine.playPickup();
        const activePlotTeam = nearSessionState.claimedTeam ?? 'blue';
        const activePlotIdx = nearSessionState.claimedPlotIndex ?? 0;
        spawnContractHarvestersForPlot(activePlotTeam, activePlotIdx, MAX_HARVESTERS_PER_BASE);
        kioskStatusMessage = hasActiveBuildContract
          ? '2 AI Pure Harvesters spawned & immediately executing CONTRACT ACTIVE!'
          : '2 AI Pure Harvesters spawned at Base in STANDBY (WAIT CONTRACT) mode!';
        kioskStatusTimer = 4.5;
        emitHudImmediately();
      } else if (act.startsWith('redeemLobbyGoldItem:')) {
        const itemId = act.slice('redeemLobbyGoldItem:'.length) as LobbyGoldExchangeItemId;
        const redeemRes = redeemLobbyGoldExchangeItem(gold, lobbyGoldExchangeOwnedItems, itemId);
        if (!redeemRes.success || !redeemRes.item) {
          soundEngine.playHit();
          kioskStatusMessage = redeemRes.message;
          kioskStatusTimer = 4.5;
          emitHudImmediately();
          return;
        }
        gold = redeemRes.remainingGold;
        lobbyGoldExchangeOwnedItems = redeemRes.updatedOwnedItems;
        const spec = redeemRes.item;
        const myBase = blueCommanderBases[0];
        if (spec.skinThemeId && myBase) {
          myBase.skinTheme = spec.skinThemeId;
        }
        if (spec.gardenPresetId && myBase) {
          myBase.gardenPreset = spec.gardenPresetId;
        }
        if (spec.bonusMaxHp && playerUnit) {
          playerUnit.maxHp = Math.max(playerUnit.maxHp, spec.bonusMaxHp);
          playerUnit.hp = playerUnit.maxHp;
        }
        if (spec.grantWeaponName && playerUnit) {
          playerUnit.tacticalLoadout = equipOrSwapDroppedWeaponInLoadout(
            playerUnit.tacticalLoadout,
            spec.grantWeaponName,
            spec.grantAmmo ?? 180,
          ).updatedLoadout;
          syncUnitFieldsFromLoadout(playerUnit);
          if (
            worldModeRef.current === 'lobby' ||
            worldModeRef.current === 'safezone' ||
            cityArenaMode === 'safezone' ||
            isPointInsideLobbySafezone(playerUnit.x, playerUnit.z)
          ) {
            playerUnit.weaponId = 'unarmed';
            playerUnit.rig.weaponRigGroup.visible = false;
            playerUnit.rig.pistolGroup.visible = false;
          }
        }
        if (spec.id === 'vip_tactical_ordnance_pack' && playerUnit) {
          playerUnit.tacticalLoadout = addTacticalSecondaryToLoadout(
            playerUnit.tacticalLoadout,
            'hand_grenade',
            4,
          );
          syncUnitFieldsFromLoadout(playerUnit);
        }
        soundEngine.playPowerCore();
        spawnBurstParticles(playerUnit.x, 1.8, playerUnit.z, 22);
        if (playerUnit && playerUnit.alive) {
          playerUnit.saluteTimer = 3.0;
          playerUnit.saluteSign.updateText(
            'LOBBY GOLD EXCHANGE',
            `${spec.name.toUpperCase()} EQUIPPED!`,
            '#facc15',
            1,
          );
          playerUnit.saluteSign.sprite.visible = true;
        }
        syncPadVisuals(blueBase, bluePadSlots, 'BLUE', blueBaseHp);
        kioskStatusMessage = redeemRes.message;
        kioskStatusTimer = 5.5;
        emitHudImmediately();
      } else if (act === 'talkToNearestNpcMerchant') {
        soundEngine.playUiClick();
        const dBeach = getPlanetShortestDistance(playerUnit.x, playerUnit.z, 85.8, 60.0);
        const loc = dBeach <= 18.0 && worldModeRef.current !== 'lobby' ? 'beach_house' : 'lobby_cafe';
        window.dispatchEvent(new CustomEvent('open-npc-merchant-ui', { detail: { location: loc } }));
      } else if (act === 'enterPrivateHouseInterior') {
        soundEngine.playUiClick();
        window.dispatchEvent(new CustomEvent('open-house-interior-ui'));
      } else if (act.startsWith('adjustPlayerLul:')) {
        const delta = Number(act.slice('adjustPlayerLul:'.length));
        if (!Number.isNaN(delta)) {
          gold = Math.max(0, gold + delta);
          emitHudImmediately();
        }
      } else if (act.startsWith('applyHouseTheme:')) {
        const parts = act.slice('applyHouseTheme:'.length).split(':');
        const nextSkin = (parts[0] || 'military_standard') as BaseSkinThemeId;
        const nextGarden = (parts[1] || 'sakura_grove') as BaseGardenPresetId;
        for (const plot of blueCommanderBases) {
          plot.skinTheme = nextSkin;
          plot.gardenPreset = nextGarden;
        }
        for (const plot of redCommanderBases) {
          if (plot.isClaimedOnlineSession) {
            plot.skinTheme = nextSkin;
            plot.gardenPreset = nextGarden;
          }
        }
        syncPadVisuals(blueBase, bluePadSlots, 'BLUE', blueBaseHp);
        syncPadVisuals(redBase, redPadSlots, 'RED', redBaseHp);
        emitHudImmediately();
      } else if (act.startsWith('kioskUpgradeBase:')) {
        const upgradeId = act.slice('kioskUpgradeBase:'.length) as KioskBaseGoldUpgradeId;
        const myPlot = blueCommanderBases[0];
        if (myPlot) {
          const res = applyCommanderBaseGoldUpgrade(myPlot, upgradeId, gold);
          kioskStatusMessage = res.message;
          kioskStatusTimer = 4.5;
          if (res.upgraded) {
            gold = res.nextGold;
            blueBaseHp = Math.min(2500, blueBaseHp + 350);
            soundEngine.playPowerCore();
            spawnBurstParticles(blueBase.hqX, 2.5, blueBase.hqZ, 20);
            spawnBurstParticles(blueBase.padX, 2.0, blueBase.padZ, 16);
            syncPadVisuals(blueBase, bluePadSlots, 'BLUE', blueBaseHp);
          } else {
            soundEngine.playHit();
          }
        }
      } else if (act.startsWith('kioskBuyCrate:')) {
        const crateKind = act.slice('kioskBuyCrate:'.length) as WorldCrateKind;
        const res = purchaseCrateAirdropWithGold(crateKind, gold);
        kioskStatusMessage = res.message;
        kioskStatusTimer = 4.5;
        if (res.purchased && res.airdropCrateKind) {
          gold = res.nextGold;
          soundEngine.playPickup();
          const dropX = blueBase.padX - 3.6 + (Math.random() - 0.5) * 2.2;
          const dropZ = blueBase.padZ - 2.0 + (Math.random() - 0.5) * 1.8;
          spawnWorldCrate(res.airdropCrateKind, dropX, dropZ, false);
          spawnBurstParticles(blueBase.padX - 3.6, 2.0, blueBase.padZ - 2.0, 12);
        } else {
          soundEngine.playHit();
        }
      } else if (act === 'editorRotate') handleEditorRotate();
      else if (act === 'editorScaleUp') handleEditorScaleStep(0.15);
      else if (act === 'editorScaleDown') handleEditorScaleStep(-0.15);
      else if (act === 'editorDeleteLast') handleEditorDeleteNearest(aimWorldPoint.x, aimWorldPoint.z);
      else if (act === 'editorClearAllProps') handleEditorClearAllProps();
      else if (act === 'editorSaveMap') handleEditorSaveLayout();
      else if (act === 'editorResetMap') handleEditorResetLayout();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('buddy-action', onBuddyActionEvent);
    window.addEventListener('blur', onWindowBlurOrVisibilityReset);
    document.addEventListener('visibilitychange', onWindowBlurOrVisibilityReset);
    window.addEventListener('focusin', onDocumentFocusIn);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // =========================================================================
    // 12. CAMERA SPRING, OBJECT COLLISION SOLVER & MAIN 60FPS ANIMATION LOOP
    // =========================================================================
    let camFollowPos: Vec3 = {
      x: playerUnit ? playerUnit.x : -32.5,
      y: playerUnit ? getTerrainElevation(playerUnit.x, playerUnit.z) + 1.0 : 0.8,
      z: playerUnit ? playerUnit.z : 38.5,
    };
    const initInLobby = playerUnit
      ? isPointInsideLobbySafezone(playerUnit.x, playerUnit.z)
      : false;
    const initMirrorPose = computeTeamMirrorCameraPose({
      playerTeam: playerUnit?.team ?? 'blue',
      focusX: camFollowPos.x,
      focusY: camFollowPos.y,
      focusZ: camFollowPos.z,
      baseOffset: { x: 0, y: 13.6, z: 16.2 },
      fovScale: 1,
      visualPlaneAlt: 0,
      isEditorOrTitle: initInLobby || cityArenaMode === 'safezone',
    });
    camera.up.set(0, 1, 0);
    camera.position.set(
      initMirrorPose.cameraPos.x,
      initMirrorPose.cameraPos.y,
      initMirrorPose.cameraPos.z,
    );
    camera.lookAt(
      initMirrorPose.lookAtPos.x,
      initMirrorPose.lookAtPos.y,
      initMirrorPose.lookAtPos.z,
    );
    camera.updateMatrixWorld();
    let camFollowVel: Vec3 = { x: 0, y: 0, z: 0 };
    const mousePanCurrent = { x: 0, z: 0 };
    const recoilOffset = { x: 0, z: 0 };
    let shakeTrauma = 0;
    let hudSyncAccumulator = 0;
    let runElapsedSec = 0;

    snapCameraAndStartSpawnBlink = (unit: BuddyUnit) => {
      unit.invincibilityTimer = PLAYER_SPAWN_BLINK_DURATION_SEC;
      const groundY = getTerrainElevation(unit.x, unit.z);
      camFollowPos = { x: unit.x, y: groundY + 1.0, z: unit.z };
      camFollowVel = { x: 0, y: 0, z: 0 };
      mousePanCurrent.x = 0;
      mousePanCurrent.z = 0;
      recoilOffset.x = 0;
      recoilOffset.z = 0;
      shakeTrauma = 0;
    };

    const tryTriggerCooldown = (key: string, timeSec: number, cooldownSec = 0.10): boolean => {
      if (canTriggerCollisionCooldown(collisionCooldownMap.get(key), timeSec, cooldownSec)) {
        collisionCooldownMap.set(key, timeSec);
        return true;
      }
      return false;
    };

    // Detonate an Explosive Red Barrel with 5-Layer Blitz Explosion VFX + 3D Metal Debris + Shockwave Knockback + Blitz Barrel SFX
    // (BUDDIES ExplosiveBarrel `Qi` in `B1Nq4Kq6.js:183450`: explosionRadius = 8.0m, damageRadius = 6.0m, chain-reaction + stun 1.5s)
    const triggerBarrelExplosion = (bx: number, bz: number) => {
      playSpatialSoundAt(bx, bz, 36.0, 6.0, () => {
        soundEngine.playBarrelExplosion();
      });
      const barrelGroundY = getTerrainElevation(bx, bz);
      scratchExplosionPos.set(bx, barrelGroundY + 0.75, bz);
      blitzExplosionSystem.spawnBlitzExplosion(
        scratchExplosionPos,
        1.35,
        'barrel',
      );
      spawnBurstParticles(bx, barrelGroundY + 1.35, bz, 28);
      spawnDebrisChunks(bx, barrelGroundY + 0.65, bz, 'metal', 14);
      const barrelDistToPlayer = getPlanetShortestDistance(
        bx,
        bz,
        getPlayerAudioListenerPos().x,
        getPlayerAudioListenerPos().z,
      );
      if (barrelDistToPlayer < 32.0) {
        shakeTrauma = Math.min(1, shakeTrauma + 0.64 * Math.max(0, 1 - barrelDistToPlayer / 32.0));
      }

      // 1. Push or shatter nearby props & chain-detonate other explosive barrels within 8.0m (BUDDIES explosionRadius = 8)
      for (const other of activeMapProps) {
        if (!other.alive) continue;
        const d = getPlanetShortestDistance(other.x, other.z, bx, bz);
        if (d > 0.05 && d < 8.0) {
          const dx = getPlanetShortestDelta(other.x, bx) / d;
          const dz = getPlanetShortestDelta(other.z, bz) / d;
          const falloff = 1 - d / 8.0;
          const blast = falloff * 14.0;
          if (other.category === 'pushable') {
            other.vx += dx * blast;
            other.vz += dz * blast;
            other.rotVelY += (Math.random() - 0.5) * 9.0;
            if (other.canJiggleOnHit) other.jiggleTimer = 0.35;
          } else if (other.category === 'breakable' && d < 6.0) {
            other.alive = false;
            other.wrapper.visible = false;
            if (other.kind === 'explosive_barrel') {
              triggerBarrelExplosion(other.x, other.z);
            } else {
              spawnDebrisChunks(
                other.x,
                0.55,
                other.z,
                other.materialTag === 'wood' ? 'wood' : 'concrete',
                10,
              );
            }
          }
        }
      }
      for (let ci = worldCrates.length - 1; ci >= 0; ci--) {
        const c = worldCrates[ci];
        if (c.state !== 'grounded') continue;
        const splash = evaluateSplashDamageOnDroppedItem(c.x, c.z, bx, bz, 6.5, 32, c.hp);
        if (splash.hit) {
          c.hp = splash.nextHp;
          c.vx += splash.knockbackVx;
          c.vz += splash.knockbackVz;
          c.vy = Math.max(c.vy, 3.8);
          c.rotVelY += (Math.random() - 0.5) * 8.0;
          if (splash.destroyed) {
            scratchExplosionPos.set(c.x, getTerrainElevation(c.x, c.z) + 0.55, c.z);
            blitzExplosionSystem.spawnBlitzExplosion(scratchExplosionPos, 0.72, 'crate');
            spawnDebrisChunks(c.x, 0.55, c.z, c.kind === 'super' ? 'metal' : 'wood', 10);
            const crateDrop = evaluateCrateDestructionDrop(c.kind);
            if (crateDrop.dropKind === 'health' || crateDrop.isPurpleSuperWeapon) {
              spawnWorldPickup(crateDrop.dropKind, crateDrop.label, c.x, c.z, {
                weaponId: crateDrop.weaponId,
                remainingAmmo: crateDrop.remainingAmmo,
                vy: 6.4,
              });
            }
            rewardPlayerOnCrateDestroyed(c.x, c.z);
            scene.remove(c.mesh);
            worldCrates.splice(ci, 1);
          }
        }
      }

      // 1b. Splash Damage Vulnerability (`Hancur Terkena Serangan Area`): Crafted/dropped weapons on the ground explode if shelled!
      for (let pi = worldPickups.length - 1; pi >= 0; pi--) {
        const pk = worldPickups[pi];
        const splash = evaluateSplashDamageOnDroppedItem(pk.x, pk.z, bx, bz, 6.0, 28, pk.hp);
        if (splash.hit) {
          pk.hp = splash.nextHp;
          pk.vx += splash.knockbackVx;
          pk.vz += splash.knockbackVz;
          pk.vy = Math.max(pk.vy, 4.2);
          if (splash.destroyed) {
            scratchExplosionPos.set(pk.x, pk.y, pk.z);
            blitzExplosionSystem.spawnBlitzExplosion(scratchExplosionPos, 0.58, 'crate');
            spawnDebrisChunks(pk.x, pk.y, pk.z, 'metal', 7);
            spawnBurstParticles(pk.x, pk.y + 0.25, pk.z, 8);
            scene.remove(pk.mesh);
            worldPickups.splice(pi, 1);
          }
        }
      }

      // 2. Apply BUDDIES radial blast knockback + 1.5s StunEffect + directional HitReaction to characters & vehicles within 6.0m (damageRadius = 6)
      let playedStunSfx = false;
      for (const b of buddyUnits) {
        if (!b.alive || (b.isPlayer && (mountedTank || ridingTramCarIdx !== null))) continue;
        if (
          isPointInsideLobbySafezone(b.x, b.z) ||
          evaluatePublicPadShieldZone(b.x, b.z, b.team).isFriendlyShield
        ) {
          continue;
        }
        const d = getPlanetShortestDistance(b.x, b.z, bx, bz);
        if (d < 6.0) {
          const safeD = Math.max(0.1, d);
          const dx = getPlanetShortestDelta(b.x, bx) / safeD;
          const dz = getPlanetShortestDelta(b.z, bz) / safeD;
          const falloff = 1 - d / 6.0;
          const blastDmg = Math.max(4, Math.round(falloff * 24));
          if (b.isPlayer) {
            const iFrameRes = applyPlayerDamageWithInvincibilityAndKnockback({
              hp: b.hp,
              invincibilityTimer: b.invincibilityTimer ?? 0,
              x: b.x,
              z: b.z,
              vx: b.vx,
              vz: b.vz,
              vy: b.vy,
              damage: blastDmg,
              sourceX: bx,
              sourceZ: bz,
              facingYaw: b.yaw,
              invincibilityDurationSec: PLAYER_INVINCIBILITY_DURATION_SEC,
              knockbackSpeed: Math.max(9.5, falloff * 11.5),
            });
            if (!iFrameRes.damageApplied) {
              continue;
            }
            b.hp = iFrameRes.hp;
            b.invincibilityTimer = iFrameRes.invincibilityTimer;
            b.vx = iFrameRes.vx;
            b.vz = iFrameRes.vz;
            b.vy = iFrameRes.vy;
            b.jumpOffset = Math.max(b.jumpOffset, 0.08);
            b.isGrounded = false;
          } else {
            b.vx += dx * falloff * 11.5;
            b.vz += dz * falloff * 11.5;
            b.hp -= blastDmg;
          }
          b.hitFlashTimer = 0.15;
          b.hitReactionTimer = 0.60;
          b.hitReactionDirX = dx;
          b.hitReactionDirZ = dz;
          b.stunTimer = 1.5;
          if (!playedStunSfx) {
            playSpatialSoundAt(bx, bz, 22.0, 5.0, () => {
              soundEngine.playStunned();
            });
            playedStunSfx = true;
          }
          if (b.hp <= 0) {
            b.alive = false;
            b.respawnTimer = 6.0;
            b.root.visible = false;
            spawnBurstParticles(b.x, 1.4, b.z, 16);
            handleBuddyDeathDrops(b, true);
            if (b.team === 'red') {
              enemiesDefeated++;
              score += 150;
              gold += 150;
            } else if (b.isPlayer) {
              handlePlayerWarzoneDeath(b);
            }
            checkMatchDeathmatchWinCondition();
          }
        }
      }
      for (const v of tanks) {
        if (v.hp <= 0 || (v.altitude ?? 0) > 3.5) continue;
        const d = getPlanetShortestDistance(v.x, v.z, bx, bz);
        if (d < 6.0) {
          const safeD = Math.max(0.1, d);
          const dx = getPlanetShortestDelta(v.x, bx) / safeD;
          const dz = getPlanetShortestDelta(v.z, bz) / safeD;
          const falloff = 1 - d / 6.0;
          v.vx += dx * falloff * 7.5;
          v.vz += dz * falloff * 7.5;
          v.hitFlashTimer = 0.15;
          v.hitReactionTimer = 0.60;
          v.hitReactionDirX = dx;
          v.hitReactionDirZ = dz;
          v.stunTimer = 1.5;
          if (!playedStunSfx) {
            playSpatialSoundAt(bx, bz, 22.0, 5.0, () => {
              soundEngine.playStunned();
            });
            playedStunSfx = true;
          }
        }
      }
    };

    const getStaticWorldStructures = (): StaticWorldStructureObb[] => {
      const blueSkyshields = getBaseSkyshieldTurrets(blueBase.baseGroup);
      const redSkyshields = getBaseSkyshieldTurrets(redBase.baseGroup);
      let stateKey = `${cityArenaMode}|${blueBase.hqX},${blueBase.hqZ},${redBase.hqX},${redBase.hqZ}|`;
      for (let i = 0; i < 4; i++) {
        const bp = blueCommanderBases[i];
        const rp = redCommanderBases[i];
        stateKey += `${blueSkyshields[i]?.isBuilt ? 1 : 0}${redSkyshields[i]?.isBuilt ? 1 : 0}`;
        stateKey += bp
          ? `${bp.destroyed ? 1 : 0}:${bp.isClaimedOnlineSession ? 1 : 0}:${bp.buildingHp > 0 ? bp.buildingLevel : 0}:${bp.fenceHp > 0 ? bp.fenceLevel : 0}:${bp.hasParkingBay ? 1 : 0};`
          : '0;';
        stateKey += rp
          ? `${rp.destroyed ? 1 : 0}:${rp.isClaimedOnlineSession ? 1 : 0}:${rp.buildingHp > 0 ? rp.buildingLevel : 0}:${rp.fenceHp > 0 ? rp.fenceLevel : 0}:${rp.hasParkingBay ? 1 : 0};`
          : '0;';
      }
      if (cachedStaticWorldStructures && cachedStaticWorldStructuresKey === stateKey) {
        return cachedStaticWorldStructures;
      }

      const structures = buildStaticWorldStructuresList({
        blueBase,
        redBase,
        blueCommanderBases,
        redCommanderBases,
        isSafezoneMode: cityArenaMode === 'safezone',
      });
      cachedStaticWorldStructures = structures;
      cachedStaticWorldStructuresKey = stateKey;
      return structures;
    };

    // Build & cache 2D A* Navigation Grids for Foot Units (BuddyUnit) and Tracked Vehicles (TankVehicle)
    const getArenaNavGrid = (isTrackedTank: boolean): AStarNavGrid => {
      if (navGridDirty || !cachedFootNavGrid || !cachedVehicleNavGrid) {
        const { footGrid, vehicleGrid } = buildArenaNavGrids({
          staticStructures: getStaticWorldStructures(),
          trees,
          activeMapProps,
        });
        cachedFootNavGrid = footGrid;
        cachedVehicleNavGrid = vehicleGrid;
        navGridDirty = false;
      }
      return isTrackedTank ? cachedVehicleNavGrid! : cachedFootNavGrid!;
    };

    let aStarRepathsThisFrame = 0;

    // Compute A* waypoint steering velocity (vx, vz) for an AI character or AI tank
    const computeAStarSteeringDirection = (
      agent: Parameters<typeof computeUnitAStarSteeringDirection>[0],
      goalX: number,
      goalZ: number,
      dt: number,
      isTrackedTank: boolean,
      canFly = false,
    ): { dirX: number; dirZ: number; distToGoal: number } =>
      computeUnitAStarSteeringDirection(
        agent,
        goalX,
        goalZ,
        dt,
        isTrackedTank,
        canFly,
        getArenaNavGrid,
        () => aStarRepathsThisFrame < 2,
        () => {
          aStarRepathsThisFrame++;
        },
      );

    // =========================================================================
    // MUZZLE RAYCAST HIT DETECTION (100 UNITS, LAYER MASK SKIPPING SHOOTER & FRIENDLIES)
    // + SOFT HOLOGRAPHIC GLOW VFX TARGET LOCK-ON (ENEMY RED UNITS / VEHICLES / SKYSHIELDS ONLY)
    // =========================================================================
    const muzzleRaycastGroup = new THREE.Group();
    muzzleRaycastGroup.name = 'MuzzleRaycastAndTargetLockGroup';
    scene.add(muzzleRaycastGroup);

    // Soft-Glow Target Lock-On VFX Group — ONLY visible when the INVISIBLE raycast locks onto a hostile ('red') target!
    const targetLockGroup = new THREE.Group();
    targetLockGroup.name = 'TargetLockReticleGroup';
    targetLockGroup.visible = false;
    muzzleRaycastGroup.add(targetLockGroup);

    const lockGroundAuraMat = new THREE.MeshBasicMaterial({
      map: createGroundLockAuraTexture(),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const lockBaseRing = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), lockGroundAuraMat);
    lockBaseRing.rotation.x = -Math.PI / 2;
    lockBaseRing.position.y = 0.08;
    targetLockGroup.add(lockBaseRing);

    const lockHudReticleMat = new THREE.SpriteMaterial({
      map: createHudLockReticleTexture(),
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const lockHudReticleSprite = new THREE.Sprite(lockHudReticleMat);
    lockHudReticleSprite.position.set(0, 1.35, 0);
    lockHudReticleSprite.scale.set(2.2, 2.2, 1);
    targetLockGroup.add(lockHudReticleSprite);

    let activeMuzzleRaycastResult: MuzzleRaycastResult | null = null;
    let lastLockedColliderId: string | null = null;

    const getPlayerMuzzleAndAimDirection = () =>
      computePlayerMuzzleAndAimDirection(playerUnit, mountedTank, aimWorldPoint);

    const buildWorldRaycastColliders = (
      shooterId: string,
      rayOriginX: number,
      rayOriginZ: number,
      shooterTeam: 'blue' | 'red' = 'blue',
      aimDir?: Vec3,
    ): RaycastCollider3D[] =>
      buildArenaRaycastColliders({
        shooterId,
        shooterTeam,
        rayOriginX,
        rayOriginZ,
        aimDir,
        maxDistance: RAYCAST_MAX_DISTANCE,
        mountedTank,
        playerUnit,
        buddyUnits,
        tanks,
        redBase,
        blueBase,
        worldCrates,
        activeMapProps,
        trees,
        staticStructures: getStaticWorldStructures(),
      });

    const updateMuzzleRaycastAndTargetLock = (
      planetPivotX: number,
      planetPivotZ: number,
      kCurve: number,
      timeSec: number,
    ): MuzzleRaycastResult => {
      const { muzzleOrigin, aimDir, shooterId } = getPlayerMuzzleAndAimDirection();
      const colliders = buildWorldRaycastColliders(
        shooterId,
        muzzleOrigin.x,
        muzzleOrigin.z,
        'blue',
        aimDir,
      );

      // Perform invisible 100-unit raycast skipping shooter & friendly ('blue') units/vehicles/Skyshields
      const result = castMuzzleRaycast3D(muzzleOrigin, aimDir, colliders, {
        maxDistance: RAYCAST_MAX_DISTANCE,
        layerMask: RAYCAST_LAYERS.DEFAULT_MUZZLE_MASK,
        shooterId,
        shooterTeam: 'blue',
      });
      activeMuzzleRaycastResult = result;

      // Soft Holographic Target Lock-On VFX Aura & Optical HUD Reticle (ONLY on Enemy Red targets, 100% invisible raycast line!)
      if (result.isTargetLocked && result.lockCenter) {
        if (result.colliderId && result.colliderId !== lastLockedColliderId) {
          lastLockedColliderId = result.colliderId;
          soundEngine.playSkyshieldRadarLock();
        }
        targetLockGroup.visible = true;
        const lx = planetPivotX + getPlanetShortestDelta(result.lockCenter.x, planetPivotX);
        const lz = planetPivotZ + getPlanetShortestDelta(result.lockCenter.z, planetPivotZ);
        const lGroundY = getTerrainElevation(result.lockCenter.x, result.lockCenter.z);
        const lYOff = computePlanetYOffset(result.lockCenter.x, result.lockCenter.z, planetPivotX, planetPivotZ, kCurve);
        const baseLockY =
          result.targetKind === 'skyshield'
            ? lGroundY + 3.55
            : Math.max(lGroundY, result.lockCenter.y - 1.05);
        targetLockGroup.position.set(lx, baseLockY + lYOff, lz);

        const rScale = clamp(result.lockRadius, 1.05, 2.85);
        const lockPulse = 1.0 + Math.sin(timeSec * 9.0) * 0.06;
        lockBaseRing.scale.setScalar(rScale * lockPulse);
        lockBaseRing.rotation.z = timeSec * 1.6;
        lockGroundAuraMat.opacity = 0.72 + Math.sin(timeSec * 9.0) * 0.14;

        const hudScale = clamp(rScale * 1.18, 1.65, 3.1) * (1.0 + Math.cos(timeSec * 9.0) * 0.05);
        lockHudReticleSprite.position.y =
          result.targetKind === 'skyshield' ? 1.15 : 1.1;
        lockHudReticleSprite.scale.set(hudScale, hudScale, 1);
        lockHudReticleMat.rotation = -timeSec * 0.85;
        lockHudReticleMat.opacity = 0.84 + Math.sin(timeSec * 11.0) * 0.12;
      } else {
        lastLockedColliderId = null;
        targetLockGroup.visible = false;
      }

      return result;
    };

    // Place surface-normal impact effect at the closest raycast hit point (`result.point`, `result.normal`)
    const spawnRaycastSurfaceNormalImpact = (rayRes: MuzzleRaycastResult, isHeavy = false) => {
      if (!rayRes.hit) return;
      const hitPt = new THREE.Vector3(rayRes.point.x, rayRes.point.y, rayRes.point.z);
      const hitNorm = new THREE.Vector3(rayRes.normal.x, rayRes.normal.y, rayRes.normal.z);
      blitzExplosionSystem.spawnBlitzBulletHitBurst(hitPt, hitNorm, false);
      spawnCollisionContactParticles(
        rayRes.point.x,
        rayRes.point.y,
        rayRes.point.z,
        rayRes.normal.x,
        rayRes.normal.z,
        rayRes.targetKind === 'vehicle' || rayRes.targetKind === 'skyshield' ? 'metal' : 'concrete',
        isHeavy ? 11.5 : 8.0,
      );
    };

    // Unified 3D OBB + Multi-Sphere Compound Hull Physics Collision Resolver (Solid vs Pushable vs Breakable + Material Impact SFX)
    const resolveMoverWorldCollisions = (
      mover: {
        x: number;
        z: number;
        vx: number;
        vz: number;
        hullYaw?: number;
        altitude?: number;
        vehicleKind?: 'tank' | 'plane' | 'truck';
        team?: 'blue' | 'red';
        ownerCommanderId?: number;
        occupiedByAiId?: number | null;
      },
      moverKey: string,
      isVehicle: boolean,
      moverRadius: number,
      moverMass: number,
      timeSec: number,
      isPlayerControlled: boolean,
      moverAltitudeOverride?: number,
    ) => {
      const moverAltitude =
        moverAltitudeOverride !== undefined
          ? moverAltitudeOverride
          : isVehicle && 'altitude' in mover
            ? (mover.altitude ?? 0)
            : 0;
      const isAirbornePlane = isVehicle && mover.vehicleKind === 'plane' && moverAltitude > 1.25;
      const moverTeam: 'blue' | 'red' = mover.team ?? (isPlayerControlled ? 'blue' : 'red');
      let moverOwnerCommanderId =
        mover.ownerCommanderId !== undefined
          ? mover.ownerCommanderId
          : isPlayerControlled
            ? (playerUnit?.ownerCommanderId ?? 0)
            : -1;
      if (
        moverOwnerCommanderId === -1 &&
        isVehicle &&
        mover.occupiedByAiId !== undefined &&
        mover.occupiedByAiId !== null
      ) {
        const aiDriver = buddyUnits.find((u) => u.id === mover.occupiedByAiId);
        if (aiDriver) moverOwnerCommanderId = aiDriver.ownerCommanderId;
      }

      // 0. Shoreline & Outer Perimeter Hill Embankment ("Tanggul Bukit") Boundary:
      //    - Tracked Tanks (`vehicleKind === 'tank'`) and Airborne Planes can freely cross the Centered Oasis Lake!
      //    - Foot characters (`BuddyUnit`) and wheeled Dump Trucks (`vehicleKind === 'truck'`) remain blocked by the Oasis Lake shoreline.
      //    - All non-flying ground units & vehicles remain blocked from falling off the East Harbor Quay Wall into the deep sea.
      //    - ALL units and vehicles (including Tanks, Trucks, Planes & Characters) are 100% blocked by the Outer Perimeter Hill Embankment ("Tanggul Bukit").
      const isTrackedTank = isVehicle && mover.vehicleKind === 'tank';
      if (!isAirbornePlane) {
        const lakeSdf = evaluateNwLakeSdf(mover.x, mover.z);
        if (!isTrackedTank && lakeSdf < -0.1) {
          const dx = mover.x - -31.0;
          const dz = mover.z - 0.0;
          const len = Math.max(0.01, Math.hypot(dx, dz));
          const nx = dx / len;
          const nz = dz / len;
          const pushOut = -0.1 - lakeSdf;
          mover.x = wrapPlanetCoord(mover.x + nx * pushOut);
          mover.z = wrapPlanetCoord(mover.z + nz * pushOut);
          const vn = mover.vx * nx + mover.vz * nz;
          if (vn < 0) {
            mover.vx -= vn * nx;
            mover.vz -= vn * nz;
          }
        }
        const harborWaterSdf = evaluateSeHarborSdf(mover.x, mover.z).waterSdf;
        if (harborWaterSdf < -0.1) {
          const nx = -1.0;
          const nz = 0.0;
          const pushOut = -0.1 - harborWaterSdf;
          mover.x = wrapPlanetCoord(mover.x + nx * pushOut);
          mover.z = wrapPlanetCoord(mover.z + nz * pushOut);
          const vn = mover.vx * nx + mover.vz * nz;
          if (vn < 0) {
            mover.vx -= vn * nx;
            mover.vz -= vn * nz;
          }
        }

        // 0A-2. Public Crate Pad Safe Shield Barrier: Enemy units/vehicles cannot step inside an opposing team's Shielded Crate Pad!
        // Strictly active ONLY in Warzone mode (`cityArenaMode === 'warzone'`); disabled in Safezone (Kota Damai) mode.
        if (cityArenaMode === 'warzone') {
          const shieldBarrier = resolveEnemyPublicPadShieldBarrier2D(
            mover.x,
            mover.z,
            moverTeam,
            Math.max(0.65, moverRadius),
          );
          if (shieldBarrier.blocked) {
            mover.x = wrapPlanetCoord(shieldBarrier.x);
            mover.z = wrapPlanetCoord(shieldBarrier.z);
            const vn = mover.vx * shieldBarrier.normalX + mover.vz * shieldBarrier.normalZ;
            if (vn < 0) {
              mover.vx -= vn * shieldBarrier.normalX;
              mover.vz -= vn * shieldBarrier.normalZ;
            }
          }
        }
      }

      // 0B. 100% Impassable Outer Perimeter Hill Embankment ("Tanggul Bukit") at all altitudes:
      const embSdf = evaluateOuterEmbankmentSdf(mover.x, mover.z);
      const embLimit = -Math.max(0.65, moverRadius);
      if (embSdf > embLimit) {
        const eps = 0.5;
        const gx = evaluateOuterEmbankmentSdf(mover.x + eps, mover.z) - evaluateOuterEmbankmentSdf(mover.x - eps, mover.z);
        const gz = evaluateOuterEmbankmentSdf(mover.x, mover.z + eps) - evaluateOuterEmbankmentSdf(mover.x, mover.z - eps);
        const glen = Math.max(0.001, Math.hypot(gx, gz));
        const nx = -gx / glen;
        const nz = -gz / glen;
        const pushIn = embSdf - embLimit;
        mover.x = wrapPlanetCoord(mover.x + nx * pushIn);
        mover.z = wrapPlanetCoord(mover.z + nz * pushIn);
        const vn = mover.vx * nx + mover.vz * nz;
        if (vn < 0) {
          mover.vx -= vn * nx * 1.15;
          mover.vz -= vn * nz * 1.15;
        }
      }

      // Build Multi-Sphere Compound Hull for elongated vehicles so Rear Truck Cargo Beds (-3.66m),
      // Front Bumpers (+3.59m), Tank Hulls, and Plane Noses/Tails/Wings NEVER clip into walls or buildings!
      const yaw = mover.hullYaw ?? 0;
      const fwdX = Math.cos(yaw);
      const fwdZ = -Math.sin(yaw);
      const rightX = Math.sin(yaw);
      const rightZ = Math.cos(yaw);

      const hullSpheres: Array<{ ox: number; oz: number; r: number }> =
        isVehicle && mover.vehicleKind === 'truck'
          ? [
              { ox: 0, oz: 0, r: 1.82 },
              { ox: -fwdX * 1.90, oz: -fwdZ * 1.90, r: 1.82 },
              { ox: fwdX * 1.85, oz: fwdZ * 1.85, r: 1.82 },
            ]
          : isVehicle && mover.vehicleKind === 'tank'
            ? [
                { ox: 0, oz: 0, r: 1.68 },
                { ox: -fwdX * 0.85, oz: -fwdZ * 0.85, r: 1.68 },
                { ox: fwdX * 0.90, oz: fwdZ * 0.90, r: 1.68 },
              ]
            : isVehicle && mover.vehicleKind === 'plane'
              ? [
                  { ox: 0, oz: 0, r: 1.48 },
                  { ox: -fwdX * 1.12, oz: -fwdZ * 1.12, r: 1.38 },
                  { ox: fwdX * 1.08, oz: fwdZ * 1.08, r: 1.38 },
                  { ox: rightX * 1.25, oz: rightZ * 1.25, r: 1.25 },
                  { ox: -rightX * 1.25, oz: -rightZ * 1.25, r: 1.25 },
                ]
              : [{ ox: 0, oz: 0, r: moverRadius }];

      // 1. Solid Static 3D OBB Colliders: Retaining Walls, Base Buildings, Watchtower/Guardhouse/Bunker, 8 Bastions, 8 Container Stacks & Construction Yard Equipment
      const staticStructures = getStaticWorldStructures();
      for (const st of staticStructures) {
        if (moverAltitude >= st.heightY) continue;
        const maxReach = st.halfX + st.halfZ + 5.5;
        if (Math.abs(mover.x - st.x) > maxReach || Math.abs(mover.z - st.z) > maxReach) continue;
        const gateMatch = /^(blue|red)_plot_([0-3])_gate$/.exec(st.id);
        if (gateMatch) {
          const gateTeam = gateMatch[1] as 'blue' | 'red';
          const gatePlotIdx = Number(gateMatch[2]);
          const gatePlot = (gateTeam === 'blue' ? blueCommanderBases : redCommanderBases)[gatePlotIdx];
          if (
            canUnitEnterCommanderBaseGate(
              moverTeam,
              moverOwnerCommanderId,
              gateTeam,
              gatePlotIdx,
              nearSessionState,
              {
                isSafezoneMode: cityArenaMode === 'safezone',
                plot: gatePlot,
                unitWalletOrId: isPlayerControlled
                  ? nearSessionState.accountId ?? nearSessionState.walletId ?? 'commander-p1.near'
                  : `visitor-${moverKey}`,
                isPlotOwnerOverride:
                  cityArenaMode === 'safezone'
                    ? isPlayerControlled &&
                      nearSessionState.claimedTeam === gateTeam &&
                      nearSessionState.claimedPlotIndex === gatePlotIdx
                    : undefined,
              },
            )
          ) {
            continue;
          }
        }
        for (const hs of hullSpheres) {
          const sx = mover.x + hs.ox;
          const sz = mover.z + hs.oz;
          const res = resolveSolidObbCollision2D(
            sx,
            sz,
            mover.vx,
            mover.vz,
            hs.r,
            st.x,
            st.z,
            st.halfX,
            st.halfZ,
            st.rotY,
            0.28,
          );
          if (res.collided) {
            mover.x = wrapPlanetCoord(res.x - hs.ox);
            mover.z = wrapPlanetCoord(res.z - hs.oz);
            mover.vx = res.vx;
            mover.vz = res.vz;
            if (
              shouldPlayMoverCollisionSound(isVehicle, false, isPlayerControlled, res.impactSpeed, 0.85) &&
              tryTriggerCooldown(`${moverKey}_${st.id}`, timeSec, 0.11)
            ) {
              soundEngine.playMaterialImpact(st.mat, res.impactSpeed);
              spawnCollisionContactParticles(
                res.contactX,
                moverAltitude + 0.75,
                res.contactZ,
                res.normalX,
                res.normalZ,
                st.mat,
                res.impactSpeed,
              );
              shakeTrauma = Math.min(1, shakeTrauma + Math.min(0.34, res.impactSpeed * 0.024));
            }
          }
        }
      }

      // 2. Solid Static Colliders: Living Tree Trunks & Canopies (height = 9.2 * scale, with Tree Jiggle / Canopy Shake!)
      for (const tr of trees) {
        if (!tr.alive) continue;
        if (moverAltitude >= 9.2 * tr.scale) continue;
        if (Math.abs(mover.x - tr.x) > 7.5 || Math.abs(mover.z - tr.z) > 7.5) continue;
        const treeRadius = moverAltitude > 2.6 ? 1.65 * tr.scale : 0.98 * tr.scale;
        for (const hs of hullSpheres) {
          const sx = mover.x + hs.ox;
          const sz = mover.z + hs.oz;
          const res = resolveSolidCollision2D(
            sx,
            sz,
            mover.vx,
            mover.vz,
            hs.r,
            tr.x,
            tr.z,
            treeRadius,
            0.28,
          );
          if (res.collided) {
            mover.x = wrapPlanetCoord(res.x - hs.ox);
            mover.z = wrapPlanetCoord(res.z - hs.oz);
            mover.vx = res.vx;
            mover.vz = res.vz;

            if (isVehicle && res.impactSpeed > 0.75) {
              tr.jiggleTimer = 0.55;
              tr.jiggleIntensity = Math.min(0.28, 0.06 + res.impactSpeed * 0.018);
              tr.jiggleDirX = -res.normalX;
              tr.jiggleDirZ = -res.normalZ;
            }

            if (
              shouldPlayMoverCollisionSound(isVehicle, false, isPlayerControlled, res.impactSpeed, 0.8) &&
              tryTriggerCooldown(`${moverKey}_tree_${tr.id}`, timeSec, 0.11)
            ) {
              soundEngine.playHeavyThud(res.impactSpeed, true);
              spawnCollisionContactParticles(
                res.contactX,
                moverAltitude + 0.75,
                res.contactZ,
                res.normalX,
                res.normalZ,
                'wood',
                res.impactSpeed,
              );
              shakeTrauma = Math.min(1, shakeTrauma + Math.min(0.32, res.impactSpeed * 0.022));
            }
          }
        }
      }

      // 3. Map Props: Solid Static vs Pushable vs Breakable (checked against 3D prop height mp.heightY!)
      for (const mp of activeMapProps) {
        if (
          !mp.alive ||
          !mp.wrapper.visible ||
          (mp.kind === 'explosive_barrel' && cityArenaMode === 'safezone')
        ) {
          continue;
        }
        if (moverAltitude >= mp.heightY) continue;
        const propReach = Math.max(mp.radius, (mp.halfX ?? 0) + (mp.halfZ ?? 0)) + 5.5;
        if (Math.abs(mover.x - mp.x) > propReach || Math.abs(mover.z - mp.z) > propReach) continue;

        if (mp.category === 'solid') {
          // Tracked tanks can climb over low rocks and stacked pipes as long as they are not too tall (height <= 1.68m)
          if (isTrackedTank && isTankClimbableProp(mp.kind, mp.scale)) {
            continue;
          }
          for (const hs of hullSpheres) {
            const sx = mover.x + hs.ox;
            const sz = mover.z + hs.oz;
            const res =
              mp.halfX !== undefined && mp.halfZ !== undefined
                ? resolveSolidObbCollision2D(
                    sx,
                    sz,
                    mover.vx,
                    mover.vz,
                    hs.r,
                    mp.x,
                    mp.z,
                    mp.halfX,
                    mp.halfZ,
                    mp.rotY,
                    mp.restitution,
                  )
                : resolveSolidCollision2D(
                    sx,
                    sz,
                    mover.vx,
                    mover.vz,
                    hs.r,
                    mp.x,
                    mp.z,
                    mp.radius,
                    mp.restitution,
                  );
            if (res.collided) {
              mover.x = wrapPlanetCoord(res.x - hs.ox);
              mover.z = wrapPlanetCoord(res.z - hs.oz);
              mover.vx = res.vx;
              mover.vz = res.vz;
              if (isVehicle && res.impactSpeed > 0.8 && mp.canJiggleOnHit) {
                mp.jiggleTimer = 0.28;
              }
              // Level-1 Destructible Solid Wall (concrete_fence): immovable by characters or trucks,
              // but repeated ramming by a Tank or Airplane chips away HP (22 dmg per impact, 60 HP total) until it shatters!
              const isTankOrPlane =
                isVehicle &&
                'vehicleKind' in mover &&
                (mover.vehicleKind === 'tank' || mover.vehicleKind === 'plane');
              if (
                mp.destructible &&
                isTankOrPlane &&
                res.impactSpeed > 2.2 &&
                tryTriggerCooldown(`${moverKey}_ram_${mp.id}`, timeSec, 0.32)
              ) {
                mp.hp -= 22;
                if (mp.canJiggleOnHit) {
                  mp.jiggleTimer = 0.35;
                }
                if (mp.hp <= 0) {
                  mp.alive = false;
                  mp.wrapper.visible = false;
                  navGridDirty = true;
                  score += 50;
                  playSpatialSoundAt(mp.x, mp.z, 22.0, 5.0, () => {
                    soundEngine.playHeavyThud(res.impactSpeed, false);
                  });
                  spawnDebrisChunks(mp.x, 0.75, mp.z, 'concrete', 14, mover.vx * 0.3, mover.vz * 0.3);
                  spawnBurstParticles(mp.x, 0.95, mp.z, 12);
                  if (isPlayerControlled) {
                    shakeTrauma = Math.min(1, shakeTrauma + 0.28);
                  }
                  break;
                }
              }
              if (
                shouldPlayMoverCollisionSound(isVehicle, false, isPlayerControlled, res.impactSpeed, 0.8) &&
                tryTriggerCooldown(`${moverKey}_prop_${mp.id}`, timeSec, 0.10)
              ) {
                soundEngine.playMaterialImpact(mp.materialTag, res.impactSpeed);
                spawnCollisionContactParticles(
                  res.contactX,
                  moverAltitude + 0.75,
                  res.contactZ,
                  res.normalX,
                  res.normalZ,
                  mp.materialTag,
                  res.impactSpeed,
                );
                shakeTrauma = Math.min(1, shakeTrauma + Math.min(0.35, res.impactSpeed * 0.024));
              }
            }
          }
        } else {
          // Pushable (wheelbarrow, traffic_cone, recycle_bin) or Breakable (barricade, explosive_barrel)
          for (const hs of hullSpheres) {
            if (!mp.alive) break;
            const sx = mover.x + hs.ox;
            const sz = mover.z + hs.oz;
            const relSpeed = Math.hypot(mover.vx - mp.vx, mover.vz - mp.vz);
            const dist = getPlanetShortestDistance(sx, sz, mp.x, mp.z);
            const minDist = hs.r + mp.radius;

            if (
              mp.category === 'breakable' &&
              dist < minDist &&
              shouldShatterBreakableProp(mp.kind, relSpeed, isVehicle, mp.hp)
            ) {
              mp.alive = false;
              mp.wrapper.visible = false;
              score += 45;
              mover.vx *= 0.84;
              mover.vz *= 0.84;
              if (mp.kind === 'explosive_barrel') {
                triggerBarrelExplosion(mp.x, mp.z);
              } else if (mp.materialTag === 'wood') {
                playSpatialSoundAt(mp.x, mp.z, 20.0, 4.5, () => {
                  soundEngine.playWoodBreak(relSpeed);
                });
                spawnDebrisChunks(mp.x, 0.55, mp.z, 'wood', 12, mover.vx * 0.35, mover.vz * 0.35);
                spawnBurstParticles(mp.x, 0.8, mp.z, 10);
                if (isPlayerControlled) {
                  shakeTrauma = Math.min(1, shakeTrauma + 0.26);
                }
              } else {
                playSpatialSoundAt(mp.x, mp.z, 20.0, 4.5, () => {
                  soundEngine.playHeavyThud(relSpeed, false);
                });
                spawnDebrisChunks(mp.x, 0.55, mp.z, 'concrete', 12, mover.vx * 0.35, mover.vz * 0.35);
                spawnBurstParticles(mp.x, 0.8, mp.z, 10);
                if (isPlayerControlled) {
                  shakeTrauma = Math.min(1, shakeTrauma + 0.28);
                }
              }
              break;
            }

            const pushRes = computePushableImpulse2D(
              sx,
              sz,
              mover.vx,
              mover.vz,
              hs.r,
              moverMass,
              mp.x,
              mp.z,
              mp.vx,
              mp.vz,
              mp.radius,
              mp.mass,
              mp.restitution,
            );
            if (pushRes.collided) {
              mover.x = wrapPlanetCoord(pushRes.moverX - hs.ox);
              mover.z = wrapPlanetCoord(pushRes.moverZ - hs.oz);
              mover.vx = pushRes.moverVx;
              mover.vz = pushRes.moverVz;

              mp.x = wrapPlanetCoord(pushRes.propX);
              mp.z = wrapPlanetCoord(pushRes.propZ);
              mp.vx = pushRes.propVx;
              mp.vz = pushRes.propVz;
              mp.rotVelY = clamp(mp.rotVelY + pushRes.angularImpulse, -14, 14);
              if (mp.canJiggleOnHit) {
                mp.jiggleTimer = 0.35;
              }
              mp.wrapper.userData.worldX = mp.x;
              mp.wrapper.userData.worldZ = mp.z;

              if (
                shouldPlayMoverCollisionSound(isVehicle, true, isPlayerControlled, pushRes.impactSpeed, 0.65) &&
                tryTriggerCooldown(`${moverKey}_push_${mp.id}`, timeSec, isVehicle ? 0.12 : 0.24)
              ) {
                soundEngine.playMaterialImpact(mp.materialTag, pushRes.impactSpeed);
                if (isVehicle) {
                  spawnCollisionContactParticles(
                    mp.x,
                    0.65,
                    mp.z,
                    sx - mp.x,
                    sz - mp.z,
                    mp.materialTag,
                    pushRes.impactSpeed,
                  );
                  shakeTrauma = Math.min(1, shakeTrauma + Math.min(0.18, pushRes.impactSpeed * 0.015));
                }
              }
            }
          }
        }
      }

      // 3B. Solid Vehicle-vs-Vehicle & Character-vs-Vehicle OBB Collisions (vehicles never pass through each other or characters!)
      for (const veh of tanks) {
        if (veh.hp <= 0 || !veh.root.visible || cityArenaMode === 'safezone' || veh === mover) continue;
        if (!isVehicle && mountedTank === veh) continue;
        const vehAlt = veh.vehicleKind === 'plane' ? (veh.altitude ?? 0) : 0;
        if (Math.abs(moverAltitude - vehAlt) > 2.4) continue;

        const vehHalfX =
          veh.vehicleKind === 'truck' ? 3.66 : veh.vehicleKind === 'tank' ? 2.48 : 2.52;
        const vehHalfZ =
          veh.vehicleKind === 'truck' ? 1.76 : veh.vehicleKind === 'tank' ? 1.66 : 2.48;
        const vehRotY = -(veh.hullYaw ?? 0);

        for (const hs of hullSpheres) {
          const sx = mover.x + hs.ox;
          const sz = mover.z + hs.oz;
          const res = resolveSolidObbCollision2D(
            sx,
            sz,
            mover.vx,
            mover.vz,
            hs.r,
            veh.x,
            veh.z,
            vehHalfX,
            vehHalfZ,
            vehRotY,
            0.24,
          );
          if (res.collided) {
            mover.x = wrapPlanetCoord(res.x - hs.ox);
            mover.z = wrapPlanetCoord(res.z - hs.oz);
            mover.vx = res.vx;
            mover.vz = res.vz;

            // When the character on foot is carrying a crate above their head and walks directly up to a Dump Truck,
            // load that single crate (1-by-1) into the Dump Truck's cargo vessel!
            if (
              !isVehicle &&
              'carryingCrate' in mover &&
              (mover as BuddyUnit).carryingCrate !== 'none' &&
              veh.vehicleKind === 'truck' &&
              canLoadCrateIntoDumpTruck(veh.storedCrates.length, (veh.dumpAnimTimer ?? 0) > 0, true)
            ) {
              const carrier = mover as BuddyUnit;
              const loadedKind = carrier.carryingCrate as 'red' | 'super';
              carrier.carryingCrate = 'none';
              carrier.overheadCrateGroup.visible = false;
              veh.storedCrates.push(loadedKind);
              syncBlitzDumpTruckCargoVisuals(veh.bodyGroup, veh.storedCrates);
              spawnBurstParticles(veh.x, 1.85, veh.z, 10);
              if (carrier.isPlayer) {
                soundEngine.playPickup();
              } else {
                playSpatialSoundAt(veh.x, veh.z, 14.0, 3.5, () => {
                  soundEngine.playPickup();
                });
              }
              break;
            }

            if (isVehicle) {
              veh.vx = clamp(veh.vx - res.normalX * res.impactSpeed * 0.25, -18, 18);
              veh.vz = clamp(veh.vz - res.normalZ * res.impactSpeed * 0.25, -18, 18);
            }

            if (
              shouldPlayMoverCollisionSound(isVehicle, false, isPlayerControlled, res.impactSpeed, 0.85) &&
              tryTriggerCooldown(`${moverKey}_veh_${veh.id}`, timeSec, 0.12)
            ) {
              soundEngine.playMaterialImpact('metal', res.impactSpeed);
              spawnCollisionContactParticles(
                res.contactX,
                moverAltitude + 0.95,
                res.contactZ,
                res.normalX,
                res.normalZ,
                'metal',
                res.impactSpeed,
              );
              shakeTrauma = Math.min(1, shakeTrauma + Math.min(0.32, res.impactSpeed * 0.022));
            }
          }
        }
      }

      // 3C. Solid 2-Car City Tram OBB Collision (both Car 1 and Car 2 act as solid moving streetcars on the road!)
      if (moverAltitude < 2.6) {
        const tramState = cityTram.getState();
        const tramHalfX = CITY_TRAM_SPEC.carLength * 0.5;
        const tramHalfZ = CITY_TRAM_SPEC.carWidth * 0.5;
        const tramCars = [tramState.car1, tramState.car2];
        for (let tci = 0; tci < tramCars.length; tci++) {
          const car = tramCars[tci];
          const carVx = car.forwardX * CITY_TRAM_SPEC.cruiseSpeed;
          const carVz = car.forwardZ * CITY_TRAM_SPEC.cruiseSpeed;
          for (const hs of hullSpheres) {
            const sx = mover.x + hs.ox;
            const sz = mover.z + hs.oz;
            const res = resolveSolidObbCollision2D(
              sx,
              sz,
              mover.vx - carVx,
              mover.vz - carVz,
              hs.r,
              car.x,
              car.z,
              tramHalfX,
              tramHalfZ,
              car.yaw,
              0.28,
            );
            if (res.collided) {
              mover.x = wrapPlanetCoord(res.x - hs.ox);
              mover.z = wrapPlanetCoord(res.z - hs.oz);
              mover.vx = res.vx + carVx * 0.65;
              mover.vz = res.vz + carVz * 0.65;
              if (
                shouldPlayMoverCollisionSound(isVehicle, false, isPlayerControlled, res.impactSpeed, 0.8) &&
                tryTriggerCooldown(`${moverKey}_tram_${tci}`, timeSec, 0.14)
              ) {
                soundEngine.playMaterialImpact('metal', res.impactSpeed);
                spawnCollisionContactParticles(
                  res.contactX,
                  moverAltitude + 0.95,
                  res.contactZ,
                  res.normalX,
                  res.normalZ,
                  'metal',
                  res.impactSpeed,
                );
                shakeTrauma = Math.min(1, shakeTrauma + Math.min(0.28, res.impactSpeed * 0.02));
              }
            }
          }
        }
      }

      // 4. Grounded Crates (Pushable when bumped by running character, Dump Truck, or full tank; Breakable if rammed hard!)
      for (let i = worldCrates.length - 1; i >= 0; i--) {
        const c = worldCrates[i];
        if (c.state !== 'grounded' || !c.mesh.visible || cityArenaMode === 'safezone') continue;
        // Note: only non-truck vehicles (Tank / Plane) with < 4 stored crates auto-scoop on run-over;
        // Dump Trucks never auto-scoop crates from the ground!
        if (
          isVehicle &&
          mountedTank &&
          mountedTank.vehicleKind !== 'truck' &&
          mountedTank.storedCrates.length < 4 &&
          Math.hypot(mover.vx, mover.vz) < 12.8
        ) {
          continue;
        }
        const relSpd = Math.hypot(mover.vx - c.vx, mover.vz - c.vz);
        const dist = getPlanetShortestDistance(mover.x, mover.z, c.x, c.z);
        const crateRadius = 0.78;
        if (isVehicle && dist < moverRadius + crateRadius && relSpd >= 11.2 && canDamageWorldCrate(c)) {
          // High-speed tank ram shatters wooden/metal crate with Blitz Explosion VFX + 3D debris + drops bonus pickup!
          playSpatialSoundAt(c.x, c.z, 22.0, 5.0, () => {
            soundEngine.playWoodBreak(relSpd);
            soundEngine.playBarrelExplosion();
          });
          blitzExplosionSystem.spawnBlitzExplosion(
            new THREE.Vector3(c.x, getTerrainElevation(c.x, c.z) + 0.55, c.z),
            0.78,
            'crate',
          );
          spawnDebrisChunks(c.x, 0.55, c.z, c.kind === 'super' ? 'metal' : 'wood', 11, mover.vx * 0.3, mover.vz * 0.3);
          spawnBurstParticles(c.x, 0.8, c.z, 10);
          spawnWorldPickup('ammo', 'Ammo +50', c.x, c.z);
          scene.remove(c.mesh);
          worldCrates.splice(i, 1);
          if (isPlayerControlled) {
            shakeTrauma = Math.min(1, shakeTrauma + 0.28);
          }
          continue;
        }

        const crateHalfExtent = 0.68;
        for (const hs of hullSpheres) {
          const sx = mover.x + hs.ox;
          const sz = mover.z + hs.oz;
          const pushRes = resolveSolidCratePush2D(
            sx,
            sz,
            mover.vx,
            mover.vz,
            hs.r,
            moverMass,
            c.x,
            c.z,
            c.vx,
            c.vz,
            c.rotY,
            crateHalfExtent,
            1.85,
            0.22,
          );
          if (pushRes.collided) {
            mover.x = wrapPlanetCoord(pushRes.moverX - hs.ox);
            mover.z = wrapPlanetCoord(pushRes.moverZ - hs.oz);
            mover.vx = pushRes.moverVx;
            mover.vz = pushRes.moverVz;

            c.x = wrapPlanetCoord(pushRes.crateX);
            c.z = wrapPlanetCoord(pushRes.crateZ);
            c.vx = pushRes.crateVx;
            c.vz = pushRes.crateVz;
            c.rotVelY = clamp(c.rotVelY + pushRes.angularImpulse, -5.0, 5.0);
            c.squashTimer = 0;
            c.mesh.scale.set(1, 1, 1);

            if (
              shouldPlayMoverCollisionSound(isVehicle, true, isPlayerControlled, pushRes.impactSpeed, 0.7) &&
              tryTriggerCooldown(`${moverKey}_crate_${c.id}`, timeSec, isVehicle ? 0.12 : 0.24)
            ) {
              if (c.kind === 'super') {
                soundEngine.playMetalImpact(pushRes.impactSpeed);
              } else {
                soundEngine.playWoodHit(pushRes.impactSpeed);
              }
            }
          }
        }
      }
    };

    resetArenaRef.current = () => {
      spawnInitialSquadsAndObjects();
      runElapsedSec = 0;
    };

    let rafId = 0;
    let prevTime = performance.now();
    let frameTickCount = 0;
    const reusableGrassTramplers: { x: number; z: number; radius: number; weight: number }[] = [];
    const reusableGrassExclusions: {
      x: number;
      z: number;
      yaw: number;
      halfLen: number;
      halfWidth: number;
    }[] = [
      // Intact Bottom-Left Model Estate Skyshield bastion at (-51.4, 60.0) + Widened East Tram Shelter Platform at (-61.67, 0.0) + 4 Public Warzone Crate Pads exclude grass
      { x: -51.4, z: 60.0, yaw: 0, halfLen: 2.15, halfWidth: 2.15 },
      { x: -61.67, z: 0.0, yaw: 0, halfLen: 3.6, halfWidth: 9.6 },
      ...PUBLIC_WARZONE_CRATE_PADS.map((p) => ({
        x: p.worldX,
        z: p.worldZ,
        yaw: 0,
        halfLen: 2.15,
        halfWidth: 2.15,
      })),
    ];
    const filteredGrassExclusions: {
      x: number;
      z: number;
      yaw: number;
      halfLen: number;
      halfWidth: number;
    }[] = [];
    const scratchRearVentPos = new THREE.Vector3();
    const scratchNegDir = new THREE.Vector3();
    const scratchRocketLookAhead = new THREE.Vector3();
    const scratchSmokePos = new THREE.Vector3();
    const scratchLaserStartPos = new THREE.Vector3();
    const scratchLaserEndPos = new THREE.Vector3();
    const scratchLaserDelta = new THREE.Vector3();
    const scratchLaserMid = new THREE.Vector3();
    const scratchLaserDir = new THREE.Vector3();
    const scratchLaserHitNorm = new THREE.Vector3();

    const initialSearchParams =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const isFullMapOverview = initialSearchParams?.get('fullmap') === '1';
    const planeViewMode = initialSearchParams?.get('planeview') ?? null;
    const skyshieldViewMode = initialSearchParams?.get('skyshieldview') ?? null;
    const buildingViewMode = initialSearchParams?.get('buildingview') ?? null;

    const cachedLobbyPortalsObj = scene.getObjectByName('LobbyGapuraPortalsGroup3D');
    const cachedLobbyNearTermObj = scene.getObjectByName('LobbyNearGamepassTerminal3D');
    const cachedLobbyGoldExchObj = scene.getObjectByName('LobbyGoldExchangeBooth3D');
    const cachedHalteReturnPadsObj = scene.getObjectByName('HalteLobbyReturnPadsGroup3D');

    const getCachedVehicleContactShadow = (v: TankVehicle): THREE.Object3D | null => {
      if (v.root.userData.__contactShadowDisc === undefined) {
        v.root.userData.__contactShadowDisc = v.root.getObjectByName('ContactShadowDisc') ?? null;
      }
      return v.root.userData.__contactShadowDisc as THREE.Object3D | null;
    };

    let softwareGlTimerId = 0;
    const afterDraw = (cb: () => void) => {
      const glCtx = renderer.getContext() as WebGL2RenderingContext;
      const sync = glCtx.fenceSync ? glCtx.fenceSync(glCtx.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      glCtx.flush();
      const poll = () => {
        if (isDisposed) {
          if (sync) glCtx.deleteSync(sync);
          return;
        }
        const state = sync && glCtx.getSyncParameter(sync, glCtx.SYNC_STATUS);
        if (state === glCtx.UNSIGNALED) {
          softwareGlTimerId = window.setTimeout(poll, 5);
        } else {
          if (sync) glCtx.deleteSync(sync);
          softwareGlTimerId = window.setTimeout(cb, 80);
        }
      };
      softwareGlTimerId = window.setTimeout(poll, 5);
    };

    const animate = (now: number) => {
      if (isDisposed) return;
      frameTickCount++;
      aStarRepathsThisFrame = 0;
      const rawDt = (now - prevTime) / 1000;
      prevTime = now;
      const dt = Math.min(rawDt, 0.05);
      const timeSec = now * 0.001;

      const state = gameStateRef.current;
      const currentPlayMode = playModeRef.current;

      // 1. Decompiled Blitz InfiniteGrass & TreeLeaves Wind Shader Uniforms
      windUniforms.uTime.value = timeSec;
      windUniforms.uWindPhase.value = timeSec * 4.8;
      windUniforms.uWindGust.value = 0.25 + 0.25 * Math.sin(timeSec * 1.7);
      const activeFocusUnit = mountedTank ? mountedTank : playerUnit;
      const nukePrePose =
        nukeStrikeState.phase !== 'idle'
          ? computeNuclearStrikeCameraPose(nukeStrikeState)
          : null;
      const viewCenterX =
        npcCameraMode === 'npc_merchant'
          ? npcCameraLocation === 'beach_house'
            ? 85.8
            : -94.0
          : nukePrePose
          ? nukePrePose.focusPivotPos.x
          : currentPlayMode === 'editor'
          ? editorPan.x
          : activeFocusUnit
          ? activeFocusUnit.x
          : 0;
      const viewCenterZ =
        npcCameraMode === 'npc_merchant'
          ? npcCameraLocation === 'beach_house'
            ? 60.0
            : -13.8
          : nukePrePose
          ? nukePrePose.focusPivotPos.z
          : currentPlayMode === 'editor'
          ? editorPan.z
          : activeFocusUnit
          ? activeFocusUnit.z
          : 0;
      blitzGrassSystem.update(
        nukePrePose ? nukePrePose.focusPivotPos.x : activeFocusUnit ? activeFocusUnit.x : 0,
        nukePrePose ? nukePrePose.focusPivotPos.z : activeFocusUnit ? activeFocusUnit.z : 0,
        viewCenterX,
        viewCenterZ,
      );
      blitzGrassSystem.decayBlastWave(dt);

      // Multi-Unit Grass Trampling (Vehicles + Characters):
      // Only upload tramplers within the 25m grass view radius to minimize CPU-to-GPU uniform & shader loop cost!
      reusableGrassTramplers.length = 0;
      const GRASS_TRAMPLER_MAX_DIST = 25.0;
      for (let i = 0; i < tanks.length; i++) {
        const v = tanks[i];
        if (v.hp <= 0 || (v.altitude ?? 0) > 2.2) continue;
        if (
          Math.abs(getPlanetShortestDelta(v.x, viewCenterX)) > GRASS_TRAMPLER_MAX_DIST ||
          Math.abs(getPlanetShortestDelta(v.z, viewCenterZ)) > GRASS_TRAMPLER_MAX_DIST
        ) {
          continue;
        }
        reusableGrassTramplers.push({
          x: v.x,
          z: v.z,
          radius: v.vehicleKind === 'truck' ? 2.45 : 2.25,
          weight: 1.0,
        });
      }
      for (let i = 0; i < buddyUnits.length; i++) {
        const b = buddyUnits[i];
        if (!b.alive || b.jumpOffset > 1.0) continue;
        if (b.isPlayer && mountedTank) continue;
        if (!b.isPlayer && tanks.some((t) => t.occupiedByAiId === b.id)) continue;
        if (
          Math.abs(getPlanetShortestDelta(b.x, viewCenterX)) > GRASS_TRAMPLER_MAX_DIST ||
          Math.abs(getPlanetShortestDelta(b.z, viewCenterZ)) > GRASS_TRAMPLER_MAX_DIST
        ) {
          continue;
        }
        reusableGrassTramplers.push({
          x: b.x,
          z: b.z,
          radius: 1.05,
          weight: 0.92,
        });
      }
      blitzGrassSystem.setTramplers(reusableGrassTramplers);

      reusableGrassExclusions.length = 0;
      // Intact Bottom-Left Model Estate Skyshield bastion at (-51.4, 60.0) + Widened East Tram Shelter Platform at (-61.67, 0.0)
      reusableGrassExclusions.push({ x: -51.4, z: 60.0, yaw: 0, halfLen: 2.15, halfWidth: 2.15 });
      reusableGrassExclusions.push({ x: -61.67, z: 0.0, yaw: 0, halfLen: 3.6, halfWidth: 9.6 });
      // Public Warzone Crate Pads exclude grass ONLY in Warzone mode (disabled in Safezone / Kota Damai mode)
      if (cityArenaMode === 'warzone') {
        for (let pi = 0; pi < PUBLIC_WARZONE_CRATE_PADS.length; pi++) {
          const p = PUBLIC_WARZONE_CRATE_PADS[pi];
          reusableGrassExclusions.push({
            x: p.worldX,
            z: p.worldZ,
            yaw: 0,
            halfLen: 2.15,
            halfWidth: 2.15,
          });
        }
      }
      const plotOffsetsX = [-45.0, -15.0, 15.0, 45.0] as const;
      const bastionOffsetsLocalZ = [-51.4, -21.4, 8.6, 38.6] as const;
      const pushActivePlotsGrassExclusions = (
        plots: ReadonlyArray<IndividualCommanderBaseState>,
        baseHqX: number,
        baseHqZ: number,
        sign: 1 | -1,
      ) => {
        for (let pIdx = 0; pIdx < plots.length; pIdx++) {
          const plot = plots[pIdx];
          if (!isCommanderBasePlotActive(plot)) continue;
          const pwx = baseHqX + sign * plotOffsetsX[pIdx];
          // Exclude grass across the entire 20.4m x 42.4m claimed Base Plot interior + front gate driveway apron
          reusableGrassExclusions.push({
            x: pwx,
            z: baseHqZ - sign * 7.7,
            yaw: 0,
            halfLen: 10.2,
            halfWidth: 21.2,
          });
          // Exclude grass underneath the plot's front-yard Skyshield bastion
          reusableGrassExclusions.push({
            x: baseHqX + sign * bastionOffsetsLocalZ[pIdx],
            z: baseHqZ - sign * 26.0,
            yaw: 0,
            halfLen: 2.2,
            halfWidth: 2.2,
          });
        }
      };
      pushActivePlotsGrassExclusions(blueCommanderBases, blueBase.hqX, blueBase.hqZ, 1);
      pushActivePlotsGrassExclusions(redCommanderBases, redBase.hqX, redBase.hqZ, -1);
      for (let i = 0; i < activeMapProps.length; i++) {
        const mp = activeMapProps[i];
        if (!mp.alive || (mp.kind !== 'bench' && mp.kind !== 'recycle_bin')) continue;
        reusableGrassExclusions.push({
          x: mp.x,
          z: mp.z,
          yaw: mp.rotY,
          halfLen: mp.kind === 'bench' ? 1.55 : 1.15,
          halfWidth: mp.kind === 'bench' ? 2.25 : 1.15,
        });
      }
      for (let i = 0; i < worldCrates.length; i++) {
        const c = worldCrates[i];
        if (c.state !== 'grounded') continue;
        reusableGrassExclusions.push({
          x: c.x,
          z: c.z,
          yaw: c.rotY,
          halfLen: 0.92,
          halfWidth: 0.92,
        });
      }
      // Filter exclusion boxes to those overlapping the 26m grass streaming window around viewCenter
      filteredGrassExclusions.length = 0;
      for (let i = 0; i < reusableGrassExclusions.length; i++) {
        const ex = reusableGrassExclusions[i];
        const reach = 26.0 + Math.max(ex.halfLen, ex.halfWidth);
        if (
          Math.abs(getPlanetShortestDelta(ex.x, viewCenterX)) <= reach &&
          Math.abs(getPlanetShortestDelta(ex.z, viewCenterZ)) <= reach
        ) {
          filteredGrassExclusions.push(ex);
        }
      }
      blitzGrassSystem.setDynamicExclusions(filteredGrassExclusions);

      // 2. Raycast Mouse Crosshair onto Ground Plane (using active camera world matrix)
      camera.updateMatrixWorld();
      raycaster.setFromCamera(mouseNdc, camera);
      raycaster.ray.intersectPlane(groundPlane, aimWorldPoint);

      editorCursorGroup.visible = false;

      // Pulse the [Q] Ghost Wireframe opacity gently
      const ghostMat = blueBase.ghostPatternBox.material as THREE.MeshBasicMaterial;
      ghostMat.opacity = 0.65 + Math.sin(timeSec * 4.0) * 0.22;

      // 3. Gameplay Simulation Step
      let activeSpeed = 0;
      const isBoosting = Boolean(keys['ShiftLeft'] || keys['ShiftRight']);

      if (state !== 'playing' || currentPlayMode === 'editor') {
        soundEngine.updateVehicleMovementLoop(0, false, false);
      }

      if (state === 'playing') {
        runElapsedSec += dt;

        // Movement Input (WASD synchronized with Active Camera POV — True Mirror for Red Team!)
        // Ghost Movement Fix: if any input/textarea (e.g. TALK input) or Kiosk modal is active, clear stuck keys & zero velocity!
        const activeDomEl = document.activeElement as HTMLElement | null;
        const isTextInputFocused = Boolean(
          activeDomEl &&
            (activeDomEl.tagName === 'INPUT' ||
              activeDomEl.tagName === 'TEXTAREA' ||
              activeDomEl.isContentEditable),
        );
        const inLobbyNowForInput = worldModeRef.current === 'lobby';
        const isEditorOrPeacefulCamera =
          currentPlayMode === 'editor' || inLobbyNowForInput || cityArenaMode === 'safezone';
        const ghostGuard = evaluatePlayerGhostMovementGuard({
          keysPressed: keys,
          isWindowBlurred: false,
          isTalkInputFocused: isTextInputFocused,
          isFloatingButtonOrModalOpen: false,
          moveSpeed: 1,
          playerTeam: playerUnit?.team ?? 'blue',
          isEditorOrPeacefulCamera,
        });
        if (ghostGuard.shouldClearKeys) {
          isPointerDown = false;
        }
        let moveX = ghostGuard.vx;
        let moveZ = ghostGuard.vz;

        if (socialTalkTimer > 0) {
          socialTalkTimer = Math.max(0, socialTalkTimer - dt);
          if (socialTalkTimer <= 0) {
            socialTalkMessage = null;
            socialSpeechBubbleEl.style.display = 'none';
          }
        }

        if (currentPlayMode === 'editor') {
          // MAP PREVIEW LIVE FREE CAMERA: Pan with WASD/Arrows while keeping live simulation running!
          const panSpeed = 28 * editorZoom;
          if (moveX !== 0 || moveZ !== 0) {
            const cosY = Math.cos(editorOrbitYaw);
            const sinY = Math.sin(editorOrbitYaw);
            const worldDx = moveX * cosY + moveZ * sinY;
            const worldDz = -moveX * sinY + moveZ * cosY;
            editorPan.x = wrapPlanetCoord(editorPan.x + worldDx * panSpeed * dt);
            editorPan.z = wrapPlanetCoord(editorPan.z + worldDz * panSpeed * dt);
          }
          moveX = 0;
          moveZ = 0;
        }
        {
          // LIVE WORLD SIMULATION (runs in both normal play and MAP PREVIEW live mode!)
          if (cityArenaMode !== 'safezone' && worldModeRef.current === 'warzone') {
          crateSpawnTimer += dt;
          if (crateSpawnTimer >= 4.5) {
            crateSpawnTimer = 0;
            const spot = pickRandomWarzoneDropCoord();
            spawnWorldCrate('red', spot.x, spot.z, false);
          }

          superCrateSpawnTimer += dt;
          if (superCrateSpawnTimer >= 11.0) {
            superCrateSpawnTimer = 0;
            const spot = pickRandomWarzoneDropCoord();
            spawnWorldCrate('super', spot.x, spot.z, false);
          }

          legendCrateSpawnTimer += dt;
          if (legendCrateSpawnTimer >= 18.0) {
            legendCrateSpawnTimer = 0;
            const spot = pickRandomWarzoneDropCoord();
            spawnWorldCrate('legend', spot.x, spot.z, false);
          }

          medicalCrateSpawnTimer += dt;
          if (medicalCrateSpawnTimer >= 15.0) {
            medicalCrateSpawnTimer = 0;
            const spot = pickRandomWarzoneDropCoord();
            spawnWorldCrate('medical', spot.x, spot.z, false);
          }

          warzoneGoldSpawnTimer += dt;
          if (warzoneGoldSpawnTimer >= 9.0) {
            warzoneGoldSpawnTimer = 0;
            const spot = pickRandomWarzoneDropCoord();
            const isGoldCoin = Math.random() < 0.68;
            spawnWorldPickup(
              isGoldCoin ? 'coin_gold' : 'coin_silver',
              isGoldCoin ? 'EMAS WARZONE (+250G)' : 'PERAK WARZONE (+100G)',
              spot.x,
              spot.z,
              { scoreValue: isGoldCoin ? 250 : 100, vy: 4.5 },
            );
          }

          // Random Warzone Explosive Barrel Parachute Drops ("agar lebih chaos buat juga explostion barrel yang drop random di warzone")
          const activeWarzoneBarrelCount = activeMapProps.filter(
            (mp) => mp.alive && mp.kind === 'explosive_barrel' && mp.isWarzoneDropBarrel,
          ).length;
          const barrelDropStep = stepWarzoneExplosiveBarrelDropTimer(
            warzoneExplosiveBarrelSpawnTimer,
            activeWarzoneBarrelCount,
            dt,
            WARZONE_EXPLOSIVE_BARREL_DROP_INTERVAL_SEC,
            MAX_ACTIVE_WARZONE_EXPLOSIVE_BARRELS,
          );
          warzoneExplosiveBarrelSpawnTimer = barrelDropStep.nextTimerSec;
          if (barrelDropStep.shouldDropBarrel) {
            const spot = pickRandomWarzoneDropCoord();
            spawnWarzoneExplosiveBarrel(spot.x, spot.z, false);
          }

          // Dynamic Supply Drop Event (Alternating Central Oasis & Harbor Dock every 45–70s, with 15s countdown!)
          const supplyStep = stepSupplyDropSchedule(supplyDropSchedule, dt);
          supplyDropSchedule = supplyStep.state;
          if (supplyDropBeaconLingeringTimer > 0) {
            supplyDropBeaconLingeringTimer = Math.max(0, supplyDropBeaconLingeringTimer - dt);
          }
          if (supplyStep.landedPayload) {
            const payload = supplyStep.landedPayload;
            supplyDropBeaconLingeringTimer = 10.0;
            // 1. Spawn 1 Indestructible Special Metallic Crate (65% Silver Metallic / 35% Shiny Gold Metallic)
            spawnWorldCrate(payload.metallicCrateKind, payload.x, payload.z, false);

            // 1b. Refill Player Ammo on Supply Drop Event + Spawn 3 Supply Ammo Packs & Tactical Grenade/Land Mine Packs!
            if (playerUnit && playerUnit.alive) {
              playerUnit.tacticalLoadout = refillLoadoutAmmoFromSource(
                playerUnit.tacticalLoadout,
                'supply_drop',
              );
              syncUnitFieldsFromLoadout(playerUnit);
            }
            for (let ai = 0; ai < 3; ai++) {
              const angle = (ai / 3) * Math.PI * 2 + 0.35;
              const rad = 1.7 + Math.random() * 1.3;
              const ax = wrapPlanetCoord(payload.x + Math.cos(angle) * rad);
              const az = wrapPlanetCoord(payload.z + Math.sin(angle) * rad);
              spawnWorldPickup('ammo', 'SUPPLY AMMO (+60 ROUNDS)', ax, az, {
                remainingAmmo: 60,
                vx: Math.cos(angle) * 2.4,
                vy: 5.5,
                vz: Math.sin(angle) * 2.4,
              });
            }
            for (const secKind of ['hand_grenade', 'land_mine'] as const) {
              const angle = secKind === 'hand_grenade' ? 0.95 : 2.55;
              const rad = 2.0;
              const sx = wrapPlanetCoord(payload.x + Math.cos(angle) * rad);
              const sz = wrapPlanetCoord(payload.z + Math.sin(angle) * rad);
              spawnWorldPickup(
                'secondary',
                secKind === 'hand_grenade' ? 'HG-04 Frag Grenade' : 'TM-89 Land Mine',
                sx,
                sz,
                {
                  secondaryId: secKind,
                  secondaryCount: 3,
                  vx: Math.cos(angle) * 2.5,
                  vy: 5.4,
                  vz: Math.sin(angle) * 2.5,
                },
              );
            }

            // 2. Spawn 5-8 Large Gold Coins (@ +150 G) around the Supply Drop landing site
            for (let gi = 0; gi < payload.goldCoinCount; gi++) {
              const angle = (gi / Math.max(1, payload.goldCoinCount)) * Math.PI * 2 + Math.random() * 0.35;
              const rad = 1.6 + Math.random() * 2.1;
              const gx = wrapPlanetCoord(payload.x + Math.cos(angle) * rad);
              const gz = wrapPlanetCoord(payload.z + Math.sin(angle) * rad);
              spawnWorldPickup(
                'coin_gold',
                `SUPPLY DROP GOLD (+${payload.goldCoinValue}G)`,
                gx,
                gz,
                {
                  scoreValue: payload.goldCoinValue,
                  vx: Math.cos(angle) * 2.8,
                  vy: 5.8 + Math.random() * 1.6,
                  vz: Math.sin(angle) * 2.8,
                },
              );
            }

            // 3. Spawn 2-3 Medkits (Significantly restores +65 HP when picked up)
            for (let mi = 0; mi < payload.medkitCount; mi++) {
              const angle = (mi / Math.max(1, payload.medkitCount)) * Math.PI * 2 + 0.65;
              const rad = 1.9 + Math.random() * 1.4;
              const mx = wrapPlanetCoord(payload.x + Math.cos(angle) * rad);
              const mz = wrapPlanetCoord(payload.z + Math.sin(angle) * rad);
              spawnWorldPickup(
                'health',
                'SUPPLY MEDKIT (+65 HP)',
                mx,
                mz,
                {
                  healAmount: payload.medkitHealAmount,
                  vx: Math.cos(angle) * 2.2,
                  vy: 5.2,
                  vz: Math.sin(angle) * 2.2,
                },
              );
            }

            playSpatialSoundAt(payload.x, payload.z, 65.0, 12.0, () => {
              soundEngine.playPowerCore();
            });
            spawnBurstParticles(payload.x, getTerrainElevation(payload.x, payload.z) + 1.5, payload.z, 24);
            kioskStatusMessage =
              payload.metallicCrateKind === 'gold_metallic'
                ? `SUPPLY DROP MENDARAT DI ${payload.locationName}! (SHINY GOLD METALLIC BOX + ${payload.goldCoinCount} KOIN + ${payload.medkitCount} MEDKIT)`
                : `SUPPLY DROP MENDARAT DI ${payload.locationName}! (SILVER METALLIC BOX + ${payload.goldCoinCount} KOIN + ${payload.medkitCount} MEDKIT)`;
            kioskStatusTimer = 6.0;
          }

          if (supplyDropSchedule.warningActive || supplyDropBeaconLingeringTimer > 0) {
            const activeLocId = supplyDropSchedule.warningActive
              ? supplyDropSchedule.nextLocationId
              : supplyDropSchedule.nextLocationId === 'CENTRAL_OASIS'
                ? 'HARBOR_DOCK'
                : 'CENTRAL_OASIS';
            const locSpec = SUPPLY_DROP_LOCATIONS[activeLocId];
            const groundElev = getTerrainElevation(locSpec.x, locSpec.z);
            supplyDropBeaconGroup.visible = true;
            supplyDropBeaconGroup.position.set(locSpec.x, groundElev + 0.08, locSpec.z);
            const pulse = 1.0 + Math.sin(timeSec * 6.5) * 0.14;
            supplyBeaconOuterRing.scale.set(pulse, pulse, 1);
            supplyBeaconInnerRing.scale.set(2.0 - pulse * 0.85, 2.0 - pulse * 0.85, 1);
            supplyBeaconOuterRingMat.opacity = 0.55 + Math.abs(Math.sin(timeSec * 5.0)) * 0.4;
            supplyBeaconBeamMat.opacity = 0.16 + Math.abs(Math.sin(timeSec * 4.0)) * 0.2;
          } else {
            supplyDropBeaconGroup.visible = false;
          }
          } // End of if (cityArenaMode !== 'safezone') for Warzone drops & Supply Drop events

          if (kioskStatusTimer > 0) {
            kioskStatusTimer = Math.max(0, kioskStatusTimer - dt);
            if (kioskStatusTimer <= 0) {
              kioskStatusMessage = null;
            }
          }

          // Update Falling & Grounded Crates (Parachute descent + Rigid Ballistic Throw/Kick Arc + Solid Box Sliding & Collisions)
          for (let ci = worldCrates.length - 1; ci >= 0; ci--) {
            const c = worldCrates[ci];
            const groundY = getTerrainElevation(c.x, c.z) + 0.65;
            c.squashTimer = 0;
            c.mesh.scale.set(1, 1, 1);

            if (c.state === 'falling') {
              c.y -= 5.2 * dt;
              c.mesh.position.y = c.y;
              c.rotY = Math.sin(timeSec * 2.5 + c.id) * 0.18;
              c.mesh.rotation.y = c.rotY;
              if (c.y <= groundY) {
                c.y = groundY;
                c.state = 'grounded';
                c.parachuteMesh.visible = false;
                c.mesh.position.y = groundY;
                c.rotY = 0;
                c.mesh.rotation.y = 0;
              }
            } else if (c.state === 'grounded') {
              if (c.y > groundY || c.vy > 0) {
                c.y += c.vy * dt;
                c.vy -= 25.0 * dt;
                if (c.y <= groundY) {
                  c.y = groundY;
                  if (c.vy < -2.0) {
                    const impactVy = Math.abs(c.vy);
                    c.vy = -c.vy * 0.24;
                    playSpatialSoundAt(c.x, c.z, 16.0, 3.5, () => {
                      if (c.kind === 'super') {
                        soundEngine.playMetalImpact(Math.min(10, impactVy * 1.35));
                      } else {
                        soundEngine.playWoodHit(Math.min(10, impactVy * 1.35));
                      }
                    });
                  } else {
                    c.vy = 0;
                  }
                }
              } else {
                c.y = groundY;
              }

              const cSpeed = Math.hypot(c.vx, c.vz);
              if (cSpeed > 0.02 || Math.abs(c.rotVelY) > 0.02) {
                c.x = wrapPlanetCoord(c.x + c.vx * dt);
                c.z = wrapPlanetCoord(c.z + c.vz * dt);
                const cEmb = evaluateOuterEmbankmentSdf(c.x, c.z);
                if (cEmb > -0.8) {
                  const len = Math.max(0.01, Math.hypot(c.x, c.z));
                  c.x -= (c.x / len) * (cEmb + 0.8);
                  c.z -= (c.z / len) * (cEmb + 0.8);
                  c.vx *= -0.4;
                  c.vz *= -0.4;
                }

                // Rigid Crate-vs-Static Obstacle Collision (thrown/pushed solid boxes bounce off walls & buildings!)
                for (let mi = 0; mi < activeMapProps.length; mi++) {
                  const mp = activeMapProps[mi];
                  if (!mp.alive || (mp.category !== 'solid' && mp.category !== 'breakable')) continue;
                  if (mp.halfX && mp.halfZ) {
                    const obbRes = resolveSolidObbCollision2D(
                      c.x,
                      c.z,
                      c.vx,
                      c.vz,
                      0.68,
                      mp.x,
                      mp.z,
                      mp.halfX,
                      mp.halfZ,
                      mp.rotY,
                      0.32,
                    );
                    if (obbRes.collided) {
                      c.x = wrapPlanetCoord(obbRes.x);
                      c.z = wrapPlanetCoord(obbRes.z);
                      c.vx = obbRes.vx;
                      c.vz = obbRes.vz;
                    }
                  } else {
                    const colRes = resolveSolidCollision2D(
                      c.x,
                      c.z,
                      c.vx,
                      c.vz,
                      0.68,
                      mp.x,
                      mp.z,
                      mp.radius,
                      0.32,
                    );
                    if (colRes.collided) {
                      c.x = wrapPlanetCoord(colRes.x);
                      c.z = wrapPlanetCoord(colRes.z);
                      c.vx = colRes.vx;
                      c.vz = colRes.vz;
                    }
                  }
                }

                // Rigid Crate-vs-Static Base Walls / Buildings / Fences OBB Collision
                const crateWorldObbs = getStaticWorldStructures();
                for (let oi = 0; oi < crateWorldObbs.length; oi++) {
                  const obb = crateWorldObbs[oi];
                  const obbRes = resolveSolidObbCollision2D(
                    c.x,
                    c.z,
                    c.vx,
                    c.vz,
                    0.66,
                    obb.x,
                    obb.z,
                    obb.halfX,
                    obb.halfZ,
                    obb.rotY,
                    0.32,
                  );
                  if (obbRes.collided) {
                    c.x = wrapPlanetCoord(obbRes.x);
                    c.z = wrapPlanetCoord(obbRes.z);
                    c.vx = obbRes.vx;
                    c.vz = obbRes.vz;
                  }
                }

                // Rigid Crate-vs-Crate Collision (thrown/pushed solid box knocks other grounded crates!)
                for (let cj = 0; cj < worldCrates.length; cj++) {
                  if (cj === ci) continue;
                  const other = worldCrates[cj];
                  if (other.state !== 'grounded') continue;
                  const ccRes = resolveCrateVsCrateCollision2D(
                    c.x,
                    c.z,
                    c.vx,
                    c.vz,
                    other.x,
                    other.z,
                    other.vx,
                    other.vz,
                    1.34,
                    0.34,
                  );
                  if (ccRes.collided) {
                    c.x = wrapPlanetCoord(ccRes.ax);
                    c.z = wrapPlanetCoord(ccRes.az);
                    c.vx = ccRes.avx;
                    c.vz = ccRes.avz;
                    other.x = wrapPlanetCoord(ccRes.bx);
                    other.z = wrapPlanetCoord(ccRes.bz);
                    other.vx = ccRes.bvx;
                    other.vz = ccRes.bvz;
                    if (
                      ccRes.impactSpeed > 1.2 &&
                      tryTriggerCooldown(`crate_crate_${Math.min(c.id, other.id)}_${Math.max(c.id, other.id)}`, timeSec, 0.12)
                    ) {
                      playSpatialSoundAt(c.x, c.z, 15.0, 3.5, () => {
                        soundEngine.playWoodHit(Math.min(9.0, ccRes.impactSpeed * 1.2));
                      });
                    }
                  }
                }

                c.rotY += c.rotVelY * dt;
                const damp = Math.exp(-5.4 * dt);
                c.vx *= damp;
                c.vz *= damp;
                c.rotVelY *= Math.exp(-7.0 * dt);

                // Team Buddies Crate Kick Synergy:
                // 1) If a kicked/thrown crate slides into the intact Bottom-Left Stacking Pad (blue plot 0), automatically slot it in!
                if (cSpeed > 1.2) {
                  const pad = blueBase.commanderPads[0];
                  if (
                    pad &&
                    getPlanetShortestDistance(c.x, c.z, pad.worldX, pad.worldZ) < 3.4 &&
                    addCrateToPadSlots('blue', c.kind, 0)
                  ) {
                    score += 35;
                    playBuildBoxSoundAtPad('blue', pad.worldX, pad.worldZ, true, () => {
                      soundEngine.playPickup();
                    });
                    spawnBurstParticles(pad.worldX, 1.4, pad.worldZ, 10);
                    scene.remove(c.mesh);
                    worldCrates.splice(ci, 1);
                    continue;
                  }
                }

                // 2) If a kicked/thrown crate slides into the rear loading zone of a Dump Truck, load it into the truck!
                if (cSpeed > 1.2) {
                  let loadedIntoTruck = false;
                  for (const t of tanks) {
                    if (
                      t.vehicleKind === 'truck' &&
                      t.hp > 0 &&
                      canLoadCrateIntoDumpTruck(t.storedCrates.length, (t.dumpAnimTimer ?? 0) > 0, true)
                    ) {
                      const rearX = wrapPlanetCoord(t.x - Math.cos(t.hullYaw) * 1.45);
                      const rearZ = wrapPlanetCoord(t.z + Math.sin(t.hullYaw) * 1.45);
                      const dRear = Math.min(
                        getPlanetShortestDistance(c.x, c.z, t.x, t.z),
                        getPlanetShortestDistance(c.x, c.z, rearX, rearZ),
                      );
                      if (dRear < 2.8 && c.kind !== 'medical') {
                        t.storedCrates.push(c.kind);
                        syncBlitzDumpTruckCargoVisuals(t.bodyGroup, t.storedCrates);
                        playSpatialSoundAt(t.x, t.z, 16.0, 4.0, () => {
                          soundEngine.playPickup();
                          soundEngine.playWoodHit(7.5);
                        });
                        spawnBurstParticles(t.x, 1.65, t.z, 10);
                        scene.remove(c.mesh);
                        worldCrates.splice(ci, 1);
                        loadedIntoTruck = true;
                        break;
                      }
                    }
                  }
                  if (loadedIntoTruck) continue;
                }
              }
            }
          }

          // Update Pushable & Jiggling Map Props (wheelbarrow, traffic_cone, barricade, recycle_bin, warzone explosive barrels, etc.)
          for (const mp of activeMapProps) {
            if (!mp.alive) continue;
            if (mp.fallingFromSky) {
              const groundY = getTerrainElevation(mp.x, mp.z);
              mp.y = (mp.y ?? groundY + 18.0) - 5.6 * dt;
              mp.rotY = Math.sin(timeSec * 2.6 + mp.id) * 0.16;
              mp.wrapper.userData.baseRotY = mp.rotY;
              if (mp.y <= groundY) {
                mp.y = groundY;
                mp.fallingFromSky = false;
                mp.wrapper.userData.fallOffsetY = 0;
                if (mp.parachuteMesh) mp.parachuteMesh.visible = false;
                spawnBurstParticles(mp.x, groundY + 0.45, mp.z, 8);
              } else {
                mp.wrapper.userData.fallOffsetY = mp.y - groundY;
              }
            }
            if (mp.category === 'pushable' || mp.category === 'breakable') {
              const spd = Math.hypot(mp.vx, mp.vz);
              if (spd > 0.02 || Math.abs(mp.rotVelY) > 0.02) {
                mp.x = wrapPlanetCoord(mp.x + mp.vx * dt);
                mp.z = wrapPlanetCoord(mp.z + mp.vz * dt);
                const mpEmb = evaluateOuterEmbankmentSdf(mp.x, mp.z);
                if (mpEmb > -0.8) {
                  const len = Math.max(0.01, Math.hypot(mp.x, mp.z));
                  mp.x -= (mp.x / len) * (mpEmb + 0.8);
                  mp.z -= (mp.z / len) * (mpEmb + 0.8);
                  mp.vx *= -0.4;
                  mp.vz *= -0.4;
                }
                mp.rotY += mp.rotVelY * dt;
                const damp = Math.exp(-5.2 * dt);
                mp.vx *= damp;
                mp.vz *= damp;
                mp.rotVelY *= Math.exp(-6.2 * dt);
                mp.wrapper.userData.worldX = mp.x;
                mp.wrapper.userData.worldZ = mp.z;
                mp.wrapper.userData.baseRotY = mp.rotY;
                if (spd > 0.8) {
                  blitzGrassSystem.stampTankTracks(mp.x - 0.35, mp.z, mp.x + 0.35, mp.z);
                }
              }
            }
            if (mp.jiggleTimer > 0) {
              mp.jiggleTimer = Math.max(0, mp.jiggleTimer - dt);
            }
          }

          // Animate any unmounted BlitzPlane (smoothly lands to altitude = 0 when parked/unmounted)
          // and advance active hydraulic vessel dump cycles on any Dump Truck!
          for (const v of tanks) {
            if (v.vehicleKind === 'plane' && v !== mountedTank && v.hp > 0) {
              const curAlt = v.altitude ?? 0;
              if (curAlt > 0) {
                v.altitude = Math.max(0, curAlt - 5.5 * dt);
                v.verticalSpeed = v.altitude > 0 ? -5.5 : 0;
              } else {
                v.verticalSpeed = 0;
              }
              v.forwardSpeed = Math.max(0, (v.forwardSpeed ?? 0) - 10 * dt);
              stepBlitzPlaneAnimation(
                v.bodyGroup,
                dt,
                0,
                0,
                v.forwardSpeed,
                false,
                v.altitude ?? 0,
                v.verticalSpeed ?? 0,
              );
              const sh = getCachedVehicleContactShadow(v);
              if (sh) {
                const sc = Math.max(1.5, 3.6 - (v.altitude ?? 0) * 0.13);
                sh.scale.set(sc, sc * 0.88, 1);
              }
            }

            if (v.vehicleKind === 'truck' && v.hp > 0 && (v.dumpAnimTimer ?? 0) > 0) {
              v.dumpAnimTimer = (v.dumpAnimTimer ?? 0) + dt;
              const hydState = evaluateDumpTruckHydraulicCycle(v.dumpAnimTimer);

              if (hydState.shouldReleaseCrates && !v.dumpReleasedInCycle) {
                v.dumpReleasedInCycle = true;
                if (v.storedCrates.length > 0) {
                  soundEngine.playHydraulicDump();
                  const nearBluePad =
                    v.dumpTargetMode === 'pad' ||
                    getPlanetShortestDistance(v.x, v.z, blueBase.padX, blueBase.padZ) <= 9.5;

                  if (nearBluePad) {
                    while (v.storedCrates.length > 0) {
                      const kind = v.storedCrates[0];
                      if (!addCrateToPadSlots('blue', kind)) break;
                      v.storedCrates.shift();
                      score += 35;
                    }
                    spawnBurstParticles(blueBase.padX, 1.8, blueBase.padZ, 12);
                  }

                  // Any crates remaining (or when unloading onto ground anywhere) slide out the rear tailgate!
                  if (v.storedCrates.length > 0) {
                    const fwdX = Math.cos(v.hullYaw);
                    const fwdZ = -Math.sin(v.hullYaw);
                    const rightX = Math.sin(v.hullYaw);
                    const rightZ = Math.cos(v.hullYaw);

                    v.storedCrates.forEach((kind, idx) => {
                      const sideOff = ((idx % 2) - 0.5) * 1.15;
                      const rearDist = 2.85 + Math.floor(idx / 2) * 1.15;
                      const ejectX = wrapPlanetCoord(v.x - fwdX * rearDist + rightX * sideOff);
                      const ejectZ = wrapPlanetCoord(v.z - fwdZ * rearDist + rightZ * sideOff);
                      spawnWorldCrate(kind, ejectX, ejectZ, true);
                      const ejected = worldCrates[worldCrates.length - 1];
                      if (ejected) {
                        ejected.vx = -fwdX * (3.6 + (idx % 2) * 0.8) + rightX * sideOff * 1.1;
                        ejected.vz = -fwdZ * (3.6 + (idx % 2) * 0.8) + rightZ * sideOff * 1.1;
                        ejected.rotVelY = (Math.random() - 0.5) * 5.0;
                      }
                      spawnBurstParticles(ejectX, 0.75, ejectZ, 6);
                    });
                    v.storedCrates = [];
                  }

                  syncBlitzDumpTruckCargoVisuals(v.bodyGroup, v.storedCrates);
                }
              }

              if (hydState.finished) {
                v.dumpAnimTimer = 0;
                v.dumpReleasedInCycle = false;
                stepBlitzDumpTruckAnimation(
                  v.bodyGroup,
                  0,
                  v.steerAngle ?? 0,
                  evaluateDumpTruckHydraulicCycle(0),
                  v.bodyPitchRad ?? 0,
                  v.bodyRollRad ?? 0,
                );
              } else if (v !== mountedTank) {
                stepBlitzDumpTruckAnimation(
                  v.bodyGroup,
                  0,
                  v.steerAngle ?? 0,
                  hydState,
                  v.bodyPitchRad ?? 0,
                  v.bodyRollRad ?? 0,
                );
              }
            } else if (
              v.vehicleKind === 'truck' &&
              v !== mountedTank &&
              v.hp > 0 &&
              (Math.abs(v.forwardSpeed ?? 0) > 0.02 || Math.abs(v.steerAngle ?? 0) > 0.01)
            ) {
              // Unmounted Dump Truck smoothly coasts to a stop on its rubber tires
              const prevX = v.x;
              const prevZ = v.z;
              const prevYaw = v.hullYaw;
              const stepRes = stepDumpTruckWheeledPhysics(
                {
                  forwardSpeed: v.forwardSpeed ?? 0,
                  steerAngle: v.steerAngle ?? 0,
                  hullYaw: v.hullYaw,
                },
                { throttle: 0, steer: 0, boost: false },
                dt,
              );
              v.forwardSpeed = stepRes.forwardSpeed;
              v.steerAngle = stepRes.steerAngle;
              v.hullYaw = stepRes.hullYaw;
              v.vx = stepRes.vx;
              v.vz = stepRes.vz;
              v.bodyPitchRad = stepRes.bodyPitchRad;
              v.bodyRollRad = stepRes.bodyRollRad;
              v.x = wrapPlanetCoord(v.x + v.vx * dt);
              v.z = wrapPlanetCoord(v.z + v.vz * dt);
              resolveMoverWorldCollisions(v, `truck_${v.id}`, true, 2.1, 12.5, timeSec, false);
              v.bodyGroup.rotation.y = v.hullYaw;
              const fwdX = Math.cos(v.hullYaw);
              const fwdZ = -Math.sin(v.hullYaw);
              const fwdMove =
                getPlanetShortestDelta(v.x, prevX) * fwdX +
                getPlanetShortestDelta(v.z, prevZ) * fwdZ;
              stepBlitzDumpTruckAnimation(
                v.bodyGroup,
                fwdMove,
                v.steerAngle,
                evaluateDumpTruckHydraulicCycle(v.dumpAnimTimer ?? 0),
                v.bodyPitchRad,
                v.bodyRollRad,
              );
              recordTankMovementAndTracks(v, prevX, prevZ, prevYaw);
            }
            if (v.riderGroup.visible && v.riderGroup.userData.riderRig) {
              updateCharacterWeaponStance(
                v.riderGroup.userData.riderRig as RobloxBuddyRig,
                'unarmed',
                0,
                false,
                false,
                0,
                0,
                0,
                'right',
                0,
                0,
                0.76,
                0,
                true,
                'front',
                1,
                v.hullYaw,
                0,
                false,
                true,
              );
            }
          }

          for (let bi = 0; bi < buddyUnits.length; bi++) {
            buddyUnits[bi].isFiringLaser = false;
          }

          if (mountedTank) {
            // =================================================================
            // A. DRIVING BLITZ TANK / DUMP TRUCK OR FLYING BLITZ PLANE MODE
            // =================================================================
            const isPlane = mountedTank.vehicleKind === 'plane';
            const isTruck = mountedTank.vehicleKind === 'truck';
            const prevTankX = mountedTank.x;
            const prevTankZ = mountedTank.z;
            const prevTankYaw = mountedTank.hullYaw;

            if (isPlane) {
              // ---------------------------------------------------------------
              // BLITZ PLANE FLIGHT & TAKE-OFF PHYSICS (NO REVERSE / BACKWARD!)
              // - Starts on ground (altitude = 0)
              // - [W]: Forward thrust (accelerates forward, auto-takes off from runway, NEVER reverses!)
              // - [Space] / [E] / [ArrowUp]: Take-Off & Climb UP up to 19.5m (clears 9.2m trees, 13.25m HQ & 18.5m crane/turbines!)
              // - [C] / [Ctrl] / [ArrowDown] / [S]: Descend & Land to ground (0m); [S] also brakes forward speed to 0
              // ---------------------------------------------------------------
              const MAX_PLANE_ALT = 19.5;
              const isForwardThrust = Boolean(keys['KeyW']);
              const isAirbrake = Boolean(keys['KeyS']);
              const isClimbInput = Boolean(
                keys['Space'] || keys['KeyE'] || keys['ArrowUp'] || keys['PageUp'],
              );
              const isDescendInput = Boolean(
                keys['KeyC'] ||
                  keys['ControlLeft'] ||
                  keys['ControlRight'] ||
                  keys['ArrowDown'] ||
                  keys['PageDown'] ||
                  keys['KeyS'],
              );

              let turn = 0;
              if (keys['KeyA'] || keys['ArrowLeft']) turn += 1;
              if (keys['KeyD'] || keys['ArrowRight']) turn -= 1;

              let alt = mountedTank.altitude ?? 0;
              let targetAlt = mountedTank.targetAltitude ?? alt;
              let vSpd = mountedTank.verticalSpeed ?? 0;
              let fSpd = mountedTank.forwardSpeed ?? 0;

              // 1. Vertical Altitude & Take-Off Control (0m Ground -> 19.5m Above Trees & Buildings!)
              if (isClimbInput) {
                targetAlt = Math.min(MAX_PLANE_ALT, Math.max(targetAlt + 11.5 * dt, 13.8));
                if (fSpd < 7.0) fSpd = Math.min(7.0, fSpd + 18.0 * dt);
              } else if (isDescendInput) {
                targetAlt = Math.max(0, targetAlt - 12.0 * dt);
                if (keys['KeyC'] || keys['ControlLeft'] || keys['ControlRight']) {
                  targetAlt = 0;
                }
              } else if (isForwardThrust && alt < 1.5 && fSpd >= 4.2) {
                // Automatic runway take-off climb above the trees when accelerating on the ground!
                targetAlt = Math.max(targetAlt, 12.5);
              }

              const altError = targetAlt - alt;
              const desiredVy = clamp(altError * 3.8, -11.0, 12.5);
              vSpd += (desiredVy - vSpd) * Math.min(1, 10.0 * dt);
              alt = clamp(alt + vSpd * dt, 0, MAX_PLANE_ALT);
              if (alt <= 0.02 && targetAlt <= 0.05) {
                alt = 0;
                targetAlt = 0;
                vSpd = 0;
              } else if (alt >= MAX_PLANE_ALT - 0.02 && targetAlt >= MAX_PLANE_ALT - 0.05) {
                alt = MAX_PLANE_ALT;
                vSpd = 0;
              }

              // 2. Forward Airspeed Control (Strictly >= 0 — Plane NEVER moves backwards!)
              const maxFwdSpeed = isBoosting ? 24.5 : 18.2;
              if (isForwardThrust) {
                fSpd = Math.min(maxFwdSpeed, fSpd + (isBoosting ? 22.0 : 16.5) * dt);
              } else if (isAirbrake) {
                // Airbrake / Wheel Brake: decelerates forward speed down to 0, NEVER negative!
                fSpd = Math.max(0, fSpd - 22.0 * dt);
              } else {
                // Coasting: maintain smooth forward glide when airborne, stop on ground
                const minGlideSpeed = alt > 0.35 ? 5.2 : 0;
                if (fSpd > minGlideSpeed) {
                  fSpd = Math.max(minGlideSpeed, fSpd - 6.0 * dt);
                } else if (alt > 0.35 && fSpd < minGlideSpeed) {
                  fSpd = Math.min(minGlideSpeed, fSpd + 6.0 * dt);
                }
              }

              // 3. Yaw Steering (only turns on the ground if rolling forward, or anytime in the air)
              if (turn !== 0 && (alt > 0.2 || fSpd > 0.4)) {
                const turnRate = BUDDIES_CONSTANTS.physics.drive.rotationSpeed * (alt > 0.2 ? 1.28 : 0.95);
                mountedTank.hullYaw += turn * turnRate * dt;
              }

              const fwdX = Math.cos(mountedTank.hullYaw);
              const fwdZ = -Math.sin(mountedTank.hullYaw);
              mountedTank.vx = fwdX * fSpd;
              mountedTank.vz = fwdZ * fSpd;
              // Seamless 360° Spherical Loop Wrapping!
              mountedTank.x = wrapPlanetCoord(mountedTank.x + mountedTank.vx * dt);
              mountedTank.z = wrapPlanetCoord(mountedTank.z + mountedTank.vz * dt);

              // Full 3D Altitude-Aware Collision Resolution at ALL altitudes (collides with any building, tree, or prop taller than `alt`, plus Outer Embankment!)
              mountedTank.altitude = alt;
              resolveMoverWorldCollisions(mountedTank, 'player_plane', true, 1.95, 7.0, timeSec, true, alt);
              mountedTank.forwardSpeed = Math.hypot(mountedTank.vx, mountedTank.vz);
              fSpd = mountedTank.forwardSpeed;

              mountedTank.altitude = alt;
              mountedTank.targetAltitude = targetAlt;
              mountedTank.verticalSpeed = vSpd;
              mountedTank.forwardSpeed = fSpd;

              mountedTank.root.position.set(mountedTank.x, getTerrainElevation(mountedTank.x, mountedTank.z), mountedTank.z);
              mountedTank.bodyGroup.rotation.y = mountedTank.hullYaw;
              activeSpeed = fSpd;
              soundEngine.updateVehicleMovementLoop(activeSpeed, isBoosting && isForwardThrust, alt < 1.2);

              const sh = getCachedVehicleContactShadow(mountedTank);
              if (sh) {
                const sc = Math.max(1.5, 3.6 - alt * 0.13);
                sh.scale.set(sc, sc * 0.88, 1);
              }

              const isPlaneFiring = Boolean(isPointerDown);
              stepBlitzPlaneAnimation(
                mountedTank.bodyGroup,
                dt,
                turn,
                isForwardThrust ? 1 : 0,
                activeSpeed,
                isPlaneFiring,
                alt,
                vSpd,
              );
              mountedTank.turretGroup.rotation.y = 0;

              // 4. Flatten grass beneath BlitzPlane ONLY when flying low or taking off (alt < 4.5m)
              if (alt < 4.5 && (fSpd > 0.4 || alt > 0.15)) {
                const rightX = Math.sin(mountedTank.hullYaw);
                const rightZ = Math.cos(mountedTank.hullYaw);
                const wingWashSpan = 1.45;
                blitzGrassSystem.stampTankTracks(
                  mountedTank.x - rightX * wingWashSpan,
                  mountedTank.z - rightZ * wingWashSpan,
                  mountedTank.x + rightX * wingWashSpan,
                  mountedTank.z + rightZ * wingWashSpan,
                );
                blitzGrassSystem.stampTankTracks(
                  mountedTank.x - fwdX * 0.85,
                  mountedTank.z - fwdZ * 0.85,
                  mountedTank.x + fwdX * 0.85,
                  mountedTank.z + fwdZ * 0.85,
                );
              }

              // 5. Twin Under-Wing Rotary Minigun Firing (angles slightly down when flying high to strafe ground targets!)
              if (mountedTank.recoilTimer > 0) {
                mountedTank.recoilTimer = Math.max(0, mountedTank.recoilTimer - dt);
              }
              if (isPlaneFiring && mountedTank.recoilTimer <= 0.01) {
                mountedTank.recoilTimer = 0.095;
                soundEngine.playFighterJetRotaryBurst();
                const groundElev = getTerrainElevation(mountedTank.x, mountedTank.z);
                const muzzleY = groundElev + 0.55 + alt;
                const distToAim = Math.max(
                  9.0,
                  getPlanetShortestDistance(aimWorldPoint.x, aimWorldPoint.z, mountedTank.x, mountedTank.z),
                );
                const pitchDropY =
                  alt > 1.2 ? clamp((groundElev + 1.2 - muzzleY) / distToAim, -0.55, 0.02) : 0;
                scratchSpawnDir.set(fwdX, pitchDropY, fwdZ).normalize();
                const rightX = Math.sin(mountedTank.hullYaw);
                const rightZ = Math.cos(mountedTank.hullYaw);
                for (const side of [-1, 1]) {
                  scratchSpawnOrigin.set(
                    wrapPlanetCoord(mountedTank.x + fwdX * 2.1 + rightX * (side * 1.12)),
                    muzzleY,
                    wrapPlanetCoord(mountedTank.z + fwdZ * 2.1 + rightZ * (side * 1.12)),
                  );
                  fireProjectile(true, 'PlaneGatling', scratchSpawnOrigin, scratchSpawnDir, 56, 11);
                  blitzExplosionSystem.spawnBlitzMuzzleFlash(
                    scratchSpawnOrigin,
                    scratchSpawnDir,
                    0.48,
                    'minigun',
                  );
                }
                if (activeMuzzleRaycastResult?.hit) {
                  spawnRaycastSurfaceNormalImpact(activeMuzzleRaycastResult, false);
                }
                shakeTrauma = Math.min(1, shakeTrauma + 0.08);
              }
              // 5B. Aerial CB-24 Cluster Bomb Salvo Drop (Exclusive to Blitz Plane!)
              if (planeClusterBombCooldown > 0) {
                planeClusterBombCooldown = Math.max(0, planeClusterBombCooldown - dt);
              }
              if (
                isPlaneFiring &&
                planeClusterBombCooldown <= 0 &&
                playerUnit.secondaryItem === 'cluster_bomb' &&
                playerUnit.secondaryCount > 0 &&
                (blueCommanderBases[0]?.buildingLevel ?? 1) >= 3
              ) {
                planeClusterBombCooldown = 0.95;
                dropClusterBombFromPlane(mountedTank);
                playerUnit.secondaryCount = Math.max(0, playerUnit.secondaryCount - 1);
              }
            } else if (isTruck) {
              // ---------------------------------------------------------------
              // BLITZ DUMP TRUCK WHEELED ACKERMANN STEERING & DIESEL INERTIA
              // - Front-wheel steering (cannot pivot-spin in place when stationary!)
              // - Smooth acceleration, rubber-tire coasting inertia, air-brakes & reverse
              // - Sprung suspension pitch (squat/nose-dive) & cornering roll
              // ---------------------------------------------------------------
              let throttle = 0;
              let steer = 0;
              if (keys['KeyW'] || keys['ArrowUp']) throttle += 1;
              if (keys['KeyS'] || keys['ArrowDown']) throttle -= 1;
              if (keys['KeyA'] || keys['ArrowLeft']) steer += 1;
              if (keys['KeyD'] || keys['ArrowRight']) steer -= 1;

              const truckRoadBoost = evaluateRoadSurfaceSpeedBoost(mountedTank.x, mountedTank.z);
              const truckStep = stepDumpTruckWheeledPhysics(
                {
                  forwardSpeed: mountedTank.forwardSpeed ?? 0,
                  steerAngle: mountedTank.steerAngle ?? 0,
                  hullYaw: mountedTank.hullYaw,
                },
                {
                  throttle,
                  steer,
                  boost: isBoosting && throttle !== 0,
                  onRoad: truckRoadBoost.onRoadOrZebra,
                },
                dt,
              );

              mountedTank.forwardSpeed = truckStep.forwardSpeed;
              mountedTank.steerAngle = truckStep.steerAngle;
              mountedTank.hullYaw = truckStep.hullYaw;
              mountedTank.vx = truckStep.vx;
              mountedTank.vz = truckStep.vz;
              mountedTank.bodyPitchRad = truckStep.bodyPitchRad;
              mountedTank.bodyRollRad = truckStep.bodyRollRad;
              mountedTank.currentDriveSpeed = Math.abs(truckStep.forwardSpeed);

              mountedTank.x = wrapPlanetCoord(mountedTank.x + mountedTank.vx * dt);
              mountedTank.z = wrapPlanetCoord(mountedTank.z + mountedTank.vz * dt);

              resolveMoverWorldCollisions(
                mountedTank,
                'player_truck',
                true,
                2.1,
                12.5,
                timeSec,
                true,
              );

              // Sync longitudinal speed with post-collision velocity along truck forward axis
              const fwdX = Math.cos(mountedTank.hullYaw);
              const fwdZ = -Math.sin(mountedTank.hullYaw);
              const postCollisionFwdSpeed = mountedTank.vx * fwdX + mountedTank.vz * fwdZ;
              if (Math.abs(postCollisionFwdSpeed) < Math.abs(mountedTank.forwardSpeed) * 0.65) {
                mountedTank.forwardSpeed = postCollisionFwdSpeed;
              }

              mountedTank.root.position.set(
                mountedTank.x,
                getTerrainElevation(mountedTank.x, mountedTank.z),
                mountedTank.z,
              );
              mountedTank.bodyGroup.rotation.y = mountedTank.hullYaw;
              activeSpeed = Math.hypot(mountedTank.vx, mountedTank.vz);
              const isOnGrass = Math.hypot(mountedTank.x, mountedTank.z) < 42 && !truckRoadBoost.onRoadOrZebra;
              soundEngine.updateVehicleMovementLoop(
                activeSpeed,
                isBoosting && throttle !== 0,
                isOnGrass,
              );

              spawnRoadBoostDustWindParticles(
                `truck_${mountedTank.id}`,
                truckRoadBoost.onRoadOrZebra,
                true,
                mountedTank.x,
                mountedTank.z,
                mountedTank.vx,
                mountedTank.vz,
                dt,
                true,
                1.32,
              );

              recordTankMovementAndTracks(mountedTank, prevTankX, prevTankZ, prevTankYaw);

              const dx = getPlanetShortestDelta(mountedTank.x, prevTankX);
              const dz = getPlanetShortestDelta(mountedTank.z, prevTankZ);
              const fwdMove = dx * fwdX + dz * fwdZ;
              const hydState = evaluateDumpTruckHydraulicCycle(mountedTank.dumpAnimTimer ?? 0);
              stepBlitzDumpTruckAnimation(
                mountedTank.bodyGroup,
                fwdMove,
                mountedTank.steerAngle,
                hydState,
                mountedTank.bodyPitchRad,
                mountedTank.bodyRollRad,
              );
            } else {
              // ---------------------------------------------------------------
              // BLITZ TANK TRACKED DRIVING PHYSICS (DUAL CATERPILLAR PIVOT + TURRET)
              // ---------------------------------------------------------------
              let throttle = 0;
              let turn = 0;
              if (keys['KeyW'] || keys['ArrowUp']) throttle += 1;
              if (keys['KeyS'] || keys['ArrowDown']) throttle -= 1;
              if (keys['KeyA'] || keys['ArrowLeft']) turn += 1;
              if (keys['KeyD'] || keys['ArrowRight']) turn -= 1;

              const tankRoadBoost = evaluateRoadSurfaceSpeedBoost(mountedTank.x, mountedTank.z);
              const tankStep = stepBlitzTankTrackedPhysics(
                {
                  currentDriveSpeed: mountedTank.currentDriveSpeed,
                  hullYaw: mountedTank.hullYaw,
                  vx: mountedTank.vx,
                  vz: mountedTank.vz,
                },
                {
                  throttle,
                  turn,
                  boost: isBoosting && throttle !== 0,
                  onRoad: tankRoadBoost.onRoadOrZebra,
                },
                dt,
              );

              mountedTank.currentDriveSpeed = tankStep.currentDriveSpeed;
              mountedTank.hullYaw = tankStep.hullYaw;
              mountedTank.vx = tankStep.vx;
              mountedTank.vz = tankStep.vz;

              mountedTank.x = wrapPlanetCoord(mountedTank.x + mountedTank.vx * dt);
              mountedTank.z = wrapPlanetCoord(mountedTank.z + mountedTank.vz * dt);

              resolveMoverWorldCollisions(
                mountedTank,
                'player_tank',
                true,
                mountedTank.isSuper ? 2.15 : 1.95,
                mountedTank.isSuper ? 14.0 : 10.5,
                timeSec,
                true,
              );

              const playerTankClimb = evaluateTankClimbableObstacleElevation(
                mountedTank.x,
                mountedTank.z,
                mountedTank.hullYaw,
                activeMapProps,
              );
              mountedTank.root.position.set(
                mountedTank.x,
                getTerrainElevation(mountedTank.x, mountedTank.z) + playerTankClimb.climbY,
                mountedTank.z,
              );
              mountedTank.bodyGroup.rotation.y = mountedTank.hullYaw;
              activeSpeed = Math.hypot(mountedTank.vx, mountedTank.vz);
              const isOnGrass = Math.hypot(mountedTank.x, mountedTank.z) < 42 && !tankRoadBoost.onRoadOrZebra;
              soundEngine.updateVehicleMovementLoop(activeSpeed, isBoosting && throttle !== 0, isOnGrass);

              spawnRoadBoostDustWindParticles(
                `tank_${mountedTank.id}`,
                tankRoadBoost.onRoadOrZebra,
                true,
                mountedTank.x,
                mountedTank.z,
                mountedTank.vx,
                mountedTank.vz,
                dt,
                true,
                mountedTank.isSuper ? 1.54 : 1.38,
              );

              recordTankMovementAndTracks(mountedTank, prevTankX, prevTankZ, prevTankYaw);

              // Rotate Turret + Open-Top Rider 360° toward Mouse Crosshair
              const aimDx = getPlanetShortestDelta(aimWorldPoint.x, mountedTank.x);
              const aimDz = getPlanetShortestDelta(aimWorldPoint.z, mountedTank.z);
              const desiredWorldYaw = Math.atan2(-aimDz, aimDx);
              mountedTank.turretYaw = stepTurretYaw(
                mountedTank.turretYaw,
                desiredWorldYaw - mountedTank.hullYaw,
                dt,
              );
              mountedTank.turretGroup.rotation.y = mountedTank.turretYaw;
            }

            // Team Buddies Feature: Crate Run-Over / Low-Hover Scoop for Tanks & Low-Flying Planes ONLY
            // (Dump Truck NEVER auto-fills when driving over crates — the character must load crates into the truck one-by-one!)
            const isDumpingNow = isTruck && (mountedTank.dumpAnimTimer ?? 0) > 0;
            if (!isTruck && (!isPlane || (mountedTank.altitude ?? 0) < 3.2) && !isDumpingNow) {
              for (let i = worldCrates.length - 1; i >= 0; i--) {
                const c = worldCrates[i];
                if (
                  c.state === 'grounded' &&
                  c.kind !== 'medical' &&
                  canLoadCrateIntoDumpTruck(mountedTank.storedCrates.length, isDumpingNow, true)
                ) {
                  if (getPlanetShortestDistance(c.x, c.z, mountedTank.x, mountedTank.z) < 3.1) {
                    mountedTank.storedCrates.push(c.kind);
                    scene.remove(c.mesh);
                    worldCrates.splice(i, 1);
                    soundEngine.playPickup();
                  }
                }
              }
            }

            // Auto-unload stored crates when passing next to Blue Stacking Pad
            if (
              mountedTank.storedCrates.length > 0 &&
              getPlanetShortestDistance(mountedTank.x, mountedTank.z, blueBase.padX, blueBase.padZ) < 5.6
            ) {
              if (isTruck) {
                if (
                  (mountedTank.dumpAnimTimer ?? 0) <= 0 &&
                  chooseNextPadSlotIndex(bluePadSlots, buildOrder) !== -1
                ) {
                  startDumpTruckHydraulicUnload(mountedTank, 'pad');
                }
              } else {
                while (mountedTank.storedCrates.length > 0) {
                  const kind = mountedTank.storedCrates[0];
                  if (!addCrateToPadSlots('blue', kind)) break;
                  mountedTank.storedCrates.shift();
                  score += 35;
                }
                soundEngine.playPickup();
              }
            }

            // Keep playerUnit position synced to the Vehicle
            playerUnit.x = mountedTank.x;
            playerUnit.z = mountedTank.z;

            if (!isPlane && !isTruck) {
              const isFiringNow = Boolean(isPointerDown || keys['Space']);
              if (mountedTank.recoilTimer > 0) {
                mountedTank.recoilTimer = Math.max(0, mountedTank.recoilTimer - dt);
              }

              if (isFiringNow && mountedTank.recoilTimer <= 0.02) {
                mountedTank.recoilTimer = 0.24;
                soundEngine.playTankCannonFire();
                const totalYaw = mountedTank.hullYaw + mountedTank.turretYaw;
                scratchSpawnDir.set(Math.cos(totalYaw), 0, -Math.sin(totalYaw));
                const rightDirX = Math.sin(totalYaw);
                const rightDirZ = Math.cos(totalYaw);
                const sideOffset = (mountedTank.isSuper ? 2.75 : 2.45) * 0.42;
                const tankClimbNow = evaluateTankClimbableObstacleElevation(
                  mountedTank.x,
                  mountedTank.z,
                  mountedTank.hullYaw,
                  activeMapProps,
                );
                const tankGroundY =
                  getTerrainElevation(mountedTank.x, mountedTank.z) + tankClimbNow.climbY;
                scratchSpawnOrigin.set(
                  wrapPlanetCoord(
                    mountedTank.x + scratchSpawnDir.x * 3.7 + rightDirX * sideOffset,
                  ),
                  tankGroundY + (mountedTank.isSuper ? 3.45 : 3.08),
                  wrapPlanetCoord(
                    mountedTank.z + scratchSpawnDir.z * 3.7 + rightDirZ * sideOffset,
                  ),
                );
                fireProjectile(
                  mountedTank.team === 'blue',
                  'TankCannon',
                  scratchSpawnOrigin,
                  scratchSpawnDir,
                  46,
                  mountedTank.isSuper ? 26 : 18,
                );
                if (activeMuzzleRaycastResult?.hit) {
                  spawnRaycastSurfaceNormalImpact(activeMuzzleRaycastResult, true);
                }
                blitzExplosionSystem.spawnBlitzMuzzleFlash(
                  scratchSpawnOrigin,
                  scratchSpawnDir,
                  mountedTank.isSuper ? 1.45 : 1.22,
                  'cannon',
                );
                recoilOffset.x -= scratchSpawnDir.x * 0.03;
                recoilOffset.z -= scratchSpawnDir.z * 0.03;
                shakeTrauma = Math.min(1, shakeTrauma + 0.05);
              }
            }
          } else if (ridingTramCarIdx !== null && playerUnit.alive) {
            // =================================================================
            // A2. RIDING CITY TRAM MODE (PASSENGER + MAX 1 CARRIED CRATE IN HAND)
            // =================================================================
            const tramStateNow = cityTram.getState();
            const activeCar = ridingTramCarIdx === 0 ? tramStateNow.car1 : tramStateNow.car2;
            playerUnit.x = wrapPlanetCoord(activeCar.x);
            playerUnit.z = wrapPlanetCoord(activeCar.z);
            playerUnit.vx = activeCar.forwardX * CITY_TRAM_SPEC.cruiseSpeed;
            playerUnit.vz = activeCar.forwardZ * CITY_TRAM_SPEC.cruiseSpeed;
            playerUnit.yaw = activeCar.yaw;
            const tramFloorY = getTerrainElevation(playerUnit.x, playerUnit.z) + 0.45;
            playerUnit.root.position.set(playerUnit.x, tramFloorY, playerUnit.z);
            playerUnit.bodyGroup.rotation.set(0, playerUnit.yaw + Math.PI / 2, 0);
            playerUnit.root.visible = true;
            playerUnit.overheadCrateGroup.visible = playerUnit.carryingCrate !== 'none';
            if (playerUnit.hp < playerUnit.maxHp) {
              playerUnit.hp = Math.min(playerUnit.maxHp, playerUnit.hp + dt * 8.5);
            }
            activeSpeed = CITY_TRAM_SPEC.cruiseSpeed;
            soundEngine.updateVehicleMovementLoop(activeSpeed * 0.65, false, false);
          } else if (playerUnit.alive) {
            // =================================================================
            // B. ON-FOOT CHIBI BUDDY CHARACTER MODE + OBJECT COLLISION RESOLUTION
            // =================================================================
            soundEngine.updateVehicleMovementLoop(0, false, false);
            const spec = BUDDY_CLASSES[playerUnit.classId];
            const playerRoadBoost = evaluateRoadSurfaceSpeedBoost(playerUnit.x, playerUnit.z);
            const moveSpeed = computeBuddyFootMoveSpeed({
              isPlayer: true,
              classSpeedMultiplier: spec.speedMultiplier,
              carryingCrate: playerUnit.carryingCrate !== 'none',
              isBoosting,
              onRoadOrZebra: playerRoadBoost.onRoadOrZebra,
            });

            const inputLen = Math.hypot(moveX, moveZ);
            // Ghost Movement Fix: Player unit is NEVER moved by AI pathfinding and immediately halts (vx = 0, vz = 0) when no WASD/Arrow keys are pressed!
            if (inputLen > 0.01) {
              if (playerUnit.isSitting && activeSeatedSpot) {
                playerUnit.x = wrapPlanetCoord(
                  activeSeatedSpot.x + Math.cos(activeSeatedSpot.yaw) * 0.88,
                );
                playerUnit.z = wrapPlanetCoord(
                  activeSeatedSpot.z - Math.sin(activeSeatedSpot.yaw) * 0.88,
                );
                activeSeatedSpot = null;
                isOrbitingSeatedCamera = false;
                playerUnit.isSitting = false;
              }
              playerUnit.vx = (moveX / inputLen) * moveSpeed;
              playerUnit.vz = (moveZ / inputLen) * moveSpeed;
              playerUnit.x = wrapPlanetCoord(playerUnit.x + playerUnit.vx * dt);
              playerUnit.z = wrapPlanetCoord(playerUnit.z + playerUnit.vz * dt);
            } else {
              playerUnit.vx = 0;
              playerUnit.vz = 0;
              if (playerUnit.isSitting && activeSeatedSpot) {
                playerUnit.x = activeSeatedSpot.x;
                playerUnit.z = activeSeatedSpot.z;
                playerUnit.yaw = activeSeatedSpot.yaw;
              }
            }

            // Resolve character collision against solid buildings/pipes/trees and pushable props/crates (skip when seated on a bench)
            if (!(playerUnit.isSitting && activeSeatedSpot)) {
              resolveMoverWorldCollisions(playerUnit, 'player_foot', false, 0.72, 2.2, timeSec, true);
            }
            // Enforce Concrete Wall Boundary (x = -76.2) between Lobby and City:
            // - In Lobby scene (worldModeRef.current === 'lobby'), clamp player inside Lobby (x <= -76.55)
            // - In City scene (warzone/safezone), prevent walking through the concrete wall into Lobby (x >= -75.85)
            if (worldModeRef.current === 'lobby') {
              if (playerUnit.x > LOBBY_SAFEZONE_BOUNDS.maxX - 0.35) {
                playerUnit.x = LOBBY_SAFEZONE_BOUNDS.maxX - 0.35;
              }
            } else if (
              playerUnit.x < LOBBY_SAFEZONE_BOUNDS.maxX + 0.35 &&
              Math.abs(playerUnit.z) < LOBBY_SAFEZONE_BOUNDS.maxZ
            ) {
              playerUnit.x = LOBBY_SAFEZONE_BOUNDS.maxX + 0.35;
            }
            if (inputLen <= 0.01) {
              playerUnit.vx = 0;
              playerUnit.vz = 0;
            }

            // Lobby Faction Portal Circles DO NOT auto-teleport on step!
            // Strictly evaluated ONLY when worldModeRef.current === 'lobby' and inside Lobby concrete wall (x <= -76.2).
            const steppedPortalNow =
              worldModeRef.current === 'lobby'
                ? evaluateLobbyFactionPortalStep(
                    playerUnit.x,
                    playerUnit.z,
                    Math.random,
                    worldModeRef.current,
                  )
                : null;
            if (steppedPortalNow && playerUnit.team !== steppedPortalNow.team) {
              releaseActiveNearSessionBaseAndHarvesters();
              playerUnit.team = steppedPortalNow.team;
              syncUnitFootRingTeamColor(playerUnit);
              emitHudImmediately();
            } else {
              syncUnitFootRingTeamColor(playerUnit);
            }

            // Step Team Buddies Vertical Jump & Gravity Arc with 0.1s Jump Input Buffer ([Space] on foot)
            const jumpStep = stepBuddyJumpPhysicsWithBuffer(
              playerUnit.jumpOffset,
              playerUnit.vy,
              playerUnit.isGrounded,
              playerUnit.jumpBufferTimer ?? 0,
              false,
              spec.jumpMultiplier,
              playerUnit.carryingCrate !== 'none',
              dt,
            );
            playerUnit.jumpOffset = jumpStep.jumpOffset;
            playerUnit.vy = jumpStep.vy;
            playerUnit.isGrounded = jumpStep.isGrounded;
            playerUnit.jumpBufferTimer = jumpStep.jumpBufferTimer;
            if (jumpStep.justJumped) {
              soundEngine.playJump();
              spawnBurstParticles(
                playerUnit.x,
                getTerrainElevation(playerUnit.x, playerUnit.z) + 0.18,
                playerUnit.z,
                6,
              );
            } else if (jumpStep.justLanded) {
              soundEngine.playHeavyThud(3.2, false);
              spawnBurstParticles(
                playerUnit.x,
                getTerrainElevation(playerUnit.x, playerUnit.z) + 0.15,
                playerUnit.z,
                5,
              );
            }

            activeSpeed = Math.hypot(playerUnit.vx, playerUnit.vz);

            // Rotate Character toward Mouse Crosshair when aiming/equipped with a ranged weapon in Warzone,
            // or toward WASD movement direction when unarmed / carrying a crate / in Lobby & Safezone
            const isPeacefulPlayerZone =
              !qcForceWeaponVisible &&
              (worldModeRef.current === 'lobby' ||
                worldModeRef.current === 'safezone' ||
                cityArenaMode === 'safezone');
            const aimDx = getPlanetShortestDelta(aimWorldPoint.x, playerUnit.x);
            const aimDz = getPlanetShortestDelta(aimWorldPoint.z, playerUnit.z);
            const isArmedAimStance =
              !isPeacefulPlayerZone &&
              playerUnit.carryingCrate === 'none' &&
              playerUnit.weaponId !== 'unarmed' &&
              playerUnit.weaponId !== 'fishing_rod';
            if ((isPointerDown || isArmedAimStance) && Math.hypot(aimDx, aimDz) > 0.2) {
              playerUnit.yaw = Math.atan2(-aimDz, aimDx);
            } else if (inputLen > 0.01) {
              playerUnit.yaw = Math.atan2(-playerUnit.vz, playerUnit.vx);
            }

            // Player Attack: Unarmed Fist Punch Combo ('unarmed'), Continuous Raycast Laser Beam ('laser'), OR Tactical Projectiles ('pistol' | 'rifle' | 'gatling' | 'bazooka')
            // Safe Shield Zone (Zero Visual Pollution): weapon stays visible in hand, but trigger is locked (no bullets, no laser beam, no muzzle flash, no ammo drain) inside Lobby Safezone or Public Crate Pad Shield!
            const playerWeaponTriggerLocked =
              isPeacefulPlayerZone ||
              isUnitWeaponTriggerLockedInSafeShield(
                playerUnit.x,
                playerUnit.z,
                playerUnit.team,
              );
            if (playerWeaponTriggerLocked) {
              playerUnit.isFiringLaser = false;
            }
            if (
              isPeacefulPlayerZone &&
              playerUnit.weaponId !== 'unarmed' &&
              playerUnit.weaponId !== 'fishing_rod'
            ) {
              playerUnit.weaponId = 'unarmed';
            }
            if (playerUnit.shootCooldown > 0) {
              playerUnit.shootCooldown = Math.max(0, playerUnit.shootCooldown - dt);
            }
            if (
              isPointerDown &&
              playerUnit.carryingCrate === 'none' &&
              playerUnit.weaponId === 'fishing_rod' &&
              playerUnit.shootCooldown <= 0
            ) {
              if (Math.hypot(aimDx, aimDz) > 0.2) {
                playerUnit.yaw = Math.atan2(-aimDz, aimDx);
              }
              playerUnit.shootCooldown = 1.25;
              playerUnit.weaponRecoil = 0.85;
              soundEngine.playPickup();
              const fwdX = Math.cos(playerUnit.yaw);
              const fwdZ = -Math.sin(playerUnit.yaw);
              const castX = wrapPlanetCoord(playerUnit.x + fwdX * 3.4);
              const castZ = wrapPlanetCoord(playerUnit.z + fwdZ * 3.4);
              const castY = getTerrainElevation(castX, castZ) + 0.3;
              spawnBurstParticles(castX, castY, castZ, 12);
            } else if (
              isPointerDown &&
              !playerWeaponTriggerLocked &&
              playerUnit.carryingCrate === 'none' &&
              playerUnit.weaponId === 'laser'
            ) {
              // CONTINUOUS RAYCAST LASER BEAM:
              // Updates every single frame while held down — rotates character smoothly toward aimWorldPoint,
              // locks beam startPoint to barrel muzzle tip, and sweeps continuously without discrete bullet projectiles!
              if (Math.hypot(aimDx, aimDz) > 0.12) {
                playerUnit.yaw = Math.atan2(-aimDz, aimDx);
              }
              playerUnit.isFiringLaser = true;
              playerUnit.weaponRecoil = 0.28 + 0.12 * Math.sin(timeSec * 46.0);
              playerUnit.laserSoundTickTimer = (playerUnit.laserSoundTickTimer ?? 0) - dt;
              if (playerUnit.laserSoundTickTimer <= 0) {
                playerUnit.laserSoundTickTimer = 0.13;
                soundEngine.playLaserGunFire();
              }
              playerUnit.laserAmmoTickTimer = (playerUnit.laserAmmoTickTimer ?? 0) + dt;
              if (playerUnit.laserAmmoTickTimer >= LASER_AMMO_CONSUME_INTERVAL_SEC) {
                playerUnit.laserAmmoTickTimer %= LASER_AMMO_CONSUME_INTERVAL_SEC;
                playerUnit.tacticalLoadout = consumeActiveWeaponAmmoOnShot(
                  playerUnit.tacticalLoadout,
                );
                syncUnitFieldsFromLoadout(playerUnit);
              }
              shakeTrauma = Math.min(1, shakeTrauma + 0.08 * dt);
            } else if (
              isPointerDown &&
              !playerWeaponTriggerLocked &&
              playerUnit.carryingCrate === 'none' &&
              playerUnit.shootCooldown <= 0
            ) {
              if (Math.hypot(aimDx, aimDz) > 0.2) {
                playerUnit.yaw = Math.atan2(-aimDz, aimDx);
              }
              const wId = playerUnit.weaponId;
              if (wId === 'unarmed') {
                performBuddyMeleeAttack(playerUnit, 'punch');
              } else {
                const isBazooka = wId === 'bazooka';
                const isGatling = wId === 'gatling';
                const isRifle = wId === 'rifle' || isGatling;
                playerUnit.shootCooldown = isBazooka
                  ? 0.52
                  : isGatling
                  ? 0.065
                  : isRifle
                  ? 0.11
                  : 0.19;
                playerUnit.weaponRecoil = 1.0;
                if (isBazooka) {
                  soundEngine.playBazookaLaunch();
                } else if (isGatling) {
                  soundEngine.playGatlingGunFire();
                } else if (isRifle) {
                  soundEngine.playTacticalFirearm('rifle');
                } else {
                  soundEngine.playTacticalFirearm('pistol');
                }

                const fwdX = Math.cos(playerUnit.yaw);
                const fwdZ = -Math.sin(playerUnit.yaw);
                const rightX = Math.sin(playerUnit.yaw);
                const rightZ = Math.cos(playerUnit.yaw);
                scratchSpawnDir.set(fwdX, 0, fwdZ);
                const playerTerrainY =
                  getTerrainElevation(playerUnit.x, playerUnit.z) + playerUnit.jumpOffset;

                if (isBazooka) {
                  // Shoulder-Mounted Rocket Launcher: Muzzle sparks in front + Backblast behind right shoulder!
                  const shoulderX = playerUnit.x + rightX * 0.54;
                  const shoulderZ = playerUnit.z + rightZ * 0.54;
                  const frontMuzzleX = wrapPlanetCoord(shoulderX + fwdX * 1.38);
                  const frontMuzzleZ = wrapPlanetCoord(shoulderZ + fwdZ * 1.38);
                  const rearVentX = wrapPlanetCoord(shoulderX - fwdX * 1.18);
                  const rearVentZ = wrapPlanetCoord(shoulderZ - fwdZ * 1.18);

                  // 1. Front Muzzle Sparks around Rocket Warhead
                  spawnDirectionalSparks(frontMuzzleX, playerTerrainY + 1.82, frontMuzzleZ, fwdX, fwdZ, 10, 14, 0.7);
                  // 2. Rear Exhaust Backblast Plume behind Right Shoulder
                  spawnDirectionalSparks(rearVentX, playerTerrainY + 1.82, rearVentZ, -fwdX, -fwdZ, 16, 18, 0.85);

                  scratchSpawnOrigin.set(frontMuzzleX, playerTerrainY + 1.82, frontMuzzleZ);
                  fireProjectile(
                    playerUnit.team === 'blue',
                    'Bazooka',
                    scratchSpawnOrigin,
                    scratchSpawnDir,
                    38,
                    28,
                  );
                  if (activeMuzzleRaycastResult?.hit) {
                    spawnRaycastSurfaceNormalImpact(activeMuzzleRaycastResult, true);
                  }
                  blitzExplosionSystem.spawnBlitzMuzzleFlash(
                    scratchSpawnOrigin,
                    scratchSpawnDir,
                    0.92,
                    'bazooka',
                  );
                  scratchRearVentPos.set(rearVentX, playerTerrainY + 1.82, rearVentZ);
                  scratchNegDir.copy(scratchSpawnDir).negate();
                  blitzExplosionSystem.spawnBlitzMuzzleFlash(
                    scratchRearVentPos,
                    scratchNegDir,
                    0.72,
                    'bazooka',
                  );
                  recoilOffset.x -= fwdX * 0.16;
                  recoilOffset.z -= fwdZ * 0.16;
                  shakeTrauma = Math.min(1, shakeTrauma + 0.22);
                } else if (isGatling) {
                  // TITAN-6 Rotary Gatling Gun: High-RPM 7.62x51mm rotary burst + Brass Shell Casings + Rotary Barrel Spin!
                  const muzzleX = wrapPlanetCoord(playerUnit.x + fwdX * 1.52 + rightX * 0.14);
                  const muzzleZ = wrapPlanetCoord(playerUnit.z + fwdZ * 1.52 + rightZ * 0.14);
                  scratchSpawnOrigin.set(muzzleX, playerTerrainY + 1.44, muzzleZ);
                  if (playerUnit.rig.gatlingGroup) {
                    playerUnit.rig.gatlingGroup.rotation.z = Math.sin(timeSec * 65.0) * 0.09;
                  }
                  spawnGatlingBrassAndSparks(
                    muzzleX,
                    playerTerrainY + 1.44,
                    muzzleZ,
                    fwdX,
                    fwdZ,
                    rightX,
                    rightZ,
                  );
                  blitzExplosionSystem.spawnBlitzMuzzleFlash(
                    scratchSpawnOrigin,
                    scratchSpawnDir,
                    0.64,
                    'minigun',
                  );
                  fireProjectile(
                    playerUnit.team === 'blue',
                    'Titan6Gatling',
                    scratchSpawnOrigin,
                    scratchSpawnDir,
                    64,
                    13,
                  );
                  if (activeMuzzleRaycastResult?.hit) {
                    spawnRaycastSurfaceNormalImpact(activeMuzzleRaycastResult, false);
                    spawnDirectionalSparks(
                      activeMuzzleRaycastResult.point.x,
                      activeMuzzleRaycastResult.point.y,
                      activeMuzzleRaycastResult.point.z,
                      -fwdX,
                      -fwdZ,
                      8,
                      14,
                      0.85,
                    );
                  }
                  recoilOffset.x -= fwdX * 0.045;
                  recoilOffset.z -= fwdZ * 0.045;
                  shakeTrauma = Math.min(1, shakeTrauma + 0.06);
                } else if (isRifle) {
                  // Tactical Assault Rifle: Fast carbine fire + muzzle brake flash & smoke puff
                  const muzzleX = wrapPlanetCoord(playerUnit.x + fwdX * 1.42 + rightX * 0.12);
                  const muzzleZ = wrapPlanetCoord(playerUnit.z + fwdZ * 1.42 + rightZ * 0.12);
                  scratchSpawnOrigin.set(muzzleX, playerTerrainY + 1.46, muzzleZ);
                  spawnDirectionalSparks(muzzleX, playerTerrainY + 1.46, muzzleZ, fwdX, fwdZ, 5, 11, 0.45);
                  blitzExplosionSystem.spawnBlitzMuzzleFlash(
                    scratchSpawnOrigin,
                    scratchSpawnDir,
                    0.46,
                    'rifle',
                  );
                  fireProjectile(
                    playerUnit.team === 'blue',
                    'BlitzAssaultRifle',
                    scratchSpawnOrigin,
                    scratchSpawnDir,
                    52,
                    9,
                  );
                  if (activeMuzzleRaycastResult?.hit) {
                    spawnRaycastSurfaceNormalImpact(activeMuzzleRaycastResult, false);
                  }
                  recoilOffset.x -= fwdX * 0.05;
                  recoilOffset.z -= fwdZ * 0.05;
                  shakeTrauma = Math.min(1, shakeTrauma + 0.06);
                } else {
                  // Tactical Pistol: Two-handed center-chest precision fire + muzzle flash & smoke puff
                  const muzzleX = wrapPlanetCoord(playerUnit.x + fwdX * 1.15 + rightX * 0.07);
                  const muzzleZ = wrapPlanetCoord(playerUnit.z + fwdZ * 1.15 + rightZ * 0.07);
                  scratchSpawnOrigin.set(muzzleX, playerTerrainY + 1.54, muzzleZ);
                  spawnDirectionalSparks(muzzleX, playerTerrainY + 1.54, muzzleZ, fwdX, fwdZ, 4, 9, 0.38);
                  blitzExplosionSystem.spawnBlitzMuzzleFlash(
                    scratchSpawnOrigin,
                    scratchSpawnDir,
                    0.36,
                    'pistol',
                  );
                  fireProjectile(
                    playerUnit.team === 'blue',
                    'BlitzPistol',
                    scratchSpawnOrigin,
                    scratchSpawnDir,
                    46,
                    11,
                  );
                  if (activeMuzzleRaycastResult?.hit) {
                    spawnRaycastSurfaceNormalImpact(activeMuzzleRaycastResult, false);
                  }
                  shakeTrauma = Math.min(1, shakeTrauma + 0.04);
                }
                playerUnit.tacticalLoadout = consumeActiveWeaponAmmoOnShot(
                  playerUnit.tacticalLoadout,
                );
                syncUnitFieldsFromLoadout(playerUnit);
              }
            }
          }

          // Update AI-Driven Open-Top Tanks ONLY in 'match' mode (and NOT in Safezone City Mode)!
          if (currentPlayMode === 'match' && cityArenaMode !== 'safezone') {
            for (const t of tanks) {
              if (!t.occupiedByPlayer && t.occupiedByAiId !== null && t.hp > 0) {
                const targetX = t.team === 'blue' ? redBase.hqX : blueBase.hqX;
                const targetZ = t.team === 'blue' ? redBase.hqZ + 4 : blueBase.hqZ - 4;
                const steer = computeAStarSteeringDirection(t, targetX, targetZ, dt, true, false);
                if (steer.distToGoal > 4.0) {
                  const prevX = t.x;
                  const prevZ = t.z;
                  const prevYaw = t.hullYaw;
                  const aiTankRoad = evaluateRoadSurfaceSpeedBoost(t.x, t.z);
                  const desiredTankSpeed = AI_TANK_BASE_DRIVE_SPEED * aiTankRoad.speedMultiplier;
                  const tankStep = computeAiPathfindingMovementStep({
                    steerDirX: steer.dirX,
                    steerDirZ: steer.dirZ,
                    distToGoal: steer.distToGoal,
                    desiredSpeed: desiredTankSpeed,
                    dt,
                    stopRadius: 4.0,
                    slowdownRadius: 7.2,
                  });
                  t.hullYaw = Math.atan2(-steer.dirZ, steer.dirX);
                  t.vx = tankStep.vx;
                  t.vz = tankStep.vz;
                  t.x = wrapPlanetCoord(t.x + tankStep.stepDx);
                  t.z = wrapPlanetCoord(t.z + tankStep.stepDz);
                  resolveMoverWorldCollisions(t, `ai_tank_${t.id}`, true, 1.85, 9.5, timeSec, false);
                  t.root.position.set(t.x, getTerrainElevation(t.x, t.z), t.z);
                  t.bodyGroup.rotation.y = t.hullYaw;
                  spawnRoadBoostDustWindParticles(
                    `ai_tank_${t.id}`,
                    aiTankRoad.onRoadOrZebra,
                    true,
                    t.x,
                    t.z,
                    t.vx,
                    t.vz,
                    dt,
                    true,
                    t.isSuper ? 1.54 : 1.38,
                  );
                  recordTankMovementAndTracks(t, prevX, prevZ, prevYaw);
                }
                if (t.recoilTimer > 0) {
                  t.recoilTimer = Math.max(0, t.recoilTimer - dt);
                } else {
                  t.recoilTimer = 1.1;
                  const sDir = new THREE.Vector3(0, 0, -1);
                  const tankGroundY = getTerrainElevation(t.x, t.z);
                  const aiMuzzlePos = new THREE.Vector3(t.x, tankGroundY + 1.35, wrapPlanetCoord(t.z - 2.0));
                  fireProjectile(
                    true,
                    'TankCannon',
                    aiMuzzlePos,
                    sDir,
                    42,
                    16,
                  );
                  blitzExplosionSystem.spawnBlitzMuzzleFlash(aiMuzzlePos, sDir, 1.05, 'cannon');
                }
              }
            }
          }

          // ===================================================================
          // C. UPDATE BUDDIES (SMART UTILITY AI FOR BUILT CHARACTERS & 4v4 COMMANDERS)
          // ===================================================================
          for (const b of buddyUnits) {
            if (!b.isPlayer && cityArenaMode === 'safezone') {
              b.root.visible = false;
              continue;
            }
            if (!b.alive) {
              const ownerIdx = clamp(b.ownerCommanderId, 0, COMMANDERS_PER_TEAM - 1);
              const ownerPlots = b.team === 'blue' ? blueCommanderBases : redCommanderBases;
              const ownerPlot = ownerPlots[ownerIdx];
              const canRespawn =
                currentPlayMode !== 'match' ||
                canBuddyUnitRespawnAtBase(
                  b.isStarterCommanderUnit,
                  ownerPlot?.destroyed ?? false,
                  ownerPlot?.buildingHp ?? 400,
                );
              if (b.rig.customGlbController && b.respawnTimer > 1.2) {
                b.root.visible = true;
                b.overheadCrateGroup.visible = false;
                if (b.stunMesh) b.stunMesh.visible = false;
                const terrainY = getTerrainElevation(b.x, b.z);
                b.root.position.set(b.x, terrainY, b.z);
                b.bodyGroup.position.y = 0;
                b.bodyGroup.rotation.set(0, b.yaw + Math.PI / 2, 0);
                if (b.hitFlashTimer > 0) {
                  b.hitFlashTimer = Math.max(0, b.hitFlashTimer - dt);
                  b.headMesh.material = flashWhiteMat;
                } else {
                  b.headMesh.material = (b.headMesh.userData.defaultMat as THREE.Material) || matSkin;
                }
                updateCharacterWeaponStance(
                  b.rig,
                  b.weaponId,
                  b.walkCycle,
                  false,
                  false,
                  0,
                  0,
                  0,
                  'right',
                  0,
                  0,
                  0.76,
                  0,
                  false,
                  b.id % 3 === 2 ? 'back_headshot' : b.id % 3 === 1 ? 'right' : 'front',
                );
              } else {
                b.root.visible = false;
              }
              if (!canRespawn) {
                if (b.respawnTimer > 0) {
                  b.respawnTimer = Math.max(0, b.respawnTimer - dt);
                }
                continue;
              }
              b.respawnTimer -= dt;
              if (b.respawnTimer <= 0) {
                b.alive = true;
                b.hp = b.maxHp;
                b.isFrozen = false;
                b.carryingCrate = 'none';
                b.overheadCrateGroup.visible = false;
                if (b.team === 'blue' && ownerIdx === 0) {
                  const ownerPad = blueBase.commanderPads[0];
                  b.x = ownerPad.worldX + (Math.random() - 0.5) * 2.6;
                  b.z = ownerPad.worldZ - 4.2 + (Math.random() - 0.5) * 1.6;
                } else {
                  const dropSpot = pickRandomWarzoneDropCoord();
                  b.x = dropSpot.x;
                  b.z = dropSpot.z;
                }
                b.root.visible = true;
              }
              continue;
            }

            const ridingTank =
              b.isPlayer && mountedTank
                ? mountedTank
                : tanks.find(
                    (t) =>
                      t.hp > 0 &&
                      (t.occupiedByAiId === b.id || (b.isPlayer && t.occupiedByPlayer)),
                  );
            if (ridingTank) {
              b.x = ridingTank.x;
              b.z = ridingTank.z;
              b.root.visible = false;
              b.saluteSign.sprite.visible = false;
              continue;
            }

            if (b.saluteTimer > 0) {
              b.saluteTimer = Math.max(0, b.saluteTimer - dt);
              if (b.saluteTimer <= 0) {
                b.saluteSign.sprite.visible = false;
              }
            }

            if (b.isFrozen) {
              b.frozenTimer -= dt;
              if (b.frozenTimer <= 0) {
                b.isFrozen = false;
              }
            }

            if (b.classId === 'Medic' && b.hp < b.maxHp) {
              b.hp = Math.min(b.maxHp, b.hp + dt * 1.5);
            }

            const playerOwnedSquadCount = buddyUnits.filter(
              (u) => u.team === 'blue' && u.ownerCommanderId === 0 && u.alive,
            ).length;
            const isNearHarvesterSwarmUnit = sessionHarvesterUnitIds.includes(b.id);
            const shouldRunSmartAi =
              !b.isPlayer &&
              !b.isFrozen &&
              (currentPlayMode === 'match' ||
                isNearHarvesterSwarmUnit ||
                (b.team === 'blue' && b.ownerCommanderId === 0 && playerOwnedSquadCount > 1));

            if (shouldRunSmartAi) {
              const spec = BUDDY_CLASSES[b.classId];
              const aiRoadBoost = evaluateRoadSurfaceSpeedBoost(b.x, b.z);
              const aiSpeed = computeBuddyFootMoveSpeed({
                isPlayer: false,
                classSpeedMultiplier: spec.speedMultiplier,
                carryingCrate: b.carryingCrate !== 'none',
                isBoosting: false,
                onRoadOrZebra: aiRoadBoost.onRoadOrZebra,
              });
              const ownerIdx = clamp(b.ownerCommanderId, 0, COMMANDERS_PER_TEAM - 1);
              const ownerBase = b.team === 'blue' ? blueBase : redBase;
              const ownerPad = ownerBase.commanderPads[ownerIdx] ?? ownerBase.commanderPads[0];
              const ownerSlots = b.team === 'blue' ? bluePadSlotsList[ownerIdx] : redPadSlotsList[ownerIdx];
              const enemyHqX = b.team === 'blue' ? redBase.hqX : blueBase.hqX;
              const enemyHqZ = b.team === 'blue' ? redBase.hqZ : blueBase.hqZ;
              const ownerTurret = getBaseSkyshieldTurrets(ownerBase.baseGroup)[ownerIdx];
              const ownerHasBuiltTurret = Boolean(ownerTurret && ownerTurret.isBuilt && ownerTurret.hp > 0);
              const isAiCmd = !(b.team === 'blue' && ownerIdx === 0);

              const {
                ownerTargetCount,
                nearestWoundedAlly,
                woundedAllyDist,
                nearestEnemy,
                bestCrate,
                nearestFreeCrateDist,
                nearestWeaponPickup,
                freeTank,
                nearestEmptyVehicleDist,
                aiDecision,
              } = evaluateSquadAiUnitPerceptionAndDecision({
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
                onDropWrongCarriedCrate: (dropKind) => {
                  b.carryingCrate = 'none';
                  b.overheadCrateGroup.visible = false;
                  spawnWorldCrate(
                    dropKind,
                    wrapPlanetCoord(b.x + 1.35),
                    wrapPlanetCoord(b.z - 0.85),
                    true,
                  );
                },
              });

              const isPureContractHarvester =
                !b.isPlayer &&
                (b.assignedRole === 'HARVEST' || sessionHarvesterUnitIds.includes(b.id));
              if (isPureContractHarvester) {
                b.weaponId = 'unarmed';
                b.weaponName = 'Pure Harvester (Unarmed)';
                b.ammo = 0;
              }
              const currentPadCrateCount = ownerSlots.filter((s) => s !== 'empty').length;
              const harvesterLifecycle = evaluateContractHarvesterLifecycle({
                hasActiveBuildContract: isAiCmd ? true : hasActiveBuildContract,
                currentPadCrates: currentPadCrateCount,
                targetContractCrates: ownerTargetCount,
              });

              let goalX = b.x;
              let goalZ = b.z;

              if (isPureContractHarvester && harvesterLifecycle.stage === 'STANDBY') {
                // Stage 1: STANDBY AT BASE (No Active Build Contract) -> Stay inside Base near Stacking Pad/Kiosk!
                if (b.carryingCrate !== 'none') {
                  if (!addCrateToPadSlots(b.team, b.carryingCrate, ownerIdx, false)) {
                    spawnWorldCrate(b.carryingCrate, ownerPad.worldX - 2.4, ownerPad.worldZ - 1.8, true);
                  }
                  b.carryingCrate = 'none';
                  b.overheadCrateGroup.visible = false;
                }
                const sbPos = computeHarvesterBaseStandbyPosition(
                  ownerPad.worldX,
                  ownerPad.worldZ,
                  b.team,
                  b.id % MAX_HARVESTERS_PER_BASE,
                );
                goalX = wrapPlanetCoord(sbPos.x);
                goalZ = wrapPlanetCoord(sbPos.z);
                if (b.saluteTimer <= 0.2) {
                  b.saluteTimer = 2.5;
                  b.saluteSign.updateText(
                    harvesterLifecycle.statusLabel,
                    'SELECT RECIPE IN KIOSK [B]',
                    '#facc15',
                    1,
                  );
                  b.saluteSign.sprite.visible = true;
                }
              } else if (
                (aiDecision.action === 'DELIVER_TO_OWNER_PAD' || isPureContractHarvester) &&
                b.carryingCrate !== 'none'
              ) {
                goalX = ownerPad.worldX;
                goalZ = ownerPad.worldZ;
                if (getPlanetShortestDistance(b.x, b.z, ownerPad.worldX, ownerPad.worldZ) < 2.6) {
                  if (addCrateToPadSlots(b.team, b.carryingCrate, ownerIdx, false)) {
                    b.carryingCrate = 'none';
                    b.overheadCrateGroup.visible = false;
                    if (b.team === 'blue') score += 25;
                    const updatedCount = (
                      b.team === 'blue' ? bluePadSlotsList[ownerIdx] : redPadSlotsList[ownerIdx]
                    ).filter((s) => s !== 'empty').length;
                    if (
                      (isAiCmd || isPureContractHarvester || hasActiveBuildContract) &&
                      updatedCount >= ownerTargetCount
                    ) {
                      craftFromCommanderPad(b.team, ownerIdx, !isAiCmd);
                    }
                  } else {
                    // Pad is completely full (8/8 slots) -> gently set the crate down beside the pad!
                    const dropKind = b.carryingCrate;
                    b.carryingCrate = 'none';
                    b.overheadCrateGroup.visible = false;
                    spawnWorldCrate(
                      dropKind,
                      wrapPlanetCoord(ownerPad.worldX + 2.8),
                      wrapPlanetCoord(ownerPad.worldZ - 2.2),
                      true,
                    );
                  }
                }
              } else if (aiDecision.action === 'TRIGGER_OWNER_PAD_CRAFT') {
                goalX = ownerPad.worldX;
                goalZ = ownerPad.worldZ;
                if (getPlanetShortestDistance(b.x, b.z, ownerPad.worldX, ownerPad.worldZ) < 3.2) {
                  craftFromCommanderPad(b.team, ownerIdx, !isAiCmd);
                }
              } else if (
                (aiDecision.action === 'HARVEST_CRATE' || isPureContractHarvester) &&
                b.carryingCrate === 'none'
              ) {
                if (isPureContractHarvester && b.saluteTimer <= 0.2) {
                  b.saluteTimer = 2.5;
                  b.saluteSign.updateText(
                    harvesterLifecycle.statusLabel,
                    'MENGANGKUT KOTAK WARZONE',
                    '#b8ff3c',
                    1,
                  );
                  b.saluteSign.sprite.visible = true;
                }
                if (bestCrate) {
                  goalX = bestCrate.x;
                  goalZ = bestCrate.z;
                  if (nearestFreeCrateDist !== null && nearestFreeCrateDist < 1.85) {
                    b.carryingCrate = bestCrate.kind;
                    if (b.overheadCrateGroup.userData.blitzBoxKind !== bestCrate.kind) {
                      populateRealBlitzCrateBoxFromGlb(
                        b.overheadCrateGroup,
                        bestCrate.kind,
                        loadedBlitzAssets,
                        windUniforms,
                        isSoftwareGl,
                        UNIFIED_WORLD_CRATE_SIZE,
                      );
                    } else {
                      b.overheadCrateBox.material = getCrateFallbackMaterial(bestCrate.kind);
                    }
                    b.overheadCrateGroup.visible = true;
                    scene.remove(bestCrate.mesh);
                    const idx = worldCrates.indexOf(bestCrate);
                    if (idx !== -1) worldCrates.splice(idx, 1);
                  }
                } else {
                  // Stage near the owner's Stacking Pad while waiting for new field crates or pad slots
                  const sbPos = computeHarvesterBaseStandbyPosition(
                    ownerPad.worldX,
                    ownerPad.worldZ,
                    b.team,
                    b.id % MAX_HARVESTERS_PER_BASE,
                  );
                  goalX = wrapPlanetCoord(sbPos.x);
                  goalZ = wrapPlanetCoord(sbPos.z);
                }
              } else if (!isPureContractHarvester && aiDecision.action === 'EQUIP_GROUND_WEAPON') {
                if (nearestWeaponPickup) {
                  goalX = nearestWeaponPickup.x;
                  goalZ = nearestWeaponPickup.z;
                  for (let pi = worldPickups.length - 1; pi >= 0; pi--) {
                    const pk = worldPickups[pi];
                    if (pk.kind === 'weapon' && getPlanetShortestDistance(pk.x, pk.z, b.x, b.z) < 2.1) {
                      b.tacticalLoadout = equipOrSwapDroppedWeaponInLoadout(
                        b.tacticalLoadout,
                        pk.weaponName,
                        pk.remainingAmmo ?? 120,
                      ).updatedLoadout;
                      syncUnitFieldsFromLoadout(b);
                      scene.remove(pk.mesh);
                      worldPickups.splice(pi, 1);
                      break;
                    }
                  }
                } else {
                  // Unarmed Attacker returning home to its base Stacking Pad weapon stock area to wait for/pick up a weapon!
                  goalX = wrapPlanetCoord(ownerPad.worldX - (b.team === 'blue' ? 2.6 : -2.6));
                  goalZ = wrapPlanetCoord(ownerPad.worldZ - (b.team === 'blue' ? 2.4 : -2.4));
                }
              } else if (!isPureContractHarvester && aiDecision.action === 'HEAL_WOUNDED_ALLY' && nearestWoundedAlly) {
                goalX = nearestWoundedAlly.x;
                goalZ = nearestWoundedAlly.z;
                if (woundedAllyDist !== null && woundedAllyDist < 3.2) {
                  nearestWoundedAlly.hp = Math.min(
                    nearestWoundedAlly.maxHp,
                    nearestWoundedAlly.hp + dt * 14.0,
                  );
                }
              } else if (!isPureContractHarvester && aiDecision.action === 'MOUNT_VEHICLE' && freeTank) {
                goalX = freeTank.x;
                goalZ = freeTank.z;
                if (nearestEmptyVehicleDist !== null && nearestEmptyVehicleDist < 2.4) {
                  freeTank.occupiedByAiId = b.id;
                  freeTank.riderGroup.visible = freeTank.vehicleKind !== 'truck';
                  b.root.visible = false;
                }
              }

              let isAutonomousFollowerMode = false;
              if (!isPureContractHarvester && aiDecision.action === 'FOLLOW_COMMANDER') {
                // If a Follower is carrying a crate and comes near its owner's Stacking Pad (<= 14m) while the pad has space,
                // smartly deliver and stack the crate onto the pad using A* pathfinding!
                const distToOwnerPad = getPlanetShortestDistance(
                  b.x,
                  b.z,
                  ownerPad.worldX,
                  ownerPad.worldZ,
                );
                if (
                  b.carryingCrate !== 'none' &&
                  distToOwnerPad <= 14.0 &&
                  ownerSlots.some((s) => s === 'empty')
                ) {
                  goalX = ownerPad.worldX;
                  goalZ = ownerPad.worldZ;
                  if (distToOwnerPad < 2.6 && addCrateToPadSlots(b.team, b.carryingCrate, ownerIdx, false)) {
                    b.carryingCrate = 'none';
                    b.overheadCrateGroup.visible = false;
                    if (b.team === 'blue') score += 25;
                  }
                } else {
                  isAutonomousFollowerMode = true;
                  const leaderX = mountedTank ? mountedTank.x : playerUnit.x;
                  const leaderZ = mountedTank ? mountedTank.z : playerUnit.z;

                  // Proactive nearby (< 3.0m) item or crate awareness while escorting
                  const nearbyItemsAndCrates: Array<{
                    id: string;
                    kind: 'crate' | 'pickup';
                    x: number;
                    z: number;
                    dist: number;
                  }> = [];
                  if (b.carryingCrate === 'none') {
                    for (let ci = worldCrates.length - 1; ci >= 0; ci--) {
                      const wc = worldCrates[ci];
                      if (wc.state !== 'grounded' || wc.kind === 'medical') continue;
                      if (isCrateInsideOtherOrEnemyBase(wc.x, wc.z, b.team, ownerIdx)) continue;
                      const cd = getPlanetShortestDistance(wc.x, wc.z, b.x, b.z);
                      if (cd < 1.85) {
                        b.carryingCrate = wc.kind;
                        if (b.overheadCrateGroup.userData.blitzBoxKind !== wc.kind) {
                          populateRealBlitzCrateBoxFromGlb(
                            b.overheadCrateGroup,
                            wc.kind,
                            loadedBlitzAssets,
                            windUniforms,
                            isSoftwareGl,
                            UNIFIED_WORLD_CRATE_SIZE,
                          );
                        } else {
                          b.overheadCrateBox.material = getCrateFallbackMaterial(wc.kind);
                        }
                        b.overheadCrateGroup.visible = true;
                        scene.remove(wc.mesh);
                        worldCrates.splice(ci, 1);
                        break;
                      } else if (cd < 3.0) {
                        nearbyItemsAndCrates.push({
                          id: `crate_${wc.id}`,
                          kind: 'crate',
                          x: wc.x,
                          z: wc.z,
                          dist: cd,
                        });
                      }
                    }
                  }
                  for (const pk of worldPickups) {
                    if (pk.collected) continue;
                    const pd = getPlanetShortestDistance(pk.x, pk.z, b.x, b.z);
                    if (pd < 3.0) {
                      nearbyItemsAndCrates.push({
                        id: `pickup_${pk.id}`,
                        kind: 'pickup',
                        x: pk.x,
                        z: pk.z,
                        dist: pd,
                      });
                    }
                  }

                  const alliedFollowers = buddyUnits
                    .filter((u) => u.alive && u.team === b.team && u.id !== b.id && !u.isPlayer)
                    .map((u) => ({ id: String(u.id), x: u.x, z: u.z }));
                  const nearestEnemyInfo = nearestEnemy
                    ? {
                        x: nearestEnemy.x,
                        z: nearestEnemy.z,
                        dist: getPlanetShortestDistance(nearestEnemy.x, nearestEnemy.z, b.x, b.z),
                      }
                    : null;

                  // Step 1: Evaluate the Follower's desired tactical goal (goalX, goalZ) around the player (zero mirroring)
                  const previewEscort = evaluateAutonomousFollowerEscortStep({
                    followerId: String(b.id),
                    followerX: b.x,
                    followerZ: b.z,
                    followerVx: b.vx,
                    followerVz: b.vz,
                    followerYaw: b.yaw,
                    followerMaxSpeed: aiSpeed,
                    followerCarryingCrate: b.carryingCrate !== 'none',
                    reactionTimerSec: b.followerReactionTimer ?? 0,
                    idleLookTimerSec: b.followerIdleLookTimer ?? 1.5,
                    idleLookYaw: b.followerIdleLookYaw ?? b.yaw,
                    strafeTimerSec: b.followerStrafeTimer ?? 0.8,
                    strafeSign: b.followerStrafeSign ?? 1,
                    playerX: leaderX,
                    playerZ: leaderZ,
                    playerVx: mountedTank ? mountedTank.vx : playerUnit.vx,
                    playerVz: mountedTank ? mountedTank.vz : playerUnit.vz,
                    playerCarryingCrate: playerUnit.carryingCrate !== 'none',
                    alliedFollowers,
                    nearestEnemy: nearestEnemyInfo,
                    nearbyItemsAndCrates,
                    combatRangeMeters: b.weaponId === 'unarmed' ? 2.35 : 15.5,
                    dt,
                  });

                  // Step 2: Run the Follower's own independent A* pathfinder toward (previewEscort.goalX, previewEscort.goalZ)
                  const goalDist = getPlanetShortestDistance(
                    b.x,
                    b.z,
                    previewEscort.goalX,
                    previewEscort.goalZ,
                  );
                  let escortStep = previewEscort;
                  if (goalDist > 0.35) {
                    const followerSteer = computeAStarSteeringDirection(
                      b,
                      previewEscort.goalX,
                      previewEscort.goalZ,
                      dt,
                      false,
                      spec.canFly,
                    );
                    escortStep = evaluateAutonomousFollowerEscortStep({
                      followerId: String(b.id),
                      followerX: b.x,
                      followerZ: b.z,
                      followerVx: b.vx,
                      followerVz: b.vz,
                      followerYaw: b.yaw,
                      followerMaxSpeed: aiSpeed,
                      followerCarryingCrate: b.carryingCrate !== 'none',
                      reactionTimerSec: b.followerReactionTimer ?? 0,
                      idleLookTimerSec: b.followerIdleLookTimer ?? 1.5,
                      idleLookYaw: b.followerIdleLookYaw ?? b.yaw,
                      strafeTimerSec: b.followerStrafeTimer ?? 0.8,
                      strafeSign: b.followerStrafeSign ?? 1,
                      playerX: leaderX,
                      playerZ: leaderZ,
                      playerVx: mountedTank ? mountedTank.vx : playerUnit.vx,
                      playerVz: mountedTank ? mountedTank.vz : playerUnit.vz,
                      playerCarryingCrate: playerUnit.carryingCrate !== 'none',
                      alliedFollowers,
                      nearestEnemy: nearestEnemyInfo,
                      nearbyItemsAndCrates,
                      combatRangeMeters: b.weaponId === 'unarmed' ? 2.35 : 15.5,
                      aStarSteerDirX: followerSteer.dirX,
                      aStarSteerDirZ: followerSteer.dirZ,
                      dt,
                    });
                  }

                  b.vx = escortStep.vx;
                  b.vz = escortStep.vz;
                  b.yaw = escortStep.yaw;
                  b.followerReactionTimer = escortStep.reactionTimerSec;
                  b.followerIdleLookTimer = escortStep.idleLookTimerSec;
                  b.followerIdleLookYaw = escortStep.idleLookYaw;
                  b.followerStrafeTimer = escortStep.strafeTimerSec;
                  b.followerStrafeSign = escortStep.strafeSign;

                  const moveSpd = Math.hypot(b.vx, b.vz);
                  if (moveSpd > 0.05 && b.saluteTimer <= 1.1) {
                    b.x = wrapPlanetCoord(b.x + b.vx * dt);
                    b.z = wrapPlanetCoord(b.z + b.vz * dt);
                    resolveMoverWorldCollisions(b, `ai_buddy_${b.id}`, false, 0.70, 2.0, timeSec, false);
                  }
                }
              }

              let activeRangedStandoff: ReturnType<typeof evaluateAiRangedCombatStandoffBehavior> | null =
                null;
              if (!isPureContractHarvester && aiDecision.action === 'DEFEND_OWNER_PAD') {
                const ownerPlot =
                  b.team === 'blue' ? blueCommanderBases[ownerIdx] : redCommanderBases[ownerIdx];
                const defendCoords = getCommanderDefendStationCoords(
                  b.team,
                  ownerPlot,
                  ownerPad.worldX,
                  ownerPad.worldZ,
                );
                goalX = defendCoords.x;
                goalZ = defendCoords.z;
              } else if (
                !isPureContractHarvester &&
                aiDecision.action !== 'DELIVER_TO_OWNER_PAD' &&
                aiDecision.action !== 'TRIGGER_OWNER_PAD_CRAFT' &&
                aiDecision.action !== 'HARVEST_CRATE' &&
                aiDecision.action !== 'EQUIP_GROUND_WEAPON' &&
                aiDecision.action !== 'HEAL_WOUNDED_ALLY' &&
                aiDecision.action !== 'MOUNT_VEHICLE' &&
                aiDecision.action !== 'FOLLOW_COMMANDER'
              ) {
                // ATTACK_ENEMY: Armed AI holds/strafes/kites at long standoff range and shoots directly from afar!
                if (nearestEnemy) {
                  const strafeSign: 1 | -1 =
                    (b.id % 2 === 0 ? 1 : -1) *
                      (Math.sin(timeSec * 1.45 + b.id * 1.7) >= 0 ? 1 : -1) >
                    0
                      ? 1
                      : -1;
                  activeRangedStandoff = evaluateAiRangedCombatStandoffBehavior({
                    aiX: b.x,
                    aiZ: b.z,
                    enemyX: nearestEnemy.x,
                    enemyZ: nearestEnemy.z,
                    weaponId: b.weaponId === 'fishing_rod' ? 'unarmed' : b.weaponId,
                    ammo: b.ammo,
                    strafeSign,
                  });
                  goalX = wrapPlanetCoord(activeRangedStandoff.goalX);
                  goalZ = wrapPlanetCoord(activeRangedStandoff.goalZ);
                } else {
                  goalX = enemyHqX;
                  goalZ = enemyHqZ;
                }
              }

              if (!isAutonomousFollowerMode) {
                const steer = computeAStarSteeringDirection(
                  b,
                  goalX,
                  goalZ,
                  dt,
                  false,
                  spec.canFly,
                );
                const moveScale =
                  activeRangedStandoff &&
                  (activeRangedStandoff.movementMode === 'hold_and_strafe' ||
                    activeRangedStandoff.movementMode === 'retreat_kite')
                    ? 0.72
                    : 1.0;
                const aiStep = computeAiPathfindingMovementStep({
                  steerDirX: steer.dirX,
                  steerDirZ: steer.dirZ,
                  distToGoal: steer.distToGoal,
                  desiredSpeed: aiSpeed * moveScale,
                  dt,
                  stopRadius: 0.48,
                });
                if (!aiStep.arrived && b.saluteTimer <= 1.1) {
                  b.vx = aiStep.vx;
                  b.vz = aiStep.vz;
                  b.x = wrapPlanetCoord(b.x + aiStep.stepDx);
                  b.z = wrapPlanetCoord(b.z + aiStep.stepDz);
                  resolveMoverWorldCollisions(b, `ai_buddy_${b.id}`, false, 0.70, 2.0, timeSec, false);
                  b.yaw =
                    activeRangedStandoff && activeRangedStandoff.canShootNow
                      ? activeRangedStandoff.aimYaw
                      : Math.atan2(-b.vz, b.vx);

                  // Post-step target arrival check so high-speed Harvesters immediately collect/stack crates on arrival without overshooting!
                  if (
                    (aiDecision.action === 'HARVEST_CRATE' || isPureContractHarvester) &&
                    b.carryingCrate === 'none' &&
                    bestCrate &&
                    worldCrates.includes(bestCrate) &&
                    getPlanetShortestDistance(b.x, b.z, bestCrate.x, bestCrate.z) < 1.95
                  ) {
                    b.carryingCrate = bestCrate.kind;
                    if (b.overheadCrateGroup.userData.blitzBoxKind !== bestCrate.kind) {
                      populateRealBlitzCrateBoxFromGlb(
                        b.overheadCrateGroup,
                        bestCrate.kind,
                        loadedBlitzAssets,
                        windUniforms,
                        isSoftwareGl,
                        UNIFIED_WORLD_CRATE_SIZE,
                      );
                    } else {
                      b.overheadCrateBox.material = getCrateFallbackMaterial(bestCrate.kind);
                    }
                    b.overheadCrateGroup.visible = true;
                    scene.remove(bestCrate.mesh);
                    const cIdx = worldCrates.indexOf(bestCrate);
                    if (cIdx !== -1) worldCrates.splice(cIdx, 1);
                  } else if (
                    (aiDecision.action === 'DELIVER_TO_OWNER_PAD' || isPureContractHarvester) &&
                    b.carryingCrate !== 'none' &&
                    getPlanetShortestDistance(b.x, b.z, ownerPad.worldX, ownerPad.worldZ) < 2.65
                  ) {
                    if (addCrateToPadSlots(b.team, b.carryingCrate, ownerIdx, false)) {
                      b.carryingCrate = 'none';
                      b.overheadCrateGroup.visible = false;
                      if (b.team === 'blue') score += 25;
                      const updatedCount = (
                        b.team === 'blue' ? bluePadSlotsList[ownerIdx] : redPadSlotsList[ownerIdx]
                      ).filter((s) => s !== 'empty').length;
                      if (
                        (isAiCmd || isPureContractHarvester || hasActiveBuildContract) &&
                        updatedCount >= ownerTargetCount
                      ) {
                        craftFromCommanderPad(b.team, ownerIdx, !isAiCmd);
                      }
                    }
                  }
                } else {
                  b.vx = 0;
                  b.vz = 0;
                  if (activeRangedStandoff && activeRangedStandoff.canShootNow) {
                    b.yaw = activeRangedStandoff.aimYaw;
                  }
                }
              }

              if (b.shootCooldown > 0) b.shootCooldown -= dt;
              if ((b.laserBurstTimer ?? 0) > 0) {
                b.laserBurstTimer = Math.max(0, (b.laserBurstTimer ?? 0) - dt);
              }
              if (
                !isPureContractHarvester &&
                (b.carryingCrate === 'none' || isAutonomousFollowerMode) &&
                (b.shootCooldown <= 0 || (b.weaponId === 'laser' && (b.laserBurstTimer ?? 0) > 0))
              ) {
                let targetX: number | null = null;
                let targetZ: number | null = null;
                const maxWeaponFireRange =
                  b.weaponId === 'unarmed'
                    ? 2.35
                    : b.weaponId === 'bazooka' || b.weaponId === 'laser'
                      ? 28.0
                      : b.weaponId === 'rifle' || b.weaponId === 'gatling'
                        ? 25.0
                        : 21.0;
                let minEnemyDist = maxWeaponFireRange;

                for (const other of buddyUnits) {
                  if (
                    other.alive &&
                    other.team !== b.team &&
                    !(other.isPlayer && (mountedTank || ridingTramCarIdx !== null))
                  ) {
                    const ed = getPlanetShortestDistance(other.x, other.z, b.x, b.z);
                    if (ed < minEnemyDist) {
                      minEnemyDist = ed;
                      targetX = other.x;
                      targetZ = other.z;
                    }
                  }
                }

                if (targetX !== null && targetZ !== null) {
                  const sdx = getPlanetShortestDelta(targetX, b.x);
                  const sdz = getPlanetShortestDelta(targetZ, b.z);
                  const desiredAimYaw = Math.atan2(-sdz, sdx);
                  b.yaw = isAutonomousFollowerMode
                    ? stepFollowerSmoothYaw(b.yaw, desiredAimYaw, dt, 10.5)
                    : desiredAimYaw;
                  if (b.weaponId === 'unarmed') {
                    performBuddyMeleeAttack(b, Math.random() < 0.35 ? 'kick' : 'punch');
                  } else if (b.weaponId === 'laser') {
                    // AI Buddy Continuous Raycast Laser Beam burst!
                    if ((b.laserBurstTimer ?? 0) <= 0) {
                      b.laserBurstTimer = 0.52 + Math.random() * 0.24;
                      b.shootCooldown = 0.92 + Math.random() * 0.25;
                      b.tacticalLoadout = consumeActiveWeaponAmmoOnShot(b.tacticalLoadout);
                      syncUnitFieldsFromLoadout(b);
                    }
                    b.isFiringLaser = true;
                    b.weaponRecoil = 0.28 + 0.1 * Math.sin(timeSec * 44.0 + b.id);
                  } else {
                    b.shootCooldown =
                      b.weaponId === 'gatling'
                        ? 0.16 + Math.random() * 0.06
                        : b.weaponId === 'rifle'
                          ? 0.36 + Math.random() * 0.12
                          : b.weaponId === 'bazooka'
                            ? 0.92 + Math.random() * 0.22
                            : 0.48 + Math.random() * 0.16;
                    b.weaponRecoil = 0.36;
                    scratchSpawnDir.set(sdx, 0, sdz).normalize();
                    const bGroundY = getTerrainElevation(b.x, b.z);
                    scratchSpawnOrigin.set(
                      wrapPlanetCoord(b.x + scratchSpawnDir.x * 1.15),
                      bGroundY + 1.25,
                      wrapPlanetCoord(b.z + scratchSpawnDir.z * 1.15),
                    );
                    blitzExplosionSystem.spawnBlitzMuzzleFlash(
                      scratchSpawnOrigin,
                      scratchSpawnDir,
                      b.weaponId === 'bazooka' ? 0.65 : 0.42,
                      b.weaponId === 'bazooka' ? 'bazooka' : 'rifle',
                    );
                    fireProjectile(
                      b.team === 'blue',
                      b.weaponName,
                      scratchSpawnOrigin,
                      scratchSpawnDir,
                      b.weaponId === 'gatling' ? 58 : b.weaponId === 'rifle' ? 48 : 42,
                      b.weaponId === 'bazooka' ? 14 : 7,
                    );
                    b.tacticalLoadout = consumeActiveWeaponAmmoOnShot(b.tacticalLoadout);
                    syncUnitFieldsFromLoadout(b);
                  }
                }
              }
            } else if (!b.isPlayer) {
              // In Sandbox mode when solo, any non-player Buddy stands guard peacefully
              b.vx = 0;
              b.vz = 0;
            }

            // Step vertical jump/knockback physics for non-player Buddy units (e.g. when launched by a kick)
            if (!b.isPlayer && (!b.isGrounded || b.jumpOffset > 0 || b.vy > 0)) {
              const aiJump = stepBuddyJumpPhysics(
                b.jumpOffset,
                b.vy,
                b.isGrounded,
                false,
                BUDDY_CLASSES[b.classId].jumpMultiplier,
                b.carryingCrate !== 'none',
                dt,
              );
              b.jumpOffset = aiJump.jumpOffset;
              b.vy = aiJump.vy;
              b.isGrounded = aiJump.isGrounded;
            }
            if (!b.isPlayer && !shouldRunSmartAi) {
              // Dampen any knockback velocity on idle sandbox NPCs
              b.vx *= Math.exp(-10 * dt);
              b.vz *= Math.exp(-10 * dt);
              if (Math.hypot(b.vx, b.vz) > 0.05) {
                b.x = wrapPlanetCoord(b.x + b.vx * dt);
                b.z = wrapPlanetCoord(b.z + b.vz * dt);
                resolveMoverWorldCollisions(b, `ai_buddy_${b.id}`, false, 0.70, 2.0, timeSec, false);
              }
            }

            if (b.punchTimer > 0) {
              b.punchTimer = Math.max(0, b.punchTimer - dt);
            }
            if (b.kickTimer > 0) {
              b.kickTimer = Math.max(0, b.kickTimer - dt);
            }

            // Animate Roblox Buddy Limbs, Jump Arc, Front Kick, Directional Hit-Reaction Hop/Tilt & Stun Effect (+Z local front faces movement direction yaw)
            if ((b.hitReactionTimer ?? 0) > 0) {
              b.hitReactionTimer = Math.max(0, (b.hitReactionTimer ?? 0) - dt);
            }
            if ((b.stunTimer ?? 0) > 0) {
              b.stunTimer = Math.max(0, (b.stunTimer ?? 0) - dt);
            }
            const hitPose = evaluateBlitzHitReactionPose(
              b.hitReactionTimer ?? 0,
              0.60,
              b.hitReactionDirX ?? 0,
              b.hitReactionDirZ ?? 1,
              b.isPlayer,
            );
            const stunState = evaluateBlitzStunEffectState(b.stunTimer ?? 0, 1.5);
            if (b.stunMesh) {
              b.stunMesh.visible = stunState.active;
              if (stunState.active) {
                b.stunMesh.rotation.z = stunState.rotationZ;
                b.stunMesh.scale.setScalar(stunState.scale);
              }
            }

            const floatY = BUDDY_CLASSES[b.classId].canFly ? 0.65 + Math.sin(timeSec * 4 + b.id) * 0.18 : 0;
            const terrainY = getTerrainElevation(b.x, b.z);
            b.y = terrainY + floatY + b.jumpOffset + hitPose.hopY;
            syncUnitFootRingTeamColor(b);
            b.root.rotation.order = 'YXZ';
            b.root.position.set(b.x, terrainY, b.z);
            const seatLift =
              b.isPlayer && b.isSitting && activeSeatedSpot ? activeSeatedSpot.seatLiftY : 0;
            b.bodyGroup.rotation.order = 'YXZ';
            b.bodyGroup.position.y = floatY + b.jumpOffset + hitPose.hopY + seatLift;
            b.bodyGroup.rotation.set(0, b.yaw + Math.PI / 2, 0);

            const speedMag = Math.hypot(b.vx, b.vz);
            const walkSync = computeSynchronizedWalkCycleStep({
              currentWalkCycle: b.walkCycle,
              actualGroundSpeed: speedMag,
              dt,
              carryingCrate: b.carryingCrate !== 'none',
            });
            b.walkCycle = walkSync.nextWalkCycle;
            const isMoving = walkSync.isMoving;
            if (isMoving && b.jumpOffset < 0.25 && Math.random() < 0.35) {
              blitzGrassSystem.stampFootstep(b.x, b.z, 0.78);
            }
            const unitRoadState = evaluateRoadSurfaceSpeedBoost(b.x, b.z);
            spawnRoadBoostDustWindParticles(
              `buddy_${b.id}`,
              unitRoadState.onRoadOrZebra,
              b.jumpOffset < 0.18 && !BUDDY_CLASSES[b.classId].canFly,
              b.x,
              b.z,
              b.vx,
              b.vz,
              dt,
              false,
              0.38,
            );
            const legSwing = walkSync.legSwingAngle;

            if (b.kickTimer > 0) {
              // Team Buddies Front Boot Kick: right leg snaps high forward (-X Euler lifts leg toward +Z front!)
              const kickPhase = Math.sin(Math.min(1, b.kickTimer / 0.34) * Math.PI);
              b.rightLegPivot.rotation.x = -1.48 * kickPhase;
              b.leftLegPivot.rotation.x = 0.26 * kickPhase;
            } else if (b.jumpOffset > 0.08) {
              // Mid-Air Jump Stride Pose
              b.leftLegPivot.rotation.x = -0.58;
              b.rightLegPivot.rotation.x = 0.44;
            } else {
              b.leftLegPivot.rotation.x = legSwing;
              b.rightLegPivot.rotation.x = -legSwing;
            }

            if (b.weaponRecoil > 0) {
              b.weaponRecoil = Math.max(0, b.weaponRecoil - dt * (b.weaponId === 'bazooka' ? 3.2 : 6.5));
            }

            b.overheadCrateGroup.visible = b.carryingCrate !== 'none';
            const unitStrafeDir =
              isMoving && speedMag > 0.1
                ? (b.vx * Math.sin(b.yaw) + b.vz * Math.cos(b.yaw)) / speedMag
                : 0;
            const unitForwardDir =
              isMoving && speedMag > 0.1
                ? (b.vx * Math.cos(b.yaw) - b.vz * Math.sin(b.yaw)) / speedMag
                : 1;
            if (
              isMoving ||
              b.jumpOffset > 0.05 ||
              b.carryingCrate !== 'none' ||
              b.punchTimer > 0 ||
              b.kickTimer > 0
            ) {
              b.isSitting = false;
              b.isDriving = false;
            }
            const unitIsSitting =
              Boolean(b.isSitting) || (b.isPlayer && ridingTramCarIdx !== null);
            const unitIsDriving = Boolean(b.isDriving);
            updateCharacterWeaponStance(
              b.rig,
              b.weaponId,
              b.walkCycle,
              isMoving,
              b.carryingCrate !== 'none',
              b.saluteTimer,
              b.weaponRecoil,
              b.punchTimer,
              b.punchHand,
              b.kickTimer,
              b.jumpOffset,
              walkSync.legSwingAmplitude,
              unitStrafeDir,
              true,
              'front',
              unitForwardDir,
              b.yaw,
              speedMag,
              unitIsSitting,
              unitIsDriving,
            );
            if (b.isPlayer) {
              const hidePlayerHandWeapon =
                !qcForceWeaponVisible &&
                b.weaponId !== 'fishing_rod' &&
                (worldModeRef.current === 'lobby' ||
                  worldModeRef.current === 'safezone' ||
                  cityArenaMode === 'safezone');
              if (hidePlayerHandWeapon) {
                b.rig.weaponRigGroup.visible = false;
                b.rig.pistolGroup.visible = false;
                b.rig.rifleGroup.visible = false;
                b.rig.bazookaGroup.visible = false;
                if (b.rig.laserGroup) b.rig.laserGroup.visible = false;
                if (b.rig.gatlingGroup) b.rig.gatlingGroup.visible = false;
                if (b.rig.fishingRodGroup) b.rig.fishingRodGroup.visible = false;
                b.weaponMesh.visible = false;
              }
              if (promptOverlay) {
                promptOverlay.setAttribute(
                  'data-player-weapon-visible',
                  b.rig.weaponRigGroup.visible ? 'true' : 'false',
                );
              }
            }

            if (b.hitFlashTimer > 0) {
              b.hitFlashTimer = Math.max(0, b.hitFlashTimer - dt);
              b.headMesh.material = flashWhiteMat;
            } else if (b.isFrozen) {
              b.headMesh.material = frozenIceMat;
            } else {
              b.headMesh.material = (b.headMesh.userData.defaultMat as THREE.Material) || matSkin;
            }

            // Player Invincibility Frames (0.5s to 1.0s) & 10 Hz Sprite Blink
            if ((b.invincibilityTimer ?? 0) > 0) {
              const iFrameState = stepPlayerInvincibilityState(b.invincibilityTimer ?? 0, dt);
              b.invincibilityTimer = iFrameState.invincibilityTimer;
              b.bodyGroup.visible = b.isPlayer ? iFrameState.spriteVisible : true;
            } else if (!b.bodyGroup.visible) {
              b.bodyGroup.visible = true;
            }
          }

          // Red Team Stacking Pad Auto-Crafter ONLY in 'match' mode
          if (currentPlayMode === 'match') {
            const redEval = evaluateStackingPadRecipe(redPadSlots);
            if (redEval.totalCrates >= 2) {
              redCraftTimer += dt;
              if (redCraftTimer >= 3.0) {
                redCraftTimer = 0;
                const activeRed = buddyUnits.filter((u) => u.team === 'red' && u.alive).length;
                if (activeRed < 5) {
                  buddyUnits.push(
                    createBuddyCharacterUnit(
                      'red',
                      false,
                      redEval.isSuper ? 'Cyborg' : 'Commando',
                      redBase.padX - 2.5,
                      redBase.padZ + 2.0,
                      0,
                      false,
                      false,
                    ),
                  );
                }
                redPadSlots = ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'];
                syncPadVisuals(redBase, redPadSlots, 'RED', redBaseHp);
              }
            }
          }

          // ===================================================================
          // D. UPDATE PROJECTILES, TREE & PROP DESTRUCTION, BASE HQ DAMAGE & PICKUPS
          // ===================================================================
          const detonateExplosiveShellIfHeavy = (p: Projectile, hitX: number, hitY: number, hitZ: number) => {
            if (p.weaponType === 'BlitzLaserGun') {
              // LG-88 Photon Lance Target Fire Particle Ignition on every hit!
              spawnTargetFireParticles(hitX, hitY, hitZ, 16, 0.65);
            } else if (p.weaponType === 'Titan6Gatling') {
              // TITAN-6 Rotary Gatling dense metallic spark shower on hit!
              spawnDirectionalSparks(hitX, hitY + 0.2, hitZ, -p.vel.x, -p.vel.z, 9, 14, 1.15);
            }
            const isHeavyExplosive =
              p.weaponType === 'TankCannon' ||
              p.weaponType === 'Skyshield35mm' ||
              p.weaponType === 'NuclearMissile' ||
              p.weaponType === 'ClusterBomb' ||
              p.weaponType === 'HandGrenade' ||
              p.weaponType === 'LandMine' ||
              p.weaponType === 'Bazooka' ||
              p.weaponType === 'Supazooka' ||
              p.weaponType.includes('Rocket');
            if (!isHeavyExplosive) return;

            const blastScale =
              p.weaponType === 'NuclearMissile'
                ? 2.45
                : p.weaponType === 'ClusterBomb'
                ? 1.55
                : p.weaponType === 'Bazooka' || p.weaponType === 'Supazooka'
                ? 1.18
                : p.weaponType === 'Skyshield35mm'
                ? 0.72
                : 1.05;
            playSpatialSoundAt(hitX, hitZ, p.weaponType === 'Skyshield35mm' ? 28.0 : 42.0, 6.0, () => {
              if (p.weaponType === 'Skyshield35mm') {
                soundEngine.playSkyshieldFlakAirburst();
              } else if (p.weaponType === 'NuclearMissile' || p.weaponType === 'ClusterBomb') {
                soundEngine.playBarrelExplosion();
                soundEngine.playTacticalExplosion(blastScale);
              } else {
                soundEngine.playTacticalExplosion(blastScale);
              }
            });
            scratchExplosionPos.set(hitX, hitY, hitZ);
            blitzExplosionSystem.spawnBlitzExplosion(
              scratchExplosionPos,
              blastScale,
              p.weaponType === 'NuclearMissile' ? 'hq' : 'cannon',
            );
            if (p.weaponType === 'NuclearMissile' || p.weaponType === 'ClusterBomb' || p.weaponType === 'HandGrenade') {
              spawnTargetFireParticles(hitX, hitY, hitZ, 22, 1.45);
            }
            const explDist = getPlanetShortestDistance(
              hitX,
              hitZ,
              getPlayerAudioListenerPos().x,
              getPlayerAudioListenerPos().z,
            );
            if (explDist < 36.0) {
              const baseShake =
                p.weaponType === 'NuclearMissile'
                  ? 0.65
                  : p.weaponType === 'ClusterBomb'
                  ? 0.45
                  : p.weaponType === 'Skyshield35mm'
                  ? 0.16
                  : 0.36;
              shakeTrauma = Math.min(1, shakeTrauma + baseShake * Math.max(0, 1 - explDist / 36.0));
            }

            // Radial blast knockback on nearby pushable/breakable props & crates
            for (const other of activeMapProps) {
              if (!other.alive) continue;
              const d = getPlanetShortestDistance(other.x, other.z, hitX, hitZ);
              if (d > 0.05 && d < 4.4) {
                const dx = getPlanetShortestDelta(other.x, hitX) / d;
                const dz = getPlanetShortestDelta(other.z, hitZ) / d;
                const push = (1 - d / 4.4) * 9.5;
                if (other.category === 'pushable') {
                  other.vx += dx * push;
                  other.vz += dz * push;
                  other.rotVelY += (Math.random() - 0.5) * 7.5;
                } else if (other.category === 'breakable' && d < 3.0 && other.kind === 'explosive_barrel') {
                  other.alive = false;
                  other.wrapper.visible = false;
                  triggerBarrelExplosion(other.x, other.z);
                } else if (other.category === 'solid' && other.destructible && d < 3.4) {
                  other.hp -= Math.round((1 - d / 3.4) * 28);
                  if (other.canJiggleOnHit) {
                    other.jiggleTimer = 0.35;
                  }
                  if (other.hp <= 0) {
                    other.alive = false;
                    other.wrapper.visible = false;
                    score += 50;
                    spawnDebrisChunks(other.x, 0.75, other.z, 'concrete', 12, dx * 3.0, dz * 3.0);
                    spawnBurstParticles(other.x, 0.9, other.z, 10);
                  }
                }
              }
            }

            // Splash Damage Vulnerability (`Rentan Hancur`): Heavy shells (Bazooka, Tank, Skyshield) damage & destroy grounded crates and dropped weapons/pickups!
            const splashRadius = p.weaponType === 'Skyshield35mm' ? 3.2 : 4.6;
            const splashMaxDamage = p.weaponType === 'Skyshield35mm' ? 14 : 26;
            for (let ci = worldCrates.length - 1; ci >= 0; ci--) {
              const c = worldCrates[ci];
              if (c.state !== 'grounded') continue;
              const splash = evaluateSplashDamageOnDroppedItem(
                c.x,
                c.z,
                hitX,
                hitZ,
                splashRadius,
                splashMaxDamage,
                c.hp,
              );
              if (splash.hit) {
                if (canDamageWorldCrate(c)) {
                  c.hp = splash.nextHp;
                }
                c.vx += splash.knockbackVx * 0.75;
                c.vz += splash.knockbackVz * 0.75;
                c.vy = Math.max(c.vy, 3.2);
                c.rotVelY += (Math.random() - 0.5) * 6.5;
                if (canDamageWorldCrate(c) && splash.destroyed) {
                  scratchExplosionPos.set(c.x, getTerrainElevation(c.x, c.z) + 0.55, c.z);
                  blitzExplosionSystem.spawnBlitzExplosion(scratchExplosionPos, 0.72, 'crate');
                  spawnDebrisChunks(c.x, 0.55, c.z, c.kind === 'super' ? 'metal' : 'wood', 9);
                  const crateDrop = evaluateCrateDestructionDrop(c.kind);
                  if (crateDrop.dropKind === 'health' || crateDrop.isPurpleSuperWeapon) {
                    spawnWorldPickup(crateDrop.dropKind, crateDrop.label, c.x, c.z, {
                      weaponId: crateDrop.weaponId,
                      remainingAmmo: crateDrop.remainingAmmo,
                      vy: 6.4,
                    });
                  }
                  rewardPlayerOnCrateDestroyed(c.x, c.z);
                  scene.remove(c.mesh);
                  worldCrates.splice(ci, 1);
                }
              }
            }

            for (let pi = worldPickups.length - 1; pi >= 0; pi--) {
              const pk = worldPickups[pi];
              const splash = evaluateSplashDamageOnDroppedItem(
                pk.x,
                pk.z,
                hitX,
                hitZ,
                splashRadius,
                splashMaxDamage,
                pk.hp,
              );
              if (splash.hit) {
                pk.hp = splash.nextHp;
                pk.vx += splash.knockbackVx * 0.85;
                pk.vz += splash.knockbackVz * 0.85;
                pk.vy = Math.max(pk.vy, 3.6);
                if (splash.destroyed) {
                  scratchExplosionPos.set(pk.x, pk.y, pk.z);
                  blitzExplosionSystem.spawnBlitzExplosion(scratchExplosionPos, 0.58, 'crate');
                  spawnDebrisChunks(pk.x, pk.y, pk.z, 'metal', 7);
                  spawnBurstParticles(pk.x, pk.y + 0.25, pk.z, 8);
                  scene.remove(pk.mesh);
                  worldPickups.splice(pi, 1);
                }
              }
            }
          };

          const staticWorldObbs = getStaticWorldStructures();
          for (const p of projectiles) {
            if (!p.active) continue;
            p.life -= dt;
            if (p.life <= 0) {
              // Heavy cannon shells or rockets detonate on the ground at max range!
              const floorY = getTerrainElevation(p.pos.x, p.pos.z) + 0.35;
              detonateExplosiveShellIfHeavy(p, p.pos.x, floorY, p.pos.z);
              projectilePool.release(p);
              continue;
            }
            const prevProjX = p.pos.x;
            const prevProjZ = p.pos.z;
            const midProjX = wrapPlanetCoord(prevProjX + p.vel.x * dt * 0.5);
            const midProjZ = wrapPlanetCoord(prevProjZ + p.vel.z * dt * 0.5);
            p.pos.addScaledVector(p.vel, dt);
            p.pos.x = wrapPlanetCoord(p.pos.x);
            p.pos.z = wrapPlanetCoord(p.pos.z);
            p.mesh.position.copy(p.pos);

            const spawnSolidObstacleImpactExplosion = (
              hitX: number,
              hitY: number,
              hitZ: number,
              dirX: number,
              dirZ: number,
            ) => {
              detonateExplosiveShellIfHeavy(p, hitX, hitY, hitZ);
              scratchExplosionPos.set(hitX, hitY, hitZ);
              scratchHitBurstDir.set(-dirX, 0.25, -dirZ).normalize();
              blitzExplosionSystem.spawnBlitzBulletHitBurst(scratchExplosionPos, scratchHitBurstDir, false);
              const isHeavyExplosive =
                p.weaponType === 'TankCannon' ||
                p.weaponType === 'Skyshield35mm' ||
                p.weaponType === 'NuclearMissile' ||
                p.weaponType === 'Bazooka' ||
                p.weaponType === 'Supazooka' ||
                p.weaponType.includes('Rocket');
              if (!isHeavyExplosive) {
                blitzExplosionSystem.spawnBlitzExplosion(scratchExplosionPos, 0.44, 'fodder');
              }
            };

            // Ground impact check (e.g. when BlitzPlane strafes downward or shell hits sloped terrain)
            const groundElevAtProj = getTerrainElevation(p.pos.x, p.pos.z);
            if (p.pos.y <= groundElevAtProj + 0.15) {
              detonateExplosiveShellIfHeavy(p, p.pos.x, groundElevAtProj + 0.3, p.pos.z);
              spawnBurstParticles(p.pos.x, groundElevAtProj + 0.25, p.pos.z, 5);
              projectilePool.release(p);
              continue;
            }

            // 1. Check hit against Indestructible Blitz Trees (Tree Jiggle + Wood Impact SFX + Impact Burst, trees cannot be destroyed!)
            let hitResolved = false;
            for (const tr of trees) {
              if (!tr.alive) continue;
              if (Math.abs(p.pos.x - tr.x) > 4.5 || Math.abs(p.pos.z - tr.z) > 4.5) continue;
              const trGroundY = getTerrainElevation(tr.x, tr.z);
              if (p.pos.y > trGroundY + 9.2 * tr.scale) continue;
              const trHitRadius = (p.pos.y > trGroundY + 2.6 ? 1.75 : 1.18) * tr.scale;
              if (
                getPlanetShortestDistance(p.pos.x, p.pos.z, tr.x, tr.z) < trHitRadius ||
                getPlanetShortestDistance(midProjX, midProjZ, tr.x, tr.z) < trHitRadius
              ) {
                tr.hitFlashTimer = 0.12;
                tr.jiggleTimer = 0.48;
                tr.jiggleIntensity = 0.16;
                const spdLen = Math.max(0.01, Math.hypot(p.vel.x, p.vel.z));
                const dirX = p.vel.x / spdLen;
                const dirZ = p.vel.z / spdLen;
                tr.jiggleDirX = dirX;
                tr.jiggleDirZ = dirZ;
                playSpatialSoundAt(p.pos.x, p.pos.z, 24.0, 5.0, () => {
                  soundEngine.playHeavyThud(10.0, true);
                });
                spawnSolidObstacleImpactExplosion(p.pos.x, p.pos.y, p.pos.z, dirX, dirZ);
                spawnBurstParticles(p.pos.x, p.pos.y, p.pos.z, 6);
                hitResolved = true;
                break;
              }
            }
            if (hitResolved) {
              projectilePool.release(p);
              continue;
            }

            // 1A. Check hit against Static 3D OBB World Structures (Base HQ, Hangar, Barracks, Watchtower, Guardhouse, Bunker, Bastions, Kiosks, Planters, Shipping Containers, Excavators & Retaining Walls)
            for (const st of staticWorldObbs) {
              const stReach = st.halfX + st.halfZ + 2.5;
              if (Math.abs(p.pos.x - st.x) > stReach || Math.abs(p.pos.z - st.z) > stReach) continue;
              const stTopY = st.isRetainingWall
                ? st.heightY
                : getTerrainElevation(st.x, st.z) + st.heightY;
              if (p.pos.y > stTopY) continue;
              if (
                pointInObb2D(p.pos.x, p.pos.z, st.x, st.z, st.halfX, st.halfZ, st.rotY, 0.25) ||
                pointInObb2D(midProjX, midProjZ, st.x, st.z, st.halfX, st.halfZ, st.rotY, 0.25)
              ) {
                const spdLen = Math.max(0.01, Math.hypot(p.vel.x, p.vel.z));
                const dirX = p.vel.x / spdLen;
                const dirZ = p.vel.z / spdLen;
                spawnSolidObstacleImpactExplosion(p.pos.x, p.pos.y, p.pos.z, dirX, dirZ);
                playSpatialSoundAt(p.pos.x, p.pos.z, 24.0, 5.0, () => {
                  soundEngine.playMaterialImpact(st.mat, 10.0);
                });
                spawnCollisionContactParticles(p.pos.x, p.pos.y, p.pos.z, -dirX, -dirZ, st.mat, 10.0);
                spawnBurstParticles(p.pos.x, p.pos.y, p.pos.z, 6);

                const bastionMatch = /^bastion_(r|b)_([0-3])$/.exec(st.id);
                if (bastionMatch) {
                  const isRedBastion = bastionMatch[1] === 'r';
                  const bIdx = Number(bastionMatch[2]);
                  const canDamageSkyshield =
                    (isRedBastion && p.isPlayerTeam) || (!isRedBastion && !p.isPlayerTeam);
                  if (canDamageSkyshield) {
                    const targetSkyshields = getBaseSkyshieldTurrets(
                      isRedBastion ? redBase.baseGroup : blueBase.baseGroup,
                    );
                    const stTurret = targetSkyshields[bIdx];
                    const plotState = (isRedBastion ? redCommanderBases : blueCommanderBases)[bIdx];
                    if (stTurret && stTurret.isBuilt && stTurret.hp > 0) {
                      stTurret.hp = Math.max(0, stTurret.hp - p.damage * 4);
                      if (stTurret.hp <= 0) {
                        stTurret.isBuilt = false;
                        stTurret.root.visible = false;
                        if (plotState) {
                          plotState.hasSkyshield = false;
                        }
                        if (isRedBastion) {
                          score += 350;
                        }
                        scratchExplosionPos.set(
                          st.x,
                          getTerrainElevation(st.x, st.z) + 3.4,
                          st.z,
                        );
                        blitzExplosionSystem.triggerMultiStageExplosion(
                          scratchExplosionPos,
                          2.2,
                          3,
                          'vehicle',
                          (stagePos, stageScale) => {
                            playSpatialSoundAt(stagePos.x, stagePos.z, 32.0, 5.5, () => {
                              soundEngine.playBarrelExplosion();
                            });
                            shakeTrauma = Math.min(1, shakeTrauma + 0.28 * stageScale);
                          },
                        );
                      }
                    }
                  }
                } else if (
                  (st.id === 'red_hq' || st.id.startsWith('red_plot_')) &&
                  p.isPlayerTeam &&
                  currentPlayMode === 'match'
                ) {
                  const plotMatch = /^red_plot_([0-3])_(building|fence|gate)/.exec(st.id);
                  if (plotMatch) {
                    const pIdx = Number(plotMatch[1]);
                    const rPlot = redCommanderBases[pIdx];
                    if (rPlot && !rPlot.destroyed) {
                      if (plotMatch[2] === 'fence' || plotMatch[2] === 'gate') {
                        rPlot.fenceHp = Math.max(0, rPlot.fenceHp - p.damage * 6);
                        if (rPlot.fenceHp <= 0) navGridDirty = true;
                      } else {
                        rPlot.buildingHp = Math.max(0, rPlot.buildingHp - p.damage * 6);
                        if (rPlot.buildingHp <= 0) {
                          rPlot.destroyed = true;
                          navGridDirty = true;
                        }
                      }
                    }
                  }
                  const prevRedHp = redBaseHp;
                  redBaseHp = Math.max(0, redBaseHp - p.damage * 8);
                  score += 25;
                  syncPadVisuals(redBase, redPadSlots, 'RED', redBaseHp);
                  if (redBaseHp <= 0 && prevRedHp > 0) {
                    scratchExplosionPos.set(st.x, getTerrainElevation(st.x, st.z) + 1.4, st.z);
                    blitzExplosionSystem.triggerMultiStageExplosion(
                      scratchExplosionPos,
                      3.8,
                      5,
                      'hq',
                      (_pos, stageScale) => {
                        soundEngine.playBarrelExplosion();
                        shakeTrauma = Math.min(1, shakeTrauma + 0.42 * stageScale);
                      },
                    );
                  }
                  checkMatchDeathmatchWinCondition();
                } else if (
                  (st.id === 'blue_hq' || st.id.startsWith('blue_plot_')) &&
                  !p.isPlayerTeam &&
                  currentPlayMode === 'match'
                ) {
                  const plotMatch = /^blue_plot_([0-3])_(building|fence|gate)/.exec(st.id);
                  if (plotMatch) {
                    const pIdx = Number(plotMatch[1]);
                    const bPlot = blueCommanderBases[pIdx];
                    if (bPlot && !bPlot.destroyed) {
                      if (plotMatch[2] === 'fence' || plotMatch[2] === 'gate') {
                        bPlot.fenceHp = Math.max(0, bPlot.fenceHp - p.damage * 4);
                        if (bPlot.fenceHp <= 0) navGridDirty = true;
                      } else {
                        bPlot.buildingHp = Math.max(0, bPlot.buildingHp - p.damage * 4);
                        if (bPlot.buildingHp <= 0) {
                          bPlot.destroyed = true;
                          navGridDirty = true;
                        }
                      }
                    }
                  }
                  const prevBlueHp = blueBaseHp;
                  blueBaseHp = Math.max(0, blueBaseHp - p.damage * 4);
                  syncPadVisuals(blueBase, bluePadSlots, 'BLUE', blueBaseHp);
                  if (blueBaseHp <= 0 && prevBlueHp > 0) {
                    scratchExplosionPos.set(st.x, getTerrainElevation(st.x, st.z) + 1.4, st.z);
                    blitzExplosionSystem.triggerMultiStageExplosion(
                      scratchExplosionPos,
                      3.8,
                      5,
                      'hq',
                      (_pos, stageScale) => {
                        soundEngine.playBarrelExplosion();
                        shakeTrauma = Math.min(1, shakeTrauma + 0.42 * stageScale);
                      },
                    );
                  }
                  checkMatchDeathmatchWinCondition();
                }
                hitResolved = true;
                break;
              }
            }
            if (hitResolved) {
              projectilePool.release(p);
              continue;
            }

            // 1B. Check hit against Map Props (Breakable Barrels/Barricades/Fences, Pushable Props, and Solid Metal/Concrete Colliders like Wind Turbine, River Rock, Crane, Chimney, Pipes)
            for (const mp of activeMapProps) {
              if (!mp.alive) continue;
              const mpReach = Math.max(mp.radius, (mp.halfX ?? 0) + (mp.halfZ ?? 0)) + 2.5;
              if (Math.abs(p.pos.x - mp.x) > mpReach || Math.abs(p.pos.z - mp.z) > mpReach) continue;
              if (p.pos.y > getTerrainElevation(mp.x, mp.z) + mp.heightY) continue;
              const hitRadius = Math.max(0.72, mp.radius * 0.98);
              const hitProp =
                mp.halfX !== undefined && mp.halfZ !== undefined
                  ? pointInObb2D(p.pos.x, p.pos.z, mp.x, mp.z, mp.halfX, mp.halfZ, mp.rotY, 0.25) ||
                    pointInObb2D(midProjX, midProjZ, mp.x, mp.z, mp.halfX, mp.halfZ, mp.rotY, 0.25)
                  : getPlanetShortestDistance(p.pos.x, p.pos.z, mp.x, mp.z) < hitRadius ||
                    getPlanetShortestDistance(midProjX, midProjZ, mp.x, mp.z) < hitRadius;
              if (hitProp) {
                const spdLen = Math.max(0.01, Math.hypot(p.vel.x, p.vel.z));
                const dirX = p.vel.x / spdLen;
                const dirZ = p.vel.z / spdLen;
                spawnSolidObstacleImpactExplosion(p.pos.x, p.pos.y, p.pos.z, dirX, dirZ);

                if (mp.category === 'breakable' || (mp.category === 'solid' && mp.destructible)) {
                  mp.hp -= p.damage;
                  if (mp.canJiggleOnHit) {
                    mp.jiggleTimer = 0.35;
                  }
                  if (mp.category !== 'solid') {
                    const shotImpulse = mp.shootImpulse > 0 ? mp.shootImpulse * 0.72 : 3.8;
                    mp.vx += dirX * shotImpulse;
                    mp.vz += dirZ * shotImpulse;
                  }
                  if (shouldShatterBreakableProp(mp.kind, 0, false, mp.hp)) {
                    mp.alive = false;
                    mp.wrapper.visible = false;
                    if (mp.category === 'solid') navGridDirty = true;
                    score += 50;
                    if (mp.kind === 'explosive_barrel') {
                      triggerBarrelExplosion(mp.x, mp.z);
                    } else if (mp.materialTag === 'wood') {
                      playSpatialSoundAt(mp.x, mp.z, 22.0, 4.5, () => {
                        soundEngine.playWoodBreak(12.0);
                      });
                      spawnDebrisChunks(mp.x, 0.55, mp.z, 'wood', 12, dirX * 3.0, dirZ * 3.0);
                      spawnBurstParticles(mp.x, 0.9, mp.z, 10);
                    } else {
                      playSpatialSoundAt(mp.x, mp.z, 22.0, 4.5, () => {
                        soundEngine.playHeavyThud(12.5, false);
                      });
                      spawnDebrisChunks(mp.x, 0.55, mp.z, 'concrete', 12, dirX * 3.0, dirZ * 3.0);
                      spawnBurstParticles(mp.x, 0.9, mp.z, 10);
                    }
                  } else {
                    playSpatialSoundAt(p.pos.x, p.pos.z, 22.0, 4.5, () => {
                      soundEngine.playMaterialImpact(mp.materialTag, 9.5);
                    });
                    spawnCollisionContactParticles(p.pos.x, 0.85, p.pos.z, -dirX, -dirZ, mp.materialTag, 9.5);
                  }
                } else if (mp.category === 'pushable') {
                  const shotPush =
                    (mp.shootImpulse > 0 ? mp.shootImpulse * 1.15 : 6.2) / Math.max(0.5, mp.mass);
                  mp.vx += dirX * shotPush;
                  mp.vz += dirZ * shotPush;
                  mp.rotVelY += (Math.random() - 0.5) * 8.0;
                  if (mp.canJiggleOnHit) {
                    mp.jiggleTimer = 0.32;
                  }
                  playSpatialSoundAt(p.pos.x, p.pos.z, 22.0, 4.5, () => {
                    soundEngine.playMaterialImpact(mp.materialTag, 8.5);
                  });
                  spawnCollisionContactParticles(p.pos.x, 0.85, p.pos.z, -dirX, -dirZ, mp.materialTag, 8.5);
                } else {
                  // Solid metal / concrete collider (e.g. Wind Turbine, River Rock, Crane, Chimney, Giant Tank, Containers, Pipes):
                  // ricochet sparks + explosion burst + material impact SFX — large structures NEVER shake/jiggle when shot!
                  if (mp.canJiggleOnHit) {
                    mp.jiggleTimer = 0.22;
                  }
                  playSpatialSoundAt(p.pos.x, p.pos.z, 22.0, 4.5, () => {
                    soundEngine.playMaterialImpact(mp.materialTag, 9.0);
                  });
                  spawnCollisionContactParticles(p.pos.x, 0.95, p.pos.z, -dirX, -dirZ, mp.materialTag, 9.0);
                  spawnBurstParticles(p.pos.x, p.pos.y, p.pos.z, 5);
                }
                hitResolved = true;
                break;
              }
            }
            if (hitResolved) {
              projectilePool.release(p);
              continue;
            }

            // 1C. Check hit against Grounded Crates (Shooting a wooden crate knocks it back and shatters it with Blitz Explosion VFX + 3D wood planks!)
            for (let ci = worldCrates.length - 1; ci >= 0; ci--) {
              const c = worldCrates[ci];
              if (c.state !== 'grounded') continue;
              if (p.pos.y > c.y + 1.8) continue;
              if (getPlanetShortestDistance(p.pos.x, p.pos.z, c.x, c.z) < 0.95) {
                const spdLen = Math.max(0.01, Math.hypot(p.vel.x, p.vel.z));
                const dirX = p.vel.x / spdLen;
                const dirZ = p.vel.z / spdLen;
                if (canDamageWorldCrate(c)) {
                  c.hp -= p.damage;
                }
                c.vx += dirX * 4.5;
                c.vz += dirZ * 4.5;
                c.rotVelY += (Math.random() - 0.5) * 3.5;
                c.squashTimer = 0;
                c.mesh.scale.set(1, 1, 1);
                detonateExplosiveShellIfHeavy(p, c.x, c.y, c.z);
                if (canDamageWorldCrate(c) && c.hp <= 0) {
                  playSpatialSoundAt(c.x, c.z, 22.0, 4.5, () => {
                    soundEngine.playWoodBreak(11.5);
                    soundEngine.playBarrelExplosion();
                  });
                  scratchExplosionPos.set(c.x, getTerrainElevation(c.x, c.z) + 0.55, c.z);
                  blitzExplosionSystem.spawnBlitzExplosion(
                    scratchExplosionPos,
                    0.75,
                    'crate',
                  );
                  spawnDebrisChunks(c.x, 0.55, c.z, c.kind === 'super' ? 'metal' : 'wood', 11, dirX * 3.0, dirZ * 3.0);
                  spawnBurstParticles(c.x, 0.8, c.z, 10);
                  const crateDrop = evaluateCrateDestructionDrop(c.kind);
                  spawnWorldPickup(crateDrop.dropKind, crateDrop.label, c.x, c.z, {
                    weaponId: crateDrop.weaponId,
                    remainingAmmo: crateDrop.remainingAmmo,
                    vy: crateDrop.isPurpleSuperWeapon ? 6.8 : 5.4,
                  });
                  rewardPlayerOnCrateDestroyed(c.x, c.z);
                  scene.remove(c.mesh);
                  worldCrates.splice(ci, 1);
                } else {
                  playSpatialSoundAt(c.x, c.z, 18.0, 4.0, () => {
                    if (c.kind === 'super' || !canDamageWorldCrate(c)) {
                      soundEngine.playMetalImpact(9.0);
                    } else {
                      soundEngine.playWoodHit(9.0);
                    }
                  });
                }
                hitResolved = true;
                break;
              }
            }
            if (hitResolved) {
              projectilePool.release(p);
              continue;
            }

            // 1D. Check hit against Vehicles (Blitz Tank / Blitz Plane / Dump Truck OBB, including airborne Blitz Plane!) -> Multi-stage explosion when HP reaches 0!
            for (const tv of tanks) {
              if (tv.hp <= 0) continue;
              if (tv === mountedTank && p.isPlayerTeam) continue;
              if (p.isPlayerTeam && tv.team === 'blue' && tv.occupiedByAiId !== null) continue;
              if (!p.isPlayerTeam && tv.team === 'red' && tv !== mountedTank) continue;
              const vGroundY = getTerrainElevation(tv.x, tv.z);
              const vCenterY = vGroundY + (tv.altitude ?? 0) + 1.15;
              const tvHalfX =
                tv.vehicleKind === 'truck' ? 3.66 : tv.vehicleKind === 'tank' ? 2.48 : 2.52;
              const tvHalfZ =
                tv.vehicleKind === 'truck' ? 1.76 : tv.vehicleKind === 'tank' ? 1.66 : 2.48;
              if (
                Math.abs(p.pos.y - vCenterY) <= 2.35 &&
                pointInObb2D(p.pos.x, p.pos.z, tv.x, tv.z, tvHalfX, tvHalfZ, -(tv.hullYaw ?? 0), 0.22)
              ) {
                if (tv === mountedTank) {
                  shakeTrauma = Math.min(1, shakeTrauma + 0.14);
                }
                tv.hp = Math.max(0, tv.hp - p.damage);
                const bSpd = Math.hypot(p.vel.x, p.vel.z) || 1;
                const bDirX = p.vel.x / bSpd;
                const bDirZ = p.vel.z / bSpd;
                tv.hitFlashTimer = 0.15;
                tv.hitReactionTimer = 0.60;
                tv.hitReactionDirX = bDirX;
                tv.hitReactionDirZ = bDirZ;
                detonateExplosiveShellIfHeavy(p, p.pos.x, p.pos.y, p.pos.z);
                playSpatialSoundAt(tv.x, tv.z, 26.0, 5.5, () => {
                  soundEngine.playMetalImpact(10.5);
                  soundEngine.playEnemyHit();
                });
                scratchExplosionPos.set(p.pos.x, vCenterY, p.pos.z);
                scratchHitBurstDir.set(bDirX, 0, bDirZ);
                blitzExplosionSystem.spawnBlitzBulletHitBurst(
                  scratchExplosionPos,
                  scratchHitBurstDir,
                  tv === mountedTank,
                );
                spawnCollisionContactParticles(p.pos.x, vCenterY, p.pos.z, 0, 1, 'metal', 10.5);
                if (tv.hp <= 0) {
                  if (tv === mountedTank) {
                    tv.occupiedByPlayer = false;
                    tv.riderGroup.visible = false;
                    mountedTank = null;
                    playerUnit.root.visible = true;
                    playerUnit.x = tv.x - 2.4;
                    playerUnit.z = tv.z;
                  } else if (tv.occupiedByAiId !== null) {
                    const aiRider = buddyUnits.find((bu) => bu.id === tv.occupiedByAiId);
                    if (aiRider && aiRider.alive) {
                      aiRider.x = tv.x - 2.2;
                      aiRider.z = tv.z;
                      aiRider.root.visible = true;
                    }
                    tv.occupiedByAiId = null;
                    tv.riderGroup.visible = false;
                  }
                  tv.root.visible = false;
                  score += 300;
                  scratchExplosionPos.set(tv.x, vCenterY, tv.z);
                  blitzExplosionSystem.triggerMultiStageExplosion(
                    scratchExplosionPos,
                    2.4,
                    4,
                    'vehicle',
                    (stagePos, stageScale) => {
                      playSpatialSoundAt(stagePos.x, stagePos.z, 34.0, 6.0, () => {
                        soundEngine.playBarrelExplosion();
                      });
                      const dShake = getPlanetShortestDistance(
                        stagePos.x,
                        stagePos.z,
                        getPlayerAudioListenerPos().x,
                        getPlayerAudioListenerPos().z,
                      );
                      if (dShake < 30.0) {
                        shakeTrauma = Math.min(1, shakeTrauma + 0.35 * stageScale * (1 - dShake / 30.0));
                      }
                    },
                  );
                }
                hitResolved = true;
                break;
              }
            }
            if (hitResolved) {
              projectilePool.release(p);
              continue;
            }

            // 3. Check hit against Buddy Units
            for (const b of buddyUnits) {
              if (!b.alive) continue;
              if (b.isPlayer && (mountedTank || ridingTramCarIdx !== null)) continue;
              if (
                canApplyCombatDamage(
                  p.isPlayerTeam ? 'blue' : 'red',
                  b.team,
                  p.pos.x,
                  p.pos.z,
                  b.x,
                  b.z,
                )
              ) {
                if (getPlanetShortestDistance(p.pos.x, p.pos.z, b.x, b.z) < 1.15) {
                  detonateExplosiveShellIfHeavy(p, b.x, b.y + 0.9, b.z);
                  const bSpd = Math.hypot(p.vel.x, p.vel.z) || 1;
                  const bDirX = p.vel.x / bSpd;
                  const bDirZ = p.vel.z / bSpd;
                  const rawDamage =
                    p.weaponType === 'Ice Gun'
                      ? Math.ceil(p.damage * 0.5)
                      : b.isFrozen
                        ? b.hp
                        : p.damage;
                  if (b.isPlayer) {
                    const iFrameRes = applyPlayerDamageWithInvincibilityAndKnockback({
                      hp: b.hp,
                      invincibilityTimer: b.invincibilityTimer ?? 0,
                      x: b.x,
                      z: b.z,
                      vx: b.vx,
                      vz: b.vz,
                      vy: b.vy,
                      damage: rawDamage,
                      sourceX: b.x - bDirX * 2.0,
                      sourceZ: b.z - bDirZ * 2.0,
                      facingYaw: b.yaw,
                      invincibilityDurationSec: PLAYER_INVINCIBILITY_DURATION_SEC,
                    });
                    if (!iFrameRes.damageApplied) {
                      hitResolved = true;
                      break;
                    }
                    b.hp = iFrameRes.hp;
                    b.invincibilityTimer = iFrameRes.invincibilityTimer;
                    b.vx = iFrameRes.vx;
                    b.vz = iFrameRes.vz;
                    b.vy = iFrameRes.vy;
                    b.jumpOffset = Math.max(b.jumpOffset, 0.08);
                    b.isGrounded = false;
                    if (p.weaponType === 'Ice Gun') {
                      b.isFrozen = true;
                      b.frozenTimer = 4.0;
                    }
                  } else {
                    if (p.weaponType === 'Ice Gun') {
                      b.isFrozen = true;
                      b.frozenTimer = 4.0;
                      b.hp -= rawDamage;
                    } else if (b.isFrozen) {
                      b.hp = 0;
                    } else {
                      b.hp -= rawDamage;
                    }
                  }
                  b.hitFlashTimer = 0.15;
                  b.hitReactionTimer = 0.60;
                  b.hitReactionDirX = bDirX;
                  b.hitReactionDirZ = bDirZ;
                  if (b.isPlayer) {
                    soundEngine.playHit();
                  } else {
                    playSpatialSoundAt(b.x, b.z, 22.0, 4.5, () => {
                      soundEngine.playEnemyHit();
                    });
                  }
                  scratchExplosionPos.set(b.x, b.y + 0.95, b.z);
                  scratchHitBurstDir.set(bDirX, 0, bDirZ);
                  blitzExplosionSystem.spawnBlitzBulletHitBurst(
                    scratchExplosionPos,
                    scratchHitBurstDir,
                    b.isPlayer,
                  );
                  spawnBurstParticles(b.x, 1.2, b.z, 8);

                  if (b.hp <= 0) {
                    b.alive = false;
                    b.respawnTimer = 6.0;
                    b.root.visible = false;
                    playSpatialSoundAt(b.x, b.z, 26.0, 5.0, () => {
                      soundEngine.playBarrelExplosion();
                    });
                    scratchExplosionPos.set(b.x, getTerrainElevation(b.x, b.z) + 0.85, b.z);
                    blitzExplosionSystem.spawnBlitzExplosion(
                      scratchExplosionPos,
                      0.85,
                      'fodder',
                    );
                    spawnBurstParticles(b.x, 1.4, b.z, 16);
                    const isExplosiveKill =
                      p.weaponType === 'TankCannon' ||
                      p.weaponType === 'Skyshield35mm' ||
                      p.weaponType === 'Bazooka' ||
                      p.weaponType === 'Supazooka' ||
                      p.weaponType.includes('Rocket');
                    handleBuddyDeathDrops(b, isExplosiveKill);
                    if (b.team === 'red') {
                      enemiesDefeated++;
                      score += 150;
                      gold += 150;
                    } else if (b.isPlayer) {
                      handlePlayerWarzoneDeath(b);
                    }
                    checkMatchDeathmatchWinCondition();
                  }
                  hitResolved = true;
                  break;
                }
              }
            }
            if (hitResolved) {
              projectilePool.release(p);
            }
          }

          // Update & Collect 3D Pickups (Ballistic Bounce Arc + Team Buddies Despawn Blink Timer + Player/AI Collection)
          const collectorX = mountedTank ? mountedTank.x : playerUnit.x;
          const collectorZ = mountedTank ? mountedTank.z : playerUnit.z;
          for (let i = worldPickups.length - 1; i >= 0; i--) {
            const pk = worldPickups[i];
            pk.bobPhase += dt * 3.5;
            pk.mesh.rotation.y += dt * 2.2;

            // 1. Ballistic Bounce Physics (`terpental dan jatuh ke tanah`) + Base Courtyard Fence Clamping (`berada di tengah base`)
            const groundY = getTerrainElevation(pk.x, pk.z) + 0.75;
            if (Math.abs(pk.vx) > 0.02 || Math.abs(pk.vz) > 0.02 || pk.y > groundY + 0.02 || pk.vy !== 0) {
              const prevPkX = pk.x;
              const prevPkZ = pk.z;
              pk.x = wrapPlanetCoord(pk.x + pk.vx * dt);
              pk.z = wrapPlanetCoord(pk.z + pk.vz * dt);
              pk.y += pk.vy * dt;
              pk.vy -= 22.0 * dt;
              const airDamp = Math.exp(-3.2 * dt);
              pk.vx *= airDamp;
              pk.vz *= airDamp;

              // Ensure pad-crafted pickups stay inside the Commander Base courtyard and never fly outside the perimeter fence!
              for (const plot of [...blueCommanderBases, ...redCommanderBases]) {
                if (
                  Math.abs(prevPkX - plot.plotCenterX) <= 10.2 &&
                  Math.abs(prevPkZ - plot.plotCenterZ) <= 10.2
                ) {
                  if (Math.abs(pk.x - plot.plotCenterX) > 8.6) {
                    pk.x = plot.plotCenterX + Math.sign(pk.x - plot.plotCenterX) * 8.6;
                    pk.vx *= -0.35;
                  }
                  if (Math.abs(pk.z - plot.plotCenterZ) > 8.6) {
                    pk.z = plot.plotCenterZ + Math.sign(pk.z - plot.plotCenterZ) * 8.6;
                    pk.vz *= -0.35;
                  }
                  break;
                }
              }

              const nextGroundY = getTerrainElevation(pk.x, pk.z) + 0.75;
              if (pk.y <= nextGroundY) {
                pk.y = nextGroundY;
                if (pk.vy < -1.8) {
                  pk.vy = -pk.vy * 0.35;
                } else {
                  pk.vy = 0;
                }
                const damp = Math.exp(-7.5 * dt);
                pk.vx *= damp;
                pk.vz *= damp;
              }
            } else {
              pk.y = groundY + Math.sin(pk.bobPhase) * 0.08;
            }
            pk.mesh.position.set(pk.x, pk.y, pk.z);

            // 2. Team Buddies Despawn Timer & Rapid Blinking (`Batas Waktu Hilang: mulai berkedip-kedip lalu menghilang`)
            //    Crafted weapons sitting at a base Stacking Pad (`<= 9.0m` from pad) serve as Base Weapon Stock (`stock senjata`) and do not expire!
            const isBaseWeaponStock =
              pk.kind === 'weapon' &&
              (getPlanetShortestDistance(pk.x, pk.z, blueBase.padX, blueBase.padZ) <= 9.0 ||
                getPlanetShortestDistance(pk.x, pk.z, redBase.padX, redBase.padZ) <= 9.0);
            if (isBaseWeaponStock) {
              pk.lifeRemainingSec = pk.totalLifeSec;
              pk.mesh.visible = true;
            } else if (pk.isFromDeathDrop && pk.totalLifeSec > 0) {
              pk.lifeRemainingSec -= dt;
              const despawnState = evaluateDroppedItemDespawnState(pk.lifeRemainingSec, pk.totalLifeSec);
              pk.mesh.visible = despawnState.visible;
              if (despawnState.expired) {
                scene.remove(pk.mesh);
                worldPickups.splice(i, 1);
                continue;
              }
            }

            // 3. Collection by Player OR nearby AI Buddies (Friendly Auto-Loot + Enemy Stealing / No Team-Lock!)
            const pkWidForLoot: 'pistol' | 'rifle' | 'rocket' =
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
            let collectorUnit: BuddyUnit | null = null;
            if (getPlanetShortestDistance(pk.x, pk.z, collectorX, collectorZ) < 2.1) {
              if (pk.kind !== 'weapon') {
                collectorUnit = playerUnit;
              } else {
                const resolvedSlot = resolveHandheldWeaponSlotSpec(pk.weaponName);
                const alreadyOwnsSlot = playerUnit.tacticalLoadout.handheldWeapons.some(
                  (w) => w.slotId === resolvedSlot.slotId,
                );
                const hasFreeHandheldSlot =
                  playerUnit.tacticalLoadout.handheldWeapons.length < MAX_HANDHELD_WEAPON_SLOTS;
                if (alreadyOwnsSlot || hasFreeHandheldSlot) {
                  collectorUnit = playerUnit;
                }
              }
            }
            if (!collectorUnit) {
              for (const b of buddyUnits) {
                if (!b.alive || b.isPlayer) continue;
                if (getPlanetShortestDistance(pk.x, pk.z, b.x, b.z) >= 1.85) continue;
                if (pk.kind === 'weapon') {
                  const lootCheck = canUnitLootGroundWeapon(
                    b.team,
                    b.weaponId === 'fishing_rod' ? 'unarmed' : b.weaponId,
                    b.weaponName,
                    pkWidForLoot,
                    pk.weaponName,
                    b.ammo,
                  );
                  if (!lootCheck.canLoot) continue;
                }
                collectorUnit = b;
                break;
              }
            }

            if (collectorUnit) {
              if (collectorUnit.isPlayer) {
                soundEngine.playPickup();
              } else {
                playSpatialSoundAt(pk.x, pk.z, 18.0, 4.0, () => {
                  soundEngine.playPickup();
                });
              }

              if (pk.kind === 'health') {
                // Medkit (dropped from destroyed White Medical Crates or Dynamic Supply Drops!)
                const healVal = pk.healAmount ?? 35;
                collectorUnit.hp = Math.min(collectorUnit.maxHp, collectorUnit.hp + healVal);
              } else if (pk.kind === 'ammo') {
                collectorUnit.tacticalLoadout = refillLoadoutAmmoFromSource(
                  collectorUnit.tacticalLoadout,
                  'ammo_pickup',
                );
                syncUnitFieldsFromLoadout(collectorUnit);
              } else if (pk.kind === 'coin_gold' || pk.kind === 'coin_silver') {
                const pts = pk.scoreValue ?? (pk.kind === 'coin_gold' ? 250 : 100);
                if (collectorUnit.team === 'blue') {
                  score += pts;
                  gold += pts;
                }
              } else if (pk.kind === 'secondary' && pk.secondaryId) {
                if (pk.secondaryId === 'hand_grenade' || pk.secondaryId === 'land_mine') {
                  collectorUnit.tacticalLoadout = addTacticalSecondaryToLoadout(
                    collectorUnit.tacticalLoadout,
                    pk.secondaryId,
                    pk.secondaryCount ?? 2,
                  );
                  syncUnitFieldsFromLoadout(collectorUnit);
                } else {
                  collectorUnit.secondaryItem = pk.secondaryId;
                  collectorUnit.secondaryCount =
                    (collectorUnit.secondaryCount || 0) + (pk.secondaryCount ?? 1);
                }
              } else if (pk.kind === 'mission_item' && pk.missionItemId) {
                collectorUnit.missionItem = pk.missionItemId;
              } else if (pk.kind === 'weapon') {
                const eqRes = equipOrSwapDroppedWeaponInLoadout(
                  collectorUnit.tacticalLoadout,
                  pk.weaponName,
                  pk.remainingAmmo ?? 120,
                );
                collectorUnit.tacticalLoadout = eqRes.updatedLoadout;
                syncUnitFieldsFromLoadout(collectorUnit);
                collectorUnit.weaponRecoil = 0.38;
              } else if (pk.kind === 'powerup') {
                collectorUnit.hp = collectorUnit.maxHp;
                if (collectorUnit.team === 'blue') score += 120;
              }
              scene.remove(pk.mesh);
              worldPickups.splice(i, 1);
            }
          }
        }

        // Update 5-Layer Blitz Explosion & Muzzle Flash System
        blitzExplosionSystem.update(dt);

        // Update 3D Coherent Photon Laser Beams
        for (let bi = activeLaserBeams.length - 1; bi >= 0; bi--) {
          const b = activeLaserBeams[bi];
          b.life += dt;
          if (b.life >= b.maxLife) {
            scene.remove(b.group);
            b.outerMat.dispose();
            b.coreMat.dispose();
            activeLaserBeams.splice(bi, 1);
            continue;
          }
          const tNorm = b.life / b.maxLife;
          b.outerMat.opacity = 0.85 * (1 - tNorm);
          b.coreMat.opacity = Math.max(0, 1 - tNorm * 1.15);
        }

        // Update Active 3D Ordnance Devices (CB-24 Cluster Bomb from Blitz Plane, HG-04 Frag Grenade, TM-89 Land Mine)
        for (let oi = activeOrdnanceDevices.length - 1; oi >= 0; oi--) {
          const ord = activeOrdnanceDevices[oi];
          ord.fuseTimer -= dt;
          const groundY = getTerrainElevation(ord.pos.x, ord.pos.z);

          if (!ord.isGrounded) {
            ord.vel.y -= 18.5 * dt;
            ord.pos.addScaledVector(ord.vel, dt);
            ord.pos.x = wrapPlanetCoord(ord.pos.x);
            ord.pos.z = wrapPlanetCoord(ord.pos.z);
            ord.mesh.position.copy(ord.pos);
            ord.mesh.rotation.x += dt * 4.5;
            ord.mesh.rotation.z += dt * 3.2;

            if (ord.pos.y <= groundY + 0.22) {
              ord.pos.y = groundY + 0.22;
              ord.mesh.position.copy(ord.pos);
              if (ord.kind === 'cluster_bomb') {
                // CB-24 Cluster Bomb detonates immediately on aerial impact into 1 central + 6 radial submunition blasts!
                ord.fuseTimer = 0;
              } else {
                ord.vel.y = -ord.vel.y * 0.35;
                ord.vel.x *= 0.55;
                ord.vel.z *= 0.55;
                if (Math.abs(ord.vel.y) < 1.2) {
                  ord.isGrounded = true;
                }
              }
            }
          } else if (ord.kind === 'land_mine') {
            // Check proximity trigger against enemy units or vehicles
            for (const u of buddyUnits) {
              if (u.alive && u.team === 'red' && getPlanetShortestDistance(u.x, u.z, ord.pos.x, ord.pos.z) < 2.2) {
                ord.fuseTimer = 0;
                break;
              }
            }
            for (const v of tanks) {
              if (v.hp > 0 && v.team === 'red' && getPlanetShortestDistance(v.x, v.z, ord.pos.x, ord.pos.z) < 3.2) {
                ord.fuseTimer = 0;
                break;
              }
            }
          }

          if (ord.fuseTimer <= 0) {
            const ox = ord.pos.x;
            const oy = groundY + 0.45;
            const oz = ord.pos.z;
            scene.remove(ord.mesh);
            activeOrdnanceDevices.splice(oi, 1);

            soundEngine.playBarrelExplosion();
            soundEngine.playTacticalExplosion(ord.kind === 'cluster_bomb' ? 1.65 : 1.15);
            scratchExplosionPos.set(ox, oy, oz);
            blitzExplosionSystem.spawnBlitzExplosion(
              scratchExplosionPos,
              ord.kind === 'cluster_bomb' ? 1.55 : 1.1,
              'vehicle',
            );
            spawnTargetFireParticles(ox, oy, oz, ord.kind === 'cluster_bomb' ? 28 : 16, 1.5);
            spawnDebrisChunks(ox, oy, oz, 'metal', ord.kind === 'cluster_bomb' ? 14 : 8);

            if (ord.kind === 'cluster_bomb') {
              // 6 Radial Sub-Munition Cluster Bomblet Detonations around the primary impact crater!
              for (let sb = 0; sb < 6; sb++) {
                const ang = (sb / 6) * Math.PI * 2;
                const sx = wrapPlanetCoord(ox + Math.cos(ang) * 4.2);
                const sz = wrapPlanetCoord(oz + Math.sin(ang) * 4.2);
                const sy = getTerrainElevation(sx, sz) + 0.4;
                scratchExplosionPos.set(sx, sy, sz);
                blitzExplosionSystem.spawnBlitzExplosion(scratchExplosionPos, 0.92, 'cannon');
                spawnTargetFireParticles(sx, sy, sz, 10, 0.85);
              }
            }

            // Area damage to nearby enemies & vehicles
            const blastRad = ord.kind === 'cluster_bomb' ? 8.5 : 4.8;
            const maxDmg = ord.kind === 'cluster_bomb' ? 65 : 38;
            for (const b of buddyUnits) {
              if (!b.alive || b.team === 'blue') continue;
              const d = getPlanetShortestDistance(b.x, b.z, ox, oz);
              if (d <= blastRad) {
                b.hp = Math.max(0, b.hp - Math.round(maxDmg * (1 - (d / blastRad) * 0.5)));
                b.hitFlashTimer = 0.2;
                spawnTargetFireParticles(b.x, getTerrainElevation(b.x, b.z) + 0.8, b.z, 8, 0.45);
                if (b.hp <= 0) {
                  b.alive = false;
                  b.respawnTimer = 6.0;
                  b.root.visible = false;
                  handleBuddyDeathDrops(b, false);
                  enemiesDefeated++;
                  score += 150;
                  gold += 150;
                  checkMatchDeathmatchWinCondition();
                }
              }
            }
            for (const tv of tanks) {
              if (tv.hp <= 0 || tv === mountedTank) continue;
              const d = getPlanetShortestDistance(tv.x, tv.z, ox, oz);
              if (d <= blastRad) {
                tv.hp = Math.max(0, tv.hp - Math.round(maxDmg * (1 - (d / blastRad) * 0.4)));
                tv.hitFlashTimer = 0.2;
                if (tv.hp <= 0) {
                  if (tv.occupiedByAiId !== null) {
                    const aiRider = buddyUnits.find((bu) => bu.id === tv.occupiedByAiId);
                    if (aiRider && aiRider.alive) {
                      aiRider.x = tv.x - 2.2;
                      aiRider.z = tv.z;
                      aiRider.root.visible = true;
                    }
                    tv.occupiedByAiId = null;
                    tv.riderGroup.visible = false;
                  }
                  tv.root.visible = false;
                  score += 300;
                  const vCenterY = getTerrainElevation(tv.x, tv.z) + (tv.altitude ?? 0) + 1.15;
                  scratchExplosionPos.set(tv.x, vCenterY, tv.z);
                  blitzExplosionSystem.triggerMultiStageExplosion(
                    scratchExplosionPos,
                    2.4,
                    4,
                    'vehicle',
                    (stagePos) => {
                      playSpatialSoundAt(stagePos.x, stagePos.z, 34.0, 6.0, () => {
                        soundEngine.playBarrelExplosion();
                      });
                    },
                  );
                }
              }
            }
            shakeTrauma = Math.min(1, shakeTrauma + (ord.kind === 'cluster_bomb' ? 0.48 : 0.28));
          }
        }

        // Update Explosion Particles (mark inactive on death instead of destroying)
        for (const ep of explosionParticles) {
          if (!ep.active) continue;
          ep.life += dt;
          if (ep.life >= ep.maxLife) {
            explosionParticlePool.release(ep);
            continue;
          }
          ep.vel.y -= 14 * dt;
          ep.mesh.position.addScaledVector(ep.vel, dt);
          const alpha = 1 - ep.life / ep.maxLife;
          (ep.mesh.material as THREE.MeshBasicMaterial).opacity = alpha;
        }

        // Update 3D Shattered Debris Chunks (mark inactive on death instead of destroying)
        for (const dc of debrisChunks) {
          if (!dc.active) continue;
          dc.life += dt;
          if (dc.life >= dc.maxLife) {
            debrisChunkPool.release(dc);
            continue;
          }
          dc.vel.y -= 19.5 * dt;
          dc.mesh.position.addScaledVector(dc.vel, dt);
          dc.mesh.rotation.x += dc.rotVel.x * dt;
          dc.mesh.rotation.y += dc.rotVel.y * dt;
          dc.mesh.rotation.z += dc.rotVel.z * dt;

          const floorY = getTerrainElevation(dc.mesh.position.x, dc.mesh.position.z) + 0.08;
          if (dc.mesh.position.y < floorY) {
            dc.mesh.position.y = floorY;
            if (Math.abs(dc.vel.y) > 1.2) {
              dc.vel.y = -dc.vel.y * 0.42;
            } else {
              dc.vel.y = 0;
            }
            dc.vel.x *= 0.72;
            dc.vel.z *= 0.72;
            dc.rotVel.multiplyScalar(0.68);
          }

          const fadeStart = dc.maxLife * 0.65;
          if (dc.life > fadeStart) {
            const shrink = Math.max(0.01, 1 - (dc.life - fadeStart) / (dc.maxLife - fadeStart));
            dc.mesh.scale.setScalar(shrink);
          }
        }

        // Update Tank Track Ground Tread Marks (mark inactive on death instead of destroying)
        for (const tm of tankTrackMarks) {
          if (!tm.active) continue;
          tm.life += dt;
          if (tm.life >= tm.maxLife) {
            tankTrackMarkPool.release(tm);
            continue;
          }
          if (tm.life > tm.maxLife - 3.0) {
            tm.mat.opacity = 0.72 * ((tm.maxLife - tm.life) / 3.0);
          }
        }
      }

      // 4. Camera: Follow Camera (Sandbox/Match) vs High Top-Down Orbit Overview (Map Editor)
      const activePlaneAlt =
        mountedTank && mountedTank.vehicleKind === 'plane' ? mountedTank.altitude ?? 0 : 0;
      const visualPlaneAlt =
        activePlaneAlt <= 4.0 ? activePlaneAlt : 4.0 + (activePlaneAlt - 4.0) * 0.35;
      const activeTerrainY =
        state === 'title'
          ? getTerrainElevation(-32.5, 38.5)
          : currentPlayMode === 'editor'
          ? getTerrainElevation(editorPan.x, editorPan.z)
          : mountedTank
          ? getTerrainElevation(mountedTank.x, mountedTank.z)
          : getTerrainElevation(playerUnit.x, playerUnit.z);

      const focusTarget: Vec3 =
        state === 'title'
          ? { x: -32.5, y: activeTerrainY + 0.9, z: 38.5 }
          : currentPlayMode === 'editor'
          ? { x: editorPan.x, y: activeTerrainY + 0.5, z: editorPan.z }
          : mountedTank
          ? {
              x: mountedTank.x,
              y: activeTerrainY + 1.1 + visualPlaneAlt * 0.92,
              z: mountedTank.z,
            }
          : { x: playerUnit.x, y: activeTerrainY + 1.0, z: playerUnit.z };

      // Toroidal-aware Camera Spring: unwrap focusTarget relative to camFollowPos so crossing ±80 never snaps!
      const unwrappedFocusTarget: Vec3 = {
        x: camFollowPos.x + getPlanetShortestDelta(focusTarget.x, camFollowPos.x),
        y: focusTarget.y,
        z: camFollowPos.z + getPlanetShortestDelta(focusTarget.z, camFollowPos.z),
      };

      const springStep = stepCriticalDampedSpring3D(
        camFollowPos,
        unwrappedFocusTarget,
        camFollowVel,
        currentPlayMode === 'editor' ? 18 : Math.max(8, activeSpeed),
        dt,
      );
      camFollowPos = {
        x: wrapPlanetCoord(springStep.position.x),
        y: springStep.position.y,
        z: wrapPlanetCoord(springStep.position.z),
      };
      camFollowVel = springStep.velocity;

      const panAlpha = 1 - Math.exp(-BUDDIES_CONSTANTS.camera.mousePan.dampSpeed * dt);
      const panScale =
        state === 'title'
          ? 0.3
          : currentPlayMode === 'editor'
          ? 0.0
          : BUDDIES_CONSTANTS.camera.mousePan.sensitivity;
      const panMirrorSign =
        state !== 'title' && currentPlayMode !== 'editor' && playerUnit?.team === 'red' ? -1 : 1;
      mousePanCurrent.x += (mouseNdc.x * panScale * panMirrorSign - mousePanCurrent.x) * panAlpha;
      mousePanCurrent.z += (-mouseNdc.y * panScale * panMirrorSign - mousePanCurrent.z) * panAlpha;

      recoilOffset.x *= Math.exp(-10 * dt);
      recoilOffset.z *= Math.exp(-10 * dt);
      if (
        worldModeRef.current !== 'warzone' ||
        cityArenaMode === 'safezone' ||
        (playerUnit && (playerUnit.invincibilityTimer ?? 0) > 0)
      ) {
        shakeTrauma = 0;
      } else {
        shakeTrauma = Math.max(0, shakeTrauma - dt * 2.5);
      }
      const shakeAmt = shakeTrauma * shakeTrauma * 0.35;
      const shakeX = (Math.random() - 0.5) * shakeAmt;
      const shakeZ = (Math.random() - 0.5) * shakeAmt;

      const fovScale = cameraFovModeRef.current === 'roblox18' ? 1.85 : 1.0;
      const planeAltZoom = 1.0 + activePlaneAlt * 0.038;
      const zoomMult = state === 'title' ? 1.0 : cameraZoom * planeAltZoom;
      const camOffset =
        state === 'title'
          ? { x: -3.2, y: 10.6, z: 14.5 }
          : currentPlayMode === 'editor'
          ? { x: 0, y: 54.0 * editorZoom, z: 22.0 * editorZoom }
          : { x: 0, y: 13.6 * zoomMult, z: 16.2 * zoomMult };

      const finalLookX = isFullMapOverview
        ? 0
        : wrapPlanetCoord(camFollowPos.x + mousePanCurrent.x + recoilOffset.x + shakeX);
      const finalLookZ = isFullMapOverview
        ? 0
        : wrapPlanetCoord(camFollowPos.z + mousePanCurrent.z + recoilOffset.z + shakeZ);

      // =======================================================================
      // 4A. STEP NUCLEAR LAUNCHER 4-PHASE SEQUENCE (MAP ZOOM-OUT -> ROCKET CHASE -> PRE-IMPACT RISE -> RETURN)
      // =======================================================================
      if (nukeStrikeState.phase !== 'idle') {
        const currentOriginPos: Vec3 = {
          x: activeFocusUnit ? activeFocusUnit.x : playerUnit.x,
          y: activeTerrainY + 1.0,
          z: activeFocusUnit ? activeFocusUnit.z : playerUnit.z,
        };

        if (nukeStrikeState.phase === 'targeting') {
          // Update target cursor when mouse moves or when player nudges with WASD / Arrow keys
          if (Math.hypot(mouseNdc.x - nukeLastMouseNdc.x, mouseNdc.y - nukeLastMouseNdc.y) > 0.002) {
            nukeLastMouseNdc = { x: mouseNdc.x, y: mouseNdc.y };
            nukeStrikeState = updateNuclearStrikeTargetCursor(
              nukeStrikeState,
              aimWorldPoint.x,
              getTerrainElevation(aimWorldPoint.x, aimWorldPoint.z),
              aimWorldPoint.z,
              280.0,
            );
          }
          const nudgeSpeed = 42.0 * dt;
          let nudgeDx = 0;
          let nudgeDz = 0;
          if (keys['KeyW'] || keys['ArrowUp']) nudgeDz -= nudgeSpeed;
          if (keys['KeyS'] || keys['ArrowDown']) nudgeDz += nudgeSpeed;
          if (keys['KeyA'] || keys['ArrowLeft']) nudgeDx -= nudgeSpeed;
          if (keys['KeyD'] || keys['ArrowRight']) nudgeDx += nudgeSpeed;
          if (nudgeDx !== 0 || nudgeDz !== 0) {
            const nx = nukeStrikeState.targetPos.x + nudgeDx;
            const nz = nukeStrikeState.targetPos.z + nudgeDz;
            nukeStrikeState = updateNuclearStrikeTargetCursor(
              nukeStrikeState,
              nx,
              getTerrainElevation(nx, nz),
              nz,
              280.0,
            );
          }
        }

        const nukeStep = stepNuclearStrikeSequence(
          nukeStrikeState,
          Math.min(rawDt, 0.25),
          currentOriginPos,
        );
        nukeStrikeState = nukeStep.state;

        if (nukeStep.justDetonated) {
          triggerNuclearStrikeDetonation(
            nukeStrikeState.targetPos.x,
            nukeStrikeState.targetPos.y,
            nukeStrikeState.targetPos.z,
          );
        }
        if (nukeStep.justCompletedReturn) {
          camFollowPos = { ...currentOriginPos };
          camFollowVel = { x: 0, y: 0, z: 0 };
          nukeTargetReticleGroup.visible = false;
          nukeCinematicRocketGroup.visible = false;
        }
      }

      // =======================================================================
      // 4B. FLAT GROUND WORLD ALIGNMENT & TREE / PROP JIGGLE ANIMATION
      // =======================================================================
      const activeNukePose =
        nukeStrikeState.phase !== 'idle'
          ? computeNuclearStrikeCameraPose(nukeStrikeState, {
              x: camOffset.x * fovScale,
              y: camOffset.y * fovScale,
              z: camOffset.z * fovScale,
            })
          : null;
      const planetPivotX =
        isFullMapOverview || planeViewMode || skyshieldViewMode || buildingViewMode
          ? 0
          : activeNukePose
          ? activeNukePose.focusPivotPos.x
          : viewCenterX;
      const planetPivotZ =
        isFullMapOverview || planeViewMode || skyshieldViewMode || buildingViewMode
          ? 0
          : activeNukePose
          ? activeNukePose.focusPivotPos.z
          : viewCenterZ;
      const highAltFactor = clamp((activePlaneAlt - 3.5) / 11.0, 0, 1);
      const kCurve =
        isFullMapOverview ||
        planeViewMode ||
        skyshieldViewMode ||
        buildingViewMode ||
        nukeStrikeState.phase === 'targeting'
          ? 0
          : PLANET_CURVATURE_STRENGTH * (1.0 - 0.34 * highAltFactor);
      if (windUniforms.uCurvatureStrength) {
        windUniforms.uCurvatureStrength.value = kCurve;
      }

      // Sync 3D Target Reticle & 3D Flying Nuclear Rocket visuals
      if (nukeStrikeState.phase === 'targeting') {
        nukeTargetReticleGroup.visible = true;
        nukeCinematicRocketGroup.visible = false;
        const tx = nukeStrikeState.targetPos.x;
        const tz = nukeStrikeState.targetPos.z;
        const ty = getTerrainElevation(tx, tz);
        nukeTargetReticleGroup.position.set(tx, ty + 0.05, tz);
        const midRing = nukeTargetReticleGroup.getObjectByName('MidLockRing');
        if (midRing) midRing.rotation.z = timeSec * 2.2;
      } else if (nukeStrikeState.phase === 'tracking_rocket') {
        nukeTargetReticleGroup.visible = true;
        nukeCinematicRocketGroup.visible = true;
        const rx = nukeStrikeState.rocketPos.x;
        const ry = nukeStrikeState.rocketPos.y;
        const rz = nukeStrikeState.rocketPos.z;
        const curvedY =
          ry + computePlanetYOffset(rx, rz, planetPivotX, planetPivotZ) * (kCurve / PLANET_CURVATURE_STRENGTH);
        nukeCinematicRocketGroup.position.set(rx, curvedY, rz);
        scratchRocketLookAhead.set(
          rx + nukeStrikeState.rocketTangent.x * 5.0,
          curvedY + nukeStrikeState.rocketTangent.y * 5.0,
          rz + nukeStrikeState.rocketTangent.z * 5.0,
        );
        nukeCinematicRocketGroup.lookAt(scratchRocketLookAhead);
        const plume = nukeCinematicRocketGroup.getObjectByName('RocketExhaustPlume');
        if (plume) {
          plume.scale.set(
            0.9 + Math.sin(timeSec * 45) * 0.18,
            1.0 + Math.cos(timeSec * 52) * 0.25,
            0.9 + Math.sin(timeSec * 45) * 0.18,
          );
        }
        // Continuous rocket exhaust fire & smoke trail along the ballistic trajectory!
        const tailX = rx - nukeStrikeState.rocketTangent.x * 1.8;
        const tailY = ry - nukeStrikeState.rocketTangent.y * 1.8;
        const tailZ = rz - nukeStrikeState.rocketTangent.z * 1.8;
        spawnTargetFireParticles(tailX, tailY, tailZ, 2, 0.75);
      } else {
        nukeTargetReticleGroup.visible = false;
        nukeCinematicRocketGroup.visible = false;
      }

      if (buildingViewMode) {
        scene.fog = null;
        scene.background = new THREE.Color('#dfd7c8');
        let showcaseBase = scene.getObjectByName('ShowcaseBaseMasterplanRoot') as THREE.Group | null;
        if (!showcaseBase) {
          showcaseBase = new THREE.Group();
          showcaseBase.name = 'ShowcaseBaseMasterplanRoot';
          buildMilitaryBaseMasterplan(showcaseBase, 'blue', windUniforms, false);
          scene.add(showcaseBase);
        }
        const targetGroupName =
          buildingViewMode === 'hq'
            ? 'CentralCommandCommsHQ'
            : buildingViewMode === 'hangar'
            ? 'HeavyVehicleDepotHangar'
            : buildingViewMode === 'barracks'
            ? 'TroopQuartersFieldBarracks'
            : 'PerimeterCheckpointWatchtower';
        const masterRoot = showcaseBase.getObjectByName('MilitaryBaseMasterplan_blue');
        if (masterRoot) {
          masterRoot.children.forEach((ch) => {
            ch.visible = ch.name === targetGroupName;
            if (ch.name === targetGroupName) {
              ch.position.set(0, 0, 0);
            }
          });
        }
        scene.children.forEach((ch) => {
          if (ch === dirLight || ch === dirLight.target || ch === hemiLight) return;
          ch.visible = ch === showcaseBase;
        });
      } else if (skyshieldViewMode) {
        scene.fog = null;
        scene.background = new THREE.Color('#dfd7c8');
        let showcaseTurret = scene.getObjectByName('ShowcaseSkyshieldRoot') as THREE.Group | null;
        if (!showcaseTurret) {
          const built = buildProceduralSkyshieldTurret('blue', windUniforms, false, 0, 0, 0, 0);
          showcaseTurret = built.root;
          showcaseTurret.name = 'ShowcaseSkyshieldRoot';
          showcaseTurret.scale.setScalar(1.0);
          showcaseTurret.userData.pitchGroup = built.pitchGroup;
          showcaseTurret.userData.yawGroup = built.yawGroup;
          scene.add(showcaseTurret);
        }
        scene.children.forEach((ch) => {
          if (ch === dirLight || ch === dirLight.target || ch === hemiLight) return;
          ch.visible = ch === showcaseTurret;
        });
      } else if (planeViewMode) {
        scene.fog = null;
        scene.background = new THREE.Color('#dfd7c8');
        const showcasePlane = tanks.find((v) => v.vehicleKind === 'plane');
        scene.children.forEach((ch) => {
          if (ch === dirLight || ch === dirLight.target || ch === hemiLight) return;
          ch.visible = showcasePlane ? ch === showcasePlane.root : false;
        });
        if (showcasePlane) {
          showcasePlane.x = 0;
          showcasePlane.z = 0;
          showcasePlane.hullYaw = 0;
          showcasePlane.bodyGroup.rotation.set(0, 0, 0);
          const shadowDisc = showcasePlane.root.getObjectByName('ContactShadowDisc');
          if (shadowDisc) shadowDisc.visible = false;
          const tiltRoot = showcasePlane.bodyGroup.getObjectByName('BlitzPlaneTiltRoot');
          if (tiltRoot) {
            tiltRoot.position.set(0, 0, 0);
            tiltRoot.rotation.set(0, 0, 0);
          }
          const gearGrp = showcasePlane.bodyGroup.getObjectByName('BlitzPlaneLandingGear');
          if (gearGrp) gearGrp.position.y = 0.08;
        }
      } else if (isFullMapOverview) {
        scene.fog = null;
        blitzGrassSystem.grassMesh.visible = false;
        blitzGrassSystem.petalMesh.visible = false;
        editorCursorGroup.visible = false;
        blueBase.hpSign.sprite.visible = false;
        blueBase.commanderPads.forEach((p) => {
          p.padSign.sprite.visible = false;
          p.ghostPatternBox.visible = false;
          p.ghostSlotMeshes.forEach((gm) => {
            gm.visible = false;
          });
        });
        redBase.hpSign.sprite.visible = false;
        redBase.commanderPads.forEach((p) => {
          p.padSign.sprite.visible = false;
          p.ghostPatternBox.visible = false;
          p.ghostSlotMeshes.forEach((gm) => {
            gm.visible = false;
          });
        });
        camera.fov = 38;
        camera.far = 800;
        camera.up.set(0, 0, -1);
        camera.updateProjectionMatrix();
        camera.position.set(0, 412, 0.001);
        camera.lookAt(0, 0, 0);
        dirLight.shadow.camera.left = -148;
        dirLight.shadow.camera.right = 148;
        dirLight.shadow.camera.top = 148;
        dirLight.shadow.camera.bottom = -148;
        dirLight.shadow.camera.far = 395;
        dirLight.shadow.camera.updateProjectionMatrix();
      } else if (activeNukePose) {
        camera.up.set(0, 1, 0);
        camera.position.set(
          activeNukePose.cameraPos.x + shakeX,
          activeNukePose.cameraPos.y,
          activeNukePose.cameraPos.z + shakeZ,
        );
        camera.lookAt(
          activeNukePose.lookAtPos.x,
          activeNukePose.lookAtPos.y,
          activeNukePose.lookAtPos.z,
        );
      } else if (currentPlayMode === 'editor') {
        const orbitDist = 38.0 * editorZoom;
        const horizDist = Math.cos(editorOrbitPitch) * orbitDist;
        const vertDist = Math.sin(editorOrbitPitch) * orbitDist;
        camera.up.set(0, 1, 0);
        camera.position.set(
          finalLookX + Math.sin(editorOrbitYaw) * horizDist,
          camFollowPos.y + vertDist,
          finalLookZ + Math.cos(editorOrbitYaw) * horizDist,
        );
        camera.lookAt(finalLookX, camFollowPos.y, finalLookZ);
        camera.updateMatrixWorld();
        raycaster.setFromCamera(mouseNdc, camera);
        raycaster.ray.intersectPlane(groundPlane, aimWorldPoint);
      } else if (npcCameraMode === 'npc_merchant') {
        if (playerUnit) {
          playerUnit.root.visible = false;
        }
        // Gentle MMORPG NPC greeting wave & breathing animation
        const waveAngle = Math.sin(timeSec * 4.2) * 0.28;
        lobbyCafeNpc.npcRig.rightArmPivot.rotation.x = -2.2 + waveAngle;
        beachHouseNpc.npcRig.rightArmPivot.rotation.x = -2.2 + waveAngle;
        updateCharacterWeaponStance(lobbyCafeNpc.npcRig, 'unarmed', 0, false, false, 1.0, 0);
        updateCharacterWeaponStance(beachHouseNpc.npcRig, 'unarmed', 0, false, false, 1.0, 0);
        lobbyCafeNpc.exclamationGroup.visible = false;
        beachHouseNpc.exclamationGroup.visible = false;

        // Ensure standard 42-deg portrait FOV so waist-up ("setengah badan") framing is exact
        const targetNpcFov = BUDDIES_CONSTANTS.camera.fov;
        if (camera.fov !== targetNpcFov) {
          camera.fov = targetNpcFov;
          camera.updateProjectionMatrix();
        }
        // Frame NPC from waist (y_local ~ 1.95m) to head top (y_local ~ 3.99m), centered on chest (y_local ~ 2.95m),
        // and shift camera +Z (screen-left) so the NPC appears on the RIGHT side of the left-slide modal (ndc.x ~ +0.42)
        const npcCamDist = 3.1;
        const halfFovTan = Math.tan(THREE.MathUtils.degToRad(targetNpcFov * 0.5));
        const activeAspect = clamp(camera.aspect || 1.6, 1.0, 2.4);
        const lateralShiftZ = 0.42 * npcCamDist * halfFovTan * activeAspect;
        const faceCamYaw = Math.atan2(npcCamDist, lateralShiftZ);

        camera.up.set(0, 1, 0);
        if (npcCameraLocation === 'beach_house') {
          const npcX = 85.8;
          const npcY = beachHouseNpc.npcGrp.position.y;
          const npcZ = 60.0;
          beachHouseNpc.npcGrp.rotation.y = faceCamYaw;
          camera.position.set(npcX + npcCamDist, npcY + 3.02, npcZ + lateralShiftZ);
          camera.lookAt(npcX, npcY + 2.95, npcZ + lateralShiftZ);
        } else {
          const npcX = -94.0;
          const npcY = lobbyCafeNpc.npcGrp.position.y;
          const npcZ = -13.8;
          lobbyCafeNpc.npcGrp.rotation.y = faceCamYaw;
          camera.position.set(npcX + npcCamDist, npcY + 3.02, npcZ + lateralShiftZ);
          camera.lookAt(npcX, npcY + 2.95, npcZ + lateralShiftZ);
        }
        camera.updateMatrixWorld();
      } else if (npcCameraMode === 'house_interior') {
        if (playerUnit) {
          playerUnit.root.visible = false;
        }
        // 1. Smoothly interpolate Daylight Time Slider (`5.5 .. 23.5`) & Volumetric God-Rays + Dust Motes
        houseCurrentDaylightHour +=
          (houseTargetDaylightHour - houseCurrentDaylightHour) * (1 - Math.exp(-dt * 8.0));
        applyHouseDaylightVisuals(houseCurrentDaylightHour, timeSec);

        // 2. Animate Radial 3D Wipe Ring (`uWipe` sphere wave across room surfaces)
        if (houseRadialWipeRadius >= 0) {
          houseRadialWipeRadius += dt * 11.5;
          radialWipeRingMesh.scale.setScalar(houseRadialWipeRadius);
          radialWipeRingMat.opacity = Math.max(0, 1 - houseRadialWipeRadius / 8.5) * 0.88;
          if (houseRadialWipeRadius >= 8.5) {
            houseRadialWipeRadius = -1;
            radialWipeRingMesh.visible = false;
          }
        }

        // 3. Step 120 Hz Substepped Spring-Damper Bounce & Acceleration-Driven Tilt Wobble (`Hc`)
        for (const item of housePlacedItems) {
          const pose = stepFurnitureSpringWobblePhysics(item, dt);
          const meshGrp = houseFurnitureMeshMap.get(item.instanceId);
          if (meshGrp) {
            meshGrp.position.set(pose.posX, pose.posY, pose.posZ);
            meshGrp.rotation.set(pose.tiltZ, pose.rotY, -pose.tiltX, 'YXZ');
            meshGrp.scale.setScalar(pose.scale);
            const holoSphere = meshGrp.getObjectByName('HoloCommandGlobeSphere');
            if (holoSphere) {
              holoSphere.rotation.y = timeSec * 0.85;
            }
          }
        }

        // 4. Cutaway Dollhouse Spherical Orbit/Pan/Zoom Camera (`Mo[0]` in buddies-blitz.com/interior)
        const cosPitch = Math.cos(houseCamPitch);
        const sinPitch = Math.sin(houseCamPitch);
        const camX = houseCamTarget.x + Math.sin(houseCamYaw) * cosPitch * houseCamDist;
        const camY = HOUSE_ORIGIN_Y + houseCamTarget.y + sinPitch * houseCamDist;
        const camZ = houseCamTarget.z + Math.cos(houseCamYaw) * cosPitch * houseCamDist;
        camera.up.set(0, 1, 0);
        camera.position.set(camX, camY, camZ);
        camera.lookAt(
          houseCamTarget.x,
          HOUSE_ORIGIN_Y + houseCamTarget.y,
          houseCamTarget.z,
        );
        camera.updateMatrixWorld();
      } else {
        if (playerUnit && playerUnit.alive && !mountedTank) {
          playerUnit.root.visible = true;
        }
        const desiredPlayFov =
          cameraFovModeRef.current === 'roblox18'
            ? BUDDIES_CONSTANTS.camera.robloxPseudoOrthoFov
            : BUDDIES_CONSTANTS.camera.fov;
        if (camera.fov !== desiredPlayFov) {
          camera.fov = desiredPlayFov;
          camera.updateProjectionMatrix();
        }
        lobbyCafeNpc.npcGrp.rotation.y = Math.PI / 2;
        beachHouseNpc.npcGrp.rotation.y = Math.PI / 2;
        lobbyCafeNpc.npcRig.rightArmPivot.rotation.x = Math.sin(timeSec * 1.8) * 0.08;
        beachHouseNpc.npcRig.rightArmPivot.rotation.x = Math.sin(timeSec * 1.8) * 0.08;
        updateCharacterWeaponStance(lobbyCafeNpc.npcRig, 'unarmed', 0, false, false, 0, 0);
        updateCharacterWeaponStance(beachHouseNpc.npcRig, 'unarmed', 0, false, false, 0, 0);

        // Animate Floating 3D Exclamation Mark Indicator (bobbing Y + gentle rotation facing camera)
        const excBob = Math.sin(timeSec * 3.2) * 0.08;
        const excRot = Math.sin(timeSec * 1.5) * 0.22;
        lobbyCafeNpc.exclamationGroup.position.y = 3.25 + excBob;
        beachHouseNpc.exclamationGroup.position.y = 3.25 + excBob;
        lobbyCafeNpc.exclamationGroup.rotation.y = excRot;
        beachHouseNpc.exclamationGroup.rotation.y = excRot;
        const hasActiveEvent = false;
        lobbyCafeNpc.exclamationGroup.visible = hasActiveEvent && worldModeRef.current === 'lobby';
        beachHouseNpc.exclamationGroup.visible = hasActiveEvent && worldModeRef.current !== 'lobby';
        const inLobbyForCamera = worldModeRef.current === 'lobby';
        if (playerUnit && playerUnit.isSitting && activeSeatedSpot && state === 'playing') {
          // 3rd-Person Perspective Camera When Sitting on a Bench/Chair (matching Reference Image)
          const seatedFov = 50;
          if (camera.fov !== seatedFov) {
            camera.fov = seatedFov;
            camera.updateProjectionMatrix();
          }
          const seatGroundY = getTerrainElevation(activeSeatedSpot.x, activeSeatedSpot.z);
          const lookTargetX = activeSeatedSpot.x;
          const lookTargetY = seatGroundY + 1.48;
          const lookTargetZ = activeSeatedSpot.z;
          const cosP = Math.cos(seatedCameraPitch);
          const sinP = Math.sin(seatedCameraPitch);
          const camX = lookTargetX + Math.sin(seatedCameraYaw) * cosP * seatedCameraDist;
          const camY = Math.max(seatGroundY + 0.65, lookTargetY + sinP * seatedCameraDist);
          const camZ = lookTargetZ + Math.cos(seatedCameraYaw) * cosP * seatedCameraDist;
          camera.up.set(0, 1, 0);
          camera.position.set(camX, camY, camZ);
          camera.lookAt(lookTargetX, lookTargetY, lookTargetZ);
          camera.updateMatrixWorld();
          raycaster.setFromCamera(mouseNdc, camera);
          raycaster.ray.intersectPlane(groundPlane, aimWorldPoint);
        } else {
          const mirrorPose = computeTeamMirrorCameraPose({
            playerTeam: playerUnit?.team ?? 'blue',
            focusX: finalLookX,
            focusY: camFollowPos.y,
            focusZ: finalLookZ,
            baseOffset: camOffset,
            fovScale,
            visualPlaneAlt,
            isEditorOrTitle:
              state === 'title' ||
              inLobbyForCamera ||
              cityArenaMode === 'safezone',
          });
          camera.up.set(0, 1, 0);
          camera.position.set(
            mirrorPose.cameraPos.x,
            mirrorPose.cameraPos.y,
            mirrorPose.cameraPos.z,
          );
          camera.lookAt(
            mirrorPose.lookAtPos.x,
            mirrorPose.lookAtPos.y,
            mirrorPose.lookAtPos.z,
          );
          camera.updateMatrixWorld();
          raycaster.setFromCamera(mouseNdc, camera);
          raycaster.ray.intersectPlane(groundPlane, aimWorldPoint);
        }
      }

      // =======================================================================
      // 4B-0. STRICT SCENE VISUAL ISOLATION (LOBBY vs KOTA WARZONE/SAFEZONE)
      // =======================================================================
      const isLobbySceneActive = worldModeRef.current === 'lobby';
      if (cachedLobbyPortalsObj) cachedLobbyPortalsObj.visible = isLobbySceneActive;
      if (cachedLobbyNearTermObj) cachedLobbyNearTermObj.visible = isLobbySceneActive;
      if (cachedLobbyGoldExchObj) cachedLobbyGoldExchObj.visible = isLobbySceneActive;
      if (cachedHalteReturnPadsObj) cachedHalteReturnPadsObj.visible = !isLobbySceneActive;

      // Update Glassmorphic Nametag Proximity Visibility (Show when player approaches within 8.5m or when selected)
      if (playerUnit?.nameplate?.sprite) {
        playerUnit.nameplate.sprite.visible = Boolean(
          selectedCharacterTarget && String(selectedCharacterTarget.id) === String(playerUnit.id),
        );
      }
      if (lobbyCafeNpc?.npcNameplate?.sprite) {
        if (isLobbySceneActive && playerUnit && npcCameraMode === 'none') {
          const distCafe = Math.hypot(
            playerUnit.x - lobbyCafeNpc.npcGrp.position.x,
            playerUnit.z - lobbyCafeNpc.npcGrp.position.z,
          );
          const isSelected = Boolean(
            selectedCharacterTarget &&
              (selectedCharacterTarget.id === 'npc_cafe' || selectedCharacterTarget.id === 'npc_hana'),
          );
          lobbyCafeNpc.npcNameplate.sprite.visible = isSelected || distCafe <= 8.5;
        } else {
          lobbyCafeNpc.npcNameplate.sprite.visible = false;
        }
      }
      if (beachHouseNpc?.npcNameplate?.sprite) {
        if (!isLobbySceneActive && playerUnit && npcCameraMode === 'none') {
          const distBeach = Math.hypot(
            playerUnit.x - beachHouseNpc.npcGrp.position.x,
            playerUnit.z - beachHouseNpc.npcGrp.position.z,
          );
          const isSelected = Boolean(
            selectedCharacterTarget &&
              (selectedCharacterTarget.id === 'npc_beach' || selectedCharacterTarget.id === 'npc_kai'),
          );
          beachHouseNpc.npcNameplate.sprite.visible = isSelected || distBeach <= 8.5;
        } else {
          beachHouseNpc.npcNameplate.sprite.visible = false;
        }
      }
      for (let i = 0; i < buddyUnits.length; i++) {
        const bu = buddyUnits[i];
        if (!bu.isPlayer && bu.nameplate?.sprite) {
          if (!isLobbySceneActive && bu.alive && playerUnit) {
            const distBu = Math.hypot(playerUnit.x - bu.x, playerUnit.z - bu.z);
            const isSelected = Boolean(
              selectedCharacterTarget && String(selectedCharacterTarget.id) === String(bu.id),
            );
            bu.nameplate.sprite.visible = isSelected || distBu <= 8.5;
          } else {
            bu.nameplate.sprite.visible = false;
          }
        }
      }

      if (isLobbySceneActive) {
        for (let i = 0; i < buddyUnits.length; i++) {
          const bu = buddyUnits[i];
          if (!bu.isPlayer) bu.root.visible = false;
        }
        for (let i = 0; i < tanks.length; i++) {
          tanks[i].root.visible = false;
        }
        for (let i = 0; i < worldCrates.length; i++) {
          worldCrates[i].mesh.visible = false;
        }
        for (let i = 0; i < worldPickups.length; i++) {
          worldPickups[i].mesh.visible = false;
        }
        for (const cp of [...blueBase.commanderPads, ...redBase.commanderPads]) {
          cp.padGroup.visible = false;
          cp.kioskMesh.visible = false;
        }
        for (const pubPad of publicWarzonePads) {
          pubPad.padGroup.visible = false;
        }
        centerDropZoneGroup.visible = false;
        westSuperDropZoneGroup.visible = false;
        eastSuperDropZoneGroup.visible = false;
      } else {
        for (const cp of [...blueBase.commanderPads, ...redBase.commanderPads]) {
          cp.kioskMesh.visible = true;
        }
        for (const pubPad of publicWarzonePads) {
          pubPad.padGroup.visible = worldModeRef.current === 'warzone';
        }
        centerDropZoneGroup.visible = worldModeRef.current === 'warzone';
        westSuperDropZoneGroup.visible = worldModeRef.current === 'warzone';
        eastSuperDropZoneGroup.visible = worldModeRef.current === 'warzone';
      }

      // Update Flat Ground Map, Splatmap, Wildflowers, Stones, Dandelions & Sunbeams
      tolanPlanetEnv.update(planetPivotX, planetPivotZ, camera.position, timeSec);

      // Advance & Articulate the 2-Car Modern Urban Street Tram (1 Rangkaian 2 Gerbong) along the closed road loop
      // In Safezone Mode, if the tram is stopped at the Halte Trem and the player is nearby on foot, hold the tram at the Halte so they can easily click RIDE TRAM!
      const preTramState = cityTram.getState();
      const isTramWaitingAtSafezoneHalte =
        cityArenaMode === 'safezone' &&
        worldModeRef.current === 'safezone' &&
        !isPointInsideLobbySafezone(playerUnit?.x ?? 0, playerUnit?.z ?? 0) &&
        ridingTramCarIdx === null &&
        playerUnit &&
        Math.hypot(playerUnit.x - SAFEZONE_CITY_HALTE_SPAWN.x, playerUnit.z - SAFEZONE_CITY_HALTE_SPAWN.z) < 7.5 &&
        Math.hypot(preTramState.car1.x - -70.0, preTramState.car1.z - SAFEZONE_CITY_HALTE_SPAWN.z) < 2.8;
      const tramStepDt =
        isTramWaitingAtSafezoneHalte
          ? 0
          : state === 'playing' && currentPlayMode !== 'editor'
          ? dt
          : rawDt * 0.65;
      cityTramDistance =
        (cityTramDistance + CITY_TRAM_SPEC.cruiseSpeed * tramStepDt) %
        preTramState.totalTrackLength;
      const liveTramState = cityTram.update(
        cityTramDistance,
        tramStepDt,
        planetPivotX,
        planetPivotZ,
        kCurve,
      );
      if (ridingTramCarIdx !== null && playerUnit.alive) {
        const activeCar = ridingTramCarIdx === 0 ? liveTramState.car1 : liveTramState.car2;
        playerUnit.x = wrapPlanetCoord(activeCar.x);
        playerUnit.z = wrapPlanetCoord(activeCar.z);
      }
      // Push any grounded crate resting on the tram tracks gently aside when the tram passes
      for (let ci = 0; ci < worldCrates.length; ci++) {
        const c = worldCrates[ci];
        if (c.state !== 'grounded') continue;
        for (const car of [liveTramState.car1, liveTramState.car2]) {
          const obbRes = resolveSolidObbCollision2D(
            c.x,
            c.z,
            c.vx - car.forwardX * CITY_TRAM_SPEC.cruiseSpeed,
            c.vz - car.forwardZ * CITY_TRAM_SPEC.cruiseSpeed,
            0.68,
            car.x,
            car.z,
            CITY_TRAM_SPEC.carLength * 0.5,
            CITY_TRAM_SPEC.carWidth * 0.5,
            car.yaw,
            0.35,
          );
          if (obbRes.collided) {
            c.x = wrapPlanetCoord(obbRes.x);
            c.z = wrapPlanetCoord(obbRes.z);
            c.vx = obbRes.vx + car.forwardX * CITY_TRAM_SPEC.cruiseSpeed * 0.85;
            c.vz = obbRes.vz + car.forwardZ * CITY_TRAM_SPEC.cruiseSpeed * 0.85;
          }
        }
      }

      const needFullStaticAlign =
        !scene.userData.__staticWorldAligned ||
        currentPlayMode === 'editor' ||
        kCurve !== 0;

      if (needFullStaticAlign) {
        scene.userData.__staticWorldAligned = true;
        // Align Drop Zone Pads onto Terrain Elevation
        const centerDzElev = getTerrainElevation(
          currentMapLayout.centerDropZone.x,
          currentMapLayout.centerDropZone.z,
        );
        applyPlanetCurvatureToObject(
          centerDropZoneGroup,
          currentMapLayout.centerDropZone.x,
          centerDzElev + 0.04,
          currentMapLayout.centerDropZone.z,
          planetPivotX,
          planetPivotZ,
          0,
          kCurve,
        );
        applyPlanetCurvatureToObject(
          westSuperDropZoneGroup,
          -53.5,
          getTerrainElevation(-53.5, 0.0) + 0.04,
          0.0,
          planetPivotX,
          planetPivotZ,
          0,
          kCurve,
        );
        applyPlanetCurvatureToObject(
          eastSuperDropZoneGroup,
          48.0,
          getTerrainElevation(48.0, 0.0) + 0.04,
          0.0,
          planetPivotX,
          planetPivotZ,
          0,
          kCurve,
        );

        // Align Centered South Blue HQ (+90° facing North) and North Red HQ (-90° facing South) + all 4 Commander Pads per Base
        applyPlanetCurvatureToObject(
          blueBase.baseGroup,
          blueBase.hqX,
          getTerrainElevation(blueBase.hqX, blueBase.hqZ),
          blueBase.hqZ,
          planetPivotX,
          planetPivotZ,
          Math.PI / 2,
          kCurve,
        );
        for (const p of blueBase.commanderPads) {
          applyPlanetCurvatureToObject(
            p.padGroup,
            p.worldX,
            getTerrainElevation(p.worldX, p.worldZ) + 0.04,
            p.worldZ,
            planetPivotX,
            planetPivotZ,
            0,
            kCurve,
          );
          p.padGroup.updateMatrixWorld(true);
        }
        applyPlanetCurvatureToObject(
          redBase.baseGroup,
          redBase.hqX,
          getTerrainElevation(redBase.hqX, redBase.hqZ),
          redBase.hqZ,
          planetPivotX,
          planetPivotZ,
          -Math.PI / 2,
          kCurve,
        );
        for (const p of redBase.commanderPads) {
          applyPlanetCurvatureToObject(
            p.padGroup,
            p.worldX,
            getTerrainElevation(p.worldX, p.worldZ) + 0.04,
            p.worldZ,
            planetPivotX,
            planetPivotZ,
            Math.PI,
            kCurve,
          );
          p.padGroup.updateMatrixWorld(true);
        }
        for (const pubPad of publicWarzonePads) {
          applyPlanetCurvatureToObject(
            pubPad.padGroup,
            pubPad.worldX,
            getTerrainElevation(pubPad.worldX, pubPad.worldZ) + 0.04,
            pubPad.worldZ,
            planetPivotX,
            planetPivotZ,
            0,
            kCurve,
          );
          pubPad.shieldCurtainMat.opacity = 0.17 + 0.06 * Math.sin(timeSec * 3.2 + pubPad.worldX * 0.1);
          pubPad.shieldFloorRingMat.opacity = 0.72 + 0.14 * Math.sin(timeSec * 3.2 + pubPad.worldZ * 0.1);
          pubPad.padGroup.updateMatrixWorld(true);
        }
      }

      // Step Military Base Masterplan Dynamic Animations for Both Teams:
      // - Rotating Communication Radar Dish & HVAC Fans on Central Command HQ
      // - Spinning Roof Ventilation Turbine on Troop Quarters & Field Barracks
      // - Panning Searchlight on Perimeter Checkpoint Guard Watchtower
      // - Automatic Boom Barrier Gate opening to 90° when any character or ground vehicle is within < 8.0m
      const computeMinGateDistance = (gateX: number, gateZ: number): number => {
        let minDist = 999;
        for (let i = 0; i < buddyUnits.length; i++) {
          const b = buddyUnits[i];
          if (!b.alive) continue;
          if (b.isPlayer && (mountedTank || ridingTramCarIdx !== null)) continue;
          const d = getPlanetShortestDistance(b.x, b.z, gateX, gateZ);
          if (d < minDist) minDist = d;
        }
        for (let i = 0; i < tanks.length; i++) {
          const v = tanks[i];
          if (v.hp <= 0 || (v.altitude ?? 0) > 2.5) continue;
          const d = getPlanetShortestDistance(v.x, v.z, gateX, gateZ);
          if (d < minDist) minDist = d;
        }
        return minDist;
      };
      const computeAuthorizedPlotGateDistance = (
        plotTeam: 'blue' | 'red',
        plotIdx: number,
        gateX: number,
        gateZ: number,
      ): number => {
        const plotObj = (plotTeam === 'blue' ? blueCommanderBases : redCommanderBases)[plotIdx];
        let minDist = 999;
        for (let i = 0; i < buddyUnits.length; i++) {
          const b = buddyUnits[i];
          if (!b.alive) continue;
          if (b.isPlayer && (mountedTank || ridingTramCarIdx !== null)) continue;
          if (
            !canUnitEnterCommanderBaseGate(
              b.team,
              b.ownerCommanderId,
              plotTeam,
              plotIdx,
              b.isPlayer || sessionHarvesterUnitIds.includes(b.id) ? nearSessionState : null,
              {
                isSafezoneMode: cityArenaMode === 'safezone',
                plot: plotObj,
                unitWalletOrId: b.isPlayer
                  ? nearSessionState.accountId ?? nearSessionState.walletId ?? 'commander-p1.near'
                  : `visitor-unit-${b.id}`,
                isPlotOwnerOverride:
                  cityArenaMode === 'safezone'
                    ? b.isPlayer &&
                      nearSessionState.claimedTeam === plotTeam &&
                      nearSessionState.claimedPlotIndex === plotIdx
                    : undefined,
              },
            )
          ) {
            continue;
          }
          const d = getPlanetShortestDistance(b.x, b.z, gateX, gateZ);
          if (d < minDist) minDist = d;
        }
        for (let i = 0; i < tanks.length; i++) {
          const v = tanks[i];
          if (v.hp <= 0 || (v.altitude ?? 0) > 2.5) continue;
          const vehOwnerId =
            v === mountedTank
              ? playerUnit.ownerCommanderId
              : v.occupiedByAiId !== null
              ? buddyUnits.find((bu) => bu.id === v.occupiedByAiId)?.ownerCommanderId ?? -1
              : -1;
          if (
            !canUnitEnterCommanderBaseGate(
              v.team,
              vehOwnerId,
              plotTeam,
              plotIdx,
              v === mountedTank ? nearSessionState : null,
              {
                isSafezoneMode: cityArenaMode === 'safezone',
                plot: plotObj,
                unitWalletOrId:
                  v === mountedTank
                    ? nearSessionState.accountId ?? nearSessionState.walletId ?? 'commander-p1.near'
                    : `visitor-veh-${v.id}`,
                isPlotOwnerOverride:
                  cityArenaMode === 'safezone'
                    ? v === mountedTank &&
                      nearSessionState.claimedTeam === plotTeam &&
                      nearSessionState.claimedPlotIndex === plotIdx
                    : undefined,
              },
            )
          ) {
            continue;
          }
          const d = getPlanetShortestDistance(v.x, v.z, gateX, gateZ);
          if (d < minDist) minDist = d;
        }
        return minDist;
      };
      const plotCenterOffsets = [-45, -15, 15, 45];
      const blueAuthGateDists = plotCenterOffsets.map((ox, idx) =>
        computeAuthorizedPlotGateDistance('blue', idx, blueBase.hqX + ox, blueBase.hqZ - 21.8),
      );
      const redAuthGateDists = plotCenterOffsets.map((ox, idx) =>
        computeAuthorizedPlotGateDistance('red', idx, redBase.hqX - ox, redBase.hqZ + 21.8),
      );
      const blueGateDist = computeMinGateDistance(blueBase.hqX, blueBase.hqZ - 23.8);
      const redGateDist = computeMinGateDistance(redBase.hqX, redBase.hqZ + 23.8);
      stepMilitaryBaseMasterplanAnimation(blueBase.baseGroup, dt, blueGateDist, blueAuthGateDists);
      stepMilitaryBaseMasterplanAnimation(redBase.baseGroup, dt, redGateDist, redAuthGateDists);

      // Step 35mm Skyshield Air & Ground Defense Turrets mounted atop all 4 corner bastions of each Base
      const stepBaseSkyshieldDefense = (
        base: { baseGroup: THREE.Group; hqX: number; hqZ: number },
        team: 'blue' | 'red',
      ) => {
        if (state !== 'playing' || isFullMapOverview || planeViewMode || skyshieldViewMode) return;
        const isRed = team === 'red';
        const skyshields: SkyshieldTurretController[] = getBaseSkyshieldTurrets(base.baseGroup);
        for (let si = 0; si < skyshields.length; si++) {
          const st = skyshields[si];
          if (!st.isBuilt) continue;
          const wx = isRed ? base.hqX - st.localZ : base.hqX + st.localZ;
          const wz = isRed ? base.hqZ + st.localX : base.hqZ - st.localX;
          const wy = getTerrainElevation(wx, wz) + st.localY;

          let bestScoreDist = 999;
          let bestDist = 999;
          let bestX = 0;
          let bestY = 0;
          let bestZ = 0;
          let bestVx = 0;
          let bestVz = 0;
          let bestIsAir = false;
          let hasTarget = false;

          // 1. Evaluate hostile vehicles (Airborne BlitzPlane priority 1 up to 46m; Ground BlitzTank/DumpTruck priority 2 up to 34m)
          for (let vi = 0; vi < tanks.length; vi++) {
            const v = tanks[vi];
            if (v.hp <= 0) continue;
            const isHostileVehicle =
              (isRed && (v === mountedTank || (v.team === 'blue' && v.occupiedByAiId !== null))) ||
              (!isRed && v !== mountedTank && v.team === 'red' && (v.occupiedByAiId !== null || (v.altitude ?? 0) > 1.2));
            if (!isHostileVehicle) continue;
            const d = getPlanetShortestDistance(wx, wz, v.x, v.z);
            const vAlt = v.altitude ?? 0;
            const isAir = v.vehicleKind === 'plane' && vAlt > 1.2;
            const maxRange = isAir ? 46.0 : 34.0;
            if (d <= maxRange) {
              const scoreDist = isAir ? d * 0.52 : d;
              if (scoreDist < bestScoreDist) {
                bestScoreDist = scoreDist;
                bestDist = d;
                bestX = v.x;
                bestZ = v.z;
                bestY = getTerrainElevation(v.x, v.z) + vAlt + 1.05;
                bestVx = v.vx;
                bestVz = v.vz;
                bestIsAir = isAir;
                hasTarget = true;
              }
            }
          }

          // 2. Evaluate hostile infantry & flying Jetpack units (Airborne Jetpack up to 40m; Ground infantry up to 32m)
          for (let bi = 0; bi < buddyUnits.length; bi++) {
            const b = buddyUnits[bi];
            if (!b.alive || b.team === team) continue;
            if (b.isPlayer && (mountedTank || ridingTramCarIdx !== null)) continue;
            const d = getPlanetShortestDistance(wx, wz, b.x, b.z);
            const isAir = BUDDY_CLASSES[b.classId].canFly;
            const maxRange = isAir ? 40.0 : 32.0;
            if (d <= maxRange) {
              const scoreDist = isAir ? d * 0.62 : d;
              if (scoreDist < bestScoreDist) {
                bestScoreDist = scoreDist;
                bestDist = d;
                bestX = b.x;
                bestZ = b.z;
                bestY = getTerrainElevation(b.x, b.z) + (isAir ? 1.65 : 0.95);
                bestVx = b.vx;
                bestVz = b.vz;
                bestIsAir = isAir;
                hasTarget = true;
              }
            }
          }

          if (!hasTarget) {
            st.burstRemaining = 0;
            continue;
          }

          if (st.activeTargetTimer <= 0.02) {
            playSpatialSoundAt(wx, wz, 28.0, 6.0, () => {
              soundEngine.playSkyshieldRadarLock();
            });
          }
          st.activeTargetTimer = 0.35;
          const leadT = clamp(bestDist / 46.0, 0, 0.52);
          const aimX = bestX + bestVx * leadT;
          const aimZ = bestZ + bestVz * leadT;
          const wdx = getPlanetShortestDelta(aimX, wx);
          const wdz = getPlanetShortestDelta(aimZ, wz);
          const wdy = bestY - (wy + 1.13);
          const ldx = isRed ? wdz : -wdz;
          const ldz = isRed ? -wdx : wdx;

          const targetYaw = Math.atan2(-ldz, ldx);
          const horizDist = Math.max(0.5, Math.hypot(wdx, wdz));
          const targetPitch = clamp(Math.atan2(wdy, horizDist), -0.42, 1.25);

          let yawDiff = targetYaw - st.currentYaw;
          while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
          while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
          st.currentYaw += yawDiff * Math.min(1, dt * 8.5);
          st.currentPitch += (targetPitch - st.currentPitch) * Math.min(1, dt * 8.5);
          st.yawGroup.rotation.y = st.currentYaw;
          st.pitchGroup.rotation.x = 0;
          st.pitchGroup.rotation.y = 0;
          st.pitchGroup.rotation.z = st.currentPitch;

          if (st.fireCooldown <= 0 && Math.abs(yawDiff) < 0.28) {
            if (st.burstRemaining <= 0) {
              st.burstRemaining = 5;
            }
            const worldYaw = st.currentYaw + (isRed ? -Math.PI / 2 : Math.PI / 2);
            const cosP = Math.cos(st.currentPitch);
            const sinP = Math.sin(st.currentPitch);
            const dirX = Math.cos(worldYaw) * cosP;
            const dirZ = -Math.sin(worldYaw) * cosP;
            const dirY = sinP;
            const muzX = wx + dirX * 2.55;
            const muzY = wy + 1.13 + dirY * 2.55;
            const muzZ = wz + dirZ * 2.55;

            st.recoilOffset = 0.22;
            st.recoilGroup.position.x = -0.22;
            spawnBurstParticles(muzX, muzY, muzZ, 5);
            playSpatialSoundAt(wx, wz, 28.0, 6.0, () => {
              soundEngine.playSkyshieldShot();
            });
            scratchSpawnOrigin.set(muzX, muzY, muzZ);
            scratchSpawnDir.set(dirX, dirY, dirZ);
            fireProjectile(
              !isRed,
              'Skyshield35mm',
              scratchSpawnOrigin,
              scratchSpawnDir,
              46.0,
              bestIsAir ? 16 : 12,
            );
            st.burstRemaining--;
            // High-RPM AHEAD Cannon Burst: 0.04s (40ms, within 35ms-45ms) per round during burst
            st.fireCooldown = st.burstRemaining > 0 ? 0.04 : 1.25;
          }
        }
      };
      if (cityArenaMode !== 'safezone') {
        stepBaseSkyshieldDefense(blueBase, 'blue');
        stepBaseSkyshieldDefense(redBase, 'red');
      }

      // Step Deployed MLRS-MK5 Nuclear Missile Launchers (Long-Range 280m Radar Lock enabled by Command Center Lv.3)
      for (const nl of activeNuclearLaunchers) {
        const nlX = nl.root.position.x;
        const nlZ = nl.root.position.z;
        const nlY = getTerrainElevation(nlX, nlZ);
        applyPlanetCurvatureToObject(nl.root, nlX, nlY, nlZ, planetPivotX, planetPivotZ);
        if (nukeStrikeState.phase === 'targeting' && nl.team === 'blue') {
          const dx = nukeStrikeState.targetPos.x - nlX;
          const dz = nukeStrikeState.targetPos.z - nlZ;
          nl.yawGroup.rotation.y = Math.atan2(dx, dz);
          nl.pitchGroup.rotation.x = -0.52;
        } else if (nukeStrikeState.phase === 'idle') {
          nl.yawGroup.rotation.y = Math.sin(timeSec * 0.45) * 0.35;
        }
      }

      // Align all Destructible Trees + Apply Elastic Tree Jiggle When Rammed or Shot!
      for (let i = 0; i < trees.length; i++) {
        const tr = trees[i];
        if (!tr.alive) continue;
        const isJiggling = tr.jiggleTimer > 0;
        if (needFullStaticAlign || isJiggling || tr.mesh.userData.__wasJiggling) {
          applyPlanetCurvatureToObject(
            tr.mesh,
            tr.x,
            getTerrainElevation(tr.x, tr.z),
            tr.z,
            planetPivotX,
            planetPivotZ,
            (tr.mesh.userData.baseRotY as number) || 0,
            kCurve,
          );
          tr.mesh.userData.__wasJiggling = isJiggling;
        }
        if (isJiggling) {
          tr.jiggleTimer = Math.max(0, tr.jiggleTimer - dt);
          const jPhase = (1 - tr.jiggleTimer / 0.55) * Math.PI * 5.0;
          const jEnv = (tr.jiggleTimer / 0.55) * tr.jiggleIntensity;
          const sway = Math.sin(jPhase) * jEnv;
          tr.mesh.rotation.x += tr.jiggleDirZ * sway;
          tr.mesh.rotation.z -= tr.jiggleDirX * sway;
        }
      }

      // Align all Real GLB Props (including Pushable Wheelbarrow, Cones, Barricades, Falling Warzone Barrels & Jiggle Tilt)
      for (let i = 0; i < realPropsGroup.children.length; i++) {
        const propWrapper = realPropsGroup.children[i];
        if (!propWrapper.visible) continue;
        const wx = (propWrapper.userData.worldX as number) ?? propWrapper.position.x;
        const wz = (propWrapper.userData.worldZ as number) ?? propWrapper.position.z;
        const baseRotY = (propWrapper.userData.baseRotY as number) ?? 0;
        const fallOffsetY = (propWrapper.userData.fallOffsetY as number) ?? 0;
        const movedOrUnaligned =
          needFullStaticAlign ||
          propWrapper.userData.__alignedX !== wx ||
          propWrapper.userData.__alignedZ !== wz ||
          propWrapper.userData.__alignedRotY !== baseRotY ||
          propWrapper.userData.__alignedFallY !== fallOffsetY ||
          propWrapper.userData.__wasJigglingProp;
        if (movedOrUnaligned) {
          applyPlanetCurvatureToObject(
            propWrapper,
            wx,
            getTerrainElevation(wx, wz) + fallOffsetY,
            wz,
            planetPivotX,
            planetPivotZ,
            baseRotY,
            kCurve,
          );
          propWrapper.userData.__alignedX = wx;
          propWrapper.userData.__alignedZ = wz;
          propWrapper.userData.__alignedRotY = baseRotY;
          propWrapper.userData.__alignedFallY = fallOffsetY;
          propWrapper.userData.__wasJigglingProp = false;
        }
      }
      for (let i = 0; i < activeMapProps.length; i++) {
        const mp = activeMapProps[i];
        if (!mp.alive || !mp.canJiggleOnHit || mp.jiggleTimer <= 0) continue;
        const jWobble = Math.sin(mp.jiggleTimer * 36.0) * (mp.jiggleTimer / 0.35) * 0.14;
        mp.wrapper.rotation.x += jWobble;
        mp.wrapper.rotation.z += jWobble * 0.8;
        mp.wrapper.userData.__wasJigglingProp = true;
      }
      stepRealBlitzPropsAnimation(realPropsGroup, timeSec);

      // Align all Falling & Grounded Crates (with Pushable Rotation) and World Pickups
      for (let i = 0; i < worldCrates.length; i++) {
        const c = worldCrates[i];
        const cYaw = c.state === 'falling' ? Math.sin(timeSec * 2.5 + c.id) * 0.18 : c.rotY;
        applyPlanetCurvatureToObject(c.mesh, c.x, c.y, c.z, planetPivotX, planetPivotZ, cYaw, kCurve);
      }
      for (let i = 0; i < worldPickups.length; i++) {
        const pk = worldPickups[i];
        const bobY = getTerrainElevation(pk.x, pk.z) + 0.75 + Math.sin(pk.bobPhase) * 0.2;
        applyPlanetCurvatureToObject(
          pk.mesh,
          pk.x,
          bobY,
          pk.z,
          planetPivotX,
          planetPivotZ,
          pk.bobPhase * 0.6,
          kCurve,
        );
      }

      // Align all Vehicles (BlitzTank, BlitzDumpTruck & BlitzPlane) and Tank Track Tread Marks
      // Ground vehicles physically descend into the -1.55m 3-level Oasis Lake Basin and tilt along the terrain slope!
      for (let i = 0; i < tanks.length; i++) {
        const v = tanks[i];
        if (v.hp <= 0) continue;
        if ((v.hitFlashTimer ?? 0) > 0) {
          v.hitFlashTimer = Math.max(0, (v.hitFlashTimer ?? 0) - rawDt);
        }
        if ((v.hitReactionTimer ?? 0) > 0) {
          v.hitReactionTimer = Math.max(0, (v.hitReactionTimer ?? 0) - rawDt);
        }
        if ((v.stunTimer ?? 0) > 0) {
          v.stunTimer = Math.max(0, (v.stunTimer ?? 0) - rawDt);
        }
        const vStun = evaluateBlitzStunEffectState(v.stunTimer ?? 0, 1.5);
        if (v.stunMesh) {
          v.stunMesh.visible = vStun.active;
          if (vStun.active) {
            v.stunMesh.rotation.z = vStun.rotationZ;
            v.stunMesh.scale.setScalar(vStun.scale);
          }
        }
        const vHitPose = evaluateBlitzHitReactionPose(
          v.hitReactionTimer ?? 0,
          0.60,
          v.hitReactionDirX ?? 0,
          v.hitReactionDirZ ?? 1,
          true,
        );

        if (v.hp / v.maxHp <= 0.33) {
          v.lowHpSmokeTimer = (v.lowHpSmokeTimer ?? 0) + rawDt;
          if (v.lowHpSmokeTimer >= 0.14) {
            v.lowHpSmokeTimer = 0;
            scratchSmokePos.set(
              v.x,
              getTerrainElevation(v.x, v.z) + (v.altitude ?? 0) + 1.35,
              v.z,
            );
            blitzExplosionSystem.spawnLowHealthSmokePuff(scratchSmokePos);
          }
        }

        const isGroundVeh = v.vehicleKind !== 'plane' || (v.altitude ?? 0) < 0.25;
        let slopePitch = 0;
        let slopeRoll = 0;
        if (isGroundVeh) {
          const sampleStep = 1.35;
          const hPz = getTerrainElevation(v.x, v.z + sampleStep);
          const hMz = getTerrainElevation(v.x, v.z - sampleStep);
          const hPx = getTerrainElevation(v.x + sampleStep, v.z);
          const hMx = getTerrainElevation(v.x - sampleStep, v.z);
          slopePitch = clamp(Math.atan2(hPz - hMz, sampleStep * 2.0) * 0.72, -0.36, 0.36);
          slopeRoll = clamp(-Math.atan2(hPx - hMx, sampleStep * 2.0) * 0.72, -0.36, 0.36);
        }

        const tankClimb =
          v.vehicleKind === 'tank'
            ? evaluateTankClimbableObstacleElevation(v.x, v.z, v.hullYaw, activeMapProps)
            : { climbY: 0, pitchRad: 0, rollRad: 0, isClimbing: false };

        const tankBodyRecoilLiftY = 0;
        const tankBodyRecoilRotX = 0;
        const tankBodyRecoilRotZ = 0;
        if (v.vehicleKind === 'tank') {
          const tankScale =
            (v.turretGroup.userData.tankScale as number | undefined) ??
            (v.isSuper ? 2.75 : 2.45);
          const baseTurretX =
            (v.turretGroup.userData.baseTurretX as number | undefined) ?? -0.03 * tankScale;
          const baseTurretY =
            (v.turretGroup.userData.baseTurretY as number | undefined) ?? 0.82 * tankScale;
          const baseBarrelX =
            (v.barrelGroup.userData.baseBarrelX as number | undefined) ?? 1.15 * tankScale;
          const recoilWindowRemaining =
            v === mountedTank
              ? clamp(v.recoilTimer, 0, 0.24)
              : clamp(v.recoilTimer - (1.1 - 0.24), 0, 0.24);
          const shotRecoil = evaluateBlitzTankShotRecoilPose(recoilWindowRemaining, 0.24);
          // Keep the tank hull and turret cockpit rock-solid when firing; ONLY the
          // telescoping cannon barrel slides back and recovers along its barrel axis.
          v.turretGroup.position.set(baseTurretX, baseTurretY, 0);
          v.turretGroup.rotation.z = 0;
          v.barrelGroup.position.x =
            baseBarrelX - shotRecoil.barrelSlideBack * tankScale * 1.55;
        }

        applyPlanetCurvatureToObject(
          v.root,
          v.x,
          getTerrainElevation(v.x, v.z) + tankClimb.climbY + vHitPose.hopY + tankBodyRecoilLiftY,
          v.z,
          planetPivotX,
          planetPivotZ,
          0,
          kCurve,
          0.85,
          slopePitch + tankClimb.pitchRad + vHitPose.rotX + tankBodyRecoilRotX,
          slopeRoll + tankClimb.rollRad + vHitPose.rotZ + tankBodyRecoilRotZ,
        );
      }
      for (let i = 0; i < tankTrackMarks.length; i++) {
        const tm = tankTrackMarks[i];
        if (!tm.active) continue;
        const wx = tm.mesh.position.x;
        const wz = tm.mesh.position.z;
        const onRoad = evaluateRoadNetworkSdf(wx, wz) < 0;
        const baseY = getTerrainElevation(wx, wz) + (onRoad ? 0.064 : 0.085);
        tm.mesh.position.set(
          planetPivotX + getPlanetShortestDelta(wx, planetPivotX),
          baseY + computePlanetYOffset(wx, wz, planetPivotX, planetPivotZ, kCurve),
          planetPivotZ + getPlanetShortestDelta(wz, planetPivotZ),
        );
      }

      // Align all Buddy Characters (Player & AI Buddies) and Projectiles
      for (let i = 0; i < buddyUnits.length; i++) {
        const b = buddyUnits[i];
        if (!b.alive) continue;
        const floatY = BUDDY_CLASSES[b.classId].canFly ? 0.65 + Math.sin(timeSec * 4 + b.id) * 0.18 : 0;
        const bHitPose = evaluateBlitzHitReactionPose(
          b.hitReactionTimer ?? 0,
          0.60,
          b.hitReactionDirX ?? 0,
          b.hitReactionDirZ ?? 1,
          b.isPlayer,
        );
        const localY = getTerrainElevation(b.x, b.z);
        const seatLift =
          b.isPlayer && b.isSitting && activeSeatedSpot ? activeSeatedSpot.seatLiftY : 0;
        b.bodyGroup.position.y = floatY + b.jumpOffset + bHitPose.hopY + seatLift;
        applyPlanetCurvatureToObject(b.root, b.x, localY, b.z, planetPivotX, planetPivotZ, 0, kCurve);
      }

      // 3E. REAL-TIME CONTINUOUS RAYCAST LASER BEAM UPDATE (FOLLOWS BARREL MUZZLE EVERY FRAME):
      // Computes beam startPoint directly from the character's weapon barrel tip (with hand/weapon stance & body rotation)
      // and endPoint from the closest 3D raycast intersection (enemies, vehicles, crates/peti, props, structures, or max range).
      for (let i = 0; i < buddyUnits.length; i++) {
        const b = buddyUnits[i];
        const isShooterActive =
          state === 'playing' &&
          currentPlayMode !== 'editor' &&
          b.alive &&
          b.root.visible &&
          Boolean(b.isFiringLaser) &&
          b.weaponId === 'laser' &&
          !(b.isPlayer && (mountedTank || ridingTramCarIdx !== null));

        if (!isShooterActive) {
          const existingVis = continuousLaserVisuals.get(b.id);
          if (existingVis && existingVis.group.visible) {
            existingVis.group.visible = false;
          }
          continue;
        }

        const laserVis = getOrCreateContinuousLaserVisual(b.id, b.team);
        laserVis.group.visible = true;

        const floatY = BUDDY_CLASSES[b.classId].canFly ? 0.65 + Math.sin(timeSec * 4 + b.id) * 0.18 : 0;
        const bHitPose = evaluateBlitzHitReactionPose(
          b.hitReactionTimer ?? 0,
          0.60,
          b.hitReactionDirX ?? 0,
          b.hitReactionDirZ ?? 1,
          b.isPlayer,
        );
        const unitLogicalY = getTerrainElevation(b.x, b.z) + floatY + b.jumpOffset + bHitPose.hopY;
        const speedMag = Math.hypot(b.vx, b.vz);
        const isMovingNow = speedMag > 0.25;
        const legSwingAmp = BUDDY_CLASSES[b.classId].canFly ? 0 : 0.65;
        const weaponScale = b.rig.laserGroup ? b.rig.laserGroup.scale.x : 1.08;

        const muzzleTf = computeContinuousLaserMuzzleTransform({
          unitX: b.x,
          unitY: unitLogicalY,
          unitZ: b.z,
          yaw: b.yaw,
          bodyPitchX: bHitPose.rotX,
          bodyRollZ: bHitPose.rotZ,
          walkCycle: b.walkCycle,
          isMoving: isMovingNow,
          legSwingAmplitude: legSwingAmp,
          carryingCrate: b.carryingCrate !== 'none',
          weaponRecoil: b.weaponRecoil,
          weaponScale,
        });

        const wrappedMuzzleOrigin: Vec3 = {
          x: wrapPlanetCoord(muzzleTf.muzzleOrigin.x),
          y: muzzleTf.muzzleOrigin.y,
          z: wrapPlanetCoord(muzzleTf.muzzleOrigin.z),
        };

        const shooterId = `buddy_${b.id}`;
        const rayColliders = buildWorldRaycastColliders(
          shooterId,
          wrappedMuzzleOrigin.x,
          wrappedMuzzleOrigin.z,
          b.team,
          muzzleTf.beamDir,
        );
        const beamStep = evaluateContinuousLaserBeamStep({
          muzzleOrigin: wrappedMuzzleOrigin,
          beamDir: muzzleTf.beamDir,
          colliders: rayColliders,
          shooterId,
          shooterTeam: b.team,
          maxDistance: LASER_BEAM_MAX_DISTANCE,
          elapsedSec: timeSec + b.id * 0.37,
        });

        // Compute exact curved-planet visual startPoint directly from the live 3D weapon barrel nozzle anchor
        const startVisualPos = scratchLaserStartPos;
        const muzzleAnchorObj = b.rig.laserGroup?.userData?.muzzleAnchor as THREE.Object3D | undefined;
        if (muzzleAnchorObj) {
          b.root.updateMatrixWorld(true);
          muzzleAnchorObj.getWorldPosition(startVisualPos);
        } else {
          const sRx = planetPivotX + getPlanetShortestDelta(beamStep.startPoint.x, planetPivotX);
          const sRz = planetPivotZ + getPlanetShortestDelta(beamStep.startPoint.z, planetPivotZ);
          const sYOff = computePlanetYOffset(
            beamStep.startPoint.x,
            beamStep.startPoint.z,
            planetPivotX,
            planetPivotZ,
            kCurve,
          );
          startVisualPos.set(sRx, beamStep.startPoint.y + sYOff, sRz);
        }

        // Compute curved-planet visual endPoint at the raycast intersection (or max laser range)
        const endWorldX = wrapPlanetCoord(beamStep.endPoint.x);
        const endWorldZ = wrapPlanetCoord(beamStep.endPoint.z);
        const eRx = planetPivotX + getPlanetShortestDelta(endWorldX, planetPivotX);
        const eRz = planetPivotZ + getPlanetShortestDelta(endWorldZ, planetPivotZ);
        const eYOff = computePlanetYOffset(endWorldX, endWorldZ, planetPivotX, planetPivotZ, kCurve);
        const endVisualPos = scratchLaserEndPos.set(eRx, beamStep.endPoint.y + eYOff, eRz);

        const beamDelta = scratchLaserDelta.subVectors(endVisualPos, startVisualPos);
        const visualLen = Math.max(0.08, beamDelta.length());
        const beamMidVisual = scratchLaserMid
          .addVectors(startVisualPos, endVisualPos)
          .multiplyScalar(0.5);
        const beamVisualDir = scratchLaserDir.copy(beamDelta).divideScalar(visualLen);

        // 1. Update Dual-Layer CylinderGeometry (Bright White Inner Core + Rapidly Pulsating AdditiveBlending Outer Glow)
        laserVis.coreMesh.position.copy(beamMidVisual);
        laserVis.coreMesh.quaternion.setFromUnitVectors(laserUpAxis, beamVisualDir);
        laserVis.coreMesh.scale.set(
          beamStep.coreRadiusScale,
          visualLen,
          beamStep.coreRadiusScale,
        );

        laserVis.outerGlowMesh.position.copy(beamMidVisual);
        laserVis.outerGlowMesh.quaternion.setFromUnitVectors(laserUpAxis, beamVisualDir);
        laserVis.outerGlowMesh.scale.set(
          beamStep.outerGlowRadiusScale,
          visualLen,
          beamStep.outerGlowRadiusScale,
        );
        laserVis.outerMat.opacity = beamStep.outerGlowOpacity;

        const coronaScale = beamStep.outerGlowRadiusScale * 1.12;
        laserVis.coronaMesh.position.copy(beamMidVisual);
        laserVis.coronaMesh.quaternion.setFromUnitVectors(laserUpAxis, beamVisualDir);
        laserVis.coronaMesh.scale.set(coronaScale, visualLen, coronaScale);
        laserVis.coronaMat.opacity = beamStep.outerGlowOpacity * 0.44;

        // 2. Update Muzzle Light & Spinning Spark Flare Assembly at startVisualPos
        laserVis.muzzleFxGroup.position.copy(startVisualPos);
        laserVis.muzzleFxGroup.quaternion.setFromUnitVectors(laserForwardAxis, beamVisualDir);
        laserVis.muzzleGlowMesh.scale.setScalar(beamStep.muzzlePulseScale);
        laserVis.muzzleLight.intensity = 1.9 + beamStep.muzzlePulseScale * 0.65;
        for (let si = 0; si < laserVis.muzzleSparkSpikes.length; si++) {
          const sp = laserVis.muzzleSparkSpikes[si];
          const baseAng = (si / laserVis.muzzleSparkSpikes.length) * Math.PI * 2;
          sp.rotation.z = baseAng + timeSec * 28.0;
          const spLen = 0.68 + 0.45 * Math.abs(Math.sin(timeSec * 52.0 + si * 1.3));
          sp.scale.set(0.85, spLen, 0.85);
        }

        // 3. Update Hit-Point Light, Shock Ring & Spinning Impact Spark Assembly at endVisualPos
        laserVis.hitFxGroup.position.copy(endVisualPos);
        const hitNormVec = beamStep.hit
          ? scratchLaserHitNorm
              .set(beamStep.hitNormal.x, beamStep.hitNormal.y, beamStep.hitNormal.z)
              .normalize()
          : scratchLaserHitNorm.copy(beamVisualDir).negate();
        laserVis.hitFxGroup.quaternion.setFromUnitVectors(laserForwardAxis, hitNormVec);
        const hitScale = (beamStep.hit ? 1.18 : 0.72) * beamStep.hitPulseScale;
        laserVis.hitGlowMesh.scale.setScalar(hitScale);
        laserVis.hitRingMesh.visible = beamStep.hit;
        laserVis.hitRingMesh.scale.setScalar(hitScale * 1.15);
        laserVis.hitRingMesh.rotation.z = -timeSec * 22.0;
        laserVis.hitLight.intensity = beamStep.hit ? 2.4 + beamStep.hitPulseScale * 0.8 : 1.1;
        for (let si = 0; si < laserVis.hitSparkSpikes.length; si++) {
          const sp = laserVis.hitSparkSpikes[si];
          const baseAng = (si / laserVis.hitSparkSpikes.length) * Math.PI * 2 + 0.25;
          sp.rotation.z = baseAng - timeSec * 32.0;
          const spLen =
            (beamStep.hit ? 0.95 : 0.48) *
            (0.65 + 0.55 * Math.abs(Math.cos(timeSec * 58.0 + si * 1.1)));
          sp.scale.set(0.95, spLen, 0.95);
        }

        // 4. Emit continuous muzzle & hit-point spark particles
        b.laserSparkTickTimer = (b.laserSparkTickTimer ?? 0) + dt;
        if (b.laserSparkTickTimer >= 0.048) {
          b.laserSparkTickTimer %= 0.048;
          spawnDirectionalSparks(
            wrappedMuzzleOrigin.x,
            wrappedMuzzleOrigin.y,
            wrappedMuzzleOrigin.z,
            beamStep.beamDir.x,
            beamStep.beamDir.z,
            2,
            8.5,
            0.35,
          );
          if (beamStep.hit) {
            spawnDirectionalSparks(
              endWorldX,
              beamStep.endPoint.y,
              endWorldZ,
              beamStep.hitNormal.x || -beamStep.beamDir.x,
              beamStep.hitNormal.z || -beamStep.beamDir.z,
              4,
              11.5,
              0.72,
            );
            spawnTargetFireParticles(endWorldX, beamStep.endPoint.y, endWorldZ, 3, 0.36);
          }
        }

        // 5. Apply Continuous Raycast Tick Damage at closest intersection (Enemies, Vehicles, Crates/Peti, Props, Structures)
        b.laserDamageTickTimer = (b.laserDamageTickTimer ?? 0) + dt;
        if (b.laserDamageTickTimer >= LASER_DAMAGE_TICK_INTERVAL_SEC) {
          b.laserDamageTickTimer %= LASER_DAMAGE_TICK_INTERVAL_SEC;
          if (beamStep.hit && beamStep.hitTargetId) {
            const hitId = beamStep.hitTargetId;
            const bDirX = beamStep.beamDir.x;
            const bDirZ = beamStep.beamDir.z;
            const isPlayerTeam = b.team === 'blue';

            if (hitId.startsWith('buddy_')) {
              const targetBuddyId = Number(hitId.slice(6));
              const victim = buddyUnits.find((u) => u.id === targetBuddyId && u.alive);
              if (
                victim &&
                victim.team !== b.team &&
                canApplyCombatDamage(b.team, victim.team, b.x, b.z, victim.x, victim.z)
              ) {
                const tickDmg = victim.isFrozen ? victim.hp : LASER_DAMAGE_PER_TICK;
                if (victim.isPlayer) {
                  const iFrameRes = applyPlayerDamageWithInvincibilityAndKnockback({
                    hp: victim.hp,
                    invincibilityTimer: victim.invincibilityTimer ?? 0,
                    x: victim.x,
                    z: victim.z,
                    vx: victim.vx,
                    vz: victim.vz,
                    vy: victim.vy,
                    damage: tickDmg,
                    sourceX: victim.x - bDirX * 2.0,
                    sourceZ: victim.z - bDirZ * 2.0,
                    facingYaw: victim.yaw,
                    invincibilityDurationSec: PLAYER_INVINCIBILITY_DURATION_SEC,
                  });
                  if (iFrameRes.damageApplied) {
                    victim.hp = iFrameRes.hp;
                    victim.invincibilityTimer = iFrameRes.invincibilityTimer;
                    victim.vx = iFrameRes.vx;
                    victim.vz = iFrameRes.vz;
                    victim.vy = iFrameRes.vy;
                    soundEngine.playHit();
                  }
                } else {
                  victim.hp = Math.max(0, victim.hp - tickDmg);
                  victim.vx += bDirX * 1.4;
                  victim.vz += bDirZ * 1.4;
                }
                victim.hitFlashTimer = 0.1;
                victim.hitReactionTimer = 0.32;
                victim.hitReactionDirX = bDirX;
                victim.hitReactionDirZ = bDirZ;
                if (victim.hp <= 0 && victim.alive) {
                  victim.alive = false;
                  victim.respawnTimer = 6.0;
                  victim.root.visible = false;
                  playSpatialSoundAt(victim.x, victim.z, 26.0, 5.0, () => {
                    soundEngine.playBarrelExplosion();
                  });
                  scratchExplosionPos.set(
                    victim.x,
                    getTerrainElevation(victim.x, victim.z) + 0.85,
                    victim.z,
                  );
                  blitzExplosionSystem.spawnBlitzExplosion(scratchExplosionPos, 0.85, 'fodder');
                  spawnBurstParticles(victim.x, 1.4, victim.z, 14);
                  handleBuddyDeathDrops(victim, false);
                  if (victim.team === 'red') {
                    enemiesDefeated++;
                    score += 180;
                    gold += 150;
                  } else if (victim.isPlayer) {
                    handlePlayerWarzoneDeath(victim);
                  }
                  checkMatchDeathmatchWinCondition();
                }
              }
            } else if (hitId.startsWith('veh_')) {
              const targetVehId = Number(hitId.slice(4));
              const tv = tanks.find((v) => v.id === targetVehId && v.hp > 0);
              const canDamageVehicleWithLaser =
                Boolean(tv) &&
                tv !== mountedTank &&
                (tv!.team !== b.team || (!tv!.occupiedByPlayer && tv!.occupiedByAiId === null));
              if (tv && (canDamageVehicleWithLaser || (tv === mountedTank && !isPlayerTeam))) {
                tv.hp = Math.max(0, tv.hp - LASER_DAMAGE_PER_TICK);
                tv.hitFlashTimer = 0.1;
                tv.hitReactionTimer = 0.35;
                tv.hitReactionDirX = bDirX;
                tv.hitReactionDirZ = bDirZ;
                if (tv.hp <= 0) {
                  if (tv === mountedTank) {
                    tv.occupiedByPlayer = false;
                    tv.riderGroup.visible = false;
                    mountedTank = null;
                    playerUnit.root.visible = true;
                    playerUnit.x = tv.x - 2.4;
                    playerUnit.z = tv.z;
                  } else if (tv.occupiedByAiId !== null) {
                    const aiRider = buddyUnits.find((bu) => bu.id === tv.occupiedByAiId);
                    if (aiRider && aiRider.alive) {
                      aiRider.x = tv.x - 2.2;
                      aiRider.z = tv.z;
                      aiRider.root.visible = true;
                    }
                    tv.occupiedByAiId = null;
                    tv.riderGroup.visible = false;
                  }
                  tv.root.visible = false;
                  if (isPlayerTeam) score += 300;
                  const vCenterY = getTerrainElevation(tv.x, tv.z) + (tv.altitude ?? 0) + 1.15;
                  scratchExplosionPos.set(tv.x, vCenterY, tv.z);
                  blitzExplosionSystem.triggerMultiStageExplosion(
                    scratchExplosionPos,
                    2.4,
                    4,
                    'vehicle',
                    (stagePos) => {
                      playSpatialSoundAt(stagePos.x, stagePos.z, 34.0, 6.0, () => {
                        soundEngine.playBarrelExplosion();
                      });
                    },
                  );
                }
              }
            } else if (hitId.startsWith('crate_')) {
              const crateId = Number(hitId.slice(6));
              const ci = worldCrates.findIndex((c) => c.id === crateId);
              if (ci !== -1) {
                const c = worldCrates[ci];
                c.vx += bDirX * 1.9;
                c.vz += bDirZ * 1.9;
                c.rotVelY = clamp(c.rotVelY + (Math.random() - 0.5) * 2.8, -6.0, 6.0);
                c.squashTimer = 0.14;
                if (canDamageWorldCrate(c)) {
                  c.hp -= LASER_DAMAGE_PER_TICK;
                }
                if (canDamageWorldCrate(c) && c.hp <= 0) {
                  playSpatialSoundAt(c.x, c.z, 22.0, 4.5, () => {
                    soundEngine.playWoodBreak(9.5);
                    soundEngine.playBarrelExplosion();
                  });
                  scratchExplosionPos.set(c.x, getTerrainElevation(c.x, c.z) + 0.55, c.z);
                  blitzExplosionSystem.spawnBlitzExplosion(scratchExplosionPos, 0.72, 'crate');
                  spawnDebrisChunks(
                    c.x,
                    0.55,
                    c.z,
                    c.kind === 'super' ? 'metal' : 'wood',
                    10,
                    bDirX * 2.5,
                    bDirZ * 2.5,
                  );
                  const crateDrop = evaluateCrateDestructionDrop(c.kind);
                  if (crateDrop.dropKind === 'health' || crateDrop.isPurpleSuperWeapon) {
                    spawnWorldPickup(crateDrop.dropKind, crateDrop.label, c.x, c.z, {
                      weaponId: crateDrop.weaponId,
                      remainingAmmo: crateDrop.remainingAmmo,
                      vy: 6.4,
                    });
                  }
                  rewardPlayerOnCrateDestroyed(c.x, c.z);
                  scene.remove(c.mesh);
                  worldCrates.splice(ci, 1);
                }
              }
            } else if (hitId.startsWith('prop_')) {
              const propId = Number(hitId.slice(5));
              const mp = activeMapProps.find((p) => p.id === propId && p.alive);
              if (mp) {
                if (mp.category === 'pushable') {
                  mp.vx += bDirX * 2.2;
                  mp.vz += bDirZ * 2.2;
                  mp.rotVelY += (Math.random() - 0.5) * 2.4;
                } else if (mp.destructible) {
                  mp.hp -= LASER_DAMAGE_PER_TICK;
                  if (mp.canJiggleOnHit) {
                    mp.jiggleTimer = 0.25;
                    mp.jiggleDirX = bDirX;
                    mp.jiggleDirZ = bDirZ;
                  }
                  if (mp.hp <= 0) {
                    mp.alive = false;
                    mp.wrapper.visible = false;
                    if (mp.kind === 'explosive_barrel') {
                      triggerBarrelExplosion(mp.x, mp.z);
                    } else {
                      spawnDebrisChunks(mp.x, 0.65, mp.z, mp.materialTag === 'wood' ? 'wood' : 'concrete', 10);
                    }
                  }
                }
              }
            } else if (hitId.startsWith('tree_')) {
              const treeId = Number(hitId.slice(5));
              const tr = trees.find((t) => t.id === treeId && t.alive);
              if (tr) {
                tr.hitFlashTimer = 0.08;
                tr.jiggleTimer = 0.32;
                tr.jiggleIntensity = 0.11;
                tr.jiggleDirX = bDirX;
                tr.jiggleDirZ = bDirZ;
              }
            } else if (hitId.startsWith('skyshield_')) {
              const ssMatch = /^skyshield_(red|blue)_([0-3])$/.exec(hitId);
              if (ssMatch) {
                const isRedTurret = ssMatch[1] === 'red';
                const sIdx = Number(ssMatch[2]);
                const targetSkyshields = getBaseSkyshieldTurrets(
                  isRedTurret ? redBase.baseGroup : blueBase.baseGroup,
                );
                const stTurret = targetSkyshields[sIdx];
                const plotState = (isRedTurret ? redCommanderBases : blueCommanderBases)[sIdx];
                if (stTurret && stTurret.isBuilt && stTurret.hp > 0) {
                  stTurret.hp = Math.max(0, stTurret.hp - LASER_DAMAGE_PER_TICK * 3);
                  if (stTurret.hp <= 0) {
                    stTurret.isBuilt = false;
                    stTurret.root.visible = false;
                    if (plotState) plotState.hasSkyshield = false;
                    if (isRedTurret && isPlayerTeam) score += 350;
                  }
                }
              }
            } else if (hitId.startsWith('struct_')) {
              const structId = hitId.slice(7);
              if (
                (structId === 'red_hq' || structId.startsWith('red_plot_')) &&
                isPlayerTeam &&
                currentPlayMode === 'match'
              ) {
                redBaseHp = Math.max(0, redBaseHp - LASER_DAMAGE_PER_TICK * 4);
                syncPadVisuals(redBase, redPadSlots, 'RED', redBaseHp);
                checkMatchDeathmatchWinCondition();
              } else if (
                (structId === 'blue_hq' || structId.startsWith('blue_plot_')) &&
                !isPlayerTeam &&
                currentPlayMode === 'match'
              ) {
                blueBaseHp = Math.max(0, blueBaseHp - LASER_DAMAGE_PER_TICK * 3);
                syncPadVisuals(blueBase, bluePadSlots, 'BLUE', blueBaseHp);
                checkMatchDeathmatchWinCondition();
              }
            }
          }
        }
      }

      // 4A. Chunk-Synced 3D Fog of War:
      // Hide field objects (Crates, Coins/Pickups, Land Mines/Ordnance, Crate Pads) and Enemy (Red) Units & Vehicles
      // outside the player's 20.8m 3D grass chunk streaming radius, with smooth scale fade at the inner edge!
      const bypassFogOfWar3D =
        currentPlayMode === 'editor' ||
        isFullMapOverview ||
        Boolean(skyshieldViewMode || buildingViewMode || planeViewMode) ||
        nukeStrikeState.phase !== 'idle';
      const fogGrassCenterX = activeFocusUnit ? activeFocusUnit.x : playerUnit.x;
      const fogGrassCenterZ = activeFocusUnit ? activeFocusUnit.z : playerUnit.z;
      applyGrassChunkSyncedFogOfWar3D({
        viewerX: fogGrassCenterX,
        viewerZ: fogGrassCenterZ,
        playMode: currentPlayMode,
        bypassFogOfWar: bypassFogOfWar3D,
        worldCrates,
        worldPickups,
        activeOrdnanceDevices,
        buddyUnits,
        tanks,
        activeMapProps,
        worldMode: worldModeRef.current,
        playerTeam: playerUnit.team,
      });
      if (npcCameraMode === 'npc_merchant' || npcCameraMode === 'house_interior' || mountedTank) {
        playerUnit.root.visible = false;
      }

      // Crate Pads dynamic chunk culling (commander base stacking pads & public warzone crate pads)
      const allPadGroups: Array<{ padGroup: THREE.Group; worldX: number; worldZ: number; isSafezoneHidden?: boolean }> = [];
      const isCurrentSafezone = worldModeRef.current === 'safezone' || cityArenaMode === 'safezone';
      for (const cp of [...blueBase.commanderPads, ...redBase.commanderPads]) {
        allPadGroups.push({ padGroup: cp.padGroup, worldX: cp.padX, worldZ: cp.padZ });
      }
      for (const pwp of publicWarzonePads) {
        allPadGroups.push({ padGroup: pwp.padGroup, worldX: pwp.worldX, worldZ: pwp.worldZ, isSafezoneHidden: isCurrentSafezone });
      }

      for (let i = 0; i < allPadGroups.length; i++) {
        const item = allPadGroups[i];
        if (item.isSafezoneHidden) {
          item.padGroup.visible = false;
          continue;
        }
        if (bypassFogOfWar3D) {
          item.padGroup.visible = true;
        } else {
          const evalRes = evaluateChunkSynced3DFogOfWar(item.worldX, item.worldZ, fogGrassCenterX, fogGrassCenterZ);
          item.padGroup.visible = evalRes.visible;
        }
      }

      for (let i = 0; i < projectiles.length; i++) {
        const p = projectiles[i];
        if (!p.active) continue;
        const yOff = computePlanetYOffset(p.pos.x, p.pos.z, planetPivotX, planetPivotZ, kCurve);
        const rx = planetPivotX + getPlanetShortestDelta(p.pos.x, planetPivotX);
        const ry = p.pos.y + yOff;
        const rz = planetPivotZ + getPlanetShortestDelta(p.pos.z, planetPivotZ);
        p.mesh.position.set(rx, ry, rz);
        p.mesh.lookAt(rx + p.vel.x, ry + p.vel.y, rz + p.vel.z);
      }
      if (editorCursorGroup.visible) {
        const cx = editorCursorGroup.position.x;
        const cz = editorCursorGroup.position.z;
        applyPlanetCurvatureToObject(
          editorCursorGroup,
          cx,
          getTerrainElevation(cx, cz) + 0.04,
          cz,
          planetPivotX,
          planetPivotZ,
          editorRotY,
          kCurve,
        );
      }

      // 4B. Update Muzzle Raycast Hit Detection (100m, Layer Mask Skipping Shooter, Target Lock-On)
      // Skip in Lobby / Safezone or when unarmed, and throttle passive target-lock raycasting to 30Hz when not firing!
      const showRaycastSight =
        state === 'playing' &&
        currentPlayMode !== 'editor' &&
        worldModeRef.current === 'warzone' &&
        cityArenaMode === 'warzone' &&
        !isFullMapOverview &&
        !skyshieldViewMode &&
        !buildingViewMode &&
        !planeViewMode &&
        (mountedTank
          ? mountedTank.vehicleKind !== 'truck'
          : playerUnit.alive &&
            playerUnit.carryingCrate === 'none' &&
            playerUnit.weaponId !== 'unarmed');
      muzzleRaycastGroup.visible = showRaycastSight;
      if (showRaycastSight) {
        if (isPointerDown || frameTickCount % 2 === 0 || !activeMuzzleRaycastResult) {
          updateMuzzleRaycastAndTargetLock(planetPivotX, planetPivotZ, kCurve, timeSec);
        }
      } else {
        targetLockGroup.visible = false;
        activeMuzzleRaycastResult = null;
      }

      // 4C. Hide legacy 3D billboard text boxes above pads & HQs to keep the viewport 100% clean
      camera.updateMatrixWorld();
      blueBase.hpSign.sprite.visible = false;
      redBase.hpSign.sprite.visible = false;
      for (const p of blueBase.commanderPads) {
        p.padSign.sprite.visible = false;
      }
      for (const p of redBase.commanderPads) {
        p.padSign.sprite.visible = false;
      }

      dirLight.position.set(
        finalLookX + blitzSunOffset.x,
        blitzSunOffset.y,
        finalLookZ + blitzSunOffset.z,
      );
      dirLight.target.position.set(finalLookX, 0, finalLookZ);
      dirLight.target.updateMatrixWorld();

      if (
        dirLight.shadow.map &&
        windUniforms.uDirShadowMap &&
        windUniforms.uDirShadowMatrix &&
        windUniforms.uHasDirShadow
      ) {
        windUniforms.uDirShadowMap.value =
          dirLight.shadow.map.depthTexture || dirLight.shadow.map.texture;
        windUniforms.uDirShadowMatrix.value.copy(dirLight.shadow.matrix);
        windUniforms.uHasDirShadow.value = 1.0;
      }

      if (buildingViewMode) {
        const w = renderer.domElement.clientWidth || window.innerWidth;
        const h = renderer.domElement.clientHeight || window.innerHeight;
        const halfW = Math.floor(w / 2);
        const halfH = Math.floor(h / 2);
        const aspect = halfW / Math.max(1, halfH);

        const cfg =
          buildingViewMode === 'hq'
            ? {
                orthoSize: 5.55,
                centerY: 4.55,
                front: [26, 4.55, -0.25],
                rear: [-26, 4.55, -0.25],
                left: [0, 4.55, 26],
                right: [0, 4.55, -26],
                lookFront: [0, 4.55, -0.25],
                lookRear: [0, 4.55, -0.25],
                lookLeft: [0, 4.55, 0],
                lookRight: [0, 4.55, 0],
              }
            : buildingViewMode === 'hangar'
            ? {
                orthoSize: 3.85,
                centerY: 3.15,
                front: [26, 3.15, 0],
                rear: [-26, 3.15, 0],
                left: [0, 3.15, -26],
                right: [0, 3.15, 26],
                lookFront: [0, 3.15, 0],
                lookRear: [0, 3.15, 0],
                lookLeft: [0, 3.15, 0],
                lookRight: [0, 3.15, 0],
              }
            : buildingViewMode === 'barracks'
            ? {
                orthoSize: 3.35,
                centerY: 2.45,
                front: [0, 2.45, 26],
                rear: [0, 2.45, -26],
                left: [-26, 2.45, 0],
                right: [26, 2.45, 0],
                lookFront: [0, 2.45, 0],
                lookRear: [0, 2.45, 0],
                lookLeft: [0, 2.45, 0],
                lookRight: [0, 2.45, 0],
              }
            : {
                orthoSize: 5.45,
                centerY: 4.45,
                front: [26, 4.45, -1.8],
                rear: [-26, 4.45, -1.8],
                left: [0, 4.45, 26],
                right: [0, 4.45, -26],
                lookFront: [0, 4.45, -1.8],
                lookRear: [0, 4.45, -1.8],
                lookLeft: [0.2, 4.45, 0],
                lookRight: [0.4, 4.45, 0],
              };

        const orthoCam = new THREE.OrthographicCamera(
          -cfg.orthoSize * aspect,
          cfg.orthoSize * aspect,
          cfg.orthoSize,
          -cfg.orthoSize,
          0.1,
          100,
        );
        renderer.setScissorTest(true);

        const renderQuad = (
          vx: number,
          vy: number,
          camPos: number[],
          lookPos: number[],
        ) => {
          renderer.setViewport(vx, vy, halfW, halfH);
          renderer.setScissor(vx, vy, halfW, halfH);
          orthoCam.up.set(0, 1, 0);
          orthoCam.position.set(camPos[0], camPos[1], camPos[2]);
          orthoCam.lookAt(lookPos[0], lookPos[1], lookPos[2]);
          windUniforms.uLightDirection.value
            .set(camPos[0] * 0.04 + 0.25, 0.82, camPos[2] * 0.04 + 0.25)
            .normalize();
          renderer.render(scene, orthoCam);
        };

        // Top-Left: FRONT ELEVATION
        renderQuad(0, halfH, cfg.front, cfg.lookFront);
        // Top-Right: REAR ELEVATION
        renderQuad(halfW, halfH, cfg.rear, cfg.lookRear);
        // Bottom-Left: LEFT SIDE ELEVATION
        renderQuad(0, 0, cfg.left, cfg.lookLeft);
        // Bottom-Right: RIGHT SIDE ELEVATION
        renderQuad(halfW, 0, cfg.right, cfg.lookRight);

        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, w, h);
      } else if (skyshieldViewMode === 'iso') {
        const w = renderer.domElement.clientWidth || window.innerWidth;
        const h = renderer.domElement.clientHeight || window.innerHeight;
        const halfW = Math.floor(w / 2);
        const halfH = Math.floor(h / 2);
        const aspect = halfW / Math.max(1, halfH);
        const orthoIsoSize = 1.62;
        const orthoCam = new THREE.OrthographicCamera(
          -orthoIsoSize * aspect,
          orthoIsoSize * aspect,
          orthoIsoSize,
          -orthoIsoSize,
          0.1,
          100,
        );
        renderer.setScissorTest(true);
        windUniforms.uLightDirection.value.set(0.35, 0.88, 0.32).normalize();

        // Top-Left: Rear-Right 3/4 view (exact angle from user's screenshot!)
        renderer.setViewport(0, halfH, halfW, halfH);
        renderer.setScissor(0, halfH, halfW, halfH);
        orthoCam.up.set(0, 1, 0);
        orthoCam.position.set(-10, 8.5, 11);
        orthoCam.lookAt(0.1, 0.85, 0);
        renderer.render(scene, orthoCam);

        // Top-Right: Front-Right 3/4 view
        renderer.setViewport(halfW, halfH, halfW, halfH);
        renderer.setScissor(halfW, halfH, halfW, halfH);
        orthoCam.position.set(11, 8.5, 10);
        orthoCam.lookAt(0.4, 0.85, 0);
        renderer.render(scene, orthoCam);

        // Bottom-Left: Rear-Left 3/4 view
        renderer.setViewport(0, 0, halfW, halfH);
        renderer.setScissor(0, 0, halfW, halfH);
        orthoCam.position.set(-10, 8.5, -11);
        orthoCam.lookAt(0.1, 0.85, 0);
        renderer.render(scene, orthoCam);

        // Bottom-Right: Front-Left 3/4 view
        renderer.setViewport(halfW, 0, halfW, halfH);
        renderer.setScissor(halfW, 0, halfW, halfH);
        orthoCam.position.set(11, 8.5, -10);
        orthoCam.lookAt(0.4, 0.85, 0);
        renderer.render(scene, orthoCam);

        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, w, h);
      } else if (skyshieldViewMode) {
        const w = renderer.domElement.clientWidth || window.innerWidth;
        const h = renderer.domElement.clientHeight || window.innerHeight;
        const halfW = Math.floor(w / 2);
        const halfH = Math.floor(h / 2);
        const aspect = halfW / Math.max(1, halfH);
        const orthoFrontSize = 1.48;
        const orthoSideSize = 1.72;
        const orthoCam = new THREE.OrthographicCamera(
          -orthoFrontSize * aspect,
          orthoFrontSize * aspect,
          orthoFrontSize,
          -orthoFrontSize,
          0.1,
          100,
        );
        const centerY = 0.98;
        renderer.setScissorTest(true);

        // 1. TOP-LEFT QUADRANT: FRONT ELEVATION (TAMPAK DEPAN) — Looking from +X toward 0
        orthoCam.left = -orthoFrontSize * aspect;
        orthoCam.right = orthoFrontSize * aspect;
        orthoCam.top = orthoFrontSize;
        orthoCam.bottom = -orthoFrontSize;
        orthoCam.updateProjectionMatrix();
        renderer.setViewport(0, halfH, halfW, halfH);
        renderer.setScissor(0, halfH, halfW, halfH);
        orthoCam.up.set(0, 1, 0);
        orthoCam.position.set(18, centerY, 0);
        orthoCam.lookAt(0, centerY, 0);
        windUniforms.uLightDirection.value.set(0.82, 0.58, 0.0).normalize();
        renderer.render(scene, orthoCam);

        // 2. TOP-RIGHT QUADRANT: REAR ELEVATION (TAMPAK BELAKANG) — Looking from -X toward 0
        renderer.setViewport(halfW, halfH, halfW, halfH);
        renderer.setScissor(halfW, halfH, halfW, halfH);
        orthoCam.up.set(0, 1, 0);
        orthoCam.position.set(-18, centerY, 0);
        orthoCam.lookAt(0, centerY, 0);
        windUniforms.uLightDirection.value.set(-0.82, 0.58, 0.0).normalize();
        renderer.render(scene, orthoCam);

        // 3. BOTTOM-LEFT QUADRANT: RIGHT SIDE ELEVATION (TAMPAK SAMPING KANAN) — Looking from +Z toward 0 (Barrel +X on Right)
        orthoCam.left = -orthoSideSize * aspect;
        orthoCam.right = orthoSideSize * aspect;
        orthoCam.top = orthoSideSize;
        orthoCam.bottom = -orthoSideSize;
        orthoCam.updateProjectionMatrix();
        renderer.setViewport(0, 0, halfW, halfH);
        renderer.setScissor(0, 0, halfW, halfH);
        orthoCam.up.set(0, 1, 0);
        orthoCam.position.set(0.55, 0.72, 18);
        orthoCam.lookAt(0.55, 0.72, 0);
        windUniforms.uLightDirection.value.set(0.0, 0.58, 0.82).normalize();
        renderer.render(scene, orthoCam);

        // 4. BOTTOM-RIGHT QUADRANT: LEFT SIDE ELEVATION — Looking from -Z toward 0 (Barrel +X on Left)
        renderer.setViewport(halfW, 0, halfW, halfH);
        renderer.setScissor(halfW, 0, halfW, halfH);
        orthoCam.up.set(0, 1, 0);
        orthoCam.position.set(0.55, 1.18, -18);
        orthoCam.lookAt(0.55, 1.18, 0);
        windUniforms.uLightDirection.value.set(0.0, 0.58, -0.82).normalize();
        renderer.render(scene, orthoCam);

        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, w, h);
      } else if (planeViewMode) {
        const w = renderer.domElement.clientWidth || window.innerWidth;
        const h = renderer.domElement.clientHeight || window.innerHeight;
        const halfW = Math.floor(w / 2);
        const halfH = Math.floor(h / 2);
        const aspect = halfW / Math.max(1, halfH);
        const orthoSize = 2.95;
        const orthoCam = new THREE.OrthographicCamera(
          -orthoSize * aspect,
          orthoSize * aspect,
          orthoSize,
          -orthoSize,
          0.1,
          100,
        );
        const centerY = 0.95;
        renderer.setScissorTest(true);

        // 1. TOP-LEFT QUADRANT: TOP VIEW (Nose +X pointing DOWN, Tail -X pointing UP)
        renderer.setViewport(0, halfH, halfW, halfH);
        renderer.setScissor(0, halfH, halfW, halfH);
        orthoCam.up.set(-1, 0, 0);
        orthoCam.position.set(-0.22, centerY + 18, 0);
        orthoCam.lookAt(-0.22, centerY, 0);
        windUniforms.uLightDirection.value.set(0.25, 1.0, 0.25).normalize();
        renderer.render(scene, orthoCam);

        // 2. TOP-RIGHT QUADRANT: BOTTOM VIEW (Nose +X pointing UP, Tail -X pointing DOWN)
        const topThrusters = scene.getObjectByName('TopThrustersGroup');
        const botThruster = scene.getObjectByName('BottomThrusterGroup');
        if (topThrusters) topThrusters.visible = false;
        if (botThruster) botThruster.visible = true;
        renderer.setViewport(halfW, halfH, halfW, halfH);
        renderer.setScissor(halfW, halfH, halfW, halfH);
        orthoCam.up.set(1, 0, 0);
        orthoCam.position.set(0.22, centerY - 18, 0);
        orthoCam.lookAt(0.22, centerY, 0);
        windUniforms.uLightDirection.value.set(0.25, -1.0, 0.25).normalize();
        renderer.render(scene, orthoCam);
        if (topThrusters) topThrusters.visible = true;
        if (botThruster) botThruster.visible = false;

        // 3. BOTTOM-LEFT QUADRANT: LEFT SIDE VIEW (Nose +X pointing RIGHT, Tail -X pointing LEFT)
        renderer.setViewport(0, 0, halfW, halfH);
        renderer.setScissor(0, 0, halfW, halfH);
        orthoCam.up.set(0, 1, 0);
        orthoCam.position.set(0, centerY + 0.15, 18);
        orthoCam.lookAt(0, centerY + 0.15, 0);
        windUniforms.uLightDirection.value.set(0.35, 0.75, 0.85).normalize();
        renderer.render(scene, orthoCam);

        // 4. BOTTOM-RIGHT QUADRANT: RIGHT SIDE VIEW (Nose +X pointing LEFT, Tail -X pointing RIGHT)
        renderer.setViewport(halfW, 0, halfW, halfH);
        renderer.setScissor(halfW, 0, halfW, halfH);
        orthoCam.up.set(0, 1, 0);
        orthoCam.position.set(0, centerY + 0.15, -18);
        orthoCam.lookAt(0, centerY + 0.15, 0);
        windUniforms.uLightDirection.value.set(0.35, 0.75, -0.85).normalize();
        renderer.render(scene, orthoCam);

        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, w, h);
      } else {
        if (frameTickCount % 3 === 0) {
          renderer.shadowMap.needsUpdate = true;
        }
        renderer.render(scene, camera);
      }

      // Smoothly rotate & bob the 3D Hologram shape on top of the Kiosk's side scale platform
      const holoTime = windUniforms.uTime.value;
      for (const cp of blueBase.commanderPads) {
        const sh = cp.kioskMesh?.userData?.sideHologram as
          | { holoTurntable: THREE.Group }
          | undefined;
        if (sh) {
          sh.holoTurntable.rotation.y = holoTime * 1.35;
          sh.holoTurntable.position.y = 1.05 + Math.sin(holoTime * 2.6) * 0.06;
        }
      }

      // Update selected character 3D flat ground targeting ring (#22c55e)
      if (selectedCharacterTarget && selectedCharacterTarget.root) {
        const rootPos = selectedCharacterTarget.root.position;
        const groundY = getTerrainElevation(rootPos.x, rootPos.z);
        characterSelectionRing.position.set(rootPos.x, groundY + 0.04, rootPos.z);
        characterSelectionRing.rotation.z += dt * 1.5;
      }

      // Update 2D DOM floating prompt buttons with pixel-perfect Math.round() & Hysteresis at 60 FPS
      updateDirectDomPrompts();

      if (
        dirLight.shadow.map &&
        windUniforms.uDirShadowMap &&
        windUniforms.uDirShadowMatrix &&
        windUniforms.uHasDirShadow
      ) {
        windUniforms.uDirShadowMap.value =
          dirLight.shadow.map.depthTexture || dirLight.shadow.map.texture;
        windUniforms.uDirShadowMatrix.value.copy(dirLight.shadow.matrix);
        windUniforms.uHasDirShadow.value = 1.0;
      }

      // 5. Periodic HUD Snapshot Sync (~4Hz periodic sync while event-driven emitHudImmediately() remains instant)
      hudSyncAccumulator += dt;
      if (hudSyncAccumulator >= 0.25) {
        hudSyncAccumulator = 0;
        onHudUpdate(buildHudSnapshot(null));
      }

      if (isSoftwareGl) {
        afterDraw(() => {
          if (!isDisposed) animate(performance.now());
        });
      } else {
        rafId = requestAnimationFrame(animate);
      }
    };

    const scratchProjectVec = new THREE.Vector3();
    const projectWorldToScreenPixels = (
      wx: number,
      wy: number,
      wz: number,
    ): { x: number; y: number; visible: boolean } => {
      const pvx = camFollowPos.x;
      const pvz = camFollowPos.z;
      const rx = pvx + getPlanetShortestDelta(wx, pvx);
      const rz = pvz + getPlanetShortestDelta(wz, pvz);
      const ry = wy + computePlanetYOffset(wx, wz, pvx, pvz, PLANET_CURVATURE_STRENGTH);
      scratchProjectVec.set(rx, ry, rz);
      scratchProjectVec.project(camera);
      if (scratchProjectVec.z < -1.0 || scratchProjectVec.z > 1.0) {
        return { x: 0, y: 0, visible: false };
      }
      const w = window.innerWidth;
      const h = window.innerHeight;
      const sx = Math.round(((scratchProjectVec.x + 1.0) * 0.5) * w);
      const sy = Math.round(((1.0 - scratchProjectVec.y) * 0.5) * h);
      const visible = sx >= 12 && sx <= w - 12 && sy >= 12 && sy <= h - 12;
      return { x: sx, y: sy, visible };
    };

    const isBuildingViewUrlParam =
      typeof window !== 'undefined' &&
      Boolean(new URLSearchParams(window.location.search).get('buildingview'));

    updateDirectDomPrompts = () => {
      if (promptOverlay) {
        promptOverlay.setAttribute('data-city-arena-mode', cityArenaMode);
        promptOverlay.setAttribute('data-world-mode', worldModeRef.current);
        promptOverlay.setAttribute(
          'data-player-weapon-mesh-visible',
          String(Boolean(playerUnit?.rig?.weaponRigGroup?.visible)),
        );
      }
      if (
        playModeRef.current === 'editor' ||
        gameStateRef.current !== 'playing' ||
        isBuildingViewUrlParam
      ) {
        kioskPromptBtn.style.display = 'none';
        teleportKioskHexBtn.style.display = 'none';
        cratePromptBtn.style.display = 'none';
        padCraftPromptBtn.style.display = 'none';
        padDepositPromptBtn.style.display = 'none';
        lobbyTramPromptBtn.style.display = 'none';
        lobbyRedPortalPromptBtn.style.display = 'none';
        lobbyBluePortalPromptBtn.style.display = 'none';
        lobbyEnterCityPromptBtn.style.display = 'none';
        rideTramPromptBtn.style.display = 'none';
        exitTramPromptBtn.style.display = 'none';
        npcMerchantPromptBtn.style.display = 'none';
        enterHousePromptBtn.style.display = 'none';
        socialSpeechBubbleEl.style.display = 'none';
        bottomSitActionBtn.style.display = 'none';
        for (let si = 0; si < seatIndicatorBtns.length; si++) {
          seatIndicatorBtns[si].btn.style.display = 'none';
        }
        return;
      }

      const actorX = mountedTank ? mountedTank.x : playerUnit.x;
      const actorZ = mountedTank ? mountedTank.z : playerUnit.z;
      const w = window.innerWidth;
      const h = window.innerHeight;

      // 0A-0. Floating "TALK" at Lobby Mini Café (-94.0, -13.8) or East Beach House (85.8, 60.0)
      const dCafeNpc = getPlanetShortestDistance(actorX, actorZ, -94.0, -13.8);
      const dBeachNpc = getPlanetShortestDistance(actorX, actorZ, 85.8, 60.0);
      const nearCafeNow = worldModeRef.current === 'lobby' && dCafeNpc <= 6.2;
      const nearBeachNow = worldModeRef.current !== 'lobby' && dBeachNpc <= 6.8;
      if ((nearCafeNow || nearBeachNow) && npcCameraMode === 'none' && !isKioskModalOpenCanvas) {
        const mx = nearBeachNow ? 85.8 : -94.0;
        const mz = nearBeachNow ? 60.0 : -13.8;
        const my = getTerrainElevation(mx, mz) + 2.65;
        const proj = projectWorldToScreenPixels(mx, my, mz);
        const sx = proj.visible ? proj.x : clamp(proj.x, 96, Math.max(96, w - 96));
        const sy = proj.visible ? proj.y : clamp(proj.y, 64, Math.max(64, h - 64));
        npcMerchantPromptBtn.style.display = 'block';
        npcMerchantPromptBtn.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -50%)`;
      } else {
        npcMerchantPromptBtn.style.display = 'none';
      }

      // 0A-1. Floating "MASUK RUMAH [E]" at claimed plot doorway in Safezone City Mode
      let nearClaimedHouseDoorPos: { x: number; z: number } | null = null;
      if (cityArenaMode === 'safezone' && worldModeRef.current === 'safezone' && npcCameraMode === 'none') {
        for (let pi = 0; pi < 4; pi++) {
          const bPlot = blueCommanderBases[pi];
          if (isCommanderBasePlotActive(bPlot)) {
            const pPad = blueBase.commanderPads[pi];
            if (pPad && getPlanetShortestDistance(actorX, actorZ, pPad.worldX, pPad.worldZ) <= 10.5) {
              nearClaimedHouseDoorPos = { x: pPad.worldX, z: pPad.worldZ };
              break;
            }
          }
          const rPlot = redCommanderBases[pi];
          if (isCommanderBasePlotActive(rPlot)) {
            const pPad = redBase.commanderPads[pi];
            if (pPad && getPlanetShortestDistance(actorX, actorZ, pPad.worldX, pPad.worldZ) <= 10.5) {
              nearClaimedHouseDoorPos = { x: pPad.worldX, z: pPad.worldZ };
              break;
            }
          }
        }
      }
      if (nearClaimedHouseDoorPos && !isKioskModalOpenCanvas) {
        const hy = getTerrainElevation(nearClaimedHouseDoorPos.x, nearClaimedHouseDoorPos.z) + 3.2;
        const proj = projectWorldToScreenPixels(
          nearClaimedHouseDoorPos.x,
          hy,
          nearClaimedHouseDoorPos.z,
        );
        const sx = proj.visible ? proj.x : clamp(proj.x, 96, Math.max(96, w - 96));
        const sy = proj.visible ? proj.y : clamp(proj.y, 64, Math.max(64, h - 64));
        enterHousePromptBtn.style.display = 'block';
        enterHousePromptBtn.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -50%)`;
      } else {
        enterHousePromptBtn.style.display = 'none';
      }

      // 0A & 0B. Teleport Kiosk Proximity Trigger (Mendekati -> Munculkan SVG Segi Enam di Mesin Kiosk)
      let nearProximityKiosk: 'none' | 'lobby_warzone' | 'lobby_safezone' | 'halte_to_lobby' = 'none';
      let nearKioskWorldX = 0;
      let nearKioskWorldZ = 0;
      if (npcCameraMode === 'none' && !isKioskModalOpenCanvas) {
        if (worldModeRef.current === 'lobby') {
          const dWz = getPlanetShortestDistance(actorX, actorZ, -81.8, -8.2);
          const dSz = getPlanetShortestDistance(actorX, actorZ, -81.8, -14.8);
          if (dWz <= 3.2 && dWz <= dSz) {
            nearProximityKiosk = 'lobby_warzone';
            nearKioskWorldX = -81.8;
            nearKioskWorldZ = -8.2;
          } else if (dSz <= 3.2) {
            nearProximityKiosk = 'lobby_safezone';
            nearKioskWorldX = -81.8;
            nearKioskWorldZ = -14.8;
          }
        } else {
          const dHalte = getPlanetShortestDistance(actorX, actorZ, -61.95, 0.0);
          if (dHalte <= 3.2) {
            nearProximityKiosk = 'halte_to_lobby';
            nearKioskWorldX = -61.95;
            nearKioskWorldZ = 0.0;
          }
        }
      }
      currentNearTeleportKiosk = nearProximityKiosk;

      // Tampilkan ikon SVG Segi Enam pada mesin Kiosk ketika didekati
      if (nearProximityKiosk !== 'none') {
        const ky = getTerrainElevation(nearKioskWorldX, nearKioskWorldZ) + 2.5;
        const proj = projectWorldToScreenPixels(nearKioskWorldX, ky, nearKioskWorldZ);
        if (proj.visible) {
          teleportKioskHexBtn.style.display = 'block';
          teleportKioskHexBtn.style.transform = `translate3d(${proj.x}px, ${proj.y}px, 0) translate(-50%, -50%)`;
        } else {
          teleportKioskHexBtn.style.display = 'none';
        }
      } else {
        teleportKioskHexBtn.style.display = 'none';
      }

      // Jika pemain menjauh lebih dari 12m dari Kiosk yang sedang aktif/terbuka, tutup seleksi Kiosk
      if (activeClickedTeleportKiosk !== 'none') {
        const activeKx = activeClickedTeleportKiosk === 'halte_to_lobby' ? -61.95 : -81.8;
        const activeKz =
          activeClickedTeleportKiosk === 'halte_to_lobby'
            ? 0.0
            : activeClickedTeleportKiosk === 'lobby_warzone'
            ? -8.2
            : -14.8;
        if (getPlanetShortestDistance(actorX, actorZ, activeKx, activeKz) > 12.0) {
          clearTeleportKioskSelection();
        }
      }

      lobbyTramPromptBtn.style.display = 'none';
      lobbyRedPortalPromptBtn.style.display = 'none';
      lobbyBluePortalPromptBtn.style.display = 'none';
      lobbyEnterCityPromptBtn.style.display = 'none';

      // 0B-2. Floating 3D Circular Seat Indicators (Blue & Green Discs) + Bottom "Duduk" Bar
      currentNearestLobbySeat = null;
      if (worldModeRef.current === 'lobby' && npcCameraMode === 'none' && !isKioskModalOpenCanvas && !mountedTank) {
        let bestSeatIdx = -1;
        let bestSeatDist = 4.8;
        for (let si = 0; si < LOBBY_SEAT_SPOTS.length; si++) {
          const spot = LOBBY_SEAT_SPOTS[si];
          const d = getPlanetShortestDistance(actorX, actorZ, spot.x, spot.z);
          if (d <= bestSeatDist) {
            bestSeatDist = d;
            bestSeatIdx = si;
          }
        }
        if (bestSeatIdx !== -1) {
          currentNearestLobbySeat = LOBBY_SEAT_SPOTS[bestSeatIdx];
        }

        for (let si = 0; si < LOBBY_SEAT_SPOTS.length; si++) {
          const spot = LOBBY_SEAT_SPOTS[si];
          const entry = seatIndicatorBtns[si];
          const isCurrentlySeatedHere =
            Boolean(playerUnit.isSitting) && activeSeatedSpot?.id === spot.id;
          const dist = getPlanetShortestDistance(actorX, actorZ, spot.x, spot.z);
          if (isCurrentlySeatedHere || dist > 18.0) {
            entry.btn.style.display = 'none';
            continue;
          }
          const isNearestActive = si === bestSeatIdx;
          const desiredState = isNearestActive ? 'green' : 'blue';
          if (entry.state !== desiredState) {
            entry.state = desiredState;
            entry.btn.innerHTML = isNearestActive ? SEAT_DISC_GREEN_HTML : SEAT_DISC_BLUE_HTML;
          }
          const bobOffset = Math.sin(performance.now() * 0.0032 + si * 0.85) * 0.07;
          const syWorld = getTerrainElevation(spot.x, spot.z) + spot.indicatorHeightY + bobOffset;
          const proj = projectWorldToScreenPixels(spot.x, syWorld, spot.z);
          if (proj.visible && proj.x >= 24 && proj.x <= w - 24 && proj.y >= 24 && proj.y <= h - 24) {
            entry.btn.style.display = 'block';
            entry.btn.style.transform = `translate3d(${proj.x}px, ${proj.y}px, 0) translate(-50%, -50%)`;
          } else {
            entry.btn.style.display = 'none';
          }
        }

        if (playerUnit.isSitting && activeSeatedSpot) {
          bottomSitActionBtn.innerHTML = getSitBarHtml('Stand Up');
          bottomSitActionBtn.style.display = 'block';
          bottomSitActionBtn.style.transform = `translate3d(${Math.round(w * 0.5)}px, ${h - 68}px, 0) translate(-50%, -50%)`;
        } else if (currentNearestLobbySeat) {
          bottomSitActionBtn.innerHTML = getSitBarHtml('Sit');
          bottomSitActionBtn.style.display = 'block';
          bottomSitActionBtn.style.transform = `translate3d(${Math.round(w * 0.5)}px, ${h - 68}px, 0) translate(-50%, -50%)`;
        } else {
          bottomSitActionBtn.style.display = 'none';
        }
      } else {
        bottomSitActionBtn.style.display = 'none';
        for (let si = 0; si < seatIndicatorBtns.length; si++) {
          seatIndicatorBtns[si].btn.style.display = 'none';
        }
      }

      // 0C. Floating "RIDE TRAM" & "EXIT TRAM" Buttons above the City Tram
      const tramNowForPrompt = cityTram.getState();
      if (ridingTramCarIdx !== null && !isKioskModalOpenCanvas) {
        const activeCar = ridingTramCarIdx === 0 ? tramNowForPrompt.car1 : tramNowForPrompt.car2;
        const ty = getTerrainElevation(activeCar.x, activeCar.z) + 3.45;
        const proj = projectWorldToScreenPixels(activeCar.x, ty, activeCar.z);
        const sx = proj.visible ? proj.x : Math.round(w * 0.5);
        const sy = proj.visible ? proj.y : Math.round(h * 0.32);
        exitTramPromptBtn.style.display = 'block';
        exitTramPromptBtn.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -50%)`;
        rideTramPromptBtn.style.display = 'none';
      } else {
        exitTramPromptBtn.style.display = 'none';
        const tramBoardCheck =
          !mountedTank &&
          playerUnit.alive &&
          worldModeRef.current !== 'lobby'
            ? canUnitBoardCityTramAtAnyPoint(
                actorX,
                actorZ,
                tramNowForPrompt,
                cityArenaMode === 'safezone' ? 6.2 : 3.6,
              )
            : { canBoard: false, carIndex: 0 as const, distanceMeters: 999 };
        if (tramBoardCheck.canBoard && !isKioskModalOpenCanvas) {
          const targetCar =
            tramBoardCheck.carIndex === 0 ? tramNowForPrompt.car1 : tramNowForPrompt.car2;
          const ty = getTerrainElevation(targetCar.x, targetCar.z) + 3.25;
          const proj = projectWorldToScreenPixels(targetCar.x, ty, targetCar.z);
          const sx = proj.visible ? proj.x : clamp(proj.x, 80, Math.max(80, w - 80));
          const sy = proj.visible ? proj.y : clamp(proj.y, 64, Math.max(64, h - 64));
          rideTramPromptBtn.style.display = 'block';
          rideTramPromptBtn.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -50%)`;
        } else {
          rideTramPromptBtn.style.display = 'none';
        }
      }

      // 0D. Overhead Social Talk Speech Bubble above Player Character's Head
      if (socialTalkMessage && socialTalkTimer > 0 && playerUnit && playerUnit.alive) {
        const bx = playerUnit.x;
        const bz = playerUnit.z;
        const by = getTerrainElevation(bx, bz) + (ridingTramCarIdx !== null ? 3.9 : 2.95);
        const proj = projectWorldToScreenPixels(bx, by, bz);
        const sx = proj.visible ? proj.x : Math.round(w * 0.5);
        const sy = proj.visible ? proj.y : Math.round(h * 0.38);
        socialSpeechBubbleEl.style.display = 'block';
        socialSpeechBubbleEl.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -100%)`;
      } else {
        socialSpeechBubbleEl.style.display = 'none';
      }

      // Character click action menu is handled by the bottom-center fixed React HUD, not floating above 3D head

      if (cityArenaMode === 'safezone' && worldModeRef.current !== 'lobby') {
        kioskPromptBtn.style.display = 'none';
        cratePromptBtn.style.display = 'none';
        padCraftPromptBtn.style.display = 'none';
        padDepositPromptBtn.style.display = 'none';
        return;
      }

      // 1. Kiosk Prompt: [B] KIOSK on ALL 8 Base Kiosks + Lobby NEAR Terminal (True world position via getWorldPosition, Math.round pixel transform, 2.6m -> 2.9m Hysteresis)
      const nearestKiosk = findNearestBaseKiosk(actorX, actorZ);
      const kx = nearestKiosk.x;
      const kz = nearestKiosk.z;
      const distToKiosk = nearestKiosk.distance;
      const kioskThreshold = isKioskPromptActive ? INTERACT_EXIT_RADIUS : INTERACT_ENTER_RADIUS;
      const nearKioskNow = distToKiosk <= kioskThreshold;
      isKioskPromptActive = nearKioskNow;

      if (nearKioskNow && !isKioskModalOpenCanvas) {
        const ky = getTerrainElevation(kx, kz) + 2.5;
        const proj = projectWorldToScreenPixels(kx, ky, kz);
        if (proj.visible) {
          kioskPromptBtn.style.display = 'block';
          kioskPromptBtn.style.transform = `translate3d(${proj.x}px, ${proj.y}px, 0) translate(-50%, -50%)`;
        } else {
          kioskPromptBtn.style.display = 'none';
        }
      } else {
        kioskPromptBtn.style.display = 'none';
      }

      // 2. On-Foot Crate Pickup: [E] AMBIL (Static terrain anchor, Math.round pixel transform, 2.6m -> 2.9m Hysteresis)
      if (!mountedTank && ridingTramCarIdx === null && playerUnit.alive && playerUnit.carryingCrate === 'none') {
        let nearestCrate: WorldCrate | null = null;
        let bestDist = 999;
        for (let i = 0; i < worldCrates.length; i++) {
          const c = worldCrates[i];
          if (c.state === 'grounded' || c.state === 'falling') {
            const d = getPlanetShortestDistance(c.x, c.z, playerUnit.x, playerUnit.z);
            const limit = activeCratePromptId === c.id ? INTERACT_EXIT_RADIUS : INTERACT_ENTER_RADIUS;
            if (d <= limit && d < bestDist) {
              bestDist = d;
              nearestCrate = c;
            }
          }
        }

        if (nearestCrate) {
          activeCratePromptId = nearestCrate.id;
          const cy = getTerrainElevation(nearestCrate.x, nearestCrate.z) + 0.95;
          const proj = projectWorldToScreenPixels(nearestCrate.x, cy, nearestCrate.z);
          if (proj.visible) {
            cratePromptBtn.style.display = 'block';
            cratePromptBtn.style.transform = `translate3d(${proj.x}px, ${proj.y}px, 0) translate(-50%, -50%)`;
          } else {
            cratePromptBtn.style.display = 'none';
          }
        } else {
          activeCratePromptId = null;
          cratePromptBtn.style.display = 'none';
        }
      } else {
        activeCratePromptId = null;
        cratePromptBtn.style.display = 'none';
      }

      // 3. Stacking Pad Prompts (2.6m -> 2.9m Hysteresis)
      const distToPad = getPlanetShortestDistance(actorX, actorZ, blueBase.padX, blueBase.padZ);
      const padEval = evaluateStackingPadRecipe(bluePadSlots);

      // Pad Craft Prompt
      const padCraftThreshold = isPadCraftPromptActive ? INTERACT_EXIT_RADIUS : INTERACT_ENTER_RADIUS;
      if (distToPad <= padCraftThreshold && padEval.totalCrates > 0) {
        isPadCraftPromptActive = true;
        const py = getTerrainElevation(blueBase.padX, blueBase.padZ) + 2.0;
        const proj = projectWorldToScreenPixels(blueBase.padX, py, blueBase.padZ);
        if (proj.visible) {
          padCraftPromptBtn.style.display = 'block';
          padCraftPromptBtn.style.transform = `translate3d(${proj.x}px, ${proj.y}px, 0) translate(-50%, -50%)`;
        } else {
          padCraftPromptBtn.style.display = 'none';
        }
      } else {
        isPadCraftPromptActive = false;
        padCraftPromptBtn.style.display = 'none';
      }

      // Pad Deposit Prompt
      const padDepositThreshold = isPadDepositPromptActive ? INTERACT_EXIT_RADIUS : INTERACT_ENTER_RADIUS;
      if (
        distToPad <= padDepositThreshold &&
        ((!mountedTank && playerUnit.carryingCrate !== 'none') ||
          (mountedTank && mountedTank.storedCrates.length > 0))
      ) {
        isPadDepositPromptActive = true;
        const py = getTerrainElevation(blueBase.padX, blueBase.padZ) + 1.45;
        const proj = projectWorldToScreenPixels(blueBase.padX, py, blueBase.padZ);
        if (proj.visible) {
          padDepositPromptBtn.style.display = 'block';
          padDepositPromptBtn.style.transform = `translate3d(${proj.x}px, ${proj.y}px, 0) translate(-50%, -50%)`;
        } else {
          padDepositPromptBtn.style.display = 'none';
        }
      } else {
        isPadDepositPromptActive = false;
        padDepositPromptBtn.style.display = 'none';
      }
    };

    const buildHudSnapshot = (outcome: 'victory' | 'defeat' | null): HudSnapshot => {
      const padEval = evaluateStackingPadRecipe(bluePadSlots);
      const orderSpec = BUILD_ORDER_SPECS[buildOrder];
      const actorX = mountedTank ? mountedTank.x : playerUnit.x;
      const actorZ = mountedTank ? mountedTank.z : playerUnit.z;

      let contextHint =
        playerUnit.weaponId === 'unarmed'
          ? `WASD Move · [Space] Jump · Left-Click: Punch · [F] Kick / Craft · [E] Grab Crate`
          : `WASD Move · [Space] Jump · [4] Punch · [F] Kick / Craft · [E] Grab Crate`;
      if (playModeRef.current === 'editor') {
        contextHint = `Left-Click: Place · Right-Click: Delete · [R] Rotate (${Math.round((editorRotY * 180) / Math.PI)}°) · [ / ] Scale (${editorScale.toFixed(2)}x) · WASD Pan Camera`;
      } else if (ridingTramCarIdx !== null) {
        contextHint = `Aboard City Tram (Car ${ridingTramCarIdx + 1}) [SAFE & HP REGEN] · [G / F / Space] Exit Anywhere`;
      } else if (mountedTank) {
        if (mountedTank.vehicleKind === 'plane') {
          const altVal = mountedTank.altitude ?? 0;
          const flightStatus =
            altVal < 0.3
              ? 'Grounded (Ready for Take-Off)'
              : altVal >= 8.0
              ? `High-Altitude Flight Above Trees (${altVal.toFixed(1)}m)`
              : `Airborne (${altVal.toFixed(1)}m)`;
          contextHint = `Blitz Plane [${flightStatus}] · [W] Throttle · [Space/E] Climb (Take-Off) · [C/S] Brake & Descend · [G] Exit`;
        } else if (mountedTank.vehicleKind === 'truck') {
          contextHint = `Dump Truck (${mountedTank.storedCrates.length}/${DUMP_TRUCK_MAX_CRATES} Crates) · [E] Hydraulic Dump · [G] Exit`;
        } else {
          const vLabel = mountedTank.isSuper ? 'Tyrant Tank' : 'Blitz Tank';
          contextHint = `Driving ${vLabel} (${mountedTank.storedCrates.length}/4 Crates) · [G] Exit`;
        }
      } else if (playerUnit.carryingCrate !== 'none') {
        const nearTruck = tanks.find(
          (t) =>
            t.vehicleKind === 'truck' &&
            t.hp > 0 &&
            getPlanetShortestDistance(t.x, t.z, actorX, actorZ) <= 6.8,
        );
        if (nearTruck) {
          contextHint =
            nearTruck.storedCrates.length < DUMP_TRUCK_MAX_CRATES
              ? `Near Dump Truck (${nearTruck.storedCrates.length}/${DUMP_TRUCK_MAX_CRATES} Crates) · [E] / Approach Bed to Load 1 Crate`
              : `Dump Truck Bed Full (${DUMP_TRUCK_MAX_CRATES}/${DUMP_TRUCK_MAX_CRATES} Crates) · [G] Drive`;
        } else {
          contextHint = `Carrying Crate Overhead · [E] Throw onto Pad (${padEval.totalCrates}/${orderSpec.targetCrates}) or Load into Truck Bed`;
        }
      } else if (getPlanetShortestDistance(actorX, actorZ, blueBase.padX, blueBase.padZ) <= 8.5 && padEval.totalCrates > 0) {
        contextHint = `Near Pad · [F] Craft ${padEval.outputName} · [B] Pad Kiosk Terminal`;
      } else if (
        getPlanetShortestDistance(actorX, actorZ, getBlueKioskWorldCenter(0).x, getBlueKioskWorldCenter(0).z) <= 6.8 ||
        getPlanetShortestDistance(actorX, actorZ, blueBase.padX, blueBase.padZ) <= 6.8
      ) {
        contextHint = `Near Self-Service Pad Kiosk Terminal · [B / E / F] Open Weapon Priority, Base Upgrade & Crate Airdrop Menu`;
      } else {
        let closestVehicle: TankVehicle | null = null;
        let closestDist = 7.5;
        for (const t of tanks) {
          if (!t.occupiedByPlayer && t.hp > 0) {
            const d = getPlanetShortestDistance(t.x, t.z, actorX, actorZ);
            if (d <= closestDist) {
              closestDist = d;
              closestVehicle = t;
            }
          }
        }
        if (closestVehicle) {
          contextHint =
            closestVehicle.vehicleKind === 'plane'
              ? 'Near Blitz Plane (Grounded) · [G] Enter Cockpit & Take-Off'
              : closestVehicle.vehicleKind === 'truck'
              ? `Near Dump Truck (${closestVehicle.storedCrates.length}/${DUMP_TRUCK_MAX_CRATES} Crates) · Load Crates One-by-One or [G] Drive`
              : 'Near Blitz Tank · [G] Mount Cannon Turret';
        } else if (
          canUnitBoardCityTramAtAnyPoint(actorX, actorZ, cityTram.getState(), 3.2).canBoard
        ) {
          contextHint =
            'Near City Tram · [G] Board Tram (Take Cover & Exit Anywhere)';
        }
      }

      if (activeMuzzleRaycastResult?.isTargetLocked && activeMuzzleRaycastResult.targetLabel) {
        contextHint = `TARGET LOCKED: ${activeMuzzleRaycastResult.targetLabel} (${activeMuzzleRaycastResult.distance.toFixed(1)}m) · ${contextHint}`;
      }

      // Build Mini-Radar dots & Personal Command Center Radar state from live 3D entities
      const myPlot = blueCommanderBases[0];
      const activeSupplyLocId = supplyDropSchedule.warningActive
        ? supplyDropSchedule.nextLocationId
        : supplyDropSchedule.nextLocationId === 'CENTRAL_OASIS'
          ? 'HARBOR_DOCK'
          : 'CENTRAL_OASIS';
      const activeSupplySpec = SUPPLY_DROP_LOCATIONS[activeSupplyLocId];
      const radarEvaluation = evaluatePlayerCommandCenterRadarAndMinimapDots({
        myPlot,
        buddyUnits,
        tanks,
        playerUnit,
        mountedTank,
        teamCommand: playerUnit.assignedRole ?? teamCommand,
        actorX,
        actorZ,
        activeSupplyDropSignal:
          supplyDropSchedule.warningActive || supplyDropBeaconLingeringTimer > 0
            ? { x: activeSupplySpec.x, z: activeSupplySpec.z }
            : null,
        worldCrates,
        worldPickups,
        activeMapProps,
        playMode: playModeRef.current,
        bypassDistanceCulling:
          playModeRef.current === 'editor' ||
          (typeof window !== 'undefined' &&
            Boolean(
              new URLSearchParams(window.location.search).get('fullmap') === '1' ||
                new URLSearchParams(window.location.search).get('skyshieldview') ||
                new URLSearchParams(window.location.search).get('buildingview') ||
                new URLSearchParams(window.location.search).get('planeview'),
            )) ||
          nukeStrikeState.phase !== 'idle',
      });
      const radarDots: RadarDot[] = radarEvaluation.radarDots;

      const personalSquad = buddyUnits.filter(
        (b) => b.team === 'blue' && b.alive && b.ownerCommanderId === 0,
      );
      const activePersonalIdx = Math.max(0, personalSquad.indexOf(playerUnit));
      const blueSkyshieldsBuilt = getBaseSkyshieldTurrets(blueBase.baseGroup).filter(
        (st) => st.isBuilt,
      ).length;
      const activeRecipeSpec = useCustomHologramRecipe
        ? KIOSK_BUILD_PRIORITY_RECIPES[activePriorityRecipe]
        : null;
      const nearestKioskHud = findNearestBaseKiosk(actorX, actorZ);
      const nearNearTerminalHud =
        getPlanetShortestDistance(
          actorX,
          actorZ,
          LOBBY_NEAR_TERMINAL_SPEC.x,
          LOBBY_NEAR_TERMINAL_SPEC.z,
        ) <= LOBBY_NEAR_TERMINAL_SPEC.interactRadius;
      const isNearKiosk =
        isKioskPromptActive ||
        nearestKioskHud.distance <= INTERACT_EXIT_RADIUS ||
        nearNearTerminalHud;
      const nearPlotObj =
        nearestKioskHud.team === 'blue'
          ? blueCommanderBases[nearestKioskHud.plotIndex]
          : redCommanderBases[nearestKioskHud.plotIndex];
      const nearKioskIsEmptyPlot = nearPlotObj ? !isCommanderBasePlotActive(nearPlotObj) : false;
      const activeBluePlotIndices = blueCommanderBases
        .filter((p) => isCommanderBasePlotActive(p))
        .map((p) => p.commanderIndex);
      const activeRedPlotIndices = redCommanderBases
        .filter((p) => isCommanderBasePlotActive(p))
        .map((p) => p.commanderIndex);
      const inLobbySafezoneNow = worldModeRef.current === 'lobby';
      const nearLobbyReturnPadNow =
        worldModeRef.current !== 'lobby' && isUnitNearLobbyTramReturnPad(actorX, actorZ);
      const nearLobbyGoldExchangeNow =
        getPlanetShortestDistance(
          actorX,
          actorZ,
          LOBBY_GOLD_EXCHANGE_SPEC.x,
          LOBBY_GOLD_EXCHANGE_SPEC.z,
        ) <= LOBBY_GOLD_EXCHANGE_SPEC.interactRadius ||
        getPlanetShortestDistance(actorX, actorZ, -94.0, -13.8) <= 6.2 ||
        getPlanetShortestDistance(actorX, actorZ, 85.8, 60.0) <= 6.8;
      const hudTargetCrates = activeRecipeSpec
        ? activeRecipeSpec.targetCrates
        : orderSpec.targetCrates;
      const hudHarvesterLifecycle = evaluateContractHarvesterLifecycle({
        hasActiveBuildContract,
        currentPadCrates: padEval.totalCrates,
        targetContractCrates: hudTargetCrates,
      });
      const blueWarzoneRoamersCount = buddyUnits.filter(
        (u) => u.alive && u.team === 'blue' && (u.isPlayer || !sessionHarvesterUnitIds.includes(u.id)),
      ).length;
      const redWarzoneRoamersCount = buddyUnits.filter(
        (u) => u.alive && u.team === 'red' && !sessionHarvesterUnitIds.includes(u.id),
      ).length;
      const popBar = evaluateOpenWarzonePopulationBar({
        blueClaimedBasesCount: activeBluePlotIndices.length,
        redClaimedBasesCount: activeRedPlotIndices.length,
        blueExtraRoamers: Math.max(4, blueWarzoneRoamersCount + 4),
        redExtraRoamers: Math.max(5, redWarzoneRoamersCount + 2),
        playerTeam: playerUnit.team,
        isPlayerInLobby: inLobbySafezoneNow,
      });

      if (inLobbySafezoneNow) {
        contextHint =
          'SAFEZONE LOBBY · Exchange Gold at LOBBY GOLD EXCHANGE, NEAR NFT Terminal [B/E], or Step on a Portal (WARZONE / SAFEZONE)';
      } else if (nearLobbyReturnPadNow) {
        contextHint =
          'Modern Lobby Tram Stop · Click [TO LOBBY] above the Glowing Circle to Return to Safezone Lobby';
      } else if (nearestKioskHud.distance <= 6.8 && nearKioskIsEmptyPlot) {
        contextHint = `Near Empty Plot Kiosk Terminal (${nearestKioskHud.team.toUpperCase()} Plot #${nearestKioskHud.plotIndex + 1}) · Press [B] to Claim Plot`;
      }

      // Floating prompts are rendered via direct 60 FPS DOM overlay with Math.round & hysteresis (zero React re-render)
      const floatingPrompts: FloatingWorldPrompt[] = [];

      return {
        hp: mountedTank ? mountedTank.hp : playerUnit.hp,
        maxHp: mountedTank ? mountedTank.maxHp : playerUnit.maxHp,
        score,
        gold,
        bestScore: Math.max(bestScore, score),
        speedKmh: Math.round(
          Math.hypot(
            mountedTank ? mountedTank.vx : playerUnit.vx,
            mountedTank ? mountedTank.vz : playerUnit.vz,
          ) * 3.6,
        ),
        isBoosting: Boolean(keys['ShiftLeft'] || keys['ShiftRight']),
        isGrabMode: Boolean(mountedTank),
        grabbedPropName: mountedTank
          ? mountedTank.vehicleKind === 'plane'
            ? 'Blitz Plane'
            : mountedTank.vehicleKind === 'truck'
            ? 'Dump Truck'
            : 'Blitz Tank'
          : null,
        collectedItems: [
          padEval.totalCrates >= 1 ? 'GEAR' : '',
          padEval.totalCrates >= 2 ? 'TOOLS' : '',
          padEval.totalCrates >= 4 ? 'CIRCUIT' : '',
          padEval.totalCrates >= 8 ? 'FUEL' : '',
        ].filter(Boolean),
        powerCoreActivated: redBaseHp <= 0,
        enemiesDefeated,
        totalEnemies: 4,
        lightingPreset: lightingPresetRef.current,
        cameraFovMode: cameraFovModeRef.current,
        outcome,
        clearTimeSec: Math.round(runElapsedSec),
        controlMode: mountedTank ? 'tank' : 'buddy',
        activeClass: playerUnit.classId,
        equippedWeapon: mountedTank
          ? mountedTank.vehicleKind === 'plane'
            ? 'Aircraft Twin Minigun'
            : mountedTank.vehicleKind === 'truck'
            ? '4-Crate Hydraulic Bed'
            : '105mm Tank Cannon'
          : playerUnit.weaponName,
        ammo: playerUnit.ammo,
        hudWeaponBadges:
          inLobbySafezoneNow ||
          worldModeRef.current === 'lobby' ||
          worldModeRef.current === 'safezone' ||
          cityArenaMode === 'safezone'
            ? []
            : getVisibleHudWeaponAndTacticalBadges(playerUnit.tacticalLoadout),
        carryingCrate: playerUnit.carryingCrate,
        tankStoredCrates: mountedTank ? mountedTank.storedCrates.length : 0,
        padSlots: [...bluePadSlots],
        padHologramColors: activeRecipeSpec
          ? [...activeRecipeSpec.slotHologramColors]
          : ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
        activePriorityRecipe,
        buildQueue: useCustomHologramRecipe ? [...blueBuildQueue] : [],
        padShape: padEval.shapeKey,
        padOutputName: padEval.outputName,
        padIsMerged: padEval.isMerged,
        padIsSuper: padEval.isSuper,
        buildOrder,
        buildOrderLabel: activeRecipeSpec ? activeRecipeSpec.name : orderSpec.label,
        buildOrderTargetCrates: hudTargetCrates,
        baseBuildingLevel: myPlot?.buildingLevel ?? 1,
        commandCenterLevel: radarEvaluation.operatorStatus.commandCenterLevel,
        commandCenterRadarActive: radarEvaluation.operatorStatus.radarActive,
        commandCenterRadarCoveragePct: radarEvaluation.operatorStatus.coveragePct,
        baseBuildingHp: myPlot?.buildingHp ?? 400,
        baseBuildingMaxHp: myPlot?.buildingMaxHp ?? 400,
        baseFenceLevel: myPlot?.fenceLevel ?? 1,
        baseFenceHp: myPlot?.fenceHp ?? 260,
        baseFenceMaxHp: myPlot?.fenceMaxHp ?? 260,
        baseHasParkingBay: myPlot?.hasParkingBay ?? true,
        baseHasHelipad: myPlot?.hasHelipad ?? true,
        isNearKiosk,
        kioskStatusMessage,
        supplyDropBanner:
          inLobbySafezoneNow ||
          worldModeRef.current === 'lobby' ||
          worldModeRef.current === 'safezone' ||
          cityArenaMode === 'safezone'
            ? null
            : supplyDropSchedule.bannerText,
        teamCommand: playerUnit.assignedRole ?? teamCommand,
        alliedBuddiesCount: buddyUnits.filter((b) => b.team === 'blue' && b.alive).length,
        personalSquadCount: personalSquad.length,
        personalSquadMax: MAX_CHARACTERS_PER_COMMANDER,
        personalSquadClasses: personalSquad.map((b) => b.classId),
        activePersonalBuddyIndex: activePersonalIdx,
        blueHumanCount: matchmakingState.blueCommanders.filter((s) => s.controller === 'human').length,
        blueAiCommanderCount: matchmakingState.blueCommanders.filter((s) => s.controller === 'ai').length,
        redHumanCount: matchmakingState.redCommanders.filter((s) => s.controller === 'human').length,
        redAiCommanderCount: matchmakingState.redCommanders.filter((s) => s.controller === 'ai').length,
        skyshieldBuiltCount: blueSkyshieldsBuilt,
        blueBaseHp,
        redBaseHp,
        contextHint,
        radarDots,
        floatingPrompts,
        editorObjectCount: currentMapLayout.props.length,
        editorCursorX: Math.round(aimWorldPoint.x * 2) / 2,
        editorCursorZ: Math.round(aimWorldPoint.z * 2) / 2,
        editorRotDeg: Math.round((editorRotY * 180) / Math.PI),
        editorScale,
        nuclearStrikePhase: nukeStrikeState.phase,
        nuclearTargetCoords: {
          x: Math.round(nukeStrikeState.targetPos.x),
          z: Math.round(nukeStrikeState.targetPos.z),
        },
        hasDeployedNuclearLauncher: activeNuclearLaunchers.some((n) => n.team === 'blue'),
        playerTeam: playerUnit.team,
        isInsideLobbySafezone: inLobbySafezoneNow,
        isNearLobbyTramReturnPad: nearLobbyReturnPadNow,
        isNearLobbyTramStop: nearLobbyReturnPadNow,
        nearWalletConnected: nearSessionState.walletConnected,
        nearWalletId: nearSessionState.walletId,
        nearHasGamepassNft: nearSessionState.hasGamepassNft,
        nearGamepassTokenId: nearSessionState.tokenId,
        nearClaimedTeam: nearSessionState.claimedTeam,
        nearClaimedPlotIndex: nearSessionState.claimedPlotIndex,
        nearActiveHarvesterSubAccounts: [...nearSessionState.activeHarvesterSubAccounts],
        nearSessionStatusBanner: nearSessionState.sessionStatusBanner,
        nearKioskPlotTeam: nearestKioskHud.distance <= INTERACT_EXIT_RADIUS + 1.5 ? nearestKioskHud.team : null,
        nearKioskPlotIndex: nearestKioskHud.distance <= INTERACT_EXIT_RADIUS + 1.5 ? nearestKioskHud.plotIndex : null,
        nearKioskIsEmptyPlot,
        activeBluePlotIndices,
        activeRedPlotIndices,
        playerWarzoneLives,
        playerWarzoneMaxLives: PLAYER_WARZONE_MAX_LIVES,
        harvesterContractStage: hudHarvesterLifecycle.stage,
        harvesterContractLabel: hudHarvesterLifecycle.statusLabel,
        hasActiveBuildContract,
        isNearLobbyGoldExchange: nearLobbyGoldExchangeNow,
        lobbyGoldExchangeOwnedItems: [...lobbyGoldExchangeOwnedItems],
        blueOnlinePopulation: popBar.blueOnline,
        redOnlinePopulation: popBar.redOnline,
        maxOnlinePerTeam: OPEN_WARZONE_TEAM_CAPACITY.maxTotalPerTeam,
        blueOnlineLabel: popBar.blueLabel,
        redOnlineLabel: popBar.redLabel,
        worldMode: worldModeRef.current,
        cityArenaMode,
        isRidingCityTram: ridingTramCarIdx !== null,
        isNearCityTram: canUnitBoardCityTramAtAnyPoint(
          actorX,
          actorZ,
          cityTram.getState(),
          cityArenaMode === 'safezone' ? 6.2 : 3.6,
        ).canBoard,
        socialTalkMessage,
        nearbyRadiusUsers: (() => {
          const list: Array<{
            id: string | number;
            name: string;
            isNpc: boolean;
            distance: number;
            team: 'blue' | 'red';
            status: string;
          }> = [];
          // 1. Nearby Buddy Units (AI Squad & Players)
          for (let i = 0; i < buddyUnits.length; i++) {
            const u = buddyUnits[i];
            if (u.id === playerUnit.id || !u.alive) continue;
            const dist = getPlanetShortestDistance(actorX, actorZ, u.x, u.z);
            if (dist <= 35.0) {
              list.push({
                id: u.id,
                name: u.isPlayer ? 'YOU' : `BUDDY #${u.id}`,
                isNpc: false,
                distance: dist,
                team: u.team,
                status: u.carryingCrate !== 'none' ? 'Carrying Crate' : u.weaponName || 'Chilling',
              });
            }
          }
          // 2. Nearby Standing NPCs (Hana & Kai)
          const distHana = getPlanetShortestDistance(actorX, actorZ, -94.0, -13.8);
          if (distHana <= 35.0 && worldModeRef.current === 'lobby') {
            list.push({
              id: 'npc_hana',
              name: 'HANA',
              isNpc: true,
              distance: distHana,
              team: 'blue',
              status: 'Official Merchant',
            });
          }
          const distKai = getPlanetShortestDistance(actorX, actorZ, 85.8, 60.0);
          if (distKai <= 35.0 && worldModeRef.current !== 'lobby') {
            list.push({
              id: 'npc_kai',
              name: 'KAI',
              isNpc: true,
              distance: distKai,
              team: 'red',
              status: 'Beach Merchant',
            });
          }
          list.sort((a, b) => a.distance - b.distance);
          return list;
        })(),
        safezonePlotAccessMode:
          (nearSessionState.claimedTeam && nearSessionState.claimedPlotIndex !== null
            ? (nearSessionState.claimedTeam === 'blue' ? blueCommanderBases : redCommanderBases)[
                nearSessionState.claimedPlotIndex
              ]?.safezoneAccessMode
            : nearestKioskHud.plotState?.safezoneAccessMode) ?? 'PUBLIC',
        safezoneAllowedFriends: [
          ...((nearSessionState.claimedTeam && nearSessionState.claimedPlotIndex !== null
            ? (nearSessionState.claimedTeam === 'blue' ? blueCommanderBases : redCommanderBases)[
                nearSessionState.claimedPlotIndex
              ]?.safezoneAllowedFriends
            : nearestKioskHud.plotState?.safezoneAllowedFriends) ?? []),
        ],
        safezonePlotOwnerId:
          nearSessionState.claimedTeam && nearSessionState.claimedPlotIndex !== null
            ? (nearSessionState.claimedTeam === 'blue' ? blueCommanderBases : redCommanderBases)[
                nearSessionState.claimedPlotIndex
              ]?.claimedByNearAccount ?? null
            : nearestKioskHud.plotState?.claimedByNearAccount ?? null,
      };
    };
    emitHudImmediately = () => {
      updateDirectDomPrompts();
      onHudUpdate(buildHudSnapshot(null));
    };

    emitHudImmediately();
    rafId = requestAnimationFrame(animate);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(rafId);
      window.clearTimeout(softwareGlTimerId);
      soundEngine.stopAllLoops();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('buddy-action', onBuddyActionEvent);
      window.removeEventListener('blur', onWindowBlurOrVisibilityReset);
      document.removeEventListener('visibilitychange', onWindowBlurOrVisibilityReset);
      window.removeEventListener('focusin', onDocumentFocusIn);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('wheel', onWheel);
      window.removeEventListener('toggle-kiosk-ui', onKioskUiToggled);
      window.removeEventListener('close-kiosk-ui', onKioskUiClosed);
      window.removeEventListener('sync-kiosk-ui', onKioskUiSynced);
      window.removeEventListener('sync-npc-camera-mode', onSyncNpcCameraMode);
      window.removeEventListener('clear-character-selection', onWindowClearCharacterSelection);
      window.removeEventListener('close-teleport-kiosk-ui', onCloseTeleportKioskUi);
      window.removeEventListener('select-teleport-kiosk', onSelectTeleportKioskEvent);
      window.removeEventListener('select-character-by-id', onSelectCharacterById);
      window.removeEventListener('update-social-bubble-style', onUpdateSocialBubbleStyle);
      if (promptOverlay.parentElement) {
        promptOverlay.parentElement.removeChild(promptOverlay);
      }
      continuousLaserVisuals.forEach((vis) => {
        scene.remove(vis.group);
        vis.coreMat.dispose();
        vis.outerMat.dispose();
        vis.coronaMat.dispose();
      });
      continuousLaserVisuals.clear();
      laserOuterCylGeo.dispose();
      laserCoronaCylGeo.dispose();
      laserCoreCylGeo.dispose();
      laserHitSphereGeo.dispose();
      laserMuzzleCoreSphereGeo.dispose();
      laserMuzzleGlowSphereGeo.dispose();
      laserHitCoreSphereGeo.dispose();
      laserHitGlowSphereGeo.dispose();
      laserHitRingGeo.dispose();
      laserSparkConeGeo.dispose();
      tolanPlanetEnv.dispose();
      cityTram.dispose();
      blitzGrassSystem.dispose();
      blitzExplosionSystem.dispose();
      renderer.dispose();
    };
  }, [onGameOver, onHudUpdate, onTogglePause]);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 w-screen h-screen overflow-hidden"
      style={{ cursor: gameState === 'playing' ? 'crosshair' : 'default' }}
    />
  );
};
