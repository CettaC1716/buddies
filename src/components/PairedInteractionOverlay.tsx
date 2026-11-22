import React, { useMemo, useState } from 'react';
import { Check, Music, Sparkles, Square, Users, X } from 'lucide-react';
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
  const [subFilter, setSubFilter] = useState<'all' | 'pose' | 'dance'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ownedPairedItems.filter((item) => {
      const sub = item.pairedAnim?.subKind ?? 'pose';
      if (subFilter !== 'all' && sub !== subFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q)
      );
    });
  }, [ownedPairedItems, subFilter, searchQuery]);

  const cleanTargetName = targetEntity
    ? targetEntity.name.replace(/\s*\((ANDA|YOU|KAMU)\)/gi, '').trim()
    : '';

  return (
    <>
      {/* 1. Left-Side Paired Animation List Popup — STRICTLY ONLY VISIBLE when interacting */}
      {targetEntity && (
        <aside
          aria-label={`Paired Interaction with ${cleanTargetName}`}
          data-paired-interaction-popup="true"
          onPointerDown={(e) => e.stopPropagation()}
          className="fixed left-3 sm:left-5 top-1/2 -translate-y-1/2 z-[46] w-[268px] sm:w-[292px] max-h-[64vh] flex flex-col rounded-2xl bg-[#12151e]/92 backdrop-blur-md border-2 border-[#fb7185]/70 shadow-[0_18px_46px_rgba(0,0,0,0.68)] text-white select-none overflow-hidden"
        >
          {/* Header */}
          <div className="px-3.5 py-2.5 border-b border-white/10 flex items-center justify-between gap-2 bg-gradient-to-r from-[#fb7185]/20 to-transparent">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#fb7185] shrink-0" aria-hidden="true" />
                <span className="text-[11px] font-black uppercase tracking-wider text-[#fb7185]">
                  Paired Interaction
                </span>
              </div>
              <div className="text-xs font-bold text-white truncate mt-0.5">
                with {cleanTargetName}
              </div>
            </div>
            <button
              type="button"
              data-paired-popup-close-btn="true"
              onClick={() => {
                soundEngine.playUiClick();
                onClosePopup();
              }}
              aria-label="Close paired interaction list"
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/85 shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Filter pills + search */}
          <div className="px-3 pt-2.5 pb-2 space-y-2 border-b border-white/10">
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'pose', label: 'Duo Pose' },
                  { id: 'dance', label: 'Duo Dance' },
                ] as const
              ).map((pill) => {
                const active = subFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setSubFilter(pill.id);
                    }}
                    className={`h-6.5 rounded-full text-[10px] font-bold transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#fb7185] text-slate-950'
                        : 'bg-white/[0.08] text-white/75 hover:bg-white/[0.16]'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search paired animations..."
              className="w-full h-7 px-2.5 rounded-full bg-white/[0.08] border border-white/15 text-[11px] text-white placeholder:text-white/45 focus:outline-none focus:border-[#fb7185]/70"
            />
          </div>

          {/* Owned Paired Animations List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredItems.length === 0 ? (
              <div className="py-8 text-center text-[11px] text-white/55 px-3">
                {ownedPairedItems.length === 0
                  ? 'No paired animations owned yet. Open Wardrobe Studio → Style → Paired.'
                  : 'No matching paired animations found.'}
              </div>
            ) : (
              filteredItems.map((item) => {
                const isActive =
                  Boolean(pairedStatus?.active) && pairedStatus?.animId === item.id;
                const isDance = item.pairedAnim?.subKind === 'dance';
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
                    className={`w-full px-2.5 py-2 rounded-xl flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#fb7185]/25 border border-[#fb7185] text-white'
                        : 'bg-white/[0.05] hover:bg-white/[0.13] border border-transparent text-white/92'
                    }`}
                  >
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white shadow-sm"
                      style={{
                        background: `linear-gradient(135deg, ${item.swatchGradient[0]}, ${item.swatchGradient[1]})`,
                      }}
                    >
                      {isDance ? (
                        <Music className="w-3.5 h-3.5" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11.5px] font-semibold truncate leading-tight">
                        {item.name}
                      </div>
                      <div className="text-[9.5px] text-white/55 truncate mt-0.5">
                        {isDance ? 'Paired Dance' : 'Paired Pose'}
                      </div>
                    </div>
                    {isActive && (
                      <span className="px-1.5 py-0.5 rounded-full bg-[#fb7185] text-slate-950 text-[9px] font-black uppercase shrink-0">
                        Active
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>
      )}

      {/* 2. Active / Pending / Declined Paired Pose Status Pill */}
      {pairedStatus && (pairedStatus.active || pairedStatus.status === 'pending' || pairedStatus.status === 'declined') && (
        <div
          data-paired-active-banner="true"
          onPointerDown={(e) => e.stopPropagation()}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[47] flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-[#12151e]/92 backdrop-blur-md border border-[#fb7185]/70 shadow-[0_10px_28px_rgba(0,0,0,0.55)] text-white text-xs select-none"
        >
          <Users className="w-3.5 h-3.5 text-[#fb7185] shrink-0" />
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
              className="h-6 px-2.5 rounded-full bg-[#fb7185] hover:bg-[#fda4af] text-slate-950 text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer shrink-0"
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
          className="fixed top-24 left-1/2 -translate-x-1/2 z-[48] flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#12151e]/95 backdrop-blur-md border-2 border-[#fb7185] shadow-[0_14px_38px_rgba(0,0,0,0.65)] text-white select-none"
        >
          <span className="w-8 h-8 rounded-full bg-[#fb7185] text-slate-950 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-white truncate max-w-[220px]">
              {incomingInvite.fromDisplayName} invited you to a paired pose!
            </div>
            <div className="text-[11px] text-[#fda4af] font-semibold truncate max-w-[220px]">
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
