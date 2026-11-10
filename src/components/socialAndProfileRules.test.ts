import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterRealHumanOnlinePlayers,
  isRealHumanWhisperTarget,
  isOwnChatMessage,
  deduplicateChatMessages,
  shouldTriggerIncomingPrivateChatNotification,
  ChatMessage,
  NearbyEntityUser,
} from './SocialChatModal';
import { getPhotoCropClassName, PROFILE_PHOTO_PRESETS } from './CharacterProfileModal';

describe('SocialChatModal & CharacterProfileModal pure rules', () => {
  it('excludes NPCs (Hana, Kai, npc_* ids) and self from ONLINE LIST and PRIVATE whisper targets', () => {
    const sampleEntities: NearbyEntityUser[] = [
      { id: 0, name: 'Buddy Male (YOU)', distance: 0, isSelf: true, isNpc: false },
      { id: 'npc_lobby', name: 'HANA — Lobby Exchange', distance: 4, isNpc: true },
      { id: 'npc_kai', name: 'KAI — Fish Market', distance: 12, isNpc: true },
      { id: 'peer_fake_hana', name: 'Hana', distance: 5, isNpc: false },
      { id: 'peer_real_1', name: 'AlexRunner', distance: 8, isNpc: false, isSelf: false },
      { id: 'peer_real_2', name: 'Buddy Male', distance: 2, isNpc: false, isSelf: false },
    ];

    const filtered = filterRealHumanOnlinePlayers(sampleEntities, 'Buddy Male', 'buddy.testnet');
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, 'peer_real_1');
    assert.equal(filtered[0].name, 'AlexRunner');

    assert.equal(
      isRealHumanWhisperTarget(sampleEntities[1], 'Buddy Male', 'buddy.testnet'),
      false,
    );
    assert.equal(
      isRealHumanWhisperTarget(sampleEntities[4], 'Buddy Male', 'buddy.testnet'),
      true,
    );
  });

  it('recognizes own messages across Guest mode and connected wallet sessions', () => {
    const guestSelfMsg: ChatMessage = {
      id: 'db-uuid-101',
      senderName: 'Buddy Male',
      recipientName: 'AlexRunner',
      text: 'Hello there!',
      timestamp: '10:15 AM',
      type: 'private',
    };

    assert.equal(isOwnChatMessage(guestSelfMsg, 'Buddy Male', ''), true);
    assert.equal(isOwnChatMessage(guestSelfMsg, 'OtherPlayer', 'buddy.testnet'), false);

    const walletSelfMsg: ChatMessage = {
      id: 'db-uuid-102',
      senderId: 'commander.testnet',
      senderName: 'OldName',
      text: 'GG!',
      timestamp: '10:16 AM',
      type: 'public',
    };

    assert.equal(isOwnChatMessage(walletSelfMsg, 'NewName', 'commander.testnet'), true);
  });

  it('deduplicates optimistic local whisper/public messages against echoed realtime rows', () => {
    const messages: ChatMessage[] = [
      {
        id: 'priv-1731234567890-abc',
        senderName: 'Buddy Male',
        recipientName: 'AlexRunner',
        isSelf: true,
        text: 'Want to team up?',
        timestamp: '10:20 AM',
        type: 'private',
      },
      {
        // Echoed back from Supabase Realtime with DB UUID and without explicit isSelf flag
        id: '550e8400-e29b-41d4-a716-446655440000',
        senderName: 'Buddy Male',
        recipientName: 'AlexRunner',
        text: 'Want to team up?',
        timestamp: '10:20 AM',
        type: 'private',
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        senderName: 'AlexRunner',
        recipientName: 'Buddy Male',
        text: 'Sure, let us go!',
        timestamp: '10:21 AM',
        type: 'private',
      },
    ];

    const deduped = deduplicateChatMessages(messages, 'Buddy Male', '');
    assert.equal(deduped.length, 2);
    assert.equal(deduped[0].isSelf, true);
    assert.equal(deduped[0].text, 'Want to team up?');
    assert.equal(deduped[1].isSelf, false);
    assert.equal(deduped[1].text, 'Sure, let us go!');
  });

  it('applies viewport-debug-hiding crop classes to default character portraits', () => {
    const hiroCrop = getPhotoCropClassName('/assets/avatar_hiro.jpg');
    assert.ok(hiroCrop.includes('scale-[1.34]'));
    assert.ok(PROFILE_PHOTO_PRESETS.length >= 6);
  });

  it('triggers incoming chat notifications strictly for PRIVATE messages from other real players when their thread is not open', () => {
    const incomingWhisper: ChatMessage = {
      id: 'priv-msg-1',
      senderId: 'alex.testnet',
      senderName: 'AlexRunner',
      recipientName: 'Buddy Male',
      text: 'Meet at Central Plaza!',
      timestamp: '10:25 AM',
      type: 'private',
    };

    // 1. Triggers when modal is closed
    assert.equal(
      shouldTriggerIncomingPrivateChatNotification({
        message: incomingWhisper,
        localPlayerName: 'Buddy Male',
        localPlayerUid: 'buddy.testnet',
        isSocialChatModalOpen: false,
        activeTab: 'public',
        selectedPrivateUser: null,
      }),
      true,
    );

    // 2. Does NOT trigger when that exact sender's private thread is actively open on screen
    assert.equal(
      shouldTriggerIncomingPrivateChatNotification({
        message: incomingWhisper,
        localPlayerName: 'Buddy Male',
        localPlayerUid: 'buddy.testnet',
        isSocialChatModalOpen: true,
        activeTab: 'private',
        selectedPrivateUser: {
          id: 'alex.testnet',
          nearAccountId: 'alex.testnet',
          name: 'AlexRunner',
          distance: 5,
        },
      }),
      false,
    );

    // 3. NEVER triggers for PUBLIC chat messages
    const publicMsg: ChatMessage = {
      id: 'pub-msg-1',
      senderId: 'alex.testnet',
      senderName: 'AlexRunner',
      text: 'Hello everyone!',
      timestamp: '10:26 AM',
      type: 'public',
    };
    assert.equal(
      shouldTriggerIncomingPrivateChatNotification({
        message: publicMsg,
        localPlayerName: 'Buddy Male',
        localPlayerUid: 'buddy.testnet',
        isSocialChatModalOpen: false,
        activeTab: 'public',
        selectedPrivateUser: null,
      }),
      false,
    );

    // 4. NEVER triggers for local player's own outgoing messages or messages addressed to someone else
    const ownWhisper: ChatMessage = {
      ...incomingWhisper,
      id: 'priv-self-1',
      senderId: 'buddy.testnet',
      senderName: 'Buddy Male',
      recipientName: 'AlexRunner',
      isSelf: true,
    };
    assert.equal(
      shouldTriggerIncomingPrivateChatNotification({
        message: ownWhisper,
        localPlayerName: 'Buddy Male',
        localPlayerUid: 'buddy.testnet',
        isSocialChatModalOpen: false,
        activeTab: 'public',
        selectedPrivateUser: null,
      }),
      false,
    );
  });
});

