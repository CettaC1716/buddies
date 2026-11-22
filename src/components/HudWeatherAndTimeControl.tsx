import { useEffect, useRef, useState } from 'react';
import {
  CITY_LIGHTS_SCALE_BOUNDS,
  TIME_PHASE_LABELS,
  WEATHER_PRESETS,
  type LightingPresetKey,
  type RainIntensityTier,
  type WeatherConditionKey,
} from '../game/buddiesBlitzRules';
import { formatClock24h } from '../game/buddiesWeatherSystem';

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
          aria-label="City Weather & Time"
          data-hud-weather-popover="true"
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className={`absolute ${popoverAlign === 'left' ? 'left-0' : 'right-0'} ${
            popoverPlacement === 'bottom' ? 'top-full mt-2.5' : 'bottom-full mb-2.5'
          } z-50 w-[286px] rounded-2xl bg-[#0d1118]/86 backdrop-blur-xl text-white border border-white/15 shadow-[0_18px_46px_rgba(0,0,0,0.58)] p-3.5 space-y-3`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold tracking-tight text-white whitespace-nowrap">
                Weather &amp; Time
              </span>
              <span
                data-weather-clock-label="true"
                className="px-2 py-0.5 rounded-full bg-white/[0.08] border border-white/12 text-[10px] font-mono tabular-nums font-semibold text-amber-200"
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
                className="px-2 py-0.5 rounded-full bg-white/[0.08] hover:bg-white/[0.18] text-[10px] font-medium text-amber-200 border border-white/10 cursor-pointer transition-colors"
              >
                ↻ Phase
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close Weather & Time Menu"
                className="px-2 py-0.5 rounded-full bg-white/[0.08] hover:bg-white/[0.18] text-[10px] font-medium text-white/85 border border-white/10 cursor-pointer transition-colors"
              >
                Done
              </button>
            </div>
          </div>

          {/* Auto Cycle Toggle */}
          <label className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 cursor-pointer">
            <span className="flex items-center gap-2 text-[11px] font-medium text-white/90">
              <input
                type="checkbox"
                data-weather-autocycle-checkbox="true"
                checked={autoCycleEnabled}
                onChange={(e) => onToggleAutoCycle(e.currentTarget.checked)}
                className="w-3.5 h-3.5 accent-emerald-300 cursor-pointer"
              />
              <span>Auto Cycle (24h)</span>
            </span>
            <span
              className={`text-[9.5px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
                autoCycleEnabled
                  ? 'bg-emerald-400/20 text-emerald-200 border-emerald-300/45'
                  : 'bg-white/[0.05] text-white/45 border-white/10'
              }`}
            >
              {autoCycleEnabled ? 'ON' : 'OFF'}
            </span>
          </label>

          {/* Time-of-Day Phase Buttons */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10.5px] font-medium text-white/70">
              <span>Time ({timeMeta.label})</span>
              <span className="font-mono tabular-nums text-amber-200">{clockLabel}</span>
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
                    className={`px-1 py-1.5 rounded-xl border text-[10px] font-medium flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      isActive
                        ? 'bg-amber-300/90 text-slate-950 border-amber-200 font-semibold shadow-sm'
                        : 'bg-white/[0.06] hover:bg-white/[0.14] text-white/85 border-white/10'
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
              className="w-full h-1.5 accent-amber-300 bg-white/15 rounded-full cursor-pointer"
            />
          </div>

          {/* Weather Buttons */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10.5px] font-medium text-white/70">
              <span>Weather</span>
              <span className="text-sky-300 font-semibold">{weatherMeta.label}</span>
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
                    className={`px-1 py-1.5 rounded-xl border text-[10px] font-medium flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      isActive
                        ? 'bg-sky-400/90 text-slate-950 border-sky-200 font-semibold shadow-sm'
                        : 'bg-white/[0.06] hover:bg-white/[0.14] text-white/85 border-white/10'
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
                  className={`px-2 py-1 rounded-xl border text-[10px] font-medium cursor-pointer transition-colors ${
                    rainIntensityTier === 'ringan'
                      ? 'bg-sky-300/90 text-slate-950 border-sky-200 font-semibold'
                      : 'bg-white/[0.06] hover:bg-white/[0.14] text-white/85 border-white/10'
                  }`}
                >
                  🌦️ Light Rain
                </button>
                <button
                  type="button"
                  data-weather-rain-tier="deras"
                  onClick={() => onSelectRainIntensityTier('deras')}
                  className={`px-2 py-1 rounded-xl border text-[10px] font-medium cursor-pointer transition-colors ${
                    rainIntensityTier === 'deras'
                      ? 'bg-sky-400/90 text-slate-950 border-sky-200 font-semibold'
                      : 'bg-white/[0.06] hover:bg-white/[0.14] text-white/85 border-white/10'
                  }`}
                >
                  ⛈️ Heavy Rain
                </button>
              </div>
            )}
          </div>

          {/* City Lights (50% - 250%) */}
          <div className="space-y-1.5 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between gap-2 text-[10.5px]">
              <label
                htmlFor={`hud-city-lights-${contextId}`}
                className="font-medium text-white/85 whitespace-nowrap"
              >
                💡 City Lights
              </label>
              <span
                data-weather-city-lights-label="true"
                className="font-mono tabular-nums font-semibold text-amber-200"
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
              className="w-full h-1.5 accent-amber-300 bg-white/15 rounded-full cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* inZOI-style Frosted Glass Time & Weather Pill */}
      <button
        type="button"
        data-hud-weather-pill="true"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.currentTarget.blur();
          if (isOpen) {
            setIsOpen(false);
          } else {
            openPopover();
          }
        }}
        title={`Weather & Time: ${timeMeta.label} (${clockLabel}) · ${weatherMeta.label} (Press [L] to cycle phase)`}
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
        </span>
      </button>
    </div>
  );
}
