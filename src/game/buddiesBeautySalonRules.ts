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
 * Architectural exterior masonry wall thickness separating the exterior facade footprint
 * (`12.60m x 8.80m`) from the clear interior showroom floor (`12.00m x 8.20m`).
 */
export const SALON_EXTERIOR_WALL_THICKNESS = 0.30;

/**
 * World-space trigger on Central Urban Plaza North Promenade directly outside
 * the `"BEAUTY & GLOW / GLOW STUDIO"` timber-and-glass entrance doorway (`25.74, 10.60`).
 */
export const SALON_EXTERIOR_DOOR_TRIGGER = {
  x: 25.74,
  z: 9.55,
  doorX: 25.74,
  doorZ: 10.60,
  deckY: 0.02,
  markerOffsetY: 1.55,
  triggerRadius: 2.35,
  exitSpawnX: 25.74,
  exitSpawnZ: 9.35,
  exitSpawnYaw: Math.PI / 2, // faces North (-Z) out into Central Urban Plaza
} as const;

/**
 * 2-Story Curved-Corner Beauty Salon Interior Dimensions & Mezzanine Coordinates.
 * Sized 1:1 as a true reflection of the exterior footprint (`12.60m x 8.80m` exterior
 * minus `0.30m` masonry wall thickness on every side -> `12.00m x 8.20m` clear interior,
 * and `2.10m - 0.30m = 1.80m` curved front-left panoramic corner radius).
 */
export const SALON_INTERIOR_BOUNDS = {
  minX: -6.00,
  maxX: 6.00,
  minZ: -4.10,
  maxZ: 4.10,
  wallMargin: SALON_INTERIOR_CHARACTER_RADIUS,
  curveCenterX: -4.20,
  curveCenterZ: 2.30,
  curveRadius: 1.80,
  groundFloorY: 0.0,
  midLandingY: 1.50,
  secondFloorY: 3.00,
  ceilingY: 6.35,
  // Entry spawn inside the Front-Right Vestibule facing inward toward centerpiece display & reception
  spawnX: 3.65,
  spawnZ: 2.45,
  spawnYaw: Math.PI * 0.85,
  exitDoorX: 5.15,
  exitDoorZ: 2.45,
  stair: {
    lowerStartX: -0.85,
    lowerEndX: -3.20,
    lowerMinZ: -2.45,
    lowerMaxZ: -1.45,
    landingMinX: -4.65,
    landingMaxX: -3.20,
    landingMinZ: -3.90,
    landingMaxZ: -1.45,
    upperStartX: -3.20,
    upperEndX: -0.85,
    upperMinZ: -3.90,
    upperMaxZ: -2.90,
  },
  // 2F L-Shaped Mezzanine Deck covering Back Spa Suite + Right Consultation Lounge
  mezzanineRear: {
    minX: -0.85,
    maxX: 5.64,
    minZ: -3.74,
    maxZ: -0.75,
  },
  mezzanineFrontWing: {
    minX: 2.85,
    maxX: 5.64,
    minZ: -0.75,
    maxZ: 1.65,
  },
} as const;

export const SALON_STATION_TARGETS = {
  exitDoor: { x: 5.15, markerY: 0.68, promptY: 1.45, z: 2.45, floorLevel: '1f' as const },
  receptionCounter: { x: -2.32, markerY: 1.62, promptY: 1.85, z: 0.45, floorLevel: '1f' as const },
  vanityCenter: { x: 2.65, markerY: 2.10, promptY: 2.25, z: -3.18, floorLevel: '1f' as const },
  spaSuite: { x: 1.38, markerY: 4.45, promptY: 4.65, z: -2.08, floorLevel: '2f' as const },
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
    x: 0.90,
    z: -2.72,
    yaw: Math.PI / 2,
    standUpX: 0.90,
    standUpZ: -1.95,
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
    x: 2.65,
    z: -2.72,
    yaw: Math.PI / 2,
    standUpX: 2.65,
    standUpZ: -1.95,
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
    x: 4.40,
    z: -2.72,
    yaw: Math.PI / 2,
    standUpX: 4.40,
    standUpZ: -1.95,
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
    x: 4.02,
    z: -2.28,
    yaw: -Math.PI / 2,
    standUpX: 3.60,
    standUpZ: -1.56,
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
    x: 4.68,
    z: -2.28,
    yaw: -Math.PI / 2,
    standUpX: 5.10,
    standUpZ: -1.56,
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
    x: 1.38,
    z: -2.08,
    yaw: -0.22,
    standUpX: 1.10,
    standUpZ: -1.32,
    seatLiftY: 0.28,
    indicatorHeightY: SALON_INTERIOR_BOUNDS.secondFloorY + 0.86,
  },
];

export const SALON_INTERIOR_COLLIDERS: ReadonlyArray<SalonObbCollider> = [
  // 1F Arched Backlit Shelving Wall along West (-X)
  { id: 'salon_1f_arched_shelves', floorLevel: '1f', x: -5.72, z: 0.35, hw: 0.28, hd: 1.82, ry: 0 },
  // 1F Curved Reception & Consultation Counter (front arc + wings; rear side stays open!)
  { id: 'salon_1f_reception_front', floorLevel: '1f', x: -2.82, z: 0.45, hw: 0.34, hd: 0.84, ry: 0 },
  { id: 'salon_1f_reception_wing_n', floorLevel: '1f', x: -3.42, z: -0.40, hw: 0.38, hd: 0.24, ry: 0 },
  { id: 'salon_1f_reception_wing_s', floorLevel: '1f', x: -3.42, z: 1.30, hw: 0.38, hd: 0.24, ry: 0 },
  // 1F Centerpiece Display Table + Flanking Marble Pedestals
  { id: 'salon_1f_center_display', floorLevel: '1f', x: 0.65, z: 1.75, hw: 1.05, hd: 0.88, ry: 0 },
  // 1F Curved Corner Pedestal Stand near Panoramic Window
  { id: 'salon_1f_corner_pedestal', floorLevel: '1f', x: -4.65, z: 2.85, hw: 0.40, hd: 0.40, ry: 0 },
  // 1F 3 Hollywood Makeup Vanity Desks along -Z wall
  { id: 'salon_1f_vanity_row', floorLevel: '1f', x: 2.65, z: -3.60, hw: 2.40, hd: 0.30, ry: 0 },
  // 1F Swivel Vanity Stools (skipped automatically while player is sitting)
  { id: 'salon_vanity_stool_1_obb', floorLevel: '1f', x: 0.90, z: -2.72, hw: 0.26, hd: 0.26, ry: 0 },
  { id: 'salon_vanity_stool_2_obb', floorLevel: '1f', x: 2.65, z: -2.72, hw: 0.26, hd: 0.26, ry: 0 },
  { id: 'salon_vanity_stool_3_obb', floorLevel: '1f', x: 4.40, z: -2.72, hw: 0.26, hd: 0.26, ry: 0 },
  // 1F Under-Stair Structure & South Lower-Flight Glass Balustrade (leaves bottom stair mouth at x >= -0.85 open!)
  { id: 'salon_1f_stair_under_block', floorLevel: '1f', x: -2.78, z: -3.28, hw: 1.92, hd: 0.72, ry: 0 },
  { id: 'salon_1f_stair_rail_s', floorLevel: '1f', x: -2.80, z: -1.42, hw: 1.88, hd: 0.12, ry: 0 },
  // Central U-Turn Staircase Divider Wall between Lower and Upper Flights (active on both levels)
  { id: 'salon_stair_mid_divider', floorLevel: 'all', x: -2.02, z: -2.675, hw: 1.22, hd: 0.18, ry: 0 },
  // 2F Mezzanine Furniture & Planters
  { id: 'salon_2f_spa_credenza', floorLevel: '2f', x: 1.30, z: -3.56, hw: 0.82, hd: 0.26, ry: 0 },
  { id: 'salon_2f_spa_bed', floorLevel: '2f', x: 1.38, z: -2.08, hw: 0.92, hd: 0.40, ry: -0.22 },
  { id: 'salon_2f_towel_cart', floorLevel: '2f', x: 2.76, z: -2.85, hw: 0.28, hd: 0.22, ry: 0 },
  { id: 'salon_2f_lounge_sofa', floorLevel: '2f', x: 4.35, z: -2.42, hw: 0.82, hd: 0.42, ry: 0 },
  { id: 'salon_2f_lounge_table', floorLevel: '2f', x: 4.35, z: -0.88, hw: 0.52, hd: 0.28, ry: 0 },
  { id: 'salon_2f_olive_pot_nw', floorLevel: '2f', x: -0.28, z: -1.25, hw: 0.30, hd: 0.30, ry: 0 },
  { id: 'salon_2f_olive_pot_ne', floorLevel: '2f', x: 3.02, z: -3.52, hw: 0.30, hd: 0.30, ry: 0 },
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

  const lookX = clampNum(input.anchorX + shiftX, -4.6, 4.6);
  const lookZ = clampNum(input.anchorZ + shiftZ, -3.1, 3.1);
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
  isSeatOccupied?: (spot: SalonInteriorSeatSpot) => boolean,
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
    if (isSeatOccupied?.(spot)) continue;
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
