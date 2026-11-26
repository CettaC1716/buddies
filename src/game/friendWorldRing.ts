import { isFriendWith, type PlayerSocialGraph } from './buddiesSocialGraph';

/**
 * WS16 (Revised) — In-World Mutual Friend Blue Radial Ring
 * ========================================================
 * Source of truth is the existing `PlayerSocialGraph.friends` list (`isFriendWith`).
 * - Mutual friend remote avatar -> blue radial ring at avatar base
 * - One-way following / pending request -> no ring
 * - Stranger -> no ring
 * - Local player's own avatar -> never ringed
 * - Uses the same radial ring geometry language as `characterSelectionRing`
 *   (which remains green `#22c55e` for clicked interaction targets).
 */

export const FRIEND_WORLD_RING_COLOR_HEX = 0x3b82f6;

export const FRIEND_WORLD_RING_SPEC = {
  innerRadius: 0.70,
  outerRadius: 0.96,
  segments: 36,
  opacity: 0.92,
  groundOffsetY: 0.038,
  colorHex: FRIEND_WORLD_RING_COLOR_HEX,
} as const;

export type AvatarFriendRingDecision =
  | { visible: true; colorHex: typeof FRIEND_WORLD_RING_COLOR_HEX }
  | { visible: false; colorHex: null };

export function resolveRemoteAvatarFriendRing(params: {
  isLocalPlayer: boolean;
  socialGraph: Pick<PlayerSocialGraph, 'friends'> | null | undefined;
  peerNearAccountId?: string | null;
  peerSessionId?: string | null;
  peerDisplayName?: string | null;
}): AvatarFriendRingDecision {
  if (params.isLocalPlayer) {
    return { visible: false, colorHex: null };
  }
  if (!params.socialGraph) {
    return { visible: false, colorHex: null };
  }

  const candidateId =
    params.peerNearAccountId?.trim() || params.peerSessionId?.trim() || null;
  const candidateName = params.peerDisplayName?.trim() || null;

  if (isFriendWith(params.socialGraph, candidateId, candidateName)) {
    return { visible: true, colorHex: FRIEND_WORLD_RING_COLOR_HEX };
  }

  return { visible: false, colorHex: null };
}
