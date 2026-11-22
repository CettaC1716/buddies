import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';
import { soundEngine } from '../game/audio';
import {
  fetchLettersForAccount,
  markLetterRead,
  type BuddiesLetter,
} from '../lib/supabaseClient';
import { getNearBlocksTxUrl } from '../lib/nearClient';
import {
  mergeRealtimeSocialChatMessage,
  resolveBubbleStyle,
} from '../game/buddiesRemotePresenceSync';

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
  unreadPrivateCount?: number;
  onClearUnreadPrivate?: () => void;
  kaiRawFishCount?: number;
  kaiHasMet?: boolean;
  onCallKai?: () => void;
  onMeetKai?: () => void;
  embeddedInPhone?: boolean;
  initialTab?: SocialChatSubTab;
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
  isMuted = false,
  audioVolumePct = 80,
  onToggleAudio,
  onChangeVolumePct,
  showJoystickOnDesktop = false,
  onToggleShowJoystickOnDesktop,
  unreadPrivateCount = 0,
  onClearUnreadPrivate,
  kaiRawFishCount = 0,
  kaiHasMet: _kaiHasMet = false,
  onCallKai,
  onMeetKai,
  embeddedInPhone = false,
  initialTab,
}) => {
  const [activeTab, setActiveTab] = useState<SocialChatSubTab>(initialTab ?? 'public');
  const [letters, setLetters] = useState<BuddiesLetter[]>([]);
  const [openLetter, setOpenLetter] = useState<BuddiesLetter | null>(null);
  const lettersUnreadCount = letters.filter((l) => !l.isRead).length;

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    const account = (playerUid ?? '').trim().toLowerCase();
    if (!account.includes('.')) return;
    let cancelled = false;
    void fetchLettersForAccount(account).then((rows) => {
      if (!cancelled) setLetters(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, playerUid, activeTab]);

  useEffect(() => {
    if (activeTab !== 'letters') setOpenLetter(null);
  }, [activeTab]);
  const publicEndRef = useRef<HTMLDivElement | null>(null);
  const privateEndRef = useRef<HTMLDivElement | null>(null);

  const realHumanOnlinePeers = useMemo(
    () => filterRealHumanOnlinePlayers(nearbyUsers, playerName, playerUid),
    [nearbyUsers, playerName, playerUid],
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
    } else if (validSelectedPrivateUser && isOpen) {
      setActiveTab('private');
      onClearUnreadPrivate?.();
    }
  }, [
    selectedPrivateUser,
    validSelectedPrivateUser,
    isOpen,
    playerName,
    playerUid,
    onSelectPrivateUser,
    onClearUnreadPrivate,
  ]);

  useEffect(() => {
    if (isOpen && activeTab === 'private') {
      onClearUnreadPrivate?.();
    }
  }, [isOpen, activeTab, onClearUnreadPrivate]);

  useEffect(() => {
    if (isOpen) {
      publicEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      privateEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [normalizedMessages.length, isOpen, activeTab]);

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

  const innerPanel = (
      <div
        className={
          embeddedInPhone
            ? 'relative w-full h-full bg-white text-slate-900 flex flex-col overflow-hidden'
            : 'relative h-full rounded-[28px] bg-white/96 backdrop-blur-2xl border border-white/80 shadow-[0_24px_64px_rgba(15,23,42,0.28)] text-slate-900 flex flex-col overflow-hidden'
        }
      >
        {/* TOP TAB BAR */}
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
              const active = activeTab === tab.id;
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

        {/* SUB-TAB BODY CONTENT */}
        <div
          className={`relative flex-1 flex flex-col min-h-0 overflow-hidden bg-[#f2f4f8] ${
            embeddedInPhone ? 'px-3 py-2.5' : 'px-3.5 py-3'
          }`}
        >
          {/* LETTER CERTIFICATE OVERLAY (opened from the LETTERS tab inbox) */}
          {openLetter && activeTab === 'letters' && (
            <div
              data-letter-certificate="true"
              className="absolute inset-0 z-20 flex flex-col bg-[#fbfaf7] px-5 py-4 overflow-y-auto"
            >
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  setOpenLetter(null);
                }}
                className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 shadow-xs text-[11px] font-semibold cursor-pointer mb-4 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Back to Letters</span>
              </button>
              <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5">
                <div className="text-center text-[15px] font-bold text-slate-900 leading-tight">
                  {openLetter.title}
                </div>
                <div className="mt-1 text-center text-[10px] font-medium uppercase tracking-widest text-slate-400">
                  Buddies Blitz &middot; Official Purchase Certificate
                </div>
                <div className="my-3.5 border-t border-slate-200" />
                <p className="text-xs leading-relaxed text-slate-700">
                  Sale completed on{' '}
                  <strong className="text-slate-900">
                    {new Date(openLetter.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </strong>{' '}
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
                  {openLetter.payload.itemName || 'Digital asset'}
                  {openLetter.payload.tokenId && (
                    <>
                      {' '}
                      &middot; Item code <span className="font-mono text-slate-800">{openLetter.payload.tokenId}</span>
                    </>
                  )}
                  {openLetter.payload.deedTokenId && (
                    <>
                      {' '}
                      &middot; House No. {String(openLetter.payload.deedTokenId).replace(/^.*-0*/, '')}
                    </>
                  )}
                </p>
                {typeof openLetter.payload.priceAmount === 'number' && (
                  <>
                    <div className="mt-4 text-xs font-semibold text-slate-900">Price</div>
                    <p className="text-xs leading-relaxed text-slate-700 mt-0.5">
                      Price paid:{' '}
                      <strong className="text-slate-900">
                        {openLetter.payload.priceAmount} {openLetter.payload.priceCurrency || 'RESPITE'}
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
                <div className="my-4 border-t border-slate-200" />
                <p className="text-[10.5px] leading-relaxed text-slate-400 text-center">
                  Keep this letter as your proof that this item is yours.
                </p>
              </div>
            </div>
          )}

          {/* 1. ONLINE LIST SUB-TAB (Real Human Multiplayer Peers Only) */}
          {activeTab === 'online' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="mb-2.5 flex items-center justify-between text-[11px] font-semibold text-slate-500 px-1">
                <span>Connected players in zone</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200/80 text-[10.5px] font-semibold">
                  {realHumanOnlinePeers.length} {realHumanOnlinePeers.length === 1 ? 'peer' : 'peers'}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                {realHumanOnlinePeers.length === 0 ? (
                  <div
                    data-social-online-empty="true"
                    className="h-44 rounded-2xl flex flex-col items-center justify-center text-center p-5 bg-white/80 border border-dashed border-slate-300 text-slate-500 text-xs font-medium"
                  >
                    No other real human players are currently online in this zone.
                  </div>
                ) : (
                  realHumanOnlinePeers.map((u) => {
                    const isSelected = validSelectedPrivateUser?.id === u.id;
                    return (
                      <div
                        key={String(u.id)}
                        onClick={() => {
                          soundEngine.playUiClick();
                          onSelectPrivateUser(u);
                          setActiveTab('private');
                        }}
                        className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'bg-sky-50 border-sky-300 shadow-sm ring-1 ring-sky-200'
                            : 'bg-white hover:bg-slate-50/90 border-slate-200/80 shadow-xs'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-emerald-500 ring-4 ring-emerald-100" />
                          <div className="truncate">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {simplifyDisplayName(u.name)}
                            </div>
                            <div className="text-[10.5px] text-slate-500">
                              Online player · {u.distance}m away
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            soundEngine.playUiClick();
                            onSelectPrivateUser(u);
                            setActiveTab('private');
                          }}
                          className="px-3 py-1 rounded-full bg-sky-500 hover:bg-sky-600 text-white font-semibold text-[10.5px] shadow-xs cursor-pointer transition-colors shrink-0"
                        >
                          <span>Whisper</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 2. PUBLIC CHAT SUB-TAB */}
          {activeTab === 'public' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-slate-500 px-1">
                <span>All citizens room feed</span>
                <span className="text-[10px] font-medium text-slate-400">Overhead bubble active</span>
              </div>

              <div className="flex-1 overflow-y-auto px-1 py-2 space-y-3">
                {publicMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-5 text-slate-400 text-xs font-medium">
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
                          <span className="text-[10.5px] font-semibold text-slate-500">
                            {isSelf
                              ? `${simplifyDisplayName(playerName)} (You)`
                              : simplifyDisplayName(msg.senderName)}
                          </span>
                          <span className="text-[10px] text-slate-400">
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
            </div>
          )}

          {/* 3. PRIVATE / WHISPER CHAT SUB-TAB (Real Connected Human Players Only) */}
          {activeTab === 'private' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 px-1">
                <span className="truncate">
                  {validSelectedPrivateUser
                    ? `Whisper to: ${simplifyDisplayName(validSelectedPrivateUser.name)}`
                    : 'Select a real online player to whisper'}
                </span>
                {realHumanOnlinePeers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setActiveTab('online');
                    }}
                    className="px-2.5 py-1 rounded-full bg-white hover:bg-sky-50 text-slate-600 hover:text-sky-700 text-[10px] font-semibold border border-slate-200/80 shadow-xs cursor-pointer transition-colors shrink-0"
                  >
                    <span>Switch target</span>
                  </button>
                )}
              </div>

              {/* Quick horizontal selector for real connected players */}
              {realHumanOnlinePeers.length > 0 && (
                <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0">
                  {realHumanOnlinePeers.map((peer) => {
                    const isTarget = validSelectedPrivateUser?.id === peer.id;
                    return (
                      <button
                        key={String(peer.id)}
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          onSelectPrivateUser(peer);
                        }}
                        className={`px-3 py-1 rounded-full border text-[11px] font-semibold shrink-0 cursor-pointer transition-all ${
                          isTarget
                            ? 'bg-sky-500 text-white border-sky-500 shadow-xs'
                            : 'bg-white hover:bg-sky-50 text-slate-700 border-slate-200/80'
                        }`}
                      >
                        <span>{simplifyDisplayName(peer.name)}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-1 py-2 space-y-3">
                {!validSelectedPrivateUser ? (
                  <div
                    data-social-private-empty="true"
                    className="h-full flex flex-col items-center justify-center text-center p-5 text-slate-500 text-xs font-medium gap-3"
                  >
                    <span>
                      {realHumanOnlinePeers.length === 0
                        ? 'No other real human players are currently online for private whisper.'
                        : 'Select an online player above or from Online list to start a private whisper.'}
                    </span>
                    {realHumanOnlinePeers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          setActiveTab('online');
                        }}
                        className="px-4 py-1.5 rounded-full bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs shadow-sm cursor-pointer transition-colors"
                      >
                        <span>Open online list</span>
                      </button>
                    )}
                  </div>
                ) : privateMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-5 text-slate-500 text-xs font-medium">
                    Start a private whisper with{' '}
                    <span className="text-slate-900 font-semibold mt-0.5">
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
                          <span className="text-[10.5px] font-semibold text-slate-500">
                            {isSelf
                              ? `You → ${simplifyDisplayName(msg.recipientName || validSelectedPrivateUser.name)}`
                              : simplifyDisplayName(msg.senderName)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {msg.timestamp}
                          </span>
                        </div>
                        <div
                          className={`max-w-[85%] px-3.5 py-2.5 text-xs font-medium leading-relaxed shadow-sm break-words ${
                            isSelf
                              ? 'rounded-2xl rounded-tr-sm bg-sky-500 text-white'
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
            </div>
          )}

          {/* 3A. LETTERS SUB-TAB (Purchase & Ownership Certificates Inbox) */}
          {activeTab === 'letters' && (
            <div className="flex-1 flex flex-col min-h-0" data-letters-inbox="true">
              <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 px-1">
                <span>Ownership certificates &amp; inbox</span>
                {lettersUnreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-semibold">
                    {lettersUnreadCount} new
                  </span>
                )}
              </div>

              <div className="flex-1 flex flex-col min-h-0 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="px-3.5 py-2.5 flex items-center justify-between bg-amber-50/70 border-b border-slate-200/70 shrink-0">
                  <span className="text-[11px] font-semibold text-slate-800">
                    Letters ({letters.length})
                  </span>
                  {lettersUnreadCount > 0 && (
                    <span className="text-[10.5px] font-semibold text-rose-600">
                      {lettersUnreadCount} unread
                    </span>
                  )}
                </div>

                {letters.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs font-medium text-slate-400">
                    No letters yet. Property &amp; NFT purchase certificates will arrive here.
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {letters.map((letter) => (
                      <button
                        key={letter.id}
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          setOpenLetter(letter);
                          if (!letter.isRead) {
                            setLetters((prev) =>
                              prev.map((l) => (l.id === letter.id ? { ...l, isRead: true } : l)),
                            );
                            void markLetterRead(letter.id);
                          }
                        }}
                        className="w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-sky-50/60 cursor-pointer transition-colors"
                      >
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            letter.isRead ? 'bg-slate-200' : 'bg-rose-500 ring-4 ring-rose-100'
                          }`}
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block truncate text-xs font-semibold text-slate-900">
                            {letter.title}
                          </span>
                          <span className="block text-[10.5px] text-slate-500 mt-0.5">
                            {new Date(letter.createdAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                            {letter.payload.priceAmount != null &&
                              ` · ${letter.payload.priceAmount} ${letter.payload.priceCurrency || 'RESPITE'}`}
                          </span>
                        </span>
                        <span className="text-[11px] font-semibold text-sky-600 shrink-0">
                          Open &rarr;
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3B. KAI CONTACT SUB-TAB (phone contact for the fish merchant) */}
          {activeTab === 'kai' && (
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

          {/* 4. SETTINGS SUB-TAB */}
          {activeTab === 'settings' && (
            <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 pr-0.5">
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-2.5">
                <div className="text-[11px] font-semibold text-slate-600">
                  Speech bubble color
                </div>
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
                            ? 'border-sky-500 ring-2 ring-sky-200 shadow-xs'
                            : 'border-slate-200/90 opacity-90 hover:opacity-100'
                        }`}
                      >
                        <span className="truncate">{swatch.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-600">
                    Game sound &amp; audio
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleAudio?.()}
                    className={`px-3 py-1 rounded-full font-semibold text-[10.5px] shadow-xs cursor-pointer transition-colors ${
                      isMuted
                        ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                        : 'bg-emerald-500 text-white hover:bg-emerald-600'
                    }`}
                  >
                    <span>{isMuted ? 'Muted' : 'Sound on'}</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Master Volume</span>
                    <span className="font-semibold text-slate-900">{isMuted ? 0 : audioVolumePct}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={isMuted ? 0 : audioVolumePct}
                    onChange={(e) => onChangeVolumePct?.(Number(e.target.value))}
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-600">
                    On-screen joystick (Desktop)
                  </span>
                  <button
                    type="button"
                    data-setting-desktop-joystick-btn="true"
                    onClick={() => onToggleShowJoystickOnDesktop?.()}
                    className={`px-3 py-1 rounded-full font-semibold text-[10.5px] shadow-xs cursor-pointer shrink-0 transition-colors ${
                      showJoystickOnDesktop
                        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{showJoystickOnDesktop ? 'Shown' : 'Hidden'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Show the touch joystick on desktop, so you can move without WASD.
                </p>
              </div>

              {isInsidePrivateHouse && onOpenHouseDecoration && (
                <div className="p-3.5 rounded-2xl bg-sky-50/90 border border-sky-200/80 shadow-xs flex items-center justify-between gap-2.5">
                  <div>
                    <div className="text-[11px] font-semibold text-sky-900">
                      Private house interior
                    </div>
                    <div className="text-[11px] text-sky-700">
                      Open furniture &amp; room theme settings
                    </div>
                  </div>
                  <button
                    type="button"
                    data-chat-setting-decorate-btn="true"
                    onClick={onOpenHouseDecoration}
                    className="px-3.5 py-1.5 rounded-full bg-sky-500 hover:bg-sky-600 text-white font-semibold text-[11px] shadow-xs cursor-pointer shrink-0 transition-colors"
                  >
                    <span>Decorate mode</span>
                  </button>
                </div>
              )}
            </div>
          )}
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
      className={`fixed left-3 bottom-24 z-40 w-[min(512px,95vw)] h-[min(724px,calc(100dvh-11.5rem))] select-none transition-all duration-300 ease-out transform ${
        isOpen
          ? 'translate-x-0 opacity-100 pointer-events-auto'
          : '-translate-x-[120%] opacity-0 pointer-events-none'
      }`}
    >
      {innerPanel}
    </aside>
  );
};
