import type { CitizenId } from './buddiesCitizenRoles';
import {
  NAMED_NPC_IDS,
  npcIdToCitizenId,
  resolveNpcId,
  type ClosenessBand,
  type NpcId,
} from './npcClosenessEngine';
import {
  registerNpcGiftPreferences,
  unregisterNpcGiftPreferencesForTests,
  clearNpcGiftPreferencesForTests,
  type GiftReactionTier,
  type NpcGiftPreferenceTable,
} from './npcGiftEngine';

/**
 * Per-NPC Persona Registry (Foundation F1 + F2 Schema)
 * ====================================================
 * Provides the shared contract and registration API so each of the 7 persona agents
 * can author its own dedicated file (`src/game/personas/<npc>.ts`) with zero merge
 * conflicts. Registering a persona pack automatically registers its gift preference
 * table in the Gift Engine.
 *
 * NOTE: This file contains types and registry plumbing ONLY — no rich NPC persona
 * prompts, schedules, or dialogues live here.
 */

export const NPC_EMOTION_TAGS = [
  'neutral',
  'happy',
  'laugh',
  'shy',
  'surprised',
  'sad',
  'annoyed',
  'proud',
  'awkward',
] as const;

export type NpcEmotionTag = (typeof NPC_EMOTION_TAGS)[number];

const NPC_EMOTION_TAG_SET: ReadonlySet<string> = new Set(NPC_EMOTION_TAGS);

export function isNpcEmotionTag(value: unknown): value is NpcEmotionTag {
  return typeof value === 'string' && NPC_EMOTION_TAG_SET.has(value);
}

export function normalizeNpcEmotionTag(value: unknown): NpcEmotionTag {
  if (typeof value !== 'string') return 'neutral';
  const normalized = value.trim().toLowerCase();
  return isNpcEmotionTag(normalized) ? normalized : 'neutral';
}

export type NpcTimeSlotWindow = 'morning' | 'afternoon' | 'evening' | 'night';

export interface NpcScheduleSlot {
  window: NpcTimeSlotWindow;
  /** Deterministic city anchor / waypoint ID for F3 movement (LLM never decides movement). */
  waypointId: string;
  /** Optional explicit city anchor ID alias for F3 schedule resolution. */
  anchorId?: string;
  /** Optional world-clock start hour [0..24) for deterministic schedule evaluation. */
  startHour?: number;
  /** Optional world-clock end hour (0..24] for deterministic schedule evaluation. */
  endHour?: number;
  /** Plain-English activity hint (e.g. 'brewing coffee at the counter'). */
  activityLabel: string;
}

export interface NpcVoiceProfile {
  voiceName?: string;
  tone?: string;
  pace?: string;
}

export interface NpcFlirtBandBehavior {
  /** How this NPC deflects premature or unwanted flirting at this closeness band. */
  deflect: string;
  /** Playful teasing guidance appropriate for this closeness band. */
  tease: string;
  /** Warm / affectionate response style appropriate for this closeness band. */
  warm: string;
  /** Boundary / offence response when the player crosses the line at this closeness band. */
  offence: string;
}

export type NpcFlirtProfile = Record<ClosenessBand, NpcFlirtBandBehavior>;

export interface NpcActivityPreferences {
  preferredWalkSpots?: readonly string[];
  preferredPhotoSpots?: readonly string[];
  enjoysScooterRide?: boolean;
}

export interface NpcPersonaPack {
  npcId: NpcId;
  citizenId?: CitizenId;
  displayName: string;
  roleTitle: string;
  homeDistrict: string;
  /** Concise identity summary for this NPC (populated in `src/game/personas/<npc>.ts`). */
  identity?: string;
  /** Core emotional character traits and temperament. */
  emotionalCharacter?: string;
  /** Everyday speech style, cadence, and phrasing habits. */
  speechStyle?: string;
  /** Topics this NPC naturally knows and enjoys discussing. */
  topicsKnown?: readonly string[];
  /** Topics this NPC does not know well or deflects naturally in character. */
  topicsUnknown?: readonly string[];
  /** Server-locked base persona prompt used by `/api/npc-chat` (falls back to `systemPrompt`). */
  personaPrompt?: string;
  /** Base system prompt / personality seed used by F2 conversation runtime. */
  systemPrompt: string;
  /**
   * Internal tone/warmth/flirt guidance scaled by closeness band for F2 ONLY.
   * Never surfaced in UI.
   */
  toneByClosenessBand: Record<ClosenessBand, string>;
  /**
   * Persona-driven deflect / tease / warm / offence behavior by internal ClosenessBand.
   * Used server-side only; never surfaced in UI.
   */
  flirtProfile?: NpcFlirtProfile;
  /**
   * Verified animation clip names per emotion tag for this NPC's rig.
   * Any missing emotion tag falls back to expressive idle.
   */
  emotionAnimations?: Partial<Record<NpcEmotionTag, string>>;
  /** Gift preferences automatically wired into `npcGiftEngine` on registration. */
  giftPreferences: NpcGiftPreferenceTable;
  /** Optional plain-English reaction guidance or fallback lines per gift tier. */
  giftReactionLines?: Partial<Record<GiftReactionTier, readonly string[]>>;
  /** Optional fallback replies if LLM is offline or unavailable. */
  fallbackReplies?: Partial<Record<ClosenessBand, readonly string[]>>;
  conversationTopics?: readonly string[];
  voiceProfile?: NpcVoiceProfile;
  /** Deterministic daily schedule slots consumed by F3 (never LLM-driven). */
  schedule?: readonly NpcScheduleSlot[];
  activityPreferences?: NpcActivityPreferences;
}

const personaRegistry = new Map<NpcId, NpcPersonaPack>();

/**
 * Registers a single NPC's persona pack and automatically wires its gift preference
 * table into the Gift Engine.
 */
export function registerNpcPersona(pack: NpcPersonaPack): NpcPersonaPack {
  const npcId = resolveNpcId(pack.npcId);
  if (!npcId) {
    throw new Error(`Cannot register persona for unknown NPC: "${pack.npcId}"`);
  }
  const normalized: NpcPersonaPack = {
    ...pack,
    npcId,
    citizenId: pack.citizenId ?? npcIdToCitizenId(npcId),
    personaPrompt: pack.personaPrompt ?? pack.systemPrompt,
    giftPreferences: {
      ...pack.giftPreferences,
      npcId,
    },
  };
  personaRegistry.set(npcId, normalized);
  registerNpcGiftPreferences(normalized.giftPreferences);
  return normalized;
}

export function getNpcPersona(rawNpcId: string): NpcPersonaPack | null {
  const npcId = resolveNpcId(rawNpcId);
  if (!npcId) return null;
  return personaRegistry.get(npcId) ?? null;
}

export function hasRegisteredNpcPersona(rawNpcId: string): boolean {
  return getNpcPersona(rawNpcId) !== null;
}

export function listRegisteredNpcPersonas(): NpcPersonaPack[] {
  const out: NpcPersonaPack[] = [];
  for (const npcId of NAMED_NPC_IDS) {
    const pack = personaRegistry.get(npcId);
    if (pack) out.push(pack);
  }
  return out;
}

export function unregisterNpcPersonaForTests(npcId: NpcId): void {
  personaRegistry.delete(npcId);
  unregisterNpcGiftPreferencesForTests(npcId);
}

export function clearNpcPersonaRegistryForTests(): void {
  personaRegistry.clear();
  clearNpcGiftPreferencesForTests();
}
