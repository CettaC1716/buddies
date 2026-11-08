import React, { useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  MapPin,
  MessageSquare,
  Shield,
  Trophy,
  Crown,
  Sparkles,
  UserPlus,
  X,
  type LucideIcon,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import { NearbyEntityUser } from './SocialChatModal';

interface CharacterProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: NearbyEntityUser | null;
  onStartWhisper: (user: NearbyEntityUser) => void;
  lulBalance?: number;
  cyonBalance?: number;
  respiteBalance?: number;
}

interface BadgeItem {
  id: string;
  Icon: LucideIcon;
  name: string;
  rarity: string;
  description: string;
  unlockedAt: string;
}

const BADGES_COLLECTION: BadgeItem[] = [
  {
    id: 'badge-1',
    Icon: Shield,
    name: 'City Explorer',
    rarity: 'Legendary',
    description:
      'Awarded to true explorers who actively discover every corner of the city, Café Plaza, and Sunset Beach.',
    unlockedAt: 'Season 1 · Safezone Hub',
  },
  {
    id: 'badge-2',
    Icon: Trophy,
    name: 'Minigame Champion',
    rarity: 'Epic',
    description:
      'Awarded to skilled players who master fun minigame challenges and bring energy to community hangouts.',
    unlockedAt: 'Hangout Season · Score Arena',
  },
  {
    id: 'badge-3',
    Icon: Crown,
    name: 'Plaza Host',
    rarity: 'Special',
    description:
      'Honorary title for Safezone friends and mascots who warmly welcome every new citizen with a smile and guidance.',
    unlockedAt: 'Official · Safezone Plaza',
  },
  {
    id: 'badge-4',
    Icon: Sparkles,
    name: 'Home Creator',
    rarity: 'Rare',
    description:
      'Celebrates mastery in decorating dream house plots, styling café furniture, and collecting CYON lifestyle assets.',
    unlockedAt: 'Interior Design Milestone',
  },
];

export const CharacterProfileModal: React.FC<CharacterProfileModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  onStartWhisper,
  lulBalance = 2500,
  cyonBalance = 60,
  respiteBalance = 45,
}) => {
  const [activeBadgeIndex, setActiveBadgeIndex] = useState<number>(0);
  const [likesCount, setLikesCount] = useState<number>(() => {
    return targetUser?.isNpc ? 925352 : 1420;
  });
  const [hasLiked, setHasLiked] = useState<boolean>(false);
  const [isFriendRequested, setIsFriendRequested] = useState<boolean>(false);

  if (!isOpen || !targetUser) return null;

  const currentBadge = BADGES_COLLECTION[activeBadgeIndex] || BADGES_COLLECTION[0];
  const CurrentBadgeIcon = currentBadge.Icon;

  const handlePrevBadge = () => {
    soundEngine.playUiClick();
    setActiveBadgeIndex((prev) => (prev > 0 ? prev - 1 : BADGES_COLLECTION.length - 1));
  };

  const handleNextBadge = () => {
    soundEngine.playUiClick();
    setActiveBadgeIndex((prev) => (prev < BADGES_COLLECTION.length - 1 ? prev + 1 : 0));
  };

  const handleToggleLike = () => {
    soundEngine.playUiClick();
    if (!hasLiked) {
      setLikesCount((prev) => prev + 1);
      setHasLiked(true);
    } else {
      setLikesCount((prev) => prev - 1);
      setHasLiked(false);
    }
  };

  const handleSendFriendRequest = () => {
    soundEngine.playUiClick();
    setIsFriendRequested(true);
  };

  // Determine avatar image based on character identity
  const isFemaleAvatar =
    targetUser.id === 'npc_cafe' ||
    targetUser.name.toLowerCase().includes('hana') ||
    targetUser.name.toLowerCase().includes('nadia');
  const avatarImgSrc = isFemaleAvatar
    ? '/assets/avatar_nadia.jpg'
    : '/assets/avatar_hiro.jpg';

  const userLocation = targetUser.isNpc
    ? 'Café Plaza & Safezone Hub'
    : targetUser.team === 'blue'
    ? 'City Park & Plaza'
    : 'Sunset Area & Beach';

  const userHashtag = targetUser.isNpc
    ? '#SafezoneHost'
    : '#BuddiesLife';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Character Profile ${targetUser.name}`}
      className="fixed inset-0 z-50 flex bg-white text-black border-4 border-black overflow-hidden select-none"
    >
      {/* ====================================================================
          LEFT COLUMN (45% Width): Full-body 3D character showcase area
         ==================================================================== */}
      <section
        aria-label="Character Visual"
        className="w-[45%] h-full relative flex flex-col items-center justify-between p-6 sm:p-8 border-r-4 border-black bg-slate-50 overflow-hidden"
      >
        {/* Decorative Background (Subtle Grid) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-25 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 2px 2px, #94a3b8 1.5px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Top Tag */}
        <div className="relative z-10 w-full flex items-center justify-between gap-2">
          <div className="-skew-x-6 px-3.5 py-1 bg-[#facc15] text-black border-2 border-black shadow-[3px_3px_0px_#000] text-xs font-black tracking-wider uppercase">
            <span className="skew-x-6 inline-block">3D CHARACTER SHOWCASE</span>
          </div>
          <div className="-skew-x-6 px-3 py-1 bg-white border-2 border-black shadow-[3px_3px_0px_#000] text-xs font-black text-black tracking-wider">
            <span className="skew-x-6 inline-block">BUDDIES LIFE</span>
          </div>
        </div>

        {/* Full-Height Character Portrait */}
        <div className="relative z-10 w-full flex-1 flex items-center justify-center py-2 min-h-0">
          <div className="p-2 bg-white border-4 border-black shadow-[6px_6px_0px_#000] max-h-[88%] max-w-[90%] flex items-center justify-center overflow-hidden">
            <img
              src={avatarImgSrc}
              alt={targetUser.name}
              className="max-h-[68vh] w-auto object-contain pointer-events-none"
            />
          </div>
        </div>

        {/* Companion / Status Badge */}
        <div className="relative z-10 -skew-x-6 px-4 py-1.5 bg-white border-2 border-black shadow-[3px_3px_0px_#000] text-xs font-black text-black flex items-center gap-2">
          <div className="skew-x-6 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] border border-black" />
            <span>Buddy Pup · Loyal Hangout Companion</span>
          </div>
        </div>
      </section>

      {/* ====================================================================
          CENTER COLUMN (30% Width - "Profile" Panel): Identity, Status, Bio
         ==================================================================== */}
      <section
        aria-label="Profile Panel"
        className="w-[30%] h-full p-5 sm:p-6 flex flex-col justify-between border-r-4 border-black bg-white overflow-y-auto gap-3.5"
      >
        <div>
          {/* Top-Left Profile Header */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="-skew-x-6 inline-flex px-3.5 py-1 bg-[#38bdf8] border-2 border-black shadow-[3px_3px_0px_#000] text-black font-black text-lg tracking-wider uppercase">
              <span className="skew-x-6 inline-block">CITIZEN PROFILE</span>
            </div>
          </div>

          {/* Personal Balances (Only visible on own profile) */}
          {(String(targetUser.id) === '0' ||
            targetUser.name.toUpperCase().includes('KAMU') ||
            targetUser.name.toUpperCase().includes('YOU')) && (
            <div
              data-private-profile-balances="true"
              className="mb-3 p-2.5 bg-slate-50 border-2 border-black shadow-[3px_3px_0px_#000]"
            >
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
                PERSONAL BALANCE (PRIVATE · VISIBLE ONLY TO YOU)
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="-skew-x-6 px-2.5 py-1 bg-[#fec83e] text-black border-2 border-black shadow-[2px_2px_0_#000] font-black text-[11px]">
                  <span className="skew-x-6 inline-block">{lulBalance} LUL</span>
                </div>
                <div className="-skew-x-6 px-2.5 py-1 bg-[#38bdf8] text-black border-2 border-black shadow-[2px_2px_0_#000] font-black text-[11px]">
                  <span className="skew-x-6 inline-block">{cyonBalance} CYON</span>
                </div>
                <div className="-skew-x-6 px-2.5 py-1 bg-[#d8b4fe] text-black border-2 border-black shadow-[2px_2px_0_#000] font-black text-[11px]">
                  <span className="skew-x-6 inline-block">{respiteBalance} RESPITE</span>
                </div>
              </div>
            </div>
          )}

          {/* Crisp White Identity Card */}
          <div className="relative bg-slate-50 border-2 border-black shadow-[4px_4px_0px_#000] p-4 text-black">
            {/* Top-Right Badge Icon */}
            <div className="absolute top-3 right-3 w-8 h-8 bg-[#facc15] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center text-black">
              <Shield className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
            </div>

            {/* Circular Avatar Photo */}
            <div className="w-20 h-20 rounded-full border-3 border-black mx-auto overflow-hidden shadow-[3px_3px_0px_#000] bg-white flex items-center justify-center">
              <img
                src={avatarImgSrc}
                alt={targetUser.name}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Character Name */}
            <h3 className="text-base sm:text-lg font-black text-black text-center mt-3 tracking-wide break-words leading-tight uppercase">
              {targetUser.name}
            </h3>

            {/* Location */}
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-800 mt-1.5 font-extrabold text-center">
              <MapPin className="w-3.5 h-3.5 text-[#0284c7] shrink-0" aria-hidden="true" />
              <span className="break-words leading-snug">{userLocation}</span>
            </div>

            {/* Hashtag */}
            <div className="text-xs font-black text-[#0284c7] text-center mt-1 tracking-wider break-words">
              {userHashtag}
            </div>

            {/* Likes Bar */}
            <div className="mt-3.5 pt-3 border-t-2 border-black flex items-center justify-between gap-2">
              <span className="text-xs text-black font-black uppercase tracking-wider">Appreciation</span>
              <button
                type="button"
                onClick={handleToggleLike}
                aria-label={hasLiked ? 'Unlike profile' : 'Like profile'}
                className={`-skew-x-6 flex items-center gap-1.5 px-3 py-1 border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-black cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px] ${
                  hasLiked
                    ? 'bg-[#ff3b30] text-white'
                    : 'bg-white hover:bg-[#fef08a] text-black'
                }`}
              >
                <div className="skew-x-6 flex items-center gap-1.5">
                  <Heart
                    className={`w-3.5 h-3.5 ${
                      hasLiked ? 'fill-white text-white' : 'text-[#ff3b30] fill-[#ff3b30]'
                    }`}
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                  <span>{likesCount.toLocaleString()}</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Last Seen Status Bar */}
        <div className="bg-slate-50 border-2 border-black shadow-[4px_4px_0px_#000] px-3.5 py-2.5 text-xs flex items-center justify-between gap-2">
          <span className="text-slate-700 font-black uppercase tracking-wider">Status</span>
          <span className="text-emerald-700 font-black flex items-center gap-1.5 uppercase tracking-wide">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] border border-black inline-block" />
            Online now
          </span>
        </div>

        {/* 3 Parallel Stats Columns: FRIENDS, MEMBER, VISITS */}
        <div className="grid grid-cols-3 gap-2 bg-slate-50 border-2 border-black shadow-[4px_4px_0px_#000] p-3 text-center">
          <div className="bg-white border-2 border-black p-1.5 shadow-[2px_2px_0px_#000]">
            <div className="text-sm sm:text-base font-black text-black">
              {targetUser.isNpc ? '999+' : '12'}
            </div>
            <div className="text-[10px] text-slate-700 font-black tracking-wider uppercase mt-0.5">
              FRIENDS
            </div>
          </div>
          <div className="bg-white border-2 border-black p-1.5 shadow-[2px_2px_0px_#000]">
            <div className="text-sm sm:text-base font-black text-black">
              {targetUser.isNpc ? '6 Years' : '2 Months'}
            </div>
            <div className="text-[10px] text-slate-700 font-black tracking-wider uppercase mt-0.5">
              MEMBER
            </div>
          </div>
          <div className="bg-white border-2 border-black p-1.5 shadow-[2px_2px_0px_#000]">
            <div className="text-sm sm:text-base font-black text-black">
              {targetUser.isNpc ? '> 1 M' : '1.4K'}
            </div>
            <div className="text-[10px] text-slate-700 font-black tracking-wider uppercase mt-0.5">
              VISITS
            </div>
          </div>
        </div>

        {/* Short Bio Attributes Grid */}
        <div className="bg-slate-50 border-2 border-black shadow-[4px_4px_0px_#000] p-3.5 flex flex-col gap-3 text-black">
          {/* First Row: MOOD and MY HOBBY */}
          <div className="grid grid-cols-2 divide-x-2 divide-black">
            <div className="pr-3">
              <div className="text-black font-black text-xs sm:text-sm break-words leading-snug">
                Cheerful &amp; Happy
              </div>
              <div className="text-[10px] text-slate-600 font-black uppercase tracking-wider mt-0.5">
                MOOD
              </div>
            </div>
            <div className="pl-3">
              <div className="text-black font-black text-xs sm:text-sm break-words leading-snug">
                Hangouts &amp; Café
              </div>
              <div className="text-[10px] text-slate-600 font-black uppercase tracking-wider mt-0.5">
                MY HOBBY
              </div>
            </div>
          </div>

          {/* Second Row: MY MUSIC, MY FASHION, and MY MOVIES */}
          <div className="border-t-2 border-black pt-2.5 grid grid-cols-3 divide-x-2 divide-black">
            <div className="pr-2">
              <div className="text-black font-black text-xs break-words leading-snug">
                Lofi &amp; Chill Pop
              </div>
              <div className="text-[10px] text-slate-600 font-black uppercase tracking-wider mt-0.5">
                MY MUSIC
              </div>
            </div>
            <div className="px-2">
              <div className="text-black font-black text-xs break-words leading-snug">
                Trendy Streetwear
              </div>
              <div className="text-[10px] text-slate-600 font-black uppercase tracking-wider mt-0.5">
                MY FASHION
              </div>
            </div>
            <div className="pl-2">
              <div className="text-black font-black text-xs break-words leading-snug">
                Action Adventure
              </div>
              <div className="text-[10px] text-slate-600 font-black uppercase tracking-wider mt-0.5">
                MY MOVIES
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          RIGHT COLUMN (25% Width - "Showcase" Panel): Badges & Navigation
         ==================================================================== */}
      <section
        aria-label="Showcase Panel"
        className="w-[25%] h-full p-5 sm:p-6 flex flex-col justify-between bg-slate-50 overflow-y-auto gap-3.5 text-black"
      >
        <div className="flex flex-col">
          {/* Header with Large Close (X) Button */}
          <div className="flex items-center justify-between gap-2">
            <div className="-skew-x-6 inline-flex px-3.5 py-1 bg-[#facc15] border-2 border-black shadow-[3px_3px_0px_#000] text-black font-black text-lg tracking-wider uppercase">
              <span className="skew-x-6 inline-block">SHOWCASE</span>
            </div>
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onClose();
              }}
              aria-label="Close Profile (ESC)"
              className="-skew-x-6 w-9 h-9 bg-[#ff3b30] hover:bg-[#ff554a] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-white cursor-pointer active:scale-95 transition-transform"
            >
              <X className="skew-x-6 w-5 h-5 stroke-[3]" aria-hidden="true" />
            </button>
          </div>

          {/* Sub-Header Bar Badges */}
          <div className="-skew-x-6 bg-[#38bdf8] border-2 border-black shadow-[3px_3px_0px_#000] px-3.5 py-1.5 flex items-center gap-2 text-black text-xs font-black uppercase mt-3 mb-2">
            <div className="skew-x-6 flex items-center gap-2">
              <Shield className="w-4 h-4 text-black stroke-[2.5] shrink-0" aria-hidden="true" />
              <span className="tracking-wide">OFFICIAL BADGES</span>
            </div>
          </div>

          {/* Active Badge Display */}
          <div className="bg-white border-2 border-black shadow-[4px_4px_0px_#000] p-4 flex flex-col gap-3.5 text-black">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#facc15] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center p-2.5 text-black shrink-0">
                <CurrentBadgeIcon className="w-7 h-7 text-black stroke-[2.5]" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-sm text-black uppercase tracking-wide break-words leading-tight">
                  {currentBadge.name}
                </div>
                <div className="text-xs text-[#0284c7] font-black uppercase tracking-wider mt-0.5 break-words">
                  {currentBadge.rarity}
                </div>
                <p className="text-xs text-slate-800 mt-1.5 leading-snug font-bold break-words">
                  {currentBadge.description}
                </p>
              </div>
            </div>

            {/* Navigation < 1/4 Badges > Below */}
            <div className="flex items-center justify-between pt-3 border-t-2 border-black">
              <button
                type="button"
                onClick={handlePrevBadge}
                aria-label="Previous Badge"
                className="-skew-x-6 w-8 h-8 bg-slate-100 hover:bg-[#facc15] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center text-black cursor-pointer transition-transform active:scale-95"
              >
                <ChevronLeft className="skew-x-6 w-4 h-4 stroke-[3]" aria-hidden="true" />
              </button>
              <span className="text-xs font-black uppercase tracking-wider text-black">
                {activeBadgeIndex + 1}/{BADGES_COLLECTION.length} Badges
              </span>
              <button
                type="button"
                onClick={handleNextBadge}
                aria-label="Next Badge"
                className="-skew-x-6 w-8 h-8 bg-slate-100 hover:bg-[#facc15] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center text-black cursor-pointer transition-transform active:scale-95"
              >
                <ChevronRight className="skew-x-6 w-4 h-4 stroke-[3]" aria-hidden="true" />
              </button>
            </div>

            {/* Mini Selector Row */}
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {BADGES_COLLECTION.map((badge, idx) => {
                const BadgeIcon = badge.Icon;
                const isSelected = activeBadgeIndex === idx;
                return (
                  <button
                    key={badge.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setActiveBadgeIndex(idx);
                    }}
                    className={`-skew-x-6 p-2 border-2 border-black flex flex-col items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#38bdf8] text-black shadow-[2px_2px_0px_#000]'
                        : 'bg-slate-100 text-black hover:bg-slate-200'
                    }`}
                  >
                    <BadgeIcon className="skew-x-6 w-4 h-4 stroke-[2.5]" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Action Buttons */}
        <div className="flex flex-col gap-2.5 mt-auto pt-3 border-t-2 border-black">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onStartWhisper(targetUser);
            }}
            className="-skew-x-6 w-full py-2.5 px-4 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black border-2 border-black shadow-[3px_3px_0px_#000] text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
          >
            <div className="skew-x-6 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
              <span>SEND WHISPER MESSAGE</span>
            </div>
          </button>

          <button
            type="button"
            onClick={handleSendFriendRequest}
            disabled={isFriendRequested}
            className={`-skew-x-6 w-full py-2.5 px-4 border-2 border-black text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              isFriendRequested
                ? 'bg-slate-200 text-slate-600 cursor-default border-black'
                : 'bg-[#facc15] hover:bg-[#fde047] text-black shadow-[3px_3px_0px_#000] cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'
            }`}
          >
            <div className="skew-x-6 flex items-center gap-2">
              {isFriendRequested ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" aria-hidden="true" />
                  <span>REQUEST SENT</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
                  <span>ADD FRIEND</span>
                </>
              )}
            </div>
          </button>
        </div>
      </section>
    </div>
  );
};
