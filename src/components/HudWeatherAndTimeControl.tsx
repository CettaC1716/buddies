import { useEffect, useRef, useState } from 'react';
import { Music, Volume1, Volume2, VolumeX } from 'lucide-react';
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
}

const TIME_PHASE_ITEMS: ReadonlyArray<{
  key: LightingPresetKey;
  icon: string;
  label: string;
}> = [
  { key: 'dawn', icon: '🌄', label: 'Dawn' },
  { key: 'day', icon: '☀️', label: 'Day' },
  { key: 'dusk', icon: '🌅', label: 'Dusk' },
  { key: 'night', icon: '🌙', label: 'Night' },
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

function getTimePhaseMeta(phase: LightingPresetKey): { icon: string; label: string } {
  return (
    TIME_PHASE_ITEMS.find((item) => item.key === phase) ?? {
      icon: '☀️',
      label: TIME_PHASE_LABELS[phase] ?? 'Day',
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
 * Compact Cerria-inspired Neo-Brutalist HUD pill + Environment/Weather popover
 * (`Siang`/`Senja`/`Malam`/`Fajar`, 24h slider, `Siklus Otomatis`, `Cerah`/`Berangin`/`Kabut`/`Hujan`,
 * and `Terang Kota / City Lights` 50%–250% slider).
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
          } z-50 w-[304px] max-h-[80vh] overflow-y-auto rounded-[28px] bg-[#141926]/68 backdrop-blur-2xl text-white border border-white/25 shadow-[0_24px_70px_rgba(0,0,0,0.52)] p-3.5 space-y-2.5`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-1 pb-1 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[12.5px] font-bold tracking-tight text-white whitespace-nowrap">
                {audioControls ? 'Environment & Audio' : 'Weather & Time'}
              </span>
              <span
                data-weather-clock-label="true"
                className="px-2 py-0.5 rounded-full bg-white/14 border border-white/25 text-[10px] font-mono tabular-nums font-bold text-amber-200 backdrop-blur-md"
              >
                {clockLabel}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                data-weather-quick-cycle-btn="true"
                onClick={() => onCycleTimePhase()}
                title="Cycle Time Phase [L]"
                className="px-2.5 py-1 rounded-full bg-white/14 hover:bg-white/24 text-[10px] font-bold text-amber-200 border border-white/25 cursor-pointer transition-colors backdrop-blur-md"
              >
                ↻ Phase
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close Weather & Time Menu"
                className="px-2.5 py-1 rounded-full bg-white/14 hover:bg-white/24 text-[10px] font-bold text-white/90 border border-white/25 cursor-pointer transition-colors backdrop-blur-md"
              >
                Done
              </button>
            </div>
          </div>

          {/* Auto Cycle Toggle (Frosted Gray Card) */}
          <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-[#eef0f4]/92 border border-white/80 shadow-[0_6px_16px_rgba(15,23,42,0.14)] text-slate-900 cursor-pointer">
            <span className="flex items-center gap-2 text-[11px] font-bold text-slate-800">
              <input
                type="checkbox"
                data-weather-autocycle-checkbox="true"
                checked={autoCycleEnabled}
                onChange={(e) => onToggleAutoCycle(e.currentTarget.checked)}
                className="w-3.5 h-3.5 accent-emerald-600 cursor-pointer"
              />
              <span>Auto Cycle (24h)</span>
            </span>
            <span
              className={`text-[9.5px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                autoCycleEnabled
                  ? 'bg-emerald-500/15 text-emerald-700 border-emerald-400/50'
                  : 'bg-[#dfe4ec]/90 text-slate-500 border-slate-300/70'
              }`}
            >
              {autoCycleEnabled ? 'ON' : 'OFF'}
            </span>
          </label>

          {/* Time-of-Day Phase Buttons (Frosted Gray Card) */}
          <div className="rounded-2xl bg-[#eef0f4]/92 border border-white/80 shadow-[0_6px_16px_rgba(15,23,42,0.14)] text-slate-900 p-2.5 space-y-2">
            <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-600">
              <span>Time ({timeMeta.label})</span>
              <span className="font-mono tabular-nums text-amber-700">{clockLabel}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {TIME_PHASE_ITEMS.map((item) => {
                const isActive = lightingPreset === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    data-weather-time-btn={item.key}
                    onClick={() => onSelectTimePhase(item.key)}
                    className={`px-1 py-1.5 rounded-xl border text-[10px] font-semibold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      isActive
                        ? 'bg-amber-400 text-slate-950 border-amber-500/60 font-bold shadow-sm'
                        : 'bg-[#dfe4ec]/85 hover:bg-white text-slate-700 border-slate-300/60'
                    }`}
                  >
                    <span aria-hidden="true" className="text-xs leading-none">
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
              className="w-full h-1.5 accent-amber-500 bg-slate-300/80 rounded-full cursor-pointer"
            />
          </div>

          {/* Weather Buttons + City Lights (Frosted Gray Card) */}
          <div className="rounded-2xl bg-[#eef0f4]/92 border border-white/80 shadow-[0_6px_16px_rgba(15,23,42,0.14)] text-slate-900 p-2.5 space-y-2">
            <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-600">
              <span>Weather</span>
              <span className="text-sky-600 font-bold">{weatherMeta.label}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {WEATHER_ITEMS.map((item) => {
                const isActive = weatherCondition === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    data-weather-cond-btn={item.key}
                    onClick={() => onSelectWeatherCondition(item.key)}
                    className={`px-1 py-1.5 rounded-xl border text-[10px] font-semibold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      isActive
                        ? 'bg-sky-500 text-white border-sky-600/60 font-bold shadow-sm'
                        : 'bg-[#dfe4ec]/85 hover:bg-white text-slate-700 border-slate-300/60'
                    }`}
                  >
                    <span aria-hidden="true" className="text-xs leading-none">
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
                  onClick={() => onSelectRainIntensityTier('ringan')}
                  className={`px-2 py-1 rounded-xl border text-[10px] font-semibold cursor-pointer transition-colors ${
                    rainIntensityTier === 'ringan'
                      ? 'bg-sky-500 text-white border-sky-600/60 font-bold shadow-sm'
                      : 'bg-[#dfe4ec]/85 hover:bg-white text-slate-700 border-slate-300/60'
                  }`}
                >
                  🌦️ Light Rain
                </button>
                <button
                  type="button"
                  data-weather-rain-tier="deras"
                  onClick={() => onSelectRainIntensityTier('deras')}
                  className={`px-2 py-1 rounded-xl border text-[10px] font-semibold cursor-pointer transition-colors ${
                    rainIntensityTier === 'deras'
                      ? 'bg-sky-600 text-white border-sky-700/60 font-bold shadow-sm'
                      : 'bg-[#dfe4ec]/85 hover:bg-white text-slate-700 border-slate-300/60'
                  }`}
                >
                  ⛈️ Heavy Rain
                </button>
              </div>
            )}

            {/* City Lights (50% - 250%) */}
            <div className="space-y-1.5 pt-2 border-t border-slate-300/70">
              <div className="flex items-center justify-between gap-2 text-[10.5px]">
                <label
                  htmlFor={`hud-city-lights-${contextId}`}
                  className="font-bold text-slate-700 whitespace-nowrap"
                >
                  💡 City Lights
                </label>
                <span
                  data-weather-city-lights-label="true"
                  className="font-mono tabular-nums font-bold text-amber-700"
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
                className="w-full h-1.5 accent-amber-500 bg-slate-300/80 rounded-full cursor-pointer"
              />
            </div>
          </div>

          {/* Merged Audio Volume Section (Music + Sound FX) (Frosted Gray Card) */}
          {audioControls && (
            <div className="rounded-2xl bg-[#eef0f4]/92 border border-white/80 shadow-[0_6px_16px_rgba(15,23,42,0.14)] text-slate-900 p-2.5 space-y-2">
              <div className="text-[10.5px] font-bold text-slate-600 tracking-tight">
                Audio Volume
              </div>

              {/* Channel 1: Music Volume */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      data-mixer-music-mute-btn="true"
                      onClick={audioControls.onToggleMusicMute}
                      aria-label={
                        audioControls.isMusicMuted ? 'Unmute Music Channel' : 'Mute Music Channel'
                      }
                      className="w-6 h-6 rounded-full flex items-center justify-center bg-[#dfe4ec]/90 hover:bg-white border border-slate-300/70 cursor-pointer shrink-0 transition-colors"
                    >
                      <span className="relative flex items-center justify-center">
                        <Music
                          className={`w-3.5 h-3.5 ${
                            effectiveMusicPct === 0 ? 'text-slate-400' : 'text-emerald-600'
                          }`}
                        />
                        {effectiveMusicPct === 0 && (
                          <span className="absolute w-4 h-[1.5px] bg-rose-500 rotate-[-45deg]" />
                        )}
                      </span>
                    </button>
                    <label
                      htmlFor={`hud-music-vol-${contextId}`}
                      className="text-[11px] font-bold text-slate-800 whitespace-nowrap"
                    >
                      Music
                    </label>
                  </div>
                  <span
                    data-hud-music-pct-label="true"
                    className="text-[10.5px] font-mono tabular-nums font-bold text-emerald-700 whitespace-nowrap"
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
                  onChange={(e) => audioControls.onChangeMusicVolumePct(Number(e.currentTarget.value))}
                  className="w-full h-1.5 accent-emerald-600 bg-slate-300/80 rounded-full cursor-pointer"
                />
              </div>

              {/* Channel 2: Sound FX Volume */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      data-mixer-sfx-mute-btn="true"
                      onClick={audioControls.onToggleSfxMute}
                      aria-label={
                        audioControls.isSfxMuted
                          ? 'Unmute Sound FX Channel'
                          : 'Mute Sound FX Channel'
                      }
                      className="w-6 h-6 rounded-full flex items-center justify-center bg-[#dfe4ec]/90 hover:bg-white border border-slate-300/70 cursor-pointer shrink-0 transition-colors"
                    >
                      <SfxIcon
                        className={`w-3.5 h-3.5 ${
                          effectiveSfxPct === 0 ? 'text-slate-400' : 'text-sky-600'
                        }`}
                      />
                    </button>
                    <label
                      htmlFor={`hud-sfx-vol-${contextId}`}
                      className="text-[11px] font-bold text-slate-800 whitespace-nowrap"
                    >
                      Sound FX
                    </label>
                  </div>
                  <span
                    data-hud-sfx-pct-label="true"
                    className="text-[10.5px] font-mono tabular-nums font-bold text-sky-700 whitespace-nowrap"
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
                  onChange={(e) => audioControls.onChangeSfxVolumePct(Number(e.currentTarget.value))}
                  className="w-full h-1.5 accent-sky-600 bg-slate-300/80 rounded-full cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* inZOI-style Frosted Glass Time, Weather & Sound Pill */}
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
        className={`h-9 px-3 rounded-full flex items-center gap-2 backdrop-blur-xl border shadow-[0_6px_20px_rgba(0,0,0,0.35)] cursor-pointer active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70 ${
          isOpen
            ? 'bg-white/18 border-white/35 text-white'
            : 'bg-[#0d1118]/65 hover:bg-[#171d29]/82 border-white/15 hover:border-white/30 text-white'
        }`}
      >
        <span className="flex items-center gap-1.5 text-[11.5px] font-medium whitespace-nowrap">
          <span className="font-mono tabular-nums font-semibold text-white/95">
            {clockLabel}
          </span>
          <span className="text-white/25">·</span>
          <span aria-hidden="true" className="text-xs leading-none">{timeMeta.icon}</span>
          <span className="text-white/80 hidden sm:inline">{timeMeta.label}</span>
          <span className="text-white/25 hidden sm:inline">·</span>
          <span aria-hidden="true" className="text-xs leading-none">{weatherMeta.icon}</span>
          <span className="text-sky-200/95">{weatherMeta.label}</span>
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
