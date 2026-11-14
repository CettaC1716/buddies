import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  Check,
  Coins,
  Eye,
  Gift,
  Home,
  LogIn,
  MapPin,
  PackageOpen,
  Plus,
  ShoppingBag,
  Sofa,
  Sparkles,
  Store,
  Tag,
  User,
} from 'lucide-react';
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
  createNegotiationSessionWithMemory,
  createNegotiationSessionFromBounds,
  type NpcPurchaseRefusal,
  negotiateRaise,
  negotiatePlayerCounter,
  negotiateAccept,
  negotiateWalkAway,
  clampNegotiationOffer,
  quickDealBonusLul,
  parseTradeChatIntent,
  countOwnedMerchantItems,
  type NegotiationSession,
  generateNpcMerchantReply,
  formatDaylightHour,
  evaluateRoomMoodScores,
} from '../game/buddiesMerchantPricing';
import { soundEngine } from '../game/audio';
import type { CaughtFishItem, FishNftMarketplaceListing } from '../game/buddiesFishingMarket';
import type {
  DbPropertyListingRow,
  FishNftMarketSalesStats,
} from '../lib/supabaseClient';
import {
  Fish3dPreviewModal,
  Fish3dThumbnail,
  type Fish3dPreviewSpec,
} from './Fish3dPreviewModal';
import { Furniture3dThumbnail } from './Furniture3dThumbnail';
import {
  Furniture3dPreviewModal,
  type Furniture3dPreviewSpec,
} from './Furniture3dPreviewModal';
import {
  HOUSE_OWNERSHIP_PRICE_RESPITE,
  RESPITE_NEP141_METADATA,
  getLastNearTransactionError,
  getNearBlocksTxUrl,
  isActiveWalletReadOnlyObserver,
  isCitizenSubAccountId,
  type FamilyMemberContractPlanId,
  type FamilyMemberOrderId,
  type NearRespiteSwapReceipt,
  type RecruitedFamilyMemberAgent,
  resolveApiUrl,
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
  propertyListings?: DbPropertyListingRow[];
  busyPropertyListingId?: string | null;
  onCreatePropertyListing?: (input: {
    assetKind: 'house' | 'furniture';
    assetId: string;
    assetLabel: string;
    priceRespite: number;
  }) => Promise<boolean>;
  onCancelPropertyListing?: (listingId: string) => Promise<void> | void;
  onBuyPropertyListing?: (listing: DbPropertyListingRow) => Promise<boolean>;
  onCompletePropertyTransfer?: (listing: DbPropertyListingRow) => Promise<boolean>;
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
  onBuyMerchantItem: (item: MerchantCatalogItem, price: number) => Promise<{ ok: boolean; txHash?: string; explorerUrl?: string }>;
  onSellMerchantItem: (item: MerchantCatalogItem, refund: number) => Promise<boolean>;
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
  onSellCaughtFishNegotiated?: (
    fish: CaughtFishItem,
    agreedPriceLul: number,
    roundsUsed?: number,
  ) => { ok: true } | { ok: false; reason: NpcPurchaseRefusal };
  /** Kai's haggling context for a fish: remembered final price + patience. */
  getKaiTradeContext?: (fish: CaughtFishItem) => {
    memoryFinalPrice: number | null;
    patience: number;
  };
  /** Fase 2 (plan Bagian 5): the trade server issues a bounded RESPITE
   * session for a minted fish — envelope, patience and memory included. */
  onRequestKaiNftTradeSession?: (fish: CaughtFishItem) => Promise<
    | {
        ok: true;
        sessionId: string;
        baseValueRespite: number;
        ceilingRespite: number;
        openingOffer: number;
        patience: number;
        memoryFinalPrice: number | null;
      }
    | { ok: false; reason: string }
  >;
  /** Fase 2: settle a minted-fish trade at the agreed RESPITE price
   * (guided listing + server-side Kai purchase, atomic on-chain). */
  onSellNftFishToKai?: (
    fish: CaughtFishItem,
    serverSessionId: string,
    agreedPriceRespite: number,
    roundsUsed?: number,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
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
  homeTourGuide?: {
    step: string;
    tab: 'sesi_chat' | 'transaksi' | 'katalog';
    katalogTab?: 'house' | 'furniture';
    line: string;
    walletLabel: string;
  } | null;
  homeTourTxs?: Record<string, { txHash: string; explorerUrl: string }>;
  onClaimHanaWelcomeNear?: () => Promise<{
    ok: boolean;
    txHash: string;
    explorerUrl: string;
    amountNear: number;
    error?: string;
  }>;
  onFinishHanaTutorialAndGuideKiosk?: () => void;
  hanaPitchOrigin?: 'kiosk' | 'browse' | null;
  onViewModelHouse?: (style?: 'plaza_manor' | 'japanese_pavilion') => void;
  onEnterOwnHouse?: (style?: 'plaza_manor' | 'japanese_pavilion') => void;
  houseArchitectureStyle?: 'plaza_manor' | 'japanese_pavilion';
  onSelectHouseArchitectureStyle?: (style: 'plaza_manor' | 'japanese_pavilion') => void;
  onOpenTeleportKioskFromPitch?: () => void;
  kaiTutorialStage?: 'meet' | 'equip' | 'to_water' | 'catch' | 'mint' | 'sell' | 'done' | null;
  kaiCardDismissed?: boolean;
  onKaiTutorialStart?: () => void;
  onKaiTutorialLater?: () => void;
}

/* Kai chat-trade language pack: the card and Kai's short scripted lines
 * follow the language of the player's latest message (Indonesian or
 * English; other languages keep the English card while the AI dialogue
 * itself still answers in the player's language). */
type TradeLang = 'en' | 'id';
const TRADE_LINES: Record<
  TradeLang,
  Record<
    | 'pick'
    | 'open'
    | 'raise1'
    | 'raise2'
    | 'final'
    | 'agreed'
    | 'acceptCounter'
    | 'done'
    | 'walkaway'
    | 'reasonRare'
    | 'reasonDemand'
    | 'reasonStock'
    | 'reasonFair'
    | 'treasuryBreaker'
    | 'treasuryBudget'
    | 'treasuryPool'
    | 'patienceOut'
    | 'nftChecking'
    | 'nftDeskClosed',
    string
  >
> = {
  en: {
    pick: 'Pick the fish you want to sell.',
    open: 'Let me weigh it. Here is my offer.',
    raise1: 'Alright, a little more.',
    raise2: 'You bargain hard, friend.',
    final: 'That is my limit. Take it, or list it on the market.',
    agreed: 'Deal! Tap sell and I will pay you.',
    acceptCounter: 'Deal. You drive a fair bargain.',
    done: 'Fresh stock for my market. Thank you!',
    walkaway: 'No hard feelings. The market may pay more.',
    reasonRare: 'Rare catches move fast at my stall, so I pay well.',
    reasonDemand: 'Market demand is strong, so I can stretch my price.',
    reasonStock: 'I still hold plenty of this kind, so I buy lower.',
    reasonFair: 'A fair trade price. I resell it at the fish market.',
    treasuryBreaker: 'Rough day at the market. My purse is closed until tomorrow.',
    treasuryBudget: "That empties today's purse. Come back tomorrow, friend.",
    treasuryPool: 'My purse cannot cover that today, friend.',
    patienceOut: 'That is enough for this catch. Come back tomorrow.',
    nftChecking: 'That one is an NFT. Let me check my treasury desk.',
    nftDeskClosed: 'My NFT desk is closed right now, friend.',
  },
  id: {
    pick: 'Pick the fish you want to sell.',
    open: 'Let me weigh it first. Here is my offer.',
    raise1: 'Alright, I will raise it a little.',
    raise2: 'You bargain well, friend.',
    final: 'That is my limit. Take it, or sell it on the marketplace.',
    agreed: 'Deal! Tap sell and I will pay you right away.',
    acceptCounter: 'Deal. A fair offer.',
    done: 'Fresh stock for my market. Thank you!',
    walkaway: 'No problem. The marketplace might pay more.',
    reasonRare: 'Rare catches sell fast at my stall, so I pay well for them.',
    reasonDemand: 'Market demand is strong, so my price can go up.',
    reasonStock: 'I still hold plenty of this kind, so I buy it cheaper.',
    reasonFair: 'A fair price. I will resell it at the fish market.',
    treasuryBreaker: 'Rough day at the market. My purse is closed until tomorrow.',
    treasuryBudget: "That empties today's purse. Come back tomorrow, friend.",
    treasuryPool: 'My purse cannot cover that today, friend.',
    patienceOut: 'That is enough for this catch. Come back tomorrow.',
    nftChecking: 'That one is an NFT. Let me check my treasury desk.',
    nftDeskClosed: 'My NFT desk is closed right now, friend.',
  },
};
const TRADE_LABELS: Record<
  TradeLang,
  Record<
    | 'entryTitle'
    | 'paidIn'
    | 'entrySub'
    | 'startHaggling'
    | 'pickFish'
    | 'cancel'
    | 'offerLabel'
    | 'standardPrice'
    | 'finalOffer'
    | 'accept'
    | 'haggle'
    | 'stop'
    | 'deal'
    | 'fishPicked'
    | 'payment'
    | 'sellNow'
    | 'sold'
    | 'sellMore'
    | 'close'
    | 'lastOffer'
    | 'takeIt'
    | 'fishMarket',
    string
  >
> = {
  en: {
    entryTitle: 'SELL FISH TO KAI',
    paidIn: 'PAID IN LUL',
    entrySub: 'Haggle the price right here in chat.',
    startHaggling: 'START HAGGLING',
    pickFish: 'PICK A FISH',
    cancel: 'CANCEL',
    offerLabel: "Kai's offer",
    standardPrice: 'Standard price',
    finalOffer: 'Final offer',
    accept: 'ACCEPT',
    haggle: 'HAGGLE',
    stop: 'STOP',
    deal: 'DEAL',
    fishPicked: 'Fish picked',
    payment: 'Payment',
    sellNow: 'SELL NOW',
    sold: 'SOLD',
    sellMore: 'SELL MORE',
    close: 'CLOSE',
    lastOffer: 'LAST OFFER',
    takeIt: 'TAKE IT',
    fishMarket: 'FISH MARKET',
  },
  id: {
    entryTitle: 'SELL FISH TO KAI',
    paidIn: 'PAID IN LUL',
    entrySub: 'Haggle the price right here in this chat.',
    startHaggling: 'START HAGGLING',
    pickFish: 'PICK A FISH',
    cancel: 'CANCEL',
    offerLabel: "Kai's offer",
    standardPrice: 'Standard price',
    finalOffer: 'Final offer',
    accept: 'ACCEPT',
    haggle: 'HAGGLE',
    stop: 'STOP',
    deal: 'DEAL',
    fishPicked: 'Fish picked',
    payment: 'Payment',
    sellNow: 'SELL NOW',
    sold: 'SOLD',
    sellMore: 'SELL MORE',
    close: 'CLOSE',
    lastOffer: 'LAST OFFER',
    takeIt: 'TAKE IT',
    fishMarket: 'FISH MARKET',
  },
};
function detectTradeLang(_text: string): TradeLang | null {
  return 'en';
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
  propertyListings = [],
  busyPropertyListingId = null,
  onCreatePropertyListing,
  onCancelPropertyListing,
  onBuyPropertyListing,
  onCompletePropertyTransfer,
  onRecruitFamilyMember: _onRecruitFamilyMember,
  onCommandFamilyMember: _onCommandFamilyMember,
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
  onSellCaughtFishNegotiated,
  getKaiTradeContext,
  onRequestKaiNftTradeSession,
  onSellNftFishToKai,
  onReleaseCaughtFish,
  onReleaseAllCommonFish,
  onMintFishAsNft,
  onListFishNftOnMarket,
  onBuyFishNftFromMarket,
  citizenDisplayName = '',
  isTutorialHanaActive = false,
  hanaWelcomeNearClaimed = false,
  onClaimHanaWelcomeNear,
  homeTourGuide,
  homeTourTxs,
  onFinishHanaTutorialAndGuideKiosk,
  hanaPitchOrigin = null,
  onViewModelHouse,
  onEnterOwnHouse,
  houseArchitectureStyle = 'plaza_manor',
  onSelectHouseArchitectureStyle,
  onOpenTeleportKioskFromPitch,
  kaiTutorialStage = null,
  kaiCardDismissed = false,
  onKaiTutorialStart,
  onKaiTutorialLater,
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
  const [lastCatalogBuyReceipt, setLastCatalogBuyReceipt] = useState<{
    txHash: string;
    explorerUrl: string;
  } | null>(null);
  const [catalogActionFeedback, setCatalogActionFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [hanaCatalogTab, setHanaCatalogTab] = useState<'house' | 'furniture' | 'market'>(
    'house',
  );
  const [fishMarketTab, setFishMarketTab] = useState<'mine' | 'market'>('mine');
  const [houseListPrice, setHouseListPrice] = useState('40');
  const [furnitureListPrices, setFurnitureListPrices] = useState<Record<string, string>>({});
  const [marketActionFeedback, setMarketActionFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [busyFishActionId, setBusyFishActionId] = useState<string | null>(null);
  const [fishMarketFeedback, setFishMarketFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [houseCardView] = useState<'exterior' | 'interior'>('exterior');
  const [kaiCatalogPage, setKaiCatalogPage] = useState<number>(0);
  const [selectedKaiFishingId, setSelectedKaiFishingId] = useState<string>(
    'fishing_rod_carbon_pro',
  );
  const [listingPriceByFishId, setListingPriceByFishId] = useState<Record<string, string>>({});
  const [preview3dFish, setPreview3dFish] = useState<Fish3dPreviewSpec | null>(null);
  const [preview3dFurniture, setPreview3dFurniture] = useState<Furniture3dPreviewSpec | null>(
    null,
  );

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
      setHanaCatalogTab('house');
    };
    window.addEventListener('open-npc-catalog-house', onOpenCatalogHouse);
    return () => window.removeEventListener('open-npc-catalog-house', onOpenCatalogHouse);
  }, []);

  useEffect(() => {
    if (
      activeModalMode === 'npc_merchant' &&
      merchantLocation === 'beach_house' &&
      kaiTutorialStage === 'sell'
    ) {
      setActiveTab('fish_market');
    }
  }, [activeModalMode, merchantLocation, kaiTutorialStage]);

  // FIRST HOME guide mode: while App drives a guided step, this modal stays
  // pinned to that step's tab (and catalog sub-tab); the tab buttons for the
  // other tabs are disabled below so the player cannot wander off the step.
  useEffect(() => {
    if (!homeTourGuide) return;
    if (activeTab !== homeTourGuide.tab) setActiveTab(homeTourGuide.tab);
    if (homeTourGuide.katalogTab && hanaCatalogTab !== homeTourGuide.katalogTab) {
      setHanaCatalogTab(homeTourGuide.katalogTab);
    }
  }, [homeTourGuide, activeTab, hanaCatalogTab]);

  // FIRST HOME guide: on exchange steps, prefill the swap field with the
  // exact amount the guide asks for (0.25 for the house fund, 0.02 for the
  // furniture top-up) — once per step, so manual edits are not fought.
  const guidePrefillKeyRef = React.useRef<string>('');
  useEffect(() => {
    if (!homeTourGuide || homeTourGuide.tab !== 'transaksi') return;
    const amount =
      homeTourGuide.step === 'swap'
        ? '0.25'
        : homeTourGuide.step === 'buy_furniture'
          ? '0.02'
          : null;
    if (!amount) return;
    const key = `${homeTourGuide.step}:${amount}`;
    if (guidePrefillKeyRef.current === key) return;
    guidePrefillKeyRef.current = key;
    setCryptoSwapInputStr(amount);
  }, [homeTourGuide]);

  // Cutaway Interior Studio State
  const [studioDockTab, setStudioDockTab] = useState<'furniture' | 'materials' | 'lighting'>(
    'furniture',
  );
  const [furnitureMovePending, setFurnitureMovePending] = useState(false);
  useEffect(() => {
    const onPending = () => setFurnitureMovePending(true);
    const onCleared = () => setFurnitureMovePending(false);
    window.addEventListener('house-furniture-move-pending', onPending);
    window.addEventListener('house-furniture-move-cleared', onCleared);
    return () => {
      window.removeEventListener('house-furniture-move-pending', onPending);
      window.removeEventListener('house-furniture-move-cleared', onCleared);
    };
  }, []);
  const [daylightHour, setDaylightHour] = useState<number>(13.0);
  const [floorSwatchId, setFloorSwatchId] = useState<string>('floor_tatami_oak');
  const [wallSwatchId, setWallSwatchId] = useState<string>('wall_limewash');
  const [slatsSwatchId, setSlatsSwatchId] = useState<string>('slats_walnut');
  const [placed3dItems, setPlaced3dItems] = useState<PlacedHouseFurnitureItem[]>([]);
  const ownedItemCounts = countOwnedMerchantItems(ownedItemIds);
  const placedItemCounts = countOwnedMerchantItems(placed3dItems.map((it) => it.catalogId));
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
      const locLabel = merchantLocation === 'lobby_cafe' ? 'Central Plaza' : 'Beachfront Harbor';
      const displayCitizen = citizenDisplayName?.trim() || 'Buddy';
      let greeting = '';
      if (merchantLocation === 'lobby_cafe' && hanaPitchOrigin && !hasHouseOwnership) {
        setActiveTab('sesi_chat');
        greeting = `Hi ${displayCitizen}, I'm Hana \u2014 the city's property & housing agent, and your guide around town. I help citizens find their homes and exchange currency. It looks like you don't own any property in this city yet. Would you like a place to call your own? Browse the property catalog whenever you are ready \u2014 or step inside our model house first and see what your future home could look like. And feel free to ask me anything \u2014 I reply right away!`;
      } else if (
        merchantLocation === 'lobby_cafe' &&
        walletConnected &&
        (isTutorialHanaActive || !hanaWelcomeNearClaimed)
      ) {
        setActiveTab('sesi_chat');
        greeting = `Welcome to ${locLabel}, ${displayCitizen}! I'm Hana \u2014 the city's property & housing agent and your city guide. I welcome new citizens, handle home purchases, and help with currency exchange. Claim your starter pack below (0.30 NEAR + 100 LUL + 20 CYON) to get started. And feel free to ask me anything \u2014 I reply right away!`;
      } else if (!walletConnected && merchantLocation === 'beach_house') {
        greeting = `Ahoy! I'm Kai \u2014 a fisherman and the keeper of this beach. I run the fish market here at ${locLabel}: I buy your catches, sell tackle, and trade Fish NFTs. You are in Guest Mode, but you can still sell me your raw catches for LUL right here in chat \u2014 and feel free to ask me anything about fishing and the market!`;
      } else if (!walletConnected) {
        greeting = `Hi there, I'm Hana \u2014 the city's property & housing agent and city guide. I help citizens find homes, browse the property catalog, and exchange currency. You are in Guest Mode, so trading unlocks after you sign in \u2014 but looking around is free, and feel free to ask me anything about the city!`;
      } else if (merchantLocation === 'beach_house') {
        greeting = `Ahoy, ${displayCitizen}! I'm Kai \u2014 a fisherman and the keeper of this beach. I run the fish market here at ${locLabel}: I buy your catches, sell tackle, and trade Fish NFTs. Show me what you caught \u2014 and feel free to ask me anything about fishing and the market!`;
      } else {
        greeting = `Welcome back, ${displayCitizen} \u2014 Hana here, your property & housing agent and city guide. City homes, the catalog, and currency exchange are my desk \u2014 feel free to ask me anything about the game!`;
      }
      setNpcFullText(greeting);
      setNpcTypedText('');
      setPitchViewBoth('full');
      setLastPlayerMessage('');
      setChatHistory([]);
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
    hanaPitchOrigin,
    hasHouseOwnership,
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

  /* ------------------------------------------------------------------
   * Kai chat trade (F1 pilot): haggle over a raw fish in the chat itself.
   * The negotiation engine owns every number; this state only mirrors the
   * session for the card UI. Kai's spoken lines stay one short sentence —
   * prices live on the card, never in the dialogue.
   * ------------------------------------------------------------------ */
  type KaiTradePhase = 'pick' | 'offering' | 'agreed' | 'done' | 'walkaway';
  const [tradePhase, setTradePhase] = useState<KaiTradePhase | null>(null);
  const [tradeFishId, setTradeFishId] = useState<string | null>(null);
  const [tradeSession, setTradeSession] = useState<NegotiationSession | null>(null);
  const [tradeDoneInfo, setTradeDoneInfo] = useState<{
    name: string;
    price: number;
    currency: 'LUL' | 'RESPITE';
  } | null>(null);
  const [tradeCurrency, setTradeCurrency] = useState<'LUL' | 'RESPITE'>('LUL');
  const [tradeServerSessionId, setTradeServerSessionId] = useState<string | null>(null);
  const [tradeBusy, setTradeBusy] = useState(false);
  const tradeCurrencyRef = useRef<'LUL' | 'RESPITE'>('LUL');
  const tradePhaseRef = useRef<KaiTradePhase | null>(null);
  const tradeSessionRef = useRef<NegotiationSession | null>(null);
  const [tradeLang, setTradeLang] = useState<TradeLang>('en');
  const tradeLangRef = useRef<TradeLang>('en');
  const tradeLabels = TRADE_LABELS[tradeLang];
  const tradeLine = (key: keyof (typeof TRADE_LINES)['en']): string =>
    TRADE_LINES[tradeLangRef.current][key];
  const tradeFish =
    tradeFishId != null
      ? caughtFishBucket.find((f) => f.id === tradeFishId) ?? null
      : null;

  /* Hana property pitch visibility. The offer card is present in full at
   * the start of every Hana chat (she is the property agent). When the
   * conversation topic moves elsewhere the card steps aside entirely,
   * and when the topic turns back to housing Hana offers it again —
   * the card follows the conversation, not the other way around. */
  const [pitchView, setPitchView] = useState<'full' | 'hidden'>('full');
  const pitchViewRef = useRef<'full' | 'hidden'>('full');
  const setPitchViewBoth = (v: 'full' | 'hidden') => {
    pitchViewRef.current = v;
    setPitchView(v);
  };
  const openPitchCatalog = () => {
    soundEngine.playUiClick();
    setActiveTab('katalog');
    setHanaCatalogTab('house');
    triggerNpcSpeech('Pick a house style below or preview inside first.');
  };

  const syncTrade = (
    session: NegotiationSession | null,
    phase: KaiTradePhase | null,
    fishId?: string | null,
  ) => {
    tradeSessionRef.current = session;
    tradePhaseRef.current = phase;
    setTradeSession(session);
    setTradePhase(phase);
    if (fishId !== undefined) setTradeFishId(fishId);
  };

  const endTrade = () => {
    tradeCurrencyRef.current = 'LUL';
    setTradeCurrency('LUL');
    setTradeServerSessionId(null);
    setTradeBusy(false);
    syncTrade(null, null, null);
  };

  const startTradePick = () => {
    soundEngine.playUiClick();
    syncTrade(null, 'pick', null);
    triggerNpcSpeech(tradeLine('pick'));
  };

  const chooseTradeFish = (fish: CaughtFishItem) => {
    soundEngine.playUiClick();
    if (fish.isMintedNft && fish.nftTokenId && onRequestKaiNftTradeSession) {
      void chooseNftTradeFish(fish);
      return;
    }
    tradeCurrencyRef.current = 'LUL';
    setTradeCurrency('LUL');
    setTradeServerSessionId(null);
    const value = Math.max(5, fish.sellValueLul || fish.sellValueCyon || 25);
    // Treasury memory (plan Bagian 13.4): a fresh session for the same
    // species within 24h resumes at the last final offer, not the opener,
    // and Kai's patience for the session comes from the same context.
    const ctx = getKaiTradeContext?.(fish);
    syncTrade(
      createNegotiationSessionWithMemory(value, ctx?.memoryFinalPrice, ctx?.patience),
      'offering',
      fish.id,
    );
    triggerNpcSpeech(tradeLine('open'));
  };

  /** Kai ran out of patience and closed the order himself: the trade ends. */
  const closeTradeByNpc = () => {
    endTrade();
    triggerNpcSpeech(tradeLine('patienceOut'));
  };

  const applyRaisedSession = (next: NegotiationSession) => {
    if (next.closedByNpc) {
      closeTradeByNpc();
      return;
    }
    syncTrade(next, 'offering', tradeFishId);
    if (next.isFinalOffer) {
      triggerNpcSpeech(tradeLine('final'));
    } else if (next.roundsUsed <= 1) {
      triggerNpcSpeech(tradeLine('raise1'));
    } else {
      triggerNpcSpeech(tradeLine('raise2'));
    }
  };

  type TradeReasonKey = 'reasonRare' | 'reasonDemand' | 'reasonStock' | 'reasonFair';
  const getTradeReasonKey = (s: NegotiationSession): TradeReasonKey => {
    const rarity = (tradeFish?.rarity || '').toLowerCase();
    if (rarity === 'legendary' || rarity === 'epic' || rarity === 'rare') return 'reasonRare';
    if (s.currentOffer >= s.baseValue) return 'reasonDemand';
    if (s.currentOffer <= Math.round(s.baseValue * 0.85)) return 'reasonStock';
    return 'reasonFair';
  };

  const doTradeRaise = () => {
    const s = tradeSessionRef.current;
    if (!s || tradePhaseRef.current !== 'offering') return;
    soundEngine.playUiClick();
    applyRaisedSession(negotiateRaise(s));
  };

  const doTradeAccept = () => {
    const s = tradeSessionRef.current;
    if (!s) return;
    soundEngine.playUiClick();
    syncTrade(negotiateAccept(s), 'agreed', tradeFishId);
    triggerNpcSpeech(tradeLine('agreed'));
  };

  const doTradeWalkAway = () => {
    const s = tradeSessionRef.current;
    soundEngine.playUiClick();
    if (s) {
      syncTrade(negotiateWalkAway(s), 'walkaway', tradeFishId);
    } else {
      endTrade();
    }
    triggerNpcSpeech(tradeLine('walkaway'));
  };

  /** Fase 2: a minted fish negotiates in RESPITE against a session the
   * trade server issued — Kai checks his treasury before any number is
   * offered, and the server re-verifies everything again at settlement. */
  const chooseNftTradeFish = async (fish: CaughtFishItem) => {
    if (!onRequestKaiNftTradeSession) return;
    triggerNpcSpeech(tradeLine('nftChecking'));
    setTradeBusy(true);
    try {
      const res = await onRequestKaiNftTradeSession(fish);
      if (!res.ok) {
        endTrade();
        triggerNpcSpeech(
          tradeLine(
            res.reason === 'breaker'
              ? 'treasuryBreaker'
              : res.reason === 'budget' || res.reason === 'player_cap'
                ? 'treasuryBudget'
                : res.reason === 'treasury_low' || res.reason === 'pool'
                  ? 'treasuryPool'
                  : 'nftDeskClosed',
          ),
        );
        return;
      }
      tradeCurrencyRef.current = 'RESPITE';
      setTradeCurrency('RESPITE');
      setTradeServerSessionId(res.sessionId);
      syncTrade(
        createNegotiationSessionFromBounds({
          baseValue: res.baseValueRespite,
          ceiling: res.ceilingRespite,
          openingOffer: res.openingOffer,
          patience: res.patience,
          memoryFinalPrice: res.memoryFinalPrice,
        }),
        'offering',
        fish.id,
      );
      triggerNpcSpeech(tradeLine('open'));
    } finally {
      setTradeBusy(false);
    }
  };

  const settleNftTradeSell = async (
    s: NegotiationSession,
    fish: CaughtFishItem,
    serverSessionId: string,
  ) => {
    if (!onSellNftFishToKai || s.agreedPrice == null) return;
    soundEngine.playUiClick();
    setTradeBusy(true);
    try {
      const result = await onSellNftFishToKai(
        fish,
        serverSessionId,
        s.agreedPrice,
        s.roundsUsed,
      );
      if (!result.ok) {
        endTrade();
        triggerNpcSpeech(
          tradeLine(
            result.reason === 'breaker'
              ? 'treasuryBreaker'
              : result.reason === 'budget' || result.reason === 'player_cap'
                ? 'treasuryBudget'
                : result.reason === 'pool'
                  ? 'treasuryPool'
                  : 'nftDeskClosed',
          ),
        );
        return;
      }
      setTradeDoneInfo({ name: fish.speciesName, price: s.agreedPrice, currency: 'RESPITE' });
      syncTrade(null, 'done', null);
      triggerNpcSpeech(tradeLine('done'));
    } finally {
      setTradeBusy(false);
    }
  };

  const doTradeSell = () => {
    const s = tradeSessionRef.current;
    const fish = tradeFish;
    if (!s || s.agreedPrice == null || !fish) return;
    if (
      tradeCurrencyRef.current === 'RESPITE' &&
      tradeServerSessionId &&
      onSellNftFishToKai
    ) {
      void settleNftTradeSell(s, fish, tradeServerSessionId);
      return;
    }
    soundEngine.playUiClick();
    const result = onSellCaughtFishNegotiated?.(fish, s.agreedPrice, s.roundsUsed);
    if (result && !result.ok) {
      // Kai's treasury refused the payment (plan Bagian 13 caps/breaker):
      // no fish changes hands, the session ends, and Kai says why.
      endTrade();
      triggerNpcSpeech(
        tradeLine(
          result.reason === 'breaker'
            ? 'treasuryBreaker'
            : result.reason === 'pool'
              ? 'treasuryPool'
              : 'treasuryBudget',
        ),
      );
      return;
    }
    // The done card shows what Kai actually pays: the agreed price plus
    // the quick-deal bonus when the first offer was taken without haggling.
    setTradeDoneInfo({
      name: fish.speciesName,
      price: Math.min(
        s.ceiling,
        s.agreedPrice + quickDealBonusLul(s.baseValue, s.roundsUsed),
      ),
      currency: 'LUL',
    });
    syncTrade(null, 'done', null);
    triggerNpcSpeech(tradeLine('done'));
  };

  // A trade never outlives the modal, and a fish sold elsewhere ends it.
  useEffect(() => {
    if (activeModalMode !== 'npc_merchant' && tradePhaseRef.current) {
      endTrade();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModalMode]);
  useEffect(() => {
    if (
      (tradePhase === 'offering' || tradePhase === 'agreed') &&
      tradeFishId != null &&
      !caughtFishBucket.some((f) => f.id === tradeFishId)
    ) {
      endTrade();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caughtFishBucket, tradePhase, tradeFishId]);

  const submitPlayerQuestion = (rawText: string) => {
    const text = rawText.trim();
    if (!text) return;

    const detectedLang = detectTradeLang(text);
    if (detectedLang && detectedLang !== tradeLangRef.current) {
      tradeLangRef.current = detectedLang;
      setTradeLang(detectedLang);
    }

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

    if (merchantLocation === 'lobby_cafe' && !hasHouseOwnership) {
      const lowered = text.toLowerCase();
      const propertyTopic =
        /(rumah|properti|property|home|house|housing|deed|model house|tempat tinggal|kiosk|teleport|pulang)/.test(
          lowered,
        );
      const greetingOnly =
        /^(ha+lo+|ha+i+|he+i+|hi+|hello+|hey+|pagi|siang|sore|malam|selamat pagi|selamat siang|selamat sore|selamat malam)( hana)?$/.test(
          lowered.replace(/[!.,\s]+/g, ' ').trim(),
        );
      if (propertyTopic) {
        setPitchViewBoth('full');
      } else if (!greetingOnly) {
        setPitchViewBoth('hidden');
      }
    }

    const reqId = activeNpcRequestIdRef.current + 1;
    activeNpcRequestIdRef.current = reqId;
    setIsNpcThinking(true);
    setNpcFullText('');
    setNpcTypedText('');

    window.setTimeout(() => {
      chatScrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 30);

    // Kai chat trade: while a negotiation is live at the beach, clear
    // haggling language is settled locally by the negotiation engine —
    // the AI never moves a price on its own (see the trade card).
    if (
      merchantLocation === 'beach_house' &&
      tradePhaseRef.current === 'offering' &&
      tradeSessionRef.current
    ) {
      const s = tradeSessionRef.current;
      const finishLocal = (line: string) => {
        setIsNpcThinking(false);
        triggerNpcSpeech(line);
        window.setTimeout(() => {
          chatScrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 40);
      };
      const intent = parseTradeChatIntent(text);
      if (intent.kind === 'walkaway') {
        syncTrade(negotiateWalkAway(s), 'walkaway', tradeFishId);
        finishLocal(tradeLine('walkaway'));
        return;
      }
      if (intent.kind === 'counter') {
        const { session: next, outcome } = negotiatePlayerCounter(s, intent.ask);
        if (outcome === 'agreed') {
          syncTrade(next, 'agreed', tradeFishId);
          finishLocal(tradeLine('acceptCounter'));
        } else if (next.closedByNpc) {
          syncTrade(null, null, null);
          finishLocal(tradeLine('patienceOut'));
        } else {
          syncTrade(next, 'offering', tradeFishId);
          finishLocal(
            outcome === 'final' || next.isFinalOffer
              ? tradeLine('final')
              : tradeLine('raise1'),
          );
        }
        return;
      }
      if (intent.kind === 'why') {
        finishLocal(tradeLine(getTradeReasonKey(s)));
        return;
      }
      if (intent.kind === 'accept') {
        syncTrade(negotiateAccept(s), 'agreed', tradeFishId);
        finishLocal(tradeLine('agreed'));
        return;
      }
      if (intent.kind === 'raise') {
        const next = negotiateRaise(s);
        if (next.closedByNpc) {
          syncTrade(null, null, null);
          finishLocal(tradeLine('patienceOut'));
          return;
        }
        syncTrade(next, 'offering', tradeFishId);
        finishLocal(
          next.isFinalOffer
            ? tradeLine('final')
            : next.roundsUsed <= 1
              ? tradeLine('raise1')
              : tradeLine('raise2'),
        );
        return;
      }
      // No clear haggling intent: fall through to the AI with trade context.
    }

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
        const res = await fetch(resolveApiUrl('/api/npc-agent'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userMessage: text,
            merchantLocation,
            ...(merchantLocation === 'beach_house' &&
            tradePhaseRef.current === 'offering' &&
            tradeSessionRef.current
              ? {
                  tradeContext: {
                    itemLabel: tradeFish
                      ? `${tradeFish.speciesName} (${tradeFish.weightKg.toFixed(2)} kg)`
                      : 'raw fish',
                    currency: tradeCurrencyRef.current,
                    currentOffer: tradeSessionRef.current.currentOffer,
                    ceiling: tradeSessionRef.current.ceiling,
                    roundsLeft: Math.max(
                      0,
                      tradeSessionRef.current.maxRounds - tradeSessionRef.current.roundsUsed,
                    ),
                    playerAsk: (() => {
                      const m = text.match(/\d+/);
                      return m ? parseInt(m[0], 10) : null;
                    })(),
                  },
                }
              : {}),
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
        const data = (await res.json()) as {
          ok?: boolean;
          reply?: string;
          trade?: { moveType?: string; price?: number | null } | null;
        };
        if (activeNpcRequestIdRef.current !== reqId) return;
        setIsNpcThinking(false);
        if (res.ok && data?.ok && data.reply?.trim()) {
          // Apply the AI's proposed move — always re-clamped by the local
          // negotiation engine before it can touch the session price.
          const move = data.trade;
          const sNow = tradeSessionRef.current;
          if (move && sNow && tradePhaseRef.current === 'offering') {
            if (move.moveType === 'walkaway') {
              syncTrade(negotiateWalkAway(sNow), 'walkaway', tradeFishId);
            } else if (move.moveType === 'accept_player_price' && move.price != null) {
              const { session: next, outcome } = negotiatePlayerCounter(sNow, move.price);
              if (outcome === 'agreed') syncTrade(next, 'agreed', tradeFishId);
            } else if (move.moveType === 'offer' && move.price != null) {
              const clamped = clampNegotiationOffer(sNow, move.price);
              if (clamped > sNow.currentOffer && !sNow.isFinalOffer) {
                const roundsUsed = sNow.roundsUsed + 1;
                syncTrade(
                  {
                    ...sNow,
                    currentOffer: clamped,
                    roundsUsed,
                    isFinalOffer:
                      roundsUsed >= sNow.patience ||
                      roundsUsed >= sNow.maxRounds ||
                      clamped >= sNow.ceiling,
                  },
                  'offering',
                  tradeFishId,
                );
              }
            }
          }
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
                {furnitureMovePending && (
                  <>
                    <button
                      type="button"
                      data-confirm-furniture-move="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setFurnitureMovePending(false);
                        dispatchHouseStudioPatch({ confirmFurnitureMove: true });
                      }}
                      className="px-2 py-0.5 bg-[#b8ff3c] text-[#0d0f12] text-[9px] font-black uppercase cursor-pointer"
                    >
                      ✓ CONFIRM MOVE
                    </button>
                    <button
                      type="button"
                      data-cancel-furniture-move="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setFurnitureMovePending(false);
                        dispatchHouseStudioPatch({ cancelFurnitureMove: true });
                      }}
                      className="px-2 py-0.5 bg-[#f4f6f8] text-[#0d0f12] text-[9px] font-black uppercase cursor-pointer"
                    >
                      ✕ CANCEL
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* TAB 1: FURNITURE CATALOG */}
          {studioDockTab === 'furniture' && (
            <div className="pt-2.5">
              {ownedFurniture.length === 0 ? (
                <div className="py-4 text-center text-xs font-bold text-slate-600 flex items-center justify-center gap-2">
                  <Sofa className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <span>NO FURNITURE YET — CHECK HANA&apos;S CATALOG</span>
                </div>
              ) : (
                <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
                  {ownedFurniture.map((item) => (
                    <div
                      key={item.id}
                      className="w-[148px] p-1.5 bg-[#f4f6f8] border-2 border-[#0d0f12] flex flex-col justify-between gap-1.5 shrink-0"
                    >
                      <div className="relative">
                        <Furniture3dThumbnail
                          catalogId={item.id}
                          name={item.name}
                          iconEmoji={item.iconEmoji}
                          compact
                          onInspect={() =>
                            setPreview3dFurniture({
                              catalogId: item.id,
                              name: item.name,
                              description: item.description,
                              isNft: item.isNft,
                              currency: item.currency,
                              priceLabel: `${item.basePrice} ${item.currency === 'RESPITE' ? 'R' : item.currency}`,
                              isOwned: true,
                            })
                          }
                        />
                        <span
                          className={`absolute top-1 left-1 px-1 py-0.2 text-[7.5px] font-black uppercase border border-[#0d0f12] z-20 ${
                            item.isNft ? 'bg-[#38bdf8] text-black' : 'bg-[#a7f3d0] text-black'
                          }`}
                        >
                          {item.isNft ? 'NFT' : 'CYON'}
                        </span>
                      </div>
                      <div className="text-[9.5px] font-black uppercase truncate">
                        {item.name}
                      </div>
                      {(() => {
                        const inBag =
                          (ownedItemCounts[item.id] ?? 0) - (placedItemCounts[item.id] ?? 0);
                        return (
                          <button
                            type="button"
                            data-spawn-3d-furniture={item.id}
                            disabled={inBag <= 0}
                            onClick={() => {
                              if (inBag <= 0) return;
                              soundEngine.playUiClick();
                              dispatchHouseStudioPatch({ spawnCatalogId: item.id });
                            }}
                            className={`w-full py-1 border-[1.5px] border-[#0d0f12] text-[9px] font-black uppercase inline-flex items-center justify-center gap-1 ${
                              inBag > 0
                                ? 'bg-[#b8ff3c] hover:bg-[#d2ff7a] cursor-pointer'
                                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            <Plus className="w-3 h-3" aria-hidden="true" />
                            <span>{inBag > 0 ? `PLACE · ${inBag} IN BAG` : 'ALL PLACED'}</span>
                          </button>
                        );
                      })()}
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
          <div className="flex items-center gap-2 flex-wrap [&_button:disabled]:opacity-40 [&_button:disabled]:cursor-not-allowed">
            <button
              type="button"
              data-gold-exchange-balance="true"
              disabled={Boolean(homeTourGuide) && homeTourGuide?.tab !== 'sesi_chat'}
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
              disabled={Boolean(homeTourGuide) && homeTourGuide?.tab !== 'transaksi'}
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
              disabled={Boolean(homeTourGuide) && homeTourGuide?.tab !== 'katalog'}
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

        {homeTourGuide && (
          <div
            data-home-tour-guide="true"
            className="mt-3 shrink-0 bg-[#0f172a] text-white border-2 border-black shadow-[3px_3px_0px_#000] px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-[#b8ff3c] text-black border border-black text-[9px] font-black uppercase shrink-0">
                Hana Guide
              </span>
              <span className="text-[11px] font-bold">{homeTourGuide.line}</span>
            </div>
            {homeTourGuide.walletLabel && (
              <div className="mt-1 text-[9.5px] font-bold text-slate-300">
                Wallet: {homeTourGuide.walletLabel}
              </div>
            )}
            {homeTourTxs && Object.keys(homeTourTxs).length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[9px] font-black uppercase text-slate-300">
                  On-chain proof:
                </span>
                {(['claim', 'swap', 'house', 'swap_small', 'furniture'] as const)
                  .filter((k) => homeTourTxs[k])
                  .map((k) => (
                    <a
                      key={k}
                      href={homeTourTxs[k].explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 border border-white/30 text-[9px] font-black uppercase text-[#b8ff3c]"
                    >
                      {
                        (
                          {
                            claim: 'Claim',
                            swap: 'Swap 0.25',
                            house: 'Home deed',
                            swap_small: 'Swap 0.02',
                            furniture: 'Furniture',
                          } as Record<string, string>
                        )[k]
                      }{' '}
                      - {homeTourTxs[k].txHash.slice(0, 8)}...
                    </a>
                  ))}
              </div>
            )}
          </div>
        )}

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
                        ? 'Central Plaza'
                        : 'Beachfront Harbor'}
                    </span>
                  </div>
                  <p className="text-xs sm:text-[13px] font-bold leading-relaxed text-[#f8fafc] min-h-[54px]">
                    {isNpcThinking ? (
                      <span className="text-slate-400">Typing...</span>
                    ) : (
                      <>
                        {npcTypedText}
                        {npcTypedText.length < npcFullText.length && (
                          <span className="inline-block w-1.5 h-3.5 bg-[#b8ff3c] ml-0.5" />
                        )}
                      </>
                    )}
                  </p>
                </div>

                {/* Guest Sign-In Callout (Compact 1-row pill) */}
                {!walletConnected && onConnectWallet && (
                  <div className="px-3 py-2 bg-[#1e293b] text-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-slate-200 truncate">
                      <LogIn className="w-3.5 h-3.5 text-[#b8ff3c] shrink-0" aria-hidden="true" />
                      <span>Sign in to buy &amp; exchange</span>
                    </span>
                    <button
                      type="button"
                      data-chat-guest-register-btn="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        onConnectWallet();
                      }}
                      className="px-3 py-1 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black text-[10.5px] uppercase cursor-pointer shrink-0"
                    >
                      SIGN IN
                    </button>
                  </div>
                )}

                {/* Kai Fishing Lesson Card (Compact) */}
                {merchantLocation === 'beach_house' &&
                  kaiTutorialStage === 'meet' &&
                  !kaiCardDismissed && (
                    <div
                      data-kai-tutorial-card="true"
                      className="p-2.5 bg-[#141c2e] text-white border-[2.5px] border-black shadow-[3px_3px_0px_#000] space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10.5px] font-black uppercase text-[#38bdf8]">
                          KAI&apos;S FISHING LESSON
                        </span>
                        <span className="px-1.5 py-0.5 bg-black/50 text-[9px] font-black text-white">
                          2 MIN
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          data-kai-start-lesson-btn="true"
                          onClick={() => {
                            soundEngine.playUiClick();
                            onKaiTutorialStart?.();
                          }}
                          className="py-2 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black text-[11px] uppercase cursor-pointer active:translate-y-0.5 transition-all"
                        >
                          SHOW ME HOW
                        </button>
                        <button
                          type="button"
                          data-kai-later-btn="true"
                          onClick={() => {
                            soundEngine.playUiClick();
                            onKaiTutorialLater?.();
                          }}
                          className="py-2 bg-[#1e293b] hover:bg-[#334155] text-white border-2 border-black shadow-[2px_2px_0px_#000] font-black text-[11px] uppercase cursor-pointer active:translate-y-0.5 transition-all"
                        >
                          LATER
                        </button>
                      </div>
                    </div>
                  )}

                {/* Kai Chat Trade (F1 pilot): one mutating card, buttons only */}
                {merchantLocation === 'beach_house' && !tradePhase &&
                  caughtFishBucket.some((f) => !f.isMintedNft) && (
                    <div
                      data-kai-trade-entry="true"
                      className="p-3 bg-[#141c2e] text-white border-[2.5px] border-black shadow-[3px_3px_0px_#000] space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10.5px] font-black uppercase text-[#38bdf8]">
                          {tradeLabels.entryTitle}
                        </span>
                        <span className="text-[10.5px] font-black text-white">{tradeCurrency === 'RESPITE' ? 'PAID IN RESPITE' : tradeLabels.paidIn}</span>
                      </div>
                      <p className="text-[11px] font-bold text-slate-300">
                        {tradeLabels.entrySub}
                      </p>
                      <button
                        type="button"
                        data-kai-trade-start-btn="true"
                        onClick={startTradePick}
                        className="w-full py-2.5 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-2 border-black shadow-[3px_3px_0px_#000] font-black text-xs uppercase tracking-wider cursor-pointer active:translate-y-0.5 transition-all"
                      >
                        {tradeLabels.startHaggling}
                      </button>
                    </div>
                  )}

                {merchantLocation === 'beach_house' && tradePhase === 'pick' && (
                  <div
                    data-kai-trade-card="pick"
                    className="p-3 bg-[#141c2e] text-white border-[2.5px] border-black shadow-[3px_3px_0px_#000] space-y-2"
                  >
                    <div className="text-[10.5px] font-black uppercase text-[#38bdf8]">
                      {tradeLabels.pickFish}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {caughtFishBucket
                        .filter((f) => !f.isMintedNft)
                        .map((fish) => (
                          <button
                            key={fish.id}
                            type="button"
                            data-kai-trade-fish={fish.id}
                            onClick={() => chooseTradeFish(fish)}
                            className="p-2 bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] text-left cursor-pointer hover:bg-[#ecfccb]"
                          >
                            <div className="text-[11px] font-black uppercase truncate">
                              {fish.speciesName}
                            </div>
                            <div className="text-[10px] font-bold text-slate-600">
                              {fish.weightKg.toFixed(2)} kg · {fish.rarity}
                            </div>
                          </button>
                        ))}
                    </div>
                    <button
                      type="button"
                      onClick={endTrade}
                      className="w-full py-2 bg-[#1e293b] hover:bg-[#334155] text-white border-2 border-black font-black text-[11px] uppercase cursor-pointer"
                    >
                      {tradeLabels.cancel}
                    </button>
                  </div>
                )}

                {merchantLocation === 'beach_house' &&
                  tradePhase === 'offering' &&
                  tradeSession &&
                  tradeFish && (
                    <div
                      data-kai-trade-card="offering"
                      className="p-3 bg-[#141c2e] text-white border-[2.5px] border-black shadow-[3px_3px_0px_#000] space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10.5px] font-black uppercase text-[#38bdf8] truncate">
                          {tradeFish.speciesName} · {tradeFish.weightKg.toFixed(2)} kg
                        </span>
                        <span className="text-[10px] font-black text-slate-300 shrink-0">
                          {'\u25CF'.repeat(tradeSession.roundsUsed)}
                          {'\u25CB'.repeat(
                            Math.max(0, tradeSession.maxRounds - tradeSession.roundsUsed),
                          )}
                        </span>
                      </div>
                      <div>
                        <div className="text-[9.5px] font-black uppercase text-slate-400">
                          {tradeLabels.offerLabel}
                        </div>
                        <div className="text-2xl font-black text-white leading-none">
                          {tradeSession.currentOffer} {tradeCurrency}
                        </div>
                        <div className="mt-1.5 h-2 bg-slate-700 border border-black">
                          <div
                            className="h-full bg-[#b8ff3c]"
                            style={{
                              width: `${Math.min(100, Math.round((tradeSession.currentOffer / tradeSession.baseValue) * 100))}%`,
                            }}
                          />
                        </div>
                        <div className="text-[9.5px] font-bold text-slate-400 mt-1">
                          {tradeLabels.standardPrice}: {tradeSession.baseValue} {tradeCurrency}
                          {tradeSession.isFinalOffer ? ` · ${tradeLabels.finalOffer}` : ''}
                        </div>
                        <div className="text-[9.5px] italic font-bold text-slate-400 mt-0.5">
                          {TRADE_LINES[tradeLang][getTradeReasonKey(tradeSession)]}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          data-kai-trade-accept-btn="true"
                          onClick={doTradeAccept}
                          className="flex-1 py-2.5 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black text-[11px] uppercase cursor-pointer"
                        >
                          {tradeLabels.accept}
                        </button>
                        <button
                          type="button"
                          data-kai-trade-raise-btn="true"
                          onClick={doTradeRaise}
                          disabled={tradeSession.isFinalOffer}
                          className="flex-1 py-2.5 bg-[#38bdf8] hover:bg-[#7dd3fc] disabled:opacity-40 text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black text-[11px] uppercase cursor-pointer"
                        >
                          {tradeLabels.haggle}
                        </button>
                        <button
                          type="button"
                          onClick={doTradeWalkAway}
                          className="flex-1 py-2.5 bg-[#1e293b] hover:bg-[#334155] text-white border-2 border-black font-black text-[11px] uppercase cursor-pointer"
                        >
                          {tradeLabels.stop}
                        </button>
                      </div>
                    </div>
                  )}

                {merchantLocation === 'beach_house' &&
                  tradePhase === 'agreed' &&
                  tradeSession &&
                  tradeSession.agreedPrice != null && (
                    <div
                      data-kai-trade-card="agreed"
                      className="p-3 bg-[#141c2e] text-white border-[2.5px] border-black shadow-[3px_3px_0px_#000] space-y-2"
                    >
                      <div className="text-[10.5px] font-black uppercase text-[#b8ff3c]">
                        {tradeLabels.deal} · {tradeSession.agreedPrice} {tradeCurrency}
                      </div>
                      <div className="text-[11px] font-bold text-slate-300">
                        ✓ {tradeLabels.fishPicked} · ● {tradeLabels.payment}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          data-kai-trade-sell-btn="true"
                          disabled={tradeBusy}
                          onClick={doTradeSell}
                          className="flex-1 py-2.5 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black text-[11px] uppercase cursor-pointer"
                        >
                          {tradeLabels.sellNow}
                        </button>
                        <button
                          type="button"
                          onClick={endTrade}
                          className="flex-1 py-2.5 bg-[#1e293b] hover:bg-[#334155] text-white border-2 border-black font-black text-[11px] uppercase cursor-pointer"
                        >
                          {tradeLabels.cancel}
                        </button>
                      </div>
                    </div>
                  )}

                {merchantLocation === 'beach_house' && tradePhase === 'done' && tradeDoneInfo && (
                  <div
                    data-kai-trade-card="done"
                    className="p-3 bg-[#141c2e] text-white border-[2.5px] border-black shadow-[3px_3px_0px_#000] space-y-2"
                  >
                    <div className="text-[10.5px] font-black uppercase text-[#b8ff3c]">
                      ✓ {tradeLabels.sold} · {tradeDoneInfo.name} · +{tradeDoneInfo.price} {tradeDoneInfo.currency}
                    </div>
                    <div className="flex gap-2">
                      {caughtFishBucket.some((f) => !f.isMintedNft) && (
                        <button
                          type="button"
                          onClick={startTradePick}
                          className="flex-1 py-2.5 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black text-[11px] uppercase cursor-pointer"
                        >
                          {tradeLabels.sellMore}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={endTrade}
                        className="flex-1 py-2.5 bg-[#1e293b] hover:bg-[#334155] text-white border-2 border-black font-black text-[11px] uppercase cursor-pointer"
                      >
                        {tradeLabels.close}
                      </button>
                    </div>
                  </div>
                )}

                {merchantLocation === 'beach_house' &&
                  tradePhase === 'walkaway' &&
                  tradeSession && (
                    <div
                      data-kai-trade-card="walkaway"
                      className="p-3 bg-[#141c2e] text-white border-[2.5px] border-black shadow-[3px_3px_0px_#000] space-y-2"
                    >
                      <div className="text-[10.5px] font-black uppercase text-[#38bdf8]">
                        {tradeLabels.lastOffer} · {tradeSession.currentOffer} {tradeCurrency}
                      </div>
                      <div className="text-[9.5px] italic font-bold text-slate-400">
                        {TRADE_LINES[tradeLang][getTradeReasonKey(tradeSession)]}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={doTradeAccept}
                          className="flex-1 py-2.5 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black text-[11px] uppercase cursor-pointer"
                        >
                          {tradeLabels.takeIt}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playUiClick();
                            endTrade();
                            setActiveTab('fish_market');
                          }}
                          className="flex-1 py-2.5 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black text-[11px] uppercase cursor-pointer"
                        >
                          {tradeLabels.fishMarket}
                        </button>
                        <button
                          type="button"
                          onClick={endTrade}
                          className="flex-1 py-2.5 bg-[#1e293b] hover:bg-[#334155] text-white border-2 border-black font-black text-[11px] uppercase cursor-pointer"
                        >
                          {tradeLabels.close}
                        </button>
                      </div>
                    </div>
                  )}

                {/* Hana Property Pitch Card (Compact icon-first action card) */}
                {merchantLocation === 'lobby_cafe' &&
                  !hasHouseOwnership &&
                  !isTutorialHanaActive &&
                  pitchView === 'full' && (
                    <div
                      data-hana-property-pitch="true"
                      className="p-2.5 bg-[#141c2e] text-white border-[2.5px] border-black shadow-[3px_3px_0px_#000] space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-black uppercase text-[#38bdf8]">
                          <Home className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>YOUR FIRST HOME</span>
                        </span>
                        <button
                          type="button"
                          aria-label="Dismiss property offer for now"
                          onClick={() => setPitchViewBoth('hidden')}
                          className="w-5 h-5 leading-none bg-[#1e293b] hover:bg-[#334155] text-white border border-black font-black text-[10px] cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {onViewModelHouse && (
                          <button
                            type="button"
                            data-hana-view-model-house-btn="true"
                            onClick={() => {
                              soundEngine.playUiClick();
                              onViewModelHouse();
                            }}
                            className="py-2 px-2 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black text-[10.5px] uppercase cursor-pointer active:translate-y-0.5 transition-all inline-flex items-center justify-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>MODEL HOUSE</span>
                          </button>
                        )}
                        <button
                          type="button"
                          data-hana-view-catalog-btn="true"
                          onClick={openPitchCatalog}
                          className="py-2 px-2 bg-white hover:bg-slate-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black text-[10.5px] uppercase cursor-pointer active:translate-y-0.5 transition-all inline-flex items-center justify-center gap-1.5"
                        >
                          <Store className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>VIEW CATALOG</span>
                        </button>
                      </div>
                      {hanaPitchOrigin === 'kiosk' && onOpenTeleportKioskFromPitch && (
                        <button
                          type="button"
                          data-hana-open-kiosk-btn="true"
                          onClick={() => {
                            soundEngine.playUiClick();
                            onOpenTeleportKioskFromPitch();
                          }}
                          className="w-full py-1.5 bg-[#1e293b] hover:bg-[#334155] text-white border-2 border-black shadow-[2px_2px_0px_#000] font-black text-[10px] uppercase tracking-wider cursor-pointer inline-flex items-center justify-center gap-1.5"
                        >
                          <MapPin className="w-3.5 h-3.5 text-[#38bdf8]" aria-hidden="true" />
                          <span>OPEN TELEPORT KIOSK</span>
                        </button>
                      )}
                    </div>
                  )}

                {/* Hana Welcome Bonus Card (Compact 1-line) */}
                {merchantLocation === 'lobby_cafe' &&
                  walletConnected &&
                  (isTutorialHanaActive || !hanaWelcomeNearClaimed || hanaClaimResult?.ok) && (
                    <div
                      data-hana-onboarding-tutorial-box="true"
                      className="p-2.5 bg-[#141c2e] text-white border-[2.5px] border-black shadow-[3px_3px_0px_#000] space-y-2"
                    >
                      {!hanaWelcomeNearClaimed && !hanaClaimResult?.ok ? (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-black uppercase text-[#b8ff3c]">
                              <Gift className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>STARTER BONUS</span>
                            </span>
                            <span className="px-2 py-0.5 bg-black/50 border border-white/20 text-[10px] font-black text-white">
                              0.30 NEAR
                            </span>
                          </div>
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
                                    `${res.amountNear.toFixed(2)} NEAR added! Head outside to the Transit Kiosk.`,
                                  );
                                } else {
                                  soundEngine.playHit();
                                }
                              } finally {
                                setIsClaimingHanaNear(false);
                              }
                            }}
                            className={`w-full py-2 border-2 border-black shadow-[2px_2px_0px_#000] font-black text-xs uppercase tracking-wider transition-all ${
                              isClaimingHanaNear
                                ? 'bg-slate-600 text-slate-200 cursor-wait'
                                : 'bg-[#b8ff3c] hover:bg-[#d9f99d] text-black cursor-pointer active:translate-y-0.5'
                            }`}
                          >
                            {isClaimingHanaNear ? 'CLAIMING...' : 'CLAIM STARTER PACK'}
                          </button>
                        </>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-emerald-300">
                            <span>Starter pack added: 0.30 NEAR + 100 LUL + 20 CYON.</span>
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

              {/* Quick Question Chips (messages sent via bottom-left chat input bar) */}
              <div className="pt-2 border-t-2 border-black shrink-0 bg-white">
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
            const exchangePackets = rateLul > 0 ? Math.floor(parsedLul / rateLul) : 0;
            const exchangeLulSpent = exchangePackets * rateLul;
            const calculatedCyon = exchangePackets * rateCyon;
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
            const isReadOnlyWallet =
              walletConnected &&
              isActiveWalletReadOnlyObserver() &&
              !isCitizenSubAccountId(playerNearAccount);
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
                    CARD 1: NEAR -> RESPITE SWAP
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
                        { near: '0.02', label: '0.02 NEAR' },
                        { near: '0.25', label: '0.25 NEAR' },
                        { near: '0.5', label: '0.5 NEAR' },
                      ].map((preset) => {
                        const overBalance =
                          nearTestnetBalance > 0 && Number(preset.near) > nearTestnetBalance;
                        return (
                          <button
                            key={preset.near}
                            type="button"
                            disabled={overBalance}
                            onClick={() => {
                              soundEngine.playUiClick();
                              setCryptoSwapInputStr(preset.near);
                              setSwapErrorText(null);
                              setLastCryptoSwapReceipt(null);
                            }}
                            className={`px-2.5 py-0.5 border border-white/40 text-[9.5px] font-black uppercase ${
                              overBalance
                                ? 'bg-slate-700 text-slate-400 opacity-40 cursor-not-allowed'
                                : 'bg-[#1e293b] hover:bg-[#334155] text-[#d8b4fe] cursor-pointer'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
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
                          setLastCryptoSwapReceipt(null);
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
                        setLastCryptoSwapReceipt(null);
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

                  {lastCryptoSwapReceipt && (
                    <div className="px-4 pb-4">
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
                    </div>
                  )}
                </div>

                {/* ===========================================================
                    CARD 2: LUL -> CYON EXCHANGE
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
                        onExchangeLulToCyon(exchangeLulSpent, calculatedCyon);
                        triggerNpcSpeech(
                          `Exchanged ${exchangeLulSpent} LUL for +${calculatedCyon} CYON.`,
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
                            onClick={async () => {
                              soundEngine.playUiClick();
                              const ok = await onSellMerchantItem(
                                selectedFishingItem,
                                selectedQuote.sellbackPrice,
                              );
                              triggerNpcSpeech(
                                ok
                                  ? `Sold back ${selectedFishingItem.name} for +${selectedQuote.sellbackPrice} ${selectedFishingItem.currency}.`
                                  : `That sale did not go through — your item was not taken.`,
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
                            onClick={async () => {
                              if (!canAffordSelected) return;
                              soundEngine.playPickup();
                              const buyRes = await onBuyMerchantItem(selectedFishingItem, selectedQuote.buyPrice);
                              const ok = buyRes.ok;
                              triggerNpcSpeech(
                                ok
                                  ? `Purchased ${selectedFishingItem.name} for ${selectedQuote.buyPrice} ${selectedFishingItem.currency}! Stored inside your Personal Bag (BAG).`
                                  : `That purchase did not go through — your balance was not charged.`,
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

            const isHouseOwned = Boolean(walletConnected && hasHouseOwnership);
            const canAffordHouse =
              walletConnected && respiteBalance >= HOUSE_OWNERSHIP_PRICE_RESPITE;
            const myPropertyListings = propertyListings.filter(
              (l) =>
                l.seller_account.toLowerCase() === playerNearAccount.toLowerCase() &&
                (l.status === 'active' || l.status === 'paid'),
            );
            const myHouseListing =
              myPropertyListings.find((l) => l.asset_kind === 'house') ?? null;
            const listedFurnitureIds = new Set(
              myPropertyListings
                .filter((l) => l.asset_kind === 'furniture')
                .map((l) => l.asset_id),
            );
            const boardListings = propertyListings.filter(
              (l) => l.status === 'active' || l.status === 'paid',
            );
            const listableNftFurniture = MERCHANT_CATALOG_ITEMS.filter(
              (item) => item.isNft && ownedItemIds.includes(item.id),
            );

            return (
              <div className="space-y-2.5" data-catalog-house-and-family-panel="true">
                {/* Top Balance / Sign-In Strip (Compact icon-first) */}
                <div className="px-3 py-2 bg-[#0f172a] text-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Store className="w-4 h-4 text-[#d8b4fe] shrink-0" aria-hidden="true" />
                    <span className="text-[10.5px] font-black uppercase text-white truncate">
                      {walletConnected
                        ? `${respiteBalance.toLocaleString()} RESPITE`
                        : 'SIGN IN TO BUY'}
                    </span>
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
                      {walletConnected ? 'WALLET' : 'SIGN IN'}
                    </span>
                  </button>
                </div>

                {/* Catalog tabs: House | Furniture | Property Market */}
                <div className="grid grid-cols-3 gap-1.5" data-hana-catalog-tabs="true">
                  {(
                    [
                      { id: 'house', label: 'House', Icon: Home },
                      { id: 'furniture', label: 'Furniture', Icon: Sofa },
                      {
                        id: 'market',
                        label:
                          boardListings.length > 0
                            ? `Market (${boardListings.length})`
                            : 'Market',
                        Icon: Tag,
                      },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      data-hana-catalog-tab={tab.id}
                      disabled={
                        Boolean(homeTourGuide?.katalogTab) && tab.id !== homeTourGuide?.katalogTab
                      }
                      onClick={() => {
                        soundEngine.playUiClick();
                        setHanaCatalogTab(tab.id);
                      }}
                      className={`px-2 py-1.5 border-2 border-black text-[9.5px] font-black uppercase cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                        hanaCatalogTab === tab.id
                          ? 'bg-[#38bdf8] text-black shadow-[2px_2px_0px_#000]'
                          : 'bg-[#1e293b] text-white/75 hover:text-white'
                      } ${
                        homeTourGuide?.katalogTab && tab.id !== homeTourGuide.katalogTab
                          ? 'opacity-40 cursor-not-allowed'
                          : ''
                      }`}
                    >
                      <tab.Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  ))}
                </div>

                {hanaCatalogTab === 'house' && (() => {
                  const handleBuyDeed = async (style: 'plaza_manor' | 'japanese_pavilion') => {
                    soundEngine.playUiClick();
                    onSelectHouseArchitectureStyle?.(style);
                    if (isHouseOwned) {
                      triggerNpcSpeech('You already own your House! Tap GO TO YOUR HOUSE to walk in.');
                      return;
                    }
                    setCatalogActionFeedback(null);
                    setIsBuyingCatalogAsset(true);
                    try {
                      const ok = await onBuyHouseWithRespite?.(HOUSE_OWNERSHIP_PRICE_RESPITE);
                      if (ok) {
                        const msg = `House Deed minted! Tap GO TO YOUR HOUSE to walk in.`;
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
                  };

                  const houseCatalogCards = [
                    {
                      id: 'plaza_manor' as const,
                      katalogCardId: 'buddies_house_ownership',
                      title: 'CLASSIC PLAZA MANOR',
                      badge: 'MODEL HOUSE',
                      badgeBg: 'bg-[#b8ff3c]',
                      location: 'CENTRAL PLAZA',
                      imageSrc:
                        houseCardView === 'exterior'
                          ? '/assets/kiosk/plaza_manor_exterior.jpg'
                          : '/assets/kiosk/house_interior.jpg',
                      previewBtnAttr: 'view_model',
                      previewLabel: 'VIEW MODEL HOUSE',
                    },
                    {
                      id: 'japanese_pavilion' as const,
                      katalogCardId: 'buddies_japanese_pavilion',
                      title: 'JAPANESE PAVILION',
                      badge: 'CATALOG SERIES',
                      badgeBg: 'bg-[#38bdf8]',
                      location: 'KUMA CEDAR & SHOJI',
                      imageSrc:
                        houseCardView === 'exterior'
                          ? '/assets/kiosk/house_exterior.jpg'
                          : '/assets/kiosk/house_interior.jpg',
                      previewBtnAttr: 'preview_pavilion',
                      previewLabel: 'PREVIEW HOUSE',
                    },
                  ];

                  return (
                    <>
                      {/* Single-Column Full-Width Scrollable House Cards */}
                      <div
                        className="flex flex-col gap-3"
                        data-hana-house-architecture-grid="true"
                      >
                        {houseCatalogCards.map((card) => {
                          const isSelected = houseArchitectureStyle === card.id;
                          return (
                            <article
                              key={card.id}
                              data-buy-house-section={isSelected ? 'true' : undefined}
                              className={`relative select-none transition-transform duration-100 ${
                                isSelected
                                  ? 'bg-[#2bb3b1] p-[3.5px] border-[3px] border-[#0d0f12] shadow-[0_4px_0_#0d0f12]'
                                  : 'bg-[#f4f6f8] p-[2.5px] border-[2.5px] border-[#0d0f12] shadow-[0_3px_0_#0d0f12]'
                              }`}
                            >
                              <div className="bg-white border-[2px] border-[#0d0f12] overflow-hidden">
                                {/* Full-Width Hero Image */}
                                <button
                                  type="button"
                                  data-katalog-card={card.katalogCardId}
                                  data-house-style-card={card.id}
                                  onClick={() => {
                                    soundEngine.playUiClick();
                                    onSelectHouseArchitectureStyle?.(card.id);
                                  }}
                                  className="relative block w-full h-44 sm:h-48 text-left cursor-pointer bg-[#e9e2d4] overflow-hidden"
                                >
                                  <img
                                    src={card.imageSrc}
                                    alt={card.title}
                                    draggable={false}
                                    className="w-full h-full object-cover select-none pointer-events-none"
                                  />
                                  {isSelected && (
                                    <div
                                      className="absolute top-0 right-0 w-8 h-8 bg-[#2bb3b1] border-l-[2px] border-b-[2px] border-[#0d0f12] flex items-start justify-end p-1 z-20"
                                      style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}
                                    >
                                      <Check className="w-3.5 h-3.5 text-[#0d0f12] stroke-[3]" aria-hidden="true" />
                                    </div>
                                  )}
                                  <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/60 via-black/20 to-transparent p-2.5 flex items-center justify-between gap-2 pr-8">
                                    <span
                                      className={`px-2 py-0.5 ${card.badgeBg} text-[#0d0f12] border border-[#0d0f12] text-[8.5px] font-black uppercase`}
                                    >
                                      {card.badge}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 border border-[#0d0f12] text-[9px] font-black uppercase inline-flex items-center gap-1 ${
                                        isHouseOwned
                                          ? 'bg-[#b8ff3c] text-[#0d0f12]'
                                          : 'bg-[#d8b4fe] text-[#0d0f12]'
                                      }`}
                                    >
                                      <Sparkles className="w-3 h-3" aria-hidden="true" />
                                      <span>
                                        {isHouseOwned
                                          ? 'OWNED'
                                          : `${HOUSE_OWNERSHIP_PRICE_RESPITE} RESPITE`}
                                      </span>
                                    </span>
                                  </div>
                                  <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-2.5 pt-8">
                                    <div className="text-sm sm:text-[15px] font-black uppercase tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                                      {card.title}
                                    </div>
                                    <div className="inline-flex items-center gap-1 text-[9.5px] font-extrabold uppercase text-white/90 mt-0.5">
                                      <MapPin className="w-3 h-3 text-[#b8ff3c]" aria-hidden="true" />
                                      <span>{card.location}</span>
                                    </div>
                                  </div>
                                </button>

                                {/* Icon-First Spec Strip + Direct Actions */}
                                <div className="p-2.5 bg-[#f4f6f8] border-t-[2px] border-[#0d0f12] space-y-2">
                                  <div className="flex items-center justify-between gap-2 text-[9px] font-black uppercase text-[#1c2026]">
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-black">
                                      <Home className="w-3 h-3 text-[#0d9488]" aria-hidden="true" />
                                      <span>NFT DEED</span>
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-black">
                                      <Sofa className="w-3 h-3 text-[#0d9488]" aria-hidden="true" />
                                      <span>DECOR STUDIO</span>
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-black">
                                      <MapPin className="w-3 h-3 text-[#0d9488]" aria-hidden="true" />
                                      <span>PRIVATE PLOT</span>
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    {isHouseOwned && onEnterOwnHouse ? (
                                      <button
                                        type="button"
                                        data-catalog-go-your-house-btn="true"
                                        onClick={() => {
                                          soundEngine.playUiClick();
                                          onEnterOwnHouse(card.id);
                                        }}
                                        className="py-2 px-2 bg-[#b8ff3c] hover:bg-[#d9f99d] text-[#0d0f12] border-2 border-[#0d0f12] shadow-[2px_2px_0_#0d0f12] text-[10px] font-black uppercase cursor-pointer inline-flex items-center justify-center gap-1.5"
                                      >
                                        <Home className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                        <span className="truncate">GO TO YOUR HOUSE</span>
                                      </button>
                                    ) : onViewModelHouse ? (
                                      <button
                                        type="button"
                                        data-catalog-view-model-house-btn={
                                          card.previewBtnAttr === 'view_model' ? 'true' : undefined
                                        }
                                        data-catalog-preview-pavilion-btn={
                                          card.previewBtnAttr === 'preview_pavilion'
                                            ? 'true'
                                            : undefined
                                        }
                                        onClick={() => {
                                          soundEngine.playUiClick();
                                          onViewModelHouse(card.id);
                                        }}
                                        className="py-2 px-2 bg-[#b8ff3c] hover:bg-[#d9f99d] text-[#0d0f12] border-2 border-[#0d0f12] shadow-[2px_2px_0_#0d0f12] text-[10px] font-black uppercase cursor-pointer inline-flex items-center justify-center gap-1.5"
                                      >
                                        <Eye className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                        <span className="truncate">{card.previewLabel}</span>
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      data-buy-house-btn={isSelected ? 'true' : undefined}
                                      disabled={
                                        !walletConnected ||
                                        isBuyingCatalogAsset ||
                                        (!isHouseOwned && !canAffordHouse)
                                      }
                                      onClick={() => handleBuyDeed(card.id)}
                                      className={`py-2 px-2 border-2 border-[#0d0f12] shadow-[2px_2px_0_#0d0f12] text-[10px] font-black uppercase inline-flex items-center justify-center gap-1.5 transition-all ${
                                        isHouseOwned
                                          ? 'bg-[#38bdf8] text-[#0d0f12] cursor-pointer'
                                          : walletConnected && canAffordHouse && !isBuyingCatalogAsset
                                            ? 'bg-[#2bb3b1] hover:bg-[#38bdf8] text-[#0d0f12] cursor-pointer'
                                            : 'bg-slate-400 text-slate-700 cursor-not-allowed'
                                      }`}
                                    >
                                      {isHouseOwned ? (
                                        <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                      ) : (
                                        <ShoppingBag
                                          className="w-3.5 h-3.5 shrink-0"
                                          aria-hidden="true"
                                        />
                                      )}
                                      <span className="truncate">
                                        {isBuyingCatalogAsset
                                          ? 'SIGNING...'
                                          : isHouseOwned
                                            ? 'OWNED'
                                            : `BUY ${HOUSE_OWNERSHIP_PRICE_RESPITE} R`}
                                      </span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </article>
                          );
                        })}
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
                      {lastCatalogBuyReceipt && (
                        <div
                          data-catalog-buy-receipt="true"
                          className="p-2 bg-black/60 border border-[#10b981] text-[10px] font-bold text-slate-100 text-center"
                        >
                          Purchase confirmed on-chain.{' '}
                          <a
                            href={
                              lastCatalogBuyReceipt.explorerUrl ||
                              getNearBlocksTxUrl(lastCatalogBuyReceipt.txHash, 'testnet')
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#38bdf8] underline font-mono"
                          >
                            View Tx on NearBlocks ↗
                          </a>
                        </div>
                      )}
                    </>
                  );
                })()}

                {hanaCatalogTab === 'furniture' && (
                  <div
                    className="p-2.5 bg-[#0f172a] text-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5"
                    data-catalog-hana-furniture-panel="true"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 text-[10.5px] font-black uppercase text-[#38bdf8]">
                        <Sofa className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>FURNITURE &amp; THEMES</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#38bdf8] text-black border border-black text-[9px] font-black uppercase">
                          <Coins className="w-3 h-3" aria-hidden="true" />
                          <span>{cyonBalance.toLocaleString()} CYON</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#d8b4fe] text-black border border-black text-[9px] font-black uppercase">
                          <Sparkles className="w-3 h-3" aria-hidden="true" />
                          <span>{respiteBalance.toLocaleString()} R</span>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {MERCHANT_CATALOG_ITEMS.filter(
                        (item) => item.category !== 'fishing_gear',
                      ).map((item) => {
                        const quote = evaluateMerchantItemQuote(marketState, item);
                        const isOwned = ownedItemIds.includes(item.id);
                        const balance =
                          item.currency === 'CYON' ? cyonBalance : respiteBalance;
                        const canBuy =
                          (!isOwned || Boolean(item.interiorSlot)) &&
                          quote.stock > 0 &&
                          balance >= quote.buyPrice &&
                          (item.currency === 'CYON' || walletConnected);
                        return (
                          <div
                            key={item.id}
                            className="bg-[#1e293b] border-2 border-black shadow-[2px_2px_0px_#000] flex flex-col overflow-hidden"
                            data-catalog-furniture-card={item.id}
                          >
                            {/* Image-First Hero Showcase */}
                            <div className="relative">
                              <Furniture3dThumbnail
                                catalogId={item.id}
                                name={item.name}
                                iconEmoji={item.iconEmoji}
                                size="hero"
                                onInspect={() =>
                                  setPreview3dFurniture({
                                    catalogId: item.id,
                                    name: item.name,
                                    description: item.description,
                                    isNft: item.isNft,
                                    currency: item.currency,
                                    priceLabel: `${quote.buyPrice} ${item.currency === 'RESPITE' ? 'R' : item.currency}`,
                                    stock: quote.stock,
                                    isOwned,
                                    canBuy,
                                    onBuy: async () => {
                                      const buyRes = await onBuyMerchantItem(item, quote.buyPrice);
                                      const ok = buyRes.ok;
                                      setLastCatalogBuyReceipt(
                                        buyRes.txHash
                                          ? { txHash: buyRes.txHash, explorerUrl: buyRes.explorerUrl ?? '' }
                                          : null,
                                      );
                                      setCatalogActionFeedback({
                                        ok,
                                        text: ok
                                          ? `Bought ${item.name} (${quote.buyPrice} ${item.currency}).`
                                          : `Purchase failed — your balance was not charged.`,
                                      });
                                      if (ok) {
                                        triggerNpcSpeech(
                                          `Bought ${item.name}! Place it in your house studio.`,
                                        );
                                      }
                                    },
                                  })
                                }
                              />
                              <span
                                className={`absolute top-1.5 left-1.5 z-20 px-1.5 py-0.5 border border-black text-[8px] font-black uppercase ${
                                  item.isNft
                                    ? 'bg-[#38bdf8] text-black'
                                    : 'bg-[#a7f3d0] text-black'
                                }`}
                              >
                                {item.isNft ? 'NFT' : 'CYON'}
                              </span>
                              <span className="absolute top-1.5 right-1.5 z-20 px-1.5 py-0.5 bg-black/80 text-white border border-white/25 text-[8px] font-black uppercase">
                                ×{quote.stock}
                              </span>
                            </div>

                            {/* Minimal Name + Price + Action Footer (No prose paragraphs) */}
                            <div className="p-2 flex flex-col gap-1.5 flex-1">
                              <div className="text-[10.5px] font-black uppercase leading-tight text-white truncate">
                                {item.name}
                              </div>
                              <div className="mt-auto flex items-center justify-between gap-1.5 pt-1 border-t border-white/15">
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] font-black ${
                                    item.currency === 'CYON'
                                      ? 'text-[#38bdf8]'
                                      : 'text-[#d8b4fe]'
                                  }`}
                                >
                                  {item.currency === 'CYON' ? (
                                    <Coins className="w-3 h-3 shrink-0" aria-hidden="true" />
                                  ) : (
                                    <Sparkles className="w-3 h-3 shrink-0" aria-hidden="true" />
                                  )}
                                  <span>
                                    {quote.buyPrice}{' '}
                                    {item.currency === 'RESPITE' ? 'R' : item.currency}
                                  </span>
                                </span>
                                {isOwned && !item.interiorSlot ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#b8ff3c] text-black border border-black text-[8.5px] font-black uppercase">
                                    <Check className="w-3 h-3" aria-hidden="true" />
                                    <span>Owned{(ownedItemCounts[item.id] ?? 0) > 1 ? ` ×${ownedItemCounts[item.id]}` : ''}</span>
                                  </span>
                                ) : isOwned ? (
                                  <span className="inline-flex items-center gap-1">
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#b8ff3c] text-black border border-black text-[8.5px] font-black uppercase">
                                      <Check className="w-3 h-3" aria-hidden="true" />
                                      <span>×{ownedItemCounts[item.id] ?? 1}</span>
                                    </span>
                                    <button
                                      type="button"
                                      data-buy-furniture-btn={item.id}
                                      disabled={!canBuy}
                                      onClick={async () => {
                                        if (!canBuy) return;
                                        soundEngine.playPickup();
                                        const buyRes = await onBuyMerchantItem(item, quote.buyPrice);
                                        const ok = buyRes.ok;
                                        setLastCatalogBuyReceipt(
                                          buyRes.txHash
                                            ? { txHash: buyRes.txHash, explorerUrl: buyRes.explorerUrl ?? '' }
                                            : null,
                                        );
                                        setCatalogActionFeedback({
                                          ok,
                                          text: ok
                                            ? `Bought ${item.name} (${quote.buyPrice} ${item.currency}).`
                                            : `Purchase failed — your balance was not charged.`,
                                        });
                                        if (ok) {
                                          triggerNpcSpeech(
                                            `Bought ${item.name}! Place it in your house studio.`,
                                          );
                                        }
                                      }}
                                      className="px-2 py-1 bg-[#2bb3b1] hover:bg-[#38bdf8] disabled:bg-slate-500 text-black border border-black text-[8.5px] font-black uppercase cursor-pointer"
                                    >
                                      +1
                                    </button>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    data-buy-furniture-btn={item.id}
                                    disabled={!canBuy}
                                    onClick={async () => {
                                      if (!canBuy) return;
                                      soundEngine.playPickup();
                                      const buyRes = await onBuyMerchantItem(item, quote.buyPrice);
                                      const ok = buyRes.ok;
                                      setLastCatalogBuyReceipt(
                                        buyRes.txHash
                                          ? { txHash: buyRes.txHash, explorerUrl: buyRes.explorerUrl ?? '' }
                                          : null,
                                      );
                                      setCatalogActionFeedback({
                                        ok,
                                        text: ok
                                          ? `Bought ${item.name} (${quote.buyPrice} ${item.currency}).`
                                          : `Purchase failed — your balance was not charged.`,
                                      });
                                      if (ok) {
                                        triggerNpcSpeech(
                                          `Bought ${item.name}! Place it in your house studio.`,
                                        );
                                      }
                                    }}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 border border-black text-[9px] font-black uppercase ${
                                      canBuy
                                        ? 'bg-[#2bb3b1] hover:bg-[#38bdf8] text-black cursor-pointer'
                                        : 'bg-slate-600 text-slate-300 cursor-not-allowed'
                                    }`}
                                  >
                                    <ShoppingBag className="w-3 h-3" aria-hidden="true" />
                                    <span>{quote.stock <= 0 ? 'Out' : 'Buy'}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {hanaCatalogTab === 'market' && (
                  <div
                    className="p-2.5 bg-[#0f172a] text-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5"
                    data-property-market-panel="true"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 text-[10.5px] font-black uppercase text-[#d8b4fe]">
                        <Store className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>PROPERTY MARKET</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-[#1e293b] border border-white/20 text-[8.5px] font-black uppercase text-slate-300">
                          <Tag className="w-2.5 h-2.5 text-[#38bdf8]" aria-hidden="true" />
                          <span>LIST</span>
                          <span className="text-slate-500">→</span>
                          <Coins className="w-2.5 h-2.5 text-[#b8ff3c]" aria-hidden="true" />
                          <span>PAY</span>
                          <span className="text-slate-500">→</span>
                          <ArrowRightLeft className="w-2.5 h-2.5 text-[#d8b4fe]" aria-hidden="true" />
                          <span>DEED</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#d8b4fe] text-black border border-black text-[9px] font-black uppercase">
                          <Sparkles className="w-3 h-3" aria-hidden="true" />
                          <span>{respiteBalance.toLocaleString()} R</span>
                        </span>
                      </div>
                    </div>

                    {marketActionFeedback && (
                      <div
                        className={`p-2 border-2 border-black text-[10px] font-bold ${
                          marketActionFeedback.ok
                            ? 'bg-[#ecfdf5] text-[#065f46]'
                            : 'bg-[#fef2f2] text-[#991b1b]'
                        }`}
                      >
                        {marketActionFeedback.text}
                      </div>
                    )}

                    {/* SELL YOURS (Image-First) */}
                    <div className="space-y-1.5">
                      <div className="inline-flex items-center gap-1 text-[9.5px] font-black uppercase text-[#38bdf8]">
                        <Tag className="w-3 h-3" aria-hidden="true" />
                        <span>SELL YOUR ASSETS</span>
                      </div>
                      {!walletConnected ? (
                        <div className="p-2.5 bg-[#1e293b] border border-black flex items-center gap-2 text-[9.5px] font-bold text-slate-300">
                          <LogIn className="w-3.5 h-3.5 text-[#b8ff3c] shrink-0" aria-hidden="true" />
                          <span>Sign in to list or buy property</span>
                        </div>
                      ) : (
                        <>
                          {hasHouseOwnership && !myHouseListing && (
                            <div
                              className="p-2 bg-[#1e293b] border-2 border-black flex items-center gap-2.5"
                              data-property-list-house="true"
                            >
                              <div className="relative w-16 h-12 shrink-0 border border-black overflow-hidden">
                                <img
                                  src="/assets/kiosk/house_exterior.jpg"
                                  alt="Private House"
                                  className="w-full h-full object-cover"
                                  draggable={false}
                                />
                                <span className="absolute bottom-0.5 left-0.5 px-1 bg-black/80 text-[#b8ff3c] text-[7px] font-black uppercase">
                                  DEED
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-[10.5px] font-black uppercase truncate">
                                  Private House Deed
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <input
                                  value={houseListPrice}
                                  onChange={(e) =>
                                    setHouseListPrice(e.target.value.replace(/[^0-9]/g, ''))
                                  }
                                  inputMode="numeric"
                                  aria-label="House listing price in RESPITE"
                                  className="w-14 px-1.5 py-1 bg-black/60 border border-white/30 text-[10px] font-black text-white text-right"
                                />
                                <button
                                  type="button"
                                  disabled={busyPropertyListingId !== null}
                                  onClick={async () => {
                                    const price = parseInt(houseListPrice || '0', 10);
                                    if (!Number.isFinite(price) || price < 1) {
                                      setMarketActionFeedback({
                                        ok: false,
                                        text: 'Enter a price ≥ 1 RESPITE.',
                                      });
                                      return;
                                    }
                                    const ok = await onCreatePropertyListing?.({
                                      assetKind: 'house',
                                      assetId: '',
                                      assetLabel: 'Private House Deed',
                                      priceRespite: price,
                                    });
                                    setMarketActionFeedback(
                                      ok
                                        ? {
                                            ok: true,
                                            text: `House listed for ${price} RESPITE.`,
                                          }
                                        : {
                                            ok: false,
                                            text: 'Could not list your house.',
                                          },
                                    );
                                    if (ok) {
                                      triggerNpcSpeech('Your house is now listed on the board!');
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#2bb3b1] hover:bg-[#38bdf8] text-black border border-black text-[9px] font-black uppercase cursor-pointer disabled:bg-slate-500 disabled:text-slate-300"
                                >
                                  <Tag className="w-3 h-3" aria-hidden="true" />
                                  <span>List</span>
                                </button>
                              </div>
                            </div>
                          )}
                          {hasHouseOwnership && myHouseListing && (
                            <div className="px-2.5 py-1.5 bg-[#1e293b] border border-[#b8ff3c] text-[9.5px] font-black text-[#b8ff3c] flex items-center gap-1.5">
                              <Home className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>
                                {myHouseListing.status === 'paid'
                                  ? 'House paid — click Transfer below'
                                  : `House listed · ${myHouseListing.price_respite} RESPITE`}
                              </span>
                            </div>
                          )}
                          {listableNftFurniture.map((item) => {
                            const listed = listedFurnitureIds.has(item.id);
                            return (
                              <div
                                key={item.id}
                                className="p-2 bg-[#1e293b] border-2 border-black flex items-center gap-2.5"
                                data-property-list-furniture={item.id}
                              >
                                <div className="w-16 shrink-0">
                                  <Furniture3dThumbnail
                                    catalogId={item.id}
                                    name={item.name}
                                    iconEmoji={item.iconEmoji}
                                    compact
                                    onInspect={() =>
                                      setPreview3dFurniture({
                                        catalogId: item.id,
                                        name: item.name,
                                        description: item.description,
                                        isNft: item.isNft,
                                        currency: item.currency,
                                        priceLabel: `${item.basePrice} ${item.currency === 'RESPITE' ? 'R' : item.currency}`,
                                        isOwned: true,
                                      })
                                    }
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-[10px] font-black uppercase truncate">
                                    {item.name}
                                  </div>
                                  <span className="inline-block mt-0.5 px-1 bg-black/60 text-[#38bdf8] text-[7.5px] font-black uppercase">
                                    NFT
                                  </span>
                                </div>
                                {listed ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#b8ff3c] text-black border border-black text-[9px] font-black uppercase">
                                    <Check className="w-3 h-3" aria-hidden="true" />
                                    <span>Listed</span>
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <input
                                      value={furnitureListPrices[item.id] ?? '20'}
                                      onChange={(e) =>
                                        setFurnitureListPrices((prev) => ({
                                          ...prev,
                                          [item.id]: e.target.value.replace(/[^0-9]/g, ''),
                                        }))
                                      }
                                      inputMode="numeric"
                                      aria-label={`Listing price for ${item.name} in RESPITE`}
                                      className="w-14 px-1.5 py-1 bg-black/60 border border-white/30 text-[10px] font-black text-white text-right"
                                    />
                                    <button
                                      type="button"
                                      disabled={busyPropertyListingId !== null}
                                      onClick={async () => {
                                        const price = parseInt(
                                          furnitureListPrices[item.id] || '0',
                                          10,
                                        );
                                        if (!Number.isFinite(price) || price < 1) {
                                          setMarketActionFeedback({
                                            ok: false,
                                            text: 'Enter a price ≥ 1 RESPITE.',
                                          });
                                          return;
                                        }
                                        const ok = await onCreatePropertyListing?.({
                                          assetKind: 'furniture',
                                          assetId: item.id,
                                          assetLabel: item.name,
                                          priceRespite: price,
                                        });
                                        setMarketActionFeedback(
                                          ok
                                            ? {
                                                ok: true,
                                                text: `${item.name} listed (${price} R).`,
                                              }
                                            : {
                                                ok: false,
                                                text: 'Could not create listing.',
                                              },
                                        );
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#2bb3b1] hover:bg-[#38bdf8] text-black border border-black text-[9px] font-black uppercase cursor-pointer disabled:bg-slate-500 disabled:text-slate-300"
                                    >
                                      <Tag className="w-3 h-3" aria-hidden="true" />
                                      <span>List</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {!hasHouseOwnership && listableNftFurniture.length === 0 && (
                            <div className="p-2.5 bg-[#1e293b]/70 border border-dashed border-slate-600 flex items-center gap-2 text-[9.5px] font-bold text-slate-400">
                              <PackageOpen className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                              <span>No House Deed or NFT Furniture owned yet</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* MARKET BOARD LISTINGS (Image-First 2-Column Visual Cards) */}
                    <div className="space-y-1.5">
                      <div className="inline-flex items-center gap-1 text-[9.5px] font-black uppercase text-[#38bdf8]">
                        <Store className="w-3 h-3" aria-hidden="true" />
                        <span>LISTINGS ({boardListings.length})</span>
                      </div>
                      {boardListings.length === 0 ? (
                        <div className="py-4 px-3 bg-[#1e293b]/70 border border-dashed border-slate-600 flex flex-col items-center justify-center gap-1 text-center text-[9.5px] font-bold text-slate-400">
                          <Store className="w-5 h-5 text-slate-500" aria-hidden="true" />
                          <span>No active listings</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2.5">
                          {boardListings.map((listing) => {
                            const isMine =
                              listing.seller_account.toLowerCase() ===
                              playerNearAccount.toLowerCase();
                            const isBusy = busyPropertyListingId === listing.id;
                            const canBuy =
                              walletConnected &&
                              !isMine &&
                              listing.status === 'active' &&
                              busyPropertyListingId === null &&
                              respiteBalance >= listing.price_respite;
                            const isMyPurchase =
                              (listing.buyer_account || '').toLowerCase() ===
                              playerNearAccount.toLowerCase();
                            return (
                              <div
                                key={listing.id}
                                className="bg-[#1e293b] border-2 border-black shadow-[2px_2px_0px_#000] flex flex-col overflow-hidden"
                                data-property-listing={listing.id}
                              >
                                {/* Visual Hero Thumbnail */}
                                <div className="relative">
                                  {listing.asset_kind === 'house' ? (
                                    <div className="w-full h-24 border-b-2 border-black overflow-hidden bg-[#0f172a]">
                                      <img
                                        src="/assets/kiosk/house_exterior.jpg"
                                        alt={listing.asset_label}
                                        className="w-full h-full object-cover"
                                        draggable={false}
                                      />
                                    </div>
                                  ) : (
                                    <Furniture3dThumbnail
                                      catalogId={listing.asset_id}
                                      name={listing.asset_label}
                                      size="normal"
                                      onInspect={() =>
                                        setPreview3dFurniture({
                                          catalogId: listing.asset_id,
                                          name: listing.asset_label,
                                          isNft: true,
                                          currency: 'RESPITE',
                                          priceLabel: `${listing.price_respite} R`,
                                        })
                                      }
                                    />
                                  )}
                                  <span className="absolute top-1.5 left-1.5 z-20 px-1.5 py-0.5 bg-black/85 text-[#b8ff3c] border border-white/25 text-[7.5px] font-black uppercase">
                                    {listing.asset_kind === 'house' ? 'DEED' : 'NFT'}
                                  </span>
                                  {listing.status === 'paid' && (
                                    <span className="absolute top-1.5 right-1.5 z-20 px-1.5 py-0.5 bg-[#facc15] text-black border border-black text-[7.5px] font-black uppercase">
                                      PAID
                                    </span>
                                  )}
                                </div>

                                <div className="p-2 flex flex-col gap-1.5 flex-1">
                                  <div className="text-[10px] font-black uppercase truncate text-white">
                                    {listing.asset_label}
                                  </div>
                                  <div className="inline-flex items-center gap-1 text-[8.5px] font-bold text-slate-400 truncate">
                                    <User className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                                    <span className="truncate">
                                      {listing.seller_name || listing.seller_account}
                                    </span>
                                  </div>

                                  <div className="mt-auto pt-1 border-t border-white/15 flex items-center justify-between gap-1.5">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#d8b4fe]">
                                      <Sparkles className="w-3 h-3 shrink-0" aria-hidden="true" />
                                      <span>{listing.price_respite} R</span>
                                    </span>

                                    {listing.status === 'paid' ? (
                                      isMine ? (
                                        <button
                                          type="button"
                                          disabled={isBusy}
                                          onClick={async () => {
                                            const ok =
                                              await onCompletePropertyTransfer?.(listing);
                                            setMarketActionFeedback(
                                              ok
                                                ? {
                                                    ok: true,
                                                    text: `${listing.asset_label} transferred!`,
                                                  }
                                                : {
                                                    ok: false,
                                                    text: 'Transfer failed — try again.',
                                                  },
                                            );
                                            if (ok) {
                                              triggerNpcSpeech('Transfer complete!');
                                            }
                                          }}
                                          className="inline-flex items-center gap-1 px-2 py-1 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border border-black text-[8.5px] font-black uppercase cursor-pointer disabled:bg-slate-500"
                                        >
                                          <ArrowRightLeft className="w-2.5 h-2.5" aria-hidden="true" />
                                          <span>{isBusy ? '...' : 'Transfer'}</span>
                                        </button>
                                      ) : (
                                        <span className="text-[8px] font-black uppercase text-[#facc15]">
                                          {isMyPurchase ? 'Pending' : 'Sold'}
                                        </span>
                                      )
                                    ) : isMine ? (
                                      <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={async () => {
                                          await onCancelPropertyListing?.(listing.id);
                                          setMarketActionFeedback({
                                            ok: true,
                                            text: 'Listing cancelled.',
                                          });
                                        }}
                                        className="px-2 py-1 bg-slate-500 hover:bg-slate-400 text-black border border-black text-[8.5px] font-black uppercase cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={!canBuy}
                                        onClick={async () => {
                                          const ok = await onBuyPropertyListing?.(listing);
                                          setMarketActionFeedback(
                                            ok
                                              ? {
                                                  ok: true,
                                                  text: `Paid ${listing.price_respite} R — awaiting seller transfer.`,
                                                }
                                              : {
                                                  ok: false,
                                                  text: 'Payment failed — check RESPITE balance.',
                                                },
                                          );
                                          if (ok) {
                                            triggerNpcSpeech('Payment confirmed on-chain!');
                                          }
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-[#2bb3b1] hover:bg-[#38bdf8] text-black border border-black text-[8.5px] font-black uppercase cursor-pointer disabled:bg-slate-500 disabled:text-slate-300 disabled:cursor-not-allowed"
                                      >
                                        <ShoppingBag className="w-2.5 h-2.5" aria-hidden="true" />
                                        <span>{isBusy ? '...' : 'Buy'}</span>
                                      </button>
                                    )}
                                  </div>
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

              {/* Fish market tabs: My Fish (bucket + my listings) | Market (other players) */}
              <div className="grid grid-cols-2 gap-1.5" data-fish-market-tabs="true">
                <button
                  type="button"
                  data-fish-market-tab="mine"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setFishMarketTab('mine');
                  }}
                  className={`px-2 py-1.5 border-2 border-black text-[10px] font-black uppercase cursor-pointer ${
                    fishMarketTab === 'mine'
                      ? 'bg-[#b8ff3c] text-black shadow-[2px_2px_0px_#000]'
                      : 'bg-[#1e293b] text-white/60 hover:text-white'
                  }`}
                >
                  {`My Fish (${caughtFishBucket.length + fishMarketListings.filter((l) => l.sellerNearAccount.toLowerCase() === playerNearAccount.toLowerCase()).length})`}
                </button>
                <button
                  type="button"
                  data-fish-market-tab="market"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setFishMarketTab('market');
                  }}
                  className={`px-2 py-1.5 border-2 border-black text-[10px] font-black uppercase cursor-pointer ${
                    fishMarketTab === 'market'
                      ? 'bg-[#b8ff3c] text-black shadow-[2px_2px_0px_#000]'
                      : 'bg-[#1e293b] text-white/60 hover:text-white'
                  }`}
                >
                  {`Market (${fishMarketListings.filter((l) => l.sellerNearAccount.toLowerCase() !== playerNearAccount.toLowerCase()).length})`}
                </button>
              </div>

              {fishMarketTab === 'mine' && (
                <>
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

                {kaiTutorialStage === 'sell' && (
                  <div
                    data-kai-sell-guide="true"
                    className="p-2.5 mb-2 bg-[#0f172a] text-white border-2 border-black text-[11px] font-bold"
                  >
                    KAI: Let's weigh your catch — tap the glowing SELL button below.
                    Weight is money here; mint a fish as an NFT later and it can sell for
                    RESPITE.
                  </div>
                )}
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
                                className={`flex-1 py-1.5 px-2.5 bg-[#facc15] hover:bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000] text-[10px] font-black uppercase cursor-pointer ${kaiTutorialStage === 'sell' ? 'ring-4 ring-[#b8ff3c]' : ''}`}
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

                </>
              )}

              {/* SECTION 2: KAI'S PLAYER MARKET (BOUGHT & SOLD USING RESPITE) */}
              <div className="p-3 bg-[#0f172a] text-white border-[2.5px] border-black shadow-[3px_3px_0px_#000] space-y-2.5">
                <div className="flex items-center justify-between border-b border-white/20 pb-1.5">
                  <span className="text-[11px] font-black uppercase text-[#d8b4fe]">
{fishMarketTab === 'mine'
                      ? `MY LISTINGS (${fishMarketListings.filter((l) => l.sellerNearAccount.toLowerCase() === playerNearAccount.toLowerCase()).length})`
                      : `PLAYER MARKET (${fishMarketListings.filter((l) => l.sellerNearAccount.toLowerCase() !== playerNearAccount.toLowerCase()).length})`}
                  </span>
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-[#d8b4fe] text-black">
                    RESPITE
                  </span>
                </div>

                {(fishMarketTab === 'mine' ? fishMarketListings.filter((l) => l.sellerNearAccount.toLowerCase() === playerNearAccount.toLowerCase()) : fishMarketListings.filter((l) => l.sellerNearAccount.toLowerCase() !== playerNearAccount.toLowerCase())).length === 0 ? (
                  <div className="py-4 text-center text-[11px] font-bold text-slate-400">
                    {fishMarketTab === 'mine'
                      ? 'You have no Fish NFTs listed. Mint a caught fish above and list it for RESPITE.'
                      : 'No Fish NFTs listed by other players yet.'}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                    {fishMarketListings.map((listing) => {
                      const isOwnListing =
                        listing.sellerNearAccount.toLowerCase() ===
                        playerNearAccount.toLowerCase();
                      if ((fishMarketTab === 'mine') !== isOwnListing) return null;
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
      <Furniture3dPreviewModal
        item={preview3dFurniture}
        onClose={() => setPreview3dFurniture(null)}
      />
    </>
  );
};

