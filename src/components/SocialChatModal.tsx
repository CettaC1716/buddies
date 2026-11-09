import React, { useState, useEffect, useRef } from 'react';
import { soundEngine } from '../game/audio';

export interface NearbyEntityUser {
  id: string | number;
  name: string;
  isNpc: boolean;
  distance: number;
  team: 'blue' | 'red';
  status: string;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  senderId?: string | number;
  isNpc?: boolean;
  isSelf?: boolean;
  text: string;
  timestamp: string;
  type: 'public' | 'private';
  recipientName?: string;
}

interface SocialChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName?: string;
  playerUid?: string;
  onChangePlayerName?: (newName: string) => void;
  nearbyUsers: NearbyEntityUser[];
  onSendPublicChat: (text: string) => void;
  onSendPrivateChat: (recipient: NearbyEntityUser, text: string) => void;
  chatMessages: ChatMessage[];
  selectedPrivateUser: NearbyEntityUser | null;
  onSelectPrivateUser: (user: NearbyEntityUser | null) => void;
  playerBubbleBgColor?: string;
  playerBubbleTextColor?: string;
  isInsidePrivateHouse?: boolean;
  isMuted?: boolean;
  audioVolumePct?: number;
  onToggleAudio?: () => void;
  onChangeVolumePct?: (pct: number) => void;
  onOpenHouseDecoration?: () => void;
  onChangeBubbleBgColor?: (hex: string) => void;
  onChangeBubbleTextColor?: (hex: string) => void;
}

const simplifyDisplayName = (rawName: string): string => {
  return rawName.replace(/\s*\([^)]*\)/g, '').trim() || rawName;
};

export const SocialChatModal: React.FC<SocialChatModalProps> = ({
  isOpen,
  onClose,
  playerName = 'YOU',
  playerUid = '',
  onChangePlayerName,
  nearbyUsers,
  onSendPublicChat,
  onSendPrivateChat,
  chatMessages,
  selectedPrivateUser,
  onSelectPrivateUser,
  playerBubbleBgColor = '#38bdf8',
  playerBubbleTextColor = '#0f172a',
  isInsidePrivateHouse = false,
  isMuted = false,
  audioVolumePct = 100,
  onToggleAudio,
  onChangeVolumePct,
  onOpenHouseDecoration,
  onChangeBubbleBgColor,
  onChangeBubbleTextColor,
}) => {
  const [activeTab, setActiveTab] = useState<'publik' | 'private' | 'daftar_online' | 'settings'>('publik');
  const [usernameDraft, setUsernameDraft] = useState<string>(playerName);
  const [usernameSavedFlash, setUsernameSavedFlash] = useState<boolean>(false);
  const publicScrollRef = useRef<HTMLDivElement>(null);
  const privateScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUsernameDraft(playerName);
  }, [playerName]);

  // Switch to PRIVATE tab automatically when a private user is chosen externally (e.g. BISIKAN button)
  useEffect(() => {
    if (selectedPrivateUser && isOpen) {
      setActiveTab('private');
    }
  }, [selectedPrivateUser, isOpen]);

  // Auto scroll messages to bottom
  useEffect(() => {
    if (publicScrollRef.current) {
      publicScrollRef.current.scrollTop = publicScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isOpen, activeTab]);

  useEffect(() => {
    if (privateScrollRef.current) {
      privateScrollRef.current.scrollTop = privateScrollRef.current.scrollHeight;
    }
  }, [chatMessages, selectedPrivateUser, isOpen, activeTab]);

  // Receive chat submissions from the persistent bottom-left chat input bar when SocialChatModal is open
  useEffect(() => {
    if (!isOpen) return;
    const onBottomBarSubmit = (ev: Event) => {
      const text = (ev as CustomEvent<{ text?: string }>).detail?.text?.trim();
      if (!text) return;
      if (activeTab === 'private' && selectedPrivateUser) {
        onSendPrivateChat(selectedPrivateUser, text);
      } else {
        setActiveTab('publik');
        onSendPublicChat(text);
      }
    };
    window.addEventListener('social-chat-bar-submit', onBottomBarSubmit);
    return () => window.removeEventListener('social-chat-bar-submit', onBottomBarSubmit);
  }, [isOpen, activeTab, selectedPrivateUser, onSendPrivateChat, onSendPublicChat]);

  const publicMessages = chatMessages.filter((m) => m.type === 'public');
  const selectedShortName = selectedPrivateUser
    ? simplifyDisplayName(selectedPrivateUser.name)
    : '';
  const privateMessages = chatMessages.filter(
    (m) =>
      m.type === 'private' &&
      selectedPrivateUser &&
      (simplifyDisplayName(m.senderName) === selectedShortName ||
        simplifyDisplayName(m.recipientName || '') === selectedShortName ||
        m.senderName === selectedPrivateUser.name ||
        m.recipientName === selectedPrivateUser.name),
  );

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-hidden={!isOpen}
      aria-label="Social Communication & Radius Chat"
      data-social-chat-modal="true"
      className={`fixed left-4 top-16 bottom-20 z-40 w-full max-w-lg flex flex-col select-none transition-all duration-300 ease-out transform ${
        isOpen
          ? 'translate-x-0 opacity-100 pointer-events-auto'
          : '-translate-x-[120%] opacity-0 pointer-events-none'
      }`}
    >
      <div className="relative flex-1 flex flex-col bg-white border-[3.5px] border-black shadow-[4px_4px_0px_#000] p-4 sm:p-5 text-black overflow-hidden min-h-0">
        {/* Top Bar: 3 Navigation Tab Buttons (PUBLIC, PRIVATE, ONLINE LIST) + X Close */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b-[2.5px] border-black shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              data-social-tab="publik"
              onClick={() => {
                soundEngine.playUiClick();
                setActiveTab('publik');
              }}
              className={`-skew-x-6 px-3 py-1 border-2 border-black shadow-[3px_3px_0px_#000] text-[11px] font-black uppercase cursor-pointer transition-all ${
                activeTab === 'publik'
                  ? 'bg-[#facc15] text-black -translate-y-0.5'
                  : 'bg-slate-50 hover:bg-[#fef08a] text-black'
              }`}
            >
              <span className="skew-x-6 inline-block">PUBLIC</span>
            </button>

            <button
              type="button"
              data-social-tab="private"
              onClick={() => {
                soundEngine.playUiClick();
                setActiveTab('private');
              }}
              className={`-skew-x-6 px-3 py-1 border-2 border-black shadow-[3px_3px_0px_#000] text-[11px] font-black uppercase cursor-pointer transition-all ${
                activeTab === 'private'
                  ? 'bg-[#10b981] text-black -translate-y-0.5'
                  : 'bg-slate-50 hover:bg-[#a7f3d0] text-black'
              }`}
            >
              <span className="skew-x-6 inline-block">PRIVATE</span>
            </button>

            <button
              type="button"
              data-social-tab="daftar_online"
              onClick={() => {
                soundEngine.playUiClick();
                setActiveTab('daftar_online');
              }}
              className={`-skew-x-6 px-3 py-1 border-2 border-black shadow-[3px_3px_0px_#000] text-[11px] font-black uppercase cursor-pointer transition-all ${
                activeTab === 'daftar_online'
                  ? 'bg-[#38bdf8] text-black -translate-y-0.5'
                  : 'bg-slate-50 hover:bg-[#bae6fd] text-black'
              }`}
            >
              <span className="skew-x-6 inline-block">ONLINE LIST</span>
            </button>

            <button
              type="button"
              data-social-tab="settings"
              onClick={() => {
                soundEngine.playUiClick();
                setActiveTab('settings');
              }}
              className={`-skew-x-6 px-3 py-1 border-2 border-black shadow-[3px_3px_0px_#000] text-[11px] font-black uppercase cursor-pointer transition-all ${
                activeTab === 'settings'
                  ? 'bg-[#d8b4fe] text-black -translate-y-0.5'
                  : 'bg-slate-50 hover:bg-[#f3e8ff] text-black'
              }`}
            >
              <span className="skew-x-6 inline-block">SETTINGS</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            className="-skew-x-6 w-8 h-8 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black shadow-[3px_3px_0px_#000] font-black text-xs flex items-center justify-center cursor-pointer active:scale-95"
            aria-label="Close Social Chat"
          >
            <span className="skew-x-6 inline-block">X</span>
          </button>
        </div>

        {/* Tab 1: PUBLIC */}
        {activeTab === 'publik' && (
          <div
            ref={publicScrollRef}
            className="mt-3 flex-1 overflow-y-auto pr-1 space-y-2.5 min-h-0"
          >
            {publicMessages.length === 0 ? (
              <div className="p-4 text-center text-xs font-bold text-slate-600">
                No public messages yet. Use the chat bar below to say hello!
              </div>
            ) : (
              publicMessages.map((msg) => {
                const displaySender = simplifyDisplayName(msg.senderName);
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] font-black">
                      <span
                        className={
                          msg.isNpc
                            ? 'text-[#b45309]'
                            : msg.isSelf
                            ? 'text-[#0284c7]'
                            : 'text-[#334155]'
                        }
                      >
                        {displaySender}
                      </span>
                      <span className="text-[#64748b] font-bold">{msg.timestamp}</span>
                    </div>
                    <div
                      style={
                        msg.isSelf
                          ? {
                              backgroundColor: playerBubbleBgColor,
                              color: playerBubbleTextColor,
                            }
                          : undefined
                      }
                      className={`px-3 py-2 border-2 border-[#0d0f12] max-w-[92%] text-xs font-bold shadow-[3px_3px_0_#0d0f12] break-words ${
                        msg.isSelf
                          ? ''
                          : msg.isNpc
                          ? 'bg-[#fef08a] text-black'
                          : 'bg-white text-[#0d0f12]'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 2: PRIVATE */}
        {activeTab === 'private' && (
          <div className="mt-3 flex-1 flex flex-col min-h-0 space-y-2.5">
            {selectedPrivateUser && (
              <div className="px-3 py-2 bg-slate-50 border-2 border-black shadow-[2px_2px_0_#000] flex items-center justify-between shrink-0">
                <span className="text-xs font-black uppercase text-black">
                  WHISPER: {simplifyDisplayName(selectedPrivateUser.name)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setActiveTab('daftar_online');
                  }}
                  className="-skew-x-6 px-2 py-0.5 bg-white hover:bg-[#fef08a] border border-black text-[10px] font-black uppercase cursor-pointer"
                >
                  <span className="skew-x-6 inline-block">CHANGE</span>
                </button>
              </div>
            )}

            <div
              ref={privateScrollRef}
              className="flex-1 overflow-y-auto pr-1 space-y-2.5 min-h-0"
            >
              {!selectedPrivateUser ? (
                <div className="p-5 text-center space-y-3 bg-slate-50 border-2 border-black shadow-[3px_3px_0_#000]">
                  <p className="text-xs font-bold text-slate-700">
                    Select a citizen or NPC in the ONLINE LIST tab to start a private chat.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setActiveTab('daftar_online');
                    }}
                    className="-skew-x-6 px-3.5 py-1.5 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black border-2 border-black shadow-[2px_2px_0_#000] text-xs font-black uppercase cursor-pointer"
                  >
                    <span className="skew-x-6 inline-block">OPEN ONLINE LIST</span>
                  </button>
                </div>
              ) : privateMessages.length === 0 ? (
                <div className="p-4 text-center text-xs font-bold text-slate-600 bg-slate-50 border-2 border-black">
                  Private chat with {simplifyDisplayName(selectedPrivateUser.name)}. Type a message in the bottom chat bar to whisper!
                </div>
              ) : (
                privateMessages.map((msg) => {
                  const displaySender = simplifyDisplayName(msg.senderName);
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-[10px] font-black">
                        <span className={msg.isSelf ? 'text-[#0284c7]' : 'text-[#dc2626]'}>
                          {displaySender}
                        </span>
                        <span className="text-[#64748b] font-bold">{msg.timestamp}</span>
                      </div>
                      <div
                        style={
                          msg.isSelf
                            ? {
                                backgroundColor: playerBubbleBgColor,
                                color: playerBubbleTextColor,
                              }
                            : undefined
                        }
                        className={`px-3 py-2 border-2 border-[#0d0f12] max-w-[92%] text-xs font-bold shadow-[3px_3px_0_#0d0f12] break-words ${
                          msg.isSelf ? '' : 'bg-[#fef08a] text-black'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 3: ONLINE LIST */}
        {activeTab === 'daftar_online' && (
          <div className="mt-3 flex-1 overflow-y-auto pr-1 space-y-2.5 min-h-0">
            {nearbyUsers.length === 0 ? (
              <div className="p-4 text-center text-xs font-bold text-slate-600 bg-slate-50 border-2 border-black">
                No other citizens are currently in this area.
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {nearbyUsers.map((user) => {
                  const isSelected = selectedPrivateUser?.id === user.id;
                  const shortName = simplifyDisplayName(user.name);
                  return (
                    <button
                      key={String(user.id)}
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        onSelectPrivateUser(user);
                        setActiveTab('private');
                      }}
                      className={`-skew-x-6 px-3 py-1.5 border-2 border-black cursor-pointer transition-all flex items-center gap-2 ${
                        isSelected
                          ? 'bg-[#38bdf8] text-black shadow-[3px_3px_0_#000]'
                          : 'bg-slate-50 hover:bg-[#fef08a] text-black shadow-[2px_2px_0_#000]'
                      }`}
                    >
                      <div className="skew-x-6 flex items-center gap-2">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] border border-black ${
                            user.isNpc ? 'bg-[#facc15] text-black' : 'bg-white text-black'
                          }`}
                        >
                          {shortName.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="text-xs font-black uppercase">{shortName}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: SETTINGS (Change Username Anytime, Sound Toggle, House Decoration when Inside House, Chat Colors) */}
        {activeTab === 'settings' && (
          <div
            data-social-chat-settings-panel="true"
            className="mt-3 flex-1 overflow-y-auto pr-1 space-y-3.5 min-h-0"
          >
            {/* 0. Player UID (Wallet Address) & Change Username Anytime */}
            <div
              data-social-modal-change-username="true"
              className="p-3 bg-slate-50 border-2 border-black shadow-[3px_3px_0_#000] space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wide text-black">
                  PLAYER IDENTITY &amp; CHANGE USERNAME
                </span>
                {playerUid && (
                  <span
                    data-social-modal-player-uid="true"
                    className="px-2 py-0.5 bg-[#0f172a] text-[#38bdf8] font-mono text-[9.5px] font-bold border border-black truncate max-w-[200px]"
                    title={`Player UID: ${playerUid}`}
                  >
                    UID: {playerUid}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  maxLength={24}
                  data-social-modal-username-input="true"
                  value={usernameDraft}
                  onChange={(e) => setUsernameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && usernameDraft.trim()) {
                      soundEngine.playUiClick();
                      onChangePlayerName?.(usernameDraft.trim());
                      setUsernameSavedFlash(true);
                      window.setTimeout(() => setUsernameSavedFlash(false), 1800);
                    }
                  }}
                  placeholder="Enter new username..."
                  aria-label="Change Display Username"
                  className="flex-1 min-w-0 px-2.5 py-1.5 bg-white text-black font-bold text-xs border-2 border-black focus:outline-none focus:ring-2 focus:ring-[#38bdf8]"
                />
                <button
                  type="button"
                  data-social-modal-save-username-btn="true"
                  onClick={() => {
                    if (!usernameDraft.trim()) return;
                    soundEngine.playUiClick();
                    onChangePlayerName?.(usernameDraft.trim());
                    setUsernameSavedFlash(true);
                    window.setTimeout(() => setUsernameSavedFlash(false), 1800);
                  }}
                  className="-skew-x-6 px-3 py-1.5 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-2 border-black shadow-[2px_2px_0_#000] text-[10.5px] font-black uppercase cursor-pointer active:scale-95 shrink-0"
                >
                  <span className="skew-x-6 inline-block">
                    {usernameSavedFlash ? 'SAVED ✓' : 'SAVE NAME'}
                  </span>
                </button>
              </div>
            </div>

            {/* 1. Sound Toggle & Volume Control */}
            <div className="p-3 bg-slate-50 border-2 border-black shadow-[3px_3px_0_#000] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wide text-black">
                  SOUND &amp; AUDIO SETTINGS
                </span>
                <button
                  type="button"
                  data-social-modal-sound-toggle="true"
                  onClick={() => onToggleAudio?.()}
                  className={`-skew-x-6 px-3 py-1 border-2 border-black shadow-[2px_2px_0_#000] text-[10.5px] font-black uppercase cursor-pointer transition-all ${
                    isMuted ? 'bg-[#ff3b30] text-white' : 'bg-[#10b981] text-black'
                  }`}
                >
                  <span className="skew-x-6 inline-block">
                    {isMuted ? 'SOUND: MUTE' : 'SOUND: ON'}
                  </span>
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10.5px] font-black uppercase text-slate-700 min-w-[68px]">
                  VOLUME {isMuted ? 0 : audioVolumePct}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={isMuted ? 0 : audioVolumePct}
                  onChange={(e) => onChangeVolumePct?.(Number(e.target.value))}
                  aria-label="Master Volume"
                  className="flex-1 h-2.5 accent-[#10b981] cursor-pointer"
                />
              </div>
            </div>

            {/* 2. House Decoration — ONLY visible when player is inside their private house */}
            {isInsidePrivateHouse && (
              <div
                data-social-modal-house-decor="true"
                className="p-3.5 bg-[#fef08a] border-2 border-black shadow-[3px_3px_0_#000] space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wide text-black">
                    HOUSE DECORATION · EDIT ROOM
                  </span>
                  <span className="px-2 py-0.5 bg-black text-[#b8ff3c] text-[9.5px] font-black uppercase">
                    INSIDE HOUSE
                  </span>
                </div>
                <p className="text-[11px] font-bold text-slate-800 leading-snug">
                  You are currently inside your house. Open the Room Decoration Studio to place furniture, paintings, plants, and trophies or switch architectural themes.
                </p>
                <button
                  type="button"
                  data-social-modal-open-house-decor-btn="true"
                  onClick={() => onOpenHouseDecoration?.()}
                  className="-skew-x-6 w-full py-2.5 px-4 bg-[#10b981] hover:bg-[#34d399] text-black border-2 border-black shadow-[3px_3px_0_#000] text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all"
                >
                  <span className="skew-x-6 inline-block">
                    DECORATE HOUSE / EDIT ROOM
                  </span>
                </button>
              </div>
            )}

            {/* 3. Chat Bubble & Text Color Customization */}
            <div className="p-3 bg-slate-50 border-2 border-black shadow-[3px_3px_0_#000] space-y-2.5">
              <div className="text-xs font-black uppercase tracking-wide text-black">
                CHAT BUBBLE &amp; TEXT COLOR
              </div>

              <div>
                <div className="text-[10px] font-black uppercase text-slate-700 mb-1">
                  CHAT BUBBLE COLOR
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: 'White', hex: '#ffffff' },
                    { label: 'Dark', hex: '#0f172a' },
                    { label: 'Yellow', hex: '#facc15' },
                    { label: 'Cyan', hex: '#38bdf8' },
                    { label: 'Green', hex: '#10b981' },
                    { label: 'Purple', hex: '#d8b4fe' },
                  ].map((sw) => (
                    <button
                      key={sw.hex}
                      type="button"
                      title={`Bubble ${sw.label}`}
                      onClick={() => onChangeBubbleBgColor?.(sw.hex)}
                      style={{ backgroundColor: sw.hex }}
                      className={`w-6 h-6 border-2 border-black cursor-pointer transition-transform ${
                        playerBubbleBgColor === sw.hex
                          ? 'scale-110 ring-2 ring-black shadow-[2px_2px_0_#000]'
                          : 'opacity-85 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-black uppercase text-slate-700 mb-1">
                  CHAT TEXT COLOR
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: 'Black', hex: '#0f172a' },
                    { label: 'White', hex: '#ffffff' },
                    { label: 'Yellow', hex: '#fde047' },
                    { label: 'Cyan', hex: '#38bdf8' },
                    { label: 'Green', hex: '#4ade80' },
                    { label: 'Red', hex: '#ff3b30' },
                  ].map((sw) => (
                    <button
                      key={sw.hex}
                      type="button"
                      title={`Text ${sw.label}`}
                      onClick={() => onChangeBubbleTextColor?.(sw.hex)}
                      style={{ backgroundColor: sw.hex }}
                      className={`w-6 h-6 border-2 border-black cursor-pointer transition-transform ${
                        playerBubbleTextColor === sw.hex
                          ? 'scale-110 ring-2 ring-black shadow-[2px_2px_0_#000]'
                          : 'opacity-85 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: playerBubbleBgColor,
                  color: playerBubbleTextColor,
                }}
                className="px-3 py-1.5 border-2 border-black shadow-[2px_2px_0_#000] text-center text-[11px] font-black"
              >
                Hello Buddy! This is your chat color preview.
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
