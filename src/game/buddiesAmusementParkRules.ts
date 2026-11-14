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

export const COASTAL_AMUSEMENT_PARK_MASTERPLAN = {
  // Overall footprint: Northern Dermaga (z in [-46..-19.5]) + Empty Northern Beach (z in [-104..-46]) + Over-Water Pier (x up to 125.6)
  bounds: {
    minX: 76.5,
    maxX: 125.6,
    minZ: -103.5,
    maxZ: -19.2,
  },
  boardwalkDeckY: 1.1,
  koraDockStageY: 2.02,
  // Main Waterfront Timber Boardwalk along the seaward edge
  mainBoardwalk: {
    minX: 95.2,
    maxX: 109.6,
    minZ: -74.0,
    maxZ: -21.0,
  },
  // Over-Water Square Timber Pier Deck supporting Bianglala (extending past x = 110 quay wall over Open Ocean)
  bianglalaPierDeck: {
    minX: 100.0,
    maxX: 117.6,
    minZ: -41.2,
    maxZ: -24.4,
  },
  // Over-Water L-Shaped / Seaward Pier Finger & Tented Gazebo Jetty
  gazeboFingerJetty: {
    walkwayMinX: 117.0,
    walkwayMaxX: 121.2,
    walkwayMinZ: -28.4,
    walkwayMaxZ: -24.8,
    headMinX: 119.8,
    headMaxX: 125.6,
    headMinZ: -29.5,
    headMaxZ: -23.7,
    gazeboCenterX: 122.7,
    gazeboCenterZ: -26.6,
  },
  // Access Stairs / Ramps onto the +1.10m Boardwalk
  stairs: {
    southDermaga: { minX: 98.0, maxX: 105.0, minZ: -21.0, maxZ: -18.8 },
    westBianglala: { minX: 93.0, maxX: 95.2, minZ: -35.6, maxZ: -29.8 },
    westCarousel: { minX: 93.0, maxX: 95.2, minZ: -50.2, maxZ: -44.2 },
    northBeach: { minX: 98.0, maxX: 104.2, minZ: -76.4, maxZ: -74.0 },
  },
  // Grand Entrance Archway facing South (+Z) toward Northern Dermaga & z = -15 Harbor Road Entrance
  entranceArch: {
    x: 86.2,
    z: -20.4,
    clearHalfSpanX: 4.1,
    pillarHalfSize: 0.58,
  },
  // 5 Hero Rides (1:1 with Reference Model Sheets)
  rides: {
    bianglala: {
      x: 108.8,
      z: -32.8,
      deckY: 1.1,
      axleHeightAboveDeck: 13.8,
      wheelRadius: 11.6,
      rimSeparationZ: 2.2,
      gondolaCount: 16,
      footingHalfSpanX: 6.1,
      footingHalfSpanZ: 4.5,
    },
    koraKora: {
      x: 102.4,
      z: -56.5,
      deckY: 1.1,
      stageHeightAboveDeck: 0.92,
      pivotHeightAboveDeck: 15.2,
      pendulumLength: 12.1,
      hullLength: 14.2,
      hullWidth: 3.9,
      towerBaseHalfX: 3.85,
      towerBaseHalfZ: 5.15,
    },
    komidiPutar: {
      x: 87.5,
      z: -46.8,
      baseY: 0.0,
      fenceRadius: 5.25,
      platformRadius: 4.85,
      canopyRadius: 5.05,
      totalHeight: 9.6,
      horseCount: 10,
      chariotCount: 2,
      ticketPodiumX: 81.6,
      ticketPodiumZ: -44.0,
    },
    ontagAnting: {
      x: 84.4,
      z: -67.8,
      baseY: 0.0,
      fenceRadius: 6.25,
      podiumRadius: 5.85,
      canopyRadius: 5.15,
      totalHeight: 11.2,
      chairCount: 16,
      tiltAngleRad: 0.245,
    },
    bumperCarArena: {
      x: 85.4,
      z: -88.5,
      baseY: 0.0,
      halfX: 6.8,
      halfZ: 7.8,
      floorHalfX: 5.5,
      floorHalfZ: 6.5,
      roofPeakY: 6.15,
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
    x: 93.35,
    z: -25.4,
    rotY: -Math.PI / 2,
    stripePrimaryHex: '#ea580c',
    stripeSecondaryHex: '#fffbeb',
    counterHex: '#b45309',
    accentType: 'snacks',
  },
  {
    id: 'stall_se_carnival_cans',
    kind: 'striped_tent',
    x: 93.35,
    z: -39.9,
    rotY: -Math.PI / 2,
    stripePrimaryHex: '#e11d48',
    stripeSecondaryHex: '#fffbeb',
    counterHex: '#92400e',
    accentType: 'plush_prizes',
  },
  {
    id: 'stall_mid_popcorn_pink',
    kind: 'popcorn_kiosk',
    x: 80.8,
    z: -53.2,
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
    z: -58.4,
    rotY: Math.PI / 2,
    stripePrimaryHex: '#0284c7',
    stripeSecondaryHex: '#f8fafc',
    counterHex: '#92400e',
    accentType: 'ring_toss',
  },
  {
    id: 'stall_mid_gulali_cart',
    kind: 'cotton_candy_cart',
    x: 92.8,
    z: -63.8,
    rotY: -Math.PI / 2,
    stripePrimaryHex: '#38bdf8',
    stripeSecondaryHex: '#f0f9ff',
    counterHex: '#0284c7',
    accentType: 'gulali',
  },
  {
    id: 'stall_north_red_tent',
    kind: 'striped_tent',
    x: 93.4,
    z: -75.8,
    rotY: -Math.PI / 2,
    stripePrimaryHex: '#dc2626',
    stripeSecondaryHex: '#fffbeb',
    counterHex: '#92400e',
    accentType: 'snacks',
  },
  {
    id: 'stall_beach_orange_pavilion',
    kind: 'striped_tent',
    x: 96.6,
    z: -83.8,
    rotY: -Math.PI / 2,
    stripePrimaryHex: '#ea580c',
    stripeSecondaryHex: '#fff7ed',
    counterHex: '#b45309',
    accentType: 'plush_prizes',
  },
];

export const AMUSEMENT_PARK_PALM_TREES: readonly {
  id: string;
  x: number;
  z: number;
  scale: number;
  rotY: number;
}[] = [
  { id: 'taman_palm_1', x: 77.6, z: -47.5, scale: 1.04, rotY: 0.4 },
  { id: 'taman_palm_2', x: 77.4, z: -61.2, scale: 0.98, rotY: 1.7 },
  { id: 'taman_palm_3', x: 77.6, z: -76.5, scale: 1.08, rotY: 2.9 },
  { id: 'taman_palm_4', x: 77.8, z: -98.2, scale: 1.12, rotY: 0.9 },
  { id: 'taman_palm_5', x: 95.8, z: -97.8, scale: 1.06, rotY: 2.1 },
  { id: 'taman_palm_6', x: 101.5, z: -89.5, scale: 0.96, rotY: 3.8 },
  { id: 'taman_palm_7', x: 102.2, z: -79.2, scale: 1.02, rotY: 5.1 },
  { id: 'taman_palm_8', x: 93.6, z: -69.5, scale: 0.92, rotY: 1.2 },
];

/**
 * Returns true if (worldX, worldZ) sits on the walkable Over-Water Pier Deck
 * (Bianglala Square Pier or Seaward Gazebo Finger Jetty extending past x = 109.2).
 */
export function isPointOnAmusementOverwaterPier(worldX: number, worldZ: number): boolean {
  const { bianglalaPierDeck, gazeboFingerJetty } = COASTAL_AMUSEMENT_PARK_MASTERPLAN;
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
 * Over-Water Bianglala Pier Deck (+1.10m), Gazebo Jetty (+1.10m), Kora-Kora Boarding Stage (+2.02m),
 * and their smooth access stairs/ramps.
 */
export function evaluateAmusementBoardwalkElevation(worldX: number, worldZ: number): number {
  const mp = COASTAL_AMUSEMENT_PARK_MASTERPLAN;
  if (worldX < 92.6 || worldX > 126.0 || worldZ < -77.0 || worldZ > -18.5) {
    return 0.0;
  }

  let elev = 0.0;
  const deckY = mp.boardwalkDeckY;

  // 1. Main Waterfront Boardwalk [95.2..109.6] x [-74.0..-21.0]
  if (
    worldX >= mp.mainBoardwalk.minX &&
    worldX <= mp.mainBoardwalk.maxX &&
    worldZ >= mp.mainBoardwalk.minZ &&
    worldZ <= mp.mainBoardwalk.maxZ
  ) {
    elev = Math.max(elev, deckY);
  }

  // 2. Over-Water Bianglala Square Pier Deck [100.0..117.6] x [-41.2..-24.4]
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

  // 4. Four Access Stair/Ramp Transitions (0.0m <-> +1.10m)
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

  // 5. Kora-Kora Raised Docking Stage (+2.02m) & West Boarding Stairs (x in [96.8..98.8], z in [-58.8..-54.2])
  if (worldX >= 98.8 && worldX <= 106.0 && worldZ >= -60.6 && worldZ <= -52.4) {
    elev = Math.max(elev, mp.koraDockStageY);
  } else if (worldX >= 96.8 && worldX < 98.8 && worldZ >= -58.8 && worldZ <= -54.2) {
    const stairT = smoothstep(96.8, 98.8, worldX);
    elev = Math.max(elev, deckY + (mp.koraDockStageY - deckY) * stairT);
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

  // 5. Bumper Car Arena: 5 vintage bumper cars cruising smoothly on non-intersecting Lissajous / oval lanes
  //    strictly inside floorHalfX = 5.5m, floorHalfZ = 6.5m (car radius ~ 0.95m -> safe envelope ±4.1m x ±5.1m)
  const orbitSpecs: readonly [number, number, number, number, number, number][] = [
    // [centerX, centerZ, rx, rz, speed, phase]
    [-2.05, -2.4, 1.55, 1.85, 0.95, 0.0],
    [2.05, -2.3, 1.55, 1.85, -0.88, 1.2],
    [-2.05, 2.45, 1.55, 1.85, -0.92, 2.5],
    [2.05, 2.35, 1.55, 1.85, 0.86, 3.9],
    [0.0, 0.0, 1.35, 1.65, 1.08, 5.1],
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

  // 1. Grand Entrance Archway Pillars (8.2m clear pedestrian opening in between!)
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
      halfX: 4.55,
      halfZ: 4.55,
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
    halfX: 5.45,
    halfZ: 5.45,
    rotY: 0,
    heightY: mp.rides.ontagAnting.totalHeight,
    mat: 'concrete',
  });

  // 5. Bumper Car Arena (Bom-Bom Car Pavilion)
  obs.push({
    id: 'taman_bumper_car_arena',
    x: mp.rides.bumperCarArena.x,
    z: mp.rides.bumperCarArena.z,
    halfX: mp.rides.bumperCarArena.halfX - 0.25,
    halfZ: mp.rides.bumperCarArena.halfZ - 0.25,
    rotY: 0,
    heightY: mp.rides.bumperCarArena.roofPeakY,
    mat: 'metal',
  });

  // 6. Kora-Kora Swinging Ship Hull Pit & A-Frame Legs (leaving West boarding stage walkable!)
  obs.push({
    id: 'taman_kora_kora_hull_pit',
    x: mp.rides.koraKora.x + 0.65,
    z: mp.rides.koraKora.z,
    halfX: 2.65,
    halfZ: 6.8,
    rotY: 0,
    heightY: 16.5,
    mat: 'metal',
  });

  // 7. Bianglala Giant Ferris Wheel Support Frame & Wheel Sweep Core
  obs.push({
    id: 'taman_bianglala_core',
    x: mp.rides.bianglala.x,
    z: mp.rides.bianglala.z,
    halfX: 5.4,
    halfZ: 3.2,
    rotY: 0,
    heightY: 27.6,
    mat: 'metal',
  });

  // 8. Waterfront Boardwalk & Over-Water Pier Safety Railings (with openings at every stair & jetty!)
  obs.push(
    // West boardwalk railing segments (leaving gaps at westBianglala [-35.6..-29.8] and westCarousel [-50.2..-44.2])
    { id: 'taman_rail_west_s', x: 95.3, z: -25.4, halfX: 0.24, halfZ: 4.2, rotY: 0, heightY: 2.15, mat: 'wood' },
    { id: 'taman_rail_west_m', x: 95.3, z: -39.9, halfX: 0.24, halfZ: 4.1, rotY: 0, heightY: 2.15, mat: 'wood' },
    { id: 'taman_rail_west_n', x: 95.3, z: -62.1, halfX: 0.24, halfZ: 11.7, rotY: 0, heightY: 2.15, mat: 'wood' },
    // Seaward East railing along main boardwalk south of Bianglala & north of Bianglala
    { id: 'taman_rail_east_n', x: 109.4, z: -57.6, halfX: 0.24, halfZ: 16.2, rotY: 0, heightY: 2.15, mat: 'wood' },
    // Bianglala Over-Water Pier Outer Railings (leaving Finger Jetty opening at z in [-28.4..-24.8])
    { id: 'taman_pier_rail_n', x: 113.6, z: -41.0, halfX: 4.0, halfZ: 0.24, rotY: 0, heightY: 2.15, mat: 'wood' },
    { id: 'taman_pier_rail_s', x: 113.6, z: -24.5, halfX: 4.0, halfZ: 0.24, rotY: 0, heightY: 2.15, mat: 'wood' },
    { id: 'taman_pier_rail_e', x: 117.45, z: -34.8, halfX: 0.24, halfZ: 6.2, rotY: 0, heightY: 2.15, mat: 'wood' },
    // Gazebo Pierhead Outer Railings
    { id: 'taman_gazebo_rail_e', x: 125.45, z: -26.6, halfX: 0.24, halfZ: 2.8, rotY: 0, heightY: 2.15, mat: 'wood' },
    { id: 'taman_gazebo_rail_n', x: 122.7, z: -29.35, halfX: 2.8, halfZ: 0.24, rotY: 0, heightY: 2.15, mat: 'wood' },
    { id: 'taman_gazebo_rail_s', x: 122.7, z: -23.85, halfX: 2.8, halfZ: 0.24, rotY: 0, heightY: 2.15, mat: 'wood' },
  );

  // 9. Tropical Coconut Palm Tree Trunks
  for (const palm of AMUSEMENT_PARK_PALM_TREES) {
    obs.push({
      id: palm.id,
      x: palm.x,
      z: palm.z,
      halfX: 0.52,
      halfZ: 0.52,
      rotY: 0,
      heightY: 7.4,
      mat: 'wood',
    });
  }

  return obs;
}
