import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Check,
  Clock,
  Globe,
  Mail,
  MailOpen,
  MessageCircle,
  Reply,
  Search,
  Send,
  Settings,
  UserPlus,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import {
  createLetterForAccount,
  fetchLettersForAccount,
  markLetterRead,
  searchPlayerProfiles,
  updateLetterDecision,
  type BuddiesLetter,
  type BuddiesLetterDecisionState,
  type SearchedPlayerProfile,
} from '../lib/supabaseClient';
import {
  canReplyToLetter,
  formatReplySubject,
  getLetterDecisionCopy,
  getLetterKindLabel,
  getLetterListRowState,
  getLetterReplyRecipientAccount,
  getLetterSenderDisplayName,
  hasLetterDecisionCard,
  letterNeedsAnswer,
} from '../lib/lettersRules';
import { CERRIA_CITY_NAME } from '../lib/cerriaBrand';
import { getNearBlocksTxUrl } from '../lib/nearClient';
import {
  mergeRealtimeSocialChatMessage,
  resolveBubbleStyle,
} from '../game/buddiesRemotePresenceSync';
import { RoleBadgeCircle } from './RoleBadgeCircle';
import {
  getPlayerRoleBadgeSpec,
  type PlayerRoleBadgeId,
} from '../game/buddiesProfileIdentity';
import {
  DEFAULT_GRAPHICS_QUALITY,
  GRAPHICS_QUALITY_OPTIONS,
  type GraphicsQualityPreset,
} from '../game/buddiesGraphicsSettings';
import {
  APARTMENT_VISIT_PERMISSION_OPTIONS,
  canSendPrivateMessageTo,
  DEFAULT_PLAYER_PRIVACY_SETTINGS,
  isPlayerBlocked,
  normalizePlayerPrivacyKey,
  PRIVATE_MESSAGE_PERMISSION_OPTIONS,
  type ApartmentVisitPermission,
  type PlayerPrivacySettings,
  type PrivateMessagePermission,
} from '../game/buddiesPrivacySettings';
import {
  canShowAddFriendAction,
  DEFAULT_PLAYER_SOCIAL_GRAPH,
  hasPendingOutgoingFriendRequest,
  isFollowingPlayer,
  isFriendWith,
  type PlayerSocialGraph,
} from '../game/buddiesSocialGraph';
import {
  resolveProfileDockActions,
  resolvePublicChatSenderAction,
} from '../game/publicChatNameTap';

export interface NearbyEntityUser {
  id: number | string;
  nearAccountId?: string;
  name: string;
  distance: number;
  isNpc?: boolean;
  isMerchant?: boolean;
  merchantLocation?: 'lobby_cafe' | 'beach_house';
  gender?: 'male' | 'female';
  isSelf?: boolean;
  team?: 'red' | 'blue';
  status?: string;
  roleBadge?: PlayerRoleBadgeId;
  buildingProject?: string;
  socialX?: string;
  socialGithub?: string;
  socialWebsite?: string;
  appearOnline?: boolean;
  allowFriendRequests?: boolean;
  privateMessages?: PrivateMessagePermission;
  apartmentVisits?: ApartmentVisitPermission;
  showWalletAddressOnProfile?: boolean;
  showThingsOnProfile?: boolean;
}

export interface ChatMessage {
  id: string;
  clientMsgId?: string;
  senderId?: string;
  senderName: string;
  recipientId?: string;
  recipientName?: string;
  isSelf?: boolean;
  text: string;
  timestamp: string;
  createdAtMs?: number;
  bubbleBgColor?: string;
  bubbleTextColor?: string;
  type: 'public' | 'private';
}

interface SocialChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  playerUid?: string | null;
  onChangePlayerName?: (newName: string) => void;
  nearbyUsers: NearbyEntityUser[];
  selectedPrivateUser: NearbyEntityUser | null;
  onSelectPrivateUser: (user: NearbyEntityUser | null) => void;
  chatMessages: ChatMessage[];
  onSendPublicChat: (text: string) => void;
  onSendPrivateChat: (recipient: NearbyEntityUser, text: string) => void;
  playerBubbleBgColor?: string;
  playerBubbleTextColor?: string;
  onChangeBubbleBgColor?: (hex: string) => void;
  onChangeBubbleTextColor?: (hex: string) => void;
  isInsidePrivateHouse?: boolean;
  onOpenHouseDecoration?: () => void;
  isMuted?: boolean;
  audioVolumePct?: number;
  onToggleAudio?: () => void;
  onChangeVolumePct?: (pct: number) => void;
  showJoystickOnDesktop?: boolean;
  onToggleShowJoystickOnDesktop?: () => void;
  graphicsQuality?: GraphicsQualityPreset;
  onChangeGraphicsQuality?: (preset: GraphicsQualityPreset) => void;
  privacySettings?: PlayerPrivacySettings;
  onUpdatePrivacySettings?: (patch: Partial<PlayerPrivacySettings>) => void;
  onUnblockPlayer?: (targetIdOrName: string) => void;
  connectedAccountEmail?: string;
  onLogOut?: () => void;
  unreadPrivateCount?: number;
  onClearUnreadPrivate?: () => void;
  kaiRawFishCount?: number;
  kaiHasMet?: boolean;
  onCallKai?: () => void;
  onMeetKai?: () => void;
  embeddedInPhone?: boolean;
  initialTab?: SocialChatSubTab;
  lockedTab?: SocialChatSubTab;
  onSwitchPhoneApp?: (app: 'contacts' | 'messages') => void;
  onUnreadLettersCountChange?: (count: number) => void;
  onLettersLoaded?: (letters: BuddiesLetter[]) => void;
  onAcceptTradeOfferLetter?: (letter: BuddiesLetter) => Promise<boolean> | boolean;
  onAcceptFriendRequestLetter?: (letter: BuddiesLetter) => Promise<boolean> | boolean;
  socialGraph?: PlayerSocialGraph;
  onSendFriendRequest?: (
    user: NearbyEntityUser,
  ) => Promise<{ ok: boolean; reason?: string }> | { ok: boolean; reason?: string };
  onRemoveFriend?: (targetIdOrName: string) => void;
  onToggleFollowPlayer?: (user: NearbyEntityUser) => void;
  onOpenPlayerProfile?: (user: NearbyEntityUser) => void;
}

export type SocialChatSubTab = 'online' | 'public' | 'private' | 'letters' | 'kai' | 'settings';

const BUBBLE_COLOR_SWATCHES: { bg: string; text: string; label: string }[] = [
  { bg: '#ffffff', text: '#0f172a', label: 'Pure White' },
  { bg: '#fef08a', text: '#0f172a', label: 'Sunny Yellow' },
  { bg: '#bae6fd', text: '#0f172a', label: 'Sky Blue' },
  { bg: '#bbf7d0', text: '#0f172a', label: 'Mint Green' },
  { bg: '#fbcfe8', text: '#0f172a', label: 'Candy Pink' },
  { bg: '#0f172a', text: '#f8fafc', label: 'Midnight Dark' },
];

const KNOWN_NPC_NAMES = new Set(['hana', 'kai', 'merchant hana', 'merchant kai']);

export function simplifyDisplayName(rawName: string): string {
  const cleaned = (rawName || '').replace(/\s*\((ANDA|YOU|KAMU)\)/gi, '').trim();
  const parts = cleaned.split(/\s*[—–-]\s*/);
  return (parts[0] || cleaned).trim();
}

export function isRealHumanWhisperTarget(
  user: NearbyEntityUser | null | undefined,
  localPlayerName?: string,
  localPlayerUid?: string | null,
): user is NearbyEntityUser {
  if (!user) return false;
  if (user.isNpc || user.isSelf) return false;
  const idStr = String(user.id || '').trim().toLowerCase();
  if (!idStr || idStr === '0' || idStr.startsWith('npc')) return false;

  const cleanName = simplifyDisplayName(user.name).toLowerCase();
  if (!cleanName || KNOWN_NPC_NAMES.has(cleanName)) return false;
  if (cleanName === 'you' || cleanName === 'anda' || cleanName === 'kamu') return false;

  if (localPlayerUid && idStr === localPlayerUid.trim().toLowerCase()) {
    return false;
  }
  if (localPlayerName) {
    const cleanLocal = simplifyDisplayName(localPlayerName).toLowerCase();
    if (cleanLocal && cleanName === cleanLocal) {
      return false;
    }
  }
  return true;
}

export function filterRealHumanOnlinePlayers(
  nearbyUsers: NearbyEntityUser[],
  localPlayerName?: string,
  localPlayerUid?: string | null,
): NearbyEntityUser[] {
  const seenIds = new Set<string>();
  const result: NearbyEntityUser[] = [];
  for (const user of nearbyUsers) {
    if (user.appearOnline === false) continue;
    if (!isRealHumanWhisperTarget(user, localPlayerName, localPlayerUid)) continue;
    const key = String(user.id).toLowerCase();
    if (seenIds.has(key)) continue;
    seenIds.add(key);
    result.push(user);
  }
  return result;
}

export function isOwnChatMessage(
  msg: ChatMessage,
  playerName: string,
  playerUid?: string | null,
): boolean {
  if (msg.isSelf) return true;
  if (
    playerUid &&
    msg.senderId &&
    msg.senderId.trim().toLowerCase() === playerUid.trim().toLowerCase()
  ) {
    return true;
  }
  const cleanSender = simplifyDisplayName(msg.senderName).toLowerCase();
  if (cleanSender === 'you' || cleanSender === 'anda' || cleanSender === 'kamu') {
    return true;
  }
  const cleanPlayer = simplifyDisplayName(playerName).toLowerCase();
  if (cleanPlayer && cleanSender === cleanPlayer) {
    return true;
  }
  return false;
}

export function deduplicateChatMessages(
  messages: ChatMessage[],
  playerName: string,
  playerUid?: string | null,
): ChatMessage[] {
  let result: ChatMessage[] = [];
  for (const rawMsg of messages) {
    if (!rawMsg || !rawMsg.id) continue;
    const merged = mergeRealtimeSocialChatMessage(result, rawMsg, {
      localPlayerName: playerName,
      localPlayerUid: playerUid,
      isOwnFn: (m) => isOwnChatMessage(m, playerName, playerUid),
      simplifyNameFn: simplifyDisplayName,
    });
    result = merged.nextMessages;
  }
  return result;
}

/**
 * Evaluates whether an incoming chat message should trigger a notification popup/badge:
 * - Strictly returns `true` ONLY for genuine incoming `private` (whisper) messages from another
 *   real human player addressed to the local player while that sender's private conversation
 *   is not actively open on screen.
 * - NEVER triggers for `public` chat messages, NPC/system messages, or the local player's own outgoing messages.
 */
export function shouldTriggerIncomingPrivateChatNotification(params: {
  msg?: ChatMessage;
  message?: ChatMessage;
  localPlayerName: string;
  localPlayerUid?: string | null;
  isSocialChatModalOpen: boolean;
  activeChatTab?: SocialChatSubTab;
  activeTab?: SocialChatSubTab;
  activePrivateUser?: NearbyEntityUser | null;
  selectedPrivateUser?: NearbyEntityUser | null;
}): boolean {
  const msg = params.msg ?? params.message;
  const { localPlayerName, localPlayerUid, isSocialChatModalOpen } = params;
  const activeChatTab = params.activeChatTab ?? params.activeTab;
  const activePrivateUser = params.activePrivateUser ?? params.selectedPrivateUser;
  if (!msg || msg.type !== 'private') return false;
  if (!msg.text || !msg.text.trim()) return false;
  if (isOwnChatMessage(msg, localPlayerName, localPlayerUid)) return false;

  const cleanSender = simplifyDisplayName(msg.senderName).toLowerCase();
  if (!cleanSender || KNOWN_NPC_NAMES.has(cleanSender) || cleanSender === 'system') {
    return false;
  }
  const senderIdStr = String(msg.senderId || '').trim().toLowerCase();
  if (senderIdStr.startsWith('npc')) return false;

  // Verify the whisper is addressed to the local player if recipient metadata is present
  const cleanRecipientName = simplifyDisplayName(msg.recipientName || '').toLowerCase();
  const recipientIdStr = String(msg.recipientId || '').trim().toLowerCase();
  const cleanLocalName = simplifyDisplayName(localPlayerName).toLowerCase();
  const cleanLocalUid = String(localPlayerUid || '').trim().toLowerCase();

  if (recipientIdStr || cleanRecipientName) {
    const matchesUid = Boolean(cleanLocalUid && recipientIdStr && recipientIdStr === cleanLocalUid);
    const matchesName = Boolean(
      cleanRecipientName &&
        (cleanRecipientName === cleanLocalName ||
          cleanRecipientName === 'you' ||
          cleanRecipientName === 'anda' ||
          cleanRecipientName === 'kamu'),
    );
    if (!matchesUid && !matchesName) {
      return false;
    }
  }

  // Suppress notification if the user already has SocialChatModal open to this sender's PRIVATE thread
  if (isSocialChatModalOpen && (activeChatTab === 'private' || !activeChatTab) && activePrivateUser) {
    const openPeerName = simplifyDisplayName(activePrivateUser.name).toLowerCase();
    const openPeerId = String(activePrivateUser.id || '').trim().toLowerCase();
    if (
      (senderIdStr && openPeerId && senderIdStr === openPeerId) ||
      (cleanSender && openPeerName && cleanSender === openPeerName)
    ) {
      return false;
    }
  }

  return true;
}

export const SocialChatModal: React.FC<SocialChatModalProps> = ({
  isOpen,
  onClose,
  playerName,
  playerUid,
  nearbyUsers,
  selectedPrivateUser,
  onSelectPrivateUser,
  chatMessages,
  onSendPublicChat: _onSendPublicChat,
  onSendPrivateChat: _onSendPrivateChat,
  playerBubbleBgColor = '#ffffff',
  playerBubbleTextColor = '#0f172a',
  onChangeBubbleBgColor,
  onChangeBubbleTextColor,
  isInsidePrivateHouse = false,
  onOpenHouseDecoration,
  isMuted: _isMuted = false,
  audioVolumePct: _audioVolumePct = 80,
  onToggleAudio: _onToggleAudio,
  onChangeVolumePct: _onChangeVolumePct,
  showJoystickOnDesktop = false,
  onToggleShowJoystickOnDesktop,
  graphicsQuality = DEFAULT_GRAPHICS_QUALITY,
  onChangeGraphicsQuality,
  privacySettings = DEFAULT_PLAYER_PRIVACY_SETTINGS,
  onUpdatePrivacySettings,
  onUnblockPlayer,
  connectedAccountEmail = '',
  onLogOut,
  unreadPrivateCount = 0,
  onClearUnreadPrivate,
  kaiRawFishCount = 0,
  kaiHasMet: _kaiHasMet = false,
  onCallKai,
  onMeetKai,
  embeddedInPhone = false,
  initialTab,
  lockedTab,
  onSwitchPhoneApp,
  onUnreadLettersCountChange,
  onLettersLoaded,
  onAcceptTradeOfferLetter,
  onAcceptFriendRequestLetter,
  socialGraph = DEFAULT_PLAYER_SOCIAL_GRAPH,
  onSendFriendRequest,
  onRemoveFriend,
  onToggleFollowPlayer,
  onOpenPlayerProfile,
}) => {
  const [activeTab, setActiveTab] = useState<SocialChatSubTab>(lockedTab ?? initialTab ?? 'public');
  const effectiveTab: SocialChatSubTab = lockedTab ?? activeTab;
  const isStandaloneGlassChat = !embeddedInPhone;
  const isPhoneGlassMode = Boolean((embeddedInPhone && lockedTab) || isStandaloneGlassChat);
  const [letters, setLetters] = useState<BuddiesLetter[]>([]);
  const [openLetter, setOpenLetter] = useState<BuddiesLetter | null>(null);
  const [isReplyComposerOpen, setIsReplyComposerOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');
  const [replyStatus, setReplyStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [decisionBusyId, setDecisionBusyId] = useState<string | null>(null);
  const [decisionNotice, setDecisionNotice] = useState<string | null>(null);
  const [peopleSearchQuery, setPeopleSearchQuery] = useState<string>('');
  const [peopleSearchResults, setPeopleSearchResults] = useState<SearchedPlayerProfile[]>([]);
  const [isSearchingPeople, setIsSearchingPeople] = useState<boolean>(false);
  const [friendRequestStatusMsg, setFriendRequestStatusMsg] = useState<string | null>(null);
  const [publicChatProfileDockUser, setPublicChatProfileDockUser] =
    useState<NearbyEntityUser | null>(null);
  const lettersUnreadCount = letters.filter((l) => !l.isRead).length;
  const lettersNeedsAnswerCount = letters.filter((l) => letterNeedsAnswer(l)).length;

  useEffect(() => {
    if (isOpen && (lockedTab || initialTab)) {
      setActiveTab(lockedTab ?? initialTab ?? 'public');
    }
  }, [isOpen, initialTab, lockedTab]);

  useEffect(() => {
    if (!isOpen) return;
    const account = (playerUid ?? '').trim().toLowerCase();
    if (account.length < 2) return;
    let cancelled = false;
    void fetchLettersForAccount(account).then((rows) => {
      if (!cancelled) {
        setLetters(rows);
        onUnreadLettersCountChange?.(rows.filter((l) => !l.isRead).length);
        onLettersLoaded?.(rows);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, playerUid, effectiveTab]);

  useEffect(() => {
    if (effectiveTab !== 'letters') setOpenLetter(null);
  }, [effectiveTab]);

  useEffect(() => {
    setIsReplyComposerOpen(false);
    setReplyDraft('');
    setReplyStatus('idle');
    setDecisionNotice(null);
  }, [openLetter?.id]);

  const handleOpenLetter = (letter: BuddiesLetter) => {
    soundEngine.playUiClick();
    const opened: BuddiesLetter = letter.isRead ? letter : { ...letter, isRead: true };
    setOpenLetter(opened);
    if (!letter.isRead) {
      setLetters((prev) => {
        const next = prev.map((l) => (l.id === letter.id ? { ...l, isRead: true } : l));
        onUnreadLettersCountChange?.(next.filter((l) => !l.isRead).length);
        return next;
      });
      void markLetterRead(letter.id);
    }
  };

  const handleLetterDecision = async (
    letter: BuddiesLetter,
    decision: Exclude<BuddiesLetterDecisionState, 'pending'>,
  ) => {
    if (!hasLetterDecisionCard(letter.kind) || decisionBusyId === letter.id) return;
    soundEngine.playUiClick();
    setDecisionBusyId(letter.id);
    setDecisionNotice(null);
    try {
      if (decision === 'accepted' && letter.kind === 'trade_offer') {
        if (!onAcceptTradeOfferLetter) {
          setDecisionNotice('This trade offer cannot be completed from here right now.');
          return;
        }
        const ok = await onAcceptTradeOfferLetter(letter);
        if (!ok) {
          setDecisionNotice('Trade was not completed. You can try again or decline.');
          return;
        }
      } else if (decision === 'accepted' && letter.kind === 'friend_request' && onAcceptFriendRequestLetter) {
        const ok = await onAcceptFriendRequestLetter(letter);
        if (!ok) {
          setDecisionNotice('Could not complete the friend request right now.');
          return;
        }
      }

      const saved = await updateLetterDecision(letter.id, decision, letter.payload);
      if (!saved) {
        setDecisionNotice('Could not save your answer right now. Please try again.');
        return;
      }

      const updatedPayload = {
        ...letter.payload,
        decisionState: decision,
        decisionUpdatedAt: new Date().toISOString(),
      };
      setLetters((prev) => {
        const next = prev.map((l) =>
          l.id === letter.id
            ? { ...l, isRead: true, decisionState: decision, payload: updatedPayload }
            : l,
        );
        onUnreadLettersCountChange?.(next.filter((l) => !l.isRead).length);
        return next;
      });
      setOpenLetter((prev) =>
        prev && prev.id === letter.id
          ? { ...prev, isRead: true, decisionState: decision, payload: updatedPayload }
          : prev,
      );
    } finally {
      setDecisionBusyId(null);
    }
  };

  const handleSendLetterReply = async () => {
    if (!openLetter || !canReplyToLetter(openLetter)) return;
    const recipientAccount = getLetterReplyRecipientAccount(openLetter);
    const trimmedBody = replyDraft.trim();
    if (!recipientAccount || !trimmedBody) return;
    soundEngine.playUiClick();
    setReplyStatus('sending');
    const senderAccount = (playerUid ?? '').trim().toLowerCase() || undefined;
    const ok = await createLetterForAccount({
      recipientAccount,
      kind: 'message',
      title: formatReplySubject(openLetter.title),
      payload: {
        senderName: simplifyDisplayName(playerName) || 'Cerria Citizen',
        senderAccount,
        body: trimmedBody,
        replyToLetterId: openLetter.id,
        replyToSubject: openLetter.title,
      },
    });
    if (ok) {
      setReplyDraft('');
      setIsReplyComposerOpen(false);
      setReplyStatus('sent');
    } else {
      setReplyStatus('error');
    }
  };
  const publicEndRef = useRef<HTMLDivElement | null>(null);
  const privateEndRef = useRef<HTMLDivElement | null>(null);

  const realHumanOnlinePeers = useMemo(
    () => filterRealHumanOnlinePlayers(nearbyUsers, playerName, playerUid),
    [nearbyUsers, playerName, playerUid],
  );

  // Debounced player search by name or NEAR handle (merges live peers + Supabase bb_profiles)
  useEffect(() => {
    const q = peopleSearchQuery.trim();
    if (!isOpen || (effectiveTab !== 'online' && effectiveTab !== 'private') || q.length < 1) {
      setPeopleSearchResults([]);
      setIsSearchingPeople(false);
      return;
    }
    let cancelled = false;
    setIsSearchingPeople(true);
    const timer = window.setTimeout(() => {
      void searchPlayerProfiles(q, 15).then((rows) => {
        if (!cancelled) {
          setPeopleSearchResults(rows);
          setIsSearchingPeople(false);
        }
      });
    }, 240);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [peopleSearchQuery, isOpen, effectiveTab]);

  const mergedPeopleSearchMatches = useMemo((): NearbyEntityUser[] => {
    const q = peopleSearchQuery.trim().toLowerCase();
    if (!q) return [];
    const selfKey = normalizePlayerPrivacyKey(playerUid);
    const selfNameKey = normalizePlayerPrivacyKey(playerName);
    const byKey = new Map<string, NearbyEntityUser>();

    for (const peer of realHumanOnlinePeers) {
      const peerId = String(peer.nearAccountId || peer.id || '').toLowerCase();
      const peerName = simplifyDisplayName(peer.name).toLowerCase();
      if (peerName.includes(q) || peerId.includes(q)) {
        byKey.set(peerId || peerName, peer);
      }
    }

    for (const profile of peopleSearchResults) {
      const acc = normalizePlayerPrivacyKey(profile.nearAccountId);
      const disp = normalizePlayerPrivacyKey(profile.displayName);
      if (!acc || (selfKey && acc === selfKey) || (selfNameKey && disp === selfNameKey && !selfKey)) {
        continue;
      }
      if (!byKey.has(acc)) {
        byKey.set(acc, {
          id: profile.nearAccountId,
          nearAccountId: profile.nearAccountId,
          name: profile.displayName,
          distance: 999,
          isNpc: false,
          roleBadge: profile.roleBadge,
          buildingProject: profile.buildingProject,
          socialX: profile.socialX,
          socialGithub: profile.socialGithub,
          socialWebsite: profile.socialWebsite,
          allowFriendRequests: profile.allowFriendRequests,
          privateMessages: profile.privateMessages,
          apartmentVisits: profile.apartmentVisits,
          showWalletAddressOnProfile: profile.showWalletAddressOnProfile,
          showThingsOnProfile: profile.showThingsOnProfile,
        });
      }
    }
    return Array.from(byKey.values());
  }, [peopleSearchQuery, realHumanOnlinePeers, peopleSearchResults, playerUid, playerName]);

  const triggerSendFriendRequest = async (target: NearbyEntityUser) => {
    if (!onSendFriendRequest) return;
    soundEngine.playUiClick();
    setFriendRequestStatusMsg(null);
    const res = await onSendFriendRequest(target);
    if (!res.ok && res.reason) {
      setFriendRequestStatusMsg(res.reason);
    }
  };

  const renderPeopleSearchBox = () => (
    <div className="mb-2.5 space-y-1.5 shrink-0">
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border ${
          isPhoneGlassMode
            ? 'bg-white/[0.1] border-white/18 text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <Search
          className={`w-3.5 h-3.5 shrink-0 ${isPhoneGlassMode ? 'text-white/60' : 'text-slate-400'}`}
          aria-hidden="true"
        />
        <input
          type="text"
          data-people-search-input="true"
          value={peopleSearchQuery}
          onChange={(e) => {
            setPeopleSearchQuery(e.target.value);
            setFriendRequestStatusMsg(null);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Search by player name or handle..."
          className={`flex-1 min-w-0 bg-transparent text-[11.5px] font-medium focus:outline-none ${
            isPhoneGlassMode ? 'text-white placeholder:text-white/50' : 'text-slate-900 placeholder:text-slate-400'
          }`}
        />
        {peopleSearchQuery && (
          <button
            type="button"
            onClick={() => {
              setPeopleSearchQuery('');
              setFriendRequestStatusMsg(null);
            }}
            aria-label="Clear search"
            className={`p-0.5 rounded-full cursor-pointer ${
              isPhoneGlassMode ? 'text-white/60 hover:text-white' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <X className="w-3 h-3" aria-hidden="true" />
          </button>
        )}
      </div>

      {friendRequestStatusMsg && (
        <div className="px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-300/35 text-amber-100 text-[10.5px] font-medium">
          {friendRequestStatusMsg}
        </div>
      )}

      {peopleSearchQuery.trim().length > 0 && (
        <div
          data-people-search-results="true"
          className={`rounded-2xl border p-2 space-y-1.5 max-h-48 overflow-y-auto ${
            isPhoneGlassMode
              ? 'bg-white/[0.08] border-white/16'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between px-1">
            <span
              className={`text-[10px] font-semibold uppercase tracking-wide ${
                isPhoneGlassMode ? 'text-white/60' : 'text-slate-500'
              }`}
            >
              Search results
            </span>
            {isSearchingPeople && (
              <span className={`text-[10px] ${isPhoneGlassMode ? 'text-white/50' : 'text-slate-400'}`}>
                Searching...
              </span>
            )}
          </div>
          {mergedPeopleSearchMatches.length === 0 && !isSearchingPeople ? (
            <div
              className={`px-2 py-2 text-[11px] text-center ${
                isPhoneGlassMode ? 'text-white/60' : 'text-slate-500'
              }`}
            >
              No players found matching &ldquo;{peopleSearchQuery.trim()}&rdquo;.
            </div>
          ) : (
            mergedPeopleSearchMatches.map((match) => {
              const matchId = match.nearAccountId || match.id;
              const matchCleanName = simplifyDisplayName(match.name);
              const isBlocked = isPlayerBlocked(privacySettings.blockedPlayers, matchId, matchCleanName);
              const isFriend = isFriendWith(socialGraph, matchId, matchCleanName);
              const isFollowing = isFollowingPlayer(socialGraph, matchId, matchCleanName);
              const isPending = hasPendingOutgoingFriendRequest(socialGraph, matchId, matchCleanName);
              const canAddFriend = canShowAddFriendAction({
                isSelf: match.isSelf,
                isNpc: match.isNpc,
                isBlocked,
                isFriend,
                allowFriendRequests: match.allowFriendRequests,
              });
              return (
                <div
                  key={String(matchId)}
                  data-people-search-row={String(matchId)}
                  className="p-2 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-2 text-slate-900"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenPlayerProfile) {
                        soundEngine.playUiClick();
                        onOpenPlayerProfile(match);
                      }
                    }}
                    className="flex items-center gap-2 min-w-0 text-left cursor-pointer"
                  >
                    <RoleBadgeCircle roleId={match.roleBadge} size="xs" />
                    <div className="min-w-0">
                      <div className="text-[11.5px] font-semibold text-slate-900 truncate flex items-center gap-1">
                        <span className="truncate">{matchCleanName}</span>
                        {isFriend && (
                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-semibold shrink-0">
                            Friend
                          </span>
                        )}
                      </div>
                      {match.showWalletAddressOnProfile !== false && match.nearAccountId && (
                        <div className="text-[10px] font-mono text-slate-500 truncate">
                          {match.nearAccountId}
                        </div>
                      )}
                      {match.buildingProject && (
                        <div className="text-[10px] text-slate-600 truncate">
                          Building — {match.buildingProject}
                        </div>
                      )}
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    {canAddFriend && onSendFriendRequest && (
                      <button
                        type="button"
                        data-search-add-friend-btn={String(matchId)}
                        disabled={isPending}
                        onClick={() => void triggerSendFriendRequest(match)}
                        className={`px-2 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                          isPending
                            ? 'bg-slate-200 text-slate-500 cursor-default'
                            : 'bg-indigo-500 hover:bg-indigo-600 text-white cursor-pointer'
                        }`}
                      >
                        {isPending ? 'Sent' : 'Add Friend'}
                      </button>
                    )}
                    {!isBlocked && onToggleFollowPlayer && (
                      <button
                        type="button"
                        data-search-follow-btn={String(matchId)}
                        onClick={() => {
                          soundEngine.playUiClick();
                          onToggleFollowPlayer(match);
                        }}
                        className={`px-2 py-1 rounded-full text-[10px] font-semibold border transition-colors cursor-pointer ${
                          isFollowing
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                      >
                        {isFollowing ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );

  const validSelectedPrivateUser = useMemo(
    () =>
      isRealHumanWhisperTarget(selectedPrivateUser, playerName, playerUid)
        ? selectedPrivateUser
        : null,
    [selectedPrivateUser, playerName, playerUid],
  );

  const normalizedMessages = useMemo(
    () => deduplicateChatMessages(chatMessages, playerName, playerUid),
    [chatMessages, playerName, playerUid],
  );

  useEffect(() => {
    if (selectedPrivateUser && !isRealHumanWhisperTarget(selectedPrivateUser, playerName, playerUid)) {
      onSelectPrivateUser(null);
    } else if (validSelectedPrivateUser && isOpen && !lockedTab) {
      setActiveTab('private');
      onClearUnreadPrivate?.();
    }
  }, [
    selectedPrivateUser,
    validSelectedPrivateUser,
    isOpen,
    lockedTab,
    playerName,
    playerUid,
    onSelectPrivateUser,
    onClearUnreadPrivate,
  ]);

  useEffect(() => {
    if (isOpen && effectiveTab === 'private') {
      onClearUnreadPrivate?.();
    }
  }, [isOpen, effectiveTab, onClearUnreadPrivate]);

  useEffect(() => {
    if (isOpen) {
      publicEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      privateEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [normalizedMessages.length, isOpen, effectiveTab]);

  const publicMessages = useMemo(
    () => normalizedMessages.filter((m) => m.type === 'public'),
    [normalizedMessages],
  );

  const privateMessages = useMemo(() => {
    if (!validSelectedPrivateUser) return [];
    const targetCleanName = simplifyDisplayName(validSelectedPrivateUser.name).toLowerCase();
    const targetIdStr = String(validSelectedPrivateUser.id).toLowerCase();

    return normalizedMessages.filter((m) => {
      if (m.type !== 'private') return false;
      if (m.isSelf) {
        if (m.recipientId && String(m.recipientId).toLowerCase() === targetIdStr) return true;
        return simplifyDisplayName(m.recipientName || '').toLowerCase() === targetCleanName;
      }
      if (m.senderId && String(m.senderId).toLowerCase() === targetIdStr) return true;
      return simplifyDisplayName(m.senderName).toLowerCase() === targetCleanName;
    });
  }, [normalizedMessages, validSelectedPrivateUser]);

  if (embeddedInPhone && !isOpen) {
    return null;
  }

  const lockedHeaderMeta: Record<
    SocialChatSubTab,
    { title: string; subtitle: string; icon: React.ReactNode; badgeBg: string }
  > = {
    online: {
      title: 'Online Players',
      subtitle: 'Connected citizens in zone',
      icon: <Users className="w-3.5 h-3.5 text-white stroke-[2.2]" aria-hidden="true" />,
      badgeBg: 'from-lime-400 to-emerald-500',
    },
    public: {
      title: 'Public Chat',
      subtitle: 'All citizens room feed',
      icon: <Globe className="w-3.5 h-3.5 text-white stroke-[2.2]" aria-hidden="true" />,
      badgeBg: 'from-rose-400 to-pink-600',
    },
    private: {
      title: validSelectedPrivateUser
        ? simplifyDisplayName(validSelectedPrivateUser.name)
        : 'Private Messages',
      subtitle: validSelectedPrivateUser
        ? 'Private Whisper'
        : 'Direct whispers',
      icon: <MessageCircle className="w-3.5 h-3.5 text-white stroke-[2.2]" aria-hidden="true" />,
      badgeBg: 'from-sky-400 to-blue-500',
    },
    letters: {
      title: 'Letters',
      subtitle: 'Official city inbox',
      icon: (
        <img
          src="/assets/aistudio/writing_2593648_9a87d6fe.png"
          alt=""
          className="w-4 h-4 object-contain"
          draggable={false}
        />
      ),
      badgeBg: 'from-amber-50 to-orange-100',
    },
    settings: {
      title: 'Settings',
      subtitle: 'Chat bubble, audio & controls',
      icon: <Settings className="w-3.5 h-3.5 text-white stroke-[2.2]" aria-hidden="true" />,
      badgeBg: 'from-slate-500 to-zinc-700',
    },
    kai: {
      title: 'Kai',
      subtitle: 'East Beach fish merchant',
      icon: <MessageCircle className="w-3.5 h-3.5 text-white stroke-[2.2]" aria-hidden="true" />,
      badgeBg: 'from-sky-500 to-teal-400',
    },
  };

  const activeStandaloneHeaderMeta = lockedHeaderMeta[effectiveTab];
  const standalonePeerPortraitUrl = validSelectedPrivateUser
    ? validSelectedPrivateUser.gender === 'female' ||
      simplifyDisplayName(validSelectedPrivateUser.name).toLowerCase().includes('nadia') ||
      simplifyDisplayName(validSelectedPrivateUser.name).toLowerCase().includes('hana')
      ? '/assets/avatar_nadia.jpg'
      : '/assets/avatar_hiro.jpg'
    : null;

  const innerPanel = (
      <div
        className={
          isStandaloneGlassChat
            ? 'relative h-full rounded-[32px] bg-gradient-to-b from-[#171d2c]/86 via-[#111622]/84 to-[#0c101a]/88 border border-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_24px_70px_rgba(0,0,0,0.58)] text-white flex flex-col overflow-hidden'
            : isPhoneGlassMode
              ? 'relative w-full h-full bg-transparent text-white flex flex-col overflow-hidden'
              : embeddedInPhone
                ? 'relative w-full h-full bg-white text-slate-900 flex flex-col overflow-hidden'
                : 'relative h-full rounded-[28px] bg-white/96 backdrop-blur-2xl border border-white/80 shadow-[0_24px_64px_rgba(15,23,42,0.28)] text-slate-900 flex flex-col overflow-hidden'
        }
      >
        {/* TOP BAR: Unified dark glass header with Close X for standalone player chat, or locked app header in Smartphone OS */}
        {isStandaloneGlassChat ? (
          <>
            <div className="shrink-0 flex items-center justify-between text-[10.5px] font-medium px-4 pt-3 pb-1.5 text-white/90">
              <div className="flex items-center gap-1.5">
                <Wifi className="w-3 h-3 text-white/85" aria-hidden="true" />
                <span className="tracking-wide font-semibold">CERRIA OS</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onClose();
                }}
                aria-label="Close Chat"
                title="Close"
                className="w-6 h-6 rounded-full flex items-center justify-center border bg-white/12 hover:bg-rose-500/35 border-white/20 text-white/90 hover:text-white cursor-pointer active:scale-90 transition-all shrink-0"
              >
                <X className="w-3.5 h-3.5 stroke-[2.3]" aria-hidden="true" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2.5 border-b border-white/12 bg-transparent px-3.5 py-2 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                {effectiveTab === 'private' && standalonePeerPortraitUrl ? (
                  <img
                    src={standalonePeerPortraitUrl}
                    alt={activeStandaloneHeaderMeta.title}
                    draggable={false}
                    className="w-8 h-8 rounded-full object-cover object-top ring-1 ring-white/25 shrink-0"
                  />
                ) : (
                  <span
                    className={`w-7 h-7 rounded-xl bg-gradient-to-br ${activeStandaloneHeaderMeta.badgeBg} shadow-sm flex items-center justify-center shrink-0`}
                  >
                    {activeStandaloneHeaderMeta.icon}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white leading-tight truncate">
                    {activeStandaloneHeaderMeta.title}
                  </div>
                  <div className="text-[10px] text-white/65 leading-tight truncate">
                    {activeStandaloneHeaderMeta.subtitle}
                  </div>
                </div>
              </div>
              {effectiveTab === 'private' && validSelectedPrivateUser && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)] shrink-0" />
              )}
              {effectiveTab === 'public' && (
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/75 border border-white/12 text-[9.5px] font-medium shrink-0">
                  Live bubble
                </span>
              )}
            </div>
          </>
        ) : isPhoneGlassMode && lockedTab ? (
          <div className="flex items-center justify-between gap-2.5 border-b border-white/12 bg-transparent px-3.5 py-2.5 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`w-7 h-7 rounded-xl bg-gradient-to-br ${lockedHeaderMeta[lockedTab].badgeBg} shadow-sm flex items-center justify-center shrink-0`}
              >
                {lockedHeaderMeta[lockedTab].icon}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white leading-tight truncate">
                  {lockedHeaderMeta[lockedTab].title}
                </div>
                <div className="text-[10px] text-white/65 leading-tight truncate">
                  {lockedHeaderMeta[lockedTab].subtitle}
                </div>
              </div>
            </div>
            {lockedTab === 'online' && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-300/25 text-[10px] font-semibold shrink-0">
                {realHumanOnlinePeers.length} {realHumanOnlinePeers.length === 1 ? 'peer' : 'peers'}
              </span>
            )}
            {lockedTab === 'public' && (
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/75 border border-white/12 text-[9.5px] font-medium shrink-0">
                Live bubble
              </span>
            )}
            {lockedTab === 'letters' && lettersUnreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-semibold shrink-0">
                {lettersUnreadCount} new
              </span>
            )}
          </div>
        ) : (
          <div
            className={`flex items-center justify-between gap-2 border-b border-slate-200/80 bg-white/90 shrink-0 ${
              embeddedInPhone ? 'px-3 py-2.5' : 'px-4 pt-3.5 pb-3'
            }`}
          >
            <div className={`flex items-center flex-wrap min-w-0 ${embeddedInPhone ? 'gap-1' : 'gap-1.5'}`}>
              {(
                [
                  { id: 'online', label: 'Online' },
                  { id: 'public', label: 'Public' },
                  { id: 'private', label: 'Private' },
                  { id: 'letters', label: 'Letters' },
                  { id: 'settings', label: 'Settings' },
                ] as { id: SocialChatSubTab; label: string }[]
              ).map((tab) => {
                const active = effectiveTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    data-social-tab={tab.id}
                    onClick={() => {
                      soundEngine.playUiClick();
                      setActiveTab(tab.id);
                      if (tab.id === 'private') {
                        onClearUnreadPrivate?.();
                      }
                    }}
                    className={`relative rounded-full font-semibold cursor-pointer transition-all ${
                      embeddedInPhone ? 'px-2.5 py-1 text-[10.5px]' : 'px-3 py-1.5 text-[11px]'
                    } ${
                      active
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.id === 'private' && unreadPrivateCount > 0 && (
                      <span
                        data-private-tab-unread-dot="true"
                        className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 ring-2 ring-white text-white text-[9px] font-bold flex items-center justify-center"
                      >
                        {unreadPrivateCount}
                      </span>
                    )}
                    {tab.id === 'letters' && lettersUnreadCount > 0 && (
                      <span
                        data-letters-tab-unread-dot="true"
                        className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 ring-2 ring-white text-white text-[9px] font-bold flex items-center justify-center"
                      >
                        {lettersUnreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {!embeddedInPhone && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onClose();
                }}
                aria-label="Close Social Chat"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200/80 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
              >
                <X className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {/* SUB-TAB BODY CONTENT */}
        <div
          className={`relative flex-1 flex flex-col min-h-0 overflow-hidden ${
            isPhoneGlassMode
              ? 'bg-transparent px-3.5 py-3'
              : `bg-[#f2f4f8] ${embeddedInPhone ? 'px-3 py-2.5' : 'px-3.5 py-3'}`
          }`}
        >
          {/* OPENED LETTER OVERLAY (white paper look belongs only inside an opened letter) */}
          {openLetter && effectiveTab === 'letters' && (() => {
            const senderName = getLetterSenderDisplayName(openLetter);
            const kindLabel = getLetterKindLabel(openLetter.kind);
            const decisionCopy = getLetterDecisionCopy(openLetter.kind);
            const replyAllowed = canReplyToLetter(openLetter);
            const replyRecipientAccount = getLetterReplyRecipientAccount(openLetter);
            const isDecisionBusy = decisionBusyId === openLetter.id;
            const bodyParagraphs = (openLetter.payload.body || '')
              .split(/\n+/)
              .map((line) => line.trim())
              .filter(Boolean);
            const formattedDate = new Date(openLetter.createdAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            });

            return (
              <div
                data-letter-reader="true"
                data-letter-certificate={openLetter.kind === 'certificate' ? 'true' : undefined}
                data-letter-kind={openLetter.kind}
                className={`absolute inset-0 z-20 flex flex-col px-4 py-3.5 overflow-y-auto ${
                  isPhoneGlassMode ? 'bg-[#111622]/86' : 'bg-[#fbfaf7]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setOpenLetter(null);
                  }}
                  className={`self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer mb-3.5 transition-colors ${
                    isPhoneGlassMode
                      ? 'bg-white/12 hover:bg-white/20 text-white border border-white/20'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 shadow-xs'
                  }`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Back to Letters</span>
                </button>

                <div
                  data-letter-paper="true"
                  className="rounded-2xl bg-[#fffdf9] border border-stone-200/90 shadow-[0_14px_38px_rgba(0,0,0,0.34)] p-5 text-slate-900"
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                    <span>{CERRIA_CITY_NAME} &middot; {kindLabel}</span>
                    <span>{formattedDate}</span>
                  </div>
                  <div className="mt-1.5 text-[15px] font-bold text-slate-900 leading-snug">
                    {openLetter.title}
                  </div>
                  <div className="mt-1 text-[11.5px] text-slate-500">
                    From <strong className="font-semibold text-slate-800">{senderName}</strong>
                  </div>
                  <div className="my-3.5 border-t border-stone-200" />

                  {openLetter.kind === 'certificate' ? (
                    <>
                      <p className="text-xs leading-relaxed text-slate-700">
                        Sale completed on <strong className="text-slate-900">{formattedDate}</strong>{' '}
                        between{' '}
                        <strong className="text-slate-900">
                          {openLetter.payload.buyerName || openLetter.payload.buyerAccount || 'Buyer'}
                        </strong>{' '}
                        and{' '}
                        <strong className="text-slate-900">
                          {openLetter.payload.sellerName || openLetter.payload.sellerAccount || 'Seller'}
                        </strong>
                        .
                      </p>
                      <div className="mt-4 text-xs font-semibold text-slate-900">Item</div>
                      <p className="text-xs leading-relaxed text-slate-700 mt-0.5">
                        {openLetter.payload.itemName || 'Purchased item'}
                        {openLetter.payload.tokenId && (
                          <>
                            {' '}
                            &middot; Item code{' '}
                            <span className="font-mono text-slate-800">{openLetter.payload.tokenId}</span>
                          </>
                        )}
                        {openLetter.payload.deedTokenId && (
                          <>
                            {' '}
                            &middot; House No.{' '}
                            {String(openLetter.payload.deedTokenId).replace(/^.*-0*/, '')}
                          </>
                        )}
                      </p>
                      {typeof openLetter.payload.priceAmount === 'number' && (
                        <>
                          <div className="mt-4 text-xs font-semibold text-slate-900">Price</div>
                          <p className="text-xs leading-relaxed text-slate-700 mt-0.5">
                            Price paid:{' '}
                            <strong className="text-slate-900">
                              {openLetter.payload.priceAmount}{' '}
                              {openLetter.payload.priceCurrency || 'RESPITE'}
                            </strong>
                            .
                          </p>
                        </>
                      )}
                      <div className="mt-4 text-xs font-semibold text-slate-900">How it works</div>
                      <p className="text-xs leading-relaxed text-slate-700 mt-0.5">
                        The market kept the payment safe until the item moved to its new owner.
                      </p>
                      {openLetter.txHash && (
                        <p className="text-xs leading-relaxed text-slate-700 mt-2">
                          Receipt:{' '}
                          <a
                            href={getNearBlocksTxUrl(openLetter.txHash, 'testnet')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-sky-600 hover:text-sky-700 underline break-all"
                          >
                            View
                          </a>
                        </p>
                      )}
                      {openLetter.payload.paymentTx && (
                        <p className="text-xs leading-relaxed text-slate-700 mt-1">
                          Payment receipt:{' '}
                          <a
                            href={getNearBlocksTxUrl(openLetter.payload.paymentTx, 'testnet')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-sky-600 hover:text-sky-700 underline break-all"
                          >
                            View
                          </a>
                        </p>
                      )}
                      <div className="my-4 border-t border-stone-200" />
                      <p className="text-[10.5px] leading-relaxed text-stone-400 text-center">
                        Keep this letter as your proof that this item is yours.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2.5 text-xs leading-relaxed text-slate-700">
                        {bodyParagraphs.length > 0 ? (
                          bodyParagraphs.map((paragraph, idx) => (
                            <p key={idx} className="whitespace-pre-wrap break-words">
                              {paragraph}
                            </p>
                          ))
                        ) : (
                          <p className="text-slate-600">
                            {openLetter.kind === 'invitation'
                              ? `${senderName} invited you to an event in ${CERRIA_CITY_NAME}.`
                              : openLetter.kind === 'trade_offer'
                                ? `${senderName} sent you a formal trade offer.`
                                : openLetter.kind === 'friend_request'
                                  ? `${senderName} would like to add you as a friend in ${CERRIA_CITY_NAME}.`
                                  : 'Official city message.'}
                          </p>
                        )}
                      </div>

                      {openLetter.kind === 'invitation' &&
                        (openLetter.payload.eventLocation || openLetter.payload.eventTime) && (
                          <div className="mt-3.5 rounded-xl bg-stone-50 border border-stone-200/80 px-3 py-2.5 text-[11.5px] text-slate-700 space-y-1">
                            {openLetter.payload.eventTime && (
                              <div>
                                <span className="font-semibold text-slate-900">When:</span>{' '}
                                {openLetter.payload.eventTime}
                              </div>
                            )}
                            {openLetter.payload.eventLocation && (
                              <div>
                                <span className="font-semibold text-slate-900">Where:</span>{' '}
                                {openLetter.payload.eventLocation}
                              </div>
                            )}
                          </div>
                        )}

                      {openLetter.kind === 'trade_offer' &&
                        (openLetter.payload.tradeOfferSummary ||
                          openLetter.payload.itemName ||
                          typeof openLetter.payload.priceAmount === 'number') && (
                          <div className="mt-3.5 rounded-xl bg-stone-50 border border-stone-200/80 px-3 py-2.5 text-[11.5px] text-slate-700 space-y-1">
                            {openLetter.payload.tradeOfferSummary && (
                              <div className="font-medium text-slate-800">
                                {openLetter.payload.tradeOfferSummary}
                              </div>
                            )}
                            {openLetter.payload.itemName && (
                              <div>
                                <span className="font-semibold text-slate-900">Item:</span>{' '}
                                {openLetter.payload.itemName}
                              </div>
                            )}
                            {typeof openLetter.payload.priceAmount === 'number' && (
                              <div>
                                <span className="font-semibold text-slate-900">Price:</span>{' '}
                                {openLetter.payload.priceAmount}{' '}
                                {openLetter.payload.priceCurrency || 'RESPITE'}
                              </div>
                            )}
                          </div>
                        )}

                      {/* EMBEDDED DECISION CARD — only for invitation, trade_offer, friend_request */}
                      {decisionCopy && (
                        <div
                          data-letter-decision-card={openLetter.kind}
                          className="mt-4 rounded-xl border border-stone-200 bg-stone-50/90 p-3.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                              {decisionCopy.heading}
                            </span>
                            {openLetter.decisionState === 'pending' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold">
                                <Clock className="w-3 h-3" aria-hidden="true" />
                                Waiting for your answer
                              </span>
                            )}
                            {openLetter.decisionState === 'accepted' && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                                {decisionCopy.acceptedBadge}
                              </span>
                            )}
                            {openLetter.decisionState === 'declined' && (
                              <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-semibold">
                                {decisionCopy.declinedBadge}
                              </span>
                            )}
                          </div>

                          {openLetter.decisionState === 'pending' && (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                disabled={isDecisionBusy}
                                data-letter-decision-accept="true"
                                onClick={() => void handleLetterDecision(openLetter, 'accepted')}
                                className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer transition-colors"
                              >
                                {isDecisionBusy ? 'Working...' : decisionCopy.acceptLabel}
                              </button>
                              <button
                                type="button"
                                disabled={isDecisionBusy}
                                data-letter-decision-decline="true"
                                onClick={() => void handleLetterDecision(openLetter, 'declined')}
                                className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-stone-100 disabled:opacity-50 text-slate-700 border border-stone-300 text-xs font-semibold cursor-pointer transition-colors"
                              >
                                {decisionCopy.declineLabel}
                              </button>
                            </div>
                          )}

                          {decisionNotice && (
                            <p className="mt-2 text-[11px] text-amber-700 leading-snug">
                              {decisionNotice}
                            </p>
                          )}
                        </div>
                      )}

                      {/* REPLY ACTION & COMPOSER — omitted for read-only announcement & certificate */}
                      {replyAllowed && (
                        <div
                          data-letter-reply-section="true"
                          className="mt-4 pt-3.5 border-t border-stone-200"
                        >
                          {!isReplyComposerOpen ? (
                            <div className="flex items-center justify-between gap-2">
                              {replyRecipientAccount ? (
                                <button
                                  type="button"
                                  data-letter-reply-open="true"
                                  onClick={() => {
                                    soundEngine.playUiClick();
                                    setReplyStatus('idle');
                                    setIsReplyComposerOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-[11.5px] font-semibold cursor-pointer transition-colors"
                                >
                                  <Reply className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span>Reply</span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-stone-400">
                                  This sender does not accept direct replies.
                                </span>
                              )}
                              {replyStatus === 'sent' && (
                                <span className="text-[11px] font-semibold text-emerald-700">
                                  Reply sent to {senderName}.
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              <div className="text-[11px] text-stone-500">
                                Reply to <strong className="text-slate-800">{senderName}</strong>{' '}
                                &middot; {formatReplySubject(openLetter.title)}
                              </div>
                              <textarea
                                rows={3}
                                value={replyDraft}
                                onChange={(e) => setReplyDraft(e.target.value)}
                                placeholder={`Write your reply to ${senderName}...`}
                                className="w-full rounded-xl bg-white border border-stone-300 focus:border-slate-500 focus:outline-none px-3 py-2 text-xs text-slate-900 placeholder:text-stone-400 resize-none"
                              />
                              {replyStatus === 'error' && (
                                <p className="text-[11px] text-rose-600">
                                  Could not send your reply right now. Please try again.
                                </p>
                              )}
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    soundEngine.playUiClick();
                                    setIsReplyComposerOpen(false);
                                    setReplyStatus('idle');
                                  }}
                                  className="px-3 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-slate-700 text-[11px] font-semibold cursor-pointer transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={replyStatus === 'sending' || !replyDraft.trim()}
                                  data-letter-reply-send="true"
                                  onClick={() => void handleSendLetterReply()}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 disabled:opacity-45 text-white text-[11px] font-semibold cursor-pointer transition-colors"
                                >
                                  <Send className="w-3 h-3" aria-hidden="true" />
                                  <span>{replyStatus === 'sending' ? 'Sending...' : 'Send Reply'}</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* 1. ONLINE LIST SUB-TAB (Real Human Multiplayer Peers Only) */}
          {effectiveTab === 'online' && (
            <div className="flex-1 flex flex-col min-h-0">
              {renderPeopleSearchBox()}
              {!privacySettings.appearOnline && (
                <div
                  data-social-appear-offline-banner="true"
                  className={`mb-2 px-3 py-1.5 rounded-xl border text-[11px] font-medium ${
                    isPhoneGlassMode
                      ? 'bg-white/[0.08] border-white/15 text-white/75'
                      : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  You appear offline to other players.
                </div>
              )}
              {!isPhoneGlassMode && (
                <div className="mb-2.5 flex items-center justify-between text-[11px] font-semibold text-slate-500 px-1">
                  <span>Connected players in zone</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200/80 text-[10.5px] font-semibold">
                    {realHumanOnlinePeers.length} {realHumanOnlinePeers.length === 1 ? 'peer' : 'peers'}
                  </span>
                </div>
              )}
              <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                {realHumanOnlinePeers.length === 0 ? (
                  <div
                    data-social-online-empty="true"
                    className={`h-44 rounded-2xl flex flex-col items-center justify-center text-center p-5 border border-dashed text-xs font-medium ${
                      isPhoneGlassMode
                        ? 'bg-white/10 border-white/25 text-white/75'
                        : 'bg-white/80 border-slate-300 text-slate-500'
                    }`}
                  >
                    No other real human players are currently online in this zone.
                  </div>
                ) : (
                  realHumanOnlinePeers.map((u) => {
                    const isSelected = validSelectedPrivateUser?.id === u.id;
                    const peerLookupId = u.nearAccountId || u.id;
                    const peerCleanName = simplifyDisplayName(u.name);
                    const isFriend = isFriendWith(socialGraph, peerLookupId, peerCleanName);
                    const isBlocked = isPlayerBlocked(
                      privacySettings.blockedPlayers,
                      peerLookupId,
                      peerCleanName,
                    );
                    const isPending = hasPendingOutgoingFriendRequest(
                      socialGraph,
                      peerLookupId,
                      peerCleanName,
                    );
                    const canAddFriend = canShowAddFriendAction({
                      isSelf: u.isSelf,
                      isNpc: u.isNpc,
                      isBlocked,
                      isFriend,
                      allowFriendRequests: u.allowFriendRequests,
                    });
                    const pmCheck = canSendPrivateMessageTo({
                      localSettings: privacySettings,
                      recipientId: peerLookupId,
                      recipientName: u.name,
                      recipientPrivateMessages: u.privateMessages,
                      isFriend,
                    });
                    return (
                      <div
                        key={String(u.id)}
                        onClick={() => {
                          if (!pmCheck.allowed) return;
                          soundEngine.playUiClick();
                          onSelectPrivateUser(u);
                          if (isPhoneGlassMode && onSwitchPhoneApp) {
                            onSwitchPhoneApp('messages');
                          } else {
                            setActiveTab('private');
                          }
                        }}
                        className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-2 ${
                          pmCheck.allowed ? 'cursor-pointer' : 'opacity-80 cursor-default'
                        } ${
                          isSelected
                            ? 'bg-sky-50 border-sky-300 shadow-sm ring-1 ring-sky-200'
                            : 'bg-white hover:bg-slate-50/90 border-slate-200/80 shadow-xs'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <RoleBadgeCircle roleId={u.roleBadge} size="sm" />
                          <div className="truncate">
                            <div className="text-xs font-semibold text-slate-900 truncate flex items-center gap-1.5">
                              <span className="truncate">{peerCleanName}</span>
                              <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-500" />
                              {isFriend && (
                                <span
                                  data-online-friend-badge="true"
                                  className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 text-[9.5px] font-semibold shrink-0"
                                >
                                  Friend
                                </span>
                              )}
                            </div>
                            <div className="text-[10.5px] text-slate-500 truncate">
                              {getPlayerRoleBadgeSpec(u.roleBadge).label} · {u.distance}m away
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {canAddFriend && onSendFriendRequest && (
                            <button
                              type="button"
                              data-online-add-friend-btn={String(peerLookupId)}
                              disabled={isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                void triggerSendFriendRequest(u);
                              }}
                              className={`px-2.5 py-1 rounded-full font-semibold text-[10px] shadow-xs transition-colors shrink-0 inline-flex items-center gap-1 ${
                                isPending
                                  ? 'bg-slate-200 text-slate-500 cursor-default'
                                  : 'bg-indigo-500 hover:bg-indigo-600 text-white cursor-pointer'
                              }`}
                            >
                              {isPending ? (
                                <span>Sent</span>
                              ) : (
                                <>
                                  <UserPlus className="w-3 h-3" aria-hidden="true" />
                                  <span>Add</span>
                                </>
                              )}
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={!pmCheck.allowed}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!pmCheck.allowed) return;
                              soundEngine.playUiClick();
                              onSelectPrivateUser(u);
                              if (isPhoneGlassMode && onSwitchPhoneApp) {
                                onSwitchPhoneApp('messages');
                              } else {
                                setActiveTab('private');
                              }
                            }}
                            className={`px-2.5 py-1 rounded-full font-semibold text-[10.5px] shadow-xs transition-colors shrink-0 ${
                              pmCheck.allowed
                                ? 'bg-sky-500 hover:bg-sky-600 text-white cursor-pointer'
                                : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            <span>
                              {pmCheck.reason === 'blocked'
                                ? 'Blocked'
                                : pmCheck.reason === 'recipient_disabled'
                                  ? 'Messages off'
                                  : pmCheck.reason === 'recipient_friends_only'
                                    ? 'Friends only'
                                    : 'Message'}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 2. PUBLIC CHAT SUB-TAB */}
          {effectiveTab === 'public' && (
            <div className="flex-1 flex flex-col min-h-0">
              {!isPhoneGlassMode && (
                <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-slate-500 px-1">
                  <span>All citizens room feed</span>
                  <span className="text-[10px] font-medium text-slate-400">Overhead bubble active</span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-1 py-2 space-y-3">
                {publicMessages.length === 0 ? (
                  <div
                    className={`h-full flex flex-col items-center justify-center text-center p-5 text-xs font-medium ${
                      isPhoneGlassMode ? 'text-white/70' : 'text-slate-400'
                    }`}
                  >
                    No public messages yet. Say hello to everyone in the room!
                  </div>
                ) : (
                  publicMessages.map((msg) => {
                    const isSelf = Boolean(msg.isSelf);
                    const hasCustomSelfColor =
                      isSelf &&
                      playerBubbleBgColor &&
                      playerBubbleBgColor.toLowerCase() !== '#ffffff';
                    const peerBubbleStyle =
                      !isSelf && msg.bubbleBgColor
                        ? resolveBubbleStyle(msg.bubbleBgColor, msg.bubbleTextColor)
                        : null;
                    return (
                      <div
                        key={msg.id}
                        data-chat-message-id={msg.id}
                        data-chat-is-self={isSelf ? 'true' : 'false'}
                        className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1.5">
                          {(() => {
                            const tapAction = resolvePublicChatSenderAction({
                              msg,
                              localPlayerName: playerName,
                              localPlayerUid: playerUid,
                              nearbyUsers,
                            });
                            const displaySender = isSelf
                              ? `${simplifyDisplayName(playerName)} (You)`
                              : simplifyDisplayName(msg.senderName);
                            if (tapAction.kind === 'none') {
                              return (
                                <span
                                  className={`text-[10.5px] font-semibold ${
                                    isPhoneGlassMode ? 'text-white/80' : 'text-slate-500'
                                  }`}
                                >
                                  {displaySender}
                                </span>
                              );
                            }
                            return (
                              <button
                                type="button"
                                data-public-chat-sender-btn={
                                  tapAction.kind === 'npc_profile' ? 'npc' : 'player'
                                }
                                onClick={() => {
                                  soundEngine.playUiClick();
                                  if (tapAction.kind === 'npc_profile') {
                                    setPublicChatProfileDockUser(null);
                                    onOpenPlayerProfile?.(tapAction.npcEntity);
                                  } else {
                                    setPublicChatProfileDockUser(tapAction.user);
                                  }
                                }}
                                className={`text-[10.5px] font-semibold cursor-pointer hover:underline focus:outline-none ${
                                  isPhoneGlassMode
                                    ? 'text-sky-200 hover:text-white'
                                    : 'text-sky-700 hover:text-sky-900'
                                }`}
                              >
                                {displaySender}
                              </button>
                            );
                          })()}
                          <span
                            className={`text-[10px] ${
                              isPhoneGlassMode ? 'text-white/50' : 'text-slate-400'
                            }`}
                          >
                            {msg.timestamp}
                          </span>
                        </div>
                        <div
                          style={
                            hasCustomSelfColor
                              ? {
                                  backgroundColor: playerBubbleBgColor,
                                  color: playerBubbleTextColor,
                                }
                              : peerBubbleStyle
                                ? {
                                    backgroundColor: peerBubbleStyle.bgColor,
                                    color: peerBubbleStyle.textColor,
                                  }
                                : undefined
                          }
                          className={`max-w-[85%] px-3.5 py-2.5 text-xs font-medium leading-relaxed shadow-sm break-words ${
                            isSelf
                              ? hasCustomSelfColor
                                ? 'rounded-2xl rounded-tr-sm border border-slate-200/60'
                                : 'rounded-2xl rounded-tr-sm bg-sky-500 text-white'
                              : peerBubbleStyle
                                ? 'rounded-2xl rounded-tl-sm border border-slate-200/60'
                                : isPhoneGlassMode
                                  ? 'rounded-2xl rounded-tl-sm bg-white/12 text-white/95 border border-white/15 backdrop-blur-md'
                                  : 'rounded-2xl rounded-tl-sm bg-white text-slate-800 border border-slate-200/50'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={publicEndRef} />
              </div>

              {/* WS17: Compact Bottom Profile Dock overlaid on Public Chat feed */}
              {publicChatProfileDockUser &&
                (() => {
                  const dockUser = publicChatProfileDockUser;
                  const dockActions = resolveProfileDockActions({
                    user: dockUser,
                    socialGraph,
                    privacySettings,
                  });
                  const cleanDockName = simplifyDisplayName(dockUser.name);
                  const roleSpec = dockUser.roleBadge
                    ? getPlayerRoleBadgeSpec(dockUser.roleBadge)
                    : null;
                  return (
                    <div
                      data-public-chat-profile-dock="true"
                      className="mt-2 rounded-2xl bg-[#111827]/95 border border-white/20 text-white shadow-[0_-10px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl p-3 space-y-2.5 shrink-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-indigo-600 border border-white/30 flex items-center justify-center text-xs font-extrabold text-white shrink-0">
                            {cleanDockName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white truncate">
                                {cleanDockName}
                              </span>
                              {dockUser.roleBadge && (
                                <RoleBadgeCircle roleId={dockUser.roleBadge} size="sm" />
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-white/65">
                              {roleSpec && <span>{roleSpec.label}</span>}
                              {dockActions.friendshipStatus === 'friend' && (
                                <span className="px-1.5 py-0.2 rounded-full bg-sky-500/25 text-sky-200 border border-sky-300/35 font-semibold">
                                  Friend
                                </span>
                              )}
                              {dockActions.friendshipStatus === 'pending' && (
                                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/25 text-amber-200 border border-amber-300/35 font-semibold">
                                  Request Sent
                                </span>
                              )}
                              {dockActions.friendshipStatus === 'following' && (
                                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/25 text-emerald-200 border border-emerald-300/35 font-semibold">
                                  Following
                                </span>
                              )}
                              {dockActions.isBlocked && (
                                <span className="px-1.5 py-0.2 rounded-full bg-rose-500/25 text-rose-200 border border-rose-300/35 font-semibold">
                                  Blocked
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          data-public-chat-profile-dock-close="true"
                          onClick={() => {
                            soundEngine.playUiClick();
                            setPublicChatProfileDockUser(null);
                          }}
                          aria-label="Close profile dock"
                          className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/80 flex items-center justify-center cursor-pointer shrink-0"
                        >
                          <X className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>

                      {dockActions.isBlocked ? (
                        <div className="text-[11px] text-white/60">
                          Actions unavailable for this player.
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {dockActions.isFriend ? (
                            <span
                              data-dock-action="friend-badge"
                              className="px-2.5 py-1 rounded-full bg-sky-500/20 border border-sky-300/35 text-sky-100 text-[10.5px] font-semibold inline-flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" aria-hidden="true" />
                              Friend
                            </span>
                          ) : dockActions.canAddFriend && onSendFriendRequest ? (
                            <button
                              type="button"
                              data-dock-action="add-friend"
                              disabled={dockActions.isPendingRequest}
                              onClick={() => {
                                soundEngine.playUiClick();
                                if (!dockActions.isPendingRequest) {
                                  void onSendFriendRequest(dockUser);
                                }
                              }}
                              className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold inline-flex items-center gap-1 transition-colors ${
                                dockActions.isPendingRequest
                                  ? 'bg-amber-500/20 border border-amber-300/35 text-amber-100 cursor-default'
                                  : 'bg-indigo-500/30 hover:bg-indigo-500/45 border border-indigo-300/40 text-indigo-100 cursor-pointer'
                              }`}
                            >
                              <UserPlus className="w-3 h-3" aria-hidden="true" />
                              {dockActions.isPendingRequest ? 'Request Sent' : 'Add Friend'}
                            </button>
                          ) : null}

                          {dockActions.canFollow && onToggleFollowPlayer && (
                            <button
                              type="button"
                              data-dock-action="follow"
                              onClick={() => {
                                soundEngine.playUiClick();
                                onToggleFollowPlayer(dockUser);
                              }}
                              className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold cursor-pointer transition-colors ${
                                dockActions.isFollowing
                                  ? 'bg-emerald-500/30 hover:bg-emerald-500/45 border border-emerald-300/40 text-emerald-100'
                                  : 'bg-white/12 hover:bg-white/22 border border-white/20 text-white/90'
                              }`}
                            >
                              {dockActions.isFollowing ? 'Unfollow' : 'Follow'}
                            </button>
                          )}

                          {dockActions.canWhisper && (
                            <button
                              type="button"
                              data-dock-action="whisper"
                              onClick={() => {
                                soundEngine.playUiClick();
                                onSelectPrivateUser(dockUser);
                                setPublicChatProfileDockUser(null);
                                if (lockedTab && onSwitchPhoneApp) {
                                  onSwitchPhoneApp('messages');
                                } else {
                                  setActiveTab('private');
                                }
                              }}
                              className="px-2.5 py-1 rounded-full bg-sky-500/30 hover:bg-sky-500/45 border border-sky-300/40 text-sky-100 text-[10.5px] font-semibold cursor-pointer inline-flex items-center gap-1 transition-colors"
                            >
                              <MessageCircle className="w-3 h-3" aria-hidden="true" />
                              Whisper
                            </button>
                          )}

                          {dockActions.canViewProfile && onOpenPlayerProfile && (
                            <button
                              type="button"
                              data-dock-action="view-profile"
                              onClick={() => {
                                soundEngine.playUiClick();
                                setPublicChatProfileDockUser(null);
                                onOpenPlayerProfile(dockUser);
                              }}
                              className="px-2.5 py-1 rounded-full bg-white/12 hover:bg-white/22 border border-white/20 text-white/90 text-[10.5px] font-semibold cursor-pointer transition-colors"
                            >
                              View Profile
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
            </div>
          )}

          {/* 3. PRIVATE / FRIENDS APP SUB-TAB (Friends list lives here + private conversations) */}
          {effectiveTab === 'private' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div
                className={`mb-2 flex items-center justify-between gap-2 text-[11px] font-semibold px-1 ${
                  isPhoneGlassMode ? 'text-white/80' : 'text-slate-500'
                }`}
              >
                <span className="truncate flex items-center gap-1.5">
                  {validSelectedPrivateUser ? (
                    <>
                      <button
                        type="button"
                        data-private-back-to-friends="true"
                        onClick={() => {
                          soundEngine.playUiClick();
                          onSelectPrivateUser(null);
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border cursor-pointer transition-colors ${
                          isPhoneGlassMode
                            ? 'bg-white/14 hover:bg-white/22 text-white border-white/15'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <ArrowLeft className="w-3 h-3" aria-hidden="true" />
                        <span>Friends</span>
                      </button>
                      <span className="truncate">
                        {simplifyDisplayName(validSelectedPrivateUser.name)}
                      </span>
                    </>
                  ) : (
                    <span>Friends ({socialGraph.friends.length})</span>
                  )}
                </span>
                {realHumanOnlinePeers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      if (isPhoneGlassMode && onSwitchPhoneApp) {
                        onSwitchPhoneApp('contacts');
                      } else {
                        setActiveTab('online');
                      }
                    }}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border shadow-xs cursor-pointer transition-colors shrink-0 ${
                      isPhoneGlassMode
                        ? 'bg-white/14 hover:bg-white/22 text-white border-white/15'
                        : 'bg-white hover:bg-sky-50 text-slate-600 hover:text-sky-700 border-slate-200/80'
                    }`}
                  >
                    <span>Online ({realHumanOnlinePeers.length})</span>
                  </button>
                )}
              </div>

              {!validSelectedPrivateUser ? (
                <div className="flex-1 flex flex-col min-h-0">
                  {renderPeopleSearchBox()}

                  {/* Confirmed Friends List */}
                  <div
                    data-private-friends-list="true"
                    className="flex-1 overflow-y-auto space-y-2 pr-0.5"
                  >
                    {socialGraph.friends.length === 0 ? (
                      <div
                        data-social-private-empty="true"
                        className={`rounded-2xl p-4 border border-dashed text-center space-y-2 text-xs font-medium ${
                          isPhoneGlassMode
                            ? 'bg-white/[0.06] border-white/20 text-white/75'
                            : 'bg-white/80 border-slate-300 text-slate-500'
                        }`}
                      >
                        <div className="font-semibold">No friends yet</div>
                        <p className="text-[11px] opacity-80 leading-relaxed">
                          Search for a player above, tap someone in the city, or check the Online
                          list to send a friend request.
                        </p>
                      </div>
                    ) : (
                      socialGraph.friends.map((friend) => {
                        const onlineMatch = realHumanOnlinePeers.find(
                          (p) =>
                            normalizePlayerPrivacyKey(p.nearAccountId || p.id) ===
                              normalizePlayerPrivacyKey(friend.id) ||
                            normalizePlayerPrivacyKey(p.name) ===
                              normalizePlayerPrivacyKey(friend.name),
                        );
                        const targetUser: NearbyEntityUser = onlineMatch ?? {
                          id: friend.id,
                          nearAccountId: friend.id,
                          name: friend.name,
                          distance: 999,
                          isNpc: false,
                          roleBadge: friend.roleBadge,
                          buildingProject: friend.buildingProject,
                        };
                        return (
                          <div
                            key={friend.id}
                            data-private-friend-row={friend.id}
                            onClick={() => {
                              soundEngine.playUiClick();
                              onSelectPrivateUser(targetUser);
                            }}
                            className="p-2.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/80 shadow-xs flex items-center justify-between gap-2 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <RoleBadgeCircle roleId={targetUser.roleBadge} size="sm" />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-900 truncate flex items-center gap-1.5">
                                  <span className="truncate">{friend.name}</span>
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                      onlineMatch ? 'bg-emerald-500' : 'bg-slate-300'
                                    }`}
                                    title={onlineMatch ? 'Online' : 'Offline'}
                                  />
                                </div>
                                <div className="text-[10px] text-slate-500 truncate">
                                  {onlineMatch ? 'Online now' : friend.id}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  soundEngine.playUiClick();
                                  onSelectPrivateUser(targetUser);
                                }}
                                className="px-2.5 py-1 rounded-full bg-sky-500 hover:bg-sky-600 text-white font-semibold text-[10.5px] cursor-pointer transition-colors"
                              >
                                Message
                              </button>
                              {onRemoveFriend && (
                                <button
                                  type="button"
                                  data-private-remove-friend-btn={friend.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    soundEngine.playUiClick();
                                    onRemoveFriend(friend.id);
                                  }}
                                  aria-label={`Remove ${friend.name}`}
                                  title="Remove friend"
                                  className="w-6 h-6 rounded-full bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 flex items-center justify-center cursor-pointer transition-colors"
                                >
                                  <X className="w-3 h-3" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* Quick online players strip if any non-friend peers are online */}
                    {realHumanOnlinePeers.length > 0 && (
                      <div className="pt-2 space-y-1.5">
                        <div
                          className={`text-[10px] font-semibold uppercase tracking-wide px-1 ${
                            isPhoneGlassMode ? 'text-white/55' : 'text-slate-400'
                          }`}
                        >
                          Online nearby
                        </div>
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                          {realHumanOnlinePeers.map((peer) => {
                            const peerId = peer.nearAccountId || peer.id;
                            const peerFriend = isFriendWith(socialGraph, peerId, peer.name);
                            const pmCheck = canSendPrivateMessageTo({
                              localSettings: privacySettings,
                              recipientId: peerId,
                              recipientName: peer.name,
                              recipientPrivateMessages: peer.privateMessages,
                              isFriend: peerFriend,
                            });
                            return (
                              <button
                                key={String(peer.id)}
                                type="button"
                                disabled={!pmCheck.allowed}
                                onClick={() => {
                                  if (!pmCheck.allowed) return;
                                  soundEngine.playUiClick();
                                  onSelectPrivateUser(peer);
                                }}
                                className={`px-3 py-1 rounded-full border text-[11px] font-semibold shrink-0 transition-all ${
                                  !pmCheck.allowed
                                    ? 'opacity-50 cursor-not-allowed bg-white/10 text-white/60 border-white/10'
                                    : isPhoneGlassMode
                                      ? 'bg-white/14 hover:bg-white/22 text-white border-white/15 cursor-pointer'
                                      : 'bg-white hover:bg-sky-50 text-slate-700 border-slate-200/80 cursor-pointer'
                                }`}
                              >
                                <span>{simplifyDisplayName(peer.name)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto px-1 py-2 space-y-3">
                  {privateMessages.length === 0 ? (
                    <div
                      className={`h-full flex flex-col items-center justify-center text-center p-5 text-xs font-medium ${
                        isPhoneGlassMode ? 'text-white/70' : 'text-slate-500'
                      }`}
                    >
                      Start a private message with{' '}
                      <span
                        className={`font-semibold mt-0.5 ${
                          isPhoneGlassMode ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        {simplifyDisplayName(validSelectedPrivateUser.name)}
                      </span>
                    </div>
                  ) : (
                    privateMessages.map((msg) => {
                      const isSelf = Boolean(msg.isSelf);
                      return (
                      <div
                        key={msg.id}
                        data-private-message-id={msg.id}
                        data-private-is-self={isSelf ? 'true' : 'false'}
                        className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1.5">
                          <span
                            className={`text-[10.5px] font-semibold ${
                              isPhoneGlassMode ? 'text-white/80' : 'text-slate-500'
                            }`}
                          >
                            {isSelf
                              ? `You → ${simplifyDisplayName(msg.recipientName || validSelectedPrivateUser.name)}`
                              : simplifyDisplayName(msg.senderName)}
                          </span>
                          <span
                            className={`text-[10px] ${
                              isPhoneGlassMode ? 'text-white/50' : 'text-slate-400'
                            }`}
                          >
                            {msg.timestamp}
                          </span>
                        </div>
                        <div
                          className={`max-w-[85%] px-3.5 py-2.5 text-xs font-medium leading-relaxed shadow-sm break-words ${
                            isSelf
                              ? 'rounded-2xl rounded-tr-sm bg-sky-500 text-white'
                              : isPhoneGlassMode
                                ? 'rounded-2xl rounded-tl-sm bg-white/12 text-white/95 border border-white/15 backdrop-blur-md'
                                : 'rounded-2xl rounded-tl-sm bg-white text-slate-800 border border-slate-200/50'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
                  <div ref={privateEndRef} />
                </div>
              )}
            </div>
          )}

          {/* 3A. LETTERS SUB-TAB (Official City Inbox — Dark Glass List) */}
          {effectiveTab === 'letters' && (
            <div className="flex-1 flex flex-col min-h-0" data-letters-inbox="true">
              {!isPhoneGlassMode && (
                <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 px-1">
                  <span>Official city inbox</span>
                  {lettersUnreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-semibold">
                      {lettersUnreadCount} new
                    </span>
                  )}
                </div>
              )}

              <div
                className={`flex-1 flex flex-col min-h-0 rounded-2xl border overflow-hidden ${
                  isPhoneGlassMode
                    ? 'border-white/15 bg-white/[0.06] backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'border-slate-200/80 bg-white shadow-sm'
                }`}
              >
                <div
                  className={`px-3.5 py-2.5 flex items-center justify-between gap-2 border-b shrink-0 ${
                    isPhoneGlassMode
                      ? 'bg-white/[0.05] border-white/10'
                      : 'bg-slate-50 border-slate-200/70'
                  }`}
                >
                  <span
                    className={`text-[11px] font-semibold ${
                      isPhoneGlassMode ? 'text-white/90' : 'text-slate-800'
                    }`}
                  >
                    Inbox ({letters.length})
                  </span>
                  <div className="flex items-center gap-1.5">
                    {lettersNeedsAnswerCount > 0 && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          isPhoneGlassMode
                            ? 'bg-amber-400/20 text-amber-200 border border-amber-300/35'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {lettersNeedsAnswerCount} waiting
                      </span>
                    )}
                    {lettersUnreadCount > 0 && (
                      <span
                        className={`text-[10.5px] font-semibold ${
                          isPhoneGlassMode ? 'text-rose-300' : 'text-rose-600'
                        }`}
                      >
                        {lettersUnreadCount} unread
                      </span>
                    )}
                  </div>
                </div>

                {letters.length === 0 ? (
                  <div
                    className={`flex-1 flex flex-col items-center justify-center p-6 text-center text-xs font-medium leading-relaxed ${
                      isPhoneGlassMode ? 'text-white/55' : 'text-slate-400'
                    }`}
                  >
                    No letters yet. Official notices, invitations, offers, and receipts will arrive
                    here.
                  </div>
                ) : (
                  <div
                    className={`flex-1 overflow-y-auto divide-y ${
                      isPhoneGlassMode ? 'divide-white/10' : 'divide-slate-100'
                    }`}
                  >
                    {letters.map((letter) => {
                      const rowState = getLetterListRowState(letter);
                      const senderName = getLetterSenderDisplayName(letter);
                      const kindLabel = getLetterKindLabel(letter.kind);
                      const decisionCopy = getLetterDecisionCopy(letter.kind);

                      return (
                        <button
                          key={letter.id}
                          type="button"
                          data-letter-row={letter.id}
                          data-letter-kind={letter.kind}
                          data-letter-read={letter.isRead ? 'true' : 'false'}
                          data-letter-needs-answer={rowState.needsAnswer ? 'true' : 'false'}
                          onClick={() => handleOpenLetter(letter)}
                          className={`w-full flex items-start gap-3 px-3.5 py-3 text-left cursor-pointer transition-colors ${
                            isPhoneGlassMode
                              ? rowState.isUnread
                                ? 'bg-white/[0.13] hover:bg-white/[0.18]'
                                : 'bg-transparent hover:bg-white/[0.06]'
                              : rowState.isUnread
                                ? 'bg-sky-50/70 hover:bg-sky-50'
                                : 'bg-white hover:bg-slate-50/80'
                          }`}
                        >
                          <span
                            data-letter-envelope={rowState.envelopeIcon}
                            aria-label={rowState.isUnread ? 'Unread letter' : 'Read letter'}
                            className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 border ${
                              isPhoneGlassMode
                                ? rowState.isUnread
                                  ? 'bg-amber-400/20 border-amber-300/40 text-amber-200'
                                  : 'bg-white/[0.06] border-white/10 text-white/45'
                                : rowState.isUnread
                                  ? 'bg-amber-100 border-amber-300 text-amber-700'
                                  : 'bg-slate-100 border-slate-200 text-slate-400'
                            }`}
                          >
                            {rowState.envelopeIcon === 'closed' ? (
                              <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                            ) : (
                              <MailOpen className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                          </span>

                          <span className="flex-1 min-w-0">
                            <span className="flex items-center justify-between gap-2">
                              <span
                                className={`truncate text-[11.5px] ${
                                  isPhoneGlassMode
                                    ? rowState.isUnread
                                      ? 'font-bold text-white'
                                      : 'font-normal text-white/65'
                                    : rowState.isUnread
                                      ? 'font-bold text-slate-900'
                                      : 'font-normal text-slate-600'
                                }`}
                              >
                                {senderName}
                              </span>
                              <span
                                className={`text-[10px] shrink-0 ${
                                  isPhoneGlassMode ? 'text-white/45' : 'text-slate-400'
                                }`}
                              >
                                {new Date(letter.createdAt).toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </span>
                            </span>

                            <span
                              className={`block truncate text-xs mt-0.5 ${
                                isPhoneGlassMode
                                  ? rowState.isUnread
                                    ? 'font-bold text-white'
                                    : 'font-normal text-white/60'
                                  : rowState.isUnread
                                    ? 'font-bold text-slate-900'
                                    : 'font-normal text-slate-600'
                              }`}
                            >
                              {letter.title}
                            </span>

                            <span className="mt-1 flex items-center flex-wrap gap-1.5">
                              <span
                                className={`text-[10px] ${
                                  isPhoneGlassMode ? 'text-white/45' : 'text-slate-400'
                                }`}
                              >
                                {kindLabel}
                              </span>
                              {rowState.needsAnswer && (
                                <span
                                  data-letter-needs-answer-badge="true"
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold ${
                                    isPhoneGlassMode
                                      ? 'bg-amber-400/20 text-amber-200 border border-amber-300/35'
                                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                                  }`}
                                >
                                  <Clock className="w-2.5 h-2.5" aria-hidden="true" />
                                  Waiting for your answer
                                </span>
                              )}
                              {!rowState.needsAnswer &&
                                rowState.decisionBadge === 'accepted' &&
                                decisionCopy && (
                                  <span
                                    className={`px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold ${
                                      isPhoneGlassMode
                                        ? 'bg-emerald-400/18 text-emerald-200 border border-emerald-300/30'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    {decisionCopy.acceptedBadge}
                                  </span>
                                )}
                              {!rowState.needsAnswer &&
                                rowState.decisionBadge === 'declined' &&
                                decisionCopy && (
                                  <span
                                    className={`px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold ${
                                      isPhoneGlassMode
                                        ? 'bg-white/10 text-white/55 border border-white/15'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {decisionCopy.declinedBadge}
                                  </span>
                                )}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3B. KAI CONTACT SUB-TAB (phone contact for the fish merchant) */}
          {effectiveTab === 'kai' && (
            <div className="flex-1 overflow-y-auto space-y-3 pr-0.5" data-kai-contact="true">
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-tr from-sky-500 to-teal-400 ring-2 ring-sky-100 flex items-center justify-center text-white font-bold text-lg shadow-xs">
                    K
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">Kai</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        Online
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Fisherman &amp; Beach Keeper · East Beach
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start">
                <div className="flex items-center gap-1.5 mb-1 px-1.5">
                  <span className="text-[10.5px] font-semibold text-slate-500">Kai</span>
                </div>
                <div className="max-w-[92%] px-3.5 py-2.5 rounded-2xl rounded-tl-sm text-xs font-medium leading-relaxed bg-white text-slate-800 border border-slate-200/50 shadow-sm">
                  {kaiRawFishCount > 0
                    ? 'Heard you caught something! I buy raw fish, and we can haggle the price right in chat — by phone too. Feel free to ask.'
                    : "Hey! I'm Kai, fisherman and beach keeper at East Beach. Catch a fish and I'll buy it — we can even haggle the price in chat. Feel free to ask."}
                </div>
              </div>

              {kaiRawFishCount > 0 ? (
                <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/80 shadow-xs space-y-2.5">
                  <div className="text-xs font-semibold text-amber-900">
                    {kaiRawFishCount} raw fish in your bucket
                  </div>
                  <p className="text-[11.5px] text-amber-800 leading-snug">
                    Kai is buying. Open the chat and tap Start Haggling on the trade card.
                  </p>
                  <button
                    type="button"
                    data-kai-call-button="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      onCallKai?.();
                    }}
                    className="w-full px-4 py-2.5 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-sm font-semibold text-xs cursor-pointer active:scale-[0.99] transition-all"
                  >
                    Call Kai — Haggle Now
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    data-kai-call-button="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      onCallKai?.();
                    }}
                    className="w-full px-4 py-2.5 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-sm font-semibold text-xs cursor-pointer active:scale-[0.99] transition-all"
                  >
                    Call Kai — Chat
                  </button>
                  <button
                    type="button"
                    data-kai-meet-button="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      onMeetKai?.();
                    }}
                    className="w-full px-4 py-2.5 rounded-full bg-white hover:bg-sky-50 text-slate-800 border border-slate-200/90 shadow-xs font-semibold text-xs cursor-pointer active:scale-[0.99] transition-all"
                  >
                    Meet Kai at East Beach
                  </button>
                  <p className="text-[11px] text-slate-500 leading-snug px-1">
                    No fish yet? Kai waits at East Beach — follow the marker, or call him first and
                    say hello.
                  </p>
                </div>
              )}

              <p className="text-[10.5px] text-slate-400 leading-snug px-1">
                Phone haggling covers raw fish for LUL. Fish NFT trades happen at Kai&apos;s market
                stall in person.
              </p>
            </div>
          )}

          {/* 4. SETTINGS SUB-TAB: Chat, Controls, Graphics, Privacy, Account */}
          {effectiveTab === 'settings' && (() => {
            const cardClass = isPhoneGlassMode
              ? 'p-3.5 rounded-2xl bg-white/[0.06] border border-white/12 space-y-2.5 text-white'
              : 'p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-2.5 text-slate-900';
            const sectionTitleClass = isPhoneGlassMode
              ? 'text-[10.5px] font-semibold uppercase tracking-wider text-white/55'
              : 'text-[10.5px] font-semibold uppercase tracking-wider text-slate-500';
            const rowLabelClass = isPhoneGlassMode
              ? 'text-xs font-medium text-white/90'
              : 'text-xs font-medium text-slate-800';
            const helperTextClass = isPhoneGlassMode
              ? 'text-[11px] text-white/55 leading-snug'
              : 'text-[11px] text-slate-500 leading-snug';
            const dividerClass = isPhoneGlassMode ? 'border-white/10' : 'border-slate-200/80';
            const activeGraphicsOption =
              GRAPHICS_QUALITY_OPTIONS.find((opt) => opt.id === graphicsQuality) ??
              GRAPHICS_QUALITY_OPTIONS[3];

            const renderTogglePill = (
              enabled: boolean,
              onToggle: () => void,
              testAttr: Record<string, string>,
            ) => (
              <button
                type="button"
                {...testAttr}
                onClick={() => {
                  soundEngine.playUiClick();
                  onToggle();
                }}
                className={`px-3 py-1 rounded-full font-semibold text-[10.5px] cursor-pointer shrink-0 transition-colors ${
                  enabled
                    ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                    : isPhoneGlassMode
                      ? 'bg-white/12 text-white/75 hover:bg-white/20 border border-white/15'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{enabled ? 'On' : 'Off'}</span>
              </button>
            );

            return (
              <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar space-y-3 pr-0.5">
                {/* 1. CHAT */}
                <section data-settings-section="chat" className={cardClass}>
                  <div className={sectionTitleClass}>Chat</div>
                  <div className={rowLabelClass}>Speech bubble color</div>
                  <div className={`grid gap-2 ${embeddedInPhone ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    {BUBBLE_COLOR_SWATCHES.map((swatch) => {
                      const isSelected =
                        playerBubbleBgColor.toLowerCase() === swatch.bg.toLowerCase();
                      return (
                        <button
                          key={swatch.bg}
                          type="button"
                          onClick={() => {
                            onChangeBubbleBgColor?.(swatch.bg);
                            onChangeBubbleTextColor?.(swatch.text);
                          }}
                          style={{ backgroundColor: swatch.bg, color: swatch.text }}
                          className={`px-2.5 py-2 rounded-xl border text-[10.5px] font-semibold flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'border-sky-400 ring-2 ring-sky-400/40 shadow-xs'
                              : 'border-white/20 opacity-90 hover:opacity-100'
                          }`}
                        >
                          <span className="truncate">{swatch.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* 2. CONTROLS */}
                <section data-settings-section="controls" className={cardClass}>
                  <div className={sectionTitleClass}>Controls</div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={rowLabelClass}>On-screen joystick (Desktop)</span>
                    <button
                      type="button"
                      data-setting-desktop-joystick-btn="true"
                      onClick={() => onToggleShowJoystickOnDesktop?.()}
                      className={`px-3 py-1 rounded-full font-semibold text-[10.5px] cursor-pointer shrink-0 transition-colors ${
                        showJoystickOnDesktop
                          ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                          : isPhoneGlassMode
                            ? 'bg-white/12 text-white/75 hover:bg-white/20 border border-white/15'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>{showJoystickOnDesktop ? 'Shown' : 'Hidden'}</span>
                    </button>
                  </div>
                  <p className={helperTextClass}>
                    Show the touch joystick on desktop, so you can move without WASD.
                  </p>

                  {isInsidePrivateHouse && onOpenHouseDecoration && (
                    <div
                      className={`pt-2.5 border-t ${dividerClass} flex items-center justify-between gap-2.5`}
                    >
                      <div>
                        <div className={rowLabelClass}>Private house interior</div>
                        <div className={helperTextClass}>
                          Open furniture &amp; room theme settings
                        </div>
                      </div>
                      <button
                        type="button"
                        data-chat-setting-decorate-btn="true"
                        onClick={onOpenHouseDecoration}
                        className="px-3 py-1.5 rounded-full bg-sky-500 hover:bg-sky-400 text-white font-semibold text-[11px] cursor-pointer shrink-0 transition-colors"
                      >
                        <span>Decorate</span>
                      </button>
                    </div>
                  )}
                </section>

                {/* 3. GRAPHICS */}
                <section data-settings-section="graphics" className={cardClass}>
                  <div className={sectionTitleClass}>Graphics</div>
                  <div className={rowLabelClass}>Graphics quality</div>
                  <div
                    role="radiogroup"
                    aria-label="Graphics quality"
                    className="grid grid-cols-2 gap-1.5"
                  >
                    {GRAPHICS_QUALITY_OPTIONS.map((opt) => {
                      const selected = graphicsQuality === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          data-setting-graphics-option={opt.id}
                          onClick={() => {
                            soundEngine.playUiClick();
                            onChangeGraphicsQuality?.(opt.id);
                          }}
                          className={`px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all flex items-center justify-between gap-1.5 ${
                            selected
                              ? isPhoneGlassMode
                                ? 'bg-white text-slate-950 border-white shadow-xs'
                                : 'bg-slate-900 text-white border-slate-900 shadow-xs'
                              : isPhoneGlassMode
                                ? 'bg-white/[0.08] hover:bg-white/[0.15] text-white/85 border-white/14'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {selected && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                  <p className={helperTextClass}>{activeGraphicsOption.description}</p>
                </section>

                {/* 4. PRIVACY */}
                <section data-settings-section="privacy" className={cardClass}>
                  <div className={sectionTitleClass}>Privacy</div>

                  {/* Who can send me private messages */}
                  <div className="space-y-1.5">
                    <div className={rowLabelClass}>Who can send me private messages</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {PRIVATE_MESSAGE_PERMISSION_OPTIONS.map((opt) => {
                        const selected = privacySettings.privateMessages === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            data-setting-privacy-pm={opt.id}
                            onClick={() => {
                              soundEngine.playUiClick();
                              onUpdatePrivacySettings?.({ privateMessages: opt.id });
                            }}
                            className={`px-2 py-1.5 rounded-xl border text-[10.5px] font-semibold cursor-pointer transition-colors ${
                              selected
                                ? isPhoneGlassMode
                                  ? 'bg-white text-slate-950 border-white'
                                  : 'bg-slate-900 text-white border-slate-900'
                                : isPhoneGlassMode
                                  ? 'bg-white/[0.08] hover:bg-white/[0.15] text-white/80 border-white/14'
                                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Who can visit my apartment */}
                  <div className={`pt-2.5 border-t ${dividerClass} space-y-1.5`}>
                    <div className={rowLabelClass}>Who can visit my apartment</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {APARTMENT_VISIT_PERMISSION_OPTIONS.map((opt) => {
                        const selected = privacySettings.apartmentVisits === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            data-setting-privacy-apartment={opt.id}
                            onClick={() => {
                              soundEngine.playUiClick();
                              onUpdatePrivacySettings?.({ apartmentVisits: opt.id });
                            }}
                            className={`px-2 py-1.5 rounded-xl border text-[10.5px] font-semibold cursor-pointer transition-colors ${
                              selected
                                ? isPhoneGlassMode
                                  ? 'bg-white text-slate-950 border-white'
                                  : 'bg-slate-900 text-white border-slate-900'
                                : isPhoneGlassMode
                                  ? 'bg-white/[0.08] hover:bg-white/[0.15] text-white/80 border-white/14'
                                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Allow friend requests */}
                  <div
                    className={`pt-2.5 border-t ${dividerClass} flex items-center justify-between gap-2`}
                  >
                    <div className="min-w-0">
                      <div className={rowLabelClass}>Allow friend requests</div>
                      <div className={helperTextClass}>
                        When off, other players won&apos;t see an Add Friend button on your profile.
                      </div>
                    </div>
                    {renderTogglePill(
                      privacySettings.allowFriendRequests,
                      () =>
                        onUpdatePrivacySettings?.({
                          allowFriendRequests: !privacySettings.allowFriendRequests,
                        }),
                      { 'data-setting-privacy-friend-requests': 'true' },
                    )}
                  </div>

                  {/* Appear in the Online list */}
                  <div
                    className={`pt-2.5 border-t ${dividerClass} flex items-center justify-between gap-2`}
                  >
                    <div className="min-w-0">
                      <div className={rowLabelClass}>Appear in the Online list</div>
                      <div className={helperTextClass}>
                        Turn off to appear offline to other players.
                      </div>
                    </div>
                    {renderTogglePill(
                      privacySettings.appearOnline,
                      () =>
                        onUpdatePrivacySettings?.({
                          appearOnline: !privacySettings.appearOnline,
                        }),
                      { 'data-setting-privacy-online': 'true' },
                    )}
                  </div>

                  {/* Hide my balances */}
                  <div
                    className={`pt-2.5 border-t ${dividerClass} flex items-center justify-between gap-2`}
                  >
                    <div className="min-w-0">
                      <div className={rowLabelClass}>Hide my balances</div>
                      <div className={helperTextClass}>
                        Keep Wallet balances hidden until you tap Peek.
                      </div>
                    </div>
                    {renderTogglePill(
                      privacySettings.hideBalances,
                      () =>
                        onUpdatePrivacySettings?.({
                          hideBalances: !privacySettings.hideBalances,
                        }),
                      { 'data-setting-privacy-hide-balances': 'true' },
                    )}
                  </div>

                  {/* Show my wallet address on my profile */}
                  <div
                    className={`pt-2.5 border-t ${dividerClass} flex items-center justify-between gap-2`}
                  >
                    <div className="min-w-0">
                      <div className={rowLabelClass}>Show my wallet address on my profile</div>
                      <div className={helperTextClass}>
                        When off, your address and profile gift option are hidden.
                      </div>
                    </div>
                    {renderTogglePill(
                      privacySettings.showWalletAddressOnProfile,
                      () =>
                        onUpdatePrivacySettings?.({
                          showWalletAddressOnProfile: !privacySettings.showWalletAddressOnProfile,
                        }),
                      { 'data-setting-privacy-show-address': 'true' },
                    )}
                  </div>

                  {/* Show my things on my profile */}
                  <div
                    className={`pt-2.5 border-t ${dividerClass} flex items-center justify-between gap-2`}
                  >
                    <div className="min-w-0">
                      <div className={rowLabelClass}>Show my things on my profile</div>
                      <div className={helperTextClass}>
                        Show or hide your items strip on your profile card.
                      </div>
                    </div>
                    {renderTogglePill(
                      privacySettings.showThingsOnProfile,
                      () =>
                        onUpdatePrivacySettings?.({
                          showThingsOnProfile: !privacySettings.showThingsOnProfile,
                        }),
                      { 'data-setting-privacy-show-things': 'true' },
                    )}
                  </div>

                  {/* Blocked players */}
                  <div className={`pt-2.5 border-t ${dividerClass} space-y-2`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={rowLabelClass}>Blocked players</span>
                      <span className={helperTextClass}>
                        {privacySettings.blockedPlayers.length}
                      </span>
                    </div>
                    {privacySettings.blockedPlayers.length === 0 ? (
                      <div
                        data-setting-privacy-blocked-empty="true"
                        className={`px-3 py-2 rounded-xl border border-dashed text-[11px] ${
                          isPhoneGlassMode
                            ? 'bg-white/[0.04] border-white/14 text-white/50'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                      >
                        No blocked players. You can block someone from their profile card.
                      </div>
                    ) : (
                      <div
                        data-setting-privacy-blocked-list="true"
                        className="space-y-1.5 max-h-36 overflow-y-auto"
                      >
                        {privacySettings.blockedPlayers.map((entry) => (
                          <div
                            key={entry.id}
                            data-setting-privacy-blocked-item={entry.id}
                            className={`px-2.5 py-2 rounded-xl border flex items-center justify-between gap-2 ${
                              isPhoneGlassMode
                                ? 'bg-white/[0.07] border-white/12'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold truncate">{entry.name}</div>
                              {entry.name.toLowerCase() !== entry.id.toLowerCase() && (
                                <div className="text-[10px] font-mono opacity-60 truncate">
                                  {entry.id}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              data-setting-privacy-unblock-btn={entry.id}
                              onClick={() => {
                                soundEngine.playUiClick();
                                onUnblockPlayer?.(entry.id);
                              }}
                              className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold cursor-pointer shrink-0 transition-colors ${
                                isPhoneGlassMode
                                  ? 'bg-white/14 hover:bg-white/24 text-white border border-white/18'
                                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              Unblock
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                {/* 5. ACCOUNT (Moved from Wallet's Login Account card) */}
                <section data-settings-section="account" className={cardClass}>
                  <div className={sectionTitleClass}>Account</div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className={helperTextClass}>Signed in as</div>
                      <div className="text-xs font-semibold truncate mt-0.5">
                        {connectedAccountEmail || 'Guest Session'}
                      </div>
                    </div>
                    {onLogOut && (
                      <button
                        type="button"
                        data-switch-or-disconnect-wallet-btn="true"
                        data-settings-logout-btn="true"
                        onClick={() => {
                          soundEngine.playUiClick();
                          onLogOut();
                        }}
                        className={`px-3 py-1.5 rounded-full font-semibold text-[11px] transition-colors cursor-pointer shrink-0 border ${
                          isPhoneGlassMode
                            ? 'bg-white/10 hover:bg-rose-500/80 text-white/85 hover:text-white border-white/15'
                            : 'bg-slate-100 hover:bg-rose-500 text-slate-800 hover:text-white border-slate-200'
                        }`}
                      >
                        Log Out
                      </button>
                    )}
                  </div>
                </section>
              </div>
            );
          })()}
        </div>
      </div>
  );

  if (embeddedInPhone) {
    return (
      <div
        role="region"
        aria-label="Social Chat Room"
        data-social-chat-modal="true"
        className="w-full h-full flex flex-col overflow-hidden select-none"
      >
        {innerPanel}
      </div>
    );
  }

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-hidden={!isOpen}
      aria-label="Social Chat Room"
      data-social-chat-modal="true"
      data-chat-glass-modal="true"
      className={`fixed inset-x-2.5 sm:inset-x-auto sm:left-4 top-[max(0.5rem,var(--safe-top))] sm:top-14 bottom-[calc(64px+var(--safe-bottom))] sm:bottom-[76px] my-auto z-40 sm:w-[356px] max-w-[400px] mx-auto sm:mx-0 max-h-[min(620px,calc(100dvh-4.75rem))] select-none transition-all duration-300 ease-out transform ${
        isOpen
          ? 'translate-x-0 opacity-100 pointer-events-auto'
          : '-translate-x-[120%] opacity-0 pointer-events-none'
      }`}
    >
      {innerPanel}
    </aside>
  );
};
