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
  /** Live cafe job status peeked from the shift channel (null = unknown). */
  cafeJobStatus?: { workerName: string | null; queueCount: number } | null;
  onEnterGlasshouseCafe?: () => void;
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
  cafeJobStatus = null,
  onEnterGlasshouseCafe,
}) => {
  const [levelView, setLevelView] = useState<'grid' | 'browser' | 'warzoneTeamSelect' | 'jobs'>('grid');
  const [kioskThumbnails, setKioskThumbnails] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      const winStore = window as unknown as {
        __BUDDIES_KIOSK_THUMBNAILS__?: Record<string, string>;
      };
      return winStore.__BUDDIES_KIOSK_THUMBNAILS__ ?? {};
    }
    return {};
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncThumbnails = () => {
      const winStore = window as unknown as {
        __BUDDIES_KIOSK_THUMBNAILS__?: Record<string, string>;
      };
      if (winStore.__BUDDIES_KIOSK_THUMBNAILS__) {
        setKioskThumbnails({ ...winStore.__BUDDIES_KIOSK_THUMBNAILS__ });
      }
    };
    syncThumbnails();
    window.addEventListener('kiosk-thumbnails-ready', syncThumbnails);
    return () => {
      window.removeEventListener('kiosk-thumbnails-ready', syncThumbnails);
    };
  }, []);

  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const winStore = window as unknown as {
        __BUDDIES_KIOSK_THUMBNAILS__?: Record<string, string>;
      };
      const store = winStore.__BUDDIES_KIOSK_THUMBNAILS__;
      const requiredDistrictKeys: CityTransitStationId[] = [
        'central_plaza',
        'central_park',
        'beachfront_harbor',
        'nw_fishing_lake',
        'north_residence',
        'south_residence',
        'warzone_arena',
      ];
      const hasAllDistrictSnapshots =
        Boolean(store?.travel_districts) &&
        requiredDistrictKeys.every((key) => Boolean(store?.[key]));
      if (!hasAllDistrictSnapshots) {
        window.dispatchEvent(new CustomEvent('request-kiosk-thumbnails'));
      }
      if (store) {
        setKioskThumbnails({ ...store });
      }
    }
  }, [isOpen]);

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
    }).map((dest) => {
      const liveSnap = kioskThumbnails[dest.id];
      return liveSnap
        ? { ...dest, heroImageUrl: liveSnap, thumbnailUrl: liveSnap }
        : dest;
    });
  }, [searchQuery, showRecentOnly, recentStationIds, kioskThumbnails]);

  const districtDestinationCount = useMemo(
    () => CITY_TRANSIT_DESTINATIONS.filter((d) => d.category === 'district').length,
    [],
  );

  const selectedDestination: CityTransitDestinationSpec = useMemo(() => {
    const found = filteredDestinations.find((d) => d.id === selectedStationId);
    if (found) return found;
    if (filteredDestinations.length > 0) return filteredDestinations[0];
    const fallback = getCityTransitDestinationById(selectedStationId);
    const liveSnap = kioskThumbnails[fallback.id];
    return liveSnap
      ? { ...fallback, heroImageUrl: liveSnap, thumbnailUrl: liveSnap }
      : fallback;
  }, [filteredDestinations, selectedStationId, kioskThumbnails]);

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
    setBrowserSectionTitle('WARZONE ARENA · SELECT FACTION');
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

  const handleOpenJobsBrowser = () => {
    soundEngine.playUiClick();
    setBrowserSectionTitle('JOBS · SELECT WORKPLACE');
    setLevelView('jobs');
  };

  const handleEnterCafeGlasshouseJob = () => {
    soundEngine.playUiConfirm();
    if (onEnterGlasshouseCafe) {
      onEnterGlasshouseCafe();
    } else {
      onClose();
      window.dispatchEvent(new CustomEvent('enter-glasshouse-cafe'));
    }
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
      className="fixed inset-0 z-[105] flex items-center justify-center p-3 sm:p-5 bg-slate-950/50 backdrop-blur-sm pointer-events-auto select-none"
      onClick={() => {
        soundEngine.playUiClick();
        onClose();
      }}
    >
      <div
        className="relative w-full max-w-[940px] rounded-[26px] bg-[#edf0f5]/95 backdrop-blur-2xl border border-white/80 shadow-[0_24px_64px_rgba(15,23,42,0.28)] text-slate-900 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* =================================================================
            TOP HEADER BAR
            ================================================================= */}
        <div className="px-5 sm:px-6 py-4 bg-white/85 border-b border-slate-200/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {worldMode !== 'warzone' && levelView !== 'grid' && (
              <button
                type="button"
                data-transit-kiosk-back="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  setLevelView('grid');
                }}
                className="px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/90 font-bold text-xs uppercase tracking-wide cursor-pointer active:scale-95 transition-all shrink-0"
              >
                &lt; BACK
              </button>
            )}
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-extrabold uppercase tracking-tight text-slate-900 truncate">
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
              soundEngine.playUiCancel();
              onClose();
            }}
            aria-label="Close City Transit Kiosk"
            className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/90 shadow-xs font-bold text-sm flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
          >
            ✕
          </button>
        </div>

        {/* =================================================================
            WARZONE MODE: STRICTLY EXIT WARZONE TERMINAL (NO OTHER MENUS)
            ================================================================= */}
        {worldMode === 'warzone' ? (
          <div className="p-6 sm:p-10 bg-slate-900/95 text-white flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-rose-500/15 border border-rose-400/40 flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 24 24" className="w-8 h-8 stroke-rose-400 fill-none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>
            <div className="space-y-2 max-w-md">
              <div className="inline-block px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30 text-xs font-bold uppercase tracking-wider">
                WARZONE OUTPOST
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-white">
                LEAVE WARZONE ARENA
              </h3>
              <p className="text-xs sm:text-sm font-medium text-slate-300 leading-relaxed">
                End your tactical Warzone combat session and return safely to Central Plaza in the main city.
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
                className="w-full sm:flex-1 py-3 px-6 rounded-full bg-sky-500 hover:bg-sky-400 text-white shadow-md font-bold text-sm uppercase tracking-wider cursor-pointer active:scale-[0.98] transition-all"
              >
                RETURN TO MAIN CITY
              </button>

              <button
                type="button"
                data-cancel-leave-warzone-btn="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  onClose();
                }}
                className="w-full sm:w-auto py-3 px-6 rounded-full bg-white/10 hover:bg-white/15 text-slate-200 border border-white/15 font-bold text-xs uppercase tracking-wider cursor-pointer active:scale-[0.98] transition-all"
              >
                STAY IN WARZONE
              </button>
            </div>
          </div>
        ) : levelView === 'grid' ? (
          <div className="p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                SELECT DESTINATION OR CITIZEN SERVICE
              </div>
              <div className="px-3 py-1 rounded-full bg-white border border-slate-200/80 shadow-xs text-[11px] font-bold uppercase tracking-wide text-slate-700">
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
                className="group relative h-[164px] sm:h-[176px] rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all text-left overflow-hidden flex flex-col justify-between cursor-pointer"
              >
                <img
                  src={kioskThumbnails.travel_districts || '/docs/hero-2-tram-station.jpg'}
                  alt="Travel & Districts"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-slate-950/10" />

                <div className="relative z-10 p-3.5 flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-sky-500/90 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
                    THE CITY NETWORK
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-900/70 backdrop-blur-md text-white border border-white/20 text-[10px] font-bold uppercase">
                    {districtDestinationCount} DISTRICTS
                  </span>
                </div>

                <div className="relative z-10 p-4 pt-0">
                  <div className="text-lg sm:text-xl font-extrabold uppercase tracking-tight text-white">
                    TRAVEL &amp; DISTRICTS
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-200/95 line-clamp-2">
                    Fast-travel by City Tram across Central Plaza, Central Park, Beachfront Harbor, NW Fishing Lake, and Residences.
                  </p>
                </div>
              </button>

              {/* CARD 2: WARZONE ARENA */}
              <button
                type="button"
                data-transit-card="warzone_arena"
                data-teleport-option="warzone"
                onClick={handleOpenWarzoneBrowser}
                className="group relative h-[164px] sm:h-[176px] rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all text-left overflow-hidden flex flex-col justify-between cursor-pointer"
              >
                <img
                  src={kioskThumbnails.warzone_arena || '/docs/hero-7-crate-stacking-pad.jpg'}
                  alt="Warzone Arena"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-slate-950/10" />

                <div className="relative z-10 p-3.5 flex items-center justify-between gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-amber-400/95 text-slate-950 text-[10px] font-bold uppercase tracking-wider shadow-xs">
                    MINI-GAME
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      data-transit-warzone-blue-count="true"
                      className="px-2.5 py-0.5 rounded-full bg-sky-500/90 text-white text-[10px] font-bold uppercase"
                    >
                      BLUE {blueTeamOnlineCount}/10
                    </span>
                    <span
                      data-transit-warzone-red-count="true"
                      className="px-2.5 py-0.5 rounded-full bg-rose-500/90 text-white text-[10px] font-bold uppercase"
                    >
                      RED {redTeamOnlineCount}/10
                    </span>
                  </div>
                </div>

                <div className="relative z-10 p-4 pt-0">
                  <div className="text-lg sm:text-xl font-extrabold uppercase tracking-tight text-white">
                    WARZONE ARENA
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-200/95 line-clamp-2">
                    Deploy into the Red vs Blue tactical combat arena with weapons, vehicles, and crate logistics.
                  </p>
                </div>
              </button>

              {/* CARD 3: MY HOUSE */}
              <button
                type="button"
                data-transit-card="my_house"
                onClick={handleClickMyHouse}
                className="group relative h-[164px] sm:h-[176px] rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all text-left overflow-hidden flex flex-col justify-between cursor-pointer"
              >
                <img
                  src={kioskThumbnails.my_house || '/docs/hero-3-house-interior.jpg'}
                  alt="My House Interior"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-slate-950/10" />

                <div className="relative z-10 p-3.5 flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/90 text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
                    HOUSE
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-900/70 backdrop-blur-md text-white border border-white/20 text-[10px] font-bold uppercase">
                    {hasOwnedHouse ? 'INSTANT ENTRY' : 'BROWSE HOMES'}
                  </span>
                </div>

                <div className="relative z-10 p-4 pt-0">
                  <div className="text-lg sm:text-xl font-extrabold uppercase tracking-tight text-white">
                    MY HOUSE
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-200/95 line-clamp-2">
                    {hasOwnedHouse
                      ? 'Enter your house interior directly to hang out and arrange furniture.'
                      : 'Acquire a Private House in Hana Catalog to unlock your interior and city plots.'}
                  </p>
                </div>
              </button>

              {/* CARD 4: SHOP & EXCHANGE */}
              <button
                type="button"
                data-transit-card="shop_exchange"
                onClick={handleClickShopExchange}
                className="group relative h-[164px] sm:h-[176px] rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all text-left overflow-hidden flex flex-col justify-between cursor-pointer"
              >
                <img
                  src={kioskThumbnails.shop_exchange || '/docs/hero-4-hana-exchange.jpg'}
                  alt="Shop & Exchange"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-slate-950/10" />

                <div className="relative z-10 p-3.5 flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-violet-500/90 text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
                    SHOP &amp; EXCHANGE
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-900/70 backdrop-blur-md text-white border border-white/20 text-[10px] font-bold uppercase">
                    LUL / CYON / RESPITE
                  </span>
                </div>

                <div className="relative z-10 p-4 pt-0">
                  <div className="text-lg sm:text-xl font-extrabold uppercase tracking-tight text-white">
                    SHOP &amp; EXCHANGE
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-200/95 line-clamp-2">
                    Open the City Catalog, furniture items, outfits, and LUL / CYON / RESPITE token exchange counter.
                  </p>
                </div>
              </button>

              {/* CARD 5: JOBS */}
              <button
                type="button"
                data-transit-card="jobs"
                onClick={handleOpenJobsBrowser}
                className="group relative h-[164px] sm:h-[176px] rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all text-left overflow-hidden flex flex-col justify-between cursor-pointer"
              >
                <img
                  src={
                    kioskThumbnails.jobs_cafe ||
                    kioskThumbnails.cafe_glasshouse ||
                    '/assets/kiosk/cafe_glasshouse.webp'
                  }
                  alt="Citizen Jobs - Cafe Glasshouse"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-slate-950/10" />

                <div className="relative z-10 p-3.5 flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/90 text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
                    WORK &amp; EARN XP
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-900/70 backdrop-blur-md text-white border border-white/20 text-[10px] font-bold uppercase">
                    {cafeJobStatus
                      ? cafeJobStatus.workerName
                        ? `ON SHIFT: ${cafeJobStatus.workerName.toUpperCase()}`
                        : 'APRON FREE'
                      : '1 JOB OPEN'}
                  </span>
                </div>

                <div className="relative z-10 p-4 pt-0">
                  <div className="text-lg sm:text-xl font-extrabold uppercase tracking-tight text-white">
                    JOBS
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-200/95 line-clamp-2">
                    Take a barista shift at the Glasshouse Cafe — prepare and serve 3 orders before the timer runs out to earn XP.
                  </p>
                </div>
              </button>
            </div>
          </div>
        ) : levelView === 'jobs' ? (
          /* =================================================================
             JOBS SUB-VIEW: SAME CARD LAYOUT WITH 1 JOB (CAFE GLASSHOUSE)
             ================================================================= */
          <div className="p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                SELECT A CITIZEN JOB TO START WORKING
              </div>
              <div className="px-3 py-1 rounded-full bg-white border border-slate-200/80 shadow-xs text-[11px] font-bold uppercase tracking-wide text-slate-700">
                1 AVAILABLE JOB
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* JOB CARD 1: CAFE GLASSHOUSE */}
              <button
                type="button"
                data-transit-job-card="cafe_glasshouse"
                onClick={handleEnterCafeGlasshouseJob}
                className="group relative h-[196px] sm:h-[214px] rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all text-left overflow-hidden flex flex-col justify-between cursor-pointer"
              >
                <img
                  src={
                    kioskThumbnails.jobs_cafe ||
                    kioskThumbnails.cafe_glasshouse ||
                    '/assets/kiosk/cafe_glasshouse.webp'
                  }
                  alt="Cafe Glasshouse"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-slate-950/10" />

                <div className="relative z-10 p-3.5 flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/90 text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
                    BARISTA SHIFT
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-900/70 backdrop-blur-md text-white border border-white/20 text-[10px] font-bold uppercase">
                    LUL / XP
                  </span>
                </div>

                <div className="relative z-10 p-4 pt-0">
                  <div className="text-lg sm:text-xl font-extrabold uppercase tracking-tight text-white">
                    CAFE GLASSHOUSE
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-200/95 line-clamp-2">
                    Register at the Work Rota board inside Cafe Glasshouse, prepare customer drinks and pastries, and earn XP for every serve.
                  </p>
                </div>
              </button>
            </div>
          </div>
        ) : levelView === 'warzoneTeamSelect' ? (
          /* =================================================================
             WARZONE MINI-GAME TEAM SELECT VIEW (RED FACTION vs BLUE FACTION)
             ================================================================= */
          <div className="p-5 sm:p-7 bg-slate-900/95 text-white">
            <div className="mb-5 text-center">
              <div className="inline-block px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-300/30 font-bold text-xs uppercase tracking-wider mb-2">
                WARZONE MINI-GAME DEPLOYMENT
              </div>
              <h3 className="text-xl sm:text-3xl font-extrabold uppercase tracking-tight text-white">
                CHOOSE YOUR TEAM FACTION
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm font-medium text-slate-300 max-w-lg mx-auto">
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
                className="group relative p-5 rounded-2xl bg-white/[0.06] hover:bg-sky-500/20 border border-sky-400/30 hover:border-sky-400/70 shadow-lg hover:-translate-y-0.5 transition-all text-left flex flex-col justify-between cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 font-bold text-xs uppercase tracking-wider">
                    SOUTHERN SECTOR
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-950/60 text-sky-300 border border-sky-400/30 text-xs font-bold uppercase">
                    {blueTeamOnlineCount}/10 PLAYERS
                  </span>
                </div>

                <div className="my-2">
                  <div className="text-2xl sm:text-3xl font-extrabold uppercase text-white group-hover:text-sky-200 transition-colors">
                    BLUE TEAM
                  </div>
                  <div className="text-xs font-medium text-slate-300 mt-1">
                    Spawn at Southern base cratepad ring with tactical pistol loadout.
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-sky-300 group-hover:text-sky-200">
                    CLICK TO DEPLOY &gt;
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-sky-500 text-white font-bold text-[10px] uppercase">
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
                className="group relative p-5 rounded-2xl bg-white/[0.06] hover:bg-rose-500/20 border border-rose-400/30 hover:border-rose-400/70 shadow-lg hover:-translate-y-0.5 transition-all text-left flex flex-col justify-between cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30 font-bold text-xs uppercase tracking-wider">
                    NORTHERN SECTOR
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-950/60 text-rose-300 border border-rose-400/30 text-xs font-bold uppercase">
                    {redTeamOnlineCount}/10 PLAYERS
                  </span>
                </div>

                <div className="my-2">
                  <div className="text-2xl sm:text-3xl font-extrabold uppercase text-white group-hover:text-rose-200 transition-colors">
                    RED TEAM
                  </div>
                  <div className="text-xs font-medium text-slate-300 mt-1">
                    Spawn at Northern base cratepad ring with tactical pistol loadout.
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-rose-300 group-hover:text-rose-200">
                    CLICK TO DEPLOY &gt;
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white font-bold text-[10px] uppercase">
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
          <div className="flex flex-col">
            <div className="flex flex-col md:flex-row h-[420px] sm:h-[440px] border-b border-slate-200/80">
              {/* LEFT SIDEBAR (~28% WIDTH) */}
              <div
                data-transit-sidebar="true"
                className="w-full md:w-[30%] h-[165px] md:h-full overflow-y-auto border-b md:border-b-0 md:border-r border-slate-200/80 bg-[#edf0f5]/70 p-3 space-y-2"
              >
                {filteredDestinations.length === 0 ? (
                  <div className="p-4 text-center text-xs font-bold uppercase text-slate-500">
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
                        className={`w-full p-2.5 rounded-2xl flex items-center gap-2.5 text-left transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-400/25 shadow-sm'
                            : 'bg-white hover:bg-slate-50 border-slate-200/80 shadow-xs'
                        }`}
                      >
                        <img
                          src={kioskThumbnails[dest.id] || dest.heroImageUrl}
                          alt={dest.shortTitle}
                          className="w-11 h-11 rounded-xl object-cover shrink-0 bg-slate-900"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold uppercase tracking-tight text-slate-900 truncate">
                            {dest.shortTitle}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5">
                            {isHere ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold uppercase">
                                HERE
                              </span>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                  dest.id === 'warzone_arena'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-sky-100 text-sky-700'
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

              {/* RIGHT SHOWCASE PANEL (~70% WIDTH) */}
              <div className="w-full md:w-[70%] flex-1 relative bg-slate-900 overflow-hidden flex flex-col justify-between">
                <img
                  src={
                    kioskThumbnails[selectedDestination.id] ||
                    selectedDestination.heroImageUrl
                  }
                  alt={selectedDestination.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-slate-950/10" />

                {/* Top Badges inside Right Showcase */}
                <div className="relative z-10 p-4 flex items-center justify-between gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm backdrop-blur-md ${
                      selectedDestination.id === 'warzone_arena'
                        ? 'bg-rose-500/90 text-white'
                        : 'bg-sky-500/90 text-white'
                    }`}
                  >
                    {selectedDestination.tag}
                  </span>

                  {selectedDestination.id === 'warzone_arena' ? (
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-sky-500/90 text-white text-xs font-bold uppercase shadow-sm">
                        BLUE {blueTeamOnlineCount}/10 ONLINE
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-rose-500/90 text-white text-xs font-bold uppercase shadow-sm">
                        RED {redTeamOnlineCount}/10 ONLINE
                      </span>
                    </div>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-slate-800 text-[11px] font-bold uppercase shadow-sm">
                      {selectedDestination.hasHalteShelter
                        ? 'RAIL TRANSIT STATION'
                        : 'STANDALONE TRANSIT KIOSK'}
                    </span>
                  )}
                </div>

                {/* Frosted Bottom Overlay with Title, 1-2 Line Description, and Pill ENTER > Button */}
                <div className="relative z-10 p-5 sm:p-6 bg-slate-950/65 backdrop-blur-md border-t border-white/10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3
                      data-transit-selected-title="true"
                      className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-white leading-tight"
                    >
                      {selectedDestination.title}
                    </h3>
                    <p className="mt-1.5 text-xs sm:text-sm font-medium text-slate-200 line-clamp-2 leading-snug">
                      {selectedDestination.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    data-teleport-kiosk-confirm="true"
                    data-transit-enter-btn={selectedDestination.id}
                    disabled={isAlreadyAtSelected}
                    onClick={handleConfirmEnter}
                    className={`px-6 py-3 rounded-full font-bold text-xs sm:text-sm uppercase tracking-wider shrink-0 transition-all ${
                      isAlreadyAtSelected
                        ? 'bg-white/15 text-slate-300 border border-white/15 cursor-not-allowed'
                        : 'bg-sky-500 hover:bg-sky-400 text-white shadow-md cursor-pointer active:scale-95'
                    }`}
                  >
                    {isAlreadyAtSelected ? 'CURRENT LOCATION' : 'ENTER >'}
                  </button>
                </div>
              </div>
            </div>

            {/* BOTTOM BAR: RECENT QUICK FILTER ON LEFT + LIVE SEARCH INPUT ON RIGHT */}
            <div className="px-5 py-3.5 bg-white/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-transit-recent-filter="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setShowRecentOnly((prev) => !prev);
                  }}
                  className={`px-4 py-1.5 rounded-full border font-bold text-xs uppercase tracking-wide cursor-pointer transition-all ${
                    showRecentOnly
                      ? 'bg-sky-500 border-sky-500 text-white shadow-sm'
                      : 'bg-white hover:bg-slate-100 border-slate-200/90 text-slate-700 shadow-xs'
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
                    className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold uppercase cursor-pointer transition-colors"
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
                  className="w-full px-4 py-1.5 rounded-full bg-white border border-slate-200/90 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25 shadow-xs text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
