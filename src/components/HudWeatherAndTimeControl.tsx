import { useEffect, useRef, useState } from 'react';
import { Music, RefreshCw, Sun, Volume1, Volume2, VolumeX } from 'lucide-react';
import {
  CITY_LIGHTS_SCALE_BOUNDS,
  TIME_PHASE_LABELS,
  WEATHER_PRESETS,
  type LightingPresetKey,
  type RainIntensityTier,
  type WeatherConditionKey,
} from '../game/buddiesBlitzRules';
import { clampAudioVolumePct } from '../game/buddiesRealEstateKioskRules';
import { formatClock24h } from '../game/buddiesWeatherSystem';
import { soundEngine } from '../game/audio';

export interface HudWeatherAudioControls {
  isMusicMuted: boolean;
  isSfxMuted: boolean;
  musicVolumePct: number;
  sfxVolumePct: number;
  onToggleMusicMute: () => void;
  onToggleSfxMute: () => void;
  onChangeMusicVolumePct: (nextPct: number) => void;
  onChangeSfxVolumePct: (nextPct: number) => void;
}

export interface HudWeatherAndTimeControlProps {
  contextId: 'city' | 'warzone' | 'city_view';
  popoverPlacement?: 'top' | 'bottom';
  popoverAlign?: 'left' | 'right';
  lightingPreset: LightingPresetKey;
  timeOfDayHours: number;
  weatherCondition: WeatherConditionKey;
  rainIntensityTier: RainIntensityTier;
  autoCycleEnabled: boolean;
  cityLightsScale: number;
  onSelectTimePhase: (phase: LightingPresetKey) => void;
  onCycleTimePhase: () => void;
  onChangeTimeOfDayHours: (hours: number) => void;
  onSelectWeatherCondition: (condition: WeatherConditionKey) => void;
  onSelectRainIntensityTier: (tier: RainIntensityTier) => void;
  onToggleAutoCycle: (enabled: boolean) => void;
  onChangeCityLightsScale: (scale: number) => void;
  audioControls?: HudWeatherAudioControls;
  compactPill?: boolean;
}

const TIME_PHASE_ITEMS: ReadonlyArray<{
  key: LightingPresetKey;
  icon: string;
  label: string;
  fullLabel: string;
}> = [
  { key: 'dawn', icon: '🌄', label: 'Dawn', fullLabel: 'Dawn' },
  { key: 'day', icon: '☀️', label: 'Day', fullLabel: 'Daytime' },
  { key: 'dusk', icon: '🌅', label: 'Dusk', fullLabel: 'Dusk' },
  { key: 'night', icon: '🌙', label: 'Night', fullLabel: 'Night' },
];

const WEATHER_ITEMS: ReadonlyArray<{
  key: WeatherConditionKey;
  icon: string;
  label: string;
}> = [
  { key: 'cerah', icon: '☀️', label: 'Clear' },
  { key: 'berangin', icon: '💨', label: 'Windy' },
  { key: 'kabut', icon: '🌫️', label: 'Foggy' },
  { key: 'hujan', icon: '🌧️', label: 'Rain' },
];

function getTimePhaseMeta(phase: LightingPresetKey): {
  icon: string;
  label: string;
  fullLabel: string;
} {
  return (
    TIME_PHASE_ITEMS.find((item) => item.key === phase) ?? {
      icon: '☀️',
      label: TIME_PHASE_LABELS[phase] ?? 'Day',
      fullLabel: TIME_PHASE_LABELS[phase] ?? 'Daytime',
    }
  );
}

function getWeatherMeta(condition: WeatherConditionKey): { icon: string; label: string } {
  return (
    WEATHER_ITEMS.find((item) => item.key === condition) ?? {
      icon: '☀️',
      label: WEATHER_PRESETS[condition]?.shortLabel ?? 'Clear',
    }
  );
}

/**
 * Compact Frosted Glass HUD pill + dark translucent Environment & Audio popover
 * styled to match the BLITZ OS translucent dark glass aesthetic (no stacked inner white cards).
 */
export function HudWeatherAndTimeControl({
  contextId,
  popoverPlacement = 'top',
  popoverAlign = 'right',
  lightingPreset,
  timeOfDayHours,
  weatherCondition,
  rainIntensityTier,
  autoCycleEnabled,
  cityLightsScale,
  onSelectTimePhase,
  onCycleTimePhase,
  onChangeTimeOfDayHours,
  onSelectWeatherCondition,
  onSelectRainIntensityTier,
  onToggleAutoCycle,
  onChangeCityLightsScale,
  audioControls,
  compactPill = false,
}: HudWeatherAndTimeControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const openPopover = () => {
    setIsOpen(true);
    window.dispatchEvent(
      new CustomEvent('hud-corner-popover-open', { detail: 'weather' }),
    );
  };

  useEffect(() => {
    const onOtherPopoverOpen = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail && detail !== 'weather') {
        setIsOpen(false);
      }
    };
    window.addEventListener('hud-corner-popover-open', onOtherPopoverOpen);
    return () => {
      window.removeEventListener('hud-corner-popover-open', onOtherPopoverOpen);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('hud-corner-popover-state', {
        detail: { id: `weather-${contextId}`, isOpen },
      }),
    );
  }, [contextId, isOpen]);

  useEffect(() => {
    return () => {
      window.dispatchEvent(
        new CustomEvent('hud-corner-popover-state', {
          detail: { id: `weather-${contextId}`, isOpen: false },
        }),
      );
    };
  }, [contextId]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDownOutside = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDownOutside, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDownOutside, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const timeMeta = getTimePhaseMeta(lightingPreset);
  const weatherMeta = getWeatherMeta(weatherCondition);
  const clockLabel = formatClock24h(timeOfDayHours);
  const cityLightsPct = Math.round(
    Math.max(
      CITY_LIGHTS_SCALE_BOUNDS.min,
      Math.min(CITY_LIGHTS_SCALE_BOUNDS.max, cityLightsScale),
    ) * 100,
  );
  const effectiveMusicPct = audioControls
    ? audioControls.isMusicMuted
      ? 0
      : clampAudioVolumePct(audioControls.musicVolumePct)
    : 0;
  const effectiveSfxPct = audioControls
    ? audioControls.isSfxMuted
      ? 0
      : clampAudioVolumePct(audioControls.sfxVolumePct)
    : 0;
  const SfxIcon =
    !audioControls || audioControls.isSfxMuted || effectiveSfxPct === 0
      ? VolumeX
      : effectiveSfxPct < 50
        ? Volume1
        : Volume2;

  return (
    <div
      ref={rootRef}
      data-hud-weather-controls={contextId}
      data-weather-popover-open={isOpen ? 'true' : 'false'}
      data-weather-condition={weatherCondition}
      data-time-phase={lightingPreset}
      className="relative flex items-center select-none pointer-events-auto"
    >
      {isOpen && (
        <div
          role="region"
          aria-label={audioControls ? 'Weather, Time & Audio' : 'City Weather & Time'}
          data-hud-weather-popover="true"
          data-hud-audio-mixer={audioControls ? 'true' : undefined}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className={`absolute ${popoverAlign === 'left' ? 'left-0' : 'right-0'} ${
            popoverPlacement === 'bottom' ? 'top-full mt-2.5' : 'bottom-full mb-2.5'
          } z-50 w-[316px] max-h-[82vh] overflow-y-auto rounded-[28px] bg-gradient-to-b from-[#171d2c]/86 via-[#111622]/84 to-[#0c101a]/88 text-white border border-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_24px_70px_rgba(0,0,0,0.58)]`}
        >
          {/* Top Clock + Weather Header (matching BLITZ OS translucent dark glass header) */}
          <div className="px-4 pt-3.5 pb-3 border-b border-white/12">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="text-[11px] font-semibold tracking-wide text-white/70">
                {audioControls ? 'Environment & Audio' : 'Weather & Time'}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  data-weather-quick-cycle-btn="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onCycleTimePhase();
                  }}
                  title="Cycle Time Phase [L]"
                  className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-white/12 hover:bg-white/22 text-[10px] font-semibold text-amber-200 border border-white/20 cursor-pointer transition-colors active:scale-95"
                >
                  <RefreshCw className="w-2.5 h-2.5 stroke-[2.2]" aria-hidden="true" />
                  <span>Phase</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setIsOpen(false);
                  }}
                  aria-label="Close Weather & Time Menu"
                  className="h-6 px-2.5 rounded-full bg-white/12 hover:bg-white/22 text-[10px] font-semibold text-white/90 border border-white/20 cursor-pointer transition-colors active:scale-95"
                >
                  Done
                </button>
              </div>
            </div>

            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/65">
                  {timeMeta.fullLabel}
                </div>
                <div
                  data-weather-clock-label="true"
                  className="text-[28px] font-semibold leading-none tracking-tight font-mono tabular-nums text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] mt-0.5"
                >
                  {clockLabel}
                </div>
              </div>
              <div className="flex items-center gap-2 text-right">
                <div>
                  <div className="text-xs font-semibold text-white/95">{weatherMeta.label}</div>
                  <div className="text-[10px] text-white/65">Buddies City</div>
                </div>
                <span aria-hidden="true" className="text-2xl leading-none drop-shadow">
                  {weatherMeta.icon}
                </span>
              </div>
            </div>
          </div>

          {/* Flat Glass Sections separated only by subtle hairlines (no inner cards) */}
          <div className="px-4 pb-3.5 divide-y divide-white/12">
            {/* Auto Cycle Toggle */}
            <label className="py-2.5 flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-[12px] font-semibold text-white/92">Auto Cycle (24h)</span>
              <span className="relative inline-flex items-center shrink-0">
                <input
                  type="checkbox"
                  data-weather-autocycle-checkbox="true"
                  checked={autoCycleEnabled}
                  onChange={(e) => {
                    soundEngine.playUiClick();
                    onToggleAutoCycle(e.currentTarget.checked);
                  }}
                  className="sr-only peer"
                />
                <span
                  aria-hidden="true"
                  className={`w-9 h-5 rounded-full transition-colors duration-200 flex items-center px-0.5 border ${
                    autoCycleEnabled
                      ? 'bg-emerald-400/90 border-emerald-300/60'
                      : 'bg-white/15 border-white/20'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      autoCycleEnabled ? 'translate-x-3.5' : 'translate-x-0'
                    }`}
                  />
                </span>
              </span>
            </label>

            {/* Time of Day */}
            <div className="py-3 space-y-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-white/75">Time ({timeMeta.label})</span>
                <span className="font-mono tabular-nums font-semibold text-amber-300">
                  {clockLabel}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {TIME_PHASE_ITEMS.map((item) => {
                  const isActive = lightingPreset === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      data-weather-time-btn={item.key}
                      onClick={() => {
                        soundEngine.playUiClick();
                        onSelectTimePhase(item.key);
                      }}
                      className={`py-2 px-1 rounded-[14px] border text-[10.5px] flex flex-col items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 ${
                        isActive
                          ? 'bg-gradient-to-br from-amber-300 to-orange-500 text-slate-950 border-amber-200/70 font-bold shadow-[0_6px_16px_rgba(245,158,11,0.35)]'
                          : 'bg-white/[0.09] hover:bg-white/[0.16] text-white/85 border-white/12 font-medium'
                      }`}
                    >
                      <span aria-hidden="true" className="text-[13px] leading-none">
                        {item.icon}
                      </span>
                      <span className="leading-none">{item.label}</span>
                    </button>
                  );
                })}
              </div>
              <input
                type="range"
                min={0}
                max={24}
                step={0.25}
                aria-label="World Clock (24h)"
                data-weather-hour-slider="true"
                value={Number(timeOfDayHours.toFixed(2))}
                onChange={(e) => onChangeTimeOfDayHours(Number(e.currentTarget.value))}
                className="w-full h-1.5 accent-amber-400 bg-white/18 rounded-full cursor-pointer"
              />
            </div>

            {/* Weather + City Lights */}
            <div className="py-3 space-y-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-white/75">Weather</span>
                <span className="font-semibold text-sky-300">{weatherMeta.label}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {WEATHER_ITEMS.map((item) => {
                  const isActive = weatherCondition === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      data-weather-cond-btn={item.key}
                      onClick={() => {
                        soundEngine.playUiClick();
                        onSelectWeatherCondition(item.key);
                      }}
                      className={`py-2 px-1 rounded-[14px] border text-[10.5px] flex flex-col items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 ${
                        isActive
                          ? 'bg-gradient-to-br from-sky-400 to-blue-600 text-white border-sky-300/60 font-bold shadow-[0_6px_16px_rgba(56,189,248,0.35)]'
                          : 'bg-white/[0.09] hover:bg-white/[0.16] text-white/85 border-white/12 font-medium'
                      }`}
                    >
                      <span aria-hidden="true" className="text-[13px] leading-none">
                        {item.icon}
                      </span>
                      <span className="leading-none">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {weatherCondition === 'hujan' && (
                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  <button
                    type="button"
                    data-weather-rain-tier="ringan"
                    onClick={() => {
                      soundEngine.playUiClick();
                      onSelectRainIntensityTier('ringan');
                    }}
                    className={`px-2 py-1.5 rounded-xl border text-[10.5px] cursor-pointer transition-all ${
                      rainIntensityTier === 'ringan'
                        ? 'bg-sky-400 text-slate-950 border-sky-300/70 font-bold shadow-sm'
                        : 'bg-white/[0.08] hover:bg-white/[0.15] text-white/85 border-white/12 font-medium'
                    }`}
                  >
                    🌦️ Light Rain
                  </button>
                  <button
                    type="button"
                    data-weather-rain-tier="deras"
                    onClick={() => {
                      soundEngine.playUiClick();
                      onSelectRainIntensityTier('deras');
                    }}
                    className={`px-2 py-1.5 rounded-xl border text-[10.5px] cursor-pointer transition-all ${
                      rainIntensityTier === 'deras'
                        ? 'bg-sky-500 text-white border-sky-300/70 font-bold shadow-sm'
                        : 'bg-white/[0.08] hover:bg-white/[0.15] text-white/85 border-white/12 font-medium'
                    }`}
                  >
                    ⛈️ Heavy Rain
                  </button>
                </div>
              )}

              {/* City Lights (50% - 250%) */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <label
                    htmlFor={`hud-city-lights-${contextId}`}
                    className="flex items-center gap-1.5 font-medium text-white/85 whitespace-nowrap"
                  >
                    <Sun className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                    <span>City Lights</span>
                  </label>
                  <span
                    data-weather-city-lights-label="true"
                    className="font-mono tabular-nums font-semibold text-amber-300"
                  >
                    {cityLightsPct}%
                  </span>
                </div>
                <input
                  id={`hud-city-lights-${contextId}`}
                  type="range"
                  min={50}
                  max={250}
                  step={5}
                  aria-label="City Lights"
                  data-weather-city-lights-slider="true"
                  value={cityLightsPct}
                  onChange={(e) => onChangeCityLightsScale(Number(e.currentTarget.value) / 100)}
                  className="w-full h-1.5 accent-amber-400 bg-white/18 rounded-full cursor-pointer"
                />
              </div>
            </div>

            {/* Audio Volume (Music + Sound FX) */}
            {audioControls && (
              <div className="pt-3 space-y-2.5">
                <div className="text-[11px] font-semibold text-white/75 tracking-tight">
                  Audio Volume
                </div>

                {/* Channel 1: Music Volume */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    data-mixer-music-mute-btn="true"
                    onClick={audioControls.onToggleMusicMute}
                    aria-label={
                      audioControls.isMusicMuted ? 'Unmute Music Channel' : 'Mute Music Channel'
                    }
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-white/12 hover:bg-white/20 border border-white/15 cursor-pointer shrink-0 transition-colors active:scale-95"
                  >
                    <span className="relative flex items-center justify-center">
                      <Music
                        className={`w-3.5 h-3.5 ${
                          effectiveMusicPct === 0 ? 'text-white/45' : 'text-emerald-300'
                        }`}
                      />
                      {effectiveMusicPct === 0 && (
                        <span className="absolute w-4 h-[1.5px] bg-rose-400 rotate-[-45deg]" />
                      )}
                    </span>
                  </button>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor={`hud-music-vol-${contextId}`}
                        className="text-[11.5px] font-medium text-white/90 whitespace-nowrap"
                      >
                        Music
                      </label>
                      <span
                        data-hud-music-pct-label="true"
                        className="text-[10.5px] font-mono tabular-nums font-semibold text-emerald-300 whitespace-nowrap"
                      >
                        {effectiveMusicPct}%
                      </span>
                    </div>
                    <input
                      id={`hud-music-vol-${contextId}`}
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      aria-label="Music Volume"
                      data-hud-music-slider="true"
                      value={effectiveMusicPct}
                      onChange={(e) =>
                        audioControls.onChangeMusicVolumePct(Number(e.currentTarget.value))
                      }
                      className="w-full h-1.5 accent-emerald-400 bg-white/18 rounded-full cursor-pointer"
                    />
                  </div>
                </div>

                {/* Channel 2: Sound FX Volume */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    data-mixer-sfx-mute-btn="true"
                    onClick={audioControls.onToggleSfxMute}
                    aria-label={
                      audioControls.isSfxMuted
                        ? 'Unmute Sound FX Channel'
                        : 'Mute Sound FX Channel'
                    }
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-white/12 hover:bg-white/20 border border-white/15 cursor-pointer shrink-0 transition-colors active:scale-95"
                  >
                    <SfxIcon
                      className={`w-3.5 h-3.5 ${
                        effectiveSfxPct === 0 ? 'text-white/45' : 'text-sky-300'
                      }`}
                    />
                  </button>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor={`hud-sfx-vol-${contextId}`}
                        className="text-[11.5px] font-medium text-white/90 whitespace-nowrap"
                      >
                        Sound FX
                      </label>
                      <span
                        data-hud-sfx-pct-label="true"
                        className="text-[10.5px] font-mono tabular-nums font-semibold text-sky-300 whitespace-nowrap"
                      >
                        {effectiveSfxPct}%
                      </span>
                    </div>
                    <input
                      id={`hud-sfx-vol-${contextId}`}
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      aria-label="Sound FX Volume"
                      data-hud-sfx-slider="true"
                      value={effectiveSfxPct}
                      onChange={(e) =>
                        audioControls.onChangeSfxVolumePct(Number(e.currentTarget.value))
                      }
                      className="w-full h-1.5 accent-sky-400 bg-white/18 rounded-full cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compact Frosted Glass Time, Weather & Sound Pill */}
      <button
        type="button"
        data-hud-weather-pill="true"
        data-hud-sound-toggle={audioControls ? 'true' : undefined}
        aria-expanded={isOpen}
        onClick={(e) => {
          e.currentTarget.blur();
          if (isOpen) {
            setIsOpen(false);
          } else {
            openPopover();
          }
        }}
        title={
          audioControls
            ? `Weather, Time & Audio: ${timeMeta.label} (${clockLabel}) · ${weatherMeta.label} · Sound ${effectiveSfxPct}%`
            : `Weather & Time: ${timeMeta.label} (${clockLabel}) · ${weatherMeta.label} (Press [L] to cycle phase)`
        }
        className={`${compactPill ? 'h-8 px-2.5 gap-1.5' : 'h-9 px-3 gap-2'} rounded-full flex items-center border shadow-[0_6px_20px_rgba(0,0,0,0.35)] cursor-pointer active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70 ${
          isOpen
            ? 'bg-[#1c2436]/92 border-white/35 text-white'
            : 'bg-[#111622]/84 hover:bg-[#192133]/92 border-white/18 hover:border-white/30 text-white'
        }`}
      >
        <span className={`flex items-center ${compactPill ? 'gap-1 text-[11px]' : 'gap-1.5 text-[11.5px]'} font-medium whitespace-nowrap`}>
          <span className="font-mono tabular-nums font-semibold text-white/95">
            {clockLabel}
          </span>
          <span className="text-white/25">·</span>
          <span aria-hidden="true" className="text-xs leading-none">{timeMeta.icon}</span>
          {!compactPill && <span className="text-white/80 hidden sm:inline">{timeMeta.label}</span>}
          {!compactPill && <span className="text-white/25 hidden sm:inline">·</span>}
          {(!compactPill || weatherMeta.icon !== timeMeta.icon) && (
            <span aria-hidden="true" className="text-xs leading-none">{weatherMeta.icon}</span>
          )}
          {!compactPill && <span className="text-sky-200/95">{weatherMeta.label}</span>}
          {autoCycleEnabled && (
            <span
              aria-hidden="true"
              className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
            />
          )}
          {audioControls && (
            <>
              <span className="w-px h-3.5 bg-white/20 mx-0.5" aria-hidden="true" />
              <SfxIcon
                className={`w-3.5 h-3.5 stroke-[2] ${
                  effectiveSfxPct === 0 ? 'text-white/45' : 'text-white/90'
                }`}
                aria-hidden="true"
              />
            </>
          )}
        </span>
      </button>
    </div>
  );
}
