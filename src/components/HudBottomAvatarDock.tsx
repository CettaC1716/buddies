import React, { useEffect, useState } from 'react';
import {
  Backpack,
  Bike,
  ChevronRight,
  Fish,
  Gift,
  HeartHandshake,
  Lock,
  MessageCircle,
  Sparkles,
  Square,
  Store,
  User,
  X,
  Zap,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import {
  URBAN_SCOOTER_CATALOG_ITEMS,
  type UrbanScooterKind,
} from '../game/buddiesUrbanScooterRules';
import {
  PROFILE_IDENTITY_UPDATED_EVENT,
  readStoredEmblemIcon,
  readStoredEmblemName,
  readStoredStatusCoverPhotoUrl,
  renderProfileEmblemIcon,
  type ProfileEmblemIconId,
} from './CharacterProfileModal';
import type { NearbyEntityUser } from './SocialChatModal';

export interface HudBottomAvatarDockProps {
  playerDisplayName: string;
  characterGender: 'male' | 'female';
  statusLabel: string;
  statusTone?: 'emerald' | 'sky' | 'amber' | 'rose' | 'neutral';
  isFishingRodEquipped: boolean;
  equippedScooterKind: UrbanScooterKind | null;
  ownedScooterIds: readonly string[];
  canMountScooterOutdoors: boolean;
  targetEntity?: NearbyEntityUser | null;
  isTargetLocked?: boolean;
  isTargetInteractionOpen?: boolean;
  canCycleTargetEntity?: boolean;
  hasOwnedPairedAnimations?: boolean;
  isPairedModeActive?: boolean;
  onToggleTargetInteraction?: () => void;
  onClearTargetEntity?: () => void;
  onCycleTargetEntity?: () => void;
  onOpenTargetProfile?: (entity: NearbyEntityUser) => void;
  onWhisperTarget?: (entity: NearbyEntityUser) => void;
  onTalkMerchantTarget?: (entity: NearbyEntityUser) => void;
  onTalkCitizenTarget?: (entity: NearbyEntityUser) => void;
  onGiftTarget?: (entity: NearbyEntityUser) => void;
  onInteractTarget?: (entity: NearbyEntityUser) => void;
  onOpenProfile: () => void;
  onOpenBag: () => void;
  onOpenScooterShowroom: () => void;
  onToggleFishingRod: () => void;
  onToggleScooterKind: (kind: UrbanScooterKind) => void;
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

function cleanCharacterName(raw: string): string {
  return raw.replace(/\s*\((ANDA|YOU|KAMU)\)/gi, '').trim();
}

function getDockPhotoCropClassName(url: string): string {
  if (url.includes('#crop=top')) {
    return 'object-cover object-top scale-110';
  }
  if (url.includes('#crop=upper')) {
    return 'object-cover object-[center_22%] scale-125';
  }
  if (url.includes('#crop=center')) {
    return 'object-cover object-center scale-110';
  }
  return 'object-cover object-top';
}

function resolveEntityPortraitUrl(entity: NearbyEntityUser): string {
  const lower = cleanCharacterName(entity.name).toLowerCase();
  const isFemale =
    entity.gender === 'female' ||
    lower.includes('hana') ||
    lower.includes('nadia') ||
    lower.includes('mira') ||
    lower.includes('tari');
  return isFemale ? '/assets/avatar_nadia.jpg' : '/assets/avatar_hiro.jpg';
}

function isEntityMerchant(entity: NearbyEntityUser): boolean {
  return Boolean(
    entity.isMerchant ||
      entity.id === 'npc_hana' ||
      entity.id === 'npc_cafe' ||
      entity.id === 'npc_kai' ||
      entity.id === 'npc_beach',
  );
}

/**
 * Constant-proportion 2-Tier Modular Bottom-Center Hero Dock:
 * - Left: Portrait card (switches dynamically to nearby/selected Player or NPC) with top-left corner emblem/status badge
 * - Right (fixed w-[252px] constant geometry across all modes):
 *   - Top Tier: Clean Character/Target Name Pill (flex-1) + Color-Coded Bag & Motor Switcher Pill
 *   - Bottom Tier: Color-Coded Icon-Only Quick Action Buttons (Bag / Scooters / Target Interactions)
 */
export const HudBottomAvatarDock: React.FC<HudBottomAvatarDockProps> = ({
  playerDisplayName,
  characterGender,
  statusLabel,
  statusTone = 'emerald',
  isFishingRodEquipped,
  equippedScooterKind,
  ownedScooterIds,
  canMountScooterOutdoors,
  targetEntity = null,
  isTargetLocked = false,
  isTargetInteractionOpen = false,
  canCycleTargetEntity = false,
  hasOwnedPairedAnimations = false,
  isPairedModeActive = false,
  onToggleTargetInteraction,
  onClearTargetEntity,
  onCycleTargetEntity,
  onOpenTargetProfile,
  onWhisperTarget,
  onTalkMerchantTarget,
  onTalkCitizenTarget,
  onGiftTarget,
  onInteractTarget,
  onOpenProfile,
  onOpenBag,
  onOpenScooterShowroom,
  onToggleFishingRod,
  onToggleScooterKind,
}) => {
  const [dockCategory, setDockCategory] = useState<'bag' | 'scooter'>('bag');
  const [customCoverUrl, setCustomCoverUrl] = useState<string>(() =>
    readStoredStatusCoverPhotoUrl(),
  );
  const [emblemIconId, setEmblemIconId] = useState<ProfileEmblemIconId>(() =>
    readStoredEmblemIcon(),
  );
  const [emblemName, setEmblemName] = useState<string>(() =>
    readStoredEmblemName(),
  );

  useEffect(() => {
    const syncProfileIdentity = () => {
      setCustomCoverUrl(readStoredStatusCoverPhotoUrl());
      setEmblemIconId(readStoredEmblemIcon());
      setEmblemName(readStoredEmblemName());
    };
    window.addEventListener(PROFILE_IDENTITY_UPDATED_EVENT, syncProfileIdentity);
    window.addEventListener('storage', syncProfileIdentity);
    return () => {
      window.removeEventListener(PROFILE_IDENTITY_UPDATED_EVENT, syncProfileIdentity);
      window.removeEventListener('storage', syncProfileIdentity);
    };
  }, []);

  const hasTarget = Boolean(targetEntity);
  const showTargetInteractionBar = Boolean(
    targetEntity && (isTargetInteractionOpen || isPairedModeActive),
  );

  const defaultSelfPortraitUrl =
    characterGender === 'male'
      ? '/assets/avatar_hiro.jpg'
      : '/assets/avatar_nadia.jpg';
  const selfPortraitUrl = customCoverUrl || defaultSelfPortraitUrl;

  const targetCleanName = targetEntity ? cleanCharacterName(targetEntity.name) : '';
  const targetIsMerchant = targetEntity ? isEntityMerchant(targetEntity) : false;
  const targetIsCitizen = Boolean(targetEntity && targetEntity.isNpc && !targetIsMerchant);
  const targetIsRealPlayer = Boolean(
    targetEntity &&
      !targetEntity.isNpc &&
      !targetEntity.isSelf &&
      !targetCleanName.toUpperCase().startsWith('BUDDY #'),
  );

  const displayPortraitUrl = targetEntity
    ? resolveEntityPortraitUrl(targetEntity)
    : selfPortraitUrl;

  const displayName = targetEntity
    ? targetCleanName || 'Citizen'
    : playerDisplayName || 'Buddy';

  const displayStatusLabel = targetEntity
    ? targetIsMerchant
      ? 'Merchant'
      : targetIsCitizen
        ? 'NPC'
        : targetEntity.distance > 0
          ? `${Math.max(1, Math.round(targetEntity.distance))}m`
          : 'Player'
    : statusLabel;

  const displayTone: NonNullable<HudBottomAvatarDockProps['statusTone']> = targetEntity
    ? targetIsMerchant
      ? 'amber'
      : 'sky'
    : statusTone;

  const handleSelectCategory = (cat: 'bag' | 'scooter') => {
    if (isPairedModeActive) return;
    soundEngine.playUiClick();
    if (showTargetInteractionBar) {
      onToggleTargetInteraction?.();
    }
    setDockCategory(cat);
  };

  const handleWhisperOrTalk = () => {
    if (!targetEntity) return;
    soundEngine.playUiClick();
    if (targetIsMerchant) {
      onTalkMerchantTarget?.(targetEntity);
    } else if (targetIsCitizen) {
      onTalkCitizenTarget?.(targetEntity);
    } else if (targetIsRealPlayer) {
      onWhisperTarget?.(targetEntity);
    } else {
      onOpenTargetProfile?.(targetEntity);
    }
  };

  return (
    <div
      data-hud-avatar-dock="true"
      className="fixed bottom-3.5 left-1/2 -translate-x-1/2 z-30 hidden lg:flex flex-col items-center gap-2 pointer-events-none select-none"
    >
      {/* Main Constant-Width 2-Tier Hero Dock */}
      <div className="pointer-events-auto flex items-end gap-2">
        {/* Left: Portrait Card with top-left overlapping status badge */}
        <div className="relative shrink-0">
          <button
            type="button"
            data-dock-portrait-btn="true"
            onClick={() => {
              soundEngine.playUiClick();
              if (targetEntity) {
                if (showTargetInteractionBar) {
                  onOpenTargetProfile?.(targetEntity);
                } else {
                  onToggleTargetInteraction?.();
                }
              } else {
                onOpenProfile();
              }
            }}
            title={
              targetEntity
                ? showTargetInteractionBar
                  ? `${displayName} · View Profile`
                  : `${displayName} · Open Interactions`
                : `${displayName} · ${emblemName} · Click to open Profile`
            }
            className={`group relative w-[72px] h-[94px] rounded-2xl bg-[#0d1118]/75 backdrop-blur-sm border shadow-[0_12px_34px_rgba(0,0,0,0.48)] overflow-hidden cursor-pointer transition-all active:scale-95 ${PORTRAIT_FRAME_GRADIENTS[displayTone]} ${
              showTargetInteractionBar ? 'ring-2 ring-white/60' : ''
            }`}
          >
            <img
              src={displayPortraitUrl}
              alt={displayName}
              draggable={false}
              className={`w-full h-full ${getDockPhotoCropClassName(displayPortraitUrl)} transition-transform duration-300 group-hover:scale-105`}
            />
            <div
              aria-hidden="true"
              className={`absolute inset-0 bg-gradient-to-b ${PORTRAIT_FRAME_GRADIENTS[displayTone]} pointer-events-none`}
            />
            <span className="absolute bottom-1.5 inset-x-1 text-[10.5px] font-semibold tracking-tight text-white text-center truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.75)]">
              {displayStatusLabel}
            </span>
          </button>
          {/* Top-left overlapping circular emblem/target icon badge */}
          <span
            aria-hidden="true"
            data-dock-emblem-badge={hasTarget ? 'target' : emblemIconId}
            title={hasTarget ? displayStatusLabel : emblemName}
            className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full border-2 border-[#0d1118] flex items-center justify-center shadow-md pointer-events-none ${CORNER_BADGE_BG[displayTone]}`}
          >
            {hasTarget ? (
              targetIsMerchant ? (
                <Sparkles className="w-3 h-3 stroke-[2.4]" />
              ) : (
                <User className="w-3 h-3 stroke-[2.4]" />
              )
            ) : (
              renderProfileEmblemIcon(emblemIconId, 'w-3 h-3 stroke-[2.4]')
            )}
          </span>
        </div>

        {/* Right: Constant-Width (252px) 2-Tier Frosted Glass Stack */}
        <div className="flex flex-col gap-1.5 w-[252px] shrink-0">
          {/* TOP TIER: Clean Character/Target Name Pill (flex-1) + Color-Coded Bag & Motor Switcher */}
          <div className="w-full h-[38px] flex items-center gap-1.5">
            {/* Pill 1: Clean Name Only (full room so name never truncates) */}
            <div
              data-dock-character-pill={hasTarget ? 'target' : 'self'}
              className={`flex-1 min-w-0 h-full px-3 rounded-2xl backdrop-blur-sm border shadow-[0_8px_24px_rgba(0,0,0,0.34)] flex items-center justify-between gap-1.5 transition-all ${
                hasTarget
                  ? showTargetInteractionBar
                    ? 'bg-sky-500/25 border-sky-300/65 ring-1 ring-sky-300/40'
                    : 'bg-[#0d1118]/72 border-sky-300/45 hover:border-sky-300/75'
                  : 'bg-[#0d1118]/58 border-white/15 hover:border-white/25'
              }`}
            >
              {targetEntity ? (
                <>
                  <button
                    type="button"
                    data-dock-target-toggle="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      onToggleTargetInteraction?.();
                    }}
                    title={
                      showTargetInteractionBar
                        ? `Close ${displayName} interactions`
                        : `Interact with ${displayName}`
                    }
                    aria-expanded={showTargetInteractionBar}
                    className="flex-1 min-w-0 w-full h-full flex items-center text-left cursor-pointer"
                  >
                    <span className="block w-full text-[12px] font-semibold tracking-tight text-white truncate">
                      {displayName}
                    </span>
                  </button>

                  <div className="flex items-center gap-0.5 shrink-0">
                    {canCycleTargetEntity && onCycleTargetEntity && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          soundEngine.playUiClick();
                          onCycleTargetEntity();
                        }}
                        title="Switch nearby character"
                        aria-label="Switch nearby character"
                        className="w-5 h-5 rounded-full bg-white/[0.1] hover:bg-white/[0.22] text-white/85 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {(isTargetLocked || showTargetInteractionBar) && onClearTargetEntity && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          soundEngine.playUiClick();
                          onClearTargetEntity();
                        }}
                        title="Back to own dock"
                        aria-label="Back to own dock"
                        className="w-5 h-5 rounded-full hover:bg-white/15 text-white/60 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onOpenProfile();
                  }}
                  title={`${displayName} · Open Profile`}
                  className="flex-1 min-w-0 w-full h-full flex items-center text-left cursor-pointer"
                >
                  <span className="block w-full text-[12px] font-semibold tracking-tight text-white/95 truncate">
                    {displayName}
                  </span>
                </button>
              )}
            </div>

            {/* Pill 2: Vibrant Color-Coded Bag & Motor Mode Switcher */}
            <div
              data-dock-mode-switcher="true"
              data-dock-mode-switcher-disabled={isPairedModeActive ? 'true' : 'false'}
              className="shrink-0 h-full px-1.5 rounded-2xl bg-[#0d1118]/62 backdrop-blur-sm border border-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.34)] flex items-center gap-1.5"
            >
              <button
                type="button"
                data-dock-tab-bag="true"
                disabled={isPairedModeActive}
                aria-disabled={isPairedModeActive}
                onClick={() => handleSelectCategory('bag')}
                title={isPairedModeActive ? 'Disabled during Paired Mode' : 'Bag Quick Items'}
                aria-label="Bag Quick Items"
                aria-pressed={!isPairedModeActive && !showTargetInteractionBar && dockCategory === 'bag'}
                className={`relative w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                  isPairedModeActive
                    ? 'bg-white/[0.06] border border-white/10 text-white/30 opacity-45 saturate-0 cursor-not-allowed'
                    : !showTargetInteractionBar && dockCategory === 'bag'
                      ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white ring-1 ring-white/70 shadow-[0_3px_10px_rgba(16,185,129,0.48)] cursor-pointer active:scale-95'
                      : 'bg-emerald-500/22 hover:bg-emerald-500/38 border border-emerald-400/40 text-emerald-300 hover:text-emerald-100 cursor-pointer active:scale-95'
                }`}
              >
                <Backpack className="w-3.5 h-3.5 stroke-[2.2]" aria-hidden="true" />
                {isFishingRodEquipped && !isPairedModeActive && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-lime-300 border border-[#0d1118]" />
                )}
              </button>

              <button
                type="button"
                data-dock-tab-scooter="true"
                disabled={isPairedModeActive}
                aria-disabled={isPairedModeActive}
                onClick={() => handleSelectCategory('scooter')}
                title={isPairedModeActive ? 'Disabled during Paired Mode' : 'Scooters & Rides'}
                aria-label="Scooters & Rides"
                aria-pressed={!isPairedModeActive && !showTargetInteractionBar && dockCategory === 'scooter'}
                className={`relative w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                  isPairedModeActive
                    ? 'bg-white/[0.06] border border-white/10 text-white/30 opacity-45 saturate-0 cursor-not-allowed'
                    : !showTargetInteractionBar && dockCategory === 'scooter'
                      ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white ring-1 ring-white/70 shadow-[0_3px_10px_rgba(245,158,11,0.48)] cursor-pointer active:scale-95'
                      : 'bg-amber-500/22 hover:bg-amber-500/38 border border-amber-400/40 text-amber-300 hover:text-amber-100 cursor-pointer active:scale-95'
                }`}
              >
                <Bike className="w-3.5 h-3.5 stroke-[2.2]" aria-hidden="true" />
                {equippedScooterKind && !isPairedModeActive && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-lime-300 border border-[#0d1118]" />
                )}
              </button>
            </div>
          </div>

          {/* BOTTOM TIER: Constant-Width (w-full = 252px) Color-Coded Icon-Only Quick Bar */}
          {showTargetInteractionBar && targetEntity ? (
            <div
              data-dock-target-interaction-bar="true"
              className="w-full h-[52px] px-2.5 rounded-2xl bg-[#0d1118]/74 backdrop-blur-sm border border-sky-300/35 shadow-[0_10px_30px_rgba(0,0,0,0.48)] flex items-center justify-between gap-1.5"
            >
              <div className="flex items-center gap-2">
                {/* 1. View Profile (Sky-Blue Glossy Button) */}
                <button
                  type="button"
                  data-target-action="profile"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onOpenTargetProfile?.(targetEntity);
                  }}
                  title={`View ${displayName} Profile`}
                  aria-label={`View ${displayName} Profile`}
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 hover:brightness-110 border border-sky-200/50 text-white shadow-[0_4px_12px_rgba(56,189,248,0.4)] flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                >
                  <User className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />
                </button>

                {/* 2. Whisper / Talk (Emerald Glossy Button) */}
                <button
                  type="button"
                  data-target-action="whisper"
                  onClick={handleWhisperOrTalk}
                  title={
                    targetIsRealPlayer
                      ? `Whisper ${displayName}`
                      : `Talk to ${displayName}`
                  }
                  aria-label={
                    targetIsRealPlayer
                      ? `Whisper ${displayName}`
                      : `Talk to ${displayName}`
                  }
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 hover:brightness-110 border border-emerald-200/50 text-white shadow-[0_4px_12px_rgba(16,185,129,0.4)] flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />
                </button>

                {/* 3. Send Gift (Pink-Rose Glossy Button) */}
                <button
                  type="button"
                  data-target-action="gift"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onGiftTarget?.(targetEntity);
                  }}
                  title={`Send Gift to ${displayName}`}
                  aria-label={`Send Gift to ${displayName}`}
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-rose-600 hover:brightness-110 border border-pink-200/50 text-white shadow-[0_4px_12px_rgba(244,63,94,0.4)] flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                >
                  <Gift className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />
                </button>

                {/* 4. Paired Pose / Interact (Violet Glossy Button, when owned) */}
                {hasOwnedPairedAnimations && onInteractTarget && (
                  <button
                    type="button"
                    data-target-action="paired"
                    onClick={() => {
                      soundEngine.playUiClick();
                      onInteractTarget(targetEntity);
                    }}
                    title={`Paired Interact with ${displayName}`}
                    aria-label={`Paired Interact with ${displayName}`}
                    className="w-9 h-9 rounded-full bg-gradient-to-br from-fuchsia-400 to-purple-600 hover:brightness-110 border border-fuchsia-200/50 text-white shadow-[0_4px_12px_rgba(192,38,211,0.4)] flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                  >
                    <HeartHandshake className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* Return to Quick Items */}
              <div className="pl-2 border-l border-white/12 flex items-center">
                <button
                  type="button"
                  data-target-action="close"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onToggleTargetInteraction?.();
                  }}
                  title="Back to Quick Items"
                  aria-label="Back to Quick Items"
                  className="w-8 h-8 rounded-full bg-rose-500/25 hover:bg-rose-500/45 border border-rose-300/45 text-rose-200 hover:text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5 stroke-[2.3]" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : dockCategory === 'scooter' ? (
            <div
              data-dock-scooter-bar="true"
              className="w-full h-[52px] px-2.5 rounded-2xl bg-[#0d1118]/64 backdrop-blur-sm border border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.44)] flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                {URBAN_SCOOTER_CATALOG_ITEMS.map((scooter) => {
                  const isOwned = ownedScooterIds.includes(scooter.id);
                  const isRiding = equippedScooterKind === scooter.kind;
                  const isElectric = scooter.kind === 'electric_scooter_bike';
                  return (
                    <button
                      key={scooter.id}
                      type="button"
                      data-dock-quick-scooter={scooter.kind}
                      onClick={() => {
                        soundEngine.playUiClick();
                        if (isOwned) {
                          if (isRiding || canMountScooterOutdoors) {
                            onToggleScooterKind(scooter.kind);
                          } else {
                            onOpenScooterShowroom();
                          }
                        } else {
                          onOpenScooterShowroom();
                        }
                      }}
                      title={
                        isRiding
                          ? `Dismount ${scooter.name}`
                          : isOwned
                            ? canMountScooterOutdoors
                              ? `Ride ${scooter.name}`
                              : `${scooter.name} (Step outside to ride)`
                            : `${scooter.name} (View in Showroom)`
                      }
                      aria-label={scooter.name}
                      className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                        isRiding
                          ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white ring-2 ring-white shadow-[0_4px_14px_rgba(16,185,129,0.55)]'
                          : isOwned
                            ? isElectric
                              ? 'bg-gradient-to-br from-amber-400 to-orange-600 hover:brightness-110 border border-amber-200/50 text-white shadow-[0_4px_12px_rgba(245,158,11,0.4)]'
                              : 'bg-gradient-to-br from-violet-400 to-indigo-600 hover:brightness-110 border border-violet-200/50 text-white shadow-[0_4px_12px_rgba(139,92,246,0.4)]'
                            : isElectric
                              ? 'bg-amber-500/20 hover:bg-amber-500/35 border border-amber-300/35 text-amber-200/75 hover:text-amber-100'
                              : 'bg-violet-500/20 hover:bg-violet-500/35 border border-violet-300/35 text-violet-200/75 hover:text-violet-100'
                      }`}
                    >
                      {isElectric ? (
                        <Bike className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />
                      ) : (
                        <Zap className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />
                      )}
                      {!isOwned && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#0d1118] border border-white/30 flex items-center justify-center">
                          <Lock className="w-2 h-2 text-amber-200" aria-hidden="true" />
                        </span>
                      )}
                    </button>
                  );
                })}

                {equippedScooterKind && (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      onToggleScooterKind(equippedScooterKind);
                    }}
                    title="Dismount Scooter"
                    aria-label="Dismount Scooter"
                    className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-500 to-red-600 hover:brightness-110 border border-rose-200/50 text-white shadow-[0_4px_12px_rgba(244,63,94,0.45)] flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* Open Scooter Showroom Shortcut (Rose-Pink Glossy Button) */}
              <div className="pl-2 border-l border-white/12 flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onOpenScooterShowroom();
                  }}
                  title="Open Scooters Showroom"
                  aria-label="Open Scooters Showroom"
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-400 to-pink-600 hover:brightness-110 border border-rose-200/50 text-white shadow-[0_4px_12px_rgba(244,63,94,0.4)] flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                >
                  <Store className="w-4 h-4 stroke-[2.1]" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : (
            <div
              data-dock-bag-bar="true"
              className="w-full h-[52px] px-2.5 rounded-2xl bg-[#0d1118]/64 backdrop-blur-sm border border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.44)] flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                {/* 1. Quick Bag Item: Fishing Rod (Cyan-Sky Glossy Button) */}
                <button
                  type="button"
                  data-dock-quick-fishing-rod="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onToggleFishingRod();
                  }}
                  title={isFishingRodEquipped ? 'Unequip Fishing Rod' : 'Equip Fishing Rod'}
                  aria-label={isFishingRodEquipped ? 'Unequip Fishing Rod' : 'Equip Fishing Rod'}
                  aria-pressed={isFishingRodEquipped}
                  className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                    isFishingRodEquipped
                      ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white ring-2 ring-white shadow-[0_4px_14px_rgba(16,185,129,0.55)]'
                      : 'bg-gradient-to-br from-sky-400 to-blue-600 hover:brightness-110 border border-sky-200/50 text-white shadow-[0_4px_12px_rgba(56,189,248,0.42)]'
                  }`}
                >
                  <Fish className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />
                  {isFishingRodEquipped && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-lime-300 border-2 border-[#0d1118]" />
                  )}
                </button>
              </div>

              {/* 2. Open Full Personal Bag Shortcut (Emerald-Teal Glossy Button) */}
              <div className="pl-2 border-l border-white/12 flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onOpenBag();
                  }}
                  title="Open Personal Bag"
                  aria-label="Open Personal Bag"
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 hover:brightness-110 border border-emerald-200/50 text-white shadow-[0_4px_12px_rgba(16,185,129,0.42)] flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                >
                  <Backpack className="w-4 h-4 stroke-[2.1]" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
