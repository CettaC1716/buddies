import {
  resolveSolidObbCollision2D,
  CITY_TRAFFIC_SIGN_SPECS,
  isBenchOrSeatStructureId,
  type CityAmbientNpcPreset,
} from './buddiesBlitzRules';
import type { StaticWorldStructureObb } from './buddiesBlitzTypes';
import { isPointOnPedestrianCrosswalkCorridor } from './buddiesBlitzSquadAi';
import {
  evaluateNwLakeSdf,
  evaluateSeHarborSdf,
  evaluateOuterEmbankmentSdf,
  evaluateRoadNetworkSdf,
  isPointOnBeachfrontStiltCabinDeck,
  getTerrainElevation,
  wrapPlanetCoord,
} from './buddiesPlanetCurvature';
import {
  evaluateBeachClubPoolWaterSdf,
  getBeachClubStairCorridors,
} from './buddiesBeachClubRules';
import { CENTRAL_PARK_BOTANICAL_BEDS, CENTRAL_PARK_MASTERPLAN } from './buddiesCentralParkRules';
import { CITY_LAMP_MANIFEST, type LampTier } from './buddiesCityLightingAndTrafficRules';

export const PLAYER_FOOT_CAPSULE_RADIUS = 0.72;
export const AMBIENT_NPC_CAPSULE_RADIUS = 0.54;
export const CAFE_INTERIOR_CHARACTER_RADIUS = 0.36;

export interface CircleCollider2D {
  id: string;
  x: number;
  z: number;
  radius: number;
  heightY: number;
  mat: StaticWorldStructureObb['mat'];
}

export interface CharacterCapsuleBody2D {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  groundY: number;
  immovable?: boolean;
  isSitting?: boolean;
  isTalking?: boolean;
}

export interface AuditedWorldCollidersSet {
  obbs: StaticWorldStructureObb[];
  circles: CircleCollider2D[];
  benchAndSeatObbs: StaticWorldStructureObb[];
}

export interface StaircaseChannelRect {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Climb axis ('x' clamps Z-cheeks; 'z' clamps X-cheeks). Defaults to 'x'. */
  axis?: 'x' | 'z';
  /** Wide open edge steps (e.g. boardwalk/promenade stairs) skip lateral cheek clamping. */
  openSides?: boolean;
}

/**
 * Returns true when a static collider's world-space top (`colliderTopY`) sits at or below the
 * mover's world-space feet elevation (`moverFeetY`) within step clearance, so retaining walls or
 * lower-terrace structures never snag characters walking on an upper terrace while still solidly
 * blocking movers standing on a lower terrace.
 */
export function isStaticColliderBelowMoverFeet(
  colliderTopY: number,
  moverFeetY: number,
  isRetainingWall = false,
): boolean {
  const clearance = isRetainingWall ? 0.14 : 0.05;
  return moverFeetY >= colliderTopY - clearance;
}

/**
 * Staircase & ramp horizontal corridors where smooth multi-step elevation changes are valid
 * and foot characters should be gently contained inside stair cheek curbs instead of stepping off
 * perpendicular vertical retaining drops.
 */
export const WORLD_STAIRCASE_CORRIDORS: readonly StaircaseChannelRect[] = [
  // Central Plaza Grand Staircase (-87.55..-79.10, left of |z|<=8.36 planter cheeks)
  { id: 'central_plaza_stairs_n', minX: -87.55, maxX: -79.1, minZ: -8.36, maxZ: -0.22, axis: 'x' },
  { id: 'central_plaza_stairs_s', minX: -87.55, maxX: -79.1, minZ: 0.22, maxZ: 8.36, axis: 'x' },
  // SE Beachfront Promenade Stair 1 & Stair 2 (+0.82m -> -1.00m Box 1 Beach)
  { id: 'se_beach_stair_1', minX: 92.0, maxX: 97.8, minZ: 70.52, maxZ: 76.48, axis: 'x' },
  { id: 'se_beach_stair_2', minX: 92.0, maxX: 97.8, minZ: 94.32, maxZ: 98.88, axis: 'x' },
  // SE Beachfront West Travertine Boardwalk Access Steps
  { id: 'se_beach_west_steps', minX: 76.6, maxX: 79.4, minZ: 46.6, maxZ: 101.8, axis: 'x', openSides: true },
  // Stilt Cabin Wooden Entry Steps (+24m East on widened coastline)
  { id: 'se_stilt_cabin_stairs', minX: 127.5, maxX: 128.82, minZ: 83.24, maxZ: 85.56, axis: 'x' },
  // East Coastal Beach Club multi-tiered terrace staircases (synced 1:1 with getBeachClubStairCorridors)
  ...getBeachClubStairCorridors().map(
    (sf): StaircaseChannelRect => ({
      id: `beach_club_${sf.id}`,
      minX: sf.minX,
      maxX: sf.maxX,
      minZ: sf.minZ,
      maxZ: sf.maxZ,
      axis: sf.axis,
      openSides: (sf.axis === 'x' ? sf.maxZ - sf.minZ : sf.maxX - sf.minX) >= 8.0,
    }),
  ),
];

const LAMP_HALF_EXTENT_BY_TIER: Record<LampTier, number> = {
  1: 0.26,
  2: 0.42,
  3: 0.38,
  4: 0.48,
};

const LAMP_HEIGHT_BY_TIER: Record<LampTier, number> = {
  1: 0.85,
  2: 2.91,
  3: 6.93,
  4: 7.43,
};

let cachedAuditBaseRef: readonly StaticWorldStructureObb[] | null = null;
let cachedAuditedSet: AuditedWorldCollidersSet | null = null;

function isExemptSeatObb(
  st: StaticWorldStructureObb,
  exemptSeatPoint: { x: number; z: number } | null | undefined,
): boolean {
  if (!exemptSeatPoint || !isBenchOrSeatStructureId(st.id)) return false;
  return (
    Math.hypot(st.x - exemptSeatPoint.x, st.z - exemptSeatPoint.z) <=
    Math.max(st.halfX, st.halfZ) + 1.1
  );
}

function hasCloseCollider(
  obbs: readonly StaticWorldStructureObb[],
  circles: readonly CircleCollider2D[],
  x: number,
  z: number,
  maxDist: number,
): boolean {
  const maxDistSq = maxDist * maxDist;
  for (let i = 0; i < obbs.length; i++) {
    const dx = obbs[i].x - x;
    const dz = obbs[i].z - z;
    if (dx * dx + dz * dz <= maxDistSq) return true;
  }
  for (let i = 0; i < circles.length; i++) {
    const dx = circles[i].x - x;
    const dz = circles[i].z - z;
    if (dx * dx + dz * dz <= maxDistSq) return true;
  }
  return false;
}

/**
 * Builds the audited, deduplicated static collider set (aligned OBBs + true circular basins/rides +
 * missing architectural props, 85 streetlamps, and 18 road signs) without mutating source arrays.
 */
export function getAuditedStaticWorldStructures(
  baseStructures: readonly StaticWorldStructureObb[],
): AuditedWorldCollidersSet {
  if (cachedAuditBaseRef === baseStructures && cachedAuditedSet) {
    return cachedAuditedSet;
  }

  const obbs: StaticWorldStructureObb[] = [];
  const circles: CircleCollider2D[] = [];
  const seenBaseIds = new Set<string>();

  for (let i = 0; i < baseStructures.length; i++) {
    const st = baseStructures[i];
    if (seenBaseIds.has(st.id)) continue;
    seenBaseIds.add(st.id);
    if (st.id === 'central_park_stone_fountain') {
      // Replace oversized square bounding box with true circular stone basin collider (r = 3.70m)
      circles.push({
        id: st.id,
        x: st.x,
        z: st.z,
        radius: 3.7,
        heightY: st.heightY,
        mat: st.mat,
      });
      continue;
    }
    if (st.id === 'central_park_duck_pond') {
      // Replace rectangular bounding box with true circular lily pond (r = 3.36m) + 4 pergola plinths below
      circles.push({
        id: st.id,
        x: st.x,
        z: st.z,
        radius: 3.36,
        heightY: 1.25,
        mat: st.mat,
      });
      continue;
    }
    if (st.id.startsWith('cozy_cafe_table_')) {
      // Match bistro table + both bentwood chairs smoothly with a 1.18m circle
      circles.push({
        id: st.id,
        x: st.x,
        z: st.z,
        radius: 1.18,
        heightY: st.heightY,
        mat: st.mat,
      });
      continue;
    }
    if (st.id === 'lobby_vintage_bench_planter_en') {
      obbs.push({ ...st, x: -81.27, z: -16.85, halfX: 0.68, halfZ: 2.05 });
      continue;
    }
    if (st.id === 'lobby_vintage_bench_planter_en_2') {
      obbs.push({ ...st, x: -81.27, z: -24.05, halfX: 0.68, halfZ: 2.05 });
      continue;
    }
    obbs.push(st);
  }

  // Central Park Lily Pond 4 horseshoe pergola timber post plinths (matching postAngles in builders)
  const pond = CENTRAL_PARK_MASTERPLAN.pergolaPond;
  const pondPostAngles = [-0.06, 1.06, Math.PI - 1.06, Math.PI + 0.06];
  for (let p = 0; p < pondPostAngles.length; p++) {
    const ang = pondPostAngles[p];
    obbs.push({
      id: `central_park_pergola_post_${p}`,
      x: pond.centerX + Math.cos(ang) * 3.16,
      z: pond.centerZ - Math.sin(ang) * 3.16,
      halfX: 0.3,
      halfZ: 0.3,
      rotY: 0,
      heightY: pond.totalHeight,
      mat: 'wood',
    });
  }

  // (Beach Club architectural colliders are included directly via getBeachClubObstacles)

  // Central Plaza Municipal Hall portico columns, bench, letterbox & lion-head water spigots
  const municipalExtras: StaticWorldStructureObb[] = [
    {
      id: 'lobby_civic_hall_portico_col_w',
      x: -95.6,
      z: -25.38,
      halfX: 0.44,
      halfZ: 0.44,
      rotY: 0,
      heightY: 12.0,
      mat: 'concrete',
    },
    {
      id: 'lobby_civic_hall_portico_col_e',
      x: -91.5,
      z: -25.38,
      halfX: 0.44,
      halfZ: 0.44,
      rotY: 0,
      heightY: 12.0,
      mat: 'concrete',
    },
    {
      id: 'lobby_civic_hall_bench_e',
      x: -86.42,
      z: -30.41,
      halfX: 0.34,
      halfZ: 0.85,
      rotY: 0,
      heightY: 3.9,
      mat: 'metal',
    },
    {
      id: 'lobby_civic_hall_letterbox',
      x: -86.66,
      z: -33.67,
      halfX: 0.34,
      halfZ: 0.34,
      rotY: 0,
      heightY: 4.35,
      mat: 'metal',
    },
    {
      id: 'lobby_civic_hall_lion_spigot_w',
      x: -101.43,
      z: -29.7,
      halfX: 0.4,
      halfZ: 0.4,
      rotY: 0,
      heightY: 4.2,
      mat: 'concrete',
    },
    {
      id: 'lobby_civic_hall_lion_spigot_e',
      x: -85.81,
      z: -32.82,
      halfX: 0.4,
      halfZ: 0.4,
      rotY: 0,
      heightY: 4.2,
      mat: 'concrete',
    },
    // Glasshouse Cafe entrance potted monsteras flanking the door (-90.55, 20.8 remains open)
    {
      id: 'lobby_glasshouse_door_pot_w',
      x: -92.7,
      z: 21.95,
      halfX: 0.36,
      halfZ: 0.36,
      rotY: 0,
      heightY: 3.9,
      mat: 'wood',
    },
    {
      id: 'lobby_glasshouse_door_pot_e',
      x: -88.4,
      z: 21.95,
      halfX: 0.36,
      halfZ: 0.36,
      rotY: 0,
      heightY: 3.9,
      mat: 'wood',
    },
    // Tennis Club 4 corner floodlight poles, wire ball hopper & front A-frame sign
    {
      id: 'tennis_floodlight_nw',
      x: -99.54,
      z: 38.9,
      halfX: 0.38,
      halfZ: 0.38,
      rotY: 0,
      heightY: 6.8,
      mat: 'metal',
    },
    {
      id: 'tennis_floodlight_ne',
      x: -78.08,
      z: 38.9,
      halfX: 0.38,
      halfZ: 0.38,
      rotY: 0,
      heightY: 6.8,
      mat: 'metal',
    },
    {
      id: 'tennis_floodlight_sw',
      x: -99.54,
      z: 63.14,
      halfX: 0.38,
      halfZ: 0.38,
      rotY: 0,
      heightY: 6.8,
      mat: 'metal',
    },
    {
      id: 'tennis_floodlight_se',
      x: -78.08,
      z: 63.14,
      halfX: 0.38,
      halfZ: 0.38,
      rotY: 0,
      heightY: 6.8,
      mat: 'metal',
    },
    {
      id: 'tennis_ball_hopper',
      x: -83.34,
      z: 49.03,
      halfX: 0.38,
      halfZ: 0.38,
      rotY: 0,
      heightY: 1.15,
      mat: 'metal',
    },
    {
      id: 'tennis_porch_aframe',
      x: -81.86,
      z: 39.65,
      halfX: 0.38,
      halfZ: 0.34,
      rotY: 0,
      heightY: 1.35,
      mat: 'wood',
    },
    // Boutique Tower front teak bench + 6 exterior boxwood urns
    {
      id: 'urban_plaza_boutique_front_bench',
      x: 17.12,
      z: 2.45,
      halfX: 0.42,
      halfZ: 1.15,
      rotY: 0,
      heightY: 1.45,
      mat: 'wood',
    },
    {
      id: 'urban_plaza_boutique_urn_s2',
      x: 16.84,
      z: 3.92,
      halfX: 0.34,
      halfZ: 0.34,
      rotY: 0,
      heightY: 1.65,
      mat: 'concrete',
    },
    {
      id: 'urban_plaza_boutique_urn_s1',
      x: 16.84,
      z: 0.92,
      halfX: 0.34,
      halfZ: 0.34,
      rotY: 0,
      heightY: 1.65,
      mat: 'concrete',
    },
    {
      id: 'urban_plaza_boutique_urn_n1',
      x: 16.84,
      z: -1.72,
      halfX: 0.34,
      halfZ: 0.34,
      rotY: 0,
      heightY: 1.65,
      mat: 'concrete',
    },
    {
      id: 'urban_plaza_boutique_urn_n2',
      x: 16.84,
      z: -4.72,
      halfX: 0.34,
      halfZ: 0.34,
      rotY: 0,
      heightY: 1.65,
      mat: 'concrete',
    },
    {
      id: 'urban_plaza_boutique_urn_corner_s',
      x: 15.98,
      z: 4.62,
      halfX: 0.34,
      halfZ: 0.34,
      rotY: 0,
      heightY: 1.65,
      mat: 'concrete',
    },
    {
      id: 'urban_plaza_boutique_urn_corner_n',
      x: 15.98,
      z: -5.42,
      halfX: 0.34,
      halfZ: 0.34,
      rotY: 0,
      heightY: 1.65,
      mat: 'concrete',
    },
    // CozyBites front A-frame chalkboard menu sign & 4 corner boxwood urns
    {
      id: 'urban_plaza_cozy_aframe_sign',
      x: 41.06,
      z: -0.82,
      halfX: 0.34,
      halfZ: 0.42,
      rotY: 0.32,
      heightY: 1.45,
      mat: 'wood',
    },
    {
      id: 'urban_plaza_cozy_urn_wn',
      x: 41.24,
      z: -4.42,
      halfX: 0.34,
      halfZ: 0.34,
      rotY: 0,
      heightY: 1.65,
      mat: 'concrete',
    },
    {
      id: 'urban_plaza_cozy_urn_ws',
      x: 41.24,
      z: 3.22,
      halfX: 0.34,
      halfZ: 0.34,
      rotY: 0,
      heightY: 1.65,
      mat: 'concrete',
    },
    {
      id: 'urban_plaza_cozy_urn_sw',
      x: 41.65,
      z: 3.86,
      halfX: 0.34,
      halfZ: 0.34,
      rotY: 0,
      heightY: 1.65,
      mat: 'concrete',
    },
    {
      id: 'urban_plaza_cozy_urn_se',
      x: 48.75,
      z: 3.86,
      halfX: 0.34,
      halfZ: 0.34,
      rotY: 0,
      heightY: 1.65,
      mat: 'concrete',
    },
    // Beauty Salon ("GLOW STUDIO") sidewalk A-frame easels & potted spherical topiaries (`yaw = PI` around 29.5, 14.0)
    {
      id: 'urban_plaza_beauty_aframe_front',
      x: 30.15,
      z: 10.02,
      halfX: 0.40,
      halfZ: 0.34,
      rotY: -0.22,
      heightY: 1.30,
      mat: 'wood',
    },
    {
      id: 'urban_plaza_beauty_aframe_east',
      x: 34.28,
      z: 14.15,
      halfX: 0.34,
      halfZ: 0.40,
      rotY: 0.22,
      heightY: 1.30,
      mat: 'wood',
    },
    {
      id: 'urban_plaza_beauty_topiary_nw',
      x: 25.66,
      z: 10.20,
      halfX: 0.32,
      halfZ: 0.32,
      rotY: 0,
      heightY: 1.45,
      mat: 'concrete',
    },
    {
      id: 'urban_plaza_beauty_topiary_nc',
      x: 28.12,
      z: 10.20,
      halfX: 0.32,
      halfZ: 0.32,
      rotY: 0,
      heightY: 1.45,
      mat: 'concrete',
    },
    {
      id: 'urban_plaza_beauty_topiary_wn',
      x: 24.90,
      z: 12.76,
      halfX: 0.32,
      halfZ: 0.32,
      rotY: 0,
      heightY: 1.45,
      mat: 'concrete',
    },
    {
      id: 'urban_plaza_beauty_topiary_ws',
      x: 24.90,
      z: 15.24,
      halfX: 0.32,
      halfZ: 0.32,
      rotY: 0,
      heightY: 1.45,
      mat: 'concrete',
    },
    {
      id: 'urban_plaza_beauty_topiary_wsw',
      x: 24.90,
      z: 16.95,
      halfX: 0.32,
      halfZ: 0.32,
      rotY: 0,
      heightY: 1.45,
      mat: 'concrete',
    },
    {
      id: 'urban_plaza_beauty_topiary_es',
      x: 34.10,
      z: 16.50,
      halfX: 0.32,
      halfZ: 0.32,
      rotY: 0,
      heightY: 1.45,
      mat: 'concrete',
    },
    {
      id: 'urban_plaza_beauty_topiary_sw',
      x: 28.26,
      z: 17.80,
      halfX: 0.32,
      halfZ: 0.32,
      rotY: 0,
      heightY: 1.45,
      mat: 'concrete',
    },
    {
      id: 'urban_plaza_beauty_topiary_se',
      x: 30.74,
      z: 17.80,
      halfX: 0.32,
      halfZ: 0.32,
      rotY: 0,
      heightY: 1.45,
      mat: 'concrete',
    },
  ];
  for (let i = 0; i < municipalExtras.length; i++) {
    obbs.push(municipalExtras[i]);
  }

  // Central Park standalone botanical beds outside Pond basin
  for (let i = 0; i < CENTRAL_PARK_BOTANICAL_BEDS.length; i++) {
    const bed = CENTRAL_PARK_BOTANICAL_BEDS[i];
    const inPondBasin = Math.hypot(bed.x - pond.centerX, bed.z - pond.centerZ) <= 3.7;
    if (inPondBasin) continue;
    if (hasCloseCollider(obbs, circles, bed.x, bed.z, 0.72)) continue;
    circles.push({
      id: `central_park_bed_${bed.id}`,
      x: bed.x,
      z: bed.z,
      radius: 0.42,
      heightY: 1.05,
      mat: 'wood',
    });
  }

  // All 85 city streetlamps & bollards (deduplicated against existing lamps/poles)
  for (let i = 0; i < CITY_LAMP_MANIFEST.length; i++) {
    const lamp = CITY_LAMP_MANIFEST[i];
    if (hasCloseCollider(obbs, circles, lamp.x, lamp.z, 1.15)) continue;
    const half = LAMP_HALF_EXTENT_BY_TIER[lamp.tier];
    obbs.push({
      id: `city_lamp_${lamp.id}`,
      x: lamp.x,
      z: lamp.z,
      halfX: half,
      halfZ: half,
      rotY: 0,
      heightY: lamp.y + LAMP_HEIGHT_BY_TIER[lamp.tier],
      mat: 'metal',
    });
  }

  // All 18 city traffic signs (deduplicated)
  for (let i = 0; i < CITY_TRAFFIC_SIGN_SPECS.length; i++) {
    const sign = CITY_TRAFFIC_SIGN_SPECS[i];
    if (hasCloseCollider(obbs, circles, sign.x, sign.z, 0.95)) continue;
    const baseY = Math.max(0, getTerrainElevation(sign.x, sign.z));
    obbs.push({
      id: `city_traffic_sign_${sign.id}`,
      x: sign.x,
      z: sign.z,
      halfX: 0.24,
      halfZ: 0.24,
      rotY: 0,
      heightY: baseY + 5.75,
      mat: 'metal',
    });
  }

  const benchAndSeatObbs = obbs.filter((st) => isBenchOrSeatStructureId(st.id));

  cachedAuditBaseRef = baseStructures;
  cachedAuditedSet = { obbs, circles, benchAndSeatObbs };
  return cachedAuditedSet;
}

/**
 * Resolves solid 2D capsule-vs-circle overlap with deterministic fallback normal and tangential velocity slide.
 */
export function resolveCapsuleVsCirclePushout2D(
  moverX: number,
  moverZ: number,
  moverVx: number,
  moverVz: number,
  moverRadius: number,
  targetX: number,
  targetZ: number,
  targetRadius: number,
  restitution: number = 0.0,
  moverShare: number = 1.0,
): {
  collided: boolean;
  x: number;
  z: number;
  vx: number;
  vz: number;
  normalX: number;
  normalZ: number;
  impactSpeed: number;
} {
  const minDist = Math.max(0.05, moverRadius + targetRadius);
  const dx = moverX - targetX;
  const dz = moverZ - targetZ;
  const distSq = dx * dx + dz * dz;
  if (distSq >= minDist * minDist) {
    return {
      collided: false,
      x: moverX,
      z: moverZ,
      vx: moverVx,
      vz: moverVz,
      normalX: 0,
      normalZ: 0,
      impactSpeed: 0,
    };
  }

  const dist = Math.sqrt(distSq);
  const nx = dist > 1e-5 ? dx / dist : 1.0;
  const nz = dist > 1e-5 ? dz / dist : 0.0;
  const overlap = minDist - dist;
  const push = overlap * moverShare;
  const nextX = wrapPlanetCoord(moverX + nx * push);
  const nextZ = wrapPlanetCoord(moverZ + nz * push);

  let nextVx = moverVx;
  let nextVz = moverVz;
  const vn = moverVx * nx + moverVz * nz;
  const impactSpeed = vn < 0 ? -vn : 0;
  if (vn < 0) {
    const bounceScale = 1 + Math.max(0, restitution);
    nextVx -= vn * nx * bounceScale;
    nextVz -= vn * nz * bounceScale;
  }

  return {
    collided: true,
    x: nextX,
    z: nextZ,
    vx: nextVx,
    vz: nextVz,
    normalX: nx,
    normalZ: nz,
    impactSpeed,
  };
}

/**
 * Resolves pair separation between two character capsules using ground elevation filtering and
 * immovable/sitting/talking ownership weights so talking or seated NPCs never jitter or slide off seats.
 */
export function resolveCapsulePairSeparation2D(
  bodyA: CharacterCapsuleBody2D,
  bodyB: CharacterCapsuleBody2D,
  options?: {
    maxVerticalOverlapM?: number;
    restitution?: number;
  },
): boolean {
  const maxVert = options?.maxVerticalOverlapM ?? 2.2;
  if (Math.abs(bodyA.groundY - bodyB.groundY) > maxVert) return false;

  const fixedA = Boolean(bodyA.immovable || bodyA.isSitting || bodyA.isTalking);
  const fixedB = Boolean(bodyB.immovable || bodyB.isSitting || bodyB.isTalking);
  if (fixedA && fixedB) return false;

  const shareA = fixedA ? 0.0 : fixedB ? 1.0 : 0.5;
  const shareB = 1.0 - shareA;

  const minDist = bodyA.radius + bodyB.radius;
  const dx = bodyA.x - bodyB.x;
  const dz = bodyA.z - bodyB.z;
  const distSq = dx * dx + dz * dz;
  if (distSq >= minDist * minDist) return false;

  const dist = Math.sqrt(distSq);
  const nx = dist > 1e-5 ? dx / dist : 1.0;
  const nz = dist > 1e-5 ? dz / dist : 0.0;
  const overlap = minDist - dist;

  if (shareA > 0) {
    bodyA.x = wrapPlanetCoord(bodyA.x + nx * overlap * shareA);
    bodyA.z = wrapPlanetCoord(bodyA.z + nz * overlap * shareA);
    const vnA = bodyA.vx * nx + bodyA.vz * nz;
    if (vnA < 0) {
      const k = 1 + (options?.restitution ?? 0.02);
      bodyA.vx -= vnA * nx * k;
      bodyA.vz -= vnA * nz * k;
    }
  }
  if (shareB > 0) {
    bodyB.x = wrapPlanetCoord(bodyB.x - nx * overlap * shareB);
    bodyB.z = wrapPlanetCoord(bodyB.z - nz * overlap * shareB);
    const vnB = bodyB.vx * -nx + bodyB.vz * -nz;
    if (vnB < 0) {
      const k = 1 + (options?.restitution ?? 0.02);
      bodyB.vx -= vnB * -nx * k;
      bodyB.vz -= vnB * -nz * k;
    }
  }
  return true;
}

/**
 * Multi-iteration capsule depenetration across a cluster of character bodies (e.g., all Town Folks
 * NPCs plus an anchored player capsule) so dense crowds separate without stacking or clipping.
 */
export function resolveMultiIterationCapsuleCluster2D(
  bodies: CharacterCapsuleBody2D[],
  iterations: number = 3,
  options?: { maxVerticalOverlapM?: number; restitution?: number },
): boolean {
  let anyCollided = false;
  const passCount = Math.max(1, iterations);
  for (let pass = 0; pass < passCount; pass++) {
    let passMoved = false;
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        if (resolveCapsulePairSeparation2D(bodies[i], bodies[j], options)) {
          passMoved = true;
          anyCollided = true;
        }
      }
    }
    if (!passMoved) break;
  }
  return anyCollided;
}

/**
 * Enforces NW Oasis Lake, SE Open Ocean, Overwater Pier/Stilt Cabin Deck exceptions,
 * and Outer Embankment boundaries for both players and ambient NPCs.
 */
export function resolveExtendedWaterMarginGuard2D(params: {
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  canTraverseLake?: boolean;
  isAirbornePlane?: boolean;
  prevX?: number;
  prevZ?: number;
  waterMarginM?: number;
}): { x: number; z: number; vx: number; vz: number; hitWater: boolean; hitEmbankment: boolean } {
  let { x, z, vx, vz } = params;
  let hitWater = false;
  let hitEmbankment = false;
  const waterMargin = Math.max(0.1, params.waterMarginM ?? 0.14);

  if (!params.isAirbornePlane) {
    // 1. NW Oasis Lake shoreline
    if (!params.canTraverseLake) {
      const lakeSdf = evaluateNwLakeSdf(x, z);
      if (lakeSdf < -waterMargin) {
        const dx = x - -31.0;
        const dz = z;
        const len = Math.max(0.01, Math.hypot(dx, dz));
        const nx = dx / len;
        const nz = dz / len;
        const pushOut = -waterMargin - lakeSdf;
        x = wrapPlanetCoord(x + nx * pushOut);
        z = wrapPlanetCoord(z + nz * pushOut);
        const vn = vx * nx + vz * nz;
        if (vn < 0) {
          vx -= vn * nx;
          vz -= vn * nz;
        }
        hitWater = true;
      }
    }

    // 2. East Open Ocean (honoring Beachfront Stilt Cabin Deck) + Beach Club Infinity Pool Basins
    const harborWaterSdf = evaluateSeHarborSdf(x, z).waterSdf;
    const onSafeOverwaterDeck = isPointOnBeachfrontStiltCabinDeck(x, z);
    if (harborWaterSdf < -waterMargin && !onSafeOverwaterDeck) {
      const nx = -1.0;
      const nz = 0.0;
      const pushOut = -waterMargin - harborWaterSdf;
      x = wrapPlanetCoord(x + nx * pushOut);
      z = wrapPlanetCoord(z + nz * pushOut);
      // If previous frame was on stilt deck over deep sea (> 0.6m off shore), keep clamped on deck
      if (
        params.prevX !== undefined &&
        params.prevZ !== undefined &&
        isPointOnBeachfrontStiltCabinDeck(params.prevX, params.prevZ) &&
        evaluateSeHarborSdf(params.prevX, params.prevZ).waterSdf < -0.5
      ) {
        x = params.prevX;
        z = params.prevZ;
      }
      const vn = vx * nx + vz * nz;
      if (vn < 0) {
        vx -= vn * nx;
        vz -= vn * nz;
      }
      hitWater = true;
    }

    const poolWaterSdf = evaluateBeachClubPoolWaterSdf(x, z);
    if (poolWaterSdf < 0.02) {
      const eps = 0.25;
      const gx = evaluateBeachClubPoolWaterSdf(x + eps, z) - evaluateBeachClubPoolWaterSdf(x - eps, z);
      const gz = evaluateBeachClubPoolWaterSdf(x, z + eps) - evaluateBeachClubPoolWaterSdf(x, z - eps);
      const glen = Math.hypot(gx, gz);
      const nx = glen > 1e-4 ? gx / glen : -1.0;
      const nz = glen > 1e-4 ? gz / glen : 0.0;
      const pushOut = Math.min(2.2, 0.04 - poolWaterSdf);
      x = wrapPlanetCoord(x + nx * pushOut);
      z = wrapPlanetCoord(z + nz * pushOut);
      const vn = vx * nx + vz * nz;
      if (vn < 0) {
        vx -= vn * nx;
        vz -= vn * nz;
      }
      hitWater = true;
    }
  }

  // 3. Outer Perimeter Hill Embankment ("Tanggul Bukit")
  const embSdf = evaluateOuterEmbankmentSdf(x, z);
  const embLimit = -Math.max(0.65, params.radius);
  if (embSdf > embLimit) {
    const eps = 0.5;
    const gx =
      evaluateOuterEmbankmentSdf(x + eps, z) - evaluateOuterEmbankmentSdf(x - eps, z);
    const gz =
      evaluateOuterEmbankmentSdf(x, z + eps) - evaluateOuterEmbankmentSdf(x, z - eps);
    const glen = Math.max(0.001, Math.hypot(gx, gz));
    const nx = -gx / glen;
    const nz = -gz / glen;
    const pushIn = embSdf - embLimit;
    x = wrapPlanetCoord(x + nx * pushIn);
    z = wrapPlanetCoord(z + nz * pushIn);
    const vn = vx * nx + vz * nz;
    if (vn < 0) {
      vx -= vn * nx * 1.15;
      vz -= vn * nz * 1.15;
    }
    hitEmbankment = true;
  }

  return { x, z, vx, vz, hitWater, hitEmbankment };
}

function isInsideStaircaseCorridor(x: number, z: number): StaircaseChannelRect | null {
  for (let i = 0; i < WORLD_STAIRCASE_CORRIDORS.length; i++) {
    const c = WORLD_STAIRCASE_CORRIDORS[i];
    if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) {
      return c;
    }
  }
  return null;
}

/**
 * Clamps staircase cheek-curb edges and prevents horizontal clipping across sheer elevation
 * retaining drops (> maxStepDeltaM outside stair/ramp lanes), attempting axis-isolated slide before reverting.
 */
export function resolveStaircaseAndElevationGuard2D(params: {
  prevX: number;
  prevZ: number;
  nextX: number;
  nextZ: number;
  vx: number;
  vz: number;
  radius: number;
  maxStepDeltaM?: number;
  elevationSampler?: (x: number, z: number) => number;
}): { x: number; z: number; vx: number; vz: number; clamped: boolean } {
  const sampleY = params.elevationSampler ?? getTerrainElevation;
  const maxStepDelta = params.maxStepDeltaM ?? 0.92;
  let { nextX, nextZ, vx, vz } = params;
  let clamped = false;

  // 1. Staircase side cheek containment when walking cleanly up/down a focused staircase channel
  const prevCorridor = isInsideStaircaseCorridor(params.prevX, params.prevZ);
  if (prevCorridor && !prevCorridor.openSides) {
    const pad = Math.min(0.42, params.radius * 0.48);
    if ((prevCorridor.axis ?? 'x') === 'x') {
      if (nextX >= prevCorridor.minX && nextX <= prevCorridor.maxX) {
        if (nextZ < prevCorridor.minZ + pad && prevCorridor.maxZ - prevCorridor.minZ > pad * 2.5) {
          nextZ = prevCorridor.minZ + pad;
          if (vz < 0) vz = 0;
          clamped = true;
        } else if (
          nextZ > prevCorridor.maxZ - pad &&
          prevCorridor.maxZ - prevCorridor.minZ > pad * 2.5
        ) {
          nextZ = prevCorridor.maxZ - pad;
          if (vz > 0) vz = 0;
          clamped = true;
        }
      }
    } else if (nextZ >= prevCorridor.minZ && nextZ <= prevCorridor.maxZ) {
      if (nextX < prevCorridor.minX + pad && prevCorridor.maxX - prevCorridor.minX > pad * 2.5) {
        nextX = prevCorridor.minX + pad;
        if (vx < 0) vx = 0;
        clamped = true;
      } else if (
        nextX > prevCorridor.maxX - pad &&
        prevCorridor.maxX - prevCorridor.minX > pad * 2.5
      ) {
        nextX = prevCorridor.maxX - pad;
        if (vx > 0) vx = 0;
        clamped = true;
      }
    }
  }

  // 2. Sheer retaining cliff / plaza drop-off step check with axis-isolated tangential slide
  const inStairCorridor =
    Boolean(prevCorridor) || Boolean(isInsideStaircaseCorridor(nextX, nextZ));
  const effectiveMaxStepDelta = inStairCorridor ? Math.max(maxStepDelta, 1.45) : maxStepDelta;
  const prevY = sampleY(params.prevX, params.prevZ);
  const nextY = sampleY(nextX, nextZ);
  if (Math.abs(nextY - prevY) > effectiveMaxStepDelta) {
    const slideXy = Math.abs(sampleY(nextX, params.prevZ) - prevY);
    const slideZy = Math.abs(sampleY(params.prevX, nextZ) - prevY);
    if (slideXy <= effectiveMaxStepDelta) {
      nextZ = params.prevZ;
      vz = 0;
    } else if (slideZy <= effectiveMaxStepDelta) {
      nextX = params.prevX;
      vx = 0;
    } else {
      nextX = params.prevX;
      nextZ = params.prevZ;
      vx = 0;
      vz = 0;
    }
    clamped = true;
  }

  return { x: nextX, z: nextZ, vx, vz, clamped };
}

/**
 * Multi-iteration static world collision solver combining audited OBBs, true circle colliders
 * (Central Park Fountain/Lily Pond, cozy bistro sets, botanical beds),
 * and water/embankment boundaries for any ground mover (player or ambient NPC).
 */
export function resolveGroundMoverAuditedCollisions2D(params: {
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  moverAltitude?: number;
  moverFeetY?: number;
  audited: AuditedWorldCollidersSet;
  prevX?: number;
  prevZ?: number;
  waterMarginM?: number;
  restitution?: number;
  iterations?: number;
  stayOffNonCrosswalkRoads?: boolean;
  exemptSeatPoint?: { x: number; z: number } | null;
  obbFilter?: (obb: StaticWorldStructureObb) => boolean;
}): {
  x: number;
  z: number;
  vx: number;
  vz: number;
  collided: boolean;
} {
  let { x, z, vx, vz } = params;
  const moverAltitude = params.moverAltitude ?? 0;
  const restitution = params.restitution ?? 0.08;
  const iterations = Math.max(1, params.iterations ?? 2);
  let collided = false;

  for (let pass = 0; pass < iterations; pass++) {
    let passHit = false;

    const waterRes = resolveExtendedWaterMarginGuard2D({
      x,
      z,
      vx,
      vz,
      radius: params.radius,
      prevX: params.prevX,
      prevZ: params.prevZ,
      waterMarginM: params.waterMarginM,
    });
    if (waterRes.hitWater || waterRes.hitEmbankment) {
      x = waterRes.x;
      z = waterRes.z;
      vx = waterRes.vx;
      vz = waterRes.vz;
      passHit = true;
    }

    const curGroundY = getTerrainElevation(x, z);
    const approachGroundY =
      params.prevX !== undefined && params.prevZ !== undefined
        ? Math.min(curGroundY, getTerrainElevation(params.prevX, params.prevZ))
        : curGroundY;
    const moverFeetY = params.moverFeetY ?? approachGroundY + moverAltitude;

    const obbs = params.audited.obbs;
    for (let i = 0; i < obbs.length; i++) {
      const st = obbs[i];
      if (isStaticColliderBelowMoverFeet(st.heightY, moverFeetY, st.isRetainingWall)) continue;
      if (params.obbFilter && !params.obbFilter(st)) continue;
      if (isExemptSeatObb(st, params.exemptSeatPoint)) continue;
      const maxReach = st.halfX + st.halfZ + params.radius + 1.5;
      if (Math.abs(x - st.x) > maxReach || Math.abs(z - st.z) > maxReach) continue;

      const res = resolveSolidObbCollision2D(
        x,
        z,
        vx,
        vz,
        params.radius,
        st.x,
        st.z,
        st.halfX,
        st.halfZ,
        st.rotY,
        restitution,
      );
      if (res.collided) {
        x = wrapPlanetCoord(res.x);
        z = wrapPlanetCoord(res.z);
        vx = res.vx;
        vz = res.vz;
        passHit = true;
      }
    }

    const circles = params.audited.circles;
    for (let i = 0; i < circles.length; i++) {
      const c = circles[i];
      if (isStaticColliderBelowMoverFeet(c.heightY, moverFeetY, false)) continue;
      const maxReach = c.radius + params.radius + 1.5;
      if (Math.abs(x - c.x) > maxReach || Math.abs(z - c.z) > maxReach) continue;
      const res = resolveCapsuleVsCirclePushout2D(
        x,
        z,
        vx,
        vz,
        params.radius,
        c.x,
        c.z,
        c.radius,
        restitution,
        1.0,
      );
      if (res.collided) {
        x = res.x;
        z = res.z;
        vx = res.vx;
        vz = res.vz;
        passHit = true;
      }
    }

    if (passHit) {
      collided = true;
    } else {
      break;
    }
  }

  // Optional pedestrian road-curb safety check so collision slide never ejects onto active traffic lanes
  if (
    params.stayOffNonCrosswalkRoads &&
    params.prevX !== undefined &&
    params.prevZ !== undefined
  ) {
    const prevRoadSdf = evaluateRoadNetworkSdf(params.prevX, params.prevZ);
    const nextRoadSdf = evaluateRoadNetworkSdf(x, z);
    const wasOnSidewalk =
      prevRoadSdf > 0.15 ||
      isPointOnPedestrianCrosswalkCorridor(params.prevX, params.prevZ);
    const nowOnUnsafeRoad =
      nextRoadSdf <= 0.15 &&
      !isPointOnPedestrianCrosswalkCorridor(x, z);
    const climbingOffCurbApron = prevRoadSdf <= 0.15 && nextRoadSdf > prevRoadSdf + 1e-4;
    if (wasOnSidewalk && nowOnUnsafeRoad && !climbingOffCurbApron) {
      x = params.prevX;
      z = params.prevZ;
      vx = 0;
      vz = 0;
    }
  }

  return { x, z, vx, vz, collided };
}

export interface DynamicObbObstacle2D {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  rotY: number;
  vx?: number;
  vz?: number;
}

export interface DynamicCircleObstacle2D {
  x: number;
  z: number;
  radius: number;
}

/**
 * Resolves a character capsule against dynamic moving/prop OBBs and circles (e.g., streetcars,
 * traffic vehicles, standing merchants, trees, solid benches/bins) using tangential slide.
 */
export function resolveCharacterAgainstDynamicObstacles2D(params: {
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  obbs: readonly DynamicObbObstacle2D[];
  circles: readonly DynamicCircleObstacle2D[];
  restitution?: number;
}): { x: number; z: number; vx: number; vz: number; collided: boolean } {
  let { x, z, vx, vz } = params;
  const restitution = params.restitution ?? 0.04;
  let collided = false;

  for (let i = 0; i < params.obbs.length; i++) {
    const obb = params.obbs[i];
    const maxReach = obb.halfX + obb.halfZ + params.radius + 1.0;
    if (Math.abs(x - obb.x) > maxReach || Math.abs(z - obb.z) > maxReach) continue;
    const ovx = obb.vx ?? 0;
    const ovz = obb.vz ?? 0;
    const res = resolveSolidObbCollision2D(
      x,
      z,
      vx - ovx,
      vz - ovz,
      params.radius,
      obb.x,
      obb.z,
      obb.halfX,
      obb.halfZ,
      obb.rotY,
      restitution,
    );
    if (res.collided) {
      x = wrapPlanetCoord(res.x);
      z = wrapPlanetCoord(res.z);
      vx = res.vx + ovx * 0.5;
      vz = res.vz + ovz * 0.5;
      collided = true;
    }
  }

  for (let i = 0; i < params.circles.length; i++) {
    const c = params.circles[i];
    const maxReach = c.radius + params.radius + 0.5;
    if (Math.abs(x - c.x) > maxReach || Math.abs(z - c.z) > maxReach) continue;
    const res = resolveCapsuleVsCirclePushout2D(
      x,
      z,
      vx,
      vz,
      params.radius,
      c.x,
      c.z,
      c.radius,
      restitution,
      1.0,
    );
    if (res.collided) {
      x = res.x;
      z = res.z;
      vx = res.vx;
      vz = res.vz;
      collided = true;
    }
  }

  return { x, z, vx, vz, collided };
}

/**
 * Computes whether a moving ambient NPC should yield seat-bench OBBs around its imminent sit_relax
 * target waypoint so it can cleanly step into sitting alignment without being blocked by the bench itself.
 */
export function resolveAmbientNpcExemptSeatPoint(
  preset: CityAmbientNpcPreset,
  waypointIdx: number,
  npcX: number,
  npcZ: number,
  isSitting: boolean,
  seatOverride?: { wpIdx: number; x: number; z: number } | null,
): { x: number; z: number } | null {
  if (isSitting) {
    return { x: npcX, z: npcZ };
  }
  const wps = preset.waypoints;
  if (wps.length === 0) return null;
  const safeIdx = ((waypointIdx % wps.length) + wps.length) % wps.length;
  const targetWp = wps[safeIdx];
  const act = targetWp?.activity ?? preset.activity;
  const activeGoal =
    seatOverride && seatOverride.wpIdx === safeIdx ? seatOverride : targetWp;
  if (act === 'sit_relax' && Math.hypot(npcX - activeGoal.x, npcZ - activeGoal.z) <= 2.35) {
    return { x: activeGoal.x, z: activeGoal.z };
  }
  const prevIdx = (safeIdx - 1 + wps.length) % wps.length;
  const prevWp = wps[prevIdx];
  const prevAct = prevWp?.activity ?? preset.activity;
  const prevGoal =
    seatOverride && seatOverride.wpIdx === prevIdx ? seatOverride : prevWp;
  if (prevAct === 'sit_relax' && Math.hypot(npcX - prevGoal.x, npcZ - prevGoal.z) <= 1.25) {
    return { x: prevGoal.x, z: prevGoal.z };
  }
  return null;
}

export interface PedestrianAvoidanceCapsule2D {
  id: string;
  x: number;
  z: number;
  vx?: number;
  vz?: number;
  radius: number;
  groundY?: number;
  isSitting?: boolean;
}

export interface LocalPedestrianAvoidanceInput {
  selfId: string;
  x: number;
  z: number;
  dirX: number;
  dirZ: number;
  radius: number;
  moverAltitude?: number;
  moverFeetY?: number;
  selfGroundY?: number;
  distToSteerTarget: number;
  distToFinal: number;
  isFinalGoal: boolean;
  dt: number;
  audited: AuditedWorldCollidersSet;
  dynamicObbs?: readonly DynamicObbObstacle2D[];
  dynamicCircles?: readonly DynamicCircleObstacle2D[];
  characterCapsules?: readonly PedestrianAvoidanceCapsule2D[];
  exemptSeatPoint?: { x: number; z: number } | null;
  stayOffNonCrosswalkRoads?: boolean;
  avoidSide?: number;
  avoidTimer?: number;
  lookaheadM?: number;
}

export interface LocalPedestrianAvoidanceResult {
  dirX: number;
  dirZ: number;
  speedScale: number;
  avoidSide: number;
  avoidTimer: number;
  blocked: boolean;
}

// Module-level preallocated index buffers so hot-loop obstacle probes allocate zero heap memory.
let nearObbIndices: Int32Array = new Int32Array(256);
let nearCircleIndices: Int32Array = new Int32Array(256);
let nearDynObbIndices: Int32Array = new Int32Array(256);
let nearDynCircleIndices: Int32Array = new Int32Array(256);
let nearCharIndices: Int32Array = new Int32Array(256);

function growInt32Buffer(buf: Int32Array, minLen: number): Int32Array {
  if (minLen <= buf.length) return buf;
  const next = new Int32Array(Math.max(buf.length * 2, minLen));
  next.set(buf);
  return next;
}

// Symmetric tangent steering angles ordered from smallest deviation outward:
// ±22°, ±45°, ±70°, ±95°, ±120° (pairs: +deg = keep-right side +1, -deg = left side -1).
const AVOID_TIER_RAD = [
  (22 * Math.PI) / 180,
  (45 * Math.PI) / 180,
  (70 * Math.PI) / 180,
  (95 * Math.PI) / 180,
  (120 * Math.PI) / 180,
];
const AVOID_TIER_COS = AVOID_TIER_RAD.map((r) => Math.cos(r));
const AVOID_TIER_SIN = AVOID_TIER_RAD.map((r) => Math.sin(r));
const AVOID_EMERGENCY_RAD = (145 * Math.PI) / 180;
const AVOID_EMERGENCY_COS = Math.cos(AVOID_EMERGENCY_RAD);
const AVOID_EMERGENCY_SIN = Math.sin(AVOID_EMERGENCY_RAD);

function sweepRayAgainstObb2D(
  x: number,
  z: number,
  candX: number,
  candZ: number,
  maxDist: number,
  probeR: number,
  selfRadius: number,
  obbX: number,
  obbZ: number,
  halfX: number,
  halfZ: number,
  rotY: number,
): number {
  const dx = x - obbX;
  const dz = z - obbZ;
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const lx = dx * cosY - dz * sinY;
  const lz = dx * sinY + dz * cosY;
  const ldx = candX * cosY - candZ * sinY;
  const ldz = candX * sinY + candZ * cosY;

  const cx0 = lx < -halfX ? -halfX : lx > halfX ? halfX : lx;
  const cz0 = lz < -halfZ ? -halfZ : lz > halfZ ? halfZ : lz;
  const dlx0 = lx - cx0;
  const dlz0 = lz - cz0;
  const d0Sq = dlx0 * dlx0 + dlz0 * dlz0;

  if (d0Sq <= 1e-6) {
    const penX = halfX - Math.abs(lx);
    const penZ = halfZ - Math.abs(lz);
    const nlx = penX < penZ ? (lx >= 0 ? 1 : -1) : 0;
    const nlz = penX < penZ ? 0 : lz >= 0 ? 1 : -1;
    return nlx * ldx + nlz * ldz > 0.15 ? Infinity : 0;
  }

  const dot0 = dlx0 * ldx + dlz0 * ldz;
  if (d0Sq < probeR * probeR) {
    if (dot0 < -0.02 || (d0Sq < selfRadius * selfRadius * 0.85 && dot0 <= 0.05)) {
      return 0;
    }
  }

  const ex = halfX + probeR;
  const ez = halfZ + probeR;
  let tEnter = 0;
  let tExit = maxDist;

  if (Math.abs(ldx) < 1e-8) {
    if (lx < -ex || lx > ex) return Infinity;
  } else {
    const invX = 1 / ldx;
    let t1 = (-ex - lx) * invX;
    let t2 = (ex - lx) * invX;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tEnter) tEnter = t1;
    if (t2 < tExit) tExit = t2;
    if (tEnter > tExit) return Infinity;
  }

  if (Math.abs(ldz) < 1e-8) {
    if (lz < -ez || lz > ez) return Infinity;
  } else {
    const invZ = 1 / ldz;
    let t1 = (-ez - lz) * invZ;
    let t2 = (ez - lz) * invZ;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tEnter) tEnter = t1;
    if (t2 < tExit) tExit = t2;
    if (tEnter > tExit) return Infinity;
  }

  const tStart = Math.max(dot0 > 0.05 ? 0.24 : 0.04, tEnter);
  const tEnd = Math.min(maxDist, tExit);
  if (tStart > tEnd) return Infinity;

  const span = tEnd - tStart;
  const steps = Math.max(1, Math.ceil(span / 0.26));
  const probeRSq = probeR * probeR;
  for (let s = 0; s <= steps; s++) {
    const t = s === steps ? tEnd : tStart + (span * s) / steps;
    const px = lx + ldx * t;
    const pz = lz + ldz * t;
    const cx = px < -halfX ? -halfX : px > halfX ? halfX : px;
    const cz = pz < -halfZ ? -halfZ : pz > halfZ ? halfZ : pz;
    const ox = px - cx;
    const oz = pz - cz;
    if (ox * ox + oz * oz < probeRSq) {
      return t;
    }
  }
  return Infinity;
}

function sweepRayAgainstCircle2D(
  x: number,
  z: number,
  candX: number,
  candZ: number,
  maxDist: number,
  probeR: number,
  selfRadius: number,
  cx: number,
  cz: number,
  cr: number,
): number {
  const combinedR = probeR + cr;
  const rx = cx - x;
  const rz = cz - z;
  const d0Sq = rx * rx + rz * rz;
  const proj = rx * candX + rz * candZ;

  if (d0Sq < combinedR * combinedR) {
    if (proj <= 0) return Infinity;
    const d0 = Math.sqrt(d0Sq);
    if (d0 < selfRadius + cr - 0.04) return 0;
    return proj > 0.12 * d0 ? 0 : Infinity;
  }

  if (proj <= 0 || proj > maxDist + combinedR) return Infinity;
  const perpSq = d0Sq - proj * proj;
  const combinedRSq = combinedR * combinedR;
  if (perpSq >= combinedRSq) return Infinity;
  const tHit = proj - Math.sqrt(combinedRSq - perpSq);
  return tHit <= maxDist ? (tHit > 0 ? tHit : 0) : Infinity;
}

function evaluateTerrainClearanceAlongRay2D(
  x: number,
  z: number,
  candX: number,
  candZ: number,
  maxDist: number,
  stayOffNonCrosswalkRoads: boolean,
  startRoadSdf: number,
  startOnNonCrosswalkRoad: boolean,
  startElev: number,
): number {
  const stepDist = 0.28;
  const steps = Math.max(1, Math.ceil(maxDist / stepDist));
  let prevElev = startElev;
  let prevCorridor = isInsideStaircaseCorridor(x, z);

  for (let s = 1; s <= steps; s++) {
    const dist = s === steps ? maxDist : (maxDist * s) / steps;
    const px = wrapPlanetCoord(x + candX * dist);
    const pz = wrapPlanetCoord(z + candZ * dist);

    if (evaluateOuterEmbankmentSdf(px, pz) > -0.85) {
      return Math.max(0, dist - 0.35);
    }
    if (evaluateNwLakeSdf(px, pz) < 0.25) {
      return Math.max(0, dist - 0.35);
    }
    if (
      evaluateSeHarborSdf(px, pz).waterSdf < 0.25 &&
      !isPointOnBeachfrontStiltCabinDeck(px, pz)
    ) {
      return Math.max(0, dist - 0.35);
    }
    if (evaluateBeachClubPoolWaterSdf(px, pz) < 0.2) {
      return Math.max(0, dist - 0.35);
    }

    const roadSdf = evaluateRoadNetworkSdf(px, pz);
    const onCrosswalk = isPointOnPedestrianCrosswalkCorridor(px, pz);
    if (stayOffNonCrosswalkRoads) {
      if (!startOnNonCrosswalkRoad) {
        if (roadSdf <= 0.15 && !onCrosswalk) {
          return Math.max(0, dist - 0.35);
        }
      } else if (!onCrosswalk && roadSdf < startRoadSdf - 0.05) {
        // When recovering from a curb edge, steer back toward sidewalk instead of deeper into traffic
        return Math.max(0, dist - 0.35);
      }
    }

    const nextCorridor = isInsideStaircaseCorridor(px, pz);
    if (prevCorridor && !prevCorridor.openSides) {
      if (
        (prevCorridor.axis ?? 'x') === 'x' &&
        px >= prevCorridor.minX &&
        px <= prevCorridor.maxX &&
        prevCorridor.maxZ - prevCorridor.minZ > 1.0 &&
        (pz < prevCorridor.minZ + 0.24 || pz > prevCorridor.maxZ - 0.24)
      ) {
        return Math.max(0, dist - 0.35);
      }
      if (
        prevCorridor.axis === 'z' &&
        pz >= prevCorridor.minZ &&
        pz <= prevCorridor.maxZ &&
        prevCorridor.maxX - prevCorridor.minX > 1.0 &&
        (px < prevCorridor.minX + 0.24 || px > prevCorridor.maxX - 0.24)
      ) {
        return Math.max(0, dist - 0.35);
      }
    }
    const elev = getTerrainElevation(px, pz);
    const maxStep = prevCorridor || nextCorridor ? 1.45 : 0.92;
    if (Math.abs(elev - prevElev) > maxStep) {
      return Math.max(0, dist - 0.35);
    }

    prevElev = elev;
    prevCorridor = nextCorridor;
  }
  return Infinity;
}

/**
 * Checks whether the straight capsule segment `(fromX, fromZ) -> (toX, toZ)` is clear of
 * static audited OBBs (excluding exempt seat benches), circles, and solid props/trees.
 */
export function isSegmentClearOfAuditedStaticObstacles2D(params: {
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  radius: number;
  moverAltitude?: number;
  moverFeetY?: number;
  audited: AuditedWorldCollidersSet;
  dynamicObbs?: readonly DynamicObbObstacle2D[];
  dynamicCircles?: readonly DynamicCircleObstacle2D[];
  exemptSeatPoint?: { x: number; z: number } | null;
}): boolean {
  const dx = params.toX - params.fromX;
  const dz = params.toZ - params.fromZ;
  const dist = Math.hypot(dx, dz);
  if (dist <= 0.05) return true;
  const dirX = dx / dist;
  const dirZ = dz / dist;
  const moverAltitude = params.moverAltitude ?? 0;
  const segFeetY =
    params.moverFeetY ??
    Math.min(
      getTerrainElevation(params.fromX, params.fromZ),
      getTerrainElevation(params.toX, params.toZ),
    ) + moverAltitude;

  const obbs = params.audited.obbs;
  for (let i = 0; i < obbs.length; i++) {
    const st = obbs[i];
    if (isStaticColliderBelowMoverFeet(st.heightY, segFeetY, st.isRetainingWall)) continue;
    if (isExemptSeatObb(st, params.exemptSeatPoint)) continue;
    const maxReach = st.halfX + st.halfZ + params.radius + dist + 0.25;
    if (Math.abs(params.fromX - st.x) > maxReach || Math.abs(params.fromZ - st.z) > maxReach) {
      continue;
    }
    if (
      sweepRayAgainstObb2D(
        params.fromX,
        params.fromZ,
        dirX,
        dirZ,
        dist,
        params.radius,
        params.radius,
        st.x,
        st.z,
        st.halfX,
        st.halfZ,
        st.rotY,
      ) < dist
    ) {
      return false;
    }
  }

  const circles = params.audited.circles;
  for (let i = 0; i < circles.length; i++) {
    const c = circles[i];
    if (isStaticColliderBelowMoverFeet(c.heightY, segFeetY, false)) continue;
    const maxReach = c.radius + params.radius + dist + 0.25;
    if (Math.abs(params.fromX - c.x) > maxReach || Math.abs(params.fromZ - c.z) > maxReach) {
      continue;
    }
    if (
      sweepRayAgainstCircle2D(
        params.fromX,
        params.fromZ,
        dirX,
        dirZ,
        dist,
        params.radius,
        params.radius,
        c.x,
        c.z,
        c.radius,
      ) < dist
    ) {
      return false;
    }
  }

  if (params.dynamicObbs) {
    for (let i = 0; i < params.dynamicObbs.length; i++) {
      const obb = params.dynamicObbs[i];
      if ((obb.vx ?? 0) !== 0 || (obb.vz ?? 0) !== 0) continue;
      const maxReach = obb.halfX + obb.halfZ + params.radius + dist + 0.25;
      if (Math.abs(params.fromX - obb.x) > maxReach || Math.abs(params.fromZ - obb.z) > maxReach) {
        continue;
      }
      if (
        sweepRayAgainstObb2D(
          params.fromX,
          params.fromZ,
          dirX,
          dirZ,
          dist,
          params.radius,
          params.radius,
          obb.x,
          obb.z,
          obb.halfX,
          obb.halfZ,
          obb.rotY,
        ) < dist
      ) {
        return false;
      }
    }
  }

  if (params.dynamicCircles) {
    for (let i = 0; i < params.dynamicCircles.length; i++) {
      const c = params.dynamicCircles[i];
      const maxReach = c.radius + params.radius + dist + 0.25;
      if (Math.abs(params.fromX - c.x) > maxReach || Math.abs(params.fromZ - c.z) > maxReach) {
        continue;
      }
      if (
        sweepRayAgainstCircle2D(
          params.fromX,
          params.fromZ,
          dirX,
          dirZ,
          dist,
          params.radius,
          params.radius,
          c.x,
          c.z,
          c.radius,
        ) < dist
      ) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Zero-allocation forward capsule sweep & symmetric tangent steering (`±22°, ±45°, ±70°, ±95°, ±120°`)
 * for Town Folks NPCs so they smoothly arc around Halte poles, streetlamps, shelter posts, props,
 * and nearby standing/walking characters while staying off non-crosswalk asphalt, cliffs, and water.
 */
export function computeLocalPedestrianAvoidance2D(
  input: LocalPedestrianAvoidanceInput,
  out?: LocalPedestrianAvoidanceResult,
): LocalPedestrianAvoidanceResult {
  const result = out ?? {
    dirX: input.dirX,
    dirZ: input.dirZ,
    speedScale: 1,
    avoidSide: 0,
    avoidTimer: 0,
    blocked: false,
  };

  const baseLook = input.lookaheadM ?? 1.85;
  const lookDist = input.isFinalGoal
    ? Math.min(baseLook, Math.max(0.55, input.distToFinal))
    : baseLook;
  const prevAvoidSide = input.avoidSide ?? 0;
  const prevAvoidTimer = Math.max(0, input.avoidTimer ?? 0);
  const dt = Math.max(0, input.dt);
  const tightGoalApproach = input.isFinalGoal && input.distToFinal <= 1.25;
  const zeroProbeR = tightGoalApproach
    ? input.radius
    : input.radius + (prevAvoidTimer > 0 ? 0.12 : 0.04);
  const angleProbeR = input.radius;
  const maxSweepR = Math.max(zeroProbeR, angleProbeR);
  const moverAltitude = input.moverAltitude ?? 0;
  const selfGroundY = input.selfGroundY ?? getTerrainElevation(input.x, input.z);
  const moverFeetY = input.moverFeetY ?? selfGroundY + moverAltitude;
  const stayOffRoads = input.stayOffNonCrosswalkRoads !== false;
  const startRoadSdf = evaluateRoadNetworkSdf(input.x, input.z);
  const startOnNonCrosswalkRoad =
    startRoadSdf <= 0.15 && !isPointOnPedestrianCrosswalkCorridor(input.x, input.z);

  // Collect nearby obstacle indices once using preallocated scratch arrays.
  let nearObbCount = 0;
  const obbs = input.audited.obbs;
  for (let i = 0; i < obbs.length; i++) {
    const st = obbs[i];
    if (isStaticColliderBelowMoverFeet(st.heightY, moverFeetY, st.isRetainingWall)) continue;
    if (isExemptSeatObb(st, input.exemptSeatPoint)) continue;
    const reach = st.halfX + st.halfZ + maxSweepR + lookDist + 0.55;
    if (Math.abs(input.x - st.x) > reach || Math.abs(input.z - st.z) > reach) continue;
    if (nearObbCount >= nearObbIndices.length) {
      nearObbIndices = growInt32Buffer(nearObbIndices, nearObbCount + 1);
    }
    nearObbIndices[nearObbCount++] = i;
  }

  let nearCircleCount = 0;
  const circles = input.audited.circles;
  for (let i = 0; i < circles.length; i++) {
    const c = circles[i];
    if (isStaticColliderBelowMoverFeet(c.heightY, moverFeetY, false)) continue;
    const reach = c.radius + maxSweepR + lookDist + 0.55;
    if (Math.abs(input.x - c.x) > reach || Math.abs(input.z - c.z) > reach) continue;
    if (nearCircleCount >= nearCircleIndices.length) {
      nearCircleIndices = growInt32Buffer(nearCircleIndices, nearCircleCount + 1);
    }
    nearCircleIndices[nearCircleCount++] = i;
  }

  let nearDynObbCount = 0;
  const dynObbs = input.dynamicObbs;
  if (dynObbs) {
    for (let i = 0; i < dynObbs.length; i++) {
      const obb = dynObbs[i];
      const reach = obb.halfX + obb.halfZ + maxSweepR + lookDist + 0.55;
      if (Math.abs(input.x - obb.x) > reach || Math.abs(input.z - obb.z) > reach) continue;
      if (nearDynObbCount >= nearDynObbIndices.length) {
        nearDynObbIndices = growInt32Buffer(nearDynObbIndices, nearDynObbCount + 1);
      }
      nearDynObbIndices[nearDynObbCount++] = i;
    }
  }

  let nearDynCircleCount = 0;
  const dynCircles = input.dynamicCircles;
  if (dynCircles) {
    for (let i = 0; i < dynCircles.length; i++) {
      const c = dynCircles[i];
      const reach = c.radius + maxSweepR + lookDist + 0.55;
      if (Math.abs(input.x - c.x) > reach || Math.abs(input.z - c.z) > reach) continue;
      if (nearDynCircleCount >= nearDynCircleIndices.length) {
        nearDynCircleIndices = growInt32Buffer(nearDynCircleIndices, nearDynCircleCount + 1);
      }
      nearDynCircleIndices[nearDynCircleCount++] = i;
    }
  }

  let nearCharCount = 0;
  const chars = input.characterCapsules;
  if (chars) {
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (ch.id === input.selfId) continue;
      if (ch.groundY !== undefined && Math.abs(ch.groundY - selfGroundY) > 2.2) continue;
      const reach = ch.radius + maxSweepR + lookDist + 0.85;
      if (Math.abs(input.x - ch.x) > reach || Math.abs(input.z - ch.z) > reach) continue;
      if (nearCharCount >= nearCharIndices.length) {
        nearCharIndices = growInt32Buffer(nearCharIndices, nearCharCount + 1);
      }
      nearCharIndices[nearCharCount++] = i;
    }
  }

  const probeCandidate = (candX: number, candZ: number, probeDist: number, probeR: number): number => {
    let bestHit = evaluateTerrainClearanceAlongRay2D(
      input.x,
      input.z,
      candX,
      candZ,
      probeDist,
      stayOffRoads,
      startRoadSdf,
      startOnNonCrosswalkRoad,
      selfGroundY,
    );
    if (bestHit <= 0) return 0;

    for (let k = 0; k < nearObbCount; k++) {
      const st = obbs[nearObbIndices[k]];
      const h = sweepRayAgainstObb2D(
        input.x,
        input.z,
        candX,
        candZ,
        probeDist,
        probeR,
        input.radius,
        st.x,
        st.z,
        st.halfX,
        st.halfZ,
        st.rotY,
      );
      if (h < bestHit) bestHit = h;
      if (bestHit <= 0) return 0;
    }

    for (let k = 0; k < nearCircleCount; k++) {
      const c = circles[nearCircleIndices[k]];
      const h = sweepRayAgainstCircle2D(
        input.x,
        input.z,
        candX,
        candZ,
        probeDist,
        probeR,
        input.radius,
        c.x,
        c.z,
        c.radius,
      );
      if (h < bestHit) bestHit = h;
      if (bestHit <= 0) return 0;
    }

    if (dynObbs) {
      for (let k = 0; k < nearDynObbCount; k++) {
        const obb = dynObbs[nearDynObbIndices[k]];
        const h = sweepRayAgainstObb2D(
          input.x,
          input.z,
          candX,
          candZ,
          probeDist,
          probeR,
          input.radius,
          obb.x,
          obb.z,
          obb.halfX,
          obb.halfZ,
          obb.rotY,
        );
        if (h < bestHit) bestHit = h;
        if (bestHit <= 0) return 0;
      }
    }

    if (dynCircles) {
      for (let k = 0; k < nearDynCircleCount; k++) {
        const c = dynCircles[nearDynCircleIndices[k]];
        const h = sweepRayAgainstCircle2D(
          input.x,
          input.z,
          candX,
          candZ,
          probeDist,
          probeR,
          input.radius,
          c.x,
          c.z,
          c.radius,
        );
        if (h < bestHit) bestHit = h;
        if (bestHit <= 0) return 0;
      }
    }

    if (chars) {
      for (let k = 0; k < nearCharCount; k++) {
        const ch = chars[nearCharIndices[k]];
        const hNow = sweepRayAgainstCircle2D(
          input.x,
          input.z,
          candX,
          candZ,
          probeDist,
          probeR,
          input.radius,
          ch.x,
          ch.z,
          ch.radius,
        );
        if (hNow < bestHit) bestHit = hNow;
        if (bestHit <= 0) return 0;
        const cvx = ch.vx ?? 0;
        const cvz = ch.vz ?? 0;
        if (cvx !== 0 || cvz !== 0) {
          const hLead = sweepRayAgainstCircle2D(
            input.x,
            input.z,
            candX,
            candZ,
            probeDist,
            probeR,
            input.radius,
            ch.x + cvx * 0.22,
            ch.z + cvz * 0.22,
            ch.radius,
          );
          if (hLead < bestHit) bestHit = hLead;
          if (bestHit <= 0) return 0;
        }
      }
    }

    return bestHit;
  };

  // 1. Probe straight along desired direction
  const zeroClear = probeCandidate(input.dirX, input.dirZ, lookDist, zeroProbeR);
  if (zeroClear === Infinity) {
    const nextTimer = Math.max(0, prevAvoidTimer - dt);
    result.dirX = input.dirX;
    result.dirZ = input.dirZ;
    result.speedScale = 1.0;
    result.avoidSide = nextTimer > 0 ? prevAvoidSide : 0;
    result.avoidTimer = nextTimer;
    result.blocked = false;
    return result;
  }

  // 2. Evaluate symmetric tangent angles (±22°, ±45°, ±70°, ±95°, ±120°)
  let bestFallbackX = input.dirX;
  let bestFallbackZ = input.dirZ;
  let bestFallbackClear = zeroClear;
  let bestFallbackScore = zeroClear;
  let bestFallbackSide = prevAvoidSide;
  let bestFallbackTier = -1;
  let bestForwardClear = zeroClear;

  for (let tier = 0; tier < AVOID_TIER_COS.length; tier++) {
    // Only take backward-hemisphere detours (±95°, ±120°) if forward angles (<= ±70°) lack >= 0.75m room;
    // otherwise stepping into the best forward gap prevents ping-ponging away from narrow sidewalk passes.
    if (tier >= 3 && bestForwardClear >= 0.75 && bestFallbackTier >= 0) {
      break;
    }
    const cosA = AVOID_TIER_COS[tier];
    const sinA = AVOID_TIER_SIN[tier];

    // +tier (keep-right side +1)
    const plusX = input.dirX * cosA - input.dirZ * sinA;
    const plusZ = input.dirZ * cosA + input.dirX * sinA;
    const clearPlus = probeCandidate(plusX, plusZ, lookDist, angleProbeR);

    // -tier (left side -1)
    const minusX = input.dirX * cosA + input.dirZ * sinA;
    const minusZ = input.dirZ * cosA - input.dirX * sinA;
    const clearMinus = probeCandidate(minusX, minusZ, lookDist, angleProbeR);

    if (tier <= 2) {
      if (clearPlus > bestForwardClear) bestForwardClear = clearPlus;
      if (clearMinus > bestForwardClear) bestForwardClear = clearMinus;
    }

    const plusOpen = clearPlus === Infinity;
    const minusOpen = clearMinus === Infinity;

    if (plusOpen || minusOpen) {
      let pickPlus: boolean;
      if (plusOpen && minusOpen) {
        if (prevAvoidSide !== 0) {
          pickPlus = prevAvoidSide > 0;
        } else {
          // Tie-break symmetrically open detours by extended clearance (+0.75m), else keep-right
          const extPlus = probeCandidate(plusX, plusZ, lookDist + 0.75, angleProbeR);
          const extMinus = probeCandidate(minusX, minusZ, lookDist + 0.75, angleProbeR);
          if (
            extPlus !== extMinus &&
            (extPlus === Infinity || extMinus === Infinity || Math.abs(extPlus - extMinus) > 0.35)
          ) {
            pickPlus = extPlus > extMinus;
          } else {
            pickPlus = true;
          }
        }
      } else {
        pickPlus = plusOpen;
      }

      result.dirX = pickPlus ? plusX : minusX;
      result.dirZ = pickPlus ? plusZ : minusZ;
      result.speedScale = tier >= 3 ? 0.85 : 1.0;
      result.avoidSide = pickPlus ? 1 : -1;
      result.avoidTimer = 0.55;
      result.blocked = true;
      return result;
    }

    // Track best obstructed fallback while biasing forward-hemisphere progress and hysteresis
    // so an active detour never ping-pongs backward across a tight sidewalk.
    const hemisphereWeight = tier <= 2 ? 1.0 : 0.62;
    const scorePlus =
      clearPlus * hemisphereWeight + (prevAvoidSide > 0 ? 0.45 : 0) - tier * 0.04;
    const scoreMinus =
      clearMinus * hemisphereWeight + (prevAvoidSide < 0 ? 0.45 : 0) - tier * 0.04;

    if (prevAvoidSide < 0) {
      if (scoreMinus > bestFallbackScore) {
        bestFallbackScore = scoreMinus;
        bestFallbackX = minusX;
        bestFallbackZ = minusZ;
        bestFallbackClear = clearMinus;
        bestFallbackSide = -1;
        bestFallbackTier = tier;
      }
      if (scorePlus > bestFallbackScore) {
        bestFallbackScore = scorePlus;
        bestFallbackX = plusX;
        bestFallbackZ = plusZ;
        bestFallbackClear = clearPlus;
        bestFallbackSide = 1;
        bestFallbackTier = tier;
      }
    } else {
      if (scorePlus > bestFallbackScore) {
        bestFallbackScore = scorePlus;
        bestFallbackX = plusX;
        bestFallbackZ = plusZ;
        bestFallbackClear = clearPlus;
        bestFallbackSide = 1;
        bestFallbackTier = tier;
      }
      if (scoreMinus > bestFallbackScore) {
        bestFallbackScore = scoreMinus;
        bestFallbackX = minusX;
        bestFallbackZ = minusZ;
        bestFallbackClear = clearMinus;
        bestFallbackSide = -1;
        bestFallbackTier = tier;
      }
    }
  }

  // Emergency ±145° turn-out when tightly pinched inside a corner (< 0.45m ahead everywhere <= 120°)
  if (bestFallbackClear < 0.45) {
    const plusX = input.dirX * AVOID_EMERGENCY_COS - input.dirZ * AVOID_EMERGENCY_SIN;
    const plusZ = input.dirZ * AVOID_EMERGENCY_COS + input.dirX * AVOID_EMERGENCY_SIN;
    const clearPlus = probeCandidate(plusX, plusZ, lookDist, angleProbeR);
    const minusX = input.dirX * AVOID_EMERGENCY_COS + input.dirZ * AVOID_EMERGENCY_SIN;
    const minusZ = input.dirZ * AVOID_EMERGENCY_COS - input.dirX * AVOID_EMERGENCY_SIN;
    const clearMinus = probeCandidate(minusX, minusZ, lookDist, angleProbeR);
    if (clearPlus > bestFallbackClear + 0.2 || clearMinus > bestFallbackClear + 0.2) {
      const pickPlus =
        prevAvoidSide !== 0 &&
        Math.abs(clearPlus - clearMinus) <= 0.2
          ? prevAvoidSide > 0
          : clearPlus >= clearMinus;
      bestFallbackX = pickPlus ? plusX : minusX;
      bestFallbackZ = pickPlus ? plusZ : minusZ;
      bestFallbackClear = pickPlus ? clearPlus : clearMinus;
      bestFallbackSide = pickPlus ? 1 : -1;
      bestFallbackTier = 5;
    }
  }

  result.dirX = bestFallbackX;
  result.dirZ = bestFallbackZ;
  if (bestFallbackClear === Infinity) {
    result.speedScale = 0.78;
  } else if (bestFallbackClear < 0.30) {
    result.speedScale = 0;
  } else {
    result.speedScale = Math.max(0.32, Math.min(0.82, (bestFallbackClear - 0.18) / 0.85));
  }
  result.avoidSide = bestFallbackSide !== 0 ? bestFallbackSide : prevAvoidSide;
  result.avoidTimer = bestFallbackTier >= 0 ? 0.55 : Math.max(0, prevAvoidTimer - dt);
  result.blocked = true;
  return result;
}
