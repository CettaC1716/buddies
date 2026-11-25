import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Music,
  PersonStanding,
  RotateCcw,
  Square,
  Users,
  X,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import type { NearbyEntityUser } from './SocialChatModal';
import type { WardrobeCatalogItem } from '../game/buddiesWardrobeStudioRules';
import type { WorldMultiplayerPairedPoseEvent } from '../lib/supabaseClient';

export interface PairedInteractionStatusState {
  active: boolean;
  status?: 'active' | 'pending' | 'declined' | 'stopped';
  partnerName?: string;
  animId?: string;
  animLabel?: string;
}

export interface PairedInteractionOverlayProps {
  /** Strictly non-null ONLY when the user clicked "Interact" on a nearby player or NPC */
  targetEntity: NearbyEntityUser | null;
  ownedPairedItems: readonly WardrobeCatalogItem[];
  pairedStatus: PairedInteractionStatusState | null;
  incomingInvite: WorldMultiplayerPairedPoseEvent | null;
  onSelectPairedAnimation: (entity: NearbyEntityUser, item: WardrobeCatalogItem) => void;
  onClosePopup: () => void;
  onStopPairedPose: () => void;
  onAcceptInvite: (ev: WorldMultiplayerPairedPoseEvent) => void;
  onDeclineInvite: (ev: WorldMultiplayerPairedPoseEvent) => void;
}

type PairedRailFilter = 'all' | 'pose' | 'dance';

const PAIRED_RAIL_CATEGORIES: ReadonlyArray<{
  id: PairedRailFilter;
  label: string;
  headerLabel: string;
  Icon: React.FC<{ className?: string }>;
}> = [
  { id: 'all', label: 'All Duo', headerLabel: 'Paired Duo', Icon: Users },
  { id: 'pose', label: 'Pose', headerLabel: 'Duo Pose', Icon: PersonStanding },
  { id: 'dance', label: 'Dance', headerLabel: 'Duo Dance', Icon: Music },
];

export const PairedInteractionOverlay: React.FC<PairedInteractionOverlayProps> = ({
  targetEntity,
  ownedPairedItems,
  pairedStatus,
  incomingInvite,
  onSelectPairedAnimation,
  onClosePopup,
  onStopPairedPose,
  onAcceptInvite,
  onDeclineInvite,
}) => {
  const [subFilter, setSubFilter] = useState<PairedRailFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    if (!targetEntity) {
      setHasEntered(false);
      return;
    }
    const raf = window.requestAnimationFrame(() => setHasEntered(true));
    return () => window.cancelAnimationFrame(raf);
  }, [targetEntity]);

  useEffect(() => {
    if (!targetEntity) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClosePopup();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [targetEntity, onClosePopup]);

  const categoryCounts = useMemo(() => {
    const counts: Record<PairedRailFilter, number> = {
      all: ownedPairedItems.length,
      pose: 0,
      dance: 0,
    };
    for (const item of ownedPairedItems) {
      const sub = item.pairedAnim?.subKind ?? 'pose';
      if (sub === 'dance') counts.dance += 1;
      else counts.pose += 1;
    }
    return counts;
  }, [ownedPairedItems]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ownedPairedItems.filter((item) => {
      const sub = item.pairedAnim?.subKind ?? 'pose';
      if (subFilter !== 'all' && sub !== subFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        (item.pairedAnim?.vibeTag ?? '').toLowerCase().includes(q)
      );
    });
  }, [ownedPairedItems, subFilter, searchQuery]);

  const cleanTargetName = targetEntity
    ? targetEntity.name.replace(/\s*\((ANDA|YOU|KAMU)\)/gi, '').trim()
    : '';

  const activeCategoryMeta =
    PAIRED_RAIL_CATEGORIES.find((cat) => cat.id === subFilter) ?? PAIRED_RAIL_CATEGORIES[0];

  return (
    <>
      {/* 1. Left-Docked Dark Glassmorphism Paired Duo Modal (matches Style · Animation Set & Smartphone OS) */}
      {targetEntity && (
        <aside
          role="dialog"
          aria-modal="false"
          aria-label={`Paired Interaction with ${cleanTargetName}`}
          data-paired-interaction-popup="true"
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className={`fixed inset-x-2.5 sm:inset-x-auto sm:left-4 top-[max(0.5rem,var(--safe-top))] sm:top-14 bottom-[calc(64px+var(--safe-bottom))] sm:bottom-[76px] my-auto z-50 sm:w-[356px] max-w-[400px] mx-auto sm:mx-0 max-h-[min(620px,calc(100dvh-4.75rem))] pointer-events-auto select-none transition-all duration-250 ease-out ${
            hasEntered ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'
          }`}
        >
          <div className="w-full h-full rounded-[32px] overflow-hidden flex flex-col bg-gradient-to-b from-[#171d2c]/86 via-[#111622]/84 to-[#0c101a]/88 border border-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_24px_70px_rgba(0,0,0,0.58)] text-white">
            {/* Top Header Bar */}
            <div className="shrink-0 px-4 py-3.5 border-b border-white/[0.12] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold tracking-tight text-white truncate leading-tight">
                  Style · {activeCategoryMeta.headerLabel}
                </h2>
                <div className="text-[11px] text-white/60 truncate mt-0.5">
                  with {cleanTargetName}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {pairedStatus?.active && (
                  <button
                    type="button"
                    data-paired-stop-header-btn="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      onStopPairedPose();
                    }}
                    className="h-7 px-2.5 rounded-full bg-rose-500/85 hover:bg-rose-500 text-white text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Stop active paired pose"
                  >
                    <Square className="w-2.5 h-2.5 fill-current" />
                    <span>Stop</span>
                  </button>
                )}
                <button
                  type="button"
                  data-paired-popup-close-btn="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onClosePopup();
                  }}
                  aria-label="Close paired interaction list"
                  className="w-7 h-7 rounded-full bg-white/[0.1] hover:bg-white/[0.2] text-white/85 hover:text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 2-Column Body: Left Circular Category Rail + Right 3-Column Circular Orb Grid */}
            <div className="flex-1 flex min-h-0">
              {/* Left Vertical Circular Category Rail */}
              <nav
                aria-label="Paired duo categories"
                className="w-[64px] shrink-0 py-3 px-1 border-r border-white/[0.12] flex flex-col items-center gap-3 overflow-y-auto no-scrollbar"
              >
                {PAIRED_RAIL_CATEGORIES.map(({ id, label, Icon }) => {
                  const isActive = subFilter === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      data-paired-cat={id}
                      onClick={() => {
                        soundEngine.playUiClick();
                        setSubFilter(id);
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

              {/* Right Content Pane: Reset Row + Search + 3-Column Circular Orbs */}
              <div className="flex-1 min-w-0 overflow-y-auto no-scrollbar px-3 py-3 space-y-3">
                {/* Top Utility Row */}
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      onStopPairedPose();
                    }}
                    className="inline-flex items-center gap-1.5 text-white/75 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Style</span>
                  </button>
                  <span className="text-[11px] text-white/55 tabular-nums">
                    {categoryCounts[subFilter]} owned
                  </span>
                </div>

                {/* Search Input */}
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search paired animations..."
                  className="w-full h-7 px-3 rounded-full bg-white/[0.08] border border-white/[0.14] text-[11px] text-white placeholder:text-white/45 focus:outline-none focus:border-[#8ad8ff]/70"
                />

                {/* Section Subheading */}
                <div className="text-[11.5px] font-semibold text-white/68 flex items-center gap-1.5">
                  <span>Owned</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{filteredItems.length}</span>
                </div>

                {/* 3-Column Circular Orb Grid */}
                {filteredItems.length === 0 ? (
                  <div className="py-10 text-center text-xs text-white/55 px-2">
                    {ownedPairedItems.length === 0
                      ? 'No paired animations owned yet. Open Wardrobe → Style → Paired.'
                      : 'No matching paired animations found.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-x-2 gap-y-3.5 pb-2">
                    {filteredItems.map((item) => {
                      const isActive =
                        Boolean(pairedStatus?.active) && pairedStatus?.animId === item.id;
                      const isDance = item.pairedAnim?.subKind === 'dance';
                      const vibeTag =
                        item.pairedAnim?.vibeTag ?? (isDance ? 'DANCE' : 'DUO');
                      return (
                        <button
                          key={item.id}
                          type="button"
                          data-paired-anim-item-btn={item.id}
                          onClick={() => {
                            soundEngine.playUiClick();
                            if (isActive) {
                              onStopPairedPose();
                            } else {
                              onSelectPairedAnimation(targetEntity, item);
                            }
                          }}
                          className="group flex flex-col items-center gap-1.5 text-center cursor-pointer focus-visible:outline-none"
                          title={`${item.name} · ${isDance ? 'Duo Dance' : 'Duo Pose'}`}
                        >
                          <div
                            className={`relative w-[68px] h-[68px] sm:w-[70px] sm:h-[70px] rounded-full overflow-hidden flex items-center justify-center transition-transform duration-150 group-hover:scale-[1.04] group-active:scale-95 ${
                              isActive
                                ? 'border-2 border-white shadow-[0_4px_16px_rgba(138,216,255,0.5)]'
                                : 'border border-white/20 group-hover:border-white/45'
                            }`}
                            style={{
                              background: `radial-gradient(circle at 32% 28%, ${item.swatchGradient[0]}, ${item.swatchGradient[1]})`,
                            }}
                          >
                            <div className="flex flex-col items-center justify-center gap-0.5 text-white drop-shadow-[0_3px_8px_rgba(0,0,0,0.45)]">
                              {isDance ? (
                                <Music className="w-4 h-4 stroke-[2]" />
                              ) : (
                                <Users className="w-4 h-4 stroke-[2]" />
                              )}
                              <span className="text-[8px] font-bold tracking-wide uppercase text-white/95 max-w-[54px] truncate">
                                {vibeTag}
                              </span>
                            </div>

                            {isActive && (
                              <span className="absolute bottom-0.5 right-0.5 w-4.5 h-4.5 rounded-full bg-[#8ad8ff] text-slate-950 flex items-center justify-center shadow">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </span>
                            )}
                          </div>

                          <div className="w-full px-0.5">
                            <div className="text-[10.5px] font-semibold text-white/94 truncate leading-tight">
                              {item.name}
                            </div>
                            <div className="text-[9.5px] text-white/52 leading-tight mt-0.5">
                              {isDance ? 'Duo Dance' : 'Duo Pose'}
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
        </aside>
      )}

      {/* 2. Active / Pending / Declined Paired Pose Status Pill */}
      {pairedStatus && (pairedStatus.active || pairedStatus.status === 'pending' || pairedStatus.status === 'declined') && (
        <div
          data-paired-active-banner="true"
          onPointerDown={(e) => e.stopPropagation()}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[47] flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-gradient-to-b from-[#171d2c]/86 via-[#111622]/84 to-[#0c101a]/88 border border-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_12px_32px_rgba(0,0,0,0.52)] text-white text-xs select-none"
        >
          <Users className="w-3.5 h-3.5 text-[#8ad8ff] shrink-0" />
          <span className="font-semibold max-w-[260px] truncate">
            {pairedStatus.active
              ? `${pairedStatus.animLabel} · with ${pairedStatus.partnerName}`
              : pairedStatus.status === 'pending'
                ? `Waiting for ${pairedStatus.partnerName} to accept...`
                : `${pairedStatus.partnerName} declined the pose invite.`}
          </span>
          {pairedStatus.active && (
            <button
              type="button"
              data-paired-stop-btn="true"
              onClick={() => {
                soundEngine.playUiClick();
                onStopPairedPose();
              }}
              className="h-6 px-2.5 rounded-full bg-rose-500/90 hover:bg-rose-500 text-white text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
              <span>Stop</span>
            </button>
          )}
        </div>
      )}

      {/* 3. Incoming Remote Player Paired Pose Invite */}
      {incomingInvite && (
        <div
          data-paired-invite-banner="true"
          onPointerDown={(e) => e.stopPropagation()}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-[48] flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-gradient-to-b from-[#171d2c]/86 via-[#111622]/84 to-[#0c101a]/88 border border-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_16px_42px_rgba(0,0,0,0.58)] text-white select-none"
        >
          <span className="w-8 h-8 rounded-full bg-[#8ad8ff] text-slate-950 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate max-w-[220px]">
              {incomingInvite.fromDisplayName} invited you to a paired pose!
            </div>
            <div className="text-[11px] text-[#8ad8ff] font-semibold truncate max-w-[220px]">
              {incomingInvite.animLabel}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              data-paired-invite-accept-btn="true"
              onClick={() => {
                soundEngine.playUiConfirm();
                onAcceptInvite(incomingInvite);
              }}
              className="h-8 px-3 rounded-full bg-[#b8ff3c] hover:bg-[#d9ff80] text-slate-950 text-[11px] font-black uppercase flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>Accept</span>
            </button>
            <button
              type="button"
              data-paired-invite-decline-btn="true"
              onClick={() => {
                soundEngine.playUiClick();
                onDeclineInvite(incomingInvite);
              }}
              className="h-8 px-2.5 rounded-full bg-white/12 hover:bg-white/22 text-white/90 text-[11px] font-bold cursor-pointer"
            >
              Decline
            </button>
          </div>
        </div>
      )}
    </>
  );
};
