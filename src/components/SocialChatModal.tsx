import React, { useState, useRef, useEffect, useMemo } from 'react';
import { soundEngine } from '../game/audio';
import {
  fetchLettersForAccount,
  markLetterRead,
  type BuddiesLetter,
} from '../lib/supabaseClient';
import { getNearBlocksTxUrl } from '../lib/nearClient';

export interface NearbyEntityUser {
  id: number | string;
  nearAccountId?: string;
  name: string;
  distance: number;
  isNpc?: boolean;
  isSelf?: boolean;
  team?: 'red' | 'blue';
  status?: string;
}

export interface ChatMessage {
  id: string;
  senderId?: string;
  senderName: string;
  recipientId?: string;
  recipientName?: string;
  isSelf?: boolean;
  text: string;
  timestamp: string;
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
}

type SocialChatSubTab = 'online' | 'public' | 'private' | 'kai' | 'settings';

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
  const seenIds = new Set<string>();
  const result: ChatMessage[] = [];

  for (const rawMsg of messages) {
    if (!rawMsg || !rawMsg.id) continue;
    if (seenIds.has(rawMsg.id)) continue;
    seenIds.add(rawMsg.id);

    const resolvedIsSelf = isOwnChatMessage(rawMsg, playerName, playerUid);
    const normalizedMsg: ChatMessage = {
      ...rawMsg,
      isSelf: resolvedIsSelf,
    };

    // Deduplicate optimistic local send ("pub-..." or "priv-...") against echoed DB realtime row
    if (resolvedIsSelf) {
      const cleanText = normalizedMsg.text.trim();
      const cleanRecipient = simplifyDisplayName(normalizedMsg.recipientName || '').toLowerCase();
      const duplicateIdx = result.findIndex((existing) => {
        if (!existing.isSelf) return false;
        if (existing.type !== normalizedMsg.type) return false;
        if (existing.text.trim() !== cleanText) return false;
        const existingRecipient = simplifyDisplayName(existing.recipientName || '').toLowerCase();
        if (existingRecipient !== cleanRecipient) return false;
        const isOneOptimisticAndOneDb =
          (existing.id.startsWith('pub-') || existing.id.startsWith('priv-')) !==
          (normalizedMsg.id.startsWith('pub-') || normalizedMsg.id.startsWith('priv-'));
        return isOneOptimisticAndOneDb || existing.timestamp === normalizedMsg.timestamp;
      });
      if (duplicateIdx >= 0) {
        result[duplicateIdx] = normalizedMsg;
        continue;
      }
    }

    result.push(normalizedMsg);
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
}) => {
  const [activeTab, setActiveTab] = useState<SocialChatSubTab>('public');
  const [letters, setLetters] = useState<BuddiesLetter[]>([]);
  const [openLetter, setOpenLetter] = useState<BuddiesLetter | null>(null);
  const lettersUnreadCount = letters.filter((l) => !l.isRead).length;
  const privateBadgeCount = unreadPrivateCount + lettersUnreadCount;

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
    if (activeTab !== 'private') setOpenLetter(null);
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

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-hidden={!isOpen}
      aria-label="Social Chat Room"
      data-social-chat-modal="true"
      className={`fixed left-3 bottom-24 z-40 w-[min(372px,94vw)] h-[min(724px,calc(100dvh-11.5rem))] select-none transition-all duration-300 ease-out transform ${
        isOpen
          ? 'translate-x-0 opacity-100 pointer-events-auto'
          : '-translate-x-[120%] opacity-0 pointer-events-none'
      }`}
    >
      {/* FLAT MODAL PANEL — game modal style, no phone frame */}
      <div className="relative h-full bg-white text-black border-4 border-black shadow-[8px_8px_0px_#000] flex flex-col overflow-hidden">
        {/* TOP TAB BAR — flat game-modal style (rifallah 14 Nov: like the BAG modal) */}
        <div className="flex items-start justify-between gap-2 px-3 pt-3 shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: 'online', label: 'ONLINE' },
                { id: 'public', label: 'PUBLIC' },
                { id: 'private', label: 'PRIVATE' },
                { id: 'settings', label: 'SETTINGS' },
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
                  className={`relative -skew-x-6 px-3 py-1.5 border-2 border-black font-black uppercase text-[10px] tracking-wide cursor-pointer transition-colors ${
                    active
                      ? 'bg-[#b8ff3c] text-black shadow-[3px_3px_0px_#000]'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className="skew-x-6 inline-block">{tab.label}</span>
                  {tab.id === 'private' && privateBadgeCount > 0 && (
                    <span
                      data-private-tab-unread-dot="true"
                      className="absolute -top-2 -right-2 min-w-4 h-4 px-0.5 rounded-full bg-[#ff3b30] border border-black text-white text-[8px] font-black flex items-center justify-center"
                    >
                      {privateBadgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            aria-label="Close Social Chat"
            className="-skew-x-6 w-8 h-8 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black shadow-[3px_3px_0px_#000] font-black text-xs flex items-center justify-center cursor-pointer active:scale-95 shrink-0"
          >
            <span className="skew-x-6 inline-block">X</span>
          </button>
        </div>
        <div className="mx-3 mt-2.5 border-b-[3px] border-black shrink-0" />

        {/* SUB-TAB BODY CONTENT */}
        <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden px-3 pt-3">
          {/* LETTER CERTIFICATE OVERLAY (opened from the PRIVATE tab inbox) */}
          {openLetter && activeTab === 'private' && (
            <div
              data-letter-certificate="true"
              className="absolute inset-0 z-20 flex flex-col bg-[#fdfcf8] px-4 py-3 overflow-y-auto"
            >
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  setOpenLetter(null);
                }}
                className="self-start -skew-x-6 px-2.5 py-1 bg-slate-900 text-white border-2 border-black shadow-[2px_2px_0px_#000] text-[9px] font-black uppercase cursor-pointer mb-3"
              >
                <span className="skew-x-6 inline-block">&larr; Back to Letters</span>
              </button>
              <div className="text-center text-[15px] font-black text-slate-900 leading-tight">
                {openLetter.title}
              </div>
              <div className="mt-1 text-center text-[9px] font-bold uppercase tracking-widest text-slate-500">
                Buddies Blitz &middot; Official Purchase Certificate
              </div>
              <div className="my-3 border-t-2 border-slate-900" />
              <p className="text-[11px] leading-relaxed text-slate-800">
                This certificate is made effective as of{' '}
                <strong>
                  {new Date(openLetter.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </strong>{' '}
                between{' '}
                <strong>
                  {openLetter.payload.buyerName || openLetter.payload.buyerAccount || 'Buyer'}
                </strong>{' '}
                (&ldquo;Buyer&rdquo;) and{' '}
                <strong>
                  {openLetter.payload.sellerName || openLetter.payload.sellerAccount || 'Seller'}
                </strong>{' '}
                (&ldquo;Seller&rdquo;).
              </p>
              <div className="mt-4 text-[12px] font-black text-slate-900">Asset.</div>
              <p className="text-[11px] leading-relaxed text-slate-800">
                {openLetter.payload.itemName || 'Digital asset'}
                {openLetter.payload.tokenId && (
                  <>
                    {' '}
                    &middot; Token ID <span className="font-mono">{openLetter.payload.tokenId}</span>
                  </>
                )}
                {openLetter.payload.deedTokenId && (
                  <>
                    {' '}
                    &middot; Deed <span className="font-mono">{openLetter.payload.deedTokenId}</span>
                  </>
                )}
                {openLetter.payload.estateAccount && (
                  <>
                    {' '}
                    &middot; Estate <span className="font-mono">{openLetter.payload.estateAccount}</span>
                  </>
                )}
              </p>
              {typeof openLetter.payload.priceAmount === 'number' && (
                <>
                  <div className="mt-4 text-[12px] font-black text-slate-900">Purchase Price.</div>
                  <p className="text-[11px] leading-relaxed text-slate-800">
                    The purchase price for the Asset shall be{' '}
                    <strong>
                      {openLetter.payload.priceAmount} {openLetter.payload.priceCurrency || 'RESPITE'}
                    </strong>
                    , settled in full on-chain at the time of purchase.
                  </p>
                </>
              )}
              <div className="mt-4 text-[12px] font-black text-slate-900">Settlement.</div>
              <p className="text-[11px] leading-relaxed text-slate-800">
                Settled atomically by the Buddies Blitz market contract
                {openLetter.payload.settlementContract && (
                  <>
                    {' '}
                    (<span className="font-mono">{openLetter.payload.settlementContract}</span>)
                  </>
                )}
                , acting as escrow and settlement agent for both parties.
              </p>
              {openLetter.txHash && (
                <p className="text-[11px] leading-relaxed text-slate-800">
                  Transaction:{' '}
                  <a
                    href={getNearBlocksTxUrl(openLetter.txHash, 'testnet')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sky-700 underline break-all"
                  >
                    {openLetter.txHash}
                  </a>
                </p>
              )}
              {openLetter.payload.paymentTx && (
                <p className="text-[11px] leading-relaxed text-slate-800">
                  Payment transaction:{' '}
                  <a
                    href={getNearBlocksTxUrl(openLetter.payload.paymentTx, 'testnet')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sky-700 underline break-all"
                  >
                    {openLetter.payload.paymentTx}
                  </a>
                </p>
              )}
              <div className="my-3 border-t border-slate-300" />
              <p className="text-[9.5px] leading-relaxed text-slate-500 text-center">
                Issued in-world by Buddies Blitz. Keep this letter in your phone as your proof of
                ownership — the on-chain record is the final authority.
              </p>
            </div>
          )}

          {/* 1. ONLINE LIST SUB-TAB (Real Human Multiplayer Peers Only) */}
          {activeTab === 'online' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-600">
                <span>CONNECTED PLAYERS IN ZONE</span>
                <span className="px-2 py-0.5 bg-[#b8ff3c] text-black border border-black">
                  {realHumanOnlinePeers.length} PEER{realHumanOnlinePeers.length === 1 ? '' : 'S'}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {realHumanOnlinePeers.length === 0 ? (
                  <div
                    data-social-online-empty="true"
                    className="h-44 flex flex-col items-center justify-center text-center p-4 bg-slate-50 border-2 border-dashed border-slate-300 text-slate-500 text-xs font-bold"
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
                        className={`p-2.5 border-2 border-black transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-[#facc15] text-black shadow-[3px_3px_0px_#000]'
                            : 'bg-slate-50 hover:bg-slate-100 text-black shadow-[2px_2px_0px_#000]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-black bg-[#10b981]" />
                          <div className="truncate">
                            <div className="text-xs font-black uppercase truncate">
                              {simplifyDisplayName(u.name)}
                            </div>
                            <div className="text-[10px] font-bold text-slate-600">
                              Online Player · {u.distance}m away
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
                          className="-skew-x-6 px-2.5 py-1 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black font-black text-[10px] uppercase border border-black shadow-[1px_1px_0px_#000] shrink-0"
                        >
                          <span className="skew-x-6 inline-block">WHISPER</span>
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
              <div className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-600">
                <span>ALL CITIZENS ROOM FEED</span>
                <span className="text-[10px] font-bold text-slate-500">Overhead Bubble Active</span>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50 border-2 border-black shadow-inner">
                {publicMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs font-bold">
                    No public messages yet. Say hello to everyone in the room!
                  </div>
                ) : (
                  publicMessages.map((msg) => {
                    const isSelf = Boolean(msg.isSelf);
                    return (
                      <div
                        key={msg.id}
                        data-chat-message-id={msg.id}
                        data-chat-is-self={isSelf ? 'true' : 'false'}
                        className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5 px-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                            {isSelf
                              ? `${simplifyDisplayName(playerName)} (YOU)`
                              : simplifyDisplayName(msg.senderName)}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400">
                            {msg.timestamp}
                          </span>
                        </div>
                        <div
                          style={
                            isSelf
                              ? {
                                  backgroundColor: playerBubbleBgColor,
                                  color: playerBubbleTextColor,
                                }
                              : undefined
                          }
                          className={`max-w-[85%] px-3 py-2 text-xs font-bold leading-snug border-2 border-black shadow-[2px_2px_0px_#000] ${
                            isSelf ? '' : 'bg-white text-black'
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
              {/* LETTERS INBOX — purchase certificates delivered in-world */}
              <div
                data-letters-inbox="true"
                className="mb-2 border-2 border-black bg-[#fffdf5] shrink-0"
              >
                <div className="px-2.5 py-1.5 flex items-center justify-between bg-[#fef3c7] border-b-2 border-black">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                    Letters
                  </span>
                  {lettersUnreadCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-[#ff3b30] text-white border border-black text-[8.5px] font-black uppercase">
                      {lettersUnreadCount} NEW
                    </span>
                  )}
                </div>
                {letters.length === 0 ? (
                  <div className="px-2.5 py-2 text-[10px] font-bold text-slate-500">
                    No letters yet. Property &amp; NFT purchase certificates will arrive here.
                  </div>
                ) : (
                  <div className="max-h-32 overflow-y-auto divide-y divide-slate-200">
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
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-amber-50 cursor-pointer"
                      >
                        <span
                          className={`w-2 h-2 rounded-full border border-black shrink-0 ${
                            letter.isRead ? 'bg-slate-300' : 'bg-[#ff3b30]'
                          }`}
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block truncate text-[10.5px] font-black text-slate-800">
                            {letter.title}
                          </span>
                          <span className="block text-[8.5px] font-bold text-slate-400">
                            {new Date(letter.createdAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                            {letter.payload.priceAmount != null &&
                              ` · ${letter.payload.priceAmount} ${letter.payload.priceCurrency || 'RESPITE'}`}
                          </span>
                        </span>
                        <span className="text-[9px] font-black text-slate-400 shrink-0">OPEN &rarr;</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-black uppercase tracking-wider text-slate-600">
                <span className="truncate">
                  {validSelectedPrivateUser
                    ? `WHISPER TO: ${simplifyDisplayName(validSelectedPrivateUser.name)}`
                    : 'SELECT A REAL ONLINE PLAYER TO WHISPER'}
                </span>
                {realHumanOnlinePeers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setActiveTab('online');
                    }}
                    className="-skew-x-6 px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-black text-[9px] font-black uppercase border border-black cursor-pointer shrink-0"
                  >
                    <span className="skew-x-6 inline-block">SWITCH TARGET</span>
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
                        className={`-skew-x-6 px-2.5 py-1 border-2 border-black text-[10px] font-black uppercase shrink-0 cursor-pointer ${
                          isTarget
                            ? 'bg-[#facc15] text-black shadow-[2px_2px_0px_#000]'
                            : 'bg-white hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span className="skew-x-6 inline-block">
                          {simplifyDisplayName(peer.name)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50 border-2 border-black shadow-inner">
                {!validSelectedPrivateUser ? (
                  <div
                    data-social-private-empty="true"
                    className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs font-bold gap-2"
                  >
                    <span>
                      {realHumanOnlinePeers.length === 0
                        ? 'No other real human players are currently online for private whisper.'
                        : 'Select an online player above or from ONLINE LIST to start a private whisper.'}
                    </span>
                    {realHumanOnlinePeers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          setActiveTab('online');
                        }}
                        className="-skew-x-6 px-3 py-1.5 bg-[#facc15] text-black font-black text-[10px] uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                      >
                        <span className="skew-x-6 inline-block">OPEN ONLINE LIST</span>
                      </button>
                    )}
                  </div>
                ) : privateMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs font-bold">
                    Start a private whisper with{' '}
                    <span className="text-black font-black uppercase mt-0.5">
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
                        <div className="flex items-center gap-1.5 mb-0.5 px-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                            {isSelf
                              ? `YOU -> ${simplifyDisplayName(msg.recipientName || validSelectedPrivateUser.name)}`
                              : simplifyDisplayName(msg.senderName)}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400">
                            {msg.timestamp}
                          </span>
                        </div>
                        <div
                          className={`max-w-[85%] px-3 py-2 text-xs font-bold leading-snug border-2 border-black shadow-[2px_2px_0px_#000] ${
                            isSelf ? 'bg-[#facc15] text-black' : 'bg-white text-black'
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

          {/* 3B. KAI CONTACT SUB-TAB (phone contact for the fish merchant) */}
          {activeTab === 'kai' && (
            <div className="flex-1 overflow-y-auto space-y-3 pr-1" data-kai-contact="true">
              <div className="p-3 bg-[#e0f2fe] border-2 border-black shadow-[2px_2px_0px_#000]">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 shrink-0 rounded-full bg-[#0284c7] border-2 border-black flex items-center justify-center text-white font-black text-lg">
                    K
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm uppercase tracking-wide">Kai</span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#b8ff3c] border border-black text-[8px] font-black uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-black inline-block" />
                        Online
                      </span>
                    </div>
                    <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                      Fisherman &amp; Beach Keeper · East Beach
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start">
                <div className="flex items-center gap-1.5 mb-0.5 px-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                    Kai
                  </span>
                </div>
                <div className="max-w-[92%] px-3 py-2 text-xs font-bold leading-snug bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]">
                  {kaiRawFishCount > 0
                    ? 'Heard you caught something! I buy raw fish, and we can haggle the price right in chat — by phone too. Feel free to ask.'
                    : "Hey! I'm Kai, fisherman and beach keeper at East Beach. Catch a fish and I'll buy it — we can even haggle the price in chat. Feel free to ask."}
                </div>
              </div>

              {kaiRawFishCount > 0 ? (
                <div className="p-3 bg-[#fef08a] border-2 border-black shadow-[2px_2px_0px_#000] space-y-2">
                  <div className="text-[11px] font-black uppercase tracking-wider">
                    {kaiRawFishCount} raw fish in your bucket
                  </div>
                  <p className="text-[11px] font-bold leading-snug">
                    Kai is buying. Open the chat and tap START HAGGLING on the trade card.
                  </p>
                  <button
                    type="button"
                    data-kai-call-button="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      onCallKai?.();
                    }}
                    className="w-full px-3 py-2.5 bg-[#facc15] hover:bg-[#fde047] text-black border-2 border-black shadow-[3px_3px_0px_#000] font-black text-[11px] uppercase tracking-wider cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
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
                    className="w-full px-3 py-2.5 bg-[#facc15] hover:bg-[#fde047] text-black border-2 border-black shadow-[3px_3px_0px_#000] font-black text-[11px] uppercase tracking-wider cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
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
                    className="w-full px-3 py-2.5 bg-white hover:bg-slate-100 text-black border-2 border-black shadow-[3px_3px_0px_#000] font-black text-[11px] uppercase tracking-wider cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                  >
                    Meet Kai at East Beach
                  </button>
                  <p className="text-[10px] font-bold text-slate-500 leading-snug">
                    No fish yet? Kai waits at East Beach — follow the marker, or call him first and
                    say hello.
                  </p>
                </div>
              )}

              <p className="text-[10px] font-bold text-slate-500 leading-snug">
                Phone haggling covers raw fish for LUL. Fish NFT trades happen at Kai&apos;s market
                stall in person.
              </p>
            </div>
          )}

          {/* 4. SETTINGS SUB-TAB */}
          {activeTab === 'settings' && (
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <div className="p-3 bg-slate-50 border-2 border-black shadow-[2px_2px_0px_#000] space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                  SPEECH BUBBLE COLOR
                </div>
                <div className="grid grid-cols-3 gap-2">
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
                        className={`px-2.5 py-2 border-2 border-black text-[10px] font-black uppercase flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'ring-2 ring-black shadow-[3px_3px_0px_#000] -translate-y-0.5'
                            : 'opacity-85 hover:opacity-100'
                        }`}
                      >
                        <span className="truncate">{swatch.label}</span>
                        {isSelected && <span>OK</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 bg-slate-50 border-2 border-black shadow-[2px_2px_0px_#000] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                    GAME SOUND &amp; AUDIO
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleAudio?.()}
                    className={`-skew-x-6 px-3 py-1 font-black text-[10px] uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer ${
                      isMuted ? 'bg-[#ff3b30] text-white' : 'bg-[#b8ff3c] text-black'
                    }`}
                  >
                    <span className="skew-x-6 inline-block">{isMuted ? 'MUTED' : 'SOUND ON'}</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
                    <span>Master Volume</span>
                    <span className="font-black text-black">{isMuted ? 0 : audioVolumePct}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={isMuted ? 0 : audioVolumePct}
                    onChange={(e) => onChangeVolumePct?.(Number(e.target.value))}
                    className="w-full accent-black cursor-pointer"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border-2 border-black shadow-[2px_2px_0px_#000] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                    ON-SCREEN JOYSTICK (DESKTOP)
                  </span>
                  <button
                    type="button"
                    data-setting-desktop-joystick-btn="true"
                    onClick={() => onToggleShowJoystickOnDesktop?.()}
                    className={`-skew-x-6 px-3 py-1 font-black text-[10px] uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer shrink-0 ${
                      showJoystickOnDesktop
                        ? 'bg-[#b8ff3c] text-black'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="skew-x-6 inline-block">
                      {showJoystickOnDesktop ? 'SHOWN' : 'HIDDEN'}
                    </span>
                  </button>
                </div>
                <p className="text-[11px] font-bold text-slate-600">
                  Show the touch joystick and the camera flip button on desktop, so you
                  can move without WASD. The camera flip is available on the main map
                  only, never in Warzone.
                </p>
              </div>

              {isInsidePrivateHouse && onOpenHouseDecoration && (
                <div className="p-3 bg-[#fef9c3] border-2 border-[#0d0f12] shadow-[3px_3px_0px_#000] flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-black uppercase text-[#0d0f12]">
                      PRIVATE HOUSE INTERIOR
                    </div>
                    <div className="text-[11px] font-bold text-slate-700">
                      Open furniture &amp; room theme settings
                    </div>
                  </div>
                  <button
                    type="button"
                    data-chat-setting-decorate-btn="true"
                    onClick={onOpenHouseDecoration}
                    className="-skew-x-6 px-3 py-1.5 bg-[#b8ff3c] hover:bg-[#d2ff7a] text-[#0d0f12] font-black text-[10px] uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer shrink-0 transition-colors"
                  >
                    <span className="skew-x-6 inline-block">DECORATE MODE</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </aside>
  );
};
