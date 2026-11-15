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
  claim_plot_house: 'CLAIM PLOT',
  visit_claimed_house: 'MY HOUSE',
};

function pickInitialMissionId(state: DailyMissionsState): DailyMissionId {
  const ready = DAILY_MISSIONS_CATALOG.find(
    (def) => state.missions[def.id].progress >= def.targetCount && !state.missions[def.id].claimed,
  );
  if (ready) return ready.id;
  const pending = DAILY_MISSIONS_CATALOG.find(
    (def) => state.missions[def.id].progress < def.targetCount,
  );
  if (pending) return pending.id;
  return DAILY_MISSIONS_CATALOG[0].id;
}

export const DailyMissionsModal: React.FC<DailyMissionsModalProps> = ({
  isOpen,
  onClose,
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

  return (
    <div
      data-daily-missions-modal="true"
      role="dialog"
      aria-modal="true"
      aria-label="DAILY MISSIONS"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 pointer-events-auto select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[680px] bg-[#14161d] text-white border-[4px] border-[#14161d] ring-3 ring-white shadow-[8px_8px_0_#000] rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (Matches GlasshouseCafeOrderModal) */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1e212b] border-b-[3px] border-black">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 bg-[#b8ff3c] text-[#14161d] border-2 border-black text-[10px] font-black uppercase">
              {summary.completedCount}/{summary.totalCount}
            </span>
            <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-white">
              DAILY MISSIONS
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1 bg-[#fec83e] text-[#14161d] border-2 border-black font-mono-tabular font-black text-xs">
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
              className="w-8 h-8 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black font-black flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4 stroke-[3]" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* White Body with Warm Cream Cards */}
        <div className="p-4 bg-white text-[#14161d] space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
            {/* Left 2x2 Mission Grid */}
            <div className="sm:col-span-7 grid grid-cols-2 gap-2.5">
              {DAILY_MISSIONS_CATALOG.map((def) => {
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
                    className={`relative flex flex-col items-center justify-between p-2.5 rounded-xl border-[3px] transition-transform cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'bg-[#eef8d8] border-[#14161d] ring-2 ring-[#b8ff3c] -translate-y-0.5 shadow-[2px_2px_0_#000]'
                        : isClaimed
                          ? 'bg-[#ecfdf5] hover:bg-[#dcfce7] border-black shadow-[2px_2px_0_#000]'
                          : 'bg-[#f7efe0] hover:bg-[#efe3cc] border-black shadow-[2px_2px_0_#000]'
                    }`}
                  >
                    <div className="w-full flex items-center justify-between text-[9.5px] font-black uppercase">
                      <span className="text-slate-600">{SHORT_CARD_LABELS[def.id]}</span>
                      <span
                        className={`px-1.5 py-0.2 border border-black rounded-sm ${
                          isClaimed
                            ? 'bg-[#22c55e] text-[#14161d]'
                            : isComplete
                              ? 'bg-[#b8ff3c] text-[#14161d]'
                              : 'bg-white text-[#14161d]'
                        }`}
                      >
                        {entry.progress}/{def.targetCount}
                      </span>
                    </div>

                    <div className="my-2 w-16 h-16 flex items-center justify-center">
                      <DailyMissionArtwork
                        missionId={def.id}
                        className="w-15 h-15 drop-shadow-[0_2px_2px_rgba(0,0,0,0.22)]"
                      />
                    </div>

                    <div
                      className={`w-full py-0.5 px-1.5 bg-[#0f172a] border border-black rounded text-[10px] font-black font-mono-tabular flex items-center justify-center gap-1 ${
                        isClaimed
                          ? 'text-[#4ade80]'
                          : isComplete
                            ? 'text-[#b8ff3c]'
                            : 'text-[#38bdf8]'
                      }`}
                    >
                      <span>{isClaimed ? 'CLAIMED' : isComplete ? 'CLAIM' : `+${def.rewardLul} LUL`}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Detail Panel */}
            <div className="sm:col-span-5 bg-[#f7efe0] text-[#14161d] border-[3px] border-black shadow-[3px_3px_0_#000] rounded-xl p-3.5 flex flex-col items-center justify-between text-center min-h-[260px]">
              <div className="w-full flex items-center justify-between">
                <span className="px-2 py-0.5 bg-[#b8ff3c] text-[#14161d] border border-black text-[10px] font-black uppercase">
                  +{selectedDef.rewardXp} XP
                </span>
                <span className="px-2 py-0.5 bg-[#fec83e] text-[#14161d] border border-black text-[10px] font-black font-mono-tabular">
                  +{selectedDef.rewardLul} LUL
                </span>
              </div>

              <div className="my-2 p-2.5 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0_#000]">
                <DailyMissionArtwork missionId={selectedDef.id} className="w-22 h-22" />
              </div>

              <div className="space-y-1 mb-2.5">
                <div className="text-sm font-black uppercase text-[#14161d] leading-tight">
                  {selectedDef.title}
                </div>
                <div className="text-[11px] font-bold text-slate-600 leading-snug">
                  {selectedDef.description}
                </div>
                {selectedDef.id === 'visit_claimed_house' && (
                  <div className="pt-0.5">
                    <span
                      className={`inline-block px-2 py-0.5 border border-black text-[9.5px] font-black uppercase ${
                        claimedPlotSummary.hasClaimedPlot
                          ? 'bg-[#b8ff3c] text-[#14161d]'
                          : 'bg-white text-slate-700'
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
                  className="w-full py-2.5 bg-[#dcfce7] text-[#166534] border-[3px] border-black font-black text-xs uppercase tracking-wider"
                >
                  REWARD CLAIMED
                </div>
              ) : selectedComplete ? (
                <button
                  type="button"
                  data-daily-mission-claim-btn={selectedDef.id}
                  onClick={() => onClaimMission(selectedDef.id)}
                  className="w-full py-2.5 bg-[#b8ff3c] hover:bg-[#d9f99d] text-[#14161d] border-[3px] border-black shadow-[3px_3px_0_#000] font-black text-xs uppercase tracking-wider cursor-pointer active:translate-y-0.5"
                >
                  CLAIM (+{selectedDef.rewardLul} LUL)
                </button>
              ) : (
                <button
                  type="button"
                  data-daily-mission-go-btn={selectedDef.id}
                  onClick={() => onShortcutTravel(selectedDef.id, targetStationId)}
                  className="w-full py-2.5 bg-[#fec83e] hover:bg-[#fde047] text-[#14161d] border-[3px] border-black shadow-[3px_3px_0_#000] font-black text-xs uppercase tracking-wider cursor-pointer active:translate-y-0.5"
                >
                  {selectedDef.shortcutLabel}
                </button>
              )}
            </div>
          </div>

          {/* Compact All-Clear Bonus Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 bg-[#f7efe0] border-[3px] border-black shadow-[3px_3px_0_#000] rounded-xl">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="text-xs font-black uppercase text-[#14161d] shrink-0">
                ALL-CLEAR BONUS
              </div>
              <div className="flex-1 min-w-[70px] max-w-[170px] h-3 bg-[#090b10] border-2 border-black rounded-sm overflow-hidden">
                <div
                  className="h-full bg-[#b8ff3c] transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-[11px] font-black font-mono-tabular text-[#14161d] shrink-0">
                +{DAILY_ALL_CLEAR_BONUS.rewardLul} LUL · +{DAILY_ALL_CLEAR_BONUS.rewardXp} XP
              </span>
            </div>

            {summary.bonusClaimed ? (
              <span
                data-daily-bonus-claimed="true"
                className="px-3 py-1 bg-[#dcfce7] text-[#166534] border-2 border-black text-[11px] font-black uppercase"
              >
                BONUS CLAIMED
              </span>
            ) : summary.bonusReady ? (
              <button
                type="button"
                data-daily-bonus-claim-btn="true"
                onClick={onClaimAllClearBonus}
                className="px-3 py-1 bg-[#b8ff3c] hover:bg-[#d9f99d] text-[#14161d] border-2 border-black shadow-[2px_2px_0_#000] text-[11px] font-black uppercase cursor-pointer active:translate-y-0.5"
              >
                CLAIM BONUS
              </button>
            ) : (
              <span className="px-2.5 py-1 bg-[#0f172a] text-[#38bdf8] border-2 border-black text-[10.5px] font-black font-mono-tabular">
                {summary.completedCount}/{summary.totalCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
