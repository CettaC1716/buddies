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

export interface BeachClubPlanterSpec {
  id: string;
  cx: number;
  cz: number;
  widthX: number;
  lengthZ: number;
  baseY: number;
  topY: number;
}

export interface BeachClubStairCorridorSpec {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  axis: 'x' | 'z';
}

export interface BeachClubSeatSpotSpec {
  id: string;
  x: number;
  z: number;
  yaw: number;
  seatLiftY: number;
  indicatorHeightY: number;
  standUpX: number;
  standUpZ: number;
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
    { id: 'tier_north_low', minX: 99.6, maxX: 120.6, minZ: -83.4, maxZ: -78.2, elevY: -0.22, label: 'Cascade Terrace 3' },
    // Tier 3: Upper VIP Cabana Mezzanine Wing overlooking the lowered pools (+0.64m continuous limestone cliff terrace)
    { id: 'tier_vip_mezzanine_n', minX: 91.2, maxX: 99.6, minZ: -77.4, maxZ: 7.4, elevY: 0.64, label: 'VIP Cabana Mezzanine North' },
    { id: 'tier_vip_mezzanine', minX: 91.2, maxX: 96.4, minZ: 7.4, maxZ: 45.2, elevY: 0.64, label: 'VIP Cabana Mezzanine' },
    // Tier 2 (Box 1 Inner): Mid Lagoon, Timber Sunbed Peninsula & Dry South Lounge Terrace (-0.56m, lowered 1.0m!)
    { id: 'tier_mid_lagoon_n', minX: 99.6, maxX: 112.0, minZ: -78.2, maxZ: 7.4, elevY: -0.56, label: 'Mid Lagoon & Sunbed Deck' },
    { id: 'tier_mid_south_in', minX: 96.4, maxX: 106.4, minZ: 7.4, maxZ: 45.2, elevY: -0.56, label: 'South Inner Lounge Terrace' },
    // Tier 1 (Box 1 Seaward): Oceanfront Infinity Lagoon Terrace (-0.96m / -1.00m -> 1.0m knife-edge infinity drop to -2.00m sand!)
    { id: 'tier_ocean_lagoon_n', minX: 112.0, maxX: 121.0, minZ: -78.2, maxZ: 7.4, elevY: -0.96, label: 'North Ocean Infinity Terrace' },
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
    { id: 'stair_prom_kai_boardwalk', minX: 78.35, maxX: 91.2, minZ: 43.8, maxZ: 46.2, axis: 'z', fromElevY: 0.02, toElevY: 0.82, steps: 5 },
    // Ground-Level Promenade (+0.02m) -> North Courtyard (+0.82m) & VIP Mezzanine (+0.64m)
    { id: 'stair_prom_vip_north', minX: 89.2, maxX: 91.2, minZ: -95.5, maxZ: -92.6, axis: 'x', fromElevY: 0.02, toElevY: 0.82, steps: 5 },
    { id: 'stair_prom_vip_n', minX: 89.2, maxX: 91.2, minZ: -67.6, maxZ: -63.8, axis: 'x', fromElevY: 0.02, toElevY: 0.64, steps: 4 },
    { id: 'stair_prom_vip_c', minX: 89.2, maxX: 91.2, minZ: -17.0, maxZ: -12.0, axis: 'x', fromElevY: 0.02, toElevY: 0.64, steps: 4 },
    { id: 'stair_prom_vip_s', minX: 89.2, maxX: 91.2, minZ: 25.4, maxZ: 30.6, axis: 'x', fromElevY: 0.02, toElevY: 0.64, steps: 4 },
    // North Cascade & North VIP Steps (+0.82m -> +0.64m / +0.36m dry pergola, and +0.64m -> -0.56m North Crosswalk Spine)
    { id: 'stair_cascade_w1', minX: 93.0, maxX: 99.0, minZ: -89.0, maxZ: -87.0, axis: 'z', fromElevY: 0.82, toElevY: 0.64, steps: 2 },
    { id: 'stair_cascade_e1', minX: 99.6, maxX: 101.6, minZ: -96.2, maxZ: -94.1, axis: 'x', fromElevY: 0.82, toElevY: 0.36, steps: 4 },
    { id: 'stair_cascade_w3', minX: 99.6, maxX: 103.2, minZ: -77.8, maxZ: -75.0, axis: 'x', fromElevY: 0.64, toElevY: -0.56, steps: 6 },
    // VIP Mezzanine (+0.64m / +0.72m Bridge) -> Box 1 Mid Lagoon & South Lounge Terrace (-0.48m / -0.56m, 1.2m grand staircases!)
    { id: 'stair_vip_mid_n', minX: 96.4, maxX: 100.2, minZ: -49.4, maxZ: -45.6, axis: 'x', fromElevY: 0.64, toElevY: -0.48, steps: 6 },
    { id: 'stair_vip_mid_c', minX: 99.6, maxX: 103.2, minZ: -16.2, maxZ: -12.4, axis: 'x', fromElevY: 0.72, toElevY: -0.56, steps: 6 },
    { id: 'stair_vip_mid_s', minX: 96.4, maxX: 100.2, minZ: 7.5, maxZ: 13.8, axis: 'x', fromElevY: 0.64, toElevY: -0.56, steps: 6 },
    // Shifted North (-Z, to the right of the enlarged Cocktail Bar podium) so the grand bar & stools have full room
    { id: 'stair_vip_bar_s', minX: 96.4, maxX: 100.2, minZ: 25.4, maxZ: 30.6, axis: 'x', fromElevY: 0.64, toElevY: -0.56, steps: 6 },
    // Box 1 Mid Lagoon & South Lounge (-0.56m) -> Box 1 Oceanfront Infinity Terrace (-0.96m / -1.00m)
    { id: 'stair_mid_ocean_north', minX: 112.0, maxX: 113.6, minZ: -77.8, maxZ: -75.0, axis: 'x', fromElevY: -0.56, toElevY: -0.96, steps: 3 },
    { id: 'stair_mid_ocean_n', minX: 110.8, maxX: 112.4, minZ: -17.4, maxZ: -11.2, axis: 'x', fromElevY: -0.56, toElevY: -0.96, steps: 3 },
    { id: 'stair_mid_ocean_s', minX: 105.2, maxX: 106.4, minZ: 7.4, maxZ: 44.8, axis: 'x', fromElevY: -0.56, toElevY: -1.0, steps: 3 },
    // Box 1 Seaward Terrace (-0.96m / -1.00m) -> Box 2 Golden Sunset Beach Sand (-2.00m, 1.0m grand beach stairs!)
    { id: 'stair_beach_n', minX: 120.6, maxX: 123.6, minZ: -77.8, maxZ: -74.8, axis: 'x', fromElevY: -0.96, toElevY: -2.0, steps: 6 },
    { id: 'stair_beach_c', minX: 120.6, maxX: 123.6, minZ: -17.2, maxZ: -11.4, axis: 'x', fromElevY: -0.96, toElevY: -2.0, steps: 6 },
    { id: 'stair_beach_cs', minX: 120.8, maxX: 123.8, minZ: 4.2, maxZ: 7.4, axis: 'x', fromElevY: -0.96, toElevY: -2.0, steps: 6 },
    { id: 'stair_beach_s', minX: 120.8, maxX: 123.8, minZ: 42.6, maxZ: 44.8, axis: 'x', fromElevY: -1.0, toElevY: -2.0, steps: 6 },
  ] as readonly BeachClubStairFlightSpec[],

  // 4. Elevated Crossing Timber Bridge over West Flanking Pool (VIP Mezzanine +0.64m -> Stair Landing +0.72m)
  crossingBridge: {
    minX: 91.4,
    maxX: 99.6,
    minZ: -16.2,
    maxZ: -12.4,
    elevY: 0.72,
  },

  // 5. Translucent Glowing Glass Skylight Dance Deck directly IN FRONT (East +X) of the Grand DJ Building (-0.48m)
  skylightDanceFloor: {
    minX: 112.0,
    maxX: 120.2,
    minZ: -9.6,
    maxZ: 3.2,
    elevY: -0.48,
  },

  // 6. Grand Luxury DJ Performance Building (facing East +X toward the beach & Skylight Dance Floor, with 2.3m rear corridor!)
  djStage: {
    cx: 105.8,
    cz: -3.2,
    rotY: Math.PI / 2,
    widthM: 14.0,
    depthM: 7.8,
    heightM: 6.4,
    baseDeckY: -0.56,
    stageDeckTopY: -0.04,
    glassBoxWidthM: 4.0,
    glassBoxDepthM: 3.5,
    glassBoxProjectM: 1.5,
    boothWidthM: 2.8,
    boothDepthM: 1.15,
    boothHeightM: 1.48,
    speakerHalfX: 0.55,
    speakerHalfZ: 0.55,
    speakerHeightM: 2.95,
  },

  // 7. Enlarged Modern Luxury Cocktail Bar (ZERO WOOD: fluted white stone, Calacatta marble, brass, ivory terrazzo pad on +0.68m upper cliff!)
  // Oriented East (+X, rotY = +PI/2) facing the beach & ocean, enlarged so avatars can comfortably walk up and sit on its 8 luxury barstools.
  cocktailBar: {
    cx: 96.2,
    cz: 38.2,
    rotY: Math.PI / 2,
    padRadiusM: 6.45,
    padElevY: 0.68,
    barWidthM: 9.6,
    barDepthM: 6.4,
    barHeightM: 5.35,
    counterHeightM: 1.82,
    uRadiusM: 3.55,
    uCenterZM: -0.24,
    stoolRadiusM: 4.73,
    stoolCount: 8,
  },

  // 7B. Tall, Thick White Calacatta Marble Dividing Wall between Kai's Beach (z > 45.2) and the Beach Club (z <= 45.2)
  // Spans the full arrow length from the East edge of Kai's boardwalk (x = 91.2) to the beachfront stair foot (x = 123.8).
  southBoundaryWall: {
    id: 'beach_club_south_marble_boundary_wall',
    minX: 91.2,
    maxX: 123.8,
    cz: 45.52,
    thicknessZ: 0.92,
    baseY: -2.15,
    upperTopY: 3.35,
    lowerTopY: 2.55,
    stepX: 106.4,
  },

  // 8. Stepped Cascade Water Terraces + Lowered Box 1 Resort Infinity Lagoons
  pools: {
    // 3 Grand Cascading Waterfall Basins at North Crown (+0.32m -> +0.02m -> -0.26m in Box 1)
    cascadeTier1: {
      id: 'pool_cascade_1',
      minX: 99.6,
      maxX: 119.6,
      minZ: -94.0,
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

    // Stepped Box 1 Resort Lagoon Channels (South of Jetty Bridge z=-45.5..-17.6; North half flattened into White Marble Plaza!)
    lapChannels: [
      { id: 'pool_north_inner_lagoon', minX: 100.4, maxX: 104.8, minZ: -45.5, maxZ: -17.6 },
      { id: 'pool_north_sea_lower', minX: 112.4, maxX: 120.4, minZ: -45.5, maxZ: -17.6 },
    ] as readonly BeachClubRect[],

    // Sleek Upper West Reflecting Moat bordering the +0.64m VIP Cabanas (+0.52m water)
    westFlankNorth: { id: 'pool_west_flank_n', minX: 96.4, maxX: 99.4, minZ: -74.2, maxZ: -51.2 } as BeachClubRect,
    westFlankSouth: { id: 'pool_west_flank_s', minX: 96.4, maxX: 99.4, minZ: -45.0, maxZ: -17.2 } as BeachClubRect,

    // Straight Aligned South Beachfront Infinity Lagoon (-1.02m water overlooking -2.00m sand, rotY = 0!)
    // Starts at minX = 108.4 (cx 114.4 - halfX 6.0) leaving a full 2.0m dry poolside promenade east of stair_mid_ocean_s (106.4)
    southSeaPool: {
      id: 'pool_south_sea',
      cx: 114.4,
      cz: 25.4,
      halfX: 6.0,
      halfZ: 17.2,
      rotY: 0,
      waterY: -1.02,
      deckY: -1.0,
    } as BeachClubOrientedRect,
  },

  // 9. Raised Timber Sunbed Peninsula (-0.54m, south of Jetty Bridge) & Cross-Water Timber Jetty Bridge (-0.48m) in Box 1
  sunbedPeninsula: {
    minX: 105.0,
    maxX: 112.2,
    minZ: -45.6,
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

  // 10. 5 Modern Luxury VIP Cabana Suites on the -0.54m Timber Sunbed Peninsula (South of Jetty Bridge)
  cabanas: [
    ...[-42.5, -36.5, -30.5, -24.5, -19.2].map(
      (z, idx): BeachClubCabanaSpec => ({
        id: `beach_club_cabana_n_${idx}`,
        cx: 108.6,
        cz: z,
        rotY: Math.PI / 2,
        plinthHalfX: 1.55,
        plinthHalfZ: 1.6,
        plinthTopY: -0.42,
        hasLoungerPair: false,
      }),
    ),
  ] as readonly BeachClubCabanaSpec[],

  // 11. 6 Square White Floating Sunken Lounge Pods w/ Table Lanterns aligned straight (rotY = 0) inside the South Oceanfront Infinity Pool
  sunkenPods: [
    ...[13.4, 21.4, 29.4, 37.4].map((cz, idx): BeachClubSunkenPodSpec => ({
      id: `beach_club_pod_sea_w_${idx}`,
      poolId: 'south_sea_pool',
      cx: 111.0,
      cz,
      rotY: 0,
      sizeM: 2.7,
      waterY: -1.02,
    })),
    ...[17.4, 33.4].map((cz, idx): BeachClubSunkenPodSpec => ({
      id: `beach_club_pod_sea_e_${idx}`,
      poolId: 'south_sea_pool',
      cx: 117.0,
      cz,
      rotY: 0,
      sizeM: 2.7,
      waterY: -1.02,
    })),
  ] as readonly BeachClubSunkenPodSpec[],

  // 12. Open Natural Beachfront (parasols removed for serene natural shoreline with coastal boulders & shallow marine life!)
  beachSets: [] as readonly BeachClubBeachSetSpec[],

  // 13. Crisscross Catenary Festoon Bulb Garlands (all pole bases planted cleanly on dry deck/sand — zero poles in water or cabanas!)
  festoonSpans: [
    { id: 'festoon_s_1', ax: 92.4, ay: 4.5, az: 10.5, bx: 121.8, by: 3.35, bz: 17.5, sagM: 1.0, bulbCount: 16 },
    { id: 'festoon_s_2', ax: 121.8, ay: 3.35, az: 10.5, bx: 92.4, by: 4.5, bz: 22.0, sagM: 1.05, bulbCount: 16 },
    { id: 'festoon_s_3', ax: 92.4, ay: 4.5, az: 22.0, bx: 121.8, by: 3.35, bz: 32.0, sagM: 1.0, bulbCount: 16 },
    { id: 'festoon_s_4', ax: 121.8, ay: 3.35, az: 25.0, bx: 92.4, by: 4.5, bz: 31.2, sagM: 1.0, bulbCount: 16 },
    { id: 'festoon_s_5', ax: 92.4, ay: 4.5, az: 31.2, bx: 121.8, by: 3.35, bz: 41.5, sagM: 0.95, bulbCount: 15 },
    // North Sunbed Peninsula festoon canopy: West poles in VIP breezeways (x=95.8), East poles on dry Sunbed Peninsula (x=111.8)!
    { id: 'festoon_n_1', ax: 95.8, ay: 4.5, az: -22.0, bx: 111.8, by: 3.4, bz: -18.5, sagM: 0.95, bulbCount: 16 },
    { id: 'festoon_n_2', ax: 95.8, ay: 4.5, az: -36.8, bx: 111.8, by: 3.4, bz: -30.5, sagM: 0.95, bulbCount: 16 },
    { id: 'festoon_n_3', ax: 111.8, ay: 3.4, az: -43.0, bx: 95.8, by: 4.5, bz: -50.8, sagM: 1.0, bulbCount: 16 },
    { id: 'festoon_n_4', ax: 95.8, ay: 4.5, az: -65.8, bx: 111.8, by: 3.4, bz: -60.0, sagM: 0.95, bulbCount: 16 },
  ] as readonly BeachClubFestoonSpanSpec[],

  // 14. Twin Promenade Coconut Palms + Courtyard & Island Palms (seated accurately on tiered ground, clear of all stairs & jetty!)
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
    const eastZs = [-90, -82, -72, -62, -52, -42, -32, -22, -10, 0, 10, 20, 34, 41];
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
    // Accent island palms on tiered decks (clear of all stair landings and northJettyBridge!)
    list.push(
      { id: 'bc_palm_island_s1', x: 102.6, z: 22.8, baseY: -0.56, scale: 1.16, leanX: 0.08, leanZ: 0.05, rotY: 0.4 },
      { id: 'bc_palm_island_s2', x: 102.0, z: 16.8, baseY: -0.56, scale: 1.1, leanX: -0.05, leanZ: -0.06, rotY: 2.1 },
      { id: 'bc_palm_bar_1', x: 93.2, z: 23.2, baseY: 0.64, scale: 1.12, leanX: 0.06, leanZ: 0.04, rotY: 1.4 },
      { id: 'bc_palm_pen_1', x: 108.6, z: -50.4, baseY: -0.54, scale: 1.14, leanX: 0.04, leanZ: 0.05, rotY: 2.5 },
      { id: 'bc_palm_n_courtyard', x: 95.6, z: -83.2, baseY: 0.64, scale: 1.2, leanX: 0.04, leanZ: -0.05, rotY: 3.1 },
    );
    return list as readonly BeachClubPalmSpec[];
  })(),

  // 15. Stepped Tropical Foliage Planter Borders (shared 1:1 between 3D builder and collider audit)
  planters: [
    { id: 'bc_planter_prom_n', cx: 91.4, cz: -81.0, widthX: 0.65, lengthZ: 22.0, baseY: 0.64, topY: 1.23 },
    { id: 'bc_planter_prom_c', cx: 91.4, cz: -39.0, widthX: 0.65, lengthZ: 36.0, baseY: 0.64, topY: 1.23 },
    { id: 'bc_planter_prom_s', cx: 91.4, cz: 7.0, widthX: 0.65, lengthZ: 32.0, baseY: 0.64, topY: 1.23 },
    { id: 'bc_planter_mid_w', cx: 99.8, cz: -32.0, widthX: 0.55, lengthZ: 22.0, baseY: -0.56, topY: -0.03 },
  ] as readonly BeachClubPlanterSpec[],
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
    const remLz = dj.depthM * 0.5 + 1.5 - lz;
    const landX = worldX + remLz * sinR;
    const landZ = worldZ + remLz * cosR;
    const landElev =
      landZ >= 7.4 ? (landX >= 106.4 ? -1.0 : -0.56) : landX >= 112.0 ? -0.96 : -0.56;
    elev = landElev + (dj.stageDeckTopY - landElev) * tStep;
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
  const beachStair = BEACH_CLUB_MASTERPLAN.stairFlights.find(
    (s) => s.id.startsWith('stair_beach_') && worldX >= s.minX && worldX <= s.maxX && worldZ >= s.minZ && worldZ <= s.maxZ,
  );
  if (beachStair) {
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
 * Interactive sittable barstool spots around the enlarged Modern Luxury Cocktail Bar horseshoe counter.
 * Each spot faces inward toward the Calacatta marble bar counter and steps outward onto the +0.68m terrazzo podium on stand-up.
 */
export const BEACH_CLUB_COCKTAIL_BAR_SEAT_SPOTS: readonly BeachClubSeatSpotSpec[] = (() => {
  const bar = BEACH_CLUB_MASTERPLAN.cocktailBar;
  const bc = Math.cos(bar.rotY);
  const bs = Math.sin(bar.rotY);
  const spots: BeachClubSeatSpotSpec[] = [];
  const n = bar.stoolCount;
  for (let s = 0; s < n; s++) {
    const a = 0.14 + (s / (n - 1)) * (Math.PI - 0.28);
    const lx = Math.cos(a) * bar.stoolRadiusM;
    const lz = Math.sin(a) * bar.stoolRadiusM + bar.uCenterZM;
    const wx = bar.cx + lx * bc + lz * bs;
    const wz = bar.cz - lx * bs + lz * bc;
    const fwdX = -Math.cos(a) * bc - Math.sin(a) * bs;
    const fwdZ = Math.cos(a) * bs - Math.sin(a) * bc;
    const yaw = Math.atan2(-fwdZ, fwdX);
    const standOutDist = 0.92;
    spots.push({
      id: `beach_club_bar_stool_${s + 1}`,
      x: Number(wx.toFixed(2)),
      z: Number(wz.toFixed(2)),
      yaw: Number(yaw.toFixed(4)),
      seatLiftY: 0.34,
      indicatorHeightY: 1.58,
      standUpX: Number((wx - fwdX * standOutDist).toFixed(2)),
      standUpZ: Number((wz - fwdZ * standOutDist).toFixed(2)),
    });
  }
  return spots;
})();

/**
 * Exports all Beach Club staircase footprints for staircase corridor physics & A* routing.
 */
export function getBeachClubStairCorridors(): BeachClubStairCorridorSpec[] {
  return BEACH_CLUB_MASTERPLAN.stairFlights.map((sf) => ({
    id: sf.id,
    minX: sf.minX,
    maxX: sf.maxX,
    minZ: sf.minZ,
    maxZ: sf.maxZ,
    axis: sf.axis,
  }));
}

/**
 * Audited static 2D OBB colliders for Beach Club architectural structures, speaker stacks,
 * DJ booth, Aqua Glass Box walls, Cocktail Bar counter/backwall, Cabana beds, loungers,
 * tropical foliage planters, height-aware retaining/infinity weir walls, south marble dividing wall, and palms.
 * All `heightY` values are true world-space top elevations (m) for terrace-aware collision.
 */
export function getBeachClubObstacles(): StaticWorldStructureObb[] {
  const obstacles: StaticWorldStructureObb[] = [];

  // 1. Grand Luxury DJ Performance Building Solid Sub-volumes (matched 1:1 to buddiesBeachClubBuilder.ts)
  const dj = BEACH_CLUB_MASTERPLAN.djStage;
  const cR = Math.cos(dj.rotY);
  const sR = Math.sin(dj.rotY);
  const toWorldDj = (lx: number, lz: number): [number, number] => [
    dj.cx + lx * cR + lz * sR,
    dj.cz - lx * sR + lz * cR,
  ];
  // Backstage steel stair & glass balustrade side enclosure
  const [gbX, gbZ] = toWorldDj(6.25, -2.35);
  obstacles.push({
    id: 'beach_club_dj_glass_box',
    x: gbX,
    z: gbZ,
    halfX: 0.78,
    halfZ: 1.78,
    rotY: dj.rotY,
    heightY: dj.stageDeckTopY + 3.35,
    mat: 'metal',
  });
  // Calacatta Marble Master DJ Console (center stage)
  const [boothX, boothZ] = toWorldDj(0, 0.96);
  obstacles.push({
    id: 'beach_club_dj_booth',
    x: boothX,
    z: boothZ,
    halfX: 1.62,
    halfZ: 0.66,
    rotY: dj.rotY,
    heightY: dj.stageDeckTopY + 1.66,
    mat: 'concrete',
  });
  // Left & Right Concert Line-Array Wing Audio Towers
  for (const [spId, slx, slz] of [
    ['beach_club_dj_speaker_w', -6.15, -0.35],
    ['beach_club_dj_speaker_e', 6.15, -0.35],
  ] as const) {
    const [sx, sz] = toWorldDj(slx, slz);
    obstacles.push({
      id: spId,
      x: sx,
      z: sz,
      halfX: 0.62,
      halfZ: 0.6,
      rotY: dj.rotY,
      heightY: dj.stageDeckTopY + 2.8,
      mat: 'metal',
    });
  }
  // Grand Panoramic LED Media Wall + Enclosed Backstage Sound Engineering Control Room
  const [backX, backZ] = toWorldDj(0, -2.95);
  obstacles.push({
    id: 'beach_club_dj_backwall',
    x: backX,
    z: backZ,
    halfX: 5.15,
    halfZ: 1.25,
    rotY: dj.rotY,
    heightY: dj.stageDeckTopY + 4.65,
    mat: 'metal',
  });

  // 2. Enlarged Modern Luxury Cocktail Bar (fluted white stone counter horseshoe + Calacatta marble bottle wall)
  //    Counter collider stays strictly inside the 4.73m barstool ring so avatars can walk up and sit on all 8 stools.
  const bar = BEACH_CLUB_MASTERPLAN.cocktailBar;
  const bc = Math.cos(bar.rotY);
  const bs = Math.sin(bar.rotY);
  const toWorldBar = (lx: number, lz: number): [number, number] => [
    bar.cx + lx * bc + lz * bs,
    bar.cz - lx * bs + lz * bc,
  ];
  const [bcntX, bcntZ] = toWorldBar(0, 1.45);
  obstacles.push({
    id: 'beach_club_bar_counter',
    x: bcntX,
    z: bcntZ,
    halfX: 3.45,
    halfZ: 1.38,
    rotY: bar.rotY,
    heightY: bar.padElevY + bar.counterHeightM,
    mat: 'concrete',
  });
  const [bwallX, bwallZ] = toWorldBar(0, -2.25);
  obstacles.push({
    id: 'beach_club_bar_backwall',
    x: bwallX,
    z: bwallZ,
    halfX: 3.65,
    halfZ: 0.72,
    rotY: bar.rotY,
    heightY: bar.padElevY + 4.88,
    mat: 'concrete',
  });

  // 2B. Tall, Thick White Calacatta Marble Dividing Wall between Kai's Beach and the Beach Club
  const sw = BEACH_CLUB_MASTERPLAN.southBoundaryWall;
  const swColMinX = 91.42;
  obstacles.push({
    id: sw.id,
    x: (swColMinX + sw.maxX) * 0.5,
    z: sw.cz,
    halfX: (sw.maxX - swColMinX) * 0.5,
    halfZ: sw.thicknessZ * 0.5,
    rotY: 0,
    heightY: sw.upperTopY,
    mat: 'concrete',
  });

  // 3. 5 VIP Cabanas: plush king daybed collider inside each cabana (matched 1:1 to 1.78 x 2.02m daybed)
  for (const cab of BEACH_CLUB_MASTERPLAN.cabanas) {
    obstacles.push({
      id: `${cab.id}_bed`,
      x: cab.cx - 0.38,
      z: cab.cz,
      halfX: 0.9,
      halfZ: 1.04,
      rotY: 0,
      heightY: cab.plinthTopY + 0.72,
      mat: 'wood',
    });
  }

  // 4. Seaward Beach Parasol & Poolside Sunbed Sets
  for (const bsItem of BEACH_CLUB_MASTERPLAN.beachSets) {
    obstacles.push({
      id: `${bsItem.id}_cluster`,
      x: bsItem.cx,
      z: bsItem.cz,
      halfX: 1.05,
      halfZ: bsItem.variant === 'sand_woven' ? 0.98 : 1.05,
      rotY: bsItem.rotY,
      heightY: bsItem.elevY + 2.6,
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
      heightY: palm.baseY + 7.2,
      mat: 'wood',
    });
  }

  // 6. Stepped Tropical Foliage Planter Borders (height-aware: bc_planter_mid_w topY=-0.03 never blocks +0.64m VIP terrace!)
  for (const planter of BEACH_CLUB_MASTERPLAN.planters) {
    obstacles.push({
      id: planter.id,
      x: planter.cx,
      z: planter.cz,
      halfX: planter.widthX * 0.5,
      halfZ: planter.lengthZ * 0.5,
      rotY: 0,
      heightY: planter.topY,
      mat: 'concrete',
    });
  }

  // 7. Height-Aware Retaining Walls & Oceanfront Infinity Weir Faces (strictly below upper terrace elevY!)
  //    Never block players walking on the upper terrace; prevent clipping into vertical cliffs from lower terraces/sand.
  obstacles.push(
    {
      id: 'beach_club_retaining_vip_south_mid',
      x: 96.4,
      z: 19.6,
      halfX: 0.16,
      halfZ: 5.4,
      rotY: 0,
      heightY: 0.56, // < +0.64m VIP Mezzanine, > -0.56m South Inner Lounge
      mat: 'concrete',
      isRetainingWall: true,
    },
    {
      id: 'beach_club_retaining_weir_n1',
      x: 120.6,
      z: -62.15,
      halfX: 0.18,
      halfZ: 12.2,
      rotY: 0,
      heightY: -1.06, // < -0.96m Ocean Terrace, > -2.00m Golden Sand
      mat: 'concrete',
      isRetainingWall: true,
    },
    {
      id: 'beach_club_retaining_weir_n2',
      x: 120.6,
      z: -31.55,
      halfX: 0.18,
      halfZ: 13.6,
      rotY: 0,
      heightY: -1.06,
      mat: 'concrete',
      isRetainingWall: true,
    },
    {
      id: 'beach_club_retaining_weir_s',
      x: 120.6,
      z: 25.3,
      halfX: 0.18,
      halfZ: 16.9,
      rotY: 0,
      heightY: -1.06, // < -1.00m South Ocean Terrace, > -2.00m Golden Sand
      mat: 'concrete',
      isRetainingWall: true,
    },
  );

  return obstacles;
}
