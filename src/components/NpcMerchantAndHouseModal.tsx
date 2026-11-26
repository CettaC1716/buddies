import React, { useEffect, useRef, useState } from 'react';
import {
  Coins,
  Eye,
  Gift,
  Home,
  LogIn,
  MapPin,
  Plus,
  ShoppingBag,
  Sofa,
  Sparkles,
  Store,
  Trash2,
  Wifi,
  X,
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
  parseNpcChatTransactionIntent,
  buildOfflineChatTransactionAck,
  isHanaHousingTopicQuery,
  detectHousingPromptLang,
  type NpcChatTransactionIntent,
} from '../game/buddiesMerchantPricing';
import { soundEngine } from '../game/audio';
import {
  canLongConversation,
  canPairPose,
  canRideTogether,
  canWalkTogether,
  createEmptyNpcClosenessStore,
  getNpcClosenessBand,
  type NpcClosenessStore,
  type NpcId,
} from '../game/npcClosenessEngine';
import {
  CURATED_NPC_PAIR_POSES,
  EMPTY_NPC_TOGETHERNESS_STATE,
  type NpcTogethernessStateSnapshot,
} from '../game/npcTogetherness';
import {
  canGiftNpcToday,
  getGiftCatalogItem,
  type GiftItemInput,
} from '../game/npcGiftEngine';
import type { NpcEmotionTag } from '../game/npcPersonaRegistry';
import { sendNpcChatMessage } from '../game/npcTextChat';
import {
  resolveNpcPhotoUrl,
  useNpcPortraitVersion,
} from '../game/npcPortraitRegistry';
import type {
  CityTransitDestinationSpec,
  CityTransitStationId,
} from '../game/buddiesBlitzRules';
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
  InlineExchangePanel,
  InlineHouseDealPanel,
  InlineSwapNearPanel,
  InlineTeleportPlacesPanel,
  QuickShopItemsPanel,
  type ChatTxSharedProps,
} from './ChatTransactionWidgets';
import type { NpcAgentChatAction } from '../../api/npc-agent';
import {
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

type ExchangeQuickMode =
  | 'quick_shop'
  | 'exchange_lul'
  | 'swap_near'
  | 'buy_house'
  | 'fishing_gear'
  | 'teleport';

const EXCHANGE_QUICK_MODE_LABELS: Record<ExchangeQuickMode, string> = {
  quick_shop: 'Quick Shop',
  exchange_lul: 'Exchange LUL',
  swap_near: 'Swap NEAR',
  buy_house: 'Buy House',
  fishing_gear: 'Fishing Gear',
  teleport: 'Teleport',
};

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
  npcOpenSeq?: number;
  marketState: MerchantAgentMarketState;
  lulBalance: number;
  cyonBalance: number;
  respiteBalance: number;
  nearTestnetBalance?: number;
  walletConnected: boolean;
  hasHouseOwnership?: boolean;
  onBuyHouseWithRespite?: (
    priceRespite: number,
    style?: 'plaza_manor' | 'japanese_pavilion',
  ) => Promise<boolean> | boolean | void;
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
  hanaWelcomeNearClaimed?: boolean;
  onClaimHanaWelcomeNear?: () => Promise<{
    ok: boolean;
    txHash: string;
    explorerUrl: string;
    amountNear: number;
    error?: string;
  }>;
  hanaPitchOrigin?: 'kiosk' | 'browse' | null;
  onViewModelHouse?: (style?: 'plaza_manor' | 'japanese_pavilion') => void;
  onEnterOwnHouse?: (style?: 'plaza_manor' | 'japanese_pavilion') => void;
  houseArchitectureStyle?: 'plaza_manor' | 'japanese_pavilion';
  ownedHouseStyle?: 'plaza_manor' | 'japanese_pavilion' | null;
  onChainHouseStyleLocked?: boolean;
  onSelectHouseArchitectureStyle?: (style: 'plaza_manor' | 'japanese_pavilion') => void;
  onOpenTeleportKioskFromPitch?: () => void;
  onTeleportToDestination?: (
    destination: CityTransitDestinationSpec,
    originStationId: CityTransitStationId,
  ) => void;
  onOpenExternalCatalog?: (tab?: 'house' | 'furniture' | 'market') => void;
  npcClosenessStore?: NpcClosenessStore;
  ownedApparelIds?: readonly string[];
  ownedCafeFoodIds?: readonly string[];
  onNpcConversationTurn?: (
    npcId: NpcId,
    closenessDelta: number,
    emotion: NpcEmotionTag,
  ) => void;
  onGiveNpcOwnedGift?: (
    npcId: NpcId,
    itemInput: GiftItemInput,
    fishInstanceId?: string,
  ) => { accepted: boolean; reactionLine: string; itemName: string };
  npcTogethernessState?: NpcTogethernessStateSnapshot;
  onToggleNpcWalkTogether?: (npcId: NpcId) => void;
  onTriggerNpcPairPose?: (npcId: NpcId, poseId?: string) => void;
  onToggleNpcRideTogether?: (npcId: NpcId) => void;
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
    nftChecking: 'That one is a collectible. One moment.',
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
    nftChecking: 'That one is a collectible. One moment.',
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
  npcOpenSeq = 0,
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
  propertyListings: _propertyListings = [],
  busyPropertyListingId: _busyPropertyListingId = null,
  onCreatePropertyListing: _onCreatePropertyListing,
  onCancelPropertyListing: _onCancelPropertyListing,
  onBuyPropertyListing: _onBuyPropertyListing,
  onCompletePropertyTransfer: _onCompletePropertyTransfer,
  onRecruitFamilyMember: _onRecruitFamilyMember,
  onCommandFamilyMember: _onCommandFamilyMember,
  ownedItemIds,
  activeHouseThemeId,
  interiorPlacement: _interiorPlacement,
  onClose,
  onEarnSafezoneLul: _onEarnSafezoneLul,
  onExchangeLulToCyon,
  onSwapNearAndRespite,
  onInvestInMerchant,
  onBuyMerchantItem,
  onSellMerchantItem,
  onSelectHouseTheme,
  onAssignInteriorSlot: _onAssignInteriorSlot,
  onRotateInteriorSlot: _onRotateInteriorSlot,
  onConnectWallet,
  playerBubbleBgColor: _playerBubbleBgColor = '#0f172a',
  playerBubbleTextColor: _playerBubbleTextColor = '#f8fafc',
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
  hanaWelcomeNearClaimed = false,
  onClaimHanaWelcomeNear,
  hanaPitchOrigin = null,
  onViewModelHouse,
  onEnterOwnHouse,
  houseArchitectureStyle = 'plaza_manor',
  ownedHouseStyle = null,
  onChainHouseStyleLocked = false,
  onSelectHouseArchitectureStyle,
  onOpenTeleportKioskFromPitch,
  onTeleportToDestination,
  onOpenExternalCatalog,
  npcClosenessStore,
  ownedApparelIds = [],
  ownedCafeFoodIds = [],
  onNpcConversationTurn,
  onGiveNpcOwnedGift,
  npcTogethernessState = EMPTY_NPC_TOGETHERNESS_STATE,
  onToggleNpcWalkTogether,
  onTriggerNpcPairPose,
  onToggleNpcRideTogether,
}) => {
  const [activeTab, setActiveTab] = useState<'sesi_chat' | 'transaksi' | 'katalog' | 'fish_market' | 'gift'>(
    'sesi_chat',
  );
  const [showMerchantPairPosePicker, setShowMerchantPairPosePicker] = useState<boolean>(false);
  const [merchantGiftFeedback, setMerchantGiftFeedback] = useState<{
    npcId: NpcId;
    reactionLine: string;
    giftLabel: string;
  } | null>(null);
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
    Array<{
      id: string;
      role: 'player' | 'npc';
      text: string;
      propertyOffer?: { lang: 'en' | 'id'; dismissed?: boolean } | null;
    }>
  >([]);
  const chatScrollEndRef = useRef<HTMLDivElement | null>(null);
  const [exchangeLulAmountStr, setExchangeLulAmountStr] = useState<string>('0');
  const [cryptoSwapInputStr, setCryptoSwapInputStr] = useState<string>('0.25');
  const [lastCryptoSwapReceipt, setLastCryptoSwapReceipt] =
    useState<NearRespiteSwapReceipt | null>(null);
  const [isSwappingNear, setIsSwappingNear] = useState<boolean>(false);
  const [swapErrorText, setSwapErrorText] = useState<string | null>(null);
  const [fishMarketTab, setFishMarketTab] = useState<'mine' | 'market'>('mine');
  const [busyFishActionId, setBusyFishActionId] = useState<string | null>(null);
  const [fishMarketFeedback, setFishMarketFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [kaiCatalogPage, setKaiCatalogPage] = useState<number>(0);
  const [selectedKaiFishingId, setSelectedKaiFishingId] = useState<string>(
    'fishing_rod_carbon_pro',
  );
  const [listingPriceByFishId, setListingPriceByFishId] = useState<Record<string, string>>({});
  const [preview3dFish, setPreview3dFish] = useState<Fish3dPreviewSpec | null>(null);
  const [preview3dFurniture, setPreview3dFurniture] = useState<Furniture3dPreviewSpec | null>(
    null,
  );

  // Always reset to CHAT SESSION and default EXCHANGE view when opening, closing, or switching merchants.
  const [exchangeQuickMode, setExchangeQuickMode] = useState<ExchangeQuickMode | null>(null);
  const [quickSwapNearOverride, setQuickSwapNearOverride] = useState<number | null>(null);
  const [quickLulAmountOverride, setQuickLulAmountOverride] = useState<number | null>(null);
  const [quickHouseStyleOverride, setQuickHouseStyleOverride] = useState<
    'plaza_manor' | 'japanese_pavilion' | undefined
  >(undefined);
  const [quickTeleportFocusId, setQuickTeleportFocusId] = useState<CityTransitStationId | null>(
    null,
  );

  useEffect(() => {
    setActiveTab('sesi_chat');
    setExchangeQuickMode(null);
    setQuickSwapNearOverride(null);
    setQuickLulAmountOverride(null);
    setQuickHouseStyleOverride(undefined);
    setQuickTeleportFocusId(null);
  }, [activeModalMode, merchantLocation, npcOpenSeq]);

  useEffect(() => {
    const onOpenMerchantResetTab = () => {
      setActiveTab('sesi_chat');
      setExchangeQuickMode(null);
      setQuickSwapNearOverride(null);
      setQuickLulAmountOverride(null);
      setQuickHouseStyleOverride(undefined);
      setQuickTeleportFocusId(null);
    };
    window.addEventListener('open-npc-merchant-ui', onOpenMerchantResetTab);
    return () => window.removeEventListener('open-npc-merchant-ui', onOpenMerchantResetTab);
  }, []);

  useNpcPortraitVersion();

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

  const buildInitialNpcGreeting = (): string => {
    const locLabel = merchantLocation === 'lobby_cafe' ? 'Central Plaza' : 'Beachfront Harbor';
    const displayCitizen = citizenDisplayName?.trim() || 'Buddy';
    if (merchantLocation === 'lobby_cafe' && hanaPitchOrigin && !hasHouseOwnership) {
      return `Hi ${displayCitizen}, I'm Hana \u2014 the city's property & housing agent, and your guide around town. I help citizens find their homes and exchange currency. It looks like you don't own any property in this city yet. Would you like a place to call your own? Browse the property catalog whenever you are ready \u2014 or step inside our model house first and see what your future home could look like. You can also ask me anything at all \u2014 about the game or anything else on your mind!`;
    }
    if (
      merchantLocation === 'lobby_cafe' &&
      walletConnected &&
      !hanaWelcomeNearClaimed
    ) {
      return `Welcome to ${locLabel}, ${displayCitizen}! I'm Hana \u2014 the city's property & housing agent and your city guide. I welcome new citizens, handle home purchases, and help with currency exchange. Claim your starter pack below (0.30 NEAR + 100 LUL + 20 CYON) to get started. Ask me anything at all \u2014 about Cerria or any topic you want!`;
    }
    if (!walletConnected && merchantLocation === 'beach_house') {
      return `Ahoy! I'm Kai \u2014 a fisherman and the keeper of this beach. I run the fish market here at ${locLabel}: I buy your catches, sell tackle, and trade Fish NFTs. You are in Guest Mode, but you can still sell me your raw catches for LUL right here in chat \u2014 and ask me anything at all, whether about fishing or anything else!`;
    }
    if (!walletConnected) {
      return `Hi there, I'm Hana \u2014 the city's property & housing agent and city guide. I help citizens find homes, browse the property catalog, and exchange currency. You are in Guest Mode, so trading unlocks after you sign in \u2014 but looking around is free, and you can ask me anything at all right here in chat!`;
    }
    if (merchantLocation === 'beach_house') {
      return `Ahoy, ${displayCitizen}! I'm Kai \u2014 a fisherman and the keeper of this beach. I run the fish market here at ${locLabel}: I buy your catches, sell tackle, and trade Fish NFTs. Show me what you caught \u2014 and feel free to ask me anything at all, about the ocean, the market, or anything on your mind!`;
    }
    return `Welcome back, ${displayCitizen} \u2014 Hana here, your property & housing agent and city guide. City homes, the catalog, and currency exchange are my desk \u2014 ask me anything at all, about the city or any topic you are curious about!`;
  };

  const resetChatToGreeting = () => {
    setNpcFullText(buildInitialNpcGreeting());
    setNpcTypedText('');
    setActivePropertyOfferBoth(
      merchantLocation === 'lobby_cafe' && Boolean(hanaPitchOrigin) && !hasHouseOwnership
        ? { lang: 'en' }
        : null,
    );
    setLastPlayerMessage('');
    setChatHistory([]);
    setExchangeQuickMode(null);
    setQuickSwapNearOverride(null);
    setQuickLulAmountOverride(null);
    setQuickHouseStyleOverride(undefined);
    setQuickTeleportFocusId(null);
    setIsNpcThinking(false);
    activeNpcRequestIdRef.current += 1;
  };

  // Initial greeting when NPC modal opens
  useEffect(() => {
    if (activeModalMode === 'npc_merchant') {
      setActiveTab('sesi_chat');
      resetChatToGreeting();
    }
  }, [
    activeModalMode,
    merchantLocation,
    npcOpenSeq,
    walletConnected,
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

  /* Hana in-bubble property offer template. Only attached to Hana's chat bubble
   * when the player opens Hana specifically from a property/kiosk pitch or when
   * the player asks about houses/homes in chat. */
  const [activePropertyOffer, setActivePropertyOffer] = useState<{ lang: 'en' | 'id' } | null>(
    null,
  );
  const activePropertyOfferRef = useRef<{ lang: 'en' | 'id' } | null>(null);
  const setActivePropertyOfferBoth = (next: { lang: 'en' | 'id' } | null) => {
    activePropertyOfferRef.current = next;
    setActivePropertyOffer(next);
  };
  const dismissHistoryPropertyOffer = (entryId: string) => {
    setChatHistory((prev) =>
      prev.map((entry) =>
        entry.id === entryId && entry.propertyOffer
          ? { ...entry, propertyOffer: { ...entry.propertyOffer, dismissed: true } }
          : entry,
      ),
    );
  };
  const openPitchCatalog = () => {
    soundEngine.playUiClick();
    onClose();
    if (onOpenExternalCatalog) {
      onOpenExternalCatalog('house');
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('open-realestate-catalog-modal', { detail: { tab: 'house' } }),
      );
    }
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

  const handleClearChat = () => {
    soundEngine.playUiClick();
    if (!tradeBusy && tradePhaseRef.current !== null) {
      endTrade();
      setTradeDoneInfo(null);
    }
    resetChatToGreeting();
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
    const prevPropertyOffer = activePropertyOfferRef.current;
    setLastPlayerMessage(text);
    setActiveTab('sesi_chat');

    const priorTurns = prevNpcMsg
      ? [
          ...chatHistory,
          {
            id: `npc-${Date.now()}-prev`,
            role: 'npc' as const,
            text: prevNpcMsg,
            ...(prevPropertyOffer ? { propertyOffer: prevPropertyOffer } : {}),
          },
        ]
      : [...chatHistory];
    const nextHistory = [
      ...priorTurns.slice(-14),
      { id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, role: 'player' as const, text },
    ];
    setChatHistory(nextHistory);

    const housingOfferLang = detectHousingPromptLang(text);
    const shouldOfferHomeInBubble =
      merchantLocation === 'lobby_cafe' &&
      !hasHouseOwnership &&
      isHanaHousingTopicQuery(text);
    setActivePropertyOfferBoth(shouldOfferHomeInBubble ? { lang: housingOfferLang } : null);

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
        id: item.id,
        name: item.name,
        category: item.category,
        currency: item.currency,
        buyPrice: p.buyPrice,
        stock: p.stock,
      };
    });

    const localTxIntent =
      merchantLocation === 'beach_house' && tradePhaseRef.current === 'offering'
        ? null
        : parseNpcChatTransactionIntent(text, merchantLocation);

    const resolveAndOpenChatTx = (
      aiAction: NpcAgentChatAction | null | undefined,
    ): NpcChatTransactionIntent | null => {
      if (merchantLocation === 'beach_house' && tradePhaseRef.current === 'offering') {
        return null;
      }
      let mapped: NpcChatTransactionIntent | null = null;
      if (aiAction) {
        switch (aiAction.type) {
          case 'exchange_lul_cyon':
            mapped = {
              kind: 'exchange_lul_cyon',
              suggestedLulAmount:
                typeof aiAction.amount === 'number' && aiAction.amount > 0
                  ? Math.floor(aiAction.amount)
                  : null,
            };
            break;
          case 'swap_near_respite':
            mapped = {
              kind: 'swap_near_respite',
              suggestedNearAmount:
                typeof aiAction.amount === 'number' && aiAction.amount > 0
                  ? aiAction.amount
                  : null,
            };
            break;
          case 'buy_house':
            mapped = { kind: 'buy_house', style: aiAction.style };
            break;
          case 'buy_catalog_item': {
            const validId =
              typeof aiAction.itemId === 'string'
                ? MERCHANT_CATALOG_ITEMS.find(
                    (it) => it.id === aiAction.itemId!.trim().toLowerCase(),
                  )?.id
                : undefined;
            mapped = validId ? { kind: 'buy_catalog_item', itemId: validId } : null;
            break;
          }
          case 'browse_catalog':
            mapped = {
              kind: 'browse_catalog',
              scope:
                aiAction.scope ??
                (merchantLocation === 'beach_house' ? 'fishing_gear' : 'furniture'),
            };
            break;
          case 'invest_shop':
            mapped = { kind: 'invest_shop' };
            break;
          case 'claim_welcome':
            mapped = { kind: 'claim_welcome' };
            break;
          case 'teleport_places':
            mapped = {
              kind: 'teleport_places',
              focusStationId: aiAction.focusStationId ?? null,
            };
            break;
        }
      }
      const resolved = mapped ?? localTxIntent;
      if (!resolved) return null;
      if (resolved.kind === 'browse_catalog') {
        if (merchantLocation === 'lobby_cafe') {
          if (resolved.scope === 'house' && !hasHouseOwnership) {
            setActivePropertyOfferBoth({ lang: housingOfferLang });
            return resolved;
          }
          onClose();
          const targetTab = resolved.scope === 'house' ? 'house' : 'furniture';
          if (onOpenExternalCatalog) {
            onOpenExternalCatalog(targetTab);
          } else if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('open-realestate-catalog-modal', { detail: { tab: targetTab } }),
            );
          }
          return resolved;
        }
        setActiveTab('transaksi');
        setExchangeQuickMode('fishing_gear');
        return resolved;
      }
      if (resolved.kind === 'exchange_lul_cyon') {
        setQuickLulAmountOverride(resolved.suggestedLulAmount ?? null);
        setActiveTab('transaksi');
        setExchangeQuickMode('exchange_lul');
      } else if (resolved.kind === 'swap_near_respite') {
        setQuickSwapNearOverride(resolved.suggestedNearAmount ?? null);
        setActiveTab('transaksi');
        setExchangeQuickMode('swap_near');
      } else if (resolved.kind === 'buy_house') {
        if (merchantLocation === 'lobby_cafe' && !hasHouseOwnership) {
          setActivePropertyOfferBoth({ lang: housingOfferLang });
          return resolved;
        }
        setQuickHouseStyleOverride(resolved.style);
        setActiveTab('transaksi');
        setExchangeQuickMode('buy_house');
      } else if (resolved.kind === 'buy_catalog_item') {
        setActiveTab('transaksi');
        setExchangeQuickMode(merchantLocation === 'beach_house' ? 'fishing_gear' : 'quick_shop');
      } else if (resolved.kind === 'teleport_places') {
        setActivePropertyOfferBoth(null);
        setQuickTeleportFocusId(resolved.focusStationId ?? null);
        setActiveTab('transaksi');
        setExchangeQuickMode('teleport');
      }
      return resolved;
    };

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

    const activeNpcId: NpcId = merchantLocation === 'beach_house' ? 'kai' : 'hana';
    const isKaiTradeNegotiating =
      merchantLocation === 'beach_house' &&
      tradePhaseRef.current === 'offering' &&
      Boolean(tradeSessionRef.current);
    const isMerchantTransactionQuery =
      isKaiTradeNegotiating ||
      Boolean(localTxIntent) ||
      (merchantLocation === 'lobby_cafe' && isHanaHousingTopicQuery(text));

    void (async () => {
      if (!isMerchantTransactionQuery) {
        const closenessStore = npcClosenessStore ?? createEmptyNpcClosenessStore();
        const chatResult = await sendNpcChatMessage({
          npcId: activeNpcId,
          message: text,
          history: nextHistory.slice(-10).map((h) => ({ role: h.role, text: h.text })),
          closenessBand: getNpcClosenessBand(closenessStore, activeNpcId),
          canLongConversation: canLongConversation(closenessStore, activeNpcId),
          playerName: citizenDisplayName || undefined,
        });
        if (activeNpcRequestIdRef.current !== reqId) return;
        setIsNpcThinking(false);
        onNpcConversationTurn?.(activeNpcId, chatResult.closenessDelta, chatResult.emotion);
        triggerNpcSpeech(chatResult.ok && chatResult.reply.trim() ? chatResult.reply.trim() : fallbackReply());
        window.setTimeout(() => {
          chatScrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 40);
        return;
      }

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
          action?: NpcAgentChatAction | null;
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
          if (!move) {
            resolveAndOpenChatTx(data.action);
          }
          onNpcConversationTurn?.(activeNpcId, 1, 'happy');
          triggerNpcSpeech(data.reply.trim());
        } else {
          const resolved = resolveAndOpenChatTx(null);
          triggerNpcSpeech(
            resolved
              ? buildOfflineChatTransactionAck(resolved, text, merchantLocation, marketState)
              : fallbackReply(),
          );
        }
      } catch {
        if (activeNpcRequestIdRef.current !== reqId) return;
        setIsNpcThinking(false);
        const resolved = resolveAndOpenChatTx(null);
        triggerNpcSpeech(
          resolved
            ? buildOfflineChatTransactionAck(resolved, text, merchantLocation, marketState)
            : fallbackReply(),
        );
      }
      window.setTimeout(() => {
        chatScrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 40);
    })();
  };

  // Receive player chat messages submitted via the unified bottom-left chat bar.
  // Ref keeps the latest submitPlayerQuestion closure across multi-turn chats.
  const submitPlayerQuestionRef = useRef(submitPlayerQuestion);
  submitPlayerQuestionRef.current = submitPlayerQuestion;

  useEffect(() => {
    if (activeModalMode !== 'npc_merchant') return;
    const onUserChat = (ev: Event) => {
      const text = (ev as CustomEvent<{ text?: string }>).detail?.text?.trim();
      if (!text) return;
      submitPlayerQuestionRef.current(text);
    };
    window.addEventListener('npc-merchant-user-chat', onUserChat);
    return () => window.removeEventListener('npc-merchant-user-chat', onUserChat);
  }, [activeModalMode]);

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
        {/* TOP BAR: Clean Frosted Architectural Studio Bar */}
        <header className="fixed top-0 inset-x-0 h-14 bg-white/95 text-slate-900 border-b border-slate-200/80 shadow-sm px-4 sm:px-6 flex items-center justify-between pointer-events-auto z-50">
          <div className="flex items-center gap-2.5">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold border ${
                isSampleHouseView
                  ? 'bg-sky-100 text-sky-700 border-sky-200/80'
                  : 'bg-emerald-100 text-emerald-700 border-emerald-200/80'
              }`}
            >
              {isSampleHouseView ? 'Showcase' : 'Interior'}
            </span>
            <div className="flex flex-col">
              <span className="text-xs sm:text-[13px] font-bold tracking-tight text-slate-900 leading-tight">
                {isSampleHouseView
                  ? 'Model House · Showcase Estate (View Only)'
                  : 'Private House · Decorative Mode'}
              </span>
              <span className="text-[10px] font-medium text-slate-500 hidden md:inline">
                {isSampleHouseView
                  ? 'Open showcase house for all citizens · Architecture & furniture preview (view only)'
                  : 'Drag furniture to place (10cm snap) · Drag floor to orbit camera · Scroll to zoom'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100/90 border border-slate-200/80 text-[10.5px] font-medium">
              <span className="text-slate-500">Mood:</span>
              <span className="text-emerald-700 font-semibold capitalize">{moodEval.dominantMood}</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500">Solar time:</span>
              <span className="text-amber-600 font-semibold font-mono">{formatDaylightHour(daylightHour)}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                dispatchHouseStudioPatch({ resetCamera: true });
              }}
              className="px-3 py-1.5 rounded-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 shadow-xs text-[11px] font-semibold cursor-pointer transition-colors"
            >
              Reset camera
            </button>

            <button
              type="button"
              data-house-exit-btn="true"
              onClick={() => {
                soundEngine.playUiClick();
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-xs text-[11px] font-semibold cursor-pointer transition-colors"
            >
              {isSampleHouseView ? 'Exit Showcase House [ESC]' : 'Done Editing [ESC]'}
            </button>
          </div>
        </header>

        {isSampleHouseView ? (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto rounded-[24px] bg-white/95 text-slate-900 border border-white/80 shadow-[0_20px_50px_rgba(15,23,42,0.22)] px-6 py-4 z-50 text-center max-w-lg space-y-1.5">
            <div className="text-xs font-bold text-sky-600">
              Model House · Showcase Estate (View Only)
            </div>
            <div className="text-[11px] font-medium text-slate-600 leading-relaxed">
              This showcase residence is open for all citizens to tour. Editing is disabled here. To own and decorate your own Private House, purchase a House Deed at the Plot Kiosk or Hana&apos;s Catalog.
            </div>
          </div>
        ) : (
        /* BOTTOM DOCK: Consolidated Tabbed Studio Bento Console */
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[96vw] max-w-4xl pointer-events-auto rounded-[24px] bg-[#e8ecf2]/96 border border-white/80 shadow-[0_24px_64px_rgba(15,23,42,0.26)] p-3.5 text-slate-900 z-50">
          {/* Dock Header & Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-300/60">
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'furniture', label: `Furniture (${ownedFurniture.length})` },
                  { id: 'materials', label: 'Themes & Finishes' },
                  { id: 'lighting', label: 'Lighting & Mood' },
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
                  className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer transition-all ${
                    studioDockTab === tab.id
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'bg-white/90 hover:bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Selected 3D Item Controls */}
            {selectedCatalogItem && (
              <div className="flex items-center gap-1.5 rounded-full bg-white/95 text-slate-900 px-3 py-1 border border-slate-200/80 shadow-xs">
                <span className="text-[10.5px] font-semibold text-sky-600 truncate max-w-[150px]">
                  Selected: {selectedCatalogItem.name}
                </span>
                <button
                  type="button"
                  data-rotate-3d-furniture="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    dispatchHouseStudioPatch({ rotateSelectedDelta: 1 });
                  }}
                  className="px-2.5 py-0.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-semibold cursor-pointer transition-colors"
                >
                  Rotate +45°
                </button>
                <button
                  type="button"
                  data-remove-3d-furniture="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    dispatchHouseStudioPatch({ removeSelected: true });
                  }}
                  className="px-2.5 py-0.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-semibold cursor-pointer transition-colors"
                >
                  Store
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
                      className="px-2.5 py-0.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-semibold cursor-pointer transition-colors"
                    >
                      ✓ Confirm move
                    </button>
                    <button
                      type="button"
                      data-cancel-furniture-move="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setFurnitureMovePending(false);
                        dispatchHouseStudioPatch({ cancelFurnitureMove: true });
                      }}
                      className="px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold cursor-pointer transition-colors"
                    >
                      ✕ Cancel
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* TAB 1: FURNITURE CATALOG */}
          {studioDockTab === 'furniture' && (
            <div className="pt-3">
              {ownedFurniture.length === 0 ? (
                <div className="py-5 rounded-2xl bg-white/80 border border-dashed border-slate-300 text-center text-xs font-medium text-slate-500 flex items-center justify-center gap-2">
                  <Sofa className="w-4 h-4 text-slate-400" aria-hidden="true" />
                  <span>No furniture yet — check Hana&apos;s Catalog</span>
                </div>
              ) : (
                <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1">
                  {ownedFurniture.map((item) => (
                    <div
                      key={item.id}
                      className="w-[152px] p-2 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between gap-2 shrink-0"
                    >
                      <div className="relative rounded-xl overflow-hidden bg-slate-50">
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
                          className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full text-[8.5px] font-semibold z-20 ${
                            item.isNft
                              ? 'bg-sky-100/95 text-sky-700 border border-sky-200/80'
                              : 'bg-emerald-100/95 text-emerald-700 border border-emerald-200/80'
                          }`}
                        >
                          {item.isNft ? 'NFT' : 'CYON'}
                        </span>
                      </div>
                      <div className="text-[10.5px] font-semibold text-slate-800 truncate px-0.5">
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
                            className={`w-full py-1.5 rounded-full text-[10px] font-semibold inline-flex items-center justify-center gap-1 transition-colors ${
                              inBag > 0
                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs cursor-pointer'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            <Plus className="w-3 h-3" aria-hidden="true" />
                            <span>{inBag > 0 ? `Place · ${inBag} in bag` : 'All placed'}</span>
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
            <div className="pt-3 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[168px] overflow-y-auto">
              {/* Architecture Themes */}
              <div className="p-3 rounded-2xl bg-white border border-slate-200/70 shadow-sm space-y-2">
                <div className="text-[11px] font-semibold text-slate-600">
                  House theme
                </div>
                <div className="grid grid-cols-1 gap-1.5">
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
                        className={`px-3 py-2 rounded-xl border flex items-center justify-between text-left cursor-pointer transition-all ${
                          isActive
                            ? 'bg-sky-50 border-sky-300 ring-1 ring-sky-200'
                            : 'bg-slate-50/80 hover:bg-slate-100 border-slate-200/80'
                        }`}
                      >
                        <span className="text-xs font-semibold text-slate-900 truncate">{th.name}</span>
                        <span
                          className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                            isActive
                              ? 'bg-sky-500 text-white'
                              : 'bg-white text-slate-600 border border-slate-200/80'
                          }`}
                        >
                          {isActive ? 'Active' : 'Apply'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Surface Finish Swatches */}
              <div className="p-3 rounded-2xl bg-white border border-slate-200/70 shadow-sm space-y-2">
                <div className="text-[11px] font-semibold text-slate-600">
                  Floor &amp; wall finish
                </div>
                <div className="grid grid-cols-2 gap-1.5">
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
                          className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-2 text-left cursor-pointer transition-all ${
                            isCurrent
                              ? 'bg-sky-50 text-sky-900 border-sky-400 ring-1 ring-sky-200 font-semibold'
                              : 'bg-slate-50/80 hover:bg-white text-slate-700 border-slate-200/80'
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full border border-slate-300/80 shadow-xs shrink-0"
                            style={{ backgroundColor: sw.colorHex }}
                          />
                          <span className="text-[10.5px] font-medium truncate">{sw.name}</span>
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
            <div className="pt-3 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[168px] overflow-y-auto">
              {/* Daylight Time Slider & Solar Presets */}
              <div className="p-3 rounded-2xl bg-white border border-slate-200/70 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-600">
                    Daylight solar arc
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 font-mono text-[11px] font-semibold">
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
                  className="w-full accent-sky-500 cursor-pointer"
                />
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { label: 'Morning 07:36', h: 7.6 },
                      { label: 'Noon 12:48', h: 12.8 },
                      { label: 'Evening 18:30', h: 18.5 },
                      { label: 'Night 22:12', h: 22.2 },
                    ] as const
                  ).map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        handleChangeDaylightHour(preset.h);
                      }}
                      className={`py-1.5 px-2 rounded-xl border text-[10px] font-semibold cursor-pointer transition-all ${
                        Math.abs(daylightHour - preset.h) < 0.4
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/80'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mood Meter & Softmax bars */}
              <div className="p-3 rounded-2xl bg-white border border-slate-200/70 shadow-sm space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-700">
                    Room mood
                  </span>
                  <div className="flex items-center gap-1">
                    {(['cozy', 'bright', 'moody'] as const).map((mId) => (
                      <button
                        key={mId}
                        type="button"
                        onClick={() => handleApplyMoodPreset(mId)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold capitalize cursor-pointer transition-colors ${
                          moodEval.dominantMood === mId
                            ? 'bg-sky-500 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {mId}
                      </button>
                    ))}
                  </div>
                </div>
                {(
                  [
                    { key: 'cozy', label: 'Cozy', pct: moodEval.cozyPct, barCol: '#f59e0b' },
                    { key: 'bright', label: 'Bright', pct: moodEval.brightPct, barCol: '#0ea5e9' },
                    { key: 'moody', label: 'Moody', pct: moodEval.moodyPct, barCol: '#8b5cf6' },
                  ] as const
                ).map((row) => (
                  <div key={row.key} className="space-y-1">
                    <div className="flex justify-between text-[10.5px] font-semibold text-slate-600">
                      <span>{row.label}</span>
                      <span className="text-slate-900">{row.pct}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
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

  const chatTxSharedProps: ChatTxSharedProps = {
    merchantLocation,
    marketState,
    lulBalance,
    cyonBalance,
    respiteBalance,
    nearTestnetBalance,
    walletConnected,
    hasHouseOwnership,
    hanaWelcomeNearClaimed: Boolean(hanaWelcomeNearClaimed || hanaClaimResult?.ok),
    ownedItemIds,
    playerNearAccount,
    houseArchitectureStyle,
    ownedHouseStyle,
    onChainHouseStyleLocked,
    onSelectHouseArchitectureStyle,
    onConnectWallet,
    onViewModelHouse,
    onEnterOwnHouse,
    onExchangeLulToCyon,
    onSwapNearAndRespite,
    onInvestInMerchant,
    onBuyMerchantItem,
    onSellMerchantItem,
    onBuyHouseWithRespite,
    onClaimHanaWelcomeNear: onClaimHanaWelcomeNear
      ? async () => {
          const claimRes = await onClaimHanaWelcomeNear();
          if (claimRes.ok) {
            setHanaClaimResult(claimRes);
          }
          return claimRes;
        }
      : undefined,
    onInspectFurniture: (item) => {
      const quote = evaluateMerchantItemQuote(marketState, item);
      const isOwned = ownedItemIds.includes(item.id);
      const bal = item.currency === 'CYON' ? cyonBalance : respiteBalance;
      const needsHouse = item.category === 'nft_collector_furniture' && !hasHouseOwnership;
      const canBuy =
        walletConnected &&
        quote.stock > 0 &&
        bal >= quote.buyPrice &&
        !needsHouse &&
        (!isOwned || Boolean(item.interiorSlot));
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
          if (buyRes.ok) {
            triggerNpcSpeech(`Bought ${item.name} (${quote.buyPrice} ${item.currency}).`);
          }
        },
      });
    },
    onTeleportToDestination,
    onNotifySpeech: triggerNpcSpeech,
  };

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
        data-chat-glass-modal="true"
        className={`fixed inset-x-2.5 sm:inset-x-auto sm:left-4 top-[max(0.5rem,var(--safe-top))] sm:top-14 bottom-[calc(64px+var(--safe-bottom))] sm:bottom-[76px] my-auto z-40 sm:w-[356px] max-w-[400px] mx-auto sm:mx-0 max-h-[min(620px,calc(100dvh-4.75rem))] flex flex-col select-none transition-transform duration-200 ease-out transform ${
          isNpcOpen
            ? 'translate-x-0 visible pointer-events-auto'
            : '-translate-x-[120%] invisible pointer-events-none'
        }`}
      >
      <div className="relative flex-1 flex flex-col rounded-[32px] bg-gradient-to-b from-[#171d2c]/86 via-[#111622]/84 to-[#0c101a]/88 border border-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_24px_70px_rgba(0,0,0,0.58)] text-white overflow-hidden min-h-0">
        {/* Top Status Strip: BLITZ OS + Close Icon (replaces expand button) */}
        <div className="shrink-0 flex items-center justify-between text-[10.5px] font-medium px-4 pt-3 pb-1.5 text-white/90">
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3 h-3 text-white/85" aria-hidden="true" />
            <span className="tracking-wide font-semibold">CERRIA OS</span>
          </div>
          <button
            type="button"
            data-gold-exchange-close="true"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            className="w-6 h-6 rounded-full flex items-center justify-center border bg-white/12 hover:bg-rose-500/35 border-white/20 text-white/90 hover:text-white cursor-pointer active:scale-90 transition-all shrink-0"
            aria-label="Close NPC Dialogue"
            title="Close"
          >
            <X className="w-3.5 h-3.5 stroke-[2.3]" aria-hidden="true" />
          </button>
        </div>

        {/* Active Chat Person Header */}
        <div className="shrink-0 flex items-center justify-between gap-2.5 px-3.5 py-2 border-b border-white/12">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={resolveNpcPhotoUrl(npcShortName === 'HANA' ? 'npc_hana' : 'npc_kai', 'avatar')}
              alt={npcShortName === 'HANA' ? 'Hana' : 'Kai'}
              draggable={false}
              className="w-8 h-8 rounded-full object-cover object-center ring-1 ring-white/25 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-xs font-bold text-white leading-tight truncate">
                {npcShortName === 'HANA' ? 'Hana' : 'Kai'}
              </div>
              <div className="text-[10px] text-white/65 leading-tight truncate">
                {merchantLocation === 'lobby_cafe'
                  ? 'Central Plaza · Property & Exchange'
                  : 'Beachfront Harbor · Fish Market'}
              </div>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)] shrink-0" />
        </div>

        {/* Compact Dark Glass Navigation Tabs */}
        <div className="shrink-0 flex items-center gap-1.5 flex-wrap px-3.5 py-2 border-b border-white/10 [&_button:disabled]:opacity-40 [&_button:disabled]:cursor-not-allowed">
          <button
            type="button"
            data-gold-exchange-balance="true"
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
            <span>Chat Session</span>
          </button>

          <button
            type="button"
            data-merchant-exchange-tab="true"
            onClick={() => {
              soundEngine.playUiClick();
              if (activeTab === 'transaksi' && exchangeQuickMode !== null) {
                setExchangeQuickMode(null);
              } else {
                setActiveTab('transaksi');
              }
            }}
            className={`px-3 py-1 rounded-full text-[10.5px] font-semibold cursor-pointer transition-all ${
              activeTab === 'transaksi'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-white/10 hover:bg-white/18 text-white/75 hover:text-white border border-white/10'
            }`}
          >
            <span>
              {exchangeQuickMode ? EXCHANGE_QUICK_MODE_LABELS[exchangeQuickMode] : 'Exchange'}
            </span>
          </button>

          {merchantLocation === 'beach_house' && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                setActiveTab('katalog');
              }}
              className={`px-3 py-1 rounded-full text-[10.5px] font-semibold cursor-pointer transition-all ${
                activeTab === 'katalog'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'bg-white/10 hover:bg-white/18 text-white/75 hover:text-white border border-white/10'
              }`}
            >
              <span>Catalog</span>
            </button>
          )}

          {merchantLocation === 'beach_house' && (
            <button
              type="button"
              data-fish-market-tab="true"
              onClick={() => {
                soundEngine.playUiClick();
                setActiveTab('fish_market');
              }}
              className={`px-3 py-1 rounded-full text-[10.5px] font-semibold cursor-pointer transition-all ${
                activeTab === 'fish_market'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-white/10 hover:bg-white/18 text-white/75 hover:text-white border border-white/10'
              }`}
            >
              <span>Fish ({caughtFishBucket.length})</span>
            </button>
          )}

          {onGiveNpcOwnedGift && (
            <button
              type="button"
              data-merchant-gift-tab="true"
              onClick={() => {
                soundEngine.playUiClick();
                setActiveTab('gift');
              }}
              className={`px-3 py-1 rounded-full text-[10.5px] font-semibold cursor-pointer inline-flex items-center gap-1 transition-all ${
                activeTab === 'gift'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-white/10 hover:bg-white/18 text-white/75 hover:text-white border border-white/10'
              }`}
            >
              <Gift className="w-3 h-3" aria-hidden="true" />
              <span>Gift</span>
            </button>
          )}
        </div>

        {/* Tab Content Viewport (No bottom footer) */}
        <div className="flex-1 flex flex-col overflow-y-auto px-3.5 py-3 space-y-3 min-h-0 bg-transparent">
          {/* ===============================================================
              TAB 1: LIVE CHAT SESSION (Interactive Game Concierge)
             =============================================================== */}
          {activeTab === 'sesi_chat' && (
            <div className="flex-1 flex flex-col justify-between gap-2.5 min-h-0">
              {/* Scrollable Conversation Thread */}
              <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
                {(() => {
                  const renderInBubblePropertyOffer = (
                    lang: 'en' | 'id',
                    onDismiss?: () => void,
                  ) => {
                    const isId = lang === 'id';
                    return (
                      <div
                        data-hana-property-pitch="true"
                        className="mt-2.5 pt-2.5 border-t border-slate-300/75 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-700">
                            <Home className="w-3.5 h-3.5 text-sky-600 shrink-0" aria-hidden="true" />
                            <span>{isId ? 'Rumah Pertamamu' : 'Your First Home'}</span>
                          </span>
                          {onDismiss && (
                            <button
                              type="button"
                              aria-label="Dismiss property offer for now"
                              onClick={() => {
                                soundEngine.playUiClick();
                                onDismiss();
                              }}
                              className="w-5 h-5 rounded-full bg-slate-200/85 hover:bg-rose-100 text-slate-500 hover:text-rose-600 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                            >
                              <X className="w-3 h-3" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] leading-snug text-slate-600">
                          {isId
                            ? 'Kamu bisa lihat isi Model House secara gratis dulu, atau buka Catalog untuk melihat pilihan rumah & harga (100 RESPITE).'
                            : 'Tour the open Model House for free first, or open the Catalog to compare home styles & prices (100 RESPITE).'}
                        </p>
                        <div
                          className={`grid gap-1.5 ${onViewModelHouse ? 'grid-cols-2' : 'grid-cols-1'}`}
                        >
                          {onViewModelHouse && (
                            <button
                              type="button"
                              data-hana-view-model-house-btn="true"
                              onClick={() => {
                                soundEngine.playUiClick();
                                onViewModelHouse();
                              }}
                              className="py-1.5 px-2.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs font-semibold text-[10.5px] cursor-pointer active:scale-[0.99] transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                            >
                              <Eye className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>Model House</span>
                            </button>
                          )}
                          <button
                            type="button"
                            data-hana-view-catalog-btn="true"
                            onClick={openPitchCatalog}
                            className="py-1.5 px-2.5 rounded-full bg-white hover:bg-slate-100 text-slate-800 border border-slate-300/90 shadow-xs font-semibold text-[10.5px] cursor-pointer active:scale-[0.99] transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                          >
                            <Store className="w-3.5 h-3.5 shrink-0 text-slate-600" aria-hidden="true" />
                            <span>View Catalog</span>
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
                            className="w-full py-1.5 px-2.5 rounded-full bg-sky-100/90 hover:bg-sky-200/80 text-sky-800 border border-sky-300/80 font-semibold text-[10.5px] cursor-pointer inline-flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" aria-hidden="true" />
                            <span>Open Teleport Kiosk</span>
                          </button>
                        )}
                      </div>
                    );
                  };

                  const showActivePropertyOffer =
                    merchantLocation === 'lobby_cafe' &&
                    !hasHouseOwnership &&
                    !isNpcThinking &&
                    npcFullText.length > 0 &&
                    Boolean(activePropertyOffer);

                  return (
                    <>
                      {chatHistory.map((entry) =>
                        entry.role === 'player' ? (
                          <div key={entry.id} className="flex flex-col items-end">
                            <div className="flex items-center gap-1.5 mb-1 px-1.5">
                              <span className="text-[10px] font-semibold text-white/75">You</span>
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
                                {npcShortName === 'HANA' ? 'Hana' : 'Kai'}
                              </span>
                            </div>
                            <div
                              className={`${
                                entry.propertyOffer &&
                                !entry.propertyOffer.dismissed &&
                                merchantLocation === 'lobby_cafe' &&
                                !hasHouseOwnership
                                  ? 'max-w-[92%]'
                                  : 'max-w-[85%]'
                              } px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-[#eef0f4]/92 text-slate-900 border border-white/80 shadow-sm`}
                            >
                              <p className="text-xs font-medium leading-relaxed text-slate-900">
                                {entry.text}
                              </p>
                              {merchantLocation === 'lobby_cafe' &&
                                !hasHouseOwnership &&
                                entry.propertyOffer &&
                                !entry.propertyOffer.dismissed &&
                                renderInBubblePropertyOffer(entry.propertyOffer.lang, () =>
                                  dismissHistoryPropertyOffer(entry.id),
                                )}
                            </div>
                          </div>
                        ),
                      )}

                      {/* Active NPC Reply Bubble */}
                      <div className="flex flex-col items-start">
                        <div className="flex items-center gap-1.5 mb-1 px-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          <span className="text-[10px] font-semibold text-white/75">
                            {npcShortName === 'HANA' ? 'Hana' : 'Kai'}
                          </span>
                        </div>
                        <div
                          data-npc-chat-bubble="true"
                          className={`${
                            showActivePropertyOffer ? 'max-w-[92%]' : 'max-w-[85%]'
                          } px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-[#eef0f4]/92 text-slate-900 border border-white/80 shadow-sm`}
                        >
                          <p className="text-xs font-medium leading-relaxed text-slate-900">
                            {isNpcThinking ? (
                              <span className="text-slate-500">Typing...</span>
                            ) : (
                              <>
                                {npcTypedText}
                                {npcTypedText.length < npcFullText.length && (
                                  <span className="inline-block w-1.5 h-3.5 rounded-full bg-sky-500 ml-0.5 align-middle animate-pulse" />
                                )}
                              </>
                            )}
                          </p>
                          {showActivePropertyOffer &&
                            activePropertyOffer &&
                            renderInBubblePropertyOffer(activePropertyOffer.lang, () =>
                              setActivePropertyOfferBoth(null),
                            )}
                        </div>
                      </div>
                    </>
                  );
                })()}

                {/* Guest Sign-In Callout (Compact 1-row dark glass card) */}
                {!walletConnected && onConnectWallet && (
                  <div className="px-3 py-2.5 rounded-2xl bg-white/10 text-white border border-white/15 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/85 truncate">
                      <LogIn className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                      <span className="truncate">Sign in to buy &amp; exchange</span>
                    </span>
                    <button
                      type="button"
                      data-chat-guest-register-btn="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        onConnectWallet();
                      }}
                      className="px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white shadow-xs font-semibold text-[10.5px] cursor-pointer transition-colors shrink-0"
                    >
                      Sign in
                    </button>
                  </div>
                )}

                {/* Kai Chat Trade (F1 pilot): one mutating card, buttons only */}
                {merchantLocation === 'beach_house' && !tradePhase &&
                  caughtFishBucket.some((f) => !f.isMintedNft) && (
                    <div
                      data-kai-trade-entry="true"
                      className="p-3.5 rounded-2xl bg-white text-slate-900 border border-slate-200/80 shadow-sm space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-sky-700">
                          {tradeLabels.entryTitle}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-[10px] font-semibold">
                          {tradeCurrency === 'RESPITE' ? 'Paid in RESPITE' : tradeLabels.paidIn}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {tradeLabels.entrySub}
                      </p>
                      <button
                        type="button"
                        data-kai-trade-start-btn="true"
                        onClick={startTradePick}
                        className="w-full py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm font-semibold text-xs cursor-pointer active:scale-[0.99] transition-all"
                      >
                        {tradeLabels.startHaggling}
                      </button>
                    </div>
                  )}

                {merchantLocation === 'beach_house' && tradePhase === 'pick' && (
                  <div
                    data-kai-trade-card="pick"
                    className="p-3.5 rounded-2xl bg-white text-slate-900 border border-slate-200/80 shadow-sm space-y-2.5"
                  >
                    <div className="text-xs font-semibold text-sky-700">
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
                            className="p-2.5 rounded-xl bg-slate-50 hover:bg-sky-50 text-slate-900 border border-slate-200/80 hover:border-sky-300 shadow-xs text-left cursor-pointer transition-all"
                          >
                            <div className="text-xs font-semibold truncate">
                              {fish.speciesName}
                            </div>
                            <div className="text-[10.5px] text-slate-500">
                              {fish.weightKg.toFixed(2)} kg · {fish.rarity}
                            </div>
                          </button>
                        ))}
                    </div>
                    <button
                      type="button"
                      onClick={endTrade}
                      className="w-full py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer transition-colors"
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
                      className="p-3.5 rounded-2xl bg-white text-slate-900 border border-slate-200/80 shadow-sm space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-sky-700 truncate">
                          {tradeFish.speciesName} · {tradeFish.weightKg.toFixed(2)} kg
                        </span>
                        <span className="text-xs font-semibold text-slate-400 shrink-0">
                          {'\u25CF'.repeat(tradeSession.roundsUsed)}
                          {'\u25CB'.repeat(
                            Math.max(0, tradeSession.maxRounds - tradeSession.roundsUsed),
                          )}
                        </span>
                      </div>
                      <div>
                        <div className="text-[10.5px] font-medium text-slate-500">
                          {tradeLabels.offerLabel}
                        </div>
                        <div className="text-2xl font-bold text-slate-900 leading-tight mt-0.5">
                          {tradeSession.currentOffer} {tradeCurrency}
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                            style={{
                              width: `${Math.min(100, Math.round((tradeSession.currentOffer / tradeSession.baseValue) * 100))}%`,
                            }}
                          />
                        </div>
                        <div className="text-[10.5px] font-medium text-slate-500 mt-1.5">
                          {tradeLabels.standardPrice}: {tradeSession.baseValue} {tradeCurrency}
                          {tradeSession.isFinalOffer ? ` · ${tradeLabels.finalOffer}` : ''}
                        </div>
                        <div className="text-[10.5px] italic text-slate-400 mt-0.5">
                          {TRADE_LINES[tradeLang][getTradeReasonKey(tradeSession)]}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          data-kai-trade-accept-btn="true"
                          onClick={doTradeAccept}
                          className="flex-1 py-2 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs font-semibold text-xs cursor-pointer transition-colors"
                        >
                          {tradeLabels.accept}
                        </button>
                        <button
                          type="button"
                          data-kai-trade-raise-btn="true"
                          onClick={doTradeRaise}
                          disabled={tradeSession.isFinalOffer}
                          className="flex-1 py-2 rounded-full bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white shadow-xs font-semibold text-xs cursor-pointer transition-colors"
                        >
                          {tradeLabels.haggle}
                        </button>
                        <button
                          type="button"
                          onClick={doTradeWalkAway}
                          className="flex-1 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer transition-colors"
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
                      className="p-3.5 rounded-2xl bg-emerald-50/90 text-slate-900 border border-emerald-200/80 shadow-sm space-y-2.5"
                    >
                      <div className="text-xs font-bold text-emerald-700">
                        {tradeLabels.deal} · {tradeSession.agreedPrice} {tradeCurrency}
                      </div>
                      <div className="text-xs font-medium text-emerald-800">
                        ✓ {tradeLabels.fishPicked} · ● {tradeLabels.payment}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          data-kai-trade-sell-btn="true"
                          disabled={tradeBusy}
                          onClick={doTradeSell}
                          className="flex-1 py-2 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs font-semibold text-xs cursor-pointer transition-colors"
                        >
                          {tradeLabels.sellNow}
                        </button>
                        <button
                          type="button"
                          onClick={endTrade}
                          className="flex-1 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80 font-semibold text-xs cursor-pointer transition-colors"
                        >
                          {tradeLabels.cancel}
                        </button>
                      </div>
                    </div>
                  )}

                {merchantLocation === 'beach_house' && tradePhase === 'done' && tradeDoneInfo && (
                  <div
                    data-kai-trade-card="done"
                    className="p-3.5 rounded-2xl bg-emerald-50/90 text-slate-900 border border-emerald-200/80 shadow-sm space-y-2.5"
                  >
                    <div className="text-xs font-bold text-emerald-700">
                      ✓ {tradeLabels.sold} · {tradeDoneInfo.name} · +{tradeDoneInfo.price} {tradeDoneInfo.currency}
                    </div>
                    <div className="flex gap-2">
                      {caughtFishBucket.some((f) => !f.isMintedNft) && (
                        <button
                          type="button"
                          onClick={startTradePick}
                          className="flex-1 py-2 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-xs font-semibold text-xs cursor-pointer transition-colors"
                        >
                          {tradeLabels.sellMore}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={endTrade}
                        className="flex-1 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80 font-semibold text-xs cursor-pointer transition-colors"
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
                      className="p-3.5 rounded-2xl bg-white text-slate-900 border border-slate-200/80 shadow-sm space-y-2.5"
                    >
                      <div className="text-xs font-semibold text-sky-700">
                        {tradeLabels.lastOffer} · {tradeSession.currentOffer} {tradeCurrency}
                      </div>
                      <div className="text-[11px] italic text-slate-500">
                        {TRADE_LINES[tradeLang][getTradeReasonKey(tradeSession)]}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={doTradeAccept}
                          className="flex-1 py-2 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs font-semibold text-xs cursor-pointer transition-colors"
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
                          className="flex-1 py-2 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-xs font-semibold text-xs cursor-pointer transition-colors"
                        >
                          {tradeLabels.fishMarket}
                        </button>
                        <button
                          type="button"
                          onClick={endTrade}
                          className="flex-1 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer transition-colors"
                        >
                          {tradeLabels.close}
                        </button>
                      </div>
                    </div>
                  )}

                {/* Hana Welcome Bonus Card */}
                {merchantLocation === 'lobby_cafe' &&
                  walletConnected &&
                  (!hanaWelcomeNearClaimed || hanaClaimResult?.ok) && (
                    <div
                      data-hana-onboarding-tutorial-box="true"
                      className="p-3 rounded-2xl bg-emerald-500/18 text-white border border-emerald-300/35 space-y-2.5"
                    >
                      {!hanaWelcomeNearClaimed && !hanaClaimResult?.ok ? (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-200">
                              <Gift className="w-3.5 h-3.5 text-emerald-300" aria-hidden="true" />
                              <span>Starter Bonus</span>
                            </span>
                            <span className="text-[10.5px] font-semibold text-emerald-200">
                              0.30 NEAR
                            </span>
                          </div>
                          {hanaClaimResult?.error && (
                            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-200 border border-rose-400/35 text-[11px] font-medium">
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
                                    `${res.amountNear.toFixed(2)} NEAR + 100 LUL + 20 CYON added! Feel free to explore the city or ask me anything.`,
                                  );
                                } else {
                                  soundEngine.playHit();
                                }
                              } finally {
                                setIsClaimingHanaNear(false);
                              }
                            }}
                            className={`w-full py-2 rounded-full font-semibold text-xs shadow-xs transition-all ${
                              isClaimingHanaNear
                                ? 'bg-white/15 text-white/55 cursor-wait'
                                : 'bg-emerald-500 hover:bg-emerald-400 text-white cursor-pointer active:scale-[0.99]'
                            }`}
                          >
                            {isClaimingHanaNear ? 'Claiming...' : 'Claim Starter Pack'}
                          </button>
                        </>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-xs font-medium text-emerald-200">
                            <span>Starter pack added: 0.30 NEAR + 100 LUL + 20 CYON.</span>
                            {hanaClaimResult?.txHash && (
                              <a
                                href={
                                  hanaClaimResult.explorerUrl ||
                                  getNearBlocksTxUrl(hanaClaimResult.txHash, 'testnet')
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sky-300 hover:text-sky-200 underline font-mono text-[11px]"
                              >
                                Receipt
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                <div ref={chatScrollEndRef} />
              </div>

              {/* Quick Question Chips + Togetherness Actions (plain English, zero closeness UI) + Clear Chat */}
              <div className="pt-2 border-t border-white/12 shrink-0 space-y-1.5">
                {(() => {
                  const merchantNpcId: NpcId = merchantLocation === 'beach_house' ? 'kai' : 'hana';
                  const closenessStore = npcClosenessStore ?? createEmptyNpcClosenessStore();
                  const showWalk =
                    (canWalkTogether(closenessStore, merchantNpcId) ||
                      npcTogethernessState.walkingNpcId === merchantNpcId) &&
                    Boolean(onToggleNpcWalkTogether);
                  const showPair =
                    (canPairPose(closenessStore, merchantNpcId) ||
                      npcTogethernessState.pairPoseNpcId === merchantNpcId) &&
                    Boolean(onTriggerNpcPairPose);
                  const showRide =
                    (canRideTogether(closenessStore, merchantNpcId) ||
                      npcTogethernessState.ridingNpcId === merchantNpcId) &&
                    Boolean(onToggleNpcRideTogether);
                  if (!showWalk && !showPair && !showRide) return null;
                  return (
                    <div className="space-y-1.5 pb-1 border-b border-white/10" data-merchant-togetherness-actions="true">
                      <div className="flex flex-wrap gap-1.5">
                        {showWalk && onToggleNpcWalkTogether && (
                          <button
                            type="button"
                            data-npc-walk-together-btn="true"
                            onClick={() => {
                              soundEngine.playUiClick();
                              onToggleNpcWalkTogether(merchantNpcId);
                            }}
                            className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold cursor-pointer transition-colors ${
                              npcTogethernessState.walkingNpcId === merchantNpcId
                                ? 'bg-amber-500/30 hover:bg-amber-500/45 text-amber-100 border border-amber-300/45'
                                : 'bg-sky-500/25 hover:bg-sky-500/40 text-sky-100 border border-sky-300/35'
                            }`}
                          >
                            {npcTogethernessState.walkingNpcId === merchantNpcId
                              ? 'End walk'
                              : 'Ask to walk together'}
                          </button>
                        )}
                        {showPair && onTriggerNpcPairPose && (
                          <button
                            type="button"
                            data-npc-pair-pose-btn="true"
                            onClick={() => {
                              soundEngine.playUiClick();
                              if (npcTogethernessState.pairPoseNpcId === merchantNpcId) {
                                setShowMerchantPairPosePicker(false);
                                onTriggerNpcPairPose(merchantNpcId);
                              } else {
                                setShowMerchantPairPosePicker((prev) => !prev);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold cursor-pointer transition-colors ${
                              npcTogethernessState.pairPoseNpcId === merchantNpcId
                                ? 'bg-amber-500/30 hover:bg-amber-500/45 text-amber-100 border border-amber-300/45'
                                : 'bg-violet-500/25 hover:bg-violet-500/40 text-violet-100 border border-violet-300/35'
                            }`}
                          >
                            {npcTogethernessState.pairPoseNpcId === merchantNpcId
                              ? 'Stop photo pose'
                              : 'Take a pair photo'}
                          </button>
                        )}
                        {showRide && onToggleNpcRideTogether && (
                          <button
                            type="button"
                            data-npc-ride-together-btn="true"
                            onClick={() => {
                              soundEngine.playUiClick();
                              onToggleNpcRideTogether(merchantNpcId);
                            }}
                            className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold cursor-pointer transition-colors ${
                              npcTogethernessState.ridingNpcId === merchantNpcId
                                ? 'bg-amber-500/30 hover:bg-amber-500/45 text-amber-100 border border-amber-300/45'
                                : 'bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-100 border border-emerald-300/35'
                            }`}
                          >
                            {npcTogethernessState.ridingNpcId === merchantNpcId
                              ? 'End ride'
                              : 'Ask to ride together'}
                          </button>
                        )}
                      </div>
                      {showMerchantPairPosePicker &&
                        npcTogethernessState.pairPoseNpcId !== merchantNpcId &&
                        onTriggerNpcPairPose && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {CURATED_NPC_PAIR_POSES.map((pose) => (
                              <button
                                key={pose.id}
                                type="button"
                                onClick={() => {
                                  soundEngine.playUiClick();
                                  setShowMerchantPairPosePicker(false);
                                  onTriggerNpcPairPose(merchantNpcId, pose.id);
                                }}
                                className="px-2 py-0.5 rounded-lg bg-white/12 hover:bg-white/22 border border-white/15 text-[10px] font-medium text-white/90 cursor-pointer transition-colors"
                              >
                                {pose.label}
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                  );
                })()}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(
                    [
                      'What is this game?',
                      'What can I do in this game?',
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
                      className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/18 text-white/90 border border-white/12 text-[10.5px] font-medium cursor-pointer transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                  <button
                    type="button"
                    data-chat-clear-btn="true"
                    onClick={handleClearChat}
                    className="ml-auto px-2.5 py-1 rounded-full bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border border-rose-400/30 text-[10px] font-semibold cursor-pointer inline-flex items-center gap-1 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3 h-3" aria-hidden="true" />
                    <span>Clear chat</span>
                  </button>
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

            const respitePerNearRate = RESPITE_NEP141_METADATA.rateRespitePerNear; // 1 NEAR = 400 RESPITE
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
              parsedCryptoInput >= 0.0025 &&
              calculatedCryptoOutput >= 1 &&
              !exceedsKnownSignerBalance;

            return (
              <div className="flex-1 flex flex-col justify-between gap-3 min-h-0">
                <div className="flex-1 overflow-y-auto pr-0.5 space-y-3 min-h-0">
                  {exchangeQuickMode ? (
                    <div
                      data-exchange-quick-panel={exchangeQuickMode}
                      className="p-3.5 rounded-2xl bg-white text-slate-900 border border-slate-200/80 shadow-sm space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                          {exchangeQuickMode === 'teleport' ? (
                            <MapPin className="w-4 h-4 text-sky-500 shrink-0" aria-hidden="true" />
                          ) : exchangeQuickMode === 'buy_house' ? (
                            <Home className="w-4 h-4 text-sky-500 shrink-0" aria-hidden="true" />
                          ) : exchangeQuickMode === 'exchange_lul' ? (
                            <Coins className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />
                          ) : exchangeQuickMode === 'swap_near' ? (
                            <Sparkles className="w-4 h-4 text-violet-500 shrink-0" aria-hidden="true" />
                          ) : (
                            <Store className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />
                          )}
                          <span>{EXCHANGE_QUICK_MODE_LABELS[exchangeQuickMode]}</span>
                        </span>
                        <button
                          type="button"
                          data-exchange-quick-back-btn="true"
                          onClick={() => {
                            soundEngine.playUiClick();
                            setExchangeQuickMode(null);
                          }}
                          aria-label="Back to Exchange"
                          className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold cursor-pointer inline-flex items-center gap-1 transition-colors"
                        >
                          <X className="w-3 h-3" aria-hidden="true" />
                          <span>Exchange</span>
                        </button>
                      </div>

                      {(exchangeQuickMode === 'quick_shop' ||
                        exchangeQuickMode === 'fishing_gear') && (
                        <QuickShopItemsPanel {...chatTxSharedProps} />
                      )}

                      {exchangeQuickMode === 'exchange_lul' && (
                        <InlineExchangePanel
                          marketState={marketState}
                          lulBalance={lulBalance}
                          walletConnected={walletConnected}
                          initialLulAmount={quickLulAmountOverride}
                          onExchangeLulToCyon={onExchangeLulToCyon}
                          onConnectWallet={onConnectWallet}
                          onNotifySpeech={triggerNpcSpeech}
                        />
                      )}

                      {exchangeQuickMode === 'swap_near' && (
                        <InlineSwapNearPanel
                          nearTestnetBalance={nearTestnetBalance}
                          respiteBalance={respiteBalance}
                          walletConnected={walletConnected}
                          playerNearAccount={playerNearAccount}
                          initialNearAmount={quickSwapNearOverride}
                          onSwapNearAndRespite={onSwapNearAndRespite}
                          onConnectWallet={onConnectWallet}
                          onNotifySpeech={triggerNpcSpeech}
                        />
                      )}

                      {exchangeQuickMode === 'buy_house' && (
                        <InlineHouseDealPanel
                          walletConnected={walletConnected}
                          hasHouseOwnership={hasHouseOwnership}
                          respiteBalance={respiteBalance}
                          houseArchitectureStyle={houseArchitectureStyle}
                          ownedHouseStyle={ownedHouseStyle}
                          onChainHouseStyleLocked={onChainHouseStyleLocked}
                          initialStyle={quickHouseStyleOverride}
                          onSelectHouseArchitectureStyle={onSelectHouseArchitectureStyle}
                          onViewModelHouse={onViewModelHouse}
                          onEnterOwnHouse={onEnterOwnHouse}
                          onBuyHouseWithRespite={onBuyHouseWithRespite}
                          onConnectWallet={onConnectWallet}
                          onSwitchToSwapNear={(suggestedNear) => {
                            setQuickSwapNearOverride(suggestedNear);
                            setExchangeQuickMode('swap_near');
                          }}
                          onNotifySpeech={triggerNpcSpeech}
                        />
                      )}

                      {exchangeQuickMode === 'teleport' && (
                        <InlineTeleportPlacesPanel
                          merchantLocation={merchantLocation}
                          focusStationId={quickTeleportFocusId}
                          onTeleportToDestination={onTeleportToDestination}
                        />
                      )}
                    </div>
                  ) : (
                    <>
                {/* Wallet or Sign-In Header */}
                <div className="p-3.5 rounded-2xl bg-white text-slate-900 border border-slate-200/80 shadow-sm flex items-center justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-sky-600">
                      {walletConnected ? 'Your wallet' : 'Sign in required'}
                    </div>
                    <div className="text-xs font-medium text-slate-600 mt-0.5 truncate">
                      {walletConnected
                        ? `${playerNearAccount} · ${respiteBalance.toLocaleString()} RESPITE · ${nearTestnetBalance.toFixed(2)} NEAR`
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
                      className={`px-3.5 py-1.5 rounded-full font-semibold text-[11px] shadow-xs cursor-pointer transition-colors shrink-0 ${
                        walletConnected
                          ? 'bg-sky-500 hover:bg-sky-600 text-white'
                          : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      }`}
                    >
                      <span>{walletConnected ? 'Wallet' : 'Sign in'}</span>
                    </button>
                  )}
                </div>

                {/* Beginner-Friendly Currency Guide */}
                <div className="px-3.5 py-2.5 rounded-2xl bg-white/85 border border-slate-200/70 text-[11px] font-medium text-slate-600 leading-snug">
                  Swap <span className="font-semibold text-violet-600">NEAR -&gt; RESPITE</span> for Houses, NFT Furniture &amp; Fish Market, or{' '}
                  <span className="font-semibold text-sky-600">LUL -&gt; CYON</span> for Fishing Gear &amp; Cafe items.
                </div>

                {marketState.isShopBroke && (
                  <div className="p-3 rounded-2xl bg-amber-50/95 text-amber-950 border border-amber-200/80 shadow-xs flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-medium text-amber-900">
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
                      className={`px-3 py-1.5 rounded-full text-[10.5px] font-semibold shadow-xs transition-colors ${
                        walletConnected && lulBalance >= 300
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      Support (300 LUL)
                    </button>
                  </div>
                )}

                {/* ===========================================================
                    CARD 1: NEAR -> RESPITE SWAP
                   =========================================================== */}
                <div
                  data-near-respite-swap-card="true"
                  className={`rounded-2xl bg-white text-slate-900 border border-slate-200/80 shadow-sm overflow-hidden ${
                    !walletConnected ? 'opacity-65 pointer-events-none select-none' : ''
                  }`}
                >
                  <div className="px-4 py-2.5 bg-violet-50/70 border-b border-slate-200/70 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200/80 text-[10.5px] font-semibold shrink-0">
                        NEAR to RESPITE
                      </span>
                      <span className="text-[10.5px] font-medium text-slate-500">
                        For Houses (100 R) &amp; Fish Market
                      </span>
                    </div>
                    <span className="text-[10.5px] font-semibold text-violet-700">
                      1 NEAR = {respitePerNearRate} RESPITE
                    </span>
                  </div>

                  <div className="p-4 space-y-3">
                    {/* Quick Amount Presets */}
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      {[
                        { near: '0.01', label: '0.01 NEAR' },
                        { near: '0.02', label: '0.02 NEAR' },
                        { near: '0.03', label: '0.03 NEAR' },
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
                            className={`px-2.5 py-1 rounded-full border text-[10px] font-semibold transition-colors ${
                              overBalance
                                ? 'bg-slate-100 text-slate-400 border-slate-200 opacity-50 cursor-not-allowed'
                                : 'bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200/80 cursor-pointer'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Input Row */}
                    <div className="flex items-center gap-2.5 max-w-xs mx-auto">
                      <div
                        className={`w-24 py-2 rounded-xl text-center text-[11px] font-semibold shrink-0 border ${
                          isNearToRespite
                            ? 'bg-sky-50 text-sky-700 border-sky-200/80'
                            : 'bg-violet-50 text-violet-700 border-violet-200/80'
                        }`}
                      >
                        <span>{isNearToRespite ? 'NEAR' : 'RESPITE'}</span>
                      </div>
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        data-near-respite-swap-input="true"
                        value={cryptoSwapInputStr}
                        onChange={(e) => {
                          setCryptoSwapInputStr(e.target.value);
                          setSwapErrorText(null);
                          setLastCryptoSwapReceipt(null);
                        }}
                        className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-50 text-slate-900 font-semibold text-sm border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white"
                      />
                    </div>

                    {/* Middle Label: You will receive */}
                    <div className="text-center text-[11px] font-medium text-slate-400">
                      You will receive
                    </div>

                    {/* Output Row */}
                    <div className="flex items-center gap-2.5 max-w-xs mx-auto">
                      <div
                        className={`w-24 py-2 rounded-xl text-center text-[11px] font-semibold shrink-0 border ${
                          isNearToRespite
                            ? 'bg-violet-50 text-violet-700 border-violet-200/80'
                            : 'bg-sky-50 text-sky-700 border-sky-200/80'
                        }`}
                      >
                        <span>{isNearToRespite ? 'RESPITE' : 'NEAR'}</span>
                      </div>
                      <div
                        data-near-respite-swap-output="true"
                        className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-violet-50/60 text-violet-700 font-bold text-sm border border-violet-200/70"
                      >
                        {calculatedCryptoOutput}
                      </div>
                    </div>

                    {isReadOnlyWallet && (
                      <div className="p-2.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200/80 text-[11px] font-medium text-center">
                        View-only mode is active ({playerNearAccount}). Open Wallet and switch to your own account to swap.
                      </div>
                    )}

                    {exceedsKnownSignerBalance && (
                      <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200/80 text-[11px] font-medium text-center">
                        Not enough NEAR ({nearTestnetBalance.toFixed(2)} NEAR available). Choose a smaller amount.
                      </div>
                    )}

                    {swapErrorText && (
                      <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200/80 text-[11px] font-medium text-center">
                        {swapErrorText}
                      </div>
                    )}
                  </div>

                  {/* Bottom Divider & Swap Submit Button */}
                  <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3 flex items-center justify-center gap-3 flex-wrap">
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
                              'Swap failed or was cancelled.';
                            setSwapErrorText(detail);
                            triggerNpcSpeech(detail);
                          }
                        } finally {
                          setIsSwappingNear(false);
                        }
                      }}
                      className={`min-w-[200px] py-2.5 px-6 rounded-full text-xs font-semibold shadow-sm transition-all ${
                        canPerformCryptoSwap
                          ? 'bg-violet-500 hover:bg-violet-600 text-white cursor-pointer active:scale-[0.99]'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <span>{isSwappingNear ? 'Swapping...' : 'Swap'}</span>
                    </button>
                  </div>

                  {lastCryptoSwapReceipt && (
                    <div className="px-4 pb-4">
                      <div
                        data-near-respite-swap-receipt="true"
                        className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-[11px] font-medium text-emerald-800 text-center space-y-0.5"
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
                            className="inline-block text-sky-600 hover:text-sky-700 underline font-mono"
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
                  className={`rounded-2xl bg-white text-slate-900 border border-slate-200/80 shadow-sm overflow-hidden ${
                    !walletConnected ? 'opacity-65 pointer-events-none select-none' : ''
                  }`}
                >
                  <div className="px-4 py-2.5 bg-sky-50/70 border-b border-slate-200/70 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200/80 text-[10.5px] font-semibold shrink-0">
                        LUL to CYON
                      </span>
                      <span className="text-[10.5px] font-medium text-slate-500">
                        For Fishing Gear &amp; Cafe Items
                      </span>
                    </div>
                    <span className="text-[10.5px] font-semibold text-sky-700">
                      {rateLul} LUL = {rateCyon} CYON
                    </span>
                  </div>

                  <div className="p-4 space-y-3">
                    {/* LUL Amount Input Row */}
                    <div className="flex items-center gap-2.5 max-w-xs mx-auto">
                      <div className="w-20 py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200/80 text-center text-[11px] font-semibold shrink-0">
                        <span>LUL</span>
                      </div>
                      <input
                        type="number"
                        min={rateLul}
                        step={rateLul}
                        max={lulBalance}
                        data-exchange-lul-input="true"
                        value={exchangeLulAmountStr}
                        onChange={(e) => setExchangeLulAmountStr(e.target.value)}
                        className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-50 text-slate-900 font-semibold text-sm border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:bg-white"
                      />
                    </div>

                    <div className="text-center text-[11px] font-medium text-slate-400">
                      You receive
                    </div>

                    {/* CYON Output Row */}
                    <div className="flex items-center gap-2.5 max-w-xs mx-auto">
                      <div className="w-20 py-2 rounded-xl bg-sky-50 text-sky-700 border border-sky-200/80 text-center text-[11px] font-semibold shrink-0">
                        <span>CYON</span>
                      </div>
                      <div
                        data-exchange-cyon-output="true"
                        className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-sky-50/60 text-sky-700 font-bold text-sm border border-sky-200/70"
                      >
                        {calculatedCyon}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Divider & Exchange Button */}
                  <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3 flex justify-center">
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
                      className={`min-w-[180px] py-2.5 px-6 rounded-full text-xs font-semibold shadow-sm transition-all ${
                        canPerformExchange
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer active:scale-[0.99]'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <span>Exchange</span>
                    </button>
                  </div>
                </div>
                    </>
                  )}
                </div>

                {/* Pinned Bottom Quick Action Buttons inside EXCHANGE tab */}
                <div
                  data-exchange-quick-bar="true"
                  className="pt-2.5 border-t border-slate-300/60 shrink-0"
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      data-chat-quick-shop-btn="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setExchangeQuickMode((prev) =>
                          prev === 'quick_shop' ? null : 'quick_shop',
                        );
                      }}
                      className={`px-2.5 py-1.5 rounded-full border text-[10px] font-semibold cursor-pointer inline-flex items-center gap-1 transition-all ${
                        exchangeQuickMode === 'quick_shop'
                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                          : 'bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border-slate-200/80'
                      }`}
                    >
                      <Store className="w-3 h-3" aria-hidden="true" />
                      <span>Quick Shop</span>
                    </button>
                    <button
                      type="button"
                      data-chat-quick-exchange-btn="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setQuickLulAmountOverride(null);
                        setExchangeQuickMode((prev) =>
                          prev === 'exchange_lul' ? null : 'exchange_lul',
                        );
                      }}
                      className={`px-2.5 py-1.5 rounded-full border text-[10px] font-semibold cursor-pointer inline-flex items-center gap-1 transition-all ${
                        exchangeQuickMode === 'exchange_lul'
                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                          : 'bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border-slate-200/80'
                      }`}
                    >
                      <Coins className="w-3 h-3" aria-hidden="true" />
                      <span>Exchange LUL</span>
                    </button>
                    <button
                      type="button"
                      data-chat-quick-swap-btn="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setQuickSwapNearOverride(0.25);
                        setExchangeQuickMode((prev) =>
                          prev === 'swap_near' ? null : 'swap_near',
                        );
                      }}
                      className={`px-2.5 py-1.5 rounded-full border text-[10px] font-semibold cursor-pointer inline-flex items-center gap-1 transition-all ${
                        exchangeQuickMode === 'swap_near'
                          ? 'bg-violet-500 text-white border-violet-500 shadow-xs'
                          : 'bg-white hover:bg-violet-50 text-slate-700 hover:text-violet-700 border-slate-200/80'
                      }`}
                    >
                      <Sparkles className="w-3 h-3" aria-hidden="true" />
                      <span>Swap NEAR</span>
                    </button>
                    {merchantLocation === 'lobby_cafe' ? (
                      <button
                        type="button"
                        data-chat-quick-house-btn="true"
                        onClick={() => {
                          soundEngine.playUiClick();
                          setQuickHouseStyleOverride(houseArchitectureStyle);
                          setExchangeQuickMode((prev) =>
                            prev === 'buy_house' ? null : 'buy_house',
                          );
                        }}
                        className={`px-2.5 py-1.5 rounded-full border text-[10px] font-semibold cursor-pointer inline-flex items-center gap-1 transition-all ${
                          exchangeQuickMode === 'buy_house'
                            ? 'bg-sky-500 text-white border-sky-500 shadow-xs'
                            : 'bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-700 border-slate-200/80'
                        }`}
                      >
                        <Home className="w-3 h-3" aria-hidden="true" />
                        <span>Buy House</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        data-chat-quick-gear-btn="true"
                        onClick={() => {
                          soundEngine.playUiClick();
                          setExchangeQuickMode((prev) =>
                            prev === 'fishing_gear' ? null : 'fishing_gear',
                          );
                        }}
                        className={`px-2.5 py-1.5 rounded-full border text-[10px] font-semibold cursor-pointer inline-flex items-center gap-1 transition-all ${
                          exchangeQuickMode === 'fishing_gear'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                            : 'bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-700 border-slate-200/80'
                        }`}
                      >
                        <ShoppingBag className="w-3 h-3" aria-hidden="true" />
                        <span>Fishing Gear</span>
                      </button>
                    )}
                    <button
                      type="button"
                      data-chat-quick-teleport-btn="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setActivePropertyOfferBoth(null);
                        setQuickTeleportFocusId(null);
                        setExchangeQuickMode((prev) =>
                          prev === 'teleport' ? null : 'teleport',
                        );
                      }}
                      className={`px-2.5 py-1.5 rounded-full border text-[10px] font-semibold cursor-pointer inline-flex items-center gap-1 transition-all ${
                        exchangeQuickMode === 'teleport'
                          ? 'bg-sky-500 text-white border-sky-500 shadow-xs'
                          : 'bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-700 border-slate-200/80'
                      }`}
                    >
                      <MapPin className="w-3 h-3" aria-hidden="true" />
                      <span>Teleport</span>
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
                <div className="space-y-3" data-catalog-kai-fishing-panel="true">
                  {/* Compact Balance / Registration Bar */}
                  <div className="p-3.5 rounded-2xl bg-white text-slate-900 border border-slate-200/80 shadow-sm flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-sky-600">
                        {walletConnected
                          ? 'Fishing Rods, Reels & Tackle'
                          : 'Registration required'}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {walletConnected
                          ? 'Select an item card below — stored in Personal Bag (BAG).'
                          : 'Register your account to purchase fishing rods & tackle.'}
                      </div>
                    </div>
                    {walletConnected ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/80 text-[10.5px] font-semibold">
                          {cyonBalance.toLocaleString()} CYON
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200/80 text-[10.5px] font-semibold">
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
                        className="px-3.5 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-[11px] shadow-xs cursor-pointer transition-colors shrink-0"
                      >
                        <span>Register</span>
                      </button>
                    )}
                  </div>

                  {/* Clean Bento 2x2 Selectable Card Grid */}
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
                          className={`group relative h-[140px] rounded-2xl text-left select-none transition-all duration-150 cursor-pointer border p-3 flex flex-col justify-between overflow-hidden ${
                            isSelected
                              ? 'bg-sky-50/90 border-sky-400 ring-2 ring-sky-200 shadow-sm'
                              : 'bg-white border-slate-200/80 shadow-xs hover:border-sky-300 hover:bg-slate-50/60'
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-sky-500 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                              ✓
                            </span>
                          )}

                          <div className="flex items-start justify-between gap-1.5 pr-6">
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-900 leading-tight truncate">
                                {item.name}
                              </div>
                              <div className="text-[10px] font-medium text-slate-500 mt-0.5">
                                {item.isNft ? 'NFT Tackle' : 'Fishing Gear'} · Stock {quote.stock}
                              </div>
                            </div>
                          </div>

                          <div className="my-1 flex items-center justify-center">
                            <div className="w-11 h-11 rounded-2xl bg-sky-50 border border-sky-200/70 flex items-center justify-center">
                              <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-sky-500 fill-none" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="18" cy="5" r="3" />
                                <line x1="16" y1="7" x2="5" y2="18" />
                                <path d="M18 8a6 6 0 0 1-6 6H7" />
                              </svg>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${
                                item.currency === 'RESPITE'
                                  ? 'bg-violet-50 text-violet-700 border-violet-200/80'
                                  : 'bg-sky-50 text-sky-700 border-sky-200/80'
                              }`}
                            >
                              {quote.buyPrice} {item.currency}
                            </span>
                            {isOwned && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200/80 text-[9.5px] font-semibold">
                                In bag
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Item Details Strip */}
                  {selectedFishingItem && selectedQuote && (
                    <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 truncate">
                            {selectedFishingItem.name}
                          </div>
                          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {selectedFishingItem.description}
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full border text-[10.5px] font-semibold shrink-0 ${
                            isSelectedOwned
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200/80'
                              : selectedFishingItem.currency === 'RESPITE'
                                ? 'bg-violet-50 text-violet-700 border-violet-200/80'
                                : 'bg-sky-50 text-sky-700 border-sky-200/80'
                          }`}
                        >
                          {isSelectedOwned
                            ? 'Owned in bag'
                            : `${selectedQuote.buyPrice} ${selectedFishingItem.currency}`}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Footer: Pagination + Primary Action Button */}
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
                        className="w-8 h-8 rounded-full bg-white hover:bg-sky-50 text-slate-700 border border-slate-200/90 shadow-xs flex items-center justify-center font-semibold text-xs cursor-pointer active:scale-95 transition-all"
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
                        className="w-8 h-8 rounded-full bg-white hover:bg-sky-50 text-slate-700 border border-slate-200/90 shadow-xs flex items-center justify-center font-semibold text-xs cursor-pointer active:scale-95 transition-all"
                        title="Next Page"
                      >
                        &gt;
                      </button>
                      <span className="ml-1.5 text-xs font-semibold text-slate-600">
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
                            className="px-4 py-2 rounded-full bg-amber-400 hover:bg-amber-500 text-slate-900 shadow-sm font-semibold text-xs cursor-pointer transition-colors"
                          >
                            <span>
                              Sell (+{selectedQuote.sellbackPrice} {selectedFishingItem.currency})
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
                            className={`px-5 py-2 rounded-full shadow-sm font-semibold text-xs transition-all ${
                              canAffordSelected
                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            <span>
                              {selectedQuote.stock <= 0
                                ? 'Out of stock'
                                : `Buy (${selectedQuote.buyPrice} ${selectedFishingItem.currency})`}
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // Hana Real Estate & Furniture Catalog has been moved to RealEstateCatalogModal.
            return null;
          })()}

          {/* ===============================================================
              TAB 4: FISH MARKET (Beach NPC Kai Only: Sell Raw Fish to Merchant for CYON, or Mint Fish NFT & Sell on P2P Marketplace for RESPITE)
             =============================================================== */}
          {merchantLocation === 'beach_house' && activeTab === 'fish_market' && (
            <div className="space-y-3" data-fish-market-panel="true">
              {/* Top Balance / Sign-In Header */}
              <div className="p-3.5 rounded-2xl bg-white text-slate-900 border border-slate-200/80 shadow-sm space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-teal-700">
                    {walletConnected ? 'Fish Market' : 'Sign in required'}
                  </span>
                  {walletConnected ? (
                    <div className="flex items-center gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/80 text-[10.5px] font-semibold">
                        {cyonBalance.toLocaleString()} CYON
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200/80 text-[10.5px] font-semibold">
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
                        className="px-3.5 py-1 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-[11px] shadow-xs cursor-pointer transition-colors"
                      >
                        <span>Sign in</span>
                      </button>
                    )
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  {walletConnected
                    ? 'Sell catches for LUL or mint Fish NFTs to trade with players for RESPITE.'
                    : 'Sign in to sell fish or trade Fish NFTs.'}
                </p>
              </div>

              {/* Fish market tabs: My Fish (bucket + my listings) | Market (other players) */}
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-full bg-white/80 border border-slate-200/80" data-fish-market-tabs="true">
                <button
                  type="button"
                  data-fish-market-tab="mine"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setFishMarketTab('mine');
                  }}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer transition-all ${
                    fishMarketTab === 'mine'
                      ? 'bg-teal-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
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
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer transition-all ${
                    fishMarketTab === 'market'
                      ? 'bg-teal-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {`Market (${fishMarketListings.filter((l) => l.sellerNearAccount.toLowerCase() !== playerNearAccount.toLowerCase()).length})`}
                </button>
              </div>

              {fishMarketTab === 'mine' && (
                <>
              {/* SECTION 1: YOUR FISH BUCKET (RAW CATCHES -> CYON OR MINT NFT -> RESPITE MARKETPLACE) */}
              <div
                className={`p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-2.5 ${
                  !walletConnected ? 'opacity-65 pointer-events-none select-none' : ''
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-900">
                    1. Your Fish Bucket ({caughtFishBucket.length} / 20)
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
                        className="px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 text-[10px] font-semibold cursor-pointer transition-colors"
                      >
                        Release common
                      </button>
                    )}
                    <span className="text-[10px] font-medium text-slate-400">
                      Press [F] near any water to catch
                    </span>
                  </div>
                </div>

                {caughtFishBucket.length === 0 ? (
                  <div className="py-5 px-3 rounded-xl bg-slate-50/80 border border-dashed border-slate-300 text-center text-xs font-medium text-slate-500">
                    Your Fish Bucket is empty. Walk to the East Beach shoreline or the Central Oasis Lake and press [F] CAST ROD to catch fish.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-0.5">
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
                          ? 'bg-purple-100 text-purple-800 border-purple-200/80'
                          : fish.rarity === 'Rare'
                            ? 'bg-amber-100 text-amber-800 border-amber-200/80'
                            : fish.rarity === 'Uncommon'
                              ? 'bg-teal-100 text-teal-800 border-teal-200/80'
                              : 'bg-slate-100 text-slate-700 border-slate-200/80';

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
                          className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/80 flex flex-col gap-2"
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
                                  className={`px-2 py-0.5 rounded-full border text-[9.5px] font-semibold ${rarityBadgeStyle}`}
                                >
                                  {fish.rarity}
                                </span>
                                <span className="text-xs font-semibold text-slate-900">
                                  {fish.speciesName}
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/70 text-[9.5px] font-semibold">
                                  {fish.weightKg.toFixed(2)} kg
                                  {fish.lengthCm ? ` · ${fish.lengthCm} cm` : ''}
                                </span>
                                {fish.isTrophy && (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200/80 text-[9px] font-semibold">
                                    Trophy +25%
                                  </span>
                                )}
                                {fish.isMintedNft && (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-[9px] font-semibold">
                                    Fish NFT
                                  </span>
                                )}
                              </div>
                              <div className="text-[10.5px] text-slate-500 mt-0.5">
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
                              className="py-1 px-2.5 rounded-full bg-white hover:bg-sky-50 text-sky-700 border border-slate-200/90 shadow-xs text-[10px] font-semibold cursor-pointer transition-colors shrink-0"
                            >
                              View
                            </button>
                          </div>

                          {!fish.isMintedNft ? (
                            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/70">
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
                                className="flex-1 py-1.5 px-3 rounded-full bg-amber-400 hover:bg-amber-500 text-slate-900 shadow-xs text-[10.5px] font-semibold cursor-pointer transition-colors"
                              >
                                Sell (+{lulValue} LUL)
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
                                className="flex-1 py-1.5 px-3 rounded-full bg-violet-500 hover:bg-violet-600 disabled:bg-slate-200 disabled:text-slate-400 text-white shadow-xs text-[10.5px] font-semibold cursor-pointer transition-colors"
                              >
                                {busyFishActionId === fish.id ? 'Minting...' : 'Mint NFT'}
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
                                className="py-1.5 px-3 rounded-full bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80 text-[10.5px] font-semibold cursor-pointer transition-colors"
                              >
                                Release
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10.5px] font-medium text-slate-600">
                                  Price (RESPITE):
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
                                  className="w-20 px-2.5 py-1 rounded-xl bg-white border border-slate-200/90 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
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
                                className="flex-1 py-1.5 px-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white shadow-xs text-[10.5px] font-semibold cursor-pointer transition-colors"
                              >
                                {busyFishActionId === fish.id
                                  ? 'Listing...'
                                  : `List for ${parsedListPriceRespite} RESPITE`}
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
                  className={`p-3 rounded-2xl border text-[11px] font-medium ${
                    fishMarketFeedback.ok
                      ? 'bg-emerald-50 border-emerald-200/80 text-emerald-800'
                      : 'bg-rose-50 border-rose-200/80 text-rose-700'
                  }`}
                >
                  {fishMarketFeedback.text}
                </div>
              )}

                </>
              )}

              {/* SECTION 2: KAI'S PLAYER MARKET (BOUGHT & SOLD USING RESPITE) */}
              <div className="p-3.5 rounded-2xl bg-white text-slate-900 border border-slate-200/80 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-semibold text-violet-700">
                    {fishMarketTab === 'mine'
                      ? `My Listings (${fishMarketListings.filter((l) => l.sellerNearAccount.toLowerCase() === playerNearAccount.toLowerCase()).length})`
                      : `Player Market (${fishMarketListings.filter((l) => l.sellerNearAccount.toLowerCase() !== playerNearAccount.toLowerCase()).length})`}
                  </span>
                  <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200/80">
                    RESPITE
                  </span>
                </div>

                {(fishMarketTab === 'mine' ? fishMarketListings.filter((l) => l.sellerNearAccount.toLowerCase() === playerNearAccount.toLowerCase()) : fishMarketListings.filter((l) => l.sellerNearAccount.toLowerCase() !== playerNearAccount.toLowerCase())).length === 0 ? (
                  <div className="py-5 text-center text-xs font-medium text-slate-400">
                    {fishMarketTab === 'mine'
                      ? 'You have no Fish NFTs listed. Mint a caught fish above and list it for RESPITE.'
                      : 'No Fish NFTs listed by other players yet.'}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-0.5">
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
                          ? 'bg-purple-100 text-purple-800 border-purple-200/80'
                          : listing.rarity === 'Rare'
                            ? 'bg-amber-100 text-amber-800 border-amber-200/80'
                            : listing.rarity === 'Uncommon'
                              ? 'bg-teal-100 text-teal-800 border-teal-200/80'
                              : 'bg-slate-100 text-slate-700 border-slate-200/80';

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
                          className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/80 flex items-center justify-between gap-2.5"
                        >
                          <Fish3dThumbnail
                            speciesId={listing.speciesId}
                            speciesName={listing.speciesName}
                            colorHex={listing.colorHex}
                            variant="compact"
                            onInspect={openListingFish3d}
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded-full border text-[9px] font-semibold ${rarityBadgeStyle}`}
                              >
                                {listing.rarity}
                              </span>
                              <span className="text-xs font-semibold text-slate-900">
                                {listing.speciesName}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-[9.5px] font-semibold">
                                {listing.weightKg.toFixed(2)} kg
                                {listing.lengthCm ? ` · ${listing.lengthCm} cm` : ''}
                              </span>
                              {listing.isTrophy && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200/80 text-[9px] font-semibold">
                                  Trophy
                                </span>
                              )}
                            </div>
                            <div className="text-[10.5px] text-slate-500 mt-0.5 truncate">
                              {listing.waterZoneLabel} · Seller: {listing.sellerNearAccount}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <button
                              type="button"
                              data-market-fish-3d-btn={listing.listingId}
                              onClick={() => {
                                soundEngine.playUiClick();
                                openListingFish3d();
                              }}
                              className="w-full px-2.5 py-1 rounded-full bg-white hover:bg-sky-50 text-sky-700 border border-slate-200/90 text-[10px] font-semibold cursor-pointer transition-colors"
                            >
                              View
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
                              className={`px-3 py-1.5 rounded-full shadow-xs text-[10.5px] font-semibold transition-colors shrink-0 ${
                                isOwnListing
                                  ? 'bg-amber-400 hover:bg-amber-500 text-slate-900 cursor-pointer'
                                  : canBuy
                                    ? 'bg-violet-500 hover:bg-violet-600 text-white cursor-pointer'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              {busyFishActionId === listing.listingId
                                ? 'Processing...'
                                : isOwnListing
                                  ? 'Unlist'
                                  : `Buy (${listingPriceRespite.toLocaleString()} RESPITE)`}
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
          {activeTab === 'gift' && onGiveNpcOwnedGift && (() => {
            const giftNpcId: NpcId = merchantLocation === 'beach_house' ? 'kai' : 'hana';
            const giftNpcName = giftNpcId === 'kai' ? 'Kai' : 'Hana';
            const closenessStore = npcClosenessStore ?? createEmptyNpcClosenessStore();
            const alreadyGiftedToday = !canGiftNpcToday(closenessStore, giftNpcId);
            const cafeItems = Array.from(new Set(ownedCafeFoodIds))
              .map((id) => getGiftCatalogItem(id))
              .filter(
                (item): item is NonNullable<typeof item> =>
                  Boolean(item && item.category === 'cafe_food'),
              );
            const apparelItems = Array.from(new Set(ownedApparelIds))
              .map((id) => getGiftCatalogItem(id))
              .filter(
                (item): item is NonNullable<typeof item> =>
                  Boolean(item && item.category === 'fashion_apparel'),
              );
            const furnitureItems = Array.from(new Set(ownedItemIds))
              .map((id) => getGiftCatalogItem(id))
              .filter(
                (item): item is NonNullable<typeof item> =>
                  Boolean(item && item.category === 'furniture'),
              );
            const activeGiftFeedback =
              merchantGiftFeedback && merchantGiftFeedback.npcId === giftNpcId
                ? merchantGiftFeedback
                : null;
            const hasAnyGift =
              caughtFishBucket.length > 0 ||
              cafeItems.length > 0 ||
              apparelItems.length > 0 ||
              furnitureItems.length > 0;

            const handleGive = (
              itemInput: GiftItemInput,
              giftLabel: string,
              fishInstanceId?: string,
            ) => {
              soundEngine.playUiClick();
              const out = onGiveNpcOwnedGift(giftNpcId, itemInput, fishInstanceId);
              setMerchantGiftFeedback({
                npcId: giftNpcId,
                reactionLine: out.reactionLine,
                giftLabel,
              });
            };

            return (
              <div className="space-y-3">
                <div className="p-3 rounded-2xl bg-white/10 border border-white/15 text-xs font-semibold text-white/90">
                  {alreadyGiftedToday
                    ? `You already gave ${giftNpcName} a gift today.`
                    : `Choose an item to give ${giftNpcName} today.`}
                </div>

                {activeGiftFeedback && (
                  <div className="p-3 rounded-2xl bg-white/12 border border-sky-300/35 space-y-1">
                    <div className="text-[10.5px] font-medium text-white/65">
                      {activeGiftFeedback.giftLabel}
                    </div>
                    <p className="text-xs font-medium text-white/95 leading-relaxed">
                      “{activeGiftFeedback.reactionLine}”
                    </p>
                  </div>
                )}

                {!hasAnyGift && (
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
                          disabled={alreadyGiftedToday}
                          onClick={() =>
                            handleGive(
                              { speciesId: fish.speciesId, isTrophy: fish.isTrophy },
                              `${fish.speciesName} (${fish.weightKg.toFixed(1)}kg)`,
                              fish.id,
                            )
                          }
                          className={`p-2.5 rounded-2xl border text-left flex items-center justify-between gap-2 transition-all ${
                            alreadyGiftedToday
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

                {cafeItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10.5px] font-semibold text-white/65 px-0.5">
                      Cafe Food &amp; Drinks ({cafeItems.length})
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {cafeItems.map((item) => (
                        <button
                          key={item.itemId}
                          type="button"
                          disabled={alreadyGiftedToday}
                          onClick={() => handleGive(item.itemId, item.name)}
                          className={`p-2.5 rounded-2xl border text-left flex items-center justify-between gap-2 transition-all ${
                            alreadyGiftedToday
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

                {apparelItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10.5px] font-semibold text-white/65 px-0.5">
                      Fashion &amp; Apparel ({apparelItems.length})
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {apparelItems.slice(0, 8).map((item) => (
                        <button
                          key={item.itemId}
                          type="button"
                          disabled={alreadyGiftedToday}
                          onClick={() => handleGive(item.itemId, item.name)}
                          className={`p-2.5 rounded-2xl border text-left flex items-center justify-between gap-2 transition-all ${
                            alreadyGiftedToday
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

                {furnitureItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10.5px] font-semibold text-white/65 px-0.5">
                      Furniture &amp; Decor ({furnitureItems.length})
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {furnitureItems.slice(0, 8).map((item) => (
                        <button
                          key={item.itemId}
                          type="button"
                          disabled={alreadyGiftedToday}
                          onClick={() => handleGive(item.itemId, item.name)}
                          className={`p-2.5 rounded-2xl border text-left flex items-center justify-between gap-2 transition-all ${
                            alreadyGiftedToday
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
              </div>
            );
          })()}
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

