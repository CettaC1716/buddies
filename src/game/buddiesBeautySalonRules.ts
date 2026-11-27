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
 * Uniform scale applied to the owner Glow Studio GLB inside the isolated
 * interior scene (SALON_ORIGIN_Y), where the player avatar is scaled to 0.55x
 * (~1.82m tall). Derived by the door-height method (3.48 / 2.70 = 1.289).
 */
export const SALON_GLB_SCALE = 1.289;

/**
 * Uniform scale applied to the owner Glow Studio GLB on the outdoor Central
 * Urban Plaza, where the player avatar stands ~3.31m tall (1.0x outdoor rig).
 * Raising exterior scale from 1.289 to 1.40 brings the entry door frame to
 * 3.78m, door leaf opening to 3.56m (+0.25m head clearance), and cream front
 * awning underside to 3.33m — harmonizing with Vintage Cafe (1.40) and
 * Cozy Bites & Sips (1.48) without clipping the player avatar's head.
 */
export const SALON_EXTERIOR_GLB_SCALE = 1.4;

/**
 * Wall thickness of the owner Glow Studio GLB in model units: its ground
 * floor walls span 8.80m across while the clear terrazzo floor inside
 * spans 8.50m, so (8.80 - 8.50) / 2 = 0.15m of wall on every side. The
 * interior bounds below are exactly that terrazzo extent, scaled.
 */
export const SALON_EXTERIOR_WALL_THICKNESS = 0.15;

/**
 * World-space trigger on Central Urban Plaza North Promenade directly outside
 * the Glow Studio Salon's entrance doorway. The door anchor x (25.74) is
 * unchanged: the 1.40x exterior GLB mount shifts its origin to (29.87, 14.90)
 * so the model's door frame centre lands on (25.74, 8.94) — the scaled front
 * wall face sits at z 8.74 (OBB front z 8.54), keeping clean trigger & exit
 * clearances north of the doorway while clearing the Central Fountain ring.
 */
export const SALON_EXTERIOR_DOOR_TRIGGER = {
  x: 25.74,
  z: 7.95,
  doorX: 25.74,
  doorZ: 8.94,
  deckY: 0.042,
  markerOffsetY: 1.55,
  triggerRadius: 2.35,
  exitSpawnX: 25.74,
  exitSpawnZ: 7.75,
  exitSpawnYaw: Math.PI / 2, // faces North (-Z) out into Central Urban Plaza
} as const;

/**
 * Beauty Salon Interior dimensions & mezzanine coordinates, measured from
 * the owner Glow Studio GLB itself (its interior reflects its exterior, per
 * the owner's direction) and expressed in this scene's units: model x/z
 * multiplied by SALON_GLB_SCALE, model heights converted with the model's
 * own ground floor (terrazzo top) as 0. The interior scene mounts the same
 * prepped GLB at SALON_ORIGIN_Y with the same scale, so this frame is the
 * model's frame.
 *
 * Model facts used: terrazzo floor x/z [-4.12..4.38] (8.50m clear), L-shaped
 * staircase in the north-east (flight A climbs +X along the north wall from
 * y 0 to a 2.62m landing, flight B climbs +Z to the 4.02m mezzanine),
 * mezzanine floor covering the north deck, an east strip, the east wing and
 * a south-east terrace (sampled triangle coverage, not the slab bounds).
 */
export const SALON_INTERIOR_BOUNDS = {
  minX: -5.31,
  maxX: 5.65,
  minZ: -5.31,
  maxZ: 5.65,
  wallMargin: SALON_INTERIOR_CHARACTER_RADIUS,
  groundFloorY: 0.0,
  midLandingY: 3.09,
  secondFloorY: 4.92,
  ceilingY: 9.49,
  // Entry spawn just inside the model's main door (south wall, local x
  // +2.95) facing North (-Z) into the showroom toward the reception counter
  spawnX: 3.80,
  spawnZ: 4.25,
  spawnYaw: Math.PI / 2,
  exitDoorX: 3.80,
  exitDoorZ: 5.30,
  stair: {
    // Flight A: climbs +X along the north wall (model x -0.85..2.55,
    // z -3.60..-2.40), ground floor -> mid landing
    flightA: { minX: -1.10, maxX: 3.29, minZ: -4.64, maxZ: -3.09 },
    // Mid landing at the north-east corner (model x 2.40..3.10,
    // z -3.60..-2.40) at midLandingY
    landing: { minX: 3.09, maxX: 4.00, minZ: -4.64, maxZ: -3.09 },
    // Flight B: climbs +Z along the east wall (model x 2.40..3.10,
    // z -2.40..-1.05), mid landing -> mezzanine
    flightB: { minX: 3.09, maxX: 4.00, minZ: -3.09, maxZ: -1.35 },
  },
  // Mezzanine deck (model Mezz_Floor triangle coverage, scaled)
  mezzanineRear: {
    minX: -4.67,
    maxX: 2.54,
    minZ: -4.67,
    maxZ: 0.19,
  },
  mezzanineEastStrip: {
    minX: 2.54,
    maxX: 4.67,
    minZ: -1.16,
    maxZ: 0.19,
  },
  mezzanineFrontWing: {
    minX: 2.54,
    maxX: 4.67,
    minZ: 0.19,
    maxZ: 4.67,
  },
  mezzanineSouthWing: {
    minX: 1.10,
    maxX: 4.67,
    minZ: 3.29,
    maxZ: 4.67,
  },
} as const;

type SalonRect = { minX: number; maxX: number; minZ: number; maxZ: number };

const SALON_MEZZANINE_RECTS: ReadonlyArray<SalonRect> = [
  SALON_INTERIOR_BOUNDS.mezzanineRear,
  SALON_INTERIOR_BOUNDS.mezzanineEastStrip,
  SALON_INTERIOR_BOUNDS.mezzanineFrontWing,
  SALON_INTERIOR_BOUNDS.mezzanineSouthWing,
];

function isInRect(x: number, z: number, r: SalonRect, expand = 0): boolean {
  return x >= r.minX - expand && x <= r.maxX + expand && z >= r.minZ - expand && z <= r.maxZ + expand;
}

export const SALON_STATION_TARGETS = {
  exitDoor: { x: 3.80, markerY: 0.68, promptY: 1.45, z: 5.30, floorLevel: '1f' as const },
  receptionCounter: { x: -2.22, markerY: 1.62, promptY: 1.85, z: -0.14, floorLevel: '1f' as const },
  vanityCenter: { x: 3.64, markerY: 2.10, promptY: 2.25, z: 2.00, floorLevel: '1f' as const },
  spaSuite: {
    x: -1.61,
    markerY: SALON_INTERIOR_BOUNDS.secondFloorY + 1.45,
    promptY: SALON_INTERIOR_BOUNDS.secondFloorY + 1.65,
    z: -2.24,
    floorLevel: '2f' as const,
  },
} as const;

/**
 * Sittable salon seats, re-anchored onto the Glow GLB's own furniture
 * (positions measured from the model, scaled): the 3 vanity chairs along
 * the east wall (merged chair meshes segmented into 3 clusters at model
 * z -2.35 / +1.55 / +2.85), the mezzanine lounge sofa (2 seats) and the
 * mezzanine spa treatment bed. Seat lift values carry over the old
 * interior's calibration, adjusted by the measured cushion-height delta
 * of each GLB piece vs its procedural predecessor.
 */
export const SALON_INTERIOR_SEAT_SPOTS: ReadonlyArray<SalonInteriorSeatSpot> = [
  // 1F Vanity Chairs along the +X wall (facing +X into the vanity mirrors)
  {
    id: 'salon_vanity_stool_1',
    label: 'MAKEUP VANITY #1',
    chairKind: 'vanity_stool',
    sitVariant: 'chair',
    floorLevel: '1f',
    floorY: 0.0,
    x: 3.64,
    z: -3.03,
    yaw: 0,
    standUpX: 2.79,
    standUpZ: -2.50,
    seatLiftY: 0.37,
    indicatorHeightY: 0.90,
  },
  {
    id: 'salon_vanity_stool_2',
    label: 'MAKEUP VANITY #2',
    chairKind: 'vanity_stool',
    sitVariant: 'chair',
    floorLevel: '1f',
    floorY: 0.0,
    x: 3.64,
    z: 2.00,
    yaw: 0,
    standUpX: 2.79,
    standUpZ: 2.00,
    seatLiftY: 0.37,
    indicatorHeightY: 0.90,
  },
  {
    id: 'salon_vanity_stool_3',
    label: 'MAKEUP VANITY #3',
    chairKind: 'vanity_stool',
    sitVariant: 'chair',
    floorLevel: '1f',
    floorY: 0.0,
    x: 3.64,
    z: 3.67,
    yaw: 0,
    standUpX: 2.79,
    standUpZ: 3.67,
    seatLiftY: 0.37,
    indicatorHeightY: 0.90,
  },
  // 2F Mezzanine Lounge Sofa against the +X wall (facing -X toward its rug & table)
  {
    id: 'salon_lounge_sofa_left',
    label: 'LOUNGE SOFA',
    chairKind: 'lounge_sofa',
    sitVariant: 'couch',
    floorLevel: '2f',
    floorY: SALON_INTERIOR_BOUNDS.secondFloorY,
    x: 4.12,
    z: 1.74,
    yaw: Math.PI,
    standUpX: 3.25,
    standUpZ: 1.74,
    seatLiftY: 0.28,
    indicatorHeightY: SALON_INTERIOR_BOUNDS.secondFloorY + 0.78,
  },
  {
    id: 'salon_lounge_sofa_right',
    label: 'LOUNGE SOFA',
    chairKind: 'lounge_sofa',
    sitVariant: 'couch',
    floorLevel: '2f',
    floorY: SALON_INTERIOR_BOUNDS.secondFloorY,
    x: 4.12,
    z: 2.77,
    yaw: Math.PI,
    standUpX: 3.25,
    standUpZ: 2.77,
    seatLiftY: 0.28,
    indicatorHeightY: SALON_INTERIOR_BOUNDS.secondFloorY + 0.78,
  },
  // 2F Spa Treatment Bed (headrest at the -Z end; sitter faces +Z)
  {
    id: 'salon_2f_spa_facial_bed',
    label: 'SPA TREATMENT BED',
    chairKind: 'spa_bed',
    sitVariant: 'couch',
    floorLevel: '2f',
    floorY: SALON_INTERIOR_BOUNDS.secondFloorY,
    x: -1.61,
    z: -2.24,
    yaw: -Math.PI / 2,
    standUpX: -0.45,
    standUpZ: -2.24,
    seatLiftY: 0.68,
    indicatorHeightY: SALON_INTERIOR_BOUNDS.secondFloorY + 1.26,
  },
];

/**
 * Interior colliders measured from the Glow GLB's own furniture bounds
 * (model units x SALON_GLB_SCALE), replacing the retired procedural
 * interior's furniture boxes one-for-one in role.
 */
export const SALON_INTERIOR_COLLIDERS: ReadonlyArray<SalonObbCollider> = [
  // 1F Curved Reception Counter (model x -2.30..-1.13, z -1.18..0.97)
  { id: 'salon_1f_reception_front', floorLevel: '1f', x: -2.22, z: -0.14, hw: 0.76, hd: 1.39, ry: 0 },
  // 1F Island Display (model x -1.19..1.09, z 1.05..2.89)
  { id: 'salon_1f_display_island', floorLevel: '1f', x: -0.06, z: 2.54, hw: 1.47, hd: 1.19, ry: 0 },
  // 1F Niche Shelving runs along the North & West walls
  { id: 'salon_1f_niche_shelf_n', floorLevel: '1f', x: -3.37, z: -4.87, hw: 1.92, hd: 0.42, ry: 0 },
  { id: 'salon_1f_niche_shelf_w', floorLevel: '1f', x: -4.87, z: -3.35, hw: 0.42, hd: 1.10, ry: 0 },
  // 1F Vanity Desk Row along the +X wall (model x 3.45..4.38, z -2.87..3.37)
  { id: 'salon_1f_vanity_row', floorLevel: '1f', x: 5.05, z: 0.32, hw: 0.60, hd: 4.02, ry: 0 },
  // 1F Vanity Chairs (skipped automatically while the player sits in them)
  { id: 'salon_vanity_stool_1_obb', floorLevel: '1f', x: 3.64, z: -3.03, hw: 0.35, hd: 0.35, ry: 0 },
  { id: 'salon_vanity_stool_2_obb', floorLevel: '1f', x: 3.64, z: 2.00, hw: 0.35, hd: 0.35, ry: 0 },
  { id: 'salon_vanity_stool_3_obb', floorLevel: '1f', x: 3.64, z: 3.67, hw: 0.35, hd: 0.35, ry: 0 },
  // 1F Perfume Stand & Product Shelves at the South-East corner
  { id: 'salon_1f_perfume_stand', floorLevel: '1f', x: 5.06, z: -4.80, hw: 0.61, hd: 0.49, ry: 0 },
  // 1F Waiting Bench along the South wall
  { id: 'salon_1f_waiting_bench', floorLevel: '1f', x: -3.22, z: 4.90, hw: 1.42, hd: 0.39, ry: 0 },
  // 1F Planters flanking the (decorative) side door on the +X wall
  { id: 'salon_1f_side_door_planters', floorLevel: '1f', x: 5.28, z: 0.0, hw: 0.32, hd: 0.86, ry: 0 },
  // 1F Solid stair mass under Flight B (its underside is not walkable space)
  { id: 'salon_1f_stair_b_under_block', floorLevel: '1f', x: 3.55, z: -2.22, hw: 0.46, hd: 0.87, ry: 0 },
  // 1F Solid stair mass under the Mid Landing
  { id: 'salon_1f_landing_under_block', floorLevel: '1f', x: 3.55, z: -3.87, hw: 0.46, hd: 0.78, ry: 0 },
  // 1F Stair Rail along Flight A's open South side (keeps ground-floor
  // players from popping onto the flight from the side; the flight is
  // entered from its West mouth or from the landing above)
  { id: 'salon_1f_stair_rail_s', floorLevel: '1f', x: 1.10, z: -2.99, hw: 2.20, hd: 0.10, ry: 0 },
  // 2F Spa Treatment Bed (model x -1.67..-0.83, z -2.71..-0.77)
  { id: 'salon_2f_spa_bed', floorLevel: '2f', x: -1.61, z: -2.24, hw: 0.54, hd: 1.25, ry: 0 },
  // 2F Spa Cabinet against the North wall
  { id: 'salon_2f_spa_cabinet', floorLevel: '2f', x: -3.62, z: -3.59, hw: 0.57, hd: 0.47, ry: 0 },
  // 2F Shelving along the West wall
  { id: 'salon_2f_shelf_w', floorLevel: '2f', x: -4.87, z: -2.32, hw: 0.42, hd: 1.74, ry: 0 },
  // 2F Lounge Sofa & Table on the East Wing
  { id: 'salon_2f_lounge_sofa', floorLevel: '2f', x: 4.12, z: 2.26, hw: 0.49, hd: 1.03, ry: 0 },
  { id: 'salon_2f_lounge_table', floorLevel: '2f', x: 3.04, z: 2.26, hw: 0.34, hd: 0.64, ry: 0 },
  // 2F Product Shelf beside the stair arrival
  { id: 'salon_2f_shelf_e', floorLevel: '2f', x: 4.86, z: -3.59, hw: 0.43, hd: 0.46, ry: 0 },
];

export function isPointInSalonStairwell(x: number, z: number): boolean {
  const s = SALON_INTERIOR_BOUNDS.stair;
  const inFlightA = isInRect(x, z, s.flightA, 0.15);
  const inLanding = isInRect(x, z, s.landing, 0.08);
  const inFlightB = isInRect(x, z, s.flightB, 0.08);
  return inFlightA || inLanding || inFlightB;
}

/**
 * Resolves exact local floor height (`0.0m` 1F, the L-staircase ramps
 * `0.0 <-> 3.09 <-> 4.92m`, and `4.92m` 2F mezzanine deck) with clean
 * hysteresis so players never pop vertically between stories.
 */
export function resolveSalonInteriorFloorY(x: number, z: number, prevFloorY = 0): number {
  const b = SALON_INTERIOR_BOUNDS;
  const s = b.stair;

  // 1. Mid-Landing (`y = 3.09m`) when standing on the staircase above ground level
  if (prevFloorY >= 0.45 && isInRect(x, z, s.landing, 0.12)) {
    return b.midLandingY;
  }

  // 2. Flight A (climbs +X along the North wall, 0m -> 3.09m)
  if (isInRect(x, z, s.flightA, 0.1) && prevFloorY < b.midLandingY + 0.85) {
    const t = clamp01((x - s.flightA.minX) / (s.flightA.maxX - s.flightA.minX));
    return t * b.midLandingY;
  }

  // 3. Flight B (climbs +Z along the East wall, 3.09m -> 4.92m)
  if (prevFloorY >= 0.75 && isInRect(x, z, s.flightB, 0.08)) {
    const t = clamp01((z - s.flightB.minZ) / (s.flightB.maxZ - s.flightB.minZ));
    return b.midLandingY + t * (b.secondFloorY - b.midLandingY);
  }

  // 4. 2F Mezzanine Deck (`y = 4.92m`) once the player climbed near it
  if (prevFloorY >= b.secondFloorY - 0.9) {
    for (const r of SALON_MEZZANINE_RECTS) {
      if (isInRect(x, z, r, 0.15)) {
        return b.secondFloorY;
      }
    }
  }

  return b.groundFloorY;
}

/**
 * Keeps players strictly inside the Beauty Salon envelope AND prevents
 * walking off the 2F mezzanine edges or out of the staircase.
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

  // When on the staircase (between floors): keep inside the stairwell —
  // the union of flight A, the landing and flight B.
  if (prevFloorY >= 0.45 && prevFloorY < b.secondFloorY - 0.45) {
    const inA = isInRect(x, z, s.flightA, 0.05);
    const inL = isInRect(x, z, s.landing, 0.05);
    const inB = isInRect(x, z, s.flightB, 0.05);
    if (!inA && !inL && !inB) {
      // Project back into the stairwell: clamp to its bounding box, then
      // push out of the open pocket beside flight B (over the ground floor).
      x = clampNum(x, s.flightA.minX + margin * 0.6, s.flightB.maxX - margin * 0.6);
      z = clampNum(z, s.flightA.minZ + margin * 0.6, s.flightB.maxZ - margin * 0.6);
      if (!isInRect(x, z, s.flightA, 0.05) && !isInRect(x, z, s.landing, 0.05) && !isInRect(x, z, s.flightB, 0.05)) {
        const pushEast = s.flightB.minX + margin * 0.6 - x;
        const pushNorth = z - (s.flightA.maxZ - margin * 0.6);
        if (pushEast <= pushNorth) {
          x = s.flightB.minX + margin * 0.6;
        } else {
          z = s.flightA.maxZ - margin * 0.6;
        }
      }
    }
  }

  // When on the 2F mezzanine deck: contain within the deck union plus the
  // flight B arrival (stepping onto flight B is how the player descends).
  if (prevFloorY >= b.secondFloorY - 0.45) {
    const inside =
      SALON_MEZZANINE_RECTS.some((r) => isInRect(x, z, r, 0.02)) || isInRect(x, z, s.flightB, 0.02);
    if (!inside) {
      // Pull back to the closest point of the closest valid rect.
      let best: { x: number; z: number } | null = null;
      let bestDist = Infinity;
      for (const r of [...SALON_MEZZANINE_RECTS, s.flightB]) {
        const cx = clampNum(x, r.minX + margin * 0.5, r.maxX - margin * 0.5);
        const cz = clampNum(z, r.minZ + margin * 0.5, r.maxZ - margin * 0.5);
        const d = Math.hypot(x - cx, z - cz);
        if (d < bestDist) {
          bestDist = d;
          best = { x: cx, z: cz };
        }
      }
      if (best) {
        x = best.x;
        z = best.z;
      }
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
  maxCamHeightOffset: 12.0,
  // Back walls (-X, -Z) are opaque walls; front-right (+X, +Z) cutaway allows spacious framing
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

  const lookX = clampNum(input.anchorX + shiftX, SALON_INTERIOR_BOUNDS.minX + 0.7, SALON_INTERIOR_BOUNDS.maxX - 0.7);
  const lookZ = clampNum(input.anchorZ + shiftZ, SALON_INTERIOR_BOUNDS.minZ + 0.7, SALON_INTERIOR_BOUNDS.maxZ - 0.7);
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
  const b = SALON_INTERIOR_BOUNDS;
  const isOnSecondFloor = floorY >= (b.midLandingY + b.secondFloorY) / 2;

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
