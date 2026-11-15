import type { StaticWorldStructureObb } from './buddiesBlitzTypes';

export interface RealEstateKioskVec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Architectural Model Sheet Specification (`screen_722f4ee5.png` & `screenshot_16_16283bb7.png`):
 * COMPACT GLASS & STEEL REAL ESTATE & FURNITURE SHOWROOM KIOSK
 * ("Kios Kantor Agen Properti Rumah & Showroom Furnitur Minimalis")
 *
 * Anchored inside `westPlantGroup` (`(-90.5, 0, 0)`) at local `(-10.2, 2.50, -13.8)`,
 * rotated `+Math.PI / 2` so local `+Z` faces East (`+X`) onto Central Plaza (`y = 2.50m`),
 * and local `+X` faces North (`-Z`) toward the Municipal Hall plaza promenade.
 */
export const REAL_ESTATE_FURNITURE_KIOSK_LAYOUT = {
  westPlantOriginX: -90.5,
  westPlantOriginZ: 0.0,
  kioskLocalX: -10.2,
  kioskLocalY: 2.50,
  kioskLocalZ: -13.8,
  kioskRotY: Math.PI / 2,
  kioskScale: 1.48,
  worldCenterX: -100.7,
  worldBaseY: 2.50,
  worldCenterZ: -13.8,
  // Stepped Granite Plaza Paver Base (`Granite Plaza Paver Base` in all 4 views of `screen_722f4ee5.png`)
  granitePaverBaseWidthLocal: 5.18,
  granitePaverBaseDepthLocal: 4.12,
  granitePaverBaseHeightLocal: 0.075,
  // Front-Right Glass Entrance Door span in kiosk-local X
  entranceDoorLocalXMin: 0.78,
  entranceDoorLocalXMax: 2.04,
  entranceDoorFrontLocalZ: 1.54,
  // Wooden A-Frame Sidewalk Sign ("REAL ESTATE & INTERIOR STUDIO") on Granite Paver Base front-right corner
  aFrameSignLocal: {
    x: 1.88,
    y: 0.075,
    z: 1.94,
    rotY: 0.30,
  },
  // Low floating 3D interaction triangle right beside the bottom-right edge of the wooden A-Frame sign
  interactionMarkerLocal: {
    x: 2.38,
    y: 0.0,
    z: 2.22,
  },
  // Merchant Hana world placement directly on the Central Plaza tiles in front of the left showroom bay (well clear of the North A-Frame sign & 3D triangle)
  hanaMerchantWorld: {
    x: -95.95,
    y: 2.50,
    z: -11.55,
    rotY: Math.PI / 2,
  },
} as const;

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
  triggerRadius: 2.55,
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
 * Classic Plaza Manor Model House double entrance doors (`x = -91.3, z = -24.26`).
 */
export const PLAZA_MODEL_HOUSE_DOOR_TRIGGER = {
  x: -91.3,
  z: -24.26,
  deckY: 2.5,
  markerOffsetY: 0.56,
  triggerRadius: 2.65,
  houseStyle: 'plaza_manor' as const,
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
 * Builds synchronized static OBB colliders for the renovated Central Plaza
 * Real Estate & Furniture Showroom Kiosk and its outdoor A-Frame sidewalk sign
 * (replacing the legacy gelato kiosk body + barstools colliders).
 */
export function computeRealEstateKioskWorldColliders(): StaticWorldStructureObb[] {
  const signWorld = realEstateKioskLocalToWorldPose(
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.aFrameSignLocal.x,
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.aFrameSignLocal.y,
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.aFrameSignLocal.z,
    REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.aFrameSignLocal.rotY,
  );

  return [
    {
      id: 'lobby_realestate_kiosk_body',
      x: -100.55,
      z: -13.8,
      halfX: 2.62,
      halfZ: 3.30,
      rotY: 0,
      heightY: 6.9,
      mat: 'metal',
    },
    {
      id: 'lobby_realestate_kiosk_sign',
      x: +signWorld.x.toFixed(2),
      z: +signWorld.z.toFixed(2),
      halfX: 0.42,
      halfZ: 0.42,
      rotY: 0,
      heightY: 3.92,
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
