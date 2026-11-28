import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, MapPin, TrainFront } from 'lucide-react';
import {
  CityTransitDestinationSpec,
  CityTransitStationId,
  getCityTransitDestinationById,
  getTravelDistrictDestinations,
} from '../game/buddiesBlitzRules';
import { soundEngine } from '../game/audio';
import { TabletDeviceMockupShell } from './TabletDeviceMockupShell';

import type { HouseArchitectureStyle } from '../game/buddiesBlitzRules';

export interface PublicApartmentEntry {
  id: string;
  title: string;
  shortTitle: string;
  ownerName: string;
  styleLabel: string;
  tag: string;
  description: string;
  imageUrl: string;
  architectureStyle: HouseArchitectureStyle;
  isOwnApartment?: boolean;
  isModelShowcase?: boolean;
}

export interface CityTransitKioskModalProps {
  isOpen: boolean;
  originStationId: CityTransitStationId;
  worldMode: 'lobby' | 'safezone' | 'warzone' | 'house_interior';
  blueTeamOnlineCount: number;
  redTeamOnlineCount: number;
  hasOwnedHouse: boolean;
  publicApartments?: readonly PublicApartmentEntry[];
  onClose: () => void;
  onConfirmEnterDestination: (
    destination: CityTransitDestinationSpec,
    team?: 'blue' | 'red',
  ) => void;
  onVisitPublicApartment?: (apartment: PublicApartmentEntry) => void;
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
  publicApartments = [],
  onClose,
  onConfirmEnterDestination,
  onVisitPublicApartment,
  onEnterMyHouseStudio,
  onOpenHouseCatalog,
  onOpenShopAndExchange,
  cafeJobStatus = null,
  onEnterGlasshouseCafe,
}) => {
  void hasOwnedHouse;
  void onEnterMyHouseStudio;
  void onOpenHouseCatalog;
  const [levelView, setLevelView] = useState<
    'grid' | 'browser' | 'publicApartments' | 'warzoneTeamSelect' | 'jobs'
  >('grid');
  const [selectedApartmentId, setSelectedApartmentId] = useState<string>('');
  const [apartmentSearchQuery, setApartmentSearchQuery] = useState<string>('');
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
    if (!isOpen || typeof window === 'undefined') return;
    const winStore = window as unknown as {
      __BUDDIES_KIOSK_THUMBNAILS__?: Record<string, string>;
    };
    const store = winStore.__BUDDIES_KIOSK_THUMBNAILS__;
    if (store) {
      setKioskThumbnails({ ...store });
    }
    const requiredDistrictKeys: CityTransitStationId[] = [
      'central_plaza',
      'central_park',
      'beachfront_harbor',
      'kai_fish_market',
      'north_residence',
      'south_residence',
      'warzone_arena',
    ];
    const hasAllDistrictSnapshots =
      store?._version === '2026_11_v2' &&
      Boolean(store?.travel_districts) &&
      requiredDistrictKeys.every((key) => Boolean(store?.[key]));
    if (hasAllDistrictSnapshots) return;
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('request-kiosk-thumbnails'));
    }, 40);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isOpen]);

  const [browserSectionTitle, setBrowserSectionTitle] = useState<string>('TRAVEL & DISTRICTS');
  const [selectedStationId, setSelectedStationId] = useState<CityTransitStationId>('central_plaza');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showRecentOnly, setShowRecentOnly] = useState<boolean>(false);
  const travelDistrictDestinations = useMemo(() => getTravelDistrictDestinations(), []);
  const [recentStationIds, setRecentStationIds] = useState<CityTransitStationId[]>(() => {
    const validIds = new Set(getTravelDistrictDestinations().map((d) => d.id));
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(RECENT_STATIONS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const cleaned = parsed.filter(
              (id): id is CityTransitStationId =>
                typeof id === 'string' && validIds.has(id as CityTransitStationId),
            );
            if (cleaned.length > 0) return cleaned;
          }
        }
      } catch {
        // ignore storage errors
      }
    }
    return ['central_plaza', 'central_park', 'beachfront_harbor'];
  });

  const activeOriginId: CityTransitStationId =
    worldMode === 'warzone' ? 'warzone_arena' : originStationId;
  const originSpec = getCityTransitDestinationById(activeOriginId);

  useEffect(() => {
    if (isOpen) {
      setLevelView('grid');
      setSearchQuery('');
      setApartmentSearchQuery('');
      setShowRecentOnly(false);
      const defaultTarget: CityTransitStationId =
        activeOriginId === 'central_plaza' ? 'beachfront_harbor' : 'central_plaza';
      setSelectedStationId(defaultTarget);
      if (publicApartments.length > 0) {
        setSelectedApartmentId(publicApartments[0].id);
      }
    }
    // Only reset navigation state when modal opens or origin station changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeOriginId]);

  useEffect(() => {
    if (!isOpen || publicApartments.length === 0) return;
    setSelectedApartmentId((prev) =>
      prev && publicApartments.some((apt) => apt.id === prev) ? prev : publicApartments[0].id,
    );
  }, [isOpen, publicApartments]);

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
    return travelDistrictDestinations.filter((dest) => {
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
  }, [travelDistrictDestinations, searchQuery, showRecentOnly, recentStationIds, kioskThumbnails]);

  const districtDestinationCount = travelDistrictDestinations.length;

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

  const filteredPublicApartments = useMemo(() => {
    const q = apartmentSearchQuery.trim().toLowerCase();
    if (!q) return publicApartments;
    return publicApartments.filter(
      (apt) =>
        apt.title.toLowerCase().includes(q) ||
        apt.shortTitle.toLowerCase().includes(q) ||
        apt.ownerName.toLowerCase().includes(q) ||
        apt.styleLabel.toLowerCase().includes(q) ||
        apt.description.toLowerCase().includes(q),
    );
  }, [publicApartments, apartmentSearchQuery]);

  const selectedPublicApartment: PublicApartmentEntry | null = useMemo(() => {
    const found = filteredPublicApartments.find((a) => a.id === selectedApartmentId);
    return found ?? filteredPublicApartments[0] ?? publicApartments[0] ?? null;
  }, [filteredPublicApartments, selectedApartmentId, publicApartments]);

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

  const handleOpenPublicApartmentsBrowser = () => {
    soundEngine.playUiClick();
    setBrowserSectionTitle('PUBLIC APARTMENTS · OPEN RESIDENCES');
    setApartmentSearchQuery('');
    if (publicApartments.length > 0) {
      setSelectedApartmentId(publicApartments[0].id);
    }
    setLevelView('publicApartments');
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

  const headerTitle =
    worldMode === 'warzone'
      ? 'Warzone Evacuation Terminal'
      : levelView === 'grid'
        ? 'City Transit & Services Kiosk'
        : browserSectionTitle;

  const headerSubtitle =
    worldMode === 'warzone'
      ? 'Tactical Extraction Terminal · Return to Central Plaza'
      : `Station: ${originSpec.title}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="City Transit Self-Service Kiosk"
      data-teleport-kiosk-modal="true"
      data-transit-kiosk-level={levelView}
      className="fixed inset-0 z-[105] flex items-center justify-center p-2.5 sm:p-5 bg-black/25 pointer-events-auto select-none"
      onClick={() => {
        soundEngine.playUiClick();
        onClose();
      }}
    >
      <TabletDeviceMockupShell
        appLabel="TRANSIT OS"
        title={headerTitle}
        subtitle={headerSubtitle}
        headerIcon={<TrainFront className="w-4 h-4" aria-hidden="true" />}
        maxWidthClass="max-w-[960px]"
        heightClass="max-h-[92vh]"
        onClose={onClose}
        closeAriaLabel="Close City Transit Kiosk"
        closeButtonProps={{ 'data-teleport-kiosk-close': 'true' }}
        backButton={
          worldMode !== 'warzone' && levelView !== 'grid' ? (
            <button
              type="button"
              data-transit-kiosk-back="true"
              onClick={() => {
                soundEngine.playUiClick();
                setLevelView('grid');
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 font-semibold text-xs uppercase tracking-wide cursor-pointer active:scale-95 transition-all shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Back</span>
            </button>
          ) : undefined
        }
        headerRight={
          worldMode !== 'warzone' ? (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.08] border border-white/15 text-[11px] font-semibold uppercase tracking-wide text-white/85 whitespace-nowrap">
              <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden="true" />
              <span>{originSpec.title}</span>
            </div>
          ) : undefined
        }
        footer={
          worldMode !== 'warzone' && levelView === 'browser' ? (
            <div className="px-4 sm:px-5 py-3 bg-white/[0.04] border-t border-white/[0.12] flex flex-wrap items-center justify-between gap-3 shrink-0">
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
                      ? 'bg-sky-500 border-sky-400 text-white shadow-sm'
                      : 'bg-white/10 hover:bg-white/15 border-white/15 text-white/85'
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
                    className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 text-[11px] font-bold uppercase cursor-pointer transition-colors"
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
                  placeholder="Search stations..."
                  aria-label="Search transit destinations"
                  className="w-full px-4 py-1.5 rounded-full bg-white/10 border border-white/15 focus:border-sky-400/70 focus:bg-white/15 focus:ring-2 focus:ring-sky-400/25 text-xs font-semibold text-white placeholder:text-white/40 focus:outline-none transition-all"
                />
              </div>
            </div>
          ) : worldMode !== 'warzone' && levelView === 'publicApartments' ? (
            <div className="px-4 sm:px-5 py-3 bg-white/[0.04] border-t border-white/[0.12] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-300/90">
                OPEN FOR PUBLIC VISITS ({filteredPublicApartments.length}) · MANAGE PRIVACY IN SMARTPHONE → MY APARTMENT
              </div>
              <div className="w-full sm:w-64">
                <input
                  type="text"
                  data-transit-public-apartment-search="true"
                  value={apartmentSearchQuery}
                  onChange={(e) => setApartmentSearchQuery(e.target.value)}
                  placeholder="Search public apartments..."
                  aria-label="Search public apartments"
                  className="w-full px-4 py-1.5 rounded-full bg-white/10 border border-white/15 focus:border-emerald-400/70 focus:bg-white/15 focus:ring-2 focus:ring-emerald-400/25 text-xs font-semibold text-white placeholder:text-white/40 focus:outline-none transition-all"
                />
              </div>
            </div>
          ) : undefined
        }
      >
        {/* =================================================================
            WARZONE MODE: STRICTLY EXIT WARZONE TERMINAL (NO OTHER MENUS)
            ================================================================= */}
        {worldMode === 'warzone' ? (
          <div className="flex-1 overflow-y-auto p-6 sm:p-10 text-white flex flex-col items-center justify-center text-center space-y-6">
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
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                SELECT DESTINATION OR CITIZEN SERVICE
              </div>
              <div className="px-3 py-1 rounded-full bg-white/[0.08] border border-white/15 text-[11px] font-semibold uppercase tracking-wide text-white/80">
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
                className="group relative h-[156px] sm:h-[168px] rounded-2xl bg-slate-900/70 border border-white/15 shadow-md hover:border-sky-400/60 hover:shadow-[0_12px_30px_rgba(0,0,0,0.45)] hover:-translate-y-0.5 transition-all text-left overflow-hidden flex flex-col justify-between cursor-pointer"
              >
                <img
                  src={kioskThumbnails.travel_districts || '/docs/hero-2-tram-station.jpg'}
                  alt="Travel & Districts"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-slate-950/15" />

                <div className="relative z-10 p-3.5 flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-sky-500/90 text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
                    THE CITY NETWORK
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-900/75 text-white border border-white/20 text-[10px] font-bold uppercase">
                    {districtDestinationCount} DISTRICTS
                  </span>
                </div>

                <div className="relative z-10 p-4 pt-0">
                  <div className="text-lg sm:text-xl font-extrabold uppercase tracking-tight text-white">
                    TRAVEL &amp; DISTRICTS
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-200/90 line-clamp-2">
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
                className="group relative h-[156px] sm:h-[168px] rounded-2xl bg-slate-900/70 border border-white/15 shadow-md hover:border-amber-400/60 hover:shadow-[0_12px_30px_rgba(0,0,0,0.45)] hover:-translate-y-0.5 transition-all text-left overflow-hidden flex flex-col justify-between cursor-pointer"
              >
                <img
                  src={kioskThumbnails.warzone_arena || '/docs/hero-7-crate-stacking-pad.jpg'}
                  alt="Warzone Arena"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-slate-950/15" />

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
                  <p className="mt-1 text-xs font-medium text-slate-200/90 line-clamp-2">
                    Deploy into the Red vs Blue tactical combat arena with weapons, vehicles, and crate logistics.
                  </p>
                </div>
              </button>

              {/* CARD 3: PUBLIC APARTMENT */}
              <button
                type="button"
                data-transit-card="public_apartment"
                onClick={handleOpenPublicApartmentsBrowser}
                className="group relative h-[156px] sm:h-[168px] rounded-2xl bg-slate-900/70 border border-white/15 shadow-md hover:border-emerald-400/60 hover:shadow-[0_12px_30px_rgba(0,0,0,0.45)] hover:-translate-y-0.5 transition-all text-left overflow-hidden flex flex-col justify-between cursor-pointer"
              >
                <img
                  src={kioskThumbnails.my_house || '/assets/kiosk/glass_modern_interior.jpg'}
                  alt="Public Apartments"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-slate-950/15" />

                <div className="relative z-10 p-3.5 flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/90 text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
                    OPEN RESIDENCES
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-900/75 text-white border border-white/20 text-[10px] font-bold uppercase">
                    {publicApartments.length} PUBLIC
                  </span>
                </div>

                <div className="relative z-10 p-4 pt-0">
                  <div className="text-lg sm:text-xl font-extrabold uppercase tracking-tight text-white">
                    PUBLIC APARTMENT
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-200/90 line-clamp-2">
                    Tour open public apartments and city model residences. Access your own apartment anytime via Smartphone → My Apartment.
                  </p>
                </div>
              </button>

              {/* CARD 4: DEX & MARKETPLACE */}
              <button
                type="button"
                data-transit-card="shop_exchange"
                onClick={handleClickShopExchange}
                className="group relative h-[156px] sm:h-[168px] rounded-2xl bg-slate-900/70 border border-white/15 shadow-md hover:border-emerald-400/60 hover:shadow-[0_12px_30px_rgba(0,0,0,0.45)] hover:-translate-y-0.5 transition-all text-left overflow-hidden flex flex-col justify-between cursor-pointer"
              >
                <img
                  src={kioskThumbnails.shop_exchange || '/docs/hero-4-hana-exchange.jpg'}
                  alt="DEX & Marketplace"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-slate-950/15" />

                <div className="relative z-10 p-3.5 flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/90 text-slate-950 text-[10px] font-bold uppercase tracking-wider shadow-xs">
                    CRYPTO &amp; NFT DEX
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-900/75 text-white border border-white/20 text-[10px] font-bold uppercase">
                    NEAR / RESPITE
                  </span>
                </div>

                <div className="relative z-10 p-4 pt-0">
                  <div className="text-lg sm:text-xl font-extrabold uppercase tracking-tight text-white">
                    DEX &amp; MARKETPLACE
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-200/90 line-clamp-2">
                    Live candlestick chart, NEAR to RESPITE swap terminal, and P2P Fish &amp; Collector NFT marketplace.
                  </p>
                </div>
              </button>

              {/* CARD 5: JOBS */}
              <button
                type="button"
                data-transit-card="jobs"
                onClick={handleOpenJobsBrowser}
                className="group relative h-[156px] sm:h-[168px] rounded-2xl bg-slate-900/70 border border-white/15 shadow-md hover:border-emerald-400/60 hover:shadow-[0_12px_30px_rgba(0,0,0,0.45)] hover:-translate-y-0.5 transition-all text-left overflow-hidden flex flex-col justify-between cursor-pointer"
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
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-slate-950/15" />

                <div className="relative z-10 p-3.5 flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/90 text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
                    WORK &amp; EARN XP
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-900/75 text-white border border-white/20 text-[10px] font-bold uppercase">
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
                  <p className="mt-1 text-xs font-medium text-slate-200/90 line-clamp-2">
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
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                SELECT A CITIZEN JOB TO START WORKING
              </div>
              <div className="px-3 py-1 rounded-full bg-white/[0.08] border border-white/15 text-[11px] font-semibold uppercase tracking-wide text-white/80">
                1 AVAILABLE JOB
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* JOB CARD 1: CAFE GLASSHOUSE */}
              <button
                type="button"
                data-transit-job-card="cafe_glasshouse"
                onClick={handleEnterCafeGlasshouseJob}
                className="group relative h-[196px] sm:h-[214px] rounded-2xl bg-slate-900/70 border border-white/15 shadow-md hover:border-emerald-400/60 hover:shadow-[0_12px_30px_rgba(0,0,0,0.45)] hover:-translate-y-0.5 transition-all text-left overflow-hidden flex flex-col justify-between cursor-pointer"
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
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-slate-950/15" />

                <div className="relative z-10 p-3.5 flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/90 text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
                    BARISTA SHIFT
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-900/75 text-white border border-white/20 text-[10px] font-bold uppercase">
                    CerBucks / XP
                  </span>
                </div>

                <div className="relative z-10 p-4 pt-0">
                  <div className="text-lg sm:text-xl font-extrabold uppercase tracking-tight text-white">
                    CAFE GLASSHOUSE
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-200/90 line-clamp-2">
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
          <div className="flex-1 overflow-y-auto p-5 sm:p-7 text-white">
            <div className="mb-5 text-center">
              <div className="inline-block px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-300/30 font-bold text-xs uppercase tracking-wider mb-2">
                WARZONE MINI-GAME DEPLOYMENT
              </div>
              <h3 className="text-xl sm:text-3xl font-extrabold uppercase tracking-tight text-white">
                CHOOSE YOUR TEAM FACTION
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm font-medium text-slate-300 max-w-lg mx-auto">
                Select your squad to board the City Transit Tram and spawn randomly at the combat Cratepad. Compete to collect CerBucks drops and battle the opposition!
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
        ) : levelView === 'publicApartments' ? (
          /* =================================================================
             PUBLIC APARTMENT MASTER-DETAIL BROWSER (SAME UX AS TRAVEL)
             ================================================================= */
          <div className="flex-1 min-h-0 flex flex-col md:flex-row">
            {/* LEFT SIDEBAR (~30% WIDTH) */}
            <div
              data-transit-public-apartments-sidebar="true"
              className="w-full md:w-[30%] h-[165px] md:h-[430px] overflow-y-auto border-b md:border-b-0 md:border-r border-white/[0.12] bg-white/[0.03] p-3 space-y-2"
            >
              {filteredPublicApartments.length === 0 ? (
                <div className="p-4 text-center text-xs font-bold uppercase text-white/50">
                  NO PUBLIC APARTMENTS FOUND
                </div>
              ) : (
                filteredPublicApartments.map((apt) => {
                  const isSelected = selectedPublicApartment?.id === apt.id;
                  return (
                    <button
                      key={apt.id}
                      type="button"
                      data-transit-public-apartment-row={apt.id}
                      onClick={() => {
                        soundEngine.playUiClick();
                        setSelectedApartmentId(apt.id);
                      }}
                      className={`w-full p-2.5 rounded-2xl flex items-center gap-2.5 text-left transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-400/70 ring-1 ring-emerald-400/35 shadow-sm'
                          : 'bg-white/[0.06] hover:bg-white/[0.11] border-white/10'
                      }`}
                    >
                      <img
                        src={
                          apt.id === 'public_hana_west_penthouse' && kioskThumbnails.my_house
                            ? kioskThumbnails.my_house
                            : apt.imageUrl
                        }
                        alt={apt.shortTitle}
                        className="w-11 h-11 rounded-xl object-cover shrink-0 bg-slate-900 border border-white/10"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold uppercase tracking-tight text-white truncate">
                          {apt.shortTitle}
                        </div>
                        <div className="text-[10px] text-white/60 truncate mt-0.5">
                          Host: {apt.ownerName}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              apt.isOwnApartment
                                ? 'bg-amber-400/25 text-amber-200 border border-amber-300/35'
                                : 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/30'
                            }`}
                          >
                            {apt.tag}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* RIGHT SHOWCASE PANEL (~70% WIDTH) */}
            {selectedPublicApartment ? (
              <div className="w-full md:w-[70%] h-[280px] md:h-[430px] relative bg-slate-900 overflow-hidden flex flex-col justify-between">
                <img
                  src={
                    selectedPublicApartment.id === 'public_hana_west_penthouse' &&
                    kioskThumbnails.my_house
                      ? kioskThumbnails.my_house
                      : selectedPublicApartment.imageUrl
                  }
                  alt={selectedPublicApartment.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/92 via-slate-950/35 to-slate-950/15" />

                <div className="relative z-10 p-4 flex items-center justify-between gap-2">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-bold uppercase tracking-wider shadow-sm">
                    {selectedPublicApartment.tag}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-slate-950/75 text-white/90 border border-white/15 text-[11px] font-bold uppercase shadow-sm">
                    {selectedPublicApartment.styleLabel}
                  </span>
                </div>

                <div className="relative z-10 p-5 sm:p-6 bg-slate-950/78 border-t border-white/10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 mb-1">
                      HOST: {selectedPublicApartment.ownerName}
                    </div>
                    <h3
                      data-transit-selected-apartment-title="true"
                      className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-white leading-tight"
                    >
                      {selectedPublicApartment.title}
                    </h3>
                    <p className="mt-1.5 text-xs sm:text-sm font-medium text-slate-200 line-clamp-2 leading-snug">
                      {selectedPublicApartment.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    data-transit-visit-apartment-btn={selectedPublicApartment.id}
                    onClick={() => {
                      soundEngine.playUiConfirm();
                      onVisitPublicApartment?.(selectedPublicApartment);
                    }}
                    className="px-6 py-3 rounded-full font-bold text-xs sm:text-sm uppercase tracking-wider shrink-0 bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md cursor-pointer active:scale-95 transition-all"
                  >
                    VISIT APARTMENT &gt;
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full md:w-[70%] h-[280px] md:h-[430px] flex items-center justify-center text-white/60 text-sm font-semibold">
                Select a public apartment to preview.
              </div>
            )}
          </div>
        ) : (
          /* =================================================================
             LEVEL 2: MASTER-DETAIL SPLIT-VIEW BROWSER
             - Left Sidebar (~30% width, scrollable)
             - Right Showcase Panel (~70% width, hero preview + ENTER >)
             ================================================================= */
          <div className="flex-1 min-h-0 flex flex-col md:flex-row">
            {/* LEFT SIDEBAR (~30% WIDTH) */}
            <div
              data-transit-sidebar="true"
              className="w-full md:w-[30%] h-[165px] md:h-[430px] overflow-y-auto border-b md:border-b-0 md:border-r border-white/[0.12] bg-white/[0.03] p-3 space-y-2"
            >
              {filteredDestinations.length === 0 ? (
                <div className="p-4 text-center text-xs font-bold uppercase text-white/50">
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
                          ? 'bg-sky-500/20 border-sky-400/70 ring-1 ring-sky-400/35 shadow-sm'
                          : 'bg-white/[0.06] hover:bg-white/[0.11] border-white/10'
                      }`}
                    >
                      <img
                        src={kioskThumbnails[dest.id] || dest.heroImageUrl}
                        alt={dest.shortTitle}
                        className="w-11 h-11 rounded-xl object-cover shrink-0 bg-slate-900 border border-white/10"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold uppercase tracking-tight text-white truncate">
                          {dest.shortTitle}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          {isHere ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-400/30 text-[9px] font-bold uppercase">
                              HERE
                            </span>
                          ) : (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                dest.id === 'warzone_arena'
                                  ? 'bg-rose-500/25 text-rose-300 border border-rose-400/30'
                                  : 'bg-sky-500/20 text-sky-300 border border-sky-400/25'
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
            <div className="w-full md:w-[70%] h-[280px] md:h-[430px] relative bg-slate-900 overflow-hidden flex flex-col justify-between">
              <img
                src={
                  kioskThumbnails[selectedDestination.id] ||
                  selectedDestination.heroImageUrl
                }
                alt={selectedDestination.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-slate-950/15" />

              {/* Top Badges inside Right Showcase */}
              <div className="relative z-10 p-4 flex items-center justify-between gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm ${
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
                  <span className="px-3 py-1 rounded-full bg-slate-950/75 text-white/90 border border-white/15 text-[11px] font-bold uppercase shadow-sm">
                    {selectedDestination.hasHalteShelter
                      ? 'RAIL TRANSIT STATION'
                      : 'STANDALONE TRANSIT KIOSK'}
                  </span>
                )}
              </div>

              {/* Frosted Bottom Overlay with Title, 1-2 Line Description, and Pill ENTER > Button */}
              <div className="relative z-10 p-5 sm:p-6 bg-slate-950/78 border-t border-white/10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
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
        )}
      </TabletDeviceMockupShell>
    </div>
  );
};
