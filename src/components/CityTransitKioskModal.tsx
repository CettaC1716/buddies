import React, { useEffect, useMemo, useState } from 'react';
import {
  CITY_TRANSIT_DESTINATIONS,
  CityTransitDestinationSpec,
  CityTransitStationId,
  getCityTransitDestinationById,
} from '../game/buddiesBlitzRules';
import { soundEngine } from '../game/audio';

export interface CityTransitKioskModalProps {
  isOpen: boolean;
  originStationId: CityTransitStationId;
  worldMode: 'lobby' | 'safezone' | 'warzone' | 'house_interior';
  blueTeamOnlineCount: number;
  redTeamOnlineCount: number;
  hasOwnedHouse: boolean;
  onClose: () => void;
  onConfirmEnterDestination: (
    destination: CityTransitDestinationSpec,
    team?: 'blue' | 'red',
  ) => void;
  onEnterMyHouseStudio: () => void;
  onOpenHouseCatalog: () => void;
  onOpenShopAndExchange: () => void;
  isTutorialTourActive?: boolean;
  onCompleteTutorialTour?: () => void;
}

const RECENT_STATIONS_STORAGE_KEY = 'buddies_blitz_recent_transit_stations_v1';

export const CityTransitKioskModal: React.FC<CityTransitKioskModalProps> = ({
  isOpen,
  originStationId,
  worldMode,
  blueTeamOnlineCount,
  redTeamOnlineCount,
  hasOwnedHouse,
  onClose,
  onConfirmEnterDestination,
  onEnterMyHouseStudio,
  onOpenHouseCatalog,
  onOpenShopAndExchange,
  isTutorialTourActive = false,
  onCompleteTutorialTour,
}) => {
  const [levelView, setLevelView] = useState<'grid' | 'browser' | 'warzoneTeamSelect'>('grid');
  const [browserSectionTitle, setBrowserSectionTitle] = useState<string>('TRAVEL & DISTRICTS');
  const [selectedStationId, setSelectedStationId] = useState<CityTransitStationId>('central_plaza');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showRecentOnly, setShowRecentOnly] = useState<boolean>(false);
  const [recentStationIds, setRecentStationIds] = useState<CityTransitStationId[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(RECENT_STATIONS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed.filter((id): id is CityTransitStationId =>
              CITY_TRANSIT_DESTINATIONS.some((d) => d.id === id),
            );
          }
        }
      } catch {
        // ignore storage errors
      }
    }
    return ['central_plaza', 'beachfront_harbor', 'nw_fishing_lake'];
  });

  const activeOriginId: CityTransitStationId =
    worldMode === 'warzone' ? 'warzone_arena' : originStationId;
  const originSpec = getCityTransitDestinationById(activeOriginId);

  useEffect(() => {
    if (isOpen) {
      setLevelView('grid');
      setSearchQuery('');
      setShowRecentOnly(false);
      const defaultTarget: CityTransitStationId =
        activeOriginId === 'central_plaza' ? 'beachfront_harbor' : 'central_plaza';
      setSelectedStationId(defaultTarget);
    }
  }, [isOpen, activeOriginId]);

  const recordRecentStation = (stationId: CityTransitStationId) => {
    setRecentStationIds((prev) => {
      const next = [stationId, ...prev.filter((id) => id !== stationId)].slice(0, 5);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(RECENT_STATIONS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const filteredDestinations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return CITY_TRANSIT_DESTINATIONS.filter((dest) => {
      if (showRecentOnly && !recentStationIds.includes(dest.id)) {
        return false;
      }
      if (!q) return true;
      return (
        dest.title.toLowerCase().includes(q) ||
        dest.shortTitle.toLowerCase().includes(q) ||
        dest.tag.toLowerCase().includes(q) ||
        dest.description.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, showRecentOnly, recentStationIds]);

  const selectedDestination: CityTransitDestinationSpec = useMemo(() => {
    const found = filteredDestinations.find((d) => d.id === selectedStationId);
    if (found) return found;
    if (filteredDestinations.length > 0) return filteredDestinations[0];
    return getCityTransitDestinationById(selectedStationId);
  }, [filteredDestinations, selectedStationId]);

  if (!isOpen) return null;

  const isAlreadyAtSelected =
    selectedDestination.id === activeOriginId &&
    ((selectedDestination.targetWorldMode === 'warzone' && worldMode === 'warzone') ||
      (selectedDestination.targetWorldMode !== 'warzone' && worldMode !== 'warzone'));

  const handleOpenTravelBrowser = () => {
    soundEngine.playUiClick();
    setBrowserSectionTitle('TRAVEL & DISTRICTS');
    setSearchQuery('');
    setShowRecentOnly(false);
    const defaultDistrict: CityTransitStationId =
      activeOriginId === 'central_plaza' ? 'beachfront_harbor' : 'central_plaza';
    setSelectedStationId(defaultDistrict);
    setLevelView('browser');
  };

  const handleOpenWarzoneBrowser = () => {
    soundEngine.playUiClick();
    if (worldMode === 'warzone') {
      // If already in warzone, return to The City
      const centralDest = getCityTransitDestinationById('central_plaza');
      onConfirmEnterDestination(centralDest);
      return;
    }
    setBrowserSectionTitle('WARZONE ARENA // SELECT FACTION');
    setLevelView('warzoneTeamSelect');
  };

  const handleClickMyHouse = () => {
    soundEngine.playUiClick();
    if (hasOwnedHouse) {
      onEnterMyHouseStudio();
    } else {
      onOpenHouseCatalog();
    }
  };

  const handleClickShopExchange = () => {
    soundEngine.playUiClick();
    onOpenShopAndExchange();
  };

  const handleConfirmEnter = () => {
    if (isAlreadyAtSelected) return;
    soundEngine.playUiClick();
    recordRecentStation(selectedDestination.id);
    onConfirmEnterDestination(selectedDestination);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="City Transit Self-Service Kiosk"
      data-teleport-kiosk-modal="true"
      data-transit-kiosk-level={levelView}
      className="fixed inset-0 z-[105] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs pointer-events-auto select-none"
      onClick={() => {
        soundEngine.playUiClick();
        onClose();
      }}
    >
      <div
        className="relative w-full max-w-[920px] bg-white border-[4px] border-black shadow-[10px_10px_0px_#000] text-black overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* =================================================================
            TOP HEADER BAR
            ================================================================= */}
        <div className="px-4 sm:px-6 py-3.5 bg-[#0f172a] border-b-[4px] border-black flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {worldMode !== 'warzone' && levelView !== 'grid' && (
              <button
                type="button"
                data-transit-kiosk-back="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  setLevelView('grid');
                }}
                className="px-3 py-1.5 bg-[#facc15] hover:bg-[#fde047] text-black border-[3px] border-black shadow-[3px_3px_0px_#000] font-black text-xs uppercase tracking-wider cursor-pointer active:translate-y-0.5 transition-all shrink-0"
              >
                &lt; BACK
              </button>
            )}
            <div className="min-w-0">
              <h2
                className="text-lg sm:text-2xl font-black uppercase italic tracking-tight text-white truncate"
                style={{ fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif" }}
              >
                {worldMode === 'warzone'
                  ? 'WARZONE EVACUATION TERMINAL'
                  : levelView === 'grid'
                    ? 'CITY TRANSIT & SERVICES KIOSK'
                    : browserSectionTitle}
              </h2>
            </div>
          </div>

          <button
            type="button"
            data-teleport-kiosk-close="true"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            aria-label="Close City Transit Kiosk"
            className="w-9 h-9 bg-[#ef4444] hover:bg-[#f87171] text-white border-[3px] border-black shadow-[3px_3px_0px_#000] font-black text-base flex items-center justify-center cursor-pointer active:translate-y-0.5 transition-transform shrink-0"
          >
            X
          </button>
        </div>

        {/* =================================================================
            WARZONE MODE: STRICTLY EXIT WARZONE TERMINAL (NO OTHER MENUS)
            ================================================================= */}
        {worldMode === 'warzone' ? (
          <div className="p-6 sm:p-10 bg-[#0f172a] text-white flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-[#ef4444]/20 border-2 border-[#ef4444] flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.35)]">
              <svg viewBox="0 0 24 24" className="w-8 h-8 stroke-[#ef4444] fill-none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>
            <div className="space-y-2 max-w-md">
              <div className="inline-block px-3 py-1 bg-[#ef4444] text-white border-2 border-black text-xs font-black uppercase tracking-widest shadow-[3px_3px_0_#000]">
                WARZONE OUTPOST
              </div>
              <h3
                className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white"
                style={{ fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif" }}
              >
                KELUAR DARI WARZONE
              </h3>
              <p className="text-xs sm:text-sm font-bold text-slate-300">
                Akhiri sesi pertempuran tactical Warzone dan kembali ke Central Plaza di kota utama (The City).
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md pt-2">
              <button
                type="button"
                data-leave-warzone-btn="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  const centralDest = getCityTransitDestinationById('central_plaza');
                  onConfirmEnterDestination(centralDest);
                }}
                className="w-full sm:flex-1 py-3 px-6 bg-[#facc15] hover:bg-[#fde047] text-black border-[3px] border-black shadow-[4px_4px_0px_#000] font-black text-sm uppercase tracking-wider cursor-pointer active:translate-y-0.5 transition-all"
              >
                KELUAR KE KOTA UTAMA
              </button>

              <button
                type="button"
                data-cancel-leave-warzone-btn="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  onClose();
                }}
                className="w-full sm:w-auto py-3 px-6 bg-slate-800 hover:bg-slate-700 text-slate-200 border-[3px] border-black shadow-[4px_4px_0px_#000] font-black text-xs uppercase tracking-wider cursor-pointer active:translate-y-0.5 transition-all"
              >
                TETAP DI WARZONE
              </button>
            </div>
          </div>
        ) : levelView === 'grid' ? (
          <div className="p-4 sm:p-6 bg-[#f1f5f9]">
            {isTutorialTourActive && (
              <div
                data-kiosk-tutorial-tour-banner="true"
                className="mb-4 p-3.5 sm:p-4 bg-[#0f172a] text-white border-[3px] border-black shadow-[5px_5px_0px_#000] space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 bg-[#38bdf8] text-black border-2 border-black text-[10px] font-black uppercase tracking-wider">
                    🧭 PANDUAN PORTAL KIOSK TELEPORT (TUTORIAL AKHIR)
                  </span>
                  <span className="text-[10.5px] font-bold text-[#b8ff3c]">
                    Pusat Akses Mini-Game, Distrik &amp; Rumah Pribadi
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-bold leading-snug">
                  <div className="p-2 bg-[#1e293b] border border-white/20">
                    <span className="text-[#00f0ff] font-black">1. TRAVEL &amp; DISTRICTS:</span>{' '}
                    Naik trem cepat ke Beachfront Harbor (Merchant Kai &amp; pancing pantai), NW Fishing Lake, atau Kavling Perumahan.
                  </div>
                  <div className="p-2 bg-[#1e293b] border border-white/20">
                    <span className="text-[#facc15] font-black">2. WARZONE ARENA:</span>{' '}
                    Pilih Tim <span className="text-[#38bdf8]">BLUE</span> vs <span className="text-[#ff6b6b]">RED</span> &rarr; cutscene trem &rarr; bertempur rebut drop LUL &amp; kendaraan airdrop!
                  </div>
                  <div className="p-2 bg-[#1e293b] border border-white/20">
                    <span className="text-[#a3e635] font-black">3. MY HOUSE:</span>{' '}
                    Teleport langsung masuk ke interior Studio Rumah 3D pribadimu untuk menata furnitur &amp; mengundang teman.
                  </div>
                  <div className="p-2 bg-[#1e293b] border border-white/20">
                    <span className="text-[#c084fc] font-black">4. SHOP &amp; EXCHANGE:</span>{' '}
                    Pintasan cepat membuka Katalog &amp; konversi LUL &rarr; CYON / NEAR &rarr; RESPITE.
                  </div>
                </div>

                {onCompleteTutorialTour && (
                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      data-kiosk-complete-tutorial-btn="true"
                      onClick={() => {
                        soundEngine.playPickup();
                        onCompleteTutorialTour();
                      }}
                      className="-skew-x-6 px-4 py-2 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-2 border-black shadow-[3px_3px_0px_#000] font-black text-xs uppercase tracking-wider cursor-pointer active:translate-y-0.5"
                    >
                      <span className="skew-x-6 inline-block">
                        ✅ PAHAM — SELESAI TUTORIAL &amp; MULAI EXPLORE!
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-black uppercase tracking-wider text-slate-700">
                SELECT DESTINATION OR CITIZEN SERVICE
              </div>
              <div className="px-2.5 py-1 bg-white border-[2.5px] border-black text-[11px] font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_#000]">
                CURRENT STATION: {originSpec.title}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* CARD 1: TRAVEL & DISTRICTS */}
              <button
                type="button"
                data-transit-card="travel_districts"
                data-teleport-option="safezone"
                onClick={handleOpenTravelBrowser}
                className="group relative h-[196px] sm:h-[214px] bg-white border-[3.5px] border-black shadow-[6px_6px_0px_#000] hover:-translate-y-0.5 transition-all text-left overflow-hidden flex flex-col justify-between cursor-pointer"
              >
                <img
                  src="/docs/hero-2-tram-station.jpg"
                  alt="Travel & Districts"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />

                <div className="relative z-10 p-3.5 flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-[#00f0ff] text-black border-[2px] border-black text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_#000]">
                    THE CITY NETWORK
                  </span>
                  <span className="px-2 py-0.5 bg-black/80 text-white border-[2px] border-white/80 text-[10px] font-black uppercase">
                    5 DISTRICTS
                  </span>
                </div>

                <div className="relative z-10 p-4 pt-0">
                  <div
                    className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white drop-shadow-[0_2px_0_#000]"
                    style={{ fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif" }}
                  >
                    TRAVEL &amp; DISTRICTS
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-200 line-clamp-2">
                    Fast-travel by City Tram across Central Plaza, Beachfront Harbor, NW Fishing Lake, and North/South Residences.
                  </p>
                </div>
              </button>

              {/* CARD 2: WARZONE ARENA */}
              <button
                type="button"
                data-transit-card="warzone_arena"
                data-teleport-option="warzone"
                onClick={handleOpenWarzoneBrowser}
                className="group relative h-[196px] sm:h-[214px] bg-white border-[3.5px] border-black shadow-[6px_6px_0px_#000] hover:-translate-y-0.5 transition-all text-left overflow-hidden flex flex-col justify-between cursor-pointer"
              >
                <img
                  src="/docs/hero-7-crate-stacking-pad.jpg"
                  alt="Warzone Arena"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />

                <div className="relative z-10 p-3.5 flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 bg-[#facc15] text-black border-[2px] border-black text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_#000]">
                    MINI-GAME
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      data-transit-warzone-blue-count="true"
                      className="px-2 py-0.5 bg-[#38bdf8] text-black border-[2px] border-black text-[10px] font-black uppercase"
                    >
                      BLUE {blueTeamOnlineCount}/10
                    </span>
                    <span
                      data-transit-warzone-red-count="true"
                      className="px-2 py-0.5 bg-[#f87171] text-black border-[2px] border-black text-[10px] font-black uppercase"
                    >
                      RED {redTeamOnlineCount}/10
                    </span>
                  </div>
                </div>

                <div className="relative z-10 p-4 pt-0">
                  <div
                    className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white drop-shadow-[0_2px_0_#000]"
                    style={{ fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif" }}
                  >
                    WARZONE ARENA
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-200 line-clamp-2">
                    Deploy into the Red vs Blue tactical combat arena with weapons, vehicles, and crate logistics.
                  </p>
                </div>
              </button>

              {/* CARD 3: MY HOUSE */}
              <button
                type="button"
                data-transit-card="my_house"
                onClick={handleClickMyHouse}
                className="group relative h-[196px] sm:h-[214px] bg-white border-[3.5px] border-black shadow-[6px_6px_0px_#000] hover:-translate-y-0.5 transition-all text-left overflow-hidden flex flex-col justify-between cursor-pointer"
              >
                <img
                  src="/docs/hero-3-house-interior.jpg"
                  alt="My House 3D Studio"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />

                <div className="relative z-10 p-3.5 flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-[#a3e635] text-black border-[2px] border-black text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_#000]">
                    HOUSE
                  </span>
                  <span className="px-2 py-0.5 bg-black/80 text-white border-[2px] border-white/80 text-[10px] font-black uppercase">
                    {hasOwnedHouse ? 'INSTANT ENTRY' : 'BROWSE HOMES'}
                  </span>
                </div>

                <div className="relative z-10 p-4 pt-0">
                  <div
                    className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white drop-shadow-[0_2px_0_#000]"
                    style={{ fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif" }}
                  >
                    MY HOUSE
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-200 line-clamp-2">
                    {hasOwnedHouse
                      ? 'Enter your private 3D House Interior studio directly from this kiosk to hang out and decorate furniture.'
                      : 'Browse and acquire a NEP-171 House NFT to unlock your personal 3D interior studio and city plots.'}
                  </p>
                </div>
              </button>

              {/* CARD 4: SHOP & EXCHANGE */}
              <button
                type="button"
                data-transit-card="shop_exchange"
                onClick={handleClickShopExchange}
                className="group relative h-[196px] sm:h-[214px] bg-white border-[3.5px] border-black shadow-[6px_6px_0px_#000] hover:-translate-y-0.5 transition-all text-left overflow-hidden flex flex-col justify-between cursor-pointer"
              >
                <img
                  src="/docs/hero-4-hana-exchange.jpg"
                  alt="Shop & Exchange"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />

                <div className="relative z-10 p-3.5 flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-[#c084fc] text-black border-[2px] border-black text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_#000]">
                    HANA CATALOG &amp; DEX
                  </span>
                  <span className="px-2 py-0.5 bg-black/80 text-white border-[2px] border-white/80 text-[10px] font-black uppercase">
                    LUL / CYON / RESPITE
                  </span>
                </div>

                <div className="relative z-10 p-4 pt-0">
                  <div
                    className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white drop-shadow-[0_2px_0_#000]"
                    style={{ fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif" }}
                  >
                    SHOP &amp; EXCHANGE
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-200 line-clamp-2">
                    Open the City Catalog, furniture items, outfits, and LUL / CYON / RESPITE token exchange counter.
                  </p>
                </div>
              </button>
            </div>
          </div>
        ) : levelView === 'warzoneTeamSelect' ? (
          /* =================================================================
             WARZONE MINI-GAME TEAM SELECT VIEW (RED FACTION vs BLUE FACTION)
             ================================================================= */
          <div className="p-4 sm:p-6 bg-[#0f172a] text-white">
            <div className="mb-4 text-center">
              <div className="inline-block px-3 py-1 bg-[#facc15] text-black border-2 border-black font-black text-xs uppercase tracking-wider shadow-[2px_2px_0px_#000] mb-2">
                WARZONE MINI-GAME DEPLOYMENT
              </div>
              <h3
                className="text-xl sm:text-3xl font-black uppercase italic tracking-tight text-white drop-shadow-[0_2px_0_#000]"
                style={{ fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif" }}
              >
                CHOOSE YOUR TEAM FACTION
              </h3>
              <p className="mt-1 text-xs sm:text-sm font-bold text-slate-300 max-w-lg mx-auto">
                Select your squad to board the City Transit Tram and spawn randomly at the combat Cratepad. Compete to collect LUL drops and battle the opposition!
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
              {/* BLUE TEAM CARD */}
              <button
                type="button"
                data-select-warzone-team="blue"
                onClick={() => {
                  soundEngine.playUiClick();
                  const warzoneDest = getCityTransitDestinationById('warzone_arena');
                  recordRecentStation('warzone_arena');
                  onConfirmEnterDestination(warzoneDest, 'blue');
                }}
                className="group relative p-5 bg-[#1e293b] hover:bg-[#0284c7] border-[4px] border-black shadow-[6px_6px_0px_#000] hover:-translate-y-1 transition-all text-left flex flex-col justify-between cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-3 py-1 bg-[#38bdf8] text-black border-[2px] border-black font-black text-xs uppercase tracking-wider shadow-[2px_2px_0px_#000]">
                    SOUTHERN SECTOR
                  </span>
                  <span className="px-2.5 py-0.5 bg-black/80 text-[#38bdf8] border border-[#38bdf8] text-xs font-black uppercase">
                    {blueTeamOnlineCount}/10 PLAYERS
                  </span>
                </div>

                <div className="my-2">
                  <div
                    className="text-2xl sm:text-3xl font-black uppercase italic text-white group-hover:text-yellow-300 transition-colors"
                    style={{ fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif" }}
                  >
                    BLUE TEAM
                  </div>
                  <div className="text-xs font-bold text-slate-300 group-hover:text-white mt-1">
                    Spawn at Southern base cratepad ring with tactical pistol loadout.
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-[#38bdf8] group-hover:text-yellow-300">
                    CLICK TO DEPLOY &gt;
                  </span>
                  <span className="px-2 py-0.5 bg-[#38bdf8] text-black font-black text-[10px] uppercase border border-black shadow-[1.5px_1.5px_0_#000]">
                    BLUE
                  </span>
                </div>
              </button>

              {/* RED TEAM CARD */}
              <button
                type="button"
                data-select-warzone-team="red"
                onClick={() => {
                  soundEngine.playUiClick();
                  const warzoneDest = getCityTransitDestinationById('warzone_arena');
                  recordRecentStation('warzone_arena');
                  onConfirmEnterDestination(warzoneDest, 'red');
                }}
                className="group relative p-5 bg-[#1e293b] hover:bg-[#dc2626] border-[4px] border-black shadow-[6px_6px_0px_#000] hover:-translate-y-1 transition-all text-left flex flex-col justify-between cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-3 py-1 bg-[#f87171] text-black border-[2px] border-black font-black text-xs uppercase tracking-wider shadow-[2px_2px_0px_#000]">
                    NORTHERN SECTOR
                  </span>
                  <span className="px-2.5 py-0.5 bg-black/80 text-[#f87171] border border-[#f87171] text-xs font-black uppercase">
                    {redTeamOnlineCount}/10 PLAYERS
                  </span>
                </div>

                <div className="my-2">
                  <div
                    className="text-2xl sm:text-3xl font-black uppercase italic text-white group-hover:text-yellow-300 transition-colors"
                    style={{ fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif" }}
                  >
                    RED TEAM
                  </div>
                  <div className="text-xs font-bold text-slate-300 group-hover:text-white mt-1">
                    Spawn at Northern base cratepad ring with tactical pistol loadout.
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-[#f87171] group-hover:text-yellow-300">
                    CLICK TO DEPLOY &gt;
                  </span>
                  <span className="px-2 py-0.5 bg-[#f87171] text-black font-black text-[10px] uppercase border border-black shadow-[1.5px_1.5px_0_#000]">
                    RED
                  </span>
                </div>
              </button>
            </div>
          </div>
        ) : (
          /* =================================================================
             LEVEL 2: MASTER-DETAIL SPLIT-VIEW BROWSER
             - Left Sidebar (~28% width, scrollable)
             - Right Showcase Panel (~72% width, hero preview + ENTER >)
             - Bottom Bar (RECENT quick filter + Search... input)
             ================================================================= */
          <div className="flex flex-col bg-[#f8fafc]">
            <div className="flex flex-col md:flex-row h-[420px] sm:h-[440px] border-b-[4px] border-black">
              {/* LEFT SIDEBAR (~28% WIDTH) */}
              <div
                data-transit-sidebar="true"
                className="w-full md:w-[28%] h-[165px] md:h-full overflow-y-auto border-b-[3px] md:border-b-0 md:border-r-[4px] border-black bg-[#e2e8f0] p-2.5 space-y-2"
              >
                {filteredDestinations.length === 0 ? (
                  <div className="p-4 text-center text-xs font-black uppercase text-slate-600">
                    NO MATCHING STATIONS
                  </div>
                ) : (
                  filteredDestinations.map((dest) => {
                    const isSelected = dest.id === selectedDestination.id;
                    const isHere = dest.id === activeOriginId;

                    return (
                      <button
                        key={dest.id}
                        type="button"
                        data-transit-destination-row={dest.id}
                        onClick={() => {
                          soundEngine.playUiClick();
                          setSelectedStationId(dest.id);
                        }}
                        className={`w-full p-2 flex items-center gap-2.5 text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#facc15] border-[3px] border-black shadow-[3px_3px_0px_#000] -translate-y-0.5'
                            : 'bg-white hover:bg-slate-100 border-[2.5px] border-black shadow-[2px_2px_0px_#000]'
                        }`}
                      >
                        <img
                          src={dest.heroImageUrl}
                          alt={dest.shortTitle}
                          className="w-11 h-11 object-cover border-[2px] border-black shrink-0 bg-slate-900"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-black uppercase tracking-tight text-black truncate">
                            {dest.shortTitle}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5">
                            {isHere ? (
                              <span className="px-1.5 py-0.5 bg-[#a3e635] text-black border-[1.5px] border-black text-[9px] font-black uppercase">
                                HERE
                              </span>
                            ) : (
                              <span
                                className={`px-1.5 py-0.5 border-[1.5px] border-black text-[9px] font-black uppercase ${
                                  dest.id === 'warzone_arena'
                                    ? 'bg-[#f87171] text-black'
                                    : 'bg-[#00f0ff] text-black'
                                }`}
                              >
                                {dest.tag}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* RIGHT SHOWCASE PANEL (~72% WIDTH) */}
              <div className="w-full md:w-[72%] flex-1 relative bg-slate-950 overflow-hidden flex flex-col justify-between">
                <img
                  src={selectedDestination.heroImageUrl}
                  alt={selectedDestination.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/15" />

                {/* Top Badges inside Right Showcase */}
                <div className="relative z-10 p-4 flex items-center justify-between gap-2">
                  <span
                    className={`px-3 py-1 border-[2.5px] border-black text-xs font-black uppercase tracking-wider shadow-[3px_3px_0px_#000] ${
                      selectedDestination.id === 'warzone_arena'
                        ? 'bg-[#f87171] text-black'
                        : 'bg-[#00f0ff] text-black'
                    }`}
                  >
                    {selectedDestination.tag}
                  </span>

                  {selectedDestination.id === 'warzone_arena' ? (
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-[#38bdf8] text-black border-[2.5px] border-black text-xs font-black uppercase shadow-[2px_2px_0px_#000]">
                        BLUE {blueTeamOnlineCount}/10 ONLINE
                      </span>
                      <span className="px-2.5 py-1 bg-[#f87171] text-black border-[2.5px] border-black text-xs font-black uppercase shadow-[2px_2px_0px_#000]">
                        RED {redTeamOnlineCount}/10 ONLINE
                      </span>
                    </div>
                  ) : (
                    <span className="px-2.5 py-1 bg-white text-black border-[2.5px] border-black text-[11px] font-black uppercase shadow-[2px_2px_0px_#000]">
                      {selectedDestination.hasHalteShelter
                        ? 'HALTE RAIL STATION'
                        : 'STANDALONE TRANSIT KIOSK'}
                    </span>
                  )}
                </div>

                {/* Dark Bottom Overlay with Title, 1-2 Line Description, and Green ENTER > Button */}
                <div className="relative z-10 p-4 sm:p-6 bg-black/80 border-t-[3px] border-black flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3
                      data-transit-selected-title="true"
                      className="text-2xl sm:text-3xl font-black uppercase italic tracking-tight text-white leading-none"
                      style={{ fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif" }}
                    >
                      {selectedDestination.title}
                    </h3>
                    <p className="mt-2 text-xs sm:text-sm font-bold text-slate-200 line-clamp-2 leading-snug">
                      {selectedDestination.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    data-teleport-kiosk-confirm="true"
                    data-transit-enter-btn={selectedDestination.id}
                    disabled={isAlreadyAtSelected}
                    onClick={handleConfirmEnter}
                    className={`px-6 py-3.5 border-[3px] border-black font-black text-sm sm:text-base uppercase tracking-wider shrink-0 transition-all ${
                      isAlreadyAtSelected
                        ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
                        : 'bg-[#a3e635] hover:bg-[#bef264] text-black shadow-[4px_4px_0px_#000] cursor-pointer active:translate-y-0.5'
                    }`}
                  >
                    {isAlreadyAtSelected ? 'CURRENT LOCATION' : 'ENTER >'}
                  </button>
                </div>
              </div>
            </div>

            {/* BOTTOM BAR: RECENT QUICK FILTER ON LEFT + LIVE SEARCH INPUT ON RIGHT */}
            <div className="px-4 py-3 bg-[#f1f5f9] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-transit-recent-filter="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setShowRecentOnly((prev) => !prev);
                  }}
                  className={`px-3.5 py-1.5 border-[2.5px] border-black font-black text-xs uppercase tracking-wider cursor-pointer transition-all ${
                    showRecentOnly
                      ? 'bg-[#00f0ff] text-black shadow-[3px_3px_0px_#000]'
                      : 'bg-white hover:bg-slate-100 text-black shadow-[2px_2px_0px_#000]'
                  }`}
                >
                  RECENT ({recentStationIds.length})
                </button>
                {showRecentOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setShowRecentOnly(false);
                    }}
                    className="px-2.5 py-1.5 bg-white border-[2px] border-black text-[11px] font-black uppercase cursor-pointer"
                  >
                    SHOW ALL
                  </button>
                )}
              </div>

              <div className="w-full sm:w-64">
                <input
                  type="text"
                  data-transit-search-input="true"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  aria-label="Search transit destinations"
                  className="w-full px-3 py-1.5 bg-white border-[2.5px] border-black shadow-[2px_2px_0px_#000] text-xs font-black text-black placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
