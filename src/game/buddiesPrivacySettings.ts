export type PrivateMessagePermission = 'everyone' | 'friends_only' | 'no_one';

export type ApartmentVisitPermission = 'everyone' | 'friends' | 'only_me';

export interface BlockedPlayerEntry {
  id: string;
  name: string;
}

export interface PlayerPrivacySettings {
  privateMessages: PrivateMessagePermission;
  apartmentVisits: ApartmentVisitPermission;
  allowFriendRequests: boolean;
  appearOnline: boolean;
  hideBalances: boolean;
  showWalletAddressOnProfile: boolean;
  showThingsOnProfile: boolean;
  blockedPlayers: BlockedPlayerEntry[];
}

export const PRIVATE_MESSAGE_PERMISSION_OPTIONS: ReadonlyArray<{
  id: PrivateMessagePermission;
  label: string;
}> = [
  { id: 'everyone', label: 'Everyone' },
  { id: 'friends_only', label: 'Friends only' },
  { id: 'no_one', label: 'No one' },
] as const;

export const APARTMENT_VISIT_PERMISSION_OPTIONS: ReadonlyArray<{
  id: ApartmentVisitPermission;
  label: string;
}> = [
  { id: 'everyone', label: 'Everyone' },
  { id: 'friends', label: 'Friends' },
  { id: 'only_me', label: 'Only me' },
] as const;

export const DEFAULT_PLAYER_PRIVACY_SETTINGS: PlayerPrivacySettings = {
  privateMessages: 'everyone',
  apartmentVisits: 'everyone',
  allowFriendRequests: true,
  appearOnline: true,
  hideBalances: true,
  showWalletAddressOnProfile: true,
  showThingsOnProfile: true,
  blockedPlayers: [],
};

export const PRIVACY_SETTINGS_STORAGE_KEY = 'bb_player_privacy_settings_v1';
export const PRIVACY_SETTINGS_UPDATED_EVENT = 'bb-privacy-settings-updated';

const MAX_BLOCKED_PLAYERS = 50;

const VALID_PM_PERMISSIONS = new Set<string>(
  PRIVATE_MESSAGE_PERMISSION_OPTIONS.map((o) => o.id),
);
const VALID_APT_PERMISSIONS = new Set<string>(
  APARTMENT_VISIT_PERMISSION_OPTIONS.map((o) => o.id),
);

export function isPrivateMessagePermission(value: unknown): value is PrivateMessagePermission {
  return typeof value === 'string' && VALID_PM_PERMISSIONS.has(value);
}

export function isApartmentVisitPermission(value: unknown): value is ApartmentVisitPermission {
  return typeof value === 'string' && VALID_APT_PERMISSIONS.has(value);
}

export function normalizePlayerPrivacyKey(raw: string | number | null | undefined): string {
  return String(raw ?? '')
    .replace(/\s*\((ANDA|YOU|KAMU)\)/gi, '')
    .trim()
    .toLowerCase();
}

export function sanitizeBlockedPlayers(
  raw: ReadonlyArray<Partial<BlockedPlayerEntry>> | null | undefined,
): BlockedPlayerEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const clean: BlockedPlayerEntry[] = [];
  for (const item of raw) {
    if (!item) continue;
    const id = normalizePlayerPrivacyKey(item.id || item.name);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const name =
      typeof item.name === 'string' && item.name.trim()
        ? item.name.replace(/[<>]/g, '').trim().slice(0, 48)
        : id;
    clean.push({ id, name });
    if (clean.length >= MAX_BLOCKED_PLAYERS) break;
  }
  return clean;
}

export function sanitizePlayerPrivacySettings(
  raw: Partial<PlayerPrivacySettings> | null | undefined,
): PlayerPrivacySettings {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_PLAYER_PRIVACY_SETTINGS,
      blockedPlayers: [],
    };
  }
  return {
    privateMessages: isPrivateMessagePermission(raw.privateMessages)
      ? raw.privateMessages
      : DEFAULT_PLAYER_PRIVACY_SETTINGS.privateMessages,
    apartmentVisits: isApartmentVisitPermission(raw.apartmentVisits)
      ? raw.apartmentVisits
      : DEFAULT_PLAYER_PRIVACY_SETTINGS.apartmentVisits,
    allowFriendRequests:
      typeof raw.allowFriendRequests === 'boolean'
        ? raw.allowFriendRequests
        : DEFAULT_PLAYER_PRIVACY_SETTINGS.allowFriendRequests,
    appearOnline:
      typeof raw.appearOnline === 'boolean'
        ? raw.appearOnline
        : DEFAULT_PLAYER_PRIVACY_SETTINGS.appearOnline,
    hideBalances:
      typeof raw.hideBalances === 'boolean'
        ? raw.hideBalances
        : DEFAULT_PLAYER_PRIVACY_SETTINGS.hideBalances,
    showWalletAddressOnProfile:
      typeof raw.showWalletAddressOnProfile === 'boolean'
        ? raw.showWalletAddressOnProfile
        : DEFAULT_PLAYER_PRIVACY_SETTINGS.showWalletAddressOnProfile,
    showThingsOnProfile:
      typeof raw.showThingsOnProfile === 'boolean'
        ? raw.showThingsOnProfile
        : DEFAULT_PLAYER_PRIVACY_SETTINGS.showThingsOnProfile,
    blockedPlayers: sanitizeBlockedPlayers(raw.blockedPlayers),
  };
}

export function isPlayerBlocked(
  blockedPlayers: ReadonlyArray<BlockedPlayerEntry> | null | undefined,
  candidateId?: string | number | null,
  candidateName?: string | null,
): boolean {
  if (!Array.isArray(blockedPlayers) || blockedPlayers.length === 0) return false;
  const idKey = normalizePlayerPrivacyKey(candidateId);
  const nameKey = normalizePlayerPrivacyKey(candidateName);
  if (!idKey && !nameKey) return false;
  return blockedPlayers.some((entry) => {
    const entryId = normalizePlayerPrivacyKey(entry.id);
    const entryName = normalizePlayerPrivacyKey(entry.name);
    if (idKey && (entryId === idKey || entryName === idKey)) return true;
    if (nameKey && (entryId === nameKey || entryName === nameKey)) return true;
    return false;
  });
}

export function addBlockedPlayer(
  settings: PlayerPrivacySettings,
  target: { id?: string | number | null; name: string },
): PlayerPrivacySettings {
  const id = normalizePlayerPrivacyKey(target.id || target.name);
  if (!id) return settings;
  const name = target.name.replace(/\s*\((ANDA|YOU|KAMU)\)/gi, '').trim().slice(0, 48) || id;
  if (isPlayerBlocked(settings.blockedPlayers, id, name)) {
    return settings;
  }
  return sanitizePlayerPrivacySettings({
    ...settings,
    blockedPlayers: [...settings.blockedPlayers, { id, name }],
  });
}

export function removeBlockedPlayer(
  settings: PlayerPrivacySettings,
  targetIdOrName: string,
): PlayerPrivacySettings {
  const key = normalizePlayerPrivacyKey(targetIdOrName);
  if (!key) return settings;
  return sanitizePlayerPrivacySettings({
    ...settings,
    blockedPlayers: settings.blockedPlayers.filter(
      (entry) =>
        normalizePlayerPrivacyKey(entry.id) !== key &&
        normalizePlayerPrivacyKey(entry.name) !== key,
    ),
  });
}

export function canReceivePrivateMessageFrom(params: {
  localSettings: PlayerPrivacySettings;
  senderId?: string | number | null;
  senderName?: string | null;
  isFriend?: boolean;
}): { allowed: boolean; reason?: 'blocked' | 'disabled' | 'friends_only' } {
  if (isPlayerBlocked(params.localSettings.blockedPlayers, params.senderId, params.senderName)) {
    return { allowed: false, reason: 'blocked' };
  }
  switch (params.localSettings.privateMessages) {
    case 'no_one':
      return { allowed: false, reason: 'disabled' };
    case 'friends_only':
      if (!params.isFriend) {
        return { allowed: false, reason: 'friends_only' };
      }
      return { allowed: true };
    case 'everyone':
    default:
      return { allowed: true };
  }
}

export function canSendPrivateMessageTo(params: {
  localSettings: PlayerPrivacySettings;
  recipientId?: string | number | null;
  recipientName?: string | null;
  recipientPrivateMessages?: PrivateMessagePermission | null;
  isFriend?: boolean;
}): { allowed: boolean; reason?: 'blocked' | 'recipient_disabled' | 'recipient_friends_only' } {
  if (
    isPlayerBlocked(params.localSettings.blockedPlayers, params.recipientId, params.recipientName)
  ) {
    return { allowed: false, reason: 'blocked' };
  }
  if (params.recipientPrivateMessages === 'no_one') {
    return { allowed: false, reason: 'recipient_disabled' };
  }
  if (params.recipientPrivateMessages === 'friends_only' && !params.isFriend) {
    return { allowed: false, reason: 'recipient_friends_only' };
  }
  return { allowed: true };
}

export function canPlayerVisitApartment(params: {
  ownerSettings: PlayerPrivacySettings;
  isOwner: boolean;
  visitorId?: string | number | null;
  visitorName?: string | null;
  isFriend?: boolean;
}): boolean {
  if (params.isOwner) return true;
  if (isPlayerBlocked(params.ownerSettings.blockedPlayers, params.visitorId, params.visitorName)) {
    return false;
  }
  if (params.ownerSettings.apartmentVisits === 'everyone') return true;
  if (params.ownerSettings.apartmentVisits === 'friends') return Boolean(params.isFriend);
  return false;
}

export function mapApartmentVisitPermissionToSafezoneMode(
  permission: ApartmentVisitPermission,
): 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE' {
  if (permission === 'only_me') return 'PRIVATE';
  if (permission === 'friends') return 'FRIENDS_ONLY';
  return 'PUBLIC';
}

const SKIN_TAG_PREFIX_PM = 'priv_pm:';
const SKIN_TAG_PREFIX_APT = 'priv_apt:';
const SKIN_TAG_PREFIX_FRIEND_REQ = 'priv_friend_req:';
const SKIN_TAG_PREFIX_ONLINE = 'priv_online:';
const SKIN_TAG_PREFIX_HIDE_BAL = 'priv_hide_bal:';
const SKIN_TAG_PREFIX_SHOW_ADDR = 'priv_show_addr:';
const SKIN_TAG_PREFIX_SHOW_THINGS = 'priv_show_things:';
const SKIN_TAG_PREFIX_BLOCK = 'priv_block:';

export function encodePrivacySettingsToSkinsTags(settings: PlayerPrivacySettings): string[] {
  const clean = sanitizePlayerPrivacySettings(settings);
  const tags: string[] = [
    `${SKIN_TAG_PREFIX_PM}${clean.privateMessages}`,
    `${SKIN_TAG_PREFIX_APT}${clean.apartmentVisits}`,
    `${SKIN_TAG_PREFIX_FRIEND_REQ}${clean.allowFriendRequests ? '1' : '0'}`,
    `${SKIN_TAG_PREFIX_ONLINE}${clean.appearOnline ? '1' : '0'}`,
    `${SKIN_TAG_PREFIX_HIDE_BAL}${clean.hideBalances ? '1' : '0'}`,
    `${SKIN_TAG_PREFIX_SHOW_ADDR}${clean.showWalletAddressOnProfile ? '1' : '0'}`,
    `${SKIN_TAG_PREFIX_SHOW_THINGS}${clean.showThingsOnProfile ? '1' : '0'}`,
  ];
  for (const entry of clean.blockedPlayers) {
    tags.push(
      `${SKIN_TAG_PREFIX_BLOCK}${encodeURIComponent(entry.id)}|${encodeURIComponent(entry.name)}`,
    );
  }
  return tags;
}

export function parsePrivacySettingsFromSkinsTags(
  skins: ReadonlyArray<string> | null | undefined,
): Partial<PlayerPrivacySettings> {
  if (!Array.isArray(skins) || skins.length === 0) return {};

  const result: Partial<PlayerPrivacySettings> = {};
  const blocked: BlockedPlayerEntry[] = [];
  let sawAnyPrivacyTag = false;

  const safeDecode = (val: string): string => {
    try {
      return decodeURIComponent(val);
    } catch {
      return val;
    }
  };

  for (const raw of skins) {
    if (typeof raw !== 'string') continue;
    if (raw.startsWith(SKIN_TAG_PREFIX_PM)) {
      const val = raw.slice(SKIN_TAG_PREFIX_PM.length);
      if (isPrivateMessagePermission(val)) {
        result.privateMessages = val;
        sawAnyPrivacyTag = true;
      }
    } else if (raw.startsWith(SKIN_TAG_PREFIX_APT)) {
      const val = raw.slice(SKIN_TAG_PREFIX_APT.length);
      if (isApartmentVisitPermission(val)) {
        result.apartmentVisits = val;
        sawAnyPrivacyTag = true;
      }
    } else if (raw.startsWith(SKIN_TAG_PREFIX_FRIEND_REQ)) {
      const val = raw.slice(SKIN_TAG_PREFIX_FRIEND_REQ.length);
      if (val === '0' || val === '1') {
        result.allowFriendRequests = val === '1';
        sawAnyPrivacyTag = true;
      }
    } else if (raw.startsWith(SKIN_TAG_PREFIX_ONLINE)) {
      const val = raw.slice(SKIN_TAG_PREFIX_ONLINE.length);
      if (val === '0' || val === '1') {
        result.appearOnline = val === '1';
        sawAnyPrivacyTag = true;
      }
    } else if (raw.startsWith(SKIN_TAG_PREFIX_HIDE_BAL)) {
      const val = raw.slice(SKIN_TAG_PREFIX_HIDE_BAL.length);
      if (val === '0' || val === '1') {
        result.hideBalances = val === '1';
        sawAnyPrivacyTag = true;
      }
    } else if (raw.startsWith(SKIN_TAG_PREFIX_SHOW_ADDR)) {
      const val = raw.slice(SKIN_TAG_PREFIX_SHOW_ADDR.length);
      if (val === '0' || val === '1') {
        result.showWalletAddressOnProfile = val === '1';
        sawAnyPrivacyTag = true;
      }
    } else if (raw.startsWith(SKIN_TAG_PREFIX_SHOW_THINGS)) {
      const val = raw.slice(SKIN_TAG_PREFIX_SHOW_THINGS.length);
      if (val === '0' || val === '1') {
        result.showThingsOnProfile = val === '1';
        sawAnyPrivacyTag = true;
      }
    } else if (raw.startsWith(SKIN_TAG_PREFIX_BLOCK)) {
      const body = raw.slice(SKIN_TAG_PREFIX_BLOCK.length);
      const sepIdx = body.indexOf('|');
      const rawId = sepIdx >= 0 ? body.slice(0, sepIdx) : body;
      const rawName = sepIdx >= 0 ? body.slice(sepIdx + 1) : rawId;
      const id = normalizePlayerPrivacyKey(safeDecode(rawId));
      const name = safeDecode(rawName).trim() || id;
      if (id) {
        blocked.push({ id, name });
        sawAnyPrivacyTag = true;
      }
    }
  }

  if (sawAnyPrivacyTag) {
    result.blockedPlayers = sanitizeBlockedPlayers(blocked);
  }
  return result;
}

export function readStoredPrivacySettings(
  storage?: Pick<Storage, 'getItem'> | null,
): PlayerPrivacySettings {
  const targetStorage =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;
  if (!targetStorage) {
    return sanitizePlayerPrivacySettings(null);
  }
  try {
    const raw = targetStorage.getItem(PRIVACY_SETTINGS_STORAGE_KEY);
    if (!raw) return sanitizePlayerPrivacySettings(null);
    return sanitizePlayerPrivacySettings(JSON.parse(raw) as Partial<PlayerPrivacySettings>);
  } catch {
    return sanitizePlayerPrivacySettings(null);
  }
}

export function writeStoredPrivacySettings(
  settings: Partial<PlayerPrivacySettings>,
  storage?: Pick<Storage, 'setItem'> | null,
): PlayerPrivacySettings {
  const clean = sanitizePlayerPrivacySettings(settings);
  const targetStorage =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;
  if (targetStorage) {
    try {
      targetStorage.setItem(PRIVACY_SETTINGS_STORAGE_KEY, JSON.stringify(clean));
    } catch {
      // ignore storage errors
    }
  }
  return clean;
}
