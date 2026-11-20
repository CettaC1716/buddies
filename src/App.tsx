import { useState, useEffect, useCallback, useRef } from 'react';
import { useSafePrivy, useSafePrivyLogin } from './lib/privyAuthBridge';
import {
  User,
  ChevronLeft,
  ChevronRight,
  Wallet,
  History,
  ArrowLeft,
  Backpack,
  Wrench,
  Package,
  Play,
  LogIn,
  X,
  ClipboardList,
  Shirt,
  Navigation,
} from 'lucide-react';
import {
  CITY_MINIMAP_POIS,
  type ClickToWalkHudSummary,
} from './game/buddiesClickToWalkRules';
import {
  BuddiesBlitzArena,
  GameState,
  PlayMode,
  HudSnapshot,
} from './game/BuddiesBlitzArena';
import {
  CITY_LIGHTS_SCALE_BOUNDS,
  LightingPresetKey,
  TIME_PHASE_DEFAULT_HOURS,
  type RainIntensityTier,
  type WeatherConditionKey,
  evaluateCommandCenterRadarSpec,
  worldCoordToRadarPercent,
  COMMANDER_PLOT_OFFSETS_X,
  CITY_TRANSIT_DESTINATIONS,
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
  isIntactModelEstateBasePlot,
  resolveOnboardingAccountEntry,
  resolveBottomChatSubmitTarget,
  type HouseArchitectureStyle,
  parseOptionalHouseArchitectureStyle,
  resolveOwnedHouseStyle,
  CITY_VIEW_DISTRICTS,
  getAdjacentCityViewDistrictId,
  getCityViewTargetHash,
  parseCityViewHash,
  type CityViewDistrictId,
  type CityViewTargetId,
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
import { CitizenDialogueModal } from './components/CitizenDialogueModal';
import {
  type CitizenFriendshipStore,
  type CitizenId,
  type CitizenProfile,
  getCitizenProfile,
  loadCitizenFriendshipStore,
  recordCitizenDailyGift,
  recordCitizenDailyTalk,
  resolveCanonicalCitizenId,
  saveCitizenFriendshipStore,
} from './game/buddiesCitizenRoles';
import {
  SocialChatModal,
  NearbyEntityUser,
  ChatMessage,
  isOwnChatMessage,
  shouldTriggerIncomingPrivateChatNotification,
  simplifyDisplayName,
} from './components/SocialChatModal';
import {
  SOCIAL_EMOTE_QUICK_LIST,
  mergeRealtimeSocialChatMessage,
  parseSocialEmoteCommand,
  resolveBubbleStyle,
  sanitizeHexColor,
} from './game/buddiesRemotePresenceSync';
import { CharacterProfileModal } from './components/CharacterProfileModal';
import { MobileResponsiveControls } from './components/MobileResponsiveControls';
import { NearWalletSelectorModal } from './components/NearWalletSelectorModal';
import { InGameWalletConfirmModal } from './components/InGameWalletConfirmModal';
import {
  NpcMerchantAndHouseModal,
  HouseInteriorPlacementState,
} from './components/NpcMerchantAndHouseModal';
import { ShorelineFishingHudAndShowcase } from './components/ShorelineCatchShowcaseModal';
import {
  Fish3dPreviewModal,
  Fish3dThumbnail,
  type Fish3dPreviewSpec,
} from './components/Fish3dPreviewModal';
import { Furniture3dThumbnail } from './components/Furniture3dThumbnail';
import {
  createInitialMerchantMarketState,
  executeLulToCyonExchange,
  executeLulToCyonExchangePackets,
  evaluateLulToCyonExchangeQuote,
  evaluateMerchantItemQuote,
  formatHouseDeedBadgeLabel,
  formatWalletHistoryActionLabel,
  formatWalletHistoryAmountDisplay,
  getHouseStyleDisplaySpec,
  mergeOwnedCatalogWithChainNep245,
  evaluateNegotiationEnvelope,
  createNpcTreasuryLedger,
  rollNpcTreasuryDay,
  evaluateNpcPurchase,
  recordNpcPurchase,
  getNpcMemoryFinalOffer,
  quickDealBonusLul,
  NPC_TREASURY_RULES,
  type NpcTreasuryLedger,
  type NpcPurchaseRefusal,
  countOwnedMerchantItems,
  investInMerchantShop,
  MerchantLocationId,
  MerchantCatalogItem,
  HouseInteriorSlotId,
  MERCHANT_CATALOG_ITEMS,
} from './game/buddiesMerchantPricing';
import {
  CAFE_ITEM_CONSUME_DURATION_MS,
  advanceCafeConsumerState,
  applyPlayerXpGain,
  computeLevelProgress,
  createInitialCafeConsumerState,
  createInitialCafeWorkShiftState,
  getCafeConsumerRemainingSummary,
  joinCafeWorkShiftQueue,
  leaveCafeWorkShiftQueue,
  purchaseCafeMenuItem,
  purchaseCafeOrderBatch,
  serveActiveCafeOrder,
  stepOtherActiveCafeWorkerServe,
  toggleSimulatedOtherCafeWorker,
  type CafeBatchOrderEntry,
  type CafeConsumerQueueState,
  type CafeMenuItemSpec,
  type CafeWorkShiftState,
} from './game/buddiesCafeRules';
import { CafeMenuItemArtwork } from './components/GlasshouseCafeMenuArtwork';
import {
  CafeOrderNotificationBellButton,
  CafeOrderSlideBanner,
  CafeWorkShiftBottomDock,
  GlasshouseCafeAtmModal,
  GlasshouseCafeOrderModal,
  GlasshouseCafeOrderNotificationModal,
  GlasshouseCafePrepModal,
  GlasshouseCafeRotaModal,
  XpGainCelebrationBanner,
  type UnifiedBottomDockActionMode,
} from './components/GlasshouseCafeModal';
import { GlasshouseCafeSlotModal } from './components/GlasshouseCafeSlotModal';
import type { ArcadeSlotEvaluation } from './game/buddiesArcadeSlots';
import { DailyMissionsModal } from './components/DailyMissionsModal';
import {
  claimDailyAllClearBonus,
  claimDailyMissionReward,
  createInitialDailyMissionsState,
  DAILY_MISSIONS_CATALOG,
  getDailyMissionsStorageKey,
  getLocalDailyDateKey,
  recordDailyMissionProgress,
  sanitizeDailyMissionsState,
  summarizeDailyMissions,
  type DailyMissionId,
  type DailyMissionsState,
} from './game/buddiesDailyMissions';
import {
  FAMILY_MEMBER_CONTRACT_PLANS,
  FAMILY_MEMBER_ORDER_SPECS,
  HOUSE_OWNERSHIP_PRICE_RESPITE,
  NEAR_CONFIG,
  checkCitizenSubAccountAvailability,
  claimHanaWelcomeNearOnChain,
  claimHanaWelcomeNearAttestedOnChain,
  fetchHanaClaimAttestation,
  disconnectNearWallet,
  executeMarketContractCallOnChain,
  executeNearTestnetAndRespiteSwap,
  fetchBuddiesMarketEstate,
  fetchBuddiesMarketFishListings,
  fetchBuddiesMarketPropertyListings,
  fetchHanaTreasuryStatus,
  fetchNearAccountView,
  fetchNearNetworkStatus,
  fetchNep141Balance,
  fetchNftSubAccountLedgerFromChain,
  fetchOwnedFishNftsFromChain,
  fetchOwnedNep245CatalogCounts,
  getNearBlocksTxUrl,
  isActiveWalletReadOnlyObserver,
  onNearSigningWalletConnected,
  provisionUniqueCitizenSubAccount,
  restoreConnectedNearSigningWallet,
  spawnSubAccountOnChainViaMaster,
  verifyNep171GamepassOwnership,
  type NearAccountView,
  type NearNetworkId,
  type NearNetworkStatus,
  type NearWalletConnectionResult,
  type Nep171GamepassSubAccountLedger,
  type OnChainNftSubAccountLedger,
  type RecruitedFamilyMemberAgent,
  resolveApiUrl,
  resolvePostClaimNearBalance,
  setLocalTxConfirmHandler,
  shouldAttemptAttestedHanaClaim,
  type LocalTxConfirmRequest,
} from './lib/nearClient';
import {
  mirrorRecipientOnChainRespiteCacheInSupabase,
  fetchBasePlotsFromSupabase,
  fetchFishMarketplaceListingsFromSupabase,
  fetchFishNftMarketSalesStats,
  fetchGamepassNftLedgerFromSupabase,
  fetchHouseInteriorFromSupabase,
  fetchMarketTransactionsFromSupabase,
  fetchNpcMerchantsFromSupabase,
  fetchNpcTreasuryLedgerFromSupabase,
  saveNpcTreasuryLedgerToSupabase,
  fetchOrCreatePlayerProfile,
  fetchPlayerProfileByEmail,
  broadcastSocialChatMessage,
  fetchRecentSocialMessages,
  insertSocialMessageToSupabase,
  createLetterForAccount,
  fetchLettersForAccount,
  logMarketTransactionToSupabase,
  signInWithSupabaseGoogle,
  signOutSupabaseAuth,
  subscribeToMarketTransactions,
  subscribeToSocialMessagesRealtime,
  unsubscribeSocialMessagesRealtime,
  subscribeToSupabaseAuthUser,
  syncBasePlotToSupabase,
  syncFishMarketplaceListingsToSupabase,
  syncHouseInteriorToSupabase,
  syncNpcMerchantToSupabase,
  syncPlayerBalancesToSupabase,
  type DbMarketTransactionRow,
  type DbPropertyListingRow,
  type FishNftMarketSalesStats,
} from './lib/supabaseClient';
import {
  FISH_SPECIES_CATALOG,
  computeLengthCmFromWeightKg,
  detectNearbyFishingWaterZone,
  rollRandomCaughtFish,
  createShorelineBiteSchedule,
  createShorelineMinigameState,
  stepShorelineMinigame,
  type CaughtFishItem,
  type FishNftMarketplaceListing,
  type FishingPhaseState,
  type ShorelineBiteSchedule,
  type ShorelineMinigameState,
} from './game/buddiesFishingMarket';
import { UrbanScooterShowroomModal } from './components/UrbanScooterShowroomModal';
import { FashionBoutiqueModal } from './components/FashionBoutiqueModal';
import { WardrobeStudioModal } from './components/WardrobeStudioModal';
import {
  FASHION_APPAREL_CATALOG_ITEMS,
  type FashionApparelCatalogItem,
  getEquippedTorsoStorageKey,
  getOwnedApparelStorageKey,
  purchaseFashionApparelToBag,
  resolveEquippedTorsoGlbForGender,
  toggleEquipFashionApparel,
} from './game/buddiesFashionKioskRules';
import {
  EMPTY_WARDROBE_DRAFT,
  WARDROBE_STUDIO_ITEMS,
  getWardrobeDraftStorageKey,
  purchaseWardrobeCatalogItem,
  resolveWardrobeDraftBodyShape,
  resolveWardrobeDraftFaceCustomization,
  resolveWardrobeDraftToModularOutfitUrls,
  sanitizeDraftToOwnedOnly,
  type WardrobeCatalogItem,
  type WardrobeOutfitDraft,
} from './game/buddiesWardrobeStudioRules';
import { GrandCasinoModal, type CasinoTab } from './components/GrandCasinoModal';
import type { CasinoSlotGameVariant } from './game/buddiesGrandCasinoRules';
import {
  RealEstateCatalogModal,
  type RealEstateCatalogTabId,
} from './components/RealEstateCatalogModal';
import {
  URBAN_SCOOTER_CATALOG_ITEMS,
  type UrbanScooterCatalogItem,
  type UrbanScooterKind,
} from './game/buddiesUrbanScooterRules';
import { HudAudioVolumeControl } from './components/HudAudioVolumeControl';
import { HudQuickMountScooterControl } from './components/HudQuickMountScooterControl';
import { HudWeatherAndTimeControl } from './components/HudWeatherAndTimeControl';
import {
  evaluateWeatherAndTimeState,
  getWeatherControlConfig,
  normalizeHours24,
  resolvePhaseFromHours,
  setWeatherControlConfig,
  subscribeWeatherDisplaySync,
} from './game/buddiesWeatherSystem';
import {
  clampAudioVolumePct,
  computeChannelStateAfterSliderChange,
  computeChannelStateAfterToggleMute,
} from './game/buddiesRealEstateKioskRules';

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
      const isOAuthReturn =
        Boolean(params.get('account_id')) ||
        window.location.search.includes('privy_oauth_') ||
        window.sessionStorage.getItem('bb_pending_privy_google_login') === '1';
      if (
        params.get('skipOnboarding') === '1' ||
        params.get('fullmap') === '1' ||
        params.get('planeview') ||
        params.get('skyshieldview') ||
        params.get('buildingview') ||
        params.get('parkview') ||
        (params.get('world') && params.get('world') !== 'lobby') ||
        isOAuthReturn
      ) {
        return 'playing';
      }
    }
    return 'title';
  });

  const [playMode, setPlayMode] = useState<PlayMode>('sandbox');
  const [characterGender, setCharacterGender] = useState<'female' | 'male'>('male');
  const [onboardingStep, setOnboardingStep] = useState<
    | 'auth_choice'
    | 'fly_to_plaza'
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
        params.get('skyshieldview') ||
        params.get('buildingview') ||
        params.get('parkview') ||
        (params.get('world') && params.get('world') !== 'lobby')
      ) {
        return 'completed';
      }
    }
    return 'auth_choice';
  });
  const [connectedExternalWalletId, setConnectedExternalWalletId] = useState<string>('');
  const [plazaFlyTargetMode, setPlazaFlyTargetMode] = useState<'character_select' | 'gameplay'>(
    'character_select',
  );
  const plazaFlySessionIdRef = useRef<number>(0);
  const pendingPlazaFlightRef = useRef<{
    sessionId: number;
    nextStep: 'guest_character_select' | 'completed';
  } | null>(null);
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
    'Creating your player account...',
  );
  const [tutorialStage, setTutorialStage] = useState<'none' | 'go_to_hana'>('none');
  const [hanaWelcomeNearClaimed, setHanaWelcomeNearClaimed] = useState<boolean>(false);
  // Onboarding spotlight: after the starter claim AND the first NEAR -> RESPITE
  // swap, the MISSIONS button pulses until the player opens Daily Missions
  // once — Hana covers claim + exchange, the missions carry the rest.
  const [onboardingSwapDone, setOnboardingSwapDone] = useState<boolean>(false);
  const [onboardingMissionsSeen, setOnboardingMissionsSeen] = useState<boolean>(false);
  const [hanaPitchOrigin, setHanaPitchOrigin] = useState<'kiosk' | 'browse' | null>(null);
  const [pendingPitchKioskStation, setPendingPitchKioskStation] =
    useState<CityTransitStationId>('central_plaza');
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
  const onboardingStepRef = useRef(onboardingStep);
  useEffect(() => {
    onboardingStepRef.current = onboardingStep;
  }, [onboardingStep]);
  const initialWeatherCfg = getWeatherControlConfig();
  const [lightingPreset, setLightingPreset] = useState<LightingPresetKey>(initialWeatherCfg.phase);
  const [timeOfDayHours, setTimeOfDayHours] = useState<number>(initialWeatherCfg.timeOfDayHours);
  const [weatherCondition, setWeatherCondition] = useState<WeatherConditionKey>(
    initialWeatherCfg.weatherCondition,
  );
  const [rainIntensityTier, setRainIntensityTier] = useState<RainIntensityTier>(
    initialWeatherCfg.rainIntensityTier,
  );
  const [autoTimeCycle, setAutoTimeCycle] = useState<boolean>(initialWeatherCfg.autoCycleEnabled);
  const [cityLightsScale, setCityLightsScale] = useState<number>(initialWeatherCfg.cityLightsScale);
  const [cameraFovMode, setCameraFovMode] = useState<'webgl35' | 'ortho18'>('webgl35');
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('bb_sfx_muted_v1') === '1';
    } catch {
      return false;
    }
  });
  const [isMusicMuted, setIsMusicMuted] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('bb_music_muted_v1') === '1';
    } catch {
      return false;
    }
  });
  const [audioVolumePct, setAudioVolumePct] = useState<number>(() => {
    try {
      const saved = window.localStorage.getItem('bb_sfx_vol_pct_v1');
      return saved !== null ? clampAudioVolumePct(Number(saved)) : 100;
    } catch {
      return 100;
    }
  });
  const [musicVolumePct, setMusicVolumePct] = useState<number>(() => {
    try {
      const saved = window.localStorage.getItem('bb_music_vol_pct_v1');
      return saved !== null ? clampAudioVolumePct(Number(saved)) : 100;
    } catch {
      return 100;
    }
  });
  const lastNonZeroSfxPctRef = useRef<number>(audioVolumePct > 0 ? audioVolumePct : 80);
  const lastNonZeroMusicPctRef = useRef<number>(musicVolumePct > 0 ? musicVolumePct : 80);
  const [showJoystickOnDesktop, setShowJoystickOnDesktop] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('bb_desktop_joystick_v1') === '1';
    } catch {
      return false;
    }
  });
  const handleToggleShowJoystickOnDesktop = useCallback(() => {
    setShowJoystickOnDesktop((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('bb_desktop_joystick_v1', next ? '1' : '0');
      } catch {
        // storage unavailable - the in-session value still applies
      }
      return next;
    });
  }, []);
  const [isKioskModalOpen, setIsKioskModalOpen] = useState<boolean>(false);
  const [activeSpecialModal, setActiveSpecialModal] = useState<
    'none' | 'npc_merchant' | 'house_interior'
  >('none');
  const activeSpecialModalRef = useRef(activeSpecialModal);
  activeSpecialModalRef.current = activeSpecialModal;
  const [isInsidePrivateHouse, setIsInsidePrivateHouse] = useState<boolean>(false);
  const [isInsideGlasshouseCafe, setIsInsideGlasshouseCafe] = useState<boolean>(false);
  const [isInsideGrandCasino, setIsInsideGrandCasino] = useState<boolean>(false);
  const [isInsideBeautySalon, setIsInsideBeautySalon] = useState<boolean>(false);
  const [activeCafeModal, setActiveCafeModal] = useState<
    | 'none'
    | 'order'
    | 'atm'
    | 'arcade_slot'
    | 'rota'
    | 'order_notification'
    | 'prep_pastry'
    | 'prep_drink'
  >('none');
  const [unifiedBottomDockMode, setUnifiedBottomDockMode] =
    useState<UnifiedBottomDockActionMode>('none');
  const [nearbyDockEntity, setNearbyDockEntity] = useState<NearbyEntityUser | null>(null);
  const lastNearbyDockEntityIdRef = useRef<string | null>(null);
  const [isCafeRotaMenuExpanded, setIsCafeRotaMenuExpanded] = useState<boolean>(false);
  const [isCafeOrderSlideBannerVisible, setIsCafeOrderSlideBannerVisible] =
    useState<boolean>(false);
  const [hasUnreadCafeOrderNotif, setHasUnreadCafeOrderNotif] = useState<boolean>(false);
  const [cafeShiftRemainingSec, setCafeShiftRemainingSec] = useState<number>(120);
  const [playerTotalXp, setPlayerTotalXp] = useState<number>(() => {
    try {
      const saved = Number(window.localStorage.getItem('bb_player_total_xp_v1') || '0');
      return Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;
    } catch {
      return 0;
    }
  });
  const [cafeShiftState, setCafeShiftState] = useState<CafeWorkShiftState>(() =>
    createInitialCafeWorkShiftState(),
  );
  const [cafePrepStatus, setCafePrepStatus] = useState<{
    stage: 'preparing' | 'moving' | 'serving';
    itemName: string;
    category: 'drink' | 'pastry';
  } | null>(null);
  const cafePrepStatusRef = useRef<{
    stage: 'preparing' | 'moving' | 'serving';
    itemName: string;
    category: 'drink' | 'pastry';
  } | null>(null);
  cafePrepStatusRef.current = cafePrepStatus;
  const [cafeConsumerState, setCafeConsumerState] = useState<CafeConsumerQueueState>(() =>
    createInitialCafeConsumerState(),
  );
  const cafeConsumerStateRef = useRef<CafeConsumerQueueState>(cafeConsumerState);
  cafeConsumerStateRef.current = cafeConsumerState;
  const [cafeConsumerTickMs, setCafeConsumerTickMs] = useState<number>(() => Date.now());
  const [xpCelebrationBanner, setXpCelebrationBanner] = useState<{
    id: number;
    xpGained: number;
    leveledUpTo: number | null;
    label: string;
  } | null>(null);
  const xpBannerTimerRef = useRef<number | null>(null);
  const levelProgress = computeLevelProgress(playerTotalXp);
  const [merchantLocation, setMerchantLocation] = useState<MerchantLocationId>('lobby_cafe');
  const [npcOpenSeq, setNpcOpenSeq] = useState<number>(0);
  const openMerchantInChatSession = useCallback((loc: MerchantLocationId) => {
    activeSpecialModalRef.current = 'npc_merchant';
    setMerchantLocation(loc);
    setNpcOpenSeq((prev) => prev + 1);
    setIsCitizenDialogueOpen(false);
    setIsSocialChatModalOpen(false);
    setIsDailyMissionsModalOpen(false);
    setSocialChatText('');
    setActiveSpecialModal('npc_merchant');
    const merchantCitizenId: CitizenId = loc === 'beach_house' ? 'npc_kai' : 'npc_hana';
    const talkSync = recordCitizenDailyTalk(citizenFriendshipStoreRef.current, merchantCitizenId);
    citizenFriendshipStoreRef.current = talkSync.store;
    setCitizenFriendshipStore(talkSync.store);
    saveCitizenFriendshipStore(talkSync.store);
  }, []);
  const [citizenFriendshipStore, setCitizenFriendshipStore] = useState<CitizenFriendshipStore>(() =>
    loadCitizenFriendshipStore(),
  );
  const citizenFriendshipStoreRef = useRef<CitizenFriendshipStore>(citizenFriendshipStore);
  useEffect(() => {
    citizenFriendshipStoreRef.current = citizenFriendshipStore;
  }, [citizenFriendshipStore]);
  const [isCitizenDialogueOpen, setIsCitizenDialogueOpen] = useState<boolean>(false);
  const [activeCitizenId, setActiveCitizenId] = useState<CitizenId | null>(null);
  const [citizenOpenSeq, setCitizenOpenSeq] = useState<number>(0);
  const [citizenTalkedBonusJustAwarded, setCitizenTalkedBonusJustAwarded] =
    useState<boolean>(false);

  const activeCitizenProfile = getCitizenProfile(activeCitizenId);
  const isCitizenChatBarMode =
    isCitizenDialogueOpen &&
    hud.worldMode !== 'warzone' &&
    activeSpecialModal !== 'npc_merchant';
  const isAnyNpcChatBarMode =
    activeSpecialModal === 'npc_merchant' || isCitizenChatBarMode;
  const activeNpcChatBarLabel =
    activeSpecialModal === 'npc_merchant'
      ? merchantLocation === 'lobby_cafe'
        ? 'HANA'
        : 'KAI'
      : (activeCitizenProfile?.name.toUpperCase() ?? 'CITIZEN');
  const activeNpcChatBarName =
    activeSpecialModal === 'npc_merchant'
      ? merchantLocation === 'lobby_cafe'
        ? 'Hana'
        : 'Kai'
      : (activeCitizenProfile?.name ?? 'Citizen');

  const openCitizenDialogueForId = useCallback((rawCitizenId: string | null | undefined) => {
    if (hudRef.current.worldMode === 'warzone') return;
    const canonical = resolveCanonicalCitizenId(rawCitizenId);
    if (!canonical) return;
    setIsKioskModalOpen(false);
    setIsTargetMenuExpanded(false);
    setIsProfileModalOpen(false);
    setIsPersonalWalletModalOpen(false);
    setIsPersonalBagModalOpen(false);
    setIsDailyMissionsModalOpen(false);
    setIsSocialChatModalOpen(false);
    setIsScooterShowroomModalOpen(false);
    setIsFashionBoutiqueModalOpen(false);
    setIsRealEstateCatalogModalOpen(false);
    setIsGrandCasinoModalOpen(false);
    setActiveSpecialModal('none');
    setActiveTeleportKioskModal('none');
    window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));

    const talkRes = recordCitizenDailyTalk(citizenFriendshipStoreRef.current, canonical);
    citizenFriendshipStoreRef.current = talkRes.store;
    setCitizenFriendshipStore(talkRes.store);
    saveCitizenFriendshipStore(talkRes.store);
    setCitizenTalkedBonusJustAwarded(talkRes.awardedTodayBonus);
    setActiveCitizenId(canonical);
    setCitizenOpenSeq((prev) => prev + 1);
    setIsCitizenDialogueOpen(true);
  }, []);
  const dailyMissionsAccountKey =
    (hud.nearWalletId || playerUid || 'guest').trim().toLowerCase() || 'guest';
  const dailyMissionsAccountRef = useRef<string>(dailyMissionsAccountKey);
  dailyMissionsAccountRef.current = dailyMissionsAccountKey;

  const loadDailyMissionsFromStorage = useCallback((acctKey: string): DailyMissionsState => {
    const todayKey = getLocalDailyDateKey();
    if (typeof window === 'undefined') {
      return createInitialDailyMissionsState(todayKey);
    }
    try {
      const raw = window.localStorage.getItem(getDailyMissionsStorageKey(acctKey));
      if (!raw) return createInitialDailyMissionsState(todayKey);
      return sanitizeDailyMissionsState(JSON.parse(raw), todayKey);
    } catch {
      return createInitialDailyMissionsState(todayKey);
    }
  }, []);

  const [dailyMissionsState, setDailyMissionsState] = useState<DailyMissionsState>(() =>
    loadDailyMissionsFromStorage('guest'),
  );
  const dailyMissionsStateRef = useRef<DailyMissionsState>(dailyMissionsState);
  useEffect(() => {
    dailyMissionsStateRef.current = dailyMissionsState;
  }, [dailyMissionsState]);
  const [isDailyMissionsModalOpen, setIsDailyMissionsModalOpen] = useState<boolean>(false);
  const [isScooterShowroomModalOpen, setIsScooterShowroomModalOpen] = useState<boolean>(false);
  const [isFashionBoutiqueModalOpen, setIsFashionBoutiqueModalOpen] = useState<boolean>(false);
  const [isWardrobeStudioOpen, setIsWardrobeStudioOpen] = useState<boolean>(false);
  const [isGrandCasinoModalOpen, setIsGrandCasinoModalOpen] = useState<boolean>(false);
  const [grandCasinoInitialTab, setGrandCasinoInitialTab] = useState<CasinoTab>('slots');
  const [grandCasinoSlotVariant, setGrandCasinoSlotVariant] =
    useState<CasinoSlotGameVariant>('lucky_draw');
  const [isRealEstateCatalogModalOpen, setIsRealEstateCatalogModalOpen] =
    useState<boolean>(false);
  const [realEstateCatalogTab, setRealEstateCatalogTab] =
    useState<RealEstateCatalogTabId>('house');
  const loadOwnedScootersFromStorage = useCallback((acctKey: string): string[] => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(`bb_owned_scooters_v1:${acctKey}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }, []);
  const [ownedScooterIds, setOwnedScooterIds] = useState<string[]>(() =>
    loadOwnedScootersFromStorage('guest'),
  );
  useEffect(() => {
    setOwnedScooterIds(loadOwnedScootersFromStorage(dailyMissionsAccountKey));
    const account = dailyMissionsAccountKey.trim();
    if (!account || account === 'guest') return;
    let cancelled = false;
    void fetchOwnedNep245CatalogCounts(
      account,
      URBAN_SCOOTER_CATALOG_ITEMS.map((s) => s.tokenId),
    )
      .then((counts) => {
        if (cancelled || !counts) return;
        const chainOwned = URBAN_SCOOTER_CATALOG_ITEMS.filter(
          (s) => (counts[s.tokenId] ?? 0) > 0,
        ).map((s) => s.id);
        if (chainOwned.length === 0) return;
        setOwnedScooterIds((prev) => {
          const next = Array.from(new Set([...prev, ...chainOwned]));
          try {
            window.localStorage.setItem(
              `bb_owned_scooters_v1:${dailyMissionsAccountKey}`,
              JSON.stringify(next),
            );
          } catch {
            // ignore storage failures
          }
          return next;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [dailyMissionsAccountKey, loadOwnedScootersFromStorage]);

  const loadOwnedApparelFromStorage = useCallback((acctKey: string): string[] => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(getOwnedApparelStorageKey(acctKey));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }, []);

  const loadEquippedTorsoFromStorage = useCallback((acctKey: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(getEquippedTorsoStorageKey(acctKey));
      return raw && raw.trim().length > 0 ? raw.trim() : null;
    } catch {
      return null;
    }
  }, []);

  const loadWardrobeDraftFromStorage = useCallback(
    (acctKey: string, fallbackTorsoId: string | null): WardrobeOutfitDraft => {
      if (typeof window === 'undefined') {
        return { ...EMPTY_WARDROBE_DRAFT, topId: fallbackTorsoId };
      }
      try {
        const raw = window.localStorage.getItem(getWardrobeDraftStorageKey(acctKey));
        if (!raw) return { ...EMPTY_WARDROBE_DRAFT, topId: fallbackTorsoId };
        const parsed = JSON.parse(raw) as Partial<WardrobeOutfitDraft> | null;
        if (!parsed || typeof parsed !== 'object') {
          return { ...EMPTY_WARDROBE_DRAFT, topId: fallbackTorsoId };
        }
        return {
          topId: typeof parsed.topId === 'string' ? parsed.topId : null,
          bottomsId: typeof parsed.bottomsId === 'string' ? parsed.bottomsId : null,
          shoesId: typeof parsed.shoesId === 'string' ? parsed.shoesId : null,
          hairId: typeof parsed.hairId === 'string' ? parsed.hairId : null,
          setId: typeof parsed.setId === 'string' ? parsed.setId : null,
          bodyShapeId: typeof parsed.bodyShapeId === 'string' ? parsed.bodyShapeId : null,
          eyeStyleId: typeof parsed.eyeStyleId === 'string' ? parsed.eyeStyleId : null,
          browStyleId: typeof parsed.browStyleId === 'string' ? parsed.browStyleId : null,
          lipStyleId: typeof parsed.lipStyleId === 'string' ? parsed.lipStyleId : null,
          animSetId: typeof parsed.animSetId === 'string' ? parsed.animSetId : null,
          dancePoseId: typeof parsed.dancePoseId === 'string' ? parsed.dancePoseId : null,
          clothingTintHex:
            typeof parsed.clothingTintHex === 'string' ? parsed.clothingTintHex : null,
        };
      } catch {
        return { ...EMPTY_WARDROBE_DRAFT, topId: fallbackTorsoId };
      }
    },
    [],
  );

  const [ownedApparelIds, setOwnedApparelIds] = useState<string[]>(() =>
    loadOwnedApparelFromStorage('guest'),
  );
  const [equippedTorsoItemId, setEquippedTorsoItemId] = useState<string | null>(() =>
    loadEquippedTorsoFromStorage('guest'),
  );
  const [equippedWardrobeDraft, setEquippedWardrobeDraft] = useState<WardrobeOutfitDraft>(() => {
    const initialOwned = loadOwnedApparelFromStorage('guest');
    const initialTorso = loadEquippedTorsoFromStorage('guest');
    const validTorso = initialTorso && initialOwned.includes(initialTorso) ? initialTorso : null;
    return sanitizeDraftToOwnedOnly(
      loadWardrobeDraftFromStorage('guest', validTorso),
      initialOwned,
    );
  });

  useEffect(() => {
    const loadedOwned = loadOwnedApparelFromStorage(dailyMissionsAccountKey);
    const loadedEquipped = loadEquippedTorsoFromStorage(dailyMissionsAccountKey);
    const validTorso =
      loadedEquipped && loadedOwned.includes(loadedEquipped) ? loadedEquipped : null;
    const loadedDraft = sanitizeDraftToOwnedOnly(
      loadWardrobeDraftFromStorage(dailyMissionsAccountKey, validTorso),
      loadedOwned,
    );
    setOwnedApparelIds(loadedOwned);
    setEquippedTorsoItemId(loadedDraft.setId ? null : loadedDraft.topId);
    setEquippedWardrobeDraft(loadedDraft);
  }, [
    dailyMissionsAccountKey,
    loadOwnedApparelFromStorage,
    loadEquippedTorsoFromStorage,
    loadWardrobeDraftFromStorage,
  ]);
  const lastEnteredHousePlotRef = useRef<{
    team: 'blue' | 'red' | null;
    plotIndex: number | null;
    viaStudio?: boolean;
  } | null>(null);

  useEffect(() => {
    const loaded = loadDailyMissionsFromStorage(dailyMissionsAccountKey);
    dailyMissionsStateRef.current = loaded;
    setDailyMissionsState(loaded);
  }, [dailyMissionsAccountKey, loadDailyMissionsFromStorage]);

  const dailyMissionsSummary = summarizeDailyMissions(dailyMissionsState);
  const [marketState, setMarketState] = useState(() => createInitialMerchantMarketState());
  const marketStateRef = useRef(marketState);
  useEffect(() => {
    marketStateRef.current = marketState;
  }, [marketState]);
  // Kai's treasury discipline ledger (plan Bagian 13, Fase 1): persisted in
  // bb_npc_treasury; the LUL pool itself stays in the merchant market state.
  const kaiLedgerRef = useRef<NpcTreasuryLedger | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchNpcTreasuryLedgerFromSupabase('beach_house').then((ledger) => {
      if (!cancelled && ledger) kaiLedgerRef.current = ledger;
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const cafeExchangeQuote = evaluateLulToCyonExchangeQuote(marketState);
  const [cyonBalance, setCyonBalance] = useState<number>(0);
  const cyonBalanceRef = useRef<number>(0);
  useEffect(() => {
    cyonBalanceRef.current = cyonBalance;
  }, [cyonBalance]);
  const [respiteBalance, setRespiteBalance] = useState<number>(0);
  const respiteBalanceRef = useRef<number>(0);
  useEffect(() => {
    respiteBalanceRef.current = respiteBalance;
  }, [respiteBalance]);
  const readCasinoRespiteDelta = useCallback((accountId: string): number => {
    if (typeof window === 'undefined') return 0;
    const key = `bb_casino_respite_delta_v1:${accountId.trim().toLowerCase() || 'guest'}`;
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw !== null ? Number(raw) : 0;
      return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
    } catch {
      return 0;
    }
  }, []);
  const writeCasinoRespiteDelta = useCallback((accountId: string, delta: number) => {
    if (typeof window === 'undefined') return;
    const key = `bb_casino_respite_delta_v1:${accountId.trim().toLowerCase() || 'guest'}`;
    try {
      const clean = Number.isFinite(delta) ? Math.round(delta * 100) / 100 : 0;
      window.localStorage.setItem(key, String(clean));
    } catch {
      // ignore storage quota errors
    }
  }, []);
  const [nearTestnetBalance, setNearTestnetBalance] = useState<number>(0);
  const nearTestnetBalanceRef = useRef<number>(0);
  useEffect(() => {
    nearTestnetBalanceRef.current = nearTestnetBalance;
  }, [nearTestnetBalance]);
  const pendingPostClaimFloorRef = useRef<{
    accountId: string;
    expectedMinNear: number;
    expiresAtMs: number;
  } | null>(null);
  const [personalWalletTab, setPersonalWalletTab] = useState<'wallet' | 'assets' | 'history'>('wallet');
  const [isSampleHouseView, setIsSampleHouseView] = useState<boolean>(false);
  const persistHouseStyleLocally = useCallback(
    (accountId: string, style: HouseArchitectureStyle) => {
      if (typeof window === 'undefined') return;
      const cleanAcct = accountId.trim().toLowerCase();
      if (!cleanAcct) return;
      try {
        window.localStorage.setItem(`bb_house_arch_style_v1:${cleanAcct}`, style);
      } catch {
        // ignore storage failures
      }
    },
    [],
  );

  const readHouseStyleLocally = useCallback((accountId: string): HouseArchitectureStyle | null => {
    if (typeof window === 'undefined') return null;
    const cleanAcct = accountId.trim().toLowerCase();
    if (!cleanAcct) return null;
    try {
      return parseOptionalHouseArchitectureStyle(
        window.localStorage.getItem(`bb_house_arch_style_v1:${cleanAcct}`),
      );
    } catch {
      return null;
    }
  }, []);

  const buildProfileUnlockedSkins = useCallback(
    (
      gender: 'male' | 'female',
      ownedStyle: HouseArchitectureStyle | null,
      existingSkins?: ReadonlyArray<string> | null,
    ): string[] => {
      const skins = ['default', `gender:${gender}`];
      const existingTag = existingSkins?.find(
        (s) => s === 'house_style:plaza_manor' || s === 'house_style:japanese_pavilion',
      );
      const resolvedStyle =
        ownedStyle ??
        (existingTag
          ? parseOptionalHouseArchitectureStyle(existingTag.replace('house_style:', ''))
          : null);
      if (resolvedStyle) {
        skins.push(`house_style:${resolvedStyle}`);
      }
      return skins;
    },
    [],
  );

  const [houseArchitectureStyle, setHouseArchitectureStyle] =
    useState<HouseArchitectureStyle>('plaza_manor');
  const [ownedHouseStyle, setOwnedHouseStyle] = useState<HouseArchitectureStyle | null>(null);
  const [isOnChainHouseStyleLocked, setIsOnChainHouseStyleLocked] = useState<boolean>(false);
  const houseArchitectureStyleRef = useRef<HouseArchitectureStyle>(houseArchitectureStyle);
  houseArchitectureStyleRef.current = houseArchitectureStyle;
  const ownedHouseStyleRef = useRef<HouseArchitectureStyle | null>(ownedHouseStyle);
  ownedHouseStyleRef.current = ownedHouseStyle;
  const isOnChainHouseStyleLockedRef = useRef<boolean>(isOnChainHouseStyleLocked);
  isOnChainHouseStyleLockedRef.current = isOnChainHouseStyleLocked;
  const hasHouseOwnershipRef = useRef<boolean>(false);
  const [isHouseFriendInviteOpen, setIsHouseFriendInviteOpen] = useState<boolean>(false);
  const [houseInviteFriendInput, setHouseInviteFriendInput] = useState<string>('');
  const [houseInviteFeedback, setHouseInviteFeedback] = useState<string | null>(null);
  const [walletHistoryFilter, setWalletHistoryFilter] = useState<
    'ALL' | 'LUL' | 'CYON' | 'RESPITE' | 'NEAR'
  >('ALL');
  const [walletTransactions, setWalletTransactions] = useState<DbMarketTransactionRow[]>([]);
  const [isLoadingWalletTransactions, setIsLoadingWalletTransactions] = useState<boolean>(false);
  const [onChainDeedLedger, setOnChainDeedLedger] = useState<OnChainNftSubAccountLedger | null>(null);
  const [isLoadingDeedLedger, setIsLoadingDeedLedger] = useState<boolean>(false);
  const [isDeedLedgerTxBusy, setIsDeedLedgerTxBusy] = useState<boolean>(false);
  const [deedLedgerActionFeedback, setDeedLedgerActionFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
    txHash?: string;
  } | null>(null);
  const [isNearWalletSelectorOpen, setIsNearWalletSelectorOpen] = useState<boolean>(false);
  const [localTxConfirmState, setLocalTxConfirmState] = useState<{
    request: LocalTxConfirmRequest;
    resolve: (approved: boolean) => void;
  } | null>(null);

  useEffect(() => {
    setLocalTxConfirmHandler(
      (request) =>
        new Promise<boolean>((resolve) => {
          setLocalTxConfirmState({ request, resolve });
        }),
    );
    return () => setLocalTxConfirmHandler(null);
  }, []);
  const [hasHouseOwnership, setHasHouseOwnership] = useState<boolean>(false);
  hasHouseOwnershipRef.current = hasHouseOwnership;
  const [houseEntryScanState, setHouseEntryScanState] = useState<'idle' | 'scanning' | 'verified'>(
    'idle',
  );
  const [recruitedFamilyMembers, setRecruitedFamilyMembers] = useState<
    RecruitedFamilyMemberAgent[]
  >([]);
  const [ownedMerchantItemIds, setOwnedMerchantItemIds] = useState<string[]>([]);

  // 3D house placements persist in bb_house_interiors.placed_furniture as
  // [legacySlotObject, ...placed3dEntries]; these refs track the latest
  // known pieces so every writer (slot assign, theme select, studio edits)
  // writes the combined array instead of wiping the other half.
  type SavedPlaced3dEntry = {
    kind: 'placed3d';
    instanceId: string;
    catalogId: string;
    x: number;
    z: number;
    ry: number;
  };
  const housePersistRef = useRef<{
    slot: HouseInteriorPlacementState | null;
    theme: string;
    placed3d: SavedPlaced3dEntry[];
  }>({ slot: null, theme: 'theme_japanese_zen', placed3d: [] });
  const savedHousePlacementsRef = useRef<SavedPlaced3dEntry[]>([]);
  const houseLoadAppliedRef = useRef(false);
  const houseUserEditedRef = useRef(false);
  const houseFlushTimerRef = useRef<number | null>(null);
  const [placedFurnitureCounts, setPlacedFurnitureCounts] = useState<Record<string, number>>({});

  const loadSavedHouseInterior = useCallback(
    async (account: string, ownedIds: readonly string[]) => {
      const interior = await fetchHouseInteriorFromSupabase(account);
      if (!interior) return;
      if (interior.active_theme_id) {
        setActiveHouseThemeId(interior.active_theme_id);
        housePersistRef.current.theme = interior.active_theme_id;
      }
      const rows = Array.isArray(interior.placed_furniture)
        ? interior.placed_furniture
        : [];
      const firstPlacement = rows[0] as HouseInteriorPlacementState | undefined;
      if (
        firstPlacement &&
        typeof firstPlacement === 'object' &&
        !('kind' in firstPlacement)
      ) {
        setInteriorPlacement((prev) => {
          const merged = { ...prev, ...firstPlacement };
          housePersistRef.current.slot = merged;
          return merged;
        });
      }
      // Saved 3D placements: never resurrect more copies of an item than
      // the player actually owns.
      const ownedCounts = countOwnedMerchantItems(ownedIds);
      const placedCounts: Record<string, number> = {};
      const entries: SavedPlaced3dEntry[] = [];
      for (const row of rows) {
        const e = row as Partial<SavedPlaced3dEntry>;
        if (!e || e.kind !== 'placed3d' || typeof e.catalogId !== 'string') continue;
        if ((placedCounts[e.catalogId] ?? 0) >= (ownedCounts[e.catalogId] ?? 0)) continue;
        placedCounts[e.catalogId] = (placedCounts[e.catalogId] ?? 0) + 1;
        entries.push({
          kind: 'placed3d',
          instanceId:
            typeof e.instanceId === 'string' && e.instanceId
              ? e.instanceId
              : `inst_${e.catalogId}_${entries.length}`,
          catalogId: e.catalogId,
          x: Math.round((Number(e.x) || 0) * 1000) / 1000,
          z: Math.round((Number(e.z) || 0) * 1000) / 1000,
          ry: Math.round((Number(e.ry) || 0) * 1000) / 1000,
        });
        if (entries.length >= 60) break;
      }
      savedHousePlacementsRef.current = entries;
      housePersistRef.current.placed3d = entries;
    },
    [],
  );

  const flushHouseInteriorPersist = useCallback(() => {
    const actorAccount = hudRef.current.nearWalletId || '';
    if (!actorAccount) return;
    const pieces: unknown[] = [];
    if (housePersistRef.current.slot) pieces.push(housePersistRef.current.slot);
    pieces.push(...housePersistRef.current.placed3d);
    void syncHouseInteriorToSupabase({
      ownerNearAccount: actorAccount,
      activeThemeId: housePersistRef.current.theme,
      daylightHour: 14.5,
      placedFurniture: pieces,
    }).then((ok) => {
      if (!ok) console.warn('[buddies] house interior persist failed (sync returned false)');
    });
  }, []);

  // Studio edits stream in from the Arena: persist them (debounced) as the
  // placed3d half of the interior row and mirror per-item placed counts for
  // the Bag. Replays of the saved list emit the identical entries back and
  // are recognized by signature, so loading never triggers a save loop.
  useEffect(() => {
    const onHouseState = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{
          placedItems?: Array<{
            instanceId: string;
            catalogId: string;
            x: number;
            z: number;
            ry: number;
          }>;
        }>
      ).detail;
      if (!detail?.placedItems) return;
      const entries: SavedPlaced3dEntry[] = detail.placedItems.slice(0, 60).map((it) => ({
        kind: 'placed3d' as const,
        instanceId: it.instanceId,
        catalogId: it.catalogId,
        x: Math.round((it.x || 0) * 1000) / 1000,
        z: Math.round((it.z || 0) * 1000) / 1000,
        ry: Math.round((it.ry || 0) * 1000) / 1000,
      }));
      if (JSON.stringify(entries) === JSON.stringify(housePersistRef.current.placed3d)) return;
      houseUserEditedRef.current = true;
      housePersistRef.current.placed3d = entries;
      const counts: Record<string, number> = {};
      for (const e of entries) counts[e.catalogId] = (counts[e.catalogId] ?? 0) + 1;
      setPlacedFurnitureCounts(counts);
      if (houseFlushTimerRef.current) window.clearTimeout(houseFlushTimerRef.current);
      houseFlushTimerRef.current = window.setTimeout(() => flushHouseInteriorPersist(), 900);
    };
    window.addEventListener('house-interior-state-updated', onHouseState);
    return () => window.removeEventListener('house-interior-state-updated', onHouseState);
  }, [flushHouseInteriorPersist]);

  // Once the Arena is alive (first HUD ticks in 'playing'), hand it the
  // saved placements exactly once — unless the player already edited the
  // room this session, in which case their edits are the truth.
  useEffect(() => {
    if (gameState !== 'playing') return;
    if (houseLoadAppliedRef.current || houseUserEditedRef.current) return;
    const entries = savedHousePlacementsRef.current;
    if (entries.length === 0) return;
    houseLoadAppliedRef.current = true;
    window.dispatchEvent(
      new CustomEvent('sync-npc-camera-mode', { detail: { loadPlacedItems: entries } }),
    );
  }, [gameState, hud]);
  const [propertyListings, setPropertyListings] = useState<DbPropertyListingRow[]>([]);
  const [busyPropertyListingId, setBusyPropertyListingId] = useState<string | null>(null);

  // Property marketplace board (Hana): since contract v1.3.0 the board's
  // source of truth is the escrow contract itself — every row shown is an
  // asset the contract is physically holding, and buying settles payment
  // and delivery in one on-chain call (no Supabase rows, no second step).
  const refreshPropertyListings = useCallback(async () => {
    const chainListings = await fetchBuddiesMarketPropertyListings().catch(
      () => [] as Awaited<ReturnType<typeof fetchBuddiesMarketPropertyListings>>,
    );
    const rows: DbPropertyListingRow[] = chainListings.map((l) => {
      const isDeed = l.asset_kind === 'deed';
      const catalogItem = isDeed
        ? undefined
        : MERCHANT_CATALOG_ITEMS.find((i) => i.tokenId === l.token_id);
      const listedAtIso = new Date(Number(l.listed_at_ms) || Date.now()).toISOString();
      return {
        id: l.listing_id,
        seller_account: l.seller_id,
        seller_name: null,
        asset_kind: isDeed ? 'house' : 'furniture',
        asset_id: isDeed ? l.token_id : (catalogItem?.id ?? l.token_id),
        asset_label: isDeed ? 'Private House Deed' : (catalogItem?.name ?? l.token_id),
        price_respite: Math.max(0, Number(l.price_respite) || 0),
        status: 'active',
        buyer_account: null,
        payment_tx: null,
        created_at: listedAtIso,
        updated_at: listedAtIso,
      };
    });
    setPropertyListings(rows);
  }, []);

  useEffect(() => {
    void refreshPropertyListings();
  }, [refreshPropertyListings]);
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
  const prevNpcChatActiveRef = useRef<boolean>(false);
  useEffect(() => {
    const isNpcNow = activeSpecialModal === 'npc_merchant';
    if (prevNpcChatActiveRef.current !== isNpcNow) {
      prevNpcChatActiveRef.current = isNpcNow;
      setSocialChatText('');
    }
  }, [activeSpecialModal]);
  const [chatBubbleBgColor, setChatBubbleBgColor] = useState<string>(() => {
    try {
      const saved = window.localStorage.getItem('bb_chat_bubble_style_v1');
      if (saved) {
        const parsed = JSON.parse(saved) as { bgColor?: string };
        return sanitizeHexColor(parsed.bgColor, '#ffffff');
      }
    } catch {
      // ignore storage errors
    }
    return '#ffffff';
  });
  const [chatBubbleTextColor, setChatBubbleTextColor] = useState<string>(() => {
    try {
      const saved = window.localStorage.getItem('bb_chat_bubble_style_v1');
      if (saved) {
        const parsed = JSON.parse(saved) as { bgColor?: string; textColor?: string };
        return resolveBubbleStyle(parsed.bgColor, parsed.textColor).textColor;
      }
    } catch {
      // ignore storage errors
    }
    return '#0f172a';
  });
  const [isSocialChatModalOpen, setIsSocialChatModalOpen] = useState<boolean>(false);
  const [isEmotePickerOpen, setIsEmotePickerOpen] = useState<boolean>(false);
  const [isPersonalWalletModalOpen, setIsPersonalWalletModalOpen] = useState<boolean>(false);
  const [isPersonalBagModalOpen, setIsPersonalBagModalOpen] = useState<boolean>(false);
  const [isGearModalOpen, setIsGearModalOpen] = useState<boolean>(false);
  const [equippedScooterKind, setEquippedScooterKind] = useState<UrbanScooterKind | null>(null);
  const [preferredScooterKind, setPreferredScooterKind] = useState<UrbanScooterKind>(() => {
    try {
      const saved = window.localStorage.getItem('bb_preferred_scooter_kind_v1');
      if (saved === 'electric_scooter_bike' || saved === 'push_kick_scooter') {
        return saved;
      }
    } catch {
      // ignore storage errors
    }
    return 'electric_scooter_bike';
  });
  const [personalBagTab, setPersonalBagTab] = useState<'equipment' | 'fish' | 'items'>('equipment');
  const [selectedPrivateUser, setSelectedPrivateUser] = useState<NearbyEntityUser | null>(null);
  const [unreadPrivateCount, setUnreadPrivateCount] = useState<number>(0);
  const [unreadLetterCount, setUnreadLetterCount] = useState<number>(0);
  // New-asset notification: counts owned items (merchant NFT copies, scooters,
  // the house deed) that arrived since the player last opened their wallet.
  const [newAssetCount, setNewAssetCount] = useState<number>(0);
  useEffect(() => {
    const account = dailyMissionsAccountKey;
    if (!account || account === 'guest') {
      setOnboardingSwapDone(false);
      setOnboardingMissionsSeen(false);
      return;
    }
    try {
      setOnboardingSwapDone(
        window.localStorage.getItem(`bb_onboarding_swap_v1:${account}`) === '1',
      );
      setOnboardingMissionsSeen(
        window.localStorage.getItem(`bb_onboarding_missions_seen_v1:${account}`) === '1',
      );
    } catch {
      // ignore storage failures
    }
  }, [dailyMissionsAccountKey]);
  useEffect(() => {
    if (!isDailyMissionsModalOpen || onboardingMissionsSeen) return;
    setOnboardingMissionsSeen(true);
    const account = dailyMissionsAccountKey;
    if (account && account !== 'guest') {
      try {
        window.localStorage.setItem(`bb_onboarding_missions_seen_v1:${account}`, '1');
      } catch {
        // ignore storage failures
      }
    }
  }, [isDailyMissionsModalOpen, onboardingMissionsSeen, dailyMissionsAccountKey]);
  const showMissionsOnboardingHint =
    hanaWelcomeNearClaimed && onboardingSwapDone && !onboardingMissionsSeen;
  const assetSeenRef = useRef<{
    account: string;
    seen: Record<string, number> | null;
    armedAt: number;
  }>({ account: '', seen: null, armedAt: 0 });
  useEffect(() => {
    const account = dailyMissionsAccountKey;
    if (!account || account === 'guest') {
      setNewAssetCount(0);
      return;
    }
    const current: Record<string, number> = {};
    for (const id of ownedMerchantItemIds) {
      current[`item:${id}`] = (current[`item:${id}`] ?? 0) + 1;
    }
    for (const id of ownedScooterIds) {
      current[`vehicle:${id}`] = 1;
    }
    if (hasHouseOwnership) {
      current['house_deed'] = 1;
    }
    const snap = assetSeenRef.current;
    if (snap.account !== account) {
      snap.account = account;
      snap.armedAt = Date.now() + 4000;
      try {
        const raw = window.localStorage.getItem(`bb_seen_assets_v1:${account}`);
        snap.seen = raw ? (JSON.parse(raw) as Record<string, number>) : null;
      } catch {
        snap.seen = null;
      }
    }
    if (isPersonalWalletModalOpen || isPersonalBagModalOpen) {
      // Opening the wallet or the bag acknowledges everything currently owned.
      try {
        window.localStorage.setItem(
          `bb_seen_assets_v1:${account}`,
          JSON.stringify(current),
        );
      } catch {
        // ignore storage failures
      }
      snap.seen = current;
      setNewAssetCount(0);
      return;
    }
    if (!snap.seen) {
      // First run for this account: seed the snapshot once the initial
      // chain hydration has had a moment to land, so long-owned items do
      // not badge as "new".
      if (Date.now() >= snap.armedAt) {
        try {
          window.localStorage.setItem(
            `bb_seen_assets_v1:${account}`,
            JSON.stringify(current),
          );
        } catch {
          // ignore storage failures
        }
        snap.seen = current;
      }
      return;
    }
    let delta = 0;
    for (const [key, qty] of Object.entries(current)) {
      delta += Math.max(0, qty - (snap.seen[key] ?? 0));
    }
    setNewAssetCount(delta);
  }, [
    ownedMerchantItemIds,
    ownedScooterIds,
    hasHouseOwnership,
    dailyMissionsAccountKey,
    isPersonalWalletModalOpen,
    isPersonalBagModalOpen,
  ]);
  const [missionGuide, setMissionGuide] = useState<{
    missionId: DailyMissionId;
    title: string;
    stage: 'to_kiosk' | 'direct';
    finalX: number;
    finalZ: number;
    stationId: CityTransitStationId | null;
    roadRoute?: boolean;
  } | null>(null);
  const missionGuideRef = useRef<typeof missionGuide>(null);
  const [missionGuideDistanceM, setMissionGuideDistanceM] = useState<number | null>(null);
  const clearMissionGuide = () => {
    missionGuideRef.current = null;
    setMissionGuide(null);
    setMissionGuideDistanceM(null);
  };
  const [clickToWalkSync, setClickToWalkSync] = useState<ClickToWalkHudSummary | null>(null);
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
  const [fishingBiteSchedule, setFishingBiteSchedule] = useState<ShorelineBiteSchedule | null>(
    null,
  );
  const [fishingHintMessage, setFishingHintMessage] = useState<string | null>(null);
  const [fishingMinigame, setFishingMinigame] = useState<ShorelineMinigameState | null>(null);
  const [isHoldingReel, setIsHoldingReel] = useState<boolean>(false);
  const [lastCaughtFishToast, setLastCaughtFishToast] = useState<CaughtFishItem | null>(null);

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
      const st = socialChatStateRef.current;
      const fetched: ChatMessage[] = rows.map((msg) => {
        const style = resolveBubbleStyle(msg.bubble_color);
        return {
          id: msg.id,
          senderId: msg.sender_near_account || undefined,
          senderName: msg.sender_name,
          recipientName: msg.recipient_name || undefined,
          text: msg.message,
          timestamp: new Date(msg.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          createdAtMs: Date.parse(msg.created_at) || undefined,
          bubbleBgColor: style.bgColor,
          bubbleTextColor: style.textColor,
          type: msg.recipient_name ? 'private' : 'public',
        };
      });
      setChatMessages((prev) => {
        let merged = [...fetched];
        for (const existing of prev) {
          merged = mergeRealtimeSocialChatMessage(merged, existing, {
            localPlayerName: st.playerDisplayName,
            localPlayerUid: st.playerUid,
            isOwnFn: (m) => isOwnChatMessage(m, st.playerDisplayName, st.playerUid),
            simplifyNameFn: simplifyDisplayName,
          }).nextMessages;
        }
        chatMessagesRef.current = merged;
        return merged;
      });
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

    const handleIncomingSocialRow = (incomingMsg: ChatMessage) => {
      const st = socialChatStateRef.current;
      const preview = mergeRealtimeSocialChatMessage(chatMessagesRef.current, incomingMsg, {
        localPlayerName: st.playerDisplayName,
        localPlayerUid: st.playerUid,
        isOwnFn: (m) => isOwnChatMessage(m, st.playerDisplayName, st.playerUid),
        simplifyNameFn: simplifyDisplayName,
      });

      setChatMessages((prev) => {
        const res = mergeRealtimeSocialChatMessage(prev, incomingMsg, {
          localPlayerName: st.playerDisplayName,
          localPlayerUid: st.playerUid,
          isOwnFn: (m) => isOwnChatMessage(m, st.playerDisplayName, st.playerUid),
          simplifyNameFn: simplifyDisplayName,
        });
        chatMessagesRef.current = res.nextMessages;
        return res.nextMessages;
      });

      if (
        !preview.isDuplicate &&
        !preview.upgradedExisting &&
        shouldTriggerIncomingPrivateChatNotification({
          message: incomingMsg,
          localPlayerName: st.playerDisplayName,
          localPlayerUid: st.playerUid,
          isSocialChatModalOpen: st.isSocialChatModalOpen,
          activeTab: st.selectedPrivateUser ? 'private' : 'public',
          selectedPrivateUser: st.selectedPrivateUser,
        })
      ) {
        const notifKey =
          incomingMsg.clientMsgId ||
          `${simplifyDisplayName(incomingMsg.senderName).toLowerCase()}::${incomingMsg.text.trim()}`;
        if (notifiedPrivateIdsRef.current.has(notifKey)) {
          return;
        }
        notifiedPrivateIdsRef.current.add(notifKey);
        if (notifiedPrivateIdsRef.current.size > 200) {
          const oldest = notifiedPrivateIdsRef.current.values().next().value;
          if (oldest) notifiedPrivateIdsRef.current.delete(oldest);
        }
        const senderUser: NearbyEntityUser = {
          id: incomingMsg.senderId || `peer-${incomingMsg.senderName}`,
          nearAccountId: incomingMsg.senderId,
          name: simplifyDisplayName(incomingMsg.senderName),
          isNpc: false,
          distance: 0,
        };
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
      }
    };

    const realtimeChannel = subscribeToSocialMessagesRealtime((msg) => {
      if (!mounted) return;
      const msgType: 'public' | 'private' = msg.recipient_name ? 'private' : 'public';
      const style = resolveBubbleStyle(msg.bubble_color, msg.bubble_text_color);
      const parsedTime = Date.parse(msg.created_at);
      const incomingMsg: ChatMessage = {
        id: msg.id,
        clientMsgId: msg.client_msg_id,
        senderId: msg.sender_near_account || undefined,
        senderName: msg.sender_name,
        recipientName: msg.recipient_name || undefined,
        text: msg.message,
        timestamp: new Date(Number.isFinite(parsedTime) ? parsedTime : Date.now()).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        createdAtMs: Number.isFinite(parsedTime) ? parsedTime : Date.now(),
        bubbleBgColor: style.bgColor,
        bubbleTextColor: style.textColor,
        type: msgType,
      };
      handleIncomingSocialRow(incomingMsg);
    });

    const onCustomIncomingSocialMessage = (ev: Event) => {
      if (!mounted) return;
      const detail = (ev as CustomEvent<ChatMessage>).detail;
      if (!detail || !detail.id || !detail.text) return;
      handleIncomingSocialRow(detail);
    };
    window.addEventListener('incoming-social-chat-message', onCustomIncomingSocialMessage);

    return () => {
      mounted = false;
      window.removeEventListener('incoming-social-chat-message', onCustomIncomingSocialMessage);
      unsubscribeSocialMessagesRealtime(realtimeChannel);
    };
  }, [merchantLocation]);

  const [selectedTargetUser, setSelectedTargetUser] = useState<NearbyEntityUser | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [profileTargetUser, setProfileTargetUser] = useState<NearbyEntityUser | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatMessagesRef = useRef<ChatMessage[]>([]);
  const notifiedPrivateIdsRef = useRef<Set<string>>(new Set());

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
      isCitizenDialogueOpen ||
      activeTeleportKioskModal !== 'none'
    ) {
      setIsPersonalWalletModalOpen(false);
    }
  }, [
    activeSpecialModal,
    isKioskModalOpen,
    isSocialChatModalOpen,
    isProfileModalOpen,
    isCitizenDialogueOpen,
    activeTeleportKioskModal,
  ]);

  useEffect(() => {
    if (isCitizenDialogueOpen && hud.worldMode === 'warzone') {
      setIsCitizenDialogueOpen(false);
    }
  }, [isCitizenDialogueOpen, hud.worldMode]);

  type CityViewAnchorNode = {
    id: CityViewDistrictId;
    label: string;
    subtitle: string;
    leftPct: number;
    topPct: number;
  };
  const [cityViewActive, setCityViewActive] = useState<boolean>(false);
  const [cityViewTarget, setCityViewTarget] = useState<CityViewTargetId>('kota');
  const [cityViewAnchors, setCityViewAnchors] = useState<{
    active: CityViewAnchorNode | null;
    neighbors: CityViewAnchorNode[];
  }>({ active: null, neighbors: [] });
  const cityViewInitialHashCheckedRef = useRef<boolean>(false);

  const selectCityViewTarget = useCallback(
    (nextTarget: CityViewTargetId, isInitialEnter = false) => {
      soundEngine.playUiClick();
      setCityViewActive(true);
      setCityViewTarget(nextTarget);
      window.dispatchEvent(
        new CustomEvent('sync-city-view-mode', {
          detail: {
            action: isInitialEnter ? 'enter' : 'select',
            target: nextTarget,
          },
        }),
      );
      if (typeof window !== 'undefined') {
        const nextHash = getCityViewTargetHash(nextTarget);
        if (window.location.hash.toLowerCase() !== nextHash) {
          try {
            window.history.replaceState(
              null,
              '',
              `${window.location.pathname}${window.location.search}${nextHash}`,
            );
          } catch {
            // ignore history restriction
          }
        }
      }
    },
    [],
  );

  const exitCityViewMode = useCallback(() => {
    if (!cityViewActive) return;
    soundEngine.playUiClick();
    setCityViewActive(false);
    setCityViewAnchors({ active: null, neighbors: [] });
    window.dispatchEvent(
      new CustomEvent('sync-city-view-mode', {
        detail: { action: 'exit' },
      }),
    );
    if (typeof window !== 'undefined' && window.location.hash) {
      try {
        window.history.replaceState(
          null,
          '',
          `${window.location.pathname}${window.location.search}`,
        );
      } catch {
        // ignore history restriction
      }
    }
  }, [cityViewActive]);

  useEffect(() => {
    const isOpenNow = isCitizenDialogueOpen && hud.worldMode !== 'warzone';
    window.dispatchEvent(
      new CustomEvent('citizen-dialogue-open-state', {
        detail: {
          isOpen: isOpenNow,
          citizenId: isOpenNow ? activeCitizenId : null,
        },
      }),
    );
  }, [isCitizenDialogueOpen, activeCitizenId, hud.worldMode]);
  const [worldMode, setWorldMode] = useState<WorldMode>(() => {
    if (typeof window !== 'undefined') {
      const w = new URLSearchParams(window.location.search).get('world');
      if (w === 'safezone' || w === 'lobby' || w === 'warzone') {
        return w;
      }
    }
    return 'lobby';
  });

  const handleCancelClickToWalk = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    soundEngine.playUiClick();
    window.dispatchEvent(new CustomEvent('click-to-walk-cancel'));
  }, []);

  useEffect(() => {
    const onPicked = (ev: Event) => {
      const target = (ev as CustomEvent<{ target?: CityViewTargetId }>).detail?.target;
      if (target) {
        selectCityViewTarget(target);
      }
    };
    const onAnchors = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{
          active: CityViewAnchorNode | null;
          neighbors: CityViewAnchorNode[];
        }>
      ).detail;
      if (detail) {
        setCityViewAnchors({
          active: detail.active ?? null,
          neighbors: Array.isArray(detail.neighbors) ? detail.neighbors : [],
        });
      }
    };
    const onRequestExit = () => {
      exitCityViewMode();
    };
    const onHashChange = () => {
      const parsed = parseCityViewHash(window.location.hash);
      if (
        parsed &&
        gameState === 'playing' &&
        onboardingStep === 'completed' &&
        worldMode !== 'warzone'
      ) {
        selectCityViewTarget(parsed, !cityViewActive);
      }
    };
    window.addEventListener('city-view-district-picked', onPicked);
    window.addEventListener('city-view-anchors-updated', onAnchors);
    window.addEventListener('request-exit-city-view', onRequestExit);
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('city-view-district-picked', onPicked);
      window.removeEventListener('city-view-anchors-updated', onAnchors);
      window.removeEventListener('request-exit-city-view', onRequestExit);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [
    cityViewActive,
    exitCityViewMode,
    gameState,
    onboardingStep,
    selectCityViewTarget,
    worldMode,
  ]);

  useEffect(() => {
    if (cityViewActive && (worldMode === 'warzone' || gameState !== 'playing')) {
      exitCityViewMode();
    }
  }, [cityViewActive, exitCityViewMode, gameState, worldMode]);

  useEffect(() => {
    if (
      cityViewInitialHashCheckedRef.current ||
      !isPreloadComplete ||
      gameState !== 'playing' ||
      onboardingStep !== 'completed' ||
      worldMode === 'warzone' ||
      typeof window === 'undefined'
    ) {
      return;
    }
    cityViewInitialHashCheckedRef.current = true;
    const parsed = parseCityViewHash(window.location.hash);
    if (parsed) {
      selectCityViewTarget(parsed, true);
    }
  }, [gameState, isPreloadComplete, onboardingStep, selectCityViewTarget, worldMode]);
  const [worldInitialTeam, setWorldInitialTeam] = useState<'blue' | 'red'>('blue');
  const [worldTransitionCount, setWorldTransitionCount] = useState<number>(0);
  const [isWorldLoading, setIsWorldLoading] = useState<boolean>(false);
  const [isCafeInteriorLoading, setIsCafeInteriorLoading] = useState<boolean>(false);
  const cafeLoadingTimeoutRef = useRef<number | null>(null);
  const [isCasinoInteriorLoading, setIsCasinoInteriorLoading] = useState<boolean>(false);
  const casinoLoadingTimeoutRef = useRef<number | null>(null);
  const [isSalonInteriorLoading, setIsSalonInteriorLoading] = useState<boolean>(false);
  const salonLoadingTimeoutRef = useRef<number | null>(null);
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
      if (cafeLoadingTimeoutRef.current !== null) {
        window.clearTimeout(cafeLoadingTimeoutRef.current);
        cafeLoadingTimeoutRef.current = null;
      }
      if (casinoLoadingTimeoutRef.current !== null) {
        window.clearTimeout(casinoLoadingTimeoutRef.current);
        casinoLoadingTimeoutRef.current = null;
      }
      if (salonLoadingTimeoutRef.current !== null) {
        window.clearTimeout(salonLoadingTimeoutRef.current);
        salonLoadingTimeoutRef.current = null;
      }
      setIsKioskModalOpen(false);
      setIsGrandCasinoModalOpen(false);
      setActiveSpecialModal('none');
      setIsInsidePrivateHouse(false);
      setIsInsideGlasshouseCafe(false);
      setIsInsideGrandCasino(false);
      setIsInsideBeautySalon(false);
      setIsCafeInteriorLoading(false);
      setIsCasinoInteriorLoading(false);
      setIsSalonInteriorLoading(false);
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

  useEffect(() => {
    document.body.dataset.state = gameState;
    document.body.dataset.mode = playMode;
  }, [gameState, playMode]);

  const dispatchBuddyAction = useCallback((actionName: string) => {
    window.dispatchEvent(new CustomEvent('buddy-action', { detail: actionName }));
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        'bb_chat_bubble_style_v1',
        JSON.stringify({ bgColor: chatBubbleBgColor, textColor: chatBubbleTextColor }),
      );
    } catch {
      // ignore storage errors
    }
    window.dispatchEvent(
      new CustomEvent('update-social-bubble-style', {
        detail: { bgColor: chatBubbleBgColor, textColor: chatBubbleTextColor },
      }),
    );
  }, [chatBubbleBgColor, chatBubbleTextColor, worldTransitionCount]);

  const publishPlayerSocialMessage = useCallback(
    (params: {
      text: string;
      recipient?: { id?: string | number; name: string } | null;
      roomId?: string;
    }) => {
      const cleanText = params.text.trim();
      if (!cleanText) return;
      const nowMs = Date.now();
      const nowStr = new Date(nowMs).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const senderLabel = playerDisplayName || 'YOU';
      const senderAccount = hudRef.current.nearWalletId || playerUid || undefined;
      const isPrivate = Boolean(params.recipient && params.recipient.name);
      const clientMsgId = `${isPrivate ? 'priv' : 'pub'}-${nowMs}-${Math.random().toString(36).slice(2, 7)}`;

      const newMsg: ChatMessage = {
        id: clientMsgId,
        clientMsgId,
        senderId: senderAccount,
        senderName: senderLabel,
        recipientId: isPrivate && params.recipient?.id != null ? String(params.recipient.id) : undefined,
        recipientName: isPrivate ? params.recipient?.name : undefined,
        isSelf: true,
        text: cleanText,
        timestamp: nowStr,
        createdAtMs: nowMs,
        bubbleBgColor: chatBubbleBgColor,
        bubbleTextColor: chatBubbleTextColor,
        type: isPrivate ? 'private' : 'public',
      };

      setChatMessages((prev) => {
        const merged = mergeRealtimeSocialChatMessage(prev, newMsg, {
          localPlayerName: senderLabel,
          localPlayerUid: senderAccount,
          isOwnFn: (m) => isOwnChatMessage(m, senderLabel, senderAccount),
          simplifyNameFn: simplifyDisplayName,
        });
        chatMessagesRef.current = merged.nextMessages;
        return merged.nextMessages;
      });

      if (!isPrivate) {
        dispatchBuddyAction(`socialTalk:${cleanText}`);
      }

      const createdIso = new Date(nowMs).toISOString();
      const targetRoom = params.roomId || worldMode;
      broadcastSocialChatMessage({
        clientMsgId,
        senderName: senderLabel,
        senderNearAccount: senderAccount,
        recipientName: isPrivate ? params.recipient?.name : null,
        message: cleanText,
        bubbleColor: chatBubbleBgColor,
        bubbleTextColor: chatBubbleTextColor,
        createdAt: createdIso,
        roomId: targetRoom,
      });
      void insertSocialMessageToSupabase({
        sender_name: senderLabel,
        sender_near_account: senderAccount,
        recipient_name: isPrivate ? params.recipient?.name : undefined,
        message: cleanText,
        bubble_color: chatBubbleBgColor,
        room_id: targetRoom,
      });
    },
    [
      playerDisplayName,
      playerUid,
      chatBubbleBgColor,
      chatBubbleTextColor,
      worldMode,
      dispatchBuddyAction,
    ],
  );

  useEffect(() => {
    const ownedDraft = sanitizeDraftToOwnedOnly(
      equippedWardrobeDraft,
      ownedApparelIds,
      characterGender,
    );
    const modularUrls = resolveWardrobeDraftToModularOutfitUrls(ownedDraft, characterGender);
    const payload = {
      ...modularUrls,
      clothingTintHex: ownedDraft.clothingTintHex,
      bodyShape: resolveWardrobeDraftBodyShape(ownedDraft),
      faceCustomization: resolveWardrobeDraftFaceCustomization(ownedDraft),
    };
    dispatchBuddyAction(`setEquippedModularOutfit:${JSON.stringify(payload)}`);
  }, [equippedWardrobeDraft, ownedApparelIds, characterGender, gameState, dispatchBuddyAction]);

  const handlePurchaseFashionApparelToBag = useCallback(
    (item: FashionApparelCatalogItem): { ok: boolean; errorMessage?: string } => {
      const res = purchaseFashionApparelToBag(ownedApparelIds, hudRef.current.gold, item.id);
      if (!res.ok) {
        return { ok: false, errorMessage: res.errorMessage };
      }
      if (!res.alreadyOwned) {
        if (res.priceChargedLul > 0) {
          dispatchBuddyAction(`adjustPlayerLul:${-res.priceChargedLul}`);
          setHud((prev) => ({ ...prev, gold: res.nextLulBalance }));
          const buyerAcct = hudRef.current.nearWalletId || '';
          if (buyerAcct) {
            void syncPlayerBalancesToSupabase({
              nearAccountId: buyerAcct,
              lulBalance: res.nextLulBalance,
              cyonBalance: cyonBalanceRef.current,
              respiteBalance: respiteBalanceRef.current,
            });
          }
        }
        setOwnedApparelIds(res.nextOwnedIds);
        try {
          window.localStorage.setItem(
            getOwnedApparelStorageKey(dailyMissionsAccountKey),
            JSON.stringify(res.nextOwnedIds),
          );
        } catch {
          // ignore storage errors
        }
      }
      return { ok: true };
    },
    [ownedApparelIds, dailyMissionsAccountKey, dispatchBuddyAction],
  );

  const handlePurchaseWardrobeStudioItem = useCallback(
    (item: WardrobeCatalogItem): { ok: boolean; errorMessage?: string } => {
      const res = purchaseWardrobeCatalogItem(ownedApparelIds, hudRef.current.gold, item.id);
      if (!res.ok) {
        return { ok: false, errorMessage: res.errorMessage };
      }
      if (!res.alreadyOwned) {
        if (res.priceChargedLul > 0) {
          dispatchBuddyAction(`adjustPlayerLul:${-res.priceChargedLul}`);
          setHud((prev) => ({ ...prev, gold: res.nextLulBalance }));
          const buyerAcct = hudRef.current.nearWalletId || '';
          if (buyerAcct) {
            void syncPlayerBalancesToSupabase({
              nearAccountId: buyerAcct,
              lulBalance: res.nextLulBalance,
              cyonBalance: cyonBalanceRef.current,
              respiteBalance: respiteBalanceRef.current,
            });
          }
        }
        setOwnedApparelIds(res.nextOwnedIds);
        try {
          window.localStorage.setItem(
            getOwnedApparelStorageKey(dailyMissionsAccountKey),
            JSON.stringify(res.nextOwnedIds),
          );
        } catch {
          // ignore storage errors
        }
      }
      return { ok: true };
    },
    [ownedApparelIds, dailyMissionsAccountKey, dispatchBuddyAction],
  );

  const handleCompleteWardrobeStudio = useCallback(
    (committedOwnedDraft: WardrobeOutfitDraft) => {
      const safeDraft = sanitizeDraftToOwnedOnly(committedOwnedDraft, ownedApparelIds);
      setEquippedWardrobeDraft(safeDraft);
      const nextTopId = safeDraft.setId ? null : safeDraft.topId;
      setEquippedTorsoItemId(nextTopId);
      try {
        window.localStorage.setItem(
          getWardrobeDraftStorageKey(dailyMissionsAccountKey),
          JSON.stringify(safeDraft),
        );
        if (nextTopId) {
          window.localStorage.setItem(
            getEquippedTorsoStorageKey(dailyMissionsAccountKey),
            nextTopId,
          );
        } else {
          window.localStorage.removeItem(getEquippedTorsoStorageKey(dailyMissionsAccountKey));
        }
      } catch {
        // ignore storage errors
      }
      setIsWardrobeStudioOpen(false);
    },
    [ownedApparelIds, dailyMissionsAccountKey],
  );

  const handleToggleEquipApparel = useCallback(
    (itemId: string | null) => {
      const toggled = toggleEquipFashionApparel(ownedApparelIds, equippedTorsoItemId, itemId);
      if (!toggled.ok) return;
      soundEngine.playUiConfirm();
      setEquippedTorsoItemId(toggled.nextEquippedId);
      setEquippedWardrobeDraft((prev) => {
        const nextDraft: WardrobeOutfitDraft = {
          ...prev,
          setId: null,
          topId: toggled.nextEquippedId,
        };
        try {
          window.localStorage.setItem(
            getWardrobeDraftStorageKey(dailyMissionsAccountKey),
            JSON.stringify(nextDraft),
          );
        } catch {
          // ignore storage errors
        }
        return nextDraft;
      });
      try {
        if (toggled.nextEquippedId) {
          window.localStorage.setItem(
            getEquippedTorsoStorageKey(dailyMissionsAccountKey),
            toggled.nextEquippedId,
          );
        } else {
          window.localStorage.removeItem(getEquippedTorsoStorageKey(dailyMissionsAccountKey));
        }
      } catch {
        // ignore storage errors
      }
      const nextGlb = resolveEquippedTorsoGlbForGender(toggled.nextEquippedId, characterGender);
      dispatchBuddyAction(`setEquippedTorso:${nextGlb ?? ''}`);
    },
    [ownedApparelIds, equippedTorsoItemId, dailyMissionsAccountKey, characterGender, dispatchBuddyAction],
  );

  const setAndPersistHouseArchitectureStyle = useCallback(
    (style: HouseArchitectureStyle, accountOverride?: string) => {
      setHouseArchitectureStyle(style);
      const acct = (accountOverride || hudRef.current.nearWalletId || playerUid || '')
        .trim()
        .toLowerCase();
      const ownsHouseNow = Boolean(hasHouseOwnershipRef.current || hudRef.current.nearHasGamepassNft);
      if (!ownsHouseNow || !isOnChainHouseStyleLockedRef.current) {
        if (ownsHouseNow) {
          setOwnedHouseStyle(style);
          if (acct) {
            dispatchBuddyAction(
              `nearSyncWalletSession:${acct}:1:${hudRef.current.nearGamepassTokenId || ''}:${style}`,
            );
            void syncPlayerBalancesToSupabase({
              nearAccountId: acct,
              lulBalance: hudRef.current.gold,
              cyonBalance,
              respiteBalance,
              unlockedSkins: buildProfileUnlockedSkins(characterGender, style),
            });
          }
        }
        if (acct) {
          persistHouseStyleLocally(acct, style);
        }
      }
    },
    [
      buildProfileUnlockedSkins,
      characterGender,
      cyonBalance,
      dispatchBuddyAction,
      persistHouseStyleLocally,
      playerUid,
      respiteBalance,
    ],
  );

  // LUL lives in the Arena as gold and can only be adjusted by delta, so a
  // stored profile balance is restored by dispatching the difference once.
  const restoreLulFromProfile = useCallback(
    (storedLul: number) => {
      const target = Math.max(0, Math.min(1_000_000, Math.floor(storedLul || 0)));
      const current = Math.max(0, Math.floor(hudRef.current?.gold ?? 0));
      const delta = target - current;
      if (delta !== 0) dispatchBuddyAction(`adjustPlayerLul:${delta}`);
    },
    [dispatchBuddyAction],
  );

  const handleStartGame = useCallback((shouldReset = false) => {
    soundEngine.playUiConfirm();
    soundEngine.preloadIngameBgmAsync();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (shouldReset) {
      setResetTrigger((prev) => prev + 1);
    }
    setOnboardingStep((prev) => (prev === 'completed' ? 'completed' : 'auth_choice'));
    document.body.dataset.state = 'playing';
    setGameState('playing');
  }, []);

  const beginPlazaFlyToOnboarding = useCallback(
    (targetMode: 'character_select' | 'gameplay', nextStep: 'guest_character_select' | 'completed') => {
      // A second fly request while one is already pending (duplicate login /
      // session-restore paths) must not replace the pending flight: the
      // arena completion event would carry a session id the fallback timer
      // no longer matches, deadlooking the player on the FLYING banner.
      if (pendingPlazaFlightRef.current) return;
      const nextSid = plazaFlySessionIdRef.current + 1;
      plazaFlySessionIdRef.current = nextSid;
      pendingPlazaFlightRef.current = {
        sessionId: nextSid,
        nextStep,
      };
      setPlazaFlyTargetMode(targetMode);
      setOnboardingStep('fly_to_plaza');
      document.body.dataset.state = 'playing';
      setGameState('playing');
    },
    [],
  );

  useEffect(() => {
    const completePlazaFlight = (sid?: number) => {
      const pending = pendingPlazaFlightRef.current;
      if (!pending) return;
      if (typeof sid === 'number' && sid !== pending.sessionId) return;
      pendingPlazaFlightRef.current = null;
      setOnboardingStep(pending.nextStep);
    };
    const onFlyComplete = (ev: Event) => {
      const detail = (ev as CustomEvent<{ flySessionId?: number }>).detail;
      completePlazaFlight(detail?.flySessionId);
    };
    window.addEventListener('plaza-fly-to-complete', onFlyComplete);
    let fallbackTimer: number | undefined;
    if (onboardingStep === 'fly_to_plaza' && pendingPlazaFlightRef.current) {
      // No session id on purpose: force-complete whatever flight is pending
      // when the timer fires, so a session-id desync can never strand the
      // player in fly_to_plaza with locked controls.
      fallbackTimer = window.setTimeout(() => completePlazaFlight(), 3000);
    }
    return () => {
      window.removeEventListener('plaza-fly-to-complete', onFlyComplete);
      if (fallbackTimer !== undefined) {
        window.clearTimeout(fallbackTimer);
      }
    };
  }, [onboardingStep]);

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

  const activeSessionMusicTrack: 'none' | 'landing' | 'ingame' = !isPreloadComplete
    ? 'none'
    : gameState === 'title'
      ? 'landing'
      : gameState === 'playing' && onboardingStep === 'completed'
        ? 'ingame'
        : 'none';

  useEffect(() => {
    soundEngine.muted = isMuted;
    soundEngine.musicMuted = isMusicMuted;
    soundEngine.setSfxVolume(audioVolumePct / 100);
    soundEngine.setMusicVolume(musicVolumePct / 100);
  }, [isMuted, isMusicMuted, audioVolumePct, musicVolumePct]);

  useEffect(() => {
    soundEngine.setBgmMode(activeBgmMode);
    soundEngine.setSessionMusicTrack(activeSessionMusicTrack);
  }, [activeBgmMode, activeSessionMusicTrack]);

  const handleToggleAudio = useCallback(() => {
    const next = computeChannelStateAfterToggleMute({
      volumePct: audioVolumePct,
      muted: soundEngine.muted,
      lastNonZeroPct: lastNonZeroSfxPctRef.current,
    });
    lastNonZeroSfxPctRef.current = next.lastNonZeroPct;
    soundEngine.setSfxVolume(next.volumePct / 100);
    soundEngine.muted = next.muted;
    setAudioVolumePct(next.volumePct);
    setIsMuted(next.muted);
    try {
      window.localStorage.setItem('bb_sfx_muted_v1', next.muted ? '1' : '0');
      window.localStorage.setItem('bb_sfx_vol_pct_v1', String(next.volumePct));
    } catch {
      // ignore storage quota errors
    }
    if (!next.muted) {
      soundEngine.playUiClick();
    }
  }, [audioVolumePct]);

  const handleToggleMusic = useCallback(() => {
    const next = computeChannelStateAfterToggleMute({
      volumePct: musicVolumePct,
      muted: soundEngine.musicMuted,
      lastNonZeroPct: lastNonZeroMusicPctRef.current,
    });
    lastNonZeroMusicPctRef.current = next.lastNonZeroPct;
    soundEngine.setMusicVolume(next.volumePct / 100);
    soundEngine.musicMuted = next.muted;
    setMusicVolumePct(next.volumePct);
    setIsMusicMuted(next.muted);
    try {
      window.localStorage.setItem('bb_music_muted_v1', next.muted ? '1' : '0');
      window.localStorage.setItem('bb_music_vol_pct_v1', String(next.volumePct));
    } catch {
      // ignore storage quota errors
    }
    if (!next.muted) {
      soundEngine.startBgm(
        hudRef.current.worldMode === 'warzone' ? 'warzone' : 'city',
      );
    }
    soundEngine.playUiClick();
  }, [musicVolumePct]);

  const handleChangeVolumePct = useCallback((nextPct: number) => {
    const next = computeChannelStateAfterSliderChange(
      {
        volumePct: audioVolumePct,
        muted: soundEngine.muted,
        lastNonZeroPct: lastNonZeroSfxPctRef.current,
      },
      nextPct,
    );
    lastNonZeroSfxPctRef.current = next.lastNonZeroPct;
    setAudioVolumePct(next.volumePct);
    setIsMuted(next.muted);
    soundEngine.setSfxVolume(next.volumePct / 100);
    soundEngine.muted = next.muted;
    try {
      window.localStorage.setItem('bb_sfx_vol_pct_v1', String(next.volumePct));
      window.localStorage.setItem('bb_sfx_muted_v1', next.muted ? '1' : '0');
    } catch {
      // ignore storage quota errors
    }
  }, [audioVolumePct]);

  const handleChangeMusicVolumePct = useCallback((nextPct: number) => {
    const next = computeChannelStateAfterSliderChange(
      {
        volumePct: musicVolumePct,
        muted: soundEngine.musicMuted,
        lastNonZeroPct: lastNonZeroMusicPctRef.current,
      },
      nextPct,
    );
    lastNonZeroMusicPctRef.current = next.lastNonZeroPct;
    setMusicVolumePct(next.volumePct);
    setIsMusicMuted(next.muted);
    soundEngine.setMusicVolume(next.volumePct / 100);
    soundEngine.musicMuted = next.muted;
    if (!next.muted) {
      soundEngine.startBgm(
        hudRef.current.worldMode === 'warzone' ? 'warzone' : 'city',
      );
    }
    try {
      window.localStorage.setItem('bb_music_vol_pct_v1', String(next.volumePct));
      window.localStorage.setItem('bb_music_muted_v1', next.muted ? '1' : '0');
    } catch {
      // ignore storage quota errors
    }
  }, [musicVolumePct]);

  useEffect(() => {
    return subscribeWeatherDisplaySync((env) => {
      setTimeOfDayHours(env.timeOfDayHours);
      setLightingPreset((prev) => (prev === env.phase ? prev : env.phase));
    });
  }, []);

  const handleSelectTimePhase = useCallback((phase: LightingPresetKey) => {
    soundEngine.playUiClick();
    const nextHours = TIME_PHASE_DEFAULT_HOURS[phase];
    setLightingPreset(phase);
    setTimeOfDayHours(nextHours);
    setWeatherControlConfig({ phase, timeOfDayHours: nextHours });
  }, []);

  const handleCycleLighting = useCallback(() => {
    soundEngine.playUiClick();
    const idx = PRESET_ORDER.indexOf(lightingPreset);
    const next = PRESET_ORDER[(idx + 1) % PRESET_ORDER.length];
    const nextHours = TIME_PHASE_DEFAULT_HOURS[next];
    setLightingPreset(next);
    setTimeOfDayHours(nextHours);
    setWeatherControlConfig({ phase: next, timeOfDayHours: nextHours });
  }, [lightingPreset]);

  const handleChangeTimeOfDayHours = useCallback((hours: number) => {
    const norm = normalizeHours24(hours);
    const nextPhase = resolvePhaseFromHours(norm);
    setTimeOfDayHours(norm);
    setLightingPreset(nextPhase);
    setWeatherControlConfig({ timeOfDayHours: norm, phase: nextPhase });
  }, []);

  const handleSelectWeatherCondition = useCallback((condition: WeatherConditionKey) => {
    soundEngine.playUiClick();
    setWeatherCondition(condition);
    setWeatherControlConfig({ weatherCondition: condition });
  }, []);

  const handleSelectRainIntensityTier = useCallback((tier: RainIntensityTier) => {
    soundEngine.playUiClick();
    setRainIntensityTier(tier);
    setWeatherControlConfig({ rainIntensityTier: tier });
  }, []);

  const handleToggleAutoTimeCycle = useCallback((enabled: boolean) => {
    soundEngine.playUiClick();
    setAutoTimeCycle(enabled);
    setWeatherControlConfig({ autoCycleEnabled: enabled });
  }, []);

  const handleChangeCityLightsScale = useCallback((scale: number) => {
    const clamped = Math.max(
      CITY_LIGHTS_SCALE_BOUNDS.min,
      Math.min(CITY_LIGHTS_SCALE_BOUNDS.max, scale),
    );
    setCityLightsScale(clamped);
    setWeatherControlConfig({ cityLightsScale: clamped });
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
      setIsCitizenDialogueOpen(false);
      setIsSocialChatModalOpen(false);
      setActiveTeleportKioskModal('none');
      window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
      openMerchantInChatSession(loc);
    };
    const onOpenCitizenDialogue = (ev: Event) => {
      const detail = (ev as CustomEvent<{ citizenId?: string }>).detail;
      openCitizenDialogueForId(detail?.citizenId);
    };
    const onCloseCitizenDialogue = () => {
      setIsCitizenDialogueOpen(false);
    };
    const onOpenHouseInterior = (ev: Event) => {
      // The permanent Model Estate showcase plot is registered as claimed by a
      // system account, so claim status cannot decide this: the Arena reports
      // which plot's door/action triggered entry, and the model estate always
      // opens as the sample house.
      const entryDetail = (
        ev as CustomEvent<{
          team?: 'blue' | 'red' | null;
          commanderIdx?: number | null;
          houseStyle?: HouseArchitectureStyle | null;
          isSampleEntry?: boolean;
        }>
      ).detail;
      const isModelHousePlaqueEntry = Boolean(entryDetail?.isSampleEntry);
      const isSampleEntry =
        isModelHousePlaqueEntry ||
        Boolean(
          entryDetail?.team &&
            typeof entryDetail?.commanderIdx === 'number' &&
            isIntactModelEstateBasePlot(entryDetail.team, entryDetail.commanderIdx),
        );
      const requestedInteriorStyle = parseOptionalHouseArchitectureStyle(entryDetail?.houseStyle);
      const targetInteriorStyle: HouseArchitectureStyle = isModelHousePlaqueEntry
        ? requestedInteriorStyle ?? 'plaza_manor'
        : isSampleEntry
          ? 'japanese_pavilion'
          : requestedInteriorStyle ??
            ownedHouseStyleRef.current ??
            houseArchitectureStyleRef.current;
      lastEnteredHousePlotRef.current = {
        team: entryDetail?.team ?? null,
        plotIndex: typeof entryDetail?.commanderIdx === 'number' ? entryDetail.commanderIdx : null,
        viaStudio: false,
      };
      setIsKioskModalOpen(false);
      setIsSocialChatModalOpen(false);
      setIsDailyMissionsModalOpen(false);
      setIsInsideGlasshouseCafe(false);
      setIsCafeInteriorLoading(false);
      setIsInsideGrandCasino(false);
      setIsCasinoInteriorLoading(false);
      setIsInsideBeautySalon(false);
      setIsSalonInteriorLoading(false);
      setActiveTeleportKioskModal('none');
      window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
      setHouseEntryScanState('scanning');
      window.setTimeout(() => {
        soundEngine.playPickup();
        setHouseEntryScanState('verified');
        window.setTimeout(() => {
          setHouseEntryScanState('idle');
          setHouseArchitectureStyle(targetInteriorStyle);
          setIsInsidePrivateHouse(true);
          setIsSampleHouseView(isSampleEntry);
          setActiveSpecialModal('none');
        }, 600);
      }, 700);
    };
    const onExitHouseInterior = () => {
      lastEnteredHousePlotRef.current = null;
      setIsInsidePrivateHouse(false);
      setIsHouseFriendInviteOpen(false);
      setActiveSpecialModal('none');
      if (ownedHouseStyleRef.current) {
        setHouseArchitectureStyle(ownedHouseStyleRef.current);
      }
    };
    const onEnterGlasshouseCafe = () => {
      setIsKioskModalOpen(false);
      setIsSocialChatModalOpen(false);
      setIsPersonalWalletModalOpen(false);
      setIsProfileModalOpen(false);
      setIsDailyMissionsModalOpen(false);
      setIsGrandCasinoModalOpen(false);
      setIsInsideGrandCasino(false);
      setIsCasinoInteriorLoading(false);
      setIsInsideBeautySalon(false);
      setIsSalonInteriorLoading(false);
      setActiveTeleportKioskModal('none');
      window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
      setActiveSpecialModal('none');
      setIsInsidePrivateHouse(false);
      setActiveCafeModal('none');
      if (cafeLoadingTimeoutRef.current !== null) {
        window.clearTimeout(cafeLoadingTimeoutRef.current);
      }
      setIsCafeInteriorLoading(true);
      cafeLoadingTimeoutRef.current = window.setTimeout(() => {
        cafeLoadingTimeoutRef.current = null;
        setIsCafeInteriorLoading(false);
      }, 4000);
      setIsInsideGlasshouseCafe(true);
    };
    const onExitGlasshouseCafe = () => {
      if (cafeLoadingTimeoutRef.current !== null) {
        window.clearTimeout(cafeLoadingTimeoutRef.current);
        cafeLoadingTimeoutRef.current = null;
      }
      setIsCafeInteriorLoading(false);
      setIsInsideGlasshouseCafe(false);
      setActiveCafeModal('none');
      setUnifiedBottomDockMode((prev) => (prev === 'work_shift' ? 'none' : prev));
      setIsCafeRotaMenuExpanded(false);
      setCafeShiftState((prev) => ({ ...prev, isWorking: false, activeOrder: null }));
    };
    const onEnterGrandCasinoInterior = () => {
      if (hudRef.current.worldMode === 'warzone') return;
      setIsKioskModalOpen(false);
      setIsSocialChatModalOpen(false);
      setIsPersonalWalletModalOpen(false);
      setIsProfileModalOpen(false);
      setIsDailyMissionsModalOpen(false);
      setIsScooterShowroomModalOpen(false);
      setIsRealEstateCatalogModalOpen(false);
      setIsGrandCasinoModalOpen(false);
      setActiveTeleportKioskModal('none');
      window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
      setActiveSpecialModal('none');
      setIsInsidePrivateHouse(false);
      setIsInsideGlasshouseCafe(false);
      setIsCafeInteriorLoading(false);
      setIsInsideBeautySalon(false);
      setIsSalonInteriorLoading(false);
      setActiveCafeModal('none');
      if (casinoLoadingTimeoutRef.current !== null) {
        window.clearTimeout(casinoLoadingTimeoutRef.current);
      }
      setIsCasinoInteriorLoading(true);
      casinoLoadingTimeoutRef.current = window.setTimeout(() => {
        casinoLoadingTimeoutRef.current = null;
        setIsCasinoInteriorLoading(false);
      }, 4000);
      setIsInsideGrandCasino(true);
    };
    const onExitGrandCasinoInterior = () => {
      if (casinoLoadingTimeoutRef.current !== null) {
        window.clearTimeout(casinoLoadingTimeoutRef.current);
        casinoLoadingTimeoutRef.current = null;
      }
      setIsCasinoInteriorLoading(false);
      setIsInsideGrandCasino(false);
      setIsGrandCasinoModalOpen(false);
    };
    const onEnterBeautySalonInterior = () => {
      if (hudRef.current.worldMode === 'warzone') return;
      setIsKioskModalOpen(false);
      setIsSocialChatModalOpen(false);
      setIsPersonalWalletModalOpen(false);
      setIsProfileModalOpen(false);
      setIsDailyMissionsModalOpen(false);
      setIsScooterShowroomModalOpen(false);
      setIsRealEstateCatalogModalOpen(false);
      setIsGrandCasinoModalOpen(false);
      setActiveTeleportKioskModal('none');
      window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
      setActiveSpecialModal('none');
      setIsInsidePrivateHouse(false);
      setIsInsideGlasshouseCafe(false);
      setIsCafeInteriorLoading(false);
      setIsInsideGrandCasino(false);
      setIsCasinoInteriorLoading(false);
      setActiveCafeModal('none');
      if (salonLoadingTimeoutRef.current !== null) {
        window.clearTimeout(salonLoadingTimeoutRef.current);
      }
      setIsSalonInteriorLoading(true);
      salonLoadingTimeoutRef.current = window.setTimeout(() => {
        salonLoadingTimeoutRef.current = null;
        setIsSalonInteriorLoading(false);
      }, 4000);
      setIsInsideBeautySalon(true);
    };
    const onExitBeautySalonInterior = () => {
      if (salonLoadingTimeoutRef.current !== null) {
        window.clearTimeout(salonLoadingTimeoutRef.current);
        salonLoadingTimeoutRef.current = null;
      }
      setIsSalonInteriorLoading(false);
      setIsInsideBeautySalon(false);
    };
    const onStartCafeWorkShiftEvent = () => {
      window.dispatchEvent(new CustomEvent('app-cafe-action', { detail: 'start_shift' }));
    };
    const onOpenCafeOrderModal = () => {
      setIsCafeRotaMenuExpanded(false);
      setActiveCafeModal('order');
    };
    const onOpenCafeAtmModal = () => {
      setIsCafeRotaMenuExpanded(false);
      setActiveCafeModal('atm');
    };
    const onOpenCafeArcadeSlotModal = () => {
      setIsCafeRotaMenuExpanded(false);
      setActiveCafeModal('arcade_slot');
    };
    const onOpenCafePrepModal = (e: Event) => {
      const cat = (e as CustomEvent<{ category?: 'pastry' | 'drink' }>).detail?.category;
      setIsCafeRotaMenuExpanded(false);
      setIsCafeOrderSlideBannerVisible(false);
      setActiveCafeModal(cat === 'pastry' ? 'prep_pastry' : 'prep_drink');
    };
    const onUnifiedBottomDockChange = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          mode?: UnifiedBottomDockActionMode;
          entity?: NearbyEntityUser | null;
        }>
      ).detail;
      const mode = detail?.mode ?? 'none';
      const nextEntity = mode === 'nearby_entity' ? detail?.entity ?? null : null;
      const nextId = nextEntity ? String(nextEntity.id) : null;
      const isSameEntity =
        nextId !== null && lastNearbyDockEntityIdRef.current === nextId;
      lastNearbyDockEntityIdRef.current = nextId;
      setUnifiedBottomDockMode(mode);
      setNearbyDockEntity(nextEntity);
      if (mode !== 'work_shift') {
        setIsCafeRotaMenuExpanded(false);
      }
      if (mode !== 'nearby_entity' || !isSameEntity) {
        setIsTargetMenuExpanded(false);
      }
    };
    const onCafeRotaProximityChange = (e: Event) => {
      const near = Boolean((e as CustomEvent<{ near?: boolean }>).detail?.near);
      setUnifiedBottomDockMode((prev) => {
        if (near) return 'work_shift';
        return prev === 'work_shift' ? 'none' : prev;
      });
      if (!near) {
        setIsCafeRotaMenuExpanded(false);
      }
    };
    const onToggleCafeRotaDockMenu = () => {
      setUnifiedBottomDockMode('work_shift');
      setIsCafeRotaMenuExpanded((prev) => !prev);
    };
    const onStopCafeWorkShiftEvent = () => {
      window.dispatchEvent(new CustomEvent('app-cafe-action', { detail: 'stop_shift' }));
    };
    const onServeCafeActiveOrderEvent = () => {
      window.dispatchEvent(new CustomEvent('app-cafe-action', { detail: 'serve_order' }));
    };
    const onOpenCharacterProfile = (e: Event) => {
      const customEv = e as CustomEvent<{ user: NearbyEntityUser }>;
      if (customEv.detail?.user) {
        setIsKioskModalOpen(false);
        setIsCitizenDialogueOpen(false);
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
        setIsCitizenDialogueOpen(false);
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
        setIsCitizenDialogueOpen(false);
        setActiveSpecialModal('none');
        setIsSocialChatModalOpen(false);
        setActiveTeleportKioskModal(resolvedStationId);
      }
    };
    const onCloseTeleportKioskModal = () => {
      setActiveTeleportKioskModal('none');
    };
    const onOpenScooterShowroomModal = () => {
      if (hudRef.current.worldMode === 'warzone') return;
      setIsKioskModalOpen(false);
      setIsCitizenDialogueOpen(false);
      setIsProfileModalOpen(false);
      setIsPersonalWalletModalOpen(false);
      setIsPersonalBagModalOpen(false);
      setIsDailyMissionsModalOpen(false);
      setIsSocialChatModalOpen(false);
      setIsFashionBoutiqueModalOpen(false);
      setIsRealEstateCatalogModalOpen(false);
      setActiveSpecialModal('none');
      setActiveTeleportKioskModal('none');
      setIsScooterShowroomModalOpen(true);
    };
    const onCloseScooterShowroomModal = () => {
      setIsScooterShowroomModalOpen(false);
    };
    const onOpenFashionBoutiqueModal = () => {
      if (hudRef.current.worldMode === 'warzone') return;
      setIsKioskModalOpen(false);
      setIsCitizenDialogueOpen(false);
      setIsProfileModalOpen(false);
      setIsPersonalWalletModalOpen(false);
      setIsPersonalBagModalOpen(false);
      setIsDailyMissionsModalOpen(false);
      setIsSocialChatModalOpen(false);
      setIsScooterShowroomModalOpen(false);
      setIsRealEstateCatalogModalOpen(false);
      setIsGrandCasinoModalOpen(false);
      setActiveSpecialModal('none');
      setActiveTeleportKioskModal('none');
      setIsFashionBoutiqueModalOpen(true);
    };
    const onCloseFashionBoutiqueModal = () => {
      setIsFashionBoutiqueModalOpen(false);
    };
    const onOpenRealEstateCatalogModal = (e: Event) => {
      if (hudRef.current.worldMode === 'warzone') return;
      const tab = (e as CustomEvent<{ tab?: RealEstateCatalogTabId }>).detail?.tab;
      setRealEstateCatalogTab(tab === 'furniture' || tab === 'market' ? tab : 'house');
      setIsKioskModalOpen(false);
      setIsCitizenDialogueOpen(false);
      setIsProfileModalOpen(false);
      setIsPersonalWalletModalOpen(false);
      setIsPersonalBagModalOpen(false);
      setIsDailyMissionsModalOpen(false);
      setIsSocialChatModalOpen(false);
      setIsScooterShowroomModalOpen(false);
      setIsFashionBoutiqueModalOpen(false);
      setActiveSpecialModal('none');
      setActiveTeleportKioskModal('none');
      setIsRealEstateCatalogModalOpen(true);
    };
    const onCloseRealEstateCatalogModal = () => {
      setIsRealEstateCatalogModalOpen(false);
    };
    const onOpenGrandCasinoModal = (e: Event) => {
      if (hudRef.current.worldMode === 'warzone') return;
      const evDetail = (
        e as CustomEvent<{ tab?: CasinoTab; slotVariant?: CasinoSlotGameVariant }>
      ).detail;
      const requestedTab = evDetail?.tab;
      if (
        requestedTab === 'slots' ||
        requestedTab === 'roulette' ||
        requestedTab === 'blackjack' ||
        requestedTab === 'cashier' ||
        requestedTab === 'bar'
      ) {
        setGrandCasinoInitialTab(requestedTab);
      }
      const reqVariant = evDetail?.slotVariant;
      if (
        reqVariant === 'lucky_draw' ||
        reqVariant === 'classic_reels' ||
        reqVariant === 'multi_line_3x3' ||
        reqVariant === 'fortune_wheel'
      ) {
        setGrandCasinoSlotVariant(reqVariant);
      }
      setIsKioskModalOpen(false);
      setIsCitizenDialogueOpen(false);
      setIsProfileModalOpen(false);
      setIsPersonalWalletModalOpen(false);
      setIsPersonalBagModalOpen(false);
      setIsDailyMissionsModalOpen(false);
      setIsSocialChatModalOpen(false);
      setIsScooterShowroomModalOpen(false);
      setIsFashionBoutiqueModalOpen(false);
      setIsRealEstateCatalogModalOpen(false);
      setActiveSpecialModal('none');
      setActiveTeleportKioskModal('none');
      setIsGrandCasinoModalOpen(true);
    };
    const onCloseGrandCasinoModal = () => {
      setIsGrandCasinoModalOpen(false);
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
        // Mission guide leg 2: the tram reached the mission's station, so the
        // waypoint switches from the teleport kiosk to the final target.
        const guide = missionGuideRef.current;
        if (
          guide &&
          guide.stage === 'to_kiosk' &&
          guide.stationId &&
          detail.destinationStationId === guide.stationId
        ) {
          const nextGuide = { ...guide, stage: 'direct' as const };
          missionGuideRef.current = nextGuide;
          setMissionGuide(nextGuide);
          setMissionGuideDistanceM(null);
          window.dispatchEvent(
            new CustomEvent('set-tutorial-waypoint', {
              detail: {
                target: 'coord',
                x: guide.finalX,
                z: guide.finalZ,
                color: '#22ff5e',
              },
            }),
          );
        }
      }
    };
    window.addEventListener('toggle-kiosk-ui', onToggleKiosk);
    window.addEventListener('close-kiosk-ui', onCloseKiosk);
    window.addEventListener('open-npc-merchant-ui', onOpenNpcMerchant);
    window.addEventListener('open-citizen-dialogue-ui', onOpenCitizenDialogue);
    window.addEventListener('close-citizen-dialogue-ui', onCloseCitizenDialogue);
    window.addEventListener('open-house-interior-ui', onOpenHouseInterior);
    window.addEventListener('exit-house-interior-ui', onExitHouseInterior);
    const onCafeInteriorReady = () => {
      if (cafeLoadingTimeoutRef.current !== null) {
        window.clearTimeout(cafeLoadingTimeoutRef.current);
        cafeLoadingTimeoutRef.current = null;
      }
      setIsCafeInteriorLoading(false);
    };
    const onCasinoInteriorReady = () => {
      if (casinoLoadingTimeoutRef.current !== null) {
        window.clearTimeout(casinoLoadingTimeoutRef.current);
        casinoLoadingTimeoutRef.current = null;
      }
      setIsCasinoInteriorLoading(false);
    };
    const onSalonInteriorReady = () => {
      if (salonLoadingTimeoutRef.current !== null) {
        window.clearTimeout(salonLoadingTimeoutRef.current);
        salonLoadingTimeoutRef.current = null;
      }
      setIsSalonInteriorLoading(false);
    };
    window.addEventListener('enter-glasshouse-cafe', onEnterGlasshouseCafe);
    window.addEventListener('exit-glasshouse-cafe', onExitGlasshouseCafe);
    window.addEventListener('cafe-interior-ready', onCafeInteriorReady);
    window.addEventListener('enter-grand-casino-interior', onEnterGrandCasinoInterior);
    window.addEventListener('exit-grand-casino-interior', onExitGrandCasinoInterior);
    window.addEventListener('casino-interior-ready', onCasinoInteriorReady);
    window.addEventListener('enter-beauty-salon-interior', onEnterBeautySalonInterior);
    window.addEventListener('exit-beauty-salon-interior', onExitBeautySalonInterior);
    window.addEventListener('beauty-salon-interior-ready', onSalonInteriorReady);
    window.addEventListener('open-cafe-order-modal', onOpenCafeOrderModal);
    window.addEventListener('open-cafe-atm-modal', onOpenCafeAtmModal);
    window.addEventListener('open-cafe-arcade-slot-modal', onOpenCafeArcadeSlotModal);
    window.addEventListener('open-cafe-prep-modal', onOpenCafePrepModal);
    window.addEventListener('unified-bottom-dock-change', onUnifiedBottomDockChange);
    window.addEventListener('cafe-rota-proximity-change', onCafeRotaProximityChange);
    window.addEventListener('toggle-cafe-rota-dock-menu', onToggleCafeRotaDockMenu);
    window.addEventListener('start-cafe-work-shift', onStartCafeWorkShiftEvent);
    window.addEventListener('stop-cafe-work-shift', onStopCafeWorkShiftEvent);
    window.addEventListener('serve-cafe-active-order', onServeCafeActiveOrderEvent);
    window.addEventListener('open-character-profile-modal', onOpenCharacterProfile);
    window.addEventListener('close-character-profile-modal', onCloseCharacterProfile);
    window.addEventListener('open-social-chat-whisper', onOpenSocialChatWhisper);
    window.addEventListener('character-selected', onCharacterSelected);
    window.addEventListener('character-deselected', onCharacterDeselected);
    window.addEventListener('open-teleport-kiosk-modal', onOpenTeleportKioskModal);
    window.addEventListener('close-teleport-kiosk-modal', onCloseTeleportKioskModal);
    window.addEventListener('open-scooter-showroom-modal', onOpenScooterShowroomModal);
    window.addEventListener('close-scooter-showroom-modal', onCloseScooterShowroomModal);
    window.addEventListener('open-fashion-boutique-modal', onOpenFashionBoutiqueModal);
    window.addEventListener('close-fashion-boutique-modal', onCloseFashionBoutiqueModal);
    window.addEventListener('open-realestate-catalog-modal', onOpenRealEstateCatalogModal);
    window.addEventListener('close-realestate-catalog-modal', onCloseRealEstateCatalogModal);
    window.addEventListener('open-grand-casino-modal', onOpenGrandCasinoModal);
    window.addEventListener('close-grand-casino-modal', onCloseGrandCasinoModal);
    window.addEventListener('city-tram-ride-progress', onCityTramRideProgress);
    window.addEventListener('city-tram-ride-complete', onCityTramRideComplete);
    const onScooterDismounted = () => setEquippedScooterKind(null);
    const onScooterMounted = (e: Event) => {
      const kind = (e as CustomEvent<{ kind?: UrbanScooterKind }>).detail?.kind;
      if (kind === 'electric_scooter_bike' || kind === 'push_kick_scooter') {
        setEquippedScooterKind(kind);
        setPreferredScooterKind(kind);
        try {
          window.localStorage.setItem('bb_preferred_scooter_kind_v1', kind);
        } catch {
          // ignore storage errors
        }
      }
    };
    window.addEventListener('scooter-dismounted', onScooterDismounted);
    window.addEventListener('scooter-mounted', onScooterMounted);
    return () => {
      window.removeEventListener('toggle-kiosk-ui', onToggleKiosk);
      window.removeEventListener('close-kiosk-ui', onCloseKiosk);
      window.removeEventListener('open-npc-merchant-ui', onOpenNpcMerchant);
      window.removeEventListener('open-citizen-dialogue-ui', onOpenCitizenDialogue);
      window.removeEventListener('close-citizen-dialogue-ui', onCloseCitizenDialogue);
      window.removeEventListener('open-house-interior-ui', onOpenHouseInterior);
      window.removeEventListener('exit-house-interior-ui', onExitHouseInterior);
      if (cafeLoadingTimeoutRef.current !== null) {
        window.clearTimeout(cafeLoadingTimeoutRef.current);
        cafeLoadingTimeoutRef.current = null;
      }
      if (casinoLoadingTimeoutRef.current !== null) {
        window.clearTimeout(casinoLoadingTimeoutRef.current);
        casinoLoadingTimeoutRef.current = null;
      }
      if (salonLoadingTimeoutRef.current !== null) {
        window.clearTimeout(salonLoadingTimeoutRef.current);
        salonLoadingTimeoutRef.current = null;
      }
      window.removeEventListener('enter-glasshouse-cafe', onEnterGlasshouseCafe);
      window.removeEventListener('exit-glasshouse-cafe', onExitGlasshouseCafe);
      window.removeEventListener('cafe-interior-ready', onCafeInteriorReady);
      window.removeEventListener('enter-grand-casino-interior', onEnterGrandCasinoInterior);
      window.removeEventListener('exit-grand-casino-interior', onExitGrandCasinoInterior);
      window.removeEventListener('casino-interior-ready', onCasinoInteriorReady);
      window.removeEventListener('enter-beauty-salon-interior', onEnterBeautySalonInterior);
      window.removeEventListener('exit-beauty-salon-interior', onExitBeautySalonInterior);
      window.removeEventListener('beauty-salon-interior-ready', onSalonInteriorReady);
      window.removeEventListener('open-cafe-order-modal', onOpenCafeOrderModal);
      window.removeEventListener('open-cafe-atm-modal', onOpenCafeAtmModal);
      window.removeEventListener('open-cafe-arcade-slot-modal', onOpenCafeArcadeSlotModal);
      window.removeEventListener('open-cafe-prep-modal', onOpenCafePrepModal);
      window.removeEventListener('unified-bottom-dock-change', onUnifiedBottomDockChange);
      window.removeEventListener('cafe-rota-proximity-change', onCafeRotaProximityChange);
      window.removeEventListener('toggle-cafe-rota-dock-menu', onToggleCafeRotaDockMenu);
      window.removeEventListener('start-cafe-work-shift', onStartCafeWorkShiftEvent);
      window.removeEventListener('stop-cafe-work-shift', onStopCafeWorkShiftEvent);
      window.removeEventListener('serve-cafe-active-order', onServeCafeActiveOrderEvent);
      window.removeEventListener('open-character-profile-modal', onOpenCharacterProfile);
      window.removeEventListener('close-character-profile-modal', onCloseCharacterProfile);
      window.removeEventListener('open-social-chat-whisper', onOpenSocialChatWhisper);
      window.removeEventListener('character-selected', onCharacterSelected);
      window.removeEventListener('character-deselected', onCharacterDeselected);
      window.removeEventListener('open-teleport-kiosk-modal', onOpenTeleportKioskModal);
      window.removeEventListener('close-teleport-kiosk-modal', onCloseTeleportKioskModal);
      window.removeEventListener('open-scooter-showroom-modal', onOpenScooterShowroomModal);
      window.removeEventListener('close-scooter-showroom-modal', onCloseScooterShowroomModal);
      window.removeEventListener('open-fashion-boutique-modal', onOpenFashionBoutiqueModal);
      window.removeEventListener('close-fashion-boutique-modal', onCloseFashionBoutiqueModal);
      window.removeEventListener('open-realestate-catalog-modal', onOpenRealEstateCatalogModal);
      window.removeEventListener('close-realestate-catalog-modal', onCloseRealEstateCatalogModal);
      window.removeEventListener('open-grand-casino-modal', onOpenGrandCasinoModal);
      window.removeEventListener('close-grand-casino-modal', onCloseGrandCasinoModal);
      window.removeEventListener('city-tram-ride-progress', onCityTramRideProgress);
      window.removeEventListener('city-tram-ride-complete', onCityTramRideComplete);
      window.removeEventListener('scooter-dismounted', onScooterDismounted);
      window.removeEventListener('scooter-mounted', onScooterMounted);
    };
  }, [openMerchantInChatSession, openCitizenDialogueForId]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('set-tutorial-waypoint', {
        detail: { target: tutorialStage === 'go_to_hana' ? 'hana' : 'none' },
      }),
    );
  }, [tutorialStage]);

  // Mission guide: the 3D chevron waypoint (tutorial waypoint `coord` mode)
  // reports distance and arrival from the world renderer.
  useEffect(() => {
    const onGuideProgress = (ev: Event) => {
      const detail = (ev as CustomEvent<{ distanceM?: number }>).detail;
      if (typeof detail?.distanceM === 'number') {
        setMissionGuideDistanceM(detail.distanceM);
      }
    };
    const onGuideArrived = () => {
      clearMissionGuide();
      soundEngine.playUiClick();
    };
    window.addEventListener('mission-guide-progress', onGuideProgress);
    window.addEventListener('mission-guide-arrived', onGuideArrived);
    const onClickToWalkSync = (ev: Event) => {
      const detail = (ev as CustomEvent<ClickToWalkHudSummary>).detail;
      if (detail) setClickToWalkSync(detail);
    };
    window.addEventListener('click-to-walk-sync', onClickToWalkSync);
    return () => {
      window.removeEventListener('mission-guide-progress', onGuideProgress);
      window.removeEventListener('mission-guide-arrived', onGuideArrived);
      window.removeEventListener('click-to-walk-sync', onClickToWalkSync);
    };
  }, []);

  // Clear the mission guide as soon as its mission is completed.
  useEffect(() => {
    if (!missionGuide) return;
    const def = DAILY_MISSIONS_CATALOG.find((m) => m.id === missionGuide.missionId);
    const entry = dailyMissionsState.missions[missionGuide.missionId];
    if (def && entry && entry.progress >= def.targetCount) {
      window.dispatchEvent(
        new CustomEvent('set-tutorial-waypoint', { detail: { target: 'none' } }),
      );
      clearMissionGuide();
    }
  }, [dailyMissionsState, missionGuide]);

  // Unread letters feed the WORLD chat button badge alongside unread private
  // messages. Refreshed on account change, when the chat modal closes
  // (letters may have been read), and once a minute.
  const letterAccount = hud.nearWalletId || playerUid || null;
  useEffect(() => {
    if (!letterAccount) {
      setUnreadLetterCount(0);
      return;
    }
    let cancelled = false;
    const loadUnreadLetters = async () => {
      const rows = await fetchLettersForAccount(letterAccount, 50);
      if (!cancelled) {
        setUnreadLetterCount(rows.filter((row) => !row.isRead).length);
      }
    };
    void loadUnreadLetters();
    const intervalId = window.setInterval(loadUnreadLetters, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [letterAccount, isSocialChatModalOpen]);

  useEffect(() => {
    if (
      tutorialStage === 'go_to_hana' &&
      activeSpecialModal === 'npc_merchant' &&
      merchantLocation === 'lobby_cafe'
    ) {
      setTutorialStage('none');
    }
  }, [tutorialStage, activeSpecialModal, merchantLocation]);

  // Kai phone contact: Kai is reachable through the player's phone (social
  // modal), so the chat-haggling feature can be discovered without walking to
  // East Beach first. He also calls the player once — the first time they
  // have a fish to sell. Both flags persist per device.
  const [kaiPhoneState, setKaiPhoneState] = useState<{ called: boolean; met: boolean }>(() => {
    try {
      const raw = window.localStorage.getItem('bb_kai_phone_v1');
      if (raw) {
        const parsed = JSON.parse(raw) as { called?: boolean; met?: boolean };
        return { called: Boolean(parsed.called), met: Boolean(parsed.met) };
      }
    } catch {
      // ignore
    }
    return { called: false, met: false };
  });
  const [kaiIncomingCall, setKaiIncomingCall] = useState(false);
  const persistKaiPhoneState = (next: { called: boolean; met: boolean }) => {
    setKaiPhoneState(next);
    try {
      window.localStorage.setItem('bb_kai_phone_v1', JSON.stringify(next));
    } catch {
      // ignore
    }
  };
  const openKaiChatFromPhone = useCallback(() => {
    soundEngine.stopPhoneRing();
    setKaiIncomingCall(false);
    setIsKioskModalOpen(false);
    setIsSocialChatModalOpen(false);
    setIsDailyMissionsModalOpen(false);
    setActiveTeleportKioskModal('none');
    window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
    openMerchantInChatSession('beach_house');
  }, [openMerchantInChatSession]);

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

  const grantPlayerXp = useCallback((xpDelta: number, label: string) => {
    setPlayerTotalXp((prevXp) => {
      const res = applyPlayerXpGain(prevXp, xpDelta);
      try {
        window.localStorage.setItem('bb_player_total_xp_v1', String(res.progress.totalXp));
      } catch {
        // ignore
      }
      if (xpBannerTimerRef.current !== null) {
        window.clearTimeout(xpBannerTimerRef.current);
      }
      setXpCelebrationBanner({
        id: Date.now(),
        xpGained: res.xpAdded,
        leveledUpTo: res.leveledUp ? res.newLevel : null,
        label,
      });
      xpBannerTimerRef.current = window.setTimeout(() => {
        setXpCelebrationBanner(null);
      }, 3200);
      return res.progress.totalXp;
    });
  }, []);

  const saveDailyMissions = useCallback((nextState: DailyMissionsState) => {
    dailyMissionsStateRef.current = nextState;
    setDailyMissionsState(nextState);
    try {
      window.localStorage.setItem(
        getDailyMissionsStorageKey(dailyMissionsAccountRef.current),
        JSON.stringify(nextState),
      );
    } catch {
      // ignore storage unavailability
    }
  }, []);

  const completeDailyMission = useCallback(
    (missionId: DailyMissionId) => {
      const todayKey = getLocalDailyDateKey();
      const res = recordDailyMissionProgress(
        dailyMissionsStateRef.current,
        missionId,
        1,
        todayKey,
      );
      if (!res.changed) return;
      saveDailyMissions(res.nextState);
      if (res.newlyCompleted) {
        soundEngine.playPickup();
        dispatchBuddyAction(`socialTalk:Daily Mission Ready: ${res.definition.title}!`);
      }
    },
    [dispatchBuddyAction, saveDailyMissions],
  );

  const handleClaimDailyMission = useCallback(
    (missionId: DailyMissionId) => {
      const todayKey = getLocalDailyDateKey();
      const res = claimDailyMissionReward(dailyMissionsStateRef.current, missionId, todayKey);
      if (!res.claimed) return;
      soundEngine.playPowerCore();
      saveDailyMissions(res.nextState);
      dispatchBuddyAction(`adjustPlayerLul:${res.rewardLul}`);
      grantPlayerXp(res.rewardXp, `${res.definition.title} (+${res.rewardLul} LUL)`);
      dispatchBuddyAction(
        `socialTalk:Claimed ${res.definition.title}! +${res.rewardLul} LUL & +${res.rewardXp} XP`,
      );
    },
    [dispatchBuddyAction, grantPlayerXp, saveDailyMissions],
  );

  const handleClaimDailyAllClearBonus = useCallback(() => {
    const todayKey = getLocalDailyDateKey();
    const res = claimDailyAllClearBonus(dailyMissionsStateRef.current, todayKey);
    if (!res.claimed) return;
    soundEngine.playPowerCore();
    saveDailyMissions(res.nextState);
    dispatchBuddyAction(`adjustPlayerLul:${res.rewardLul}`);
    grantPlayerXp(res.rewardXp, `ALL-CLEAR DAILY BONUS (+${res.rewardLul} LUL)`);
    dispatchBuddyAction(
      `socialTalk:Claimed Daily All-Clear Bonus! +${res.rewardLul} LUL & +${res.rewardXp} XP`,
    );
  }, [dispatchBuddyAction, grantPlayerXp, saveDailyMissions]);

  const prevCafeOrdersServedRef = useRef<number>(cafeShiftState.totalOrdersServedEver);
  useEffect(() => {
    if (cafeShiftState.totalOrdersServedEver > prevCafeOrdersServedRef.current) {
      completeDailyMission('work_cafe');
    }
    prevCafeOrdersServedRef.current = cafeShiftState.totalOrdersServedEver;
  }, [cafeShiftState.totalOrdersServedEver, completeDailyMission]);

  // claim_plot_house: snapshot whether the account already owned a plot when
  // the session started, then complete the mission when a NEW claim appears
  // in the HUD state (plot owners from earlier sessions do not re-complete).
  const plotMissionBaselineRef = useRef<{
    account: string;
    checked: boolean;
    hadPlot: boolean;
  }>({ account: '', checked: false, hadPlot: false });
  const plotMissionAccount = hud.nearWalletId || playerUid || '';
  useEffect(() => {
    const account = plotMissionAccount.trim().toLowerCase();
    if (!account) return;
    if (plotMissionBaselineRef.current.account === account) return;
    plotMissionBaselineRef.current = { account, checked: false, hadPlot: false };
    let cancelled = false;
    void fetchBasePlotsFromSupabase().then((plots) => {
      if (cancelled) return;
      const hadPlot = plots.some(
        (p) =>
          p.is_claimed &&
          (p.claimed_by_near_account || '').toLowerCase() === account,
      );
      plotMissionBaselineRef.current = { account, checked: true, hadPlot };
      // The claim may have landed while this snapshot was loading.
      if (!hadPlot && hudRef.current.nearClaimedPlotIndex != null) {
        plotMissionBaselineRef.current = { account, checked: true, hadPlot: true };
        completeDailyMission('claim_plot_house');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [plotMissionAccount, completeDailyMission]);

  useEffect(() => {
    const baseline = plotMissionBaselineRef.current;
    if (!baseline.checked || baseline.hadPlot) return;
    if (!hud.nearClaimedTeam || hud.nearClaimedPlotIndex == null) return;
    plotMissionBaselineRef.current = { ...baseline, hadPlot: true };
    completeDailyMission('claim_plot_house');
  }, [hud.nearClaimedTeam, hud.nearClaimedPlotIndex, completeDailyMission]);

  // buy_house completes as soon as deed ownership is verified on-chain
  // (covers both a fresh purchase and long-time deed holders).
  useEffect(() => {
    if (hasHouseOwnership) {
      completeDailyMission('buy_house');
    }
  }, [hasHouseOwnership, completeDailyMission]);

  // buy_scooter completes when the account owns any scooter (purchase or
  // chain hydration of ownedScooterIds).
  useEffect(() => {
    if (ownedScooterIds.length > 0) {
      completeDailyMission('buy_scooter');
    }
  }, [ownedScooterIds, completeDailyMission]);

  useEffect(() => {
    if (!isInsidePrivateHouse || isSampleHouseView) return;
    if (!hud.nearClaimedTeam || hud.nearClaimedPlotIndex == null) return;
    const entered = lastEnteredHousePlotRef.current;
    const matchesClaimedPlot =
      !entered ||
      entered.viaStudio ||
      (entered.team === hud.nearClaimedTeam && entered.plotIndex === hud.nearClaimedPlotIndex);
    if (matchesClaimedPlot) {
      completeDailyMission('visit_claimed_house');
    }
  }, [
    isInsidePrivateHouse,
    isSampleHouseView,
    hud.nearClaimedTeam,
    hud.nearClaimedPlotIndex,
    completeDailyMission,
  ]);

  useEffect(() => {
    if (hud.worldMode === 'warzone') {
      setIsDailyMissionsModalOpen(false);
      setIsGrandCasinoModalOpen(false);
      setIsInsideGrandCasino(false);
      setIsCasinoInteriorLoading(false);
    }
  }, [hud.worldMode]);

  const handleStartCafeWorkShift = useCallback(() => {
    soundEngine.playUiConfirm();
    soundEngine.playPickup();
    setActiveCafeModal('none');
    setIsCafeRotaMenuExpanded(false);
    setCafeShiftState((prev) => {
      const res = joinCafeWorkShiftQueue(prev, playerDisplayName || 'YOU', Date.now());
      if (res.startedImmediately && res.nextState.activeOrder) {
        dispatchBuddyAction(
          `socialTalk:Started barista shift (3 serves)! Order: ${res.nextState.activeOrder.item.name}`,
        );
      } else if (!res.startedImmediately && res.queuePosition > 0) {
        dispatchBuddyAction(`socialTalk:Joined work shift queue #${res.queuePosition}!`);
      }
      return res.nextState;
    });
  }, [dispatchBuddyAction, playerDisplayName]);

  const handleLeaveCafeWorkShiftQueue = useCallback(() => {
    soundEngine.playUiClick();
    setCafeShiftState((prev) => leaveCafeWorkShiftQueue(prev));
    dispatchBuddyAction('socialTalk:Left the work shift queue.');
  }, [dispatchBuddyAction]);

  const handleToggleSimulatedCafeWorker = useCallback(() => {
    soundEngine.playUiClick();
    setCafeShiftState((prev) => toggleSimulatedOtherCafeWorker(prev, Date.now()));
  }, []);

  const handleStopCafeWorkShift = useCallback(() => {
    soundEngine.playUiClick();
    setIsCafeRotaMenuExpanded(false);
    setCafeShiftState((prev) => {
      const currentQueue = (prev.shiftQueue ?? []).filter((entry) => !entry.isSelf);
      const nextQueueWorker = currentQueue.length > 0 ? currentQueue[0] : null;
      const remainingQueue = currentQueue.length > 0 ? currentQueue.slice(1) : [];
      return {
        ...prev,
        isWorking: false,
        activeOrder: null,
        otherActiveWorker: nextQueueWorker
          ? {
              id: nextQueueWorker.id,
              name: nextQueueWorker.name,
              ordersServed: 0,
              maxOrders: prev.maxOrdersInShift,
            }
          : prev.otherActiveWorker ?? null,
        shiftQueue: remainingQueue,
      };
    });
    dispatchBuddyAction('socialTalk:Barista shift ended. Register again at the rota board!');
  }, [dispatchBuddyAction]);

  // While another worker holds the shift, their serves tick on a timer; when
  // they finish, a queued player is promoted into the apron automatically.
  useEffect(() => {
    if (!isInsideGlasshouseCafe || cafeShiftState.isWorking || !cafeShiftState.otherActiveWorker) {
      return;
    }
    const timer = window.setInterval(() => {
      setCafeShiftState((prev) => {
        const stepped = stepOtherActiveCafeWorkerServe(prev, Date.now());
        if (stepped.promotedSelfToWorking && stepped.nextState.activeOrder) {
          soundEngine.playPickup();
          setActiveCafeModal('none');
          setIsCafeRotaMenuExpanded(false);
          dispatchBuddyAction(
            `socialTalk:Work shift started! Order: ${stepped.nextState.activeOrder.item.name}`,
          );
        }
        return stepped.nextState;
      });
    }, 3800);
    return () => window.clearInterval(timer);
  }, [
    isInsideGlasshouseCafe,
    cafeShiftState.isWorking,
    cafeShiftState.otherActiveWorker,
    dispatchBuddyAction,
  ]);

  // A fresh order rings the bell, raises the slide banner + unread dot, and
  // restarts the 2-minute serve countdown.
  useEffect(() => {
    const activeOrderId = cafeShiftState.isWorking
      ? cafeShiftState.activeOrder?.orderId ?? null
      : null;
    if (!isInsideGlasshouseCafe || !activeOrderId) {
      setIsCafeOrderSlideBannerVisible(false);
      setHasUnreadCafeOrderNotif(false);
      setCafeShiftRemainingSec(120);
      setActiveCafeModal((prev) =>
        prev === 'order_notification' || prev === 'prep_pastry' || prev === 'prep_drink'
          ? 'none'
          : prev,
      );
      return;
    }
    setCafeShiftRemainingSec(120);
    setIsCafeOrderSlideBannerVisible(true);
    setHasUnreadCafeOrderNotif(true);
    soundEngine.playOrderBell();
    const hideTimer = window.setTimeout(() => {
      setIsCafeOrderSlideBannerVisible(false);
    }, 3600);
    return () => window.clearTimeout(hideTimer);
  }, [isInsideGlasshouseCafe, cafeShiftState.isWorking, cafeShiftState.activeOrder?.orderId]);

  // The 2-minute order countdown: expiry forfeits the shift.
  useEffect(() => {
    if (!isInsideGlasshouseCafe || !cafeShiftState.isWorking) {
      return;
    }
    const countdownTimer = window.setInterval(() => {
      setCafeShiftRemainingSec((prevSec) => {
        if (cafePrepStatusRef.current) {
          return prevSec;
        }
        if (prevSec <= 1) {
          soundEngine.playHit();
          setActiveCafeModal('none');
          handleStopCafeWorkShift();
          dispatchBuddyAction('socialTalk:2-minute timer expired! Shift forfeited.');
          return 120;
        }
        return prevSec - 1;
      });
    }, 1000);
    return () => window.clearInterval(countdownTimer);
  }, [isInsideGlasshouseCafe, cafeShiftState.isWorking, handleStopCafeWorkShift, dispatchBuddyAction]);

  const handleOpenCafeOrderNotificationModal = useCallback(() => {
    soundEngine.playUiClick();
    setIsCafeOrderSlideBannerVisible(false);
    setHasUnreadCafeOrderNotif(false);
    setIsCafeRotaMenuExpanded(false);
    setActiveCafeModal('order_notification');
  }, []);

  const handleServeActiveCafeOrder = useCallback(() => {
    setCafeShiftState((prev) => {
      const res = serveActiveCafeOrder(prev, Date.now());
      if (!res.served || !res.servedItem) return prev;
      soundEngine.playPowerCore();
      grantPlayerXp(
        res.xpGained,
        res.shiftCompleted ? `SHIFT COMPLETE!` : `${res.servedItem.name} SERVED`,
      );
      dispatchBuddyAction(
        res.shiftCompleted
          ? `Shift complete! +${res.xpGained} XP!`
          : `Served ${res.servedItem.name}!`,
      );
      return res.nextShiftState;
    });
  }, [dispatchBuddyAction, grantPlayerXp]);

  const handlePrepareCafeOrder = useCallback(
    (selectedItem: CafeMenuItemSpec): { ok: boolean; message: string } => {
      if (cafePrepStatusRef.current) {
        return { ok: false, message: 'Order sedang disiapkan...' };
      }
      const currentOrder = cafeShiftState.activeOrder;
      if (!cafeShiftState.isWorking || !currentOrder) {
        soundEngine.playHit();
        return { ok: false, message: 'No active customer order' };
      }
      if (selectedItem.id !== currentOrder.item.id) {
        soundEngine.playHit();
        return { ok: false, message: `Customer ordered ${currentOrder.item.name}` };
      }
      soundEngine.playUiConfirm();
      setActiveCafeModal('none');
      setCafePrepStatus({
        stage: 'preparing',
        itemName: selectedItem.name,
        category: selectedItem.category,
      });
      window.dispatchEvent(
        new CustomEvent('start-cafe-work-anim', {
          detail: {
            category: selectedItem.category,
            itemName: selectedItem.name,
          },
        }),
      );
      return { ok: true, message: 'Preparing order...' };
    },
    [cafeShiftState.isWorking, cafeShiftState.activeOrder],
  );

  useEffect(() => {
    const onCafeAnimStage = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          stage?: 'preparing' | 'moving' | 'serving' | 'idle';
          itemName?: string;
          category?: 'drink' | 'pastry';
        }>
      ).detail;
      if (!detail || detail.stage === 'idle') {
        setCafePrepStatus(null);
        return;
      }
      if (detail.stage === 'preparing' || detail.stage === 'moving' || detail.stage === 'serving') {
        const nextStage = detail.stage;
        setCafePrepStatus((prev) => ({
          stage: nextStage,
          itemName: detail.itemName || prev?.itemName || 'Order',
          category: detail.category ?? prev?.category ?? 'drink',
        }));
      }
    };
    const onCompleteCafeWorkOrder = () => {
      setCafePrepStatus(null);
      handleServeActiveCafeOrder();
    };
    const onCancelCafeWork = () => {
      setCafePrepStatus(null);
      window.dispatchEvent(new CustomEvent('cancel-cafe-work-anim'));
    };
    window.addEventListener('cafe-work-anim-stage', onCafeAnimStage);
    window.addEventListener('complete-cafe-work-order', onCompleteCafeWorkOrder);
    window.addEventListener('stop-cafe-work-shift', onCancelCafeWork);
    window.addEventListener('exit-glasshouse-cafe', onCancelCafeWork);
    return () => {
      window.removeEventListener('cafe-work-anim-stage', onCafeAnimStage);
      window.removeEventListener('complete-cafe-work-order', onCompleteCafeWorkOrder);
      window.removeEventListener('stop-cafe-work-shift', onCancelCafeWork);
      window.removeEventListener('exit-glasshouse-cafe', onCancelCafeWork);
    };
  }, [handleServeActiveCafeOrder]);

  useEffect(() => {
    if (
      cafePrepStatus &&
      (activeCafeModal === 'prep_drink' || activeCafeModal === 'prep_pastry')
    ) {
      setActiveCafeModal('none');
    }
  }, [cafePrepStatus, activeCafeModal]);

  useEffect(() => {
    if (!isInsideGlasshouseCafe || !cafeShiftState.isWorking) {
      setCafePrepStatus(null);
      window.dispatchEvent(new CustomEvent('cancel-cafe-work-anim'));
    }
  }, [isInsideGlasshouseCafe, cafeShiftState.isWorking]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('cafe-consume-state', {
        detail: { itemId: cafeConsumerState.activeItem?.id ?? null },
      }),
    );
  }, [cafeConsumerState.activeItem]);

  useEffect(() => {
    if (!cafeConsumerState.activeItem) return;
    const intervalId = window.setInterval(() => {
      const now = Date.now();
      setCafeConsumerTickMs(now);
      setCafeConsumerState((prev) => advanceCafeConsumerState(prev, now).nextState);
    }, 200);
    return () => window.clearInterval(intervalId);
  }, [cafeConsumerState.activeItem]);

  useEffect(() => {
    if (cafeShiftState.isWorking || hud.worldMode === 'warzone') {
      setCafeConsumerState((prev) => (prev.activeItem ? createInitialCafeConsumerState() : prev));
    }
  }, [cafeShiftState.isWorking, hud.worldMode]);

  const cafeConsumerSummary = getCafeConsumerRemainingSummary(
    cafeConsumerState,
    cafeConsumerTickMs,
  );

  const handlePurchaseCafeBatch = useCallback(
    (entries: ReadonlyArray<CafeBatchOrderEntry>): { ok: boolean; message: string } => {
      const now = Date.now();
      const res = purchaseCafeOrderBatch(
        entries,
        hudRef.current.gold,
        cafeConsumerStateRef.current,
        now,
      );
      if (!res.purchased) {
        soundEngine.playHit();
        if (res.reason === 'still_consuming') {
          const activeName = res.nextConsumerState.activeItem?.name ?? 'pesananmu';
          return {
            ok: false,
            message: `Habiskan ${activeName} di tangan dulu sebelum memesan lagi!`,
          };
        }
        if (res.reason === 'insufficient_lul') {
          return {
            ok: false,
            message: `Not enough LUL! Need ${res.totalPriceLul} LUL (work a shift or cash out at the ATM).`,
          };
        }
        return { ok: false, message: 'Pilih minimal 1 menu untuk dipesan.' };
      }

      soundEngine.playUiConfirm();
      soundEngine.playPickup();
      setCafeConsumerTickMs(now);
      setCafeConsumerState(res.nextConsumerState);
      dispatchBuddyAction(`adjustPlayerLul:${-res.totalPriceLul}`);
      setHud((prev) => ({ ...prev, gold: Math.max(0, prev.gold - res.totalPriceLul) }));
      const lulBuyerAccount = hudRef.current.nearWalletId || '';
      if (lulBuyerAccount) {
        void syncPlayerBalancesToSupabase({
          nearAccountId: lulBuyerAccount,
          lulBalance: Math.max(0, hudRef.current.gold - res.totalPriceLul),
          cyonBalance,
          respiteBalance,
        });
      }
      const orderTitle =
        res.items.length > 1
          ? `BATCH (${res.items.length} MENU)`
          : `ORDER ${res.items[0].name.toUpperCase()}`;
      grantPlayerXp(res.xpGained, orderTitle);
      const talkLabel =
        res.items.length > 1
          ? `Nikmati batch ${res.items.length} menu (${res.items[0].name}...) +${res.xpGained} XP!`
          : `Enjoying ${res.items[0].name} (+${res.xpGained} XP!)`;
      dispatchBuddyAction(`socialTalk:${talkLabel}`);
      return {
        ok: true,
        message:
          res.items.length > 1
            ? `Batch ${res.items.length} menu diterima! +${res.xpGained} XP`
            : `Ordered ${res.items[0].name}! +${res.xpGained} XP`,
      };
    },
    [dispatchBuddyAction, grantPlayerXp, cyonBalance, respiteBalance],
  );

  const handlePurchaseCafeItem = useCallback(
    (item: CafeMenuItemSpec): { ok: boolean; message: string } => {
      const checkLegacy = purchaseCafeMenuItem(item.id, hudRef.current.gold);
      if (!checkLegacy.item) return { ok: false, message: 'Item not found' };
      return handlePurchaseCafeBatch([{ itemId: item.id, quantity: 1 }]);
    },
    [handlePurchaseCafeBatch],
  );

  const handleCafeExchangeLulToCyonPackets = useCallback(
    (packets: number): { ok: boolean; message: string } => {
      const res = executeLulToCyonExchangePackets(marketState, hudRef.current.gold, cyonBalance, packets);
      if (!res.ok) {
        soundEngine.playHit();
        return { ok: false, message: res.message };
      }
      const lulSpent = Math.max(0, hudRef.current.gold - res.updatedLul);
      soundEngine.playPickup();
      dispatchBuddyAction(`adjustPlayerLul:${-lulSpent}`);
      setCyonBalance(res.updatedCyon);
      setMarketState(res.updatedState);
      const actorAccount = hudRef.current.nearWalletId || playerUid;
      // The merchant treasury is shared: its row is debited for every
      // exchange, including guests, or the same CYON could be farmed again
      // next session from a restored treasury.
      void syncNpcMerchantToSupabase({
        merchant_id: merchantLocation,
        cyon_treasury: res.updatedState.treasuryCyon,
        is_bankrupt: res.updatedState.isShopBroke,
        last_headline: res.updatedState.lastMarketHeadline,
      });
      if (actorAccount) {
        void logMarketTransactionToSupabase({
          merchant_id: merchantLocation,
          actor_near_account: actorAccount,
          action_type: 'exchange',
          currency: 'CYON',
          amount: res.updatedCyon - cyonBalance,
          unit_price: lulSpent,
          reasoning_summary: `Cafe ATM exchange: ${res.updatedState.lastMarketHeadline}`,
        });
        void syncPlayerBalancesToSupabase({
          nearAccountId: actorAccount,
          lulBalance: res.updatedLul,
          cyonBalance: res.updatedCyon,
          respiteBalance,
        });
      }
      return { ok: true, message: res.message };
    },
    [marketState, cyonBalance, merchantLocation, playerUid, respiteBalance, dispatchBuddyAction],
  );

  const handleArcadeSlotDebitStake = useCallback(
    (betLul: number): { ok: boolean; message: string } => {
      const safeBet = Math.max(0, Math.floor(betLul));
      if (safeBet < 2 || hudRef.current.gold < safeBet) {
        return { ok: false, message: `Need ${safeBet} LUL to spin.` };
      }
      const nextLul = Math.max(0, hudRef.current.gold - safeBet);
      dispatchBuddyAction(`adjustPlayerLul:${-safeBet}`);
      setHud((prev) => ({ ...prev, gold: nextLul }));
      const account = hudRef.current.nearWalletId || '';
      if (account) {
        void syncPlayerBalancesToSupabase({
          nearAccountId: account,
          lulBalance: nextLul,
          cyonBalance,
          respiteBalance,
        });
      }
      return { ok: true, message: `Staked ${safeBet} LUL` };
    },
    [dispatchBuddyAction, cyonBalance, respiteBalance],
  );

  const handleArcadeSlotSettleSpin = useCallback(
    (evaluation: ArcadeSlotEvaluation) => {
      if (evaluation.payoutLul > 0) {
        const nextLul = hudRef.current.gold + evaluation.payoutLul;
        dispatchBuddyAction(`adjustPlayerLul:${evaluation.payoutLul}`);
        setHud((prev) => ({ ...prev, gold: nextLul }));
        const account = hudRef.current.nearWalletId || '';
        if (account) {
          void syncPlayerBalancesToSupabase({
            nearAccountId: account,
            lulBalance: nextLul,
            cyonBalance,
            respiteBalance,
          });
        }
        if (evaluation.outcomeKind === 'jackpot' || evaluation.outcomeKind === 'triple') {
          dispatchBuddyAction(`socialTalk:${evaluation.headline}!`);
        }
      }
      if (evaluation.xpGained > 0) {
        grantPlayerXp(evaluation.xpGained, 'ARCADE SLOTS');
      }
    },
    [dispatchBuddyAction, grantPlayerXp, cyonBalance, respiteBalance],
  );

  const handleOrderCasinoLoungeDrink = useCallback(
    (drinkName: string, costLul: number, xpReward: number): { ok: boolean; message: string } => {
      const safeCost = Math.max(0, Math.floor(costLul));
      if (hudRef.current.gold < safeCost) {
        soundEngine.playHit();
        return {
          ok: false,
          message: `Need ${safeCost} LUL to order ${drinkName}.`,
        };
      }
      const nextLul = Math.max(0, hudRef.current.gold - safeCost);
      soundEngine.playUiConfirm();
      soundEngine.playPickup();
      dispatchBuddyAction(`adjustPlayerLul:${-safeCost}`);
      setHud((prev) => ({ ...prev, gold: nextLul }));
      const account = hudRef.current.nearWalletId || '';
      if (account) {
        void syncPlayerBalancesToSupabase({
          nearAccountId: account,
          lulBalance: nextLul,
          cyonBalance,
          respiteBalance,
        });
      }
      if (xpReward > 0) {
        grantPlayerXp(xpReward, `LOUNGE BAR: ${drinkName.toUpperCase()}`);
      }
      dispatchBuddyAction(`socialTalk:Ordered ${drinkName} (+${xpReward} XP)!`);
      return { ok: true, message: `Served ${drinkName}! +${xpReward} XP` };
    },
    [dispatchBuddyAction, grantPlayerXp, cyonBalance, respiteBalance],
  );

  const handleCasinoSettleTableGame = useCallback(
    (payoutLul: number, xpGained: number, announceHeadline?: string) => {
      if (payoutLul > 0) {
        const nextLul = hudRef.current.gold + payoutLul;
        dispatchBuddyAction(`adjustPlayerLul:${payoutLul}`);
        setHud((prev) => ({ ...prev, gold: nextLul }));
        const account = hudRef.current.nearWalletId || '';
        if (account) {
          void syncPlayerBalancesToSupabase({
            nearAccountId: account,
            lulBalance: nextLul,
            cyonBalance,
            respiteBalance: respiteBalanceRef.current,
          });
        }
        if (announceHeadline) {
          dispatchBuddyAction(`socialTalk:${announceHeadline}`);
        }
      }
      if (xpGained > 0) {
        grantPlayerXp(xpGained, 'GRAND CASINO');
      }
    },
    [dispatchBuddyAction, grantPlayerXp, cyonBalance],
  );

  const handleCasinoDebitRespiteStake = useCallback(
    (stakeRespite: number): { ok: boolean; message: string } => {
      const safeBet = Math.round(Math.max(0.5, stakeRespite) * 100) / 100;
      if (!Number.isFinite(safeBet) || respiteBalanceRef.current + 1e-6 < safeBet) {
        return {
          ok: false,
          message: `INSUFFICIENT RESPITE · NEED ${safeBet.toFixed(2)} RESPITE`,
        };
      }
      const nextRespite = Math.max(
        0,
        Math.round((respiteBalanceRef.current - safeBet) * 100) / 100,
      );
      respiteBalanceRef.current = nextRespite;
      setRespiteBalance(nextRespite);

      const accountKey =
        (hudRef.current.nearWalletId || playerUid || 'guest').trim().toLowerCase() || 'guest';
      writeCasinoRespiteDelta(accountKey, readCasinoRespiteDelta(accountKey) - safeBet);

      const account = hudRef.current.nearWalletId || '';
      if (account) {
        void syncPlayerBalancesToSupabase({
          nearAccountId: account,
          lulBalance: hudRef.current.gold,
          cyonBalance: cyonBalanceRef.current,
          respiteBalance: nextRespite,
        });
      }
      return { ok: true, message: `STAKED ${safeBet.toFixed(2)} RESPITE` };
    },
    [playerUid, readCasinoRespiteDelta, writeCasinoRespiteDelta],
  );

  const handleCasinoSettleRespiteWin = useCallback(
    (payoutRespite: number, xpGained: number, announceHeadline?: string) => {
      if (payoutRespite > 0) {
        const safePayout = Math.round(payoutRespite * 100) / 100;
        const nextRespite = Math.max(
          0,
          Math.round((respiteBalanceRef.current + safePayout) * 100) / 100,
        );
        respiteBalanceRef.current = nextRespite;
        setRespiteBalance(nextRespite);

        const accountKey =
          (hudRef.current.nearWalletId || playerUid || 'guest').trim().toLowerCase() || 'guest';
        writeCasinoRespiteDelta(accountKey, readCasinoRespiteDelta(accountKey) + safePayout);

        const account = hudRef.current.nearWalletId || '';
        if (account) {
          void syncPlayerBalancesToSupabase({
            nearAccountId: account,
            lulBalance: hudRef.current.gold,
            cyonBalance: cyonBalanceRef.current,
            respiteBalance: nextRespite,
          });
        }
        if (announceHeadline) {
          dispatchBuddyAction(`socialTalk:${announceHeadline}`);
        }
      }
      if (xpGained > 0) {
        grantPlayerXp(xpGained, 'GRAND CASINO SLOTS');
      }
    },
    [dispatchBuddyAction, grantPlayerXp, playerUid, readCasinoRespiteDelta, writeCasinoRespiteDelta],
  );

  useEffect(() => {
    const onAppCafeAction = (ev: Event) => {
      const act = (ev as CustomEvent<string>).detail;
      if (act === 'start_shift') handleStartCafeWorkShift();
      else if (act === 'stop_shift') handleStopCafeWorkShift();
      else if (act === 'serve_order') handleServeActiveCafeOrder();
    };
    window.addEventListener('app-cafe-action', onAppCafeAction);
    return () => window.removeEventListener('app-cafe-action', onAppCafeAction);
  }, [handleStartCafeWorkShift, handleStopCafeWorkShift, handleServeActiveCafeOrder]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.dataset.playerLevel = String(levelProgress.level);
      document.body.dataset.playerXp = String(levelProgress.totalXp);
      document.body.dataset.cafeInterior = String(isInsideGlasshouseCafe);
      document.body.dataset.casinoInterior = String(isInsideGrandCasino);
      document.body.dataset.salonInterior = String(isInsideBeautySalon);
      document.body.dataset.cafeShiftWorking = String(cafeShiftState.isWorking);
    }
  }, [
    levelProgress.level,
    levelProgress.totalXp,
    isInsideGlasshouseCafe,
    isInsideGrandCasino,
    isInsideBeautySalon,
    cafeShiftState.isWorking,
  ]);

  useEffect(() => {
    const effectiveMode =
      gameState === 'title' || onboardingStep === 'auth_choice'
        ? 'landing_tour'
        : onboardingStep === 'fly_to_plaza'
          ? 'fly_to_plaza'
          : onboardingStep === 'guest_character_select' ||
              onboardingStep === 'subwallet_naming' ||
              onboardingStep === 'provisioning_subwallet'
            ? 'character_select'
            : activeSpecialModal === 'none' && isInsideGrandCasino
              ? 'casino_interior'
              : activeSpecialModal === 'none' && isInsideBeautySalon
                ? 'salon_interior'
                : activeSpecialModal === 'none' && isInsideGlasshouseCafe
                  ? 'cafe_interior'
                  : activeSpecialModal === 'none' && isInsidePrivateHouse
                    ? 'house_visit'
                    : activeSpecialModal;
    const syncDetail = {
      mode: effectiveMode,
      flyTargetMode: plazaFlyTargetMode,
      flySessionId: plazaFlySessionIdRef.current,
      location: merchantLocation,
      themeId: activeHouseThemeId,
      isSampleHouse: isSampleHouseView,
      isWorkingCafeShift: cafeShiftState.isWorking,
      activeCafeOrderLabel: cafeShiftState.activeOrder?.item.name ?? '',
      activeCafeOrderAccent: cafeShiftState.activeOrder?.item.accentHex ?? '#b8ff3c',
      activeCafeOrderCategory: cafeShiftState.activeOrder?.item.category ?? null,
      houseArchitectureStyle,
      ownedHouseStyle,
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
    gameState,
    onboardingStep,
    plazaFlyTargetMode,
    activeSpecialModal,
    isInsideGrandCasino,
    isInsideBeautySalon,
    isInsideGlasshouseCafe,
    isInsidePrivateHouse,
    isSampleHouseView,
    cafeShiftState.isWorking,
    cafeShiftState.activeOrder,
    houseArchitectureStyle,
    ownedHouseStyle,
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

  const refreshOnChainDeedLedger = useCallback(async (tokenIdOverride?: string) => {
    const cleanToken = (tokenIdOverride || hudRef.current.nearGamepassTokenId || '').trim();
    if (!cleanToken) {
      setOnChainDeedLedger(null);
      return;
    }
    setIsLoadingDeedLedger(true);
    try {
      const ledger = await fetchNftSubAccountLedgerFromChain(cleanToken, 'optimistic');
      if (ledger) {
        setOnChainDeedLedger(ledger);
      }
    } finally {
      setIsLoadingDeedLedger(false);
    }
  }, []);

  const refreshOnChainBalances = useCallback(
    async (accountOverride?: string) => {
      const targetAccount = (accountOverride || hudRef.current.nearWalletId || playerUid || '')
        .trim()
        .toLowerCase();
      if (!targetAccount) return;

      const nep245Ids = MERCHANT_CATALOG_ITEMS.filter((i) => i.tokenId.startsWith('nep245:')).map(
        (i) => i.tokenId,
      );
      const [
        accountView,
        liveRespiteStr,
        hanaStatus,
        liveEstate,
        nep245Counts,
        liveGamepassVerify,
      ] = await Promise.all([
        fetchNearAccountView(targetAccount, 'optimistic'),
        fetchNep141Balance(NEAR_CONFIG.nep141RespiteContractId, targetAccount, 'optimistic'),
        fetchHanaTreasuryStatus(targetAccount, 'optimistic'),
        fetchBuddiesMarketEstate(targetAccount, 'optimistic').catch(() => null),
        fetchOwnedNep245CatalogCounts(targetAccount, nep245Ids, 'optimistic').catch(() => null),
        verifyNep171GamepassOwnership(targetAccount).catch(() => null),
      ]);

      const floor = pendingPostClaimFloorRef.current;
      const floorActive =
        floor !== null &&
        floor.accountId === targetAccount &&
        Date.now() < floor.expiresAtMs;

      if (accountView) {
        const liveNear = Number(accountView.amount) / 1e24;
        if (Number.isFinite(liveNear)) {
          const roundedNear = Number(liveNear.toFixed(4));
          if (floorActive && roundedNear < floor.expectedMinNear) {
            // Asynchronous NEAR transfer receipt is still settling; keep optimistic display.
          } else {
            if (floor && floor.accountId === targetAccount && roundedNear >= floor.expectedMinNear) {
              pendingPostClaimFloorRef.current = null;
            }
            setNearTestnetBalance(roundedNear);
          }
        }
      }

      if (liveRespiteStr !== null) {
        const parsedRespite = Number(liveRespiteStr);
        if (Number.isFinite(parsedRespite)) {
          const adjusted = Math.max(
            0,
            Math.round((parsedRespite + readCasinoRespiteDelta(targetAccount)) * 100) / 100,
          );
          respiteBalanceRef.current = adjusted;
          setRespiteBalance(adjusted);
        }
      }

      if (hanaStatus.verified) {
        if (hanaStatus.callerAlreadyClaimed) {
          setHanaWelcomeNearClaimed(true);
        } else if (!floorActive) {
          setHanaWelcomeNearClaimed(false);
        }
      }

      const activeWalletNow = (hudRef.current.nearWalletId || '').trim().toLowerCase();
      if (activeWalletNow && activeWalletNow === targetAccount) {
        const deedTokenId =
          liveGamepassVerify?.token?.tokenId || liveEstate?.house_deed?.deed_token_id || null;
        if (liveGamepassVerify?.verified || liveEstate?.owns_house || deedTokenId) {
          setHasHouseOwnership(true);
          const { resolvedStyle, isOnChainLocked } = resolveOwnedHouseStyle({
            onChainHouseStyle: liveGamepassVerify?.houseStyle ?? null,
            localSavedStyle: ownedHouseStyleRef.current ?? readHouseStyleLocally(targetAccount),
          });
          setOwnedHouseStyle(resolvedStyle);
          setIsOnChainHouseStyleLocked(isOnChainLocked);
          if (isOnChainLocked || !ownedHouseStyleRef.current) {
            setHouseArchitectureStyle(resolvedStyle);
          }
          persistHouseStyleLocally(targetAccount, resolvedStyle);
          if (deedTokenId) {
            setHud((prev) =>
              prev.nearHasGamepassNft && prev.nearGamepassTokenId === deedTokenId
                ? prev
                : { ...prev, nearHasGamepassNft: true, nearGamepassTokenId: deedTokenId },
            );
          }
          dispatchBuddyAction(
            `nearSyncWalletSession:${targetAccount}:1:${deedTokenId || ''}:${resolvedStyle}`,
          );
        }
        if (nep245Counts) {
          setOwnedMerchantItemIds((prev) => {
            const next = mergeOwnedCatalogWithChainNep245(prev, nep245Counts);
            return next.length === prev.length && next.every((v, i) => v === prev[i])
              ? prev
              : next;
          });
        }
      }
    },
    [dispatchBuddyAction, persistHouseStyleLocally, playerUid, readHouseStyleLocally],
  );

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
      void refreshOnChainBalances();
      void refreshOnChainDeedLedger();
    }
  }, [
    isPersonalWalletModalOpen,
    personalWalletTab,
    refreshWalletTransactions,
    refreshOnChainBalances,
    refreshOnChainDeedLedger,
  ]);

  // Chain-truth refresh: after any in-game wallet transaction settles, and
  // whenever an NPC merchant modal opens, re-read balances and claim status
  // from chain so the numbers on screen never lag the ledger.
  useEffect(() => {
    const timers: number[] = [];
    const onSettled = (evt: Event) => {
      const detail = (evt as CustomEvent<{ signerAccountId?: string; methodName?: string }>).detail;
      if (
        detail?.methodName &&
        detail.methodName !== 'claim_hana_welcome_near' &&
        detail.methodName !== 'claim_hana_welcome_near_attested'
      ) {
        pendingPostClaimFloorRef.current = null;
      }
      const actor = detail?.signerAccountId;
      void refreshWalletTransactions();
      void refreshOnChainBalances(actor);
      void refreshOnChainDeedLedger();
      for (const delayMs of [1200, 2800, 5000]) {
        timers.push(
          window.setTimeout(() => {
            void refreshOnChainBalances(actor);
          }, delayMs),
        );
      }
      timers.push(
        window.setTimeout(() => {
          void refreshWalletTransactions();
          void refreshOnChainDeedLedger();
        }, 2500),
      );
    };
    window.addEventListener('buddies:citizen-tx-settled', onSettled);
    return () => {
      window.removeEventListener('buddies:citizen-tx-settled', onSettled);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [refreshWalletTransactions, refreshOnChainBalances, refreshOnChainDeedLedger]);

  useEffect(() => {
    if (activeSpecialModal === 'npc_merchant') {
      void refreshWalletTransactions();
      void refreshOnChainBalances();
    }
  }, [activeSpecialModal, refreshWalletTransactions, refreshOnChainBalances]);

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

      pendingPostClaimFloorRef.current = null;
      setIsVerifyingNearWallet(true);
      const detectedNet: NearNetworkId = normalizedWallet.endsWith('.near')
        ? 'mainnet'
        : walletNetworkChoice;
      const isCitizenInvisible = options?.onboardingMode === 'social_invisible';
      const accountView = await fetchNearAccountView(normalizedWallet, 'optimistic');
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

      const rawNearTokens = accountView ? Number(accountView.amount) / 1e24 : isCitizenInvisible ? 0.08 : 0;
      const resolvedConnectNear = Number.isFinite(rawNearTokens) ? Number(rawNearTokens.toFixed(4)) : 0;
      nearTestnetBalanceRef.current = resolvedConnectNear;
      setNearTestnetBalance(resolvedConnectNear);
      if (isCitizenInvisible && !accountView) {
        for (const delayMs of [1500, 3200]) {
          window.setTimeout(() => {
            void refreshOnChainBalances(normalizedWallet);
          }, delayMs);
        }
      }

      const normalizedDefaultName = normalizedWallet.split('.')[0].toUpperCase();
      let savedLocalProfile: { displayName: string; gender: 'male' | 'female' } | null = null;
      if (typeof window !== 'undefined') {
        try {
          const rawMap = window.localStorage.getItem('bb_saved_wallet_profiles_v2');
          if (rawMap) {
            const parsed = JSON.parse(rawMap) as Record<
              string,
              { displayName: string; gender: 'male' | 'female' }
            >;
            if (parsed[normalizedWallet]) {
              savedLocalProfile = parsed[normalizedWallet];
            }
          }
        } catch {
          // ignore
        }
      }

      const nep245TokenIds = MERCHANT_CATALOG_ITEMS.filter((i) =>
        i.tokenId.startsWith('nep245:'),
      ).map((i) => i.tokenId);
      const [
        onChainRespiteRaw,
        onChainEstate,
        gamepassVerify,
        hanaStatus,
        remoteProfile,
        onChainNep245Counts,
        loginMarketTxs,
      ] = await Promise.all([
        fetchNep141Balance(NEAR_CONFIG.nep141RespiteContractId, normalizedWallet, 'optimistic'),
        fetchBuddiesMarketEstate(normalizedWallet, 'optimistic'),
        verifyNep171GamepassOwnership(normalizedWallet),
        fetchHanaTreasuryStatus(normalizedWallet, 'optimistic'),
        fetchOrCreatePlayerProfile({
          nearAccountId: normalizedWallet,
          displayName: savedLocalProfile?.displayName || normalizedDefaultName,
          authMode: isCitizenInvisible ? 'social_invisible' : 'wallet_selector',
          email: resolvedEmail || undefined,
        }),
        fetchOwnedNep245CatalogCounts(normalizedWallet, nep245TokenIds, 'optimistic').catch(
          () => null,
        ),
        fetchMarketTransactionsFromSupabase(normalizedWallet, 30).catch(() => []),
      ]);
      setHanaWelcomeNearClaimed(Boolean(hanaStatus.callerAlreadyClaimed));
      const hasAuthoritativeOnChainBalance =
        Boolean(accountView) || onChainRespiteRaw !== null || onChainEstate !== null;
      const estateRespite = Number(onChainEstate?.respite_balance || '0') || 0;
      const onChainRespite = Math.max(0, Number(onChainEstate?.respite_balance || '0') || 0, estateRespite, Number(onChainRespiteRaw || '0') || 0);
      if (hasAuthoritativeOnChainBalance) {
        const adjustedOnChainRespite = Math.max(
          0,
          Math.round((onChainRespite + readCasinoRespiteDelta(normalizedWallet)) * 100) / 100,
        );
        respiteBalanceRef.current = adjustedOnChainRespite;
        setRespiteBalance(adjustedOnChainRespite);
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

      const dbGenderTag = remoteProfile?.unlocked_skins?.find(
        (s) => s === 'gender:male' || s === 'gender:female',
      );
      const hasSavedAvatar = Boolean(savedLocalProfile || dbGenderTag);
      const savedGender: 'male' | 'female' =
        dbGenderTag === 'gender:female'
          ? 'female'
          : dbGenderTag === 'gender:male'
            ? 'male'
            : savedLocalProfile?.gender === 'female'
              ? 'female'
              : 'male';
      const savedName =
        remoteProfile?.display_name || savedLocalProfile?.displayName || normalizedDefaultName;

      const entryDecision = resolveOnboardingAccountEntry({
        authKind: isCitizenInvisible ? 'google' : 'external_wallet',
        hasSavedAvatarProfile: hasSavedAvatar,
        savedGender,
        savedDisplayName: savedName,
      });

      const finalGender = entryDecision.restoredGender;
      const finalName = entryDecision.restoredDisplayName || savedName;

      setPlayerUid(normalizedWallet);
      setConnectedExternalWalletId(normalizedWallet);
      setWalletConnectInput(normalizedWallet);
      setCharacterGender(finalGender);
      setPlayerDisplayName(finalName);
      setWalletUsernameDraft(finalName);
      setOnboardingAuthMode('wallet');
      setHasHouseOwnership(ownsHouseVerified);

      const { resolvedStyle: restoredHouseStyle, isOnChainLocked: isHouseStyleOnChainLocked } =
        resolveOwnedHouseStyle({
          onChainHouseStyle: gamepassVerify.houseStyle,
          unlockedSkins: remoteProfile?.unlocked_skins,
          marketTransactions: loginMarketTxs,
          localSavedStyle: readHouseStyleLocally(normalizedWallet),
        });
      persistHouseStyleLocally(normalizedWallet, restoredHouseStyle);
      setHouseArchitectureStyle(restoredHouseStyle);
      setOwnedHouseStyle(ownsHouseVerified ? restoredHouseStyle : null);
      setIsOnChainHouseStyleLocked(Boolean(ownsHouseVerified && isHouseStyleOnChainLocked));

      dispatchBuddyAction(
        `nearSyncWalletSession:${normalizedWallet}:${ownsHouseVerified ? '1' : '0'}:${verifiedTokenId || ''}:${ownsHouseVerified ? restoredHouseStyle : ''}`,
      );
      dispatchBuddyAction(`setCharacterGender:${finalGender}`);
      dispatchBuddyAction(`setPlayerDisplayName:${finalName}`);
      setHud((prev) => ({
        ...prev,
        nearWalletConnected: true,
        nearWalletId: normalizedWallet,
        nearHasGamepassNft: ownsHouseVerified,
        nearGamepassTokenId: verifiedTokenId,
      }));

      const reconciledOwnedIds = mergeOwnedCatalogWithChainNep245(
        Array.isArray(remoteProfile?.owned_token_ids) ? remoteProfile.owned_token_ids : [],
        onChainNep245Counts,
      );
      if (remoteProfile) {
        setSupabaseConnected(true);
        setCyonBalance(remoteProfile.cyon_balance);
        restoreLulFromProfile(remoteProfile.lul_balance);
        const expectedHouseSkinTag = ownsHouseVerified ? `house_style:${restoredHouseStyle}` : null;
        const needsHouseSkinSync = Boolean(
          expectedHouseSkinTag &&
            (!Array.isArray(remoteProfile.unlocked_skins) ||
              !remoteProfile.unlocked_skins.includes(expectedHouseSkinTag)),
        );
        if (!hasAuthoritativeOnChainBalance) {
          setRespiteBalance(remoteProfile.respite_balance);
        }
        if ((hasAuthoritativeOnChainBalance && remoteProfile.respite_balance !== onChainRespite) || needsHouseSkinSync) {
          void syncPlayerBalancesToSupabase({
            nearAccountId: normalizedWallet,
            lulBalance: remoteProfile.lul_balance,
            cyonBalance: remoteProfile.cyon_balance,
            respiteBalance: hasAuthoritativeOnChainBalance ? onChainRespite : remoteProfile.respite_balance,
            unlockedSkins: needsHouseSkinSync
              ? buildProfileUnlockedSkins(finalGender, restoredHouseStyle, remoteProfile.unlocked_skins)
              : undefined,
          });
        }
        setOwnedMerchantItemIds(reconciledOwnedIds);
      } else if (onChainNep245Counts) {
        setOwnedMerchantItemIds(reconciledOwnedIds);
      }

      if (entryDecision.isReturningUser) {
        persistWalletProfileLocally(normalizedWallet, finalName, finalGender, resolvedEmail);
      }

      setIsNearWalletSelectorOpen(false);
      if (onboardingStepRef.current !== 'completed') {
        // Fly camera smoothly from live city tour into Central Plaza!
        beginPlazaFlyToOnboarding(entryDecision.flyTargetMode, entryDecision.nextStepAfterFly);
      } else {
        setOnboardingStep('completed');
        setGameState('playing');
      }

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

      void loadSavedHouseInterior(normalizedWallet, reconciledOwnedIds);
    },
    [
      beginPlazaFlyToOnboarding,
      buildProfileUnlockedSkins,
      dispatchBuddyAction,
      persistHouseStyleLocally,
      persistWalletProfileLocally,
      readHouseStyleLocally,
      refreshOnChainBalances,
      walletNetworkChoice,
    ],
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
          if (remoteProfile.near_account_id.endsWith('.buddiesblitz.testnet')) {
            // Heal the invisible-wallet key for this browser/origin: the
            // relayer co-key registers the current session key as FullAccess
            // when it is missing, so signing never detours to an external
            // wallet. Fast no-op when the key is already registered.
            try {
              await Promise.race([
                spawnSubAccountOnChainViaMaster({
                  handle: remoteProfile.near_account_id.split('.')[0],
                  email: cleanEmail,
                }),
                new Promise((resolve) => window.setTimeout(resolve, 4000)),
              ]);
            } catch {
              // ignore — restore continues regardless
            }
          }
          await handleConnectWalletAndEnterLobby(remoteProfile.near_account_id, {
            silentRestore: true,
            googleEmail: cleanEmail,
            onboardingMode: 'social_invisible',
          });
          return true;
        }

        try {
          const rawEmailMap = window.localStorage.getItem('bb_wallet_by_google_email_v2');
          const emailMap: Record<string, string> = rawEmailMap ? JSON.parse(rawEmailMap) : {};
          const localMappedWallet = emailMap[cleanEmail];
          if (localMappedWallet) {
            await handleConnectWalletAndEnterLobby(localMappedWallet, {
              silentRestore: true,
              googleEmail: cleanEmail,
              onboardingMode: 'social_invisible',
            });
            return true;
          }
        } catch {
          // ignore
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

      // New Google user: fly camera to Central Plaza and choose avatar!
      setConnectedExternalWalletId('');
      setOnboardingAuthMode('wallet');
      beginPlazaFlyToOnboarding('character_select', 'guest_character_select');
      return false;
    },
    [beginPlazaFlyToOnboarding, handleConnectWalletAndEnterLobby, isCustomGuestNameEdited],
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

          // Keep Live Landing Page visible on fresh visit; only verify signer state quietly
          const explicitlyLoggedOut =
            window.localStorage.getItem('bb_explicit_logged_out_v1') === '1';
          if (explicitlyLoggedOut) return;

          const restoredSigner = await restoreConnectedNearSigningWallet('testnet');
          if (!cancelled && restoredSigner?.accountId) {
            const acc = restoredSigner.accountId.trim().toLowerCase();
            setSavedWalletSummary((prev) =>
              prev && prev.walletId === acc
                ? prev
                : {
                    walletId: acc,
                    displayName: acc.split('.')[0].toUpperCase(),
                    gender: 'male',
                  },
            );
          }
        } catch {
          // ignore
        }
      })();
    }
    const unsubGoogle = subscribeToSupabaseAuthUser((user) => {
      if (user?.email) {
        const hasPendingRedirect =
          typeof window !== 'undefined' &&
          (window.sessionStorage.getItem('bb_pending_privy_google_login') === '1' ||
            window.location.search.includes('privy_oauth_'));
        if (hasPendingRedirect) {
          void resolveAndRestoreExistingGoogleWallet(user.email);
        } else {
          setConnectedGoogleEmail(user.email);
        }
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
          unlockedSkins: buildProfileUnlockedSkins(characterGender, ownedHouseStyleRef.current),
        });
      }
    },
    [
      buildProfileUnlockedSkins,
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

  const handleProvisionSubWalletAndShowWelcome = useCallback(
    async (options?: { autoFromDisplayName?: boolean; displayNameOverride?: string }) => {
      soundEngine.playUiClick();
      setWalletConnectError(null);
      const isAutoProvision = Boolean(options?.autoFromDisplayName);
      const cleanCitizenName =
        (options?.displayNameOverride ?? playerDisplayName).trim() ||
        (characterGender === 'male' ? 'Buddy Male' : 'Buddy Female');
      const activeEmail = connectedGoogleEmail.trim().toLowerCase();

      let cleanHandle = subWalletHandleDraft
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 32);

      if (!isAutoProvision && cleanHandle.length < 2) {
        setWalletConnectError('Player ID must be at least 2 characters.');
        return;
      }

      if (isAutoProvision) {
        setSubWalletHandleDraft('');
      }
      setOnboardingStep('provisioning_subwallet');
      setOnboardingLoadingProgress(22);
      setSubWalletProvisionStageLabel('Creating your player account...');

      const stageTimer1 = window.setTimeout(() => {
        setOnboardingLoadingProgress(56);
        setSubWalletProvisionStageLabel(
          isAutoProvision || !cleanHandle
            ? 'Activating your player account...'
            : `Activating ${cleanHandle}.${NEAR_CONFIG.masterAccountId}...`,
        );
      }, 380);

      const provisioned = isAutoProvision
        ? await provisionUniqueCitizenSubAccount({
            displayName: cleanCitizenName,
            email: activeEmail || undefined,
          })
        : await spawnSubAccountOnChainViaMaster({
            handle: cleanHandle,
            email: activeEmail || undefined,
            strictUniqueHandle: true,
          });
      window.clearTimeout(stageTimer1);

      if (!provisioned.ok || !provisioned.subAccountId) {
        soundEngine.playHit();
        setOnboardingStep(isAutoProvision ? 'guest_character_select' : 'subwallet_naming');
        setWalletConnectError(
          provisioned.error ||
            'Could not finish setting up your account. Please try again.',
        );
        return;
      }

      const walletId = provisioned.subAccountId.toLowerCase();
      cleanHandle = walletId.split('.')[0] || cleanHandle;
      setSubWalletHandleDraft(cleanHandle);
      pendingPostClaimFloorRef.current = null;
      setOnboardingLoadingProgress(85);
      setSubWalletProvisionStageLabel('Loading Central Plaza...');

      const [accountView, hanaStatus] = await Promise.all([
        fetchNearAccountView(walletId, 'optimistic'),
        fetchHanaTreasuryStatus(walletId, 'optimistic'),
      ]);
      const nearTokens = accountView ? Number(accountView.amount) / 1e24 : 0.08;
      const resolvedInitialNear = Number.isFinite(nearTokens) ? Number(nearTokens.toFixed(4)) : 0.08;
      nearTestnetBalanceRef.current = resolvedInitialNear;
      setNearTestnetBalance(resolvedInitialNear);
      setRespiteBalance(0);
      setCyonBalance(0);
      setHasHouseOwnership(false);
      setOwnedHouseStyle(null);
      setIsOnChainHouseStyleLocked(false);
      setHanaWelcomeNearClaimed(Boolean(hanaStatus.callerAlreadyClaimed));

      window.setTimeout(() => {
        void refreshOnChainBalances(walletId);
      }, 2000);

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
          // Restore the stored balances locally and write back the SAME
          // values: signing in on a new browser must never wipe LUL/CYON.
          setCyonBalance(profile.cyon_balance);
          restoreLulFromProfile(profile.lul_balance);
          void loadSavedHouseInterior(walletId, profile.owned_token_ids ?? []);
          void syncPlayerBalancesToSupabase({
            nearAccountId: walletId,
            displayName: cleanCitizenName,
            lulBalance: profile.lul_balance,
            cyonBalance: profile.cyon_balance,
            respiteBalance: profile.respite_balance,
            unlockedSkins: buildProfileUnlockedSkins(
              characterGender,
              ownedHouseStyleRef.current,
              profile.unlocked_skins,
            ),
          });
        }
      });

      setOnboardingLoadingProgress(100);
      soundEngine.playPickup();
      setOnboardingStep('completed');
      setGameState('playing');
      setTutorialStage('go_to_hana');
    },
    [
      buildProfileUnlockedSkins,
      characterGender,
      connectedGoogleEmail,
      dispatchBuddyAction,
      persistWalletProfileLocally,
      playerDisplayName,
      refreshOnChainBalances,
      subWalletHandleDraft,
    ],
  );

  const handleConfirmGuestCharacterAndEnterLobby = useCallback(() => {
    soundEngine.playUiClick();
    setWalletConnectError(null);
    const cleanGuestName =
      playerDisplayName.trim() || (characterGender === 'male' ? 'Buddy Male' : 'Buddy Female');
    setPlayerDisplayName(cleanGuestName);
    setWalletUsernameDraft(cleanGuestName);

    // New External Wallet User: already connected wallet, save chosen avatar & enter plaza!
    if (onboardingAuthMode === 'wallet' && connectedExternalWalletId) {
      persistWalletProfileLocally(
        connectedExternalWalletId,
        cleanGuestName,
        characterGender,
        connectedGoogleEmail,
      );
      dispatchBuddyAction(`setCharacterGender:${characterGender}`);
      dispatchBuddyAction(`setPlayerDisplayName:${cleanGuestName}`);
      void syncPlayerBalancesToSupabase({
        nearAccountId: connectedExternalWalletId,
        displayName: cleanGuestName,
        lulBalance: hudRef.current.gold,
        cyonBalance,
        respiteBalance,
        unlockedSkins: buildProfileUnlockedSkins(characterGender, ownedHouseStyleRef.current),
      });
      setOnboardingLoadingProgress(10);
      setOnboardingStep('entering_lobby');
      return;
    }

    // Google Login Flow: automatically provision `<displayName>.buddiesblitz.testnet` behind the scenes
    if (onboardingAuthMode === 'wallet') {
      void handleProvisionSubWalletAndShowWelcome({
        autoFromDisplayName: true,
        displayNameOverride: cleanGuestName,
      });
      return;
    }

    // Play as Guest Flow: Enter Central Plaza without registration (Exchange / Purchases / Mint gated)
    setPlayerUid('');
    const guestRespite = Math.max(0, readCasinoRespiteDelta('guest'));
    respiteBalanceRef.current = guestRespite;
    setRespiteBalance(guestRespite);
    setCyonBalance(0);
    setNearTestnetBalance(0);
    setHasHouseOwnership(false);
    setOwnedHouseStyle(null);
    setIsOnChainHouseStyleLocked(false);
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
    buildProfileUnlockedSkins,
    characterGender,
    connectedExternalWalletId,
    connectedGoogleEmail,
    cyonBalance,
    dispatchBuddyAction,
    handleProvisionSubWalletAndShowWelcome,
    onboardingAuthMode,
    persistWalletProfileLocally,
    playerDisplayName,
    respiteBalance,
  ]);

  const handleClaimHanaWelcomeNear = useCallback(async () => {
    const actorAccount = (hudRef.current.nearWalletId || playerUid || '').trim().toLowerCase();
    if (!actorAccount) {
      return {
        ok: false,
        txHash: '',
        explorerUrl: '',
        amountNear: 0,
        error: 'Please sign in first to claim your starter pack.',
      };
    }

    const preClaimNear = nearTestnetBalanceRef.current;

    // Contract v1.5.0 enforces one welcome NEAR grant per Google email hash
    // when attested claim is enabled; non-Google wallets use legacy 1x-per-account claim.
    let claimRes: Awaited<ReturnType<typeof claimHanaWelcomeNearOnChain>> | null = null;
    const claimEmail = (connectedGoogleEmail || '').trim().toLowerCase();
    if (shouldAttemptAttestedHanaClaim(claimEmail)) {
      const att = await fetchHanaClaimAttestation(actorAccount, claimEmail);
      if (att.ok) {
        const attestedRes = await claimHanaWelcomeNearAttestedOnChain(
          actorAccount,
          att.attestation,
        );
        if (attestedRes.ok) {
          claimRes = attestedRes;
        } else if (
          attestedRes.error &&
          /already claimed/i.test(attestedRes.error)
        ) {
          return attestedRes;
        }
      } else if (att.code === 'ALREADY_CLAIMED') {
        return {
          ok: false,
          txHash: '',
          explorerUrl: '',
          amountNear: 0,
          error: att.error,
        };
      }
    }
    if (!claimRes) {
      claimRes = await claimHanaWelcomeNearOnChain(actorAccount);
    }
    if (!claimRes.ok) {
      return claimRes;
    }

    setHanaWelcomeNearClaimed(true);
    const updatedView = await fetchNearAccountView(actorAccount, 'optimistic');
    const observedNear =
      updatedView && Number.isFinite(Number(updatedView.amount) / 1e24)
        ? Number(updatedView.amount) / 1e24
        : null;
    const reconciled = resolvePostClaimNearBalance({
      previousNearBalance: preClaimNear,
      observedNearBalance: observedNear,
      grantAmountNear: claimRes.amountNear,
    });
    if (!reconciled.receiptConfirmedOnChain) {
      pendingPostClaimFloorRef.current = {
        accountId: actorAccount,
        expectedMinNear: reconciled.pendingFloorNear,
        expiresAtMs: Date.now() + 12000,
      };
      for (const delayMs of [1200, 2800, 5000]) {
        window.setTimeout(() => {
          void refreshOnChainBalances(actorAccount);
        }, delayMs);
      }
    } else {
      pendingPostClaimFloorRef.current = null;
    }
    nearTestnetBalanceRef.current = reconciled.nextNearBalance;
    setNearTestnetBalance(reconciled.nextNearBalance);

    void logMarketTransactionToSupabase({
      merchant_id: 'lobby_cafe',
      actor_near_account: actorAccount,
      action_type: 'claim_starter_near',
      item_id: 'hana_welcome_near_0_30',
      currency: 'NEAR',
      amount: 0.3,
      unit_price: 1,
      reasoning_summary: `Starter pack from Hana · +0.30 NEAR.`,
      near_tx_hash: claimRes.txHash,
    });

    // Starter pack: the Hana welcome claim also seeds the off-chain city
    // currencies, so a new citizen can immediately eat at the cafe (LUL)
    // and use CYON services. The claim itself is once-per-account on-chain,
    // so this grant can only ever run once for the same account.
    const starterLul = 100;
    const starterCyon = 20;
    setHud((prev) => ({ ...prev, gold: prev.gold + starterLul }));
    setCyonBalance((prev) => prev + starterCyon);
    void syncPlayerBalancesToSupabase({
      nearAccountId: actorAccount,
      lulBalance: hudRef.current.gold + starterLul,
      cyonBalance: cyonBalanceRef.current + starterCyon,
      respiteBalance: respiteBalanceRef.current,
    });

    return claimRes;
  }, [playerUid, connectedGoogleEmail, refreshOnChainBalances]);

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
      setTutorialStage('go_to_hana');
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
      if (cityViewActive) {
        if (e.code === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
          exitCityViewMode();
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault();
          e.stopImmediatePropagation();
          selectCityViewTarget(getAdjacentCityViewDistrictId(cityViewTarget, -1));
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          e.stopImmediatePropagation();
          selectCityViewTarget(getAdjacentCityViewDistrictId(cityViewTarget, 1));
        }
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
      if (isCitizenDialogueOpen) {
        if (e.code === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
          setIsCitizenDialogueOpen(false);
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
    isCitizenDialogueOpen,
    isProfileModalOpen,
    isSocialChatModalOpen,
    isKioskModalOpen,
    dispatchBuddyAction,
    handleStartGame,
    handleToggleAudio,
    handleCycleLighting,
    handleToggleFovMode,
    cityViewActive,
    cityViewTarget,
    exitCityViewMode,
    selectCityViewTarget,
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

  // Kai phone: opening Kai's merchant chat (in person or by phone) counts as
  // having met him today, completes the daily Kai mission, and silences calls.
  useEffect(() => {
    if (activeSpecialModal === 'npc_merchant' && merchantLocation === 'beach_house') {
      completeDailyMission('meet_kai');
      if (!kaiPhoneState.met) {
        persistKaiPhoneState({ ...kaiPhoneState, met: true });
        setKaiIncomingCall(false);
        soundEngine.stopPhoneRing();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSpecialModal, merchantLocation, kaiPhoneState.met, completeDailyMission]);

  // Kai phone: once the player first has a fish to sell, Kai calls — once per
  // device, and only when no other UI is in the way.
  useEffect(() => {
    if (kaiPhoneState.called || kaiPhoneState.met || kaiIncomingCall) return;
    if (gameState !== 'playing' || onboardingStep !== 'completed') return;
    if (hud.worldMode === 'warzone') return;
    if (caughtFishBucket.length === 0) return;
    if (
      activeSpecialModal !== 'none' ||
      isCitizenDialogueOpen ||
      isSocialChatModalOpen ||
      isKioskModalOpen ||
      isGrandCasinoModalOpen
    ) {
      return;
    }
    if (lastCaughtFishToast) return;
    persistKaiPhoneState({ ...kaiPhoneState, called: true });
    setKaiIncomingCall(true);
    soundEngine.playPhoneRing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    kaiPhoneState,
    kaiIncomingCall,
    gameState,
    onboardingStep,
    hud.worldMode,
    caughtFishBucket.length,
    activeSpecialModal,
    isSocialChatModalOpen,
    isKioskModalOpen,
    isGrandCasinoModalOpen,
    lastCaughtFishToast,
  ]);

  const fishingCastTimersRef = useRef<number[]>([]);
  const lastCastLaunchAtRef = useRef<number>(0);
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

  // Sync Shoreline 3D Bobber, 48-Seg Catenary Line, Progressive Rod Bend & Spinning Reel with BuddiesBlitzArena
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('shoreline-fishing-sync', {
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

  // Shoreline Hold-to-Charge Cast Power Loop (0..100% over 1.1s)
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

  // Shoreline Line-Tension + Stamina + Periodic Surge 60FPS Minigame Loop
  useEffect(() => {
    if (fishingPhase !== 'fighting') return;
    const id = window.setInterval(() => {
      setFishingMinigame((prev) => {
        if (!prev || prev.status !== 'active') return prev;
        return stepShorelineMinigame(prev, 0.05, isHoldingReel);
      });
    }, 50);
    return () => window.clearInterval(id);
  }, [fishingPhase, isHoldingReel]);

  // Resolve Shoreline Minigame Outcome ('caught' | 'snapped' | 'escaped')
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
      completeDailyMission('go_fishing');
      setFishingHintMessage(null);
      window.dispatchEvent(
        new CustomEvent('shoreline-fishing-landed', {
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
  }, [
    fishingPhase,
    fishingMinigame,
    lightingPreset,
    nep171Ledger.ownerNearAccount,
    completeDailyMission,
  ]);

  const ensureFishingRodEquipped = useCallback(() => {
    if (hudRef.current.equippedWeapon !== 'Joran Fishing') {
      dispatchBuddyAction('qcEquipWeapon:fishing_rod');
      hudRef.current = { ...hudRef.current, equippedWeapon: 'Joran Fishing' };
      setHud((prev) => ({ ...prev, equippedWeapon: 'Joran Fishing' }));
    }
  }, [dispatchBuddyAction]);

  const launchShorelineCast = useCallback(
    (powerToUse: number) => {
      if (hudRef.current.worldMode === 'warzone') return;
      if (caughtFishBucket.length >= 20) return;
      // One physical press fires pointerup (release) AND click (trigger) for the
      // same gesture; the click closure still sees phase 'charging' and would
      // launch a second time, doubling the cast sound. Ignore re-entry <600ms.
      const launchNow = performance.now();
      if (launchNow - lastCastLaunchAtRef.current < 600) return;
      lastCastLaunchAtRef.current = launchNow;
      ensureFishingRodEquipped();
      clearFishingCastTimers();

      const pDot = hudRef.current.radarDots.find((d) => d.kind === 'player');
      const waterCheck = detectNearbyFishingWaterZone(pDot?.x ?? 0, pDot?.z ?? 0);
      const activeZone = waterCheck.zoneId ?? 'east_beach';

      soundEngine.playPickup();
      const clampedPower = Math.max(0.2, Math.min(1.0, powerToUse));
      setFishingCastPower(clampedPower);
      const schedule = createShorelineBiteSchedule({
        waterZone: activeZone,
        lightingPreset,
        castPower: clampedPower,
      });
      setFishingBiteSchedule(schedule);
      setFishingHintMessage(null);
      setLastCaughtFishToast(null);
      setIsChargingCast(false);
      setFishingPhase('casting');

      const castFlightMs = Math.round((0.82 + clampedPower * 0.24) * 1000);
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
              new CustomEvent('shoreline-fishing-sync', {
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

    soundEngine.playSoftTap();

    // Non-punishing Shoreline Nibble Cue: clicking early warns the player without losing the cast!
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

    // Hook Set on 'bite' ('take' window) -> Every catch enters the Shoreline Line-Tension + Stamina + Surge Fight Minigame!
    if (fishingPhase === 'bite') {
      clearFishingCastTimers();
      const targetSpecies =
        fishingBiteSchedule?.species ??
        createShorelineBiteSchedule({
          waterZone: activeZone,
          lightingPreset,
          castPower: fishingCastPower,
        }).species;

      setFishingMinigame(createShorelineMinigameState(targetSpecies, fishingCastPower));
      setFishingPhase('fighting');
      setIsHoldingReel(false);
      setFishingHintMessage(null);
      return;
    }

    if (fishingPhase === 'idle' || fishingPhase === 'charging') {
      launchShorelineCast(fishingCastPower);
    }
  }, [
    clearFishingCastTimers,
    ensureFishingRodEquipped,
    fishingBiteSchedule,
    fishingCastPower,
    fishingMinigame,
    fishingPhase,
    launchShorelineCast,
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
          reasoning_summary: `Sold ${fish.speciesName} (${fish.weightKg} kg, ${fish.rarity}) to Kai · +${earnedLul} LUL.`,
        });
      }
    },
    [cyonBalance, dispatchBuddyAction, playerUid, respiteBalance],
  );

  // Chat-negotiated variant (F1 pilot): Kai pays the price agreed in the
  // chat negotiation instead of the standard formula price. The price was
  // produced by the negotiation envelope, so it is only clamped for sanity.
  /**
   * Kai's haggling context for a fish (plan Bagian 13.4 + patience design):
   * the remembered final price for this player+species (24h), and how much
   * patience Kai has today — repeat haggling shortens it, a stressed
   * treasury shortens it further, so grinding to the ceiling stops early.
   */
  /** Fase 2 (plan Bagian 5): ask the trade server for a bounded RESPITE
   * session for a minted fish. The server verifies ownership on-chain,
   * computes the envelope and checks Kai's treasury before any number
   * reaches the negotiation card. */
  const handleRequestKaiNftTradeSession = useCallback(
    async (fish: CaughtFishItem) => {
      const actorAccount = hudRef.current.nearWalletId || playerUid;
      if (!actorAccount || !fish.nftTokenId) {
        return { ok: false as const, reason: 'not_configured' };
      }
      try {
        const resp = await fetch(resolveApiUrl('/api/npc-trade'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_session',
            playerAccount: actorAccount,
            tokenId: fish.nftTokenId,
          }),
        });
        const data = (await resp.json().catch(() => null)) as any;
        if (data?.ok && data.sessionId) {
          return {
            ok: true as const,
            sessionId: String(data.sessionId),
            baseValueRespite: Number(data.baseValueRespite) || 0,
            ceilingRespite: Number(data.ceilingRespite) || 0,
            openingOffer: Number(data.openingOffer) || 0,
            patience: Number(data.patience) || 3,
            memoryFinalPrice:
              data.memoryFinalPrice == null ? null : Number(data.memoryFinalPrice),
          };
        }
        return {
          ok: false as const,
          reason: typeof data?.reason === 'string' ? data.reason : 'failed',
        };
      } catch {
        return { ok: false as const, reason: 'failed' };
      }
    },
    [playerUid],
  );

  /** Fase 2 settlement (Route A): the player lists the fish at the
   * agreed price with their own signature, then the trade server has
   * Kai buy it atomically. A refused or failed execution pulls the
   * listing back so the fish is never stranded on the board. */
  const handleSellNftFishToKai = useCallback(
    async (
      fish: CaughtFishItem,
      serverSessionId: string,
      agreedPriceRespite: number,
    ) => {
      const actorAccount = hudRef.current.nearWalletId || playerUid;
      if (!actorAccount || !fish.nftTokenId) {
        return { ok: false as const, reason: 'failed' };
      }
      const listingId = `kai-${serverSessionId}`;
      const cleanPrice = Math.max(1, Math.round(agreedPriceRespite));
      const listRes = await executeMarketContractCallOnChain({
        signerAccountId: actorAccount || undefined,
        methodName: 'list_fish_nft',
        args: {
          listing_id: listingId,
          token_id: fish.nftTokenId,
          price_respite: String(cleanPrice),
        },
      });
      if (!listRes.ok) return { ok: false as const, reason: 'failed' };
      const pullListingBack = async () => {
        await executeMarketContractCallOnChain({
          signerAccountId: actorAccount || undefined,
          methodName: 'unlist_fish_nft',
          args: { listing_id: listingId },
        }).catch(() => null);
      };
      try {
        const resp = await fetch(resolveApiUrl('/api/npc-trade'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'execute',
            sessionId: serverSessionId,
            listingId,
            playerAccount: actorAccount,
          }),
        });
        const data = (await resp.json().catch(() => null)) as any;
        if (!data?.ok) {
          await pullListingBack();
          return {
            ok: false as const,
            reason: typeof data?.reason === 'string' ? data.reason : 'failed',
          };
        }
      } catch {
        await pullListingBack();
        return { ok: false as const, reason: 'failed' };
      }
      // Kai owns the fish now and the RESPITE landed in the player's
      // contract balance — re-read it from chain (wallet principle).
      setCaughtFishBucket((prev) => prev.filter((f) => f.id !== fish.id));
      const resolvedActor = listRes.signerAccountId || actorAccount;
      const liveRespiteStr = await fetchNep141Balance(
        NEAR_CONFIG.nep141RespiteContractId,
        resolvedActor,
      ).catch(() => null);
      if (liveRespiteStr !== null) {
        setRespiteBalance(Math.max(0, Number(liveRespiteStr) || 0));
      }
      return { ok: true as const };
    },
    [playerUid],
  );

  const getKaiTradeContext = useCallback(
    (fish: CaughtFishItem): { memoryFinalPrice: number | null; patience: number } => {
      const playerKey = hudRef.current.nearWalletId || playerUid || 'guest';
      const ledger = kaiLedgerRef.current;
      if (!ledger) return { memoryFinalPrice: null, patience: 3 };
      const memoryFinalPrice = getNpcMemoryFinalOffer(
        ledger,
        playerKey,
        fish.speciesId,
        Date.now(),
      );
      let patience = memoryFinalPrice != null ? 2 : 3;
      const poolNow = Math.max(0, Math.round(marketStateRef.current.treasuryLulPool));
      const dayKey = new Date().toISOString().slice(0, 10);
      const rolled = rollNpcTreasuryDay(ledger, dayKey, poolNow);
      const dailyBudget = Math.floor(
        rolled.poolStartOfDay * NPC_TREASURY_RULES.dailyVelocityPct,
      );
      if (
        rolled.breakerTripped ||
        (dailyBudget > 0 && dailyBudget - rolled.spentToday <= dailyBudget * 0.25)
      ) {
        patience = 1;
      }
      return { memoryFinalPrice, patience };
    },
    [playerUid],
  );

  const handleSellRawFishNegotiated = useCallback(
    (
      fish: CaughtFishItem,
      agreedPriceLul: number,
      roundsUsed: number = 99,
    ): { ok: true } | { ok: false; reason: NpcPurchaseRefusal } => {
      const actorAccount = hudRef.current.nearWalletId || playerUid;
      const standardLul = Math.max(5, fish.sellValueLul || fish.sellValueCyon || 25);
      // Defense in depth: whatever reached this handler, a negotiated price
      // never settles above the negotiation ceiling for this fish. Accepting
      // the first offer untouched earns the quick-deal bonus inside it.
      const envelope = evaluateNegotiationEnvelope(standardLul);
      const earnedLul = Math.min(
        envelope.ceiling,
        Math.max(1, Math.round(agreedPriceLul)) +
          quickDealBonusLul(standardLul, roundsUsed),
      );
      // Treasury discipline (plan Bagian 13): Kai pays out of his LUL pool,
      // inside the daily velocity budget, per-player cap, locked reserve,
      // and circuit breaker. A refusal changes nothing — the player keeps
      // the fish and Kai says why, in character.
      const poolNow = Math.max(0, Math.round(marketStateRef.current.treasuryLulPool));
      const dayKey = new Date().toISOString().slice(0, 10);
      const nowIso = new Date().toISOString();
      const playerKey = actorAccount || 'guest';
      const rolled = rollNpcTreasuryDay(
        kaiLedgerRef.current ?? createNpcTreasuryLedger(dayKey, poolNow),
        dayKey,
        poolNow,
      );
      const verdict = evaluateNpcPurchase(rolled, poolNow, {
        playerKey,
        price: earnedLul,
        dayKey,
        nowIso,
      });
      kaiLedgerRef.current = rolled;
      if (!verdict.allowed) {
        void saveNpcTreasuryLedgerToSupabase('beach_house', rolled);
        return { ok: false, reason: verdict.reason ?? 'pool' };
      }
      soundEngine.playPickup();
      const poolAfter = Math.max(0, poolNow - earnedLul);
      const recorded = recordNpcPurchase(rolled, poolAfter, {
        playerKey,
        price: earnedLul,
        dayKey,
        nowIso,
        speciesId: fish.speciesId,
        baseValue: standardLul,
      });
      kaiLedgerRef.current = recorded;
      void saveNpcTreasuryLedgerToSupabase('beach_house', recorded);
      setMarketState((prev) => ({ ...prev, treasuryLulPool: poolAfter }));
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
          reasoning_summary: `Sold ${fish.speciesName} (${fish.weightKg} kg, ${fish.rarity}) to Kai · +${earnedLul} LUL.`,
        });
      }
      return { ok: true };
    },
    [cyonBalance, dispatchBuddyAction, playerUid, respiteBalance],
  );

  const handleMintCaughtFishNft = useCallback(
    async (fish: CaughtFishItem): Promise<boolean> => {
      soundEngine.playPickup();
      const actorAccount = hudRef.current.nearWalletId || playerUid;
      const tokenSuffix = Math.floor(1000 + Math.random() * 9000);
      const nftTokenId = `nep171-fish-${fish.speciesId}-${tokenSuffix}`;
      const weightKgX100 = Math.max(1, Math.round(fish.weightKg * 100));
      // Contract v1.4.0: a fish NFT can only be minted with a server
      // attestation over the catch (see api/fish-attest). Without one the
      // mint is not attempted at all.
      let attestation: { signatureHex: string; issuedAtMs: number } | null = null;
      if (actorAccount) {
        try {
          const attestResp = await fetch(resolveApiUrl('/api/fish-attest'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerAccount: actorAccount,
              tokenId: nftTokenId,
              speciesId: fish.speciesId,
              waterZone: fish.waterZone,
              rarity: fish.rarity,
              weightKgX100,
            }),
          });
          const attestData = (await attestResp.json().catch(() => null)) as
            | { ok?: boolean; signatureHex?: string; issuedAtMs?: number }
            | null;
          if (
            attestData?.ok &&
            attestData.signatureHex &&
            typeof attestData.issuedAtMs === 'number'
          ) {
            attestation = {
              signatureHex: attestData.signatureHex,
              issuedAtMs: attestData.issuedAtMs,
            };
          }
        } catch {
          attestation = null;
        }
      }
      if (!attestation) return false;
      const res = await executeMarketContractCallOnChain({
        signerAccountId: actorAccount || undefined,
        methodName: 'mint_fish_nft_attested',
        args: {
          token_id: nftTokenId,
          species_id: fish.speciesId,
          species_name: fish.speciesName,
          water_zone: fish.waterZone,
          rarity: fish.rarity,
          weight_kg_x100: weightKgX100,
          signature_hex: attestation.signatureHex,
          issued_at_ms: attestation.issuedAtMs,
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
          reasoning_summary: `Saved ${fish.speciesName} (${fish.weightKg} kg, ${fish.rarity}) as an NFT collectible.`,
          near_tx_hash: res.txHash,
        });
      }
      return true;
    },
    [cyonBalance, ownedMerchantItemIds, playerUid, respiteBalance],
  );

  // Keyboard support (KeyF or Space while fishing) for Shoreline Hold-to-Charge, Strike & Hold-to-Reel
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
          launchShorelineCast(fishingCastPower);
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
    launchShorelineCast,
    nearbyWaterZone.canFish,
  ]);

  const currentAtmosphereViewportTint = evaluateWeatherAndTimeState({
    timeOfDayHours,
    weatherCondition,
    rainIntensityTier,
    cityLightsScale,
  }).viewportTint;
  const isFullMapOverview =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('fullmap') === '1' ||
      Boolean(new URLSearchParams(window.location.search).get('planeview')) ||
      Boolean(new URLSearchParams(window.location.search).get('skyshieldview')) ||
      Boolean(new URLSearchParams(window.location.search).get('buildingview')) ||
      Boolean(new URLSearchParams(window.location.search).get('parkview')));
  const peacefulUiState = evaluateLobbyAndSafezonePeacefulState({
    worldMode,
    isInsideLobbySafezone: Boolean(hud.isInsideLobbySafezone),
    cityArenaMode: hud.cityArenaMode,
  });

  const handleStartCityTransitTravel = (
    destination: CityTransitDestinationSpec,
    originStationId: CityTransitStationId,
    team?: 'blue' | 'red',
  ) => {
    soundEngine.playUiClick();
    setActiveTeleportKioskModal('none');
    window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
    setActiveSpecialModal('none');
    setHanaPitchOrigin(null);
    setIsKioskModalOpen(false);
    setIsSocialChatModalOpen(false);
    setIsDailyMissionsModalOpen(false);
    if (tutorialStage === 'go_to_hana') {
      setTutorialStage('none');
    }
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
  };

  const handleViewModelHouse = (requestedStyle?: HouseArchitectureStyle) => {
    soundEngine.playUiClick();
    const targetStyle = requestedStyle ?? 'plaza_manor';
    setHouseArchitectureStyle(targetStyle);
    setActiveSpecialModal('none');
    setIsRealEstateCatalogModalOpen(false);
    setHanaPitchOrigin(null);
    setIsKioskModalOpen(false);
    setIsSocialChatModalOpen(false);
    setHouseEntryScanState('scanning');
    window.setTimeout(() => {
      soundEngine.playPickup();
      setHouseEntryScanState('verified');
      window.setTimeout(() => {
        setHouseEntryScanState('idle');
        setIsSampleHouseView(true);
        setIsInsidePrivateHouse(true);
      }, 600);
    }, 700);
  };

  const handleEnterOwnHouse = (requestedStyle?: HouseArchitectureStyle) => {
    soundEngine.playUiClick();
    const targetStyle =
      isOnChainHouseStyleLockedRef.current && ownedHouseStyleRef.current
        ? ownedHouseStyleRef.current
        : requestedStyle ?? ownedHouseStyleRef.current ?? houseArchitectureStyleRef.current;
    if (!isOnChainHouseStyleLockedRef.current) {
      setAndPersistHouseArchitectureStyle(targetStyle);
    } else {
      setHouseArchitectureStyle(targetStyle);
    }
    setActiveSpecialModal('none');
    setIsRealEstateCatalogModalOpen(false);
    setHanaPitchOrigin(null);
    setIsKioskModalOpen(false);
    setIsSocialChatModalOpen(false);
    setHouseEntryScanState('scanning');
    window.setTimeout(() => {
      soundEngine.playPickup();
      setHouseEntryScanState('verified');
      window.setTimeout(() => {
        setHouseEntryScanState('idle');
        setIsSampleHouseView(false);
        setIsInsidePrivateHouse(true);
      }, 600);
    }, 700);
  };

  const claimBasePlotNow = (style?: HouseArchitectureStyle) => {
    const account = hud.nearWalletId || playerUid;
    if (!account) return;
    if (style) {
      // Pin the Arena session to the deed style the player picked in the
      // build menu, so the claimed plot is built with that NFT's exterior.
      dispatchBuddyAction(
        `nearSyncWalletSession:${account}:1:${nep171Ledger.tokenId || hud.nearGamepassTokenId || ''}:${style}`,
      );
    }
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
  };

  const ownedHouseStyles: HouseArchitectureStyle[] = hasHouseOwnership
    ? Array.from(
        new Set(
          [ownedHouseStyle, houseArchitectureStyle].filter(
            (s): s is HouseArchitectureStyle => Boolean(s),
          ),
        ),
      )
    : [];

  const handleBuyHouseWithRespite = async (
    _priceRespite: number,
    requestedStyle?: HouseArchitectureStyle,
  ): Promise<boolean> => {
    const priceRespite = HOUSE_OWNERSHIP_PRICE_RESPITE;
    if (respiteBalance < priceRespite) return false;
    const chosenStyle: HouseArchitectureStyle =
      requestedStyle ?? houseArchitectureStyleRef.current;
    const actorAccount = hud.nearWalletId || playerUid;
    const res = await executeMarketContractCallOnChain({
      signerAccountId: actorAccount || undefined,
      methodName: 'purchase_citizen_asset',
      args: {
        asset_id: 'house_ownership',
        plan_id: chosenStyle,
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
    setOwnedHouseStyle(chosenStyle);
    setIsOnChainHouseStyleLocked(true);
    setHouseArchitectureStyle(chosenStyle);
    if (resolvedActor) {
      persistHouseStyleLocally(resolvedActor, chosenStyle);
      void createLetterForAccount({
        recipientAccount: resolvedActor,
        kind: 'property_purchase',
        title: 'Real Estate Sales Contract — House Deed',
        payload: {
          buyerAccount: resolvedActor,
          sellerName: 'Buddies Blitz',
          sellerAccount: 'buddiesblitz.testnet',
          itemName: 'House Ownership Certificate',
          assetKind: 'house',
          houseStyle: chosenStyle,
          deedTokenId,
          priceAmount: priceRespite,
          priceCurrency: 'RESPITE',
          settlementContract: NEAR_CONFIG.marketContractId,
        },
        txHash: res.txHash,
      });
    }
    if (resolvedActor) {
      dispatchBuddyAction(
        `nearSyncWalletSession:${resolvedActor}:1:${deedTokenId}:${chosenStyle}`,
      );
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
        unlockedSkins: buildProfileUnlockedSkins(characterGender, chosenStyle),
      });
      void logMarketTransactionToSupabase({
        merchant_id: merchantLocation,
        actor_near_account: resolvedActor,
        action_type: 'buy_item',
        item_id: `house_ownership:${chosenStyle}`,
        nep245_token_id: deedTokenId,
        currency: 'RESPITE',
        amount: 1,
        unit_price: priceRespite,
        reasoning_summary: `Bought your house · ${chosenStyle} · ${priceRespite} RESPITE.`,
        near_tx_hash: res.txHash,
      });
    }
    return true;
  };

  const handleCreatePropertyListing = async ({
    assetKind,
    assetId,
    priceRespite,
  }: {
    assetKind: 'house' | 'furniture';
    assetId: string;
    assetLabel: string;
    priceRespite: number;
  }): Promise<boolean> => {
    const seller = hud.nearWalletId || '';
    if (!seller) return false;
    const price = Math.floor(Number(priceRespite) || 0);
    if (price < 1 || price > 100000) return false;
    if (assetKind === 'house') {
      const estate = await fetchBuddiesMarketEstate(seller).catch(() => null);
      const deedId = estate?.house_deed?.deed_token_id || '';
      if (!deedId) return false;
      const res = await executeMarketContractCallOnChain({
        signerAccountId: seller,
        methodName: 'list_property_deed',
        args: { token_id: deedId, price_respite: String(price) },
      });
      if (!res.ok) return false;
      setHasHouseOwnership(false);
      setOwnedHouseStyle(null);
      setIsOnChainHouseStyleLocked(false);
    } else {
      const item = MERCHANT_CATALOG_ITEMS.find((i) => i.id === assetId);
      if (!item?.tokenId) return false;
      const res = await executeMarketContractCallOnChain({
        signerAccountId: seller,
        methodName: 'list_property_furniture',
        args: { token_id: item.tokenId, amount: '1', price_respite: String(price) },
      });
      if (!res.ok) return false;
      setOwnedMerchantItemIds((prev) => {
        const idx = prev.indexOf(assetId);
        return idx < 0 ? prev : prev.filter((_, i) => i !== idx);
      });
    }
    await refreshPropertyListings();
    return true;
  };

  const handleCancelPropertyListing = async (listingId: string): Promise<void> => {
    const listing = propertyListings.find((l) => l.id === listingId);
    if (!listing || listing.status !== 'active') return;
    const seller = hud.nearWalletId || '';
    if (!seller || listing.seller_account.toLowerCase() !== seller.toLowerCase()) return;
    setBusyPropertyListingId(listing.id);
    try {
      const res = await executeMarketContractCallOnChain({
        signerAccountId: seller,
        methodName: 'cancel_property_listing',
        args: { listing_id: listing.id },
      });
      if (!res.ok) return;
      if (listing.asset_kind === 'house') {
        setHasHouseOwnership(true);
        void refreshOnChainBalances(seller);
      } else {
        setOwnedMerchantItemIds((prev) => [...prev, listing.asset_id]);
      }
      await refreshPropertyListings();
    } finally {
      setBusyPropertyListingId(null);
    }
  };

  const handleBuyPropertyListing = async (listing: DbPropertyListingRow): Promise<boolean> => {
    const buyer = hud.nearWalletId || '';
    if (!buyer || listing.status !== 'active') return false;
    if (listing.seller_account.toLowerCase() === buyer.toLowerCase()) return false;
    setBusyPropertyListingId(listing.id);
    try {
      const res = await executeMarketContractCallOnChain({
        signerAccountId: buyer,
        methodName: 'buy_property',
        args: { listing_id: listing.id },
      });
      if (!res.ok || !res.txHash) return false;
      const liveBal = await fetchNep141Balance(
        NEAR_CONFIG.nep141RespiteContractId,
        buyer,
      ).catch(() => null);
      if (liveBal !== null) {
        setRespiteBalance(Math.max(0, Number(liveBal) || 0));
      } else {
        setRespiteBalance((prev) => Math.max(0, prev - listing.price_respite));
      }
      if (listing.asset_kind === 'house') {
        setHasHouseOwnership(true);
        void refreshOnChainBalances(buyer);
      } else {
        setOwnedMerchantItemIds((prev) => [...prev, listing.asset_id]);
      }
      void createLetterForAccount({
        recipientAccount: buyer,
        kind: listing.asset_kind === 'house' ? 'property_purchase' : 'item_purchase',
        title:
          listing.asset_kind === 'house'
            ? 'Real Estate Sales Contract — House Deed'
            : 'Certificate of Ownership — Furniture NFT',
        payload: {
          buyerAccount: buyer,
          sellerAccount: listing.seller_account,
          itemName:
            listing.asset_kind === 'house'
              ? 'House Ownership Certificate'
              : (MERCHANT_CATALOG_ITEMS.find((i) => i.id === listing.asset_id)?.name ??
                listing.asset_id),
          itemId: listing.asset_id,
          tokenId:
            listing.asset_kind === 'house'
              ? listing.asset_id
              : MERCHANT_CATALOG_ITEMS.find((i) => i.id === listing.asset_id)?.tokenId,
          assetKind: listing.asset_kind,
          deedTokenId: listing.asset_kind === 'house' ? listing.asset_id : undefined,
          priceAmount: listing.price_respite,
          priceCurrency: 'RESPITE',
          settlementContract: NEAR_CONFIG.marketContractId,
          paymentTx: res.txHash,
        },
        txHash: res.txHash,
      });
      await refreshPropertyListings();
      return true;
    } finally {
      setBusyPropertyListingId(null);
    }
  };

  const handleCompletePropertyTransfer = async (): Promise<boolean> => false;

  const handleBuyCatalogMerchantItem = async (
    item: MerchantCatalogItem,
    finalPrice: number,
  ): Promise<{ ok: boolean; txHash?: string; explorerUrl?: string }> => {
    soundEngine.playUiClick();
    if (
      item.category === 'nft_collector_furniture' &&
      !hasHouseOwnership &&
      !hud.nearHasGamepassNft
    ) {
      return { ok: false };
    }
    if (!item.interiorSlot && ownedMerchantItemIds.includes(item.id)) return { ok: false };
    const actorAccount = hud.nearWalletId || playerUid;
    if (item.currency === 'RESPITE' && !actorAccount) {
      setIsNearWalletSelectorOpen(true);
      return { ok: false };
    }
    let nextCyon = cyonBalance;
    let nextRespite = respiteBalance;
    let onChainBuyReceipt: { txHash?: string; explorerUrl?: string } = {};
    if (item.currency === 'CYON') {
      if (cyonBalance < finalPrice) return { ok: false };
      nextCyon = Math.max(0, cyonBalance - finalPrice);
      setCyonBalance(nextCyon);
    } else {
      if (respiteBalance < finalPrice) return { ok: false };
      const buyRes = await executeMarketContractCallOnChain({
        signerAccountId: actorAccount || undefined,
        methodName: 'buy_merchant_item',
        args: {
          token_id: item.tokenId,
          amount: '1',
          price_respite: String(finalPrice),
        },
      });
      if (!buyRes.ok || !buyRes.txHash) return { ok: false };
      onChainBuyReceipt = { txHash: buyRes.txHash, explorerUrl: buyRes.explorerUrl };
      void createLetterForAccount({
        recipientAccount: actorAccount,
        kind: 'item_purchase',
        title: `Certificate of Ownership — ${item.name}`,
        payload: {
          buyerAccount: actorAccount,
          sellerName: merchantLocation === 'beach_house' ? 'Kai Fish Market' : 'Hana Property & Housing',
          sellerAccount: 'buddiesblitz.testnet',
          itemName: item.name,
          itemId: item.id,
          tokenId: item.tokenId,
          assetKind: item.category,
          priceAmount: finalPrice,
          priceCurrency: 'RESPITE',
          settlementContract: NEAR_CONFIG.marketContractId,
        },
        txHash: buyRes.txHash,
      });
      const resolvedActor = buyRes.signerAccountId || actorAccount;
      nextRespite = Math.max(0, respiteBalance - finalPrice);
      const liveRespiteStr = await fetchNep141Balance(
        NEAR_CONFIG.nep141RespiteContractId,
        resolvedActor,
        'optimistic',
      );
      if (liveRespiteStr !== null) {
        nextRespite = Math.max(0, Number(liveRespiteStr) || 0);
      }
      setRespiteBalance(nextRespite);
    }
    const nextOwned = [...ownedMerchantItemIds, item.id];
    setOwnedMerchantItemIds(nextOwned);
    if (item.category === 'nft_house_theme') {
      setActiveHouseThemeId(item.id);
      dispatchBuddyAction(
        `applyHouseTheme:${item.skinThemeId ?? 'military_standard'}:${item.gardenPresetId ?? 'sakura_grove'}`,
      );
    } else if (item.interiorSlot) {
      const slotId = item.interiorSlot;
      setInteriorPlacement((prev) => {
        if (prev[slotId] !== null) return prev;
        const next = { ...prev, [slotId]: item.id };
        housePersistRef.current.slot = next;
        return next;
      });
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
          near_tx_hash: onChainBuyReceipt.txHash,
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
    return { ok: true, ...onChainBuyReceipt };
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden select-none">
      {/* 1. 60FPS 3D Buddies Blitz Grassland Arena (Persistent Scene Across Transit & World Modes) */}
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

      {/* Glasshouse Cafe Lazy-Loading Overlay */}
      {isPreloadComplete && !isWorldLoading && isCafeInteriorLoading && (
        <div
          data-cafe-loading="true"
          className="fixed inset-0 z-[140] bg-[#0b0d12] flex flex-col items-center justify-center gap-4 select-none pointer-events-auto"
        >
          <div className="-skew-x-12 px-8 py-4 bg-[#b8ff3c] text-[#0d0f12] border-4 border-[#0d0f12] ring-4 ring-white shadow-[6px_6px_0_#0d0f12] font-black text-2xl sm:text-3xl tracking-widest uppercase">
            <span className="skew-x-12 inline-block">ENTERING CAFE...</span>
          </div>
          <p className="text-xs sm:text-sm font-black tracking-widest uppercase text-white/85">
            Preparing Glasshouse Cafe Interior
          </p>
        </div>
      )}

      {/* Grand Casino Lazy-Loading Overlay */}
      {isPreloadComplete && !isWorldLoading && isCasinoInteriorLoading && (
        <div
          data-casino-loading="true"
          className="fixed inset-0 z-[140] bg-[#160b0d] flex flex-col items-center justify-center gap-4 select-none pointer-events-auto"
        >
          <div className="-skew-x-12 px-8 py-4 bg-[#facc15] text-[#0d0f12] border-4 border-[#0d0f12] ring-4 ring-white shadow-[6px_6px_0_#0d0f12] font-black text-2xl sm:text-3xl tracking-widest uppercase">
            <span className="skew-x-12 inline-block">ENTERING CASINO...</span>
          </div>
          <p className="text-xs sm:text-sm font-black tracking-widest uppercase text-amber-200/90">
            Preparing Luxury Grand Casino Interior
          </p>
        </div>
      )}

      {/* Beauty & Glow Salon Lazy-Loading Overlay */}
      {isPreloadComplete && !isWorldLoading && isSalonInteriorLoading && (
        <div
          data-salon-loading="true"
          className="fixed inset-0 z-[140] bg-[#2a1d1b] flex flex-col items-center justify-center gap-4 select-none pointer-events-auto"
        >
          <div className="-skew-x-12 px-8 py-4 bg-[#f9a8d4] text-[#0d0f12] border-4 border-[#0d0f12] ring-4 ring-white shadow-[6px_6px_0_#0d0f12] font-black text-2xl sm:text-3xl tracking-widest uppercase">
            <span className="skew-x-12 inline-block">ENTERING BEAUTY SALON...</span>
          </div>
          <p className="text-xs sm:text-sm font-black tracking-widest uppercase text-pink-200/90">
            Preparing Beauty &amp; Glow Studio Interior
          </p>
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
            <div className="-skew-x-12 px-8 py-4 bg-[#b8ff3c] text-[#0d0f12] border-4 border-[#0d0f12] ring-4 ring-white shadow-[6px_6px_0_#0d0f12] font-black text-2xl sm:text-3xl tracking-widest uppercase">
              <span className="skew-x-12 inline-block">LOADING...</span>
            </div>
            <div className="text-xs sm:text-sm font-black tracking-widest uppercase text-[#00d2ff]">
              {(loadingTargetMode ?? worldMode) === 'safezone'
                ? 'ENTERING THE CITY'
                : (loadingTargetMode ?? worldMode) === 'lobby'
                ? 'ENTERING CENTRAL PLAZA'
                : `ENTERING WARZONE (${worldInitialTeam.toUpperCase()} TEAM)`}
            </div>
            {/* Loading Bar */}
            <div className="w-56 sm:w-64 h-2.5 bg-[#14161d] border-2 border-white/70 rounded-full overflow-hidden mt-1 shadow-[2px_2px_0_#000]">
              <div className="h-full bg-[#b8ff3c] w-full" />
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
          backgroundColor: currentAtmosphereViewportTint.colorHex,
          opacity: currentAtmosphereViewportTint.opacity,
        }}
      />

      {/* =====================================================================
          2. LIVE 3D LANDING PAGE (NO-AVATAR CITY TOUR + NEW NEO-COMIC LOGO)
         ===================================================================== */}
      {isPreloadComplete && gameState === 'title' && (
        <section
          aria-label="Buddies Blitz Live Landing Page"
          data-live-landing="true"
          className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-none select-none"
        >
          {/* Subtle atmospheric edge vignette keeping the live 3D City Tour crystal-clear */}
          <div
            aria-hidden="true"
            className="fixed inset-0 bg-gradient-to-b from-black/55 via-black/15 to-black/70 pointer-events-none"
          />

          {/* Compact Neo-Comic Top Navigation Bar */}
          <header className="relative z-10 flex items-center justify-between px-4 sm:px-8 pt-4 sm:pt-6">
            <div className="flex items-center gap-2.5 pointer-events-auto">
              <div className="-skew-x-6 px-3.5 py-1.5 bg-[#b8ff3c] text-black border-3 border-black shadow-[4px_4px_0_#000] font-black text-xs uppercase tracking-widest">
                <span className="skew-x-6 inline-block">BUDDIES BLITZ</span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-[#14161d]/90 text-white border-2 border-black shadow-[3px_3px_0_#000] text-[10px] font-black uppercase tracking-widest">
                <span className="w-2 h-2 rounded-full bg-[#b8ff3c] animate-pulse" />
                <span>LIVE WORLD</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 pointer-events-auto">
              <HudAudioVolumeControl
                contextId="landing"
                popoverPlacement="bottom"
                hideMusicButton
                isMusicMuted={isMusicMuted}
                isSfxMuted={isMuted}
                musicVolumePct={musicVolumePct}
                sfxVolumePct={audioVolumePct}
                onToggleMusicMute={handleToggleMusic}
                onToggleSfxMute={handleToggleAudio}
                onChangeMusicVolumePct={handleChangeMusicVolumePct}
                onChangeSfxVolumePct={handleChangeVolumePct}
              />

              <button
                type="button"
                data-landing-login-btn="true"
                onClick={() => handleStartGame(false)}
                className="-skew-x-6 px-4 py-2 bg-white hover:bg-slate-100 text-black border-3 border-black shadow-[4px_4px_0_#000] font-black text-xs uppercase tracking-wider cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              >
                <span className="skew-x-6 inline-flex items-center gap-1.5">
                  <LogIn className="w-3.5 h-3.5 stroke-[2.6]" aria-hidden="true" />
                  <span>LOG IN</span>
                </span>
              </button>
            </div>
          </header>

          {/* Center Hero: Brand-New Geometric Neo-Comic Logo + PLAY NOW CTA */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 text-center">
            <div className="pointer-events-auto flex flex-col items-center gap-6 max-w-xl w-full">
              {/* Brand-New Custom BUDDIES BLITZ Comic Vector Emblem */}
              <svg
                viewBox="0 0 640 250"
                className="w-full max-w-[540px] drop-shadow-[0_14px_24px_rgba(0,0,0,0.6)]"
                role="img"
                aria-label="BUDDIES BLITZ"
              >
                <defs>
                  <linearGradient id="bb-lime-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#d9ff66" />
                    <stop offset="100%" stopColor="#a3ff1e" />
                  </linearGradient>
                  <linearGradient id="bb-cyan-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>

                {/* Top Skewed Eyebrow Ribbon */}
                <g transform="translate(185, 8) skewX(-10)">
                  <rect x="4" y="4" width="268" height="30" fill="#000000" />
                  <rect
                    x="0"
                    y="0"
                    width="268"
                    height="30"
                    fill="#14161d"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                  />
                  <text
                    x="134"
                    y="20"
                    textAnchor="middle"
                    fontFamily="'Barlow', sans-serif"
                    fontWeight="900"
                    fontSize="13"
                    letterSpacing="3.5"
                    fill="#38bdf8"
                  >
                    3D SOCIAL CITY
                  </text>
                </g>

                {/* Upper Plate: BUDDIES (Crisp White + Heavy Comic Drop Block) */}
                <g transform="translate(52, 46) skewX(-8)">
                  <rect x="10" y="10" width="530" height="88" fill="#000000" />
                  <rect
                    x="0"
                    y="0"
                    width="530"
                    height="88"
                    fill="#14161d"
                    stroke="#ffffff"
                    strokeWidth="5"
                  />
                  <rect x="8" y="8" width="12" height="72" fill="url(#bb-cyan-grad)" />
                  <text
                    x="276"
                    y="67"
                    textAnchor="middle"
                    fontFamily="'Barlow', sans-serif"
                    fontWeight="900"
                    fontStyle="italic"
                    fontSize="74"
                    letterSpacing="6"
                    fill="#ffffff"
                    stroke="#000000"
                    strokeWidth="12"
                    paintOrder="stroke fill"
                  >
                    BUDDIES
                  </text>
                </g>

                {/* Lower Plate: BLITZ (Neon Lime Power Plate + Twin Lightning Cut) */}
                <g transform="translate(116, 134) skewX(-10)">
                  <rect x="10" y="10" width="420" height="82" fill="#000000" />
                  <rect
                    x="0"
                    y="0"
                    width="420"
                    height="82"
                    fill="url(#bb-lime-grad)"
                    stroke="#000000"
                    strokeWidth="6"
                  />
                  <rect
                    x="5"
                    y="5"
                    width="410"
                    height="72"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    strokeOpacity="0.65"
                  />
                  <text
                    x="230"
                    y="63"
                    textAnchor="middle"
                    fontFamily="'Barlow', sans-serif"
                    fontWeight="900"
                    fontStyle="italic"
                    fontSize="66"
                    letterSpacing="9"
                    fill="#14161d"
                  >
                    BLITZ
                  </text>

                  {/* Left Twin Lightning Emblem */}
                  <polygon
                    points="38,14 66,14 52,38 72,38 34,70 46,44 26,44"
                    fill="#14161d"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                </g>
              </svg>

              {/* Single Bold Primary CTA */}
              <button
                type="button"
                data-start="true"
                onClick={() => handleStartGame(false)}
                aria-label="PLAY NOW"
                className="-skew-x-6 px-10 sm:px-12 py-4 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-4 border-black ring-4 ring-white shadow-[8px_8px_0_#000] font-black text-xl sm:text-2xl uppercase tracking-widest cursor-pointer hover:-translate-y-0.5 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all"
              >
                <span className="skew-x-6 inline-flex items-center gap-3">
                  <Play className="w-6 h-6 fill-black stroke-[2.5]" aria-hidden="true" />
                  <span>PLAY NOW</span>
                </span>
              </button>
            </div>
          </div>

          {/* Ultra-Clean Minimal Footer */}
          <footer className="relative z-10 pb-5 px-4 flex justify-center">
            <div className="px-4 py-1 bg-[#14161d]/85 text-slate-300 border-2 border-black shadow-[3px_3px_0_#000] text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-center">
              EXPLORE THE CITY &nbsp;•&nbsp; OWN A HOME &nbsp;•&nbsp; MEET PEOPLE &nbsp;•&nbsp; TRADE &amp; GET RICH &nbsp;•&nbsp; NEAR TESTNET
            </div>
          </footer>
        </section>
      )}

      {/* =====================================================================
          2B. UNIFIED SINGLE 'START GAME' MODAL CARD:
              All onboarding states stay inside this single START GAME card
              without ever stacking a second modal overlay. Hidden cleanly during
              'fly_to_plaza' so the camera swoop to Central Plaza is unobstructed.
         ===================================================================== */}
      {isPreloadComplete &&
        gameState === 'playing' &&
        !isFullMapOverview &&
        onboardingStep === 'fly_to_plaza' && (
          <div
            aria-label="Flying to Central Plaza"
            data-onboarding-step="fly_to_plaza"
            className="fixed inset-x-0 bottom-7 z-40 flex justify-center pointer-events-none select-none"
          >
            <div className="-skew-x-6 px-5 py-2 bg-[#14161d]/95 text-white border-3 border-black ring-2 ring-white shadow-[5px_5px_0_#000] text-xs font-black uppercase tracking-widest">
              <span className="skew-x-6 inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#b8ff3c] animate-ping" />
                <span>FLYING TO CENTRAL PLAZA...</span>
              </span>
            </div>
          </div>
        )}

      {isPreloadComplete &&
        gameState === 'playing' &&
        !isFullMapOverview &&
        onboardingStep !== 'completed' &&
        onboardingStep !== 'fly_to_plaza' && (
          <section
            aria-label="Buddies Blitz Login & Onboarding"
            data-onboarding-step={onboardingStep}
            className={`fixed inset-0 z-50 flex flex-col ${
              onboardingStep === 'guest_character_select'
                ? 'justify-end items-center py-6 px-4 pointer-events-none'
                : 'items-center justify-center p-4 bg-black/70 pointer-events-auto'
            } select-none`}
          >
            <div
              data-start-game-card="true"
              className="relative pointer-events-auto w-full max-w-sm bg-[#14161d] text-white border-4 border-black ring-4 ring-white shadow-[8px_8px_0_#000] p-6 space-y-4"
            >
              {onboardingStep === 'auth_choice' && (
                <button
                  type="button"
                  aria-label="Close login modal"
                  onClick={() => {
                    soundEngine.playUiClick();
                    document.body.dataset.state = 'title';
                    setGameState('title');
                  }}
                  className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Compact Game Title Header (Always in the Single START GAME Card) */}
              <div className="text-center space-y-1 border-b border-white/15 pb-3.5">
                <div className="inline-block -skew-x-12 px-3 py-0.5 bg-[#b8ff3c] text-black border-2 border-black shadow-[2px_2px_0_#000] font-black text-[11px] uppercase tracking-widest">
                  <span className="skew-x-12 inline-block">BUDDIES BLITZ</span>
                </div>
                <h1 className="text-2xl font-black uppercase tracking-wide text-white pt-1">
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
                  {/* 1. Primary CTAs: Google OAuth & Play as Guest */}
                  <div className="space-y-3">
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

                    <div className="space-y-3">
                      <button
                        type="button"
                        data-connect-wallet-enter-btn="true"
                        disabled={isVerifyingNearWallet || privyOAuthLoading}
                        onClick={() => void handleStartGoogleLoginAndOpenWalletNaming()}
                        className="-skew-x-6 w-full py-3 px-4 bg-white hover:bg-slate-100 disabled:opacity-60 text-black border-3 border-black shadow-[4px_4px_0_#000] font-black text-xs sm:text-sm uppercase tracking-wider cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                      >
                        <span className="skew-x-6 flex items-center justify-center gap-2.5">
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
                        data-login-guest-btn="true"
                        onClick={() => {
                          soundEngine.playUiClick();
                          setWalletConnectError(null);
                          setConnectedExternalWalletId('');
                          setOnboardingAuthMode('guest');
                          setConnectedGoogleEmail('');
                          setCharacterGender('male');
                          setIsCustomGuestNameEdited(false);
                          setPlayerDisplayName('Buddy Male');
                          dispatchBuddyAction('setCharacterGender:male');
                          beginPlazaFlyToOnboarding('character_select', 'guest_character_select');
                        }}
                        className="-skew-x-6 w-full py-3 px-4 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-3 border-black shadow-[4px_4px_0_#000] font-black text-xs sm:text-sm uppercase tracking-wider cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                      >
                        <span className="skew-x-6 inline-block">PLAY AS GUEST</span>
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
                            setConnectedExternalWalletId('');
                            setOnboardingAuthMode('wallet');
                            beginPlazaFlyToOnboarding('character_select', 'guest_character_select');
                          }}
                          className="w-full py-1.5 px-2 bg-[#b8ff3c] text-black border border-black font-black uppercase text-[10px] cursor-pointer"
                        >
                          CHOOSE CHARACTER &amp; PLAY
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

                  {/* 2. External NEAR Wallet Link */}
                  <div className="pt-0.5 pb-1 text-center">
                    <button
                      type="button"
                      data-open-near-wallet-selector-start-btn="true"
                      disabled={isVerifyingNearWallet || privyOAuthLoading}
                      onClick={() => {
                        soundEngine.playUiClick();
                        setWalletConnectError(null);
                        setIsNearWalletSelectorOpen(true);
                      }}
                      className="inline-flex items-center justify-center gap-2 text-xs font-bold text-slate-200 hover:text-white disabled:opacity-60 cursor-pointer transition-colors"
                    >
                      <Wallet className="w-4 h-4 text-slate-300 shrink-0" aria-hidden="true" />
                      <span className="underline underline-offset-4">
                        Have a NEAR wallet? Connect it here
                      </span>
                    </button>
                  </div>
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
                        ? connectedExternalWalletId
                          ? 'Pick your character and display name.'
                          : 'Pick your character and display name — your account sets up automatically.'
                        : 'Explore freely. Sign in later to unlock trading.'}
                    </div>
                  </div>

                  {walletConnectError && (
                    <div
                      data-character-select-error="true"
                      className="p-2 bg-[#ff3b30]/20 border border-[#ff3b30] text-[#fca5a5] text-[10.5px] font-bold"
                    >
                      {walletConnectError}
                    </div>
                  )}

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
                      <span className="skew-x-6 inline-block">PLAY</span>
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
                  <div className="-skew-x-12 px-4 py-1.5 bg-[#38bdf8] text-black border-2 border-black shadow-[3px_3px_0_#000] font-black text-xs tracking-widest uppercase">
                    <span className="skew-x-12 inline-block">SETTING UP ACCOUNT...</span>
                  </div>

                  <div className="w-full p-2.5 bg-[#0f172a] border border-white/20 font-mono text-xs font-bold text-[#b8ff3c] break-all">
                    {subWalletHandleDraft
                      ? `${subWalletHandleDraft}.${NEAR_CONFIG.masterAccountId}`
                      : playerDisplayName.trim() || 'Preparing your player ID...'}
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
          2B. HANA WAYPOINT OBJECTIVE HUD BANNER
         ===================================================================== */}
      {isPreloadComplete &&
        onboardingStep === 'completed' &&
        tutorialStage === 'go_to_hana' &&
        !cityViewActive &&
        !isInsideGrandCasino &&
        !isInsideBeautySalon &&
        !isInsideGlasshouseCafe &&
        !isInsidePrivateHouse &&
        activeSpecialModal === 'none' &&
        activeTeleportKioskModal === 'none' &&
        !tramRideCutsceneUi?.active && (
          <div
            data-tutorial-objective-hud="true"
            className="fixed top-14 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-md pointer-events-auto select-none"
          >
            <div className="bg-[#0f172a]/95 text-white border-[3px] border-black shadow-[5px_5px_0_#000] px-3.5 py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2 py-0.5 border border-black text-[9.5px] font-black uppercase shrink-0 bg-[#b8ff3c] text-black">
                  HANA
                </span>
                <span className="text-[11px] font-bold text-slate-100 truncate">
                  Follow the blue path to Hana at Central Plaza — opens straight in Chat Session.
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
        !cityViewActive &&
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
                    soundEngine.playUiConfirm();
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
              3B. TOP-LEFT: COMPACT MINIMAP RADAR (Player Identity/Level/XP lives in PROFILE)
             ================================================================= */}
          <div className="fixed top-3 left-3 z-30 flex flex-col items-start gap-2 pointer-events-none">

            {/* Compact 1:1 Calibrated Radar (Hidden inside Lobby room, Private House, Glasshouse Cafe, Grand Casino & Beauty Salon interior) */}
            {!isInsidePrivateHouse &&
              !isInsideGlasshouseCafe &&
              !isInsideGrandCasino &&
              !isInsideBeautySalon &&
              activeSpecialModal !== 'npc_merchant' &&
              !isSocialChatModalOpen &&
              peacefulUiState.minimapRadarVisible &&
              (() => {
                const ccLevel = hud.commandCenterLevel ?? hud.baseBuildingLevel;
                const radarSpec = evaluateCommandCenterRadarSpec(ccLevel, true);
                const canOpenCityViewFromMinimap =
                  worldMode !== 'warzone' && playMode !== 'editor';
                const activeWalk = clickToWalkSync ?? hud.clickToWalk ?? null;
                const showWalkOverlay = Boolean(canOpenCityViewFromMinimap && activeWalk?.active);

                return (
                  <div className="pointer-events-none flex flex-col items-start gap-1.5 shrink-0">
                    <button
                      type="button"
                      aria-label={
                        canOpenCityViewFromMinimap
                          ? 'Buka City View'
                          : 'Mini Radar Arena'
                      }
                      title={
                        canOpenCityViewFromMinimap
                          ? 'Tekan Mini Map untuk melihat City View & pilih lokasi jalan'
                          : undefined
                      }
                      disabled={!canOpenCityViewFromMinimap}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        if (canOpenCityViewFromMinimap) {
                          selectCityViewTarget('kota', true);
                        }
                      }}
                      data-city-view-minimap-trigger={
                        canOpenCityViewFromMinimap ? 'true' : undefined
                      }
                      data-radar-level={radarSpec.level}
                      data-radar-active="true"
                      className={`pointer-events-auto relative block p-0 text-left appearance-none w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 bg-[#070a0f] border-3 border-[#1a1a1a] ring-2 ring-white rounded-xl overflow-hidden shadow-[4px_4px_0_#1a1a1a] shrink-0 transition-transform ${
                        canOpenCityViewFromMinimap
                          ? 'cursor-pointer hover:ring-[#b8ff3c] active:scale-[0.98]'
                          : ''
                      }`}
                    >
                      {/* 1:1 Orthographic Top-Down Map of the Current 3-Part Mirrored Arena ([-125, +125]) */}
                      <span className="absolute top-1 left-1 z-40 px-1 py-px bg-black/60 border border-white/40 rounded-sm text-[7px] font-black tracking-widest text-white pointer-events-none">
                        {worldMode === 'warzone' ? 'WARZONE' : 'CITY MAP'}
                      </span>
                      {worldMode === 'warzone' ? (
                        <img
                          src="/assets/kiosk/radar_arena_map.webp"
                          alt="Arena Radar Map"
                          draggable={false}
                          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
                        />
                      ) : (
                        <>
                          <img
                            src="/assets/kiosk/city_minimap.webp"
                            alt="City Map"
                            draggable={false}
                            className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
                          />
                          <div
                            aria-hidden="true"
                            className="absolute inset-0 select-none pointer-events-none"
                            style={{
                              backgroundImage:
                                'linear-gradient(rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.14) 1px, transparent 1px)',
                              backgroundSize: '12.5% 12.5%',
                            }}
                          />
                        </>
                      )}

                      {/* Dynamic Building Indicators for All Active Commander Base Plots */}
                      {worldMode === 'warzone' &&
                        (hud.activeBluePlotIndices ?? [0]).map((plotIdx) => {
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
                      {worldMode === 'warzone' &&
                        (hud.activeRedPlotIndices ?? []).map((plotIdx) => {
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

                      {worldMode === 'warzone' &&
                        LOBBY_FACTION_PORTALS.map((portal) => {
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
                      {worldMode === 'warzone' &&
                        (() => {
                          const tramShelterPos = worldCoordToRadarPercent(
                            LOBBY_TRAM_SHELTER_SPEC.returnPadX,
                            LOBBY_TRAM_SHELTER_SPEC.returnPadZ,
                          );
                          return (
                            <span
                              data-radar-tram-shelter="true"
                              style={{
                                left: `${tramShelterPos.leftPct}%`,
                                top: `${tramShelterPos.topPct}%`,
                              }}
                              className="absolute -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-xs bg-[#38bdf8] border border-white pointer-events-none"
                            />
                          );
                        })()}
                      {worldMode === 'warzone' &&
                        PUBLIC_WARZONE_CRATE_PADS.map((pubPad) => {
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

                      {/* CITY MAP landmarks & POI badges (display-only; clicking minimap opens 3D City View) */}
                      {worldMode !== 'warzone' && (
                        <>
                          {CITY_TRANSIT_DESTINATIONS.map((dest) => {
                            const pos = worldCoordToRadarPercent(dest.kioskX, dest.kioskZ);
                            return (
                              <span
                                key={`city-station-${dest.id}`}
                                data-radar-city-station={dest.id}
                                style={{ left: `${pos.leftPct}%`, top: `${pos.topPct}%` }}
                                className="absolute -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#0284c7] border border-[#1a1a1a] pointer-events-none"
                              />
                            );
                          })}
                          {CITY_MINIMAP_POIS.map((poi) => {
                            const pos = worldCoordToRadarPercent(poi.x, poi.z);
                            return (
                              <span
                                key={`city-poi-${poi.id}`}
                                data-radar-city-poi={poi.id}
                                style={{ left: `${pos.leftPct}%`, top: `${pos.topPct}%` }}
                                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20"
                              >
                                <span
                                  className={`block w-2 h-2 rounded-full border border-[#1a1a1a] ${poi.colorClass}`}
                                />
                                <span
                                  className={`absolute top-1/2 -translate-y-1/2 text-[6.5px] sm:text-[7px] font-black tracking-wide text-[#1a1a1a] whitespace-nowrap [text-shadow:0_1px_2px_#fff,0_0_3px_#fff] ${
                                    poi.labelSide === 'left' ? 'right-[7px]' : 'left-[7px]'
                                  }`}
                                >
                                  {poi.label}
                                </span>
                              </span>
                            );
                          })}
                        </>
                      )}

                      {/* Dashed Route Preview & Pulsing Destination Pin */}
                      {showWalkOverlay &&
                        activeWalk &&
                        (() => {
                          const playerDotNow = hud.radarDots.find((d) => d.kind === 'player');
                          const routePts: Array<{ leftPct: number; topPct: number }> = [];
                          if (playerDotNow) {
                            routePts.push(worldCoordToRadarPercent(playerDotNow.x, playerDotNow.z));
                          }
                          for (const wp of activeWalk.waypoints) {
                            routePts.push(worldCoordToRadarPercent(wp.x, wp.z));
                          }
                          const destPct = worldCoordToRadarPercent(
                            activeWalk.targetX,
                            activeWalk.targetZ,
                          );
                          const pointsStr = routePts
                            .map((p) => `${p.leftPct.toFixed(2)},${p.topPct.toFixed(2)}`)
                            .join(' ');
                          return (
                            <>
                              {routePts.length >= 2 && (
                                <svg
                                  viewBox="0 0 100 100"
                                  preserveAspectRatio="none"
                                  data-minimap-route-preview="true"
                                  className="absolute inset-0 w-full h-full z-20 pointer-events-none"
                                >
                                  <polyline
                                    points={pointsStr}
                                    fill="none"
                                    stroke="#14161d"
                                    strokeWidth="2.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    opacity="0.75"
                                  />
                                  <polyline
                                    points={pointsStr}
                                    fill="none"
                                    stroke="#b8ff3c"
                                    strokeWidth="1.55"
                                    strokeDasharray="3.2 2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                              <span
                                data-minimap-walk-dest="true"
                                style={{ left: `${destPct.leftPct}%`, top: `${destPct.topPct}%` }}
                                className="absolute -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none flex items-center justify-center"
                              >
                                <span className="absolute w-3.5 h-3.5 rounded-full bg-[#b8ff3c]/55 animate-ping" />
                                <span className="relative w-2.5 h-2.5 rounded-full bg-[#b8ff3c] border-2 border-[#14161d] shadow-[0_0_8px_#b8ff3c]" />
                              </span>
                            </>
                          );
                        })()}

                      {/* Live Scanned Radar Dots */}
                      {hud.radarDots.map((dot) => {
                        const { leftPct, topPct } = worldCoordToRadarPercent(dot.x, dot.z);
                        if (dot.kind === 'supply_drop') {
                          return (
                            <span
                              key={dot.id}
                              data-radar-dot="supply-drop-beacon"
                              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                              className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center z-30 pointer-events-none"
                            >
                              <span className="absolute inset-0 rounded-full border border-[#facc15]/80" />
                              <span className="relative w-3 h-3 rounded-full bg-[#facc15] border-2 border-[#1a1a1a] shadow-[0_0_8px_#facc15]" />
                            </span>
                          );
                        }
                        if (dot.kind === 'tank_red') {
                          return (
                            <span
                              key={dot.id}
                              data-radar-dot="enemy-heavy-vehicle"
                              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                              className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center z-30 pointer-events-none"
                            >
                              <span className="absolute inset-0 rounded-full border border-[#ff1e27]/80" />
                              <span className="relative w-3.5 h-3.5 rounded-full bg-[#ff1e27] border-2 border-[#ffe066] shadow-[0_0_8px_#ff1e27]" />
                            </span>
                          );
                        }
                        if (dot.kind === 'enemy') {
                          return (
                            <span
                              key={dot.id}
                              data-radar-dot="enemy-infantry"
                              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                              className="absolute -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#ff3b30] ring-1 ring-[#ff9aa8] shadow-[0_0_6px_#ff3b30] z-20 pointer-events-none"
                            />
                          );
                        }
                        if (dot.kind === 'barrel') {
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
                          return (
                            <span
                              key={dot.id}
                              data-radar-dot="pickup"
                              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                              className="absolute -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#00e5ff] ring-1 ring-white shadow-[0_0_4px_#00e5ff] z-10 pointer-events-none"
                            />
                          );
                        }
                        if (
                          dot.kind === 'crate_red' ||
                          dot.kind === 'crate_super' ||
                          dot.kind === 'crate_legend'
                        ) {
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
                    </button>

                    {/* Live Walking Distance + Cancel Pill */}
                    {showWalkOverlay && activeWalk && (
                      <div
                        data-click-to-walk-pill="true"
                        className="pointer-events-auto flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#14161d]/95 text-white border-2 border-[#b8ff3c] shadow-[3px_3px_0_#14161d] text-[10px] font-bold max-w-[210px]"
                      >
                        <Navigation className="w-3 h-3 text-[#b8ff3c] shrink-0" />
                        <span className="font-mono-tabular truncate">
                          {activeWalk.isOnScooter ? 'Scooter' : 'Walking'}{' '}
                          {activeWalk.remainingDistanceM}m
                          {activeWalk.targetLabel ? ` · ${activeWalk.targetLabel}` : ''}
                        </span>
                        <span className="text-white/40">·</span>
                        <button
                          type="button"
                          onClick={handleCancelClickToWalk}
                          className="px-1.5 py-0.5 rounded bg-[#ff3b30] hover:bg-[#ef4444] text-white font-black tracking-wide text-[9px] uppercase cursor-pointer shrink-0"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
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
                  data-top-near-badge="true"
                  title="NEAR — Wallet balance (swaps, purchases, network fees)"
                  className="-skew-x-12 px-2.5 py-1 bg-[#1a1a1a] text-white border-3 border-[#1a1a1a] shadow-[3px_3px_0_#1a1a1a] font-mono-tabular font-bold text-[11px]"
                >
                  <span className="skew-x-12 inline-block">
                    {nearTestnetBalance >= 1
                      ? nearTestnetBalance.toFixed(2)
                      : Number(nearTestnetBalance.toFixed(4))}{' '}
                    NEAR
                  </span>
                </div>

                <div
                  data-top-lul-badge="true"
                  title="LUL (Lulling) Session Currency"
                  className="-skew-x-12 px-2.5 py-1 bg-[#fec83e] text-[#1a1a1a] border-3 border-[#1a1a1a] shadow-[3px_3px_0_#1a1a1a] font-mono-tabular font-bold text-[11px]"
                >
                  <span className="skew-x-12 inline-block">
                    {hud.gold} LUL
                  </span>
                </div>

                <div
                  data-top-cyon-badge="true"
                  title="CYON — Shop currency exchanged from LUL"
                  className="-skew-x-12 px-2 py-1 bg-[#38bdf8] text-[#0f172a] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] font-mono-tabular font-bold text-[10px]"
                >
                  <span className="skew-x-12 inline-block">{cyonBalance} CYON</span>
                </div>

                <div
                  data-top-respite-badge="true"
                  title="RESPITE — Token for houses, companions, and Fish Market"
                  className="-skew-x-12 px-2 py-1 bg-[#d8b4fe] text-[#1e1b4b] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] font-mono-tabular font-bold text-[10px]"
                >
                  <span className="skew-x-12 inline-block">{respiteBalance} RESPITE</span>
                </div>

                {activeSpecialModal === 'npc_merchant' && (
                  <div
                    data-lobby-gold-exchange-btn="true"
                    title={merchantLocation === 'beach_house' ? 'Kai — Fisherman & Beach Keeper' : 'Hana — Property Agent & City Guide'}
                    className="-skew-x-12 px-2.5 py-1 bg-[#ffd700] text-[#1a1a1a] border-3 border-[#1a1a1a] shadow-[3px_3px_0_#1a1a1a] font-black text-[10px]"
                  >
                    <span className="skew-x-12 inline-block">
                      {merchantLocation === 'beach_house' ? 'Kai Fish Market' : 'Hana Property & Housing'}
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
              <div className="flex items-center gap-1.5 bg-[#0f172a]/95 text-white border-2 border-black shadow-[3px_3px_0_#000] px-2.5 py-1.5">
                <span className="px-1.5 py-0.5 bg-[#b8ff3c] text-black border border-black text-[9px] font-black uppercase tracking-wider">
                  {isSampleHouseView ? 'MODEL HOUSE' : 'MY PRIVATE HOUSE'}
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
                      className="px-2 py-0.5 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black border-2 border-black text-[9.5px] font-black uppercase cursor-pointer"
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
                      className="px-2 py-0.5 bg-[#facc15] hover:bg-[#fde047] text-black border-2 border-black text-[9.5px] font-black uppercase cursor-pointer"
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
                  className="px-2 py-0.5 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black text-[9.5px] font-black uppercase cursor-pointer"
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
                        publishPlayerSocialMessage({
                          text: 'Invited you to visit my Modern Japanese Wooden Pavilion Private House!',
                          recipient: { id: rawFriend, name: rawFriend },
                          roomId: 'house_interior',
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
                              publishPlayerSocialMessage({
                                text: 'Come hang out inside my Private House!',
                                recipient: { id: friendId, name: friendId },
                                roomId: 'house_interior',
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
              <div className="-skew-x-12 px-4 py-1.5 bg-[#fec83e] text-[#1a1a1a] border-3 border-[#1a1a1a] ring-2 ring-white shadow-[4px_4px_0_#1a1a1a] font-black text-xs sm:text-sm tracking-wider uppercase">
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
                      setIsDailyMissionsModalOpen(false);
                      setActiveSpecialModal('none');
                      setActiveTeleportKioskModal('none');
                      window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
                      window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
                      setIsGearModalOpen(false);
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
                      setIsDailyMissionsModalOpen(false);
                      setActiveSpecialModal('none');
                      setActiveTeleportKioskModal('none');
                      window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
                      window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
                      setIsGearModalOpen(false);
                      setIsWardrobeStudioOpen(false);
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
                    data-top-wardrobe-btn="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setIsTargetMenuExpanded(false);
                      setSelectedTargetUser(null);
                      setIsProfileModalOpen(false);
                      setIsKioskModalOpen(false);
                      setIsSocialChatModalOpen(false);
                      setIsPersonalWalletModalOpen(false);
                      setIsPersonalBagModalOpen(false);
                      setIsDailyMissionsModalOpen(false);
                      setIsFashionBoutiqueModalOpen(false);
                      setIsScooterShowroomModalOpen(false);
                      setIsRealEstateCatalogModalOpen(false);
                      setIsGrandCasinoModalOpen(false);
                      setActiveSpecialModal('none');
                      setActiveTeleportKioskModal('none');
                      window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
                      window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
                      setIsGearModalOpen(false);
                      setIsWardrobeStudioOpen(true);
                    }}
                    className="-skew-x-12 px-2.5 h-9 flex items-center justify-center gap-1.5 font-black text-xs bg-[#f0abfc] hover:bg-[#f5d0fe] text-[#1a1a1a] border-3 border-[#1a1a1a] ring-2 ring-white shadow-[3px_3px_0_#1a1a1a] transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                    title="Open UHD 3D Wardrobe Dressing Room Studio"
                  >
                    <span className="skew-x-12 flex items-center gap-1">
                      <Shirt className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                      <span>WARDROBE</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    data-top-gear-btn="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setIsTargetMenuExpanded(false);
                      setSelectedTargetUser(null);
                      setIsProfileModalOpen(false);
                      setIsKioskModalOpen(false);
                      setIsSocialChatModalOpen(false);
                      setIsPersonalWalletModalOpen(false);
                      setIsPersonalBagModalOpen(false);
                      setIsDailyMissionsModalOpen(false);
                      setActiveSpecialModal('none');
                      setActiveTeleportKioskModal('none');
                      window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
                      window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
                      setIsGearModalOpen((prev) => !prev);
                    }}
                    className={`-skew-x-12 px-2.5 h-9 flex items-center justify-center gap-1.5 font-black text-xs ${
                      equippedScooterKind
                        ? 'bg-[#4ade80] hover:bg-[#86efac]'
                        : 'bg-[#fb923c] hover:bg-[#fdba74]'
                    } text-[#1a1a1a] border-3 border-[#1a1a1a] ring-2 ring-white shadow-[3px_3px_0_#1a1a1a] transition-transform hover:scale-105 active:scale-95 cursor-pointer`}
                    title="Open Gear (Ride Your Scooter)"
                  >
                    <span className="skew-x-12 flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                      <span>GEAR</span>
                      {equippedScooterKind && (
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
                      setIsDailyMissionsModalOpen(false);
                      setActiveSpecialModal('none');
                      setActiveTeleportKioskModal('none');
                      window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
                      window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
                      setIsGearModalOpen(false);
                      setIsPersonalWalletModalOpen(true);
                    }}
                    className="-skew-x-12 px-2.5 h-9 flex items-center justify-center gap-1.5 font-black text-xs bg-[#facc15] hover:bg-[#fde047] text-[#1a1a1a] border-3 border-[#1a1a1a] ring-2 ring-white shadow-[3px_3px_0_#1a1a1a] transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                    title="Open Your Personal Citizen Wallet"
                  >
                    <span className="skew-x-12 flex items-center gap-1">
                      <Wallet className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                      <span>WALLET</span>
                      {newAssetCount > 0 && (
                        <span
                          data-wallet-new-asset-badge="true"
                          className="px-1.5 py-0.2 bg-[#ff3b30] text-white border border-black text-[9px] font-black leading-tight"
                        >
                          {newAssetCount}
                        </span>
                      )}
                    </span>
                  </button>

                  <button
                    type="button"
                    data-top-daily-missions-btn="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setIsTargetMenuExpanded(false);
                      setSelectedTargetUser(null);
                      setIsProfileModalOpen(false);
                      setIsKioskModalOpen(false);
                      setIsSocialChatModalOpen(false);
                      setIsPersonalBagModalOpen(false);
                      setIsPersonalWalletModalOpen(false);
                      setActiveSpecialModal('none');
                      setActiveTeleportKioskModal('none');
                      window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
                      window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
                      setIsGearModalOpen(false);
                      setIsDailyMissionsModalOpen((prev) => !prev);
                    }}
                    className={`-skew-x-12 px-2.5 h-9 flex items-center justify-center gap-1.5 font-black text-xs bg-[#c084fc] hover:bg-[#d8b4fe] text-[#1a1a1a] border-3 border-[#1a1a1a] ring-2 ring-white shadow-[3px_3px_0_#1a1a1a] transition-transform hover:scale-105 active:scale-95 cursor-pointer${showMissionsOnboardingHint ? ' animate-pulse ring-4 ring-[#ff3b30]' : ''}`}
                    title="Open Daily Missions"
                  >
                    <span className="skew-x-12 flex items-center gap-1.5">
                      <ClipboardList className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                      <span>MISSIONS</span>
                      {showMissionsOnboardingHint && (
                        <span
                          data-missions-onboarding-hint="true"
                          className="px-1.5 py-0.2 bg-[#ff3b30] text-white border border-black text-[9px] font-black leading-tight"
                        >
                          START HERE
                        </span>
                      )}
                      <span className="px-1 py-0.2 bg-white border border-[#1a1a1a] text-[10px] leading-tight">
                        {dailyMissionsSummary.completedCount}/{dailyMissionsSummary.totalCount}
                      </span>
                      {dailyMissionsSummary.actionableCount > 0 && (
                        <span
                          data-top-daily-missions-badge="true"
                          className="w-2.5 h-2.5 rounded-full bg-[#22c55e] border border-[#1a1a1a] animate-pulse"
                        />
                      )}
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
              <div className="flex items-center gap-2">
                <HudWeatherAndTimeControl
                  contextId="warzone"
                  popoverPlacement="top"
                  lightingPreset={lightingPreset}
                  timeOfDayHours={timeOfDayHours}
                  weatherCondition={weatherCondition}
                  rainIntensityTier={rainIntensityTier}
                  autoCycleEnabled={autoTimeCycle}
                  cityLightsScale={cityLightsScale}
                  onSelectTimePhase={handleSelectTimePhase}
                  onCycleTimePhase={handleCycleLighting}
                  onChangeTimeOfDayHours={handleChangeTimeOfDayHours}
                  onSelectWeatherCondition={handleSelectWeatherCondition}
                  onSelectRainIntensityTier={handleSelectRainIntensityTier}
                  onToggleAutoCycle={handleToggleAutoTimeCycle}
                  onChangeCityLightsScale={handleChangeCityLightsScale}
                />
                <HudAudioVolumeControl
                  contextId="warzone"
                  popoverPlacement="top"
                  hideMusicButton
                  isMusicMuted={isMusicMuted}
                  isSfxMuted={isMuted}
                  musicVolumePct={musicVolumePct}
                  sfxVolumePct={audioVolumePct}
                  onToggleMusicMute={handleToggleMusic}
                  onToggleSfxMute={handleToggleAudio}
                  onChangeMusicVolumePct={handleChangeMusicVolumePct}
                  onChangeSfxVolumePct={handleChangeVolumePct}
                />
              </div>
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
                        <span className="px-1.5 py-0.5 bg-[#1a1a1a] text-white text-[10px] font-mono-tabular font-bold">
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
              3E-2. BOTTOM-CENTER: SHORELINE FISHING HUD, NEEDLE GAUGE & 3D CATCH SHOWCASE MODAL
             ================================================================= */}
          {playMode !== 'editor' && (nearbyWaterZone.canFish || lastCaughtFishToast) && (
            <ShorelineFishingHudAndShowcase
              nearbyWaterZone={nearbyWaterZone}
              fishingPhase={fishingPhase}
              fishingCastPower={fishingCastPower}
              fishingHintMessage={fishingHintMessage}
              fishingMinigame={fishingMinigame}
              isHoldingReel={isHoldingReel}
              caughtFishBucketCount={caughtFishBucket.length}
              lastCaughtFishToast={lastCaughtFishToast}
              onStartChargeCast={() => {
                if (fishingPhase === 'idle' && caughtFishBucket.length < 20) {
                  ensureFishingRodEquipped();
                  setIsChargingCast(true);
                  setFishingPhase('charging');
                }
              }}
              onReleaseChargeCast={() => {
                if (fishingPhase === 'charging') {
                  launchShorelineCast(fishingCastPower);
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
            />
          )}

          {/* =================================================================
              3E2. KAI INCOMING PHONE CALL (first fish to sell, once per device)
             ================================================================= */}
          {playMode !== 'editor' && kaiIncomingCall && (
            <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-3 pointer-events-none">
              <div
                data-kai-incoming-call="true"
                className="pointer-events-auto w-full max-w-[320px] bg-white text-black border-[3px] border-black shadow-[5px_5px_0px_#000] p-3"
              >
                <div className="flex items-center justify-between gap-2 border-b-2 border-black pb-1.5 mb-2">
                  <span className="px-1.5 py-0.5 bg-[#0284c7] text-white border border-black text-[9px] font-black uppercase tracking-wider">
                    Incoming Call
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                    Phone
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 shrink-0 rounded-full bg-[#0284c7] border-2 border-black flex items-center justify-center text-white font-black">
                    K
                  </div>
                  <div className="min-w-0">
                    <div className="font-black text-sm uppercase leading-tight">Kai</div>
                    <div className="text-[10px] font-bold text-slate-600 leading-snug">
                      Fisherman · East Beach — wants to buy your catch
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    data-kai-call-accept="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      openKaiChatFromPhone();
                    }}
                    className="flex-1 px-3 py-2 bg-[#b8ff3c] hover:bg-[#c9ff5e] text-black border-2 border-black shadow-[3px_3px_0px_#000] font-black text-[11px] uppercase tracking-wider cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    data-kai-call-later="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      soundEngine.stopPhoneRing();
                      setKaiIncomingCall(false);
                    }}
                    className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-black border-2 border-black shadow-[3px_3px_0px_#000] font-black text-[11px] uppercase tracking-wider cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                  >
                    Later
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              3F. BOTTOM-LEFT: SOCIAL TALK CHAT INPUT BAR + PRIVATE NOTIFICATION TOAST
             ================================================================= */}
          {playMode !== 'editor' && (
            <div data-buddies-chat-bar="true" className="fixed bottom-3 left-4 z-30 w-[calc(100vw-2rem)] max-w-[540px] pointer-events-auto flex flex-col items-end">
              {/* Incoming Private Chat Notification Popup (Hidden during active NPC Dialogue) */}
              {!isAnyNpcChatBarMode && activePrivateNotificationToast && (
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

              {!isAnyNpcChatBarMode && isEmotePickerOpen && (
                <div
                  data-social-emote-menu="true"
                  className="mb-2 self-end flex items-center gap-1.5 bg-[#14161d]/95 border-3 border-black ring-2 ring-white shadow-[4px_4px_0_#000] px-2 py-1.5 rounded-lg"
                >
                  {SOCIAL_EMOTE_QUICK_LIST.map((emote) => (
                    <button
                      key={emote.id}
                      type="button"
                      data-social-emote-btn={emote.id}
                      onClick={() => {
                        soundEngine.playUiClick();
                        dispatchBuddyAction(`playEmote:${emote.id}`);
                        setIsEmotePickerOpen(false);
                      }}
                      className="-skew-x-6 px-2.5 py-1 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-2 border-black shadow-[2px_2px_0_#000] font-black text-[10px] uppercase tracking-wider cursor-pointer active:scale-95"
                    >
                      <span className="skew-x-6 inline-block">{emote.label}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    data-social-emote-stop="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      dispatchBuddyAction('clearEmote');
                      setIsEmotePickerOpen(false);
                    }}
                    className="-skew-x-6 px-2 py-1 bg-slate-200 hover:bg-slate-300 text-black border-2 border-black shadow-[2px_2px_0_#000] font-black text-[10px] uppercase cursor-pointer active:scale-95"
                  >
                    <span className="skew-x-6 inline-block">STOP</span>
                  </button>
                </div>
              )}

              <form
                aria-label={
                  isAnyNpcChatBarMode
                    ? 'NPC Dialogue Chat Input'
                    : 'Social Talk Chat Input'
                }
                data-social-talk-bar="true"
                data-chat-route={
                  activeSpecialModal === 'npc_merchant'
                    ? 'npc_merchant'
                    : isCitizenChatBarMode
                      ? 'citizen_dialogue'
                      : 'social_world'
                }
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmed = socialChatText.trim();
                  if (!trimmed) return;
                  const isNpcDomOpen =
                    typeof document !== 'undefined' &&
                    (document.querySelector(
                      '[data-npc-merchant-modal="true"][aria-hidden="false"]',
                    ) !== null ||
                      document.querySelector(
                        '[data-citizen-chat-modal="true"][aria-hidden="false"]',
                      ) !== null);
                  const target = resolveBottomChatSubmitTarget({
                    activeSpecialModal:
                      activeSpecialModal === 'npc_merchant' ||
                      activeSpecialModalRef.current === 'npc_merchant'
                        ? 'npc_merchant'
                        : activeSpecialModal,
                    isSocialChatModalOpen,
                    hasSelectedPrivateUser: Boolean(selectedPrivateUser),
                    hasDomNpcDialogOpen: isNpcDomOpen || isCitizenChatBarMode,
                  });

                  if (target === 'npc_merchant') {
                    // Strictly route ONLY to active NPC dialogue; never publish to world chat or speech bubbles.
                    window.dispatchEvent(
                      new CustomEvent(
                        isCitizenChatBarMode
                          ? 'citizen-dialogue-user-chat'
                          : 'npc-merchant-user-chat',
                        { detail: { text: trimmed } },
                      ),
                    );
                    setSocialChatText('');
                    return;
                  }

                  const slashEmote = parseSocialEmoteCommand(trimmed);
                  if (slashEmote) {
                    soundEngine.playUiClick();
                    dispatchBuddyAction(`playEmote:${slashEmote}`);
                    setSocialChatText('');
                    setIsEmotePickerOpen(false);
                    return;
                  }

                  if (target === 'private_chat' && selectedPrivateUser) {
                    publishPlayerSocialMessage({
                      text: trimmed,
                      recipient: selectedPrivateUser,
                    });
                  } else {
                    publishPlayerSocialMessage({ text: trimmed });
                  }
                  setSocialChatText('');
                }}
                className="w-full flex items-center gap-1.5 bg-[#14161d]/95 border-3 border-[#1a1a1a] ring-2 ring-white shadow-[4px_4px_0_#1a1a1a] px-2.5 py-1.5 rounded-lg"
              >
                {isAnyNpcChatBarMode && (
                  <span
                    data-social-chat-mode="npc"
                    className="px-2 py-0.5 bg-[#facc15] text-black border border-black text-[10px] font-black uppercase shrink-0"
                  >
                    {activeNpcChatBarLabel}
                  </span>
                )}
                <input
                  type="text"
                  data-social-chat-input="true"
                  maxLength={isAnyNpcChatBarMode ? 220 : 64}
                  value={socialChatText}
                  onChange={(e) => setSocialChatText(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Escape') {
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder={
                    isAnyNpcChatBarMode
                      ? activeSpecialModal === 'npc_merchant'
                        ? `Ask ${activeNpcChatBarName} anything (or type buy / exchange)...`
                        : `Chat with ${activeNpcChatBarName} (ask about gifts, tips, or district)...`
                      : isSocialChatModalOpen && selectedPrivateUser
                        ? `Whisper @${selectedPrivateUser.name}...`
                        : 'Type message or /wave, /cheer, /dance...'
                  }
                  className="flex-1 min-w-0 px-2.5 py-1 bg-white text-[#14161d] font-bold text-xs rounded border-2 border-[#14161d] focus:outline-none focus:ring-2 focus:ring-[#10b981]"
                />
                <button
                  type="submit"
                  data-social-chat-send="true"
                  className={`-skew-x-12 px-3 py-1 font-black text-xs uppercase border-2 border-[#14161d] shadow-[2px_2px_0_#14161d] cursor-pointer active:scale-95 ${
                    isAnyNpcChatBarMode
                      ? 'bg-[#facc15] hover:bg-[#fde047] text-black'
                      : 'bg-[#10b981] hover:bg-[#34d399] text-[#0f172a]'
                  }`}
                >
                  <span className="skew-x-12 inline-block">
                    {isAnyNpcChatBarMode ? 'ASK' : 'SEND'}
                  </span>
                </button>
                {!isAnyNpcChatBarMode && (
                  <button
                    type="button"
                    data-social-emote-toggle="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setIsEmotePickerOpen((prev) => !prev);
                    }}
                    className={`-skew-x-12 px-2.5 py-1 font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer active:scale-95 transition-colors ${
                      isEmotePickerOpen
                        ? 'bg-[#b8ff3c] text-black'
                        : 'bg-[#38bdf8] hover:bg-[#7dd3fc] text-black'
                    }`}
                    title="Emotes (/wave, /cheer, /dance, /salute)"
                  >
                    <span className="skew-x-12 inline-block">EMOTE</span>
                  </button>
                )}
                {!isAnyNpcChatBarMode && (
                  <button
                    type="button"
                    data-open-social-chat-btn="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      if (!isSocialChatModalOpen && unreadPrivateCount > 0 && lastUnreadPrivateSender) {
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
                          setIsCitizenDialogueOpen(false);
                          setActiveSpecialModal('none');
                          setActiveTeleportKioskModal('none');
                          window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
                          window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
                        }
                        return next;
                      });
                    }}
                    className={`-skew-x-12 relative px-3 py-1 font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer active:scale-95 ml-1 transition-colors ${
                      isSocialChatModalOpen
                        ? 'bg-[#ff3b30] hover:bg-[#ff554a] text-white'
                        : 'bg-[#facc15] hover:bg-[#fde047] text-black'
                    }`}
                    title={isSocialChatModalOpen ? 'Close Social Chat' : 'Open Social Chat'}
                  >
                    <span className="skew-x-12 inline-flex items-center justify-center gap-1 min-w-[18px]">
                      {isSocialChatModalOpen ? (
                        <span>X</span>
                      ) : (
                        <>
                          <span>WORLD</span>
                          {unreadPrivateCount + unreadLetterCount > 0 && (
                            <span
                              data-chat-unread-private-badge="true"
                              className="px-1.5 py-0.2 bg-[#ff3b30] text-white border border-black text-[9px] font-black leading-tight"
                            >
                              {unreadPrivateCount + unreadLetterCount}
                            </span>
                          )}
                        </>
                      )}
                    </span>
                  </button>
                )}
              </form>
            </div>
          )}

          {/* Mission guide chip: active waypoint guidance from Daily Missions */}
          {missionGuide && playMode !== 'editor' && (
            <div
              data-mission-guide-chip="true"
              className="fixed left-1/2 top-[76px] z-40 -translate-x-1/2 pointer-events-none select-none"
            >
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#14161d]/95 text-white border-2 border-black shadow-[3px_3px_0_#000]">
                <span className="w-2 h-2 shrink-0 bg-[#22ff5e] border border-black animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                  {missionGuide.stage === 'to_kiosk'
                    ? 'Go to a Teleport Kiosk'
                    : missionGuide.title}
                </span>
                {missionGuide.stage === 'direct' && missionGuideDistanceM != null && (
                  <span className="text-[10px] font-black text-[#22ff5e] tabular-nums whitespace-nowrap">
                    {missionGuideDistanceM} m
                  </span>
                )}
                <button
                  type="button"
                  data-mission-guide-cancel="true"
                  aria-label="Cancel mission guide"
                  onClick={() => {
                    soundEngine.playUiClick();
                    window.dispatchEvent(
                      new CustomEvent('set-tutorial-waypoint', {
                        detail: { target: 'none' },
                      }),
                    );
                    clearMissionGuide();
                  }}
                  className="pointer-events-auto w-5 h-5 shrink-0 bg-[#ff3b30] hover:bg-[#ff554a] text-white border border-black font-black text-[10px] leading-none flex items-center justify-center cursor-pointer"
                >
                  X
                </button>
              </div>
            </div>
          )}

          {/* =================================================================
              3G. BOTTOM-RIGHT: QUICK MOUNT SCOOTER & SOUND CONTROLS (City / Safezone / Interiors)
             ================================================================= */}
          {playMode !== 'editor' && !peacefulUiState.bottomRightWeaponAndHpHudVisible && (
            <div className="fixed bottom-16 sm:bottom-3 right-3 z-30 pointer-events-auto select-none flex items-center gap-2.5">
              <HudWeatherAndTimeControl
                contextId="city"
                popoverPlacement="top"
                lightingPreset={lightingPreset}
                timeOfDayHours={timeOfDayHours}
                weatherCondition={weatherCondition}
                rainIntensityTier={rainIntensityTier}
                autoCycleEnabled={autoTimeCycle}
                cityLightsScale={cityLightsScale}
                onSelectTimePhase={handleSelectTimePhase}
                onCycleTimePhase={handleCycleLighting}
                onChangeTimeOfDayHours={handleChangeTimeOfDayHours}
                onSelectWeatherCondition={handleSelectWeatherCondition}
                onSelectRainIntensityTier={handleSelectRainIntensityTier}
                onToggleAutoCycle={handleToggleAutoTimeCycle}
                onChangeCityLightsScale={handleChangeCityLightsScale}
              />
              <HudQuickMountScooterControl
                ownedScooterIds={ownedScooterIds}
                equippedScooterKind={equippedScooterKind}
                preferredScooterKind={preferredScooterKind}
                canMountOutdoors={
                  worldMode !== 'warzone' &&
                  hud.worldMode !== 'warzone' &&
                  !isInsidePrivateHouse &&
                  !isInsideGlasshouseCafe &&
                  !isInsideGrandCasino &&
                  !isInsideBeautySalon &&
                  activeSpecialModal === 'none' &&
                  !hud.isRidingCityTram &&
                  hud.controlMode !== 'tank'
                }
                popoverPlacement="top"
                onEquipScooter={(kind) => {
                  soundEngine.playUiClick();
                  setPreferredScooterKind(kind);
                  try {
                    window.localStorage.setItem('bb_preferred_scooter_kind_v1', kind);
                  } catch {
                    // ignore storage errors
                  }
                  dispatchBuddyAction(`equipScooter:${kind}`);
                }}
                onDismountScooter={() => {
                  soundEngine.playUiClick();
                  dispatchBuddyAction('unequipScooter');
                }}
                onLocateShowroom={() => {
                  soundEngine.playUiClick();
                  window.dispatchEvent(
                    new CustomEvent('set-tutorial-waypoint', {
                      detail: {
                        target: 'coord',
                        x: -97.355,
                        z: -4.574,
                        color: '#22ff5e',
                      },
                    }),
                  );
                }}
              />
              <HudAudioVolumeControl
                contextId="city"
                popoverPlacement="top"
                hideMusicButton
                isMusicMuted={isMusicMuted}
                isSfxMuted={isMuted}
                musicVolumePct={musicVolumePct}
                sfxVolumePct={audioVolumePct}
                onToggleMusicMute={handleToggleMusic}
                onToggleSfxMute={handleToggleAudio}
                onChangeMusicVolumePct={handleChangeMusicVolumePct}
                onChangeSfxVolumePct={handleChangeVolumePct}
              />
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
        npcOpenSeq={npcOpenSeq}
        isSampleHouseView={isSampleHouseView}
        marketState={marketState}
        lulBalance={hud.gold}
        cyonBalance={cyonBalance}
        respiteBalance={respiteBalance}
        nearTestnetBalance={nearTestnetBalance}
        walletConnected={Boolean(hud.nearWalletConnected)}
        hasHouseOwnership={hasHouseOwnership || Boolean(hud.nearHasGamepassNft)}
        citizenDisplayName={playerDisplayName}
        hanaPitchOrigin={hanaPitchOrigin}
        houseArchitectureStyle={houseArchitectureStyle}
        ownedHouseStyle={ownedHouseStyle}
        onChainHouseStyleLocked={isOnChainHouseStyleLocked}
        onSelectHouseArchitectureStyle={(style) => {
          setAndPersistHouseArchitectureStyle(style);
        }}
        onViewModelHouse={handleViewModelHouse}
        onEnterOwnHouse={handleEnterOwnHouse}
        onOpenExternalCatalog={(tab) => {
          setRealEstateCatalogTab(tab === 'furniture' || tab === 'market' ? tab : 'house');
          setActiveSpecialModal('none');
          setIsRealEstateCatalogModalOpen(true);
        }}
        onOpenTeleportKioskFromPitch={
          hanaPitchOrigin === 'kiosk'
            ? () => {
                soundEngine.playUiClick();
                setActiveSpecialModal('none');
                setHanaPitchOrigin(null);
                setActiveTeleportKioskModal(pendingPitchKioskStation);
              }
            : undefined
        }
        hanaWelcomeNearClaimed={hanaWelcomeNearClaimed}
        onClaimHanaWelcomeNear={handleClaimHanaWelcomeNear}
        onBuyHouseWithRespite={handleBuyHouseWithRespite}
        recruitedFamilyMembers={recruitedFamilyMembers}
        propertyListings={propertyListings}
        busyPropertyListingId={busyPropertyListingId}
        onCreatePropertyListing={handleCreatePropertyListing}
        onCancelPropertyListing={handleCancelPropertyListing}
        onBuyPropertyListing={handleBuyPropertyListing}
        onCompletePropertyTransfer={handleCompletePropertyTransfer}
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
              'optimistic',
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
          setHanaPitchOrigin(null);
          if (tutorialStage === 'go_to_hana') {
            setTutorialStage('none');
          }
        }}
        onTeleportToDestination={(destination, originStationId) => {
          handleStartCityTransitTravel(destination, originStationId);
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
            customCyonGranted > 0
          ) {
            // Custom-amount exchange runs through the SAME packet engine as
            // the cafe ATM: whole packets at the current quote, treasury and
            // shop-broke state enforced, local market state always updated.
            // The amounts the modal computed are a preview only.
            const quoteNow = evaluateLulToCyonExchangeQuote(marketState);
            const packets = Math.floor(customLulSpent / Math.max(1, quoteNow.lulCostFor10Cyon));
            if (packets >= 1) {
              const res = executeLulToCyonExchangePackets(marketState, hud.gold, cyonBalance, packets);
              if (res.ok) {
                const lulSpent = Math.max(0, hud.gold - res.updatedLul);
                const cyonGranted = res.updatedCyon - cyonBalance;
                dispatchBuddyAction(`adjustPlayerLul:${-lulSpent}`);
                setCyonBalance(res.updatedCyon);
                setMarketState(res.updatedState);
                void syncNpcMerchantToSupabase({
                  merchant_id: merchantLocation,
                  cyon_treasury: res.updatedState.treasuryCyon,
                  is_bankrupt: res.updatedState.isShopBroke,
                  last_headline: res.updatedState.lastMarketHeadline,
                });
                if (actorAccount) {
                  void logMarketTransactionToSupabase({
                    merchant_id: merchantLocation,
                    actor_near_account: actorAccount,
                    action_type: 'exchange',
                    currency: 'CYON',
                    amount: cyonGranted,
                    unit_price: Number((lulSpent / Math.max(1, cyonGranted)).toFixed(2)),
                    reasoning_summary: `Exchanged ${lulSpent} LUL for ${cyonGranted} CYON at ${merchantLocation}`,
                  });
                  void syncPlayerBalancesToSupabase({
                    nearAccountId: actorAccount,
                    lulBalance: res.updatedLul,
                    cyonBalance: res.updatedCyon,
                    respiteBalance,
                  });
                }
              }
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
                action_type: 'exchange',
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
        onBuyMerchantItem={handleBuyCatalogMerchantItem}
        onSellMerchantItem={async (item: MerchantCatalogItem, refund: number) => {
          soundEngine.playUiClick();
          if (!ownedMerchantItemIds.includes(item.id)) return false;
          const actorAccount = hud.nearWalletId || playerUid;
          if (!actorAccount) return false;
          const ownedCount = ownedMerchantItemIds.filter((id) => id === item.id).length;
          const placedCount = placedFurnitureCounts[item.id] ?? 0;
          if (ownedCount - placedCount < 1) return false;
          let nextCyon = cyonBalance;
          let nextRespite = respiteBalance;
          let sellTxHash: string | undefined;
          if (item.currency === 'CYON') {
            nextCyon = cyonBalance + refund;
            setCyonBalance(nextCyon);
          } else {
            // RESPITE buybacks settle on-chain first (the merchant pays the
            // seller and restocks the item in one transaction); local state
            // changes only after the transaction confirms.
            if (!item.tokenId) return false;
            const res = await executeMarketContractCallOnChain({
              signerAccountId: actorAccount,
              methodName: 'sell_merchant_item',
              args: {
                token_id: item.tokenId,
                amount: '1',
                price_respite: String(refund),
              },
            });
            if (!res.ok) return false;
            sellTxHash = res.txHash || undefined;
            const resolvedActor = res.signerAccountId || actorAccount;
            nextRespite = respiteBalance + refund;
            const liveRespiteStr = await fetchNep141Balance(
              NEAR_CONFIG.nep141RespiteContractId,
              resolvedActor,
              'optimistic',
            ).catch(() => null);
            if (liveRespiteStr !== null) {
              nextRespite = Math.max(0, Number(liveRespiteStr) || 0);
            }
            setRespiteBalance(nextRespite);
          }
          const removeIdx = ownedMerchantItemIds.indexOf(item.id);
          const nextOwned = ownedMerchantItemIds.filter((_, i) => i !== removeIdx);
          setOwnedMerchantItemIds(nextOwned);
          if (ownedCount <= 1) {
            setInteriorPlacement((prev) => {
              const next = {
                ...prev,
                center_table: prev.center_table === item.id ? null : prev.center_table,
                left_wall: prev.left_wall === item.id ? null : prev.left_wall,
                right_wall: prev.right_wall === item.id ? null : prev.right_wall,
                corner_plant: prev.corner_plant === item.id ? null : prev.corner_plant,
                trophy_pedestal: prev.trophy_pedestal === item.id ? null : prev.trophy_pedestal,
              };
              housePersistRef.current.slot = next;
              return next;
            });
          }
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
              near_tx_hash: sellTxHash,
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
          return true;
        }}
        onSelectHouseTheme={(themeItem: MerchantCatalogItem) => {
          soundEngine.playUiClick();
          if (!ownedMerchantItemIds.includes(themeItem.id)) return;
          const actorAccount = hud.nearWalletId || playerUid;
          if (!actorAccount) return;
          setActiveHouseThemeId(themeItem.id);
          housePersistRef.current.theme = themeItem.id;
          if (!housePersistRef.current.slot) housePersistRef.current.slot = interiorPlacement;
          dispatchBuddyAction(
            `applyHouseTheme:${themeItem.skinThemeId ?? 'military_standard'}:${themeItem.gardenPresetId ?? 'sakura_grove'}`,
          );
          void syncHouseInteriorToSupabase({
            ownerNearAccount: actorAccount,
            activeThemeId: themeItem.id,
            daylightHour: 14.5,
            placedFurniture: [
              housePersistRef.current.slot,
              ...housePersistRef.current.placed3d,
            ],
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
            housePersistRef.current.slot = next;
            if (actorAccount) {
              void syncHouseInteriorToSupabase({
                ownerNearAccount: actorAccount,
                activeThemeId: housePersistRef.current.theme || activeHouseThemeId,
                daylightHour: 14.5,
                placedFurniture: [next, ...housePersistRef.current.placed3d],
              });
            }
            return next;
          });
        }}
        onRotateInteriorSlot={(slotId: HouseInteriorSlotId) => {
          soundEngine.playUiClick();
          setInteriorPlacement((prev) => {
            const next = {
              ...prev,
              rotationStepBySlot: {
                ...prev.rotationStepBySlot,
                [slotId]: ((prev.rotationStepBySlot[slotId] ?? 0) + 1) % 4,
              },
            };
            housePersistRef.current.slot = next;
            return next;
          });
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
          pendingPostClaimFloorRef.current = null;
          if (direction === 'near_to_respite' && !onboardingSwapDone) {
            setOnboardingSwapDone(true);
            const swapAccount = (resolvedActor || '').trim().toLowerCase();
            if (swapAccount) {
              try {
                window.localStorage.setItem(`bb_onboarding_swap_v1:${swapAccount}`, '1');
              } catch {
                // ignore storage failures
              }
            }
          }

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
              fetchNearAccountView(resolvedActor, 'optimistic'),
              fetchNep141Balance(NEAR_CONFIG.nep141RespiteContractId, resolvedActor, 'optimistic'),
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

          nearTestnetBalanceRef.current = nextNear;
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
              action_type: 'exchange',
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
        onSellCaughtFishNegotiated={handleSellRawFishNegotiated}
        getKaiTradeContext={getKaiTradeContext}
        onRequestKaiNftTradeSession={handleRequestKaiNftTradeSession}
        onSellNftFishToKai={handleSellNftFishToKai}
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
                  reasoning_summary: `Listed ${fish.speciesName} (${fish.weightKg} kg, ${fish.rarity}) for ${newListing.priceRespite} RESPITE.`,
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
            void fetchNep141Balance(
              NEAR_CONFIG.nep141RespiteContractId,
              listing.sellerNearAccount,
            ).then((sellerChainBal) => {
              if (sellerChainBal !== null) {
                void mirrorRecipientOnChainRespiteCacheInSupabase(
                  listing.sellerNearAccount,
                  Math.max(0, Number(sellerChainBal) || 0),
                );
              }
            });
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
        onNearClaimBasePlot={() => claimBasePlotNow()}
        ownedHouseStyles={ownedHouseStyles}
        onNearClaimBasePlotWithStyle={(style) => claimBasePlotNow(style)}
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
          setIsDailyMissionsModalOpen(false);
          window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
          const isSample =
            hud.nearKioskPlotTeam === 'blue' &&
            (hud.nearKioskPlotIndex === 0 || hud.nearKioskPlotIndex === null);
          setHouseArchitectureStyle(
            isSample
              ? 'japanese_pavilion'
              : ownedHouseStyleRef.current ?? houseArchitectureStyleRef.current,
          );
          lastEnteredHousePlotRef.current = {
            team: hud.nearKioskPlotTeam ?? null,
            plotIndex: hud.nearKioskPlotIndex ?? null,
            viaStudio: false,
          };
          setIsSampleHouseView(isSample);
          setIsInsidePrivateHouse(true);
          setActiveSpecialModal('none');
        }}
        onOpenHouseCatalog={() => {
          soundEngine.playUiClick();
          setIsKioskModalOpen(false);
          window.dispatchEvent(new CustomEvent('close-kiosk-ui'));
          setRealEstateCatalogTab('house');
          setIsRealEstateCatalogModalOpen(true);
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
        kaiRawFishCount={caughtFishBucket.filter((f) => !f.isMintedNft).length}
        kaiHasMet={kaiPhoneState.met}
        onCallKai={openKaiChatFromPhone}
        onMeetKai={() => {
          soundEngine.playUiClick();
          setIsSocialChatModalOpen(false);
        }}
        playerBubbleBgColor={chatBubbleBgColor}
        playerBubbleTextColor={chatBubbleTextColor}
        isInsidePrivateHouse={isInsidePrivateHouse}
        isMuted={isMuted}
        audioVolumePct={audioVolumePct}
        onToggleAudio={handleToggleAudio}
        onChangeVolumePct={handleChangeVolumePct}
        showJoystickOnDesktop={showJoystickOnDesktop}
        onToggleShowJoystickOnDesktop={handleToggleShowJoystickOnDesktop}
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
          publishPlayerSocialMessage({ text });
        }}
        onSendPrivateChat={(recipient, text) => {
          if (recipient.isNpc) return;
          publishPlayerSocialMessage({ text, recipient });
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
        onClose={() => {
          soundEngine.playUiClick();
          setActiveTeleportKioskModal('none');
          window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
        }}
        onConfirmEnterDestination={(
          destination: CityTransitDestinationSpec,
          team?: 'blue' | 'red',
        ) => {
          const originStationId: CityTransitStationId =
            activeTeleportKioskModal !== 'none'
              ? activeTeleportKioskModal
              : hud.worldMode === 'warzone'
                ? 'warzone_arena'
                : 'central_plaza';
          handleStartCityTransitTravel(destination, originStationId, team);
        }}
        onEnterMyHouseStudio={() => {
          soundEngine.playUiClick();
          setActiveTeleportKioskModal('none');
          window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
          setIsKioskModalOpen(false);
          setIsSocialChatModalOpen(false);
          setIsDailyMissionsModalOpen(false);
          lastEnteredHousePlotRef.current = {
            team: hud.nearClaimedTeam ?? null,
            plotIndex: hud.nearClaimedPlotIndex ?? null,
            viaStudio: true,
          };
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
          setPendingPitchKioskStation(
            activeTeleportKioskModal !== 'none' ? activeTeleportKioskModal : 'central_plaza',
          );
          setActiveTeleportKioskModal('none');
          window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
          setIsKioskModalOpen(false);
          setIsSocialChatModalOpen(false);
          setRealEstateCatalogTab('house');
          setIsRealEstateCatalogModalOpen(true);
        }}
        onOpenShopAndExchange={() => {
          soundEngine.playUiClick();
          const originStation =
            activeTeleportKioskModal !== 'none' ? activeTeleportKioskModal : 'central_plaza';
          setActiveTeleportKioskModal('none');
          window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
          setIsKioskModalOpen(false);
          setIsSocialChatModalOpen(false);
          openMerchantInChatSession(
            originStation === 'beachfront_harbor' ? 'beach_house' : 'lobby_cafe',
          );
        }}
        onEnterGlasshouseCafe={() => {
          soundEngine.playUiConfirm();
          window.dispatchEvent(new CustomEvent('enter-glasshouse-cafe'));
        }}
      />

      {/* =====================================================================
          9B-2. LEFT-SLIDE PERSONAL WALLET MODAL (Opened When Clicking WALLET on Self)
         ===================================================================== */}
      <aside
        role="dialog"
        aria-modal="false"
        aria-hidden={!isPersonalWalletModalOpen}
        inert={!isPersonalWalletModalOpen || undefined}
        aria-label="Personal Wallet"
        data-personal-wallet-modal="true"
        className={`fixed left-4 top-16 bottom-20 z-40 w-full max-w-lg flex flex-col select-none transition-all duration-300 ease-out transform ${
          isPersonalWalletModalOpen
            ? 'translate-x-0 opacity-100 visible pointer-events-auto'
            : '-translate-x-[120%] opacity-0 invisible pointer-events-none'
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
                soundEngine.playUiCancel();
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
                    setOwnedHouseStyle(null);
                    setIsOnChainHouseStyleLocked(false);
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
                    const liveSenderBal = await fetchNep141Balance(
                      NEAR_CONFIG.nep141RespiteContractId,
                      senderId,
                    );
                    const nextRespite =
                      liveSenderBal !== null
                        ? Math.max(0, Number(liveSenderBal) || 0)
                        : Math.max(0, respiteBalance - amt);
                    setRespiteBalance(nextRespite);
                    void fetchNep141Balance(
                      NEAR_CONFIG.nep141RespiteContractId,
                      targetWallet,
                    ).then((recipientChainBal) => {
                      if (recipientChainBal !== null) {
                        void mirrorRecipientOnChainRespiteCacheInSupabase(
                          targetWallet,
                          Math.max(0, Number(recipientChainBal) || 0),
                        );
                      }
                    });
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
            ) : personalWalletTab === 'assets' ? (() => {
              const ownedWalletHouseStyle = ownedHouseStyle ?? houseArchitectureStyle;
              const houseDisplay = getHouseStyleDisplaySpec(ownedWalletHouseStyle);
              const deedBadgeLabel = formatHouseDeedBadgeLabel(hud.nearGamepassTokenId);
              const walletCatalogCounts = countOwnedMerchantItems(ownedMerchantItemIds);
              const walletCatalogItems = MERCHANT_CATALOG_ITEMS.filter(
                (item) => (walletCatalogCounts[item.id] ?? 0) > 0,
              );
              const walletCatalogTotalCount = walletCatalogItems.reduce(
                (sum, item) => sum + (walletCatalogCounts[item.id] ?? 0),
                0,
              );
              const walletMintedFish = caughtFishBucket.filter((f) => f.isMintedNft);
              const walletListedFish = fishMarketListings.filter(
                (l) =>
                  Boolean(hud.nearWalletId) &&
                  l.sellerNearAccount.toLowerCase() === (hud.nearWalletId || '').toLowerCase(),
              );
              const totalOwnedWalletItems =
                (hasHouseOwnership ? 1 : 0) +
                walletCatalogTotalCount +
                walletMintedFish.length +
                recruitedFamilyMembers.length +
                walletListedFish.length;
              return (
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
                    {totalOwnedWalletItems} OWNED
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 1. HOUSE DEED CARD */}
                  {hasHouseOwnership && (
                    <div
                      data-wallet-house-card={ownedWalletHouseStyle}
                      className="p-3 bg-white border-2 border-black shadow-[3px_3px_0_#000] space-y-2"
                    >
                      <div className="relative w-full h-28 bg-slate-900 border-2 border-black overflow-hidden flex items-center justify-center">
                        <img
                          src={houseDisplay.imageSrc}
                          alt={houseDisplay.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <div className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-[#b8ff3c] text-black border border-black font-black text-[9px] uppercase">
                          HOUSE
                        </div>
                        <div className="absolute bottom-1.5 right-1.5 px-2 py-0.5 bg-black/80 text-[#38bdf8] font-mono text-[9px]">
                          {deedBadgeLabel}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase text-black">
                          {houseDisplay.title}
                        </div>
                        <div className="text-[10px] font-bold text-slate-600">
                          {houseDisplay.description}
                        </div>
                        {hud.nearGamepassTokenId && (
                          <div className="text-[9.5px] font-mono text-slate-500 mt-0.5 truncate">
                            {hud.nearGamepassTokenId}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[9.5px] font-mono border-t border-slate-200 pt-1.5">
                        <span className="text-emerald-600 font-bold">OWNED</span>
                        <span className="text-slate-500">{HOUSE_OWNERSHIP_PRICE_RESPITE} RESPITE</span>
                      </div>

                      {/* Sub-Account Ledger, Ownership Provenance & Royalty Payouts (Contract v1.5.0) */}
                      <div
                        data-wallet-deed-ledger="true"
                        className="p-2 bg-[#0f172a] text-white border-2 border-black space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[9px] font-black uppercase text-[#38bdf8] truncate">
                            YOUR HOUSE ACCOUNT
                          </span>
                          <span className="px-1.5 py-0.5 bg-[#1e293b] border border-white/20 text-[8.5px] font-mono font-bold text-[#b8ff3c] shrink-0">
                            {(() => { const raw = onChainDeedLedger?.sub_account_id || nep171Ledger.subAccountId || ''; const m = raw.match(/estate-0*(\d+)/i); return m ? 'House No. ' + parseInt(m[1], 10) : 'Your house'; })()}
                          </span>
                        </div>

                        {onChainDeedLedger ? (
                          <>
                            <div className="grid grid-cols-3 gap-1 text-[8.5px] font-mono">
                              <div className="p-1 bg-[#1e293b] border border-white/10">
                                <div className="text-slate-400">READY TO COLLECT</div>
                                <div className="text-[#b8ff3c] font-bold">
                                  {onChainDeedLedger.pending_payout_respite} R
                                </div>
                              </div>
                              <div className="p-1 bg-[#1e293b] border border-white/10">
                                <div className="text-slate-400">EARNED</div>
                                <div className="text-[#d8b4fe] font-bold">
                                  {onChainDeedLedger.total_earned_respite} R
                                </div>
                              </div>
                              <div className="p-1 bg-[#1e293b] border border-white/10">
                                <div className="text-slate-400">COLLECTED</div>
                                <div className="text-[#38bdf8] font-bold">
                                  {onChainDeedLedger.total_paid_out_respite} R
                                </div>
                              </div>
                            </div>

                            <div className="text-[8.5px] font-mono text-slate-300 space-y-0.5 max-h-16 overflow-y-auto">
                              {onChainDeedLedger.ownership_history.length === 0 ? (
                                <div>You are the first owner</div>
                              ) : (
                                onChainDeedLedger.ownership_history.slice(-3).map((rec, idx) => (
                                  <div key={`${rec.new_key_epoch}-${idx}`} className="truncate">
                                    Owner #{rec.new_key_epoch} · {rec.transferred_treasury_respite} R moved with the house
                                  </div>
                                ))
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 pt-0.5">
                              <button
                                type="button"
                                data-deed-fund-btn="true"
                                disabled={isDeedLedgerTxBusy || respiteBalance < 5}
                                onClick={async () => {
                                  const signer = hud.nearWalletId || playerUid || '';
                                  const deedTokenId =
                                    hud.nearGamepassTokenId || onChainDeedLedger.token_id;
                                  if (!signer || !deedTokenId) return;
                                  soundEngine.playUiClick();
                                  setIsDeedLedgerTxBusy(true);
                                  setDeedLedgerActionFeedback(null);
                                  try {
                                    const tx = await executeMarketContractCallOnChain({
                                      signerAccountId: signer,
                                      methodName: 'fund_deed_royalty',
                                      args: { token_id: deedTokenId, amount: '5' },
                                    });
                                    if (!tx.ok) {
                                      setDeedLedgerActionFeedback({
                                        type: 'error',
                                        text: tx.error || 'Could not fund deed treasury.',
                                      });
                                      return;
                                    }
                                    void logMarketTransactionToSupabase({
                                      merchant_id: 'lobby_cafe',
                                      actor_near_account: signer,
                                      action_type: 'FUND_DEED_ROYALTY',
                                      item_id: deedTokenId,
                                      currency: 'RESPITE',
                                      amount: 5,
                                      unit_price: 1,
                                      reasoning_summary: `Added 5 RESPITE to your house account`,
                                      near_tx_hash: tx.txHash,
                                    });
                                    setDeedLedgerActionFeedback({
                                      type: 'success',
                                      text: '+5 R funded to deed treasury',
                                      txHash: tx.txHash,
                                    });
                                    await Promise.all([
                                      refreshOnChainBalances(signer),
                                      refreshOnChainDeedLedger(deedTokenId),
                                    ]);
                                  } finally {
                                    setIsDeedLedgerTxBusy(false);
                                  }
                                }}
                                className={`flex-1 py-1 border border-black text-[8.5px] font-black uppercase ${
                                  !isDeedLedgerTxBusy && respiteBalance >= 5
                                    ? 'bg-[#d8b4fe] hover:bg-[#e9d5ff] text-black cursor-pointer'
                                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                }`}
                              >
                                {isDeedLedgerTxBusy ? 'WAIT...' : 'ADD 5 R'}
                              </button>

                              <button
                                type="button"
                                data-deed-claim-btn="true"
                                disabled={
                                  isDeedLedgerTxBusy ||
                                  Number(onChainDeedLedger.pending_payout_respite || '0') <= 0
                                }
                                onClick={async () => {
                                  const signer = hud.nearWalletId || playerUid || '';
                                  const deedTokenId =
                                    hud.nearGamepassTokenId || onChainDeedLedger.token_id;
                                  if (!signer || !deedTokenId) return;
                                  soundEngine.playUiClick();
                                  setIsDeedLedgerTxBusy(true);
                                  setDeedLedgerActionFeedback(null);
                                  try {
                                    const tx = await executeMarketContractCallOnChain({
                                      signerAccountId: signer,
                                      methodName: 'claim_deed_payout',
                                      args: {
                                        token_id: deedTokenId,
                                        expected_key_epoch: onChainDeedLedger.key_epoch,
                                      },
                                    });
                                    if (!tx.ok) {
                                      setDeedLedgerActionFeedback({
                                        type: 'error',
                                        text: tx.error || 'Could not claim deed payout.',
                                      });
                                      return;
                                    }
                                    const payoutAmt = Number(
                                      onChainDeedLedger.pending_payout_respite || '0',
                                    );
                                    void logMarketTransactionToSupabase({
                                      merchant_id: 'lobby_cafe',
                                      actor_near_account: signer,
                                      action_type: 'CLAIM_DEED_PAYOUT',
                                      item_id: deedTokenId,
                                      currency: 'RESPITE',
                                      amount: payoutAmt,
                                      unit_price: 1,
                                      reasoning_summary: `Collected ${payoutAmt} RESPITE from your house`,
                                      near_tx_hash: tx.txHash,
                                    });
                                    setDeedLedgerActionFeedback({
                                      type: 'success',
                                      text: `Claimed +${payoutAmt} R`,
                                      txHash: tx.txHash,
                                    });
                                    await Promise.all([
                                      refreshOnChainBalances(signer),
                                      refreshOnChainDeedLedger(deedTokenId),
                                    ]);
                                  } finally {
                                    setIsDeedLedgerTxBusy(false);
                                  }
                                }}
                                className={`flex-1 py-1 border border-black text-[8.5px] font-black uppercase ${
                                  !isDeedLedgerTxBusy &&
                                  Number(onChainDeedLedger.pending_payout_respite || '0') > 0
                                    ? 'bg-[#b8ff3c] hover:bg-[#d9f99d] text-black cursor-pointer'
                                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                }`}
                              >
                                COLLECT
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-between gap-2 text-[8.5px] font-mono text-slate-300">
                            <span>
                              {isLoadingDeedLedger
                                ? 'Loading sub-account ledger...'
                                : 'Sub-account ledger ready'}
                            </span>
                            <button
                              type="button"
                              onClick={() => void refreshOnChainDeedLedger()}
                              className="px-1.5 py-0.5 bg-[#38bdf8] text-black font-black uppercase cursor-pointer"
                            >
                              SYNC
                            </button>
                          </div>
                        )}

                        {deedLedgerActionFeedback && (
                          <div
                            className={`text-[8.5px] font-bold ${
                              deedLedgerActionFeedback.type === 'success'
                                ? 'text-[#b8ff3c]'
                                : 'text-red-300'
                            }`}
                          >
                            <span>{deedLedgerActionFeedback.text}</span>
                            {deedLedgerActionFeedback.txHash && (
                              <>
                                {' '}
                                <a
                                  href={getNearBlocksTxUrl(deedLedgerActionFeedback.txHash)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline text-[#38bdf8]"
                                >
                                  Receipt
                                </a>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 1B. OWNED FURNITURE, HOUSE THEMES & COLLECTOR GEAR */}
                  {walletCatalogItems.map((item) => {
                    const qty = walletCatalogCounts[item.id] ?? 1;
                    const placedQty = placedFurnitureCounts[item.id] ?? 0;
                    const quote = evaluateMerchantItemQuote(marketState, item);
                    const categoryLabel =
                      item.category === 'nft_collector_furniture'
                        ? 'FURNITURE'
                        : item.category === 'nft_house_theme'
                          ? 'THEME'
                          : 'GEAR';
                    return (
                      <div
                        key={item.id}
                        data-wallet-catalog-item={item.id}
                        className="p-3 bg-white border-2 border-black shadow-[3px_3px_0_#000] space-y-2"
                      >
                        <div className="relative">
                          <Furniture3dThumbnail
                            catalogId={item.id}
                            name={item.name}
                            iconEmoji={item.iconEmoji}
                            size="normal"
                          />
                          <div className="absolute top-1.5 left-1.5 z-20 px-2 py-0.5 bg-[#d8b4fe] text-black border border-black font-black text-[9px] uppercase pointer-events-none">
                            {categoryLabel}
                          </div>
                          <div className="absolute top-1.5 right-1.5 z-20 px-1.5 py-0.5 bg-[#0f172a]/90 text-[#b8ff3c] border border-black font-mono font-bold text-[9px] pointer-events-none">
                            {item.isNft ? 'NFT' : 'ITEM'}
                            {qty > 1 ? ` ×${qty}` : ''}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-black uppercase text-black truncate">
                            {item.name}
                          </div>
                          <div className="text-[9.5px] font-mono text-slate-500 truncate">
                            {item.tokenId}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[9.5px] font-mono border-t border-slate-200 pt-1.5">
                          <span className="text-emerald-600 font-bold">
                            {placedQty > 0 ? `OWNED · IN ROOM ×${placedQty}` : 'OWNED'}
                          </span>
                          <span className="text-slate-500">
                            {quote.buyPrice} {item.currency}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* 1C. OWNED VEHICLES (NFT SCOOTERS) */}
                  {URBAN_SCOOTER_CATALOG_ITEMS.filter((v) =>
                    ownedScooterIds.includes(v.id),
                  ).map((v) => (
                    <div
                      key={v.id}
                      data-wallet-vehicle={v.id}
                      className="p-3 bg-white border-2 border-black shadow-[3px_3px_0_#000] space-y-2"
                    >
                      <div className="relative w-full h-28 bg-[#0f172a] border-2 border-black flex flex-col items-center justify-center text-center p-2">
                        <div className="text-xl font-black text-[#2dd4bf] tracking-widest uppercase">
                          VEHICLE
                        </div>
                        <div className="text-[10px] font-mono text-slate-300">
                          {v.subtitle}
                        </div>
                        <div className="absolute top-1.5 left-1.5 z-20 px-2 py-0.5 bg-[#d8b4fe] text-black border border-black font-black text-[9px] uppercase pointer-events-none">
                          GEAR
                        </div>
                        <div className="absolute top-1.5 right-1.5 z-20 px-1.5 py-0.5 bg-[#0f172a]/90 text-[#b8ff3c] border border-black font-mono font-bold text-[9px] pointer-events-none">
                          NFT
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase text-black truncate">
                          {v.name}
                        </div>
                        <div className="text-[9.5px] font-mono text-slate-500 truncate">
                          {v.tokenId}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9.5px] font-mono border-t border-slate-200 pt-1.5">
                        <span className="text-emerald-600 font-bold">OWNED</span>
                        <span className="text-slate-500">{v.priceRespite} RESPITE</span>
                      </div>
                    </div>
                  ))}

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

                  {totalOwnedWalletItems === 0 && (
                      <div className="col-span-1 sm:col-span-2 py-8 px-4 text-center bg-slate-50 border-2 border-dashed border-slate-300 text-slate-500 text-xs font-bold space-y-1">
                        <div>NO ITEMS YET</div>
                        <div className="text-[10.5px] text-slate-400">
                          Buy a house, furniture, recruit a companion, or mint caught fish into NFTs.
                        </div>
                      </div>
                    )}
                </div>
              </div>
              );
            })() : (
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
                    {(['ALL', 'LUL', 'CYON', 'RESPITE', 'NEAR'] as const).map((filterKey) => (
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
                    const displayAmount = formatWalletHistoryAmountDisplay(tx);
                    return displayAmount.badgeCurrency === walletHistoryFilter;
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
                        const displayAmount = formatWalletHistoryAmountDisplay(tx);
                        const actionLabel = formatWalletHistoryActionLabel(tx.action_type);
                        const badgeBg =
                          displayAmount.badgeCurrency === 'CYON'
                            ? 'bg-[#38bdf8]'
                            : displayAmount.badgeCurrency === 'RESPITE'
                              ? 'bg-[#d8b4fe]'
                              : displayAmount.badgeCurrency === 'NEAR'
                                ? 'bg-[#b8ff3c]'
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
                                    {actionLabel}
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
                                  {displayAmount.amountText}
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
          9B-3A. LEFT-SLIDE GEAR MODAL (Owned rideable vehicles, opened from GEAR)
         ===================================================================== */}
      <aside
        role="dialog"
        aria-modal="false"
        aria-hidden={!isGearModalOpen}
        inert={!isGearModalOpen || undefined}
        aria-label="Gear"
        data-gear-modal="true"
        className={`fixed left-4 top-16 bottom-20 z-40 w-full max-w-md flex flex-col select-none transition-all duration-300 ease-out transform ${
          isGearModalOpen
            ? 'translate-x-0 opacity-100 visible pointer-events-auto'
            : '-translate-x-[120%] opacity-0 invisible pointer-events-none'
        }`}
      >
        <div className="relative flex-1 flex flex-col bg-white border-[3.5px] border-black shadow-[4px_4px_0px_#000] p-4 sm:p-5 text-black overflow-hidden min-h-0">
          <div className="flex items-center justify-between gap-2 pb-3 border-b-[2.5px] border-black shrink-0">
            <div className="-skew-x-6 px-3 py-1 bg-[#fb923c] border-2 border-black shadow-[2px_2px_0px_#000] text-[11px] font-black uppercase flex items-center gap-1.5">
              <span className="skew-x-6 flex items-center gap-1">
                <Wrench className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                <span>YOUR GEAR</span>
              </span>
            </div>
            <button
              type="button"
              data-close-gear-btn="true"
              onClick={() => {
                soundEngine.playUiCancel();
                setIsGearModalOpen(false);
              }}
              className="-skew-x-6 w-8 h-8 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black shadow-[3px_3px_0px_#000] font-black text-xs flex items-center justify-center cursor-pointer active:scale-95 shrink-0"
              aria-label="Close Gear"
            >
              <span className="skew-x-6 inline-block">X</span>
            </button>
          </div>

          <div className="mt-3 flex-1 overflow-y-auto pr-1 space-y-3 min-h-0">
            {(() => {
              const isJoranEquipped = hud.equippedWeapon === 'Joran Fishing';
              const ownedFishingGear = MERCHANT_CATALOG_ITEMS.filter(
                (item) => item.category === 'fishing_gear' && ownedMerchantItemIds.includes(item.id),
              );
              return (
                <>
            {/* Personal Fishing Rod Card */}
            <div
              data-gear-item-card="fishing_rod"
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
                        {isJoranEquipped ? 'EQUIPPED' : 'IN GEAR'}
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
                  {isJoranEquipped ? 'Equipped' : 'Stored in Gear'}
                </span>

                <button
                  type="button"
                  data-gear-toggle-fishing-rod="true"
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
                data-gear-item-card={gear.id}
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
                </>
              );
            })()}

            {URBAN_SCOOTER_CATALOG_ITEMS.filter((v) => ownedScooterIds.includes(v.id)).map(
              (v) => {
                const isEquipped = equippedScooterKind === v.kind;
                return (
                  <div
                    key={v.id}
                    data-gear-vehicle={v.id}
                    className={`p-3.5 border-[2.5px] border-black shadow-[3px_3px_0px_#000] ${
                      isEquipped ? 'bg-[#dcfce7]' : 'bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 bg-[#0f172a] text-[#2dd4bf] border-2 border-black shadow-[2px_2px_0_#000] flex items-center justify-center font-black text-[10px] shrink-0">
                          RIDE
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-black uppercase tracking-wide text-black">
                              {v.name}
                            </span>
                            <span className="px-1.5 py-0.5 text-[9px] font-black uppercase border border-black bg-[#d8b4fe] text-black">
                              NFT
                            </span>
                            <span
                              className={`px-1.5 py-0.5 text-[9.5px] font-black uppercase border border-black ${
                                isEquipped
                                  ? 'bg-[#b8ff3c] text-black'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {isEquipped ? 'RIDING' : 'OWNED'}
                            </span>
                          </div>
                          <div className="text-[11px] font-bold text-slate-600 mt-0.5">
                            {v.subtitle}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        data-gear-equip-btn={v.id}
                        onClick={() => {
                          soundEngine.playUiClick();
                          if (isEquipped) {
                            dispatchBuddyAction('unequipScooter');
                          } else {
                            dispatchBuddyAction(`equipScooter:${v.kind}`);
                          }
                          setIsGearModalOpen(false);
                        }}
                        className={`-skew-x-6 px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_#000] font-black text-[11px] uppercase cursor-pointer shrink-0 ${
                          isEquipped
                            ? 'bg-[#ff3b30] text-white'
                            : 'bg-[#b8ff3c] hover:bg-[#d9f99d] text-black'
                        }`}
                      >
                        <span className="skew-x-6 inline-block">
                          {isEquipped ? 'GET OFF' : 'RIDE'}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              },
            )}

            {ownedScooterIds.length === 0 && (
              <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-400 text-center">
                <div className="text-xs font-black uppercase tracking-wider text-slate-700">
                  No rides yet
                </div>
                <div className="text-[11px] font-bold text-slate-500 mt-1">
                  Buy a scooter at the Scooter Showroom in the city, then ride it from here.
                </div>
              </div>
            )}

            <div className="p-3 bg-[#1e293b] text-white border-2 border-black shadow-[3px_3px_0px_#000]">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#b8ff3c]">
                HOW TO RIDE
              </div>
              <div className="text-[11px] font-bold text-slate-200 mt-1 leading-relaxed">
                Move with WASD or the joystick — hold Shift to go faster. Your scooter
                parks itself when you step indoors, board the tram, or enter the Warzone.
              </div>
            </div>
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
        inert={!isPersonalBagModalOpen || undefined}
        aria-label="Personal Bag"
        data-personal-bag-modal="true"
        className={`fixed left-4 top-16 bottom-20 z-40 w-full max-w-md flex flex-col select-none transition-all duration-300 ease-out transform ${
          isPersonalBagModalOpen
            ? 'translate-x-0 opacity-100 visible pointer-events-auto'
            : '-translate-x-[120%] opacity-0 invisible pointer-events-none'
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
                  <span>EQUIPMENT</span>
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
                  <span>ITEMS ({ownedMerchantItemIds.length + ownedApparelIds.length})</span>
                </div>
              </button>
            </div>

            <button
              type="button"
              data-close-personal-bag-btn="true"
              onClick={() => {
                soundEngine.playUiCancel();
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
              const ownedWardrobeItems = FASHION_APPAREL_CATALOG_ITEMS.filter((apparel) =>
                ownedApparelIds.includes(apparel.id),
              );
              const totalOwnedStudioCount = WARDROBE_STUDIO_ITEMS.filter(
                (item) => item.isStarterDefault || ownedApparelIds.includes(item.id),
              ).length;
              return (
                <div className="space-y-3">
                  {/* Wardrobe & Apparel Section inside Personal Bag */}
                  <div className="p-3 bg-slate-50 border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Shirt className="w-4 h-4 text-[#0284c7] shrink-0" />
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-900">
                          WARDROBE &amp; APPAREL ({totalOwnedStudioCount})
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {equippedTorsoItemId && (
                          <button
                            type="button"
                            onClick={() => handleToggleEquipApparel(null)}
                            className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-900 text-[9.5px] font-black uppercase border border-black cursor-pointer whitespace-nowrap"
                          >
                            Default Top
                          </button>
                        )}
                        {hud.worldMode !== 'warzone' && (
                          <button
                            type="button"
                            data-bag-open-wardrobe-studio-btn="true"
                            onClick={() => {
                              soundEngine.playUiConfirm();
                              setIsPersonalBagModalOpen(false);
                              setIsWardrobeStudioOpen(true);
                            }}
                            className="-skew-x-6 px-2.5 py-1 bg-[#f0abfc] hover:bg-[#f5d0fe] text-black text-[9.5px] font-black uppercase border-2 border-black shadow-[2px_2px_0_#000] cursor-pointer whitespace-nowrap"
                          >
                            <span className="skew-x-6 inline-block">3D STUDIO</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {ownedWardrobeItems.length === 0 ? (
                      <div className="p-3 bg-white border border-dashed border-slate-300 text-center space-y-1">
                        <div className="text-[11px] font-black uppercase text-slate-600">
                          Starter Wardrobe Ready
                        </div>
                        <p className="text-[10.5px] font-bold text-slate-500">
                          Open the 3D Wardrobe Studio to customize Top, Bottoms, Hair, Shoes, Sets, and Dye Colors.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {ownedWardrobeItems.map((apparel) => {
                          const isEquippedNow = equippedTorsoItemId === apparel.id;
                          return (
                            <div
                              key={apparel.id}
                              data-bag-apparel-row={apparel.id}
                              className="p-2.5 bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between gap-2.5"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-black text-slate-900 truncate">
                                  {apparel.name}
                                </div>
                                <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                                  <span>Torso Slot</span>
                                  <span aria-hidden="true"> · </span>
                                  <span>{characterGender === 'female' ? 'Female Fit' : 'Male Fit'}</span>
                                  <span aria-hidden="true"> · </span>
                                  <span className={isEquippedNow ? 'text-emerald-700 font-black' : 'text-slate-600'}>
                                    {isEquippedNow ? 'Wearing Now' : 'In Bag'}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                data-bag-equip-apparel-btn={apparel.id}
                                onClick={() => handleToggleEquipApparel(apparel.id)}
                                className={`-skew-x-6 px-3 py-1.5 border-2 border-black shadow-[2px_2px_0_#000] text-[10px] font-black uppercase cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                                  isEquippedNow
                                    ? 'bg-[#b8ff3c] hover:bg-[#d9f99d] text-black'
                                    : 'bg-[#38bdf8] hover:bg-[#7dd3fc] text-black'
                                }`}
                              >
                                <span className="skew-x-6 inline-block">
                                  {isEquippedNow ? 'TAKE OFF' : 'WEAR'}
                                </span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

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
              const ownedWardrobeItems = FASHION_APPAREL_CATALOG_ITEMS.filter((apparel) =>
                ownedApparelIds.includes(apparel.id),
              );
              const ownedPersonalItems = MERCHANT_CATALOG_ITEMS.filter((item) =>
                ownedMerchantItemIds.includes(item.id),
              );
              const bagOwnedCounts = countOwnedMerchantItems(ownedMerchantItemIds);
              return (
                <div className="space-y-2">
                  {ownedWardrobeItems.map((apparel) => {
                    const isEquippedNow = equippedTorsoItemId === apparel.id;
                    return (
                      <div
                        key={apparel.id}
                        className="p-2.5 bg-slate-50 border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-black uppercase text-black truncate">
                            {apparel.name}
                          </div>
                          <div className="text-[10.5px] font-bold text-slate-600 mt-0.5">
                            <span>Apparel · Torso</span>
                            <span aria-hidden="true"> · </span>
                            <span>{isEquippedNow ? 'Wearing Now' : 'Stored in Bag'}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleEquipApparel(apparel.id)}
                          className={`-skew-x-6 px-3 py-1.5 border-2 border-black shadow-[2px_2px_0_#000] text-[10px] font-black uppercase cursor-pointer whitespace-nowrap shrink-0 ${
                            isEquippedNow
                              ? 'bg-[#b8ff3c] hover:bg-[#d9f99d] text-black'
                              : 'bg-[#38bdf8] hover:bg-[#7dd3fc] text-black'
                          }`}
                        >
                          <span className="skew-x-6 inline-block">
                            {isEquippedNow ? 'TAKE OFF' : 'WEAR'}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                  {ownedPersonalItems.length === 0 && ownedWardrobeItems.length === 0 ? (
                    <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-300 text-center space-y-1.5">
                      <div className="text-xs font-black uppercase text-slate-600">
                        NO COLLECTIBLE ITEMS YET
                      </div>
                      <p className="text-[11px] font-bold text-slate-500">
                        Purchase outfits at the Fashion Boutique or furniture &amp; personal items from Merchant Hana (Plaza) or Kai (Beachfront).
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
                            {(bagOwnedCounts[item.id] ?? 1) > 1 && (
                              <span className="px-1.5 py-0.5 text-[9px] font-black uppercase border border-black bg-[#facc15] text-black">
                                ×{bagOwnedCounts[item.id]}
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] font-bold text-slate-600 mt-0.5 truncate">
                            {item.description}
                          </div>
                          {(placedFurnitureCounts[item.id] ?? 0) > 0 && (
                            <div className="text-[9.5px] font-black uppercase text-emerald-700 mt-0.5">
                              In room ×{placedFurnitureCounts[item.id]}
                            </div>
                          )}
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

      {/* 9C. Target / Nearby Merchant, NPC & Player Bar is unified inside CafeWorkShiftBottomDock */}

      {/* =====================================================================
          10. MMORPG CHARACTER PROFILE MODAL
         ===================================================================== */}
      <CharacterProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => {
          soundEngine.playUiCancel();
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
        playerLevel={levelProgress.level}
        playerXpLabel={`${levelProgress.currentLevelXp}/${levelProgress.xpForNextLevel} XP`}
        lulBalance={hud.gold}
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
          !cityViewActive &&
          onboardingStep === 'completed' &&
          playMode !== 'editor'
        }
        isModalBlocking={
          isKioskModalOpen ||
          isProfileModalOpen ||
          isPersonalWalletModalOpen ||
          isPersonalBagModalOpen ||
          isNearWalletSelectorOpen ||
          isScooterShowroomModalOpen ||
          isFashionBoutiqueModalOpen ||
          isWardrobeStudioOpen ||
          isRealEstateCatalogModalOpen ||
          isGrandCasinoModalOpen ||
          isCitizenDialogueOpen ||
          activeSpecialModal !== 'none' ||
          activeTeleportKioskModal !== 'none'
        }
        onTriggerBuddyAction={dispatchBuddyAction}
        forceShowJoystick={showJoystickOnDesktop}
        isWarzoneActive={worldMode === 'warzone' || hud.worldMode === 'warzone'}
        canFish={nearbyWaterZone.canFish}
        fishingPhase={fishingPhase}
        fishingCastPower={fishingCastPower}
        fishingBucketFull={caughtFishBucket.length >= 20}
        isHoldingReel={isHoldingReel}
        onFishingStartCharge={() => {
          if (fishingPhase === 'idle' && caughtFishBucket.length < 20) {
            ensureFishingRodEquipped();
            setIsChargingCast(true);
            setFishingPhase('charging');
          }
        }}
        onFishingReleaseCharge={() => {
          if (fishingPhase === 'charging') {
            launchShorelineCast(fishingCastPower);
          }
        }}
        onFishingSetHoldingReel={(holding) => setIsHoldingReel(holding)}
        onFishingTriggerAction={handleTriggerFishingAction}
        onFishingCancel={() => {
          soundEngine.playSoftTap();
          clearFishingCastTimers();
          setIsChargingCast(false);
          setIsHoldingReel(false);
          setFishingMinigame(null);
          setFishingHintMessage(null);
          setFishingPhase('idle');
        }}
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
      <InGameWalletConfirmModal
        request={localTxConfirmState?.request ?? null}
        onApprove={() => {
          localTxConfirmState?.resolve(true);
          setLocalTxConfirmState(null);
        }}
        onReject={() => {
          localTxConfirmState?.resolve(false);
          setLocalTxConfirmState(null);
        }}
      />
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
          setOwnedHouseStyle(null);
          setIsOnChainHouseStyleLocked(false);
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
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 pointer-events-auto select-none"
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
                <div className="text-xs font-black uppercase text-[#00f0ff] tracking-wider">
                  Checking house access...
                </div>
                <div className="w-full h-1.5 bg-black/50 overflow-hidden">
                  <div
                    className="h-full bg-[#00f0ff]"
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

      {/* 15. BOTANICAL GLASSHOUSE CAFE ("RUMAH KACA CAFE") DOCK, ORDER, ROTA & ATM MODALS + XP BANNER */}
      <CafeOrderSlideBanner
        isVisible={
          isInsideGlasshouseCafe && cafeShiftState.isWorking && isCafeOrderSlideBannerVisible
        }
        activeOrder={cafeShiftState.activeOrder}
        onOpenOrderDetails={handleOpenCafeOrderNotificationModal}
      />
      <CafeOrderNotificationBellButton
        isVisible={isInsideGlasshouseCafe && cafeShiftState.isWorking}
        hasUnread={hasUnreadCafeOrderNotif}
        shiftState={cafeShiftState}
        shiftRemainingSeconds={cafeShiftRemainingSec}
        onOpenOrderDetails={handleOpenCafeOrderNotificationModal}
      />
      <GlasshouseCafeOrderNotificationModal
        isOpen={isInsideGlasshouseCafe && activeCafeModal === 'order_notification'}
        activeOrder={cafeShiftState.activeOrder}
        onClose={() => setActiveCafeModal('none')}
      />
      {cafeConsumerSummary.isConsuming &&
        cafeConsumerSummary.activeItem &&
        activeCafeModal === 'none' &&
        !cafePrepStatus && (
          <div
            className="pointer-events-none fixed bottom-24 left-1/2 z-40 -translate-x-1/2 flex items-center gap-2.5 rounded-full border-[2.5px] border-black bg-[#14161d]/95 px-3.5 py-1.5 text-xs font-extrabold tracking-wide text-white shadow-[4px_4px_0_#000]"
            data-testid="cafe-consuming-status"
          >
            <div className="w-7 h-7 rounded-full bg-[#f7efe0] border border-black flex items-center justify-center shrink-0">
              <CafeMenuItemArtwork itemId={cafeConsumerSummary.activeItem.id} className="w-5 h-5" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] font-black text-[#b8ff3c]">
                Menikmati {cafeConsumerSummary.activeItem.name}
                {cafeConsumerState.totalBatchSize > 1
                  ? ` (${cafeConsumerState.consumedCount + 1}/${cafeConsumerState.totalBatchSize})`
                  : ''}
              </span>
              <div className="mt-0.5 flex items-center gap-2">
                <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden border border-black/60">
                  <div
                    className="h-full bg-[#fec83e] transition-all duration-200"
                    style={{
                      width: `${Math.max(
                        4,
                        Math.min(
                          100,
                          100 -
                            (cafeConsumerSummary.remainingActiveMs /
                              CAFE_ITEM_CONSUME_DURATION_MS) *
                              100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono-tabular text-amber-200">
                  {Math.max(1, Math.ceil(cafeConsumerSummary.remainingActiveMs / 1000))}s
                </span>
              </div>
            </div>
          </div>
        )}
      {isInsideGlasshouseCafe && cafeShiftState.isWorking && cafePrepStatus && (
        <div
          className="pointer-events-none fixed bottom-24 left-1/2 z-40 -translate-x-1/2 flex items-center gap-2.5 rounded-full border border-amber-300/70 bg-slate-950/95 px-4 py-2 text-xs font-extrabold tracking-wide text-amber-100 shadow-[0_12px_30px_rgba(0,0,0,0.45)]"
          data-testid="cafe-work-prep-status"
        >
          <span className="inline-block h-2.5 w-2.5 animate-ping rounded-full bg-amber-400" />
          <span>
            {cafePrepStatus.stage === 'serving'
              ? `Menyajikan ${cafePrepStatus.itemName} ke counter...`
              : cafePrepStatus.stage === 'moving'
                ? `Membawa ${cafePrepStatus.itemName} ke counter...`
                : cafePrepStatus.category === 'pastry'
                  ? `Menata ${cafePrepStatus.itemName}...`
                  : `Membuat ${cafePrepStatus.itemName}...`}
          </span>
        </div>
      )}
      {(() => {
        const isDockBlockedByModal =
          gameState !== 'playing' ||
          playMode === 'editor' ||
          cityViewActive ||
          onboardingStep !== 'completed' ||
          isKioskModalOpen ||
          isProfileModalOpen ||
          isSocialChatModalOpen ||
          isPersonalWalletModalOpen ||
          isPersonalBagModalOpen ||
          isNearWalletSelectorOpen ||
          isDailyMissionsModalOpen ||
          isScooterShowroomModalOpen ||
          isFashionBoutiqueModalOpen ||
          isWardrobeStudioOpen ||
          isRealEstateCatalogModalOpen ||
          isGrandCasinoModalOpen ||
          isCitizenDialogueOpen ||
          activeSpecialModal !== 'none' ||
          activeTeleportKioskModal !== 'none' ||
          activeCafeModal !== 'none' ||
          Boolean(cafePrepStatus) ||
          Boolean(tramRideCutsceneUi?.active);

        const activeSelectedTarget =
          selectedTargetUser &&
          !selectedTargetUser.isSelf &&
          String(selectedTargetUser.id) !== '0'
            ? selectedTargetUser
            : null;
        const dockEntity = activeSelectedTarget ?? nearbyDockEntity;

        let effectiveDockMode: UnifiedBottomDockActionMode = 'none';
        if (!isDockBlockedByModal) {
          if (unifiedBottomDockMode === 'stand_up') {
            if (fishingPhase === 'idle' && !nearbyWaterZone.canFish) {
              effectiveDockMode = 'stand_up';
            }
          } else if (activeSelectedTarget) {
            if (fishingPhase === 'idle' && !nearbyWaterZone.canFish) {
              effectiveDockMode = 'nearby_entity';
            }
          } else if (unifiedBottomDockMode === 'work_shift') {
            if (isInsideGlasshouseCafe && !cafeShiftState.isWorking) {
              effectiveDockMode = 'work_shift';
            }
          } else if (unifiedBottomDockMode === 'sit') {
            if (fishingPhase === 'idle' && !nearbyWaterZone.canFish) {
              effectiveDockMode = 'sit';
            }
          } else if (unifiedBottomDockMode === 'nearby_entity' && dockEntity) {
            if (fishingPhase === 'idle' && !nearbyWaterZone.canFish) {
              effectiveDockMode = 'nearby_entity';
            }
          }
        }

        const nearbyCycleList = (hud.nearbyRadiusUsers ?? []).filter(
          (u) => String(u.id) !== '0' && u.distance <= 8.5,
        );
        const canCycleNearby =
          Boolean(dockEntity) && nearbyCycleList.length > 1;

        return (
          <CafeWorkShiftBottomDock
            isVisible={effectiveDockMode !== 'none'}
            actionMode={effectiveDockMode}
            isExpanded={isCafeRotaMenuExpanded}
            shiftState={cafeShiftState}
            nearbyEntity={dockEntity}
            isEntityMenuExpanded={isTargetMenuExpanded}
            canCycleNearbyEntity={canCycleNearby}
            onToggleExpand={() => {
              soundEngine.playUiClick();
              setIsCafeRotaMenuExpanded((prev) => !prev);
            }}
            onToggleEntityMenu={() => {
              setIsTargetMenuExpanded((prev) => !prev);
            }}
            onTriggerSitOrStand={() => {
              window.dispatchEvent(new CustomEvent('trigger-sit-or-stand-action'));
            }}
            onOpenEntityProfile={(entity) => {
              soundEngine.playUiClick();
              setIsTargetMenuExpanded(false);
              setIsKioskModalOpen(false);
              setIsSocialChatModalOpen(false);
              setIsPersonalWalletModalOpen(false);
              setActiveSpecialModal('none');
              setActiveTeleportKioskModal('none');
              window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
              setProfileTargetUser(entity);
              setIsProfileModalOpen(true);
            }}
            onTalkMerchant={(entity) => {
              soundEngine.playUiClick();
              setIsTargetMenuExpanded(false);
              setIsKioskModalOpen(false);
              setIsSocialChatModalOpen(false);
              setIsPersonalWalletModalOpen(false);
              setActiveTeleportKioskModal('none');
              window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
              const location =
                entity.merchantLocation ??
                (entity.id === 'npc_beach' || entity.id === 'npc_kai'
                  ? 'beach_house'
                  : 'lobby_cafe');
              window.dispatchEvent(
                new CustomEvent('open-npc-merchant-ui', {
                  detail: { location },
                }),
              );
            }}
            onTalkCitizen={(entity) => {
              soundEngine.playUiClick();
              openCitizenDialogueForId(String(entity.id));
            }}
            onWhisperEntity={(entity) => {
              soundEngine.playUiClick();
              setIsTargetMenuExpanded(false);
              setIsKioskModalOpen(false);
              setIsProfileModalOpen(false);
              setIsPersonalWalletModalOpen(false);
              setActiveSpecialModal('none');
              setActiveTeleportKioskModal('none');
              window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
              setSelectedPrivateUser(entity);
              setIsSocialChatModalOpen(true);
            }}
            onCycleNearbyEntity={() => {
              if (!dockEntity || nearbyCycleList.length <= 1) return;
              const currentIdx = nearbyCycleList.findIndex(
                (u) => String(u.id) === String(dockEntity.id),
              );
              const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % nearbyCycleList.length : 0;
              const nextUser = nearbyCycleList[nextIdx];
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
            onOpenRotaModal={() => {
              soundEngine.playUiClick();
              setIsCafeRotaMenuExpanded(false);
              setActiveCafeModal('rota');
            }}
            onStartOrQueueShift={handleStartCafeWorkShift}
            onLeaveShiftQueue={handleLeaveCafeWorkShiftQueue}
            onOpenAtmModal={() => {
              soundEngine.playUiClick();
              setIsCafeRotaMenuExpanded(false);
              setActiveCafeModal('atm');
            }}
          />
        );
      })()}
      <GlasshouseCafeRotaModal
        isOpen={isInsideGlasshouseCafe && activeCafeModal === 'rota'}
        onClose={() => setActiveCafeModal('none')}
        shiftState={cafeShiftState}
        playerName={playerDisplayName || 'YOU'}
        onStartOrQueueShift={handleStartCafeWorkShift}
        onLeaveShiftQueue={handleLeaveCafeWorkShiftQueue}
        onToggleSimulatedWorker={handleToggleSimulatedCafeWorker}
      />
      <GlasshouseCafePrepModal
        isOpen={
          isInsideGlasshouseCafe &&
          (activeCafeModal === 'prep_pastry' || activeCafeModal === 'prep_drink')
        }
        category={activeCafeModal === 'prep_pastry' ? 'pastry' : 'drink'}
        onClose={() => setActiveCafeModal('none')}
        onPrepareItem={handlePrepareCafeOrder}
      />
      <GlasshouseCafeOrderModal
        isOpen={isInsideGlasshouseCafe && activeCafeModal === 'order'}
        onClose={() => setActiveCafeModal('none')}
        lulBalance={hud.gold}
        levelProgress={levelProgress}
        consumerSummary={cafeConsumerSummary}
        onPurchaseItem={handlePurchaseCafeItem}
        onPurchaseBatch={handlePurchaseCafeBatch}
      />
      <GlasshouseCafeAtmModal
        isOpen={isInsideGlasshouseCafe && activeCafeModal === 'atm'}
        onClose={() => setActiveCafeModal('none')}
        lulBalance={hud.gold}
        cyonBalance={cyonBalance}
        lulCostFor10Cyon={cafeExchangeQuote.lulCostFor10Cyon}
        treasuryCyon={marketState.treasuryCyon}
        onExchangePackets={handleCafeExchangeLulToCyonPackets}
      />
      <GlasshouseCafeSlotModal
        isOpen={isInsideGlasshouseCafe && activeCafeModal === 'arcade_slot'}
        onClose={() => setActiveCafeModal('none')}
        lulBalance={hud.gold}
        levelProgress={levelProgress}
        onDebitStake={handleArcadeSlotDebitStake}
        onSettleSpin={handleArcadeSlotSettleSpin}
      />
      <GrandCasinoModal
        isOpen={isGrandCasinoModalOpen && hud.worldMode !== 'warzone'}
        onClose={() => setIsGrandCasinoModalOpen(false)}
        initialTab={grandCasinoInitialTab}
        slotVariant={grandCasinoSlotVariant}
        lulBalance={hud.gold}
        respiteBalance={respiteBalance}
        levelProgress={levelProgress}
        onDebitStake={handleArcadeSlotDebitStake}
        onDebitSlotRespite={handleCasinoDebitRespiteStake}
        onSettleSlots={handleArcadeSlotSettleSpin}
        onSettleSlotRespite={handleCasinoSettleRespiteWin}
        onSettleTableGame={handleCasinoSettleTableGame}
        onOrderLoungeDrink={handleOrderCasinoLoungeDrink}
      />
      <DailyMissionsModal
        isOpen={isDailyMissionsModalOpen && hud.worldMode !== 'warzone'}
        onClose={() => {
          soundEngine.playUiClick();
          setIsDailyMissionsModalOpen(false);
        }}
        missionsState={dailyMissionsState}
        claimedPlotSummary={{
          hasClaimedPlot: Boolean(hud.nearClaimedTeam && hud.nearClaimedPlotIndex != null),
          team: hud.nearClaimedTeam ?? null,
          plotIndex: hud.nearClaimedPlotIndex ?? null,
        }}
        onClaimMission={handleClaimDailyMission}
        onClaimAllClearBonus={handleClaimDailyAllClearBonus}
        onShortcutTravel={(missionId, stationId) => {
          soundEngine.playUiClick();
          setIsDailyMissionsModalOpen(false);
          if (missionId === 'work_cafe' && isInsideGlasshouseCafe) {
            // Already inside the cafe: the shift can start right here.
            return;
          }
          if (isInsidePrivateHouse) {
            dispatchBuddyAction('exitPrivateHouseInterior');
          }
          if (isInsideGlasshouseCafe) {
            dispatchBuddyAction('exitGlasshouseCafe');
          }
          if (isInsideGrandCasino) {
            dispatchBuddyAction('exitGrandCasino');
          }
          if (isInsideBeautySalon) {
            dispatchBuddyAction('exitBeautySalon');
          }
          if (hud.worldMode === 'warzone') return;
          const def = DAILY_MISSIONS_CATALOG.find((m) => m.id === missionId);
          let finalX = 0;
          let finalZ = 0;
          let guideStationId: CityTransitStationId | null = null;
          if (missionId === 'meet_kai') {
            finalX = 85.8;
            finalZ = 60.0;
            guideStationId = 'kai_fish_market';
          } else if (missionId === 'go_fishing') {
            finalX = 86.85;
            finalZ = 65.65;
            guideStationId = 'kai_fish_market';
          } else if (missionId === 'work_cafe') {
            finalX = -88.3;
            finalZ = 22.35;
          } else if (missionId === 'buy_house') {
            // Real Estate Kiosk A-frame trigger (west plaza).
            finalX = -97.414;
            finalZ = -17.322;
          } else if (missionId === 'buy_scooter') {
            // Urban Scooter Showroom A-frame trigger (west plaza).
            finalX = -97.355;
            finalZ = -4.574;
          } else {
            const dest = getCityTransitDestinationById(stationId);
            finalX = dest.spawnX;
            finalZ = dest.spawnZ;
            guideStationId = stationId;
          }
          // Scooter owners ride instead of teleporting: far missions and the
          // trip home follow the asphalt road network straight to the target
          // (no kiosk, no tram), which also lands them at their own plot door
          // instead of a station spawn they then have to search from.
          const hasScooter = ownedScooterIds.length > 0;
          let roadRoute = false;
          if (hasScooter && (missionId === 'meet_kai' || missionId === 'go_fishing')) {
            guideStationId = null;
            roadRoute = true;
          } else if (hasScooter && missionId === 'visit_claimed_house') {
            const claimedTeam = hud.nearClaimedTeam;
            const claimedIdx = hud.nearClaimedPlotIndex;
            if (claimedTeam && claimedIdx != null && claimedIdx >= 0 && claimedIdx <= 3) {
              finalX = [-45, -15, 15, 45][claimedIdx];
              finalZ = claimedTeam === 'blue' ? 73.45 : -73.45;
              guideStationId = null;
              roadRoute = true;
            }
          } else if (hasScooter && missionId === 'claim_plot_house') {
            finalX = 6.5;
            finalZ = -46.4;
            guideStationId = null;
            roadRoute = true;
          }
          // Far missions guide to a teleport kiosk first (leg 1); when the
          // tram arrives at the mission station, leg 2 guides to the target.
          const farGuide = guideStationId !== null;
          const nextGuide = {
            missionId,
            title: def?.title ?? 'Daily Mission',
            stage: farGuide ? ('to_kiosk' as const) : ('direct' as const),
            finalX,
            finalZ,
            stationId: guideStationId,
            roadRoute,
          };
          missionGuideRef.current = nextGuide;
          setMissionGuide(nextGuide);
          setMissionGuideDistanceM(null);
          window.dispatchEvent(
            new CustomEvent('set-tutorial-waypoint', {
              detail: farGuide
                ? { target: 'kiosk', color: '#22ff5e' }
                : {
                    target: 'coord',
                    x: finalX,
                    z: finalZ,
                    color: '#22ff5e',
                    roadRoute,
                  },
            }),
          );
        }}
      />
      <UrbanScooterShowroomModal
        isOpen={isScooterShowroomModalOpen && hud.worldMode !== 'warzone'}
        onClose={() => setIsScooterShowroomModalOpen(false)}
        respiteBalance={respiteBalance}
        walletConnected={Boolean(hud.nearWalletConnected || hud.nearWalletId || playerUid)}
        walletAccountId={hud.nearWalletId || playerUid || null}
        ownedScooterIds={ownedScooterIds}
        onConnectWallet={() => {
          setIsScooterShowroomModalOpen(false);
          setIsNearWalletSelectorOpen(true);
        }}
        onOpenWalletTopUp={() => {
          setIsScooterShowroomModalOpen(false);
          setPersonalWalletTab('wallet');
          setIsPersonalWalletModalOpen(true);
        }}
        onPurchaseScooter={async (item: UrbanScooterCatalogItem) => {
          if (ownedScooterIds.includes(item.id)) {
            return { ok: true };
          }
          if (respiteBalance < item.priceRespite) {
            return {
              ok: false,
              errorMessage: `Insufficient RESPITE balance (${respiteBalance.toLocaleString()} / ${item.priceRespite} RESPITE).`,
            };
          }
          const actorAccount = hud.nearWalletId || playerUid;
          if (!actorAccount) {
            return {
              ok: false,
              errorMessage: 'Connect your wallet to buy this scooter.',
            };
          }
          // Real on-chain purchase from the merchant's pre-minted stock —
          // the same buy_merchant_item path as NFT furniture. RESPITE moves
          // buyer -> merchant and the vehicle token moves stock -> buyer in
          // one transaction; local state only mirrors the chain afterwards.
          const buyRes = await executeMarketContractCallOnChain({
            signerAccountId: actorAccount,
            methodName: 'buy_merchant_item',
            args: {
              token_id: item.tokenId,
              amount: '1',
              price_respite: String(item.priceRespite),
            },
          });
          if (!buyRes.ok || !buyRes.txHash) {
            return {
              ok: false,
              errorMessage:
                'Purchase did not settle on-chain. Your RESPITE was not charged — please try again.',
            };
          }
          const resolvedActor = buyRes.signerAccountId || actorAccount;
          let nextRespite = Math.max(0, respiteBalance - item.priceRespite);
          const liveRespiteStr = await fetchNep141Balance(
            NEAR_CONFIG.nep141RespiteContractId,
            resolvedActor,
            'optimistic',
          );
          if (liveRespiteStr !== null) {
            nextRespite = Math.max(0, Number(liveRespiteStr) || 0);
          }
          setRespiteBalance(nextRespite);
          const nextOwned = [...ownedScooterIds, item.id];
          setOwnedScooterIds(nextOwned);
          if (typeof window !== 'undefined') {
            try {
              window.localStorage.setItem(
                `bb_owned_scooters_v1:${dailyMissionsAccountKey}`,
                JSON.stringify(nextOwned),
              );
            } catch {
              // ignore storage failures
            }
            window.dispatchEvent(
              new CustomEvent('urban-scooter-purchased', {
                detail: {
                  item,
                  accountId: resolvedActor,
                  priceRespite: item.priceRespite,
                  remainingRespite: nextRespite,
                  txHash: buyRes.txHash,
                },
              }),
            );
          }
          void logMarketTransactionToSupabase({
            actor_near_account: resolvedActor,
            action_type: 'buy_item',
            item_id: item.id,
            nep245_token_id: item.tokenId,
            currency: 'RESPITE',
            amount: 1,
            unit_price: item.priceRespite,
            reasoning_summary: `You purchased ${item.name} (${item.priceRespite} RESPITE).`,
            near_tx_hash: buyRes.txHash,
          });
          void createLetterForAccount({
            recipientAccount: resolvedActor,
            kind: 'item_purchase',
            title: `Certificate of Ownership — ${item.name}`,
            payload: {
              buyerAccount: resolvedActor,
              sellerName: 'Urban Scooter Showroom',
              sellerAccount: 'buddiesblitz.testnet',
              itemName: item.name,
              itemId: item.id,
              tokenId: item.tokenId,
              assetKind: item.kind,
              priceAmount: item.priceRespite,
              priceCurrency: 'RESPITE',
              settlementContract: NEAR_CONFIG.marketContractId,
            },
            txHash: buyRes.txHash,
          });
          return { ok: true };
        }}
      />
      <FashionBoutiqueModal
        isOpen={isFashionBoutiqueModalOpen && hud.worldMode !== 'warzone'}
        onClose={() => setIsFashionBoutiqueModalOpen(false)}
        lulBalance={hud.gold}
        characterGender={characterGender}
        ownedApparelIds={ownedApparelIds}
        equippedTorsoItemId={equippedTorsoItemId}
        onPurchaseApparelToBag={handlePurchaseFashionApparelToBag}
        onOpenPersonalBag={() => {
          setPersonalBagTab('equipment');
          setIsPersonalBagModalOpen(true);
        }}
      />
      <WardrobeStudioModal
        isOpen={isWardrobeStudioOpen && hud.worldMode !== 'warzone'}
        accountKey={dailyMissionsAccountKey}
        characterGender={characterGender}
        lulBalance={hud.gold}
        ownedApparelIds={ownedApparelIds}
        initialDraft={equippedWardrobeDraft}
        onChangeGender={(nextGender) => {
          setCharacterGender(nextGender);
          dispatchBuddyAction(`setCharacterGender:${nextGender}`);
        }}
        onPurchaseItem={handlePurchaseWardrobeStudioItem}
        onComplete={handleCompleteWardrobeStudio}
        onClose={() => setIsWardrobeStudioOpen(false)}
      />
      <RealEstateCatalogModal
        isOpen={isRealEstateCatalogModalOpen && hud.worldMode !== 'warzone'}
        initialTab={realEstateCatalogTab}
        onClose={() => setIsRealEstateCatalogModalOpen(false)}
        marketState={marketState}
        respiteBalance={respiteBalance}
        cyonBalance={cyonBalance}
        nearTestnetBalance={nearTestnetBalance}
        walletConnected={Boolean(hud.nearWalletConnected)}
        playerNearAccount={hud.nearWalletId || playerUid || ''}
        hasHouseOwnership={hasHouseOwnership || Boolean(hud.nearHasGamepassNft)}
        ownedItemIds={ownedMerchantItemIds}
        houseArchitectureStyle={houseArchitectureStyle}
        ownedHouseStyle={ownedHouseStyle}
        onChainHouseStyleLocked={isOnChainHouseStyleLocked}
        propertyListings={propertyListings}
        busyPropertyListingId={busyPropertyListingId}
        onConnectWallet={() => {
          setIsRealEstateCatalogModalOpen(false);
          setIsNearWalletSelectorOpen(true);
        }}
        onOpenWalletTopUp={() => {
          setIsRealEstateCatalogModalOpen(false);
          setPersonalWalletTab('wallet');
          setIsPersonalWalletModalOpen(true);
        }}
        onSelectHouseArchitectureStyle={(style) => {
          setAndPersistHouseArchitectureStyle(style);
        }}
        onViewModelHouse={handleViewModelHouse}
        onEnterOwnHouse={handleEnterOwnHouse}
        onBuyHouseWithRespite={handleBuyHouseWithRespite}
        onBuyMerchantItem={handleBuyCatalogMerchantItem}
        onCreatePropertyListing={handleCreatePropertyListing}
        onCancelPropertyListing={handleCancelPropertyListing}
        onBuyPropertyListing={handleBuyPropertyListing}
        onCompletePropertyTransfer={handleCompletePropertyTransfer}
      />
      <CitizenDialogueModal
        isOpen={isCitizenDialogueOpen && hud.worldMode !== 'warzone'}
        citizenId={activeCitizenId}
        openSeq={citizenOpenSeq}
        friendshipStore={citizenFriendshipStore}
        caughtFishBucket={caughtFishBucket}
        isRaining={weatherCondition === 'hujan'}
        daytimePhase={
          lightingPreset === 'night'
            ? 'night'
            : lightingPreset === 'dusk' || lightingPreset === 'dawn'
              ? 'evening'
              : 'day'
        }
        talkedBonusJustAwarded={citizenTalkedBonusJustAwarded}
        playerBubbleBgColor={chatBubbleBgColor}
        playerBubbleTextColor={chatBubbleTextColor}
        onClose={() => setIsCitizenDialogueOpen(false)}
        onGiveCatalogGift={(citizenId, giftId) => {
          const giftRes = recordCitizenDailyGift(citizenFriendshipStoreRef.current, citizenId, {
            kind: 'catalog',
            giftId,
          });
          if (giftRes.accepted) {
            soundEngine.playUiClick();
            citizenFriendshipStoreRef.current = giftRes.store;
            setCitizenFriendshipStore(giftRes.store);
            saveCitizenFriendshipStore(giftRes.store);
          }
          return {
            accepted: giftRes.accepted,
            reactionLine: giftRes.reactionLine,
            tier: giftRes.tier,
            pointsAwarded: giftRes.pointsAwarded,
          };
        }}
        onGiveFishGift={(citizenId, fish) => {
          const giftRes = recordCitizenDailyGift(citizenFriendshipStoreRef.current, citizenId, {
            kind: 'fish',
            fish,
          });
          if (giftRes.accepted) {
            soundEngine.playUiClick();
            citizenFriendshipStoreRef.current = giftRes.store;
            setCitizenFriendshipStore(giftRes.store);
            saveCitizenFriendshipStore(giftRes.store);
            setCaughtFishBucket((prev) => prev.filter((item) => item.id !== fish.id));
          }
          return {
            accepted: giftRes.accepted,
            reactionLine: giftRes.reactionLine,
            tier: giftRes.tier,
            pointsAwarded: giftRes.pointsAwarded,
          };
        }}
        onVisitDirectoryCitizen={(profile: CitizenProfile) => {
          soundEngine.playUiClick();
          setIsCitizenDialogueOpen(false);
          setActiveTeleportKioskModal(profile.stationId);
        }}
      />
      <XpGainCelebrationBanner banner={xpCelebrationBanner} />

      {/* =====================================================================
          14. CITY VIEW SIGHTSEEING OVERLAY (Minimap-Triggered Aerial & District Focus)
         ===================================================================== */}
      {isPreloadComplete &&
        gameState === 'playing' &&
        onboardingStep === 'completed' &&
        cityViewActive && (
          <div
            data-city-view-hud="true"
            className="fixed inset-0 z-[60] pointer-events-none select-none overflow-hidden"
          >
            {/* Floating 3D-Projected Active Place Label + Neighbor Switch Pills */}
            {cityViewAnchors.active && (
              <div
                style={{
                  left: `${cityViewAnchors.active.leftPct}%`,
                  top: `${cityViewAnchors.active.topPct}%`,
                }}
                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full -mt-2 px-3.5 py-2 rounded-2xl bg-white/95 text-[#0f131c] shadow-[0_10px_28px_rgba(0,0,0,0.35)] border border-black/10 text-center flex flex-col items-center gap-1"
              >
                <div className="text-xs font-black tracking-wide leading-tight">
                  {cityViewAnchors.active.label}
                </div>
                <div className="text-[10px] font-semibold text-slate-600 leading-tight">
                  {cityViewAnchors.active.subtitle}
                </div>
                <button
                  type="button"
                  data-city-view-walk-here="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.currentTarget.blur();
                    const dSpec = CITY_VIEW_DISTRICTS.find(
                      (d) => d.id === cityViewAnchors.active?.id,
                    );
                    if (!dSpec) return;
                    soundEngine.playUiConfirm();
                    window.dispatchEvent(
                      new CustomEvent('click-to-walk-navigate', {
                        detail: {
                          x: dSpec.lookAtPos.x,
                          z: dSpec.lookAtPos.z,
                          rawX: dSpec.lookAtPos.x,
                          rawZ: dSpec.lookAtPos.z,
                          label: dSpec.label,
                          source: 'minimap',
                        },
                      }),
                    );
                    exitCityViewMode();
                  }}
                  className="mt-0.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#b8ff3c] hover:bg-[#a3e635] text-[#0f131c] border border-[#14161d] text-[10px] font-black tracking-wide shadow-xs cursor-pointer transition-transform active:scale-95"
                >
                  <Navigation className="w-2.5 h-2.5" />
                  <span>Jalan ke sini</span>
                </button>
              </div>
            )}

            {cityViewAnchors.neighbors.map((nb) => (
              <button
                key={`city-view-nb-${nb.id}`}
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  selectCityViewTarget(nb.id);
                }}
                style={{
                  left: `${nb.leftPct}%`,
                  top: `${nb.topPct}%`,
                }}
                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-[#0f131c]/88 hover:bg-[#0f131c]/95 text-white border border-white/25 shadow-[0_8px_22px_rgba(0,0,0,0.32)] text-left cursor-pointer transition-all hover:scale-105 active:scale-95"
              >
                <div className="text-[11px] font-bold leading-tight">{nb.label}</div>
                <div className="text-[9.5px] text-white/75 leading-tight">{nb.subtitle}</div>
              </button>
            ))}

            {/* Top-Left District & Kota Overview Pills */}
            <div className="pointer-events-auto fixed top-3 left-3 sm:top-4 sm:left-4 max-w-[calc(100vw-11rem)] sm:max-w-[540px] flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-2xl bg-[#0f131c]/90 border border-white/15 shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
                <button
                  type="button"
                  data-city-view-pill="kota"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    selectCityViewTarget('kota');
                  }}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wide cursor-pointer transition-all ${
                    cityViewTarget === 'kota'
                      ? 'bg-white text-[#0f131c] shadow-sm'
                      : 'bg-white/10 text-white/85 hover:bg-white/20'
                  }`}
                >
                  Kota
                </button>
                {CITY_VIEW_DISTRICTS.map((dist) => {
                  const isActive = cityViewTarget === dist.id;
                  return (
                    <button
                      key={dist.id}
                      type="button"
                      data-city-view-pill={dist.id}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        selectCityViewTarget(dist.id);
                      }}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wide cursor-pointer transition-all ${
                        isActive
                          ? 'bg-white text-[#0f131c] shadow-sm'
                          : 'bg-white/10 text-white/85 hover:bg-white/20'
                      }`}
                    >
                      {dist.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Top-Right Prev / Index / Next + Exit Button */}
            <div className="pointer-events-auto fixed top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#0f131c]/90 border border-white/15 shadow-[0_12px_32px_rgba(0,0,0,0.35)] text-white">
                <button
                  type="button"
                  data-city-view-prev="true"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    selectCityViewTarget(getAdjacentCityViewDistrictId(cityViewTarget, -1));
                  }}
                  className="px-2 py-0.5 rounded-full text-[11px] font-bold hover:bg-white/15 cursor-pointer"
                >
                  &larr; Prev
                </button>
                <span className="px-1.5 text-[11px] font-mono font-bold text-white/80">
                  {cityViewTarget === 'kota'
                    ? 'Kota'
                    : `${
                        CITY_VIEW_DISTRICTS.findIndex((d) => d.id === cityViewTarget) + 1
                      } / ${CITY_VIEW_DISTRICTS.length}`}
                </span>
                <button
                  type="button"
                  data-city-view-next="true"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    selectCityViewTarget(getAdjacentCityViewDistrictId(cityViewTarget, 1));
                  }}
                  className="px-2 py-0.5 rounded-full text-[11px] font-bold hover:bg-white/15 cursor-pointer"
                >
                  Next &rarr;
                </button>
              </div>
              <button
                type="button"
                data-city-view-exit="true"
                onClick={(e) => {
                  e.currentTarget.blur();
                  exitCityViewMode();
                }}
                className="px-3.5 py-2 rounded-full bg-white text-[#0f131c] hover:bg-slate-100 text-[11px] font-black tracking-wide shadow-[0_10px_28px_rgba(0,0,0,0.35)] cursor-pointer transition-transform active:scale-95"
              >
                &times; Kembali
              </button>
            </div>

            {/* Bottom-Center Click-to-Walk Hint inside 3D Aerial City View */}
            <div className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-[#0f131c]/90 text-white/90 border border-white/20 shadow-[0_8px_22px_rgba(0,0,0,0.35)] text-[11px] font-semibold tracking-wide whitespace-nowrap">
              Klik lokasi mana saja di peta 3D untuk berjalan ke sana · Drag untuk geser kamera
            </div>

            {/* Bottom-Right Weather & Time Pill inside City View */}
            <div className="pointer-events-auto fixed bottom-3 right-3">
              <HudWeatherAndTimeControl
                contextId="city_view"
                popoverPlacement="top"
                lightingPreset={lightingPreset}
                timeOfDayHours={timeOfDayHours}
                weatherCondition={weatherCondition}
                rainIntensityTier={rainIntensityTier}
                autoCycleEnabled={autoTimeCycle}
                cityLightsScale={cityLightsScale}
                onSelectTimePhase={handleSelectTimePhase}
                onCycleTimePhase={handleCycleLighting}
                onChangeTimeOfDayHours={handleChangeTimeOfDayHours}
                onSelectWeatherCondition={handleSelectWeatherCondition}
                onSelectRainIntensityTier={handleSelectRainIntensityTier}
                onToggleAutoCycle={handleToggleAutoTimeCycle}
                onChangeCityLightsScale={handleChangeCityLightsScale}
              />
            </div>
          </div>
        )}
    </main>
  );
}
