import React, { useEffect, useRef, useState } from 'react';
import { Check, Heart, Trash2, X } from 'lucide-react';
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
  loved: 'bg-pink-100 text-pink-700 border-pink-200/80',
  liked: 'bg-sky-100 text-sky-700 border-sky-200/80',
  neutral: 'bg-amber-100 text-amber-800 border-amber-200/80',
};

const TIER_LABEL: Record<CitizenGiftReactionTier, string> = {
  loved: 'Loved gift!',
  liked: 'Liked gift',
  neutral: 'Thank you',
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
  playerBubbleBgColor: _playerBubbleBgColor = '#fef9c3',
  playerBubbleTextColor: _playerBubbleTextColor = '#0f172a',
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
        <div className="relative flex-1 flex flex-col rounded-[28px] bg-white/96 backdrop-blur-2xl border border-white/80 shadow-[0_24px_64px_rgba(15,23,42,0.28)] text-slate-900 overflow-hidden min-h-0">
          {/* Top Bar: Clean Pill Tabs + Hearts Pill + Circular Close */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5 pb-3 border-b border-slate-200/80 bg-white/90 shrink-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  setActiveTab('sesi_chat');
                }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer transition-all ${
                  activeTab === 'sesi_chat'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'bg-slate-100/90 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Chat Session</span>
              </button>

              <button
                type="button"
                data-citizen-gift-tab="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  setActiveTab('gift');
                }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer transition-all ${
                  activeTab === 'gift'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-slate-100/90 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700'
                }`}
              >
                <span>Gift ({giftedToday ? '1/1' : '0/1'})</span>
              </button>

              <button
                type="button"
                data-citizen-directory-tab="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  setActiveTab('directory');
                }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer transition-all ${
                  activeTab === 'directory'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'bg-slate-100/90 hover:bg-sky-50 text-slate-600 hover:text-sky-700'
                }`}
              >
                <span>Town Folks</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span
                title={`${progress.tierLabel} (${progress.points}/${progress.nextHeartPoints} pts)`}
                className="px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200/80 text-rose-700 text-[11px] font-semibold inline-flex items-center gap-1"
              >
                <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" aria-hidden="true" />
                <span>
                  {progress.hearts}/{progress.maxHearts}
                </span>
                {talkedBonusJustAwarded && (
                  <span className="ml-0.5 text-emerald-600 font-bold">+25</span>
                )}
              </span>

              <button
                type="button"
                data-citizen-chat-close="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  onClose();
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200/80 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
                aria-label="Close Citizen Chat"
              >
                <X className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Tab Viewport */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#f2f4f8] min-h-0">
            {activeTab === 'sesi_chat' && (
              <div className="flex-1 flex flex-col justify-between min-h-0">
                {/* Scrollable Chat History + Active Typewriter Reply */}
                <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3 min-h-0">
                  {chatHistory.map((entry) =>
                    entry.role === 'player' ? (
                      <div key={entry.id} className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5 mb-1 px-1.5">
                          <span className="text-[10px] font-semibold text-slate-500">You</span>
                          <span className="text-[10px] text-slate-400">Sent</span>
                        </div>
                        <div
                          data-player-chat-bubble="true"
                          className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-tr-sm bg-sky-500 text-white shadow-sm"
                        >
                          <p className="text-xs sm:text-[13px] font-medium leading-relaxed">
                            {entry.text}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div key={entry.id} className="flex flex-col items-start">
                        <div className="flex items-center gap-1.5 mb-1 px-1.5">
                          <span className="text-[10px] font-semibold text-slate-600">
                            {profile.name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {profile.districtLabel}
                          </span>
                        </div>
                        <div className="max-w-[88%] px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-white text-slate-800 border border-slate-200/60 shadow-sm">
                          <p className="text-xs sm:text-[13px] font-medium leading-relaxed">
                            {entry.text}
                          </p>
                        </div>
                      </div>
                    ),
                  )}

                  {/* Active NPC Typewriter Speech Bubble */}
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-1.5 mb-1 px-1.5 flex-wrap">
                      <span className="text-[10.5px] font-semibold text-slate-700">
                        {profile.name}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[9.5px] font-semibold text-white shrink-0"
                        style={{ backgroundColor: profile.accentColor }}
                      >
                        {profile.roleBadge}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate">
                        {profile.districtLabel}
                      </span>
                    </div>
                    <div
                      data-npc-chat-bubble="true"
                      className="w-full max-w-[92%] px-4 py-3 rounded-2xl rounded-tl-sm bg-white text-slate-800 border border-slate-200/70 shadow-sm"
                    >
                      <p className="text-xs sm:text-[13px] font-medium leading-relaxed text-slate-800 min-h-[48px]">
                        {npcTypedText}
                        {npcTypedText.length < npcFullText.length && (
                          <span className="inline-block w-1.5 h-3.5 rounded-full bg-sky-500 ml-0.5 align-middle animate-pulse" />
                        )}
                      </p>
                    </div>
                  </div>

                  <div ref={chatScrollEndRef} />
                </div>

                {/* Quick-Reply Choices + Clear Chat Footer */}
                <div className="px-4 py-3 border-t border-slate-200/80 shrink-0 bg-white/90 space-y-2">
                  <div className="flex flex-col gap-1.5">
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          submitPlayerQuestion(prompt);
                        }}
                        className="w-full text-left px-3.5 py-2 rounded-xl bg-white hover:bg-sky-50 border border-slate-200/90 shadow-xs text-slate-800 text-xs font-medium cursor-pointer transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end pt-0.5">
                    <button
                      type="button"
                      data-citizen-clear-chat-btn="true"
                      onClick={handleClearChat}
                      className="px-3 py-1 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/70 text-[10.5px] font-semibold cursor-pointer inline-flex items-center gap-1 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3 h-3" aria-hidden="true" />
                      <span>Clear chat</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'gift' && (
              <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3 min-h-0">
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-800">
                    Daily Gift:{' '}
                    <span className={giftedToday ? 'text-emerald-600' : 'text-sky-600'}>
                      {giftedToday ? '1 / 1 Gifted Today ✓' : '0 / 1 Available'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.favoriteTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/70 text-[10px] font-semibold"
                      >
                        ♥ {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {activeFeedback && (
                  <div className="p-3.5 rounded-2xl bg-white border border-sky-200/90 shadow-sm space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          TIER_PILL_STYLE[activeFeedback.outcome.tier]
                        }`}
                      >
                        {activeFeedback.outcome.accepted
                          ? `${TIER_LABEL[activeFeedback.outcome.tier]} · +${activeFeedback.outcome.pointsAwarded} pts`
                          : 'Daily limit'}
                      </span>
                      <span className="text-[11px] font-medium text-slate-500">
                        {activeFeedback.giftLabel}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-800 leading-relaxed">
                      “{activeFeedback.outcome.reactionLine}”
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-500 px-1">
                    Town Keepsakes &amp; Refreshments
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {CITIZEN_DAILY_GIFT_CATALOG.map((gift) => (
                      <button
                        key={gift.id}
                        type="button"
                        disabled={giftedToday}
                        onClick={() => handleCatalogGiftClick(gift.id, gift.label)}
                        className={`p-2.5 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${
                          giftedToday
                            ? 'bg-slate-100/80 border-slate-200 opacity-50 cursor-not-allowed'
                            : 'bg-white hover:bg-sky-50/70 border-slate-200/80 hover:border-sky-300 shadow-xs cursor-pointer active:scale-[0.99]'
                        }`}
                      >
                        <span className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/70 flex items-center justify-center text-base shrink-0">
                          {gift.emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-900 truncate">
                            {gift.label}
                          </div>
                          <div className="text-[10.5px] text-slate-500 line-clamp-1">
                            {gift.description}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-500 px-1">
                    Fresh Catch ({caughtFishBucket.length} in Bucket)
                  </div>
                  {caughtFishBucket.length === 0 ? (
                    <div className="p-3.5 rounded-2xl bg-white/80 border border-dashed border-slate-300 text-xs font-medium text-slate-500">
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
                          className={`p-2.5 rounded-2xl border text-left flex items-center justify-between gap-2 transition-all ${
                            giftedToday
                              ? 'bg-slate-100/80 border-slate-200 opacity-50 cursor-not-allowed'
                              : 'bg-white hover:bg-sky-50/70 border-slate-200/80 hover:border-sky-300 shadow-xs cursor-pointer'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              🐟 {fish.speciesName}
                            </div>
                            <div className="text-[10.5px] text-slate-500">
                              {fish.rarity} · {fish.weightKg.toFixed(1)}kg
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-semibold shrink-0">
                            Give
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'directory' && (
              <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3 min-h-0">
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-900">Blitz City Citizens</div>
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200/80 text-[11px] font-semibold">
                    {totalTownHearts} / {maxTownHearts} ♥
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {directoryEntries.map((entry) => {
                    const isCurrent = entry.profile.id === profile.id;
                    return (
                      <div
                        key={entry.profile.id}
                        className={`p-3 rounded-2xl border flex flex-col justify-between gap-2.5 transition-all ${
                          isCurrent
                            ? 'bg-sky-50/90 border-sky-300 shadow-sm ring-1 ring-sky-200'
                            : 'bg-white border-slate-200/80 shadow-xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{entry.profile.portraitEmoji}</span>
                              <span className="text-xs font-semibold text-slate-900 truncate">
                                {entry.profile.name}
                              </span>
                            </div>
                            <div className="text-[10.5px] text-slate-500 truncate mt-0.5">
                              {entry.profile.districtLabel}
                            </div>
                          </div>
                          <span
                            className="px-2 py-0.5 rounded-full text-[9.5px] font-semibold text-white shrink-0"
                            style={{ backgroundColor: entry.profile.accentColor }}
                          >
                            {entry.profile.roleBadge}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: entry.progress.maxHearts }).map((_, hIdx) => (
                              <Heart
                                key={hIdx}
                                className={`w-3 h-3 ${
                                  hIdx < entry.progress.hearts
                                    ? 'fill-rose-500 text-rose-500'
                                    : 'fill-slate-100 text-slate-300'
                                }`}
                              />
                            ))}
                            <span className="ml-1 text-[10px] font-medium text-slate-500 inline-flex items-center gap-0.5">
                              {entry.talkedToday && <Check className="w-2.5 h-2.5 text-emerald-600" />}
                              {entry.progress.points}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onVisitDirectoryCitizen(entry.profile)}
                            className="px-3 py-1 rounded-full bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-semibold shadow-xs cursor-pointer transition-colors"
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
