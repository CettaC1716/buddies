import type { ChatMessage, NearbyEntityUser } from '../components/SocialChatModal';
import {
  canSendPrivateMessageTo,
  isPlayerBlocked,
  normalizePlayerPrivacyKey,
  type PlayerPrivacySettings,
} from './buddiesPrivacySettings';
import {
  canShowAddFriendAction,
  hasPendingOutgoingFriendRequest,
  isFollowingPlayer,
  isFriendWith,
  type PlayerSocialGraph,
} from './buddiesSocialGraph';
import { npcIdToCitizenId, resolveNpcId } from './npcClosenessEngine';
import { getNpcPersona } from './npcPersonaRegistry';
import { ensureAllNpcPersonasRegistered } from './personas/index';

/**
 * WS17 — Public Chat Name Tap & Compact Bottom Profile Dock Logic
 * ===============================================================
 * Pure, testable decision helpers for tapping sender names in the Public Chat
 * feed and computing privacy/block-respecting dock actions.
 */

const SYSTEM_SENDER_KEYS = new Set([
  'system',
  'cerria',
  'cerria system',
  'server',
  'announcement',
  'notice',
  'world',
]);

const KNOWN_NPC_SENDER_NAMES = new Set([
  'hana',
  'kai',
  'mira',
  'nadia',
  'tari',
  'bima',
  'kenji',
  'raka',
  'merchant hana',
  'merchant kai',
]);

function simplifyName(raw: string): string {
  const cleaned = (raw || '').replace(/\s*\((ANDA|YOU|KAMU)\)/gi, '').trim();
  const parts = cleaned.split(/\s*[—–-]\s*/);
  return (parts[0] || cleaned).trim();
}

export type PublicChatSenderTapResult =
  | { kind: 'none' }
  | { kind: 'npc_profile'; npcEntity: NearbyEntityUser }
  | { kind: 'player_dock'; user: NearbyEntityUser };

/**
 * Resolves what happens when a sender name in the Public Chat feed is tapped:
 * - Self messages & system messages -> not tappable (`kind: 'none'`).
 * - NPC senders -> open existing NPC profile (`kind: 'npc_profile'`).
 * - Real players -> open compact bottom profile dock (`kind: 'player_dock'`).
 */
export function resolvePublicChatSenderAction(params: {
  msg: Pick<ChatMessage, 'senderId' | 'senderName' | 'isSelf' | 'type'>;
  localPlayerName?: string | null;
  localPlayerUid?: string | null;
  nearbyUsers: readonly NearbyEntityUser[];
}): PublicChatSenderTapResult {
  const { msg, nearbyUsers } = params;
  if (msg.isSelf || msg.type !== 'public') {
    return { kind: 'none' };
  }

  const cleanName = simplifyName(msg.senderName || '');
  const lowerName = cleanName.toLowerCase();
  const senderIdStr = (msg.senderId || '').trim();
  const lowerSenderId = senderIdStr.toLowerCase();

  if (!cleanName || SYSTEM_SENDER_KEYS.has(lowerName) || SYSTEM_SENDER_KEYS.has(lowerSenderId)) {
    return { kind: 'none' };
  }

  const localNameKey = normalizePlayerPrivacyKey(simplifyName(params.localPlayerName || ''));
  const localUidKey = normalizePlayerPrivacyKey(params.localPlayerUid || '');
  if (
    (localNameKey && normalizePlayerPrivacyKey(cleanName) === localNameKey) ||
    (localUidKey && senderIdStr && normalizePlayerPrivacyKey(senderIdStr) === localUidKey)
  ) {
    return { kind: 'none' };
  }

  // Match against live nearbyUsers first so we get full metadata (roleBadge, privacy, isNpc).
  const matchedNearby = nearbyUsers.find((u) => {
    if (u.isSelf) return false;
    if (senderIdStr) {
      if (String(u.id).toLowerCase() === lowerSenderId) return true;
      if (u.nearAccountId && u.nearAccountId.toLowerCase() === lowerSenderId) return true;
    }
    return simplifyName(u.name).toLowerCase() === lowerName;
  });

  if (matchedNearby?.isNpc) {
    return { kind: 'npc_profile', npcEntity: matchedNearby };
  }

  // Check named NPC registry / known NPC names even when NPC isn't currently in nearbyUsers.
  const resolvedNpc = resolveNpcId(senderIdStr) ?? resolveNpcId(cleanName);
  if (resolvedNpc || KNOWN_NPC_SENDER_NAMES.has(lowerName)) {
    ensureAllNpcPersonasRegistered();
    const persona = resolvedNpc ? getNpcPersona(resolvedNpc) : null;
    const citizenId = resolvedNpc ? npcIdToCitizenId(resolvedNpc) : senderIdStr || lowerName;
    const npcEntity: NearbyEntityUser = {
      id: citizenId,
      name: persona?.displayName ?? cleanName,
      distance: matchedNearby?.distance ?? 0,
      isNpc: true,
      isMerchant:
        resolvedNpc === 'hana' || resolvedNpc === 'kai' || resolvedNpc === 'nadia',
      merchantLocation:
        resolvedNpc === 'kai'
          ? 'beach_house'
          : resolvedNpc === 'hana'
            ? 'lobby_cafe'
            : resolvedNpc === 'nadia'
              ? 'central_plaza'
              : undefined,
      status: persona?.roleTitle ?? 'Resident',
    };
    return { kind: 'npc_profile', npcEntity };
  }

  const playerEntity: NearbyEntityUser = matchedNearby ?? {
    id: senderIdStr || cleanName,
    nearAccountId: senderIdStr || undefined,
    name: cleanName,
    distance: 0,
    isNpc: false,
    isSelf: false,
  };

  return { kind: 'player_dock', user: playerEntity };
}

export type PublicChatDockFriendshipStatus =
  | 'blocked'
  | 'friend'
  | 'pending'
  | 'following'
  | 'none';

export interface PublicChatProfileDockActions {
  isBlocked: boolean;
  friendshipStatus: PublicChatDockFriendshipStatus;
  isFriend: boolean;
  isPendingRequest: boolean;
  isFollowing: boolean;
  canAddFriend: boolean;
  canFollow: boolean;
  canWhisper: boolean;
  canViewProfile: boolean;
}

/**
 * Computes which actions are available in the compact bottom profile dock,
 * strictly enforcing existing privacy and block rules.
 */
export function resolveProfileDockActions(params: {
  user: NearbyEntityUser;
  socialGraph: PlayerSocialGraph;
  privacySettings: PlayerPrivacySettings;
  blockedByTarget?: boolean;
}): PublicChatProfileDockActions {
  const { user, socialGraph, privacySettings, blockedByTarget } = params;
  const targetId = user.nearAccountId?.trim() || String(user.id);
  const targetName = simplifyName(user.name);

  const isBlocked =
    isPlayerBlocked(privacySettings.blockedPlayers, targetId, targetName) ||
    Boolean(blockedByTarget);

  if (isBlocked) {
    return {
      isBlocked: true,
      friendshipStatus: 'blocked',
      isFriend: false,
      isPendingRequest: false,
      isFollowing: false,
      canAddFriend: false,
      canFollow: false,
      canWhisper: false,
      canViewProfile: false,
    };
  }

  const isFriend = isFriendWith(socialGraph, targetId, targetName);
  const isPendingRequest = hasPendingOutgoingFriendRequest(
    socialGraph,
    targetId,
    targetName,
  );
  const isFollowing = isFollowingPlayer(socialGraph, targetId, targetName);

  const canAddFriend = canShowAddFriendAction({
    isSelf: Boolean(user.isSelf),
    isNpc: Boolean(user.isNpc),
    isBlocked: false,
    isFriend,
    allowFriendRequests: user.allowFriendRequests,
  });

  const whisperCheck = canSendPrivateMessageTo({
    localSettings: privacySettings,
    recipientId: targetId,
    recipientName: targetName,
    recipientPrivateMessages: user.privateMessages,
    isFriend,
  });

  const friendshipStatus: PublicChatDockFriendshipStatus = isFriend
    ? 'friend'
    : isPendingRequest
      ? 'pending'
      : isFollowing
        ? 'following'
        : 'none';

  return {
    isBlocked: false,
    friendshipStatus,
    isFriend,
    isPendingRequest,
    isFollowing,
    canAddFriend,
    canFollow: true,
    canWhisper: whisperCheck.allowed,
    canViewProfile: true,
  };
}
