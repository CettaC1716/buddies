import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  DAILY_ALL_CLEAR_BONUS,
  DAILY_MISSIONS_CATALOG,
  summarizeDailyMissions,
  type DailyMissionId,
  type DailyMissionsState,
} from '../game/buddiesDailyMissions';
import type { CityTransitStationId } from '../game/buddiesBlitzRules';
import { DailyMissionArtwork } from './DailyMissionArtwork';
import { soundEngine } from '../game/audio';

export interface DailyMissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  embeddedInPhone?: boolean;
  missionsState: DailyMissionsState;
  claimedPlotSummary: {
    hasClaimedPlot: boolean;
    team: 'blue' | 'red' | null;
    plotIndex: number | null;
  };
  onClaimMission: (missionId: DailyMissionId) => void;
  onClaimAllClearBonus: () => void;
  onShortcutTravel: (missionId: DailyMissionId, stationId: CityTransitStationId) => void;
}

const SHORT_CARD_LABELS: Record<DailyMissionId, string> = {
  meet_kai: 'MEET KAI',
  work_cafe: 'CAFE SHIFT',
  go_fishing: 'FISHING',
  buy_house: 'BUY HOUSE',
  claim_plot_house: 'CLAIM PLOT',
  buy_scooter: 'SCOOTER',
  visit_claimed_house: 'MY HOUSE',
};

// The claim-plot mission stays hidden until the buy-house mission is done:
// claiming a plot is meaningless before the player owns a House Deed.
function isMissionVisible(state: DailyMissionsState, id: DailyMissionId): boolean {
  if (id !== 'claim_plot_house') return true;
  const buyHouse = state.missions.buy_house;
  const buyHouseDef = DAILY_MISSIONS_CATALOG.find((d) => d.id === 'buy_house');
  if (buyHouse && buyHouseDef && buyHouse.progress >= buyHouseDef.targetCount) return true;
  const claimEntry = state.missions.claim_plot_house;
  return Boolean(claimEntry && (claimEntry.progress > 0 || claimEntry.completedAtIso));
}

function visibleCatalog(state: DailyMissionsState) {
  return DAILY_MISSIONS_CATALOG.filter((def) => isMissionVisible(state, def.id));
}

function pickInitialMissionId(state: DailyMissionsState): DailyMissionId {
  const visible = visibleCatalog(state);
  const ready = visible.find(
    (def) => state.missions[def.id].progress >= def.targetCount && !state.missions[def.id].claimed,
  );
  if (ready) return ready.id;
  const pending = visible.find(
    (def) => state.missions[def.id].progress < def.targetCount,
  );
  if (pending) return pending.id;
  return visible[0]?.id ?? DAILY_MISSIONS_CATALOG[0].id;
}

export const DailyMissionsModal: React.FC<DailyMissionsModalProps> = ({
  isOpen,
  onClose,
  embeddedInPhone = false,
  missionsState,
  claimedPlotSummary,
  onClaimMission,
  onClaimAllClearBonus,
  onShortcutTravel,
}) => {
  const [selectedId, setSelectedId] = useState<DailyMissionId>(() =>
    pickInitialMissionId(missionsState),
  );

  useEffect(() => {
    if (isOpen) {
      setSelectedId(pickInitialMissionId(missionsState));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const summary = summarizeDailyMissions(missionsState);
  const progressPct = Math.round(
    (summary.completedCount / Math.max(1, summary.totalCount)) * 100,
  );
  const selectedDef =
    DAILY_MISSIONS_CATALOG.find((m) => m.id === selectedId) ?? DAILY_MISSIONS_CATALOG[0];
  const selectedEntry = missionsState.missions[selectedDef.id];
  const selectedComplete = selectedEntry.progress >= selectedDef.targetCount;
  const selectedClaimed = selectedEntry.claimed;

  const resolveStationForMission = (
    missionId: DailyMissionId,
    defaultStationId: CityTransitStationId,
  ): CityTransitStationId => {
    if (missionId === 'visit_claimed_house' && claimedPlotSummary.hasClaimedPlot) {
      return claimedPlotSummary.team === 'blue' ? 'south_residence' : 'north_residence';
    }
    return defaultStationId;
  };

  const targetStationId = resolveStationForMission(
    selectedDef.id,
    selectedDef.shortcutStationId,
  );

  if (embeddedInPhone) {
    return (
      <div
        data-daily-missions-modal="true"
        className="w-full h-full flex flex-col overflow-hidden bg-[#f4f6f9] text-slate-900 select-none"
      >
        {/* Compact Phone App Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-white/95 border-b border-slate-200/80 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10.5px] font-semibold font-mono tabular-nums shrink-0">
              {summary.completedCount}/{summary.totalCount}
            </span>
            <h2 className="text-sm font-semibold tracking-tight text-slate-900 truncate">
              Daily Missions
            </h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono tabular-nums font-medium text-[10.5px]">
              {missionsState.dateKey}
            </div>
            <button
              type="button"
              data-daily-missions-close-btn="true"
              onClick={() => {
                soundEngine.playUiCancel();
                onClose();
              }}
              aria-label="Close Daily Missions"
              className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
            >
              <X className="w-3.5 h-3.5 stroke-[2.2]" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Single-Column Mobile App Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3">
          {/* Selected Mission Detail Bento Card */}
          <div className="rounded-2xl bg-white border border-slate-200/75 shadow-sm p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10.5px] font-semibold font-mono tabular-nums">
                +{selectedDef.rewardXp} XP
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10.5px] font-semibold font-mono tabular-nums">
                +{selectedDef.rewardLul} LUL
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#f4f6f9] border border-slate-200/60 rounded-2xl shrink-0">
                <DailyMissionArtwork missionId={selectedDef.id} className="w-16 h-16" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-sm font-semibold text-slate-900 leading-snug">
                  {selectedDef.title}
                </div>
                <div className="text-xs text-slate-500 leading-relaxed">
                  {selectedDef.description}
                </div>
                {selectedDef.id === 'visit_claimed_house' && (
                  <div className="pt-0.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        claimedPlotSummary.hasClaimedPlot
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {claimedPlotSummary.hasClaimedPlot && claimedPlotSummary.plotIndex != null
                        ? `PLOT #${claimedPlotSummary.plotIndex} (${
                            claimedPlotSummary.team === 'blue' ? 'SOUTH' : 'NORTH'
                          })`
                        : 'NO PLOT CLAIMED'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {selectedClaimed ? (
              <div
                data-daily-mission-claimed={selectedDef.id}
                className="w-full py-2.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-xs text-center"
              >
                Reward Claimed
              </div>
            ) : selectedComplete ? (
              <button
                type="button"
                data-daily-mission-claim-btn={selectedDef.id}
                onClick={() => onClaimMission(selectedDef.id)}
                className="w-full py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm font-semibold text-xs transition-colors cursor-pointer active:scale-[0.98]"
              >
                Claim (+{selectedDef.rewardLul} LUL)
              </button>
            ) : (
              <button
                type="button"
                data-daily-mission-go-btn={selectedDef.id}
                onClick={() => onShortcutTravel(selectedDef.id, targetStationId)}
                className="w-full py-2.5 rounded-full bg-sky-100 hover:bg-sky-200 text-sky-900 font-semibold text-xs transition-colors cursor-pointer active:scale-[0.98]"
              >
                {selectedDef.shortcutLabel}
              </button>
            )}
          </div>

          {/* 2-Column Mission Selector Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {visibleCatalog(missionsState).map((def) => {
              const entry = missionsState.missions[def.id];
              const isSelected = def.id === selectedId;
              const isComplete = entry.progress >= def.targetCount;
              const isClaimed = entry.claimed;

              return (
                <button
                  key={def.id}
                  type="button"
                  data-daily-mission-card={def.id}
                  onClick={() => {
                    soundEngine.playUiClick();
                    setSelectedId(def.id);
                  }}
                  className={`relative flex flex-col items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.98] ${
                    isSelected
                      ? 'bg-white border-sky-400 ring-2 ring-sky-400/25 shadow-md'
                      : isClaimed
                        ? 'bg-emerald-50/50 hover:bg-emerald-50/80 border-emerald-200/80 shadow-sm'
                        : 'bg-white hover:bg-slate-50/80 border-slate-200/75 shadow-sm'
                  }`}
                >
                  <div className="w-full flex items-center justify-between gap-1 text-[9.5px] font-semibold">
                    <span className="text-slate-500 tracking-wide uppercase truncate">
                      {SHORT_CARD_LABELS[def.id]}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full font-mono tabular-nums text-[9.5px] font-semibold shrink-0 ${
                        isClaimed
                          ? 'bg-emerald-100 text-emerald-700'
                          : isComplete
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {entry.progress}/{def.targetCount}
                    </span>
                  </div>

                  <div className="my-1.5 w-12 h-12 rounded-xl bg-[#f4f6f9] flex items-center justify-center">
                    <DailyMissionArtwork
                      missionId={def.id}
                      className="w-11 h-11 drop-shadow-[0_2px_4px_rgba(15,23,42,0.12)]"
                    />
                  </div>

                  <div
                    className={`w-full py-1 px-2 rounded-full text-[10px] font-semibold font-mono tabular-nums flex items-center justify-center ${
                      isClaimed
                        ? 'bg-emerald-100/80 text-emerald-700'
                        : isComplete
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : 'bg-sky-50 text-sky-800'
                    }`}
                  >
                    <span>{isClaimed ? 'Claimed' : isComplete ? 'Claim' : `+${def.rewardLul} LUL`}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Compact All-Clear Bonus Card */}
          <div className="rounded-2xl bg-white border border-slate-200/75 shadow-sm p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-900">
                All-Clear Bonus
              </div>
              <span className="text-[11px] font-semibold font-mono tabular-nums text-slate-600">
                +{DAILY_ALL_CLEAR_BONUS.rewardLul} LUL · +{DAILY_ALL_CLEAR_BONUS.rewardXp} XP
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {summary.bonusClaimed ? (
                <span
                  data-daily-bonus-claimed="true"
                  className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold shrink-0"
                >
                  Bonus Claimed
                </span>
              ) : summary.bonusReady ? (
                <button
                  type="button"
                  data-daily-bonus-claim-btn="true"
                  onClick={onClaimAllClearBonus}
                  className="px-3.5 py-1 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm text-[11px] font-semibold transition-colors cursor-pointer active:scale-95 shrink-0"
                >
                  Claim Bonus
                </button>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold font-mono tabular-nums shrink-0">
                  {summary.completedCount}/{summary.totalCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-daily-missions-modal="true"
      role="dialog"
      aria-modal="true"
      aria-label="DAILY MISSIONS"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/45 backdrop-blur-sm pointer-events-auto select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[700px] rounded-[28px] bg-[#f4f6f9]/96 backdrop-blur-2xl border border-white/80 shadow-[0_24px_64px_rgba(15,23,42,0.28)] text-slate-900 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Clean Light Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-white/95 border-b border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold font-mono tabular-nums">
              {summary.completedCount}/{summary.totalCount}
            </span>
            <h2 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900">
              Daily Missions
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 font-mono tabular-nums font-medium text-xs">
              {missionsState.dateKey}
            </div>
            <button
              type="button"
              data-daily-missions-close-btn="true"
              onClick={() => {
                soundEngine.playUiCancel();
                onClose();
              }}
              aria-label="Close Daily Missions"
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
            >
              <X className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Soft Light Body with Pure White Bento Cards */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            {/* Left 2-Column Mission Grid */}
            <div className="sm:col-span-7 grid grid-cols-2 gap-3">
              {visibleCatalog(missionsState).map((def) => {
                const entry = missionsState.missions[def.id];
                const isSelected = def.id === selectedId;
                const isComplete = entry.progress >= def.targetCount;
                const isClaimed = entry.claimed;

                return (
                  <button
                    key={def.id}
                    type="button"
                    data-daily-mission-card={def.id}
                    onClick={() => {
                      soundEngine.playUiClick();
                      setSelectedId(def.id);
                    }}
                    className={`relative flex flex-col items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer active:scale-[0.98] ${
                      isSelected
                        ? 'bg-white border-sky-400 ring-2 ring-sky-400/25 shadow-md -translate-y-0.5'
                        : isClaimed
                          ? 'bg-emerald-50/50 hover:bg-emerald-50/80 border-emerald-200/80 shadow-sm'
                          : 'bg-white hover:bg-slate-50/80 border-slate-200/75 shadow-sm hover:shadow-md'
                    }`}
                  >
                    <div className="w-full flex items-center justify-between gap-1 text-[10px] font-semibold">
                      <span className="text-slate-500 tracking-wide uppercase truncate">
                        {SHORT_CARD_LABELS[def.id]}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-mono tabular-nums text-[10px] font-semibold shrink-0 ${
                          isClaimed
                            ? 'bg-emerald-100 text-emerald-700'
                            : isComplete
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {entry.progress}/{def.targetCount}
                      </span>
                    </div>

                    <div className="my-2 w-16 h-16 rounded-2xl bg-[#f4f6f9] flex items-center justify-center">
                      <DailyMissionArtwork
                        missionId={def.id}
                        className="w-14 h-14 drop-shadow-[0_2px_4px_rgba(15,23,42,0.12)]"
                      />
                    </div>

                    <div
                      className={`w-full py-1 px-2 rounded-full text-[10.5px] font-semibold font-mono tabular-nums flex items-center justify-center ${
                        isClaimed
                          ? 'bg-emerald-100/80 text-emerald-700'
                          : isComplete
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'bg-sky-50 text-sky-800'
                      }`}
                    >
                      <span>{isClaimed ? 'Claimed' : isComplete ? 'Claim' : `+${def.rewardLul} LUL`}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Detail Panel */}
            <div className="sm:col-span-5 bg-white text-slate-900 border border-slate-200/75 shadow-sm rounded-2xl p-4 flex flex-col items-center justify-between text-center min-h-[270px]">
              <div className="w-full flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold font-mono tabular-nums">
                  +{selectedDef.rewardXp} XP
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-semibold font-mono tabular-nums">
                  +{selectedDef.rewardLul} LUL
                </span>
              </div>

              <div className="my-2.5 p-3 bg-[#f4f6f9] border border-slate-200/60 rounded-2xl">
                <DailyMissionArtwork missionId={selectedDef.id} className="w-22 h-22" />
              </div>

              <div className="space-y-1.5 mb-3">
                <div className="text-sm font-semibold text-slate-900 leading-snug">
                  {selectedDef.title}
                </div>
                <div className="text-xs text-slate-500 leading-relaxed">
                  {selectedDef.description}
                </div>
                {selectedDef.id === 'visit_claimed_house' && (
                  <div className="pt-1">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        claimedPlotSummary.hasClaimedPlot
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {claimedPlotSummary.hasClaimedPlot && claimedPlotSummary.plotIndex != null
                        ? `PLOT #${claimedPlotSummary.plotIndex} (${
                            claimedPlotSummary.team === 'blue' ? 'SOUTH' : 'NORTH'
                          })`
                        : 'NO PLOT CLAIMED'}
                    </span>
                  </div>
                )}
              </div>

              {selectedClaimed ? (
                <div
                  data-daily-mission-claimed={selectedDef.id}
                  className="w-full py-2.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-xs"
                >
                  Reward Claimed
                </div>
              ) : selectedComplete ? (
                <button
                  type="button"
                  data-daily-mission-claim-btn={selectedDef.id}
                  onClick={() => onClaimMission(selectedDef.id)}
                  className="w-full py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm font-semibold text-xs transition-colors cursor-pointer active:scale-[0.98]"
                >
                  Claim (+{selectedDef.rewardLul} LUL)
                </button>
              ) : (
                <button
                  type="button"
                  data-daily-mission-go-btn={selectedDef.id}
                  onClick={() => onShortcutTravel(selectedDef.id, targetStationId)}
                  className="w-full py-2.5 rounded-full bg-sky-100 hover:bg-sky-200 text-sky-900 font-semibold text-xs transition-colors cursor-pointer active:scale-[0.98]"
                >
                  {selectedDef.shortcutLabel}
                </button>
              )}
            </div>
          </div>

          {/* Compact All-Clear Bonus Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white border border-slate-200/75 shadow-sm rounded-2xl">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-900 shrink-0">
                All-Clear Bonus
              </div>
              <div className="flex-1 min-w-[70px] max-w-[170px] h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs font-semibold font-mono tabular-nums text-slate-700 shrink-0">
                +{DAILY_ALL_CLEAR_BONUS.rewardLul} LUL · +{DAILY_ALL_CLEAR_BONUS.rewardXp} XP
              </span>
            </div>

            {summary.bonusClaimed ? (
              <span
                data-daily-bonus-claimed="true"
                className="px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold"
              >
                Bonus Claimed
              </span>
            ) : summary.bonusReady ? (
              <button
                type="button"
                data-daily-bonus-claim-btn="true"
                onClick={onClaimAllClearBonus}
                className="px-4 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm text-xs font-semibold transition-colors cursor-pointer active:scale-95"
              >
                Claim Bonus
              </button>
            ) : (
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold font-mono tabular-nums">
                {summary.completedCount}/{summary.totalCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
