import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageSquare,
  User,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Settings,
  Wallet,
  Pencil,
  Check,
  ArrowLeft,
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
} from './game/buddiesBlitzRules';
import { soundEngine } from './game/audio';
import { BuddiesBlueprintModal } from './components/BuddiesBlueprintModal';
import { TacticalKioskModal } from './components/TacticalKioskModal';
import {
  SocialChatModal,
  NearbyEntityUser,
  ChatMessage,
} from './components/SocialChatModal';
import { CharacterProfileModal } from './components/CharacterProfileModal';
import { MobileResponsiveControls } from './components/MobileResponsiveControls';
import { NearWalletSelectorModal } from './components/NearWalletSelectorModal';
import {
  NpcMerchantAndHouseModal,
  HouseInteriorPlacementState,
} from './components/NpcMerchantAndHouseModal';
import {
  createInitialMerchantMarketState,
  executeLulToCyonExchange,
  investInMerchantShop,
  stepFastForwardEconomyTick,
  MerchantLocationId,
  MerchantCatalogItem,
  HouseInteriorSlotId,
} from './game/buddiesMerchantPricing';
import {
  ParticleEmitterPanel,
  ParticleEmitterUiState,
  INITIAL_PARTICLE_UI_STATE,
  uiStateToEmitterConfigPatch,
} from './components/ParticleEmitterPanel';
import {
  FAMILY_MEMBER_CONTRACT_PLANS,
  FAMILY_MEMBER_ORDER_SPECS,
  connectInjectedNearExtensionWallet,
  consumeNearWalletCallbackFromUrl,
  createInitialNep171SubAccountLedger,
  deriveSocialInvisibleNearAccount,
  detectNetworkFromAccountId,
  disconnectNearWalletSession,
  executeAtomicNep171SubAccountTransfer,
  executeNearTestnetAndRespiteSwap,
  fetchNearAccountView,
  fetchNearNetworkStatus,
  getNearBlocksAccountUrl,
  getNearBlocksTxUrl,
  isValidNearAccountId,
  recordNep171SubAccountEarning,
  redirectToNearWebWalletLogin,
  type NearAccountOnChainView,
  type NearRpcStatusSnapshot,
  type Nep171GamepassSubAccountLedger,
  type RecruitedFamilyMemberAgent,
} from './lib/nearClient';
import {
  fetchFishMarketplaceListingsFromSupabase,
  fetchGamepassNftLedgerFromSupabase,
  fetchNpcMerchantsFromSupabase,
  fetchOrCreatePlayerProfile,
  insertMarketTransactionReceipt,
  insertSocialChatMessageToSupabase,
  subscribeToBuddiesBlitzRealtime,
  syncBasePlotToSupabase,
  syncFishMarketplaceListingsToSupabase,
  syncGamepassNftLedgerToSupabase,
  syncHouseInteriorToSupabase,
  syncNpcMerchantAndLogTransaction,
  syncPlayerBalancesToSupabase,
  updatePlayerDisplayNameInSupabase,
} from './lib/supabaseClient';
import {
  detectNearbyFishingWaterZone,
  rollRandomCaughtFish,
  INITIAL_DEMO_FISH_MARKET_LISTINGS,
  type CaughtFishItem,
  type FishNftMarketplaceListing,
} from './game/buddiesFishingMarket';

const INITIAL_HUD: HudSnapshot = {
  hp: PLAYER_WARZONE_MAX_HP,
  maxHp: PLAYER_WARZONE_MAX_HP,
  score: 0,
  gold: 2500,
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
  blueHumanCount: 2,
  blueAiCommanderCount: 2,
  redHumanCount: 2,
  redAiCommanderCount: 2,
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
  blueOnlinePopulation: 6,
  redOnlinePopulation: 6,
  maxOnlinePerTeam: 10,
  blueOnlineLabel: 'BLUE 6/10 ONLINE',
  redOnlineLabel: 'RED 6/10 ONLINE',
  worldMode: 'lobby',
  cityArenaMode: 'safezone',
  safezonePlotAccessMode: 'PUBLIC',
  safezoneAllowedFriends: [],
  safezonePlotOwnerId: null,
};

const PRESET_ORDER: LightingPresetKey[] = ['day', 'dusk', 'night', 'dawn'];
const ENABLE_QC_MENU_DEFAULT = import.meta.env.VITE_ENABLE_QC === 'true';

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
  const [isQcMenuUnlocked, setIsQcMenuUnlocked] = useState<boolean>(ENABLE_QC_MENU_DEFAULT);
  const [isSpawnDrawerOpen, setIsSpawnDrawerOpen] = useState<boolean>(false);
  const [characterGender, setCharacterGender] = useState<'female' | 'male'>('male');
  const [onboardingStep, setOnboardingStep] = useState<
    'auth_choice' | 'guest_character_select' | 'entering_lobby' | 'completed'
  >(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (
        params.get('skipOnboarding') === '1' ||
        params.get('fullmap') === '1' ||
        params.get('planeview') ||
        (params.get('world') && params.get('world') !== 'lobby')
      ) {
        return 'completed';
      }
    }
    return 'auth_choice';
  });
  const [playerDisplayName, setPlayerDisplayName] = useState<string>('Buddy Male');
  const [playerUid, setPlayerUid] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const savedWallet = window.localStorage.getItem('bb_last_connected_wallet_id');
      if (savedWallet) return savedWallet.toLowerCase();
      let guestUid = window.localStorage.getItem('bb_guest_uid');
      if (!guestUid) {
        const randHex = Math.floor(100000 + Math.random() * 900000).toString(16);
        guestUid = `guest-${randHex}.testnet`;
        window.localStorage.setItem('bb_guest_uid', guestUid);
      }
      return guestUid;
    }
    return 'guest.testnet';
  });
  const [isCustomGuestNameEdited, setIsCustomGuestNameEdited] = useState<boolean>(false);
  const [isEditingGuestName, setIsEditingGuestName] = useState<boolean>(false);
  const [onboardingAuthMode, setOnboardingAuthMode] = useState<'guest' | 'wallet'>('guest');
  const [onboardingLoadingProgress, setOnboardingLoadingProgress] = useState<number>(0);
  const [walletConnectInput, setWalletConnectInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('bb_last_connected_wallet_id') || '';
    }
    return '';
  });
  const [walletNetworkChoice, setWalletNetworkChoice] = useState<'testnet' | 'mainnet'>('testnet');
  const [isVerifyingNearWallet, setIsVerifyingNearWallet] = useState<boolean>(false);
  const [walletConnectError, setWalletConnectError] = useState<string | null>(null);
  const [nearOnChainAccountView, setNearOnChainAccountView] =
    useState<NearAccountOnChainView | null>(null);
  const [walletUsernameDraft, setWalletUsernameDraft] = useState<string>('Buddy Male');
  const [walletUsernameSavedToast, setWalletUsernameSavedToast] = useState<boolean>(false);
  const [savedWalletSummary, setSavedWalletSummary] = useState<{
    walletId: string;
    displayName: string;
    gender: 'male' | 'female';
  } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const lastId = window.localStorage.getItem('bb_last_connected_wallet_id');
      const rawMap = window.localStorage.getItem('bb_saved_wallet_profiles_v1');
      if (!lastId || !rawMap) return null;
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'q') {
        event.preventDefault();
        setIsQcMenuUnlocked((prev) => {
          const next = !prev;
          if (!next) {
            setIsSpawnDrawerOpen(false);
          }
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const hudRef = useRef<HudSnapshot>(INITIAL_HUD);
  useEffect(() => {
    hudRef.current = hud;
  }, [hud]);
  const [lightingPreset, setLightingPreset] = useState<LightingPresetKey>('day');
  const [cameraFovMode, setCameraFovMode] = useState<'webgl35' | 'roblox18'>('webgl35');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [audioVolumePct, setAudioVolumePct] = useState<number>(100);
  const [isBlueprintModalOpen, setIsBlueprintModalOpen] = useState<boolean>(false);
  const [isKioskModalOpen, setIsKioskModalOpen] = useState<boolean>(false);
  const [activeSpecialModal, setActiveSpecialModal] = useState<
    'none' | 'npc_merchant' | 'house_interior'
  >('none');
  const [isInsidePrivateHouse, setIsInsidePrivateHouse] = useState<boolean>(false);
  const [merchantLocation, setMerchantLocation] = useState<MerchantLocationId>('lobby_cafe');
  const [marketState, setMarketState] = useState(() => createInitialMerchantMarketState());
  const [cyonBalance, setCyonBalance] = useState<number>(60);
  const [respiteBalance, setRespiteBalance] = useState<number>(45);
  const [nearTestnetBalance, setNearTestnetBalance] = useState<number>(12.5);
  const [isNearWalletSelectorOpen, setIsNearWalletSelectorOpen] = useState<boolean>(false);
  const [hasHouseOwnership, setHasHouseOwnership] = useState<boolean>(false);
  const [recruitedFamilyMembers, setRecruitedFamilyMembers] = useState<
    RecruitedFamilyMemberAgent[]
  >([]);
  const [ownedMerchantItemIds, setOwnedMerchantItemIds] = useState<string[]>([
    'tatami_tea_table',
    'sakura_bonsai_pot',
    'theme_japanese_zen',
  ]);
  const [activeHouseThemeId, setActiveHouseThemeId] = useState<string>('theme_japanese_zen');
  const [interiorPlacement, setInteriorPlacement] = useState<HouseInteriorPlacementState>({
    center_table: 'tatami_tea_table',
    left_wall: null,
    right_wall: null,
    corner_plant: 'sakura_bonsai_pot',
    trophy_pedestal: null,
    rotationStepBySlot: {
      center_table: 0,
      left_wall: 0,
      right_wall: 0,
      corner_plant: 0,
      trophy_pedestal: 0,
    },
  });
  const [isFastForwardRunning, setIsFastForwardRunning] = useState<boolean>(false);
  const [isParticlePanelOpen, setIsParticlePanelOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('particles') === '1';
    }
    return false;
  });
  const [particleUiState, setParticleUiState] = useState<ParticleEmitterUiState>(
    INITIAL_PARTICLE_UI_STATE,
  );
  const [resetTrigger, setResetTrigger] = useState<number>(0);
  const [socialChatText, setSocialChatText] = useState<string>('');
  const [isChatBubbleStyleOpen, setIsChatBubbleStyleOpen] = useState<boolean>(false);
  const [chatBubbleBgColor, setChatBubbleBgColor] = useState<string>('#ffffff');
  const [chatBubbleTextColor, setChatBubbleTextColor] = useState<string>('#0f172a');
  const [isSocialChatModalOpen, setIsSocialChatModalOpen] = useState<boolean>(false);
  const [isPersonalWalletModalOpen, setIsPersonalWalletModalOpen] = useState<boolean>(false);
  const [selectedPrivateUser, setSelectedPrivateUser] = useState<NearbyEntityUser | null>(null);
  const [isTargetMenuExpanded, setIsTargetMenuExpanded] = useState<boolean>(false);
  const [activeTeleportKioskModal, setActiveTeleportKioskModal] = useState<
    'none' | 'lobby_warzone' | 'lobby_safezone' | 'halte_to_lobby'
  >('none');
  const [nearRpcStatus, setNearRpcStatus] = useState<NearRpcStatusSnapshot | null>(null);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);
  const [nep171Ledger, setNep171Ledger] = useState<Nep171GamepassSubAccountLedger>(() =>
    createInitialNep171SubAccountLedger('commander-p1.testnet', 'testnet'),
  );
  const [socialLoginInput, setSocialLoginInput] = useState<string>('commander@near.org');
  const [transferBuyerInput, setTransferBuyerInput] = useState<string>('buyer-omega.testnet');
  const [transferAuditBanner, setTransferAuditBanner] = useState<string | null>(null);
  const [caughtFishBucket, setCaughtFishBucket] = useState<CaughtFishItem[]>([]);
  const [fishMarketListings, setFishMarketListings] = useState<FishNftMarketplaceListing[]>(
    INITIAL_DEMO_FISH_MARKET_LISTINGS,
  );
  const [fishingPhase, setFishingPhase] = useState<'idle' | 'casting' | 'bite'>('idle');
  const [lastCaughtFishToast, setLastCaughtFishToast] = useState<CaughtFishItem | null>(null);

  // Hydrate initial state from NEAR Testnet RPC & Supabase PostgreSQL + Realtime
  useEffect(() => {
    let mounted = true;
    void fetchNearNetworkStatus().then((status) => {
      if (mounted) setNearRpcStatus(status);
    });
    void fetchFishMarketplaceListingsFromSupabase().then((listings) => {
      if (mounted && listings.length > 0) {
        setFishMarketListings(listings);
      }
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
    void fetchGamepassNftLedgerFromSupabase().then((remoteLedger) => {
      if (mounted && remoteLedger) {
        setNep171Ledger(remoteLedger);
      }
    });

    const unsubscribe = subscribeToBuddiesBlitzRealtime({
      onMerchantUpdated: (row) => {
        if (!mounted) return;
        setSupabaseConnected(true);
        void fetchFishMarketplaceListingsFromSupabase().then((listings) => {
          if (mounted) setFishMarketListings(listings);
        });
        setMarketState((prev) => ({
          ...prev,
          treasuryCyon: row.cyon_treasury,
          isShopBroke: row.is_bankrupt,
          dayCounter: row.simulated_day,
          lastMarketHeadline: row.last_headline || prev.lastMarketHeadline,
          stockByItemId: {
            ...prev.stockByItemId,
            ...row.stock_by_item,
          },
          demandByItemId: {
            ...prev.demandByItemId,
            ...row.recent_demand_by_item,
          },
        }));
      },
      onSocialMessageInserted: (msg) => {
        if (!mounted) return;
        setChatMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [
            ...prev,
            {
              id: msg.id,
              senderName: msg.sender_name,
              recipientName: msg.recipient_name || undefined,
              text: msg.message,
              timestamp: new Date(msg.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
              type: msg.recipient_name ? 'private' : 'public',
            },
          ];
        });
      },
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [merchantLocation]);

  useEffect(() => {
    if (
      activeSpecialModal !== 'none' ||
      isKioskModalOpen ||
      isSocialChatModalOpen ||
      activeTeleportKioskModal !== 'none'
    ) {
      setIsPersonalWalletModalOpen(false);
    }
  }, [activeSpecialModal, isKioskModalOpen, isSocialChatModalOpen, activeTeleportKioskModal]);
  const [selectedTargetUser, setSelectedTargetUser] = useState<NearbyEntityUser | null>(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('target') === '1') {
      return {
        id: 'npc_cafe',
        name: 'HANA (BARISTA)',
        isNpc: true,
        distance: 2.4,
        team: 'blue',
        status: 'NPC Merchant',
      };
    }
    return null;
  });
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('profile') === '1';
    }
    return false;
  });
  const [profileTargetUser, setProfileTargetUser] = useState<NearbyEntityUser | null>(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('profile') === '1') {
      return {
        id: 'npc_cafe',
        name: 'HANA (BARISTA)',
        isNpc: true,
        distance: 2.4,
        team: 'blue',
        status: 'NPC Merchant',
      };
    }
    return null;
  });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      senderName: 'SYSTEM',
      isNpc: true,
      text: 'Welcome to the Warzone & Safezone Hub. Press [T] or the CHAT button to open local radius chat!',
      timestamp: '12:00',
      type: 'public',
    },
    {
      id: 'hana-greet',
      senderName: 'HANA',
      isNpc: true,
      text: 'Hello Buddy! Stop by the café if you want to exchange LUL for CYON or browse new furniture.',
      timestamp: '12:01',
      type: 'public',
    },
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

  const handleChangeParticleUiState = useCallback((nextUi: ParticleEmitterUiState) => {
    setParticleUiState(nextUi);
    const patch = uiStateToEmitterConfigPatch(nextUi);
    window.dispatchEvent(new CustomEvent('particle-emitter-config', { detail: patch }));
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
    if (nextMode === 'editor') {
      setIsSpawnDrawerOpen(false);
    }
    if (gameState !== 'playing') {
      setGameState('playing');
    }
  }, [gameState]);

  useEffect(() => {
    soundEngine.startBgm();
  }, []);

  const handleToggleAudio = useCallback(() => {
    const nextMuted = !soundEngine.muted;
    soundEngine.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted) {
      if (soundEngine.masterVolume <= 0) {
        soundEngine.setMasterVolume(0.5);
        setAudioVolumePct(50);
      }
      soundEngine.startBgm();
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
      soundEngine.startBgm();
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
    setCameraFovMode((prev) => (prev === 'webgl35' ? 'roblox18' : 'webgl35'));
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
      setIsSpawnDrawerOpen(false);
    };
    const onOpenNpcMerchant = (ev: Event) => {
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
      setIsInsidePrivateHouse(true);
      setActiveSpecialModal('none');
    };
    const onExitHouseInterior = () => {
      setIsInsidePrivateHouse(false);
      setActiveSpecialModal('none');
    };
    const onOpenCharacterProfile = (e: Event) => {
      const customEv = e as CustomEvent<{ user: NearbyEntityUser }>;
      if (customEv.detail?.user) {
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
      if (customEv.detail?.user) {
        setIsKioskModalOpen(false);
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
      const customEv = e as CustomEvent<{
        kind: 'lobby_warzone' | 'lobby_safezone' | 'halte_to_lobby';
      }>;
      const k = customEv.detail?.kind;
      if (k) {
        setIsKioskModalOpen(false);
        setActiveSpecialModal('none');
        setIsSocialChatModalOpen(false);
        setActiveTeleportKioskModal(k);
      }
    };
    const onCloseTeleportKioskModal = () => {
      setActiveTeleportKioskModal('none');
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
    };
  }, []);

  useEffect(() => {
    const effectiveMode =
      onboardingStep === 'guest_character_select'
        ? 'character_select'
        : activeSpecialModal === 'none' && isInsidePrivateHouse
          ? 'house_visit'
          : activeSpecialModal;
    window.dispatchEvent(
      new CustomEvent('sync-npc-camera-mode', {
        detail: {
          mode: effectiveMode,
          location: merchantLocation,
          themeId: activeHouseThemeId,
          placement: interiorPlacement,
        },
      }),
    );
  }, [
    onboardingStep,
    activeSpecialModal,
    isInsidePrivateHouse,
    merchantLocation,
    activeHouseThemeId,
    interiorPlacement,
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
    (walletId: string, displayName: string, gender: 'male' | 'female') => {
      if (typeof window === 'undefined') return;
      const cleanWallet = walletId.trim().toLowerCase();
      if (!cleanWallet) return;
      try {
        window.localStorage.setItem('bb_last_connected_wallet_id', cleanWallet);
        const rawMap = window.localStorage.getItem('bb_saved_wallet_profiles_v1');
        const map: Record<string, { displayName: string; gender: 'male' | 'female' }> = rawMap
          ? JSON.parse(rawMap)
          : {};
        map[cleanWallet] = { displayName, gender };
        window.localStorage.setItem('bb_saved_wallet_profiles_v1', JSON.stringify(map));
        setSavedWalletSummary({ walletId: cleanWallet, displayName, gender });
      } catch {
        // ignore storage errors
      }
    },
    [],
  );

  const handleConnectWalletAndEnterLobby = useCallback(
    async (rawWalletInput: string) => {
      soundEngine.playUiClick();
      setWalletConnectError(null);
      const cleanInput = rawWalletInput.trim().toLowerCase();
      if (!cleanInput) {
        setWalletConnectError(
          'Please enter your NEAR wallet address (e.g. yourname.testnet or yourname.near) or click Sign In with MyNearWallet above.',
        );
        return;
      }
      const defaultSuffix = walletNetworkChoice === 'mainnet' ? 'near' : 'testnet';
      const normalizedWallet =
        cleanInput.includes('.') || /^[0-9a-f]{64}$/.test(cleanInput)
          ? cleanInput
          : `${cleanInput.replace(/[^a-z0-9_-]/g, '')}.${defaultSuffix}`;

      if (!isValidNearAccountId(normalizedWallet)) {
        setWalletConnectError(
          `Invalid NEAR account format "${normalizedWallet}". Use a valid .testnet, .near, or 64-char implicit hex wallet address.`,
        );
        return;
      }

      setIsVerifyingNearWallet(true);
      const detectedNet = detectNetworkFromAccountId(normalizedWallet, walletNetworkChoice);
      const accountView = await fetchNearAccountView(normalizedWallet, detectedNet);
      setNearOnChainAccountView(accountView);
      setIsVerifyingNearWallet(false);

      // 1. Check local saved wallet profile first for instant restoration
      let restoredGender: 'male' | 'female' = characterGender;
      let restoredName = normalizedWallet.split('.')[0].toUpperCase();
      if (typeof window !== 'undefined') {
        try {
          const rawMap = window.localStorage.getItem('bb_saved_wallet_profiles_v1');
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

      // Bind Wallet Address as Player UID
      setPlayerUid(normalizedWallet);
      setWalletConnectInput(normalizedWallet);
      setCharacterGender(restoredGender);
      setPlayerDisplayName(restoredName);
      setWalletUsernameDraft(restoredName);
      setOnboardingAuthMode('wallet');
      setOnboardingLoadingProgress(12);
      setOnboardingStep('entering_lobby');

      const nextLedger = createInitialNep171SubAccountLedger(normalizedWallet, detectedNet);
      setNep171Ledger(nextLedger);
      dispatchBuddyAction(`nearConnectAndMint:${normalizedWallet}`);
      dispatchBuddyAction(`setCharacterGender:${restoredGender}`);
      dispatchBuddyAction(`setPlayerDisplayName:${restoredName}`);
      setHud((prev) => ({
        ...prev,
        nearWalletConnected: true,
        nearWalletId: normalizedWallet,
        nearHasGamepassNft: true,
        nearGamepassTokenId: nextLedger.tokenId,
      }));
      persistWalletProfileLocally(normalizedWallet, restoredName, restoredGender);

      // 2. Fetch or restore existing profile from Supabase `bb_profiles` keyed by Wallet UID (`near_account_id`)
      void fetchOrCreatePlayerProfile({
        nearAccountId: normalizedWallet,
        displayName: restoredName,
        authMode: 'near_wallet',
      }).then((profile) => {
        if (profile) {
          setSupabaseConnected(true);
          setCyonBalance(profile.cyon_balance);
          setRespiteBalance(profile.respite_balance);
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
          persistWalletProfileLocally(normalizedWallet, finalName, finalGender);
          void syncPlayerBalancesToSupabase({
            nearAccountId: normalizedWallet,
            displayName: finalName,
            lulBalance: hudRef.current.gold,
            cyonBalance: profile.cyon_balance,
            respiteBalance: profile.respite_balance,
            unlockedSkins: ['default', `gender:${finalGender}`],
          });
        }
      });
      void syncGamepassNftLedgerToSupabase(nextLedger);
    },
    [characterGender, dispatchBuddyAction, persistWalletProfileLocally, walletNetworkChoice],
  );

  // Automatically consume MyNearWallet / Meteor OAuth redirect callback (`?account_id=...`) on mount
  useEffect(() => {
    const callback = consumeNearWalletCallbackFromUrl();
    if (callback && callback.accountId) {
      void handleConnectWalletAndEnterLobby(callback.accountId);
    }
  }, [handleConnectWalletAndEnterLobby]);

  /**
   * Allows the player to change their username at any time (in Chat Settings, Personal Wallet, or Citizen Profile),
   * while keeping their Wallet Address (`playerUid`) as their permanent UID.
   */
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
        void updatePlayerDisplayNameInSupabase({
          nearAccountId: activeUid,
          displayName: cleanName,
          gender: characterGender,
        });
      }
    },
    [characterGender, dispatchBuddyAction, nep171Ledger.ownerNearAccount, persistWalletProfileLocally, playerUid],
  );

  const handleConfirmGuestCharacterAndEnterLobby = useCallback(() => {
    soundEngine.playUiClick();
    const cleanGuestName =
      playerDisplayName.trim() || (characterGender === 'male' ? 'Buddy Male' : 'Buddy Female');
    let guestUid = 'guest.testnet';
    if (typeof window !== 'undefined') {
      guestUid = window.localStorage.getItem('bb_guest_uid') || '';
      if (!guestUid) {
        const randHex = Math.floor(100000 + Math.random() * 900000).toString(16);
        guestUid = `guest-${randHex}.testnet`;
        window.localStorage.setItem('bb_guest_uid', guestUid);
      }
    }
    setPlayerUid(guestUid);
    setPlayerDisplayName(cleanGuestName);
    setWalletUsernameDraft(cleanGuestName);
    setIsEditingGuestName(false);
    setOnboardingAuthMode('guest');
    setOnboardingLoadingProgress(10);
    setOnboardingStep('entering_lobby');
    dispatchBuddyAction(`setCharacterGender:${characterGender}`);
    dispatchBuddyAction(`setPlayerDisplayName:${cleanGuestName}`);
  }, [characterGender, dispatchBuddyAction, playerDisplayName]);

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
    if (!isFastForwardRunning) return;
    const id = window.setInterval(() => {
      setMarketState((prev) => stepFastForwardEconomyTick(prev, prev.dayCounter + 1));
    }, 900);
    return () => window.clearInterval(id);
  }, [isFastForwardRunning]);

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

      if (isBlueprintModalOpen) {
        if (e.code === 'Escape') {
          setIsBlueprintModalOpen(false);
        }
        return;
      }

      if (gameState === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        handleStartGame(false);
        return;
      }

      if (e.code === 'KeyE' && hudRef.current.isNearLobbyGoldExchange) {
        e.preventDefault();
        dispatchBuddyAction('talkToNearestNpcMerchant');
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
    gameState,
    activeSpecialModal,
    isProfileModalOpen,
    isSocialChatModalOpen,
    isKioskModalOpen,
    isBlueprintModalOpen,
    dispatchBuddyAction,
    handleStartGame,
    handleToggleAudio,
    handleCycleLighting,
    handleToggleFovMode,
  ]);

  const playerRadarDot = hud.radarDots.find((d) => d.kind === 'player');
  const nearbyWaterZone = detectNearbyFishingWaterZone(
    playerRadarDot?.x ?? 0,
    playerRadarDot?.z ?? 0,
  );

  const handleTriggerFishingAction = useCallback(() => {
    const pDot = hudRef.current.radarDots.find((d) => d.kind === 'player');
    const waterCheck = detectNearbyFishingWaterZone(pDot?.x ?? 0, pDot?.z ?? 0);
    const activeZone = waterCheck.zoneId ?? 'east_beach';
    const actorAccount =
      hudRef.current.nearWalletId || nep171Ledger.ownerNearAccount || 'commander-p1.testnet';

    soundEngine.playUiClick();
    dispatchBuddyAction('qcEquipWeapon:fishing_rod');

    if (fishingPhase === 'bite') {
      const caught = rollRandomCaughtFish({
        waterZone: activeZone,
        caughtByAccount: actorAccount,
      });
      setCaughtFishBucket((prev) => [caught, ...prev]);
      setLastCaughtFishToast(caught);
      setFishingPhase('idle');
      return;
    }

    if (fishingPhase === 'idle') {
      setFishingPhase('casting');
      setLastCaughtFishToast(null);
      window.setTimeout(() => {
        setFishingPhase((curr) => (curr === 'casting' ? 'bite' : curr));
      }, 1600);
    }
  }, [dispatchBuddyAction, fishingPhase, nep171Ledger.ownerNearAccount]);

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
      {/* 1. 60FPS 3D Team Buddies x Blitz Grassland Arena (Clean Scene Remount per WorldMode) */}
      <BuddiesBlitzArena
        key={`${worldMode}-${worldTransitionCount}`}
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
      />

      {/* Solid Full Scene Transition Loading Overlay */}
      {isWorldLoading && (
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
                ? 'ENTERING SAFEZONE CITY (PEACEFUL CITY)'
                : (loadingTargetMode ?? worldMode) === 'lobby'
                ? 'ENTERING SAFEZONE LOBBY'
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
          2. TITLE SCREEN: HEXAGON CUTOUT & COMIC STICKER LOCKUP (CJn-Xu8f.js)
         ===================================================================== */}
      {gameState === 'title' && (
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
                aria-label="BLITZ PORTFOLIO"
              >
                <g transform="rotate(-3 260 85)">
                  <rect
                    x="10"
                    y="12"
                    width="455"
                    height="108"
                    rx="18"
                    fill="#ffffff"
                    stroke="#11121a"
                    strokeWidth="8"
                  />
                  <text
                    x="32"
                    y="94"
                    fontFamily="'Barlow', sans-serif"
                    fontWeight="900"
                    fontStyle="italic"
                    fontSize="94"
                    letterSpacing="2"
                    fill="#ffffff"
                    stroke="#11121a"
                    strokeWidth="16"
                    paintOrder="stroke fill"
                  >
                    BLITZ
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
                    x="26"
                    y="61"
                    fontFamily="'Barlow', sans-serif"
                    fontWeight="900"
                    fontSize="58"
                    letterSpacing="4"
                    fill="#11121a"
                  >
                    PORTFOLIO
                  </text>
                </g>
              </svg>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setIsBlueprintModalOpen(true);
                  }}
                  className="px-4 py-2.5 bg-[#272935] hover:bg-[#393b49] text-[#b8ff3c] font-black text-xs sm:text-sm rounded-xl border-3 border-[#11121a] ring-2 ring-white/80 comic-sticker-shadow transition-transform hover:-translate-y-0.5 cursor-pointer whitespace-nowrap"
                >
                  Luau Code
                </button>
              </div>
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
          2B. ONBOARDING & AUTH FLOW:
              1) 'auth_choice': Login as a Guest OR Continue with Connect Wallet (Restores Old Account)
              2) 'guest_character_select': Avakin-Style 3D Full-Body Character & Temporary Username Selector
              3) 'entering_lobby': Loading State before entering Mini Café Lobby
         ===================================================================== */}
      {gameState === 'playing' && !isFullMapOverview && onboardingStep === 'auth_choice' && (
        <section
          aria-label="Buddies Blitz Login & Onboarding"
          data-onboarding-step="auth_choice"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/55 backdrop-blur-[3px] pointer-events-auto select-none"
        >
          <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-[#14161d] text-white border-4 border-black ring-4 ring-white shadow-[8px_8px_0_#000] p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div className="text-center space-y-1.5 border-b-2 border-white/15 pb-4">
              <div className="inline-block -skew-x-12 px-3.5 py-1 bg-[#b8ff3c] text-black border-2 border-black shadow-[3px_3px_0_#000] font-black text-xs uppercase tracking-widest">
                <span className="skew-x-12 inline-block">BUDDIES BLITZ ONLINE</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wide text-white pt-1">
                CHOOSE ACCESS MODE
              </h1>
              <p className="text-xs font-bold text-slate-300">
                Login as a Guest to pick a 3D character, or continue with Connect Wallet to restore your existing account.
              </p>
            </div>

            {/* Option 1: Login as a Guest */}
            <div className="p-4 bg-[#1e2230] border-2 border-black shadow-[4px_4px_0_#000] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-[#b8ff3c]">
                  OPTION 1 · NEW PLAYER / GUEST
                </span>
                <span className="px-2 py-0.5 bg-black/50 text-[10px] font-black uppercase text-white/80 border border-white/20">
                  SELECT 3D AVATAR
                </span>
              </div>
              <p className="text-[11px] font-bold text-slate-300 leading-snug">
                Choose a Male or Female character and set your temporary username before entering the Lobby.
              </p>
              <button
                type="button"
                data-login-guest-btn="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  setCharacterGender('male');
                  if (!isCustomGuestNameEdited) {
                    setPlayerDisplayName('Buddy Male');
                  }
                  dispatchBuddyAction('setCharacterGender:male');
                  setOnboardingStep('guest_character_select');
                }}
                className="-skew-x-6 w-full py-3 px-4 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-3 border-black shadow-[4px_4px_0_#000] font-black text-sm uppercase tracking-wider cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              >
                <span className="skew-x-6 inline-block">LOGIN AS A GUEST</span>
              </button>
            </div>

            {/* Option 2: Continue with Real NEAR Protocol Wallet (Wallet Address = Player UID) */}
            <div className="p-4 bg-[#0f172a] border-2 border-black shadow-[4px_4px_0_#000] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-[#38bdf8]">
                  OPTION 2 · CONNECT NEAR WALLET (UID = WALLET)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    data-wallet-net-testnet="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setWalletNetworkChoice('testnet');
                    }}
                    className={`px-1.5 py-0.5 text-[9px] font-black uppercase border cursor-pointer ${
                      walletNetworkChoice === 'testnet'
                        ? 'bg-[#38bdf8] text-black border-black'
                        : 'bg-black/40 text-white/70 border-white/20'
                    }`}
                  >
                    TESTNET
                  </button>
                  <button
                    type="button"
                    data-wallet-net-mainnet="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setWalletNetworkChoice('mainnet');
                    }}
                    className={`px-1.5 py-0.5 text-[9px] font-black uppercase border cursor-pointer ${
                      walletNetworkChoice === 'mainnet'
                        ? 'bg-[#10b981] text-black border-black'
                        : 'bg-black/40 text-white/70 border-white/20'
                    }`}
                  >
                    MAINNET
                  </button>
                </div>
              </div>
              <p className="text-[11px] font-bold text-slate-300 leading-snug">
                Your NEAR wallet address acts as your unique Player UID. Returning wallet players automatically restore their saved username, avatar, and balances.
              </p>

              {/* Real NEAR Wallet Selector Modal & Web Wallet Buttons */}
              <button
                type="button"
                data-open-near-wallet-selector-modal-btn="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  setIsNearWalletSelectorOpen(true);
                }}
                className="-skew-x-6 w-full py-2.5 px-3 bg-[#d8b4fe] hover:bg-[#e9d5ff] text-black border-2 border-black shadow-[3px_3px_0_#000] font-black text-xs uppercase tracking-wider cursor-pointer active:scale-95 transition-all"
              >
                <span className="skew-x-6 inline-block">
                  OPEN NEAR WALLET SELECTOR MODAL (@near-wallet-selector)
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-mynearwallet-redirect-btn="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    redirectToNearWebWalletLogin({
                      networkId: walletNetworkChoice,
                      provider: 'mynearwallet',
                    });
                  }}
                  className="-skew-x-6 py-2 px-2.5 bg-[#10b981] hover:bg-[#34d399] text-black border-2 border-black shadow-[2px_2px_0_#000] font-black text-[10px] uppercase tracking-wider cursor-pointer active:scale-95 transition-all"
                >
                  <span className="skew-x-6 inline-block">MYNEARWALLET LOGIN ↗</span>
                </button>
                <button
                  type="button"
                  data-meteor-wallet-btn="true"
                  onClick={async () => {
                    soundEngine.playUiClick();
                    const ext = await connectInjectedNearExtensionWallet();
                    if (ext.connected && ext.accountId) {
                      void handleConnectWalletAndEnterLobby(ext.accountId);
                    } else {
                      redirectToNearWebWalletLogin({
                        networkId: walletNetworkChoice,
                        provider: 'meteor',
                      });
                    }
                  }}
                  className="-skew-x-6 py-2 px-2.5 bg-[#facc15] hover:bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0_#000] font-black text-[10px] uppercase tracking-wider cursor-pointer active:scale-95 transition-all"
                >
                  <span className="skew-x-6 inline-block">METEOR / EXTENSION ↗</span>
                </button>
              </div>

              {savedWalletSummary && (
                <div className="p-2 bg-[#1e293b] border border-[#38bdf8]/50 text-[10.5px] font-bold text-slate-200 flex items-center justify-between gap-2">
                  <div className="min-w-0 truncate">
                    Saved UID: <strong className="text-[#38bdf8] font-mono">{savedWalletSummary.walletId}</strong> ·{' '}
                    <strong className="text-[#facc15]">{savedWalletSummary.displayName}</strong>
                  </div>
                  <button
                    type="button"
                    data-reconnect-saved-wallet-btn="true"
                    onClick={() => void handleConnectWalletAndEnterLobby(savedWalletSummary.walletId)}
                    className="px-2 py-0.5 bg-[#38bdf8] text-black font-black text-[9.5px] uppercase border border-black cursor-pointer shrink-0"
                  >
                    RECONNECT
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <input
                  type="text"
                  data-wallet-connect-input="true"
                  value={walletConnectInput}
                  onChange={(e) => {
                    setWalletConnectInput(e.target.value);
                    if (walletConnectError) setWalletConnectError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void handleConnectWalletAndEnterLobby(
                        walletConnectInput || savedWalletSummary?.walletId || '',
                      );
                    }
                  }}
                  placeholder={
                    walletNetworkChoice === 'mainnet'
                      ? 'Enter NEAR Wallet Address (e.g. yourname.near)'
                      : 'Enter NEAR Wallet Address (e.g. yourname.testnet)'
                  }
                  aria-label="NEAR Wallet Account ID"
                  className="w-full px-3 py-2 bg-white text-black font-bold text-xs border-2 border-black focus:outline-none focus:ring-2 focus:ring-[#38bdf8]"
                />
                {walletConnectError && (
                  <div
                    data-wallet-connect-error="true"
                    className="p-2 bg-[#ff3b30]/20 border border-[#ff3b30] text-[#fca5a5] text-[10.5px] font-bold"
                  >
                    {walletConnectError}
                  </div>
                )}
                <button
                  type="button"
                  data-connect-wallet-enter-btn="true"
                  disabled={isVerifyingNearWallet}
                  onClick={() =>
                    void handleConnectWalletAndEnterLobby(
                      walletConnectInput || savedWalletSummary?.walletId || '',
                    )
                  }
                  className="-skew-x-6 w-full py-3 px-4 bg-[#38bdf8] hover:bg-[#7dd3fc] disabled:opacity-60 text-black border-3 border-black shadow-[4px_4px_0_#000] font-black text-sm uppercase tracking-wider cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2"
                >
                  <div className="skew-x-6 flex items-center justify-center gap-2">
                    <Wallet className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
                    <span>
                      {isVerifyingNearWallet
                        ? 'VERIFYING ON NEAR RPC...'
                        : 'CONTINUE WITH CONNECT WALLET'}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* STEP 2: Avakin-Style 3D Character Selection Studio (When 'Login as a Guest' is clicked) */}
      {gameState === 'playing' &&
        !isFullMapOverview &&
        onboardingStep === 'guest_character_select' && (
          <section
            aria-label="Select Character & Temporary Username"
            data-onboarding-step="guest_character_select"
            className="fixed inset-0 z-50 flex flex-col justify-between items-center py-6 px-4 pointer-events-none select-none"
          >
            {/* Top Header Pill */}
            <div className="pointer-events-auto bg-[#121318]/90 text-white border-2 border-black px-5 py-2 shadow-[4px_4px_0_#000] text-center">
              <div className="text-[10px] font-black uppercase tracking-widest text-[#b8ff3c]">
                GUEST SESSION · 3D CHARACTER SELECTION
              </div>
              <div className="text-xs font-bold text-white/90">
                Use &lt; &gt; arrows to choose Male or Female and edit your temporary username
              </div>
            </div>

            {/* Bottom Avakin-Style Dark Translucent Character Bar */}
            <div className="pointer-events-auto w-full max-w-md bg-[#121318]/92 text-white border-2 border-black/90 shadow-[0_10px_30px_rgba(0,0,0,0.75)] px-5 py-4 space-y-3.5">
              {/* Row 1: Editable Temporary Username + Pencil Icon */}
              <div className="relative flex items-center justify-center border-b border-white/15 pb-2.5">
                {isEditingGuestName ? (
                  <div className="flex items-center gap-2 w-full max-w-xs">
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
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setIsEditingGuestName(false);
                        }
                      }}
                      placeholder="Enter temporary username..."
                      className="flex-1 px-2.5 py-1 bg-white text-black font-black text-base text-center border-2 border-[#b8ff3c] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setIsEditingGuestName(false);
                      }}
                      aria-label="Save Username"
                      className="w-8 h-8 bg-[#b8ff3c] text-black border-2 border-black flex items-center justify-center cursor-pointer"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                    </button>
                  </div>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    data-edit-guest-username-trigger="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setIsEditingGuestName(true);
                      window.setTimeout(() => guestNameInputRef.current?.focus(), 20);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setIsEditingGuestName(true);
                        window.setTimeout(() => guestNameInputRef.current?.focus(), 20);
                      }
                    }}
                    className="flex items-center justify-center gap-3 cursor-pointer group px-4 py-0.5"
                    title="Click to edit temporary username"
                  >
                    <span className="text-xl sm:text-2xl font-bold tracking-wide text-white group-hover:text-[#b8ff3c] transition-colors">
                      {playerDisplayName || (characterGender === 'male' ? 'Buddy Male' : 'Buddy Female')}
                    </span>
                    <Pencil className="w-4 h-4 text-white/80 group-hover:text-[#b8ff3c] transition-colors" />
                  </div>
                )}
              </div>

              {/* Row 2: Back Button, < 1/2 > Gender Switcher, and Confirm / Enter Lobby Button */}
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setOnboardingStep('auth_choice');
                  }}
                  title="Back to Login Options"
                  aria-label="Back"
                  className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white border border-white/25 flex items-center justify-center cursor-pointer active:scale-95 transition-all"
                >
                  <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
                </button>

                <div className="flex items-center gap-5">
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
                    className="w-9 h-9 flex items-center justify-center text-white hover:text-[#b8ff3c] cursor-pointer active:scale-90 transition-transform"
                  >
                    <ChevronLeft className="w-8 h-8 stroke-[2.8]" />
                  </button>

                  <div className="text-center min-w-[100px]">
                    <div className="text-lg font-bold tracking-wider text-white">
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
                    className="w-9 h-9 flex items-center justify-center text-white hover:text-[#b8ff3c] cursor-pointer active:scale-90 transition-transform"
                  >
                    <ChevronRight className="w-8 h-8 stroke-[2.8]" />
                  </button>
                </div>

                <button
                  type="button"
                  data-confirm-guest-character-btn="true"
                  onClick={handleConfirmGuestCharacterAndEnterLobby}
                  className="-skew-x-6 px-4 py-2.5 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-2 border-black shadow-[3px_3px_0_#000] font-black text-xs uppercase tracking-wider cursor-pointer active:scale-95 transition-all"
                >
                  <span className="skew-x-6 inline-block">ENTER LOBBY</span>
                </button>
              </div>
            </div>
          </section>
        )}

      {/* STEP 3: Loading State Before Entering Mini Café Lobby */}
      {gameState === 'playing' &&
        !isFullMapOverview &&
        onboardingStep === 'entering_lobby' && (
          <div
            data-onboarding-step="entering_lobby"
            style={{ backgroundColor: '#0b0e16', opacity: 1 }}
            className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#0b0e16] text-white pointer-events-auto select-none px-4"
          >
            <div className="flex flex-col items-center gap-3.5 max-w-md w-full text-center">
              <div className="-skew-x-12 px-8 py-4 bg-[#b8ff3c] text-[#0d0f12] border-4 border-[#0d0f12] ring-4 ring-white shadow-[6px_6px_0_#0d0f12] font-black text-2xl sm:text-3xl tracking-widest uppercase animate-pulse">
                <span className="skew-x-12 inline-block">LOADING LOBBY...</span>
              </div>

              <div className="text-xs sm:text-sm font-black tracking-widest uppercase text-[#38bdf8]">
                {onboardingAuthMode === 'wallet'
                  ? `RESTORING WALLET ACCOUNT (${hud.nearWalletId || walletConnectInput})`
                  : `PREPARING GUEST SESSION · ${playerDisplayName.toUpperCase()}`}
              </div>

              <div className="px-3 py-1 bg-[#1e293b] border border-white/25 text-[11px] font-black uppercase text-[#facc15]">
                CHARACTER: {characterGender === 'male' ? 'MALE' : 'FEMALE'} · USERNAME: {playerDisplayName}
              </div>

              {/* Animated Progress Bar */}
              <div className="w-64 sm:w-72 h-3 bg-[#14161d] border-2 border-white/80 rounded-full overflow-hidden mt-1 shadow-[2px_2px_0_#000]">
                <div
                  className="h-full bg-[#b8ff3c] transition-all duration-150"
                  style={{ width: `${onboardingLoadingProgress}%` }}
                />
              </div>

              <div className="text-[10.5px] font-bold text-white/65 tracking-wider">
                Preparing 3D avatar &amp; entering Mini Café Lobby ({onboardingLoadingProgress}%)...
              </div>
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
      {gameState === 'playing' && !isFullMapOverview && onboardingStep === 'completed' && (
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
                <button
                  type="button"
                  tabIndex={-1}
                  data-kiosk-open-btn="top-pad"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    soundEngine.playUiClick();
                    setActiveSpecialModal('none');
                    setIsSocialChatModalOpen(false);
                    setIsPersonalWalletModalOpen(false);
                    setActiveTeleportKioskModal('none');
                    window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
                    setIsKioskModalOpen(true);
                  }}
                  title="LUL (Lulling) Session Currency"
                  className="-skew-x-12 px-2.5 py-1 bg-[#fec83e] hover:bg-[#ffe066] text-[#1a1a1a] border-3 border-[#1a1a1a] shadow-[3px_3px_0_#1a1a1a] font-black text-[11px] cursor-pointer transition-transform active:scale-95"
                >
                  <span className="skew-x-12 inline-block">
                    {hud.gold} LUL
                  </span>
                </button>

                <div
                  data-top-cyon-badge="true"
                  title="CYON (Halcyon) — Non-Crypto Currency exchanged from LUL at the NPC ATM"
                  className="-skew-x-12 px-2 py-1 bg-[#38bdf8] text-[#0f172a] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] font-black text-[10px]"
                >
                  <span className="skew-x-12 inline-block">{cyonBalance} CYON</span>
                </div>

                <div
                  data-top-respite-badge="true"
                  title="RESPITE — NEAR Crypto Token (NEP-141) for NFT themes & furniture"
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
                        10,
                        Math.min(
                          100,
                          ((hud.blueOnlinePopulation ?? 6) / (hud.maxOnlinePerTeam ?? 10)) * 100,
                        ),
                      )}%`,
                    }}
                    className="absolute inset-y-0 left-0 bg-[#00d2ff] transition-all duration-200"
                  />
                  <span
                    data-blue-online-label="true"
                    className="skew-x-12 relative z-10 font-black font-mono-tabular text-[11px] sm:text-xs text-white drop-shadow-[0_1px_2px_#1a1a1a] tracking-wider whitespace-nowrap"
                  >
                    {hud.blueOnlineLabel ?? 'BLUE 6/10 ONLINE'}
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
                        10,
                        Math.min(
                          100,
                          ((hud.redOnlinePopulation ?? 6) / (hud.maxOnlinePerTeam ?? 10)) * 100,
                        ),
                      )}%`,
                    }}
                    className="absolute inset-y-0 right-0 bg-[#ff3b30] transition-all duration-200"
                  />
                  <span
                    data-red-online-label="true"
                    className="skew-x-12 relative z-10 font-black font-mono-tabular text-[11px] sm:text-xs text-white drop-shadow-[0_1px_2px_#1a1a1a] tracking-wider whitespace-nowrap"
                  >
                    {hud.redOnlineLabel ?? 'RED 6/10 ONLINE'}
                  </span>
                </div>
              </div>
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

              {/* Skewed Polygonal Menu Button (Hidden in online deploy unless VITE_ENABLE_QC=true or Ctrl+Shift+Q) */}
              {isQcMenuUnlocked && (
                <button
                  type="button"
                  aria-label="Settings & Developer Menu"
                  aria-expanded={isSpawnDrawerOpen}
                  data-sandbox-toggle="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setIsSpawnDrawerOpen((prev) => !prev);
                    if (!isSpawnDrawerOpen) {
                      setIsParticlePanelOpen(false);
                    }
                  }}
                  className={`-skew-x-12 px-2.5 h-10 flex items-center justify-center font-black text-xs border-3 border-[#1a1a1a] ring-2 ring-white shadow-[4px_4px_0_#1a1a1a] transition-transform hover:scale-105 active:scale-95 cursor-pointer ${
                    isSpawnDrawerOpen
                      ? 'bg-[#fec83e] text-[#1a1a1a]'
                      : 'bg-white hover:bg-[#fec83e] text-[#1a1a1a]'
                  }`}
                >
                  <span className="skew-x-12 inline-block">MENU</span>
                </button>
              )}
            </div>

            {/* Pop-up Developer & Utility Drawer (Opened via [MENU]) */}
            {isQcMenuUnlocked && isSpawnDrawerOpen && (
              <div
                aria-label="Developer & Settings Drawer"
                className="w-80 max-h-[82vh] overflow-y-auto bg-white border-3 border-[#1a1a1a] ring-2 ring-white shadow-[6px_6px_0_#1a1a1a] p-3 flex flex-col gap-2.5 text-[#1a1a1a]"
              >
                {/* Section 0: Character Gender Toggle (FEMALE / MALE) for Quality Control */}
                <div className="p-2 bg-[#14161d] text-white border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                    <span className="text-[#ffd700]">CHARACTER TOGGLE (QC)</span>
                    <span
                      data-active-character-gender={characterGender}
                      className="px-1.5 py-0.5 bg-[#1f2433] text-[#b8ff3c] border border-white/25 text-[9px]"
                    >
                      ACTIVE: {characterGender === 'female' ? 'FEMALE' : 'MALE'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      data-gender-toggle="female"
                      data-sandbox-btn="gender-female"
                      onClick={() => {
                        setCharacterGender('female');
                        dispatchBuddyAction('setCharacterGender:female');
                      }}
                      className={`-skew-x-6 py-1.5 px-2 font-black text-[10px] border-2 border-[#1a1a1a] cursor-pointer transition-colors ${
                        characterGender === 'female'
                          ? 'bg-[#b8ff3c] text-[#1a1a1a] shadow-[2px_2px_0_#ffffff]'
                          : 'bg-[#25293a] text-white hover:bg-[#343848]'
                      }`}
                    >
                      <span className="skew-x-6 inline-block">FEMALE</span>
                    </button>
                    <button
                      type="button"
                      data-gender-toggle="male"
                      data-sandbox-btn="gender-male"
                      onClick={() => {
                        setCharacterGender('male');
                        dispatchBuddyAction('setCharacterGender:male');
                      }}
                      className={`-skew-x-6 py-1.5 px-2 font-black text-[10px] border-2 border-[#1a1a1a] cursor-pointer transition-colors ${
                        characterGender === 'male'
                          ? 'bg-[#00d2ff] text-[#1a1a1a] shadow-[2px_2px_0_#ffffff]'
                          : 'bg-[#25293a] text-white hover:bg-[#343848]'
                      }`}
                    >
                      <span className="skew-x-6 inline-block">MALE</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      data-qc-sitting="female"
                      data-sandbox-btn="qc-sitting-female"
                      onClick={() => {
                        setCharacterGender('female');
                        dispatchBuddyAction('qcToggleSitting');
                      }}
                      className="-skew-x-6 py-1.5 px-2 bg-[#f472b6] hover:bg-[#fb7185] text-[#1a1a1a] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#ffffff] cursor-pointer transition-colors"
                    >
                      <span className="skew-x-6 inline-block">SITTING FEMALE [C]</span>
                    </button>
                    <button
                      type="button"
                      data-qc-sitting="male"
                      data-sandbox-btn="qc-sitting-male"
                      onClick={() => {
                        setCharacterGender('male');
                        dispatchBuddyAction('qcToggleSittingMale');
                      }}
                      className="-skew-x-6 py-1.5 px-2 bg-[#38bdf8] hover:bg-[#7dd3fc] text-[#1a1a1a] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#ffffff] cursor-pointer transition-colors"
                    >
                      <span className="skew-x-6 inline-block">SITTING MALE [C]</span>
                    </button>
                    <button
                      type="button"
                      data-qc-driving="female"
                      data-sandbox-btn="qc-driving-female"
                      onClick={() => {
                        setCharacterGender('female');
                        dispatchBuddyAction('qcToggleDrivingFemale');
                      }}
                      className="-skew-x-6 py-1.5 px-2 bg-[#b8ff3c] hover:bg-[#d9f99d] text-[#1a1a1a] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#ffffff] cursor-pointer transition-colors"
                    >
                      <span className="skew-x-6 inline-block">DRIVING FEMALE</span>
                    </button>
                    <button
                      type="button"
                      data-qc-driving="male"
                      data-sandbox-btn="qc-driving-male"
                      onClick={() => {
                        setCharacterGender('male');
                        dispatchBuddyAction('qcToggleDrivingMale');
                      }}
                      className="-skew-x-6 py-1.5 px-2 bg-[#facc15] hover:bg-[#fde047] text-[#1a1a1a] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#ffffff] cursor-pointer transition-colors"
                    >
                      <span className="skew-x-6 inline-block">DRIVING MALE</span>
                    </button>
                  </div>
                </div>

                {/* Section 1: Always-On Open Warzone & Live Map Preview */}
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/70 mb-1">
                    ARENA MODE (24/7 OPEN WARZONE)
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      data-mode-btn="sandbox"
                      onClick={() => handleSwitchPlayMode('sandbox')}
                      className={`-skew-x-6 py-1.5 font-black text-[10px] border-2 border-[#1a1a1a] cursor-pointer ${
                        playMode !== 'editor'
                          ? 'bg-[#b8ff3c] text-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a]'
                          : 'bg-[#1a1a1a] text-white hover:bg-[#343848]'
                      }`}
                    >
                      <span className="skew-x-6 inline-block">OPEN WARZONE 24/7</span>
                    </button>
                    <button
                      type="button"
                      data-mode-btn="editor"
                      data-map-preview-btn="true"
                      onClick={() => handleSwitchPlayMode('editor')}
                      className={`-skew-x-6 py-1.5 font-black text-[10px] border-2 border-[#1a1a1a] cursor-pointer ${
                        playMode === 'editor'
                          ? 'bg-[#00d2ff] text-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a]'
                          : 'bg-[#1a1a1a] text-white hover:bg-[#343848]'
                      }`}
                    >
                      <span className="skew-x-6 inline-block">MAP PREVIEW</span>
                    </button>
                  </div>
                </div>

                {/* Section 2: System Controls ([Luau Code], [SOUND/MUTE + Volume Slider], [PAUSE]) */}
                <div className="pt-2 border-t-2 border-[#1a1a1a]/15 space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/70 mb-1">
                    SYSTEM &amp; CODE
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setIsBlueprintModalOpen(true);
                      }}
                      className="-skew-x-6 py-1.5 bg-[#fec83e] hover:bg-[#ffe066] text-[#1a1a1a] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      <span className="skew-x-6 inline-block">Luau Code</span>
                    </button>
                    <button
                      type="button"
                      data-menu-audio-btn="true"
                      onClick={() => {
                        handleToggleAudio();
                      }}
                      className={`-skew-x-6 py-1.5 font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer ${
                        isMuted
                          ? 'bg-[#ff3b30] text-white'
                          : 'bg-[#1a1a1a] hover:bg-[#343848] text-white'
                      }`}
                    >
                      <span className="skew-x-6 inline-block">
                        {isMuted ? 'MUTE' : `SOUND ${audioVolumePct}%`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleTogglePause}
                      className="-skew-x-6 py-1.5 bg-[#1a1a1a] hover:bg-[#343848] text-white font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      <span className="skew-x-6 inline-block">PAUSE</span>
                    </button>
                  </div>

                  {/* Volume Control Slider Always Accessible Under SOUND / MUTE Button */}
                  <div
                    data-menu-volume-panel="true"
                    className="p-2 bg-[#14161d] text-white border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[10px] font-black">
                      <span className="text-[#00d2ff] uppercase tracking-wider">
                        SOUND VOLUME
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          data-menu-volume-label="true"
                          className="font-mono-tabular text-[#b8ff3c]"
                        >
                          {isMuted ? '0% (MUTE)' : `${audioVolumePct}%`}
                        </span>
                        <button
                          type="button"
                          data-menu-mute-toggle="true"
                          onClick={handleToggleAudio}
                          className="px-1.5 py-0.5 bg-[#ff3b30] hover:bg-[#ff554a] text-white text-[9px] font-black uppercase border border-white cursor-pointer"
                        >
                          {isMuted ? 'UNMUTE' : 'MUTE'}
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      data-menu-volume-slider="true"
                      value={isMuted ? 0 : audioVolumePct}
                      onChange={(e) => handleChangeVolumePct(Number(e.target.value))}
                      className="w-full accent-[#b8ff3c] cursor-pointer"
                    />
                  </div>
                </div>

                {/* Section 3: Quality Control (QC) - All Weapons & Ordnance */}
                <div className="pt-2 border-t-2 border-[#1a1a1a]/15 space-y-1.5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/70">
                    QUALITY CONTROL: ALL WEAPONS
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      data-sandbox-btn="equip-unarmed"
                      onClick={() => dispatchBuddyAction('qcEquipWeapon:unarmed')}
                      className="py-1.5 px-1.5 bg-[#e2e8f0] text-[#1a1a1a] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      Fists (Unarmed)
                    </button>
                    <button
                      type="button"
                      data-sandbox-btn="equip-pistol"
                      onClick={() => dispatchBuddyAction('qcEquipWeapon:pistol')}
                      className="py-1.5 px-1.5 bg-[#fde047] text-[#1a1a1a] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      +Pistol (BlitzPistol)
                    </button>
                    <button
                      type="button"
                      data-sandbox-btn="equip-rifle"
                      onClick={() => dispatchBuddyAction('qcEquipWeapon:rifle')}
                      className="py-1.5 px-1.5 bg-[#a3e635] text-[#1a1a1a] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      +AR-99 Assault Rifle
                    </button>
                    <button
                      type="button"
                      data-sandbox-btn="equip-bazooka"
                      onClick={() => dispatchBuddyAction('qcEquipWeapon:bazooka')}
                      className="py-1.5 px-1.5 bg-[#fb923c] text-[#1a1a1a] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      +Bazooka (RPG)
                    </button>
                    <button
                      type="button"
                      data-sandbox-btn="equip-laser"
                      onClick={() => dispatchBuddyAction('sandboxEquipLaserGun')}
                      className="py-1.5 px-1.5 bg-[#00f0ff] text-[#1a1a1a] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      +Laser Gun (LG-88)
                    </button>
                    <button
                      type="button"
                      data-sandbox-btn="equip-gatling"
                      onClick={() => dispatchBuddyAction('sandboxEquipGatlingGun')}
                      className="py-1.5 px-1.5 bg-[#b8ff3c] text-[#1a1a1a] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      +Gatling (TITAN-6)
                    </button>
                    <button
                      type="button"
                      data-sandbox-btn="give-grenade"
                      onClick={() => dispatchBuddyAction('sandboxGiveHandGrenade')}
                      className="py-1.5 px-1.5 bg-[#78825b] text-white font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      +Hand Grenade
                    </button>
                    <button
                      type="button"
                      data-sandbox-btn="give-mine"
                      onClick={() => dispatchBuddyAction('sandboxGiveLandMine')}
                      className="py-1.5 px-1.5 bg-[#f59e0b] text-[#1a1a1a] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      +Land Mine (TM-89)
                    </button>
                    <button
                      type="button"
                      data-sandbox-btn="spawn-cluster-plane"
                      onClick={() => dispatchBuddyAction('sandboxSpawnPlaneWithClusterBomb')}
                      className="py-1.5 px-1.5 bg-[#38bdf8] text-[#1a1a1a] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      +Cluster + Plane
                    </button>
                    <button
                      type="button"
                      data-sandbox-btn="deploy-nuke"
                      onClick={() => {
                        setIsSpawnDrawerOpen(false);
                        dispatchBuddyAction('sandboxDeployNuclearLauncher');
                      }}
                      className="py-1.5 px-1.5 bg-[#ff3b30] text-white font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      +Nuclear Launcher
                    </button>
                    <button
                      type="button"
                      data-sandbox-btn="equip-fishing-rod"
                      onClick={() => dispatchBuddyAction('qcEquipWeapon:fishing_rod')}
                      className="col-span-2 py-1.5 px-1.5 bg-[#0ea5e9] hover:bg-[#38bdf8] text-white font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      +Fishing Rod (Fishing Cast &amp; Idle)
                    </button>
                  </div>
                </div>

                {/* Section 4: Quality Control (QC) - All Vehicles & Crates */}
                <div className="pt-2 border-t-2 border-[#1a1a1a]/15 space-y-1.5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/70">
                    QUALITY CONTROL: ALL VEHICLES
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      data-sandbox-btn="spawn-tank"
                      onClick={() => dispatchBuddyAction('sandboxSpawnTank')}
                      className="py-1.5 px-1 bg-[#b8ff3c] text-[#1a1a1a] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      +Blitz Tank (ST-01)
                    </button>
                    <button
                      type="button"
                      data-sandbox-btn="spawn-super-tank"
                      onClick={() => dispatchBuddyAction('sandboxSpawnSuperTank')}
                      className="py-1.5 px-1 bg-[#00d2ff] text-[#1a1a1a] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      +Super Tank (Heavy)
                    </button>
                    <button
                      type="button"
                      data-sandbox-btn="spawn-plane"
                      onClick={() => dispatchBuddyAction('sandboxSpawnPlane')}
                      className="py-1.5 px-1 bg-[#fec83e] text-[#1a1a1a] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      +Blitz Plane (LF-01)
                    </button>
                    <button
                      type="button"
                      data-sandbox-btn="spawn-truck"
                      onClick={() => dispatchBuddyAction('sandboxSpawnTruck')}
                      className="py-1.5 px-1 bg-[#ffa822] text-[#1a1a1a] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      +Dump Truck (HT-88)
                    </button>
                    <button
                      type="button"
                      data-sandbox-btn="board-tank"
                      onClick={() => dispatchBuddyAction('qcBoardVehicle:tank')}
                      className="py-1.5 px-1 bg-[#14161d] text-[#b8ff3c] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      Board Blitz Tank
                    </button>
                    <button
                      type="button"
                      data-sandbox-btn="board-super-tank"
                      onClick={() => dispatchBuddyAction('qcBoardVehicle:super_tank')}
                      className="py-1.5 px-1 bg-[#14161d] text-[#00d2ff] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      Board Super Tank
                    </button>
                    <button
                      type="button"
                      data-sandbox-btn="board-plane"
                      onClick={() => dispatchBuddyAction('qcBoardVehicle:plane')}
                      className="py-1.5 px-1 bg-[#14161d] text-[#fec83e] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      Board Blitz Plane
                    </button>
                    <button
                      type="button"
                      data-sandbox-btn="board-truck"
                      onClick={() => dispatchBuddyAction('qcBoardVehicle:truck')}
                      className="py-1.5 px-1 bg-[#14161d] text-[#ffa822] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      Board Dump Truck
                    </button>
                    <button
                      type="button"
                      data-sandbox-btn="board-tram"
                      onClick={() => dispatchBuddyAction('qcBoardVehicle:tram')}
                      className="py-1.5 px-1 bg-[#14161d] text-[#38bdf8] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      Board City Tram
                    </button>
                    <button
                      type="button"
                      data-sandbox-btn="dismount-vehicle"
                      onClick={() => dispatchBuddyAction('qcBoardVehicle:dismount')}
                      className="py-1.5 px-1 bg-[#e2e8f0] text-[#1a1a1a] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      Exit Vehicle
                    </button>
                  </div>

                  <div className="pt-1 text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/70">
                    DROP CRATES &amp; UNLOCK BASE (TESTING)
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      data-sandbox-btn="drop-red"
                      onClick={() => dispatchBuddyAction('sandboxDropRedCrate')}
                      className="py-1.5 px-1 bg-[#ff3b30] text-white font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      +Red Crate
                    </button>
                    <button
                      type="button"
                      data-sandbox-btn="drop-blue"
                      onClick={() => dispatchBuddyAction('sandboxDropSuperCrate')}
                      className="py-1.5 px-1 bg-[#00d2ff] text-[#1a1a1a] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      +Blue Crate
                    </button>
                    <button
                      type="button"
                      data-sandbox-btn="drop-legend"
                      onClick={() => dispatchBuddyAction('sandboxDropLegendCrate')}
                      className="py-1.5 px-1 bg-[#ffd700] text-[#1a1a1a] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer"
                    >
                      +Gold Crate
                    </button>
                  </div>
                  <button
                    type="button"
                    data-sandbox-btn="unlock-base-lv3"
                    onClick={() => dispatchBuddyAction('sandboxUnlockBaseLv3')}
                    className="w-full py-1.5 px-2 bg-[#1a1a1a] hover:bg-[#2bb3b1] hover:text-[#1a1a1a] text-[#ffd700] font-black text-[10px] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] cursor-pointer transition-colors"
                  >
                    UNLOCK COMMAND CENTER LV.3 (REVEAL ALL)
                  </button>
                </div>
              </div>
            )}
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
              3E-2. BOTTOM-CENTER: SHORELINE FISHING BAR (Active Near Any Water: Central Oasis Lake or East Beach)
             ================================================================= */}
          {playMode !== 'editor' && (nearbyWaterZone.canFish || lastCaughtFishToast) && (
            <div
              data-fishing-hud-bar="true"
              className="fixed bottom-16 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex flex-col items-center gap-2"
            >
              {lastCaughtFishToast && (
                <div
                  data-caught-fish-toast="true"
                  className="bg-[#0f172a] text-white border-3 border-black ring-2 ring-[#b8ff3c] shadow-[4px_4px_0_#000] px-3.5 py-2 flex items-center gap-3"
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 bg-[#b8ff3c] text-black text-[9px] font-black uppercase">
                        CAUGHT ({lastCaughtFishToast.rarity})
                      </span>
                      <span className="text-xs font-black uppercase text-[#fec83e]">
                        {lastCaughtFishToast.speciesName} ({lastCaughtFishToast.weightKg.toFixed(2)} kg)
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-300">
                      Visit NPC Kai at East Beach to sell (+{lastCaughtFishToast.sellValueLul} LUL) or Mint as NFT (-{lastCaughtFishToast.mintFeeLul} LUL fee)
                    </span>
                  </div>
                </div>
              )}

              {nearbyWaterZone.canFish && (
                <div className="bg-[#14161d]/95 text-white border-3 border-[#1a1a1a] ring-2 ring-white shadow-[4px_4px_0_#1a1a1a] px-3.5 py-2 flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-[#38bdf8]">
                      WATER DETECTED: {nearbyWaterZone.zoneLabel}
                    </span>
                    <span className="text-[10.5px] font-bold text-white/90">
                      {fishingPhase === 'casting'
                        ? 'Bobber in water... Waiting for fish bite...'
                        : fishingPhase === 'bite'
                          ? 'STRIKE! Fish on the hook — Reel in now!'
                          : `Fish Bucket: ${caughtFishBucket.length} caught (Sell/Mint at Beach NPC Kai)`}
                    </span>
                  </div>

                  <button
                    type="button"
                    data-cast-fishing-rod-btn="true"
                    disabled={fishingPhase === 'casting'}
                    onClick={handleTriggerFishingAction}
                    className={`-skew-x-12 px-3.5 py-1.5 border-2 border-black shadow-[2px_2px_0_#000] font-black text-xs uppercase transition-transform ${
                      fishingPhase === 'bite'
                        ? 'bg-[#b8ff3c] hover:bg-[#d9f99d] text-black animate-bounce cursor-pointer'
                        : fishingPhase === 'casting'
                          ? 'bg-slate-600 text-slate-300 cursor-wait'
                          : 'bg-[#fec83e] hover:bg-[#fde047] text-black cursor-pointer active:scale-95'
                    }`}
                  >
                    <span className="skew-x-12 inline-block">
                      {fishingPhase === 'bite'
                        ? 'REEL IN CATCH!'
                        : fishingPhase === 'casting'
                          ? 'WAITING FOR BITE...'
                          : 'CAST FISHING ROD'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              3F. BOTTOM-LEFT: SOCIAL TALK CHAT INPUT BAR (Speech Bubble Above Character Head)
             ================================================================= */}
          {playMode !== 'editor' && (
            <div className="fixed bottom-3 left-3 z-30 pointer-events-auto">
              {/* Chat, Sound & House Decoration Settings Popover */}
              {isChatBubbleStyleOpen && (
                <div
                  data-chat-bubble-style-popover="true"
                  className="mb-2 w-80 bg-white border-3 border-black shadow-[4px_4px_0px_#000] p-3 text-black select-none space-y-3"
                >
                  <div className="flex items-center justify-between border-b-2 border-black pb-1.5">
                    <span className="text-[10.5px] font-black uppercase tracking-wider">
                      CHAT &amp; GAME SETTINGS
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setIsChatBubbleStyleOpen(false);
                      }}
                      className="px-1.5 py-0.5 bg-[#ff3b30] text-white border border-black text-[9.5px] font-black uppercase cursor-pointer"
                    >
                      X
                    </button>
                  </div>

                  {/* Sound Toggle & Volume Control */}
                  <div className="p-2 bg-slate-50 border-2 border-black shadow-[2px_2px_0_#000] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9.5px] font-black uppercase text-slate-800">
                        GAME SOUND &amp; AUDIO
                      </span>
                      <button
                        type="button"
                        data-chat-settings-sound-toggle="true"
                        onClick={handleToggleAudio}
                        className={`-skew-x-6 px-2.5 py-0.5 border-2 border-black shadow-[2px_2px_0_#000] text-[9.5px] font-black uppercase cursor-pointer ${
                          isMuted ? 'bg-[#ff3b30] text-white' : 'bg-[#10b981] text-black'
                        }`}
                      >
                        <span className="skew-x-6 inline-block">
                          {isMuted ? 'SOUND: MUTE' : 'SOUND: ON'}
                        </span>
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase text-slate-600">
                        VOL {isMuted ? 0 : audioVolumePct}%
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={isMuted ? 0 : audioVolumePct}
                        onChange={(e) => handleChangeVolumePct(Number(e.target.value))}
                        aria-label="Master Volume"
                        className="flex-1 h-2 accent-[#10b981] cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* House Decoration Option — ONLY visible when player is inside their house */}
                  {isInsidePrivateHouse && (
                    <div
                      data-chat-settings-house-decor="true"
                      className="p-2.5 bg-[#fef08a] border-2 border-black shadow-[2px_2px_0_#000] space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9.5px] font-black uppercase text-black">
                          HOUSE DECORATION (INSIDE HOUSE)
                        </span>
                        <span className="px-1.5 py-0.5 bg-black text-[#b8ff3c] text-[8.5px] font-black uppercase">
                          ROOM STUDIO
                        </span>
                      </div>
                      <p className="text-[9.5px] font-bold text-slate-800 leading-tight">
                        Customize your room furniture, wall paintings, trophy slots, and architectural themes.
                      </p>
                      <button
                        type="button"
                        data-open-house-decor-from-settings="true"
                        onClick={() => {
                          soundEngine.playUiClick();
                          setIsChatBubbleStyleOpen(false);
                          setIsSocialChatModalOpen(false);
                          setActiveSpecialModal('house_interior');
                        }}
                        className="-skew-x-6 w-full py-1.5 px-3 bg-[#10b981] hover:bg-[#34d399] text-black border-2 border-black shadow-[2px_2px_0_#000] text-[10.5px] font-black uppercase tracking-wider cursor-pointer active:scale-95"
                      >
                        <span className="skew-x-6 inline-block">
                          DECORATE HOUSE / EDIT ROOM
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Bubble Color Options */}
                  <div>
                    <div className="text-[9.5px] font-black uppercase text-slate-700 mb-1">
                      CHAT BUBBLE COLOR
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { label: 'White', hex: '#ffffff' },
                        { label: 'Dark', hex: '#0f172a' },
                        { label: 'Yellow', hex: '#facc15' },
                        { label: 'Cyan', hex: '#38bdf8' },
                        { label: 'Green', hex: '#10b981' },
                        { label: 'Purple', hex: '#d8b4fe' },
                      ].map((sw) => (
                        <button
                          key={sw.hex}
                          type="button"
                          title={`Bubble ${sw.label}`}
                          onClick={() => {
                            soundEngine.playUiClick();
                            setChatBubbleBgColor(sw.hex);
                            window.dispatchEvent(
                              new CustomEvent('update-social-bubble-style', {
                                detail: { bgColor: sw.hex, textColor: chatBubbleTextColor },
                              }),
                            );
                          }}
                          style={{ backgroundColor: sw.hex }}
                          className={`w-6 h-6 border-2 border-black cursor-pointer transition-transform ${
                            chatBubbleBgColor === sw.hex
                              ? 'scale-110 ring-2 ring-black shadow-[2px_2px_0_#000]'
                              : 'opacity-85 hover:opacity-100'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Text Color Options */}
                  <div>
                    <div className="text-[9.5px] font-black uppercase text-slate-700 mb-1">
                      CHAT TEXT COLOR
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { label: 'Black', hex: '#0f172a' },
                        { label: 'White', hex: '#ffffff' },
                        { label: 'Yellow', hex: '#fde047' },
                        { label: 'Cyan', hex: '#38bdf8' },
                        { label: 'Green', hex: '#4ade80' },
                        { label: 'Red', hex: '#ff3b30' },
                      ].map((sw) => (
                        <button
                          key={sw.hex}
                          type="button"
                          title={`Text ${sw.label}`}
                          onClick={() => {
                            soundEngine.playUiClick();
                            setChatBubbleTextColor(sw.hex);
                            window.dispatchEvent(
                              new CustomEvent('update-social-bubble-style', {
                                detail: { bgColor: chatBubbleBgColor, textColor: sw.hex },
                              }),
                            );
                          }}
                          style={{ backgroundColor: sw.hex }}
                          className={`w-6 h-6 border-2 border-black cursor-pointer transition-transform ${
                            chatBubbleTextColor === sw.hex
                              ? 'scale-110 ring-2 ring-black shadow-[2px_2px_0_#000]'
                              : 'opacity-85 hover:opacity-100'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Bubble Preview */}
                  <div
                    style={{
                      backgroundColor: chatBubbleBgColor,
                      color: chatBubbleTextColor,
                    }}
                    className="px-3 py-1.5 border-2 border-black shadow-[2px_2px_0_#000] text-center text-[11px] font-black"
                  >
                    Hello Buddy! This is your chat color preview.
                  </div>
                </div>
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
                    if (isSocialChatModalOpen) {
                      window.dispatchEvent(
                        new CustomEvent('social-chat-bar-submit', {
                          detail: { text: trimmed },
                        }),
                      );
                    } else {
                      const nowStr = new Date().toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const newMsg: ChatMessage = {
                        id: `pub-${Date.now()}`,
                        senderName: 'YOU',
                        isSelf: true,
                        text: trimmed,
                        timestamp: nowStr,
                        type: 'public',
                      };
                      setChatMessages((prev) => [...prev, newMsg]);
                      dispatchBuddyAction(`socialTalk:${trimmed}`);
                    }
                    setSocialChatText('');
                  }
                }}
                className="flex items-center gap-1.5 bg-[#14161d]/95 border-3 border-[#1a1a1a] ring-2 ring-white shadow-[4px_4px_0_#1a1a1a] px-2.5 py-1.5 rounded-lg"
              >
                <button
                  type="button"
                  data-chat-style-settings-btn="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setIsChatBubbleStyleOpen((prev) => !prev);
                  }}
                  title="Chat Bubble & Text Color Settings"
                  aria-label="Chat Bubble and Text Color Settings"
                  className="-skew-x-12 w-7 h-7 bg-[#facc15] hover:bg-[#fde047] text-black border-2 border-[#14161d] shadow-[2px_2px_0_#14161d] flex items-center justify-center cursor-pointer active:scale-95 shrink-0"
                >
                  <Settings className="skew-x-12 w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                </button>
                <input
                  type="text"
                  data-social-chat-input="true"
                  maxLength={64}
                  value={socialChatText}
                  onChange={(e) => setSocialChatText(e.target.value)}
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
                  onClick={() => {
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
                  }}
                  className="-skew-x-12 px-2.5 py-1 bg-[#38bdf8] hover:bg-[#7dd3fc] text-[#0f172a] font-black text-xs uppercase border-2 border-[#14161d] shadow-[2px_2px_0_#14161d] cursor-pointer active:scale-95 ml-1"
                  title="Open MMORPG Chat Modal [T]"
                >
                  <span className="skew-x-12 inline-block">CHAT [T]</span>
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
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  setIsBlueprintModalOpen(true);
                }}
                className="w-full py-3 bg-[#fec83e] hover:bg-[#fee763] text-[#11121a] font-black text-sm rounded-xl border-3 border-[#11121a] comic-sticker-shadow cursor-pointer"
              >
                Luau Code
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
        marketState={marketState}
        lulBalance={hud.gold}
        cyonBalance={cyonBalance}
        respiteBalance={respiteBalance}
        nearTestnetBalance={nearTestnetBalance}
        walletConnected={Boolean(hud.nearWalletConnected)}
        hasHouseOwnership={hasHouseOwnership || Boolean(hud.nearHasGamepassNft)}
        onBuyHouseWithRespite={(priceRespite) => {
          if (respiteBalance < priceRespite) return false;
          const actorAccount =
            hud.nearWalletId || playerUid || nep171Ledger.ownerNearAccount || 'commander-p1.testnet';
          const nextRespite = Math.max(0, respiteBalance - priceRespite);
          setRespiteBalance(nextRespite);
          setHasHouseOwnership(true);
          dispatchBuddyAction('nearConnectAndMint');
          setHud((prev) => ({
            ...prev,
            nearHasGamepassNft: true,
          }));
          void syncPlayerBalancesToSupabase({
            nearAccountId: actorAccount,
            lulBalance: hud.gold,
            cyonBalance,
            respiteBalance: nextRespite,
            ownedTokenIds: [...ownedMerchantItemIds, 'nep171:house:ownership'],
          });
          void insertMarketTransactionReceipt({
            merchant_id: merchantLocation,
            actor_near_account: actorAccount,
            action_type: 'buy_item',
            item_id: 'house_ownership',
            nep245_token_id: 'nep171:house:ownership',
            currency: 'RESPITE',
            amount: 1,
            unit_price: priceRespite,
            reasoning_summary: `Purchased Private House ownership for ${priceRespite} RESPITE.`,
          });
          return true;
        }}
        recruitedFamilyMembers={recruitedFamilyMembers}
        onRecruitFamilyMember={(planId) => {
          const plan =
            FAMILY_MEMBER_CONTRACT_PLANS.find((p) => p.id === planId) ||
            FAMILY_MEMBER_CONTRACT_PLANS[0];
          if (respiteBalance < plan.priceRespite) return null;
          const actorAccount =
            hud.nearWalletId || playerUid || nep171Ledger.ownerNearAccount || 'commander-p1.testnet';
          const nextRespite = Math.max(0, respiteBalance - plan.priceRespite);
          setRespiteBalance(nextRespite);

          const memberNumber = recruitedFamilyMembers.length + 1;
          const now = new Date();
          const expires = new Date(now.getTime() + plan.durationDays * 86400 * 1000);
          const newMember: RecruitedFamilyMemberAgent = {
            agentId: `family-member-${Date.now().toString(36)}`,
            name: `FAMILY MEMBER #${memberNumber}`,
            contractAddress: `family-${memberNumber}.buddiesblitz.testnet`,
            planId: plan.id,
            planLabel: plan.shortLabel,
            pricePaidRespite: plan.priceRespite,
            recruitedAtIso: now.toISOString(),
            expiresAtIso: expires.toISOString(),
            activeOrder: 'collect_boxes',
            nearTxHash: `near-family-${Date.now().toString(36)}`,
          };
          setRecruitedFamilyMembers((prev) => [newMember, ...prev]);

          void syncPlayerBalancesToSupabase({
            nearAccountId: actorAccount,
            lulBalance: hud.gold,
            cyonBalance,
            respiteBalance: nextRespite,
          });
          void insertMarketTransactionReceipt({
            merchant_id: merchantLocation,
            actor_near_account: actorAccount,
            action_type: 'buy_item',
            item_id: `family_member_${plan.id}`,
            nep245_token_id: newMember.contractAddress,
            currency: 'RESPITE',
            amount: 1,
            unit_price: plan.priceRespite,
            reasoning_summary: `Recruited ${newMember.name} (${plan.label}) for ${plan.priceRespite} RESPITE.`,
            near_tx_hash: newMember.nearTxHash,
          });
          return newMember;
        }}
        onCommandFamilyMember={(agentId, orderId) => {
          const orderSpec =
            FAMILY_MEMBER_ORDER_SPECS.find((o) => o.id === orderId) ||
            FAMILY_MEMBER_ORDER_SPECS[0];
          setRecruitedFamilyMembers((prev) =>
            prev.map((m) => (m.agentId === agentId ? { ...m, activeOrder: orderId } : m)),
          );
          dispatchBuddyAction(`adjustPlayerLul:${orderSpec.rewardLul}`);
          if (orderId === 'go_fishing') {
            const caught = rollRandomCaughtFish({
              waterZone: 'east_beach',
              caughtByAccount: hud.nearWalletId || playerUid || 'commander-p1.testnet',
            });
            setCaughtFishBucket((prev) => [caught, ...prev]);
          } else if (orderId === 'armed_warzone_attack') {
            dispatchBuddyAction('kioskSelectRecipe:buddy_infantry');
          }
        }}
        ownedItemIds={ownedMerchantItemIds}
        activeHouseThemeId={activeHouseThemeId}
        interiorPlacement={interiorPlacement}
        isFastForwardRunning={isFastForwardRunning}
        playerBubbleBgColor={chatBubbleBgColor}
        playerBubbleTextColor={chatBubbleTextColor}
        onClose={() => {
          soundEngine.playUiClick();
          setIsFastForwardRunning(false);
          setActiveSpecialModal('none');
        }}
        onEarnSafezoneLul={(amount: number) => {
          soundEngine.playUiClick();
          dispatchBuddyAction(`adjustPlayerLul:${amount}`);
        }}
        onExchangeLulToCyon={(customLulSpent?: number, customCyonGranted?: number) => {
          soundEngine.playUiClick();
          const actorAccount = hud.nearWalletId || nep171Ledger.ownerNearAccount || 'commander-p1.testnet';
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
            void syncNpcMerchantAndLogTransaction({
              merchant: {
                merchant_id: merchantLocation,
                cyon_treasury: Math.max(0, marketState.treasuryCyon - customCyonGranted),
              },
              transaction: {
                merchant_id: merchantLocation,
                actor_near_account: actorAccount,
                action_type: 'exchange_lul_cyon',
                currency: 'CYON',
                amount: customCyonGranted,
                unit_price: Number((customLulSpent / customCyonGranted).toFixed(2)),
                reasoning_summary: `Exchanged ${customLulSpent} LUL for ${customCyonGranted} CYON at ${merchantLocation}`,
              },
            });
            void syncPlayerBalancesToSupabase({
              nearAccountId: actorAccount,
              lulBalance: Math.max(0, hud.gold - customLulSpent),
              cyonBalance: nextCyon,
              respiteBalance,
            });
            return;
          }
          const res = executeLulToCyonExchange(marketState, hud.gold, cyonBalance);
          if (res.ok) {
            const lulSpent = Math.max(0, hud.gold - res.updatedLul);
            dispatchBuddyAction(`adjustPlayerLul:${-lulSpent}`);
            setCyonBalance(res.updatedCyon);
            setMarketState(res.updatedState);
            void syncNpcMerchantAndLogTransaction({
              merchant: {
                merchant_id: merchantLocation,
                cyon_treasury: res.updatedState.treasuryCyon,
                is_bankrupt: res.updatedState.isShopBroke,
                last_headline: res.updatedState.lastMarketHeadline,
              },
              transaction: {
                merchant_id: merchantLocation,
                actor_near_account: actorAccount,
                action_type: 'exchange_lul_cyon',
                currency: 'CYON',
                amount: res.updatedCyon - cyonBalance,
                unit_price: lulSpent,
                reasoning_summary: res.updatedState.lastMarketHeadline,
              },
            });
          }
        }}
        onInvestInMerchant={() => {
          soundEngine.playUiClick();
          const actorAccount = hud.nearWalletId || nep171Ledger.ownerNearAccount || 'commander-p1.testnet';
          const res = investInMerchantShop(marketState, hud.gold, cyonBalance);
          if (res.ok) {
            const lulSpent = Math.max(0, hud.gold - res.updatedLul);
            dispatchBuddyAction(`adjustPlayerLul:${-lulSpent}`);
            setCyonBalance(res.updatedCyon);
            setMarketState(res.updatedState);
            void syncNpcMerchantAndLogTransaction({
              merchant: {
                merchant_id: merchantLocation,
                cyon_treasury: res.updatedState.treasuryCyon,
                is_bankrupt: res.updatedState.isShopBroke,
                last_headline: res.updatedState.lastMarketHeadline,
              },
              transaction: {
                merchant_id: merchantLocation,
                actor_near_account: actorAccount,
                action_type: 'invest_shop',
                currency: 'LUL',
                amount: lulSpent,
                unit_price: 1,
                reasoning_summary: res.updatedState.lastMarketHeadline,
              },
            });
          }
        }}
        onBuyMerchantItem={(item: MerchantCatalogItem, finalPrice: number) => {
          soundEngine.playUiClick();
          if (ownedMerchantItemIds.includes(item.id)) return;
          const actorAccount = hud.nearWalletId || nep171Ledger.ownerNearAccount || 'commander-p1.testnet';
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

            void syncNpcMerchantAndLogTransaction({
              merchant: {
                merchant_id: merchantLocation,
                cyon_treasury: nextTreasury,
                stock_by_item: nextStock,
                recent_demand_by_item: nextDemand,
                last_headline: headline,
              },
              transaction: {
                merchant_id: merchantLocation,
                actor_near_account: actorAccount,
                action_type: 'buy_item',
                item_id: item.id,
                nep245_token_id: item.tokenId,
                currency: item.currency,
                amount: 1,
                unit_price: finalPrice,
                reasoning_summary: headline,
              },
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
        onSellMerchantItem={(item: MerchantCatalogItem, refund: number) => {
          soundEngine.playUiClick();
          if (!ownedMerchantItemIds.includes(item.id)) return;
          const actorAccount = hud.nearWalletId || nep171Ledger.ownerNearAccount || 'commander-p1.testnet';
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

            void syncNpcMerchantAndLogTransaction({
              merchant: {
                merchant_id: merchantLocation,
                cyon_treasury: nextTreasury,
                stock_by_item: nextStock,
                recent_demand_by_item: nextDemand,
                last_headline: headline,
              },
              transaction: {
                merchant_id: merchantLocation,
                actor_near_account: actorAccount,
                action_type: 'sell_item',
                item_id: item.id,
                nep245_token_id: item.tokenId,
                currency: item.currency,
                amount: 1,
                unit_price: refund,
                reasoning_summary: headline,
              },
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
        onToggleFastForward={() => setIsFastForwardRunning((prev) => !prev)}
        onSelectHouseTheme={(themeItem: MerchantCatalogItem) => {
          soundEngine.playUiClick();
          if (!ownedMerchantItemIds.includes(themeItem.id)) return;
          setActiveHouseThemeId(themeItem.id);
          dispatchBuddyAction(
            `applyHouseTheme:${themeItem.skinThemeId ?? 'military_standard'}:${themeItem.gardenPresetId ?? 'sakura_grove'}`,
          );
          void syncHouseInteriorToSupabase({
            ownerNearAccount: hud.nearWalletId || nep171Ledger.ownerNearAccount || 'commander-p1.testnet',
            activeThemeId: themeItem.id,
            daylightHour: 14.5,
            placedFurniture: [interiorPlacement],
          });
        }}
        onAssignInteriorSlot={(slotId: HouseInteriorSlotId, itemId: string | null) => {
          soundEngine.playUiClick();
          setInteriorPlacement((prev) => {
            const next = {
              ...prev,
              [slotId]: itemId,
            };
            void syncHouseInteriorToSupabase({
              ownerNearAccount: hud.nearWalletId || nep171Ledger.ownerNearAccount || 'commander-p1.testnet',
              activeThemeId: activeHouseThemeId,
              daylightHour: 14.5,
              placedFurniture: [next],
            });
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
          setIsNearWalletSelectorOpen(true);
        }}
        onSwapNearAndRespite={(direction, inputAmount) => {
          const actorAccount =
            hud.nearWalletId || playerUid || nep171Ledger.ownerNearAccount || 'commander-p1.testnet';
          const receipt = executeNearTestnetAndRespiteSwap({
            direction,
            signerAccountId: actorAccount,
            inputAmount,
            networkId: walletNetworkChoice,
          });
          const nextNear =
            direction === 'near_to_respite'
              ? Math.max(0, Number((nearTestnetBalance - receipt.nearAmount).toFixed(4)))
              : Number((nearTestnetBalance + receipt.nearAmount).toFixed(4));
          const nextRespite =
            direction === 'near_to_respite'
              ? respiteBalance + receipt.respiteAmount
              : Math.max(0, respiteBalance - receipt.respiteAmount);

          setNearTestnetBalance(nextNear);
          setRespiteBalance(nextRespite);

          void syncPlayerBalancesToSupabase({
            nearAccountId: actorAccount,
            lulBalance: hud.gold,
            cyonBalance,
            respiteBalance: nextRespite,
          });
          void insertMarketTransactionReceipt({
            merchant_id: merchantLocation,
            actor_near_account: actorAccount,
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
          return receipt;
        }}
        caughtFishBucket={caughtFishBucket}
        fishMarketListings={fishMarketListings}
        playerNearAccount={
          hud.nearWalletId || nep171Ledger.ownerNearAccount || 'commander-p1.testnet'
        }
        onSellCaughtFish={(fish: CaughtFishItem) => {
          const actorAccount =
            hud.nearWalletId || nep171Ledger.ownerNearAccount || 'commander-p1.testnet';
          setCaughtFishBucket((prev) => prev.filter((f) => f.id !== fish.id));
          if (lastCaughtFishToast?.id === fish.id) setLastCaughtFishToast(null);
          dispatchBuddyAction(`adjustPlayerLul:${fish.sellValueLul}`);
          const nextLul = hud.gold + fish.sellValueLul;
          void syncPlayerBalancesToSupabase({
            nearAccountId: actorAccount,
            lulBalance: nextLul,
            cyonBalance,
            respiteBalance,
          });
          void insertMarketTransactionReceipt({
            merchant_id: 'beach_house',
            actor_near_account: actorAccount,
            action_type: 'sell_fish',
            item_id: fish.speciesId,
            currency: 'LUL',
            amount: fish.sellValueLul,
            unit_price: fish.sellValueLul,
            reasoning_summary: `Sold ${fish.speciesName} (${fish.weightKg} kg, ${fish.rarity}) to Kai for +${fish.sellValueLul} LUL.`,
          });
        }}
        onMintFishAsNft={(fish: CaughtFishItem) => {
          if (hud.gold < fish.mintFeeLul) return;
          const actorAccount =
            hud.nearWalletId || nep171Ledger.ownerNearAccount || 'commander-p1.testnet';
          const tokenSuffix = Math.floor(1000 + Math.random() * 9000);
          const nftTokenId = `nep171-fish-${fish.speciesId}-${tokenSuffix}`;
          const nearTxHash = `near-fish-mint-${Date.now().toString(36)}`;
          dispatchBuddyAction(`adjustPlayerLul:${-fish.mintFeeLul}`);
          const nextLul = Math.max(0, hud.gold - fish.mintFeeLul);
          setCaughtFishBucket((prev) =>
            prev.map((f) =>
              f.id === fish.id
                ? {
                    ...f,
                    isMintedNft: true,
                    nftTokenId,
                    nearTxHash,
                  }
                : f,
            ),
          );
          void syncPlayerBalancesToSupabase({
            nearAccountId: actorAccount,
            lulBalance: nextLul,
            cyonBalance,
            respiteBalance,
            ownedTokenIds: [...ownedMerchantItemIds, nftTokenId],
          });
          void insertMarketTransactionReceipt({
            merchant_id: 'beach_house',
            actor_near_account: actorAccount,
            action_type: 'mint_fish_nft',
            item_id: fish.speciesId,
            nep245_token_id: nftTokenId,
            currency: 'LUL',
            amount: fish.mintFeeLul,
            unit_price: fish.mintFeeLul,
            reasoning_summary: `Self-minted ${fish.speciesName} (${fish.weightKg} kg, ${fish.rarity}) into NFT ${nftTokenId} (-${fish.mintFeeLul} LUL fee).`,
            near_tx_hash: nearTxHash,
          });
        }}
        onListFishNftOnMarket={(fish: CaughtFishItem, priceLul: number) => {
          if (!fish.isMintedNft || !fish.nftTokenId) return;
          const actorAccount =
            hud.nearWalletId || nep171Ledger.ownerNearAccount || 'commander-p1.testnet';
          const newListing: FishNftMarketplaceListing = {
            listingId: `listing-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
            nftTokenId: fish.nftTokenId,
            speciesId: fish.speciesId,
            speciesName: fish.speciesName,
            waterZone: fish.waterZone,
            waterZoneLabel: fish.waterZoneLabel,
            rarity: fish.rarity,
            weightKg: fish.weightKg,
            colorHex: fish.colorHex,
            caughtByAccount: fish.caughtByAccount,
            sellerNearAccount: actorAccount,
            priceLul: Math.max(10, Math.round(priceLul)),
            nearTxHash: fish.nearTxHash || `near-list-${Date.now().toString(36)}`,
            listedAtIso: new Date().toISOString(),
          };
          setCaughtFishBucket((prev) => prev.filter((f) => f.id !== fish.id));
          setFishMarketListings((prev) => {
            const next = [newListing, ...prev];
            void syncFishMarketplaceListingsToSupabase({
              listings: next,
              transaction: {
                merchant_id: 'beach_house',
                actor_near_account: actorAccount,
                action_type: 'list_fish_nft',
                item_id: fish.speciesId,
                nep245_token_id: newListing.nftTokenId,
                currency: 'LUL',
                amount: newListing.priceLul,
                unit_price: newListing.priceLul,
                reasoning_summary: `${actorAccount} listed ${fish.speciesName} (${fish.weightKg} kg, ${fish.rarity}) on Kai's Marketplace for ${newListing.priceLul} LUL.`,
                near_tx_hash: newListing.nearTxHash,
              },
            });
            return next;
          });
        }}
        onBuyFishNftFromMarket={(listing: FishNftMarketplaceListing) => {
          const actorAccount =
            hud.nearWalletId || nep171Ledger.ownerNearAccount || 'commander-p1.testnet';
          const isOwnListing =
            listing.sellerNearAccount.toLowerCase() === actorAccount.toLowerCase();
          if (!isOwnListing && hud.gold < listing.priceLul) return;

          if (!isOwnListing) {
            dispatchBuddyAction(`adjustPlayerLul:${-listing.priceLul}`);
            const nextLul = Math.max(0, hud.gold - listing.priceLul);
            void syncPlayerBalancesToSupabase({
              nearAccountId: actorAccount,
              lulBalance: nextLul,
              cyonBalance,
              respiteBalance,
              ownedTokenIds: [...ownedMerchantItemIds, listing.nftTokenId],
            });
          }

          const reclaimedFish: CaughtFishItem = {
            id: `fish-nft-${Date.now()}`,
            speciesId: listing.speciesId,
            speciesName: listing.speciesName,
            waterZone: listing.waterZone,
            waterZoneLabel: listing.waterZoneLabel,
            rarity: listing.rarity,
            weightKg: listing.weightKg,
            sellValueLul: Math.max(25, Math.round(listing.priceLul * 0.6)),
            mintFeeLul: 0,
            colorHex: listing.colorHex,
            loreTag: `Acquired on Kai's P2P Fish Marketplace (Original Angler: ${listing.caughtByAccount}).`,
            caughtByAccount: listing.caughtByAccount,
            caughtAtIso: listing.listedAtIso,
            isMintedNft: true,
            nftTokenId: listing.nftTokenId,
            nearTxHash: listing.nearTxHash,
          };

          setCaughtFishBucket((prev) => [reclaimedFish, ...prev]);
          setFishMarketListings((prev) => {
            const next = prev.filter((l) => l.listingId !== listing.listingId);
            void syncFishMarketplaceListingsToSupabase({
              listings: next,
              transaction: {
                merchant_id: 'beach_house',
                actor_near_account: actorAccount,
                action_type: 'buy_fish_nft',
                item_id: listing.speciesId,
                nep245_token_id: listing.nftTokenId,
                currency: 'LUL',
                amount: isOwnListing ? 0 : listing.priceLul,
                unit_price: listing.priceLul,
                reasoning_summary: isOwnListing
                  ? `${actorAccount} unlisted ${listing.speciesName} (${listing.weightKg} kg) from Kai's Marketplace.`
                  : `${actorAccount} bought ${listing.speciesName} NFT (${listing.weightKg} kg) from ${listing.sellerNearAccount} for ${listing.priceLul} LUL.`,
                near_tx_hash: `near-trade-${Date.now().toString(36)}`,
              },
            });
            return next;
          });
        }}
      />

      {/* =====================================================================
          6. BUDDIES BLUEPRINT REPORT & ROBLOX STUDIO (LUAU) CODE MODAL
         ===================================================================== */}
      <BuddiesBlueprintModal
        isOpen={isBlueprintModalOpen}
        onClose={() => setIsBlueprintModalOpen(false)}
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
          // Accrue a 1.5 RESPITE royalty into the NEP-171 sub-account treasury on each build contract
          setNep171Ledger((prev) => {
            const updated = recordNep171SubAccountEarning(
              prev,
              1.5,
              `Kiosk Contract Royalty (${recipeId})`,
            );
            void syncGamepassNftLedgerToSupabase(updated);
            return updated;
          });
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
          dispatchBuddyAction('nearConnectAndMint');
          const account = hud.nearWalletId || nep171Ledger.ownerNearAccount || 'commander-p1.testnet';
          const mintedLedger = createInitialNep171SubAccountLedger(account, 'testnet');
          setNep171Ledger(mintedLedger);
          void syncGamepassNftLedgerToSupabase(mintedLedger);
        }}
        onNearClaimBasePlot={() => {
          dispatchBuddyAction('nearClaimBasePlot');
          const account = hud.nearWalletId || nep171Ledger.ownerNearAccount || 'commander-p1.testnet';
          const team = hud.nearKioskPlotTeam || hud.playerTeam || 'blue';
          const plotIdx = hud.nearKioskPlotIndex ?? 1;
          void syncBasePlotToSupabase({
            team,
            plotIndex: plotIdx,
            isClaimed: true,
            claimedByNearAccount: account,
            claimedByTokenId: nep171Ledger.tokenId,
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
          setIsInsidePrivateHouse(true);
          setActiveSpecialModal('none');
        }}
      />

      {/* =====================================================================
          8. FIXED-POOL TUNABLE PARTICLE EMITTER STUDIO PANEL
         ===================================================================== */}
      <ParticleEmitterPanel
        isOpen={isParticlePanelOpen}
        onClose={() => setIsParticlePanelOpen(false)}
        uiState={particleUiState}
        onChangeUiState={handleChangeParticleUiState}
        onTriggerBurst={(count) => dispatchBuddyAction(`particleEmitterBurst:${count}`)}
        onResetPool={() => dispatchBuddyAction('particleEmitterReset')}
        activeCount={hud.particlePoolActive ?? 0}
        poolCapacity={hud.particlePoolCapacity ?? 128}
        totalSpawns={hud.particleTotalSpawns ?? 0}
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
          const newMsg: ChatMessage = {
            id: `pub-${Date.now()}`,
            senderName: senderLabel,
            isSelf: true,
            text,
            timestamp: nowStr,
            type: 'public',
          };
          setChatMessages((prev) => [...prev, newMsg]);
          dispatchBuddyAction(`socialTalk:${text}`);
          void insertSocialChatMessageToSupabase({
            senderName: senderLabel,
            senderNearAccount: hud.nearWalletId || nep171Ledger.ownerNearAccount,
            message: text,
            bubbleColor: chatBubbleBgColor,
          });
        }}
        onSendPrivateChat={(recipient, text) => {
          const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const senderLabel = playerDisplayName || 'YOU';
          const newMsg: ChatMessage = {
            id: `priv-${Date.now()}`,
            senderName: senderLabel,
            recipientName: recipient.name,
            isSelf: true,
            text,
            timestamp: nowStr,
            type: 'private',
          };
          setChatMessages((prev) => [...prev, newMsg]);
          dispatchBuddyAction(`socialTalk:[Whisper @${recipient.name}] ${text}`);
          void insertSocialChatMessageToSupabase({
            senderName: senderLabel,
            senderNearAccount: hud.nearWalletId || nep171Ledger.ownerNearAccount,
            recipientName: recipient.name,
            message: text,
            bubbleColor: chatBubbleBgColor,
          });

          // If whispering an NPC, simulate interactive NPC response
          if (recipient.isNpc) {
            window.setTimeout(() => {
              const replies = [
                `Hello Buddy! So glad to chat with you!`,
                `Our kiosk is always ready for currency exchanges and home decor!`,
                `Have a great time and enjoy your day in the city!`,
              ];
              const replyText = replies[Math.floor(Math.random() * replies.length)];
              const replyMsg: ChatMessage = {
                id: `npc-reply-${Date.now()}`,
                senderName: recipient.name,
                recipientName: 'YOU',
                isNpc: true,
                text: replyText,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: 'private',
              };
              setChatMessages((prev) => [...prev, replyMsg]);
            }, 600);
          }
        }}
      />

      {/* =====================================================================
          9B. LEFT-SLIDE TELEPORT KIOSK MODAL
         ===================================================================== */}
      <aside
        role="dialog"
        aria-modal="false"
        aria-hidden={activeTeleportKioskModal === 'none'}
        aria-label="Teleport Kiosk"
        data-teleport-kiosk-modal={activeTeleportKioskModal}
        className={`fixed left-4 top-16 bottom-20 z-40 w-full max-w-lg flex flex-col select-none transition-all duration-300 ease-out transform ${
          activeTeleportKioskModal !== 'none'
            ? 'translate-x-0 opacity-100 pointer-events-auto'
            : '-translate-x-[120%] opacity-0 pointer-events-none'
        }`}
      >
        <div className="relative bg-white border-[3.5px] border-black shadow-[4px_4px_0px_#000] p-5 text-black">
          <div className="flex items-center justify-between gap-2 pb-3 border-b-[2.5px] border-black">
            <div>
              <div className="-skew-x-6 inline-block px-2.5 py-0.5 bg-[#facc15] border-2 border-black shadow-[2px_2px_0px_#000] text-[10px] font-black uppercase">
                <span className="skew-x-6 inline-block">TELEPORT TERMINAL</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight mt-1.5 text-black">
                {activeTeleportKioskModal === 'lobby_warzone'
                  ? 'WARZONE ARENA'
                  : activeTeleportKioskModal === 'lobby_safezone'
                  ? 'SAFEZONE CITY'
                  : 'LOBBY PLAZA'}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                setActiveTeleportKioskModal('none');
                window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
              }}
              aria-label="Close Teleport Kiosk"
              className="-skew-x-6 w-8 h-8 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black shadow-[3px_3px_0px_#000] font-black text-xs flex items-center justify-center cursor-pointer active:scale-95"
            >
              <span className="skew-x-6 inline-block">X</span>
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {activeTeleportKioskModal === 'lobby_warzone' && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  data-lobby-portal-floating-btn="red"
                  onClick={() => {
                    soundEngine.playUiClick();
                    handleRequestWorldModeChange('warzone', 'red');
                  }}
                  className="-skew-x-6 py-3 px-4 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black shadow-[3px_3px_0px_#000] font-black text-sm uppercase tracking-wider cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                >
                  <span className="skew-x-6 inline-block">RED TEAM</span>
                </button>
                <button
                  type="button"
                  data-lobby-portal-floating-btn="blue"
                  onClick={() => {
                    soundEngine.playUiClick();
                    handleRequestWorldModeChange('warzone', 'blue');
                  }}
                  className="-skew-x-6 py-3 px-4 bg-[#00a8ff] hover:bg-[#38bdf8] text-white border-2 border-black shadow-[3px_3px_0px_#000] font-black text-sm uppercase tracking-wider cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                >
                  <span className="skew-x-6 inline-block">BLUE TEAM</span>
                </button>
              </div>
            )}

            {activeTeleportKioskModal === 'lobby_safezone' && (
              <button
                type="button"
                data-lobby-portal-floating-btn="enter-city"
                onClick={() => {
                  soundEngine.playUiClick();
                  handleRequestWorldModeChange('safezone');
                }}
                className="-skew-x-6 w-full py-3 px-4 bg-[#10b981] hover:bg-[#34d399] text-black border-2 border-black shadow-[3px_3px_0px_#000] font-black text-sm uppercase tracking-wider cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              >
                <span className="skew-x-6 inline-block">ENTER CITY (SAFEZONE CITY)</span>
              </button>
            )}

            {activeTeleportKioskModal === 'halte_to_lobby' && (
              <button
                type="button"
                data-lobby-tram-floating-btn="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  handleRequestWorldModeChange('lobby');
                }}
                className="-skew-x-6 w-full py-3 px-4 bg-[#facc15] hover:bg-[#fde047] text-black border-2 border-black shadow-[3px_3px_0px_#000] font-black text-sm uppercase tracking-wider cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              >
                <span className="skew-x-6 inline-block">TO LOBBY</span>
              </button>
            )}
          </div>
        </div>
      </aside>

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
            <div className="-skew-x-6 px-3.5 py-1 bg-[#facc15] border-2 border-black shadow-[3px_3px_0px_#000] text-xs font-black uppercase flex items-center gap-2">
              <div className="skew-x-6 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                <span>PERSONAL WALLET &amp; NEAR SUB-ACCOUNT</span>
              </div>
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
            {/* Live Supabase + NEAR Testnet RPC Status Pills */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 text-[9.5px] font-black uppercase">
              <span
                data-supabase-status-badge="true"
                className={`px-2 py-0.5 border-2 border-black shadow-[2px_2px_0_#000] ${
                  supabaseConnected ? 'bg-[#10b981] text-black' : 'bg-[#facc15] text-black'
                }`}
              >
                {supabaseConnected ? '● SUPABASE DB LIVE (ichkymzdwzgdtpptrsvr)' : '● SUPABASE READY'}
              </span>
              <a
                href={getNearBlocksAccountUrl(nep171Ledger.ownerNearAccount, nep171Ledger.network)}
                target="_blank"
                rel="noreferrer"
                className="px-2 py-0.5 bg-[#0f172a] text-[#38bdf8] border-2 border-black shadow-[2px_2px_0_#000] hover:underline"
              >
                NEAR {nearRpcStatus?.networkId?.toUpperCase() || 'TESTNET'} · BLOCK #
                {nearRpcStatus?.latestBlockHeight?.toLocaleString() || '184,920,415'} ↗
              </a>
            </div>

            {/* PLAYER UID (WALLET ADDRESS) & CHANGE USERNAME ANYTIME */}
            <div
              data-wallet-uid-and-username-card="true"
              className="p-3 bg-[#1e293b] text-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-[#b8ff3c]">
                    PLAYER UID (NEAR WALLET ADDRESS)
                  </div>
                  <div
                    data-wallet-active-uid="true"
                    className="text-xs font-mono font-black text-[#38bdf8] break-all"
                  >
                    {hud.nearWalletId || playerUid}
                  </div>
                </div>
                <button
                  type="button"
                  data-switch-or-disconnect-wallet-btn="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    disconnectNearWalletSession();
                    setIsPersonalWalletModalOpen(false);
                    setOnboardingStep('auth_choice');
                  }}
                  className="-skew-x-6 px-2.5 py-1 bg-[#ff3b30] hover:bg-[#ff554a] text-white font-black text-[9.5px] uppercase border-2 border-black shadow-[2px_2px_0_#000] cursor-pointer shrink-0"
                >
                  <span className="skew-x-6 inline-block">SWITCH WALLET</span>
                </button>
              </div>

              {nearOnChainAccountView && (
                <div className="flex items-center justify-between text-[9.5px] font-bold bg-black/40 px-2 py-1 border border-white/15">
                  <span
                    className={
                      nearOnChainAccountView.existsOnChain ? 'text-[#10b981]' : 'text-[#facc15]'
                    }
                  >
                    {nearOnChainAccountView.existsOnChain
                      ? `● ON-CHAIN VERIFIED (${nearOnChainAccountView.balanceNearFormatted})`
                      : `● NEAR ${nearOnChainAccountView.networkId.toUpperCase()} ACCOUNT`}
                  </span>
                  <a
                    href={nearOnChainAccountView.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#38bdf8] hover:underline font-mono"
                  >
                    NearBlocks ↗
                  </a>
                </div>
              )}

              <div className="pt-1.5 border-t border-white/15 space-y-1">
                <div className="text-[10px] font-black uppercase text-white/90">
                  DISPLAY USERNAME (CHANGE ANYTIME)
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    maxLength={24}
                    data-wallet-change-username-input="true"
                    value={walletUsernameDraft}
                    onChange={(e) => setWalletUsernameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && walletUsernameDraft.trim()) {
                        soundEngine.playUiClick();
                        handleUpdatePlayerUsername(walletUsernameDraft);
                        setWalletUsernameSavedToast(true);
                        window.setTimeout(() => setWalletUsernameSavedToast(false), 1800);
                      }
                    }}
                    placeholder="Enter new username..."
                    aria-label="Change Display Username"
                    className="flex-1 min-w-0 px-2.5 py-1.5 bg-white text-black font-bold text-xs border-2 border-black"
                  />
                  <button
                    type="button"
                    data-wallet-save-username-btn="true"
                    onClick={() => {
                      if (!walletUsernameDraft.trim()) return;
                      soundEngine.playUiClick();
                      handleUpdatePlayerUsername(walletUsernameDraft);
                      setWalletUsernameSavedToast(true);
                      window.setTimeout(() => setWalletUsernameSavedToast(false), 1800);
                    }}
                    className="-skew-x-6 px-3 py-1.5 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black font-black text-[10px] uppercase border-2 border-black shadow-[2px_2px_0_#000] cursor-pointer shrink-0"
                  >
                    <span className="skew-x-6 inline-block">
                      {walletUsernameSavedToast ? 'SAVED ✓' : 'SAVE NAME'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Social / Email Zero-Popup Login (Track: games) */}
            <div
              data-social-login-box="true"
              className="p-3 bg-slate-100 border-2 border-black shadow-[3px_3px_0px_#000] space-y-2"
            >
              <div className="text-[10.5px] font-black uppercase text-slate-900">
                FRICTIONLESS SOCIAL / EMAIL LOGIN (ZERO SEED PHRASES OR GAS POPUPS)
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={socialLoginInput}
                  onChange={(e) => setSocialLoginInput(e.target.value)}
                  placeholder="commander@near.org"
                  aria-label="Social or Email Login"
                  className="flex-1 min-w-0 px-2.5 py-1.5 bg-white border-2 border-black text-xs font-bold text-black"
                />
                <button
                  type="button"
                  data-social-login-submit="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    const derived = deriveSocialInvisibleNearAccount(socialLoginInput, 'testnet');
                    dispatchBuddyAction('nearConnectAndMint');
                    const nextLedger = createInitialNep171SubAccountLedger(
                      derived.accountId,
                      'testnet',
                    );
                    setNep171Ledger(nextLedger);
                    setHud((prev) => ({
                      ...prev,
                      nearWalletConnected: true,
                      nearWalletId: derived.accountId,
                      nearHasGamepassNft: true,
                      nearGamepassTokenId: nextLedger.tokenId,
                    }));
                    persistWalletProfileLocally(
                      derived.accountId,
                      playerDisplayName || derived.displayName,
                      characterGender,
                    );
                    setTransferAuditBanner(
                      `Social Login active: ${derived.accountId} provisioned with gasless session key (${derived.sessionPublicKey.slice(0, 22)}...).`,
                    );
                    void fetchOrCreatePlayerProfile({
                      nearAccountId: derived.accountId,
                      displayName: playerDisplayName || derived.displayName,
                      authMode: 'social_invisible',
                      email: socialLoginInput,
                    }).then((profile) => {
                      if (profile) {
                        setSupabaseConnected(true);
                        setCyonBalance(profile.cyon_balance);
                        setRespiteBalance(profile.respite_balance);
                        void syncPlayerBalancesToSupabase({
                          nearAccountId: derived.accountId,
                          lulBalance: hud.gold,
                          cyonBalance: profile.cyon_balance,
                          respiteBalance: profile.respite_balance,
                          unlockedSkins: ['default', `gender:${characterGender}`],
                        });
                      }
                    });
                    void syncGamepassNftLedgerToSupabase(nextLedger);
                  }}
                  className="-skew-x-6 px-3 py-1.5 bg-[#10b981] hover:bg-[#34d399] text-black font-black text-[10px] uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer shrink-0"
                >
                  <span className="skew-x-6 inline-block">SOCIAL SIGN-IN</span>
                </button>
              </div>
            </div>

            {/* NEAR Wallet Status Box */}
            <div className="p-3 bg-[#0f172a] text-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10.5px] font-black uppercase text-[#38bdf8]">
                  NEAR PROTOCOL WALLET SELECTOR
                </div>
                <div className="text-[10px] font-bold text-white/85 mt-0.5 truncate">
                  {hud.nearWalletConnected
                    ? `Connected (${hud.nearWalletId ?? nep171Ledger.ownerNearAccount}) · ${nearTestnetBalance.toFixed(2)} NEAR`
                    : `Active Account: ${nep171Ledger.ownerNearAccount}`}
                </div>
              </div>
              <button
                type="button"
                data-personal-wallet-open-selector-btn="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  setIsNearWalletSelectorOpen(true);
                }}
                className="-skew-x-6 px-2.5 py-1.5 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black font-black text-[10px] uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer shrink-0"
              >
                <span className="skew-x-6 inline-block">
                  {hud.nearWalletConnected ? 'WALLET SELECTOR' : 'CONNECT WALLET'}
                </span>
              </button>
            </div>

            {/* 3 Personal Currency Balances (Redefined: LUL & CYON = Non-Crypto; RESPITE = NEAR NEP-141 Crypto Coin) */}
            <div className="space-y-2">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                YOUR CURRENCY BALANCES (NON-CRYPTO &amp; NEAR CRYPTO)
              </div>

              <div className="p-3 bg-slate-50 border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between">
                <div>
                  <div className="text-xs font-black uppercase text-black">
                    LUL (LULLING · NON-CRYPTO)
                  </div>
                  <div className="text-[10px] font-bold text-slate-600">
                    Earned from Fishing &amp; Warzone mini-games · Exchangeable to CYON
                  </div>
                </div>
                <div className="-skew-x-6 px-3 py-1 bg-[#fec83e] text-black border-2 border-black shadow-[2px_2px_0_#000] font-black text-sm">
                  <span className="skew-x-6 inline-block">{hud.gold} LUL</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between">
                <div>
                  <div className="text-xs font-black uppercase text-black">
                    CYON (HALCYON · NON-CRYPTO)
                  </div>
                  <div className="text-[10px] font-bold text-slate-600">
                    Obtained from LUL → CYON exchange · For Outfits &amp; Non-NFT items
                  </div>
                </div>
                <div className="-skew-x-6 px-3 py-1 bg-[#38bdf8] text-black border-2 border-black shadow-[2px_2px_0_#000] font-black text-sm">
                  <span className="skew-x-6 inline-block">{cyonBalance} CYON</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between">
                <div>
                  <div className="text-xs font-black uppercase text-black">
                    RESPITE (NEAR NEP-141 SMART CONTRACT COIN)
                  </div>
                  <div className="text-[10px] font-bold text-slate-600">
                    Crypto coin on NEAR Protocol · Swapped via NEAR Testnet ↔ RESPITE
                  </div>
                </div>
                <div className="-skew-x-6 px-3 py-1 bg-[#d8b4fe] text-black border-2 border-black shadow-[2px_2px_0_#000] font-black text-sm">
                  <span className="skew-x-6 inline-block">{respiteBalance} RESPITE</span>
                </div>
              </div>
            </div>

            {/* NEP-171 Programmable Gamepass Sub-Account & History Ledger (Track: nfts) */}
            <div
              data-nep171-subaccount-ledger="true"
              className="p-3 bg-[#1e1b4b] text-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase text-[#facc15]">
                  ⚡ NEP-171 NFT SUB-ACCOUNT &amp; HISTORY LEDGER
                </span>
                <span className="px-2 py-0.5 bg-[#d8b4fe] text-black font-black text-[9px] uppercase border border-black">
                  {nep171Ledger.tokenId}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="p-1.5 bg-black/40 border border-white/20">
                  <div className="text-[9px] font-bold text-white/70">SUB-ACCOUNT</div>
                  <div className="text-[10px] font-black text-[#38bdf8] truncate">
                    {nep171Ledger.subAccountId}
                  </div>
                </div>
                <div className="p-1.5 bg-black/40 border border-white/20">
                  <div className="text-[9px] font-bold text-white/70">TREASURY</div>
                  <div className="text-[10px] font-black text-[#10b981]">
                    {nep171Ledger.treasuryRespite} RESPITE
                  </div>
                </div>
                <div className="p-1.5 bg-black/40 border border-white/20">
                  <div className="text-[9px] font-bold text-white/70">EARNED / PAID</div>
                  <div className="text-[10px] font-black text-[#facc15]">
                    {nep171Ledger.totalEarnedRespite} / {nep171Ledger.totalPaidOutRespite}
                  </div>
                </div>
              </div>

              <div className="text-[9.5px] font-mono text-white/80 bg-black/35 p-1.5 border border-white/15 truncate">
                Active Key: {nep171Ledger.activeAccessKey}
              </div>

              {/* Per-NFT Ownership & Payout History View */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-black uppercase text-[#38bdf8]">
                  PER-NFT OWNERSHIP, EARNINGS &amp; PAYOUT HISTORY
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-0.5">
                  {nep171Ledger.ownershipHistory.map((item, idx) => (
                    <div
                      key={`${item.owner}-${idx}`}
                      className="p-2 bg-black/45 border border-white/20 text-[9.5px] space-y-0.5"
                    >
                      <div className="flex items-center justify-between font-black">
                        <span className="text-[#facc15]">{item.owner}</span>
                        <span className="text-white/70">
                          {item.transferredAt ? 'PAST HOLDER' : 'CURRENT HOLDER'}
                        </span>
                      </div>
                      <div className="text-white/85 font-bold">
                        Earned: <span className="text-[#10b981]">+{item.earnedRespite} RESPITE</span> ·
                        Paid Out: <span className="text-[#38bdf8]">{item.paidOutRespite} RESPITE</span>
                      </div>
                      <div className="text-white/70">{item.note}</div>
                      <a
                        href={getNearBlocksTxUrl(item.txHash, nep171Ledger.network)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-[#38bdf8] hover:underline font-mono text-[8.5px]"
                      >
                        Tx: {item.txHash.slice(0, 20)}... ↗
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {/* Atomic NFT + Sub-Account Transfer (Mid-Payout Sale Verification) */}
              <div className="pt-2 border-t border-white/20 space-y-1.5">
                <div className="text-[10px] font-black uppercase text-[#facc15]">
                  ATOMIC NFT TRANSFER (REVOKES SELLER KEY &amp; MOVES SUB-ACCOUNT)
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={transferBuyerInput}
                    onChange={(e) => setTransferBuyerInput(e.target.value)}
                    placeholder="buyer-omega.testnet"
                    aria-label="New Buyer NEAR Account"
                    className="flex-1 min-w-0 px-2 py-1 bg-white text-black font-bold text-xs border-2 border-black"
                  />
                  <button
                    type="button"
                    data-atomic-nft-transfer-btn="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      try {
                        const result = executeAtomicNep171SubAccountTransfer({
                          ledger: nep171Ledger,
                          callerAccount: nep171Ledger.ownerNearAccount,
                          newOwnerAccount: transferBuyerInput,
                          inFlightPayoutRespite: 4.5,
                        });
                        setNep171Ledger(result.updatedLedger);
                        setHud((prev) => ({
                          ...prev,
                          nearWalletConnected: true,
                          nearWalletId: result.newOwner,
                          nearHasGamepassNft: true,
                          nearGamepassTokenId: result.updatedLedger.tokenId,
                        }));
                        setTransferAuditBanner(result.securityAuditNote);
                        void syncGamepassNftLedgerToSupabase(result.updatedLedger);
                        void insertMarketTransactionReceipt({
                          actor_near_account: result.newOwner,
                          action_type: 'transfer_gamepass',
                          nep245_token_id: result.updatedLedger.tokenId,
                          currency: 'RESPITE',
                          amount: result.transferredTreasuryToBuyer,
                          unit_price: result.settledMidSalePayoutToSeller,
                          reasoning_summary: result.securityAuditNote,
                          near_tx_hash: result.txHash,
                        });
                      } catch (err) {
                        setTransferAuditBanner(
                          err instanceof Error ? err.message : 'Transfer rejected',
                        );
                      }
                    }}
                    className="-skew-x-6 px-2.5 py-1 bg-[#facc15] hover:bg-[#fde047] text-black font-black text-[9.5px] uppercase border-2 border-black shadow-[2px_2px_0_#000] cursor-pointer shrink-0"
                  >
                    <span className="skew-x-6 inline-block">TRANSFER NFT</span>
                  </button>
                </div>
                {transferAuditBanner && (
                  <div
                    data-transfer-audit-banner="true"
                    className="p-2 bg-black/60 border border-[#10b981] text-[#10b981] text-[9.5px] font-bold"
                  >
                    {transferAuditBanner}
                  </div>
                )}
              </div>
            </div>
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
      {selectedTargetUser && !isProfileModalOpen && !isSocialChatModalOpen && activeSpecialModal === 'none' && (
        <aside
          aria-label={`Target: ${selectedTargetUser.name}`}
          className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1.5 pointer-events-auto select-none"
        >
          {/* Top Section: Compact Action Buttons (Only Shown When Black Name Bar is Clicked / Expanded) */}
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
                <div className="flex flex-col gap-1.5 mb-0.5">
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
                    className="-skew-x-6 w-40 py-1.5 px-3 bg-[#38bdf8] hover:bg-[#7dd3fc] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-black font-black uppercase text-xs tracking-wider transition-all cursor-pointer"
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
                    className="-skew-x-6 w-40 py-1.5 px-3 bg-[#facc15] hover:bg-[#fde047] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-black font-black uppercase text-xs tracking-wider transition-all cursor-pointer"
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
              <div className="flex flex-col gap-1.5 mb-0.5">
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
                  className="-skew-x-6 w-40 py-1.5 px-3 bg-[#facc15] hover:bg-[#fde047] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-black font-black uppercase text-xs tracking-wider transition-all cursor-pointer"
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
                    setProfileTargetUser(selectedTargetUser);
                    setIsProfileModalOpen(true);
                  }}
                  className="-skew-x-6 w-40 py-1.5 px-3 bg-[#38bdf8] hover:bg-[#7dd3fc] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-black font-black uppercase text-xs tracking-wider transition-all cursor-pointer"
                >
                  <div className="skew-x-6 flex items-center justify-center gap-2 w-full">
                    <User className="w-3.5 h-3.5 text-black stroke-[2.5] shrink-0" aria-hidden="true" />
                    <span>Profile</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setIsTargetMenuExpanded(false);
                    setIsKioskModalOpen(false);
                    setIsPersonalWalletModalOpen(false);
                    setActiveSpecialModal('none');
                    setActiveTeleportKioskModal('none');
                    window.dispatchEvent(new CustomEvent('close-teleport-kiosk-ui'));
                    setSelectedPrivateUser(selectedTargetUser);
                    setIsSocialChatModalOpen(true);
                  }}
                  className="-skew-x-6 w-40 py-1.5 px-3 bg-[#10b981] hover:bg-[#34d399] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-black font-black uppercase text-xs tracking-wider transition-all cursor-pointer"
                >
                  <div className="skew-x-6 flex items-center justify-center gap-2 w-full">
                    <MessageCircle className="w-3.5 h-3.5 text-black stroke-[2.5] shrink-0" aria-hidden="true" />
                    <span>Whisper</span>
                  </div>
                </button>
              </div>
            );
          })()}

          {/* Bottom Section: Black Character Selector Bar (Click to Toggle Action Menu) */}
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
            title="Click this name bar to show action buttons"
            className="-skew-x-6 w-56 h-10 bg-[#12151c] hover:bg-[#1e2330] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between px-2 text-white cursor-pointer transition-colors"
          >
            <div className="skew-x-6 flex items-center justify-between w-full">
              {/* Circular framed avatar on the left */}
              <div className="w-7 h-7 rounded-full border-2 border-black overflow-hidden flex items-center justify-center bg-slate-800 shrink-0 text-[10px] font-black shadow-[1px_1px_0_#000]">
                {selectedTargetUser.name.toLowerCase().includes('hana') ||
                selectedTargetUser.name.toLowerCase().includes('nadia') ? (
                  <img src="/assets/avatar_nadia.jpg" alt={selectedTargetUser.name} className="w-full h-full object-cover" />
                ) : selectedTargetUser.isNpc ? (
                  <img src="/assets/avatar_hiro.jpg" alt={selectedTargetUser.name} className="w-full h-full object-cover" />
                ) : (
                  <span>{selectedTargetUser.name.slice(0, 1).toUpperCase()}</span>
                )}
              </div>

              {/* Character Name in the center */}
              <span className="text-xs font-black uppercase tracking-wider text-center px-1.5 text-white">
                {selectedTargetUser.name.replace(/\s*\((ANDA|YOU)\)/i, '')}
              </span>

              {/* ChevronRight (>) button on the right to cycle nearest player target */}
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
                title="Switch Nearest Player Target"
                aria-label="Next Target"
                className="w-6 h-6 flex items-center justify-center bg-[#facc15] hover:bg-[#fde047] border-2 border-black shadow-[1px_1px_0_#000] cursor-pointer transition-transform active:scale-95 text-black shrink-0"
              >
                <ChevronRight className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Titik Indikator (Pagination Dots) Kecil di Bawahnya */}
          {(() => {
            const list =
              hud.nearbyRadiusUsers && hud.nearbyRadiusUsers.length > 0
                ? hud.nearbyRadiusUsers
                : [selectedTargetUser];
            const currentIdx = Math.max(
              0,
              list.findIndex((u) => String(u.id) === String(selectedTargetUser.id)),
            );
            const displayDots = list.slice(0, 5);
            return (
              <div className="flex items-center gap-1.5 mt-0.5">
                {displayDots.map((u, idx) => (
                  <span
                    key={String(u.id)}
                    className={`transition-all ${
                      currentIdx === idx ? 'w-3 h-1.5 bg-[#facc15] border border-black shadow-[1px_1px_0_#000]' : 'w-1.5 h-1.5 bg-white/40'
                    }`}
                  />
                ))}
              </div>
            );
          })()}
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
        lulBalance={hud.gold}
        cyonBalance={cyonBalance}
        respiteBalance={respiteBalance}
        playerUid={hud.nearWalletId || playerUid}
        onChangePlayerName={handleUpdatePlayerUsername}
        onStartWhisper={(user) => {
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
          gameState === 'playing' &&
          !isFullMapOverview &&
          onboardingStep === 'completed' &&
          playMode !== 'editor'
        }
        isModalBlocking={
          isKioskModalOpen ||
          isProfileModalOpen ||
          isPersonalWalletModalOpen ||
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
        networkId={walletNetworkChoice}
        onChangeNetworkId={setWalletNetworkChoice}
        currentWalletId={hud.nearWalletId || playerUid}
        nearTestnetBalance={nearTestnetBalance}
        respiteBalance={respiteBalance}
        onConnectAccountId={async (accountId) => {
          await handleConnectWalletAndEnterLobby(accountId);
        }}
      />
    </main>
  );
}
