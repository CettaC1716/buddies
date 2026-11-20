import React, { useEffect, useRef, useState } from 'react';
import { Check, Heart, Trash2 } from 'lucide-react';
import { soundEngine } from '../game/audio';
import {
  CITIZEN_DAILY_GIFT_CATALOG,
  type CitizenGiftReactionTier,
  type CitizenId,
  type CitizenProfile,
  type CitizenFriendshipStore,
  generateCitizenChatReply,
  getCitizenFriendshipRecord,
  getCitizenHeartProgress,
  getCitizenLocalDateKey,
  getCitizenProfile,
  getCitizenQuickPrompts,
  listCitizenDirectory,
  pickCitizenContextualDialogue,
} from '../game/buddiesCitizenRoles';
import type { CaughtFishItem } from '../game/buddiesFishingMarket';

export interface CitizenGiftOutcome {
  accepted: boolean;
  reactionLine: string;
  tier: CitizenGiftReactionTier;
  pointsAwarded: number;
}

export interface CitizenDialogueModalProps {
  isOpen: boolean;
  citizenId: CitizenId | null;
  openSeq?: number;
  friendshipStore: CitizenFriendshipStore;
  caughtFishBucket: readonly CaughtFishItem[];
  isRaining: boolean;
  daytimePhase?: 'day' | 'evening' | 'night';
  talkedBonusJustAwarded?: boolean;
  playerBubbleBgColor?: string;
  playerBubbleTextColor?: string;
  onClose: () => void;
  onGiveCatalogGift: (citizenId: CitizenId, giftId: string) => CitizenGiftOutcome;
  onGiveFishGift: (citizenId: CitizenId, fish: CaughtFishItem) => CitizenGiftOutcome;
  onVisitDirectoryCitizen: (profile: CitizenProfile) => void;
}

type CitizenChatTab = 'sesi_chat' | 'gift' | 'directory';

interface CitizenChatEntry {
  id: string;
  role: 'player' | 'npc';
  text: string;
}

const TIER_PILL_STYLE: Record<CitizenGiftReactionTier, string> = {
  loved: 'bg-[#ec4899] text-white border-black',
  liked: 'bg-[#22d3ee] text-slate-950 border-black',
  neutral: 'bg-[#facc15] text-slate-950 border-black',
};

const TIER_LABEL: Record<CitizenGiftReactionTier, string> = {
  loved: 'LOVED GIFT!',
  liked: 'LIKED GIFT',
  neutral: 'THANK YOU',
};

export const CitizenDialogueModal: React.FC<CitizenDialogueModalProps> = ({
  isOpen,
  citizenId,
  openSeq = 0,
  friendshipStore,
  caughtFishBucket,
  isRaining,
  daytimePhase = 'day',
  talkedBonusJustAwarded = false,
  playerBubbleBgColor = '#fef9c3',
  playerBubbleTextColor = '#0f172a',
  onClose,
  onGiveCatalogGift,
  onGiveFishGift,
  onVisitDirectoryCitizen,
}) => {
  const [activeTab, setActiveTab] = useState<CitizenChatTab>('sesi_chat');
  const [chatHistory, setChatHistory] = useState<CitizenChatEntry[]>([]);
  const [npcFullText, setNpcFullText] = useState<string>('');
  const [npcTypedText, setNpcTypedText] = useState<string>('');
  const [giftFeedback, setGiftFeedback] = useState<{
    citizenId: string;
    outcome: CitizenGiftOutcome;
    giftLabel: string;
  } | null>(null);

  const chatScrollEndRef = useRef<HTMLDivElement | null>(null);
  const npcFullTextRef = useRef<string>('');
  npcFullTextRef.current = npcFullText;

  const profile = citizenId ? getCitizenProfile(citizenId) : null;
  const isNpcOpen = Boolean(isOpen && profile);

  const todayKey = getCitizenLocalDateKey();
  const record = profile
    ? getCitizenFriendshipRecord(friendshipStore, profile.id)
    : null;
  const progress = getCitizenHeartProgress(record?.points ?? 0);
  const giftedToday = record?.lastGiftDate === todayKey;

  const buildOpeningGreeting = (targetProfile: CitizenProfile): string => {
    const rec = getCitizenFriendshipRecord(friendshipStore, targetProfile.id);
    const prog = getCitizenHeartProgress(rec.points);
    const dialogue = pickCitizenContextualDialogue({
      citizenId: targetProfile.id,
      hearts: prog.hearts,
      timePhase: daytimePhase,
      isRaining,
      talkedCount: rec.totalTalks,
    });
    return dialogue.deepTalk
      ? `${dialogue.greeting} ${dialogue.deepTalk}`
      : `${dialogue.greeting} Ask me about ${targetProfile.districtLabel} anytime!`;
  };

  useEffect(() => {
    if (!isOpen || !profile) return;
    setActiveTab('sesi_chat');
    setChatHistory([]);
    setGiftFeedback(null);
    const greetingText = buildOpeningGreeting(profile);
    setNpcFullText(greetingText);
    setNpcTypedText('');
    // Reset thread cleanly when opening or switching citizens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, citizenId, openSeq]);

  // Typewriter effect matching Hana/Kai chat drawer cadence
  useEffect(() => {
    if (!isNpcOpen || !npcFullText) return;
    if (npcTypedText.length >= npcFullText.length) return;
    const timer = window.setTimeout(() => {
      setNpcTypedText(npcFullText.slice(0, npcTypedText.length + 2));
    }, 16);
    return () => window.clearTimeout(timer);
  }, [isNpcOpen, npcFullText, npcTypedText]);

  const submitPlayerQuestion = (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || !profile || !record) return;
    const prevNpcText = npcFullTextRef.current.trim();
    const { reply } = generateCitizenChatReply({
      citizenId: profile.id,
      userText: trimmed,
      hearts: progress.hearts,
      timePhase: daytimePhase,
      isRaining,
      talkedCount: record.totalTalks + chatHistory.length,
    });
    const nextEntries: CitizenChatEntry[] = [];
    if (prevNpcText) {
      nextEntries.push({
        id: `npc-${Date.now()}-${chatHistory.length}`,
        role: 'npc',
        text: prevNpcText,
      });
    }
    nextEntries.push({
      id: `player-${Date.now()}-${chatHistory.length}`,
      role: 'player',
      text: trimmed,
    });
    setChatHistory((prev) => [...prev, ...nextEntries]);
    setNpcFullText(reply);
    setNpcTypedText('');
    setActiveTab('sesi_chat');
    window.setTimeout(() => {
      chatScrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 40);
  };

  const submitPlayerQuestionRef = useRef(submitPlayerQuestion);
  submitPlayerQuestionRef.current = submitPlayerQuestion;

  useEffect(() => {
    if (!isNpcOpen) return;
    const onUserChat = (ev: Event) => {
      const text = (ev as CustomEvent<{ text?: string }>).detail?.text?.trim();
      if (!text) return;
      submitPlayerQuestionRef.current(text);
    };
    window.addEventListener('citizen-dialogue-user-chat', onUserChat);
    return () => window.removeEventListener('citizen-dialogue-user-chat', onUserChat);
  }, [isNpcOpen]);

  const handleClearChat = () => {
    if (!profile) return;
    soundEngine.playUiClick();
    setChatHistory([]);
    setNpcFullText(buildOpeningGreeting(profile));
    setNpcTypedText('');
  };

  const directoryEntries = listCitizenDirectory(friendshipStore, todayKey);
  const totalTownHearts = directoryEntries.reduce((acc, entry) => acc + entry.progress.hearts, 0);
  const maxTownHearts = directoryEntries.length * progress.maxHearts;
  const activeFeedback =
    profile && giftFeedback && giftFeedback.citizenId === profile.id ? giftFeedback : null;

  const quickPrompts = profile ? getCitizenQuickPrompts(profile.id) : [];

  const handleCatalogGiftClick = (giftId: string, giftLabel: string) => {
    if (!profile) return;
    const outcome = onGiveCatalogGift(profile.id, giftId);
    setGiftFeedback({ citizenId: profile.id, outcome, giftLabel });
  };

  const handleFishGiftClick = (fish: CaughtFishItem) => {
    if (!profile) return;
    const outcome = onGiveFishGift(profile.id, fish);
    setGiftFeedback({
      citizenId: profile.id,
      outcome,
      giftLabel: `${fish.speciesName} (${fish.weightKg.toFixed(1)}kg)`,
    });
  };

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-hidden={!isNpcOpen}
      aria-label={profile ? `Chat with ${profile.name}` : 'Citizen Chat'}
      data-citizen-chat-modal="true"
      className={`fixed left-4 top-16 bottom-20 z-40 w-[calc(100vw-2rem)] max-w-[540px] flex flex-col select-none transition-all duration-300 ease-out transform ${
        isNpcOpen
          ? 'translate-x-0 opacity-100 pointer-events-auto'
          : '-translate-x-[120%] opacity-0 pointer-events-none'
      }`}
    >
      {profile && (
        <div className="relative flex-1 flex flex-col bg-white border-[3.5px] border-black shadow-[4px_4px_0px_#000] p-4 sm:p-5 text-black overflow-hidden min-h-0">
          {/* Top Bar matching Hana Drawer: Skewed Tabs + Hearts Pill + Skewed Red Close */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b-[2.5px] border-black shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  setActiveTab('sesi_chat');
                }}
                className={`-skew-x-6 px-3 py-1 border-2 border-black shadow-[3px_3px_0px_#000] text-[11px] font-black uppercase cursor-pointer transition-all ${
                  activeTab === 'sesi_chat'
                    ? 'bg-[#facc15] text-black -translate-y-0.5'
                    : 'bg-slate-50 hover:bg-[#fef08a] text-black'
                }`}
              >
                <span className="skew-x-6 inline-block">CHAT SESSION</span>
              </button>

              <button
                type="button"
                data-citizen-gift-tab="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  setActiveTab('gift');
                }}
                className={`-skew-x-6 px-3 py-1 border-2 border-black shadow-[3px_3px_0px_#000] text-[11px] font-black uppercase cursor-pointer transition-all ${
                  activeTab === 'gift'
                    ? 'bg-[#10b981] text-black -translate-y-0.5'
                    : 'bg-slate-50 hover:bg-[#a7f3d0] text-black'
                }`}
              >
                <span className="skew-x-6 inline-block">
                  GIFT ({giftedToday ? '1/1' : '0/1'})
                </span>
              </button>

              <button
                type="button"
                data-citizen-directory-tab="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  setActiveTab('directory');
                }}
                className={`-skew-x-6 px-3 py-1 border-2 border-black shadow-[3px_3px_0px_#000] text-[11px] font-black uppercase cursor-pointer transition-all ${
                  activeTab === 'directory'
                    ? 'bg-[#38bdf8] text-black -translate-y-0.5'
                    : 'bg-slate-50 hover:bg-[#bae6fd] text-black'
                }`}
              >
                <span className="skew-x-6 inline-block">TOWN FOLKS</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span
                title={`${progress.tierLabel} (${progress.points}/${progress.nextHeartPoints} pts)`}
                className="px-2 py-1 bg-[#fff1f2] border-2 border-black shadow-[2px_2px_0px_#000] text-[10px] font-black uppercase inline-flex items-center gap-1"
              >
                <Heart className="w-3 h-3 fill-rose-500 text-black" aria-hidden="true" />
                <span>
                  {progress.hearts}/{progress.maxHearts}
                </span>
                {talkedBonusJustAwarded && (
                  <span className="ml-0.5 text-emerald-700">+25</span>
                )}
              </span>

              <button
                type="button"
                data-citizen-chat-close="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  onClose();
                }}
                className="-skew-x-6 w-8 h-8 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black shadow-[3px_3px_0px_#000] font-black text-xs flex items-center justify-center cursor-pointer active:scale-95"
                aria-label="Close Citizen Chat"
              >
                <span className="skew-x-6 inline-block">X</span>
              </button>
            </div>
          </div>

          {/* Tab Viewport */}
          <div className="mt-3 flex-1 flex flex-col overflow-y-auto pr-1 space-y-3 min-h-0">
            {activeTab === 'sesi_chat' && (
              <div className="flex-1 flex flex-col justify-between gap-3 min-h-0">
                {/* Scrollable Chat History + Active Typewriter Reply */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 min-h-0">
                  {chatHistory.map((entry) =>
                    entry.role === 'player' ? (
                      <div
                        key={entry.id}
                        data-player-chat-bubble="true"
                        style={{
                          backgroundColor: playerBubbleBgColor,
                          color: playerBubbleTextColor,
                        }}
                        className="p-3 border-[2.5px] border-black shadow-[3px_3px_0px_#000] ml-6"
                      >
                        <div className="flex items-center justify-end mb-1">
                          <span className="px-2 py-0.5 bg-[#facc15] text-black border border-black text-[9.5px] font-black uppercase">
                            YOU
                          </span>
                        </div>
                        <p className="text-xs sm:text-[13px] font-bold leading-relaxed">
                          {entry.text}
                        </p>
                      </div>
                    ) : (
                      <div
                        key={entry.id}
                        className="p-3 bg-[#1e293b] text-slate-100 border-[2px] border-black shadow-[3px_3px_0px_#000] mr-4"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className="px-2 py-0.5 text-black border border-black text-[9.5px] font-black uppercase"
                            style={{ backgroundColor: '#2bb3b1' }}
                          >
                            {profile.name.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs font-bold leading-relaxed">{entry.text}</p>
                      </div>
                    ),
                  )}

                  {/* Active NPC Typewriter Speech Bubble */}
                  <div
                    data-npc-chat-bubble="true"
                    className="p-3.5 bg-[#0f172a] text-white border-[2.5px] border-black shadow-[4px_4px_0px_#000]"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-2.5 py-0.5 bg-[#2bb3b1] text-black border border-black text-[10px] font-black uppercase shrink-0">
                          {profile.name.toUpperCase()}
                        </span>
                        <span
                          className="px-1.5 py-0.5 text-[9.5px] font-black uppercase border border-black text-white shrink-0"
                          style={{ backgroundColor: profile.accentColor }}
                        >
                          {profile.roleBadge}
                        </span>
                      </div>
                      <span className="text-[9.5px] font-bold text-slate-400 truncate">
                        {profile.districtLabel}
                      </span>
                    </div>
                    <p className="text-xs sm:text-[13px] font-bold leading-relaxed text-[#f8fafc] min-h-[54px]">
                      {npcTypedText}
                      {npcTypedText.length < npcFullText.length && (
                        <span className="inline-block w-1.5 h-3.5 bg-[#b8ff3c] ml-0.5" />
                      )}
                    </p>
                  </div>

                  <div ref={chatScrollEndRef} />
                </div>

                {/* Quick Question Chips + CLEAR CHAT Footer matching Hana */}
                <div className="pt-2 border-t-2 border-black shrink-0 bg-white space-y-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          submitPlayerQuestion(prompt);
                        }}
                        className="px-2 py-1 bg-slate-100 hover:bg-[#fef08a] text-black border border-black text-[9.5px] font-bold cursor-pointer transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                    <button
                      type="button"
                      data-citizen-clear-chat-btn="true"
                      onClick={handleClearChat}
                      className="ml-auto px-2 py-1 bg-[#fee2e2] hover:bg-[#fecaca] text-[#991b1b] border border-black text-[9px] font-black uppercase cursor-pointer inline-flex items-center gap-1 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3 h-3" aria-hidden="true" />
                      <span>CLEAR CHAT</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'gift' && (
              <div className="space-y-3 pb-2">
                <div className="p-2.5 bg-[#141c2e] text-white border-[2.5px] border-black shadow-[3px_3px_0px_#000] flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] font-black uppercase">
                    Daily Gift:{' '}
                    <span className={giftedToday ? 'text-[#b8ff3c]' : 'text-[#facc15]'}>
                      {giftedToday ? '1 / 1 Gifted Today ✓' : '0 / 1 Available'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {profile.favoriteTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 bg-white text-black border border-black text-[9.5px] font-black uppercase"
                      >
                        ♥ {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {activeFeedback && (
                  <div className="p-3 bg-[#0f172a] text-white border-[2.5px] border-black shadow-[3px_3px_0px_#000] space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 text-[9.5px] font-black uppercase border ${
                          TIER_PILL_STYLE[activeFeedback.outcome.tier]
                        }`}
                      >
                        {activeFeedback.outcome.accepted
                          ? `${TIER_LABEL[activeFeedback.outcome.tier]} · +${activeFeedback.outcome.pointsAwarded} PTS`
                          : 'DAILY LIMIT'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-300">
                        {activeFeedback.giftLabel}
                      </span>
                    </div>
                    <p className="text-xs font-bold leading-relaxed">
                      “{activeFeedback.outcome.reactionLine}”
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="text-[10.5px] font-black uppercase tracking-wider text-slate-600">
                    Town Keepsakes &amp; Refreshments
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {CITIZEN_DAILY_GIFT_CATALOG.map((gift) => (
                      <button
                        key={gift.id}
                        type="button"
                        disabled={giftedToday}
                        onClick={() => handleCatalogGiftClick(gift.id, gift.label)}
                        className={`p-2 border-2 border-black text-left flex items-center gap-2 transition-all ${
                          giftedToday
                            ? 'bg-slate-100 opacity-50 cursor-not-allowed'
                            : 'bg-white hover:bg-[#fef08a] shadow-[2px_2px_0px_#000] cursor-pointer active:translate-y-0.5'
                        }`}
                      >
                        <span className="w-8 h-8 bg-[#f3efe2] border-2 border-black flex items-center justify-center text-base shrink-0">
                          {gift.emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-black uppercase truncate">
                            {gift.label}
                          </div>
                          <div className="text-[10px] font-semibold text-slate-600 line-clamp-1">
                            {gift.description}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[10.5px] font-black uppercase tracking-wider text-slate-600">
                    Fresh Catch ({caughtFishBucket.length} in Bucket)
                  </div>
                  {caughtFishBucket.length === 0 ? (
                    <div className="p-2.5 bg-slate-100 border-2 border-dashed border-slate-400 text-[11px] font-bold text-slate-600">
                      Catch fish at NW Oasis Lake or East Beach to gift fresh fish!
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {caughtFishBucket.slice(0, 8).map((fish) => (
                        <button
                          key={fish.id}
                          type="button"
                          disabled={giftedToday}
                          onClick={() => handleFishGiftClick(fish)}
                          className={`p-2 border-2 border-black text-left flex items-center justify-between gap-2 ${
                            giftedToday
                              ? 'bg-slate-100 opacity-50 cursor-not-allowed'
                              : 'bg-white hover:bg-[#bae6fd] shadow-[2px_2px_0px_#000] cursor-pointer'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-[11px] font-black truncate">
                              🐟 {fish.speciesName}
                            </div>
                            <div className="text-[10px] font-bold text-slate-600">
                              {fish.rarity} · {fish.weightKg.toFixed(1)}kg
                            </div>
                          </div>
                          <span className="px-2 py-0.5 bg-[#b8ff3c] border border-black text-[9.5px] font-black uppercase shrink-0">
                            GIVE
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'directory' && (
              <div className="space-y-2.5 pb-2">
                <div className="p-2.5 bg-[#141c2e] text-white border-[2.5px] border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-2">
                  <div className="text-[11px] font-black uppercase">Blitz City Citizens</div>
                  <span className="px-2 py-0.5 bg-[#fff1f2] text-rose-700 border border-black text-[10px] font-black">
                    {totalTownHearts} / {maxTownHearts} ♥
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {directoryEntries.map((entry) => {
                    const isCurrent = entry.profile.id === profile.id;
                    return (
                      <div
                        key={entry.profile.id}
                        className={`p-2.5 border-2 border-black flex flex-col justify-between gap-2 ${
                          isCurrent
                            ? 'bg-[#fef9c3] shadow-[3px_3px_0px_#000]'
                            : 'bg-white shadow-[2px_2px_0px_#000]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{entry.profile.portraitEmoji}</span>
                              <span className="text-xs font-black uppercase truncate">
                                {entry.profile.name}
                              </span>
                            </div>
                            <div className="text-[10px] font-bold text-slate-600 truncate">
                              {entry.profile.districtLabel}
                            </div>
                          </div>
                          <span
                            className="px-1.5 py-0.5 text-[9px] font-black uppercase border border-black text-white shrink-0"
                            style={{ backgroundColor: entry.profile.accentColor }}
                          >
                            {entry.profile.roleBadge}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-200">
                          <div className="flex items-center gap-1">
                            {Array.from({ length: entry.progress.maxHearts }).map((_, hIdx) => (
                              <Heart
                                key={hIdx}
                                className={`w-3 h-3 ${
                                  hIdx < entry.progress.hearts
                                    ? 'fill-rose-500 text-black'
                                    : 'fill-white text-slate-300'
                                }`}
                              />
                            ))}
                            <span className="ml-1 text-[9.5px] font-bold text-slate-600 inline-flex items-center gap-0.5">
                              {entry.talkedToday && <Check className="w-2.5 h-2.5 text-emerald-700" />}
                              {entry.progress.points}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onVisitDirectoryCitizen(entry.profile)}
                            className="px-2 py-0.5 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black border border-black text-[9.5px] font-black uppercase cursor-pointer"
                          >
                            Visit
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
