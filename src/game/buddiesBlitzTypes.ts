import * as THREE from 'three';
import {
  LightingPresetKey,
  BuddyClassId,
  WorldCrateKind,
  CrateSlotType,
  BuildOrderTarget,
  TeamCommandMode,
  KioskBuildPriorityRecipeId,
  NuclearStrikePhase,
  TeamBuddiesDropItemKind,
  BuddySecondaryItemId,
  BuddyMissionItemId,
  ColliderCategory,
  CollisionMaterialTag,
  BuddyTacticalLoadoutState,
  HudWeaponOrTacticalBadge,
  HarvesterContractStage,
  LobbyGoldExchangeItemId,
  WorldMode,
  SafezonePlotAccessMode,
} from './buddiesBlitzRules';
import {
  BuddyCharacterRig,
  BlitzWeaponId,
} from './buddiesBlitzShadersAndAssets';

export type GameState = 'title' | 'playing' | 'paused' | 'gameover';
export type PlayMode = 'sandbox' | 'editor' | 'match';

export interface PlacedMapProp {
  id: number;
  kind:
    | 'tree_purple'
    | 'tree_gold'
    | 'turbine'
    | 'power_core'
    | 'concrete_fence'
    | 'concrete_fence_1b'
    | 'concrete_pipe'
    | 'barricade'
    | 'explosive_barrel'
    | 'barrel_1c'
    | 'pallet_1a'
    | 'h_beam'
    | 'fuel_cell'
    | 'circuit_module'
    | 'hydrant'
    | 'lamppost_1a'
    | 'lamppost_1b'
    | 'bench'
    | 'chimney'
    | 'giant_tank'
    | 'dump_truck'
    | 'forklift'
    | 'crane'
    | 'recycle_bin'
    | 'traffic_cone'
    | 'wheelbarrow'
    | 'tank_1a'
    | 'tank_1b'
    | 'pipe_cluster'
    | 'pipe_cluster_1b'
    | 'giant_pipe'
    | 'giant_pipe_1b'
    | 'river_rock'
    | 'flower_cluster';
  x: number;
  z: number;
  rotY: number;
  scale: number;
}

export interface ArenaMapLayout {
  blueHq: { x: number; z: number };
  bluePad: { x: number; z: number };
  redHq: { x: number; z: number };
  redPad: { x: number; z: number };
  centerDropZone: { x: number; z: number };
  props: PlacedMapProp[];
  sculptData?: number[];
}

export interface RadarDot {
  id: string;
  kind:
    | 'player'
    | 'ally'
    | 'enemy'
    | 'crate_red'
    | 'crate_super'
    | 'crate_legend'
    | 'tank_blue'
    | 'tank_red'
    | 'supply_drop'
    | 'barrel'
    | 'pickup';
  x: number;
  z: number;
}

export interface FloatingWorldPrompt {
  id: string;
  keyLabel: 'E' | 'F' | 'G' | 'B';
  actionLabel: string;
  subLabel?: string;
  actionEvent: string;
  xPct: number;
  yPct: number;
  accent: 'white' | 'yellow' | 'lime' | 'cyan';
  iconType: 'hand' | 'machine';
}

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  score: number;
  bestScore: number;
  speedKmh: number;
  isBoosting: boolean;
  isGrabMode: boolean;
  grabbedPropName: string | null;
  collectedItems: string[];
  powerCoreActivated: boolean;
  enemiesDefeated: number;
  totalEnemies: number;
  lightingPreset: LightingPresetKey;
  cameraFovMode: 'webgl35' | 'ortho18';
  outcome: 'victory' | 'defeat' | null;
  clearTimeSec: number;
  // Team Buddies 3D World State
  controlMode: 'buddy' | 'tank';
  activeClass: BuddyClassId;
  equippedWeapon: string;
  ammo: number;
  carryingCrate: 'none' | WorldCrateKind;
  tankStoredCrates: number;
  padSlots: CrateSlotType[];
  padShape: string;
  padOutputName: string;
  padIsMerged: boolean;
  padIsSuper: boolean;
  buildOrder: BuildOrderTarget;
  buildOrderLabel: string;
  buildOrderTargetCrates: number;
  teamCommand: TeamCommandMode;
  alliedBuddiesCount: number;
  personalSquadCount: number;
  personalSquadMax: number;
  personalSquadClasses: BuddyClassId[];
  activePersonalBuddyIndex: number;
  blueHumanCount: number;
  blueAiCommanderCount: number;
  redHumanCount: number;
  redAiCommanderCount: number;
  skyshieldBuiltCount: number;
  blueBaseHp: number;
  redBaseHp: number;
  // Self-Service Tactical Kiosk & Warzone Gold Economy
  gold: number;
  activePriorityRecipe: KioskBuildPriorityRecipeId;
  buildQueue: KioskBuildPriorityRecipeId[];
  padHologramColors: CrateSlotType[];
  baseBuildingLevel: 1 | 2 | 3;
  commandCenterLevel: 1 | 2 | 3;
  commandCenterRadarActive: boolean;
  commandCenterRadarCoveragePct: 45 | 75 | 100;
  baseBuildingHp: number;
  baseBuildingMaxHp: number;
  baseFenceLevel: 1 | 2 | 3;
  baseFenceHp: number;
  baseFenceMaxHp: number;
  baseHasParkingBay: boolean;
  baseHasHelipad: boolean;
  isNearKiosk: boolean;
  kioskStatusMessage: string | null;
  contextHint: string;
  radarDots: RadarDot[];
  floatingPrompts: FloatingWorldPrompt[];
  // Map Editor State
  editorObjectCount: number;
  editorCursorX: number;
  editorCursorZ: number;
  editorRotDeg: number;
  editorScale: number;
  // Nuclear Launcher Map Zoom-Out & Cinematic Rocket State
  nuclearStrikePhase: NuclearStrikePhase;
  nuclearTargetCoords: { x: number; z: number };
  hasDeployedNuclearLauncher: boolean;
  // Dynamic Supply Drop Event Banner
  supplyDropBanner?: string | null;
  // Owned Handheld Weapons (max 3) & Secondary Tactical Items (max 2: Hand Grenade & Land Mine) with real-time Ammo counts
  hudWeaponBadges?: HudWeaponOrTacticalBadge[];
  // Fixed-Pool Tunable Particle Emitter Telemetry
  particlePoolActive?: number;
  particlePoolCapacity?: number;
  particleTotalSpawns?: number;
  // Lobby Safezone, Team Portals, Halte Trem & NEAR NFT Gamepass Session Base State
  playerTeam?: 'blue' | 'red';
  isInsideLobbySafezone?: boolean;
  isNearLobbyTramReturnPad?: boolean;
  isNearLobbyTramStop?: boolean;
  nearWalletConnected?: boolean;
  nearWalletId?: string | null;
  nearHasGamepassNft?: boolean;
  nearGamepassTokenId?: string | null;
  nearClaimedTeam?: 'blue' | 'red' | null;
  nearClaimedPlotIndex?: number | null;
  nearActiveHarvesterSubAccounts?: string[];
  nearSessionStatusBanner?: string;
  nearKioskPlotTeam?: 'blue' | 'red' | null;
  nearKioskPlotIndex?: number | null;
  nearKioskIsEmptyPlot?: boolean;
  activeBluePlotIndices?: number[];
  activeRedPlotIndices?: number[];
  // 5-Lives Warzone Deployment System (150 HP), Contract Harvester, Lobby Gold Exchange & 10v10 Open Warzone
  playerWarzoneLives?: number;
  playerWarzoneMaxLives?: number;
  harvesterContractStage?: HarvesterContractStage;
  harvesterContractLabel?: string;
  hasActiveBuildContract?: boolean;
  isNearLobbyGoldExchange?: boolean;
  lobbyGoldExchangeOwnedItems?: LobbyGoldExchangeItemId[];
  blueOnlinePopulation?: number;
  redOnlinePopulation?: number;
  maxOnlinePerTeam?: number;
  blueOnlineLabel?: string;
  redOnlineLabel?: string;
  // Safezone City Mode (Peaceful City, Ride City Tram, Social Talk, & Non-Military Plot Access Settings)
  worldMode?: WorldMode;
  cityArenaMode?: 'warzone' | 'safezone';
  isRidingCityTram?: boolean;
  isNearCityTram?: boolean;
  socialTalkMessage?: string | null;
  nearbyRadiusUsers?: Array<{
    id: string | number;
    nearAccountId?: string;
    name: string;
    isNpc: boolean;
    distance: number;
    team: 'blue' | 'red';
    status: string;
  }>;
  safezonePlotAccessMode?: SafezonePlotAccessMode;
  safezoneAllowedFriends?: string[];
  safezonePlotOwnerId?: string | null;
}

export interface BuddiesBlitzArenaProps {
  gameState: GameState;
  playMode: PlayMode;
  worldMode?: WorldMode;
  initialTeam?: 'blue' | 'red';
  deployedFromLobby?: boolean;
  onRequestWorldModeChange?: (nextMode: WorldMode, team?: 'blue' | 'red') => void;
  lightingPreset: LightingPresetKey;
  cameraFovMode: 'webgl35' | 'ortho18';
  resetTrigger: number;
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onGameOver: (outcome: 'victory' | 'defeat', finalSnapshot: HudSnapshot) => void;
  onTogglePause: () => void;
  onPreloadSceneReady?: () => void;
}

export interface WorldCrate {
  id: number;
  kind: WorldCrateKind;
  indestructible?: boolean;
  mesh: THREE.Group;
  boxVisualGroup: THREE.Group;
  parachuteMesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotY: number;
  rotVelY: number;
  hp: number;
  state: 'falling' | 'grounded' | 'carried' | 'thrown' | 'stacked';
  carrierId: number | null;
  squashTimer: number;
  decayTimerSec?: number;
  totalDecaySec?: number;
}

export interface WorldPickup {
  id: number;
  kind: Exclude<TeamBuddiesDropItemKind, 'crate'>;
  weaponName: string;
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  bobPhase: number;
  collected: boolean;
  remainingAmmo?: number;
  secondaryId?: Exclude<BuddySecondaryItemId, 'none'>;
  secondaryCount?: number;
  missionItemId?: Exclude<BuddyMissionItemId, 'none'>;
  scoreValue?: number;
  healAmount?: number;
  hp: number;
  isFromDeathDrop: boolean;
  lifeRemainingSec: number;
  totalLifeSec: number;
}

export interface DestructibleTree {
  id: number;
  propId: number;
  isPurple: boolean;
  scale: number;
  mesh: THREE.Group;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  hitFlashTimer: number;
  jiggleTimer: number;
  jiggleIntensity: number;
  jiggleDirX: number;
  jiggleDirZ: number;
}

export interface ActiveMapPropPhysics {
  id: number;
  kind: PlacedMapProp['kind'];
  wrapper: THREE.Group;
  x: number;
  z: number;
  vx: number;
  vz: number;
  rotY: number;
  rotVelY: number;
  scale: number;
  category: ColliderCategory;
  materialTag: CollisionMaterialTag;
  radius: number;
  halfX?: number;
  halfZ?: number;
  heightY: number;
  mass: number;
  restitution: number;
  destructible: boolean;
  hp: number;
  maxHp: number;
  shootImpulse: number;
  canJiggleOnHit: boolean;
  alive: boolean;
  jiggleTimer: number;
  jiggleDirX: number;
  jiggleDirZ: number;
  isWarzoneDropBarrel?: boolean;
  fallingFromSky?: boolean;
  y?: number;
  vy?: number;
  parachuteMesh?: THREE.Mesh;
}

export interface DebrisChunk3D {
  active: boolean;
  mesh: THREE.Mesh;
  mat: THREE.MeshToonMaterial;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  life: number;
  maxLife: number;
  baseScale: THREE.Vector3;
}

export interface TankVehicle {
  id: number;
  vehicleKind?: 'tank' | 'plane' | 'truck';
  mapPropId?: number;
  isSuper: boolean;
  team: 'blue' | 'red';
  root: THREE.Group;
  bodyGroup: THREE.Group;
  turretGroup: THREE.Group;
  barrelGroup: THREE.Group;
  riderGroup: THREE.Group;
  muzzleFlash: THREE.Mesh;
  x: number;
  z: number;
  vx: number;
  vz: number;
  hullYaw: number;
  turretYaw: number;
  currentDriveSpeed: number;
  altitude?: number;
  targetAltitude?: number;
  verticalSpeed?: number;
  forwardSpeed?: number;
  steerAngle?: number;
  bodyPitchRad?: number;
  bodyRollRad?: number;
  dumpAnimTimer?: number;
  dumpReleasedInCycle?: boolean;
  dumpTargetMode?: 'pad' | 'ground';
  recoilTimer: number;
  hp: number;
  maxHp: number;
  storedCrates: Exclude<WorldCrateKind, 'medical'>[];
  occupiedByPlayer: boolean;
  occupiedByAiId: number | null;
  hitFlashTimer?: number;
  hitReactionTimer?: number;
  hitReactionDirX?: number;
  hitReactionDirZ?: number;
  stunTimer?: number;
  stunMesh?: THREE.Mesh;
  lowHpSmokeTimer?: number;
  navPath?: Array<{ x: number; z: number }>;
  navWaypointIndex?: number;
  navLastGoalX?: number;
  navLastGoalZ?: number;
  navRepathTimer?: number;
  navStuckTimer?: number;
  navLastProgressX?: number;
  navLastProgressZ?: number;
}

export interface BuddyUnit {
  id: number;
  team: 'blue' | 'red';
  ownerCommanderId: number;
  isStarterCommanderUnit: boolean;
  isPlayer: boolean;
  classId: BuddyClassId;
  root: THREE.Group;
  bodyGroup: THREE.Group;
  rig: BuddyCharacterRig;
  headMesh: THREE.Mesh;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  weaponMesh: THREE.Mesh;
  overheadCrateGroup: THREE.Group;
  overheadCrateBox: THREE.Mesh;
  saluteSign: {
    sprite: THREE.Sprite;
    updateText: (title: string, subtitle: string, accentHex: string, progressRatio?: number) => void;
  };
  nameplate?: {
    sprite: THREE.Sprite;
    updatePlate: (name: string, sub: string, emblemType?: 'npc' | 'player_rookie' | 'player_veteran') => void;
  };
  teamRing: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  jumpOffset: number;
  isGrounded: boolean;
  jumpBufferTimer?: number;
  invincibilityTimer?: number;
  yaw: number;
  hp: number;
  maxHp: number;
  weaponId: BlitzWeaponId;
  weaponName: string;
  weaponRecoil: number;
  punchTimer: number;
  punchHand: 'left' | 'right';
  kickTimer: number;
  ammo: number;
  carryingCrate: 'none' | WorldCrateKind;
  secondaryItem: BuddySecondaryItemId;
  secondaryCount: number;
  tacticalLoadout: BuddyTacticalLoadoutState;
  missionItem: BuddyMissionItemId;
  walkCycle: number;
  shootCooldown: number;
  hitFlashTimer: number;
  hitReactionTimer?: number;
  hitReactionDirX?: number;
  hitReactionDirZ?: number;
  stunTimer?: number;
  stunMesh?: THREE.Mesh;
  isFrozen: boolean;
  frozenTimer: number;
  saluteTimer: number;
  isSitting?: boolean;
  isDriving?: boolean;
  aiTargetCrateId: number | null;
  alive: boolean;
  respawnTimer: number;
  assignedRole?: TeamCommandMode;
  hasIndividualRoleAssigned?: boolean;
  followerReactionTimer?: number;
  followerIdleLookTimer?: number;
  followerIdleLookYaw?: number;
  followerStrafeTimer?: number;
  followerStrafeSign?: 1 | -1;
  navPath?: Array<{ x: number; z: number }>;
  navWaypointIndex?: number;
  navLastGoalX?: number;
  navLastGoalZ?: number;
  navRepathTimer?: number;
  navStuckTimer?: number;
  navLastProgressX?: number;
  navLastProgressZ?: number;
  isFiringLaser?: boolean;
  laserDamageTickTimer?: number;
  laserAmmoTickTimer?: number;
  laserSoundTickTimer?: number;
  laserSparkTickTimer?: number;
  laserBurstTimer?: number;
}

export interface Projectile {
  active: boolean;
  isPlayerTeam: boolean;
  weaponType: string;
  mesh: THREE.Mesh;
  has3dShells?: boolean;
  bossShell?: THREE.Object3D;
  playerShell?: THREE.Object3D;
  fodderShell?: THREE.Object3D;
  nukeShell?: THREE.Object3D;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  damage: number;
}

export interface ExplosionParticle {
  active: boolean;
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  initialSize?: number;
  drag?: number;
  gravityY?: number;
}

export interface ActiveLaserBeam3D {
  group: THREE.Group;
  outerMat: THREE.MeshBasicMaterial;
  coreMat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
}

export interface ActiveOrdnanceDevice3D {
  kind: 'cluster_bomb' | 'hand_grenade' | 'land_mine';
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  fuseTimer: number;
  isGrounded: boolean;
}

export interface StaticWorldStructureObb {
  id: string;
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  rotY: number;
  heightY: number;
  mat: CollisionMaterialTag;
  isRetainingWall?: boolean;
}

export const COMMAND_CYCLE: TeamCommandMode[] = ['HARVEST', 'ATTACK', 'DEFEND', 'FOLLOW'];

export const BLUE_BUDDY_ROTATION: BuddyClassId[] = [
  'Infuntry',
  'Ninja',
  'Medic',
  'Commando',
  'Cyborg',
  'Stealthy',
  'SuperBuddie',
];
