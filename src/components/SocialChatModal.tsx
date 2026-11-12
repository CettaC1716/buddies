import React, { useState, useRef, useEffect, useMemo } from 'react';
import { soundEngine } from '../game/audio';

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
  kaiHasMet = false,
  onCallKai,
  onMeetKai,
}) => {
  const [activeTab, setActiveTab] = useState<SocialChatSubTab>('public');
  const [phoneClock, setPhoneClock] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPhoneClock(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      );
    }, 20000);
    return () => window.clearInterval(timer);
  }, []);

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
      className={`fixed left-3 bottom-3 z-40 w-[min(372px,94vw)] h-[min(724px,calc(100dvh-6rem))] select-none transition-all duration-300 ease-out transform ${
        isOpen
          ? 'translate-x-0 opacity-100 pointer-events-auto'
          : '-translate-x-[120%] opacity-0 pointer-events-none'
      }`}
    >
      {/* PHONE FRAME: titanium body, side buttons, punch-hole camera */}
      <div className="relative h-full rounded-[2.7rem] bg-[#17181c] border-[3px] border-black shadow-[6px_6px_0px_#000] p-[10px]">
        <div className="absolute -left-[6px] top-28 w-[5px] h-10 bg-[#17181c] border-2 border-black rounded-l-md" />
        <div className="absolute -left-[6px] top-[11.5rem] w-[5px] h-14 bg-[#17181c] border-2 border-black rounded-l-md" />
        <div className="absolute -right-[6px] top-36 w-[5px] h-16 bg-[#17181c] border-2 border-black rounded-r-md" />
        {/* PHONE SCREEN */}
        <div className="relative bg-white text-black rounded-[2.1rem] flex flex-col h-full overflow-hidden">
          <div className="absolute left-1/2 -translate-x-1/2 top-[6px] w-3.5 h-3.5 rounded-full bg-[#17181c] border border-black z-20 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-[#46586b]" />
          </div>
          {/* STATUS BAR */}
          <div className="shrink-0 flex items-center justify-between px-5 pt-2 pb-1 text-[9px] font-black uppercase tracking-wider text-slate-600">
            <span>{phoneClock}</span>
            <span className="text-slate-400">Buddies OS</span>
            <span className="flex items-center gap-1.5">
              <span className="flex items-end gap-[2px]">
                <span className="w-[3px] h-[4px] bg-slate-700 inline-block" />
                <span className="w-[3px] h-[6px] bg-slate-700 inline-block" />
                <span className="w-[3px] h-[8px] bg-slate-700 inline-block" />
                <span className="w-[3px] h-[10px] bg-slate-300 inline-block" />
              </span>
              <span className="w-6 h-3 border-2 border-slate-700 rounded-[3px] p-[1px] flex">
                <span className="bg-[#b8ff3c] w-[70%] h-full inline-block" />
              </span>
            </span>
          </div>
        {/* APP HEADER */}
        <div className="flex items-center justify-between gap-2 px-4 pt-1 pb-2.5 border-b-[2.5px] border-black shrink-0">
          <div className="min-w-0">
            <div className="font-black text-[13px] uppercase tracking-wider leading-tight">
              {
                {
                  online: 'Online List',
                  public: 'Public Chat',
                  private: 'Private Chat',
                  kai: 'Kai · Fish Market',
                  settings: 'Settings',
                }[activeTab]
              }
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 leading-tight">
              {activeTab === 'online'
                ? `${realHumanOnlinePeers.length} peer${realHumanOnlinePeers.length === 1 ? '' : 's'} in zone`
                : activeTab === 'kai'
                  ? 'Fisherman & Beach Keeper'
                  : 'Buddies Phone'}
            </div>
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

        {/* SUB-TAB BODY CONTENT */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-3 pt-3">
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

        {/* PHONE BOTTOM MENU */}
        <div className="shrink-0 border-t-[2.5px] border-black bg-white px-1.5 pt-1.5 pb-1.5">
          <div className="flex items-stretch justify-between gap-1">
            {(
              [
                {
                  id: 'online',
                  label: 'ONLINE',
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  ),
                },
                {
                  id: 'public',
                  label: 'PUBLIC',
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    </svg>
                  ),
                },
                {
                  id: 'private',
                  label: 'PRIVATE',
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="M22 6l-10 7L2 6" />
                    </svg>
                  ),
                },
                {
                  id: 'kai',
                  label: 'KAI',
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  ),
                },
                {
                  id: 'settings',
                  label: 'SETTINGS',
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <line x1="4" y1="21" x2="4" y2="14" />
                      <line x1="4" y1="10" x2="4" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12" y2="3" />
                      <line x1="20" y1="21" x2="20" y2="16" />
                      <line x1="20" y1="12" x2="20" y2="3" />
                      <line x1="1" y1="14" x2="7" y2="14" />
                      <line x1="9" y1="8" x2="15" y2="8" />
                      <line x1="17" y1="16" x2="23" y2="16" />
                    </svg>
                  ),
                },
              ] as { id: SocialChatSubTab; label: string; icon: React.ReactNode }[]
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
                  className={`flex-1 flex flex-col items-center gap-0.5 px-1 py-1.5 border-2 transition-all cursor-pointer ${
                    active
                      ? 'bg-[#facc15] text-black border-black shadow-[2px_2px_0px_#000] -translate-y-0.5'
                      : 'text-slate-500 border-transparent hover:bg-slate-100'
                  }`}
                >
                  <span className="relative">
                    {tab.icon}
                    {tab.id === 'private' && unreadPrivateCount > 0 && (
                      <span
                        data-private-tab-unread-dot="true"
                        className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-0.5 rounded-full bg-[#ff3b30] border border-black text-white text-[8px] font-black flex items-center justify-center"
                      >
                        {unreadPrivateCount}
                      </span>
                    )}
                    {tab.id === 'kai' && (!kaiHasMet || kaiRawFishCount > 0) && (
                      <span
                        data-kai-tab-unread-dot="true"
                        className="absolute -top-1.5 -right-2 w-2.5 h-2.5 rounded-full bg-[#ff3b30] border border-black inline-block"
                      />
                    )}
                  </span>
                  <span className="text-[8px] font-black uppercase tracking-wider">{tab.label}</span>
                </button>
              );
            })}
          </div>
          <div className="mx-auto mt-1.5 h-1 w-24 rounded-full bg-black/70" />
        </div>
        </div>
      </div>
    </aside>
  );
};
