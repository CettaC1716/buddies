export type PlayerRoleBadgeId = 'builder' | 'founder' | 'artist' | 'community' | 'investor';
export type NpcRoleBadgeId = 'merchant';
export type AnyRoleBadgeId = PlayerRoleBadgeId | NpcRoleBadgeId;

export type RoleBadgeIconKind = 'gear' | 'crown' | 'paintbrush' | 'smiley' | 'shield' | 'merchant';

export interface RoleBadgeSpec {
  id: AnyRoleBadgeId;
  label: string;
  color: string;
  icon: RoleBadgeIconKind;
  isNpcOnly?: boolean;
}

export const PLAYER_ROLE_BADGES: ReadonlyArray<RoleBadgeSpec & { id: PlayerRoleBadgeId }> = [
  { id: 'builder', label: 'Builder', color: '#F97316', icon: 'gear' },
  { id: 'founder', label: 'Founder', color: '#8B5CF6', icon: 'crown' },
  { id: 'artist', label: 'Artist', color: '#EC4899', icon: 'paintbrush' },
  { id: 'community', label: 'Community', color: '#22C55E', icon: 'smiley' },
  { id: 'investor', label: 'Investor', color: '#3B82F6', icon: 'shield' },
] as const;

export const MERCHANT_ROLE_BADGE: RoleBadgeSpec & { id: NpcRoleBadgeId } = {
  id: 'merchant',
  label: 'Merchant',
  color: '#EAB308',
  icon: 'merchant',
  isNpcOnly: true,
};

export const DEFAULT_PLAYER_ROLE_BADGE: PlayerRoleBadgeId = 'builder';

export const STATUS_PRESET_OPTIONS = [
  'Open to work',
  'Looking for a team',
  'Here for an event',
  'Just visiting',
] as const;

export type StatusPresetOption = (typeof STATUS_PRESET_OPTIONS)[number];

export interface ProfileSocialLinks {
  x: string;
  github: string;
  website: string;
}

export interface PlayerProfileIdentity {
  roleBadge: PlayerRoleBadgeId;
  buildingProject: string;
  links: ProfileSocialLinks;
}

export const ROLE_BADGE_STORAGE_KEY = 'bb_player_role_badge_v1';
export const BUILDING_PROJECT_STORAGE_KEY = 'bb_player_building_project_v1';
export const SOCIAL_LINKS_STORAGE_KEY = 'bb_player_social_links_v1';

const PLAYER_ROLE_ID_SET = new Set<string>(PLAYER_ROLE_BADGES.map((b) => b.id));

export function isPlayerRoleBadgeId(value: unknown): value is PlayerRoleBadgeId {
  return typeof value === 'string' && PLAYER_ROLE_ID_SET.has(value);
}

export function getPlayerRoleBadgeSpec(id: unknown): RoleBadgeSpec & { id: PlayerRoleBadgeId } {
  if (isPlayerRoleBadgeId(id)) {
    const found = PLAYER_ROLE_BADGES.find((item) => item.id === id);
    if (found) return found;
  }
  return PLAYER_ROLE_BADGES[0];
}

export function getAnyRoleBadgeSpec(id: unknown, isNpcMerchant = false): RoleBadgeSpec {
  if (isNpcMerchant || id === 'merchant') {
    return MERCHANT_ROLE_BADGE;
  }
  return getPlayerRoleBadgeSpec(id);
}

export function sanitizeProjectName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[<>]/g, '').trim().slice(0, 60);
}

export function sanitizeLinkInput(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, 120);
}

export function normalizeProfileLinkHref(
  kind: 'x' | 'github' | 'website',
  raw: string,
): string | null {
  const cleaned = sanitizeLinkInput(raw);
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:')
  ) {
    return null;
  }

  let candidate = cleaned;
  if (kind === 'x') {
    if (!/^https?:\/\//i.test(candidate)) {
      if (/^(x\.com|twitter\.com)\//i.test(candidate)) {
        candidate = `https://${candidate}`;
      } else {
        const handle = candidate.replace(/^@+/, '').replace(/^\/+/, '');
        if (!handle || /\s/.test(handle)) return null;
        candidate = `https://x.com/${handle}`;
      }
    }
  } else if (kind === 'github') {
    if (!/^https?:\/\//i.test(candidate)) {
      if (/^github\.com\//i.test(candidate)) {
        candidate = `https://${candidate}`;
      } else {
        const handle = candidate.replace(/^@+/, '').replace(/^\/+/, '');
        if (!handle || /\s/.test(handle)) return null;
        candidate = `https://github.com/${handle}`;
      }
    }
  } else {
    if (!/^https?:\/\//i.test(candidate)) {
      if (/\s/.test(candidate) || !candidate.includes('.')) return null;
      candidate = `https://${candidate}`;
    }
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function formatProfileLinkDisplay(
  kind: 'x' | 'github' | 'website',
  raw: string,
): string {
  const cleaned = sanitizeLinkInput(raw);
  if (!cleaned) return '';
  if (kind === 'x') {
    const stripped = cleaned
      .replace(/^https?:\/\/(www\.)?(x\.com|twitter\.com)\//i, '')
      .replace(/^@+/, '')
      .replace(/\/+$/, '');
    return stripped ? `@${stripped}` : 'X';
  }
  if (kind === 'github') {
    const stripped = cleaned
      .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
      .replace(/^@+/, '')
      .replace(/\/+$/, '');
    return stripped || 'GitHub';
  }
  return cleaned
    .replace(/^https?:\/\/(www\.)?/i, '')
    .replace(/\/+$/, '');
}

const SKIN_TAG_PREFIX_ROLE = 'role:';
const SKIN_TAG_PREFIX_PROJECT = 'project:';
const SKIN_TAG_PREFIX_LINK_X = 'link_x:';
const SKIN_TAG_PREFIX_LINK_GITHUB = 'link_github:';
const SKIN_TAG_PREFIX_LINK_WEBSITE = 'link_website:';

export function encodeProfileIdentityToSkinsTags(identity: PlayerProfileIdentity): string[] {
  const tags: string[] = [];
  const role = isPlayerRoleBadgeId(identity.roleBadge)
    ? identity.roleBadge
    : DEFAULT_PLAYER_ROLE_BADGE;
  tags.push(`${SKIN_TAG_PREFIX_ROLE}${role}`);

  const project = sanitizeProjectName(identity.buildingProject);
  if (project) {
    tags.push(`${SKIN_TAG_PREFIX_PROJECT}${encodeURIComponent(project)}`);
  }

  const x = sanitizeLinkInput(identity.links?.x);
  if (x) {
    tags.push(`${SKIN_TAG_PREFIX_LINK_X}${encodeURIComponent(x)}`);
  }

  const github = sanitizeLinkInput(identity.links?.github);
  if (github) {
    tags.push(`${SKIN_TAG_PREFIX_LINK_GITHUB}${encodeURIComponent(github)}`);
  }

  const website = sanitizeLinkInput(identity.links?.website);
  if (website) {
    tags.push(`${SKIN_TAG_PREFIX_LINK_WEBSITE}${encodeURIComponent(website)}`);
  }

  return tags;
}

export function parseProfileIdentityFromSkinsTags(
  skins: ReadonlyArray<string> | null | undefined,
): Partial<PlayerProfileIdentity> {
  if (!Array.isArray(skins) || skins.length === 0) return {};

  let roleBadge: PlayerRoleBadgeId | undefined;
  let buildingProject: string | undefined;
  let x = '';
  let github = '';
  let website = '';
  let hasAnyLink = false;

  const safeDecode = (val: string): string => {
    try {
      return decodeURIComponent(val);
    } catch {
      return val;
    }
  };

  for (const raw of skins) {
    if (typeof raw !== 'string') continue;
    if (raw.startsWith(SKIN_TAG_PREFIX_ROLE)) {
      const candidate = raw.slice(SKIN_TAG_PREFIX_ROLE.length);
      if (isPlayerRoleBadgeId(candidate)) {
        roleBadge = candidate;
      }
    } else if (raw.startsWith(SKIN_TAG_PREFIX_PROJECT)) {
      buildingProject = sanitizeProjectName(safeDecode(raw.slice(SKIN_TAG_PREFIX_PROJECT.length)));
    } else if (raw.startsWith(SKIN_TAG_PREFIX_LINK_X)) {
      x = sanitizeLinkInput(safeDecode(raw.slice(SKIN_TAG_PREFIX_LINK_X.length)));
      hasAnyLink = true;
    } else if (raw.startsWith(SKIN_TAG_PREFIX_LINK_GITHUB)) {
      github = sanitizeLinkInput(safeDecode(raw.slice(SKIN_TAG_PREFIX_LINK_GITHUB.length)));
      hasAnyLink = true;
    } else if (raw.startsWith(SKIN_TAG_PREFIX_LINK_WEBSITE)) {
      website = sanitizeLinkInput(safeDecode(raw.slice(SKIN_TAG_PREFIX_LINK_WEBSITE.length)));
      hasAnyLink = true;
    }
  }

  const result: Partial<PlayerProfileIdentity> = {};
  if (roleBadge) result.roleBadge = roleBadge;
  if (buildingProject !== undefined) result.buildingProject = buildingProject;
  if (hasAnyLink) {
    result.links = { x, github, website };
  }
  return result;
}

export function readStoredRoleBadge(): PlayerRoleBadgeId {
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(ROLE_BADGE_STORAGE_KEY);
      if (isPlayerRoleBadgeId(saved)) return saved;
    } catch {
      // ignore storage errors
    }
  }
  return DEFAULT_PLAYER_ROLE_BADGE;
}

export function readStoredBuildingProject(): string {
  if (typeof window !== 'undefined') {
    try {
      return sanitizeProjectName(window.localStorage.getItem(BUILDING_PROJECT_STORAGE_KEY));
    } catch {
      // ignore storage errors
    }
  }
  return '';
}

export function readStoredSocialLinks(): ProfileSocialLinks {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(SOCIAL_LINKS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ProfileSocialLinks>;
        return {
          x: sanitizeLinkInput(parsed.x),
          github: sanitizeLinkInput(parsed.github),
          website: sanitizeLinkInput(parsed.website),
        };
      }
    } catch {
      // ignore storage errors
    }
  }
  return { x: '', github: '', website: '' };
}

export function readStoredProfileIdentity(): PlayerProfileIdentity {
  return {
    roleBadge: readStoredRoleBadge(),
    buildingProject: readStoredBuildingProject(),
    links: readStoredSocialLinks(),
  };
}

export function writeStoredProfileIdentity(identity: PlayerProfileIdentity): PlayerProfileIdentity {
  const clean: PlayerProfileIdentity = {
    roleBadge: isPlayerRoleBadgeId(identity.roleBadge)
      ? identity.roleBadge
      : DEFAULT_PLAYER_ROLE_BADGE,
    buildingProject: sanitizeProjectName(identity.buildingProject),
    links: {
      x: sanitizeLinkInput(identity.links?.x),
      github: sanitizeLinkInput(identity.links?.github),
      website: sanitizeLinkInput(identity.links?.website),
    },
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(ROLE_BADGE_STORAGE_KEY, clean.roleBadge);
      window.localStorage.setItem(BUILDING_PROJECT_STORAGE_KEY, clean.buildingProject);
      window.localStorage.setItem(SOCIAL_LINKS_STORAGE_KEY, JSON.stringify(clean.links));
    } catch {
      // ignore storage errors
    }
  }
  return clean;
}
