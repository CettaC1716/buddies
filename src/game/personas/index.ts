import {
  getNpcPersona,
  registerNpcPersona,
  type NpcPersonaPack,
} from '../npcPersonaRegistry';
import type { NpcId } from '../npcClosenessEngine';
import { HANA_PERSONA } from './hana';
import { KAI_PERSONA } from './kai';
import { MIRA_PERSONA } from './mira';
import { NADIA_PERSONA } from './nadia';
import { TARI_PERSONA } from './tari';
import { BIMA_PERSONA } from './bima';
import { KENJI_PERSONA } from './kenji';
import { RAKA_PERSONA } from './raka';

/**
 * Aggregates all 8 named NPC persona packs.
 * Each individual file (`src/game/personas/<npc>.ts`) is owned by its respective
 * persona agent so all 8 can be authored in parallel with zero merge conflicts.
 */
export const ALL_NPC_PERSONAS: Readonly<Record<NpcId, NpcPersonaPack>> = {
  hana: HANA_PERSONA,
  kai: KAI_PERSONA,
  mira: MIRA_PERSONA,
  nadia: NADIA_PERSONA,
  tari: TARI_PERSONA,
  bima: BIMA_PERSONA,
  kenji: KENJI_PERSONA,
  raka: RAKA_PERSONA,
};

/**
 * Ensures all 8 named NPC persona packs (and their gift preferences) are registered
 * in `npcPersonaRegistry` and `npcGiftEngine`. Safe to call multiple times (e.g. after
 * test resets).
 */
export function ensureAllNpcPersonasRegistered(): void {
  for (const pack of Object.values(ALL_NPC_PERSONAS)) {
    if (!getNpcPersona(pack.npcId)) {
      registerNpcPersona(pack);
    }
  }
}

export {
  HANA_PERSONA,
  KAI_PERSONA,
  MIRA_PERSONA,
  NADIA_PERSONA,
  TARI_PERSONA,
  BIMA_PERSONA,
  KENJI_PERSONA,
  RAKA_PERSONA,
};
