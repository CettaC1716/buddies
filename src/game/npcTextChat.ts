import {
  resolveNpcId,
  type ClosenessBand,
  type NpcId,
} from './npcClosenessEngine';
import {
  getNpcPersona,
  normalizeNpcEmotionTag,
  type NpcEmotionTag,
} from './npcPersonaRegistry';
import type { NpcTogethernessStateSnapshot } from './npcTogetherness';
import {
  TOGETHERNESS_ACTION_LABELS,
  getLastCompletedCategoryForNpc,
  type NpcPacingStore,
} from './npcTogethernessRegistry';
import { ensureAllNpcPersonasRegistered } from './personas/index';
import {
  buildLocalProactiveTopic,
  type ProactiveTopicTriggerReason,
} from './npcProactiveTopics';
import { resolveApiUrl } from '../lib/nearClient';

/**
 * Client-side Gemini Text Chat (Foundation F2 + WS29 Situational Awareness)
 * =========================================================================
 * - Sends text chat turns for the 7 named NPCs to server-side `/api/npc-chat`.
 * - Never holds or exposes any API key in the browser.
 * - Attaches a per-turn `situation` sense block + `recentOpenings` so the NPC
 *   always knows where she is, what she is doing, and avoids repeating openings.
 */

export type NpcSituationActivity =
  | 'standing_in_territory'
  | 'walking_with_player'
  | 'riding_as_passenger'
  | 'just_got_off_scooter'
  | 'in_session_pose'
  | 'seated_on_bench';

export interface NpcChatSituation {
  placeLabel: string;
  activity: NpcSituationActivity;
  timePhase: 'day' | 'evening' | 'night';
  weather: string;
  lastSharedEvent: string | null;
  nearbyObjects?: string | null;
}

export interface NpcTextChatHistoryTurn {
  role: 'player' | 'npc';
  text: string;
}

const JUST_GOT_OFF_WINDOW_MS = 5 * 60 * 1000;
const RECENT_EVENT_WINDOW_MS = 15 * 60 * 1000;

function formatElapsedMinutesAgo(ageMs: number): string {
  if (ageMs < 45_000) return 'just now';
  const mins = Math.max(1, Math.round(ageMs / 60_000));
  return mins === 1 ? '1 minute ago' : `${mins} minutes ago`;
}

/**
 * Builds the compact per-turn `situation` object purely from existing live state
 * (togetherness snapshot, HUD place label, pacing store, time/weather).
 */
export function buildNpcChatSituation(params: {
  npcId: NpcId;
  placeLabel: string;
  togethernessState: NpcTogethernessStateSnapshot;
  pacingStore?: NpcPacingStore;
  giftedToday?: boolean;
  timePhase: 'day' | 'evening' | 'night';
  isRaining: boolean;
  weatherLabel?: string;
  nowMs?: number;
}): NpcChatSituation {
  const nowMs = params.nowMs ?? Date.now();
  const cleanPlace = (params.placeLabel || '').trim() || 'Central Plaza';
  const weather =
    (params.weatherLabel || '').trim() || (params.isRaining ? 'rainy' : 'clear');
  const lastCompleted = params.pacingStore
    ? getLastCompletedCategoryForNpc(params.pacingStore, params.npcId)
    : null;
  const lastAgeMs =
    lastCompleted && Number.isFinite(lastCompleted.completedAtMs)
      ? Math.max(0, nowMs - lastCompleted.completedAtMs)
      : null;

  let activity: NpcSituationActivity = 'standing_in_territory';
  if (params.togethernessState.ridingNpcId === params.npcId) {
    activity = 'riding_as_passenger';
  } else if (params.togethernessState.sittingNpcId === params.npcId) {
    activity = 'seated_on_bench';
  } else if (params.togethernessState.pairPoseNpcId === params.npcId) {
    activity = 'in_session_pose';
  } else if (params.togethernessState.walkingNpcId === params.npcId) {
    activity = 'walking_with_player';
  } else if (
    lastCompleted?.category === 'ride' &&
    lastAgeMs !== null &&
    lastAgeMs <= JUST_GOT_OFF_WINDOW_MS
  ) {
    activity = 'just_got_off_scooter';
  }

  let lastSharedEvent: string | null = null;
  if (lastCompleted && lastAgeMs !== null && lastAgeMs <= RECENT_EVENT_WINDOW_MS) {
    const ago = formatElapsedMinutesAgo(lastAgeMs);
    if (lastCompleted.category === 'ride') {
      lastSharedEvent =
        activity === 'riding_as_passenger'
          ? `started riding together on the scooter ${ago}`
          : `rode together and got off here ${ago}`;
    } else if (lastCompleted.category === 'walk') {
      lastSharedEvent = `walked together here ${ago}`;
    } else {
      const catLabel = TOGETHERNESS_ACTION_LABELS[lastCompleted.category].toLowerCase();
      lastSharedEvent = `shared a ${catLabel} moment together ${ago}`;
    }
  } else if (params.giftedToday) {
    lastSharedEvent = 'received a gift from the player today';
  }

  return {
    placeLabel: cleanPlace,
    activity,
    timePhase: params.timePhase,
    weather,
    lastSharedEvent,
    nearbyObjects: params.togethernessState.nearbySeatsSummary ?? null,
  };
}

/**
 * Extracts the NPC's last N reply openings (first clause / up to 6 words)
 * for the server anti-repetition guard.
 */
export function extractRecentNpcReplyOpenings(
  history: readonly NpcTextChatHistoryTurn[],
  maxCount: number = 3,
): string[] {
  const openings: string[] = [];
  const seen = new Set<string>();
  for (let i = history.length - 1; i >= 0 && openings.length < maxCount; i--) {
    const turn = history[i];
    if (!turn || turn.role !== 'npc') continue;
    const clean = turn.text.replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    const clause = clean.split(/[.!?—\n]/)[0]?.trim() || clean;
    const words = clause.split(' ').slice(0, 6).join(' ').slice(0, 48).trim();
    const key = words.toLowerCase();
    if (!words || seen.has(key)) continue;
    seen.add(key);
    openings.push(words);
  }
  return openings.reverse();
}

export interface SendNpcChatParams {
  npcId: string;
  message: string;
  history?: NpcTextChatHistoryTurn[];
  closenessBand: ClosenessBand;
  canLongConversation: boolean;
  playerName?: string;
  situation?: NpcChatSituation;
  recentOpenings?: string[];
  fetchImpl?: typeof fetch;
}

export type NpcChatActionVerdict = 'ride_together' | 'walk_together' | 'end_togetherness';

export function normalizeNpcChatAction(raw: unknown): NpcChatActionVerdict | null {
  if (raw === 'ride_together' || raw === 'walk_together' || raw === 'end_togetherness') {
    return raw;
  }
  return null;
}

export interface NpcChatClientResult {
  ok: boolean;
  npcId: NpcId | null;
  reply: string;
  emotion: NpcEmotionTag;
  closenessDelta: number;
  fallback: boolean;
  /** Optional togetherness verdict action returned by `/api/npc-chat`. */
  action?: NpcChatActionVerdict | null;
}

function buildClientFallback(
  npcId: NpcId,
  closenessBand: ClosenessBand,
  reason: string,
  recentOpenings?: readonly string[],
): NpcChatClientResult {
  console.warn('[npc-chat] client fallback reply used', {
    npcId,
    closenessBand,
    reason,
  });
  ensureAllNpcPersonasRegistered();
  const pack = getNpcPersona(npcId);
  const bank = pack?.fallbackReplies?.[closenessBand] ?? [];
  const recentSet = new Set(
    (recentOpenings ?? []).map((op) => op.trim().toLowerCase().slice(0, 24)),
  );
  const fresh = bank.filter((line) => !recentSet.has(line.trim().toLowerCase().slice(0, 24)));
  const pool = fresh.length > 0 ? fresh : bank;
  const reply =
    pool.length > 0
      ? pool[Math.abs(recentSet.size + Date.now()) % pool.length]
      : `Good to see you! Let's chat more when you have a moment.`;
  return {
    ok: true,
    npcId,
    reply,
    emotion:
      closenessBand === 'friendly' || closenessBand === 'close' || closenessBand === 'trusted'
        ? 'happy'
        : 'neutral',
    closenessDelta: 1,
    fallback: true,
  };
}

function clampClientDelta(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(-3, Math.min(6, Math.round(num)));
}

/**
 * Sends a player chat turn to `/api/npc-chat` for one of the 7 named NPCs.
 * Ambient or unknown NPC IDs are rejected without calling the server.
 */
export async function sendNpcChatMessage(
  params: SendNpcChatParams,
): Promise<NpcChatClientResult> {
  const npcId = resolveNpcId(params.npcId);
  const message = params.message.trim();
  if (!npcId || !message) {
    return {
      ok: false,
      npcId: null,
      reply: '',
      emotion: 'neutral',
      closenessDelta: 0,
      fallback: true,
    };
  }

  const fetchFn = params.fetchImpl ?? fetch;
  const recentOpenings =
    params.recentOpenings && params.recentOpenings.length > 0
      ? params.recentOpenings.slice(-3)
      : extractRecentNpcReplyOpenings(params.history ?? [], 3);

  try {
    const res = await fetchFn(resolveApiUrl('/api/npc-chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        npcId,
        message,
        history: (params.history ?? []).slice(-10),
        closenessBand: params.closenessBand,
        canLongConversation: params.canLongConversation,
        ...(params.playerName ? { playerName: params.playerName } : {}),
        ...(params.situation ? { situation: params.situation } : {}),
        ...(recentOpenings.length > 0 ? { recentOpenings } : {}),
      }),
    });

    const data = (await res.json()) as {
      ok?: boolean;
      reply?: string;
      emotion?: unknown;
      closenessDelta?: unknown;
      fallback?: boolean;
      action?: unknown;
    };

    if (res.ok && data?.ok && typeof data.reply === 'string' && data.reply.trim()) {
      return {
        ok: true,
        npcId,
        reply: data.reply.trim(),
        emotion: normalizeNpcEmotionTag(data.emotion),
        closenessDelta: clampClientDelta(data.closenessDelta),
        fallback: Boolean(data.fallback),
        action: normalizeNpcChatAction(data.action),
      };
    }
    return buildClientFallback(npcId, params.closenessBand, `http_${res.status}`, recentOpenings);
  } catch (err) {
    // Fall back gracefully if offline / network error
    return buildClientFallback(
      npcId,
      params.closenessBand,
      err instanceof Error ? err.message : 'network_error',
      recentOpenings,
    );
  }
}

export interface RequestNpcProactiveTopicParams {
  npcId: string;
  history?: NpcTextChatHistoryTurn[];
  closenessBand: ClosenessBand;
  canLongConversation: boolean;
  playerName?: string;
  situation: NpcChatSituation;
  recentOpenings?: string[];
  triggerReason?: ProactiveTopicTriggerReason;
  fetchImpl?: typeof fetch;
}

/**
 * Requests a natural, persona-grounded proactive conversation starter from `/api/npc-chat`
 * (`mode: 'proactive_opener'`), falling back cleanly to `buildLocalProactiveTopic` when
 * offline or when the API key is unavailable.
 */
export async function requestNpcProactiveTopic(
  params: RequestNpcProactiveTopicParams,
): Promise<NpcChatClientResult> {
  const npcId = resolveNpcId(params.npcId);
  if (!npcId) {
    return {
      ok: false,
      npcId: null,
      reply: '',
      emotion: 'neutral',
      closenessDelta: 0,
      fallback: true,
    };
  }

  const recentOpenings =
    params.recentOpenings && params.recentOpenings.length > 0
      ? params.recentOpenings.slice(-3)
      : extractRecentNpcReplyOpenings(params.history ?? [], 3);

  const localTopic = buildLocalProactiveTopic({
    npcId,
    closenessBand: params.closenessBand,
    situation: params.situation,
    playerName: params.playerName,
    recentOpenings,
    triggerReason: params.triggerReason,
  });

  const fetchFn = params.fetchImpl ?? fetch;
  try {
    const res = await fetchFn(resolveApiUrl('/api/npc-chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        npcId,
        mode: 'proactive_opener',
        message: '',
        history: (params.history ?? []).slice(-8),
        closenessBand: params.closenessBand,
        canLongConversation: params.canLongConversation,
        ...(params.playerName ? { playerName: params.playerName } : {}),
        situation: params.situation,
        ...(recentOpenings.length > 0 ? { recentOpenings } : {}),
      }),
    });

    const data = (await res.json()) as {
      ok?: boolean;
      reply?: string;
      emotion?: unknown;
      fallback?: boolean;
    };

    if (
      res.ok &&
      data?.ok &&
      !data.fallback &&
      typeof data.reply === 'string' &&
      data.reply.trim()
    ) {
      return {
        ok: true,
        npcId,
        reply: data.reply.trim(),
        emotion: normalizeNpcEmotionTag(data.emotion),
        closenessDelta: 0,
        fallback: false,
      };
    }
  } catch {
    // Fall back cleanly to persona-situational local proactive topic below
  }

  return {
    ok: true,
    npcId,
    reply: localTopic.reply,
    emotion: localTopic.emotion,
    closenessDelta: 0,
    fallback: true,
  };
}
