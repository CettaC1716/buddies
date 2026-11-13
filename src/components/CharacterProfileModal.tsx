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
    url: '/assets/kiosk/hq_super_command.png',
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
  onChangePlayerName?: (newName: string) => void;
  onStartWhisper?: (user: NearbyEntityUser) => void;
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
  onChangePlayerName,
  onStartWhisper,
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
      <div className="relative bg-white border-[3.5px] border-black shadow-[4px_4px_0px_#000] p-4 sm:p-5 text-black flex flex-col max-h-full overflow-hidden">
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

        {/* TOP HEADER BAR (Matches SocialChatModal & PersonalWalletModal) */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b-[2.5px] border-black shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="-skew-x-6 inline-block px-3 py-1 bg-[#38bdf8] border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-black uppercase tracking-wider text-black">
              <span className="skew-x-6 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                <span>{isSelfProfile ? 'CITIZEN PROFILE' : 'PLAYER PROFILE'}</span>
              </span>
            </div>

            <div
              className={`-skew-x-6 inline-block px-2.5 py-1 border-2 border-black shadow-[2px_2px_0px_#000] text-[10px] font-black uppercase tracking-wider ${
                isNpcProfile
                  ? 'bg-[#facc15] text-black'
                  : effectiveTeam === 'red'
                    ? 'bg-[#ff3b30] text-white'
                    : 'bg-[#00d2ff] text-black'
              }`}
            >
              <span className="skew-x-6 inline-block">
                {isNpcProfile ? 'MERCHANT NPC' : `${effectiveTeam.toUpperCase()} TEAM`}
              </span>
            </div>

            {isSelfProfile && (
              <div
                data-profile-level-badge="true"
                className="-skew-x-6 inline-block px-2.5 py-1 bg-[#b8ff3c] text-black border-2 border-black shadow-[2px_2px_0px_#000] text-[10px] font-black uppercase tracking-wider"
              >
                <span className="skew-x-6 inline-block">
                  LV {playerLevel}
                  {playerXpLabel ? ` · ${playerXpLabel}` : ''}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            aria-label="Close Profile"
            data-profile-close-btn="true"
            className="-skew-x-6 w-8 h-8 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black shadow-[3px_3px_0px_#000] font-black text-xs flex items-center justify-center cursor-pointer active:scale-95 shrink-0"
          >
            <span className="skew-x-6 inline-block">X</span>
          </button>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="mt-2 flex-1 overflow-y-auto pr-1 space-y-2 min-h-0">
          {/* 1. FEATURED STATUS PHOTO + CIRCULAR PROFILE AVATAR HEADER */}
          <div className="bg-[#f8fafc] border-[2.5px] border-black shadow-[3px_3px_0px_#000] p-2.5 space-y-2">
            {/* Large Featured Square/Showcase Status Photo Frame */}
            <div
              data-profile-status-photo-frame="true"
              className="relative w-full h-[132px] bg-[#1e293b] border-[2.5px] border-black shadow-[2px_2px_0px_#000] overflow-hidden"
            >
              <img
                src={resolvedStatusPhotoUrl}
                alt={`${cleanTargetName} Status Showcase`}
                draggable={false}
                className={`w-full h-full select-none ${getPhotoCropClassName(resolvedStatusPhotoUrl)}`}
              />

              {/* Top-left Status Photo Label */}
              <div className="absolute top-2 left-2 -skew-x-6 px-2 py-0.5 bg-black/85 text-white border border-white/30 text-[9px] font-black uppercase tracking-wider">
                <span className="skew-x-6 inline-block">STATUS PHOTO</span>
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
                  className="absolute top-2 right-2 -skew-x-6 px-2.5 py-0.5 bg-[#facc15] hover:bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000] text-[9.5px] font-black uppercase tracking-wider cursor-pointer"
                >
                  <span className="skew-x-6 flex items-center gap-1">
                    <Camera className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                    <span>CHANGE STATUS PHOTO</span>
                  </span>
                </button>
              )}

              {/* Bottom Status Caption Bar */}
              <div className="absolute bottom-0 inset-x-0 bg-black/85 border-t-2 border-black px-2.5 py-1 flex items-center justify-between gap-2">
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
                      className="flex-1 min-w-0 bg-white text-black px-2 py-0.5 text-[11px] font-bold border border-black focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveCaption}
                      className="-skew-x-6 px-2 py-0.5 bg-[#b8ff3c] text-black border border-black text-[9px] font-black uppercase cursor-pointer shrink-0"
                    >
                      <span className="skew-x-6 inline-block">SAVE</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      data-profile-status-caption="true"
                      className="text-[11px] font-bold text-white truncate"
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
                        className="text-[#facc15] hover:text-[#fde047] text-[9px] font-black uppercase tracking-wider shrink-0 flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-2.5 h-2.5 stroke-[2.5]" aria-hidden="true" />
                        <span>EDIT STATUS</span>
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
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-[3px] border-black shadow-[3px_3px_0px_#000] overflow-hidden bg-[#1e293b]"
                >
                  <img
                    src={resolvedAvatarPhotoUrl}
                    alt={`${cleanTargetName} Avatar`}
                    draggable={false}
                    className={`w-full h-full select-none ${getPhotoCropClassName(resolvedAvatarPhotoUrl)}`}
                  />
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
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#38bdf8] hover:bg-[#7dd3fc] text-black border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center cursor-pointer"
                  >
                    <Camera className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#10b981] border border-black shrink-0" />
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-600">
                    {isSelfProfile ? 'ACTIVE CITIZEN' : isNpcProfile ? 'MERCHANT NPC' : 'ONLINE PLAYER'}
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
                      className="flex-1 min-w-0 px-2.5 py-1 bg-white text-black font-black text-xs border-2 border-black focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveUsername}
                      className="-skew-x-6 px-2.5 py-1 bg-[#b8ff3c] hover:bg-[#a3e635] text-black font-black text-[10px] uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer shrink-0"
                    >
                      <span className="skew-x-6 inline-block">SAVE</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <h2
                      data-profile-display-name="true"
                      className="text-base sm:text-lg font-black uppercase tracking-tight text-black truncate"
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
                        className="-skew-x-6 px-2.5 py-0.5 bg-white hover:bg-[#facc15] text-black border-2 border-black shadow-[2px_2px_0px_#000] text-[9.5px] font-black uppercase cursor-pointer shrink-0"
                      >
                        <span className="skew-x-6 flex items-center gap-1">
                          <Edit3 className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                          <span>RENAME</span>
                        </span>
                      </button>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 bg-[#e2e8f0] border border-black text-[9.5px] font-black uppercase text-black">
                    GENDER: {effectiveGenderLabel}
                  </span>
                  <span className="px-2 py-0.5 bg-[#e2e8f0] border border-black text-[9.5px] font-black uppercase text-black">
                    TEAM: {effectiveTeam.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* INLINE PHOTO PICKER DRAWER (When Changing Status Photo or Circular Avatar) */}
            {isSelfProfile && activePhotoPicker !== 'none' && (
              <div
                data-profile-photo-picker={activePhotoPicker}
                className="p-2 bg-[#1e293b] text-white border-2 border-black shadow-[2px_2px_0px_#000] space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-[#facc15]">
                    {activePhotoPicker === 'status'
                      ? 'SELECT FEATURED STATUS PHOTO'
                      : 'SELECT CIRCULAR PROFILE AVATAR'}
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
                    className="-skew-x-6 px-2.5 py-0.5 bg-[#b8ff3c] hover:bg-[#a3e635] text-black border border-black text-[9px] font-black uppercase cursor-pointer shrink-0"
                  >
                    <span className="skew-x-6 flex items-center gap-1">
                      <Upload className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                      <span>UPLOAD IMAGE</span>
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
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
                        className={`p-1 border-2 transition-all cursor-pointer flex flex-col items-center gap-1 ${
                          isSelected
                            ? 'bg-[#facc15] text-black border-black shadow-[2px_2px_0px_#000]'
                            : 'bg-[#0f172a] text-white border-white/25 hover:border-white'
                        }`}
                      >
                        <div className="w-full h-9 overflow-hidden border border-black bg-slate-900">
                          <img
                            src={preset.url}
                            alt={preset.label}
                            className={`w-full h-full ${preset.cropClassName}`}
                          />
                        </div>
                        <span className="text-[8.5px] font-black uppercase truncate w-full text-center">
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
          <div className="p-2.5 bg-[#1e293b] text-white border-[2.5px] border-black shadow-[3px_3px_0px_#000] space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">
                  {isSelfProfile ? 'ACCOUNT SESSION' : 'CITIZEN IDENTITY'}
                </div>
                <div className="text-xs font-bold text-white truncate">
                  {isSelfProfile
                    ? connectedAccountEmail || (playerUid ? 'Connected Citizen Account' : 'Guest Session')
                    : isNpcProfile
                      ? 'System Autonomous Merchant'
                      : cleanTargetName}
                </div>
              </div>
              <span className="px-2 py-0.5 bg-[#0f172a] border border-white/20 text-[9px] font-black uppercase text-[#38bdf8] shrink-0">
                {isSelfProfile
                  ? playerUid
                    ? 'REGISTERED'
                    : 'GUEST MODE'
                  : isNpcProfile
                    ? 'OFFICIAL NPC'
                    : 'LIVE PEER'}
              </span>
            </div>

            {isSelfProfile && (
              <div className="p-2 bg-[#0f172a] border border-white/15 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[9px] font-black uppercase tracking-wider text-[#b8ff3c]">
                    NEAR WALLET ID
                  </div>
                  <div
                    data-profile-wallet-id="true"
                    className="text-[11px] font-mono font-bold text-slate-200 break-all"
                  >
                    {playerUid || 'Not registered yet (Guest Session)'}
                  </div>
                </div>
                {playerUid && (
                  <button
                    type="button"
                    onClick={handleCopyAccountId}
                    className="-skew-x-6 px-2.5 py-1 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black font-black text-[9.5px] uppercase border border-black cursor-pointer shrink-0"
                  >
                    <span className="skew-x-6 flex items-center gap-1">
                      {copiedUid ? (
                        <>
                          <Check className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                          <span>COPIED</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                          <span>COPY</span>
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
            <div className="space-y-1.5">
              <div className="text-[9.5px] font-black uppercase tracking-wider text-slate-700">
                IN-GAME CITIZEN ASSETS
              </div>

              <div className="grid grid-cols-3 gap-2">
                {/* Command Plot / House Ownership */}
                <div
                  data-profile-asset-plot="true"
                  className="p-2 bg-white border-[2.5px] border-black shadow-[2px_2px_0px_#000] flex flex-col justify-between gap-1"
                >
                  <div className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-600">
                    <Home className="w-3 h-3 text-black stroke-[2.5] shrink-0" aria-hidden="true" />
                    <span className="truncate">ESTATE / PLOT</span>
                  </div>
                  <div className="text-[11px] font-black uppercase text-black leading-tight">
                    {plotSummaryLabel}
                  </div>
                </div>

                {/* Caught Fish & Minted Fish NFTs */}
                <div
                  data-profile-asset-fish="true"
                  className="p-2 bg-white border-[2.5px] border-black shadow-[2px_2px_0px_#000] flex flex-col justify-between gap-1"
                >
                  <div className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-600">
                    <Fish className="w-3 h-3 text-black stroke-[2.5] shrink-0" aria-hidden="true" />
                    <span className="truncate">FISH &amp; NFTs</span>
                  </div>
                  <div className="text-[11px] font-black uppercase text-black leading-tight">
                    {caughtFishCount} CAUGHT · {mintedFishNftCount} NFT
                  </div>
                </div>

                {/* Recruited Family & Active Harvesters */}
                <div
                  data-profile-asset-units="true"
                  className="p-2 bg-white border-[2.5px] border-black shadow-[2px_2px_0px_#000] flex flex-col justify-between gap-1"
                >
                  <div className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-600">
                    <Users className="w-3 h-3 text-black stroke-[2.5] shrink-0" aria-hidden="true" />
                    <span className="truncate">ACTIVE UNITS</span>
                  </div>
                  <div className="text-[11px] font-black uppercase text-black leading-tight">
                    {recruitedFamilyCount} FAMILY · {activeHarvesterCount} HARVESTER
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
              className="w-full py-2.5 px-4 bg-[#b8ff3c] hover:bg-[#a3e635] text-black border-[2.5px] border-black shadow-[3px_3px_0px_#000] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer active:translate-y-0.5 transition-all"
            >
              <MessageCircle className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
              <span>SEND WHISPER MESSAGE</span>
            </button>
          )}

          {/* 5. NPC MERCHANT NOTICE (When inspecting an NPC) */}
          {isNpcProfile && (
            <div className="p-3 bg-[#fef9c3] border-[2.5px] border-black shadow-[2px_2px_0px_#000] flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-black stroke-[2.5] shrink-0" aria-hidden="true" />
              <div className="text-[11px] font-bold text-black leading-snug">
                {cleanTargetName} is an official NPC merchant in The City. Interact using the{' '}
                <span className="font-black">TALK</span> action to open the exchange counter.
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
