import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Wifi, X } from 'lucide-react';
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
  listCitizenDirectory,
  pickCitizenContextualDialogue,
} from '../game/buddiesCitizenRoles';
import type { CaughtFishItem } from '../game/buddiesFishingMarket';
import {
  canLongConversation,
  canPairPose,
  canRideTogether,
  canWalkTogether,
  createEmptyNpcClosenessStore,
  getNpcClosenessBand,
  resolveNpcId,
  type NpcClosenessStore,
  type NpcId,
} from '../game/npcClosenessEngine';
import {
  CURATED_NPC_PAIR_POSES,
  EMPTY_NPC_TOGETHERNESS_STATE,
  type NpcTogethernessStateSnapshot,
} from '../game/npcTogetherness';
import {
  buildNpcPairPoseDecisionReply,
  canGiftNpcToday,
  getGiftCatalogItem,
  type GiftItemInput,
} from '../game/npcGiftEngine';
import type { NpcEmotionTag } from '../game/npcPersonaRegistry';
import { dispatchNpcEmotionReaction, sendNpcChatMessage } from '../game/npcTextChat';
import {
  GiftBoxBubbleSvg,
  InteractionRequestBubble,
  type NpcChatVisualPayload,
} from './NpcChatVisualBubbles';
import {
  resolveNpcPhotoUrl,
  useNpcPortraitVersion,
} from '../game/npcPortraitRegistry';

export interface CitizenGiftOutcome {
  accepted: boolean;
  reactionLine: string;
  tier: CitizenGiftReactionTier;
  pointsAwarded: number;
}

export interface NpcOwnedGiftOutcome {
  accepted: boolean;
  reactionLine: string;
  itemName: string;
}

export interface CitizenDialogueModalProps {
  isOpen: boolean;
  citizenId: CitizenId | null;
  openSeq?: number;
  initialTab?: 'sesi_chat' | 'gift' | 'directory';
  friendshipStore: CitizenFriendshipStore;
  npcClosenessStore?: NpcClosenessStore;
  caughtFishBucket: readonly CaughtFishItem[];
  ownedApparelIds?: readonly string[];
  ownedMerchantItemIds?: readonly string[];
  ownedCafeFoodIds?: readonly string[];
  playerName?: string;
  isRaining: boolean;
  daytimePhase?: 'day' | 'evening' | 'night';
  talkedBonusJustAwarded?: boolean;
  playerBubbleBgColor?: string;
  playerBubbleTextColor?: string;
  onClose: () => void;
  onGiveCatalogGift: (citizenId: CitizenId, giftId: string) => CitizenGiftOutcome;
  onGiveFishGift: (citizenId: CitizenId, fish: CaughtFishItem) => CitizenGiftOutcome;
  onGiveNpcOwnedGift?: (
    npcId: NpcId,
    itemInput: GiftItemInput,
    fishInstanceId?: string,
  ) => NpcOwnedGiftOutcome;
  onNpcConversationTurn?: (
    npcId: NpcId,
    closenessDelta: number,
    emotion: NpcEmotionTag,
  ) => void;
  npcTogethernessState?: NpcTogethernessStateSnapshot;
  onToggleNpcWalkTogether?: (npcId: NpcId) => void;
  onTriggerNpcPairPose?: (npcId: NpcId, poseId?: string) => void;
  onToggleNpcRideTogether?: (npcId: NpcId) => void;
  onVisitDirectoryCitizen: (profile: CitizenProfile) => void;
}

type CitizenChatTab = 'sesi_chat' | 'gift' | 'directory';

interface CitizenChatEntry {
  id: string;
  role: 'player' | 'npc';
  text: string;
  visual?: NpcChatVisualPayload;
}

export const CitizenDialogueModal: React.FC<CitizenDialogueModalProps> = ({
  isOpen,
  citizenId,
  openSeq = 0,
  initialTab = 'sesi_chat',
  friendshipStore,
  npcClosenessStore,
  caughtFishBucket,
  ownedApparelIds = [],
  ownedMerchantItemIds = [],
  ownedCafeFoodIds = [],
  playerName = '',
  isRaining,
  daytimePhase = 'day',
  talkedBonusJustAwarded: _talkedBonusJustAwarded = false,
  playerBubbleBgColor: _playerBubbleBgColor = '#fef9c3',
  playerBubbleTextColor: _playerBubbleTextColor = '#0f172a',
  onClose,
  onGiveCatalogGift,
  onGiveFishGift,
  onGiveNpcOwnedGift,
  onNpcConversationTurn,
  npcTogethernessState = EMPTY_NPC_TOGETHERNESS_STATE,
  onToggleNpcWalkTogether,
  onTriggerNpcPairPose,
  onToggleNpcRideTogether,
  onVisitDirectoryCitizen,
}) => {
  useNpcPortraitVersion();
  const [activeTab, setActiveTab] = useState<CitizenChatTab>('sesi_chat');
  const [showPairPosePicker, setShowPairPosePicker] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<CitizenChatEntry[]>([]);
  const [npcFullText, setNpcFullText] = useState<string>('');
  const [npcTypedText, setNpcTypedText] = useState<string>('');
  const [isNpcThinking, setIsNpcThinking] = useState<boolean>(false);
  const [giftFeedback, setGiftFeedback] = useState<{
    citizenId: string;
    accepted: boolean;
    reactionLine: string;
    giftLabel: string;
  } | null>(null);

  const chatScrollEndRef = useRef<HTMLDivElement | null>(null);
  const npcFullTextRef = useRef<string>('');
  npcFullTextRef.current = npcFullText;
  const activeRequestIdRef = useRef<number>(0);

  const profile = citizenId ? getCitizenProfile(citizenId) : null;
  const isNpcOpen = Boolean(isOpen && profile);
  const namedNpcId: NpcId | null = profile ? resolveNpcId(profile.id) : null;
  const effectiveClosenessStore = npcClosenessStore ?? createEmptyNpcClosenessStore();

  const todayKey = getCitizenLocalDateKey();
  const record = profile
    ? getCitizenFriendshipRecord(friendshipStore, profile.id)
    : null;
  const progress = getCitizenHeartProgress(record?.points ?? 0);
  const giftedToday = namedNpcId
    ? !canGiftNpcToday(effectiveClosenessStore, namedNpcId)
    : record?.lastGiftDate === todayKey;

  const ownedGiftSections = useMemo(() => {
    const cafeItems = Array.from(new Set(ownedCafeFoodIds))
      .map((id) => getGiftCatalogItem(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item && item.category === 'cafe_food'));

    const apparelItems = Array.from(new Set(ownedApparelIds))
      .map((id) => getGiftCatalogItem(id))
      .filter(
        (item): item is NonNullable<typeof item> =>
          Boolean(item && item.category === 'fashion_apparel'),
      );

    const furnitureItems = Array.from(new Set(ownedMerchantItemIds))
      .map((id) => getGiftCatalogItem(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item && item.category === 'furniture'));

    return { cafeItems, apparelItems, furnitureItems };
  }, [ownedApparelIds, ownedCafeFoodIds, ownedMerchantItemIds]);

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
    activeRequestIdRef.current += 1;
    setIsNpcThinking(false);
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
    const updatedHistory = [...chatHistory, ...nextEntries];
    setChatHistory(updatedHistory);
    setActiveTab('sesi_chat');

    // Ambient citizens (e.g. Raka) stay strictly scripted — NO AI calls.
    if (!namedNpcId) {
      const { reply } = generateCitizenChatReply({
        citizenId: profile.id,
        userText: trimmed,
        hearts: progress.hearts,
        timePhase: daytimePhase,
        isRaining,
        talkedCount: record.totalTalks + chatHistory.length,
      });
      setNpcFullText(reply);
      setNpcTypedText('');
      window.setTimeout(() => {
        chatScrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 40);
      return;
    }

    // Named NPCs use server-side Gemini text chat (/api/npc-chat)
    const reqId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = reqId;
    setIsNpcThinking(true);
    setNpcFullText('');
    setNpcTypedText('');

    const band = getNpcClosenessBand(effectiveClosenessStore, namedNpcId);
    const allowLong = canLongConversation(effectiveClosenessStore, namedNpcId);

    void (async () => {
      const result = await sendNpcChatMessage({
        npcId: namedNpcId,
        message: trimmed,
        history: updatedHistory.slice(-10).map((h) => ({ role: h.role, text: h.text })),
        closenessBand: band,
        canLongConversation: allowLong,
        playerName: playerName || undefined,
      });
      if (activeRequestIdRef.current !== reqId) return;
      setIsNpcThinking(false);
      const replyText =
        result.ok && result.reply.trim()
          ? result.reply.trim()
          : generateCitizenChatReply({
              citizenId: profile.id,
              userText: trimmed,
              hearts: progress.hearts,
              timePhase: daytimePhase,
              isRaining,
              talkedCount: record.totalTalks + chatHistory.length,
            }).reply;
      onNpcConversationTurn?.(namedNpcId, result.closenessDelta, result.emotion);
      setNpcFullText(replyText);
      setNpcTypedText('');
      window.setTimeout(() => {
        chatScrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 40);
    })();
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
    const onDockInteractionRequest = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{
          npcId?: string;
          kind?: 'pair_pose';
          targetEntity?: unknown;
        }>
      ).detail;
      if (!detail || !namedNpcId || detail.npcId !== namedNpcId) return;
      setActiveTab('sesi_chat');
      activeRequestIdRef.current += 1;
      setIsNpcThinking(false);
      const accepted = canPairPose(effectiveClosenessStore, namedNpcId);
      const reply = buildNpcPairPoseDecisionReply(namedNpcId, accepted);
      setChatHistory((prev) => {
        const next = [...prev];
        if (npcFullText.trim()) {
          next.push({ id: `npc_${Date.now()}_prev`, role: 'npc', text: npcFullText });
        }
        next.push({
          id: `player_interact_${Date.now()}`,
          role: 'player',
          text: 'Pair Pose?',
          visual: { kind: 'interaction', emoji: '🤝✨', label: 'Pair Pose?' },
        });
        return next;
      });
      dispatchNpcEmotionReaction(namedNpcId, accepted ? 'happy' : 'shy');
      setNpcFullText(reply);
      setNpcTypedText('');
      window.setTimeout(() => {
        chatScrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 40);
      if (accepted) {
        window.setTimeout(() => {
          onClose();
          window.dispatchEvent(
            new CustomEvent('npc-chat-open-pair-pose-catalog', {
              detail: { npcId: namedNpcId, targetEntity: detail.targetEntity },
            }),
          );
        }, 950);
      }
    };
    const onDockGiftSent = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{
          npcId?: string;
          itemName?: string;
          accepted?: boolean;
          reactionLine?: string;
        }>
      ).detail;
      if (!detail || !namedNpcId || detail.npcId !== namedNpcId) return;
      setActiveTab('sesi_chat');
      activeRequestIdRef.current += 1;
      setIsNpcThinking(false);
      const itemName = detail.itemName || 'Gift';
      const reply = detail.accepted
        ? detail.reactionLine || 'Thank you so much!'
        : detail.reactionLine || 'You already brought me a gift today. Let us save the next one for tomorrow!';
      setChatHistory((prev) => {
        const next = [...prev];
        if (npcFullText.trim()) {
          next.push({ id: `npc_${Date.now()}_prev`, role: 'npc', text: npcFullText });
        }
        next.push({
          id: `player_gift_${Date.now()}`,
          role: 'player',
          text: `Sent a gift: ${itemName}`,
          visual: { kind: 'gift_box', itemName },
        });
        return next;
      });
      setNpcFullText(reply);
      setNpcTypedText('');
      window.setTimeout(() => {
        chatScrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 40);
    };
    window.addEventListener('citizen-dialogue-user-chat', onUserChat);
    window.addEventListener('npc-chat-interaction-request', onDockInteractionRequest);
    window.addEventListener('npc-chat-gift-sent', onDockGiftSent);
    return () => {
      window.removeEventListener('citizen-dialogue-user-chat', onUserChat);
      window.removeEventListener('npc-chat-interaction-request', onDockInteractionRequest);
      window.removeEventListener('npc-chat-gift-sent', onDockGiftSent);
    };
  }, [isNpcOpen, namedNpcId, effectiveClosenessStore, npcFullText, onClose, profile?.name]);

  const handleClearChat = () => {
    if (!profile) return;
    soundEngine.playUiClick();
    activeRequestIdRef.current += 1;
    setIsNpcThinking(false);
    setChatHistory([]);
    setNpcFullText(buildOpeningGreeting(profile));
    setNpcTypedText('');
  };

  const directoryEntries = listCitizenDirectory(friendshipStore, todayKey);
  const activeFeedback =
    profile && giftFeedback && giftFeedback.citizenId === profile.id ? giftFeedback : null;

  const handleOwnedGiftClick = (
    itemInput: GiftItemInput,
    giftLabel: string,
    fishInstanceId?: string,
  ) => {
    if (!profile || !namedNpcId || !onGiveNpcOwnedGift) return;
    soundEngine.playUiClick();
    const outcome = onGiveNpcOwnedGift(namedNpcId, itemInput, fishInstanceId);
    setGiftFeedback({
      citizenId: profile.id,
      accepted: outcome.accepted,
      reactionLine: outcome.reactionLine,
      giftLabel,
    });
  };

  const handleAmbientCatalogGiftClick = (giftId: string, giftLabel: string) => {
    if (!profile) return;
    const outcome = onGiveCatalogGift(profile.id, giftId);
    setGiftFeedback({
      citizenId: profile.id,
      accepted: outcome.accepted,
      reactionLine: outcome.reactionLine,
      giftLabel,
    });
  };

  const handleAmbientFishGiftClick = (fish: CaughtFishItem) => {
    if (!profile) return;
    const outcome = onGiveFishGift(profile.id, fish);
    setGiftFeedback({
      citizenId: profile.id,
      accepted: outcome.accepted,
      reactionLine: outcome.reactionLine,
      giftLabel: `${fish.speciesName} (${fish.weightKg.toFixed(1)}kg)`,
    });
  };

  const hasAnyOwnedNamedGift =
    caughtFishBucket.length > 0 ||
    ownedGiftSections.cafeItems.length > 0 ||
    ownedGiftSections.apparelItems.length > 0 ||
    ownedGiftSections.furnitureItems.length > 0;

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
        <div className="relative flex-1 flex flex-col rounded-[32px] bg-gradient-to-b from-[#171d2c]/86 via-[#111622]/84 to-[#0c101a]/88 border border-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_24px_70px_rgba(0,0,0,0.58)] text-white overflow-hidden min-h-0">
          {/* Top Status Strip: CERRIA OS + Close Icon */}
          <div className="shrink-0 flex items-center justify-between text-[10.5px] font-medium px-4 pt-3 pb-1.5 text-white/90">
            <div className="flex items-center gap-1.5">
              <Wifi className="w-3 h-3 text-white/85" aria-hidden="true" />
              <span className="tracking-wide font-semibold">CERRIA OS</span>
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

          {/* Active Chat Person Header (no visible closeness indicators) */}
          <div className="shrink-0 flex items-center justify-between gap-2.5 px-3.5 py-2 border-b border-white/12">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={resolveNpcPhotoUrl(profile.id, 'avatar')}
                alt={profile.name}
                draggable={false}
                className="w-9 h-9 rounded-full object-cover object-center shadow-sm shrink-0 ring-1 ring-white/25"
              />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white leading-tight truncate">
                  {profile.name}
                </div>
                <div className="text-[10px] text-white/65 leading-tight truncate">
                  {profile.roleBadge} · {profile.districtLabel}
                </div>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)] shrink-0" />
          </div>

          {/* Tab Viewport */}
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
                          {entry.visual?.kind === 'gift_box' ? (
                            <GiftBoxBubbleSvg itemName={entry.visual.itemName || entry.text} />
                          ) : entry.visual?.kind === 'interaction' ? (
                            <InteractionRequestBubble
                              emoji={entry.visual.emoji || '🤝✨'}
                              label={entry.visual.label || entry.text}
                            />
                          ) : (
                            <p className="text-xs font-medium leading-relaxed">
                              {entry.text}
                            </p>
                          )}
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

                  {/* Active NPC Typewriter Speech Bubble or Thinking Indicator */}
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
                      {isNpcThinking ? (
                        <p className="text-xs font-medium leading-relaxed text-slate-500">
                          Typing...
                        </p>
                      ) : (
                        <p className="text-xs font-medium leading-relaxed text-slate-900">
                          {npcTypedText}
                          {npcTypedText.length < npcFullText.length && (
                            <span className="inline-block w-1.5 h-3.5 rounded-full bg-sky-500 ml-0.5 align-middle animate-pulse" />
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  <div ref={chatScrollEndRef} />
                </div>

                {/* Quick-Reply Choices + Togetherness Actions (plain English, zero closeness UI) + Clear Chat */}
                <div className="px-3.5 py-2.5 border-t border-white/10 shrink-0 bg-black/15 space-y-1.5">
                  {namedNpcId &&
                    (canPairPose(effectiveClosenessStore, namedNpcId) ||
                      canWalkTogether(effectiveClosenessStore, namedNpcId) ||
                      canRideTogether(effectiveClosenessStore, namedNpcId) ||
                      npcTogethernessState.walkingNpcId === namedNpcId ||
                      npcTogethernessState.pairPoseNpcId === namedNpcId ||
                      npcTogethernessState.ridingNpcId === namedNpcId) && (
                      <div className="space-y-1.5 pb-1 border-b border-white/10" data-npc-togetherness-actions="true">
                        <div className="flex flex-wrap gap-1.5">
                          {(canWalkTogether(effectiveClosenessStore, namedNpcId) ||
                            npcTogethernessState.walkingNpcId === namedNpcId) &&
                            onToggleNpcWalkTogether && (
                              <button
                                type="button"
                                data-npc-walk-together-btn="true"
                                onClick={() => {
                                  soundEngine.playUiClick();
                                  onToggleNpcWalkTogether(namedNpcId);
                                }}
                                className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold cursor-pointer transition-colors ${
                                  npcTogethernessState.walkingNpcId === namedNpcId
                                    ? 'bg-amber-500/30 hover:bg-amber-500/45 text-amber-100 border border-amber-300/45'
                                    : 'bg-sky-500/25 hover:bg-sky-500/40 text-sky-100 border border-sky-300/35'
                                }`}
                              >
                                {npcTogethernessState.walkingNpcId === namedNpcId
                                  ? 'End walk'
                                  : 'Ask to walk together'}
                              </button>
                            )}

                          {(canPairPose(effectiveClosenessStore, namedNpcId) ||
                            npcTogethernessState.pairPoseNpcId === namedNpcId) &&
                            onTriggerNpcPairPose && (
                              <button
                                type="button"
                                data-npc-pair-pose-btn="true"
                                onClick={() => {
                                  soundEngine.playUiClick();
                                  if (npcTogethernessState.pairPoseNpcId === namedNpcId) {
                                    setShowPairPosePicker(false);
                                    onTriggerNpcPairPose(namedNpcId);
                                  } else {
                                    setShowPairPosePicker((prev) => !prev);
                                  }
                                }}
                                className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold cursor-pointer transition-colors ${
                                  npcTogethernessState.pairPoseNpcId === namedNpcId
                                    ? 'bg-amber-500/30 hover:bg-amber-500/45 text-amber-100 border border-amber-300/45'
                                    : 'bg-violet-500/25 hover:bg-violet-500/40 text-violet-100 border border-violet-300/35'
                                }`}
                              >
                                {npcTogethernessState.pairPoseNpcId === namedNpcId
                                  ? 'Stop photo pose'
                                  : 'Take a pair photo'}
                              </button>
                            )}

                          {(canRideTogether(effectiveClosenessStore, namedNpcId) ||
                            npcTogethernessState.ridingNpcId === namedNpcId) &&
                            onToggleNpcRideTogether && (
                              <button
                                type="button"
                                data-npc-ride-together-btn="true"
                                onClick={() => {
                                  soundEngine.playUiClick();
                                  onToggleNpcRideTogether(namedNpcId);
                                }}
                                className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold cursor-pointer transition-colors ${
                                  npcTogethernessState.ridingNpcId === namedNpcId
                                    ? 'bg-amber-500/30 hover:bg-amber-500/45 text-amber-100 border border-amber-300/45'
                                    : 'bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-100 border border-emerald-300/35'
                                }`}
                              >
                                {npcTogethernessState.ridingNpcId === namedNpcId
                                  ? 'End ride'
                                  : 'Ask to ride together'}
                              </button>
                            )}
                        </div>

                        {showPairPosePicker &&
                          npcTogethernessState.pairPoseNpcId !== namedNpcId &&
                          onTriggerNpcPairPose && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {CURATED_NPC_PAIR_POSES.map((pose) => (
                                <button
                                  key={pose.id}
                                  type="button"
                                  onClick={() => {
                                    soundEngine.playUiClick();
                                    setShowPairPosePicker(false);
                                    onTriggerNpcPairPose(namedNpcId, pose.id);
                                  }}
                                  className="px-2 py-0.5 rounded-lg bg-white/12 hover:bg-white/22 border border-white/15 text-[10px] font-medium text-white/90 cursor-pointer transition-colors"
                                >
                                  {pose.label}
                                </button>
                              ))}
                            </div>
                          )}
                      </div>
                    )}
                  <div className="flex justify-end pt-0.5">
                    <button
                      type="button"
                      data-citizen-clear-chat-btn="true"
                      onClick={handleClearChat}
                      className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/18 text-white/75 hover:text-white border border-white/15 text-[10px] font-semibold cursor-pointer inline-flex items-center transition-colors shrink-0"
                    >
                      <span>Clear chat</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'gift' && (
              <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 min-h-0">
                <div className="p-3 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-white/90">
                    {giftedToday
                      ? `You already gave ${profile.name} a gift today.`
                      : `Choose an item to give ${profile.name} today.`}
                  </div>
                </div>

                {activeFeedback && (
                  <div className="p-3 rounded-2xl bg-white/12 border border-sky-300/35 space-y-1">
                    <div className="text-[10.5px] font-medium text-white/65">
                      {activeFeedback.giftLabel}
                    </div>
                    <p className="text-xs font-medium text-white/95 leading-relaxed">
                      “{activeFeedback.reactionLine}”
                    </p>
                  </div>
                )}

                {namedNpcId && onGiveNpcOwnedGift ? (
                  <>
                    {!hasAnyOwnedNamedGift && (
                      <div className="p-3 rounded-2xl bg-white/8 border border-dashed border-white/20 text-xs font-medium text-white/65">
                        Pick up fish, cafe treats, clothing, or furniture around town to share as a gift.
                      </div>
                    )}

                    {caughtFishBucket.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[10.5px] font-semibold text-white/65 px-0.5">
                          Fresh Catch ({caughtFishBucket.length})
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {caughtFishBucket.slice(0, 8).map((fish) => (
                            <button
                              key={fish.id}
                              type="button"
                              disabled={giftedToday}
                              onClick={() =>
                                handleOwnedGiftClick(
                                  { speciesId: fish.speciesId, isTrophy: fish.isTrophy },
                                  `${fish.speciesName} (${fish.weightKg.toFixed(1)}kg)`,
                                  fish.id,
                                )
                              }
                              className={`p-2.5 rounded-2xl border text-left flex items-center justify-between gap-2 transition-all ${
                                giftedToday
                                  ? 'bg-white/5 border-white/10 opacity-45 cursor-not-allowed'
                                  : 'bg-white/10 hover:bg-white/18 border-white/15 hover:border-sky-300/50 cursor-pointer'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-white truncate">
                                  {fish.speciesName}
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
                      </div>
                    )}

                    {ownedGiftSections.cafeItems.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[10.5px] font-semibold text-white/65 px-0.5">
                          Cafe Food &amp; Drinks ({ownedGiftSections.cafeItems.length})
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {ownedGiftSections.cafeItems.map((item) => (
                            <button
                              key={item.itemId}
                              type="button"
                              disabled={giftedToday}
                              onClick={() => handleOwnedGiftClick(item.itemId, item.name)}
                              className={`p-2.5 rounded-2xl border text-left flex items-center justify-between gap-2 transition-all ${
                                giftedToday
                                  ? 'bg-white/5 border-white/10 opacity-45 cursor-not-allowed'
                                  : 'bg-white/10 hover:bg-white/18 border-white/15 hover:border-sky-300/50 cursor-pointer'
                              }`}
                            >
                              <div className="text-xs font-semibold text-white truncate">
                                {item.name}
                              </div>
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-semibold shrink-0">
                                Give
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {ownedGiftSections.apparelItems.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[10.5px] font-semibold text-white/65 px-0.5">
                          Fashion &amp; Apparel ({ownedGiftSections.apparelItems.length})
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {ownedGiftSections.apparelItems.slice(0, 8).map((item) => (
                            <button
                              key={item.itemId}
                              type="button"
                              disabled={giftedToday}
                              onClick={() => handleOwnedGiftClick(item.itemId, item.name)}
                              className={`p-2.5 rounded-2xl border text-left flex items-center justify-between gap-2 transition-all ${
                                giftedToday
                                  ? 'bg-white/5 border-white/10 opacity-45 cursor-not-allowed'
                                  : 'bg-white/10 hover:bg-white/18 border-white/15 hover:border-sky-300/50 cursor-pointer'
                              }`}
                            >
                              <div className="text-xs font-semibold text-white truncate">
                                {item.name}
                              </div>
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-semibold shrink-0">
                                Give
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {ownedGiftSections.furnitureItems.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[10.5px] font-semibold text-white/65 px-0.5">
                          Furniture &amp; Decor ({ownedGiftSections.furnitureItems.length})
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {ownedGiftSections.furnitureItems.slice(0, 8).map((item) => (
                            <button
                              key={item.itemId}
                              type="button"
                              disabled={giftedToday}
                              onClick={() => handleOwnedGiftClick(item.itemId, item.name)}
                              className={`p-2.5 rounded-2xl border text-left flex items-center justify-between gap-2 transition-all ${
                                giftedToday
                                  ? 'bg-white/5 border-white/10 opacity-45 cursor-not-allowed'
                                  : 'bg-white/10 hover:bg-white/18 border-white/15 hover:border-sky-300/50 cursor-pointer'
                              }`}
                            >
                              <div className="text-xs font-semibold text-white truncate">
                                {item.name}
                              </div>
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-semibold shrink-0">
                                Give
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
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
                            onClick={() => handleAmbientCatalogGiftClick(gift.id, gift.label)}
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
                              onClick={() => handleAmbientFishGiftClick(fish)}
                              className={`p-2.5 rounded-2xl border text-left flex items-center justify-between gap-2 transition-all ${
                                giftedToday
                                  ? 'bg-white/5 border-white/10 opacity-45 cursor-not-allowed'
                                  : 'bg-white/10 hover:bg-white/18 border-white/15 hover:border-sky-300/50 cursor-pointer'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-white truncate">
                                  {fish.speciesName}
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
                  </>
                )}
              </div>
            )}

            {activeTab === 'directory' && (
              <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5 min-h-0">
                <div className="p-3 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-white">Blitz City Residents</div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {directoryEntries.map((entry) => {
                    const isCurrent = entry.profile.id === profile.id;
                    return (
                      <div
                        key={entry.profile.id}
                        className={`p-3 rounded-2xl border flex items-start justify-between gap-2 transition-all ${
                          isCurrent
                            ? 'bg-sky-500/20 border-sky-300/50 ring-1 ring-sky-300/30'
                            : 'bg-white/10 border-white/15'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <img
                              src={resolveNpcPhotoUrl(entry.profile.id, 'avatar')}
                              alt={entry.profile.name}
                              draggable={false}
                              className="w-7 h-7 rounded-full object-cover object-center ring-1 ring-white/25 shrink-0"
                            />
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
