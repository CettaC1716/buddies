import {
  canPairPose,
  canRideTogether,
  canWalkTogether,
  getNpcClosenessBand,
  isHighTierMerchantNpc,
  resolveNpcId,
  type ClosenessBand,
  type NpcClosenessStore,
  type NpcId,
} from './npcClosenessEngine';
import {
  giveGiftToNpc,
  type GiftCategory,
  type GiftItemInput,
  type GiftReactionTier,
} from './npcGiftEngine';
import { getNpcPersona, type NpcEmotionTag } from './npcPersonaRegistry';
import { ensureAllNpcPersonasRegistered } from './personas/index';
import type { NpcTogethernessStateSnapshot } from './npcTogetherness';
import type { UrbanScooterKind } from './buddiesUrbanScooterRules';

/**
 * WS12 — Contextual Ride/Walk-Together Chat Invitation & Session Flow
 * ====================================================================
 * Pure, testable session-flow layer built on top of `npcClosenessEngine`
 * and `npcTogetherness` without changing engine math, closeness rules,
 * or persona pack files.
 */

export type TogethernessInvitationKind = 'walk' | 'ride';

export interface ChatTogethernessOptions {
  /** True when the player is on `electric_scooter_bike` and ride-together is reachable for this NPC. */
  canInviteRide: boolean;
  /** True when the player is on foot (`playerScooterKind === null`) and walk-together is reachable for this NPC. */
  canInviteWalk: boolean;
  isRidingWithThisNpc: boolean;
  isWalkingWithThisNpc: boolean;
  showGetOffOption: boolean;
  getOffLabel: string;
}

export type TogethernessRefusalReason =
  | 'unknown_npc'
  | 'closeness_too_low'
  | 'requires_electric_scooter_bike'
  | 'merchant_role_restricted';

export interface TogethernessInvitationDecision {
  accepted: boolean;
  reason: TogethernessRefusalReason | null;
  band: ClosenessBand;
  requiredBand: ClosenessBand;
  replyLine: string;
}

export type ForcedTogethernessEndReason =
  | 'player_unavailable'
  | 'entered_warzone'
  | 'entered_interior'
  | 'started_fishing'
  | 'scooter_dismounted';

export interface ForcedTogethernessEndResult {
  shouldEnd: boolean;
  reason: ForcedTogethernessEndReason | null;
}

export const RIDE_MOUNT_APPROACH_DIST_M = 1.25;
export const RIDE_MOUNT_APPROACH_SPEED_MPS = 2.6;
export const RIDE_MOUNT_APPROACH_TIMEOUT_SEC = 4.5;

/**
 * Determines which contextual ride/walk invitation or "get off here" options
 * should appear inside the NPC chat modal.
 *
 * Rules:
 * - Ride invitation appears ONLY when the player is mounted on `electric_scooter_bike`
 *   (never on `push_kick_scooter` or on foot) and the NPC enjoys scooter rides.
 * - Walk invitation appears ONLY when the player is on foot (`playerScooterKind === null`).
 * - While riding/walking together with this NPC, a "Get off here" / "Stop walking here"
 *   option appears instead of a duplicate invite.
 */
export function resolveChatTogethernessOptions(params: {
  npcId: string | null | undefined;
  playerScooterKind: UrbanScooterKind | null;
  togethernessState: NpcTogethernessStateSnapshot;
}): ChatTogethernessOptions {
  const npcId = resolveNpcId(params.npcId);
  if (!npcId) {
    return {
      canInviteRide: false,
      canInviteWalk: false,
      isRidingWithThisNpc: false,
      isWalkingWithThisNpc: false,
      showGetOffOption: false,
      getOffLabel: 'Get off here',
    };
  }

  ensureAllNpcPersonasRegistered();
  const persona = getNpcPersona(npcId);
  const merchantRestricted = isHighTierMerchantNpc(npcId);
  const rideReachable = !merchantRestricted && persona?.activityPreferences?.enjoysScooterRide !== false;

  const isRidingWithThisNpc = params.togethernessState.ridingNpcId === npcId;
  const isWalkingWithThisNpc = params.togethernessState.walkingNpcId === npcId;
  const showGetOffOption = isRidingWithThisNpc || isWalkingWithThisNpc;

  const canInviteRide =
    !isRidingWithThisNpc &&
    rideReachable &&
    params.playerScooterKind === 'electric_scooter_bike';

  const canInviteWalk =
    !merchantRestricted &&
    !isWalkingWithThisNpc &&
    !isRidingWithThisNpc &&
    params.playerScooterKind === null;

  return {
    canInviteRide,
    canInviteWalk,
    isRidingWithThisNpc,
    isWalkingWithThisNpc,
    showGetOffOption,
    getOffLabel: isRidingWithThisNpc ? 'Get off here' : 'Stop walking here',
  };
}

/**
 * Builds an in-character refusal line from the NPC's persona pack without
 * exposing any closeness scores, tiers, or thresholds.
 */
function buildPersonaInvitationRefusalLine(
  npcId: NpcId,
  kind: TogethernessInvitationKind,
  band: ClosenessBand,
): string {
  ensureAllNpcPersonasRegistered();
  const persona = getNpcPersona(npcId);
  const district = persona?.homeDistrict || 'around town';
  const fallbackBank = persona?.fallbackReplies?.[band];
  const baseToneLine =
    fallbackBank && fallbackBank.length > 0 ? fallbackBank[0].trim() : '';

  if (kind === 'ride') {
    if (band === 'close') {
      return `I love hanging out with you around ${district}, maybe give me a little more time before I hop on the back of your scooter.`;
    }
    return baseToneLine
      ? `Not quite ready for a scooter ride yet—let's chat a bit more first. ${baseToneLine}`
      : `Not quite ready for a scooter ride yet—let's get to know each other a bit better around ${district} first!`;
  }

  if (band === 'friendly') {
    return `I'm enjoying our talks around ${district}, let's spend a little more time chatting here before we head out on a walk.`;
  }
  return baseToneLine
    ? `I'll stay right here for now—maybe after we've chatted a bit more! ${baseToneLine}`
    : `I'll stay around ${district} for now—let's talk a little more first!`;
}

function buildPersonaInvitationAcceptLine(
  npcId: NpcId,
  kind: TogethernessInvitationKind,
): string {
  ensureAllNpcPersonasRegistered();
  const persona = getNpcPersona(npcId);
  const district = persona?.homeDistrict || 'town';
  if (kind === 'ride') {
    return `Sure, I'll hop right on! Show me around ${district}—lead the way.`;
  }
  return `I'd love to go for a walk! Lead the way around ${district}.`;
}

/**
 * Evaluates a player's in-conversation invitation to ride or walk together.
 * - Uses the existing closeness engine (`canRideTogether` / `canWalkTogether`).
 * - Refusal NEVER mutates closeness (costs 0 closeness).
 * - Ride invitations require `electric_scooter_bike` (never `push_kick_scooter`).
 */
export function evaluateTogethernessInvitation(params: {
  store: NpcClosenessStore;
  npcId: string;
  kind: TogethernessInvitationKind;
  playerScooterKind: UrbanScooterKind | null;
  nowMs?: number;
}): TogethernessInvitationDecision {
  const npcId = resolveNpcId(params.npcId);
  const requiredBand: ClosenessBand = params.kind === 'ride' ? 'trusted' : 'close';
  if (!npcId) {
    return {
      accepted: false,
      reason: 'unknown_npc',
      band: 'stranger',
      requiredBand,
      replyLine: 'Maybe another time!',
    };
  }

  const nowMs = params.nowMs ?? Date.now();
  const band = getNpcClosenessBand(params.store, npcId, nowMs);

  if (isHighTierMerchantNpc(npcId)) {
    const merchantReply =
      npcId === 'hana'
        ? params.kind === 'ride'
          ? 'That sounds fun, though my duties running the West Plaza agency keep me grounded here—I cannot hop on a scooter! Stay and chat with me for a bit instead.'
          : 'I wish I could wander off with you, though I have to look after my West Plaza storefront and guests. Drop by anytime for a talk—or a photo together once we know each other well!'
        : params.kind === 'ride'
          ? 'Flattering offer, really—but wind on a scooter plus Central Plaza boutique duties? Not happening. Hang out with me here at the plaza instead.'
          : 'I have to stay around Central Plaza to curate the boutique and greet regulars, so I cannot walk away on a stroll. Keep visiting though—I always make time to talk.';
    return {
      accepted: false,
      reason: 'merchant_role_restricted',
      band,
      requiredBand,
      replyLine: merchantReply,
    };
  }

  if (params.kind === 'ride') {
    if (params.playerScooterKind !== 'electric_scooter_bike') {
      return {
        accepted: false,
        reason: 'requires_electric_scooter_bike',
        band,
        requiredBand,
        replyLine: 'Bring your scooter bike over if you want me to ride along!',
      };
    }
    if (!canRideTogether(params.store, npcId, nowMs)) {
      return {
        accepted: false,
        reason: 'closeness_too_low',
        band,
        requiredBand,
        replyLine: buildPersonaInvitationRefusalLine(npcId, 'ride', band),
      };
    }
    return {
      accepted: true,
      reason: null,
      band,
      requiredBand,
      replyLine: buildPersonaInvitationAcceptLine(npcId, 'ride'),
    };
  }

  if (!canWalkTogether(params.store, npcId, nowMs)) {
    return {
      accepted: false,
      reason: 'closeness_too_low',
      band,
      requiredBand,
      replyLine: buildPersonaInvitationRefusalLine(npcId, 'walk', band),
    };
  }
  return {
    accepted: true,
    reason: null,
    band,
    requiredBand,
    replyLine: buildPersonaInvitationAcceptLine(npcId, 'walk'),
  };
}

/**
 * Mirrors the player's own riding/activity rules to determine when an active
 * ride-together or walk-together session MUST be forcibly ended.
 */
export function shouldForceEndTogethernessSession(params: {
  mode: TogethernessInvitationKind;
  worldMode: string;
  isInInterior: boolean;
  isFishing: boolean;
  playerScooterKind: UrbanScooterKind | null;
  playerAlive: boolean;
}): ForcedTogethernessEndResult {
  if (!params.playerAlive) {
    return { shouldEnd: true, reason: 'player_unavailable' };
  }
  if (params.worldMode === 'warzone') {
    return { shouldEnd: true, reason: 'entered_warzone' };
  }
  if (params.isInInterior) {
    return { shouldEnd: true, reason: 'entered_interior' };
  }
  if (params.isFishing) {
    return { shouldEnd: true, reason: 'started_fishing' };
  }
  if (params.mode === 'ride' && params.playerScooterKind !== 'electric_scooter_bike') {
    return { shouldEnd: true, reason: 'scooter_dismounted' };
  }
  return { shouldEnd: false, reason: null };
}

/**
 * Pure steering step for an NPC walking over to the scooter bike's pillion seat
 * before mounting as passenger.
 */
export function stepNpcApproachVehicleForRide(params: {
  npcX: number;
  npcZ: number;
  npcYaw: number;
  pillionX: number;
  pillionZ: number;
  dt: number;
  elapsedSec: number;
}): {
  x: number;
  z: number;
  yaw: number;
  speedMps: number;
  isMoving: boolean;
  reachedMount: boolean;
} {
  const dt = Math.max(0, Math.min(0.25, Number.isFinite(params.dt) ? params.dt : 0));
  const dx = params.pillionX - params.npcX;
  const dz = params.pillionZ - params.npcZ;
  const dist = Math.hypot(dx, dz);

  if (
    dist <= RIDE_MOUNT_APPROACH_DIST_M ||
    params.elapsedSec >= RIDE_MOUNT_APPROACH_TIMEOUT_SEC
  ) {
    return {
      x: params.npcX,
      z: params.npcZ,
      yaw: dist > 0.05 ? Math.atan2(-dz, dx) : params.npcYaw,
      speedMps: 0,
      isMoving: false,
      reachedMount: true,
    };
  }

  const stepDist = Math.min(RIDE_MOUNT_APPROACH_SPEED_MPS * dt, dist);
  const nx = params.npcX + (dx / dist) * stepDist;
  const nz = params.npcZ + (dz / dist) * stepDist;
  const yaw = Math.atan2(-dz, dx);
  const remaining = Math.hypot(params.pillionX - nx, params.pillionZ - nz);

  return {
    x: nx,
    z: nz,
    yaw,
    speedMps: dt > 1e-4 ? stepDist / dt : RIDE_MOUNT_APPROACH_SPEED_MPS,
    isMoving: stepDist > 1e-4,
    reachedMount: remaining <= RIDE_MOUNT_APPROACH_DIST_M,
  };
}

// ============================================================================
// WS13 — RELATIONAL ACTION GATES (PAIRED POSE & GIFT SUBMISSION)
// ============================================================================

export interface PairedPoseDecision {
  accepted: boolean;
  reason: 'unknown_npc' | 'closeness_too_low' | null;
  band: ClosenessBand;
  requiredBand: ClosenessBand;
  replyLine: string;
}

/**
 * Evaluates a player's paired-pose request from the chat session dock.
 * - Uses the existing closeness engine (`canPairPose`, threshold 45 / 'friendly').
 * - Refusal costs ZERO closeness and returns an in-character persona line.
 */
export function evaluatePairedPoseRequest(params: {
  store: NpcClosenessStore;
  npcId: string;
  nowMs?: number;
}): PairedPoseDecision {
  const npcId = resolveNpcId(params.npcId);
  if (!npcId) {
    return {
      accepted: false,
      reason: 'unknown_npc',
      band: 'stranger',
      requiredBand: 'friendly',
      replyLine: 'Maybe another time!',
    };
  }
  const nowMs = params.nowMs ?? Date.now();
  const band = getNpcClosenessBand(params.store, npcId, nowMs);
  const requiredBand: ClosenessBand = isHighTierMerchantNpc(npcId) ? 'close' : 'friendly';
  ensureAllNpcPersonasRegistered();
  const persona = getNpcPersona(npcId);
  const district = persona?.homeDistrict || 'around town';

  if (!canPairPose(params.store, npcId, nowMs)) {
    const fallbackBank = persona?.fallbackReplies?.[band];
    const baseTone =
      fallbackBank && fallbackBank.length > 0 ? fallbackBank[0].trim() : '';
    const replyLine = isHighTierMerchantNpc(npcId)
      ? npcId === 'nadia'
        ? 'Not so fast—I only do paired shoots with close patrons and people I really trust. Keep visiting the plaza and we will get there.'
        : 'That is really sweet of you to ask! I usually save paired photos for people I have grown truly close with around the plaza—let us spend more time together first.'
      : baseTone
        ? `A pair photo already? Let's get to know each other a bit better first! ${baseTone}`
        : `A pair photo already? Let's chat a bit more around ${district} first!`;
    return {
      accepted: false,
      reason: 'closeness_too_low',
      band,
      requiredBand,
      replyLine,
    };
  }

  return {
    accepted: true,
    reason: null,
    band,
    requiredBand,
    replyLine: `Sure, I'd love to take a photo together! Pick a pose.`,
  };
}

/**
 * Guard for any direct paired-pose entry point (e.g. Arena `requestPairedPose:`):
 * - For named NPCs, enforces `canPairPose` from the closeness engine.
 * - For non-named targets (human players), returns true so multiplayer poses still work.
 */
export function canStartDirectPairedPoseForTarget(params: {
  store: NpcClosenessStore;
  targetId: string;
  nowMs?: number;
}): boolean {
  const npcId = resolveNpcId(params.targetId);
  if (!npcId) return true;
  return canPairPose(params.store, npcId, params.nowMs ?? Date.now());
}

export interface NpcGiftSubmissionOutcome {
  accepted: boolean;
  reason?: 'unknown_npc' | 'unknown_item' | 'already_gifted_today';
  reactionTier: GiftReactionTier;
  emotion: NpcEmotionTag;
  reactionLine: string;
  itemId: string;
  itemName: string;
  category: GiftCategory | null;
  store: NpcClosenessStore;
}

/**
 * Routes a gift submission through the existing gift engine (`giveGiftToNpc`),
 * returning the updated store plus a guaranteed non-silent persona reaction line
 * and emotion tag in data.
 */
export function evaluateNpcGiftSubmission(params: {
  store: NpcClosenessStore;
  npcId: string;
  itemInput: GiftItemInput;
  nowMs?: number;
  dateKey?: string;
}): NpcGiftSubmissionOutcome {
  ensureAllNpcPersonasRegistered();
  const res = giveGiftToNpc(params.store, params.npcId, params.itemInput, {
    nowMs: params.nowMs,
    dateKey: params.dateKey,
  });
  const npcId = resolveNpcId(params.npcId);
  const persona = npcId ? getNpcPersona(npcId) : null;

  if (!res.accepted) {
    return {
      accepted: false,
      reason: res.reason,
      reactionTier: 'neutral',
      emotion: 'awkward',
      reactionLine:
        res.reason === 'already_gifted_today'
          ? 'You already brought me a gift today. Let us save the next one for tomorrow!'
          : 'Thanks, though I cannot take that item right now.',
      itemId: res.itemId,
      itemName: res.itemName,
      category: res.category,
      store: params.store,
    };
  }

  const lines = persona?.giftReactionLines?.[res.reactionTier];
  const reactionLine =
    lines && lines.length > 0
      ? lines[0]
      : res.reactionTier === 'loved'
        ? 'Thank you so much! I really love this.'
        : res.reactionTier === 'liked'
          ? 'That is really thoughtful of you, thank you!'
          : res.reactionTier === 'disliked'
            ? 'Thank you for bringing this by, though it is not quite my usual style.'
            : 'Thank you for thinking of me!';

  const emotion: NpcEmotionTag =
    res.reactionTier === 'loved' || res.reactionTier === 'liked'
      ? 'happy'
      : res.reactionTier === 'disliked'
        ? 'awkward'
        : 'neutral';

  return {
    accepted: true,
    reactionTier: res.reactionTier,
    emotion,
    reactionLine,
    itemId: res.itemId,
    itemName: res.itemName,
    category: res.category,
    store: res.store,
  };
}

// ============================================================================
// NATURAL-LANGUAGE TYPED CHAT INTENT DETECTION (WALK / RIDE / END)
// ============================================================================

export type TypedChatTogethernessIntent = 'walk' | 'ride' | 'end' | null;

const END_TOGETHERNESS_PATTERNS: readonly RegExp[] = [
  /\b(get off|drop me off|drop off here|stop walking|end walk|end ride|part ways)\b/i,
  /\b(turun(\s+di)?\s*sini|turun\s+dulu|turun\s+yuk|turun\s+ya|berhenti\s+di\s+sini|stop\s+di\s+sini|sampai\s+sini\s+dulu|udah\s+dulu\s+jalan|selesai\s+jalan)/i,
];

const RIDE_TOGETHER_PATTERNS: readonly RegExp[] = [
  /\b(ride together|ride along|go for a ride|take a ride|hop on|ride with me|scooter ride|want a ride|get on my (scooter|bike|motor)|one more ride|ride again)\b/i,
  /\b(bonceng\w*(\s+lagi)?|naik\s+(motor\w*|skuter\w*|scooter\w*|vespa\w*|sepeda\s*motor\w*|lagi)|ikut\s+naik|keliling\s+(naik|lagi)|sini\s+naik|ayo\s+naik(\s+lagi)?|yuk\s+naik(\s+lagi)?|gas\s+lagi)/i,
];

const WALK_TOGETHER_PATTERNS: readonly RegExp[] = [
  /\b(walk together|go for a walk|take a walk|walk with me|stroll together|let'?s walk|wanna walk|walk again|stroll again)\b/i,
  /\b(jalan\s+bareng|jalan-jalan|jalan\s+bersama|jalan\s+lagi|temen\w*\s+jalan|teman\w*\s+jalan|ikut\s+jalan|ayo\s+jalan(\s+lagi)?|yuk\s+jalan(\s+lagi)?|mau\s+jalan)/i,
];

/**
 * Detects natural-language walk/ride/get-off invitations typed in chat
 * (Indonesian or English) so togetherness feels organic and progressive
 * rather than exposed as static buttons.
 */
export function detectChatTogethernessIntent(
  rawText: string,
): TypedChatTogethernessIntent {
  const clean = (rawText || '').trim();
  if (!clean) return null;
  if (END_TOGETHERNESS_PATTERNS.some((re) => re.test(clean))) {
    return 'end';
  }
  if (RIDE_TOGETHER_PATTERNS.some((re) => re.test(clean))) {
    return 'ride';
  }
  if (WALK_TOGETHER_PATTERNS.some((re) => re.test(clean))) {
    return 'walk';
  }
  return null;
}


