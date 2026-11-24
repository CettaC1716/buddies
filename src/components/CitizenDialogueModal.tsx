import React, { useEffect, useRef, useState } from 'react';
import { Check, Heart, Trash2, Wifi, X } from 'lucide-react';
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
  initialTab?: 'sesi_chat' | 'gift' | 'directory';
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
  initialTab = 'sesi_chat',
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
    setActiveTab(initialTab);
    setChatHistory([]);
    setGiftFeedback(null);
    const greetingText = buildOpeningGreeting(profile);
    setNpcFullText(greetingText);
    setNpcTypedText('');
    // Reset thread cleanly when opening or switching citizens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, citizenId, openSeq, initialTab]);

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
      data-chat-glass-modal="true"
      className={`fixed inset-x-2.5 sm:inset-x-auto sm:left-4 top-[max(0.5rem,var(--safe-top))] sm:top-14 bottom-[calc(64px+var(--safe-bottom))] sm:bottom-[76px] my-auto z-40 sm:w-[356px] max-w-[400px] mx-auto sm:mx-0 max-h-[min(620px,calc(100dvh-4.75rem))] flex flex-col select-none transition-all duration-300 ease-out transform ${
        isNpcOpen
          ? 'translate-x-0 opacity-100 pointer-events-auto'
          : '-translate-x-[120%] opacity-0 pointer-events-none'
      }`}
    >
      {profile && (
        <div className="relative flex-1 flex flex-col rounded-[32px] bg-[#141926]/68 backdrop-blur-2xl border border-white/25 shadow-[0_24px_70px_rgba(0,0,0,0.52)] text-white overflow-hidden min-h-0">
          {/* Top Status Strip: BLITZ OS + Close Icon (replaces expand button) */}
          <div className="shrink-0 flex items-center justify-between text-[10.5px] font-medium px-4 pt-3 pb-1.5 text-white/90">
            <div className="flex items-center gap-1.5">
              <Wifi className="w-3 h-3 text-white/85" aria-hidden="true" />
              <span className="tracking-wide font-semibold">BLITZ OS</span>
            </div>
            <button
              type="button"
              data-citizen-chat-close="true"
              onClick={() => {
                soundEngine.playUiClick();
                onClose();
              }}
              className="w-6 h-6 rounded-full flex items-center justify-center border bg-white/12 hover:bg-rose-500/35 border-white/20 text-white/90 hover:text-white cursor-pointer active:scale-90 transition-all shrink-0"
              aria-label="Close Citizen Chat"
              title="Close"
            >
              <X className="w-3.5 h-3.5 stroke-[2.3]" aria-hidden="true" />
            </button>
          </div>

          {/* Active Chat Person Header */}
          <div className="shrink-0 flex items-center justify-between gap-2.5 px-3.5 py-2 border-b border-white/12">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-8 h-8 rounded-xl shadow-sm flex items-center justify-center text-sm shrink-0 border border-white/20"
                style={{ backgroundColor: profile.accentColor }}
                aria-hidden="true"
              >
                {profile.portraitEmoji}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white leading-tight truncate">
                  {profile.name}
                </div>
                <div className="text-[10px] text-white/65 leading-tight truncate">
                  {profile.roleBadge} · {profile.districtLabel}
                </div>
              </div>
            </div>

            <span
              title={`${progress.tierLabel} (${progress.points}/${progress.nextHeartPoints} pts)`}
              className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-300/30 text-rose-200 text-[10px] font-semibold inline-flex items-center gap-1 shrink-0"
            >
              <Heart className="w-3 h-3 fill-rose-400 text-rose-400" aria-hidden="true" />
              <span>
                {progress.hearts}/{progress.maxHearts}
              </span>
              {talkedBonusJustAwarded && (
                <span className="ml-0.5 text-emerald-300 font-bold">+25</span>
              )}
            </span>
          </div>

          {/* Compact Dark Glass Mode Tabs */}
          <div className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 border-b border-white/10">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                setActiveTab('sesi_chat');
              }}
              className={`px-3 py-1 rounded-full text-[10.5px] font-semibold cursor-pointer transition-all ${
                activeTab === 'sesi_chat'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'bg-white/10 hover:bg-white/18 text-white/75 hover:text-white border border-white/10'
              }`}
            >
              <span>Chat</span>
            </button>

            <button
              type="button"
              data-citizen-gift-tab="true"
              onClick={() => {
                soundEngine.playUiClick();
                setActiveTab('gift');
              }}
              className={`px-3 py-1 rounded-full text-[10.5px] font-semibold cursor-pointer transition-all ${
                activeTab === 'gift'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-white/10 hover:bg-white/18 text-white/75 hover:text-white border border-white/10'
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
              className={`px-3 py-1 rounded-full text-[10.5px] font-semibold cursor-pointer transition-all ${
                activeTab === 'directory'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'bg-white/10 hover:bg-white/18 text-white/75 hover:text-white border border-white/10'
              }`}
            >
              <span>Town Folks</span>
            </button>
          </div>

          {/* Tab Viewport (No bottom footer) */}
          <div className="flex-1 flex flex-col overflow-hidden bg-transparent min-h-0">
            {activeTab === 'sesi_chat' && (
              <div className="flex-1 flex flex-col justify-between min-h-0">
                {/* Scrollable Chat History + Active Typewriter Reply */}
                <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 min-h-0">
                  {chatHistory.map((entry) =>
                    entry.role === 'player' ? (
                      <div key={entry.id} className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5 mb-1 px-1.5">
                          <span className="text-[10px] font-semibold text-white/75">You</span>
                          <span className="text-[9.5px] text-white/45">Sent</span>
                        </div>
                        <div
                          data-player-chat-bubble="true"
                          className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-tr-sm bg-sky-500 text-white shadow-sm"
                        >
                          <p className="text-xs font-medium leading-relaxed">
                            {entry.text}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div key={entry.id} className="flex flex-col items-start">
                        <div className="flex items-center gap-1.5 mb-1 px-1.5">
                          <span className="text-[10px] font-semibold text-white/75">
                            {profile.name}
                          </span>
                          <span className="text-[9.5px] text-white/45">
                            {profile.districtLabel}
                          </span>
                        </div>
                        <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-[#eef0f4]/92 text-slate-900 border border-white/80 shadow-sm">
                          <p className="text-xs font-medium leading-relaxed text-slate-900">
                            {entry.text}
                          </p>
                        </div>
                      </div>
                    ),
                  )}

                  {/* Active NPC Typewriter Speech Bubble */}
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-1.5 mb-1 px-1.5 flex-wrap">
                      <span className="text-[10px] font-semibold text-white/75">
                        {profile.name}
                      </span>
                      <span className="text-[9.5px] text-white/45 truncate">
                        {profile.districtLabel}
                      </span>
                    </div>
                    <div
                      data-npc-chat-bubble="true"
                      className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-[#eef0f4]/92 text-slate-900 border border-white/80 shadow-sm"
                    >
                      <p className="text-xs font-medium leading-relaxed text-slate-900">
                        {npcTypedText}
                        {npcTypedText.length < npcFullText.length && (
                          <span className="inline-block w-1.5 h-3.5 rounded-full bg-sky-500 ml-0.5 align-middle animate-pulse" />
                        )}
                      </p>
                    </div>
                  </div>

                  <div ref={chatScrollEndRef} />
                </div>

                {/* Quick-Reply Choices + Clear Chat */}
                <div className="px-3.5 py-2.5 border-t border-white/10 shrink-0 bg-black/15 space-y-1.5">
                  <div className="flex flex-col gap-1.5">
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          submitPlayerQuestion(prompt);
                        }}
                        className="w-full text-left px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/18 border border-white/12 text-white/90 text-[11px] font-medium cursor-pointer transition-colors"
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
                      className="px-2.5 py-1 rounded-full bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border border-rose-400/30 text-[10px] font-semibold cursor-pointer inline-flex items-center gap-1 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3 h-3" aria-hidden="true" />
                      <span>Clear chat</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'gift' && (
              <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 min-h-0">
                <div className="p-3 rounded-2xl bg-white/10 border border-white/15 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-white/90">
                    Daily Gift:{' '}
                    <span className={giftedToday ? 'text-emerald-300' : 'text-sky-300'}>
                      {giftedToday ? '1 / 1 Gifted Today ✓' : '0 / 1 Available'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.favoriteTags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-medium text-rose-200/90"
                      >
                        ♥ {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {activeFeedback && (
                  <div className="p-3 rounded-2xl bg-white/12 border border-sky-300/35 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          TIER_PILL_STYLE[activeFeedback.outcome.tier]
                        }`}
                      >
                        {activeFeedback.outcome.accepted
                          ? `${TIER_LABEL[activeFeedback.outcome.tier]} · +${activeFeedback.outcome.pointsAwarded} pts`
                          : 'Daily limit'}
                      </span>
                      <span className="text-[10.5px] font-medium text-white/65">
                        {activeFeedback.giftLabel}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-white/95 leading-relaxed">
                      “{activeFeedback.outcome.reactionLine}”
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="text-[10.5px] font-semibold text-white/65 px-0.5">
                    Town Keepsakes &amp; Refreshments
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {CITIZEN_DAILY_GIFT_CATALOG.map((gift) => (
                      <button
                        key={gift.id}
                        type="button"
                        disabled={giftedToday}
                        onClick={() => handleCatalogGiftClick(gift.id, gift.label)}
                        className={`p-2.5 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${
                          giftedToday
                            ? 'bg-white/5 border-white/10 opacity-45 cursor-not-allowed'
                            : 'bg-white/10 hover:bg-white/18 border-white/15 hover:border-sky-300/50 cursor-pointer active:scale-[0.99]'
                        }`}
                      >
                        <span className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-300/30 flex items-center justify-center text-base shrink-0">
                          {gift.emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-white truncate">
                            {gift.label}
                          </div>
                          <div className="text-[10px] text-white/60 line-clamp-1">
                            {gift.description}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10.5px] font-semibold text-white/65 px-0.5">
                    Fresh Catch ({caughtFishBucket.length} in Bucket)
                  </div>
                  {caughtFishBucket.length === 0 ? (
                    <div className="p-3 rounded-2xl bg-white/8 border border-dashed border-white/20 text-xs font-medium text-white/65">
                      Catch fish at NW Oasis Lake or East Beach to gift fresh fish!
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {caughtFishBucket.slice(0, 8).map((fish) => (
                        <button
                          key={fish.id}
                          type="button"
                          disabled={giftedToday}
                          onClick={() => handleFishGiftClick(fish)}
                          className={`p-2.5 rounded-2xl border text-left flex items-center justify-between gap-2 transition-all ${
                            giftedToday
                              ? 'bg-white/5 border-white/10 opacity-45 cursor-not-allowed'
                              : 'bg-white/10 hover:bg-white/18 border-white/15 hover:border-sky-300/50 cursor-pointer'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">
                              🐟 {fish.speciesName}
                            </div>
                            <div className="text-[10px] text-white/60">
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
              <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5 min-h-0">
                <div className="p-3 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-white">Blitz City Citizens</div>
                  <span className="text-[11px] font-semibold text-rose-300">
                    {totalTownHearts} / {maxTownHearts} ♥
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {directoryEntries.map((entry) => {
                    const isCurrent = entry.profile.id === profile.id;
                    return (
                      <div
                        key={entry.profile.id}
                        className={`p-3 rounded-2xl border flex flex-col justify-between gap-2 transition-all ${
                          isCurrent
                            ? 'bg-sky-500/20 border-sky-300/50 ring-1 ring-sky-300/30'
                            : 'bg-white/10 border-white/15'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{entry.profile.portraitEmoji}</span>
                              <span className="text-xs font-semibold text-white truncate">
                                {entry.profile.name}
                              </span>
                            </div>
                            <div className="text-[10px] text-white/60 truncate mt-0.5">
                              {entry.profile.roleBadge} · {entry.profile.districtLabel}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onVisitDirectoryCitizen(entry.profile)}
                            className="px-2.5 py-1 rounded-full bg-sky-500 hover:bg-sky-400 text-white text-[10px] font-semibold shadow-xs cursor-pointer transition-colors shrink-0"
                          >
                            Visit
                          </button>
                        </div>

                        <div className="flex items-center gap-1 pt-1.5 border-t border-white/10">
                          {Array.from({ length: entry.progress.maxHearts }).map((_, hIdx) => (
                            <Heart
                              key={hIdx}
                              className={`w-3 h-3 ${
                                hIdx < entry.progress.hearts
                                  ? 'fill-rose-400 text-rose-400'
                                  : 'fill-white/10 text-white/25'
                              }`}
                            />
                          ))}
                          <span className="ml-1 text-[10px] font-medium text-white/65 inline-flex items-center gap-0.5">
                            {entry.talkedToday && <Check className="w-2.5 h-2.5 text-emerald-400" />}
                            {entry.progress.points} pts
                          </span>
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
