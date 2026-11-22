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
          className={`absolute right-0 ${
            popoverPlacement === 'bottom' ? 'top-full mt-2.5' : 'bottom-full mb-2.5'
          } z-50 w-[282px] bg-[#14161d] text-white border-3 border-black ring-2 ring-white shadow-[5px_5px_0_#000] p-3 space-y-2.5`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/15 pb-1.5 gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] font-black tracking-wide text-white whitespace-nowrap">
                Weather &amp; Time
              </span>
              <span
                data-weather-clock-label="true"
                className="px-1.5 py-0.5 bg-[#1f2430] border border-white/20 text-[10px] font-mono tabular-nums font-black text-[#b8ff3c]"
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
                className="px-1.5 py-0.5 bg-[#272c3a] hover:bg-[#353c4f] text-[10px] font-black text-[#fde047] border border-white/20 cursor-pointer"
              >
                ↻ Phase
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close Weather & Time Menu"
                className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 text-[10px] font-black text-slate-200 border border-white/20 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>

          {/* Auto Cycle Toggle */}
          <label className="flex items-center justify-between gap-2 px-2 py-1.5 bg-[#1f2430] border border-white/20 cursor-pointer">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-100">
              <input
                type="checkbox"
                data-weather-autocycle-checkbox="true"
                checked={autoCycleEnabled}
                onChange={(e) => onToggleAutoCycle(e.currentTarget.checked)}
                className="w-3.5 h-3.5 accent-[#b8ff3c] cursor-pointer"
              />
              <span>Auto Cycle (24h)</span>
            </span>
            <span
              className={`text-[9.5px] font-black uppercase px-1.5 py-0.5 border ${
                autoCycleEnabled
                  ? 'bg-[#1c2820] text-[#b8ff3c] border-[#b8ff3c]'
                  : 'bg-[#14161d] text-slate-400 border-white/15'
              }`}
            >
              {autoCycleEnabled ? 'ON' : 'OFF'}
            </span>
          </label>

          {/* Time-of-Day Phase Buttons */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
              <span>Time ({timeMeta.label})</span>
              <span className="font-mono tabular-nums text-[#fde047]">{clockLabel}</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {TIME_PHASE_ITEMS.map((item) => {
                const isActive = lightingPreset === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    data-weather-time-btn={item.key}
                    onClick={() => onSelectTimePhase(item.key)}
                    className={`px-1 py-1.5 border text-[10px] font-black flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[#b8ff3c] text-black border-black shadow-[2px_2px_0_#000]'
                        : 'bg-[#1f2430] hover:bg-[#2a3142] text-slate-100 border-white/20'
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
              className="w-full h-2 accent-[#fde047] bg-[#272c3a] rounded cursor-pointer"
            />
          </div>

          {/* Weather Buttons */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
              <span>Weather</span>
              <span className="text-[#38bdf8] font-black">{weatherMeta.label}</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {WEATHER_ITEMS.map((item) => {
                const isActive = weatherCondition === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    data-weather-cond-btn={item.key}
                    onClick={() => onSelectWeatherCondition(item.key)}
                    className={`px-1 py-1.5 border text-[10px] font-black flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[#38bdf8] text-black border-black shadow-[2px_2px_0_#000]'
                        : 'bg-[#1f2430] hover:bg-[#2a3142] text-slate-100 border-white/20'
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
              <div className="grid grid-cols-2 gap-1 pt-0.5">
                <button
                  type="button"
                  data-weather-rain-tier="ringan"
                  onClick={() => onSelectRainIntensityTier('ringan')}
                  className={`px-2 py-1 border text-[10px] font-black cursor-pointer ${
                    rainIntensityTier === 'ringan'
                      ? 'bg-[#7dd3fc] text-black border-black'
                      : 'bg-[#1f2430] hover:bg-[#2a3142] text-slate-200 border-white/20'
                  }`}
                >
                  🌦️ Light Rain
                </button>
                <button
                  type="button"
                  data-weather-rain-tier="deras"
                  onClick={() => onSelectRainIntensityTier('deras')}
                  className={`px-2 py-1 border text-[10px] font-black cursor-pointer ${
                    rainIntensityTier === 'deras'
                      ? 'bg-[#38bdf8] text-black border-black'
                      : 'bg-[#1f2430] hover:bg-[#2a3142] text-slate-200 border-white/20'
                  }`}
                >
                  ⛈️ Heavy Rain
                </button>
              </div>
            )}
          </div>

          {/* City Lights (50% - 250%) */}
          <div className="space-y-1 pt-0.5 border-t border-white/15">
            <div className="flex items-center justify-between gap-2 text-[10.5px]">
              <label
                htmlFor={`hud-city-lights-${contextId}`}
                className="font-bold text-slate-100 whitespace-nowrap"
              >
                💡 City Lights
              </label>
              <span
                data-weather-city-lights-label="true"
                className="font-mono tabular-nums font-black text-[#fde047]"
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
              className="w-full h-2 accent-[#fde047] bg-[#272c3a] rounded cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Compact HUD Pill Button */}
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
        className="-skew-x-6 h-10 px-2.5 flex items-center gap-1.5 bg-[#14161d] hover:bg-[#1f2430] text-white border-3 border-black ring-2 ring-white shadow-[3px_3px_0_#000] cursor-pointer active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff3c]"
      >
        <span className="skew-x-6 flex items-center gap-1.5 text-[11px] font-black whitespace-nowrap">
          <span aria-hidden="true">{timeMeta.icon}</span>
          <span>{timeMeta.label}</span>
          <span className="hidden md:inline font-mono tabular-nums text-[10px] text-[#fde047]">
            {clockLabel}
          </span>
          <span className="text-white/40">·</span>
          <span aria-hidden="true">{weatherMeta.icon}</span>
          <span className="text-[#7dd3fc]">{weatherMeta.label}</span>
          {autoCycleEnabled && (
            <span
              aria-hidden="true"
              className="w-1.5 h-1.5 rounded-full bg-[#b8ff3c] animate-pulse"
            />
          )}
        </span>
      </button>
    </div>
  );
}
