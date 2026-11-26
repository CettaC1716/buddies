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
import { ensureAllNpcPersonasRegistered } from './personas/index';
import { resolveApiUrl } from '../lib/nearClient';

/**
 * Client-side Gemini Text Chat (Foundation F2)
 * ============================================
 * - Sends text chat turns for the 7 named NPCs to server-side `/api/npc-chat`.
 * - Never holds or exposes any API key in the browser.
 * - Preserves the `emotion` tag on replies for dialogue tone/data; NPCs stay in
 *   their natural idle during and after conversations (no emotion-clip playback).
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
  } catch {
    // Fall back gracefully if offline / network error
  }

  return buildClientFallback(npcId, params.closenessBand);
}
