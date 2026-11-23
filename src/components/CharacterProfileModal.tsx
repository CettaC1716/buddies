import React, { useEffect, useRef, useState } from 'react';
import {
  Award,
  Camera,
  Check,
  Copy,
  Crown,
  Edit3,
  Fish,
  Flame,
  Heart,
  Home,
  Image as ImageIcon,
  MessageCircle,
  Send,
  Shield,
  Smile,
  Sparkles,
  Star,
  Trash2,
  Upload,
  User,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { NearbyEntityUser } from './SocialChatModal';
import { soundEngine } from '../game/audio';
import {
  CITY_FEED_UPDATED_EVENT,
  deleteCityFeedPost,
  fetchCityFeedPosts,
  publishCityFeedPost,
  readCachedCityFeedPosts,
  toggleLikeCityFeedPost,
  type CityFeedPost,
} from '../lib/cityFeedService';

export interface PhotoPresetOption {
  id: string;
  label: string;
  url: string;
  cropClassName: string;
}

export interface StatusFeedPost {
  id: string;
  text: string;
  mood?: string;
  photoUrl?: string;
  createdAtMs: number;
  likes: number;
  likedBySelf?: boolean;
}

export type ProfileEmblemIconId =
  | 'smile'
  | 'sparkles'
  | 'crown'
  | 'flame'
  | 'heart'
  | 'zap'
  | 'star'
  | 'shield';

export const PROFILE_EMBLEM_ICONS: ReadonlyArray<{
  id: ProfileEmblemIconId;
  label: string;
}> = [
  { id: 'smile', label: 'Smile' },
  { id: 'sparkles', label: 'Sparkles' },
  { id: 'crown', label: 'Crown' },
  { id: 'flame', label: 'Flame' },
  { id: 'heart', label: 'Heart' },
  { id: 'zap', label: 'Zap' },
  { id: 'star', label: 'Star' },
  { id: 'shield', label: 'Shield' },
];

export function renderProfileEmblemIcon(
  iconId: ProfileEmblemIconId | string | undefined,
  className = 'w-3 h-3 stroke-[2.4]',
): React.ReactNode {
  switch (iconId) {
    case 'sparkles':
      return <Sparkles className={className} aria-hidden="true" />;
    case 'crown':
      return <Crown className={className} aria-hidden="true" />;
    case 'flame':
      return <Flame className={className} aria-hidden="true" />;
    case 'heart':
      return <Heart className={className} aria-hidden="true" />;
    case 'zap':
      return <Zap className={className} aria-hidden="true" />;
    case 'star':
      return <Star className={className} aria-hidden="true" />;
    case 'shield':
      return <Shield className={className} aria-hidden="true" />;
    case 'award':
      return <Award className={className} aria-hidden="true" />;
    case 'smile':
    default:
      return <Smile className={className} aria-hidden="true" />;
  }
}

const STATUS_MOOD_OPTIONS = [
  'Exploring',
  'Chill',
  'Fishing',
  'Racing',
  'Trading',
] as const;

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

export const STATUS_PHOTO_STORAGE_KEY = 'bb_player_status_photo_v1';
export const AVATAR_PHOTO_STORAGE_KEY = 'bb_player_avatar_photo_v1';
export const STATUS_CAPTION_STORAGE_KEY = 'bb_player_status_caption_v1';
export const STATUS_FEED_STORAGE_KEY = 'bb_player_status_feed_v1';
export const EMBLEM_NAME_STORAGE_KEY = 'bb_player_emblem_name_v1';
export const EMBLEM_ICON_STORAGE_KEY = 'bb_player_emblem_icon_v1';
export const PROFILE_IDENTITY_UPDATED_EVENT = 'bb-profile-identity-updated';

export function readStoredStatusCoverPhotoUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(STATUS_PHOTO_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function readStoredEmblemName(defaultTeam: 'blue' | 'red' = 'blue'): string {
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(EMBLEM_NAME_STORAGE_KEY);
      if (saved && saved.trim()) return saved.trim();
    } catch {
      // ignore
    }
  }
  return defaultTeam === 'red' ? 'Red Squad' : 'Blue Squad';
}

export function readStoredEmblemIcon(): ProfileEmblemIconId {
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(EMBLEM_ICON_STORAGE_KEY) as ProfileEmblemIconId | null;
      if (saved && PROFILE_EMBLEM_ICONS.some((item) => item.id === saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
  }
  return 'smile';
}

export function resolveSharedEntityPortraitUrl(
  entity: NearbyEntityUser,
  isSelf = false,
  characterGender: 'male' | 'female' = 'male',
  customCoverUrl = '',
): string {
  if (isSelf) {
    return (
      customCoverUrl ||
      (characterGender === 'female' ? '/assets/avatar_nadia.jpg' : '/assets/avatar_hiro.jpg')
    );
  }
  const lower = entity.name.replace(/\s*\((ANDA|YOU|KAMU)\)/gi, '').trim().toLowerCase();
  const isFemale =
    entity.gender === 'female' ||
    lower.includes('hana') ||
    lower.includes('nadia') ||
    lower.includes('mira') ||
    lower.includes('tari');
  return isFemale ? '/assets/avatar_nadia.jpg' : '/assets/avatar_hiro.jpg';
}

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

function formatRelativeFeedTime(createdAtMs: number, nowMs: number): string {
  const diffSec = Math.max(0, Math.floor((nowMs - createdAtMs) / 1000));
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
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
  playerXpLabel: _playerXpLabel,
  lulBalance: _lulBalance = 0,
  onChangePlayerName,
  onStartWhisper,
  embeddedInPhone = false,
}) => {
  const defaultPhotoUrl =
    characterGender === 'female' ? '/assets/avatar_nadia.jpg' : '/assets/avatar_hiro.jpg';

  const [customStatusPhotoUrl, setCustomStatusPhotoUrl] = useState<string>(() =>
    readStoredStatusCoverPhotoUrl(),
  );

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

  const [emblemName, setEmblemName] = useState<string>(() =>
    readStoredEmblemName(playerTeam),
  );
  const [emblemIconId, setEmblemIconId] = useState<ProfileEmblemIconId>(() =>
    readStoredEmblemIcon(),
  );

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

  const [statusFeed, setStatusFeed] = useState<StatusFeedPost[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(STATUS_FEED_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {
        // ignore
      }
    }
    return [];
  });

  const [cityFeedSnapshot, setCityFeedSnapshot] = useState<CityFeedPost[]>(() =>
    readCachedCityFeedPosts(),
  );

  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [draftPlayerName, setDraftPlayerName] = useState<string>('');
  const [isEditingCaption, setIsEditingCaption] = useState<boolean>(false);
  const [draftCaption, setDraftCaption] = useState<string>(statusCaption);
  const [draftEmblemName, setDraftEmblemName] = useState<string>(emblemName);
  const [draftEmblemIconId, setDraftEmblemIconId] = useState<ProfileEmblemIconId>(emblemIconId);
  const [feedComposerText, setFeedComposerText] = useState<string>('');
  const [selectedMood, setSelectedMood] = useState<string>('Exploring');
  const [attachCoverPhoto, setAttachCoverPhoto] = useState<boolean>(false);
  const [activePhotoPicker, setActivePhotoPicker] = useState<'none' | 'status' | 'avatar'>('none');
  const [copiedUid, setCopiedUid] = useState<boolean>(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

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
      setNowMs(Date.now());
    }
  }, [targetUser, isOpen]);

  useEffect(() => {
    const syncIdentity = () => {
      setCustomStatusPhotoUrl(readStoredStatusCoverPhotoUrl());
      setEmblemName(readStoredEmblemName(playerTeam));
      setEmblemIconId(readStoredEmblemIcon());
    };
    window.addEventListener(PROFILE_IDENTITY_UPDATED_EVENT, syncIdentity);
    return () => {
      window.removeEventListener(PROFILE_IDENTITY_UPDATED_EVENT, syncIdentity);
    };
  }, [playerTeam]);

  useEffect(() => {
    if (!isOpen) return;
    void fetchCityFeedPosts().then((posts) => setCityFeedSnapshot(posts));
    const onFeedUpdated = () => setCityFeedSnapshot(readCachedCityFeedPosts());
    window.addEventListener(CITY_FEED_UPDATED_EVENT, onFeedUpdated);
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => {
      window.removeEventListener(CITY_FEED_UPDATED_EVENT, onFeedUpdated);
      window.clearInterval(timer);
    };
  }, [isOpen]);

  const persistStatusFeed = (nextFeed: StatusFeedPost[]) => {
    setStatusFeed(nextFeed);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STATUS_FEED_STORAGE_KEY, JSON.stringify(nextFeed));
      } catch {
        // ignore
      }
    }
  };

  const persistStatusCaption = (nextCaption: string) => {
    setStatusCaption(nextCaption);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STATUS_CAPTION_STORAGE_KEY, nextCaption);
      } catch {
        // ignore
      }
    }
  };

  const persistEmblem = (nextName: string, nextIcon: ProfileEmblemIconId) => {
    const cleanEmblem =
      nextName.trim().slice(0, 24) || (playerTeam === 'red' ? 'Red Squad' : 'Blue Squad');
    setEmblemName(cleanEmblem);
    setEmblemIconId(nextIcon);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(EMBLEM_NAME_STORAGE_KEY, cleanEmblem);
        window.localStorage.setItem(EMBLEM_ICON_STORAGE_KEY, nextIcon);
      } catch {
        // ignore
      }
      window.dispatchEvent(new CustomEvent(PROFILE_IDENTITY_UPDATED_EVENT));
    }
  };

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

  const isMerchantNpc = Boolean(
    targetUser &&
      (targetUser.isMerchant ||
        targetUser.id === 'npc_hana' ||
        targetUser.id === 'npc_cafe' ||
        targetUser.id === 'npc_kai' ||
        targetUser.id === 'npc_beach'),
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
    : targetUser?.gender === 'female' ||
        cleanTargetName.toLowerCase().includes('hana') ||
        cleanTargetName.toLowerCase().includes('nadia') ||
        cleanTargetName.toLowerCase().includes('mira') ||
        cleanTargetName.toLowerCase().includes('tari')
      ? 'FEMALE'
      : 'MALE';

  const effectiveEmblemName = isSelfProfile
    ? emblemName || (effectiveTeam === 'red' ? 'Red Squad' : 'Blue Squad')
    : isNpcProfile
      ? isMerchantNpc
        ? 'Merchant'
        : 'Citizen'
      : `${effectiveTeam === 'red' ? 'Red' : 'Blue'} Squad`;

  const resolvedStatusPhotoUrl = targetUser
    ? resolveSharedEntityPortraitUrl(
        targetUser,
        isSelfProfile,
        characterGender,
        customStatusPhotoUrl,
      )
    : customStatusPhotoUrl || defaultPhotoUrl;

  const resolvedAvatarPhotoUrl = isSelfProfile
    ? customAvatarPhotoUrl || defaultPhotoUrl
    : targetUser
      ? resolveSharedEntityPortraitUrl(targetUser, false, characterGender, '')
      : defaultPhotoUrl;

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
        window.dispatchEvent(new CustomEvent(PROFILE_IDENTITY_UPDATED_EVENT));
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

  const selfCityActorId =
    (playerUid && playerUid.trim()) || `local-${cleanTargetName.toLowerCase()}`;

  const handleSaveCaption = () => {
    soundEngine.playUiClick();
    const cleaned = draftCaption.trim().slice(0, 80);
    const prevCaption = statusCaption;
    persistStatusCaption(cleaned);
    persistEmblem(draftEmblemName, draftEmblemIconId);
    if (cleaned && cleaned !== prevCaption) {
      const now = Date.now();
      const postId = `status-${now}`;
      const nextPost: StatusFeedPost = {
        id: postId,
        text: cleaned,
        mood: selectedMood || undefined,
        createdAtMs: now,
        likes: 0,
        likedBySelf: false,
      };
      persistStatusFeed([nextPost, ...statusFeed].slice(0, 20));
      void publishCityFeedPost({
        id: postId,
        authorId: selfCityActorId,
        authorNearAccount: playerUid || null,
        authorName: cleanTargetName || 'Buddy',
        authorAvatarUrl: resolvedAvatarPhotoUrl,
        authorTeam: playerTeam,
        authorGender: characterGender,
        text: cleaned,
        mood: selectedMood || undefined,
        location: 'Buddies City',
        createdAtMs: now,
        likedByIds: [],
        comments: [],
      });
    }
    setIsEditingCaption(false);
  };

  const handlePublishFeedPost = () => {
    const cleaned = feedComposerText.trim().slice(0, 160);
    if (!cleaned) return;
    soundEngine.playUiClick();
    const now = Date.now();
    const postId = `status-${now}`;
    const photoUrl = attachCoverPhoto ? resolvedStatusPhotoUrl : undefined;
    const post: StatusFeedPost = {
      id: postId,
      text: cleaned,
      mood: selectedMood || undefined,
      photoUrl,
      createdAtMs: now,
      likes: 0,
      likedBySelf: false,
    };
    const nextFeed = [post, ...statusFeed].slice(0, 20);
    persistStatusFeed(nextFeed);
    persistStatusCaption(cleaned.slice(0, 80));
    setDraftCaption(cleaned.slice(0, 80));
    setFeedComposerText('');
    setAttachCoverPhoto(false);
    void publishCityFeedPost({
      id: postId,
      authorId: selfCityActorId,
      authorNearAccount: playerUid || null,
      authorName: cleanTargetName || 'Buddy',
      authorAvatarUrl: resolvedAvatarPhotoUrl,
      authorTeam: playerTeam,
      authorGender: characterGender,
      text: cleaned,
      mood: selectedMood || undefined,
      location: 'Buddies City',
      photoUrl,
      createdAtMs: now,
      likedByIds: [],
      comments: [],
    });
  };

  const handleToggleLikePost = (postId: string) => {
    soundEngine.playUiClick();
    const nextFeed = statusFeed.map((item) => {
      if (item.id !== postId) return item;
      const nextLiked = !item.likedBySelf;
      return {
        ...item,
        likedBySelf: nextLiked,
        likes: Math.max(0, item.likes + (nextLiked ? 1 : -1)),
      };
    });
    persistStatusFeed(nextFeed);
    void toggleLikeCityFeedPost(postId, selfCityActorId);
  };

  const handleDeleteFeedPost = (postId: string) => {
    soundEngine.playUiClick();
    const nextFeed = statusFeed.filter((item) => item.id !== postId);
    persistStatusFeed(nextFeed);
    void deleteCityFeedPost(postId, selfCityActorId);
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
          ? 'relative w-full h-full bg-transparent p-3 text-white flex flex-col overflow-hidden'
          : 'relative rounded-[32px] bg-[#141926]/68 backdrop-blur-2xl border border-white/25 shadow-[0_24px_70px_rgba(0,0,0,0.52)] p-4 sm:p-5 text-white flex flex-col max-h-full overflow-hidden'
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
        className={`flex items-center justify-between gap-2 border-b border-white/15 shrink-0 ${
          embeddedInPhone ? 'pb-2.5' : 'pb-3'
        }`}
      >
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-[11px] font-semibold text-white/95">
            <User className="w-3.5 h-3.5 text-sky-400 stroke-[2.2]" aria-hidden="true" />
            <span>{isSelfProfile ? 'Citizen Profile' : 'Player Profile'}</span>
          </div>

          {/* Emblem Badge (synced with top-left emblem emot on bottom dock & editable emblem name) */}
          <div
            data-profile-emblem-badge="true"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10.5px] font-semibold ${
              isNpcProfile
                ? 'bg-amber-500/20 text-amber-200 border-amber-400/35'
                : effectiveTeam === 'red'
                  ? 'bg-rose-500/20 text-rose-200 border-rose-400/35'
                  : 'bg-sky-500/20 text-sky-200 border-sky-400/35'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center shrink-0">
              {isNpcProfile ? (
                isMerchantNpc ? (
                  <Sparkles className="w-2.5 h-2.5 stroke-[2.4]" aria-hidden="true" />
                ) : (
                  <User className="w-2.5 h-2.5 stroke-[2.4]" aria-hidden="true" />
                )
              ) : (
                renderProfileEmblemIcon(
                  isSelfProfile ? emblemIconId : 'smile',
                  'w-2.5 h-2.5 stroke-[2.4]',
                )
              )}
            </span>
            <span className="truncate max-w-[110px]">{effectiveEmblemName}</span>
          </div>

          {/* Level Badge (Lv X for Players, NPC for NPCs) */}
          <div
            data-profile-level-badge="true"
            className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/35 text-[10.5px] font-semibold"
          >
            <span>{isNpcProfile ? 'NPC' : `Lv ${playerLevel}`}</span>
          </div>
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
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-rose-500/25 text-white/80 hover:text-rose-200 border border-white/20 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
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
        {/* 1. FROSTED PEARL HERO COVER + OVERLAPPING AVATAR + IDENTITY */}
        <div className="rounded-2xl bg-[#eef0f4]/92 border border-white/80 overflow-hidden shadow-[0_8px_22px_rgba(15,23,42,0.16)] text-slate-900">
          {/* Cover Photo Banner */}
          <div
            data-profile-status-photo-frame="true"
            className={`relative w-full bg-slate-200 overflow-hidden ${
              embeddedInPhone ? 'h-[116px]' : 'h-[132px]'
            }`}
          >
            <img
              src={resolvedStatusPhotoUrl}
              alt={`${cleanTargetName} Status Showcase`}
              draggable={false}
              className={`w-full h-full select-none ${getPhotoCropClassName(resolvedStatusPhotoUrl)}`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/45 via-transparent to-black/20 pointer-events-none" />

            {/* Top-left Status Cover Label */}
            <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-white/85 backdrop-blur-md text-slate-800 border border-white text-[10px] font-semibold tracking-wide shadow-xs">
              <span>Status cover</span>
            </div>

            {/* Top-right Customize Cover Photo Button (Self Only) */}
            {isSelfProfile && (
              <button
                type="button"
                data-edit-status-photo-btn="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  setActivePhotoPicker((prev) => (prev === 'status' ? 'none' : 'status'));
                }}
                className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-white/90 hover:bg-white text-slate-800 backdrop-blur-md border border-white text-[10px] font-semibold cursor-pointer transition-colors shadow-xs"
              >
                <span className="flex items-center gap-1">
                  <Camera className="w-3 h-3 text-sky-600 stroke-[2.2]" aria-hidden="true" />
                  <span>Change cover</span>
                </span>
              </button>
            )}
          </div>

          {/* Overlapping Avatar + Display Name + Live Status Caption */}
          <div className="px-3.5 pb-3.5 -mt-8 relative z-10 space-y-2.5">
            <div className="flex items-end justify-between gap-2.5">
              {/* Overlapping Circular Avatar */}
              <div className="relative shrink-0">
                <div
                  data-profile-circular-avatar="true"
                  className={`rounded-full p-[2.5px] shadow-[0_8px_18px_rgba(15,23,42,0.22)] ${
                    embeddedInPhone ? 'w-16 h-16' : 'w-[70px] h-[70px]'
                  } ${
                    isNpcProfile
                      ? 'bg-gradient-to-tr from-amber-400 to-yellow-400'
                      : effectiveTeam === 'red'
                        ? 'bg-gradient-to-tr from-rose-500 to-pink-400'
                        : 'bg-gradient-to-tr from-sky-500 to-teal-400'
                  }`}
                >
                  <div className="w-full h-full rounded-full overflow-hidden bg-slate-200 ring-2 ring-[#eef0f4]">
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
                    className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-slate-900 hover:bg-slate-800 text-white border-2 border-[#eef0f4] shadow-sm flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <Camera className="w-3 h-3 stroke-[2.2]" aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* Right Header Quick Actions (Rename only, LUL badge removed) */}
              <div className="flex items-center gap-1.5 pb-0.5 flex-wrap justify-end">
                {isSelfProfile && onChangePlayerName && !isEditingName && (
                  <button
                    type="button"
                    data-profile-edit-username-btn="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setDraftPlayerName(cleanTargetName);
                      setIsEditingName(true);
                    }}
                    className="px-2.5 py-1 rounded-full bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 shadow-xs text-[10.5px] font-semibold cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      <Edit3 className="w-3 h-3 text-sky-600 stroke-[2.2]" aria-hidden="true" />
                      <span>Rename</span>
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Name + Online Indicator + Attribute Chips */}
            <div className="space-y-1.5">
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
                    className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-white text-slate-900 font-semibold text-xs border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                  <button
                    type="button"
                    onClick={handleSaveUsername}
                    className="px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[11px] cursor-pointer shrink-0 transition-colors"
                  >
                    <span>Save</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <h2
                    data-profile-display-name="true"
                    className={`font-bold tracking-tight text-slate-900 truncate ${
                      embeddedInPhone ? 'text-[17px]' : 'text-lg'
                    }`}
                  >
                    {cleanTargetName}
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-200 text-[10px] font-semibold text-emerald-800 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>
                      {isSelfProfile ? 'Active' : isNpcProfile ? 'NPC' : 'Online'}
                    </span>
                  </span>
                </div>
              )}

              {/* Live Status Headline & Emblem Editor Row */}
              <div className="rounded-xl bg-[#dfe4ec]/85 border border-slate-300/60 px-2.5 py-1.5">
                {isSelfProfile && isEditingCaption ? (
                  <div className="space-y-2 py-0.5">
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
                        placeholder="Update headline status..."
                        className="flex-1 min-w-0 rounded-lg bg-white text-slate-900 px-2.5 py-1 text-[11px] font-medium border border-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                      />
                    </div>

                    {/* Emblem Name & Emblem Emot/Icon Selector */}
                    <div className="flex items-center gap-1.5 w-full">
                      <span className="text-[10px] font-semibold text-slate-600 shrink-0">
                        Emblem:
                      </span>
                      <input
                        type="text"
                        data-profile-emblem-name-input="true"
                        value={draftEmblemName}
                        maxLength={24}
                        onChange={(e) => setDraftEmblemName(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveCaption();
                          }
                        }}
                        placeholder="Emblem name (e.g. Blue Squad)"
                        className="flex-1 min-w-0 rounded-lg bg-white text-slate-900 px-2.5 py-1 text-[11px] font-semibold border border-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                      />
                      <button
                        type="button"
                        onClick={handleSaveCaption}
                        className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-semibold cursor-pointer transition-colors shrink-0"
                      >
                        <span>Save</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                      {PROFILE_EMBLEM_ICONS.map((iconOpt) => {
                        const activeIcon = draftEmblemIconId === iconOpt.id;
                        return (
                          <button
                            key={iconOpt.id}
                            type="button"
                            data-profile-emblem-icon-btn={iconOpt.id}
                            onClick={() => {
                              soundEngine.playUiClick();
                              setDraftEmblemIconId(iconOpt.id);
                            }}
                            title={`Emblem icon: ${iconOpt.label}`}
                            className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                              activeIcon
                                ? 'bg-emerald-400 text-slate-950 border-slate-900 ring-1 ring-slate-900/30 shadow-xs'
                                : 'bg-white/85 text-slate-700 border-slate-300/80 hover:bg-white'
                            }`}
                          >
                            {renderProfileEmblemIcon(iconOpt.id, 'w-3 h-3 stroke-[2.3]')}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div
                      data-profile-status-caption="true"
                      className="text-[11.5px] font-medium text-slate-700 truncate"
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
                          setDraftEmblemName(emblemName);
                          setDraftEmblemIconId(emblemIconId);
                          setIsEditingCaption(true);
                        }}
                        className="px-2 py-0.5 rounded-full bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 border border-slate-200/90 shadow-xs text-[10px] font-semibold shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Edit3 className="w-2.5 h-2.5 stroke-[2.2]" aria-hidden="true" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-slate-500 pt-0.5">
                <span>{effectiveGenderLabel === 'FEMALE' ? 'Female' : 'Male'}</span>
                <span aria-hidden="true">·</span>
                <span
                  data-profile-emblem-label="true"
                  className="inline-flex items-center gap-1 font-semibold text-slate-700"
                >
                  {renderProfileEmblemIcon(
                    isSelfProfile ? emblemIconId : 'smile',
                    'w-3 h-3 stroke-[2.2] text-emerald-600',
                  )}
                  <span>{effectiveEmblemName}</span>
                </span>
                {isSelfProfile && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {statusFeed.length} {statusFeed.length === 1 ? 'post' : 'posts'}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* INLINE PHOTO PICKER DRAWER */}
            {isSelfProfile && activePhotoPicker !== 'none' && (
              <div
                data-profile-photo-picker={activePhotoPicker}
                className="p-2.5 rounded-2xl bg-[#dfe4ec]/90 border border-slate-300/70 space-y-2.5 text-slate-900"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-800 truncate">
                    {activePhotoPicker === 'status'
                      ? 'Select cover photo'
                      : 'Select circular avatar'}
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
                    className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-semibold cursor-pointer shrink-0 transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      <Upload className="w-3 h-3 stroke-[2.2]" aria-hidden="true" />
                      <span>Upload</span>
                    </span>
                  </button>
                </div>

                <div
                  className={`grid gap-1.5 ${
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
                            ? 'bg-white text-slate-900 border-slate-900 ring-1 ring-slate-900/20 shadow-xs'
                            : 'bg-white/65 text-slate-600 border-slate-200/80 hover:border-slate-300 hover:bg-white'
                        }`}
                      >
                        <div className="w-full h-9 rounded-lg overflow-hidden bg-slate-200">
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
        </div>

        {/* 2. STATUS FEED COMPOSER & TIMELINE */}
        <div
          data-profile-status-feed="true"
          className={`rounded-2xl bg-[#eef0f4]/92 border border-white/80 shadow-[0_8px_22px_rgba(15,23,42,0.16)] text-slate-900 space-y-2.5 ${
            embeddedInPhone ? 'p-3' : 'p-3.5'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-600 stroke-[2.2]" aria-hidden="true" />
              <span className="text-[11.5px] font-semibold text-slate-900">Status Feed</span>
            </div>
            {isSelfProfile && (
              <span className="text-[10px] font-medium text-slate-500">
                Syncs with City Feed
              </span>
            )}
          </div>

          {isSelfProfile ? (
            <>
              {/* Composer Box */}
              <div className="rounded-xl bg-[#dfe4ec]/85 border border-slate-300/60 p-2.5 space-y-2">
                <textarea
                  rows={2}
                  maxLength={160}
                  value={feedComposerText}
                  onChange={(e) => setFeedComposerText(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handlePublishFeedPost();
                    }
                  }}
                  placeholder="Share an update to your Status Feed..."
                  data-profile-status-feed-input="true"
                  className="w-full resize-none bg-transparent text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none leading-snug"
                />

                {/* Mood Chips */}
                <div className="flex items-center gap-1 flex-wrap">
                  {STATUS_MOOD_OPTIONS.map((mood) => {
                    const active = selectedMood === mood;
                    return (
                      <button
                        key={mood}
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          setSelectedMood(active ? '' : mood);
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-colors cursor-pointer ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white/80 text-slate-600 border-slate-200/90 hover:bg-white hover:text-slate-900'
                        }`}
                      >
                        {mood}
                      </button>
                    );
                  })}
                </div>

                {/* Action Row */}
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-300/60">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setAttachCoverPhoto((prev) => !prev);
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-semibold border cursor-pointer transition-colors shadow-xs ${
                      attachCoverPhoto
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50'
                    }`}
                  >
                    <ImageIcon className="w-3 h-3 stroke-[2.2]" aria-hidden="true" />
                    <span>{attachCoverPhoto ? 'Photo attached' : 'Attach cover'}</span>
                  </button>

                  <button
                    type="button"
                    data-profile-post-status-btn="true"
                    disabled={!feedComposerText.trim()}
                    onClick={handlePublishFeedPost}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300/80 disabled:text-slate-500 text-white text-[10.5px] font-semibold cursor-pointer disabled:cursor-not-allowed transition-colors shadow-xs"
                  >
                    <Send className="w-3 h-3 stroke-[2.2]" aria-hidden="true" />
                    <span>Post Status</span>
                  </button>
                </div>
              </div>

              {/* Feed Timeline */}
              {statusFeed.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300/80 bg-[#dfe4ec]/55 py-4 px-3 text-center text-[11px] text-slate-500">
                  No status posts yet. Write your first update above.
                </div>
              ) : (
                <div className="space-y-2">
                  {statusFeed.map((post) => (
                    <article
                      key={post.id}
                      data-profile-feed-item="true"
                      className="rounded-xl bg-white/85 border border-slate-200/90 p-2.5 space-y-2 shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-200 border border-white shadow-xs shrink-0">
                            <img
                              src={resolvedAvatarPhotoUrl}
                              alt={cleanTargetName}
                              className={`w-full h-full ${getPhotoCropClassName(resolvedAvatarPhotoUrl)}`}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold text-slate-900 truncate">
                              {cleanTargetName}
                            </div>
                            <div className="flex items-center gap-1 text-[9.5px] text-slate-500">
                              {post.mood && <span>{post.mood}</span>}
                              {post.mood && <span aria-hidden="true">·</span>}
                              <span>{formatRelativeFeedTime(post.createdAtMs, nowMs)}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteFeedPost(post.id)}
                          aria-label="Delete status post"
                          className="w-6 h-6 rounded-full bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                        >
                          <Trash2 className="w-3 h-3 stroke-[2]" aria-hidden="true" />
                        </button>
                      </div>

                      <p className="text-[11.5px] text-slate-800 leading-relaxed break-words">
                        {post.text}
                      </p>

                      {post.photoUrl && (
                        <div className="w-full h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                          <img
                            src={post.photoUrl}
                            alt="Status snapshot"
                            className={`w-full h-full ${getPhotoCropClassName(post.photoUrl)}`}
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleToggleLikePost(post.id)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold border cursor-pointer transition-colors tabular-nums ${
                            post.likedBySelf
                              ? 'bg-rose-50 text-rose-600 border-rose-200'
                              : 'bg-slate-100/90 text-slate-600 border-slate-200 hover:bg-slate-200/70'
                          }`}
                        >
                          <Heart
                            className={`w-3 h-3 stroke-[2.2] ${
                              post.likedBySelf ? 'fill-rose-500 text-rose-500' : ''
                            }`}
                            aria-hidden="true"
                          />
                          <span>{post.likes}</span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          ) : (
            (() => {
              const targetIdLower = String(targetUser?.id ?? '').trim().toLowerCase();
              const targetNearLower = String(targetUser?.nearAccountId ?? '').trim().toLowerCase();
              const targetNameLower = cleanTargetName.toLowerCase();
              const peerPosts = isNpcProfile
                ? []
                : cityFeedSnapshot.filter(
                    (p) =>
                      (targetIdLower && p.authorId.toLowerCase() === targetIdLower) ||
                      (targetNearLower &&
                        p.authorNearAccount?.toLowerCase() === targetNearLower) ||
                      (targetNameLower && p.authorName.toLowerCase() === targetNameLower),
                  );

              if (peerPosts.length === 0) {
                return (
                  <div className="rounded-xl bg-[#dfe4ec]/85 border border-slate-300/60 p-2.5 space-y-1.5">
                    <div className="text-[10px] font-medium text-slate-500">Latest broadcast</div>
                    <p className="text-[12px] text-slate-800 leading-relaxed">
                      {isNpcProfile
                        ? 'Official Exchange & Supply Merchant in Central Plaza.'
                        : targetUser?.status || 'Exploring Buddies City'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {peerPosts.slice(0, 6).map((post) => (
                    <article
                      key={post.id}
                      className="rounded-xl bg-white/85 border border-slate-200/90 p-2.5 space-y-1.5 shadow-xs"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                        {post.location && <span>{post.location}</span>}
                        {post.location && post.mood && <span aria-hidden="true">·</span>}
                        {post.mood && <span>{post.mood}</span>}
                        {(post.location || post.mood) && <span aria-hidden="true">·</span>}
                        <span>{formatRelativeFeedTime(post.createdAtMs, nowMs)}</span>
                      </div>
                      <p className="text-[11.5px] text-slate-800 leading-relaxed break-words">
                        {post.text}
                      </p>
                      {post.photoUrl && (
                        <div className="w-full h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                          <img
                            src={post.photoUrl}
                            alt="Status snapshot"
                            className={`w-full h-full ${getPhotoCropClassName(post.photoUrl)}`}
                          />
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              );
            })()
          )}
        </div>

        {/* 3. REAL IN-GAME ASSET SUMMARY (FOR SELF PROFILE) */}
        {isSelfProfile && (
          <div
            className={`rounded-2xl bg-[#eef0f4]/92 border border-white/80 shadow-[0_8px_22px_rgba(15,23,42,0.16)] text-slate-900 space-y-2 ${
              embeddedInPhone ? 'p-3' : 'p-3.5'
            }`}
          >
            <div className="text-[11px] font-semibold text-slate-700">
              In-game citizen assets
            </div>

            <div className={`grid grid-cols-3 ${embeddedInPhone ? 'gap-1.5' : 'gap-2'}`}>
              {/* Command Plot / House Ownership */}
              <div
                data-profile-asset-plot="true"
                className="min-w-0 p-2 rounded-xl bg-[#dfe4ec]/85 border border-slate-300/60 flex flex-col justify-between gap-1.5"
              >
                <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 min-w-0">
                  <Home className="w-3 h-3 text-sky-600 stroke-[2.2] shrink-0" aria-hidden="true" />
                  <span className="truncate">Estate / Plot</span>
                </div>
                <div className="text-[10.5px] font-semibold text-slate-900 leading-tight break-words">
                  {plotSummaryLabel}
                </div>
              </div>

              {/* Caught Fish & Minted Fish NFTs */}
              <div
                data-profile-asset-fish="true"
                className="min-w-0 p-2 rounded-xl bg-[#dfe4ec]/85 border border-slate-300/60 flex flex-col justify-between gap-1.5"
              >
                <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 min-w-0">
                  <Fish className="w-3 h-3 text-teal-600 stroke-[2.2] shrink-0" aria-hidden="true" />
                  <span className="truncate">Fish &amp; NFTs</span>
                </div>
                <div className="text-[10.5px] font-semibold text-slate-900 leading-tight break-words">
                  {caughtFishCount} Caught · {mintedFishNftCount} NFT
                </div>
              </div>

              {/* Recruited Family & Active Harvesters */}
              <div
                data-profile-asset-units="true"
                className="min-w-0 p-2 rounded-xl bg-[#dfe4ec]/85 border border-slate-300/60 flex flex-col justify-between gap-1.5"
              >
                <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 min-w-0">
                  <Users className="w-3 h-3 text-indigo-600 stroke-[2.2] shrink-0" aria-hidden="true" />
                  <span className="truncate">Active units</span>
                </div>
                <div className="text-[10.5px] font-semibold text-slate-900 leading-tight break-words">
                  {recruitedFamilyCount} Family · {activeHarvesterCount} Harvester
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. ACCOUNT & NEAR WALLET IDENTITY DETAILS */}
        <div
          className={`rounded-2xl bg-[#eef0f4]/92 border border-white/80 shadow-[0_8px_22px_rgba(15,23,42,0.16)] text-slate-900 space-y-2.5 ${
            embeddedInPhone ? 'p-3' : 'p-3.5'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10.5px] font-medium text-slate-500">
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
            <span className="px-2.5 py-0.5 rounded-full bg-white border border-slate-200/90 text-[10px] font-semibold text-slate-700 shrink-0 shadow-xs">
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
            <div className="p-2.5 rounded-xl bg-[#dfe4ec]/85 border border-slate-300/60 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                  <Wallet className="w-3 h-3 stroke-[2.2]" aria-hidden="true" />
                  <span>NEAR wallet ID</span>
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
                  className="px-3 py-1 rounded-full bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 shadow-xs font-semibold text-[10.5px] cursor-pointer shrink-0 transition-colors"
                >
                  <span className="flex items-center gap-1">
                    {copiedUid ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600 stroke-[2.2]" aria-hidden="true" />
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

        {/* 5. REMOTE REAL PLAYER WHISPER ACTION (Hidden for Self and NPCs) */}
        {!isSelfProfile && !isNpcProfile && targetUser && onStartWhisper && (
          <button
            type="button"
            data-profile-whisper-btn="true"
            onClick={() => {
              soundEngine.playUiClick();
              onStartWhisper(targetUser);
            }}
            className="w-full py-2.5 px-4 rounded-full bg-white hover:bg-slate-50 text-slate-900 border border-white/90 shadow-[0_6px_18px_rgba(15,23,42,0.18)] font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition-all"
          >
            <MessageCircle className="w-4 h-4 text-sky-600 stroke-[2.2]" aria-hidden="true" />
            <span>Send whisper message</span>
          </button>
        )}

        {/* 6. NPC MERCHANT NOTICE (When inspecting an NPC) */}
        {isNpcProfile && (
          <div className="p-3.5 rounded-2xl bg-[#eef0f4]/92 border border-amber-300/80 shadow-sm flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-amber-600 stroke-[2.2] shrink-0" aria-hidden="true" />
            <div className="text-[11.5px] font-medium text-slate-700 leading-snug">
              {cleanTargetName} is an official NPC merchant in The City. Interact using the{' '}
              <span className="font-semibold text-slate-900">TALK</span> action to open the exchange counter.
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
