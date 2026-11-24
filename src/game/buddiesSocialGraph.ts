import {
  normalizePlayerPrivacyKey,
  type PlayerPrivacySettings,
} from './buddiesPrivacySettings';
import {
  isPlayerRoleBadgeId,
  sanitizeProjectName,
  type PlayerRoleBadgeId,
} from './buddiesProfileIdentity';
import type { BuddiesLetter } from '../lib/lettersRules';

export interface SocialContactEntry {
  id: string;
  name: string;
  roleBadge?: PlayerRoleBadgeId;
  buildingProject?: string;
}

export interface PlayerSocialGraph {
  friends: SocialContactEntry[];
  following: SocialContactEntry[];
  pendingOutgoingFriendRequests: SocialContactEntry[];
}

export const DEFAULT_PLAYER_SOCIAL_GRAPH: PlayerSocialGraph = {
  friends: [],
  following: [],
  pendingOutgoingFriendRequests: [],
};

export const SOCIAL_GRAPH_STORAGE_KEY = 'bb_player_social_graph_v1';
export const SOCIAL_GRAPH_UPDATED_EVENT = 'bb-social-graph-updated';

const MAX_FRIENDS = 60;
const MAX_FOLLOWING = 60;
const MAX_PENDING_REQUESTS = 40;

function cleanContactName(rawName: unknown, fallbackId: string): string {
  if (typeof rawName !== 'string') return fallbackId;
  const cleaned = rawName
    .replace(/\s*\((ANDA|YOU|KAMU)\)/gi, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 48);
  return cleaned || fallbackId;
}

export function sanitizeSocialContactList(
  raw: ReadonlyArray<Partial<SocialContactEntry>> | null | undefined,
  maxItems: number,
): SocialContactEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const clean: SocialContactEntry[] = [];
  for (const item of raw) {
    if (!item) continue;
    const id = normalizePlayerPrivacyKey(item.id || item.name);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const entry: SocialContactEntry = {
      id,
      name: cleanContactName(item.name, id),
    };
    if (isPlayerRoleBadgeId(item.roleBadge)) {
      entry.roleBadge = item.roleBadge;
    }
    const project = sanitizeProjectName(item.buildingProject);
    if (project) {
      entry.buildingProject = project;
    }
    clean.push(entry);
    if (clean.length >= maxItems) break;
  }
  return clean;
}

export function sanitizePlayerSocialGraph(
  raw: Partial<PlayerSocialGraph> | null | undefined,
): PlayerSocialGraph {
  if (!raw || typeof raw !== 'object') {
    return {
      friends: [],
      following: [],
      pendingOutgoingFriendRequests: [],
    };
  }
  const friends = sanitizeSocialContactList(raw.friends, MAX_FRIENDS);
  const friendKeys = new Set(friends.map((f) => normalizePlayerPrivacyKey(f.id)));
  const pendingOutgoingFriendRequests = sanitizeSocialContactList(
    raw.pendingOutgoingFriendRequests,
    MAX_PENDING_REQUESTS,
  ).filter((req) => !friendKeys.has(normalizePlayerPrivacyKey(req.id)));

  return {
    friends,
    following: sanitizeSocialContactList(raw.following, MAX_FOLLOWING),
    pendingOutgoingFriendRequests,
  };
}

function matchesContactList(
  list: ReadonlyArray<SocialContactEntry> | null | undefined,
  candidateId?: string | number | null,
  candidateName?: string | null,
): boolean {
  if (!Array.isArray(list) || list.length === 0) return false;
  const idKey = normalizePlayerPrivacyKey(candidateId);
  const nameKey = normalizePlayerPrivacyKey(candidateName);
  if (!idKey && !nameKey) return false;
  return list.some((entry) => {
    const entryId = normalizePlayerPrivacyKey(entry.id);
    const entryName = normalizePlayerPrivacyKey(entry.name);
    if (idKey && (entryId === idKey || entryName === idKey)) return true;
    if (nameKey && (entryId === nameKey || entryName === nameKey)) return true;
    return false;
  });
}

export function isFriendWith(
  graph: Pick<PlayerSocialGraph, 'friends'> | null | undefined,
  candidateId?: string | number | null,
  candidateName?: string | null,
): boolean {
  return matchesContactList(graph?.friends, candidateId, candidateName);
}

export function isFollowingPlayer(
  graph: Pick<PlayerSocialGraph, 'following'> | null | undefined,
  candidateId?: string | number | null,
  candidateName?: string | null,
): boolean {
  return matchesContactList(graph?.following, candidateId, candidateName);
}

export function hasPendingOutgoingFriendRequest(
  graph: Pick<PlayerSocialGraph, 'pendingOutgoingFriendRequests'> | null | undefined,
  candidateId?: string | number | null,
  candidateName?: string | null,
): boolean {
  return matchesContactList(graph?.pendingOutgoingFriendRequests, candidateId, candidateName);
}

export function addFriendEntry(
  graph: PlayerSocialGraph,
  target: {
    id?: string | number | null;
    name: string;
    roleBadge?: PlayerRoleBadgeId;
    buildingProject?: string;
  },
): PlayerSocialGraph {
  const id = normalizePlayerPrivacyKey(target.id || target.name);
  if (!id) return graph;
  const name = cleanContactName(target.name, id);
  const existing = graph.friends.find(
    (entry) =>
      normalizePlayerPrivacyKey(entry.id) === id ||
      normalizePlayerPrivacyKey(entry.name) === normalizePlayerPrivacyKey(name),
  );
  const nextFriends = existing
    ? graph.friends.map((entry) =>
        entry === existing
          ? {
              ...entry,
              name: name || entry.name,
              roleBadge: target.roleBadge ?? entry.roleBadge,
              buildingProject:
                target.buildingProject !== undefined
                  ? sanitizeProjectName(target.buildingProject) || undefined
                  : entry.buildingProject,
            }
          : entry,
      )
    : [
        ...graph.friends,
        {
          id,
          name,
          ...(isPlayerRoleBadgeId(target.roleBadge) ? { roleBadge: target.roleBadge } : {}),
          ...(sanitizeProjectName(target.buildingProject)
            ? { buildingProject: sanitizeProjectName(target.buildingProject) }
            : {}),
        },
      ];

  return sanitizePlayerSocialGraph({
    ...graph,
    friends: nextFriends,
    pendingOutgoingFriendRequests: graph.pendingOutgoingFriendRequests.filter(
      (req) =>
        normalizePlayerPrivacyKey(req.id) !== id &&
        normalizePlayerPrivacyKey(req.name) !== normalizePlayerPrivacyKey(name),
    ),
  });
}

export function removeFriendEntry(
  graph: PlayerSocialGraph,
  targetIdOrName: string,
): PlayerSocialGraph {
  const key = normalizePlayerPrivacyKey(targetIdOrName);
  if (!key) return graph;
  return sanitizePlayerSocialGraph({
    ...graph,
    friends: graph.friends.filter(
      (entry) =>
        normalizePlayerPrivacyKey(entry.id) !== key &&
        normalizePlayerPrivacyKey(entry.name) !== key,
    ),
  });
}

export function addPendingOutgoingFriendRequest(
  graph: PlayerSocialGraph,
  target: {
    id?: string | number | null;
    name: string;
    roleBadge?: PlayerRoleBadgeId;
    buildingProject?: string;
  },
): PlayerSocialGraph {
  const id = normalizePlayerPrivacyKey(target.id || target.name);
  if (!id) return graph;
  if (isFriendWith(graph, id, target.name)) return graph;
  if (hasPendingOutgoingFriendRequest(graph, id, target.name)) return graph;
  return sanitizePlayerSocialGraph({
    ...graph,
    pendingOutgoingFriendRequests: [
      ...graph.pendingOutgoingFriendRequests,
      {
        id,
        name: cleanContactName(target.name, id),
        ...(isPlayerRoleBadgeId(target.roleBadge) ? { roleBadge: target.roleBadge } : {}),
        ...(sanitizeProjectName(target.buildingProject)
          ? { buildingProject: sanitizeProjectName(target.buildingProject) }
          : {}),
      },
    ],
  });
}

export function removePendingOutgoingFriendRequest(
  graph: PlayerSocialGraph,
  targetIdOrName: string,
): PlayerSocialGraph {
  const key = normalizePlayerPrivacyKey(targetIdOrName);
  if (!key) return graph;
  return sanitizePlayerSocialGraph({
    ...graph,
    pendingOutgoingFriendRequests: graph.pendingOutgoingFriendRequests.filter(
      (entry) =>
        normalizePlayerPrivacyKey(entry.id) !== key &&
        normalizePlayerPrivacyKey(entry.name) !== key,
    ),
  });
}

export function addFollowingEntry(
  graph: PlayerSocialGraph,
  target: {
    id?: string | number | null;
    name: string;
    roleBadge?: PlayerRoleBadgeId;
    buildingProject?: string;
  },
): PlayerSocialGraph {
  const id = normalizePlayerPrivacyKey(target.id || target.name);
  if (!id) return graph;
  const name = cleanContactName(target.name, id);
  if (isFollowingPlayer(graph, id, name)) {
    return sanitizePlayerSocialGraph({
      ...graph,
      following: graph.following.map((entry) =>
        normalizePlayerPrivacyKey(entry.id) === id
          ? {
              ...entry,
              name: name || entry.name,
              roleBadge: target.roleBadge ?? entry.roleBadge,
              buildingProject:
                target.buildingProject !== undefined
                  ? sanitizeProjectName(target.buildingProject) || undefined
                  : entry.buildingProject,
            }
          : entry,
      ),
    });
  }
  return sanitizePlayerSocialGraph({
    ...graph,
    following: [
      ...graph.following,
      {
        id,
        name,
        ...(isPlayerRoleBadgeId(target.roleBadge) ? { roleBadge: target.roleBadge } : {}),
        ...(sanitizeProjectName(target.buildingProject)
          ? { buildingProject: sanitizeProjectName(target.buildingProject) }
          : {}),
      },
    ],
  });
}

export function removeFollowingEntry(
  graph: PlayerSocialGraph,
  targetIdOrName: string,
): PlayerSocialGraph {
  const key = normalizePlayerPrivacyKey(targetIdOrName);
  if (!key) return graph;
  return sanitizePlayerSocialGraph({
    ...graph,
    following: graph.following.filter(
      (entry) =>
        normalizePlayerPrivacyKey(entry.id) !== key &&
        normalizePlayerPrivacyKey(entry.name) !== key,
    ),
  });
}

/**
 * Determines whether the "Add Friend" action should be rendered for a target player.
 * When the target has `allowFriendRequests === false`, the button MUST be absent.
 */
export function canShowAddFriendAction(params: {
  isSelf?: boolean;
  isNpc?: boolean;
  isBlocked?: boolean;
  isFriend?: boolean;
  allowFriendRequests?: boolean | null;
}): boolean {
  if (params.isSelf || params.isNpc || params.isBlocked || params.isFriend) {
    return false;
  }
  if (params.allowFriendRequests === false) {
    return false;
  }
  return true;
}

/**
 * Reconciles incoming letters so that when another player accepts our friend
 * request (sending back a confirmation letter carrying `friendAcceptedByAccount`),
 * or when we previously accepted a `friend_request` letter, both players appear
 * as confirmed friends on this client.
 */
export function reconcileAcceptedFriendLetters(
  graph: PlayerSocialGraph,
  letters: ReadonlyArray<Pick<BuddiesLetter, 'kind' | 'decisionState' | 'payload'>>,
): { nextGraph: PlayerSocialGraph; newlyAddedFriends: SocialContactEntry[] } {
  let nextGraph = graph;
  const newlyAddedFriends: SocialContactEntry[] = [];

  for (const letter of letters) {
    if (!letter || !letter.payload) continue;
    let friendAccount = '';
    let friendName = '';

    if (typeof letter.payload.friendAcceptedByAccount === 'string') {
      friendAccount = normalizePlayerPrivacyKey(letter.payload.friendAcceptedByAccount);
      friendName = cleanContactName(
        letter.payload.friendAcceptedByName || letter.payload.senderName,
        friendAccount,
      );
    } else if (letter.kind === 'friend_request' && letter.decisionState === 'accepted') {
      friendAccount = normalizePlayerPrivacyKey(letter.payload.senderAccount);
      friendName = cleanContactName(letter.payload.senderName, friendAccount);
    }

    if (!friendAccount) continue;
    if (!isFriendWith(nextGraph, friendAccount, friendName)) {
      nextGraph = addFriendEntry(nextGraph, { id: friendAccount, name: friendName });
      newlyAddedFriends.push({ id: friendAccount, name: friendName });
    } else if (hasPendingOutgoingFriendRequest(nextGraph, friendAccount, friendName)) {
      nextGraph = removePendingOutgoingFriendRequest(nextGraph, friendAccount);
    }
  }

  return { nextGraph, newlyAddedFriends };
}

/**
 * Reconciles pending outgoing friend requests against remote profiles' `unlocked_skins`
 * tags: if a remote player we requested already lists our account as a friend,
 * promote them to a confirmed friend locally.
 */
export function reconcileMutualFriendsFromRemoteProfiles(
  graph: PlayerSocialGraph,
  localAccountId: string | null | undefined,
  remoteProfiles: ReadonlyArray<{
    nearAccountId: string;
    displayName: string;
    friendIds: ReadonlyArray<string>;
    roleBadge?: PlayerRoleBadgeId;
    buildingProject?: string;
  }>,
): { nextGraph: PlayerSocialGraph; newlyAddedFriends: SocialContactEntry[] } {
  const localKey = normalizePlayerPrivacyKey(localAccountId);
  if (!localKey || remoteProfiles.length === 0) {
    return { nextGraph: graph, newlyAddedFriends: [] };
  }

  let nextGraph = graph;
  const newlyAddedFriends: SocialContactEntry[] = [];

  for (const profile of remoteProfiles) {
    const remoteKey = normalizePlayerPrivacyKey(profile.nearAccountId);
    if (!remoteKey || remoteKey === localKey) continue;
    const listsUs = profile.friendIds.some((id) => normalizePlayerPrivacyKey(id) === localKey);
    if (!listsUs) continue;
    if (
      !isFriendWith(nextGraph, remoteKey, profile.displayName) &&
      hasPendingOutgoingFriendRequest(nextGraph, remoteKey, profile.displayName)
    ) {
      nextGraph = addFriendEntry(nextGraph, {
        id: remoteKey,
        name: profile.displayName,
        roleBadge: profile.roleBadge,
        buildingProject: profile.buildingProject,
      });
      newlyAddedFriends.push({ id: remoteKey, name: profile.displayName });
    }
  }

  return { nextGraph, newlyAddedFriends };
}

const SKIN_TAG_PREFIX_FRIEND = 'friend:';
const SKIN_TAG_PREFIX_FOLLOW = 'follow:';
const SKIN_TAG_PREFIX_PENDING_OUT = 'freq_out:';
const SKIN_TAG_MARKER_SOCIAL = 'social_v1:1';

export function encodeSocialGraphToSkinsTags(graph: PlayerSocialGraph): string[] {
  const clean = sanitizePlayerSocialGraph(graph);
  const tags: string[] = [SKIN_TAG_MARKER_SOCIAL];
  for (const entry of clean.friends) {
    tags.push(
      `${SKIN_TAG_PREFIX_FRIEND}${encodeURIComponent(entry.id)}|${encodeURIComponent(entry.name)}`,
    );
  }
  for (const entry of clean.following) {
    tags.push(
      `${SKIN_TAG_PREFIX_FOLLOW}${encodeURIComponent(entry.id)}|${encodeURIComponent(entry.name)}`,
    );
  }
  for (const entry of clean.pendingOutgoingFriendRequests) {
    tags.push(
      `${SKIN_TAG_PREFIX_PENDING_OUT}${encodeURIComponent(entry.id)}|${encodeURIComponent(entry.name)}`,
    );
  }
  return tags;
}

export function parseSocialGraphFromSkinsTags(
  skins: ReadonlyArray<string> | null | undefined,
): Partial<PlayerSocialGraph> {
  if (!Array.isArray(skins) || skins.length === 0) return {};

  const friends: SocialContactEntry[] = [];
  const following: SocialContactEntry[] = [];
  const pendingOutgoing: SocialContactEntry[] = [];
  let sawAnySocialTag = false;

  const safeDecode = (val: string): string => {
    try {
      return decodeURIComponent(val);
    } catch {
      return val;
    }
  };

  const parsePair = (body: string): SocialContactEntry | null => {
    const sepIdx = body.indexOf('|');
    const rawId = sepIdx >= 0 ? body.slice(0, sepIdx) : body;
    const rawName = sepIdx >= 0 ? body.slice(sepIdx + 1) : rawId;
    const id = normalizePlayerPrivacyKey(safeDecode(rawId));
    if (!id) return null;
    const name = cleanContactName(safeDecode(rawName), id);
    return { id, name };
  };

  for (const raw of skins) {
    if (typeof raw !== 'string') continue;
    if (raw === SKIN_TAG_MARKER_SOCIAL) {
      sawAnySocialTag = true;
    } else if (raw.startsWith(SKIN_TAG_PREFIX_FRIEND)) {
      const parsed = parsePair(raw.slice(SKIN_TAG_PREFIX_FRIEND.length));
      if (parsed) {
        friends.push(parsed);
        sawAnySocialTag = true;
      }
    } else if (raw.startsWith(SKIN_TAG_PREFIX_FOLLOW)) {
      const parsed = parsePair(raw.slice(SKIN_TAG_PREFIX_FOLLOW.length));
      if (parsed) {
        following.push(parsed);
        sawAnySocialTag = true;
      }
    } else if (raw.startsWith(SKIN_TAG_PREFIX_PENDING_OUT)) {
      const parsed = parsePair(raw.slice(SKIN_TAG_PREFIX_PENDING_OUT.length));
      if (parsed) {
        pendingOutgoing.push(parsed);
        sawAnySocialTag = true;
      }
    }
  }

  if (!sawAnySocialTag) return {};
  return sanitizePlayerSocialGraph({
    friends,
    following,
    pendingOutgoingFriendRequests: pendingOutgoing,
  });
}

export function readStoredSocialGraph(
  storage?: Pick<Storage, 'getItem'> | null,
): PlayerSocialGraph {
  const targetStorage =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;
  if (!targetStorage) {
    return sanitizePlayerSocialGraph(null);
  }
  try {
    const raw = targetStorage.getItem(SOCIAL_GRAPH_STORAGE_KEY);
    if (!raw) return sanitizePlayerSocialGraph(null);
    return sanitizePlayerSocialGraph(JSON.parse(raw) as Partial<PlayerSocialGraph>);
  } catch {
    return sanitizePlayerSocialGraph(null);
  }
}

export function writeStoredSocialGraph(
  graph: Partial<PlayerSocialGraph>,
  storage?: Pick<Storage, 'setItem'> | null,
): PlayerSocialGraph {
  const clean = sanitizePlayerSocialGraph(graph);
  const targetStorage =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;
  if (targetStorage) {
    try {
      targetStorage.setItem(SOCIAL_GRAPH_STORAGE_KEY, JSON.stringify(clean));
    } catch {
      // ignore storage errors
    }
  }
  return clean;
}

/**
 * Helper to check whether a player can send a friend request based on their
 * own privacy settings and the target's `allowFriendRequests` setting.
 */
export function isTargetAcceptingFriendRequests(
  targetPrivacy?: Pick<PlayerPrivacySettings, 'allowFriendRequests'> | null,
): boolean {
  return targetPrivacy?.allowFriendRequests !== false;
}
