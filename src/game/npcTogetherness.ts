import {
  findPathAStar,
  type AStarNavGrid,
  type CityAmbientNpcActivity,
  type CityAmbientNpcWaypoint,
} from './buddiesBlitzRules';
import {
  canPairPose,
  canRideTogether,
  canWalkTogether,
  npcIdToCitizenId,
  recordNpcSharedActivity,
  resolveNpcId,
  type ClosenessMutationResult,
  type NpcClosenessStore,
  type NpcId,
} from './npcClosenessEngine';
import {
  getNpcPersona,
  type NpcScheduleSlot,
  type NpcTimeSlotWindow,
} from './npcPersonaRegistry';
import { ensureAllNpcPersonasRegistered } from './personas/index';
import type { UrbanScooterKind } from './buddiesUrbanScooterRules';
import type { CitizenId } from './buddiesCitizenRoles';

/**
 * NPC Togetherness Mechanics + Deterministic Schedule & Emotion Clip Hooks (Foundation F3)
 * ========================================================================================
 * - Walk-together (gated by F1 `canWalkTogether`)
 * - Pair poses using verified TRUE paired clips (`*_initiate.glb` + `*_receive.glb`, gated by F1 `canPairPose`)
 * - Ride-together as passenger on the 2-up `electric_scooter_bike` pillion (gated by F1 `canRideTogether`)
 * - Verified City Anchor Registry & deterministic persona schedule lookup (LLM never decides movement)
 * - Verified emotion reaction clip resolution with expressive-idle fallback
 *
 * IMPORTANT: No closeness numbers, bars, hearts, or tier labels are ever exposed in UI copy.
 */

// ============================================================================
// 1. VERIFIED CITY ANCHOR REGISTRY & DETERMINISTIC SCHEDULE LOOKUP
// ============================================================================

export interface CityLifeAnchor {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly activity: CityAmbientNpcActivity;
  readonly seatLiftY?: number;
  readonly district: string;
}

/**
 * Verified, collision-audited city anchor coordinates matching `CITY_AMBIENT_NPC_PRESETS`
 * and `CITIZEN_PROFILES`. Persona packs (`src/game/personas/<npc>.ts`) reference these IDs
 * in their deterministic `schedule` arrays.
 */
export const CITY_LIFE_ANCHORS: Readonly<Record<string, CityLifeAnchor>> = {
  glasshouse_cafe_counter: {
    id: 'glasshouse_cafe_counter',
    label: 'Glasshouse Cafe Counter',
    x: -90.55,
    z: 20.8,
    yaw: -Math.PI / 2,
    activity: 'cafe_hangout',
    district: 'glasshouse_cafe',
  },
  glasshouse_cafe_terrace: {
    id: 'glasshouse_cafe_terrace',
    label: 'Glasshouse Cafe Terrace',
    x: -87.45,
    z: 16.2,
    yaw: -Math.PI * 0.45,
    activity: 'cafe_hangout',
    district: 'glasshouse_cafe',
  },
  glasshouse_cafe_patio_north: {
    id: 'glasshouse_cafe_patio_north',
    label: 'Glasshouse Patio North',
    x: -86.55,
    z: 13.3,
    yaw: 0.0,
    activity: 'cafe_hangout',
    district: 'glasshouse_cafe',
  },
  glasshouse_cafe_patio_mid: {
    id: 'glasshouse_cafe_patio_mid',
    label: 'Glasshouse Patio Center',
    x: -86.55,
    z: 15.2,
    yaw: 0.0,
    activity: 'cafe_hangout',
    district: 'glasshouse_cafe',
  },
  glasshouse_cafe_patio_south: {
    id: 'glasshouse_cafe_patio_south',
    label: 'Glasshouse Patio South',
    x: -86.55,
    z: 19.1,
    yaw: 0.0,
    activity: 'cafe_hangout',
    district: 'glasshouse_cafe',
  },
  fashion_boutique_front: {
    id: 'fashion_boutique_front',
    label: 'Fashion Boutique',
    x: -97.05,
    z: 4.9,
    yaw: Math.PI,
    activity: 'sightseeing',
    district: 'central_plaza',
  },
  fashion_boutique_window: {
    id: 'fashion_boutique_window',
    label: 'Fashion Boutique Window',
    x: -101.25,
    z: 5.3,
    yaw: Math.PI,
    activity: 'sightseeing',
    district: 'central_plaza',
  },
  interior_studio_front: {
    id: 'interior_studio_front',
    label: 'Interior Studio',
    x: -95.65,
    z: -4.9,
    yaw: Math.PI,
    activity: 'sightseeing',
    district: 'central_plaza',
  },
  scooter_showroom_front: {
    id: 'scooter_showroom_front',
    label: 'Urban Scooter Showroom',
    x: -100.25,
    z: -14.8,
    yaw: Math.PI,
    activity: 'sightseeing',
    district: 'central_plaza',
  },
  scooter_display_lane: {
    id: 'scooter_display_lane',
    label: 'Scooter Display Lane',
    x: -93.85,
    z: -11.0,
    yaw: Math.PI,
    activity: 'sightseeing',
    district: 'central_plaza',
  },
  plaza_bench_north: {
    id: 'plaza_bench_north',
    label: 'Central Plaza Bench (North)',
    x: -81.23,
    z: -16.05,
    yaw: Math.PI,
    activity: 'sit_relax',
    seatLiftY: 0.02,
    district: 'central_plaza',
  },
  plaza_bench_mid: {
    id: 'plaza_bench_mid',
    label: 'Central Plaza Bench (Mid)',
    x: -81.23,
    z: -17.65,
    yaw: Math.PI,
    activity: 'sit_relax',
    seatLiftY: 0.02,
    district: 'central_plaza',
  },
  plaza_bench_south: {
    id: 'plaza_bench_south',
    label: 'Central Plaza Bench (South)',
    x: -81.23,
    z: -24.85,
    yaw: Math.PI,
    activity: 'sit_relax',
    seatLiftY: 0.02,
    district: 'central_plaza',
  },
  clock_tower_bench: {
    id: 'clock_tower_bench',
    label: 'Clock Tower Bench',
    x: -86.24,
    z: -30.41,
    yaw: 0.0,
    activity: 'sit_relax',
    seatLiftY: -0.05,
    district: 'central_plaza',
  },
  oasis_bench_north: {
    id: 'oasis_bench_north',
    label: 'Oasis Lake Bench (North)',
    x: -44.2,
    z: -2.0,
    yaw: 0.0,
    activity: 'sit_relax',
    seatLiftY: 0.0,
    district: 'nw_fishing_lake',
  },
  oasis_bench_south: {
    id: 'oasis_bench_south',
    label: 'Oasis Lake Bench (South)',
    x: -44.2,
    z: 2.0,
    yaw: 0.0,
    activity: 'sit_relax',
    seatLiftY: 0.0,
    district: 'nw_fishing_lake',
  },
  nw_lake_shore: {
    id: 'nw_lake_shore',
    label: 'NW Oasis Lake Shore',
    x: -42.5,
    z: -8.5,
    yaw: 0.0,
    activity: 'fishing',
    district: 'nw_fishing_lake',
  },
  nw_lake_north_bank: {
    id: 'nw_lake_north_bank',
    label: 'NW Lake North Bank',
    x: -28.0,
    z: -16.0,
    yaw: -Math.PI / 2,
    activity: 'fishing',
    district: 'nw_fishing_lake',
  },
  tennis_courtside: {
    id: 'tennis_courtside',
    label: 'Tennis Club Courtside',
    x: -80.4,
    z: 50.6,
    yaw: Math.PI,
    activity: 'sightseeing',
    district: 'central_plaza',
  },
  tennis_promenade: {
    id: 'tennis_promenade',
    label: 'Tennis Club Promenade',
    x: -77.2,
    z: 50.6,
    yaw: Math.PI,
    activity: 'sightseeing',
    district: 'central_plaza',
  },
  tennis_south_gate: {
    id: 'tennis_south_gate',
    label: 'Tennis Club South Gate',
    x: -88.8,
    z: 64.2,
    yaw: Math.PI / 2,
    activity: 'sightseeing',
    district: 'central_plaza',
  },
  grand_casino_foyer: {
    id: 'grand_casino_foyer',
    label: 'Grand Casino Foyer',
    x: -77.2,
    z: -70.6,
    yaw: Math.PI,
    activity: 'sightseeing',
    district: 'central_plaza',
  },
  grand_casino_valet: {
    id: 'grand_casino_valet',
    label: 'Grand Casino Valet Walk',
    x: -77.2,
    z: -60.5,
    yaw: Math.PI * 0.75,
    activity: 'sightseeing',
    district: 'central_plaza',
  },
  casino_bench_north: {
    id: 'casino_bench_north',
    label: 'Casino Promenade Bench (North)',
    x: -78.59,
    z: -56.6,
    yaw: 0.0,
    activity: 'sit_relax',
    seatLiftY: 0.12,
    district: 'central_plaza',
  },
  casino_bench_south: {
    id: 'casino_bench_south',
    label: 'Casino Promenade Bench (South)',
    x: -78.59,
    z: -84.6,
    yaw: 0.0,
    activity: 'sit_relax',
    seatLiftY: 0.12,
    district: 'central_plaza',
  },
  hana_cafe_station: {
    id: 'hana_cafe_station',
    label: 'Hana Glasshouse Cafe',
    x: -91.5,
    z: 21.0,
    yaw: 0.0,
    activity: 'cafe_hangout',
    district: 'glasshouse_cafe',
  },
  kai_fish_market_pier: {
    id: 'kai_fish_market_pier',
    label: 'Kai Fish Market Pier',
    x: 84.85,
    z: 65.65,
    yaw: -Math.PI / 2,
    activity: 'fishing',
    district: 'beachfront_pier',
  },
  beach_club_promenade_north: {
    id: 'beach_club_promenade_north',
    label: 'Beach Club Palm Promenade (North)',
    x: 84.5,
    z: -64.0,
    yaw: Math.PI / 2,
    activity: 'sightseeing',
    district: 'beachfront_pier',
  },
  beach_club_promenade_mid: {
    id: 'beach_club_promenade_mid',
    label: 'Beach Club Palm Promenade (Center)',
    x: 84.5,
    z: -14.0,
    yaw: Math.PI / 2,
    activity: 'sightseeing',
    district: 'beachfront_pier',
  },
  beach_club_lounge_walk: {
    id: 'beach_club_lounge_walk',
    label: 'Beach Club Lounge Walk',
    x: 86.0,
    z: 6.0,
    yaw: Math.PI / 2,
    activity: 'walk_patrol',
    district: 'beachfront_pier',
  },
  beach_club_promenade_south: {
    id: 'beach_club_promenade_south',
    label: 'Beach Club Palm Promenade (South)',
    x: 84.5,
    z: 22.0,
    yaw: Math.PI / 2,
    activity: 'sightseeing',
    district: 'beachfront_pier',
  },
  central_beauty_salon_front: {
    id: 'central_beauty_salon_front',
    label: 'Central Plaza Beauty Salon',
    x: 29.5,
    z: 7.4,
    yaw: 0.0,
    activity: 'sightseeing',
    district: 'central_plaza',
  },
  central_boutique_front: {
    id: 'central_boutique_front',
    label: 'Central Plaza Boutique Tower',
    x: 20.8,
    z: 0.0,
    yaw: Math.PI / 2,
    activity: 'sightseeing',
    district: 'central_plaza',
  },
  central_cozy_cafe_front: {
    id: 'central_cozy_cafe_front',
    label: 'Central Plaza Cozy Bites',
    x: 37.0,
    z: -4.5,
    yaw: -Math.PI / 2,
    activity: 'cafe_hangout',
    district: 'central_plaza',
  },
  central_plaza_north_walk: {
    id: 'central_plaza_north_walk',
    label: 'Central Plaza Tram Promenade',
    x: 20.5,
    z: -10.5,
    yaw: 0.0,
    activity: 'walk_patrol',
    district: 'central_plaza',
  },
  central_plaza_west_gate: {
    id: 'central_plaza_west_gate',
    label: 'Central Plaza West Gate',
    x: 1.5,
    z: -7.5,
    yaw: Math.PI / 2,
    activity: 'walk_patrol',
    district: 'central_plaza',
  },
  central_plaza_east_walk: {
    id: 'central_plaza_east_walk',
    label: 'Central Plaza East Promenade',
    x: 52.8,
    z: -5.5,
    yaw: -Math.PI / 2,
    activity: 'walk_patrol',
    district: 'central_plaza',
  },
} as const;

export const CITY_LIFE_ANCHOR_IDS: readonly string[] = Object.keys(CITY_LIFE_ANCHORS);

export function getCityLifeAnchor(anchorId: string | null | undefined): CityLifeAnchor | null {
  if (!anchorId || typeof anchorId !== 'string') return null;
  const key = anchorId.trim().toLowerCase();
  return CITY_LIFE_ANCHORS[key] ?? null;
}

export function normalizeWorldClockHour(hour: number): number {
  if (!Number.isFinite(hour)) return 12;
  return ((hour % 24) + 24) % 24;
}

/**
 * Deterministic mapping of 24h world clock to `NpcTimeSlotWindow`:
 * - morning:   06:00 .. 12:00
 * - afternoon: 12:00 .. 17:00
 * - evening:   17:00 .. 21:00
 * - night:     21:00 .. 06:00
 */
export function getTimeSlotWindowForHour(hour: number): NpcTimeSlotWindow {
  const h = normalizeWorldClockHour(hour);
  if (h >= 6 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

/**
 * Evaluates whether a world-clock hour falls inside an `NpcScheduleSlot`.
 * Uses explicit `startHour`/`endHour` when provided (handling midnight wrap cleanly),
 * otherwise falls back to the slot's `window`.
 */
export function isHourInScheduleSlot(hour: number, slot: NpcScheduleSlot): boolean {
  const h = normalizeWorldClockHour(hour);
  if (
    typeof slot.startHour === 'number' &&
    Number.isFinite(slot.startHour) &&
    typeof slot.endHour === 'number' &&
    Number.isFinite(slot.endHour)
  ) {
    const start = normalizeWorldClockHour(slot.startHour);
    const end = slot.endHour === 24 ? 24 : normalizeWorldClockHour(slot.endHour);
    if (start === end) return true;
    if (start < end) {
      return h >= start && h < end;
    }
    // Midnight wrap (e.g. startHour: 21, endHour: 6)
    return h >= start || h < end;
  }
  return getTimeSlotWindowForHour(h) === slot.window;
}

export interface ResolvedNpcScheduleTarget {
  npcId: NpcId;
  slot: NpcScheduleSlot;
  anchor: CityLifeAnchor;
  waypoint: CityAmbientNpcWaypoint;
}

/**
 * Deterministic persona schedule lookup for the city-life NPC loop.
 * - Reads `getNpcPersona(npcId)?.schedule`.
 * - Returns `null` when the persona has no schedule entries or no matching anchor,
 *   signaling the arena to keep the existing default `CITY_AMBIENT_NPC_PRESETS` loop.
 * - Strictly rule-based and deterministic (LLM never decides NPC movement).
 */
export function resolveNpcScheduledWaypoint(
  rawNpcId: string,
  timeOfDayHours: number,
  explicitSchedule?: readonly NpcScheduleSlot[],
): ResolvedNpcScheduleTarget | null {
  const npcId = resolveNpcId(rawNpcId);
  if (!npcId) return null;

  let schedule = explicitSchedule;
  if (!schedule) {
    ensureAllNpcPersonasRegistered();
    schedule = getNpcPersona(npcId)?.schedule;
  }
  if (!schedule || schedule.length === 0) return null;

  const matchedSlot = schedule.find((slot) => isHourInScheduleSlot(timeOfDayHours, slot));
  if (!matchedSlot) return null;

  const anchor =
    getCityLifeAnchor(matchedSlot.anchorId) ?? getCityLifeAnchor(matchedSlot.waypointId);
  if (!anchor) return null;

  return {
    npcId,
    slot: matchedSlot,
    anchor,
    waypoint: {
      x: anchor.x,
      z: anchor.z,
      yaw: anchor.yaw,
      activity: anchor.activity,
      moveMode: 'walk',
      label: matchedSlot.activityLabel.trim() || anchor.label,
      durationSec: 22.0,
      seatLiftY: anchor.seatLiftY,
    },
  };
}

/**
 * Builds a multi-waypoint patrol loop for a named NPC starting from its active
 * scheduled anchor so the NPC actively roams its district instead of freezing
 * on a single bench for hours.
 */
export function resolveNpcScheduledPatrolWaypoints(
  rawNpcId: string,
  timeOfDayHours: number,
): CityAmbientNpcWaypoint[] | null {
  // Ambient Raka roams Central Urban Plaza (map center) per WS7 pairing revision
  if (rawNpcId === 'city_plaza_raka') {
    const rakaAnchorIds = [
      'central_plaza_west_gate',
      'central_boutique_front',
      'central_plaza_north_walk',
      'central_cozy_cafe_front',
      'central_plaza_east_walk',
    ] as const;
    return rakaAnchorIds
      .map((id) => getCityLifeAnchor(id))
      .filter((a): a is CityLifeAnchor => Boolean(a))
      .map((anchor) => ({
        x: anchor.x,
        z: anchor.z,
        yaw: anchor.yaw,
        activity: anchor.activity,
        moveMode: 'walk' as const,
        label: anchor.label,
        durationSec: 15.0,
        seatLiftY: anchor.seatLiftY,
      }));
  }
  const npcId = resolveNpcId(rawNpcId);
  if (!npcId) return null;
  ensureAllNpcPersonasRegistered();
  const schedule = getNpcPersona(npcId)?.schedule;
  if (!schedule || schedule.length === 0) return null;

  const activeIdx = schedule.findIndex((slot) => isHourInScheduleSlot(timeOfDayHours, slot));
  const startIdx = activeIdx >= 0 ? activeIdx : 0;
  const ordered = [...schedule.slice(startIdx), ...schedule.slice(0, startIdx)];

  const seenAnchors = new Set<string>();
  const waypoints: CityAmbientNpcWaypoint[] = [];
  for (const slot of ordered) {
    const anchor = getCityLifeAnchor(slot.anchorId) ?? getCityLifeAnchor(slot.waypointId);
    if (!anchor || seenAnchors.has(anchor.id)) continue;
    seenAnchors.add(anchor.id);
    waypoints.push({
      x: anchor.x,
      z: anchor.z,
      yaw: anchor.yaw,
      activity: anchor.activity,
      moveMode: 'walk',
      label: slot.activityLabel.trim() || anchor.label,
      durationSec: anchor.activity === 'sit_relax' ? 22.0 : 16.0,
      seatLiftY: anchor.seatLiftY,
    });
  }
  return waypoints.length > 0 ? waypoints : null;
}

// ============================================================================
// 2. CURATED TRUE PAIRED POSES (FROM public/assets/animations/paired/)
// ============================================================================

export interface CuratedNpcPairPose {
  readonly id: string;
  readonly label: string;
  readonly initiateGlbUrl: string;
  readonly receiveGlbUrl: string;
  /** Always true: every entry uses a real paired initiate+receive GLB duo on PelvisRoot. */
  readonly isTruePairedClip: true;
}

export const CURATED_NPC_PAIR_POSES: readonly CuratedNpcPairPose[] = [
  {
    id: 'anim_paired_44f22885_interpose_selfies05',
    label: 'Duo Selfie',
    initiateGlbUrl: '/assets/animations/paired/44F22885__interpose_selfies05_initiate.glb',
    receiveGlbUrl: '/assets/animations/paired/44F22885__interpose_selfies05_receive.glb',
    isTruePairedClip: true,
  },
  {
    id: 'anim_paired_4697a186_interpose_best_mates09',
    label: 'Best Mates',
    initiateGlbUrl: '/assets/animations/paired/4697A186__interpose_best_mates09_initiate.glb',
    receiveGlbUrl: '/assets/animations/paired/4697A186__interpose_best_mates09_receive.glb',
    isTruePairedClip: true,
  },
  {
    id: 'anim_paired_6b155d4a_interpose_sider_hug01',
    label: 'Side Hug',
    initiateGlbUrl: '/assets/animations/paired/6B155D4A__interpose_sider_hug01_initiate.glb',
    receiveGlbUrl: '/assets/animations/paired/6B155D4A__interpose_sider_hug01_receive.glb',
    isTruePairedClip: true,
  },
  {
    id: 'anim_paired_2f102a8e_interpose_editorial_fashion05',
    label: 'Photo Shoot',
    initiateGlbUrl: '/assets/animations/paired/2F102A8E__interpose_editorial_fashion05_initiate.glb',
    receiveGlbUrl: '/assets/animations/paired/2F102A8E__interpose_editorial_fashion05_receive.glb',
    isTruePairedClip: true,
  },
  {
    id: 'anim_paired_fc456930_interpose_girlygreet01',
    label: 'Friendly Wave',
    initiateGlbUrl: '/assets/animations/paired/FC456930__interpose_girlygreet01_initiate.glb',
    receiveGlbUrl: '/assets/animations/paired/FC456930__interpose_girlygreet01_receive.glb',
    isTruePairedClip: true,
  },
] as const;

export function getCuratedNpcPairPose(poseId?: string | null): CuratedNpcPairPose {
  if (poseId) {
    const found = CURATED_NPC_PAIR_POSES.find((p) => p.id === poseId);
    if (found) return found;
  }
  return CURATED_NPC_PAIR_POSES[0];
}

// ============================================================================
// 4. TOGETHERNESS SESSIONS & GATING (WALK, PAIR POSE, RIDE TOGETHER)
// ============================================================================

export interface SavedNpcAnchorTransform {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface NpcWalkTogetherSession {
  npcId: NpcId;
  citizenId: CitizenId;
  startedAtMs: number;
  /** Optional saved world anchor (used for stationary merchants Hana/Kai so they return cleanly). */
  savedAnchor?: SavedNpcAnchorTransform;
}

export interface NpcPairPoseSession {
  npcId: NpcId;
  citizenId: CitizenId;
  pose: CuratedNpcPairPose;
  startedAtMs: number;
}

export interface NpcRideTogetherSession {
  npcId: NpcId;
  citizenId: CitizenId;
  scooterKind: 'electric_scooter_bike';
  startedAtMs: number;
  savedAnchor?: SavedNpcAnchorTransform;
}

export interface TogethernessActionResult<TSession> {
  allowed: boolean;
  reason?: 'unknown_npc' | 'not_unlocked' | 'requires_electric_scooter_bike';
  message: string;
  session: TSession | null;
  closenessResult: ClosenessMutationResult | null;
}

export function startNpcWalkTogether(
  store: NpcClosenessStore,
  rawNpcId: string,
  options: {
    nowMs?: number;
    dateKey?: string;
    savedAnchor?: SavedNpcAnchorTransform;
  } = {},
): TogethernessActionResult<NpcWalkTogetherSession> {
  const npcId = resolveNpcId(rawNpcId);
  if (!npcId) {
    return {
      allowed: false,
      reason: 'unknown_npc',
      message: 'This person cannot walk with you right now.',
      session: null,
      closenessResult: null,
    };
  }
  const nowMs = options.nowMs ?? Date.now();
  if (!canWalkTogether(store, npcId, nowMs)) {
    return {
      allowed: false,
      reason: 'not_unlocked',
      message: 'Spend a little more time together first.',
      session: null,
      closenessResult: null,
    };
  }
  const closenessResult = recordNpcSharedActivity(store, npcId, 'walk_together', {
    nowMs,
    dateKey: options.dateKey,
  });
  return {
    allowed: true,
    message: 'Walking together! Lead the way.',
    session: {
      npcId,
      citizenId: npcIdToCitizenId(npcId),
      startedAtMs: nowMs,
      savedAnchor: options.savedAnchor,
    },
    closenessResult,
  };
}

export function startNpcPairPose(
  store: NpcClosenessStore,
  rawNpcId: string,
  options: {
    poseId?: string;
    nowMs?: number;
    dateKey?: string;
  } = {},
): TogethernessActionResult<NpcPairPoseSession> {
  const npcId = resolveNpcId(rawNpcId);
  if (!npcId) {
    return {
      allowed: false,
      reason: 'unknown_npc',
      message: 'This person cannot take a pair photo right now.',
      session: null,
      closenessResult: null,
    };
  }
  const nowMs = options.nowMs ?? Date.now();
  if (!canPairPose(store, npcId, nowMs)) {
    return {
      allowed: false,
      reason: 'not_unlocked',
      message: 'Get to know each other a bit better first.',
      session: null,
      closenessResult: null,
    };
  }
  const pose = getCuratedNpcPairPose(options.poseId);
  const closenessResult = recordNpcSharedActivity(store, npcId, 'pair_pose', {
    nowMs,
    dateKey: options.dateKey,
  });
  return {
    allowed: true,
    message: `Ready for a ${pose.label} photo!`,
    session: {
      npcId,
      citizenId: npcIdToCitizenId(npcId),
      pose,
      startedAtMs: nowMs,
    },
    closenessResult,
  };
}

export function startNpcRideTogether(
  store: NpcClosenessStore,
  rawNpcId: string,
  options: {
    scooterKind?: UrbanScooterKind | null;
    nowMs?: number;
    dateKey?: string;
    savedAnchor?: SavedNpcAnchorTransform;
  } = {},
): TogethernessActionResult<NpcRideTogetherSession> {
  const npcId = resolveNpcId(rawNpcId);
  if (!npcId) {
    return {
      allowed: false,
      reason: 'unknown_npc',
      message: 'This person cannot ride with you right now.',
      session: null,
      closenessResult: null,
    };
  }
  const nowMs = options.nowMs ?? Date.now();
  if (!canRideTogether(store, npcId, nowMs)) {
    return {
      allowed: false,
      reason: 'not_unlocked',
      message: 'Spend more time together before taking a scooter ride.',
      session: null,
      closenessResult: null,
    };
  }
  if (options.scooterKind && options.scooterKind !== 'electric_scooter_bike') {
    return {
      allowed: false,
      reason: 'requires_electric_scooter_bike',
      message: 'Hop on your electric scooter bike to ride together.',
      session: null,
      closenessResult: null,
    };
  }
  const closenessResult = recordNpcSharedActivity(store, npcId, 'ride_together', {
    nowMs,
    dateKey: options.dateKey,
  });
  return {
    allowed: true,
    message: 'Hopped on behind you — let us cruise!',
    session: {
      npcId,
      citizenId: npcIdToCitizenId(npcId),
      scooterKind: 'electric_scooter_bike',
      startedAtMs: nowMs,
      savedAnchor: options.savedAnchor,
    },
    closenessResult,
  };
}

// ============================================================================
// 5. WALK-TOGETHER WAYPOINT / FOLLOW-STEERING STEPPER
// ============================================================================

export interface WalkTogetherStepInput {
  npcX: number;
  npcZ: number;
  npcYaw: number;
  wasMoving: boolean;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  playerSpeedMps: number;
  dt: number;
  navGrid?: AStarNavGrid | null;
  navPath?: Array<{ x: number; z: number }>;
  navWaypointIndex?: number;
  replanTimerSec?: number;
  /** Desired comfortable follow gap in meters (default 1.95). */
  followDistanceM?: number;
  /** Auto-end walk if player teleports or moves beyond this distance (default 48m). */
  maxTetherDistanceM?: number;
}

export interface WalkTogetherStepResult {
  x: number;
  z: number;
  yaw: number;
  speedMps: number;
  isMoving: boolean;
  shouldEndWalk: boolean;
  navPath: Array<{ x: number; z: number }>;
  navWaypointIndex: number;
  replanTimerSec: number;
}

function normalizeAngleRad(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Pure deterministic follow-stepper for Walk-Together mode:
 * - Follows the player along the existing A* `navGrid` at natural walking pace (1.65..2.6 m/s)
 * - Smoothly pauses with hysteresis when the player stops within comfortable social distance
 * - Faces toward the player while paused
 * - Auto-ends if the player moves beyond `maxTetherDistanceM` (e.g. fast-travel)
 */
export function stepNpcWalkTogether(input: WalkTogetherStepInput): WalkTogetherStepResult {
  const dt = Math.max(0, Math.min(0.25, Number.isFinite(input.dt) ? input.dt : 0));
  const followDist = input.followDistanceM ?? 1.95;
  const maxTether = input.maxTetherDistanceM ?? 48.0;
  const stopRadius = Math.max(1.2, followDist - 0.15);
  const resumeRadius = followDist + 0.55;

  const dxToPlayer = input.playerX - input.npcX;
  const dzToPlayer = input.playerZ - input.npcZ;
  const distToPlayer = Math.hypot(dxToPlayer, dzToPlayer);

  if (distToPlayer > maxTether) {
    return {
      x: input.npcX,
      z: input.npcZ,
      yaw: input.npcYaw,
      speedMps: 0,
      isMoving: false,
      shouldEndWalk: true,
      navPath: [],
      navWaypointIndex: 0,
      replanTimerSec: 0,
    };
  }

  const desiredPause = input.wasMoving
    ? distToPlayer <= stopRadius
    : distToPlayer <= resumeRadius;

  if (desiredPause) {
    const facePlayerYaw =
      distToPlayer > 0.05 ? Math.atan2(-dzToPlayer, dxToPlayer) : input.npcYaw;
    const dYaw = normalizeAngleRad(facePlayerYaw - input.npcYaw);
    const maxTurn = 6.5 * dt;
    const nextYaw = input.npcYaw + Math.max(-maxTurn, Math.min(maxTurn, dYaw));
    return {
      x: input.npcX,
      z: input.npcZ,
      yaw: nextYaw,
      speedMps: 0,
      isMoving: false,
      shouldEndWalk: false,
      navPath: [],
      navWaypointIndex: 0,
      replanTimerSec: 0,
    };
  }

  // Target a spot slightly behind-side of the player so the NPC walks alongside cleanly
  const backX = -Math.cos(input.playerYaw);
  const backZ = Math.sin(input.playerYaw);
  const targetX = input.playerX + backX * (followDist * 0.65);
  const targetZ = input.playerZ + backZ * (followDist * 0.65);

  let navPath = input.navPath ?? [];
  let navWaypointIndex = input.navWaypointIndex ?? 0;
  let replanTimerSec = Math.max(0, (input.replanTimerSec ?? 0) - dt);

  if (input.navGrid && (navPath.length === 0 || replanTimerSec <= 0)) {
    const planned = findPathAStar(
      input.navGrid,
      input.npcX,
      input.npcZ,
      targetX,
      targetZ,
    );
    if (planned && planned.waypoints.length > 0) {
      navPath = planned.waypoints;
      navWaypointIndex = 0;
    } else {
      navPath = [{ x: targetX, z: targetZ }];
      navWaypointIndex = 0;
    }
    replanTimerSec = 0.65;
  }

  let steerX = targetX;
  let steerZ = targetZ;
  if (navPath.length > 0) {
    while (navWaypointIndex < navPath.length - 1) {
      const wp = navPath[navWaypointIndex];
      if (Math.hypot(wp.x - input.npcX, wp.z - input.npcZ) <= 0.95) {
        navWaypointIndex++;
      } else {
        break;
      }
    }
    const activeWp = navPath[Math.min(navWaypointIndex, navPath.length - 1)];
    if (activeWp) {
      steerX = activeWp.x;
      steerZ = activeWp.z;
    }
  }

  const sdx = steerX - input.npcX;
  const sdz = steerZ - input.npcZ;
  const sDist = Math.hypot(sdx, sdz);
  if (sDist < 0.05) {
    return {
      x: input.npcX,
      z: input.npcZ,
      yaw: input.npcYaw,
      speedMps: 0,
      isMoving: false,
      shouldEndWalk: false,
      navPath,
      navWaypointIndex,
      replanTimerSec,
    };
  }

  // WS30 Pace matching: match the player's actual locomotion (walk at player walk speed,
  // jog/run up to player run speed + catch-up boost when falling behind so she never loses pace).
  const catchUpBonus = Math.max(0, Math.min(3.4, (distToPlayer - 2.8) * 0.7));
  const playerMatchedBase = Math.max(2.15, input.playerSpeedMps * 1.04);
  const maxFollowSpeed = Math.max(7.8, input.playerSpeedMps + 2.0);
  const targetWalkSpeed = Math.max(
    1.8,
    Math.min(maxFollowSpeed, playerMatchedBase + catchUpBonus),
  );
  const stepDist = Math.min(targetWalkSpeed * dt, Math.max(0, distToPlayer - stopRadius * 0.85));
  const dirX = sdx / sDist;
  const dirZ = sdz / sDist;
  const nextX = input.npcX + dirX * stepDist;
  const nextZ = input.npcZ + dirZ * stepDist;

  const desiredYaw = Math.atan2(-dirZ, dirX);
  const dYaw = normalizeAngleRad(desiredYaw - input.npcYaw);
  const maxTurn = 7.5 * dt;
  const nextYaw = input.npcYaw + Math.max(-maxTurn, Math.min(maxTurn, dYaw));

  return {
    x: nextX,
    z: nextZ,
    yaw: nextYaw,
    speedMps: dt > 1e-4 ? stepDist / dt : targetWalkSpeed,
    isMoving: stepDist > 1e-4,
    shouldEndWalk: false,
    navPath,
    navWaypointIndex,
    replanTimerSec,
  };
}

// ============================================================================
// 6. RIDE-TOGETHER PASSENGER PILLION TRANSFORM (2-UP ELECTRIC SCOOTER BIKE)
// ============================================================================

/**
 * Calibrated passenger pillion placement for `electric_scooter_bike` (2-up contoured saddle:
 * rider bucket at local z=-0.44 / y=0.57; passenger pillion behind at local z=-0.98 / y=0.655).
 * Uses the verified `scooter_bike_idle.001` seated clip (fallback: `sitOverrideClip` / `sitting.001`).
 */
export const ELECTRIC_SCOOTER_PASSENGER_SPEC = {
  pillionBackOffsetM: -0.98,
  pillionLiftY: 0.655,
  preferredClipNames: ['scooter_bike_idle.001', 'sitting.001'] as const,
} as const;

export interface ScooterPassengerTransformInput {
  driverX: number;
  driverZ: number;
  driverYaw: number;
  groundY: number;
  slopePitchX: number;
  leanRollZ: number;
}

export interface ScooterPassengerTransformResult {
  worldX: number;
  worldY: number;
  worldZ: number;
  bodyLiftY: number;
  yaw: number;
  pitchX: number;
  rollZ: number;
}

/**
 * Computes exact world-space pillion seat position and lean/pitch orientation
 * for an NPC passenger riding behind the player on `electric_scooter_bike`.
 */
export function computeScooterPassengerTransform(
  input: ScooterPassengerTransformInput,
): ScooterPassengerTransformResult {
  const fwdX = Math.cos(input.driverYaw);
  const fwdZ = -Math.sin(input.driverYaw);
  const backOffset = ELECTRIC_SCOOTER_PASSENGER_SPEC.pillionBackOffsetM;
  return {
    worldX: input.driverX + fwdX * backOffset,
    worldY: input.groundY,
    worldZ: input.driverZ + fwdZ * backOffset,
    bodyLiftY: ELECTRIC_SCOOTER_PASSENGER_SPEC.pillionLiftY,
    yaw: input.driverYaw,
    pitchX: input.slopePitchX,
    rollZ: input.leanRollZ,
  };
}

// ============================================================================
// 7. DOM EVENT BUS FOR ARENA <-> APP / MODAL COORDINATION
// ============================================================================

export const NPC_TOGETHERNESS_COMMAND_EVENT = 'npc-togetherness-command';
export const NPC_TOGETHERNESS_STATE_EVENT = 'npc-togetherness-state';

export type NpcTogethernessCommand =
  | { type: 'start_walk'; npcId: NpcId }
  | { type: 'end_walk' }
  | { type: 'start_pair_pose'; npcId: NpcId; poseId?: string }
  | { type: 'stop_pair_pose' }
  | { type: 'start_ride'; npcId: NpcId }
  | { type: 'end_ride' }
  | { type: 'start_sit'; npcId: NpcId; preferNearPlayer?: boolean }
  | { type: 'end_sit' };

export interface NpcTogethernessStateSnapshot {
  walkingNpcId: NpcId | null;
  pairPoseNpcId: NpcId | null;
  pairPoseLabel: string | null;
  ridingNpcId: NpcId | null;
  /** WS31: Active NPC seated in a sit session (or null). */
  sittingNpcId?: NpcId | null;
  sittingSeatLabel?: string | null;
  /** WS31: Live seat-sense summary within 10m around the player/NPC for WS29 situation & sit verdicts. */
  nearbySeatsSummary?: string | null;
  hasFreeSeatNearby?: boolean;
  nearestFreeSeatLabel?: string | null;
}

export const EMPTY_NPC_TOGETHERNESS_STATE: NpcTogethernessStateSnapshot = {
  walkingNpcId: null,
  pairPoseNpcId: null,
  pairPoseLabel: null,
  ridingNpcId: null,
  sittingNpcId: null,
  sittingSeatLabel: null,
  nearbySeatsSummary: null,
  hasFreeSeatNearby: false,
  nearestFreeSeatLabel: null,
};

export function dispatchNpcTogethernessCommand(command: NpcTogethernessCommand): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent<NpcTogethernessCommand>(NPC_TOGETHERNESS_COMMAND_EVENT, {
        detail: command,
      }),
    );
  }
}

export function dispatchNpcTogethernessState(state: NpcTogethernessStateSnapshot): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent<NpcTogethernessStateSnapshot>(NPC_TOGETHERNESS_STATE_EVENT, {
        detail: state,
      }),
    );
  }
}

// ============================================================================
// WS24 — RIDE-TOGETHER FIXES: FULL-STOP BRAKE, RIDING CAMERA & PILLION HUG POSE
// ============================================================================

export const RIDE_PASSENGER_HUG_POSE_SPEC = {
  id: 'ride_pillion_seated_hug_loop',
  label: 'Seated Pillion Hug',
  category: 'hug' as const,
  rideSessionOnly: true as const,
} as const;

/**
 * WS24 Defect 1: Brake input ALWAYS overrides throttle and brings the scooter
 * cleanly to a full stop (0 m/s) while both driver and passenger remain seated.
 */
export function resolveScooterBrakeOverride(params: {
  rawRideTargetMps: number;
  currentSpeedMps: number;
  isBrakeHeld: boolean;
  isBikeRide: boolean;
}): {
  rideTargetMps: number;
  isBraking: boolean;
  isThrottleActive: boolean;
  decelRateOverrideMps2: number | null;
} {
  if (params.isBrakeHeld) {
    return {
      rideTargetMps: 0,
      isBraking: params.currentSpeedMps > 0.05,
      isThrottleActive: false,
      decelRateOverrideMps2: params.isBikeRide ? 26 : 18,
    };
  }
  return {
    rideTargetMps: params.rawRideTargetMps,
    isBraking: params.rawRideTargetMps < -0.05,
    isThrottleActive: params.rawRideTargetMps > 0.05,
    decelRateOverrideMps2: null,
  };
}

/**
 * WS24 Defect 2: Framed dialogue camera is allowed ONLY when not in a ride session
 * (and stationary). Opening Talk during a ride shows the chat panel ONLY and keeps
 * the normal riding/chase camera + steering untouched.
 */
export function shouldAllowFramedDialogueCamera(params: {
  isRidingTogether: boolean;
  scooterSpeedMps?: number;
}): boolean {
  if (params.isRidingTogether) return false;
  if (typeof params.scooterSpeedMps === 'number' && Math.abs(params.scooterSpeedMps) > 0.25) {
    return false;
  }
  return true;
}

/**
 * WS24 Defect 3: Dedicated looped seated hugging pose for the pillion passenger.
 * Operates strictly in local bone space (never rotates the passenger root) so her
 * root stays hard-anchored to `computeScooterPassengerTransform` through turns & leans:
 * - Arms reach forward and curve inward holding the driver's waist
 * - Spine leans slightly forward with gentle breathing motion
 * - Legs straddle the pillion seat with knees bent cleanly
 */
export function applyScooterPillionHugPose(
  rig: {
    customGlbController?: {
      bones?: Map<string, { rotation: { x: number; y: number; z: number } }>;
    } | null;
    leftArmPivot?: { rotation: { x: number; y: number; z: number } } | null;
    rightArmPivot?: { rotation: { x: number; y: number; z: number } } | null;
    leftLegPivot?: { rotation: { x: number; y: number; z: number } } | null;
    rightLegPivot?: { rotation: { x: number; y: number; z: number } } | null;
  } | null | undefined,
  timeSec: number,
): void {
  if (!rig) return;
  const breath = Math.sin(timeSec * 2.2) * 0.018;
  const bones = rig.customGlbController?.bones;
  if (bones && bones.size > 0) {
    const getBone = (names: readonly string[]) => {
      for (const n of names) {
        const b = bones.get(n);
        if (b) return b;
      }
      return undefined;
    };

    // Keep hips/pelvis locked strictly forward in local space (zero independent root rotation)
    const hips = getBone(['Hips', 'PelvisRoot', 'mixamorigHips']);
    if (hips) {
      hips.rotation.y = 0;
    }

    // Gentle forward lean toward driver's back
    const spine = getBone(['Spine', 'Spine1', 'mixamorigSpine', 'mixamorigSpine1']);
    if (spine) {
      spine.rotation.x = 0.2 + breath;
      spine.rotation.y = 0;
      spine.rotation.z = 0;
    }
    const chest = getBone(['Spine2', 'Chest', 'mixamorigSpine2']);
    if (chest) {
      chest.rotation.x = 0.12 + breath * 0.6;
      chest.rotation.y = 0;
    }

    // Arms reaching forward & wrapping inward around driver's waist
    const leftArm = getBone(['LeftArm', 'mixamorigLeftArm', 'UpperArm_L']);
    if (leftArm) {
      leftArm.rotation.x = -0.82;
      leftArm.rotation.y = 0.28;
      leftArm.rotation.z = -0.35;
    }
    const rightArm = getBone(['RightArm', 'mixamorigRightArm', 'UpperArm_R']);
    if (rightArm) {
      rightArm.rotation.x = -0.82;
      rightArm.rotation.y = -0.28;
      rightArm.rotation.z = 0.35;
    }
    const leftForeArm = getBone(['LeftForeArm', 'mixamorigLeftForeArm', 'LowerArm_L']);
    if (leftForeArm) {
      leftForeArm.rotation.x = -0.45;
      leftForeArm.rotation.y = 0.58;
      leftForeArm.rotation.z = 0.18;
    }
    const rightForeArm = getBone(['RightForeArm', 'mixamorigRightForeArm', 'LowerArm_R']);
    if (rightForeArm) {
      rightForeArm.rotation.x = -0.45;
      rightForeArm.rotation.y = -0.58;
      rightForeArm.rotation.z = -0.18;
    }

    // Legs straddling pillion seat cleanly
    const leftUpLeg = getBone(['LeftUpLeg', 'mixamorigLeftUpLeg', 'Thigh_L']);
    if (leftUpLeg) {
      leftUpLeg.rotation.x = -1.05;
      leftUpLeg.rotation.z = -0.28;
    }
    const rightUpLeg = getBone(['RightUpLeg', 'mixamorigRightUpLeg', 'Thigh_R']);
    if (rightUpLeg) {
      rightUpLeg.rotation.x = -1.05;
      rightUpLeg.rotation.z = 0.28;
    }
    const leftLeg = getBone(['LeftLeg', 'mixamorigLeftLeg', 'Shin_L']);
    if (leftLeg) {
      leftLeg.rotation.x = 1.18;
    }
    const rightLeg = getBone(['RightLeg', 'mixamorigRightLeg', 'Shin_R']);
    if (rightLeg) {
      rightLeg.rotation.x = 1.18;
    }
    return;
  }

  // Fallback for procedural capsule rigs
  if (rig.leftArmPivot) {
    rig.leftArmPivot.rotation.x = -0.85 + breath;
    rig.leftArmPivot.rotation.z = -0.22;
  }
  if (rig.rightArmPivot) {
    rig.rightArmPivot.rotation.x = -0.85 + breath;
    rig.rightArmPivot.rotation.z = 0.22;
  }
  if (rig.leftLegPivot) {
    rig.leftLegPivot.rotation.x = -1.0;
    rig.leftLegPivot.rotation.z = -0.22;
  }
  if (rig.rightLegPivot) {
    rig.rightLegPivot.rotation.x = -1.0;
    rig.rightLegPivot.rotation.z = 0.22;
  }
}

// ============================================================================
// WS31 — OBJECT SENSE: SEATS (QUERY OVER EXISTING SEAT ANCHORS WITHIN 10m)
// ============================================================================

export const SEAT_SENSE_RADIUS_M = 10.0;

export interface NearbySeatInfo {
  id: string;
  label: string;
  x: number;
  z: number;
  yaw: number;
  liftY: number;
  distanceM: number;
  occupiedBy: string | null;
}

export interface ExtraSeatAnchorLike {
  id: string;
  label?: string;
  x: number;
  z: number;
  yaw?: number;
  facingYaw?: number;
  seatLiftY?: number;
  liftY?: number;
}

/**
 * Queries all existing seat anchors (`CITY_ANCHORS` with `activity === 'sit_relax'`
 * plus any optional extra lobby/world seat spots) within `maxDistanceM` (default 10m)
 * of `(x, z)`, sorted nearest-first with occupancy metadata.
 */
export function queryNearbySeats(params: {
  x: number;
  z: number;
  maxDistanceM?: number;
  occupiedBySeatId?: ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  extraSeats?: readonly ExtraSeatAnchorLike[];
}): NearbySeatInfo[] {
  const maxDist = params.maxDistanceM ?? SEAT_SENSE_RADIUS_M;
  const results: NearbySeatInfo[] = [];
  const seenIds = new Set<string>();

  const lookupOccupant = (seatId: string): string | null => {
    if (!params.occupiedBySeatId) return null;
    if (params.occupiedBySeatId instanceof Map) {
      return params.occupiedBySeatId.get(seatId) ?? null;
    }
    return (params.occupiedBySeatId as Readonly<Record<string, string>>)[seatId] ?? null;
  };

  for (const anchor of Object.values(CITY_LIFE_ANCHORS)) {
    if (anchor.activity !== 'sit_relax') continue;
    const dist = Math.hypot(anchor.x - params.x, anchor.z - params.z);
    if (dist > maxDist) continue;
    seenIds.add(anchor.id);
    results.push({
      id: anchor.id,
      label: anchor.label,
      x: anchor.x,
      z: anchor.z,
      yaw: anchor.yaw,
      liftY: anchor.seatLiftY ?? 0.12,
      distanceM: dist,
      occupiedBy: lookupOccupant(anchor.id),
    });
  }

  if (params.extraSeats) {
    for (const s of params.extraSeats) {
      if (seenIds.has(s.id)) continue;
      const dist = Math.hypot(s.x - params.x, s.z - params.z);
      if (dist > maxDist) continue;
      seenIds.add(s.id);
      results.push({
        id: s.id,
        label: s.label || 'Plaza Bench',
        x: s.x,
        z: s.z,
        yaw: s.yaw ?? s.facingYaw ?? 0,
        liftY: s.seatLiftY ?? s.liftY ?? 0.12,
        distanceM: dist,
        occupiedBy: lookupOccupant(s.id),
      });
    }
  }

  results.sort((a, b) => a.distanceM - b.distanceM);
  return results;
}

/**
 * Formats a compact nearby-objects summary for the WS29 RIGHT NOW situation block
 * (e.g. "2 free seats nearby (nearest: Casino Promenade Bench (North))").
 */
export function summarizeNearbySeatsForSituation(
  seats: readonly NearbySeatInfo[],
): string | null {
  if (!seats || seats.length === 0) return null;
  const freeSeats = seats.filter((s) => !s.occupiedBy);
  const occupiedCount = seats.length - freeSeats.length;
  const nearest = freeSeats[0] ?? seats[0];
  if (freeSeats.length > 0 && occupiedCount > 0) {
    return `${freeSeats.length} free ${freeSeats.length === 1 ? 'seat' : 'seats'} and ${occupiedCount} occupied nearby (nearest free: ${nearest.label})`;
  }
  if (freeSeats.length > 0) {
    return `${freeSeats.length} free ${freeSeats.length === 1 ? 'seat' : 'seats'} nearby (nearest: ${nearest.label})`;
  }
  return `${occupiedCount} ${occupiedCount === 1 ? 'seat' : 'seats'} nearby (all occupied; nearest: ${nearest.label})`;
}

/**
 * Picks the best free seat within 10m — nearest to the player when `preferNearPlayer`
 * is true ("sebelahku / next to me"), otherwise nearest to the NPC.
 */
export function selectBestFreeSeat(params: {
  npcX: number;
  npcZ: number;
  playerX: number;
  playerZ: number;
  preferNearPlayer?: boolean;
  maxDistanceM?: number;
  occupiedBySeatId?: ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  extraSeats?: readonly ExtraSeatAnchorLike[];
}): NearbySeatInfo | null {
  const refX = params.preferNearPlayer ? params.playerX : params.npcX;
  const refZ = params.preferNearPlayer ? params.playerZ : params.npcZ;
  const seats = queryNearbySeats({
    x: refX,
    z: refZ,
    maxDistanceM: params.maxDistanceM ?? SEAT_SENSE_RADIUS_M,
    occupiedBySeatId: params.occupiedBySeatId,
    extraSeats: params.extraSeats,
  });
  return seats.find((s) => !s.occupiedBy) ?? null;
}
