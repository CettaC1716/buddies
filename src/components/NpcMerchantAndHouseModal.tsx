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
  walletConnected: boolean;
  ownedItemIds: string[];
  activeHouseThemeId: string;
  interiorPlacement: HouseInteriorPlacementState;
  isFastForwardRunning: boolean;
  onClose: () => void;
  onEarnSafezoneLul: (amount: number, reason: string) => void;
  onExchangeLulToCyon: (customLulSpent?: number, customCyonGranted?: number) => void;
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
  walletConnected,
  ownedItemIds,
  activeHouseThemeId,
  interiorPlacement,
  isFastForwardRunning: _isFastForwardRunning,
  onClose,
  onEarnSafezoneLul: _onEarnSafezoneLul,
  onExchangeLulToCyon,
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
}) => {
  const [activeTab, setActiveTab] = useState<'sesi_chat' | 'transaksi' | 'katalog'>('sesi_chat');
  const [npcFullText, setNpcFullText] = useState<string>('');
  const [npcTypedText, setNpcTypedText] = useState<string>('');
  const [lastPlayerMessage, setLastPlayerMessage] = useState<string>('');
  const [exchangeLulAmountStr, setExchangeLulAmountStr] = useState<string>('2000');

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
      const locLabel = merchantLocation === 'lobby_cafe' ? 'Mini Café Lobby' : 'East Beach House';
      const greeting = `Hello Buddy! Welcome to ${locLabel}. How can I help you today? You can chat with me in the CHAT SESSION tab, exchange LUL -> CYON in the EXCHANGE tab, or browse collectibles in the CATALOG tab!`;
      setNpcFullText(greeting);
      setNpcTypedText('');
      setLastPlayerMessage('');
    }
  }, [activeModalMode, merchantLocation]);

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
            EXIT HOUSE [ESC]
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
              TAB 2: EXCHANGE (LUL -> CYON Exchange)
             =============================================================== */}
          {activeTab === 'transaksi' && (() => {
            const rateLul = 20;
            const rateCyon = 10;
            const parsedLul = Math.max(0, Math.floor(Number(exchangeLulAmountStr) || 0));
            const calculatedCyon = Math.floor((parsedLul / rateLul) * rateCyon);
            const canPerformExchange =
              exchangeQuote.canExchange &&
              parsedLul >= rateLul &&
              parsedLul <= lulBalance &&
              calculatedCyon > 0;

            return (
              <div className="space-y-3">
                {/* Top-Up RESPITE / Connect Wallet Box */}
                <div className="p-3 bg-[#0f172a] text-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10.5px] font-black uppercase text-[#38bdf8]">
                      NEAR WALLET &amp; RESPITE TOP-UP
                    </div>
                    <div className="text-[10px] font-bold text-white/85 mt-0.5">
                      {walletConnected
                        ? `Connected · Balance: ${lulBalance.toLocaleString()} LUL | ${cyonBalance.toLocaleString()} CYON | ${respiteBalance.toLocaleString()} RESPITE`
                        : 'Connect NEAR Wallet to receive RESPITE balance & full access.'}
                    </div>
                  </div>
                  {onConnectWallet && (
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        onConnectWallet();
                      }}
                      className="-skew-x-6 px-2.5 py-1.5 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black font-black text-[10px] uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer shrink-0"
                    >
                      <span className="skew-x-6 inline-block">
                        {walletConnected ? 'TOP-UP RESPITE' : 'CONNECT WALLET'}
                      </span>
                    </button>
                  )}
                </div>

                {/* LUL -> CYON Exchange Card */}
                <div
                  data-lul-cyon-exchange-card="true"
                  className="bg-[#0f172a] text-white border-[3px] border-black shadow-[4px_4px_0px_#000] overflow-hidden"
                >
                  <div className="p-5 space-y-4">
                    {/* Exchange Rate Header */}
                    <div className="text-center space-y-1.5">
                      <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-200">
                        Current exchange rate
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
                      <div className="-skew-x-6 w-14 py-2 bg-[#fec83e] text-black border-2 border-black shadow-[2px_2px_0_#000] text-center text-[11px] font-black uppercase shrink-0">
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
                    <div className="text-center text-xs sm:text-sm font-black uppercase tracking-wider text-slate-200">
                      You will receive
                    </div>

                    {/* CYON Output Row */}
                    <div className="flex items-center gap-3 max-w-xs mx-auto">
                      <div className="-skew-x-6 w-14 py-2 bg-[#38bdf8] text-black border-2 border-black shadow-[2px_2px_0_#000] text-center text-[11px] font-black uppercase shrink-0">
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
                  <div className="border-t-2 border-white/25 bg-[#141c2e] px-5 py-4 flex justify-center">
                    <button
                      type="button"
                      data-exchange-submit-btn="true"
                      disabled={!canPerformExchange}
                      onClick={() => {
                        if (!canPerformExchange) return;
                        soundEngine.playUiClick();
                        onExchangeLulToCyon(parsedLul, calculatedCyon);
                        triggerNpcSpeech(
                          `Done! ${parsedLul} LUL has been exchanged for +${calculatedCyon} CYON!`,
                        );
                      }}
                      className={`-skew-x-6 min-w-[180px] py-2.5 px-6 border-2 border-black text-sm font-black uppercase tracking-wider shadow-[3px_3px_0px_#000] transition-all ${
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
              TAB 3: CATALOG (Kiosk-Style Gamepass Catalog with Product Image)
             =============================================================== */}
          {activeTab === 'katalog' && (
            <div className="space-y-3">
              {/* Connect Wallet Box Above Catalog */}
              <div className="p-3 bg-[#0f172a] text-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-2">
                <span className="text-[10.5px] font-bold">
                  Connect NEAR Wallet to claim Gamepasses, House Theme NFTs, &amp; special collectibles.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onConnectWallet?.();
                  }}
                  className="-skew-x-6 px-2.5 py-1.5 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black font-black text-[10px] uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer shrink-0"
                >
                  <span className="skew-x-6 inline-block">CONNECT WALLET</span>
                </button>
              </div>

              {/* Kiosk-Style Product Card Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  data-katalog-card="buddies_vip_gamepass"
                  className="group relative h-[156px] sm:h-[168px] text-left select-none bg-[#2bb3b1] p-[3.5px] border-[3px] border-[#0d0f12] shadow-[0_3.5px_0_#0d0f12]"
                >
                  <div className="relative h-full flex flex-col justify-between bg-white border-[2px] border-[#0d0f12] p-2.5 overflow-hidden">
                    {/* Top-Right Teal Corner Checkmark Badge */}
                    <div
                      className="absolute -top-[2px] -right-[2px] w-7 h-7 bg-[#2bb3b1] border-l-[2.5px] border-b-[2.5px] border-[#0d0f12] flex items-center justify-center z-10"
                      style={{
                        clipPath: 'polygon(0 0, 100% 0, 100% 100%, 22% 100%, 0 78%)',
                      }}
                    >
                      <svg
                        viewBox="0 0 20 20"
                        className="w-4 h-4 stroke-[#0d0f12] fill-none"
                        strokeWidth="3.2"
                      >
                        <polyline
                          points="3.5,10.5 8,15 16.5,5.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>

                    <div className="pr-6">
                      <div
                        className="text-[11.5px] sm:text-[13px] font-black uppercase tracking-tight leading-[1.1] text-[#0d0f12]"
                        style={{ fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif" }}
                      >
                        VIP PLOT &amp; HARVESTER PASS
                      </div>
                      <div className="text-[9.5px] sm:text-[10px] font-extrabold uppercase tracking-tight text-[#1c2026] mt-0.5">
                        [NEP-171 // GAMEPASS]
                      </div>
                    </div>

                    <div className="mt-1 flex items-center justify-center h-[82px] sm:h-[90px]">
                      <img
                        src="/assets/kiosk/hq_super_command.png"
                        alt="VIP Plot & Harvester Gamepass"
                        draggable={false}
                        className="w-full h-[80px] sm:h-[88px] object-contain select-none pointer-events-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Kiosk-Style Status Bar */}
              <div className="mt-3 px-3 py-2 bg-[#f4f6f8] border-[2.5px] border-[#0d0f12] shadow-[0_2px_0_#0d0f12] flex items-center justify-between gap-2">
                <span className="text-[10.5px] font-black uppercase tracking-tight text-[#0d0f12]">
                  GAMEPASS STATUS:
                </span>
                <span
                  className={`px-2 py-0.5 border-[2px] border-[#0d0f12] text-[10.5px] font-black uppercase shadow-[0_1.5px_0_#0d0f12] ${
                    walletConnected
                      ? 'bg-[#b8ff3c] text-[#0d0f12]'
                      : 'bg-[#2bb3b1] text-[#0d0f12]'
                  }`}
                >
                  {walletConnected ? 'ACTIVE (OWNED)' : 'AVAILABLE (NEP-171)'}
                </span>
              </div>

              {/* Kiosk-Style Footer Action Bar */}
              <div className="mt-3.5 pt-1 flex items-center justify-between gap-3">
                <div className="px-3 h-11 bg-[#f4f6f8] border-[3px] border-[#0d0f12] shadow-[0_3.5px_0_#0d0f12] flex items-center justify-center text-[11px] font-black tracking-tight text-[#0d0f12] select-none">
                  01 / 01
                </div>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    if (!walletConnected && onConnectWallet) {
                      onConnectWallet();
                      triggerNpcSpeech(
                        'Congratulations! Your NEP-171 VIP Plot & Harvester Gamepass is now active! You can now claim private house plots & base plots.',
                      );
                    } else {
                      triggerNpcSpeech(
                        'Your VIP Gamepass is already active! You can claim any house plot or base plot directly at the Plot Kiosk.',
                      );
                    }
                  }}
                  className={`h-11 px-6 sm:px-8 active:translate-y-0.5 border-[3.5px] border-[#0d0f12] font-black text-base sm:text-lg uppercase tracking-tight shadow-[3px_4px_0_#0d0f12] -skew-x-6 cursor-pointer transition-all ${
                    walletConnected
                      ? 'bg-[#b8ff3c] hover:bg-[#d2ff7a] text-[#0d0f12]'
                      : 'bg-[#e2e6ea] hover:bg-[#2bb3b1] text-[#0d0f12]'
                  }`}
                  style={{ fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif" }}
                >
                  <span className="inline-block skew-x-6">
                    {walletConnected ? 'ACTIVE' : 'BUY GAMEPASS'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

