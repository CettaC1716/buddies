import type { StaticWorldStructureObb } from './buddiesBlitzTypes';

export interface BeachClubRect {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface BeachClubCascadePoolSpec extends BeachClubRect {
  waterY: number;
  deckY: number;
  floorY: number;
}

export interface BeachClubOrientedRect {
  id: string;
  cx: number;
  cz: number;
  halfX: number;
  halfZ: number;
  rotY: number;
  waterY?: number;
  deckY?: number;
}

export interface BeachClubTerraceTierSpec {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  elevY: number;
  label: string;
}

export interface BeachClubStairFlightSpec {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Axis along which the stairs descend ('x' = West->East unless reversed, 'z' = North->South) */
  axis: 'x' | 'z';
  fromElevY: number;
  toElevY: number;
  steps: number;
}

export interface BeachClubCabanaSpec {
  id: string;
  cx: number;
  cz: number;
  rotY: number;
  plinthHalfX: number;
  plinthHalfZ: number;
  plinthTopY: number;
  hasLoungerPair: boolean;
}

export interface BeachClubSunkenPodSpec {
  id: string;
  poolId: 'south_sea_pool' | 'south_inner_pool';
  cx: number;
  cz: number;
  rotY: number;
  sizeM: number;
  waterY: number;
}

export interface BeachClubBeachSetSpec {
  id: string;
  cx: number;
  cz: number;
  rotY: number;
  elevY: number;
  variant: 'poolside_turquoise' | 'sand_woven';
  hasSecondLounger: boolean;
}

export interface BeachClubFestoonSpanSpec {
  id: string;
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  sagM: number;
  bulbCount: number;
}

export interface BeachClubPalmSpec {
  id: string;
  x: number;
  z: number;
  baseY: number;
  scale: number;
  leanX: number;
  leanZ: number;
  rotY: number;
}

export const BEACH_CLUB_Z_MIN = -98.0;
export const BEACH_CLUB_Z_MAX = 46.2;

/**
 * Shared 1:1 multi-tiered stepped masterplan for the Finns-style East Coast Tropical Beach Club
 * seamlessly joining Kai's SE Beachfront Boardwalk (+0.82m at z = +46.2) and cascading
 * across 6 distinct architectural contour levels from Land (+0.82m / +1.36m North Crown)
 * down to the Oceanfront Infinity Lagoon (+0.26m) and Golden Sunset Beach Sand (0.0m).
 */
export const BEACH_CLUB_MASTERPLAN = {
  // 1. Ground-Level Wave-Striped Palm Promenade (+0.02m flush with roadside ground 0.0m, stepping up to Kai's boardwalk at z=43.8..46.2)
  promenade: {
    minX: 78.35,
    maxX: 91.2,
    minZ: -96.5,
    maxZ: 46.2,
    elevY: 0.02,
  },

  // 2. Stepped Architectural Terrace Tiers (Land-to-Sea & North-to-South descending contours:
  //    Ground-Level Promenade +0.02m -> Upper VIP Mezzanine +0.64m -> Box 1 Mid Lagoon -0.56m -> Box 1 Oceanfront Infinity Lagoon -1.00m -> Box 2 Beach Sand -2.00m)
  terraceTiers: [
    // North Arrival Upper Courtyard (+0.82m / +0.64m on West) & 3 Stepped North Cascade Terraces (+0.36m -> +0.06m -> -0.22m in Box 1)
    { id: 'tier_north_west_upper', minX: 91.2, maxX: 99.6, minZ: -96.2, maxZ: -89.0, elevY: 0.82, label: 'North Arrival Courtyard' },
    { id: 'tier_north_west_mid', minX: 91.2, maxX: 99.6, minZ: -89.0, maxZ: -77.4, elevY: 0.64, label: 'North VIP Walk' },
    { id: 'tier_north_crown', minX: 99.6, maxX: 120.6, minZ: -96.2, maxZ: -89.0, elevY: 0.36, label: 'North Cascade Crown' },
    { id: 'tier_north_mid', minX: 99.6, maxX: 120.6, minZ: -89.0, maxZ: -83.4, elevY: 0.06, label: 'Cascade Terrace 2' },
    { id: 'tier_north_low', minX: 99.6, maxX: 120.6, minZ: -83.4, maxZ: -77.4, elevY: -0.22, label: 'Cascade Terrace 3' },
    // Tier 3: Upper VIP Cabana Mezzanine Wing overlooking the lowered pools (+0.64m continuous limestone cliff terrace)
    { id: 'tier_vip_mezzanine_n', minX: 91.2, maxX: 99.6, minZ: -77.4, maxZ: 7.4, elevY: 0.64, label: 'VIP Cabana Mezzanine North' },
    { id: 'tier_vip_mezzanine', minX: 91.2, maxX: 96.4, minZ: 7.4, maxZ: 45.2, elevY: 0.64, label: 'VIP Cabana Mezzanine' },
    // Tier 2 (Box 1 Inner): Mid Lagoon, Timber Sunbed Peninsula & Dry South Lounge Terrace (-0.56m, lowered 1.0m!)
    { id: 'tier_mid_lagoon_n', minX: 99.6, maxX: 112.0, minZ: -77.4, maxZ: 7.4, elevY: -0.56, label: 'Mid Lagoon & Sunbed Deck' },
    { id: 'tier_mid_south_in', minX: 96.4, maxX: 106.4, minZ: 7.4, maxZ: 45.2, elevY: -0.56, label: 'South Inner Lounge Terrace' },
    // Tier 1 (Box 1 Seaward): Oceanfront Infinity Lagoon Terrace (-0.96m / -1.00m -> 1.0m knife-edge infinity drop to -2.00m sand!)
    { id: 'tier_ocean_lagoon_n', minX: 112.0, maxX: 121.0, minZ: -77.4, maxZ: 7.4, elevY: -0.96, label: 'North Ocean Infinity Terrace' },
    { id: 'tier_ocean_lagoon_s', minX: 106.4, maxX: 121.4, minZ: 7.4, maxZ: 45.2, elevY: -1.0, label: 'South Ocean Infinity Lagoon' },
  ] as readonly BeachClubTerraceTierSpec[],

  // Legacy bounding alias kept for compatibility checks (spans main built terrace footprint)
  mainDeck: {
    minX: 91.2,
    maxX: 121.4,
    minZ: -96.2,
    maxZ: 45.2,
    elevY: -0.56,
  },

  // 3. Broad Cascading Limestone & Timber Stair Flights connecting EVERY Elevation Level
  stairFlights: [
    // South End of Ground-Level Promenade (+0.02m) -> Kai's Elevated Timber Boardwalk (+0.82m at z=46.2)
    { id: 'stair_prom_kai_boardwalk', minX: 78.35, maxX: 91.0, minZ: 43.8, maxZ: 46.2, axis: 'z', fromElevY: 0.02, toElevY: 0.82, steps: 5 },
    // Ground-Level Promenade (+0.02m) -> North Courtyard (+0.82m) & VIP Mezzanine (+0.64m)
    { id: 'stair_prom_vip_north', minX: 89.2, maxX: 91.2, minZ: -95.5, maxZ: -92.6, axis: 'x', fromElevY: 0.02, toElevY: 0.82, steps: 5 },
    { id: 'stair_prom_vip_n', minX: 89.2, maxX: 91.2, minZ: -68.5, maxZ: -64.0, axis: 'x', fromElevY: 0.02, toElevY: 0.64, steps: 4 },
    { id: 'stair_prom_vip_c', minX: 89.2, maxX: 91.2, minZ: -17.0, maxZ: -12.0, axis: 'x', fromElevY: 0.02, toElevY: 0.64, steps: 4 },
    { id: 'stair_prom_vip_s', minX: 89.2, maxX: 91.2, minZ: 32.5, maxZ: 38.5, axis: 'x', fromElevY: 0.02, toElevY: 0.64, steps: 4 },
    // North Cascade Steps (+0.82m -> +0.64m / +0.36m -> -0.22m -> -0.56m)
    { id: 'stair_cascade_w1', minX: 93.0, maxX: 99.0, minZ: -90.2, maxZ: -87.8, axis: 'z', fromElevY: 0.82, toElevY: 0.64, steps: 2 },
    { id: 'stair_cascade_e1', minX: 98.4, maxX: 101.2, minZ: -94.5, maxZ: -90.0, axis: 'x', fromElevY: 0.82, toElevY: 0.36, steps: 4 },
    { id: 'stair_cascade_w3', minX: 100.0, maxX: 111.8, minZ: -78.4, maxZ: -75.4, axis: 'z', fromElevY: -0.22, toElevY: -0.56, steps: 3 },
    // VIP Mezzanine (+0.64m / +0.72m Bridge) -> Box 1 Mid Lagoon & South Lounge Terrace (-0.48m / -0.56m, 1.2m grand staircases!)
    { id: 'stair_vip_mid_n', minX: 96.4, maxX: 100.2, minZ: -49.4, maxZ: -45.6, axis: 'x', fromElevY: 0.64, toElevY: -0.48, steps: 6 },
    { id: 'stair_vip_mid_c', minX: 99.6, maxX: 103.2, minZ: -16.2, maxZ: -12.4, axis: 'x', fromElevY: 0.72, toElevY: -0.56, steps: 6 },
    { id: 'stair_vip_mid_s', minX: 96.4, maxX: 100.2, minZ: 7.5, maxZ: 13.8, axis: 'x', fromElevY: 0.64, toElevY: -0.56, steps: 6 },
    { id: 'stair_vip_bar_s', minX: 96.4, maxX: 100.2, minZ: 30.2, maxZ: 35.4, axis: 'x', fromElevY: 0.64, toElevY: -0.56, steps: 6 },
    // Box 1 Mid Lagoon & South Lounge (-0.56m) -> Box 1 Oceanfront Infinity Terrace (-0.96m / -1.00m)
    { id: 'stair_mid_ocean_n', minX: 110.8, maxX: 112.4, minZ: -17.6, maxZ: -11.2, axis: 'x', fromElevY: -0.56, toElevY: -0.96, steps: 3 },
    { id: 'stair_mid_ocean_s', minX: 105.2, maxX: 106.4, minZ: 7.4, maxZ: 45.2, axis: 'x', fromElevY: -0.56, toElevY: -1.0, steps: 3 },
    // Box 1 Seaward Terrace (-0.96m / -1.00m) -> Box 2 Golden Sunset Beach Sand (-2.00m, 1.0m grand beach stairs!)
    { id: 'stair_beach_n', minX: 120.6, maxX: 123.6, minZ: -77.0, maxZ: -71.0, axis: 'x', fromElevY: -0.96, toElevY: -2.0, steps: 6 },
    { id: 'stair_beach_c', minX: 120.6, maxX: 123.6, minZ: -17.0, maxZ: -11.0, axis: 'x', fromElevY: -0.96, toElevY: -2.0, steps: 6 },
    { id: 'stair_beach_cs', minX: 120.8, maxX: 123.8, minZ: 5.5, maxZ: 11.5, axis: 'x', fromElevY: -1.0, toElevY: -2.0, steps: 6 },
    { id: 'stair_beach_s', minX: 120.8, maxX: 123.8, minZ: 39.5, maxZ: 44.8, axis: 'x', fromElevY: -1.0, toElevY: -2.0, steps: 6 },
  ] as readonly BeachClubStairFlightSpec[],

  // 4. Elevated Crossing Timber Bridge over West Flanking Pool (VIP Mezzanine +0.64m -> Stair Landing +0.72m)
  crossingBridge: {
    minX: 91.4,
    maxX: 99.6,
    minZ: -16.2,
    maxZ: -12.4,
    elevY: 0.72,
  },

  // 5. Translucent Glowing Glass Skylight Dance Deck directly behind the DJ Stage (-0.48m in Box 1)
  skylightDanceFloor: {
    minX: 99.8,
    maxX: 107.6,
    minZ: -11.2,
    maxZ: 1.6,
    elevY: -0.48,
  },

  // 6. Angled Central DJ Performance Stage Pavilion (-0.04m deck rising +0.52m above -0.56m/-1.00m Box 1 pool deck)
  djStage: {
    cx: 112.0,
    cz: 1.2,
    rotY: 0.36, // angled toward South sunken pod infinity lagoon & ocean sunset
    widthM: 12.0,
    depthM: 8.0,
    heightM: 4.2,
    baseDeckY: -0.56,
    stageDeckTopY: -0.04, // dramatic +520mm stage elevation above Box 1 pool deck with 4 cascading timber steps!
    glassBoxWidthM: 4.0,
    glassBoxDepthM: 3.5,
    glassBoxProjectM: 1.5,
    boothWidthM: 2.0,
    boothDepthM: 1.0,
    boothHeightM: 1.05,
    speakerHalfX: 0.36,
    speakerHalfZ: 0.36,
    speakerHeightM: 1.85,
  },

  // 7. Modern Luxury Cocktail Bar (ZERO WOOD: fluted white stone, Calacatta marble, brass, ivory terrazzo pad on +0.68m upper cliff!)
  cocktailBar: {
    cx: 95.6,
    cz: 40.4,
    rotY: -0.52,
    padRadiusM: 4.15,
    padElevY: 0.68,
    barWidthM: 5.5,
    barDepthM: 3.5,
    barHeightM: 3.1,
    counterHeightM: 1.1,
  },

  // 8. Stepped Cascade Water Terraces + Lowered Box 1 Resort Infinity Lagoons
  pools: {
    // 3 Grand Cascading Waterfall Basins at North Crown (+0.32m -> +0.02m -> -0.26m in Box 1)
    cascadeTier1: {
      id: 'pool_cascade_1',
      minX: 99.6,
      maxX: 119.6,
      minZ: -94.6,
      maxZ: -89.4,
      waterY: 0.32,
      deckY: 0.36,
      floorY: -0.04,
    } as BeachClubCascadePoolSpec,
    cascadeTier2: {
      id: 'pool_cascade_2',
      minX: 99.6,
      maxX: 119.6,
      minZ: -89.0,
      maxZ: -83.8,
      waterY: 0.02,
      deckY: 0.06,
      floorY: -0.34,
    } as BeachClubCascadePoolSpec,
    cascadeTier3: {
      id: 'pool_cascade_3',
      minX: 99.6,
      maxX: 119.6,
      minZ: -83.4,
      maxZ: -78.2,
      waterY: -0.26,
      deckY: -0.22,
      floorY: -0.62,
    } as BeachClubCascadePoolSpec,

    // Stepped Box 1 Resort Lagoon Channels:
    // - lapChannels[0]: Inner Cascading Infinity Reflection Lagoon (-0.60m water, bordered East by -0.54m Sunbed Peninsula!)
    // - lapChannels[1]: Seaward Resort Lagoon North Half (-0.98m water, 1.0m knife-edge infinity overflow to -2.00m beach sand!)
    // - lapChannels[2]: Seaward Resort Lagoon South Half (-0.98m water, split by warm timber jetty bridge at z=-47.5!)
    lapChannels: [
      { id: 'pool_north_inner_lagoon', minX: 100.4, maxX: 104.8, minZ: -74.8, maxZ: -17.6 },
      { id: 'pool_north_sea_upper', minX: 112.4, maxX: 120.4, minZ: -74.8, maxZ: -49.5 },
      { id: 'pool_north_sea_lower', minX: 112.4, maxX: 120.4, minZ: -45.5, maxZ: -17.6 },
    ] as readonly BeachClubRect[],

    // Sleek Upper West Reflecting Moat bordering the +0.64m VIP Cabanas (+0.52m water)
    westFlankNorth: { id: 'pool_west_flank_n', minX: 96.4, maxX: 99.4, minZ: -74.2, maxZ: -51.2 } as BeachClubRect,
    westFlankSouth: { id: 'pool_west_flank_s', minX: 96.4, maxX: 99.4, minZ: -45.0, maxZ: -17.2 } as BeachClubRect,

    // Straight Aligned South Beachfront Infinity Lagoon (-1.02m water overlooking -2.00m sand, rotY = 0!)
    southSeaPool: {
      id: 'pool_south_sea',
      cx: 113.6,
      cz: 25.4,
      halfX: 6.8,
      halfZ: 17.2,
      rotY: 0,
      waterY: -1.02,
      deckY: -1.0,
    } as BeachClubOrientedRect,
  },

  // 9. Raised Timber Sunbed Peninsula (-0.54m) & Cross-Water Timber Jetty Bridge (-0.48m) in Box 1
  sunbedPeninsula: {
    minX: 105.0,
    maxX: 112.2,
    minZ: -75.0,
    maxZ: -17.4,
    elevY: -0.54,
  },
  northJettyBridge: {
    minX: 100.0,
    maxX: 120.6,
    minZ: -49.4,
    maxZ: -45.6,
    elevY: -0.48,
  },

  // 10. 9 Modern Luxury VIP Cabana Suites along the +0.64m Upper VIP Mezzanine (screen_57a53910.png)
  cabanas: [
    ...[-69.5, -62.0, -54.5, -40.5, -33.0, -25.5, -18.5].map((z, idx): BeachClubCabanaSpec => ({
      id: `beach_club_cabana_n_${idx}`,
      cx: 93.5,
      cz: z,
      rotY: Math.PI / 2,
      plinthHalfX: 1.55,
      plinthHalfZ: 1.6,
      plinthTopY: 0.76,
      hasLoungerPair: idx % 2 === 0,
    })),
    {
      id: 'beach_club_cabana_s_0',
      cx: 93.5,
      cz: -7.5,
      rotY: Math.PI / 2,
      plinthHalfX: 1.55,
      plinthHalfZ: 1.6,
      plinthTopY: 0.76,
      hasLoungerPair: true,
    },
    {
      id: 'beach_club_cabana_s_1',
      cx: 93.5,
      cz: 0.5,
      rotY: Math.PI / 2,
      plinthHalfX: 1.55,
      plinthHalfZ: 1.6,
      plinthTopY: 0.76,
      hasLoungerPair: false,
    },
  ] as readonly BeachClubCabanaSpec[],

  // 11. 6 Square White Floating Sunken Lounge Pods w/ Table Lanterns aligned straight (rotY = 0) inside the South Oceanfront Infinity Pool
  sunkenPods: [
    ...[13.4, 21.4, 29.4, 37.4].map((cz, idx): BeachClubSunkenPodSpec => ({
      id: `beach_club_pod_sea_w_${idx}`,
      poolId: 'south_sea_pool',
      cx: 110.2,
      cz,
      rotY: 0,
      sizeM: 2.7,
      waterY: -1.02,
    })),
    ...[17.4, 33.4].map((cz, idx): BeachClubSunkenPodSpec => ({
      id: `beach_club_pod_sea_e_${idx}`,
      poolId: 'south_sea_pool',
      cx: 116.8,
      cz,
      rotY: 0,
      sizeM: 2.7,
      waterY: -1.02,
    })),
  ] as readonly BeachClubSunkenPodSpec[],

  // 12. Box 2 Seaward Woven Sand Sets (-2.00m) + Box 1 Peninsula Turquoise Poolside Loungers & Parasols (-0.54m)
  beachSets: [
    // Dry Golden Sand Balinese Parasols & Ivory Loungers facing the surf on Box 2 (`elevY = -2.0m`)
    ...[-84.0, -72.0, -60.0, -48.0, -36.0, -24.0, -12.0, 0.0, 12.0, 24.0, 36.0].map(
      (z, idx): BeachClubBeachSetSpec => ({
        id: `beach_club_sand_set_front_${idx}`,
        cx: 124.8,
        cz: z,
        rotY: -Math.PI / 2 + ((idx % 3) - 1) * 0.05,
        elevY: -2.0,
        variant: 'sand_woven',
        hasSecondLounger: true,
      }),
    ),
    ...[-66.0, -42.0, -18.0, 6.0, 30.0].map(
      (z, idx): BeachClubBeachSetSpec => ({
        id: `beach_club_sand_set_shore_${idx}`,
        cx: 129.8,
        cz: z,
        rotY: -Math.PI / 2,
        elevY: -2.0,
        variant: 'sand_woven',
        hasSecondLounger: true,
      }),
    ),
    // Twin Columns of Turquoise Poolside Daybeds & Woven Parasols ON the Box 1 Timber Sunbed Peninsula (-0.54m!)
    ...[-69.0, -61.5, -54.0, -41.0, -33.5, -26.0, -19.5].map(
      (z, idx): BeachClubBeachSetSpec => ({
        id: `beach_club_poolside_set_${idx}`,
        cx: 108.6,
        cz: z,
        rotY: Math.PI / 2,
        elevY: -0.54,
        variant: 'poolside_turquoise',
        hasSecondLounger: true,
      }),
    ),
  ] as readonly BeachClubBeachSetSpec[],

  // 13. Crisscross Catenary Festoon Bulb Garlands (arch from +0.64m West Mezzanine over -0.56m/-1.00m Box 1 pools)
  festoonSpans: [
    { id: 'festoon_s_1', ax: 93.6, ay: 4.5, az: 10.5, bx: 120.6, by: 3.35, bz: 17.5, sagM: 1.0, bulbCount: 16 },
    { id: 'festoon_s_2', ax: 120.6, ay: 3.35, az: 10.5, bx: 93.6, by: 4.5, bz: 24.5, sagM: 1.05, bulbCount: 16 },
    { id: 'festoon_s_3', ax: 93.6, ay: 4.5, az: 24.5, bx: 120.6, by: 3.35, bz: 32.0, sagM: 1.0, bulbCount: 16 },
    { id: 'festoon_s_4', ax: 120.6, ay: 3.35, az: 25.0, bx: 93.6, by: 4.5, bz: 38.0, sagM: 1.0, bulbCount: 16 },
    { id: 'festoon_s_5', ax: 93.6, ay: 4.5, az: 38.0, bx: 120.6, by: 3.35, bz: 42.2, sagM: 0.95, bulbCount: 15 },
    // North Sunbed Peninsula festoon canopy matching Tangkapan_Layar warm twinkle canopy!
    { id: 'festoon_n_1', ax: 94.0, ay: 4.5, az: -22.0, bx: 119.8, by: 3.4, bz: -18.5, sagM: 0.95, bulbCount: 16 },
    { id: 'festoon_n_2', ax: 94.0, ay: 4.5, az: -36.0, bx: 119.8, by: 3.4, bz: -30.5, sagM: 0.95, bulbCount: 16 },
    { id: 'festoon_n_3', ax: 119.8, ay: 3.4, az: -43.0, bx: 94.0, by: 4.5, bz: -55.0, sagM: 1.0, bulbCount: 16 },
    { id: 'festoon_n_4', ax: 94.0, ay: 4.5, az: -68.0, bx: 119.8, by: 3.4, bz: -60.0, sagM: 0.95, bulbCount: 16 },
  ] as readonly BeachClubFestoonSpanSpec[],

  // 14. Twin Promenade Coconut Palms + Courtyard & Island Palms (seated accurately on tiered ground!)
  palms: (() => {
    const list: BeachClubPalmSpec[] = [];
    const westZs = [-92, -82, -72, -62, -52, -42, -32, -22, -10, 0, 10, 20, 30, 41];
    westZs.forEach((z, idx) => {
      list.push({
        id: `bc_palm_w_${idx}`,
        x: 80.2,
        z,
        baseY: 0.02,
        scale: 1.06 + (idx % 3) * 0.08,
        leanX: 0.06,
        leanZ: (idx % 2 === 0 ? 1 : -1) * 0.04,
        rotY: idx * 1.15,
      });
    });
    const eastZs = [-92, -82, -72, -62, -52, -42, -32, -22, -10, 0, 10, 20, 30, 41];
    eastZs.forEach((z, idx) => {
      list.push({
        id: `bc_palm_e_${idx}`,
        x: 90.6,
        z,
        baseY: 0.02,
        scale: 1.12 + (idx % 3) * 0.07,
        leanX: -0.04,
        leanZ: (idx % 2 === 0 ? -1 : 1) * 0.04,
        rotY: 0.5 + idx * 1.05,
      });
    });
    // Accent island palms on tiered decks (South Lounge Terrace -0.56m, beside Bar +0.64m, Peninsula -0.48m & North Courtyard +0.64m)
    list.push(
      { id: 'bc_palm_island_s1', x: 103.2, z: 33.4, baseY: -0.56, scale: 1.16, leanX: 0.08, leanZ: 0.05, rotY: 0.4 },
      { id: 'bc_palm_island_s2', x: 103.2, z: 14.0, baseY: -0.56, scale: 1.1, leanX: -0.05, leanZ: -0.06, rotY: 2.1 },
      { id: 'bc_palm_bar_1', x: 92.0, z: 35.8, baseY: 0.64, scale: 1.12, leanX: 0.06, leanZ: 0.04, rotY: 1.4 },
      { id: 'bc_palm_pen_1', x: 108.6, z: -47.5, baseY: -0.48, scale: 1.14, leanX: 0.04, leanZ: 0.05, rotY: 2.5 },
      { id: 'bc_palm_n_courtyard', x: 95.6, z: -83.2, baseY: 0.64, scale: 1.2, leanX: 0.04, leanZ: -0.05, rotY: 3.1 },
    );
    return list as readonly BeachClubPalmSpec[];
  })(),
} as const;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function isInsideOrientedRect(
  x: number,
  z: number,
  cx: number,
  cz: number,
  halfX: number,
  halfZ: number,
  rotY: number,
  padM = 0,
): boolean {
  const dx = x - cx;
  const dz = z - cz;
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.abs(lx) <= halfX + padM && Math.abs(lz) <= halfZ + padM;
}

function orientedRectSdf(
  x: number,
  z: number,
  cx: number,
  cz: number,
  halfX: number,
  halfZ: number,
  rotY: number,
): number {
  const dx = x - cx;
  const dz = z - cz;
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  const lx = Math.abs(dx * c - dz * s) - halfX;
  const lz = Math.abs(dx * s + dz * c) - halfZ;
  return Math.hypot(Math.max(lx, 0), Math.max(lz, 0)) + Math.min(Math.max(lx, lz), 0);
}

/**
 * Signed distance (< 0 inside water basin) to any of the Beach Club infinity / lagoon / cascade pools,
 * cleanly excluding the Crossing Bridge, North Jetty Bridge, Timber Sunbed Peninsula, and DJ Stage Deck.
 */
export function evaluateBeachClubPoolWaterSdf(worldX: number, worldZ: number): number {
  if (worldX < 94.0 || worldX > 121.6 || worldZ < -96.0 || worldZ > 45.0) {
    return 99.0;
  }

  // Crossing Bridge & North Jetty Bridge span cleanly above the water channels
  const b = BEACH_CLUB_MASTERPLAN.crossingBridge;
  if (worldX >= b.minX && worldX <= b.maxX && worldZ >= b.minZ && worldZ <= b.maxZ) {
    return 2.5;
  }
  const j = BEACH_CLUB_MASTERPLAN.northJettyBridge;
  if (worldX >= j.minX && worldX <= j.maxX && worldZ >= j.minZ && worldZ <= j.maxZ) {
    return 2.5;
  }

  // Raised Timber Sunbed Peninsula (-0.54m) is walkable solid dry resort terrace
  const pen = BEACH_CLUB_MASTERPLAN.sunbedPeninsula;
  if (worldX >= pen.minX && worldX <= pen.maxX && worldZ >= pen.minZ && worldZ <= pen.maxZ) {
    return 2.0;
  }

  // DJ Stage Pavilion & Glass Box cantilever sit cleanly above/clear of the water
  const dj = BEACH_CLUB_MASTERPLAN.djStage;
  if (isInsideOrientedRect(worldX, worldZ, dj.cx, dj.cz, dj.widthM * 0.5 + 0.35, dj.depthM * 0.5 + 1.85, dj.rotY)) {
    return 2.5;
  }

  let minD = 99.0;
  const rectPools: readonly BeachClubRect[] = [
    BEACH_CLUB_MASTERPLAN.pools.cascadeTier1,
    BEACH_CLUB_MASTERPLAN.pools.cascadeTier2,
    BEACH_CLUB_MASTERPLAN.pools.cascadeTier3,
    ...BEACH_CLUB_MASTERPLAN.pools.lapChannels,
    BEACH_CLUB_MASTERPLAN.pools.westFlankNorth,
    BEACH_CLUB_MASTERPLAN.pools.westFlankSouth,
  ];
  for (let i = 0; i < rectPools.length; i++) {
    const r = rectPools[i];
    const d = orientedRectSdf(
      worldX,
      worldZ,
      (r.minX + r.maxX) * 0.5,
      (r.minZ + r.maxZ) * 0.5,
      (r.maxX - r.minX) * 0.5,
      (r.maxZ - r.minZ) * 0.5,
      0,
    );
    if (d < minD) minD = d;
  }

  const sp = BEACH_CLUB_MASTERPLAN.pools.southSeaPool;
  const dSea = orientedRectSdf(worldX, worldZ, sp.cx, sp.cz, sp.halfX, sp.halfZ, sp.rotY);
  if (dSea < minD) minD = dSea;

  return minD;
}

export function isPointInBeachClubPoolWater(worldX: number, worldZ: number): boolean {
  return evaluateBeachClubPoolWaterSdf(worldX, worldZ) < -0.05;
}

/**
 * Evaluates exact multi-tiered stepped walkable top elevation (in meters) across the Beach Club:
 * - `+0.82m` Wave-Striped Palm Promenade (joining Kai's +0.82m Boardwalk flush at z = +46.2)
 * - `+0.64m / +0.76m / +0.68m` Upper VIP Cabana Mezzanine, Calacatta Plinths & Cocktail Bar Terrazzo Podium
 * - `+0.36m -> +0.06m -> -0.22m` Stepped North Cascade Terraces (Box 1 North)
 * - `-0.56m / -0.54m / -0.48m` Box 1 Mid Resort Lagoon, Timber Sunbed Peninsula & Skylight Dance Floor
 * - `-0.96m / -1.00m` Box 1 Seaward Oceanfront Infinity Lagoon Terrace (1.0m below ground!)
 * - `-0.04m` Angled DJ Performance Stage Deck (+0.52m above the -0.56m Box 1 pool deck)
 * - `-2.00m` Box 2 Seaward Golden Sunset Beach Sand (2.0m below ground, 1.0m below Oceanfront Infinity Terrace!)
 */
export function evaluateBeachClubElevation(worldX: number, worldZ: number): number {
  if (worldX < 78.0 || worldX > 134.0 || worldZ < -97.5 || worldZ > 46.8) {
    return 0.0;
  }

  // Base contour elevation across the 3 West-to-East zones when inside the Beach Club Z span
  let elev = 0.0;
  if (worldZ >= -96.5 && worldZ <= 46.2) {
    if (worldX > 121.4) {
      elev = -2.0;
    } else if (worldX >= (worldZ >= 7.4 ? 106.4 : 112.0)) {
      elev = -1.0;
    } else if (worldX >= (worldZ >= 7.4 ? 96.4 : 99.6)) {
      elev = -0.56;
    }
  }

  // 1. Promenade (+0.02m, flush w/ roadside ground and stepping up to Kai's boardwalk at z = 43.8..46.2)
  const prom = BEACH_CLUB_MASTERPLAN.promenade;
  if (worldX >= prom.minX && worldX <= prom.maxX && worldZ >= prom.minZ && worldZ <= prom.maxZ) {
    const northEdge = smoothstep(prom.minZ, prom.minZ + 0.35, worldZ);
    elev = Math.max(elev, prom.elevY * northEdge);
  }

  // 2. Stepped Resort Terrace Tiers (North Crown +0.36m -> VIP +0.64m -> Mid -0.56m -> Ocean -1.00m)
  for (let i = 0; i < BEACH_CLUB_MASTERPLAN.terraceTiers.length; i++) {
    const tier = BEACH_CLUB_MASTERPLAN.terraceTiers[i];
    if (worldX >= tier.minX && worldX <= tier.maxX && worldZ >= tier.minZ && worldZ <= tier.maxZ) {
      elev = tier.elevY;
    }
  }

  // 3. Raised Timber Sunbed Peninsula (-0.54m) & Jetty/Crossing Bridges
  const pen = BEACH_CLUB_MASTERPLAN.sunbedPeninsula;
  if (worldX >= pen.minX && worldX <= pen.maxX && worldZ >= pen.minZ && worldZ <= pen.maxZ) {
    elev = Math.max(elev, pen.elevY);
  }
  const jetty = BEACH_CLUB_MASTERPLAN.northJettyBridge;
  if (worldX >= jetty.minX && worldX <= jetty.maxX && worldZ >= jetty.minZ && worldZ <= jetty.maxZ) {
    elev = Math.max(elev, jetty.elevY);
  }
  const bridge = BEACH_CLUB_MASTERPLAN.crossingBridge;
  if (worldX >= bridge.minX && worldX <= bridge.maxX && worldZ >= bridge.minZ && worldZ <= bridge.maxZ) {
    elev = Math.max(elev, bridge.elevY);
  }
  const sky = BEACH_CLUB_MASTERPLAN.skylightDanceFloor;
  if (worldX >= sky.minX && worldX <= sky.maxX && worldZ >= sky.minZ && worldZ <= sky.maxZ) {
    elev = Math.max(elev, sky.elevY);
  }

  // 4. Cocktail Bar Stepped Circular Ivory Terrazzo Podium (+0.68m on Upper VIP Mezzanine)
  const bar = BEACH_CLUB_MASTERPLAN.cocktailBar;
  const dBar = Math.hypot(worldX - bar.cx, worldZ - bar.cz);
  if (dBar <= bar.padRadiusM + 0.22) {
    const ramp = 1.0 - smoothstep(bar.padRadiusM, bar.padRadiusM + 0.22, dBar);
    elev = Math.max(elev, elev + (bar.padElevY - elev) * ramp);
  }

  // 5. VIP Cabana Honed Calacatta Plinths (+0.76m)
  for (let i = 0; i < BEACH_CLUB_MASTERPLAN.cabanas.length; i++) {
    const c = BEACH_CLUB_MASTERPLAN.cabanas[i];
    if (Math.abs(worldX - c.cx) <= c.plinthHalfX && Math.abs(worldZ - c.cz) <= c.plinthHalfZ) {
      elev = Math.max(elev, c.plinthTopY);
    }
  }

  // 6. Carve recessed pool basins cleanly beneath each tier's water surface
  const poolSdf = evaluateBeachClubPoolWaterSdf(worldX, worldZ);
  if (poolSdf < -0.05) {
    const carveT = smoothstep(-0.05, -0.45, poolSdf);
    const cas1 = BEACH_CLUB_MASTERPLAN.pools.cascadeTier1;
    const cas2 = BEACH_CLUB_MASTERPLAN.pools.cascadeTier2;
    const cas3 = BEACH_CLUB_MASTERPLAN.pools.cascadeTier3;
    if (worldX >= cas1.minX && worldX <= cas1.maxX && worldZ >= cas1.minZ && worldZ <= cas1.maxZ) {
      elev = cas1.deckY - (cas1.deckY - cas1.floorY) * carveT;
    } else if (worldX >= cas2.minX && worldX <= cas2.maxX && worldZ >= cas2.minZ && worldZ <= cas2.maxZ) {
      elev = cas2.deckY - (cas2.deckY - cas2.floorY) * carveT;
    } else if (worldX >= cas3.minX && worldX <= cas3.maxX && worldZ >= cas3.minZ && worldZ <= cas3.maxZ) {
      elev = cas3.deckY - (cas3.deckY - cas3.floorY) * carveT;
    } else {
      elev = elev - 0.42 * carveT;
    }
  }

  // 7. Stepped Stairway Transitions (true linear walkable grade matching visual stone steps!)
  for (let i = 0; i < BEACH_CLUB_MASTERPLAN.stairFlights.length; i++) {
    const sf = BEACH_CLUB_MASTERPLAN.stairFlights[i];
    if (worldX >= sf.minX && worldX <= sf.maxX && worldZ >= sf.minZ && worldZ <= sf.maxZ) {
      const t =
        sf.axis === 'x'
          ? (worldX - sf.minX) / Math.max(0.01, sf.maxX - sf.minX)
          : (worldZ - sf.minZ) / Math.max(0.01, sf.maxZ - sf.minZ);
      elev = sf.fromElevY + (sf.toElevY - sf.fromElevY) * clamp01(t);
    }
  }

  // 8. Angled DJ Performance Stage Deck (-0.04m, rising +0.52m above -0.56m Box 1 deck) & 4 Cascading Rear Steps
  const dj = BEACH_CLUB_MASTERPLAN.djStage;
  const dx = worldX - dj.cx;
  const dz = worldZ - dj.cz;
  const cosR = Math.cos(dj.rotY);
  const sinR = Math.sin(dj.rotY);
  const lx = dx * cosR - dz * sinR;
  const lz = dx * sinR + dz * cosR;
  if (Math.abs(lx) <= dj.widthM * 0.5 && Math.abs(lz) <= dj.depthM * 0.5) {
    elev = Math.max(elev, dj.stageDeckTopY);
  } else if (Math.abs(lx) <= dj.widthM * 0.5 && lz > dj.depthM * 0.5 && lz <= dj.depthM * 0.5 + 1.5) {
    const tStep = 1.0 - smoothstep(dj.depthM * 0.5, dj.depthM * 0.5 + 1.5, lz);
    elev = Math.max(elev, dj.baseDeckY + (dj.stageDeckTopY - dj.baseDeckY) * tStep);
  }

  return elev;
}

/**
 * Classifies whether `(worldX, worldZ)` stands on a built Beach Club surface (paved promenade,
 * terraced limestone deck, timber DJ deck / sunbed peninsula / bridges, or golden sand).
 */
export function classifyBeachClubSurface(
  worldX: number,
  worldZ: number,
): 'none' | 'wood' | 'stone_road' | 'sand' | 'water' {
  if (worldX < 78.2 || worldX > 134.5 || worldZ < -98.0 || worldZ > 46.2) {
    return 'none';
  }
  if (isPointInBeachClubPoolWater(worldX, worldZ)) {
    return 'water';
  }
  const bridge = BEACH_CLUB_MASTERPLAN.crossingBridge;
  if (worldX >= bridge.minX && worldX <= bridge.maxX && worldZ >= bridge.minZ && worldZ <= bridge.maxZ) {
    return 'wood';
  }
  const jetty = BEACH_CLUB_MASTERPLAN.northJettyBridge;
  if (worldX >= jetty.minX && worldX <= jetty.maxX && worldZ >= jetty.minZ && worldZ <= jetty.maxZ) {
    return 'wood';
  }
  const pen = BEACH_CLUB_MASTERPLAN.sunbedPeninsula;
  if (worldX >= pen.minX && worldX <= pen.maxX && worldZ >= pen.minZ && worldZ <= pen.maxZ) {
    return 'wood';
  }
  const dj = BEACH_CLUB_MASTERPLAN.djStage;
  if (isInsideOrientedRect(worldX, worldZ, dj.cx, dj.cz, dj.widthM * 0.5, dj.depthM * 0.5 + 1.5, dj.rotY)) {
    return 'wood';
  }
  if (worldX <= 121.6 && worldZ >= -97.0 && worldZ <= 46.2) {
    return 'stone_road';
  }
  if (worldX > 121.6) {
    return 'sand';
  }
  return 'none';
}

/**
 * Audited static 2D OBB colliders for Beach Club architectural structures, speaker stacks,
 * DJ booth, Aqua Glass Box walls, Cocktail Bar counter/backwall, Cabana beds, loungers, and palms.
 */
export function getBeachClubObstacles(): StaticWorldStructureObb[] {
  const obstacles: StaticWorldStructureObb[] = [];

  // 1. DJ Performance Stage Pavilion Solid Sub-volumes
  const dj = BEACH_CLUB_MASTERPLAN.djStage;
  const cR = Math.cos(dj.rotY);
  const sR = Math.sin(dj.rotY);
  const toWorldDj = (lx: number, lz: number): [number, number] => [
    dj.cx + lx * cR + lz * sR,
    dj.cz - lx * sR + lz * cR,
  ];
  const [gbX, gbZ] = toWorldDj(-4.0, -2.5);
  obstacles.push({
    id: 'beach_club_dj_glass_box',
    x: gbX,
    z: gbZ,
    halfX: 2.0,
    halfZ: 2.25,
    rotY: dj.rotY,
    heightY: 4.8,
    mat: 'metal',
  });
  const [boothX, boothZ] = toWorldDj(1.2, -0.35);
  obstacles.push({
    id: 'beach_club_dj_booth',
    x: boothX,
    z: boothZ,
    halfX: 1.05,
    halfZ: 0.55,
    rotY: dj.rotY,
    heightY: 2.1,
    mat: 'metal',
  });
  for (const [spId, slx, slz] of [
    ['beach_club_dj_speaker_w', -1.45, 0.95],
    ['beach_club_dj_speaker_e', 4.65, 0.95],
  ] as const) {
    const [sx, sz] = toWorldDj(slx, slz);
    obstacles.push({
      id: spId,
      x: sx,
      z: sz,
      halfX: 0.42,
      halfZ: 0.42,
      rotY: dj.rotY,
      heightY: 2.8,
      mat: 'concrete',
    });
  }
  const [backX, backZ] = toWorldDj(2.0, -3.55);
  obstacles.push({
    id: 'beach_club_dj_backwall',
    x: backX,
    z: backZ,
    halfX: 3.9,
    halfZ: 0.25,
    rotY: dj.rotY,
    heightY: 4.6,
    mat: 'concrete',
  });

  // 2. Modern Luxury Cocktail Bar (fluted white stone counter horseshoe + Calacatta marble bottle wall)
  const bar = BEACH_CLUB_MASTERPLAN.cocktailBar;
  const bc = Math.cos(bar.rotY);
  const bs = Math.sin(bar.rotY);
  const toWorldBar = (lx: number, lz: number): [number, number] => [
    bar.cx + lx * bc + lz * bs,
    bar.cz - lx * bs + lz * bc,
  ];
  const [bcntX, bcntZ] = toWorldBar(0, 1.05);
  obstacles.push({
    id: 'beach_club_bar_counter',
    x: bcntX,
    z: bcntZ,
    halfX: 2.55,
    halfZ: 0.65,
    rotY: bar.rotY,
    heightY: 1.85,
    mat: 'concrete',
  });
  const [bwallX, bwallZ] = toWorldBar(0, -1.25);
  obstacles.push({
    id: 'beach_club_bar_backwall',
    x: bwallX,
    z: bwallZ,
    halfX: 2.25,
    halfZ: 0.48,
    rotY: bar.rotY,
    heightY: 3.6,
    mat: 'concrete',
  });

  // 3. 9 VIP Cabanas: plush king daybed collider inside each cabana
  for (const cab of BEACH_CLUB_MASTERPLAN.cabanas) {
    obstacles.push({
      id: `${cab.id}_bed`,
      x: cab.cx - 0.35,
      z: cab.cz,
      halfX: 0.92,
      halfZ: 1.15,
      rotY: 0,
      heightY: 1.8,
      mat: 'wood',
    });
  }

  // 4. Seaward Beach Parasol & Poolside Sunbed Sets
  for (const bsItem of BEACH_CLUB_MASTERPLAN.beachSets) {
    obstacles.push({
      id: `${bsItem.id}_cluster`,
      x: bsItem.cx,
      z: bsItem.cz,
      halfX: 1.18,
      halfZ: 1.05,
      rotY: bsItem.rotY,
      heightY: 2.9,
      mat: 'wood',
    });
  }

  // 5. Coconut Palm Tree Trunks
  for (const palm of BEACH_CLUB_MASTERPLAN.palms) {
    obstacles.push({
      id: `${palm.id}_trunk`,
      x: palm.x,
      z: palm.z,
      halfX: 0.42,
      halfZ: 0.42,
      rotY: 0,
      heightY: 7.8,
      mat: 'wood',
    });
  }

  return obstacles;
}
