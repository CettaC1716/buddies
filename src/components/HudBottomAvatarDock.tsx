import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Backpack,
  Bike,
  ClipboardList,
  Map as MapIcon,
  Shirt,
  Smile,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import { SOCIAL_EMOTE_QUICK_LIST } from '../game/buddiesRemotePresenceSync';
import { HudSmartphoneIcon } from './SmartphoneOsModal';
import type { WardrobeCatalogItem } from '../game/buddiesWardrobeStudioRules';
import type { UrbanScooterKind } from '../game/buddiesUrbanScooterRules';

export interface HudBottomAvatarDockProps {
  playerDisplayName: string;
  characterGender: 'male' | 'female';
  statusLabel: string;
  statusTone?: 'emerald' | 'sky' | 'amber' | 'rose' | 'neutral';
  isFishingRodEquipped: boolean;
  equippedScooterKind: UrbanScooterKind | null;
  hasOwnedScooter: boolean;
  canMountScooterOutdoors: boolean;
  smartphoneBadgeCount: number;
  isSmartphoneOpen: boolean;
  pinnedMissionTitle?: string | null;
  pinnedMissionDistanceM?: number | null;
  completedMissionsCount?: number;
  totalMissionsCount?: number;
  quickPoseItems: readonly WardrobeCatalogItem[];
  activeQuickPoseId: string | null;
  onOpenProfile: () => void;
  onOpenWardrobe: () => void;
  onOpenBag: () => void;
  onOpenMissions: () => void;
  onDismissPinnedMission?: () => void;
  onOpenCityMap: () => void;
  onTriggerQuickPose: (item: WardrobeCatalogItem) => void;
  onStopQuickPose: () => void;
  onTriggerEmote: (emoteId: string) => void;
  onStopEmote: () => void;
  onQuickToggleScooter: () => void;
  onToggleSmartphone: () => void;
}

const PORTRAIT_FRAME_GRADIENTS: Record<
  NonNullable<HudBottomAvatarDockProps['statusTone']>,
  string
> = {
  emerald: 'from-emerald-400/35 via-transparent to-emerald-500/85 border-emerald-300/45',
  sky: 'from-sky-400/35 via-transparent to-sky-500/85 border-sky-300/45',
  amber: 'from-amber-400/35 via-transparent to-amber-500/85 border-amber-300/45',
  rose: 'from-rose-400/35 via-transparent to-rose-500/85 border-rose-300/45',
  neutral: 'from-white/15 via-transparent to-slate-900/85 border-white/25',
};

const CORNER_BADGE_BG: Record<
  NonNullable<HudBottomAvatarDockProps['statusTone']>,
  string
> = {
  emerald: 'bg-emerald-400 text-slate-950',
  sky: 'bg-sky-400 text-slate-950',
  amber: 'bg-amber-300 text-slate-950',
  rose: 'bg-rose-400 text-slate-950',
  neutral: 'bg-white/90 text-slate-950',
};

/**
 * inZOI-inspired 2-Tier Modular Bottom-Center Hero Dock (Image 4):
 * - Left: Mood-tinted portrait card with overlapping status icon & bottom mood label
 * - Top Tier: Split frosted pills for Active Mood/Poses + Pinned Mission/Tasks
 * - Bottom Tier: Mini Bag/Scooter rail | Angled 3D Smartphone Hero Button (replaces World icon) | Active Action Ring + Circular Quick Slots
 */
export const HudBottomAvatarDock: React.FC<HudBottomAvatarDockProps> = ({
  playerDisplayName,
  characterGender,
  statusLabel,
  statusTone = 'emerald',
  isFishingRodEquipped,
  equippedScooterKind,
  hasOwnedScooter,
  canMountScooterOutdoors,
  smartphoneBadgeCount,
  isSmartphoneOpen,
  pinnedMissionTitle,
  pinnedMissionDistanceM,
  completedMissionsCount = 0,
  totalMissionsCount = 0,
  quickPoseItems,
  activeQuickPoseId,
  onOpenProfile,
  onOpenWardrobe,
  onOpenBag,
  onOpenMissions,
  onDismissPinnedMission,
  onOpenCityMap,
  onTriggerQuickPose,
  onStopQuickPose,
  onTriggerEmote,
  onStopEmote,
  onQuickToggleScooter,
  onToggleSmartphone,
}) => {
  const [openTray, setOpenTray] = useState<'none' | 'poses' | 'emotes'>('none');
  const [poseFilter, setPoseFilter] = useState<'all' | 'style_pose' | 'style_action' | 'style_dance'>('all');
  const [poseSearch, setPoseSearch] = useState('');
  const [isMissionPillHidden, setIsMissionPillHidden] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (pinnedMissionTitle) {
      setIsMissionPillHidden(false);
    }
  }, [pinnedMissionTitle]);

  useEffect(() => {
    const onOtherPopoverOpen = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail && detail !== 'avatar_dock') {
        setOpenTray('none');
      }
    };
    window.addEventListener('hud-corner-popover-open', onOtherPopoverOpen);
    return () => {
      window.removeEventListener('hud-corner-popover-open', onOtherPopoverOpen);
    };
  }, []);

  useEffect(() => {
    if (openTray === 'none') return;
    const onPointerDownOutside = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenTray('none');
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenTray('none');
      }
    };
    window.addEventListener('pointerdown', onPointerDownOutside, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDownOutside, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [openTray]);

  const filteredPoses = useMemo(() => {
    const q = poseSearch.trim().toLowerCase();
    return quickPoseItems.filter((item) => {
      if (poseFilter !== 'all' && item.slot !== poseFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q)
      );
    });
  }, [quickPoseItems, poseFilter, poseSearch]);

  const activePoseItem = useMemo(
    () => quickPoseItems.find((item) => item.id === activeQuickPoseId) ?? null,
    [quickPoseItems, activeQuickPoseId],
  );

  const portraitUrl =
    characterGender === 'male'
      ? '/assets/avatar_hiro.jpg'
      : '/assets/avatar_nadia.jpg';

  const toggleTray = (tray: 'poses' | 'emotes') => {
    soundEngine.playUiClick();
    setOpenTray((prev) => {
      const next = prev === tray ? 'none' : tray;
      if (next !== 'none') {
        window.dispatchEvent(
          new CustomEvent('hud-corner-popover-open', { detail: 'avatar_dock' }),
        );
      }
      return next;
    });
  };

  const hasActiveActionRing = Boolean(activePoseItem || equippedScooterKind || isFishingRodEquipped);

  return (
    <div
      ref={rootRef}
      data-hud-avatar-dock="true"
      className="fixed bottom-3.5 left-1/2 -translate-x-1/2 z-30 hidden lg:flex flex-col items-center gap-2 pointer-events-none select-none"
    >
      {/* Floating Emotes Frosted Pill */}
      {openTray === 'emotes' && (
        <div
          data-dock-emote-tray="true"
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto flex items-center gap-1 px-2 py-1.5 rounded-full bg-[#0d1118]/86 backdrop-blur-xl border border-white/15 shadow-[0_14px_38px_rgba(0,0,0,0.52)]"
        >
          {SOCIAL_EMOTE_QUICK_LIST.map((emote) => (
            <button
              key={emote.id}
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onTriggerEmote(emote.id);
                setOpenTray('none');
              }}
              className="px-3 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.18] border border-white/10 text-[11px] font-medium text-white/95 transition-colors cursor-pointer whitespace-nowrap"
            >
              {emote.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onStopEmote();
              setOpenTray('none');
            }}
            className="px-2.5 py-1 rounded-full bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/30 text-[11px] font-medium text-rose-200 transition-colors cursor-pointer"
          >
            Stop
          </button>
        </div>
      )}

      {/* Floating Poses & Dances Frosted Drawer */}
      {openTray === 'poses' && (
        <div
          data-dock-pose-tray="true"
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="pointer-events-auto w-[312px] max-h-[300px] flex flex-col rounded-2xl bg-[#0d1118]/86 backdrop-blur-xl border border-white/15 shadow-[0_18px_46px_rgba(0,0,0,0.58)] text-white overflow-hidden"
        >
          <div className="px-3.5 py-2.5 border-b border-white/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-300" aria-hidden="true" />
              <span className="text-xs font-semibold tracking-tight text-white">
                Poses &amp; Dances
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {activeQuickPoseId && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onStopQuickPose();
                  }}
                  className="px-2 py-0.5 rounded-full bg-rose-500/25 hover:bg-rose-500/40 border border-rose-400/35 text-[10px] font-semibold text-rose-100 flex items-center gap-1 cursor-pointer"
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                  <span>Stop</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpenTray('none')}
                aria-label="Close Poses & Dances"
                className="w-6 h-6 rounded-full bg-white/[0.08] hover:bg-white/[0.18] flex items-center justify-center text-white/80 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="px-3 pt-2 pb-2 space-y-1.5 border-b border-white/10">
            <div className="grid grid-cols-4 gap-1">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'style_pose', label: 'Pose' },
                  { id: 'style_action', label: 'Action' },
                  { id: 'style_dance', label: 'Dance' },
                ] as const
              ).map((tab) => {
                const active = poseFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setPoseFilter(tab.id);
                    }}
                    className={`h-6 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-sky-400/90 text-slate-950 font-semibold'
                        : 'bg-white/[0.07] text-white/75 hover:bg-white/[0.15]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={poseSearch}
              onChange={(e) => setPoseSearch(e.target.value)}
              placeholder="Search poses, actions, dances..."
              className="w-full h-7 px-3 rounded-full bg-white/[0.07] border border-white/12 text-[11px] text-white placeholder:text-white/40 focus:outline-none focus:border-sky-300/60"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {filteredPoses.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-white/50">
                No matching poses or dances.
              </div>
            ) : (
              filteredPoses.map((item) => {
                const isActive = activeQuickPoseId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      if (isActive) {
                        onStopQuickPose();
                      } else {
                        onTriggerQuickPose(item);
                      }
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-sky-400/20 border border-sky-300/55 text-white'
                        : 'bg-white/[0.03] hover:bg-white/[0.11] border border-transparent text-white/90'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium truncate">{item.name}</div>
                      <div className="text-[9.5px] text-white/45 truncate">{item.subtitle}</div>
                    </div>
                    {isActive && (
                      <span className="px-1.5 py-0.5 rounded-full bg-sky-400 text-slate-950 text-[9px] font-semibold shrink-0">
                        Active
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Main inZOI 2-Tier Hero Dock */}
      <div className="pointer-events-auto flex items-end gap-2">
        {/* Left: Mood-Tinted Mini Avatar Portrait Card (with top-left overlapping status badge) */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenProfile();
            }}
            title={`${playerDisplayName} · Click to open Profile`}
            className={`group relative w-[72px] h-[94px] rounded-2xl bg-[#0d1118]/75 backdrop-blur-xl border shadow-[0_12px_34px_rgba(0,0,0,0.48)] overflow-hidden cursor-pointer transition-all active:scale-95 ${PORTRAIT_FRAME_GRADIENTS[statusTone]}`}
          >
            <img
              src={portraitUrl}
              alt={playerDisplayName}
              draggable={false}
              className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
            />
            <div
              aria-hidden="true"
              className={`absolute inset-0 bg-gradient-to-b ${PORTRAIT_FRAME_GRADIENTS[statusTone]} pointer-events-none`}
            />
            <span className="absolute bottom-1.5 inset-x-1 text-[10.5px] font-semibold tracking-tight text-white text-center truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.75)]">
              {statusLabel}
            </span>
          </button>
          {/* Top-left overlapping circular mood icon badge */}
          <span
            aria-hidden="true"
            className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full border-2 border-[#0d1118] flex items-center justify-center shadow-md pointer-events-none ${CORNER_BADGE_BG[statusTone]}`}
          >
            <Smile className="w-3 h-3 stroke-[2.4]" />
          </span>
        </div>

        {/* Right: 2-Tier Modular Frosted Glass Stack */}
        <div className="flex flex-col gap-1.5">
          {/* TOP TIER: 2 Split Frosted Status Pills (Moods/Poses + Pinned Missions) */}
          <div className="flex items-center gap-1.5">
            {/* Pill 1: Active Mood / Quick Emote & Pose Status */}
            <div className="h-[38px] px-2.5 rounded-2xl bg-[#0d1118]/58 backdrop-blur-xl border border-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.34)] flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleTray('emotes')}
                title="Quick Emotes"
                className="flex items-center gap-1.5 cursor-pointer group"
              >
                <span className="w-6 h-6 rounded-full bg-emerald-400/90 text-slate-950 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Smile className="w-3.5 h-3.5 stroke-[2.2]" />
                </span>
                <span className="text-[11px] font-medium text-white/90 truncate max-w-[92px]">
                  {playerDisplayName || 'Buddy'}
                </span>
              </button>

              {activePoseItem && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onStopQuickPose();
                  }}
                  title="Stop active pose/dance"
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-400/22 hover:bg-sky-400/35 border border-sky-300/45 text-[10px] font-medium text-sky-200 cursor-pointer max-w-[110px]"
                >
                  <Sparkles className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">{activePoseItem.name}</span>
                  <X className="w-2.5 h-2.5 shrink-0" />
                </button>
              )}
            </div>

            {/* Pill 2: Pinned Mission / Daily Tasks Pill (dismissible with X) */}
            {!isMissionPillHidden && (
              <div className="h-[38px] pl-2.5 pr-1.5 rounded-2xl bg-[#0d1118]/58 backdrop-blur-xl border border-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.34)] flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onOpenMissions();
                  }}
                  title="Open Daily Missions"
                  className="flex items-center gap-1.5 cursor-pointer hover:opacity-95"
                >
                  <span className="w-5 h-5 rounded-full bg-violet-400/25 border border-violet-300/45 text-violet-200 flex items-center justify-center shrink-0">
                    <ClipboardList className="w-3 h-3 stroke-[2]" />
                  </span>
                  <span className="text-[10.5px] font-medium text-white/88 truncate max-w-[118px]">
                    {pinnedMissionTitle
                      ? pinnedMissionTitle
                      : `Missions ${completedMissionsCount}/${totalMissionsCount}`}
                  </span>
                  {pinnedMissionTitle && pinnedMissionDistanceM != null && (
                    <span className="text-[10px] font-mono tabular-nums font-semibold text-emerald-300 shrink-0">
                      {pinnedMissionDistanceM}m
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    if (pinnedMissionTitle && onDismissPinnedMission) {
                      onDismissPinnedMission();
                    } else {
                      setIsMissionPillHidden(true);
                    }
                  }}
                  aria-label="Hide mission pill"
                  className="w-5 h-5 rounded-full hover:bg-white/15 text-white/55 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* BOTTOM TIER: Mini Utility Column | Smartphone Hero Icon | Active Ring + Quick Slots */}
          <div className="h-[52px] px-2 rounded-2xl bg-[#0d1118]/64 backdrop-blur-xl border border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.44)] flex items-center gap-2">
            {/* Left Stacked Mini Icons: Bag (top) + Scooter (bottom) */}
            <div className="flex flex-col items-center justify-center gap-0.5 pr-2 border-r border-white/12">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onOpenBag();
                }}
                title={isFishingRodEquipped ? 'Bag (Fishing Rod Active)' : 'Personal Bag'}
                aria-label="Open Personal Bag"
                className={`w-6 h-5 rounded-md flex items-center justify-center cursor-pointer transition-colors ${
                  isFishingRodEquipped
                    ? 'text-emerald-300 bg-emerald-400/20'
                    : 'text-white/75 hover:text-white hover:bg-white/12'
                }`}
              >
                <Backpack className="w-3.5 h-3.5 stroke-[1.9]" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onQuickToggleScooter();
                }}
                title={
                  equippedScooterKind
                    ? 'Dismount Scooter'
                    : hasOwnedScooter
                      ? canMountScooterOutdoors
                        ? 'Ride Scooter'
                        : 'Step outside to ride scooter'
                      : 'Open Gear & Scooters'
                }
                aria-label="Toggle Scooter"
                className={`w-6 h-5 rounded-md flex items-center justify-center cursor-pointer transition-colors ${
                  equippedScooterKind
                    ? 'text-emerald-300 bg-emerald-400/20'
                    : 'text-white/75 hover:text-white hover:bg-white/12'
                }`}
              >
                <Bike className="w-3.5 h-3.5 stroke-[1.9]" aria-hidden="true" />
              </button>
            </div>

            {/* Hero Angled 3D Smartphone Button (Replaces World Icon — opens Smartphone OS Launcher) */}
            <button
              type="button"
              data-dock-smartphone-btn="true"
              onClick={() => {
                soundEngine.playUiClick();
                onToggleSmartphone();
              }}
              title="Open Buddies Smartphone (Messages, Map, Missions, Apps)"
              aria-label="Open Buddies Smartphone"
              aria-expanded={isSmartphoneOpen}
              className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                isSmartphoneOpen
                  ? 'bg-purple-400/25 ring-1 ring-purple-300/70'
                  : 'hover:bg-white/[0.12]'
              }`}
            >
              <HudSmartphoneIcon className="w-8 h-8 drop-shadow-[0_3px_8px_rgba(168,85,247,0.45)] transition-transform hover:scale-105" />
              {smartphoneBadgeCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-sky-400 text-slate-950 text-[9px] font-bold flex items-center justify-center border border-[#0d1118] shadow-sm">
                  {smartphoneBadgeCount > 9 ? '9+' : smartphoneBadgeCount}
                </span>
              )}
            </button>

            {/* Active Action Progress Ring (when posing, riding, or fishing — inZOI Image 4 style) */}
            {hasActiveActionRing && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  if (activePoseItem) {
                    onStopQuickPose();
                  } else if (equippedScooterKind) {
                    onQuickToggleScooter();
                  } else {
                    onOpenBag();
                  }
                }}
                title={
                  activePoseItem
                    ? `Active: ${activePoseItem.name} (Click to stop)`
                    : equippedScooterKind
                      ? 'Riding Scooter (Click to dismount)'
                      : 'Fishing Rod Equipped (Click to open Bag)'
                }
                className="relative w-9 h-9 rounded-full bg-white/90 text-slate-900 ring-2 ring-white ring-offset-2 ring-offset-[#0d1118]/70 flex items-center justify-center shadow-md cursor-pointer transition-transform hover:scale-105 active:scale-95"
              >
                {activePoseItem ? (
                  <Sparkles className="w-4 h-4 stroke-[2]" />
                ) : equippedScooterKind ? (
                  <Bike className="w-4 h-4 stroke-[2]" />
                ) : (
                  <Backpack className="w-4 h-4 stroke-[2]" />
                )}
              </button>
            )}

            {/* Clean Circular Quick Slots (Wardrobe, Poses, Emotes, City Map) */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onOpenWardrobe();
                }}
                title="Wardrobe Studio"
                aria-label="Open Wardrobe Studio"
                className="w-9 h-9 rounded-full bg-white/[0.08] hover:bg-white/[0.18] border border-white/10 hover:border-white/30 text-white/88 hover:text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer"
              >
                <Shirt className="w-4 h-4 stroke-[1.75]" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => toggleTray('poses')}
                title="Poses & Dances"
                aria-label="Poses & Dances"
                aria-expanded={openTray === 'poses'}
                className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                  openTray === 'poses' || activeQuickPoseId
                    ? 'bg-sky-400/25 border-sky-300/70 text-sky-200'
                    : 'bg-white/[0.08] hover:bg-white/[0.18] border-white/10 hover:border-white/30 text-white/88 hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4 stroke-[1.75]" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => toggleTray('emotes')}
                title="Quick Emotes"
                aria-label="Quick Emotes"
                aria-expanded={openTray === 'emotes'}
                className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                  openTray === 'emotes'
                    ? 'bg-sky-400/25 border-sky-300/70 text-sky-200'
                    : 'bg-white/[0.08] hover:bg-white/[0.18] border-white/10 hover:border-white/30 text-white/88 hover:text-white'
                }`}
              >
                <Smile className="w-4 h-4 stroke-[1.75]" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onOpenCityMap();
                }}
                title="3D City View Map"
                aria-label="Open 3D City View Map"
                className="w-9 h-9 rounded-full bg-white/[0.08] hover:bg-white/[0.18] border border-white/10 hover:border-white/30 text-white/88 hover:text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer"
              >
                <MapIcon className="w-4 h-4 stroke-[1.75]" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
