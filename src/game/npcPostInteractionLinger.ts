import { resolveNpcId } from './npcClosenessEngine';

/** Single tunable duration (seconds) an NPC lingers after a conversation closes. */
export const NPC_POST_INTERACTION_LINGER_DURATION_SEC = 25;

/** Player distance (meters) beyond which post-interaction linger ends early. */
export const NPC_POST_INTERACTION_LINGER_MAX_DIST_M = 15;

/** Smooth yaw tracking turn rate (rad/s) while facing the player during linger. */
export const NPC_POST_INTERACTION_LINGER_TURN_RATE_RAD_S = 6.5;

export interface NpcPostInteractionLingerState {
  active: boolean;
  remainingSec: number;
}

export interface NpcWaypointCoord {
  x: number;
  z: number;
}

export interface StepNpcPostInteractionLingerParams {
  state: NpcPostInteractionLingerState;
  npcId: string;
  wasTalking: boolean;
  isTalking: boolean;
  npcX: number;
  npcZ: number;
  npcYaw: number;
  playerX: number;
  playerZ: number;
  waypoints: readonly NpcWaypointCoord[];
  dt: number;
  /** True if another exclusive activity (walk-together, ride-together, pair pose) took over. */
  suppressedByActivity?: boolean;
  lingerDurationSec?: number;
  maxDistanceM?: number;
}

export interface StepNpcPostInteractionLingerResult {
  state: NpcPostInteractionLingerState;
  isLingering: boolean;
  endedThisFrame: boolean;
  endReason: 'none' | 'expired' | 'player_far' | 'suppressed';
  yaw: number;
  resumeWaypointIdx: number | null;
}

export function createIdleNpcLingerState(): NpcPostInteractionLingerState {
  return { active: false, remainingSec: 0 };
}

export function isNamedNpcEligibleForLinger(rawNpcId: string | null | undefined): boolean {
  return resolveNpcId(rawNpcId) !== null;
}

export function startNpcLingerState(
  durationSec = NPC_POST_INTERACTION_LINGER_DURATION_SEC,
): NpcPostInteractionLingerState {
  return {
    active: true,
    remainingSec: Math.max(0.1, durationSec),
  };
}

/**
 * Resets the linger countdown back to the full duration when a new interaction
 * occurs (dialogue opened/re-interacted, gift given, or emotion reaction triggered).
 */
export function resetNpcLingerTimer(
  state: NpcPostInteractionLingerState,
  rawNpcId: string | null | undefined,
  durationSec = NPC_POST_INTERACTION_LINGER_DURATION_SEC,
): NpcPostInteractionLingerState {
  if (!isNamedNpcEligibleForLinger(rawNpcId)) return state;
  return startNpcLingerState(durationSec);
}

/**
 * Finds the index of the waypoint in `waypoints` nearest to `(npcX, npcZ)` so
 * the NPC resumes patrol smoothly without teleporting or backtracking across
 * the whole loop.
 */
export function findNearestWaypointIndex(
  waypoints: readonly NpcWaypointCoord[],
  npcX: number,
  npcZ: number,
): number {
  if (waypoints.length === 0) return 0;
  let bestIdx = 0;
  let bestDistSq = Infinity;
  for (let i = 0; i < waypoints.length; i++) {
    const dx = waypoints[i].x - npcX;
    const dz = waypoints[i].z - npcZ;
    const dSq = dx * dx + dz * dz;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function stepYawTowardPlayer(
  currentYaw: number,
  npcX: number,
  npcZ: number,
  playerX: number,
  playerZ: number,
  dt: number,
): number {
  const dx = playerX - npcX;
  const dz = playerZ - npcZ;
  if (dx * dx + dz * dz < 1e-4) return currentYaw;
  const targetYaw = Math.atan2(-dz, dx);
  let diff = targetYaw - currentYaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const maxStep = NPC_POST_INTERACTION_LINGER_TURN_RATE_RAD_S * Math.max(0, dt);
  return currentYaw + Math.max(-maxStep, Math.min(maxStep, diff));
}

/**
 * Advances per-client post-interaction linger state for an ambient NPC.
 * - Starts a 25s linger when a dialogue with a named NPC closes.
 * - Resets/pauses cleanly while a dialogue is open.
 * - Ends early if the player moves more than 15m away or an exclusive activity starts.
 * - Returns `resumeWaypointIdx` (nearest waypoint) on the exact frame linger ends.
 */
export function stepNpcPostInteractionLinger(
  params: StepNpcPostInteractionLingerParams,
): StepNpcPostInteractionLingerResult {
  const {
    npcId,
    wasTalking,
    isTalking,
    npcX,
    npcZ,
    npcYaw,
    playerX,
    playerZ,
    waypoints,
    suppressedByActivity = false,
  } = params;
  const dt = Math.max(0, Math.min(0.25, params.dt));
  const durationSec = params.lingerDurationSec ?? NPC_POST_INTERACTION_LINGER_DURATION_SEC;
  const maxDistM = params.maxDistanceM ?? NPC_POST_INTERACTION_LINGER_MAX_DIST_M;

  if (!isNamedNpcEligibleForLinger(npcId)) {
    return {
      state: createIdleNpcLingerState(),
      isLingering: false,
      endedThisFrame: false,
      endReason: 'none',
      yaw: npcYaw,
      resumeWaypointIdx: null,
    };
  }

  if (suppressedByActivity) {
    const wasActive = params.state.active;
    return {
      state: createIdleNpcLingerState(),
      isLingering: false,
      endedThisFrame: wasActive,
      endReason: wasActive ? 'suppressed' : 'none',
      yaw: npcYaw,
      resumeWaypointIdx: wasActive ? findNearestWaypointIndex(waypoints, npcX, npcZ) : null,
    };
  }

  // While a dialogue is open, the dialogue handler itself keeps the NPC facing the player;
  // keep the linger timer refreshed so closing the dialogue starts a full window.
  if (isTalking) {
    return {
      state: createIdleNpcLingerState(),
      isLingering: false,
      endedThisFrame: false,
      endReason: 'none',
      yaw: npcYaw,
      resumeWaypointIdx: null,
    };
  }

  let current = params.state;

  // Dialogue just closed -> start fresh post-interaction linger window
  if (wasTalking && !isTalking) {
    current = startNpcLingerState(durationSec);
  }

  if (!current.active) {
    return {
      state: createIdleNpcLingerState(),
      isLingering: false,
      endedThisFrame: false,
      endReason: 'none',
      yaw: npcYaw,
      resumeWaypointIdx: null,
    };
  }

  const distToPlayer = Math.hypot(playerX - npcX, playerZ - npcZ);
  if (distToPlayer > maxDistM) {
    return {
      state: createIdleNpcLingerState(),
      isLingering: false,
      endedThisFrame: true,
      endReason: 'player_far',
      yaw: npcYaw,
      resumeWaypointIdx: findNearestWaypointIndex(waypoints, npcX, npcZ),
    };
  }

  const nextRemaining = current.remainingSec - dt;
  if (nextRemaining <= 0) {
    return {
      state: createIdleNpcLingerState(),
      isLingering: false,
      endedThisFrame: true,
      endReason: 'expired',
      yaw: npcYaw,
      resumeWaypointIdx: findNearestWaypointIndex(waypoints, npcX, npcZ),
    };
  }

  const nextYaw = stepYawTowardPlayer(npcYaw, npcX, npcZ, playerX, playerZ, dt);
  return {
    state: { active: true, remainingSec: nextRemaining },
    isLingering: true,
    endedThisFrame: false,
    endReason: 'none',
    yaw: nextYaw,
    resumeWaypointIdx: null,
  };
}
