import React, { useEffect } from 'react';
import {
  Backpack,
  Bike,
  ChevronLeft,
  ClipboardList,
  Coins,
  Home,
  Map as MapIcon,
  MessageCircle,
  Shirt,
  Sparkles,
  User,
  Users,
  Wallet,
  Wifi,
  X,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import { formatClock24h } from '../game/buddiesWeatherSystem';
import type { LightingPresetKey, WeatherConditionKey } from '../game/buddiesBlitzRules';

export type SmartphoneAppId =
  | 'home'
  | 'wallet'
  | 'bag'
  | 'scooters'
  | 'missions'
  | 'profile'
  | 'messages'
  | 'contacts';

export interface SmartphoneOsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeApp: SmartphoneAppId;
  canGoBack: boolean;
  onNavigateApp: (app: SmartphoneAppId) => void;
  onGoBack: () => void;
  onGoHome: () => void;
  renderAppContent: (app: Exclude<SmartphoneAppId, 'home'>) => React.ReactNode;
  timeOfDayHours: number;
  lightingPreset: LightingPresetKey;
  weatherCondition: WeatherConditionKey;
  lulBalance: number;
  nearBalance: number;
  completedMissionsCount: number;
  totalMissionsCount: number;
  actionableMissionsCount: number;
  activeMissionTitle?: string | null;
  unreadMessagesCount: number;
  newAssetCount: number;
  isFishingRodEquipped: boolean;
  isRidingScooter: boolean;
  onOpenCityMap: () => void;
  onOpenWardrobe: () => void;
}

const WEATHER_DISPLAY: Record<WeatherConditionKey, { icon: string; label: string }> = {
  cerah: { icon: '☀️', label: 'Clear' },
  berangin: { icon: '💨', label: 'Windy' },
  kabut: { icon: '🌫️', label: 'Foggy' },
  hujan: { icon: '🌧️', label: 'Rain' },
};

const PHASE_DISPLAY: Record<LightingPresetKey, string> = {
  dawn: 'Dawn',
  day: 'Daytime',
  dusk: 'Dusk',
  night: 'Night',
};

/**
 * Angled glossy lavender/purple inZOI-style Smartphone SVG icon for HUD docks & triggers.
 */
export const HudSmartphoneIcon: React.FC<{ className?: string }> = ({
  className = 'w-6 h-6',
}) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="blitzPhoneBody" x1="6" y1="4" x2="26" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#d8b4fe" />
        <stop offset="52%" stopColor="#a855f7" />
        <stop offset="100%" stopColor="#7e22ce" />
      </linearGradient>
      <linearGradient id="blitzPhoneScreen" x1="8" y1="6" x2="22" y2="24" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#f3e8ff" stopOpacity="0.95" />
        <stop offset="100%" stopColor="#c084fc" stopOpacity="0.88" />
      </linearGradient>
    </defs>
    <g transform="rotate(-14 16 16)">
      {/* Soft side thickness */}
      <rect x="7" y="4.5" width="18" height="24" rx="4.5" fill="#4c1d95" opacity="0.55" />
      {/* Phone body */}
      <rect
        x="7"
        y="3"
        width="18"
        height="24.5"
        rx="4.2"
        fill="url(#blitzPhoneBody)"
        stroke="#f5d0fe"
        strokeWidth="1"
      />
      {/* Screen */}
      <rect x="9.2" y="5.4" width="13.6" height="19.6" rx="2.4" fill="url(#blitzPhoneScreen)" />
      {/* Mini app dots / hello pill on screen */}
      <rect x="11.2" y="19.4" width="9.6" height="3.2" rx="1.6" fill="#1e1b4b" opacity="0.88" />
      <circle cx="13.2" cy="11.2" r="1.4" fill="#7e22ce" opacity="0.65" />
      <circle cx="16.5" cy="11.2" r="1.4" fill="#38bdf8" opacity="0.85" />
      <circle cx="19.6" cy="11.2" r="1.4" fill="#fb7185" opacity="0.85" />
      {/* Top speaker notch */}
      <rect x="13.8" y="4.1" width="4.4" height="0.85" rx="0.42" fill="#3b0764" opacity="0.55" />
    </g>
  </svg>
);

/**
 * inZOI-inspired Translucent Frosted Glass Smartphone OS Launcher Modal.
 * Serves as the unified single-entry hub replacing the old World button:
 * Clock + Weather header, 2 white Bento Widgets (Missions + Wallet),
 * 4-column squircle app grid, and 4-icon bottom phone dock.
 */
export const SmartphoneOsModal: React.FC<SmartphoneOsModalProps> = ({
  isOpen,
  onClose,
  activeApp,
  canGoBack,
  onNavigateApp,
  onGoBack,
  onGoHome,
  renderAppContent,
  timeOfDayHours,
  lightingPreset,
  weatherCondition,
  lulBalance,
  nearBalance,
  completedMissionsCount,
  totalMissionsCount,
  actionableMissionsCount,
  activeMissionTitle,
  unreadMessagesCount,
  newAssetCount,
  isFishingRodEquipped,
  isRidingScooter,
  onOpenCityMap,
  onOpenWardrobe,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (activeApp !== 'home') {
          onGoHome();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, activeApp, onGoHome, onClose]);

  if (!isOpen) return null;

  const isHome = activeApp === 'home';
  const isDarkShell = isHome || activeApp === 'wallet';
  const clockLabel = formatClock24h(timeOfDayHours);
  const weatherMeta = WEATHER_DISPLAY[weatherCondition] ?? WEATHER_DISPLAY.cerah;
  const phaseLabel = PHASE_DISPLAY[lightingPreset] ?? 'Daytime';

  const openInPhone = (app: SmartphoneAppId) => {
    soundEngine.playUiClick();
    onNavigateApp(app);
  };

  const launchExternal = (fn: () => void) => {
    soundEngine.playUiClick();
    onClose();
    fn();
  };

  const gridApps: ReadonlyArray<{
    id: string;
    label: string;
    gradient: string;
    icon: React.ReactNode;
    badge?: number | string;
    badgeColor?: string;
    onClick: () => void;
  }> = [
    {
      id: 'city_map',
      label: 'City Map',
      gradient: 'from-sky-400 to-blue-600',
      icon: <MapIcon className="w-6 h-6 text-white stroke-[1.9]" />,
      onClick: () => launchExternal(onOpenCityMap),
    },
    {
      id: 'wardrobe',
      label: 'Wardrobe',
      gradient: 'from-fuchsia-400 to-purple-600',
      icon: <Shirt className="w-6 h-6 text-white stroke-[1.9]" />,
      onClick: () => launchExternal(onOpenWardrobe),
    },
    {
      id: 'scooters',
      label: 'Scooters',
      gradient: 'from-amber-400 to-orange-500',
      icon: <Bike className="w-6 h-6 text-white stroke-[1.9]" />,
      badge: isRidingScooter ? 'ON' : undefined,
      badgeColor: 'bg-emerald-400 text-slate-950',
      onClick: () => openInPhone('scooters'),
    },
    {
      id: 'bag',
      label: 'Bag',
      gradient: 'from-emerald-400 to-teal-600',
      icon: <Backpack className="w-6 h-6 text-white stroke-[1.9]" />,
      badge: isFishingRodEquipped ? '🎣' : undefined,
      badgeColor: 'bg-sky-300 text-slate-950',
      onClick: () => openInPhone('bag'),
    },
    {
      id: 'missions',
      label: 'Missions',
      gradient: 'from-violet-400 to-indigo-600',
      icon: <ClipboardList className="w-6 h-6 text-white stroke-[1.9]" />,
      badge: actionableMissionsCount > 0 ? actionableMissionsCount : undefined,
      badgeColor: 'bg-emerald-400 text-slate-950',
      onClick: () => openInPhone('missions'),
    },
    {
      id: 'wallet',
      label: 'Payments',
      gradient: 'from-yellow-400 to-amber-500',
      icon: <Wallet className="w-6 h-6 text-white stroke-[1.9]" />,
      badge: newAssetCount > 0 ? newAssetCount : undefined,
      badgeColor: 'bg-rose-500 text-white',
      onClick: () => openInPhone('wallet'),
    },
    {
      id: 'profile',
      label: 'Profile',
      gradient: 'from-cyan-400 to-sky-600',
      icon: <User className="w-6 h-6 text-white stroke-[1.9]" />,
      onClick: () => openInPhone('profile'),
    },
    {
      id: 'world_feed',
      label: 'World Feed',
      gradient: 'from-rose-400 to-pink-600',
      icon: <Sparkles className="w-6 h-6 text-white stroke-[1.9]" />,
      onClick: () => openInPhone('messages'),
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Buddies Smartphone"
      data-smartphone-os-modal="true"
      data-smartphone-active-app={activeApp}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          soundEngine.playUiClick();
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/30 backdrop-blur-[2px] pointer-events-auto select-none"
    >
      {/* Outer Positioning Wrapper so Floating Close Button can overlap Top-Right */}
      <div className="relative w-full max-w-[392px] sm:max-w-[420px] h-[640px] max-h-[88vh]">
        {/* Floating Circular Close Button overlapping Top-Right Corner */}
        <button
          type="button"
          data-smartphone-close-btn="true"
          onClick={() => {
            soundEngine.playUiClick();
            onClose();
          }}
          aria-label="Close Smartphone"
          className={`absolute -top-2.5 -right-2.5 z-30 w-8 h-8 rounded-full backdrop-blur-xl border flex items-center justify-center shadow-[0_6px_18px_rgba(0,0,0,0.28)] cursor-pointer transition-all active:scale-95 ${
            isDarkShell
              ? 'bg-white/25 hover:bg-white/40 border-white/35 text-white'
              : 'bg-white hover:bg-slate-100 border-slate-200/90 text-slate-700'
          }`}
        >
          <X className="w-4 h-4 stroke-[2.2]" />
        </button>

        {/* Unified Smartphone OS Frame */}
        <div
          className={`w-full h-full rounded-[34px] overflow-hidden flex flex-col backdrop-blur-2xl shadow-[0_24px_70px_rgba(0,0,0,0.52)] border transition-colors duration-200 ${
            isDarkShell
              ? 'bg-[#141926]/62 border-white/25 text-white'
              : 'bg-[#f4f6f9]/98 border-white/80 text-slate-900'
          }`}
        >
          {/* Persistent Phone Status Bar */}
          <div
            className={`shrink-0 flex items-center justify-between text-[10.5px] font-medium px-5 pt-3 pb-2 transition-colors ${
              isDarkShell
                ? 'text-white/90'
                : 'bg-white/95 text-slate-700 border-b border-slate-200/60'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Wifi
                className={`w-3 h-3 ${isDarkShell ? 'text-white/85' : 'text-slate-600'}`}
                aria-hidden="true"
              />
              <span className="tracking-wide font-semibold">BLITZ OS</span>
            </div>
            <span className="font-mono tabular-nums font-semibold">{clockLabel}</span>
            <span className="font-mono tabular-nums opacity-85">92%</span>
          </div>

          {/* Middle Flexible Screen */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {isHome ? (
              <div className="flex-1 min-h-0 flex flex-col px-4 pt-2 pb-3 overflow-y-auto">
                {/* Clock + Weather Header */}
                <div className="flex items-end justify-between px-1 mb-4">
                  <div>
                    <div className="text-[10.5px] font-semibold uppercase tracking-wider text-white/75">
                      {phaseLabel}
                    </div>
                    <div className="text-[30px] font-semibold leading-none tracking-tight font-mono tabular-nums text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                      {clockLabel}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <div>
                      <div className="text-xs font-semibold text-white/95">{weatherMeta.label}</div>
                      <div className="text-[10px] text-white/70">Buddies City</div>
                    </div>
                    <span aria-hidden="true" className="text-2xl leading-none drop-shadow">
                      {weatherMeta.icon}
                    </span>
                  </div>
                </div>

                {/* 2 White Bento Widgets (Missions + Wallet Balance) */}
                <div className="grid grid-cols-2 gap-2.5 mb-5">
                  {/* Widget 1: Daily Mission Notes */}
                  <button
                    type="button"
                    onClick={() => openInPhone('missions')}
                    className="group rounded-2xl bg-white/95 hover:bg-white text-slate-900 overflow-hidden shadow-[0_8px_22px_rgba(0,0,0,0.22)] text-left flex flex-col cursor-pointer transition-transform active:scale-[0.98]"
                  >
                    <div className="px-2.5 py-1.5 bg-gradient-to-r from-violet-400 to-purple-500 text-white text-[10px] font-semibold flex items-center justify-between">
                      <span className="flex items-center gap-1 truncate">
                        <ClipboardList className="w-3 h-3 shrink-0" />
                        <span>Missions</span>
                      </span>
                      <span className="font-mono tabular-nums text-[9.5px] opacity-90">
                        {completedMissionsCount}/{totalMissionsCount}
                      </span>
                    </div>
                    <div className="p-2.5 flex-1 flex flex-col justify-between min-h-[76px]">
                      <div className="text-[11px] font-semibold text-slate-900 leading-snug line-clamp-2">
                        {activeMissionTitle || 'Daily City Goals'}
                      </div>
                      <div className="text-[9.5px] text-slate-500 mt-1">
                        {actionableMissionsCount > 0
                          ? `${actionableMissionsCount} reward ready`
                          : 'Tap to view tasks'}
                      </div>
                    </div>
                  </button>

                  {/* Widget 2: Wallet & Bills */}
                  <button
                    type="button"
                    onClick={() => openInPhone('wallet')}
                    className="group rounded-2xl bg-white/95 hover:bg-white text-slate-900 overflow-hidden shadow-[0_8px_22px_rgba(0,0,0,0.22)] text-left flex flex-col cursor-pointer transition-transform active:scale-[0.98]"
                  >
                    <div className="px-2.5 py-1.5 bg-gradient-to-r from-orange-400 to-rose-400 text-white text-[10px] font-semibold flex items-center gap-1">
                      <Coins className="w-3 h-3 shrink-0" />
                      <span>Wallet Balance</span>
                    </div>
                    <div className="p-2.5 flex-1 flex flex-col justify-between min-h-[76px]">
                      <div>
                        <div className="text-[9.5px] text-slate-500">Available Funds</div>
                        <div className="text-sm font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                          {lulBalance.toLocaleString()}{' '}
                          <span className="text-[10px] font-semibold text-amber-600">LUL</span>
                        </div>
                      </div>
                      <div className="text-[9.5px] font-mono tabular-nums text-slate-500">
                        {nearBalance >= 1 ? nearBalance.toFixed(2) : Number(nearBalance.toFixed(4))}{' '}
                        NEAR
                      </div>
                    </div>
                  </button>
                </div>

                {/* 4-Column Squircle App Icon Grid */}
                <div className="grid grid-cols-4 gap-x-2.5 gap-y-3.5 px-0.5 flex-1 content-start">
                  {gridApps.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      data-smartphone-app={app.id}
                      onClick={app.onClick}
                      className="group flex flex-col items-center gap-1.5 cursor-pointer"
                    >
                      <span
                        className={`relative w-12 h-12 rounded-[14px] bg-gradient-to-br ${app.gradient} shadow-[0_6px_16px_rgba(0,0,0,0.28)] flex items-center justify-center transition-transform group-hover:scale-105 group-active:scale-95`}
                      >
                        {app.icon}
                        {app.badge !== undefined && (
                          <span
                            className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center shadow-sm border border-white/60 ${
                              app.badgeColor ?? 'bg-rose-500 text-white'
                            }`}
                          >
                            {app.badge}
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] font-medium text-white/90 truncate max-w-[74px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]">
                        {app.label}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Home Screen 4-App Dock (Profile · Missions · Messages · Contacts) */}
                <div className="mt-auto pt-3">
                  <div className="grid grid-cols-4 gap-2 px-2 py-2 rounded-2xl bg-white/[0.12] backdrop-blur-md border border-white/15">
                    <button
                      type="button"
                      data-smartphone-dock="profile"
                      onClick={() => openInPhone('profile')}
                      className="group flex flex-col items-center gap-1 cursor-pointer"
                    >
                      <span className="w-11 h-11 rounded-[13px] bg-gradient-to-br from-emerald-400 to-green-600 shadow-md flex items-center justify-center transition-transform group-hover:scale-105 group-active:scale-95">
                        <User className="w-5 h-5 text-white stroke-[2]" />
                      </span>
                      <span className="text-[9.5px] font-medium text-white/90">Profile</span>
                    </button>

                    <button
                      type="button"
                      data-smartphone-dock="missions"
                      onClick={() => openInPhone('missions')}
                      className="group flex flex-col items-center gap-1 cursor-pointer"
                    >
                      <span className="relative w-11 h-11 rounded-[13px] bg-gradient-to-br from-purple-400 to-fuchsia-600 shadow-md flex items-center justify-center transition-transform group-hover:scale-105 group-active:scale-95">
                        <ClipboardList className="w-5 h-5 text-white stroke-[2]" />
                        {actionableMissionsCount > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-emerald-400 text-slate-950 text-[9px] font-bold flex items-center justify-center">
                            {actionableMissionsCount}
                          </span>
                        )}
                      </span>
                      <span className="text-[9.5px] font-medium text-white/90">Missions</span>
                    </button>

                    <button
                      type="button"
                      data-smartphone-dock="messages"
                      onClick={() => openInPhone('messages')}
                      className="group flex flex-col items-center gap-1 cursor-pointer"
                    >
                      <span className="relative w-11 h-11 rounded-[13px] bg-gradient-to-br from-sky-400 to-blue-500 shadow-md flex items-center justify-center transition-transform group-hover:scale-105 group-active:scale-95">
                        <MessageCircle className="w-5 h-5 text-white stroke-[2]" />
                        {unreadMessagesCount > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-sky-300 text-slate-950 text-[9px] font-bold flex items-center justify-center border border-white/70">
                            {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                          </span>
                        )}
                      </span>
                      <span className="text-[9.5px] font-medium text-white/90">Messages</span>
                    </button>

                    <button
                      type="button"
                      data-smartphone-dock="contacts"
                      onClick={() => openInPhone('contacts')}
                      className="group flex flex-col items-center gap-1 cursor-pointer"
                    >
                      <span className="w-11 h-11 rounded-[13px] bg-gradient-to-br from-lime-400 to-emerald-500 shadow-md flex items-center justify-center transition-transform group-hover:scale-105 group-active:scale-95">
                        <Users className="w-5 h-5 text-white stroke-[2]" />
                      </span>
                      <span className="text-[9.5px] font-medium text-white/90">Contacts</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {renderAppContent(activeApp)}
              </div>
            )}
          </div>

          {/* Real Smartphone Bottom Navigation Bar (Back · Home · Close) */}
          <nav
            aria-label="Smartphone Navigation"
            data-smartphone-nav-bar="true"
            className={`h-12 px-10 flex items-center justify-between shrink-0 border-t transition-colors ${
              isDarkShell
                ? 'bg-[#0d1118]/45 border-white/15 text-white/85'
                : 'bg-white/96 border-slate-200/80 text-slate-600'
            }`}
          >
            <button
              type="button"
              data-smartphone-nav-back="true"
              onClick={() => {
                soundEngine.playUiClick();
                onGoBack();
              }}
              aria-label="Back"
              title={canGoBack ? 'Back' : 'Close'}
              className={`w-10 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer active:scale-90 ${
                isDarkShell
                  ? 'hover:bg-white/12 text-white/75 hover:text-white'
                  : 'hover:bg-slate-100 text-slate-700 hover:text-slate-950'
              }`}
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.2]" aria-hidden="true" />
            </button>

            <button
              type="button"
              data-smartphone-nav-home="true"
              onClick={() => {
                soundEngine.playUiClick();
                onGoHome();
              }}
              aria-label="Home"
              title="Home"
              className={`w-12 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                isDarkShell
                  ? 'bg-white/22 text-white ring-1 ring-white/35'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950'
              }`}
            >
              <Home className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />
            </button>

            <button
              type="button"
              data-smartphone-nav-close="true"
              onClick={() => {
                soundEngine.playUiClick();
                onClose();
              }}
              aria-label="Close Smartphone"
              title="Close"
              className={`w-10 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer active:scale-90 ${
                isDarkShell
                  ? 'hover:bg-white/12 text-white/75 hover:text-white'
                  : 'hover:bg-slate-100 text-slate-600 hover:text-slate-950'
              }`}
            >
              <X className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};
