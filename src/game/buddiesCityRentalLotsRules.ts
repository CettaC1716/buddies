import type { IndividualCommanderBaseState } from './buddiesBlitzRules';
import { MODEL_ESTATE_BASE_PLOT_SPEC, isCommanderBasePlotActive } from './buddiesBlitzRules';

/**
 * Rental Lot Status — strictly binary ('available' | 'rented').
 * Rental lots are developer-owned rental land and are NEVER sold or deeded.
 * Rental timing, pricing, and expiry are handled on the backend and must not be invented here.
 */
export type CityRentalLotStatus = 'available' | 'rented';

export type CityRentalLotSide = 'north' | 'south';
export type CityRentalLotRow = 'front' | 'rear';

/**
 * Standard Shop Building Visual Variants reused across the 16 rental lots.
 * Players buy a shop building in the catalog as an item they own, then rent a lot
 * to stand it on. All variants share the standardized compact footprint (9.6m x 9.6m)
 * fitting comfortably inside every 15.0m x 15.0m rental lot (40.96% <= 65% cap).
 */
export type StandardShopShellVariantId = 'timber_atelier' | 'brick_corner' | 'modern_gallery';

export interface StandardShopShellVariantSpec {
  id: StandardShopShellVariantId;
  label: string;
  subtitle: string;
  footprintWidth: number;
  footprintDepth: number;
  roofHeight: number;
  signboardWidth: number;
  signboardHeight: number;
  signboardCenterY: number;
  wallColorHex: string;
  trimColorHex: string;
  roofColorHex: string;
  awningColorHex: string;
  signBgHex: string;
  signAccentHex: string;
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
   * Local Z offset along the lot's road-facing forward axis (+localZ = front toward road).
   * Shifting the 9.6m building center by -1.2m toward the rear leaves:
   * - Rear margin: 7.5 - (4.8 + 1.2) = 1.50m clear from rear lot border
   * - Side margins (Left & Right): 7.5 - 4.8 = 2.70m clear on both sides
   * - Front apron inside lot: 7.5 - (4.8 - 1.2) = 3.90m clear forecourt facing the road
   */
  localDepthOffsetTowardRearM: -1.2,
  sideMarginM: 2.7,
  rearMarginM: 1.5,
  frontApronMarginM: 3.9,
  maxAwningProtrusionM: 0.85,
} as const;

export const STANDARD_SHOP_SHELL_VARIANTS: Readonly<
  Record<StandardShopShellVariantId, StandardShopShellVariantSpec>
> = {
  timber_atelier: {
    id: 'timber_atelier',
    label: 'Variant A · Timber Awning Atelier',
    subtitle: 'Warm cedar storefront with striped canvas awning & illuminated fascia signboard',
    footprintWidth: STANDARD_SHOP_FOOTPRINT_SPEC.width,
    footprintDepth: STANDARD_SHOP_FOOTPRINT_SPEC.depth,
    roofHeight: 5.5,
    signboardWidth: 6.4,
    signboardHeight: 1.05,
    signboardCenterY: 4.18,
    wallColorHex: '#f6efe2',
    trimColorHex: '#6d4528',
    roofColorHex: '#3b4252',
    awningColorHex: '#d9534f',
    signBgHex: '#18202c',
    signAccentHex: '#facc15',
  },
  brick_corner: {
    id: 'brick_corner',
    label: 'Variant B · Heritage Brick Showroom',
    subtitle: 'Warm terracotta masonry showroom with arched display windows & brass signboard',
    footprintWidth: STANDARD_SHOP_FOOTPRINT_SPEC.width,
    footprintDepth: STANDARD_SHOP_FOOTPRINT_SPEC.depth,
    roofHeight: 5.8,
    signboardWidth: 6.6,
    signboardHeight: 1.08,
    signboardCenterY: 4.28,
    wallColorHex: '#b85a3a',
    trimColorHex: '#2b303c',
    roofColorHex: '#272b35',
    awningColorHex: '#1f6f54',
    signBgHex: '#17252a',
    signAccentHex: '#b8ff3c',
  },
  modern_gallery: {
    id: 'modern_gallery',
    label: 'Variant C · Modern Studio Gallery',
    subtitle: 'Architectural limestone & charcoal studio with panoramic glass & skyline signboard',
    footprintWidth: STANDARD_SHOP_FOOTPRINT_SPEC.width,
    footprintDepth: STANDARD_SHOP_FOOTPRINT_SPEC.depth,
    roofHeight: 5.6,
    signboardWidth: 6.8,
    signboardHeight: 1.1,
    signboardCenterY: 4.24,
    wallColorHex: '#ebe7df',
    trimColorHex: '#1f2430',
    roofColorHex: '#1c202b',
    awningColorHex: '#2563eb',
    signBgHex: '#0f172a',
    signAccentHex: '#38bdf8',
  },
} as const;

export interface CityRentalLotSpec {
  /** Stable slot identifier ('lot-n-01'..'lot-n-08', 'lot-s-01'..'lot-s-08') */
  slotId: string;
  /** Short display code ('N-01'..'N-08', 'S-01'..'S-08') */
  shortCode: string;
  /** 0..15 index */
  index: number;
  side: CityRentalLotSide;
  row: CityRentalLotRow;
  /** 0..3 west-to-east column bay index */
  bayIndex: 0 | 1 | 2 | 3;
  /** World X center in meters (-45, -15, +15, +45) */
  x: number;
  /** World Z center in meters (-69.5, -95.0, +69.5, +95.0) */
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
   * Road-facing orientation yaw in radians so local +Z faces the nearest E-W road:
   * - yaw = 0       => local +Z points toward +World Z (South)
   * - yaw = Math.PI => local +Z points toward -World Z (North)
   */
  facingYaw: number;
  /** Unit normal vector (nx, nz) pointing from lot center toward the nearest road */
  frontDirX: number;
  frontDirZ: number;
  /** Nearest road name for clear UI orientation */
  facingRoadLabel: string;
  /** Standard shop building variant assigned to this lot */
  buildingVariantId: StandardShopShellVariantId;
  /** Legacy bay team ('red' for north, 'blue' for south) and commander pad index (0..3) */
  legacyBayTeam: 'red' | 'blue';
  legacyBayIndex: 0 | 1 | 2 | 3;
}

const BAY_CENTERS_X: readonly [number, number, number, number] = [-45.0, -15.0, 15.0, 45.0];
const VARIANT_CYCLE: readonly StandardShopShellVariantId[] = [
  'timber_atelier',
  'brick_corner',
  'modern_gallery',
];

function buildCityRentalLotsManifest(): readonly CityRentalLotSpec[] {
  const lots: CityRentalLotSpec[] = [];
  const w = CITY_RENTAL_LOT_SIZE_M.width;
  const d = CITY_RENTAL_LOT_SIZE_M.depth;
  const hw = CITY_RENTAL_LOT_SIZE_M.halfWidth;
  const hd = CITY_RENTAL_LOT_SIZE_M.halfDepth;

  // 1. NORTH SIDE (8 lots: 4 front row at z = -69.5 facing Outer Tram Ring Road at z = -52,
  //    4 rear row at z = -95.0 facing North Collector Road at z = -108)
  const northRows: ReadonlyArray<{
    row: CityRentalLotRow;
    z: number;
    facingYaw: number;
    frontDirZ: number;
    facingRoadLabel: string;
  }> = [
    {
      row: 'front',
      z: -69.5,
      facingYaw: 0, // local +Z faces +World Z toward z = -52 Outer Tram Ring Road
      frontDirZ: 1,
      facingRoadLabel: 'North Tram Ring Road',
    },
    {
      row: 'rear',
      z: -95.0,
      facingYaw: Math.PI, // local +Z faces -World Z toward z = -108 North Collector Road
      frontDirZ: -1,
      facingRoadLabel: 'North Promenade Road',
    },
  ];

  let idx = 0;
  for (let rIdx = 0; rIdx < northRows.length; rIdx++) {
    const rSpec = northRows[rIdx];
    for (let bIdx = 0; bIdx < 4; bIdx++) {
      const slotNum = rIdx * 4 + bIdx + 1;
      const cx = BAY_CENTERS_X[bIdx];
      const cz = rSpec.z;
      const variantId = VARIANT_CYCLE[(slotNum - 1) % VARIANT_CYCLE.length];
      // Note: redBase at hqZ = -86 has sign = -1, so plotOffsetsX [-45, -15, 15, 45] map to world X [+45, +15, -15, -45]
      const redCommanderIdx = (3 - bIdx) as 0 | 1 | 2 | 3;
      lots.push({
        slotId: `lot-n-0${slotNum}`,
        shortCode: `N-0${slotNum}`,
        index: idx++,
        side: 'north',
        row: rSpec.row,
        bayIndex: bIdx as 0 | 1 | 2 | 3,
        x: cx,
        z: cz,
        width: w,
        depth: d,
        minX: cx - hw,
        maxX: cx + hw,
        minZ: cz - hd,
        maxZ: cz + hd,
        facingYaw: rSpec.facingYaw,
        frontDirX: 0,
        frontDirZ: rSpec.frontDirZ,
        facingRoadLabel: rSpec.facingRoadLabel,
        buildingVariantId: variantId,
        legacyBayTeam: 'red',
        legacyBayIndex: redCommanderIdx,
      });
    }
  }

  // 2. SOUTH SIDE (8 lots: 4 front row at z = +69.5 facing Outer Tram Ring Road at z = +52,
  //    4 rear row at z = +95.0 facing South Collector Road at z = +108)
  const southRows: ReadonlyArray<{
    row: CityRentalLotRow;
    z: number;
    facingYaw: number;
    frontDirZ: number;
    facingRoadLabel: string;
  }> = [
    {
      row: 'front',
      z: 69.5,
      facingYaw: Math.PI, // local +Z faces -World Z toward z = +52 Outer Tram Ring Road
      frontDirZ: -1,
      facingRoadLabel: 'South Tram Ring Road',
    },
    {
      row: 'rear',
      z: 95.0,
      facingYaw: 0, // local +Z faces +World Z toward z = +108 South Collector Road
      frontDirZ: 1,
      facingRoadLabel: 'South Promenade Road',
    },
  ];

  for (let rIdx = 0; rIdx < southRows.length; rIdx++) {
    const rSpec = southRows[rIdx];
    for (let bIdx = 0; bIdx < 4; bIdx++) {
      const slotNum = rIdx * 4 + bIdx + 1;
      const cx = BAY_CENTERS_X[bIdx];
      const cz = rSpec.z;
      const variantId = VARIANT_CYCLE[(slotNum + 1) % VARIANT_CYCLE.length];
      lots.push({
        slotId: `lot-s-0${slotNum}`,
        shortCode: `S-0${slotNum}`,
        index: idx++,
        side: 'south',
        row: rSpec.row,
        bayIndex: bIdx as 0 | 1 | 2 | 3,
        x: cx,
        z: cz,
        width: w,
        depth: d,
        minX: cx - hw,
        maxX: cx + hw,
        minZ: cz - hd,
        maxZ: cz + hd,
        facingYaw: rSpec.facingYaw,
        frontDirX: 0,
        frontDirZ: rSpec.frontDirZ,
        facingRoadLabel: rSpec.facingRoadLabel,
        buildingVariantId: variantId,
        legacyBayTeam: 'blue',
        legacyBayIndex: bIdx as 0 | 1 | 2 | 3,
      });
    }
  }

  return lots;
}

export const CITY_RENTAL_LOTS: readonly CityRentalLotSpec[] = buildCityRentalLotsManifest();

export interface StandardShopPlacementBounds {
  slotId: string;
  variantId: StandardShopShellVariantId;
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
 * Computes the exact world-space bounding box, margins, and road-facing signboard alignment
 * when placing a standard shop building shell on any of the 16 rental lots.
 */
export function computeStandardShopPlacementForLot(
  lot: CityRentalLotSpec,
  overrideVariantId?: StandardShopShellVariantId,
): StandardShopPlacementBounds {
  const variantId = overrideVariantId ?? lot.buildingVariantId;
  const variant = STANDARD_SHOP_SHELL_VARIANTS[variantId];
  const hw = variant.footprintWidth * 0.5;
  const hd = variant.footprintDepth * 0.5;

  // Local +Z points along (lot.frontDirX, lot.frontDirZ)
  const shiftAlongFront = STANDARD_SHOP_FOOTPRINT_SPEC.localDepthOffsetTowardRearM;
  const centerX = lot.x + lot.frontDirX * shiftAlongFront;
  const centerZ = lot.z + lot.frontDirZ * shiftAlongFront;

  const minX = centerX - hw;
  const maxX = centerX + hw;
  const minZ = centerZ - hd;
  const maxZ = centerZ + hd;

  // Front awning protrudes at most 0.85m from the front facade toward the road
  const awningProtrusion = STANDARD_SHOP_FOOTPRINT_SPEC.maxAwningProtrusionM;
  const frontFacadeZ = centerZ + lot.frontDirZ * hd;
  const awningEdgeZ = frontFacadeZ + lot.frontDirZ * awningProtrusion;
  const awningMinZ = Math.min(minZ, awningEdgeZ);
  const awningMaxZ = Math.max(maxZ, awningEdgeZ);

  const signboardWorldX = centerX;
  const signboardWorldZ = frontFacadeZ + lot.frontDirZ * 0.08;

  const leftMarginM = +(minX - lot.minX).toFixed(3);
  const rightMarginM = +(lot.maxX - maxX).toFixed(3);
  const frontBorderZ = lot.z + lot.frontDirZ * (lot.depth * 0.5);
  const rearBorderZ = lot.z - lot.frontDirZ * (lot.depth * 0.5);
  const rearFacadeZ = centerZ - lot.frontDirZ * hd;

  const frontApronMarginM = +Math.abs(frontBorderZ - frontFacadeZ).toFixed(3);
  const rearMarginM = +Math.abs(rearFacadeZ - rearBorderZ).toFixed(3);
  const awningFrontClearanceM = +Math.abs(frontBorderZ - awningEdgeZ).toFixed(3);

  const lotCoverageRatio = (variant.footprintWidth * variant.footprintDepth) / (lot.width * lot.depth);
  const fitsStrictlyInsideLot =
    lotCoverageRatio <= STANDARD_SHOP_FOOTPRINT_SPEC.maxAllowedCoverageRatio &&
    leftMarginM >= 0.5 &&
    rightMarginM >= 0.5 &&
    rearMarginM >= 0.5 &&
    frontApronMarginM >= 2.0 &&
    awningFrontClearanceM >= 0.5 &&
    minX > lot.minX &&
    maxX < lot.maxX &&
    awningMinZ > lot.minZ &&
    awningMaxZ < lot.maxZ;

  return {
    slotId: lot.slotId,
    variantId,
    centerX,
    centerZ,
    width: variant.footprintWidth,
    depth: variant.footprintDepth,
    minX,
    maxX,
    minZ,
    maxZ,
    awningMinX: minX,
    awningMaxX: maxX,
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
 * Checks whether a rental lot overlaps the pre-existing out-of-scope House/Deed Model Estate
 * (`blue_0` at `(-45.0, 81.7)`, `19.6m x 35.0m`) or an actively claimed legacy house plot.
 * When a conflict exists, the rental lot system preserves the older system's visuals untouched
 * and suppresses overlapping 3D rental lot markers/meshes in that bay.
 */
export function evaluateCityRentalLotConflict(
  lot: CityRentalLotSpec,
  blueCommanderBases?: ReadonlyArray<IndividualCommanderBaseState>,
  redCommanderBases?: ReadonlyArray<IndividualCommanderBaseState>,
): CityRentalLotConflictReport {
  // 1. Check permanent out-of-scope Model Estate (South-West bay: blue_0 at x=-45, z=81.7, 19.6m x 35m)
  // Model Estate plot interior is 19.6m wide x 35.0m deep (matches the granite
  // border curb framing in buddiesBlitzShadersAndAssets).
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

  // 2. Check if an older house/deed plot is actively claimed in this bay during the session
  const bayList = lot.legacyBayTeam === 'blue' ? blueCommanderBases : redCommanderBases;
  const legacyPlot = bayList?.[lot.legacyBayIndex];
  if (legacyPlot && isCommanderBasePlotActive(legacyPlot)) {
    return {
      slotId: lot.slotId,
      hasConflict: true,
      conflictKind: 'legacy_claimed_house',
      conflictSourceId: `${lot.legacyBayTeam}_${lot.legacyBayIndex}`,
      description: `Overlaps active legacy house plot ${lot.legacyBayTeam}_${lot.legacyBayIndex}; legacy plot visuals preserved.`,
    };
  }

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
  /** Strictly 'available' | 'rented' — no price, expiry, or deed fields */
  status: CityRentalLotStatus;
  conflict: CityRentalLotConflictReport;
  /** True when the 3D rental lot boundary & selection marker are rendered in the world */
  isVisibleInWorld: boolean;
  /** True when a rented shop building shell should stand on this lot */
  showShopBuilding: boolean;
}

/**
 * Derives each rental lot's display state strictly from existing session state
 * without introducing any new local ownership or rental source of truth.
 * Resting state for every unrented lot is EMPTY LAND (`status: 'available'`, `showShopBuilding: false`).
 */
export function resolveCityRentalLotsState(params: {
  blueCommanderBases?: ReadonlyArray<IndividualCommanderBaseState>;
  redCommanderBases?: ReadonlyArray<IndividualCommanderBaseState>;
  rentedSlotIds?: ReadonlySet<string> | ReadonlyArray<string>;
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
    const isRented = Boolean(rentedSet && rentedSet.has(spec.slotId));
    const status: CityRentalLotStatus = isRented ? 'rented' : 'available';
    const isVisibleInWorld = !conflict.hasConflict;
    const showShopBuilding =
      isVisibleInWorld && (status === 'rented' || Boolean(params.previewAllBuildingsFit));

    return {
      spec,
      status,
      conflict,
      isVisibleInWorld,
      showShopBuilding,
    };
  });
}

/**
 * Hit-tests a world (x, z) ground coordinate against the 16 rental lots.
 * Skips any lot that is currently hidden due to a legacy Model Estate / house conflict.
 */
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
