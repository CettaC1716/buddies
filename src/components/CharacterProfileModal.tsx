import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Copy,
  Edit3,
  Fish,
  Home,
  MessageCircle,
  Shield,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react';
import { NearbyEntityUser } from './SocialChatModal';
import { soundEngine } from '../game/audio';

export interface PhotoPresetOption {
  id: string;
  label: string;
  url: string;
  cropClassName: string;
}

export const PROFILE_PHOTO_PRESETS: PhotoPresetOption[] = [
  {
    id: 'hiro',
    label: 'HIRO',
    url: '/assets/avatar_hiro.jpg',
    // Scaled from left-center origin so top-right Blender viewport text is pushed outside the right edge while keeping full head & torso framed
    cropClassName: 'object-cover object-[48%_14%] scale-[1.34] origin-[24%_45%]',
  },
  {
    id: 'nadia',
    label: 'NADIA',
    url: '/assets/avatar_nadia.jpg',
    cropClassName: 'object-cover object-[50%_14%] scale-[1.24] origin-[50%_35%]',
  },
  {
    id: 'rookie',
    label: 'HANA',
    url: '/assets/kiosk/family_member_female.jpg',
    cropClassName: 'object-cover object-top scale-105',
  },
  {
    id: 'shinobi',
    label: 'KAI',
    url: '/assets/kiosk/family_member_male.jpg',
    cropClassName: 'object-cover object-top scale-105',
  },
  {
    id: 'veteran',
    label: 'COASTAL PIER',
    url: '/docs/hero-1-beach-pier.jpg',
    cropClassName: 'object-cover object-center',
  },
  {
    id: 'hq',
    label: 'COMMAND HQ',
    url: '/assets/kiosk/hq_super_command.webp',
    cropClassName: 'object-cover object-center',
  },
];

const STATUS_PHOTO_STORAGE_KEY = 'bb_player_status_photo_v1';
const AVATAR_PHOTO_STORAGE_KEY = 'bb_player_avatar_photo_v1';
const STATUS_CAPTION_STORAGE_KEY = 'bb_player_status_caption_v1';

export function getPhotoCropClassName(url: string): string {
  if (!url) return 'object-cover object-center';
  const preset = PROFILE_PHOTO_PRESETS.find((p) => p.url === url);
  if (preset) return preset.cropClassName;
  if (url.includes('avatar_hiro')) {
    return 'object-cover object-[48%_14%] scale-[1.34] origin-[24%_45%]';
  }
  if (url.includes('avatar_nadia')) {
    return 'object-cover object-[50%_14%] scale-[1.24] origin-[50%_35%]';
  }
  return 'object-cover object-center';
}

export interface CharacterProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: NearbyEntityUser | null;
  playerUid?: string | null;
  connectedAccountEmail?: string;
  characterGender?: 'male' | 'female';
  playerTeam?: 'blue' | 'red';
  claimedPlotIndex?: number | null;
  hasHouseOwnership?: boolean;
  caughtFishCount?: number;
  mintedFishNftCount?: number;
  recruitedFamilyCount?: number;
  activeHarvesterCount?: number;
  playerLevel?: number;
  playerXpLabel?: string;
  lulBalance?: number;
  onChangePlayerName?: (newName: string) => void;
  onStartWhisper?: (user: NearbyEntityUser) => void;
  embeddedInPhone?: boolean;
}

export const CharacterProfileModal: React.FC<CharacterProfileModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  playerUid,
  connectedAccountEmail,
  characterGender = 'male',
  playerTeam = 'blue',
  claimedPlotIndex = null,
  hasHouseOwnership = false,
  caughtFishCount = 0,
  mintedFishNftCount = 0,
  recruitedFamilyCount = 0,
  activeHarvesterCount = 0,
  playerLevel = 1,
  playerXpLabel,
  lulBalance = 0,
  onChangePlayerName,
  onStartWhisper,
  embeddedInPhone = false,
}) => {
  const defaultPhotoUrl =
    characterGender === 'female' ? '/assets/avatar_nadia.jpg' : '/assets/avatar_hiro.jpg';

  const [customStatusPhotoUrl, setCustomStatusPhotoUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        return window.localStorage.getItem(STATUS_PHOTO_STORAGE_KEY) || '';
      } catch {
        return '';
      }
    }
    return '';
  });

  const [customAvatarPhotoUrl, setCustomAvatarPhotoUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        return window.localStorage.getItem(AVATAR_PHOTO_STORAGE_KEY) || '';
      } catch {
        return '';
      }
    }
    return '';
  });

  const [statusCaption, setStatusCaption] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem(STATUS_CAPTION_STORAGE_KEY);
        if (saved !== null) return saved;
      } catch {
        // ignore
      }
    }
    return 'Exploring The City & Warzone Arena';
  });

  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [draftPlayerName, setDraftPlayerName] = useState<string>('');
  const [isEditingCaption, setIsEditingCaption] = useState<boolean>(false);
  const [draftCaption, setDraftCaption] = useState<string>(statusCaption);
  const [activePhotoPicker, setActivePhotoPicker] = useState<'none' | 'status' | 'avatar'>('none');
  const [copiedUid, setCopiedUid] = useState<boolean>(false);

  const statusFileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  const cleanTargetName = (targetUser?.name || 'CITIZEN')
    .replace(/\s*\((ANDA|YOU|KAMU)\)/gi, '')
    .trim();

  useEffect(() => {
    if (targetUser) {
      setDraftPlayerName(
        targetUser.name.replace(/\s*\((ANDA|YOU|KAMU)\)/gi, '').trim(),
      );
      setIsEditingName(false);
      setIsEditingCaption(false);
      setActivePhotoPicker('none');
    }
  }, [targetUser, isOpen]);

  const isSelfProfile = Boolean(
    targetUser &&
      (targetUser.isSelf ||
        String(targetUser.id) === '0' ||
        targetUser.name.toUpperCase().includes('(YOU)') ||
        targetUser.name.toUpperCase().includes('(ANDA)')),
  );

  const isNpcProfile = Boolean(
    targetUser &&
      (targetUser.isNpc || String(targetUser.id).toLowerCase().startsWith('npc_')),
  );

  const effectiveTeam: 'blue' | 'red' = isSelfProfile
    ? playerTeam
    : targetUser?.team === 'red'
      ? 'red'
      : 'blue';

  const effectiveGenderLabel = isSelfProfile
    ? characterGender === 'female'
      ? 'FEMALE'
      : 'MALE'
    : cleanTargetName.toLowerCase().includes('hana') ||
        cleanTargetName.toLowerCase().includes('nadia')
      ? 'FEMALE'
      : 'MALE';

  const resolvedStatusPhotoUrl = isSelfProfile
    ? customStatusPhotoUrl || defaultPhotoUrl
    : cleanTargetName.toLowerCase().includes('hana') ||
        cleanTargetName.toLowerCase().includes('nadia')
      ? '/assets/avatar_nadia.jpg'
      : '/assets/avatar_hiro.jpg';

  const resolvedAvatarPhotoUrl = isSelfProfile
    ? customAvatarPhotoUrl || defaultPhotoUrl
    : cleanTargetName.toLowerCase().includes('hana') ||
        cleanTargetName.toLowerCase().includes('nadia')
      ? '/assets/avatar_nadia.jpg'
      : '/assets/avatar_hiro.jpg';

  const handleSelectPhotoUrl = (target: 'status' | 'avatar', url: string) => {
    soundEngine.playUiClick();
    if (target === 'status') {
      setCustomStatusPhotoUrl(url);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(STATUS_PHOTO_STORAGE_KEY, url);
        } catch {
          // ignore
        }
      }
    } else {
      setCustomAvatarPhotoUrl(url);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(AVATAR_PHOTO_STORAGE_KEY, url);
        } catch {
          // ignore
        }
      }
    }
    setActivePhotoPicker('none');
  };

  const handleUploadPhotoFile = (
    target: 'status' | 'avatar',
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleSelectPhotoUrl(target, reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveUsername = () => {
    soundEngine.playUiClick();
    const cleaned = draftPlayerName.trim().slice(0, 24);
    if (cleaned && onChangePlayerName) {
      onChangePlayerName(cleaned);
    }
    setIsEditingName(false);
  };

  const handleSaveCaption = () => {
    soundEngine.playUiClick();
    const cleaned = draftCaption.trim().slice(0, 80);
    setStatusCaption(cleaned);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STATUS_CAPTION_STORAGE_KEY, cleaned);
      } catch {
        // ignore
      }
    }
    setIsEditingCaption(false);
  };

  const handleCopyAccountId = () => {
    if (!playerUid) return;
    soundEngine.playUiClick();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(playerUid);
    }
    setCopiedUid(true);
    window.setTimeout(() => setCopiedUid(false), 1800);
  };

  const plotSummaryLabel =
    claimedPlotIndex !== null && claimedPlotIndex !== undefined
      ? `PLOT #${claimedPlotIndex} (${effectiveTeam.toUpperCase()})`
      : hasHouseOwnership
        ? 'PRIVATE HOUSE OWNED'
        : 'NO PLOT CLAIMED';

  if (embeddedInPhone && (!isOpen || !targetUser)) {
    return null;
  }

  const innerContent = (
    <div
      className={
        embeddedInPhone
          ? 'relative w-full h-full bg-[#edf0f5] p-3 text-slate-900 flex flex-col overflow-hidden'
          : 'relative rounded-[24px] bg-[#e8ecf2]/94 backdrop-blur-2xl border border-white/80 shadow-[0_24px_64px_rgba(15,23,42,0.28)] p-4 sm:p-5 text-slate-900 flex flex-col max-h-full overflow-hidden'
      }
    >
      {/* Hidden File Inputs for Custom Photo Uploads */}
      <input
        ref={statusFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleUploadPhotoFile('status', e)}
      />
      <input
        ref={avatarFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleUploadPhotoFile('avatar', e)}
      />

      {/* TOP HEADER BAR */}
      <div
        className={`flex items-center justify-between gap-2 border-b border-slate-300/60 shrink-0 ${
          embeddedInPhone ? 'pb-2.5' : 'pb-3'
        }`}
      >
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 border border-slate-200/80 shadow-xs text-[11.5px] font-semibold text-slate-800">
            <User className="w-3.5 h-3.5 text-sky-500 stroke-[2.2]" aria-hidden="true" />
            <span>{isSelfProfile ? 'Citizen Profile' : 'Player Profile'}</span>
          </div>

          <div
            className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10.5px] font-semibold ${
              isNpcProfile
                ? 'bg-amber-100/90 text-amber-800 border-amber-200/80'
                : effectiveTeam === 'red'
                  ? 'bg-rose-100/90 text-rose-700 border-rose-200/80'
                  : 'bg-sky-100/90 text-sky-700 border-sky-200/80'
            }`}
          >
            <span>
              {isNpcProfile
                ? 'Merchant NPC'
                : `${effectiveTeam === 'red' ? 'Red' : 'Blue'} Team`}
            </span>
          </div>

          {isSelfProfile && (
            <div
              data-profile-level-badge="true"
              className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100/90 text-emerald-800 border border-emerald-200/80 text-[10.5px] font-semibold"
            >
              <span>
                Lv {playerLevel}
                {playerXpLabel ? ` · ${playerXpLabel}` : ''}
              </span>
            </div>
          )}
        </div>

        {!embeddedInPhone && (
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            aria-label="Close Profile"
            data-profile-close-btn="true"
            className="w-8 h-8 rounded-full bg-white/90 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200/80 shadow-xs flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
          >
            <X className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* SCROLLABLE BODY */}
      <div
        className={`flex-1 overflow-y-auto overflow-x-hidden pr-0.5 min-h-0 ${
          embeddedInPhone ? 'mt-2.5 space-y-2.5' : 'mt-3 space-y-3'
        }`}
      >
        {/* 1. FEATURED STATUS PHOTO + CIRCULAR PROFILE AVATAR HEADER */}
        <div
          className={`rounded-2xl bg-white/95 border border-slate-200/70 shadow-sm ${
            embeddedInPhone ? 'p-3 space-y-2.5' : 'p-3.5 space-y-3'
          }`}
        >
          {/* Large Featured Square/Showcase Status Photo Frame */}
          <div
            data-profile-status-photo-frame="true"
            className={`relative w-full rounded-xl bg-slate-900 border border-slate-200/70 shadow-xs overflow-hidden ${
              embeddedInPhone ? 'h-[124px]' : 'h-[138px]'
            }`}
          >
            <img
              src={resolvedStatusPhotoUrl}
              alt={`${cleanTargetName} Status Showcase`}
              draggable={false}
              className={`w-full h-full select-none ${getPhotoCropClassName(resolvedStatusPhotoUrl)}`}
            />

            {/* Top-left Status Photo Label */}
            <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-slate-900/65 backdrop-blur-md text-white/95 border border-white/20 text-[10px] font-medium tracking-wide">
              <span>Status photo</span>
            </div>

            {/* Top-right Customize Status Photo Button (Self Only) */}
            {isSelfProfile && (
              <button
                type="button"
                data-edit-status-photo-btn="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  setActivePhotoPicker((prev) => (prev === 'status' ? 'none' : 'status'));
                }}
                className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-white/90 hover:bg-white text-slate-800 backdrop-blur-md border border-white/80 shadow-sm text-[10px] font-semibold cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-1">
                  <Camera className="w-3 h-3 text-sky-500 stroke-[2.2]" aria-hidden="true" />
                  <span>Change status photo</span>
                </span>
              </button>
            )}

            {/* Bottom Status Caption Bar */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/85 via-slate-900/65 to-transparent px-3 py-2 flex items-center justify-between gap-2">
              {isSelfProfile && isEditingCaption ? (
                <div className="flex items-center gap-1.5 w-full">
                  <input
                    type="text"
                    value={draftCaption}
                    maxLength={80}
                    onChange={(e) => setDraftCaption(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveCaption();
                      }
                    }}
                    placeholder="Enter short status..."
                    className="flex-1 min-w-0 rounded-full bg-white/95 text-slate-900 px-3 py-1 text-[11px] font-medium border border-white/80 shadow-xs focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                  <button
                    type="button"
                    onClick={handleSaveCaption}
                    className="px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-semibold cursor-pointer shadow-xs transition-colors shrink-0"
                  >
                    <span>Save</span>
                  </button>
                </div>
              ) : (
                <>
                  <div
                    data-profile-status-caption="true"
                    className="text-[11.5px] font-medium text-white truncate drop-shadow-xs"
                  >
                    {isSelfProfile
                      ? statusCaption || 'Online in Buddies Blitz'
                      : isNpcProfile
                        ? 'Official Exchange & Supply Merchant in The City'
                        : targetUser?.status || 'Online in Buddies Blitz'}
                  </div>
                  {isSelfProfile && (
                    <button
                      type="button"
                      data-edit-status-caption-btn="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setDraftCaption(statusCaption);
                        setIsEditingCaption(true);
                      }}
                      className="px-2 py-0.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-[10px] font-medium shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Edit3 className="w-2.5 h-2.5 stroke-[2.2]" aria-hidden="true" />
                      <span>Edit status</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Circular Profile Picture Avatar + Player Identity Row */}
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div
                data-profile-circular-avatar="true"
                className={`rounded-full p-[2.5px] shadow-md ${
                  embeddedInPhone ? 'w-14 h-14' : 'w-16 h-16'
                } ${
                  isNpcProfile
                    ? 'bg-gradient-to-tr from-amber-300 to-yellow-400'
                    : effectiveTeam === 'red'
                      ? 'bg-gradient-to-tr from-rose-400 to-pink-300'
                      : 'bg-gradient-to-tr from-sky-400 to-teal-300'
                }`}
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-slate-100 ring-2 ring-white">
                  <img
                    src={resolvedAvatarPhotoUrl}
                    alt={`${cleanTargetName} Avatar`}
                    draggable={false}
                    className={`w-full h-full select-none ${getPhotoCropClassName(resolvedAvatarPhotoUrl)}`}
                  />
                </div>
              </div>
              {isSelfProfile && (
                <button
                  type="button"
                  data-edit-avatar-photo-btn="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setActivePhotoPicker((prev) => (prev === 'avatar' ? 'none' : 'avatar'));
                  }}
                  title="Change Circular Profile Avatar"
                  className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-sky-500 hover:bg-sky-600 text-white border-2 border-white shadow-sm flex items-center justify-center cursor-pointer transition-colors"
                >
                  <Camera className="w-3 h-3 stroke-[2.2]" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100 shrink-0" />
                <span className="text-[11px] font-medium text-slate-500">
                  {isSelfProfile ? 'Active citizen' : isNpcProfile ? 'Merchant NPC' : 'Online player'}
                </span>
              </div>

              {isSelfProfile && onChangePlayerName && isEditingName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={draftPlayerName}
                    maxLength={24}
                    onChange={(e) => setDraftPlayerName(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveUsername();
                      }
                    }}
                    className="flex-1 min-w-0 px-3 py-1 rounded-xl bg-slate-50 text-slate-900 font-semibold text-xs border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleSaveUsername}
                    className="px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-[11px] shadow-xs cursor-pointer shrink-0 transition-colors"
                  >
                    <span>Save</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <h2
                    data-profile-display-name="true"
                    className={`font-bold tracking-tight text-slate-900 truncate ${
                      embeddedInPhone ? 'text-base' : 'text-base sm:text-lg'
                    }`}
                  >
                    {cleanTargetName}
                  </h2>
                  {isSelfProfile && onChangePlayerName && (
                    <button
                      type="button"
                      data-profile-edit-username-btn="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setDraftPlayerName(cleanTargetName);
                        setIsEditingName(true);
                      }}
                      className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200/80 text-[10.5px] font-semibold cursor-pointer shrink-0 transition-colors"
                    >
                      <span className="flex items-center gap-1">
                        <Edit3 className="w-3 h-3 stroke-[2.2]" aria-hidden="true" />
                        <span>Rename</span>
                      </span>
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/70 text-[10px] font-medium">
                  Gender: {effectiveGenderLabel === 'FEMALE' ? 'Female' : 'Male'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/70 text-[10px] font-medium">
                  Team: {effectiveTeam === 'red' ? 'Red' : 'Blue'}
                </span>
                {isSelfProfile && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-[10px] font-semibold font-mono">
                    LUL: {lulBalance.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* INLINE PHOTO PICKER DRAWER (When Changing Status Photo or Circular Avatar) */}
          {isSelfProfile && activePhotoPicker !== 'none' && (
            <div
              data-profile-photo-picker={activePhotoPicker}
              className="p-3 rounded-2xl bg-slate-50/95 border border-slate-200/80 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-700 truncate">
                  {activePhotoPicker === 'status'
                    ? 'Select featured status photo'
                    : 'Select circular profile avatar'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    if (activePhotoPicker === 'status') {
                      statusFileInputRef.current?.click();
                    } else {
                      avatarFileInputRef.current?.click();
                    }
                  }}
                  className="px-2.5 py-1 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-xs text-[10px] font-semibold cursor-pointer shrink-0 transition-colors"
                >
                  <span className="flex items-center gap-1">
                    <Upload className="w-3 h-3 stroke-[2.2]" aria-hidden="true" />
                    <span>Upload image</span>
                  </span>
                </button>
              </div>

              <div
                className={`grid gap-2 ${
                  embeddedInPhone ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-6'
                }`}
              >
                {PROFILE_PHOTO_PRESETS.map((preset) => {
                  const currentUrl =
                    activePhotoPicker === 'status'
                      ? resolvedStatusPhotoUrl
                      : resolvedAvatarPhotoUrl;
                  const isSelected = currentUrl === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPhotoUrl(activePhotoPicker, preset.url)}
                      className={`p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col items-center gap-1 min-w-0 ${
                        isSelected
                          ? 'bg-sky-50 text-sky-900 border-sky-400 ring-2 ring-sky-200 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200/80 hover:border-sky-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="w-full h-9 rounded-lg overflow-hidden bg-slate-100">
                        <img
                          src={preset.url}
                          alt={preset.label}
                          className={`w-full h-full ${preset.cropClassName}`}
                        />
                      </div>
                      <span className="text-[9px] font-semibold truncate w-full text-center">
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 2. ACCOUNT & WALLET IDENTITY DETAILS */}
        <div
          className={`rounded-2xl bg-white/95 border border-slate-200/70 shadow-sm space-y-2.5 ${
            embeddedInPhone ? 'p-3' : 'p-3.5'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-slate-500">
                {isSelfProfile ? 'Account session' : 'Citizen identity'}
              </div>
              <div className="text-xs font-semibold text-slate-900 truncate mt-0.5">
                {isSelfProfile
                  ? connectedAccountEmail || (playerUid ? 'Connected Citizen Account' : 'Guest Session')
                  : isNpcProfile
                    ? 'System Autonomous Merchant'
                    : cleanTargetName}
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-sky-50 border border-sky-200/80 text-[10px] font-semibold text-sky-700 shrink-0">
              {isSelfProfile
                ? playerUid
                  ? 'Registered'
                  : 'Guest mode'
                : isNpcProfile
                  ? 'Official NPC'
                  : 'Live peer'}
            </span>
          </div>

          {isSelfProfile && (
            <div className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/70 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-emerald-700">
                  NEAR wallet ID
                </div>
                <div
                  data-profile-wallet-id="true"
                  className="text-[11px] font-mono font-medium text-slate-700 break-all mt-0.5"
                >
                  {playerUid || 'Not registered yet (Guest Session)'}
                </div>
              </div>
              {playerUid && (
                <button
                  type="button"
                  onClick={handleCopyAccountId}
                  className="px-3 py-1 rounded-full bg-sky-500 hover:bg-sky-600 text-white font-semibold text-[10.5px] shadow-xs cursor-pointer shrink-0 transition-colors"
                >
                  <span className="flex items-center gap-1">
                    {copiedUid ? (
                      <>
                        <Check className="w-3 h-3 stroke-[2.2]" aria-hidden="true" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 stroke-[2.2]" aria-hidden="true" />
                        <span>Copy</span>
                      </>
                    )}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* 3. REAL IN-GAME ASSET SUMMARY (FOR SELF PROFILE) */}
        {isSelfProfile && (
          <div
            className={`rounded-2xl bg-white/95 border border-slate-200/70 shadow-sm space-y-2 ${
              embeddedInPhone ? 'p-3' : 'p-3.5'
            }`}
          >
            <div className="text-[11px] font-semibold text-slate-600">
              In-game citizen assets
            </div>

            <div className={`grid grid-cols-3 ${embeddedInPhone ? 'gap-1.5' : 'gap-2'}`}>
              {/* Command Plot / House Ownership */}
              <div
                data-profile-asset-plot="true"
                className="min-w-0 p-2 rounded-xl bg-slate-50/90 border border-slate-200/70 flex flex-col justify-between gap-1.5"
              >
                <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 min-w-0">
                  <Home className="w-3 h-3 text-sky-500 stroke-[2.2] shrink-0" aria-hidden="true" />
                  <span className="truncate">Estate / Plot</span>
                </div>
                <div className="text-[10.5px] font-semibold text-slate-900 leading-tight break-words">
                  {plotSummaryLabel}
                </div>
              </div>

              {/* Caught Fish & Minted Fish NFTs */}
              <div
                data-profile-asset-fish="true"
                className="min-w-0 p-2 rounded-xl bg-slate-50/90 border border-slate-200/70 flex flex-col justify-between gap-1.5"
              >
                <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 min-w-0">
                  <Fish className="w-3 h-3 text-teal-500 stroke-[2.2] shrink-0" aria-hidden="true" />
                  <span className="truncate">Fish &amp; NFTs</span>
                </div>
                <div className="text-[10.5px] font-semibold text-slate-900 leading-tight break-words">
                  {caughtFishCount} Caught · {mintedFishNftCount} NFT
                </div>
              </div>

              {/* Recruited Family & Active Harvesters */}
              <div
                data-profile-asset-units="true"
                className="min-w-0 p-2 rounded-xl bg-slate-50/90 border border-slate-200/70 flex flex-col justify-between gap-1.5"
              >
                <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 min-w-0">
                  <Users className="w-3 h-3 text-indigo-500 stroke-[2.2] shrink-0" aria-hidden="true" />
                  <span className="truncate">Active units</span>
                </div>
                <div className="text-[10.5px] font-semibold text-slate-900 leading-tight break-words">
                  {recruitedFamilyCount} Family · {activeHarvesterCount} Harvester
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. REMOTE REAL PLAYER WHISPER ACTION (Hidden for Self and NPCs) */}
        {!isSelfProfile && !isNpcProfile && targetUser && onStartWhisper && (
          <button
            type="button"
            data-profile-whisper-btn="true"
            onClick={() => {
              soundEngine.playUiClick();
              onStartWhisper(targetUser);
            }}
            className="w-full py-2.5 px-4 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-sm font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition-all"
          >
            <MessageCircle className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />
            <span>Send whisper message</span>
          </button>
        )}

        {/* 5. NPC MERCHANT NOTICE (When inspecting an NPC) */}
        {isNpcProfile && (
          <div className="p-3.5 rounded-2xl bg-amber-50/95 border border-amber-200/80 shadow-xs flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-amber-600 stroke-[2.2] shrink-0" aria-hidden="true" />
            <div className="text-[11.5px] font-medium text-amber-950 leading-snug">
              {cleanTargetName} is an official NPC merchant in The City. Interact using the{' '}
              <span className="font-semibold">TALK</span> action to open the exchange counter.
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (embeddedInPhone) {
    return (
      <div
        role="region"
        aria-label="Character Profile"
        data-character-profile-modal="true"
        className="w-full h-full flex flex-col overflow-hidden select-none"
      >
        {innerContent}
      </div>
    );
  }

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-hidden={!isOpen || !targetUser}
      inert={(!isOpen || !targetUser) || undefined}
      aria-label="Character Profile"
      data-character-profile-modal="true"
      className={`fixed left-4 top-16 bottom-20 z-40 w-full max-w-lg flex flex-col select-none transition-all duration-300 ease-out transform ${
        isOpen && targetUser
          ? 'translate-x-0 opacity-100 visible pointer-events-auto'
          : '-translate-x-[120%] opacity-0 invisible pointer-events-none'
      }`}
    >
      {innerContent}
    </aside>
  );
};
