import type { CitizenId } from './buddiesCitizenRoles';
import {
  npcIdToCitizenId,
  resolveNpcId,
  type ClosenessBand,
  type NpcId,
} from './npcClosenessEngine';
import {
  getNpcPersona,
  normalizeNpcEmotionTag,
  type NpcEmotionTag,
} from './npcPersonaRegistry';
import { ensureAllNpcPersonasRegistered } from './personas/index';
import { resolveApiUrl } from '../lib/nearClient';

/**
 * Client-side Gemini Text Chat + Emotion Reaction Hook (Foundation F2)
 * ====================================================================
 * - Sends text chat turns for the 7 named NPCs to server-side `/api/npc-chat`.
 * - Never holds or exposes any API key in the browser.
 * - Exposes a clean emotion reaction event/callback bus (`dispatchNpcEmotionReaction`,
 *   `subscribeNpcEmotionReaction`, `NPC_EMOTION_REACTION_EVENT`) so F3 / Arena can
 *   play each NPC's mapped emotion animation (falling back to expressive idle when
 *   `clipName` is null).
 */

export interface NpcTextChatHistoryTurn {
  role: 'player' | 'npc';
  text: string;
}

export interface SendNpcChatParams {
  npcId: string;
  message: string;
  history?: NpcTextChatHistoryTurn[];
  closenessBand: ClosenessBand;
  canLongConversation: boolean;
  playerName?: string;
  fetchImpl?: typeof fetch;
}

export interface NpcChatClientResult {
  ok: boolean;
  npcId: NpcId | null;
  reply: string;
  emotion: NpcEmotionTag;
  closenessDelta: number;
  fallback: boolean;
}

export const NPC_EMOTION_REACTION_EVENT = 'npc-emotion-reaction';

export interface NpcEmotionReactionDetail {
  npcId: NpcId;
  citizenId: CitizenId;
  emotion: NpcEmotionTag;
  /** Mapped clip name from `persona.emotionAnimations[emotion]`, or null for expressive idle fallback. */
  clipName: string | null;
  timestampMs: number;
}

export type NpcEmotionReactionListener = (detail: NpcEmotionReactionDetail) => void;

const emotionListeners = new Set<NpcEmotionReactionListener>();

/**
 * Resolves the verified animation clip name for `(npcId, emotion)`, or null to signal
 * expressive idle fallback.
 */
export function resolveNpcEmotionClip(
  rawNpcId: string,
  emotion: NpcEmotionTag,
): string | null {
  ensureAllNpcPersonasRegistered();
  const pack = getNpcPersona(rawNpcId);
  if (!pack?.emotionAnimations) return null;
  const clip = pack.emotionAnimations[emotion];
  return typeof clip === 'string' && clip.trim().length > 0 ? clip.trim() : null;
}

/**
 * Subscribes to NPC emotion reactions triggered by F2 chat or gift replies.
 * Returns an unsubscribe function.
 */
export function subscribeNpcEmotionReaction(
  listener: NpcEmotionReactionListener,
): () => void {
  emotionListeners.add(listener);
  return () => {
    emotionListeners.delete(listener);
  };
}

/**
 * Emits an NPC emotion reaction to all in-memory subscribers and as a DOM
 * `CustomEvent('npc-emotion-reaction')` for F3 / BuddiesBlitzArena to consume.
 */
export function dispatchNpcEmotionReaction(
  rawNpcId: string,
  rawEmotion: unknown,
): NpcEmotionReactionDetail | null {
  const npcId = resolveNpcId(rawNpcId);
  if (!npcId) return null;

  const emotion = normalizeNpcEmotionTag(rawEmotion);
  const detail: NpcEmotionReactionDetail = {
    npcId,
    citizenId: npcIdToCitizenId(npcId),
    emotion,
    clipName: resolveNpcEmotionClip(npcId, emotion),
    timestampMs: Date.now(),
  };

  for (const listener of emotionListeners) {
    try {
      listener(detail);
    } catch {
      // Never let a consumer error break chat flow
    }
  }

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent<NpcEmotionReactionDetail>(NPC_EMOTION_REACTION_EVENT, {
        detail,
      }),
    );
  }

  return detail;
}

function buildClientFallback(
  npcId: NpcId,
  closenessBand: ClosenessBand,
): NpcChatClientResult {
  ensureAllNpcPersonasRegistered();
  const pack = getNpcPersona(npcId);
  const bank = pack?.fallbackReplies?.[closenessBand];
  const reply =
    bank && bank.length > 0
      ? bank[0]
      : `Good to see you! Let's chat more when you have a moment.`;
  return {
    ok: true,
    npcId,
    reply,
    emotion: 'neutral',
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
      }),
    });

    const data = (await res.json()) as {
      ok?: boolean;
      reply?: string;
      emotion?: unknown;
      closenessDelta?: unknown;
      fallback?: boolean;
    };

    if (res.ok && data?.ok && typeof data.reply === 'string' && data.reply.trim()) {
      return {
        ok: true,
        npcId,
        reply: data.reply.trim(),
        emotion: normalizeNpcEmotionTag(data.emotion),
        closenessDelta: clampClientDelta(data.closenessDelta),
        fallback: Boolean(data.fallback),
      };
    }
  } catch {
    // Fall back gracefully if offline / network error
  }

  return buildClientFallback(npcId, params.closenessBand);
}
