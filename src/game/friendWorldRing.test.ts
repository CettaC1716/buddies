import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addFollowingEntry,
  addFriendEntry,
  addPendingOutgoingFriendRequest,
  DEFAULT_PLAYER_SOCIAL_GRAPH,
  removeFriendEntry,
} from './buddiesSocialGraph';
import {
  FRIEND_WORLD_RING_COLOR_HEX,
  resolveRemoteAvatarFriendRing,
} from './friendWorldRing';

test('WS16 friend ring: mutual friend gets blue radial ring, disappears live when removed', () => {
  const empty = DEFAULT_PLAYER_SOCIAL_GRAPH;
  const withFriend = addFriendEntry(empty, {
    id: 'alice.near',
    name: 'Alice',
  });

  const friendRing = resolveRemoteAvatarFriendRing({
    isLocalPlayer: false,
    socialGraph: withFriend,
    peerNearAccountId: 'alice.near',
    peerSessionId: 'sess_alice',
    peerDisplayName: 'Alice',
  });
  assert.equal(friendRing.visible, true);
  assert.equal(friendRing.colorHex, FRIEND_WORLD_RING_COLOR_HEX);

  // Removing friend clears the ring immediately without reconnect
  const afterRemove = removeFriendEntry(withFriend, 'alice.near');
  const removedRing = resolveRemoteAvatarFriendRing({
    isLocalPlayer: false,
    socialGraph: afterRemove,
    peerNearAccountId: 'alice.near',
    peerSessionId: 'sess_alice',
    peerDisplayName: 'Alice',
  });
  assert.equal(removedRing.visible, false);
  assert.equal(removedRing.colorHex, null);
});

test('WS16 friend ring: one-way follow and pending friend request are NOT marked', () => {
  const empty = DEFAULT_PLAYER_SOCIAL_GRAPH;
  const withFollowOnly = addFollowingEntry(empty, {
    id: 'bob.near',
    name: 'Bob',
  });
  const withPendingOnly = addPendingOutgoingFriendRequest(withFollowOnly, {
    id: 'carol.near',
    name: 'Carol',
  });

  const followDecision = resolveRemoteAvatarFriendRing({
    isLocalPlayer: false,
    socialGraph: withPendingOnly,
    peerNearAccountId: 'bob.near',
    peerDisplayName: 'Bob',
  });
  assert.equal(followDecision.visible, false);
  assert.equal(followDecision.colorHex, null);

  const pendingDecision = resolveRemoteAvatarFriendRing({
    isLocalPlayer: false,
    socialGraph: withPendingOnly,
    peerNearAccountId: 'carol.near',
    peerDisplayName: 'Carol',
  });
  assert.equal(pendingDecision.visible, false);
  assert.equal(pendingDecision.colorHex, null);
});

test('WS16 friend ring: stranger gets no ring and local player avatar is never ringed', () => {
  const graph = addFriendEntry(DEFAULT_PLAYER_SOCIAL_GRAPH, {
    id: 'self.near',
    name: 'SelfPlayer',
  });

  const strangerDecision = resolveRemoteAvatarFriendRing({
    isLocalPlayer: false,
    socialGraph: graph,
    peerNearAccountId: 'stranger.near',
    peerDisplayName: 'Stranger',
  });
  assert.equal(strangerDecision.visible, false);
  assert.equal(strangerDecision.colorHex, null);

  // Even if local player's own id were in graph, local avatar is NEVER ringed
  const localDecision = resolveRemoteAvatarFriendRing({
    isLocalPlayer: true,
    socialGraph: graph,
    peerNearAccountId: 'self.near',
    peerDisplayName: 'SelfPlayer',
  });
  assert.equal(localDecision.visible, false);
  assert.equal(localDecision.colorHex, null);
});
