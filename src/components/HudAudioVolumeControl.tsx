import { useEffect, useRef, useState } from 'react';
import { Music, Volume1, Volume2, VolumeX } from 'lucide-react';
import { clampAudioVolumePct } from '../game/buddiesRealEstateKioskRules';

export interface HudAudioVolumeControlProps {
  contextId: 'landing' | 'city' | 'warzone';
  popoverPlacement?: 'top' | 'bottom';
  isMusicMuted: boolean;
  isSfxMuted: boolean;
  musicVolumePct: number;
  sfxVolumePct: number;
  onToggleMusicMute: () => void;
  onToggleSfxMute: () => void;
  onChangeMusicVolumePct: (nextPct: number) => void;
  onChangeSfxVolumePct: (nextPct: number) => void;
}

/**
 * Neo-Brutalist HUD Music & Sound FX Control Cluster with Interactive Volume Mixer Popover.
 * - Zero `backdrop-filter` / `backdrop-blur` over WebGL so software rendering stays instant.
 * - Supports click-to-open mixer, hover-to-open on desktop pointers, direct mute/unmute buttons,
 *   independent `0%–100%` range sliders (`Music` & `Sound FX`), mouse-wheel `±5%` step on buttons,
 *   and `Escape` / outside-click dismissal.
 */
export function HudAudioVolumeControl({
  contextId,
  popoverPlacement = 'top',
  isMusicMuted,
  isSfxMuted,
  musicVolumePct,
  sfxVolumePct,
  onToggleMusicMute,
  onToggleSfxMute,
  onChangeMusicVolumePct,
  onChangeSfxVolumePct,
}: HudAudioVolumeControlProps) {
  const [isMixerOpen, setIsMixerOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeHoverTimerRef = useRef<number | null>(null);

  const effectiveMusicPct = isMusicMuted ? 0 : clampAudioVolumePct(musicVolumePct);
  const effectiveSfxPct = isSfxMuted ? 0 : clampAudioVolumePct(sfxVolumePct);

  const clearHoverTimer = () => {
    if (closeHoverTimerRef.current !== null) {
      window.clearTimeout(closeHoverTimerRef.current);
      closeHoverTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!isMixerOpen) return;
    const onPointerDownOutside = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsMixerOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMixerOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDownOutside, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDownOutside, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isMixerOpen]);

  useEffect(() => {
    return () => {
      if (closeHoverTimerRef.current !== null) {
        window.clearTimeout(closeHoverTimerRef.current);
      }
    };
  }, []);

  const SfxIcon =
    isSfxMuted || effectiveSfxPct === 0
      ? VolumeX
      : effectiveSfxPct < 50
        ? Volume1
        : Volume2;

  return (
    <div
      ref={rootRef}
      data-hud-audio-controls={contextId}
      data-mixer-open={isMixerOpen ? 'true' : 'false'}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') {
          clearHoverTimer();
          setIsMixerOpen(true);
        }
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') {
          clearHoverTimer();
          closeHoverTimerRef.current = window.setTimeout(() => {
            setIsMixerOpen(false);
          }, 220);
        }
      }}
      className="relative flex items-center gap-2.5 select-none pointer-events-auto"
    >
      {/* Interactive Volume Mixer Popover (`0% - 100%` independent Music & Sound FX sliders) */}
      {isMixerOpen && (
        <div
          role="region"
          aria-label="Audio Volume Mixer"
          data-hud-audio-mixer="true"
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className={`absolute right-0 ${
            popoverPlacement === 'bottom' ? 'top-full mt-2.5' : 'bottom-full mb-2.5'
          } z-50 w-[236px] bg-[#14161d] text-white border-3 border-black ring-2 ring-white shadow-[5px_5px_0_#000] p-3 space-y-2.5`}
        >
          <div className="flex items-center justify-between border-b border-white/15 pb-1.5">
            <span className="text-[11px] font-black tracking-wide text-white whitespace-nowrap">
              Audio Volume
            </span>
            <button
              type="button"
              onClick={() => setIsMixerOpen(false)}
              aria-label="Close Audio Volume Mixer"
              className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 text-[10px] font-black text-slate-200 border border-white/20 cursor-pointer whitespace-nowrap shrink-0"
            >
              Done
            </button>
          </div>

          {/* Channel 1: Music Volume (0% - 100%) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <button
                  type="button"
                  data-mixer-music-mute-btn="true"
                  onClick={onToggleMusicMute}
                  aria-label={isMusicMuted ? 'Unmute Music Channel' : 'Mute Music Channel'}
                  className="w-6 h-6 flex items-center justify-center bg-[#1f2430] hover:bg-[#2b3242] border border-white/25 cursor-pointer shrink-0"
                >
                  <span className="relative flex items-center justify-center">
                    <Music
                      className={`w-3.5 h-3.5 ${
                        effectiveMusicPct === 0 ? 'text-slate-400' : 'text-[#b8ff3c]'
                      }`}
                    />
                    {effectiveMusicPct === 0 && (
                      <span className="absolute w-4 h-[2px] bg-red-400 rotate-[-45deg]" />
                    )}
                  </span>
                </button>
                <label
                  htmlFor={`hud-music-vol-${contextId}`}
                  className="text-xs font-bold text-slate-100 whitespace-nowrap"
                >
                  Music
                </label>
              </div>
              <span
                data-hud-music-pct-label="true"
                className="text-xs font-mono tabular-nums font-black text-[#b8ff3c] whitespace-nowrap"
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
              onChange={(e) => onChangeMusicVolumePct(Number(e.currentTarget.value))}
              className="w-full h-2 accent-[#b8ff3c] bg-[#272c3a] rounded cursor-pointer"
            />
          </div>

          {/* Channel 2: Sound FX Volume (0% - 100%) */}
          <div className="space-y-1 pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <button
                  type="button"
                  data-mixer-sfx-mute-btn="true"
                  onClick={onToggleSfxMute}
                  aria-label={isSfxMuted ? 'Unmute Sound FX Channel' : 'Mute Sound FX Channel'}
                  className="w-6 h-6 flex items-center justify-center bg-[#1f2430] hover:bg-[#2b3242] border border-white/25 cursor-pointer shrink-0"
                >
                  <SfxIcon
                    className={`w-3.5 h-3.5 ${
                      effectiveSfxPct === 0 ? 'text-slate-400' : 'text-[#38bdf8]'
                    }`}
                  />
                </button>
                <label
                  htmlFor={`hud-sfx-vol-${contextId}`}
                  className="text-xs font-bold text-slate-100 whitespace-nowrap"
                >
                  Sound FX
                </label>
              </div>
              <span
                data-hud-sfx-pct-label="true"
                className="text-xs font-mono tabular-nums font-black text-[#38bdf8] whitespace-nowrap"
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
              onChange={(e) => onChangeSfxVolumePct(Number(e.currentTarget.value))}
              className="w-full h-2 accent-[#38bdf8] bg-[#272c3a] rounded cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Compact Neo-Brutalist Music Button `[🎵]` */}
      <button
        type="button"
        data-hud-music-toggle="true"
        aria-expanded={isMixerOpen}
        onClick={(e) => {
          e.currentTarget.blur();
          if (!isMixerOpen) {
            setIsMixerOpen(true);
            return;
          }
          onToggleMusicMute();
        }}
        onWheel={(e) => {
          e.preventDefault();
          const step = e.deltaY < 0 ? 5 : -5;
          onChangeMusicVolumePct(clampAudioVolumePct(effectiveMusicPct + step));
        }}
        aria-label={
          isMixerOpen
            ? isMusicMuted
              ? 'Unmute Music'
              : 'Mute Music'
            : `Adjust Music Volume (${effectiveMusicPct}%)`
        }
        title={`Music: ${effectiveMusicPct}% (Click to adjust / mute)`}
        className="-skew-x-6 relative w-10 h-10 flex items-center justify-center bg-[#14161d] hover:bg-[#1f2430] text-white border-3 border-black ring-2 ring-white shadow-[3px_3px_0_#000] cursor-pointer active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff3c]"
      >
        <span className="skew-x-6 relative flex items-center justify-center">
          <Music
            className={`w-4 h-4 ${
              effectiveMusicPct === 0 ? 'text-slate-300' : 'text-[#b8ff3c]'
            }`}
          />
          {effectiveMusicPct === 0 && (
            <span className="absolute w-5 h-[2px] bg-red-400 rotate-[-45deg] rounded" />
          )}
        </span>
        {/* Bottom miniature level bar inside button */}
        <span
          aria-hidden="true"
          className="absolute bottom-[2px] left-1 right-1 h-[2.5px] bg-white/15 overflow-hidden"
        >
          <span
            className="block h-full bg-[#b8ff3c]"
            style={{ width: `${effectiveMusicPct}%` }}
          />
        </span>
      </button>

      {/* Compact Neo-Brutalist Sound FX Button `[🔊]` */}
      <button
        type="button"
        data-hud-sound-toggle="true"
        aria-expanded={isMixerOpen}
        onClick={(e) => {
          e.currentTarget.blur();
          if (!isMixerOpen) {
            setIsMixerOpen(true);
            return;
          }
          onToggleSfxMute();
        }}
        onWheel={(e) => {
          e.preventDefault();
          const step = e.deltaY < 0 ? 5 : -5;
          onChangeSfxVolumePct(clampAudioVolumePct(effectiveSfxPct + step));
        }}
        aria-label={
          isMixerOpen
            ? isSfxMuted
              ? 'Unmute Sound'
              : 'Mute Sound'
            : `Adjust Sound FX Volume (${effectiveSfxPct}%)`
        }
        title={`Sound FX: ${effectiveSfxPct}% (Click to adjust / mute · M)`}
        className="-skew-x-6 relative w-10 h-10 flex items-center justify-center bg-[#14161d] hover:bg-[#1f2430] text-white border-3 border-black ring-2 ring-white shadow-[3px_3px_0_#000] cursor-pointer active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff3c]"
      >
        <span className="skew-x-6 flex items-center justify-center">
          <SfxIcon
            className={`w-4 h-4 ${
              effectiveSfxPct === 0 ? 'text-slate-300' : 'text-[#b8ff3c]'
            }`}
          />
        </span>
        {/* Bottom miniature level bar inside button */}
        <span
          aria-hidden="true"
          className="absolute bottom-[2px] left-1 right-1 h-[2.5px] bg-white/15 overflow-hidden"
        >
          <span
            className="block h-full bg-[#38bdf8]"
            style={{ width: `${effectiveSfxPct}%` }}
          />
        </span>
      </button>
    </div>
  );
}
