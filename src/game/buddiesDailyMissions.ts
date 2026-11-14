import type { CityTransitStationId } from './buddiesBlitzRules';

export type DailyMissionId =
  | 'meet_kai'
  | 'work_cafe'
  | 'go_fishing'
  | 'visit_claimed_house';

export interface DailyMissionDefinition {
  id: DailyMissionId;
  title: string;
  description: string;
  hintText: string;
  targetCount: number;
  rewardLul: number;
  rewardXp: number;
  shortcutStationId: CityTransitStationId;
  shortcutLabel: string;
}

export interface DailyMissionProgressEntry {
  progress: number;
  claimed: boolean;
  completedAtIso: string | null;
  claimedAtIso: string | null;
}

export interface DailyMissionsState {
  dateKey: string;
  missions: Record<DailyMissionId, DailyMissionProgressEntry>;
  bonusClaimed: boolean;
  bonusClaimedAtIso: string | null;
}

export interface DailyMissionsSummary {
  completedCount: number;
  totalCount: number;
  claimableMissionCount: number;
  bonusReady: boolean;
  bonusClaimed: boolean;
  allClaimed: boolean;
  actionableCount: number;
}

export const DAILY_ALL_CLEAR_BONUS = {
  rewardLul: 60,
  rewardXp: 80,
} as const;

export const DAILY_MISSIONS_CATALOG: readonly DailyMissionDefinition[] = [
  {
    id: 'meet_kai',
    title: 'Meet Kai at Beachfront Harbor',
    description: 'Say hello to coastal merchant Kai at Kai Fish Market or on the pier.',
    hintText: 'Head to Kai Fish Market at the east boardwalk and open a chat with Kai.',
    targetCount: 1,
    rewardLul: 25,
    rewardXp: 30,
    shortcutStationId: 'kai_fish_market',
    shortcutLabel: 'GO TO KAI',
  },
  {
    id: 'work_cafe',
    title: 'Work a Shift at Glasshouse Cafe',
    description: 'Clock in as a barista at Glasshouse Cafe and serve a customer order.',
    hintText: 'Enter Glasshouse Cafe in Central Plaza, start a shift, and serve 1 order.',
    targetCount: 1,
    rewardLul: 35,
    rewardXp: 40,
    shortcutStationId: 'central_plaza',
    shortcutLabel: 'GO TO CAFE',
  },
  {
    id: 'go_fishing',
    title: 'Catch a Fish',
    description: 'Cast your fishing rod and reel in a catch at Beachfront Harbor or NW Lake.',
    hintText: 'Equip your fishing rod near water and land 1 catch.',
    targetCount: 1,
    rewardLul: 35,
    rewardXp: 40,
    shortcutStationId: 'beachfront_harbor',
    shortcutLabel: 'GO TO PIER',
  },
  {
    id: 'visit_claimed_house',
    title: 'Visit Your Claimed Plot House',
    description: 'Step inside the Private House on your own claimed neighborhood plot.',
    hintText: 'Claim a plot at North or South Residence and step through its front door.',
    targetCount: 1,
    rewardLul: 45,
    rewardXp: 50,
    shortcutStationId: 'north_residence',
    shortcutLabel: 'GO TO PLOTS',
  },
] as const;

const MISSION_MAP: Record<DailyMissionId, DailyMissionDefinition> = {
  meet_kai: DAILY_MISSIONS_CATALOG[0],
  work_cafe: DAILY_MISSIONS_CATALOG[1],
  go_fishing: DAILY_MISSIONS_CATALOG[2],
  visit_claimed_house: DAILY_MISSIONS_CATALOG[3],
};

function createEmptyEntry(): DailyMissionProgressEntry {
  return {
    progress: 0,
    claimed: false,
    completedAtIso: null,
    claimedAtIso: null,
  };
}

export function getLocalDailyDateKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDailyMissionsStorageKey(accountKey?: string | null): string {
  const clean = (accountKey || '').trim().toLowerCase();
  return `bb_daily_missions_v1:${clean || 'guest'}`;
}

export function createInitialDailyMissionsState(
  dateKey: string = getLocalDailyDateKey(),
): DailyMissionsState {
  return {
    dateKey,
    missions: {
      meet_kai: createEmptyEntry(),
      work_cafe: createEmptyEntry(),
      go_fishing: createEmptyEntry(),
      visit_claimed_house: createEmptyEntry(),
    },
    bonusClaimed: false,
    bonusClaimedAtIso: null,
  };
}

export function ensureDailyMissionsCurrentDay(
  state: DailyMissionsState,
  currentDateKey: string = getLocalDailyDateKey(),
): DailyMissionsState {
  if (state.dateKey === currentDateKey) {
    return state;
  }
  return createInitialDailyMissionsState(currentDateKey);
}

export function sanitizeDailyMissionsState(
  raw: unknown,
  currentDateKey: string = getLocalDailyDateKey(),
): DailyMissionsState {
  if (!raw || typeof raw !== 'object') {
    return createInitialDailyMissionsState(currentDateKey);
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.dateKey !== 'string' || obj.dateKey !== currentDateKey) {
    return createInitialDailyMissionsState(currentDateKey);
  }
  const rawMissions =
    obj.missions && typeof obj.missions === 'object'
      ? (obj.missions as Record<string, unknown>)
      : {};
  const next = createInitialDailyMissionsState(currentDateKey);
  for (const def of DAILY_MISSIONS_CATALOG) {
    const entryRaw = rawMissions[def.id];
    if (!entryRaw || typeof entryRaw !== 'object') continue;
    const entryObj = entryRaw as Record<string, unknown>;
    const rawProgress =
      typeof entryObj.progress === 'number' && Number.isFinite(entryObj.progress)
        ? Math.floor(entryObj.progress)
        : 0;
    const progress = Math.max(0, Math.min(def.targetCount, rawProgress));
    const claimed = Boolean(entryObj.claimed) && progress >= def.targetCount;
    next.missions[def.id] = {
      progress,
      claimed,
      completedAtIso:
        progress >= def.targetCount && typeof entryObj.completedAtIso === 'string'
          ? entryObj.completedAtIso
          : null,
      claimedAtIso:
        claimed && typeof entryObj.claimedAtIso === 'string'
          ? entryObj.claimedAtIso
          : null,
    };
  }
  const allComplete = DAILY_MISSIONS_CATALOG.every(
    (def) => next.missions[def.id].progress >= def.targetCount,
  );
  next.bonusClaimed = Boolean(obj.bonusClaimed) && allComplete;
  next.bonusClaimedAtIso =
    next.bonusClaimed && typeof obj.bonusClaimedAtIso === 'string'
      ? obj.bonusClaimedAtIso
      : null;
  return next;
}

export function getDailyMissionDefinition(id: DailyMissionId): DailyMissionDefinition {
  return MISSION_MAP[id];
}

export interface RecordMissionProgressResult {
  nextState: DailyMissionsState;
  changed: boolean;
  newlyCompleted: boolean;
  definition: DailyMissionDefinition;
}

export function recordDailyMissionProgress(
  prevState: DailyMissionsState,
  missionId: DailyMissionId,
  delta = 1,
  currentDateKey: string = getLocalDailyDateKey(),
  nowIso: string = new Date().toISOString(),
): RecordMissionProgressResult {
  const dayState = ensureDailyMissionsCurrentDay(prevState, currentDateKey);
  const definition = MISSION_MAP[missionId];
  const current = dayState.missions[missionId];
  const safeDelta = Number.isFinite(delta) ? Math.max(0, Math.floor(delta)) : 0;
  if (safeDelta <= 0 || current.progress >= definition.targetCount) {
    return {
      nextState: dayState,
      changed: dayState !== prevState,
      newlyCompleted: false,
      definition,
    };
  }
  const nextProgress = Math.min(definition.targetCount, current.progress + safeDelta);
  const completedNow =
    current.progress < definition.targetCount && nextProgress >= definition.targetCount;
  return {
    nextState: {
      ...dayState,
      missions: {
        ...dayState.missions,
        [missionId]: {
          ...current,
          progress: nextProgress,
          completedAtIso: completedNow ? nowIso : current.completedAtIso,
        },
      },
    },
    changed: true,
    newlyCompleted: completedNow,
    definition,
  };
}

export interface ClaimMissionRewardResult {
  claimed: boolean;
  rewardLul: number;
  rewardXp: number;
  definition: DailyMissionDefinition;
  nextState: DailyMissionsState;
}

export function claimDailyMissionReward(
  prevState: DailyMissionsState,
  missionId: DailyMissionId,
  currentDateKey: string = getLocalDailyDateKey(),
  nowIso: string = new Date().toISOString(),
): ClaimMissionRewardResult {
  const dayState = ensureDailyMissionsCurrentDay(prevState, currentDateKey);
  const definition = MISSION_MAP[missionId];
  const current = dayState.missions[missionId];
  if (current.progress < definition.targetCount || current.claimed) {
    return {
      claimed: false,
      rewardLul: 0,
      rewardXp: 0,
      definition,
      nextState: dayState,
    };
  }
  return {
    claimed: true,
    rewardLul: definition.rewardLul,
    rewardXp: definition.rewardXp,
    definition,
    nextState: {
      ...dayState,
      missions: {
        ...dayState.missions,
        [missionId]: {
          ...current,
          claimed: true,
          claimedAtIso: nowIso,
        },
      },
    },
  };
}

export interface ClaimDailyBonusResult {
  claimed: boolean;
  rewardLul: number;
  rewardXp: number;
  nextState: DailyMissionsState;
}

export function claimDailyAllClearBonus(
  prevState: DailyMissionsState,
  currentDateKey: string = getLocalDailyDateKey(),
  nowIso: string = new Date().toISOString(),
): ClaimDailyBonusResult {
  const dayState = ensureDailyMissionsCurrentDay(prevState, currentDateKey);
  const summary = summarizeDailyMissions(dayState);
  if (!summary.bonusReady || dayState.bonusClaimed) {
    return {
      claimed: false,
      rewardLul: 0,
      rewardXp: 0,
      nextState: dayState,
    };
  }
  return {
    claimed: true,
    rewardLul: DAILY_ALL_CLEAR_BONUS.rewardLul,
    rewardXp: DAILY_ALL_CLEAR_BONUS.rewardXp,
    nextState: {
      ...dayState,
      bonusClaimed: true,
      bonusClaimedAtIso: nowIso,
    },
  };
}

export function summarizeDailyMissions(state: DailyMissionsState): DailyMissionsSummary {
  let completedCount = 0;
  let claimableMissionCount = 0;
  for (const def of DAILY_MISSIONS_CATALOG) {
    const entry = state.missions[def.id];
    if (entry.progress >= def.targetCount) {
      completedCount += 1;
      if (!entry.claimed) {
        claimableMissionCount += 1;
      }
    }
  }
  const totalCount = DAILY_MISSIONS_CATALOG.length;
  const bonusReady = completedCount >= totalCount && !state.bonusClaimed;
  const allClaimed =
    completedCount >= totalCount && claimableMissionCount === 0 && state.bonusClaimed;
  return {
    completedCount,
    totalCount,
    claimableMissionCount,
    bonusReady,
    bonusClaimed: state.bonusClaimed,
    allClaimed,
    actionableCount: claimableMissionCount + (bonusReady ? 1 : 0),
  };
}
