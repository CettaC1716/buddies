import assert from 'node:assert/strict';
import test from 'node:test';
import type { NearbyEntityUser } from '../components/SocialChatModal';
import { DEFAULT_PLAYER_PRIVACY_SETTINGS } from './buddiesPrivacySettings';
import {
  addFollowingEntry,
  addFriendEntry,
  addPendingOutgoingFriendRequest,
  DEFAULT_PLAYER_SOCIAL_GRAPH,
} from './buddiesSocialGraph';
import {
  resolveProfileDockActions,
  resolvePublicChatSenderAction,
} from './publicChatNameTap';

const ALICE: NearbyEntityUser = {
  id: 'alice.near',
  nearAccountId: 'alice.near',
  name: 'Alice',
  distance: 5,
  isNpc: false,
  isSelf: false,
  roleBadge: 'builder',
  allowFriendRequests: true,
  privateMessages: 'everyone',
};

test('WS17 name tap: real player opens dock, NPC opens NPC profile, system/self are not tappable', () => {
  const playerTap = resolvePublicChatSenderAction({
    msg: { senderId: 'alice.near', senderName: 'Alice', isSelf: false, type: 'public' },
    localPlayerName: 'Me',
    localPlayerUid: 'me.near',
    nearbyUsers: [ALICE],
  });
  assert.equal(playerTap.kind, 'player_dock');
  assert.equal(playerTap.user.name, 'Alice');
  assert.equal(playerTap.user.roleBadge, 'builder');

  const npcTap = resolvePublicChatSenderAction({
    msg: { senderId: 'npc_hana', senderName: 'Hana', isSelf: false, type: 'public' },
    localPlayerName: 'Me',
    localPlayerUid: 'me.near',
    nearbyUsers: [ALICE],
  });
  assert.equal(npcTap.kind, 'npc_profile');
  assert.equal(npcTap.npcEntity.isNpc, true);

  const systemTap = resolvePublicChatSenderAction({
    msg: { senderId: 'system', senderName: 'System', isSelf: false, type: 'public' },
    localPlayerName: 'Me',
    localPlayerUid: 'me.near',
    nearbyUsers: [ALICE],
  });
  assert.equal(systemTap.kind, 'none');

  const selfTap = resolvePublicChatSenderAction({
    msg: { senderId: 'me.near', senderName: 'Me', isSelf: true, type: 'public' },
    localPlayerName: 'Me',
    localPlayerUid: 'me.near',
    nearbyUsers: [ALICE],
  });
  assert.equal(selfTap.kind, 'none');
});

test('WS17 profile dock actions respect friendship, follow, privacy, and block rules', () => {
  // Stranger with open privacy
  const strangerActions = resolveProfileDockActions({
    user: ALICE,
    socialGraph: DEFAULT_PLAYER_SOCIAL_GRAPH,
    privacySettings: DEFAULT_PLAYER_PRIVACY_SETTINGS,
  });
  assert.equal(strangerActions.isBlocked, false);
  assert.equal(strangerActions.friendshipStatus, 'none');
  assert.equal(strangerActions.canAddFriend, true);
  assert.equal(strangerActions.canFollow, true);
  assert.equal(strangerActions.canWhisper, true);
  assert.equal(strangerActions.canViewProfile, true);

  // Mutual friend
  const friendGraph = addFriendEntry(DEFAULT_PLAYER_SOCIAL_GRAPH, {
    id: 'alice.near',
    name: 'Alice',
  });
  const friendActions = resolveProfileDockActions({
    user: ALICE,
    socialGraph: friendGraph,
    privacySettings: DEFAULT_PLAYER_PRIVACY_SETTINGS,
  });
  assert.equal(friendActions.friendshipStatus, 'friend');
  assert.equal(friendActions.isFriend, true);
  assert.equal(friendActions.canAddFriend, false);

  // Pending request & follow-only
  const pendingGraph = addPendingOutgoingFriendRequest(
    addFollowingEntry(DEFAULT_PLAYER_SOCIAL_GRAPH, { id: 'alice.near', name: 'Alice' }),
    { id: 'alice.near', name: 'Alice' },
  );
  const pendingActions = resolveProfileDockActions({
    user: ALICE,
    socialGraph: pendingGraph,
    privacySettings: DEFAULT_PLAYER_PRIVACY_SETTINGS,
  });
  assert.equal(pendingActions.friendshipStatus, 'pending');
  assert.equal(pendingActions.isFollowing, true);

  // Blocked by local player -> zero actions offered
  const blockedPrivacy = {
    ...DEFAULT_PLAYER_PRIVACY_SETTINGS,
    blockedPlayers: [
      { id: 'alice.near', name: 'Alice', blockedAtIso: '2026-11-26T00:00:00.000Z' },
    ],
  };
  const blockedActions = resolveProfileDockActions({
    user: ALICE,
    socialGraph: DEFAULT_PLAYER_SOCIAL_GRAPH,
    privacySettings: blockedPrivacy,
  });
  assert.equal(blockedActions.isBlocked, true);
  assert.equal(blockedActions.canAddFriend, false);
  assert.equal(blockedActions.canFollow, false);
  assert.equal(blockedActions.canWhisper, false);
  assert.equal(blockedActions.canViewProfile, false);

  // Blocked by target -> zero actions offered
  const blockedByTargetActions = resolveProfileDockActions({
    user: ALICE,
    socialGraph: DEFAULT_PLAYER_SOCIAL_GRAPH,
    privacySettings: DEFAULT_PLAYER_PRIVACY_SETTINGS,
    blockedByTarget: true,
  });
  assert.equal(blockedByTargetActions.isBlocked, true);
  assert.equal(blockedByTargetActions.canWhisper, false);
  assert.equal(blockedByTargetActions.canViewProfile, false);
});
