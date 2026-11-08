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
  nearbyUsers: NearbyEntityUser[];
  onSendPublicChat: (text: string) => void;
  onSendPrivateChat: (recipient: NearbyEntityUser, text: string) => void;
  chatMessages: ChatMessage[];
  selectedPrivateUser: NearbyEntityUser | null;
  onSelectPrivateUser: (user: NearbyEntityUser | null) => void;
  playerBubbleBgColor?: string;
  playerBubbleTextColor?: string;
}

const simplifyDisplayName = (rawName: string): string => {
  return rawName.replace(/\s*\([^)]*\)/g, '').trim() || rawName;
};

export const SocialChatModal: React.FC<SocialChatModalProps> = ({
  isOpen,
  onClose,
  nearbyUsers,
  onSendPublicChat,
  onSendPrivateChat,
  chatMessages,
  selectedPrivateUser,
  onSelectPrivateUser,
  playerBubbleBgColor = '#38bdf8',
  playerBubbleTextColor = '#0f172a',
}) => {
  const [activeTab, setActiveTab] = useState<'publik' | 'private' | 'daftar_online'>('publik');
  const publicScrollRef = useRef<HTMLDivElement>(null);
  const privateScrollRef = useRef<HTMLDivElement>(null);

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
      </div>
    </aside>
  );
};
