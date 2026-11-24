import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addFollowingEntry,
  addFriendEntry,
  addPendingOutgoingFriendRequest,
  canShowAddFriendAction,
  DEFAULT_PLAYER_SOCIAL_GRAPH,
  encodeSocialGraphToSkinsTags,
  hasPendingOutgoingFriendRequest,
  isFollowingPlayer,
  isFriendWith,
  parseSocialGraphFromSkinsTags,
  readStoredSocialGraph,
  reconcileAcceptedFriendLetters,
  reconcileMutualFriendsFromRemoteProfiles,
  removeFollowingEntry,
  removeFriendEntry,
  writeStoredSocialGraph,
} from './buddiesSocialGraph';

describe('buddiesSocialGraph', () => {
  it('keeps friends and following as separate relationships', () => {
    let graph = DEFAULT_PLAYER_SOCIAL_GRAPH;
    graph = addFollowingEntry(graph, { id: 'maya.testnet', name: 'Maya', buildingProject: 'Soundscape' });
    assert.equal(isFollowingPlayer(graph, 'maya.testnet'), true);
    assert.equal(isFriendWith(graph, 'maya.testnet'), false);

    graph = addPendingOutgoingFriendRequest(graph, { id: 'ren.testnet', name: 'Ren' });
    assert.equal(hasPendingOutgoingFriendRequest(graph, 'ren.testnet'), true);
    assert.equal(isFriendWith(graph, 'ren.testnet'), false);

    // Confirming friendship moves Ren from pending to friends without affecting follow
    graph = addFriendEntry(graph, { id: 'ren.testnet', name: 'Ren' });
    assert.equal(isFriendWith(graph, 'ren.testnet'), true);
    assert.equal(hasPendingOutgoingFriendRequest(graph, 'ren.testnet'), false);
    assert.equal(isFollowingPlayer(graph, 'ren.testnet'), false);

    graph = removeFollowingEntry(graph, 'maya.testnet');
    assert.equal(isFollowingPlayer(graph, 'maya.testnet'), false);
    assert.equal(isFriendWith(graph, 'ren.testnet'), true);

    graph = removeFriendEntry(graph, 'ren.testnet');
    assert.equal(isFriendWith(graph, 'ren.testnet'), false);
  });

  it('hides the Add Friend button completely when allowFriendRequests is false', () => {
    assert.equal(
      canShowAddFriendAction({
        isSelf: false,
        isNpc: false,
        isBlocked: false,
        isFriend: false,
        allowFriendRequests: true,
      }),
      true,
    );
    assert.equal(
      canShowAddFriendAction({
        isSelf: false,
        isNpc: false,
        isBlocked: false,
        isFriend: false,
        allowFriendRequests: false,
      }),
      false,
    );
    assert.equal(
      canShowAddFriendAction({
        isSelf: false,
        isNpc: false,
        isBlocked: false,
        isFriend: true,
        allowFriendRequests: true,
      }),
      false,
    );
    assert.equal(
      canShowAddFriendAction({
        isSelf: false,
        isNpc: false,
        isBlocked: true,
        isFriend: false,
        allowFriendRequests: true,
      }),
      false,
    );
  });

  it('round-trips friends, following, and pending requests through unlocked_skins tags', () => {
    let graph = DEFAULT_PLAYER_SOCIAL_GRAPH;
    graph = addFriendEntry(graph, { id: 'alice.testnet', name: 'Alice' });
    graph = addFollowingEntry(graph, { id: 'bob.testnet', name: 'Bob Builder' });
    graph = addPendingOutgoingFriendRequest(graph, { id: 'cara.testnet', name: 'Cara' });

    const tags = encodeSocialGraphToSkinsTags(graph);
    const parsed = parseSocialGraphFromSkinsTags(['default', 'gender:male', ...tags]);

    assert.deepEqual(parsed.friends, [{ id: 'alice.testnet', name: 'Alice' }]);
    assert.deepEqual(parsed.following, [{ id: 'bob.testnet', name: 'Bob Builder' }]);
    assert.deepEqual(parsed.pendingOutgoingFriendRequests, [{ id: 'cara.testnet', name: 'Cara' }]);
  });

  it('reconciles mutual friendship from acceptance confirmation letters', () => {
    let graph = addPendingOutgoingFriendRequest(DEFAULT_PLAYER_SOCIAL_GRAPH, {
      id: 'hana.testnet',
      name: 'Hana',
    });

    const { nextGraph, newlyAddedFriends } = reconcileAcceptedFriendLetters(graph, [
      {
        kind: 'message',
        decisionState: null,
        payload: {
          senderAccount: 'hana.testnet',
          senderName: 'Hana',
          friendAcceptedByAccount: 'hana.testnet',
          friendAcceptedByName: 'Hana',
          body: 'Hana accepted your friend request.',
        },
      },
    ]);

    assert.equal(newlyAddedFriends.length, 1);
    assert.equal(newlyAddedFriends[0].id, 'hana.testnet');
    assert.equal(isFriendWith(nextGraph, 'hana.testnet'), true);
    assert.equal(hasPendingOutgoingFriendRequest(nextGraph, 'hana.testnet'), false);
  });

  it('reconciles mutual friendship when remote profile tags already list local player', () => {
    const graph = addPendingOutgoingFriendRequest(DEFAULT_PLAYER_SOCIAL_GRAPH, {
      id: 'kai.testnet',
      name: 'Kai',
    });

    const { nextGraph, newlyAddedFriends } = reconcileMutualFriendsFromRemoteProfiles(
      graph,
      'me.testnet',
      [
        {
          nearAccountId: 'kai.testnet',
          displayName: 'Kai',
          friendIds: ['me.testnet'],
        },
      ],
    );

    assert.equal(newlyAddedFriends.length, 1);
    assert.equal(isFriendWith(nextGraph, 'kai.testnet'), true);
    assert.equal(hasPendingOutgoingFriendRequest(nextGraph, 'kai.testnet'), false);
  });

  it('persists and restores social graph in localStorage', () => {
    const store = new Map<string, string>();
    const fakeStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };

    const initial = addFollowingEntry(
      addFriendEntry(DEFAULT_PLAYER_SOCIAL_GRAPH, { id: 'sam.testnet', name: 'Sam' }),
      { id: 'leo.testnet', name: 'Leo' },
    );
    writeStoredSocialGraph(initial, fakeStorage);
    const restored = readStoredSocialGraph(fakeStorage);
    assert.equal(isFriendWith(restored, 'sam.testnet'), true);
    assert.equal(isFollowingPlayer(restored, 'leo.testnet'), true);
  });
});
