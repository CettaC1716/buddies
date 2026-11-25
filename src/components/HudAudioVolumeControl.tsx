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
  hideMusicButton?: boolean;
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
  hideMusicButton = true,
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

  const openMixerPopover = () => {
    setIsMixerOpen(true);
    window.dispatchEvent(
      new CustomEvent('hud-corner-popover-open', { detail: 'audio' }),
    );
  };

  useEffect(() => {
    const onOtherPopoverOpen = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail && detail !== 'audio') {
        clearHoverTimer();
        setIsMixerOpen(false);
      }
    };
    window.addEventListener('hud-corner-popover-open', onOtherPopoverOpen);
    return () => {
      window.removeEventListener('hud-corner-popover-open', onOtherPopoverOpen);
    };
  }, []);

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
    window.dispatchEvent(
      new CustomEvent('hud-corner-popover-state', {
        detail: { id: `audio-${contextId}`, isOpen: isMixerOpen },
      }),
    );
  }, [contextId, isMixerOpen]);

  useEffect(() => {
    return () => {
      if (closeHoverTimerRef.current !== null) {
        window.clearTimeout(closeHoverTimerRef.current);
      }
      window.dispatchEvent(
        new CustomEvent('hud-corner-popover-state', {
          detail: { id: `audio-${contextId}`, isOpen: false },
        }),
      );
    };
  }, [contextId]);

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
          openMixerPopover();
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
          } z-50 w-[238px] rounded-2xl bg-gradient-to-b from-[#171d2c]/86 via-[#111622]/84 to-[#0c101a]/88 text-white border border-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_24px_70px_rgba(0,0,0,0.58)] p-3.5 space-y-3`}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-semibold tracking-tight text-white whitespace-nowrap">
              Audio Volume
            </span>
            <button
              type="button"
              onClick={() => setIsMixerOpen(false)}
              aria-label="Close Audio Volume Mixer"
              className="px-2 py-0.5 rounded-full bg-white/[0.08] hover:bg-white/[0.18] text-[10px] font-medium text-white/85 border border-white/10 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
            >
              Done
            </button>
          </div>

          {/* Channel 1: Music Volume (0% - 100%) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  data-mixer-music-mute-btn="true"
                  onClick={onToggleMusicMute}
                  aria-label={isMusicMuted ? 'Unmute Music Channel' : 'Mute Music Channel'}
                  className="w-6 h-6 rounded-full flex items-center justify-center bg-white/[0.08] hover:bg-white/[0.16] border border-white/12 cursor-pointer shrink-0 transition-colors"
                >
                  <span className="relative flex items-center justify-center">
                    <Music
                      className={`w-3.5 h-3.5 ${
                        effectiveMusicPct === 0 ? 'text-white/40' : 'text-emerald-300'
                      }`}
                    />
                    {effectiveMusicPct === 0 && (
                      <span className="absolute w-4 h-[1.5px] bg-rose-400 rotate-[-45deg]" />
                    )}
                  </span>
                </button>
                <label
                  htmlFor={`hud-music-vol-${contextId}`}
                  className="text-xs font-medium text-white/90 whitespace-nowrap"
                >
                  Music
                </label>
              </div>
              <span
                data-hud-music-pct-label="true"
                className="text-[11px] font-mono tabular-nums font-semibold text-emerald-300 whitespace-nowrap"
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
              className="w-full h-1.5 accent-emerald-300 bg-white/15 rounded-full cursor-pointer"
            />
          </div>

          {/* Channel 2: Sound FX Volume (0% - 100%) */}
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  data-mixer-sfx-mute-btn="true"
                  onClick={onToggleSfxMute}
                  aria-label={isSfxMuted ? 'Unmute Sound FX Channel' : 'Mute Sound FX Channel'}
                  className="w-6 h-6 rounded-full flex items-center justify-center bg-white/[0.08] hover:bg-white/[0.16] border border-white/12 cursor-pointer shrink-0 transition-colors"
                >
                  <SfxIcon
                    className={`w-3.5 h-3.5 ${
                      effectiveSfxPct === 0 ? 'text-white/40' : 'text-sky-300'
                    }`}
                  />
                </button>
                <label
                  htmlFor={`hud-sfx-vol-${contextId}`}
                  className="text-xs font-medium text-white/90 whitespace-nowrap"
                >
                  Sound FX
                </label>
              </div>
              <span
                data-hud-sfx-pct-label="true"
                className="text-[11px] font-mono tabular-nums font-semibold text-sky-300 whitespace-nowrap"
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
              className="w-full h-1.5 accent-sky-300 bg-white/15 rounded-full cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Frosted Glass Music Button */}
      {!hideMusicButton && (
        <button
          type="button"
          data-hud-music-toggle="true"
          aria-expanded={isMixerOpen}
          onClick={(e) => {
            e.currentTarget.blur();
            if (!isMixerOpen) {
              openMixerPopover();
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
          className="relative w-9 h-9 rounded-full flex items-center justify-center bg-[#111622]/86 hover:bg-[#192133]/92 text-white border border-white/22 hover:border-white/35 shadow-[0_6px_20px_rgba(0,0,0,0.35)] cursor-pointer active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70"
        >
          <span className="relative flex items-center justify-center">
            <Music
              className={`w-4 h-4 stroke-[1.75] ${
                effectiveMusicPct === 0 ? 'text-white/45' : 'text-white/92'
              }`}
            />
            {effectiveMusicPct === 0 && (
              <span className="absolute w-4 h-[1.5px] bg-rose-400 rotate-[-45deg] rounded" />
            )}
          </span>
        </button>
      )}

      {/* Frosted Glass Sound FX Button */}
      <button
        type="button"
        data-hud-sound-toggle="true"
        aria-expanded={isMixerOpen}
        onClick={(e) => {
          e.currentTarget.blur();
          if (!isMixerOpen) {
            openMixerPopover();
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
        className={`relative w-9 h-9 rounded-full flex items-center justify-center border shadow-[0_6px_20px_rgba(0,0,0,0.35)] cursor-pointer active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70 ${
          isMixerOpen
            ? 'bg-[#1c2436]/92 border-white/35 text-white'
            : 'bg-[#111622]/86 hover:bg-[#192133]/92 border-white/22 hover:border-white/35 text-white'
        }`}
      >
        <SfxIcon
          className={`w-4 h-4 stroke-[1.75] ${
            effectiveSfxPct === 0 ? 'text-white/45' : 'text-white/92'
          }`}
        />
        {effectiveSfxPct > 0 && (
          <span
            aria-hidden="true"
            className="absolute bottom-1 w-3 h-[2px] rounded-full bg-white/15 overflow-hidden"
          >
            <span
              className="block h-full bg-sky-300"
              style={{ width: `${effectiveSfxPct}%` }}
            />
          </span>
        )}
      </button>
    </div>
  );
}
