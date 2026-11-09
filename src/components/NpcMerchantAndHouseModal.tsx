import React, { useEffect, useState } from 'react';
import {
  MERCHANT_CATALOG_ITEMS,
  MerchantAgentMarketState,
  MerchantCatalogItem,
  MerchantLocationId,
  HouseInteriorSlotId,
  HOUSE_SURFACE_SWATCHES,
  PlacedHouseFurnitureItem,
  evaluateLulToCyonExchangeQuote,
  generateNpcMerchantReply,
  formatDaylightHour,
  evaluateRoomMoodScores,
} from '../game/buddiesMerchantPricing';
import { soundEngine } from '../game/audio';
import type { CaughtFishItem, FishNftMarketplaceListing } from '../game/buddiesFishingMarket';
import {
  FAMILY_MEMBER_CONTRACT_PLANS,
  FAMILY_MEMBER_ORDER_SPECS,
  HOUSE_OWNERSHIP_PRICE_RESPITE,
  RESPITE_NEP141_METADATA,
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
  onBuyHouseWithRespite?: (priceRespite: number) => boolean | void;
  recruitedFamilyMembers?: RecruitedFamilyMemberAgent[];
  onRecruitFamilyMember?: (
    planId: FamilyMemberContractPlanId,
  ) => RecruitedFamilyMemberAgent | null | void;
  onCommandFamilyMember?: (agentId: string, orderId: FamilyMemberOrderId) => void;
  ownedItemIds: string[];
  activeHouseThemeId: string;
  interiorPlacement: HouseInteriorPlacementState;
  isFastForwardRunning: boolean;
  onClose: () => void;
  onEarnSafezoneLul: (amount: number, reason: string) => void;
  onExchangeLulToCyon: (customLulSpent?: number, customCyonGranted?: number) => void;
  onSwapNearAndRespite?: (
    direction: 'near_to_respite' | 'respite_to_near',
    inputAmount: number,
  ) => NearRespiteSwapReceipt | null | void;
  onInvestInMerchant: () => void;
  onBuyMerchantItem: (item: MerchantCatalogItem, price: number) => void;
  onSellMerchantItem: (item: MerchantCatalogItem, refund: number) => void;
  onToggleFastForward: () => void;
  onSelectHouseTheme: (themeItem: MerchantCatalogItem) => void;
  onAssignInteriorSlot: (slot: HouseInteriorSlotId, itemId: string | null) => void;
  onRotateInteriorSlot: (slot: HouseInteriorSlotId) => void;
  onConnectWallet?: () => void;
  playerBubbleBgColor?: string;
  playerBubbleTextColor?: string;
  caughtFishBucket?: CaughtFishItem[];
  fishMarketListings?: FishNftMarketplaceListing[];
  playerNearAccount?: string;
  onSellCaughtFish?: (fish: CaughtFishItem) => void;
  onMintFishAsNft?: (fish: CaughtFishItem) => void;
  onListFishNftOnMarket?: (fish: CaughtFishItem, priceLul: number) => void;
  onBuyFishNftFromMarket?: (listing: FishNftMarketplaceListing) => void;
}

const SLOT_LABELS: Record<HouseInteriorSlotId, string> = {
  center_table: 'CENTER TABLE',
  left_wall: 'LEFT WALL',
  right_wall: 'RIGHT WALL',
  corner_plant: 'PLANT CORNER',
  trophy_pedestal: 'MAIN DISPLAY',
};

export const NpcMerchantAndHouseModal: React.FC<NpcMerchantAndHouseModalProps> = ({
  activeModalMode,
  merchantLocation,
  marketState,
  lulBalance,
  cyonBalance,
  respiteBalance,
  nearTestnetBalance = 12.5,
  walletConnected,
  hasHouseOwnership = false,
  onBuyHouseWithRespite,
  recruitedFamilyMembers = [],
  onRecruitFamilyMember,
  onCommandFamilyMember,
  ownedItemIds,
  activeHouseThemeId,
  interiorPlacement,
  isFastForwardRunning: _isFastForwardRunning,
  onClose,
  onEarnSafezoneLul: _onEarnSafezoneLul,
  onExchangeLulToCyon,
  onSwapNearAndRespite,
  onInvestInMerchant: _onInvestInMerchant,
  onBuyMerchantItem: _onBuyMerchantItem,
  onSellMerchantItem: _onSellMerchantItem,
  onToggleFastForward: _onToggleFastForward,
  onSelectHouseTheme,
  onAssignInteriorSlot,
  onRotateInteriorSlot,
  onConnectWallet,
  playerBubbleBgColor = '#0f172a',
  playerBubbleTextColor = '#f8fafc',
  caughtFishBucket = [],
  fishMarketListings = [],
  playerNearAccount = 'commander-p1.testnet',
  onSellCaughtFish,
  onMintFishAsNft,
  onListFishNftOnMarket,
  onBuyFishNftFromMarket,
}) => {
  const [activeTab, setActiveTab] = useState<'sesi_chat' | 'transaksi' | 'katalog' | 'fish_market'>(
    'sesi_chat',
  );
  const [npcFullText, setNpcFullText] = useState<string>('');
  const [npcTypedText, setNpcTypedText] = useState<string>('');
  const [lastPlayerMessage, setLastPlayerMessage] = useState<string>('');
  const [exchangeLulAmountStr, setExchangeLulAmountStr] = useState<string>('2000');
  const [cryptoSwapDirection, setCryptoSwapDirection] = useState<
    'near_to_respite' | 'respite_to_near'
  >('near_to_respite');
  const [cryptoSwapInputStr, setCryptoSwapInputStr] = useState<string>('1');
  const [lastCryptoSwapReceipt, setLastCryptoSwapReceipt] =
    useState<NearRespiteSwapReceipt | null>(null);
  const [selectedFamilyPlanId, setSelectedFamilyPlanId] =
    useState<FamilyMemberContractPlanId>('1_week');
  const [listingPriceByFishId, setListingPriceByFishId] = useState<Record<string, string>>({});

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

  // `buddies-blitz.com/interior` ("Set the Mood") Cutaway Studio State
  const [daylightHour, setDaylightHour] = useState<number>(18.5);
  const [floorSwatchId, setFloorSwatchId] = useState<string>('floor_tatami_oak');
  const [wallSwatchId, setWallSwatchId] = useState<string>('wall_limewash');
  const [slatsSwatchId, setSlatsSwatchId] = useState<string>('slats_walnut');
  const [placed3dItems, setPlaced3dItems] = useState<PlacedHouseFurnitureItem[]>([]);
  const [selected3dInstanceId, setSelected3dInstanceId] = useState<string | null>(null);
  const [showLegacySlots, setShowLegacySlots] = useState<boolean>(false);

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
      const locLabel = merchantLocation === 'lobby_cafe' ? 'Mini Cafe Lobby' : 'East Beach House';
      const greeting = !walletConnected
        ? `Hello and welcome, Buddy. It looks like you have not registered yet. Please register to access the Exchange and the full Catalog. Feel free to walk around or ask me any questions about this game.`
        : merchantLocation === 'beach_house'
          ? `Hello Buddy! Welcome to ${locLabel}. You can sell caught fish for LUL, or visit the CATALOG tab to buy a House and recruit a Family Member.`
          : `Hello Buddy! Welcome to ${locLabel}. You can exchange LUL to CYON, swap NEAR and RESPITE, or open the CATALOG tab to buy a House and recruit a Family Member.`;
      setNpcFullText(greeting);
      setNpcTypedText('');
      setLastPlayerMessage('');
    }
  }, [activeModalMode, merchantLocation, walletConnected]);

  // Typewriter effect for NPC dialogue
  useEffect(() => {
    if (activeModalMode !== 'npc_merchant' || !npcFullText) return;
    if (npcTypedText.length >= npcFullText.length) return;
    const timer = window.setTimeout(() => {
      setNpcTypedText(npcFullText.slice(0, npcTypedText.length + 2));
    }, 18);
    return () => window.clearTimeout(timer);
  }, [activeModalMode, npcFullText, npcTypedText]);

  const triggerNpcSpeech = (text: string) => {
    setNpcFullText(text);
    setNpcTypedText('');
  };

  // Receive player chat messages submitted via the bottom-left TALK input bar
  useEffect(() => {
    if (activeModalMode !== 'npc_merchant') return;
    const onUserChat = (ev: Event) => {
      const text = (ev as CustomEvent<{ text?: string }>).detail?.text?.trim();
      if (!text) return;
      setLastPlayerMessage(text);
      setActiveTab('sesi_chat');
      const reply = generateNpcMerchantReply(text, merchantLocation, marketState, {
        lul: lulBalance,
        cyon: cyonBalance,
        respite: respiteBalance,
        walletConnected,
      });
      triggerNpcSpeech(reply);
    };
    window.addEventListener('npc-merchant-user-chat', onUserChat);
    return () => window.removeEventListener('npc-merchant-user-chat', onUserChat);
  }, [
    activeModalMode,
    merchantLocation,
    marketState,
    lulBalance,
    cyonBalance,
    respiteBalance,
    walletConnected,
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
        aria-label="Private House Interior Manager"
        data-house-interior-modal="true"
        className="fixed inset-0 z-40 pointer-events-none select-none"
      >
        {/* Top-Center Interactive Hint Pill */}
        <div className="fixed top-3 left-1/2 -translate-x-1/2 pointer-events-auto bg-[#0f172a]/95 text-white border-[2.5px] border-[#0d0f12] shadow-[0_3px_0_#0d0f12] px-3.5 py-1.5 flex items-center gap-3">
          <span className="text-[10.5px] font-black uppercase tracking-wider text-[#b8ff3c]">
            CUTAWAY 3D STUDIO (BUDDIES.NET/INTERIOR)
          </span>
          <span className="text-[10px] font-bold text-white/90 hidden sm:inline">
            Click &amp; Drag Furniture on 3D Floor (10cm Snap + 25cm Wall Magnet) · Drag Empty Space = Orbit Camera · Scroll = Zoom / Rotate 45°
          </span>
          <button
            type="button"
            data-house-exit-btn="true"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            className="px-2.5 py-1 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-[#0d0f12] text-[10px] font-black uppercase cursor-pointer"
          >
            DONE EDITING [ESC]
          </button>
        </div>

        {/* Left Panel: Set the Mood + Softmax Mood Meter + NEP-245 Theme & Surface Swatches */}
        <div className="fixed top-16 left-3 w-[300px] sm:w-[325px] max-h-[calc(100vh-190px)] overflow-y-auto pointer-events-auto bg-white/95 border-[3px] border-[#0d0f12] shadow-[0_5px_0_#0d0f12] p-3 text-[#0d0f12] space-y-2.5">
          <div className="flex items-center justify-between border-b-2 border-[#0d0f12] pb-1.5">
            <div>
              <div className="text-[9.5px] font-black uppercase tracking-wider text-[#0f7a78]">
                SET THE MOOD · PRIVATE HOUSE
              </div>
              <h2 className="text-base font-black uppercase leading-tight">
                MOOD METER &amp; MATERIALS
              </h2>
            </div>
            <span className="px-2 py-0.5 bg-[#0d0f12] text-[#b8ff3c] text-[9.5px] font-black uppercase">
              {moodEval.dominantMood.toUpperCase()}
            </span>
          </div>

          {/* 3 Mood Presets (`Cozy`, `Bright`, `Moody`) */}
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'cozy', label: 'COZY 18:30', color: '#f5b82e' },
                { id: 'bright', label: 'BRIGHT 12:48', color: '#38bdf8' },
                { id: 'moody', label: 'MOODY 22:12', color: '#a855f7' },
              ] as const
            ).map((mp) => (
              <button
                key={mp.id}
                type="button"
                data-mood-preset={mp.id}
                onClick={() => handleApplyMoodPreset(mp.id)}
                className={`py-1.5 px-1.5 border-2 border-[#0d0f12] text-[9.5px] font-black uppercase cursor-pointer ${
                  moodEval.dominantMood === mp.id
                    ? 'bg-[#b8ff3c] shadow-[0_2px_0_#0d0f12]'
                    : 'bg-[#f4f6f8] hover:bg-[#e5e9ee]'
                }`}
              >
                {mp.label}
              </button>
            ))}
          </div>

          {/* Live Softmax Mood Meter Bars (`Cozy %`, `Bright %`, `Moody %` + Explanation) */}
          <div
            data-house-mood-meter="true"
            className="p-2.5 bg-[#0f172a] text-white border-2 border-[#0d0f12] space-y-1.5"
          >
            {(
              [
                { key: 'cozy', label: 'Cozy', pct: moodEval.cozyPct, barCol: '#f5b82e' },
                { key: 'bright', label: 'Bright', pct: moodEval.brightPct, barCol: '#38bdf8' },
                { key: 'moody', label: 'Moody', pct: moodEval.moodyPct, barCol: '#a855f7' },
              ] as const
            ).map((row) => (
              <div key={row.key} className="space-y-0.5">
                <div className="flex justify-between text-[10px] font-black uppercase">
                  <span>{row.label}</span>
                  <span>{row.pct}%</span>
                </div>
                <div className="w-full h-2 bg-[#1e293b] border border-white/30 overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{ width: `${row.pct}%`, backgroundColor: row.barCol }}
                  />
                </div>
              </div>
            ))}
            <p className="text-[9.5px] font-bold text-[#cbd5e1] leading-snug pt-1 border-t border-white/15">
              {moodEval.explanationText}
            </p>
          </div>

          {/* NEP-245 House Theme Selector (Triggers Radial 3D Wipe Ring) */}
          <div>
            <div className="text-[9.5px] font-black uppercase tracking-wider mb-1">
              HOUSE ARCHITECTURE THEME (NEP-245 NFT):
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
                    className={`p-1.5 border-2 border-[#0d0f12] flex items-center justify-between text-left cursor-pointer ${
                      isActive ? 'bg-[#b8ff3c] shadow-[0_2px_0_#0d0f12]' : 'bg-[#f4f6f8] hover:bg-[#e5e9ee]'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase truncate">{th.name}</span>
                    <span className="text-[8.5px] font-black uppercase px-1.5 py-0.5 bg-[#0d0f12] text-white shrink-0">
                      {isActive ? 'ACTIVE' : 'APPLY'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Surface Finish Swatches (Floor & Wall Radial Wipe Trigger) */}
          <div>
            <div className="text-[9.5px] font-black uppercase tracking-wider mb-1">
              FLOOR &amp; WALL MATERIALS (RADIAL 3D WIPE):
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
                        isCurrent ? 'bg-[#2bb3b1] text-[#0d0f12]' : 'bg-[#f4f6f8] hover:bg-white'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-[#0d0f12] shrink-0"
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

        {/* Right Panel: Daylight Time Slider (05:30 - 23:30) + Solar Arc Presets + Camera Reset */}
        <div className="fixed top-16 right-3 w-[250px] sm:w-[270px] pointer-events-auto bg-white/95 border-[3px] border-[#0d0f12] shadow-[0_5px_0_#0d0f12] p-3 text-[#0d0f12] space-y-2.5">
          <div className="flex items-center justify-between border-b-2 border-[#0d0f12] pb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider">
              DAYLIGHT &amp; SOLAR ARC
            </span>
            <span
              data-house-daylight-clock="true"
              className="px-2 py-0.5 bg-[#0f172a] text-[#fde047] font-mono text-[11px] font-black"
            >
              {formatDaylightHour(daylightHour)}
            </span>
          </div>

          <div>
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
            <div className="flex justify-between text-[8.5px] font-black text-[#475569] uppercase">
              <span>05:30</span>
              <span>12:00</span>
              <span>18:30</span>
              <span>23:30</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
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
                className={`py-1 px-2 border-2 border-[#0d0f12] text-[9.5px] font-black uppercase cursor-pointer ${
                  Math.abs(daylightHour - preset.h) < 0.4
                    ? 'bg-[#fde047] text-[#0d0f12]'
                    : 'bg-[#f4f6f8] hover:bg-[#e5e9ee]'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              dispatchHouseStudioPatch({ resetCamera: true });
            }}
            className="w-full py-1.5 bg-[#f4f6f8] hover:bg-[#e5e9ee] border-2 border-[#0d0f12] shadow-[0_2px_0_#0d0f12] text-[9.5px] font-black uppercase cursor-pointer"
          >
            RESET CUTAWAY CAMERA ANGLE
          </button>
        </div>

        {/* Bottom Dock: Free 3D Furniture Tray + Selected 3D Furniture Toolbar + Optional Slot View */}
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[96vw] max-w-[820px] pointer-events-auto bg-white/95 border-[3.5px] border-[#0d0f12] shadow-[0_6px_0_#0d0f12] p-3 text-[#0d0f12]">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b-2 border-[#0d0f12]">
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] font-black uppercase">
                YOUR FURNITURE CATALOG ({ownedFurniture.length} ITEMS)
              </span>
              <span className="text-[9.5px] font-bold text-[#0f7a78]">
                Click [+ PLACE IN 3D ROOM] then drag freely on the room floor!
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {selectedCatalogItem && (
                <div className="flex items-center gap-1 bg-[#0f172a] text-white px-2 py-1 border-2 border-[#0d0f12]">
                  <span className="text-[9.5px] font-black uppercase text-[#38bdf8]">
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
                    ROTATE +45°
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
              <button
                type="button"
                onClick={() => setShowLegacySlots((prev) => !prev)}
                className="px-2 py-1 bg-[#f4f6f8] border-2 border-[#0d0f12] text-[9px] font-black uppercase cursor-pointer"
              >
                {showLegacySlots ? 'HIDE QUICK SLOTS' : 'QUICK SLOTS (5 POSITIONS)'}
              </button>
            </div>
          </div>

          {/* Horizontal Free-Placement Furniture Cards */}
          <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
            {ownedFurniture.map((item) => (
              <div
                key={item.id}
                className="min-w-[175px] p-2 bg-[#f4f6f8] border-2 border-[#0d0f12] flex flex-col justify-between gap-1.5 shrink-0"
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`px-1 py-0.2 text-[8px] font-black uppercase border border-[#0d0f12] ${
                        item.isNft ? 'bg-[#38bdf8]' : 'bg-[#a7f3d0]'
                      }`}
                    >
                      {item.isNft ? 'NEP-245 NFT' : 'CYON ITEM'}
                    </span>
                  </div>
                  <div className="text-[10px] font-black uppercase truncate mt-0.5">
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
                  + PLACE IN 3D ROOM
                </button>
              </div>
            ))}
          </div>

          {/* Optional Quick-Slot Selector (Preserves 100% compatibility with slot-based assignment) */}
          {showLegacySlots && (
            <div className="mt-2 pt-2 border-t-2 border-[#0d0f12] grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[135px] overflow-y-auto">
              {(Object.keys(SLOT_LABELS) as HouseInteriorSlotId[]).map((slotId) => {
                const currentItemId = interiorPlacement[slotId];
                const slotItems = ownedFurniture.filter((f) => f.interiorSlot === slotId);
                const rotDeg = ((interiorPlacement.rotationStepBySlot[slotId] ?? 0) * 90) % 360;
                return (
                  <div
                    key={slotId}
                    className="p-1.5 bg-[#f4f6f8] border border-[#0d0f12] flex items-center justify-between gap-1.5"
                  >
                    <div className="min-w-0">
                      <div className="text-[9px] font-black uppercase">{SLOT_LABELS[slotId]}</div>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playUiClick();
                            onAssignInteriorSlot(slotId, null);
                          }}
                          className={`px-1.5 py-0.5 border border-[#0d0f12] text-[8.5px] font-black uppercase cursor-pointer ${
                            currentItemId === null ? 'bg-[#0d0f12] text-white' : 'bg-white'
                          }`}
                        >
                          CLEAR
                        </button>
                        {slotItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              soundEngine.playUiClick();
                              onAssignInteriorSlot(slotId, item.id);
                            }}
                            className={`px-1.5 py-0.5 border border-[#0d0f12] text-[8.5px] font-black uppercase cursor-pointer ${
                              currentItemId === item.id ? 'bg-[#2bb3b1]' : 'bg-white'
                            }`}
                          >
                            {item.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    {currentItemId && (
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          onRotateInteriorSlot(slotId);
                        }}
                        className="px-2 py-0.5 bg-white border border-[#0d0f12] text-[8.5px] font-black uppercase shrink-0 cursor-pointer"
                      >
                        ROTATE ({rotDeg}°)
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    );
  }

  const isNpcOpen = activeModalMode === 'npc_merchant';

  return (
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
        <div className="mt-3 flex-1 overflow-y-auto pr-1 space-y-3 min-h-0">
          {/* ===============================================================
              TAB 1: CHAT SESSION (NPC Chat Session — Chat Input Uses the Bottom Bar)
             =============================================================== */}
          {activeTab === 'sesi_chat' && (
            <div className="space-y-3">
              {/* Player Chat Bubble (When Player Sends a Message from the Bottom Bar) */}
              {lastPlayerMessage && (
                <div
                  data-player-chat-bubble="true"
                  style={{
                    backgroundColor: playerBubbleBgColor,
                    color: playerBubbleTextColor,
                  }}
                  className="p-3.5 border-[2.5px] border-black shadow-[4px_4px_0px_#000] mr-6"
                >
                  <div className="flex items-center justify-start mb-1.5">
                    <span className="px-2 py-0.5 bg-[#facc15] text-black border border-black text-[10.5px] font-black uppercase">
                      YOU
                    </span>
                  </div>
                  <p className="text-xs sm:text-[13px] font-bold leading-relaxed">
                    {lastPlayerMessage}
                  </p>
                </div>
              )}

              {/* Hana / NPC Chat Bubble */}
              <div
                data-npc-chat-bubble="true"
                className="p-3.5 bg-[#0f172a] text-white border-[2.5px] border-black shadow-[4px_4px_0px_#000]"
              >
                <div className="flex items-center justify-end mb-2">
                  <span className="px-2.5 py-0.5 bg-[#2bb3b1] text-black border border-black text-[10.5px] font-black uppercase">
                    {npcShortName}
                  </span>
                </div>
                <p className="text-xs sm:text-[13px] font-bold leading-relaxed text-[#f8fafc] min-h-[72px]">
                  {npcTypedText}
                  {npcTypedText.length < npcFullText.length && (
                    <span className="inline-block w-1.5 h-3.5 bg-[#b8ff3c] ml-0.5 animate-pulse" />
                  )}
                </p>
              </div>
            </div>
          )}

          {/* ===============================================================
              TAB 2: EXCHANGE
              1) Top Card: Non-Crypto Exchange (LUL -> CYON)
              2) Bottom Card: NEAR Protocol Crypto Smart Contract Swap (NEAR Testnet <-> RESPITE NEP-141)
             =============================================================== */}
          {activeTab === 'transaksi' && (() => {
            const rateLul = 20;
            const rateCyon = 10;
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
            const isNearToRespite = cryptoSwapDirection === 'near_to_respite';
            const calculatedCryptoOutput = isNearToRespite
              ? Math.floor(parsedCryptoInput * respitePerNearRate)
              : Number((parsedCryptoInput / respitePerNearRate).toFixed(4));

            const canPerformCryptoSwap =
              walletConnected &&
              (isNearToRespite
                ? parsedCryptoInput >= 0.05 &&
                  parsedCryptoInput <= nearTestnetBalance &&
                  calculatedCryptoOutput >= 1
                : parsedCryptoInput >= 10 &&
                  parsedCryptoInput <= respiteBalance &&
                  calculatedCryptoOutput > 0);

            return (
              <div className="space-y-3.5">
                {/* Top-Up / Register or Wallet Box */}
                <div className="p-3 bg-[#0f172a] text-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10.5px] font-black uppercase text-[#38bdf8]">
                      {walletConnected ? 'WALLET AND CURRENCY EXCHANGE' : 'REGISTRATION REQUIRED'}
                    </div>
                    <div className="text-[10px] font-bold text-white/85 mt-0.5">
                      {walletConnected
                        ? `${playerNearAccount} | ${nearTestnetBalance.toFixed(2)} NEAR | ${respiteBalance.toLocaleString()} RESPITE`
                        : 'You are playing as a Guest. Please register to receive your wallet and unlock the Exchange.'}
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
                        {walletConnected ? 'WALLET' : 'REGISTER'}
                      </span>
                    </button>
                  )}
                </div>

                {/* ===========================================================
                    CARD 1: NON-CRYPTO EXCHANGE (LUL -> CYON)
                    Locked when playing as an unregistered Guest
                   =========================================================== */}
                <div
                  data-lul-cyon-exchange-card="true"
                  className={`bg-[#0f172a] text-white border-[3px] border-black shadow-[4px_4px_0px_#000] overflow-hidden ${
                    !walletConnected ? 'opacity-65 pointer-events-none select-none' : ''
                  }`}
                >
                  {/* Exchange Banner */}
                  <div className="px-4 py-2 bg-[#1e293b] border-b-2 border-black flex items-center justify-between gap-2 flex-wrap">
                    <span className="-skew-x-6 px-2 py-0.5 bg-[#fec83e] text-black border border-black text-[9.5px] font-black uppercase">
                      <span className="skew-x-6 inline-block">LUL TO CYON</span>
                    </span>
                    <span className="text-[9.5px] font-bold text-slate-300">
                      Exchange LUL for CYON
                    </span>
                  </div>

                  <div className="p-4 sm:p-5 space-y-3.5">
                    {/* Exchange Rate Header */}
                    <div className="text-center space-y-1">
                      <div className="text-xs font-black uppercase tracking-wider text-slate-200">
                        Exchange Rate
                      </div>
                      <div className="flex items-center justify-center gap-2.5 text-lg sm:text-xl font-black">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="-skew-x-6 px-2 py-0.5 bg-[#fec83e] text-black border-2 border-black shadow-[2px_2px_0_#000] text-[10px] font-black uppercase">
                            <span className="skew-x-6 inline-block">LUL</span>
                          </span>
                          <span className="text-white">{rateLul}</span>
                        </span>
                        <span className="text-slate-400">=</span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="-skew-x-6 px-2 py-0.5 bg-[#38bdf8] text-black border-2 border-black shadow-[2px_2px_0_#000] text-[10px] font-black uppercase">
                            <span className="skew-x-6 inline-block">CYON</span>
                          </span>
                          <span className="text-white">{rateCyon}</span>
                        </span>
                      </div>
                    </div>

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

                    {/* Middle Label: You will receive */}
                    <div className="text-center text-xs font-black uppercase tracking-wider text-slate-200">
                      You will receive
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
                  <div className="border-t-2 border-white/25 bg-[#141c2e] px-5 py-3.5 flex justify-center">
                    <button
                      type="button"
                      data-exchange-submit-btn="true"
                      disabled={!canPerformExchange}
                      onClick={() => {
                        if (!canPerformExchange) return;
                        soundEngine.playUiClick();
                        onExchangeLulToCyon(parsedLul, calculatedCyon);
                        triggerNpcSpeech(
                          `Done! ${parsedLul} LUL has been exchanged for +${calculatedCyon} CYON.`,
                        );
                      }}
                      className={`-skew-x-6 min-w-[190px] py-2.5 px-6 border-2 border-black text-xs sm:text-sm font-black uppercase tracking-wider shadow-[3px_3px_0px_#000] transition-all ${
                        canPerformExchange
                          ? 'bg-[#10b981] hover:bg-[#34d399] text-black cursor-pointer active:translate-x-[1px] active:translate-y-[1px]'
                          : 'bg-slate-600 text-slate-300 cursor-not-allowed'
                      }`}
                    >
                      <span className="skew-x-6 inline-block">EXCHANGE LUL TO CYON</span>
                    </button>
                  </div>
                </div>

                {/* ===========================================================
                    CARD 2: NEAR <-> RESPITE SWAP
                    Locked when playing as an unregistered Guest
                   =========================================================== */}
                <div
                  data-near-respite-swap-card="true"
                  className={`bg-[#0f172a] text-white border-[3px] border-black shadow-[4px_4px_0px_#000] overflow-hidden ${
                    !walletConnected ? 'opacity-65 pointer-events-none select-none' : ''
                  }`}
                >
                  {/* Header Banner */}
                  <div className="px-4 py-2 bg-[#1e1b4b] border-b-2 border-black flex items-center justify-between gap-2 flex-wrap">
                    <span className="-skew-x-6 px-2 py-0.5 bg-[#d8b4fe] text-black border border-black text-[9.5px] font-black uppercase">
                      <span className="skew-x-6 inline-block">NEAR AND RESPITE</span>
                    </span>
                    <span className="text-[9.5px] font-bold text-slate-300">
                      Swap NEAR and RESPITE
                    </span>
                  </div>

                  <div className="p-4 sm:p-5 space-y-3.5">
                    {/* Swap Direction Switch & Live Rate */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-black/45 p-1 border border-white/20">
                        <button
                          type="button"
                          data-swap-dir-near-to-respite="true"
                          onClick={() => {
                            soundEngine.playUiClick();
                            setCryptoSwapDirection('near_to_respite');
                            setCryptoSwapInputStr('1');
                          }}
                          className={`px-2.5 py-1 text-[10px] font-black uppercase cursor-pointer transition-colors ${
                            isNearToRespite
                              ? 'bg-[#38bdf8] text-black border border-black'
                              : 'text-white/75 hover:text-white'
                          }`}
                        >
                          NEAR TO RESPITE
                        </button>
                        <button
                          type="button"
                          data-swap-dir-respite-to-near="true"
                          onClick={() => {
                            soundEngine.playUiClick();
                            setCryptoSwapDirection('respite_to_near');
                            setCryptoSwapInputStr('100');
                          }}
                          className={`px-2.5 py-1 text-[10px] font-black uppercase cursor-pointer transition-colors ${
                            !isNearToRespite
                              ? 'bg-[#d8b4fe] text-black border border-black'
                              : 'text-white/75 hover:text-white'
                          }`}
                        >
                          RESPITE TO NEAR
                        </button>
                      </div>

                      <div className="flex items-center justify-center gap-2.5 text-base sm:text-lg font-black pt-0.5">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="-skew-x-6 px-2 py-0.5 bg-[#38bdf8] text-black border-2 border-black shadow-[2px_2px_0_#000] text-[10px] font-black uppercase">
                            <span className="skew-x-6 inline-block">NEAR</span>
                          </span>
                          <span className="text-white">1</span>
                        </span>
                        <span className="text-slate-400">=</span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="-skew-x-6 px-2 py-0.5 bg-[#d8b4fe] text-black border-2 border-black shadow-[2px_2px_0_#000] text-[10px] font-black uppercase">
                            <span className="skew-x-6 inline-block">RESPITE</span>
                          </span>
                          <span className="text-white">{respitePerNearRate}</span>
                        </span>
                      </div>
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
                        min={isNearToRespite ? 0.1 : 10}
                        step={isNearToRespite ? 0.5 : 10}
                        max={isNearToRespite ? nearTestnetBalance : respiteBalance}
                        data-near-respite-swap-input="true"
                        value={cryptoSwapInputStr}
                        onChange={(e) => setCryptoSwapInputStr(e.target.value)}
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

                    {lastCryptoSwapReceipt && (
                      <div
                        data-near-respite-swap-receipt="true"
                        className="p-2 bg-black/50 border border-[#10b981] text-[10px] font-bold text-slate-200 text-center"
                      >
                        Swapped {lastCryptoSwapReceipt.nearAmount} NEAR and{' '}
                        {lastCryptoSwapReceipt.respiteAmount} RESPITE
                      </div>
                    )}
                  </div>

                  {/* Bottom Divider & Swap Submit Button */}
                  <div className="border-t-2 border-white/25 bg-[#141c2e] px-5 py-3.5 flex items-center justify-center gap-3 flex-wrap">
                    <button
                      type="button"
                      data-near-respite-swap-submit-btn="true"
                      disabled={!canPerformCryptoSwap}
                      onClick={() => {
                        if (!canPerformCryptoSwap) return;
                        soundEngine.playUiClick();
                        const receipt = onSwapNearAndRespite?.(
                          cryptoSwapDirection,
                          parsedCryptoInput,
                        );
                        if (receipt) {
                          setLastCryptoSwapReceipt(receipt);
                        }
                        triggerNpcSpeech(
                          isNearToRespite
                            ? `Swap complete! Swapped ${parsedCryptoInput} NEAR for +${calculatedCryptoOutput} RESPITE.`
                            : `Swap complete! Swapped ${parsedCryptoInput} RESPITE for +${calculatedCryptoOutput} NEAR.`,
                        );
                      }}
                      className={`-skew-x-6 min-w-[210px] py-2.5 px-6 border-2 border-black text-xs sm:text-sm font-black uppercase tracking-wider shadow-[3px_3px_0px_#000] transition-all ${
                        canPerformCryptoSwap
                          ? 'bg-[#d8b4fe] hover:bg-[#e9d5ff] text-black cursor-pointer active:translate-x-[1px] active:translate-y-[1px]'
                          : 'bg-slate-600 text-slate-300 cursor-not-allowed'
                      }`}
                    >
                      <span className="skew-x-6 inline-block">
                        {isNearToRespite ? 'SWAP NEAR TO RESPITE' : 'SWAP RESPITE TO NEAR'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ===============================================================
              TAB 3: CATALOG (Buy House & Recruit Family Member)
             =============================================================== */}
          {activeTab === 'katalog' && (() => {
            const selectedFamilyPlan =
              FAMILY_MEMBER_CONTRACT_PLANS.find((p) => p.id === selectedFamilyPlanId) ||
              FAMILY_MEMBER_CONTRACT_PLANS[0];
            const isHouseOwned = Boolean(walletConnected && hasHouseOwnership);
            const canAffordHouse =
              walletConnected && respiteBalance >= HOUSE_OWNERSHIP_PRICE_RESPITE;
            const canAffordFamilyMember =
              walletConnected && respiteBalance >= selectedFamilyPlan.priceRespite;

            return (
              <div className="space-y-3.5" data-catalog-house-and-family-panel="true">
                {/* Top RESPITE Balance / Registration Required Bar */}
                <div className="p-3 bg-[#0f172a] text-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10.5px] font-black uppercase text-[#d8b4fe]">
                      {walletConnected
                        ? 'HOUSE AND FAMILY MEMBER'
                        : 'REGISTRATION REQUIRED FOR FULL CATALOG'}
                    </div>
                    <div className="text-[10px] font-bold text-white/85 mt-0.5">
                      {walletConnected
                        ? `Balance: ${respiteBalance.toLocaleString()} RESPITE`
                        : 'You are playing as a Guest. Register your account to unlock House ownership and Family Member recruitment.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      onConnectWallet?.();
                    }}
                    className={`-skew-x-6 px-3 py-1.5 font-black text-[10px] uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer shrink-0 ${
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

                {/* Product Card Grid: 1) HOUSE & 2) FAMILY MEMBER */}
                <div
                  className={`grid grid-cols-2 gap-3 ${
                    !walletConnected ? 'opacity-70 pointer-events-none select-none' : ''
                  }`}
                >
                  {/* Card 1: BUY HOUSE */}
                  <div
                    data-katalog-card="buddies_house_ownership"
                    className="group relative h-[162px] sm:h-[172px] text-left select-none bg-[#2bb3b1] p-[3.5px] border-[3px] border-[#0d0f12] shadow-[0_3.5px_0_#0d0f12]"
                  >
                    <div className="relative h-full flex flex-col justify-between bg-white border-[2px] border-[#0d0f12] p-2.5 overflow-hidden">
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <div
                            className="text-[11.5px] sm:text-[13px] font-black uppercase tracking-tight leading-[1.1] text-[#0d0f12]"
                            style={{ fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif" }}
                          >
                            HOUSE
                          </div>
                          <div className="text-[9px] sm:text-[9.5px] font-extrabold uppercase tracking-tight text-[#1c2026] mt-0.5">
                            PRIVATE HOME
                          </div>
                        </div>
                        <span className="px-1.5 py-0.5 bg-[#d8b4fe] text-[#0d0f12] border border-[#0d0f12] text-[9px] font-black uppercase shrink-0">
                          {HOUSE_OWNERSHIP_PRICE_RESPITE} RESPITE
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-center h-[80px] sm:h-[86px]">
                        <img
                          src="/assets/kiosk/hq_super_command.png"
                          alt="Private House Ownership"
                          draggable={false}
                          className="w-full h-[76px] sm:h-[82px] object-contain select-none pointer-events-none"
                        />
                      </div>

                      <div className="text-[9px] font-bold text-[#1c2026] truncate">
                        Unlocks Private House and Plot
                      </div>
                    </div>
                  </div>

                  {/* Card 2: FAMILY MEMBER */}
                  <div
                    data-katalog-card="buddies_family_member_agent"
                    className="group relative h-[162px] sm:h-[172px] text-left select-none bg-[#facc15] p-[3.5px] border-[3px] border-[#0d0f12] shadow-[0_3.5px_0_#0d0f12]"
                  >
                    <div className="relative h-full flex flex-col justify-between bg-white border-[2px] border-[#0d0f12] p-2.5 overflow-hidden">
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <div
                            className="text-[11.5px] sm:text-[13px] font-black uppercase tracking-tight leading-[1.1] text-[#0d0f12]"
                            style={{ fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif" }}
                          >
                            FAMILY MEMBER
                          </div>
                          <div className="text-[9px] sm:text-[9.5px] font-extrabold uppercase tracking-tight text-[#1c2026] mt-0.5">
                            COMPANION HELPER
                          </div>
                        </div>
                        <span className="px-1.5 py-0.5 bg-[#d8b4fe] text-[#0d0f12] border border-[#0d0f12] text-[9px] font-black uppercase shrink-0">
                          {selectedFamilyPlan.priceRespite} RESPITE
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-center h-[80px] sm:h-[86px]">
                        <img
                          src="/assets/kiosk/street_rookie.png"
                          alt="Family Member Companion"
                          draggable={false}
                          className="w-full h-[76px] sm:h-[82px] object-contain select-none pointer-events-none"
                        />
                      </div>

                      <div className="text-[9px] font-bold text-[#1c2026] truncate">
                        Collect Boxes, Fish, or Attack in Warzone
                      </div>
                    </div>
                  </div>
                </div>

                {/* ===========================================================
                     SECTION 1: BUY HOUSE (WITH RESPITE)
                    =========================================================== */}
                <div
                  data-buy-house-section="true"
                  className={`p-3 bg-[#f4f6f8] border-[2.5px] border-[#0d0f12] shadow-[0_2.5px_0_#0d0f12] space-y-2.5 ${
                    !walletConnected ? 'opacity-65 pointer-events-none select-none' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-tight text-[#0d0f12]">
                        BUY HOUSE
                      </div>
                      <div className="text-[10px] font-bold text-[#1c2026]/85">
                        Grants permanent ownership of your Private House.
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 border-[2px] border-[#0d0f12] text-[10px] font-black uppercase shadow-[0_1.5px_0_#0d0f12] shrink-0 ${
                        isHouseOwned
                          ? 'bg-[#b8ff3c] text-[#0d0f12]'
                          : 'bg-[#d8b4fe] text-[#0d0f12]'
                      }`}
                    >
                      {isHouseOwned ? 'HOUSE OWNED' : `${HOUSE_OWNERSHIP_PRICE_RESPITE} RESPITE`}
                    </span>
                  </div>

                  <button
                    type="button"
                    data-buy-house-btn="true"
                    disabled={!isHouseOwned && !canAffordHouse}
                    onClick={() => {
                      soundEngine.playUiClick();
                      if (isHouseOwned) {
                        triggerNpcSpeech(
                          'You already own your House. You can enter your Private House anytime.',
                        );
                        return;
                      }
                      const ok = onBuyHouseWithRespite?.(HOUSE_OWNERSHIP_PRICE_RESPITE);
                      if (ok !== false) {
                        triggerNpcSpeech(
                          `House purchased for ${HOUSE_OWNERSHIP_PRICE_RESPITE} RESPITE!`,
                        );
                      }
                    }}
                    className={`w-full py-2.5 px-4 border-[2.5px] border-[#0d0f12] font-black text-xs uppercase tracking-wider shadow-[2px_3px_0_#0d0f12] -skew-x-6 transition-all ${
                      isHouseOwned
                        ? 'bg-[#b8ff3c] text-[#0d0f12] cursor-pointer'
                        : canAffordHouse
                          ? 'bg-[#2bb3b1] hover:bg-[#38bdf8] text-[#0d0f12] cursor-pointer'
                          : 'bg-slate-400 text-slate-700 cursor-not-allowed'
                    }`}
                  >
                    <span className="inline-block skew-x-6">
                      {isHouseOwned
                        ? 'HOUSE OWNED'
                        : `BUY HOUSE (${HOUSE_OWNERSHIP_PRICE_RESPITE} RESPITE)`}
                    </span>
                  </button>
                </div>

                {/* ===========================================================
                     SECTION 2: RECRUIT FAMILY MEMBER
                     Contract Duration Options: 1 Week, 1 Month, 1 Year
                    =========================================================== */}
                <div
                  data-recruit-family-member-section="true"
                  className={`p-3 bg-[#0f172a] text-white border-[2.5px] border-[#0d0f12] shadow-[0_3px_0_#0d0f12] space-y-3 ${
                    !walletConnected ? 'opacity-65 pointer-events-none select-none' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-2">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-wider text-[#facc15]">
                        RECRUIT FAMILY MEMBER
                      </div>
                      <div className="text-[10px] font-bold text-slate-300 mt-0.5">
                        Select a duration to recruit with RESPITE:
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-[#d8b4fe] text-black border border-black text-[9.5px] font-black uppercase shrink-0">
                      ACTIVE: {recruitedFamilyMembers.length}
                    </span>
                  </div>

                  {/* Contract Duration Options: 1 Week, 1 Month, 1 Year */}
                  <div className="grid grid-cols-3 gap-2">
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
                          className={`p-2 text-center border-2 border-black transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#facc15] text-black shadow-[2px_2px_0_#000]'
                              : 'bg-[#1e293b] hover:bg-[#334155] text-white'
                          }`}
                        >
                          <div className="text-[10px] font-black uppercase">{plan.shortLabel}</div>
                          <div
                            className={`text-xs font-black mt-0.5 ${
                              isSelected ? 'text-black' : 'text-[#d8b4fe]'
                            }`}
                          >
                            {plan.priceRespite} RESPITE
                          </div>
                          <div
                            className={`text-[8.5px] font-bold mt-0.5 ${
                              isSelected ? 'text-black/80' : 'text-slate-300'
                            }`}
                          >
                            {plan.durationDays} Days
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    data-recruit-family-member-btn="true"
                    disabled={!canAffordFamilyMember}
                    onClick={() => {
                      if (!canAffordFamilyMember) return;
                      soundEngine.playUiClick();
                      const recruited = onRecruitFamilyMember?.(selectedFamilyPlan.id);
                      triggerNpcSpeech(
                        recruited
                          ? `Recruited ${recruited.name} (${selectedFamilyPlan.shortLabel}) for ${selectedFamilyPlan.priceRespite} RESPITE!`
                          : `Family Member recruited (${selectedFamilyPlan.shortLabel})!`,
                      );
                    }}
                    className={`-skew-x-6 w-full py-2.5 px-4 border-2 border-black font-black text-xs uppercase tracking-wider shadow-[3px_3px_0_#000] transition-all ${
                      canAffordFamilyMember
                        ? 'bg-[#d8b4fe] hover:bg-[#e9d5ff] text-black cursor-pointer'
                        : 'bg-slate-600 text-slate-300 cursor-not-allowed'
                    }`}
                  >
                    <span className="inline-block skew-x-6">
                      RECRUIT FAMILY MEMBER ({selectedFamilyPlan.shortLabel} -{' '}
                      {selectedFamilyPlan.priceRespite} RESPITE)
                    </span>
                  </button>

                  {/* =========================================================
                      SECTION 3: COMMAND RECRUITED FAMILY MEMBERS
                      Orders: Collect Boxes, Go Fishing, Armed Warzone Attack
                     ========================================================= */}
                  <div className="pt-2 border-t border-white/15 space-y-2">
                    <div className="text-[10.5px] font-black uppercase tracking-wider text-[#38bdf8]">
                      FAMILY MEMBER ORDERS
                    </div>
                    {recruitedFamilyMembers.length === 0 ? (
                      <div className="p-2.5 bg-black/40 border border-white/15 text-[10px] font-bold text-slate-300">
                        No Family Member recruited yet.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {recruitedFamilyMembers.map((member) => {
                          const currentOrderSpec =
                            FAMILY_MEMBER_ORDER_SPECS.find((o) => o.id === member.activeOrder) ||
                            FAMILY_MEMBER_ORDER_SPECS[0];
                          return (
                            <div
                              key={member.agentId}
                              data-family-member-item={member.agentId}
                              className="p-2.5 bg-[#1e293b] border-2 border-black shadow-[2px_2px_0_#000] space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <div className="text-[11px] font-black uppercase text-white">
                                    {member.name} ({member.planLabel})
                                  </div>
                                  <div className="text-[9.5px] font-bold text-[#38bdf8]">
                                    Order: {currentOrderSpec.label}
                                  </div>
                                </div>
                                <span className="px-1.5 py-0.5 bg-[#b8ff3c] text-black text-[9px] font-black uppercase border border-black shrink-0">
                                  ACTIVE
                                </span>
                              </div>

                              <div className="grid grid-cols-3 gap-1.5">
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
                                          `Order confirmed for ${member.name}: ${orderSpec.label}. ${orderSpec.description} (+${orderSpec.rewardLul} LUL activity reward).`,
                                        );
                                      }}
                                      className={`py-1.5 px-2 border border-black text-[9px] font-black uppercase cursor-pointer transition-colors ${
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
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ===============================================================
              TAB 4: FISH MARKET (Beach NPC Kai Only: Sell Raw Fish for LUL, Self-Pay Mint Rare Fish NFT, & P2P Marketplace)
             =============================================================== */}
          {merchantLocation === 'beach_house' && activeTab === 'fish_market' && (
            <div className="space-y-3" data-fish-market-panel="true">
              {/* Top Balance & Ecosystem Header */}
              <div className="p-3 bg-[#0f172a] text-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black uppercase text-[#b8ff3c]">
                    KAI&apos;S COASTAL &amp; OASIS FISH EXCHANGE
                  </span>
                  <span className="px-2 py-0.5 bg-[#fec83e] text-black border border-black text-[10px] font-black uppercase">
                    BALANCE: {lulBalance.toLocaleString()} LUL
                  </span>
                </div>
                <p className="text-[10px] font-bold text-slate-300 leading-snug">
                  Fish near any water (East Beach or Central Oasis Lake). Sell normal catches for instant LUL, or pay the mint fee yourself to turn rare catches into tradable NFTs on Kai&apos;s Marketplace.
                </p>
              </div>

              {/* SECTION 1: YOUR FISH BUCKET (RAW CATCHES & MINTED FISH NFTs) */}
              <div className="p-3 bg-[#f8fafc] border-[2.5px] border-black shadow-[3px_3px_0px_#000] space-y-2.5">
                <div className="flex items-center justify-between border-b-2 border-black pb-1.5">
                  <span className="text-[11px] font-black uppercase">
                    1. YOUR FISH BUCKET ({caughtFishBucket.length})
                  </span>
                  <span className="text-[9.5px] font-extrabold uppercase text-slate-600">
                    Press [F] near any water to catch
                  </span>
                </div>

                {caughtFishBucket.length === 0 ? (
                  <div className="py-4 px-3 bg-white border-2 border-dashed border-slate-400 text-center text-[11px] font-bold text-slate-600">
                    Your Fish Bucket is empty. Walk to the East Beach shoreline or the Central Oasis Lake and press [F] CAST ROD to catch fish!
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {caughtFishBucket.map((fish) => {
                      const canAffordMint = lulBalance >= fish.mintFeeLul;
                      const defaultSuggestedPrice = Math.max(
                        fish.sellValueLul + fish.mintFeeLul + 100,
                        Math.round(fish.sellValueLul * 2.2),
                      );
                      const priceInputStr =
                        listingPriceByFishId[fish.id] ?? String(defaultSuggestedPrice);
                      const parsedListPrice = Math.max(
                        10,
                        Math.floor(Number(priceInputStr) || defaultSuggestedPrice),
                      );

                      const rarityBadgeStyle =
                        fish.rarity === 'Mythic'
                          ? 'bg-[#c084fc] text-black'
                          : fish.rarity === 'Rare'
                            ? 'bg-[#facc15] text-black'
                            : fish.rarity === 'Uncommon'
                              ? 'bg-[#2dd4bf] text-black'
                              : 'bg-slate-200 text-black';

                      return (
                        <div
                          key={fish.id}
                          data-fish-bucket-item={fish.speciesId}
                          className="p-2.5 bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex flex-col gap-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
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
                                </span>
                                {fish.isMintedNft && (
                                  <span className="px-1.5 py-0.5 bg-[#b8ff3c] text-black border border-black text-[8.5px] font-black uppercase">
                                    MINTED NFT
                                  </span>
                                )}
                              </div>
                              <div className="text-[9.5px] font-bold text-slate-600 mt-0.5">
                                Caught at {fish.waterZoneLabel} · {fish.loreTag}
                              </div>
                              {fish.isMintedNft && fish.nftTokenId && (
                                <div className="text-[9px] font-mono font-bold text-[#0f7a78] mt-0.5">
                                  Token: {fish.nftTokenId}
                                </div>
                              )}
                            </div>
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
                                    `Fresh ${fish.speciesName} (${fish.weightKg} kg)! Here is +${fish.sellValueLul} LUL for your catch.`,
                                  );
                                }}
                                className="flex-1 py-1.5 px-2.5 bg-[#fec83e] hover:bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0_#000] text-[10px] font-black uppercase cursor-pointer"
                              >
                                SELL TO MERCHANT (+{fish.sellValueLul} LUL)
                              </button>

                              <button
                                type="button"
                                data-mint-fish-btn={fish.id}
                                disabled={!canAffordMint}
                                onClick={() => {
                                  if (!canAffordMint) return;
                                  soundEngine.playUiClick();
                                  onMintFishAsNft?.(fish);
                                  triggerNpcSpeech(
                                    `Minted! Your ${fish.weightKg} kg ${fish.speciesName} is now a verifiable NEP-171 Fish NFT. You can list it on my marketplace below!`,
                                  );
                                }}
                                className={`flex-1 py-1.5 px-2.5 border-2 border-black shadow-[2px_2px_0_#000] text-[10px] font-black uppercase ${
                                  canAffordMint
                                    ? 'bg-[#38bdf8] hover:bg-[#7dd3fc] text-black cursor-pointer'
                                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                }`}
                              >
                                MINT AS NFT (-{fish.mintFeeLul} LUL FEE)
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200">
                              <div className="flex items-center gap-1">
                                <span className="text-[9.5px] font-black uppercase">
                                  SET PRICE (LUL):
                                </span>
                                <input
                                  type="number"
                                  min={10}
                                  step={10}
                                  value={priceInputStr}
                                  onChange={(e) =>
                                    setListingPriceByFishId((prev) => ({
                                      ...prev,
                                      [fish.id]: e.target.value,
                                    }))
                                  }
                                  className="w-24 px-2 py-1 bg-slate-100 border-2 border-black text-[10.5px] font-black"
                                />
                              </div>
                              <button
                                type="button"
                                data-list-fish-nft-btn={fish.id}
                                onClick={() => {
                                  soundEngine.playUiClick();
                                  onListFishNftOnMarket?.(fish, parsedListPrice);
                                  triggerNpcSpeech(
                                    `Listed! Your ${fish.speciesName} NFT (${fish.weightKg} kg) is now live on Kai's Marketplace for ${parsedListPrice} LUL.`,
                                  );
                                }}
                                className="flex-1 py-1.5 px-3 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-2 border-black shadow-[2px_2px_0_#000] text-[10px] font-black uppercase cursor-pointer"
                              >
                                LIST ON MARKETPLACE ({parsedListPrice} LUL)
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION 2: KAI'S P2P FISH NFT MARKETPLACE (LIVE SUPABASE SYNC) */}
              <div className="p-3 bg-[#0f172a] text-white border-[2.5px] border-black shadow-[3px_3px_0px_#000] space-y-2.5">
                <div className="flex items-center justify-between border-b border-white/20 pb-1.5">
                  <span className="text-[11px] font-black uppercase text-[#38bdf8]">
                    2. KAI&apos;S P2P FISH NFT MARKETPLACE ({fishMarketListings.length} LISTED)
                  </span>
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-[#10b981] text-black">
                    LIVE P2P
                  </span>
                </div>

                {fishMarketListings.length === 0 ? (
                  <div className="py-4 text-center text-[11px] font-bold text-slate-400">
                    No Fish NFTs currently listed. Mint a rare catch above and be the first to list!
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[230px] overflow-y-auto pr-1">
                    {fishMarketListings.map((listing) => {
                      const isOwnListing =
                        listing.sellerNearAccount.toLowerCase() ===
                        playerNearAccount.toLowerCase();
                      const canBuy = isOwnListing || lulBalance >= listing.priceLul;
                      const rarityBadgeStyle =
                        listing.rarity === 'Mythic'
                          ? 'bg-[#c084fc] text-black'
                          : listing.rarity === 'Rare'
                            ? 'bg-[#facc15] text-black'
                            : listing.rarity === 'Uncommon'
                              ? 'bg-[#2dd4bf] text-black'
                              : 'bg-slate-200 text-black';

                      return (
                        <div
                          key={listing.listingId}
                          data-fish-market-listing={listing.listingId}
                          className="p-2.5 bg-[#1e293b] border-2 border-black shadow-[2px_2px_0_#000] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
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
                              </span>
                            </div>
                            <div className="text-[9.5px] font-bold text-slate-300 mt-0.5 truncate">
                              Zone: {listing.waterZoneLabel} · Angler: {listing.caughtByAccount}
                            </div>
                            <div className="text-[9px] font-mono text-slate-400 truncate">
                              Seller: {listing.sellerNearAccount} · {listing.nftTokenId}
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={!canBuy}
                            onClick={() => {
                              if (!canBuy) return;
                              soundEngine.playUiClick();
                              onBuyFishNftFromMarket?.(listing);
                              triggerNpcSpeech(
                                isOwnListing
                                  ? `Listing cancelled! ${listing.speciesName} (${listing.weightKg} kg) returned to your Fish Bucket.`
                                  : `Purchased ${listing.speciesName} NFT (${listing.weightKg} kg) from ${listing.sellerNearAccount} for ${listing.priceLul} LUL!`,
                              );
                            }}
                            className={`px-3 py-2 border-2 border-black shadow-[2px_2px_0_#000] text-[10px] font-black uppercase shrink-0 ${
                              isOwnListing
                                ? 'bg-[#facc15] hover:bg-[#fde047] text-black cursor-pointer'
                                : canBuy
                                  ? 'bg-[#b8ff3c] hover:bg-[#d9f99d] text-black cursor-pointer'
                                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            {isOwnListing
                              ? 'UNLIST NFT'
                              : `BUY (${listing.priceLul.toLocaleString()} LUL)`}
                          </button>
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
  );
};

