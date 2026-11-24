import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addBlockedPlayer,
  APARTMENT_VISIT_PERMISSION_OPTIONS,
  canPlayerVisitApartment,
  canReceivePrivateMessageFrom,
  canSendPrivateMessageTo,
  DEFAULT_PLAYER_PRIVACY_SETTINGS,
  encodePrivacySettingsToSkinsTags,
  isPlayerBlocked,
  mapApartmentVisitPermissionToSafezoneMode,
  parsePrivacySettingsFromSkinsTags,
  PRIVATE_MESSAGE_PERMISSION_OPTIONS,
  readStoredPrivacySettings,
  removeBlockedPlayer,
  writeStoredPrivacySettings,
} from './buddiesPrivacySettings';

describe('buddiesPrivacySettings', () => {
  it('uses expected defaults (hideBalances on, showThingsOnProfile on, appearOnline on, allowFriendRequests on)', () => {
    assert.equal(DEFAULT_PLAYER_PRIVACY_SETTINGS.privateMessages, 'everyone');
    assert.equal(DEFAULT_PLAYER_PRIVACY_SETTINGS.apartmentVisits, 'everyone');
    assert.equal(DEFAULT_PLAYER_PRIVACY_SETTINGS.allowFriendRequests, true);
    assert.equal(DEFAULT_PLAYER_PRIVACY_SETTINGS.appearOnline, true);
    assert.equal(DEFAULT_PLAYER_PRIVACY_SETTINGS.hideBalances, true);
    assert.equal(DEFAULT_PLAYER_PRIVACY_SETTINGS.showWalletAddressOnProfile, true);
    assert.equal(DEFAULT_PLAYER_PRIVACY_SETTINGS.showThingsOnProfile, true);
    assert.deepEqual(DEFAULT_PLAYER_PRIVACY_SETTINGS.blockedPlayers, []);
    assert.deepEqual(
      PRIVATE_MESSAGE_PERMISSION_OPTIONS.map((o) => o.id),
      ['everyone', 'friends_only', 'no_one'],
    );
    assert.deepEqual(
      APARTMENT_VISIT_PERMISSION_OPTIONS.map((o) => o.id),
      ['everyone', 'friends', 'only_me'],
    );
  });

  it('round-trips privacy settings through unlocked_skins tags without schema changes', () => {
    const custom = {
      privateMessages: 'friends_only' as const,
      apartmentVisits: 'friends' as const,
      allowFriendRequests: false,
      appearOnline: false,
      hideBalances: false,
      showWalletAddressOnProfile: false,
      showThingsOnProfile: false,
      blockedPlayers: [
        { id: 'spammer.testnet', name: 'Spammer' },
        { id: 'peer-2', name: 'Guest Two' },
      ],
    };

    const tags = encodePrivacySettingsToSkinsTags(custom);
    const parsed = parsePrivacySettingsFromSkinsTags(['default', 'gender:female', ...tags]);
    assert.deepEqual(parsed, custom);
  });

  it('enforces private message receiving, sending, and blocking rules', () => {
    const blocked = addBlockedPlayer(DEFAULT_PLAYER_PRIVACY_SETTINGS, {
      id: 'troll.testnet',
      name: 'Troll',
    });

    assert.equal(isPlayerBlocked(blocked.blockedPlayers, 'troll.testnet', 'Troll'), true);
    assert.equal(
      canReceivePrivateMessageFrom({
        localSettings: blocked,
        senderId: 'troll.testnet',
        senderName: 'Troll',
      }).allowed,
      false,
    );
    assert.equal(
      canSendPrivateMessageTo({
        localSettings: blocked,
        recipientId: 'troll.testnet',
        recipientName: 'Troll',
      }).allowed,
      false,
    );

    const unblocked = removeBlockedPlayer(blocked, 'troll.testnet');
    assert.equal(isPlayerBlocked(unblocked.blockedPlayers, 'troll.testnet', 'Troll'), false);
    assert.equal(
      canReceivePrivateMessageFrom({
        localSettings: unblocked,
        senderId: 'troll.testnet',
        senderName: 'Troll',
      }).allowed,
      true,
    );

    const noOnePm = { ...DEFAULT_PLAYER_PRIVACY_SETTINGS, privateMessages: 'no_one' as const };
    assert.equal(
      canReceivePrivateMessageFrom({
        localSettings: noOnePm,
        senderId: 'alice.testnet',
        senderName: 'Alice',
      }).allowed,
      false,
    );
    assert.equal(
      canSendPrivateMessageTo({
        localSettings: DEFAULT_PLAYER_PRIVACY_SETTINGS,
        recipientId: 'alice.testnet',
        recipientName: 'Alice',
        recipientPrivateMessages: 'no_one',
      }).allowed,
      false,
    );

    const friendsOnlyPm = {
      ...DEFAULT_PLAYER_PRIVACY_SETTINGS,
      privateMessages: 'friends_only' as const,
    };
    assert.equal(
      canReceivePrivateMessageFrom({
        localSettings: friendsOnlyPm,
        senderId: 'stranger.testnet',
        senderName: 'Stranger',
        isFriend: false,
      }).allowed,
      false,
    );
    assert.equal(
      canReceivePrivateMessageFrom({
        localSettings: friendsOnlyPm,
        senderId: 'buddy.testnet',
        senderName: 'Buddy',
        isFriend: true,
      }).allowed,
      true,
    );
    assert.equal(
      canSendPrivateMessageTo({
        localSettings: DEFAULT_PLAYER_PRIVACY_SETTINGS,
        recipientId: 'alice.testnet',
        recipientName: 'Alice',
        recipientPrivateMessages: 'friends_only',
        isFriend: false,
      }).reason,
      'recipient_friends_only',
    );
    assert.equal(
      canSendPrivateMessageTo({
        localSettings: DEFAULT_PLAYER_PRIVACY_SETTINGS,
        recipientId: 'alice.testnet',
        recipientName: 'Alice',
        recipientPrivateMessages: 'friends_only',
        isFriend: true,
      }).allowed,
      true,
    );
  });

  it('enforces apartment visit permissions and blocks blocked players', () => {
    const withBlock = addBlockedPlayer(DEFAULT_PLAYER_PRIVACY_SETTINGS, {
      id: 'bad.testnet',
      name: 'Bad',
    });
    assert.equal(
      canPlayerVisitApartment({
        ownerSettings: withBlock,
        isOwner: false,
        visitorId: 'bad.testnet',
        visitorName: 'Bad',
      }),
      false,
    );
    assert.equal(
      canPlayerVisitApartment({
        ownerSettings: withBlock,
        isOwner: false,
        visitorId: 'good.testnet',
        visitorName: 'Good',
      }),
      true,
    );

    const friendsApt = { ...DEFAULT_PLAYER_PRIVACY_SETTINGS, apartmentVisits: 'friends' as const };
    assert.equal(
      canPlayerVisitApartment({
        ownerSettings: friendsApt,
        isOwner: false,
        visitorId: 'stranger.testnet',
        isFriend: false,
      }),
      false,
    );
    assert.equal(
      canPlayerVisitApartment({
        ownerSettings: friendsApt,
        isOwner: false,
        visitorId: 'buddy.testnet',
        isFriend: true,
      }),
      true,
    );
    assert.equal(mapApartmentVisitPermissionToSafezoneMode('everyone'), 'PUBLIC');
    assert.equal(mapApartmentVisitPermissionToSafezoneMode('friends'), 'FRIENDS_ONLY');
    assert.equal(mapApartmentVisitPermissionToSafezoneMode('only_me'), 'PRIVATE');

    const onlyMe = { ...DEFAULT_PLAYER_PRIVACY_SETTINGS, apartmentVisits: 'only_me' as const };
    assert.equal(
      canPlayerVisitApartment({
        ownerSettings: onlyMe,
        isOwner: false,
        visitorId: 'good.testnet',
      }),
      false,
    );
    assert.equal(
      canPlayerVisitApartment({
        ownerSettings: onlyMe,
        isOwner: true,
        visitorId: 'owner.testnet',
      }),
      true,
    );
  });

  it('persists and restores privacy settings in localStorage', () => {
    const store = new Map<string, string>();
    const fakeStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };

    const written = writeStoredPrivacySettings(
      { ...DEFAULT_PLAYER_PRIVACY_SETTINGS, appearOnline: false, hideBalances: false },
      fakeStorage,
    );
    assert.equal(written.appearOnline, false);
    assert.equal(written.hideBalances, false);

    const restored = readStoredPrivacySettings(fakeStorage);
    assert.equal(restored.appearOnline, false);
    assert.equal(restored.hideBalances, false);
    assert.equal(restored.showThingsOnProfile, true);
  });
});
