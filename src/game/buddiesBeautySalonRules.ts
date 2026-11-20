export interface SalonObbCollider {
  id: string;
  floorLevel: '1f' | '2f' | 'all';
  x: number;
  z: number;
  hw: number;
  hd: number;
  ry: number;
}

export type SalonStationInteractionKind = 'exit_door' | 'reception_counter' | 'vanity_mirror' | 'spa_facial';

export interface SalonInteriorSeatSpot {
  id: string;
  label: string;
  chairKind: 'vanity_stool' | 'lounge_sofa' | 'spa_bed';
  sitVariant: 'chair' | 'couch';
  floorLevel: '1f' | '2f';
  floorY: number;
  x: number;
  z: number;
  yaw: number;
  standUpX: number;
  standUpZ: number;
  seatLiftY: number;
  indicatorHeightY: number;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function clampNum(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function distanceToAabb2d(
  px: number,
  pz: number,
  cx: number,
  cz: number,
  hx: number,
  hz: number,
): number {
  const dx = Math.max(0, Math.abs(px - cx) - hx);
  const dz = Math.max(0, Math.abs(pz - cz) - hz);
  return Math.hypot(dx, dz);
}

/**
 * Isolated vertical world origin for the 2-story Beauty Salon Interior
 * (`Houses @ 145`, `Glasshouse Cafe @ 215`, `Grand Casino @ 285`, `Beauty Salon @ 355`).
 */
export const SALON_ORIGIN_Y = 355.0;

export const SALON_INTERIOR_CHARACTER_RADIUS = 0.36;

/**
 * World-space trigger on Central Urban Plaza North Promenade directly outside
 * the `"BEAUTY & GLOW / GLOW STUDIO"` timber-and-glass entrance doorway (`26.97, 10.60`).
 */
export const SALON_EXTERIOR_DOOR_TRIGGER = {
  x: 26.97,
  z: 9.55,
  doorX: 26.97,
  doorZ: 10.60,
  deckY: 0.02,
  markerOffsetY: 1.55,
  triggerRadius: 2.35,
  exitSpawnX: 26.97,
  exitSpawnZ: 9.35,
  exitSpawnYaw: Math.PI / 2, // faces North (-Z) out into Central Urban Plaza
} as const;

/**
 * 2-Story Curved-Corner Beauty Salon Interior Dimensions & Mezzanine Coordinates.
 */
export const SALON_INTERIOR_BOUNDS = {
  minX: -6.20,
  maxX: 6.20,
  minZ: -5.20,
  maxZ: 5.20,
  wallMargin: SALON_INTERIOR_CHARACTER_RADIUS,
  curveCenterX: -3.80,
  curveCenterZ: 2.80,
  curveRadius: 2.40,
  groundFloorY: 0.0,
  midLandingY: 1.50,
  secondFloorY: 3.00,
  ceilingY: 6.35,
  // Entry spawn inside the Front-Right Vestibule facing inward toward centerpiece display & reception
  spawnX: 3.75,
  spawnZ: 3.10,
  spawnYaw: Math.PI * 0.85,
  exitDoorX: 5.30,
  exitDoorZ: 3.10,
  stair: {
    lowerStartX: -0.85,
    lowerEndX: -3.25,
    lowerMinZ: -3.10,
    lowerMaxZ: -1.95,
    landingMinX: -4.75,
    landingMaxX: -3.25,
    landingMinZ: -4.95,
    landingMaxZ: -1.95,
    upperStartX: -3.25,
    upperEndX: -0.85,
    upperMinZ: -4.95,
    upperMaxZ: -3.80,
  },
  // 2F L-Shaped Mezzanine Deck covering Back Spa Suite + Right Consultation Lounge
  mezzanineRear: {
    minX: -0.85,
    maxX: 5.82,
    minZ: -4.82,
    maxZ: -0.95,
  },
  mezzanineFrontWing: {
    minX: 2.95,
    maxX: 5.82,
    minZ: -0.95,
    maxZ: 2.20,
  },
} as const;

export const SALON_STATION_TARGETS = {
  exitDoor: { x: 5.30, markerY: 0.68, promptY: 1.45, z: 3.10, floorLevel: '1f' as const },
  receptionCounter: { x: -2.42, markerY: 1.62, promptY: 1.85, z: 0.05, floorLevel: '1f' as const },
  vanityCenter: { x: 2.75, markerY: 2.10, promptY: 2.25, z: -4.18, floorLevel: '1f' as const },
  spaSuite: { x: 1.45, markerY: 4.45, promptY: 4.65, z: -2.65, floorLevel: '2f' as const },
} as const;

export const SALON_INTERIOR_SEAT_SPOTS: ReadonlyArray<SalonInteriorSeatSpot> = [
  // 1F Hollywood Makeup Vanity Swivel Stools (facing North -Z into LED bulb mirrors)
  {
    id: 'salon_vanity_stool_1',
    label: 'MAKEUP VANITY #1',
    chairKind: 'vanity_stool',
    sitVariant: 'chair',
    floorLevel: '1f',
    floorY: 0.0,
    x: 0.95,
    z: -3.72,
    yaw: Math.PI / 2,
    standUpX: 0.95,
    standUpZ: -2.92,
    seatLiftY: 0.18,
    indicatorHeightY: 0.68,
  },
  {
    id: 'salon_vanity_stool_2',
    label: 'MAKEUP VANITY #2',
    chairKind: 'vanity_stool',
    sitVariant: 'chair',
    floorLevel: '1f',
    floorY: 0.0,
    x: 2.75,
    z: -3.72,
    yaw: Math.PI / 2,
    standUpX: 2.75,
    standUpZ: -2.92,
    seatLiftY: 0.18,
    indicatorHeightY: 0.68,
  },
  {
    id: 'salon_vanity_stool_3',
    label: 'MAKEUP VANITY #3',
    chairKind: 'vanity_stool',
    sitVariant: 'chair',
    floorLevel: '1f',
    floorY: 0.0,
    x: 4.55,
    z: -3.72,
    yaw: Math.PI / 2,
    standUpX: 4.55,
    standUpZ: -2.92,
    seatLiftY: 0.18,
    indicatorHeightY: 0.68,
  },
  // 2F Consultation Lounge Curved Velvet Loveseat (facing South +Z toward Marble Coffee Table)
  {
    id: 'salon_lounge_sofa_left',
    label: 'LOUNGE LOVESEAT',
    chairKind: 'lounge_sofa',
    sitVariant: 'couch',
    floorLevel: '2f',
    floorY: SALON_INTERIOR_BOUNDS.secondFloorY,
    x: 4.12,
    z: -2.35,
    yaw: -Math.PI / 2,
    standUpX: 3.62,
    standUpZ: -1.55,
    seatLiftY: 0.16,
    indicatorHeightY: SALON_INTERIOR_BOUNDS.secondFloorY + 0.68,
  },
  {
    id: 'salon_lounge_sofa_right',
    label: 'LOUNGE LOVESEAT',
    chairKind: 'lounge_sofa',
    sitVariant: 'couch',
    floorLevel: '2f',
    floorY: SALON_INTERIOR_BOUNDS.secondFloorY,
    x: 4.78,
    z: -2.35,
    yaw: -Math.PI / 2,
    standUpX: 5.26,
    standUpZ: -1.55,
    seatLiftY: 0.16,
    indicatorHeightY: SALON_INTERIOR_BOUNDS.secondFloorY + 0.68,
  },
  // 2F Articulating Hydraulic Spa Facial Bed
  {
    id: 'salon_2f_spa_facial_bed',
    label: 'SPA TREATMENT BED',
    chairKind: 'spa_bed',
    sitVariant: 'couch',
    floorLevel: '2f',
    floorY: SALON_INTERIOR_BOUNDS.secondFloorY,
    x: 1.45,
    z: -2.65,
    yaw: -0.22,
    standUpX: 1.15,
    standUpZ: -1.78,
    seatLiftY: 0.28,
    indicatorHeightY: SALON_INTERIOR_BOUNDS.secondFloorY + 0.86,
  },
];

export const SALON_INTERIOR_COLLIDERS: ReadonlyArray<SalonObbCollider> = [
  // 1F Arched Backlit Shelving Wall along West (-X)
  { id: 'salon_1f_arched_shelves', floorLevel: '1f', x: -5.92, z: -0.05, hw: 0.30, hd: 2.02, ry: 0 },
  // 1F Curved Reception & Consultation Counter (front arc + wings; rear side stays open!)
  { id: 'salon_1f_reception_front', floorLevel: '1f', x: -2.92, z: 0.05, hw: 0.34, hd: 0.86, ry: 0 },
  { id: 'salon_1f_reception_wing_n', floorLevel: '1f', x: -3.52, z: -0.82, hw: 0.38, hd: 0.24, ry: 0 },
  { id: 'salon_1f_reception_wing_s', floorLevel: '1f', x: -3.52, z: 0.92, hw: 0.38, hd: 0.24, ry: 0 },
  // 1F Centerpiece Display Table + Flanking Marble Pedestals
  { id: 'salon_1f_center_display', floorLevel: '1f', x: 0.65, z: 2.10, hw: 1.12, hd: 0.96, ry: 0 },
  // 1F Curved Corner Pedestal Stand near Panoramic Window
  { id: 'salon_1f_corner_pedestal', floorLevel: '1f', x: -4.25, z: 3.35, hw: 0.44, hd: 0.44, ry: 0 },
  // 1F 3 Hollywood Makeup Vanity Desks along -Z wall
  { id: 'salon_1f_vanity_row', floorLevel: '1f', x: 2.75, z: -4.64, hw: 2.48, hd: 0.32, ry: 0 },
  // 1F Swivel Vanity Stools (skipped automatically while player is sitting)
  { id: 'salon_vanity_stool_1_obb', floorLevel: '1f', x: 0.95, z: -3.72, hw: 0.28, hd: 0.28, ry: 0 },
  { id: 'salon_vanity_stool_2_obb', floorLevel: '1f', x: 2.75, z: -3.72, hw: 0.28, hd: 0.28, ry: 0 },
  { id: 'salon_vanity_stool_3_obb', floorLevel: '1f', x: 4.55, z: -3.72, hw: 0.28, hd: 0.28, ry: 0 },
  // 1F Under-Stair Structure & South Lower-Flight Glass Balustrade (leaves bottom stair mouth at x >= -0.85 open!)
  { id: 'salon_1f_stair_under_block', floorLevel: '1f', x: -2.85, z: -4.14, hw: 1.98, hd: 0.96, ry: 0 },
  { id: 'salon_1f_stair_rail_s', floorLevel: '1f', x: -2.90, z: -1.92, hw: 1.92, hd: 0.12, ry: 0 },
  // Central U-Turn Staircase Divider Wall between Lower and Upper Flights (active on both levels)
  { id: 'salon_stair_mid_divider', floorLevel: 'all', x: -2.05, z: -3.45, hw: 1.24, hd: 0.22, ry: 0 },
  // 2F Mezzanine Furniture & Planters
  { id: 'salon_2f_spa_credenza', floorLevel: '2f', x: 1.35, z: -4.54, hw: 0.84, hd: 0.28, ry: 0 },
  { id: 'salon_2f_spa_bed', floorLevel: '2f', x: 1.45, z: -2.65, hw: 0.96, hd: 0.42, ry: -0.22 },
  { id: 'salon_2f_towel_cart', floorLevel: '2f', x: 2.88, z: -3.45, hw: 0.30, hd: 0.24, ry: 0 },
  { id: 'salon_2f_lounge_sofa', floorLevel: '2f', x: 4.45, z: -2.48, hw: 0.84, hd: 0.44, ry: 0 },
  { id: 'salon_2f_lounge_table', floorLevel: '2f', x: 4.45, z: -1.25, hw: 0.54, hd: 0.30, ry: 0 },
  { id: 'salon_2f_olive_pot_nw', floorLevel: '2f', x: -0.25, z: -1.55, hw: 0.34, hd: 0.34, ry: 0 },
  { id: 'salon_2f_olive_pot_ne', floorLevel: '2f', x: 3.15, z: -4.48, hw: 0.34, hd: 0.34, ry: 0 },
];

export function isPointInSalonStairwell(x: number, z: number): boolean {
  const s = SALON_INTERIOR_BOUNDS.stair;
  const inLower = x >= s.lowerEndX && x <= s.lowerStartX + 0.18 && z >= s.lowerMinZ && z <= s.lowerMaxZ;
  const inLanding = x >= s.landingMinX && x <= s.landingMaxX + 0.05 && z >= s.landingMinZ && z <= s.landingMaxZ;
  const inUpper = x >= s.upperStartX - 0.05 && x <= s.upperEndX + 0.15 && z >= s.upperMinZ && z <= s.upperMaxZ;
  return inLower || inLanding || inUpper;
}

/**
 * Resolves exact local floor height (`0.0m` 1F, smooth staircase ramps `0.0 <-> 1.50 <-> 3.00m`,
 * and `3.00m` 2F mezzanine deck) with clean hysteresis so players never pop vertically between stories.
 */
export function resolveSalonInteriorFloorY(x: number, z: number, prevFloorY = 0): number {
  const b = SALON_INTERIOR_BOUNDS;
  const s = b.stair;

  // 1. Mid-Landing (`y = 1.50m`) when standing on the staircase side above ground level
  if (
    prevFloorY >= 0.45 &&
    x >= s.landingMinX - 0.15 &&
    x <= s.landingMaxX + 0.08 &&
    z >= s.landingMinZ &&
    z <= s.landingMaxZ
  ) {
    return b.midLandingY;
  }

  // 2. Lower Flight (`z in [-3.10 .. -1.95]`, climbs -X from -0.85 @ 0m to -3.25 @ 1.50m)
  if (
    x >= s.lowerEndX - 0.05 &&
    x <= s.lowerStartX + 0.15 &&
    z >= s.lowerMinZ &&
    z <= s.lowerMaxZ &&
    prevFloorY < 2.15
  ) {
    const t = clamp01((s.lowerStartX - x) / (s.lowerStartX - s.lowerEndX));
    return t * b.midLandingY;
  }

  // 3. Upper Flight (`z in [-4.95 .. -3.80]`, climbs +X from -3.25 @ 1.50m to -0.85 @ 3.00m)
  if (
    prevFloorY >= 0.75 &&
    x >= s.upperStartX - 0.05 &&
    x <= s.upperEndX + 0.05 &&
    z >= s.upperMinZ &&
    z <= s.upperMaxZ
  ) {
    const t = clamp01((x - s.upperStartX) / (s.upperEndX - s.upperStartX));
    return b.midLandingY + t * (b.secondFloorY - b.midLandingY);
  }

  // 4. 2F Mezzanine Deck (`y = 3.00m`) once player climbed above 1.95m
  if (prevFloorY >= 1.95) {
    const inRear =
      x >= b.mezzanineRear.minX - 0.15 &&
      x <= b.mezzanineRear.maxX + 0.15 &&
      z >= b.mezzanineRear.minZ - 0.15 &&
      z <= b.mezzanineRear.maxZ + 0.15;
    const inWing =
      x >= b.mezzanineFrontWing.minX - 0.15 &&
      x <= b.mezzanineFrontWing.maxX + 0.15 &&
      z >= b.mezzanineFrontWing.minZ - 0.15 &&
      z <= b.mezzanineFrontWing.maxZ + 0.15;
    if (inRear || inWing) {
      return b.secondFloorY;
    }
  }

  return b.groundFloorY;
}

/**
 * Keeps players strictly inside the 2-story Beauty Salon envelope AND prevents walking
 * off the 2F Mezzanine Glass Balustrade edges or out of stairwell walls.
 */
export function clampSalonInteriorPosition(
  rawX: number,
  rawZ: number,
  prevFloorY = 0,
  margin = SALON_INTERIOR_CHARACTER_RADIUS,
): { x: number; z: number; floorY: number } {
  const b = SALON_INTERIOR_BOUNDS;
  const s = b.stair;
  let x = clampNum(rawX, b.minX + margin, b.maxX - margin);
  let z = clampNum(rawZ, b.minZ + margin, b.maxZ - margin);

  // Curved Front-Left Panoramic Glass Corner (`x < curveCenterX && z > curveCenterZ`)
  if (x < b.curveCenterX && z > b.curveCenterZ) {
    const dx = x - b.curveCenterX;
    const dz = z - b.curveCenterZ;
    const dist = Math.hypot(dx, dz);
    const maxR = Math.max(0.2, b.curveRadius - margin);
    if (dist > maxR && dist > 1e-6) {
      x = b.curveCenterX + (dx / dist) * maxR;
      z = b.curveCenterZ + (dz / dist) * maxR;
    }
  }

  // When on Mid-Landing / Upper/Lower Stairway (`prevFloorY` mid-stair): keep inside stairwell glass railings
  if (prevFloorY >= 0.45 && prevFloorY <= 2.45) {
    x = clampNum(x, s.landingMinX + margin * 0.6, s.lowerStartX + 0.25);
    z = clampNum(z, s.upperMinZ + margin * 0.6, s.lowerMaxZ - margin * 0.6);
  }

  // When on 2F Mezzanine Deck (`prevFloorY >= 2.15`), contain strictly within the L-shaped glass balustrade & stair mouth!
  if (prevFloorY >= 2.15) {
    const stairEntranceZ = z >= s.upperMinZ + margin * 0.4 && z <= s.upperMaxZ - margin * 0.4;
    if (x < b.mezzanineRear.minX && stairEntranceZ) {
      // Descending cleanly along Upper Flight onto Mid-Landing
      x = clampNum(x, s.landingMinX + margin * 0.5, b.maxX - margin);
      z = clampNum(z, s.upperMinZ + margin * 0.5, s.upperMaxZ - margin * 0.5);
    } else if (x > b.mezzanineFrontWing.minX + margin * 0.5 && z > b.mezzanineRear.maxZ) {
      // Inside Right-Front Consultation Lounge wing (`Rect B`)
      x = clampNum(x, b.mezzanineFrontWing.minX + margin * 0.5, b.maxX - margin);
      z = clampNum(z, b.minZ + margin, b.mezzanineFrontWing.maxZ - margin * 0.5);
    } else {
      // Inside Rear Spa & Lounge deck (`Rect A`)
      if (z > b.mezzanineRear.maxZ - margin * 0.5 && x < b.mezzanineFrontWing.minX + margin * 0.5) {
        const pushNorth = z - (b.mezzanineRear.maxZ - margin * 0.5);
        const pushEast = b.mezzanineFrontWing.minX + margin * 0.5 - x;
        if (pushEast < pushNorth) {
          x = b.mezzanineFrontWing.minX + margin * 0.5;
        } else {
          z = b.mezzanineRear.maxZ - margin * 0.5;
        }
      }
      x = clampNum(
        x,
        stairEntranceZ ? s.landingMinX + margin * 0.5 : b.mezzanineRear.minX + margin * 0.5,
        b.maxX - margin,
      );
      z = clampNum(z, b.minZ + margin, b.mezzanineFrontWing.maxZ - margin * 0.5);
    }
  }

  const floorY = resolveSalonInteriorFloorY(x, z, prevFloorY);
  return { x, z, floorY };
}

export const SALON_ORBIT_CAMERA_CONFIG = {
  fovDeg: 54,
  defaultYaw: 0.62,
  defaultPitch: 0.48,
  defaultDist: 6.40,
  minPitch: 0.14,
  maxPitch: 0.94,
  minDist: 2.4,
  maxDist: 10.2,
  lookHeightOffset: 0.96,
  minCamHeightOffset: 0.62,
  maxCamHeightOffset: 8.85,
  // Back walls (-X, -Z) are opaque 2-story walls; front-right (+X, +Z) cutaway allows spacious framing
  wallMinX: SALON_INTERIOR_BOUNDS.minX + 0.48,
  wallMinZ: SALON_INTERIOR_BOUNDS.minZ + 0.48,
  cutawayMaxX: SALON_INTERIOR_BOUNDS.maxX + 1.45,
  cutawayMaxZ: SALON_INTERIOR_BOUNDS.maxZ + 1.45,
  wallLookShiftFactor: 0.26,
  maxWallLookShift: 0.72,
} as const;

export interface SalonOrbitCameraPose {
  fovDeg: number;
  camX: number;
  camY: number;
  camZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
}

/**
 * Computes the 3/4 orbital camera pose inside the 2-story Beauty Salon cutaway,
 * tracking vertical stair/mezzanine movement cleanly without clipping behind back walls.
 */
export function computeSalonOrbitCameraPose(input: {
  originY: number;
  anchorX: number;
  anchorZ: number;
  floorY: number;
  yaw: number;
  pitch: number;
  dist: number;
}): SalonOrbitCameraPose {
  const cfg = SALON_ORBIT_CAMERA_CONFIG;
  const safePitch = clampNum(input.pitch, cfg.minPitch, cfg.maxPitch);
  const safeDist = clampNum(input.dist, cfg.minDist, cfg.maxDist);

  const cosPitch = Math.cos(safePitch);
  const sinPitch = Math.sin(safePitch);
  const desiredHoriz = Math.max(0.001, cosPitch * safeDist);
  const desiredVert = sinPitch * safeDist;

  const rawCamX = input.anchorX + Math.sin(input.yaw) * desiredHoriz;
  const rawCamZ = input.anchorZ + Math.cos(input.yaw) * desiredHoriz;

  const camX = clampNum(rawCamX, cfg.wallMinX, cfg.cutawayMaxX);
  const camZ = clampNum(rawCamZ, cfg.wallMinZ, cfg.cutawayMaxZ);

  let shiftX = (camX - rawCamX) * cfg.wallLookShiftFactor;
  let shiftZ = (camZ - rawCamZ) * cfg.wallLookShiftFactor;
  const shiftMag = Math.hypot(shiftX, shiftZ);
  if (shiftMag > cfg.maxWallLookShift && shiftMag > 1e-6) {
    const scale = cfg.maxWallLookShift / shiftMag;
    shiftX *= scale;
    shiftZ *= scale;
  }

  const lookX = clampNum(input.anchorX + shiftX, -4.8, 4.8);
  const lookZ = clampNum(input.anchorZ + shiftZ, -4.0, 4.0);
  const lookY = input.originY + input.floorY + cfg.lookHeightOffset;

  const actualHoriz = Math.hypot(camX - lookX, camZ - lookZ);
  const horizRatio = clampNum(actualHoriz / desiredHoriz, 0.42, 1.0);
  const adjustedVert = desiredVert * (0.82 + 0.18 * horizRatio);

  const camY = clampNum(
    lookY + adjustedVert,
    input.originY + input.floorY + cfg.minCamHeightOffset,
    input.originY + cfg.maxCamHeightOffset,
  );

  return {
    fovDeg: cfg.fovDeg,
    camX,
    camY,
    camZ,
    lookX,
    lookY,
    lookZ,
  };
}

export interface SalonNearestPromptOrSeatResult {
  target: 'none' | 'station' | 'seat';
  stationKind: SalonStationInteractionKind | null;
  seatIndex: number;
  seatSpot: SalonInteriorSeatSpot | null;
  objectDistance: number;
}

const SALON_SEAT_PROXIMITY_RADIUS = 1.45;

/**
 * Resolves the highest-priority interactive prompt (`exit_door` station vs vanity/sofa/spa seat)
 * filtered strictly to the floor story the player is currently on.
 */
export function resolveNearestSalonPromptOrSeat(
  px: number,
  pz: number,
  floorY = 0,
): SalonNearestPromptOrSeatResult {
  const isOnSecondFloor = floorY >= 1.95;

  // 1. Check 1F Exit Door Pad when on Ground Floor
  const exitDist = !isOnSecondFloor
    ? Math.hypot(px - SALON_STATION_TARGETS.exitDoor.x, pz - SALON_STATION_TARGETS.exitDoor.z)
    : Infinity;
  if (exitDist <= 1.55) {
    return {
      target: 'station',
      stationKind: 'exit_door',
      seatIndex: -1,
      seatSpot: null,
      objectDistance: exitDist,
    };
  }

  // 2. Check nearest playable seat on current floor (`vanity_stool`, `lounge_sofa`, `spa_bed`)
  let bestSeatIdx = -1;
  let bestSeatDist = Infinity;
  for (let i = 0; i < SALON_INTERIOR_SEAT_SPOTS.length; i++) {
    const spot = SALON_INTERIOR_SEAT_SPOTS[i];
    if (isOnSecondFloor !== (spot.floorLevel === '2f')) continue;
    const cDist = Math.hypot(px - spot.x, pz - spot.z);
    if (cDist <= SALON_SEAT_PROXIMITY_RADIUS) {
      const objDist = distanceToAabb2d(px, pz, spot.x, spot.z, 0.28, 0.28);
      if (objDist < bestSeatDist) {
        bestSeatDist = objDist;
        bestSeatIdx = i;
      }
    }
  }

  if (bestSeatIdx !== -1) {
    return {
      target: 'seat',
      stationKind: null,
      seatIndex: bestSeatIdx,
      seatSpot: SALON_INTERIOR_SEAT_SPOTS[bestSeatIdx],
      objectDistance: bestSeatDist,
    };
  }

  return {
    target: 'none',
    stationKind: null,
    seatIndex: -1,
    seatSpot: null,
    objectDistance: Infinity,
  };
}

export function computeSalonSeatStandUpPosition(
  spot: SalonInteriorSeatSpot,
): { x: number; z: number; floorY: number } {
  const clamped = clampSalonInteriorPosition(spot.standUpX, spot.standUpZ, spot.floorY);
  return {
    x: clamped.x,
    z: clamped.z,
    floorY: spot.floorY,
  };
}
