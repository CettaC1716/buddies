import { resolveNpcId } from './npcClosenessEngine';

export const NPC_CHAT_HISTORY_STORAGE_PREFIX = 'bb_npc_chat_';
export const NPC_CHAT_HISTORY_STORAGE_VERSION = 'history_v1';
export const MAX_NPC_CHAT_HISTORY_TURNS = 40;

export interface NpcChatHistoryVisual {
  kind: 'interaction' | 'gift_box';
  emoji?: string;
  label?: string;
  itemName?: string;
}

export interface NpcChatHistoryTurn {
  id: string;
  role: 'player' | 'npc';
  text: string;
  timestampMs: number;
  visual?: NpcChatHistoryVisual;
}

export type NpcChatHistoryStore = Record<string, NpcChatHistoryTurn[]>;

export function getNpcChatHistoryStorageKey(playerAccountId?: string | null): string {
  const clean = (playerAccountId ?? '').trim().toLowerCase() || 'guest';
  return `${NPC_CHAT_HISTORY_STORAGE_PREFIX}${NPC_CHAT_HISTORY_STORAGE_VERSION}:${clean}`;
}

export function normalizeNpcChatKey(rawNpcId: string | null | undefined): string | null {
  if (typeof rawNpcId !== 'string') return null;
  const trimmed = rawNpcId.trim();
  if (!trimmed) return null;
  const canonicalNamed = resolveNpcId(trimmed);
  return canonicalNamed ?? trimmed.toLowerCase();
}

function sanitizeVisual(raw: unknown): NpcChatHistoryVisual | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const v = raw as Record<string, unknown>;
  if (v.kind !== 'interaction' && v.kind !== 'gift_box') return undefined;
  return {
    kind: v.kind,
    ...(typeof v.emoji === 'string' && v.emoji.trim() ? { emoji: v.emoji.slice(0, 16) } : {}),
    ...(typeof v.label === 'string' && v.label.trim() ? { label: v.label.slice(0, 80) } : {}),
    ...(typeof v.itemName === 'string' && v.itemName.trim()
      ? { itemName: v.itemName.slice(0, 120) }
      : {}),
  };
}

function sanitizeTurn(raw: unknown, fallbackIndex: number): NpcChatHistoryTurn | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const role = rec.role === 'player' || rec.role === 'npc' ? rec.role : null;
  if (!role) return null;
  const text = typeof rec.text === 'string' ? rec.text.trim().slice(0, 1200) : '';
  if (!text) return null;
  const id =
    typeof rec.id === 'string' && rec.id.trim()
      ? rec.id.trim().slice(0, 96)
      : `turn_${role}_${fallbackIndex}`;
  const timestampMs =
    typeof rec.timestampMs === 'number' && Number.isFinite(rec.timestampMs) && rec.timestampMs > 0
      ? Math.floor(rec.timestampMs)
      : 0;
  const visual = sanitizeVisual(rec.visual);
  return visual ? { id, role, text, timestampMs, visual } : { id, role, text, timestampMs };
}

function capTurns(turns: readonly NpcChatHistoryTurn[]): NpcChatHistoryTurn[] {
  if (turns.length <= MAX_NPC_CHAT_HISTORY_TURNS) return [...turns];
  return turns.slice(turns.length - MAX_NPC_CHAT_HISTORY_TURNS);
}

/**
 * Sanitizes any parsed JSON into a valid per-NPC transcript store.
 * Always recovers cleanly to an empty object on missing/corrupt input.
 */
export function sanitizeNpcChatHistoryStore(raw: unknown): NpcChatHistoryStore {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: NpcChatHistoryStore = {};
  for (const [rawKey, rawList] of Object.entries(raw as Record<string, unknown>)) {
    const key = normalizeNpcChatKey(rawKey);
    if (!key || !Array.isArray(rawList)) continue;
    const cleanTurns: NpcChatHistoryTurn[] = [];
    for (let i = 0; i < rawList.length; i++) {
      const turn = sanitizeTurn(rawList[i], i);
      if (turn) cleanTurns.push(turn);
    }
    if (cleanTurns.length > 0) {
      out[key] = capTurns(cleanTurns);
    }
  }
  return out;
}

export function loadNpcChatHistoryStore(
  playerAccountId?: string | null,
  storage?: Pick<Storage, 'getItem'> | null,
): NpcChatHistoryStore {
  const storeRef = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!storeRef) return {};
  try {
    const raw = storeRef.getItem(getNpcChatHistoryStorageKey(playerAccountId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return sanitizeNpcChatHistoryStore(parsed);
  } catch {
    return {};
  }
}

export function saveNpcChatHistoryStore(
  playerAccountId: string | null | undefined,
  store: NpcChatHistoryStore,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  const storeRef = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!storeRef) return;
  try {
    storeRef.setItem(
      getNpcChatHistoryStorageKey(playerAccountId),
      JSON.stringify(sanitizeNpcChatHistoryStore(store)),
    );
  } catch {
    // Ignore storage quota or private-mode errors safely.
  }
}

export function loadNpcChatTranscript(
  playerAccountId: string | null | undefined,
  rawNpcId: string | null | undefined,
  storage?: Pick<Storage, 'getItem'> | null,
): NpcChatHistoryTurn[] {
  const key = normalizeNpcChatKey(rawNpcId);
  if (!key) return [];
  const store = loadNpcChatHistoryStore(playerAccountId, storage);
  return store[key] ? [...store[key]] : [];
}

export function appendNpcChatTurns(
  playerAccountId: string | null | undefined,
  rawNpcId: string | null | undefined,
  newTurns: ReadonlyArray<{
    id?: string;
    role: 'player' | 'npc';
    text: string;
    timestampMs?: number;
    visual?: NpcChatHistoryVisual;
  }>,
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null,
): NpcChatHistoryTurn[] {
  const key = normalizeNpcChatKey(rawNpcId);
  if (!key) return [];
  const store = loadNpcChatHistoryStore(playerAccountId, storage);
  const existing = store[key] ?? [];
  const now = Date.now();
  const additions: NpcChatHistoryTurn[] = [];
  for (let i = 0; i < newTurns.length; i++) {
    const t = newTurns[i];
    const clean = sanitizeTurn(
      {
        id: t.id ?? `${t.role}_${now}_${existing.length + i}`,
        role: t.role,
        text: t.text,
        timestampMs: t.timestampMs ?? now + i,
        visual: t.visual,
      },
      existing.length + i,
    );
    if (clean) additions.push(clean);
  }
  const merged = capTurns([...existing, ...additions]);
  if (merged.length > 0) {
    store[key] = merged;
    saveNpcChatHistoryStore(playerAccountId, store, storage);
  }
  return merged;
}

export function clearNpcChatTranscript(
  playerAccountId: string | null | undefined,
  rawNpcId: string | null | undefined,
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null,
): void {
  const key = normalizeNpcChatKey(rawNpcId);
  if (!key) return;
  const store = loadNpcChatHistoryStore(playerAccountId, storage);
  if (!(key in store)) return;
  delete store[key];
  saveNpcChatHistoryStore(playerAccountId, store, storage);
}

/**
 * Splits a restored transcript so the dialogue UI can render prior turns in
 * `chatHistory` and the final NPC message (if any) in the active NPC bubble
 * without duplicating it or re-running the typewriter animation.
 */
export function splitTranscriptForDialogueUi(turns: readonly NpcChatHistoryTurn[]): {
  history: NpcChatHistoryTurn[];
  latestNpcText: string;
} {
  if (turns.length === 0) {
    return { history: [], latestNpcText: '' };
  }
  const last = turns[turns.length - 1];
  if (last.role === 'npc') {
    return {
      history: turns.slice(0, -1),
      latestNpcText: last.text,
    };
  }
  return {
    history: [...turns],
    latestNpcText: '',
  };
}
