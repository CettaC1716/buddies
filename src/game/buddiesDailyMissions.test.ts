import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DAILY_ALL_CLEAR_BONUS,
  DAILY_MISSIONS_CATALOG,
  claimDailyAllClearBonus,
  claimDailyMissionReward,
  createInitialDailyMissionsState,
  ensureDailyMissionsCurrentDay,
  getDailyMissionsStorageKey,
  getLocalDailyDateKey,
  recordDailyMissionProgress,
  sanitizeDailyMissionsState,
  summarizeDailyMissions,
} from './buddiesDailyMissions';

test('getLocalDailyDateKey formats padded YYYY-MM-DD calendar date', () => {
  const sample = new Date(2026, 2, 5, 14, 30, 0);
  assert.equal(getLocalDailyDateKey(sample), '2026-03-05');
});

test('getDailyMissionsStorageKey scopes state cleanly by account or guest', () => {
  assert.equal(getDailyMissionsStorageKey('Alice.Testnet '), 'bb_daily_missions_v1:alice.testnet');
  assert.equal(getDailyMissionsStorageKey(null), 'bb_daily_missions_v1:guest');
  assert.equal(getDailyMissionsStorageKey(''), 'bb_daily_missions_v1:guest');
});

test('initial daily missions state starts at 0/4 with zero claimable items', () => {
  const state = createInitialDailyMissionsState('2026-11-14');
  assert.equal(state.dateKey, '2026-11-14');
  assert.equal(DAILY_MISSIONS_CATALOG.length, 7);
  const summary = summarizeDailyMissions(state);
  assert.equal(summary.completedCount, 0);
  assert.equal(summary.totalCount, 7);
  assert.equal(summary.claimableMissionCount, 0);
  assert.equal(summary.bonusReady, false);
  assert.equal(summary.actionableCount, 0);
});

test('recordDailyMissionProgress caps progress at targetCount and flags newlyCompleted once', () => {
  const day = '2026-11-14';
  let state = createInitialDailyMissionsState(day);

  const first = recordDailyMissionProgress(state, 'meet_kai', 1, day, '2026-11-14T10:00:00Z');
  assert.equal(first.changed, true);
  assert.equal(first.newlyCompleted, true);
  assert.equal(first.nextState.missions.meet_kai.progress, 1);
  assert.equal(first.nextState.missions.meet_kai.completedAtIso, '2026-11-14T10:00:00Z');
  state = first.nextState;

  const repeat = recordDailyMissionProgress(state, 'meet_kai', 1, day, '2026-11-14T10:05:00Z');
  assert.equal(repeat.changed, false);
  assert.equal(repeat.newlyCompleted, false);
  assert.equal(repeat.nextState.missions.meet_kai.progress, 1);
});

test('claimDailyMissionReward awards LUL/XP once and blocks double claim or incomplete claim', () => {
  const day = '2026-11-14';
  let state = createInitialDailyMissionsState(day);

  const incompleteClaim = claimDailyMissionReward(state, 'work_cafe', day);
  assert.equal(incompleteClaim.claimed, false);
  assert.equal(incompleteClaim.rewardLul, 0);
  assert.equal(incompleteClaim.rewardXp, 0);

  state = recordDailyMissionProgress(state, 'work_cafe', 1, day).nextState;
  const firstClaim = claimDailyMissionReward(state, 'work_cafe', day, '2026-11-14T11:00:00Z');
  assert.equal(firstClaim.claimed, true);
  assert.equal(firstClaim.rewardLul, 35);
  assert.equal(firstClaim.rewardXp, 40);
  assert.equal(firstClaim.nextState.missions.work_cafe.claimed, true);

  const doubleClaim = claimDailyMissionReward(firstClaim.nextState, 'work_cafe', day);
  assert.equal(doubleClaim.claimed, false);
  assert.equal(doubleClaim.rewardLul, 0);
});

test('claimDailyAllClearBonus unlocks after completing all 7 missions and resists double claim', () => {
  const day = '2026-11-14';
  let state = createInitialDailyMissionsState(day);
  state = recordDailyMissionProgress(state, 'meet_kai', 1, day).nextState;
  state = recordDailyMissionProgress(state, 'work_cafe', 1, day).nextState;
  state = recordDailyMissionProgress(state, 'go_fishing', 1, day).nextState;
  state = recordDailyMissionProgress(state, 'buy_house', 1, day).nextState;
  state = recordDailyMissionProgress(state, 'claim_plot_house', 1, day).nextState;
  state = recordDailyMissionProgress(state, 'buy_scooter', 1, day).nextState;

  const beforeLast = claimDailyAllClearBonus(state, day);
  assert.equal(beforeLast.claimed, false);

  state = recordDailyMissionProgress(state, 'visit_claimed_house', 1, day).nextState;
  const summary = summarizeDailyMissions(state);
  assert.equal(summary.completedCount, 7);
  assert.equal(summary.bonusReady, true);
  assert.equal(summary.claimableMissionCount, 7);
  assert.equal(summary.actionableCount, 8);

  const bonusClaim = claimDailyAllClearBonus(state, day, '2026-11-14T12:00:00Z');
  assert.equal(bonusClaim.claimed, true);
  assert.equal(bonusClaim.rewardLul, DAILY_ALL_CLEAR_BONUS.rewardLul);
  assert.equal(bonusClaim.rewardXp, DAILY_ALL_CLEAR_BONUS.rewardXp);
  assert.equal(bonusClaim.nextState.bonusClaimed, true);

  const secondBonusClaim = claimDailyAllClearBonus(bonusClaim.nextState, day);
  assert.equal(secondBonusClaim.claimed, false);
});

test('daily rollover and sanitizeDailyMissionsState reset cleanly on new dateKey or invalid payload', () => {
  const yesterday = '2026-11-14';
  const today = '2026-11-15';
  let state = createInitialDailyMissionsState(yesterday);
  state = recordDailyMissionProgress(state, 'go_fishing', 1, yesterday).nextState;
  state = claimDailyMissionReward(state, 'go_fishing', yesterday).nextState;

  const sameDay = ensureDailyMissionsCurrentDay(state, yesterday);
  assert.equal(sameDay, state);

  const rolled = ensureDailyMissionsCurrentDay(state, today);
  assert.equal(rolled.dateKey, today);
  assert.equal(rolled.missions.go_fishing.progress, 0);
  assert.equal(rolled.missions.go_fishing.claimed, false);

  const parsedYesterday = sanitizeDailyMissionsState(state, today);
  assert.equal(parsedYesterday.dateKey, today);
  assert.equal(parsedYesterday.missions.go_fishing.progress, 0);

  const parsedCorrupt = sanitizeDailyMissionsState('bad-json', today);
  assert.equal(parsedCorrupt.dateKey, today);
  assert.equal(summarizeDailyMissions(parsedCorrupt).completedCount, 0);

  const validToday = sanitizeDailyMissionsState(
    {
      dateKey: today,
      missions: {
        meet_kai: { progress: 99, claimed: false },
        work_cafe: { progress: 0, claimed: true },
      },
      bonusClaimed: true,
    },
    today,
  );
  assert.equal(validToday.missions.meet_kai.progress, 1);
  assert.equal(validToday.missions.work_cafe.claimed, false);
  assert.equal(validToday.bonusClaimed, false);
});
