import type { StaticWorldStructureObb } from './buddiesBlitzTypes';

export interface RealEstateKioskVec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Unified 3-Bay Civic Commercial Arcade — Bay 2 (Center) Real Estate & Design Studio
 * (`Kios Agen Properti & Desain Rumah`).
 *
 * Anchored inside `westPlantGroup` (`(-90.5, 0, 0)`) at unified arcade center
 * `world = (-100.10, 2.50, -4.40)`, `rotation.y = +Math.PI / 2`, `scale = 1.0`.
 */
export const REAL_ESTATE_FURNITURE_KIOSK_LAYOUT = {
  westPlantOriginX: -92.75,
  westPlantOriginZ: 0.0,
  kioskLocalX: -13.60,
  kioskLocalY: 2.50,
  kioskLocalZ: -4.40,
  kioskRotY: Math.PI / 2,
  kioskScale: 1.0,
  worldCenterX: -106.35,
  worldBaseY: 2.50,
  worldCenterZ: -4.40,
  // Unified Civic Fan-Pattern Cobblestone Apron dimensions (per bay width 6.75m, front apron +2.45m)
  granitePaverBaseWidthLocal: 6.75,
  granitePaverBaseDepthLocal: 2.45,
  granitePaverBaseHeightLocal: 0.045,
  // Front-Right Glass Entrance Door span in bay-local X
  entranceDoorLocalXMin: 1.65,
  entranceDoorLocalXMax: 2.95,
  entranceDoorFrontLocalZ: 2.50,
  // Wooden A-Frame Sidewalk Sign ("REAL ESTATE & INTERIOR STUDIO") on front cobblestone apron
  aFrameSignLocal: {
    x: 1.60,
    y: 0.045,
    z: 4.05,
    rotY: 0.30,
  },
  // Low floating 3D interaction triangle right beside the wooden A-Frame sign on open plaza pavers
  interactionMarkerLocal: {
    x: 2.20,
    y: 0.0,
    z: 4.90,
  },
  // Merchant Hana initial placement directly on the open West Plaza tiles in front of Center Bay 2
  hanaMerchantWorld: {
    x: -100.90,
    y: 2.50,
    z: -3.15,
    rotY: Math.PI / 2,
  },
} as const;

export const HANA_SHOP_FRONT_PATROL_SPEED_MPS = 1.38;

export interface HanaShopFrontPatrolWaypoint {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly pauseMinSec: number;
  readonly pauseMaxSec: number;
  readonly label: string;
}

/**
 * Curated front-of-shop promenade waypoints across the 3-Bay Commercial Arcade
 * (Fashion Boutique Bay 1 -> Real Estate & Design Studio Bay 2 -> Urban Scooter Showroom Bay 3).
 * Coordinates keep >= 1.2m clearance from the arcade apron, A-frame signs, planters, bench, and scooter displays.
 */
export const HANA_SHOP_FRONT_PATROL_WAYPOINTS: readonly HanaShopFrontPatrolWaypoint[] = [
  {
    x: -100.90,
    z: -3.15,
    yaw: 0,
    pauseMinSec: 4.5,
    pauseMaxSec: 7.5,
    label: 'Real Estate Studio Front',
  },
  {
    x: -99.10,
    z: 1.95,
    yaw: 0.35,
    pauseMinSec: 4.0,
    pauseMaxSec: 7.0,
    label: 'Fashion Boutique Front',
  },
  {
    x: -96.55,
    z: 3.10,
    yaw: -0.45,
    pauseMinSec: 3.8,
    pauseMaxSec: 6.5,
    label: 'West Plaza Promenade',
  },
  {
    x: -96.25,
    z: -3.55,
    yaw: Math.PI * 0.88,
    pauseMinSec: 4.2,
    pauseMaxSec: 7.0,
    label: 'Checking Storefront Bays',
  },
  {
    x: -98.85,
    z: -10.15,
    yaw: 0.14,
    pauseMinSec: 4.2,
    pauseMaxSec: 7.2,
    label: 'Urban Scooter Showroom Front',
  },
  {
    x: -96.85,
    z: -7.10,
    yaw: -0.30,
    pauseMinSec: 3.4,
    pauseMaxSec: 5.8,
    label: 'West Plaza Walkway',
  },
] as const;

/**
 * Converts a kiosk-local `(localX, localY, localZ, localRotY)` pose inside
 * `RealEstateAndFurnitureKiosk` (`rotation.y = +Math.PI / 2`, `scale = 1.48`)
 * into exact world coordinates on the Central Plaza deck.
 */
export function realEstateKioskLocalToWorldPose(
  localX: number,
  localY: number,
  localZ: number,
  localRotY = 0,
): { x: number; y: number; z: number; rotY: number } {
  const s = REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.kioskScale;
  const cosR = Math.cos(REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.kioskRotY);
  const sinR = Math.sin(REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.kioskRotY);
  const sx = localX * s;
  const sy = localY * s;
  const sz = localZ * s;
  const wx = REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.worldCenterX + sx * cosR + sz * sinR;
  const wy = REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.worldBaseY + sy;
  const wz = REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.worldCenterZ - sx * sinR + sz * cosR;
  return {
    x: +wx.toFixed(3),
    y: +wy.toFixed(3),
    z: +wz.toFixed(3),
    rotY: +(REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.kioskRotY + localRotY).toFixed(4),
  };
}

const _realEstateCatalogMarkerWorld = realEstateKioskLocalToWorldPose(
  REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.interactionMarkerLocal.x,
  REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.interactionMarkerLocal.y,
  REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.interactionMarkerLocal.z,
);

/**
 * World-space trigger & low 3D interaction triangle spec (`segitiga interaksi`)
 * anchored beside the Real Estate & Furniture Showroom wooden A-Frame sign.
 */
export const REAL_ESTATE_CATALOG_TRIGGER = {
  x: _realEstateCatalogMarkerWorld.x,
  z: _realEstateCatalogMarkerWorld.z,
  deckY: REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.worldBaseY,
  markerOffsetY: 0.38,
  triggerRadius: 2.20,
} as const;

export function evaluateRealEstateCatalogProximity(
  actorX: number,
  actorZ: number,
  radius: number = REAL_ESTATE_CATALOG_TRIGGER.triggerRadius,
): { isNear: boolean; distanceM: number } {
  const distanceM = Math.hypot(
    actorX - REAL_ESTATE_CATALOG_TRIGGER.x,
    actorZ - REAL_ESTATE_CATALOG_TRIGGER.z,
  );
  return {
    isNear: distanceM <= radius,
    distanceM,
  };
}

/**
 * World-space trigger & low 3D interaction triangle spec (`segitiga interaksi`)
 * anchored directly on the circular floor medallion in front of the Central Plaza
 * Glass Modern Model House double entrance doors (`x = -91.3, z = -24.26`).
 */
export const PLAZA_MODEL_HOUSE_DOOR_TRIGGER = {
  x: -93.55,
  z: -24.26,
  deckY: 2.5,
  markerOffsetY: 0.56,
  triggerRadius: 2.65,
  houseStyle: 'glass_modern' as const,
} as const;

export function evaluatePlazaModelHouseDoorProximity(
  actorX: number,
  actorZ: number,
  radius: number = PLAZA_MODEL_HOUSE_DOOR_TRIGGER.triggerRadius,
): { isNear: boolean; distanceM: number } {
  const distanceM = Math.hypot(
    actorX - PLAZA_MODEL_HOUSE_DOOR_TRIGGER.x,
    actorZ - PLAZA_MODEL_HOUSE_DOOR_TRIGGER.z,
  );
  return {
    isNear: distanceM <= radius,
    distanceM,
  };
}

/**
 * Builds synchronized static OBB colliders for the unified 3-Bay Civic Commercial Arcade
 * shell (building body, front bench, flanking sandstone planters) and Bay 2's A-Frame sign.
 */
export function computeRealEstateKioskWorldColliders(): StaticWorldStructureObb[] {
  const signWorld = realEstateKioskLocalToWorldPose(
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.aFrameSignLocal.x,
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.aFrameSignLocal.y,
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.aFrameSignLocal.z,
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.aFrameSignLocal.rotY,
  );
  const benchWorld = realEstateKioskLocalToWorldPose(-7.85, 0, 3.45, 0);
  const planterSouthWorld = realEstateKioskLocalToWorldPose(-10.55, 0, 3.45, 0);
  const planterNorthWorld = realEstateKioskLocalToWorldPose(10.55, 0, 3.45, 0);

  return [
    {
      id: 'lobby_kiosk_arcade_body',
      x: REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.worldCenterX,
      z: REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.worldCenterZ,
      halfX: 2.55,
      halfZ: 10.62,
      rotY: 0,
      heightY: 9.5,
      mat: 'concrete',
    },
    {
      id: 'lobby_kiosk_arcade_bench',
      x: +benchWorld.x.toFixed(2),
      z: +benchWorld.z.toFixed(2),
      halfX: 0.38,
      halfZ: 0.94,
      rotY: 0,
      heightY: 3.45,
      mat: 'wood',
    },
    {
      id: 'lobby_kiosk_arcade_planter_s',
      x: +planterSouthWorld.x.toFixed(2),
      z: +planterSouthWorld.z.toFixed(2),
      halfX: 0.46,
      halfZ: 0.46,
      rotY: 0,
      heightY: 3.65,
      mat: 'concrete',
    },
    {
      id: 'lobby_kiosk_arcade_planter_n',
      x: +planterNorthWorld.x.toFixed(2),
      z: +planterNorthWorld.z.toFixed(2),
      halfX: 0.46,
      halfZ: 0.46,
      rotY: 0,
      heightY: 3.65,
      mat: 'concrete',
    },
    {
      id: 'lobby_realestate_kiosk_sign',
      x: +signWorld.x.toFixed(2),
      z: +signWorld.z.toFixed(2),
      halfX: 0.34,
      halfZ: 0.34,
      rotY: 0,
      heightY: 3.55,
      mat: 'wood',
    },
  ];
}

export interface AudioChannelMixerState {
  readonly volumePct: number;
  readonly muted: boolean;
  readonly lastNonZeroPct: number;
}

export function clampAudioVolumePct(rawPct: number): number {
  if (!Number.isFinite(rawPct)) return 100;
  return Math.max(0, Math.min(100, Math.round(rawPct)));
}

/**
 * Pure state transition when dragging a Music or Sound FX volume slider (`0..100%`).
 * Setting `0%` mutes that channel cleanly; dragging `> 0%` automatically unmutes that channel.
 */
export function computeChannelStateAfterSliderChange(
  prev: AudioChannelMixerState,
  nextRawPct: number,
): AudioChannelMixerState {
  const volumePct = clampAudioVolumePct(nextRawPct);
  if (volumePct === 0) {
    return {
      volumePct: 0,
      muted: true,
      lastNonZeroPct: prev.lastNonZeroPct > 0 ? prev.lastNonZeroPct : 50,
    };
  }
  return {
    volumePct,
    muted: false,
    lastNonZeroPct: volumePct,
  };
}

/**
 * Pure state transition when clicking Mute / Unmute for a Music or Sound FX channel.
 * Unmuting when `volumePct === 0` restores `lastNonZeroPct` (fallback `50%`).
 */
export function computeChannelStateAfterToggleMute(
  prev: AudioChannelMixerState,
): AudioChannelMixerState {
  const nextMuted = !prev.muted;
  if (nextMuted) {
    return {
      volumePct: prev.volumePct,
      muted: true,
      lastNonZeroPct: prev.volumePct > 0 ? prev.volumePct : prev.lastNonZeroPct || 50,
    };
  }
  const restoredPct = prev.volumePct > 0 ? prev.volumePct : clampAudioVolumePct(prev.lastNonZeroPct || 50);
  return {
    volumePct: restoredPct,
    muted: false,
    lastNonZeroPct: restoredPct,
  };
}
