import type { StaticWorldStructureObb } from './buddiesBlitzTypes';

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export interface BumperCarKinematicsState {
  index: number;
  localX: number;
  localZ: number;
  yaw: number;
  colorHex: string;
}

export interface AmusementParkRideKinematics {
  bianglalaWheelAngleRad: number;
  bianglalaGondolaCounterAngleRad: number;
  koraKoraSwingAngleRad: number;
  komidiPutarAngleRad: number;
  komidiPutarHorseBobsM: readonly number[];
  ontagAntingSpinAngleRad: number;
  ontagAntingTiltAngleRad: number;
  ontagAntingChairFlareRad: readonly number[];
  bumperCars: readonly BumperCarKinematicsState[];
}

export interface CarnivalStallSpec {
  id: string;
  kind: 'striped_tent' | 'popcorn_kiosk' | 'cotton_candy_cart';
  x: number;
  z: number;
  rotY: number;
  stripePrimaryHex: string;
  stripeSecondaryHex: string;
  counterHex: string;
  accentType: 'ring_toss' | 'plush_prizes' | 'can_smash' | 'snacks' | 'popcorn' | 'gulali';
}

/**
 * Returns the East shoreline X coordinate in meters for NE Taman Ria & East Coast:
 * - South of z = -45.5 (Bianglala over-water pier bay, Dermaga Harbor, SE Beach): shoreline remains at x = 110.0m
 *   so the Bianglala pier & L-shaped jetty genuinely cantilever over deep ocean water on pilings.
 * - North of z = -45.5 (z in [-105.5 .. -45.5]): smoothly reclaims +16.5m of golden coastal sand eastward
 *   into the sea (shoreline curves cleanly out to x = 126.5m) for Kora-Kora waterfront, palm beach, and
 *   the full-scale 18m x 12.4m Bumper Car Arena foundation.
 */
export function getNeTamanRiaShorelineX(worldZ: number): number {
  const neReclaim =
    smoothstep(-105.5, -96.0, worldZ) * (1.0 - smoothstep(-54.0, -45.5, worldZ));
  return 110.0 + 16.5 * neReclaim;
}

export const COASTAL_AMUSEMENT_PARK_MASTERPLAN = {
  // Overall footprint: Northern Dermaga (z in [-46..-19.2]) + Reclaimed Northern Beach (x up to 126.5) + Over-Water Pier (x up to 129.8)
  bounds: {
    minX: 76.5,
    maxX: 129.8,
    minZ: -103.8,
    maxZ: -19.2,
  },
  boardwalkDeckY: 1.1,
  koraDockStageY: 2.02,
  // Main Waterfront Timber Boardwalk along the seaward edge (covers x=110 quay wall in [-46..-21] & hugs reclaimed beach in [-74.5..-46])
  mainBoardwalk: {
    minX: 101.5,
    maxX: 117.0,
    minZ: -74.5,
    maxZ: -21.0,
  },
  // Over-Water Square Timber Pier Deck supporting Bianglala (extending past x = 110 over Open Ocean)
  bianglalaPierDeck: {
    minX: 110.5,
    maxX: 124.8,
    minZ: -42.2,
    maxZ: -22.8,
  },
  // Over-Water L-Shaped / Seaward Pier Finger & Tented Gazebo Jetty (abuts flush at x = 124.8 & 126.2 with zero slab overlap)
  gazeboFingerJetty: {
    walkwayMinX: 124.8,
    walkwayMaxX: 126.2,
    walkwayMinZ: -28.4,
    walkwayMaxZ: -24.8,
    headMinX: 126.2,
    headMaxX: 129.8,
    headMinZ: -29.8,
    headMaxZ: -23.4,
    gazeboCenterX: 128.0,
    gazeboCenterZ: -26.6,
  },
  // Access Stairs / Ramps onto the +1.10m Boardwalk (landward + seaward beach steps!)
  stairs: {
    southDermaga: { minX: 103.5, maxX: 108.5, minZ: -21.0, maxZ: -18.8 },
    westBianglala: { minX: 99.1, maxX: 101.5, minZ: -35.6, maxZ: -29.8 },
    westCarousel: { minX: 99.1, maxX: 101.5, minZ: -50.2, maxZ: -44.2 },
    northBeach: { minX: 105.0, maxX: 111.0, minZ: -76.9, maxZ: -74.5 },
    eastBeach: { minX: 117.0, maxX: 119.4, minZ: -70.5, maxZ: -65.5 },
  },
  // Grand Entrance Archway facing South (+Z) toward Northern Dermaga & z = -15 Harbor Road Entrance
  entranceArch: {
    x: 87.5,
    z: -20.4,
    clearHalfSpanX: 4.2,
    pillarHalfSize: 0.6,
  },
  // 5 Hero Rides (1:1 with Reference Model Sheets)
  rides: {
    bianglala: {
      x: 118.2,
      z: -32.5,
      deckY: 1.1,
      axleHeightAboveDeck: 13.8,
      wheelRadius: 11.6,
      rimSeparationZ: 2.3,
      gondolaCount: 16,
      footingHalfSpanX: 5.8,
      footingHalfSpanZ: 4.4,
    },
    koraKora: {
      x: 110.2,
      z: -57.5,
      deckY: 1.1,
      stageHeightAboveDeck: 0.92,
      pivotHeightAboveDeck: 15.2,
      pendulumLength: 12.1,
      hullLength: 14.6,
      hullWidth: 4.2,
      towerBaseHalfX: 4.35,
      towerBaseHalfZ: 5.55,
    },
    komidiPutar: {
      x: 92.5,
      z: -45.5,
      baseY: 0.0,
      fenceRadius: 5.45,
      platformRadius: 4.95,
      canopyRadius: 5.15,
      totalHeight: 9.8,
      horseCount: 10,
      chariotCount: 2,
      ticketPodiumX: 85.4,
      ticketPodiumZ: -42.5,
    },
    ontagAnting: {
      x: 90.0,
      z: -70.5,
      baseY: 0.0,
      fenceRadius: 6.5,
      podiumRadius: 6.0,
      canopyRadius: 5.3,
      totalHeight: 11.3,
      chairCount: 16,
      tiltAngleRad: 0.245,
    },
    bumperCarArena: {
      x: 104.5,
      z: -90.5,
      baseY: 0.0,
      halfX: 9.0,
      halfZ: 6.2,
      floorHalfX: 7.6,
      floorHalfZ: 4.9,
      roofPeakY: 6.65,
      carCount: 5,
    },
  },
} as const;

export const BIANGLALA_GONDOLA_PALETTE: readonly string[] = [
  '#ef4444', // Coral Red
  '#facc15', // Sunny Yellow
  '#38bdf8', // Sky Blue
  '#34d399', // Mint Green
  '#a78bfa', // Pastel Lavender
  '#fb923c', // Tangerine Orange
  '#f472b6', // Carnival Pink
  '#fde047', // Lemon Gold
  '#ef4444',
  '#38bdf8',
  '#34d399',
  '#fb923c',
  '#a78bfa',
  '#facc15',
  '#f472b6',
  '#60a5fa',
];

export const BUMPER_CAR_PALETTE: readonly string[] = [
  '#34d399', // Mint Green
  '#facc15', // Sunny Yellow
  '#f43f5e', // Coral Red
  '#3b82f6', // Cobalt Blue
  '#fb923c', // Warm Orange
];

export const CARNIVAL_MIDWAY_STALLS: readonly CarnivalStallSpec[] = [
  {
    id: 'stall_sw_ring_toss',
    kind: 'striped_tent',
    x: 80.5,
    z: -26.5,
    rotY: Math.PI / 2,
    stripePrimaryHex: '#dc2626',
    stripeSecondaryHex: '#fffbeb',
    counterHex: '#b45309',
    accentType: 'ring_toss',
  },
  {
    id: 'stall_sw_balloon_dart',
    kind: 'striped_tent',
    x: 80.5,
    z: -33.0,
    rotY: Math.PI / 2,
    stripePrimaryHex: '#2563eb',
    stripeSecondaryHex: '#fffbeb',
    counterHex: '#92400e',
    accentType: 'can_smash',
  },
  {
    id: 'stall_sw_prize_plush',
    kind: 'striped_tent',
    x: 80.5,
    z: -39.5,
    rotY: Math.PI / 2,
    stripePrimaryHex: '#d97706',
    stripeSecondaryHex: '#fefce8',
    counterHex: '#92400e',
    accentType: 'plush_prizes',
  },
  {
    id: 'stall_se_snacks',
    kind: 'striped_tent',
    x: 96.5,
    z: -25.8,
    rotY: -Math.PI / 2,
    stripePrimaryHex: '#ea580c',
    stripeSecondaryHex: '#fffbeb',
    counterHex: '#b45309',
    accentType: 'snacks',
  },
  {
    id: 'stall_se_carnival_cans',
    kind: 'striped_tent',
    x: 94.6,
    z: -33.0,
    rotY: -Math.PI / 2,
    stripePrimaryHex: '#e11d48',
    stripeSecondaryHex: '#fffbeb',
    counterHex: '#92400e',
    accentType: 'plush_prizes',
  },
  {
    id: 'stall_mid_popcorn_pink',
    kind: 'popcorn_kiosk',
    x: 80.6,
    z: -54.5,
    rotY: Math.PI / 2,
    stripePrimaryHex: '#f472b6',
    stripeSecondaryHex: '#fdf2f8',
    counterHex: '#ec4899',
    accentType: 'popcorn',
  },
  {
    id: 'stall_mid_blue_tent',
    kind: 'striped_tent',
    x: 80.5,
    z: -60.2,
    rotY: Math.PI / 2,
    stripePrimaryHex: '#0284c7',
    stripeSecondaryHex: '#f8fafc',
    counterHex: '#92400e',
    accentType: 'ring_toss',
  },
  {
    id: 'stall_mid_gulali_cart',
    kind: 'cotton_candy_cart',
    x: 98.2,
    z: -57.5,
    rotY: -Math.PI / 2,
    stripePrimaryHex: '#38bdf8',
    stripeSecondaryHex: '#f0f9ff',
    counterHex: '#0284c7',
    accentType: 'gulali',
  },
  {
    id: 'stall_north_red_tent',
    kind: 'striped_tent',
    x: 80.6,
    z: -80.5,
    rotY: Math.PI / 2,
    stripePrimaryHex: '#dc2626',
    stripeSecondaryHex: '#fffbeb',
    counterHex: '#92400e',
    accentType: 'snacks',
  },
  {
    id: 'stall_beach_orange_pavilion',
    kind: 'striped_tent',
    x: 84.2,
    z: -90.5,
    rotY: Math.PI / 2,
    stripePrimaryHex: '#ea580c',
    stripeSecondaryHex: '#fff7ed',
    counterHex: '#b45309',
    accentType: 'plush_prizes',
  },
  {
    id: 'stall_beach_surf_snacks',
    kind: 'striped_tent',
    x: 118.2,
    z: -79.5,
    rotY: -Math.PI / 2,
    stripePrimaryHex: '#0d9488',
    stripeSecondaryHex: '#fffbeb',
    counterHex: '#b45309',
    accentType: 'snacks',
  },
];

export const AMUSEMENT_PARK_PALM_TREES: readonly {
  id: string;
  x: number;
  z: number;
  scale: number;
  rotY: number;
}[] = [
  { id: 'taman_palm_1', x: 77.2, z: -47.2, scale: 1.04, rotY: 0.4 },
  { id: 'taman_palm_2', x: 77.2, z: -67.5, scale: 0.98, rotY: 1.7 },
  { id: 'taman_palm_3', x: 77.2, z: -74.8, scale: 1.06, rotY: 2.9 },
  { id: 'taman_palm_4', x: 77.5, z: -97.8, scale: 1.1, rotY: 0.9 },
  { id: 'taman_palm_5', x: 89.8, z: -101.8, scale: 1.04, rotY: 2.1 },
  { id: 'taman_palm_6', x: 104.5, z: -102.6, scale: 1.02, rotY: 3.4 },
  { id: 'taman_palm_7', x: 119.6, z: -98.0, scale: 1.04, rotY: 4.1 },
  { id: 'taman_palm_8', x: 121.2, z: -88.2, scale: 1.08, rotY: 5.0 },
  { id: 'taman_palm_9', x: 122.2, z: -73.0, scale: 0.98, rotY: 1.4 },
  { id: 'taman_palm_10', x: 122.5, z: -61.8, scale: 1.04, rotY: 2.6 },
  { id: 'taman_palm_11', x: 122.0, z: -54.2, scale: 0.96, rotY: 0.8 },
  { id: 'taman_palm_12', x: 77.0, z: -21.8, scale: 1.0, rotY: 3.8 },
];

export interface AmusementParkRailingRunSpec {
  id: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export const AMUSEMENT_PARK_RAILING_RUNS: readonly AmusementParkRailingRunSpec[] = [
  // West main boardwalk segments (leaving gaps at westBianglala [-35.6..-29.8] and westCarousel [-50.2..-44.2])
  { id: 'taman_rail_west_s', x1: 101.65, z1: -21.2, x2: 101.65, z2: -29.6 },
  { id: 'taman_rail_west_m', x1: 101.65, z1: -35.8, x2: 101.65, z2: -44.0 },
  { id: 'taman_rail_west_n', x1: 101.65, z1: -50.4, x2: 101.65, z2: -74.3 },
  // South main boardwalk segments (leaving gap at southDermaga [103.5..108.5])
  { id: 'taman_rail_south_w', x1: 101.65, z1: -21.15, x2: 103.4, z2: -21.15 },
  { id: 'taman_rail_south_e', x1: 108.6, z1: -21.15, x2: 116.85, z2: -21.15 },
  // North main boardwalk segments (leaving gap at northBeach [105.0..111.0])
  { id: 'taman_rail_north_w', x1: 101.65, z1: -74.35, x2: 104.9, z2: -74.35 },
  { id: 'taman_rail_north_e', x1: 111.1, z1: -74.35, x2: 116.85, z2: -74.35 },
  // East main boardwalk segments (leaving openings at Bianglala Pier [-42.2..-22.8] and eastBeach [-70.5..-65.5])
  { id: 'taman_rail_east_s', x1: 116.85, z1: -21.2, x2: 116.85, z2: -22.8 },
  { id: 'taman_rail_east_m', x1: 116.85, z1: -42.2, x2: 116.85, z2: -65.3 },
  { id: 'taman_rail_east_n', x1: 116.85, z1: -70.7, x2: 116.85, z2: -74.3 },
  // Bianglala Over-Water Pier outer railings (leaving Gazebo Finger Jetty opening at z in [-28.4..-24.8])
  { id: 'taman_pier_rail_n', x1: 116.85, z1: -42.05, x2: 124.65, z2: -42.05 },
  { id: 'taman_pier_rail_s', x1: 116.85, z1: -22.95, x2: 124.65, z2: -22.95 },
  { id: 'taman_pier_rail_e_n', x1: 124.65, z1: -42.05, x2: 124.65, z2: -28.5 },
  { id: 'taman_pier_rail_e_s', x1: 124.65, z1: -24.7, x2: 124.65, z2: -22.95 },
  // Seaward Gazebo Finger Jetty walkway & pierhead railings
  { id: 'taman_jetty_rail_n', x1: 124.65, z1: -28.25, x2: 126.35, z2: -28.25 },
  { id: 'taman_jetty_rail_s', x1: 124.65, z1: -24.95, x2: 126.35, z2: -24.95 },
  { id: 'taman_gazebo_rail_n', x1: 126.35, z1: -29.65, x2: 129.65, z2: -29.65 },
  { id: 'taman_gazebo_rail_s', x1: 126.35, z1: -23.55, x2: 129.65, z2: -23.55 },
  { id: 'taman_gazebo_rail_e', x1: 129.65, z1: -29.65, x2: 129.65, z2: -23.55 },
  { id: 'taman_gazebo_rail_wn', x1: 126.35, z1: -29.65, x2: 126.35, z2: -28.25 },
  { id: 'taman_gazebo_rail_ws', x1: 126.35, z1: -24.95, x2: 126.35, z2: -23.55 },
];

/**
 * Returns true if (worldX, worldZ) sits on the walkable Over-Water Pier Deck
 * (Seaward cantilever of Main Boardwalk, Bianglala Square Pier, or Gazebo Finger Jetty extending past shore).
 */
export function isPointOnAmusementOverwaterPier(worldX: number, worldZ: number): boolean {
  const { mainBoardwalk, bianglalaPierDeck, gazeboFingerJetty } = COASTAL_AMUSEMENT_PARK_MASTERPLAN;
  const onCantileverBoardwalk =
    worldX >= 109.2 &&
    worldX <= mainBoardwalk.maxX - 0.35 &&
    worldZ >= mainBoardwalk.minZ + 0.35 &&
    worldZ <= mainBoardwalk.maxZ - 0.35;
  if (onCantileverBoardwalk) return true;

  const onBianglalaDeck =
    worldX >= bianglalaPierDeck.minX &&
    worldX <= bianglalaPierDeck.maxX - 0.45 &&
    worldZ >= bianglalaPierDeck.minZ + 0.45 &&
    worldZ <= bianglalaPierDeck.maxZ - 0.45;
  if (onBianglalaDeck) return true;

  const onFingerWalkway =
    worldX >= gazeboFingerJetty.walkwayMinX &&
    worldX <= gazeboFingerJetty.walkwayMaxX &&
    worldZ >= gazeboFingerJetty.walkwayMinZ + 0.35 &&
    worldZ <= gazeboFingerJetty.walkwayMaxZ - 0.35;
  if (onFingerWalkway) return true;

  const onGazeboHead =
    worldX >= gazeboFingerJetty.headMinX &&
    worldX <= gazeboFingerJetty.headMaxX - 0.45 &&
    worldZ >= gazeboFingerJetty.headMinZ + 0.45 &&
    worldZ <= gazeboFingerJetty.headMaxZ - 0.45;
  return onGazeboHead;
}

/**
 * Evaluates the walkable elevation (in meters) of the Taman Ria Waterfront Timber Boardwalk (+1.10m),
 * Over-Water Bianglala Pier Deck (+1.10m), Gazebo Jetty (+1.10m), Kora-Kora Dual Boarding Stages (+2.02m),
 * and their smooth access stairs/ramps.
 */
export function evaluateAmusementBoardwalkElevation(worldX: number, worldZ: number): number {
  const mp = COASTAL_AMUSEMENT_PARK_MASTERPLAN;
  if (worldX < 98.5 || worldX > 130.2 || worldZ < -77.5 || worldZ > -18.5) {
    return 0.0;
  }

  let elev = 0.0;
  const deckY = mp.boardwalkDeckY;

  // 1. Main Waterfront Boardwalk [101.5..117.0] x [-74.5..-21.0]
  if (
    worldX >= mp.mainBoardwalk.minX &&
    worldX <= mp.mainBoardwalk.maxX &&
    worldZ >= mp.mainBoardwalk.minZ &&
    worldZ <= mp.mainBoardwalk.maxZ
  ) {
    elev = Math.max(elev, deckY);
  }

  // 2. Over-Water Bianglala Square Pier Deck [110.5..124.8] x [-42.2..-22.8]
  if (
    worldX >= mp.bianglalaPierDeck.minX &&
    worldX <= mp.bianglalaPierDeck.maxX &&
    worldZ >= mp.bianglalaPierDeck.minZ &&
    worldZ <= mp.bianglalaPierDeck.maxZ
  ) {
    elev = Math.max(elev, deckY);
  }

  // 3. Seaward Finger Jetty & Pierhead Gazebo
  if (
    worldX >= mp.gazeboFingerJetty.walkwayMinX &&
    worldX <= mp.gazeboFingerJetty.walkwayMaxX &&
    worldZ >= mp.gazeboFingerJetty.walkwayMinZ &&
    worldZ <= mp.gazeboFingerJetty.walkwayMaxZ
  ) {
    elev = Math.max(elev, deckY);
  }
  if (
    worldX >= mp.gazeboFingerJetty.headMinX &&
    worldX <= mp.gazeboFingerJetty.headMaxX &&
    worldZ >= mp.gazeboFingerJetty.headMinZ &&
    worldZ <= mp.gazeboFingerJetty.headMaxZ
  ) {
    elev = Math.max(elev, deckY);
  }

  // 4. Five Access Stair/Ramp Transitions (0.0m <-> +1.10m)
  const sSouth = mp.stairs.southDermaga;
  if (worldX >= sSouth.minX && worldX <= sSouth.maxX && worldZ >= sSouth.minZ && worldZ <= sSouth.maxZ) {
    const t = 1.0 - smoothstep(sSouth.minZ, sSouth.maxZ, worldZ);
    elev = Math.max(elev, deckY * t);
  }

  const sWest1 = mp.stairs.westBianglala;
  if (worldX >= sWest1.minX && worldX <= sWest1.maxX && worldZ >= sWest1.minZ && worldZ <= sWest1.maxZ) {
    const t = smoothstep(sWest1.minX, sWest1.maxX, worldX);
    elev = Math.max(elev, deckY * t);
  }

  const sWest2 = mp.stairs.westCarousel;
  if (worldX >= sWest2.minX && worldX <= sWest2.maxX && worldZ >= sWest2.minZ && worldZ <= sWest2.maxZ) {
    const t = smoothstep(sWest2.minX, sWest2.maxX, worldX);
    elev = Math.max(elev, deckY * t);
  }

  const sNorth = mp.stairs.northBeach;
  if (worldX >= sNorth.minX && worldX <= sNorth.maxX && worldZ >= sNorth.minZ && worldZ <= sNorth.maxZ) {
    const t = smoothstep(sNorth.minZ, sNorth.maxZ, worldZ);
    elev = Math.max(elev, deckY * t);
  }

  const sEast = mp.stairs.eastBeach;
  if (worldX >= sEast.minX && worldX <= sEast.maxX && worldZ >= sEast.minZ && worldZ <= sEast.maxZ) {
    const t = 1.0 - smoothstep(sEast.minX, sEast.maxX, worldX);
    elev = Math.max(elev, deckY * t);
  }

  // 5. Kora-Kora Dual Symmetrical Raised Docking Stages (+2.02m) & Dual Entry/Exit Boarding Stairs
  const kk = mp.rides.koraKora;
  if (worldZ >= kk.z - 4.1 && worldZ <= kk.z + 4.1) {
    // West Stage & Stairs
    if (worldX >= kk.x - 4.18 && worldX <= kk.x - 2.18) {
      elev = Math.max(elev, mp.koraDockStageY);
    } else if (worldX >= kk.x - 5.95 && worldX < kk.x - 4.18 && worldZ >= kk.z - 2.2 && worldZ <= kk.z + 2.2) {
      const stairT = smoothstep(kk.x - 5.95, kk.x - 4.18, worldX);
      elev = Math.max(elev, deckY + (mp.koraDockStageY - deckY) * stairT);
    }
    // East Stage & Stairs
    if (worldX >= kk.x + 2.18 && worldX <= kk.x + 4.18) {
      elev = Math.max(elev, mp.koraDockStageY);
    } else if (worldX > kk.x + 4.18 && worldX <= kk.x + 5.95 && worldZ >= kk.z - 2.2 && worldZ <= kk.z + 2.2) {
      const stairT = 1.0 - smoothstep(kk.x + 4.18, kk.x + 5.95, worldX);
      elev = Math.max(elev, deckY + (mp.koraDockStageY - deckY) * stairT);
    }
  }

  return elev;
}

/**
 * Pure deterministic kinematics for all 5 animated rides at elapsed `timeSec`.
 * Pre-computes angles, bobbing heights, and 5 bumper car trajectories inside the arena.
 */
const _horseBobs = new Array<number>(10).fill(0);
const _chairFlares = new Array<number>(16).fill(0);
const _bumperCars: BumperCarKinematicsState[] = BUMPER_CAR_PALETTE.map((colorHex, index) => ({
  index,
  localX: 0,
  localZ: 0,
  yaw: 0,
  colorHex,
}));

export function evaluateAmusementParkRideKinematics(timeSec: number): AmusementParkRideKinematics {
  const t = Number.isFinite(timeSec) ? timeSec : 0;

  // 1. Bianglala: steady majestic counter-clockwise rotation; gondolas counter-rotate 1:1 to stay upright
  const bianglalaWheelAngleRad = (t * 0.24) % (Math.PI * 2);
  const bianglalaGondolaCounterAngleRad = -bianglalaWheelAngleRad;

  // 2. Kora-Kora: smooth harmonic pendulum swing (±0.58 rad ≈ ±33.2 deg)
  const koraKoraSwingAngleRad = Math.sin(t * 1.38) * 0.58;

  // 3. Komidi Putar: vintage carousel spin + 10 sinusoidal bobbing horses
  const komidiPutarAngleRad = (t * 0.62) % (Math.PI * 2);
  for (let i = 0; i < 10; i++) {
    const phase = (i / 10) * Math.PI * 2 * 2;
    _horseBobs[i] = 0.19 + Math.sin(t * 2.8 + phase) * 0.19;
  }

  // 4. Ontag-Anting: tilted rotating canopy + 16 chain-hung chairs flaring outward with wave ripple
  const ontagAntingSpinAngleRad = (t * 1.15) % (Math.PI * 2);
  const ontagAntingTiltAngleRad = COASTAL_AMUSEMENT_PARK_MASTERPLAN.rides.ontagAnting.tiltAngleRad;
  for (let i = 0; i < 16; i++) {
    const seatAzimuth = ontagAntingSpinAngleRad + (i / 16) * Math.PI * 2;
    _chairFlares[i] = 0.39 + Math.sin(seatAzimuth) * 0.08 + Math.cos(t * 2.3 + i * 0.7) * 0.025;
  }

  // 5. Bumper Car Arena: 5 vintage bumper cars cruising smoothly on non-intersecting oval lanes
  //    strictly inside floorHalfX = 7.6m, floorHalfZ = 4.9m while leaving East Parking Zone (localX >= +4.8) clear!
  const orbitSpecs: readonly [number, number, number, number, number, number][] = [
    // [centerX, centerZ, rx, rz, speed, phase]
    [-3.95, -1.75, 2.0, 1.35, 0.96, 0.0],
    [1.15, -1.75, 2.0, 1.35, -0.89, 1.3],
    [-3.95, 1.75, 2.0, 1.35, -0.92, 2.6],
    [1.15, 1.75, 2.0, 1.35, 0.87, 3.9],
    [-1.4, 0.0, 2.2, 1.15, 1.06, 5.1],
  ];
  for (let i = 0; i < 5; i++) {
    const [cx, cz, rx, rz, spd, ph] = orbitSpecs[i];
    const ang = t * spd + ph;
    const lx = cx + Math.cos(ang) * rx;
    const lz = cz + Math.sin(ang) * rz;
    const vx = -Math.sin(ang) * rx * spd;
    const vz = Math.cos(ang) * rz * spd;
    const car = _bumperCars[i];
    car.localX = lx;
    car.localZ = lz;
    car.yaw = Math.atan2(vx, vz);
  }

  return {
    bianglalaWheelAngleRad,
    bianglalaGondolaCounterAngleRad,
    koraKoraSwingAngleRad,
    komidiPutarAngleRad,
    komidiPutarHorseBobsM: _horseBobs,
    ontagAntingSpinAngleRad,
    ontagAntingTiltAngleRad,
    ontagAntingChairFlareRad: _chairFlares,
    bumperCars: _bumperCars,
  };
}

/**
 * Generates solid OBB colliders for the Taman Ria rides, stalls, railings, and palm trunks,
 * leaving all pedestrian promenades, archways, and access staircases wide open.
 */
export function getCoastalAmusementParkObstacles(): StaticWorldStructureObb[] {
  const mp = COASTAL_AMUSEMENT_PARK_MASTERPLAN;
  const obs: StaticWorldStructureObb[] = [];

  // 1. Grand Entrance Archway Pillars (8.4m clear pedestrian opening in between!)
  obs.push(
    {
      id: 'taman_arch_pillar_w',
      x: mp.entranceArch.x - mp.entranceArch.clearHalfSpanX - mp.entranceArch.pillarHalfSize,
      z: mp.entranceArch.z,
      halfX: 0.65,
      halfZ: 0.65,
      rotY: 0,
      heightY: 6.4,
      mat: 'wood',
    },
    {
      id: 'taman_arch_pillar_e',
      x: mp.entranceArch.x + mp.entranceArch.clearHalfSpanX + mp.entranceArch.pillarHalfSize,
      z: mp.entranceArch.z,
      halfX: 0.65,
      halfZ: 0.65,
      rotY: 0,
      heightY: 6.4,
      mat: 'wood',
    },
  );

  // 2. Carnival Midway Stalls, Pink Popcorn Booth & Sky-Blue Gulali Cotton Candy Cart
  for (const stall of CARNIVAL_MIDWAY_STALLS) {
    const isCart = stall.kind === 'cotton_candy_cart';
    const isPopcorn = stall.kind === 'popcorn_kiosk';
    obs.push({
      id: `taman_${stall.id}`,
      x: stall.x,
      z: stall.z,
      halfX: isCart ? 0.95 : isPopcorn ? 1.35 : 1.75,
      halfZ: isCart ? 1.35 : isPopcorn ? 1.35 : 1.95,
      rotY: 0,
      heightY: isCart ? 2.8 : 3.9,
      mat: 'wood',
    });
  }

  // 3. Komidi Putar (Vintage Carousel) & Ticket Podium
  obs.push(
    {
      id: 'taman_komidi_putar_core',
      x: mp.rides.komidiPutar.x,
      z: mp.rides.komidiPutar.z,
      halfX: 4.85,
      halfZ: 4.85,
      rotY: 0,
      heightY: mp.rides.komidiPutar.totalHeight,
      mat: 'wood',
    },
    {
      id: 'taman_komidi_ticket_podium',
      x: mp.rides.komidiPutar.ticketPodiumX,
      z: mp.rides.komidiPutar.ticketPodiumZ,
      halfX: 0.58,
      halfZ: 0.58,
      rotY: 0,
      heightY: 1.65,
      mat: 'wood',
    },
  );

  // 4. Ontag-Anting (Wave Swinger) Podium & Safety Fence
  obs.push({
    id: 'taman_ontag_anting_base',
    x: mp.rides.ontagAnting.x,
    z: mp.rides.ontagAnting.z,
    halfX: 5.95,
    halfZ: 5.95,
    rotY: 0,
    heightY: mp.rides.ontagAnting.totalHeight,
    mat: 'concrete',
  });

  // 5. Bumper Car Arena (Bom-Bom Car Pavilion ~18m x 12.4m)
  obs.push({
    id: 'taman_bumper_car_arena',
    x: mp.rides.bumperCarArena.x,
    z: mp.rides.bumperCarArena.z,
    halfX: mp.rides.bumperCarArena.halfX - 0.2,
    halfZ: mp.rides.bumperCarArena.halfZ - 0.2,
    rotY: 0,
    heightY: mp.rides.bumperCarArena.roofPeakY,
    mat: 'metal',
  });

  // 6. Kora-Kora Swinging Ship Hull Pit & A-Frame Legs (leaving West & East boarding stages walkable!)
  obs.push({
    id: 'taman_kora_kora_hull_pit',
    x: mp.rides.koraKora.x,
    z: mp.rides.koraKora.z,
    halfX: 2.25,
    halfZ: 7.1,
    rotY: 0,
    heightY: 16.5,
    mat: 'metal',
  });

  // 7. Bianglala Giant Ferris Wheel Support Frame & Wheel Sweep Core
  obs.push({
    id: 'taman_bianglala_core',
    x: mp.rides.bianglala.x,
    z: mp.rides.bianglala.z,
    halfX: 5.2,
    halfZ: 3.1,
    rotY: 0,
    heightY: 27.6,
    mat: 'metal',
  });

  // 8. Waterfront Boardwalk & Over-Water Pier Safety Railings (derived 1:1 from AMUSEMENT_PARK_RAILING_RUNS)
  for (const r of AMUSEMENT_PARK_RAILING_RUNS) {
    obs.push({
      id: r.id,
      x: (r.x1 + r.x2) * 0.5,
      z: (r.z1 + r.z2) * 0.5,
      halfX: Math.max(0.24, Math.abs(r.x2 - r.x1) * 0.5),
      halfZ: Math.max(0.24, Math.abs(r.z2 - r.z1) * 0.5),
      rotY: 0,
      heightY: 2.15,
      mat: 'wood',
    });
  }

  // 9. Tropical Coconut Palm Tree Trunks
  for (const palm of AMUSEMENT_PARK_PALM_TREES) {
    obs.push({
      id: palm.id,
      x: palm.x,
      z: palm.z,
      halfX: 0.54,
      halfZ: 0.54,
      rotY: 0,
      heightY: 8.2,
      mat: 'wood',
    });
  }

  return obs;
}
