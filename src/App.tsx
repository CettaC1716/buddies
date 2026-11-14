import { useState, useEffect, useCallback, useRef } from 'react';
import { useSafePrivy, useSafePrivyLogin } from './lib/privyAuthBridge';
import {
  User,
  MessageCircle,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Wallet,
  History,
  ArrowLeft,
  Backpack,
  Package,
  Play,
  Volume2,
  VolumeX,
  LogIn,
  X,
} from 'lucide-react';
import {
  BuddiesBlitzArena,
  GameState,
  PlayMode,
  HudSnapshot,
} from './game/BuddiesBlitzArena';
import {
  LIGHTING_PRESETS,
  LightingPresetKey,
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
  resolveTutorialFurnitureTarget,
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
  stepFastForwardEconomyTick,
  MerchantLocationId,
  MerchantCatalogItem,
  HouseInteriorSlotId,
  MERCHANT_CATALOG_ITEMS,
} from './game/buddiesMerchantPricing';
import {
  applyPlayerXpGain,
  computeLevelProgress,
  createInitialCafeWorkShiftState,
  joinCafeWorkShiftQueue,
  leaveCafeWorkShiftQueue,
  purchaseCafeMenuItem,
  serveActiveCafeOrder,
  stepOtherActiveCafeWorkerServe,
  toggleSimulatedOtherCafeWorker,
  type CafeMenuItemSpec,
  type CafeWorkShiftState,
} from './game/buddiesCafeRules';
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
} from './components/GlasshouseCafeModal';
import {
  FAMILY_MEMBER_CONTRACT_PLANS,
  FAMILY_MEMBER_ORDER_SPECS,
  HOUSE_OWNERSHIP_PRICE_RESPITE,
  NEAR_CONFIG,
  RESPITE_NEP141_METADATA,
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
  fetchRecentSocialMessages,
  insertSocialMessageToSupabase,
  createLetterForAccount,
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
    'Generating browser self-custody Ed25519 key...',
  );
  const [provisionedSubWalletTxHash, setProvisionedSubWalletTxHash] = useState<string>('');
  const [tutorialStage, setTutorialStage] = useState<
    'none' | 'welcome_modal' | 'go_to_hana' | 'go_to_kiosk'
  >('none');
  const [hanaWelcomeNearClaimed, setHanaWelcomeNearClaimed] = useState<boolean>(false);

  // FIRST HOME forced tour (hard gate, rifallah 14 Nov): persisted progress
  // and the on-chain proof captured from each completed purchase step.
  // Tutorial progress is scoped PER WALLET: each wallet is its own player,
  // so First Home and Kai tutorial state live under keys namespaced by the
  // active account ('guest' while signed out). The legacy device-wide keys
  // migrate once into the first wallet scope that loads after this change.
  const tourScopeRef = useRef<string>('');
  const tourKey = (base: string): string =>
    `${base}::${tourScopeRef.current || 'guest'}`;
  const readScopedTourJson = (base: string): Record<string, unknown> | null => {
    try {
      const scopedRaw = window.localStorage.getItem(tourKey(base));
      if (scopedRaw) return JSON.parse(scopedRaw) as Record<string, unknown>;
      const legacyRaw = window.localStorage.getItem(base);
      const migratedFlag = `bb_tour_scope_migrated_v1:${base}`;
      if (legacyRaw && window.localStorage.getItem(migratedFlag) !== '1') {
        window.localStorage.setItem(migratedFlag, '1');
        window.localStorage.setItem(tourKey(base), legacyRaw);
        return JSON.parse(legacyRaw) as Record<string, unknown>;
      }
    } catch {
      // ignore
    }
    return null;
  };

  const [homeTour, setHomeTour] = useState<{
    done: boolean;
    metHana: boolean;
    kioskIntroDone: boolean;
    menusTourDone: boolean;
    txs: Record<string, { txHash: string; explorerUrl: string }>;
  }>(() => {
    try {
      const raw = window.localStorage.getItem('bb_home_tour_v1');
      if (raw) {
        const parsed = JSON.parse(raw) as {
          done?: boolean;
          metHana?: boolean;
          kioskIntroDone?: boolean;
          menusTourDone?: boolean;
          txs?: Record<string, { txHash: string; explorerUrl: string }>;
        };
        return {
          done: Boolean(parsed.done),
          metHana: Boolean(parsed.metHana),
          kioskIntroDone: Boolean(parsed.kioskIntroDone),
          menusTourDone: Boolean(parsed.menusTourDone),
          txs: parsed.txs ?? {},
        };
      }
    } catch {
      // ignore
    }
    return { done: false, metHana: false, kioskIntroDone: false, menusTourDone: false, txs: {} };
  });
  const homeTourRef = useRef<{ active: boolean; step: string }>({ active: false, step: 'done' });
  const persistHomeTour = (next: {
    done: boolean;
    metHana: boolean;
    kioskIntroDone: boolean;
    menusTourDone?: boolean;
    txs: Record<string, { txHash: string; explorerUrl: string }>;
  }) => {
    setHomeTour({ ...next, menusTourDone: Boolean(next.menusTourDone) });
    try {
      window.localStorage.setItem(tourKey('bb_home_tour_v1'), JSON.stringify(next));
    } catch {
      // ignore
    }
  };
  const recordHomeTourTx = (kind: string, txHash?: string, explorerUrl?: string) => {
    if (!txHash) return;
    setHomeTour((prev) => {
      const next = {
        ...prev,
        txs: {
          ...prev.txs,
          [kind]: {
            txHash,
            explorerUrl: explorerUrl || `https://testnet.nearblocks.io/txns/${txHash}`,
          },
        },
      };
      try {
        window.localStorage.setItem(tourKey('bb_home_tour_v1'), JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };
  const [propertyPitchSeen, setPropertyPitchSeen] = useState<boolean>(false);
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
  const [lightingPreset, setLightingPreset] = useState<LightingPresetKey>('day');
  const [cameraFovMode, setCameraFovMode] = useState<'webgl35' | 'ortho18'>('webgl35');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [audioVolumePct, setAudioVolumePct] = useState<number>(100);
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
  const [isInsidePrivateHouse, setIsInsidePrivateHouse] = useState<boolean>(false);
  const [isInsideGlasshouseCafe, setIsInsideGlasshouseCafe] = useState<boolean>(false);
  const [activeCafeModal, setActiveCafeModal] = useState<
    'none' | 'order' | 'atm' | 'rota' | 'order_notification' | 'prep_pastry' | 'prep_drink'
  >('none');
  const [isNearCafeRotaBoard, setIsNearCafeRotaBoard] = useState<boolean>(false);
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
  const [xpCelebrationBanner, setXpCelebrationBanner] = useState<{
    id: number;
    xpGained: number;
    leveledUpTo: number | null;
    label: string;
  } | null>(null);
  const xpBannerTimerRef = useRef<number | null>(null);
  const levelProgress = computeLevelProgress(playerTotalXp);
  const [merchantLocation, setMerchantLocation] = useState<MerchantLocationId>('lobby_cafe');
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
  const [isFastForwardRunning, setIsFastForwardRunning] = useState<boolean>(false);
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
  const [houseArchitectureStyle, setHouseArchitectureStyle] = useState<
    'plaza_manor' | 'japanese_pavilion'
  >('plaza_manor');
  const setAndPersistHouseArchitectureStyle = useCallback(
    (style: 'plaza_manor' | 'japanese_pavilion', accountOverride?: string) => {
      setHouseArchitectureStyle(style);
      if (typeof window === 'undefined') return;
      const acct = (accountOverride || hudRef.current.nearWalletId || playerUid || '')
        .trim()
        .toLowerCase();
      if (!acct) return;
      try {
        window.localStorage.setItem(`bb_house_arch_style_v1:${acct}`, style);
      } catch {
        // ignore storage failures
      }
    },
    [playerUid],
  );
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
  const [fishingBiteSchedule, setFishingBiteSchedule] = useState<ShorelineBiteSchedule | null>(
    null,
  );
  const [fishingHintMessage, setFishingHintMessage] = useState<string | null>(null);
  const [fishingMinigame, setFishingMinigame] = useState<ShorelineMinigameState | null>(null);
  const [isHoldingReel, setIsHoldingReel] = useState<boolean>(false);
  const [lastCaughtFishToast, setLastCaughtFishToast] = useState<CaughtFishItem | null>(null);

  // Fast-Forward Economy Simulation (`09-games` Track: 1.1s per simulated day so judges watch dynamic pricing & bankruptcy live)
  useEffect(() => {
    if (!isFastForwardRunning || activeSpecialModal !== 'npc_merchant') return;
    const timer = window.setInterval(() => {
      setMarketState((prev) => stepFastForwardEconomyTick(prev, prev.dayCounter));
    }, 1100);
    return () => window.clearInterval(timer);
  }, [isFastForwardRunning, activeSpecialModal, merchantLocation]);

  // When Fast-Forward stops, snap the local simulation back to the shared
  // merchant row — FF must never leak its simulated treasury/stock (incl.
  // the forced-broke day) into the state other players trade against.
  const prevFastForwardRef = useRef(false);
  useEffect(() => {
    if (prevFastForwardRef.current && !isFastForwardRunning) {
      void fetchNpcMerchantsFromSupabase().then((rows) => {
        if (rows.length === 0) return;
        const activeRow = rows.find((r) => r.merchant_id === merchantLocation) || rows[0];
        if (!activeRow) return;
        setMarketState((prev) => ({
          ...prev,
          treasuryCyon: activeRow.cyon_treasury,
          isShopBroke: activeRow.is_bankrupt,
          dayCounter: activeRow.simulated_day,
          lastMarketHeadline: activeRow.last_headline || prev.lastMarketHeadline,
          stockByItemId: { ...prev.stockByItemId, ...activeRow.stock_by_item },
          demandByItemId: { ...prev.demandByItemId, ...activeRow.recent_demand_by_item },
        }));
      });
    }
    prevFastForwardRef.current = isFastForwardRunning;
  }, [isFastForwardRunning, merchantLocation]);

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

  useEffect(() => {
    document.body.dataset.state = gameState;
    document.body.dataset.mode = playMode;
  }, [gameState, playMode]);

  const dispatchBuddyAction = useCallback((actionName: string) => {
    window.dispatchEvent(new CustomEvent('buddy-action', { detail: actionName }));
  }, []);

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
    soundEngine.setBgmMode(activeBgmMode);
    soundEngine.setSessionMusicTrack(activeSessionMusicTrack);
  }, [activeBgmMode, activeSessionMusicTrack]);

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
      if (homeTourRef.current.active) return;
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
      if (homeTourRef.current.active && loc === 'beach_house') return;
      setIsKioskModalOpen(false);
      setIsSocialChatModalOpen(false);
      setActiveTeleportKioskModal('none');
      window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
      setMerchantLocation(loc);
      setActiveSpecialModal('npc_merchant');
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
        }>
      ).detail;
      const isSampleEntry = Boolean(
        entryDetail?.team &&
          typeof entryDetail?.commanderIdx === 'number' &&
          isIntactModelEstateBasePlot(entryDetail.team, entryDetail.commanderIdx),
      );
      if (homeTourRef.current.active) {
        const tourStep = homeTourRef.current.step;
        if (isSampleEntry) return;
        if (tourStep !== 'go_home' && tourStep !== 'decor') return;
      }
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
          setIsSampleHouseView(isSampleEntry);
          setActiveSpecialModal('none');
        }, 600);
      }, 700);
    };
    const onExitHouseInterior = () => {
      setIsInsidePrivateHouse(false);
      setIsHouseFriendInviteOpen(false);
      setActiveSpecialModal('none');
    };
    const onEnterGlasshouseCafe = () => {
      if (homeTourRef.current.active) return;
      setIsKioskModalOpen(false);
      setIsSocialChatModalOpen(false);
      setIsPersonalWalletModalOpen(false);
      setIsProfileModalOpen(false);
      setActiveTeleportKioskModal('none');
      window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
      setActiveSpecialModal('none');
      setIsInsidePrivateHouse(false);
      setActiveCafeModal('none');
      setIsInsideGlasshouseCafe(true);
    };
    const onExitGlasshouseCafe = () => {
      setIsInsideGlasshouseCafe(false);
      setActiveCafeModal('none');
      setIsNearCafeRotaBoard(false);
      setIsCafeRotaMenuExpanded(false);
      setCafeShiftState((prev) => ({ ...prev, isWorking: false, activeOrder: null }));
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
    const onOpenCafePrepModal = (e: Event) => {
      const cat = (e as CustomEvent<{ category?: 'pastry' | 'drink' }>).detail?.category;
      setIsCafeRotaMenuExpanded(false);
      setIsCafeOrderSlideBannerVisible(false);
      setActiveCafeModal(cat === 'pastry' ? 'prep_pastry' : 'prep_drink');
    };
    const onCafeRotaProximityChange = (e: Event) => {
      const near = Boolean((e as CustomEvent<{ near?: boolean }>).detail?.near);
      setIsNearCafeRotaBoard(near);
      if (!near) {
        setIsCafeRotaMenuExpanded(false);
      }
    };
    const onToggleCafeRotaDockMenu = () => {
      setIsNearCafeRotaBoard(true);
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
      if (homeTourRef.current.active && homeTourRef.current.step !== 'go_home') return;
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
      const rideDetail = (
        e as CustomEvent<{ destinationStationId?: CityTransitStationId }>
      ).detail;
      if (rideDetail?.destinationStationId === 'kai_fish_market') {
        setHomeTour((prev) => {
          if (!prev.done || prev.kioskIntroDone) return prev;
          const next = { ...prev, kioskIntroDone: true };
          try {
            window.localStorage.setItem(tourKey('bb_home_tour_v1'), JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
      }
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
    window.addEventListener('enter-glasshouse-cafe', onEnterGlasshouseCafe);
    window.addEventListener('exit-glasshouse-cafe', onExitGlasshouseCafe);
    window.addEventListener('open-cafe-order-modal', onOpenCafeOrderModal);
    window.addEventListener('open-cafe-atm-modal', onOpenCafeAtmModal);
    window.addEventListener('open-cafe-prep-modal', onOpenCafePrepModal);
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
    window.addEventListener('city-tram-ride-progress', onCityTramRideProgress);
    window.addEventListener('city-tram-ride-complete', onCityTramRideComplete);
    return () => {
      window.removeEventListener('toggle-kiosk-ui', onToggleKiosk);
      window.removeEventListener('close-kiosk-ui', onCloseKiosk);
      window.removeEventListener('open-npc-merchant-ui', onOpenNpcMerchant);
      window.removeEventListener('open-house-interior-ui', onOpenHouseInterior);
      window.removeEventListener('exit-house-interior-ui', onExitHouseInterior);
      window.removeEventListener('enter-glasshouse-cafe', onEnterGlasshouseCafe);
      window.removeEventListener('exit-glasshouse-cafe', onExitGlasshouseCafe);
      window.removeEventListener('open-cafe-order-modal', onOpenCafeOrderModal);
      window.removeEventListener('open-cafe-atm-modal', onOpenCafeAtmModal);
      window.removeEventListener('open-cafe-prep-modal', onOpenCafePrepModal);
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
      window.removeEventListener('city-tram-ride-progress', onCityTramRideProgress);
      window.removeEventListener('city-tram-ride-complete', onCityTramRideComplete);
    };
  }, []);

  // FIRST HOME tour: the current step is DERIVED from real state every
  // render, so fulfilled steps skip themselves and a reload resumes in place.
  const ownsTourFurniture = ownedMerchantItemIds.some((id) => {
    const item = MERCHANT_CATALOG_ITEMS.find((i) => i.id === id);
    return item?.category === 'nft_collector_furniture';
  });
  const placedTourFurnitureCount = Object.values(placedFurnitureCounts).reduce(
    (acc, n) => acc + n,
    0,
  );
  const homeTourStep:
    | 'connect'
    | 'go_hana'
    | 'claim'
    | 'swap'
    | 'buy_house'
    | 'buy_furniture'
    | 'go_home'
    | 'decor'
    | 'done' = homeTour.done
    ? 'done'
    : !hud.nearWalletId
      ? 'connect'
      : !homeTour.metHana && !hanaWelcomeNearClaimed
        ? 'go_hana'
        : !hanaWelcomeNearClaimed
          ? 'claim'
          : !(respiteBalance >= 100 || hasHouseOwnership)
            ? 'swap'
            : !hasHouseOwnership
              ? 'buy_house'
              : !ownsTourFurniture
                ? 'buy_furniture'
                : placedTourFurnitureCount > 0
                  ? 'done'
                  : isInsidePrivateHouse && !isSampleHouseView
                    ? 'decor'
                    : 'go_home';
  const homeTourActive = !homeTour.done && homeTourStep !== 'done';

  useEffect(() => {
    homeTourRef.current = { active: homeTourActive, step: homeTourStep };
  }, [homeTourActive, homeTourStep]);

  // After FIRST HOME: exiting the house drops the player back in front of
  // Hana (entry position is restored), then a waypoint leads to the transit
  // kiosk beside her until they open it once (city tour bridge).
  const postTourKioskGuideActive =
    homeTour.done &&
    !homeTour.kioskIntroDone &&
    !isInsidePrivateHouse &&
    !isInsideGlasshouseCafe &&
    Boolean(hud.nearWalletId);
  // The city-tour bridge ends the moment the player reaches Kai — the tram
  // arrival is one way (handled by the ride-complete listener), but walking
  // there or arriving via another station must end it too: talking to Kai
  // completes the bridge, so the guide can never drag the player back to
  // Hana after they have already found him.
  useEffect(() => {
    // A leftover welcome-tour kiosk stage also ends when the player reaches
    // Kai — the guided Travel step has done its job by then.
    if (
      tutorialStage === 'go_to_kiosk' &&
      activeSpecialModal === 'npc_merchant' &&
      merchantLocation === 'beach_house'
    ) {
      setTutorialStage('none');
    }
    if (!postTourKioskGuideActive) return;
    if (activeSpecialModal !== 'npc_merchant' || merchantLocation !== 'beach_house') return;
    setHomeTour((prev) => {
      if (!prev.done || prev.kioskIntroDone) return prev;
      const next = { ...prev, kioskIntroDone: true };
      try {
        window.localStorage.setItem(tourKey('bb_home_tour_v1'), JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, [postTourKioskGuideActive, activeSpecialModal, merchantLocation]);

  // Same rule for the bridge's other destination: stepping into the
  // Glasshouse Cafe also completes the city-tour bridge.
  useEffect(() => {
    if (!postTourKioskGuideActive || !isInsideGlasshouseCafe) return;
    setHomeTour((prev) => {
      if (!prev.done || prev.kioskIntroDone) return prev;
      const next = { ...prev, kioskIntroDone: true };
      try {
        window.localStorage.setItem(tourKey('bb_home_tour_v1'), JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, [postTourKioskGuideActive, isInsideGlasshouseCafe]);

  // Connect step: spotlight the WALLET button, dim PROFILE/BAG beside it.
  const tourConnectAttention = homeTourActive && homeTourStep === 'connect';

  useEffect(() => {
    if (homeTourStep === 'done' && !homeTour.done) {
      persistHomeTour({ ...homeTour, done: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeTourStep, homeTour.done]);

  useEffect(() => {
    if (
      activeSpecialModal === 'npc_merchant' &&
      merchantLocation === 'lobby_cafe' &&
      !homeTour.metHana
    ) {
      persistHomeTour({ ...homeTour, metHana: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSpecialModal, merchantLocation, homeTour.metHana]);

  // The tour drives the waypoint while it is active (bold chevron path):
  // Hana for every Hana step, the player's own residence kiosk for go_home.
  useEffect(() => {
    if (!homeTourActive) return;
    if (
      homeTourStep === 'go_hana' ||
      homeTourStep === 'claim' ||
      homeTourStep === 'swap' ||
      homeTourStep === 'buy_house' ||
      homeTourStep === 'buy_furniture'
    ) {
      window.dispatchEvent(
        new CustomEvent('set-tutorial-waypoint', { detail: { target: 'hana' } }),
      );
    } else if (homeTourStep === 'go_home') {
      window.dispatchEvent(
        new CustomEvent('set-tutorial-waypoint', {
          detail: { target: 'hana', color: '#38bdf8' },
        }),
      );
    } else {
      window.dispatchEvent(
        new CustomEvent('set-tutorial-waypoint', { detail: { target: 'none' } }),
      );
    }
  }, [homeTourActive, homeTourStep, hud.playerTeam]);

  useEffect(() => {
    if (!postTourKioskGuideActive) return;
    const fire = () =>
      window.dispatchEvent(
        new CustomEvent('set-tutorial-waypoint', {
          detail: { target: 'coord', x: -86.85, z: -21.85, color: '#38bdf8' },
        }),
      );
    fire();
    const timer = window.setInterval(fire, 5000);
    return () => {
      window.clearInterval(timer);
      window.dispatchEvent(
        new CustomEvent('set-tutorial-waypoint', { detail: { target: 'none' } }),
      );
    };
  }, [postTourKioskGuideActive]);

  const tutorialFurnitureTarget = resolveTutorialFurnitureTarget(
    marketState,
    respiteBalance,
    RESPITE_NEP141_METADATA.rateRespitePerNear,
  );
  const tutorialFurnitureReady =
    !tutorialFurnitureTarget || respiteBalance >= tutorialFurnitureTarget.buyPriceRespite;

  const homeTourGuide: {
    step: string;
    tab: 'sesi_chat' | 'transaksi' | 'katalog';
    katalogTab?: 'house' | 'furniture';
    prefillSwapAmount?: string;
    allowExchangeTab?: boolean;
    line: string;
    walletLabel: string;
  } | null =
    homeTourActive && merchantLocation === 'lobby_cafe'
      ? homeTourStep === 'connect'
        ? {
            step: homeTourStep,
            tab: 'sesi_chat',
            line: "Let's get you connected first. A wallet lets you truly own your home.",
            walletLabel: '',
          }
        : homeTourStep === 'claim'
          ? {
              step: homeTourStep,
              tab: 'sesi_chat',
              line: 'Welcome! Claim your starter pack: 0.30 NEAR + 100 LUL + 20 CYON.',
              walletLabel: hud.nearWalletId || '',
            }
          : homeTourStep === 'swap'
            ? {
                step: homeTourStep,
                tab: 'transaksi',
                prefillSwapAmount: '0.25',
                line: 'Swap 0.25 NEAR into 100 RESPITE. That is your house fund.',
                walletLabel: hud.nearWalletId || '',
              }
            : homeTourStep === 'buy_house'
              ? {
                  step: homeTourStep,
                  tab: 'katalog',
                  katalogTab: 'house',
                  line: "Let's buy your first home!",
                  walletLabel: hud.nearWalletId || '',
                }
              : homeTourStep === 'buy_furniture'
                ? tutorialFurnitureReady
                  ? {
                      step: homeTourStep,
                      tab: 'katalog',
                      katalogTab: 'furniture',
                      allowExchangeTab: true,
                      line:
                        tutorialFurnitureTarget && tutorialFurnitureTarget.item.id !== 'tatami_tea_table'
                          ? `Pick a piece of furniture for your new home. ${tutorialFurnitureTarget.item.name} is ${tutorialFurnitureTarget.buyPriceRespite} RESPITE right now.`
                          : 'Pick a piece of furniture for your new home. The Chabudai tea table is a lovely start.',
                      walletLabel: hud.nearWalletId || '',
                    }
                  : {
                      step: homeTourStep,
                      tab: 'transaksi',
                      prefillSwapAmount: tutorialFurnitureTarget.recommendedTopUpNear.toFixed(2),
                      line: `Swap ${tutorialFurnitureTarget.recommendedTopUpNear.toFixed(2)} NEAR into ${tutorialFurnitureTarget.recommendedTopUpRespite} RESPITE first — ${tutorialFurnitureTarget.item.name} currently costs ${tutorialFurnitureTarget.buyPriceRespite} RESPITE.`,
                      walletLabel: hud.nearWalletId || '',
                    }
                : homeTourStep === 'go_home'
                  ? {
                      step: homeTourStep,
                      tab: 'katalog',
                      katalogTab: 'house',
                      line: 'Your home is ready. Tap GO TO YOUR HOUSE to step right inside!',
                      walletLabel: hud.nearWalletId || '',
                    }
                  : null
      : null;

  const homeTourObjectiveText: Record<string, string> = {
    connect: 'Connect your wallet or Google account. Owning a home needs an account.',
    go_hana: 'Talk to Hana at Central Plaza. She will set you up with a home.',
    claim: "Open Hana's chat and claim your starter pack.",
    swap: "In Hana's EXCHANGE tab, swap 0.25 NEAR into 100 RESPITE.",
    buy_house: "In Hana's CATALOG, buy your first home deed.",
    buy_furniture:
      tutorialFurnitureReady || !tutorialFurnitureTarget
        ? "In Hana's CATALOG, buy one piece of furniture."
        : `In Hana's EXCHANGE tab, swap ${tutorialFurnitureTarget.recommendedTopUpNear.toFixed(2)} NEAR into ${tutorialFurnitureTarget.recommendedTopUpRespite} RESPITE (${tutorialFurnitureTarget.item.name} costs ${tutorialFurnitureTarget.buyPriceRespite} RESPITE).`,
    go_home: "Tap GO TO YOUR HOUSE in Hana's CATALOG to step right inside.",
    decor: 'Place your furniture inside, then press CONFIRM MOVE.',
  };
  const homeTourStepList = [
    'connect',
    'go_hana',
    'claim',
    'swap',
    'buy_house',
    'buy_furniture',
    'go_home',
    'decor',
  ].filter((stepId) => stepId !== 'connect' || !hud.nearWalletId);
  const homeTourStepNumber = Math.max(1, homeTourStepList.indexOf(homeTourStep) + 1);

  useEffect(() => {
    if (homeTourRef.current.active || postTourKioskGuideActive) return;
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
  }, [tutorialStage, postTourKioskGuideActive]);

  // Floating pinpoint over the nearest Teleport Kiosk while a player who owns
  // no property has not met Hana's property pitch yet.
  useEffect(() => {
    const active =
      !homeTourActive &&
      !(hasHouseOwnership || hud.nearHasGamepassNft) &&
      !propertyPitchSeen &&
      tutorialStage === 'none' &&
      activeSpecialModal === 'none' &&
      activeTeleportKioskModal === 'none' &&
      !isInsidePrivateHouse &&
      hud.worldMode !== 'warzone';
    window.dispatchEvent(
      new CustomEvent('set-property-pinpoint', {
        detail: { active },
      }),
    );
  }, [
    homeTourActive,
    hasHouseOwnership,
    hud.nearHasGamepassNft,
    propertyPitchSeen,
    tutorialStage,
    activeSpecialModal,
    activeTeleportKioskModal,
    isInsidePrivateHouse,
    hud.worldMode,
  ]);

  // Kai's local fishing tutorial (Beachfront Harbor):
  // meet -> equip -> to_water -> catch -> sell -> done. Persisted per device.
  type KaiTutorialStage =
    | 'off'
    | 'meet'
    | 'equip'
    | 'to_water'
    | 'catch'
    | 'mint'
    | 'sell'
    | 'done';
  const [kaiTutorialStage, setKaiTutorialStage] = useState<KaiTutorialStage>(() => {
    try {
      const raw = window.localStorage.getItem('bb_kai_tutorial_v1');
      if (raw && (JSON.parse(raw) as { stage?: string }).stage === 'done') return 'done';
    } catch {
      // ignore
    }
    return 'off';
  });
  const [kaiCardDismissed, setKaiCardDismissed] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem('bb_kai_tutorial_v1');
      if (raw) return Boolean((JSON.parse(raw) as { cardDismissed?: boolean }).cardDismissed);
    } catch {
      // ignore
    }
    return false;
  });
  const kaiTutorialStageRef = useRef<KaiTutorialStage>(kaiTutorialStage);

  // Reload tutorial state whenever the active wallet changes: the incoming
  // wallet's own progress replaces whatever the previous wallet had.
  useEffect(() => {
    const scope = hud.nearWalletId ?? 'guest';
    if (tourScopeRef.current === scope) return;
    tourScopeRef.current = scope;
    const home = readScopedTourJson('bb_home_tour_v1');
    setHomeTour({
      done: Boolean(home?.done),
      metHana: Boolean(home?.metHana),
      kioskIntroDone: Boolean(home?.kioskIntroDone),
      menusTourDone: Boolean(home?.menusTourDone),
      txs:
        (home?.txs as Record<string, { txHash: string; explorerUrl: string }>) ?? {},
    });
    const kai = readScopedTourJson('bb_kai_tutorial_v1');
    const stage: KaiTutorialStage = kai?.stage === 'done' ? 'done' : 'off';
    kaiTutorialStageRef.current = stage;
    setKaiTutorialStage(stage);
    setKaiCardDismissed(Boolean(kai?.cardDismissed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hud.nearWalletId]);
  const kaiTutorialAssistRef = useRef<boolean>(false);
  const advanceKaiTutorial = (next: KaiTutorialStage, cardDismissed?: boolean) => {
    kaiTutorialStageRef.current = next;
    setKaiTutorialStage(next);
    if (cardDismissed !== undefined) setKaiCardDismissed(cardDismissed);
    try {
      window.localStorage.setItem(
        tourKey('bb_kai_tutorial_v1'),
        JSON.stringify({
          stage: next,
          cardDismissed: cardDismissed ?? kaiCardDismissed,
        }),
      );
    } catch {
      // ignore
    }
  };

  // Kai's exclamation + pinpoint in the 3D world follow the tutorial stage:
  // the pin floats over Kai (meet/sell) or over the cast point (to_water).
  useEffect(() => {
    const pin =
      kaiTutorialStage === 'meet' || kaiTutorialStage === 'sell'
        ? { x: 85.8, z: 60 }
        : kaiTutorialStage === 'to_water'
          ? { x: 103, z: 60 }
          : null;
    window.dispatchEvent(
      new CustomEvent('set-kai-tutorial', {
        detail: {
          exclamation: ['meet', 'equip', 'to_water', 'catch', 'sell'].includes(
            kaiTutorialStage,
          ),
          pin,
        },
      }),
    );
  }, [kaiTutorialStage]);

  // After the Kai tutorial: Hana still owes the player the other kiosk
  // menus. Until that menus tour is done, an objective card + waypoint lead
  // to the nearest kiosk (Kai's own, right at the Fish Market).
  const menusTourGuideActive =
    kaiTutorialStage === 'done' &&
    homeTour.done &&
    !homeTour.menusTourDone &&
    !isInsidePrivateHouse &&
    !isInsideGlasshouseCafe &&
    Boolean(hud.nearWalletId);

  useEffect(() => {
    if (!menusTourGuideActive) return;
    const fire = () =>
      window.dispatchEvent(
        new CustomEvent('set-tutorial-waypoint', {
          detail: { target: 'coord', x: 84.85, z: 65.65, color: '#38bdf8' },
        }),
      );
    fire();
    const timer = window.setInterval(fire, 5000);
    return () => {
      window.clearInterval(timer);
      window.dispatchEvent(
        new CustomEvent('set-tutorial-waypoint', { detail: { target: 'none' } }),
      );
    };
  }, [menusTourGuideActive]);

  // City Highlights: Hana's discovery checklist, handed over when the kiosk
  // tour ends. Six stops that between them touch every system in the city;
  // each completes from a real in-game event, the card can be dismissed
  // forever, and nothing is ever gated behind it.
  type CityHighlightKey = 'fish' | 'haggle' | 'nft' | 'house' | 'cafe' | 'warzone';
  interface CityHighlightsState {
    active: boolean;
    dismissed: boolean;
    done: Record<CityHighlightKey, boolean>;
  }
  const CITY_HIGHLIGHTS_FRESH: CityHighlightsState = {
    active: false,
    dismissed: false,
    done: { fish: false, haggle: false, nft: false, house: false, cafe: false, warzone: false },
  };
  // City Highlights is hidden for now (rifallah, 14 Nov): the forced First
  // Home tour replaces it as the new-player guide. State, persistence and
  // markCityHighlight calls stay intact - flip this constant to bring it back.
  const CITY_HIGHLIGHTS_ENABLED = false;
  const [cityHighlights, setCityHighlights] = useState<CityHighlightsState>(() => {
    try {
      const raw = window.localStorage.getItem('bb_city_highlights_v1');
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CityHighlightsState>;
        return {
          active: Boolean(parsed.active),
          dismissed: Boolean(parsed.dismissed),
          done: { ...CITY_HIGHLIGHTS_FRESH.done, ...(parsed.done ?? {}) },
        };
      }
      // Players who already finished the tour before this card existed get
      // it right away — the checklist is discovery help, not a reward gate.
      if (window.localStorage.getItem('bb_hana_tour_welcomed_v1')) {
        return { ...CITY_HIGHLIGHTS_FRESH, active: true };
      }
    } catch {
      // ignore
    }
    return CITY_HIGHLIGHTS_FRESH;
  });
  useEffect(() => {
    try {
      window.localStorage.setItem('bb_city_highlights_v1', JSON.stringify(cityHighlights));
    } catch {
      // ignore
    }
  }, [cityHighlights]);
  const markCityHighlight = useCallback((key: CityHighlightKey) => {
    setCityHighlights((prev) =>
      prev.done[key] ? prev : { ...prev, done: { ...prev.done, [key]: true } },
    );
  }, []);
  useEffect(() => {
    if (caughtFishBucket.length > 0) markCityHighlight('fish');
  }, [caughtFishBucket.length, markCityHighlight]);
  useEffect(() => {
    if (hasHouseOwnership) markCityHighlight('house');
  }, [hasHouseOwnership, markCityHighlight]);
  useEffect(() => {
    if (hud.worldMode === 'warzone') markCityHighlight('warzone');
  }, [hud.worldMode, markCityHighlight]);
  const handleHighlightGo = useCallback(
    (key: CityHighlightKey) => {
      soundEngine.playUiClick();
      if (key === 'fish') {
        if (kaiTutorialStage === 'done') {
          window.dispatchEvent(
            new CustomEvent('set-kai-tutorial', {
              detail: { exclamation: true, pin: { x: 85.8, z: 60 } },
            }),
          );
        }
        return;
      }
      if (key === 'haggle' || key === 'nft') {
        window.dispatchEvent(
          new CustomEvent('open-npc-merchant-ui', { detail: { location: 'beach_house' } }),
        );
        return;
      }
      if (key === 'house') {
        if (hasHouseOwnership) {
          window.dispatchEvent(
            new CustomEvent('open-teleport-kiosk-modal', { detail: { kind: 'central_plaza' } }),
          );
        } else {
          window.dispatchEvent(
            new CustomEvent('open-npc-merchant-ui', { detail: { location: 'lobby_cafe' } }),
          );
        }
        return;
      }
      if (key === 'cafe') {
        window.dispatchEvent(new CustomEvent('enter-glasshouse-cafe'));
        return;
      }
      window.dispatchEvent(
        new CustomEvent('open-teleport-kiosk-modal', { detail: { kind: 'central_plaza' } }),
      );
    },
    [kaiTutorialStage, hasHouseOwnership],
  );

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
    setActiveTeleportKioskModal('none');
    window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
    setMerchantLocation('beach_house');
    setActiveSpecialModal('npc_merchant');
  }, []);

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
      if (res.shiftCompleted) markCityHighlight('cafe');
      return res.nextShiftState;
    });
  }, [dispatchBuddyAction, grantPlayerXp]);

  const handlePrepareCafeOrder = useCallback(
    (selectedItem: CafeMenuItemSpec): { ok: boolean; message: string } => {
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
      handleServeActiveCafeOrder();
      setActiveCafeModal('none');
      return { ok: true, message: 'Order prepared' };
    },
    [cafeShiftState.isWorking, cafeShiftState.activeOrder, handleServeActiveCafeOrder],
  );

  const handlePurchaseCafeItem = useCallback(
    (item: CafeMenuItemSpec): { ok: boolean; message: string } => {
      const res = purchaseCafeMenuItem(item.id, hudRef.current.gold);
      if (!res.purchased || !res.item) {
        soundEngine.playHit();
        return {
          ok: false,
          message: `Not enough LUL! Need ${item.priceLul} LUL (work a shift or cash out at the ATM).`,
        };
      }
      soundEngine.playUiConfirm();
      soundEngine.playPickup();
      dispatchBuddyAction(`adjustPlayerLul:${-res.item.priceLul}`);
      setHud((prev) => ({ ...prev, gold: Math.max(0, prev.gold - res.item!.priceLul) }));
      const lulBuyerAccount = hudRef.current.nearWalletId || '';
      if (lulBuyerAccount) {
        void syncPlayerBalancesToSupabase({
          nearAccountId: lulBuyerAccount,
          lulBalance: Math.max(0, hudRef.current.gold - res.item.priceLul),
          cyonBalance,
          respiteBalance,
        });
      }
      grantPlayerXp(res.xpGained, `ORDER ${res.item.name.toUpperCase()}`);
      dispatchBuddyAction(`socialTalk:Enjoying ${res.item.name} (+${res.xpGained} XP!)`);
      return { ok: true, message: `Ordered ${res.item.name}! +${res.xpGained} XP` };
    },
    [dispatchBuddyAction, grantPlayerXp, cyonBalance, respiteBalance],
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
      document.body.dataset.cafeShiftWorking = String(cafeShiftState.isWorking);
    }
  }, [levelProgress.level, levelProgress.totalXp, isInsideGlasshouseCafe, cafeShiftState.isWorking]);

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
    isInsideGlasshouseCafe,
    isInsidePrivateHouse,
    isSampleHouseView,
    cafeShiftState.isWorking,
    cafeShiftState.activeOrder,
    houseArchitectureStyle,
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
      const [accountView, liveRespiteStr, hanaStatus, liveEstate, nep245Counts] =
        await Promise.all([
          fetchNearAccountView(targetAccount, 'optimistic'),
          fetchNep141Balance(NEAR_CONFIG.nep141RespiteContractId, targetAccount, 'optimistic'),
          fetchHanaTreasuryStatus(targetAccount, 'optimistic'),
          fetchBuddiesMarketEstate(targetAccount, 'optimistic').catch(() => null),
          fetchOwnedNep245CatalogCounts(targetAccount, nep245Ids, 'optimistic').catch(() => null),
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
          setRespiteBalance(parsedRespite);
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
        const deedTokenId = liveEstate?.house_deed?.deed_token_id || null;
        if (liveEstate?.owns_house || deedTokenId) {
          setHasHouseOwnership(true);
          if (deedTokenId) {
            setHud((prev) =>
              prev.nearHasGamepassNft && prev.nearGamepassTokenId === deedTokenId
                ? prev
                : { ...prev, nearHasGamepassNft: true, nearGamepassTokenId: deedTokenId },
            );
          }
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
    [playerUid],
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
      ]);
      setHanaWelcomeNearClaimed(Boolean(hanaStatus.callerAlreadyClaimed));
      const hasAuthoritativeOnChainBalance =
        Boolean(accountView) || onChainRespiteRaw !== null || onChainEstate !== null;
      const estateRespite = Number(onChainEstate?.respite_balance || '0') || 0;
      const onChainRespite = Math.max(0, Number(onChainEstate?.respite_balance || '0') || 0, estateRespite, Number(onChainRespiteRaw || '0') || 0);
      if (hasAuthoritativeOnChainBalance) {
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

      let restoredHouseStyle: 'plaza_manor' | 'japanese_pavilion' = 'plaza_manor';
      if (typeof window !== 'undefined') {
        try {
          const savedStyle = window.localStorage.getItem(
            `bb_house_arch_style_v1:${normalizedWallet}`,
          );
          if (savedStyle === 'japanese_pavilion' || savedStyle === 'plaza_manor') {
            restoredHouseStyle = savedStyle;
          }
        } catch {
          // ignore
        }
      }
      setHouseArchitectureStyle(restoredHouseStyle);

      dispatchBuddyAction(
        `nearSyncWalletSession:${normalizedWallet}:${ownsHouseVerified ? '1' : '0'}:${verifiedTokenId || ''}`,
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
        if (!hasAuthoritativeOnChainBalance) {
          setRespiteBalance(remoteProfile.respite_balance);
        } else if (remoteProfile.respite_balance !== onChainRespite) {
          void syncPlayerBalancesToSupabase({
            nearAccountId: normalizedWallet,
            lulBalance: remoteProfile.lul_balance,
            cyonBalance: remoteProfile.cyon_balance,
            respiteBalance: onChainRespite,
          });
        }
        setOwnedMerchantItemIds(reconciledOwnedIds);
      } else if (onChainNep245Counts) {
        setOwnedMerchantItemIds(reconciledOwnedIds);
      }

      if (entryDecision.isReturningUser) {
        persistWalletProfileLocally(normalizedWallet, finalName, finalGender, resolvedEmail);
        // First entry on this device gets Hana's guided intro, once.
        try {
          if (!window.localStorage.getItem('bb_hana_tour_welcomed_v1')) {
            window.localStorage.setItem('bb_hana_tour_welcomed_v1', '1');
            setTutorialStage('welcome_modal');
          }
        } catch {
          // ignore
        }
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
      dispatchBuddyAction,
      persistWalletProfileLocally,
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
        unlockedSkins: ['default', `gender:${characterGender}`],
      });
      setOnboardingLoadingProgress(10);
      setOnboardingStep('entering_lobby');
      return;
    }

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
    connectedExternalWalletId,
    connectedGoogleEmail,
    cyonBalance,
    dispatchBuddyAction,
    onboardingAuthMode,
    persistWalletProfileLocally,
    playerDisplayName,
    respiteBalance,
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
    pendingPostClaimFloorRef.current = null;
    setOnboardingLoadingProgress(85);
    setSubWalletProvisionStageLabel('Loading Central Plaza...');
    setProvisionedSubWalletTxHash(provisioned.txHash || '');

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
          unlockedSkins: ['default', `gender:${characterGender}`],
        });
      }
    });

    setOnboardingLoadingProgress(100);
    soundEngine.playPickup();
    setOnboardingStep('completed');
    setGameState('playing');
    try {
      window.localStorage.setItem('bb_hana_tour_welcomed_v1', '1');
    } catch {
      // ignore
    }
    setTutorialStage('welcome_modal');
  }, [
    characterGender,
    connectedGoogleEmail,
    dispatchBuddyAction,
    persistWalletProfileLocally,
    playerDisplayName,
    refreshOnChainBalances,
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
          /already claimed|Invalid Hana claim attestation/i.test(attestedRes.error)
        ) {
          return attestedRes;
        }
      } else if (att.code === 'ALREADY_CLAIMED' || att.code === 'EMAIL_NOT_BOUND') {
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
    recordHomeTourTx('claim', claimRes.txHash, claimRes.explorerUrl);
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
      reasoning_summary: `Claimed +0.30 NEAR starter grant from Hana Smart Contract Treasury (${NEAR_CONFIG.marketContractId}).`,
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
      // Guests join Hana's guided intro too, once per device.
      try {
        if (!window.localStorage.getItem('bb_hana_tour_welcomed_v1')) {
          window.localStorage.setItem('bb_hana_tour_welcomed_v1', '1');
          setTutorialStage('welcome_modal');
        }
      } catch {
        // ignore
      }
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

  const prevBucketLenRef = useRef<number>(caughtFishBucket.length);

  // Kai tutorial: arm the meeting when the player first comes near Kai.
  useEffect(() => {
    if (kaiTutorialStage !== 'off') return;
    if (onboardingStep !== 'completed' || gameState !== 'playing') return;
    if (hud.worldMode === 'warzone' || !playerRadarDot) return;
    const distToKai = Math.hypot(playerRadarDot.x - 85.8, playerRadarDot.z - 60);
    if (distToKai > 42) return;
    advanceKaiTutorial(
      caughtFishBucket.some((f) => f.isMintedNft)
        ? 'sell'
        : caughtFishBucket.length > 0
          ? 'mint'
          : 'meet',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    kaiTutorialStage,
    onboardingStep,
    gameState,
    hud.worldMode,
    playerRadarDot,
    caughtFishBucket.length,
  ]);

  // Kai tutorial: advance steps from live game state.
  useEffect(() => {
    kaiTutorialAssistRef.current =
      kaiTutorialStage === 'to_water' || kaiTutorialStage === 'catch';
    if (kaiTutorialStage === 'equip' && hud.equippedWeapon === 'Joran Fishing') {
      advanceKaiTutorial('to_water');
    } else if (
      kaiTutorialStage === 'to_water' &&
      nearbyWaterZone.canFish &&
      nearbyWaterZone.zoneId === 'east_beach'
    ) {
      advanceKaiTutorial('catch');
    } else if (
      kaiTutorialStage === 'catch' &&
      caughtFishBucket.length > prevBucketLenRef.current
    ) {
      advanceKaiTutorial('mint');
    } else if (
      kaiTutorialStage === 'mint' &&
      caughtFishBucket.some((f) => f.isMintedNft)
    ) {
      advanceKaiTutorial('sell');
    }
    prevBucketLenRef.current = caughtFishBucket.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kaiTutorialStage, hud.equippedWeapon, nearbyWaterZone, caughtFishBucket.length]);

  // Kai phone: opening Kai's merchant chat (in person or by phone) counts as
  // having met him, and silences any ringing call.
  useEffect(() => {
    if (
      activeSpecialModal === 'npc_merchant' &&
      merchantLocation === 'beach_house' &&
      !kaiPhoneState.met
    ) {
      persistKaiPhoneState({ ...kaiPhoneState, met: true });
      setKaiIncomingCall(false);
      soundEngine.stopPhoneRing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSpecialModal, merchantLocation, kaiPhoneState.met]);

  // Kai phone: once the player first has a fish to sell, Kai calls — once per
  // device, and only when no other UI is in the way.
  useEffect(() => {
    if (kaiPhoneState.called || kaiPhoneState.met || kaiIncomingCall) return;
    if (gameState !== 'playing' || onboardingStep !== 'completed') return;
    if (hud.worldMode === 'warzone') return;
    if (caughtFishBucket.length === 0) return;
    if (activeSpecialModal !== 'none' || isSocialChatModalOpen || isKioskModalOpen) return;
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
  }, [fishingPhase, fishingMinigame, lightingPreset, nep171Ledger.ownerNearAccount]);

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
      let schedule = createShorelineBiteSchedule({
        waterZone: activeZone,
        lightingPreset,
        castPower: clampedPower,
      });
      if (kaiTutorialAssistRef.current) {
        // Tutorial catch assist: the first lesson fish bites fast, is a
        // common species, and gives a generous strike window.
        const commonSpecies = FISH_SPECIES_CATALOG.find(
          (s) => s.waterZone === activeZone && s.rarity === 'Common',
        );
        schedule = {
          ...schedule,
          initialWaitSec: Math.min(schedule.initialWaitSec, 1.2),
          nibbleIntervalSec: Math.min(schedule.nibbleIntervalSec, 0.9),
          nibblesTotal: Math.min(schedule.nibblesTotal, 1),
          strikeWindowSec: Math.max(schedule.strikeWindowSec, 6),
          ...(commonSpecies ? { species: commonSpecies } : {}),
        };
      }
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
          reasoning_summary: `Sold ${fish.speciesName} (${fish.weightKg} kg, ${fish.rarity}) directly to Merchant Kai for +${earnedLul} LUL (convertible to CYON at Exchange).`,
        });
      }
      if (kaiTutorialStageRef.current === 'sell') {
        advanceKaiTutorial('done');
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
      markCityHighlight('nft');
      if (kaiTutorialStageRef.current === 'sell') {
        advanceKaiTutorial('done');
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
          reasoning_summary: `Sold ${fish.speciesName} (${fish.weightKg} kg, ${fish.rarity}) to Merchant Kai for +${earnedLul} LUL — price negotiated in chat (standard formula ${standardLul} LUL), paid from Kai's treasury pool under the daily discipline caps.${quickDealBonusLul(standardLul, roundsUsed) > 0 ? ' Includes the quick-deal bonus for accepting the first offer.' : ''}`,
        });
      }
      markCityHighlight('haggle');
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
          reasoning_summary: `Minted ${fish.speciesName} (${fish.weightKg} kg, ${fish.rarity}) into NEP-171 Fish NFT ${nftTokenId}.`,
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

  const currentPresetConfig = LIGHTING_PRESETS[lightingPreset];
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
          backgroundColor: currentPresetConfig.viewportFilterColor,
          opacity: currentPresetConfig.viewportFilterOpacity,
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
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleToggleAudio();
                }}
                aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
                className="-skew-x-6 w-10 h-10 flex items-center justify-center bg-[#14161d] hover:bg-[#1f2430] text-white border-3 border-black ring-2 ring-white shadow-[3px_3px_0_#000] cursor-pointer active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
              >
                <span className="skew-x-6 flex items-center justify-center">
                  {isMuted ? (
                    <VolumeX className="w-4 h-4 text-slate-300" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-[#b8ff3c]" />
                  )}
                </span>
              </button>

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
                        {onboardingAuthMode === 'wallet' && !connectedExternalWalletId ? 'NEXT' : 'PLAY'}
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
                  <div className="-skew-x-12 px-4 py-1.5 bg-[#38bdf8] text-black border-2 border-black shadow-[3px_3px_0_#000] font-black text-xs tracking-widest uppercase">
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
            className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/75 pointer-events-auto select-none"
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
                  {hud.nearWalletConnected
                    ? 'Visit Hana \u2014 your property agent & city guide at Central Plaza \u2014 to claim your 0.30 NEAR welcome bonus.'
                    : 'Meet Hana \u2014 your property agent & city guide at Central Plaza. She will show you around the city. You are in Guest Mode, so trading unlocks after you sign in.'}
                </p>
              </div>

              {hud.nearWalletConnected && (
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
              )}

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
        !homeTourActive &&
        (tutorialStage === 'go_to_hana' || tutorialStage === 'go_to_kiosk') &&
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
                    ? 'Talk to Hana, your city guide at Central Plaza, to claim 0.30 NEAR.'
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

      {isPreloadComplete &&
        onboardingStep === 'completed' &&
        homeTourActive &&
        activeSpecialModal === 'none' &&
        activeTeleportKioskModal === 'none' &&
        !isInsideGlasshouseCafe &&
        (!isInsidePrivateHouse || homeTourStep === 'decor') &&
        !tramRideCutsceneUi?.active && (
          <div
            data-home-tour-objective="true"
            className="fixed top-14 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-md pointer-events-none select-none"
          >
            <div className="bg-[#0f172a]/95 text-white border-[3px] border-black shadow-[5px_5px_0_#000] px-3.5 py-2 flex items-center gap-3">
              <span className="px-2 py-0.5 border border-black text-[9.5px] font-black uppercase shrink-0 bg-[#b8ff3c] text-black">
                FIRST HOME {homeTourStepNumber}/{homeTourStepList.length}
              </span>
              <span className="text-[11px] font-bold text-slate-100">
                {homeTourObjectiveText[homeTourStep]}
              </span>
            </div>
          </div>
        )}

        {postTourKioskGuideActive &&
          activeSpecialModal === 'none' &&
          !isKioskModalOpen &&
          !isSocialChatModalOpen && (
            <div
              data-city-tour-kiosk-card="true"
              className="fixed top-14 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-md pointer-events-none select-none"
            >
              <div className="bg-[#0f172a]/95 text-white border-[3px] border-black shadow-[5px_5px_0_#000] px-3.5 py-2 flex items-center gap-3">
                <span className="px-2 py-0.5 border border-black text-[9.5px] font-black uppercase shrink-0 bg-[#38bdf8] text-black">
                  CITY TOUR
                </span>
                <span className="text-[11px] font-bold text-slate-100">
                  First Home complete! Head to the transit kiosk beside Hana and press E —
                  Kai's fish market and the Cafe are waiting.
                </span>
              </div>
            </div>
          )}

        {menusTourGuideActive &&
          activeSpecialModal === 'none' &&
          !isKioskModalOpen &&
          !isSocialChatModalOpen && (
            <div
              data-menus-tour-card="true"
              className="fixed top-14 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-md pointer-events-none select-none"
            >
              <div className="bg-[#0f172a]/95 text-white border-[3px] border-black shadow-[5px_5px_0_#000] px-3.5 py-2 flex items-center gap-3">
                <span className="px-2 py-0.5 border border-black text-[9.5px] font-black uppercase shrink-0 bg-[#38bdf8] text-black">
                  CITY TOUR
                </span>
                <span className="text-[11px] font-bold text-slate-100">
                  Kai's lessons complete! Open the transit kiosk here at the Fish Market —
                  Hana will walk you through the other menus.
                </span>
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
      {onboardingStep === 'completed' &&
        tutorialStage === 'none' &&
        activeSpecialModal === 'none' &&
        activeTeleportKioskModal === 'none' &&
        (kaiTutorialStage === 'meet' ||
          kaiTutorialStage === 'equip' ||
          kaiTutorialStage === 'to_water' ||
          kaiTutorialStage === 'catch' ||
          kaiTutorialStage === 'mint' ||
          kaiTutorialStage === 'sell') && (
          <div
            data-kai-tutorial-objective="true"
            className="fixed top-14 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-md pointer-events-auto select-none"
          >
            <div className="bg-[#0f172a]/95 text-white border-[3px] border-black shadow-[5px_5px_0_#000] px-3.5 py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2 py-0.5 border border-black text-[9.5px] font-black uppercase shrink-0 bg-[#38bdf8] text-black">
                  KAI
                </span>
                <span className="text-[11px] font-bold text-slate-100 truncate">
                  {kaiTutorialStage === 'meet'
                    ? 'Meet Kai at the Fish Market \u2014 follow the marker.'
                    : kaiTutorialStage === 'equip'
                      ? 'Equip your Fishing Rod.'
                      : kaiTutorialStage === 'to_water'
                        ? 'Stand by the water east of Kai.'
                        : kaiTutorialStage === 'catch'
                          ? 'Hold [F] to cast \u2014 wait for the plunge, then reel it in!'
                          : kaiTutorialStage === 'mint'
                            ? 'Open your BAG \u2192 FISH tab \u2192 MINT your catch into an NFT.'
                            : 'Take your fish NFT back to Kai \u2014 he pays RESPITE for NFTs.'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {kaiTutorialStage === 'equip' &&
                  hud.equippedWeapon !== 'Joran Fishing' && (
                    <button
                      type="button"
                      data-kai-equip-rod-btn="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        ensureFishingRodEquipped();
                      }}
                      className="px-2 py-1 bg-[#b8ff3c] hover:bg-[#d9f99d] border border-black text-[9.5px] font-black uppercase text-black cursor-pointer"
                    >
                      EQUIP ROD
                    </button>
                  )}
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    advanceKaiTutorial('done');
                  }}
                  className="px-2 py-1 bg-white/10 hover:bg-white/20 border border-white/30 text-[9.5px] font-black uppercase text-slate-300 cursor-pointer"
                >
                  SKIP
                </button>
              </div>
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
        onboardingStep === 'completed' &&
        tutorialStage !== 'welcome_modal' &&
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

            {/* Compact 1:1 Calibrated Radar (Hidden inside Lobby room, Private House & Glasshouse Cafe interior) */}
            {!isInsidePrivateHouse &&
              !isInsideGlasshouseCafe &&
              activeSpecialModal !== 'npc_merchant' &&
              !isSocialChatModalOpen &&
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
                  <span className="absolute top-1 left-1 z-40 px-1 py-px bg-black/60 border border-white/40 rounded-sm text-[7px] font-black tracking-widest text-white pointer-events-none">
                    {worldMode === 'warzone' ? 'WARZONE' : 'CITY MAP'}
                  </span>
                  {worldMode === 'warzone' ? (
                    <img
                      src="/assets/kiosk/radar_arena_map.png"
                      alt="Arena Radar Map"
                      draggable={false}
                      className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 select-none pointer-events-none"
                      style={{
                        backgroundColor: '#a5dcf5',
                        backgroundImage:
                          'linear-gradient(rgba(255,255,255,0.45) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.45) 1px, transparent 1px)',
                        backgroundSize: '12.5% 12.5%',
                      }}
                    />
                  )}

                  {/* Dynamic Building Indicators for All Active Commander Base Plots (Model Estate Plot 0 + Any Claimed NEAR Session Base) */}
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

                  {/* Lobby Faction Portals (North Red & South Blue) + Halte Trem Return Pad + 4 Public Warzone Crate Pads */}
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
                        style={{ left: `${tramShelterPos.leftPct}%`, top: `${tramShelterPos.topPct}%` }}
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

                  {/* CITY MAP landmarks - city mode only (warzone uses the radar overlays above) */}
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
                      {[
                        { id: 'hana', label: 'HANA', x: -91.3, z: -24.26, cls: 'bg-[#b8ff3c]', side: 'right' },
                        { id: 'cafe', label: 'CAFE', x: -88.3, z: 22.35, cls: 'bg-[#fb923c]', side: 'right' },
                        { id: 'kai', label: 'KAI', x: 85.8, z: 60.0, cls: 'bg-[#facc15]', side: 'left' },
                        { id: 'park', label: 'PARK', x: 101.0, z: -61.0, cls: 'bg-[#c084fc]', side: 'left' },
                      ].map((poi) => {
                        const pos = worldCoordToRadarPercent(poi.x, poi.z);
                        return (
                          <span
                            key={`city-poi-${poi.id}`}
                            data-radar-city-poi={poi.id}
                            style={{ left: `${pos.leftPct}%`, top: `${pos.topPct}%` }}
                            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20"
                          >
                            <span className={`block w-2 h-2 rounded-full border border-[#1a1a1a] ${poi.cls}`} />
                            <span
                              className={`absolute top-1/2 -translate-y-1/2 text-[7px] font-black tracking-wide text-[#1a1a1a] [text-shadow:0_1px_2px_#fff,0_0_3px_#fff] ${
                                poi.side === 'left' ? 'right-[7px]' : 'left-[7px]'
                              }`}
                            >
                              {poi.label}
                            </span>
                          </span>
                        );
                      })}
                    </>
                  )}

                  {/* Always-On 100% Bright Minimap Radar (No Fog-of-War Mask) */}

                  {/* Live Scanned Radar Dots (No Crates! Differentiated Small Pedestrian vs Large Heavy Vehicle Blinking Red Dots) */}
                  {hud.radarDots.map((dot) => {
                    const { leftPct, topPct } = worldCoordToRadarPercent(dot.x, dot.z);
  if (dot.kind === 'supply_drop') {
                      // Supply Drop Beacon Signal (Central Oasis / Harbor Dock)
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
                      // Enemy Heavy Vehicle (Tank, Heavy Truck, Aircraft): LARGE PROMINENT RED CIRCLE DOT
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
                      // Enemy Infantry / Pedestrian Attacker: SMALL RED DOT
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
                    className={`-skew-x-12 px-2.5 h-9 flex items-center justify-center gap-1.5 font-black text-xs bg-[#38bdf8] hover:bg-[#7dd3fc] text-[#1a1a1a] border-3 border-[#1a1a1a] ring-2 ring-white shadow-[3px_3px_0_#1a1a1a] transition-transform hover:scale-105 active:scale-95 cursor-pointer${tourConnectAttention ? ' opacity-40 saturate-50' : ''}`}
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
                    } text-[#1a1a1a] border-3 border-[#1a1a1a] ring-2 ring-white shadow-[3px_3px_0_#1a1a1a] transition-transform hover:scale-105 active:scale-95 cursor-pointer${tourConnectAttention ? ' opacity-40 saturate-50' : ''}`}
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
                    className={`-skew-x-12 px-2.5 h-9 flex items-center justify-center gap-1.5 font-black text-xs bg-[#facc15] hover:bg-[#fde047] text-[#1a1a1a] border-3 border-[#1a1a1a] ring-2 ring-white shadow-[3px_3px_0_#1a1a1a] transition-transform hover:scale-105 active:scale-95 cursor-pointer${tourConnectAttention ? ' bb-attention-wiggle ring-4 ring-[#38bdf8] brightness-110' : ''}`}
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
            <div className="fixed bottom-3 left-4 z-30 w-[calc(100vw-2rem)] max-w-lg pointer-events-auto flex flex-col items-end">
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
                      // Talking to an NPC (Hana/Kai modal open): the bottom bar
                      // routes ONLY into the NPC session. It must never fall
                      // through to the public world feed.
                      window.dispatchEvent(
                        new CustomEvent('npc-merchant-user-chat', {
                          detail: { text: trimmed },
                        }),
                      );
                      setSocialChatText('');
                      return;
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
                className="w-full flex items-center gap-1.5 bg-[#14161d]/95 border-3 border-[#1a1a1a] ring-2 ring-white shadow-[4px_4px_0_#1a1a1a] px-2.5 py-1.5 rounded-lg"
              >
                <input
                  type="text"
                  data-social-chat-input="true"
                  maxLength={64}
                  value={socialChatText}
                  onChange={(e) => setSocialChatText(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Type a short message..."
                  className="flex-1 min-w-0 px-2.5 py-1 bg-white text-[#14161d] font-bold text-xs rounded border-2 border-[#14161d] focus:outline-none focus:ring-2 focus:ring-[#10b981]"
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
                        {unreadPrivateCount > 0 && (
                          <span
                            data-chat-unread-private-badge="true"
                            className="px-1.5 py-0.2 bg-[#ff3b30] text-white border border-black text-[9px] font-black leading-tight"
                          >
                            {unreadPrivateCount}
                          </span>
                        )}
                      </>
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
        kaiTutorialStage={kaiTutorialStage === 'off' ? null : kaiTutorialStage}
        kaiCardDismissed={kaiCardDismissed}
        onKaiTutorialStart={() => {
          soundEngine.playUiClick();
          setActiveSpecialModal('none');
          advanceKaiTutorial('equip');
        }}
        onKaiTutorialLater={() => {
          soundEngine.playUiClick();
          advanceKaiTutorial(kaiTutorialStage, true);
        }}
        hanaPitchOrigin={hanaPitchOrigin}
        houseArchitectureStyle={houseArchitectureStyle}
        onSelectHouseArchitectureStyle={(style) => {
          setAndPersistHouseArchitectureStyle(style);
        }}
        onViewModelHouse={(requestedStyle) => {
          soundEngine.playUiClick();
          const targetStyle = requestedStyle ?? 'plaza_manor';
          setHouseArchitectureStyle(targetStyle);
          setActiveSpecialModal('none');
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
        }}
        onEnterOwnHouse={(requestedStyle) => {
          soundEngine.playUiClick();
          const targetStyle = requestedStyle ?? houseArchitectureStyle;
          setAndPersistHouseArchitectureStyle(targetStyle);
          setActiveSpecialModal('none');
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
        isTutorialHanaActive={tutorialStage === 'go_to_hana'}
        hanaWelcomeNearClaimed={hanaWelcomeNearClaimed}
        onClaimHanaWelcomeNear={handleClaimHanaWelcomeNear}
        homeTourGuide={homeTourGuide}
        homeTourTxs={homeTour.txs}
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
          recordHomeTourTx('house', res.txHash);
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
                deedTokenId,
                priceAmount: priceRespite,
                priceCurrency: 'RESPITE',
                settlementContract: NEAR_CONFIG.marketContractId,
              },
              txHash: res.txHash,
            });
          }
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
        propertyListings={propertyListings}
        busyPropertyListingId={busyPropertyListingId}
        onCreatePropertyListing={async ({ assetKind, assetId, priceRespite }) => {
          const seller = hud.nearWalletId || '';
          if (!seller) return false;
          const price = Math.floor(Number(priceRespite) || 0);
          if (price < 1 || price > 100000) return false;
          if (assetKind === 'house') {
            const estate = await fetchBuddiesMarketEstate(seller).catch(() => null);
            const deedId = estate?.house_deed?.deed_token_id || '';
            if (!deedId) return false;
            // The deed NFT itself moves into contract escrow.
            const res = await executeMarketContractCallOnChain({
              signerAccountId: seller,
              methodName: 'list_property_deed',
              args: { token_id: deedId, price_respite: String(price) },
            });
            if (!res.ok) return false;
            setHasHouseOwnership(false);
          } else {
            const item = MERCHANT_CATALOG_ITEMS.find((i) => i.id === assetId);
            if (!item?.tokenId) return false;
            // One copy moves into contract escrow, out of the seller's bag.
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
        }}
        onCancelPropertyListing={async (listingId) => {
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
            } else {
              setOwnedMerchantItemIds((prev) => [...prev, listing.asset_id]);
            }
            await refreshPropertyListings();
          } finally {
            setBusyPropertyListingId(null);
          }
        }}
        onBuyPropertyListing={async (listing) => {
          const buyer = hud.nearWalletId || '';
          if (!buyer || listing.status !== 'active') return false;
          if (listing.seller_account.toLowerCase() === buyer.toLowerCase()) return false;
          setBusyPropertyListingId(listing.id);
          try {
            // Escrow settlement (contract v1.3.0): ONE on-chain call moves
            // the RESPITE to the seller and the escrowed asset to the
            // buyer. There is no claim step and no delivery step — a failed
            // call reverts both legs together.
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
        }}
        onCompletePropertyTransfer={async () => {
          // Escrow listings settle atomically inside buy_property — there
          // is no seller delivery step anymore. This callback remains only
          // for the modal's legacy 'paid' rows, which the contract board
          // never produces.
          return false;
        }}
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
          // Guests cannot claim the welcome NEAR, so meeting Hana completes
          // the beat: point them onward to the Transit Kiosk tour.
          if (tutorialStage === 'go_to_hana' && !hud.nearWalletConnected) {
            setTutorialStage('go_to_kiosk');
          }
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
        onBuyMerchantItem={async (item: MerchantCatalogItem, finalPrice: number): Promise<{ ok: boolean; txHash?: string; explorerUrl?: string }> => {
          soundEngine.playUiClick();
          // No house, no furniture: a deed comes first, otherwise bought
          // furniture has nowhere to go and confuses new players.
          if (
            item.category === 'nft_collector_furniture' &&
            !hasHouseOwnership &&
            !hud.nearHasGamepassNft
          ) {
            return { ok: false };
          }
          // Furniture is owned per copy (one copy per house placement), so
          // it can be bought again while stock lasts; themes and gear are
          // unique and block a second purchase.
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
            // RESPITE catalog items are real NEP-245 stock held by the
            // merchant on-chain: the purchase itself settles on-chain
            // (RESPITE buyer -> merchant, item merchant stock -> buyer bag).
            // Local balances and ownership only move after the tx succeeds.
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
          recordHomeTourTx('furniture', onChainBuyReceipt.txHash, onChainBuyReceipt.explorerUrl);
          return { ok: true, ...onChainBuyReceipt };
        }}
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
          recordHomeTourTx(
            direction === 'near_to_respite' && inputAmount >= 0.2 ? 'swap' : 'swap_small',
            receipt.txHash,
          );
          const resolvedActor = receipt.accountId || hudRef.current.nearWalletId || actorAccount;
          pendingPostClaimFloorRef.current = null;

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
          setPropertyPitchSeen(true);
          setHanaPitchOrigin('browse');
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
          if (kaiTutorialStage === 'off') advanceKaiTutorial('meet');
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
        isMenusTourActive={
          kaiTutorialStage === 'done' && homeTour.done && !homeTour.menusTourDone
        }

        guideDestinationId={
          homeTour.done && !homeTour.kioskIntroDone
            ? 'kai_fish_market'
            : tutorialStage === 'go_to_kiosk'
              ? 'kai_fish_market'
              : kaiTutorialStage === 'meet' || kaiTutorialStage === 'sell'
                ? 'kai_fish_market'
                : null
        }
        onCompleteTutorialTour={() => {
          if (tutorialStage !== 'go_to_kiosk' && kaiTutorialStage === 'done' && homeTour.done) {
            // Menus tour finished (or skipped): Hana has explained the rest.
            persistHomeTour({ ...homeTour, menusTourDone: true });
            return;
          }
          setTutorialStage('none');
          setCityHighlights((prev) => ({ ...prev, active: true }));
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
          if (homeTourRef.current.active) {
            const isResidenceDest =
              destination.id === 'north_residence' || destination.id === 'south_residence';
            if (homeTourRef.current.step !== 'go_home' || !isResidenceDest) {
              soundEngine.playHit();
              return;
            }
          }
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
          setPendingPitchKioskStation(
            activeTeleportKioskModal !== 'none' ? activeTeleportKioskModal : 'central_plaza',
          );
          setPropertyPitchSeen(true);
          setActiveTeleportKioskModal('none');
          window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
          setIsKioskModalOpen(false);
          setIsSocialChatModalOpen(false);
          setMerchantLocation('lobby_cafe');
          setActiveSpecialModal('npc_merchant');
          setHanaPitchOrigin('kiosk');
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
              const houseDisplay = getHouseStyleDisplaySpec(houseArchitectureStyle);
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
                      data-wallet-house-card={houseArchitectureStyle}
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
                            {onChainDeedLedger?.sub_account_id || nep171Ledger.subAccountId}
                          </span>
                          <span className="px-1.5 py-0.5 bg-[#1e293b] border border-white/20 text-[8.5px] font-mono font-bold text-[#b8ff3c] shrink-0">
                            EPOCH #{onChainDeedLedger?.key_epoch ?? (nep171Ledger.ownershipHistory.length + 1)}
                          </span>
                        </div>

                        {onChainDeedLedger ? (
                          <>
                            <div className="grid grid-cols-3 gap-1 text-[8.5px] font-mono">
                              <div className="p-1 bg-[#1e293b] border border-white/10">
                                <div className="text-slate-400">PENDING</div>
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
                                <div className="text-slate-400">PAID OUT</div>
                                <div className="text-[#38bdf8] font-bold">
                                  {onChainDeedLedger.total_paid_out_respite} R
                                </div>
                              </div>
                            </div>

                            <div className="text-[8.5px] font-mono text-slate-300 space-y-0.5 max-h-16 overflow-y-auto">
                              {onChainDeedLedger.ownership_history.length === 0 ? (
                                <div>Provenance: Genesis holder · 0 transfers</div>
                              ) : (
                                onChainDeedLedger.ownership_history.slice(-3).map((rec, idx) => (
                                  <div key={`${rec.new_key_epoch}-${idx}`} className="truncate">
                                    Epoch #{rec.new_key_epoch}: {rec.from_owner} -&gt; {rec.to_owner} ({rec.transferred_treasury_respite} R)
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
                                      reasoning_summary: `Deposited +5 RESPITE royalty into ${onChainDeedLedger.sub_account_id}`,
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
                                {isDeedLedgerTxBusy ? 'WAIT...' : 'FUND +5 R'}
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
                                      reasoning_summary: `Claimed ${payoutAmt} RESPITE from ${onChainDeedLedger.sub_account_id} (Epoch #${onChainDeedLedger.key_epoch})`,
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
                                CLAIM PAYOUT
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
              const bagOwnedCounts = countOwnedMerchantItems(ownedMerchantItemIds);
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

{selectedTargetUser.isNpc && (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setIsTargetMenuExpanded(false);
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
                    }}
                    className="-skew-x-6 w-40 py-1.5 px-3 bg-[#facc15] hover:bg-[#fde047] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-black font-black uppercase text-xs tracking-wider cursor-pointer"
                  >
                    <div className="skew-x-6 flex items-center justify-center gap-2 w-full">
                      <MessageSquare className="w-3.5 h-3.5 text-black stroke-[2.5] shrink-0" aria-hidden="true" />
                      <span>Talk</span>
                    </div>
                  </button>
                )}

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

          {/* Unified Game-Style Comic-Arcade Bottom Bar (Aligned at bottom-3 level with chat input) */}
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
            className="-skew-x-10 inline-flex items-center h-10 min-w-[224px] bg-[#14161d] border-3 border-[#14161d] ring-2 ring-white shadow-[4px_4px_0_#14161d] px-2 text-white cursor-pointer hover:brightness-110 active:scale-95 transition-transform select-none"
          >
            <div className="skew-x-10 flex items-center gap-2.5 w-full">
              {/* Avatar Tile */}
              <div className="w-7 h-7 bg-[#38bdf8] border-2 border-[#0b0d13] shadow-[2px_2px_0_#0b0d13] flex items-center justify-center overflow-hidden shrink-0 text-xs font-black text-[#0f172a]">
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
              <span className="flex-1 text-center font-black text-xs text-white tracking-wider px-1 uppercase truncate">
                {selectedTargetUser.name.replace(/\s*\((ANDA|YOU)\)/i, '')}
              </span>

              {/* Cycle Target Chevron Badge */}
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
                className="px-1.5 py-0.5 bg-[#facc15] hover:bg-[#fde047] text-[#0f172a] border-2 border-[#0b0d13] shadow-[2px_2px_0_#0b0d13] flex items-center justify-center font-black text-xs shrink-0 cursor-pointer"
              >
                &gt;
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* =====================================================================
          10. AVAKIN-STYLE MMORPG CHARACTER PROFILE MODAL
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
          onboardingStep === 'completed' &&
          tutorialStage !== 'welcome_modal' &&
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

      {/* CITY HIGHLIGHTS — Hana's post-tour discovery checklist */}
      {CITY_HIGHLIGHTS_ENABLED &&
        cityHighlights.active &&
        !cityHighlights.dismissed &&
        gameState === 'playing' &&
        activeSpecialModal === 'none' &&
        !isInsidePrivateHouse &&
        !isInsideGlasshouseCafe &&
        (() => {
          const stops: {
            key: CityHighlightKey;
            title: string;
            hint: string;
          }[] = [
            { key: 'fish', title: 'Catch your first fish', hint: 'Meet Kai at East Beach — follow the pin, he will teach you.' },
            { key: 'haggle', title: 'Haggle with Kai in chat', hint: 'Sell him a raw fish and talk the price up — he has a patience limit.' },
            { key: 'nft', title: 'Sell Kai a minted fish NFT', hint: 'Mint a catch in your BAG, then haggle — Kai pays real RESPITE from his own treasury.' },
            {
              key: 'house',
              title: 'Buy & decorate your house',
              hint: hud.nearWalletConnected
                ? 'Claim 0.30 NEAR from Hana, swap 0.25 NEAR for 100 RESPITE, buy the deed, place furniture from your BAG.'
                : 'Sign in first — Hana\'s 0.30 NEAR claim and the Exchange need an account.',
            },
            { key: 'cafe', title: 'Work a Glasshouse Cafe shift', hint: 'Take the rota at the cafe and finish all 3 orders in time.' },
            { key: 'warzone', title: 'Enter the Warzone (optional)', hint: 'Red vs Blue crate combat — from any transit kiosk.' },
          ];
          const doneCount = stops.filter((stop) => cityHighlights.done[stop.key]).length;
          if (doneCount >= stops.length) return null;
          return (
            <div className="fixed left-3 bottom-28 z-30 w-[292px] max-w-[86vw] bg-white border-[3px] border-black shadow-[5px_5px_0_#000] text-black select-none">
              <div className="flex items-center justify-between bg-[#b8ff3c] border-b-[3px] border-black px-2.5 py-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider">
                  Hana · City Highlights
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 bg-black text-white text-[9px] font-black">
                    {doneCount}/6
                  </span>
                  <button
                    type="button"
                    aria-label="Dismiss city highlights"
                    onClick={() => {
                      soundEngine.playUiCancel();
                      if (kaiTutorialStage === 'done') {
                        window.dispatchEvent(
                          new CustomEvent('set-kai-tutorial', {
                            detail: { exclamation: false, pin: null },
                          }),
                        );
                      }
                      setCityHighlights((prev) => ({ ...prev, dismissed: true }));
                    }}
                    className="w-5 h-5 bg-white border-2 border-black text-[11px] font-black leading-none flex items-center justify-center cursor-pointer"
                  >
                    ✕
                  </button>
                </span>
              </div>
              <p className="px-2.5 pt-2 text-[10px] font-bold text-slate-600 leading-snug">
                Six stops to feel the whole city — any order, nothing is locked behind them.
              </p>
              <div className="p-2 flex flex-col gap-1.5">
                {stops.map((stop) => {
                  const isDone = cityHighlights.done[stop.key];
                  return (
                    <div
                      key={stop.key}
                      className={`flex items-start gap-2 border-2 border-black px-2 py-1.5 ${isDone ? 'bg-[#e7f9c8]' : 'bg-[#fdfbf6]'}`}
                    >
                      <span
                        className={`mt-0.5 w-4 h-4 shrink-0 border-2 border-black flex items-center justify-center text-[10px] font-black ${isDone ? 'bg-[#b8ff3c]' : 'bg-white'}`}
                      >
                        {isDone ? '✓' : ''}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[10.5px] font-black uppercase tracking-wide leading-tight">
                          {stop.title}
                        </span>
                        <span className="block text-[9.5px] font-semibold text-slate-600 leading-snug">
                          {stop.hint}
                        </span>
                      </span>
                      {!isDone && (
                        <button
                          type="button"
                          onClick={() => handleHighlightGo(stop.key)}
                          className="shrink-0 px-2 py-1 bg-black text-white text-[9px] font-black uppercase tracking-wider cursor-pointer hover:bg-[#1f4d3a]"
                        >
                          Go
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

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
      <CafeWorkShiftBottomDock
        isVisible={
          isInsideGlasshouseCafe &&
          !cafeShiftState.isWorking &&
          isNearCafeRotaBoard &&
          activeCafeModal === 'none'
        }
        isExpanded={isCafeRotaMenuExpanded}
        shiftState={cafeShiftState}
        onToggleExpand={() => {
          soundEngine.playUiClick();
          setIsCafeRotaMenuExpanded((prev) => !prev);
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
        onPurchaseItem={handlePurchaseCafeItem}
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
      <XpGainCelebrationBanner banner={xpCelebrationBanner} />
    </main>
  );
}
