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
 * Per-NPC Persona Registry (Foundation F1)
 * ========================================
 * Provides the shared contract and registration API so each of the 7 persona agents
 * can author its own dedicated file (`src/game/personas/<npc>.ts`) with zero merge
 * conflicts. Registering a persona pack automatically registers its gift preference
 * table in the Gift Engine.
 *
 * NOTE: This file contains types and registry plumbing ONLY — no NPC persona prompts,
 * schedules, or dialogues live here.
 */

export type NpcTimeSlotWindow = 'morning' | 'afternoon' | 'evening' | 'night';

export interface NpcScheduleSlot {
  window: NpcTimeSlotWindow;
  /** Deterministic waypoint or district spot ID for F3 movement (LLM never decides movement). */
  waypointId: string;
  /** Plain-English activity hint (e.g. 'brewing coffee at the counter'). */
  activityLabel: string;
}

export interface NpcVoiceProfile {
  voiceName?: string;
  tone?: string;
  pace?: string;
}

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
  /** Base system prompt / personality seed used by F2 conversation runtime. */
  systemPrompt: string;
  /**
   * Internal tone/warmth/flirt guidance scaled by closeness band for F2 ONLY.
   * Never surfaced in UI.
   */
  toneByClosenessBand: Record<ClosenessBand, string>;
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
