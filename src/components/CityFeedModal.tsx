import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Heart,
  Image as ImageIcon,
  MapPin,
  MessageCircle,
  RefreshCw,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import {
  resolveNpcCitizenIdFromEntity,
  resolveNpcPhotoUrl,
  useNpcPortraitVersion,
} from '../game/npcPortraitRegistry';
import {
  commentCityFeedPost,
  deleteCityFeedPost,
  fetchCityFeedPosts,
  publishCityFeedPost,
  readCachedCityFeedPosts,
  subscribeToCityFeedRealtime,
  toggleLikeCityFeedPost,
  CITY_FEED_UPDATED_EVENT,
  type CityFeedPost,
} from '../lib/cityFeedService';
import { CERRIA_CITY_NAME } from '../lib/cerriaBrand';
import { getPhotoCropClassName } from './CharacterProfileModal';
import {
  filterRealHumanOnlinePlayers,
  simplifyDisplayName,
  type NearbyEntityUser,
} from './SocialChatModal';
import { RoleBadgeCircle } from './RoleBadgeCircle';
import {
  DEFAULT_PLAYER_SOCIAL_GRAPH,
  isFollowingPlayer,
  type PlayerSocialGraph,
} from '../game/buddiesSocialGraph';
import { normalizePlayerPrivacyKey } from '../game/buddiesPrivacySettings';
import {
  fetchPlayerProfilesByAccounts,
  type SearchedPlayerProfile,
} from '../lib/supabaseClient';

export interface CityFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  embeddedInPhone?: boolean;
  playerName: string;
  playerUid?: string | null;
  characterGender: 'male' | 'female';
  playerTeam: 'blue' | 'red';
  currentDistrict: string;
  nearbyUsers: NearbyEntityUser[];
  socialGraph?: PlayerSocialGraph;
  onToggleFollowPlayer?: (user: NearbyEntityUser) => void;
  onOpenPlayerProfile?: (user: NearbyEntityUser) => void;
  onStartWhisper?: (user: NearbyEntityUser) => void;
}

type FeedFilterTab = 'all' | 'following' | 'nearby' | 'mine';

const FEED_MOODS = ['Exploring', 'Chill', 'Fishing', 'Racing', 'Trading', 'Cafe'] as const;
const AVATAR_PHOTO_STORAGE_KEY = 'bb_player_avatar_photo_v1';
const STATUS_PHOTO_STORAGE_KEY = 'bb_player_status_photo_v1';

function formatRelativeTime(createdAtMs: number, nowMs: number): string {
  const diffSec = Math.max(0, Math.floor((nowMs - createdAtMs) / 1000));
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function resolveAuthorPhoto(
  avatarUrl: string | undefined,
  gender: 'male' | 'female',
  authorName: string,
): string {
  if (avatarUrl) return avatarUrl;
  const npcCid = resolveNpcCitizenIdFromEntity({ name: authorName, isNpc: true });
  if (npcCid) {
    return resolveNpcPhotoUrl(npcCid, 'avatar');
  }
  const lower = authorName.toLowerCase();
  if (gender === 'female' || lower.includes('nadia') || lower.includes('hana')) {
    return '/assets/avatar_nadia.jpg';
  }
  return '/assets/avatar_hiro.jpg';
}

export const CityFeedModal: React.FC<CityFeedModalProps> = ({
  isOpen,
  onClose,
  embeddedInPhone = false,
  playerName,
  playerUid,
  characterGender,
  playerTeam,
  currentDistrict,
  nearbyUsers,
  socialGraph = DEFAULT_PLAYER_SOCIAL_GRAPH,
  onToggleFollowPlayer: _onToggleFollowPlayer,
  onOpenPlayerProfile,
  onStartWhisper,
}) => {
  useNpcPortraitVersion();
  const cleanSelfName = simplifyDisplayName(playerName) || 'Buddy';
  const selfActorId = useMemo(
    () => (playerUid && playerUid.trim()) || `local-${cleanSelfName.toLowerCase()}`,
    [playerUid, cleanSelfName],
  );

  const selfAvatarUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem(AVATAR_PHOTO_STORAGE_KEY);
        if (saved) return saved;
      } catch {
        // ignore
      }
    }
    return characterGender === 'female' ? '/assets/avatar_nadia.jpg' : '/assets/avatar_hiro.jpg';
  }, [characterGender]);

  const selfCoverUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem(STATUS_PHOTO_STORAGE_KEY);
        if (saved) return saved;
      } catch {
        // ignore
      }
    }
    return selfAvatarUrl;
  }, [selfAvatarUrl]);

  const [posts, setPosts] = useState<CityFeedPost[]>(() => readCachedCityFeedPosts());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [filterTab, setFilterTab] = useState<FeedFilterTab>('all');
  const [composerText, setComposerText] = useState<string>('');
  const [selectedMood, setSelectedMood] = useState<string>('Exploring');
  const [attachedPhotoUrl, setAttachedPhotoUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [brokenPhotoIds, setBrokenPhotoIds] = useState<Record<string, boolean>>({});
  const [followedRemoteProfiles, setFollowedRemoteProfiles] = useState<SearchedPlayerProfile[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onlineHumanPeers = useMemo(
    () => filterRealHumanOnlinePlayers(nearbyUsers, cleanSelfName, playerUid),
    [nearbyUsers, cleanSelfName, playerUid],
  );

  useEffect(() => {
    if (!isOpen || socialGraph.following.length === 0) {
      setFollowedRemoteProfiles([]);
      return;
    }
    let cancelled = false;
    const ids = socialGraph.following.map((f) => f.id);
    void fetchPlayerProfilesByAccounts(ids).then((profiles) => {
      if (!cancelled) {
        setFollowedRemoteProfiles(profiles);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, socialGraph.following]);

  const followedBuilders = useMemo(() => {
    const remoteById = new Map<string, SearchedPlayerProfile>();
    for (const p of followedRemoteProfiles) {
      remoteById.set(normalizePlayerPrivacyKey(p.nearAccountId), p);
    }
    return socialGraph.following.map((entry) => {
      const key = normalizePlayerPrivacyKey(entry.id);
      const onlinePeer = onlineHumanPeers.find(
        (u) =>
          normalizePlayerPrivacyKey(u.nearAccountId || u.id) === key ||
          normalizePlayerPrivacyKey(u.name) === normalizePlayerPrivacyKey(entry.name),
      );
      const remote = remoteById.get(key);
      const buildingProject =
        onlinePeer?.buildingProject || remote?.buildingProject || entry.buildingProject || '';
      const roleBadge = onlinePeer?.roleBadge || remote?.roleBadge || entry.roleBadge;
      const targetUser: NearbyEntityUser = onlinePeer ?? {
        id: remote?.nearAccountId || entry.id,
        nearAccountId: remote?.nearAccountId || entry.id,
        name: remote?.displayName || entry.name,
        distance: 999,
        isNpc: false,
        roleBadge,
        buildingProject,
        socialX: remote?.socialX,
        socialGithub: remote?.socialGithub,
        socialWebsite: remote?.socialWebsite,
        allowFriendRequests: remote?.allowFriendRequests,
        privateMessages: remote?.privateMessages,
        apartmentVisits: remote?.apartmentVisits,
        showWalletAddressOnProfile: remote?.showWalletAddressOnProfile,
        showThingsOnProfile: remote?.showThingsOnProfile,
      };
      return {
        id: entry.id,
        name: remote?.displayName || onlinePeer?.name || entry.name,
        roleBadge,
        buildingProject,
        isOnline: Boolean(onlinePeer),
        targetUser,
      };
    });
  }, [socialGraph.following, followedRemoteProfiles, onlineHumanPeers]);

  const loadFeed = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsLoading(true);
    const fetched = await fetchCityFeedPosts();
    setPosts(fetched);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void loadFeed(posts.length === 0);
    const unsubRealtime = subscribeToCityFeedRealtime(() => {
      setPosts(readCachedCityFeedPosts());
    });
    const onLocalFeedUpdated = () => {
      setPosts(readCachedCityFeedPosts());
    };
    window.addEventListener(CITY_FEED_UPDATED_EVENT, onLocalFeedUpdated);
    const clockTimer = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => {
      unsubRealtime();
      window.removeEventListener(CITY_FEED_UPDATED_EVENT, onLocalFeedUpdated);
      window.clearInterval(clockTimer);
    };
  }, [isOpen, loadFeed]);

  const isOwnPost = useCallback(
    (post: CityFeedPost): boolean => {
      const aId = post.authorId.trim().toLowerCase();
      const sId = selfActorId.trim().toLowerCase();
      if (aId === sId) return true;
      if (
        playerUid &&
        post.authorNearAccount &&
        post.authorNearAccount.trim().toLowerCase() === playerUid.trim().toLowerCase()
      ) {
        return true;
      }
      return (
        simplifyDisplayName(post.authorName).toLowerCase() === cleanSelfName.toLowerCase() &&
        aId.startsWith('local-')
      );
    },
    [selfActorId, playerUid, cleanSelfName],
  );

  const filteredPosts = useMemo(() => {
    if (filterTab === 'mine') {
      return posts.filter(isOwnPost);
    }
    if (filterTab === 'following') {
      return posts.filter(
        (p) =>
          !isOwnPost(p) &&
          isFollowingPlayer(socialGraph, p.authorNearAccount || p.authorId, p.authorName),
      );
    }
    if (filterTab === 'nearby') {
      const peerNames = new Set(
        onlineHumanPeers.map((u) => simplifyDisplayName(u.name).toLowerCase()),
      );
      const peerIds = new Set(onlineHumanPeers.map((u) => String(u.id).toLowerCase()));
      return posts.filter((p) => {
        if (isOwnPost(p)) return false;
        const pName = simplifyDisplayName(p.authorName).toLowerCase();
        const pId = p.authorId.toLowerCase();
        return peerIds.has(pId) || peerNames.has(pName);
      });
    }
    return posts;
  }, [posts, filterTab, isOwnPost, onlineHumanPeers, socialGraph]);

  const handleUploadSnapshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAttachedPhotoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePublish = async () => {
    const cleanText = composerText.trim().slice(0, 220);
    if (!cleanText || isSubmitting) return;
    soundEngine.playUiClick();
    setIsSubmitting(true);

    const newPost: CityFeedPost = {
      id: `cf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      authorId: selfActorId,
      authorNearAccount: playerUid || null,
      authorName: cleanSelfName,
      authorAvatarUrl: selfAvatarUrl,
      authorTeam: playerTeam,
      authorGender: characterGender,
      text: cleanText,
      mood: selectedMood || undefined,
      location: currentDistrict || 'Central Plaza',
      photoUrl: attachedPhotoUrl || undefined,
      createdAtMs: Date.now(),
      likedByIds: [],
      comments: [],
    };

    const nextPosts = await publishCityFeedPost(newPost);
    setPosts(nextPosts);
    setComposerText('');
    setAttachedPhotoUrl('');
    setIsSubmitting(false);
  };

  const handleToggleLike = async (postId: string) => {
    soundEngine.playUiClick();
    const nextPosts = await toggleLikeCityFeedPost(postId, selfActorId);
    setPosts(nextPosts);
  };

  const handleDelete = async (postId: string) => {
    soundEngine.playUiClick();
    const nextPosts = await deleteCityFeedPost(postId, selfActorId);
    setPosts(nextPosts);
  };

  const handleSubmitComment = async (postId: string) => {
    const draft = (commentDrafts[postId] || '').trim().slice(0, 160);
    if (!draft) return;
    soundEngine.playUiClick();
    const nextPosts = await commentCityFeedPost(postId, {
      id: `cmt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      authorId: selfActorId,
      authorName: cleanSelfName,
      authorAvatarUrl: selfAvatarUrl,
      text: draft,
      createdAtMs: Date.now(),
    });
    setPosts(nextPosts);
    setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
  };

  const buildTargetUserForPost = (post: CityFeedPost): NearbyEntityUser => {
    const matchedPeer = onlineHumanPeers.find(
      (u) =>
        String(u.id).toLowerCase() === post.authorId.toLowerCase() ||
        simplifyDisplayName(u.name).toLowerCase() === simplifyDisplayName(post.authorName).toLowerCase(),
    );
    if (matchedPeer) return matchedPeer;
    return {
      id: post.authorNearAccount || post.authorId,
      nearAccountId: post.authorNearAccount || undefined,
      name: post.authorName,
      distance: 0,
      isNpc: false,
      isSelf: isOwnPost(post),
      gender: post.authorGender,
      team: post.authorTeam,
      status: post.text,
    };
  };

  if (!isOpen) return null;

  return (
    <div
      data-city-feed-modal="true"
      className={
        embeddedInPhone
          ? 'relative w-full h-full bg-transparent p-3 text-white flex flex-col overflow-hidden'
          : 'relative rounded-[32px] bg-gradient-to-b from-[#171d2c]/86 via-[#111622]/84 to-[#0c101a]/88 border border-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_24px_70px_rgba(0,0,0,0.58)] p-4 text-white flex flex-col max-h-full overflow-hidden'
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUploadSnapshot}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/15 shrink-0">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-white truncate">
            City Feed
          </h2>
          <p className="text-[10.5px] text-white/70 truncate">
            {currentDistrict || 'Central Plaza'} · {posts.length}{' '}
            {posts.length === 1 ? 'post' : 'posts'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            data-city-feed-refresh="true"
            onClick={() => {
              soundEngine.playUiClick();
              void loadFeed(true);
            }}
            aria-label="Refresh City Feed"
            title="Refresh feed"
            className="w-8 h-8 rounded-full bg-[#eef0f4]/90 hover:bg-white border border-white/80 text-slate-700 hover:text-slate-950 shadow-sm flex items-center justify-center cursor-pointer transition-colors"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 stroke-[2.1] ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
          </button>

          {!embeddedInPhone && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onClose();
              }}
              aria-label="Close City Feed"
              className="w-8 h-8 rounded-full bg-[#eef0f4]/90 hover:bg-white border border-white/80 text-slate-700 hover:text-rose-600 shadow-sm flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Segmented Filter Bar (inZOI Frosted Pearl Card) */}
      <div
        role="tablist"
        aria-label="Feed Filter"
        className="grid grid-cols-4 gap-1 p-1 mt-2.5 rounded-2xl bg-[#eef0f4]/92 border border-white/80 shadow-[0_6px_16px_rgba(15,23,42,0.14)] shrink-0"
      >
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'following', label: `Following (${socialGraph.following.length})` },
            { id: 'nearby', label: `Nearby (${onlineHumanPeers.length})` },
            { id: 'mine', label: 'Mine' },
          ] as const
        ).map((tab) => {
          const active = filterTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-city-feed-tab={tab.id}
              onClick={() => {
                soundEngine.playUiClick();
                setFilterTab(tab.id);
              }}
              className={`py-1.5 px-1.5 rounded-xl text-[10.5px] font-semibold whitespace-nowrap truncate transition-colors cursor-pointer ${
                active
                  ? 'bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.1)]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/55'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Scrollable Feed Area */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-0.5 mt-2.5 space-y-2.5">
        {/* Followed Builders' "Building —" Project Status Strip */}
        {(filterTab === 'all' || filterTab === 'following') && followedBuilders.length > 0 && (
          <div
            data-city-feed-following-builders="true"
            className="rounded-2xl bg-[#eef0f4]/92 border border-white/80 shadow-[0_6px_16px_rgba(15,23,42,0.14)] p-2.5 space-y-1.5 text-slate-900"
          >
            <div className="flex items-center justify-between gap-2 px-0.5">
              <span className="text-[10.5px] font-semibold text-slate-700">
                Builders you follow
              </span>
              <span className="text-[10px] font-medium text-slate-500">
                {followedBuilders.length} following
              </span>
            </div>
            <div className="space-y-1.5">
              {followedBuilders.map((builder) => (
                <button
                  key={builder.id}
                  type="button"
                  data-city-feed-followed-builder={builder.id}
                  onClick={() => {
                    soundEngine.playUiClick();
                    onOpenPlayerProfile?.(builder.targetUser);
                  }}
                  className="w-full px-2.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-left cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <RoleBadgeCircle roleId={builder.roleBadge} size="xs" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-slate-900 truncate flex items-center gap-1.5">
                        <span className="truncate">{simplifyDisplayName(builder.name)}</span>
                        {builder.isOnline && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        )}
                      </div>
                      <div className="text-[10.5px] text-slate-600 truncate">
                        {builder.buildingProject ? (
                          <>
                            Building —{' '}
                            <span className="font-semibold text-slate-900">
                              {builder.buildingProject}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400">Following their City Feed updates</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Live Online Citizens Quick Strip */}
        {onlineHumanPeers.length > 0 && (
          <div className="rounded-2xl bg-[#eef0f4]/92 border border-white/80 shadow-[0_6px_16px_rgba(15,23,42,0.14)] p-2.5 space-y-1.5 text-slate-900">
            <div className="flex items-center justify-between text-[10.5px] font-medium text-slate-500">
              <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                <Users className="w-3.5 h-3.5 text-sky-600" aria-hidden="true" />
                <span>Players nearby</span>
              </span>
              <span className="tabular-nums">{onlineHumanPeers.length} online</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
              {onlineHumanPeers.map((peer) => {
                const peerLabel = simplifyDisplayName(peer.name);
                const peerAvatar = resolveAuthorPhoto(
                  undefined,
                  peer.gender === 'female' ? 'female' : 'male',
                  peerLabel,
                );
                return (
                  <button
                    key={String(peer.id)}
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      onOpenPlayerProfile?.(peer);
                    }}
                    className="flex items-center gap-1.5 pr-2.5 pl-1 py-1 rounded-full bg-white hover:bg-slate-50 border border-slate-200/90 shadow-xs transition-colors cursor-pointer shrink-0"
                  >
                    <span className="w-6 h-6 rounded-full overflow-hidden bg-slate-200 shrink-0">
                      <img
                        src={peerAvatar}
                        alt={peerLabel}
                        referrerPolicy="no-referrer"
                        className={`w-full h-full ${getPhotoCropClassName(peerAvatar)}`}
                      />
                    </span>
                    <span className="text-[11px] font-semibold text-slate-800 whitespace-nowrap max-w-[90px] truncate">
                      {peerLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Composer Card (inZOI Frosted Pearl Card) */}
        <div
          data-city-feed-composer="true"
          className="rounded-2xl bg-[#eef0f4]/92 border border-white/80 shadow-[0_8px_22px_rgba(15,23,42,0.16)] p-3 space-y-2.5 text-slate-900"
        >
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 border border-white shadow-xs shrink-0">
              <img
                src={selfAvatarUrl}
                alt={cleanSelfName}
                referrerPolicy="no-referrer"
                className={`w-full h-full ${getPhotoCropClassName(selfAvatarUrl)}`}
              />
            </div>

            <div className="flex-1 min-w-0 rounded-xl bg-[#dfe4ec]/85 border border-slate-300/60 px-2.5 py-2">
              <textarea
                rows={2}
                maxLength={220}
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void handlePublish();
                  }
                }}
                placeholder={`Share a moment with players in ${CERRIA_CITY_NAME}...`}
                data-city-feed-input="true"
                className="w-full resize-none bg-transparent text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none leading-snug"
              />
            </div>
          </div>

          {attachedPhotoUrl && (
            <div className="relative w-full h-24 rounded-xl overflow-hidden border border-slate-300/70 bg-slate-200">
              <img
                src={attachedPhotoUrl}
                alt="Attached preview"
                referrerPolicy="no-referrer"
                className={`w-full h-full ${getPhotoCropClassName(attachedPhotoUrl)}`}
              />
              <button
                type="button"
                onClick={() => setAttachedPhotoUrl('')}
                aria-label="Remove attached photo"
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-900/75 hover:bg-slate-900 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Mood selector row */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {FEED_MOODS.map((mood) => {
              const active = selectedMood === mood;
              return (
                <button
                  key={mood}
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setSelectedMood(active ? '' : mood);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-[#dfe4ec]/85 hover:bg-white text-slate-600 hover:text-slate-900 border border-slate-300/55'
                  }`}
                >
                  {mood}
                </button>
              );
            })}
          </div>

          {/* Bottom Composer Action Row */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-300/60">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  setAttachedPhotoUrl((prev) => (prev ? '' : selfCoverUrl));
                }}
                title="Attach your profile cover snapshot"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 shadow-xs text-[10.5px] font-semibold text-slate-700 hover:text-slate-950 cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                <ImageIcon className="w-3.5 h-3.5 stroke-[2]" aria-hidden="true" />
                <span>{attachedPhotoUrl ? 'Clear photo' : 'Snapshot'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  fileInputRef.current?.click();
                }}
                title="Upload image"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 shadow-xs text-[10.5px] font-semibold text-slate-700 hover:text-slate-950 cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                <Camera className="w-3.5 h-3.5 stroke-[2]" aria-hidden="true" />
                <span>Upload</span>
              </button>
            </div>

            <button
              type="button"
              data-city-feed-submit="true"
              disabled={!composerText.trim() || isSubmitting}
              onClick={() => void handlePublish()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300/80 disabled:text-slate-500 text-white font-semibold text-[11px] shadow-xs cursor-pointer disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5 stroke-[2.2]" aria-hidden="true" />
              <span>Post</span>
            </button>
          </div>
        </div>

        {/* Feed Timeline */}
        {isLoading && filteredPosts.length === 0 ? (
          <div className="rounded-2xl bg-[#eef0f4]/90 border border-white/80 py-8 px-4 text-center text-[11.5px] font-medium text-slate-600 shadow-sm">
            Loading player feed...
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="rounded-2xl bg-[#eef0f4]/90 border border-white/80 py-8 px-4 text-center space-y-1 shadow-sm">
            <div className="text-[12px] font-semibold text-slate-900">
              {filterTab === 'following'
                ? socialGraph.following.length === 0
                  ? 'You are not following anyone yet'
                  : 'No City Feed announcements from followed builders yet'
                : filterTab === 'nearby'
                  ? 'No posts from nearby players yet'
                  : filterTab === 'mine'
                    ? 'You have not posted to City Feed yet'
                    : 'No posts in City Feed yet'}
            </div>
            <p className="text-[11px] text-slate-500">
              {filterTab === 'following'
                ? 'Follow builders from their profile card or search results to see what they are building and their announcements here.'
                : `Share what you are doing in ${currentDistrict || 'Central Plaza'} so other players can see and reply.`}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 pb-1">
            {filteredPosts.map((post) => {
              const own = isOwnPost(post);
              const liked = post.likedByIds.includes(selfActorId);
              const likeCount = post.likedByIds.length;
              const commentCount = post.comments.length;
              const authorLabel = simplifyDisplayName(post.authorName);
              const avatarSrc = resolveAuthorPhoto(
                post.authorAvatarUrl,
                post.authorGender,
                authorLabel,
              );
              const isCommentsOpen = openCommentsPostId === post.id;

              return (
                <article
                  key={post.id}
                  data-city-feed-post={post.id}
                  className="rounded-2xl bg-[#eef0f4]/92 border border-white/80 shadow-[0_8px_22px_rgba(15,23,42,0.16)] p-3 space-y-2.5 text-slate-900"
                >
                  {/* Author Header Row */}
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        onOpenPlayerProfile?.(buildTargetUserForPost(post));
                      }}
                      className="flex items-center gap-2.5 min-w-0 text-left group cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-200 border border-white shadow-xs shrink-0">
                        <img
                          src={avatarSrc}
                          alt={authorLabel}
                          referrerPolicy="no-referrer"
                          className={`w-full h-full ${getPhotoCropClassName(avatarSrc)}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-semibold text-slate-900 group-hover:text-sky-700 transition-colors truncate">
                          {authorLabel}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 truncate">
                          <span>{post.authorTeam === 'red' ? 'Red Squad' : 'Blue Squad'}</span>
                          {post.location && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-0.5 truncate">
                                <MapPin className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                                <span className="truncate">{post.location}</span>
                              </span>
                            </>
                          )}
                          {post.mood && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{post.mood}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums shrink-0">
                            {formatRelativeTime(post.createdAtMs, nowMs)}
                          </span>
                        </div>
                      </div>
                    </button>

                    {own && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(post.id)}
                        aria-label="Delete post"
                        title="Delete post"
                        className="w-7 h-7 rounded-full bg-white hover:bg-rose-50 border border-slate-200/80 text-slate-400 hover:text-rose-600 flex items-center justify-center cursor-pointer transition-colors shrink-0 shadow-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5 stroke-[2]" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  {/* Body Text */}
                  <p className="text-[12.5px] text-slate-800 leading-relaxed break-words">
                    {post.text}
                  </p>

                  {/* Optional Attached Image */}
                  {post.photoUrl && !brokenPhotoIds[post.id] && (
                    <div className="w-full h-32 rounded-xl overflow-hidden border border-slate-300/70 bg-slate-200">
                      <img
                        src={post.photoUrl}
                        alt={`${authorLabel} snapshot`}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBrokenPhotoIds((prev) => ({ ...prev, [post.id]: true }))
                        }
                        className={`w-full h-full ${getPhotoCropClassName(post.photoUrl)}`}
                      />
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-300/60">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        data-city-feed-like={post.id}
                        onClick={() => void handleToggleLike(post.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold tabular-nums cursor-pointer transition-colors border shadow-xs ${
                          liked
                            ? 'bg-rose-50 text-rose-600 border-rose-200'
                            : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50 hover:text-slate-950'
                        }`}
                      >
                        <Heart
                          className={`w-3.5 h-3.5 stroke-[2.1] ${
                            liked ? 'fill-rose-500 text-rose-500' : ''
                          }`}
                          aria-hidden="true"
                        />
                        <span>{likeCount}</span>
                      </button>

                      <button
                        type="button"
                        data-city-feed-comment-toggle={post.id}
                        onClick={() => {
                          soundEngine.playUiClick();
                          setOpenCommentsPostId((prev) => (prev === post.id ? null : post.id));
                        }}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold tabular-nums cursor-pointer transition-colors border shadow-xs ${
                          isCommentsOpen
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50 hover:text-slate-950'
                        }`}
                      >
                        <MessageCircle className="w-3.5 h-3.5 stroke-[2.1]" aria-hidden="true" />
                        <span>{commentCount}</span>
                      </button>
                    </div>

                    {!own && onStartWhisper && (
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          onStartWhisper(buildTargetUserForPost(post));
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200/90 shadow-xs text-[10.5px] font-semibold text-slate-700 hover:text-slate-950 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                      >
                        <Send className="w-3 h-3 stroke-[2]" aria-hidden="true" />
                        <span>Whisper</span>
                      </button>
                    )}
                  </div>

                  {/* Expandable Comments Section */}
                  {isCommentsOpen && (
                    <div className="pt-2 border-t border-slate-300/60 space-y-2">
                      {post.comments.length > 0 ? (
                        <div className="space-y-1.5">
                          {post.comments.map((c) => {
                            const cAvatar = resolveAuthorPhoto(
                              c.authorAvatarUrl,
                              'male',
                              c.authorName,
                            );
                            return (
                              <div
                                key={c.id}
                                className="flex items-start gap-2 rounded-xl bg-[#dfe4ec]/85 border border-slate-300/55 px-2.5 py-1.5"
                              >
                                <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-200 shrink-0 mt-0.5">
                                  <img
                                    src={cAvatar}
                                    alt={c.authorName}
                                    referrerPolicy="no-referrer"
                                    className={`w-full h-full ${getPhotoCropClassName(cAvatar)}`}
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 text-[10.5px]">
                                    <span className="font-semibold text-slate-900 truncate">
                                      {simplifyDisplayName(c.authorName)}
                                    </span>
                                    <span className="text-slate-400 tabular-nums shrink-0">
                                      {formatRelativeTime(c.createdAtMs, nowMs)}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-700 break-words leading-snug">
                                    {c.text}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-[10.5px] text-slate-500 px-1">
                          No replies yet.
                        </div>
                      )}

                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          maxLength={160}
                          value={commentDrafts[post.id] || ''}
                          onChange={(e) =>
                            setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void handleSubmitComment(post.id);
                            }
                          }}
                          placeholder="Write a reply..."
                          className="flex-1 min-w-0 rounded-xl bg-white border border-slate-200/90 px-2.5 py-1.5 text-[11px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                        />
                        <button
                          type="button"
                          disabled={!(commentDrafts[post.id] || '').trim()}
                          onClick={() => void handleSubmitComment(post.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300/80 disabled:text-slate-500 text-white font-semibold text-[10.5px] cursor-pointer disabled:cursor-not-allowed transition-colors shrink-0"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
