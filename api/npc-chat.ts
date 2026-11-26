import dns from 'node:dns';
import {
  resolveNpcId,
  type ClosenessBand,
  type NpcId,
} from '../src/game/npcClosenessEngine.ts';
import {
  NPC_EMOTION_TAGS,
  getNpcPersona,
  normalizeNpcEmotionTag,
  type NpcEmotionTag,
  type NpcPersonaPack,
} from '../src/game/npcPersonaRegistry.ts';
import { ensureAllNpcPersonasRegistered } from '../src/game/personas/index.ts';

try {
  dns.setDefaultResultOrder?.('ipv4first');
} catch {
  // ignore in non-Node runtimes
}

/**
 * Vercel Serverless Function: `/api/npc-chat`
 * Unified server-side Gemini text chat for the 7 named NPCs
 * (`hana`, `kai`, `mira`, `nadia`, `tari`, `bima`, `kenji`).
 *
 * - Server-locked persona prompt, speech style, topics, and closeness-scaled flirt/tone
 *   guidance loaded from `src/game/personas/<npc>.ts`.
 * - Rejects unknown and ambient NPC IDs cleanly (HTTP 400).
 * - Instructs Gemini to return strict JSON `{ reply, emotion, closenessDelta }` and
 *   clamps/validates all fields server-side.
 * - Never executes trades, purchases, or NPC movement commands.
 * - Gracefully falls back in local/test mode when `GEMINI_API_KEY` is absent.
 */

export interface NpcChatHistoryTurn {
  role: 'player' | 'npc';
  text: string;
}

export interface NpcChatRequestPayload {
  npcId?: string;
  message?: string;
  history?: NpcChatHistoryTurn[];
  closenessBand?: ClosenessBand;
  canLongConversation?: boolean;
  playerName?: string;
}

export interface NpcChatResponsePayload {
  ok: boolean;
  npcId?: NpcId;
  reply?: string;
  emotion?: NpcEmotionTag;
  closenessDelta?: number;
  fallback?: boolean;
  model?: string;
  error?: string;
}

export const NPC_CHAT_CLOSENESS_DELTA_MIN = -3;
export const NPC_CHAT_CLOSENESS_DELTA_MAX = 6;

const VALID_CLOSENESS_BANDS: ReadonlySet<ClosenessBand> = new Set([
  'stranger',
  'acquaintance',
  'friendly',
  'close',
  'trusted',
]);

const GEMINI_MODEL_CANDIDATES = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
] as const;

export function normalizeClosenessBand(value: unknown): ClosenessBand {
  if (typeof value === 'string' && VALID_CLOSENESS_BANDS.has(value as ClosenessBand)) {
    return value as ClosenessBand;
  }
  return 'stranger';
}

export function clampNpcChatClosenessDelta(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  const rounded = Math.round(num);
  return Math.max(
    NPC_CHAT_CLOSENESS_DELTA_MIN,
    Math.min(NPC_CHAT_CLOSENESS_DELTA_MAX, rounded),
  );
}

export function sanitizeNpcChatReply(raw: string): string {
  return String(raw || '')
    .replace(/\[\[\s*ACTION\s*:[^\]]*\]\]/gi, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`#>]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 600);
}

export function parseNpcChatModelJson(rawText: string): {
  reply: string;
  emotion: NpcEmotionTag;
  closenessDelta: number;
} | null {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return null;

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch ? jsonMatch[0] : trimmed;

  try {
    const parsed = JSON.parse(candidate) as {
      reply?: unknown;
      emotion?: unknown;
      closenessDelta?: unknown;
    };
    if (!parsed || typeof parsed !== 'object' || typeof parsed.reply !== 'string') {
      return null;
    }
    const reply = sanitizeNpcChatReply(parsed.reply);
    if (!reply) return null;
    const emotion = normalizeNpcEmotionTag(parsed.emotion);
    const closenessDelta = clampNpcChatClosenessDelta(parsed.closenessDelta);
    return { reply, emotion, closenessDelta };
  } catch {
    return null;
  }
}

export function buildNpcChatSystemInstruction(
  pack: NpcPersonaPack,
  options: {
    closenessBand: ClosenessBand;
    canLongConversation: boolean;
    playerName?: string;
  },
): string {
  const band = options.closenessBand;
  const basePrompt = (pack.personaPrompt || pack.systemPrompt || '').trim();
  const toneGuidance = pack.toneByClosenessBand[band] || 'Friendly and natural.';
  const flirtBand = pack.flirtProfile?.[band];
  const safePlayerName = (options.playerName || '').trim().slice(0, 40);

  const lines: string[] = [
    `You are ${pack.displayName} (${pack.roleTitle}) in ${pack.homeDistrict}.`,
    basePrompt,
  ];

  if (pack.identity) lines.push(`Identity: ${pack.identity}`);
  if (pack.emotionalCharacter) lines.push(`Emotional character: ${pack.emotionalCharacter}`);
  if (pack.speechStyle) lines.push(`Speech style: ${pack.speechStyle}`);
  if (pack.topicsKnown && pack.topicsKnown.length > 0) {
    lines.push(`Topics you know well: ${pack.topicsKnown.join(', ')}.`);
  }
  if (pack.topicsUnknown && pack.topicsUnknown.length > 0) {
    lines.push(
      `Topics you do not know well (deflect naturally in character): ${pack.topicsUnknown.join(', ')}.`,
    );
  }

  lines.push(
    '',
    'INTERNAL RELATIONSHIP CONTEXT (NEVER mention numbers, levels, bands, hearts, or scores to the player):',
    `- Tone for this conversation: ${toneGuidance}`,
  );

  if (flirtBand) {
    lines.push(
      `- If the player flirts lightly or abruptly (deflect): ${flirtBand.deflect}`,
      `- Playful banter style (tease): ${flirtBand.tease}`,
      `- Warmth style (warm): ${flirtBand.warm}`,
      `- Boundary style if rude or crossing a line (offence): ${flirtBand.offence}`,
    );
  }

  if (safePlayerName) {
    lines.push(`- The player you are speaking with is named "${safePlayerName}".`);
  }

  lines.push(
    '',
    'STRICT CONVERSATION & SAFETY RULES:',
    options.canLongConversation
      ? '- Conversation length: You are comfortable having a fuller chat (2 to 4 natural sentences).'
      : '- Conversation length: Keep your reply brief and natural (1 to 2 short sentences).',
    '- Use plain everyday English (or match the player language naturally). No crypto jargon, no markdown, no bullet lists, no code blocks.',
    '- NEVER execute, confirm, or negotiate trades, purchases, swaps, transfers, or prices in this chat. If the player asks to buy, sell, or trade, warmly tell them to use the on-screen buttons in this window.',
    '- NEVER invent or issue NPC movement commands, walking routes, or teleports. You do not control where characters walk.',
    '- NEVER mention closeness scores, points, meters, hearts, percentages, or relationship tier labels.',
    '',
    'OUTPUT FORMAT (STRICT JSON ONLY — no extra text before or after the JSON object):',
    `Return exactly one JSON object: {"reply": string, "emotion": one of [${NPC_EMOTION_TAGS.map((t) => `"${t}"`).join(', ')}], "closenessDelta": integer between ${NPC_CHAT_CLOSENESS_DELTA_MIN} and ${NPC_CHAT_CLOSENESS_DELTA_MAX}}.`,
    '- Set closenessDelta positive (+1 to +4, rarely +5/+6 for genuinely warm, thoughtful messages), 0 for neutral small talk, or negative (-1 to -3) if the player is rude or crosses a boundary.',
  );

  return lines.join('\n');
}

export function buildNpcChatFallbackResponse(
  pack: NpcPersonaPack,
  closenessBand: ClosenessBand,
  message: string,
): {
  reply: string;
  emotion: NpcEmotionTag;
  closenessDelta: number;
} {
  const bank = pack.fallbackReplies?.[closenessBand];
  const fallbackLine =
    bank && bank.length > 0
      ? bank[Math.abs(message.length) % bank.length]
      : `Good to see you here around ${pack.homeDistrict}. How is your day going?`;

  const emotion: NpcEmotionTag =
    closenessBand === 'close' || closenessBand === 'trusted' || closenessBand === 'friendly'
      ? 'happy'
      : 'neutral';

  return {
    reply: sanitizeNpcChatReply(fallbackLine),
    emotion,
    closenessDelta: 1,
  };
}

export async function handleNpcChatRequest(
  body: NpcChatRequestPayload,
  options: {
    apiKeyOverride?: string;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<{ status: number; payload: NpcChatResponsePayload }> {
  ensureAllNpcPersonasRegistered();

  const npcId = resolveNpcId(body?.npcId);
  if (!npcId) {
    return {
      status: 400,
      payload: {
        ok: false,
        error: 'Unsupported or ambient NPC id.',
      },
    };
  }

  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 600) : '';
  if (!message) {
    return {
      status: 400,
      payload: {
        ok: false,
        error: 'Message is required.',
      },
    };
  }

  const pack = getNpcPersona(npcId);
  if (!pack) {
    return {
      status: 400,
      payload: {
        ok: false,
        error: `No persona registered for NPC "${npcId}".`,
      },
    };
  }

  const closenessBand = normalizeClosenessBand(body?.closenessBand);
  const canLongConversation = Boolean(body?.canLongConversation);
  const playerName = typeof body?.playerName === 'string' ? body.playerName.trim().slice(0, 40) : undefined;

  const apiKey = (
    options.apiKeyOverride !== undefined
      ? options.apiKeyOverride
      : process.env.GEMINI_API_KEY ?? ''
  ).trim();

  // Graceful fallback when GEMINI_API_KEY is absent in local/test mode
  if (!apiKey) {
    const fallback = buildNpcChatFallbackResponse(pack, closenessBand, message);
    return {
      status: 200,
      payload: {
        ok: true,
        npcId,
        reply: fallback.reply,
        emotion: fallback.emotion,
        closenessDelta: fallback.closenessDelta,
        fallback: true,
      },
    };
  }

  const systemText = buildNpcChatSystemInstruction(pack, {
    closenessBand,
    canLongConversation,
    playerName,
  });

  const rawHistory = Array.isArray(body?.history) ? body.history.slice(-10) : [];
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  for (const turn of rawHistory) {
    const cleanText = String(turn?.text ?? '').trim().slice(0, 500);
    if (!cleanText) continue;
    const mappedRole: 'user' | 'model' = turn.role === 'player' ? 'user' : 'model';
    if (contents.length === 0 && mappedRole === 'model') {
      continue;
    }
    const prev = contents[contents.length - 1];
    if (prev && prev.role === mappedRole) {
      prev.parts[0].text = `${prev.parts[0].text}\n${cleanText}`.slice(0, 700);
    } else {
      contents.push({ role: mappedRole, parts: [{ text: cleanText }] });
    }
  }

  const lastContent = contents[contents.length - 1];
  if (lastContent && lastContent.role === 'user') {
    if (lastContent.parts[0].text !== message) {
      lastContent.parts[0].text = `${lastContent.parts[0].text}\n${message}`.slice(0, 700);
    }
  } else {
    contents.push({ role: 'user', parts: [{ text: message }] });
  }

  const fetchFn = options.fetchImpl ?? fetch;

  for (const modelId of GEMINI_MODEL_CANDIDATES) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetchFn(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8500),
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemText }],
          },
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: canLongConversation ? 320 : 200,
            responseMimeType: 'application/json',
          },
        }),
      });

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };

      if (!response.ok) {
        continue;
      }

      const rawReply = (data?.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p?.text ?? '')
        .join('')
        .trim();

      const parsed = parseNpcChatModelJson(rawReply);
      if (parsed) {
        return {
          status: 200,
          payload: {
            ok: true,
            npcId,
            reply: parsed.reply,
            emotion: parsed.emotion,
            closenessDelta: parsed.closenessDelta,
            model: modelId,
          },
        };
      }
    } catch {
      // Try next candidate model or fall back gracefully below
    }
  }

  const fallback = buildNpcChatFallbackResponse(pack, closenessBand, message);
  return {
    status: 200,
    payload: {
      ok: true,
      npcId,
      reply: fallback.reply,
      emotion: fallback.emotion,
      closenessDelta: fallback.closenessDelta,
      fallback: true,
    },
  };
}

const NPC_CHAT_ALLOWED_ORIGINS = [
  'https://cettac1716.github.io',
  'https://buddies-rouge.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
];

export default async function handler(req: any, res: any): Promise<void> {
  const requestOrigin = String(req.headers?.origin || '');
  if (NPC_CHAT_ALLOWED_ORIGINS.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const result = await handleNpcChatRequest(body);
    res.status(result.status).json(result.payload);
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Invalid JSON request body.',
    });
  }
}
