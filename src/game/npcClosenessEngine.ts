import { resolveCanonicalCitizenId, type CitizenId } from './buddiesCitizenRoles';
import { MS_PER_DAY } from '../lib/cerriaBrand';

/**
 * Hidden Closeness Engine (Foundation F1)
 * =======================================
 * Per-player, per-NPC hidden closeness state with:
 * - Meaningfully paced gains from conversations (F2), gifts (Gift Engine), and shared activities (F3)
 * - Gentle, floored real-time decay after multi-day absence
 * - Strictly ordered unlock thresholds:
 *     1. long_conversation
 *     2. pair_pose
 *     3. walk_together
 *     4. ride_together
 * - Internal closeness bands ('stranger' | 'acquaintance' | 'friendly' | 'close' | 'trusted')
 *   for F2 prompt/tone scaling ONLY.
 *
 * IMPORTANT: Closeness values, bands, and thresholds are strictly internal and MUST NEVER
 * be rendered as visible meters, hearts, bars, numbers, percentages, or relationship-tier
 * labels in any player-facing UI.
 */

export const NAMED_NPC_IDS = [
  'hana',
  'kai',
  'mira',
  'nadia',
  'tari',
  'bima',
  'kenji',
] as const;

export type NpcId = (typeof NAMED_NPC_IDS)[number];

export const NPC_ID_TO_CITIZEN_ID: Readonly<Record<NpcId, CitizenId>> = {
  hana: 'npc_hana',
  kai: 'npc_kai',
  mira: 'citizen_mira',
  nadia: 'city_plaza_nadia',
  tari: 'citizen_tari',
  bima: 'citizen_bima',
  kenji: 'citizen_kenji',
};

const CITIZEN_ID_TO_NPC_ID: Readonly<Partial<Record<CitizenId, NpcId>>> = {
  npc_hana: 'hana',
  npc_kai: 'kai',
  citizen_mira: 'mira',
  city_plaza_nadia: 'nadia',
  citizen_tari: 'tari',
  citizen_bima: 'bima',
  citizen_kenji: 'kenji',
};

const EXTRA_NPC_ALIAS_MAP: Readonly<Record<string, NpcId>> = {
  hana: 'hana',
  npc_hana: 'hana',
  npc_cafe: 'hana',
  npc_merchant_hana: 'hana',
  npc_lobby: 'hana',
  kai: 'kai',
  npc_kai: 'kai',
  npc_beach: 'kai',
  npc_merchant_kai: 'kai',
  mira: 'mira',
  citizen_mira: 'mira',
  npc_cafe_mira: 'mira',
  npc_citizen_mira: 'mira',
  nadia: 'nadia',
  city_plaza_nadia: 'nadia',
  citizen_nadia: 'nadia',
  npc_nadia: 'nadia',
  tari: 'tari',
  citizen_tari: 'tari',
  npc_citizen_tari: 'tari',
  bima: 'bima',
  citizen_bima: 'bima',
  npc_citizen_bima: 'bima',
  kenji: 'kenji',
  citizen_kenji: 'kenji',
  npc_citizen_kenji: 'kenji',
};

/**
 * Resolves any short NPC name, canonical CitizenId, or runtime alias to one of the 7 NpcIds.
 * Returns null for non-supported IDs (e.g., human players or unknown IDs).
 */
export function resolveNpcId(rawId: string | null | undefined): NpcId | null {
  if (!rawId || typeof rawId !== 'string') return null;
  const normalized = rawId.trim().toLowerCase();
  if (!normalized) return null;
  const direct = EXTRA_NPC_ALIAS_MAP[normalized];
  if (direct) return direct;
  const canonicalCitizen = resolveCanonicalCitizenId(normalized);
  if (canonicalCitizen) {
    return CITIZEN_ID_TO_NPC_ID[canonicalCitizen] ?? null;
  }
  return null;
}

export function npcIdToCitizenId(npcId: NpcId): CitizenId {
  return NPC_ID_TO_CITIZEN_ID[npcId];
}

export type ClosenessUnlockId =
  | 'long_conversation'
  | 'pair_pose'
  | 'walk_together'
  | 'ride_together';

export const CLOSENESS_UNLOCK_ORDER: readonly ClosenessUnlockId[] = [
  'long_conversation',
  'pair_pose',
  'walk_together',
  'ride_together',
] as const;

export const CLOSENESS_UNLOCK_THRESHOLDS: Readonly<Record<ClosenessUnlockId, number>> = {
  long_conversation: 20,
  pair_pose: 45,
  walk_together: 68,
  ride_together: 85,
};

/**
 * Internal closeness band for F2 prompt/warmth/flirt scaling ONLY.
 * Never display these labels in player-facing UI.
 */
export type ClosenessBand =
  | 'stranger'
  | 'acquaintance'
  | 'friendly'
  | 'close'
  | 'trusted';

export type SharedActivityKind = 'pair_pose' | 'walk_together' | 'ride_together';

export const CLOSENESS_MIN_SCORE = 0;
export const CLOSENESS_MAX_SCORE = 100;

/**
 * Decay configuration:
 * - No decay during the first 3 full real-time days of absence.
 * - Gentle decay of 1 point per elapsed day past the grace period.
 * - Safe floor of 10 once a player has reached at least 10 with an NPC
 *   (so players returning after a long break are never reset to zero).
 */
export const CLOSENESS_DECAY_GRACE_DAYS = 3;
export const CLOSENESS_DECAY_PER_DAY = 1;
export const CLOSENESS_DECAY_SAFE_FLOOR = 10;

export const CONVERSATION_DELTA_MIN = -5;
export const CONVERSATION_DELTA_MAX = 12;

export const SHARED_ACTIVITY_CLOSENESS_DELTAS: Readonly<Record<SharedActivityKind, number>> = {
  pair_pose: 5,
  walk_together: 6,
  ride_together: 8,
};

export interface NpcClosenessRecord {
  /** Internal hidden score in [0..100]. Never render in UI. */
  score: number;
  /** Highest score ever reached (used to preserve gentle decay floor). */
  peakScore: number;
  /** Epoch ms of last closeness-affecting interaction (conversation, gift, or activity). */
  lastInteractionAtMs: number | null;
  /** Local calendar date key (YYYY-MM-DD) of last accepted gift. */
  lastGiftDateKey: string | null;
  /** Last accepted gift item ID. */
  lastGiftItemId: string | null;
  /** Local calendar date key (YYYY-MM-DD) of last meaningful conversation. */
  lastConversationDateKey: string | null;
  /** Last local calendar date key per shared activity (prevents same-day repeat grinding). */
  lastActivityDateByKind: Partial<Record<SharedActivityKind, string>>;
  totalConversations: number;
  totalGifts: number;
  totalActivities: number;
}

export interface NpcClosenessStore {
  version: 1;
  records: Record<NpcId, NpcClosenessRecord>;
}

export interface ClosenessMutationResult {
  store: NpcClosenessStore;
  npcId: NpcId | null;
  appliedDelta: number;
  band: ClosenessBand;
  unlockedNow: ClosenessUnlockId[];
  unlockedAll: ClosenessUnlockId[];
}

export function getLocalClosenessDateKey(now: Date | number = Date.now()): string {
  const d = typeof now === 'number' ? new Date(now) : now;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getNpcClosenessStorageKey(playerAccountId?: string | null): string {
  const clean = (playerAccountId || '').trim().toLowerCase();
  return `bb_npc_closeness_v1:${clean || 'guest'}`;
}

export function createEmptyNpcClosenessRecord(): NpcClosenessRecord {
  return {
    score: 0,
    peakScore: 0,
    lastInteractionAtMs: null,
    lastGiftDateKey: null,
    lastGiftItemId: null,
    lastConversationDateKey: null,
    lastActivityDateByKind: {},
    totalConversations: 0,
    totalGifts: 0,
    totalActivities: 0,
  };
}

export function createEmptyNpcClosenessStore(): NpcClosenessStore {
  const records = {} as Record<NpcId, NpcClosenessRecord>;
  for (const npcId of NAMED_NPC_IDS) {
    records[npcId] = createEmptyNpcClosenessRecord();
  }
  return {
    version: 1,
    records,
  };
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return CLOSENESS_MIN_SCORE;
  const rounded = Math.round(value * 100) / 100;
  return Math.max(CLOSENESS_MIN_SCORE, Math.min(CLOSENESS_MAX_SCORE, rounded));
}

function sanitizeCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function sanitizeOptionalDateKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function sanitizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 120) : null;
}

function sanitizeOptionalTimestamp(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

export function sanitizeNpcClosenessStore(raw: unknown): NpcClosenessStore {
  const fallback = createEmptyNpcClosenessStore();
  if (!raw || typeof raw !== 'object') return fallback;
  const parsed = raw as { records?: Record<string, Partial<NpcClosenessRecord>> };
  if (!parsed.records || typeof parsed.records !== 'object') return fallback;

  for (const [rawKey, entry] of Object.entries(parsed.records)) {
    const npcId = resolveNpcId(rawKey);
    if (!npcId || !entry || typeof entry !== 'object') continue;
    const score = clampScore(typeof entry.score === 'number' ? entry.score : 0);
    const peakScore = Math.max(
      score,
      clampScore(typeof entry.peakScore === 'number' ? entry.peakScore : score),
    );
    const lastActivityDateByKind: Partial<Record<SharedActivityKind, string>> = {};
    if (entry.lastActivityDateByKind && typeof entry.lastActivityDateByKind === 'object') {
      for (const kind of ['pair_pose', 'walk_together', 'ride_together'] as const) {
        const dateKey = sanitizeOptionalDateKey(entry.lastActivityDateByKind[kind]);
        if (dateKey) lastActivityDateByKind[kind] = dateKey;
      }
    }
    fallback.records[npcId] = {
      score,
      peakScore,
      lastInteractionAtMs: sanitizeOptionalTimestamp(entry.lastInteractionAtMs),
      lastGiftDateKey: sanitizeOptionalDateKey(entry.lastGiftDateKey),
      lastGiftItemId: sanitizeOptionalString(entry.lastGiftItemId),
      lastConversationDateKey: sanitizeOptionalDateKey(entry.lastConversationDateKey),
      lastActivityDateByKind,
      totalConversations: sanitizeCount(entry.totalConversations),
      totalGifts: sanitizeCount(entry.totalGifts),
      totalActivities: sanitizeCount(entry.totalActivities),
    };
  }

  return fallback;
}

export function loadNpcClosenessStore(
  playerAccountId?: string | null,
  storage?: Pick<Storage, 'getItem'> | null,
): NpcClosenessStore {
  const targetStorage =
    storage ?? (typeof window !== 'undefined' && window.localStorage ? window.localStorage : null);
  if (!targetStorage) return createEmptyNpcClosenessStore();
  try {
    const raw = targetStorage.getItem(getNpcClosenessStorageKey(playerAccountId));
    if (!raw) return createEmptyNpcClosenessStore();
    return sanitizeNpcClosenessStore(JSON.parse(raw));
  } catch {
    return createEmptyNpcClosenessStore();
  }
}

export function saveNpcClosenessStore(
  playerAccountId: string | null | undefined,
  store: NpcClosenessStore,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  const targetStorage =
    storage ?? (typeof window !== 'undefined' && window.localStorage ? window.localStorage : null);
  if (!targetStorage) return;
  try {
    targetStorage.setItem(getNpcClosenessStorageKey(playerAccountId), JSON.stringify(store));
  } catch {
    // Ignore storage quota / private browsing errors cleanly.
  }
}

/**
 * Computes the effective closeness score after applying gentle real-time decay.
 * Pure and deterministic: never mutates the input record.
 */
export function getEffectiveClosenessScore(
  record: Pick<NpcClosenessRecord, 'score' | 'peakScore' | 'lastInteractionAtMs'>,
  nowMs: number = Date.now(),
): number {
  const baseScore = clampScore(record.score);
  if (record.lastInteractionAtMs == null || !Number.isFinite(nowMs)) {
    return baseScore;
  }
  const elapsedMs = nowMs - record.lastInteractionAtMs;
  if (elapsedMs <= CLOSENESS_DECAY_GRACE_DAYS * MS_PER_DAY) {
    return baseScore;
  }
  const elapsedDays = elapsedMs / MS_PER_DAY;
  const decayDays = Math.floor(elapsedDays - CLOSENESS_DECAY_GRACE_DAYS);
  if (decayDays <= 0) {
    return baseScore;
  }
  const decayAmount = decayDays * CLOSENESS_DECAY_PER_DAY;
  const safeFloor =
    record.peakScore >= CLOSENESS_DECAY_SAFE_FLOOR
      ? Math.min(baseScore, CLOSENESS_DECAY_SAFE_FLOOR)
      : 0;
  return clampScore(Math.max(safeFloor, baseScore - decayAmount));
}

export function applyClosenessDecay(
  record: NpcClosenessRecord,
  nowMs: number = Date.now(),
): NpcClosenessRecord {
  const decayedScore = getEffectiveClosenessScore(record, nowMs);
  if (decayedScore === record.score) return record;
  return {
    ...record,
    score: decayedScore,
  };
}

export function getNpcClosenessRecord(
  store: NpcClosenessStore,
  rawNpcId: string,
): NpcClosenessRecord {
  const npcId = resolveNpcId(rawNpcId);
  if (!npcId) return createEmptyNpcClosenessRecord();
  return store.records[npcId] ?? createEmptyNpcClosenessRecord();
}

export function isClosenessUnlockReached(
  score: number,
  unlockId: ClosenessUnlockId,
): boolean {
  return clampScore(score) >= CLOSENESS_UNLOCK_THRESHOLDS[unlockId];
}

export function getUnlockedFeaturesForScore(score: number): ClosenessUnlockId[] {
  const clean = clampScore(score);
  return CLOSENESS_UNLOCK_ORDER.filter(
    (unlockId) => clean >= CLOSENESS_UNLOCK_THRESHOLDS[unlockId],
  );
}

export function getNpcUnlockedFeatures(
  store: NpcClosenessStore,
  rawNpcId: string,
  nowMs: number = Date.now(),
): ClosenessUnlockId[] {
  const record = getNpcClosenessRecord(store, rawNpcId);
  const effective = getEffectiveClosenessScore(record, nowMs);
  return getUnlockedFeaturesForScore(effective);
}

export function hasNpcUnlock(
  store: NpcClosenessStore,
  rawNpcId: string,
  unlockId: ClosenessUnlockId,
  nowMs: number = Date.now(),
): boolean {
  const record = getNpcClosenessRecord(store, rawNpcId);
  const effective = getEffectiveClosenessScore(record, nowMs);
  return isClosenessUnlockReached(effective, unlockId);
}

export function canLongConversation(
  store: NpcClosenessStore,
  rawNpcId: string,
  nowMs: number = Date.now(),
): boolean {
  return hasNpcUnlock(store, rawNpcId, 'long_conversation', nowMs);
}

export function canPairPose(
  store: NpcClosenessStore,
  rawNpcId: string,
  nowMs: number = Date.now(),
): boolean {
  return hasNpcUnlock(store, rawNpcId, 'pair_pose', nowMs);
}

export function canWalkTogether(
  store: NpcClosenessStore,
  rawNpcId: string,
  nowMs: number = Date.now(),
): boolean {
  return hasNpcUnlock(store, rawNpcId, 'walk_together', nowMs);
}

export function canRideTogether(
  store: NpcClosenessStore,
  rawNpcId: string,
  nowMs: number = Date.now(),
): boolean {
  return hasNpcUnlock(store, rawNpcId, 'ride_together', nowMs);
}

/**
 * Internal closeness band for F2 prompt/warmth/flirt scaling ONLY.
 * Never display in UI.
 */
export function getClosenessBand(score: number): ClosenessBand {
  const clean = clampScore(score);
  if (clean >= 82) return 'trusted';
  if (clean >= 60) return 'close';
  if (clean >= 35) return 'friendly';
  if (clean >= 15) return 'acquaintance';
  return 'stranger';
}

export function getNpcClosenessBand(
  store: NpcClosenessStore,
  rawNpcId: string,
  nowMs: number = Date.now(),
): ClosenessBand {
  const record = getNpcClosenessRecord(store, rawNpcId);
  const effective = getEffectiveClosenessScore(record, nowMs);
  return getClosenessBand(effective);
}

function computeNewlyUnlocked(
  beforeScore: number,
  afterScore: number,
): ClosenessUnlockId[] {
  const beforeSet = new Set(getUnlockedFeaturesForScore(beforeScore));
  return getUnlockedFeaturesForScore(afterScore).filter((id) => !beforeSet.has(id));
}

function updateNpcRecord(
  store: NpcClosenessStore,
  npcId: NpcId,
  nextRecord: NpcClosenessRecord,
): NpcClosenessStore {
  return {
    version: 1,
    records: {
      ...store.records,
      [npcId]: nextRecord,
    },
  };
}

/**
 * Hook called by F2 after a meaningful conversation turn or session.
 * Clamps `closenessDelta` safely to [CONVERSATION_DELTA_MIN, CONVERSATION_DELTA_MAX].
 */
export function recordNpcConversation(
  store: NpcClosenessStore,
  rawNpcId: string,
  options: {
    closenessDelta: number;
    nowMs?: number;
    dateKey?: string;
  },
): ClosenessMutationResult {
  const npcId = resolveNpcId(rawNpcId);
  if (!npcId) {
    return {
      store,
      npcId: null,
      appliedDelta: 0,
      band: 'stranger',
      unlockedNow: [],
      unlockedAll: [],
    };
  }

  const nowMs = options.nowMs ?? Date.now();
  const dateKey = options.dateKey ?? getLocalClosenessDateKey(nowMs);
  const prev = getNpcClosenessRecord(store, npcId);
  const effectiveBefore = getEffectiveClosenessScore(prev, nowMs);

  const safeDelta = Number.isFinite(options.closenessDelta)
    ? Math.max(CONVERSATION_DELTA_MIN, Math.min(CONVERSATION_DELTA_MAX, options.closenessDelta))
    : 0;

  const nextScore = clampScore(effectiveBefore + safeDelta);
  const appliedDelta = Math.round((nextScore - effectiveBefore) * 100) / 100;
  const nextRecord: NpcClosenessRecord = {
    ...prev,
    score: nextScore,
    peakScore: Math.max(prev.peakScore, nextScore),
    lastInteractionAtMs: nowMs,
    lastConversationDateKey: dateKey,
    totalConversations: prev.totalConversations + 1,
  };

  return {
    store: updateNpcRecord(store, npcId, nextRecord),
    npcId,
    appliedDelta,
    band: getClosenessBand(nextScore),
    unlockedNow: computeNewlyUnlocked(effectiveBefore, nextScore),
    unlockedAll: getUnlockedFeaturesForScore(nextScore),
  };
}

/**
 * Hook called by F3 when the player completes a shared activity with an NPC
 * (pair photo pose, walking together, or riding together on a scooter/bike).
 * Awards full closeness once per (NPC, activityKind, calendar day) to prevent repeat farming.
 */
export function recordNpcSharedActivity(
  store: NpcClosenessStore,
  rawNpcId: string,
  activity: SharedActivityKind,
  options: {
    nowMs?: number;
    dateKey?: string;
    customDelta?: number;
  } = {},
): ClosenessMutationResult {
  const npcId = resolveNpcId(rawNpcId);
  if (!npcId) {
    return {
      store,
      npcId: null,
      appliedDelta: 0,
      band: 'stranger',
      unlockedNow: [],
      unlockedAll: [],
    };
  }

  const nowMs = options.nowMs ?? Date.now();
  const dateKey = options.dateKey ?? getLocalClosenessDateKey(nowMs);
  const prev = getNpcClosenessRecord(store, npcId);
  const effectiveBefore = getEffectiveClosenessScore(prev, nowMs);

  const alreadyDidToday = prev.lastActivityDateByKind[activity] === dateKey;
  const rawDelta =
    options.customDelta !== undefined && Number.isFinite(options.customDelta)
      ? Math.max(0, Math.min(15, options.customDelta))
      : SHARED_ACTIVITY_CLOSENESS_DELTAS[activity];
  const gain = alreadyDidToday ? 0 : rawDelta;

  const nextScore = clampScore(effectiveBefore + gain);
  const appliedDelta = Math.round((nextScore - effectiveBefore) * 100) / 100;
  const nextRecord: NpcClosenessRecord = {
    ...prev,
    score: nextScore,
    peakScore: Math.max(prev.peakScore, nextScore),
    lastInteractionAtMs: nowMs,
    lastActivityDateByKind: {
      ...prev.lastActivityDateByKind,
      [activity]: dateKey,
    },
    totalActivities: prev.totalActivities + 1,
  };

  return {
    store: updateNpcRecord(store, npcId, nextRecord),
    npcId,
    appliedDelta,
    band: getClosenessBand(nextScore),
    unlockedNow: computeNewlyUnlocked(effectiveBefore, nextScore),
    unlockedAll: getUnlockedFeaturesForScore(nextScore),
  };
}

/**
 * Internal helper called by the Gift Engine after validating the daily gift rule.
 */
export function applyNpcGiftCloseness(
  store: NpcClosenessStore,
  npcId: NpcId,
  params: {
    delta: number;
    dateKey: string;
    giftItemId: string;
    nowMs?: number;
  },
): ClosenessMutationResult {
  const nowMs = params.nowMs ?? Date.now();
  const prev = getNpcClosenessRecord(store, npcId);
  const effectiveBefore = getEffectiveClosenessScore(prev, nowMs);
  const safeDelta = Number.isFinite(params.delta)
    ? Math.max(-10, Math.min(20, params.delta))
    : 0;
  const nextScore = clampScore(effectiveBefore + safeDelta);
  const appliedDelta = Math.round((nextScore - effectiveBefore) * 100) / 100;

  const nextRecord: NpcClosenessRecord = {
    ...prev,
    score: nextScore,
    peakScore: Math.max(prev.peakScore, nextScore),
    lastInteractionAtMs: nowMs,
    lastGiftDateKey: params.dateKey,
    lastGiftItemId: params.giftItemId,
    totalGifts: prev.totalGifts + 1,
  };

  return {
    store: updateNpcRecord(store, npcId, nextRecord),
    npcId,
    appliedDelta,
    band: getClosenessBand(nextScore),
    unlockedNow: computeNewlyUnlocked(effectiveBefore, nextScore),
    unlockedAll: getUnlockedFeaturesForScore(nextScore),
  };
}

/**
 * Compact profile-sync helpers compatible with `bb_profiles.unlocked_skins` string tags
 * (without adding or renaming any Supabase columns or existing localStorage keys).
 * Format: `npc_cl:<npcId>:<score>:<peak>:<lastInteractionSec>:<lastGiftDateKey>`
 */
const CLOSENESS_SKIN_TAG_PREFIX = 'npc_cl:';

export function encodeNpcClosenessToSkinsTags(store: NpcClosenessStore): string[] {
  const tags: string[] = [];
  for (const npcId of NAMED_NPC_IDS) {
    const rec = store.records[npcId];
    if (!rec) continue;
    if (
      rec.score <= 0 &&
      rec.peakScore <= 0 &&
      rec.lastInteractionAtMs == null &&
      rec.lastGiftDateKey == null
    ) {
      continue;
    }
    const lastSec = rec.lastInteractionAtMs ? Math.floor(rec.lastInteractionAtMs / 1000) : 0;
    const giftDate = rec.lastGiftDateKey ?? '';
    tags.push(
      `${CLOSENESS_SKIN_TAG_PREFIX}${npcId}:${Math.round(rec.score)}:${Math.round(rec.peakScore)}:${lastSec}:${giftDate}`,
    );
  }
  return tags;
}

export function parseNpcClosenessFromSkinsTags(
  skins: ReadonlyArray<string> | null | undefined,
): NpcClosenessStore {
  const store = createEmptyNpcClosenessStore();
  if (!Array.isArray(skins) || skins.length === 0) return store;

  for (const raw of skins) {
    if (typeof raw !== 'string' || !raw.startsWith(CLOSENESS_SKIN_TAG_PREFIX)) continue;
    const parts = raw.slice(CLOSENESS_SKIN_TAG_PREFIX.length).split(':');
    const npcId = resolveNpcId(parts[0]);
    if (!npcId) continue;
    const score = clampScore(Number(parts[1]));
    const peakScore = Math.max(score, clampScore(Number(parts[2])));
    const lastSec = Number(parts[3]);
    const lastInteractionAtMs =
      Number.isFinite(lastSec) && lastSec > 0 ? Math.floor(lastSec) * 1000 : null;
    const lastGiftDateKey = sanitizeOptionalDateKey(parts[4]);

    store.records[npcId] = {
      ...store.records[npcId],
      score,
      peakScore,
      lastInteractionAtMs,
      lastGiftDateKey,
    };
  }
  return store;
}

/**
 * Merges a local closeness store with a remotely synced one, keeping the fresher
 * interaction record per NPC and preserving any same-day gift lock.
 */
export function mergeNpcClosenessStores(
  localStore: NpcClosenessStore,
  remoteStore: NpcClosenessStore,
): NpcClosenessStore {
  const merged = createEmptyNpcClosenessStore();
  for (const npcId of NAMED_NPC_IDS) {
    const a = localStore.records[npcId] ?? createEmptyNpcClosenessRecord();
    const b = remoteStore.records[npcId] ?? createEmptyNpcClosenessRecord();
    const aTs = a.lastInteractionAtMs ?? 0;
    const bTs = b.lastInteractionAtMs ?? 0;
    const primary = aTs >= bTs ? a : b;
    const secondary = aTs >= bTs ? b : a;
    const latestGiftDate =
      [a.lastGiftDateKey, b.lastGiftDateKey]
        .filter((d): d is string => Boolean(d))
        .sort()
        .pop() ?? null;

    merged.records[npcId] = {
      ...primary,
      peakScore: Math.max(a.peakScore, b.peakScore, primary.score),
      lastGiftDateKey: latestGiftDate,
      lastGiftItemId: primary.lastGiftItemId ?? secondary.lastGiftItemId,
      totalConversations: Math.max(a.totalConversations, b.totalConversations),
      totalGifts: Math.max(a.totalGifts, b.totalGifts),
      totalActivities: Math.max(a.totalActivities, b.totalActivities),
      lastActivityDateByKind: {
        ...secondary.lastActivityDateByKind,
        ...primary.lastActivityDateByKind,
      },
    };
  }
  return merged;
}
