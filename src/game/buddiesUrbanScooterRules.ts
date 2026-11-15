import type { StaticWorldStructureObb } from './buddiesBlitzTypes';

export type UrbanScooterKind = 'electric_scooter_bike' | 'push_kick_scooter';

/**
 * World scale applied to a scooter while it is being ridden. The city
 * avatars stand ~3.9 world units tall, so a real-world-sized scooter
 * (built to the spec sheets below) reads as a toy under them; ridden
 * scooters are scaled up to match the avatar proportions.
 */
export const SCOOTER_RIDE_MODEL_SCALE = 2.0;

/**
 * Rider body lift (world units) while riding, per kind: the scale-1 lift
 * (bike seat 0.78 -> 0.33, kick deck 0.114 -> 0.12) plus the anchor height
 * gained from SCOOTER_RIDE_MODEL_SCALE, so hips stay on the seat and feet
 * stay on the deck at the larger size.
 */
export const SCOOTER_RIDER_LIFT_M: Record<UrbanScooterKind, number> = {
  electric_scooter_bike: 1.11,
  push_kick_scooter: 0.23,
};

export interface ScooterVec3Tuple {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Industrial Model Sheet Specification (`screen_8a1fbcde.png`):
 * MODERN URBAN ELECTRIC SCOOTER ("Scooter Bike")
 * Local space: +Z = Forward, -Z = Rear, +Y = Up, y = 0 = Tire Ground Contact.
 */
export const ELECTRIC_SCOOTER_BIKE_SPEC = {
  id: 'nft_urban_electric_scooter_bike',
  tokenId: 'nep245:vehicle:urban_electric_scooter_bike',
  kind: 'electric_scooter_bike' as UrbanScooterKind,
  displayName: 'Urban Electric Scooter Bike',
  currency: 'RESPITE' as const,
  priceRespite: 30,
  isNft: true,
  // 4-View Sheet Canonical Metric Dimensions (meters)
  lengthM: 1.80,
  wheelbaseM: 1.25,
  seatHeightM: 0.78,
  pillionHeightM: 0.825,
  handlebarHeightM: 1.15,
  mirrorTopHeightM: 1.30,
  mirrorSpanWidthM: 0.70,
  handlebarGripSpanM: 0.62,
  bodyWidthM: 0.42,
  groundClearanceM: 0.16,
  floorboardTopY: 0.245,
  wheelOuterRadiusM: 0.255,
  tireSectionRadiusM: 0.060,
  frontWheelAxle: { x: 0, y: 0.255, z: 0.64 } as ScooterVec3Tuple,
  rearWheelAxle: { x: 0, y: 0.255, z: -0.61 } as ScooterVec3Tuple,
  steeringPivot: { x: 0, y: 0.96, z: 0.30 } as ScooterVec3Tuple,
  steeringRakeRad: -0.34, // Tilted slightly rearward from +Z toward rider
  centerKickstandPivot: { x: 0, y: 0.165, z: -0.18 } as ScooterVec3Tuple,
  // Ready-to-use Rider Bone / Attachment Anchors (for future equip & riding animation)
  riderSeatAnchor: { x: 0, y: 0.78, z: -0.16 } as ScooterVec3Tuple,
  riderLeftFootAnchor: { x: 0.105, y: 0.25, z: 0.10 } as ScooterVec3Tuple,
  riderRightFootAnchor: { x: -0.105, y: 0.25, z: 0.10 } as ScooterVec3Tuple,
  riderLeftGripAnchor: { x: 0.285, y: 1.09, z: 0.23 } as ScooterVec3Tuple,
  riderRightGripAnchor: { x: -0.285, y: 1.09, z: 0.23 } as ScooterVec3Tuple,
  palette: {
    bodyPearlWhite: '#f1f4f8',
    bodySatinSilver: '#d5dde7',
    accentCyan: '#14b8a6',
    accentCyanGlow: '#22d3ee',
    trimCharcoal: '#282e37',
    seatCharcoal: '#252a32',
    alloyWheelDark: '#363d47',
    tireRubber: '#1e2229',
    headlightLed: '#e8fbff',
    taillightRed: '#ef4444',
    indicatorAmber: '#f59e0b',
  },
} as const;

/**
 * Industrial Model Sheet Specification (`screen_e2bde276.png`):
 * MODERN URBAN PUSH SCOOTER ("Kick Scooter")
 * Local space: +Z = Forward, -Z = Rear, +Y = Up, y = 0 = Wheel Ground Contact.
 */
export const PUSH_KICK_SCOOTER_SPEC = {
  id: 'nft_urban_push_kick_scooter',
  tokenId: 'nep245:vehicle:urban_push_kick_scooter',
  kind: 'push_kick_scooter' as UrbanScooterKind,
  displayName: 'Urban Push Kick Scooter',
  currency: 'RESPITE' as const,
  priceRespite: 15,
  isNft: true,
  // 4-View Sheet Canonical Metric Dimensions (meters)
  lengthM: 0.92,
  foldedLengthM: 0.85,
  foldedHeightM: 0.32,
  wheelbaseM: 0.72,
  tBarHeightM: 0.98, // Adjustable 90-105cm range
  tBarWidthM: 0.48,
  deckWidthM: 0.156,
  deckLengthM: 0.49,
  deckClearanceM: 0.08,
  deckTopY: 0.114,
  wheelOuterRadiusM: 0.10, // 200mm PU Wheel
  tireSectionRadiusM: 0.022,
  frontWheelAxle: { x: 0, y: 0.10, z: 0.36 } as ScooterVec3Tuple,
  rearWheelAxle: { x: 0, y: 0.10, z: -0.36 } as ScooterVec3Tuple,
  foldingHingePivot: { x: 0, y: 0.20, z: 0.285 } as ScooterVec3Tuple,
  steeringPivot: { x: 0, y: 0.24, z: 0.315 } as ScooterVec3Tuple,
  stemRakeRad: -0.19,
  sideKickstandPivot: { x: 0.068, y: 0.084, z: -0.05 } as ScooterVec3Tuple,
  parkedLeanRollRad: -0.075,
  // Ready-to-use Rider Bone / Attachment Anchors (for future equip & kick-push animation)
  leadFootDeckAnchor: { x: 0.015, y: 0.116, z: 0.03 } as ScooterVec3Tuple,
  coastingRearFootAnchor: { x: -0.025, y: 0.116, z: -0.15 } as ScooterVec3Tuple,
  pushFootGroundContact: { x: -0.14, y: 0.0, z: -0.04 } as ScooterVec3Tuple,
  riderLeftGripAnchor: { x: 0.20, y: 0.98, z: 0.19 } as ScooterVec3Tuple,
  riderRightGripAnchor: { x: -0.20, y: 0.98, z: 0.19 } as ScooterVec3Tuple,
  palette: {
    frameAluminum: '#dce3ec',
    stemCharcoal: '#333944',
    accentCyan: '#14b8a6',
    gripDark: '#232830',
    wheelCoreAlloy: '#64748b',
    puTireDark: '#222730',
    reflectorRed: '#ef4444',
    reflectorFront: '#f8fafc',
  },
} as const;

export interface UrbanScooterCatalogItem {
  readonly id: string;
  readonly tokenId: string;
  readonly kind: UrbanScooterKind;
  readonly name: string;
  readonly subtitle: string;
  readonly description: string;
  readonly currency: 'RESPITE';
  readonly priceRespite: number;
  readonly isNft: true;
  readonly specs: ReadonlyArray<{ readonly label: string; readonly value: string }>;
}

/**
 * Exclusive Urban Scooter Showroom NFT Catalog (sold directly at Central Plaza Scooter Showroom,
 * separate from Hana & Kai catalogs).
 */
export const URBAN_SCOOTER_CATALOG_ITEMS: readonly UrbanScooterCatalogItem[] = [
  {
    id: ELECTRIC_SCOOTER_BIKE_SPEC.id,
    tokenId: ELECTRIC_SCOOTER_BIKE_SPEC.tokenId,
    kind: 'electric_scooter_bike',
    name: 'Urban Electric Scooter Bike',
    subtitle: 'NFT Vehicle · Seated Commuter',
    description:
      'Pearl-white & satin-silver electric commuter scooter with flush vertical DRL, digital LCD cockpit, flat step-through floorboard, 2-up stepped saddle, and dual rear coil suspension.',
    currency: 'RESPITE',
    priceRespite: ELECTRIC_SCOOTER_BIKE_SPEC.priceRespite,
    isNft: true,
    specs: [
      { label: 'Length / Wheelbase', value: '180 cm / 125 cm' },
      { label: 'Seat / Handlebar', value: '78 cm / 115 cm' },
      { label: 'Suspension', value: 'Telescopic + Dual Coil' },
      { label: 'Wheels & Brakes', value: '5-Spoke Alloy · Front Disc' },
    ],
  },
  {
    id: PUSH_KICK_SCOOTER_SPEC.id,
    tokenId: PUSH_KICK_SCOOTER_SPEC.tokenId,
    kind: 'push_kick_scooter',
    name: 'Urban Push Kick Scooter',
    subtitle: 'NFT Vehicle · Foldable Kick Bike',
    description:
      'Lightweight brushed-aluminum & charcoal kick scooter featuring an ergonomic 48 cm T-bar, front suspension fork, geometric high-grip deck, and compact 85 cm folding latch with carry strap.',
    currency: 'RESPITE',
    priceRespite: PUSH_KICK_SCOOTER_SPEC.priceRespite,
    isNft: true,
    specs: [
      { label: 'Length / Wheelbase', value: '92 cm / 72 cm' },
      { label: 'Folded Profile', value: '85 cm × 32 cm' },
      { label: 'T-Bar Span', value: '98 cm H · 48 cm W' },
      { label: 'Wheels & Brake', value: '200 mm PU · Rear Fender' },
    ],
  },
] as const;

/**
 * Builds the canonical NearBlocks / NEAR Scan NFT Token Explorer URL for a NEP-171 / NEP-245 `tokenId`.
 */
export function getNearBlocksNftTokenUrl(
  contractId: string,
  tokenId: string,
  network: 'testnet' | 'mainnet' = 'testnet',
): string {
  const host = network === 'mainnet' ? 'https://nearblocks.io' : 'https://testnet.nearblocks.io';
  return `${host}/nft-token/${encodeURIComponent(contractId.trim())}/${encodeURIComponent(tokenId.trim())}`;
}

export interface StaticDisplayScooterPlacement {
  readonly id: string;
  readonly kind: UrbanScooterKind;
  readonly currency: 'RESPITE';
  readonly isNft: true;
  readonly isStaticDisplay: true;
  readonly isRideable: false;
  readonly localX: number;
  readonly localY: number;
  readonly localZ: number;
  readonly localRotY: number;
  readonly localScale: number;
  readonly steerAngleRad: number;
  readonly plinthHalfWidthLocal: number;
  readonly plinthHalfLengthLocal: number;
  readonly plinthHeightLocal: number;
}

/**
 * Central Plaza Urban Scooter Showroom Layout (`screenshot_12_f23594d9.png`).
 * Anchored inside `westPlantGroup` (`(-90.5, 0, 0)`) at local `(-10.2, 2.50, -1.2)`,
 * facing East (`+X`, `rotation.y = Math.PI / 2`) onto the Central Plaza Upper Deck (`y = 2.50m`).
 */
export const URBAN_SCOOTER_SHOP_LAYOUT = {
  westPlantOriginX: -90.5,
  westPlantOriginZ: 0.0,
  kioskLocalX: -10.2,
  kioskLocalY: 2.50,
  kioskLocalZ: -1.2,
  kioskRotY: Math.PI / 2,
  kioskScale: 1.48,
  worldCenterX: -100.7,
  worldBaseY: 2.50,
  worldCenterZ: -1.2,
  // Outdoor A-Frame Sign positioned outside front-right (North-East) corner, keeping entrance door clear
  aFrameSignLocal: {
    x: 1.66,
    y: 0.01,
    z: 2.06,
    rotY: 0.34,
  },
  // Low floating 3D interaction triangle spot right beside the bottom-right of the A-Frame sign (`screenshot_13_e308ec4b.png`)
  interactionMarkerLocal: {
    x: 2.28,
    y: 0.0,
    z: 2.26,
  },
  // Front-Right Glass Entrance Door span in kiosk-local X (kept 100% clear of outdoor displays)
  entranceDoorLocalXMin: 0.78,
  entranceDoorLocalXMax: 2.04,
  entranceDoorFrontLocalZ: 1.54,
  // 2 Non-Rideable Static Showcase Scooters in front of Left & Center Display Windows
  frontStaticDisplays: [
    {
      id: 'lobby_scooter_display_bike',
      kind: 'electric_scooter_bike',
      currency: 'RESPITE',
      isNft: true,
      isStaticDisplay: true,
      isRideable: false,
      localX: -1.22,
      localY: 0.0,
      localZ: 2.58,
      localRotY: 0.54,
      localScale: 1.04,
      steerAngleRad: 0.16,
      plinthHalfWidthLocal: 0.44,
      plinthHalfLengthLocal: 1.04,
      plinthHeightLocal: 0.045,
    },
    {
      id: 'lobby_scooter_display_kick',
      kind: 'push_kick_scooter',
      currency: 'RESPITE',
      isNft: true,
      isStaticDisplay: true,
      isRideable: false,
      localX: 0.14,
      localY: 0.0,
      localZ: 2.46,
      localRotY: 0.46,
      localScale: 1.12,
      steerAngleRad: 0.20,
      plinthHalfWidthLocal: 0.30,
      plinthHalfLengthLocal: 0.62,
      plinthHeightLocal: 0.045,
    },
  ] as readonly StaticDisplayScooterPlacement[],
} as const;

/**
 * Converts a kiosk-local `(lx, ly, lz, lRotY)` coordinate inside `UrbanScooterShowroomKiosk`
 * (`rotation.y = +Math.PI / 2`, `scale = 1.48`) into exact world coordinates.
 */
export function kioskLocalToWorldPose(
  localX: number,
  localY: number,
  localZ: number,
  localRotY = 0,
): { x: number; y: number; z: number; rotY: number } {
  const s = URBAN_SCOOTER_SHOP_LAYOUT.kioskScale;
  const cosR = Math.cos(URBAN_SCOOTER_SHOP_LAYOUT.kioskRotY);
  const sinR = Math.sin(URBAN_SCOOTER_SHOP_LAYOUT.kioskRotY);
  const sx = localX * s;
  const sy = localY * s;
  const sz = localZ * s;
  const wx = URBAN_SCOOTER_SHOP_LAYOUT.worldCenterX + sx * cosR + sz * sinR;
  const wy = URBAN_SCOOTER_SHOP_LAYOUT.worldBaseY + sy;
  const wz = URBAN_SCOOTER_SHOP_LAYOUT.worldCenterZ - sx * sinR + sz * cosR;
  return {
    x: +wx.toFixed(3),
    y: +wy.toFixed(3),
    z: +wz.toFixed(3),
    rotY: +(URBAN_SCOOTER_SHOP_LAYOUT.kioskRotY + localRotY).toFixed(4),
  };
}

const _scooterMarkerWorld = kioskLocalToWorldPose(
  URBAN_SCOOTER_SHOP_LAYOUT.interactionMarkerLocal.x,
  URBAN_SCOOTER_SHOP_LAYOUT.interactionMarkerLocal.y,
  URBAN_SCOOTER_SHOP_LAYOUT.interactionMarkerLocal.z,
);

/**
 * World-space trigger & low 3D interaction triangle spec (`segitiga interaksi di bawah`)
 * right beside/in front of the Urban Scooter Showroom A-Frame sidewalk sign (`screenshot_13_e308ec4b.png`).
 */
export const URBAN_SCOOTER_SHOP_TRIGGER = {
  x: _scooterMarkerWorld.x, // -97.355
  z: _scooterMarkerWorld.z, // -4.574
  deckY: URBAN_SCOOTER_SHOP_LAYOUT.worldBaseY, // 2.50
  markerOffsetY: 0.38, // Low floating 3D triangle ~38cm above the plaza tiles
  triggerRadius: 3.45,
} as const;

export function evaluateUrbanScooterShopProximity(
  actorX: number,
  actorZ: number,
  radius: number = URBAN_SCOOTER_SHOP_TRIGGER.triggerRadius,
): { isNear: boolean; distanceM: number } {
  const distanceM = Math.hypot(
    actorX - URBAN_SCOOTER_SHOP_TRIGGER.x,
    actorZ - URBAN_SCOOTER_SHOP_TRIGGER.z,
  );
  return {
    isNear: distanceM <= radius,
    distanceM,
  };
}

/**
 * Computes wheel angular rotation delta (`radians`) for a forward travel distance (`meters`).
 */
export function computeScooterWheelSpinDeltaRad(
  kind: UrbanScooterKind,
  distanceDeltaM: number,
  worldScale = 1.0,
): number {
  const baseRadius =
    kind === 'electric_scooter_bike'
      ? ELECTRIC_SCOOTER_BIKE_SPEC.wheelOuterRadiusM
      : PUSH_KICK_SCOOTER_SPEC.wheelOuterRadiusM;
  const effectiveRadius = Math.max(0.02, baseRadius * worldScale);
  return distanceDeltaM / effectiveRadius;
}

/**
 * Builds synchronized static OBB colliders for the Central Plaza Urban Scooter Showroom
 * and its 2 non-rideable outdoor display scooters (`y = 2.50m` Plaza Deck).
 */
export function computeScooterShopWorldColliders(): StaticWorldStructureObb[] {
  const s = URBAN_SCOOTER_SHOP_LAYOUT.kioskScale;
  const signWorld = kioskLocalToWorldPose(
    URBAN_SCOOTER_SHOP_LAYOUT.aFrameSignLocal.x,
    URBAN_SCOOTER_SHOP_LAYOUT.aFrameSignLocal.y,
    URBAN_SCOOTER_SHOP_LAYOUT.aFrameSignLocal.z,
    URBAN_SCOOTER_SHOP_LAYOUT.aFrameSignLocal.rotY,
  );

  const colliders: StaticWorldStructureObb[] = [
    {
      id: 'lobby_scooter_kiosk_body',
      x: -100.55,
      z: -1.2,
      halfX: 2.62,
      halfZ: 3.30,
      rotY: 0,
      heightY: 6.9,
      mat: 'metal',
    },
    {
      id: 'lobby_scooter_kiosk_sign',
      x: +signWorld.x.toFixed(2),
      z: +signWorld.z.toFixed(2),
      halfX: 0.42,
      halfZ: 0.42,
      rotY: 0,
      heightY: 3.85,
      mat: 'wood',
    },
  ];

  for (const disp of URBAN_SCOOTER_SHOP_LAYOUT.frontStaticDisplays) {
    const pose = kioskLocalToWorldPose(disp.localX, disp.localY, disp.localZ, disp.localRotY);
    const worldScale = s * disp.localScale;
    const rawHalfX = disp.plinthHalfWidthLocal * s;
    const rawHalfZ = disp.plinthHalfLengthLocal * s;
    const topLocalM =
      disp.kind === 'electric_scooter_bike'
        ? ELECTRIC_SCOOTER_BIKE_SPEC.mirrorTopHeightM * worldScale
        : PUSH_KICK_SCOOTER_SPEC.tBarHeightM * worldScale;
    const heightY = +(URBAN_SCOOTER_SHOP_LAYOUT.worldBaseY + disp.plinthHeightLocal * s + topLocalM).toFixed(2);

    colliders.push({
      id: disp.id,
      x: +pose.x.toFixed(2),
      z: +pose.z.toFixed(2),
      halfX: +rawHalfX.toFixed(2),
      halfZ: +rawHalfZ.toFixed(2),
      rotY: +pose.rotY.toFixed(4),
      heightY,
      mat: 'metal',
    });
  }

  return colliders;
}
