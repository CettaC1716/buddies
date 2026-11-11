import { useState, useEffect, useCallback, useRef } from 'react';
import { useSafePrivy, useSafePrivyLogin } from './lib/privyAuthBridge';
import {
  MessageSquare,
  User,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Wallet,
  History,
  ArrowLeft,
  Backpack,
  Package,
} from 'lucide-react';
import {
  BuddiesBlitzArena,
  GameState,
  PlayMode,
  HudSnapshot,
} from './game/BuddiesBlitzArena';
import {
  BUDDIES_CONSTANTS,
  LIGHTING_PRESETS,
  LightingPresetKey,
  evaluateCommandCenterRadarSpec,
  worldCoordToRadarPercent,
  COMMANDER_PLOT_OFFSETS_X,
  LOBBY_FACTION_PORTALS,
  LOBBY_TRAM_SHELTER_SPEC,
  PUBLIC_WARZONE_CRATE_PADS,
  PLAYER_WARZONE_MAX_HP,
  PLAYER_WARZONE_MAX_LIVES,
  WorldMode,
  evaluateLobbyAndSafezonePeacefulState,
  type CityTransitStationId,
  type CityTransitDestinationSpec,
  getCityTransitDestinationById,
} from './game/buddiesBlitzRules';
import { soundEngine } from './game/audio';
import { subscribeBlitz3dAssetProgress } from './game/buddiesBlitzShadersAndAssets';
import {
  CRITICAL_3D_ASSET_COUNT,
  CRITICAL_AUDIO_ASSET_COUNT,
  CRITICAL_UI_IMAGE_URLS,
  computeUnifiedPreloadProgress,
  preloadAllUiAndKioskImages,
  type PreloadProgressInput,
} from './game/buddiesAssetPreloader';
import { TacticalKioskModal } from './components/TacticalKioskModal';
import { CityTransitKioskModal } from './components/CityTransitKioskModal';
import {
  SocialChatModal,
  NearbyEntityUser,
  ChatMessage,
  shouldTriggerIncomingPrivateChatNotification,
  simplifyDisplayName,
} from './components/SocialChatModal';
import { CharacterProfileModal } from './components/CharacterProfileModal';
import { MobileResponsiveControls } from './components/MobileResponsiveControls';
import { NearWalletSelectorModal } from './components/NearWalletSelectorModal';
import {
  NpcMerchantAndHouseModal,
  HouseInteriorPlacementState,
} from './components/NpcMerchantAndHouseModal';
import { TidewaterFishingHudAndShowcase } from './components/TidewaterCatchShowcaseModal';
import {
  Fish3dPreviewModal,
  Fish3dThumbnail,
  type Fish3dPreviewSpec,
} from './components/Fish3dPreviewModal';
import {
  createInitialMerchantMarketState,
  executeLulToCyonExchange,
  investInMerchantShop,
  stepFastForwardEconomyTick,
  MerchantLocationId,
  MerchantCatalogItem,
  HouseInteriorSlotId,
  MERCHANT_CATALOG_ITEMS,
} from './game/buddiesMerchantPricing';
import {
  FAMILY_MEMBER_CONTRACT_PLANS,
  FAMILY_MEMBER_ORDER_SPECS,
  HOUSE_OWNERSHIP_PRICE_RESPITE,
  NEAR_CONFIG,
  checkCitizenSubAccountAvailability,
  claimHanaWelcomeNearOnChain,
  disconnectNearWallet,
  executeMarketContractCallOnChain,
  executeNearTestnetAndRespiteSwap,
  fetchBuddiesMarketEstate,
  fetchBuddiesMarketFishListings,
  fetchHanaTreasuryStatus,
  fetchNearAccountView,
  fetchNearNetworkStatus,
  fetchNep141Balance,
  fetchOwnedFishNftsFromChain,
  getNearBlocksTxUrl,
  isActiveWalletReadOnlyObserver,
  onNearSigningWalletConnected,
  restoreConnectedNearSigningWallet,
  spawnSubAccountOnChainViaMaster,
  verifyNep171GamepassOwnership,
  type NearAccountView,
  type NearNetworkId,
  type NearNetworkStatus,
  type NearWalletConnectionResult,
  type Nep171GamepassSubAccountLedger,
  type RecruitedFamilyMemberAgent,
} from './lib/nearClient';
import {
  creditRecipientRespiteInSupabase,
  fetchBasePlotsFromSupabase,
  fetchFishMarketplaceListingsFromSupabase,
  fetchFishNftMarketSalesStats,
  fetchGamepassNftLedgerFromSupabase,
  fetchHouseInteriorFromSupabase,
  fetchMarketTransactionsFromSupabase,
  fetchNpcMerchantsFromSupabase,
  fetchOrCreatePlayerProfile,
  fetchPlayerProfileByEmail,
  fetchRecentSocialMessages,
  insertSocialMessageToSupabase,
  logMarketTransactionToSupabase,
  signInWithSupabaseGoogle,
  signOutSupabaseAuth,
  subscribeToMarketTransactions,
  subscribeToSocialMessagesRealtime,
  subscribeToSupabaseAuthUser,
  syncBasePlotToSupabase,
  syncFishMarketplaceListingsToSupabase,
  syncHouseInteriorToSupabase,
  syncNpcMerchantToSupabase,
  syncPlayerBalancesToSupabase,
  type DbMarketTransactionRow,
  type FishNftMarketSalesStats,
} from './lib/supabaseClient';
import {
  FISH_SPECIES_CATALOG,
  computeLengthCmFromWeightKg,
  detectNearbyFishingWaterZone,
  rollRandomCaughtFish,
  createTidewaterBiteSchedule,
  createTidewaterMinigameState,
  stepTidewaterMinigame,
  type CaughtFishItem,
  type FishNftMarketplaceListing,
  type FishingPhaseState,
  type TidewaterBiteSchedule,
  type TidewaterMinigameState,
} from './game/buddiesFishingMarket';

const INITIAL_HUD: HudSnapshot = {
  hp: PLAYER_WARZONE_MAX_HP,
  maxHp: PLAYER_WARZONE_MAX_HP,
  score: 0,
  gold: 0,
  bestScore: 0,
  speedKmh: 0,
  isBoosting: false,
  isGrabMode: false,
  grabbedPropName: null,
  collectedItems: [],
  powerCoreActivated: false,
  enemiesDefeated: 0,
  totalEnemies: 4,
  lightingPreset: 'day',
  cameraFovMode: 'webgl35',
  outcome: null,
  clearTimeSec: 0,
  controlMode: 'buddy',
  activeClass: 'Infuntry',
  equippedWeapon: 'Unarmed (Fists)',
  ammo: 0,
  carryingCrate: 'none',
  tankStoredCrates: 0,
  padSlots: ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
  padHologramColors: ['red', 'empty', 'empty', 'empty', 'red', 'empty', 'empty', 'empty'],
  activePriorityRecipe: 'buddy_infantry',
  buildQueue: ['buddy_infantry'],
  padShape: 'Empty',
  padOutputName: 'Empty Pad',
  padIsMerged: false,
  padIsSuper: false,
  buildOrder: '1x1x2',
  buildOrderLabel: 'Infantry Buddy',
  buildOrderTargetCrates: 2,
  baseBuildingLevel: 1,
  commandCenterLevel: 1,
  commandCenterRadarActive: false,
  commandCenterRadarCoveragePct: 45,
  baseBuildingHp: 400,
  baseBuildingMaxHp: 400,
  baseFenceLevel: 1,
  baseFenceHp: 260,
  baseFenceMaxHp: 260,
  baseHasParkingBay: true,
  baseHasHelipad: true,
  isNearKiosk: false,
  kioskStatusMessage: null,
  teamCommand: 'HARVEST',
  alliedBuddiesCount: 1,
  personalSquadCount: 1,
  personalSquadMax: 4,
  personalSquadClasses: ['Infuntry'],
  activePersonalBuddyIndex: 0,
  blueHumanCount: 1,
  blueAiCommanderCount: 0,
  redHumanCount: 0,
  redAiCommanderCount: 0,
  skyshieldBuiltCount: 0,
  blueBaseHp: 2000,
  redBaseHp: 2000,
  contextHint: 'WASD Run · [E] Grab Crate · [Q] Pattern 1x1x2 · [F] Craft',
  radarDots: [],
  floatingPrompts: [],
  editorObjectCount: 19,
  editorCursorX: 0,
  editorCursorZ: 0,
  editorRotDeg: 0,
  editorScale: 1.0,
  nuclearStrikePhase: 'idle',
  nuclearTargetCoords: { x: 0, z: 18 },
  hasDeployedNuclearLauncher: false,
  hudWeaponBadges: [],
  particlePoolActive: 0,
  particlePoolCapacity: 128,
  particleTotalSpawns: 0,
  playerTeam: 'blue',
  isInsideLobbySafezone: true,
  isNearLobbyTramReturnPad: false,
  nearWalletConnected: false,
  nearWalletId: null,
  nearHasGamepassNft: false,
  nearGamepassTokenId: null,
  nearClaimedTeam: null,
  nearClaimedPlotIndex: null,
  nearActiveHarvesterSubAccounts: [],
  nearSessionStatusBanner: '',
  nearKioskPlotTeam: null,
  nearKioskPlotIndex: null,
  nearKioskIsEmptyPlot: false,
  activeBluePlotIndices: [0],
  activeRedPlotIndices: [],
  playerWarzoneLives: PLAYER_WARZONE_MAX_LIVES,
  playerWarzoneMaxLives: PLAYER_WARZONE_MAX_LIVES,
  harvesterContractStage: 'STANDBY',
  harvesterContractLabel: 'STANDBY (WAIT CONTRACT)',
  hasActiveBuildContract: false,
  isNearLobbyGoldExchange: false,
  lobbyGoldExchangeOwnedItems: [],
  blueOnlinePopulation: 1,
  redOnlinePopulation: 0,
  maxOnlinePerTeam: 10,
  blueOnlineLabel: 'BLUE 1/10 ONLINE',
  redOnlineLabel: 'RED 0/10 ONLINE',
  worldMode: 'lobby',
  cityArenaMode: 'safezone',
  safezonePlotAccessMode: 'PUBLIC',
  safezoneAllowedFriends: [],
  safezonePlotOwnerId: null,
};

const PRESET_ORDER: LightingPresetKey[] = ['day', 'dusk', 'night', 'dawn'];
const EMPTY_NEP171_LEDGER: Nep171GamepassSubAccountLedger = {
  tokenId: '',
  ownerNearAccount: '',
  subAccountId: '',
  network: 'testnet',
  treasuryRespite: 0,
  totalEarnedRespite: 0,
  totalPaidOutRespite: 0,
  pendingPayoutRespite: 0,
  activeAccessKey: '',
  revokedAccessKeys: [],
  lastTransferTxHash: '',
  ownershipHistory: [],
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('title') === '1') {
        return 'title';
      }
    }
    return 'playing';
  });

  const [playMode, setPlayMode] = useState<PlayMode>('sandbox');
  const [characterGender, setCharacterGender] = useState<'female' | 'male'>('male');
  const [onboardingStep, setOnboardingStep] = useState<
    | 'auth_choice'
    | 'guest_character_select'
    | 'subwallet_naming'
    | 'provisioning_subwallet'
    | 'entering_lobby'
    | 'completed'
  >(() => {
    if (typeof window !== 'undefined') {
      try {
        if (window.localStorage.getItem('bb_storage_reset_nov2026_v2') !== '1') {
          window.localStorage.removeItem('bb_last_connected_wallet_id');
          window.localStorage.removeItem('bb_saved_wallet_profiles_v1');
          window.localStorage.removeItem('bb_wallet_by_google_email_v1');
          window.localStorage.removeItem('bb_connected_google_email');
          window.localStorage.setItem('bb_storage_reset_nov2026_v2', '1');
        }
      } catch {
        // ignore storage errors
      }
      const params = new URLSearchParams(window.location.search);
      if (
        params.get('skipOnboarding') === '1' ||
        params.get('fullmap') === '1' ||
        params.get('planeview') ||
        (params.get('world') && params.get('world') !== 'lobby')
      ) {
        return 'completed';
      }
      try {
        const lastId = window.localStorage.getItem('bb_last_connected_wallet_id_v2');
        const explicitlyLoggedOut =
          window.localStorage.getItem('bb_explicit_logged_out_v1') === '1';
        if (
          lastId &&
          !explicitlyLoggedOut &&
          !lastId.toLowerCase().startsWith('player1.') &&
          !lastId.toLowerCase().startsWith('guest') &&
          !lastId.toLowerCase().endsWith('.buddiesblitz-master.testnet')
        ) {
          return 'completed';
        }
      } catch {
        // ignore storage errors
      }
    }
    return 'auth_choice';
  });
  const [playerDisplayName, setPlayerDisplayName] = useState<string>('Buddy Male');
  const [playerUid, setPlayerUid] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const savedWallet = window.localStorage.getItem('bb_last_connected_wallet_id_v2');
      if (
        savedWallet &&
        !savedWallet.toLowerCase().startsWith('player1.') &&
        !savedWallet.toLowerCase().startsWith('guest') &&
        !savedWallet.toLowerCase().endsWith('.buddiesblitz-master.testnet')
      ) {
        return savedWallet.toLowerCase();
      }
      if (savedWallet) {
        window.localStorage.removeItem('bb_last_connected_wallet_id_v2');
      }
    }
    return '';
  });
  const [isCustomGuestNameEdited, setIsCustomGuestNameEdited] = useState<boolean>(false);
  const [onboardingAuthMode, setOnboardingAuthMode] = useState<'guest' | 'wallet'>('guest');
  const [onboardingLoadingProgress, setOnboardingLoadingProgress] = useState<number>(0);
  const [subWalletHandleDraft, setSubWalletHandleDraft] = useState<string>('');
  const [subWalletAvailability, setSubWalletAvailability] = useState<{
    checking: boolean;
    validFormat: boolean;
    available: boolean;
    ownedByCurrentDevice: boolean;
    subAccountId: string;
    reason?: string;
  }>({
    checking: false,
    validFormat: false,
    available: false,
    ownedByCurrentDevice: false,
    subAccountId: '',
  });
  const [subWalletProvisionStageLabel, setSubWalletProvisionStageLabel] = useState<string>(
    'Generating browser self-custody Ed25519 key...',
  );
  const [provisionedSubWalletTxHash, setProvisionedSubWalletTxHash] = useState<string>('');
  const [tutorialStage, setTutorialStage] = useState<
    'none' | 'welcome_modal' | 'go_to_hana' | 'go_to_kiosk'
  >('none');
  const [hanaWelcomeNearClaimed, setHanaWelcomeNearClaimed] = useState<boolean>(false);
  const [preloadProgress, setPreloadProgress] = useState<number>(0);
  const [isPreloadComplete, setIsPreloadComplete] = useState<boolean>(false);
  const preloadTrackerRef = useRef<PreloadProgressInput>({
    modelsLoaded: 0,
    modelsTotal: CRITICAL_3D_ASSET_COUNT,
    imagesLoaded: 0,
    imagesTotal: CRITICAL_UI_IMAGE_URLS.length,
    audioLoaded: 0,
    audioTotal: CRITICAL_AUDIO_ASSET_COUNT,
    sceneWarmupComplete: false,
  });

  const syncPreloadProgressState = useCallback(() => {
    const { percent, isComplete } = computeUnifiedPreloadProgress(preloadTrackerRef.current);
    setPreloadProgress((prev) => Math.max(prev, percent));
    if (isComplete) {
      setIsPreloadComplete(true);
      if (typeof document !== 'undefined') {
        document.body.dataset.preloadComplete = 'true';
      }
    }
  }, []);

  const handlePreloadSceneReady = useCallback(() => {
    preloadTrackerRef.current.sceneWarmupComplete = true;
    syncPreloadProgressState();
  }, [syncPreloadProgressState]);

  useEffect(() => {
    let mounted = true;
    if (typeof document !== 'undefined') {
      document.body.dataset.preloadComplete = 'false';
    }

    const unsubscribe3d = subscribeBlitz3dAssetProgress((loaded, total) => {
      if (!mounted) return;
      preloadTrackerRef.current.modelsLoaded = loaded;
      preloadTrackerRef.current.modelsTotal = total;
      syncPreloadProgressState();
    });

    void preloadAllUiAndKioskImages((loaded, total) => {
      if (!mounted) return;
      preloadTrackerRef.current.imagesLoaded = loaded;
      preloadTrackerRef.current.imagesTotal = total;
      syncPreloadProgressState();
    });

    void soundEngine.preloadAllAudioAssets((loaded, total) => {
      if (!mounted) return;
      preloadTrackerRef.current.audioLoaded = loaded;
      preloadTrackerRef.current.audioTotal = total;
      syncPreloadProgressState();
    });

    return () => {
      mounted = false;
      unsubscribe3d();
    };
  }, [syncPreloadProgressState]);
  const [walletConnectInput, setWalletConnectInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('bb_connected_google_email_v2') || '';
    }
    return '';
  });
  const [connectedGoogleEmail, setConnectedGoogleEmail] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('bb_connected_google_email_v2') || '';
    }
    return '';
  });
  const [walletAddressCopiedToast, setWalletAddressCopiedToast] = useState<boolean>(false);
  const [walletNetworkChoice] = useState<NearNetworkId>('testnet');
  const [isVerifyingNearWallet, setIsVerifyingNearWallet] = useState<boolean>(false);
  const [walletConnectError, setWalletConnectError] = useState<string | null>(null);
  const [, setNearOnChainAccountView] = useState<NearAccountView | null>(null);
  const [, setWalletUsernameDraft] = useState<string>('Buddy Male');
  const [respiteTransferRecipient, setRespiteTransferRecipient] = useState<string>('');
  const [respiteTransferAmount, setRespiteTransferAmount] = useState<string>('10');
  const [respiteTransferStatus, setRespiteTransferStatus] = useState<{
    type: 'success' | 'error';
    text: string;
    txHash?: string;
  } | null>(null);
  const [savedWalletSummary, setSavedWalletSummary] = useState<{
    walletId: string;
    displayName: string;
    gender: 'male' | 'female';
  } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const lastId = window.localStorage.getItem('bb_last_connected_wallet_id_v2');
      const rawMap = window.localStorage.getItem('bb_saved_wallet_profiles_v2');
      if (
        !lastId ||
        !rawMap ||
        lastId.toLowerCase().startsWith('player1.') ||
        lastId.toLowerCase().startsWith('guest') ||
        lastId.toLowerCase().endsWith('.buddiesblitz-master.testnet')
      ) {
        return null;
      }
      const parsed = JSON.parse(rawMap) as Record<
        string,
        { displayName: string; gender: 'male' | 'female' }
      >;
      const entry = parsed[lastId.toLowerCase()];
      if (!entry) return null;
      return {
        walletId: lastId.toLowerCase(),
        displayName: entry.displayName,
        gender: entry.gender,
      };
    } catch {
      return null;
    }
  });
  const guestNameInputRef = useRef<HTMLInputElement | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const hudRef = useRef<HudSnapshot>(INITIAL_HUD);
  useEffect(() => {
    hudRef.current = hud;
  }, [hud]);
  const [lightingPreset, setLightingPreset] = useState<LightingPresetKey>('day');
  const [cameraFovMode, setCameraFovMode] = useState<'webgl35' | 'ortho18'>('webgl35');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [audioVolumePct, setAudioVolumePct] = useState<number>(100);
  const [isKioskModalOpen, setIsKioskModalOpen] = useState<boolean>(false);
  const [activeSpecialModal, setActiveSpecialModal] = useState<
    'none' | 'npc_merchant' | 'house_interior'
  >('none');
  const [isInsidePrivateHouse, setIsInsidePrivateHouse] = useState<boolean>(false);
  const [merchantLocation, setMerchantLocation] = useState<MerchantLocationId>('lobby_cafe');
  const [marketState, setMarketState] = useState(() => createInitialMerchantMarketState());
  const [isFastForwardRunning, setIsFastForwardRunning] = useState<boolean>(false);
  const [cyonBalance, setCyonBalance] = useState<number>(0);
  const [respiteBalance, setRespiteBalance] = useState<number>(0);
  const [nearTestnetBalance, setNearTestnetBalance] = useState<number>(0);
  const [personalWalletTab, setPersonalWalletTab] = useState<'wallet' | 'assets' | 'history'>('wallet');
  const [isSampleHouseView, setIsSampleHouseView] = useState<boolean>(false);
  const [isHouseFriendInviteOpen, setIsHouseFriendInviteOpen] = useState<boolean>(false);
  const [houseInviteFriendInput, setHouseInviteFriendInput] = useState<string>('');
  const [houseInviteFeedback, setHouseInviteFeedback] = useState<string | null>(null);
  const [walletHistoryFilter, setWalletHistoryFilter] = useState<
    'ALL' | 'LUL' | 'CYON' | 'RESPITE'
  >('ALL');
  const [walletTransactions, setWalletTransactions] = useState<DbMarketTransactionRow[]>([]);
  const [isLoadingWalletTransactions, setIsLoadingWalletTransactions] = useState<boolean>(false);
  const [isNearWalletSelectorOpen, setIsNearWalletSelectorOpen] = useState<boolean>(false);
  const [hasHouseOwnership, setHasHouseOwnership] = useState<boolean>(false);
  const [houseEntryScanState, setHouseEntryScanState] = useState<'idle' | 'scanning' | 'verified'>(
    'idle',
  );
  const [recruitedFamilyMembers, setRecruitedFamilyMembers] = useState<
    RecruitedFamilyMemberAgent[]
  >([]);
  const [ownedMerchantItemIds, setOwnedMerchantItemIds] = useState<string[]>([]);
  const [activeHouseThemeId, setActiveHouseThemeId] = useState<string>('theme_japanese_zen');
  const [interiorPlacement, setInteriorPlacement] = useState<HouseInteriorPlacementState>({
    center_table: null,
    left_wall: null,
    right_wall: null,
    corner_plant: null,
    trophy_pedestal: null,
    rotationStepBySlot: {
      center_table: 0,
      left_wall: 0,
      right_wall: 0,
      corner_plant: 0,
      trophy_pedestal: 0,
    },
  });
  const [resetTrigger, setResetTrigger] = useState<number>(0);
  const [socialChatText, setSocialChatText] = useState<string>('');
  const [chatBubbleBgColor, setChatBubbleBgColor] = useState<string>('#ffffff');
  const [chatBubbleTextColor, setChatBubbleTextColor] = useState<string>('#0f172a');
  const [isSocialChatModalOpen, setIsSocialChatModalOpen] = useState<boolean>(false);
  const [isPersonalWalletModalOpen, setIsPersonalWalletModalOpen] = useState<boolean>(false);
  const [isPersonalBagModalOpen, setIsPersonalBagModalOpen] = useState<boolean>(false);
  const [personalBagTab, setPersonalBagTab] = useState<'equipment' | 'fish' | 'items'>('equipment');
  const [selectedPrivateUser, setSelectedPrivateUser] = useState<NearbyEntityUser | null>(null);
  const [unreadPrivateCount, setUnreadPrivateCount] = useState<number>(0);
  const [lastUnreadPrivateSender, setLastUnreadPrivateSender] = useState<NearbyEntityUser | null>(
    null,
  );
  const [activePrivateNotificationToast, setActivePrivateNotificationToast] = useState<{
    id: string;
    senderName: string;
    senderId?: string;
    text: string;
    user: NearbyEntityUser;
  } | null>(null);
  const [isTargetMenuExpanded, setIsTargetMenuExpanded] = useState<boolean>(false);
  const [activeTeleportKioskModal, setActiveTeleportKioskModal] = useState<
    'none' | CityTransitStationId
  >('none');
  const [tramRideCutsceneUi, setTramRideCutsceneUi] = useState<{
    active: boolean;
    originStationId: CityTransitStationId;
    destinationStationId: CityTransitStationId;
    progress01: number;
  } | null>(null);
  const [, setNearRpcStatus] = useState<NearNetworkStatus | null>(null);
  const [, setSupabaseConnected] = useState<boolean>(false);
  const [nep171Ledger, setNep171Ledger] =
    useState<Nep171GamepassSubAccountLedger>(EMPTY_NEP171_LEDGER);
  const [caughtFishBucket, setCaughtFishBucket] = useState<CaughtFishItem[]>([]);
  const [fishMarketListings, setFishMarketListings] = useState<FishNftMarketplaceListing[]>([]);
  const [fishSalesStats, setFishSalesStats] = useState<FishNftMarketSalesStats | null>(null);
  const [preview3dFish, setPreview3dFish] = useState<Fish3dPreviewSpec | null>(null);
  const hydratedFishBucketKeyRef = useRef<string>('');
  const [fishingPhase, setFishingPhase] = useState<FishingPhaseState>('idle');
  const [fishingCastPower, setFishingCastPower] = useState<number>(0.72);
  const [isChargingCast, setIsChargingCast] = useState<boolean>(false);
  const [fishingBiteSchedule, setFishingBiteSchedule] = useState<TidewaterBiteSchedule | null>(
    null,
  );
  const [fishingHintMessage, setFishingHintMessage] = useState<string | null>(null);
  const [fishingMinigame, setFishingMinigame] = useState<TidewaterMinigameState | null>(null);
  const [isHoldingReel, setIsHoldingReel] = useState<boolean>(false);
  const [lastCaughtFishToast, setLastCaughtFishToast] = useState<CaughtFishItem | null>(null);

  // Fast-Forward Economy Simulation (`09-games` Track: 1.1s per simulated day so judges watch dynamic pricing & bankruptcy live)
  useEffect(() => {
    if (!isFastForwardRunning || activeSpecialModal !== 'npc_merchant') return;
    const timer = window.setInterval(() => {
      setMarketState((prev) => {
        const next = stepFastForwardEconomyTick(prev, prev.dayCounter);
        void syncNpcMerchantToSupabase({
          merchant_id: merchantLocation,
          cyon_treasury: next.treasuryCyon,
          is_bankrupt: next.isShopBroke,
          simulated_day: next.dayCounter,
          stock_by_item: next.stockByItemId,
          recent_demand_by_item: next.demandByItemId,
          last_headline: next.lastMarketHeadline,
        });
        return next;
      });
    }, 1100);
    return () => window.clearInterval(timer);
  }, [isFastForwardRunning, activeSpecialModal, merchantLocation]);

  const activeFishBucketStorageKey = `bb_caught_fish_bucket_v2:${(
    hud.nearWalletId || 'guest'
  )
    .trim()
    .toLowerCase()}`;

  // Restore locally caught fish when active wallet / guest key changes
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(activeFishBucketStorageKey);
      const parsed: CaughtFishItem[] = raw ? (JSON.parse(raw) as CaughtFishItem[]) : [];
      const validStored = Array.isArray(parsed)
        ? parsed.filter((f) => f && typeof f.speciesId === 'string' && typeof f.weightKg === 'number')
        : [];
      setCaughtFishBucket((prev) => {
        // Preserve any unminted fish caught while playing as guest right before registering
        const guestCarryOver = prev.filter(
          (f) => !f.isMintedNft && !validStored.some((s) => s.id === f.id),
        );
        return [...guestCarryOver, ...validStored].slice(0, 30);
      });
    } catch {
      // ignore localStorage read errors
    } finally {
      hydratedFishBucketKeyRef.current = activeFishBucketStorageKey;
    }
  }, [activeFishBucketStorageKey]);

  // Persist caught fish bucket per wallet / guest key
  useEffect(() => {
    if (hydratedFishBucketKeyRef.current !== activeFishBucketStorageKey) return;
    try {
      window.localStorage.setItem(
        activeFishBucketStorageKey,
        JSON.stringify(caughtFishBucket.slice(0, 30)),
      );
    } catch {
      // ignore localStorage quota errors
    }
  }, [caughtFishBucket, activeFishBucketStorageKey]);

  const refreshFishMarketplaceFromChainAndDb = useCallback(async () => {
    const activeWallet = (hudRef.current.nearWalletId || '').trim().toLowerCase();
    const [dbListings, onChainListings, latestSalesStats, ownedChainFish] = await Promise.all([
      fetchFishMarketplaceListingsFromSupabase(),
      fetchBuddiesMarketFishListings(),
      fetchFishNftMarketSalesStats(),
      activeWallet ? fetchOwnedFishNftsFromChain(activeWallet) : Promise.resolve([]),
    ]);
    setFishSalesStats(latestSalesStats);
    const mappedOnChain: FishNftMarketplaceListing[] = onChainListings.map((row) => {
      const spec = FISH_SPECIES_CATALOG.find((s) => s.speciesId === row.species_id);
      const waterZone =
        row.water_zone === 'central_oasis' ? 'central_oasis' : spec?.waterZone || 'east_beach';
      const weightKg = Math.max(0.05, Number(((row.weight_kg_x100 || 100) / 100).toFixed(2)));
      const priceRespite = Math.max(1, Math.round(Number(row.price_respite) || 1));
      return {
        listingId: row.listing_id,
        nftTokenId: row.token_id,
        speciesId: row.species_id,
        speciesName: row.species_name || spec?.speciesName || 'Coral Sardine',
        waterZone,
        waterZoneLabel:
          waterZone === 'central_oasis' ? 'Central Oasis Lake' : 'East Beach Shoreline',
        rarity: (row.rarity as FishNftMarketplaceListing['rarity']) || spec?.rarity || 'Common',
        weightKg,
        lengthCm: computeLengthCmFromWeightKg(weightKg, spec?.lwA, spec?.lwB),
        isTrophy: spec ? weightKg >= spec.maxWeightKg * 0.7 : false,
        colorHex: spec?.colorHex || '#38bdf8',
        caughtByAccount: row.seller_id,
        sellerNearAccount: row.seller_id,
        priceRespite,
        priceLul: priceRespite,
        nearTxHash: '',
        listedAtIso: new Date(row.listed_at_ms || Date.now()).toISOString(),
      };
    });
    const onChainIds = new Set(mappedOnChain.map((item) => item.listingId));
    // Prioritize live smart contract listings on market.buddiesblitz.testnet
    const merged = [
      ...mappedOnChain,
      ...dbListings.filter((item) => !onChainIds.has(item.listingId) && !item.listingId.startsWith('listing-')),
    ];
    setFishMarketListings(merged);

    if (activeWallet) {
      const listedTokenIds = new Set(onChainListings.map((r) => r.token_id));
      const ownedTokenIds = new Set(ownedChainFish.map((n) => n.tokenId));
      setCaughtFishBucket((prev) => {
        // Keep unminted catches + minted NFTs still owned & not currently listed
        const next = prev.filter((f) => {
          if (!f.isMintedNft || !f.nftTokenId) return true;
          if (listedTokenIds.has(f.nftTokenId)) return false;
          // Keep freshly minted NFTs or chain-confirmed owned NFTs
          return ownedTokenIds.size === 0 || ownedTokenIds.has(f.nftTokenId);
        });

        for (const nft of ownedChainFish) {
          if (listedTokenIds.has(nft.tokenId)) continue;
          if (next.some((f) => f.nftTokenId === nft.tokenId)) continue;
          const spec = FISH_SPECIES_CATALOG.find((s) => s.speciesId === nft.speciesId);
          const waterZone = spec?.waterZone || nft.waterZone;
          const isTrophy = spec ? nft.weightKg >= spec.maxWeightKg * 0.7 : false;
          const sellLul = Math.max(
            15,
            Math.round((spec?.baseLulPerKg || 14) * nft.weightKg * (isTrophy ? 1.25 : 1)),
          );
          const suggestedRespite = Math.max(
            4,
            Math.round((spec?.suggestedRespitePrice || 12) * (isTrophy ? 1.25 : 1)),
          );
          next.push({
            id: `chain-fish-${nft.tokenId}`,
            speciesId: nft.speciesId,
            speciesName: spec?.speciesName || nft.speciesName,
            waterZone,
            waterZoneLabel:
              waterZone === 'central_oasis' ? 'Central Oasis Lake' : 'East Beach Shoreline',
            rarity: spec?.rarity || nft.rarity,
            weightKg: nft.weightKg,
            lengthCm: computeLengthCmFromWeightKg(nft.weightKg, spec?.lwA, spec?.lwB),
            isTrophy,
            sellValueCyon: sellLul,
            sellValueLul: sellLul,
            mintFeeLul: 0,
            suggestedRespitePrice: suggestedRespite,
            colorHex: spec?.colorHex || '#38bdf8',
            loreTag: spec?.loreTag || 'Caught in Buddies Blitz Safezone waters.',
            caughtByAccount: activeWallet,
            caughtAtIso: new Date().toISOString(),
            isMintedNft: true,
            nftTokenId: nft.tokenId,
            nearTxHash: null,
          });
        }

        return next;
      });
    }
  }, []);

  useEffect(() => {
    if (
      activeSpecialModal === 'npc_merchant' ||
      isPersonalWalletModalOpen ||
      isPersonalBagModalOpen ||
      hud.nearWalletConnected
    ) {
      void refreshFishMarketplaceFromChainAndDb();
    }
  }, [
    activeSpecialModal,
    isPersonalWalletModalOpen,
    isPersonalBagModalOpen,
    hud.nearWalletConnected,
    hud.nearWalletId,
    refreshFishMarketplaceFromChainAndDb,
  ]);

  // Hydrate initial state from NEAR RPC & Supabase PostgreSQL + Realtime
  useEffect(() => {
    let mounted = true;
    void fetchNearNetworkStatus().then((status) => {
      if (mounted) setNearRpcStatus(status);
    });
    void refreshFishMarketplaceFromChainAndDb();
    void fetchBasePlotsFromSupabase().then((plots) => {
      if (!mounted || plots.length === 0) return;
      const activeWallet = (hudRef.current.nearWalletId || '').toLowerCase();
      if (!activeWallet) return;
      const ownedPlot = plots.find(
        (p) => p.is_claimed && (p.claimed_by_near_account || '').toLowerCase() === activeWallet,
      );
      if (ownedPlot) {
        setHud((prev) => ({
          ...prev,
          nearClaimedTeam: ownedPlot.team,
          nearClaimedPlotIndex: ownedPlot.plot_index,
          safezonePlotAccessMode: ownedPlot.access_mode,
          safezoneAllowedFriends: Array.isArray(ownedPlot.allowed_friends)
            ? ownedPlot.allowed_friends
            : prev.safezoneAllowedFriends,
        }));
      }
    });
    void fetchRecentSocialMessages(30).then((rows) => {
      if (!mounted || rows.length === 0) return;
      setChatMessages(
        rows.map((msg) => ({
          id: msg.id,
          senderId: msg.sender_near_account || undefined,
          senderName: msg.sender_name,
          recipientName: msg.recipient_name || undefined,
          text: msg.message,
          timestamp: new Date(msg.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          type: msg.recipient_name ? 'private' : 'public',
        })),
      );
    });
    void fetchNpcMerchantsFromSupabase().then((rows) => {
      if (!mounted || rows.length === 0) return;
      setSupabaseConnected(true);
      const activeRow = rows.find((r) => r.merchant_id === merchantLocation) || rows[0];
      if (activeRow) {
        setMarketState((prev) => ({
          ...prev,
          treasuryCyon: activeRow.cyon_treasury,
          isShopBroke: activeRow.is_bankrupt,
          dayCounter: activeRow.simulated_day,
          lastMarketHeadline: activeRow.last_headline || prev.lastMarketHeadline,
          stockByItemId: {
            ...prev.stockByItemId,
            ...activeRow.stock_by_item,
          },
          demandByItemId: {
            ...prev.demandByItemId,
            ...activeRow.recent_demand_by_item,
          },
        }));
      }
    });

    const realtimeChannel = subscribeToSocialMessagesRealtime((msg) => {
      if (!mounted) return;
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        const msgType: 'public' | 'private' = msg.recipient_name ? 'private' : 'public';
        const cleanMsgText = msg.message.trim();
        const cleanMsgRecipient = (msg.recipient_name || '').trim().toLowerCase();

        // If this realtime INSERT is the echo of our own optimistic message, upgrade its id in place
        const optimisticIdx = prev.findIndex(
          (m) =>
            m.isSelf &&
            (m.id.startsWith('pub-') || m.id.startsWith('priv-')) &&
            m.type === msgType &&
            m.text.trim() === cleanMsgText &&
            (m.recipientName || '').trim().toLowerCase() === cleanMsgRecipient,
        );
        if (optimisticIdx >= 0) {
          const next = [...prev];
          next[optimisticIdx] = {
            ...next[optimisticIdx],
            id: msg.id,
            senderId: msg.sender_near_account || next[optimisticIdx].senderId,
          };
          return next;
        }

        const incomingMsg: ChatMessage = {
          id: msg.id,
          senderId: msg.sender_near_account || undefined,
          senderName: msg.sender_name,
          recipientName: msg.recipient_name || undefined,
          text: msg.message,
          timestamp: new Date(msg.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          type: msgType,
        };

        const st = socialChatStateRef.current;
        if (
          shouldTriggerIncomingPrivateChatNotification({
            message: incomingMsg,
            localPlayerName: st.playerDisplayName,
            localPlayerUid: st.playerUid,
            isSocialChatModalOpen: st.isSocialChatModalOpen,
            activeTab: st.selectedPrivateUser ? 'private' : 'public',
            selectedPrivateUser: st.selectedPrivateUser,
          })
        ) {
          const senderUser: NearbyEntityUser = {
            id: incomingMsg.senderId || `peer-${incomingMsg.senderName}`,
            nearAccountId: incomingMsg.senderId,
            name: simplifyDisplayName(incomingMsg.senderName),
            isNpc: false,
            distance: 0,
          };
          window.setTimeout(() => {
            soundEngine.playUiClick();
            setUnreadPrivateCount((c) => c + 1);
            setLastUnreadPrivateSender(senderUser);
            setActivePrivateNotificationToast({
              id: incomingMsg.id,
              senderName: simplifyDisplayName(incomingMsg.senderName),
              senderId: incomingMsg.senderId,
              text: incomingMsg.text,
              user: senderUser,
            });
          }, 0);
        }

        return [...prev, incomingMsg];
      });
    });

    const onCustomIncomingSocialMessage = (ev: Event) => {
      if (!mounted) return;
      const detail = (ev as CustomEvent<ChatMessage>).detail;
      if (!detail || !detail.id || !detail.text) return;
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === detail.id)) return prev;
        return [...prev, detail];
      });
      const st = socialChatStateRef.current;
      if (
        shouldTriggerIncomingPrivateChatNotification({
          message: detail,
          localPlayerName: st.playerDisplayName,
          localPlayerUid: st.playerUid,
          isSocialChatModalOpen: st.isSocialChatModalOpen,
          activeTab: st.selectedPrivateUser ? 'private' : 'public',
          selectedPrivateUser: st.selectedPrivateUser,
        })
      ) {
        const senderUser: NearbyEntityUser = {
          id: detail.senderId || `peer-${detail.senderName}`,
          nearAccountId: detail.senderId,
          name: simplifyDisplayName(detail.senderName),
          isNpc: false,
          distance: 0,
        };
        soundEngine.playUiClick();
        setUnreadPrivateCount((c) => c + 1);
        setLastUnreadPrivateSender(senderUser);
        setActivePrivateNotificationToast({
          id: detail.id,
          senderName: simplifyDisplayName(detail.senderName),
          senderId: detail.senderId,
          text: detail.text,
          user: senderUser,
        });
      }
    };
    window.addEventListener('incoming-social-chat-message', onCustomIncomingSocialMessage);

    return () => {
      mounted = false;
      window.removeEventListener('incoming-social-chat-message', onCustomIncomingSocialMessage);
      if (realtimeChannel) {
        void realtimeChannel.unsubscribe();
      }
    };
  }, [merchantLocation]);

  const [selectedTargetUser, setSelectedTargetUser] = useState<NearbyEntityUser | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [profileTargetUser, setProfileTargetUser] = useState<NearbyEntityUser | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const socialChatStateRef = useRef({
    playerDisplayName,
    playerUid: hud.nearWalletId || playerUid,
    isSocialChatModalOpen,
    selectedPrivateUser,
  });
  useEffect(() => {
    socialChatStateRef.current = {
      playerDisplayName,
      playerUid: hud.nearWalletId || playerUid,
      isSocialChatModalOpen,
      selectedPrivateUser,
    };
  }, [playerDisplayName, hud.nearWalletId, playerUid, isSocialChatModalOpen, selectedPrivateUser]);

  useEffect(() => {
    if (!activePrivateNotificationToast) return;
    const timer = window.setTimeout(() => {
      setActivePrivateNotificationToast((prev) =>
        prev?.id === activePrivateNotificationToast.id ? null : prev,
      );
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [activePrivateNotificationToast]);

  useEffect(() => {
    if (isKioskModalOpen && hud.worldMode === 'warzone') {
      setIsKioskModalOpen(false);
    }
  }, [isKioskModalOpen, hud.worldMode]);

  useEffect(() => {
    if (
      activeSpecialModal !== 'none' ||
      isKioskModalOpen ||
      isSocialChatModalOpen ||
      isProfileModalOpen ||
      activeTeleportKioskModal !== 'none'
    ) {
      setIsPersonalWalletModalOpen(false);
    }
  }, [
    activeSpecialModal,
    isKioskModalOpen,
    isSocialChatModalOpen,
    isProfileModalOpen,
    activeTeleportKioskModal,
  ]);
  const [worldMode, setWorldMode] = useState<WorldMode>(() => {
    if (typeof window !== 'undefined') {
      const w = new URLSearchParams(window.location.search).get('world');
      if (w === 'safezone' || w === 'lobby' || w === 'warzone') {
        return w;
      }
    }
    return 'lobby';
  });
  const [worldInitialTeam, setWorldInitialTeam] = useState<'blue' | 'red'>('blue');
  const [worldTransitionCount, setWorldTransitionCount] = useState<number>(0);
  const [isWorldLoading, setIsWorldLoading] = useState<boolean>(false);
  const [loadingTargetMode, setLoadingTargetMode] = useState<WorldMode | null>(null);
  const loadingTimeoutRef = useRef<number | null>(null);
  const loadingCommitTimeoutRef = useRef<number | null>(null);

  const handleRequestWorldModeChange = useCallback(
    (nextMode: WorldMode, team?: 'blue' | 'red') => {
      if (loadingTimeoutRef.current !== null) {
        window.clearTimeout(loadingTimeoutRef.current);
      }
      if (loadingCommitTimeoutRef.current !== null) {
        window.clearTimeout(loadingCommitTimeoutRef.current);
      }
      setIsKioskModalOpen(false);
      setActiveSpecialModal('none');
      setIsInsidePrivateHouse(false);
      setIsSocialChatModalOpen(false);
      setActiveTeleportKioskModal('none');
      window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
      setLoadingTargetMode(nextMode);
      setIsWorldLoading(true);
      if (team) {
        setWorldInitialTeam(team);
      }
      // Allow the browser to paint the solid LOADING... overlay first before remounting the heavy 3D WebGL scene
      loadingCommitTimeoutRef.current = window.setTimeout(() => {
        loadingCommitTimeoutRef.current = null;
        setWorldMode(nextMode);
        setWorldTransitionCount((prev) => prev + 1);
        setHud((prev) => ({
          ...prev,
          worldMode: nextMode,
          isInsideLobbySafezone: nextMode === 'lobby',
          cityArenaMode: nextMode === 'warzone' ? 'warzone' : 'safezone',
          playerTeam: team ?? prev.playerTeam,
          equippedWeapon: nextMode === 'warzone' ? 'BlitzPistol' : 'Unarmed',
          ammo: nextMode === 'warzone' ? 180 : 0,
          hudWeaponBadges:
            nextMode === 'warzone'
              ? [
                  {
                    id: 'slot-pistol',
                    kind: 'handheld',
                    slotId: 'pistol',
                    label: 'PISTOL',
                    weaponName: 'BlitzPistol',
                    ammoCount: 180,
                    maxAmmo: 180,
                    isActive: true,
                    actionEvent: 'selectWeaponPistol',
                  },
                ]
              : [],
        }));
        loadingTimeoutRef.current = window.setTimeout(() => {
          setIsWorldLoading(false);
          setLoadingTargetMode(null);
          loadingTimeoutRef.current = null;
        }, 700);
      }, 50);
    },
    [],
  );

  useEffect(() => {
    const onGlobalBuddyAction = (ev: Event) => {
      const detail = (ev as CustomEvent<string>).detail;
      if (detail === 'enterLobbyPortal:safezone' || detail === 'confirmLobbyEnterSafezoneCity') {
        handleRequestWorldModeChange('safezone');
      } else if (detail === 'enterLobbyPortal:red' || detail === 'confirmLobbyPortalRed') {
        handleRequestWorldModeChange('warzone', 'red');
      } else if (detail === 'enterLobbyPortal:blue' || detail === 'confirmLobbyPortalBlue') {
        handleRequestWorldModeChange('warzone', 'blue');
      } else if (detail === 'returnToLobbySafezone' || detail === 'teleportToLobby') {
        handleRequestWorldModeChange('lobby');
      } else if (typeof detail === 'string' && detail.startsWith('setSafezoneAccessMode:')) {
        const rawMode = detail.slice('setSafezoneAccessMode:'.length).trim().toUpperCase();
        if (rawMode === 'PUBLIC' || rawMode === 'FRIENDS_ONLY' || rawMode === 'PRIVATE') {
          setHud((prev) => ({
            ...prev,
            safezonePlotAccessMode: rawMode,
            kioskStatusMessage: `PLOT ACCESS: ${rawMode === 'FRIENDS_ONLY' ? 'FRIENDS ONLY' : rawMode}`,
          }));
        }
      } else if (typeof detail === 'string' && detail.startsWith('addSafezoneFriend:')) {
        const friendId = detail.slice('addSafezoneFriend:'.length).trim().toLowerCase();
        if (friendId.length > 0) {
          setHud((prev) => {
            const list = prev.safezoneAllowedFriends ?? [];
            return {
              ...prev,
              safezoneAllowedFriends: list.includes(friendId) ? list : [...list, friendId],
              kioskStatusMessage: `FRIEND ADDED: ${friendId}`,
            };
          });
        }
      } else if (typeof detail === 'string' && detail.startsWith('removeSafezoneFriend:')) {
        const friendId = detail.slice('removeSafezoneFriend:'.length).trim().toLowerCase();
        if (friendId.length > 0) {
          setHud((prev) => ({
            ...prev,
            safezoneAllowedFriends: (prev.safezoneAllowedFriends ?? []).filter((f) => f !== friendId),
            kioskStatusMessage: `FRIEND REMOVED: ${friendId}`,
          }));
        }
      }
    };
    window.addEventListener('buddy-action', onGlobalBuddyAction);
    return () => {
      window.removeEventListener('buddy-action', onGlobalBuddyAction);
      if (loadingTimeoutRef.current !== null) {
        window.clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [handleRequestWorldModeChange]);

  const hexContainerRef = useRef<HTMLDivElement | null>(null);
  const [hexRect, setHexRect] = useState<{ left: number; top: number; width: number; height: number }>({
    left: 720,
    top: 140,
    width: 480,
    height: 462,
  });

  useEffect(() => {
    document.body.dataset.state = gameState;
    document.body.dataset.mode = playMode;
  }, [gameState, playMode]);

  const syncHexBounds = useCallback(() => {
    if (!hexContainerRef.current) return;
    const r = hexContainerRef.current.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      setHexRect({
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      });
    }
  }, []);

  useEffect(() => {
    syncHexBounds();
    window.addEventListener('resize', syncHexBounds);
    return () => window.removeEventListener('resize', syncHexBounds);
  }, [syncHexBounds, gameState]);

  const dispatchBuddyAction = useCallback((actionName: string) => {
    window.dispatchEvent(new CustomEvent('buddy-action', { detail: actionName }));
  }, []);

  const handleStartGame = useCallback((shouldReset = false) => {
    soundEngine.playUiClick();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (shouldReset) {
      setResetTrigger((prev) => prev + 1);
    }
    document.body.dataset.state = 'playing';
    setGameState('playing');
  }, []);

  const handleSwitchPlayMode = useCallback((nextMode: PlayMode) => {
    soundEngine.playUiClick();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setPlayMode(nextMode);
    if (gameState !== 'playing') {
      setGameState('playing');
    }
  }, [gameState]);

  const activeBgmMode =
    worldMode === 'warzone' || hud.worldMode === 'warzone' ? 'warzone' : 'city';

  useEffect(() => {
    soundEngine.setBgmMode(activeBgmMode);
    soundEngine.startBgm(activeBgmMode);
  }, [activeBgmMode]);

  const handleToggleAudio = useCallback(() => {
    const nextMuted = !soundEngine.muted;
    soundEngine.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted) {
      if (soundEngine.masterVolume <= 0) {
        soundEngine.setMasterVolume(0.5);
        setAudioVolumePct(50);
      }
      soundEngine.startBgm(
        hudRef.current.worldMode === 'warzone' ? 'warzone' : 'city',
      );
      soundEngine.playUiClick();
    }
  }, []);

  const handleChangeVolumePct = useCallback((nextPct: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(nextPct)));
    setAudioVolumePct(clamped);
    soundEngine.setMasterVolume(clamped / 100);
    if (clamped === 0) {
      soundEngine.muted = true;
      setIsMuted(true);
    } else if (soundEngine.muted) {
      soundEngine.muted = false;
      setIsMuted(false);
      soundEngine.startBgm(
        hudRef.current.worldMode === 'warzone' ? 'warzone' : 'city',
      );
    }
  }, []);

  const handleCycleLighting = useCallback(() => {
    soundEngine.playUiClick();
    setLightingPreset((prev) => {
      const idx = PRESET_ORDER.indexOf(prev);
      return PRESET_ORDER[(idx + 1) % PRESET_ORDER.length];
    });
  }, []);

  const handleToggleFovMode = useCallback(() => {
    soundEngine.playUiClick();
    setCameraFovMode((prev) => (prev === 'webgl35' ? 'ortho18' : 'webgl35'));
  }, []);

  const handleTogglePause = useCallback(() => {
    soundEngine.playUiClick();
    setGameState((prev) => {
      const next = prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev;
      document.body.dataset.state = next;
      return next;
    });
  }, []);

  const handleGameOver = useCallback(
    (_outcome: 'victory' | 'defeat', _snapshot: HudSnapshot) => {
      document.body.dataset.state = 'gameover';
      setGameState('gameover');
    },
    [],
  );

  useEffect(() => {
    const onToggleKiosk = () => {
      setIsKioskModalOpen((prev) => {
        const next = !prev;
        if (next) {
          setActiveSpecialModal('none');
          setIsSocialChatModalOpen(false);
          setActiveTeleportKioskModal('none');
          window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
        }
        return next;
      });
    };
    const onCloseKiosk = () => {
      setIsKioskModalOpen(false);
    };
    const onOpenNpcMerchant = (ev: Event) => {
      if (hudRef.current.worldMode === 'warzone') return;
      const detail = (
        ev as CustomEvent<{ location?: MerchantLocationId; locationId?: MerchantLocationId }>
      ).detail;
      const rawLoc = detail?.location ?? detail?.locationId;
      const loc: MerchantLocationId = rawLoc === 'beach_house' ? 'beach_house' : 'lobby_cafe';
      setIsKioskModalOpen(false);
      setIsSocialChatModalOpen(false);
      setActiveTeleportKioskModal('none');
      window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
      setMerchantLocation(loc);
      setActiveSpecialModal('npc_merchant');
    };
    const onOpenHouseInterior = () => {
      setIsKioskModalOpen(false);
      setIsSocialChatModalOpen(false);
      setActiveTeleportKioskModal('none');
      window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
      setHouseEntryScanState('scanning');
      window.setTimeout(() => {
        soundEngine.playPickup();
        setHouseEntryScanState('verified');
        window.setTimeout(() => {
          setHouseEntryScanState('idle');
          setIsInsidePrivateHouse(true);
          setIsSampleHouseView(false);
          setActiveSpecialModal('none');
        }, 600);
      }, 700);
    };
    const onExitHouseInterior = () => {
      setIsInsidePrivateHouse(false);
      setIsHouseFriendInviteOpen(false);
      setActiveSpecialModal('none');
    };
    const onOpenCharacterProfile = (e: Event) => {
      const customEv = e as CustomEvent<{ user: NearbyEntityUser }>;
      if (customEv.detail?.user) {
        setIsKioskModalOpen(false);
        setIsSocialChatModalOpen(false);
        setIsPersonalWalletModalOpen(false);
        setActiveSpecialModal('none');
        setActiveTeleportKioskModal('none');
        window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
        setProfileTargetUser(customEv.detail.user);
        setIsProfileModalOpen(true);
      }
    };
    const onCloseCharacterProfile = () => {
      setIsProfileModalOpen(false);
      setProfileTargetUser(null);
    };
    const onOpenSocialChatWhisper = (e: Event) => {
      const customEv = e as CustomEvent<{ user: NearbyEntityUser }>;
      if (customEv.detail?.user && !customEv.detail.user.isNpc) {
        setIsKioskModalOpen(false);
        setIsProfileModalOpen(false);
        setIsPersonalWalletModalOpen(false);
        setActiveSpecialModal('none');
        setActiveTeleportKioskModal('none');
        window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
        setSelectedPrivateUser(customEv.detail.user);
        setIsSocialChatModalOpen(true);
      }
    };
    const onCharacterSelected = (e: Event) => {
      const customEv = e as CustomEvent<{ user: NearbyEntityUser }>;
      if (customEv.detail?.user) {
        setSelectedTargetUser(customEv.detail.user);
        setIsTargetMenuExpanded(false);
      }
    };
    const onCharacterDeselected = () => {
      setSelectedTargetUser(null);
      setIsTargetMenuExpanded(false);
    };
    const onOpenTeleportKioskModal = (e: Event) => {
      if (hudRef.current.worldMode === 'warzone') return;
      const customEv = e as CustomEvent<{
        kind:
          | CityTransitStationId
          | 'lobby_warzone'
          | 'lobby_safezone'
          | 'halte_to_lobby';
      }>;
      const k = customEv.detail?.kind;
      if (k) {
        const resolvedStationId: CityTransitStationId =
          k === 'lobby_warzone' || k === 'lobby_safezone' || k === 'halte_to_lobby'
            ? 'central_plaza'
            : k;
        setIsKioskModalOpen(false);
        setActiveSpecialModal('none');
        setIsSocialChatModalOpen(false);
        setActiveTeleportKioskModal(resolvedStationId);
      }
    };
    const onCloseTeleportKioskModal = () => {
      setActiveTeleportKioskModal('none');
    };
    const onCityTramRideProgress = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          originStationId: CityTransitStationId;
          destinationStationId: CityTransitStationId;
          progress01: number;
        }>
      ).detail;
      if (detail) {
        setTramRideCutsceneUi({
          active: true,
          originStationId: detail.originStationId,
          destinationStationId: detail.destinationStationId,
          progress01: detail.progress01,
        });
      }
    };
    const onCityTramRideComplete = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          destinationStationId: CityTransitStationId;
          worldMode: WorldMode;
          team?: 'blue' | 'red';
        }>
      ).detail;
      setTramRideCutsceneUi(null);
      if (detail) {
        setWorldMode(detail.worldMode);
        if (detail.team) {
          setWorldInitialTeam(detail.team);
        }
        setHud((prev) => ({
          ...prev,
          worldMode: detail.worldMode,
          isInsideLobbySafezone: detail.destinationStationId === 'central_plaza',
          cityArenaMode: detail.worldMode === 'warzone' ? 'warzone' : 'safezone',
          playerTeam: detail.team ?? prev.playerTeam,
        }));
      }
    };
    window.addEventListener('toggle-kiosk-ui', onToggleKiosk);
    window.addEventListener('close-kiosk-ui', onCloseKiosk);
    window.addEventListener('open-npc-merchant-ui', onOpenNpcMerchant);
    window.addEventListener('open-house-interior-ui', onOpenHouseInterior);
    window.addEventListener('exit-house-interior-ui', onExitHouseInterior);
    window.addEventListener('open-character-profile-modal', onOpenCharacterProfile);
    window.addEventListener('close-character-profile-modal', onCloseCharacterProfile);
    window.addEventListener('open-social-chat-whisper', onOpenSocialChatWhisper);
    window.addEventListener('character-selected', onCharacterSelected);
    window.addEventListener('character-deselected', onCharacterDeselected);
    window.addEventListener('open-teleport-kiosk-modal', onOpenTeleportKioskModal);
    window.addEventListener('close-teleport-kiosk-modal', onCloseTeleportKioskModal);
    window.addEventListener('city-tram-ride-progress', onCityTramRideProgress);
    window.addEventListener('city-tram-ride-complete', onCityTramRideComplete);
    return () => {
      window.removeEventListener('toggle-kiosk-ui', onToggleKiosk);
      window.removeEventListener('close-kiosk-ui', onCloseKiosk);
      window.removeEventListener('open-npc-merchant-ui', onOpenNpcMerchant);
      window.removeEventListener('open-house-interior-ui', onOpenHouseInterior);
      window.removeEventListener('exit-house-interior-ui', onExitHouseInterior);
      window.removeEventListener('open-character-profile-modal', onOpenCharacterProfile);
      window.removeEventListener('close-character-profile-modal', onCloseCharacterProfile);
      window.removeEventListener('open-social-chat-whisper', onOpenSocialChatWhisper);
      window.removeEventListener('character-selected', onCharacterSelected);
      window.removeEventListener('character-deselected', onCharacterDeselected);
      window.removeEventListener('open-teleport-kiosk-modal', onOpenTeleportKioskModal);
      window.removeEventListener('close-teleport-kiosk-modal', onCloseTeleportKioskModal);
      window.removeEventListener('city-tram-ride-progress', onCityTramRideProgress);
      window.removeEventListener('city-tram-ride-complete', onCityTramRideComplete);
    };
  }, []);

  useEffect(() => {
    const target: 'none' | 'hana' | 'kiosk' =
      tutorialStage === 'go_to_hana'
        ? 'hana'
        : tutorialStage === 'go_to_kiosk'
          ? 'kiosk'
          : 'none';
    window.dispatchEvent(
      new CustomEvent('set-tutorial-waypoint', {
        detail: { target },
      }),
    );
  }, [tutorialStage]);

  useEffect(() => {
    if (onboardingStep !== 'subwallet_naming') return;
    let cancelled = false;
    const clean = subWalletHandleDraft
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 32);
    const fullSubId = clean ? `${clean}.${NEAR_CONFIG.masterAccountId}` : '';
    if (clean.length < 2) {
      setSubWalletAvailability({
        checking: false,
        validFormat: false,
        available: false,
        ownedByCurrentDevice: false,
        subAccountId: fullSubId,
        reason: 'Use at least 2 lowercase letters or numbers (e.g. xyz).',
      });
      return;
    }
    setSubWalletAvailability((prev) => ({
      ...prev,
      checking: true,
      subAccountId: fullSubId,
    }));
    const timer = window.setTimeout(() => {
      void checkCitizenSubAccountAvailability(clean).then((res) => {
        if (cancelled) return;
        setSubWalletAvailability({
          checking: false,
          validFormat: res.validFormat,
          available: res.available,
          ownedByCurrentDevice: res.ownedByCurrentDevice,
          subAccountId: res.subAccountId,
          reason: res.reason,
        });
      });
    }, 260);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [onboardingStep, subWalletHandleDraft]);

  useEffect(() => {
    const effectiveMode =
      onboardingStep === 'guest_character_select'
        ? 'character_select'
        : activeSpecialModal === 'none' && isInsidePrivateHouse
          ? 'house_visit'
          : activeSpecialModal;
    const syncDetail = {
      mode: effectiveMode,
      location: merchantLocation,
      themeId: activeHouseThemeId,
      isSampleHouse: isSampleHouseView,
      placement: interiorPlacement,
      onboardingCompleted: onboardingStep === 'completed',
      characterGender,
      playerDisplayName: playerDisplayName.trim() || 'CITIZEN',
      nearWalletId: hud.nearWalletConnected ? hud.nearWalletId : null,
      houseOwnerKey: isSampleHouseView
        ? 'sample'
        : (hud.nearWalletId || playerUid || 'private').toLowerCase(),
    };
    (
      window as unknown as {
        __bb_multiplayer_app_sync?: typeof syncDetail;
      }
    ).__bb_multiplayer_app_sync = syncDetail;
    window.dispatchEvent(
      new CustomEvent('sync-npc-camera-mode', {
        detail: syncDetail,
      }),
    );
  }, [
    onboardingStep,
    activeSpecialModal,
    isInsidePrivateHouse,
    isSampleHouseView,
    merchantLocation,
    activeHouseThemeId,
    interiorPlacement,
    characterGender,
    playerDisplayName,
    hud.nearWalletConnected,
    hud.nearWalletId,
    playerUid,
    worldTransitionCount,
  ]);

  useEffect(() => {
    const cleanName = playerDisplayName.trim() || 'YOU';
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('bb_active_display_name', cleanName);
    }
    dispatchBuddyAction(`setCharacterGender:${characterGender}`);
    dispatchBuddyAction(`setPlayerDisplayName:${cleanName}`);
    const t1 = window.setTimeout(() => {
      dispatchBuddyAction(`setCharacterGender:${characterGender}`);
      dispatchBuddyAction(`setPlayerDisplayName:${cleanName}`);
    }, 320);
    return () => window.clearTimeout(t1);
  }, [characterGender, playerDisplayName, worldMode, worldTransitionCount, dispatchBuddyAction]);

  const persistWalletProfileLocally = useCallback(
    (
      walletId: string,
      displayName: string,
      gender: 'male' | 'female',
      googleEmailOverride?: string,
    ) => {
      if (typeof window === 'undefined') return;
      const cleanWallet = walletId.trim().toLowerCase();
      if (!cleanWallet) return;
      try {
        window.localStorage.setItem('bb_last_connected_wallet_id_v2', cleanWallet);
        window.localStorage.setItem('bb_explicit_logged_out_v1', '0');
        const rawMap = window.localStorage.getItem('bb_saved_wallet_profiles_v2');
        const map: Record<string, { displayName: string; gender: 'male' | 'female' }> = rawMap
          ? JSON.parse(rawMap)
          : {};
        map[cleanWallet] = { displayName, gender };
        window.localStorage.setItem('bb_saved_wallet_profiles_v2', JSON.stringify(map));

        const activeEmail = (
          googleEmailOverride ||
          window.localStorage.getItem('bb_connected_google_email_v2') ||
          ''
        )
          .trim()
          .toLowerCase();
        if (activeEmail && activeEmail.includes('@')) {
          const rawEmailMap = window.localStorage.getItem('bb_wallet_by_google_email_v2');
          const emailMap: Record<string, string> = rawEmailMap ? JSON.parse(rawEmailMap) : {};
          emailMap[activeEmail] = cleanWallet;
          window.localStorage.setItem('bb_wallet_by_google_email_v2', JSON.stringify(emailMap));
        }
        setSavedWalletSummary({ walletId: cleanWallet, displayName, gender });
      } catch {
        // ignore storage errors
      }
    },
    [],
  );

  const refreshWalletTransactions = useCallback(async () => {
    setIsLoadingWalletTransactions(true);
    try {
      const activeAccount = hudRef.current.nearWalletId || playerUid || null;
      const rows = await fetchMarketTransactionsFromSupabase(activeAccount, 50);
      setWalletTransactions(rows);
    } finally {
      setIsLoadingWalletTransactions(false);
    }
  }, [playerUid]);

  useEffect(() => {
    const unsub = subscribeToMarketTransactions(() => {
      void refreshWalletTransactions();
    });
    return () => {
      unsub();
    };
  }, [refreshWalletTransactions]);

  useEffect(() => {
    if (isPersonalWalletModalOpen) {
      void refreshWalletTransactions();
    }
  }, [isPersonalWalletModalOpen, personalWalletTab, refreshWalletTransactions]);

  const handleConnectWalletAndEnterLobby = useCallback(
    async (
      rawWalletInput: string,
      options?: {
        silentRestore?: boolean;
        googleEmail?: string;
        onboardingMode?: 'social_invisible' | 'wallet_selector';
        preverifiedResult?: NearWalletConnectionResult;
      },
    ) => {
      if (!options?.silentRestore) {
        soundEngine.playUiClick();
      }
      setWalletConnectError(null);
      const cleanInput = rawWalletInput.trim().toLowerCase();
      if (!cleanInput) {
        setIsNearWalletSelectorOpen(true);
        return;
      }

      const explicitGoogleEmail = (options?.googleEmail ?? '').trim().toLowerCase();
      const resolvedEmail =
        explicitGoogleEmail && explicitGoogleEmail.includes('@')
          ? explicitGoogleEmail
          : cleanInput.includes('@')
            ? cleanInput
            : typeof window !== 'undefined'
              ? window.localStorage.getItem('bb_connected_google_email_v2') || ''
              : '';
      if (resolvedEmail && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('bb_connected_google_email_v2', resolvedEmail);
        } catch {
          // ignore
        }
        setConnectedGoogleEmail(resolvedEmail);
      }

      const normalizedWallet = options?.preverifiedResult?.accountId
        ? options.preverifiedResult.accountId.trim().toLowerCase()
        : cleanInput;

      setIsVerifyingNearWallet(true);
      const detectedNet: NearNetworkId = normalizedWallet.endsWith('.near')
        ? 'mainnet'
        : walletNetworkChoice;
      const isCitizenInvisible = options?.onboardingMode === 'social_invisible';
      const accountView = await fetchNearAccountView(normalizedWallet);
      setNearOnChainAccountView(accountView);

      if (!accountView && !isCitizenInvisible) {
        setIsVerifyingNearWallet(false);
        if (!options?.silentRestore) {
          setWalletConnectError(
            `Account "${normalizedWallet}" was not found on NEAR ${detectedNet} RPC.`,
          );
        }
        return;
      }

      const nearTokens = accountView ? Number(accountView.amount) / 1e24 : 0;
      setNearTestnetBalance(
        Number.isFinite(nearTokens) ? Number(nearTokens.toFixed(4)) : 0,
      );

      const [onChainRespiteRaw, onChainEstate, gamepassVerify, hanaStatus] = await Promise.all([
        fetchNep141Balance(NEAR_CONFIG.nep141RespiteContractId, normalizedWallet),
        fetchBuddiesMarketEstate(normalizedWallet),
        verifyNep171GamepassOwnership(normalizedWallet),
        fetchHanaTreasuryStatus(normalizedWallet),
      ]);
      setHanaWelcomeNearClaimed(Boolean(hanaStatus.callerAlreadyClaimed));
      const estateRespite = Number(onChainEstate?.respite_balance || '0') || 0;
      const onChainRespite = Math.max(Number(onChainRespiteRaw || '0') || 0, estateRespite);
      if (onChainRespite > 0) {
        setRespiteBalance(onChainRespite);
      }
      if (onChainEstate && Array.isArray(onChainEstate.family_contracts) && onChainEstate.family_contracts.length > 0) {
        setRecruitedFamilyMembers(
          onChainEstate.family_contracts.map((fc, idx) => {
            const plan =
              FAMILY_MEMBER_CONTRACT_PLANS.find((p) => p.id === fc.plan_id) ||
              FAMILY_MEMBER_CONTRACT_PLANS[0];
            return {
              agentId: fc.contract_id,
              name: `FAMILY MEMBER #${fc.member_number || idx + 1}`,
              contractAddress: `family-${fc.member_number || idx + 1}.${NEAR_CONFIG.masterAccountId}`,
              planId: plan.id,
              planLabel: plan.shortLabel,
              pricePaidRespite: Number(fc.price_paid_respite || plan.priceRespite) || plan.priceRespite,
              recruitedAtIso: new Date(fc.hired_at_ms || Date.now()).toISOString(),
              expiresAtIso: new Date(fc.expires_at_ms || Date.now() + 7 * 86400_000).toISOString(),
              activeOrder: (fc.active_order as RecruitedFamilyMemberAgent['activeOrder']) || 'collect_boxes',
              nearTxHash: '',
            };
          }),
        );
      }

      const ownsHouseVerified = Boolean(gamepassVerify.verified || onChainEstate?.owns_house);
      const verifiedTokenId =
        gamepassVerify.token?.tokenId ?? onChainEstate?.house_deed?.deed_token_id ?? null;
      setIsVerifyingNearWallet(false);

      let restoredGender: 'male' | 'female' = characterGender;
      let restoredName = normalizedWallet.split('.')[0].toUpperCase();
      if (typeof window !== 'undefined') {
        try {
          const rawMap = window.localStorage.getItem('bb_saved_wallet_profiles_v2');
          if (rawMap) {
            const parsed = JSON.parse(rawMap) as Record<
              string,
              { displayName: string; gender: 'male' | 'female' }
            >;
            const saved = parsed[normalizedWallet];
            if (saved) {
              restoredGender = saved.gender;
              restoredName = saved.displayName;
            }
          }
        } catch {
          // ignore
        }
      }

      setPlayerUid(normalizedWallet);
      setWalletConnectInput(normalizedWallet);
      setCharacterGender(restoredGender);
      setPlayerDisplayName(restoredName);
      setWalletUsernameDraft(restoredName);
      setOnboardingAuthMode('wallet');
      setOnboardingStep('completed');
      setGameState('playing');
      setHasHouseOwnership(ownsHouseVerified);

      dispatchBuddyAction(
        `nearSyncWalletSession:${normalizedWallet}:${ownsHouseVerified ? '1' : '0'}:${verifiedTokenId || ''}`,
      );
      dispatchBuddyAction(`setCharacterGender:${restoredGender}`);
      dispatchBuddyAction(`setPlayerDisplayName:${restoredName}`);
      setHud((prev) => ({
        ...prev,
        nearWalletConnected: true,
        nearWalletId: normalizedWallet,
        nearHasGamepassNft: ownsHouseVerified,
        nearGamepassTokenId: verifiedTokenId,
      }));
      persistWalletProfileLocally(normalizedWallet, restoredName, restoredGender, resolvedEmail);

      void fetchGamepassNftLedgerFromSupabase(verifiedTokenId || undefined).then(
        (remoteLedger) => {
          if (remoteLedger) {
            setNep171Ledger(remoteLedger);
          } else {
            setNep171Ledger((prev) => ({
              ...prev,
              tokenId: verifiedTokenId || prev.tokenId,
              ownerNearAccount: normalizedWallet,
            }));
          }
        },
      );

      void fetchHouseInteriorFromSupabase(normalizedWallet).then((interior) => {
        if (!interior) return;
        if (interior.active_theme_id) {
          setActiveHouseThemeId(interior.active_theme_id);
        }
        const firstPlacement = interior.placed_furniture?.[0] as
          | HouseInteriorPlacementState
          | undefined;
        if (firstPlacement && typeof firstPlacement === 'object') {
          setInteriorPlacement((prev) => ({
            ...prev,
            ...firstPlacement,
          }));
        }
      });

      void fetchOrCreatePlayerProfile({
        nearAccountId: normalizedWallet,
        displayName: restoredName,
        authMode: isCitizenInvisible ? 'social_invisible' : 'wallet_selector',
        email: resolvedEmail || undefined,
      }).then((profile) => {
        if (profile) {
          setSupabaseConnected(true);
          setCyonBalance(profile.cyon_balance);
          if (onChainRespite <= 0) {
            setRespiteBalance(profile.respite_balance);
          }
          if (Array.isArray(profile.owned_token_ids)) {
            setOwnedMerchantItemIds(profile.owned_token_ids);
          }
          const dbGenderTag = profile.unlocked_skins?.find(
            (s) => s === 'gender:male' || s === 'gender:female',
          );
          const finalGender: 'male' | 'female' =
            dbGenderTag === 'gender:female'
              ? 'female'
              : dbGenderTag === 'gender:male'
                ? 'male'
                : restoredGender;
          const finalName = profile.display_name || restoredName;
          setCharacterGender(finalGender);
          setPlayerDisplayName(finalName);
          setWalletUsernameDraft(finalName);
          dispatchBuddyAction(`setCharacterGender:${finalGender}`);
          dispatchBuddyAction(`setPlayerDisplayName:${finalName}`);
          persistWalletProfileLocally(normalizedWallet, finalName, finalGender, resolvedEmail);
        }
      });
    },
    [characterGender, dispatchBuddyAction, persistWalletProfileLocally, walletNetworkChoice],
  );

  const {
    ready: privyReady,
    authenticated: privyAuthenticated,
    user: privyUser,
    logout: privyLogout,
  } = useSafePrivy();
  const pendingPrivyGoogleFlowRef = useRef<boolean>(false);

  const resolveAndRestoreExistingGoogleWallet = useCallback(
    async (rawEmail?: string): Promise<boolean> => {
      const cleanEmail = (rawEmail ?? '').trim().toLowerCase();
      if (cleanEmail && cleanEmail.includes('@') && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('bb_connected_google_email_v2', cleanEmail);
          window.sessionStorage.removeItem('bb_pending_privy_google_login');
        } catch {
          // ignore
        }
        setConnectedGoogleEmail(cleanEmail);

        const remoteProfile = await fetchPlayerProfileByEmail(cleanEmail);
        if (remoteProfile && remoteProfile.near_account_id) {
          await handleConnectWalletAndEnterLobby(remoteProfile.near_account_id, {
            silentRestore: true,
            googleEmail: cleanEmail,
          });
          return true;
        }

        const suggestedCitizenName = cleanEmail
          .split('@')[0]
          .replace(/[^a-zA-Z0-9_-]/g, '')
          .slice(0, 20);
        if (suggestedCitizenName && !isCustomGuestNameEdited) {
          setPlayerDisplayName(suggestedCitizenName);
          setWalletUsernameDraft(suggestedCitizenName);
        }
        if (suggestedCitizenName) {
          setSubWalletHandleDraft(
            suggestedCitizenName
              .toLowerCase()
              .replace(/[^a-z0-9_-]/g, '')
              .slice(0, 24),
          );
        }
      }

      setOnboardingAuthMode('wallet');
      setOnboardingStep('guest_character_select');
      return false;
    },
    [handleConnectWalletAndEnterLobby, isCustomGuestNameEdited],
  );

  const {
    initGoogleOAuth,
    loading: privyOAuthLoading,
  } = useSafePrivyLogin({
    onComplete: ({ user, wasAlreadyAuthenticated }) => {
      const googleEmail = user?.google?.email || user?.email?.address || '';
      const hasPendingRedirect =
        typeof window !== 'undefined' &&
        (window.sessionStorage.getItem('bb_pending_privy_google_login') === '1' ||
          window.location.search.includes('privy_oauth_'));

      if (pendingPrivyGoogleFlowRef.current || hasPendingRedirect || !wasAlreadyAuthenticated) {
        pendingPrivyGoogleFlowRef.current = false;
        setIsVerifyingNearWallet(false);
        void resolveAndRestoreExistingGoogleWallet(googleEmail);
      } else if (googleEmail) {
        setConnectedGoogleEmail(googleEmail);
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem('bb_connected_google_email_v2', googleEmail);
          } catch {
            // ignore
          }
        }
      }
    },
    onError: (err) => {
      pendingPrivyGoogleFlowRef.current = false;
      setIsVerifyingNearWallet(false);
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.removeItem('bb_pending_privy_google_login');
        } catch {
          // ignore
        }
      }
      const errMsg =
        err instanceof Error
          ? err.message
          : typeof err === 'string' && err.trim()
            ? err
            : 'Google OAuth could not be completed. Please try again or continue with Character Selection below.';
      setWalletConnectError(errMsg);
    },
  });

  const handleStartGoogleLoginAndOpenWalletNaming = useCallback(
    async (rawEmailInput?: string) => {
      soundEngine.playUiClick();
      setWalletConnectError(null);
      const cleanEmail = (rawEmailInput ?? '').trim().toLowerCase();

      if (cleanEmail && cleanEmail.includes('@')) {
        await resolveAndRestoreExistingGoogleWallet(cleanEmail);
        return;
      }

      if (privyReady && privyAuthenticated) {
        const activePrivyEmail =
          privyUser?.google?.email || privyUser?.email?.address || connectedGoogleEmail;
        await resolveAndRestoreExistingGoogleWallet(activePrivyEmail);
        return;
      }

      if (privyReady && !privyAuthenticated) {
        pendingPrivyGoogleFlowRef.current = true;
        setIsVerifyingNearWallet(true);
        if (typeof window !== 'undefined') {
          try {
            window.sessionStorage.setItem('bb_pending_privy_google_login', '1');
          } catch {
            // ignore
          }
        }
        try {
          await initGoogleOAuth();
          return;
        } catch (err) {
          pendingPrivyGoogleFlowRef.current = false;
          setIsVerifyingNearWallet(false);
          const oauthRes = await signInWithSupabaseGoogle();
          if (oauthRes.started) {
            return;
          }
          setWalletConnectError(
            err instanceof Error
              ? err.message
              : oauthRes.error || 'Unable to start Google OAuth right now.',
          );
          return;
        }
      }

      setIsVerifyingNearWallet(true);
      const oauthRes = await signInWithSupabaseGoogle();
      setIsVerifyingNearWallet(false);
      if (oauthRes.started) {
        return;
      }
      setWalletConnectError(
        oauthRes.error ||
          'Google OAuth is not available in this session. Select your character and Citizen Username below.',
      );
    },
    [
      connectedGoogleEmail,
      initGoogleOAuth,
      privyAuthenticated,
      privyReady,
      privyUser,
      resolveAndRestoreExistingGoogleWallet,
    ],
  );

  useEffect(() => {
    const unsubSigningWallet = onNearSigningWalletConnected((walletRes) => {
      if (walletRes?.accountId) {
        void handleConnectWalletAndEnterLobby(walletRes.accountId, {
          silentRestore: true,
          preverifiedResult: walletRes,
        });
      }
    });
    return () => {
      unsubSigningWallet();
    };
  }, [handleConnectWalletAndEnterLobby]);

  useEffect(() => {
    let cancelled = false;
    if (typeof window !== 'undefined') {
      void (async () => {
        try {
          const params = new URLSearchParams(window.location.search);
          const callbackAccountId = params.get('account_id');
          if (callbackAccountId) {
            await handleConnectWalletAndEnterLobby(callbackAccountId, { silentRestore: true });
            return;
          }

          const explicitlyLoggedOut =
            window.localStorage.getItem('bb_explicit_logged_out_v1') === '1';
          if (explicitlyLoggedOut) return;

          // 1. Prefer restoring an active @hot-labs/near-connect signing wallet session first
          const restoredSigner = await restoreConnectedNearSigningWallet('testnet');
          if (!cancelled && restoredSigner?.accountId) {
            await handleConnectWalletAndEnterLobby(restoredSigner.accountId, {
              silentRestore: true,
              preverifiedResult: restoredSigner,
            });
            return;
          }

          // 2. Fallback to saved Citizen / Wallet handle, strictly excluding root faucet 'testnet' / 'testnet.near'
          const lastId = window.localStorage.getItem('bb_last_connected_wallet_id_v2');
          const lowerLast = (lastId || '').trim().toLowerCase();
          if (lowerLast === 'testnet' || lowerLast === 'testnet.near') {
            window.localStorage.removeItem('bb_last_connected_wallet_id_v2');
            return;
          }
          if (
            !cancelled &&
            lastId &&
            !lowerLast.startsWith('player1.') &&
            !lowerLast.startsWith('guest') &&
            !lowerLast.endsWith('.buddiesblitz-master.testnet')
          ) {
            await handleConnectWalletAndEnterLobby(lastId, { silentRestore: true });
          }
        } catch {
          // ignore
        }
      })();
    }
    const unsubGoogle = subscribeToSupabaseAuthUser((user) => {
      if (user?.email) {
        void resolveAndRestoreExistingGoogleWallet(user.email);
      }
    });
    return () => {
      cancelled = true;
      unsubGoogle();
    };
  }, [handleConnectWalletAndEnterLobby, resolveAndRestoreExistingGoogleWallet]);

  useEffect(() => {
    if (!privyReady || !privyAuthenticated) return;
    const hasPendingRedirect =
      typeof window !== 'undefined' &&
      (window.sessionStorage.getItem('bb_pending_privy_google_login') === '1' ||
        window.location.search.includes('privy_oauth_'));
    if (hasPendingRedirect) {
      const googleEmail = privyUser?.google?.email || privyUser?.email?.address || '';
      void resolveAndRestoreExistingGoogleWallet(googleEmail);
    }
  }, [privyAuthenticated, privyReady, privyUser, resolveAndRestoreExistingGoogleWallet]);

  const handleUpdatePlayerUsername = useCallback(
    (rawNewName: string) => {
      const cleanName = rawNewName.trim().slice(0, 24);
      if (!cleanName) return;
      setPlayerDisplayName(cleanName);
      setWalletUsernameDraft(cleanName);
      setIsCustomGuestNameEdited(true);
      dispatchBuddyAction(`setPlayerDisplayName:${cleanName}`);

      setSelectedTargetUser((prev) => {
        if (!prev) return prev;
        const isSelf =
          Boolean(prev.isSelf) ||
          String(prev.id) === '0' ||
          (!prev.isNpc &&
            Boolean(playerDisplayName.trim()) &&
            prev.name.trim().toUpperCase() === playerDisplayName.trim().toUpperCase()) ||
          prev.name.toUpperCase().includes('KAMU') ||
          prev.name.toUpperCase().includes('YOU');
        return isSelf ? { ...prev, id: 0, isSelf: true, name: cleanName } : prev;
      });
      setProfileTargetUser((prev) => {
        if (!prev) return prev;
        const isSelf =
          Boolean(prev.isSelf) ||
          String(prev.id) === '0' ||
          (!prev.isNpc &&
            Boolean(playerDisplayName.trim()) &&
            prev.name.trim().toUpperCase() === playerDisplayName.trim().toUpperCase()) ||
          prev.name.toUpperCase().includes('KAMU') ||
          prev.name.toUpperCase().includes('YOU');
        return isSelf ? { ...prev, id: 0, isSelf: true, name: cleanName } : prev;
      });

      const activeUid =
        hudRef.current.nearWalletId || playerUid || nep171Ledger.ownerNearAccount;
      if (activeUid) {
        persistWalletProfileLocally(activeUid, cleanName, characterGender);
        void syncPlayerBalancesToSupabase({
          nearAccountId: activeUid,
          displayName: cleanName,
          lulBalance: hudRef.current.gold,
          cyonBalance,
          respiteBalance,
          unlockedSkins: ['default', `gender:${characterGender}`],
        });
      }
    },
    [
      characterGender,
      cyonBalance,
      dispatchBuddyAction,
      nep171Ledger.ownerNearAccount,
      persistWalletProfileLocally,
      playerDisplayName,
      playerUid,
      respiteBalance,
    ],
  );

  const handleConfirmGuestCharacterAndEnterLobby = useCallback(() => {
    soundEngine.playUiClick();
    setWalletConnectError(null);
    const cleanGuestName =
      playerDisplayName.trim() || (characterGender === 'male' ? 'Buddy Male' : 'Buddy Female');
    setPlayerDisplayName(cleanGuestName);
    setWalletUsernameDraft(cleanGuestName);

    // Linear Google Login Flow: Step 1 (Character + Name) -> Step 2 (Sub-Wallet Handle `xyz.buddiesblitz.testnet`)
    if (onboardingAuthMode === 'wallet') {
      if (!subWalletHandleDraft.trim()) {
        const candidateHandle = cleanGuestName
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '')
          .slice(0, 24);
        setSubWalletHandleDraft(candidateHandle.length >= 2 ? candidateHandle : '');
      }
      setOnboardingStep('subwallet_naming');
      return;
    }

    // Play as Guest Flow: Enter Central Plaza without registration (Exchange / Purchases / Mint gated)
    setPlayerUid('');
    setRespiteBalance(0);
    setCyonBalance(0);
    setNearTestnetBalance(0);
    setHasHouseOwnership(false);
    setHanaWelcomeNearClaimed(false);
    setTutorialStage('none');
    setOnboardingAuthMode('guest');
    setOnboardingLoadingProgress(10);
    setOnboardingStep('entering_lobby');
    dispatchBuddyAction('nearDisconnectSession');
    dispatchBuddyAction(`adjustPlayerLul:${-Math.max(0, hudRef.current.gold)}`);
    dispatchBuddyAction(`setCharacterGender:${characterGender}`);
    dispatchBuddyAction(`setPlayerDisplayName:${cleanGuestName}`);
    setHud((prev) => ({
      ...prev,
      gold: 0,
      nearWalletConnected: false,
      nearWalletId: null,
      nearHasGamepassNft: false,
      nearGamepassTokenId: null,
    }));
  }, [
    characterGender,
    dispatchBuddyAction,
    onboardingAuthMode,
    playerDisplayName,
    subWalletHandleDraft,
  ]);

  const handleProvisionSubWalletAndShowWelcome = useCallback(async () => {
    soundEngine.playUiClick();
    setWalletConnectError(null);
    const cleanHandle = subWalletHandleDraft
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 32);
    if (cleanHandle.length < 2) {
      setWalletConnectError('Wallet username must be at least 2 characters.');
      return;
    }

    const cleanCitizenName =
      playerDisplayName.trim() || (characterGender === 'male' ? 'Buddy Male' : 'Buddy Female');
    const activeEmail = connectedGoogleEmail.trim().toLowerCase();

    setOnboardingStep('provisioning_subwallet');
    setOnboardingLoadingProgress(22);
    setSubWalletProvisionStageLabel('Creating your wallet...');

    const stageTimer1 = window.setTimeout(() => {
      setOnboardingLoadingProgress(56);
      setSubWalletProvisionStageLabel(
        `Registering ${cleanHandle}.${NEAR_CONFIG.masterAccountId}...`,
      );
    }, 380);

    const provisioned = await spawnSubAccountOnChainViaMaster({
      handle: cleanHandle,
      email: activeEmail || undefined,
      strictUniqueHandle: true,
    });
    window.clearTimeout(stageTimer1);

    if (!provisioned.ok || !provisioned.subAccountId) {
      soundEngine.playHit();
      setOnboardingStep('subwallet_naming');
      setWalletConnectError(
        provisioned.error ||
          `Could not register ${cleanHandle}.${NEAR_CONFIG.masterAccountId}. Try another name.`,
      );
      return;
    }

    const walletId = provisioned.subAccountId.toLowerCase();
    setOnboardingLoadingProgress(85);
    setSubWalletProvisionStageLabel('Loading Central Plaza...');
    setProvisionedSubWalletTxHash(provisioned.txHash || '');

    const [accountView, hanaStatus] = await Promise.all([
      fetchNearAccountView(walletId),
      fetchHanaTreasuryStatus(walletId),
    ]);
    const nearTokens = accountView ? Number(accountView.amount) / 1e24 : 0.06;
    setNearTestnetBalance(Number.isFinite(nearTokens) ? Number(nearTokens.toFixed(4)) : 0.06);
    setRespiteBalance(0);
    setCyonBalance(0);
    setHasHouseOwnership(false);
    setHanaWelcomeNearClaimed(Boolean(hanaStatus.callerAlreadyClaimed));

    setPlayerUid(walletId);
    setWalletConnectInput(walletId);
    persistWalletProfileLocally(walletId, cleanCitizenName, characterGender, activeEmail);
    dispatchBuddyAction(`nearSyncWalletSession:${walletId}:0:`);
    dispatchBuddyAction(`setCharacterGender:${characterGender}`);
    dispatchBuddyAction(`setPlayerDisplayName:${cleanCitizenName}`);
    setHud((prev) => ({
      ...prev,
      nearWalletConnected: true,
      nearWalletId: walletId,
      nearHasGamepassNft: false,
      nearGamepassTokenId: null,
    }));

    void fetchOrCreatePlayerProfile({
      nearAccountId: walletId,
      displayName: cleanCitizenName,
      authMode: 'social_invisible',
      email: activeEmail || undefined,
    }).then((profile) => {
      if (profile) {
        setSupabaseConnected(true);
        void syncPlayerBalancesToSupabase({
          nearAccountId: walletId,
          displayName: cleanCitizenName,
          lulBalance: 0,
          cyonBalance: 0,
          respiteBalance: 0,
          unlockedSkins: ['default', `gender:${characterGender}`],
        });
      }
    });

    setOnboardingLoadingProgress(100);
    soundEngine.playPickup();
    setOnboardingStep('completed');
    setGameState('playing');
    setTutorialStage('welcome_modal');
  }, [
    characterGender,
    connectedGoogleEmail,
    dispatchBuddyAction,
    persistWalletProfileLocally,
    playerDisplayName,
    subWalletHandleDraft,
  ]);

  const handleClaimHanaWelcomeNear = useCallback(async () => {
    const actorAccount = (hudRef.current.nearWalletId || playerUid || '').trim().toLowerCase();
    if (!actorAccount) {
      return {
        ok: false,
        txHash: '',
        explorerUrl: '',
        amountNear: 0,
        error: 'Wallet is not connected yet. Please register or connect first.',
      };
    }

    const claimRes = await claimHanaWelcomeNearOnChain(actorAccount);
    if (!claimRes.ok) {
      return claimRes;
    }

    setHanaWelcomeNearClaimed(true);
    const updatedView = await fetchNearAccountView(actorAccount);
    if (updatedView) {
      const nearTokens = Number(updatedView.amount) / 1e24;
      if (Number.isFinite(nearTokens)) {
        setNearTestnetBalance(Number(nearTokens.toFixed(4)));
      }
    } else {
      setNearTestnetBalance((prev) => Number((prev + claimRes.amountNear).toFixed(4)));
    }

    void logMarketTransactionToSupabase({
      merchant_id: 'lobby_cafe',
      actor_near_account: actorAccount,
      action_type: 'claim_starter_near',
      item_id: 'hana_welcome_near_0_30',
      currency: 'RESPITE',
      amount: 1,
      unit_price: 0,
      reasoning_summary: `Claimed +0.30 NEAR starter grant from Hana Smart Contract Treasury (${NEAR_CONFIG.marketContractId}).`,
      near_tx_hash: claimRes.txHash,
    });

    return claimRes;
  }, [playerUid]);

  useEffect(() => {
    if (onboardingStep !== 'entering_lobby') return;
    const interval = window.setInterval(() => {
      setOnboardingLoadingProgress((prev) => {
        const next = Math.min(100, prev + 18);
        return next;
      });
    }, 180);
    const doneTimer = window.setTimeout(() => {
      setOnboardingLoadingProgress(100);
      setOnboardingStep('completed');
    }, 1150);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(doneTimer);
    };
  }, [onboardingStep]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('sync-kiosk-ui', { detail: { isOpen: isKioskModalOpen } }),
    );
    if (!isKioskModalOpen && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [isKioskModalOpen]);

  const wasNearKioskRef = useRef<boolean>(false);
  useEffect(() => {
    if (wasNearKioskRef.current && !hud.isNearKiosk && isKioskModalOpen) {
      setIsKioskModalOpen(false);
      window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
    }
    wasNearKioskRef.current = hud.isNearKiosk;
  }, [isKioskModalOpen, hud.isNearKiosk]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isPreloadComplete) return;
      const targetEl = e.target as HTMLElement | null;
      if (
        targetEl &&
        (targetEl.tagName === 'INPUT' ||
          targetEl.tagName === 'TEXTAREA' ||
          targetEl.isContentEditable)
      ) {
        return;
      }
      if (activeTeleportKioskModal !== 'none') {
        if (e.code === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
          setActiveTeleportKioskModal('none');
          window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
        }
        return;
      }
      if (activeSpecialModal !== 'none') {
        if (e.code === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
          setActiveSpecialModal('none');
        }
        return;
      }
      if (isProfileModalOpen) {
        if (e.code === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
          setIsProfileModalOpen(false);
          setProfileTargetUser(null);
          window.dispatchEvent(new CustomEvent('clear-character-selection'));
        }
        return;
      }
      if (isSocialChatModalOpen) {
        if (e.code === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
          setIsSocialChatModalOpen(false);
        }
        return;
      }
      if (isKioskModalOpen) {
        if (e.code === 'Escape' || e.code === 'KeyB') {
          e.preventDefault();
          e.stopImmediatePropagation();
          setIsKioskModalOpen(false);
          window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
        }
        return;
      }

      if (selectedTargetUser && !isProfileModalOpen && !isSocialChatModalOpen) {
        if (e.code === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
          setSelectedTargetUser(null);
          setIsTargetMenuExpanded(false);
          window.dispatchEvent(new CustomEvent('clear-character-selection'));
          return;
        }
      }

      if (gameState === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        handleStartGame(false);
        return;
      }

      if (e.code === 'KeyT') {
        e.preventDefault();
        soundEngine.playUiClick();
        setIsSocialChatModalOpen((prev) => {
          const next = !prev;
          if (next) {
            setIsKioskModalOpen(false);
            setActiveSpecialModal('none');
            setActiveTeleportKioskModal('none');
            window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
            window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
          }
          return next;
        });
        return;
      }

      if (e.code === 'KeyM') {
        handleToggleAudio();
      } else if (e.code === 'KeyL') {
        handleCycleLighting();
      } else if (e.code === 'KeyC') {
        handleToggleFovMode();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    isPreloadComplete,
    gameState,
    activeSpecialModal,
    isProfileModalOpen,
    isSocialChatModalOpen,
    isKioskModalOpen,
    dispatchBuddyAction,
    handleStartGame,
    handleToggleAudio,
    handleCycleLighting,
    handleToggleFovMode,
  ]);

  const playerRadarDot = hud.radarDots.find((d) => d.kind === 'player');
  const rawWaterZone = detectNearbyFishingWaterZone(
    playerRadarDot?.x ?? -999,
    playerRadarDot?.z ?? -999,
  );
  const isJoranEquipped = hud.equippedWeapon === 'Joran Fishing';
  const nearbyWaterZone =
    hud.worldMode === 'warzone' || !playerRadarDot
      ? { ...rawWaterZone, canFish: false, zoneId: null, zoneLabel: null }
      : rawWaterZone;

  const fishingCastTimersRef = useRef<number[]>([]);
  const clearFishingCastTimers = useCallback(() => {
    for (const tid of fishingCastTimersRef.current) {
      window.clearTimeout(tid);
    }
    fishingCastTimersRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearFishingCastTimers();
    };
  }, [clearFishingCastTimers]);

  // Auto-reset fishing minigame if entering warzone or explicitly unequipping fishing rod mid-cast
  useEffect(() => {
    if ((hud.worldMode === 'warzone' || !isJoranEquipped) && fishingPhase !== 'idle') {
      clearFishingCastTimers();
      setIsChargingCast(false);
      setIsHoldingReel(false);
      setFishingMinigame(null);
      setFishingHintMessage(null);
      setFishingPhase('idle');
    }
  }, [hud.worldMode, isJoranEquipped, fishingPhase, clearFishingCastTimers]);

  // Sync Tidewater 3D Bobber, 48-Seg Catenary Line, Progressive Rod Bend & Spinning Reel with BuddiesBlitzArena
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('tidewater-fishing-sync', {
        detail: {
          phase: fishingPhase,
          castPower: fishingCastPower,
          tension: fishingMinigame?.tension ?? (fishingPhase === 'bite' ? 0.82 : 0.2),
          isSurging: fishingMinigame?.isSurging ?? false,
          isReeling: isHoldingReel && fishingPhase === 'fighting',
          rodBend: fishingMinigame?.rodBend ?? (fishingPhase === 'bite' ? 0.62 : 0),
          reelAngle: fishingMinigame?.reelAngle ?? 0,
          zoneId: nearbyWaterZone.zoneId ?? 'east_beach',
          distanceM:
            fishingMinigame?.distanceM ??
            fishingBiteSchedule?.castDistanceM ??
            9.5 + fishingCastPower * 16.5,
          speciesId:
            fishingMinigame?.species.speciesId ??
            fishingBiteSchedule?.species.speciesId ??
            'golden_harbor_tuna',
          speciesColorHex:
            fishingMinigame?.species.colorHex ??
            fishingBiteSchedule?.species.colorHex ??
            '#38bdf8',
        },
      }),
    );
  }, [
    fishingPhase,
    fishingCastPower,
    fishingMinigame,
    fishingBiteSchedule,
    isHoldingReel,
    nearbyWaterZone.zoneId,
  ]);

  // Tidewater Hold-to-Charge Cast Power Loop (0..100% over 1.1s)
  useEffect(() => {
    if (!isChargingCast || fishingPhase !== 'charging') return;
    let power = 0.18;
    setFishingCastPower(power);
    const id = window.setInterval(() => {
      power = Math.min(1.0, Number((power + 0.045).toFixed(2)));
      setFishingCastPower(power);
    }, 50);
    return () => window.clearInterval(id);
  }, [isChargingCast, fishingPhase]);

  // Tidewater Line-Tension + Stamina + Periodic Surge 60FPS Minigame Loop
  useEffect(() => {
    if (fishingPhase !== 'fighting') return;
    const id = window.setInterval(() => {
      setFishingMinigame((prev) => {
        if (!prev || prev.status !== 'active') return prev;
        return stepTidewaterMinigame(prev, 0.05, isHoldingReel);
      });
    }, 50);
    return () => window.clearInterval(id);
  }, [fishingPhase, isHoldingReel]);

  // Resolve Tidewater Minigame Outcome ('caught' | 'snapped' | 'escaped')
  useEffect(() => {
    if (fishingPhase !== 'fighting' || !fishingMinigame || fishingMinigame.status === 'active') {
      return;
    }
    const pDot = hudRef.current.radarDots.find((d) => d.kind === 'player');
    const waterCheck = detectNearbyFishingWaterZone(pDot?.x ?? 0, pDot?.z ?? 0);
    const activeZone = waterCheck.zoneId ?? 'east_beach';
    const actorAccount =
      hudRef.current.nearWalletId || nep171Ledger.ownerNearAccount || playerDisplayName || 'guest';

    if (fishingMinigame.status === 'caught') {
      soundEngine.playPowerCore();
      const caught = rollRandomCaughtFish({
        waterZone: activeZone,
        caughtByAccount: actorAccount,
        lightingPreset,
        castPower: fishingMinigame.castPower,
        specificSpecies: fishingMinigame.species,
      });
      setCaughtFishBucket((prev) => [caught, ...prev].slice(0, 20));
      setFishingHintMessage(null);
      window.dispatchEvent(
        new CustomEvent('tidewater-fishing-landed', {
          detail: {
            speciesId: caught.speciesId,
            colorHex: caught.colorHex,
            weightKg: caught.weightKg,
          },
        }),
      );
      window.setTimeout(() => {
        setLastCaughtFishToast(caught);
      }, 540);
    } else {
      soundEngine.playHit();
      setFishingHintMessage(
        fishingMinigame.statusReason ||
          'The fish broke free! Keep tension inside the Green Band (30%-85%).',
      );
    }
    setIsHoldingReel(false);
    setFishingMinigame(null);
    setFishingPhase('idle');
  }, [fishingPhase, fishingMinigame, lightingPreset, nep171Ledger.ownerNearAccount]);

  const ensureFishingRodEquipped = useCallback(() => {
    if (hudRef.current.equippedWeapon !== 'Joran Fishing') {
      dispatchBuddyAction('qcEquipWeapon:fishing_rod');
      hudRef.current = { ...hudRef.current, equippedWeapon: 'Joran Fishing' };
      setHud((prev) => ({ ...prev, equippedWeapon: 'Joran Fishing' }));
    }
  }, [dispatchBuddyAction]);

  const launchTidewaterCast = useCallback(
    (powerToUse: number) => {
      if (hudRef.current.worldMode === 'warzone') return;
      if (caughtFishBucket.length >= 20) return;
      ensureFishingRodEquipped();
      clearFishingCastTimers();

      const pDot = hudRef.current.radarDots.find((d) => d.kind === 'player');
      const waterCheck = detectNearbyFishingWaterZone(pDot?.x ?? 0, pDot?.z ?? 0);
      const activeZone = waterCheck.zoneId ?? 'east_beach';

      soundEngine.playPickup();
      const clampedPower = Math.max(0.2, Math.min(1.0, powerToUse));
      setFishingCastPower(clampedPower);
      const schedule = createTidewaterBiteSchedule({
        waterZone: activeZone,
        lightingPreset,
        castPower: clampedPower,
      });
      setFishingBiteSchedule(schedule);
      setFishingHintMessage(null);
      setLastCaughtFishToast(null);
      setIsChargingCast(false);
      setFishingPhase('casting');

      const castFlightMs = Math.round((0.62 + clampedPower * 0.24) * 1000);
      const firstNibbleDelayMs = castFlightMs + Math.round(schedule.initialWaitSec * 1000);
      const nibbleStepMs = Math.round(schedule.nibbleIntervalSec * 1000);
      const plungeDelayMs = firstNibbleDelayMs + schedule.nibblesTotal * nibbleStepMs;
      const expireDelayMs = plungeDelayMs + Math.round(schedule.strikeWindowSec * 1000);

      const scheduledTimers: number[] = [];

      // Stage 1: 2..4 Preliminary Nibbles spaced naturally after calm floating wait
      for (let ni = 0; ni < schedule.nibblesTotal; ni++) {
        const nibbleAtMs = firstNibbleDelayMs + ni * nibbleStepMs;
        const tn = window.setTimeout(() => {
          setFishingPhase((curr) => {
            if (curr !== 'casting' && curr !== 'nibble') return curr;
            soundEngine.playUiClick();
            window.dispatchEvent(
              new CustomEvent('tidewater-fishing-sync', {
                detail: { nibblePulse: 1.0 },
              }),
            );
            return 'nibble';
          });
        }, nibbleAtMs);
        scheduledTimers.push(tn);
      }

      // Stage 2: Deep Bobber Plunge ('bite' / Take) after scheduled nibbles
      const tPlunge = window.setTimeout(() => {
        setFishingPhase((curr) => {
          if (curr !== 'casting' && curr !== 'nibble') return curr;
          soundEngine.playPickup();
          setFishingHintMessage(null);
          return 'bite';
        });
      }, plungeDelayMs);
      scheduledTimers.push(tPlunge);

      // Stage 3: Missed strike window auto-reset
      const tExpire = window.setTimeout(() => {
        setFishingPhase((curr) => {
          if (curr !== 'bite') return curr;
          setFishingHintMessage('Missed the bite. Press [F] to cast again.');
          return 'idle';
        });
      }, expireDelayMs);
      scheduledTimers.push(tExpire);

      fishingCastTimersRef.current = scheduledTimers;
    },
    [caughtFishBucket.length, clearFishingCastTimers, ensureFishingRodEquipped, lightingPreset],
  );

  const handleTriggerFishingAction = useCallback(() => {
    if (hudRef.current.worldMode === 'warzone') return;
    ensureFishingRodEquipped();
    const pDot = hudRef.current.radarDots.find((d) => d.kind === 'player');
    const waterCheck = detectNearbyFishingWaterZone(pDot?.x ?? 0, pDot?.z ?? 0);
    const activeZone = waterCheck.zoneId ?? 'east_beach';

    soundEngine.playUiClick();

    // Non-punishing Tidewater Nibble Cue: clicking early warns the player without losing the cast!
    if (fishingPhase === 'nibble') {
      setFishingHintMessage('Not yet. Wait for the float to plunge under.');
      return;
    }

    // Active Fight Minigame: holding Reel drives the fight; single taps only give a gentle crank nudge (never an instant catch!)
    if (fishingPhase === 'fighting' && fishingMinigame) {
      setFishingMinigame((prev) => {
        if (!prev || prev.status !== 'active') return prev;
        const nudgeDist = prev.isSurging ? prev.distanceM : Math.max(1.65, prev.distanceM - 0.18);
        const nextTension = prev.isSurging
          ? Math.min(1.06, prev.tension + 0.06)
          : Math.max(0.36, Math.min(0.78, prev.tension + 0.03));
        return {
          ...prev,
          distanceM: Number(nudgeDist.toFixed(2)),
          tension: Number(nextTension.toFixed(3)),
          reelAngle: prev.reelAngle + 0.85,
        };
      });
      return;
    }

    // Hook Set on 'bite' ('take' window) -> Every catch enters the Tidewater Line-Tension + Stamina + Surge Fight Minigame!
    if (fishingPhase === 'bite') {
      clearFishingCastTimers();
      const targetSpecies =
        fishingBiteSchedule?.species ??
        createTidewaterBiteSchedule({
          waterZone: activeZone,
          lightingPreset,
          castPower: fishingCastPower,
        }).species;

      setFishingMinigame(createTidewaterMinigameState(targetSpecies, fishingCastPower));
      setFishingPhase('fighting');
      setIsHoldingReel(false);
      setFishingHintMessage(null);
      return;
    }

    if (fishingPhase === 'idle' || fishingPhase === 'charging') {
      launchTidewaterCast(fishingCastPower);
    }
  }, [
    clearFishingCastTimers,
    ensureFishingRodEquipped,
    fishingBiteSchedule,
    fishingCastPower,
    fishingMinigame,
    fishingPhase,
    launchTidewaterCast,
    lightingPreset,
  ]);

  const handleSellRawFishForLul = useCallback(
    (fish: CaughtFishItem) => {
      soundEngine.playPickup();
      const actorAccount = hudRef.current.nearWalletId || playerUid;
      const earnedLul = Math.max(5, fish.sellValueLul || fish.sellValueCyon || 25);
      setCaughtFishBucket((prev) => prev.filter((f) => f.id !== fish.id));
      setLastCaughtFishToast((prev) => (prev?.id === fish.id ? null : prev));
      const nextLul = Math.max(0, (hudRef.current.gold ?? 0) + earnedLul);
      dispatchBuddyAction(`adjustPlayerLul:${earnedLul}`);
      if (actorAccount) {
        void syncPlayerBalancesToSupabase({
          nearAccountId: actorAccount,
          lulBalance: nextLul,
          cyonBalance,
          respiteBalance,
        });
        void logMarketTransactionToSupabase({
          merchant_id: 'beach_house',
          actor_near_account: actorAccount,
          action_type: 'sell_fish',
          item_id: fish.speciesId,
          currency: 'LUL',
          amount: earnedLul,
          unit_price: earnedLul,
          reasoning_summary: `Sold ${fish.speciesName} (${fish.weightKg} kg, ${fish.rarity}) directly to Merchant Kai for +${earnedLul} LUL (convertible to CYON at Exchange).`,
        });
      }
    },
    [cyonBalance, dispatchBuddyAction, playerUid, respiteBalance],
  );

  const handleMintCaughtFishNft = useCallback(
    async (fish: CaughtFishItem): Promise<boolean> => {
      soundEngine.playPickup();
      const actorAccount = hudRef.current.nearWalletId || playerUid;
      const tokenSuffix = Math.floor(1000 + Math.random() * 9000);
      const nftTokenId = `nep171-fish-${fish.speciesId}-${tokenSuffix}`;
      const res = await executeMarketContractCallOnChain({
        signerAccountId: actorAccount || undefined,
        methodName: 'mint_fish_nft',
        args: {
          token_id: nftTokenId,
          species_id: fish.speciesId,
          species_name: fish.speciesName,
          water_zone: fish.waterZone,
          rarity: fish.rarity,
          weight_kg_x100: Math.max(1, Math.round(fish.weightKg * 100)),
        },
      });
      if (!res.ok || !res.txHash) return false;
      const resolvedActor = res.signerAccountId || hudRef.current.nearWalletId || actorAccount;
      setCaughtFishBucket((prev) =>
        prev.map((f) =>
          f.id === fish.id
            ? {
                ...f,
                isMintedNft: true,
                nftTokenId,
                nearTxHash: res.txHash,
              }
            : f,
        ),
      );
      setLastCaughtFishToast((prev) =>
        prev && prev.id === fish.id
          ? { ...prev, isMintedNft: true, nftTokenId, nearTxHash: res.txHash }
          : prev,
      );
      const nextOwned = [...ownedMerchantItemIds, nftTokenId];
      setOwnedMerchantItemIds(nextOwned);
      if (resolvedActor) {
        void syncPlayerBalancesToSupabase({
          nearAccountId: resolvedActor,
          lulBalance: hudRef.current.gold ?? 0,
          cyonBalance,
          respiteBalance,
          ownedTokenIds: nextOwned,
        });
        void logMarketTransactionToSupabase({
          merchant_id: 'beach_house',
          actor_near_account: resolvedActor,
          action_type: 'mint_fish_nft',
          item_id: fish.speciesId,
          nep245_token_id: nftTokenId,
          currency: 'RESPITE',
          amount: 0,
          unit_price: 0,
          reasoning_summary: `Minted ${fish.speciesName} (${fish.weightKg} kg, ${fish.rarity}) into NEP-171 Fish NFT ${nftTokenId}.`,
          near_tx_hash: res.txHash,
        });
      }
      return true;
    },
    [cyonBalance, ownedMerchantItemIds, playerUid, respiteBalance],
  );

  // Keyboard support (KeyF or Space while fishing) for Tidewater Hold-to-Charge, Strike & Hold-to-Reel
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isPreloadComplete) return;
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (lastCaughtFishToast && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyF')) {
        e.preventDefault();
        soundEngine.playUiClick();
        setLastCaughtFishToast(null);
        return;
      }
      if (!nearbyWaterZone.canFish) return;
      if (e.code === 'KeyF' || (fishingPhase !== 'idle' && e.code === 'Space')) {
        if (e.repeat) return;
        if (fishingPhase === 'fighting') {
          e.preventDefault();
          setIsHoldingReel(true);
        } else if (fishingPhase === 'bite' || fishingPhase === 'nibble') {
          e.preventDefault();
          handleTriggerFishingAction();
        } else if (fishingPhase === 'idle' && e.code === 'KeyF' && caughtFishBucket.length < 20) {
          e.preventDefault();
          ensureFishingRodEquipped();
          setIsChargingCast(true);
          setFishingPhase('charging');
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyF' || e.code === 'Space') {
        if (fishingPhase === 'fighting') {
          setIsHoldingReel(false);
        } else if (fishingPhase === 'charging') {
          launchTidewaterCast(fishingCastPower);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    isPreloadComplete,
    caughtFishBucket.length,
    ensureFishingRodEquipped,
    fishingCastPower,
    fishingPhase,
    handleTriggerFishingAction,
    lastCaughtFishToast,
    launchTidewaterCast,
    nearbyWaterZone.canFish,
  ]);

  const currentPresetConfig = LIGHTING_PRESETS[lightingPreset];
  const scaleX = hexRect.width / 500;
  const scaleY = hexRect.height / 482;
  const isFullMapOverview =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('fullmap') === '1' ||
      Boolean(new URLSearchParams(window.location.search).get('planeview')) ||
      Boolean(new URLSearchParams(window.location.search).get('skyshieldview')) ||
      Boolean(new URLSearchParams(window.location.search).get('buildingview')));
  const peacefulUiState = evaluateLobbyAndSafezonePeacefulState({
    worldMode,
    isInsideLobbySafezone: Boolean(hud.isInsideLobbySafezone),
    cityArenaMode: hud.cityArenaMode,
  });

  return (
    <main className="relative w-screen h-screen overflow-hidden select-none">
      {/* 1. 60FPS 3D Team Buddies x Blitz Grassland Arena (Persistent Scene Across Transit & World Modes) */}
      <BuddiesBlitzArena
        key={`arena-${worldTransitionCount}`}
        gameState={gameState}
        playMode={playMode}
        lightingPreset={lightingPreset}
        cameraFovMode={cameraFovMode}
        resetTrigger={resetTrigger}
        worldMode={worldMode}
        initialTeam={worldInitialTeam}
        deployedFromLobby={worldTransitionCount > 0}
        onRequestWorldModeChange={handleRequestWorldModeChange}
        onHudUpdate={setHud}
        onGameOver={handleGameOver}
        onTogglePause={handleTogglePause}
        onPreloadSceneReady={handlePreloadSceneReady}
      />

      {/* Unified Blocking Preload Gate (0% to 100%) */}
      {!isPreloadComplete && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Loading Game Assets"
          data-preload-gate="true"
          data-preload-progress={preloadProgress}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="fixed inset-0 z-[100000] flex flex-col items-center justify-center bg-[#0b0e16] text-white pointer-events-auto select-none px-6"
        >
          <div className="w-full max-w-sm flex flex-col items-center gap-4">
            <div className="text-xs font-black uppercase tracking-[0.24em] text-white/80">
              BUDDIES BLITZ
            </div>
            <div className="w-full h-2 bg-[#181b26] border border-white/20 overflow-hidden">
              <div
                className="h-full bg-[#b8ff3c] transition-[width] duration-150 ease-out"
                style={{ width: `${preloadProgress}%` }}
              />
            </div>
            <div className="w-full flex items-center justify-between text-[11px] font-bold tracking-wider uppercase text-white/60 font-mono">
              <span>LOADING ASSETS</span>
              <span data-preload-percent="true" className="text-white">
                {preloadProgress}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Solid Full Scene Transition Loading Overlay */}
      {isPreloadComplete && isWorldLoading && (
        <div
          data-world-loading="true"
          data-target-world-mode={loadingTargetMode ?? worldMode}
          style={{ backgroundColor: '#0b0e16', opacity: 1 }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#0b0e16] text-white pointer-events-auto select-none"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="-skew-x-12 px-8 py-4 bg-[#b8ff3c] text-[#0d0f12] border-4 border-[#0d0f12] ring-4 ring-white shadow-[6px_6px_0_#0d0f12] font-black text-2xl sm:text-3xl tracking-widest uppercase animate-pulse">
              <span className="skew-x-12 inline-block">LOADING...</span>
            </div>
            <div className="text-xs sm:text-sm font-black tracking-widest uppercase text-[#00d2ff]">
              {(loadingTargetMode ?? worldMode) === 'safezone'
                ? 'ENTERING THE CITY'
                : (loadingTargetMode ?? worldMode) === 'lobby'
                ? 'ENTERING CENTRAL PLAZA'
                : `ENTERING WARZONE (${worldInitialTeam.toUpperCase()} TEAM)`}
            </div>
            {/* Animated Loading Bar */}
            <div className="w-56 sm:w-64 h-2.5 bg-[#14161d] border-2 border-white/70 rounded-full overflow-hidden mt-1 shadow-[2px_2px_0_#000]">
              <div className="h-full bg-[#b8ff3c] animate-pulse w-full" />
            </div>
            <div className="text-[10px] font-bold text-white/60 tracking-wider">
              Preparing area &amp; syncing map...
            </div>
          </div>
        </div>
      )}

      {/* Atmospheric Viewport Color Tint Overlay */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-10 transition-colors duration-700"
        style={{
          backgroundColor: currentPresetConfig.viewportFilterColor,
          opacity: currentPresetConfig.viewportFilterOpacity,
        }}
      />

      {/* =====================================================================
          2. TITLE SCREEN: HEXAGON CUTOUT & COMIC STICKER LOCKUP
         ===================================================================== */}
      {isPreloadComplete && gameState === 'title' && (
        <section
          aria-label="BLITZ Portfolio Title Screen"
          className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-none"
        >
          <svg
            className="fixed inset-0 w-full h-full pointer-events-none"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
          >
            <defs>
              <mask
                id="intro-mask-cutout"
                maskUnits="userSpaceOnUse"
                x="0"
                y="0"
                width="100%"
                height="100%"
              >
                <rect width="100%" height="100%" fill="white" />
                <g
                  transform={`translate(${hexRect.left}, ${hexRect.top}) scale(${scaleX}, ${scaleY})`}
                >
                  <path d={BUDDIES_CONSTANTS.introHexagonSvgPath} fill="black" />
                </g>
              </mask>
              <linearGradient id="intro-overlay-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0b0c12" stopOpacity="0.94" />
                <stop offset="52%" stopColor="#11121a" stopOpacity="0.86" />
                <stop offset="100%" stopColor="#11121a" stopOpacity="0.72" />
              </linearGradient>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="url(#intro-overlay-gradient)"
              mask="url(#intro-mask-cutout)"
            />
          </svg>

          <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 items-center px-6 sm:px-12 lg:px-16 pt-8 pb-4 gap-6">
            <div className="lg:col-span-6 flex flex-col items-start justify-end lg:justify-center space-y-5 pointer-events-auto">
              <svg
                viewBox="0 0 560 225"
                className="w-full max-w-[510px] drop-shadow-[6px_8px_0px_#11121a]"
                role="img"
                aria-label="BUDDIES BLITZ"
              >
                <g transform="rotate(-3 260 85)">
                  <rect
                    x="10"
                    y="12"
                    width="485"
                    height="108"
                    rx="18"
                    fill="#ffffff"
                    stroke="#11121a"
                    strokeWidth="8"
                  />
                  <text
                    x="28"
                    y="94"
                    fontFamily="'Barlow', sans-serif"
                    fontWeight="900"
                    fontStyle="italic"
                    fontSize="88"
                    letterSpacing="2"
                    fill="#ffffff"
                    stroke="#11121a"
                    strokeWidth="16"
                    paintOrder="stroke fill"
                  >
                    BUDDIES
                  </text>
                </g>

                <g transform="translate(24, 108) rotate(-1.5 220 45)">
                  <rect
                    x="0"
                    y="0"
                    width="430"
                    height="84"
                    rx="14"
                    fill="#b4ff39"
                    stroke="#ffffff"
                    strokeWidth="10"
                  />
                  <rect
                    x="4"
                    y="4"
                    width="422"
                    height="76"
                    rx="11"
                    fill="#b4ff39"
                    stroke="#11121a"
                    strokeWidth="6"
                  />
                  <text
                    x="32"
                    y="61"
                    fontFamily="'Barlow', sans-serif"
                    fontWeight="900"
                    fontSize="58"
                    letterSpacing="5"
                    fill="#11121a"
                  >
                    BLITZ 3D
                  </text>
                </g>
              </svg>
            </div>

            <div className="lg:col-span-6 flex items-center justify-center">
              <div
                ref={hexContainerRef}
                className="relative w-[330px] h-[318px] sm:w-[440px] sm:h-[424px] lg:w-[485px] lg:h-[468px] pointer-events-none"
              >
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 500 482"
                  fill="none"
                  className="absolute inset-0 w-full h-full"
                >
                  <path
                    d={BUDDIES_CONSTANTS.introHexagonSvgPath}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.55)"
                    strokeWidth="3.5"
                  />
                  <path
                    d={BUDDIES_CONSTANTS.introHexagonSvgPath}
                    fill="none"
                    stroke="#11121a"
                    strokeWidth="2"
                    strokeDasharray="10 6"
                  />
                </svg>

                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleToggleAudio();
                  }}
                  aria-label={isMuted ? 'Sound Muted' : 'Sound Active'}
                  className="pointer-events-auto absolute top-3 right-6 w-14 h-14 flex items-center justify-center bg-white hover:bg-[#fec83e] text-[#11121a] font-black text-xs border-4 border-[#11121a] ring-2 ring-white rounded-2xl rotate-6 comic-sticker-shadow transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                >
                  {isMuted ? 'MUTE' : 'SOUND'}
                </button>

                <button
                  type="button"
                  data-start="true"
                  onClick={() => handleStartGame(false)}
                  aria-label="LET'S GO"
                  className="pointer-events-auto absolute -bottom-3 left-1/2 -translate-x-1/2 -rotate-3 hover:-rotate-6 hover:scale-108 active:scale-95 px-9 py-4 bg-[#b4ff39] hover:bg-[#c7ff72] text-[#11121a] font-black text-2xl sm:text-3xl tracking-wider rounded-2xl border-4 border-[#11121a] ring-4 ring-white comic-sticker-shadow-lg transition-all duration-150 cursor-pointer whitespace-nowrap"
                >
                  LET&apos;S GO
                </button>
              </div>
            </div>
          </div>

          <div className="relative z-10 pb-5 px-6 text-center text-xs sm:text-sm font-bold tracking-wide text-[#dfdfe2]/85">
            WASD Run &nbsp;·&nbsp; [E] Grab/Throw Crate &nbsp;·&nbsp; [Q] Ghost Pad Pattern &nbsp;·&nbsp; [F] Craft &nbsp;·&nbsp; [V] AI Binoculars
          </div>
        </section>
      )}

      {/* =====================================================================
          2B. UNIFIED SINGLE 'START GAME' MODAL CARD:
              All onboarding states (Headless Google OAuth, Loading/Authenticating,
              OAuth Error Messages, 3D Character Selection, Citizen Username Setup,
              and Entering Lobby progress) stay inside this single START GAME card
              without ever stacking a second modal overlay.
         ===================================================================== */}
      {isPreloadComplete &&
        gameState === 'playing' &&
        !isFullMapOverview &&
        onboardingStep !== 'completed' && (
          <section
            aria-label="Buddies Blitz Login & Onboarding"
            data-onboarding-step={onboardingStep}
            className={`fixed inset-0 z-50 flex flex-col ${
              onboardingStep === 'guest_character_select'
                ? 'justify-end items-center py-6 px-4 pointer-events-none'
                : 'items-center justify-center p-4 bg-black/60 backdrop-blur-[3px] pointer-events-auto'
            } select-none`}
          >
            <div
              data-start-game-card="true"
              className="pointer-events-auto w-full max-w-sm bg-[#14161d] text-white border-4 border-black ring-4 ring-white shadow-[8px_8px_0_#000] p-5 space-y-4"
            >
              {/* Compact Game Title Header (Always in the Single START GAME Card) */}
              <div className="text-center space-y-1 border-b-2 border-white/15 pb-3">
                <div className="inline-block -skew-x-12 px-3 py-0.5 bg-[#b8ff3c] text-black border-2 border-black shadow-[2px_2px_0_#000] font-black text-[11px] uppercase tracking-widest">
                  <span className="skew-x-12 inline-block">BUDDIES BLITZ</span>
                </div>
                <h1 className="text-2xl font-black uppercase tracking-wide text-white pt-0.5">
                  START GAME
                </h1>
                {connectedGoogleEmail && (
                  <div className="text-[10.5px] font-mono font-bold text-[#38bdf8] truncate">
                    {connectedGoogleEmail}
                  </div>
                )}
              </div>

              {onboardingStep === 'auth_choice' && (
                <>
                  {/* 1. Headless Google OAuth Login */}
                  <div className="space-y-2.5">
                    {savedWalletSummary &&
                      savedWalletSummary.walletId !== 'player1.buddiesblitz-master.testnet' &&
                      savedWalletSummary.walletId !== 'testnet' &&
                      savedWalletSummary.walletId !== 'testnet.near' && (
                        <div className="p-2 bg-[#1e293b] border border-[#38bdf8]/50 text-[11px] font-bold text-slate-200 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-black text-[#facc15]">
                              {savedWalletSummary.displayName}
                            </div>
                            <div className="truncate font-mono text-[10px] text-[#38bdf8]">
                              {savedWalletSummary.walletId}
                            </div>
                          </div>
                          <button
                            type="button"
                            data-reconnect-saved-wallet-btn="true"
                            onClick={() =>
                              void handleConnectWalletAndEnterLobby(savedWalletSummary.walletId, {
                                silentRestore: true,
                              })
                            }
                            className="px-2.5 py-1 bg-[#38bdf8] text-black font-black text-[10px] uppercase border border-black cursor-pointer shrink-0"
                          >
                            CONTINUE
                          </button>
                        </div>
                      )}

                    <div className="space-y-2">
                      <button
                        type="button"
                        data-connect-wallet-enter-btn="true"
                        disabled={isVerifyingNearWallet || privyOAuthLoading}
                        onClick={() => void handleStartGoogleLoginAndOpenWalletNaming()}
                        className="-skew-x-6 w-full py-3 px-4 bg-white hover:bg-slate-100 disabled:opacity-60 text-black border-3 border-black shadow-[4px_4px_0_#000] font-black text-xs sm:text-sm uppercase tracking-wider cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                      >
                        <span className="skew-x-6 flex items-center justify-center gap-2">
                          <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
                            <path
                              fill="#4285F4"
                              d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                            />
                            <path
                              fill="#34A853"
                              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                            />
                            <path
                              fill="#EA4335"
                              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                            />
                          </svg>
                          <span>
                            {isVerifyingNearWallet || privyOAuthLoading
                              ? 'SIGNING IN...'
                              : 'CONTINUE WITH GOOGLE'}
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        data-open-near-wallet-selector-start-btn="true"
                        disabled={isVerifyingNearWallet || privyOAuthLoading}
                        onClick={() => {
                          soundEngine.playUiClick();
                          setWalletConnectError(null);
                          setIsNearWalletSelectorOpen(true);
                        }}
                        className="-skew-x-6 w-full py-2.5 px-4 bg-[#38bdf8] hover:bg-[#7dd3fc] disabled:opacity-60 text-black border-3 border-black shadow-[4px_4px_0_#000] font-black text-xs uppercase tracking-wider cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                      >
                        <span className="skew-x-6 flex items-center justify-center gap-2">
                          <Wallet className="w-3.5 h-3.5 stroke-[2.5] shrink-0" aria-hidden="true" />
                          <span>CONNECT EXTERNAL WALLET</span>
                        </span>
                      </button>
                    </div>

                    {walletConnectError && (
                      <div
                        data-wallet-connect-error="true"
                        className="p-2.5 bg-[#ff3b30]/20 border border-[#ff3b30] text-[#fca5a5] text-[10.5px] font-bold space-y-2"
                      >
                        <div>{walletConnectError}</div>
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playUiClick();
                            setWalletConnectError(null);
                            setOnboardingAuthMode('wallet');
                            setOnboardingStep('guest_character_select');
                          }}
                          className="w-full py-1.5 px-2 bg-[#b8ff3c] text-black border border-black font-black uppercase text-[10px] cursor-pointer"
                        >
                          CREATE WALLET
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-white/15" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      OR
                    </span>
                    <div className="flex-1 h-px bg-white/15" />
                  </div>

                  {/* 2. Secondary Action: Play as Guest */}
                  <button
                    type="button"
                    data-login-guest-btn="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setWalletConnectError(null);
                      setOnboardingAuthMode('guest');
                      setConnectedGoogleEmail('');
                      setCharacterGender('male');
                      if (!isCustomGuestNameEdited) {
                        setPlayerDisplayName('Buddy Male');
                      }
                      dispatchBuddyAction('setCharacterGender:male');
                      setOnboardingStep('guest_character_select');
                    }}
                    className="-skew-x-6 w-full py-2.5 px-4 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-3 border-black shadow-[4px_4px_0_#000] font-black text-xs uppercase tracking-wider cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                  >
                    <span className="skew-x-6 inline-block">PLAY AS GUEST</span>
                  </button>
                </>
              )}

              {onboardingStep === 'guest_character_select' && (
                <div className="space-y-3.5">
                  <div className="text-center space-y-0.5">
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#b8ff3c]">
                      CHOOSE CHARACTER
                    </div>
                    <div className="text-[10.5px] font-bold text-slate-300">
                      {onboardingAuthMode === 'wallet'
                        ? 'Pick your character and display name.'
                        : 'Explore freely. Sign in later to unlock trading.'}
                    </div>
                  </div>

                  {/* Row 1: Direct Citizen / Guest Name Input */}
                  <div className="space-y-1">
                    <label className="block text-[9.5px] font-black uppercase tracking-wider text-slate-300">
                      DISPLAY NAME
                    </label>
                    <input
                      ref={guestNameInputRef}
                      type="text"
                      maxLength={20}
                      data-guest-username-input="true"
                      value={playerDisplayName}
                      onChange={(e) => {
                        setIsCustomGuestNameEdited(true);
                        setPlayerDisplayName(e.target.value);
                      }}
                      placeholder="Enter your name..."
                      className="w-full px-3 py-2 bg-white text-black font-black text-sm border-2 border-[#b8ff3c] shadow-[2px_2px_0_#000] focus:outline-none"
                    />
                  </div>

                  {/* Row 2: Back Button, < 1/2 > Gender Switcher, and Next / Enter Button */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setOnboardingStep('auth_choice');
                      }}
                      title="Back"
                      aria-label="Back"
                      className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white border border-white/25 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
                    >
                      <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        data-char-select-prev="true"
                        onClick={() => {
                          soundEngine.playUiClick();
                          const nextGender: 'male' | 'female' =
                            characterGender === 'male' ? 'female' : 'male';
                          setCharacterGender(nextGender);
                          dispatchBuddyAction(`setCharacterGender:${nextGender}`);
                          if (!isCustomGuestNameEdited) {
                            setPlayerDisplayName(
                              nextGender === 'male' ? 'Buddy Male' : 'Buddy Female',
                            );
                          }
                        }}
                        aria-label="Previous Character"
                        className="w-8 h-8 flex items-center justify-center text-white hover:text-[#b8ff3c] cursor-pointer active:scale-90 transition-transform"
                      >
                        <ChevronLeft className="w-6 h-6 stroke-[2.8]" />
                      </button>

                      <div className="text-center min-w-[72px]">
                        <div className="text-sm font-bold tracking-wider text-white">
                          {characterGender === 'male' ? '1/2' : '2/2'}
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-[#b8ff3c]">
                          {characterGender === 'male' ? 'MALE' : 'FEMALE'}
                        </div>
                      </div>

                      <button
                        type="button"
                        data-char-select-next="true"
                        onClick={() => {
                          soundEngine.playUiClick();
                          const nextGender: 'male' | 'female' =
                            characterGender === 'male' ? 'female' : 'male';
                          setCharacterGender(nextGender);
                          dispatchBuddyAction(`setCharacterGender:${nextGender}`);
                          if (!isCustomGuestNameEdited) {
                            setPlayerDisplayName(
                              nextGender === 'male' ? 'Buddy Male' : 'Buddy Female',
                            );
                          }
                        }}
                        aria-label="Next Character"
                        className="w-8 h-8 flex items-center justify-center text-white hover:text-[#b8ff3c] cursor-pointer active:scale-90 transition-transform"
                      >
                        <ChevronRight className="w-6 h-6 stroke-[2.8]" />
                      </button>
                    </div>

                    <button
                      type="button"
                      data-confirm-guest-character-btn="true"
                      onClick={handleConfirmGuestCharacterAndEnterLobby}
                      className="-skew-x-6 px-4 py-2.5 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-2 border-black shadow-[3px_3px_0_#000] font-black text-[11px] uppercase tracking-wider cursor-pointer active:scale-95 transition-all"
                    >
                      <span className="skew-x-6 inline-block">
                        {onboardingAuthMode === 'wallet' ? 'NEXT' : 'PLAY'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {onboardingStep === 'subwallet_naming' && (
                <div className="space-y-3.5">
                  <div className="text-center space-y-0.5">
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#38bdf8]">
                      CREATE WALLET
                    </div>
                    <div className="text-[10.5px] font-bold text-slate-300">
                      Choose a unique wallet username.
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[9.5px] font-black uppercase tracking-wider text-slate-300">
                      USERNAME
                    </label>
                    <div className="flex items-stretch border-2 border-black shadow-[3px_3px_0_#000] bg-white overflow-hidden">
                      <input
                        type="text"
                        maxLength={24}
                        data-subwallet-prefix-input="true"
                        value={subWalletHandleDraft}
                        onChange={(e) => {
                          const sanitized = e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9_-]/g, '');
                          setSubWalletHandleDraft(sanitized);
                          setWalletConnectError(null);
                        }}
                        onKeyDown={(e) => {
                          if (
                            e.key === 'Enter' &&
                            subWalletAvailability.validFormat &&
                            subWalletAvailability.available &&
                            !subWalletAvailability.checking
                          ) {
                            void handleProvisionSubWalletAndShowWelcome();
                          }
                        }}
                        placeholder="username"
                        className="w-full min-w-0 px-2.5 py-2 bg-white text-black font-mono font-black text-sm focus:outline-none"
                      />
                      <div className="px-2 py-2 bg-[#e2e8f0] text-slate-800 border-l-2 border-black font-mono font-black text-[10.5px] flex items-center shrink-0">
                        .{NEAR_CONFIG.masterAccountId}
                      </div>
                    </div>

                    <div className="p-2.5 bg-[#0f172a] border border-white/20 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9.5px] font-black uppercase text-slate-400">
                          YOUR WALLET
                        </span>
                        <span className="text-[10px] font-bold">
                          {subWalletAvailability.checking ? (
                            <span className="text-[#facc15]">Checking...</span>
                          ) : subWalletAvailability.validFormat && subWalletAvailability.available ? (
                            <span className="text-[#b8ff3c]">
                              {subWalletAvailability.ownedByCurrentDevice
                                ? 'Restoring your wallet'
                                : 'Available'}
                            </span>
                          ) : (
                            <span className="text-[#fca5a5]">
                              {subWalletAvailability.reason || 'Min 2 characters'}
                            </span>
                          )}
                        </span>
                      </div>
                      <div
                        data-subwallet-full-preview="true"
                        className="font-mono text-xs font-black text-[#38bdf8] break-all"
                      >
                        {(subWalletHandleDraft.trim() || 'username') + `.${NEAR_CONFIG.masterAccountId}`}
                      </div>
                    </div>

                    {walletConnectError && (
                      <div className="p-2 bg-[#ff3b30]/20 border border-[#ff3b30] text-[#fca5a5] text-[10.5px] font-bold">
                        {walletConnectError}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setWalletConnectError(null);
                        setOnboardingStep('guest_character_select');
                      }}
                      className="px-3 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/25 text-[11px] font-black uppercase cursor-pointer"
                    >
                      BACK
                    </button>

                    <button
                      type="button"
                      data-create-subwallet-btn="true"
                      disabled={
                        subWalletAvailability.checking ||
                        !subWalletAvailability.validFormat ||
                        !subWalletAvailability.available
                      }
                      onClick={() => void handleProvisionSubWalletAndShowWelcome()}
                      className="-skew-x-6 flex-1 py-2.5 px-4 bg-[#b8ff3c] hover:bg-[#d9f99d] disabled:opacity-50 disabled:cursor-not-allowed text-black border-2 border-black shadow-[3px_3px_0_#000] font-black text-xs uppercase tracking-wider cursor-pointer transition-all"
                    >
                      <span className="skew-x-6 inline-block">CREATE WALLET</span>
                    </button>
                  </div>
                </div>
              )}

              {onboardingStep === 'provisioning_subwallet' && (
                <div
                  data-provisioning-subwallet-state="true"
                  className="flex flex-col items-center gap-3 text-center py-3"
                >
                  <div className="-skew-x-12 px-4 py-1.5 bg-[#38bdf8] text-black border-2 border-black shadow-[3px_3px_0_#000] font-black text-xs tracking-widest uppercase animate-pulse">
                    <span className="skew-x-12 inline-block">CREATING WALLET...</span>
                  </div>

                  <div className="w-full p-2.5 bg-[#0f172a] border border-white/20 font-mono text-xs font-bold text-[#b8ff3c] break-all">
                    {subWalletHandleDraft}.{NEAR_CONFIG.masterAccountId}
                  </div>

                  <div className="text-[11px] font-bold text-slate-200">
                    {subWalletProvisionStageLabel}
                  </div>

                  <div className="w-full h-3 bg-[#0b0e16] border-2 border-white/50 overflow-hidden">
                    <div
                      className="h-full bg-[#b8ff3c] transition-all duration-200"
                      style={{ width: `${onboardingLoadingProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {onboardingStep === 'entering_lobby' && (
                <div className="flex flex-col items-center gap-3 text-center py-2">
                  <div className="-skew-x-12 px-5 py-2 bg-[#b8ff3c] text-[#0d0f12] border-2 border-[#0d0f12] shadow-[3px_3px_0_#000] font-black text-base tracking-widest uppercase">
                    <span className="skew-x-12 inline-block">LOADING...</span>
                  </div>

                  <div className="text-[11px] font-black tracking-widest uppercase text-[#38bdf8]">
                    {onboardingAuthMode === 'wallet'
                      ? hud.nearWalletId || walletConnectInput || connectedGoogleEmail
                      : playerDisplayName.toUpperCase()}
                  </div>

                  <div className="w-full h-2.5 bg-[#0b0e16] border border-white/50 overflow-hidden">
                    <div
                      className="h-full bg-[#b8ff3c] transition-all duration-150"
                      style={{ width: `${onboardingLoadingProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

      {/* =====================================================================
          2B. WELCOME MODAL & GUIDED TUTORIAL OBJECTIVE HUD BANNER
         ===================================================================== */}
      {isPreloadComplete &&
        onboardingStep === 'completed' &&
        tutorialStage === 'welcome_modal' && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Welcome to Buddies Blitz"
            data-citizen-welcome-modal="true"
            className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs pointer-events-auto select-none"
          >
            <div className="w-full max-w-sm bg-[#14161d] text-white border-4 border-black ring-4 ring-[#b8ff3c] shadow-[10px_10px_0_#000] p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-2.5">
                <span className="-skew-x-12 px-2.5 py-0.5 bg-[#b8ff3c] text-black border-2 border-black font-black text-[10px] uppercase tracking-widest">
                  <span className="skew-x-12 inline-block">WELCOME</span>
                </span>
                <span className="text-[10px] font-mono font-bold text-[#38bdf8]">READY</span>
              </div>

              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-white">
                  Welcome, {playerDisplayName}
                </h2>
                <p className="text-xs font-bold text-slate-300 mt-1">
                  Visit Hana at Central Plaza Cafe to claim your 0.30 NEAR welcome bonus.
                </p>
              </div>

              <div className="p-2.5 bg-[#0f172a] border border-white/20 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9.5px] font-black uppercase text-slate-400">
                    YOUR WALLET
                  </span>
                  {provisionedSubWalletTxHash && (
                    <a
                      href={getNearBlocksTxUrl(provisionedSubWalletTxHash, 'testnet')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono font-bold text-[#38bdf8] underline"
                    >
                      Receipt
                    </a>
                  )}
                </div>
                <div className="font-mono text-xs font-black text-[#b8ff3c] break-all">
                  {hud.nearWalletId || playerUid}
                </div>
              </div>

              <button
                type="button"
                data-welcome-go-to-hana-btn="true"
                onClick={() => {
                  soundEngine.playPickup();
                  setTutorialStage('go_to_hana');
                }}
                className="-skew-x-6 w-full py-2.5 px-4 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-3 border-black shadow-[4px_4px_0_#000] font-black text-xs sm:text-sm uppercase tracking-wider cursor-pointer active:translate-y-0.5 transition-all"
              >
                <span className="skew-x-6 inline-block">START</span>
              </button>
            </div>
          </div>
        )}

      {isPreloadComplete &&
        onboardingStep === 'completed' &&
        (tutorialStage === 'go_to_hana' || tutorialStage === 'go_to_kiosk') &&
        activeSpecialModal === 'none' &&
        activeTeleportKioskModal === 'none' &&
        !tramRideCutsceneUi?.active && (
          <div
            data-tutorial-objective-hud="true"
            className="fixed top-14 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-md pointer-events-auto select-none"
          >
            <div className="bg-[#0f172a]/95 text-white border-[3px] border-black shadow-[5px_5px_0_#000] px-3.5 py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`px-2 py-0.5 border border-black text-[9.5px] font-black uppercase shrink-0 ${
                    tutorialStage === 'go_to_hana'
                      ? 'bg-[#b8ff3c] text-black'
                      : 'bg-[#38bdf8] text-black'
                  }`}
                >
                  NEXT
                </span>
                <span className="text-[11px] font-bold text-slate-100 truncate">
                  {tutorialStage === 'go_to_hana'
                    ? 'Talk to Hana at Central Plaza Cafe to claim 0.30 NEAR.'
                    : 'Follow the blue path to the Transit Kiosk.'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  setTutorialStage('none');
                }}
                className="px-2 py-1 bg-white/10 hover:bg-white/20 border border-white/30 text-[9.5px] font-black uppercase text-slate-300 cursor-pointer shrink-0"
              >
                SKIP
              </button>
            </div>
          </div>
        )}

      {/* =====================================================================
          3. PLAYING HUD: STYLIZED TACTICAL ARCADE OVERHAUL
             - Top-Left: Compact Radar/Minimap + [Q: 1x1x2] Pad Badge
             - Top-Center: Skewed Arcade Health/Score Bar ("BLUE 2000 vs RED 2000")
             - Top-Right: Prominent [RUN MATCH] (prep mode) + Skewed [⚙] Dev Drawer
             - Viewport: 3D-to-2D Contextual Hexagonal Floating Prompts ([E] AMBIL, [F] RAKIT, [G] NAIK, [B] KIOSK)
             - Bottom-Right: Compact 3 Weapon Slots ([1] Pistol, [2] Rifle, [3] Bazooka)
         ===================================================================== */}
      {isPreloadComplete && tramRideCutsceneUi?.active && (
        <div
          data-tram-ride-cutscene-banner="true"
          className="fixed inset-x-0 top-6 z-[90] flex flex-col items-center pointer-events-none select-none px-4"
        >
          <div className="w-full max-w-xl bg-white text-black border-[3.5px] border-black shadow-[6px_6px_0_#000] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="-skew-x-6 px-2.5 py-0.5 bg-[#00d2ff] text-black border-2 border-black shadow-[2px_2px_0_#000] text-[10px] font-black uppercase tracking-widest">
                <span className="skew-x-6 inline-block">CITY TRAM TRANSIT</span>
              </span>
              <span className="font-mono text-xs font-black uppercase tracking-wider text-black/70">
                {Math.round(tramRideCutsceneUi.progress01 * 100)}%
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-black uppercase tracking-wider">
              <span>
                DEPARTING:{' '}
                <span className="text-[#0284c7]">
                  {getCityTransitDestinationById(tramRideCutsceneUi.originStationId).title}
                </span>
              </span>
              <span className="text-black/50">-&gt;</span>
              <span>
                ARRIVING:{' '}
                <span className="text-[#16a34a]">
                  {getCityTransitDestinationById(tramRideCutsceneUi.destinationStationId).title}
                </span>
              </span>
            </div>
            <div className="mt-3 w-full h-3 bg-[#e2e8f0] border-2 border-black overflow-hidden">
              <div
                className="h-full bg-[#b8ff3c] transition-[width] duration-75 ease-out"
                style={{
                  width: `${Math.max(4, Math.round(tramRideCutsceneUi.progress01 * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {isPreloadComplete &&
        gameState === 'playing' &&
        !isFullMapOverview &&
        onboardingStep === 'completed' &&
        !tramRideCutsceneUi?.active && (
        <div className="fixed inset-0 z-20 pointer-events-none">
          {/* =================================================================
              3A. MINIMALIST CONTEXTUAL 3D-TO-2D FLOATING ICONS
                  - Item / Crate Pickup & Deposit: Hand Emoji ONLY (✋)
                  - Machine / Kiosk / Pad / Vehicle: Tilted White-Black Polygon Dot Icon
             ================================================================= */}
          <div
            aria-label="Contextual 3D Floating Prompts"
            className="fixed inset-0 pointer-events-none z-20 overflow-hidden"
          >
            {!isKioskModalOpen &&
              hud.floatingPrompts.map((fp) => (
                <button
                  key={fp.id}
                  type="button"
                  tabIndex={-1}
                  data-floating-prompt={fp.id}
                  aria-label={`${fp.actionLabel} [${fp.keyLabel}]`}
                  title={`${fp.actionLabel} [${fp.keyLabel}]`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    dispatchBuddyAction(fp.actionEvent);
                  }}
                  style={{
                    left: `${fp.xPct}%`,
                    top: `${fp.yPct}%`,
                  }}
                  className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer select-none"
                >
                  {fp.iconType === 'hand' ? (
                    <span
                      aria-hidden="true"
                      className="inline-block px-1.5 py-0.5 bg-white text-[#14161d] border-2 border-[#14161d] text-[10px] font-black leading-none"
                    >
                      GRAB
                    </span>
                  ) : (
                    <svg
                      viewBox="0 0 64 64"
                      className="w-[22px] h-[22px] sm:w-[24px] sm:h-[24px] drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.35)]"
                      aria-hidden="true"
                    >
                      {/* Outer Crisp White Polygon Sticker Silhouette */}
                      <polygon
                        points="15,10 46,5 60,22 60,48 45,60 18,57 5,40"
                        fill="#ffffff"
                      />
                      {/* Inner Thick Black Asymmetric Polygon Ring (Thicker Top-Left Comic Weight) */}
                      <polygon
                        points="18,14 45,9 57,24 57,46 44,56 20,53 9,39"
                        fill="#14161d"
                      />
                      {/* Pure White Inner Polygon Cutout */}
                      <polygon
                        points="22,20 44,16 54,27 54,44 43,53 22,50 14,38"
                        fill="#ffffff"
                      />
                      {/* Center Solid Pitch-Black Circle Dot */}
                      <circle cx="34.5" cy="34.5" r="7.5" fill="#14161d" />
                    </svg>
                  )}
                </button>
              ))}
          </div>

          {/* =================================================================
              3B. TOP-LEFT: COMPACT RADAR/MINIMAP + [Q: 1x1x2] PAD STATUS
             ================================================================= */}
          <div className="fixed top-3 left-3 z-30 flex flex-col items-start gap-2 pointer-events-none">
            {/* Compact 1:1 Calibrated Radar (Hidden inside Lobby room and Private House interior) */}
            {!isInsidePrivateHouse &&
              peacefulUiState.minimapRadarVisible &&
              (() => {
                const ccLevel = hud.commandCenterLevel ?? hud.baseBuildingLevel;
                const radarSpec = evaluateCommandCenterRadarSpec(ccLevel, true);

                return (
                  <div
                    aria-label="Mini Radar Arena"
                    data-radar-level={radarSpec.level}
                    data-radar-active="true"
                    className="pointer-events-auto relative w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 bg-[#070a0f] border-3 border-[#1a1a1a] ring-2 ring-white rounded-xl overflow-hidden shadow-[4px_4px_0_#1a1a1a] shrink-0"
                  >
                  {/* 1:1 Orthographic Top-Down Map of the Current 3-Part Mirrored Arena ([-125, +125]) */}
                  <img
                    src="/assets/kiosk/radar_arena_map.png"
                    alt="Arena Radar Map"
                    draggable={false}
                    className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
                  />

                  {/* Dynamic Building Indicators for All Active Commander Base Plots (Model Estate Plot 0 + Any Claimed NEAR Session Base) */}
                  {(hud.activeBluePlotIndices ?? [0]).map((plotIdx) => {
                    const pos = worldCoordToRadarPercent(
                      COMMANDER_PLOT_OFFSETS_X[plotIdx] ?? -45.0,
                      81.7,
                    );
                    return (
                      <span
                        key={`blue-base-radar-${plotIdx}`}
                        data-radar-active-base={`blue-${plotIdx}`}
                        style={{
                          left: `${pos.leftPct}%`,
                          top: `${pos.topPct}%`,
                        }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 w-2.5 h-3.5 border border-[#00d2ff] bg-[#00d2ff]/45 rounded-[1px] pointer-events-none"
                      />
                    );
                  })}
                  {(hud.activeRedPlotIndices ?? []).map((plotIdx) => {
                    const pos = worldCoordToRadarPercent(
                      COMMANDER_PLOT_OFFSETS_X[plotIdx] ?? -45.0,
                      -81.7,
                    );
                    return (
                      <span
                        key={`red-base-radar-${plotIdx}`}
                        data-radar-active-base={`red-${plotIdx}`}
                        style={{
                          left: `${pos.leftPct}%`,
                          top: `${pos.topPct}%`,
                        }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 w-2.5 h-3.5 border border-[#ff3b30] bg-[#ff3b30]/45 rounded-[1px] pointer-events-none"
                      />
                    );
                  })}

                  {/* Lobby Faction Portals (North Red & South Blue) + Halte Trem Return Pad + 4 Public Warzone Crate Pads */}
                  {LOBBY_FACTION_PORTALS.map((portal) => {
                    const pos = worldCoordToRadarPercent(portal.x, portal.z);
                    return (
                      <span
                        key={portal.id}
                        data-radar-portal={portal.team}
                        style={{ left: `${pos.leftPct}%`, top: `${pos.topPct}%` }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-white pointer-events-none ${
                          portal.team === 'red' ? 'bg-[#ff3b30]' : 'bg-[#00d2ff]'
                        }`}
                      />
                    );
                  })}
                  {(() => {
                    const tramShelterPos = worldCoordToRadarPercent(
                      LOBBY_TRAM_SHELTER_SPEC.returnPadX,
                      LOBBY_TRAM_SHELTER_SPEC.returnPadZ,
                    );
                    return (
                      <span
                        data-radar-tram-shelter="true"
                        style={{ left: `${tramShelterPos.leftPct}%`, top: `${tramShelterPos.topPct}%` }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-xs bg-[#38bdf8] border border-white pointer-events-none"
                      />
                    );
                  })()}
                  {PUBLIC_WARZONE_CRATE_PADS.map((pubPad) => {
                    const pos = worldCoordToRadarPercent(pubPad.worldX, pubPad.worldZ);
                    return (
                      <span
                        key={pubPad.id}
                        data-radar-public-pad={pubPad.id}
                        style={{ left: `${pos.leftPct}%`, top: `${pos.topPct}%` }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-[#facc15]/85 border border-[#1a1a1a] pointer-events-none"
                      />
                    );
                  })}

                  {/* Always-On 100% Bright Minimap Radar (No Fog-of-War Mask) */}

                  {/* Live Scanned Radar Dots (No Crates! Differentiated Small Pedestrian vs Large Heavy Vehicle Blinking Red Dots) */}
                  {hud.radarDots.map((dot) => {
                    const { leftPct, topPct } = worldCoordToRadarPercent(dot.x, dot.z);
  if (dot.kind === 'supply_drop') {
                      // Blinking Dynamic Supply Drop Beacon Signal (Central Oasis / Harbor Dock)
                      return (
                        <span
                          key={dot.id}
                          data-radar-dot="supply-drop-beacon"
                          style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center z-30 pointer-events-none"
                        >
                          <span className="absolute inset-0 rounded-full bg-[#facc15]/80 animate-ping" />
                          <span className="relative w-3 h-3 rounded-full bg-[#facc15] border-2 border-[#1a1a1a] shadow-[0_0_10px_#facc15] animate-pulse" />
                        </span>
                      );
                    }
                    if (dot.kind === 'tank_red') {
                      // Enemy Heavy Vehicle (Tank, Heavy Truck, Aircraft): LARGE PROMINENT BLINKING RED CIRCLE DOT
                      return (
                        <span
                          key={dot.id}
                          data-radar-dot="enemy-heavy-vehicle"
                          style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center z-30 pointer-events-none"
                        >
                          <span className="absolute inset-0 rounded-full bg-[#ff1e27]/75 animate-ping" />
                          <span className="relative w-3.5 h-3.5 rounded-full bg-[#ff1e27] border-2 border-[#ffe066] shadow-[0_0_10px_#ff1e27] animate-pulse" />
                        </span>
                      );
                    }
                    if (dot.kind === 'enemy') {
                      // Enemy Infantry / Pedestrian Attacker: SMALL BLINKING RED DOT
                      return (
                        <span
                          key={dot.id}
                          data-radar-dot="enemy-infantry"
                          style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#ff3b30] ring-1 ring-[#ff9aa8] shadow-[0_0_6px_#ff3b30] animate-pulse z-20 pointer-events-none"
                        />
                      );
                    }
                    if (dot.kind === 'barrel') {
                      // Explosive Barrel: Small orange diamond
                      return (
                        <span
                          key={dot.id}
                          data-radar-dot="barrel"
                          style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[#ff6d00] border border-[#ffab40] shadow-[0_0_4px_#ff6d00] z-10 pointer-events-none"
                        />
                      );
                    }
                    if (dot.kind === 'pickup') {
                      // Pickup drop (medkit, coin, ammo): Small bright cyan/yellow circle
                      return (
                        <span
                          key={dot.id}
                          data-radar-dot="pickup"
                          style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#00e5ff] ring-1 ring-white shadow-[0_0_4px_#00e5ff] z-10 pointer-events-none"
                        />
                      );
                    }
                    if (dot.kind === 'crate_red' || dot.kind === 'crate_super' || dot.kind === 'crate_legend') {
                      // Crate / Box dot
                      const crateBg =
                        dot.kind === 'crate_legend'
                          ? 'bg-[#d500f9] border-[#ea80fc]'
                          : dot.kind === 'crate_super'
                            ? 'bg-[#ffd600] border-white'
                            : 'bg-[#ff9100] border-[#ffe082]';
                      return (
                        <span
                          key={dot.id}
                          data-radar-dot={dot.kind}
                          style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-[2px] border ${crateBg} shadow-[0_0_4px_rgba(0,0,0,0.5)] z-10 pointer-events-none`}
                        />
                      );
                    }
                    let dotStyle = 'w-2.5 h-2.5 bg-[#2979ff] rounded-full border border-white z-10';
                    if (dot.kind === 'player') {
                      dotStyle =
                        'w-3 h-3 bg-[#b8ff3c] rounded-full ring-2 ring-[#1a1a1a] shadow-[0_0_6px_#b8ff3c] z-20';
                    } else if (dot.kind === 'tank_blue') {
                      dotStyle =
                        'w-3 h-2.5 bg-[#00d2ff] border border-white rounded-xs shadow-[0_0_5px_#00d2ff] z-10';
                    }
                    return (
                      <span
                        key={dot.id}
                        style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none ${dotStyle}`}
                      />
                    );
                  })}

                </div>
              );
            })()}

            {/* 3-Currency & Store Name Bar — Only Shown Inside Merchant Shop / Kiosk / Personal Wallet */}
            {playMode !== 'editor' &&
              (activeSpecialModal === 'npc_merchant' ||
                isKioskModalOpen ||
                isPersonalWalletModalOpen) && (
              <div className="pointer-events-auto flex items-center gap-1.5">
                <div
                  data-top-lul-badge="true"
                  title="LUL (Lulling) Session Currency"
                  className="-skew-x-12 px-2.5 py-1 bg-[#fec83e] text-[#1a1a1a] border-3 border-[#1a1a1a] shadow-[3px_3px_0_#1a1a1a] font-black text-[11px]"
                >
                  <span className="skew-x-12 inline-block">
                    {hud.gold} LUL
                  </span>
                </div>

                <div
                  data-top-cyon-badge="true"
                  title="CYON — Shop currency exchanged from LUL"
                  className="-skew-x-12 px-2 py-1 bg-[#38bdf8] text-[#0f172a] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] font-black text-[10px]"
                >
                  <span className="skew-x-12 inline-block">{cyonBalance} CYON</span>
                </div>

                <div
                  data-top-respite-badge="true"
                  title="RESPITE — Token for houses, companions, and Fish Market"
                  className="-skew-x-12 px-2 py-1 bg-[#d8b4fe] text-[#1e1b4b] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] font-black text-[10px]"
                >
                  <span className="skew-x-12 inline-block">{respiteBalance} RESPITE</span>
                </div>

                {activeSpecialModal === 'npc_merchant' && (
                  <div
                    data-lobby-gold-exchange-btn="true"
                    title="Merchant Shop & ATM Name"
                    className="-skew-x-12 px-2.5 py-1 bg-[#ffd700] text-[#1a1a1a] border-3 border-[#1a1a1a] shadow-[3px_3px_0_#1a1a1a] font-black text-[10px]"
                  >
                    <span className="skew-x-12 inline-block">
                      {merchantLocation === 'beach_house' ? 'Kai Merchant & ATM' : 'Hana Merchant & ATM'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Pure Harvester 3-Stage Contract Status Badge (Warzone Only - Hidden in Lobby, Safezone & MAP PREVIEW) */}
            {playMode !== 'editor' && peacefulUiState.harvesterContractBadgeVisible && (
              <div className="pointer-events-auto flex items-center gap-1.5">
                <button
                  type="button"
                  tabIndex={-1}
                  data-harvester-contract-badge="true"
                  data-harvester-stage={hud.harvesterContractStage ?? 'STANDBY'}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    dispatchBuddyAction('spawnContractHarvester');
                  }}
                  title="AI Pure Harvester Status (Max 2/Base)"
                  className={`-skew-x-12 px-2.5 py-0.5 border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] font-black text-[9.5px] cursor-pointer transition-transform active:scale-95 ${
                    hud.harvesterContractStage === 'CONTRACT_ACTIVE'
                      ? 'bg-[#b8ff3c] text-[#1a1a1a]'
                      : 'bg-[#1a1a1a] text-[#facc15]'
                  }`}
                >
                  <span className="skew-x-12 inline-block">
                    HARVESTER: {hud.harvesterContractLabel ?? 'STANDBY (WAIT CONTRACT)'}
                  </span>
                </button>
              </div>
            )}

            {/* LIVE MAP PREVIEW FREE-CAMERA BANNER & EXIT PREVIEW BUTTON (No Editor Sidebar/Modal) */}
            {playMode === 'editor' && (
              <div
                aria-label="Live Map Preview Controls"
                data-map-preview-banner="true"
                className="pointer-events-auto flex flex-col gap-1.5 bg-[#14161d]/95 text-white border-3 border-[#1a1a1a] ring-2 ring-[#00d2ff] shadow-[4px_4px_0_#1a1a1a] px-3 py-2 rounded-xl"
              >
                <div className="text-[11px] font-black uppercase tracking-wider text-[#00d2ff]">
                  MAP PREVIEW (LIVE FREE CAMERA)
                </div>
                <div className="text-[10px] font-bold text-white/85">
                  Left Drag / WASD: Pan · Right Drag: Orbit · Scroll: Zoom
                </div>
                <button
                  type="button"
                  data-exit-map-preview="true"
                  onClick={() => handleSwitchPlayMode('sandbox')}
                  className="-skew-x-12 mt-0.5 px-3 py-1.5 bg-[#ff3b30] hover:bg-[#ff554a] text-white font-black text-xs uppercase border-2 border-white shadow-[2px_2px_0_#000] cursor-pointer active:scale-95"
                >
                  <span className="skew-x-12 inline-block">EXIT PREVIEW</span>
                </button>
              </div>
            )}
          </div>

          {/* =================================================================
              3C. TOP-CENTER: ALWAYS-ON 10v10 OPEN WARZONE POPULATION BAR
                  ("BLUE 6/10 ONLINE VS RED 6/10 ONLINE" - Hidden in Lobby, Safezone & MAP PREVIEW)
             ================================================================= */}
          {playMode !== 'editor' && peacefulUiState.populationAndLivesBarVisible && (
            <div
              aria-label="Open Warzone Online Population Bar"
              data-warzone-population-bar="true"
              className="fixed top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center"
            >
              {/* Blue Team Online Population Bar (Max 10: 4 Base Owners + 6 Warzone Roamers) */}
              <div className="-skew-x-12 bg-[#1a1a1a] border-3 border-[#1a1a1a] ring-2 ring-white shadow-[4px_4px_0_#1a1a1a] px-1 py-1 flex items-center">
                <div className="relative w-36 sm:w-44 h-6 bg-[#11121a] overflow-hidden flex items-center justify-start px-2.5">
                  <div
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(
                          100,
                          ((hud.blueOnlinePopulation ?? 1) / (hud.maxOnlinePerTeam ?? 10)) * 100,
                        ),
                      )}%`,
                    }}
                    className="absolute inset-y-0 left-0 bg-[#00d2ff] transition-all duration-200"
                  />
                  <span
                    data-blue-online-label="true"
                    className="skew-x-12 relative z-10 font-black font-mono-tabular text-[11px] sm:text-xs text-white drop-shadow-[0_1px_2px_#1a1a1a] tracking-wider whitespace-nowrap"
                  >
                    {hud.blueOnlineLabel ?? 'BLUE 1/10 ONLINE'}
                  </span>
                </div>
              </div>

              {/* Center Polygonal VS Badge */}
              <div className="-skew-x-12 -mx-1.5 z-10 px-2.5 py-1 bg-[#fec83e] text-[#1a1a1a] border-3 border-[#1a1a1a] ring-2 ring-white shadow-[3px_3px_0_#1a1a1a] font-black text-xs tracking-widest">
                <span className="skew-x-12 inline-block">VS</span>
              </div>

              {/* Red Team Online Population Bar (Max 10: 4 Base Owners + 6 Warzone Roamers) */}
              <div className="-skew-x-12 bg-[#1a1a1a] border-3 border-[#1a1a1a] ring-2 ring-white shadow-[4px_4px_0_#1a1a1a] px-1 py-1 flex items-center">
                <div className="relative w-36 sm:w-44 h-6 bg-[#11121a] overflow-hidden flex items-center justify-end px-2.5">
                  <div
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(
                          100,
                          ((hud.redOnlinePopulation ?? 0) / (hud.maxOnlinePerTeam ?? 10)) * 100,
                        ),
                      )}%`,
                    }}
                    className="absolute inset-y-0 right-0 bg-[#ff3b30] transition-all duration-200"
                  />
                  <span
                    data-red-online-label="true"
                    className="skew-x-12 relative z-10 font-black font-mono-tabular text-[11px] sm:text-xs text-white drop-shadow-[0_1px_2px_#1a1a1a] tracking-wider whitespace-nowrap"
                  >
                    {hud.redOnlineLabel ?? 'RED 0/10 ONLINE'}
                  </span>
                </div>
              </div>

              {/* Clean HUD Return Button to Main World (since Kiosk Teleport is strictly disabled inside Warzone) */}
              {hud.worldMode === 'warzone' && (
                <button
                  type="button"
                  data-exit-warzone-btn="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setTramRideCutsceneUi({
                      active: true,
                      originStationId: 'warzone_arena',
                      destinationStationId: 'central_plaza',
                      progress01: 0,
                    });
                    window.dispatchEvent(
                      new CustomEvent('start-city-tram-ride-transition', {
                        detail: {
                          originStationId: 'warzone_arena',
                          destinationStationId: 'central_plaza',
                          targetWorldMode: 'lobby',
                        },
                      }),
                    );
                  }}
                  title="Return to Main World (Central Plaza)"
                  className="ml-2 -skew-x-12 px-2.5 py-1.5 bg-white hover:bg-[#fec83e] text-[#1a1a1a] border-3 border-[#1a1a1a] ring-2 ring-white shadow-[3px_3px_0_#1a1a1a] font-black text-[10.5px] uppercase tracking-wider cursor-pointer transition-colors"
                >
                  <span className="skew-x-12 inline-block">EXIT WARZONE</span>
                </button>
              )}
            </div>
          )}

          {/* =================================================================
              3C-2. PRIVATE HOUSE WALK-IN TOP HUD BAR (DECORATE, INVITE FRIEND, EXIT ROOM)
             ================================================================= */}
          {isInsidePrivateHouse && activeSpecialModal === 'none' && (
            <div
              data-private-house-walkin-hud="true"
              className="fixed top-3 left-1/2 -translate-x-1/2 z-40 pointer-events-auto flex flex-col items-center gap-2 select-none"
            >
              <div className="flex flex-wrap items-center gap-2 bg-[#0f172a]/95 text-white border-[3px] border-black shadow-[4px_4px_0_#000] px-3.5 py-2">
                <span className="px-2 py-0.5 bg-[#b8ff3c] text-black border border-black text-[10px] font-black uppercase tracking-wider">
                  {isSampleHouseView ? 'MODEL PAVILION' : 'MY PRIVATE HOUSE'}
                </span>
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-200 hidden sm:inline">
                  MODERN JAPANESE WOODEN PAVILION
                </span>

                {!isSampleHouseView && (
                  <>
                    <button
                      type="button"
                      data-house-open-studio-btn="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setIsHouseFriendInviteOpen(false);
                        setActiveSpecialModal('house_interior');
                      }}
                      className="px-2.5 py-1 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black border-2 border-black text-[10px] font-black uppercase cursor-pointer"
                    >
                      DECORATE STUDIO
                    </button>

                    <button
                      type="button"
                      data-house-invite-friend-toggle-btn="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setHouseInviteFeedback(null);
                        setIsHouseFriendInviteOpen((prev) => !prev);
                      }}
                      className="px-2.5 py-1 bg-[#facc15] hover:bg-[#fde047] text-black border-2 border-black text-[10px] font-black uppercase cursor-pointer"
                    >
                      INVITE FRIEND ({(hud.safezoneAllowedFriends ?? []).length})
                    </button>
                  </>
                )}

                <button
                  type="button"
                  data-house-walkin-exit-btn="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    dispatchBuddyAction('exitPrivateHouseInterior');
                  }}
                  className="px-2.5 py-1 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black text-[10px] font-black uppercase cursor-pointer"
                >
                  EXIT ROOM
                </button>
              </div>

              {isHouseFriendInviteOpen && !isSampleHouseView && (
                <div
                  data-house-friend-invite-popover="true"
                  className="w-80 sm:w-96 bg-white text-black border-[3px] border-black shadow-[5px_5px_0_#000] p-3 space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b-2 border-black pb-1.5">
                    <span className="text-[11px] font-black uppercase tracking-wider">
                      INVITE FRIEND TO PRIVATE HOUSE
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsHouseFriendInviteOpen(false)}
                      className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 border border-black text-[9.5px] font-black cursor-pointer"
                    >
                      X
                    </button>
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={houseInviteFriendInput}
                      onChange={(e) => setHouseInviteFriendInput(e.target.value)}
                      placeholder="Friend wallet or username..."
                      className="flex-1 px-2 py-1 bg-slate-50 border-2 border-black text-xs font-bold"
                    />
                    <button
                      type="button"
                      data-house-send-invite-btn="true"
                      onClick={() => {
                        const rawFriend = houseInviteFriendInput.trim().toLowerCase();
                        if (!rawFriend) return;
                        soundEngine.playPickup();
                        dispatchBuddyAction(`addSafezoneFriend:${rawFriend}`);
                        const senderLabel = playerDisplayName || 'YOU';
                        const senderAccount = hud.nearWalletId || playerUid || undefined;
                        const inviteText = `Invited you to visit my Modern Japanese Wooden Pavilion Private House!`;
                        const nowStr = new Date().toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        setChatMessages((prev) => [
                          ...prev,
                          {
                            id: `inv-${Date.now()}`,
                            senderId: senderAccount,
                            senderName: senderLabel,
                            recipientId: rawFriend,
                            recipientName: rawFriend,
                            isSelf: true,
                            text: inviteText,
                            timestamp: nowStr,
                            type: 'private',
                          },
                        ]);
                        void insertSocialMessageToSupabase({
                          sender_name: senderLabel,
                          sender_near_account: senderAccount,
                          recipient_name: rawFriend,
                          message: inviteText,
                          bubble_color: chatBubbleBgColor,
                          room_id: 'house_interior',
                        });
                        setHouseInviteFriendInput('');
                        setHouseInviteFeedback(`Invitation sent to ${rawFriend}!`);
                      }}
                      className="px-2.5 py-1 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-2 border-black text-[10px] font-black uppercase cursor-pointer shrink-0"
                    >
                      INVITE
                    </button>
                  </div>

                  {(hud.safezoneAllowedFriends ?? []).length > 0 && (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      <div className="text-[9.5px] font-black uppercase text-slate-500">
                        FRIENDLIST ({(hud.safezoneAllowedFriends ?? []).length})
                      </div>
                      {(hud.safezoneAllowedFriends ?? []).map((friendId) => (
                        <div
                          key={friendId}
                          className="flex items-center justify-between px-2 py-1 bg-slate-100 border border-black text-[10.5px] font-mono font-bold"
                        >
                          <span className="truncate">{friendId}</span>
                          <button
                            type="button"
                            onClick={() => {
                              soundEngine.playPickup();
                              const senderLabel = playerDisplayName || 'YOU';
                              const senderAccount = hud.nearWalletId || playerUid || undefined;
                              const inviteText = `Come hang out inside my Private House!`;
                              void insertSocialMessageToSupabase({
                                sender_name: senderLabel,
                                sender_near_account: senderAccount,
                                recipient_name: friendId,
                                message: inviteText,
                                bubble_color: chatBubbleBgColor,
                                room_id: 'house_interior',
                              });
                              setHouseInviteFeedback(`Invited ${friendId}!`);
                            }}
                            className="px-2 py-0.5 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black border border-black text-[9px] font-black uppercase cursor-pointer"
                          >
                            PING INVITE
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {houseInviteFeedback && (
                    <div className="px-2 py-1 bg-[#dcfce7] border border-emerald-700 text-[10px] font-black text-emerald-950">
                      {houseInviteFeedback}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Dynamic Supply Drop Countdown Warning Banner */}
          {hud.supplyDropBanner && peacefulUiState.combatHudVisible && (
            <div
              data-supply-drop-banner="true"
              className="fixed top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
            >
              <div className="-skew-x-12 px-4 py-1.5 bg-[#fec83e] text-[#1a1a1a] border-3 border-[#1a1a1a] ring-2 ring-white shadow-[4px_4px_0_#1a1a1a] font-black text-xs sm:text-sm tracking-wider uppercase animate-pulse">
                <span className="skew-x-12 inline-block">{hud.supplyDropBanner}</span>
              </div>
            </div>
          )}

          {/* =================================================================
              3D. TOP-RIGHT: 5-LIVES DEPLOYMENT BADGE (`5/5 LIVES`) + SKEWED GEAR [MENU] DRAWER
             ================================================================= */}
          <div className="fixed top-3 right-3 z-30 flex flex-col items-end gap-2 pointer-events-auto">
            <div className="flex items-center gap-2">
              {/* Compact Unified Health & Lives Badge: Hearts overlay on top of dynamic green HP bar */}
              {peacefulUiState.populationAndLivesBarVisible && (() => {
                const currentHp = Math.max(0, Math.round(hud.hp));
                const maxHp = Math.max(1, Math.round(hud.maxHp || 150));
                const hpPercent = Math.min(100, Math.max(0, (currentHp / maxHp) * 100));
                const currentLives = Math.max(0, hud.playerWarzoneLives ?? PLAYER_WARZONE_MAX_LIVES);
                const maxLives = Math.max(1, hud.playerWarzoneMaxLives ?? PLAYER_WARZONE_MAX_LIVES);
                return (
                  <div
                    data-warzone-hp-badge="true"
                    data-warzone-lives-badge="true"
                    title={`Health: ${currentHp}/${maxHp} HP | Lives: ${currentLives}/${maxLives}`}
                    className="-skew-x-12 relative px-3 py-1.5 min-w-[124px] sm:min-w-[136px] h-9 bg-[#1a1a1a] border-3 border-[#1a1a1a] ring-2 ring-white shadow-[4px_4px_0_#1a1a1a] overflow-hidden flex items-center justify-center"
                  >
                    {/* Dynamic Green HP Fill (starts full, shrinks left as character takes damage) */}
                    <div
                      className="absolute inset-y-0 left-0 bg-[#b8ff3c] transition-all duration-200 ease-out"
                      style={{ width: `${hpPercent}%` }}
                    />

                    {/* Hearts Overlay centered directly on top of the green health bar */}
                    <div className="skew-x-12 relative z-10 flex items-center gap-1.5">
                      {Array.from({ length: maxLives }).map((_, idx) => {
                        const isFilled = idx < currentLives;
                        return (
                          <svg
                            key={`warzone-heart-${idx}`}
                            viewBox="0 0 24 24"
                            className={`w-4 h-4 transition-all duration-200 ${
                              isFilled
                                ? 'text-[#ff1a53] fill-[#ff1a53] drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] scale-100'
                                : 'text-[#333333] fill-[#1a1a1a] opacity-40 scale-90'
                            }`}
                            aria-hidden="true"
                          >
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          </svg>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Top-Right Dedicated Self Profile, Bag & Wallet Buttons (Replaces clicking own 3D character) - Hidden in Warzone */}
              {hud.worldMode !== 'warzone' && (
                <>
                  <button
                    type="button"
                    data-top-self-profile-btn="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setIsTargetMenuExpanded(false);
                      setSelectedTargetUser(null);
                      setIsKioskModalOpen(false);
                      setIsSocialChatModalOpen(false);
                      setIsPersonalWalletModalOpen(false);
                      setIsPersonalBagModalOpen(false);
                      setActiveSpecialModal('none');
                      setActiveTeleportKioskModal('none');
                      window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
                      window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
                      setProfileTargetUser({
                        id: 0,
                        name: playerDisplayName || 'BUDDY',
                        isNpc: false,
                        isSelf: true,
                        distance: 0,
                        team: hud.playerTeam ?? 'blue',
                        status: 'Online',
                      });
                      setIsProfileModalOpen(true);
                    }}
                    className="-skew-x-12 px-2.5 h-9 flex items-center justify-center gap-1.5 font-black text-xs bg-[#38bdf8] hover:bg-[#7dd3fc] text-[#1a1a1a] border-3 border-[#1a1a1a] ring-2 ring-white shadow-[3px_3px_0_#1a1a1a] transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                    title="View Your Profile"
                  >
                    <span className="skew-x-12 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                      <span>PROFILE</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    data-top-self-bag-btn="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setIsTargetMenuExpanded(false);
                      setSelectedTargetUser(null);
                      setIsProfileModalOpen(false);
                      setIsKioskModalOpen(false);
                      setIsSocialChatModalOpen(false);
                      setIsPersonalWalletModalOpen(false);
                      setActiveSpecialModal('none');
                      setActiveTeleportKioskModal('none');
                      window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
                      window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
                      setIsPersonalBagModalOpen((prev) => !prev);
                    }}
                    className={`-skew-x-12 px-2.5 h-9 flex items-center justify-center gap-1.5 font-black text-xs ${
                      hud.equippedWeapon === 'Joran Fishing'
                        ? 'bg-[#4ade80] hover:bg-[#86efac]'
                        : 'bg-[#b8ff3c] hover:bg-[#d9f99d]'
                    } text-[#1a1a1a] border-3 border-[#1a1a1a] ring-2 ring-white shadow-[3px_3px_0_#1a1a1a] transition-transform hover:scale-105 active:scale-95 cursor-pointer`}
                    title="Open Personal Bag (Joran & Items)"
                  >
                    <span className="skew-x-12 flex items-center gap-1">
                      <Backpack className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                      <span>BAG</span>
                      {hud.equippedWeapon === 'Joran Fishing' && (
                        <span className="w-2 h-2 rounded-full bg-[#166534] border border-black" />
                      )}
                    </span>
                  </button>

                  <button
                    type="button"
                    data-top-self-wallet-btn="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setIsTargetMenuExpanded(false);
                      setSelectedTargetUser(null);
                      setIsProfileModalOpen(false);
                      setIsKioskModalOpen(false);
                      setIsSocialChatModalOpen(false);
                      setIsPersonalBagModalOpen(false);
                      setActiveSpecialModal('none');
                      setActiveTeleportKioskModal('none');
                      window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
                      window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
                      setIsPersonalWalletModalOpen(true);
                    }}
                    className="-skew-x-12 px-2.5 h-9 flex items-center justify-center gap-1.5 font-black text-xs bg-[#facc15] hover:bg-[#fde047] text-[#1a1a1a] border-3 border-[#1a1a1a] ring-2 ring-white shadow-[3px_3px_0_#1a1a1a] transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                    title="Open Your Personal Citizen Wallet"
                  >
                    <span className="skew-x-12 flex items-center gap-1">
                      <Wallet className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                      <span>WALLET</span>
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* =================================================================
              3E. BOTTOM-RIGHT: COMPACT 3 WEAPON SLOTS ([1] Pistol, [2] Rifle, [3] Bazooka)
                  + COMPACT SQUAD / VEHICLE STATUS (Hidden in Lobby & Safezone Mode)
             ================================================================= */}
          {playMode !== 'editor' && peacefulUiState.bottomRightWeaponAndHpHudVisible && (
            <div
              aria-label="Tactical Weapon & Character HUD"
              className="fixed bottom-3 right-3 z-30 pointer-events-auto flex flex-col items-end gap-2"
            >
              {/* Optional Nuclear Launcher targeting button */}
              {hud.hasDeployedNuclearLauncher && hud.nuclearStrikePhase === 'idle' && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    tabIndex={-1}
                    data-nuke-btn="open-targeting"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      dispatchBuddyAction('startNuclearStrikeTargeting');
                    }}
                    title="Press [N] to open Nuclear Targeting Satellite (Map Zoom-Out)"
                    className="-skew-x-12 px-2.5 py-1 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-[#1a1a1a] shadow-[3px_3px_0_#1a1a1a] font-black text-[10px] uppercase cursor-pointer"
                  >
                    <span className="skew-x-12 inline-block">[N] NUCLEAR TARGET</span>
                  </button>
                </div>
              )}

              {/* NUCLEAR LAUNCHER TACTICAL MAP ZOOM-OUT & CINEMATIC ROCKET OVERLAY */}
              {hud.nuclearStrikePhase !== 'idle' && (
                <div
                  data-testid="nuclear-strike-hud-banner"
                  className="fixed top-16 left-1/2 -translate-x-1/2 z-40 pointer-events-auto flex flex-col items-center gap-2"
                >
                  {hud.nuclearStrikePhase === 'targeting' ? (
                    <div className="bg-[#0d0f12] text-white border-[3px] border-[#ff3b30] shadow-[0_5px_0_#0d0f12] px-4 py-2.5 flex flex-col sm:flex-row items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#fec83e]">
                          NUCLEAR TARGETING SATELLITE (MAP ZOOM-OUT)
                        </span>
                        <span className="text-[11px] font-bold text-white/90">
                          Move Cursor / WASD &amp; Left-Click Map to Launch Rocket (Target X:{hud.nuclearTargetCoords.x} · Z:{hud.nuclearTargetCoords.z})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          data-testid="nuke-confirm-launch-btn"
                          onClick={() => dispatchBuddyAction('confirmNuclearStrikeTarget')}
                          className="-skew-x-6 px-3.5 py-1.5 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-white shadow-[2px_2px_0_#000] font-black text-xs uppercase cursor-pointer"
                        >
                          <span className="skew-x-6 inline-block">LAUNCH [ENTER]</span>
                        </button>
                        <button
                          type="button"
                          data-testid="nuke-cancel-targeting-btn"
                          onClick={() => dispatchBuddyAction('cancelNuclearStrikeTarget')}
                          className="-skew-x-6 px-2.5 py-1.5 bg-[#262b30] hover:bg-[#3a4149] text-white border-2 border-white/60 font-black text-xs uppercase cursor-pointer"
                        >
                          <span className="skew-x-6 inline-block">CANCEL</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#0d0f12]/95 text-white border-[3px] border-[#fec83e] shadow-[0_4px_0_#0d0f12] px-4 py-1.5 flex items-center gap-2.5">
                      <span className="text-xs font-black uppercase tracking-wider text-[#fec83e]">
                        {hud.nuclearStrikePhase === 'tracking_rocket'
                          ? "CINEMATIC CAMERA TRACKING MLRS-MK5 'ATLAS' NUCLEAR ROCKET..."
                          : hud.nuclearStrikePhase === 'watching_explosion'
                          ? 'NUCLEAR DETONATION — CAMERA RISING TO OBSERVE TARGET BLAST!'
                          : 'BLAST COMPLETE — RETURNING CAMERA TO ORIGIN...'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 3 Compact Skewed Weapon Slots ([1] Pistol, [2] Rifle, [3] Bazooka) */}
              {hud.controlMode === 'tank' ? (
                <div className="flex items-center gap-2">
                  {hud.grabbedPropName === 'Blitz Plane' && (
                    <>
                      <button
                        type="button"
                        tabIndex={-1}
                        data-plane-btn="climb"
                        onClick={(e) => {
                          e.currentTarget.blur();
                          dispatchBuddyAction('planeClimbStep');
                        }}
                        className="-skew-x-12 px-3 py-2 bg-[#00d2ff] text-[#1a1a1a] font-black text-xs border-3 border-[#1a1a1a] ring-2 ring-white shadow-[4px_4px_0_#1a1a1a] cursor-pointer"
                      >
                        <span className="skew-x-12 inline-block">[SPACE] CLIMB</span>
                      </button>
                      <button
                        type="button"
                        tabIndex={-1}
                        data-plane-btn="descend"
                        onClick={(e) => {
                          e.currentTarget.blur();
                          dispatchBuddyAction('planeDescendStep');
                        }}
                        className="-skew-x-12 px-3 py-2 bg-[#ff3b30] text-white font-black text-xs border-3 border-[#1a1a1a] ring-2 ring-white shadow-[4px_4px_0_#1a1a1a] cursor-pointer"
                      >
                        <span className="skew-x-12 inline-block">[C] DESCEND</span>
                      </button>
                    </>
                  )}
                  <div className="-skew-x-12 px-3.5 py-2 bg-[#b8ff3c] text-[#1a1a1a] font-black text-xs border-3 border-[#1a1a1a] ring-2 ring-white shadow-[4px_4px_0_#1a1a1a]">
                    <span className="skew-x-12 inline-block uppercase">
                      {hud.grabbedPropName || 'TANK'} ({hud.tankStoredCrates}/4 CRATES)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {(hud.hudWeaponBadges ?? []).map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      tabIndex={-1}
                      data-weapon-btn={w.slotId}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        dispatchBuddyAction(w.actionEvent);
                      }}
                      className={`-skew-x-12 px-3.5 py-2 font-black text-xs sm:text-sm uppercase tracking-wider border-3 border-[#1a1a1a] transition-all cursor-pointer ${
                        w.isActive
                          ? 'bg-[#b8ff3c] text-[#1a1a1a] ring-2 ring-white -translate-y-1 shadow-[4px_5px_0_#1a1a1a]'
                          : w.kind === 'tactical'
                            ? 'bg-[#fef08a] hover:bg-[#facc15] text-[#1a1a1a] shadow-[3px_3px_0_#1a1a1a]'
                            : 'bg-white/95 hover:bg-[#fec83e] text-[#1a1a1a] shadow-[3px_3px_0_#1a1a1a]'
                      }`}
                    >
                      <span className="skew-x-12 flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 bg-[#1a1a1a] text-white text-[10px] font-black">
                          [{w.ammoCount}]
                        </span>
                        <span>{w.label}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              3E-2. BOTTOM-CENTER: TIDEWATER FISHING HUD, NEEDLE GAUGE & 3D CATCH SHOWCASE MODAL
             ================================================================= */}
          {playMode !== 'editor' && (nearbyWaterZone.canFish || lastCaughtFishToast) && (
            <TidewaterFishingHudAndShowcase
              nearbyWaterZone={nearbyWaterZone}
              fishingPhase={fishingPhase}
              fishingCastPower={fishingCastPower}
              fishingHintMessage={fishingHintMessage}
              fishingMinigame={fishingMinigame}
              isHoldingReel={isHoldingReel}
              caughtFishBucketCount={caughtFishBucket.length}
              lastCaughtFishToast={lastCaughtFishToast}
              walletConnected={Boolean(hud.nearWalletConnected)}
              onRequestRegisterWallet={() => {
                soundEngine.playUiClick();
                setLastCaughtFishToast(null);
                setOnboardingStep('auth_choice');
              }}
              onStartChargeCast={() => {
                if (fishingPhase === 'idle' && caughtFishBucket.length < 20) {
                  ensureFishingRodEquipped();
                  setIsChargingCast(true);
                  setFishingPhase('charging');
                }
              }}
              onReleaseChargeCast={() => {
                if (fishingPhase === 'charging') {
                  launchTidewaterCast(fishingCastPower);
                }
              }}
              onSetHoldingReel={(holding) => {
                setIsHoldingReel(holding);
              }}
              onCancelCast={() => {
                soundEngine.playUiClick();
                clearFishingCastTimers();
                setIsChargingCast(false);
                setIsHoldingReel(false);
                setFishingMinigame(null);
                setFishingHintMessage(null);
                setFishingPhase('idle');
              }}
              onTriggerFishingAction={handleTriggerFishingAction}
              onKeepCaughtFish={() => {
                soundEngine.playUiClick();
                setLastCaughtFishToast(null);
              }}
              onReleaseCaughtFish={(fish) => {
                soundEngine.playUiClick();
                setCaughtFishBucket((prev) => prev.filter((f) => f.id !== fish.id));
                setLastCaughtFishToast(null);
              }}
              onSellCaughtFishToKai={handleSellRawFishForLul}
              onMintCaughtFishAsNft={handleMintCaughtFishNft}
            />
          )}

          {/* =================================================================
              3F. BOTTOM-LEFT: SOCIAL TALK CHAT INPUT BAR + PRIVATE NOTIFICATION TOAST
             ================================================================= */}
          {playMode !== 'editor' && (
            <div className="fixed bottom-3 left-3 z-30 pointer-events-auto flex flex-col items-end">
              {/* Incoming Private Chat Notification Popup (Anchored Above Yellow CHAT Button) */}
              {activePrivateNotificationToast && (
                <button
                  type="button"
                  data-private-chat-toast="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    const senderUser = activePrivateNotificationToast.user;
                    setIsKioskModalOpen(false);
                    setIsProfileModalOpen(false);
                    setIsPersonalWalletModalOpen(false);
                    setActiveSpecialModal('none');
                    setActiveTeleportKioskModal('none');
                    window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
                    window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
                    setSelectedPrivateUser(senderUser);
                    setIsSocialChatModalOpen(true);
                    setUnreadPrivateCount(0);
                    setActivePrivateNotificationToast(null);
                  }}
                  className="mb-2 max-w-[270px] bg-white hover:bg-[#fef08a] text-black border-[3px] border-black shadow-[4px_4px_0px_#000] px-3 py-2 text-left cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px] select-none"
                >
                  <div className="flex items-center justify-between gap-2 border-b-2 border-black pb-1 mb-1">
                    <span className="px-1.5 py-0.5 bg-[#facc15] border border-black text-[9px] font-black uppercase tracking-wider text-black">
                      PRIVATE MESSAGE
                    </span>
                    <span className="text-[10px] font-black uppercase text-slate-900 truncate max-w-[120px]">
                      {activePrivateNotificationToast.senderName}
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-slate-800 truncate">
                    {activePrivateNotificationToast.text}
                  </div>
                </button>
              )}

              <form
                aria-label="Social Talk Chat Input"
                data-social-talk-bar="true"
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmed = socialChatText.trim();
                  if (trimmed.length > 0) {
                    if (activeSpecialModal === 'npc_merchant') {
                      window.dispatchEvent(
                        new CustomEvent('npc-merchant-user-chat', {
                          detail: { text: trimmed },
                        }),
                      );
                    }

                    const nowStr = new Date().toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    const senderLabel = playerDisplayName || 'YOU';
                    const senderAccount = hud.nearWalletId || playerUid || undefined;
                    if (isSocialChatModalOpen && selectedPrivateUser) {
                      const newPrivateMsg: ChatMessage = {
                        id: `priv-${Date.now()}`,
                        senderId: senderAccount,
                        senderName: senderLabel,
                        recipientName: selectedPrivateUser.name,
                        recipientId: String(selectedPrivateUser.id),
                        isSelf: true,
                        text: trimmed,
                        timestamp: nowStr,
                        type: 'private',
                      };
                      setChatMessages((prev) => [...prev, newPrivateMsg]);
                      void insertSocialMessageToSupabase({
                        sender_name: senderLabel,
                        sender_near_account: senderAccount,
                        recipient_name: selectedPrivateUser.name,
                        message: trimmed,
                        bubble_color: chatBubbleBgColor,
                        room_id: worldMode,
                      });
                    } else {
                      const newMsg: ChatMessage = {
                        id: `pub-${Date.now()}`,
                        senderId: senderAccount,
                        senderName: senderLabel,
                        isSelf: true,
                        text: trimmed,
                        timestamp: nowStr,
                        type: 'public',
                      };
                      setChatMessages((prev) => [...prev, newMsg]);
                      dispatchBuddyAction(`socialTalk:${trimmed}`);
                      void insertSocialMessageToSupabase({
                        sender_name: senderLabel,
                        sender_near_account: senderAccount,
                        message: trimmed,
                        bubble_color: chatBubbleBgColor,
                        room_id: worldMode,
                      });
                    }
                    setSocialChatText('');
                  }
                }}
                className="flex items-center gap-1.5 bg-[#14161d]/95 border-3 border-[#1a1a1a] ring-2 ring-white shadow-[4px_4px_0_#1a1a1a] px-2.5 py-1.5 rounded-lg"
              >
                <input
                  type="text"
                  data-social-chat-input="true"
                  maxLength={64}
                  value={socialChatText}
                  onChange={(e) => setSocialChatText(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Type a short message..."
                  className="w-40 sm:w-56 px-2 py-1 bg-white text-[#14161d] font-bold text-xs rounded border-2 border-[#14161d] focus:outline-none focus:ring-2 focus:ring-[#10b981]"
                />
                <button
                  type="submit"
                  data-social-chat-send="true"
                  className="-skew-x-12 px-3 py-1 bg-[#10b981] hover:bg-[#34d399] text-[#0f172a] font-black text-xs uppercase border-2 border-[#14161d] shadow-[2px_2px_0_#14161d] cursor-pointer active:scale-95"
                >
                  <span className="skew-x-12 inline-block">SEND</span>
                </button>
                <button
                  type="button"
                  data-open-social-chat-btn="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    if (unreadPrivateCount > 0 && lastUnreadPrivateSender) {
                      setIsKioskModalOpen(false);
                      setIsProfileModalOpen(false);
                      setIsPersonalWalletModalOpen(false);
                      setActiveSpecialModal('none');
                      setActiveTeleportKioskModal('none');
                      window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
                      window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
                      setSelectedPrivateUser(lastUnreadPrivateSender);
                      setIsSocialChatModalOpen(true);
                      setUnreadPrivateCount(0);
                      setActivePrivateNotificationToast(null);
                      return;
                    }
                    setIsSocialChatModalOpen((prev) => {
                      const next = !prev;
                      if (next) {
                        setIsKioskModalOpen(false);
                        setActiveSpecialModal('none');
                        setActiveTeleportKioskModal('none');
                        window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
                        window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
                      }
                      return next;
                    });
                  }}
                  className="-skew-x-12 relative px-3 py-1 bg-[#facc15] hover:bg-[#fde047] text-black font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer active:scale-95 ml-1"
                  title="Open Social Chat"
                >
                  <span className="skew-x-12 inline-flex items-center gap-1">
                    <span>WORLD</span>
                    {unreadPrivateCount > 0 && (
                      <span
                        data-chat-unread-private-badge="true"
                        className="px-1.5 py-0.2 bg-[#ff3b30] text-white border border-black text-[9px] font-black leading-tight"
                      >
                        {unreadPrivateCount}
                      </span>
                    )}
                  </span>
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          4. PAUSE MODAL CARD (gameState === 'paused')
         ===================================================================== */}
      {gameState === 'paused' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-modal-title"
          className="fixed inset-0 z-30 flex items-center justify-center p-4 pointer-events-auto"
          style={{ backgroundColor: 'rgba(17, 18, 26, 0.82)' }}
        >
          <div className="w-full max-w-md bg-[#191b24] border-4 border-[#11121a] ring-4 ring-white rounded-2xl p-6 comic-sticker-shadow-lg text-center space-y-5">
            <h2
              id="pause-modal-title"
              className="text-3xl font-black tracking-wide text-[#b8ff3c]"
            >
              Game Paused
            </h2>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 bg-[#272935] rounded-xl border-2 border-[#11121a]">
                <div className="text-[10px] font-black text-[#8f93a5]">SCORE</div>
                <div className="text-lg font-black font-mono-tabular text-white">{hud.score}</div>
              </div>
              <div className="p-3 bg-[#272935] rounded-xl border-2 border-[#11121a]">
                <div className="text-[10px] font-black text-[#8f93a5]">RED HQ</div>
                <div className="text-lg font-black font-mono-tabular text-[#ff3b30]">
                  {hud.redBaseHp}
                </div>
              </div>
              <div className="p-3 bg-[#272935] rounded-xl border-2 border-[#11121a]">
                <div className="text-[10px] font-black text-[#8f93a5]">ENEMIES KO</div>
                <div className="text-lg font-black font-mono-tabular text-[#b8ff3c]">
                  {hud.enemiesDefeated}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleTogglePause}
                className="w-full py-3 bg-[#b8ff3c] hover:bg-[#c7ff72] text-[#11121a] font-black text-base rounded-xl border-3 border-[#11121a] comic-sticker-shadow cursor-pointer"
              >
                Resume Game
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleStartGame(true)}
                  className="py-2.5 bg-[#272935] hover:bg-[#393b49] text-white font-black text-xs rounded-xl border-2 border-[#11121a] cursor-pointer"
                >
                  Restart Arena
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    document.body.dataset.state = 'title';
                    setGameState('title');
                  }}
                  className="py-2.5 bg-[#272935] hover:bg-[#393b49] text-white font-black text-xs rounded-xl border-2 border-[#11121a] cursor-pointer"
                >
                  Title Screen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          5. MMORPG AI NPC MERCHANT & 3-CURRENCY ATM + PRIVATE HOUSE INTERIOR
         ===================================================================== */}
      <NpcMerchantAndHouseModal
        activeModalMode={activeSpecialModal}
        merchantLocation={merchantLocation}
        isSampleHouseView={isSampleHouseView}
        marketState={marketState}
        lulBalance={hud.gold}
        cyonBalance={cyonBalance}
        respiteBalance={respiteBalance}
        nearTestnetBalance={nearTestnetBalance}
        walletConnected={Boolean(hud.nearWalletConnected)}
        hasHouseOwnership={hasHouseOwnership || Boolean(hud.nearHasGamepassNft)}
        citizenDisplayName={playerDisplayName}
        isTutorialHanaActive={tutorialStage === 'go_to_hana'}
        hanaWelcomeNearClaimed={hanaWelcomeNearClaimed}
        onClaimHanaWelcomeNear={handleClaimHanaWelcomeNear}
        onFinishHanaTutorialAndGuideKiosk={() => {
          setActiveSpecialModal('none');
          setTutorialStage('go_to_kiosk');
        }}
        isFastForwardRunning={isFastForwardRunning}
        onToggleFastForward={() => {
          soundEngine.playUiClick();
          setIsFastForwardRunning((prev) => !prev);
        }}
        onBuyHouseWithRespite={async () => {
          const priceRespite = HOUSE_OWNERSHIP_PRICE_RESPITE;
          if (respiteBalance < priceRespite) return false;
          const actorAccount = hud.nearWalletId || playerUid;
          const res = await executeMarketContractCallOnChain({
            signerAccountId: actorAccount || undefined,
            methodName: 'purchase_citizen_asset',
            args: {
              asset_id: 'house_ownership',
              plan_id: null,
              order_id: null,
            },
          });
          if (!res.ok || !res.txHash) return false;
          const resolvedActor = res.signerAccountId || hudRef.current.nearWalletId || actorAccount;
          let nextRespite = Math.max(0, respiteBalance - priceRespite);
          let deedTokenId = 'nep171:house:ownership';
          if (resolvedActor) {
            const [liveRespiteStr, liveEstate] = await Promise.all([
              fetchNep141Balance(NEAR_CONFIG.nep141RespiteContractId, resolvedActor),
              fetchBuddiesMarketEstate(resolvedActor),
            ]);
            if (liveRespiteStr !== null) {
              nextRespite = Math.max(0, Number(liveRespiteStr) || 0);
            }
            if (liveEstate?.house_deed?.deed_token_id) {
              deedTokenId = liveEstate.house_deed.deed_token_id;
            }
          }
          setRespiteBalance(nextRespite);
          setHasHouseOwnership(true);
          if (resolvedActor) {
            dispatchBuddyAction(`nearSyncWalletSession:${resolvedActor}:1:${deedTokenId}`);
          }
          setHud((prev) => ({
            ...prev,
            nearHasGamepassNft: true,
            nearGamepassTokenId: deedTokenId,
          }));
          if (resolvedActor) {
            void syncPlayerBalancesToSupabase({
              nearAccountId: resolvedActor,
              lulBalance: hud.gold,
              cyonBalance,
              respiteBalance: nextRespite,
              ownedTokenIds: [...ownedMerchantItemIds, deedTokenId],
            });
            void logMarketTransactionToSupabase({
              merchant_id: merchantLocation,
              actor_near_account: resolvedActor,
              action_type: 'buy_item',
              item_id: 'house_ownership',
              nep245_token_id: deedTokenId,
              currency: 'RESPITE',
              amount: 1,
              unit_price: priceRespite,
              reasoning_summary: `Purchased Private House Sub-Account Deed (${deedTokenId}) for ${priceRespite} RESPITE.`,
              near_tx_hash: res.txHash,
            });
          }
          return true;
        }}
        recruitedFamilyMembers={recruitedFamilyMembers}
        onRecruitFamilyMember={async (planId) => {
          const plan =
            FAMILY_MEMBER_CONTRACT_PLANS.find((p) => p.id === planId) ||
            FAMILY_MEMBER_CONTRACT_PLANS[0];
          if (respiteBalance < plan.priceRespite) return null;
          const actorAccount = hud.nearWalletId || playerUid;

          const memberNumber = recruitedFamilyMembers.length + 1;
          const now = new Date();
          const expires = new Date(now.getTime() + plan.durationDays * 86400 * 1000);
          const agentId = `family-member-${Date.now().toString(36)}`;
          const contractAddress = `family-${memberNumber}.buddiesblitz.testnet`;

          const res = await executeMarketContractCallOnChain({
            signerAccountId: actorAccount || undefined,
            methodName: 'purchase_citizen_asset',
            args: {
              asset_id: 'family_member',
              plan_id: plan.id,
              order_id: 'collect_boxes',
            },
          });
          if (!res.ok || !res.txHash) return null;
          const resolvedActor = res.signerAccountId || hudRef.current.nearWalletId || actorAccount;

          let nextRespite = Math.max(0, respiteBalance - plan.priceRespite);
          if (resolvedActor) {
            const liveRespiteStr = await fetchNep141Balance(
              NEAR_CONFIG.nep141RespiteContractId,
              resolvedActor,
            );
            if (liveRespiteStr !== null) {
              nextRespite = Math.max(0, Number(liveRespiteStr) || 0);
            }
          }
          setRespiteBalance(nextRespite);

          const newMember: RecruitedFamilyMemberAgent = {
            agentId,
            name: `FAMILY MEMBER #${memberNumber}`,
            contractAddress,
            planId: plan.id,
            planLabel: plan.shortLabel,
            pricePaidRespite: plan.priceRespite,
            recruitedAtIso: now.toISOString(),
            expiresAtIso: expires.toISOString(),
            activeOrder: 'collect_boxes',
            nearTxHash: res.txHash,
          };
          setRecruitedFamilyMembers((prev) => [newMember, ...prev]);

          if (resolvedActor) {
            void syncPlayerBalancesToSupabase({
              nearAccountId: resolvedActor,
              lulBalance: hud.gold,
              cyonBalance,
              respiteBalance: nextRespite,
            });
            void logMarketTransactionToSupabase({
              merchant_id: merchantLocation,
              actor_near_account: resolvedActor,
              action_type: 'buy_item',
              item_id: `family_member_${plan.id}`,
              nep245_token_id: newMember.contractAddress,
              currency: 'RESPITE',
              amount: 1,
              unit_price: plan.priceRespite,
              reasoning_summary: `Recruited ${newMember.name} (${plan.label}) for ${plan.priceRespite} RESPITE.`,
              near_tx_hash: newMember.nearTxHash,
            });
          }
          return newMember;
        }}
        onCommandFamilyMember={(agentId, orderId) => {
          const orderSpec =
            FAMILY_MEMBER_ORDER_SPECS.find((o) => o.id === orderId) ||
            FAMILY_MEMBER_ORDER_SPECS[0];
          setRecruitedFamilyMembers((prev) =>
            prev.map((m) => (m.agentId === agentId ? { ...m, activeOrder: orderId } : m)),
          );
          if (orderId === 'go_fishing') {
            const caught = rollRandomCaughtFish({
              waterZone: 'east_beach',
              caughtByAccount: hud.nearWalletId || playerUid || '',
            });
            setCaughtFishBucket((prev) => [caught, ...prev]);
          } else {
            dispatchBuddyAction(`adjustPlayerLul:${orderSpec.rewardLul}`);
            if (orderId === 'warzone_attack') {
              dispatchBuddyAction('kioskSelectRecipe:buddy_infantry');
            }
          }
        }}
        ownedItemIds={ownedMerchantItemIds}
        activeHouseThemeId={activeHouseThemeId}
        interiorPlacement={interiorPlacement}
        playerBubbleBgColor={chatBubbleBgColor}
        playerBubbleTextColor={chatBubbleTextColor}
        onClose={() => {
          soundEngine.playUiClick();
          setActiveSpecialModal('none');
        }}
        onEarnSafezoneLul={(amount: number) => {
          soundEngine.playUiClick();
          dispatchBuddyAction(`adjustPlayerLul:${amount}`);
        }}
        onExchangeLulToCyon={(customLulSpent?: number, customCyonGranted?: number) => {
          soundEngine.playUiClick();
          const actorAccount = hud.nearWalletId || playerUid;
          if (
            typeof customLulSpent === 'number' &&
            typeof customCyonGranted === 'number' &&
            customLulSpent > 0 &&
            customCyonGranted > 0 &&
            hud.gold >= customLulSpent
          ) {
            dispatchBuddyAction(`adjustPlayerLul:${-customLulSpent}`);
            const nextCyon = cyonBalance + customCyonGranted;
            setCyonBalance(nextCyon);
            if (actorAccount) {
              void syncNpcMerchantToSupabase({
                merchant_id: merchantLocation,
                cyon_treasury: Math.max(0, marketState.treasuryCyon - customCyonGranted),
              });
              void logMarketTransactionToSupabase({
                merchant_id: merchantLocation,
                actor_near_account: actorAccount,
                action_type: 'exchange_lul_cyon',
                currency: 'CYON',
                amount: customCyonGranted,
                unit_price: Number((customLulSpent / customCyonGranted).toFixed(2)),
                reasoning_summary: `Exchanged ${customLulSpent} LUL for ${customCyonGranted} CYON at ${merchantLocation}`,
              });
              void syncPlayerBalancesToSupabase({
                nearAccountId: actorAccount,
                lulBalance: Math.max(0, hud.gold - customLulSpent),
                cyonBalance: nextCyon,
                respiteBalance,
              });
            }
            return;
          }
          const res = executeLulToCyonExchange(marketState, hud.gold, cyonBalance);
          if (res.ok) {
            const lulSpent = Math.max(0, hud.gold - res.updatedLul);
            dispatchBuddyAction(`adjustPlayerLul:${-lulSpent}`);
            setCyonBalance(res.updatedCyon);
            setMarketState(res.updatedState);
            if (actorAccount) {
              void syncNpcMerchantToSupabase({
                merchant_id: merchantLocation,
                cyon_treasury: res.updatedState.treasuryCyon,
                is_bankrupt: res.updatedState.isShopBroke,
                last_headline: res.updatedState.lastMarketHeadline,
              });
              void logMarketTransactionToSupabase({
                merchant_id: merchantLocation,
                actor_near_account: actorAccount,
                action_type: 'exchange_lul_cyon',
                currency: 'CYON',
                amount: res.updatedCyon - cyonBalance,
                unit_price: lulSpent,
                reasoning_summary: res.updatedState.lastMarketHeadline,
              });
            }
          }
        }}
        onInvestInMerchant={() => {
          soundEngine.playUiClick();
          const actorAccount = hud.nearWalletId || playerUid;
          const res = investInMerchantShop(marketState, hud.gold, cyonBalance);
          if (res.ok) {
            const lulSpent = Math.max(0, hud.gold - res.updatedLul);
            dispatchBuddyAction(`adjustPlayerLul:${-lulSpent}`);
            setCyonBalance(res.updatedCyon);
            setMarketState(res.updatedState);
            if (actorAccount) {
              void syncNpcMerchantToSupabase({
                merchant_id: merchantLocation,
                cyon_treasury: res.updatedState.treasuryCyon,
                is_bankrupt: res.updatedState.isShopBroke,
                last_headline: res.updatedState.lastMarketHeadline,
              });
              void logMarketTransactionToSupabase({
                merchant_id: merchantLocation,
                actor_near_account: actorAccount,
                action_type: 'invest_shop',
                currency: 'LUL',
                amount: lulSpent,
                unit_price: 1,
                reasoning_summary: res.updatedState.lastMarketHeadline,
              });
            }
          }
        }}
        onBuyMerchantItem={(item: MerchantCatalogItem, finalPrice: number) => {
          soundEngine.playUiClick();
          if (ownedMerchantItemIds.includes(item.id)) return;
          const actorAccount = hud.nearWalletId || playerUid;
          if (item.currency === 'RESPITE' && !actorAccount) {
            setIsNearWalletSelectorOpen(true);
            return;
          }
          let nextCyon = cyonBalance;
          let nextRespite = respiteBalance;
          if (item.currency === 'CYON') {
            if (cyonBalance < finalPrice) return;
            nextCyon = Math.max(0, cyonBalance - finalPrice);
            setCyonBalance(nextCyon);
          } else {
            if (respiteBalance < finalPrice) return;
            nextRespite = Math.max(0, respiteBalance - finalPrice);
            setRespiteBalance(nextRespite);
          }
          const nextOwned = ownedMerchantItemIds.includes(item.id)
            ? ownedMerchantItemIds
            : [...ownedMerchantItemIds, item.id];
          setOwnedMerchantItemIds(nextOwned);
          if (item.category === 'nft_house_theme') {
            setActiveHouseThemeId(item.id);
            dispatchBuddyAction(
              `applyHouseTheme:${item.skinThemeId ?? 'military_standard'}:${item.gardenPresetId ?? 'sakura_grove'}`,
            );
          } else if (item.interiorSlot) {
            const slotId = item.interiorSlot;
            setInteriorPlacement((prev) =>
              prev[slotId] === null ? { ...prev, [slotId]: item.id } : prev,
            );
          }
          setMarketState((prev) => {
            const nextStock = {
              ...prev.stockByItemId,
              [item.id]: Math.max(0, (prev.stockByItemId[item.id] ?? item.initialStock) - 1),
            };
            const nextDemand = {
              ...prev.demandByItemId,
              [item.id]: Math.min(5, (prev.demandByItemId[item.id] ?? 0) + 1),
            };
            const nextTreasury =
              prev.treasuryCyon + (item.currency === 'CYON' ? finalPrice : finalPrice * 12);
            const headline = `You purchased ${item.name} (${finalPrice} ${item.currency}). Stock decreased, demand trend rising!`;

            if (actorAccount) {
              void syncNpcMerchantToSupabase({
                merchant_id: merchantLocation,
                cyon_treasury: nextTreasury,
                stock_by_item: nextStock,
                recent_demand_by_item: nextDemand,
                last_headline: headline,
              });
              void logMarketTransactionToSupabase({
                merchant_id: merchantLocation,
                actor_near_account: actorAccount,
                action_type: 'buy_item',
                item_id: item.id,
                nep245_token_id: item.tokenId,
                currency: item.currency,
                amount: 1,
                unit_price: finalPrice,
                reasoning_summary: headline,
              });
            }

            return {
              ...prev,
              stockByItemId: nextStock,
              demandByItemId: nextDemand,
              treasuryCyon: nextTreasury,
              lastMarketHeadline: headline,
            };
          });
          if (actorAccount) {
            void syncPlayerBalancesToSupabase({
              nearAccountId: actorAccount,
              lulBalance: hud.gold,
              cyonBalance: nextCyon,
              respiteBalance: nextRespite,
              ownedTokenIds: nextOwned,
            });
          }
        }}
        onSellMerchantItem={(item: MerchantCatalogItem, refund: number) => {
          soundEngine.playUiClick();
          if (!ownedMerchantItemIds.includes(item.id)) return;
          const actorAccount = hud.nearWalletId || playerUid;
          if (!actorAccount) return;
          let nextCyon = cyonBalance;
          let nextRespite = respiteBalance;
          if (item.currency === 'CYON') {
            nextCyon = cyonBalance + refund;
            setCyonBalance(nextCyon);
          } else {
            nextRespite = respiteBalance + refund;
            setRespiteBalance(nextRespite);
          }
          const nextOwned = ownedMerchantItemIds.filter((id) => id !== item.id);
          setOwnedMerchantItemIds(nextOwned);
          setInteriorPlacement((prev) => ({
            ...prev,
            center_table: prev.center_table === item.id ? null : prev.center_table,
            left_wall: prev.left_wall === item.id ? null : prev.left_wall,
            right_wall: prev.right_wall === item.id ? null : prev.right_wall,
            corner_plant: prev.corner_plant === item.id ? null : prev.corner_plant,
            trophy_pedestal: prev.trophy_pedestal === item.id ? null : prev.trophy_pedestal,
          }));
          setMarketState((prev) => {
            const nextStock = {
              ...prev.stockByItemId,
              [item.id]: (prev.stockByItemId[item.id] ?? item.initialStock) + 1,
            };
            const nextDemand = {
              ...prev.demandByItemId,
              [item.id]: Math.max(-4, (prev.demandByItemId[item.id] ?? 0) - 1),
            };
            const nextTreasury = Math.max(
              0,
              prev.treasuryCyon - (item.currency === 'CYON' ? refund : refund * 8),
            );
            const headline = `You sold back ${item.name} (+${refund} ${item.currency}). Shop stock increased!`;

            void syncNpcMerchantToSupabase({
              merchant_id: merchantLocation,
              cyon_treasury: nextTreasury,
              stock_by_item: nextStock,
              recent_demand_by_item: nextDemand,
              last_headline: headline,
            });
            void logMarketTransactionToSupabase({
              merchant_id: merchantLocation,
              actor_near_account: actorAccount,
              action_type: 'sell_item',
              item_id: item.id,
              nep245_token_id: item.tokenId,
              currency: item.currency,
              amount: 1,
              unit_price: refund,
              reasoning_summary: headline,
            });

            return {
              ...prev,
              stockByItemId: nextStock,
              demandByItemId: nextDemand,
              treasuryCyon: nextTreasury,
              lastMarketHeadline: headline,
            };
          });
          void syncPlayerBalancesToSupabase({
            nearAccountId: actorAccount,
            lulBalance: hud.gold,
            cyonBalance: nextCyon,
            respiteBalance: nextRespite,
            ownedTokenIds: nextOwned,
          });
        }}
        onSelectHouseTheme={(themeItem: MerchantCatalogItem) => {
          soundEngine.playUiClick();
          if (!ownedMerchantItemIds.includes(themeItem.id)) return;
          const actorAccount = hud.nearWalletId || playerUid;
          if (!actorAccount) return;
          setActiveHouseThemeId(themeItem.id);
          dispatchBuddyAction(
            `applyHouseTheme:${themeItem.skinThemeId ?? 'military_standard'}:${themeItem.gardenPresetId ?? 'sakura_grove'}`,
          );
          void syncHouseInteriorToSupabase({
            ownerNearAccount: actorAccount,
            activeThemeId: themeItem.id,
            daylightHour: 14.5,
            placedFurniture: [interiorPlacement],
          });
        }}
        onAssignInteriorSlot={(slotId: HouseInteriorSlotId, itemId: string | null) => {
          soundEngine.playUiClick();
          const actorAccount = hud.nearWalletId || playerUid;
          setInteriorPlacement((prev) => {
            const next = {
              ...prev,
              [slotId]: itemId,
            };
            if (actorAccount) {
              void syncHouseInteriorToSupabase({
                ownerNearAccount: actorAccount,
                activeThemeId: activeHouseThemeId,
                daylightHour: 14.5,
                placedFurniture: [next],
              });
            }
            return next;
          });
        }}
        onRotateInteriorSlot={(slotId: HouseInteriorSlotId) => {
          soundEngine.playUiClick();
          setInteriorPlacement((prev) => ({
            ...prev,
            rotationStepBySlot: {
              ...prev.rotationStepBySlot,
              [slotId]: ((prev.rotationStepBySlot[slotId] ?? 0) + 1) % 4,
            },
          }));
        }}
        onConnectWallet={() => {
          soundEngine.playUiClick();
          if (!hud.nearWalletConnected) {
            setActiveSpecialModal('none');
            setOnboardingStep('auth_choice');
          } else {
            setIsNearWalletSelectorOpen(true);
          }
        }}
        onSwapNearAndRespite={async (direction, inputAmount) => {
          const actorAccount = hud.nearWalletId || playerUid;
          const receipt = await executeNearTestnetAndRespiteSwap({
            direction,
            signerAccountId: actorAccount || undefined,
            inputAmount,
            networkId: walletNetworkChoice,
          });
          if (!receipt || !receipt.txHash) return null;
          const resolvedActor = receipt.accountId || hudRef.current.nearWalletId || actorAccount;

          let nextNear =
            direction === 'near_to_respite'
              ? Math.max(0, Number((nearTestnetBalance - receipt.nearAmount).toFixed(4)))
              : Number((nearTestnetBalance + receipt.nearAmount).toFixed(4));
          let nextRespite =
            direction === 'near_to_respite'
              ? respiteBalance + receipt.respiteAmount
              : Math.max(0, respiteBalance - receipt.respiteAmount);

          if (resolvedActor) {
            const [liveAccountView, liveRespiteStr] = await Promise.all([
              fetchNearAccountView(resolvedActor),
              fetchNep141Balance(NEAR_CONFIG.nep141RespiteContractId, resolvedActor),
            ]);
            if (liveAccountView) {
              const liveNear = Number(liveAccountView.amount) / 1e24;
              if (Number.isFinite(liveNear)) {
                nextNear = Number(liveNear.toFixed(4));
              }
            }
            if (liveRespiteStr !== null) {
              const parsedRespite = Number(liveRespiteStr);
              if (Number.isFinite(parsedRespite)) {
                nextRespite = parsedRespite;
              }
            }
          }

          setNearTestnetBalance(nextNear);
          setRespiteBalance(nextRespite);

          if (resolvedActor) {
            void syncPlayerBalancesToSupabase({
              nearAccountId: resolvedActor,
              lulBalance: hud.gold,
              cyonBalance,
              respiteBalance: nextRespite,
            });
            void logMarketTransactionToSupabase({
              merchant_id: merchantLocation,
              actor_near_account: resolvedActor,
              action_type: 'exchange_lul_cyon',
              nep245_token_id: receipt.tokenContractId,
              currency: 'RESPITE',
              amount: receipt.respiteAmount,
              unit_price: receipt.nearAmount,
              reasoning_summary:
                direction === 'near_to_respite'
                  ? `Swapped ${receipt.nearAmount} NEAR Testnet -> +${receipt.respiteAmount} RESPITE (${receipt.tokenContractId})`
                  : `Swapped ${receipt.respiteAmount} RESPITE -> +${receipt.nearAmount} NEAR Testnet (${receipt.tokenContractId})`,
              near_tx_hash: receipt.txHash,
            });
          }
          return receipt;
        }}
        caughtFishBucket={caughtFishBucket}
        fishMarketListings={fishMarketListings}
        fishSalesStats={fishSalesStats}
        playerNearAccount={hud.nearWalletId || playerUid || ''}
        onSellCaughtFish={handleSellRawFishForLul}
        onReleaseCaughtFish={(fish: CaughtFishItem) => {
          setCaughtFishBucket((prev) => prev.filter((f) => f.id !== fish.id));
          if (lastCaughtFishToast?.id === fish.id) setLastCaughtFishToast(null);
        }}
        onReleaseAllCommonFish={() => {
          setCaughtFishBucket((prev) =>
            prev.filter((f) => f.isMintedNft || f.rarity !== 'Common'),
          );
          if (lastCaughtFishToast?.rarity === 'Common') {
            setLastCaughtFishToast(null);
          }
        }}
        onMintFishAsNft={handleMintCaughtFishNft}
        onListFishNftOnMarket={async (
          fish: CaughtFishItem,
          priceRespiteInput: number,
        ): Promise<boolean> => {
          if (!fish.isMintedNft || !fish.nftTokenId) return false;
          const actorAccount = hud.nearWalletId || playerUid;
          const cleanRespitePrice = Math.max(1, Math.round(priceRespiteInput));
          const listingId = `listing-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
          const res = await executeMarketContractCallOnChain({
            signerAccountId: actorAccount || undefined,
            methodName: 'list_fish_nft',
            args: {
              listing_id: listingId,
              token_id: fish.nftTokenId,
              price_respite: String(cleanRespitePrice),
            },
          });
          if (!res.ok || !res.txHash) return false;
          const resolvedActor = res.signerAccountId || hudRef.current.nearWalletId || actorAccount;
          const newListing: FishNftMarketplaceListing = {
            listingId,
            nftTokenId: fish.nftTokenId,
            speciesId: fish.speciesId,
            speciesName: fish.speciesName,
            waterZone: fish.waterZone,
            waterZoneLabel: fish.waterZoneLabel,
            rarity: fish.rarity,
            weightKg: fish.weightKg,
            lengthCm: fish.lengthCm,
            isTrophy: fish.isTrophy,
            colorHex: fish.colorHex,
            caughtByAccount: fish.caughtByAccount,
            sellerNearAccount: resolvedActor || fish.caughtByAccount,
            priceRespite: cleanRespitePrice,
            priceLul: cleanRespitePrice,
            nearTxHash: res.txHash,
            listedAtIso: new Date().toISOString(),
          };
          setCaughtFishBucket((prev) => prev.filter((f) => f.id !== fish.id));
          setFishMarketListings((prev) => {
            const next = [newListing, ...prev];
            if (resolvedActor) {
              void syncFishMarketplaceListingsToSupabase({
                listings: next,
                transaction: {
                  merchant_id: 'beach_house',
                  actor_near_account: resolvedActor,
                  action_type: 'list_fish_nft',
                  item_id: fish.speciesId,
                  nep245_token_id: newListing.nftTokenId,
                  currency: 'RESPITE',
                  amount: newListing.priceRespite,
                  unit_price: newListing.priceRespite,
                  reasoning_summary: `${resolvedActor} listed ${fish.speciesName} (${fish.weightKg} kg, ${fish.rarity}) on Kai's Marketplace for ${newListing.priceRespite} RESPITE.`,
                  near_tx_hash: newListing.nearTxHash,
                },
              });
            }
            return next;
          });
          void refreshFishMarketplaceFromChainAndDb();
          return true;
        }}
        onBuyFishNftFromMarket={async (listing: FishNftMarketplaceListing): Promise<boolean> => {
          const actorAccount = hud.nearWalletId || playerUid;
          const isOwnListing =
            Boolean(actorAccount) &&
            listing.sellerNearAccount.toLowerCase() === actorAccount.toLowerCase();
          const listingPriceRespite = Math.max(
            1,
            listing.priceRespite ||
              (listing.priceLul > 200
                ? Math.round(listing.priceLul / 50)
                : listing.priceLul),
          );
          if (
            !isOwnListing &&
            actorAccount &&
            !isActiveWalletReadOnlyObserver() &&
            respiteBalance < listingPriceRespite
          ) {
            return false;
          }

          const res = await executeMarketContractCallOnChain({
            signerAccountId: actorAccount || undefined,
            methodName: isOwnListing ? 'unlist_fish_nft' : 'buy_fish_nft',
            args: {
              listing_id: listing.listingId,
            },
          });
          if (!res.ok || !res.txHash) return false;
          const resolvedActor = res.signerAccountId || hudRef.current.nearWalletId || actorAccount;

          if (!isOwnListing) {
            let nextRespite = Math.max(0, respiteBalance - listingPriceRespite);
            if (resolvedActor) {
              const liveRespiteStr = await fetchNep141Balance(
                NEAR_CONFIG.nep141RespiteContractId,
                resolvedActor,
              );
              if (liveRespiteStr !== null) {
                nextRespite = Math.max(0, Number(liveRespiteStr) || 0);
              }
            }
            setRespiteBalance(nextRespite);
            void creditRecipientRespiteInSupabase(listing.sellerNearAccount, listingPriceRespite);
            if (resolvedActor) {
              void syncPlayerBalancesToSupabase({
                nearAccountId: resolvedActor,
                lulBalance: hud.gold,
                cyonBalance,
                respiteBalance: nextRespite,
                ownedTokenIds: [...ownedMerchantItemIds, listing.nftTokenId],
              });
            }
          }

          const sellCyonFallback = Math.max(15, Math.round(listingPriceRespite * 2));
          const reclaimedFish: CaughtFishItem = {
            id: `fish-nft-${Date.now()}`,
            speciesId: listing.speciesId,
            speciesName: listing.speciesName,
            waterZone: listing.waterZone,
            waterZoneLabel: listing.waterZoneLabel,
            rarity: listing.rarity,
            weightKg: listing.weightKg,
            sellValueCyon: sellCyonFallback,
            sellValueLul: sellCyonFallback,
            mintFeeLul: 0,
            suggestedRespitePrice: listingPriceRespite,
            colorHex: listing.colorHex,
            loreTag: `Acquired on Kai's P2P Fish Marketplace (Original Angler: ${listing.caughtByAccount}).`,
            caughtByAccount: listing.caughtByAccount,
            caughtAtIso: listing.listedAtIso,
            isMintedNft: true,
            nftTokenId: listing.nftTokenId,
            nearTxHash: res.txHash,
          };

          setCaughtFishBucket((prev) => [reclaimedFish, ...prev]);
          setFishMarketListings((prev) => {
            const next = prev.filter((l) => l.listingId !== listing.listingId);
            if (resolvedActor) {
              void syncFishMarketplaceListingsToSupabase({
                listings: next,
                removedListingId: listing.listingId,
                transaction: {
                  merchant_id: 'beach_house',
                  actor_near_account: resolvedActor,
                  action_type: isOwnListing ? 'unlist_fish_nft' : 'buy_fish_nft',
                  item_id: listing.speciesId,
                  nep245_token_id: listing.nftTokenId,
                  currency: 'RESPITE',
                  amount: isOwnListing ? 0 : listingPriceRespite,
                  unit_price: listingPriceRespite,
                  reasoning_summary: isOwnListing
                    ? `${resolvedActor} unlisted ${listing.speciesName} (${listing.weightKg} kg) from Kai's Marketplace.`
                    : `${resolvedActor} bought ${listing.speciesName} NFT (${listing.weightKg} kg) from ${listing.sellerNearAccount} for ${listingPriceRespite} RESPITE.`,
                  near_tx_hash: res.txHash,
                },
              });
            }
            return next;
          });
          void refreshFishMarketplaceFromChainAndDb();
          return true;
        }}
      />

      {/* =====================================================================
          7. SELF-SERVICE TACTICAL KIOSK MODAL (PRIORITY HOLOGRAM, BASE UPGRADE & CRATE AIRDROP)
         ===================================================================== */}
      <TacticalKioskModal
        isOpen={isKioskModalOpen}
        onClose={() => {
          setIsKioskModalOpen(false);
          window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
        }}
        hud={{
          ...hud,
          worldMode,
          cityArenaMode: worldMode === 'safezone' ? 'safezone' : hud.cityArenaMode,
        }}
        onSelectRecipe={(recipeId) => {
          dispatchBuddyAction(`kioskSelectRecipe:${recipeId}`);
        }}
        onRemoveQueueIndex={(index) => {
          dispatchBuddyAction(`kioskRemoveQueueIndex:${index}`);
        }}
        onClearQueue={() => {
          dispatchBuddyAction('kioskClearQueue');
        }}
        onUpgradeBase={(upgradeId) => {
          dispatchBuddyAction(`kioskUpgradeBase:${upgradeId}`);
        }}
        onBuyCrateAirdrop={(crateKind) => {
          dispatchBuddyAction(`kioskBuyCrate:${crateKind}`);
        }}
        onNearConnectAndMint={() => {
          soundEngine.playUiClick();
          setIsNearWalletSelectorOpen(true);
        }}
        onNearClaimBasePlot={() => {
          const account = hud.nearWalletId || playerUid;
          if (!account) return;
          dispatchBuddyAction('nearClaimBasePlot');
          const team = hud.nearKioskPlotTeam || hud.playerTeam || 'blue';
          const plotIdx = hud.nearKioskPlotIndex ?? 1;
          void syncBasePlotToSupabase({
            team,
            plotIndex: plotIdx,
            isClaimed: true,
            claimedByNearAccount: account,
            claimedByTokenId: nep171Ledger.tokenId || null,
            activeHarvesters: [`harvester-1.${account}`, `harvester-2.${account}`],
            accessMode: hud.safezonePlotAccessMode || 'PUBLIC',
          });
        }}
        onNearReleaseBasePlot={() => {
          dispatchBuddyAction('nearReleaseBasePlot');
          const team = hud.nearClaimedTeam || hud.playerTeam || 'blue';
          const plotIdx = hud.nearClaimedPlotIndex ?? 1;
          void syncBasePlotToSupabase({
            team,
            plotIndex: plotIdx,
            isClaimed: false,
            claimedByNearAccount: null,
            claimedByTokenId: null,
            activeHarvesters: [],
          });
        }}
        onSetSafezoneAccessMode={(mode) => {
          dispatchBuddyAction(`setSafezoneAccessMode:${mode}`);
        }}
        onAddSafezoneFriend={(friendId) => {
          dispatchBuddyAction(`addSafezoneFriend:${friendId}`);
        }}
        onRemoveSafezoneFriend={(friendId) => {
          dispatchBuddyAction(`removeSafezoneFriend:${friendId}`);
        }}
        onEnterPrivateHouseInterior={() => {
          soundEngine.playUiClick();
          setIsKioskModalOpen(false);
          window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
          const isSample =
            hud.nearKioskPlotTeam === 'blue' &&
            (hud.nearKioskPlotIndex === 0 || hud.nearKioskPlotIndex === null);
          setIsSampleHouseView(isSample);
          setIsInsidePrivateHouse(true);
          setActiveSpecialModal('none');
        }}
        onOpenHouseCatalog={() => {
          soundEngine.playUiClick();
          setIsKioskModalOpen(false);
          window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
          setMerchantLocation('lobby_cafe');
          setActiveSpecialModal('npc_merchant');
          window.dispatchEvent(new CustomEvent('open-npc-catalog-house'));
        }}
        onOpenPersonalWallet={() => {
          soundEngine.playUiClick();
          setIsKioskModalOpen(false);
          window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
          setIsPersonalWalletModalOpen(true);
        }}
      />

      {/* =====================================================================
          9. MMORPG SOCIAL CHAT MODAL (3-COLUMN: ONLINE LIST, PUBLIC, PRIVATE)
         ===================================================================== */}
      <SocialChatModal
        isOpen={isSocialChatModalOpen}
        onClose={() => setIsSocialChatModalOpen(false)}
        playerName={playerDisplayName || 'YOU'}
        playerUid={hud.nearWalletId || playerUid}
        onChangePlayerName={handleUpdatePlayerUsername}
        nearbyUsers={hud.nearbyRadiusUsers ?? []}
        selectedPrivateUser={selectedPrivateUser}
        onSelectPrivateUser={setSelectedPrivateUser}
        chatMessages={chatMessages}
        unreadPrivateCount={unreadPrivateCount}
        onClearUnreadPrivate={() => {
          setUnreadPrivateCount(0);
          setActivePrivateNotificationToast(null);
        }}
        playerBubbleBgColor={chatBubbleBgColor}
        playerBubbleTextColor={chatBubbleTextColor}
        isInsidePrivateHouse={isInsidePrivateHouse}
        isMuted={isMuted}
        audioVolumePct={audioVolumePct}
        onToggleAudio={handleToggleAudio}
        onChangeVolumePct={handleChangeVolumePct}
        onOpenHouseDecoration={() => {
          soundEngine.playUiClick();
          setIsSocialChatModalOpen(false);
          setActiveSpecialModal('house_interior');
        }}
        onChangeBubbleBgColor={(hex) => {
          soundEngine.playUiClick();
          setChatBubbleBgColor(hex);
          window.dispatchEvent(
            new CustomEvent('update-social-bubble-style', {
              detail: { bgColor: hex, textColor: chatBubbleTextColor },
            }),
          );
        }}
        onChangeBubbleTextColor={(hex) => {
          soundEngine.playUiClick();
          setChatBubbleTextColor(hex);
          window.dispatchEvent(
            new CustomEvent('update-social-bubble-style', {
              detail: { bgColor: chatBubbleBgColor, textColor: hex },
            }),
          );
        }}
        onSendPublicChat={(text) => {
          const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const senderLabel = playerDisplayName || 'YOU';
          const senderAccount = hud.nearWalletId || playerUid || undefined;
          const newMsg: ChatMessage = {
            id: `pub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            senderId: senderAccount,
            senderName: senderLabel,
            isSelf: true,
            text,
            timestamp: nowStr,
            type: 'public',
          };
          setChatMessages((prev) => [...prev, newMsg]);
          dispatchBuddyAction(`socialTalk:${text}`);
          void insertSocialMessageToSupabase({
            sender_name: senderLabel,
            sender_near_account: senderAccount,
            message: text,
            bubble_color: chatBubbleBgColor,
            room_id: worldMode,
          });
        }}
        onSendPrivateChat={(recipient, text) => {
          if (recipient.isNpc) return;
          const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const senderLabel = playerDisplayName || 'YOU';
          const senderAccount = hud.nearWalletId || playerUid || undefined;
          const newMsg: ChatMessage = {
            id: `priv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            senderId: senderAccount,
            senderName: senderLabel,
            recipientId: String(recipient.id),
            recipientName: recipient.name,
            isSelf: true,
            text,
            timestamp: nowStr,
            type: 'private',
          };
          setChatMessages((prev) => [...prev, newMsg]);
          dispatchBuddyAction(`socialTalk:[Whisper @${recipient.name}] ${text}`);
          void insertSocialMessageToSupabase({
            sender_name: senderLabel,
            sender_near_account: senderAccount,
            recipient_name: recipient.name,
            message: text,
            bubble_color: chatBubbleBgColor,
            room_id: worldMode,
          });
        }}
      />

      {/* =====================================================================
          9B. UNIFIED CITY TRANSIT KIOSK MODAL (Black Self-Service Monolith Series)
         ===================================================================== */}
      <CityTransitKioskModal
        isOpen={activeTeleportKioskModal !== 'none'}
        originStationId={
          activeTeleportKioskModal !== 'none'
            ? activeTeleportKioskModal
            : hud.worldMode === 'warzone'
              ? 'warzone_arena'
              : 'central_plaza'
        }
        worldMode={hud.worldMode ?? 'lobby'}
        hasOwnedHouse={Boolean(hasHouseOwnership || hud.nearHasGamepassNft)}
        blueTeamOnlineCount={hud.blueOnlinePopulation ?? 1}
        redTeamOnlineCount={hud.redOnlinePopulation ?? 0}
        isTutorialTourActive={tutorialStage === 'go_to_kiosk'}
        onCompleteTutorialTour={() => {
          setTutorialStage('none');
        }}
        onClose={() => {
          soundEngine.playUiClick();
          setActiveTeleportKioskModal('none');
          window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
        }}
        onConfirmEnterDestination={(
          destination: CityTransitDestinationSpec,
          team?: 'blue' | 'red',
        ) => {
          soundEngine.playUiClick();
          const originStationId: CityTransitStationId =
            activeTeleportKioskModal !== 'none'
              ? activeTeleportKioskModal
              : hud.worldMode === 'warzone'
                ? 'warzone_arena'
                : 'central_plaza';
          setActiveTeleportKioskModal('none');
          window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
          setTramRideCutsceneUi({
            active: true,
            originStationId,
            destinationStationId: destination.id,
            progress01: 0,
          });
          window.dispatchEvent(
            new CustomEvent('start-city-tram-ride-transition', {
              detail: {
                originStationId,
                destinationStationId: destination.id,
                team,
              },
            }),
          );
        }}
        onEnterMyHouseStudio={() => {
          soundEngine.playUiClick();
          setActiveTeleportKioskModal('none');
          window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
          setIsKioskModalOpen(false);
          setIsSocialChatModalOpen(false);
          setHouseEntryScanState('scanning');
          window.setTimeout(() => {
            soundEngine.playPickup();
            setHouseEntryScanState('verified');
            window.setTimeout(() => {
              setHouseEntryScanState('idle');
              setIsInsidePrivateHouse(true);
              setIsSampleHouseView(false);
              setActiveSpecialModal('none');
            }, 600);
          }, 700);
        }}
        onOpenHouseCatalog={() => {
          soundEngine.playUiClick();
          setActiveTeleportKioskModal('none');
          window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
          setIsKioskModalOpen(false);
          setIsSocialChatModalOpen(false);
          setMerchantLocation('lobby_cafe');
          setActiveSpecialModal('npc_merchant');
          window.dispatchEvent(new CustomEvent('open-npc-catalog-house'));
        }}
        onOpenShopAndExchange={() => {
          soundEngine.playUiClick();
          const originStation =
            activeTeleportKioskModal !== 'none' ? activeTeleportKioskModal : 'central_plaza';
          setActiveTeleportKioskModal('none');
          window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
          setIsKioskModalOpen(false);
          setIsSocialChatModalOpen(false);
          setMerchantLocation(
            originStation === 'beachfront_harbor' ? 'beach_house' : 'lobby_cafe',
          );
          setActiveSpecialModal('npc_merchant');
        }}
      />

      {/* =====================================================================
          9B-2. LEFT-SLIDE PERSONAL WALLET MODAL (Opened When Clicking WALLET on Self)
         ===================================================================== */}
      <aside
        role="dialog"
        aria-modal="false"
        aria-hidden={!isPersonalWalletModalOpen}
        aria-label="Personal Wallet"
        data-personal-wallet-modal="true"
        className={`fixed left-4 top-16 bottom-20 z-40 w-full max-w-lg flex flex-col select-none transition-all duration-300 ease-out transform ${
          isPersonalWalletModalOpen
            ? 'translate-x-0 opacity-100 pointer-events-auto'
            : '-translate-x-[120%] opacity-0 pointer-events-none'
        }`}
      >
        <div className="relative flex-1 flex flex-col bg-white border-[3.5px] border-black shadow-[4px_4px_0px_#000] p-4 sm:p-5 text-black overflow-hidden min-h-0">
          <div className="flex items-center justify-between gap-2 pb-3 border-b-[2.5px] border-black shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-wallet-tab="wallet"
                onClick={() => {
                  soundEngine.playUiClick();
                  setPersonalWalletTab('wallet');
                }}
                className={`-skew-x-6 px-3.5 py-1 border-2 border-black shadow-[3px_3px_0px_#000] text-xs font-black uppercase flex items-center gap-2 cursor-pointer transition-colors ${
                  personalWalletTab === 'wallet'
                    ? 'bg-[#facc15] text-black'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <div className="skew-x-6 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                  <span>WALLET</span>
                </div>
              </button>

              <button
                type="button"
                data-wallet-tab="assets"
                onClick={() => {
                  soundEngine.playUiClick();
                  setPersonalWalletTab('assets');
                }}
                className={`-skew-x-6 px-3.5 py-1 border-2 border-black shadow-[3px_3px_0px_#000] text-xs font-black uppercase flex items-center gap-2 cursor-pointer transition-colors ${
                  personalWalletTab === 'assets'
                    ? 'bg-[#facc15] text-black'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <div className="skew-x-6 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                  <span>ASSET</span>
                </div>
              </button>

              <button
                type="button"
                data-wallet-tab="history"
                onClick={() => {
                  soundEngine.playUiClick();
                  setPersonalWalletTab('history');
                }}
                className={`-skew-x-6 px-3.5 py-1 border-2 border-black shadow-[3px_3px_0px_#000] text-xs font-black uppercase flex items-center gap-2 cursor-pointer transition-colors ${
                  personalWalletTab === 'history'
                    ? 'bg-[#facc15] text-black'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <div className="skew-x-6 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                  <span>HISTORY</span>
                </div>
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                setIsPersonalWalletModalOpen(false);
              }}
              className="-skew-x-6 w-8 h-8 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black shadow-[3px_3px_0px_#000] font-black text-xs flex items-center justify-center cursor-pointer active:scale-95"
              aria-label="Close Personal Wallet"
            >
              <span className="skew-x-6 inline-block">X</span>
            </button>
          </div>

          <div className="mt-3 flex-1 overflow-y-auto pr-1 space-y-3 min-h-0">
            {personalWalletTab === 'wallet' ? (
              <>
                {/* ACCOUNT, WALLET ADDRESS & USERNAME CARD */}
                <div
                  data-wallet-uid-and-username-card="true"
                  className="p-3 bg-[#1e293b] text-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5"
                >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    LOGIN ACCOUNT
                  </div>
                  <div className="text-xs font-bold text-white truncate">
                    {connectedGoogleEmail || 'Guest Session'}
                  </div>
                </div>
                <button
                  type="button"
                  data-switch-or-disconnect-wallet-btn="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    void disconnectNearWallet();
                    void signOutSupabaseAuth();
                    if (privyAuthenticated) {
                      void privyLogout();
                    }
                    setConnectedGoogleEmail('');
                    setNearTestnetBalance(0);
                    setRespiteBalance(0);
                    setHasHouseOwnership(false);
                    setHud((prev) => ({
                      ...prev,
                      nearWalletConnected: false,
                      nearWalletId: '',
                      nearHasGamepassNft: false,
                      nearGamepassTokenId: null,
                    }));
                    setPlayerUid('');
                    if (typeof window !== 'undefined') {
                      try {
                        window.localStorage.setItem('bb_explicit_logged_out_v1', '1');
                        window.localStorage.removeItem('bb_connected_google_email_v2');
                        window.localStorage.removeItem('bb_last_connected_wallet_id_v2');
                      } catch {
                        // ignore
                      }
                    }
                    dispatchBuddyAction('nearDisconnectSession');
                    setTutorialStage('none');
                    setIsPersonalWalletModalOpen(false);
                    setOnboardingStep('auth_choice');
                  }}
                  className="-skew-x-6 px-2.5 py-1 bg-[#ff3b30] hover:bg-[#ff554a] text-white font-black text-[9.5px] uppercase border-2 border-black shadow-[2px_2px_0_#000] cursor-pointer shrink-0"
                >
                  <span className="skew-x-6 inline-block">LOG OUT</span>
                </button>
              </div>

              {/* WALLET ADDRESS OR SIGN IN PROMPT */}
              <div className="p-2.5 bg-[#0f172a] border border-white/20 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-[10px] font-black uppercase tracking-wider text-[#b8ff3c]">
                    YOUR WALLET
                  </div>
                  {hud.nearWalletConnected && hud.nearWalletId && (
                    <span
                      className={`px-1.5 py-0.5 border border-black text-[8.5px] font-black uppercase ${
                        isActiveWalletReadOnlyObserver()
                          ? 'bg-[#fec83e] text-black'
                          : 'bg-[#b8ff3c] text-black'
                      }`}
                    >
                      {isActiveWalletReadOnlyObserver() ? 'VIEW ONLY' : 'CONNECTED'}
                    </span>
                  )}
                </div>
                {hud.nearWalletConnected && hud.nearWalletId ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div
                        data-wallet-active-uid="true"
                        className="text-xs font-mono font-black text-[#38bdf8] break-all"
                      >
                        {hud.nearWalletId}
                      </div>
                      <button
                        type="button"
                        data-copy-wallet-address-btn="true"
                        onClick={() => {
                          soundEngine.playUiClick();
                          const addr = hud.nearWalletId || playerUid;
                          if (typeof navigator !== 'undefined' && navigator.clipboard) {
                            void navigator.clipboard.writeText(addr);
                          }
                          setWalletAddressCopiedToast(true);
                          window.setTimeout(() => setWalletAddressCopiedToast(false), 1800);
                        }}
                        className="-skew-x-6 px-2.5 py-1 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black font-black text-[9.5px] uppercase border border-black cursor-pointer shrink-0"
                      >
                        <span className="skew-x-6 inline-block">
                          {walletAddressCopiedToast ? 'COPIED' : 'COPY'}
                        </span>
                      </button>
                    </div>
                    <button
                      type="button"
                      data-personal-wallet-switch-signer-btn="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setIsPersonalWalletModalOpen(false);
                        setIsNearWalletSelectorOpen(true);
                      }}
                      className="w-full -skew-x-6 py-1.5 px-3 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black font-black text-[10px] uppercase border border-black cursor-pointer"
                    >
                      <span className="skew-x-6 inline-block">
                        {isActiveWalletReadOnlyObserver() ? 'CONNECT WALLET' : 'MANAGE WALLET'}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div
                      data-wallet-active-uid="true"
                      className="text-[11px] font-bold text-slate-300"
                    >
                      Connect or create a wallet to unlock trading.
                    </div>
                    <button
                      type="button"
                      data-personal-wallet-open-selector-btn="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setIsPersonalWalletModalOpen(false);
                        setIsNearWalletSelectorOpen(true);
                      }}
                      className="-skew-x-6 px-3 py-1 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black font-black text-[10px] uppercase border border-black cursor-pointer shrink-0"
                    >
                      <span className="skew-x-6 inline-block">CONNECT WALLET</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* BALANCES */}
            <div className="space-y-2">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                BALANCES
              </div>

              <div className="p-3 bg-slate-50 border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between">
                <div>
                  <div className="text-xs font-black uppercase text-black">LUL</div>
                  <div className="text-[10px] font-bold text-slate-600">
                    Fishing and Warzone rewards
                  </div>
                </div>
                <div className="-skew-x-6 px-3 py-1 bg-[#fec83e] text-black border-2 border-black shadow-[2px_2px_0_#000] font-black text-sm">
                  <span className="skew-x-6 inline-block">{hud.gold} LUL</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between">
                <div>
                  <div className="text-xs font-black uppercase text-black">CYON</div>
                  <div className="text-[10px] font-bold text-slate-600">
                    Shop items and outfits
                  </div>
                </div>
                <div className="-skew-x-6 px-3 py-1 bg-[#38bdf8] text-black border-2 border-black shadow-[2px_2px_0_#000] font-black text-sm">
                  <span className="skew-x-6 inline-block">{cyonBalance} CYON</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between">
                <div>
                  <div className="text-xs font-black uppercase text-black">RESPITE</div>
                  <div className="text-[10px] font-bold text-slate-600">
                    House, companions, and Fish Market
                  </div>
                </div>
                <div className="-skew-x-6 px-3 py-1 bg-[#d8b4fe] text-black border-2 border-black shadow-[2px_2px_0_#000] font-black text-sm">
                  <span className="skew-x-6 inline-block">{respiteBalance} RESPITE</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between">
                <div>
                  <div className="text-xs font-black uppercase text-black">NEAR</div>
                  <div className="text-[10px] font-bold text-slate-600">
                    Wallet balance
                  </div>
                </div>
                <div className="-skew-x-6 px-3 py-1 bg-[#10b981] text-black border-2 border-black shadow-[2px_2px_0_#000] font-black text-sm">
                  <span className="skew-x-6 inline-block">{nearTestnetBalance.toFixed(2)} NEAR</span>
                </div>
              </div>
            </div>

            {/* P2P SEND RESPITE TO ANOTHER WALLET */}
            <div
              data-wallet-send-respite-card="true"
              className="p-3 bg-[#1e293b] text-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2"
            >
              <div className="text-[10.5px] font-black uppercase tracking-wider text-[#d8b4fe]">
                SEND RESPITE
              </div>
              <input
                type="text"
                value={respiteTransferRecipient}
                onChange={(e) => {
                  setRespiteTransferRecipient(e.target.value);
                  setRespiteTransferStatus(null);
                }}
                placeholder="Recipient username or wallet"
                className="w-full px-2.5 py-1.5 bg-white text-black font-mono font-bold text-xs border-2 border-black"
              />
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, respiteBalance)}
                  value={respiteTransferAmount}
                  onChange={(e) => {
                    setRespiteTransferAmount(e.target.value);
                    setRespiteTransferStatus(null);
                  }}
                  placeholder="Amount"
                  className="w-28 px-2.5 py-1.5 bg-white text-black font-black text-xs border-2 border-black"
                />
                <button
                  type="button"
                  onClick={async () => {
                    soundEngine.playUiClick();
                    const senderId = hud.nearWalletId || playerUid;
                    if (!senderId) {
                      setRespiteTransferStatus({
                        type: 'error',
                        text: 'Connect a wallet before sending RESPITE.',
                      });
                      return;
                    }
                    const rawTarget = respiteTransferRecipient.trim().toLowerCase();
                    if (!rawTarget) {
                      setRespiteTransferStatus({
                        type: 'error',
                        text: 'Enter a valid recipient wallet.',
                      });
                      return;
                    }
                    const targetWallet =
                      rawTarget.includes('.') ? rawTarget : `${rawTarget}.buddiesblitz.testnet`;
                    const amt = Math.floor(Number(respiteTransferAmount));
                    if (!Number.isFinite(amt) || amt <= 0) {
                      setRespiteTransferStatus({
                        type: 'error',
                        text: 'Enter a positive RESPITE amount.',
                      });
                      return;
                    }
                    if (respiteBalance < amt) {
                      setRespiteTransferStatus({
                        type: 'error',
                        text: `Not enough RESPITE (${respiteBalance} available).`,
                      });
                      return;
                    }
                    const res = await executeMarketContractCallOnChain({
                      signerAccountId: senderId,
                      methodName: 'ft_transfer',
                      args: {
                        receiver_id: targetWallet,
                        amount: String(amt),
                        memo: 'Buddies Blitz P2P RESPITE Transfer',
                      },
                    });
                    if (!res.ok || !res.txHash) {
                      setRespiteTransferStatus({
                        type: 'error',
                        text: res.error || 'Connect your wallet to send RESPITE.',
                      });
                      return;
                    }
                    const nextRespite = Math.max(0, respiteBalance - amt);
                    setRespiteBalance(nextRespite);
                    void creditRecipientRespiteInSupabase(targetWallet, amt);
                    void syncPlayerBalancesToSupabase({
                      nearAccountId: senderId,
                      lulBalance: hud.gold,
                      cyonBalance,
                      respiteBalance: nextRespite,
                    });
                    void logMarketTransactionToSupabase({
                      actorNearAccount: senderId,
                      actionType: 'SEND_RESPITE',
                      itemId: targetWallet,
                      currency: 'RESPITE',
                      amount: amt,
                      unitPrice: 1,
                      reasoningSummary: `Sent ${amt} RESPITE to ${targetWallet}`,
                      nearTxHash: res.txHash,
                    });
                    setRespiteTransferStatus({
                      type: 'success',
                      text: `Sent ${amt} RESPITE to ${targetWallet}`,
                      txHash: res.txHash,
                    });
                    setRespiteTransferRecipient('');
                  }}
                  className="flex-1 -skew-x-6 px-3 py-1.5 bg-[#d8b4fe] hover:bg-[#e9d5ff] text-black font-black text-[10px] uppercase border-2 border-black shadow-[2px_2px_0_#000] cursor-pointer"
                >
                  <span className="skew-x-6 inline-block">SEND</span>
                </button>
              </div>
              {respiteTransferStatus && (
                <div
                  className={`p-2 border text-[10px] font-bold ${
                    respiteTransferStatus.type === 'success'
                      ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200'
                      : 'bg-red-950/80 border-red-400 text-red-200'
                  }`}
                >
                  <div>{respiteTransferStatus.text}</div>
                  {respiteTransferStatus.txHash && (
                    <a
                      href={`https://testnet.nearblocks.io/txns/${respiteTransferStatus.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-[#b8ff3c] break-all"
                    >
                      Receipt
                    </a>
                  )}
                </div>
              )}
            </div>
              </>
            ) : personalWalletTab === 'assets' ? (
              <div data-wallet-assets-panel="true" className="space-y-3">
                <div className="p-3 bg-[#1e293b] text-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-[#38bdf8]">
                      MY ITEMS
                    </div>
                    <div className="text-xs font-bold text-slate-200 truncate">
                      {hud.nearWalletId || playerUid || 'Guest'}
                    </div>
                  </div>
                  <div className="px-2.5 py-1 bg-[#0f172a] border border-white/20 text-[10px] font-mono font-bold text-[#b8ff3c]">
                    {(hasHouseOwnership ? 1 : 0) + caughtFishBucket.filter((f) => f.isMintedNft).length + recruitedFamilyMembers.length} OWNED
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 1. HOUSE DEED CARD */}
                  {hasHouseOwnership && (
                    <div className="p-3 bg-white border-2 border-black shadow-[3px_3px_0_#000] space-y-2">
                      <div className="relative w-full h-28 bg-slate-900 border-2 border-black overflow-hidden flex items-center justify-center">
                        <img
                          src="/assets/kiosk/private_house_isometric.jpg"
                          alt="Private House"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <div className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-[#b8ff3c] text-black border border-black font-black text-[9px] uppercase">
                          HOUSE
                        </div>
                        <div className="absolute bottom-1.5 right-1.5 px-2 py-0.5 bg-black/80 text-[#38bdf8] font-mono text-[9px]">
                          DEED #001
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase text-black">
                          JAPANESE PAVILION HOUSE
                        </div>
                        <div className="text-[10px] font-bold text-slate-600">
                          Unlocks residential plots and interior customization.
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9.5px] font-mono border-t border-slate-200 pt-1.5">
                        <span className="text-emerald-600 font-bold">OWNED</span>
                        <span className="text-slate-500">{HOUSE_OWNERSHIP_PRICE_RESPITE} RESPITE</span>
                      </div>
                    </div>
                  )}

                  {/* 2. RECRUITED FAMILY MEMBERS */}
                  {recruitedFamilyMembers.map((m) => (
                    <div key={m.agentId} className="p-3 bg-white border-2 border-black shadow-[3px_3px_0_#000] space-y-2">
                      <div className="relative w-full h-28 bg-[#0f172a] border-2 border-black flex flex-col items-center justify-center text-center p-2">
                        <div className="text-xl font-black text-[#facc15] tracking-widest uppercase">
                          COMPANION
                        </div>
                        <div className="text-[10px] font-mono text-slate-300">
                          {m.contractAddress}
                        </div>
                        <div className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-[#facc15] text-black border border-black font-black text-[9px] uppercase">
                          COMPANION
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase text-black">
                          {m.name}
                        </div>
                        <div className="text-[10px] font-bold text-slate-600">
                          Order: {m.activeOrder.replace(/_/g, ' ').toUpperCase()} · {m.planLabel}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9.5px] font-mono border-t border-slate-200 pt-1.5">
                        <span className="text-emerald-600 font-bold">ACTIVE</span>
                        <span className="text-slate-500">{m.pricePaidRespite} RESPITE</span>
                      </div>
                    </div>
                  ))}

                  {/* 3. MINTED FISH NFTS (IN BAG + LISTED BY PLAYER) */}
                  {caughtFishBucket
                    .filter((f) => f.isMintedNft)
                    .map((fish) => {
                      const openWalletFish3d = () => {
                        setPreview3dFish({
                          speciesId: fish.speciesId,
                          speciesName: fish.speciesName,
                          rarity: fish.rarity,
                          weightKg: fish.weightKg,
                          lengthCm: fish.lengthCm,
                          waterZoneLabel: fish.waterZoneLabel,
                          colorHex: fish.colorHex,
                          isTrophy: fish.isTrophy,
                          isMintedNft: true,
                          nftTokenId: fish.nftTokenId,
                          valueLabel: `${fish.suggestedRespitePrice || 12} RESPITE`,
                          ownerOrSellerLabel: hud.nearWalletId
                            ? `Owner: ${hud.nearWalletId}`
                            : undefined,
                        });
                      };

                      return (
                        <div
                          key={fish.id}
                          data-wallet-fish-nft={fish.speciesId}
                          className="p-3 bg-white border-2 border-black shadow-[3px_3px_0_#000] space-y-2"
                        >
                          <div className="relative">
                            <Fish3dThumbnail
                              speciesId={fish.speciesId}
                              speciesName={fish.speciesName}
                              colorHex={fish.colorHex}
                              variant="card"
                              onInspect={openWalletFish3d}
                            />
                            <div className="absolute top-1.5 left-1.5 z-20 px-2 py-0.5 bg-[#38bdf8] text-black border border-black font-black text-[9px] uppercase pointer-events-none">
                              FISH NFT
                            </div>
                          </div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-black uppercase text-black truncate">
                                {fish.speciesName}
                              </div>
                              <div className="text-[10px] font-bold text-slate-600">
                                {fish.weightKg.toFixed(2)} kg · {fish.rarity}
                              </div>
                            </div>
                            <button
                              type="button"
                              data-wallet-fish-3d-btn={fish.id}
                              onClick={() => {
                                soundEngine.playUiClick();
                                openWalletFish3d();
                              }}
                              className="px-2 py-1 bg-[#0f172a] hover:bg-[#1e293b] text-[#38bdf8] border border-black text-[9px] font-black uppercase cursor-pointer shrink-0"
                            >
                              VIEW
                            </button>
                          </div>
                          <div className="flex items-center justify-between text-[9.5px] font-mono border-t border-slate-200 pt-1.5">
                            <span className="text-emerald-600 font-bold">OWNED</span>
                            <span className="text-slate-500">
                              {fish.suggestedRespitePrice || 12} RESPITE
                            </span>
                          </div>
                        </div>
                      );
                    })}

                  {fishMarketListings
                    .filter(
                      (l) =>
                        Boolean(hud.nearWalletId) &&
                        l.sellerNearAccount.toLowerCase() ===
                          (hud.nearWalletId || '').toLowerCase(),
                    )
                    .map((listing) => {
                      const openListedWalletFish3d = () => {
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
                          valueLabel: `Listed · ${listing.priceRespite} RESPITE`,
                          ownerOrSellerLabel: `Seller: ${listing.sellerNearAccount}`,
                        });
                      };

                      return (
                        <div
                          key={listing.listingId}
                          data-wallet-listed-fish-nft={listing.speciesId}
                          className="p-3 bg-white border-2 border-black shadow-[3px_3px_0_#000] space-y-2"
                        >
                          <div className="relative">
                            <Fish3dThumbnail
                              speciesId={listing.speciesId}
                              speciesName={listing.speciesName}
                              colorHex={listing.colorHex}
                              variant="card"
                              onInspect={openListedWalletFish3d}
                            />
                            <div className="absolute top-1.5 left-1.5 z-20 px-2 py-0.5 bg-[#facc15] text-black border border-black font-black text-[9px] uppercase pointer-events-none">
                              LISTED AT KAI
                            </div>
                          </div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-black uppercase text-black truncate">
                                {listing.speciesName}
                              </div>
                              <div className="text-[10px] font-bold text-slate-600">
                                {listing.weightKg.toFixed(2)} kg · {listing.rarity}
                              </div>
                            </div>
                            <button
                              type="button"
                              data-wallet-listed-fish-3d-btn={listing.listingId}
                              onClick={() => {
                                soundEngine.playUiClick();
                                openListedWalletFish3d();
                              }}
                              className="px-2 py-1 bg-[#0f172a] hover:bg-[#1e293b] text-[#38bdf8] border border-black text-[9px] font-black uppercase cursor-pointer shrink-0"
                            >
                              VIEW
                            </button>
                          </div>
                          <div className="flex items-center justify-between text-[9.5px] font-mono border-t border-slate-200 pt-1.5">
                            <span className="text-amber-600 font-bold">ON MARKET</span>
                            <span className="text-slate-500">{listing.priceRespite} RESPITE</span>
                          </div>
                        </div>
                      );
                    })}

                  {!hasHouseOwnership &&
                    recruitedFamilyMembers.length === 0 &&
                    caughtFishBucket.filter((f) => f.isMintedNft).length === 0 &&
                    fishMarketListings.filter(
                      (l) =>
                        Boolean(hud.nearWalletId) &&
                        l.sellerNearAccount.toLowerCase() ===
                          (hud.nearWalletId || '').toLowerCase(),
                    ).length === 0 && (
                      <div className="col-span-1 sm:col-span-2 py-8 px-4 text-center bg-slate-50 border-2 border-dashed border-slate-300 text-slate-500 text-xs font-bold space-y-1">
                        <div>NO ITEMS YET</div>
                        <div className="text-[10.5px] text-slate-400">
                          Buy a house, recruit a companion, or mint caught fish into NFTs.
                        </div>
                      </div>
                    )}
                </div>
              </div>
            ) : (
              <div data-wallet-history-panel="true" className="space-y-3">
                {/* HEADER & CURRENCY FILTER PILLS */}
                <div className="p-3 bg-[#1e293b] text-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-[#b8ff3c]">
                        HISTORY
                      </div>
                      <div className="text-xs font-bold text-slate-200 truncate">
                        {hud.nearWalletId || playerUid || connectedGoogleEmail || 'Guest'}
                      </div>
                    </div>
                    <button
                      type="button"
                      data-wallet-refresh-history-btn="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        void refreshWalletTransactions();
                      }}
                      className="-skew-x-6 px-2.5 py-1 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black font-black text-[9.5px] uppercase border-2 border-black shadow-[2px_2px_0_#000] cursor-pointer shrink-0"
                    >
                      <span className="skew-x-6 inline-block">
                        {isLoadingWalletTransactions ? 'LOADING...' : 'REFRESH'}
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-white/15">
                    {(['ALL', 'LUL', 'CYON', 'RESPITE'] as const).map((filterKey) => (
                      <button
                        key={filterKey}
                        type="button"
                        data-wallet-history-filter={filterKey.toLowerCase()}
                        onClick={() => {
                          soundEngine.playUiClick();
                          setWalletHistoryFilter(filterKey);
                        }}
                        className={`-skew-x-6 px-2.5 py-0.5 text-[10px] font-black uppercase border border-black cursor-pointer transition-colors ${
                          walletHistoryFilter === filterKey
                            ? 'bg-[#facc15] text-black'
                            : 'bg-[#0f172a] text-slate-300 hover:text-white'
                        }`}
                      >
                        <span className="skew-x-6 inline-block">{filterKey}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* TRANSACTION LIST */}
                {(() => {
                  const filteredTxs = walletTransactions.filter((tx) => {
                    if (walletHistoryFilter === 'ALL') return true;
                    if (walletHistoryFilter === 'LUL') {
                      return tx.currency === 'LUL' || tx.currency === 'GOLD';
                    }
                    return tx.currency === walletHistoryFilter;
                  });

                  if (isLoadingWalletTransactions && filteredTxs.length === 0) {
                    return (
                      <div className="p-4 bg-slate-50 border-2 border-black shadow-[3px_3px_0px_#000] text-center text-xs font-black uppercase text-slate-600">
                        Loading transaction history...
                      </div>
                    );
                  }

                  if (filteredTxs.length === 0) {
                    return (
                      <div
                        data-wallet-history-empty="true"
                        className="p-4 bg-slate-50 border-2 border-black shadow-[3px_3px_0px_#000] text-center space-y-1"
                      >
                        <div className="text-xs font-black uppercase text-black">
                          NO TRANSACTIONS YET
                        </div>
                        <div className="text-[11px] font-bold text-slate-600">
                          Currency exchanges, merchant purchases, fish NFT trades, and RESPITE transfers will appear here.
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      {filteredTxs.map((tx) => {
                        const badgeBg =
                          tx.currency === 'CYON'
                            ? 'bg-[#38bdf8]'
                            : tx.currency === 'RESPITE'
                              ? 'bg-[#d8b4fe]'
                              : 'bg-[#fec83e]';
                        const formattedDate = (() => {
                          try {
                            const d = new Date(tx.created_at);
                            return Number.isNaN(d.getTime())
                              ? tx.created_at
                              : d.toLocaleString([], {
                                  month: 'short',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                });
                          } catch {
                            return tx.created_at;
                          }
                        })();
                        return (
                          <div
                            key={tx.id}
                            data-wallet-tx-item="true"
                            className="p-3 bg-slate-50 border-2 border-black shadow-[3px_3px_0px_#000] space-y-1.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="px-1.5 py-0.5 bg-[#1e293b] text-[#b8ff3c] border border-black text-[9px] font-black uppercase tracking-wider">
                                    {tx.action_type.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-500">
                                    {formattedDate}
                                  </span>
                                </div>
                                <div className="text-xs font-black text-black break-words">
                                  {tx.reasoning_summary || tx.item_id || tx.action_type}
                                </div>
                              </div>

                              <div
                                className={`-skew-x-6 px-2.5 py-1 ${badgeBg} text-black border-2 border-black shadow-[2px_2px_0_#000] font-black text-xs shrink-0`}
                              >
                                <span className="skew-x-6 inline-block">
                                  {tx.amount} {tx.currency === 'GOLD' ? 'LUL' : tx.currency}
                                </span>
                              </div>
                            </div>

                            {tx.near_tx_hash && (
                              <div className="pt-1 border-t border-slate-200 flex items-center justify-between gap-2 text-[10px] font-mono">
                                <span className="text-slate-600 truncate">
                                  Tx: {tx.near_tx_hash}
                                </span>
                                <a
                                  href={`https://testnet.nearblocks.io/txns/${tx.near_tx_hash}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-black uppercase text-[#0284c7] hover:underline shrink-0"
                                >
                                  VIEW ON NEARBLOCKS ↗
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* =====================================================================
          9B-3. LEFT-SLIDE PERSONAL BAG / TAS MODAL (Opened When Clicking BAG)
         ===================================================================== */}
      <aside
        role="dialog"
        aria-modal="false"
        aria-hidden={!isPersonalBagModalOpen}
        aria-label="Personal Bag"
        data-personal-bag-modal="true"
        className={`fixed left-4 top-16 bottom-20 z-40 w-full max-w-md flex flex-col select-none transition-all duration-300 ease-out transform ${
          isPersonalBagModalOpen
            ? 'translate-x-0 opacity-100 pointer-events-auto'
            : '-translate-x-[120%] opacity-0 pointer-events-none'
        }`}
      >
        <div className="relative flex-1 flex flex-col bg-white border-[3.5px] border-black shadow-[4px_4px_0px_#000] p-4 sm:p-5 text-black overflow-hidden min-h-0">
          {/* Header & Tabs */}
          <div className="flex items-center justify-between gap-2 pb-3 border-b-[2.5px] border-black shrink-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                data-bag-tab="equipment"
                onClick={() => {
                  soundEngine.playUiClick();
                  setPersonalBagTab('equipment');
                }}
                className={`-skew-x-6 px-3 py-1 border-2 border-black shadow-[2px_2px_0px_#000] text-[11px] font-black uppercase flex items-center gap-1.5 cursor-pointer transition-colors ${
                  personalBagTab === 'equipment'
                    ? 'bg-[#b8ff3c] text-black'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <div className="skew-x-6 flex items-center gap-1">
                  <Backpack className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                  <span>GEAR</span>
                </div>
              </button>

              <button
                type="button"
                data-bag-tab="fish"
                onClick={() => {
                  soundEngine.playUiClick();
                  setPersonalBagTab('fish');
                }}
                className={`-skew-x-6 px-3 py-1 border-2 border-black shadow-[2px_2px_0px_#000] text-[11px] font-black uppercase flex items-center gap-1.5 cursor-pointer transition-colors ${
                  personalBagTab === 'fish'
                    ? 'bg-[#38bdf8] text-black'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <div className="skew-x-6 flex items-center gap-1">
                  <span>FISH ({caughtFishBucket.length}/20)</span>
                </div>
              </button>

              <button
                type="button"
                data-bag-tab="items"
                onClick={() => {
                  soundEngine.playUiClick();
                  setPersonalBagTab('items');
                }}
                className={`-skew-x-6 px-3 py-1 border-2 border-black shadow-[2px_2px_0px_#000] text-[11px] font-black uppercase flex items-center gap-1.5 cursor-pointer transition-colors ${
                  personalBagTab === 'items'
                    ? 'bg-[#facc15] text-black'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <div className="skew-x-6 flex items-center gap-1">
                  <span>ITEMS ({ownedMerchantItemIds.length})</span>
                </div>
              </button>
            </div>

            <button
              type="button"
              data-close-personal-bag-btn="true"
              onClick={() => {
                soundEngine.playUiClick();
                setIsPersonalBagModalOpen(false);
              }}
              className="-skew-x-6 w-8 h-8 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black shadow-[3px_3px_0px_#000] font-black text-xs flex items-center justify-center cursor-pointer active:scale-95 shrink-0"
              aria-label="Close Personal Bag"
            >
              <span className="skew-x-6 inline-block">X</span>
            </button>
          </div>

          {/* Bag Body */}
          <div className="mt-3 flex-1 overflow-y-auto pr-1 space-y-3 min-h-0">
            {personalBagTab === 'equipment' && (() => {
              const isJoranEquipped = hud.equippedWeapon === 'Joran Fishing';
              const ownedFishingGear = MERCHANT_CATALOG_ITEMS.filter(
                (item) => item.category === 'fishing_gear' && ownedMerchantItemIds.includes(item.id),
              );
              return (
                <div className="space-y-3">
                  {/* Personal Fishing Rod Card */}
                  <div
                    data-bag-item-card="fishing_rod"
                    className={`p-3.5 border-[2.5px] border-black shadow-[3px_3px_0px_#000] transition-colors ${
                      isJoranEquipped ? 'bg-[#ecfccb]' : 'bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 bg-[#1e293b] text-[#38bdf8] border-2 border-black shadow-[2px_2px_0_#000] flex items-center justify-center font-black text-xs tracking-wider shrink-0">
                          ROD
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-black uppercase tracking-wide text-black">
                              FISHING ROD
                            </span>
                            <span
                              className={`px-1.5 py-0.5 text-[9.5px] font-black uppercase border border-black ${
                                isJoranEquipped
                                  ? 'bg-[#b8ff3c] text-black'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {isJoranEquipped ? 'EQUIPPED' : 'IN BAG'}
                            </span>
                          </div>
                          <p className="text-[11px] font-bold text-slate-600 mt-0.5">
                            Carbon spin rod. Use along the beach or lake shore.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-black/15 flex items-center justify-between gap-2">
                      <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-600">
                        {isJoranEquipped ? 'Equipped' : 'Stored in Bag'}
                      </span>

                      <button
                        type="button"
                        data-bag-toggle-fishing-rod="true"
                        onClick={() => {
                          soundEngine.playUiClick();
                          if (isJoranEquipped) {
                            setIsChargingCast(false);
                            setIsHoldingReel(false);
                            setFishingMinigame(null);
                            setFishingHintMessage(null);
                            setFishingPhase('idle');
                            dispatchBuddyAction('qcEquipWeapon:unarmed');
                          } else {
                            dispatchBuddyAction('qcEquipWeapon:fishing_rod');
                          }
                        }}
                        className={`-skew-x-6 px-4 py-1.5 border-2 border-black shadow-[3px_3px_0px_#000] font-black text-xs uppercase tracking-wider cursor-pointer active:scale-95 transition-all ${
                          isJoranEquipped
                            ? 'bg-[#ff3b30] hover:bg-[#ff554a] text-white'
                            : 'bg-[#b8ff3c] hover:bg-[#d9f99d] text-black'
                        }`}
                      >
                        <span className="skew-x-6 inline-block">
                          {isJoranEquipped ? 'UNEQUIP' : 'EQUIP'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Owned Fishing Gear & Tackle Purchased from Merchant Kai */}
                  {ownedFishingGear.map((gear) => (
                    <div
                      key={gear.id}
                      data-bag-item-card={gear.id}
                      className="p-3 bg-slate-50 border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 bg-[#0f172a] text-[#b8ff3c] border-2 border-black flex items-center justify-center font-black text-[10px] shrink-0">
                          GEAR
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black uppercase text-black">
                              {gear.name}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 text-[9px] font-black uppercase border border-black ${
                                gear.isNft ? 'bg-[#d8b4fe] text-black' : 'bg-[#38bdf8] text-black'
                              }`}
                            >
                              {gear.isNft ? 'NFT' : 'TACKLE'}
                            </span>
                          </div>
                          <div className="text-[10.5px] font-bold text-slate-600 mt-0.5 truncate">
                            {gear.description}
                          </div>
                        </div>
                      </div>

                      {gear.isEquippableRod && (
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playUiClick();
                            if (isJoranEquipped) {
                              setIsChargingCast(false);
                              setIsHoldingReel(false);
                              setFishingMinigame(null);
                              setFishingHintMessage(null);
                              setFishingPhase('idle');
                              dispatchBuddyAction('qcEquipWeapon:unarmed');
                            } else {
                              dispatchBuddyAction('qcEquipWeapon:fishing_rod');
                            }
                          }}
                          className={`-skew-x-6 px-3 py-1 border-2 border-black shadow-[2px_2px_0px_#000] font-black text-[10px] uppercase cursor-pointer shrink-0 ${
                            isJoranEquipped
                              ? 'bg-[#ff3b30] text-white'
                              : 'bg-[#b8ff3c] text-black'
                          }`}
                        >
                          <span className="skew-x-6 inline-block">
                            {isJoranEquipped ? 'UNEQUIP' : 'EQUIP'}
                          </span>
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Quick Summary of Bag Capacity */}
                  <div className="p-3 bg-[#1e293b] text-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-[#b8ff3c]">
                        FISH BUCKET
                      </div>
                      <div className="text-xs font-bold text-slate-200 mt-0.5">
                        {caughtFishBucket.length} / 20 Fish Stored
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setPersonalBagTab('fish');
                      }}
                      className="-skew-x-6 px-2.5 py-1 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black font-black text-[10px] uppercase border-2 border-black shadow-[2px_2px_0_#000] cursor-pointer"
                    >
                      <span className="skew-x-6 inline-block">VIEW FISH</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {personalBagTab === 'fish' && (
              <div className="space-y-2">
                {caughtFishBucket.length === 0 ? (
                  <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-300 text-center space-y-1.5">
                    <div className="text-xs font-black uppercase text-slate-600">
                      NO FISH IN BAG YET
                    </div>
                    <p className="text-[11px] font-bold text-slate-500">
                      Equip your Fishing Rod in the GEAR tab and cast your line at the beach or lake.
                    </p>
                  </div>
                ) : (
                  caughtFishBucket.map((fish) => {
                    const openBagFish3d = () => {
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
                          ? `${fish.suggestedRespitePrice || 12} RESPITE`
                          : `${fish.sellValueLul || fish.sellValueCyon || 15} LUL`,
                        ownerOrSellerLabel: fish.caughtByAccount
                          ? `Angler: ${fish.caughtByAccount}`
                          : undefined,
                      });
                    };

                    return (
                      <div
                        key={fish.id}
                        data-bag-fish-row={fish.speciesId}
                        className="p-2.5 bg-slate-50 border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between gap-2.5"
                      >
                        <Fish3dThumbnail
                          speciesId={fish.speciesId}
                          speciesName={fish.speciesName}
                          colorHex={fish.colorHex}
                          variant="compact"
                          onInspect={openBagFish3d}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black uppercase text-black">
                              {fish.speciesName}
                            </span>
                            <span className="px-1.5 py-0.5 bg-[#1e293b] text-[#38bdf8] text-[9.5px] font-black uppercase">
                              {fish.rarity}
                            </span>
                            {fish.isMintedNft && (
                              <span className="px-1.5 py-0.5 bg-[#d8b4fe] text-[#1e1b4b] border border-black text-[9px] font-black uppercase">
                                NFT
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] font-bold text-slate-600 mt-0.5">
                            {fish.weightKg.toFixed(2)} kg ·{' '}
                            {fish.sellValueLul || fish.sellValueCyon || 15} LUL at Kai&apos;s Shop
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          <button
                            type="button"
                            data-bag-fish-3d-btn={fish.id}
                            onClick={() => {
                              soundEngine.playUiClick();
                              openBagFish3d();
                            }}
                            className="px-2 py-1 bg-[#0f172a] hover:bg-[#1e293b] text-[#38bdf8] font-mono text-[10px] font-black uppercase border border-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer"
                          >
                            VIEW
                          </button>

                          {!fish.isMintedNft ? (
                            hud.nearWalletConnected ? (
                              <button
                                type="button"
                                data-bag-mint-fish-btn={fish.id}
                                onClick={() => {
                                  void handleMintCaughtFishNft(fish);
                                }}
                                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-mono text-[10px] font-black uppercase border border-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer"
                              >
                                Mint NFT
                              </button>
                            ) : (
                              <button
                                type="button"
                                data-bag-guest-register-btn={fish.id}
                                onClick={() => {
                                  soundEngine.playUiClick();
                                  setIsPersonalBagModalOpen(false);
                                  setOnboardingStep('auth_choice');
                                }}
                                className="px-2 py-1 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black font-mono text-[10px] font-black uppercase border border-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer"
                              >
                                Sign In
                              </button>
                            )
                          ) : (
                            <span className="text-[9.5px] font-black text-purple-700 bg-purple-100 px-2 py-0.5 border border-purple-400 font-mono">
                              MINTED
                            </span>
                          )}

                          {!fish.isMintedNft && (
                            <button
                              type="button"
                              data-bag-release-fish-btn={fish.id}
                              onClick={() => {
                                soundEngine.playUiClick();
                                setCaughtFishBucket((prev) =>
                                  prev.filter((f) => f.id !== fish.id),
                                );
                                setLastCaughtFishToast((prev) =>
                                  prev?.id === fish.id ? null : prev,
                                );
                              }}
                              className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-900 font-mono text-[10px] font-black uppercase border border-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer"
                            >
                              Release
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {personalBagTab === 'items' && (() => {
              const ownedPersonalItems = MERCHANT_CATALOG_ITEMS.filter((item) =>
                ownedMerchantItemIds.includes(item.id),
              );
              return (
                <div className="space-y-2">
                  {ownedPersonalItems.length === 0 ? (
                    <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-300 text-center space-y-1.5">
                      <div className="text-xs font-black uppercase text-slate-600">
                        NO COLLECTIBLE ITEMS YET
                      </div>
                      <p className="text-[11px] font-bold text-slate-500">
                        Purchase furniture &amp; personal items from Merchant Hana (Plaza) or Kai (Beachfront).
                      </p>
                    </div>
                  ) : (
                    ownedPersonalItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 bg-slate-50 border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black uppercase text-black">
                              {item.name}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 text-[9px] font-black uppercase border border-black ${
                                item.isNft
                                  ? 'bg-[#d8b4fe] text-[#1e1b4b]'
                                  : 'bg-[#38bdf8] text-black'
                              }`}
                            >
                              {item.isNft ? 'NFT' : 'ITEM'}
                            </span>
                          </div>
                          <div className="text-[10.5px] font-bold text-slate-600 mt-0.5 truncate">
                            {item.description}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </aside>

      {/* =====================================================================
          9C. TWO-STAGE CHARACTER TARGET & ACTION HUD (Bottom-Center)
              Click 1 (3D Character) = Black Name Bar Only
              Click 2 (Black Name Bar) =
                - If Self (YOU): 2 Buttons (WALLET, PROFILE)
                - If Other Player / NPC: 3 Buttons (TALK, PROFILE, WHISPER)
         ===================================================================== */}
      {selectedTargetUser &&
        !selectedTargetUser.isSelf &&
        String(selectedTargetUser.id) !== '0' &&
        !isProfileModalOpen &&
        !isSocialChatModalOpen &&
        !isKioskModalOpen &&
        !isPersonalWalletModalOpen &&
        !isPersonalBagModalOpen &&
        !isNearWalletSelectorOpen &&
        activeSpecialModal === 'none' &&
        activeTeleportKioskModal === 'none' &&
        fishingPhase === 'idle' &&
        !nearbyWaterZone.canFish && (
        <aside
          aria-label={`Target: ${selectedTargetUser.name}`}
          className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1.5 pointer-events-auto select-none"
        >
          {/* Top Section: Quick Action Buttons (Only Shown When Bar is Expanded) */}
          {isTargetMenuExpanded && (() => {
            const isSelfTarget =
              Boolean(selectedTargetUser.isSelf) ||
              String(selectedTargetUser.id) === '0' ||
              (!selectedTargetUser.isNpc &&
                Boolean(playerDisplayName.trim()) &&
                selectedTargetUser.name.trim().toUpperCase() ===
                  playerDisplayName.trim().toUpperCase()) ||
              selectedTargetUser.name.toUpperCase().includes('KAMU') ||
              selectedTargetUser.name.toUpperCase().includes('YOU');

            if (isSelfTarget) {
              return (
                <div className="flex flex-col gap-1.5 mb-1">
                  <button
                    type="button"
                    data-self-profile-btn="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setIsTargetMenuExpanded(false);
                      setProfileTargetUser({
                        ...selectedTargetUser,
                        id: 0,
                        isSelf: true,
                      });
                      setIsProfileModalOpen(true);
                    }}
                    className="-skew-x-6 w-40 py-1.5 px-3 bg-[#38bdf8] hover:bg-[#7dd3fc] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-black font-black uppercase text-xs tracking-wider cursor-pointer"
                  >
                    <div className="skew-x-6 flex items-center justify-center gap-2 w-full">
                      <User className="w-3.5 h-3.5 text-black stroke-[2.5] shrink-0" aria-hidden="true" />
                      <span>Profile</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    data-self-wallet-btn="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setIsTargetMenuExpanded(false);
                      setIsKioskModalOpen(false);
                      setIsSocialChatModalOpen(false);
                      setActiveSpecialModal('none');
                      setActiveTeleportKioskModal('none');
                      window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
                      window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
                      setIsPersonalWalletModalOpen(true);
                    }}
                    className="-skew-x-6 w-40 py-1.5 px-3 bg-[#facc15] hover:bg-[#fde047] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-black font-black uppercase text-xs tracking-wider cursor-pointer"
                  >
                    <div className="skew-x-6 flex items-center justify-center gap-2 w-full">
                      <Wallet className="w-3.5 h-3.5 text-black stroke-[2.5] shrink-0" aria-hidden="true" />
                      <span>Wallet</span>
                    </div>
                  </button>
                </div>
              );
            }

            return (
              <div className="flex flex-col gap-1.5 mb-1">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setIsTargetMenuExpanded(false);
                    if (selectedTargetUser.isNpc) {
                      setIsKioskModalOpen(false);
                      setIsSocialChatModalOpen(false);
                      setIsPersonalWalletModalOpen(false);
                      setActiveTeleportKioskModal('none');
                      window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
                      window.dispatchEvent(
                        new CustomEvent('open-npc-merchant-ui', {
                          detail: {
                            location:
                              selectedTargetUser.id === 'npc_beach' || selectedTargetUser.id === 'npc_kai'
                                ? 'beach_house'
                                : 'lobby_cafe',
                          },
                        }),
                      );
                    } else {
                      window.dispatchEvent(
                        new CustomEvent('buddy-action', {
                          detail: `socialTalk:Hello ${selectedTargetUser.name}!`,
                        }),
                      );
                    }
                  }}
                  className="-skew-x-6 w-40 py-1.5 px-3 bg-[#facc15] hover:bg-[#fde047] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-black font-black uppercase text-xs tracking-wider cursor-pointer"
                >
                  <div className="skew-x-6 flex items-center justify-center gap-2 w-full">
                    <MessageSquare className="w-3.5 h-3.5 text-black stroke-[2.5] shrink-0" aria-hidden="true" />
                    <span>Talk</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setIsTargetMenuExpanded(false);
                    setIsKioskModalOpen(false);
                    setIsSocialChatModalOpen(false);
                    setIsPersonalWalletModalOpen(false);
                    setActiveSpecialModal('none');
                    setActiveTeleportKioskModal('none');
                    window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
                    setProfileTargetUser(selectedTargetUser);
                    setIsProfileModalOpen(true);
                  }}
                  className="-skew-x-6 w-40 py-1.5 px-3 bg-[#38bdf8] hover:bg-[#7dd3fc] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-black font-black uppercase text-xs tracking-wider cursor-pointer"
                >
                  <div className="skew-x-6 flex items-center justify-center gap-2 w-full">
                    <User className="w-3.5 h-3.5 text-black stroke-[2.5] shrink-0" aria-hidden="true" />
                    <span>Profile</span>
                  </div>
                </button>

                {!selectedTargetUser.isNpc && (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setIsTargetMenuExpanded(false);
                      setIsKioskModalOpen(false);
                      setIsProfileModalOpen(false);
                      setIsPersonalWalletModalOpen(false);
                      setActiveSpecialModal('none');
                      setActiveTeleportKioskModal('none');
                      window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
                      setSelectedPrivateUser(selectedTargetUser);
                      setIsSocialChatModalOpen(true);
                    }}
                    className="-skew-x-6 w-40 py-1.5 px-3 bg-[#10b981] hover:bg-[#34d399] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-black font-black uppercase text-xs tracking-wider cursor-pointer"
                  >
                    <div className="skew-x-6 flex items-center justify-center gap-2 w-full">
                      <MessageCircle className="w-3.5 h-3.5 text-black stroke-[2.5] shrink-0" aria-hidden="true" />
                      <span>Whisper</span>
                    </div>
                  </button>
                )}
              </div>
            );
          })()}

          {/* Unified Rounded Pill Bar (Aligned at bottom-3 level with chat input) */}
          <div
            role="button"
            tabIndex={0}
            data-target-name-bar="true"
            onClick={() => {
              soundEngine.playUiClick();
              setIsTargetMenuExpanded((prev) => !prev);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                soundEngine.playUiClick();
                setIsTargetMenuExpanded((prev) => !prev);
              }
            }}
            style={{
              background: 'rgba(38, 32, 28, 0.88)',
              backdropFilter: 'blur(8px)',
              border: '1.5px solid rgba(255, 255, 255, 0.75)',
              boxShadow: '0 6px 18px rgba(0, 0, 0, 0.45)',
            }}
            className="inline-flex items-center h-[42px] min-w-[210px] rounded-full px-1.5 text-white cursor-pointer hover:brightness-110 transition-all select-none"
          >
            {/* Avatar Icon */}
            <div className="w-[34px] h-[34px] rounded-full bg-white/14 border-[1.5px] border-white/85 flex items-center justify-center overflow-hidden shrink-0 text-xs font-black text-white">
              {selectedTargetUser.name.toLowerCase().includes('hana') ||
              selectedTargetUser.name.toLowerCase().includes('nadia') ? (
                <img src="/assets/avatar_nadia.jpg" alt={selectedTargetUser.name} className="w-full h-full object-cover" />
              ) : selectedTargetUser.isNpc ? (
                <img src="/assets/avatar_hiro.jpg" alt={selectedTargetUser.name} className="w-full h-full object-cover" />
              ) : (
                <span>{selectedTargetUser.name.slice(0, 1).toUpperCase()}</span>
              )}
            </div>

            {/* Target Name */}
            <span className="flex-1 text-center font-mono font-bold text-[15px] text-white tracking-wide px-3 uppercase truncate">
              {selectedTargetUser.name.replace(/\s*\((ANDA|YOU)\)/i, '')}
            </span>

            {/* Cycle Target Chevron Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                soundEngine.playUiClick();
                const list =
                  hud.nearbyRadiusUsers && hud.nearbyRadiusUsers.length > 0
                    ? hud.nearbyRadiusUsers
                    : [selectedTargetUser];
                const currentIdx = list.findIndex(
                  (u) => String(u.id) === String(selectedTargetUser.id),
                );
                const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % list.length : 0;
                const nextUser = list[nextIdx];
                if (nextUser) {
                  setSelectedTargetUser(nextUser);
                  setIsTargetMenuExpanded(false);
                  window.dispatchEvent(
                    new CustomEvent('select-character-by-id', {
                      detail: { id: nextUser.id },
                    }),
                  );
                }
              }}
              title="Switch Target"
              aria-label="Next Target"
              className="w-6 h-6 flex items-center justify-center text-white/90 hover:text-white font-black text-base shrink-0"
            >
              &gt;
            </button>
          </div>
        </aside>
      )}

      {/* =====================================================================
          10. AVAKIN-STYLE MMORPG CHARACTER PROFILE MODAL
         ===================================================================== */}
      <CharacterProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => {
          setIsProfileModalOpen(false);
          setProfileTargetUser(null);
          window.dispatchEvent(new CustomEvent('clear-character-selection'));
        }}
        targetUser={profileTargetUser}
        playerUid={hud.nearWalletId || playerUid}
        connectedAccountEmail={connectedGoogleEmail}
        characterGender={characterGender}
        playerTeam={hud.playerTeam ?? 'blue'}
        claimedPlotIndex={hud.nearClaimedPlotIndex}
        hasHouseOwnership={hasHouseOwnership}
        caughtFishCount={caughtFishBucket.length}
        mintedFishNftCount={caughtFishBucket.filter((f) => f.isMintedNft).length}
        recruitedFamilyCount={recruitedFamilyMembers.length}
        activeHarvesterCount={
          hud.nearActiveHarvesterSubAccounts?.length ||
          (hud.harvesterContractStage === 'CONTRACT_ACTIVE' ? 2 : 0)
        }
        onChangePlayerName={handleUpdatePlayerUsername}
        onStartWhisper={(user) => {
          if (user.isNpc) return;
          setIsProfileModalOpen(false);
          setSelectedPrivateUser(user);
          setIsSocialChatModalOpen(true);
        }}
      />

      {/* =====================================================================
          11. DESKTOP, MOBILE & TABLET ADAPTIVE CONTROLS:
              - Portrait Mode "Please Rotate Your Screen" English Overlay
              - Bottom-Left 360° Virtual Touch Movement Joystick for Mobile/Tablet
              - Bottom-Right Touch Action Buttons (Jump & Contextual Interact)
         ===================================================================== */}
      <MobileResponsiveControls
        isGameplayActive={
          isPreloadComplete &&
          gameState === 'playing' &&
          !isFullMapOverview &&
          onboardingStep === 'completed' &&
          playMode !== 'editor'
        }
        isModalBlocking={
          isKioskModalOpen ||
          isProfileModalOpen ||
          isPersonalWalletModalOpen ||
          isPersonalBagModalOpen ||
          isNearWalletSelectorOpen ||
          activeSpecialModal !== 'none' ||
          activeTeleportKioskModal !== 'none'
        }
        onTriggerBuddyAction={dispatchBuddyAction}
        primaryContextualAction={
          hud.floatingPrompts.length > 0
            ? {
                label: hud.floatingPrompts[0].actionLabel,
                actionEvent: hud.floatingPrompts[0].actionEvent,
              }
            : null
        }
      />

      {/* =====================================================================
          12. NEAR WALLET SELECTOR MODAL (@near-wallet-selector/modal-ui Adaptation)
         ===================================================================== */}
      <NearWalletSelectorModal
        isOpen={isNearWalletSelectorOpen}
        onClose={() => setIsNearWalletSelectorOpen(false)}
        currentWalletId={hud.nearWalletId || playerUid || null}
        onConnectAccount={(accountId, mode) => {
          void handleConnectWalletAndEnterLobby(accountId, { onboardingMode: mode });
        }}
        onDisconnectAccount={() => {
          setNearTestnetBalance(0);
          setRespiteBalance(0);
          setHasHouseOwnership(false);
          setPlayerUid('');
          setHud((prev) => ({
            ...prev,
            nearWalletConnected: false,
            nearWalletId: '',
            nearHasGamepassNft: false,
            nearGamepassTokenId: null,
          }));
          dispatchBuddyAction('nearDisconnectSession');
          if (typeof window !== 'undefined') {
            try {
              window.localStorage.removeItem('bb_last_connected_wallet_id_v2');
            } catch {
              // ignore
            }
          }
        }}
        onSelectGoogleAutoRegister={() => {
          setIsNearWalletSelectorOpen(false);
          void handleStartGoogleLoginAndOpenWalletNaming();
        }}
      />

      {/* =====================================================================
          13. PRIVATE HOUSE ENTRY MODAL
         ===================================================================== */}
      {houseEntryScanState !== 'idle' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Private House Entry"
          data-house-entry-scan-modal="true"
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs pointer-events-auto select-none"
        >
          <div className="relative w-full max-w-sm bg-[#0f172a] border-[3.5px] border-black shadow-[8px_8px_0px_#000] p-5 text-white space-y-3">
            <div className="flex items-center justify-between border-b border-white/20 pb-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                PRIVATE HOUSE
              </span>
              <span
                className={`px-2 py-0.5 text-[10px] font-black uppercase border border-black ${
                  houseEntryScanState === 'verified'
                    ? 'bg-[#b8ff3c] text-black'
                    : 'bg-[#facc15] text-black'
                }`}
              >
                {houseEntryScanState === 'verified' ? 'UNLOCKED' : 'CHECKING...'}
              </span>
            </div>

            {houseEntryScanState === 'scanning' ? (
              <div className="p-3 bg-[#1e293b] border border-[#00f0ff]/50 text-center space-y-2">
                <div className="text-xs font-black uppercase text-[#00f0ff] tracking-wider animate-pulse">
                  Checking house access...
                </div>
                <div className="w-full h-1.5 bg-black/50 overflow-hidden">
                  <div
                    className="h-full bg-[#00f0ff] animate-[pulse_1s_infinite]"
                    style={{ width: '85%' }}
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[#14532d]/50 border border-[#b8ff3c] text-center space-y-1">
                <div className="text-xs font-black uppercase text-[#b8ff3c] tracking-wider">
                  Welcome Home
                </div>
                <div className="text-[10.5px] font-bold text-slate-200">
                  Opening Interior...
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 14. 3D FISH PREVIEW MODAL (WALLET + BAG) */}
      <Fish3dPreviewModal fish={preview3dFish} onClose={() => setPreview3dFish(null)} />
    </main>
  );
}
