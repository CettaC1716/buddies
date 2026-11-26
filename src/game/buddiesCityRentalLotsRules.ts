import type { IndividualCommanderBaseState } from './buddiesBlitzRules';
import { MODEL_ESTATE_BASE_PLOT_SPEC, isCommanderBasePlotActive } from './buddiesBlitzRules';

/**
 * ============================================================================
 * BUDDIES BLITZ — COMMERCIAL BLOCK LAYOUT, SHOP BUILDING SPECS & RENTAL LOTS
 * ============================================================================
 * Locked Owner Decisions (26 Nov):
 * - Sold item is the building's FORM, never a business type.
 * - Buildings are player-owned items placed on developer-owned rented land.
 *   Land is NEVER sold or deeded. Apartments/deeds are a separate layer.
 * - Lot geometry: 15.0m x 15.0m; building shell max 9.6m x 9.6m;
 *   front apron 3.9m, side margins 2.7m, rear margin 1.5m. Buildings never touch.
 * - Block layout: 4 blocks of 4 lots (16 total) between widened avenues
 *   (Roads 1, 3, 5 at x = -60, 0, +60 widened to 10.4m; divider Roads 2 & 4
 *   at x = -30, +30 closed). Inside each block, lots sit back-to-back on the
 *   block's center line (x = -30 or x = +30): 2 left lots face WEST, 2 right
 *   lots face EAST.
 */

export type CityRentalLotStatus = 'available' | 'rented' | 'grace' | 'freeing';

export type CityRentalLotSide = 'north' | 'south';
export type CityRentalLotRow = 'front' | 'rear';
export type CityRentalLotFacing = 'west' | 'east';
export type CommercialBlockId = 'block-nw' | 'block-ne' | 'block-sw' | 'block-se';

/**
 * The 3 purchasable Shop Building Forms — named strictly by architectural FORM.
 * Empty neutral interiors, blank default rooftop billboard.
 */
export type ShopBuildingFormId =
  | 'glass_corner_3story'
  | 'canopy_storefront_2story'
  | 'brick_rooftop_deck';

/** Legacy alias preserved for backward compatibility with older callers. */
export type StandardShopShellVariantId = ShopBuildingFormId;

export interface ShopBillboardMeshSpec {
  readonly meshName: 'rooftop_billboard_face';
  readonly materialName: 'rooftop_billboard_mat';
  readonly defaultColorHex: string;
  readonly aspectRatio: number;
  readonly textureWidthPx: number;
  readonly textureHeightPx: number;
}

export const SHOP_BILLBOARD_MESH_SPEC: ShopBillboardMeshSpec = {
  meshName: 'rooftop_billboard_face',
  materialName: 'rooftop_billboard_mat',
  defaultColorHex: '#e5e7eb',
  aspectRatio: 3.2,
  textureWidthPx: 1024,
  textureHeightPx: 320,
} as const;

export interface ShopBuildingFormSpec {
  id: ShopBuildingFormId;
  catalogItemId: string;
  tokenId: string;
  /** Working name strictly by architectural FORM (never a business type). */
  name: string;
  subtitle: string;
  stories: 2 | 3;
  footprintWidthM: number;
  footprintDepthM: number;
  heightM: number;
  /** Starting catalog price in RESPITE (super-admin editable in commercial config). */
  defaultPriceRespite: number;
  glbPath: string;
  renderImagePath: string;
  materialNotes: string;
  billboard: {
    widthM: number;
    heightM: number;
    centerYM: number;
    offsetFrontZM: number;
  };
  palette: {
    wallHex: string;
    trimHex: string;
    roofHex: string;
    accentHex: string;
  };
}

export const CITY_RENTAL_LOT_SIZE_M = {
  width: 15.0,
  depth: 15.0,
  halfWidth: 7.5,
  halfDepth: 7.5,
  areaSqM: 225.0,
} as const;

export const STANDARD_SHOP_FOOTPRINT_SPEC = {
  width: 9.6,
  depth: 9.6,
  halfWidth: 4.8,
  halfDepth: 4.8,
  areaSqM: 92.16,
  /** 92.16 / 225.0 = 0.4096 (40.96% <= 65% maximum coverage rule) */
  lotCoverageRatio: (9.6 * 9.6) / (15.0 * 15.0),
  maxAllowedCoverageRatio: 0.65,
  /**
   * Local Z offset along the lot's road-facing forward axis (+localZ = front toward avenue).
   * Shifting the 9.6m building center by -1.2m toward the rear leaves:
   * - Rear margin: 7.5 - (4.8 + 1.2) = 1.50m clear from block centerline
   * - Side margins (Left & Right): 7.5 - 4.8 = 2.70m clear on both sides
   * - Front apron inside lot: 7.5 - (4.8 - 1.2) = 3.90m clear forecourt facing the avenue
   */
  localDepthOffsetTowardRearM: -1.2,
  sideMarginM: 2.7,
  rearMarginM: 1.5,
  frontApronMarginM: 3.9,
  maxAwningProtrusionM: 0.85,
} as const;

/**
 * Commercial Block Avenue Geometry:
 * - Divider Roads 2 (x = -30) and 4 (x = +30) are CLOSED and become the block center lines.
 * - Avenues 1 (x = -60), 3 (x = 0), and 5 (x = +60) are WIDENED to 10.4m (half-width 5.2m).
 */
export const COMMERCIAL_AVENUE_SPEC = {
  widenedAvenueXs: [-60.0, 0.0, 60.0] as const,
  closedDividerRoadXs: [-30.0, 30.0] as const,
  /** Roadway half-width = 5.2m (10.4m asphalt roadway) */
  widenedHalfWidthM: 5.2,
  widenedFullWidthM: 10.4,
  /** Amendment 2: 2.0m sidewalks on both sides of each widened avenue (total cross-section = 14.4m) */
  sidewalkWidthM: 2.0,
  totalAvenueCrossSectionWidthM: 14.4,
  sidewalkInnerOffsetFromCenterM: 5.2,
  sidewalkOuterOffsetFromCenterM: 7.2,
  sidewalkCenterOffsetFromAvenueM: 6.2,
  /** Sidewalks run the full length of each commercial block and connect to crosswalks at block ends */
  sidewalkZRangeAbs: { minAbsZ: 56.0, maxAbsZ: 104.0 } as const,
  blockCenterXs: [-30.0, 30.0] as const,
  northRowZs: [-71.0, -89.0] as const,
  southRowZs: [71.0, 89.0] as const,
  blockZSpan: { minAbsZ: 52.0, maxAbsZ: 108.0 } as const,
} as const;

export interface CommercialSidewalkStripSpec {
  id: string;
  avenueX: number;
  sideOfAvenue: 'west' | 'east';
  centerX: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  widthM: number;
  lengthM: number;
  districtSide: 'north' | 'south';
}

export const COMMERCIAL_SIDEWALK_STRIPS: readonly CommercialSidewalkStripSpec[] = (() => {
  const strips: CommercialSidewalkStripSpec[] = [];
  const { widenedAvenueXs, sidewalkInnerOffsetFromCenterM, sidewalkOuterOffsetFromCenterM, sidewalkWidthM, sidewalkZRangeAbs } =
    COMMERCIAL_AVENUE_SPEC;
  const len = sidewalkZRangeAbs.maxAbsZ - sidewalkZRangeAbs.minAbsZ;
  for (const districtSide of ['north', 'south'] as const) {
    const minZ = districtSide === 'north' ? -sidewalkZRangeAbs.maxAbsZ : sidewalkZRangeAbs.minAbsZ;
    const maxZ = districtSide === 'north' ? -sidewalkZRangeAbs.minAbsZ : sidewalkZRangeAbs.maxAbsZ;
    for (const avenueX of widenedAvenueXs) {
      for (const sideOfAvenue of ['west', 'east'] as const) {
        // Only build sidewalks on sides that front a commercial block (x in [-60..+60])
        if (avenueX === -60 && sideOfAvenue === 'west') continue;
        if (avenueX === 60 && sideOfAvenue === 'east') continue;
        const sign = sideOfAvenue === 'east' ? 1 : -1;
        const a = avenueX + sign * sidewalkInnerOffsetFromCenterM;
        const b = avenueX + sign * sidewalkOuterOffsetFromCenterM;
        strips.push({
          id: `sidewalk_${districtSide}_${avenueX}_${sideOfAvenue}`,
          avenueX,
          sideOfAvenue,
          centerX: (a + b) * 0.5,
          minX: Math.min(a, b),
          maxX: Math.max(a, b),
          minZ,
          maxZ,
          widthM: sidewalkWidthM,
          lengthM: len,
          districtSide,
        });
      }
    }
  }
  return strips;
})();

export interface CommercialSidewalkWaypoint {
  x: number;
  z: number;
  sidewalkId: string;
}

/** Pedestrian patrol waypoints running cleanly down the center of each 2m commercial sidewalk. */
export const COMMERCIAL_SIDEWALK_PATROL_WAYPOINTS: readonly CommercialSidewalkWaypoint[] =
  COMMERCIAL_SIDEWALK_STRIPS.flatMap((strip) => [
    { x: strip.centerX, z: strip.minZ + 2.0, sidewalkId: strip.id },
    { x: strip.centerX, z: (strip.minZ + strip.maxZ) * 0.5, sidewalkId: strip.id },
    { x: strip.centerX, z: strip.maxZ - 2.0, sidewalkId: strip.id },
  ]);

export const SHOP_BUILDING_FORMS: Readonly<Record<ShopBuildingFormId, ShopBuildingFormSpec>> = {
  glass_corner_3story: {
    id: 'glass_corner_3story',
    catalogItemId: 'shop_glass_corner_3story',
    tokenId: 'nep245:shop_building:glass_corner_3story',
    name: 'Glass Corner 3-Story',
    subtitle: 'Three-story concrete and glass corner shell with steel-truss rooftop billboard',
    stories: 3,
    footprintWidthM: 9.2,
    footprintDepthM: 9.2,
    heightM: 11.4,
    defaultPriceRespite: 250,
    glbPath: '/assets/buildings/shop_glass_corner_3story.glb',
    renderImagePath: '/assets/buildings/renders/shop_glass_corner_3story.png',
    materialNotes:
      'Light warm architectural concrete frame, large multi-story corner display glazing, dark anodized steel mullions, rooftop HVAC/solar detail, and steel scaffolding frame holding the neutral blank billboard.',
    billboard: {
      widthM: 6.4,
      heightM: 2.0,
      centerYM: 9.5,
      offsetFrontZM: 4.55,
    },
    palette: {
      wallHex: '#e8e4dc',
      trimHex: '#2c323d',
      roofHex: '#525b68',
      accentHex: '#7dd3fc',
    },
  },
  canopy_storefront_2story: {
    id: 'canopy_storefront_2story',
    catalogItemId: 'shop_canopy_storefront_2story',
    tokenId: 'nep245:shop_building:canopy_storefront_2story',
    name: 'Canopy Storefront 2-Story',
    subtitle: 'Two-story limestone facade with dark metal wrap-around canopy and rooftop billboard',
    stories: 2,
    footprintWidthM: 9.2,
    footprintDepthM: 9.0,
    heightM: 8.6,
    defaultPriceRespite: 200,
    glbPath: '/assets/buildings/shop_canopy_storefront_2story.glb',
    renderImagePath: '/assets/buildings/renders/shop_canopy_storefront_2story.png',
    materialNotes:
      'Cream limestone stucco upper story with framed rectangular windows, dark charcoal steel & frosted-glass cantilevered storefront canopy, double glass entrance doors, and horizontal rooftop banner billboard.',
    billboard: {
      widthM: 5.8,
      heightM: 1.5,
      centerYM: 7.75,
      offsetFrontZM: 4.15,
    },
    palette: {
      wallHex: '#f2eadb',
      trimHex: '#252a34',
      roofHex: '#434a54',
      accentHex: '#93c5fd',
    },
  },
  brick_rooftop_deck: {
    id: 'brick_rooftop_deck',
    catalogItemId: 'shop_brick_rooftop_deck',
    tokenId: 'nep245:shop_building:brick_rooftop_deck',
    name: 'Brick Block with Rooftop Deck',
    subtitle: 'Two-story brick and concrete industrial shell with balcony, timber rooftop deck, and truss billboard',
    stories: 2,
    footprintWidthM: 9.2,
    footprintDepthM: 9.0,
    heightM: 9.2,
    defaultPriceRespite: 200,
    glbPath: '/assets/buildings/shop_brick_rooftop_deck.glb',
    renderImagePath: '/assets/buildings/renders/shop_brick_rooftop_deck.png',
    materialNotes:
      'Ground-floor brushed concrete with dark steel framing, red-brick upper story with multi-pane industrial windows and balcony balustrade, timber-planked rooftop deck with perimeter railing, and panoramic steel-truss rooftop billboard.',
    billboard: {
      widthM: 6.2,
      heightM: 1.8,
      centerYM: 8.2,
      offsetFrontZM: 4.15,
    },
    palette: {
      wallHex: '#a85742',
      trimHex: '#282c34',
      roofHex: '#c49a6c',
      accentHex: '#d6d0c4',
    },
  },
} as const;

export const SHOP_BUILDING_FORM_IDS: readonly ShopBuildingFormId[] = [
  'glass_corner_3story',
  'canopy_storefront_2story',
  'brick_rooftop_deck',
] as const;

export const STANDARD_SHOP_SHELL_VARIANTS = SHOP_BUILDING_FORMS;

/**
 * Shared Commercial Config (single backend source of truth, all fields editable by super admin).
 * Golden rule: a price change ONLY affects NEW rentals; active rentals lock their rate for the term.
 */
export interface CommercialSystemConfig {
  rentPriceRespite: number;
  rentTermDays: number;
  gracePeriodDays: number;
  /** Extension always adds `rentTermDays` from the current term expiry (never truncating remaining time). */
  extensionCountedFromExpiry: true;
  /** Short-lived validity window for server-signed rent price quotes (seconds). */
  quoteExpirySeconds: number;
  buildingPricesRespite: Record<ShopBuildingFormId, number>;
  updatedAtIso?: string;
  updatedByWallet?: string | null;
}

export const DEFAULT_COMMERCIAL_CONFIG: Readonly<CommercialSystemConfig> = {
  rentPriceRespite: 50,
  rentTermDays: 30,
  gracePeriodDays: 3,
  extensionCountedFromExpiry: true,
  quoteExpirySeconds: 300,
  buildingPricesRespite: {
    glass_corner_3story: 250,
    canopy_storefront_2story: 200,
    brick_rooftop_deck: 200,
  },
} as const;

export interface CityRentalLotSpec {
  /** Stable slot identifier ('lot-n-01'..'lot-n-08', 'lot-s-01'..'lot-s-08') */
  slotId: string;
  /** Short display code ('N-01'..'N-08', 'S-01'..'S-08') */
  shortCode: string;
  /** 0..15 index */
  index: number;
  /** Commercial 4-lot block identifier ('block-nw' | 'block-ne' | 'block-sw' | 'block-se') */
  blockId: CommercialBlockId;
  side: CityRentalLotSide;
  row: CityRentalLotRow;
  /** Cardinal avenue facing inside the block ('west' for left 2 lots, 'east' for right 2 lots) */
  facing: CityRentalLotFacing;
  /** 0..3 west-to-east column bay index */
  bayIndex: 0 | 1 | 2 | 3;
  /** World X center in meters (-37.5, -22.5, +22.5, +37.5) */
  x: number;
  /** World Z center in meters (-71.0, -89.0, +71.0, +89.0) */
  z: number;
  /** Lot width (X span) in meters = 15.0 */
  width: number;
  /** Lot depth (Z span) in meters = 15.0 */
  depth: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /**
   * Avenue-facing orientation yaw in radians so local +Z points toward the lot's avenue:
   * - facing === 'west' => local +Z points toward -World X (`-Math.PI / 2`)
   * - facing === 'east' => local +Z points toward +World X (`+Math.PI / 2`)
   */
  facingYaw: number;
  /** Unit normal vector (nx, nz) pointing from lot center toward the avenue */
  frontDirX: number;
  frontDirZ: number;
  /** Avenue reference ('West Avenue' | 'Central Avenue' | 'East Avenue') */
  facingRoadLabel: string;
  /** World X center of the widened avenue this lot faces (-60, 0, or +60) */
  facingAvenueX: number;
  /** Default showcase building form for fit preview */
  buildingVariantId: ShopBuildingFormId;
  /** Legacy bay team ('red' for north, 'blue' for south) and commander pad index (0..3) */
  legacyBayTeam: 'red' | 'blue';
  legacyBayIndex: 0 | 1 | 2 | 3;
}

const BLOCK_COLUMNS: ReadonlyArray<{
  bayIndex: 0 | 1 | 2 | 3;
  x: number;
  facing: CityRentalLotFacing;
  frontDirX: number;
  facingYaw: number;
  facingRoadLabel: string;
  facingAvenueX: number;
  blockSide: 'w' | 'e';
}> = [
  {
    bayIndex: 0,
    x: -37.5,
    facing: 'west',
    frontDirX: -1,
    facingYaw: -Math.PI / 2,
    facingRoadLabel: 'West Avenue',
    facingAvenueX: -60.0,
    blockSide: 'w',
  },
  {
    bayIndex: 1,
    x: -22.5,
    facing: 'east',
    frontDirX: 1,
    facingYaw: Math.PI / 2,
    facingRoadLabel: 'Central Avenue',
    facingAvenueX: 0.0,
    blockSide: 'w',
  },
  {
    bayIndex: 2,
    x: 22.5,
    facing: 'west',
    frontDirX: -1,
    facingYaw: -Math.PI / 2,
    facingRoadLabel: 'Central Avenue',
    facingAvenueX: 0.0,
    blockSide: 'e',
  },
  {
    bayIndex: 3,
    x: 37.5,
    facing: 'east',
    frontDirX: 1,
    facingYaw: Math.PI / 2,
    facingRoadLabel: 'East Avenue',
    facingAvenueX: 60.0,
    blockSide: 'e',
  },
];

function buildCityRentalLotsManifest(): readonly CityRentalLotSpec[] {
  const lots: CityRentalLotSpec[] = [];
  const w = CITY_RENTAL_LOT_SIZE_M.width;
  const d = CITY_RENTAL_LOT_SIZE_M.depth;
  const hw = CITY_RENTAL_LOT_SIZE_M.halfWidth;
  const hd = CITY_RENTAL_LOT_SIZE_M.halfDepth;

  let idx = 0;

  // 1. NORTH BLOCKS (block-nw & block-ne, 8 lots total: inner row z = -71.0, outer row z = -89.0)
  const northRows: ReadonlyArray<{ row: CityRentalLotRow; z: number }> = [
    { row: 'front', z: COMMERCIAL_AVENUE_SPEC.northRowZs[0] },
    { row: 'rear', z: COMMERCIAL_AVENUE_SPEC.northRowZs[1] },
  ];
  for (let rIdx = 0; rIdx < northRows.length; rIdx++) {
    const rSpec = northRows[rIdx];
    for (let bIdx = 0; bIdx < BLOCK_COLUMNS.length; bIdx++) {
      const col = BLOCK_COLUMNS[bIdx];
      const slotNum = rIdx * 4 + bIdx + 1;
      const variantId = SHOP_BUILDING_FORM_IDS[(slotNum - 1) % SHOP_BUILDING_FORM_IDS.length];
      const redCommanderIdx = (3 - bIdx) as 0 | 1 | 2 | 3;
      const blockId: CommercialBlockId = col.blockSide === 'w' ? 'block-nw' : 'block-ne';
      lots.push({
        slotId: `lot-n-0${slotNum}`,
        shortCode: `N-0${slotNum}`,
        index: idx++,
        blockId,
        side: 'north',
        row: rSpec.row,
        facing: col.facing,
        bayIndex: col.bayIndex,
        x: col.x,
        z: rSpec.z,
        width: w,
        depth: d,
        minX: col.x - hw,
        maxX: col.x + hw,
        minZ: rSpec.z - hd,
        maxZ: rSpec.z + hd,
        facingYaw: col.facingYaw,
        frontDirX: col.frontDirX,
        frontDirZ: 0,
        facingRoadLabel: col.facingRoadLabel,
        facingAvenueX: col.facingAvenueX,
        buildingVariantId: variantId,
        legacyBayTeam: 'red',
        legacyBayIndex: redCommanderIdx,
      });
    }
  }

  // 2. SOUTH BLOCKS (block-sw & block-se, 8 lots total: inner row z = +71.0, outer row z = +89.0)
  const southRows: ReadonlyArray<{ row: CityRentalLotRow; z: number }> = [
    { row: 'front', z: COMMERCIAL_AVENUE_SPEC.southRowZs[0] },
    { row: 'rear', z: COMMERCIAL_AVENUE_SPEC.southRowZs[1] },
  ];
  for (let rIdx = 0; rIdx < southRows.length; rIdx++) {
    const rSpec = southRows[rIdx];
    for (let bIdx = 0; bIdx < BLOCK_COLUMNS.length; bIdx++) {
      const col = BLOCK_COLUMNS[bIdx];
      const slotNum = rIdx * 4 + bIdx + 1;
      const variantId = SHOP_BUILDING_FORM_IDS[(slotNum + 1) % SHOP_BUILDING_FORM_IDS.length];
      const blockId: CommercialBlockId = col.blockSide === 'w' ? 'block-sw' : 'block-se';
      lots.push({
        slotId: `lot-s-0${slotNum}`,
        shortCode: `S-0${slotNum}`,
        index: idx++,
        blockId,
        side: 'south',
        row: rSpec.row,
        facing: col.facing,
        bayIndex: col.bayIndex,
        x: col.x,
        z: rSpec.z,
        width: w,
        depth: d,
        minX: col.x - hw,
        maxX: col.x + hw,
        minZ: rSpec.z - hd,
        maxZ: rSpec.z + hd,
        facingYaw: col.facingYaw,
        frontDirX: col.frontDirX,
        frontDirZ: 0,
        facingRoadLabel: col.facingRoadLabel,
        facingAvenueX: col.facingAvenueX,
        buildingVariantId: variantId,
        legacyBayTeam: 'blue',
        legacyBayIndex: col.bayIndex,
      });
    }
  }

  return lots;
}

export const CITY_RENTAL_LOTS: readonly CityRentalLotSpec[] = buildCityRentalLotsManifest();

export interface StandardShopPlacementBounds {
  slotId: string;
  variantId: ShopBuildingFormId;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  awningMinX: number;
  awningMaxX: number;
  awningMinZ: number;
  awningMaxZ: number;
  facingYaw: number;
  signboardWorldX: number;
  signboardWorldZ: number;
  signboardNormalX: number;
  signboardNormalZ: number;
  lotCoverageRatio: number;
  leftMarginM: number;
  rightMarginM: number;
  rearMarginM: number;
  frontApronMarginM: number;
  fitsStrictlyInsideLot: boolean;
}

/**
 * Computes the exact world-space bounding box, margins, and avenue-facing billboard alignment
 * when placing any of the 3 shop building forms on any of the 16 block rental lots.
 * Supports both East-West (block layout: frontDirX = ±1) and North-South facings.
 */
export function computeStandardShopPlacementForLot(
  lot: CityRentalLotSpec,
  overrideVariantId?: ShopBuildingFormId,
): StandardShopPlacementBounds {
  const variantId = overrideVariantId ?? lot.buildingVariantId;
  const variant = SHOP_BUILDING_FORMS[variantId];
  const shellW = STANDARD_SHOP_FOOTPRINT_SPEC.width;
  const shellD = STANDARD_SHOP_FOOTPRINT_SPEC.depth;

  const isEastWest = Math.abs(lot.frontDirX) >= Math.abs(lot.frontDirZ);
  // Along the lot's forward axis, shift building center toward the rear by -1.2m
  const shiftAlongFront = STANDARD_SHOP_FOOTPRINT_SPEC.localDepthOffsetTowardRearM;
  const centerX = lot.x + lot.frontDirX * shiftAlongFront;
  const centerZ = lot.z + lot.frontDirZ * shiftAlongFront;

  const halfWorldX = (isEastWest ? shellD : shellW) * 0.5;
  const halfWorldZ = (isEastWest ? shellW : shellD) * 0.5;

  const minX = centerX - halfWorldX;
  const maxX = centerX + halfWorldX;
  const minZ = centerZ - halfWorldZ;
  const maxZ = centerZ + halfWorldZ;

  const awningProtrusion = STANDARD_SHOP_FOOTPRINT_SPEC.maxAwningProtrusionM;
  let awningMinX = minX;
  let awningMaxX = maxX;
  let awningMinZ = minZ;
  let awningMaxZ = maxZ;
  let signboardWorldX = centerX;
  let signboardWorldZ = centerZ;
  let leftMarginM = 0;
  let rightMarginM = 0;
  let frontApronMarginM = 0;
  let rearMarginM = 0;
  let awningFrontClearanceM = 0;

  if (isEastWest) {
    const frontFacadeX = centerX + lot.frontDirX * halfWorldX;
    const rearFacadeX = centerX - lot.frontDirX * halfWorldX;
    const frontBorderX = lot.x + lot.frontDirX * (lot.width * 0.5);
    const rearBorderX = lot.x - lot.frontDirX * (lot.width * 0.5);
    const awningEdgeX = frontFacadeX + lot.frontDirX * awningProtrusion;
    awningMinX = Math.min(minX, awningEdgeX);
    awningMaxX = Math.max(maxX, awningEdgeX);
    signboardWorldX = frontFacadeX + lot.frontDirX * 0.08;
    signboardWorldZ = centerZ;
    leftMarginM = +(minZ - lot.minZ).toFixed(3);
    rightMarginM = +(lot.maxZ - maxZ).toFixed(3);
    frontApronMarginM = +Math.abs(frontBorderX - frontFacadeX).toFixed(3);
    rearMarginM = +Math.abs(rearFacadeX - rearBorderX).toFixed(3);
    awningFrontClearanceM = +Math.abs(frontBorderX - awningEdgeX).toFixed(3);
  } else {
    const frontFacadeZ = centerZ + lot.frontDirZ * halfWorldZ;
    const rearFacadeZ = centerZ - lot.frontDirZ * halfWorldZ;
    const frontBorderZ = lot.z + lot.frontDirZ * (lot.depth * 0.5);
    const rearBorderZ = lot.z - lot.frontDirZ * (lot.depth * 0.5);
    const awningEdgeZ = frontFacadeZ + lot.frontDirZ * awningProtrusion;
    awningMinZ = Math.min(minZ, awningEdgeZ);
    awningMaxZ = Math.max(maxZ, awningEdgeZ);
    signboardWorldX = centerX;
    signboardWorldZ = frontFacadeZ + lot.frontDirZ * 0.08;
    leftMarginM = +(minX - lot.minX).toFixed(3);
    rightMarginM = +(lot.maxX - maxX).toFixed(3);
    frontApronMarginM = +Math.abs(frontBorderZ - frontFacadeZ).toFixed(3);
    rearMarginM = +Math.abs(rearFacadeZ - rearBorderZ).toFixed(3);
    awningFrontClearanceM = +Math.abs(frontBorderZ - awningEdgeZ).toFixed(3);
  }

  const lotCoverageRatio =
    (variant.footprintWidthM * variant.footprintDepthM) / (lot.width * lot.depth);
  const fitsStrictlyInsideLot =
    variant.footprintWidthM <= STANDARD_SHOP_FOOTPRINT_SPEC.width &&
    variant.footprintDepthM <= STANDARD_SHOP_FOOTPRINT_SPEC.depth &&
    lotCoverageRatio <= STANDARD_SHOP_FOOTPRINT_SPEC.maxAllowedCoverageRatio &&
    leftMarginM >= 2.5 &&
    rightMarginM >= 2.5 &&
    rearMarginM >= 1.4 &&
    frontApronMarginM >= 3.8 &&
    awningFrontClearanceM >= 2.5 &&
    awningMinX > lot.minX &&
    awningMaxX < lot.maxX &&
    awningMinZ > lot.minZ &&
    awningMaxZ < lot.maxZ;

  return {
    slotId: lot.slotId,
    variantId,
    centerX,
    centerZ,
    width: variant.footprintWidthM,
    depth: variant.footprintDepthM,
    minX,
    maxX,
    minZ,
    maxZ,
    awningMinX,
    awningMaxX,
    awningMinZ,
    awningMaxZ,
    facingYaw: lot.facingYaw,
    signboardWorldX,
    signboardWorldZ,
    signboardNormalX: lot.frontDirX,
    signboardNormalZ: lot.frontDirZ,
    lotCoverageRatio,
    leftMarginM,
    rightMarginM,
    rearMarginM,
    frontApronMarginM,
    fitsStrictlyInsideLot,
  };
}

export interface CityRentalLotConflictReport {
  slotId: string;
  hasConflict: boolean;
  conflictKind: 'none' | 'legacy_model_estate' | 'legacy_claimed_house';
  conflictSourceId: string | null;
  description: string | null;
}

/**
 * Derives suppression strictly from real world-space AABB overlap against the
 * pre-existing Model Estate (`blue_0` at `(-45.0, 81.7)`, `19.6m x 35.0m`) or
 * any actively claimed legacy house plot.
 */
export function evaluateCityRentalLotConflict(
  lot: CityRentalLotSpec,
  blueCommanderBases?: ReadonlyArray<IndividualCommanderBaseState>,
  redCommanderBases?: ReadonlyArray<IndividualCommanderBaseState>,
): CityRentalLotConflictReport {
  const MODEL_ESTATE_WIDTH = 19.6;
  const MODEL_ESTATE_DEPTH = 35.0;
  const modelMinX = MODEL_ESTATE_BASE_PLOT_SPEC.plotCenterX - MODEL_ESTATE_WIDTH * 0.5;
  const modelMaxX = MODEL_ESTATE_BASE_PLOT_SPEC.plotCenterX + MODEL_ESTATE_WIDTH * 0.5;
  const modelMinZ = MODEL_ESTATE_BASE_PLOT_SPEC.plotCenterZ - MODEL_ESTATE_DEPTH * 0.5;
  const modelMaxZ = MODEL_ESTATE_BASE_PLOT_SPEC.plotCenterZ + MODEL_ESTATE_DEPTH * 0.5;

  const overlapsModelEstate =
    lot.maxX > modelMinX &&
    lot.minX < modelMaxX &&
    lot.maxZ > modelMinZ &&
    lot.minZ < modelMaxZ;

  if (overlapsModelEstate) {
    return {
      slotId: lot.slotId,
      hasConflict: true,
      conflictKind: 'legacy_model_estate',
      conflictSourceId: 'blue_0',
      description:
        'Overlaps pre-existing South-West Model Estate showcase (blue_0 at [-54.8..-35.2, 64.2..99.2]); legacy Model Estate visuals preserved untouched.',
    };
  }

  const checkPlotOverlap = (
    plots: ReadonlyArray<IndividualCommanderBaseState> | undefined,
    teamLabel: 'blue' | 'red',
  ): CityRentalLotConflictReport | null => {
    if (!plots) return null;
    const plotHalfW = 10.5;
    const plotHalfD = 17.0;
    for (let i = 0; i < plots.length; i++) {
      const p = plots[i];
      if (!p || !isCommanderBasePlotActive(p)) continue;
      const pMinX = p.plotCenterX - plotHalfW;
      const pMaxX = p.plotCenterX + plotHalfW;
      const pMinZ = p.plotCenterZ - plotHalfD;
      const pMaxZ = p.plotCenterZ + plotHalfD;
      if (lot.maxX > pMinX && lot.minX < pMaxX && lot.maxZ > pMinZ && lot.minZ < pMaxZ) {
        return {
          slotId: lot.slotId,
          hasConflict: true,
          conflictKind: 'legacy_claimed_house',
          conflictSourceId: `${teamLabel}_${i}`,
          description: `Overlaps active legacy house plot ${teamLabel}_${i}; legacy plot visuals preserved.`,
        };
      }
    }
    return null;
  };

  const blueConflict = checkPlotOverlap(blueCommanderBases, 'blue');
  if (blueConflict) return blueConflict;
  const redConflict = checkPlotOverlap(redCommanderBases, 'red');
  if (redConflict) return redConflict;

  return {
    slotId: lot.slotId,
    hasConflict: false,
    conflictKind: 'none',
    conflictSourceId: null,
    description: null,
  };
}

export interface CityRentalLotResolvedState {
  spec: CityRentalLotSpec;
  status: CityRentalLotStatus;
  conflict: CityRentalLotConflictReport;
  /** True when the 3D rental lot boundary & selection marker are rendered in the world */
  isVisibleInWorld: boolean;
  /** True when a placed shop building should stand on this lot */
  showShopBuilding: boolean;
  placedBuildingFormId: ShopBuildingFormId | null;
}

export function resolveCityRentalLotsState(params: {
  blueCommanderBases?: ReadonlyArray<IndividualCommanderBaseState>;
  redCommanderBases?: ReadonlyArray<IndividualCommanderBaseState>;
  rentedSlotIds?: ReadonlySet<string> | ReadonlyArray<string>;
  lotStatusBySlotId?: Readonly<Record<string, CityRentalLotStatus>>;
  placedBuildingBySlotId?: Readonly<Record<string, ShopBuildingFormId | null | undefined>>;
  previewAllBuildingsFit?: boolean;
}): CityRentalLotResolvedState[] {
  const rentedSet =
    params.rentedSlotIds instanceof Set
      ? params.rentedSlotIds
      : Array.isArray(params.rentedSlotIds)
        ? new Set(params.rentedSlotIds)
        : null;

  return CITY_RENTAL_LOTS.map((spec) => {
    const conflict = evaluateCityRentalLotConflict(
      spec,
      params.blueCommanderBases,
      params.redCommanderBases,
    );
    const explicitStatus = params.lotStatusBySlotId?.[spec.slotId];
    const isRented = Boolean(rentedSet && rentedSet.has(spec.slotId));
    const status: CityRentalLotStatus = explicitStatus ?? (isRented ? 'rented' : 'available');
    const isVisibleInWorld = !conflict.hasConflict;
    const placedForm = params.placedBuildingBySlotId?.[spec.slotId] ?? null;
    const hasActiveLease = status === 'rented' || status === 'grace';
    const showShopBuilding =
      isVisibleInWorld &&
      ((hasActiveLease && Boolean(placedForm)) || Boolean(params.previewAllBuildingsFit));

    return {
      spec,
      status,
      conflict,
      isVisibleInWorld,
      showShopBuilding,
      placedBuildingFormId: placedForm ?? (params.previewAllBuildingsFit ? spec.buildingVariantId : null),
    };
  });
}

export function pickCityRentalLotAtWorldPoint(
  worldX: number,
  worldZ: number,
  options?: {
    includeConflicting?: boolean;
    blueCommanderBases?: ReadonlyArray<IndividualCommanderBaseState>;
    redCommanderBases?: ReadonlyArray<IndividualCommanderBaseState>;
    paddingM?: number;
  },
): CityRentalLotSpec | null {
  const pad = options?.paddingM ?? 0;
  for (let i = 0; i < CITY_RENTAL_LOTS.length; i++) {
    const lot = CITY_RENTAL_LOTS[i];
    if (
      worldX >= lot.minX - pad &&
      worldX <= lot.maxX + pad &&
      worldZ >= lot.minZ - pad &&
      worldZ <= lot.maxZ + pad
    ) {
      if (!options?.includeConflicting) {
        const conflict = evaluateCityRentalLotConflict(
          lot,
          options?.blueCommanderBases,
          options?.redCommanderBases,
        );
        if (conflict.hasConflict) {
          return null;
        }
      }
      return lot;
    }
  }
  return null;
}

export function getCityRentalLotById(slotId: string | null | undefined): CityRentalLotSpec | null {
  if (!slotId) return null;
  return CITY_RENTAL_LOTS.find((l) => l.slotId === slotId) ?? null;
}
