import assert from 'node:assert/strict';
import test from 'node:test';
import type { NearbyEntityUser } from '../components/SocialChatModal';
import { resolveBottomChatInputTarget } from './chatInputTargetResolver';

const HUMAN_USER: NearbyEntityUser = {
  id: 'player_alice_123',
  name: 'Alice',
  distance: 3,
  isNpc: false,
  isSelf: false,
  nearAccountId: 'alice.near',
};

const NPC_USER: NearbyEntityUser = {
  id: 'city_plaza_nadia',
  name: 'Nadia',
  distance: 2,
  isNpc: true,
  isSelf: false,
};

test('WS15 resolver state matrix: no foreground session -> world public chat with slash emotes', () => {
  const target = resolveBottomChatInputTarget({
    isMerchantNpcChatOpen: false,
    isCitizenNpcChatOpen: false,
    isPrivateChatSurfaceOpen: false,
    selectedPrivateUser: null,
  });

  assert.equal(target.kind, 'world');
  assert.equal(target.routeAttr, 'social_world');
  assert.equal(target.placeholder, 'Say something or /wave, /dance...');
  assert.equal(target.allowSlashEmotes, true);
  assert.equal(target.maxLength, 64);
});

test('WS15 resolver state matrix: private chat open with no user selected -> world public chat', () => {
  const target = resolveBottomChatInputTarget({
    isMerchantNpcChatOpen: false,
    isCitizenNpcChatOpen: false,
    isPrivateChatSurfaceOpen: true,
    selectedPrivateUser: null,
  });

  assert.equal(target.kind, 'world');
  assert.equal(target.routeAttr, 'social_world');
  assert.equal(target.placeholder, 'Say something or /wave, /dance...');
  assert.equal(target.allowSlashEmotes, true);
});

test('WS15 resolver state matrix: private chat open with human user selected -> private whisper target & matching placeholder', () => {
  const target = resolveBottomChatInputTarget({
    isMerchantNpcChatOpen: false,
    isCitizenNpcChatOpen: false,
    isPrivateChatSurfaceOpen: true,
    selectedPrivateUser: HUMAN_USER,
  });

  assert.equal(target.kind, 'private');
  assert.equal(target.routeAttr, 'private_chat');
  assert.equal(target.recipient.id, HUMAN_USER.id);
  assert.equal(target.placeholder, 'Whisper @Alice...');
  assert.equal(target.allowSlashEmotes, false);
});

test('WS15 resolver state matrix: private chat closed even with stale selectedPrivateUser -> world public chat', () => {
  const target = resolveBottomChatInputTarget({
    isMerchantNpcChatOpen: false,
    isCitizenNpcChatOpen: false,
    isPrivateChatSurfaceOpen: false,
    selectedPrivateUser: HUMAN_USER,
  });

  assert.equal(target.kind, 'world');
  assert.equal(target.routeAttr, 'social_world');
  assert.equal(target.allowSlashEmotes, true);
});

test('WS15 resolver state matrix: private chat open with NPC in selectedPrivateUser -> never whispers NPC, falls back to world', () => {
  const target = resolveBottomChatInputTarget({
    isMerchantNpcChatOpen: false,
    isCitizenNpcChatOpen: false,
    isPrivateChatSurfaceOpen: true,
    selectedPrivateUser: NPC_USER,
  });

  assert.equal(target.kind, 'world');
  assert.equal(target.routeAttr, 'social_world');
});

test('WS15 resolver state matrix: merchant NPC chat overrides private chat surface', () => {
  const target = resolveBottomChatInputTarget({
    isMerchantNpcChatOpen: true,
    isCitizenNpcChatOpen: false,
    activeNpcName: 'Hana',
    activeNpcBadgeLabel: 'HANA',
    isPrivateChatSurfaceOpen: true,
    selectedPrivateUser: HUMAN_USER,
  });

  assert.equal(target.kind, 'npc');
  assert.equal(target.channel, 'npc_merchant');
  assert.equal(target.routeAttr, 'npc_merchant');
  assert.equal(target.placeholder, 'Ask Hana anything...');
  assert.equal(target.allowSlashEmotes, false);
  assert.equal(target.maxLength, 220);
});

test('WS15 resolver state matrix: citizen NPC dialogue overrides private chat surface', () => {
  const target = resolveBottomChatInputTarget({
    isMerchantNpcChatOpen: false,
    isCitizenNpcChatOpen: true,
    activeNpcName: 'Nadia',
    activeNpcBadgeLabel: 'NADIA',
    isPrivateChatSurfaceOpen: true,
    selectedPrivateUser: HUMAN_USER,
  });

  assert.equal(target.kind, 'npc');
  assert.equal(target.channel, 'citizen_dialogue');
  assert.equal(target.routeAttr, 'citizen_dialogue');
  assert.equal(target.placeholder, 'Chat with Nadia...');
  assert.equal(target.allowSlashEmotes, false);
  assert.equal(target.maxLength, 220);
});
