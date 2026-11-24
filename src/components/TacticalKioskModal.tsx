import React, { useEffect, useRef, useState } from 'react';
import {
  KIOSK_BUILD_PRIORITY_RECIPES,
  KioskBuildPriorityRecipeId,
  KioskBaseGoldUpgradeId,
  WorldCrateKind,
  MAX_KIOSK_BUILD_QUEUE,
  evaluateNuclearLauncherAccess,
  evaluateClusterBombAccess,
  SafezonePlotAccessMode,
  type HouseArchitectureStyle,
} from '../game/buddiesBlitzRules';
import { HudSnapshot } from '../game/BuddiesBlitzArena';
import { soundEngine } from '../game/audio';

interface TacticalKioskModalProps {
  isOpen: boolean;
  onClose: () => void;
  hud: HudSnapshot;
  onSelectRecipe: (recipeId: KioskBuildPriorityRecipeId) => void;
  onRemoveQueueIndex?: (index: number) => void;
  onClearQueue?: () => void;
  onUpgradeBase: (upgradeId: KioskBaseGoldUpgradeId) => void;
  onBuyCrateAirdrop: (crateKind: WorldCrateKind) => void;
  onNearConnectAndMint?: () => void;
  onNearClaimBasePlot?: () => void;
  ownedHouseStyles?: HouseArchitectureStyle[];
  onNearClaimBasePlotWithStyle?: (style: HouseArchitectureStyle) => void;
  onNearReleaseBasePlot?: () => void;
  onSetSafezoneAccessMode?: (mode: SafezonePlotAccessMode) => void;
  onAddSafezoneFriend?: (friendId: string) => void;
  onRemoveSafezoneFriend?: (friendId: string) => void;
  onEnterPrivateHouseInterior?: () => void;
  onOpenHouseCatalog?: () => void;
  onOpenPersonalWallet?: () => void;
}

type KioskPageIndex = 0 | 1 | 2 | 3 | 4;
type KioskCrestVariant = KioskPageIndex | 'claim' | 'safezone';

type KioskCardIllustrationId =
  | 'ar99_rifle'
  | 'p12_handgun'
  | 'vx20_bazooka'
  | 'skyshield_turret'
  | 'st01_minitank'
  | 'ht88_dump_truck'
  | 'af9_plane'
  | 'street_rookie'
  | 't800_cyborg'
  | 'shinobi_infiltrator'
  | 'tactical_veteran'
  | 'hq_super_command'
  | 'hq_tactical_comms'
  | 'lg88_laser_rifle'
  | 'nuclear_launcher'
  | 'titan6_gatling'
  | 'hg04_grenade'
  | 'tm89_mine'
  | 'cb24_cluster';

interface KioskGridCardItem {
  id: string;
  title: string;
  tagLine: string;
  illustration: KioskCardIllustrationId;
  actionKind: 'recipe' | 'upgrade_base' | 'buy_crate';
  recipeId?: KioskBuildPriorityRecipeId;
  upgradeId?: KioskBaseGoldUpgradeId;
  crateKind?: WorldCrateKind;
  inspectDetail: string;
  isSilhouetteLocked?: boolean;
}

function renderShieldCrestSvg(variant: KioskCrestVariant) {
  const innerFill =
    variant === 0 || variant === 2
      ? '#f4f6f8'
      : variant === 1
      ? '#2e332b'
      : variant === 3
      ? '#1e293b'
      : variant === 'claim'
      ? '#0f172a'
      : variant === 'safezone'
      ? '#064e3b'
      : '#262b30';

  const isLightInner = variant === 0 || variant === 2;

  return (
    <svg
      viewBox="0 0 96 108"
      className="w-10 h-11 drop-shadow-md select-none shrink-0"
    >
      {/* Outer Black Shield Silhouette */}
      <path
        d="M48 3 L88 17 L88 50 C88 77 69 95 48 105 C27 95 8 77 8 50 L8 17 Z"
        fill="#0d0f12"
      />
      {/* Metallic Olive-Drab Bezel */}
      <path
        d="M48 8 L83 20 L83 49 C83 73 66 89 48 99 C30 89 13 73 13 49 L13 20 Z"
        fill="#595e48"
        stroke="#0d0f12"
        strokeWidth="2.5"
      />
      {/* Left Highlight Bevel on Shield Rim */}
      <path
        d="M48 8 L13 20 L13 49 C13 73 30 89 48 99 L48 90 C34 81 21 67 21 49 L21 25 L48 15 Z"
        fill="#757b62"
      />
      {/* Corner Notch Rivets */}
      <rect x="45" y="7" width="6" height="5" fill="#0d0f12" />
      <rect x="12" y="44" width="5" height="6" fill="#0d0f12" />
      <rect x="79" y="44" width="5" height="6" fill="#0d0f12" />

      {/* Inner Shield Face */}
      <path
        d="M48 16 L75 26 L75 49 C75 68 61 81 48 89 C35 81 21 68 21 49 L21 26 Z"
        fill={innerFill}
        stroke="#0d0f12"
        strokeWidth="3"
      />
      {/* Subtle Right-Side Inner Shadow */}
      <path
        d="M48 16 L75 26 L75 49 C75 68 61 81 48 89 Z"
        fill={isLightInner ? 'rgba(160,172,184,0.38)' : 'rgba(0,0,0,0.28)'}
      />

      {variant === 'claim' && (
        /* Pre-Claim State: Command Base Beacon & NEAR Uplink Crest */
        <g stroke="#0d0f12" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
          <polygon points="48,26 67,44 60,44 60,67 36,67 36,44 29,44" fill="#b8ff3c" />
          <rect x="43" y="51" width="10" height="16" fill="#0f172a" />
          <circle cx="48" cy="41" r="4.5" fill="#38bdf8" />
        </g>
      )}

      {variant === 'safezone' && (
        /* Safezone State: Sanctuary Perimeter Gate Shield Crest */
        <g stroke="#0d0f12" strokeWidth="2.2" strokeLinejoin="round">
          <path
            d="M48 27 L65 34 L65 50 C65 61 57 69 48 74 C39 69 31 61 31 50 L31 34 Z"
            fill="#10b981"
          />
          <circle cx="48" cy="46" r="5" fill="#f4f6f8" />
          <path d="M45 50 L51 50 L53 61 L43 61 Z" fill="#f4f6f8" />
        </g>
      )}

      {variant === 0 && (
        /* Page 0: WEAPON ARMORY Crosshair Reticle Crest */
        <g stroke="#0d0f12" strokeLinecap="round">
          <circle cx="48" cy="51" r="19" fill="none" strokeWidth="3.5" />
          <circle cx="48" cy="51" r="8" fill="#2bb3b1" strokeWidth="2.6" />
          <circle cx="48" cy="51" r="3" fill="#0d0f12" stroke="none" />
          <line x1="48" y1="25" x2="48" y2="40" strokeWidth="3.8" />
          <line x1="48" y1="62" x2="48" y2="77" strokeWidth="3.8" />
          <line x1="22" y1="51" x2="37" y2="51" strokeWidth="3.8" />
          <line x1="59" y1="51" x2="74" y2="51" strokeWidth="3.8" />
        </g>
      )}

      {variant === 1 && (
        /* Page 1: VEHICLE HANGAR Winged Military Tank Crest */
        <g stroke="#0d0f12" strokeWidth="2.2" strokeLinejoin="round">
          <path
            d="M44 50 L14 36 L19 44 L15 48 L23 53 L19 57 L42 58 Z"
            fill="#cfd6dc"
          />
          <path
            d="M52 50 L82 36 L77 44 L81 48 L73 53 L77 57 L54 58 Z"
            fill="#aab4bd"
          />
          <rect x="39" y="40" width="18" height="8" rx="2" fill="#768557" />
          <rect x="48" y="42" width="20" height="4" rx="1" fill="#768557" />
          <polygon points="31,48 65,48 69,55 27,55" fill="#8ca063" />
          <rect x="29" y="55" width="38" height="8" rx="4" fill="#3a3f45" />
          <circle cx="35" cy="59" r="2" fill="#cfd6dc" />
          <circle cx="43" cy="59" r="2" fill="#cfd6dc" />
          <circle cx="52" cy="59" r="2" fill="#cfd6dc" />
          <circle cx="60" cy="59" r="2" fill="#cfd6dc" />
        </g>
      )}

      {variant === 2 && (
        /* Page 2: BASE UPGRADE Double-Chevron Command Rank Crest */
        <g stroke="#0d0f12" strokeWidth="2.4" strokeLinejoin="round">
          <polygon
            points="48,26 70,41 70,51 48,37 26,51 26,41"
            fill="#b8ab83"
          />
          <polygon
            points="48,26 26,41 26,51 48,37"
            fill="#d2c69e"
          />
          <polygon
            points="48,43 70,58 70,68 48,54 26,68 26,58"
            fill="#b8ab83"
          />
          <polygon
            points="48,43 26,58 26,68 48,54"
            fill="#d2c69e"
          />
          <polygon
            points="48,60 64,70 48,80 32,70"
            fill="#f5b82e"
          />
        </g>
      )}

      {variant === 3 && (
        /* Page 3: DEFENSE & ORDNANCE Twin-Barrel Skyshield C-RAM Turret & Bastion Crest */
        <g stroke="#0d0f12" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
          {/* Twin Elevated C-RAM Barrels */}
          <line x1="45" y1="45" x2="66" y2="29" stroke="#f4f6f8" strokeWidth="4.5" />
          <line x1="45" y1="45" x2="66" y2="29" stroke="#0d0f12" strokeWidth="1.8" />
          <line x1="50" y1="50" x2="70" y2="35" stroke="#cbd5e1" strokeWidth="4.5" />
          {/* Radar Dome & Armored Turret Housing */}
          <path d="M32 52 C32 40 54 40 54 52 Z" fill="#2bb3b1" />
          <circle cx="43" cy="47" r="3.5" fill="#f5b82e" />
          {/* Fortified Base Pedestal */}
          <polygon points="27,52 63,52 67,63 23,63" fill="#94a3b8" />
          <rect x="25" y="63" width="40" height="7" rx="2" fill="#475569" />
        </g>
      )}

      {variant === 4 && (
        /* Page 4: STRATEGIC STRIKE Nuclear Trefoil & Warhead Crest */
        <g stroke="#0d0f12" strokeWidth="2.2" strokeLinejoin="round">
          <circle cx="48" cy="51" r="18" fill="#f5b82e" />
          <path d="M48 51 L38 35 A18 18 0 0 1 58 35 Z" fill="#0d0f12" />
          <path d="M48 51 L66 52 A18 18 0 0 1 56 67 Z" fill="#0d0f12" />
          <path d="M48 51 L40 67 A18 18 0 0 1 30 52 Z" fill="#0d0f12" />
          <circle cx="48" cy="51" r="5.5" fill="#00f5ff" stroke="#0d0f12" strokeWidth="2" />
        </g>
      )}
    </svg>
  );
}

const KIOSK_SPRITE_IMAGE_PATHS: Record<KioskCardIllustrationId, string> = {
  ar99_rifle: '/assets/kiosk/ar99_rifle.webp',
  p12_handgun: '/assets/kiosk/p12_handgun.webp',
  vx20_bazooka: '/assets/kiosk/vx20_bazooka.webp',
  skyshield_turret: '/assets/kiosk/skyshield_turret.webp',
  st01_minitank: '/assets/kiosk/st01_minitank.webp',
  ht88_dump_truck: '/assets/kiosk/ht88_dump_truck.webp',
  af9_plane: '/assets/kiosk/af9_plane.webp',
  street_rookie: '/assets/kiosk/family_member_male.jpg',
  t800_cyborg: '/assets/kiosk/family_member_female.jpg',
  shinobi_infiltrator: '/assets/kiosk/family_member_female.jpg',
  tactical_veteran: '/assets/kiosk/family_member_male.jpg',
  hq_super_command: '/assets/kiosk/hq_super_command.webp',
  hq_tactical_comms: '/assets/kiosk/hq_tactical_comms.webp',
  lg88_laser_rifle: '/assets/kiosk/lg88_laser_rifle.webp',
  nuclear_launcher: '/assets/kiosk/nuclear_launcher.webp',
  titan6_gatling: '/assets/kiosk/titan6_gatling.webp',
  hg04_grenade: '/assets/kiosk/hg04_grenade.webp',
  tm89_mine: '/assets/kiosk/tm89_mine.webp',
  cb24_cluster: '/assets/kiosk/cb24_cluster.webp',
};

const SQUAD_BUST_ILLUSTRATION_IDS = new Set<KioskCardIllustrationId>([
  'street_rookie',
  't800_cyborg',
  'shinobi_infiltrator',
  'tactical_veteran',
]);

const BASE_HOUSE_ILLUSTRATION_IDS = new Set<KioskCardIllustrationId>([
  'hq_super_command',
  'hq_tactical_comms',
]);

function renderComicCardIllustration(
  kind: KioskCardIllustrationId,
  altText: string,
  isSilhouetteLocked = false,
) {
  const spriteSrc = KIOSK_SPRITE_IMAGE_PATHS[kind];
  const isSquadBust = SQUAD_BUST_ILLUSTRATION_IDS.has(kind);
  const isBaseHouse = BASE_HOUSE_ILLUSTRATION_IDS.has(kind);

  return (
    <div
      className={`relative w-full flex items-center justify-center select-none pointer-events-none ${
        isSilhouetteLocked ? 'h-[112px] sm:h-[122px]' : 'h-[78px] sm:h-[86px]'
      }`}
    >
      <img
        src={spriteSrc}
        alt={isSilhouetteLocked ? 'Surprise Locked Weapon' : altText}
        draggable={false}
        className={`w-full ${
          isSilhouetteLocked
            ? 'h-[88px] sm:h-[96px] object-contain brightness-0 contrast-200 drop-shadow-[0_2px_0_rgba(0,0,0,0.35)]'
            : isSquadBust
            ? 'h-[78px] sm:h-[86px] object-contain object-bottom'
            : isBaseHouse
            ? 'h-[78px] sm:h-[86px] object-contain'
            : 'h-[78px] sm:h-[86px] object-contain'
        } transition-all duration-300 select-none pointer-events-none`}
      />
      {isSilhouetteLocked && (
        <div
          data-nuclear-silhouette-lock="true"
          data-silhouette-lock-id={kind}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="w-11 h-11 rounded-full bg-slate-950/90 border border-amber-400/70 shadow-lg flex items-center justify-center">
            <span className="text-2xl font-extrabold leading-none text-amber-300">
              ?
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export const TacticalKioskModal: React.FC<TacticalKioskModalProps> = ({
  isOpen,
  onClose,
  hud,
  onSelectRecipe,
  onRemoveQueueIndex,
  onClearQueue,
  onUpgradeBase,
  onBuyCrateAirdrop,
  onNearConnectAndMint,
  onNearClaimBasePlot,
  ownedHouseStyles,
  onNearClaimBasePlotWithStyle,
  onNearReleaseBasePlot,
  onSetSafezoneAccessMode,
  onAddSafezoneFriend,
  onRemoveSafezoneFriend,
  onEnterPrivateHouseInterior,
  onOpenHouseCatalog,
  onOpenPersonalWallet,
}) => {
  const [pageIndex, setPageIndex] = useState<KioskPageIndex>(0);
  const [selectedCardIdByPage, setSelectedCardIdByPage] = useState<Record<KioskPageIndex, string>>({
    0: 'ar99_rifle',
    1: 'st01_minitank',
    2: 'hq_super_command',
    3: 'skyshield_turret',
    4: 'nuclear_launcher',
  });
  const [friendWalletInput, setFriendWalletInput] = useState<string>('');
  const [isScanningGamepass, setIsScanningGamepass] = useState<boolean>(false);
  const [isConfirmingDisconnect, setIsConfirmingDisconnect] = useState<boolean>(false);
  const scanTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen || !hud.nearWalletConnected) {
      setIsConfirmingDisconnect(false);
    }
  }, [isOpen, hud.nearWalletConnected]);

  useEffect(() => {
    return () => {
      if (scanTimerRef.current !== null) {
        window.clearTimeout(scanTimerRef.current);
      }
    };
  }, []);

  const hasValidWalletId = Boolean(
    hud.nearWalletId &&
      hud.nearWalletId.trim().length > 0 &&
      hud.nearWalletId.trim().toLowerCase() !== 'commander-p1.near' &&
      hud.nearWalletId.trim().toLowerCase() !== 'commander-p1.testnet',
  );
  const isGamepassVerified = Boolean(
    hud.nearWalletConnected && hasValidWalletId && hud.nearHasGamepassNft && !isScanningGamepass,
  );
  const isPlotClaimedAndDeployed = Boolean(
    isGamepassVerified &&
      hud.nearClaimedPlotIndex !== null &&
      hud.nearClaimedPlotIndex !== undefined,
  );
  const targetPlotLabel =
    hud.nearKioskPlotTeam && hud.nearKioskPlotIndex !== null && hud.nearKioskPlotIndex !== undefined
      ? ` (${hud.nearKioskPlotTeam.toUpperCase()} #${
          hud.nearKioskPlotTeam === 'blue' && hud.nearKioskPlotIndex === 0
            ? 2
            : hud.nearKioskPlotIndex + 1
        })`
      : '';

  const handleConnectAndScanGamepass = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    soundEngine.playUiClick();
    if (isScanningGamepass || hud.nearHasGamepassNft) return;
    setIsScanningGamepass(true);
    if (scanTimerRef.current !== null) {
      window.clearTimeout(scanTimerRef.current);
    }
    scanTimerRef.current = window.setTimeout(() => {
      scanTimerRef.current = null;
      setIsScanningGamepass(false);
      onNearConnectAndMint?.();
    }, 420);
  };

  const isSafezoneCityMode =
    hud.worldMode === 'safezone' ||
    hud.worldMode === 'lobby' ||
    hud.cityArenaMode === 'safezone';
  const currentAccessMode: SafezonePlotAccessMode = hud.safezonePlotAccessMode ?? 'PUBLIC';
  const allowedFriends: string[] = hud.safezoneAllowedFriends ?? [];

  const bLv = hud.baseBuildingLevel;
  const fLv = hud.baseFenceLevel;
  const comboMaxed = bLv >= 3 && fLv >= 3;
  const superCommandCost = comboMaxed ? 800 : 1200;
  const commsCost = bLv === 1 ? 750 : bLv === 2 ? 1500 : 500;
  const nukeAccess = evaluateNuclearLauncherAccess(bLv);
  const clusterAccess = evaluateClusterBombAccess(
    bLv,
    Boolean(hud.controlMode === 'tank' && hud.equippedWeapon.toLowerCase().includes('plane')),
  );

  const pages: Record<
    KioskPageIndex,
    {
      headerTitle: string;
      headerSubtitle: string;
      cards: KioskGridCardItem[];
    }
  > = {
    0: {
      headerTitle: 'WEAPON ARMORY',
      headerSubtitle:
        'Assign Family Member AI Agents to assemble infantry firearms, rotary gatlings, or photon lance rifles on the build pad.',
      cards: [
        {
          id: 'ar99_rifle',
          title: 'AR-99 ASSAULT RIFLE',
          tagLine: 'PRIMARY · TIER 4',
          illustration: 'ar99_rifle',
          actionKind: 'recipe',
          recipeId: 'assault_plasma',
          inspectDetail: '5.56x45mm Tactical Carbine · Hologram Pad: 2x Blue Crates',
        },
        {
          id: 'p12_handgun',
          title: 'P-12 TACTICAL HANDGUN',
          tagLine: 'SIDEARM · TIER 2',
          illustration: 'p12_handgun',
          actionKind: 'recipe',
          recipeId: 'pistol_uzi',
          inspectDetail: '9x19mm Sidearm + Reflex Sight · Hologram Pad: 1x Red Crate',
        },
        {
          id: 'vx20_bazooka',
          title: 'VX-20 HEAVY BAZOOKA',
          tagLine: 'ORDNANCE · TIER 5',
          illustration: 'vx20_bazooka',
          actionKind: 'recipe',
          recipeId: 'bazooka',
          inspectDetail: '84mm Anti-Armor Rocket · Hologram Pad: 1x Blue Crate + 1x Red Crate',
        },
        {
          id: 'titan6_gatling',
          title: 'TITAN-6 ROTARY GATLING',
          tagLine: 'HEAVY · TIER 4',
          illustration: 'titan6_gatling',
          actionKind: 'recipe',
          recipeId: 'gatling_mortar',
          inspectDetail: '6-Barrel 7.62mm Rotary Gatling Gun · Hologram Pad: 2x Blue + 2x Red',
        },
        {
          id: 'lg88_laser_rifle',
          title: 'LG-88 PHOTON LANCE',
          tagLine: 'ENERGY · TIER 4',
          illustration: 'lg88_laser_rifle',
          actionKind: 'recipe',
          recipeId: 'laser_gun',
          inspectDetail: 'Directed-Energy Photon Lance Rifle (Laser Beam + Burn Effect) · Hologram Pad: 1x Blue + 1x Red',
        },
      ],
    },
    1: {
      headerTitle: 'VEHICLE HANGAR',
      headerSubtitle:
        'Queue heavy crate contracts for combat mini-tanks, 4-crate cargo dump trucks, or VTOL sky-striker aircraft.',
      cards: [
        {
          id: 'st01_minitank',
          title: 'ST-01 COMBAT MINI-TANK',
          tagLine: 'GROUND · ASSAULT · TIER 4',
          illustration: 'st01_minitank',
          actionKind: 'recipe',
          recipeId: 'blitz_tank',
          inspectDetail: '105mm Chibi Battle Tank · Hologram Pad: 4x Red Crates (2x1x2)',
        },
        {
          id: 'ht88_dump_truck',
          title: 'HT-88 HEAVY DUMP TRUCK',
          tagLine: 'GROUND · CARGO · TIER 3',
          illustration: 'ht88_dump_truck',
          actionKind: 'recipe',
          recipeId: 'dump_truck',
          inspectDetail: '4-Crate Hydraulic Dump Vessel · Hologram Pad: 4x Red Crates (2x2x1)',
        },
        {
          id: 'af9_plane',
          title: 'AF-9 SKY-STRIKER PLANE',
          tagLine: 'AERIAL · INTERCEPTOR · TIER 4',
          illustration: 'af9_plane',
          actionKind: 'recipe',
          recipeId: 'blitz_plane',
          inspectDetail: 'VTOL Strike Aircraft · Hologram Pad: 2x Gold + 2x Blue + 4x Red',
        },
      ],
    },
    2: {
      headerTitle: 'BASE UPGRADE',
      headerSubtitle:
        'Upgrade your Command HQ with LUL to fortify perimeter walls, expand radar range, and unlock Tier-3 superweapons.',
      cards: [
        {
          id: 'hq_super_command',
          title: '3-STORY SUPER COMMAND',
          tagLine: bLv >= 3 ? 'ACTIVE · HQ LV.3 UNLOCKED' : 'HQ · STRATEGIC · TIER 3',
          illustration: 'hq_super_command',
          actionKind: 'upgrade_base',
          upgradeId: 'upgrade_super_command_lv3',
          inspectDetail: `${
            comboMaxed
              ? 'MAX LV.3 ACTIVE (Nuclear Launcher & Cluster Bomb Unlocked!)'
              : `Direct Lv.3 Upgrade Cost: ${superCommandCost} LUL`
          } · Base HP: ${hud.baseBuildingHp}/${hud.baseBuildingMaxHp} · Fence: ${hud.baseFenceHp}/${hud.baseFenceMaxHp}`,
        },
        {
          id: 'hq_tactical_comms',
          title: 'CENTRAL TACTICAL COMMS',
          tagLine: bLv >= 2 ? `ACTIVE · RADAR LV.${bLv}` : 'OPERATIONS · TIER 2',
          illustration: 'hq_tactical_comms',
          actionKind: 'upgrade_base',
          upgradeId: 'upgrade_building_only',
          inspectDetail: `Step Upgrade Cost: ${commsCost} LUL · Radar Lv.${bLv}: ${
            bLv >= 3 ? 'MAX 280m (Full Map)' : bLv === 2 ? '152m -> MAX 280m' : '92m -> 152m'
          }`,
        },
      ],
    },
    3: {
      headerTitle: 'DEFENSE & ORDNANCE',
      headerSubtitle:
        'Fortify your perimeter with automated 35mm Skyshield C-RAM turrets, fragmentation grenades, and anti-armor mines.',
      cards: [
        {
          id: 'skyshield_turret',
          title: '35mm SKYSHIELD TURRET',
          tagLine: 'TURRET · TIER 4',
          illustration: 'skyshield_turret',
          actionKind: 'recipe',
          recipeId: 'skyshield_turret',
          inspectDetail: 'C-RAM Base Air/Ground Defense · Hologram Pad: 2x Blue + 2x Red',
        },
        {
          id: 'hg04_grenade',
          title: 'HG-04 FRAG GRENADE',
          tagLine: 'TACTICAL · TIER 2',
          illustration: 'hg04_grenade',
          actionKind: 'recipe',
          recipeId: 'hand_grenade',
          inspectDetail: 'Delay 3.5s Fragmentation Hand Grenade · Hologram Pad: 1x Red Crate',
        },
        {
          id: 'tm89_mine',
          title: 'TM-89 ANTI-VEHICLE MINE',
          tagLine: 'ORDNANCE · TIER 2',
          illustration: 'tm89_mine',
          actionKind: 'recipe',
          recipeId: 'land_mine',
          inspectDetail: 'Heavy Anti-Vehicle Pressure Land Mine · Hologram Pad: 1x Blue Crate',
        },
      ],
    },
    4: {
      headerTitle: 'STRATEGIC STRIKE',
      headerSubtitle:
        'Requires Level 3 Super Command HQ. Unlock strategic ICBM nuclear silos and aerial submunition cluster bombs.',
      cards: [
        {
          id: 'nuclear_launcher',
          title: nukeAccess.isRevealed ? 'TACTICAL NUKE LAUNCHER' : '',
          tagLine: nukeAccess.isRevealed ? 'TURRET · TIER 5' : '',
          illustration: 'nuclear_launcher',
          actionKind: 'recipe',
          recipeId: 'nuclear_launcher',
          isSilhouetteLocked: !nukeAccess.isRevealed,
          inspectDetail: nukeAccess.statusMessage,
        },
        {
          id: 'cb24_cluster',
          title: clusterAccess.isRevealed ? 'CB-24 CLUSTER BOMB' : '',
          tagLine: clusterAccess.isRevealed ? 'AIRCRAFT ONLY · TIER 3' : '',
          illustration: 'cb24_cluster',
          actionKind: 'recipe',
          recipeId: 'cluster_bomb',
          isSilhouetteLocked: !clusterAccess.isRevealed,
          inspectDetail: clusterAccess.isRevealed
            ? `Strike Aircraft Only (Blitz Plane) · 24x Submunition Cluster Bomb · ${clusterAccess.statusMessage}`
            : clusterAccess.statusMessage,
        },
      ],
    },
  };

  const currentPage = pages[pageIndex];
  const selectedCardId = selectedCardIdByPage[pageIndex];
  const selectedCard =
    currentPage.cards.find((c) => c.id === selectedCardId) ?? currentPage.cards[0];

  const handlePrevPage = () => {
    soundEngine.playUiClick();
    setPageIndex((prev) => ((prev + 4) % 5) as KioskPageIndex);
  };

  const handleNextPage = () => {
    soundEngine.playUiClick();
    setPageIndex((prev) => ((prev + 1) % 5) as KioskPageIndex);
  };

  const handleSelectCard = (card: KioskGridCardItem) => {
    soundEngine.playUiClick();
    setSelectedCardIdByPage((prev) => ({
      ...prev,
      [pageIndex]: card.id,
    }));
  };

  const buildQueue = hud.buildQueue ?? [];
  const isQueueFull = buildQueue.length >= MAX_KIOSK_BUILD_QUEUE;

  const handleExecuteBuild = () => {
    soundEngine.playUiClick();
    if (selectedCard.actionKind === 'recipe' && selectedCard.recipeId) {
      onSelectRecipe(selectedCard.recipeId);
      if (!selectedCard.isSilhouetteLocked && !isQueueFull) {
        onClose();
      }
    } else if (selectedCard.actionKind === 'upgrade_base' && selectedCard.upgradeId) {
      onUpgradeBase(selectedCard.upgradeId);
    } else if (selectedCard.actionKind === 'buy_crate' && selectedCard.crateKind) {
      onBuyCrateAirdrop(selectedCard.crateKind);
    }
  };

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-hidden={!isOpen}
      inert={!isOpen || undefined}
      aria-label="Self-Service Tactical Kiosk"
      data-kiosk-drawer="true"
      className={`fixed left-4 top-16 bottom-20 z-40 w-full max-w-lg flex flex-col transition-transform duration-200 ease-out transform ${
        isOpen
          ? 'translate-x-0 visible pointer-events-auto'
          : '-translate-x-[120%] invisible pointer-events-none'
      }`}
    >
      <div className="relative max-h-full overflow-y-auto rounded-[26px] bg-gradient-to-b from-[#171d2c]/86 via-[#111622]/84 to-[#0c101a]/88 border border-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_24px_70px_rgba(0,0,0,0.58)] text-white">
        {/* Top Controls & Header Bar */}
        <div className="px-5 pt-4 pb-3.5 border-b border-white/10 bg-white/[0.03] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {renderShieldCrestSvg(
                !isPlotClaimedAndDeployed
                  ? 'claim'
                  : isSafezoneCityMode
                  ? 'safezone'
                  : pageIndex,
              )}
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-extrabold uppercase tracking-tight leading-tight text-white truncate">
                  {!isPlotClaimedAndDeployed
                    ? 'CLAIM HOUSE PLOT'
                    : isSafezoneCityMode
                    ? 'MANAGE HOUSE PLOT'
                    : currentPage.headerTitle}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {!isGamepassVerified && onNearConnectAndMint ? (
                <button
                  type="button"
                  data-near-btn="connect-mint"
                  disabled={isScanningGamepass}
                  onClick={handleConnectAndScanGamepass}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-colors ${
                    isScanningGamepass
                      ? 'bg-amber-400/20 text-amber-300 border border-amber-300/40 cursor-wait'
                      : 'bg-sky-500 hover:bg-sky-400 text-white cursor-pointer'
                  }`}
                >
                  {isScanningGamepass ? 'SCANNING...' : 'CONNECT WALLET'}
                </button>
              ) : isGamepassVerified ? (
                <button
                  type="button"
                  data-near-wallet-badge="true"
                  data-near-btn={isConfirmingDisconnect ? 'release-base' : 'wallet-toggle-disconnect'}
                  data-kiosk-release-plot={isConfirmingDisconnect ? 'true' : undefined}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    soundEngine.playUiClick();
                    if (!isConfirmingDisconnect) {
                      setIsConfirmingDisconnect(true);
                    } else {
                      setIsConfirmingDisconnect(false);
                      onNearReleaseBasePlot?.();
                    }
                  }}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide cursor-pointer transition-colors ${
                    isConfirmingDisconnect
                      ? 'bg-rose-500 hover:bg-rose-400 text-white'
                      : 'bg-emerald-400/20 hover:bg-emerald-400/30 text-emerald-300 border border-emerald-400/40'
                  }`}
                  title={
                    isConfirmingDisconnect
                      ? 'Click again to Disconnect & Release Plot'
                      : 'Click to show Disconnect button'
                  }
                >
                  {isConfirmingDisconnect ? 'DISCONNECT' : hud.nearWalletId}
                </button>
              ) : null}
              <div
                data-kiosk-gold="true"
                className="px-2.5 py-1 rounded-full bg-white/[0.07] border border-white/15 text-[11px] font-mono-tabular font-bold tracking-tight text-amber-300"
                title="LUL (Lulling) Balance"
              >
                {hud.gold.toLocaleString()} LUL
              </div>
              <button
                type="button"
                data-kiosk-close="true"
                onClick={(e) => {
                  e.currentTarget.blur();
                  soundEngine.playUiClick();
                  onClose();
                }}
                aria-label="Close Kiosk"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center active:scale-95 transition-all cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 stroke-current" strokeWidth="2.5">
                  <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
                  <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <p className="h-[34px] line-clamp-2 overflow-hidden text-xs font-medium leading-relaxed text-slate-300">
            {!isPlotClaimedAndDeployed
              ? isScanningGamepass
                ? 'Checking house ownership...'
                : isGamepassVerified
                ? 'House ownership verified. Click CLAIM PLOT below to place your house on this plot.'
                : 'Connect your wallet or buy a House in Hana Catalog to claim this city plot.'
              : isSafezoneCityMode
              ? 'Set gate access and friend permissions for your house plot.'
              : currentPage.headerSubtitle}
          </p>
        </div>

        {/* Main Body Content */}
        <div className="px-5 py-4">
          {/* Plot Claim & Verification Panel (Shown before plot is claimed) */}
          {!isPlotClaimedAndDeployed && (
            <div
              data-near-gamepass-panel="true"
              className="p-4 rounded-2xl bg-white/[0.05] border border-white/10 space-y-3"
            >
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-300 truncate">
                    HOUSE PLOT {targetPlotLabel}
                  </span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[9.5px] font-bold uppercase ${
                    isGamepassVerified
                      ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/35'
                      : isScanningGamepass
                      ? 'bg-amber-400/20 text-amber-300 border border-amber-400/35'
                      : hasValidWalletId
                      ? 'bg-sky-400/20 text-sky-300 border border-sky-400/35'
                      : 'bg-white/10 text-slate-300'
                  }`}
                >
                  {isGamepassVerified
                    ? 'VERIFIED'
                    : isScanningGamepass
                    ? 'CHECKING...'
                    : hasValidWalletId
                    ? 'CONNECTED'
                    : 'GUEST'}
                </span>
              </div>

              {!hasValidWalletId ? (
                /* Unregistered / Not Connected State */
                <div className="space-y-2.5">
                  <p className="text-xs font-medium text-slate-300 leading-snug">
                    Sign in or connect your wallet to verify house ownership.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {onNearConnectAndMint && (
                      <button
                        type="button"
                        data-kiosk-connect-wallet="true"
                        onClick={handleConnectAndScanGamepass}
                        className="py-2 px-4 rounded-full bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs uppercase tracking-wide cursor-pointer transition-colors"
                      >
                        CONNECT WALLET
                      </button>
                    )}
                    {onOpenPersonalWallet && (
                      <button
                        type="button"
                        data-kiosk-register-account="true"
                        onClick={() => {
                          soundEngine.playUiClick();
                          onOpenPersonalWallet();
                        }}
                        className="py-2 px-4 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wide cursor-pointer transition-colors"
                      >
                        OPEN WALLET
                      </button>
                    )}
                  </div>
                  {onOpenHouseCatalog && (
                    <button
                      type="button"
                      data-kiosk-browse-catalog="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        onOpenHouseCatalog();
                      }}
                      className="w-full py-2 px-4 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-violet-200 border border-white/15 font-bold text-[11px] uppercase tracking-wide cursor-pointer text-center transition-colors"
                    >
                      BUY HOUSE IN CATALOG
                    </button>
                  )}
                </div>
              ) : isScanningGamepass ? (
                /* Scanning in Progress */
                <div className="py-3 px-4 rounded-xl bg-amber-400/10 border border-amber-400/30 text-center">
                  <div className="text-xs font-bold uppercase text-amber-300 tracking-wider">
                    CHECKING HOUSE OWNERSHIP...
                  </div>
                </div>
              ) : isGamepassVerified ? (
                /* Verified State -> Claim Button */
                <div className="space-y-2.5">
                  <div className="p-2.5 rounded-xl bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-between gap-2">
                    <span className="text-[10.5px] font-bold uppercase text-emerald-300">
                      HOUSE OWNERSHIP VERIFIED
                    </span>
                    <span className="text-[10px] font-mono-tabular font-semibold text-white/80">
                      {hud.nearWalletId}
                    </span>
                  </div>
                  {onNearClaimBasePlotWithStyle && ownedHouseStyles && ownedHouseStyles.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        BUILD YOUR HOUSE — PICK YOUR DEED
                      </div>
                      {ownedHouseStyles.map((style) => (
                        <div
                          key={style}
                          data-kiosk-build-style={style}
                          className="p-3 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-between gap-2.5"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold uppercase text-white">
                              {style === 'plaza_manor' ? 'Classic Plaza Manor' : 'Japanese Pavilion'}
                            </div>
                            <div className="text-[10.5px] font-medium text-slate-300">
                              {style === 'plaza_manor'
                                ? 'Stone manor, round front porch, twin stairs.'
                                : 'Wooden pavilion, tiled roof, garden front.'}
                            </div>
                            <div className="text-[9.5px] font-bold uppercase text-emerald-400 mt-0.5">
                              From your deed NFT
                            </div>
                          </div>
                          <button
                            type="button"
                            data-near-btn="claim-base"
                            data-kiosk-claim-plot="true"
                            onClick={(e) => {
                              e.currentTarget.blur();
                              soundEngine.playUiClick();
                              onNearClaimBasePlotWithStyle(style);
                            }}
                            className="py-2 px-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10.5px] uppercase tracking-wider cursor-pointer active:scale-95 transition-all shrink-0"
                          >
                            BUILD HERE
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    onNearClaimBasePlot && (
                      <button
                        type="button"
                        data-near-btn="claim-base"
                        data-kiosk-claim-plot="true"
                        onClick={(e) => {
                          e.currentTarget.blur();
                          soundEngine.playUiClick();
                          onNearClaimBasePlot();
                        }}
                        className="w-full py-2.5 px-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider cursor-pointer active:scale-[0.98] transition-all"
                      >
                        CLAIM PLOT
                      </button>
                    )
                  )}
                </div>
              ) : (
                /* Connected But No House */
                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/35 space-y-1">
                    <div className="text-[10.5px] font-bold uppercase text-rose-300">
                      NO HOUSE FOUND ON {hud.nearWalletId}
                    </div>
                    <div className="text-[10.5px] font-medium text-slate-300">
                      Buy a Private House in Hana Catalog to claim a city plot.
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      data-rescan-nft-btn="true"
                      onClick={handleConnectAndScanGamepass}
                      className="py-2 px-4 rounded-full bg-sky-500 hover:bg-sky-400 text-white font-bold text-[10.5px] uppercase cursor-pointer transition-colors"
                    >
                      RECHECK WALLET
                    </button>
                    {onOpenHouseCatalog && (
                      <button
                        type="button"
                        data-kiosk-buy-house="true"
                        onClick={() => {
                          soundEngine.playUiClick();
                          onOpenHouseCatalog();
                        }}
                        className="py-2 px-4 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[10.5px] uppercase cursor-pointer transition-colors"
                      >
                        BUY HOUSE
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {!isPlotClaimedAndDeployed ? null : isSafezoneCityMode ? (
            /* =================================================================
               SAFEZONE MODE: NON-MILITARY PLOT ACCESS SETTINGS PANEL
               (`PUBLIC`, `FRIENDS ONLY`, `PRIVATE` + `ADD FRIEND WALLET / ID`)
               ================================================================= */
            <div
              data-safezone-plot-access-panel="true"
              className="space-y-3"
            >
              {onEnterPrivateHouseInterior && (
                <button
                  type="button"
                  data-enter-house-btn="true"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    soundEngine.playUiClick();
                    onEnterPrivateHouseInterior();
                  }}
                  className="w-full py-2.5 px-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider cursor-pointer active:scale-[0.98] transition-all"
                >
                  ENTER PRIVATE HOUSE &amp; DECORATE
                </button>
              )}
              <div className="p-3.5 rounded-2xl bg-white/[0.05] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    GATE ACCESS MODE
                  </span>
                  <span
                    data-safezone-current-access={currentAccessMode}
                    className="px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/35 text-[10px] font-bold uppercase"
                  >
                    {currentAccessMode === 'FRIENDS_ONLY' ? 'FRIENDS ONLY' : currentAccessMode}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'PUBLIC', label: 'PUBLIC', desc: 'Open for All' },
                      { id: 'FRIENDS_ONLY', label: 'FRIENDS ONLY', desc: 'Owner & Friends' },
                      { id: 'PRIVATE', label: 'PRIVATE', desc: 'Owner Only' },
                    ] as const
                  ).map((opt) => {
                    const active = currentAccessMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-safezone-access-btn={opt.id}
                        onClick={() => {
                          soundEngine.playUiClick();
                          onSetSafezoneAccessMode?.(opt.id);
                        }}
                        className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                          active
                            ? 'bg-emerald-400/20 border-emerald-400/70 text-white'
                            : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-slate-200'
                        }`}
                      >
                        <div className="text-[11px] font-bold uppercase leading-tight">
                          {opt.label}
                        </div>
                        <div className="text-[9.5px] font-medium text-slate-400 mt-0.5">
                          {opt.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Friend List Management for FRIENDS ONLY mode */}
              <div className="p-3.5 rounded-2xl bg-white/[0.05] border border-white/10 space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  ADD FRIEND WALLET / ID
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const trimmed = friendWalletInput.trim();
                    if (trimmed.length > 0) {
                      soundEngine.playUiClick();
                      onAddSafezoneFriend?.(trimmed);
                      setFriendWalletInput('');
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    data-safezone-friend-input="true"
                    value={friendWalletInput}
                    onChange={(e) => setFriendWalletInput(e.target.value)}
                    placeholder="buddy-friend.near"
                    className="flex-1 px-3.5 py-2 rounded-full bg-white/[0.07] border border-white/15 focus:border-emerald-400/60 text-xs font-medium text-white placeholder:text-slate-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    data-safezone-add-friend-btn="true"
                    className="px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10.5px] uppercase cursor-pointer transition-colors"
                  >
                    ADD FRIEND
                  </button>
                </form>

                {allowedFriends.length > 0 ? (
                  <div
                    data-safezone-friend-list="true"
                    className="flex flex-wrap gap-1.5 pt-1"
                  >
                    {allowedFriends.map((friendId) => (
                      <span
                        key={friendId}
                        data-safezone-friend-item={friendId}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[10.5px] font-semibold text-white"
                      >
                        <span>{friendId}</span>
                        <button
                          type="button"
                          data-safezone-remove-friend-btn={friendId}
                          onClick={() => {
                            soundEngine.playUiClick();
                            onRemoveSafezoneFriend?.(friendId);
                          }}
                          className="text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                          title="Remove Friend"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10.5px] font-medium text-slate-400">
                    NO FRIENDS ADDED YET
                  </div>
                )}
              </div>

              {hud.kioskStatusMessage && (
                <div
                  data-kiosk-status-toast="true"
                  className="px-3.5 py-2 rounded-xl bg-teal-500/15 border border-teal-400/35 text-[11px] font-semibold text-teal-200"
                >
                  {hud.kioskStatusMessage}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Scrollable 2-Column Grid with Fixed Viewport Height (Warzone Military Mode) */}
              <div className="h-[312px] sm:h-[338px] overflow-y-auto pr-1 grid grid-cols-2 content-start gap-3">
                {currentPage.cards.map((card) => {
                  const isSelected = selectedCard.id === card.id;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      data-kiosk-card={card.id}
                      data-kiosk-recipe={card.recipeId}
                      onClick={() => handleSelectCard(card)}
                      className={`group relative h-[148px] sm:h-[158px] rounded-2xl p-3 text-left transition-all cursor-pointer select-none border flex flex-col justify-between overflow-hidden ${
                        isSelected
                          ? 'bg-teal-400/15 border-teal-400/75 ring-1 ring-teal-400/40 shadow-md'
                          : 'bg-white/[0.05] hover:bg-white/[0.09] border-white/10 hover:border-white/20'
                      }`}
                    >
                      {/* Top-Right Circular Checkmark Badge on Selected Card */}
                      {isSelected && (
                        <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-teal-400 text-slate-950 flex items-center justify-center z-10 shadow-sm">
                          <svg
                            viewBox="0 0 20 20"
                            className="w-3.5 h-3.5 stroke-current fill-none"
                            strokeWidth="3"
                          >
                            <polyline
                              points="3.5,10.5 8,15 16.5,5.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      )}

                      {!card.isSilhouetteLocked && (
                        <div className={`h-[40px] sm:h-[42px] overflow-hidden ${isSelected ? 'pr-7' : ''}`}>
                          <div
                            className={`${
                              card.title.length >= 22
                                ? 'text-[10.5px] sm:text-[11.5px]'
                                : 'text-xs sm:text-[13px]'
                            } font-bold uppercase tracking-tight leading-[1.15] text-white truncate`}
                          >
                            {card.title}
                          </div>
                          <div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400 mt-0.5 truncate">
                            {card.tagLine}
                          </div>
                        </div>
                      )}

                      <div
                        className={`${
                          card.isSilhouetteLocked ? 'my-auto' : 'mt-1'
                        } flex items-center justify-center`}
                      >
                        {renderComicCardIllustration(
                          card.illustration,
                          card.title,
                          Boolean(card.isSilhouetteLocked),
                        )}
                      </div>
                    </button>
                  );
                })}
                {Array.from({ length: Math.max(0, 4 - currentPage.cards.length) }).map((_, emptyIdx) => (
                  <div
                    key={`empty-slot-${emptyIdx}`}
                    aria-hidden="true"
                    className="invisible pointer-events-none select-none h-[148px] sm:h-[158px] p-3"
                  />
                ))}
              </div>

              {/* Single Active Recipe Contract Bar (Warzone Only) */}
              <div
                data-kiosk-build-queue="true"
                className="mt-3.5 px-3.5 py-2.5 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-between gap-2"
              >
                {(() => {
                  const activeContractId = buildQueue[0];
                  const activeContractSpec = activeContractId
                    ? KIOSK_BUILD_PRIORITY_RECIPES[activeContractId]
                    : null;
                  return (
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                          ACTIVE CONTRACT:
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase truncate ${
                            activeContractSpec
                              ? 'bg-teal-400/20 text-teal-200 border border-teal-400/40'
                              : 'bg-white/[0.06] text-slate-400 border border-dashed border-white/15'
                          }`}
                        >
                          {activeContractSpec
                            ? `${activeContractSpec.name} (${activeContractSpec.targetCrates} BOX)`
                            : 'NO CONTRACT (STANDBY)'}
                        </span>
                      </div>
                      {activeContractSpec && (onClearQueue || onRemoveQueueIndex) && (
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playUiClick();
                            if (onClearQueue) {
                              onClearQueue();
                            } else if (onRemoveQueueIndex) {
                              onRemoveQueueIndex(0);
                            }
                          }}
                          className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/35 text-rose-200 cursor-pointer shrink-0 transition-colors"
                        >
                          CANCEL
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Bottom Footer Bar: Pagination on Left + Pill [BUILD] Button on Right */}
              <div className="mt-4 pt-1 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-kiosk-prev="true"
                    onClick={handlePrevPage}
                    aria-label="Previous Page"
                    className="w-10 h-10 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 active:scale-95 flex items-center justify-center cursor-pointer transition-all text-white"
                  >
                    <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                      <polygon points="13,4 6,10 13,16" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    data-kiosk-next="true"
                    onClick={handleNextPage}
                    aria-label="Next Page"
                    className="w-10 h-10 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 active:scale-95 flex items-center justify-center cursor-pointer transition-all text-white"
                  >
                    <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                      <polygon points="7,4 14,10 7,16" />
                    </svg>
                  </button>
                  <div className="px-3.5 h-10 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-xs font-mono-tabular font-bold tracking-tight text-slate-300 select-none">
                    0{pageIndex + 1} / 05
                  </div>
                </div>

                <div className="flex items-center">
                  <button
                    type="button"
                    data-kiosk-build="true"
                    onClick={handleExecuteBuild}
                    className={`h-11 px-7 sm:px-8 rounded-full active:scale-95 font-extrabold text-sm sm:text-base uppercase tracking-wider cursor-pointer transition-all shadow-md ${
                      selectedCard.isSilhouetteLocked
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40 hover:bg-amber-400/30'
                        : 'bg-teal-400 hover:bg-teal-300 text-slate-950'
                    }`}
                  >
                    {selectedCard.isSilhouetteLocked
                      ? 'LOCKED LV.3'
                      : selectedCard.actionKind === 'upgrade_base'
                      ? 'UPGRADE'
                      : selectedCard.actionKind === 'buy_crate'
                      ? 'AIRDROP'
                      : 'BUILD'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
};
