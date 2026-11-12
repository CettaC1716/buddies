/**
 * Pure physics, critically damped camera spring, and gameplay math for Buddies Blitz.
 */

import {
  evaluateRoadNetworkSdf,
  isPointOnZebraCrosswalk,
  isPointOnAsphaltRoadOrZebraCross,
} from './buddiesPlanetCurvature';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type LightingPresetKey = 'day' | 'dusk' | 'night' | 'dawn';

export interface LightingPresetConfig {
  key: LightingPresetKey;
  label: string;
  revealColor: string;
  revealIntensity: number;
  lightColor: string;
  lightIntensity: number;
  shadowColor: string;
  fogColorA: string;
  fogColorB: string;
  fogNearRatio: number;
  fogFarRatio: number;
  viewportFilterColor: string;
  viewportFilterOpacity: number;
}

/**
 * Core camera, physics, and gameplay constants for Buddies Blitz
 */
export const BUDDIES_CONSTANTS = {
  camera: {
    fov: 42,
    pseudoOrthoFov: 18,
    near: 0.1,
    far: 1000,
    chaseOffset: { x: 0, y: 5.2, z: 12.5 } as Vec3,
    chaseLookAtYOffset: 2.4,
    defaultAngleOffset: { x: 4, y: 14, z: 8 } as Vec3,
    playerStartAngleOffset: { x: 0, y: 2, z: 14 } as Vec3,
    powerCoreAngleOffset: { x: 0, y: 0, z: 10 } as Vec3,
    zoom: {
      minDistance: 9,
      amplitude: 12,
      defaultValue: 0.6,
      defaultDistance: 16.2,
      bridgeTargetDistance: 25,
    },
    followSpring: {
      smoothTimeNormal: 0.12,
      smoothTimeBoost: 0.16,
      snapDistanceSqThreshold: 36,
    },
    mousePan: {
      sensitivity: 1.3,
      dampSpeed: 5,
      dragPanSensitivity: 0.05,
    },
    recoil: {
      kickDistance: 0.13,
      maxRecoilDistance: 0.37,
    },
    intro: {
      targetZoomScaleDesktop: 1.5,
      targetZoomScaleMobile: 1.2,
      centerX: 0.75,
      centerY: 0.5,
      playerRotationY: -0.52,
      playerStartRotationYDeg: -180,
    },
    worldSpawns: {
      playerStartPosition: { x: 57.334, y: 10.068, z: 98.584 } as Vec3,
      tutorShootPosition: { x: 16.34, y: 7.652, z: 88.309 } as Vec3,
    },
  },
  physics: {
    gravity: { x: 0, y: -9.81, z: 0 } as Vec3,
    fixedTimeStep: 1 / 60,
    maxPhysicsStepsPerFrame: 5,
    robotBody: {
      modelScale: 0.9,
      linearDamping: 0.5,
      angularDamping: 0.8,
      restitution: 0.4,
      friction: 0.3,
      lockRotationsX: true,
      lockRotationsY: false,
      lockRotationsZ: true,
      ccdEnabled: true,
    },
    drive: {
      speed: 10.8, // +35% from 8.0
      boostMultiplier: 1.9,
      boostMaxSpeed: 20.52, // +35% from 15.2
      rotationSpeed: 4.212, // +35% faster steering turn rate from 3.12
      boostRotationMultiplier: 1.2,
      driveLerpRate: 10.8, // +35% initial acceleration lerp from 8.0
      rotationLerpRate: 50.0,
      forwardFrictionFactor: 0.5,
      lateralFrictionFactor: 20.0,
      rotationDampingFactor: 0.15,
      turretDamping: 0.06,
      airControlFactor: 0.45,
      airRotationControlFactor: 0.3,
      collisionAngularMultiplier: 0.3,
      collisionPushBackMultiplier: 0.35,
    },
    terrain: {
      friction: 0.8,
      restitution: 0.0,
    },
    enemyBody: {
      linearDamping: 0.8,
      angularDamping: 0.8,
      restitution: 0.5,
      friction: 0.3,
      density: 10.0,
      bevelRadius: 0.08,
      fodderHealth: 14,
      bossHealth: 40,
      playerMaxHealth: 30,
    },
    cannon: {
      fireRate: 0.2,
      shotInterval: 0.08,
      projectileSpeed: 55.0,
      projectileLife: 1.0,
      projectileSpread: 0.05,
      recoilDistance: 0.16,
      barrelRecoilDistance: 0.16,
      recoilPushDuration: 0.1,
      recoilReturnDuration: 0.5,
      turretLiftAmount: 0.06,
      turretRotateAngleDeg: 6,
      bodyLiftAmount: 0.05,
      bodyRotateAngleDeg: 12,
      muzzleLightColor: '#00ff66',
      muzzleLightIntensity: 1.1,
      muzzleLightDistance: 6.0,
    },
    grabMode: {
      holdingDistance: 6.0,
      springStrength: 180.0,
      damping: 16.0,
      maxPositionDelta: 1.5,
      maxAngleDelta: 0.4,
      maxAcceleration: 120.0,
      maxAngularAcceleration: 80.0,
      laserTravelSpeed: 7.5,
      hoverStrokeColor: '#ffaa00',
      hoverStrokeWidth: 0.055,
    },
  },
  shadersAndLighting: {
    outline: {
      strokeWidth: 0.018,
      strokeMaxDepth: 1.5,
      strokeColor: '#17110f',
      strokeColorRgb: [23, 17, 15] as [number, number, number],
    },
    hatch: {
      angleRad: 0.7854,
      frequency: 204,
      noiseScale: 8,
      noiseAmp: 0.3,
    },
    directionalKeyLight: {
      color: '#ffe8d6',
      intensity: 2.0,
      offset: { x: 2, y: 25, z: -2 } as Vec3,
    },
    smoke: {
      spawnRadiusMin: 0.03,
      spawnRadiusMax: 0.16,
      upwardVelMin: 1.28,
      upwardVelMax: 1.92,
      lifetimeMin: 5.5,
      lifetimeMax: 8.5,
      startScaleMin: 0.14,
      startScaleMax: 0.24,
      endScaleMin: 0.9,
      endScaleMax: 1.4,
      peakOpacityMin: 0.72,
      peakOpacityMax: 0.92,
      swayFreqX: [0.44, 0.88] as [number, number],
      swayFreqZ: [0.58, 1.12] as [number, number],
      swayAmp: [0.06, 0.14] as [number, number],
    },
    palette: {
      brand10: '#beef74',
      brand20: '#c7ff72',
      neonLime: '#b8ff3c',
      introLime: '#b4ff39',
      neutral5: '#11121a',
      neutral10: '#191b24',
      neutral20: '#272935',
      statusRed: '#f42f4c',
      statusYellow: '#fec83e',
    },
  },
  introHexagonSvgPath:
    'M165.38 1.02246L1.03955 130.303L18.744 351.961L165.38 480.474L359.797 463.998L468.628 351.961L498.16 191.008L394.397 15.8505L165.38 1.02246Z',
};

export const LIGHTING_PRESETS: Record<LightingPresetKey, LightingPresetConfig> = {
  day: {
    key: 'day',
    label: 'Day (0.00)',
    revealColor: '#5f7df7',
    revealIntensity: 12,
    lightColor: '#ffe6b1',
    lightIntensity: 1.6,
    shadowColor: '#454778',
    fogColorA: '#00a2ff',
    fogColorB: '#f1ff64',
    fogNearRatio: 0.315,
    fogFarRatio: 1.25,
    viewportFilterColor: '#ffffff',
    viewportFilterOpacity: 0,
  },
  dusk: {
    key: 'dusk',
    label: 'Dusk (0.35)',
    revealColor: '#d7ff7c',
    revealIntensity: 2.5,
    lightColor: '#ffebc7',
    lightIntensity: 1.4,
    shadowColor: '#66009c',
    fogColorA: '#ff6d6d',
    fogColorB: '#fff229',
    fogNearRatio: 0,
    fogFarRatio: 1.25,
    viewportFilterColor: '#ff8181',
    viewportFilterOpacity: 0.12,
  },
  night: {
    key: 'night',
    label: 'Night (0.60)',
    revealColor: '#c2c6ff',
    revealIntensity: 10,
    lightColor: '#6277b8',
    lightIntensity: 1.5,
    shadowColor: '#1e2238',
    fogColorA: '#5560a2',
    fogColorB: '#1d2030',
    fogNearRatio: -0.043,
    fogFarRatio: 1.0,
    viewportFilterColor: '#3240ff',
    viewportFilterOpacity: 0.14,
  },
  dawn: {
    key: 'dawn',
    label: 'Dawn (0.85)',
    revealColor: '#ffffff',
    revealIntensity: 4.85,
    lightColor: '#ffe5c0',
    lightIntensity: 1.5,
    shadowColor: '#494949',
    fogColorA: '#ffca58',
    fogColorB: '#ffebb6',
    fogNearRatio: 0.3,
    fogFarRatio: 1.25,
    viewportFilterColor: '#fff7ef',
    viewportFilterOpacity: 0.08,
  },
};

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Critically damped 3D follow-target spring solver
 */
export function stepCriticalDampedSpring3D(
  current: Vec3,
  target: Vec3,
  velocity: Vec3,
  currentSpeed: number,
  dt: number,
): { position: Vec3; velocity: Vec3 } {
  const clampedDt = clamp(dt, 0.0001, 0.05);
  const baseSpeed = BUDDIES_CONSTANTS.physics.drive.speed;
  const maxBoostSpeed = baseSpeed * BUDDIES_CONSTANTS.physics.drive.boostMultiplier;
  const speedAlpha = clamp(
    (currentSpeed - baseSpeed) / Math.max(0.001, maxBoostSpeed - baseSpeed),
    0,
    1,
  );
  const smoothTime = lerp(
    BUDDIES_CONSTANTS.camera.followSpring.smoothTimeNormal,
    BUDDIES_CONSTANTS.camera.followSpring.smoothTimeBoost,
    speedAlpha,
  );

  const dx = current.x - target.x;
  const dy = current.y - target.y;
  const dz = current.z - target.z;
  const distSq = dx * dx + dy * dy + dz * dz;

  if (distSq > BUDDIES_CONSTANTS.camera.followSpring.snapDistanceSqThreshold || distSq < 1e-6) {
    return {
      position: { x: target.x, y: target.y, z: target.z },
      velocity: { x: 0, y: 0, z: 0 },
    };
  }

  const omega = 2 / Math.max(1e-4, smoothTime);
  const exp = Math.exp(-omega * clampedDt);

  const tempX = (velocity.x + dx * omega) * clampedDt;
  const tempY = (velocity.y + dy * omega) * clampedDt;
  const tempZ = (velocity.z + dz * omega) * clampedDt;

  const nextVelX = (velocity.x - tempX * omega) * exp;
  const nextVelY = (velocity.y - tempY * omega) * exp;
  const nextVelZ = (velocity.z - tempZ * omega) * exp;

  const nextPosX = target.x + (dx + tempX) * exp;
  const nextPosY = target.y + (dy + tempY) * exp;
  const nextPosZ = target.z + (dz + tempZ) * exp;

  return {
    position: { x: nextPosX, y: nextPosY, z: nextPosZ },
    velocity: { x: nextVelX, y: nextVelY, z: nextVelZ },
  };
}

/**
 * Vehicle drive speed & boost ramp solver,
 * scaled by +35% top speed & initial acceleration, plus optional +20% Road Speed Boost.
 */
export function computeTankSpeedStep(
  currentSpeed: number,
  isBoosting: boolean,
  dt: number,
  onRoadOrZebra = false,
): number {
  const roadMult = onRoadOrZebra ? 1.2 : 1.0;
  const base = BUDDIES_CONSTANTS.physics.drive.speed * roadMult;
  const maxBoost = base * BUDDIES_CONSTANTS.physics.drive.boostMultiplier;
  const accelMultiplier = isBoosting ? 1.35 : -10;
  const deltaSpeed = (maxBoost - base) * accelMultiplier * dt;
  return clamp(currentSpeed + deltaSpeed, base, maxBoost);
}

/**
 * Computes shortest signed angle difference in radians (-PI..PI)
 */
export function shortestAngleDelta(fromRad: number, toRad: number): number {
  let diff = ((toRad - fromRad + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/**
 * Turret exponential damping factor:
 * n = turretDamping * 60; r = 1 - Math.exp(-n * dt)
 */
export function stepTurretYaw(currentYaw: number, targetYaw: number, dt: number): number {
  const rate = BUDDIES_CONSTANTS.physics.drive.turretDamping * 60;
  const alpha = 1 - Math.exp(-rate * clamp(dt, 0, 0.05));
  return currentYaw + shortestAngleDelta(currentYaw, targetYaw) * alpha;
}

/**
 * Checks whether all 4 collectible types have been gathered to unlock Power Core
 */
export function isPowerCoreReady(collectedCount: number, requiredCount = 4): boolean {
  return collectedCount >= requiredCount;
}

export type CrateSlotType = 'empty' | 'red' | 'super' | 'legend';

export type RecipeCategory =
  | 'none'
  | 'lite_weapon'
  | 'medium_weapon'
  | 'grenade'
  | 'skyshield'
  | 'heavy_weapon'
  | 'buddy_t1'
  | 'buddy_t2'
  | 'light_vehicle'
  | 'truck'
  | 'vehicle'
  | 'aircraft';

export type TeamBuddiesCrateSchemeId =
  | 'classic_military'
  | 'cyber_tech'
  | 'heavy_ordnance'
  | 'special_ops';

export interface LeftoverPadWeaponDropSpec {
  crateKind: Exclude<CrateSlotType, 'empty'>;
  weaponId: 'pistol' | 'rifle' | 'rocket';
  outputName: string;
  isSuper: boolean;
  isLegend: boolean;
  hasBouncingSpread: boolean;
  isMassDestructionSuperWeapon: boolean;
}

export interface PadEvaluationResult {
  totalCrates: number;
  redCount: number;
  superCount: number;
  legendCount: number;
  isMerged: boolean;
  isSuper: boolean;
  isLegend: boolean;
  shapeKey: 'Empty' | '1x1x1' | '2x1x1' | '1x1x2' | '2x2x1' | '2x1x2' | '2x2x2' | 'Partial';
  category: RecipeCategory;
  teamBuddiesCategoryLabel: string;
  outputName: string;
  crateSchemeVariantName: string;
  crateSchemeExamples: string[];
  spawnType:
    | 'none'
    | 'weapon'
    | 'grenade'
    | 'skyshield'
    | 'buddy'
    | 'light_vehicle'
    | 'truck'
    | 'tank'
    | 'plane';
  weaponId?: 'pistol' | 'rifle' | 'rocket';
  hasBouncingSpread?: boolean;
  isMassDestructionSuperWeapon?: boolean;
  buddyStatMultiplier?: {
    hpMultiplier: number;
    speedMultiplier: number;
  };
  vehicleStatMultiplier?: {
    seats: 1 | 2;
    armorMultiplier: number;
    speedMultiplier: number;
    isLightVehicle: boolean;
  };
  isOddStackCount: boolean;
  basePatternCratesUsed: number;
  leftoverWeaponDropsCount: number;
  leftoverWeaponDrops: LeftoverPadWeaponDropSpec[];
}

export interface TeamBuddiesStackingPatternCatalogEntry {
  shapeKey: '1x1x1' | '2x1x1' | '1x1x2' | '2x2x1' | '2x1x2' | '2x2x2';
  crateCount: 1 | 2 | 4 | 8;
  patternTitle: string;
  categoryLabel: string;
  standardYellowOrangeOutputs: string[];
  upgradeBlueOutputs: string[];
  specialPurpleOutputs: string[];
}

export const TEAM_BUDDIES_STACKING_PATTERNS: Record<
  '1x1x1' | '2x1x1' | '1x1x2' | '2x2x1' | '2x1x2' | '2x2x2',
  TeamBuddiesStackingPatternCatalogEntry
> = {
  '1x1x1': {
    shapeKey: '1x1x1',
    crateCount: 1,
    patternTitle: '1 Crate (Free Position)',
    categoryLabel: 'Light Weapons (Tier 1)',
    standardYellowOrangeOutputs: ['Uzi', 'Shotgun', 'Pistol', 'Mini Flamethrower', 'Basic Grenade'],
    upgradeBlueOutputs: ['Super Shotgun (Spread & Ricochet Rounds)', 'Plasma Gun'],
    specialPurpleOutputs: ['Nuclear Launcher', 'Airstrike Marker', 'Ion Cannon'],
  },
  '2x1x1': {
    shapeKey: '2x1x1',
    crateCount: 2,
    patternTitle: '2 Horizontal Crates (1 Layer)',
    categoryLabel: 'Medium Weapons (Tier 2)',
    standardYellowOrangeOutputs: ['Bazooka', 'Assault Rifle', 'Sniper Rifle', 'Shuriken'],
    upgradeBlueOutputs: ['Laser Gun', 'Super Bazooka', 'Skyshield 35mm Turret'],
    specialPurpleOutputs: ['Ion Cannon Rifle', 'Skyshield 35mm Turret'],
  },
  '1x1x2': {
    shapeKey: '1x1x2',
    crateCount: 2,
    patternTitle: '2 Vertical Crates (1x1x2 Column)',
    categoryLabel: 'Squad Units (Buddy)',
    standardYellowOrangeOutputs: ['Standard Infantry (Regular Buddy)', 'Medic Buddy'],
    upgradeBlueOutputs: [
      'Super Buddy: Commando (2x HP & 2x Sprint Speed)',
      'Super Buddy: Robo-Buddy / Cyborg (2x HP & 2x Sprint Speed)',
    ],
    specialPurpleOutputs: ['Ninja / Stealth Buddy (Katana + Shuriken)', 'Super Buddie'],
  },
  '2x2x1': {
    shapeKey: '2x2x1',
    crateCount: 4,
    patternTitle: '4 Flat Crates (Full 2x2x1 Floor)',
    categoryLabel: 'Heavy Weapons / Turrets (Tier 3)',
    standardYellowOrangeOutputs: [
      'Gatling Gun',
      'Homing Missile Launcher',
      'Mortar',
      'Auto-Turret / Base Defense Cannon',
      'Blitz Dump Truck',
    ],
    upgradeBlueOutputs: [
      'Heavy Gatling Laser',
      'Twin Homing Missile Launcher',
      'Super Auto-Turret (Skyshield Mk.II)',
      'Heavy Dump Truck',
    ],
    specialPurpleOutputs: ['Ion Cannon Turret', 'Tactical Nuke Mortar', 'Heavy Dump Truck'],
  },
  '2x1x2': {
    shapeKey: '2x1x2',
    crateCount: 4,
    patternTitle: '4 Vertical Crates (2x1x2 Wall)',
    categoryLabel: 'Light Vehicles',
    standardYellowOrangeOutputs: [
      'Mini-Tank (1 Seat)',
      'Motorbike / Trike',
      'AT-ST Walker',
      'Speedboat',
    ],
    upgradeBlueOutputs: [
      'Super Mini-Tank (Laser Mini-Tank)',
      'Armored AT-ST Walker',
      'Super Buddie',
    ],
    specialPurpleOutputs: ['Stealth Hover-Tank', 'Super Buddie'],
  },
  '2x2x2': {
    shapeKey: '2x2x2',
    crateCount: 8,
    patternTitle: '8 Full Crates (2x2x2 Cube)',
    categoryLabel: 'Heavy Vehicles & Aircraft',
    standardYellowOrangeOutputs: [
      'Heavy Tank (2 Seats: Driver + Main Gunner)',
      'APC',
      'Blitz Tank',
    ],
    upgradeBlueOutputs: [
      'Super Tank: Laser Tank (Heavy Reinforced Armor)',
      'Super Tank: Mammoth / Tyrant Tank (2.2x Armor)',
    ],
    specialPurpleOutputs: [
      'Heavy Bomber Aircraft',
      'Attack Helicopter',
      'Blitz Fighter Plane',
    ],
  },
};

export const TEAM_BUDDIES_CRATE_SCHEMES: Record<
  TeamBuddiesCrateSchemeId,
  {
    id: TeamBuddiesCrateSchemeId;
    name: string;
    tier1Standard: string;
    tier1BlueSuper: string;
    tier2Standard: string;
    tier2BlueSuper: string;
    tier3HeavyStandard: string;
    tier3HeavyBlueSuper: string;
    lightVehicleStandard: string;
    lightVehicleBlueSuper: string;
    heavyVehicleStandard: string;
    heavyVehicleBlueSuper: string;
    aircraftLegend: string;
    purpleSuperWeapon: string;
  }
> = {
  classic_military: {
    id: 'classic_military',
    name: 'Classic Military Scheme',
    tier1Standard: 'Uzi / Shotgun',
    tier1BlueSuper: 'Super Shotgun (Spread & Ricochet)',
    tier2Standard: 'Bazooka / Assault Rifle',
    tier2BlueSuper: 'Super Bazooka / Skyshield Turret',
    tier3HeavyStandard: 'Gatling Gun / Auto-Turret',
    tier3HeavyBlueSuper: 'Homing Missile Launcher / Super Auto-Turret',
    lightVehicleStandard: 'Mini-Tank (1 Seat)',
    lightVehicleBlueSuper: 'Super Mini-Tank (Laser Mini-Tank)',
    heavyVehicleStandard: 'Heavy Tank (2 Seats)',
    heavyVehicleBlueSuper: 'Mammoth / Tyrant Super Tank',
    aircraftLegend: 'Heavy Bomber / Blitz Fighter Plane',
    purpleSuperWeapon: 'Nuclear Launcher',
  },
  cyber_tech: {
    id: 'cyber_tech',
    name: 'Cyber Tech Scheme',
    tier1Standard: 'Pistol / Mini Flamethrower',
    tier1BlueSuper: 'Plasma Gun (Bounce)',
    tier2Standard: 'Laser Gun / Sniper Rifle',
    tier2BlueSuper: 'Pulse Laser Rifle / Skyshield Turret',
    tier3HeavyStandard: 'Auto-Turret / Mortar',
    tier3HeavyBlueSuper: 'Heavy Plasma Gatling / Super Auto-Turret',
    lightVehicleStandard: 'AT-ST Walker (1 Seat)',
    lightVehicleBlueSuper: 'Armored Laser Walker',
    heavyVehicleStandard: 'APC / Heavy Tank',
    heavyVehicleBlueSuper: 'Laser Tank (Super Armor)',
    aircraftLegend: 'Attack Helicopter / Bomber',
    purpleSuperWeapon: 'Ion Cannon',
  },
  heavy_ordnance: {
    id: 'heavy_ordnance',
    name: 'Heavy Ordnance Scheme',
    tier1Standard: 'Shotgun / Basic Grenade',
    tier1BlueSuper: 'Super Shotgun (Ricochet)',
    tier2Standard: 'Bazooka',
    tier2BlueSuper: 'Cluster Bazooka / Skyshield Turret',
    tier3HeavyStandard: 'Mortar / Gatling Gun',
    tier3HeavyBlueSuper: 'Twin Homing Missile Launcher',
    lightVehicleStandard: 'Motorbike / Trike (1 Seat)',
    lightVehicleBlueSuper: 'Super Recon Mini-Tank',
    heavyVehicleStandard: 'Heavy Tank (2 Seats)',
    heavyVehicleBlueSuper: 'Mammoth Tank (Super Armor)',
    aircraftLegend: 'Heavy Carpet Bomber',
    purpleSuperWeapon: 'Airstrike Marker',
  },
  special_ops: {
    id: 'special_ops',
    name: 'Special Ops Scheme',
    tier1Standard: 'Uzi / Pistol',
    tier1BlueSuper: 'Plasma Gun / Super Shotgun',
    tier2Standard: 'Sniper Rifle / Shuriken',
    tier2BlueSuper: 'Laser Sniper / Skyshield Turret',
    tier3HeavyStandard: 'Homing Missile Launcher',
    tier3HeavyBlueSuper: 'Stealth Auto-Turret',
    lightVehicleStandard: 'Speedboat / Mini-Tank (1 Seat)',
    lightVehicleBlueSuper: 'Stealth Mini-Tank',
    heavyVehicleStandard: 'APC (2 Seats)',
    heavyVehicleBlueSuper: 'Laser Mammoth Tank',
    aircraftLegend: 'Stealth Fighter Bomber',
    purpleSuperWeapon: 'Nuclear Launcher',
  },
};

export type BuddyClassId =
  | 'Infuntry'
  | 'Commando'
  | 'Medic'
  | 'Ninja'
  | 'Cyborg'
  | 'Stealthy'
  | 'SuperBuddie';

export interface BuddyClassSpec {
  id: BuddyClassId;
  name: string;
  tier: 1 | 2;
  isSuperOnly: boolean;
  maxHp: number;
  speedMultiplier: number;
  jumpMultiplier: number;
  colorHex: string;
  canSliceMergedCrates: boolean;
  vehicleResistant: boolean;
  canFly: boolean;
  traitLabel: string;
}

export const BUDDY_CLASSES: Record<BuddyClassId, BuddyClassSpec> = {
  Infuntry: {
    id: 'Infuntry',
    name: 'Infuntry',
    tier: 1,
    isSuperOnly: false,
    maxHp: 150,
    speedMultiplier: 1.0,
    jumpMultiplier: 1.0,
    colorHex: '#ff3b30',
    canSliceMergedCrates: false,
    vehicleResistant: false,
    canFly: false,
    traitLabel: 'Crate Harvester',
  },
  Commando: {
    id: 'Commando',
    name: 'Commando',
    tier: 2,
    isSuperOnly: false,
    maxHp: 135,
    speedMultiplier: 1.2,
    jumpMultiplier: 1.05,
    colorHex: '#ff9500',
    canSliceMergedCrates: false,
    vehicleResistant: false,
    canFly: false,
    traitLabel: 'Super-Strafe',
  },
  Medic: {
    id: 'Medic',
    name: 'Medic',
    tier: 1,
    isSuperOnly: false,
    maxHp: 110,
    speedMultiplier: 1.05,
    jumpMultiplier: 1.0,
    colorHex: '#ffffff',
    canSliceMergedCrates: false,
    vehicleResistant: false,
    canFly: false,
    traitLabel: 'HP Regen Aura',
  },
  Ninja: {
    id: 'Ninja',
    name: 'Ninja',
    tier: 1,
    isSuperOnly: false,
    maxHp: 115,
    speedMultiplier: 1.38,
    jumpMultiplier: 1.45,
    colorHex: '#1c1c28',
    canSliceMergedCrates: true,
    vehicleResistant: false,
    canFly: false,
    traitLabel: 'Katana Crate Slicer',
  },
  Cyborg: {
    id: 'Cyborg',
    name: 'Cyborg',
    tier: 2,
    isSuperOnly: false,
    maxHp: 180,
    speedMultiplier: 0.95,
    jumpMultiplier: 1.0,
    colorHex: '#7d889e',
    canSliceMergedCrates: false,
    vehicleResistant: true,
    canFly: false,
    traitLabel: 'Anti-Tank Fist',
  },
  Stealthy: {
    id: 'Stealthy',
    name: 'Stealthy',
    tier: 1,
    isSuperOnly: true,
    maxHp: 125,
    speedMultiplier: 1.3,
    jumpMultiplier: 1.25,
    colorHex: '#4f46e5',
    canSliceMergedCrates: true,
    vehicleResistant: false,
    canFly: false,
    traitLabel: 'Cloak + Disarm',
  },
  SuperBuddie: {
    id: 'SuperBuddie',
    name: 'Super Buddie',
    tier: 2,
    isSuperOnly: true,
    maxHp: 260,
    speedMultiplier: 1.45,
    jumpMultiplier: 1.8,
    colorHex: '#00d2ff',
    canSliceMergedCrates: false,
    vehicleResistant: true,
    canFly: true,
    traitLabel: 'Flight + Laser Eyes',
  },
};

export type TeamCommandMode = 'FOLLOW' | 'HARVEST' | 'ATTACK' | 'DEFEND' | 'MOUNT';

/**
 * Builds a single Tier-1 / Super / Special leftover weapon drop spec from an excess crate on the Stacking Pad.
 * Used when the player strikes an incomplete/odd stack (3, 5, 6, or 7 crates):
 * the pad produces the nearest valid lower pattern (1, 2, or 4 crates) PLUS leftover weapon drops for each excess crate!
 */
export function buildLeftoverCrateWeaponDrop(
  crateKind: Exclude<CrateSlotType, 'empty'>,
  schemeId: TeamBuddiesCrateSchemeId = 'classic_military',
): LeftoverPadWeaponDropSpec {
  const scheme = TEAM_BUDDIES_CRATE_SCHEMES[schemeId] ?? TEAM_BUDDIES_CRATE_SCHEMES.classic_military;
  if (crateKind === 'legend') {
    return {
      crateKind,
      weaponId: 'rocket',
      outputName: scheme.purpleSuperWeapon,
      isSuper: true,
      isLegend: true,
      hasBouncingSpread: false,
      isMassDestructionSuperWeapon: true,
    };
  }
  if (crateKind === 'super') {
    return {
      crateKind,
      weaponId: 'rifle',
      outputName: scheme.tier1BlueSuper,
      isSuper: true,
      isLegend: false,
      hasBouncingSpread: true,
      isMassDestructionSuperWeapon: false,
    };
  }
  return {
    crateKind,
    weaponId: 'pistol',
    outputName: scheme.tier1Standard,
    isSuper: false,
    isLegend: false,
    hasBouncingSpread: false,
    isMassDestructionSuperWeapon: false,
  };
}

/**
 * Pure Team Buddies 2x2x2 Stacking Pad Recipe Evaluator.
 * Slots 0..3 represent bottom layer (2x2); slots 4..7 represent top layer (2x2).
 * Supports Standard Yellow/Orange ('red'), Upgrade Blue ('super'), and Special Purple ('legend') crate combinations
 * as well as World Crate Schemes (`TeamBuddiesCrateSchemeId`) and Odd-Count Breakdown (`3, 5, 6, or 7 crates`):
 * - 1x1x1 (1 crate): Senjata Ringan (Tier 1) — Uzi/Shotgun/Pistol (Yellow), Super Shotgun Spread+Bounce / Plasma Gun (Blue), Nuclear Launcher / Supazooka (Purple)
 * - 2x1x1 (2 horizontal crates): Senjata Menengah (Tier 2) — Bazooka/Assault Rifle/Sniper/Shuriken (Yellow), Laser Gun / Skyshield 35mm Turret (Blue/Purple)
 * - 1x1x2 (2 vertical crates): Unit Pasukan (Buddy) — Infantry/Medic (Yellow, 1x HP & Speed), Super Buddy Commando/Robo-Buddy (Blue, 2x HP & 2x Speed), Ninja/Cyborg (Purple)
 * - 2x2x1 (4 flat 2x2 crates): Senjata Berat / Turret (Tier 3) & Dump Truck — Gatling/Homing/Mortar/Auto-Turret/Dump Truck
 * - 2x1x2 (4 vertical wall crates): Kendaraan Ringan & Super Unit — Mini-Tank (1 Kursi) / Motorbike / AT-ST Walker (Yellow), Super Laser Mini-Tank / Super Buddie (Blue/Purple)
 * - 2x2x2 (8 full cube crates): Kendaraan Berat & Pesawat — Heavy Tank 2 Kursi / Blitz Tank (Yellow), Super Tank / Mammoth Tyrant Tank 2.2x Armor (Blue), Pesawat Pengebom / Blitz Fighter Plane (Purple)
 * - Jumlah Tanggung (3, 5, 6, atau 7 peti): Menghasilkan objek dari pola terdekat di bawahnya (2 atau 4 peti) DITAMBAH sisa senjata kecil (`leftoverWeaponDrops`) sesuai jumlah peti sisa!
 */
export function evaluateStackingPadRecipe(
  slots: ReadonlyArray<CrateSlotType>,
  schemeId: TeamBuddiesCrateSchemeId = 'classic_military',
): PadEvaluationResult {
  const scheme = TEAM_BUDDIES_CRATE_SCHEMES[schemeId] ?? TEAM_BUDDIES_CRATE_SCHEMES.classic_military;
  let redCount = 0;
  let superCount = 0;
  let legendCount = 0;
  let bottomCount = 0;
  let topCount = 0;
  const filledKinds: Array<Exclude<CrateSlotType, 'empty'>> = [];

  for (let i = 0; i < 8; i++) {
    const s = slots[i] ?? 'empty';
    if (s === 'red') redCount++;
    if (s === 'super') superCount++;
    if (s === 'legend') legendCount++;
    if (s !== 'empty') {
      filledKinds.push(s);
      if (i < 4) bottomCount++;
      else topCount++;
    }
  }

  const totalCrates = redCount + superCount + legendCount;
  const isMerged = totalCrates >= 2;
  const isLegend = legendCount >= 1;
  const isSuper = superCount >= 1 || isLegend;

  if (totalCrates === 0) {
    return {
      totalCrates: 0,
      redCount: 0,
      superCount: 0,
      legendCount: 0,
      isMerged: false,
      isSuper: false,
      isLegend: false,
      shapeKey: 'Empty',
      category: 'none',
      teamBuddiesCategoryLabel: 'Empty Pad',
      outputName: 'Empty Pad',
      crateSchemeVariantName: 'Empty Pad',
      crateSchemeExamples: [],
      spawnType: 'none',
      isOddStackCount: false,
      basePatternCratesUsed: 0,
      leftoverWeaponDropsCount: 0,
      leftoverWeaponDrops: [],
    };
  }

  const computeLeftovers = (baseUsed: number): LeftoverPadWeaponDropSpec[] => {
    const excessCount = Math.max(0, totalCrates - baseUsed);
    if (excessCount <= 0) return [];
    const leftovers: LeftoverPadWeaponDropSpec[] = [];
    for (let i = filledKinds.length - excessCount; i < filledKinds.length; i++) {
      leftovers.push(buildLeftoverCrateWeaponDrop(filledKinds[i], schemeId));
    }
    return leftovers;
  };

  if (totalCrates === 8) {
    const patternMeta = TEAM_BUDDIES_STACKING_PATTERNS['2x2x2'];
    if (isLegend) {
      return {
        totalCrates,
        redCount,
        superCount,
        legendCount,
        isMerged,
        isSuper,
        isLegend,
        shapeKey: '2x2x2',
        category: 'aircraft',
        teamBuddiesCategoryLabel: patternMeta.categoryLabel,
        outputName: 'Blitz Fighter Plane',
        crateSchemeVariantName: scheme.aircraftLegend,
        crateSchemeExamples: patternMeta.specialPurpleOutputs,
        spawnType: 'plane',
        vehicleStatMultiplier: {
          seats: 2,
          armorMultiplier: 2.5,
          speedMultiplier: 1.8,
          isLightVehicle: false,
        },
        isOddStackCount: false,
        basePatternCratesUsed: 8,
        leftoverWeaponDropsCount: 0,
        leftoverWeaponDrops: [],
      };
    }
    return {
      totalCrates,
      redCount,
      superCount,
      legendCount,
      isMerged,
      isSuper,
      isLegend,
      shapeKey: '2x2x2',
      category: 'vehicle',
      teamBuddiesCategoryLabel: patternMeta.categoryLabel,
      outputName: isSuper ? 'Tyrant Tank' : 'Blitz Tank',
      crateSchemeVariantName: isSuper ? scheme.heavyVehicleBlueSuper : scheme.heavyVehicleStandard,
      crateSchemeExamples: isSuper
        ? patternMeta.upgradeBlueOutputs
        : patternMeta.standardYellowOrangeOutputs,
      spawnType: 'tank',
      vehicleStatMultiplier: {
        seats: 2,
        armorMultiplier: isSuper ? 2.2 : 1.0,
        speedMultiplier: isSuper ? 1.15 : 1.0,
        isLightVehicle: false,
      },
      isOddStackCount: false,
      basePatternCratesUsed: 8,
      leftoverWeaponDropsCount: 0,
      leftoverWeaponDrops: [],
    };
  }

  if (totalCrates >= 4) {
    const isVerticalWall = topCount >= 2;
    const leftovers = computeLeftovers(4);
    const isOdd = totalCrates !== 4;
    if (isVerticalWall) {
      const patternMeta = TEAM_BUDDIES_STACKING_PATTERNS['2x1x2'];
      return {
        totalCrates,
        redCount,
        superCount,
        legendCount,
        isMerged,
        isSuper,
        isLegend,
        shapeKey: '2x1x2',
        category: 'buddy_t2',
        teamBuddiesCategoryLabel: patternMeta.categoryLabel,
        outputName: isSuper ? 'Super Buddie' : 'Commando / Cyborg',
        crateSchemeVariantName: isSuper ? scheme.lightVehicleBlueSuper : scheme.lightVehicleStandard,
        crateSchemeExamples: isLegend
          ? patternMeta.specialPurpleOutputs
          : isSuper
            ? patternMeta.upgradeBlueOutputs
            : patternMeta.standardYellowOrangeOutputs,
        spawnType: 'buddy',
        buddyStatMultiplier: {
          hpMultiplier: isSuper ? 2.0 : 1.35,
          speedMultiplier: isSuper ? 2.0 : 1.2,
        },
        vehicleStatMultiplier: {
          seats: 1,
          armorMultiplier: isSuper ? 1.8 : 1.0,
          speedMultiplier: isSuper ? 1.5 : 1.35,
          isLightVehicle: true,
        },
        isOddStackCount: isOdd,
        basePatternCratesUsed: 4,
        leftoverWeaponDropsCount: leftovers.length,
        leftoverWeaponDrops: leftovers,
      };
    }
    const patternMeta = TEAM_BUDDIES_STACKING_PATTERNS['2x2x1'];
    return {
      totalCrates,
      redCount,
      superCount,
      legendCount,
      isMerged,
      isSuper,
      isLegend,
      shapeKey: '2x2x1',
      category: 'truck',
      teamBuddiesCategoryLabel: patternMeta.categoryLabel,
      outputName: isSuper ? 'Heavy Dump Truck' : 'Blitz Dump Truck',
      crateSchemeVariantName: isSuper ? scheme.tier3HeavyBlueSuper : scheme.tier3HeavyStandard,
      crateSchemeExamples: isLegend
        ? patternMeta.specialPurpleOutputs
        : isSuper
          ? patternMeta.upgradeBlueOutputs
          : patternMeta.standardYellowOrangeOutputs,
      spawnType: 'truck',
      isOddStackCount: isOdd,
      basePatternCratesUsed: 4,
      leftoverWeaponDropsCount: leftovers.length,
      leftoverWeaponDrops: leftovers,
    };
  }

  if (totalCrates >= 2) {
    const isVerticalColumn = topCount >= 1;
    const leftovers = computeLeftovers(2);
    const isOdd = totalCrates !== 2;
    if (isVerticalColumn) {
      const patternMeta = TEAM_BUDDIES_STACKING_PATTERNS['1x1x2'];
      return {
        totalCrates,
        redCount,
        superCount,
        legendCount,
        isMerged,
        isSuper,
        isLegend,
        shapeKey: '1x1x2',
        category: 'buddy_t1',
        teamBuddiesCategoryLabel: patternMeta.categoryLabel,
        outputName: isLegend
          ? 'Commando / Ninja'
          : isSuper
            ? 'Stealthy / Ninja'
            : 'Infuntry / Medic',
        crateSchemeVariantName: isLegend
          ? 'Super Ninja / Cyborg Buddy (2x HP & 2x Speed)'
          : isSuper
            ? 'Super Buddy: Commando / Robo-Buddy (2x HP & 2x Speed)'
            : 'Standard Infantry (Regular Buddy)',
        crateSchemeExamples: isLegend
          ? patternMeta.specialPurpleOutputs
          : isSuper
            ? patternMeta.upgradeBlueOutputs
            : patternMeta.standardYellowOrangeOutputs,
        spawnType: 'buddy',
        buddyStatMultiplier: {
          hpMultiplier: isLegend ? 2.4 : isSuper ? 2.0 : 1.0,
          speedMultiplier: isLegend ? 2.0 : isSuper ? 2.0 : 1.0,
        },
        isOddStackCount: isOdd,
        basePatternCratesUsed: 2,
        leftoverWeaponDropsCount: leftovers.length,
        leftoverWeaponDrops: leftovers,
      };
    }
    const patternMeta = TEAM_BUDDIES_STACKING_PATTERNS['2x1x1'];
    if (isSuper || isLegend) {
      return {
        totalCrates,
        redCount,
        superCount,
        legendCount,
        isMerged,
        isSuper,
        isLegend,
        shapeKey: '2x1x1',
        category: 'skyshield',
        teamBuddiesCategoryLabel: patternMeta.categoryLabel,
        outputName: 'Skyshield 35mm Turret',
        crateSchemeVariantName: scheme.tier2BlueSuper,
        crateSchemeExamples: isLegend
          ? patternMeta.specialPurpleOutputs
          : patternMeta.upgradeBlueOutputs,
        spawnType: 'skyshield',
        weaponId: 'rocket',
        isOddStackCount: isOdd,
        basePatternCratesUsed: 2,
        leftoverWeaponDropsCount: leftovers.length,
        leftoverWeaponDrops: leftovers,
      };
    }
    return {
      totalCrates,
      redCount,
      superCount,
      legendCount,
      isMerged,
      isSuper,
      isLegend,
      shapeKey: '2x1x1',
      category: 'heavy_weapon',
      teamBuddiesCategoryLabel: patternMeta.categoryLabel,
      outputName: 'Bazooka / Grenade',
      crateSchemeVariantName: scheme.tier2Standard,
      crateSchemeExamples: patternMeta.standardYellowOrangeOutputs,
      spawnType: 'weapon',
      weaponId: 'rocket',
      isOddStackCount: isOdd,
      basePatternCratesUsed: 2,
      leftoverWeaponDropsCount: leftovers.length,
      leftoverWeaponDrops: leftovers,
    };
  }

  const patternMeta1 = TEAM_BUDDIES_STACKING_PATTERNS['1x1x1'];
  return {
    totalCrates: 1,
    redCount,
    superCount,
    legendCount,
    isMerged: false,
    isSuper,
    isLegend,
    shapeKey: '1x1x1',
    category: isLegend ? 'heavy_weapon' : 'lite_weapon',
    teamBuddiesCategoryLabel: patternMeta1.categoryLabel,
    outputName: isLegend ? 'Supazooka' : isSuper ? 'Assault Rifle' : 'Pistol / Uzi',
    crateSchemeVariantName: isLegend
      ? scheme.purpleSuperWeapon
      : isSuper
        ? scheme.tier1BlueSuper
        : scheme.tier1Standard,
    crateSchemeExamples: isLegend
      ? patternMeta1.specialPurpleOutputs
      : isSuper
        ? patternMeta1.upgradeBlueOutputs
        : patternMeta1.standardYellowOrangeOutputs,
    spawnType: 'weapon',
    weaponId: isLegend ? 'rocket' : isSuper ? 'rifle' : 'pistol',
    hasBouncingSpread: isSuper && !isLegend,
    isMassDestructionSuperWeapon: isLegend,
    isOddStackCount: false,
    basePatternCratesUsed: 1,
    leftoverWeaponDropsCount: 0,
    leftoverWeaponDrops: [],
  };
}

export type BuildOrderTarget =
  | '1x1x1'
  | '2x1x1'
  | '1x1x2'
  | '2x2x1'
  | '2x1x2'
  | '2x2x2'
  | 'upgrade_building'
  | 'upgrade_fence'
  | 'build_parking'
  | 'build_helipad'
  | 'AUTO';

/**
 * Unified 1:1 world-space side length (meters) for all crates:
 * - Ground crates (`worldCrates`)
 * - Overhead carried crates (`buddy.overheadCrateGroup`, compensated for `bodyGroup` 1.16x scale)
 * - Stacking Pad crates & slot wireframes (`slotGeo`, `ghostSlotGeo`)
 */
export const UNIFIED_WORLD_CRATE_SIZE = 1.32;

export interface BuildOrderSpec {
  key: BuildOrderTarget;
  label: string;
  targetCrates: number;
  allowedSlots: ReadonlyArray<number>;
  ghostBoxSize: [number, number, number];
  ghostBoxCenter: [number, number, number];
}

export const BUILD_ORDER_SPECS: Record<BuildOrderTarget, BuildOrderSpec> = {
  '1x1x1': {
    key: '1x1x1',
    label: 'Weapon (1x1x1)',
    targetCrates: 1,
    allowedSlots: [0],
    ghostBoxSize: [1.34, 1.34, 1.34],
    ghostBoxCenter: [-0.95, 0.93, -0.95],
  },
  '2x1x1': {
    key: '2x1x1',
    label: 'Bazooka / Skyshield',
    targetCrates: 2,
    allowedSlots: [0, 1],
    ghostBoxSize: [3.24, 1.34, 1.34],
    ghostBoxCenter: [0, 0.93, -0.95],
  },
  '1x1x2': {
    key: '1x1x2',
    label: 'Buddy T1',
    targetCrates: 2,
    allowedSlots: [0, 4],
    ghostBoxSize: [1.34, 2.66, 1.34],
    ghostBoxCenter: [-0.95, 1.59, -0.95],
  },
  '2x2x1': {
    key: '2x2x1',
    label: 'Dump Truck (2x2x1)',
    targetCrates: 4,
    allowedSlots: [0, 1, 2, 3],
    ghostBoxSize: [3.24, 1.34, 3.24],
    ghostBoxCenter: [0, 0.93, 0],
  },
  '2x1x2': {
    key: '2x1x2',
    label: 'Buddy T2',
    targetCrates: 4,
    allowedSlots: [0, 1, 4, 5],
    ghostBoxSize: [3.24, 2.66, 1.34],
    ghostBoxCenter: [0, 1.59, -0.95],
  },
  '2x2x2': {
    key: '2x2x2',
    label: 'Tank / Plane',
    targetCrates: 8,
    allowedSlots: [0, 1, 2, 3, 4, 5, 6, 7],
    ghostBoxSize: [3.24, 2.66, 3.24],
    ghostBoxCenter: [0, 1.59, 0],
  },
  upgrade_building: {
    key: 'upgrade_building',
    label: 'Upgrade Base HQ (Lv.2/3)',
    targetCrates: 2,
    allowedSlots: [0, 1, 2, 3],
    ghostBoxSize: [3.24, 1.34, 1.34],
    ghostBoxCenter: [0, 0.93, -0.95],
  },
  upgrade_fence: {
    key: 'upgrade_fence',
    label: 'Upgrade Iron Fence (Lv.2/3)',
    targetCrates: 2,
    allowedSlots: [0, 1, 2, 3],
    ghostBoxSize: [3.24, 1.34, 1.34],
    ghostBoxCenter: [0, 0.93, -0.95],
  },
  build_parking: {
    key: 'build_parking',
    label: 'Build Vehicle Parking',
    targetCrates: 2,
    allowedSlots: [0, 1],
    ghostBoxSize: [3.24, 1.34, 1.34],
    ghostBoxCenter: [0, 0.93, -0.95],
  },
  build_helipad: {
    key: 'build_helipad',
    label: 'Build Helipad (H)',
    targetCrates: 4,
    allowedSlots: [0, 1, 2, 3],
    ghostBoxSize: [3.24, 1.34, 3.24],
    ghostBoxCenter: [0, 0.93, 0],
  },
  AUTO: {
    key: 'AUTO',
    label: 'Auto',
    targetCrates: 8,
    allowedSlots: [0, 4, 1, 5, 2, 3, 6, 7],
    ghostBoxSize: [3.24, 2.66, 3.24],
    ghostBoxCenter: [0, 1.59, 0],
  },
};

export function getBuildOrderAllowedSlots(buildOrder: BuildOrderTarget): ReadonlyArray<number> {
  return BUILD_ORDER_SPECS[buildOrder]?.allowedSlots ?? BUILD_ORDER_SPECS.AUTO.allowedSlots;
}

/**
 * Selects the next physical 3D slot index (0..7) on a 2x2x2 Stacking Pad
 * strictly constrained to the active Build Order pattern's allowed slots.
 * Returns -1 when all slots in the active Build Order pattern are full.
 */
export function chooseNextPadSlotIndex(
  slots: ReadonlyArray<CrateSlotType>,
  buildOrder: BuildOrderTarget = '1x1x2',
): number {
  const allowedSlots = getBuildOrderAllowedSlots(buildOrder);
  for (const idx of allowedSlots) {
    if ((slots[idx] ?? 'empty') === 'empty') {
      return idx;
    }
  }
  return -1;
}

export interface CursorCommandInput {
  cursorX: number;
  cursorZ: number;
  crates: ReadonlyArray<{ x: number; z: number }>;
  enemies: ReadonlyArray<{ x: number; z: number }>;
  emptyTanks: ReadonlyArray<{ x: number; z: number }>;
  blueBase: { x: number; z: number; padX: number; padZ: number };
  redBase: { x: number; z: number; padX: number; padZ: number };
  currentCommand: TeamCommandMode;
}

export interface CursorCommandResolution {
  command: TeamCommandMode;
  saluteLabel: string;
  targetTankIndex: number;
}

/**
 * Resolves AI Squad command [V] based on what 3D object is under the player's cursor crosshair.
 */
export function resolveCursorCommandTarget(input: CursorCommandInput): CursorCommandResolution {
  const { cursorX, cursorZ, crates, enemies, emptyTanks, blueBase, redBase, currentCommand } = input;

  // 1. Check unoccupied Blue Tank under cursor (within 5.5m)
  for (let i = 0; i < emptyTanks.length; i++) {
    const t = emptyTanks[i];
    if (Math.hypot(cursorX - t.x, cursorZ - t.z) <= 5.5) {
      return { command: 'MOUNT', saluteLabel: 'MOUNT TANK', targetTankIndex: i };
    }
  }

  // 2. Check Crate under cursor (within 5.2m)
  for (const c of crates) {
    if (Math.hypot(cursorX - c.x, cursorZ - c.z) <= 5.2) {
      return { command: 'HARVEST', saluteLabel: 'HARVEST CRATES', targetTankIndex: -1 };
    }
  }

  // 3. Check Enemy unit or Red Base HQ under cursor
  for (const e of enemies) {
    if (Math.hypot(cursorX - e.x, cursorZ - e.z) <= 6.0) {
      return { command: 'ATTACK', saluteLabel: 'ATTACK ENEMY', targetTankIndex: -1 };
    }
  }
  if (
    Math.hypot(cursorX - redBase.x, cursorZ - redBase.z) <= 8.5 ||
    Math.hypot(cursorX - redBase.padX, cursorZ - redBase.padZ) <= 6.5
  ) {
    return { command: 'ATTACK', saluteLabel: 'ATTACK RED HQ', targetTankIndex: -1 };
  }

  // 4. Check Blue Base HQ or Blue Stacking Pad under cursor
  if (
    Math.hypot(cursorX - blueBase.x, cursorZ - blueBase.z) <= 8.5 ||
    Math.hypot(cursorX - blueBase.padX, cursorZ - blueBase.padZ) <= 6.5
  ) {
    return { command: 'DEFEND', saluteLabel: 'DEFEND BASE', targetTankIndex: -1 };
  }

  // 5. Fallback: cycle command mode if pointing at open ground
  const cycle: TeamCommandMode[] = ['HARVEST', 'ATTACK', 'DEFEND', 'FOLLOW'];
  const idx = cycle.indexOf(currentCommand);
  const nextCmd = cycle[(idx + 1) % cycle.length];
  const labelMap: Record<TeamCommandMode, string> = {
    HARVEST: 'HARVEST CRATES',
    ATTACK: 'ATTACK ENEMY',
    DEFEND: 'DEFEND BASE',
    FOLLOW: 'FOLLOW PLAYER',
    MOUNT: 'MOUNT TANK',
  };
  return { command: nextCmd, saluteLabel: labelMap[nextCmd], targetTankIndex: -1 };
}

// ============================================================================
// OBJECT COLLISION PHYSICS (SOLID VS PUSHABLE VS DESTRUCTIBLE) & IMPACT SFX
// ============================================================================

export type ColliderCategory = 'solid' | 'pushable' | 'breakable' | 'none';
export type CollisionMaterialTag = 'metal' | 'wood' | 'concrete' | 'brick' | 'plastic' | 'tree' | 'default';

export interface PropCollisionSpec {
  category: ColliderCategory;
  materialTag: CollisionMaterialTag;
  radius: number;
  halfX?: number;
  halfZ?: number;
  mass: number;
  restitution: number;
  destructible: boolean;
  maxHp: number;
  ramBreakSpeed: number;
  /** Bullet impact impulse override (0 for fixed/massive objects). */
  shootImpulse: number;
  /** Whether this prop is allowed to wobble/jiggle when hit by bullets or bumped. False for massive/fixed structures (turbine, crane, buildings, etc.). */
  canJiggleOnHit: boolean;
}

/**
 * Maps every placed map prop kind (plus crates, trees, and base structures)
 * to its physical collision category, material sound tag, bounding radius / OBB half-extents, and durability.
 * Large fixed structures (`turbine`, `crane`, `chimney`, `giant_tank`, `giant_pipe`, `shipping_container`, `blue_hq`, etc.)
 * have `shootImpulse: 0` and `canJiggleOnHit: false` so they never shake when shot.
 */
export function getPropCollisionSpec(kind: string, scale = 1.0): PropCollisionSpec {
  const s = Math.max(0.4, scale);
  switch (kind) {
    // 1. Solid Impenetrable Heavy Static Colliders (shootImpulse: 0, canJiggleOnHit: false)
    case 'blue_hq':
    case 'red_hq':
      return {
        category: 'solid',
        materialTag: 'concrete',
        radius: 3.45 * s,
        mass: 9999,
        restitution: 0.28,
        destructible: false,
        maxHp: 2000,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    case 'blue_pad':
    case 'red_pad':
      return {
        category: 'solid',
        materialTag: 'metal',
        radius: 2.05 * s,
        mass: 9999,
        restitution: 0.25,
        destructible: false,
        maxHp: 9999,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    case 'giant_tank':
      return {
        category: 'solid',
        materialTag: 'metal',
        radius: 2.35 * s,
        mass: 9999,
        restitution: 0.36,
        destructible: false,
        maxHp: 9999,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    case 'tank_1a':
      return {
        category: 'solid',
        materialTag: 'metal',
        radius: 1.55 * s,
        halfX: 1.05 * s,
        halfZ: 2.75 * s,
        mass: 9999,
        restitution: 0.34,
        destructible: false,
        maxHp: 9999,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    case 'tank_1b':
      return {
        category: 'solid',
        materialTag: 'metal',
        radius: 1.55 * s,
        halfX: 1.22 * s,
        halfZ: 2.58 * s,
        mass: 9999,
        restitution: 0.34,
        destructible: false,
        maxHp: 9999,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    case 'forklift':
      return {
        category: 'solid',
        materialTag: 'metal',
        radius: 1.45 * s,
        halfX: 0.92 * s,
        halfZ: 1.58 * s,
        mass: 9999,
        restitution: 0.34,
        destructible: false,
        maxHp: 9999,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    case 'h_beam':
      return {
        category: 'solid',
        materialTag: 'metal',
        radius: 1.15 * s,
        halfX: 1.02 * s,
        halfZ: 2.08 * s,
        mass: 9999,
        restitution: 0.32,
        destructible: false,
        maxHp: 9999,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    case 'concrete_pipe':
      return {
        category: 'solid',
        materialTag: 'concrete',
        radius: 0.92 * s,
        halfX: 0.95 * s,
        halfZ: 0.95 * s,
        mass: 9999,
        restitution: 0.28,
        destructible: false,
        maxHp: 9999,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    case 'chimney':
      return {
        category: 'solid',
        materialTag: 'concrete',
        radius: 1.85 * s,
        halfX: 2.35 * s,
        halfZ: 1.25 * s,
        mass: 9999,
        restitution: 0.26,
        destructible: false,
        maxHp: 9999,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    case 'crane':
      return {
        category: 'solid',
        materialTag: 'metal',
        radius: 1.65 * s,
        halfX: 1.32 * s,
        halfZ: 1.85 * s,
        mass: 9999,
        restitution: 0.34,
        destructible: false,
        maxHp: 9999,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    case 'giant_pipe':
      return {
        category: 'solid',
        materialTag: 'metal',
        radius: 1.65 * s,
        halfX: 2.75 * s,
        halfZ: 0.45 * s,
        mass: 9999,
        restitution: 0.35,
        destructible: false,
        maxHp: 9999,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    case 'giant_pipe_1b':
      return {
        category: 'solid',
        materialTag: 'metal',
        radius: 1.55 * s,
        halfX: 1.15 * s,
        halfZ: 2.15 * s,
        mass: 9999,
        restitution: 0.35,
        destructible: false,
        maxHp: 9999,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    case 'pipe_cluster':
      return {
        category: 'solid',
        materialTag: 'metal',
        radius: 1.55 * s,
        halfX: 1.12 * s,
        halfZ: 2.72 * s,
        mass: 9999,
        restitution: 0.35,
        destructible: false,
        maxHp: 9999,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    case 'pipe_cluster_1b':
      return {
        category: 'solid',
        materialTag: 'metal',
        radius: 1.55 * s,
        halfX: 1.02 * s,
        halfZ: 2.72 * s,
        mass: 9999,
        restitution: 0.35,
        destructible: false,
        maxHp: 9999,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    case 'turbine':
      return {
        category: 'solid',
        materialTag: 'metal',
        radius: 1.05 * s,
        mass: 9999,
        restitution: 0.32,
        destructible: false,
        maxHp: 9999,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    case 'dump_truck':
      return {
        category: 'solid',
        materialTag: 'metal',
        radius: 2.15 * s,
        halfX: 1.32 * s,
        halfZ: 2.75 * s,
        mass: 9999,
        restitution: 0.35,
        destructible: false,
        maxHp: 9999,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    case 'power_core':
      return {
        category: 'solid',
        materialTag: 'metal',
        radius: 1.65 * s,
        halfX: 2.15 * s,
        halfZ: 1.95 * s,
        mass: 9999,
        restitution: 0.34,
        destructible: false,
        maxHp: 9999,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    case 'lamppost_1a':
    case 'lamppost_1b':
      return {
        category: 'solid',
        materialTag: 'metal',
        radius: 0.34 * s,
        mass: 9999,
        restitution: 0.3,
        destructible: false,
        maxHp: 9999,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    case 'hydrant':
      return {
        category: 'solid',
        materialTag: 'metal',
        radius: 0.42 * s,
        mass: 9999,
        restitution: 0.32,
        destructible: false,
        maxHp: 9999,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    case 'bench':
      return {
        category: 'solid',
        materialTag: 'wood',
        radius: 0.68 * s,
        halfX: 0.76 * s,
        halfZ: 0.36 * s,
        mass: 9999,
        restitution: 0.25,
        destructible: false,
        maxHp: 9999,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    case 'river_rock':
      return {
        category: 'solid',
        materialTag: 'concrete',
        radius: 1.08 * s,
        mass: 9999,
        restitution: 0.25,
        destructible: false,
        maxHp: 9999,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    case 'tree_purple':
    case 'tree_gold':
      return {
        category: 'solid',
        materialTag: 'tree',
        radius: 0.96 * s,
        mass: 9999,
        restitution: 0.26,
        destructible: false,
        maxHp: 9999,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    case 'shipping_container':
      return {
        category: 'solid',
        materialTag: 'metal',
        radius: 1.55 * s,
        halfX: 1.62 * s,
        halfZ: 3.64 * s,
        mass: 9999,
        restitution: 0.3,
        destructible: false,
        maxHp: 9999,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };

    // 2. Pushable / Physics Props (exact BUDDIES shootImpulse from Ri.objectShootImpulseOverrides)
    case 'wheelbarrow':
      return {
        category: 'pushable',
        materialTag: 'metal',
        radius: 0.68 * s,
        mass: 2.2,
        restitution: 0.48,
        destructible: false,
        maxHp: 100,
        ramBreakSpeed: 999,
        shootImpulse: 10,
        canJiggleOnHit: true,
      };
    case 'traffic_cone':
      return {
        category: 'pushable',
        materialTag: 'plastic',
        radius: 0.38 * s,
        mass: 0.8,
        restitution: 0.58,
        destructible: false,
        maxHp: 80,
        ramBreakSpeed: 999,
        shootImpulse: 4,
        canJiggleOnHit: true,
      };
    case 'recycle_bin':
      return {
        category: 'pushable',
        materialTag: 'plastic',
        radius: 0.5 * s,
        mass: 1.4,
        restitution: 0.5,
        destructible: false,
        maxHp: 80,
        ramBreakSpeed: 999,
        shootImpulse: 4,
        canJiggleOnHit: true,
      };
    case 'barrel_1c':
    case 'fuel_cell':
    case 'circuit_module':
      return {
        category: 'pushable',
        materialTag: 'metal',
        radius: 0.5 * s,
        mass: 1.6,
        restitution: 0.45,
        destructible: false,
        maxHp: 90,
        ramBreakSpeed: 999,
        shootImpulse: 5,
        canJiggleOnHit: true,
      };
    case 'pallet_1a':
      return {
        category: 'none',
        materialTag: 'wood',
        radius: 0,
        mass: 0,
        restitution: 0,
        destructible: false,
        maxHp: 100,
        ramBreakSpeed: 999,
        shootImpulse: 6,
        canJiggleOnHit: false,
      };
    case 'barricade':
      return {
        category: 'pushable',
        materialTag: 'wood',
        radius: 0.74 * s,
        mass: 2.6,
        restitution: 0.42,
        destructible: true,
        maxHp: 28,
        ramBreakSpeed: 9.2,
        shootImpulse: 5,
        canJiggleOnHit: true,
      };
    case 'crate_wood':
      return {
        category: 'pushable',
        materialTag: 'wood',
        radius: 0.82 * s,
        mass: 1.8,
        restitution: 0.4,
        destructible: true,
        maxHp: 22,
        ramBreakSpeed: 9.5,
        shootImpulse: 5,
        canJiggleOnHit: true,
      };
    case 'crate_metal':
      return {
        category: 'pushable',
        materialTag: 'metal',
        radius: 0.82 * s,
        mass: 2.6,
        restitution: 0.42,
        destructible: true,
        maxHp: 35,
        ramBreakSpeed: 12.0,
        shootImpulse: 5,
        canJiggleOnHit: true,
      };

    // 3. Breakable / Destructible Props
    case 'concrete_fence':
      return {
        category: 'solid',
        materialTag: 'concrete',
        radius: 1.31 * s,
        halfX: 1.31 * s,
        halfZ: 0.40 * s,
        mass: 9999,
        restitution: 0.22,
        destructible: true,
        maxHp: 60,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    case 'concrete_fence_1b':
      return {
        category: 'solid',
        materialTag: 'concrete',
        radius: 1.82 * s,
        halfX: 1.82 * s,
        halfZ: 0.56 * s,
        mass: 9999,
        restitution: 0.22,
        destructible: true,
        maxHp: 60,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    case 'explosive_barrel':
      return {
        category: 'breakable',
        materialTag: 'metal',
        radius: 0.62 * s,
        mass: 2.5,
        restitution: 0.35,
        destructible: true,
        maxHp: 18,
        ramBreakSpeed: 6.5,
        shootImpulse: 0,
        canJiggleOnHit: true,
      };
    case 'flower_cluster':
      return {
        category: 'none',
        materialTag: 'default',
        radius: 0,
        mass: 0,
        restitution: 0,
        destructible: false,
        maxHp: 1,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
    default:
      return {
        category: 'solid',
        materialTag: 'default',
        radius: 1.0 * s,
        mass: 9999,
        restitution: 0.3,
        destructible: false,
        maxHp: 100,
        ramBreakSpeed: 999,
        shootImpulse: 0,
        canJiggleOnHit: false,
      };
  }
}

export interface SolidCollisionResolution2D {
  collided: boolean;
  x: number;
  z: number;
  vx: number;
  vz: number;
  impactSpeed: number;
  contactX: number;
  contactZ: number;
  normalX: number;
  normalZ: number;
}

/**
 * Resolves 2D circle-vs-circle solid collision with zero mesh penetration,
 * tangential sliding along the surface, and velocity-proportional impulse bounce.
 */
export function resolveSolidCollision2D(
  moverX: number,
  moverZ: number,
  moverVx: number,
  moverVz: number,
  moverRadius: number,
  colliderX: number,
  colliderZ: number,
  colliderRadius: number,
  restitution = 0.32,
): SolidCollisionResolution2D {
  const minDist = moverRadius + colliderRadius;
  const dx = moverX - colliderX;
  const dz = moverZ - colliderZ;
  const distSq = dx * dx + dz * dz;

  if (distSq >= minDist * minDist) {
    return {
      collided: false,
      x: moverX,
      z: moverZ,
      vx: moverVx,
      vz: moverVz,
      impactSpeed: 0,
      contactX: moverX,
      contactZ: moverZ,
      normalX: 0,
      normalZ: 1,
    };
  }

  const dist = Math.sqrt(distSq);
  const nx = dist > 1e-5 ? dx / dist : 0;
  const nz = dist > 1e-5 ? dz / dist : 1;

  // Push mover completely outside the solid collider radius (never penetrate mesh)
  const pushedX = colliderX + nx * (minDist + 0.002);
  const pushedZ = colliderZ + nz * (minDist + 0.002);

  // Decompose velocity into normal and tangential (sliding) components
  const vDotN = moverVx * nx + moverVz * nz;
  const tangentX = -nz;
  const tangentZ = nx;
  const vDotT = moverVx * tangentX + moverVz * tangentZ;

  let nextVx = moverVx;
  let nextVz = moverVz;
  let impactSpeed = 0;

  if (vDotN < 0) {
    const approachingSpeed = -vDotN;
    impactSpeed = approachingSpeed + Math.abs(vDotT) * 0.2;
    // Reflect normal component with restitution bounce + keep smooth tangential sliding
    const bouncedNormalVel = approachingSpeed * clamp(restitution, 0, 0.85);
    const slideFriction = 0.92;
    nextVx = tangentX * (vDotT * slideFriction) + nx * bouncedNormalVel;
    nextVz = tangentZ * (vDotT * slideFriction) + nz * bouncedNormalVel;
  } else {
    impactSpeed = Math.abs(vDotT) * 0.25;
  }

  return {
    collided: true,
    x: pushedX,
    z: pushedZ,
    vx: nextVx,
    vz: nextVz,
    impactSpeed,
    contactX: colliderX + nx * colliderRadius,
    contactZ: colliderZ + nz * colliderRadius,
    normalX: nx,
    normalZ: nz,
  };
}

/**
 * Tests whether a 2D point (px, pz) lies inside (or within `margin` meters of) an Oriented Bounding Box (OBB).
 */
export function pointInObb2D(
  px: number,
  pz: number,
  boxX: number,
  boxZ: number,
  halfX: number,
  halfZ: number,
  rotY = 0,
  margin = 0,
): boolean {
  const dx = px - boxX;
  const dz = pz - boxZ;
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const lx = dx * cosY - dz * sinY;
  const lz = dx * sinY + dz * cosY;
  return Math.abs(lx) <= halfX + margin && Math.abs(lz) <= halfZ + margin;
}

/**
 * Resolves 2D circle-vs-OBB (Oriented Bounding Box) solid collision with zero corner/wall penetration,
 * exact flat-wall sliding, and rounded corner deflection for rectangular buildings, containers & vehicles.
 */
export function resolveSolidObbCollision2D(
  moverX: number,
  moverZ: number,
  moverVx: number,
  moverVz: number,
  moverRadius: number,
  boxX: number,
  boxZ: number,
  halfX: number,
  halfZ: number,
  rotY = 0,
  restitution = 0.28,
): SolidCollisionResolution2D {
  const dx = moverX - boxX;
  const dz = moverZ - boxZ;
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);

  // Transform mover center into box local space
  const lx = dx * cosY - dz * sinY;
  const lz = dx * sinY + dz * cosY;

  // Closest point on local box [-halfX, +halfX] x [-halfZ, +halfZ]
  let cx = clamp(lx, -halfX, halfX);
  let cz = clamp(lz, -halfZ, halfZ);
  const dlx = lx - cx;
  const dlz = lz - cz;
  const distSq = dlx * dlx + dlz * dlz;

  if (distSq >= moverRadius * moverRadius) {
    return {
      collided: false,
      x: moverX,
      z: moverZ,
      vx: moverVx,
      vz: moverVz,
      impactSpeed: 0,
      contactX: moverX,
      contactZ: moverZ,
      normalX: 0,
      normalZ: 1,
    };
  }

  let nlx = 0;
  let nlz = 1;
  let pushedLx = lx;
  let pushedLz = lz;

  if (distSq > 1e-6) {
    const dist = Math.sqrt(distSq);
    nlx = dlx / dist;
    nlz = dlz / dist;
    pushedLx = cx + nlx * (moverRadius + 0.002);
    pushedLz = cz + nlz * (moverRadius + 0.002);
  } else {
    // Mover center penetrated inside the box — push out along the shallowest face axis
    const penX = halfX - Math.abs(lx);
    const penZ = halfZ - Math.abs(lz);
    if (penX < penZ) {
      nlx = lx >= 0 ? 1 : -1;
      nlz = 0;
      cx = nlx * halfX;
      cz = lz;
      pushedLx = nlx * (halfX + moverRadius + 0.002);
      pushedLz = lz;
    } else {
      nlx = 0;
      nlz = lz >= 0 ? 1 : -1;
      cx = lx;
      cz = nlz * halfZ;
      pushedLx = lx;
      pushedLz = nlz * (halfZ + moverRadius + 0.002);
    }
  }

  // Transform pushed position, contact point, and outward surface normal back to world space
  const pushedX = boxX + pushedLx * cosY + pushedLz * sinY;
  const pushedZ = boxZ - pushedLx * sinY + pushedLz * cosY;
  const contactX = boxX + cx * cosY + cz * sinY;
  const contactZ = boxZ - cx * sinY + cz * cosY;
  const nx = nlx * cosY + nlz * sinY;
  const nz = -nlx * sinY + nlz * cosY;

  const vDotN = moverVx * nx + moverVz * nz;
  const tangentX = -nz;
  const tangentZ = nx;
  const vDotT = moverVx * tangentX + moverVz * tangentZ;

  let nextVx = moverVx;
  let nextVz = moverVz;
  let impactSpeed = 0;

  if (vDotN < 0) {
    const approachingSpeed = -vDotN;
    impactSpeed = approachingSpeed + Math.abs(vDotT) * 0.2;
    const bouncedNormalVel = approachingSpeed * clamp(restitution, 0, 0.85);
    const slideFriction = 0.92;
    nextVx = tangentX * (vDotT * slideFriction) + nx * bouncedNormalVel;
    nextVz = tangentZ * (vDotT * slideFriction) + nz * bouncedNormalVel;
  } else {
    impactSpeed = Math.abs(vDotT) * 0.25;
  }

  return {
    collided: true,
    x: pushedX,
    z: pushedZ,
    vx: nextVx,
    vz: nextVz,
    impactSpeed,
    contactX,
    contactZ,
    normalX: nx,
    normalZ: nz,
  };
}

export interface PushableImpulseResolution2D {
  collided: boolean;
  moverX: number;
  moverZ: number;
  moverVx: number;
  moverVz: number;
  propX: number;
  propZ: number;
  propVx: number;
  propVz: number;
  angularImpulse: number;
  impactSpeed: number;
  contactX: number;
  contactZ: number;
}

/**
 * Resolves momentum transfer when a moving unit (Blitz Tank or running Buddy)
 * strikes a light pushable physics prop (wheelbarrow, barricade, cone, bin, crate).
 */
export function computePushableImpulse2D(
  moverX: number,
  moverZ: number,
  moverVx: number,
  moverVz: number,
  moverRadius: number,
  moverMass: number,
  propX: number,
  propZ: number,
  propVx: number,
  propVz: number,
  propRadius: number,
  propMass: number,
  restitution = 0.48,
): PushableImpulseResolution2D {
  const minDist = moverRadius + propRadius;
  const dx = propX - moverX;
  const dz = propZ - moverZ;
  const distSq = dx * dx + dz * dz;

  if (distSq >= minDist * minDist) {
    return {
      collided: false,
      moverX,
      moverZ,
      moverVx,
      moverVz,
      propX,
      propZ,
      propVx,
      propVz,
      angularImpulse: 0,
      impactSpeed: 0,
      contactX: propX,
      contactZ: propZ,
    };
  }

  const dist = Math.sqrt(distSq);
  // Outward normal pointing from mover -> prop
  const nx = dist > 1e-5 ? dx / dist : 0;
  const nz = dist > 1e-5 ? dz / dist : 1;
  const overlap = minDist - dist + 0.004;

  const totalMass = Math.max(0.1, moverMass + propMass);
  const moverShare = clamp(propMass / totalMass, 0.05, 0.5);
  const propShare = 1 - moverShare;

  const nextMoverX = moverX - nx * overlap * moverShare;
  const nextMoverZ = moverZ - nz * overlap * moverShare;
  const nextPropX = propX + nx * overlap * propShare;
  const nextPropZ = propZ + nz * overlap * propShare;

  const relVx = moverVx - propVx;
  const relVz = moverVz - propVz;
  const closingSpeed = relVx * nx + relVz * nz;

  if (closingSpeed <= 0) {
    const pushKick = Math.max(1.8, Math.hypot(moverVx, moverVz) * 0.65);
    return {
      collided: true,
      moverX: nextMoverX,
      moverZ: nextMoverZ,
      moverVx,
      moverVz,
      propX: nextPropX,
      propZ: nextPropZ,
      propVx: propVx + nx * pushKick,
      propVz: propVz + nz * pushKick,
      angularImpulse: pushKick * 0.6,
      impactSpeed: pushKick,
      contactX: moverX + nx * moverRadius,
      contactZ: moverZ + nz * moverRadius,
    };
  }

  const e = clamp(restitution, 0.1, 0.9);
  const impulseMag = ((1 + e) * closingSpeed) / (1 / Math.max(0.1, moverMass) + 1 / Math.max(0.1, propMass));

  // Add a lively knockback boost so light props visibly fly/tumble when hit
  const knockBoost = moverMass >= 8 ? 1.45 : 1.2;
  const nextPropVx = propVx + (impulseMag / Math.max(0.1, propMass)) * nx * knockBoost;
  const nextPropVz = propVz + (impulseMag / Math.max(0.1, propMass)) * nz * knockBoost;

  const nextMoverVx = moverVx - (impulseMag / Math.max(0.1, moverMass)) * nx * 0.45;
  const nextMoverVz = moverVz - (impulseMag / Math.max(0.1, moverMass)) * nz * 0.45;

  // Compute off-center torque for rotational spin on impact
  const tangentX = -nz;
  const tangentZ = nx;
  const tangentialVel = relVx * tangentX + relVz * tangentZ;
  const angularImpulse = clamp(tangentialVel * 0.55 + closingSpeed * 0.45, -14, 14);

  return {
    collided: true,
    moverX: nextMoverX,
    moverZ: nextMoverZ,
    moverVx: nextMoverVx,
    moverVz: nextMoverVz,
    propX: nextPropX,
    propZ: nextPropZ,
    propVx: nextPropVx,
    propVz: nextPropVz,
    angularImpulse,
    impactSpeed: closingSpeed,
    contactX: moverX + nx * moverRadius,
    contactZ: moverZ + nz * moverRadius,
  };
}

/**
 * Checks whether a breakable prop (wooden crate, barricade, concrete fence, explosive barrel)
 * should shatter into 3D debris chunks upon high-speed tank ramming or weapon damage.
 */
export function shouldShatterBreakableProp(
  kind: string,
  impactSpeed: number,
  isVehicleRam: boolean,
  remainingHp: number,
): boolean {
  if (remainingHp <= 0) return true;
  const spec = getPropCollisionSpec(kind, 1.0);
  if (!spec.destructible) return false;
  if (isVehicleRam && impactSpeed >= spec.ramBreakSpeed) {
    return true;
  }
  return false;
}

/**
 * Enforces an 80-120ms per-object cooldown during continuous collision contact
 * so impact audio and spark/dust particles never spam or clip.
 */
export function canTriggerCollisionCooldown(
  lastTriggerTimeSec: number | undefined,
  nowSec: number,
  cooldownSec = 0.1,
): boolean {
  if (lastTriggerTimeSec === undefined) return true;
  return nowSec - lastTriggerTimeSec >= cooldownSec;
}

/**
 * Determines whether a physical collision should play impact audio.
 * - On-foot characters (`isVehicle === false`) NEVER play impact sounds when colliding with hard, large,
 *   immovable objects (`isSmallPushable === false`: static buildings, fences, containers, trees, solid props, vehicles, or trams).
 * - On-foot characters ONLY play collision sounds when pushing/sliding small movable objects (`isSmallPushable === true`,
 *   such as pushable props like cones/bins/wheelbarrows/barrels/barricades or grounded crates).
 * - Driven vehicles (`isVehicle === true`) play impact sounds on both solid structures and pushable props.
 */
export function shouldPlayMoverCollisionSound(
  isVehicle: boolean,
  isSmallPushable: boolean,
  isPlayerControlled: boolean,
  impactSpeed: number,
  minImpactSpeed = 0.75,
): boolean {
  if (!isPlayerControlled) return false;
  if (impactSpeed <= minImpactSpeed) return false;
  if (!isVehicle && !isSmallPushable) return false;
  return true;
}

/**
 * Computes pitch playbackRate (0.90 - 1.15) and normalized volume (0.18 - 1.0)
 * proportional to physical collision speed.
 */
export function computeCollisionAudioParams(
  impactSpeed: number,
  jitterSeed = 0.5,
): { volume: number; playbackRate: number } {
  const speedRatio = clamp((impactSpeed - 0.5) / 14.0, 0, 1);
  const volume = clamp(0.22 + speedRatio * 0.78, 0.2, 1.0);
  const jitter = (clamp(jitterSeed, 0, 1) - 0.5) * 0.08;
  const playbackRate = clamp(0.9 + speedRatio * 0.21 + jitter, 0.9, 1.15);
  return { volume, playbackRate };
}

// ============================================================================
// BLITZ 5-LAYER CEL-SHADED EXPLOSION VFX & MULTI-STAGE DETONATION MATH
// ============================================================================

export interface BlitzFireballVisualState {
  colorHex: string;
  radiusScale: number;
  opacity: number;
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * clamp(t, 0, 1));
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => clamp(n, 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Evaluates Layer (a) Core Fireball & Flash:
 * - Rapidly expands in the first 0.15s (or first 35% of life)
 * - Smoothly transitions color from incandescent white-yellow (#fff7c2)
 *   -> bright orange (#ff7b00) -> deep crimson red (#d92b2b).
 */
export function evaluateBlitzFireballState(
  elapsedSec: number,
  maxLifeSec = 0.42,
  baseScale = 1.0,
): BlitzFireballVisualState {
  const progress = clamp(elapsedSec / Math.max(0.05, maxLifeSec), 0, 1);
  // Rapid expansion during the first 0.15s
  const expandT = clamp(elapsedSec / 0.15, 0, 1);
  const easeOut = 1 - Math.pow(1 - expandT, 3);
  const shrinkTail = progress > 0.68 ? 1 - ((progress - 0.68) / 0.32) * 0.45 : 1.0;
  const radiusScale = Math.max(0.05, baseScale * (0.28 + easeOut * 1.42) * shrinkTail);

  // Color ramp: #fff7c2 (255, 247, 194) -> #ff7b00 (255, 123, 0) -> #d92b2b (217, 43, 43)
  let r = 255;
  let g = 247;
  let b = 194;
  if (progress < 0.42) {
    const t = progress / 0.42;
    r = lerpChannel(255, 255, t);
    g = lerpChannel(247, 123, t);
    b = lerpChannel(194, 0, t);
  } else {
    const t = (progress - 0.42) / 0.58;
    r = lerpChannel(255, 217, t);
    g = lerpChannel(123, 43, t);
    b = lerpChannel(0, 43, t);
  }

  const opacity =
    progress >= 1 ? 0 : progress < 0.55 ? 1.0 : clamp(1 - (progress - 0.55) / 0.45, 0, 1);
  return {
    colorHex: rgbToHex(r, g, b),
    radiusScale,
    opacity,
  };
}

export interface BlitzSmokePuffVisualState {
  colorHex: string;
  scaleMultiplier: number;
  opacity: number;
}

/**
 * Evaluates Layer (b) Billowing Toon Smoke Puffs:
 * - Expands as it billows upward
 * - Transitions color from fiery orange (#ff7b00) -> warm charcoal (#635652) -> dark slate gray (#3a3f4d)
 * - Fades/dissolves cleanly in the final 30% of its lifetime.
 */
export function evaluateBlitzSmokePuffState(progress01: number): BlitzSmokePuffVisualState {
  const p = clamp(progress01, 0, 1);
  let r = 255;
  let g = 123;
  let b = 0;
  if (p < 0.28) {
    const t = p / 0.28;
    // #ff7b00 (255,123,0) -> #5e5558 (94,85,88)
    r = lerpChannel(255, 94, t);
    g = lerpChannel(123, 85, t);
    b = lerpChannel(0, 88, t);
  } else {
    const t = (p - 0.28) / 0.72;
    // #5e5558 (94,85,88) -> #3a3f4d (58,63,77)
    r = lerpChannel(94, 58, t);
    g = lerpChannel(85, 63, t);
    b = lerpChannel(88, 77, t);
  }

  const grow = p < 0.72 ? 0.45 + (p / 0.72) * 1.15 : 1.6 - ((p - 0.72) / 0.28) * 1.25;
  const opacity = p >= 1 ? 0 : p < 0.65 ? 0.96 : clamp(0.96 * (1 - (p - 0.65) / 0.35), 0, 1);
  return {
    colorHex: rgbToHex(r, g, b),
    scaleMultiplier: Math.max(0.05, grow),
    opacity,
  };
}

/**
 * Generates a deterministic schedule of multi-stage sequential explosions
 * when a vehicle (Blitz Tank / Blitz Plane) or Base HQ reaches 0 HP.
 */
export function computeMultiStageExplosionSchedule(
  stages = 4,
  spreadRadius = 2.6,
): Array<{ delaySec: number; offsetX: number; offsetY: number; offsetZ: number; scale: number }> {
  const count = clamp(Math.round(stages), 2, 8);
  const result: Array<{ delaySec: number; offsetX: number; offsetY: number; offsetZ: number; scale: number }> = [];
  for (let i = 0; i < count; i++) {
    if (i === 0) {
      result.push({ delaySec: 0, offsetX: 0, offsetY: 0.4, offsetZ: 0, scale: 1.15 });
    } else if (i === count - 1) {
      // Final climax detonation
      result.push({
        delaySec: i * 0.16,
        offsetX: 0,
        offsetY: 0.75,
        offsetZ: 0,
        scale: 1.55,
      });
    } else {
      const angle = (i / (count - 1)) * Math.PI * 2 + 0.55;
      const r = spreadRadius * (0.55 + (i % 2) * 0.35);
      result.push({
        delaySec: i * 0.15,
        offsetX: Math.cos(angle) * r,
        offsetY: 0.35 + (i % 2) * 0.4,
        offsetZ: Math.sin(angle) * r,
        scale: 0.92 + (i % 2) * 0.25,
      });
    }
  }
  return result;
}

// ============================================================================
// DRIVABLE DUMP TRUCK: CONCRETE PIPE REMOVAL, 4-CRATE CARGO & HYDRAULIC LIFT
// ============================================================================

export const DUMP_TRUCK_MAX_CRATES = 4;
export const DUMP_TRUCK_HYDRAULIC_CYCLE_SEC = 1.45;
export const DUMP_TRUCK_MAX_TILT_RAD = 0.76; // ~43.5 degrees rear-hinged hydraulic dump angle

export type DumpTruckIslandRole =
  | 'pipe_remove'
  | 'vessel'
  | 'tailgate'
  | 'wheel_fl'
  | 'wheel_fr'
  | 'wheel_rl'
  | 'wheel_rr'
  | 'chassis';

/**
 * Classifies connected triangle islands in DumpTruck.REF (dump-truck.glb):
 * - 'pipe_remove': The 3 cylindrical concrete pipes sitting inside the cargo bed (tris=280, Z[1.01..3.30])
 * - 'tailgate': Rear swinging tailgate door of the dump vessel (Z <= 0.25, Y >= -0.12)
 * - 'vessel': Black rear-hinged cargo dump vessel body & side ribs (minY >= -1.05, maxZ <= 4.30)
 * - 'wheel_fl' / 'wheel_fr' / 'wheel_rl' / 'wheel_rr': The 4 wheels + lug nuts so they spin while driving
 * - 'chassis': Cab, frame rails, fenders, exhaust stack, bumper, lights, and mirrors
 */
export function classifyDumpTruckMeshIsland(
  triCount: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  minZ: number,
  maxZ: number,
): DumpTruckIslandRole {
  // 1. Concrete pipes inside the black vessel (3 islands of 280 triangles each inside X[-0.75..0.75], Z[0.95..3.40])
  if (
    triCount >= 240 &&
    triCount <= 320 &&
    minX > -0.82 &&
    maxX < 0.82 &&
    minZ > 0.85 &&
    maxZ < 3.55 &&
    maxY > 0.2
  ) {
    return 'pipe_remove';
  }

  // 2. 4 Main Wheel Tires (tris=1004, Y[-2.04..-0.82]) + Wheel Lug Nuts (tris=20, Y[-1.70..-1.15], |X| > 1.20)
  const isMainWheel = triCount >= 900 && minY < -1.8 && maxY < -0.7;
  const isWheelLugNut =
    triCount === 20 && minY >= -1.72 && maxY <= -1.12 && (minX > 1.18 || maxX < -1.18);
  if (isMainWheel || isWheelLugNut) {
    const centerX = (minX + maxX) * 0.5;
    const centerZ = (minZ + maxZ) * 0.5;
    if (centerZ > 3.0) {
      return centerX >= 0 ? 'wheel_fl' : 'wheel_fr';
    }
    return centerX >= 0 ? 'wheel_rl' : 'wheel_rr';
  }

  // 3. Cab-mounted vertical exhaust stack & heat shield on right behind cab (stays on chassis)
  if (minZ > 3.5 && maxX < -0.6) {
    return 'chassis';
  }

  // 4. Rear Tailgate door & latches at Z[-0.10..0.25], Y >= -0.12
  if (minY >= -0.12 && maxZ <= 0.25 && minX >= -1.18 && maxX <= 1.18) {
    return 'tailgate';
  }

  // 5. Main Hydraulic Dump Vessel (Bak Truk) + Side Wall Ribs
  if (minY >= -1.05 && maxZ <= 4.3) {
    return 'vessel';
  }

  return 'chassis';
}

/**
 * Checks if the Dump Truck can accept another crate into its cargo vessel (max 4 crates).
 * Crates are NEVER auto-filled when driving the truck (`isCharacterManualLoad = false`);
 * the character must load crates into the truck one-by-one (`isCharacterManualLoad = true`).
 */
export function canLoadCrateIntoDumpTruck(
  storedCratesCount: number,
  isDumping: boolean,
  isCharacterManualLoad = true,
): boolean {
  if (!isCharacterManualLoad) return false;
  if (isDumping) return false;
  return storedCratesCount >= 0 && storedCratesCount < DUMP_TRUCK_MAX_CRATES;
}

export interface DumpTruckHydraulicState {
  phase: 'idle' | 'lifting' | 'dumping' | 'lowering';
  liftRatio: number;
  vesselTiltRad: number;
  tailgateOpenRad: number;
  pistonExtension: number;
  crateSlideOffsetZ: number;
  shouldReleaseCrates: boolean;
  finished: boolean;
}

/**
 * Evaluates the Dump Truck hydraulic vessel lifting & unloading animation cycle:
 * - 0.00..0.40: 'lifting' (hydraulic piston extends, vessel tilts 0° -> 43.5°, tailgate swings open)
 * - 0.40..0.62: 'dumping' (holds peak tilt with subtle hydraulic shudder; triggers crate release at t >= 0.44)
 * - 0.62..1.00: 'lowering' (hydraulic cylinder retracts smoothly back to 0°)
 */
export function evaluateDumpTruckHydraulicCycle(
  elapsedSec: number,
  cycleDurationSec = DUMP_TRUCK_HYDRAULIC_CYCLE_SEC,
): DumpTruckHydraulicState {
  if (elapsedSec <= 0) {
    return {
      phase: 'idle',
      liftRatio: 0,
      vesselTiltRad: 0,
      tailgateOpenRad: 0,
      pistonExtension: 0,
      crateSlideOffsetZ: 0,
      shouldReleaseCrates: false,
      finished: false,
    };
  }

  const dur = Math.max(0.4, cycleDurationSec);
  const p = clamp(elapsedSec / dur, 0, 1);

  if (p >= 1) {
    return {
      phase: 'idle',
      liftRatio: 0,
      vesselTiltRad: 0,
      tailgateOpenRad: 0,
      pistonExtension: 0,
      crateSlideOffsetZ: 0,
      shouldReleaseCrates: true,
      finished: true,
    };
  }

  let phase: DumpTruckHydraulicState['phase'] = 'lifting';
  let liftRatio = 0;

  if (p < 0.4) {
    phase = 'lifting';
    const u = p / 0.4;
    // Smoothstep ease-in-out hydraulic lift
    liftRatio = u * u * (3 - 2 * u);
  } else if (p < 0.62) {
    phase = 'dumping';
    const dumpU = (p - 0.4) / 0.22;
    // Peak hydraulic hold with subtle mechanical shake at top of stroke
    liftRatio = clamp(1.0 + Math.sin(dumpU * Math.PI * 3) * 0.025, 0, 1.03);
  } else {
    phase = 'lowering';
    const downU = (p - 0.62) / 0.38;
    const easeDown = downU * downU * (3 - 2 * downU);
    liftRatio = Math.max(0, 1 - easeDown);
  }

  const vesselTiltRad = liftRatio * DUMP_TRUCK_MAX_TILT_RAD;
  const tailgateOpenRad =
    liftRatio > 0.15 ? clamp((liftRatio - 0.15) / 0.85, 0, 1) * 0.92 : 0;
  const pistonExtension = clamp(liftRatio, 0, 1.03) * 1.85;
  const crateSlideOffsetZ =
    p < 0.18 ? 0 : -clamp((p - 0.18) / 0.32, 0, 1) * 2.15;
  const shouldReleaseCrates = p >= 0.44;

  return {
    phase,
    liftRatio: clamp(liftRatio, 0, 1),
    vesselTiltRad,
    tailgateOpenRad,
    pistonExtension,
    crateSlideOffsetZ,
    shouldReleaseCrates,
    finished: false,
  };
}

export interface DumpTruckPhysicsState {
  forwardSpeed: number;
  steerAngle: number;
  hullYaw: number;
}

export interface DumpTruckPhysicsInput {
  throttle: number;
  steer: number;
  boost: boolean;
  onRoad?: boolean;
}

export interface DumpTruckPhysicsStepResult {
  forwardSpeed: number;
  steerAngle: number;
  hullYaw: number;
  vx: number;
  vz: number;
  yawRate: number;
  bodyPitchRad: number;
  bodyRollRad: number;
}

/**
 * Steps authentic wheeled Dump Truck physics (Ackermann / kinematic bicycle front-wheel steering):
 * - Unlike a tracked tank, the truck CANNOT pivot-spin in place when stationary (yawRate = 0 when |forwardSpeed| < 0.12).
 * - Top speed & initial diesel acceleration boosted by +35% globally, plus +20% Road Speed Boost when `input.onRoad` is true.
 * - Steering knuckle turn rate (`steerRate = 5.4 rad/s`, `MAX_STEER_RAD = 0.58 rad`, agile `2.82m` wheelbase) is accelerated
 *   so the truck maneuvers crisply on roads without feeling stiff.
 */
export function stepDumpTruckWheeledPhysics(
  state: DumpTruckPhysicsState,
  input: DumpTruckPhysicsInput,
  dt: number,
): DumpTruckPhysicsStepResult {
  const safeDt = clamp(dt, 0, 0.1);
  const throttle = clamp(input.throttle, -1, 1);
  const steer = clamp(input.steer, -1, 1);
  const roadMult = input.onRoad ? 1.2 : 1.0;
  const vehicleBoostFactor = 1.35; // +35% global vehicle top speed & initial acceleration

  // 1. Front-wheel steering knuckle angle (faster turn rate & wider angle for agile highway maneuvering)
  const MAX_STEER_RAD = 0.58;
  const speedRatio = clamp(Math.abs(state.forwardSpeed) / (18.5 * vehicleBoostFactor), 0, 1);
  const maxSteerAtSpeed = MAX_STEER_RAD * (1.0 - 0.14 * speedRatio);
  const targetSteer = steer * maxSteerAtSpeed;

  let nextSteerAngle = state.steerAngle;
  if (Math.abs(steer) > 0.01) {
    const steerRate = 5.4;
    const diff = targetSteer - nextSteerAngle;
    const maxStep = steerRate * safeDt;
    nextSteerAngle += clamp(diff, -maxStep, maxStep);
  } else {
    // Self-centering caster return (faster when rolling)
    const returnRate = 6.0 + Math.abs(state.forwardSpeed) * 0.32;
    const maxStep = returnRate * safeDt;
    if (Math.abs(nextSteerAngle) <= maxStep) {
      nextSteerAngle = 0;
    } else {
      nextSteerAngle -= Math.sign(nextSteerAngle) * maxStep;
    }
  }
  nextSteerAngle = clamp(nextSteerAngle, -MAX_STEER_RAD, MAX_STEER_RAD);

  // 2. Longitudinal acceleration (+35% base, +20% on road), coasting rolling resistance, air-braking & reverse gear
  const maxForwardSpeed = Number(
    ((input.boost ? 18.5 : 14.2) * vehicleBoostFactor * roadMult).toFixed(4),
  );
  const maxReverseSpeed = Number((-7.6 * vehicleBoostFactor * roadMult).toFixed(4));
  let nextForwardSpeed = state.forwardSpeed;
  let accelLon = 0;

  if (throttle > 0.01) {
    if (nextForwardSpeed < -0.15) {
      // Braking while rolling backward
      accelLon = 28.0 * vehicleBoostFactor;
    } else {
      // Forward diesel torque acceleration (+35% base, +20% on road)
      accelLon = (input.boost ? 21.5 : 15.8) * vehicleBoostFactor * roadMult * throttle;
    }
    nextForwardSpeed = Math.min(maxForwardSpeed, nextForwardSpeed + accelLon * safeDt);
  } else if (throttle < -0.01) {
    if (nextForwardSpeed > 0.15) {
      // Air-braking while rolling forward
      accelLon = -28.0 * vehicleBoostFactor;
    } else {
      // Reverse gear acceleration (+35% base, +20% on road)
      accelLon = 11.8 * vehicleBoostFactor * roadMult * throttle;
    }
    nextForwardSpeed = Math.max(maxReverseSpeed, nextForwardSpeed + accelLon * safeDt);
  } else {
    // Smooth rubber-tire coasting (rolling resistance)
    const coastDecel = 5.2;
    const drop = coastDecel * safeDt;
    if (Math.abs(nextForwardSpeed) <= drop) {
      accelLon = -nextForwardSpeed / Math.max(0.001, safeDt);
      nextForwardSpeed = 0;
    } else {
      accelLon = -Math.sign(nextForwardSpeed) * coastDecel;
      nextForwardSpeed -= Math.sign(nextForwardSpeed) * drop;
    }
  }

  // If speed exceeds normal cap after releasing boost or leaving road, bleed back gently
  if (nextForwardSpeed > maxForwardSpeed) {
    nextForwardSpeed = Math.max(maxForwardSpeed, nextForwardSpeed - 12.8 * safeDt);
  }

  // 3. Ackermann / Kinematic Bicycle yaw rate: strictly zero when stationary!
  const WHEELBASE_METERS = 2.82;
  const isRolling = Math.abs(nextForwardSpeed) >= 0.12;
  const yawRate = isRolling
    ? (nextForwardSpeed / WHEELBASE_METERS) * Math.tan(nextSteerAngle)
    : 0;

  const nextHullYaw = state.hullYaw + yawRate * safeDt;
  const vx = Math.cos(nextHullYaw) * nextForwardSpeed;
  const vz = -Math.sin(nextHullYaw) * nextForwardSpeed;

  // 4. Suspension squat/nose-dive pitch & cornering body roll
  const bodyPitchRad = clamp(-accelLon * 0.0018, -0.045, 0.055);
  const bodyRollRad = clamp(yawRate * nextForwardSpeed * 0.0038, -0.065, 0.065);

  return {
    forwardSpeed: nextForwardSpeed,
    steerAngle: nextSteerAngle,
    hullYaw: nextHullYaw,
    vx,
    vz,
    yawRate,
    bodyPitchRad,
    bodyRollRad,
  };
}

/**
 * Pure kinematics evaluator for the Military Base Perimeter Checkpoint Boom Barrier.
 * Opens upward to 90° (Math.PI / 2) when any friendly/active unit (Player, Buddy, Dump Truck, or Tank)
 * is within `triggerRadiusMeters` (default 8.0m) of the gate center, and lowers smoothly to 0° when clear.
 */
export function stepMilitaryBaseBoomBarrier(
  currentAngleRad: number,
  minDistanceToGateMeters: number,
  dt: number,
  triggerRadiusMeters = 8.0,
  maxOpenAngleRad = Math.PI * 0.5,
): { angleRad: number; isOpen: boolean } {
  const safeDt = Math.max(0, Math.min(0.1, dt));
  const isOpen = minDistanceToGateMeters < triggerRadiusMeters;
  const targetAngle = isOpen ? maxOpenAngleRad : 0;
  const speedRate = isOpen ? 5.8 : 3.6;
  const blend = 1 - Math.exp(-speedRate * safeDt);
  const nextAngle = Math.max(
    0,
    Math.min(maxOpenAngleRad, currentAngleRad + (targetAngle - currentAngleRad) * blend),
  );
  return {
    angleRad: Math.abs(targetAngle - nextAngle) < 0.002 ? targetAngle : nextAngle,
    isOpen,
  };
}

// ============================================================================
// TEAM BUDDIES CHARACTER JUMP PHYSICS, UNARMED PUNCH COMBO & FRONT KICK
// ============================================================================

export const JUMP_BUFFER_DURATION_SEC = 0.1;

export interface BuddyJumpPhysicsState {
  jumpOffset: number;
  vy: number;
  isGrounded: boolean;
  justJumped: boolean;
  justLanded: boolean;
  jumpBufferTimer?: number;
}

export interface BuddyBufferedJumpPhysicsState extends BuddyJumpPhysicsState {
  jumpBufferTimer: number;
}

/**
 * Pure vertical jump & gravity kinematics for Team Buddies on-foot characters:
 * - Launches upward from ground (`isGrounded === true`) when `jumpRequested` is true.
 * - Scales initial vertical impulse by `jumpMultiplier` (e.g. Ninja 1.4x, Tankie 0.85x)
 *   and applies a slight 0.86x load factor when carrying a crate overhead.
 * - Integrates gravity (`26.0 m/s²`) and detects ground touchdown (`justLanded`).
 */
export function stepBuddyJumpPhysics(
  jumpOffset: number,
  vy: number,
  isGrounded: boolean,
  jumpRequested: boolean,
  jumpMultiplier = 1.0,
  carryingCrate = false,
  dt: number,
): BuddyJumpPhysicsState {
  const safeDt = clamp(dt, 0, 0.1);
  const GRAVITY = 26.0;
  const BASE_JUMP_VY = 9.6;

  let nextOffset = Math.max(0, jumpOffset);
  let nextVy = vy;
  let nextGrounded = isGrounded;
  let justJumped = false;
  let justLanded = false;

  if (jumpRequested && nextGrounded && nextOffset <= 0.02) {
    const crateFactor = carryingCrate ? 0.86 : 1.0;
    nextVy = BASE_JUMP_VY * clamp(jumpMultiplier, 0.5, 2.0) * crateFactor;
    nextGrounded = false;
    justJumped = true;
  }

  if (safeDt > 0 && (!nextGrounded || nextOffset > 0 || nextVy > 0)) {
    nextOffset += nextVy * safeDt;
    nextVy -= GRAVITY * safeDt;
    if (nextOffset <= 0) {
      nextOffset = 0;
      nextVy = 0;
      if (!nextGrounded) {
        justLanded = true;
      }
      nextGrounded = true;
    } else {
      nextGrounded = false;
    }
  }

  return {
    jumpOffset: nextOffset,
    vy: nextVy,
    isGrounded: nextGrounded,
    justJumped,
    justLanded,
  };
}

/**
 * Jump input buffer + vertical jump kinematics:
 * - When the player presses jump (`jumpPressedThisFrame === true`), sets `jumpBufferTimer` to `0.1` s.
 * - Counts `jumpBufferTimer` down every frame (`Math.max(0, timer - dt)`).
 * - Fires the jump on the first frame the player is grounded while `jumpBufferTimer > 0`,
 *   and immediately resets `jumpBufferTimer = 0` so one press gives one jump.
 */
export function stepBuddyJumpPhysicsWithBuffer(
  jumpOffset: number,
  vy: number,
  isGrounded: boolean,
  jumpBufferTimer: number,
  jumpPressedThisFrame: boolean,
  jumpMultiplier = 1.0,
  carryingCrate = false,
  dt: number,
): BuddyBufferedJumpPhysicsState {
  const safeDt = clamp(dt, 0, 0.1);
  const GRAVITY = 26.0;
  const BASE_JUMP_VY = 9.6;
  const crateFactor = carryingCrate ? 0.86 : 1.0;
  const launchVy = BASE_JUMP_VY * clamp(jumpMultiplier, 0.5, 2.0) * crateFactor;

  let nextTimer = jumpPressedThisFrame
    ? JUMP_BUFFER_DURATION_SEC
    : Math.max(0, jumpBufferTimer - safeDt);

  let nextOffset = Math.max(0, jumpOffset);
  let nextVy = vy;
  let nextGrounded = isGrounded && nextOffset <= 0.02;
  let justJumped = false;
  let justLanded = false;

  // 1. If already grounded at the start of the frame while buffer timer > 0, fire jump immediately & reset timer to 0
  if (nextGrounded && nextTimer > 0) {
    nextVy = launchVy;
    nextGrounded = false;
    justJumped = true;
    nextTimer = 0;
  }

  // 2. Step vertical kinematics & gravity
  if (safeDt > 0 && (!nextGrounded || nextOffset > 0 || nextVy > 0)) {
    nextOffset += nextVy * safeDt;
    nextVy -= GRAVITY * safeDt;
    if (nextOffset <= 0) {
      nextOffset = 0;
      nextVy = 0;
      if (!nextGrounded) {
        justLanded = true;
      }
      nextGrounded = true;
    } else {
      nextGrounded = false;
    }
  }

  // 3. If the player just landed on this frame while buffer timer is still > 0, fire the buffered jump & reset timer to 0
  if (nextGrounded && !justJumped && nextTimer > 0) {
    nextVy = launchVy;
    nextGrounded = false;
    justJumped = true;
    nextTimer = 0;
  }

  return {
    jumpOffset: nextOffset,
    vy: nextVy,
    isGrounded: nextGrounded,
    justJumped,
    justLanded,
    jumpBufferTimer: nextTimer,
  };
}

// ============================================================================
// PLAYER INVINCIBILITY FRAMES (I-FRAMES), 10 HZ BLINK & DAMAGE KNOCKBACK
// ============================================================================

export const PLAYER_INVINCIBILITY_DURATION_SEC = 0.75;
export const PLAYER_INVINCIBILITY_BLINK_HZ = 10;
export const PLAYER_DAMAGE_KNOCKBACK_SPEED = 9.5;

export interface PlayerInvincibilityFrameState {
  invincibilityTimer: number;
  isInvincible: boolean;
  spriteVisible: boolean;
}

/**
 * Counts down the player's invincibility timer and computes the 10 Hz on/off blink visibility.
 * When `invincibilityTimer <= 0`, `spriteVisible` is always `true`.
 */
export function stepPlayerInvincibilityState(
  invincibilityTimer: number,
  dt: number,
  blinkHz = PLAYER_INVINCIBILITY_BLINK_HZ,
): PlayerInvincibilityFrameState {
  const safeDt = Math.max(0, dt);
  const nextTimer = Math.max(0, invincibilityTimer - safeDt);
  if (nextTimer <= 0) {
    return {
      invincibilityTimer: 0,
      isInvincible: false,
      spriteVisible: true,
    };
  }
  const halfCycleIndex = Math.floor(nextTimer * Math.max(1, blinkHz) * 2);
  const spriteVisible = halfCycleIndex % 2 === 0;
  return {
    invincibilityTimer: nextTimer,
    isInvincible: true,
    spriteVisible,
  };
}

export interface PlayerDamageWithInvincibilityInput {
  hp: number;
  invincibilityTimer: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  vy: number;
  damage: number;
  sourceX: number;
  sourceZ: number;
  facingYaw?: number;
  invincibilityDurationSec?: number;
  knockbackSpeed?: number;
}

export interface PlayerDamageWithInvincibilityResult {
  damageApplied: boolean;
  hp: number;
  invincibilityTimer: number;
  vx: number;
  vz: number;
  vy: number;
  knockbackDirX: number;
  knockbackDirZ: number;
}

/**
 * Resolves player damage with invincibility frames (0.5s to 1.0s) and knockback impulse:
 * - While `invincibilityTimer > 0`, ignores all incoming damage (`damageApplied: false`).
 * - When taking damage, starts the invincibility window (`0.75s` by default, clamped to `[0.5, 1.0]`)
 *   and applies a horizontal knockback impulse pushing the player away from `(sourceX, sourceZ)`.
 */
export function applyPlayerDamageWithInvincibilityAndKnockback(
  input: PlayerDamageWithInvincibilityInput,
): PlayerDamageWithInvincibilityResult {
  if (input.invincibilityTimer > 0 || input.damage <= 0 || input.hp <= 0) {
    return {
      damageApplied: false,
      hp: input.hp,
      invincibilityTimer: Math.max(0, input.invincibilityTimer),
      vx: input.vx,
      vz: input.vz,
      vy: input.vy,
      knockbackDirX: 0,
      knockbackDirZ: 0,
    };
  }

  const nextHp = Math.max(0, input.hp - input.damage);
  const duration = clamp(
    input.invincibilityDurationSec ?? PLAYER_INVINCIBILITY_DURATION_SEC,
    0.5,
    1.0,
  );
  const kbSpeed = input.knockbackSpeed ?? PLAYER_DAMAGE_KNOCKBACK_SPEED;

  const dx = input.x - input.sourceX;
  const dz = input.z - input.sourceZ;
  const dist = Math.hypot(dx, dz);
  const fallbackYaw = input.facingYaw ?? 0;
  const knockbackDirX = dist > 1e-4 ? dx / dist : -Math.sin(fallbackYaw);
  const knockbackDirZ = dist > 1e-4 ? dz / dist : -Math.cos(fallbackYaw);

  return {
    damageApplied: true,
    hp: nextHp,
    invincibilityTimer: duration,
    vx: input.vx + knockbackDirX * kbSpeed,
    vz: input.vz + knockbackDirZ * kbSpeed,
    vy: Math.max(input.vy, 3.8),
    knockbackDirX,
    knockbackDirZ,
  };
}

export interface BuddyMeleeStrikeResult {
  hit: boolean;
  distance: number;
  forwardDot: number;
  damage: number;
  knockbackVx: number;
  knockbackVz: number;
  upwardHopVy: number;
}

/**
 * Evaluates a Team Buddies Unarmed Fist Punch (`'punch'`) or Heavy Boot Kick (`'kick'`)
 * from `(attackerX, attackerZ)` facing `attackerYaw` against a target at `(targetX, targetZ)`:
 * - `'punch'`: fast alternating left/right jab-hook (`reach = 2.55m`, forward cone `dot >= 0.15`,
 *   `damage = 8`, `knockbackSpeed = 7.8 m/s`).
 * - `'kick'`: heavy front boot punt (`reach = 2.95m`, wider cone `dot >= -0.05` so crates right at
 *   the character's feet are always punted cleanly, `damage = 14`, `knockbackSpeed = 16.5 m/s`,
 *   `upwardHopVy = 5.2 m/s`).
 */
export function evaluateBuddyMeleeStrike(
  attackerX: number,
  attackerZ: number,
  attackerYaw: number,
  targetX: number,
  targetZ: number,
  targetRadius = 0.65,
  kind: 'punch' | 'kick' = 'punch',
): BuddyMeleeStrikeResult {
  const dx = targetX - attackerX;
  const dz = targetZ - attackerZ;
  const dist = Math.hypot(dx, dz);

  const fwdX = Math.cos(attackerYaw);
  const fwdZ = -Math.sin(attackerYaw);
  const forwardDot = dist > 0.001 ? (dx * fwdX + dz * fwdZ) / dist : 1.0;

  const baseReach = kind === 'kick' ? 2.45 : 2.05;
  const maxReach = baseReach + Math.max(0, targetRadius);
  const minDot = kind === 'kick' ? -0.05 : 0.15;

  // If the target is almost directly overlapping the character's feet (< 0.95m), always allow hit
  const inCone = dist < 0.95 || forwardDot >= minDot;
  if (dist > maxReach || !inCone) {
    return {
      hit: false,
      distance: dist,
      forwardDot,
      damage: 0,
      knockbackVx: 0,
      knockbackVz: 0,
      upwardHopVy: 0,
    };
  }

  // Blend knockback direction mostly along character's facing direction (Team Buddies straight punt!)
  // with slight radial outward push so kicked crates fly cleanly where the character is facing.
  const radialX = dist > 0.05 ? dx / dist : fwdX;
  const radialZ = dist > 0.05 ? dz / dist : fwdZ;
  const blendFwd = kind === 'kick' ? 0.78 : 0.65;
  const rawDirX = fwdX * blendFwd + radialX * (1 - blendFwd);
  const rawDirZ = fwdZ * blendFwd + radialZ * (1 - blendFwd);
  const dirLen = Math.max(0.001, Math.hypot(rawDirX, rawDirZ));
  const dirX = rawDirX / dirLen;
  const dirZ = rawDirZ / dirLen;

  const knockbackSpeed = kind === 'kick' ? 16.5 : 7.8;
  const damage = kind === 'kick' ? 14 : 8;
  const upwardHopVy = kind === 'kick' ? 5.2 : 1.8;

  return {
    hit: true,
    distance: dist,
    forwardDot,
    damage,
    knockbackVx: dirX * knockbackSpeed,
    knockbackVz: dirZ * knockbackSpeed,
    upwardHopVy,
  };
}

// ============================================================================
// TEAM BUDDIES 4V4 ONLINE MATCHMAKING, PERSONAL SQUAD SWAP & SMART BUDDY AI
// ============================================================================

export const COMMANDERS_PER_TEAM = 4;
export const MAX_CHARACTERS_PER_COMMANDER = 4;
export const MIN_HUMANS_PER_TEAM_TO_START = 2;

export type CommanderControllerType = 'human' | 'ai';

export interface CommanderSlotState {
  commanderId: number; // 0..3 (P1..P4)
  team: 'blue' | 'red';
  controller: CommanderControllerType;
  callsign: string;
  padIndex: number; // 0..3 (Pad P1..P4)
  helipadIndex: number; // 0..3 (Helipad P1..P4)
  parkingBayIndex: number; // 0..3 (Bay P1..P4)
  joinedAtSec: number;
}

export interface Matchmaking4v4State {
  blueCommanders: CommanderSlotState[];
  redCommanders: CommanderSlotState[];
  minHumansPerTeamToStart: number;
  matchStarted: boolean;
}

/**
 * Checks whether a Commander (Player P1..P4) is allowed to build another character on their Stacking Pad.
 * Strictly capped at `MAX_CHARACTERS_PER_COMMANDER` (4 characters per player).
 */
export function canCommanderBuildCharacter(
  ownedAliveCount: number,
  maxPerCommander = MAX_CHARACTERS_PER_COMMANDER,
): boolean {
  return ownedAliveCount < maxPerCommander;
}

/**
 * Returns the next alive Buddy owned strictly by `(team, ownerCommanderId)` when the player presses `[Tab]`.
 * Players can ONLY swap among characters built/owned by themselves (`b.ownerCommanderId === ownerCommanderId`),
 * never hijacking characters owned by teammates (`P2..P4`).
 */
export function getNextOwnedBuddyForSwap<
  T extends { id: string; team: 'blue' | 'red'; ownerCommanderId: number; hp: number },
>(
  buddies: ReadonlyArray<T>,
  team: 'blue' | 'red',
  ownerCommanderId: number,
  currentBuddyId: string,
): T | null {
  const owned = buddies.filter(
    (b) => b.team === team && b.ownerCommanderId === ownerCommanderId && b.hp > 0,
  );
  if (owned.length === 0) return null;
  const currentIdx = owned.findIndex((b) => b.id === currentBuddyId);
  if (currentIdx === -1) return owned[0];
  return owned[(currentIdx + 1) % owned.length];
}

/**
 * Evaluates whether a 4v4 Online Matchmaking lobby has enough human players to start immediately:
 * - Minimum 2 human players per team (`4 human players total` across both teams).
 * - Remaining 2 slots per team are controlled by AI Commanders until human players hot-join.
 */
export function canStartMatchmaking4v4(
  blueHumanCount: number,
  redHumanCount: number,
  minPerTeam = MIN_HUMANS_PER_TEAM_TO_START,
): boolean {
  return (
    blueHumanCount >= minPerTeam &&
    redHumanCount >= minPerTeam &&
    blueHumanCount + redHumanCount >= minPerTeam * 2
  );
}

/**
 * Creates a 4v4 Online Matchmaking state with 4 Commander slots per team (`P1..P4`).
 * By default starts in fast-matchmaking mode with 2 Human + 2 AI per team (`4 Human + 4 AI = 8 Commanders`).
 */
export function createMatchmaking4v4State(
  initialBlueHumans = MIN_HUMANS_PER_TEAM_TO_START,
  initialRedHumans = MIN_HUMANS_PER_TEAM_TO_START,
): Matchmaking4v4State {
  const clampedBlue = clamp(Math.floor(initialBlueHumans), 0, COMMANDERS_PER_TEAM);
  const clampedRed = clamp(Math.floor(initialRedHumans), 0, COMMANDERS_PER_TEAM);

  const blueCommanders: CommanderSlotState[] = [];
  const redCommanders: CommanderSlotState[] = [];

  for (let i = 0; i < COMMANDERS_PER_TEAM; i++) {
    const isBlueHuman = i < clampedBlue;
    blueCommanders.push({
      commanderId: i,
      team: 'blue',
      controller: isBlueHuman ? 'human' : 'ai',
      callsign: isBlueHuman ? (i === 0 ? 'P1 (You)' : `P${i + 1} (Player)`) : `P${i + 1} [AI Bot]`,
      padIndex: i,
      helipadIndex: i,
      parkingBayIndex: i,
      joinedAtSec: 0,
    });

    const isRedHuman = i < clampedRed;
    redCommanders.push({
      commanderId: i,
      team: 'red',
      controller: isRedHuman ? 'human' : 'ai',
      callsign: isRedHuman ? `R${i + 1} (Player)` : `R${i + 1} [AI Bot]`,
      padIndex: i,
      helipadIndex: i,
      parkingBayIndex: i,
      joinedAtSec: 0,
    });
  }

  return {
    blueCommanders,
    redCommanders,
    minHumansPerTeamToStart: MIN_HUMANS_PER_TEAM_TO_START,
    matchStarted: canStartMatchmaking4v4(clampedBlue, clampedRed),
  };
}

/**
 * Hot-Join AI Replacement:
 * When a new human player joins an ongoing match, immediately replaces one of the active AI Commander slots
 * (`controller: 'ai' -> 'human'`), inheriting that slot's Stacking Pad (`Pad P_i`), Helipad (`Helipad P_i`),
 * Parking Bay (`Bay P_i`), and all characters/vehicles already built by that slot.
 */
export function hotJoinReplaceAiCommander(
  state: Matchmaking4v4State,
  preferredTeam?: 'blue' | 'red',
  nowSec = 0,
  customCallsign?: string,
): { updatedState: Matchmaking4v4State; replacedSlot: CommanderSlotState | null } {
  const nextBlue = state.blueCommanders.map((c) => ({ ...c }));
  const nextRed = state.redCommanders.map((c) => ({ ...c }));

  const blueAiIdx = nextBlue.findIndex((c) => c.controller === 'ai');
  const redAiIdx = nextRed.findIndex((c) => c.controller === 'ai');

  let targetTeam: 'blue' | 'red' | null = null;
  if (preferredTeam === 'blue' && blueAiIdx !== -1) {
    targetTeam = 'blue';
  } else if (preferredTeam === 'red' && redAiIdx !== -1) {
    targetTeam = 'red';
  } else if (blueAiIdx !== -1 && redAiIdx !== -1) {
    // Balance teams by replacing AI on whichever team currently has more AI slots (preferring Blue on tie)
    const blueAiCount = nextBlue.filter((c) => c.controller === 'ai').length;
    const redAiCount = nextRed.filter((c) => c.controller === 'ai').length;
    targetTeam = blueAiCount >= redAiCount ? 'blue' : 'red';
  } else if (blueAiIdx !== -1) {
    targetTeam = 'blue';
  } else if (redAiIdx !== -1) {
    targetTeam = 'red';
  }

  if (!targetTeam) {
    return {
      updatedState: {
        ...state,
        blueCommanders: nextBlue,
        redCommanders: nextRed,
      },
      replacedSlot: null,
    };
  }

  const list = targetTeam === 'blue' ? nextBlue : nextRed;
  const slotIdx = targetTeam === 'blue' ? blueAiIdx : redAiIdx;
  const slot = list[slotIdx];
  const prefix = targetTeam === 'blue' ? 'P' : 'R';
  slot.controller = 'human';
  slot.joinedAtSec = nowSec;
  slot.callsign = customCallsign ?? `${prefix}${slot.commanderId + 1} (Hot-Join)`;

  const blueHumans = nextBlue.filter((c) => c.controller === 'human').length;
  const redHumans = nextRed.filter((c) => c.controller === 'human').length;

  return {
    updatedState: {
      blueCommanders: nextBlue,
      redCommanders: nextRed,
      minHumansPerTeamToStart: state.minHumansPerTeamToStart,
      matchStarted: state.matchStarted || canStartMatchmaking4v4(blueHumans, redHumans),
    },
    replacedSlot: { ...slot },
  };
}

export type SmartBuddyAiAction =
  | 'DELIVER_TO_OWNER_PAD'
  | 'TRIGGER_OWNER_PAD_CRAFT'
  | 'HEAL_WOUNDED_ALLY'
  | 'EQUIP_GROUND_WEAPON'
  | 'MOUNT_VEHICLE'
  | 'HARVEST_CRATE'
  | 'ATTACK_ENEMY'
  | 'DEFEND_OWNER_PAD'
  | 'FOLLOW_COMMANDER';

export interface SmartBuddyAiInput {
  buddyClass: BuddyClassId;
  weaponId: 'unarmed' | 'pistol' | 'rifle' | 'rocket' | 'laser' | 'gatling';
  carryingCrate: boolean;
  hp: number;
  maxHp: number;
  commandMode: TeamCommandMode;
  ownerBuildOrder: BuildOrderTarget;
  ownerPadHasSpace: boolean;
  ownerPadReadyToCraft: boolean;
  ownerIsAiCommander: boolean;
  ownerAliveBuddyCount: number;
  ownerHasBuiltTurret: boolean;
  ownerHasBuiltVehicle: boolean;
  woundedAllyDist: number | null;
  nearestEnemyDist: number | null;
  nearestFreeCrateDist: number | null;
  nearestGroundWeaponDist: number | null;
  nearestEmptyVehicleDist: number | null;
  canUpgradeFromGroundWeapon?: boolean;
}

export interface SmartBuddyAiDecision {
  action: SmartBuddyAiAction;
  recommendedBuildOrder: BuildOrderTarget;
}

/**
 * Pure Utility AI Evaluator for Built Characters (`ownerCommanderId` 0..3):
 * 1. Computes strategic `recommendedBuildOrder` for AI Commanders:
 *    - If unarmed at start of match -> `'1x1x1'` (build a weapon first)
 *    - Else if squad has fewer than 3 buddies (`ownerAliveBuddyCount < 3`) -> `'1x1x2'` (build Buddy T1)
 *    - Else if base has unbuilt Skyshield turret -> `'2x1x1'` (build Skyshield / Bazooka)
 *    - Else if squad has fewer than 4 buddies (`MAX_CHARACTERS_PER_COMMANDER`) -> `'2x1x2'` (build Buddy T2)
 *    - Else if no vehicle yet -> `'2x2x2'` (build Tank / Fighter Plane) or `'2x2x1'` (Dump Truck)
 * 2. Selects highest-utility action for the character:
 *    - If carrying a crate and owner's Stacking Pad has space -> `'DELIVER_TO_OWNER_PAD'`
 *    - If AI Commander's pad recipe is complete -> `'TRIGGER_OWNER_PAD_CRAFT'`
 *    - If Medic and wounded ally is within 18m -> `'HEAL_WOUNDED_ALLY'`
 *    - If unarmed OR holding a lower-tier weapon (`canUpgradeFromGroundWeapon`) and a ground weapon is nearby (`<= 24m`) -> `'EQUIP_GROUND_WEAPON'`
 *    - Respects `commandMode` (`MOUNT`, `DEFEND`, `ATTACK`, `HARVEST`, `FOLLOW`) with smart self-defense fallback.
 */
export function evaluateBuiltBuddySmartAiDecision(
  input: SmartBuddyAiInput,
): SmartBuddyAiDecision {
  // 1. Recommended Build Order progression for Zero-Prebuilt start
  let recommendedBuildOrder: BuildOrderTarget = input.ownerBuildOrder;
  if (input.ownerIsAiCommander || input.ownerBuildOrder === 'AUTO') {
    if (input.weaponId === 'unarmed' && input.ownerAliveBuddyCount <= 1) {
      recommendedBuildOrder = '1x1x1';
    } else if (input.ownerAliveBuddyCount < 3) {
      recommendedBuildOrder = '1x1x2';
    } else if (!input.ownerHasBuiltTurret) {
      recommendedBuildOrder = '2x1x1';
    } else if (input.ownerAliveBuddyCount < MAX_CHARACTERS_PER_COMMANDER) {
      recommendedBuildOrder = '2x1x2';
    } else if (!input.ownerHasBuiltVehicle) {
      recommendedBuildOrder = '2x2x2';
    } else {
      recommendedBuildOrder = '2x2x1';
    }
  }

  // 2. If carrying a crate (and not in FOLLOW escort mode), always deliver to owner's personal Stacking Pad (`Pad P_i`)
  if (input.carryingCrate && input.ownerPadHasSpace && input.commandMode !== 'FOLLOW') {
    return {
      action: 'DELIVER_TO_OWNER_PAD',
      recommendedBuildOrder,
    };
  }

  // 3. If owner's Stacking Pad has completed its target recipe, trigger craft!
  if (input.ownerPadReadyToCraft && input.ownerIsAiCommander) {
    return {
      action: 'TRIGGER_OWNER_PAD_CRAFT',
      recommendedBuildOrder,
    };
  }

  // 4. Medic class prioritizes healing wounded squadmates within 18m
  if (
    input.buddyClass === 'Medic' &&
    input.woundedAllyDist !== null &&
    input.woundedAllyDist <= 18.0
  ) {
    return {
      action: 'HEAL_WOUNDED_ALLY',
      recommendedBuildOrder,
    };
  }

  // 5. Team Buddies Auto-Loot (`Diambil Otomatis oleh AI Tim & Rentan Dicuri Lawan`):
  // Unarmed characters OR characters holding a lower-tier weapon automatically run to pick up a crafted/dropped weapon nearby!
  // For ATTACK role (`commandMode === 'ATTACK'`), an unarmed Attacker (`weaponId === 'unarmed'`) returns to base/field weapon stock at any distance!
  if (
    (input.weaponId === 'unarmed' || input.canUpgradeFromGroundWeapon) &&
    input.nearestGroundWeaponDist !== null &&
    (input.nearestGroundWeaponDist <= 24.0 ||
      (input.commandMode === 'ATTACK' && input.weaponId === 'unarmed'))
  ) {
    return {
      action: 'EQUIP_GROUND_WEAPON',
      recommendedBuildOrder,
    };
  }

  // 6. Immediate ranged engagement if armed (<= 22m) or close self-defense if unarmed (<= 11m)
  const selfDefenseEngageRadius = input.weaponId !== 'unarmed' ? 22.0 : 11.0;
  if (input.nearestEnemyDist !== null && input.nearestEnemyDist <= selfDefenseEngageRadius) {
    return {
      action: 'ATTACK_ENEMY',
      recommendedBuildOrder,
    };
  }

  // 7. Command-specific utility behavior
  if (
    input.commandMode === 'MOUNT' &&
    input.nearestEmptyVehicleDist !== null &&
    input.nearestEmptyVehicleDist <= 38.0
  ) {
    return {
      action: 'MOUNT_VEHICLE',
      recommendedBuildOrder,
    };
  }

  if (input.commandMode === 'DEFEND') {
    if (input.nearestEnemyDist !== null && input.nearestEnemyDist <= 24.0) {
      return {
        action: 'ATTACK_ENEMY',
        recommendedBuildOrder,
      };
    }
    return {
      action: 'DEFEND_OWNER_PAD',
      recommendedBuildOrder,
    };
  }

  if (input.commandMode === 'ATTACK') {
    // Unarmed Attacker intelligence: if an Attacker has no weapon (`weaponId === 'unarmed'`),
    // it returns home to base to pick up weapon stock before heading out to attack!
    if (input.weaponId === 'unarmed') {
      return {
        action: 'EQUIP_GROUND_WEAPON',
        recommendedBuildOrder,
      };
    }
    if (
      input.nearestEmptyVehicleDist !== null &&
      input.nearestEmptyVehicleDist <= 14.0 &&
      input.hp < input.maxHp * 0.65
    ) {
      return {
        action: 'MOUNT_VEHICLE',
        recommendedBuildOrder,
      };
    }
    return {
      action: 'ATTACK_ENEMY',
      recommendedBuildOrder,
    };
  }

  if (input.commandMode === 'HARVEST') {
    if (input.carryingCrate) {
      return {
        action: 'DELIVER_TO_OWNER_PAD',
        recommendedBuildOrder,
      };
    }
    if (
      input.ownerPadHasSpace &&
      input.nearestFreeCrateDist !== null &&
      input.nearestFreeCrateDist <= 260.0
    ) {
      return {
        action: 'HARVEST_CRATE',
        recommendedBuildOrder,
      };
    }
    if (input.nearestEnemyDist !== null && input.nearestEnemyDist <= 28.0) {
      return {
        action: 'ATTACK_ENEMY',
        recommendedBuildOrder,
      };
    }
    // Never fall back to FOLLOW_COMMANDER when assigned to HARVEST!
    return {
      action: 'HARVEST_CRATE',
      recommendedBuildOrder,
    };
  }

  return {
    action: 'FOLLOW_COMMANDER',
    recommendedBuildOrder,
  };
}

// ============================================================================
// A* NAVIGATION GRID PATHFINDING WITH BINARY MIN-HEAP OPEN SET
// - Binary heap for the open set
// - g as the cost so far
// - Manhattan heuristic for 4-way movement or Octile heuristic for 8-way movement
// - Ties on f broken towards lower h
// - Path rebuilt from parent links when the goal is popped
// ============================================================================

export interface AStarHeapNode {
  idx: number;
  g: number;
  h: number;
  f: number;
}

/**
 * Compares two A* open-set nodes: orders by lowest `f = g + h`,
 * breaking ties on `f` (`|fA - fB| <= 1e-6`) towards lower `h`.
 */
export function isBetterAStarNode(a: AStarHeapNode, b: AStarHeapNode): boolean {
  const df = a.f - b.f;
  if (Math.abs(df) > 1e-6) {
    return df < 0;
  }
  return a.h < b.h;
}

/**
 * Binary Min-Heap for the A* open set, ordering by lowest `f` with ties broken towards lower `h`.
 */
export class AStarBinaryHeap {
  private readonly items: AStarHeapNode[] = [];

  get size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items.length = 0;
  }

  push(node: AStarHeapNode): void {
    this.items.push(node);
    this.siftUp(this.items.length - 1);
  }

  pop(): AStarHeapNode | undefined {
    const n = this.items.length;
    if (n === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (n > 1) {
      this.items[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  private siftUp(index: number): void {
    let i = index;
    while (i > 0) {
      const parentIdx = (i - 1) >> 1;
      if (isBetterAStarNode(this.items[i], this.items[parentIdx])) {
        const tmp = this.items[i];
        this.items[i] = this.items[parentIdx];
        this.items[parentIdx] = tmp;
        i = parentIdx;
      } else {
        break;
      }
    }
  }

  private siftDown(index: number): void {
    let i = index;
    const len = this.items.length;
    while (true) {
      const left = (i << 1) + 1;
      const right = left + 1;
      let smallest = i;

      if (left < len && isBetterAStarNode(this.items[left], this.items[smallest])) {
        smallest = left;
      }
      if (right < len && isBetterAStarNode(this.items[right], this.items[smallest])) {
        smallest = right;
      }
      if (smallest !== i) {
        const tmp = this.items[i];
        this.items[i] = this.items[smallest];
        this.items[smallest] = tmp;
        i = smallest;
      } else {
        break;
      }
    }
  }
}

/**
 * Admissible Manhattan distance heuristic for 4-way grid movement (never overestimates).
 */
export function computeManhattanHeuristic(
  gx: number,
  gz: number,
  goalGx: number,
  goalGz: number,
): number {
  return Math.abs(goalGx - gx) + Math.abs(goalGz - gz);
}

/**
 * Admissible Octile distance heuristic for 8-way grid movement (never overestimates).
 */
export function computeOctileHeuristic(
  gx: number,
  gz: number,
  goalGx: number,
  goalGz: number,
): number {
  const dx = Math.abs(goalGx - gx);
  const dz = Math.abs(goalGz - gz);
  const minD = Math.min(dx, dz);
  const maxD = Math.max(dx, dz);
  return maxD + (Math.SQRT2 - 1) * minD;
}

export interface AStarNavGrid {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  cellSize: number;
  cols: number;
  rows: number;
  blocked: Uint8Array;
}

export function createAStarNavGrid(
  minX = -108,
  maxX = 108,
  minZ = -108,
  maxZ = 108,
  cellSize = 1.5,
): AStarNavGrid {
  const safeCell = Math.max(0.25, cellSize);
  const cols = Math.max(1, Math.ceil((maxX - minX) / safeCell));
  const rows = Math.max(1, Math.ceil((maxZ - minZ) / safeCell));
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    cellSize: safeCell,
    cols,
    rows,
    blocked: new Uint8Array(cols * rows),
  };
}

export function worldToNavGridCell(
  grid: AStarNavGrid,
  worldX: number,
  worldZ: number,
): { gx: number; gz: number } {
  const gx = clamp(Math.floor((worldX - grid.minX) / grid.cellSize), 0, grid.cols - 1);
  const gz = clamp(Math.floor((worldZ - grid.minZ) / grid.cellSize), 0, grid.rows - 1);
  return { gx, gz };
}

export function navGridCellToWorld(
  grid: AStarNavGrid,
  gx: number,
  gz: number,
): { x: number; z: number } {
  return {
    x: grid.minX + (gx + 0.5) * grid.cellSize,
    z: grid.minZ + (gz + 0.5) * grid.cellSize,
  };
}

export function isNavGridCellWalkable(grid: AStarNavGrid, gx: number, gz: number): boolean {
  if (gx < 0 || gx >= grid.cols || gz < 0 || gz >= grid.rows) return false;
  return grid.blocked[gz * grid.cols + gx] === 0;
}

export function rasterizeCircleObstacleToNavGrid(
  grid: AStarNavGrid,
  cx: number,
  cz: number,
  radius: number,
  agentClearance = 0.65,
): void {
  const r = Math.max(0, radius + agentClearance);
  const minCell = worldToNavGridCell(grid, cx - r, cz - r);
  const maxCell = worldToNavGridCell(grid, cx + r, cz + r);
  const rSq = r * r;
  for (let gz = minCell.gz; gz <= maxCell.gz; gz++) {
    const wz = grid.minZ + (gz + 0.5) * grid.cellSize;
    for (let gx = minCell.gx; gx <= maxCell.gx; gx++) {
      const wx = grid.minX + (gx + 0.5) * grid.cellSize;
      const dx = wx - cx;
      const dz = wz - cz;
      if (dx * dx + dz * dz <= rSq) {
        grid.blocked[gz * grid.cols + gx] = 1;
      }
    }
  }
}

export function rasterizeObbObstacleToNavGrid(
  grid: AStarNavGrid,
  boxX: number,
  boxZ: number,
  halfX: number,
  halfZ: number,
  rotY = 0,
  agentClearance = 0.65,
): void {
  const boundR = Math.hypot(halfX + agentClearance, halfZ + agentClearance);
  const minCell = worldToNavGridCell(grid, boxX - boundR, boxZ - boundR);
  const maxCell = worldToNavGridCell(grid, boxX + boundR, boxZ + boundR);
  for (let gz = minCell.gz; gz <= maxCell.gz; gz++) {
    const wz = grid.minZ + (gz + 0.5) * grid.cellSize;
    for (let gx = minCell.gx; gx <= maxCell.gx; gx++) {
      const wx = grid.minX + (gx + 0.5) * grid.cellSize;
      if (pointInObb2D(wx, wz, boxX, boxZ, halfX, halfZ, rotY, agentClearance)) {
        grid.blocked[gz * grid.cols + gx] = 1;
      }
    }
  }
}

export function findNearestWalkableNavCell(
  grid: AStarNavGrid,
  startGx: number,
  startGz: number,
  maxRadiusCells = 14,
): { gx: number; gz: number } {
  const gx0 = clamp(startGx, 0, grid.cols - 1);
  const gz0 = clamp(startGz, 0, grid.rows - 1);
  if (isNavGridCellWalkable(grid, gx0, gz0)) {
    return { gx: gx0, gz: gz0 };
  }
  for (let r = 1; r <= maxRadiusCells; r++) {
    let bestGx = -1;
    let bestGz = -1;
    let bestDistSq = Infinity;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        const nx = gx0 + dx;
        const nz = gz0 + dz;
        if (isNavGridCellWalkable(grid, nx, nz)) {
          const dSq = dx * dx + dz * dz;
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestGx = nx;
            bestGz = nz;
          }
        }
      }
    }
    if (bestGx !== -1) {
      return { gx: bestGx, gz: bestGz };
    }
  }
  return { gx: gx0, gz: gz0 };
}

export interface AStarPathResult {
  waypoints: Array<{ x: number; z: number }>;
  cellPath: Array<{ gx: number; gz: number }>;
  reachedGoal: boolean;
  expandedCount: number;
  totalCost: number;
}

const DIRS_4WAY: ReadonlyArray< readonly [number, number, number] > = [
  [1, 0, 1.0],
  [-1, 0, 1.0],
  [0, 1, 1.0],
  [0, -1, 1.0],
];

const DIRS_8WAY: ReadonlyArray< readonly [number, number, number] > = [
  [1, 0, 1.0],
  [-1, 0, 1.0],
  [0, 1, 1.0],
  [0, -1, 1.0],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/**
 * Runs A* pathfinding on `grid`:
 * - Uses a binary min-heap (`AStarBinaryHeap`) for the open set
 * - Tracks `g` as the cost so far
 * - Uses Manhattan heuristic for 4-way movement (`allowDiagonal = false`) or Octile heuristic for 8-way (`allowDiagonal = true`)
 * - Breaks ties on `f` towards lower `h`
 * - Rebuilds the shortest path from `parent` links when the goal tile is popped from the open set.
 */
export function findPathAStar(
  grid: AStarNavGrid,
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number,
  options?: {
    allowDiagonal?: boolean;
    maxIterations?: number;
  },
): AStarPathResult {
  const allowDiagonal = options?.allowDiagonal ?? true;
  const maxIterations = options?.maxIterations ?? 8192;

  const rawStart = worldToNavGridCell(grid, startX, startZ);
  const rawGoal = worldToNavGridCell(grid, goalX, goalZ);
  const startCell = findNearestWalkableNavCell(grid, rawStart.gx, rawStart.gz);
  const goalCell = findNearestWalkableNavCell(grid, rawGoal.gx, rawGoal.gz);

  const cols = grid.cols;
  const totalCells = cols * grid.rows;
  const startIdx = startCell.gz * cols + startCell.gx;
  const goalIdx = goalCell.gz * cols + goalCell.gx;

  if (startIdx === goalIdx) {
    const goalPos = isNavGridCellWalkable(grid, rawGoal.gx, rawGoal.gz)
      ? { x: goalX, z: goalZ }
      : navGridCellToWorld(grid, goalCell.gx, goalCell.gz);
    return {
      waypoints: [goalPos],
      cellPath: [{ gx: goalCell.gx, gz: goalCell.gz }],
      reachedGoal: true,
      expandedCount: 1,
      totalCost: 0,
    };
  }

  const gScore = new Float32Array(totalCells);
  gScore.fill( Infinity );
  const parent = new Int32Array(totalCells);
  parent.fill(-1);
  const closed = new Uint8Array(totalCells);

  const computeH = allowDiagonal ? computeOctileHeuristic : computeManhattanHeuristic;
  const dirs = allowDiagonal ? DIRS_8WAY : DIRS_4WAY;

  const openHeap = new AStarBinaryHeap();
  const hStart = computeH(startCell.gx, startCell.gz, goalCell.gx, goalCell.gz);
  gScore[startIdx] = 0;
  openHeap.push({
    idx: startIdx,
    g: 0,
    h: hStart,
    f: hStart,
  });

  let expandedCount = 0;
  let reachedGoal = false;
  let bestFallbackIdx = startIdx;
  let bestFallbackH = hStart;

  while (openHeap.size > 0 && expandedCount < maxIterations) {
    const current = openHeap.pop()!;
    const currIdx = current.idx;
    if (closed[currIdx] !== 0) {
      continue;
    }
    closed[currIdx] = 1;
    expandedCount++;

    if (current.h < bestFallbackH) {
      bestFallbackH = current.h;
      bestFallbackIdx = currIdx;
    }

    if (currIdx === goalIdx) {
      reachedGoal = true;
      bestFallbackIdx = goalIdx;
      break;
    }

    const cx = currIdx % cols;
    const cz = (currIdx / cols) | 0;
    const currG = gScore[currIdx];

    for (let di = 0; di < dirs.length; di++) {
      const [dx, dz, stepCost] = dirs[di];
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 0 || nx >= cols || nz < 0 || nz >= grid.rows) continue;

      const nIdx = nz * cols + nx;
      if (closed[nIdx] !== 0 || grid.blocked[nIdx] !== 0) continue;

      // Prevent diagonal corner-cutting across blocked cardinal neighbors
      if (dx !== 0 && dz !== 0) {
        if (grid.blocked[cz * cols + (cx + dx)] !== 0 || grid.blocked[(cz + dz) * cols + cx] !== 0) {
          continue;
        }
      }

      const tentativeG = currG + stepCost;
      if (tentativeG + 1e-6 < gScore[nIdx]) {
        gScore[nIdx] = tentativeG;
        parent[nIdx] = currIdx;
        const h = computeH(nx, nz, goalCell.gx, goalCell.gz);
        openHeap.push({
          idx: nIdx,
          g: tentativeG,
          h,
          f: tentativeG + h,
        });
      }
    }
  }

  // Rebuild path from parent links starting at the popped goal tile (or closest fallback tile)
  const targetIdx = reachedGoal ? goalIdx : bestFallbackIdx;
  const revIndices: number[] = [];
  let trace = targetIdx;
  let safety = 0;
  while (trace !== -1 && safety <= totalCells) {
    revIndices.push(trace);
    if (trace === startIdx) break;
    trace = parent[trace];
    safety++;
  }
  revIndices.reverse();

  const cellPath: Array<{ gx: number; gz: number }> = [];
  const waypoints: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < revIndices.length; i++) {
    const idx = revIndices[i];
    const gx = idx % cols;
    const gz = (idx / cols) | 0;
    cellPath.push({ gx, gz });
    // Skip pushing the start cell itself if there are subsequent cells so the agent immediately moves toward cell[1]
    if (i === 0 && revIndices.length > 1) continue;
    waypoints.push(navGridCellToWorld(grid, gx, gz));
  }

  if (reachedGoal && isNavGridCellWalkable(grid, rawGoal.gx, rawGoal.gz) && waypoints.length > 0) {
    waypoints[waypoints.length - 1] = { x: goalX, z: goalZ };
  }

  return {
    waypoints,
    cellPath,
    reachedGoal,
    expandedCount,
    totalCost: gScore[targetIdx],
  };
}

// ============================================================================
// HIT REACTION, STUN EFFECT, SHOT RECOIL & EMISSIVE FLASH SOLVERS
// ============================================================================

export interface BlitzHitReactionPose {
  hopY: number;
  liftY: number;
  rotX: number;
  rotZ: number;
}

/**
 * Evaluates directional hit-reaction body hop & tilt
 * (Player/Vehicle: `+0.05m` lift, `12°` max tilt;
 * Enemy/Bot: `+0.10m` lift, `30°` max tilt; `0.10s` `power2.out` attack, `0.50s` `power3.out` recovery).
 * `hitTimerRemaining` counts down from `durationSec` (`0.60s`) to `0`.
 */
export function evaluateBlitzHitReactionPose(
  hitTimerRemaining: number,
  durationSec = 0.6,
  localDirX = 0,
  localDirZ = 1,
  isPlayerOrVehicle = false,
): BlitzHitReactionPose {
  if (hitTimerRemaining <= 0 || durationSec <= 0) {
    return { hopY: 0, liftY: 0, rotX: 0, rotZ: 0 };
  }
  const elapsedSec = clamp(durationSec - hitTimerRemaining, 0, durationSec);
  const attackDur = 0.1;
  const recoverDur = Math.max(0.01, durationSec - attackDur);

  let env = 0;
  if (elapsedSec < attackDur) {
    const u = elapsedSec / attackDur;
    // power2.out: 1 - (1 - u)^2
    env = 1 - (1 - u) * (1 - u);
  } else {
    const u = (elapsedSec - attackDur) / recoverDur;
    // power3.out back to 0: (1 - u)^3
    const inv = Math.max(0, 1 - u);
    env = inv * inv * inv;
  }

  const maxLift = isPlayerOrVehicle ? 0.05 : 0.1;
  const maxTiltRad = ((isPlayerOrVehicle ? 12 : 30) * Math.PI) / 180;
  const hopY = maxLift * env;
  return {
    hopY,
    liftY: hopY,
    rotX: localDirZ * maxTiltRad * env,
    rotZ: -localDirX * maxTiltRad * env,
  };
}

export interface BlitzStunEffectState {
  active: boolean;
  visible: boolean;
  scale: number;
  rotationZ: number;
}

/**
 * Evaluates overhead spinning stunned star effect:
 * - `stunDuration = 1.5s` default
 * - First `0.25s`: `back.out(1.5)` scale `0 -> 1`
 * - Last `0.25s`: `power2.in` scale `1 -> 0`
 * - Spins `2` full turns (`4π` radians) over the stun duration.
 */
export function evaluateBlitzStunEffectState(
  stunTimerRemaining: number,
  stunDuration = 1.5,
): BlitzStunEffectState {
  if (stunTimerRemaining <= 0 || stunDuration <= 0) {
    return { active: false, visible: false, scale: 0, rotationZ: 0 };
  }
  const elapsed = clamp(stunDuration - stunTimerRemaining, 0, stunDuration);
  const progress = clamp(elapsed / stunDuration, 0, 1);
  const rotationZ = progress * Math.PI * 4;

  let scale = 1.0;
  if (elapsed < 0.25) {
    const u = elapsed / 0.25;
    const s = 1.5;
    const t = u - 1;
    // back.out(1.5)
    scale = Math.max(0, 1 + (s + 1) * t * t * t + s * t * t);
  } else if (stunTimerRemaining < 0.25) {
    const u = 1 - stunTimerRemaining / 0.25;
    // power2.in from 1 -> 0
    scale = Math.max(0, 1 - u * u);
  }

  const active = scale > 0.005;
  return {
    active,
    visible: active,
    scale,
    rotationZ,
  };
}

export interface BlitzTankShotRecoilPose {
  cameraKick: number;
  turretSlideBack: number;
  turretLiftY: number;
  turretPitchRad: number;
  barrelSlideBack: number;
  bodyLiftY: number;
  bodyTiltRad: number;
}

/**
 * Evaluates 4-part tank cannon firing recoil:
 * - Camera kick `0.13m`
 * - Turret & Barrel slide back `0.16m` (`0.05s` `sine.out` push, `0.22s` `power2.out` return)
 * - Turret lifts `+0.06m` & pitches `6°` (`0.05s` out, `0.22s` return)
 * - Hull body lifts `+0.05m` & tilts `12°` opposite firing direction (`0.05s` `power2.out`, `0.25s` `power3.out` return).
 * `recoilTimerRemaining` counts down from `durationSec` (`0.24s`) to `0`.
 */
export function evaluateBlitzTankShotRecoilPose(
  recoilTimerRemaining: number,
  durationSec = 0.24,
): BlitzTankShotRecoilPose {
  if (recoilTimerRemaining <= 0 || durationSec <= 0) {
    return {
      cameraKick: 0,
      turretSlideBack: 0,
      turretLiftY: 0,
      turretPitchRad: 0,
      barrelSlideBack: 0,
      bodyLiftY: 0,
      bodyTiltRad: 0,
    };
  }

  const elapsedSec = clamp(durationSec - recoilTimerRemaining, 0, durationSec);
  const attackDur = 0.05;
  const recoverDur = Math.max(0.01, durationSec - attackDur);

  let turretEnv = 0;
  if (elapsedSec < attackDur) {
    const u = elapsedSec / attackDur;
    turretEnv = Math.sin((u * Math.PI) / 2); // sine.out
  } else {
    const u = (elapsedSec - attackDur) / recoverDur;
    const inv = Math.max(0, 1 - u);
    turretEnv = inv * inv; // power2.out back to 0
  }

  let bodyEnv = 0;
  if (elapsedSec < attackDur) {
    const u = elapsedSec / attackDur;
    bodyEnv = 1 - (1 - u) * (1 - u); // power2.out
  } else {
    const u = (elapsedSec - attackDur) / recoverDur;
    const inv = Math.max(0, 1 - u);
    bodyEnv = inv * inv * inv; // power3.out back to 0
  }

  return {
    cameraKick: 0.13 * turretEnv,
    turretSlideBack: 0.16 * turretEnv,
    turretLiftY: 0.06 * turretEnv,
    turretPitchRad: ((6 * Math.PI) / 180) * turretEnv,
    barrelSlideBack: 0.16 * turretEnv,
    bodyLiftY: 0.05 * bodyEnv,
    bodyTiltRad: ((12 * Math.PI) / 180) * bodyEnv,
  };
}

/**
 * Evaluates yellow emissive hit flash intensity:
 * `flashColor = '#ffff00'`, `flashDuration = 0.15s`,
 * decaying quadratically from `1.0` to `0.0` as `remainingRatio^2`.
 */
export function evaluateBlitzEmissiveHitFlash(
  flashTimerRemaining: number,
  durationSec = 0.15,
): number {
  if (flashTimerRemaining <= 0 || durationSec <= 0) return 0;
  const r = clamp(flashTimerRemaining / durationSec, 0, 1);
  return r * r;
}

// ============================================================================
// MUZZLE RAYCAST HIT DETECTION (MAX 100 UNITS, LAYER MASK SKIPPING SHOOTER,
// CLOSEST HIT POINT + SURFACE NORMAL, & TARGET LOCK-ON FOR ENEMY / VEHICLE / SKYSHIELD)
// ============================================================================

export const RAYCAST_MAX_DISTANCE = 100.0;

export const RAYCAST_LAYERS = {
  SHOOTER: 1 << 0,         // 1: The shooter unit/vehicle itself (always skipped by muzzle mask)
  ENEMY_CHARACTER: 1 << 1, // 2: Hostile / targetable Buddy character
  VEHICLE: 1 << 2,         // 4: Targetable Vehicle (Blitz Tank, Dump Truck, Fighter Plane)
  SKYSHIELD: 1 << 3,       // 8: 35mm Skyshield Air & Ground Defense Turret
  PROP: 1 << 4,            // 16: Map props, explosive barrels, crates, trees, fences
  STRUCTURE: 1 << 5,       // 32: Base buildings (HQ, Barracks, Hangar, Checkpoints, Walls)
  DEFAULT_MUZZLE_MASK: (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5),
} as const;

export type RaycastTargetKind =
  | 'enemy_character'
  | 'vehicle'
  | 'skyshield'
  | 'prop'
  | 'structure'
  | 'none';

export interface RaycastCollider3D {
  id: string;
  layer: number;
  targetKind: Exclude<RaycastTargetKind, 'none'>;
  /** Team affiliation ('blue' | 'red'); friendly colliders matching shooterTeam are NEVER target-locked! */
  team?: 'blue' | 'red';
  label?: string;
  shape: 'sphere' | 'cylinder' | 'obb';
  center: Vec3;
  /** For 'sphere' and 'cylinder' */
  radius?: number;
  /** For 'cylinder' and 'obb': full vertical height or half-extents */
  halfExtents?: Vec3;
  /** For 'obb': Y-axis yaw rotation in radians */
  rotY?: number;
}

export interface RayPrimitiveHit3D {
  distance: number;
  point: Vec3;
  normal: Vec3;
}

export interface MuzzleRaycastResult {
  hit: boolean;
  distance: number;
  point: Vec3;
  normal: Vec3;
  colliderId: string | null;
  targetKind: RaycastTargetKind;
  targetLabel: string | null;
  /**
   * True when the raycast line touches a lockable target:
   * Enemy Character ('enemy_character'), Vehicle ('vehicle'), or Skyshield ('skyshield').
   */
  isTargetLocked: boolean;
  lockCenter: Vec3 | null;
  lockRadius: number;
}

/**
 * Ray-Sphere intersection in 3D. Returns closest hit in (0, maxDistance] with outward unit normal.
 */
export function intersectRaySphere3D(
  origin: Vec3,
  dir: Vec3,
  center: Vec3,
  radius: number,
  maxDistance = RAYCAST_MAX_DISTANCE,
): RayPrimitiveHit3D | null {
  if (radius <= 0) return null;
  const ocX = origin.x - center.x;
  const ocY = origin.y - center.y;
  const ocZ = origin.z - center.z;

  const b = ocX * dir.x + ocY * dir.y + ocZ * dir.z;
  const c = ocX * ocX + ocY * ocY + ocZ * ocZ - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;

  const sqrtDisc = Math.sqrt(disc);
  let t = -b - sqrtDisc;
  if (t <= 1e-4) {
    t = -b + sqrtDisc;
  }
  if (t <= 1e-4 || t > maxDistance) return null;

  const px = origin.x + dir.x * t;
  const py = origin.y + dir.y * t;
  const pz = origin.z + dir.z * t;
  const nx = px - center.x;
  const ny = py - center.y;
  const nz = pz - center.z;
  const nLen = Math.hypot(nx, ny, nz) || 1;

  return {
    distance: t,
    point: { x: px, y: py, z: pz },
    normal: { x: nx / nLen, y: ny / nLen, z: nz / nLen },
  };
}

/**
 * Ray-Vertical Cylinder intersection in 3D (centered at `center`, radius `radius`, half-height `halfHeight`).
 * Returns closest hit in (0, maxDistance] with exact side-wall or cap normal.
 */
export function intersectRayCylinderY3D(
  origin: Vec3,
  dir: Vec3,
  center: Vec3,
  radius: number,
  halfHeight: number,
  maxDistance = RAYCAST_MAX_DISTANCE,
): RayPrimitiveHit3D | null {
  if (radius <= 0 || halfHeight <= 0) return null;
  const minY = center.y - halfHeight;
  const maxY = center.y + halfHeight;
  const ox = origin.x - center.x;
  const oz = origin.z - center.z;

  let bestT = Infinity;
  let bestNormal: Vec3 = { x: 0, y: 1, z: 0 };

  // 1. Curved side wall in XZ
  const a = dir.x * dir.x + dir.z * dir.z;
  const b = 2 * (ox * dir.x + oz * dir.z);
  const c = ox * ox + oz * oz - radius * radius;

  if (a > 1e-8) {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sqrtDisc = Math.sqrt(disc);
      const tCandidates = [(-b - sqrtDisc) / (2 * a), (-b + sqrtDisc) / (2 * a)];
      for (const t of tCandidates) {
        if (t > 1e-4 && t <= maxDistance && t < bestT) {
          const hitY = origin.y + dir.y * t;
          if (hitY >= minY && hitY <= maxY) {
            const hx = ox + dir.x * t;
            const hz = oz + dir.z * t;
            const hLen = Math.hypot(hx, hz) || 1;
            bestT = t;
            bestNormal = { x: hx / hLen, y: 0, z: hz / hLen };
          }
        }
      }
    }
  }

  // 2. Top and bottom circular caps
  if (Math.abs(dir.y) > 1e-8) {
    const capYs: Array<{ y: number; ny: number }> = [
      { y: maxY, ny: 1 },
      { y: minY, ny: -1 },
    ];
    for (const cap of capYs) {
      const t = (cap.y - origin.y) / dir.y;
      if (t > 1e-4 && t <= maxDistance && t < bestT) {
        const hx = ox + dir.x * t;
        const hz = oz + dir.z * t;
        if (hx * hx + hz * hz <= radius * radius) {
          bestT = t;
          bestNormal = { x: 0, y: cap.ny, z: 0 };
        }
      }
    }
  }

  if (!Number.isFinite(bestT)) return null;
  return {
    distance: bestT,
    point: {
      x: origin.x + dir.x * bestT,
      y: origin.y + dir.y * bestT,
      z: origin.z + dir.z * bestT,
    },
    normal: bestNormal,
  };
}

/**
 * Ray-Oriented Bounding Box (OBB) intersection in 3D (centered at `center`, half-extents `halfExtents`,
 * rotated around Y axis by `rotY` radians). Returns closest hit in (0, maxDistance] with world-space face normal.
 */
export function intersectRayObb3D(
  origin: Vec3,
  dir: Vec3,
  center: Vec3,
  halfExtents: Vec3,
  rotY = 0,
  maxDistance = RAYCAST_MAX_DISTANCE,
): RayPrimitiveHit3D | null {
  const dx = origin.x - center.x;
  const dy = origin.y - center.y;
  const dz = origin.z - center.z;

  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);

  // Transform ray origin & direction into OBB local space (rotate by -rotY around Y)
  const localOx = dx * cosY - dz * sinY;
  const localOy = dy;
  const localOz = dx * sinY + dz * cosY;

  const localDx = dir.x * cosY - dir.z * sinY;
  const localDy = dir.y;
  const localDz = dir.x * sinY + dir.z * cosY;

  let tMin = -Infinity;
  let tMax = Infinity;
  let nearLocalNormal: Vec3 = { x: 0, y: 1, z: 0 };
  let farLocalNormal: Vec3 = { x: 0, y: 1, z: 0 };

  const slabs: Array<{
    o: number;
    d: number;
    half: number;
    nx: number;
    ny: number;
    nz: number;
  }> = [
    { o: localOx, d: localDx, half: halfExtents.x, nx: 1, ny: 0, nz: 0 },
    { o: localOy, d: localDy, half: halfExtents.y, nx: 0, ny: 1, nz: 0 },
    { o: localOz, d: localDz, half: halfExtents.z, nx: 0, ny: 0, nz: 1 },
  ];

  for (const s of slabs) {
    if (Math.abs(s.d) < 1e-8) {
      if (Math.abs(s.o) > s.half) return null;
    } else {
      let t1 = (-s.half - s.o) / s.d;
      let t2 = (s.half - s.o) / s.d;
      let n1 = -1;
      let n2 = 1;
      if (t1 > t2) {
        const tmpT = t1;
        t1 = t2;
        t2 = tmpT;
        const tmpN = n1;
        n1 = n2;
        n2 = tmpN;
      }
      if (t1 > tMin) {
        tMin = t1;
        nearLocalNormal = { x: s.nx * n1, y: s.ny * n1, z: s.nz * n1 };
      }
      if (t2 < tMax) {
        tMax = t2;
        farLocalNormal = { x: s.nx * n2, y: s.ny * n2, z: s.nz * n2 };
      }
      if (tMin > tMax) return null;
    }
  }

  let hitT = tMin;
  let chosenLocalNormal = nearLocalNormal;
  if (hitT <= 1e-4) {
    hitT = tMax;
    chosenLocalNormal = farLocalNormal;
  }
  if (hitT <= 1e-4 || hitT > maxDistance) return null;

  // Rotate local face normal back to world space (+rotY around Y)
  const worldNx = chosenLocalNormal.x * cosY + chosenLocalNormal.z * sinY;
  const worldNy = chosenLocalNormal.y;
  const worldNz = -chosenLocalNormal.x * sinY + chosenLocalNormal.z * cosY;
  const nLen = Math.hypot(worldNx, worldNy, worldNz) || 1;

  return {
    distance: hitT,
    point: {
      x: origin.x + dir.x * hitT,
      y: origin.y + dir.y * hitT,
      z: origin.z + dir.z * hitT,
    },
    normal: {
      x: worldNx / nLen,
      y: worldNy / nLen,
      z: worldNz / nLen,
    },
  };
}

/**
 * Casts a 3D ray from the weapon muzzle along `direction` up to `maxDistance` (default 100 units),
 * filtering colliders with `layerMask` (which skips `RAYCAST_LAYERS.SHOOTER`) and optional `shooterId`.
 * Returns the closest hit along with its 3D hit point, surface normal, and Target Lock-On state
 * when the ray touches an enemy character, vehicle, or Skyshield turret.
 */
export function castMuzzleRaycast3D(
  origin: Vec3,
  direction: Vec3,
  colliders: readonly RaycastCollider3D[],
  options?: {
    maxDistance?: number;
    layerMask?: number;
    shooterId?: string | null;
    shooterTeam?: 'blue' | 'red';
  },
): MuzzleRaycastResult {
  const maxDistance = options?.maxDistance ?? RAYCAST_MAX_DISTANCE;
  const layerMask = options?.layerMask ?? RAYCAST_LAYERS.DEFAULT_MUZZLE_MASK;
  const shooterId = options?.shooterId ?? null;
  const shooterTeam = options?.shooterTeam ?? 'blue';

  const dirLen = Math.hypot(direction.x, direction.y, direction.z);
  const normDir: Vec3 =
    dirLen > 1e-6
      ? { x: direction.x / dirLen, y: direction.y / dirLen, z: direction.z / dirLen }
      : { x: 0, y: 0, z: 1 };

  let bestDistance = maxDistance;
  let bestHit: RayPrimitiveHit3D | null = null;
  let bestCollider: RaycastCollider3D | null = null;

  for (let i = 0; i < colliders.length; i++) {
    const col = colliders[i];
    // Skip any collider excluded by layerMask or matching shooterId
    if ((col.layer & layerMask) === 0) continue;
    if (shooterId !== null && col.id === shooterId) continue;
    // Never hit or lock onto friendly units, friendly vehicles, or friendly Skyshield turrets!
    if (
      col.team !== undefined &&
      col.team === shooterTeam &&
      (col.targetKind === 'enemy_character' ||
        col.targetKind === 'vehicle' ||
        col.targetKind === 'skyshield')
    ) {
      continue;
    }

    let hit: RayPrimitiveHit3D | null = null;
    if (col.shape === 'sphere') {
      hit = intersectRaySphere3D(origin, normDir, col.center, col.radius ?? 1.0, bestDistance);
    } else if (col.shape === 'cylinder') {
      const halfH = col.halfExtents?.y ?? 1.1;
      hit = intersectRayCylinderY3D(
        origin,
        normDir,
        col.center,
        col.radius ?? 0.9,
        halfH,
        bestDistance,
      );
    } else if (col.shape === 'obb') {
      const he = col.halfExtents ?? { x: 1, y: 1, z: 1 };
      hit = intersectRayObb3D(origin, normDir, col.center, he, col.rotY ?? 0, bestDistance);
    }

    if (hit && hit.distance < bestDistance) {
      bestDistance = hit.distance;
      bestHit = hit;
      bestCollider = col;
    }
  }

  if (!bestHit || !bestCollider) {
    return {
      hit: false,
      distance: maxDistance,
      point: {
        x: origin.x + normDir.x * maxDistance,
        y: origin.y + normDir.y * maxDistance,
        z: origin.z + normDir.z * maxDistance,
      },
      normal: { x: 0, y: 1, z: 0 },
      colliderId: null,
      targetKind: 'none',
      targetLabel: null,
      isTargetLocked: false,
      lockCenter: null,
      lockRadius: 0,
    };
  }

  const targetKind = bestCollider.targetKind;
  const isFriendly = bestCollider.team !== undefined && bestCollider.team === shooterTeam;
  const isTargetLocked =
    !isFriendly &&
    (targetKind === 'enemy_character' ||
      targetKind === 'vehicle' ||
      targetKind === 'skyshield');

  const lockRadius =
    bestCollider.shape === 'obb' && bestCollider.halfExtents
      ? Math.max(bestCollider.halfExtents.x, bestCollider.halfExtents.z) * 1.15
      : (bestCollider.radius ?? 1.2) * 1.35;

  return {
    hit: true,
    distance: bestHit.distance,
    point: bestHit.point,
    normal: bestHit.normal,
    colliderId: bestCollider.id,
    targetKind,
    targetLabel: bestCollider.label ?? bestCollider.id,
    isTargetLocked,
    lockCenter: { ...bestCollider.center },
    lockRadius,
  };
}

// ============================================================================
// WEAPON-PROPORTIONAL 3D PROJECTILE CALIBER & LENGTH SPECIFICATION
// Ensures every projectile's cross-sectional diameter & length are strictly
// proportional to the physical barrel bore of the weapon that fires it.
// ============================================================================

export interface WeaponProjectileVisualSpec {
  /** Which 3D GLB shell template to show ('boss' = finned rocket, 'player' = cannon shell, 'fodder' = streamlined bullet) */
  shellKind: 'boss' | 'player' | 'fodder';
  /** World-space cross-sectional diameter (X & Y scale on unit-normalized projectile mesh), strictly < barrelOuterDiameter */
  diameter: number;
  /** World-space longitudinal length along flight vector (Z scale on unit-normalized projectile mesh) */
  length: number;
  /** Reference outer barrel/muzzle diameter of the firing weapon in world units */
  barrelOuterDiameter: number;
}

export function getWeaponProjectileVisualSpec(weaponType: string): WeaponProjectileVisualSpec {
  const w = weaponType.trim();

  // 0. Tactical Nuclear Missile ('NuclearMissile' — MLRS-MK5 'ATLAS' Nuke Rocket)
  if (w === 'NuclearMissile') {
    return {
      shellKind: 'boss',
      diameter: 0.30,
      length: 0.96,
      barrelOuterDiameter: 0.38,
    };
  }

  // 0B. LG-88 Photon Lance ('BlitzLaserGun' — Directed-Energy Laser Beam)
  if (w === 'BlitzLaserGun') {
    return {
      shellKind: 'fodder',
      diameter: 0.08,
      length: 0.72,
      barrelOuterDiameter: 0.14,
    };
  }

  // 0C. TITAN-6 Heavy Rotary Gatling Gun ('Titan6Gatling' — 7.62x51mm High-RPM Rotary Stream)
  if (w === 'Titan6Gatling') {
    return {
      shellKind: 'fodder',
      diameter: 0.09,
      length: 0.42,
      barrelOuterDiameter: 0.16,
    };
  }

  // 1. Heavy Tank Cannon (buddy-tank.glb barrel outer diameter ~0.32m at 2.45x-2.75x scale)
  if (w === 'TankCannon') {
    return {
      shellKind: 'player',
      diameter: 0.22,
      length: 0.48,
      barrelOuterDiameter: 0.32,
    };
  }

  // 2. Shoulder-Mounted Bazooka / Rocket Launcher (recessed warhead diameter 0.22m inside 0.406m launch tube)
  if (w === 'Bazooka' || w === 'Supazooka' || w === 'BlitzRocketLauncher' || w.includes('Rocket')) {
    return {
      shellKind: 'boss',
      diameter: 0.19,
      length: 0.45,
      barrelOuterDiameter: 0.22,
    };
  }

  // 3. 35mm Skyshield C-RAM / AHEAD Turret (barrel tube 0.124m-0.152m, muzzle sensor rings 0.204m)
  if (w === 'Skyshield35mm') {
    return {
      shellKind: 'player',
      diameter: 0.115,
      length: 0.36,
      barrelOuterDiameter: 0.152,
    };
  }

  // 4. Fighter Plane Twin Under-Wing 20mm Rotary Gatling Cannon ('PlaneGatling' / 'Uzi')
  if (w === 'PlaneGatling' || w === 'Uzi') {
    return {
      shellKind: 'fodder',
      diameter: 0.082,
      length: 0.30,
      barrelOuterDiameter: 0.11,
    };
  }

  // 5. Tactical Assault Rifle / Carbine ('BlitzAssaultRifle' / 'Machine Gun' / 'Shotgun')
  //    Barrel diameter = 0.042 * 2 * 1.16 = 0.097m, muzzle brake = 0.158m
  if (
    w === 'BlitzAssaultRifle' ||
    w.includes('Rifle') ||
    w.includes('Machine') ||
    w.includes('Shotgun')
  ) {
    return {
      shellKind: 'fodder',
      diameter: 0.074,
      length: 0.26,
      barrelOuterDiameter: 0.097,
    };
  }

  // 6. Tactical Pistol ('BlitzPistol' & compact sidearms)
  //    Barrel bore diameter = 0.032 * 2 * 1.16 = 0.074m, slide width = 0.162m
  return {
    shellKind: 'fodder',
    diameter: 0.062,
    length: 0.18,
    barrelOuterDiameter: 0.074,
  };
}

// ============================================================================
// FIXED PREALLOCATED OBJECT POOL FOR BULLETS & PARTICLES (ZERO GC STALLS)
// - Preallocates the peak count up front at initialization
// - Takes an inactive instance and resets its fields on spawn
// - Marks it inactive on death instead of destroying it (zero GC churn)
// - Logs a warning if the pool ever runs out of preallocated slots
// ============================================================================

export const DEFAULT_BULLET_LANE_POOL_SIZE = 14;

export const POOL_PEAK_CAPACITIES = {
  /** Single-lane reference pool size (recycles the same 14 slots without GC pauses) */
  bulletLane: DEFAULT_BULLET_LANE_POOL_SIZE,
  /** Full 4v4 arena peak simultaneous bullets (Infantry, Tanks, Planes & 8 Skyshield AA Turrets) */
  bullets: 64,
  /** Burst, directional spark, and collision contact particles */
  explosionParticles: 96,
  /** 3D shattered wood, concrete, and metal debris chunks */
  debrisChunks: 64,
  /** Persistent tank caterpillar tread marks on terrain */
  tankTrackMarks: 220,
  /** Blitz 5-Layer VFX Layer A: Core Fireballs & Bullet-Hit Flash Bursts */
  fireballs: 24,
  /** Blitz 5-Layer VFX Layer B: Billowing Toon Smoke Puffs */
  smokePuffs: 112,
  /** Blitz 5-Layer VFX Layer C: Expanding Ground Shockwave Rings */
  shockwaveRings: 24,
  /** Blitz 5-Layer VFX Layer D: Flying Sparks & Confetti Squares */
  confettiSparks: 140,
  /** Blitz 5-Layer VFX Layer E: Ground Scorch Mark Decals */
  scorchDecals: 24,
  /** Weapon Muzzle Flash Cones & Stars */
  muzzleFlashes: 24,
  /** Multi-stage sequential explosion timer slots */
  multiStageExplosions: 28,
} as const;

export interface PooledSlot {
  active: boolean;
}

export interface FixedObjectPoolOptions<T extends PooledSlot> {
  /** Human-readable pool identifier used in exhaustion warnings */
  name: string;
  /** Peak number of instances preallocated up front */
  peakCapacity: number;
  /** Factory called exactly `peakCapacity` times during preallocation */
  createSlot: (index: number) => T;
  /** Called on `acquire()` to reset fields to clean defaults before spawn customization */
  resetSlot?: (slot: T) => void;
  /** Called on `release()` / death to hide visuals & clear state instead of destroying the instance */
  deactivateSlot?: (slot: T) => void;
  /** Optional custom warning logger when the pool runs out (defaults to `console.warn`) */
  onWarnExhausted?: (message: string, poolName: string, peakCapacity: number) => void;
}

export interface FixedObjectPool<T extends PooledSlot> {
  readonly name: string;
  readonly capacity: number;
  readonly slots: readonly T[];
  readonly activeCount: number;
  readonly peakActiveCount: number;
  readonly totalSpawns: number;
  readonly exhaustionWarnings: number;
  /** Takes an inactive instance, marks it active, resets its fields on spawn, or logs a warning and returns null if full */
  acquire(initOnSpawn?: (slot: T) => void): T | null;
  /** Marks an active instance inactive on death instead of destroying it */
  release(slot: T): void;
  /** Marks all active instances inactive (e.g. on match/mode reset) without destroying any slot */
  releaseAll(): void;
}

export function createFixedObjectPool<T extends PooledSlot>(
  options: FixedObjectPoolOptions<T>,
): FixedObjectPool<T> {
  const capacity = Math.max(1, Math.floor(options.peakCapacity));
  const slots: T[] = new Array<T>(capacity);
  const spawnedOnceSet = new Set<T>();

  for (let i = 0; i < capacity; i++) {
    const slot = options.createSlot(i);
    slot.active = false;
    options.deactivateSlot?.(slot);
    slots[i] = slot;
  }

  let nextCursor = 0;
  let activeCount = 0;
  let peakActiveCount = 0;
  let totalSpawns = 0;
  let exhaustionWarnings = 0;

  const warnFn =
    options.onWarnExhausted ??
    ((msg: string) => {
      console.warn(msg);
    });

  return {
    name: options.name,
    capacity,
    slots,
    get activeCount() {
      return activeCount;
    },
    get peakActiveCount() {
      return peakActiveCount;
    },
    get totalSpawns() {
      return totalSpawns;
    },
    get exhaustionWarnings() {
      return exhaustionWarnings;
    },
    acquire(initOnSpawn?: (slot: T) => void): T | null {
      for (let step = 0; step < capacity; step++) {
        const idx = (nextCursor + step) % capacity;
        const candidate = slots[idx];
        if (!candidate.active) {
          nextCursor = (idx + 1) % capacity;
          candidate.active = true;
          activeCount++;
          totalSpawns++;
          spawnedOnceSet.add(candidate);
          if (activeCount > peakActiveCount) {
            peakActiveCount = activeCount;
          }
          options.resetSlot?.(candidate);
          initOnSpawn?.(candidate);
          return candidate;
        }
      }

      exhaustionWarnings++;
      warnFn(
        `[ObjectPool:${options.name}] Pool exhausted! All ${capacity} preallocated slots are active.`,
        options.name,
        capacity,
      );
      return null;
    },
    release(slot: T): void {
      if (!slot.active) return;
      slot.active = false;
      activeCount = Math.max(0, activeCount - 1);
      options.deactivateSlot?.(slot);
    },
    releaseAll(): void {
      for (let i = 0; i < capacity; i++) {
        const slot = slots[i];
        if (slot.active) {
          slot.active = false;
          options.deactivateSlot?.(slot);
        }
      }
      activeCount = 0;
      nextCursor = 0;
    },
  };
}

export interface BulletLanePoolSimulationResult {
  totalShots: number;
  poolCapacity: number;
  unpooledAllocations: number;
  unpooledGarbageDiscarded: number;
  unpooledGcPauseStalls: number;
  pooledPreallocatedSlots: number;
  pooledRuntimeAllocations: number;
  pooledGarbageDiscarded: number;
  pooledGcPauseStalls: number;
  pooledUniqueSlotsUsed: number;
  pooledRecycledSpawns: number;
  pooledExhaustionWarnings: number;
}

/**
 * Compares an unpooled bullet lane (allocating a new bullet every shot and discarding it on death,
 * triggering GC pause stalls) against a pooled bullet lane that preallocates `poolCapacity` (default 14)
 * slots once up front and recycles the exact same 14 slots with zero garbage collection stalls.
 */
export function simulatePooledVsUnpooledBulletLane(
  totalShots = 140,
  poolCapacity = DEFAULT_BULLET_LANE_POOL_SIZE,
): BulletLanePoolSimulationResult {
  interface SimBullet extends PooledSlot {
    id: number;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    damage: number;
  }

  let createdCount = 0;
  const uniqueSlots = new Set<SimBullet>();
  const pool = createFixedObjectPool<SimBullet>({
    name: 'BulletLane14',
    peakCapacity: poolCapacity,
    createSlot: (index) => {
      createdCount++;
      return {
        id: index,
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        damage: 0,
      };
    },
    resetSlot: (slot) => {
      slot.x = 0;
      slot.y = 0;
      slot.z = 0;
      slot.vx = 0;
      slot.vy = 0;
      slot.vz = 0;
      slot.life = 1.25;
      slot.damage = 10;
    },
    deactivateSlot: (slot) => {
      slot.life = 0;
      slot.vx = 0;
      slot.vy = 0;
      slot.vz = 0;
    },
  });

  const preallocatedAtStart = createdCount;
  const inFlightQueue: SimBullet[] = [];

  for (let shot = 0; shot < totalShots; shot++) {
    // When in-flight bullets reach their range/lifetime limit, mark the oldest inactive on death
    if (inFlightQueue.length >= poolCapacity) {
      const expired = inFlightQueue.shift()!;
      pool.release(expired);
    }
    const bullet = pool.acquire((b) => {
      b.x = shot * 0.5;
      b.vx = 42;
      b.life = 1.25;
      b.damage = 12;
    });
    if (bullet) {
      uniqueSlots.add(bullet);
      inFlightQueue.push(bullet);
    }
  }

  while (inFlightQueue.length > 0) {
    pool.release(inFlightQueue.shift()!);
  }

  return {
    totalShots,
    poolCapacity,
    unpooledAllocations: totalShots,
    unpooledGarbageDiscarded: totalShots,
    unpooledGcPauseStalls: Math.max(1, Math.floor(totalShots / poolCapacity)),
    pooledPreallocatedSlots: preallocatedAtStart,
    pooledRuntimeAllocations: createdCount - preallocatedAtStart,
    pooledGarbageDiscarded: 0,
    pooledGcPauseStalls: 0,
    pooledUniqueSlotsUsed: uniqueSlots.size,
    pooledRecycledSpawns: Math.max(0, totalShots - uniqueSlots.size),
    pooledExhaustionWarnings: pool.exhaustionWarnings,
  };
}

export interface SolidCratePushResolution2D {
  collided: boolean;
  moverX: number;
  moverZ: number;
  moverVx: number;
  moverVz: number;
  crateX: number;
  crateZ: number;
  crateVx: number;
  crateVz: number;
  angularImpulse: number;
  impactSpeed: number;
  normalX: number;
  normalZ: number;
  scaleX: 1;
  scaleY: 1;
  scaleZ: 1;
}

/**
 * Resolves a rigid 2D OBB (Oriented Bounding Box) solid-box collision when a character or vehicle
 * pushes or bumps into a grounded crate.
 * - Uses true square/box geometry (`crateHalfExtent`) in the crate's rotated frame (`crateRotY`)
 *   so all 4 flat faces of the box feel solid and flat when pushed.
 * - Enforces 100% rigid separation so the mover never clips inside the crate.
 * - Computes lever-arm torque so pushing the center of a face slides the box straight without spinning,
 *   while pushing a corner turns the box naturally.
 * - Strictly preserves rigid scale `(1, 1, 1)` (never squashes or deforms like jelly).
 */
export function resolveSolidCratePush2D(
  moverX: number,
  moverZ: number,
  moverVx: number,
  moverVz: number,
  moverRadius: number,
  moverMass: number,
  crateX: number,
  crateZ: number,
  crateVx: number,
  crateVz: number,
  crateRotY: number,
  crateHalfExtent = 0.68,
  crateMass = 1.85,
  restitution = 0.22,
): SolidCratePushResolution2D {
  const dx = moverX - crateX;
  const dz = moverZ - crateZ;

  // Quick bounding-circle reject
  const maxReach = moverRadius + crateHalfExtent * 1.45;
  if (dx * dx + dz * dz >= maxReach * maxReach) {
    return {
      collided: false,
      moverX,
      moverZ,
      moverVx,
      moverVz,
      crateX,
      crateZ,
      crateVx,
      crateVz,
      angularImpulse: 0,
      impactSpeed: 0,
      normalX: 0,
      normalZ: 1,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    };
  }

  const c = Math.cos(-crateRotY);
  const s = Math.sin(-crateRotY);
  const localX = dx * c - dz * s;
  const localZ = dx * s + dz * c;

  const clampedX = clamp(localX, -crateHalfExtent, crateHalfExtent);
  const clampedZ = clamp(localZ, -crateHalfExtent, crateHalfExtent);
  const diffX = localX - clampedX;
  const diffZ = localZ - clampedZ;
  const distSq = diffX * diffX + diffZ * diffZ;

  if (distSq >= moverRadius * moverRadius) {
    return {
      collided: false,
      moverX,
      moverZ,
      moverVx,
      moverVz,
      crateX,
      crateZ,
      crateVx,
      crateVz,
      angularImpulse: 0,
      impactSpeed: 0,
      normalX: 0,
      normalZ: 1,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    };
  }

  // Compute outward normal from crate -> mover in crate local space, then flip to point mover -> crate
  let localNx = 0;
  let localNz = 1;
  let overlap = 0;

  if (distSq > 1e-6) {
    const dist = Math.sqrt(distSq);
    // Push direction from mover toward crate is (-diffX / dist, -diffZ / dist)
    localNx = -diffX / dist;
    localNz = -diffZ / dist;
    overlap = moverRadius - dist + 0.006;
  } else {
    // Mover center penetrated inside the crate square: eject along nearest flat face
    const penX = crateHalfExtent - Math.abs(localX);
    const penZ = crateHalfExtent - Math.abs(localZ);
    if (penX < penZ) {
      localNx = localX >= 0 ? -1 : 1;
      localNz = 0;
      overlap = penX + moverRadius + 0.006;
    } else {
      localNx = 0;
      localNz = localZ >= 0 ? -1 : 1;
      overlap = penZ + moverRadius + 0.006;
    }
  }

  // Rotate push normal (mover -> crate) back to world space
  const cw = Math.cos(crateRotY);
  const sw = Math.sin(crateRotY);
  const pushNx = localNx * cw - localNz * sw;
  const pushNz = localNx * sw + localNz * cw;

  const safeMoverMass = Math.max(0.2, moverMass);
  const safeCrateMass = Math.max(0.2, crateMass);
  const totalMass = safeMoverMass + safeCrateMass;
  // Heavy vehicles displace the crate almost 100%; characters share rigid separation so feet/hands never clip inside
  const moverShare = moverMass >= 8 ? 0.08 : clamp(safeCrateMass / totalMass, 0.25, 0.48);
  const crateShare = 1 - moverShare;

  const nextMoverX = moverX - pushNx * overlap * moverShare;
  const nextMoverZ = moverZ - pushNz * overlap * moverShare;
  const nextCrateX = crateX + pushNx * overlap * crateShare;
  const nextCrateZ = crateZ + pushNz * overlap * crateShare;

  const relVx = moverVx - crateVx;
  const relVz = moverVz - crateVz;
  const closingSpeed = relVx * pushNx + relVz * pushNz;

  // Lever arm in crate local space: pushing near the center of a face gives ~0 torque (slides straight!)
  const leverArm = clampedX * localNz - clampedZ * localNx;
  const torqueFactor = Math.abs(leverArm) < crateHalfExtent * 0.28 ? 0 : leverArm / crateHalfExtent;

  if (closingSpeed <= 0) {
    const steadyPushSpeed = Math.max(2.4, Math.hypot(moverVx, moverVz) * 0.88);
    return {
      collided: true,
      moverX: nextMoverX,
      moverZ: nextMoverZ,
      moverVx,
      moverVz,
      crateX: nextCrateX,
      crateZ: nextCrateZ,
      crateVx: crateVx + pushNx * steadyPushSpeed,
      crateVz: crateVz + pushNz * steadyPushSpeed,
      angularImpulse: clamp(torqueFactor * steadyPushSpeed * 0.65, -3.5, 3.5),
      impactSpeed: steadyPushSpeed,
      normalX: pushNx,
      normalZ: pushNz,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    };
  }

  const e = clamp(restitution, 0.05, 0.6);
  const impulseMag = ((1 + e) * closingSpeed) / (1 / safeMoverMass + 1 / safeCrateMass);
  const pushBoost = moverMass >= 8 ? 1.35 : 1.15;
  const nextCrateVx = crateVx + (impulseMag / safeCrateMass) * pushNx * pushBoost;
  const nextCrateVz = crateVz + (impulseMag / safeCrateMass) * pushNz * pushBoost;
  const moverDrag = moverMass >= 8 ? 0.12 : 0.42;
  const nextMoverVx = moverVx - (impulseMag / safeMoverMass) * pushNx * moverDrag;
  const nextMoverVz = moverVz - (impulseMag / safeMoverMass) * pushNz * moverDrag;

  return {
    collided: true,
    moverX: nextMoverX,
    moverZ: nextMoverZ,
    moverVx: nextMoverVx,
    moverVz: nextMoverVz,
    crateX: nextCrateX,
    crateZ: nextCrateZ,
    crateVx: nextCrateVx,
    crateVz: nextCrateVz,
    angularImpulse: clamp(torqueFactor * closingSpeed * 0.55, -4.0, 4.0),
    impactSpeed: closingSpeed,
    normalX: pushNx,
    normalZ: pushNz,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
  };
}

export interface CrateVsCrateResolution2D {
  collided: boolean;
  ax: number;
  az: number;
  avx: number;
  avz: number;
  bx: number;
  bz: number;
  bvx: number;
  bvz: number;
  impactSpeed: number;
}

/**
 * Resolves rigid solid-box collision between two grounded crates when a thrown or pushed crate
 * strikes another crate on the field, separating them without overlap and transferring momentum.
 */
export function resolveCrateVsCrateCollision2D(
  ax: number,
  az: number,
  avx: number,
  avz: number,
  bx: number,
  bz: number,
  bvx: number,
  bvz: number,
  minDistance = 1.34,
  restitution = 0.34,
): CrateVsCrateResolution2D {
  const dx = bx - ax;
  const dz = bz - az;
  const distSq = dx * dx + dz * dz;
  if (distSq >= minDistance * minDistance) {
    return {
      collided: false,
      ax,
      az,
      avx,
      avz,
      bx,
      bz,
      bvx,
      bvz,
      impactSpeed: 0,
    };
  }

  const dist = Math.sqrt(distSq);
  const nx = dist > 1e-5 ? dx / dist : 1;
  const nz = dist > 1e-5 ? dz / dist : 0;
  const overlap = minDistance - dist + 0.005;

  const nextAx = ax - nx * overlap * 0.5;
  const nextAz = az - nz * overlap * 0.5;
  const nextBx = bx + nx * overlap * 0.5;
  const nextBz = bz + nz * overlap * 0.5;

  const relVx = avx - bvx;
  const relVz = avz - bvz;
  const closingSpeed = relVx * nx + relVz * nz;

  if (closingSpeed <= 0) {
    return {
      collided: true,
      ax: nextAx,
      az: nextAz,
      avx,
      avz,
      bx: nextBx,
      bz: nextBz,
      bvx: bvx + nx * 1.2,
      bvz: bvz + nz * 1.2,
      impactSpeed: 1.2,
    };
  }

  const e = clamp(restitution, 0.1, 0.8);
  const j = 0.5 * (1 + e) * closingSpeed;

  return {
    collided: true,
    ax: nextAx,
    az: nextAz,
    avx: avx - j * nx * 0.75,
    avz: avz - j * nz * 0.75,
    bx: nextBx,
    bz: nextBz,
    bvx: bvx + j * nx * 1.05,
    bvz: bvz + j * nz * 1.05,
    impactSpeed: closingSpeed,
  };
}

// ============================================================================
// MODERN URBAN STREET TRAM (100% LOW-FLOOR LRV — 1 RANGKAIAN 2 GERBONG)
// Closed-LoopFilleted Road Track & Dual-Bogie Articulated Consist Kinematics
// ============================================================================

export interface CityTramCornerWaypoint {
  x: number;
  z: number;
  filletRadius: number;
}

export interface CityTramTrackSample {
  x: number;
  z: number;
  tangentX: number;
  tangentZ: number;
  yaw: number;
  curvature: number;
  distance: number;
  totalTrackLength: number;
}

export interface CityTramCarPose {
  x: number;
  z: number;
  yaw: number;
  forwardX: number;
  forwardZ: number;
  frontBogieX: number;
  frontBogieZ: number;
  frontBogieYaw: number;
  rearBogieX: number;
  rearBogieZ: number;
  rearBogieYaw: number;
  frontCouplerX: number;
  frontCouplerZ: number;
  rearCouplerX: number;
  rearCouplerZ: number;
}

export interface CityTramArticulationPose {
  x: number;
  z: number;
  yaw: number;
  articulationAngle: number;
  spanLength: number;
}

export interface CityTramConsistState {
  car1: CityTramCarPose;
  car2: CityTramCarPose;
  joint: CityTramArticulationPose;
  leadDistance: number;
  totalTrackLength: number;
}

/**
 * Proportions of the Enlarged 2-Car Low-Floor Urban Street Tram (`1 rangkaian 2 gerbong`),
 * scaled up 1.25x (4.42m roof height, 3.58m width, 9.00m car length, 19.50m total consist length)
 * and paired with wide R=8.0m road curves so the 2-car consist turns smoothly without kinking ("tidak patah").
 */
export const CITY_TRAM_SPEC = {
  carCount: 2,
  carLength: 9.00,
  carWidth: 3.58,
  carHeight: 4.42,
  carBogieSpan: 5.625,
  jointLength: 1.50,
  carCenterSpacing: 10.50, // carLength (9.00) + jointLength (1.50)
  cruiseSpeed: 8.2,
  railGauge: 1.80,
} as const;

const CITY_TRAM_CORNER_WAYPOINTS: readonly CityTramCornerWaypoint[] = [
  { x: -70.0, z: -52.0, filletRadius: 8.0 }, // NW Highway-Collector Curve (exact R=8.0m road arc)
  { x: 70.0, z: -52.0, filletRadius: 8.0 },  // NE Collector-East Highway Curve (exact R=8.0m road arc)
  { x: 70.0, z: 52.0, filletRadius: 8.0 },   // SE East Highway-Collector Curve (exact R=8.0m road arc)
  { x: -70.0, z: 52.0, filletRadius: 8.0 },  // SW Collector-Highway Curve (exact R=8.0m road arc)
];

interface CompiledTramSegment {
  kind: 'line' | 'arc';
  startDist: number;
  length: number;
  // For 'line':
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  ux: number;
  uz: number;
  // For 'arc':
  cx: number;
  cz: number;
  radius: number;
  startAngle: number;
  deltaAngle: number; // signed angle sweep
}

let cachedTramTrack: {
  segments: CompiledTramSegment[];
  totalLength: number;
} | null = null;

function compileCityTramTrack(): {
  segments: CompiledTramSegment[];
  totalLength: number;
} {
  if (cachedTramTrack) return cachedTramTrack;

  const pts = CITY_TRAM_CORNER_WAYPOINTS;
  const n = pts.length;

  interface CornerFilletGeom {
    entryX: number;
    entryZ: number;
    exitX: number;
    exitZ: number;
    cx: number;
    cz: number;
    radius: number;
    startAngle: number;
    deltaAngle: number;
    arcLength: number;
  }

  const fillets: CornerFilletGeom[] = [];

  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];

    const inDx = curr.x - prev.x;
    const inDz = curr.z - prev.z;
    const inLen = Math.hypot(inDx, inDz);
    const uInX = inDx / inLen;
    const uInZ = inDz / inLen;

    const outDx = next.x - curr.x;
    const outDz = next.z - curr.z;
    const outLen = Math.hypot(outDx, outDz);
    const uOutX = outDx / outLen;
    const uOutZ = outDz / outLen;

    const dot = clamp(uInX * uOutX + uInZ * uOutZ, -0.9999, 0.9999);
    const turnAngle = Math.acos(dot); // angle between incoming and outgoing tangent vectors
    const r = curr.filletRadius;
    const tanDist = r * Math.tan(turnAngle * 0.5);

    const entryX = curr.x - uInX * tanDist;
    const entryZ = curr.z - uInZ * tanDist;
    const exitX = curr.x + uOutX * tanDist;
    const exitZ = curr.z + uOutZ * tanDist;

    // Cross product in XZ plane: cross > 0 means turning right (+Z from +X), cross < 0 means turning left
    const cross = uInX * uOutZ - uInZ * uOutX;
    const sign = cross >= 0 ? 1 : -1;

    // Normal from entry point toward arc center (perpendicular to uIn in turn direction)
    const nInX = -sign * uInZ;
    const nInZ = sign * uInX;
    const cx = entryX + nInX * r;
    const cz = entryZ + nInZ * r;

    const startAngle = Math.atan2(entryZ - cz, entryX - cx);
    const deltaAngle = sign * turnAngle;
    const arcLength = r * turnAngle;

    fillets.push({
      entryX,
      entryZ,
      exitX,
      exitZ,
      cx,
      cz,
      radius: r,
      startAngle,
      deltaAngle,
      arcLength,
    });
  }

  const segments: CompiledTramSegment[] = [];
  let accumDist = 0;

  for (let i = 0; i < n; i++) {
    const prevFillet = fillets[(i - 1 + n) % n];
    const currFillet = fillets[i];

    // 1. Straight segment from prevFillet.exit to currFillet.entry
    const dx = currFillet.entryX - prevFillet.exitX;
    const dz = currFillet.entryZ - prevFillet.exitZ;
    const lineLen = Math.hypot(dx, dz);
    if (lineLen > 1e-4) {
      segments.push({
        kind: 'line',
        startDist: accumDist,
        length: lineLen,
        x0: prevFillet.exitX,
        z0: prevFillet.exitZ,
        x1: currFillet.entryX,
        z1: currFillet.entryZ,
        ux: dx / lineLen,
        uz: dz / lineLen,
        cx: 0,
        cz: 0,
        radius: 0,
        startAngle: 0,
        deltaAngle: 0,
      });
      accumDist += lineLen;
    }

    // 2. Circular arc segment at corner i
    if (currFillet.arcLength > 1e-4) {
      segments.push({
        kind: 'arc',
        startDist: accumDist,
        length: currFillet.arcLength,
        x0: currFillet.entryX,
        z0: currFillet.entryZ,
        x1: currFillet.exitX,
        z1: currFillet.exitZ,
        ux: 0,
        uz: 0,
        cx: currFillet.cx,
        cz: currFillet.cz,
        radius: currFillet.radius,
        startAngle: currFillet.startAngle,
        deltaAngle: currFillet.deltaAngle,
      });
      accumDist += currFillet.arcLength;
    }
  }

  cachedTramTrack = {
    segments,
    totalLength: accumDist,
  };
  return cachedTramTrack;
}

/**
 * Samples the closed-loop filleted city tram track at any travel distance `distanceMeters` (wraps modulo loop length).
 */
export function sampleCityTramTrackAtDistance(distanceMeters: number): CityTramTrackSample {
  const { segments, totalLength } = compileCityTramTrack();
  let d = distanceMeters % totalLength;
  if (d < 0) d += totalLength;

  let seg = segments[segments.length - 1];
  for (let i = 0; i < segments.length; i++) {
    const candidate = segments[i];
    if (d <= candidate.startDist + candidate.length || i === segments.length - 1) {
      seg = candidate;
      break;
    }
  }

  const localS = clamp(d - seg.startDist, 0, seg.length);
  if (seg.kind === 'line') {
    const x = seg.x0 + seg.ux * localS;
    const z = seg.z0 + seg.uz * localS;
    const yaw = Math.atan2(-seg.uz, seg.ux);
    return {
      x,
      z,
      tangentX: seg.ux,
      tangentZ: seg.uz,
      yaw,
      curvature: 0,
      distance: d,
      totalTrackLength: totalLength,
    };
  }

  const t = seg.length > 1e-5 ? localS / seg.length : 0;
  const angle = seg.startAngle + seg.deltaAngle * t;
  const x = seg.cx + Math.cos(angle) * seg.radius;
  const z = seg.cz + Math.sin(angle) * seg.radius;
  const sign = seg.deltaAngle >= 0 ? 1 : -1;
  const tangentX = -sign * Math.sin(angle);
  const tangentZ = sign * Math.cos(angle);
  const yaw = Math.atan2(-tangentZ, tangentX);

  return {
    x,
    z,
    tangentX,
    tangentZ,
    yaw,
    curvature: sign / seg.radius,
    distance: d,
    totalTrackLength: totalLength,
  };
}

function evaluateArticulatedTramCarPose(
  coupledEndDist: number,
  isFrontCar: boolean,
): CityTramCarPose {
  const carLen = CITY_TRAM_SPEC.carLength;
  const halfCar = carLen * 0.5;
  const scaleL = carLen / 7.20;
  const endOverhang = 1.35 * scaleL; // Distance from outer nose/tail tip to outer bogie
  const innerBogieOffset = 1.35 * scaleL; // Distance from coupled articulation end to inner bogie
  const chordSpan = carLen - endOverhang; // Span from coupled end pin to outer bogie pin

  // Pin the coupled articulation end AND the outer bogie directly on the smooth road curve!
  // This guarantees zero lateral shear ("tidak patah") between Car 1, the Accordion Joint, and Car 2.
  const coupledPin = sampleCityTramTrackAtDistance(coupledEndDist);
  const outerBogieSample = sampleCityTramTrackAtDistance(
    isFrontCar ? coupledEndDist + chordSpan : coupledEndDist - chordSpan,
  );
  const innerBogieSample = sampleCityTramTrackAtDistance(
    isFrontCar ? coupledEndDist + innerBogieOffset : coupledEndDist - innerBogieOffset,
  );

  const dx = isFrontCar
    ? outerBogieSample.x - coupledPin.x
    : coupledPin.x - outerBogieSample.x;
  const dz = isFrontCar
    ? outerBogieSample.z - coupledPin.z
    : coupledPin.z - outerBogieSample.z;
  const len = Math.max(1e-5, Math.hypot(dx, dz));
  const forwardX = dx / len;
  const forwardZ = dz / len;
  const yaw = Math.atan2(-forwardZ, forwardX);

  const x = isFrontCar
    ? coupledPin.x + forwardX * halfCar
    : coupledPin.x - forwardX * halfCar;
  const z = isFrontCar
    ? coupledPin.z + forwardZ * halfCar
    : coupledPin.z - forwardZ * halfCar;

  const frontBogie = isFrontCar ? outerBogieSample : innerBogieSample;
  const rearBogie = isFrontCar ? innerBogieSample : outerBogieSample;

  return {
    x,
    z,
    yaw,
    forwardX,
    forwardZ,
    frontBogieX: frontBogie.x,
    frontBogieZ: frontBogie.z,
    frontBogieYaw: shortestAngleDelta(yaw, frontBogie.yaw),
    rearBogieX: rearBogie.x,
    rearBogieZ: rearBogie.z,
    rearBogieYaw: shortestAngleDelta(yaw, rearBogie.yaw),
    frontCouplerX: x + forwardX * halfCar,
    frontCouplerZ: z + forwardZ * halfCar,
    rearCouplerX: x - forwardX * halfCar,
    rearCouplerZ: z - forwardZ * halfCar,
  };
}

/**
 * Evaluates the complete 2-Car Articulated City Tram (`1 rangkaian 2 gerbong`) pose at `leadDistanceMeters`:
 * - Both `car1.rearCoupler` and `car2.frontCoupler` are pinned directly onto the smooth road curve at
 *   `jointCenterDist ± jointLength * 0.5`, eliminating any lateral shear or kink ("tidak patah saat berbelok").
 */
export function evaluateCityTramConsistState(leadDistanceMeters: number): CityTramConsistState {
  const { totalLength } = compileCityTramTrack();
  const halfCar = CITY_TRAM_SPEC.carLength * 0.5;
  const halfJoint = CITY_TRAM_SPEC.jointLength * 0.5;
  const jointCenterDist = leadDistanceMeters - halfCar - halfJoint;

  const car1 = evaluateArticulatedTramCarPose(jointCenterDist + halfJoint, true);
  const car2 = evaluateArticulatedTramCarPose(jointCenterDist - halfJoint, false);
  const jointCenter = sampleCityTramTrackAtDistance(jointCenterDist);

  const jDx = car1.rearCouplerX - car2.frontCouplerX;
  const jDz = car1.rearCouplerZ - car2.frontCouplerZ;
  const spanLength = Math.hypot(jDx, jDz);
  const articulationAngle = shortestAngleDelta(car2.yaw, car1.yaw);

  let wrappedDist = leadDistanceMeters % totalLength;
  if (wrappedDist < 0) wrappedDist += totalLength;

  return {
    car1,
    car2,
    joint: {
      x: jointCenter.x,
      z: jointCenter.z,
      yaw: jointCenter.yaw,
      articulationAngle,
      spanLength,
    },
    leadDistance: wrappedDist,
    totalTrackLength: totalLength,
  };
}

// ============================================================================
// 4v4 INDIVIDUAL BASE PROGRESSION (LV.1-3 BUILDING, LV.1-3 IRON FENCE,
// BUILDABLE PARKING & HELIPAD) + MODULAR SKIN & GARDEN COSMETIC SYSTEM
// ============================================================================

export type BaseSkinThemeId = 'military_standard' | 'cyber_neon' | 'desert_ops' | 'royal_gold';
export type BaseGardenPresetId = 'sakura_grove' | 'zen_rock' | 'golden_park' | 'tactical_plaza';

export interface BaseSkinThemeSpec {
  id: BaseSkinThemeId;
  name: string;
  wallPrimaryHex: string;
  wallSecondaryHex: string;
  roofHex: string;
  fenceMetalHex: string;
  fenceAccentHex: string;
}

export const BASE_SKIN_THEMES: Record<BaseSkinThemeId, BaseSkinThemeSpec> = {
  military_standard: {
    id: 'military_standard',
    name: 'Military Olive Standard',
    wallPrimaryHex: '#a49e7e',
    wallSecondaryHex: '#78755a',
    roofHex: '#6c7058',
    fenceMetalHex: '#383d38',
    fenceAccentHex: '#8f8b78',
  },
  cyber_neon: {
    id: 'cyber_neon',
    name: 'Cyber Neon Ops',
    wallPrimaryHex: '#2b3548',
    wallSecondaryHex: '#1e293b',
    roofHex: '#0f172a',
    fenceMetalHex: '#1e293b',
    fenceAccentHex: '#00d2ff',
  },
  desert_ops: {
    id: 'desert_ops',
    name: 'Desert Storm Sand',
    wallPrimaryHex: '#d4b886',
    wallSecondaryHex: '#a68958',
    roofHex: '#8c7248',
    fenceMetalHex: '#5c4d38',
    fenceAccentHex: '#e2c792',
  },
  royal_gold: {
    id: 'royal_gold',
    name: 'Royal Gold Commander',
    wallPrimaryHex: '#f4f1e6',
    wallSecondaryHex: '#d4a536',
    roofHex: '#272a34',
    fenceMetalHex: '#2c2f3a',
    fenceAccentHex: '#f59e0b',
  },
};

export const BASE_GARDEN_PRESETS: ReadonlyArray<{ id: BaseGardenPresetId; name: string }> = [
  { id: 'sakura_grove', name: 'Purple Sakura Garden' },
  { id: 'zen_rock', name: 'Zen Rock & Lawn Garden' },
  { id: 'golden_park', name: 'Golden Tree & Bench Park' },
  { id: 'tactical_plaza', name: 'Tactical Minimalist Plaza' },
];

export const INDIVIDUAL_BASE_LEVEL_SPECS = {
  /** 4 Individual Base Plots lined up along the complex avenue, separated by 3 Complex Roads at x = -30, 0, +30 */
  basePlotCentersX: [-45.0, -15.0, 15.0, 45.0] as const,
  complexDividerRoadX: [-30.0, 0.0, 30.0] as const,
  blueBaseCenterZ: 80.0,
  redBaseCenterZ: -80.0,
  plotWidth: 21.0,
  plotDepth: 34.0,
  /** Main Building HP by Level (Lv.1 Field Barracks -> Lv.2 Command HQ -> Lv.3 Heavy Command Center) */
  buildingMaxHpByLevel: [500, 1000, 1800] as const,
  buildingNameByLevel: [
    'Lv.1 Starter Outpost',
    'Lv.2 Tactical Ops HQ',
    'Lv.3 Command Center',
  ] as const,
  /** Iron Fence durability per segment & total perimeter durability by Level (Lv.1 -> Lv.2 -> Lv.3) */
  fenceSegmentHpByLevel: [150, 350, 700] as const,
  fenceTotalMaxHpByLevel: [600, 1400, 2800] as const,
  fenceNameByLevel: [
    'Lv.1 Light Iron Fence',
    'Lv.2 Reinforced Steel Fence',
    'Lv.3 Bastion Armored Fence',
  ] as const,
  /** Highway asphalt color used inside every base plot ("gunakan warna aspal seperti di jalan raya") */
  highwayAsphaltHex: '#7a8490',
  highwayCurbHex: '#aba69c',
} as const;

export const COMMANDER_PLOT_OFFSETS_X = INDIVIDUAL_BASE_LEVEL_SPECS.basePlotCentersX;

export interface IndividualCommanderBaseState {
  team: 'blue' | 'red';
  commanderIdx: number;
  commanderIndex: number;
  plotCenterX: number;
  plotCenterZ: number;
  padX: number;
  padZ: number;
  buildingX: number;
  buildingZ: number;
  helipadX: number;
  helipadZ: number;
  parkingX: number;
  parkingZ: number;
  buildingLevel: 1 | 2 | 3;
  /** Personal Command Center radar level (Lv.1 = 45% map, Lv.2 = 75% map, Lv.3 = 100% map), upgraded via Kiosk with Gold */
  commandCenterLevel: 1 | 2 | 3;
  buildingHp: number;
  buildingMaxHp: number;
  fenceLevel: 1 | 2 | 3;
  fenceHp: number;
  fenceMaxHp: number;
  hasParkingBay: boolean;
  hasHelipad: boolean;
  hasSkyshield: boolean;
  destroyed: boolean;
  skinTheme: BaseSkinThemeId;
  gardenPreset: BaseGardenPresetId;
  /** True for the permanent Bottom-Left Model Estate (blue plot 0) */
  isModelEstate?: boolean;
  /** True when this plot is either the permanent Model Estate OR actively claimed by an online NEAR NFT Gamepass holder */
  isClaimedOnlineSession?: boolean;
  /** Connected .near account ID of the online session owner (or null if unclaimed grass lot) */
  claimedByNearAccount?: string | null;
  claimedByNearWallet?: string | null;
  /** Safezone City plot gate access mode ('PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE') */
  safezoneAccessMode?: SafezonePlotAccessMode;
  /** Allowed friend wallet/IDs when safezoneAccessMode === 'FRIENDS_ONLY' */
  safezoneAllowedFriends?: string[];
}

export type SafezonePlotAccessMode = 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE';
export type WorldMode = 'lobby' | 'warzone' | 'safezone';

export const MODEL_ESTATE_BASE_PLOT_SPEC = {
  team: 'blue' as const,
  commanderIdx: 0 as const,
  plotCenterX: -45.0,
  plotCenterZ: 81.7,
} as const;

/**
 * Returns true ONLY for the single intact Bottom-Left Base ("Base Kiri Bawah" / "Contoh Properti / Model Estate").
 * All other base areas in the arena start as empty green grass lots with a standalone Kiosk machine.
 */
export function isIntactModelEstateBasePlot(team: 'blue' | 'red', commanderIdx: number): boolean {
  return team === MODEL_ESTATE_BASE_PLOT_SPEC.team && commanderIdx === MODEL_ESTATE_BASE_PLOT_SPEC.commanderIdx;
}

/**
 * Returns true if a base plot has active 3D buildings, fences, turret, stacking pad, and colliders:
 * - Always true for the permanent Bottom-Left Model Estate (`blue` plot 0)
 * - True for any of the other 7 grass lots ONLY while claimed online by a NEAR NFT Gamepass holder (`isClaimedOnlineSession === true`).
 */
export function isCommanderBasePlotActive(
  plot:
    | Pick<IndividualCommanderBaseState, 'team' | 'commanderIdx' | 'isClaimedOnlineSession' | 'isModelEstate'>
    | undefined,
): boolean {
  if (!plot) return false;
  if (isIntactModelEstateBasePlot(plot.team, plot.commanderIdx) || plot.isModelEstate) {
    return true;
  }
  return Boolean(plot.isClaimedOnlineSession);
}

export function createIndividualCommanderBasesState(
  team: 'blue' | 'red',
): IndividualCommanderBaseState[] {
  const sign = team === 'blue' ? 1 : -1;
  const centerZ = team === 'blue'
    ? INDIVIDUAL_BASE_LEVEL_SPECS.blueBaseCenterZ
    : INDIVIDUAL_BASE_LEVEL_SPECS.redBaseCenterZ;

  return INDIVIDUAL_BASE_LEVEL_SPECS.basePlotCentersX.map((rawX, idx) => {
    const plotCenterX = sign * rawX;
    const plotCenterZ = centerZ;
    const isModelEstate = isIntactModelEstateBasePlot(team, idx);
    return {
      team,
      commanderIdx: idx,
      commanderIndex: idx,
      plotCenterX,
      plotCenterZ,
      // Compact 2x2 (4-column) Stacking Pad flush against the right fence (relZ = +7.3) of the plot
      padX: plotCenterX + sign * 7.3,
      padZ: plotCenterZ - sign * 2.2,
      // Single Upgradeable Main Building at the rear-center of the plot
      buildingX: plotCenterX,
      buildingZ: plotCenterZ + sign * 8.2,
      // Buildable Helipad on the left bay (relZ = -5.8) of the plot
      helipadX: plotCenterX - sign * 5.8,
      helipadZ: plotCenterZ - sign * 4.2,
      // Buildable Vehicle Parking Bay beside Helipad in the left bay (relZ = -5.2, lx = 15.0)
      parkingX: plotCenterX - sign * 5.2,
      parkingZ: plotCenterZ - sign * 4.2 + sign * 4.8,
      buildingLevel: 1,
      commandCenterLevel: 1,
      buildingHp: INDIVIDUAL_BASE_LEVEL_SPECS.buildingMaxHpByLevel[0],
      buildingMaxHp: INDIVIDUAL_BASE_LEVEL_SPECS.buildingMaxHpByLevel[0],
      fenceLevel: 1,
      fenceHp: INDIVIDUAL_BASE_LEVEL_SPECS.fenceTotalMaxHpByLevel[0],
      fenceMaxHp: INDIVIDUAL_BASE_LEVEL_SPECS.fenceTotalMaxHpByLevel[0],
      hasParkingBay: false,
      hasHelipad: false,
      hasSkyshield: true,
      destroyed: false,
      skinTheme: 'military_standard',
      gardenPreset: 'sakura_grove',
      isModelEstate,
      isClaimedOnlineSession: isModelEstate,
      claimedByNearAccount: isModelEstate ? 'model-estate.buddiesblitz.near' : null,
      claimedByNearWallet: isModelEstate ? 'model-estate.buddiesblitz.near' : null,
      safezoneAccessMode: 'PUBLIC',
      safezoneAllowedFriends: [],
    };
  });
}

export function applyCommanderBaseUpgrade(
  base: IndividualCommanderBaseState,
  upgradeKind: 'upgrade_building' | 'upgrade_fence' | 'build_parking' | 'build_helipad',
  crateCount: number,
): { upgraded: boolean; message: string } {
  if (base.destroyed || crateCount < 2) {
    return { upgraded: false, message: 'Requires at least 2 Crates on the Pad!' };
  }

  if (upgradeKind === 'upgrade_building') {
    if (base.buildingLevel < 3) {
      const nextLv = (base.buildingLevel + 1) as 2 | 3;
      const nextMax = INDIVIDUAL_BASE_LEVEL_SPECS.buildingMaxHpByLevel[nextLv - 1];
      base.buildingLevel = nextLv;
      base.commandCenterLevel = nextLv;
      base.buildingMaxHp = nextMax;
      base.buildingHp = nextMax;
      return {
        upgraded: true,
        message: `${INDIVIDUAL_BASE_LEVEL_SPECS.buildingNameByLevel[nextLv - 1]} (${nextMax} HP)!`,
      };
    }
    // Already Lv.3 -> Repair building HP to full
    base.commandCenterLevel = 3;
    base.buildingHp = base.buildingMaxHp;
    return { upgraded: true, message: 'Command Center Lv.3 Fully Repaired!' };
  }

  if (upgradeKind === 'upgrade_fence') {
    if (base.fenceLevel < 3) {
      const nextLv = (base.fenceLevel + 1) as 2 | 3;
      const nextMax = INDIVIDUAL_BASE_LEVEL_SPECS.fenceTotalMaxHpByLevel[nextLv - 1];
      base.fenceLevel = nextLv;
      base.fenceMaxHp = nextMax;
      base.fenceHp = nextMax;
      return {
        upgraded: true,
        message: `${INDIVIDUAL_BASE_LEVEL_SPECS.fenceNameByLevel[nextLv - 1]} (${INDIVIDUAL_BASE_LEVEL_SPECS.fenceSegmentHpByLevel[nextLv - 1]} HP/Segment)!`,
      };
    }
    base.fenceHp = base.fenceMaxHp;
    return { upgraded: true, message: 'Iron Fence Lv.3 Fully Repaired!' };
  }

  if (upgradeKind === 'build_parking') {
    base.hasParkingBay = true;
    return { upgraded: true, message: 'Vehicle Parking Bay Constructed!' };
  }

  if (upgradeKind === 'build_helipad') {
    base.hasHelipad = true;
    return { upgraded: true, message: 'Helipad (H) Constructed!' };
  }

  return { upgraded: false, message: '' };
}

export function isTeamAllBasesDestroyed(bases: ReadonlyArray<IndividualCommanderBaseState>): boolean {
  return bases.length > 0 && bases.every((b) => b.destroyed || b.buildingHp <= 0);
}

/**
 * Checks whether a character at `(unitX, unitZ)` can board the City Tram at its current live position
 * anywhere along the loop ("trem bisa di naiki di manapun dan turun di manapun").
 * Evaluates OBB proximity to both Car 1 (`carIndex = 0`) and Car 2 (`carIndex = 1`).
 */
export function canUnitBoardCityTramAtAnyPoint(
  unitX: number,
  unitZ: number,
  tramState: CityTramConsistState,
  maxBoardMarginMeters = 2.8,
): { canBoard: boolean; carIndex: 0 | 1; distanceMeters: number } {
  const halfLen = CITY_TRAM_SPEC.carLength * 0.5;
  const halfWid = CITY_TRAM_SPEC.carWidth * 0.5;
  const cars: [CityTramCarPose, 0 | 1][] = [
    [tramState.car1, 0],
    [tramState.car2, 1],
  ];

  let bestCarIdx: 0 | 1 = 0;
  let bestDist = Infinity;

  for (const [car, idx] of cars) {
    const dx = unitX - car.x;
    const dz = unitZ - car.z;
    const rightX = -car.forwardZ;
    const rightZ = car.forwardX;
    const localLong = Math.abs(dx * car.forwardX + dz * car.forwardZ);
    const localLat = Math.abs(dx * rightX + dz * rightZ);
    const exLong = Math.max(0, localLong - halfLen);
    const exLat = Math.max(0, localLat - halfWid);
    const obbDist = Math.hypot(exLong, exLat);
    if (obbDist < bestDist) {
      bestDist = obbDist;
      bestCarIdx = idx;
    }
  }

  return {
    canBoard: bestDist <= maxBoardMarginMeters,
    carIndex: bestCarIdx,
    distanceMeters: bestDist,
  };
}

/**
 * Computes a clean roadside alighting/disembark coordinate beside the given tram car
 * so the player can step off anywhere along the track without overlapping the tram hull.
 */
export function computeCityTramDisembarkPosition(
  carPose: CityTramCarPose,
  sideSign: -1 | 1 = 1,
): { x: number; z: number; yaw: number } {
  const rightX = -carPose.forwardZ;
  const rightZ = carPose.forwardX;
  const lateralOffset = CITY_TRAM_SPEC.carWidth * 0.5 + 1.25;
  return {
    x: carPose.x + rightX * (sideSign * lateralOffset),
    z: carPose.z + rightZ * (sideSign * lateralOffset),
    yaw: carPose.yaw,
  };
}

export function setSafezonePlotAccessMode(
  plot: IndividualCommanderBaseState,
  accessMode: SafezonePlotAccessMode,
): IndividualCommanderBaseState {
  plot.safezoneAccessMode = accessMode;
  if (!plot.safezoneAllowedFriends) {
    plot.safezoneAllowedFriends = [];
  }
  return plot;
}

export function addSafezonePlotFriend(
  plot: IndividualCommanderBaseState,
  friendWalletOrId: string,
): { added: boolean; friends: string[]; message: string } {
  const cleanId = friendWalletOrId.trim().toLowerCase();
  if (!plot.safezoneAllowedFriends) {
    plot.safezoneAllowedFriends = [];
  }
  if (!cleanId) {
    return {
      added: false,
      friends: [...plot.safezoneAllowedFriends],
      message: 'Friend ID / Wallet cannot be empty.',
    };
  }
  if (!plot.safezoneAllowedFriends.includes(cleanId)) {
    plot.safezoneAllowedFriends.push(cleanId);
  }
  return {
    added: true,
    friends: [...plot.safezoneAllowedFriends],
    message: `FRIEND ADDED: ${cleanId}`,
  };
}

export function removeSafezonePlotFriend(
  plot: IndividualCommanderBaseState,
  friendWalletOrId: string,
): { removed: boolean; friends: string[]; message: string } {
  const cleanId = friendWalletOrId.trim().toLowerCase();
  const prev = plot.safezoneAllowedFriends ?? [];
  const next = prev.filter((f) => f.toLowerCase() !== cleanId);
  plot.safezoneAllowedFriends = next;
  return {
    removed: next.length < prev.length,
    friends: [...next],
    message: `FRIEND REMOVED: ${cleanId}`,
  };
}

export function canUnitEnterSafezonePlotGate(params: {
  plot?:
    | Pick<
        IndividualCommanderBaseState,
        'team' | 'commanderIdx' | 'claimedByNearAccount' | 'safezoneAccessMode' | 'safezoneAllowedFriends'
      >
    | null;
  isPlotOwner: boolean;
  unitWalletOrId?: string | null;
}): boolean {
  const accessMode: SafezonePlotAccessMode = params.plot?.safezoneAccessMode ?? 'PUBLIC';
  if (accessMode === 'PUBLIC') {
    return true;
  }
  if (params.isPlotOwner) {
    return true;
  }
  if (accessMode === 'PRIVATE') {
    return false;
  }
  // FRIENDS_ONLY
  const cleanUnitId = (params.unitWalletOrId ?? '').trim().toLowerCase();
  if (!cleanUnitId) return false;
  const allowed = params.plot?.safezoneAllowedFriends ?? [];
  return allowed.some((f) => f.trim().toLowerCase() === cleanUnitId);
}

/**
 * Enforces per-plot Sliding Gate access control:
 * - In Warzone mode: ONLY the plot owner (`unitOwnerCommanderId === plotCommanderIdx`), their built/contract Harvesters,
 *   or the player who actively claimed that plot via NEAR NFT Gamepass (`claimedSession`) can open and enter the gate.
 * - In Safezone mode (`safezoneOptions?.isSafezoneMode === true`): enforces `PUBLIC` (all players),
 *   `FRIENDS_ONLY` (owner + `safezoneAllowedFriends`), and `PRIVATE` (owner only).
 */
export function canUnitEnterCommanderBaseGate(
  unitTeam: 'blue' | 'red',
  unitOwnerCommanderId: number,
  plotTeam: 'blue' | 'red',
  plotCommanderIdx: number,
  claimedSession?: {
    claimedTeam?: 'blue' | 'red' | null;
    claimedPlotIndex?: number | null;
    accountId?: string | null;
    walletId?: string | null;
  } | null,
  safezoneOptions?: {
    isSafezoneMode?: boolean;
    plot?:
      | Pick<
          IndividualCommanderBaseState,
          'team' | 'commanderIdx' | 'claimedByNearAccount' | 'safezoneAccessMode' | 'safezoneAllowedFriends'
        >
      | null;
    unitWalletOrId?: string | null;
    isPlotOwnerOverride?: boolean;
  } | null,
): boolean {
  if (safezoneOptions?.isSafezoneMode) {
    const isClaimedOwner = Boolean(
      claimedSession &&
        claimedSession.claimedTeam === plotTeam &&
        claimedSession.claimedPlotIndex === plotCommanderIdx,
    );
    const isAccountOwner = Boolean(
      safezoneOptions.plot?.claimedByNearAccount &&
        safezoneOptions.unitWalletOrId &&
        safezoneOptions.plot.claimedByNearAccount.toLowerCase() ===
          safezoneOptions.unitWalletOrId.toLowerCase(),
    );
    const isPlotOwner =
      safezoneOptions.isPlotOwnerOverride !== undefined
        ? safezoneOptions.isPlotOwnerOverride
        : isClaimedOwner || isAccountOwner;
    return canUnitEnterSafezonePlotGate({
      plot: safezoneOptions.plot,
      isPlotOwner,
      unitWalletOrId:
        safezoneOptions.unitWalletOrId ??
        claimedSession?.accountId ??
        claimedSession?.walletId ??
        null,
    });
  }
  if (unitTeam !== plotTeam) return false;
  if (unitOwnerCommanderId === plotCommanderIdx) return true;
  if (
    claimedSession &&
    claimedSession.claimedTeam === plotTeam &&
    claimedSession.claimedPlotIndex === plotCommanderIdx
  ) {
    return true;
  }
  return false;
}

/**
 * Steps the smooth horizontal sliding gate animation (`slideRatio` in `[0, 1]`) for a single base plot:
 * - Slides open (`1.0`) when an authorized unit (owner or owner's built character) is within `triggerRadiusMeters`.
 * - Slides closed (`0.0`) when no authorized unit is within `triggerRadiusMeters`.
 */
export function stepCommanderSlidingGate(
  currentSlideRatio: number,
  minAuthorizedUnitDistanceMeters: number,
  dt: number,
  triggerRadiusMeters = 7.5,
): { slideRatio: number; isOpen: boolean } {
  const safeDt = Math.max(0, Math.min(0.1, dt));
  const shouldOpen = minAuthorizedUnitDistanceMeters <= triggerRadiusMeters;
  const speed = shouldOpen ? 3.2 : 2.6;
  const nextRatio = shouldOpen
    ? Math.min(1.0, currentSlideRatio + speed * safeDt)
    : Math.max(0.0, currentSlideRatio - speed * safeDt);
  return {
    slideRatio: nextRatio,
    isOpen: shouldOpen,
  };
}

// ============================================================================
// TEAM BUDDIES (PS1) DEATH ITEM DROP, DESPAWN TIMER, MEDICAL CRATE & SPLASH VULNERABILITY
// ============================================================================

export type BuddyPrimaryWeaponId = 'unarmed' | 'pistol' | 'rifle' | 'rocket';
export type BuddySecondaryItemId = 'none' | 'hand_grenade' | 'cluster_bomb' | 'land_mine';
export type BuddyMissionItemId = 'none' | 'time_bomb' | 'team_flag' | 'bombball';
export type WorldCrateKind =
  | 'red'
  | 'super'
  | 'legend'
  | 'medical'
  | 'silver_metallic'
  | 'gold_metallic';

export type TeamBuddiesDropItemKind =
  | 'weapon'
  | 'coin_gold'
  | 'coin_silver'
  | 'crate'
  | 'secondary'
  | 'mission_item'
  | 'health'
  | 'ammo'
  | 'powerup';

export interface BuddyDeathDropInputState {
  weaponId: BuddyPrimaryWeaponId;
  ammo: number;
  carryingCrate: 'none' | WorldCrateKind;
  secondaryItem?: BuddySecondaryItemId;
  secondaryCount?: number;
  missionItem?: BuddyMissionItemId;
  isEnemyKill: boolean;
  classId?: BuddyClassId;
  killedByChainExplosion?: boolean;
}

export interface TeamBuddiesSpawnedDropSpec {
  kind: TeamBuddiesDropItemKind;
  label: string;
  weaponId?: 'pistol' | 'rifle' | 'rocket';
  remainingAmmo?: number;
  crateKind?: WorldCrateKind;
  secondaryId?: Exclude<BuddySecondaryItemId, 'none'>;
  secondaryCount?: number;
  missionItemId?: Exclude<BuddyMissionItemId, 'none'>;
  scoreValue?: number;
  offsetX: number;
  offsetZ: number;
  vx: number;
  vy: number;
  vz: number;
  despawnTimerSec: number;
  hp: number;
}

export const TEAM_BUDDIES_WEAPON_DESPAWN_SEC = 12.0;
export const TEAM_BUDDIES_DESPAWN_BLINK_WINDOW_SEC = 4.0;

/**
 * Pure Team Buddies (PS1) Battlefield Death Item Drop Evaluator:
 * 1. Primary Weapon (`weapon`): Any held primary weapon (`pistol` / Uzi, `rifle` / Shotgun-AR, `rocket` / Bazooka-Supazooka)
 *    bounces into the air (`vy = 6.8`) and falls to the ground retaining its exact `remainingAmmo` from right before death.
 * 2. Coins (`coin_gold` / `coin_silver`): Killing an enemy character drops Gold and/or Silver coins that add score when collected.
 * 3. Carried Overhead Crate (`crate`): Any crate carried overhead (`'red' | 'super' | 'legend' | 'medical'`) is thrown
 *    onto the ground intact (`vy = 6.2`), UNLESS `killedByChainExplosion === true`.
 * 4. Secondary Weapon / Grenade (`secondary`): Carried hand grenades (`hand_grenade`), cluster bombs (`cluster_bomb`),
 *    or land mines (`land_mine`) drop intact to the ground.
 * 5. Mission Object (`mission_item`): Carried mission objects (`time_bomb`, `team_flag`, `bombball`) drop intact to the ground.
 * 6. NO Medkit Drop from Corpses: Dead characters NEVER drop a Health Pack / Medkit (`kind === 'health'`).
 *    Medkits are ONLY obtained by destroying white medical crates with a red cross (`kind === 'medical'`).
 */
export function evaluateTeamBuddiesDeathDrops(
  state: BuddyDeathDropInputState,
): TeamBuddiesSpawnedDropSpec[] {
  const drops: TeamBuddiesSpawnedDropSpec[] = [];

  // 1. Primary Weapon (Senjata Utama): Drops if holding a weapon with remaining ammo > 0
  if (state.weaponId !== 'unarmed' && state.ammo > 0) {
    const remainingAmmo = Math.max(1, Math.floor(state.ammo));
    const weaponNames: Record<'pistol' | 'rifle' | 'rocket', string> = {
      pistol: 'Uzi / Pistol',
      rifle: 'Shotgun / Assault Rifle',
      rocket: 'Bazooka',
    };
    const angle = 0.35;
    const speed = 3.2;
    drops.push({
      kind: 'weapon',
      label: `${weaponNames[state.weaponId]} (${remainingAmmo} Ammo)`,
      weaponId: state.weaponId,
      remainingAmmo,
      offsetX: Math.cos(angle) * 0.65,
      offsetZ: Math.sin(angle) * 0.65,
      vx: Math.cos(angle) * speed,
      vy: 6.8,
      vz: Math.sin(angle) * speed,
      despawnTimerSec: TEAM_BUDDIES_WEAPON_DESPAWN_SEC,
      hp: 18,
    });
  }

  // 2. Coins / Money (Koin Emas / Perak) when killing an enemy character
  if (state.isEnemyKill) {
    const classTier = state.classId ? (BUDDY_CLASSES[state.classId]?.tier ?? 1) : 1;
    const isElite =
      classTier >= 2 ||
      state.weaponId === 'rocket' ||
      state.carryingCrate === 'super' ||
      state.carryingCrate === 'legend';
    const primaryCoinKind: 'coin_gold' | 'coin_silver' = isElite ? 'coin_gold' : 'coin_silver';
    const primaryScore = isElite ? 250 : 100;
    const coinAngle = 2.45;
    const coinSpeed = 2.8;
    drops.push({
      kind: primaryCoinKind,
      label: primaryCoinKind === 'coin_gold' ? 'Gold Coin +250 Pts' : 'Silver Coin +100 Pts',
      scoreValue: primaryScore,
      offsetX: Math.cos(coinAngle) * 0.6,
      offsetZ: Math.sin(coinAngle) * 0.6,
      vx: Math.cos(coinAngle) * coinSpeed,
      vy: 6.4,
      vz: Math.sin(coinAngle) * coinSpeed,
      despawnTimerSec: TEAM_BUDDIES_WEAPON_DESPAWN_SEC,
      hp: 15,
    });

    // Elite or armed enemies also scatter a bonus silver coin
    if (isElite && state.weaponId !== 'unarmed') {
      const bonusAngle = -2.1;
      drops.push({
        kind: 'coin_silver',
        label: 'Silver Coin +100 Pts',
        scoreValue: 100,
        offsetX: Math.cos(bonusAngle) * 0.7,
        offsetZ: Math.sin(bonusAngle) * 0.7,
        vx: Math.cos(bonusAngle) * 2.5,
        vy: 5.9,
        vz: Math.sin(bonusAngle) * 2.5,
        despawnTimerSec: TEAM_BUDDIES_WEAPON_DESPAWN_SEC,
        hp: 15,
      });
    }
  }

  // 3. Carried Overhead Crate (Peti yang Sedang Diangkat di Atas Kepala)
  // Intact unless destroyed by a follow-up/chain explosion (`killedByChainExplosion`)
  if (state.carryingCrate && state.carryingCrate !== 'none' && !state.killedByChainExplosion) {
    const crateLabels: Record<WorldCrateKind, string> = {
      red: 'Peti Biasa (Kuning/Oranye)',
      super: 'Peti Senjata Khusus (Biru)',
      legend: 'Peti Super Weapon (Ungu)',
      medical: 'Peti Medis Palang Merah (Putih)',
      silver_metallic: 'Silver Metallic Supply Box (Indestructible)',
      gold_metallic: 'Shiny Gold Metallic Supply Box (Indestructible)',
    };
    const crateAngle = -0.85;
    drops.push({
      kind: 'crate',
      label: crateLabels[state.carryingCrate],
      crateKind: state.carryingCrate,
      offsetX: Math.cos(crateAngle) * 0.75,
      offsetZ: Math.sin(crateAngle) * 0.75,
      vx: Math.cos(crateAngle) * 2.6,
      vy: 6.2,
      vz: Math.sin(crateAngle) * 2.6,
      despawnTimerSec: 0, // Crates persist on map until stacked or destroyed
      hp: state.carryingCrate === 'legend' ? 45 : state.carryingCrate === 'super' ? 35 : 25,
    });
  }

  // 4. Secondary Weapon / Grenade (Granat Tangan, Cluster Bomb, atau Ranjau)
  const secItem = state.secondaryItem ?? 'none';
  const secCount = state.secondaryCount ?? 0;
  if (secItem !== 'none' && secCount > 0 && !state.killedByChainExplosion) {
    const secLabels: Record<Exclude<BuddySecondaryItemId, 'none'>, string> = {
      hand_grenade: 'Hand Grenade',
      cluster_bomb: 'Cluster Bomb',
      land_mine: 'Land Mine',
    };
    const secAngle = 1.45;
    drops.push({
      kind: 'secondary',
      label: `${secLabels[secItem]} x${secCount}`,
      secondaryId: secItem,
      secondaryCount: secCount,
      offsetX: Math.cos(secAngle) * 0.65,
      offsetZ: Math.sin(secAngle) * 0.65,
      vx: Math.cos(secAngle) * 3.0,
      vy: 6.1,
      vz: Math.sin(secAngle) * 3.0,
      despawnTimerSec: TEAM_BUDDIES_WEAPON_DESPAWN_SEC,
      hp: 14,
    });
  }

  // 5. Mission Object (Bom Waktu, Bendera Capture, atau Bombball)
  const missionObj = state.missionItem ?? 'none';
  if (missionObj !== 'none') {
    const missionLabels: Record<Exclude<BuddyMissionItemId, 'none'>, string> = {
      time_bomb: 'Time Bomb',
      team_flag: 'Capture Flag',
      bombball: 'Bombball',
    };
    const mAngle = -1.55;
    drops.push({
      kind: 'mission_item',
      label: missionLabels[missionObj],
      missionItemId: missionObj,
      offsetX: Math.cos(mAngle) * 0.7,
      offsetZ: Math.sin(mAngle) * 0.7,
      vx: Math.cos(mAngle) * 2.4,
      vy: 6.5,
      vz: Math.sin(mAngle) * 2.4,
      despawnTimerSec: 0, // Mission objectives do not despawn automatically
      hp: 40,
    });
  }

  return drops;
}

export interface DroppedItemDespawnState {
  expired: boolean;
  isBlinking: boolean;
  visible: boolean;
}

/**
 * Evaluates the Team Buddies (PS1) despawn timer & rapid blinking warning for dropped weapons/items:
 * - Before the final `blinkWindowSec` (default 4.0s), the item stays solidly visible (`isBlinking = false, visible = true`).
 * - During the final `blinkWindowSec` (`0 < remainingSec <= blinkWindowSec`), `isBlinking = true` and `visible`
 *   alternates rapidly (accelerating from 6 Hz to 14 Hz as `remainingSec` approaches 0).
 * - Once `remainingSec <= 0`, `expired = true` and the item despawns (`visible = false`).
 */
export function evaluateDroppedItemDespawnState(
  remainingSec: number,
  totalDespawnSec = TEAM_BUDDIES_WEAPON_DESPAWN_SEC,
  blinkWindowSec = TEAM_BUDDIES_DESPAWN_BLINK_WINDOW_SEC,
): DroppedItemDespawnState {
  if (totalDespawnSec <= 0) {
    return { expired: false, isBlinking: false, visible: true };
  }
  if (remainingSec <= 0) {
    return { expired: true, isBlinking: false, visible: false };
  }
  if (remainingSec > blinkWindowSec) {
    return { expired: false, isBlinking: false, visible: true };
  }

  // Normalize urgency in [0..1] where 0 = start of blink window, 1 = about to vanish
  const urgency = clamp(1 - remainingSec / Math.max(0.1, blinkWindowSec), 0, 1);
  // Frequency ramps up from 6 Hz to 14 Hz as item nears despawn
  const freqHz = 6 + urgency * 8;
  const phase = Math.sin(remainingSec * freqHz * Math.PI * 2);
  return {
    expired: false,
    isBlinking: true,
    visible: phase >= 0,
  };
}

/**
 * Team Buddies (PS1) Crate Destruction / Open Drop Rule:
 * - White Medical Crate (`crateKind === 'medical'`): Drops Health Pack / Medkit (`kind === 'health'`, `+35 HP`).
 * - Purple Special Crate (`crateKind === 'legend'`): Falls in the middle of the map mid-game and IMMEDIATELY
 *   yields a Mass-Destruction Super Weapon (`Nuclear Launcher / Airstrike Marker / Ion Cannon`, `dropKind === 'weapon'`) when opened!
 * - Regular/Blue Crates (`'red' | 'super'`): Never drop a Medkit; scatter an ammo pack (`dropKind === 'ammo'`).
 */
export function evaluateCrateDestructionDrop(
  crateKind: WorldCrateKind,
): {
  dropKind: 'health' | 'ammo' | 'weapon';
  label: string;
  healAmount: number;
  weaponId?: 'pistol' | 'rifle' | 'rocket';
  remainingAmmo?: number;
  isPurpleSuperWeapon?: boolean;
} {
  if (crateKind === 'medical') {
    return {
      dropKind: 'health',
      label: 'Medkit +35 HP',
      healAmount: 35,
    };
  }
  if (crateKind === 'legend') {
    return {
      dropKind: 'weapon',
      label: 'Nuclear Launcher / Ion Cannon (Super Weapon)',
      healAmount: 0,
      weaponId: 'rocket',
      remainingAmmo: 12,
      isPurpleSuperWeapon: true,
    };
  }
  return {
    dropKind: 'ammo',
    label: 'Ammo +15',
    healAmount: 0,
  };
}

export interface DroppedItemSplashDamageResult {
  hit: boolean;
  damage: number;
  nextHp: number;
  destroyed: boolean;
  knockbackVx: number;
  knockbackVz: number;
}

/**
 * Evaluates follow-up area/splash damage (`serangan area / splash damage susulan`) from Bazooka rockets,
 * Tank shells, Skyshield airbursts, or chain-exploding barrels/crates against dropped weapons, pickups, and crates.
 * If `nextHp <= 0`, the dropped weapon or crate is blown apart (`destroyed = true`).
 */
export function evaluateSplashDamageOnDroppedItem(
  itemX: number,
  itemZ: number,
  blastX: number,
  blastZ: number,
  blastRadius: number,
  maxBlastDamage: number,
  currentHp: number,
): DroppedItemSplashDamageResult {
  const dx = itemX - blastX;
  const dz = itemZ - blastZ;
  const dist = Math.hypot(dx, dz);
  if (dist > blastRadius || blastRadius <= 0.01) {
    return {
      hit: false,
      damage: 0,
      nextHp: currentHp,
      destroyed: false,
      knockbackVx: 0,
      knockbackVz: 0,
    };
  }

  const falloff = clamp(1 - dist / blastRadius, 0.15, 1.0);
  const damage = Math.max(1, Math.round(maxBlastDamage * falloff));
  const nextHp = Math.max(0, currentHp - damage);
  const nx = dist > 0.001 ? dx / dist : 1;
  const nz = dist > 0.001 ? dz / dist : 0;
  const impulse = (6.5 + 8.5 * falloff);

  return {
    hit: true,
    damage,
    nextHp,
    destroyed: nextHp <= 0,
    knockbackVx: nx * impulse,
    knockbackVz: nz * impulse,
  };
}

// ============================================================================
// TEAM BUDDIES (PS1) STACKING PAD CRAFTED WEAPON LIFECYCLE:
// 1. Physics Pop-out to Pad Border (`Terpental ke Sekitar Pad`)
// 2. AI Auto-Loot & Tier Upgrade (`Diambil Otomatis oleh AI Tim`)
// 3. No Team-Lock / Enemy Stealable (`Rentan Dicuri Lawan`)
// 4. 15–20s Despawn Timer with Blink Warning (`Berkedip dan Menghilang`, Vehicles/Buddies Permanent)
// 5. Splash Damage Destruction (`Hancur Terkena Serangan Area`)
// ============================================================================

export const TEAM_BUDDIES_CRAFTED_WEAPON_DESPAWN_SEC = 18.0; // Within the 15–20s Team Buddies window

export interface StackingPadWeaponPopOutTrajectory {
  startX: number;
  startZ: number;
  vx: number;
  vy: number;
  vz: number;
  landingX: number;
  landingZ: number;
  landingDistFromPadCenter: number;
}

/**
 * Computes the Team Buddies Physics Pop-out trajectory (`Terpental ke Sekitar Pad`) when crates are broken
 * on a 2x2x2 Stacking Pad centered at `(padX, padZ)`:
 * - The crafted weapon (or leftover weapon drop) does NOT stay in the middle of the Stacking Pad.
 * - Instead, it launches from near the pad center (`r0 = 0.75m`) with an upward arc (`vy = 6.2 m/s`)
 *   and horizontal velocity (`~4.8 m/s`) so that it lands right around the Stacking Pad perimeter border
 *   (`landingDistFromPadCenter` in `[2.4m .. 3.4m]`), leaving the 2x2 pad surface (`[-1.62..+1.62]`) clear
 *   for immediate crate re-stacking!
 */
export function computeStackingPadWeaponPopOutTrajectory(
  padX: number,
  padZ: number,
  dropIndex = 0,
  totalDrops = 1,
  frontSign: 1 | -1 = 1,
): StackingPadWeaponPopOutTrajectory {
  // Aim inward toward the center of the Commander Base courtyard (`berada di tengah base`)
  // instead of outward toward the right perimeter fence (`padX = plotCenterX + sign * 7.3`):
  // - For Blue (`frontSign = 1`), the base center is in the `-X` direction (`angle ≈ Math.PI - 0.15`).
  // - For Red (`frontSign = -1`), the base center is in the `+X` direction (`angle ≈ -0.15`).
  const inwardCenterAngle = frontSign === 1 ? Math.PI - 0.15 : -0.15;
  const fanSpan = 0.72;
  const angleOffset =
    totalDrops > 1 ? (dropIndex - (totalDrops - 1) * 0.5) * (fanSpan / Math.max(1, totalDrops - 1)) : 0;
  const angle = inwardCenterAngle + angleOffset;

  const startRadius = 0.75;
  const startX = padX + Math.cos(angle) * startRadius;
  const startZ = padZ + Math.sin(angle) * startRadius;

  // Pop gently inward toward the middle of the base so the weapon never flies over the perimeter fence
  const horizSpeed = 3.5;
  const vx = Math.cos(angle) * horizSpeed;
  const vz = Math.sin(angle) * horizSpeed;
  const vy = 6.0;

  const effectiveTravelDist = 2.1; // startRadius (0.75) + 2.1 = 2.85m inward from pad center toward base center
  const landingX = padX + Math.cos(angle) * (startRadius + effectiveTravelDist);
  const landingZ = padZ + Math.sin(angle) * (startRadius + effectiveTravelDist);
  const landingDistFromPadCenter = Math.hypot(landingX - padX, landingZ - padZ);

  return {
    startX,
    startZ,
    vx,
    vy,
    vz,
    landingX,
    landingZ,
    landingDistFromPadCenter,
  };
}

/**
 * Returns the numeric tier rank (`0..4`) of a character's held weapon or a ground weapon pickup:
 * - `0`: `'unarmed'` (Belum memegang senjata)
 * - `1`: Tier 1 Light Weapon (`'pistol'`, Uzi, Shotgun, Pistol, Flamethrower Kecil)
 * - `2`: Tier 1 Super / Tier 2 Medium Rifle (`'rifle'`, Super Shotgun, Plasma Gun, Assault Rifle, Sniper)
 * - `3`: Tier 2/3 Heavy Explosive (`'rocket'` / `'bazooka'`, Bazooka, Laser Gun, Gatling, Homing Missile, Mortar)
 * - `4`: Purple Special Mass-Destruction Super Weapon (`Nuclear Launcher`, `Ion Cannon`, `Airstrike Marker`, `Supazooka`)
 */
export function getBuddyWeaponTierRank(
  weaponId: 'unarmed' | 'pistol' | 'rifle' | 'rocket' | 'bazooka' | 'laser' | 'gatling',
  weaponName = '',
): number {
  if (weaponId === 'unarmed') return 0;
  const upper = weaponName.toUpperCase();
  if (
    upper.includes('NUCLEAR') ||
    upper.includes('ION CANNON') ||
    upper.includes('AIRSTRIKE') ||
    upper.includes('SUPAZOOKA') ||
    upper.includes('SUPER WEAPON')
  ) {
    return 4;
  }
  if (
    weaponId === 'rocket' ||
    weaponId === 'bazooka' ||
    weaponId === 'laser' ||
    weaponId === 'gatling' ||
    upper.includes('BAZOOKA') ||
    upper.includes('HOMING') ||
    upper.includes('GATLING') ||
    upper.includes('TITAN-6') ||
    upper.includes('MORTAR') ||
    upper.includes('LASER') ||
    upper.includes('PHOTON')
  ) {
    return 3;
  }
  if (
    weaponId === 'rifle' ||
    upper.includes('SUPER SHOTGUN') ||
    upper.includes('PLASMA') ||
    upper.includes('ASSAULT') ||
    upper.includes('SNIPER')
  ) {
    return 2;
  }
  return 1;
}

export function canUnitLootGroundWeapon(
  _unitTeam: 'blue' | 'red',
  unitWeaponId: 'unarmed' | 'pistol' | 'rifle' | 'rocket' | 'bazooka' | 'laser' | 'gatling',
  unitWeaponName: string,
  groundWeaponId: 'pistol' | 'rifle' | 'rocket' | 'bazooka' | 'laser' | 'gatling',
  groundWeaponName: string,
  unitAmmo = 100,
): {
  canLoot: boolean;
  isUpgrade: boolean;
  teamLocked: false;
  currentTier: number;
  groundTier: number;
} {
  const currentTier = getBuddyWeaponTierRank(unitWeaponId, unitWeaponName);
  const groundTier = getBuddyWeaponTierRank(groundWeaponId, groundWeaponName);
  const isUpgrade = groundTier > currentTier;
  const lowAmmoSameTier = groundTier === currentTier && unitAmmo < 25;
  return {
    canLoot: currentTier === 0 || isUpgrade || lowAmmoSameTier,
    isUpgrade,
    teamLocked: false,
    currentTier,
    groundTier,
  };
}

/**
 * Team Buddies Despawn Rule Comparison:
 * - Crafted/dropped weapons & grenades (`'weapon' | 'grenade'`) have a 15–20s despawn timer (`TEAM_BUDDIES_CRAFTED_WEAPON_DESPAWN_SEC = 18.0s`),
 *   blink rapidly at the end, and vanish permanently if uncollected (wasting the crates used).
 * - Built Vehicles (`'light_vehicle' | 'truck' | 'tank' | 'plane'`) and built Buddy Units (`'buddy'`) NEVER despawn by time (`despawnTimerSec === 0`),
 *   and are only destroyed when attacked until `hp <= 0`.
 */
export function doesCraftedEntityDespawnByTimer(
  spawnType: PadEvaluationResult['spawnType'],
): { despawnsByTime: boolean; despawnTimerSec: number } {
  if (spawnType === 'weapon' || spawnType === 'grenade') {
    return {
      despawnsByTime: true,
      despawnTimerSec: TEAM_BUDDIES_CRAFTED_WEAPON_DESPAWN_SEC,
    };
  }
  return {
    despawnsByTime: false,
    despawnTimerSec: 0,
  };
}

// ============================================================================
// TEAM BUDDIES (PS1) DEATHMATCH (SKIRMISH / STANDAR) WIN CONDITIONS:
// 1. Menghancurkan markas utama musuh (Base/HQ atau gerbang spawn mereka) hingga rata dengan tanah
// 2. Menghabisi seluruh anggota tim lawan sampai mereka tidak bisa melakukan respawn lagi
//    dan tidak punya peti untuk melahirkan Buddy baru di Stacking Pad
// ============================================================================

export type DeathmatchVictoryReason =
  | 'none'
  | 'base_destroyed'
  | 'squad_wiped_no_respawn_or_crates';

export interface TeamBuddiesDeathmatchTeamState {
  team: 'blue' | 'red';
  baseHp: number;
  commanderBases: ReadonlyArray<{ destroyed: boolean; buildingHp: number }>;
  aliveUnitCount: number;
  respawnableUnitCount: number;
  padSlotsList: ReadonlyArray<ReadonlyArray<CrateSlotType>>;
  freeFieldCrateCount: number;
}

export interface TeamBuddiesDeathmatchResult {
  isGameOver: boolean;
  outcome: 'victory' | 'defeat' | null;
  winningTeam: 'blue' | 'red' | null;
  reason: DeathmatchVictoryReason;
  reasonLabel: string;
}

/**
 * Evaluates whether a dead unit (`!b.alive`) is allowed to respawn at its Commander's Base/Spawn Gate:
 * - Extra AI Buddies crafted from Stacking Pad crates (`isStarterCommanderUnit === false`) NEVER respawn automatically when killed;
 *   a new Buddy must be crafted again on the Stacking Pad (`1x1x2` or `2x1x2` vertical crates).
 * - A Commander's primary starter unit (`isStarterCommanderUnit === true`) can respawn ONLY while their
 *   Command Center / Spawn Gate (`!commanderBaseDestroyed && commanderBuildingHp > 0`) has not been flattened!
 */
export function canBuddyUnitRespawnAtBase(
  isStarterCommanderUnit: boolean,
  commanderBaseDestroyed: boolean,
  commanderBuildingHp: number,
): boolean {
  if (!isStarterCommanderUnit) return false;
  if (commanderBaseDestroyed || commanderBuildingHp <= 0) return false;
  return true;
}

/**
 * Checks whether a Stacking Pad (`slots`) currently holds enough crates to birth a new Buddy (`1x1x2` or `2x1x2` vertical stack,
 * or at least 2 crates that can be struck into a Buddy).
 */
export function canPadSlotsBirthNewBuddy(slots: ReadonlyArray<CrateSlotType>): boolean {
  const padEval = evaluateStackingPadRecipe(slots);
  return padEval.spawnType === 'buddy' || padEval.totalCrates >= 2;
}

/**
 * Evaluates whether a team in Team Buddies Deathmatch (Skirmish / Standar) has been completely eliminated:
 * - Condition A (`'base_destroyed'`): Their Main Base / HQ (`baseHp <= 0`) or all 4 Commander Bases/Spawn Gates
 *   (`commanderBases.every(b => b.destroyed || b.buildingHp <= 0)`) are flattened to the ground (`rata dengan tanah`).
 * - Condition B (`'squad_wiped_no_respawn_or_crates'`): Every member of the team has been killed (`aliveUnitCount <= 0`),
 *   none of them can respawn anymore (`respawnableUnitCount <= 0`), AND they cannot birth a new Buddy from crates
 *   (either they have no pad with >=2 crates OR no surviving unit left to strike the pad / harvest crates).
 */
export function isTeamEliminatedInDeathmatch(
  teamState: TeamBuddiesDeathmatchTeamState,
): { eliminated: boolean; reason: DeathmatchVictoryReason } {
  const allPlotsDestroyed =
    teamState.commanderBases.length > 0 &&
    teamState.commanderBases.every((b) => b.destroyed || b.buildingHp <= 0);

  if (teamState.baseHp <= 0 || allPlotsDestroyed) {
    return {
      eliminated: true,
      reason: 'base_destroyed',
    };
  }

  const anyPadHasBuddyCrates = teamState.padSlotsList.some((slots) => canPadSlotsBirthNewBuddy(slots));
  const canBirthNewBuddy =
    teamState.aliveUnitCount > 0 && (anyPadHasBuddyCrates || teamState.freeFieldCrateCount >= 2);

  if (teamState.aliveUnitCount <= 0 && teamState.respawnableUnitCount <= 0 && !canBirthNewBuddy) {
    return {
      eliminated: true,
      reason: 'squad_wiped_no_respawn_or_crates',
    };
  }

  return {
    eliminated: false,
    reason: 'none',
  };
}

/**
 * Evaluates the full Team Buddies (PS1) Deathmatch (Skirmish / Standar) Win/Defeat Condition
 * from the perspective of the Blue Team (Player's team) vs Red Team (Enemy team).
 */
export function evaluateTeamBuddiesDeathmatchWinCondition(
  blueState: TeamBuddiesDeathmatchTeamState,
  redState: TeamBuddiesDeathmatchTeamState,
): TeamBuddiesDeathmatchResult {
  const redCheck = isTeamEliminatedInDeathmatch(redState);
  if (redCheck.eliminated) {
    return {
      isGameOver: true,
      outcome: 'victory',
      winningTeam: 'blue',
      reason: redCheck.reason,
      reasonLabel:
        redCheck.reason === 'base_destroyed'
          ? 'ENEMY MAIN HQ COMPLETELY DESTROYED!'
          : 'ALL ENEMY FORCES ELIMINATED & UNABLE TO SPAWN NEW BUDDIES!',
    };
  }

  const blueCheck = isTeamEliminatedInDeathmatch(blueState);
  if (blueCheck.eliminated) {
    return {
      isGameOver: true,
      outcome: 'defeat',
      winningTeam: 'red',
      reason: blueCheck.reason,
      reasonLabel:
        blueCheck.reason === 'base_destroyed'
          ? 'BLUE TEAM MAIN HQ COMPLETELY DESTROYED!'
          : 'ALL BLUE TEAM FORCES ELIMINATED & UNABLE TO RESPAWN!',
    };
  }

  return {
    isGameOver: false,
    outcome: null,
    winningTeam: null,
    reason: 'none',
    reasonLabel: '',
  };
}

// ============================================================================
// SELF-SERVICE TACTICAL KIOSK (1:1 KAI INDUSTRIAL MODEL SHEET NEXT TO PAD):
// - Build Priority Selector -> Multi-Color 2x2x2 Hologram on Crate Stacking Pad
// - Base Upgrade (Command Center + Iron Fence + Parking + Helipad) with Warzone Gold
// - Buy Crates by Rarity with Warzone Gold -> Parachute Airdrop From Above Pad
// ============================================================================

export type KioskBuildPriorityCategory =
  | 'weapons_light'
  | 'weapons_heavy'
  | 'buddy_units'
  | 'vehicles_aircraft';

export type KioskBuildPriorityRecipeId =
  | 'pistol_uzi'
  | 'assault_plasma'
  | 'supazooka'
  | 'bazooka'
  | 'laser_gun'
  | 'skyshield_turret'
  | 'nuclear_launcher'
  | 'gatling_mortar'
  | 'hand_grenade'
  | 'land_mine'
  | 'cluster_bomb'
  | 'buddy_infantry'
  | 'buddy_commando'
  | 'buddy_ninja'
  | 'buddy_super_wall'
  | 'dump_truck'
  | 'mini_tank'
  | 'blitz_tank'
  | 'tyrant_tank'
  | 'blitz_plane';

export type PadSlotHologramPattern = readonly [
  CrateSlotType,
  CrateSlotType,
  CrateSlotType,
  CrateSlotType,
  CrateSlotType,
  CrateSlotType,
  CrateSlotType,
  CrateSlotType,
];

export interface KioskBuildPriorityRecipeSpec {
  id: KioskBuildPriorityRecipeId;
  category: KioskBuildPriorityCategory;
  name: string;
  caliberOrSpec: string;
  recipeSummary: string;
  buildOrder: BuildOrderTarget;
  targetCrates: number;
  /** Exact 8-slot (bottom 0..3, top 4..7) color combination for the 3D Crate Pad Hologram */
  slotHologramColors: PadSlotHologramPattern;
  iconKind: 'pistol' | 'rifle' | 'bazooka' | 'turret' | 'buddy' | 'truck' | 'tank' | 'plane';
  /** Minimum Command Center level required to unlock/reveal and build this recipe */
  requiresCommandCenterLevel?: 1 | 2 | 3;
  /** True if this ordnance can only be dropped/fired while piloting the Blitz Fighter Plane */
  onlyUsableByPlane?: boolean;
}

export const KIOSK_BUILD_PRIORITY_RECIPES: Record<
  KioskBuildPriorityRecipeId,
  KioskBuildPriorityRecipeSpec
> = {
  pistol_uzi: {
    id: 'pistol_uzi',
    category: 'weapons_light',
    name: 'UZI / PISTOL T1',
    caliberOrSpec: '9x19mm · Tier 1 Standard',
    recipeSummary: '1x1x1 · 1 Red Crate (Common)',
    buildOrder: '1x1x1',
    targetCrates: 1,
    slotHologramColors: ['red', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    iconKind: 'pistol',
  },
  assault_plasma: {
    id: 'assault_plasma',
    category: 'weapons_light',
    name: 'SUPER SHOTGUN / RIFLE',
    caliberOrSpec: '5.56x45mm · Spread & Bounce',
    recipeSummary: '1x1x1 · 1 Blue Crate (Rare)',
    buildOrder: '1x1x1',
    targetCrates: 1,
    slotHologramColors: ['super', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    iconKind: 'rifle',
  },
  supazooka: {
    id: 'supazooka',
    category: 'weapons_light',
    name: 'SUPAZOOKA / NUCLEAR',
    caliberOrSpec: '84mm Heavy · Super Weapon',
    recipeSummary: '1x1x1 · 1 Gold Crate (Legend)',
    buildOrder: '1x1x1',
    targetCrates: 1,
    slotHologramColors: ['legend', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    iconKind: 'bazooka',
  },
  bazooka: {
    id: 'bazooka',
    category: 'weapons_light',
    name: 'BAZOOKA / SNIPER T2',
    caliberOrSpec: '66mm Anti-Armor · Tier 2',
    recipeSummary: '2x1x1 · 2 Red Crates (Common)',
    buildOrder: '2x1x1',
    targetCrates: 2,
    slotHologramColors: ['red', 'red', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    iconKind: 'bazooka',
  },
  laser_gun: {
    id: 'laser_gun',
    category: 'weapons_light',
    name: 'LASER GUN / RAILGUN',
    caliberOrSpec: 'Directed Energy · Tier 2 Super',
    recipeSummary: '2x1x1 · 1 Blue + 1 Red',
    buildOrder: '2x1x1',
    targetCrates: 2,
    slotHologramColors: ['super', 'red', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    iconKind: 'rifle',
  },
  skyshield_turret: {
    id: 'skyshield_turret',
    category: 'weapons_heavy',
    name: 'SKYSHIELD 35MM TURRET',
    caliberOrSpec: '35x228mm AHEAD · Base Defense',
    recipeSummary: '2x1x1 · 2 Blue Crates (Rare)',
    buildOrder: '2x1x1',
    targetCrates: 2,
    slotHologramColors: ['super', 'super', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    iconKind: 'turret',
  },
  nuclear_launcher: {
    id: 'nuclear_launcher',
    category: 'weapons_heavy',
    name: "MLRS-MK5 'ATLAS' NUCLEAR LAUNCHER",
    caliberOrSpec: 'Tactical Nuke · Radar Lock Lv.3 (280m)',
    recipeSummary: '2x2x1 Floor · 2 Gold + 2 Blue (Requires HQ Lv.3)',
    buildOrder: '2x2x1',
    targetCrates: 4,
    slotHologramColors: ['legend', 'legend', 'super', 'super', 'empty', 'empty', 'empty', 'empty'],
    iconKind: 'turret',
    requiresCommandCenterLevel: 3,
  },
  gatling_mortar: {
    id: 'gatling_mortar',
    category: 'weapons_heavy',
    name: 'TITAN-6 ROTARY GATLING',
    caliberOrSpec: '7.62x51mm 6-Barrel Rotary · Tier 4 Heavy',
    recipeSummary: '2x2x1 · 2 Blue + 2 Red',
    buildOrder: '2x2x1',
    targetCrates: 4,
    slotHologramColors: ['super', 'super', 'red', 'red', 'empty', 'empty', 'empty', 'empty'],
    iconKind: 'rifle',
  },
  hand_grenade: {
    id: 'hand_grenade',
    category: 'weapons_light',
    name: 'HG-04 FRAG GRENADE',
    caliberOrSpec: 'Delay 3.5s · Tactical Fragmentation',
    recipeSummary: '1x1x1 · 1 Red Crate (Common)',
    buildOrder: '1x1x1',
    targetCrates: 1,
    slotHologramColors: ['red', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    iconKind: 'bazooka',
  },
  land_mine: {
    id: 'land_mine',
    category: 'weapons_light',
    name: 'TM-89 ANTI-VEHICLE MINE',
    caliberOrSpec: 'Pressure Fuze · Anti-Tank & Infantry',
    recipeSummary: '1x1x1 · 1 Blue Crate (Rare)',
    buildOrder: '1x1x1',
    targetCrates: 1,
    slotHologramColors: ['super', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    iconKind: 'turret',
  },
  cluster_bomb: {
    id: 'cluster_bomb',
    category: 'weapons_heavy',
    name: 'CB-24 CLUSTER BOMB DISPENSER',
    caliberOrSpec: '24x Submunition Bomblets · Plane Only (Lv.3)',
    recipeSummary: '2x1x1 · 1 Gold + 1 Red (Requires HQ Lv.3 & Plane)',
    buildOrder: '2x1x1',
    targetCrates: 2,
    slotHologramColors: ['legend', 'red', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    iconKind: 'bazooka',
    requiresCommandCenterLevel: 3,
    onlyUsableByPlane: true,
  },
  buddy_infantry: {
    id: 'buddy_infantry',
    category: 'buddy_units',
    name: 'BUDDY INFANTRY / MEDIC',
    caliberOrSpec: 'Standard Squad Unit · 1x HP',
    recipeSummary: '1x1x2 Column · 2 Red Crates',
    buildOrder: '1x1x2',
    targetCrates: 2,
    slotHologramColors: ['red', 'empty', 'empty', 'empty', 'red', 'empty', 'empty', 'empty'],
    iconKind: 'buddy',
  },
  buddy_commando: {
    id: 'buddy_commando',
    category: 'buddy_units',
    name: 'SUPER BUDDY COMMANDO',
    caliberOrSpec: '2x HP & 2x Sprint · Robo-Buddy',
    recipeSummary: '1x1x2 Column · 1 Blue + 1 Red',
    buildOrder: '1x1x2',
    targetCrates: 2,
    slotHologramColors: ['super', 'empty', 'empty', 'empty', 'red', 'empty', 'empty', 'empty'],
    iconKind: 'buddy',
  },
  buddy_ninja: {
    id: 'buddy_ninja',
    category: 'buddy_units',
    name: 'NINJA / CYBORG ELITE',
    caliberOrSpec: 'Katana Slicer · Anti-Tank Fist',
    recipeSummary: '1x1x2 Column · 1 Gold + 1 Blue',
    buildOrder: '1x1x2',
    targetCrates: 2,
    slotHologramColors: ['legend', 'empty', 'empty', 'empty', 'super', 'empty', 'empty', 'empty'],
    iconKind: 'buddy',
  },
  buddy_super_wall: {
    id: 'buddy_super_wall',
    category: 'buddy_units',
    name: 'SUPER BUDDIE (FLIGHT)',
    caliberOrSpec: '260 HP · Flight + Laser Eyes',
    recipeSummary: '2x1x2 Wall · 2 Blue + 2 Red',
    buildOrder: '2x1x2',
    targetCrates: 4,
    slotHologramColors: ['red', 'red', 'empty', 'empty', 'super', 'super', 'empty', 'empty'],
    iconKind: 'buddy',
  },
  dump_truck: {
    id: 'dump_truck',
    category: 'vehicles_aircraft',
    name: 'HYDRAULIC DUMP TRUCK',
    caliberOrSpec: '4-Crate Capacity · Fast Unload',
    recipeSummary: '2x2x1 Floor · 4 Red Crates',
    buildOrder: '2x2x1',
    targetCrates: 4,
    slotHologramColors: ['red', 'red', 'red', 'red', 'empty', 'empty', 'empty', 'empty'],
    iconKind: 'truck',
  },
  mini_tank: {
    id: 'mini_tank',
    category: 'vehicles_aircraft',
    name: 'MINI-TANK / WALKER',
    caliberOrSpec: '1 Fast Seat · Light Cannon',
    recipeSummary: '2x1x2 Wall · 4 Red Crates',
    buildOrder: '2x1x2',
    targetCrates: 4,
    slotHologramColors: ['red', 'red', 'empty', 'empty', 'red', 'red', 'empty', 'empty'],
    iconKind: 'tank',
  },
  blitz_tank: {
    id: 'blitz_tank',
    category: 'vehicles_aircraft',
    name: 'BLITZ HEAVY TANK 105MM',
    caliberOrSpec: '2 Seats · 105mm Main Cannon',
    recipeSummary: '2x2x2 Cube · 8 Red Crates',
    buildOrder: '2x2x2',
    targetCrates: 8,
    slotHologramColors: ['red', 'red', 'red', 'red', 'red', 'red', 'red', 'red'],
    iconKind: 'tank',
  },
  tyrant_tank: {
    id: 'tyrant_tank',
    category: 'vehicles_aircraft',
    name: 'SUPER MAMMOTH TANK',
    caliberOrSpec: '2.2x Heavy Armor · Heavy Cannon',
    recipeSummary: '2x2x2 Cube · 4 Red + 4 Blue',
    buildOrder: '2x2x2',
    targetCrates: 8,
    slotHologramColors: ['red', 'red', 'red', 'red', 'super', 'super', 'super', 'super'],
    iconKind: 'tank',
  },
  blitz_plane: {
    id: 'blitz_plane',
    category: 'vehicles_aircraft',
    name: 'BLITZ FIGHTER PLANE',
    caliberOrSpec: 'Twin Minigun BRRRT · Auto-Helipad',
    recipeSummary: '2x2x2 Cube · 4 Red + 2 Blue + 2 Gold',
    buildOrder: '2x2x2',
    targetCrates: 8,
    slotHologramColors: ['red', 'red', 'red', 'red', 'super', 'super', 'legend', 'legend'],
    iconKind: 'plane',
  },
};

export function getHologramSlotHexColor(slotKind: CrateSlotType): number {
  if (slotKind === 'legend') return 0xffd700; // Gold / Legend hologram
  if (slotKind === 'super') return 0x00d2ff; // Cyan Blue / Rare hologram
  if (slotKind === 'red') return 0xff4d3d; // Red-Orange / Common hologram
  return 0xb8ff3c; // Default lime
}

/**
 * Selects the best empty slot index (0..7) on the Stacking Pad for an incoming `crateKind`,
 * matching the active multi-color hologram pattern (`slotHologramColors`) first so each crate
 * lands in its color-coded hologram box!
 * When `strictColorOnly` is true, returns `-1` if no empty hologram slot matches `crateKind`.
 */
export function chooseNextPadSlotIndexForHologram(
  slots: ReadonlyArray<CrateSlotType>,
  slotHologramColors: PadSlotHologramPattern | null,
  crateKind: Exclude<CrateSlotType, 'empty'>,
  fallbackBuildOrder: BuildOrderTarget = '1x1x2',
  strictColorOnly = false,
): number {
  if (slotHologramColors) {
    // 1. Prefer an empty slot whose hologram color matches `crateKind`
    for (let i = 0; i < 8; i++) {
      if ((slots[i] ?? 'empty') === 'empty' && slotHologramColors[i] === crateKind) {
        return i;
      }
    }
    if (strictColorOnly) {
      return -1;
    }
    // 2. Otherwise fill the next empty slot that is active in the hologram pattern
    for (let i = 0; i < 8; i++) {
      if ((slots[i] ?? 'empty') === 'empty' && slotHologramColors[i] !== 'empty') {
        return i;
      }
    }
    return -1;
  }
  return chooseNextPadSlotIndex(slots, fallbackBuildOrder);
}

/**
 * Computes the exact crate colors (`'red' | 'super' | 'legend'`) still needed to complete
 * the active Stacking Pad hologram (`slotHologramColors`), both before and after subtracting
 * crates already being carried in-flight by teammates belonging to the same pad.
 */
export function getRemainingNeededCrateKindsForHologram(
  slots: ReadonlyArray<CrateSlotType>,
  slotHologramColors: PadSlotHologramPattern | null,
  inFlightCarriedCrates: ReadonlyArray<Exclude<WorldCrateKind, 'medical'>> = [],
): {
  unfilledSlotColors: Array<'red' | 'super' | 'legend'>;
  neededAfterInFlight: Array<'red' | 'super' | 'legend'>;
} {
  if (!slotHologramColors) {
    return { unfilledSlotColors: [], neededAfterInFlight: [] };
  }
  const unfilledSlotColors: Array<'red' | 'super' | 'legend'> = [];
  for (let i = 0; i < 8; i++) {
    const holoKind = slotHologramColors[i];
    if ((slots[i] ?? 'empty') === 'empty' && holoKind && holoKind !== 'empty') {
      unfilledSlotColors.push(holoKind);
    }
  }
  const neededAfterInFlight = [...unfilledSlotColors];
  for (const carried of inFlightCarriedCrates) {
    if (carried === 'silver_metallic' || carried === 'gold_metallic') continue;
    const idx = neededAfterInFlight.indexOf(carried);
    if (idx !== -1) {
      neededAfterInFlight.splice(idx, 1);
    }
  }
  return { unfilledSlotColors, neededAfterInFlight };
}

/**
 * Evaluates whether the Stacking Pad hologram should be visible or hidden.
 * - When `useCustomHologramRecipe` is `false` (no target selected or after a target build was fulfilled/crafted),
 *   ALL hologram wireframes (`showPatternOutlineBox` and all 8 `slotGhostColors`) are hidden (`'empty'`).
 * - When `useCustomHologramRecipe` is `true`, once all required hologram slots are filled (`unfilledCount === 0`),
 *   `isFulfilled` becomes `true` and the hologram disappears (`showPatternOutlineBox = false` and all `slotGhostColors` are `'empty'`).
 */
export function evaluatePadHologramState(
  isLocalPlayerPad: boolean,
  useCustomHologramRecipe: boolean,
  activePriorityRecipe: KioskBuildPriorityRecipeId,
  slots: ReadonlyArray<CrateSlotType>,
): {
  isActive: boolean;
  isFulfilled: boolean;
  showPatternOutlineBox: boolean;
  slotGhostColors: PadSlotHologramPattern;
} {
  const emptyPattern: PadSlotHologramPattern = [
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
    'empty',
  ];
  if (!isLocalPlayerPad || !useCustomHologramRecipe) {
    return {
      isActive: false,
      isFulfilled: false,
      showPatternOutlineBox: false,
      slotGhostColors: emptyPattern,
    };
  }

  const recipe = KIOSK_BUILD_PRIORITY_RECIPES[activePriorityRecipe];
  if (!recipe) {
    return {
      isActive: false,
      isFulfilled: false,
      showPatternOutlineBox: false,
      slotGhostColors: emptyPattern,
    };
  }

  const slotGhostColors: CrateSlotType[] = [...emptyPattern];
  let requiredCount = 0;
  let unfilledCount = 0;

  for (let i = 0; i < 8; i++) {
    const reqColor = recipe.slotHologramColors[i];
    if (reqColor !== 'empty') {
      requiredCount++;
      if ((slots[i] ?? 'empty') === 'empty') {
        slotGhostColors[i] = reqColor;
        unfilledCount++;
      }
    }
  }

  const isFulfilled = requiredCount > 0 && unfilledCount === 0;
  return {
    isActive: true,
    isFulfilled,
    showPatternOutlineBox: !isFulfilled && unfilledCount > 0,
    slotGhostColors: isFulfilled ? emptyPattern : (slotGhostColors as unknown as PadSlotHologramPattern),
  };
}

/**
 * Maximum number of build recipes that can be queued in the Tactical Kiosk Build Queue (`maximal 6 antrian`).
 */
export const MAX_KIOSK_BUILD_QUEUE = 6;

/**
 * Enqueues a build recipe (`recipeId`) into the Kiosk Build Queue (up to `MAX_KIOSK_BUILD_QUEUE = 6` items).
 * Any buildable item in `KIOSK_BUILD_PRIORITY_RECIPES` (weapons, buddies, turrets, vehicles, aircraft)
 * can be added into the continuous build queue.
 */
export function enqueueKioskBuildRecipe(
  currentQueue: ReadonlyArray<KioskBuildPriorityRecipeId>,
  recipeId: KioskBuildPriorityRecipeId,
  maxQueue = MAX_KIOSK_BUILD_QUEUE,
): {
  enqueued: boolean;
  queue: KioskBuildPriorityRecipeId[];
  activeRecipe: KioskBuildPriorityRecipeId;
  statusMessage: string;
} {
  const spec = KIOSK_BUILD_PRIORITY_RECIPES[recipeId];
  const label = spec ? spec.name.toUpperCase() : recipeId.toUpperCase();
  if (currentQueue.length >= maxQueue) {
    return {
      enqueued: false,
      queue: [...currentQueue],
      activeRecipe: currentQueue[0] ?? recipeId,
      statusMessage: `BUILD QUEUE FULL (${currentQueue.length}/${maxQueue})! WAIT OR REMOVE QUEUED ITEMS.`,
    };
  }
  const nextQueue = [...currentQueue, recipeId];
  const activeRecipe = nextQueue[0];
  return {
    enqueued: true,
    queue: nextQueue,
    activeRecipe,
    statusMessage:
      nextQueue.length === 1
        ? `BUILD STARTED (1/${maxQueue}): ${label} (${spec?.targetCrates ?? 1} CRATES)`
        : `ADDED TO BUILD QUEUE (${nextQueue.length}/${maxQueue}): ${label}`,
  };
}

/**
 * Removes an item at `index` from the Kiosk Build Queue.
 */
export function removeKioskBuildQueueAtIndex(
  currentQueue: ReadonlyArray<KioskBuildPriorityRecipeId>,
  index: number,
): {
  queue: KioskBuildPriorityRecipeId[];
  activeRecipe: KioskBuildPriorityRecipeId | null;
} {
  if (index < 0 || index >= currentQueue.length) {
    return {
      queue: [...currentQueue],
      activeRecipe: currentQueue[0] ?? null,
    };
  }
  const nextQueue = currentQueue.filter((_, i) => i !== index);
  return {
    queue: nextQueue,
    activeRecipe: nextQueue[0] ?? null,
  };
}

/**
 * Advances the Kiosk Build Queue when the active front recipe (`currentQueue[0]`) finishes crafting/bursting on the Stacking Pad.
 */
export function advanceKioskBuildQueueOnCraft(
  currentQueue: ReadonlyArray<KioskBuildPriorityRecipeId>,
): {
  queue: KioskBuildPriorityRecipeId[];
  nextActiveRecipe: KioskBuildPriorityRecipeId | null;
  hasMoreQueued: boolean;
} {
  const nextQueue = currentQueue.length > 0 ? currentQueue.slice(1) : [];
  return {
    queue: nextQueue,
    nextActiveRecipe: nextQueue[0] ?? null,
    hasMoreQueued: nextQueue.length > 0,
  };
}

/**
 * Checks whether a crate or pickup at `(x, z)` is located inside a teammate's base plot (`idx !== unitOwnerCommanderId`)
 * or inside the enemy team's base compound (`ai jangan menargetkan mengambil box yang berada di dalam base teman atau musuh`).
 */
export function isCrateInsideOtherOrEnemyBase(
  x: number,
  z: number,
  unitTeam: 'blue' | 'red',
  unitOwnerCommanderId: number,
): boolean {
  const halfPlotWidthWithMargin = INDIVIDUAL_BASE_LEVEL_SPECS.plotWidth * 0.5 + 1.0; // 11.5m
  const halfPlotDepthWithMargin = INDIVIDUAL_BASE_LEVEL_SPECS.plotDepth * 0.5 + 1.5; // 18.5m

  // 1. Check Enemy Base Compound (all 4 enemy plots + compound perimeter)
  const enemyCenterZ =
    unitTeam === 'blue'
      ? INDIVIDUAL_BASE_LEVEL_SPECS.redBaseCenterZ
      : INDIVIDUAL_BASE_LEVEL_SPECS.blueBaseCenterZ;
  if (Math.abs(x) <= 58.0 && Math.abs(z - enemyCenterZ) <= halfPlotDepthWithMargin) {
    return true;
  }

  // 2. Check Teammate Base Plots (`same team`, `idx !== unitOwnerCommanderId`)
  const sameTeamSign = unitTeam === 'blue' ? 1 : -1;
  const sameTeamCenterZ =
    unitTeam === 'blue'
      ? INDIVIDUAL_BASE_LEVEL_SPECS.blueBaseCenterZ
      : INDIVIDUAL_BASE_LEVEL_SPECS.redBaseCenterZ;
  if (Math.abs(z - sameTeamCenterZ) <= halfPlotDepthWithMargin) {
    for (let idx = 0; idx < INDIVIDUAL_BASE_LEVEL_SPECS.basePlotCentersX.length; idx++) {
      if (idx === unitOwnerCommanderId) continue;
      const plotCenterX = sameTeamSign * INDIVIDUAL_BASE_LEVEL_SPECS.basePlotCentersX[idx];
      if (Math.abs(x - plotCenterX) <= halfPlotWidthWithMargin) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Smart, recipe-aware crate selector for AI Buddy harvesters:
 * - NEVER selects `'medical'` crates (which cannot be placed on a Stacking Pad).
 * - NEVER selects crates located inside a teammate's base plot or enemy's base (`isCrateInsideOtherOrEnemyBase`).
 * - When a hologram recipe (`slotHologramColors`) is active on the owner's pad, strictly selects
 *   ONLY grounded crates whose color matches the remaining unfilled hologram slots (`neededAfterInFlight`),
 *   choosing the closest matching crate and never grabbing random wrong-colored crates!
 */
export function selectSmartCrateForAiHarvester<
  TCrate extends {
    x: number;
    z: number;
    kind: WorldCrateKind;
    state: string;
  },
>(
  buddyX: number,
  buddyZ: number,
  crates: ReadonlyArray<TCrate>,
  slots: ReadonlyArray<CrateSlotType>,
  slotHologramColors: PadSlotHologramPattern | null,
  inFlightCarriedCrates: ReadonlyArray<Exclude<WorldCrateKind, 'medical'>> = [],
  strictHologramMatch = true,
  unitTeam: 'blue' | 'red' = 'blue',
  unitOwnerCommanderId = 0,
): {
  selectedCrate: TCrate | null;
  distance: number | null;
  neededColors: Array<'red' | 'super' | 'legend'>;
  unfilledSlotColors: Array<'red' | 'super' | 'legend'>;
} {
  const { unfilledSlotColors, neededAfterInFlight } = getRemainingNeededCrateKindsForHologram(
    slots,
    slotHologramColors,
    inFlightCarriedCrates,
  );

  // If a hologram recipe is active on the pad:
  if (slotHologramColors) {
    // If all hologram slots are already filled or teammates are already carrying the last needed crates, stop harvesting!
    if (unfilledSlotColors.length === 0 || neededAfterInFlight.length === 0) {
      return {
        selectedCrate: null,
        distance: null,
        neededColors: neededAfterInFlight,
        unfilledSlotColors,
      };
    }

    let bestMatchingCrate: TCrate | null = null;
    let bestMatchingDist = Infinity;
    for (let i = 0; i < crates.length; i++) {
      const c = crates[i];
      if (c.state !== 'grounded' || c.kind === 'medical') continue;
      if (isCrateInsideOtherOrEnemyBase(c.x, c.z, unitTeam, unitOwnerCommanderId)) continue;
      if (
        c.kind !== 'silver_metallic' &&
        c.kind !== 'gold_metallic' &&
        !neededAfterInFlight.includes(c.kind)
      ) {
        continue;
      }
      const d = Math.hypot(c.x - buddyX, c.z - buddyZ);
      if (d < bestMatchingDist) {
        bestMatchingDist = d;
        bestMatchingCrate = c;
      }
    }

    if (bestMatchingCrate || strictHologramMatch) {
      return {
        selectedCrate: bestMatchingCrate,
        distance: bestMatchingCrate ? bestMatchingDist : null,
        neededColors: neededAfterInFlight,
        unfilledSlotColors,
      };
    }
  }

  // Fallback for generic AI pads without a strict hologram recipe:
  // Never pick up 'medical' crates or crates inside teammate/enemy bases, and prefer the closest crate matching the existing pad color (or 'red' for standard builds)
  const existingPadColor = slots.find((s) => s !== 'empty') ?? null;
  let bestFallbackCrate: TCrate | null = null;
  let bestFallbackScore = Infinity;
  let bestFallbackDist: number | null = null;

  for (let i = 0; i < crates.length; i++) {
    const c = crates[i];
    if (c.state !== 'grounded' || c.kind === 'medical') continue;
    if (isCrateInsideOtherOrEnemyBase(c.x, c.z, unitTeam, unitOwnerCommanderId)) continue;
    const d = Math.hypot(c.x - buddyX, c.z - buddyZ);
    // Prefer matching the color already on the pad so recipes stay pure instead of random mixed colors!
    const colorPenalty =
      existingPadColor !== null && c.kind !== existingPadColor ? 25.0 : 0.0;
    const score = d + colorPenalty;
    if (score < bestFallbackScore) {
      bestFallbackScore = score;
      bestFallbackDist = d;
      bestFallbackCrate = c;
    }
  }

  return {
    selectedCrate: bestFallbackCrate,
    distance: bestFallbackDist,
    neededColors: neededAfterInFlight,
    unfilledSlotColors,
  };
}

export type KioskBaseGoldUpgradeId =
  | 'upgrade_base_combo'
  | 'upgrade_super_command_lv3'
  | 'upgrade_building_only'
  | 'upgrade_fence_only'
  | 'build_parking_gold'
  | 'build_helipad_gold';

export interface KioskBaseGoldUpgradeCostSpec {
  id: KioskBaseGoldUpgradeId;
  name: string;
  subtitle: string;
  costGold: number;
  alreadyMaxed: boolean;
}

/**
 * Computes expensive Warzone Gold costs (`harga upgrade base tentunya mahal`) for upgrading
 * the Commander Base (Command Center + Iron Fence, or individual facilities) at the Kiosk Machine.
 */
export function getCommanderBaseGoldUpgradeSpecs(
  base: IndividualCommanderBaseState,
): Record<KioskBaseGoldUpgradeId, KioskBaseGoldUpgradeCostSpec> {
  const bLv = base.buildingLevel;
  const fLv = base.fenceLevel;
  const bothMax =
    bLv >= 3 &&
    fLv >= 3 &&
    base.buildingHp >= base.buildingMaxHp &&
    base.fenceHp >= base.fenceMaxHp;

  const comboCost = bLv === 1 || fLv === 1 ? 1200 : bLv === 2 || fLv === 2 ? 2500 : 800;
  const buildingCost = bLv === 1 ? 750 : bLv === 2 ? 1500 : 500;
  const fenceCost = fLv === 1 ? 600 : fLv === 2 ? 1200 : 400;

  return {
    upgrade_base_combo: {
      id: 'upgrade_base_combo',
      name:
        bLv < 3 || fLv < 3
          ? `BASE COMBO UPGRADE (HQ + FENCE LV.${Math.min(3, Math.max(bLv, fLv) + 1)})`
          : 'FULL REPAIR BASE LV.3 MAX',
      subtitle:
        bLv < 3 || fLv < 3
          ? 'Upgrade Command Center + Iron Fence Simultaneously'
          : 'Restore 100% Command Center & Fence HP',
      costGold: comboCost,
      alreadyMaxed: bothMax,
    },
    upgrade_super_command_lv3: {
      id: 'upgrade_super_command_lv3',
      name:
        bLv < 3 || fLv < 3
          ? '3-STORY SUPER COMMAND (UNLOCK HQ LV.3 MAX)'
          : 'FULL REPAIR SUPER COMMAND LV.3',
      subtitle:
        bLv < 3 || fLv < 3
          ? 'Instantly Unlock Command Center Lv.3, 280m Radar, Nuclear Launcher & Cluster Bomb'
          : 'Restore 100% Super Command Center Lv.3 & Fence HP',
      costGold: bLv < 3 || fLv < 3 ? 1200 : 800,
      alreadyMaxed: bothMax,
    },
    upgrade_building_only: {
      id: 'upgrade_building_only',
      name:
        bLv < 3
          ? `UPGRADE COMMAND CENTER TO LV.${bLv + 1}`
          : 'REPAIR COMMAND CENTER LV.3',
      subtitle:
        bLv < 3
          ? `Base HP ${base.buildingMaxHp} -> ${INDIVIDUAL_BASE_LEVEL_SPECS.buildingMaxHpByLevel[bLv as 1 | 2]} HP`
          : `Current HP: ${base.buildingHp}/${base.buildingMaxHp}`,
      costGold: buildingCost,
      alreadyMaxed: bLv >= 3 && base.buildingHp >= base.buildingMaxHp,
    },
    upgrade_fence_only: {
      id: 'upgrade_fence_only',
      name: fLv < 3 ? `UPGRADE IRON FENCE TO LV.${fLv + 1}` : 'REPAIR IRON FENCE LV.3',
      subtitle:
        fLv < 3
          ? `Total Fence HP ${base.fenceMaxHp} -> ${INDIVIDUAL_BASE_LEVEL_SPECS.fenceTotalMaxHpByLevel[fLv as 1 | 2]} HP`
          : `Current Fence HP: ${base.fenceHp}/${base.fenceMaxHp}`,
      costGold: fenceCost,
      alreadyMaxed: fLv >= 3 && base.fenceHp >= base.fenceMaxHp,
    },
    build_parking_gold: {
      id: 'build_parking_gold',
      name: 'BUILD VEHICLE PARKING BAY',
      subtitle: 'Steel Canopy + Tank & Dump Truck Parking Bay Next to Helipad',
      costGold: 800,
      alreadyMaxed: base.hasParkingBay,
    },
    build_helipad_gold: {
      id: 'build_helipad_gold',
      name: 'BUILD HELIPAD (H)',
      subtitle: 'Helipad & Blitz Fighter Plane Landing Pad',
      costGold: 1100,
      alreadyMaxed: base.hasHelipad,
    },
  };
}

export function applyCommanderBaseGoldUpgrade(
  base: IndividualCommanderBaseState,
  upgradeId: KioskBaseGoldUpgradeId,
  currentGold: number,
): { upgraded: boolean; nextGold: number; spentGold: number; message: string } {
  if (base.destroyed) {
    return {
      upgraded: false,
      nextGold: currentGold,
      spentGold: 0,
      message: 'Base has been completely destroyed!',
    };
  }
  const specs = getCommanderBaseGoldUpgradeSpecs(base);
  const spec = specs[upgradeId];
  if (!spec || spec.alreadyMaxed) {
    return {
      upgraded: false,
      nextGold: currentGold,
      spentGold: 0,
      message: 'This facility has already reached Maximum Level!',
    };
  }
  if (currentGold < spec.costGold) {
    return {
      upgraded: false,
      nextGold: currentGold,
      spentGold: 0,
      message: `Not enough Gold! Requires ${spec.costGold} GOLD (Collect Gold in Warzone).`,
    };
  }

  const nextGold = currentGold - spec.costGold;

  if (upgradeId === 'upgrade_base_combo') {
    if (base.buildingLevel < 3) {
      const nextBLv = (base.buildingLevel + 1) as 2 | 3;
      base.buildingLevel = nextBLv;
      base.commandCenterLevel = nextBLv;
      base.buildingMaxHp = INDIVIDUAL_BASE_LEVEL_SPECS.buildingMaxHpByLevel[nextBLv - 1];
    }
    base.buildingHp = base.buildingMaxHp;

    if (base.fenceLevel < 3) {
      const nextFLv = (base.fenceLevel + 1) as 2 | 3;
      base.fenceLevel = nextFLv;
      base.fenceMaxHp = INDIVIDUAL_BASE_LEVEL_SPECS.fenceTotalMaxHpByLevel[nextFLv - 1];
    }
    base.fenceHp = base.fenceMaxHp;

    return {
      upgraded: true,
      nextGold,
      spentGold: spec.costGold,
      message: `BASE UPGRADED! Command Center Lv.${base.buildingLevel} & Fence Lv.${base.fenceLevel}!`,
    };
  }

  if (upgradeId === 'upgrade_super_command_lv3') {
    base.buildingLevel = 3;
    base.commandCenterLevel = 3;
    base.buildingMaxHp = INDIVIDUAL_BASE_LEVEL_SPECS.buildingMaxHpByLevel[2];
    base.buildingHp = base.buildingMaxHp;
    base.fenceLevel = 3;
    base.fenceMaxHp = INDIVIDUAL_BASE_LEVEL_SPECS.fenceTotalMaxHpByLevel[2];
    base.fenceHp = base.fenceMaxHp;
    return {
      upgraded: true,
      nextGold,
      spentGold: spec.costGold,
      message:
        'SUPER COMMAND LV.3 ACTIVE! Nuclear Launcher & CB-24 Cluster Bomb Unlocked!',
    };
  }

  if (upgradeId === 'upgrade_building_only') {
    if (base.buildingLevel < 3) {
      const nextBLv = (base.buildingLevel + 1) as 2 | 3;
      base.buildingLevel = nextBLv;
      base.commandCenterLevel = nextBLv;
      base.buildingMaxHp = INDIVIDUAL_BASE_LEVEL_SPECS.buildingMaxHpByLevel[nextBLv - 1];
    }
    base.buildingHp = base.buildingMaxHp;
    return {
      upgraded: true,
      nextGold,
      spentGold: spec.costGold,
      message: `${INDIVIDUAL_BASE_LEVEL_SPECS.buildingNameByLevel[base.buildingLevel - 1]} (${base.buildingMaxHp} HP)!`,
    };
  }

  if (upgradeId === 'upgrade_fence_only') {
    if (base.fenceLevel < 3) {
      const nextFLv = (base.fenceLevel + 1) as 2 | 3;
      base.fenceLevel = nextFLv;
      base.fenceMaxHp = INDIVIDUAL_BASE_LEVEL_SPECS.fenceTotalMaxHpByLevel[nextFLv - 1];
    }
    base.fenceHp = base.fenceMaxHp;
    return {
      upgraded: true,
      nextGold,
      spentGold: spec.costGold,
      message: `${INDIVIDUAL_BASE_LEVEL_SPECS.fenceNameByLevel[base.fenceLevel - 1]} (${base.fenceMaxHp} HP)!`,
    };
  }

  if (upgradeId === 'build_parking_gold') {
    base.hasParkingBay = true;
    return {
      upgraded: true,
      nextGold,
      spentGold: spec.costGold,
      message: 'Vehicle Parking Bay Constructed!',
    };
  }

  if (upgradeId === 'build_helipad_gold') {
    base.hasHelipad = true;
    return {
      upgraded: true,
      nextGold,
      spentGold: spec.costGold,
      message: 'Helipad (H) Constructed!',
    };
  }

  return { upgraded: false, nextGold: currentGold, spentGold: 0, message: '' };
}

export interface KioskCrateAirdropShopItem {
  kind: WorldCrateKind;
  name: string;
  rarityLabel: string;
  description: string;
  costGold: number;
  accentHex: string;
}

export const KIOSK_CRATE_AIRDROP_SHOP: Record<
  'red' | 'super' | 'legend' | 'medical',
  KioskCrateAirdropShopItem
> = {
  red: {
    kind: 'red',
    name: 'STANDARD CRATE (COMMON)',
    rarityLabel: 'COMMON · YELLOW/RED',
    description: 'Airdrop 1 Standard Crate from the sky right beside your base Crate Pad.',
    costGold: 150,
    accentHex: '#ff4d3d',
  },
  super: {
    kind: 'super',
    name: 'BLUE TECH CRATE (RARE)',
    rarityLabel: 'RARE · TECH UPGRADE',
    description: 'Airdrop 1 Blue (Super/Tech) Crate to craft Super-tier weapons & vehicles.',
    costGold: 350,
    accentHex: '#00d2ff',
  },
  legend: {
    kind: 'legend',
    name: 'SPECIAL CRATE (LEGEND)',
    rarityLabel: 'LEGEND · SUPER WEAPON / JET',
    description: 'Airdrop 1 Gold/Special Crate to craft Fighter Planes, Ninjas, or Super Weapons.',
    costGold: 750,
    accentHex: '#ffd700',
  },
  medical: {
    kind: 'medical',
    name: 'MEDICAL CRATE (RED CROSS)',
    rarityLabel: 'MEDICAL · HEALTH RESTORE',
    description: 'Airdrop 1 White Medical Crate from the air (break open for a +35 HP Medkit).',
    costGold: 200,
    accentHex: '#4ade80',
  },
};

export function purchaseCrateAirdropWithGold(
  crateKind: WorldCrateKind,
  currentGold: number,
): {
  purchased: boolean;
  nextGold: number;
  spentGold: number;
  airdropCrateKind: WorldCrateKind | null;
  message: string;
} {
  const item =
    KIOSK_CRATE_AIRDROP_SHOP[crateKind as keyof typeof KIOSK_CRATE_AIRDROP_SHOP];
  if (!item) {
    return {
      purchased: false,
      nextGold: currentGold,
      spentGold: 0,
      airdropCrateKind: null,
      message: 'Crate type not found.',
    };
  }
  if (currentGold < item.costGold) {
    return {
      purchased: false,
      nextGold: currentGold,
      spentGold: 0,
      airdropCrateKind: null,
      message: `Not enough Gold! Requires ${item.costGold} GOLD for Airdrop ${item.name}.`,
    };
  }
  return {
    purchased: true,
    nextGold: currentGold - item.costGold,
    spentGold: item.costGold,
    airdropCrateKind: crateKind,
    message: `AIRDROP DISPATCHED! ${item.name} is parachuting down to your base!`,
  };
}

// ============================================================================
// CHUNK-SYNCED FOG OF WAR & PERSONAL COMMAND CENTER RADAR COVERAGE
// ============================================================================

/** Half-extent (in meters) of the calibrated square radar map [-125, +125] x [-125, +125]. */
export const RADAR_WORLD_HALF_EXTENT = 125.0;

/** 3D Grass Chunk streaming outer radius (`21.0m`) around player */
export const GRASS_CHUNK_STREAM_RADIUS = 21.0;
export const GRASS_CHUNK_FADE_START_RADIUS = 18.9; // 90% of 21.0m (`smoothstep(0.90, 1.0, dist / halfField)`)

/** Y-offset applied to Land Mines placed on grass so they sit camouflaged among the 3D grass blades */
export const LAND_MINE_GRASS_Y_OFFSET = -0.04;

export interface GrassChunkVisibilityResult {
  visible: boolean;
  /** Smooth 0..1 scale/fade factor matching the 3D grass shader's inner edge (`18.9m .. 21.0m`) */
  scaleFactor: number;
  distance: number;
}

/**
 * Evaluates 3D visibility and smooth scale/fade transition synchronized with the player's
 * 3D grass chunk streaming radius (`GRASS_CHUNK_STREAM_RADIUS = 21.0m`, inner fade `18.9m..21.0m`).
 * - Inside `18.9m`: `visible = true, scaleFactor = 1.0`
 * - Between `18.9m` and `21.0m`: `visible = true`, smooth cubic Hermite fade from `1.0` down to `0.0`
 * - Outside `21.0m`: `visible = false, scaleFactor = 0.0`
 */
export function evaluateGrassChunkVisibilityFactor(
  targetX: number,
  targetZ: number,
  viewerX: number,
  viewerZ: number,
  innerFadeRadius: number = GRASS_CHUNK_FADE_START_RADIUS,
  outerRadius: number = GRASS_CHUNK_STREAM_RADIUS,
): GrassChunkVisibilityResult {
  const distance = Math.hypot(targetX - viewerX, targetZ - viewerZ);
  if (distance >= outerRadius) {
    return {
      visible: false,
      scaleFactor: 0,
      distance,
    };
  }
  if (distance <= innerFadeRadius) {
    return {
      visible: true,
      scaleFactor: 1,
      distance,
    };
  }
  const t = clamp(
    (distance - innerFadeRadius) / Math.max(1e-4, outerRadius - innerFadeRadius),
    0,
    1,
  );
  const smooth = t * t * (3 - 2 * t);
  const scaleFactor = Math.max(0.02, 1 - smooth);
  return {
    visible: true,
    scaleFactor,
    distance,
  };
}

/** Outer radius (20.8m) for dynamic gameplay object chunk culling around the player character, matched to grass carpet edge (42.0m * 0.495) */
export const DYNAMIC_CHUNK_CULLING_OUTER_RADIUS = 20.8;
/** Inner fade start radius (17.5m) where dynamic gameplay objects begin smooth scale interpolation down to 0 at the grass boundary */
export const DYNAMIC_CHUNK_CULLING_FADE_START_RADIUS = 17.5;
/** Spawn/teleport invincibility & 10Hz blink duration (1.5 seconds) without any camera shake */
export const PLAYER_SPAWN_BLINK_DURATION_SEC = 1.5;

/**
 * Evaluates smooth 3D chunk culling (`scaleFactor` in `[0, 1]` and `visible`) for dynamic gameplay
 * objects (`crate`, `pickup`, `explosive_barrel`, `ordnance`, and enemy Warzone units/vehicles)
 * within the 26.0m radius around the player character:
 * - Inside `innerFadeRadius` (`21.5m`): `scaleFactor = 1.0`, `visible = true`
 * - Between `21.5m` and `26.0m`: smooth cubic Hermite easing from `1.0` down to `0.0`
 * - Only sets `visible = false` when `scaleFactor < 0.01` (`distance >= outerRadius`), eliminating harsh pop-in.
 */
export function evaluateChunkSynced3DFogOfWar(
  targetX: number,
  targetZ: number,
  viewerX: number,
  viewerZ: number,
  innerFadeRadius: number = DYNAMIC_CHUNK_CULLING_FADE_START_RADIUS,
  outerRadius: number = DYNAMIC_CHUNK_CULLING_OUTER_RADIUS,
): GrassChunkVisibilityResult {
  const distance = Math.hypot(targetX - viewerX, targetZ - viewerZ);
  if (distance >= outerRadius) {
    return {
      visible: false,
      scaleFactor: 0,
      distance,
    };
  }
  if (distance <= innerFadeRadius) {
    return {
      visible: true,
      scaleFactor: 1,
      distance,
    };
  }
  const t = clamp(
    (distance - innerFadeRadius) / Math.max(1e-4, outerRadius - innerFadeRadius),
    0,
    1,
  );
  const smooth = t * t * (3 - 2 * t);
  const scaleFactor = Math.max(0, 1 - smooth);
  return {
    visible: scaleFactor >= 0.01,
    scaleFactor: scaleFactor >= 0.01 ? scaleFactor : 0,
    distance,
  };
}

/**
 * Computes the vertical Y offset for a Land Mine (`land_mine`) based on the local grass mask (`0..1`).
 * When placed in a grassy area (`grassMask > 0.25`), lowers Y by `-0.04m` so it is camouflaged among grass blades.
 */
export function computeLandMineGrassYOffset(grassMask: number): number {
  return grassMask > 0.25 ? LAND_MINE_GRASS_Y_OFFSET : 0.0;
}

export interface CommandCenterRadarSpec {
  level: 1 | 2 | 3;
  /** Map coverage percentage from the player's Command Center (Lv.1 = 45%, Lv.2 = 75%, Lv.3 = 100%) */
  coveragePct: 45 | 75 | 100;
  /** Scan radius (in meters) radiating from the player's personal Command Center when operator is active */
  baseRadarRadius: number;
  /** Local personal scan radius (in meters) around the active Player character/vehicle, synced with 3D grass chunk radius (21.0m) */
  playerVisionRadius: number;
  /** True at Level 3 when an active radar operator unlocks 100% of the arena */
  fullMapUnlocked: boolean;
  /** Whether the long-range Command Center radar is currently manned & active */
  radarActive: boolean;
  /** Short HUD badge label */
  label: string;
}

/**
 * Evaluates the personal Command Center radar specification for a given Command Center level (`1 | 2 | 3`)
 * and operator activation state (`radarActive`):
 * - `playerVisionRadius` is strictly synchronized with `GRASS_CHUNK_STREAM_RADIUS` (`21.0m`).
 * - When `radarActive === true`:
 *   - Level 1 = 45% map coverage (`112.5m` radius from Command Center)
 *   - Level 2 = 75% map coverage (`187.5m` radius from Command Center)
 *   - Level 3 = 100% map coverage (`280.0m` radius / full map unlocked)
 * - When `radarActive === false`:
 *   - Long-range Command Center radar is OFF (`baseRadarRadius = 0`, `fullMapUnlocked = false`);
 *     the dark Fog of War area on the Minimap is completely blind outside the player's 21m circle.
 */
export function evaluateCommandCenterRadarSpec(
  buildingLevel: number,
  radarActive = true,
): CommandCenterRadarSpec {
  const lv: 1 | 2 | 3 = buildingLevel >= 3 ? 3 : buildingLevel === 2 ? 2 : 1;
  const fullMapSpan = RADAR_WORLD_HALF_EXTENT * 2.0; // 250.0m
  if (!radarActive) {
    const coveragePct: 45 | 75 | 100 = lv === 3 ? 100 : lv === 2 ? 75 : 45;
    return {
      level: lv,
      coveragePct,
      baseRadarRadius: 0,
      playerVisionRadius: GRASS_CHUNK_STREAM_RADIUS,
      fullMapUnlocked: false,
      radarActive: false,
      label: `RADAR LV.${lv} · OFFLINE (NEEDS DEFEND)`,
    };
  }
  if (lv === 3) {
    return {
      level: 3,
      coveragePct: 100,
      baseRadarRadius: 280.0,
      playerVisionRadius: GRASS_CHUNK_STREAM_RADIUS,
      fullMapUnlocked: true,
      radarActive: true,
      label: 'RADAR LV.3 · 100% MAP',
    };
  }
  if (lv === 2) {
    return {
      level: 2,
      coveragePct: 75,
      baseRadarRadius: fullMapSpan * 0.75, // 187.5m (75% map)
      playerVisionRadius: GRASS_CHUNK_STREAM_RADIUS,
      fullMapUnlocked: false,
      radarActive: true,
      label: 'RADAR LV.2 · 75% MAP',
    };
  }
  return {
    level: 1,
    coveragePct: 45,
    baseRadarRadius: fullMapSpan * 0.45, // 112.5m (45% map)
    playerVisionRadius: GRASS_CHUNK_STREAM_RADIUS,
    fullMapUnlocked: false,
    radarActive: true,
    label: 'RADAR LV.1 · 45% MAP',
  };
}

/**
 * Checks whether a position `(unitX, unitZ)` is inside the personal Command Center / base plot area
 * of `base` (either within 13.5m of the Command Center building or inside the plot's perimeter footprint).
 */
export function isUnitInPersonalCommandCenterArea(
  unitX: number,
  unitZ: number,
  base: Pick<
    IndividualCommanderBaseState,
    'plotCenterX' | 'plotCenterZ' | 'buildingX' | 'buildingZ' | 'destroyed'
  >,
): boolean {
  if (base.destroyed) return false;
  const distToBuilding = Math.hypot(unitX - base.buildingX, unitZ - base.buildingZ);
  if (distToBuilding <= 13.5) return true;
  const halfW = INDIVIDUAL_BASE_LEVEL_SPECS.plotWidth * 0.5 + 1.5; // 12.0m
  const halfD = INDIVIDUAL_BASE_LEVEL_SPECS.plotDepth * 0.5 + 1.5; // 18.5m
  return (
    Math.abs(unitX - base.plotCenterX) <= halfW &&
    Math.abs(unitZ - base.plotCenterZ) <= halfD
  );
}

export interface RadarOperatorCandidateUnit {
  id: number;
  team: 'blue' | 'red';
  ownerCommanderId: number;
  alive: boolean;
  command: 'FOLLOW' | 'ATTACK' | 'HARVEST' | 'DEFEND' | 'MOUNT';
  x: number;
  z: number;
}

export interface PersonalCommandCenterRadarOperatorStatus {
  radarActive: boolean;
  operatorSource: 'own_defend_unit' | 'player_in_command_center' | 'none';
  operatorUnitId: number | null;
  commandCenterLevel: 1 | 2 | 3;
  coveragePct: 45 | 75 | 100;
  baseRadarRadius: number;
  playerVisionRadius: number;
}

/**
 * Evaluates whether a commander's Personal Command Center Radar is active:
 * - Each base and strategy is the sole responsibility of that plot/base owner
 *   (teammates or allied AI commanders with `ownerCommanderId !== base.commanderIdx` CANNOT activate our radar).
 * - Long-range Command Center Radar is ONLY active (`radarActive = true`) if:
 *   1. At least 1 living squad unit owned by that player (`u.team === base.team && u.ownerCommanderId === base.commanderIdx && u.alive`)
 *      is set to role `DEFEND` (`u.command === 'DEFEND'`) and stationed inside their own Command Center / base area, OR
 *   2. The player's own main character (`playerMainCharacter`) is alive and currently inside their own Command Center / base area.
 */
export function evaluatePersonalCommandCenterRadarOperator(
  base: IndividualCommanderBaseState,
  squadUnits: ReadonlyArray<RadarOperatorCandidateUnit>,
  playerMainCharacter?: {
    team: 'blue' | 'red';
    ownerCommanderId: number;
    alive: boolean;
    x: number;
    z: number;
  } | null,
): PersonalCommandCenterRadarOperatorStatus {
  const lv: 1 | 2 | 3 =
    (base.commandCenterLevel ?? base.buildingLevel) >= 3
      ? 3
      : (base.commandCenterLevel ?? base.buildingLevel) === 2
        ? 2
        : 1;

  if (base.destroyed || base.buildingHp <= 0) {
    const specOff = evaluateCommandCenterRadarSpec(lv, false);
    return {
      radarActive: false,
      operatorSource: 'none',
      operatorUnitId: null,
      commandCenterLevel: lv,
      coveragePct: specOff.coveragePct,
      baseRadarRadius: 0,
      playerVisionRadius: specOff.playerVisionRadius,
    };
  }

  for (let i = 0; i < squadUnits.length; i++) {
    const u = squadUnits[i];
    if (!u.alive) continue;
    if (u.team !== base.team) continue;
    // Strictly require own squad unit (teammates/AI allies cannot activate our base radar)
    if (u.ownerCommanderId !== base.commanderIdx) continue;
    if (u.command !== 'DEFEND') continue;
    if (isUnitInPersonalCommandCenterArea(u.x, u.z, base)) {
      const specOn = evaluateCommandCenterRadarSpec(lv, true);
      return {
        radarActive: true,
        operatorSource: 'own_defend_unit',
        operatorUnitId: u.id,
        commandCenterLevel: lv,
        coveragePct: specOn.coveragePct,
        baseRadarRadius: specOn.baseRadarRadius,
        playerVisionRadius: specOn.playerVisionRadius,
      };
    }
  }

  if (
    playerMainCharacter &&
    playerMainCharacter.alive &&
    playerMainCharacter.team === base.team &&
    playerMainCharacter.ownerCommanderId === base.commanderIdx &&
    isUnitInPersonalCommandCenterArea(playerMainCharacter.x, playerMainCharacter.z, base)
  ) {
    const specOn = evaluateCommandCenterRadarSpec(lv, true);
    return {
      radarActive: true,
      operatorSource: 'player_in_command_center',
      operatorUnitId: null,
      commandCenterLevel: lv,
      coveragePct: specOn.coveragePct,
      baseRadarRadius: specOn.baseRadarRadius,
      playerVisionRadius: specOn.playerVisionRadius,
    };
  }

  const specOff = evaluateCommandCenterRadarSpec(lv, false);
  return {
    radarActive: false,
    operatorSource: 'none',
    operatorUnitId: null,
    commandCenterLevel: lv,
    coveragePct: specOff.coveragePct,
    baseRadarRadius: 0,
    playerVisionRadius: specOff.playerVisionRadius,
  };
}

export function worldCoordToRadarPercent(
  worldX: number,
  worldZ: number,
  halfExtent: number = RADAR_WORLD_HALF_EXTENT,
): { leftPct: number; topPct: number } {
  const span = halfExtent * 2.0;
  const leftPct = Math.max(3, Math.min(97, ((worldX + halfExtent) / span) * 100));
  const topPct = Math.max(3, Math.min(97, ((worldZ + halfExtent) / span) * 100));
  return { leftPct, topPct };
}

export function isPointVisibleOnCommandCenterRadar(
  targetX: number,
  targetZ: number,
  isFriendlyOrSelf: boolean,
  buildingLevel: number,
  baseCenterX: number,
  baseCenterZ: number,
  playerX: number,
  playerZ: number,
  radarActive = true,
): boolean {
  if (isFriendlyOrSelf) return true;
  const spec = evaluateCommandCenterRadarSpec(buildingLevel, radarActive);
  const distFromPlayer = Math.hypot(targetX - playerX, targetZ - playerZ);
  if (distFromPlayer <= spec.playerVisionRadius) return true;
  if (!spec.radarActive) return false;
  if (spec.fullMapUnlocked) return true;
  const distFromBase = Math.hypot(targetX - baseCenterX, targetZ - baseCenterZ);
  return distFromBase <= spec.baseRadarRadius;
}

export interface NuclearLauncherAccessEvaluation {
  allowed: boolean;
  isRevealed: boolean;
  requiredLevel: 3;
  currentLevel: 1 | 2 | 3;
  maxLockRangeMeters: number;
  statusMessage: string;
}

/**
 * Evaluates whether the Tactical Nuclear Missile Launcher (`MLRS-MK5 'ATLAS'`) is revealed and buildable:
 * - At Command Center Lv.1 or Lv.2: Locked & hidden as a black silhouette with `?` (`isRevealed: false`, `allowed: false`).
 * - At Command Center Lv.3: Revealed in full 1:1 detail (`isRevealed: true`, `allowed: true`) with full-map 280m radar lock range.
 */
export function evaluateNuclearLauncherAccess(
  buildingLevel: number,
): NuclearLauncherAccessEvaluation {
  const lv: 1 | 2 | 3 = buildingLevel >= 3 ? 3 : buildingLevel === 2 ? 2 : 1;
  if (lv >= 3) {
    return {
      allowed: true,
      isRevealed: true,
      requiredLevel: 3,
      currentLevel: 3,
      maxLockRangeMeters: 280.0,
      statusMessage:
        "COMMAND CENTER LV.3 ACTIVE: 280m Radar ready to lock long-range targets for the MLRS-MK5 'ATLAS' Nuclear Launcher!",
    };
  }
  return {
    allowed: false,
    isRevealed: false,
    requiredLevel: 3,
    currentLevel: lv,
    maxLockRangeMeters: 0,
    statusMessage: `LOCKED! Requires Command Center Lv.3 (Currently Lv.${lv}) so Long-Range Radar can lock Nuclear Launcher targets!`,
  };
}

export interface ClusterBombAccessEvaluation {
  allowedToBuild: boolean;
  isRevealed: boolean;
  canDropNow: boolean;
  onlyUsableByPlane: true;
  requiredLevel: 3;
  currentLevel: 1 | 2 | 3;
  statusMessage: string;
}

/**
 * Evaluates whether the CB-24 Cluster Bomb (`cluster_bomb`) is revealed in the Kiosk and whether it can be dropped:
 * - At Command Center Lv.1 or Lv.2: Locked & hidden as a pure black silhouette + `?` (`isRevealed: false`, `allowedToBuild: false`).
 * - At Command Center Lv.3: Revealed in full 1:1 detail (`isRevealed: true`, `allowedToBuild: true`),
 *   and can ONLY be dropped while piloting the Blitz Fighter Plane (`canDropNow = isPilotingPlane`).
 */
export function evaluateClusterBombAccess(
  buildingLevel: number,
  isPilotingPlane = false,
): ClusterBombAccessEvaluation {
  const lv: 1 | 2 | 3 = buildingLevel >= 3 ? 3 : buildingLevel === 2 ? 2 : 1;
  if (lv < 3) {
    return {
      allowedToBuild: false,
      isRevealed: false,
      canDropNow: false,
      onlyUsableByPlane: true,
      requiredLevel: 3,
      currentLevel: lv,
      statusMessage: `LOCKED! Requires Command Center Lv.3 (Currently Lv.${lv}) to unlock the CB-24 Cluster Bomb!`,
    };
  }
  return {
    allowedToBuild: true,
    isRevealed: true,
    canDropNow: isPilotingPlane,
    onlyUsableByPlane: true,
    requiredLevel: 3,
    currentLevel: 3,
    statusMessage: isPilotingPlane
      ? 'CB-24 CLUSTER BOMB READY TO DROP FROM FIGHTER PLANE!'
      : 'PLANE ONLY! CB-24 Cluster Bomb can only be dropped while piloting the Blitz Fighter Plane!',
  };
}

export type NuclearStrikePhase =
  | 'idle'
  | 'targeting'
  | 'tracking_rocket'
  | 'watching_explosion'
  | 'returning';

export interface NuclearStrikeSequenceState {
  phase: NuclearStrikePhase;
  phaseElapsedSec: number;
  originPlayerPos: Vec3;
  launchPos: Vec3;
  targetPos: Vec3;
  rocketPos: Vec3;
  rocketTangent: Vec3;
  flightDurationSec: number;
  explosionWatchDurationSec: number;
  returnDurationSec: number;
  hasDetonated: boolean;
}

function smoothstep01(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function createInitialNuclearStrikeState(): NuclearStrikeSequenceState {
  return {
    phase: 'idle',
    phaseElapsedSec: 0,
    originPlayerPos: { x: 0, y: 1, z: 0 },
    launchPos: { x: 0, y: 2.35, z: 0 },
    targetPos: { x: 0, y: 0, z: -24 },
    rocketPos: { x: 0, y: 2.35, z: 0 },
    rocketTangent: { x: 0, y: 0.7, z: -0.7 },
    flightDurationSec: 2.55,
    explosionWatchDurationSec: 2.15,
    returnDurationSec: 1.15,
    hasDetonated: false,
  };
}

export function beginNuclearStrikeTargeting(
  originPlayerPos: Vec3,
  launchPos: Vec3,
  initialTargetPos: Vec3,
): NuclearStrikeSequenceState {
  return {
    phase: 'targeting',
    phaseElapsedSec: 0,
    originPlayerPos: { ...originPlayerPos },
    launchPos: { ...launchPos },
    targetPos: {
      x: clamp(initialTargetPos.x, -96, 96),
      y: initialTargetPos.y,
      z: clamp(initialTargetPos.z, -96, 96),
    },
    rocketPos: { ...launchPos },
    rocketTangent: { x: 0, y: 1, z: 0 },
    flightDurationSec: 2.55,
    explosionWatchDurationSec: 2.15,
    returnDurationSec: 1.15,
    hasDetonated: false,
  };
}

export function updateNuclearStrikeTargetCursor(
  state: NuclearStrikeSequenceState,
  cursorX: number,
  cursorY: number,
  cursorZ: number,
  maxRangeMeters = 280.0,
): NuclearStrikeSequenceState {
  if (state.phase !== 'targeting') return state;
  let tx = clamp(cursorX, -96, 96);
  let tz = clamp(cursorZ, -96, 96);
  const dx = tx - state.launchPos.x;
  const dz = tz - state.launchPos.z;
  const dist = Math.hypot(dx, dz);
  if (dist > maxRangeMeters && dist > 1e-5) {
    const s = maxRangeMeters / dist;
    tx = clamp(state.launchPos.x + dx * s, -96, 96);
    tz = clamp(state.launchPos.z + dz * s, -96, 96);
  }
  return {
    ...state,
    targetPos: { x: tx, y: cursorY, z: tz },
  };
}

export function confirmNuclearStrikeTargetAndLaunch(
  state: NuclearStrikeSequenceState,
  overrideTargetPos?: Vec3,
): NuclearStrikeSequenceState {
  const finalTarget = overrideTargetPos
    ? {
        x: clamp(overrideTargetPos.x, -96, 96),
        y: overrideTargetPos.y,
        z: clamp(overrideTargetPos.z, -96, 96),
      }
    : { ...state.targetPos };
  const dx = finalTarget.x - state.launchPos.x;
  const dz = finalTarget.z - state.launchPos.z;
  const horizDist = Math.hypot(dx, dz);
  // Ensure even short-range or long-range launches have a smooth, dramatic flight time (2.1s .. 2.85s)
  const flightDurationSec = clamp(1.95 + horizDist * 0.0085, 2.1, 2.85);
  const arcPeak = Math.max(18.0, Math.min(34.0, horizDist * 0.28 + 12.0));
  const initDy = finalTarget.y - state.launchPos.y + 4.0 * arcPeak;
  const tLen = Math.hypot(dx, initDy, dz) || 1;

  return {
    ...state,
    phase: 'tracking_rocket',
    phaseElapsedSec: 0,
    targetPos: finalTarget,
    rocketPos: { ...state.launchPos },
    rocketTangent: { x: dx / tLen, y: initDy / tLen, z: dz / tLen },
    flightDurationSec,
    hasDetonated: false,
  };
}

export function stepNuclearStrikeSequence(
  state: NuclearStrikeSequenceState,
  dt: number,
  currentOriginPlayerPos?: Vec3,
): {
  state: NuclearStrikeSequenceState;
  justDetonated: boolean;
  justCompletedReturn: boolean;
} {
  if (state.phase === 'idle') {
    return { state, justDetonated: false, justCompletedReturn: false };
  }

  const nextOrigin = currentOriginPlayerPos ? { ...currentOriginPlayerPos } : state.originPlayerPos;
  const nextElapsed = state.phaseElapsedSec + Math.max(0, dt);

  if (state.phase === 'targeting') {
    return {
      state: {
        ...state,
        phaseElapsedSec: nextElapsed,
        originPlayerPos: nextOrigin,
      },
      justDetonated: false,
      justCompletedReturn: false,
    };
  }

  if (state.phase === 'tracking_rocket') {
    const u = clamp(nextElapsed / Math.max(0.1, state.flightDurationSec), 0, 1);
    const dx = state.targetPos.x - state.launchPos.x;
    const dz = state.targetPos.z - state.launchPos.z;
    const dyBase = state.targetPos.y - state.launchPos.y;
    const horizDist = Math.hypot(dx, dz);
    const arcPeak = Math.max(18.0, Math.min(34.0, horizDist * 0.28 + 12.0));

    const rx = state.launchPos.x + dx * u;
    const rz = state.launchPos.z + dz * u;
    const ry = state.launchPos.y + dyBase * u + 4.0 * arcPeak * u * (1.0 - u);

    const tangDy = dyBase + 4.0 * arcPeak * (1.0 - 2.0 * u);
    const tangLen = Math.hypot(dx, tangDy, dz) || 1;
    const rocketTangent: Vec3 = {
      x: dx / tangLen,
      y: tangDy / tangLen,
      z: dz / tangLen,
    };

    if (u >= 1.0) {
      return {
        state: {
          ...state,
          phase: 'watching_explosion',
          phaseElapsedSec: 0,
          originPlayerPos: nextOrigin,
          rocketPos: { ...state.targetPos },
          rocketTangent,
          hasDetonated: true,
        },
        justDetonated: true,
        justCompletedReturn: false,
      };
    }

    return {
      state: {
        ...state,
        phaseElapsedSec: nextElapsed,
        originPlayerPos: nextOrigin,
        rocketPos: { x: rx, y: ry, z: rz },
        rocketTangent,
      },
      justDetonated: false,
      justCompletedReturn: false,
    };
  }

  if (state.phase === 'watching_explosion') {
    if (nextElapsed >= state.explosionWatchDurationSec) {
      return {
        state: {
          ...state,
          phase: 'returning',
          phaseElapsedSec: 0,
          originPlayerPos: nextOrigin,
        },
        justDetonated: false,
        justCompletedReturn: false,
      };
    }
    return {
      state: {
        ...state,
        phaseElapsedSec: nextElapsed,
        originPlayerPos: nextOrigin,
      },
      justDetonated: false,
      justCompletedReturn: false,
    };
  }

  // phase === 'returning'
  if (nextElapsed >= state.returnDurationSec) {
    return {
      state: {
        ...state,
        phase: 'idle',
        phaseElapsedSec: 0,
        originPlayerPos: nextOrigin,
      },
      justDetonated: false,
      justCompletedReturn: true,
    };
  }

  return {
    state: {
      ...state,
      phaseElapsedSec: nextElapsed,
      originPlayerPos: nextOrigin,
    },
    justDetonated: false,
    justCompletedReturn: false,
  };
}

export interface NuclearStrikeCameraPose {
  cameraPos: Vec3;
  lookAtPos: Vec3;
  focusPivotPos: Vec3;
  fov: number;
  isPreImpactRising: boolean;
  horizontalDistToTarget: number;
}

/**
 * Computes the exact 3D Camera Position & LookAt target for every phase of the Nuclear Launcher sequence:
 * 1. `targeting`: Map zooms out high above the arena so the player can pick the target coordinate.
 * 2. `tracking_rocket`:
 *    - Early/mid flight (`u < 0.65`): Cinematic camera follows close behind/alongside the flying rocket.
 *    - Pre-impact approach (`u >= 0.65`): Camera rises upward (`isPreImpactRising: true`) and settles at a
 *      close-medium vantage point (~14.2m horizontal distance, ~12.6m elevation — NEVER too far!) looking down
 *      at the target impact point.
 * 3. `watching_explosion`: Holds the close-medium elevated vantage point (~14.2m–15.4m distance) watching the nuclear blast.
 * 4. `returning`: Smoothly glides back to the player's original camera position (`originPlayerPos`).
 */
export function computeNuclearStrikeCameraPose(
  state: NuclearStrikeSequenceState,
  defaultCamOffset: Vec3 = { x: 0, y: 16.5, z: 19.5 },
): NuclearStrikeCameraPose {
  const originCamPos: Vec3 = {
    x: state.originPlayerPos.x + defaultCamOffset.x,
    y: state.originPlayerPos.y + defaultCamOffset.y,
    z: state.originPlayerPos.z + defaultCamOffset.z,
  };
  const originLookAt: Vec3 = {
    x: state.originPlayerPos.x,
    y: state.originPlayerPos.y - 1.15,
    z: state.originPlayerPos.z - 2.5,
  };

  if (state.phase === 'idle') {
    return {
      cameraPos: originCamPos,
      lookAtPos: originLookAt,
      focusPivotPos: { ...state.originPlayerPos },
      fov: 42,
      isPreImpactRising: false,
      horizontalDistToTarget: Math.hypot(
        originCamPos.x - state.targetPos.x,
        originCamPos.z - state.targetPos.z,
      ),
    };
  }

  if (state.phase === 'targeting') {
    const zoomBlend = smoothstep01(0, 0.42, state.phaseElapsedSec);
    // Center the zoomed-out tactical view gently toward the target reticle so the whole arena is visible
    const mapFocusX = clamp(state.targetPos.x * 0.45, -45, 45);
    const mapFocusZ = clamp(state.targetPos.z * 0.45, -45, 45);
    const topCamPos: Vec3 = {
      x: mapFocusX,
      y: 108.0,
      z: mapFocusZ + 26.0,
    };
    const topLookAt: Vec3 = {
      x: mapFocusX,
      y: 0.0,
      z: mapFocusZ - 3.5,
    };
    const cameraPos: Vec3 = {
      x: originCamPos.x + (topCamPos.x - originCamPos.x) * zoomBlend,
      y: originCamPos.y + (topCamPos.y - originCamPos.y) * zoomBlend,
      z: originCamPos.z + (topCamPos.z - originCamPos.z) * zoomBlend,
    };
    const lookAtPos: Vec3 = {
      x: originLookAt.x + (topLookAt.x - originLookAt.x) * zoomBlend,
      y: originLookAt.y + (topLookAt.y - originLookAt.y) * zoomBlend,
      z: originLookAt.z + (topLookAt.z - originLookAt.z) * zoomBlend,
    };
    return {
      cameraPos,
      lookAtPos,
      focusPivotPos: { ...state.targetPos },
      fov: 42 + 4 * zoomBlend,
      isPreImpactRising: false,
      horizontalDistToTarget: Math.hypot(
        cameraPos.x - state.targetPos.x,
        cameraPos.z - state.targetPos.z,
      ),
    };
  }

  // Direction vector from launchPos to targetPos in XZ plane
  const rawDx = state.targetPos.x - state.launchPos.x;
  const rawDz = state.targetPos.z - state.launchPos.z;
  const rawHorizLen = Math.hypot(rawDx, rawDz);
  const dirX = rawHorizLen > 1e-4 ? rawDx / rawHorizLen : 0;
  const dirZ = rawHorizLen > 1e-4 ? rawDz / rawHorizLen : -1;
  const rightX = -dirZ;
  const rightZ = dirX;

  // Close-medium explosion observation pose (13.6m behind + 3.8m right => ~14.1m horizontal distance, 12.8m height)
  // Critically satisfies: "setelah mau mendekat camera naik dan melihat ledakan nya (kamera jangan terlalu jauh)"
  const impactWatchCamPos: Vec3 = {
    x: state.targetPos.x - dirX * 13.6 + rightX * 3.8,
    y: state.targetPos.y + 12.8,
    z: state.targetPos.z - dirZ * 13.6 + rightZ * 3.8,
  };
  const impactWatchLookAt: Vec3 = {
    x: state.targetPos.x,
    y: state.targetPos.y + 1.8,
    z: state.targetPos.z,
  };

  if (state.phase === 'tracking_rocket') {
    const u = clamp(state.phaseElapsedSec / Math.max(0.1, state.flightDurationSec), 0, 1);
    // Rocket chase camera (follows closely behind & slightly right of the rocket)
    const chaseCamPos: Vec3 = {
      x: state.rocketPos.x - dirX * 8.4 + rightX * 3.4,
      y: state.rocketPos.y + 2.8,
      z: state.rocketPos.z - dirZ * 8.4 + rightZ * 3.4,
    };
    const chaseLookAt: Vec3 = {
      x: state.rocketPos.x + state.rocketTangent.x * 3.2,
      y: state.rocketPos.y + state.rocketTangent.y * 1.6,
      z: state.rocketPos.z + state.rocketTangent.z * 3.2,
    };

    // When u >= 0.65 (rocket gets close to target), camera rises upward and locks onto the explosion view!
    const isPreImpactRising = u >= 0.65;
    const riseBlend = smoothstep01(0.65, 1.0, u);
    const extraRiseLift = isPreImpactRising ? Math.sin(riseBlend * Math.PI * 0.5) * 2.4 : 0;

    const cameraPos: Vec3 = {
      x: chaseCamPos.x + (impactWatchCamPos.x - chaseCamPos.x) * riseBlend,
      y: chaseCamPos.y + (impactWatchCamPos.y - chaseCamPos.y) * riseBlend + extraRiseLift,
      z: chaseCamPos.z + (impactWatchCamPos.z - chaseCamPos.z) * riseBlend,
    };
    const lookAtPos: Vec3 = {
      x: chaseLookAt.x + (impactWatchLookAt.x - chaseLookAt.x) * riseBlend,
      y: chaseLookAt.y + (impactWatchLookAt.y - chaseLookAt.y) * riseBlend,
      z: chaseLookAt.z + (impactWatchLookAt.z - chaseLookAt.z) * riseBlend,
    };

    return {
      cameraPos,
      lookAtPos,
      focusPivotPos: isPreImpactRising ? { ...state.targetPos } : { ...state.rocketPos },
      fov: 42,
      isPreImpactRising,
      horizontalDistToTarget: Math.hypot(
        cameraPos.x - state.targetPos.x,
        cameraPos.z - state.targetPos.z,
      ),
    };
  }

  // Slow cinematic drift during explosion watch (stays close: ~14.1m to ~15.4m horizontal distance)
  const watchProgress = clamp(
    state.phaseElapsedSec / Math.max(0.1, state.explosionWatchDurationSec),
    0,
    1,
  );
  const endWatchCamPos: Vec3 = {
    x: impactWatchCamPos.x - dirX * 1.1 + rightX * 1.2 * watchProgress,
    y: impactWatchCamPos.y + 2.4 + 1.4 * watchProgress,
    z: impactWatchCamPos.z - dirZ * 1.1 + rightZ * 1.2 * watchProgress,
  };
  const endWatchLookAt: Vec3 = {
    x: impactWatchLookAt.x,
    y: impactWatchLookAt.y + 0.6 * watchProgress,
    z: impactWatchLookAt.z,
  };

  if (state.phase === 'watching_explosion') {
    return {
      cameraPos: endWatchCamPos,
      lookAtPos: endWatchLookAt,
      focusPivotPos: { ...state.targetPos },
      fov: 42,
      isPreImpactRising: true,
      horizontalDistToTarget: Math.hypot(
        endWatchCamPos.x - state.targetPos.x,
        endWatchCamPos.z - state.targetPos.z,
      ),
    };
  }

  // phase === 'returning': Smoothly glide from the explosion vantage point back to originCamPos
  const returnBlend = smoothstep01(
    0,
    1,
    state.phaseElapsedSec / Math.max(0.1, state.returnDurationSec),
  );
  const startReturnCamPos: Vec3 = {
    x: impactWatchCamPos.x - dirX * 1.1 + rightX * 1.2,
    y: impactWatchCamPos.y + 3.8,
    z: impactWatchCamPos.z - dirZ * 1.1 + rightZ * 1.2,
  };
  const cameraPos: Vec3 = {
    x: startReturnCamPos.x + (originCamPos.x - startReturnCamPos.x) * returnBlend,
    y: startReturnCamPos.y + (originCamPos.y - startReturnCamPos.y) * returnBlend,
    z: startReturnCamPos.z + (originCamPos.z - startReturnCamPos.z) * returnBlend,
  };
  const lookAtPos: Vec3 = {
    x: impactWatchLookAt.x + (originLookAt.x - impactWatchLookAt.x) * returnBlend,
    y: impactWatchLookAt.y + 0.6 + (originLookAt.y - (impactWatchLookAt.y + 0.6)) * returnBlend,
    z: impactWatchLookAt.z + (originLookAt.z - impactWatchLookAt.z) * returnBlend,
  };
  const focusPivotPos: Vec3 = {
    x: state.targetPos.x + (state.originPlayerPos.x - state.targetPos.x) * returnBlend,
    y: state.targetPos.y + (state.originPlayerPos.y - state.targetPos.y) * returnBlend,
    z: state.targetPos.z + (state.originPlayerPos.z - state.targetPos.z) * returnBlend,
  };

  return {
    cameraPos,
    lookAtPos,
    focusPivotPos,
    fov: 42,
    isPreImpactRising: false,
    horizontalDistToTarget: Math.hypot(
      cameraPos.x - state.targetPos.x,
      cameraPos.z - state.targetPos.z,
    ),
  };
}

// ============================================================================
// DYNAMIC SUPPLY DROP EVENT (CENTRAL OASIS & HARBOR DOCK) + METALLIC BOX BOOST
// ============================================================================

export type SupplyDropLocationId = 'CENTRAL_OASIS' | 'HARBOR_DOCK';

export interface SupplyDropLocationSpec {
  id: SupplyDropLocationId;
  name: 'CENTRAL OASIS' | 'HARBOR DOCK';
  x: number;
  z: number;
}

export const SUPPLY_DROP_LOCATIONS: Record<SupplyDropLocationId, SupplyDropLocationSpec> = {
  CENTRAL_OASIS: {
    id: 'CENTRAL_OASIS',
    name: 'CENTRAL OASIS',
    x: -20.5,
    z: 0.0,
  },
  HARBOR_DOCK: {
    id: 'HARBOR_DOCK',
    name: 'HARBOR DOCK',
    x: 0.0,
    z: 14.5,
  },
};

export const SUPPLY_DROP_INTERVAL_MIN_SEC = 45.0;
export const SUPPLY_DROP_INTERVAL_MAX_SEC = 70.0;
export const SUPPLY_DROP_WARNING_WINDOW_SEC = 15.0;

export interface SupplyDropLandingPayload {
  locationId: SupplyDropLocationId;
  locationName: 'CENTRAL OASIS' | 'HARBOR DOCK';
  x: number;
  z: number;
  goldCoinCount: number; // 5..8 large gold coins (@ +150 G)
  goldCoinValue: number; // 150 G
  medkitCount: number; // 2..3 medkits
  medkitHealAmount: number; // +65 HP significant heal
  metallicCrateKind: 'silver_metallic' | 'gold_metallic'; // 65% Silver, 35% Shiny Gold
  indestructible: true;
}

export interface SupplyDropScheduleState {
  nextLocationId: SupplyDropLocationId;
  timeRemainingSec: number;
  intervalDurationSec: number;
  warningActive: boolean;
  countdownSec: number;
  bannerText: string | null;
  activeBeaconLocation: SupplyDropLocationSpec | null;
  lastLandingLocation: SupplyDropLocationSpec | null;
  lastLandingAgeSec: number;
  dropCycleCount: number;
}

export function computeNextSupplyDropIntervalSec(rng: () => number = Math.random): number {
  const u = clamp(rng(), 0, 1);
  return SUPPLY_DROP_INTERVAL_MIN_SEC + u * (SUPPLY_DROP_INTERVAL_MAX_SEC - SUPPLY_DROP_INTERVAL_MIN_SEC);
}

export function formatSupplyDropCountdownBanner(
  locationName: 'CENTRAL OASIS' | 'HARBOR DOCK',
  countdownSec: number,
): string {
  const sec = Math.max(1, Math.ceil(countdownSec));
  return `SUPPLY DROP AT ${locationName} IN ${sec} SECONDS!`;
}

export function createInitialSupplyDropScheduleState(
  rng: () => number = Math.random,
  initialLocationId: SupplyDropLocationId = 'CENTRAL_OASIS',
): SupplyDropScheduleState {
  const interval = computeNextSupplyDropIntervalSec(rng);
  return {
    nextLocationId: initialLocationId,
    timeRemainingSec: interval,
    intervalDurationSec: interval,
    warningActive: false,
    countdownSec: Math.ceil(interval),
    bannerText: null,
    activeBeaconLocation: null,
    lastLandingLocation: null,
    lastLandingAgeSec: 999,
    dropCycleCount: 0,
  };
}

export function generateSupplyDropLandingPayload(
  locationId: SupplyDropLocationId,
  rng: () => number = Math.random,
): SupplyDropLandingPayload {
  const loc = SUPPLY_DROP_LOCATIONS[locationId];
  const goldCoinCount = clamp(5 + Math.floor(rng() * 4), 5, 8); // 5..8 coins
  const medkitCount = clamp(2 + Math.floor(rng() * 2), 2, 3); // 2..3 medkits
  const metallicCrateKind: 'silver_metallic' | 'gold_metallic' =
    rng() < 0.65 ? 'silver_metallic' : 'gold_metallic';

  return {
    locationId: loc.id,
    locationName: loc.name,
    x: loc.x,
    z: loc.z,
    goldCoinCount,
    goldCoinValue: 150,
    medkitCount,
    medkitHealAmount: 65,
    metallicCrateKind,
    indestructible: true,
  };
}

export function stepSupplyDropSchedule(
  state: SupplyDropScheduleState,
  dt: number,
  rng: () => number = Math.random,
): {
  state: SupplyDropScheduleState;
  landedPayload: SupplyDropLandingPayload | null;
} {
  const safeDt = clamp(dt, 0, 1.0);
  const nextRemaining = state.timeRemainingSec - safeDt;
  const nextLandingAge = state.lastLandingAgeSec + safeDt;
  const currentLoc = SUPPLY_DROP_LOCATIONS[state.nextLocationId];

  if (nextRemaining <= 0) {
    const landedPayload = generateSupplyDropLandingPayload(state.nextLocationId, rng);
    const alternateLocId: SupplyDropLocationId =
      state.nextLocationId === 'CENTRAL_OASIS' ? 'HARBOR_DOCK' : 'CENTRAL_OASIS';
    const nextInterval = computeNextSupplyDropIntervalSec(rng);

    return {
      state: {
        nextLocationId: alternateLocId,
        timeRemainingSec: nextInterval,
        intervalDurationSec: nextInterval,
        warningActive: false,
        countdownSec: Math.ceil(nextInterval),
        bannerText: null,
        activeBeaconLocation: currentLoc,
        lastLandingLocation: currentLoc,
        lastLandingAgeSec: 0,
        dropCycleCount: state.dropCycleCount + 1,
      },
      landedPayload,
    };
  }

  const warningActive = nextRemaining <= SUPPLY_DROP_WARNING_WINDOW_SEC;
  const countdownSec = Math.max(1, Math.ceil(nextRemaining));
  const bannerText = warningActive
    ? formatSupplyDropCountdownBanner(currentLoc.name, countdownSec)
    : null;
  const activeBeaconLocation = warningActive
    ? currentLoc
    : nextLandingAge <= 25.0 && state.lastLandingLocation
    ? state.lastLandingLocation
    : null;

  return {
    state: {
      ...state,
      timeRemainingSec: nextRemaining,
      warningActive,
      countdownSec,
      bannerText,
      activeBeaconLocation,
      lastLandingAgeSec: nextLandingAge,
    },
    landedPayload: null,
  };
}

export function canDamageWorldCrate(crate: {
  indestructible?: boolean;
  kind?: WorldCrateKind;
}): boolean {
  if (crate.indestructible) return false;
  if (crate.kind === 'silver_metallic' || crate.kind === 'gold_metallic') return false;
  return true;
}

export interface MetallicCratePadBoostResult {
  kind: 'silver_metallic' | 'gold_metallic';
  bonusGold: number;
  bonusScore: number;
  boostType: 'overpower_weapon' | 'overpower_vehicle';
  buildOrder: BuildOrderTarget;
  filledSlots: CrateSlotType[];
  rewardLabel: string;
  overpowerWeaponId?: 'laser' | 'gatling' | 'rocket';
  overpowerWeaponName?: string;
  overpowerVehicleKind?: 'tank' | 'plane';
  overpowerVehicleIsSuper?: boolean;
}

/**
 * Evaluates the instant Stacking Pad reward when a special indestructible Metallic Supply Box
 * is delivered back to a Commander's Stacking Pad:
 * - `silver_metallic` (Silver Metallic Box): Instant full boost to craft an Overpower Weapon (highest tier) + `+300 G`.
 * - `gold_metallic` (Shiny Gold Metallic Box): Instant full `2x2x2` boost to craft an Overpower Vehicle (Heavy Tank / Elite Vehicle) + `+600 G`.
 */
export function evaluateSpecialMetallicCratePadBoost(
  kind: 'silver_metallic' | 'gold_metallic',
): MetallicCratePadBoostResult {
  if (kind === 'silver_metallic') {
    return {
      kind: 'silver_metallic',
      bonusGold: 300,
      bonusScore: 300,
      boostType: 'overpower_weapon',
      buildOrder: '2x2x1',
      filledSlots: ['legend', 'legend', 'super', 'super', 'empty', 'empty', 'empty', 'empty'],
      rewardLabel: 'SILVER SUPPLY BOOST: OVERPOWER WEAPON + 300G!',
      overpowerWeaponId: 'laser',
      overpowerWeaponName: 'LG-88 Photon Lance (Overpower Tier)',
    };
  }
  return {
    kind: 'gold_metallic',
    bonusGold: 600,
    bonusScore: 600,
    boostType: 'overpower_vehicle',
    buildOrder: '2x2x2',
    filledSlots: ['legend', 'legend', 'legend', 'legend', 'super', 'super', 'super', 'super'],
    rewardLabel: 'GOLD SUPPLY BOOST: HEAVY TANK 2x2x2 OVERPOWER + 600G!',
    overpowerVehicleKind: 'tank',
    overpowerVehicleIsSuper: true,
  };
}

// ============================================================================
// BOTTOM SCREEN ROLE UI FORMATTER & AUTONOMOUS TACTICAL ESCORT AI FOR FOLLOWER
// ============================================================================

/**
 * Formats a unit's tactical role (`TeamCommandMode`) into the bottom-screen UI label format:
 * - `HARVEST` -> `"Role : Harvester"`
 * - `ATTACK`  -> `"Role : Attacker"`
 * - `FOLLOW`  -> `"Role : Follower"`
 * - `DEFEND`  -> `"Role : Defender"`
 */
export function formatBuddyRoleUiLabel(role: TeamCommandMode): string {
  switch (role) {
    case 'HARVEST':
      return 'Role : Harvester';
    case 'ATTACK':
    case 'MOUNT':
      return 'Role : Attacker';
    case 'FOLLOW':
      return 'Role : Follower';
    case 'DEFEND':
      return 'Role : Defender';
  }
}

export const FOLLOWER_COMFORT_ZONE_MIN_M = 2.5;
export const FOLLOWER_COMFORT_ZONE_MAX_M = 4.2;
export const FOLLOWER_REACTION_DELAY_SEC = 0.22;
export const FOLLOWER_NEARBY_PICKUP_RADIUS_M = 3.0;
export const FOLLOWER_SEPARATION_RADIUS_M = 2.5;

export function stepFollowerSmoothYaw(
  currentYaw: number,
  targetYaw: number,
  dt: number,
  turnRateRadPerSec = 9.5,
): number {
  const safeDt = clamp(dt, 0, 0.1);
  const diff = shortestAngleDelta(currentYaw, targetYaw);
  const blend = 1 - Math.exp(-turnRateRadPerSec * safeDt);
  return currentYaw + diff * blend;
}

export interface AutonomousFollowerEscortInput {
  followerId: string;
  followerX: number;
  followerZ: number;
  followerVx: number;
  followerVz: number;
  followerYaw: number;
  followerMaxSpeed: number;
  followerCarryingCrate: boolean;
  reactionTimerSec: number;
  idleLookTimerSec: number;
  idleLookYaw: number;
  strafeTimerSec: number;
  strafeSign: 1 | -1;
  playerX: number;
  playerZ: number;
  playerVx: number;
  playerVz: number;
  playerCarryingCrate: boolean;
  alliedFollowers: ReadonlyArray<{ id: string; x: number; z: number }>;
  nearestEnemy: { x: number; z: number; dist: number } | null;
  nearbyItemsAndCrates: ReadonlyArray<{
    id: string;
    kind: 'crate' | 'pickup';
    x: number;
    z: number;
    dist: number;
  }>;
  combatRangeMeters?: number;
  navGrid?: AStarNavGrid | null;
  aStarSteerDirX?: number;
  aStarSteerDirZ?: number;
  dt: number;
}

export interface AutonomousFollowerEscortResult {
  vx: number;
  vz: number;
  yaw: number;
  goalX: number;
  goalZ: number;
  isInsideComfortZone: boolean;
  isPursuingPlayer: boolean;
  isEngagingEnemy: boolean;
  isStrafing: boolean;
  shouldFire: boolean;
  usedAStarPathfinding: boolean;
  pathWaypoints: Array<{ x: number; z: number }>;
  targetPickupOrCrateId: string | null;
  reactionTimerSec: number;
  idleLookTimerSec: number;
  idleLookYaw: number;
  strafeTimerSec: number;
  strafeSign: 1 | -1;
}

/**
 * Evaluates Autonomous Tactical Escort behavior for a `Follower` unit (replacing rigid offset mirroring
 * and giving each Follower its own independent A* pathfinder in the area around the player):
 * a) Independent Tactical Slot & Hysteresis Comfort Zone (`2.5m` to `4.2m`, zero mirroring):
 *    - Never mirrors `playerVx` / `playerVz`!
 *    - If inside the comfort zone (`distToPlayer <= 4.2m`) and not actively completing a catch-up run,
 *      the Follower holds guard in the area around the player without moving when the player shifts.
 *    - When `distToPlayer > 4.2m`, waits for a brief reaction delay (`0.22s`), picks an independent
 *      tactical flank slot (`~2.75m` radius around the player at a personal flank angle), and walks all the way
 *      into the inner comfort ring (`<= 3.05m`) using its own A* pathfinder before stopping.
 * b) Independent A* Pathfinding (`navGrid` / `aStarSteerDirX, aStarSteerDirZ`):
 *    - Computes obstacle-avoiding A* waypoints around walls, fences, gates, and water toward `(goalX, goalZ)`.
 * c) Tactical Separation:
 *    - Pushes apart from other Followers/allies within `2.5m` so multiple Followers spread around the player naturally.
 * d) Independent Combat Engagement & Strafing:
 *    - When an enemy is within `combatRangeMeters` (default `15.5m`), independently aims smoothly at the enemy,
 *      strafes laterally left/right to dodge incoming fire while staying near the player, and sets `shouldFire = true`.
 * e) Idle Look-Around & Nearby `< 3.0m` Pickup:
 *    - When stationary and out of combat, periodically glances around (`idleLookYaw`).
 *    - If an item or crate is within `< 3.0m`, proactively pathfinds to pick it up while continuing to escort the player.
 */
export function evaluateAutonomousFollowerEscortStep(
  input: AutonomousFollowerEscortInput,
): AutonomousFollowerEscortResult {
  const safeDt = clamp(input.dt, 0.001, 0.1);
  const combatRange = input.combatRangeMeters ?? 15.5;

  const toPlayerDx = input.playerX - input.followerX;
  const toPlayerDz = input.playerZ - input.followerZ;
  const distToPlayer = Math.hypot(toPlayerDx, toPlayerDz);
  const isInsideComfortZone =
    distToPlayer >= FOLLOWER_COMFORT_ZONE_MIN_M && distToPlayer <= FOLLOWER_COMFORT_ZONE_MAX_M;

  // Deterministic personal flank offset so each Follower chooses its own spot around the player (never mirroring playerVx/Vz)
  let idHash = 0;
  for (let i = 0; i < input.followerId.length; i++) {
    idHash = (idHash * 31 + input.followerId.charCodeAt(i)) & 0x7fffffff;
  }
  const flankSectorSign = idHash % 2 === 0 ? 1 : -1;
  const flankSpreadRad = (0.38 + ((idHash % 5) * 0.12)) * flankSectorSign;

  // 1. Check nearby (< 3.0m) item or crate for proactive pickup
  let chosenItem: { id: string; kind: 'crate' | 'pickup'; x: number; z: number; dist: number } | null =
    null;
  for (let i = 0; i < input.nearbyItemsAndCrates.length; i++) {
    const item = input.nearbyItemsAndCrates[i];
    if (item.dist >= FOLLOWER_NEARBY_PICKUP_RADIUS_M) continue;
    if (item.kind === 'crate' && input.followerCarryingCrate) continue;
    if (!chosenItem || item.dist < chosenItem.dist) {
      chosenItem = item;
    }
  }

  // 2. Tactical separation from other Followers/allies so they never stack on one spot
  let sepX = 0;
  let sepZ = 0;
  for (let i = 0; i < input.alliedFollowers.length; i++) {
    const ally = input.alliedFollowers[i];
    if (ally.id === input.followerId) continue;
    const adx = input.followerX - ally.x;
    const adz = input.followerZ - ally.z;
    const adist = Math.hypot(adx, adz);
    if (adist < FOLLOWER_SEPARATION_RADIUS_M) {
      if (adist > 0.01) {
        const pushWeight = (FOLLOWER_SEPARATION_RADIUS_M - adist) / FOLLOWER_SEPARATION_RADIUS_M;
        sepX += (adx / adist) * pushWeight * 4.2;
        sepZ += (adz / adist) * pushWeight * 4.2;
      } else {
        const hashAngle = ((idHash || 1) % 11) * 0.58;
        sepX += Math.cos(hashAngle) * 3.5;
        sepZ += Math.sin(hashAngle) * 3.5;
      }
    }
  }

  // 3. Hysteresis Pursuit & Independent Tactical Goal Selection around the player (zero mirroring)
  let nextReactionTimer = input.reactionTimerSec;
  let isPursuingPlayer = false;
  let goalX = input.followerX;
  let goalZ = input.followerZ;
  let baseMoveSpeed = 0;

  const wasAlreadyPursuing = input.reactionTimerSec >= FOLLOWER_REACTION_DELAY_SEC;
  const shouldCatchUpToPlayer =
    distToPlayer > FOLLOWER_COMFORT_ZONE_MAX_M ||
    (wasAlreadyPursuing && distToPlayer > 3.05);

  if (chosenItem) {
    goalX = chosenItem.x;
    goalZ = chosenItem.z;
    baseMoveSpeed = input.followerMaxSpeed * 0.88;
  } else if (shouldCatchUpToPlayer) {
    nextReactionTimer += safeDt;
    if (nextReactionTimer >= FOLLOWER_REACTION_DELAY_SEC) {
      isPursuingPlayer = true;
      // Compute an angled tactical flank position in the area around the player (~2.75m radius)
      // rotated by `flankSpreadRad` so the Follower does not trace a straight tether line behind the player
      const approachAngle = Math.atan2(input.followerZ - input.playerZ, input.followerX - input.playerX);
      const tacticalSlotAngle = approachAngle + flankSpreadRad;
      const targetRingRadius = 2.75;
      goalX = input.playerX + Math.cos(tacticalSlotAngle) * targetRingRadius + sepX * 0.35;
      goalZ = input.playerZ + Math.sin(tacticalSlotAngle) * targetRingRadius + sepZ * 0.35;

      const excessDist = Math.max(0, distToPlayer - 3.05);
      const speedScale = clamp(0.62 + excessDist * 0.16, 0.62, 1.08);
      baseMoveSpeed = input.followerMaxSpeed * speedScale;
    }
  } else {
    // Inside comfort zone (<= 4.2m and reached inner ring): reset pursuit timer and do NOT mirror player motion!
    nextReactionTimer = 0;
    if (distToPlayer < 1.55) {
      // Gently step out to a comfortable 2.6m personal radius around the player
      const awayAngle =
        distToPlayer > 0.02
          ? Math.atan2(-toPlayerDz, -toPlayerDx) + flankSpreadRad * 0.5
          : flankSpreadRad;
      goalX = input.playerX + Math.cos(awayAngle) * 2.6;
      goalZ = input.playerZ + Math.sin(awayAngle) * 2.6;
      baseMoveSpeed = input.followerMaxSpeed * 0.52;
    }
  }

  // 4. Independent A* Pathfinder Steering toward (goalX, goalZ)
  let desiredVelX = sepX;
  let desiredVelZ = sepZ;
  let usedAStarPathfinding = false;
  let pathWaypoints: Array<{ x: number; z: number }> = [];

  const goalDx = goalX - input.followerX;
  const goalDz = goalZ - input.followerZ;
  const distToGoal = Math.hypot(goalDx, goalDz);

  if (baseMoveSpeed > 0.05 && distToGoal > 0.25) {
    let steerDirX = goalDx / distToGoal;
    let steerDirZ = goalDz / distToGoal;

    const wpLookaheadDist = Math.max(0.95, Math.min(1.65, input.followerMaxSpeed * 0.11));

    if (
      input.aStarSteerDirX !== undefined &&
      input.aStarSteerDirZ !== undefined &&
      Math.hypot(input.aStarSteerDirX, input.aStarSteerDirZ) > 0.01
    ) {
      const sLen = Math.hypot(input.aStarSteerDirX, input.aStarSteerDirZ);
      steerDirX = input.aStarSteerDirX / sLen;
      steerDirZ = input.aStarSteerDirZ / sLen;
      usedAStarPathfinding = true;
    } else if (input.navGrid && distToGoal > 1.1) {
      const aStarRes = findPathAStar(
        input.navGrid,
        input.followerX,
        input.followerZ,
        goalX,
        goalZ,
        { allowDiagonal: true, maxIterations: 1600 },
      );
      pathWaypoints = aStarRes.waypoints;
      if (aStarRes.waypoints.length > 0) {
        usedAStarPathfinding = true;
        let chosenWp = aStarRes.waypoints[aStarRes.waypoints.length - 1];
        for (let wi = 0; wi < aStarRes.waypoints.length; wi++) {
          const wp = aStarRes.waypoints[wi];
          if (Math.hypot(wp.x - input.followerX, wp.z - input.followerZ) >= wpLookaheadDist) {
            chosenWp = wp;
            break;
          }
        }
        const wdx = chosenWp.x - input.followerX;
        const wdz = chosenWp.z - input.followerZ;
        const wlen = Math.hypot(wdx, wdz);
        if (wlen > 0.01) {
          steerDirX = wdx / wlen;
          steerDirZ = wdz / wlen;
        }
      }
    }

    // Smooth arrival slowdown within 1.65m of goal so high-speed Followers never overshoot or oscillate
    const arrivalRamp = distToGoal < 1.65 ? clamp(distToGoal / 1.65, 0.35, 1.0) : 1.0;
    const effectiveMoveSpeed = Math.min(baseMoveSpeed * arrivalRamp, distToGoal / safeDt);
    desiredVelX = steerDirX * effectiveMoveSpeed + sepX * 0.65;
    desiredVelZ = steerDirZ * effectiveMoveSpeed + sepZ * 0.65;
  }

  // 5. Independent Combat Engagement & Tactical Strafing
  let isEngagingEnemy = false;
  let isStrafing = false;
  let shouldFire = false;
  let nextStrafeTimer = input.strafeTimerSec;
  let nextStrafeSign: 1 | -1 = input.strafeSign;

  if (input.nearestEnemy && input.nearestEnemy.dist <= combatRange) {
    isEngagingEnemy = true;
    shouldFire = true;
    nextStrafeTimer -= safeDt;
    if (nextStrafeTimer <= 0) {
      nextStrafeTimer = 0.85 + ((idHash % 5) * 0.14);
      nextStrafeSign = input.strafeSign === 1 ? -1 : 1;
    }

    const edx = input.nearestEnemy.x - input.followerX;
    const edz = input.nearestEnemy.z - input.followerZ;
    const edist = Math.max(0.01, Math.hypot(edx, edz));
    // Perpendicular strafe vector in XZ plane
    const perpX = (-edz / edist) * nextStrafeSign;
    const perpZ = (edx / edist) * nextStrafeSign;

    // Only strafe if not far outside the player's escort leash (< 7.5m)
    if (distToPlayer <= 7.5) {
      isStrafing = true;
      const strafeSpeed = input.followerMaxSpeed * 0.48;
      desiredVelX += perpX * strafeSpeed;
      desiredVelZ += perpZ * strafeSpeed;
    }
  }

  // Clamp total desired speed
  const desiredSpeed = Math.hypot(desiredVelX, desiredVelZ);
  const maxAllowedSpeed = input.followerMaxSpeed * 1.08;
  if (desiredSpeed > maxAllowedSpeed && desiredSpeed > 0.001) {
    desiredVelX = (desiredVelX / desiredSpeed) * maxAllowedSpeed;
    desiredVelZ = (desiredVelZ / desiredSpeed) * maxAllowedSpeed;
  }

  // Crisp velocity acceleration / damping calibrated for +45% foot speed (prevents ground sliding)
  const accelRate = desiredSpeed > 0.15 ? 14.0 : 17.5;
  const velBlend = 1 - Math.exp(-accelRate * safeDt);
  let nextVx = input.followerVx + (desiredVelX - input.followerVx) * velBlend;
  let nextVz = input.followerVz + (desiredVelZ - input.followerVz) * velBlend;
  if (Math.hypot(nextVx, nextVz) < 0.08 && desiredSpeed < 0.08) {
    nextVx = 0;
    nextVz = 0;
  }

  // 6. Smooth Yaw Rotation (Combat Aim > Movement Heading > Idle Look-Around)
  let nextIdleLookTimer = input.idleLookTimerSec - safeDt;
  let nextIdleLookYaw = input.idleLookYaw;
  let targetYaw = input.followerYaw;

  if (isEngagingEnemy && input.nearestEnemy) {
    const edx = input.nearestEnemy.x - input.followerX;
    const edz = input.nearestEnemy.z - input.followerZ;
    targetYaw = Math.atan2(-edz, edx);
  } else if (Math.hypot(nextVx, nextVz) > 0.35) {
    targetYaw = Math.atan2(-nextVz, nextVx);
    nextIdleLookYaw = targetYaw;
  } else {
    // Stationary & out of combat: periodically look around scanning the area
    if (nextIdleLookTimer <= 0) {
      nextIdleLookTimer = 1.8 + ((idHash % 4) * 0.45);
      const turnStep = ((Math.round(input.followerX * 10 + input.followerZ * 10) % 3) - 1) * 0.95 || 0.85;
      nextIdleLookYaw = input.idleLookYaw + turnStep;
    }
    targetYaw = nextIdleLookYaw;
  }

  const nextYaw = stepFollowerSmoothYaw(
    input.followerYaw,
    targetYaw,
    safeDt,
    isEngagingEnemy ? 15.0 : 11.5,
  );

  return {
    vx: nextVx,
    vz: nextVz,
    yaw: nextYaw,
    goalX,
    goalZ,
    isInsideComfortZone,
    isPursuingPlayer,
    isEngagingEnemy,
    isStrafing,
    shouldFire,
    usedAStarPathfinding,
    pathWaypoints,
    targetPickupOrCrateId: chosenItem ? chosenItem.id : null,
    reactionTimerSec: nextReactionTimer,
    idleLookTimerSec: nextIdleLookTimer,
    idleLookYaw: nextIdleLookYaw,
    strafeTimerSec: nextStrafeTimer,
    strafeSign: nextStrafeSign,
  };
}

// ============================================================================
// KIOSK SIDE HOLOGRAM PROJECTOR & CRATE PAD KICK-TO-CANCEL SHATTER MECHANICS
// ============================================================================

export type KioskSideHologramModelKind =
  | 'pistol_uzi'
  | 'assault_plasma'
  | 'bazooka'
  | 'supazooka'
  | 'laser_gun'
  | 'gatling_mortar'
  | 'hand_grenade'
  | 'land_mine'
  | 'cluster_bomb'
  | 'skyshield_turret'
  | 'nuclear_launcher'
  | 'buddy_unit'
  | 'tank'
  | 'plane'
  | 'truck'
  | 'upgrade';

export interface KioskSideHologramDisplayState {
  visible: boolean;
  modelKind: KioskSideHologramModelKind;
  titleText: string;
  progressFractionText: string;
  subtitleText: string;
  filledCrates: number;
  targetCrates: number;
  progressRatio: number;
  hologramHexColor: string;
  hologramColorInt: number;
}

/**
 * Evaluates the 3D Hologram shape and progress readout (`misal 1/5`) displayed on top of the
 * Tactical Kiosk's side scale platform (`sx = 0.58`) for the weapon, squad unit, or item currently being built.
 */
export function evaluateKioskSideHologramDisplay(
  useCustomHologramRecipe: boolean,
  activePriorityRecipe: KioskBuildPriorityRecipeId,
  buildOrder: BuildOrderTarget,
  padSlots: ReadonlyArray<CrateSlotType>,
  buildQueue: ReadonlyArray<KioskBuildPriorityRecipeId> = [],
): KioskSideHologramDisplayState {
  const filledCrates = padSlots.reduce((acc, s) => (s !== 'empty' ? acc + 1 : acc), 0);

  if (useCustomHologramRecipe && KIOSK_BUILD_PRIORITY_RECIPES[activePriorityRecipe]) {
    const spec = KIOSK_BUILD_PRIORITY_RECIPES[activePriorityRecipe];
    const targetCrates = Math.max(1, spec.targetCrates);
    const progressFractionText = `${filledCrates}/${targetCrates}`;
    const progressRatio = Math.max(0, Math.min(1, filledCrates / targetCrates));

    let modelKind: KioskSideHologramModelKind = 'pistol_uzi';
    switch (activePriorityRecipe) {
      case 'pistol_uzi':
        modelKind = 'pistol_uzi';
        break;
      case 'assault_plasma':
        modelKind = 'assault_plasma';
        break;
      case 'bazooka':
        modelKind = 'bazooka';
        break;
      case 'supazooka':
        modelKind = 'supazooka';
        break;
      case 'laser_gun':
        modelKind = 'laser_gun';
        break;
      case 'gatling_mortar':
        modelKind = 'gatling_mortar';
        break;
      case 'hand_grenade':
        modelKind = 'hand_grenade';
        break;
      case 'land_mine':
        modelKind = 'land_mine';
        break;
      case 'cluster_bomb':
        modelKind = 'cluster_bomb';
        break;
      case 'skyshield_turret':
        modelKind = 'skyshield_turret';
        break;
      case 'nuclear_launcher':
        modelKind = 'nuclear_launcher';
        break;
      case 'buddy_infantry':
      case 'buddy_commando':
      case 'buddy_ninja':
      case 'buddy_super_wall':
        modelKind = 'buddy_unit';
        break;
      case 'dump_truck':
        modelKind = 'truck';
        break;
      case 'mini_tank':
      case 'blitz_tank':
      case 'tyrant_tank':
        modelKind = 'tank';
        break;
      case 'blitz_plane':
        modelKind = 'plane';
        break;
      default:
        modelKind = 'pistol_uzi';
        break;
    }

    const hasLegend = spec.slotHologramColors.includes('legend');
    const hasSuper = spec.slotHologramColors.includes('super');
    const hologramHexColor =
      filledCrates >= targetCrates
        ? '#4ade80'
        : hasLegend
          ? '#ffd700'
          : hasSuper
            ? '#00d2ff'
            : '#38bdf8';
    const hologramColorInt =
      filledCrates >= targetCrates
        ? 0x4ade80
        : hasLegend
          ? 0xffd700
          : hasSuper
            ? 0x00d2ff
            : 0x38bdf8;

    const queueBadge =
      buildQueue.length > 1 ? ` [QUEUE 1/${buildQueue.length}]` : '';

    return {
      visible: true,
      modelKind,
      titleText: `${spec.name.toUpperCase()}${queueBadge}`,
      progressFractionText,
      subtitleText:
        filledCrates > 0
          ? `BOX: ${progressFractionText} · [F] KICK PAD = CANCEL`
          : `BOX: ${progressFractionText} · BUILDING`,
      filledCrates,
      targetCrates,
      progressRatio,
      hologramHexColor,
      hologramColorInt,
    };
  }

  // Fallback when using manual [Q] buildOrder or when build queue is empty
  const orderSpec = BUILD_ORDER_SPECS[buildOrder] ?? BUILD_ORDER_SPECS['1x1x1'];
  const targetCrates = Math.max(1, orderSpec.targetCrates);
  const progressFractionText = `${filledCrates}/${targetCrates}`;
  const progressRatio = Math.max(0, Math.min(1, filledCrates / targetCrates));

  let modelKind: KioskSideHologramModelKind = 'pistol_uzi';
  if (buildOrder === '1x1x2' || buildOrder === '2x1x2') {
    modelKind = 'buddy_unit';
  } else if (buildOrder === '2x1x1') {
    modelKind = 'bazooka';
  } else if (buildOrder === '2x2x1') {
    modelKind = 'truck';
  } else if (buildOrder === '2x2x2') {
    modelKind = 'tank';
  } else if (
    buildOrder === 'upgrade_building' ||
    buildOrder === 'upgrade_fence' ||
    buildOrder === 'build_parking' ||
    buildOrder === 'build_helipad'
  ) {
    modelKind = 'upgrade';
  }

  return {
    visible: true,
    modelKind,
    titleText:
      filledCrates === 0 && !useCustomHologramRecipe
        ? `SELECT BUILD IN KIOSK [B]`
        : orderSpec.label.toUpperCase(),
    progressFractionText,
    subtitleText:
      filledCrates > 0
        ? `BOX: ${progressFractionText} · [F] KICK PAD = CANCEL`
        : `BOX: ${progressFractionText} · [B] OPEN KIOSK`,
    filledCrates,
    targetCrates,
    progressRatio,
    hologramHexColor: '#00d2ff',
    hologramColorInt: 0x00d2ff,
  };
}

export interface PadCancelKickShatterDropSpec {
  kind: 'weapon' | 'secondary' | 'health' | 'ammo' | 'coin_gold';
  label: string;
  weaponId?: 'pistol' | 'rifle';
  remainingAmmo?: number;
  secondaryId?: 'hand_grenade' | 'land_mine';
  secondaryCount?: number;
  coinValue?: number;
}

/**
 * Evaluates the cancellation of an in-progress Crate Pad build when the player kicks (`[F]`)
 * the stacked boxes on the Crate Pad:
 * - Cancels the active build on the pad.
 * - Shatters all stacked boxes on the pad into small ground pickups such as Pistol (`pistol`),
 *   Granat (`hand_grenade`), Medkit (`health`), Land Mine (`land_mine`), Ammo (`ammo`), and Coin (`coin_gold`).
 */
export function evaluatePadCancelKickShatterDrops(
  padSlots: ReadonlyArray<CrateSlotType>,
  rollFn: () => number = Math.random,
): {
  cancelled: boolean;
  shatteredCrateCount: number;
  drops: PadCancelKickShatterDropSpec[];
} {
  const nonEmptyCrates = padSlots.filter((s) => s !== 'empty');
  if (nonEmptyCrates.length === 0) {
    return {
      cancelled: false,
      shatteredCrateCount: 0,
      drops: [],
    };
  }

  const smallItemPool: PadCancelKickShatterDropSpec[] = [
    {
      kind: 'weapon',
      label: 'UZI / Pistol T1',
      weaponId: 'pistol',
      remainingAmmo: 60,
    },
    {
      kind: 'secondary',
      label: 'HG-04 Frag Grenade',
      secondaryId: 'hand_grenade',
      secondaryCount: 2,
    },
    {
      kind: 'health',
      label: 'Medkit (+65 HP)',
    },
    {
      kind: 'secondary',
      label: 'TM-89 Land Mine',
      secondaryId: 'land_mine',
      secondaryCount: 1,
    },
    {
      kind: 'ammo',
      label: 'Ammo Pack (+50%)',
    },
    {
      kind: 'coin_gold',
      label: 'Scrap Gold (+50G)',
      coinValue: 50,
    },
  ];

  const drops: PadCancelKickShatterDropSpec[] = [];
  // Each shattered crate yields 2 small items (up to max 8 drops) so even 1-2 kicked crates
  // reliably burst into a mix of Pistol, Grenade, Medkit, etc.!
  for (let i = 0; i < nonEmptyCrates.length; i++) {
    const crateKind = nonEmptyCrates[i];
    // Primary deterministic item cycles through Pistol -> Grenade -> Medkit -> Land Mine -> Ammo -> Coin
    const primarySpec = smallItemPool[i % smallItemPool.length];
    drops.push({ ...primarySpec });

    if (drops.length < 8) {
      // Bonus secondary small item based on crate tier + rollFn
      const bonusIdx =
        crateKind === 'legend' || crateKind === 'super'
          ? (i + 1 + Math.floor(rollFn() * 2)) % 3 // Pistol, Grenade, or Medkit
          : (i + 2 + Math.floor(rollFn() * 3)) % smallItemPool.length;
      drops.push({ ...smallItemPool[bonusIdx] });
    }
  }

  return {
    cancelled: true,
    shatteredCrateCount: nonEmptyCrates.length,
    drops,
  };
}

// ============================================================================
// TANK OBSTACLE CLIMBING OVER LOW ROCKS & STACKED PIPES
// ("tank mampu menaiki batu atau pipa bertumpuk asal jangan terlalu tinggi")
// ============================================================================

export const TANK_MAX_CLIMBABLE_OBSTACLE_HEIGHT = 1.68;

export interface TankClimbableObstacleInput {
  alive?: boolean;
  kind: string;
  x: number;
  z: number;
  rotY?: number;
  scale?: number;
  radius: number;
  halfX?: number;
  halfZ?: number;
  heightY?: number;
}

export interface TankClimbableElevationResult {
  climbY: number;
  pitchRad: number;
  rollRad: number;
  isClimbing: boolean;
}

/**
 * Returns the true vertical 3D surface height (in meters) of a climbable rock or pipe obstacle,
 * or `null` if the prop kind is not a rock/pipe obstacle that a tracked tank can climb over.
 */
export function getTankClimbableObstacleVerticalHeight(
  kind: string,
  scale = 1.0,
  explicitHeightY?: number,
): number | null {
  const s = Math.max(0.1, scale);
  let baseVerticalHeight: number | null = null;
  switch (kind) {
    case 'river_rock':
      baseVerticalHeight = 0.78 * s;
      break;
    case 'concrete_pipe':
      baseVerticalHeight = 0.92 * s;
      break;
    case 'giant_pipe':
      baseVerticalHeight = 0.95 * s;
      break;
    case 'giant_pipe_1b':
      baseVerticalHeight = 1.12 * s;
      break;
    case 'pipe_cluster':
    case 'pipe_cluster_1b':
      baseVerticalHeight = 1.32 * s;
      break;
    case 'h_beam':
      baseVerticalHeight = 0.55 * s;
      break;
    default:
      return null;
  }
  if (
    explicitHeightY !== undefined &&
    explicitHeightY > 0 &&
    explicitHeightY <= TANK_MAX_CLIMBABLE_OBSTACLE_HEIGHT * 1.5 &&
    explicitHeightY < baseVerticalHeight * 1.35
  ) {
    return explicitHeightY;
  }
  return baseVerticalHeight;
}

/**
 * Determines whether a tracked tank can climb over the given map prop (`river_rock`, `pipe_cluster`,
 * `giant_pipe`, `concrete_pipe`, `h_beam`) as long as its vertical height does not exceed `maxClimbHeight`.
 */
export function isTankClimbableProp(
  kind: string,
  scale = 1.0,
  maxClimbHeight = TANK_MAX_CLIMBABLE_OBSTACLE_HEIGHT,
  explicitHeightY?: number,
): boolean {
  const verticalH = getTankClimbableObstacleVerticalHeight(kind, scale, explicitHeightY);
  if (verticalH === null) return false;
  return verticalH <= maxClimbHeight;
}

function sampleSingleClimbableObstacleHeightAtPoint(
  px: number,
  pz: number,
  obs: TankClimbableObstacleInput,
  maxClimbHeight: number,
): number {
  if (obs.alive === false) return 0;
  const scale = obs.scale ?? 1.0;
  const verticalH = getTankClimbableObstacleVerticalHeight(obs.kind, scale, obs.heightY);
  if (verticalH === null || verticalH <= 0 || verticalH > maxClimbHeight) {
    return 0;
  }

  const dx = px - obs.x;
  const dz = pz - obs.z;
  const rampMargin = 0.95; // Track approach ramp width around obstacle footprint

  if (obs.halfX !== undefined && obs.halfZ !== undefined && obs.halfX > 0 && obs.halfZ > 0) {
    const rotY = obs.rotY ?? 0;
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const localX = dx * cosY - dz * sinY;
    const localZ = dx * sinY + dz * cosY;

    const absX = Math.abs(localX);
    const absZ = Math.abs(localZ);
    const outerX = obs.halfX + rampMargin;
    const outerZ = obs.halfZ + rampMargin;
    if (absX >= outerX || absZ >= outerZ) return 0;

    const flatX = obs.halfX * 0.62;
    const flatZ = obs.halfZ * 0.62;
    const uX = clamp(1 - Math.max(0, absX - flatX) / Math.max(0.15, outerX - flatX), 0, 1);
    const uZ = clamp(1 - Math.max(0, absZ - flatZ) / Math.max(0.15, outerZ - flatZ), 0, 1);
    const sX = uX * uX * (3 - 2 * uX);
    const sZ = uZ * uZ * (3 - 2 * uZ);
    return verticalH * sX * sZ;
  }

  const dist = Math.hypot(dx, dz);
  const outerR = Math.max(0.4, obs.radius) + rampMargin;
  if (dist >= outerR) return 0;
  const flatR = Math.max(0.2, obs.radius * 0.45);
  const u = clamp(1 - Math.max(0, dist - flatR) / Math.max(0.15, outerR - flatR), 0, 1);
  const s = u * u * (3 - 2 * u);
  return verticalH * s;
}

/**
 * Computes the vertical climb elevation (`climbY`) and hull tilt (`pitchRad`, `rollRad`) when a tank
 * drives over climbable low rocks (`river_rock`) or stacked pipes (`pipe_cluster`, `giant_pipe`, `concrete_pipe`).
 */
export function evaluateTankClimbableObstacleElevation(
  tankX: number,
  tankZ: number,
  hullYaw: number,
  obstacles: ReadonlyArray<TankClimbableObstacleInput>,
  maxClimbHeight = TANK_MAX_CLIMBABLE_OBSTACLE_HEIGHT,
): TankClimbableElevationResult {
  if (!obstacles || obstacles.length === 0) {
    return { climbY: 0, pitchRad: 0, rollRad: 0, isClimbing: false };
  }

  const sampleAt = (px: number, pz: number): number => {
    let bestH = 0;
    for (let i = 0; i < obstacles.length; i++) {
      const h = sampleSingleClimbableObstacleHeightAtPoint(px, pz, obstacles[i], maxClimbHeight);
      if (h > bestH) bestH = h;
    }
    return bestH;
  };

  // Tank forward axis is (+cos(hullYaw), -sin(hullYaw)); right axis is (+sin(hullYaw), +cos(hullYaw))
  const fwdX = Math.cos(hullYaw);
  const fwdZ = -Math.sin(hullYaw);
  const rightX = Math.sin(hullYaw);
  const rightZ = Math.cos(hullYaw);

  const halfTrackLen = 1.35;
  const halfTrackWidth = 1.05;

  const hCenter = sampleAt(tankX, tankZ);
  const hFront = sampleAt(tankX + fwdX * halfTrackLen, tankZ + fwdZ * halfTrackLen);
  const hRear = sampleAt(tankX - fwdX * halfTrackLen, tankZ - fwdZ * halfTrackLen);
  const hRight = sampleAt(tankX + rightX * halfTrackWidth, tankZ + rightZ * halfTrackWidth);
  const hLeft = sampleAt(tankX - rightX * halfTrackWidth, tankZ - rightZ * halfTrackWidth);

  const avgTrackH = (hFront + hRear + hRight + hLeft) * 0.25;
  const climbY = Math.max(hCenter, avgTrackH);
  if (climbY <= 0.005) {
    return { climbY: 0, pitchRad: 0, rollRad: 0, isClimbing: false };
  }

  const pitchRad = clamp(Math.atan2(hFront - hRear, halfTrackLen * 2), -0.42, 0.42);
  const rollRad = clamp(Math.atan2(hLeft - hRight, halfTrackWidth * 2), -0.36, 0.36);

  return {
    climbY,
    pitchRad,
    rollRad,
    isClimbing: climbY > 0.02,
  };
}

// ============================================================================
// AI RANGED COMBAT STANDOFF INTELLIGENCE (SHOOT FROM DISTANCE INSTEAD OF CHASING)
// ============================================================================

export interface AiRangedCombatStandoffInput {
  aiX: number;
  aiZ: number;
  enemyX: number;
  enemyZ: number;
  weaponId: 'unarmed' | 'pistol' | 'rifle' | 'rocket' | 'bazooka' | 'laser' | 'gatling';
  ammo: number;
  strafeSign?: 1 | -1;
}

export interface AiRangedCombatStandoffResult {
  isRangedWeapon: boolean;
  distToEnemy: number;
  maxFireRangeMeters: number;
  preferredStandoffMinMeters: number;
  preferredStandoffMaxMeters: number;
  canShootNow: boolean;
  movementMode: 'advance_to_range' | 'hold_and_strafe' | 'retreat_kite' | 'melee_chase';
  goalX: number;
  goalZ: number;
  aimYaw: number;
}

/**
 * Evaluates AI ranged combat standoff positioning and long-range firing behavior:
 * - Armed AI (`weaponId !== 'unarmed'` and `ammo > 0`) shoots directly from long range (`21m..28m`)
 *   instead of blindly running into melee range (`0.6m`).
 * - Inside `[preferredStandoffMinMeters .. preferredStandoffMaxMeters]`, the AI stops charging forward
 *   and holds a tactical lateral strafe at long range while aiming directly at the target.
 * - If the enemy rushes closer than `preferredStandoffMinMeters`, the AI kites backward while firing.
 */
export function evaluateAiRangedCombatStandoffBehavior(
  input: AiRangedCombatStandoffInput,
): AiRangedCombatStandoffResult {
  const dxToEnemy = input.enemyX - input.aiX;
  const dzToEnemy = input.enemyZ - input.aiZ;
  const distToEnemy = Math.hypot(dxToEnemy, dzToEnemy);
  const aimYaw = distToEnemy > 0.001 ? Math.atan2(-dzToEnemy, dxToEnemy) : 0;

  if (input.weaponId === 'unarmed' || input.ammo <= 0) {
    return {
      isRangedWeapon: false,
      distToEnemy,
      maxFireRangeMeters: 2.35,
      preferredStandoffMinMeters: 0,
      preferredStandoffMaxMeters: 1.6,
      canShootNow: distToEnemy <= 2.35,
      movementMode: 'melee_chase',
      goalX: input.enemyX,
      goalZ: input.enemyZ,
      aimYaw,
    };
  }

  const isHeavyRanged =
    input.weaponId === 'bazooka' || input.weaponId === 'rocket' || input.weaponId === 'laser';
  const isMediumRanged = input.weaponId === 'rifle' || input.weaponId === 'gatling';

  const maxFireRangeMeters = isHeavyRanged ? 28.0 : isMediumRanged ? 25.0 : 21.0;
  const preferredStandoffMinMeters = isHeavyRanged ? 12.5 : isMediumRanged ? 10.5 : 8.5;
  const preferredStandoffMaxMeters = isHeavyRanged ? 22.0 : isMediumRanged ? 19.0 : 16.0;
  const canShootNow = distToEnemy <= maxFireRangeMeters;

  const safeDist = Math.max(0.001, distToEnemy);
  // Unit vector pointing from enemy back toward AI
  const awayX = -dxToEnemy / safeDist;
  const awayZ = -dzToEnemy / safeDist;
  const strafeSign = input.strafeSign ?? 1;
  // Lateral strafe tangent perpendicular to line of sight
  const tangentX = -awayZ * strafeSign;
  const tangentZ = awayX * strafeSign;

  if (distToEnemy > preferredStandoffMaxMeters) {
    const targetBandRadius = (preferredStandoffMinMeters + preferredStandoffMaxMeters) * 0.5;
    return {
      isRangedWeapon: true,
      distToEnemy,
      maxFireRangeMeters,
      preferredStandoffMinMeters,
      preferredStandoffMaxMeters,
      canShootNow,
      movementMode: 'advance_to_range',
      goalX: input.enemyX + awayX * targetBandRadius,
      goalZ: input.enemyZ + awayZ * targetBandRadius,
      aimYaw,
    };
  }

  if (distToEnemy < preferredStandoffMinMeters) {
    return {
      isRangedWeapon: true,
      distToEnemy,
      maxFireRangeMeters,
      preferredStandoffMinMeters,
      preferredStandoffMaxMeters,
      canShootNow,
      movementMode: 'retreat_kite',
      goalX: input.enemyX + awayX * preferredStandoffMinMeters + tangentX * 2.0,
      goalZ: input.enemyZ + awayZ * preferredStandoffMinMeters + tangentZ * 2.0,
      aimYaw,
    };
  }

  return {
    isRangedWeapon: true,
    distToEnemy,
    maxFireRangeMeters,
    preferredStandoffMinMeters,
    preferredStandoffMaxMeters,
    canShootNow,
    movementMode: 'hold_and_strafe',
    goalX: input.aiX + tangentX * 2.2,
    goalZ: input.aiZ + tangentZ * 2.2,
    aimYaw,
  };
}

// ============================================================================
// 5-SLOT TACTICAL LOADOUT: MAX 3 HANDHELD WEAPONS + 2 TACTICAL ITEMS (GRENADE & LAND MINE)
// + REAL-TIME AMMO BADGES + CLICK-TO-SWAP DROPPED WEAPONS
// ============================================================================

export const MAX_HANDHELD_WEAPON_SLOTS = 3;
export const MAX_TACTICAL_ITEM_SLOTS = 2;

export type HandheldWeaponSlotId = 'pistol' | 'rifle' | 'bazooka' | 'laser' | 'gatling';
export type TacticalSecondarySlotId = 'hand_grenade' | 'land_mine';

export interface CarriedHandheldWeaponSlot {
  slotId: HandheldWeaponSlotId;
  label: string;
  weaponName: string;
  ammo: number;
  maxAmmo: number;
}

export interface HudWeaponOrTacticalBadge {
  id: string;
  kind: 'handheld' | 'tactical';
  slotId: HandheldWeaponSlotId | TacticalSecondarySlotId;
  label: string;
  /** Number displayed inside the dark badge next to the weapon/item name = ammo count (`jumlah peluru`) */
  ammoCount: number;
  isActive: boolean;
  actionEvent: string;
}

export interface BuddyTacticalLoadoutState {
  handheldWeapons: CarriedHandheldWeaponSlot[];
  activeWeaponSlotId: HandheldWeaponSlotId | 'unarmed';
  grenadeCount: number;
  landMineCount: number;
  clusterBombCount: number;
}

export function resolveHandheldWeaponSlotSpec(weaponIdOrName: string): {
  slotId: HandheldWeaponSlotId;
  label: string;
  weaponName: string;
  defaultAmmo: number;
  maxAmmo: number;
} {
  const upper = (weaponIdOrName || '').toUpperCase();
  if (
    weaponIdOrName === 'gatling' ||
    upper.includes('GATLING') ||
    upper.includes('TITAN-6') ||
    upper.includes('ROTARY')
  ) {
    return {
      slotId: 'gatling',
      label: 'GATLING',
      weaponName: 'TITAN-6 Rotary Gatling',
      defaultAmmo: 180,
      maxAmmo: 360,
    };
  }
  if (
    weaponIdOrName === 'laser' ||
    upper.includes('LASER') ||
    upper.includes('PHOTON') ||
    upper.includes('LG-88') ||
    upper.includes('ION CANNON')
  ) {
    return {
      slotId: 'laser',
      label: 'LASER',
      weaponName: 'LG-88 Photon Lance',
      defaultAmmo: 120,
      maxAmmo: 240,
    };
  }
  if (
    weaponIdOrName === 'bazooka' ||
    weaponIdOrName === 'rocket' ||
    upper.includes('BAZOOKA') ||
    upper.includes('SUPAZOOKA') ||
    upper.includes('ROCKET') ||
    upper.includes('NUCLEAR') ||
    upper.includes('HOMING') ||
    upper.includes('MORTAR')
  ) {
    return {
      slotId: 'bazooka',
      label: 'BAZOOKA',
      weaponName:
        weaponIdOrName && weaponIdOrName !== 'bazooka' && weaponIdOrName !== 'rocket'
          ? weaponIdOrName
          : 'BlitzRocketLauncher',
      defaultAmmo: 18,
      maxAmmo: 60,
    };
  }
  if (
    weaponIdOrName === 'rifle' ||
    upper.includes('RIFLE') ||
    upper.includes('SHOTGUN') ||
    upper.includes('PLASMA') ||
    upper.includes('MACHINE') ||
    upper.includes('SNIPER')
  ) {
    return {
      slotId: 'rifle',
      label: 'RIFLE',
      weaponName:
        weaponIdOrName && weaponIdOrName !== 'rifle' ? weaponIdOrName : 'BlitzAssaultRifle',
      defaultAmmo: 90,
      maxAmmo: 240,
    };
  }
  return {
    slotId: 'pistol',
    label: 'PISTOL',
    weaponName: weaponIdOrName && weaponIdOrName !== 'pistol' ? weaponIdOrName : 'BlitzPistol',
    defaultAmmo: 48,
    maxAmmo: 180,
  };
}

export function createInitialBuddyTacticalLoadout(
  initialWeaponId: HandheldWeaponSlotId | 'unarmed' = 'pistol',
  initialAmmo?: number,
  initialSecondaryItem: BuddySecondaryItemId = 'none',
  initialSecondaryCount = 0,
): BuddyTacticalLoadoutState {
  const handheldWeapons: CarriedHandheldWeaponSlot[] = [];
  if (initialWeaponId !== 'unarmed') {
    const spec = resolveHandheldWeaponSlotSpec(initialWeaponId);
    const startAmmo = Math.max(1, initialAmmo ?? spec.defaultAmmo);
    handheldWeapons.push({
      slotId: spec.slotId,
      label: spec.label,
      weaponName: spec.weaponName,
      ammo: Math.min(spec.maxAmmo, startAmmo),
      maxAmmo: spec.maxAmmo,
    });
  }
  return {
    handheldWeapons,
    activeWeaponSlotId: handheldWeapons.length > 0 ? handheldWeapons[0].slotId : 'unarmed',
    grenadeCount: initialSecondaryItem === 'hand_grenade' ? Math.max(0, initialSecondaryCount) : 0,
    landMineCount: initialSecondaryItem === 'land_mine' ? Math.max(0, initialSecondaryCount) : 0,
    clusterBombCount:
      initialSecondaryItem === 'cluster_bomb' ? Math.max(0, initialSecondaryCount) : 0,
  };
}

/**
 * Equips, adds, or swaps a ground weapon into the character's 3-slot handheld weapon inventory:
 * - If the character already owns that weapon slot type (`slotId`), adds its `droppedAmmo` to the slot.
 * - Else if the character carries fewer than 3 handheld weapons (`< MAX_HANDHELD_WEAPON_SLOTS`), adds it into a free slot and equips it.
 * - Else (`=== 3` handheld weapons), swaps out the currently active weapon (or slot 2) and returns `droppedPreviousWeapon` so the old weapon drops onto the ground!
 */
export function equipOrSwapDroppedWeaponInLoadout(
  loadout: BuddyTacticalLoadoutState,
  droppedWeaponNameOrId: string,
  droppedAmmo?: number,
): {
  updatedLoadout: BuddyTacticalLoadoutState;
  action: 'refilled' | 'added' | 'swapped';
  droppedPreviousWeapon: {
    slotId: HandheldWeaponSlotId;
    weaponName: string;
    remainingAmmo: number;
  } | null;
} {
  const spec = resolveHandheldWeaponSlotSpec(droppedWeaponNameOrId);
  const incomingAmmo = Math.max(1, droppedAmmo ?? spec.defaultAmmo);
  const nextHandheld = loadout.handheldWeapons.map((w) => ({ ...w }));

  const existingIdx = nextHandheld.findIndex((w) => w.slotId === spec.slotId);
  if (existingIdx !== -1) {
    const existing = nextHandheld[existingIdx];
    existing.ammo = Math.min(existing.maxAmmo, existing.ammo + incomingAmmo);
    if (
      getBuddyWeaponTierRank(spec.slotId, droppedWeaponNameOrId) >=
      getBuddyWeaponTierRank(existing.slotId, existing.weaponName)
    ) {
      existing.weaponName = spec.weaponName;
    }
    return {
      updatedLoadout: {
        ...loadout,
        handheldWeapons: nextHandheld,
        activeWeaponSlotId: existing.slotId,
      },
      action: 'refilled',
      droppedPreviousWeapon: null,
    };
  }

  const newSlot: CarriedHandheldWeaponSlot = {
    slotId: spec.slotId,
    label: spec.label,
    weaponName: spec.weaponName,
    ammo: Math.min(spec.maxAmmo, incomingAmmo),
    maxAmmo: spec.maxAmmo,
  };

  if (nextHandheld.length < MAX_HANDHELD_WEAPON_SLOTS) {
    nextHandheld.push(newSlot);
    return {
      updatedLoadout: {
        ...loadout,
        handheldWeapons: nextHandheld,
        activeWeaponSlotId: newSlot.slotId,
      },
      action: 'added',
      droppedPreviousWeapon: null,
    };
  }

  // Already carrying 3 handheld weapons -> swap out the currently active slot (or last slot if unarmed)
  let replaceIdx = nextHandheld.findIndex((w) => w.slotId === loadout.activeWeaponSlotId);
  if (replaceIdx === -1) replaceIdx = nextHandheld.length - 1;
  const replaced = nextHandheld[replaceIdx];
  nextHandheld[replaceIdx] = newSlot;

  return {
    updatedLoadout: {
      ...loadout,
      handheldWeapons: nextHandheld,
      activeWeaponSlotId: newSlot.slotId,
    },
    action: 'swapped',
    droppedPreviousWeapon: {
      slotId: replaced.slotId,
      weaponName: replaced.weaponName,
      remainingAmmo: replaced.ammo,
    },
  };
}

export function selectHandheldWeaponInLoadout(
  loadout: BuddyTacticalLoadoutState,
  requestedSlotId: HandheldWeaponSlotId | 'unarmed',
): BuddyTacticalLoadoutState {
  if (requestedSlotId === 'unarmed') {
    return {
      ...loadout,
      activeWeaponSlotId: 'unarmed',
    };
  }
  const owned = loadout.handheldWeapons.find((w) => w.slotId === requestedSlotId && w.ammo > 0);
  if (!owned) {
    // Cannot equip a weapon that the player does not possess!
    return loadout;
  }
  return {
    ...loadout,
    activeWeaponSlotId: owned.slotId,
  };
}

export function consumeActiveWeaponAmmoOnShot(
  loadout: BuddyTacticalLoadoutState,
): BuddyTacticalLoadoutState {
  if (loadout.activeWeaponSlotId === 'unarmed') return loadout;
  const nextHandheld: CarriedHandheldWeaponSlot[] = [];
  let activeStillHasAmmo = false;

  for (const w of loadout.handheldWeapons) {
    if (w.slotId === loadout.activeWeaponSlotId) {
      const nextAmmo = Math.max(0, w.ammo - 1);
      if (nextAmmo > 0) {
        nextHandheld.push({ ...w, ammo: nextAmmo });
        activeStillHasAmmo = true;
      }
    } else if (w.ammo > 0) {
      nextHandheld.push({ ...w });
    }
  }

  const nextActiveId: HandheldWeaponSlotId | 'unarmed' = activeStillHasAmmo
    ? loadout.activeWeaponSlotId
    : nextHandheld.length > 0
      ? nextHandheld[0].slotId
      : 'unarmed';

  return {
    ...loadout,
    handheldWeapons: nextHandheld,
    activeWeaponSlotId: nextActiveId,
  };
}

/**
 * Refills ammo across all carried handheld weapons when the player:
 * 1. Defeats an enemy (`'enemy_kill'`)
 * 2. Destroys a crate (`'crate_destroy'`)
 * 3. Collects a Supply Drop or Ammo Pack (`'supply_drop'` | `'ammo_pickup'`)
 */
export function refillLoadoutAmmoFromSource(
  loadout: BuddyTacticalLoadoutState,
  source: 'enemy_kill' | 'crate_destroy' | 'supply_drop' | 'ammo_pickup',
  customAmount?: number,
): BuddyTacticalLoadoutState {
  const stdAdd =
    customAmount ??
    (source === 'supply_drop'
      ? 60
      : source === 'ammo_pickup'
        ? 40
        : source === 'enemy_kill'
          ? 24
          : 20);
  const heavyAdd =
    source === 'supply_drop'
      ? 12
      : source === 'ammo_pickup'
        ? 8
        : source === 'enemy_kill'
          ? 6
          : 5;

  if (loadout.handheldWeapons.length === 0) {
    // If the player had 0 weapons, grant a Pistol with fresh ammo!
    const pistolSpec = resolveHandheldWeaponSlotSpec('pistol');
    return {
      ...loadout,
      handheldWeapons: [
        {
          slotId: 'pistol',
          label: pistolSpec.label,
          weaponName: pistolSpec.weaponName,
          ammo: Math.min(pistolSpec.maxAmmo, stdAdd),
          maxAmmo: pistolSpec.maxAmmo,
        },
      ],
      activeWeaponSlotId: 'pistol',
    };
  }

  const nextHandheld = loadout.handheldWeapons.map((w) => {
    const delta = w.slotId === 'bazooka' ? heavyAdd : stdAdd;
    return {
      ...w,
      ammo: Math.min(w.maxAmmo, w.ammo + delta),
    };
  });

  const nextActiveId =
    loadout.activeWeaponSlotId === 'unarmed' && nextHandheld.length > 0
      ? nextHandheld[0].slotId
      : loadout.activeWeaponSlotId;

  return {
    ...loadout,
    handheldWeapons: nextHandheld,
    activeWeaponSlotId: nextActiveId,
  };
}

export function addTacticalSecondaryToLoadout(
  loadout: BuddyTacticalLoadoutState,
  itemId: Exclude<BuddySecondaryItemId, 'none'>,
  count = 1,
): BuddyTacticalLoadoutState {
  const add = Math.max(1, count);
  if (itemId === 'hand_grenade') {
    return {
      ...loadout,
      grenadeCount: Math.min(9, loadout.grenadeCount + add),
    };
  }
  if (itemId === 'land_mine') {
    return {
      ...loadout,
      landMineCount: Math.min(9, loadout.landMineCount + add),
    };
  }
  return {
    ...loadout,
    clusterBombCount: Math.min(9, loadout.clusterBombCount + add),
  };
}

export function consumeTacticalSecondaryInLoadout(
  loadout: BuddyTacticalLoadoutState,
  itemId: Exclude<BuddySecondaryItemId, 'none'>,
): { updatedLoadout: BuddyTacticalLoadoutState; consumed: boolean } {
  if (itemId === 'hand_grenade') {
    if (loadout.grenadeCount <= 0) return { updatedLoadout: loadout, consumed: false };
    return {
      updatedLoadout: { ...loadout, grenadeCount: loadout.grenadeCount - 1 },
      consumed: true,
    };
  }
  if (itemId === 'land_mine') {
    if (loadout.landMineCount <= 0) return { updatedLoadout: loadout, consumed: false };
    return {
      updatedLoadout: { ...loadout, landMineCount: loadout.landMineCount - 1 },
      consumed: true,
    };
  }
  if (loadout.clusterBombCount <= 0) return { updatedLoadout: loadout, consumed: false };
  return {
    updatedLoadout: { ...loadout, clusterBombCount: loadout.clusterBombCount - 1 },
    consumed: true,
  };
}

/**
 * Returns the bottom HUD badges for ONLY the weapons (max 3) and secondary tactical items (max 2: Hand Grenade & Land Mine)
 * that the player currently possesses (`ammo > 0` / `count > 0`).
 * Each badge's `ammoCount` is displayed in the `[N]` badge next to the weapon/item name.
 */
export function getVisibleHudWeaponAndTacticalBadges(
  loadout: BuddyTacticalLoadoutState,
): HudWeaponOrTacticalBadge[] {
  const badges: HudWeaponOrTacticalBadge[] = [];

  for (const w of loadout.handheldWeapons.slice(0, MAX_HANDHELD_WEAPON_SLOTS)) {
    if (w.ammo <= 0) continue;
    const actionEvent =
      w.slotId === 'gatling'
        ? 'selectWeaponGatling'
        : w.slotId === 'laser'
          ? 'selectWeaponLaser'
          : w.slotId === 'bazooka'
            ? 'selectWeaponBazooka'
            : w.slotId === 'rifle'
              ? 'selectWeaponRifle'
              : 'selectWeaponPistol';
    badges.push({
      id: `weapon_${w.slotId}`,
      kind: 'handheld',
      slotId: w.slotId,
      label: w.label,
      ammoCount: w.ammo,
      isActive: loadout.activeWeaponSlotId === w.slotId,
      actionEvent,
    });
  }

  if (loadout.grenadeCount > 0) {
    badges.push({
      id: 'tactical_hand_grenade',
      kind: 'tactical',
      slotId: 'hand_grenade',
      label: 'GRANAT',
      ammoCount: loadout.grenadeCount,
      isActive: false,
      actionEvent: 'useHandGrenade',
    });
  }

  if (loadout.landMineCount > 0) {
    badges.push({
      id: 'tactical_land_mine',
      kind: 'tactical',
      slotId: 'land_mine',
      label: 'LAND MINE',
      ammoCount: loadout.landMineCount,
      isActive: false,
      actionEvent: 'useLandMine',
    });
  }

  return badges;
}

// ============================================================================
// RANDOM WARZONE EXPLOSIVE BARREL AIRDROP SCHEDULER
// ============================================================================

export const WARZONE_EXPLOSIVE_BARREL_DROP_INTERVAL_SEC = 8.0;
export const MAX_ACTIVE_WARZONE_EXPLOSIVE_BARRELS = 16;

export function stepWarzoneExplosiveBarrelDropTimer(
  currentTimerSec: number,
  activeWarzoneBarrelCount: number,
  dt: number,
  intervalSec = WARZONE_EXPLOSIVE_BARREL_DROP_INTERVAL_SEC,
  maxActiveBarrels = MAX_ACTIVE_WARZONE_EXPLOSIVE_BARRELS,
): { nextTimerSec: number; shouldDropBarrel: boolean } {
  if (activeWarzoneBarrelCount >= maxActiveBarrels) {
    return { nextTimerSec: 0, shouldDropBarrel: false };
  }
  const nextTimerSec = currentTimerSec + Math.max(0, dt);
  if (nextTimerSec >= intervalSec) {
    return { nextTimerSec: 0, shouldDropBarrel: true };
  }
  return { nextTimerSec, shouldDropBarrel: false };
}

// ============================================================================
// GLOBAL MOVEMENT SPEED OVERHAUL (+45% INFANTRY/HARVESTER, REDUCED CRATE PENALTY,
// +35% VEHICLES, +20% ASPHALT ROAD & ZEBRA CROSS BOOST, WALK CYCLE & AI SYNC)
// ============================================================================

/** Normalized 1.0x human running speed factor for Infantry & Harvesters (Player & AI) */
export const INFANTRY_SPEED_BOOST_FACTOR = 1.0;
/** Normal human Player base foot speed (5.8 m/s running pace, ~7.25 m/s sprint) */
export const PLAYER_BASE_FOOT_SPEED = Number((5.8 * INFANTRY_SPEED_BOOST_FACTOR).toFixed(4));
/** Normal human AI Buddy/Harvester base foot speed (5.0 m/s) */
export const AI_BASE_FOOT_SPEED = Number((5.0 * INFANTRY_SPEED_BOOST_FACTOR).toFixed(4));
/**
 * Reduced speed penalty when carrying a crate (`0.94` = only 6% slowdown vs legacy `0.85` = 15% slowdown),
 * keeping Harvesters nimble when returning crates to the Stacking Pad.
 */
export const CRATE_CARRY_SPEED_MULTIPLIER = 0.94;
/** +35% global top speed, initial acceleration & turn rate multiplier for Blitz Tank & Dump Truck */
export const VEHICLE_SPEED_AND_ACCEL_BOOST_FACTOR = 1.35;
/** AI Tank base drive speed (legacy 6.5 m/s) boosted by +35% -> 8.775 m/s */
export const AI_TANK_BASE_DRIVE_SPEED = Number((6.5 * VEHICLE_SPEED_AND_ACCEL_BOOST_FACTOR).toFixed(4));
/** Automatic +20% movement speed bonus on Asphalt Roads & Zebra Crosswalks */
export const ROAD_SPEED_BOOST_MULTIPLIER = 1.2;

export interface RoadSurfaceSpeedBoostEvaluation {
  onRoadOrZebra: boolean;
  onAsphaltRoad: boolean;
  onZebraCrosswalk: boolean;
  speedMultiplier: number;
}

/**
 * Evaluates whether world coordinates `(worldX, worldZ)` lie on an Asphalt Road or Zebra Crosswalk,
 * granting an automatic +20% (`1.20x`) movement speed bonus.
 */
export function evaluateRoadSurfaceSpeedBoost(
  worldX: number,
  worldZ: number,
): RoadSurfaceSpeedBoostEvaluation {
  const onAsphaltRoad = evaluateRoadNetworkSdf(worldX, worldZ) <= 0.15;
  const onZebraCrosswalk = isPointOnZebraCrosswalk(worldX, worldZ);
  const onRoadOrZebra = onAsphaltRoad || onZebraCrosswalk || isPointOnAsphaltRoadOrZebraCross(worldX, worldZ);
  return {
    onRoadOrZebra,
    onAsphaltRoad,
    onZebraCrosswalk,
    speedMultiplier: onRoadOrZebra ? ROAD_SPEED_BOOST_MULTIPLIER : 1.0,
  };
}

export interface BuddyFootMoveSpeedParams {
  isPlayer: boolean;
  classSpeedMultiplier: number;
  carryingCrate: boolean;
  isBoosting?: boolean;
  onRoadOrZebra?: boolean;
}

/**
 * Computes effective movement speed (m/s) for Player or AI Infantry & Harvesters:
 * - +45% global base speed (`13.34 m/s` Player, `10.295 m/s` AI)
 * - Reduced crate carrying penalty (`0.94x` instead of `0.85x`)
 * - Automatic +20% (`1.20x`) Road Speed Boost on asphalt roads or zebra crosswalks
 */
export function computeBuddyFootMoveSpeed(params: BuddyFootMoveSpeedParams): number {
  const baseSpeed = params.isPlayer ? PLAYER_BASE_FOOT_SPEED : AI_BASE_FOOT_SPEED;
  const carryMult = params.carryingCrate ? CRATE_CARRY_SPEED_MULTIPLIER : 1.0;
  const boostMult = params.isBoosting ? 1.25 : 1.0;
  const roadMult = params.onRoadOrZebra ? ROAD_SPEED_BOOST_MULTIPLIER : 1.0;
  return baseSpeed * params.classSpeedMultiplier * carryMult * boostMult * roadMult;
}

export interface BlitzTankTrackedPhysicsState {
  currentDriveSpeed: number;
  hullYaw: number;
  vx: number;
  vz: number;
}

export interface BlitzTankTrackedPhysicsInput {
  throttle: number;
  turn: number;
  boost: boolean;
  onRoad?: boolean;
}

export interface BlitzTankTrackedPhysicsStepResult {
  currentDriveSpeed: number;
  hullYaw: number;
  vx: number;
  vz: number;
  turnRateRadPerSec: number;
}

/**
 * Steps Blitz Tank tracked driving physics with:
 * - +35% top speed (`10.8 m/s` normal, `20.52 m/s` boost) & +35% initial acceleration (`13.5` velocity lerp rate)
 * - +35% faster steering turn rate (`4.212 rad/s` base, `1.12x` extra agility on asphalt roads)
 * - +20% automatic Road Speed Boost when driving on asphalt roads or zebra crosswalks
 */
export function stepBlitzTankTrackedPhysics(
  state: BlitzTankTrackedPhysicsState,
  input: BlitzTankTrackedPhysicsInput,
  dt: number,
): BlitzTankTrackedPhysicsStepResult {
  const safeDt = clamp(dt, 0, 0.1);
  const throttle = clamp(input.throttle, -1, 1);
  const turn = clamp(input.turn, -1, 1);
  const onRoad = Boolean(input.onRoad);

  const nextDriveSpeed = computeTankSpeedStep(
    state.currentDriveSpeed,
    input.boost && throttle !== 0,
    safeDt,
    onRoad,
  );

  const roadTurnBonus = onRoad ? 1.12 : 1.0;
  const boostTurnBonus = input.boost && throttle !== 0 ? BUDDIES_CONSTANTS.physics.drive.boostRotationMultiplier : 1.0;
  const turnRateRadPerSec = BUDDIES_CONSTANTS.physics.drive.rotationSpeed * roadTurnBonus * boostTurnBonus;

  let nextHullYaw = state.hullYaw;
  if (Math.abs(turn) > 0.01) {
    const rev = throttle < 0 ? -1 : 1;
    nextHullYaw += turn * rev * turnRateRadPerSec * safeDt;
  }

  const fwdX = Math.cos(nextHullYaw);
  const fwdZ = -Math.sin(nextHullYaw);
  const targetVx = fwdX * throttle * nextDriveSpeed;
  const targetVz = fwdZ * throttle * nextDriveSpeed;

  // +35% initial acceleration response (13.5 vs legacy 10.0)
  const accelLerpRate = 13.5 * (onRoad ? 1.15 : 1.0);
  const blend = Math.min(1, accelLerpRate * safeDt);
  const nextVx = state.vx + (targetVx - state.vx) * blend;
  const nextVz = state.vz + (targetVz - state.vz) * blend;

  return {
    currentDriveSpeed: nextDriveSpeed,
    hullYaw: nextHullYaw,
    vx: nextVx,
    vz: nextVz,
    turnRateRadPerSec,
  };
}

export interface SynchronizedWalkCycleResult {
  nextWalkCycle: number;
  cycleDelta: number;
  legSwingAmplitude: number;
  legSwingAngle: number;
  walkBobOffset: number;
  isMoving: boolean;
}

/**
 * Synchronizes the character walk/run cycle (`walkCycle`) and stride swing amplitude (`legSwingAmplitude`)
 * strictly to actual post-collision ground speed (`actualGroundSpeed = Math.hypot(vx, vz)`) so units
 * never appear to slide/skate when accelerating, running at +45% / +20% road speed, or decelerating.
 */
export function computeSynchronizedWalkCycleStep(params: {
  currentWalkCycle: number;
  actualGroundSpeed: number;
  dt: number;
  carryingCrate?: boolean;
}): SynchronizedWalkCycleResult {
  const safeDt = clamp(params.dt, 0, 0.1);
  const speed = Math.max(0, params.actualGroundSpeed);
  const isMoving = speed > 0.38;

  if (!isMoving) {
    return {
      nextWalkCycle: params.currentWalkCycle,
      cycleDelta: 0,
      legSwingAmplitude: 0,
      legSwingAngle: 0,
      walkBobOffset: 0,
      isMoving: false,
    };
  }

  // Dynamic stride length widens at higher speeds while cadence increases proportionally,
  // locking foot contact speed to ground displacement (`speed = strideLength * cadence`).
  const strideLengthMeters = clamp(0.74 + speed * 0.032, 0.78, 1.36);
  const carryCadenceFactor = params.carryingCrate ? 1.07 : 1.0;
  const cadenceRadPerSec = (speed / strideLengthMeters) * 1.56 * carryCadenceFactor;
  const cycleDelta = cadenceRadPerSec * safeDt;
  const nextWalkCycle = params.currentWalkCycle + cycleDelta;

  const legSwingAmplitude = clamp(0.58 + speed * 0.016, 0.62, 0.86);
  const legSwingAngle = Math.sin(nextWalkCycle) * legSwingAmplitude;
  const walkBobOffset = Math.sin(nextWalkCycle * 2) * clamp(0.028 + speed * 0.0012, 0.03, 0.052);

  return {
    nextWalkCycle,
    cycleDelta,
    legSwingAmplitude,
    legSwingAngle,
    walkBobOffset,
    isMoving: true,
  };
}

export interface AiPathfindingMovementStepParams {
  steerDirX: number;
  steerDirZ: number;
  distToGoal: number;
  desiredSpeed: number;
  dt: number;
  stopRadius?: number;
  slowdownRadius?: number;
}

export interface AiPathfindingMovementStepResult {
  vx: number;
  vz: number;
  stepDx: number;
  stepDz: number;
  effectiveSpeed: number;
  arrived: boolean;
}

/**
 * Computes an anti-overshoot AI movement step toward a waypoint or target `(goalX, goalZ)`:
 * - Smoothly decelerates within `slowdownRadius` (scaled to `desiredSpeed`) as the unit approaches the goal.
 * - Clamps single-frame displacement `stepDist <= distToGoal` so fast-moving AI Harvesters, Infantry,
 *   and Tanks NEVER overshoot (`kelewatan titik target`) or oscillate back and forth across a crate or pad.
 */
export function computeAiPathfindingMovementStep(
  params: AiPathfindingMovementStepParams,
): AiPathfindingMovementStepResult {
  const safeDt = clamp(params.dt, 0.0001, 0.1);
  const stopRadius = params.stopRadius ?? 0.48;
  if (params.distToGoal <= stopRadius || params.desiredSpeed <= 0.01) {
    return {
      vx: 0,
      vz: 0,
      stepDx: 0,
      stepDz: 0,
      effectiveSpeed: 0,
      arrived: true,
    };
  }

  const dirLen = Math.hypot(params.steerDirX, params.steerDirZ);
  if (dirLen < 1e-4) {
    return {
      vx: 0,
      vz: 0,
      stepDx: 0,
      stepDz: 0,
      effectiveSpeed: 0,
      arrived: false,
    };
  }
  const nx = params.steerDirX / dirLen;
  const nz = params.steerDirZ / dirLen;

  const slowdownRadius = params.slowdownRadius ?? Math.max(1.65, params.desiredSpeed * 0.15);
  const arrivalRatio =
    params.distToGoal < slowdownRadius
      ? clamp(
          (params.distToGoal - stopRadius * 0.5) / Math.max(0.25, slowdownRadius - stopRadius * 0.5),
          0.32,
          1.0,
        )
      : 1.0;

  // Never allow a single frame's step to travel farther than the remaining distance to the goal
  const maxNonOvershootSpeed = params.distToGoal / safeDt;
  const effectiveSpeed = Math.min(params.desiredSpeed * arrivalRatio, maxNonOvershootSpeed);
  const vx = nx * effectiveSpeed;
  const vz = nz * effectiveSpeed;

  return {
    vx,
    vz,
    stepDx: vx * safeDt,
    stepDz: vz * safeDt,
    effectiveSpeed,
    arrived: false,
  };
}

/**
 * Evaluates whether a moving unit or vehicle on an Asphalt Road / Zebra Crosswalk should emit
 * a burst of subtle road dust/wind particles at its feet or wheels during the current frame.
 */
export function shouldEmitRoadSpeedBoostParticles(params: {
  onRoadOrZebra: boolean;
  isGrounded: boolean;
  groundSpeed: number;
  accumTimerSec: number;
  dt: number;
  isVehicle: boolean;
}): { shouldEmit: boolean; nextTimerSec: number; particleCount: number } {
  const minSpeed = params.isVehicle ? 3.5 : 3.0;
  if (!params.onRoadOrZebra || !params.isGrounded || params.groundSpeed < minSpeed) {
    return { shouldEmit: false, nextTimerSec: 0, particleCount: 0 };
  }
  const intervalSec = params.isVehicle ? 0.065 : 0.085;
  const next = params.accumTimerSec + Math.max(0, params.dt);
  if (next >= intervalSec) {
    return {
      shouldEmit: true,
      nextTimerSec: next % intervalSec,
      particleCount: params.isVehicle ? 2 : 2,
    };
  }
  return { shouldEmit: false, nextTimerSec: next, particleCount: 0 };
}

// ============================================================================
// CONTINUOUS RAYCAST LASER BEAM (REAL-TIME MUZZLE TRACKING & DUAL-LAYER BEAM)
// ============================================================================

export const LASER_BEAM_MAX_DISTANCE = 36.0;
export const LASER_CORE_RADIUS = 0.044;
export const LASER_OUTER_GLOW_RADIUS = 0.125;
export const LASER_DAMAGE_TICK_INTERVAL_SEC = 0.08;
export const LASER_DAMAGE_PER_TICK = 4;
export const LASER_AMMO_CONSUME_INTERVAL_SEC = 0.12;

export interface ContinuousLaserMuzzleTransformInput {
  unitX: number;
  unitY: number;
  unitZ: number;
  yaw: number;
  bodyPitchX?: number;
  bodyRollZ?: number;
  walkCycle?: number;
  isMoving?: boolean;
  legSwingAmplitude?: number;
  carryingCrate?: boolean;
  weaponRecoil?: number;
  weaponScale?: number;
  stanceRigOffset?: Vec3;
  localMuzzleOffset?: Vec3;
}

export interface ContinuousLaserMuzzleTransformResult {
  muzzleOrigin: Vec3;
  beamDir: Vec3;
  walkBobY: number;
  recoilKickZ: number;
  recoilPitchRad: number;
}

/**
 * Computes the exact real-time world-space muzzle origin (`startPoint`) and normalized forward direction (`beamDir`)
 * of the character's LG-88 Laser Rifle barrel tip (`localMuzzleOffset` = `(0, 0.08, 0.738)` in `laserGroup` space),
 * incorporating:
 * 1. Character world position `(unitX, unitY, unitZ)` and body yaw (`bodyGroup.rotation.y = Math.PI / 2 + yaw`)
 * 2. Hand/weapon rig stance offset `(-0.12, 1.26 + walkBob, 0.50 - kickZ)` and recoil pitch `-kickPitch`
 * 3. `laserGroup` scale (`1.15` or `1.08`) and front optical emitter aperture `(0, 0.08, 0.738)`
 *
 * Because this transform follows the exact 3D hierarchy (`bodyGroup` -> `weaponRigGroup` -> `laserGroup`),
 * when the character walks (`walkCycle`), jumps (`unitY`), or rotates (`yaw`), the laser beam start point
 * and direction stay 100% glued to the barrel nozzle and sweep smoothly across the scene.
 */
export function computeContinuousLaserMuzzleTransform(
  input: ContinuousLaserMuzzleTransformInput,
): ContinuousLaserMuzzleTransformResult {
  const r = clamp(input.weaponRecoil ?? 0, 0, 1);
  const walkCycle = input.walkCycle ?? 0;
  const isMoving = input.isMoving ?? false;
  const legSwingAmplitude = input.legSwingAmplitude ?? 0.65;
  const carryingCrate = input.carryingCrate ?? false;

  const legSwing = isMoving && legSwingAmplitude > 0.01 ? Math.sin(walkCycle) * legSwingAmplitude : 0;
  const walkBobY = isMoving && !carryingCrate ? Math.abs(legSwing) * 0.035 : 0;
  const recoilKickZ = r * 0.06;
  const recoilPitchRad = r * 0.04;

  const weaponScale = input.weaponScale ?? 1.15;
  const rigOffset = input.stanceRigOffset ?? { x: -0.12, y: 1.26, z: 0.50 };
  const localMuzzle = input.localMuzzleOffset ?? { x: 0, y: 0.08, z: 0.738 };

  // 1. Scale muzzle tip inside laserGroup
  const scaledX = localMuzzle.x * weaponScale;
  const scaledY = localMuzzle.y * weaponScale;
  const scaledZ = localMuzzle.z * weaponScale;

  // 2. Rotate by weaponRigGroup pitch (-recoilPitchRad around local X)
  const pitchX = -recoilPitchRad + (input.bodyPitchX ?? 0);
  const cosP = Math.cos(pitchX);
  const sinP = Math.sin(pitchX);
  const pitchedY = scaledY * cosP - scaledZ * sinP;
  const pitchedZ = scaledY * sinP + scaledZ * cosP;

  // 3. Add weaponRigGroup local position inside bodyGroup
  const bodyLocalX = rigOffset.x + scaledX;
  const bodyLocalY = rigOffset.y + walkBobY + pitchedY;
  const bodyLocalZ = rigOffset.z - recoilKickZ + pitchedZ;

  // 4. Optional body roll around Z
  const rollZ = input.bodyRollZ ?? 0;
  const cosR = Math.cos(rollZ);
  const sinR = Math.sin(rollZ);
  const rolledX = bodyLocalX * cosR - bodyLocalY * sinR;
  const rolledY = bodyLocalX * sinR + bodyLocalY * cosR;
  const rolledZ = bodyLocalZ;

  // 5. Transform from bodyGroup local space into world space using bodyGroup.rotation.y = Math.PI / 2 + yaw
  // Note: With rotY = Math.PI / 2 + yaw:
  //   sin(rotY) = cos(yaw), cos(rotY) = -sin(yaw)
  //   worldOffsetX = rolledX * cos(rotY) + rolledZ * sin(rotY) = -rolledX * sin(yaw) + rolledZ * cos(yaw)
  //   worldOffsetZ = -rolledX * sin(rotY) + rolledZ * cos(rotY) = -rolledX * cos(yaw) - rolledZ * sin(yaw)
  const fwdX = Math.cos(input.yaw);
  const fwdZ = -Math.sin(input.yaw);
  const leftX = -Math.sin(input.yaw);
  const leftZ = -Math.cos(input.yaw);

  const muzzleOrigin: Vec3 = {
    x: input.unitX + leftX * rolledX + fwdX * rolledZ,
    y: input.unitY + rolledY,
    z: input.unitZ + leftZ * rolledX + fwdZ * rolledZ,
  };

  // Forward direction of the barrel (+Z in laserGroup local space)
  const localDirY = -sinP;
  const localDirZ = cosP;
  const rawDirX = fwdX * localDirZ;
  const rawDirY = localDirY;
  const rawDirZ = fwdZ * localDirZ;
  const dirLen = Math.max(1e-6, Math.hypot(rawDirX, rawDirY, rawDirZ));

  return {
    muzzleOrigin,
    beamDir: {
      x: rawDirX / dirLen,
      y: rawDirY / dirLen,
      z: rawDirZ / dirLen,
    },
    walkBobY,
    recoilKickZ,
    recoilPitchRad,
  };
}

export interface ContinuousLaserBeamStepInput {
  muzzleOrigin: Vec3;
  beamDir: Vec3;
  colliders: ReadonlyArray<RaycastCollider3D>;
  shooterId?: string;
  shooterTeam?: 'blue' | 'red';
  maxDistance?: number;
  elapsedSec?: number;
}

export interface ContinuousLaserBeamStepResult {
  startPoint: Vec3;
  endPoint: Vec3;
  beamLength: number;
  beamMidpoint: Vec3;
  beamDir: Vec3;
  hit: boolean;
  hitDistance: number;
  hitNormal: Vec3;
  hitTargetKind: RaycastTargetKind;
  hitTargetId: string | null;
  coreRadiusScale: number;
  outerGlowRadiusScale: number;
  outerGlowOpacity: number;
  muzzlePulseScale: number;
  hitPulseScale: number;
  raycastResult: MuzzleRaycastResult;
}

/**
 * Evaluates a single real-time frame of the Continuous Raycast Laser Beam:
 * - Raycasts from `muzzleOrigin` along `beamDir` up to `maxDistance` (default `36.0m`) against enemies,
 *   vehicles, crates (peti), props, trees, and structures.
 * - Sets `endPoint` to the closest raycast intersection point, or `muzzleOrigin + beamDir * maxDistance` if unobstructed.
 * - Computes rapid high-frequency pulsation parameters for the dual-layer `CylinderGeometry`
 *   (bright white inner core + `AdditiveBlending` outer glow sheath) and muzzle / hit-point flares.
 */
export function evaluateContinuousLaserBeamStep(
  input: ContinuousLaserBeamStepInput,
): ContinuousLaserBeamStepResult {
  const maxDist = Math.max(0.5, input.maxDistance ?? LASER_BEAM_MAX_DISTANCE);
  const dirLen = Math.hypot(input.beamDir.x, input.beamDir.y, input.beamDir.z);
  const normDir: Vec3 =
    dirLen > 1e-6
      ? {
          x: input.beamDir.x / dirLen,
          y: input.beamDir.y / dirLen,
          z: input.beamDir.z / dirLen,
        }
      : { x: 0, y: 0, z: 1 };

  const rayRes = castMuzzleRaycast3D(input.muzzleOrigin, normDir, input.colliders, {
    maxDistance: maxDist,
    shooterId: input.shooterId ?? null,
    shooterTeam: input.shooterTeam ?? 'blue',
  });

  const startPoint: Vec3 = {
    x: input.muzzleOrigin.x,
    y: input.muzzleOrigin.y,
    z: input.muzzleOrigin.z,
  };
  const endPoint: Vec3 = {
    x: rayRes.point.x,
    y: rayRes.point.y,
    z: rayRes.point.z,
  };

  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const dz = endPoint.z - startPoint.z;
  const beamLength = Math.max(0.05, Math.hypot(dx, dy, dz));
  const beamMidpoint: Vec3 = {
    x: (startPoint.x + endPoint.x) * 0.5,
    y: (startPoint.y + endPoint.y) * 0.5,
    z: (startPoint.z + endPoint.z) * 0.5,
  };

  const t = input.elapsedSec ?? 0;
  // High-frequency dual-harmonic pulsation for the outer AdditiveBlending glow sheath & core
  const fastWave = Math.sin(t * 48.0) * 0.65 + Math.cos(t * 83.0) * 0.35;
  const coreRadiusScale = clamp(1.0 + fastWave * 0.14, 0.84, 1.18);
  const outerGlowRadiusScale = clamp(1.0 + fastWave * 0.32, 0.68, 1.35);
  const outerGlowOpacity = clamp(0.68 + fastWave * 0.24, 0.42, 0.96);
  const muzzlePulseScale = clamp(1.0 + Math.sin(t * 54.0) * 0.25, 0.72, 1.28);
  const hitPulseScale = clamp(1.0 + Math.cos(t * 62.0) * 0.28, 0.7, 1.32);

  return {
    startPoint,
    endPoint,
    beamLength,
    beamMidpoint,
    beamDir: normDir,
    hit: rayRes.hit,
    hitDistance: rayRes.distance,
    hitNormal: rayRes.normal,
    hitTargetKind: rayRes.targetKind,
    hitTargetId: rayRes.colliderId,
    coreRadiusScale,
    outerGlowRadiusScale,
    outerGlowOpacity,
    muzzlePulseScale,
    hitPulseScale,
    raycastResult: rayRes,
  };
}

// ============================================================================
// NEAR HACKATHON: LOBBY SAFEZONE 2-PORTAL FACTION SELECTION, 1:1 TRAM SHELTER,
// ZERO FRIENDLY-FIRE, NEP-171 GAMEPASS SESSION BASES & PUBLIC WARZONE PADS
// ============================================================================

export const LOBBY_SAFEZONE_MAX_X = -76.2;

export const LOBBY_SAFEZONE_BOUNDS = {
  minX: -104.5,
  maxX: LOBBY_SAFEZONE_MAX_X,
  minZ: -38.5,
  maxZ: 38.5,
  spawnX: -85.5,
  spawnZ: 0.0,
} as const;

export interface LobbyFactionPortalSpec {
  id: 'north_red' | 'south_blue';
  team: 'red' | 'blue';
  x: number;
  z: number;
  radius: number;
  portalKind: 'warzone' | 'safezone';
  style: 'crate_pad_hologram';
  label: string;
  floatingButtonLabel: 'RED TEAM' | 'BLUE TEAM' | 'ENTER CITY';
  floatingButtons: readonly ('RED TEAM' | 'BLUE TEAM' | 'ENTER CITY')[];
  subtitle: string;
  sectorLabel: string;
  colorHex: string;
  targetSpawnX: number;
  targetSpawnZ: number;
  targetYaw: number;
}

export const LOBBY_FACTION_PORTALS: readonly LobbyFactionPortalSpec[] = [
  {
    id: 'north_red',
    team: 'red',
    portalKind: 'warzone',
    style: 'crate_pad_hologram',
    x: -84.0,
    z: -15.0,
    radius: 2.65,
    label: 'GATE 1: WARZONE ARENA',
    floatingButtonLabel: 'RED TEAM',
    floatingButtons: ['RED TEAM', 'BLUE TEAM'],
    subtitle: 'STAND IN CIRCLE -> SELECT [RED TEAM] OR [BLUE TEAM]',
    sectorLabel: 'WARZONE ARENA · SELECT COMBAT TEAM',
    colorHex: '#ff3b30',
    targetSpawnX: -36.5,
    targetSpawnZ: -61.5,
    targetYaw: -Math.PI / 2,
  },
  {
    id: 'south_blue',
    team: 'blue',
    portalKind: 'safezone',
    style: 'crate_pad_hologram',
    x: -84.0,
    z: 15.0,
    radius: 2.65,
    label: 'GATE 2: SAFEZONE CITY',
    floatingButtonLabel: 'ENTER CITY',
    floatingButtons: ['ENTER CITY'],
    subtitle: 'STAND IN CIRCLE -> CLICK [ENTER CITY] (PEACEFUL CITY & TRAM)',
    sectorLabel: 'SAFEZONE CITY · TRAM SHELTER & SOCIAL PLAZA',
    colorHex: '#00a8ff',
    targetSpawnX: -63.4,
    targetSpawnZ: 4.6,
    targetYaw: Math.PI,
  },
] as const;

export const LOBBY_NEAR_TERMINAL_SPEC = {
  x: -81.8,
  z: 0.0,
  interactRadius: 3.6,
  contractId: 'gamepass.buddiesblitz.near',
  nftStandard: 'NEP-171',
  mintPriceNear: 1.5,
  label: 'NEAR NFT GAMEPASS TERMINAL',
  subtitle: '[E / B] CONNECT .NEAR WALLET & MINT NEP-171 COMMANDER GAMEPASS',
} as const;

export interface LobbyTramReturnPadSpec {
  id: 'north_lobby_pad' | 'south_lobby_pad';
  side: 'north' | 'south';
  x: number;
  z: number;
  radius: number;
  colorHex: string;
  style: 'crate_pad_hologram';
  label: 'CENTRAL PLAZA';
}

export const LOBBY_TRAM_RETURN_PADS: readonly LobbyTramReturnPadSpec[] = [
  {
    id: 'north_lobby_pad',
    side: 'north',
    x: -63.4,
    z: -4.6,
    radius: 1.45,
    colorHex: '#38bdf8',
    style: 'crate_pad_hologram',
    label: 'CENTRAL PLAZA',
  },
  {
    id: 'south_lobby_pad',
    side: 'south',
    x: -63.4,
    z: 4.6,
    radius: 1.45,
    colorHex: '#38bdf8',
    style: 'crate_pad_hologram',
    label: 'CENTRAL PLAZA',
  },
] as const;

export const LOBBY_TRAM_SHELTER_SPEC = {
  shelterCenterX: -63.8,
  shelterCenterZ: 0.0,
  westEdgeX: -64.97,
  eastEdgeX: -58.37,
  canopyCenterX: -60.45,
  canopyCenterZ: 0.0,
  platformCenterX: -61.67,
  platformCenterZ: 0.0,
  platformLength: 18.4,
  centralPlatformLength: 15.4,
  platformWidth: 6.6,
  canopyLength: 15.4,
  canopyWidth: 2.58,
  canopyHeight: 3.35,
  returnPadX: -63.4,
  returnPadZ: -4.6,
  southReturnPadX: -63.4,
  southReturnPadZ: 4.6,
  returnPadRadius: 1.45,
  returnPads: LOBBY_TRAM_RETURN_PADS,
  label: 'CENTRAL PLAZA',
  subtitle: 'MODERN CITY TRAM SHELTER · RETURN TO CENTRAL PLAZA',
} as const;

export const PUBLIC_PAD_SHIELD_RADIUS = 3.6;

export interface PublicWarzoneCratePadSpec {
  id: string;
  x: number;
  z: number;
  worldX: number;
  worldZ: number;
  team: 'blue' | 'red';
  teamBias: 'blue' | 'red';
  shieldRadius: number;
  hasKiosk: false;
  label: string;
}

/**
 * 8 Shielded Public Crate Pads & Random Spawn Points (4 Blue Team in South Area + 4 Red Team in North Area):
 * - Positioned strictly on the corners of the grass islands (`evaluateBlitzGrassMask(x, z) === 1.0 > 0.75`
 *   and `isPointOnAsphaltRoadOrZebraCross(x, z) === false` across the entire 3.6m shield circle)
 * - Surrounded by a thin semi-transparent team-colored floor ring & cylindrical light curtain shield
 * - Enemy units cannot enter an opposing team's shield (`resolveEnemyPublicPadShieldBarrier2D`)
 * - Units inside their own team's shield are 100% immune to external attacks (`canApplyCombatDamage`)
 * - Weapons inside the shield are trigger-locked (`isUnitWeaponTriggerLockedInSafeShield`) for zero visual pollution.
 */
export const PUBLIC_WARZONE_CRATE_PADS: readonly PublicWarzoneCratePadSpec[] = [
  // 4 BLUE TEAM PADS (SOUTH GRASS ISLAND CORNERS, z > 0)
  {
    id: 'public_pad_blue_sw',
    x: -54.0,
    z: 38.0,
    worldX: -54.0,
    worldZ: 38.0,
    team: 'blue',
    teamBias: 'blue',
    shieldRadius: PUBLIC_PAD_SHIELD_RADIUS,
    hasKiosk: false,
    label: 'BLUE SHIELD PAD #1 (SW GRASS)',
  },
  {
    id: 'public_pad_blue_cw',
    x: -9.5,
    z: 33.0,
    worldX: -9.5,
    worldZ: 33.0,
    team: 'blue',
    teamBias: 'blue',
    shieldRadius: PUBLIC_PAD_SHIELD_RADIUS,
    hasKiosk: false,
    label: 'BLUE SHIELD PAD #2 (CW GRASS)',
  },
  {
    id: 'public_pad_blue_ce',
    x: 9.5,
    z: 41.5,
    worldX: 9.5,
    worldZ: 41.5,
    team: 'blue',
    teamBias: 'blue',
    shieldRadius: PUBLIC_PAD_SHIELD_RADIUS,
    hasKiosk: false,
    label: 'BLUE SHIELD PAD #3 (CE GRASS)',
  },
  {
    id: 'public_pad_blue_se',
    x: 54.0,
    z: 38.0,
    worldX: 54.0,
    worldZ: 38.0,
    team: 'blue',
    teamBias: 'blue',
    shieldRadius: PUBLIC_PAD_SHIELD_RADIUS,
    hasKiosk: false,
    label: 'BLUE SHIELD PAD #4 (SE GRASS)',
  },
  // 4 RED TEAM PADS (NORTH GRASS ISLAND CORNERS, z < 0 — 100% North-South Mirrored)
  {
    id: 'public_pad_red_nw',
    x: -54.0,
    z: -38.0,
    worldX: -54.0,
    worldZ: -38.0,
    team: 'red',
    teamBias: 'red',
    shieldRadius: PUBLIC_PAD_SHIELD_RADIUS,
    hasKiosk: false,
    label: 'RED SHIELD PAD #1 (NW GRASS)',
  },
  {
    id: 'public_pad_red_cw',
    x: -27.5,
    z: -41.5,
    worldX: -27.5,
    worldZ: -41.5,
    team: 'red',
    teamBias: 'red',
    shieldRadius: PUBLIC_PAD_SHIELD_RADIUS,
    hasKiosk: false,
    label: 'RED SHIELD PAD #2 (CW GRASS)',
  },
  {
    id: 'public_pad_red_ce',
    x: 9.5,
    z: -33.0,
    worldX: 9.5,
    worldZ: -33.0,
    team: 'red',
    teamBias: 'red',
    shieldRadius: PUBLIC_PAD_SHIELD_RADIUS,
    hasKiosk: false,
    label: 'RED SHIELD PAD #3 (CE GRASS)',
  },
  {
    id: 'public_pad_red_ne',
    x: 54.0,
    z: -38.0,
    worldX: 54.0,
    worldZ: -38.0,
    team: 'red',
    teamBias: 'red',
    shieldRadius: PUBLIC_PAD_SHIELD_RADIUS,
    hasKiosk: false,
    label: 'RED SHIELD PAD #4 (NE GRASS)',
  },
] as const;

export function getPublicWarzoneCratePadsForTeam(
  team: 'blue' | 'red',
): readonly PublicWarzoneCratePadSpec[] {
  return PUBLIC_WARZONE_CRATE_PADS.filter((p) => p.teamBias === team);
}

/**
 * Evaluates whether `(worldX, worldZ)` lies inside any of the 8 Shielded Public Crate Pads.
 */
export function evaluatePublicPadShieldZone(
  worldX: number,
  worldZ: number,
  unitTeam?: 'blue' | 'red',
): {
  insideShield: boolean;
  insideAnyShield: boolean;
  isFriendlyShield: boolean;
  isEnemyShield: boolean;
  pad: PublicWarzoneCratePadSpec | null;
  distance: number;
} {
  let nearestPad: PublicWarzoneCratePadSpec | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < PUBLIC_WARZONE_CRATE_PADS.length; i++) {
    const pad = PUBLIC_WARZONE_CRATE_PADS[i];
    const d = Math.hypot(worldX - pad.worldX, worldZ - pad.worldZ);
    if (d < bestDist) {
      bestDist = d;
      nearestPad = pad;
    }
    if (d <= pad.shieldRadius) {
      const isFriendly = unitTeam ? pad.teamBias === unitTeam : true;
      return {
        insideShield: true,
        insideAnyShield: true,
        isFriendlyShield: isFriendly,
        isEnemyShield: unitTeam ? pad.teamBias !== unitTeam : false,
        pad,
        distance: d,
      };
    }
  }
  return {
    insideShield: false,
    insideAnyShield: false,
    isFriendlyShield: false,
    isEnemyShield: false,
    pad: nearestPad,
    distance: bestDist,
  };
}

/**
 * Weapon Trigger Lock inside Safe Shield Zones (Zero Visual Pollution):
 * - Returns `true` if the unit is inside the West Lobby Safezone OR inside any Public Crate Pad Shield (`dist <= shieldRadius`).
 * - While `true`, weapons remain visible in the character's hands, but shooting/attacking early-returns before
 *   spawning bullets, Continuous Raycast Laser beam, grenades, land mines, muzzle flash, or consuming ammo.
 * - Stepping outside the shield ring immediately unlocks weapons (`false`).
 */
export function isUnitWeaponTriggerLockedInSafeShield(
  worldX: number,
  worldZ: number,
  _unitTeam?: 'blue' | 'red',
): boolean {
  if (isPointInsideLobbySafezone(worldX, worldZ)) return true;
  const shieldEval = evaluatePublicPadShieldZone(worldX, worldZ, _unitTeam);
  return shieldEval.insideShield;
}

/**
 * Enemy Shield Barrier Collision Resolution:
 * - Blocks enemy units/vehicles (`unitTeam !== pad.teamBias`) from stepping into an opposing team's Public Crate Pad Shield.
 * - Friendly units (`unitTeam === pad.teamBias`) can walk freely in and out of their own team's Shielded Crate Pads.
 */
export function resolveEnemyPublicPadShieldBarrier2D(
  unitX: number,
  unitZ: number,
  unitTeam: 'blue' | 'red',
  unitRadius = 0.72,
): {
  blocked: boolean;
  x: number;
  z: number;
  normalX: number;
  normalZ: number;
  padId: string | null;
} {
  let outX = unitX;
  let outZ = unitZ;
  let blocked = false;
  let normalX = 0;
  let normalZ = 0;
  let hitPadId: string | null = null;

  for (let i = 0; i < PUBLIC_WARZONE_CRATE_PADS.length; i++) {
    const pad = PUBLIC_WARZONE_CRATE_PADS[i];
    if (pad.teamBias === unitTeam) continue;
    const minAllowedDist = pad.shieldRadius + Math.max(0, unitRadius);
    const dx = outX - pad.worldX;
    const dz = outZ - pad.worldZ;
    const dist = Math.hypot(dx, dz);
    if (dist < minAllowedDist) {
      blocked = true;
      hitPadId = pad.id;
      if (dist > 1e-5) {
        normalX = dx / dist;
        normalZ = dz / dist;
        outX = pad.worldX + normalX * minAllowedDist;
        outZ = pad.worldZ + normalZ * minAllowedDist;
      } else {
        normalX = 0;
        normalZ = pad.teamBias === 'blue' ? -1 : 1;
        outX = pad.worldX;
        outZ = pad.worldZ + normalZ * minAllowedDist;
      }
    }
  }

  return { blocked, x: outX, z: outZ, normalX, normalZ, padId: hitPadId };
}

/**
 * Picks one of the 4 grass-island Shielded Public Crate Pads for `team` at random (used on Lobby Portal entry
 * and on Warzone deaths 1..4 when `livesRemaining > 0`).
 */
export function pickRandomTeamShieldedCratePadSpawn(
  team: 'blue' | 'red',
  rng: (() => number) | number = Math.random,
): {
  pad: PublicWarzoneCratePadSpec;
  padId: string;
  padIndex: number;
  x: number;
  z: number;
  spawnX: number;
  spawnZ: number;
  spawnYaw: number;
  label: string;
} {
  const teamPads = getPublicWarzoneCratePadsForTeam(team);
  const randVal = typeof rng === 'function' ? rng() : rng;
  const rawRand = Math.max(0, Math.min(0.999999, randVal));
  const padIndex = Math.floor(rawRand * teamPads.length);
  const pad = teamPads[padIndex] ?? teamPads[0];
  return {
    pad,
    padId: pad.id,
    padIndex,
    x: pad.worldX,
    z: pad.worldZ,
    spawnX: pad.worldX,
    spawnZ: pad.worldZ,
    spawnYaw: team === 'blue' ? Math.PI / 2 : -Math.PI / 2,
    label: pad.label,
  };
}

/**
 * Returns true if `(worldX, worldZ)` is inside the West Lobby Safezone (`x <= -76.2`, `100% Safezone`).
 */
export function isPointInsideLobbySafezone(
  worldX: number,
  worldZ: number,
  activeScene?: 'lobby' | 'warzone' | 'safezone',
): boolean {
  if (activeScene && activeScene !== 'lobby') {
    return false;
  }
  return (
    worldX >= LOBBY_SAFEZONE_BOUNDS.minX &&
    worldX <= LOBBY_SAFEZONE_BOUNDS.maxX &&
    worldZ >= LOBBY_SAFEZONE_BOUNDS.minZ &&
    worldZ <= LOBBY_SAFEZONE_BOUNDS.maxZ
  );
}

/**
 * Returns the bright team indicator color for the foot/selection ring underneath any character
 * (player or AI unit):
 * - Blue Team (`'blue'`): Bright Blue (`#00a8ff`, `0x00a8ff`)
 * - Red Team (`'red'`): Bright Red (`#ff3b30`, `0xff3b30`)
 * Never uses green (`0xb4ff39`) or yellow.
 */
export function getUnitFootRingTeamColor(team: 'blue' | 'red'): {
  team: 'blue' | 'red';
  hexInt: number;
  hexString: '#00a8ff' | '#ff3b30';
} {
  if (team === 'red') {
    return { team: 'red', hexInt: 0xff3b30, hexString: '#ff3b30' };
  }
  return { team: 'blue', hexInt: 0x00a8ff, hexString: '#00a8ff' };
}

export type CityArenaMode = 'warzone' | 'safezone';

export const SAFEZONE_CITY_HALTE_SPAWN = {
  x: -63.4,
  z: 4.6,
  yaw: Math.PI,
  label: 'HALTE TREM DEPAN CENTRAL PLAZA (SAFEZONE CITY)',
} as const;

export interface CitySafezoneModeRules {
  mode: CityArenaMode;
  isPeacefulSafezone: boolean;
  cratesEnabled: boolean;
  explosiveBarrelsEnabled: boolean;
  landMinesEnabled: boolean;
  combatAiEnabled: boolean;
  baseKiosksEnabled: boolean;
  militaryStackingPadsEnabled: boolean;
  skyshieldTurretsEnabled: boolean;
  harvestersEnabled: boolean;
  supplyDropsEnabled: boolean;
  weaponsEnabled: boolean;
  combatHudVisible: boolean;
  socialTalkEnabled: boolean;
  rideTramEnabled: boolean;
}

export function evaluateCitySafezoneModeRules(
  mode: CityArenaMode | 'lobby',
): CitySafezoneModeRules {
  const isSafe = mode === 'safezone' || mode === 'lobby';
  return {
    mode: isSafe ? 'safezone' : 'warzone',
    isPeacefulSafezone: isSafe,
    cratesEnabled: !isSafe,
    explosiveBarrelsEnabled: !isSafe,
    landMinesEnabled: !isSafe,
    combatAiEnabled: !isSafe,
    baseKiosksEnabled: true,
    militaryStackingPadsEnabled: !isSafe,
    skyshieldTurretsEnabled: !isSafe,
    harvestersEnabled: !isSafe,
    supplyDropsEnabled: !isSafe,
    weaponsEnabled: !isSafe,
    combatHudVisible: !isSafe,
    socialTalkEnabled: true,
    rideTramEnabled: true,
  };
}

export interface LobbyAndSafezonePeacefulState {
  isInsideLobby: boolean;
  isLobbyOrSafezone: boolean;
  combatHudVisible: boolean;
  populationAndLivesBarVisible: boolean;
  harvesterContractBadgeVisible: boolean;
  bottomRightWeaponAndHpHudVisible: boolean;
  minimapRadarVisible: boolean;
  lobbyGoldExchangeButtonVisible: boolean;
  handWeaponMeshVisible: boolean;
  externalCombatObjectsVisible: boolean;
  externalCombatCollidersEnabled: boolean;
  cityRoadsAndTramVisible: boolean;
  lobbyPortalsVisible: boolean;
  halteReturnPadsVisible: boolean;
  cityKiosksAndUnitsVisible: boolean;
}

/**
 * Evaluates HUD visibility, character hand-weapon mesh visibility, and external city/combat
 * object & collider rules across Lobby (`isInsideLobbySafezone` / `worldMode === 'lobby'`),
 * Safezone City (`worldMode === 'safezone'`), and Warzone (`worldMode === 'warzone'`).
 */
export function evaluateLobbyAndSafezonePeacefulState(params: {
  worldMode: 'lobby' | 'warzone' | 'safezone';
  isInsideLobbySafezone: boolean;
  cityArenaMode?: CityArenaMode;
}): LobbyAndSafezonePeacefulState {
  const isInsideLobby = params.worldMode === 'lobby' || params.isInsideLobbySafezone;
  const isLobbyOrSafezone =
    isInsideLobby ||
    params.worldMode === 'safezone' ||
    params.cityArenaMode === 'safezone';
  const combatVisible = !isLobbyOrSafezone;

  return {
    isInsideLobby,
    isLobbyOrSafezone,
    combatHudVisible: combatVisible,
    populationAndLivesBarVisible: combatVisible,
    harvesterContractBadgeVisible: combatVisible,
    bottomRightWeaponAndHpHudVisible: combatVisible,
    minimapRadarVisible: !isInsideLobby,
    lobbyGoldExchangeButtonVisible: isInsideLobby,
    handWeaponMeshVisible: combatVisible,
    externalCombatObjectsVisible: combatVisible,
    externalCombatCollidersEnabled: combatVisible,
    cityRoadsAndTramVisible: true,
    lobbyPortalsVisible: false,
    halteReturnPadsVisible: false,
    cityKiosksAndUnitsVisible: true,
  };
}

/**
 * Finds the exact City Tram lead distance (meters along the closed loop) where Car 1
 * is stopped right alongside the Modern Urban Tram Stop Shelter in front of the Lobby (`x ≈ -70.0, z ≈ 0.8`).
 */
export function findCityTramLeadDistanceNearHalte(): number {
  const sample0 = evaluateCityTramConsistState(0);
  const totalLen = sample0.totalTrackLength;
  let bestDist = 0;
  let bestScore = Infinity;
  const steps = 360;
  for (let i = 0; i < steps; i++) {
    const d = (i / steps) * totalLen;
    const st = evaluateCityTramConsistState(d);
    const err = Math.hypot(st.car1.x - -70.0, st.car1.z - SAFEZONE_CITY_HALTE_SPAWN.z);
    if (err < bestScore) {
      bestScore = err;
      bestDist = d;
    }
  }
  return bestDist;
}

/**
 * Evaluates whether a player inside the Lobby Safezone is standing inside one of the 2 Glowing Gapura Portal Rings:
 * - Strictly requires `worldX <= LOBBY_SAFEZONE_BOUNDS.maxX` (`-76.2`) and `activeScene === 'lobby'` (when provided)
 *   so portal buttons (`ENTER CITY`, `RED TEAM`, `BLUE TEAM`) never leak outside the Lobby concrete wall!
 */
export function evaluateLobbyFactionPortalStep(
  worldX: number,
  worldZ: number,
  rng: () => number = Math.random,
  activeScene?: 'lobby' | 'warzone' | 'safezone',
): {
  triggered: true;
  autoTeleportOnStep: false;
  requiresFloatingButtonClick: true;
  portalId: 'north_red' | 'south_blue';
  portalKind: 'warzone' | 'safezone';
  team: 'red' | 'blue';
  floatingButtonLabel: 'RED TEAM' | 'BLUE TEAM' | 'ENTER CITY';
  floatingButtons: readonly ('RED TEAM' | 'BLUE TEAM' | 'ENTER CITY')[];
  portalWorldX: number;
  portalWorldZ: number;
  spawnPadId: string;
  spawnX: number;
  spawnZ: number;
  spawnYaw: number;
  safezoneSpawnX: number;
  safezoneSpawnZ: number;
  safezoneSpawnYaw: number;
  label: string;
  portalLabel: string;
  sectorLabel: string;
} | null {
  if (activeScene && activeScene !== 'lobby') {
    return null;
  }
  if (!isPointInsideLobbySafezone(worldX, worldZ)) {
    return null;
  }
  for (let i = 0; i < LOBBY_FACTION_PORTALS.length; i++) {
    const p = LOBBY_FACTION_PORTALS[i];
    const distPrimary = Math.hypot(worldX - p.x, worldZ - p.z);
    if (distPrimary <= p.radius) {
      const randomPadSpawn = pickRandomTeamShieldedCratePadSpawn(p.team, rng);
      return {
        triggered: true,
        autoTeleportOnStep: false,
        requiresFloatingButtonClick: true,
        portalId: p.id,
        portalKind: p.portalKind,
        team: p.team,
        floatingButtonLabel: p.floatingButtonLabel,
        floatingButtons: p.floatingButtons,
        portalWorldX: p.x,
        portalWorldZ: p.z,
        spawnPadId: randomPadSpawn.padId,
        spawnX: randomPadSpawn.spawnX,
        spawnZ: randomPadSpawn.spawnZ,
        spawnYaw: randomPadSpawn.spawnYaw,
        safezoneSpawnX: SAFEZONE_CITY_HALTE_SPAWN.x,
        safezoneSpawnZ: SAFEZONE_CITY_HALTE_SPAWN.z,
        safezoneSpawnYaw: SAFEZONE_CITY_HALTE_SPAWN.yaw,
        label: p.label,
        portalLabel: p.label,
        sectorLabel: `${p.sectorLabel} · ${randomPadSpawn.label}`,
      };
    }
  }
  return null;
}

/**
 * Evaluates whether a unit is standing inside either of the 2 Crate-Pad-style Glowing LOBBY Return Pads
 * on the North (`(-62.77, -10.2)`) and South (`(-62.77, +10.2)`) ends of the widened Halte Trem platform deck.
 * Does NOT auto-teleport on step (`autoTeleportOnStep: false`, `requiresFloatingButtonClick: true`).
 * Returns `null` when stepping outside both circles.
 */
export function evaluateLobbyTramReturnPadStep(
  worldX: number,
  worldZ: number,
  radiusOverride?: number,
): {
  triggered: true;
  autoTeleportOnStep: false;
  requiresFloatingButtonClick: true;
  padId: 'north_lobby_pad' | 'south_lobby_pad';
  side: 'north' | 'south';
  padWorldX: number;
  padWorldZ: number;
  radius: number;
  colorHex: string;
  style: 'crate_pad_hologram';
  label: 'CENTRAL PLAZA';
  floatingButtonLabel: 'CENTRAL PLAZA';
} | null {
  for (let i = 0; i < LOBBY_TRAM_RETURN_PADS.length; i++) {
    const pad = LOBBY_TRAM_RETURN_PADS[i];
    const r = radiusOverride ?? pad.radius;
    const dist = Math.hypot(worldX - pad.x, worldZ - pad.z);
    if (dist <= r) {
      return {
        triggered: true,
        autoTeleportOnStep: false,
        requiresFloatingButtonClick: true,
        padId: pad.id,
        side: pad.side,
        padWorldX: pad.x,
        padWorldZ: pad.z,
        radius: r,
        colorHex: pad.colorHex,
        style: pad.style,
        label: pad.label,
        floatingButtonLabel: pad.label,
      };
    }
  }
  return null;
}

/**
 * Returns true ONLY when a unit is standing inside one of the 2 Crate-Pad-style glowing circles
 * (North or South) on the widened Modern Urban Tram Stop platform deck in front of the Lobby.
 * Stepping outside both glowing circles immediately returns `false`.
 */
export function isUnitNearLobbyTramReturnPad(
  worldX: number,
  worldZ: number,
  radiusOverride?: number,
): boolean {
  return evaluateLobbyTramReturnPadStep(worldX, worldZ, radiusOverride) !== null;
}

/**
 * Strict Zero Friendly-Fire, 100% Lobby Safezone, & Shielded Public Crate Pad Damage Immunity Rule:
 * 1. If either the attacker or the target is inside the Lobby Safezone, returns `false` (0 damage).
 * 2. If the attacker is inside any Public Crate Pad Shield (Weapon Trigger Lock), returns `false`.
 * 3. If the target is inside their own team's Public Crate Pad Shield (`pad.teamBias === targetTeam`), returns `false` (100% Shield Immunity).
 * 4. If `attackerTeam === targetTeam` (Blue vs Blue or Red vs Red), returns `false` (Strict Team Immunity across all weapons).
 */
export function canApplyCombatDamage(
  arg1:
    | {
        attackerTeam: 'blue' | 'red';
        targetTeam: 'blue' | 'red';
        attackerX?: number;
        attackerZ?: number;
        targetX?: number;
        targetZ?: number;
      }
    | ('blue' | 'red'),
  targetTeamArg?: 'blue' | 'red',
  attackerXArg?: number,
  attackerZArg?: number,
  targetXArg?: number,
  targetZArg?: number,
): boolean {
  const params =
    typeof arg1 === 'object'
      ? arg1
      : {
          attackerTeam: arg1,
          targetTeam: targetTeamArg!,
          attackerX: attackerXArg,
          attackerZ: attackerZArg,
          targetX: targetXArg,
          targetZ: targetZArg,
        };
  if (
    params.attackerX !== undefined &&
    params.attackerZ !== undefined &&
    (isPointInsideLobbySafezone(params.attackerX, params.attackerZ) ||
      evaluatePublicPadShieldZone(params.attackerX, params.attackerZ).insideShield)
  ) {
    return false;
  }
  if (params.targetX !== undefined && params.targetZ !== undefined) {
    if (isPointInsideLobbySafezone(params.targetX, params.targetZ)) {
      return false;
    }
    const targetShield = evaluatePublicPadShieldZone(params.targetX, params.targetZ);
    if (targetShield.insideShield && targetShield.pad?.teamBias === params.targetTeam) {
      return false;
    }
  }
  if (params.attackerTeam === params.targetTeam) {
    return false;
  }
  return true;
}

export interface NearGamepassSessionState {
  walletConnected: boolean;
  accountId: string | null;
  walletId: string | null;
  hasGamepassNft: boolean;
  tokenId: string | null;
  contractId: string;
  claimedTeam: 'blue' | 'red' | null;
  claimedPlotIndex: number | null;
  activeHarvesterSubAccounts: string[];
  sessionStatusBanner: string;
}

export function createInitialNearGamepassSessionState(): NearGamepassSessionState {
  return {
    walletConnected: false,
    accountId: null,
    walletId: null,
    hasGamepassNft: false,
    tokenId: null,
    contractId: LOBBY_NEAR_TERMINAL_SPEC.contractId,
    claimedTeam: null,
    claimedPlotIndex: null,
    activeHarvesterSubAccounts: [],
    sessionStatusBanner: 'Connect .near Wallet & Mint NEP-171 Gamepass to Claim an Online Session Base.',
  };
}

export function connectNearWalletAndMintGamepass(
  state: NearGamepassSessionState,
  customAccountId?: string,
): NearGamepassSessionState {
  const trimmed = (customAccountId ?? '').trim().toLowerCase();
  if (!trimmed) {
    return {
      ...state,
      walletConnected: false,
      accountId: null,
      walletId: null,
      hasGamepassNft: false,
      tokenId: null,
      sessionStatusBanner:
        'Connect or register a NEAR Wallet first to verify NEP-171 House ownership.',
    };
  }
  const cleanAccount =
    trimmed.endsWith('.near') ||
    trimmed.endsWith('.testnet') ||
    trimmed.includes('.') ||
    /^[0-9a-f]{64}$/.test(trimmed)
      ? trimmed
      : `${trimmed}.near`;
  const tokenId = `nep171-gamepass-${cleanAccount.replace(/[^a-z0-9]/g, '-')}-01`;
  return {
    ...state,
    walletConnected: true,
    accountId: cleanAccount,
    walletId: cleanAccount,
    hasGamepassNft: true,
    tokenId,
    sessionStatusBanner: `NEP-171 GAMEPASS MINTED (${cleanAccount} · ${tokenId})! Visit a Kiosk on an empty grass plot to Claim Base.`,
  };
}

/**
 * Synchronizes a connected NEAR wallet session WITHOUT falsely granting House/Gamepass ownership.
 * `hasGamepassNft` is ONLY `true` when `ownsHouse` has been verified on `market.buddiesblitz.testnet`.
 */
export function syncNearWalletSessionOwnership(
  state: NearGamepassSessionState,
  customAccountId: string | undefined,
  ownsHouse: boolean,
  houseTokenId?: string | null,
): NearGamepassSessionState {
  const trimmed = (customAccountId ?? '').trim().toLowerCase();
  if (!trimmed) {
    return createInitialNearGamepassSessionState();
  }
  const cleanAccount =
    trimmed.endsWith('.near') ||
    trimmed.endsWith('.testnet') ||
    trimmed.includes('.') ||
    /^[0-9a-f]{64}$/.test(trimmed)
      ? trimmed
      : `${trimmed}.testnet`;
  const resolvedTokenId = ownsHouse
    ? (houseTokenId && houseTokenId.trim() ? houseTokenId.trim() : 'house-deed-0001')
    : null;
  return {
    ...state,
    walletConnected: true,
    accountId: cleanAccount,
    walletId: cleanAccount,
    hasGamepassNft: Boolean(ownsHouse),
    tokenId: resolvedTokenId,
    claimedTeam: ownsHouse ? state.claimedTeam : null,
    claimedPlotIndex: ownsHouse ? state.claimedPlotIndex : null,
    sessionStatusBanner: ownsHouse
      ? `HOUSE DEED VERIFIED (${cleanAccount} · ${resolvedTokenId})! Visit an empty plot Kiosk to Claim Plot.`
      : `WALLET CONNECTED (${cleanAccount}). Purchase House Ownership (25 RESPITE) from Hana to claim a plot.`,
  };
}

export function generateNearHarvesterSwarmSubAccounts(
  nearAccountId: string,
  _team?: 'blue' | 'red',
  _commanderIdx?: number,
  count = 2,
): string[] {
  const trimmed = (nearAccountId ?? '').trim().toLowerCase();
  if (!trimmed) return [];
  const cleanWallet =
    trimmed.endsWith('.near') ||
    trimmed.endsWith('.testnet') ||
    trimmed.includes('.') ||
    /^[0-9a-f]{64}$/.test(trimmed)
      ? trimmed
      : `${trimmed}.near`;
  const result: string[] = [];
  for (let i = 1; i <= count; i++) {
    result.push(`harvester-${i}.${cleanWallet}`);
  }
  return result;
}

/**
 * Claims an empty grass base plot via the standalone Kiosk machine using a NEAR NEP-171 Gamepass NFT:
 * - In Warzone mode: activates `isClaimedOnlineSession = true`, restores full building/fence/Skyshield HP, and spawns AI Harvester Swarm sub-accounts!
 * - In Safezone mode (`options?.isSafezoneMode === true`): claims the social garden plot without any military elements (no Skyshield Turret, no Stacking Pad, no Harvesters).
 */
export function claimEmptyBasePlotWithNearGamepass(
  session: NearGamepassSessionState,
  basesOrBlueBases: IndividualCommanderBaseState[],
  redBasesOrPlayerTeam: IndividualCommanderBaseState[] | ('blue' | 'red'),
  playerTeamOrTargetTeam: 'blue' | 'red',
  targetPlotIndex: number,
  options?: { isSafezoneMode?: boolean },
): {
  success: boolean;
  claimed: boolean;
  message: string;
  updatedSession: NearGamepassSessionState;
} {
  const isSafezoneMode = Boolean(options?.isSafezoneMode);
  const playerTeam: 'blue' | 'red' =
    typeof redBasesOrPlayerTeam === 'string' ? redBasesOrPlayerTeam : playerTeamOrTargetTeam;
  const activeSession = session;
  if (!activeSession.walletConnected || !activeSession.hasGamepassNft || !activeSession.accountId) {
    return {
      success: false,
      claimed: false,
      message: 'Connect a verified NEAR Wallet with a NEP-171 Gamepass before claiming a Base Plot.',
      updatedSession: activeSession,
    };
  }

  const targetBases =
    typeof redBasesOrPlayerTeam === 'string'
      ? basesOrBlueBases
      : playerTeam === 'blue'
        ? basesOrBlueBases
        : redBasesOrPlayerTeam;

  const clampedIdx = Math.max(0, Math.min(targetBases.length - 1, targetPlotIndex));
  const effectiveIdx =
    !isSafezoneMode &&
    playerTeam === 'blue' &&
    clampedIdx === 0 &&
    targetBases.length > 1 &&
    !targetBases[1].isClaimedOnlineSession
      ? 1
      : clampedIdx;

  // Release any previously claimed non-Model-Estate plot first so 1 Gamepass = 1 active online session base
  for (const b of basesOrBlueBases) {
    if (!isIntactModelEstateBasePlot(b.team, b.commanderIdx) && b.claimedByNearAccount === activeSession.accountId) {
      b.isClaimedOnlineSession = false;
      b.claimedByNearAccount = null;
      b.claimedByNearWallet = null;
    }
  }
  if (Array.isArray(redBasesOrPlayerTeam)) {
    for (const r of redBasesOrPlayerTeam) {
      if (!isIntactModelEstateBasePlot(r.team, r.commanderIdx) && r.claimedByNearAccount === activeSession.accountId) {
        r.isClaimedOnlineSession = false;
        r.claimedByNearAccount = null;
        r.claimedByNearWallet = null;
      }
    }
  }

  const plot = targetBases[effectiveIdx];
  if (!plot) {
    return {
      success: false,
      claimed: false,
      message: 'Base Plot not found!',
      updatedSession: activeSession,
    };
  }

  plot.isClaimedOnlineSession = true;
  plot.claimedByNearAccount = activeSession.accountId;
  plot.claimedByNearWallet = activeSession.accountId;
  plot.destroyed = false;
  plot.buildingHp = plot.buildingMaxHp;
  plot.fenceHp = plot.fenceMaxHp;
  plot.hasSkyshield = !isSafezoneMode;
  if (isSafezoneMode) {
    plot.hasParkingBay = false;
    plot.hasHelipad = false;
    plot.gardenPreset = 'sakura_grove';
    plot.safezoneAccessMode = plot.safezoneAccessMode ?? 'PUBLIC';
    plot.safezoneAllowedFriends = plot.safezoneAllowedFriends ?? [];
  }

  const subAccounts = isSafezoneMode
    ? []
    : generateNearHarvesterSwarmSubAccounts(
        activeSession.accountId!,
        playerTeam,
        effectiveIdx,
        2,
      );
  const msg = isSafezoneMode
    ? `PLOT ${playerTeam.toUpperCase()} #${effectiveIdx + 1} CLAIMED (${activeSession.accountId}) - GARDEN ESTATE ACTIVE`
    : `BASE ${playerTeam.toUpperCase()} PLOT #${effectiveIdx + 1} ACTIVE (${activeSession.accountId}) + 2 AI HARVESTER SWARM DEPLOYED!`;

  const updatedSession: NearGamepassSessionState = {
    ...activeSession,
    claimedTeam: playerTeam,
    claimedPlotIndex: effectiveIdx,
    activeHarvesterSubAccounts: subAccounts,
    sessionStatusBanner: msg,
  };

  return {
    success: true,
    claimed: true,
    message: msg,
    updatedSession,
  };
}

/**
 * Releases the player's online session base when going offline or returning to the Safezone Lobby:
 * - Reverts the claimed plot back into an empty green grass lot with only the standalone Kiosk machine
 * - Preserves the permanent Bottom-Left Model Estate (`blue` plot 0).
 */
export function releaseClaimedOnlineSessionBase(
  sessionOrPlots: NearGamepassSessionState | IndividualCommanderBaseState[],
  blueBasesOrPlotIdx: IndividualCommanderBaseState[] | number,
  redBasesOptional?: IndividualCommanderBaseState[],
): {
  released: boolean;
  message: string;
  updatedSession: NearGamepassSessionState;
} {
  if (Array.isArray(sessionOrPlots)) {
    const plots = sessionOrPlots;
    const targetIdx = typeof blueBasesOrPlotIdx === 'number' ? blueBasesOrPlotIdx : -1;
    let releasedAny = false;
    for (let i = 0; i < plots.length; i++) {
      const p = plots[i];
      if (
        (targetIdx === -1 || i === targetIdx) &&
        !isIntactModelEstateBasePlot(p.team, p.commanderIdx) &&
        p.isClaimedOnlineSession
      ) {
        p.isClaimedOnlineSession = false;
        p.claimedByNearAccount = null;
        p.claimedByNearWallet = null;
        releasedAny = true;
      }
    }
    const msg = 'SESSION BASE RELEASED - PLOT REVERTED TO EMPTY GRASS LOT (KIOSK ONLY).';
    return {
      released: releasedAny,
      message: msg,
      updatedSession: {
        ...createInitialNearGamepassSessionState(),
        sessionStatusBanner: msg,
      },
    };
  }

  let releasedAny = false;
  const blueBases = Array.isArray(blueBasesOrPlotIdx) ? blueBasesOrPlotIdx : [];
  const redBases = redBasesOptional ?? [];
  for (const b of blueBases) {
    if (!isIntactModelEstateBasePlot(b.team, b.commanderIdx) && b.isClaimedOnlineSession) {
      b.isClaimedOnlineSession = false;
      b.claimedByNearAccount = null;
      b.claimedByNearWallet = null;
      releasedAny = true;
    }
  }
  for (const r of redBases) {
    if (!isIntactModelEstateBasePlot(r.team, r.commanderIdx) && r.isClaimedOnlineSession) {
      r.isClaimedOnlineSession = false;
      r.claimedByNearAccount = null;
      r.claimedByNearWallet = null;
      releasedAny = true;
    }
  }

  const msg = 'SESSION BASE RELEASED - PLOT REVERTED TO EMPTY GRASS LOT (KIOSK ONLY).';
  const updatedSession: NearGamepassSessionState = {
    ...sessionOrPlots,
    claimedTeam: null,
    claimedPlotIndex: null,
    activeHarvesterSubAccounts: [],
    sessionStatusBanner: msg,
  };

  return {
    released: releasedAny,
    message: msg,
    updatedSession,
  };
}

// ============================================================================
// 5-LIVES WARZONE DEPLOYMENT SYSTEM (150 HP), CONTRACT-BASED AI HARVESTER
// (STANDBY -> CONTRACT ACTIVE -> CONTRACT FULFILLED DESPAWN), LOBBY GOLD
// EXCHANGE, & ALWAYS-ON 10v10 OPEN WARZONE POPULATION BAR
// ============================================================================

export const PLAYER_WARZONE_MAX_HP = 150;
export const PLAYER_WARZONE_MAX_LIVES = 5;
export const MAX_HARVESTERS_PER_BASE = 2;

export const OPEN_WARZONE_TEAM_CAPACITY = {
  maxTotalPerTeam: 10,
  maxBaseOwnersPerTeam: 4,
  maxWarzoneRoamersPerTeam: 6,
} as const;

export function formatWarzoneLivesHudLabel(
  livesRemaining: number,
  maxLives = PLAYER_WARZONE_MAX_LIVES,
): string {
  const safeMax = Math.max(1, maxLives);
  const clamped = Math.max(0, Math.min(safeMax, Math.floor(livesRemaining)));
  return `${clamped}/${safeMax} LIVES`;
}

export interface PlayerWarzoneDeathEvaluation {
  previousLives: number;
  livesRemaining: number;
  maxLives: number;
  deathCountInSession: number;
  isEliminatedToLobby: boolean;
  shouldReleaseClaimedBase: boolean;
  respawnLocation: 'team_sector_safezone' | 'main_lobby_safezone';
  spawnPadId: string | null;
  spawnX: number;
  spawnZ: number;
  spawnYaw: number;
  respawnHp: number;
  livesAfterRespawn: number;
  statusMessage: string;
}

/**
 * Evaluates the 5-Lives Deployment System when the player dies in the Warzone:
 * - Deaths 1..4 (`livesRemaining > 0`): Decrements 1 life, player respawns randomly at one of their team's
 *   4 Shielded Public Crate Pads on the grass island corners (`pickRandomTeamShieldedCratePadSpawn`) with 150 HP
 *   and KEEPS their claimed Session Base!
 * - 5th Death (`livesRemaining === 0`): Player is returned to the Main Safezone Lobby, their claimed Session Base
 *   reverts to an empty grass lot (leaving only the Kiosk machine), and their Warzone slot opens up.
 */
export function evaluatePlayerWarzoneDeathStep(params: {
  currentLives: number;
  maxLives?: number;
  playerTeam: 'blue' | 'red';
  hasClaimedSessionBase: boolean;
  claimedPlotCenterX?: number | null;
  claimedPlotCenterZ?: number | null;
  rng?: () => number;
}): PlayerWarzoneDeathEvaluation {
  const maxLives = Math.max(1, params.maxLives ?? PLAYER_WARZONE_MAX_LIVES);
  const previousLives = Math.max(1, Math.min(maxLives, Math.floor(params.currentLives)));
  const livesRemaining = Math.max(0, previousLives - 1);
  const deathCountInSession = maxLives - livesRemaining;

  if (livesRemaining > 0) {
    const randomPadSpawn = pickRandomTeamShieldedCratePadSpawn(params.playerTeam, params.rng);

    return {
      previousLives,
      livesRemaining,
      maxLives,
      deathCountInSession,
      isEliminatedToLobby: false,
      shouldReleaseClaimedBase: false,
      respawnLocation: 'team_sector_safezone',
      spawnPadId: randomPadSpawn.padId,
      spawnX: randomPadSpawn.spawnX,
      spawnZ: randomPadSpawn.spawnZ,
      spawnYaw: randomPadSpawn.spawnYaw,
      respawnHp: PLAYER_WARZONE_MAX_HP,
      livesAfterRespawn: livesRemaining,
      statusMessage: `${livesRemaining}/${maxLives} LIVES REMAINING - Respawned at ${randomPadSpawn.label} (Base Claim intact)!`,
    };
  }

  return {
    previousLives,
    livesRemaining: 0,
    maxLives,
    deathCountInSession: maxLives,
    isEliminatedToLobby: true,
    shouldReleaseClaimedBase: true,
    respawnLocation: 'main_lobby_safezone',
    spawnPadId: null,
    spawnX: LOBBY_SAFEZONE_BOUNDS.spawnX,
    spawnZ: LOBBY_SAFEZONE_BOUNDS.spawnZ,
    spawnYaw: 0,
    respawnHp: PLAYER_WARZONE_MAX_HP,
    livesAfterRespawn: maxLives,
    statusMessage:
      '0/5 LIVES DEPLETED! Returned to Central Plaza - Base Plot reverted to empty grass lot & Warzone slot opened.',
  };
}

export type HarvesterContractStage = 'STANDBY' | 'CONTRACT_ACTIVE' | 'CONTRACT_FULFILLED';

export interface ContractHarvesterLifecycleState {
  stage: HarvesterContractStage;
  shouldLeaveBaseForWarzone: boolean;
  shouldDespawnWithParticles: boolean;
  canShootOrFight: false;
  statusLabel: string;
  subLabel: string;
}

/**
 * Evaluates the 3-Stage Contract-Based AI Harvester Lifecycle (Max 2 Pure Harvesters per Base):
 * 1. `STANDBY`: No active Kiosk build contract -> Harvester stands by inside the Base near the Stacking Pad/Kiosk (`STANDBY (WAIT CONTRACT)`).
 * 2. `CONTRACT_ACTIVE`: Player selected a Kiosk recipe contract -> Harvester runs into Warzone to gather crates until `currentPadCrates >= targetContractCrates`.
 * 3. `CONTRACT_FULFILLED`: Final crate enters the Stacking Pad & stack shatters into the ordered weapon/vehicle -> Harvester automatically shatters/despawns with particle burst!
 */
export function evaluateContractHarvesterLifecycle(params: {
  hasActiveBuildContract: boolean;
  currentPadCrates: number;
  targetContractCrates: number;
  activeRecipeName?: string;
}): ContractHarvesterLifecycleState {
  const safeTarget = Math.max(1, params.targetContractCrates);
  const recipeTitle = params.activeRecipeName || 'KIOSK RECIPE';

  if (!params.hasActiveBuildContract) {
    return {
      stage: 'STANDBY',
      shouldLeaveBaseForWarzone: false,
      shouldDespawnWithParticles: false,
      canShootOrFight: false,
      statusLabel: 'STANDBY (WAIT CONTRACT)',
      subLabel: 'IDLE AT BASE · WAITING FOR KIOSK CONTRACT',
    };
  }

  if (params.currentPadCrates >= safeTarget) {
    return {
      stage: 'CONTRACT_FULFILLED',
      shouldLeaveBaseForWarzone: false,
      shouldDespawnWithParticles: true,
      canShootOrFight: false,
      statusLabel: 'CONTRACT FULFILLED!',
      subLabel: `${recipeTitle} COMPLETE · HARVESTER DESPAWN`,
    };
  }

  return {
    stage: 'CONTRACT_ACTIVE',
    shouldLeaveBaseForWarzone: true,
    shouldDespawnWithParticles: false,
    canShootOrFight: false,
    statusLabel: `CONTRACT ACTIVE (${params.currentPadCrates}/${safeTarget})`,
    subLabel: `HAULING CRATES: ${recipeTitle.toUpperCase()}`,
  };
}

export function computeHarvesterBaseStandbyPosition(
  padWorldX: number,
  padWorldZ: number,
  team: 'blue' | 'red',
  harvesterSlotIndex: number,
): { x: number; z: number } {
  const lateralSign = harvesterSlotIndex % 2 === 0 ? -1 : 1;
  const depthSign = team === 'blue' ? -1 : 1;
  return {
    x: padWorldX + lateralSign * 2.15,
    z: padWorldZ + depthSign * 2.65,
  };
}

export const LOBBY_GOLD_EXCHANGE_SPEC = {
  x: -81.8,
  z: -8.8,
  interactRadius: 3.5,
  label: 'CENTRAL PLAZA GOLD EXCHANGE',
  subtitle: '[E / B] EXCHANGE WARZONE GOLD FOR VIP SKINS & GEAR',
} as const;

export type LobbyGoldExchangeItemId =
  | 'vip_cyber_neon_skin'
  | 'vip_royal_gold_skin'
  | 'vip_sakura_zen_garden'
  | 'vip_nano_armor_200hp'
  | 'vip_golden_plasma_rifle'
  | 'vip_tactical_ordnance_pack';

export interface LobbyGoldExchangeCatalogItem {
  id: LobbyGoldExchangeItemId;
  name: string;
  category: 'cosmetic_skin' | 'vip_equipment';
  costGold: number;
  badge: string;
  description: string;
  skinThemeId?: BaseSkinThemeId;
  gardenPresetId?: BaseGardenPresetId;
  bonusMaxHp?: number;
  grantWeaponName?: string;
  grantAmmo?: number;
}

export const LOBBY_GOLD_EXCHANGE_CATALOG: readonly LobbyGoldExchangeCatalogItem[] = [
  {
    id: 'vip_cyber_neon_skin',
    name: 'Cyber Neon Ops Skin',
    category: 'cosmetic_skin',
    costGold: 450,
    badge: 'HOUSE & OUTFIT SKIN',
    description: 'Transform your Base House & Character Outfit into electric-blue Cyber Neon Ops.',
    skinThemeId: 'cyber_neon',
  },
  {
    id: 'vip_royal_gold_skin',
    name: 'Royal Gold Hangout Skin',
    category: 'cosmetic_skin',
    costGold: 750,
    badge: 'LIMITED GOLD SKIN',
    description: 'Exclusive Royal Gold skin for your Base House & Character in the Warzone minigame.',
    skinThemeId: 'royal_gold',
    gardenPresetId: 'golden_park',
  },
  {
    id: 'vip_sakura_zen_garden',
    name: 'Zen Rock & Golden Sakura Pack',
    category: 'cosmetic_skin',
    costGold: 350,
    badge: 'GARDEN DECORATION',
    description: 'Cosmetic Zen rock garden & glowing Sakura tree pack for your Base plot.',
    gardenPresetId: 'zen_rock',
  },
  {
    id: 'vip_nano_armor_200hp',
    name: 'VIP Nano-Armor Vest (200 Max HP)',
    category: 'vip_equipment',
    costGold: 500,
    badge: '+50 MAX HP BOOST',
    description: 'Boost your character Max HP from 150 HP to a full 200 HP for the Warzone session.',
    bonusMaxHp: 200,
  },
  {
    id: 'vip_golden_plasma_rifle',
    name: 'VIP Golden Laser & Plasma Kit',
    category: 'vip_equipment',
    costGold: 600,
    badge: 'VIP WEAPON',
    description: 'Equip your character with the combat-ready Continuous Raycast Laser LG-88 (180 Ammo).',
    grantWeaponName: 'Laser Gun (LG-88)',
    grantAmmo: 180,
  },
  {
    id: 'vip_tactical_ordnance_pack',
    name: 'VIP Heavy Bazooka & Grenade Pack',
    category: 'vip_equipment',
    costGold: 550,
    badge: 'VIP ORDNANCE',
    description: 'Equip your character with the VX-20 Heavy Bazooka + 4 Frag Grenades & 4 Land Mines.',
    grantWeaponName: 'BlitzRocketLauncher',
    grantAmmo: 36,
  },
] as const;

export function redeemLobbyGoldExchangeItem(
  currentGold: number,
  ownedItems: ReadonlyArray<LobbyGoldExchangeItemId>,
  itemId: LobbyGoldExchangeItemId,
): {
  success: boolean;
  remainingGold: number;
  updatedOwnedItems: LobbyGoldExchangeItemId[];
  item: LobbyGoldExchangeCatalogItem | null;
  message: string;
} {
  const item = LOBBY_GOLD_EXCHANGE_CATALOG.find((it) => it.id === itemId) ?? null;
  if (!item) {
    return {
      success: false,
      remainingGold: currentGold,
      updatedOwnedItems: [...ownedItems],
      item: null,
      message: 'Lobby Gold Exchange item not found!',
    };
  }

  if (item.category === 'cosmetic_skin' && ownedItems.includes(itemId)) {
    return {
      success: true,
      remainingGold: currentGold,
      updatedOwnedItems: [...ownedItems],
      item,
      message: `Skin ${item.name} is already owned & has been equipped!`,
    };
  }

  if (currentGold < item.costGold) {
    return {
      success: false,
      remainingGold: currentGold,
      updatedOwnedItems: [...ownedItems],
      item,
      message: `Not enough Gold! Requires ${item.costGold}G (Your Gold: ${currentGold}G). Earn more Gold in the Warzone first!`,
    };
  }

  const nextOwned = ownedItems.includes(itemId) ? [...ownedItems] : [...ownedItems, itemId];
  const remainingGold = currentGold - item.costGold;

  return {
    success: true,
    remainingGold,
    updatedOwnedItems: nextOwned,
    item,
    message: `SUCCESSFULLY REDEEMED: ${item.name} (-${item.costGold}G)!`,
  };
}

export interface OpenWarzonePopulationSnapshot {
  blueOnline: number;
  redOnline: number;
  maxPerTeam: number;
  blueBaseOwners: number;
  blueWarzoneRoamers: number;
  redBaseOwners: number;
  redWarzoneRoamers: number;
  blueLabel: string;
  redLabel: string;
}

/**
 * Computes the Always-On 10v10 Open Warzone population bar (`BLUE X/10 ONLINE VS RED Y/10 ONLINE`):
 * - Server cap: 10 players per team (4 Base Owners + 6 Warzone Roamers).
 * - Strictly reflects real connected players (0..10 per team) with no fake bot padding.
 */
export function evaluateOpenWarzonePopulationBar(params: {
  blueClaimedBasesCount: number;
  redClaimedBasesCount: number;
  blueExtraRoamers?: number;
  redExtraRoamers?: number;
  playerTeam: 'blue' | 'red';
  isPlayerInLobby: boolean;
  localPlayerHasClaimedBase?: boolean;
}): OpenWarzonePopulationSnapshot {
  const maxPerTeam = OPEN_WARZONE_TEAM_CAPACITY.maxTotalPerTeam;
  const blueBaseOwners = clamp(
    Math.floor(params.blueClaimedBasesCount),
    0,
    OPEN_WARZONE_TEAM_CAPACITY.maxBaseOwnersPerTeam,
  );
  const redBaseOwners = clamp(
    Math.floor(params.redClaimedBasesCount),
    0,
    OPEN_WARZONE_TEAM_CAPACITY.maxBaseOwnersPerTeam,
  );
  const baseBlueRoamers = Math.max(0, Math.floor(params.blueExtraRoamers ?? 0));
  const baseRedRoamers = Math.max(0, Math.floor(params.redExtraRoamers ?? 0));
  const playerBlueBonus =
    !params.isPlayerInLobby && params.playerTeam === 'blue' && !params.localPlayerHasClaimedBase
      ? 1
      : 0;
  const playerRedBonus =
    !params.isPlayerInLobby && params.playerTeam === 'red' && !params.localPlayerHasClaimedBase
      ? 1
      : 0;

  const blueWarzoneRoamers = clamp(
    baseBlueRoamers + playerBlueBonus,
    0,
    OPEN_WARZONE_TEAM_CAPACITY.maxWarzoneRoamersPerTeam,
  );
  const redWarzoneRoamers = clamp(
    baseRedRoamers + playerRedBonus,
    0,
    OPEN_WARZONE_TEAM_CAPACITY.maxWarzoneRoamersPerTeam,
  );

  const blueOnline = clamp(blueBaseOwners + blueWarzoneRoamers, 0, maxPerTeam);
  const redOnline = clamp(redBaseOwners + redWarzoneRoamers, 0, maxPerTeam);

  return {
    blueOnline,
    redOnline,
    maxPerTeam,
    blueBaseOwners,
    blueWarzoneRoamers,
    redBaseOwners,
    redWarzoneRoamers,
    blueLabel: `BLUE ${blueOnline}/${maxPerTeam} ONLINE`,
    redLabel: `RED ${redOnline}/${maxPerTeam} ONLINE`,
  };
}

// ============================================================================
// TRUE MIRROR CAMERA POV (180° FLIP FOR RED TEAM) & CAMERA-RELATIVE WASD INPUT
// - Blue Team (`playerTeam === 'blue'`): Camera sits on South (`+Z`) side looking North (`-Z`) toward Warzone.
// - Red Team (`playerTeam === 'red'`): Camera flips 180° around X and Z (`-Z` side looking South `+Z` toward Warzone),
//   so Red Team's own Base sector is ALWAYS at the bottom of the screen and advancing into Warzone is ALWAYS up the screen!
// ============================================================================

export interface TeamMirrorCameraPose {
  mirrorSign: 1 | -1;
  cameraPos: Vec3;
  lookAtPos: Vec3;
  forwardDirX: number;
  forwardDirZ: number;
  rightDirX: number;
  rightDirZ: number;
}

export function computeTeamMirrorCameraPose(params: {
  playerTeam: 'blue' | 'red';
  focusX: number;
  focusY: number;
  focusZ: number;
  baseOffset: Vec3;
  fovScale?: number;
  visualPlaneAlt?: number;
  isEditorOrTitle?: boolean;
  flipView?: boolean;
}): TeamMirrorCameraPose {
  const fovScale = params.fovScale ?? 1.0;
  const visualPlaneAlt = params.visualPlaneAlt ?? 0.0;
  const baseMirrorSign: 1 | -1 =
    !params.isEditorOrTitle && params.playerTeam === 'red' ? -1 : 1;
  // Player-controlled 180-degree view flip (main map only - callers gate
  // Warzone and the editor out): inverts the side the camera sits on.
  const mirrorSign = (params.flipView ? -baseMirrorSign : baseMirrorSign) as 1 | -1;

  const cameraPos: Vec3 = {
    x: params.focusX + params.baseOffset.x * fovScale * mirrorSign,
    y: params.focusY + params.baseOffset.y * fovScale,
    z: params.focusZ + params.baseOffset.z * fovScale * mirrorSign,
  };

  const lookAheadZ = (2.5 + visualPlaneAlt * 0.24) * mirrorSign;
  const lookAtPos: Vec3 = {
    x: params.focusX,
    y: params.focusY - 1.15 - visualPlaneAlt * 0.28,
    z: params.focusZ - lookAheadZ,
  };

  // Horizontal forward vector from cameraPos to lookAtPos projected onto XZ plane
  const rawFwdX = lookAtPos.x - cameraPos.x;
  const rawFwdZ = lookAtPos.z - cameraPos.z;
  const fwdLen = Math.hypot(rawFwdX, rawFwdZ);
  const forwardDirX = fwdLen > 1e-5 ? rawFwdX / fwdLen : 0;
  const forwardDirZ = fwdLen > 1e-5 ? rawFwdZ / fwdLen : -mirrorSign;

  // Right vector in standard 3D right-handed XZ plane (forward x up(0,1,0) = (-forwardZ, 0, forwardX))
  const rightDirX = -forwardDirZ;
  const rightDirZ = forwardDirX;

  return {
    mirrorSign,
    cameraPos,
    lookAtPos,
    forwardDirX,
    forwardDirZ,
    rightDirX,
    rightDirZ,
  };
}

/**
 * Converts screen-relative WASD / Arrow Key input (`inputForward`: W=+1, S=-1; `inputRight`: D=+1, A=-1)
 * into world-space `(moveX, moveZ)` aligned with the active camera POV:
 * - For Blue Team (`mirrorSign = +1`, looking North `-Z`): W -> `(0, -1)`, S -> `(0, +1)`, A -> `(-1, 0)`, D -> `(+1, 0)`
 * - For Red Team (`mirrorSign = -1`, looking South `+Z`): W -> `(0, +1)`, S -> `(0, -1)`, A -> `(+1, 0)`, D -> `(-1, 0)`
 */
export function computeCameraRelativeMovementVector(params: {
  inputForward: number;
  inputRight: number;
  playerTeam: 'blue' | 'red';
  flipView?: boolean;
  cameraPosX?: number;
  cameraPosZ?: number;
  lookAtPosX?: number;
  lookAtPosZ?: number;
  isEditorMode?: boolean;
}): { moveX: number; moveZ: number; mirrorSign: 1 | -1 } {
  if (params.isEditorMode) {
    if (params.flipView) {
      return {
        moveX: -params.inputRight,
        moveZ: params.inputForward,
        mirrorSign: -1,
      };
    }
    return {
      moveX: params.inputRight,
      moveZ: -params.inputForward,
      mirrorSign: 1,
    };
  }

  const mirrorSign = ((params.playerTeam === 'red' ? -1 : 1) * (params.flipView ? -1 : 1)) as 1 | -1;
  let fwdX = 0;
  let fwdZ = -mirrorSign;

  if (
    params.cameraPosX !== undefined &&
    params.cameraPosZ !== undefined &&
    params.lookAtPosX !== undefined &&
    params.lookAtPosZ !== undefined
  ) {
    const dx = params.lookAtPosX - params.cameraPosX;
    const dz = params.lookAtPosZ - params.cameraPosZ;
    const len = Math.hypot(dx, dz);
    if (len > 1e-5) {
      fwdX = dx / len;
      fwdZ = dz / len;
    }
  }

  const rightX = -fwdZ;
  const rightZ = fwdX;

  const moveX = params.inputForward * fwdX + params.inputRight * rightX;
  const moveZ = params.inputForward * fwdZ + params.inputRight * rightZ;

  return { moveX, moveZ, mirrorSign };
}

export interface PlayerGhostMovementGuardResult {
  shouldClearKeys: boolean;
  inputForward: number;
  inputRight: number;
  hasActiveMovementInput: boolean;
  vx: number;
  vz: number;
  aiTargetPos: null;
}

/**
 * Ghost Movement Fix for the Player Character (`isPlayerControlled`):
 * 1. Immediately clears all movement keys (`shouldClearKeys = true`) and zeroes velocity (`vx = 0, vz = 0`)
 *    whenever transitioning scenes (`LOBBY` <-> `SAFEZONE` <-> `WARZONE`), clicking a floating button/modal,
 *    focusing the `TALK` chat input, or losing window focus.
 * 2. Guarantees that when no `WASD` / Arrow movement keys are pressed (`hasActiveMovementInput === false`),
 *    `vx = 0`, `vz = 0`, and `aiTargetPos = null` (the player character is never driven by AI pathfinding).
 */
export function evaluatePlayerGhostMovementGuard(params: {
  keysPressed: Record<string, boolean>;
  isSceneTransitioning?: boolean;
  isFloatingButtonOrModalOpen?: boolean;
  isTalkInputFocused?: boolean;
  isWindowBlurred?: boolean;
  moveSpeed: number;
  playerTeam: 'blue' | 'red';
  isEditorOrPeacefulCamera?: boolean;
  flipView?: boolean;
}): PlayerGhostMovementGuardResult {
  const shouldClearKeys = Boolean(
    params.isSceneTransitioning ||
      params.isFloatingButtonOrModalOpen ||
      params.isTalkInputFocused ||
      params.isWindowBlurred,
  );

  if (shouldClearKeys) {
    for (const k of Object.keys(params.keysPressed)) {
      params.keysPressed[k] = false;
    }
    return {
      shouldClearKeys: true,
      inputForward: 0,
      inputRight: 0,
      hasActiveMovementInput: false,
      vx: 0,
      vz: 0,
      aiTargetPos: null,
    };
  }

  let inputForward = 0;
  let inputRight = 0;
  if (params.keysPressed['KeyW'] || params.keysPressed['ArrowUp']) inputForward += 1;
  if (params.keysPressed['KeyS'] || params.keysPressed['ArrowDown']) inputForward -= 1;
  if (params.keysPressed['KeyA'] || params.keysPressed['ArrowLeft']) inputRight -= 1;
  if (params.keysPressed['KeyD'] || params.keysPressed['ArrowRight']) inputRight += 1;

  const camMove = computeCameraRelativeMovementVector({
    inputForward,
    inputRight,
    playerTeam: params.playerTeam,
    isEditorMode: params.isEditorOrPeacefulCamera,
    flipView: params.flipView,
  });

  const inputLen = Math.hypot(camMove.moveX, camMove.moveZ);
  if (inputLen <= 0.01) {
    return {
      shouldClearKeys: false,
      inputForward: 0,
      inputRight: 0,
      hasActiveMovementInput: false,
      vx: 0,
      vz: 0,
      aiTargetPos: null,
    };
  }

  return {
    shouldClearKeys: false,
    inputForward,
    inputRight,
    hasActiveMovementInput: true,
    vx: (camMove.moveX / inputLen) * params.moveSpeed,
    vz: (camMove.moveZ / inputLen) * params.moveSpeed,
    aiTargetPos: null,
  };
}

// ============================================================================
// NEAR EXPLORER URL RE-EXPORTS
// ============================================================================

export {
  getNearBlocksAccountUrl,
  getNearBlocksTxUrl,
} from '../lib/nearClient';

export type {
  NearNetworkId,
  NearOnboardingMode,
  Nep171GamepassSubAccountLedger,
  Nep171OwnershipHistoryEntry,
} from '../lib/nearClient';

// ============================================================================
// SINGLE SOURCE OF TRUTH FOR BASE PLOT KIOSK & HOUSE DOOR PROXIMITY TRIGGERS
// ============================================================================

export const BASE_PLOT_KIOSK_MAX_INTERACT_RADIUS = 3.5;
export const HOUSE_DOOR_MAX_INTERACT_RADIUS = 3.5;

export interface BasePlotProximityEvaluation {
  canTriggerBaseKiosk: boolean;
  nearestKioskTeam: 'blue' | 'red' | null;
  nearestKioskPlotIndex: number | null;
  nearestKioskDistance: number;
  canTriggerEnterHouseDoor: boolean;
  nearestHouseDoorTeam: 'blue' | 'red' | null;
  nearestHouseDoorPlotIndex: number | null;
  nearestHouseDoorWorldPos: { x: number; z: number } | null;
  nearestHouseDoorDistance: number;
}

/**
 * Evaluates Base Plot Tactical Kiosk and Safezone House Entrance Door proximity triggers
 * strictly from live, visible 3D objects:
 * 1. Inside Central Plaza (`worldMode === 'lobby'` or `isPointInsideLobbySafezone(actorX, actorZ)`),
 *    BOTH `canTriggerBaseKiosk` and `canTriggerEnterHouseDoor` are strictly `false`.
 * 2. Base Plot Tactical Kiosks only trigger when `worldMode !== 'lobby'` and the player is within
 *    `<= 3.5m` of a visible plot kiosk mesh.
 * 3. `Enter House` (`canTriggerEnterHouseDoor`) ONLY triggers in Safezone mode (`worldMode === 'safezone'`)
 *    within `<= 3.5m` of the front door `(pwx, baseHqZ + sign * 1.85)` of a plot where a 3D House is
 *    actually built and visible (`isCommanderBasePlotActive(plot) && isHouseVisible !== false`) —
 *    NEVER on any of the 7 unclaimed empty grass plots.
 */
export function evaluateBasePlotProximityTriggers(params: {
  actorX: number;
  actorZ: number;
  worldMode: 'lobby' | 'safezone' | 'warzone';
  blueCommanderBases: ReadonlyArray<IndividualCommanderBaseState>;
  redCommanderBases: ReadonlyArray<IndividualCommanderBaseState>;
  blueHqX?: number;
  blueHqZ?: number;
  redHqX?: number;
  redHqZ?: number;
  kioskVisibilityByPlot?: {
    blue?: ReadonlyArray<boolean>;
    red?: ReadonlyArray<boolean>;
  };
  houseVisibilityByPlot?: {
    blue?: ReadonlyArray<boolean>;
    red?: ReadonlyArray<boolean>;
  };
  maxKioskRadius?: number;
  maxHouseDoorRadius?: number;
}): BasePlotProximityEvaluation {
  const maxKioskR = params.maxKioskRadius ?? BASE_PLOT_KIOSK_MAX_INTERACT_RADIUS;
  const maxDoorR = params.maxHouseDoorRadius ?? HOUSE_DOOR_MAX_INTERACT_RADIUS;

  if (isPointInsideLobbySafezone(params.actorX, params.actorZ)) {
    return {
      canTriggerBaseKiosk: false,
      nearestKioskTeam: null,
      nearestKioskPlotIndex: null,
      nearestKioskDistance: 9999,
      canTriggerEnterHouseDoor: false,
      nearestHouseDoorTeam: null,
      nearestHouseDoorPlotIndex: null,
      nearestHouseDoorWorldPos: null,
      nearestHouseDoorDistance: 9999,
    };
  }

  const isPeacefulCityMode = params.worldMode === 'safezone' || params.worldMode === 'lobby';
  const plotOffsetsX = [-45.0, -15.0, 15.0, 45.0] as const;
  const blueHqX = params.blueHqX ?? 0.0;
  const blueHqZ = params.blueHqZ ?? 74.0;
  const redHqX = params.redHqX ?? 0.0;
  const redHqZ = params.redHqZ ?? -86.0;

  let bestKioskDist = 9999;
  let bestKioskTeam: 'blue' | 'red' | null = null;
  let bestKioskIdx: number | null = null;

  let bestDoorDist = 9999;
  let bestDoorTeam: 'blue' | 'red' | null = null;
  let bestDoorIdx: number | null = null;
  let bestDoorPos: { x: number; z: number } | null = null;

  const checkTeamPlots = (
    team: 'blue' | 'red',
    hqX: number,
    hqZ: number,
    plots: ReadonlyArray<IndividualCommanderBaseState>,
    kioskVisList?: ReadonlyArray<boolean>,
    houseVisList?: ReadonlyArray<boolean>,
  ) => {
    const sign = team === 'blue' ? 1 : -1;
    for (let i = 0; i < 4 && i < plots.length; i++) {
      const plot = plots[i];
      const pwx = hqX + sign * plotOffsetsX[i];

      // 1. Standalone Base Plot Tactical Kiosk at (pwx + sign * 8.52, hqZ - sign * 14.68)
      const isKioskVisible = kioskVisList ? Boolean(kioskVisList[i]) : true;
      if (isKioskVisible) {
        const kx = pwx + sign * 8.52;
        const kz = hqZ - sign * 14.68;
        const kd = Math.hypot(params.actorX - kx, params.actorZ - kz);
        if (kd < bestKioskDist) {
          bestKioskDist = kd;
          bestKioskTeam = team;
          bestKioskIdx = i;
        }
      }

      // 2. House Interior Entrance Door — ONLY if 3D House is active & visible in The City
      const isPlotActive = isCommanderBasePlotActive(plot) && !plot.destroyed && plot.buildingHp > 0;
      const isHouseVisible = houseVisList ? Boolean(houseVisList[i]) : isPlotActive;
      if (isPeacefulCityMode && isPlotActive && isHouseVisible) {
        const doorCandidates: ReadonlyArray<{ x: number; z: number }> = [
          { x: pwx, z: hqZ + sign * 1.85 },
          { x: pwx - sign * 1.15, z: hqZ - sign * 0.55 },
          { x: pwx + sign * 2.38, z: hqZ + sign * 9.35 },
        ];
        for (const cand of doorCandidates) {
          const dd = Math.hypot(params.actorX - cand.x, params.actorZ - cand.z);
          if (dd < bestDoorDist) {
            bestDoorDist = dd;
            bestDoorTeam = team;
            bestDoorIdx = i;
            bestDoorPos = { x: cand.x, z: cand.z };
          }
        }
      }
    }
  };

  checkTeamPlots(
    'blue',
    blueHqX,
    blueHqZ,
    params.blueCommanderBases,
    params.kioskVisibilityByPlot?.blue,
    params.houseVisibilityByPlot?.blue,
  );
  checkTeamPlots(
    'red',
    redHqX,
    redHqZ,
    params.redCommanderBases,
    params.kioskVisibilityByPlot?.red,
    params.houseVisibilityByPlot?.red,
  );

  const canKiosk = bestKioskDist <= maxKioskR;
  const canDoor = isPeacefulCityMode && bestDoorDist <= maxDoorR;

  return {
    canTriggerBaseKiosk: canKiosk,
    nearestKioskTeam: canKiosk ? bestKioskTeam : null,
    nearestKioskPlotIndex: canKiosk ? bestKioskIdx : null,
    nearestKioskDistance: bestKioskDist,
    canTriggerEnterHouseDoor: canDoor,
    nearestHouseDoorTeam: canDoor ? bestDoorTeam : null,
    nearestHouseDoorPlotIndex: canDoor ? bestDoorIdx : null,
    nearestHouseDoorWorldPos: canDoor ? bestDoorPos : null,
    nearestHouseDoorDistance: bestDoorDist,
  };
}

// ============================================================================
// CITY TRANSIT NETWORK & BLACK CURVED MONOLITH KIOSK PLACEMENT RULES
// ============================================================================

export type CityTransitStationId =
  | 'central_plaza'
  | 'beachfront_harbor'
  | 'nw_fishing_lake'
  | 'north_residence'
  | 'south_residence'
  | 'warzone_arena';

export interface CityTransitDestinationSpec {
  id: CityTransitStationId;
  name: string;
  title: string;
  shortTitle: string;
  shortTag: string;
  tag: string;
  category: 'district' | 'warzone';
  targetWorldMode: WorldMode;
  description: string;
  heroImageUrl: string;
  thumbnailUrl: string;
  /** World coordinates of the Black Curved-Monolith Transit Kiosk */
  kioskX: number;
  kioskY: number;
  kioskZ: number;
  kioskRotY: number;
  /** Safe player arrival coordinates & facing yaw when arriving via Tram Ride */
  spawnX: number;
  spawnZ: number;
  spawnYaw: number;
  /**
   * True STRICTLY for stops along the active City Tram rail track (`central_plaza`, `north_residence`, `south_residence`).
   * False for rail-less endpoints (`beachfront_harbor`, `nw_fishing_lake`, `warzone_arena`), which have ONLY the standalone black Transit Kiosk and NO Halte shelter roof.
   */
  hasHalteShelter: boolean;
  /** Shelter world center & rotation when `hasHalteShelter === true` */
  shelterX?: number;
  shelterZ?: number;
  shelterRotY?: number;
  /** Reference distance along the closed-loop City Tram track for the 3D Tram Ride cutscene */
  tramTrackDistance: number;
}

export const CITY_TRANSIT_KIOSK_MAX_INTERACT_RADIUS = 3.5;

export const CITY_TRANSIT_DESTINATIONS: readonly CityTransitDestinationSpec[] = [
  {
    id: 'central_plaza',
    name: 'Central Plaza',
    title: 'CENTRAL PLAZA',
    shortTitle: 'Central Plaza',
    shortTag: 'PLAZA HUB',
    tag: 'PLAZA HUB',
    category: 'district',
    targetWorldMode: 'lobby',
    description:
      'Main elevated civic promenade featuring Hana Cafe, token exchange, and the central Halte tram station.',
    heroImageUrl: '/docs/hero-2-tram-station.jpg',
    thumbnailUrl: '/docs/hero-2-tram-station.jpg',
    kioskX: -61.95,
    kioskY: 0.26,
    kioskZ: 0.0,
    kioskRotY: -Math.PI / 2,
    spawnX: -63.4,
    spawnZ: 0.0,
    spawnYaw: Math.PI,
    hasHalteShelter: true,
    shelterX: -63.8,
    shelterZ: 0.0,
    shelterRotY: -Math.PI / 2,
    tramTrackDistance: 44.0,
  },
  {
    id: 'beachfront_harbor',
    name: 'Beachfront Harbor',
    title: 'BEACHFRONT HARBOR',
    shortTitle: 'Beachfront Harbor',
    shortTag: 'COASTAL PIER',
    tag: 'COASTAL PIER',
    category: 'district',
    targetWorldMode: 'safezone',
    description:
      'Sunlit coastal timber boardwalk, Kai Fish Market, surfboard rentals, and deep-sea fishing pier.',
    heroImageUrl: '/docs/hero-1-beach-pier.jpg',
    thumbnailUrl: '/docs/hero-1-beach-pier.jpg',
    kioskX: 79.35,
    kioskY: 0.26,
    kioskZ: 29.5,
    kioskRotY: -Math.PI / 2,
    spawnX: 77.9,
    spawnZ: 29.5,
    spawnYaw: Math.PI,
    hasHalteShelter: true,
    shelterX: 77.5,
    shelterZ: 29.5,
    shelterRotY: -Math.PI / 2,
    tramTrackDistance: 270.0,
  },
  {
    id: 'nw_fishing_lake',
    name: 'NW Fishing Lake',
    title: 'NW FISHING LAKE',
    shortTitle: 'NW Fishing Lake',
    shortTag: 'OASIS SHORE',
    tag: 'OASIS SHORE',
    category: 'district',
    targetWorldMode: 'safezone',
    description:
      'Tranquil turquoise oasis basin stocked with freshwater catch. Cast your fishing rod from the grassy shoreline.',
    heroImageUrl: '/docs/hero-6-oasis-lake.jpg',
    thumbnailUrl: '/docs/hero-6-oasis-lake.jpg',
    kioskX: -44.5,
    kioskY: 0.0,
    kioskZ: -6.5,
    kioskRotY: Math.PI / 2,
    spawnX: -42.2,
    spawnZ: -6.5,
    spawnYaw: 0,
    hasHalteShelter: false,
    tramTrackDistance: 72.0,
  },
  {
    id: 'north_residence',
    name: 'North Residence',
    title: 'NORTH RESIDENCE',
    shortTitle: 'North Residence',
    shortTag: 'NORTH PLOTS',
    tag: 'NORTH PLOTS',
    category: 'district',
    targetWorldMode: 'safezone',
    description:
      'Northern residential boulevard along the tram rail loop with 4 claimable House Plots and gated citizen estates.',
    heroImageUrl: '/docs/hero-3-house-interior.jpg',
    thumbnailUrl: '/docs/hero-3-house-interior.jpg',
    kioskX: 6.5,
    kioskY: 0.26,
    kioskZ: -44.95,
    kioskRotY: Math.PI,
    spawnX: 6.5,
    spawnZ: -46.4,
    spawnYaw: -Math.PI / 2,
    hasHalteShelter: true,
    shelterX: 6.5,
    shelterZ: -46.8,
    shelterRotY: Math.PI,
    tramTrackDistance: 165.0,
  },
  {
    id: 'south_residence',
    name: 'South Residence',
    title: 'SOUTH RESIDENCE',
    shortTitle: 'South Residence',
    shortTag: 'SOUTH PLOTS',
    tag: 'SOUTH PLOTS',
    category: 'district',
    targetWorldMode: 'safezone',
    description:
      'Southern residential avenue featuring the Model Estate showcase and 4 customizable citizen House Plots.',
    heroImageUrl: '/docs/hero-7-crate-stacking-pad.jpg',
    thumbnailUrl: '/docs/hero-7-crate-stacking-pad.jpg',
    kioskX: -36.5,
    kioskY: 0.26,
    kioskZ: 44.95,
    kioskRotY: 0,
    spawnX: -36.5,
    spawnZ: 46.4,
    spawnYaw: Math.PI / 2,
    hasHalteShelter: true,
    shelterX: -36.5,
    shelterZ: 46.8,
    shelterRotY: 0,
    tramTrackDistance: 375.0,
  },
  {
    id: 'warzone_arena',
    name: 'Warzone Arena',
    title: 'WARZONE ARENA',
    shortTitle: 'Warzone Arena',
    shortTag: 'RED VS BLUE',
    tag: 'RED VS BLUE',
    category: 'warzone',
    targetWorldMode: 'warzone',
    description:
      'Optional Red vs Blue tactical combat mini-game with crate stacking pads, vehicles, and live multiplayer squads.',
    heroImageUrl: '/docs/hero-8-weapon-armory.jpg',
    thumbnailUrl: '/docs/hero-8-weapon-armory.jpg',
    kioskX: -60.55,
    kioskY: 0.26,
    kioskZ: 2.8,
    kioskRotY: -Math.PI / 2,
    spawnX: -54.0,
    spawnZ: 38.0,
    spawnYaw: Math.PI / 2,
    hasHalteShelter: false,
    tramTrackDistance: 215.0,
  },
] as const;

export function getCityTransitDestinationById(
  id: CityTransitStationId | string | null | undefined,
): CityTransitDestinationSpec {
  const found = CITY_TRANSIT_DESTINATIONS.find((d) => d.id === id);
  return found ?? CITY_TRANSIT_DESTINATIONS[0];
}

export interface CityTransitKioskProximityResult {
  isNear: boolean;
  isNearTransitKiosk: boolean;
  id: CityTransitStationId;
  stationId: CityTransitStationId | null;
  station: CityTransitDestinationSpec | null;
  distance: number;
  kioskX: number;
  kioskY: number;
  kioskZ: number;
}

export function evaluateNearestCityTransitKioskProximity(
  actorXOrParams:
    | number
    | {
        actorX: number;
        actorZ: number;
        worldMode: 'lobby' | 'warzone' | 'safezone';
        maxRadius?: number;
      },
  actorZArg?: number,
  worldModeArg?: 'lobby' | 'warzone' | 'safezone',
  maxRadiusArg?: number,
): CityTransitKioskProximityResult {
  const actorX = typeof actorXOrParams === 'number' ? actorXOrParams : actorXOrParams.actorX;
  const actorZ = typeof actorXOrParams === 'number' ? (actorZArg ?? 0) : actorXOrParams.actorZ;
  const worldMode =
    typeof actorXOrParams === 'number'
      ? (worldModeArg ?? 'safezone')
      : actorXOrParams.worldMode;
  const maxR =
    (typeof actorXOrParams === 'number' ? maxRadiusArg : actorXOrParams.maxRadius) ??
    CITY_TRANSIT_KIOSK_MAX_INTERACT_RADIUS;

  const candidates =
    worldMode === 'warzone'
      ? CITY_TRANSIT_DESTINATIONS.filter((d) => d.id === 'warzone_arena')
      : CITY_TRANSIT_DESTINATIONS.filter((d) => d.category === 'district');

  let bestStation: CityTransitDestinationSpec | null = null;
  let bestDist = 9999;

  for (let i = 0; i < candidates.length; i++) {
    const st = candidates[i];
    const d = Math.hypot(actorX - st.kioskX, actorZ - st.kioskZ);
    if (d < bestDist) {
      bestDist = d;
      bestStation = st;
    }
  }

  const isNear = Boolean(bestStation && bestDist <= maxR);
  return {
    isNear,
    isNearTransitKiosk: isNear,
    id: bestStation ? bestStation.id : 'central_plaza',
    stationId: isNear && bestStation ? bestStation.id : null,
    station: isNear ? bestStation : null,
    distance: bestDist,
    kioskX: bestStation ? bestStation.kioskX : 0,
    kioskY: bestStation ? bestStation.kioskY : 0,
    kioskZ: bestStation ? bestStation.kioskZ : 0,
  };
}

export function easeInOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

export interface TramRideTransitionFrame {
  progress01: number;
  eased01: number;
  easedProgress: number;
  progressPercent: number;
  isComplete: boolean;
  leadDistance: number;
  tramState: CityTramConsistState;
  cameraPos: Vec3;
  cameraLookAt: Vec3;
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  lookAtX: number;
  lookAtY: number;
  lookAtZ: number;
}

/**
 * Evaluates a single frame of the ~2.5s 3D "Tram Ride" transition cutscene:
 * - Smoothly glides the 2-Car City Tram along the rail loop using `easeInOutCubic`
 * - Computes a dynamic tracking camera angle alongside and slightly ahead of Car 1
 */
export function evaluateTramRideTransitionStep(params: {
  elapsedSec: number;
  durationSec?: number;
  startLeadDistance?: number;
  travelSpanMeters?: number;
  originStationId?: CityTransitStationId;
  destinationStationId?: CityTransitStationId;
  destinationId?: CityTransitStationId;
  tramLeadX?: number;
  tramLeadZ?: number;
  tramYaw?: number;
  tramLeadYaw?: number;
}): TramRideTransitionFrame {
  const duration = Math.max(0.25, params.durationSec ?? 2.5);
  const span = params.travelSpanMeters ?? 38.0;
  const progress01 = Math.max(0, Math.min(1, params.elapsedSec / duration));
  const easedProgress = easeInOutCubic(progress01);
  const originDist = params.originStationId
    ? getCityTransitDestinationById(params.originStationId).tramTrackDistance
    : 44.0;
  const startLead = params.startLeadDistance ?? originDist;
  const leadDistance = startLead + easedProgress * span;
  const tramState = evaluateCityTramConsistState(leadDistance);
  const car1 = tramState.car1;
  const rightX = -car1.forwardZ;
  const rightZ = car1.forwardX;

  // Smoothly sweep camera from front-quarter boarding angle to tracking angle alongside Car 1
  const forwardOffset = 8.5 - easedProgress * 5.2;
  const lateralOffset = 7.8 + Math.sin(easedProgress * Math.PI) * 1.4;
  const camY = 5.4 + Math.sin(easedProgress * Math.PI) * 0.8;

  const cameraPos: Vec3 = {
    x: car1.x + car1.forwardX * forwardOffset + rightX * lateralOffset,
    y: camY,
    z: car1.z + car1.forwardZ * forwardOffset + rightZ * lateralOffset,
  };

  const cameraLookAt: Vec3 = {
    x: car1.x - car1.forwardX * 1.5,
    y: 2.3,
    z: car1.z - car1.forwardZ * 1.5,
  };

  return {
    progress01,
    eased01: easedProgress,
    easedProgress,
    progressPercent: Math.round(easedProgress * 100),
    isComplete: progress01 >= 1,
    leadDistance,
    tramState,
    cameraPos,
    cameraLookAt,
    cameraX: cameraPos.x,
    cameraY: cameraPos.y,
    cameraZ: cameraPos.z,
    lookAtX: cameraLookAt.x,
    lookAtY: cameraLookAt.y,
    lookAtZ: cameraLookAt.z,
  };
}


