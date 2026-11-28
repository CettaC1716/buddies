import type { StaticWorldStructureObb } from './buddiesBlitzTypes';
import { REAL_ESTATE_FURNITURE_KIOSK_LAYOUT } from './buddiesRealEstateKioskRules';
import { URBAN_SCOOTER_SHOP_LAYOUT } from './buddiesUrbanScooterRules';

/**
 * Unified 3-Bay Civic Commercial Arcade — Bay 1 (Left / South) Fashion & Apparel Outfit Kiosk
 * ("Kios Butik Busana").
 *
 * Bay 1 center sits at `world = (-100.10, 2.50, +2.35)` (`arcade localX = -6.75`),
 * rotated `+Math.PI / 2` so local `+Z` faces East (`+X`) onto Central Plaza (`y = 2.50m`).
 */
export const FASHION_APPAREL_KIOSK_LAYOUT = {
  westPlantOriginX: -92.75,
  westPlantOriginZ: 0.0,
  kioskLocalX: -13.60,
  kioskLocalY: 2.50,
  kioskLocalZ: 2.35,
  kioskRotY: Math.PI / 2,
  kioskScale: 1.0,
  worldCenterX: -106.35,
  worldBaseY: 2.50,
  worldCenterZ: 2.35,
  granitePaverBaseWidthLocal: 6.75,
  granitePaverBaseDepthLocal: 2.45,
  granitePaverBaseHeightLocal: 0.045,
  // Front-Right Glass Entrance Door span in bay-local X
  entranceDoorLocalXMin: 1.65,
  entranceDoorLocalXMax: 2.95,
  entranceDoorFrontLocalZ: 2.50,
  // Wooden A-Frame Sidewalk Sign ("FASHION & APPAREL BOUTIQUE") on front cobblestone apron
  aFrameSignLocal: {
    x: 1.60,
    y: 0.045,
    z: 4.05,
    rotY: 0.30,
  },
  // Low 3D interaction chevron ("segitiga interaksi") beside the front-right A-Frame sign on open plaza pavers
  interactionMarkerLocal: {
    x: 2.20,
    y: 0.0,
    z: 4.85,
  },
} as const;

/**
 * Converts a kiosk-local `(localX, localY, localZ, localRotY)` pose inside
 * `LobbyFashionAndApparelKiosk` (`rotation.y = +Math.PI / 2`, `scale = 1.48`)
 * into exact world coordinates on the Central Plaza deck.
 */
export function fashionKioskLocalToWorldPose(
  localX: number,
  localY: number,
  localZ: number,
  localRotY = 0,
): { x: number; y: number; z: number; rotY: number } {
  const s = FASHION_APPAREL_KIOSK_LAYOUT.kioskScale;
  const cosR = Math.cos(FASHION_APPAREL_KIOSK_LAYOUT.kioskRotY);
  const sinR = Math.sin(FASHION_APPAREL_KIOSK_LAYOUT.kioskRotY);
  const sx = localX * s;
  const sy = localY * s;
  const sz = localZ * s;
  const wx = FASHION_APPAREL_KIOSK_LAYOUT.worldCenterX + sx * cosR + sz * sinR;
  const wy = FASHION_APPAREL_KIOSK_LAYOUT.worldBaseY + sy;
  const wz = FASHION_APPAREL_KIOSK_LAYOUT.worldCenterZ - sx * sinR + sz * cosR;
  return {
    x: +wx.toFixed(3),
    y: +wy.toFixed(3),
    z: +wz.toFixed(3),
    rotY: +(FASHION_APPAREL_KIOSK_LAYOUT.kioskRotY + localRotY).toFixed(4),
  };
}

const FASHION_INTERACTION_MARKER_WORLD = fashionKioskLocalToWorldPose(
  FASHION_APPAREL_KIOSK_LAYOUT.interactionMarkerLocal.x,
  FASHION_APPAREL_KIOSK_LAYOUT.interactionMarkerLocal.y,
  FASHION_APPAREL_KIOSK_LAYOUT.interactionMarkerLocal.z,
);

/**
 * Proximity trigger & low 3D chevron marker coordinates for the Central Plaza
 * Fashion & Apparel Boutique Kiosk ("segitiga interaksi untuk pembelian baju").
 */
export const FASHION_BOUTIQUE_SHOP_TRIGGER = {
  x: FASHION_INTERACTION_MARKER_WORLD.x,
  z: FASHION_INTERACTION_MARKER_WORLD.z,
  deckY: FASHION_APPAREL_KIOSK_LAYOUT.worldBaseY,
  markerOffsetY: 0.38,
  triggerRadius: 2.55,
} as const;

export function evaluateFashionBoutiqueProximity(
  playerX: number,
  playerZ: number,
  isWarzone: boolean,
  isAnyModalOpen: boolean,
): { distanceM: number; isNear: boolean; canInteract: boolean } {
  const distanceM = Math.hypot(
    playerX - FASHION_BOUTIQUE_SHOP_TRIGGER.x,
    playerZ - FASHION_BOUTIQUE_SHOP_TRIGGER.z,
  );
  const isNear = !isWarzone && distanceM <= FASHION_BOUTIQUE_SHOP_TRIGGER.triggerRadius;
  return {
    distanceM,
    isNear,
    canInteract: isNear && !isAnyModalOpen,
  };
}

export type FashionApparelSlot = 'torso';

export interface FashionApparelSpecRow {
  label: string;
  value: string;
}

export interface FashionApparelCatalogItem {
  id: string;
  slot: FashionApparelSlot;
  name: string;
  subtitle: string;
  collectionLabel: string;
  priceLul: number;
  maleGlbPath: string;
  femaleGlbPath: string;
  fitLabel: string;
  deliveryTarget: 'bag';
  accentColor: string;
  description: string;
  specs: FashionApparelSpecRow[];
}

export const FASHION_APPAREL_CATALOG_ITEMS: FashionApparelCatalogItem[] = [
  {
    id: 'apparel_torso_dropscience_hiphop_24',
    slot: 'torso',
    name: 'Drop Science Hip-Hop Top',
    subtitle: 'Layered Streetwear Hoodie & Overshirt',
    collectionLabel: 'Drop Science · Collection 24',
    priceLul: 15,
    maleGlbPath: '/assets/torso_dropscience_hiphop_24_iap_1_3B9D82F3.glb',
    femaleGlbPath: '/assets/torso_dropscience_hiphop_24_iap_1_3B9D82F3.glb',
    fitLabel: 'Unisex Fit · Male & Female Rig',
    deliveryTarget: 'bag',
    accentColor: '#38bdf8',
    description:
      'Layered streetwear hip-hop jacket over a hooded inner top. Purchased tops are delivered straight to your Personal Bag so you can equip or swap outfits anytime.',
    specs: [
      { label: 'Slot', value: 'Upper Body (Torso)' },
      { label: 'Avatar Fit', value: 'Male & Female' },
      { label: 'Delivery', value: 'Personal Bag' },
      { label: 'Sleeve Cut', value: '3/4 Layered Cuff' },
    ],
  },
];

export function getFashionApparelItemById(itemId: string | null | undefined): FashionApparelCatalogItem | null {
  if (!itemId) return null;
  return FASHION_APPAREL_CATALOG_ITEMS.find((item) => item.id === itemId) ?? null;
}

export function resolveEquippedTorsoGlbForGender(
  itemId: string | null | undefined,
  gender: 'male' | 'female',
): string | null {
  const item = getFashionApparelItemById(itemId);
  if (!item) return null;
  return gender === 'female' ? item.femaleGlbPath : item.maleGlbPath;
}

export function getOwnedApparelStorageKey(accountKey: string): string {
  const cleanKey = (accountKey || 'guest').trim() || 'guest';
  return `bb_owned_apparel_v1:${cleanKey}`;
}

export function getEquippedTorsoStorageKey(accountKey: string): string {
  const cleanKey = (accountKey || 'guest').trim() || 'guest';
  return `bb_equipped_torso_v1:${cleanKey}`;
}

export function purchaseFashionApparelToBag(
  currentOwnedIds: readonly string[],
  currentLulBalance: number,
  itemId: string,
): {
  ok: boolean;
  alreadyOwned: boolean;
  nextOwnedIds: string[];
  nextLulBalance: number;
  priceChargedLul: number;
  errorMessage?: string;
} {
  const item = getFashionApparelItemById(itemId);
  if (!item) {
    return {
      ok: false,
      alreadyOwned: false,
      nextOwnedIds: [...currentOwnedIds],
      nextLulBalance: currentLulBalance,
      priceChargedLul: 0,
      errorMessage: 'Selected apparel item was not found in boutique catalog.',
    };
  }
  if (currentOwnedIds.includes(item.id)) {
    return {
      ok: true,
      alreadyOwned: true,
      nextOwnedIds: [...currentOwnedIds],
      nextLulBalance: currentLulBalance,
      priceChargedLul: 0,
    };
  }
  if (currentLulBalance < item.priceLul) {
    return {
      ok: false,
      alreadyOwned: false,
      nextOwnedIds: [...currentOwnedIds],
      nextLulBalance: currentLulBalance,
      priceChargedLul: 0,
      errorMessage: `Insufficient CerBucks (${currentLulBalance.toLocaleString()} / ${item.priceLul} CerBucks). Collect Plaza bench coins, work a Cafe shift, or claim Hana's starter pack.`,
    };
  }
  return {
    ok: true,
    alreadyOwned: false,
    nextOwnedIds: [...currentOwnedIds, item.id],
    nextLulBalance: Math.max(0, currentLulBalance - item.priceLul),
    priceChargedLul: item.priceLul,
  };
}

export function toggleEquipFashionApparel(
  ownedIds: readonly string[],
  currentEquippedId: string | null,
  targetItemId: string | null,
): { ok: boolean; nextEquippedId: string | null } {
  if (!targetItemId) {
    return { ok: true, nextEquippedId: null };
  }
  if (!ownedIds.includes(targetItemId)) {
    return { ok: false, nextEquippedId: currentEquippedId };
  }
  const nextEquippedId = currentEquippedId === targetItemId ? null : targetItemId;
  return { ok: true, nextEquippedId };
}

/**
 * Returns the center-to-center bay spacing metrics across the unified 3-bay Civic Commercial Arcade:
 * 1. Bay 3 (North, `z = -11.15`): Urban Scooter & Mobility
 * 2. Bay 2 (Center, `z = -4.40`): Real Estate & Design Studio
 * 3. Bay 1 (South, `z = +2.35`): Fashion & Apparel Boutique
 */
export function computeWestPromenadeKioskSymmetryMetrics(): {
  northScooterZ: number;
  centerRealEstateZ: number;
  southFashionZ: number;
  northToCenterSpanM: number;
  centerToSouthSpanM: number;
  isSymmetrical: boolean;
} {
  const northScooterZ = URBAN_SCOOTER_SHOP_LAYOUT.worldCenterZ;
  const centerRealEstateZ = REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.worldCenterZ;
  const southFashionZ = FASHION_APPAREL_KIOSK_LAYOUT.worldCenterZ;
  const northToCenterSpanM = +(centerRealEstateZ - northScooterZ).toFixed(3);
  const centerToSouthSpanM = +(southFashionZ - centerRealEstateZ).toFixed(3);
  return {
    northScooterZ,
    centerRealEstateZ,
    southFashionZ,
    northToCenterSpanM,
    centerToSouthSpanM,
    isSymmetrical: Math.abs(northToCenterSpanM - centerToSouthSpanM) < 1e-6,
  };
}

/**
 * Builds synchronized static OBB collider for Bay 1's outdoor wooden A-Frame sidewalk sign
 * (main arcade shell collider is provided by `computeRealEstateKioskWorldColliders`).
 */
export function computeFashionKioskWorldColliders(): StaticWorldStructureObb[] {
  const signWorld = fashionKioskLocalToWorldPose(
    FASHION_APPAREL_KIOSK_LAYOUT.aFrameSignLocal.x,
    FASHION_APPAREL_KIOSK_LAYOUT.aFrameSignLocal.y,
    FASHION_APPAREL_KIOSK_LAYOUT.aFrameSignLocal.z,
    FASHION_APPAREL_KIOSK_LAYOUT.aFrameSignLocal.rotY,
  );

  return [
    {
      id: 'lobby_fashion_kiosk_sign',
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
