import {
  getLocalClosenessDateKey,
  getNpcClosenessBand,
  getNpcClosenessRecord,
  type ClosenessBand,
  type NpcClosenessStore,
  type NpcId,
} from './npcClosenessEngine';
import type { UrbanScooterKind } from './buddiesUrbanScooterRules';
import type { WardrobeCatalogItem } from './buddiesWardrobeStudioRules';
import {
  detectChatTogethernessIntent,
  evaluateTogethernessInvitation,
} from './npcTogethernessSession';

/**
 * ============================================================================
 * NPC TOGETHERNESS THROUGH PROGRESSIVE CHAT — REGISTRY, PACING & CHIP LIFECYCLE
 * ============================================================================
 * - Data-driven category registry mapping all paired animations to
 *   { category, minBand } (unmapped items default to `fun_pose`).
 * - Per-category band gating: hold_hands / dance / sit_together / fun_pose (friendly),
 *   hug (close), kiss (trusted). Acceptance for one category never opens another.
 * - Anti-spam pacing: per-category per-day diminishing closeness returns (100% -> 50% -> 0%)
 *   plus per-category cooldown ("enough for now").
 * - Live pending dock chip lifecycle with silent, free expiry:
 *   (a) 3 subsequent chat turns on other topics, (b) 90s idle, (c) any context break.
 */

export type PairedPoseCategory =
  | 'hold_hands'
  | 'hug'
  | 'kiss'
  | 'dance'
  | 'sit_together'
  | 'fun_pose';

export type TogethernessActionCategory =
  | 'ride'
  | 'walk'
  | PairedPoseCategory;

export type ChatVerdictIntent = TogethernessActionCategory | 'end' | null;

export const DOCK_CHIP_EXPIRY_MS = 90_000;
export const DOCK_CHIP_MAX_OTHER_TURNS = 3;
export const CATEGORY_COOLDOWN_MS = 10 * 60 * 1000;
export const DOCK_SEEN_LABELS_STORAGE_KEY = 'bb_npc_dock_seen_v1';

const BAND_RANK: Readonly<Record<ClosenessBand, number>> = {
  stranger: 0,
  acquaintance: 1,
  friendly: 2,
  close: 3,
  trusted: 4,
};

export function isBandAtLeast(current: ClosenessBand, required: ClosenessBand): boolean {
  return BAND_RANK[current] >= BAND_RANK[required];
}

export interface PairedCategorySpec {
  category: PairedPoseCategory;
  minBand: ClosenessBand;
  label: string;
}

/**
 * Band-gated progression per category:
 * - hold_hands, dance, sit_together, fun_pose: `friendly` (score >= 45)
 * - hug: `close` (score >= 68)
 * - kiss: `trusted` (score >= 85)
 */
export const PAIRED_CATEGORY_SPECS: Readonly<Record<PairedPoseCategory, PairedCategorySpec>> = {
  hold_hands: { category: 'hold_hands', minBand: 'friendly', label: 'Hold Hands' },
  dance: { category: 'dance', minBand: 'friendly', label: 'Dance' },
  sit_together: { category: 'sit_together', minBand: 'friendly', label: 'Sit Together' },
  fun_pose: { category: 'fun_pose', minBand: 'friendly', label: 'Photo Pose' },
  hug: { category: 'hug', minBand: 'close', label: 'Hug' },
  kiss: { category: 'kiss', minBand: 'trusted', label: 'Kiss' },
};

export const TOGETHERNESS_ACTION_LABELS: Readonly<Record<TogethernessActionCategory | 'end', string>> = {
  ride: 'Ride',
  walk: 'Walk',
  hold_hands: 'Hold Hands',
  hug: 'Hug',
  kiss: 'Kiss',
  dance: 'Dance',
  sit_together: 'Sit',
  fun_pose: 'Photo Pose',
  end: 'End',
};

export interface PairedAnimationRegistryEntry {
  category: PairedPoseCategory;
  minBand: ClosenessBand;
}

/**
 * Data-driven registry for all 57 paired animation items in `public/assets/animations/catalog.json`.
 * Unmapped items default to `{ category: 'fun_pose', minBand: 'friendly' }`.
 */
export const PAIRED_ANIMATION_CATEGORY_REGISTRY: Readonly<
  Record<string, PairedAnimationRegistryEntry>
> = {
  // DANCE (14 items — minBand: friendly)
  anim_paired_1b3879a9_interdance_cottagecore02: { category: 'dance', minBand: 'friendly' },
  anim_paired_2597cce7_interdance_swing02: { category: 'dance', minBand: 'friendly' },
  anim_paired_29e00185_interdance_swing01: { category: 'dance', minBand: 'friendly' },
  anim_paired_2d41846_interdance_ballroom04: { category: 'dance', minBand: 'friendly' },
  anim_paired_4b1e57bf_interdance_meme01_p2: { category: 'dance', minBand: 'friendly' },
  anim_paired_79549142_interdance_bachata02: { category: 'dance', minBand: 'friendly' },
  anim_paired_8148d62e_interdance_flying_ballroom02: { category: 'dance', minBand: 'friendly' },
  anim_paired_89547c05_interdance_ballroom05: { category: 'dance', minBand: 'friendly' },
  anim_paired_96945da9_interdance_rising_mercury02: { category: 'dance', minBand: 'friendly' },
  anim_paired_b3158bb8_interdance_buddies04: { category: 'dance', minBand: 'friendly' },
  anim_paired_becb4199_interdance_cottagecore_naustalgia01: { category: 'dance', minBand: 'friendly' },
  anim_paired_d1d53546_interdance_flying_ballroom03: { category: 'dance', minBand: 'friendly' },
  anim_paired_de846828_interdance_sirtaki_fusion02: { category: 'dance', minBand: 'friendly' },
  anim_paired_fe15e0cb_interdance_sirtaki_fusion01: { category: 'dance', minBand: 'friendly' },

  // HUG (14 items — minBand: close)
  anim_paired_17e663a_interpose_hugs03: { category: 'hug', minBand: 'close' },
  anim_paired_22f7c3cc_interpose_morning_hug01: { category: 'hug', minBand: 'close' },
  anim_paired_2a7f48e1_interpose_besties_hug02: { category: 'hug', minBand: 'close' },
  anim_paired_53c18956_interpose_winter_love: { category: 'hug', minBand: 'close' },
  anim_paired_5985c0d7_interpose_magical_hug01: { category: 'hug', minBand: 'close' },
  anim_paired_61a88358_interpose_hugs01: { category: 'hug', minBand: 'close' },
  anim_paired_6b155d4a_interpose_sider_hug01: { category: 'hug', minBand: 'close' },
  anim_paired_97309119_interpose_winter_love01: { category: 'hug', minBand: 'close' },
  anim_paired_c04e7773_interpose_cuddle01: { category: 'hug', minBand: 'close' },
  anim_paired_c54f9a59_interpose_hugs04: { category: 'hug', minBand: 'close' },
  anim_paired_c794602f_interpose_embrace01: { category: 'hug', minBand: 'close' },
  anim_paired_cd9aefb2_interpose_winter_hugs01: { category: 'hug', minBand: 'close' },
  anim_paired_d8513663_interpose_winter_hugs04: { category: 'hug', minBand: 'close' },
  anim_paired_fb17b9ac_interpose_morning_hug02: { category: 'hug', minBand: 'close' },

  // KISS (5 items — minBand: trusted)
  anim_paired_43821d3f_interpose_bridal_couple01: { category: 'kiss', minBand: 'trusted' },
  anim_paired_a1299723_interpose_london_lovers01: { category: 'kiss', minBand: 'trusted' },
  anim_paired_b49a5c2c_interpose_affection02: { category: 'kiss', minBand: 'trusted' },
  anim_paired_d4343360_interpose_classic_romance01: { category: 'kiss', minBand: 'trusted' },
  anim_paired_fbe74009_interpose_enchanting_couple01: { category: 'kiss', minBand: 'trusted' },

  // HOLD HANDS (4 items — minBand: friendly)
  anim_paired_4697a186_interpose_best_mates09: { category: 'hold_hands', minBand: 'friendly' },
  anim_paired_8b964fa5_interpose_cutie03: { category: 'hold_hands', minBand: 'friendly' },
  anim_paired_a187d9ef_interpose_cozy02: { category: 'hold_hands', minBand: 'friendly' },
  anim_paired_aab3fced_interpose_careless_in_love01: { category: 'hold_hands', minBand: 'friendly' },

  // SIT TOGETHER (5 items — minBand: friendly)
  anim_paired_31fc4fd4_interpose_inseparable06: { category: 'sit_together', minBand: 'friendly' },
  anim_paired_5248812a_interpose_in_clouds03: { category: 'sit_together', minBand: 'friendly' },
  anim_paired_6a25c9e_interpose_pride_moments03: { category: 'sit_together', minBand: 'friendly' },
  anim_paired_c9169b00_interpose_togetherforever01: { category: 'sit_together', minBand: 'friendly' },
  anim_paired_e29ebc5_interpose_cottagecore_picnic05: { category: 'sit_together', minBand: 'friendly' },

  // FUN POSE / PHOTO POSE (15 items — minBand: friendly)
  anim_paired_2f102a8e_interpose_editorial_fashion05: { category: 'fun_pose', minBand: 'friendly' },
  anim_paired_365d1805_interpose_ikon_elite01: { category: 'fun_pose', minBand: 'friendly' },
  anim_paired_44f22885_interpose_selfies05: { category: 'fun_pose', minBand: 'friendly' },
  anim_paired_4651ee8a_interpose_pool_party03: { category: 'fun_pose', minBand: 'friendly' },
  anim_paired_48b59209_interpose_supermodel03: { category: 'fun_pose', minBand: 'friendly' },
  anim_paired_60541475_interpose_paired_fashion01: { category: 'fun_pose', minBand: 'friendly' },
  anim_paired_64e82374_interpose_best_mates05: { category: 'fun_pose', minBand: 'friendly' },
  anim_paired_73f0362a_interpose_buddies03: { category: 'fun_pose', minBand: 'friendly' },
  anim_paired_845d5bbb_interpose_scooter01: { category: 'fun_pose', minBand: 'friendly' },
  anim_paired_8f46c85f_interpose_fashion_photoshoot16: { category: 'fun_pose', minBand: 'friendly' },
  anim_paired_b71a34f3_interpose_pool_party01: { category: 'fun_pose', minBand: 'friendly' },
  anim_paired_cc1888d2_interpose_easy_going02: { category: 'fun_pose', minBand: 'friendly' },
  anim_paired_cd2b8591_interpose_afraid01: { category: 'fun_pose', minBand: 'friendly' },
  anim_paired_d665854a_interpose_fashion_photoshoot19: { category: 'fun_pose', minBand: 'friendly' },
  anim_paired_fc456930_interpose_girlygreet01: { category: 'fun_pose', minBand: 'friendly' },
};

export function resolvePairedAnimationCategory(animId: string): PairedAnimationRegistryEntry {
  return (
    PAIRED_ANIMATION_CATEGORY_REGISTRY[animId] ?? {
      category: 'fun_pose',
      minBand: 'friendly',
    }
  );
}

export function getPairedCategoryCounts(): Record<PairedPoseCategory, number> {
  const counts: Record<PairedPoseCategory, number> = {
    hold_hands: 0,
    hug: 0,
    kiss: 0,
    dance: 0,
    sit_together: 0,
    fun_pose: 0,
  };
  for (const entry of Object.values(PAIRED_ANIMATION_CATEGORY_REGISTRY)) {
    counts[entry.category] += 1;
  }
  return counts;
}

export function filterPairedItemsForAcceptedCategory(params: {
  ownedPairedItems: readonly WardrobeCatalogItem[];
  category: PairedPoseCategory;
  currentBand: ClosenessBand;
}): WardrobeCatalogItem[] {
  return params.ownedPairedItems.filter((item) => {
    const entry = resolvePairedAnimationCategory(item.id);
    if (entry.category !== params.category) return false;
    return isBandAtLeast(params.currentBand, entry.minBand);
  });
}

// ============================================================================
// NATURAL CHAT INTENT DETECTION (ALL CATEGORIES)
// ============================================================================

const POSE_INTENT_PATTERNS: ReadonlyArray<{
  category: PairedPoseCategory;
  patterns: readonly RegExp[];
}> = [
  {
    category: 'kiss',
    patterns: [
      /\b(kiss|smooch|peck on)\b/i,
      /\b(cium\w*|kecup\w*)/i,
    ],
  },
  {
    category: 'hug',
    patterns: [
      /\b(hug|embrace|cuddle|hold me)\b/i,
      /\b(peluk\w*|rangkul\w*)/i,
    ],
  },
  {
    category: 'hold_hands',
    patterns: [
      /\b(hold hands|hold my hand|take my hand)\b/i,
      /\b(pegang\s+tangan\w*|gandeng\w*)/i,
    ],
  },
  {
    category: 'dance',
    patterns: [
      /\b(dance|waltz|bachata|swing dance|groove together)\b/i,
      /\b(joget\w*|dansa\w*|menari|tari\s+bareng|ayo\s+dansa|yuk\s+dansa)/i,
    ],
  },
  {
    category: 'sit_together',
    patterns: [
      /\b(sit together|sit with me|sit beside me|have a seat together)\b/i,
      /\b(duduk\s+bareng|duduk\s+bersama|duduk\s+sini|duduk\s+sebelah)/i,
    ],
  },
  {
    category: 'fun_pose',
    patterns: [
      /\b(photo pose|take a photo|take a selfie|duo pose|pair pose|pose together|selfie together)\b/i,
      /\b(foto\s+bareng|selfie\s+bareng|pose\s+bareng|gaya\s+bareng)/i,
    ],
  },
];

/**
 * Detects any togetherness intent in natural player chat:
 * end | ride | walk | hold_hands | hug | kiss | dance | sit_together | fun_pose | null.
 */
export function detectProgressiveChatIntent(rawText: string): ChatVerdictIntent {
  const clean = (rawText || '').trim();
  if (!clean) return null;
  const base = detectChatTogethernessIntent(clean);
  if (base) return base;
  for (const group of POSE_INTENT_PATTERNS) {
    if (group.patterns.some((re) => re.test(clean))) {
      return group.category;
    }
  }
  return null;
}

// ============================================================================
// ANTI-SPAM PACING (PER-CATEGORY DIMINISHING RETURNS + COOLDOWN)
// ============================================================================

export interface CategoryPacingEntry {
  dateKey: string;
  countToday: number;
  lastCompletedAtMs: number;
}

export type NpcPacingStore = Record<string, Record<string, CategoryPacingEntry>>;

export function createEmptyNpcPacingStore(): NpcPacingStore {
  return {};
}

export function computeDiminishingClosenessDelta(
  baseDelta: number,
  completedTodayCount: number,
): number {
  if (completedTodayCount <= 0) return baseDelta;
  if (completedTodayCount === 1) return Math.floor(baseDelta * 0.5);
  return 0;
}

export function isCategoryOnCooldown(params: {
  pacingStore: NpcPacingStore;
  npcId: NpcId;
  category: TogethernessActionCategory;
  nowMs?: number;
  cooldownMs?: number;
}): boolean {
  const nowMs = params.nowMs ?? Date.now();
  const cooldownMs = params.cooldownMs ?? CATEGORY_COOLDOWN_MS;
  const entry = params.pacingStore[params.npcId]?.[params.category];
  if (!entry) return false;
  return nowMs - entry.lastCompletedAtMs < cooldownMs;
}

export function recordCompletedCategorySession(params: {
  pacingStore: NpcPacingStore;
  npcId: NpcId;
  category: TogethernessActionCategory;
  baseClosenessDelta: number;
  nowMs?: number;
}): {
  pacingStore: NpcPacingStore;
  awardedClosenessDelta: number;
  countToday: number;
} {
  const nowMs = params.nowMs ?? Date.now();
  const dateKey = getLocalClosenessDateKey(nowMs);
  const prevNpc = params.pacingStore[params.npcId] ?? {};
  const prev = prevNpc[params.category];
  const prevCountToday = prev && prev.dateKey === dateKey ? prev.countToday : 0;
  const awardedClosenessDelta = computeDiminishingClosenessDelta(
    params.baseClosenessDelta,
    prevCountToday,
  );
  const nextCountToday = prevCountToday + 1;

  return {
    awardedClosenessDelta,
    countToday: nextCountToday,
    pacingStore: {
      ...params.pacingStore,
      [params.npcId]: {
        ...prevNpc,
        [params.category]: {
          dateKey,
          countToday: nextCountToday,
          lastCompletedAtMs: nowMs,
        },
      },
    },
  };
}

// ============================================================================
// VERDICT-CONDITIONED EVALUATION FOR ANY CATEGORY
// ============================================================================

const ACCEPT_LINES: Readonly<Record<PairedPoseCategory, string>> = {
  hold_hands: "Sure, I'd like that. Tap the icon when you're ready.",
  hug: "Come here, I could use a warm hug too. Tap the icon whenever you're ready.",
  kiss: "You really know how to make me blush... okay, tap the icon when you're ready.",
  dance: "Ooh, I'm always up for a dance! Tap the dance icon and pick our move.",
  sit_together: "Sounds lovely—let's sit and take a breather together. Tap the icon when ready.",
  fun_pose: "Let's strike a pose! Tap the camera icon and pick which one you want.",
};

const DECLINE_LINES: Readonly<Record<PairedPoseCategory, string>> = {
  hold_hands: "Easy there—let's hang out a bit more before we get that cozy, alright?",
  hug: "Aw, that's sweet, though I'd like to get to know you a little better first.",
  kiss: "Whoa, slow down there! Let's build a bit more trust between us first, okay?",
  dance: "Maybe once we've hung out a bit more—I'm still warming up to you!",
  sit_together: "Let's chat a little more first, then we can grab a spot together sometime.",
  fun_pose: "I'm a bit camera-shy with people I just met—let's talk a bit longer first!",
};

const COOLDOWN_LINES: Readonly<Record<TogethernessActionCategory, string>> = {
  ride: "That was a great ride—let's catch our breath for a bit before heading out again!",
  walk: "My feet could use a quick break after our stroll—let's chat here for a little while.",
  hold_hands: "We just held hands a moment ago—give me a little breather, okay?",
  hug: "Haha, I'm all hugged out for the moment! Let's just talk for a bit.",
  kiss: "Easy, my heart's still racing from a minute ago—let's savour the moment first.",
  dance: "Phew, I need to catch my breath after that dance! Ask me again in a little bit.",
  sit_together: "We just sat together—let's stretch our legs a bit before sitting down again.",
  fun_pose: "Let's save the next photoshoot for a little later—my smile needs a rest!",
};

export interface CategoryVerdictResult {
  accepted: boolean;
  category: TogethernessActionCategory;
  reason: 'accepted' | 'phone_chat_blocked' | 'cooldown' | 'closeness_too_low' | 'wrong_vehicle';
  replyLine: string;
}

/**
 * Evaluates a negotiated togetherness category in natural chat:
 * - Phone chat NEVER accepts or surfaces chips.
 * - Cooldown deflects warmly in character with NO chip.
 * - Ride/Walk route through existing `evaluateTogethernessInvitation`.
 * - Paired pose categories check their individual `minBand` from `PAIRED_CATEGORY_SPECS`.
 */
export function evaluateProgressiveCategoryVerdict(params: {
  store: NpcClosenessStore;
  pacingStore: NpcPacingStore;
  npcId: NpcId;
  category: TogethernessActionCategory;
  isInPerson: boolean;
  playerScooterKind: UrbanScooterKind | null;
  nowMs?: number;
}): CategoryVerdictResult {
  const nowMs = params.nowMs ?? Date.now();
  if (!params.isInPerson) {
    return {
      accepted: false,
      category: params.category,
      reason: 'phone_chat_blocked',
      replyLine: "We'll have to meet up in person for that—come find me in town!",
    };
  }

  if (
    isCategoryOnCooldown({
      pacingStore: params.pacingStore,
      npcId: params.npcId,
      category: params.category,
      nowMs,
    })
  ) {
    return {
      accepted: false,
      category: params.category,
      reason: 'cooldown',
      replyLine: COOLDOWN_LINES[params.category],
    };
  }

  if (params.category === 'ride' || params.category === 'walk') {
    const decision = evaluateTogethernessInvitation({
      store: params.store,
      npcId: params.npcId,
      kind: params.category,
      playerScooterKind: params.playerScooterKind,
      nowMs,
    });
    if (!decision.accepted) {
      return {
        accepted: false,
        category: params.category,
        reason: decision.reason === 'closeness_too_low' ? 'closeness_too_low' : 'wrong_vehicle',
        replyLine: decision.replyLine,
      };
    }
    return {
      accepted: true,
      category: params.category,
      reason: 'accepted',
      replyLine: decision.replyLine,
    };
  }

  // Paired animation category — individually band-gated
  const spec = PAIRED_CATEGORY_SPECS[params.category];
  const currentBand = getNpcClosenessBand(params.store, params.npcId, nowMs);
  // Ensure closeness record exists (pure read)
  getNpcClosenessRecord(params.store, params.npcId);
  if (!isBandAtLeast(currentBand, spec.minBand)) {
    return {
      accepted: false,
      category: params.category,
      reason: 'closeness_too_low',
      replyLine: DECLINE_LINES[params.category],
    };
  }

  return {
    accepted: true,
    category: params.category,
    reason: 'accepted',
    replyLine: ACCEPT_LINES[params.category],
  };
}

// ============================================================================
// ADDENDUM — DOCK CHIP LIFECYCLE (EXPIRY)
// ============================================================================

export interface PendingDockChip {
  npcId: NpcId;
  category: TogethernessActionCategory;
  acceptedAtMs: number;
  otherTopicTurns: number;
}

export function createPendingDockChip(
  npcId: NpcId,
  category: TogethernessActionCategory,
  nowMs: number = Date.now(),
): PendingDockChip {
  return {
    npcId,
    category,
    acceptedAtMs: nowMs,
    otherTopicTurns: 0,
  };
}

export function advancePendingChipOtherTurn(
  chip: PendingDockChip | null,
): PendingDockChip | null {
  if (!chip) return null;
  const nextTurns = chip.otherTopicTurns + 1;
  if (nextTurns >= DOCK_CHIP_MAX_OTHER_TURNS) {
    return null;
  }
  return { ...chip, otherTopicTurns: nextTurns };
}

export function isPendingDockChipExpired(
  chip: PendingDockChip | null,
  context: {
    nowMs?: number;
    isChatOpen: boolean;
    isInPerson: boolean;
    isInProximity: boolean;
    activeNpcId: NpcId | null;
    playerScooterKind: UrbanScooterKind | null;
    expiryMs?: number;
  },
): boolean {
  if (!chip) return true;
  const nowMs = context.nowMs ?? Date.now();
  const expiryMs = context.expiryMs ?? DOCK_CHIP_EXPIRY_MS;
  if (!context.isChatOpen || !context.isInPerson || !context.isInProximity) return true;
  if (context.activeNpcId !== chip.npcId) return true;
  if (chip.otherTopicTurns >= DOCK_CHIP_MAX_OTHER_TURNS) return true;
  if (nowMs - chip.acceptedAtMs >= expiryMs) return true;
  if (chip.category === 'ride' && context.playerScooterKind !== 'electric_scooter_bike') {
    return true;
  }
  return false;
}
