import { useEffect, useState } from 'react';
import {
  CITIZEN_PROFILES,
  resolveCanonicalCitizenId,
  type CitizenId,
} from './buddiesCitizenRoles';

export interface NpcPortraitPhotoPair {
  /** Chest-up selfie portrait (1:1 square) for circular avatars, chat headers, and HUD dock. */
  avatarUrl: string;
  /** Full-body editorial photo (wide banner) for the Status Cover header. */
  coverUrl: string;
  capturedAtMs: number;
}

export const NPC_PORTRAITS_UPDATED_EVENT = 'bb-npc-portraits-updated';
export const NPC_PORTRAIT_REQUEST_EVENT = 'bb-request-npc-portrait';

const SESSION_CACHE_KEY = 'bb_npc_portraits_3d_v1';

const portraitMap = new Map<CitizenId, NpcPortraitPhotoPair>();
const placeholderCache = new Map<string, string>();
let hydratedFromSession = false;

const NPC_NAME_TO_CITIZEN_ID: ReadonlyArray<readonly [string, CitizenId]> = [
  ['hana', 'npc_hana'],
  ['kai', 'npc_kai'],
  ['raka', 'city_plaza_raka'],
  ['nadia', 'city_plaza_nadia'],
  ['mira', 'citizen_mira'],
  ['bima', 'citizen_bima'],
  ['tari', 'citizen_tari'],
  ['kenji', 'citizen_kenji'],
];

const NPC_STUDIO_PALETTES: Readonly<
  Record<CitizenId, { bgTop: string; bgBottom: string; accent: string; initial: string }>
> = {
  npc_hana: { bgTop: '#f6eadb', bgBottom: '#d8b490', accent: '#f59e0b', initial: 'H' },
  npc_kai: { bgTop: '#d9effc', bgBottom: '#7bb9dc', accent: '#0284c7', initial: 'K' },
  city_plaza_raka: { bgTop: '#dce9fa', bgBottom: '#8db1dc', accent: '#2563eb', initial: 'R' },
  city_plaza_nadia: { bgTop: '#fce4ee', bgBottom: '#dba2ba', accent: '#ec4899', initial: 'N' },
  citizen_mira: { bgTop: '#f3e6fb', bgBottom: '#c9a0de', accent: '#c026d3', initial: 'M' },
  citizen_bima: { bgTop: '#fbe7d8', bgBottom: '#d8a483', accent: '#ea580c', initial: 'B' },
  citizen_tari: { bgTop: '#daf3ef', bgBottom: '#84beb4', accent: '#0d9488', initial: 'T' },
  citizen_kenji: { bgTop: '#e3ecf5', bgBottom: '#93a7be', accent: '#dc2626', initial: 'K' },
};

function hydrateFromSessionStorage(): void {
  if (hydratedFromSession || typeof window === 'undefined') return;
  hydratedFromSession = true;
  try {
    const raw = window.sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, NpcPortraitPhotoPair>;
    if (!parsed || typeof parsed !== 'object') return;
    for (const [key, value] of Object.entries(parsed)) {
      const canonical = resolveCanonicalCitizenId(key);
      if (
        canonical &&
        value &&
        typeof value.avatarUrl === 'string' &&
        value.avatarUrl.startsWith('data:image/') &&
        typeof value.coverUrl === 'string' &&
        value.coverUrl.startsWith('data:image/')
      ) {
        portraitMap.set(canonical, value);
      }
    }
  } catch {
    // Ignore storage read issues
  }
}

function persistToSessionStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const obj: Record<string, NpcPortraitPhotoPair> = {};
    for (const [id, pair] of portraitMap.entries()) {
      obj[id] = pair;
    }
    window.sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(obj));
  } catch {
    // Ignore quota limits; in-memory Map still serves all portraits cleanly
  }
}

export function getNpcStudioPalette(citizenId: CitizenId): {
  bgTop: string;
  bgBottom: string;
  accent: string;
  initial: string;
} {
  return NPC_STUDIO_PALETTES[citizenId] ?? NPC_STUDIO_PALETTES.npc_hana;
}

/**
 * Resolves any NPC entity (by id, alias, or name) to its canonical CitizenId.
 * Returns null for real human players or self.
 */
export function resolveNpcCitizenIdFromEntity(entity: {
  id?: string | number | null;
  name?: string | null;
  isNpc?: boolean | null;
  isMerchant?: boolean | null;
  isSelf?: boolean | null;
}): CitizenId | null {
  if (!entity || entity.isSelf) return null;
  const rawId = entity.id != null ? String(entity.id).trim().toLowerCase() : '';
  if (rawId) {
    const direct = resolveCanonicalCitizenId(rawId);
    if (direct) return direct;
    if (rawId === 'npc_merchant_hana' || rawId === 'npc_lobby') return 'npc_hana';
    if (rawId === 'npc_merchant_kai') return 'npc_kai';
    if (rawId === 'npc_cafe_mira') return 'citizen_mira';
    if (rawId.startsWith('npc_citizen_')) {
      const stripped = resolveCanonicalCitizenId(rawId.slice('npc_citizen_'.length));
      if (stripped) return stripped;
    }
  }

  const looksLikeNpc = Boolean(
    entity.isNpc || entity.isMerchant || rawId.startsWith('npc_') || rawId.startsWith('citizen_') || rawId.startsWith('city_plaza_'),
  );
  if (!looksLikeNpc) return null;

  const cleanName = (entity.name ?? '')
    .replace(/\s*\((ANDA|YOU|KAMU)\)/gi, '')
    .trim()
    .toLowerCase();
  if (!cleanName) return null;

  for (const [token, cid] of NPC_NAME_TO_CITIZEN_ID) {
    if (
      cleanName === token ||
      cleanName.startsWith(`${token} `) ||
      cleanName.startsWith(`${token}—`) ||
      cleanName.startsWith(`${token}-`) ||
      cleanName.includes(token)
    ) {
      return cid;
    }
  }
  return null;
}

export function getNpcPortraitPair(citizenId: CitizenId): NpcPortraitPhotoPair | null {
  hydrateFromSessionStorage();
  return portraitMap.get(citizenId) ?? null;
}

export function hasNpcPortraitPair(citizenId: CitizenId): boolean {
  hydrateFromSessionStorage();
  return portraitMap.has(citizenId);
}

export function setNpcPortraitPair(
  citizenId: CitizenId,
  pair: { avatarUrl: string; coverUrl: string },
): void {
  hydrateFromSessionStorage();
  portraitMap.set(citizenId, {
    avatarUrl: pair.avatarUrl,
    coverUrl: pair.coverUrl,
    capturedAtMs: Date.now(),
  });
  persistToSessionStorage();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(NPC_PORTRAITS_UPDATED_EVENT, { detail: { citizenId } }),
    );
  }
}

export function requestNpcPortraitCapture(citizenId: CitizenId): void {
  if (typeof window === 'undefined') return;
  if (hasNpcPortraitPair(citizenId)) return;
  window.dispatchEvent(
    new CustomEvent(NPC_PORTRAIT_REQUEST_EVENT, { detail: { citizenId } }),
  );
}

/**
 * Clean minimal tinted studio placeholder used only for the brief moment
 * before the live 3D NPC portrait photo finishes capturing (never shows old unrelated photos).
 */
export function buildNpcPlaceholderDataUrl(
  citizenId: CitizenId,
  kind: 'avatar' | 'cover',
): string {
  const cacheKey = `${citizenId}:${kind}`;
  const cached = placeholderCache.get(cacheKey);
  if (cached) return cached;

  const pal = getNpcStudioPalette(citizenId);
  const profile = CITIZEN_PROFILES.find((p) => p.id === citizenId);
  const label = (profile?.name ?? pal.initial).replace(/[<>&"']/g, '');
  const w = kind === 'cover' ? 640 : 320;
  const h = kind === 'cover' ? 280 : 320;
  const cx = kind === 'cover' ? Math.round(w * 0.65) : Math.round(w * 0.5);
  const cy = Math.round(h * 0.45);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${pal.bgTop}"/>
      <stop offset="100%" stop-color="${pal.bgBottom}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <circle cx="${cx}" cy="${cy}" r="${kind === 'cover' ? 54 : 62}" fill="rgba(255,255,255,0.28)"/>
  <text x="${cx}" y="${cy + (kind === 'cover' ? 14 : 18)}" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="700" font-size="${kind === 'cover' ? 38 : 52}" fill="rgba(15,23,42,0.55)">${label.slice(0, 1).toUpperCase()}</text>
</svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  placeholderCache.set(cacheKey, url);
  return url;
}

/**
 * Returns the NPC's own 3D chest-up selfie (`avatar`) or full-body styled (`cover`) photo.
 * Automatically requests an on-demand 3D studio capture if not yet captured.
 */
export function resolveNpcPhotoUrl(
  citizenId: CitizenId,
  kind: 'avatar' | 'cover',
): string {
  const pair = getNpcPortraitPair(citizenId);
  if (pair) {
    return kind === 'cover' ? pair.coverUrl : pair.avatarUrl;
  }
  requestNpcPortraitCapture(citizenId);
  return buildNpcPlaceholderDataUrl(citizenId, kind);
}

/**
 * Subscribes a React component to live NPC 3D portrait capture updates.
 */
export function useNpcPortraitVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onUpdated = () => setVersion((v) => v + 1);
    window.addEventListener(NPC_PORTRAITS_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(NPC_PORTRAITS_UPDATED_EVENT, onUpdated);
  }, []);
  return version;
}
