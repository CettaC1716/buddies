import React, { useEffect, useRef, useState } from 'react';
import {
  MERCHANT_CATALOG_ITEMS,
  MerchantAgentMarketState,
  MerchantCatalogItem,
  MerchantLocationId,
  HouseInteriorSlotId,
  HOUSE_SURFACE_SWATCHES,
  PlacedHouseFurnitureItem,
  evaluateLulToCyonExchangeQuote,
  evaluateMerchantItemQuote,
  generateNpcMerchantReply,
  formatDaylightHour,
  evaluateRoomMoodScores,
} from '../game/buddiesMerchantPricing';
import { soundEngine } from '../game/audio';
import type { CaughtFishItem, FishNftMarketplaceListing } from '../game/buddiesFishingMarket';
import type { FishNftMarketSalesStats } from '../lib/supabaseClient';
import {
  Fish3dPreviewModal,
  Fish3dThumbnail,
  type Fish3dPreviewSpec,
} from './Fish3dPreviewModal';
import {
  FAMILY_MEMBER_CONTRACT_PLANS,
  FAMILY_MEMBER_ORDER_SPECS,
  HOUSE_OWNERSHIP_PRICE_RESPITE,
  RESPITE_NEP141_METADATA,
  getLastNearTransactionError,
  getNearBlocksTxUrl,
  isActiveWalletReadOnlyObserver,
  type FamilyMemberContractPlanId,
  type FamilyMemberOrderId,
  type NearRespiteSwapReceipt,
  type RecruitedFamilyMemberAgent,
} from '../lib/nearClient';

export interface HouseInteriorPlacementState {
  center_table: string | null;
  left_wall: string | null;
  right_wall: string | null;
  corner_plant: string | null;
  trophy_pedestal: string | null;
  rotationStepBySlot: Record<HouseInteriorSlotId, number>;
}

interface NpcMerchantAndHouseModalProps {
  activeModalMode: 'none' | 'npc_merchant' | 'house_interior';
  merchantLocation: MerchantLocationId;
  marketState: MerchantAgentMarketState;
  lulBalance: number;
  cyonBalance: number;
  respiteBalance: number;
  nearTestnetBalance?: number;
  walletConnected: boolean;
  hasHouseOwnership?: boolean;
  onBuyHouseWithRespite?: (priceRespite: number) => Promise<boolean> | boolean | void;
  recruitedFamilyMembers?: RecruitedFamilyMemberAgent[];
  onRecruitFamilyMember?: (
    planId: FamilyMemberContractPlanId,
  ) => Promise<RecruitedFamilyMemberAgent | null> | RecruitedFamilyMemberAgent | null | void;
  onCommandFamilyMember?: (agentId: string, orderId: FamilyMemberOrderId) => void;
  ownedItemIds: string[];
  activeHouseThemeId: string;
  interiorPlacement: HouseInteriorPlacementState;
  isFastForwardRunning?: boolean;
  onClose: () => void;
  onEarnSafezoneLul: (amount: number, reason: string) => void;
  onExchangeLulToCyon: (customLulSpent?: number, customCyonGranted?: number) => void;
  onSwapNearAndRespite?: (
    direction: 'near_to_respite' | 'respite_to_near',
    inputAmount: number,
  ) => Promise<NearRespiteSwapReceipt | null> | NearRespiteSwapReceipt | null | void;
  onInvestInMerchant: () => void;
  onBuyMerchantItem: (item: MerchantCatalogItem, price: number) => void;
  onSellMerchantItem: (item: MerchantCatalogItem, refund: number) => void;
  onToggleFastForward?: () => void;
  onSelectHouseTheme: (themeItem: MerchantCatalogItem) => void;
  onAssignInteriorSlot: (slot: HouseInteriorSlotId, itemId: string | null) => void;
  onRotateInteriorSlot: (slot: HouseInteriorSlotId) => void;
  onConnectWallet?: () => void;
  playerBubbleBgColor?: string;
  playerBubbleTextColor?: string;
  caughtFishBucket?: CaughtFishItem[];
  fishMarketListings?: FishNftMarketplaceListing[];
  fishSalesStats?: FishNftMarketSalesStats | null;
  playerNearAccount?: string;
  onSellCaughtFish?: (fish: CaughtFishItem) => void;
  onReleaseCaughtFish?: (fish: CaughtFishItem) => void;
  onReleaseAllCommonFish?: () => void;
  onMintFishAsNft?: (fish: CaughtFishItem) => Promise<boolean> | boolean | void;
  onListFishNftOnMarket?: (
    fish: CaughtFishItem,
    priceRespite: number,
  ) => Promise<boolean> | boolean | void;
  onBuyFishNftFromMarket?: (
    listing: FishNftMarketplaceListing,
  ) => Promise<boolean> | boolean | void;
  isSampleHouseView?: boolean;
  citizenDisplayName?: string;
  isTutorialHanaActive?: boolean;
  hanaWelcomeNearClaimed?: boolean;
  onClaimHanaWelcomeNear?: () => Promise<{
    ok: boolean;
    txHash: string;
    explorerUrl: string;
    amountNear: number;
    error?: string;
  }>;
  onFinishHanaTutorialAndGuideKiosk?: () => void;
}

export const NpcMerchantAndHouseModal: React.FC<NpcMerchantAndHouseModalProps> = ({
  activeModalMode,
  merchantLocation,
  isSampleHouseView = false,
  marketState,
  lulBalance,
  cyonBalance,
  respiteBalance,
  nearTestnetBalance = 0,
  walletConnected,
  hasHouseOwnership = false,
  onBuyHouseWithRespite,
  recruitedFamilyMembers = [],
  onRecruitFamilyMember,
  onCommandFamilyMember,
  ownedItemIds,
  activeHouseThemeId,
  interiorPlacement: _interiorPlacement,
  isFastForwardRunning: _isFastForwardRunning = false,
  onClose,
  onEarnSafezoneLul: _onEarnSafezoneLul,
  onExchangeLulToCyon,
  onSwapNearAndRespite,
  onInvestInMerchant,
  onBuyMerchantItem,
  onSellMerchantItem,
  onToggleFastForward: _onToggleFastForward,
  onSelectHouseTheme,
  onAssignInteriorSlot: _onAssignInteriorSlot,
  onRotateInteriorSlot: _onRotateInteriorSlot,
  onConnectWallet,
  playerBubbleBgColor = '#0f172a',
  playerBubbleTextColor = '#f8fafc',
  caughtFishBucket = [],
  fishMarketListings = [],
  fishSalesStats = null,
  playerNearAccount = '',
  onSellCaughtFish,
  onReleaseCaughtFish,
  onReleaseAllCommonFish,
  onMintFishAsNft,
  onListFishNftOnMarket,
  onBuyFishNftFromMarket,
  citizenDisplayName = '',
  isTutorialHanaActive = false,
  hanaWelcomeNearClaimed = false,
  onClaimHanaWelcomeNear,
  onFinishHanaTutorialAndGuideKiosk,
}) => {
  const [activeTab, setActiveTab] = useState<'sesi_chat' | 'transaksi' | 'katalog' | 'fish_market'>(
    'sesi_chat',
  );
  const [isClaimingHanaNear, setIsClaimingHanaNear] = useState<boolean>(false);
  const [hanaClaimResult, setHanaClaimResult] = useState<{
    ok: boolean;
    txHash: string;
    explorerUrl: string;
    amountNear: number;
    error?: string;
  } | null>(null);
  const [npcFullText, setNpcFullText] = useState<string>('');
  const [npcTypedText, setNpcTypedText] = useState<string>('');
  const [, setLastPlayerMessage] = useState<string>('');
  const [chatInputDraft, setChatInputDraft] = useState<string>('');
  const [isNpcThinking, setIsNpcThinking] = useState<boolean>(false);
  const activeNpcRequestIdRef = useRef<number>(0);
  const [chatHistory, setChatHistory] = useState<
    Array<{ id: string; role: 'player' | 'npc'; text: string }>
  >([]);
  const chatScrollEndRef = useRef<HTMLDivElement | null>(null);
  const [exchangeLulAmountStr, setExchangeLulAmountStr] = useState<string>('0');
  const [cryptoSwapInputStr, setCryptoSwapInputStr] = useState<string>('0.25');
  const [lastCryptoSwapReceipt, setLastCryptoSwapReceipt] =
    useState<NearRespiteSwapReceipt | null>(null);
  const [isSwappingNear, setIsSwappingNear] = useState<boolean>(false);
  const [swapErrorText, setSwapErrorText] = useState<string | null>(null);
  const [isBuyingCatalogAsset, setIsBuyingCatalogAsset] = useState<boolean>(false);
  const [catalogActionFeedback, setCatalogActionFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [busyFishActionId, setBusyFishActionId] = useState<string | null>(null);
  const [fishMarketFeedback, setFishMarketFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [selectedFamilyPlanId, setSelectedFamilyPlanId] =
    useState<FamilyMemberContractPlanId>('1_week');
  const [hanaCatalogSlide, setHanaCatalogSlide] = useState<'house' | 'family'>('house');
  const [kaiCatalogPage, setKaiCatalogPage] = useState<number>(0);
  const [selectedKaiFishingId, setSelectedKaiFishingId] = useState<string>(
    'fishing_rod_carbon_pro',
  );
  const [listingPriceByFishId, setListingPriceByFishId] = useState<Record<string, string>>({});
  const [preview3dFish, setPreview3dFish] = useState<Fish3dPreviewSpec | null>(null);

  useEffect(() => {
    const onOpenFishTab = () => {
      if (merchantLocation === 'beach_house') {
        setActiveTab('fish_market');
      }
    };
    window.addEventListener('open-npc-fish-market', onOpenFishTab);
    return () => window.removeEventListener('open-npc-fish-market', onOpenFishTab);
  }, [merchantLocation]);

  useEffect(() => {
    if (merchantLocation !== 'beach_house' && activeTab === 'fish_market') {
      setActiveTab('sesi_chat');
    }
  }, [merchantLocation, activeTab]);

  useEffect(() => {
    const onOpenCatalogHouse = () => {
      setActiveTab('katalog');
      setHanaCatalogSlide('house');
    };
    window.addEventListener('open-npc-catalog-house', onOpenCatalogHouse);
    return () => window.removeEventListener('open-npc-catalog-house', onOpenCatalogHouse);
  }, []);

  // Cutaway Interior Studio State
  const [studioDockTab, setStudioDockTab] = useState<'furniture' | 'materials' | 'lighting'>(
    'furniture',
  );
  const [daylightHour, setDaylightHour] = useState<number>(18.5);
  const [floorSwatchId, setFloorSwatchId] = useState<string>('floor_tatami_oak');
  const [wallSwatchId, setWallSwatchId] = useState<string>('wall_limewash');
  const [slatsSwatchId, setSlatsSwatchId] = useState<string>('slats_walnut');
  const [placed3dItems, setPlaced3dItems] = useState<PlacedHouseFurnitureItem[]>([]);
  const [selected3dInstanceId, setSelected3dInstanceId] = useState<string | null>(null);

  useEffect(() => {
    const onHouseStateUpdated = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{
          placedItems?: PlacedHouseFurnitureItem[];
          selectedInstanceId?: string | null;
        }>
      ).detail;
      if (!detail) return;
      if (detail.placedItems) {
        setPlaced3dItems(detail.placedItems);
      }
      if (detail.selectedInstanceId !== undefined) {
        setSelected3dInstanceId(detail.selectedInstanceId);
      }
    };
    window.addEventListener('house-interior-state-updated', onHouseStateUpdated);
    return () => window.removeEventListener('house-interior-state-updated', onHouseStateUpdated);
  }, []);

  const dispatchHouseStudioPatch = (patch: Record<string, unknown>) => {
    window.dispatchEvent(
      new CustomEvent('sync-npc-camera-mode', {
        detail: patch,
      }),
    );
  };

  const npcShortName = merchantLocation === 'lobby_cafe' ? 'HANA' : 'KAI';

  // Initial greeting when NPC modal opens
  useEffect(() => {
    if (activeModalMode === 'npc_merchant') {
      const locLabel = merchantLocation === 'lobby_cafe' ? 'Central Plaza Cafe' : 'Beachfront Harbor';
      const displayCitizen = citizenDisplayName?.trim() || 'Buddy';
      let greeting = '';
      if (
        merchantLocation === 'lobby_cafe' &&
        walletConnected &&
        (isTutorialHanaActive || !hanaWelcomeNearClaimed)
      ) {
        setActiveTab('sesi_chat');
        greeting = `Welcome to ${locLabel}, ${displayCitizen}. Claim your 0.30 NEAR welcome bonus below, or ask me anything about places in the city, fishing, Fish NFT sales, currencies, or the Warzone.`;
      } else if (!walletConnected) {
        greeting = `Welcome, Buddy. You are in Guest Mode—ask me anything about the game below, or sign in to unlock the Exchange and Catalog.`;
      } else if (merchantLocation === 'beach_house') {
        greeting = `Welcome to ${locLabel}, ${displayCitizen}. Sell fish, trade Fish NFTs, browse tackle, or ask me anything about fishing and market records.`;
      } else {
        greeting = `Welcome back, ${displayCitizen}. Exchange currencies, browse the Catalog, or ask me anything about the game below.`;
      }
      setNpcFullText(greeting);
      setNpcTypedText('');
      setLastPlayerMessage('');
      setChatHistory([]);
      setChatInputDraft('');
      setIsNpcThinking(false);
      activeNpcRequestIdRef.current += 1;
    }
  }, [
    activeModalMode,
    merchantLocation,
    walletConnected,
    isTutorialHanaActive,
    hanaWelcomeNearClaimed,
    citizenDisplayName,
    playerNearAccount,
  ]);

  // Typewriter effect for NPC dialogue
  useEffect(() => {
    if (activeModalMode !== 'npc_merchant' || !npcFullText) return;
    if (npcTypedText.length >= npcFullText.length) return;
    const timer = window.setTimeout(() => {
      setNpcTypedText(npcFullText.slice(0, npcTypedText.length + 2));
    }, 16);
    return () => window.clearTimeout(timer);
  }, [activeModalMode, npcFullText, npcTypedText]);

  const triggerNpcSpeech = (text: string) => {
    setNpcFullText(text);
    setNpcTypedText('');
  };

  const submitPlayerQuestion = (rawText: string) => {
    const text = rawText.trim();
    if (!text) return;

    const prevNpcMsg = isNpcThinking ? '' : npcFullText.trim();
    setLastPlayerMessage(text);
    setActiveTab('sesi_chat');

    const priorTurns = prevNpcMsg
      ? [...chatHistory, { id: `npc-${Date.now()}-prev`, role: 'npc' as const, text: prevNpcMsg }]
      : [...chatHistory];
    const nextHistory = [
      ...priorTurns.slice(-14),
      { id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, role: 'player' as const, text },
    ];
    setChatHistory(nextHistory);

    const reqId = activeNpcRequestIdRef.current + 1;
    activeNpcRequestIdRef.current = reqId;
    setIsNpcThinking(true);
    setNpcFullText('');
    setNpcTypedText('');

    window.setTimeout(() => {
      chatScrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 30);

    const quote = evaluateLulToCyonExchangeQuote(marketState);
    const catalogSnapshot = MERCHANT_CATALOG_ITEMS.map((item) => {
      const p = evaluateMerchantItemQuote(marketState, item);
      return {
        name: item.name,
        category: item.category,
        currency: item.currency,
        buyPrice: p.buyPrice,
        stock: p.stock,
      };
    });

    const fallbackReply = () =>
      generateNpcMerchantReply(
        text,
        merchantLocation,
        marketState,
        {
          lul: lulBalance,
          cyon: cyonBalance,
          respite: respiteBalance,
          walletConnected,
        },
        {
          playerNearAccount,
          nearBalance: nearTestnetBalance,
          hasHouseOwnership,
          hanaWelcomeNearClaimed: Boolean(hanaWelcomeNearClaimed || hanaClaimResult?.ok),
          caughtFishCount: caughtFishBucket.length,
          recruitedFamilyCount: recruitedFamilyMembers.length,
          fishMarketListings,
          fishSalesStats,
        },
      );

    void (async () => {
      try {
        const res = await fetch('/api/npc-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userMessage: text,
            merchantLocation,
            history: nextHistory.slice(-10).map((h) => ({ role: h.role, text: h.text })),
            liveState: {
              citizenDisplayName,
              playerNearAccount,
              walletConnected,
              lulBalance,
              cyonBalance,
              respiteBalance,
              nearBalance: nearTestnetBalance,
              hasHouseOwnership,
              hanaWelcomeNearClaimed: Boolean(hanaWelcomeNearClaimed || hanaClaimResult?.ok),
              caughtFishCount: caughtFishBucket.length,
              recruitedFamilyCount: recruitedFamilyMembers.length,
              simulatedDay: marketState.dayCounter,
              shopCyonReserve: marketState.treasuryCyon,
              isShopBroke: marketState.isShopBroke,
              lulCostFor10Cyon: quote.lulCostFor10Cyon,
              cyonGranted: quote.cyonGranted,
              investorDiscountActive: marketState.investorDiscountActive,
              fishSalesStats: fishSalesStats
                ? {
                    topSale: fishSalesStats.topSale
                      ? {
                          speciesName: fishSalesStats.topSale.speciesName,
                          weightKg: fishSalesStats.topSale.weightKg,
                          priceRespite: fishSalesStats.topSale.priceRespite,
                          buyerAccount: fishSalesStats.topSale.buyerAccount,
                          sellerAccount: fishSalesStats.topSale.sellerAccount,
                        }
                      : null,
                    recentSale: fishSalesStats.recentSale
                      ? {
                          speciesName: fishSalesStats.recentSale.speciesName,
                          weightKg: fishSalesStats.recentSale.weightKg,
                          priceRespite: fishSalesStats.recentSale.priceRespite,
                          buyerAccount: fishSalesStats.recentSale.buyerAccount,
                          sellerAccount: fishSalesStats.recentSale.sellerAccount,
                        }
                      : null,
                    totalSalesCount: fishSalesStats.totalSalesCount,
                  }
                : null,
              fishMarketListings: fishMarketListings.slice(0, 8).map((l) => ({
                speciesName: l.speciesName,
                rarity: l.rarity,
                weightKg: l.weightKg,
                priceRespite: l.priceRespite,
                sellerNearAccount: l.sellerNearAccount,
              })),
              catalogSnapshot,
            },
          }),
        });
        const data = (await res.json()) as { ok?: boolean; reply?: string };
        if (activeNpcRequestIdRef.current !== reqId) return;
        setIsNpcThinking(false);
        if (res.ok && data?.ok && data.reply?.trim()) {
          triggerNpcSpeech(data.reply.trim());
        } else {
          triggerNpcSpeech(fallbackReply());
        }
      } catch {
        if (activeNpcRequestIdRef.current !== reqId) return;
        setIsNpcThinking(false);
        triggerNpcSpeech(fallbackReply());
      }
      window.setTimeout(() => {
        chatScrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 40);
    })();
  };

  const handleSubmitInlineChat = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInputDraft.trim();
    if (!trimmed) return;
    soundEngine.playUiClick();
    setChatInputDraft('');
    submitPlayerQuestion(trimmed);
  };

  // Receive player chat messages submitted via the bottom-left TALK input bar
  useEffect(() => {
    if (activeModalMode !== 'npc_merchant') return;
    const onUserChat = (ev: Event) => {
      const text = (ev as CustomEvent<{ text?: string }>).detail?.text?.trim();
      if (!text) return;
      submitPlayerQuestion(text);
    };
    window.addEventListener('npc-merchant-user-chat', onUserChat);
    return () => window.removeEventListener('npc-merchant-user-chat', onUserChat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeModalMode,
    merchantLocation,
    marketState,
    lulBalance,
    cyonBalance,
    respiteBalance,
    nearTestnetBalance,
    walletConnected,
    hasHouseOwnership,
    hanaWelcomeNearClaimed,
    hanaClaimResult,
    caughtFishBucket.length,
    recruitedFamilyMembers.length,
    fishMarketListings,
    fishSalesStats,
    npcFullText,
  ]);

  const exchangeQuote = evaluateLulToCyonExchangeQuote(marketState);

  if (activeModalMode === 'house_interior') {
    const ownedFurniture = MERCHANT_CATALOG_ITEMS.filter(
      (it) => it.interiorSlot && ownedItemIds.includes(it.id),
    );
    const ownedThemes = MERCHANT_CATALOG_ITEMS.filter(
      (it) => it.category === 'nft_house_theme' && ownedItemIds.includes(it.id),
    );
    const moodEval = evaluateRoomMoodScores({
      themeId: activeHouseThemeId,
      floorSwatchId,
      wallSwatchId,
      slatsSwatchId,
      hour: daylightHour,
    });
    const selected3dItem = placed3dItems.find((it) => it.instanceId === selected3dInstanceId);
    const selectedCatalogItem = selected3dItem
      ? MERCHANT_CATALOG_ITEMS.find((c) => c.id === selected3dItem.catalogId)
      : null;

    const handleChangeDaylightHour = (nextHour: number) => {
      const clamped = Math.max(5.5, Math.min(23.5, Number(nextHour.toFixed(2))));
      setDaylightHour(clamped);
      dispatchHouseStudioPatch({ daylightHour: clamped });
    };

    const handleApplyMoodPreset = (preset: 'cozy' | 'bright' | 'moody') => {
      soundEngine.playUiClick();
      if (preset === 'cozy') {
        setDaylightHour(18.5);
        setFloorSwatchId('floor_tatami_oak');
        setWallSwatchId('wall_limewash');
        setSlatsSwatchId('slats_walnut');
        dispatchHouseStudioPatch({
          daylightHour: 18.5,
          floorSwatchId: 'floor_tatami_oak',
          wallSwatchId: 'wall_limewash',
          slatsSwatchId: 'slats_walnut',
        });
      } else if (preset === 'bright') {
        setDaylightHour(12.8);
        setFloorSwatchId('floor_whiteoak');
        setWallSwatchId('wall_chalk');
        setSlatsSwatchId('slats_walnut');
        dispatchHouseStudioPatch({
          daylightHour: 12.8,
          floorSwatchId: 'floor_whiteoak',
          wallSwatchId: 'wall_chalk',
          slatsSwatchId: 'slats_walnut',
        });
      } else {
        setDaylightHour(22.2);
        setFloorSwatchId('floor_smoked_slate');
        setWallSwatchId('wall_ink_cyber');
        setSlatsSwatchId('slats_neon_cyan');
        dispatchHouseStudioPatch({
          daylightHour: 22.2,
          floorSwatchId: 'floor_smoked_slate',
          wallSwatchId: 'wall_ink_cyber',
          slatsSwatchId: 'slats_neon_cyan',
        });
      }
    };

    return (
      <aside
        role="dialog"
        aria-label="Private House Decorative Studio"
        data-house-interior-modal="true"
        className="fixed inset-0 z-40 pointer-events-none select-none"
      >
        {/* TOP BAR: Minimalist Architectural Studio Bar (Simple text, zero emojis) */}
        <header className="fixed top-0 inset-x-0 h-13 bg-[#0f172a]/95 text-white border-b-[2.5px] border-[#0d0f12] shadow-[0_3px_0_#0d0f12] px-3 sm:px-5 flex items-center justify-between pointer-events-auto z-50">
          <div className="flex items-center gap-2.5">
            <span className={`px-2 py-0.5 ${isSampleHouseView ? 'bg-[#38bdf8]' : 'bg-[#b8ff3c]'} text-[#0d0f12] text-[10px] font-black uppercase tracking-wider border border-[#0d0f12]`}>
              {isSampleHouseView ? 'SHOWCASE' : 'INTERIOR'}
            </span>
            <div className="flex flex-col">
              <span className="text-[11.5px] sm:text-[12.5px] font-black uppercase tracking-wide text-white leading-tight">
                {isSampleHouseView ? 'MODEL HOUSE // SHOWCASE ESTATE (VIEW ONLY)' : 'PRIVATE HOUSE // DECORATIVE MODE'}
              </span>
              <span className="text-[9px] font-bold text-slate-300 hidden md:inline">
                {isSampleHouseView
                  ? 'OPEN SHOWCASE HOUSE FOR ALL CITIZENS · ARCHITECTURE & FURNITURE PREVIEW (VIEW ONLY)'
                  : 'DRAG FURNITURE TO PLACE (10CM SNAP) · DRAG FLOOR TO ORBIT CAMERA · SCROLL TO ZOOM'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-black/40 border border-white/20 text-[10px] font-mono">
              <span className="text-slate-400">MOOD:</span>
              <span className="text-[#b8ff3c] font-black uppercase">{moodEval.dominantMood}</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">SOLAR TIME:</span>
              <span className="text-[#fde047] font-black">{formatDaylightHour(daylightHour)}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                dispatchHouseStudioPatch({ resetCamera: true });
              }}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border-2 border-black text-[10px] font-black uppercase cursor-pointer"
            >
              RESET CAMERA
            </button>

            <button
              type="button"
              data-house-exit-btn="true"
              onClick={() => {
                soundEngine.playUiClick();
                onClose();
              }}
              className="px-3 py-1 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black text-[10px] font-black uppercase tracking-wider cursor-pointer"
            >
              {isSampleHouseView ? 'EXIT SHOWCASE HOUSE [ESC]' : 'DONE EDITING [ESC]'}
            </button>
          </div>
        </header>

        {isSampleHouseView ? (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto bg-[#0d0f12] text-white border-[3px] border-[#38bdf8] shadow-[4px_4px_0_#000] px-5 py-3 z-50 text-center max-w-lg space-y-1">
            <div className="text-xs font-black uppercase tracking-wider text-[#38bdf8]">
              MODEL HOUSE // SHOWCASE ESTATE (VIEW ONLY)
            </div>
            <div className="text-[10px] font-bold text-slate-300">
              This showcase residence is open for all citizens to tour. Editing is disabled here. To own and decorate your own Private House, purchase a House Deed at the Plot Kiosk or Hana&apos;s Catalog.
            </div>
          </div>
        ) : (
        /* BOTTOM DOCK: Consolidated Tabbed Studio Console (Zero emojis, simple text) */
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[96vw] max-w-4xl pointer-events-auto bg-white border-[3px] border-[#0d0f12] shadow-[5px_5px_0_#0d0f12] p-3 text-[#0d0f12] z-50">
          {/* Dock Header & Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b-2 border-[#0d0f12]">
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'furniture', label: `FURNITURE (${ownedFurniture.length})` },
                  { id: 'materials', label: 'THEMES & FINISHES' },
                  { id: 'lighting', label: 'LIGHTING & MOOD' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  data-studio-tab={tab.id}
                  onClick={() => {
                    soundEngine.playUiClick();
                    setStudioDockTab(tab.id);
                  }}
                  className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider border-2 border-[#0d0f12] cursor-pointer transition-colors ${
                    studioDockTab === tab.id
                      ? 'bg-[#b8ff3c] shadow-[2px_2px_0_#0d0f12]'
                      : 'bg-[#f4f6f8] hover:bg-[#e2e8f0] text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Selected 3D Item Controls */}
            {selectedCatalogItem && (
              <div className="flex items-center gap-1.5 bg-[#0f172a] text-white px-2.5 py-1 border-2 border-[#0d0f12]">
                <span className="text-[9.5px] font-black uppercase text-[#38bdf8] truncate max-w-[150px]">
                  SELECTED: {selectedCatalogItem.name}
                </span>
                <button
                  type="button"
                  data-rotate-3d-furniture="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    dispatchHouseStudioPatch({ rotateSelectedDelta: 1 });
                  }}
                  className="px-2 py-0.5 bg-[#b8ff3c] text-[#0d0f12] text-[9px] font-black uppercase cursor-pointer"
                >
                  ROTATE +45 DEG
                </button>
                <button
                  type="button"
                  data-remove-3d-furniture="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    dispatchHouseStudioPatch({ removeSelected: true });
                  }}
                  className="px-2 py-0.5 bg-[#ff3b30] text-white text-[9px] font-black uppercase cursor-pointer"
                >
                  STORE
                </button>
              </div>
            )}
          </div>

          {/* TAB 1: FURNITURE CATALOG */}
          {studioDockTab === 'furniture' && (
            <div className="pt-2.5">
              {ownedFurniture.length === 0 ? (
                <div className="py-4 text-center text-xs font-bold text-slate-600">
                  NO FURNITURE IN BAG YET. VISIT MERCHANT HANA&apos;S CATALOG TO ACQUIRE HOUSE FURNITURE.
                </div>
              ) : (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {ownedFurniture.map((item) => (
                    <div
                      key={item.id}
                      className="min-w-[170px] p-2 bg-[#f4f6f8] border-2 border-[#0d0f12] flex flex-col justify-between gap-1.5 shrink-0"
                    >
                      <div>
                        <span
                          className={`px-1.5 py-0.5 text-[8px] font-black uppercase border border-[#0d0f12] ${
                            item.isNft ? 'bg-[#38bdf8] text-black' : 'bg-[#a7f3d0] text-black'
                          }`}
                        >
                          {item.isNft ? 'NFT ITEM' : 'CYON ITEM'}
                        </span>
                        <div className="text-[10px] font-black uppercase truncate mt-1">
                          {item.name}
                        </div>
                      </div>
                      <button
                        type="button"
                        data-spawn-3d-furniture={item.id}
                        onClick={() => {
                          soundEngine.playUiClick();
                          dispatchHouseStudioPatch({ spawnCatalogId: item.id });
                        }}
                        className="w-full py-1 bg-[#b8ff3c] hover:bg-[#d2ff7a] border-[1.5px] border-[#0d0f12] text-[9.5px] font-black uppercase cursor-pointer"
                      >
                        + PLACE ON FLOOR
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: THEMES & FINISHES */}
          {studioDockTab === 'materials' && (
            <div className="pt-2.5 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[160px] overflow-y-auto">
              {/* Architecture Themes */}
              <div className="space-y-1">
                <div className="text-[9.5px] font-black uppercase tracking-wider text-slate-600">
                  HOUSE THEME
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {ownedThemes.map((th) => {
                    const isActive = activeHouseThemeId === th.id;
                    return (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          onSelectHouseTheme(th);
                        }}
                        className={`p-1.5 border-2 border-[#0d0f12] flex items-center justify-between text-left cursor-pointer ${
                          isActive
                            ? 'bg-[#b8ff3c] shadow-[2px_2px_0_#0d0f12]'
                            : 'bg-[#f4f6f8] hover:bg-white'
                        }`}
                      >
                        <span className="text-[10px] font-black uppercase truncate">{th.name}</span>
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-[#0d0f12] text-white">
                          {isActive ? 'ACTIVE' : 'APPLY'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Surface Finish Swatches */}
              <div className="space-y-1">
                <div className="text-[9.5px] font-black uppercase tracking-wider text-slate-600">
                  FLOOR &amp; WALL FINISH
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {HOUSE_SURFACE_SWATCHES.filter((s) => s.slot === 'floor' || s.slot === 'wall').map(
                    (sw) => {
                      const isCurrent =
                        (sw.slot === 'floor' && floorSwatchId === sw.id) ||
                        (sw.slot === 'wall' && wallSwatchId === sw.id);
                      return (
                        <button
                          key={sw.id}
                          type="button"
                          data-surface-swatch={sw.id}
                          onClick={() => {
                            soundEngine.playUiClick();
                            if (sw.slot === 'floor') {
                              setFloorSwatchId(sw.id);
                              dispatchHouseStudioPatch({ floorSwatchId: sw.id });
                            } else {
                              setWallSwatchId(sw.id);
                              dispatchHouseStudioPatch({ wallSwatchId: sw.id });
                            }
                          }}
                          className={`p-1 border-[1.5px] border-[#0d0f12] flex items-center gap-1.5 text-left cursor-pointer ${
                            isCurrent ? 'bg-[#2bb3b1] text-black font-black' : 'bg-[#f4f6f8] hover:bg-white'
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 border border-[#0d0f12] shrink-0"
                            style={{ backgroundColor: sw.colorHex }}
                          />
                          <span className="text-[9px] font-black uppercase truncate">{sw.name}</span>
                        </button>
                      );
                    },
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LIGHTING & MOOD */}
          {studioDockTab === 'lighting' && (
            <div className="pt-2.5 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[160px] overflow-y-auto">
              {/* Daylight Time Slider & Solar Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] font-black uppercase text-slate-600">
                    DAYLIGHT SOLAR ARC:
                  </span>
                  <span className="px-2 py-0.5 bg-[#0f172a] text-[#fde047] font-mono text-[10px] font-black">
                    {formatDaylightHour(daylightHour)}
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Daylight Time Slider"
                  data-house-daylight-slider="true"
                  min={5.5}
                  max={23.5}
                  step={0.1}
                  value={daylightHour}
                  onChange={(e) => handleChangeDaylightHour(parseFloat(e.target.value))}
                  className="w-full accent-[#0f7a78] cursor-pointer"
                />
                <div className="grid grid-cols-2 gap-1">
                  {(
                    [
                      { label: 'MORNING 07:36', h: 7.6 },
                      { label: 'NOON 12:48', h: 12.8 },
                      { label: 'EVENING 18:30', h: 18.5 },
                      { label: 'NIGHT 22:12', h: 22.2 },
                    ] as const
                  ).map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        handleChangeDaylightHour(preset.h);
                      }}
                      className={`py-1 px-1.5 border border-[#0d0f12] text-[9px] font-black uppercase cursor-pointer ${
                        Math.abs(daylightHour - preset.h) < 0.4
                          ? 'bg-[#fde047] text-black font-black'
                          : 'bg-[#f4f6f8] hover:bg-[#e2e8f0]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mood Meter & Softmax bars */}
              <div className="p-2.5 bg-[#0f172a] text-white border border-[#0d0f12] space-y-1.5">
                <div className="flex items-center justify-between pb-1 border-b border-white/15">
                  <span className="text-[9.5px] font-black uppercase text-[#38bdf8]">
                    ROOM MOOD
                  </span>
                  <div className="flex items-center gap-1">
                    {(['cozy', 'bright', 'moody'] as const).map((mId) => (
                      <button
                        key={mId}
                        type="button"
                        onClick={() => handleApplyMoodPreset(mId)}
                        className={`px-1.5 py-0.5 border border-white text-[8px] font-black uppercase cursor-pointer ${
                          moodEval.dominantMood === mId ? 'bg-[#b8ff3c] text-black' : 'bg-black text-white'
                        }`}
                      >
                        {mId}
                      </button>
                    ))}
                  </div>
                </div>
                {(
                  [
                    { key: 'cozy', label: 'Cozy', pct: moodEval.cozyPct, barCol: '#f5b82e' },
                    { key: 'bright', label: 'Bright', pct: moodEval.brightPct, barCol: '#38bdf8' },
                    { key: 'moody', label: 'Moody', pct: moodEval.moodyPct, barCol: '#a855f7' },
                  ] as const
                ).map((row) => (
                  <div key={row.key} className="space-y-0.5">
                    <div className="flex justify-between text-[9px] font-black uppercase">
                      <span>{row.label}</span>
                      <span>{row.pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#1e293b] border border-white/20 overflow-hidden">
                      <div
                        className="h-full transition-all duration-300"
                        style={{ width: `${row.pct}%`, backgroundColor: row.barCol }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        )}
      </aside>
    );
  }

  const isNpcOpen = activeModalMode === 'npc_merchant';

  return (
    <>
      <aside
        role="dialog"
        aria-modal="false"
        aria-hidden={!isNpcOpen}
        aria-label="MMORPG AI Merchant Dialogue & Exchange"
        data-npc-merchant-modal="true"
        data-lobby-gold-exchange-modal="true"
        className={`fixed left-4 top-16 bottom-20 z-40 w-full max-w-lg flex flex-col select-none transition-all duration-300 ease-out transform ${
          isNpcOpen
            ? 'translate-x-0 opacity-100 pointer-events-auto'
            : '-translate-x-[120%] opacity-0 pointer-events-none'
        }`}
      >
      <div className="relative flex-1 flex flex-col bg-white border-[3.5px] border-black shadow-[4px_4px_0px_#000] p-4 sm:p-5 text-black overflow-hidden min-h-0">
        {/* Top Bar: 3 Navigation Tab Buttons (CHAT SESSION, EXCHANGE, CATALOG) + Close */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b-[2.5px] border-black shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              data-gold-exchange-balance="true"
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
              onClick={() => {
                soundEngine.playUiClick();
                setActiveTab('transaksi');
              }}
              className={`-skew-x-6 px-3 py-1 border-2 border-black shadow-[3px_3px_0px_#000] text-[11px] font-black uppercase cursor-pointer transition-all ${
                activeTab === 'transaksi'
                  ? 'bg-[#10b981] text-black -translate-y-0.5'
                  : 'bg-slate-50 hover:bg-[#a7f3d0] text-black'
              }`}
            >
              <span className="skew-x-6 inline-block">EXCHANGE</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                setActiveTab('katalog');
              }}
              className={`-skew-x-6 px-3 py-1 border-2 border-black shadow-[3px_3px_0px_#000] text-[11px] font-black uppercase cursor-pointer transition-all ${
                activeTab === 'katalog'
                  ? 'bg-[#38bdf8] text-black -translate-y-0.5'
                  : 'bg-slate-50 hover:bg-[#bae6fd] text-black'
              }`}
            >
              <span className="skew-x-6 inline-block">CATALOG</span>
            </button>

            {merchantLocation === 'beach_house' && (
              <button
                type="button"
                data-fish-market-tab="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  setActiveTab('fish_market');
                }}
                className={`-skew-x-6 px-3 py-1 border-2 border-black shadow-[3px_3px_0px_#000] text-[11px] font-black uppercase cursor-pointer transition-all ${
                  activeTab === 'fish_market'
                    ? 'bg-[#b8ff3c] text-black -translate-y-0.5'
                    : 'bg-slate-50 hover:bg-[#d9f99d] text-black'
                }`}
              >
                <span className="skew-x-6 inline-block">
                  FISH MARKET ({caughtFishBucket.length})
                </span>
              </button>
            )}
          </div>

          <button
            type="button"
            data-gold-exchange-close="true"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            className="-skew-x-6 w-8 h-8 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black shadow-[3px_3px_0px_#000] font-black text-xs flex items-center justify-center cursor-pointer active:scale-95"
            aria-label="Close NPC Dialogue"
          >
            <span className="skew-x-6 inline-block">X</span>
          </button>
        </div>

        {/* Tab Content Viewport */}
        <div className="mt-3 flex-1 flex flex-col overflow-y-auto pr-1 space-y-3 min-h-0">
          {/* ===============================================================
              TAB 1: LIVE CHAT SESSION (Interactive Game Concierge)
             =============================================================== */}
          {activeTab === 'sesi_chat' && (
            <div className="flex-1 flex flex-col justify-between gap-3 min-h-0">
              {/* Scrollable Conversation Thread */}
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
                        <span className="px-2 py-0.5 bg-[#2bb3b1] text-black border border-black text-[9.5px] font-black uppercase">
                          {npcShortName}
                        </span>
                      </div>
                      <p className="text-xs font-bold leading-relaxed">{entry.text}</p>
                    </div>
                  ),
                )}

                {/* Active NPC Reply Bubble */}
                <div
                  data-npc-chat-bubble="true"
                  className="p-3.5 bg-[#0f172a] text-white border-[2.5px] border-black shadow-[4px_4px_0px_#000]"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="px-2.5 py-0.5 bg-[#2bb3b1] text-black border border-black text-[10px] font-black uppercase">
                      {npcShortName}
                    </span>
                    <span className="text-[9.5px] font-bold text-slate-400">
                      {merchantLocation === 'lobby_cafe'
                        ? 'Central Plaza Cafe'
                        : 'Beachfront Harbor'}
                    </span>
                  </div>
                  <p className="text-xs sm:text-[13px] font-bold leading-relaxed text-[#f8fafc] min-h-[54px]">
                    {isNpcThinking ? (
                      <span className="text-slate-400 animate-pulse">Typing...</span>
                    ) : (
                      <>
                        {npcTypedText}
                        {npcTypedText.length < npcFullText.length && (
                          <span className="inline-block w-1.5 h-3.5 bg-[#b8ff3c] ml-0.5 animate-pulse" />
                        )}
                      </>
                    )}
                  </p>
                </div>

                {/* Guest Sign-In Callout (Simple 1-line) */}
                {!walletConnected && onConnectWallet && (
                  <div className="p-3 bg-[#1e293b] text-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-2.5 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-200">
                      Sign in to unlock currency exchange and item purchases.
                    </span>
                    <button
                      type="button"
                      data-chat-guest-register-btn="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        onConnectWallet();
                      }}
                      className="px-3.5 py-1.5 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black text-[11px] uppercase cursor-pointer shrink-0"
                    >
                      SIGN IN
                    </button>
                  </div>
                )}

                {/* Hana Welcome Bonus Card (Clean, Simple, Zero Jargon) */}
                {merchantLocation === 'lobby_cafe' &&
                  walletConnected &&
                  (isTutorialHanaActive || !hanaWelcomeNearClaimed || hanaClaimResult?.ok) && (
                    <div
                      data-hana-onboarding-tutorial-box="true"
                      className="p-3 bg-[#141c2e] text-white border-[2.5px] border-black shadow-[3px_3px_0px_#000] space-y-2"
                    >
                      {!hanaWelcomeNearClaimed && !hanaClaimResult?.ok ? (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10.5px] font-black uppercase text-[#b8ff3c]">
                              WELCOME BONUS
                            </span>
                            <span className="text-[10.5px] font-black text-white">0.30 NEAR</span>
                          </div>
                          <p className="text-[11px] font-bold text-slate-300">
                            Claim your one-time starter NEAR to begin exploring and trading.
                          </p>
                          {hanaClaimResult?.error && (
                            <div className="p-2 bg-[#fef2f2] text-[#991b1b] border border-[#ff3b30] text-[10px] font-bold">
                              {hanaClaimResult.error}
                            </div>
                          )}
                          <button
                            type="button"
                            data-hana-claim-near-btn="true"
                            disabled={isClaimingHanaNear || !onClaimHanaWelcomeNear}
                            onClick={async () => {
                              if (!onClaimHanaWelcomeNear || isClaimingHanaNear) return;
                              soundEngine.playUiClick();
                              setIsClaimingHanaNear(true);
                              setHanaClaimResult(null);
                              try {
                                const res = await onClaimHanaWelcomeNear();
                                setHanaClaimResult(res);
                                if (res.ok) {
                                  soundEngine.playPickup();
                                  triggerNpcSpeech(
                                    `${res.amountNear.toFixed(2)} NEAR has been added to your wallet. Follow the blue path outside to the Transit Kiosk whenever you are ready to explore.`,
                                  );
                                } else {
                                  soundEngine.playHit();
                                }
                              } finally {
                                setIsClaimingHanaNear(false);
                              }
                            }}
                            className={`w-full py-2.5 border-2 border-black shadow-[3px_3px_0px_#000] font-black text-xs uppercase tracking-wider transition-all ${
                              isClaimingHanaNear
                                ? 'bg-slate-600 text-slate-200 cursor-wait'
                                : 'bg-[#b8ff3c] hover:bg-[#d9f99d] text-black cursor-pointer active:translate-y-0.5'
                            }`}
                          >
                            {isClaimingHanaNear ? 'CLAIMING...' : 'CLAIM 0.30 NEAR'}
                          </button>
                        </>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-emerald-300">
                            <span>0.30 NEAR added to your wallet.</span>
                            {hanaClaimResult?.txHash && (
                              <a
                                href={
                                  hanaClaimResult.explorerUrl ||
                                  getNearBlocksTxUrl(hanaClaimResult.txHash, 'testnet')
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#38bdf8] underline font-mono text-[10px]"
                              >
                                Receipt
                              </a>
                            )}
                          </div>
                          {onFinishHanaTutorialAndGuideKiosk && (
                            <button
                              type="button"
                              data-hana-go-to-kiosk-btn="true"
                              onClick={() => {
                                soundEngine.playUiClick();
                                onFinishHanaTutorialAndGuideKiosk();
                              }}
                              className="w-full py-2 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black border-2 border-black shadow-[3px_3px_0px_#000] font-black text-xs uppercase tracking-wider cursor-pointer"
                            >
                              CONTINUE
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                <div ref={chatScrollEndRef} />
              </div>

              {/* Quick Question Chips + Direct Inline Chat Input */}
              <div className="pt-2 border-t-2 border-black space-y-2 shrink-0 bg-white">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(
                    [
                      'Where can I fish?',
                      'Most expensive Fish NFT sold?',
                      'How do currencies work?',
                    ] as const
                  ).map((prompt) => (
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
                </div>

                <form
                  data-npc-inline-chat-form="true"
                  onSubmit={handleSubmitInlineChat}
                  className="flex items-stretch gap-1.5"
                >
                  <input
                    type="text"
                    data-npc-inline-chat-input="true"
                    value={chatInputDraft}
                    onChange={(e) => setChatInputDraft(e.target.value)}
                    placeholder={`Ask ${npcShortName === 'HANA' ? 'Hana' : 'Kai'} anything about the game...`}
                    className="flex-1 min-w-0 px-3 py-2 bg-slate-50 text-black font-bold text-xs border-2 border-black focus:outline-none focus:bg-white"
                  />
                  <button
                    type="submit"
                    data-npc-inline-chat-send="true"
                    disabled={!chatInputDraft.trim()}
                    className="px-4 py-2 bg-[#facc15] hover:bg-[#fde047] disabled:bg-slate-200 disabled:text-slate-500 text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black text-xs uppercase cursor-pointer shrink-0"
                  >
                    SEND
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ===============================================================
              TAB 2: EXCHANGE
              1) Top Card: Non-Crypto Exchange (LUL -> CYON)
              2) Bottom Card: NEAR Protocol Crypto Smart Contract Swap (NEAR Testnet <-> RESPITE NEP-141)
             =============================================================== */}
          {activeTab === 'transaksi' && (() => {
            const rateLul = exchangeQuote.lulCostFor10Cyon;
            const rateCyon = exchangeQuote.cyonGranted;
            const parsedLul = Math.max(0, Math.floor(Number(exchangeLulAmountStr) || 0));
            const calculatedCyon = Math.floor((parsedLul / rateLul) * rateCyon);
            const canPerformExchange =
              walletConnected &&
              exchangeQuote.canExchange &&
              parsedLul >= rateLul &&
              parsedLul <= lulBalance &&
              calculatedCyon > 0;

            const respitePerNearRate = RESPITE_NEP141_METADATA.rateRespitePerNear; // 1 NEAR = 100 RESPITE
            const parsedCryptoInput = Math.max(0, Number(cryptoSwapInputStr) || 0);
            const isNearToRespite = true;
            const calculatedCryptoOutput = Math.floor(parsedCryptoInput * respitePerNearRate);
            const isReadOnlyWallet = walletConnected && isActiveWalletReadOnlyObserver();
            const exceedsKnownSignerBalance =
              walletConnected &&
              !isReadOnlyWallet &&
              nearTestnetBalance > 0 &&
              parsedCryptoInput > nearTestnetBalance;

            const canPerformCryptoSwap =
              walletConnected &&
              !isSwappingNear &&
              parsedCryptoInput >= 0.01 &&
              calculatedCryptoOutput >= 1 &&
              !exceedsKnownSignerBalance;

            return (
              <div className="space-y-3.5">
                {/* Wallet or Sign-In Header */}
                <div className="p-3 bg-[#0f172a] text-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10.5px] font-black uppercase text-[#38bdf8]">
                      {walletConnected ? 'YOUR WALLET' : 'SIGN IN REQUIRED'}
                    </div>
                    <div className="text-[10px] font-bold text-white/85 mt-0.5 truncate">
                      {walletConnected
                        ? `${playerNearAccount} · ${nearTestnetBalance.toFixed(2)} NEAR · ${respiteBalance.toLocaleString()} RESPITE`
                        : 'Sign in to exchange currencies.'}
                    </div>
                  </div>
                  {onConnectWallet && (
                    <button
                      type="button"
                      data-merchant-open-wallet-selector-btn="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        onConnectWallet();
                      }}
                      className={`-skew-x-6 px-3 py-1.5 font-black text-[10px] uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer shrink-0 ${
                        walletConnected
                          ? 'bg-[#38bdf8] hover:bg-[#7dd3fc] text-black'
                          : 'bg-[#b8ff3c] hover:bg-[#d9f99d] text-black'
                      }`}
                    >
                      <span className="skew-x-6 inline-block">
                        {walletConnected ? 'WALLET' : 'SIGN IN'}
                      </span>
                    </button>
                  )}
                </div>

                {marketState.isShopBroke && (
                  <div className="p-2.5 bg-[#1e293b] text-white border-2 border-black flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[10.5px] font-bold text-slate-200">
                      Shop CYON reserve is low. Support the shop for +45 CYON and a 15% discount.
                    </span>
                    <button
                      type="button"
                      data-merchant-invest-btn="true"
                      disabled={!walletConnected || lulBalance < 300}
                      onClick={() => {
                        onInvestInMerchant();
                        triggerNpcSpeech(
                          'Thank you! Shop reserves are refilled, +45 CYON added, and your 15% catalog discount is active.',
                        );
                      }}
                      className={`px-2.5 py-1 border border-black text-[9.5px] font-black uppercase ${
                        walletConnected && lulBalance >= 300
                          ? 'bg-[#b8ff3c] hover:bg-[#d9f99d] text-black cursor-pointer'
                          : 'bg-slate-600 text-slate-300 cursor-not-allowed'
                      }`}
                    >
                      SUPPORT (300 LUL)
                    </button>
                  </div>
                )}

                {/* ===========================================================
                    CARD 1: LUL -> CYON EXCHANGE
                   =========================================================== */}
                <div
                  data-lul-cyon-exchange-card="true"
                  className={`bg-[#0f172a] text-white border-[3px] border-black shadow-[4px_4px_0px_#000] overflow-hidden ${
                    !walletConnected ? 'opacity-65 pointer-events-none select-none' : ''
                  }`}
                >
                  <div className="px-4 py-2 bg-[#1e293b] border-b-2 border-black flex items-center justify-between gap-2">
                    <span className="-skew-x-6 px-2 py-0.5 bg-[#fec83e] text-black border border-black text-[9.5px] font-black uppercase">
                      <span className="skew-x-6 inline-block">LUL TO CYON</span>
                    </span>
                    <span className="text-[10px] font-bold text-slate-300">
                      {rateLul} LUL = {rateCyon} CYON
                    </span>
                  </div>

                  <div className="p-4 space-y-3">
                    {/* LUL Amount Input Row */}
                    <div className="flex items-center gap-3 max-w-xs mx-auto">
                      <div className="-skew-x-6 w-16 py-2 bg-[#fec83e] text-black border-2 border-black shadow-[2px_2px_0_#000] text-center text-[11px] font-black uppercase shrink-0">
                        <span className="skew-x-6 inline-block">LUL</span>
                      </div>
                      <input
                        type="number"
                        min={rateLul}
                        step={rateLul}
                        max={lulBalance}
                        data-exchange-lul-input="true"
                        value={exchangeLulAmountStr}
                        onChange={(e) => setExchangeLulAmountStr(e.target.value)}
                        className="flex-1 px-3 py-2 bg-[#1e293b] text-white font-black text-base border-2 border-white/80 shadow-[2px_2px_0_#000] focus:outline-none focus:border-[#fec83e]"
                      />
                    </div>

                    <div className="text-center text-[11px] font-black uppercase tracking-wider text-slate-300">
                      You receive
                    </div>

                    {/* CYON Output Row */}
                    <div className="flex items-center gap-3 max-w-xs mx-auto">
                      <div className="-skew-x-6 w-16 py-2 bg-[#38bdf8] text-black border-2 border-black shadow-[2px_2px_0_#000] text-center text-[11px] font-black uppercase shrink-0">
                        <span className="skew-x-6 inline-block">CYON</span>
                      </div>
                      <div
                        data-exchange-cyon-output="true"
                        className="flex-1 px-3 py-2 bg-[#1e293b] text-[#38bdf8] font-black text-base border-2 border-white/80 shadow-[2px_2px_0_#000]"
                      >
                        {calculatedCyon}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Divider & Exchange Button */}
                  <div className="border-t-2 border-white/25 bg-[#141c2e] px-5 py-3 flex justify-center">
                    <button
                      type="button"
                      data-exchange-submit-btn="true"
                      disabled={!canPerformExchange}
                      onClick={() => {
                        if (!canPerformExchange) return;
                        soundEngine.playUiClick();
                        onExchangeLulToCyon(parsedLul, calculatedCyon);
                        triggerNpcSpeech(
                          `Exchanged ${parsedLul} LUL for +${calculatedCyon} CYON.`,
                        );
                      }}
                      className={`-skew-x-6 min-w-[180px] py-2 px-6 border-2 border-black text-xs font-black uppercase tracking-wider shadow-[3px_3px_0px_#000] transition-all ${
                        canPerformExchange
                          ? 'bg-[#10b981] hover:bg-[#34d399] text-black cursor-pointer active:translate-x-[1px] active:translate-y-[1px]'
                          : 'bg-slate-600 text-slate-300 cursor-not-allowed'
                      }`}
                    >
                      <span className="skew-x-6 inline-block">EXCHANGE</span>
                    </button>
                  </div>
                </div>

                {/* ===========================================================
                    CARD 2: NEAR -> RESPITE SWAP
                   =========================================================== */}
                <div
                  data-near-respite-swap-card="true"
                  className={`bg-[#0f172a] text-white border-[3px] border-black shadow-[4px_4px_0px_#000] overflow-hidden ${
                    !walletConnected ? 'opacity-65 pointer-events-none select-none' : ''
                  }`}
                >
                  <div className="px-4 py-2 bg-[#1e1b4b] border-b-2 border-black flex items-center justify-between gap-2">
                    <span className="-skew-x-6 px-2 py-0.5 bg-[#d8b4fe] text-black border border-black text-[9.5px] font-black uppercase">
                      <span className="skew-x-6 inline-block">NEAR TO RESPITE</span>
                    </span>
                    <span className="text-[10px] font-bold text-slate-300">
                      1 NEAR = {respitePerNearRate} RESPITE
                    </span>
                  </div>

                  <div className="p-4 space-y-3">
                    {/* Quick Amount Presets */}
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      {[
                        { near: '0.25', label: '0.25 NEAR' },
                        { near: '0.5', label: '0.5 NEAR' },
                        { near: '1', label: '1 NEAR' },
                      ].map((preset) => (
                        <button
                          key={preset.near}
                          type="button"
                          onClick={() => {
                            soundEngine.playUiClick();
                            setCryptoSwapInputStr(preset.near);
                            setSwapErrorText(null);
                          }}
                          className="px-2.5 py-0.5 bg-[#1e293b] hover:bg-[#334155] border border-white/40 text-[9.5px] font-black uppercase text-[#d8b4fe] cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    {/* Input Row */}
                    <div className="flex items-center gap-3 max-w-xs mx-auto">
                      <div
                        className={`-skew-x-6 w-24 py-2 ${
                          isNearToRespite ? 'bg-[#38bdf8]' : 'bg-[#d8b4fe]'
                        } text-black border-2 border-black shadow-[2px_2px_0_#000] text-center text-[10px] font-black uppercase shrink-0`}
                      >
                        <span className="skew-x-6 inline-block">
                          {isNearToRespite ? 'NEAR' : 'RESPITE'}
                        </span>
                      </div>
                      <input
                        type="number"
                        min={0.01}
                        step={0.05}
                        data-near-respite-swap-input="true"
                        value={cryptoSwapInputStr}
                        onChange={(e) => {
                          setCryptoSwapInputStr(e.target.value);
                          setSwapErrorText(null);
                        }}
                        className="flex-1 px-3 py-2 bg-[#1e293b] text-white font-black text-base border-2 border-white/80 shadow-[2px_2px_0_#000] focus:outline-none focus:border-[#d8b4fe]"
                      />
                    </div>

                    {/* Middle Label: You will receive */}
                    <div className="text-center text-xs font-black uppercase tracking-wider text-slate-200">
                      You will receive
                    </div>

                    {/* Output Row */}
                    <div className="flex items-center gap-3 max-w-xs mx-auto">
                      <div
                        className={`-skew-x-6 w-24 py-2 ${
                          isNearToRespite ? 'bg-[#d8b4fe]' : 'bg-[#38bdf8]'
                        } text-black border-2 border-black shadow-[2px_2px_0_#000] text-center text-[10px] font-black uppercase shrink-0`}
                      >
                        <span className="skew-x-6 inline-block">
                          {isNearToRespite ? 'RESPITE' : 'NEAR'}
                        </span>
                      </div>
                      <div
                        data-near-respite-swap-output="true"
                        className="flex-1 px-3 py-2 bg-[#1e293b] text-[#d8b4fe] font-black text-base border-2 border-white/80 shadow-[2px_2px_0_#000]"
                      >
                        {calculatedCryptoOutput}
                      </div>
                    </div>

                    {isReadOnlyWallet && (
                      <div className="p-2 bg-[#fef3c7] text-[#78350f] border border-black text-[10px] font-black text-center">
                        View-only observer active ({playerNearAccount}). Clicking SWAP below will
                        open the NEAR Wallet Selector so you can connect your signing wallet!
                      </div>
                    )}

                    {exceedsKnownSignerBalance && (
                      <div className="p-2 bg-[#fef2f2] text-[#991b1b] border border-[#ff3b30] text-[10px] font-bold text-center">
                        Amount exceeds wallet balance ({nearTestnetBalance.toFixed(2)} NEAR). Lower
                        amount or switch to a funded Testnet wallet.
                      </div>
                    )}

                    {swapErrorText && (
                      <div className="p-2 bg-[#fef2f2] text-[#991b1b] border border-[#ff3b30] text-[10px] font-bold text-center">
                        {swapErrorText}
                      </div>
                    )}

                    {lastCryptoSwapReceipt && (
                      <div
                        data-near-respite-swap-receipt="true"
                        className="p-2 bg-black/50 border border-[#10b981] text-[10px] font-bold text-slate-200 text-center space-y-0.5"
                      >
                        <div>
                          Swapped {lastCryptoSwapReceipt.nearAmount} NEAR &rarr; +
                          {lastCryptoSwapReceipt.respiteAmount} RESPITE
                        </div>
                        {lastCryptoSwapReceipt.txHash && (
                          <a
                            href={getNearBlocksTxUrl(lastCryptoSwapReceipt.txHash, 'testnet')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block text-[#38bdf8] underline font-mono"
                          >
                            View Tx on NearBlocks ↗
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bottom Divider & Swap Submit Button */}
                  <div className="border-t-2 border-white/25 bg-[#141c2e] px-5 py-3.5 flex items-center justify-center gap-3 flex-wrap">
                    <button
                      type="button"
                      data-near-respite-swap-submit-btn="true"
                      disabled={!canPerformCryptoSwap}
                      onClick={async () => {
                        if (!canPerformCryptoSwap) return;
                        soundEngine.playUiClick();
                        setSwapErrorText(null);
                        setIsSwappingNear(true);
                        try {
                          const receipt = await onSwapNearAndRespite?.(
                            'near_to_respite',
                            parsedCryptoInput,
                          );
                          if (receipt) {
                            setLastCryptoSwapReceipt(receipt);
                            setSwapErrorText(null);
                            triggerNpcSpeech(
                              `Swap complete! Swapped ${parsedCryptoInput} NEAR for +${calculatedCryptoOutput} RESPITE.`,
                            );
                          } else {
                            const detail =
                              getLastNearTransactionError() ||
                              'Swap failed or was rejected by your NEAR wallet signer.';
                            setSwapErrorText(detail);
                            triggerNpcSpeech(detail);
                          }
                        } finally {
                          setIsSwappingNear(false);
                        }
                      }}
                      className={`-skew-x-6 min-w-[210px] py-2.5 px-6 border-2 border-black text-xs sm:text-sm font-black uppercase tracking-wider shadow-[3px_3px_0px_#000] transition-all ${
                        canPerformCryptoSwap
                          ? 'bg-[#d8b4fe] hover:bg-[#e9d5ff] text-black cursor-pointer active:translate-x-[1px] active:translate-y-[1px]'
                          : 'bg-slate-600 text-slate-300 cursor-not-allowed'
                      }`}
                    >
                      <span className="skew-x-6 inline-block">
                        {isSwappingNear ? 'SWAPPING...' : 'SWAP'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ===============================================================
              TAB 3: CATALOG (TACTICAL KIOSK-STYLE SELECTABLE & PAGINATED MENU)
              - Lobby Cafe (Hana): Slide 01/02 HOUSE & Slide 02/02 FAMILY MEMBER
              - East Beach House (Kai): Paginated 2x2 Fishing Rods, Reels & Tackle Kiosk
             =============================================================== */}
          {activeTab === 'katalog' && (() => {
            if (merchantLocation === 'beach_house') {
              const fishingCatalogItems = MERCHANT_CATALOG_ITEMS.filter(
                (item) => item.category === 'fishing_gear',
              );
              const pageSize = 4;
              const totalPages = Math.max(1, Math.ceil(fishingCatalogItems.length / pageSize));
              const safePage = Math.min(kaiCatalogPage, totalPages - 1);
              const pageItems = fishingCatalogItems.slice(
                safePage * pageSize,
                safePage * pageSize + pageSize,
              );
              const selectedFishingItem =
                fishingCatalogItems.find((i) => i.id === selectedKaiFishingId) ||
                pageItems[0] ||
                fishingCatalogItems[0];
              const selectedQuote = selectedFishingItem
                ? evaluateMerchantItemQuote(marketState, selectedFishingItem)
                : null;
              const isSelectedOwned = selectedFishingItem
                ? ownedItemIds.includes(selectedFishingItem.id)
                : false;
              const canAffordSelected =
                Boolean(
                  walletConnected &&
                    selectedFishingItem &&
                    selectedQuote &&
                    selectedQuote.stock > 0 &&
                    (selectedFishingItem.currency === 'CYON'
                      ? cyonBalance >= selectedQuote.buyPrice
                      : respiteBalance >= selectedQuote.buyPrice),
                );

              return (
                <div className="space-y-2.5" data-catalog-kai-fishing-panel="true">
                  {/* Compact Balance / Registration Bar */}
                  <div className="p-2.5 bg-[#0f172a] text-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-[10.5px] font-black uppercase text-[#38bdf8]">
                        {walletConnected
                          ? 'FISHING RODS, REELS & TACKLE'
                          : 'REGISTRATION REQUIRED'}
                      </div>
                      <div className="text-[9.5px] font-bold text-slate-300">
                        {walletConnected
                          ? 'Select an item card below — stored in Personal Bag (BAG).'
                          : 'Register your account to purchase fishing rods & tackle.'}
                      </div>
                    </div>
                    {walletConnected ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2 py-0.5 bg-[#38bdf8] text-black border border-black text-[9px] font-black uppercase">
                          {cyonBalance.toLocaleString()} CYON
                        </span>
                        <span className="px-2 py-0.5 bg-[#d8b4fe] text-black border border-black text-[9px] font-black uppercase">
                          {respiteBalance.toLocaleString()} RESPITE
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          onConnectWallet?.();
                        }}
                        className="-skew-x-6 px-3 py-1 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black font-black text-[10px] uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer shrink-0"
                      >
                        <span className="skew-x-6 inline-block">REGISTER</span>
                      </button>
                    )}
                  </div>

                  {/* Tactical Kiosk-Style 2x2 Selectable Card Grid */}
                  <div
                    className={`grid grid-cols-2 gap-2.5 ${
                      !walletConnected ? 'opacity-70 pointer-events-none select-none' : ''
                    }`}
                  >
                    {pageItems.map((item) => {
                      const quote = evaluateMerchantItemQuote(marketState, item);
                      const isOwned = ownedItemIds.includes(item.id);
                      const isSelected = selectedFishingItem?.id === item.id;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          data-katalog-fishing-card={item.id}
                          onClick={() => {
                            soundEngine.playUiClick();
                            setSelectedKaiFishingId(item.id);
                          }}
                          className={`group relative h-[136px] text-left select-none transition-transform duration-100 cursor-pointer ${
                            isSelected
                              ? 'bg-[#2bb3b1] p-[3.5px] border-[3px] border-[#0d0f12] shadow-[0_3.5px_0_#0d0f12] -translate-y-[1px]'
                              : 'bg-[#f4f6f8] p-[2.5px] border-[2.5px] border-[#0d0f12] shadow-[0_2.5px_0_#0d0f12] hover:bg-white'
                          }`}
                        >
                          <div className="relative h-full flex flex-col justify-between bg-white border-[1.5px] border-[#0d0f12] p-2.5 overflow-hidden">
                            {isSelected && (
                              <div
                                className="absolute top-0 right-0 w-7 h-7 bg-[#2bb3b1] border-l-[2px] border-b-[2px] border-[#0d0f12] flex items-start justify-end p-0.5 z-10"
                                style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}
                              >
                                <span className="text-[9px] font-black text-[#0d0f12] leading-none">
                                  ✓
                                </span>
                              </div>
                            )}

                            <div className="flex items-start justify-between gap-1.5 pr-4">
                              <div className="min-w-0">
                                <div className="text-[10.5px] font-black uppercase text-[#0d0f12] leading-tight truncate">
                                  {item.name}
                                </div>
                                <div className="text-[8.5px] font-extrabold uppercase text-slate-600 mt-0.5">
                                  {item.isNft ? 'NFT TACKLE' : 'FISHING GEAR'} · Stock {quote.stock}
                                </div>
                              </div>
                            </div>

                            <div className="my-1 flex items-center justify-center">
                              <div className="w-11 h-11 bg-[#0f172a] border-2 border-[#0d0f12] shadow-[2px_2px_0_#0d0f12] flex items-center justify-center">
                                <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-[#38bdf8] fill-none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="18" cy="5" r="3" />
                                  <line x1="16" y1="7" x2="5" y2="18" />
                                  <path d="M18 8a6 6 0 0 1-6 6H7" />
                                </svg>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-1">
                              <span
                                className={`px-1.5 py-0.5 border border-[#0d0f12] text-[8.5px] font-black uppercase ${
                                  item.currency === 'RESPITE'
                                    ? 'bg-[#d8b4fe] text-[#0d0f12]'
                                    : 'bg-[#38bdf8] text-[#0d0f12]'
                                }`}
                              >
                                {quote.buyPrice} {item.currency}
                              </span>
                              {isOwned && (
                                <span className="px-1.5 py-0.5 bg-[#b8ff3c] text-[#0d0f12] border border-[#0d0f12] text-[8px] font-black uppercase">
                                  IN BAG
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Item Details Strip + Dynamic Pricing Reasoning (`09-games` Track) */}
                  {selectedFishingItem && selectedQuote && (
                    <div className="p-2.5 bg-[#f4f6f8] border-[2.5px] border-[#0d0f12] shadow-[0_2.5px_0_#0d0f12] space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[10.5px] font-black uppercase text-[#0d0f12] truncate">
                            {selectedFishingItem.name}
                          </div>
                          <div className="text-[9.5px] font-bold text-[#1c2026]/85 line-clamp-1">
                            {selectedFishingItem.description}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 border-[2px] border-[#0d0f12] text-[9.5px] font-black uppercase shrink-0 ${
                            isSelectedOwned
                              ? 'bg-[#b8ff3c] text-[#0d0f12]'
                              : selectedFishingItem.currency === 'RESPITE'
                                ? 'bg-[#d8b4fe] text-[#0d0f12]'
                                : 'bg-[#38bdf8] text-[#0d0f12]'
                          }`}
                        >
                          {isSelectedOwned
                            ? 'OWNED IN BAG'
                            : `${selectedQuote.buyPrice} ${selectedFishingItem.currency}`}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Tactical Kiosk Footer: [<] [>] Pagination + Primary Action Button */}
                  <div className="pt-1 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          const nextPage = (safePage - 1 + totalPages) % totalPages;
                          setKaiCatalogPage(nextPage);
                          const firstOnPage = fishingCatalogItems[nextPage * pageSize];
                          if (firstOnPage) setSelectedKaiFishingId(firstOnPage.id);
                        }}
                        className="w-8 h-8 bg-[#f4f6f8] hover:bg-white text-[#0d0f12] border-[2.5px] border-[#0d0f12] shadow-[0_2.5px_0_#0d0f12] flex items-center justify-center font-black text-xs cursor-pointer active:translate-y-[1px]"
                        title="Previous Page"
                      >
                        &lt;
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          const nextPage = (safePage + 1) % totalPages;
                          setKaiCatalogPage(nextPage);
                          const firstOnPage = fishingCatalogItems[nextPage * pageSize];
                          if (firstOnPage) setSelectedKaiFishingId(firstOnPage.id);
                        }}
                        className="w-8 h-8 bg-[#f4f6f8] hover:bg-white text-[#0d0f12] border-[2.5px] border-[#0d0f12] shadow-[0_2.5px_0_#0d0f12] flex items-center justify-center font-black text-xs cursor-pointer active:translate-y-[1px]"
                        title="Next Page"
                      >
                        &gt;
                      </button>
                      <span className="ml-1 text-[11px] font-black tracking-wider text-[#0d0f12]">
                        {String(safePage + 1).padStart(2, '0')} /{' '}
                        {String(totalPages).padStart(2, '0')}
                      </span>
                    </div>

                    {selectedFishingItem && selectedQuote && (
                      <div className="flex items-center gap-2">
                        {isSelectedOwned ? (
                          <button
                            type="button"
                            data-sell-fishing-item-btn={selectedFishingItem.id}
                            onClick={() => {
                              soundEngine.playUiClick();
                              onSellMerchantItem(selectedFishingItem, selectedQuote.sellbackPrice);
                              triggerNpcSpeech(
                                `Sold back ${selectedFishingItem.name} for +${selectedQuote.sellbackPrice} ${selectedFishingItem.currency}.`,
                              );
                            }}
                            className="-skew-x-12 px-4 py-2 bg-[#facc15] hover:bg-[#fde047] text-[#0d0f12] border-[2.5px] border-[#0d0f12] shadow-[0_3px_0_#0d0f12] font-black text-[11px] uppercase tracking-wider cursor-pointer"
                          >
                            <span className="skew-x-12 inline-block">
                              SELL (+{selectedQuote.sellbackPrice} {selectedFishingItem.currency})
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            data-buy-fishing-item-btn={selectedFishingItem.id}
                            disabled={!canAffordSelected}
                            onClick={() => {
                              if (!canAffordSelected) return;
                              soundEngine.playPickup();
                              onBuyMerchantItem(selectedFishingItem, selectedQuote.buyPrice);
                              triggerNpcSpeech(
                                `Purchased ${selectedFishingItem.name} for ${selectedQuote.buyPrice} ${selectedFishingItem.currency}! Stored inside your Personal Bag (BAG).`,
                              );
                            }}
                            className={`-skew-x-12 px-5 py-2 border-[2.5px] border-[#0d0f12] shadow-[0_3px_0_#0d0f12] font-black text-[11px] uppercase tracking-wider transition-all ${
                              canAffordSelected
                                ? 'bg-[#2bb3b1] hover:bg-[#38bdf8] text-[#0d0f12] cursor-pointer'
                                : 'bg-slate-300 text-slate-600 cursor-not-allowed'
                            }`}
                          >
                            <span className="skew-x-12 inline-block">
                              {selectedQuote.stock <= 0
                                ? 'OUT OF STOCK'
                                : `BUY (${selectedQuote.buyPrice} ${selectedFishingItem.currency})`}
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            const selectedFamilyPlan =
              FAMILY_MEMBER_CONTRACT_PLANS.find((p) => p.id === selectedFamilyPlanId) ||
              FAMILY_MEMBER_CONTRACT_PLANS[0];
            const isHouseOwned = Boolean(walletConnected && hasHouseOwnership);
            const canAffordHouse =
              walletConnected && respiteBalance >= HOUSE_OWNERSHIP_PRICE_RESPITE;
            const canAffordFamilyMember =
              walletConnected && respiteBalance >= selectedFamilyPlan.priceRespite;
            const isHouseSlide = hanaCatalogSlide === 'house';

            return (
              <div className="space-y-2.5" data-catalog-house-and-family-panel="true">
                {/* Top RESPITE Balance & Kiosk Slide Switcher Bar */}
                <div className="p-2.5 bg-[#0f172a] text-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10.5px] font-black uppercase text-[#d8b4fe]">
                      {walletConnected
                        ? 'HOUSE & FAMILY MEMBER KIOSK'
                        : 'REGISTRATION REQUIRED FOR CATALOG'}
                    </div>
                    <div className="text-[9.5px] font-bold text-white/85">
                      {walletConnected
                        ? `Balance: ${respiteBalance.toLocaleString()} RESPITE`
                        : 'Register your account to unlock House & Family Member.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      onConnectWallet?.();
                    }}
                    className={`-skew-x-6 px-3 py-1 font-black text-[10px] uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer shrink-0 ${
                      walletConnected
                        ? 'bg-[#38bdf8] hover:bg-[#7dd3fc] text-black'
                        : 'bg-[#b8ff3c] hover:bg-[#d9f99d] text-black'
                    }`}
                  >
                    <span className="skew-x-6 inline-block">
                      {walletConnected ? 'WALLET' : 'REGISTER'}
                    </span>
                  </button>
                </div>

                {/* Tactical Kiosk-Style Selectable Cards: [01] HOUSE & [02] FAMILY MEMBER */}
                <div
                  className={`grid grid-cols-2 gap-2.5 ${
                    !walletConnected ? 'opacity-70 pointer-events-none select-none' : ''
                  }`}
                >
                  {/* Card 1: HOUSE (Slide 01 / 02) */}
                  <button
                    type="button"
                    data-katalog-card="buddies_house_ownership"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setHanaCatalogSlide('house');
                    }}
                    className={`group relative h-[154px] sm:h-[164px] text-left select-none transition-transform duration-100 cursor-pointer ${
                      isHouseSlide
                        ? 'bg-[#2bb3b1] p-[3.5px] border-[3px] border-[#0d0f12] shadow-[0_3.5px_0_#0d0f12] -translate-y-[1px]'
                        : 'bg-[#f4f6f8] p-[2.5px] border-[2.5px] border-[#0d0f12] shadow-[0_2.5px_0_#0d0f12] hover:bg-white'
                    }`}
                  >
                    <div className="relative h-full flex flex-col justify-between bg-white border-[2px] border-[#0d0f12] p-2.5 overflow-hidden">
                      {isHouseSlide && (
                        <div
                          className="absolute top-0 right-0 w-7 h-7 bg-[#2bb3b1] border-l-[2px] border-b-[2px] border-[#0d0f12] flex items-start justify-end p-0.5 z-10"
                          style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}
                        >
                          <span className="text-[9px] font-black text-[#0d0f12] leading-none">
                            ✓
                          </span>
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-1 pr-4">
                        <div>
                          <div
                            className="text-[11.5px] sm:text-[12.5px] font-black uppercase tracking-tight leading-[1.1] text-[#0d0f12]"
                            style={{ fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif" }}
                          >
                            HOUSE
                          </div>
                          <div className="text-[8.5px] sm:text-[9px] font-extrabold uppercase tracking-tight text-[#1c2026] mt-0.5">
                            PRIVATE HOME
                          </div>
                        </div>
                        <span
                          className={`px-1.5 py-0.5 border border-[#0d0f12] text-[8.5px] font-black uppercase shrink-0 ${
                            isHouseOwned
                              ? 'bg-[#b8ff3c] text-[#0d0f12]'
                              : 'bg-[#d8b4fe] text-[#0d0f12]'
                          }`}
                        >
                          {isHouseOwned ? 'OWNED' : `${HOUSE_OWNERSHIP_PRICE_RESPITE} RESPITE`}
                        </span>
                      </div>

                      <div className="my-0.5 flex items-center justify-center h-[80px] sm:h-[86px]">
                        <img
                          src="/assets/kiosk/private_house_isometric.jpg"
                          alt="Private House Ownership"
                          draggable={false}
                          className="w-full h-[76px] sm:h-[82px] object-contain rounded-sm select-none pointer-events-none"
                        />
                      </div>

                      <div className="text-[8.5px] font-bold text-[#1c2026] truncate">
                        Unlocks Private House &amp; Plot
                      </div>
                    </div>
                  </button>

                  {/* Card 2: FAMILY MEMBER (Slide 02 / 02) */}
                  <button
                    type="button"
                    data-katalog-card="buddies_family_member_agent"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setHanaCatalogSlide('family');
                    }}
                    className={`group relative h-[154px] sm:h-[164px] text-left select-none transition-transform duration-100 cursor-pointer ${
                      !isHouseSlide
                        ? 'bg-[#2bb3b1] p-[3.5px] border-[3px] border-[#0d0f12] shadow-[0_3.5px_0_#0d0f12] -translate-y-[1px]'
                        : 'bg-[#f4f6f8] p-[2.5px] border-[2.5px] border-[#0d0f12] shadow-[0_2.5px_0_#0d0f12] hover:bg-white'
                    }`}
                  >
                    <div className="relative h-full flex flex-col justify-between bg-white border-[2px] border-[#0d0f12] p-2.5 overflow-hidden">
                      {!isHouseSlide && (
                        <div
                          className="absolute top-0 right-0 w-7 h-7 bg-[#2bb3b1] border-l-[2px] border-b-[2px] border-[#0d0f12] flex items-start justify-end p-0.5 z-10"
                          style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}
                        >
                          <span className="text-[9px] font-black text-[#0d0f12] leading-none">
                            ✓
                          </span>
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-1 pr-4">
                        <div>
                          <div
                            className="text-[11.5px] sm:text-[12.5px] font-black uppercase tracking-tight leading-[1.1] text-[#0d0f12]"
                            style={{ fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif" }}
                          >
                            FAMILY MEMBER
                          </div>
                          <div className="text-[8.5px] sm:text-[9px] font-extrabold uppercase tracking-tight text-[#1c2026] mt-0.5">
                            COMPANION HELPER
                          </div>
                        </div>
                        <span className="px-1.5 py-0.5 bg-[#d8b4fe] text-[#0d0f12] border border-[#0d0f12] text-[8.5px] font-black uppercase shrink-0">
                          {selectedFamilyPlan.priceRespite} RESPITE
                        </span>
                      </div>

                      <div className="my-0.5 flex items-center justify-center gap-1.5 h-[80px] sm:h-[86px]">
                        <img
                          src="/assets/kiosk/family_member_female.jpg"
                          alt="Female Family Member Companion"
                          draggable={false}
                          className="h-[74px] sm:h-[80px] w-[47%] object-cover object-top rounded-sm border border-[#0d0f12] select-none pointer-events-none"
                        />
                        <img
                          src="/assets/kiosk/family_member_male.jpg"
                          alt="Male Family Member Companion"
                          draggable={false}
                          className="h-[74px] sm:h-[80px] w-[47%] object-cover object-top rounded-sm border border-[#0d0f12] select-none pointer-events-none"
                        />
                      </div>

                      <div className="text-[8.5px] font-bold text-[#1c2026] truncate">
                        Collect Boxes, Fish, or Attack
                      </div>
                    </div>
                  </button>
                </div>

                {/* ===========================================================
                     ACTIVE SLIDE CONFIGURATION PANEL (ONLY 1 SHOWN AT A TIME)
                    =========================================================== */}
                {isHouseSlide ? (
                  <div
                    data-buy-house-section="true"
                    className={`p-3 bg-[#f4f6f8] border-[2.5px] border-[#0d0f12] shadow-[0_2.5px_0_#0d0f12] ${
                      !walletConnected ? 'opacity-65 pointer-events-none select-none' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-black uppercase tracking-tight text-[#0d0f12]">
                          PRIVATE HOUSE
                        </div>
                        <div className="text-[9.5px] font-bold text-[#1c2026]/85">
                          Claim a residential city plot and decorate your private interior.
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 border-[2px] border-[#0d0f12] text-[9.5px] font-black uppercase shadow-[0_1.5px_0_#0d0f12] shrink-0 ${
                          isHouseOwned
                            ? 'bg-[#b8ff3c] text-[#0d0f12]'
                            : 'bg-[#d8b4fe] text-[#0d0f12]'
                        }`}
                      >
                        {isHouseOwned ? 'OWNED' : `${HOUSE_OWNERSHIP_PRICE_RESPITE} RESPITE`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    data-recruit-family-member-section="true"
                    className={`p-2.5 bg-[#0f172a] text-white border-[2.5px] border-[#0d0f12] shadow-[0_2.5px_0_#0d0f12] space-y-2 ${
                      !walletConnected ? 'opacity-65 pointer-events-none select-none' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] font-black uppercase tracking-wider text-[#facc15]">
                        SELECT DURATION
                      </div>
                      <span className="px-1.5 py-0.5 bg-[#d8b4fe] text-black border border-black text-[9px] font-black uppercase shrink-0">
                        ACTIVE: {recruitedFamilyMembers.length}
                      </span>
                    </div>

                    {/* Contract Duration Options: 1 Week, 1 Month, 1 Year */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {FAMILY_MEMBER_CONTRACT_PLANS.map((plan) => {
                        const isSelected = plan.id === selectedFamilyPlan.id;
                        return (
                          <button
                            key={plan.id}
                            type="button"
                            data-family-contract-plan={plan.id}
                            onClick={() => {
                              soundEngine.playUiClick();
                              setSelectedFamilyPlanId(plan.id);
                            }}
                            className={`py-1.5 px-2 text-center border-2 border-black transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#facc15] text-black shadow-[2px_2px_0_#000]'
                                : 'bg-[#1e293b] hover:bg-[#334155] text-white'
                            }`}
                          >
                            <div className="text-[9.5px] font-black uppercase">
                              {plan.shortLabel}
                            </div>
                            <div
                              className={`text-[10.5px] font-black ${
                                isSelected ? 'text-black' : 'text-[#d8b4fe]'
                              }`}
                            >
                              {plan.priceRespite} RESPITE
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Active Family Member Orders (Compact) */}
                    {recruitedFamilyMembers.length > 0 && (
                      <div className="pt-1.5 border-t border-white/15 space-y-1.5 max-h-28 overflow-y-auto pr-1">
                        {recruitedFamilyMembers.map((member) => (
                          <div
                            key={member.agentId}
                            data-family-member-item={member.agentId}
                            className="p-1.5 bg-[#1e293b] border border-black flex items-center justify-between gap-1.5 flex-wrap"
                          >
                            <span className="text-[9.5px] font-black uppercase text-white truncate">
                              {member.name}
                            </span>
                            <div className="flex items-center gap-1">
                              {FAMILY_MEMBER_ORDER_SPECS.map((orderSpec) => {
                                const isOrderActive = member.activeOrder === orderSpec.id;
                                return (
                                  <button
                                    key={orderSpec.id}
                                    type="button"
                                    data-family-order-btn={`${member.agentId}-${orderSpec.id}`}
                                    onClick={() => {
                                      soundEngine.playUiClick();
                                      onCommandFamilyMember?.(member.agentId, orderSpec.id);
                                      triggerNpcSpeech(
                                        `Order confirmed for ${member.name}: ${orderSpec.label}.`,
                                      );
                                    }}
                                    className={`px-1.5 py-0.5 border border-black text-[8px] font-black uppercase cursor-pointer ${
                                      isOrderActive
                                        ? 'bg-[#b8ff3c] text-black'
                                        : 'bg-[#0f172a] hover:bg-black text-white'
                                    }`}
                                  >
                                    {orderSpec.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ===========================================================
                     TACTICAL KIOSK FOOTER: [<] [>] 01 / 02 + SKEWED CTA BUTTON
                    =========================================================== */}
                <div
                  className={`pt-1 flex items-center justify-between gap-2 ${
                    !walletConnected ? 'opacity-65 pointer-events-none select-none' : ''
                  }`}
                >
                  {/* Bottom-Left Pagination Controls (like Tactical Kiosk) */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      data-catalog-prev-slide="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setHanaCatalogSlide((prev) => (prev === 'house' ? 'family' : 'house'));
                      }}
                      className="w-8 h-8 bg-[#f4f6f8] hover:bg-white text-[#0d0f12] border-[2.5px] border-[#0d0f12] shadow-[0_2.5px_0_#0d0f12] flex items-center justify-center font-black text-xs cursor-pointer active:translate-y-[1px]"
                      title="Previous Item"
                    >
                      &lt;
                    </button>
                    <button
                      type="button"
                      data-catalog-next-slide="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setHanaCatalogSlide((prev) => (prev === 'house' ? 'family' : 'house'));
                      }}
                      className="w-8 h-8 bg-[#f4f6f8] hover:bg-white text-[#0d0f12] border-[2.5px] border-[#0d0f12] shadow-[0_2.5px_0_#0d0f12] flex items-center justify-center font-black text-xs cursor-pointer active:translate-y-[1px]"
                      title="Next Item"
                    >
                      &gt;
                    </button>
                    <span className="ml-1 text-[11px] font-black tracking-wider text-[#0d0f12]">
                      {isHouseSlide ? '01 / 02' : '02 / 02'}
                    </span>
                  </div>

                  {/* Bottom-Right Skewed Kiosk Action Button */}
                  {isHouseSlide ? (
                    <button
                      type="button"
                      data-buy-house-btn="true"
                      disabled={isBuyingCatalogAsset || (!isHouseOwned && !canAffordHouse)}
                      onClick={async () => {
                        soundEngine.playUiClick();
                        if (isHouseOwned) {
                          triggerNpcSpeech(
                            'You already own your House. You can enter your Private House anytime.',
                          );
                          return;
                        }
                        setCatalogActionFeedback(null);
                        setIsBuyingCatalogAsset(true);
                        try {
                          const ok = await onBuyHouseWithRespite?.(HOUSE_OWNERSHIP_PRICE_RESPITE);
                          if (ok) {
                            const msg = `House Deed minted on NEAR Testnet for ${HOUSE_OWNERSHIP_PRICE_RESPITE} RESPITE!`;
                            setCatalogActionFeedback({ ok: true, text: msg });
                            triggerNpcSpeech(msg);
                          } else {
                            const detail =
                              getLastNearTransactionError() ||
                              'House purchase requires a confirmed NEAR wallet transaction.';
                            setCatalogActionFeedback({ ok: false, text: detail });
                            triggerNpcSpeech(detail);
                          }
                        } finally {
                          setIsBuyingCatalogAsset(false);
                        }
                      }}
                      className={`-skew-x-12 px-5 py-2 border-[2.5px] border-[#0d0f12] font-black text-[11px] uppercase tracking-wider shadow-[0_3px_0_#0d0f12] transition-all ${
                        isHouseOwned
                          ? 'bg-[#b8ff3c] text-[#0d0f12] cursor-pointer'
                          : canAffordHouse && !isBuyingCatalogAsset
                            ? 'bg-[#2bb3b1] hover:bg-[#38bdf8] text-[#0d0f12] cursor-pointer'
                            : 'bg-slate-400 text-slate-700 cursor-not-allowed'
                      }`}
                    >
                      <span className="inline-block skew-x-12">
                        {isBuyingCatalogAsset
                          ? 'SIGNING ON NEAR...'
                          : isHouseOwned
                            ? 'HOUSE OWNED'
                            : `BUY HOUSE (${HOUSE_OWNERSHIP_PRICE_RESPITE} RESPITE)`}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-recruit-family-member-btn="true"
                      disabled={isBuyingCatalogAsset || !canAffordFamilyMember}
                      onClick={async () => {
                        if (!canAffordFamilyMember) return;
                        soundEngine.playUiClick();
                        setCatalogActionFeedback(null);
                        setIsBuyingCatalogAsset(true);
                        try {
                          const recruited = await onRecruitFamilyMember?.(selectedFamilyPlan.id);
                          if (recruited) {
                            const msg = `Recruited ${recruited.name} (${selectedFamilyPlan.shortLabel}) on NEAR for ${selectedFamilyPlan.priceRespite} RESPITE!`;
                            setCatalogActionFeedback({ ok: true, text: msg });
                            triggerNpcSpeech(msg);
                          } else {
                            const detail =
                              getLastNearTransactionError() ||
                              'Family Member recruitment requires a confirmed NEAR wallet transaction.';
                            setCatalogActionFeedback({ ok: false, text: detail });
                            triggerNpcSpeech(detail);
                          }
                        } finally {
                          setIsBuyingCatalogAsset(false);
                        }
                      }}
                      className={`-skew-x-12 px-5 py-2 border-[2.5px] border-[#0d0f12] font-black text-[11px] uppercase tracking-wider shadow-[0_3px_0_#0d0f12] transition-all ${
                        canAffordFamilyMember && !isBuyingCatalogAsset
                          ? 'bg-[#2bb3b1] hover:bg-[#38bdf8] text-[#0d0f12] cursor-pointer'
                          : 'bg-slate-400 text-slate-700 cursor-not-allowed'
                      }`}
                    >
                      <span className="inline-block skew-x-12">
                        {isBuyingCatalogAsset
                          ? 'SIGNING ON NEAR...'
                          : `RECRUIT (${selectedFamilyPlan.shortLabel} · ${selectedFamilyPlan.priceRespite} RESPITE)`}
                      </span>
                    </button>
                  )}
                </div>

                {catalogActionFeedback && (
                  <div
                    className={`p-2 border-2 border-black text-[10px] font-bold ${
                      catalogActionFeedback.ok
                        ? 'bg-[#ecfdf5] text-[#065f46]'
                        : 'bg-[#fef2f2] text-[#991b1b]'
                    }`}
                  >
                    {catalogActionFeedback.text}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ===============================================================
              TAB 4: FISH MARKET (Beach NPC Kai Only: Sell Raw Fish to Merchant for CYON, or Mint Fish NFT & Sell on P2P Marketplace for RESPITE)
             =============================================================== */}
          {merchantLocation === 'beach_house' && activeTab === 'fish_market' && (
            <div className="space-y-3" data-fish-market-panel="true">
              {/* Top Balance / Sign-In Header */}
              <div className="p-3 bg-[#0f172a] text-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-black uppercase text-[#b8ff3c]">
                    {walletConnected ? 'FISH MARKET' : 'SIGN IN REQUIRED'}
                  </span>
                  {walletConnected ? (
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 bg-[#38bdf8] text-black border border-black text-[9.5px] font-black uppercase">
                        {cyonBalance.toLocaleString()} CYON
                      </span>
                      <span className="px-2 py-0.5 bg-[#d8b4fe] text-black border border-black text-[9.5px] font-black uppercase">
                        {respiteBalance.toLocaleString()} RESPITE
                      </span>
                    </div>
                  ) : (
                    onConnectWallet && (
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          onConnectWallet();
                        }}
                        className="-skew-x-6 px-3 py-1 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black font-black text-[10px] uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                      >
                        <span className="skew-x-6 inline-block">SIGN IN</span>
                      </button>
                    )
                  )}
                </div>
                <p className="text-[10px] font-bold text-slate-300 leading-snug">
                  {walletConnected
                    ? 'Sell catches for LUL or mint Fish NFTs to trade with players for RESPITE.'
                    : 'Sign in to sell fish or trade Fish NFTs.'}
                </p>
              </div>

              {/* SECTION 1: YOUR FISH BUCKET (RAW CATCHES -> CYON OR MINT NFT -> RESPITE MARKETPLACE) */}
              <div
                className={`p-3 bg-[#f8fafc] border-[2.5px] border-black shadow-[3px_3px_0px_#000] space-y-2.5 ${
                  !walletConnected ? 'opacity-65 pointer-events-none select-none' : ''
                }`}
              >
                <div className="flex items-center justify-between border-b-2 border-black pb-1.5 gap-2 flex-wrap">
                  <span className="text-[11px] font-black uppercase">
                    1. YOUR FISH BUCKET ({caughtFishBucket.length} / 20)
                  </span>
                  <div className="flex items-center gap-2">
                    {caughtFishBucket.some((f) => !f.isMintedNft && f.rarity === 'Common') && (
                      <button
                        type="button"
                        data-release-all-common-fish-btn="true"
                        onClick={() => {
                          soundEngine.playUiClick();
                          onReleaseAllCommonFish?.();
                          triggerNpcSpeech(
                            'Released all Common fish back into the water to free up space in your Fish Bucket!',
                          );
                        }}
                        className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-black border border-black text-[9px] font-black uppercase cursor-pointer"
                      >
                        RELEASE COMMON
                      </button>
                    )}
                    <span className="text-[9.5px] font-extrabold uppercase text-slate-600">
                      Press [F] near any water to catch
                    </span>
                  </div>
                </div>

                {caughtFishBucket.length === 0 ? (
                  <div className="py-4 px-3 bg-white border-2 border-dashed border-slate-400 text-center text-[11px] font-bold text-slate-600">
                    Your Fish Bucket is empty. Walk to the East Beach shoreline or the Central Oasis Lake and press [F] CAST ROD to catch fish.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {caughtFishBucket.map((fish) => {
                      const lulValue = Math.max(5, fish.sellValueLul || fish.sellValueCyon || 25);
                      const defaultSuggestedRespite = Math.max(
                        1,
                        fish.suggestedRespitePrice || Math.round(lulValue / 10),
                      );
                      const priceInputStr =
                        listingPriceByFishId[fish.id] ?? String(defaultSuggestedRespite);
                      const parsedListPriceRespite = Math.max(
                        1,
                        Math.floor(Number(priceInputStr) || defaultSuggestedRespite),
                      );

                      const rarityBadgeStyle =
                        fish.rarity === 'Mythic'
                          ? 'bg-[#c084fc] text-black'
                          : fish.rarity === 'Rare'
                            ? 'bg-[#facc15] text-black'
                            : fish.rarity === 'Uncommon'
                              ? 'bg-[#2dd4bf] text-black'
                              : 'bg-slate-200 text-black';

                      const openBucketFish3d = () => {
                        setPreview3dFish({
                          speciesId: fish.speciesId,
                          speciesName: fish.speciesName,
                          rarity: fish.rarity,
                          weightKg: fish.weightKg,
                          lengthCm: fish.lengthCm,
                          waterZoneLabel: fish.waterZoneLabel,
                          colorHex: fish.colorHex,
                          isTrophy: fish.isTrophy,
                          isMintedNft: fish.isMintedNft,
                          nftTokenId: fish.nftTokenId,
                          valueLabel: fish.isMintedNft
                            ? `${parsedListPriceRespite} RESPITE`
                            : `+${lulValue} LUL`,
                          ownerOrSellerLabel: fish.caughtByAccount
                            ? `Angler: ${fish.caughtByAccount}`
                            : undefined,
                        });
                      };

                      return (
                        <div
                          key={fish.id}
                          data-fish-bucket-item={fish.speciesId}
                          className="p-2.5 bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex flex-col gap-2"
                        >
                          <div className="flex items-start gap-2.5">
                            <Fish3dThumbnail
                              speciesId={fish.speciesId}
                              speciesName={fish.speciesName}
                              colorHex={fish.colorHex}
                              variant="compact"
                              onInspect={openBucketFish3d}
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`px-1.5 py-0.5 border border-black text-[9px] font-black uppercase ${rarityBadgeStyle}`}
                                >
                                  {fish.rarity}
                                </span>
                                <span className="text-xs font-black uppercase text-black">
                                  {fish.speciesName}
                                </span>
                                <span className="px-1.5 py-0.5 bg-[#0f172a] text-[#38bdf8] text-[9px] font-black">
                                  {fish.weightKg.toFixed(2)} kg
                                  {fish.lengthCm ? ` · ${fish.lengthCm} cm` : ''}
                                </span>
                                {fish.isTrophy && (
                                  <span className="px-1.5 py-0.5 bg-[#facc15] text-black border border-black text-[8.5px] font-black uppercase">
                                    TROPHY +25%
                                  </span>
                                )}
                                {fish.isMintedNft && (
                                  <span className="px-1.5 py-0.5 bg-[#b8ff3c] text-black border border-black text-[8.5px] font-black uppercase">
                                    FISH NFT
                                  </span>
                                )}
                              </div>
                              <div className="text-[9.5px] font-bold text-slate-600 mt-0.5">
                                Caught at {fish.waterZoneLabel}
                              </div>
                            </div>

                            <button
                              type="button"
                              data-fish-3d-view-btn={fish.id}
                              onClick={() => {
                                soundEngine.playUiClick();
                                openBucketFish3d();
                              }}
                              className="py-1 px-2 bg-[#0f172a] hover:bg-[#1e293b] text-[#38bdf8] border-2 border-black shadow-[2px_2px_0_#000] text-[9.5px] font-black uppercase cursor-pointer shrink-0"
                            >
                              VIEW
                            </button>
                          </div>

                          {!fish.isMintedNft ? (
                            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200">
                              <button
                                type="button"
                                data-sell-fish-btn={fish.id}
                                onClick={() => {
                                  soundEngine.playUiClick();
                                  onSellCaughtFish?.(fish);
                                  triggerNpcSpeech(
                                    `Fresh ${fish.speciesName} (${fish.weightKg} kg)! Here is +${lulValue} LUL — convert your LUL into CYON in the Exchange tab.`,
                                  );
                                }}
                                className="flex-1 py-1.5 px-2.5 bg-[#facc15] hover:bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0_#000] text-[10px] font-black uppercase cursor-pointer"
                              >
                                SELL (+{lulValue} LUL)
                              </button>

                              <button
                                type="button"
                                data-mint-fish-btn={fish.id}
                                disabled={busyFishActionId !== null}
                                onClick={async () => {
                                  soundEngine.playUiClick();
                                  setFishMarketFeedback(null);
                                  setBusyFishActionId(fish.id);
                                  try {
                                    const ok = await onMintFishAsNft?.(fish);
                                    if (ok) {
                                      const msg = `Minted ${fish.speciesName} (${fish.weightKg} kg) as a Fish NFT. Set a RESPITE price below to list it.`;
                                      setFishMarketFeedback({ ok: true, text: msg });
                                      triggerNpcSpeech(msg);
                                    } else {
                                      const detail =
                                        getLastNearTransactionError() ||
                                        'Could not mint Fish NFT. Please check your wallet balance.';
                                      setFishMarketFeedback({ ok: false, text: detail });
                                      triggerNpcSpeech(detail);
                                    }
                                  } finally {
                                    setBusyFishActionId(null);
                                  }
                                }}
                                className="flex-1 py-1.5 px-2.5 bg-[#d8b4fe] hover:bg-[#e9d5ff] disabled:bg-slate-300 text-black border-2 border-black shadow-[2px_2px_0_#000] text-[10px] font-black uppercase cursor-pointer"
                              >
                                {busyFishActionId === fish.id ? 'MINTING...' : 'MINT NFT'}
                              </button>

                              <button
                                type="button"
                                data-release-fish-btn={fish.id}
                                onClick={() => {
                                  soundEngine.playUiClick();
                                  onReleaseCaughtFish?.(fish);
                                  triggerNpcSpeech(
                                    `Released ${fish.speciesName} (${fish.weightKg} kg) back into the water.`,
                                  );
                                }}
                                className="py-1.5 px-2.5 bg-slate-200 hover:bg-slate-300 text-black border-2 border-black shadow-[2px_2px_0_#000] text-[10px] font-black uppercase cursor-pointer"
                              >
                                RELEASE
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200">
                              <div className="flex items-center gap-1">
                                <span className="text-[9.5px] font-black uppercase">
                                  PRICE (RESPITE):
                                </span>
                                <input
                                  type="number"
                                  min={1}
                                  step={1}
                                  value={priceInputStr}
                                  onChange={(e) =>
                                    setListingPriceByFishId((prev) => ({
                                      ...prev,
                                      [fish.id]: e.target.value,
                                    }))
                                  }
                                  className="w-20 px-2 py-1 bg-slate-100 border-2 border-black text-[10.5px] font-black"
                                />
                              </div>
                              <button
                                type="button"
                                data-list-fish-nft-btn={fish.id}
                                disabled={busyFishActionId !== null}
                                onClick={async () => {
                                  soundEngine.playUiClick();
                                  setFishMarketFeedback(null);
                                  setBusyFishActionId(fish.id);
                                  try {
                                    const ok = await onListFishNftOnMarket?.(
                                      fish,
                                      parsedListPriceRespite,
                                    );
                                    if (ok) {
                                      const msg = `Your ${fish.speciesName} NFT (${fish.weightKg} kg) is now listed on Kai's Market for ${parsedListPriceRespite} RESPITE.`;
                                      setFishMarketFeedback({ ok: true, text: msg });
                                      triggerNpcSpeech(msg);
                                    } else {
                                      const detail =
                                        getLastNearTransactionError() ||
                                        'Could not list Fish NFT right now.';
                                      setFishMarketFeedback({ ok: false, text: detail });
                                      triggerNpcSpeech(detail);
                                    }
                                  } finally {
                                    setBusyFishActionId(null);
                                  }
                                }}
                                className="flex-1 py-1.5 px-3 bg-[#b8ff3c] hover:bg-[#d9f99d] disabled:bg-slate-300 text-black border-2 border-black shadow-[2px_2px_0_#000] text-[10px] font-black uppercase cursor-pointer"
                              >
                                {busyFishActionId === fish.id
                                  ? 'LISTING...'
                                  : `LIST FOR ${parsedListPriceRespite} RESPITE`}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {fishMarketFeedback && (
                <div
                  className={`p-2 border-2 border-black text-[10px] font-bold ${
                    fishMarketFeedback.ok
                      ? 'bg-[#ecfdf5] text-[#065f46]'
                      : 'bg-[#fef2f2] text-[#991b1b]'
                  }`}
                >
                  {fishMarketFeedback.text}
                </div>
              )}

              {/* SECTION 2: KAI'S PLAYER MARKET (BOUGHT & SOLD USING RESPITE) */}
              <div className="p-3 bg-[#0f172a] text-white border-[2.5px] border-black shadow-[3px_3px_0px_#000] space-y-2.5">
                <div className="flex items-center justify-between border-b border-white/20 pb-1.5">
                  <span className="text-[11px] font-black uppercase text-[#d8b4fe]">
                    PLAYER MARKET ({fishMarketListings.length})
                  </span>
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-[#d8b4fe] text-black">
                    RESPITE
                  </span>
                </div>

                {fishMarketListings.length === 0 ? (
                  <div className="py-4 text-center text-[11px] font-bold text-slate-400">
                    No Fish NFTs currently listed. Mint a caught fish above and list it for RESPITE.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                    {fishMarketListings.map((listing) => {
                      const isOwnListing =
                        listing.sellerNearAccount.toLowerCase() ===
                        playerNearAccount.toLowerCase();
                      const listingPriceRespite = Math.max(
                        1,
                        listing.priceRespite ||
                          (listing.priceLul > 200
                            ? Math.round(listing.priceLul / 50)
                            : listing.priceLul),
                      );
                      const canBuy =
                        walletConnected &&
                        busyFishActionId === null &&
                        (isOwnListing || respiteBalance >= listingPriceRespite);
                      const rarityBadgeStyle =
                        listing.rarity === 'Mythic'
                          ? 'bg-[#c084fc] text-black'
                          : listing.rarity === 'Rare'
                            ? 'bg-[#facc15] text-black'
                            : listing.rarity === 'Uncommon'
                              ? 'bg-[#2dd4bf] text-black'
                              : 'bg-slate-200 text-black';

                      const openListingFish3d = () => {
                        setPreview3dFish({
                          speciesId: listing.speciesId,
                          speciesName: listing.speciesName,
                          rarity: listing.rarity,
                          weightKg: listing.weightKg,
                          lengthCm: listing.lengthCm,
                          waterZoneLabel: listing.waterZoneLabel,
                          colorHex: listing.colorHex,
                          isTrophy: listing.isTrophy,
                          isMintedNft: true,
                          nftTokenId: listing.nftTokenId,
                          valueLabel: `${listingPriceRespite.toLocaleString()} RESPITE`,
                          ownerOrSellerLabel: `Seller: ${listing.sellerNearAccount}`,
                        });
                      };

                      return (
                        <div
                          key={listing.listingId}
                          data-fish-market-listing={listing.listingId}
                          className="p-2.5 bg-[#1e293b] border-2 border-black shadow-[2px_2px_0_#000] flex items-center justify-between gap-2.5"
                        >
                          <Fish3dThumbnail
                            speciesId={listing.speciesId}
                            speciesName={listing.speciesName}
                            colorHex={listing.colorHex}
                            variant="dark"
                            onInspect={openListingFish3d}
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`px-1.5 py-0.5 border border-black text-[8.5px] font-black uppercase ${rarityBadgeStyle}`}
                              >
                                {listing.rarity}
                              </span>
                              <span className="text-xs font-black uppercase text-white">
                                {listing.speciesName}
                              </span>
                              <span className="px-1.5 py-0.5 bg-black/50 text-[#b8ff3c] text-[9px] font-black">
                                {listing.weightKg.toFixed(2)} kg
                                {listing.lengthCm ? ` · ${listing.lengthCm} cm` : ''}
                              </span>
                              {listing.isTrophy && (
                                <span className="px-1.5 py-0.5 bg-[#facc15] text-black border border-black text-[8px] font-black uppercase">
                                  TROPHY
                                </span>
                              )}
                            </div>
                            <div className="text-[9.5px] font-bold text-slate-300 mt-0.5 truncate">
                              {listing.waterZoneLabel} · Seller: {listing.sellerNearAccount}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <button
                              type="button"
                              data-market-fish-3d-btn={listing.listingId}
                              onClick={() => {
                                soundEngine.playUiClick();
                                openListingFish3d();
                              }}
                              className="w-full px-2.5 py-1 bg-[#0f172a] hover:bg-black text-[#38bdf8] border border-white/25 text-[9px] font-black uppercase cursor-pointer"
                            >
                              VIEW
                            </button>

                            <button
                              type="button"
                              disabled={!canBuy}
                              onClick={async () => {
                                if (!canBuy) return;
                                soundEngine.playUiClick();
                                setFishMarketFeedback(null);
                                setBusyFishActionId(listing.listingId);
                                try {
                                  const ok = await onBuyFishNftFromMarket?.({
                                    ...listing,
                                    priceRespite: listingPriceRespite,
                                    priceLul: listingPriceRespite,
                                  });
                                  if (ok) {
                                    const msg = isOwnListing
                                      ? `Listing removed. ${listing.speciesName} (${listing.weightKg} kg) returned to your Fish Bucket.`
                                      : `Purchased ${listing.speciesName} NFT (${listing.weightKg} kg) from ${listing.sellerNearAccount} for ${listingPriceRespite} RESPITE.`;
                                    setFishMarketFeedback({ ok: true, text: msg });
                                    triggerNpcSpeech(msg);
                                  } else {
                                    const detail =
                                      getLastNearTransactionError() ||
                                      'Purchase could not be completed. Check your RESPITE balance.';
                                    setFishMarketFeedback({ ok: false, text: detail });
                                    triggerNpcSpeech(detail);
                                  }
                                } finally {
                                  setBusyFishActionId(null);
                                }
                              }}
                              className={`px-3 py-1.5 border-2 border-black shadow-[2px_2px_0_#000] text-[10px] font-black uppercase shrink-0 ${
                                isOwnListing
                                  ? 'bg-[#facc15] hover:bg-[#fde047] text-black cursor-pointer'
                                  : canBuy
                                    ? 'bg-[#d8b4fe] hover:bg-[#e9d5ff] text-black cursor-pointer'
                                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              {busyFishActionId === listing.listingId
                                ? 'PROCESSING...'
                                : isOwnListing
                                  ? 'UNLIST'
                                  : `BUY (${listingPriceRespite.toLocaleString()} RESPITE)`}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      </aside>
      <Fish3dPreviewModal fish={preview3dFish} onClose={() => setPreview3dFish(null)} />
    </>
  );
};

