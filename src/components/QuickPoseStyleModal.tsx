import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Flame,
  Hand,
  Music,
  PersonStanding,
  RotateCcw,
  Smile,
  Square,
  X,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import { SOCIAL_EMOTE_QUICK_LIST } from '../game/buddiesRemotePresenceSync';
import type { WardrobeCatalogItem } from '../game/buddiesWardrobeStudioRules';

export type QuickPoseModalCategory =
  | 'style_pose'
  | 'style_dance'
  | 'style_action'
  | 'emotes';

export interface QuickPoseStyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  quickPoseItems: readonly WardrobeCatalogItem[];
  activeQuickPoseId: string | null;
  onTriggerQuickPose: (item: WardrobeCatalogItem) => void;
  onStopQuickPose: () => void;
  onTriggerEmote: (emoteId: string) => void;
  onStopEmote: () => void;
}

const RAIL_CATEGORIES: ReadonlyArray<{
  id: QuickPoseModalCategory;
  label: string;
  headerLabel: string;
  Icon: React.FC<{ className?: string }>;
}> = [
  { id: 'style_pose', label: 'Pose', headerLabel: 'Pose', Icon: PersonStanding },
  { id: 'style_dance', label: 'Dance', headerLabel: 'Dance', Icon: Music },
  { id: 'style_action', label: 'Action', headerLabel: 'Action', Icon: Hand },
  { id: 'emotes', label: 'Emotes', headerLabel: 'Emotes', Icon: Smile },
];

const EMOTE_ORB_STYLES: Record<
  string,
  { gradient: readonly [string, string]; tag: string; subtitle: string }
> = {
  wave: {
    gradient: ['#38bdf8', '#2563eb'],
    tag: 'WAVE',
    subtitle: 'Quick Emote',
  },
  cheer: {
    gradient: ['#f472b6', '#db2777'],
    tag: 'CHEER',
    subtitle: 'Quick Emote',
  },
  dance: {
    gradient: ['#34d399', '#059669'],
    tag: 'GROOVE',
    subtitle: 'Quick Emote',
  },
  salute: {
    gradient: ['#fbbf24', '#d97706'],
    tag: 'SALUTE',
    subtitle: 'Quick Emote',
  },
};

export const QuickPoseStyleModal: React.FC<QuickPoseStyleModalProps> = ({
  isOpen,
  onClose,
  quickPoseItems,
  activeQuickPoseId,
  onTriggerQuickPose,
  onStopQuickPose,
  onTriggerEmote,
  onStopEmote,
}) => {
  const [activeCategory, setActiveCategory] = useState<QuickPoseModalCategory>('style_pose');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeEmoteId, setActiveEmoteId] = useState<string | null>(null);
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setHasEntered(false);
      return;
    }
    const raf = window.requestAnimationFrame(() => setHasEntered(true));
    return () => window.cancelAnimationFrame(raf);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const categoryCounts = useMemo(() => {
    const counts: Record<QuickPoseModalCategory, number> = {
      style_pose: 0,
      style_dance: 0,
      style_action: 0,
      emotes: SOCIAL_EMOTE_QUICK_LIST.length,
    };
    for (const item of quickPoseItems) {
      if (item.slot === 'style_pose') counts.style_pose += 1;
      else if (item.slot === 'style_dance') counts.style_dance += 1;
      else if (item.slot === 'style_action') counts.style_action += 1;
    }
    return counts;
  }, [quickPoseItems]);

  const filteredItems = useMemo(() => {
    if (activeCategory === 'emotes') return [];
    const q = searchQuery.trim().toLowerCase();
    return quickPoseItems.filter((item) => {
      if (item.slot !== activeCategory) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.collection.toLowerCase().includes(q) ||
        (item.dancePose?.vibeTag ?? '').toLowerCase().includes(q)
      );
    });
  }, [quickPoseItems, activeCategory, searchQuery]);

  if (!isOpen) return null;

  const activeCategoryMeta =
    RAIL_CATEGORIES.find((cat) => cat.id === activeCategory) ?? RAIL_CATEGORIES[0];

  const handleResetAll = () => {
    soundEngine.playUiClick();
    onStopQuickPose();
    onStopEmote();
    setActiveEmoteId(null);
  };

  const hasActiveMotion = Boolean(activeQuickPoseId || activeEmoteId);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={`Style · ${activeCategoryMeta.headerLabel}`}
      data-quick-pose-modal="true"
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className={`fixed inset-x-2.5 sm:inset-x-auto sm:left-4 top-[max(0.5rem,var(--safe-top))] sm:top-14 bottom-[calc(64px+var(--safe-bottom))] sm:bottom-[76px] my-auto z-50 sm:w-[356px] max-w-[400px] mx-auto sm:mx-0 max-h-[min(620px,calc(100dvh-4.75rem))] pointer-events-auto select-none transition-all duration-250 ease-out ${
        hasEntered ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'
      }`}
    >
      <div className="w-full h-full rounded-[32px] overflow-hidden flex flex-col bg-[#141926]/68 backdrop-blur-2xl border border-white/25 shadow-[0_24px_70px_rgba(0,0,0,0.52)] text-white">
        {/* Top Header matching Wardrobe Style · Animation Set */}
        <div className="shrink-0 px-4 py-3.5 border-b border-white/[0.12] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-[15px] font-bold tracking-tight text-white truncate">
              Style · {activeCategoryMeta.headerLabel}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {hasActiveMotion && (
              <button
                type="button"
                data-quick-pose-stop-btn="true"
                onClick={handleResetAll}
                className="h-7 px-2.5 rounded-full bg-rose-500/85 hover:bg-rose-500 text-white text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                title="Stop active pose or emote"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>Stop</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onClose();
              }}
              aria-label="Close Style & Pose Menu"
              className="w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/[0.18] text-white/80 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2-Column Body: Left Circular Rail + Right Circular Orb Grid */}
        <div className="flex-1 flex min-h-0">
          {/* Left Vertical Circular Category Rail */}
          <nav
            aria-label="Pose & Style categories"
            className="w-[64px] shrink-0 py-3 px-1 border-r border-white/[0.12] flex flex-col items-center gap-3 overflow-y-auto no-scrollbar"
          >
            {RAIL_CATEGORIES.map(({ id, label, Icon }) => {
              const isActive = activeCategory === id;
              return (
                <button
                  key={id}
                  type="button"
                  data-quick-pose-cat={id}
                  onClick={() => {
                    soundEngine.playUiClick();
                    setActiveCategory(id);
                    setSearchQuery('');
                  }}
                  className="flex flex-col items-center gap-1 w-full cursor-pointer group focus-visible:outline-none"
                >
                  <span
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      isActive
                        ? 'bg-[#8ad8ff] text-slate-950 shadow-[0_4px_14px_rgba(138,216,255,0.42)]'
                        : 'bg-white/[0.08] text-white/78 group-hover:bg-white/[0.16] group-hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 stroke-[2]" />
                  </span>
                  <span
                    className={`text-[10px] leading-tight text-center ${
                      isActive ? 'text-white font-semibold' : 'text-white/62'
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Right Pane: Reset Row + Owned Count + 3-Column Circular Orbs */}
          <div className="flex-1 min-w-0 overflow-y-auto no-scrollbar px-3 py-3 space-y-3">
            {/* Top Utility Row: Reset Style + Owned Count */}
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleResetAll}
                className="inline-flex items-center gap-1.5 text-white/75 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Style</span>
              </button>
              <span className="text-[11px] text-white/50 tabular-nums">
                {categoryCounts[activeCategory]} owned
              </span>
            </div>

            {/* Search Filter Input (for Pose / Dance / Action tabs) */}
            {activeCategory !== 'emotes' && (
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeCategoryMeta.label.toLowerCase()}...`}
                className="w-full h-7 px-3 rounded-full bg-white/[0.07] border border-white/[0.12] text-[11px] text-white placeholder:text-white/42 focus:outline-none focus:border-[#8ad8ff]/70"
              />
            )}

            {/* Section Subheading */}
            <div className="text-[11.5px] font-semibold text-white/68 flex items-center gap-1.5">
              <span>Owned</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {activeCategory === 'emotes'
                  ? SOCIAL_EMOTE_QUICK_LIST.length
                  : filteredItems.length}
              </span>
            </div>

            {/* 3-Column Circular Orb Grid */}
            {activeCategory === 'emotes' ? (
              <div className="grid grid-cols-3 gap-x-2 gap-y-3.5 pb-2">
                {SOCIAL_EMOTE_QUICK_LIST.map((emote) => {
                  const styleSpec = EMOTE_ORB_STYLES[emote.id] ?? {
                    gradient: ['#60a5fa', '#2563eb'] as const,
                    tag: emote.label.toUpperCase(),
                    subtitle: 'Emote',
                  };
                  const isSelected = activeEmoteId === emote.id;
                  return (
                    <button
                      key={emote.id}
                      type="button"
                      data-social-emote-btn={emote.id}
                      onClick={() => {
                        soundEngine.playUiClick();
                        if (isSelected) {
                          onStopEmote();
                          setActiveEmoteId(null);
                        } else {
                          onStopQuickPose();
                          onTriggerEmote(emote.id);
                          setActiveEmoteId(emote.id);
                        }
                      }}
                      className="group flex flex-col items-center gap-1.5 text-center cursor-pointer focus-visible:outline-none"
                      title={emote.label}
                    >
                      <div
                        className={`relative w-[68px] h-[68px] sm:w-[70px] sm:h-[70px] rounded-full overflow-hidden flex items-center justify-center transition-transform duration-150 group-hover:scale-[1.04] group-active:scale-95 ${
                          isSelected
                            ? 'border-2 border-white shadow-[0_4px_16px_rgba(138,216,255,0.5)]'
                            : 'border border-white/20 group-hover:border-white/45'
                        }`}
                        style={{
                          background: `radial-gradient(circle at 32% 28%, ${styleSpec.gradient[0]}, ${styleSpec.gradient[1]})`,
                        }}
                      >
                        <div className="flex flex-col items-center justify-center gap-0.5 text-white drop-shadow-[0_3px_8px_rgba(0,0,0,0.45)]">
                          {emote.id === 'wave' || emote.id === 'salute' ? (
                            <Hand className="w-4 h-4 stroke-[2]" />
                          ) : emote.id === 'cheer' ? (
                            <Flame className="w-4 h-4 stroke-[2]" />
                          ) : (
                            <Music className="w-4 h-4 stroke-[2]" />
                          )}
                          <span className="text-[8px] font-bold tracking-wide uppercase text-white/95">
                            {styleSpec.tag}
                          </span>
                        </div>

                        {isSelected && (
                          <span className="absolute bottom-0.5 right-0.5 w-4.5 h-4.5 rounded-full bg-[#8ad8ff] text-slate-950 flex items-center justify-center shadow">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      <div className="w-full px-0.5">
                        <div className="text-[10.5px] font-semibold text-white/94 truncate leading-tight">
                          {emote.label}
                        </div>
                        <div className="text-[9.5px] text-white/50 leading-tight mt-0.5">
                          {styleSpec.subtitle}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-10 text-center text-xs text-white/52">
                No owned {activeCategoryMeta.label.toLowerCase()} items match this filter.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-x-2 gap-y-3.5 pb-2">
                {filteredItems.map((item) => {
                  const isPlaying = activeQuickPoseId === item.id;
                  const vibeTag =
                    item.dancePose?.vibeTag ??
                    (item.slot === 'style_dance'
                      ? 'DANCE'
                      : item.slot === 'style_action'
                        ? 'ACTION'
                        : 'POSE');
                  const statusText = item.isStarterDefault
                    ? 'Starter'
                    : item.priceLul === 0
                      ? 'Free'
                      : 'Owned';
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-quick-pose-item-btn={item.id}
                      onClick={() => {
                        soundEngine.playUiClick();
                        if (isPlaying) {
                          onStopQuickPose();
                        } else {
                          setActiveEmoteId(null);
                          onTriggerQuickPose(item);
                        }
                      }}
                      className="group flex flex-col items-center gap-1.5 text-center cursor-pointer focus-visible:outline-none"
                      title={`${item.name} · ${item.subtitle}`}
                    >
                      <div
                        className={`relative w-[68px] h-[68px] sm:w-[70px] sm:h-[70px] rounded-full overflow-hidden flex items-center justify-center transition-transform duration-150 group-hover:scale-[1.04] group-active:scale-95 ${
                          isPlaying
                            ? 'border-2 border-white shadow-[0_4px_16px_rgba(138,216,255,0.5)]'
                            : 'border border-white/20 group-hover:border-white/45'
                        }`}
                        style={{
                          background: `radial-gradient(circle at 32% 28%, ${item.swatchGradient[0]}, ${item.swatchGradient[1]})`,
                        }}
                      >
                        <div className="flex flex-col items-center justify-center gap-0.5 text-white drop-shadow-[0_3px_8px_rgba(0,0,0,0.45)]">
                          {item.slot === 'style_action' ||
                          item.dancePose?.danceKind === 'wave' ||
                          item.dancePose?.danceKind === 'salute' ? (
                            <Hand className="w-4 h-4 stroke-[2]" />
                          ) : item.dancePose?.danceKind === 'cheer' ||
                            item.dancePose?.danceKind === 'hiphop' ? (
                            <Flame className="w-4 h-4 stroke-[2]" />
                          ) : item.slot === 'style_pose' ? (
                            <PersonStanding className="w-4 h-4 stroke-[2]" />
                          ) : (
                            <Music className="w-4 h-4 stroke-[2]" />
                          )}
                          <span className="text-[8px] font-bold tracking-wide uppercase text-white/95 max-w-[54px] truncate">
                            {vibeTag}
                          </span>
                        </div>

                        {isPlaying && (
                          <span className="absolute bottom-0.5 right-0.5 w-4.5 h-4.5 rounded-full bg-[#8ad8ff] text-slate-950 flex items-center justify-center shadow">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      <div className="w-full px-0.5">
                        <div className="text-[10.5px] font-semibold text-white/94 truncate leading-tight">
                          {item.name}
                        </div>
                        <div className="text-[9.5px] text-white/50 leading-tight mt-0.5">
                          {statusText}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
