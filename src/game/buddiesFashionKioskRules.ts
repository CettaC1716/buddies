import type { StaticWorldStructureObb } from './buddiesBlitzTypes';
import { REAL_ESTATE_FURNITURE_KIOSK_LAYOUT } from './buddiesRealEstateKioskRules';
import { URBAN_SCOOTER_SHOP_LAYOUT } from './buddiesUrbanScooterRules';

/**
 * Architectural Model Sheet Specification (`screen_aad784ba.png` & `screenshot_12_60bb245f.png`):
 * COMPACT GLASS & STEEL FASHION & APPAREL BOUTIQUE KIOSK
 * ("Kios Toko Baju & Butik Pakaian Modern")
 *
 * Anchored inside `westPlantGroup` (`(-90.5, 0, 0)`) at local `(-10.2, 2.50, +5.0)`,
 * rotated `+Math.PI / 2` so local `+Z` faces East (`+X`) onto Central Plaza (`y = 2.50m`),
 * and local `+X` faces North (`-Z`) toward the Urban Scooter Showroom (`z = -4.4`) and
 * Real Estate & Furniture Kiosk (`z = -13.8`) with exact `9.40m` center-to-center symmetry.
 */
export const FASHION_APPAREL_KIOSK_LAYOUT = {
  westPlantOriginX: -90.5,
  westPlantOriginZ: 0.0,
  kioskLocalX: -10.2,
  kioskLocalY: 2.50,
  kioskLocalZ: 5.0,
  kioskRotY: Math.PI / 2,
  kioskScale: 1.48,
  worldCenterX: -100.7,
  worldBaseY: 2.50,
  worldCenterZ: 5.0,
  // Stepped Granite Plaza Paver Base (`Granite Plaza Paver Base` in all 4 views of `screen_aad784ba.png`)
  granitePaverBaseWidthLocal: 5.18,
  granitePaverBaseDepthLocal: 4.12,
  granitePaverBaseHeightLocal: 0.075,
  // Front-Right Glass Entrance Door span in kiosk-local X
  entranceDoorLocalXMin: 0.78,
  entranceDoorLocalXMax: 2.04,
  entranceDoorFrontLocalZ: 1.54,
  // Wooden A-Frame Sidewalk Sign ("FASHION & APPAREL BOUTIQUE") on Granite Paver Base front-right corner
  aFrameSignLocal: {
    x: 1.88,
    y: 0.075,
    z: 1.94,
    rotY: 0.30,
  },
  // Low 3D interaction chevron ("segitiga interaksi") beside the front-right A-Frame sign on open plaza pavers
  interactionMarkerLocal: {
    x: 2.34,
    y: 0.0,
    z: 2.24,
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
  triggerRadius: 2.85,
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
      errorMessage: `Insufficient LUL (${currentLulBalance.toLocaleString()} / ${item.priceLul} LUL). Collect Plaza bench coins, work a Cafe shift, or claim Hana's starter pack.`,
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
 * Returns the center-to-center spacing metrics across the 3 West Promenade kiosks:
 * 1. North: Real Estate & Furniture Showroom (`z = -13.8`)
 * 2. Center: Urban Scooter Showroom (`z = -4.4`)
 * 3. South: Fashion & Apparel Boutique (`z = +5.0`)
 */
export function computeWestPromenadeKioskSymmetryMetrics(): {
  northRealEstateZ: number;
  centerScooterZ: number;
  southFashionZ: number;
  northToCenterSpanM: number;
  centerToSouthSpanM: number;
  isSymmetrical: boolean;
} {
  const northRealEstateZ = REAL_ESTATE_FURNITURE_KIOSK_LAYOUT.worldCenterZ;
  const centerScooterZ = URBAN_SCOOTER_SHOP_LAYOUT.worldCenterZ;
  const southFashionZ = FASHION_APPAREL_KIOSK_LAYOUT.worldCenterZ;
  const northToCenterSpanM = +(centerScooterZ - northRealEstateZ).toFixed(3);
  const centerToSouthSpanM = +(southFashionZ - centerScooterZ).toFixed(3);
  return {
    northRealEstateZ,
    centerScooterZ,
    southFashionZ,
    northToCenterSpanM,
    centerToSouthSpanM,
    isSymmetrical: Math.abs(northToCenterSpanM - centerToSouthSpanM) < 1e-6,
  };
}

/**
 * Builds synchronized static OBB colliders for the Central Plaza
 * Fashion & Apparel Boutique Kiosk and its outdoor wooden A-Frame sidewalk sign.
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
      id: 'lobby_fashion_kiosk_body',
      x: -100.55,
      z: FASHION_APPAREL_KIOSK_LAYOUT.worldCenterZ,
      halfX: 2.62,
      halfZ: 3.30,
      rotY: 0,
      heightY: 6.9,
      mat: 'metal',
    },
    {
      id: 'lobby_fashion_kiosk_sign',
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
