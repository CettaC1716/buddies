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
  isTutorialTourActive?: boolean;
  onCompleteTutorialTour?: () => void;
  /** Guided destination (city-tour bridge): TRAVEL & DISTRICTS and this
   * destination card stand out while every other card dims, unclickable. */
  guideDestinationId?: CityTransitStationId | null;
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
  isTutorialTourActive = false,
  onCompleteTutorialTour,
  guideDestinationId = null,
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

  // Hana's interactive kiosk tour: she explains each menu while a spotlight
  // ring steps across the cards.
  const KIOSK_TOUR_STEPS = [
    {
      card: 'travel_districts',
      text: "This is TRAVEL & DISTRICTS \u2014 how you get around the city. Pick a district and the tram takes you straight there, no long walks.",
    },
    {
      card: 'my_house',
      text: 'This is MY HOUSE \u2014 your home in the city. If you do not own one yet, this is where the catalog and our model house come in.',
    },
    {
      card: 'shop_exchange',
      text: 'This is SHOP & EXCHANGE \u2014 trade LUL, CYON and RESPITE here, and browse items, outfits and furniture.',
    },
    {
      card: 'warzone_arena',
      text: 'And this is the WARZONE ARENA \u2014 the optional Red vs Blue combat game. Jump in whenever you feel like it, totally up to you.',
    },
  ] as const;
  const [tourStep, setTourStep] = useState<number>(0);
  useEffect(() => {
    if (isTutorialTourActive) {
      setTourStep(0);
    }
  }, [isTutorialTourActive, isOpen]);
  const guideCardClass = (card: string): string => {
    if (!guideDestinationId || levelView !== 'grid') return '';
    return card === 'travel_districts'
      ? ' ring-4 ring-[#38bdf8] z-20 brightness-110 bb-attention-wiggle'
      : ' opacity-40 saturate-50 pointer-events-none';
  };
  const tourCardClass = (card: string): string => {
    if (!isTutorialTourActive || levelView !== 'grid') return '';
    return KIOSK_TOUR_STEPS[tourStep]?.card === card
      ? ' ring-4 ring-[#b8ff3c] scale-[1.015] z-20 brightness-110'
      : ' opacity-60 saturate-50';
  };
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
        guideDestinationId ??
        (activeOriginId === 'central_plaza' ? 'beachfront_harbor' : 'central_plaza');
      setSelectedStationId(defaultTarget);
    }
  }, [isOpen, activeOriginId, guideDestinationId]);

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
      guideDestinationId ??
      (activeOriginId === 'central_plaza' ? 'beachfront_harbor' : 'central_plaza');
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
      className="fixed inset-0 z-[105] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 pointer-events-auto select-none"
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
              soundEngine.playUiCancel();
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
              >
                LEAVE WARZONE ARENA
              </h3>
              <p className="text-xs sm:text-sm font-bold text-slate-300">
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
                className="w-full sm:flex-1 py-3 px-6 bg-[#facc15] hover:bg-[#fde047] text-black border-[3px] border-black shadow-[4px_4px_0px_#000] font-black text-sm uppercase tracking-wider cursor-pointer active:translate-y-0.5 transition-all"
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
                className="w-full sm:w-auto py-3 px-6 bg-slate-800 hover:bg-slate-700 text-slate-200 border-[3px] border-black shadow-[4px_4px_0px_#000] font-black text-xs uppercase tracking-wider cursor-pointer active:translate-y-0.5 transition-all"
              >
                STAY IN WARZONE
              </button>
            </div>
          </div>
        ) : levelView === 'grid' ? (
          <div className="p-4 sm:p-6 bg-[#f1f5f9]">
            {isTutorialTourActive && (
              <div
                data-kiosk-tutorial-tour-banner="true"
                data-kiosk-hana-tour="true"
                className="mb-4 bg-[#0f172a] text-white border-[3px] border-black shadow-[4px_4px_0px_#000] flex gap-3 p-3"
              >
                <img
                  src={kioskThumbnails.shop_exchange || '/docs/hero-4-hana-exchange.jpg'}
                  alt="Hana"
                  className="w-14 h-14 sm:w-16 sm:h-16 object-cover border-2 border-black shrink-0"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10.5px] font-black uppercase text-[#b8ff3c]">
                      HANA · KIOSK TOUR {tourStep + 1}/{KIOSK_TOUR_STEPS.length}
                    </span>
                    <button
                      type="button"
                      data-kiosk-skip-tour-btn="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        onCompleteTutorialTour?.();
                      }}
                      className="text-[9.5px] font-black uppercase text-slate-400 hover:text-white underline cursor-pointer shrink-0"
                    >
                      SKIP TOUR
                    </button>
                  </div>
                  <p className="text-xs font-bold text-slate-100 leading-snug">
                    {KIOSK_TOUR_STEPS[tourStep].text}
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      data-kiosk-tour-back-btn="true"
                      disabled={tourStep === 0}
                      onClick={() => {
                        soundEngine.playUiClick();
                        setTourStep((s) => Math.max(0, s - 1));
                      }}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white border-2 border-black shadow-[2px_2px_0px_#000] font-black text-[11px] uppercase tracking-wider cursor-pointer"
                    >
                      BACK
                    </button>
                    {tourStep < KIOSK_TOUR_STEPS.length - 1 ? (
                      <button
                        type="button"
                        data-kiosk-tour-next-btn="true"
                        onClick={() => {
                          soundEngine.playUiClick();
                          setTourStep((s) =>
                            Math.min(KIOSK_TOUR_STEPS.length - 1, s + 1),
                          );
                        }}
                        className="px-3 py-1.5 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black text-[11px] uppercase tracking-wider cursor-pointer"
                      >
                        NEXT
                      </button>
                    ) : (
                      onCompleteTutorialTour && (
                        <button
                          type="button"
                          data-kiosk-complete-tutorial-btn="true"
                          onClick={() => {
                            soundEngine.playPickup();
                            onCompleteTutorialTour();
                          }}
                          className="px-3 py-1.5 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black text-[11px] uppercase tracking-wider cursor-pointer"
                        >
                          GOT IT
                        </button>
                      )
                    )}
                    {tourStep === KIOSK_TOUR_STEPS.length - 1 && (
                      <span className="text-[10px] font-bold text-slate-400">
                        That's the kiosk \u2014 where would you like to go first?
                      </span>
                    )}
                  </div>
                </div>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* CARD 1: TRAVEL & DISTRICTS */}
              <button
                type="button"
                data-transit-card="travel_districts"
                data-teleport-option="safezone"
                onClick={handleOpenTravelBrowser}
                className={`group relative h-[162px] sm:h-[172px] bg-white border-[3.5px] border-black shadow-[6px_6px_0px_#000] hover:-translate-y-0.5 transition-all text-left overflow-hidden flex flex-col justify-between cursor-pointer ${tourCardClass('travel_districts')}${guideCardClass('travel_districts')}`}
              >
                <img
                  src={kioskThumbnails.travel_districts || '/docs/hero-2-tram-station.jpg'}
                  alt="Travel & Districts"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />

                <div className="relative z-10 p-3 flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-[#00f0ff] text-black border-[2px] border-black text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_#000]">
                    THE CITY NETWORK
                  </span>
                  <span className="px-2 py-0.5 bg-black/80 text-white border-[2px] border-white/80 text-[10px] font-black uppercase">
                    5 DISTRICTS
                  </span>
                </div>

                <div className="relative z-10 p-3.5 pt-0">
                  <div
                    className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white drop-shadow-[0_2px_0_#000]"
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
                className={`group relative h-[162px] sm:h-[172px] bg-white border-[3.5px] border-black shadow-[6px_6px_0px_#000] hover:-translate-y-0.5 transition-all text-left overflow-hidden flex flex-col justify-between cursor-pointer ${tourCardClass('warzone_arena')}${guideCardClass('warzone_arena')}`}
              >
                <img
                  src={kioskThumbnails.warzone_arena || '/docs/hero-7-crate-stacking-pad.jpg'}
                  alt="Warzone Arena"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />

                <div className="relative z-10 p-3 flex items-center justify-between gap-2">
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

                <div className="relative z-10 p-3.5 pt-0">
                  <div
                    className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white drop-shadow-[0_2px_0_#000]"
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
                className={`group relative h-[162px] sm:h-[172px] bg-white border-[3.5px] border-black shadow-[6px_6px_0px_#000] hover:-translate-y-0.5 transition-all text-left overflow-hidden flex flex-col justify-between cursor-pointer ${tourCardClass('my_house')}${guideCardClass('my_house')}`}
              >
                <img
                  src={kioskThumbnails.my_house || '/docs/hero-3-house-interior.jpg'}
                  alt="My House Interior"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />

                <div className="relative z-10 p-3 flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-[#a3e635] text-black border-[2px] border-black text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_#000]">
                    HOUSE
                  </span>
                  <span className="px-2 py-0.5 bg-black/80 text-white border-[2px] border-white/80 text-[10px] font-black uppercase">
                    {hasOwnedHouse ? 'INSTANT ENTRY' : 'BROWSE HOMES'}
                  </span>
                </div>

                <div className="relative z-10 p-3.5 pt-0">
                  <div
                    className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white drop-shadow-[0_2px_0_#000]"
                  >
                    MY HOUSE
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-200 line-clamp-2">
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
                className={`group relative h-[162px] sm:h-[172px] bg-white border-[3.5px] border-black shadow-[6px_6px_0px_#000] hover:-translate-y-0.5 transition-all text-left overflow-hidden flex flex-col justify-between cursor-pointer ${tourCardClass('shop_exchange')}${guideCardClass('shop_exchange')}`}
              >
                <img
                  src={kioskThumbnails.shop_exchange || '/docs/hero-4-hana-exchange.jpg'}
                  alt="Shop & Exchange"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />

                <div className="relative z-10 p-3 flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-[#c084fc] text-black border-[2px] border-black text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_#000]">
                    SHOP &amp; EXCHANGE
                  </span>
                  <span className="px-2 py-0.5 bg-black/80 text-white border-[2px] border-white/80 text-[10px] font-black uppercase">
                    LUL / CYON / RESPITE
                  </span>
                </div>

                <div className="relative z-10 p-3.5 pt-0">
                  <div
                    className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white drop-shadow-[0_2px_0_#000]"
                  >
                    SHOP &amp; EXCHANGE
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-200 line-clamp-2">
                    Open the City Catalog, furniture items, outfits, and LUL / CYON / RESPITE token exchange counter.
                  </p>
                </div>
              </button>

              {/* CARD 5: JOBS */}
              <button
                type="button"
                data-transit-card="jobs"
                onClick={handleOpenJobsBrowser}
                className={`group relative h-[162px] sm:h-[172px] bg-white border-[3.5px] border-black shadow-[6px_6px_0px_#000] hover:-translate-y-0.5 transition-all text-left overflow-hidden flex flex-col justify-between cursor-pointer ${tourCardClass('jobs')}${guideCardClass('jobs')}`}
              >
                <img
                  src={
                    kioskThumbnails.jobs_cafe ||
                    kioskThumbnails.cafe_glasshouse ||
                    '/assets/aistudio/screenshot_7_5a2e994c.png'
                  }
                  alt="Citizen Jobs - Cafe Glasshouse"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />

                <div className="relative z-10 p-3.5 flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-[#35C26B] text-black border-[2px] border-black text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_#000]">
                    WORK &amp; EARN XP
                  </span>
                  <span className="px-2 py-0.5 bg-black/80 text-white border-[2px] border-white/80 text-[10px] font-black uppercase">
                    {cafeJobStatus
                      ? cafeJobStatus.workerName
                        ? `ON SHIFT: ${cafeJobStatus.workerName.toUpperCase()}`
                        : 'APRON FREE'
                      : '1 JOB OPEN'}
                  </span>
                </div>

                <div className="relative z-10 p-4 pt-0">
                  <div className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white drop-shadow-[0_2px_0_#000]">
                    JOBS
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-200 line-clamp-2">
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
          <div className="p-4 sm:p-6 bg-[#f1f5f9]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-black uppercase tracking-wider text-slate-700">
                SELECT A CITIZEN JOB TO START WORKING
              </div>
              <div className="px-2.5 py-1 bg-white border-[2.5px] border-black text-[11px] font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_#000]">
                1 AVAILABLE JOB
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* JOB CARD 1: CAFE GLASSHOUSE */}
              <button
                type="button"
                data-transit-job-card="cafe_glasshouse"
                onClick={handleEnterCafeGlasshouseJob}
                className="group relative h-[196px] sm:h-[214px] bg-white border-[3.5px] border-black shadow-[6px_6px_0px_#000] hover:-translate-y-0.5 transition-all text-left overflow-hidden flex flex-col justify-between cursor-pointer"
              >
                <img
                  src={
                    kioskThumbnails.jobs_cafe ||
                    kioskThumbnails.cafe_glasshouse ||
                    '/assets/aistudio/screenshot_7_5a2e994c.png'
                  }
                  alt="Cafe Glasshouse"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />

                <div className="relative z-10 p-3.5 flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-[#4ade80] text-black border-[2px] border-black text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_#000]">
                    BARISTA SHIFT
                  </span>
                  <span className="px-2 py-0.5 bg-black/80 text-white border-[2px] border-white/80 text-[10px] font-black uppercase">
                    LUL / XP
                  </span>
                </div>

                <div className="relative z-10 p-4 pt-0">
                  <div
                    className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white drop-shadow-[0_2px_0_#000]"
                  >
                    CAFE GLASSHOUSE
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-200 line-clamp-2">
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
          <div className="p-4 sm:p-6 bg-[#0f172a] text-white">
            <div className="mb-4 text-center">
              <div className="inline-block px-3 py-1 bg-[#facc15] text-black border-2 border-black font-black text-xs uppercase tracking-wider shadow-[2px_2px_0px_#000] mb-2">
                WARZONE MINI-GAME DEPLOYMENT
              </div>
              <h3
                className="text-xl sm:text-3xl font-black uppercase italic tracking-tight text-white drop-shadow-[0_2px_0_#000]"
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
                    const isGuideTarget = guideDestinationId === dest.id;
                    const isGuideDimmed = Boolean(guideDestinationId) && !isGuideTarget;

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
                        }${isGuideDimmed ? ' opacity-40 saturate-50 pointer-events-none' : ''}${isGuideTarget ? ' ring-4 ring-[#38bdf8] brightness-110' : ''}`}
                      >
                        <img
                          src={kioskThumbnails[dest.id] || dest.heroImageUrl}
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
                  src={
                    kioskThumbnails[selectedDestination.id] ||
                    selectedDestination.heroImageUrl
                  }
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
