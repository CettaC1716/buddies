import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw, X } from 'lucide-react';
import { FISH_SPECIES_CATALOG, computeLengthCmFromWeightKg } from '../game/buddiesFishingMarket';
import { soundEngine } from '../game/audio';
import {
  buildShorelineProceduralFishGroup,
  renderFishGroupTo2dCanvas,
} from './ShorelineCatchShowcaseModal';

export interface Fish3dPreviewSpec {
  speciesId: string;
  speciesName: string;
  rarity: string;
  weightKg: number;
  lengthCm?: number;
  waterZoneLabel: string;
  colorHex: string;
  isTrophy?: boolean;
  isMintedNft?: boolean;
  nftTokenId?: string | null;
  valueLabel?: string;
  ownerOrSellerLabel?: string;
}

const portraitCache = new Map<string, string>();

function resolveSpeciesColorHex(speciesId: string, fallbackHex?: string): string {
  if (fallbackHex && fallbackHex.startsWith('#')) return fallbackHex;
  const spec = FISH_SPECIES_CATALOG.find((s) => s.speciesId === speciesId);
  return spec?.colorHex || '#38bdf8';
}

/**
 * Renders a crisp studio-lit perspective fish snapshot to a PNG data URL once per `(speciesId, colorHex)`
 * using the pure 2D triangle rasterizer (zero WebGL contexts, zero context-loss risk).
 */
export function getOrRenderFish3dPortraitUrl(speciesId: string, rawColorHex?: string): string {
  const colorHex = resolveSpeciesColorHex(speciesId, rawColorHex);
  const cacheKey = `${speciesId}:${colorHex}`;
  const existing = portraitCache.get(cacheKey);
  if (existing) return existing;

  if (typeof document === 'undefined') return '';

  try {
    const offscreenCanvas = document.createElement('canvas');
    const width = 320;
    const height = 180;
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;

    const ctx2d = offscreenCanvas.getContext('2d');
    if (!ctx2d) return '';

    const fishModel = buildShorelineProceduralFishGroup(speciesId, colorHex);
    fishModel.updateSwimAnimation(0.42);
    fishModel.group.rotation.y = 0.24;
    fishModel.group.rotation.x = 0.04;
    fishModel.group.rotation.z = 0.02;

    const drawnCount = renderFishGroupTo2dCanvas(ctx2d, fishModel.group, width, height, 2.42, 23);
    fishModel.dispose();

    if (drawnCount > 0) {
      const dataUrl = offscreenCanvas.toDataURL('image/png');
      if (dataUrl && dataUrl.startsWith('data:image/')) {
        portraitCache.set(cacheKey, dataUrl);
        return dataUrl;
      }
    }
  } catch {
    // Fallback to text label if canvas export is unavailable
  }

  return '';
}

interface Fish3dThumbnailProps {
  speciesId: string;
  speciesName: string;
  colorHex?: string;
  variant?: 'compact' | 'dark' | 'card' | 'studio';
  onInspect: () => void;
}

export const Fish3dThumbnail: React.FC<Fish3dThumbnailProps> = ({
  speciesId,
  speciesName,
  colorHex,
  variant = 'compact',
  onInspect,
}) => {
  const resolvedHex = resolveSpeciesColorHex(speciesId, colorHex);
  const portraitUrl = useMemo(
    () => getOrRenderFish3dPortraitUrl(speciesId, resolvedHex),
    [speciesId, resolvedHex],
  );

  const containerStyle =
    variant === 'studio'
      ? 'w-full h-full bg-[#f0f1f4]'
      : variant === 'card'
        ? 'w-full h-28 rounded-xl bg-gradient-to-br from-[#eef4fb] via-[#e4eef8] to-[#dbe7f4] border border-slate-200/80 shadow-xs'
        : variant === 'dark'
          ? 'w-[88px] h-[54px] rounded-xl bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/15 shrink-0'
          : 'w-[84px] h-[52px] rounded-xl bg-gradient-to-br from-[#eef4fb] to-[#e2ecf6] border border-slate-200/80 shrink-0';

  return (
    <button
      type="button"
      data-fish-3d-thumb={speciesId}
      title={`Inspect ${speciesName}`}
      onClick={(e) => {
        e.stopPropagation();
        soundEngine.playUiClick();
        onInspect();
      }}
      className={`group relative overflow-hidden flex items-center justify-center cursor-pointer hover:brightness-[1.03] active:scale-[0.98] transition-all select-none ${containerStyle}`}
    >
      <div
        style={{
          background:
            variant === 'studio'
              ? `radial-gradient(65% 65% at 50% 45%, ${resolvedHex}20 0%, transparent 72%)`
              : `radial-gradient(circle at 50% 55%, ${resolvedHex}28 0%, transparent 72%)`,
        }}
        className="absolute inset-0 pointer-events-none"
      />
      {variant === 'studio' && portraitUrl && (
        <div
          aria-hidden="true"
          className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[56%] h-2.5 rounded-full bg-black/[0.07] blur-[5px] pointer-events-none"
        />
      )}
      {portraitUrl ? (
        <img
          src={portraitUrl}
          alt={speciesName}
          className={`relative z-10 w-full h-full object-contain group-hover:scale-105 transition-transform duration-200 pointer-events-none ${
            variant === 'studio' ? 'p-2 drop-shadow-[0_6px_10px_rgba(15,23,42,0.12)]' : ''
          }`}
        />
      ) : (
        <span
          className={`relative z-10 text-[10px] font-semibold uppercase px-1 text-center truncate ${
            variant === 'dark' ? 'text-white/80' : 'text-slate-600'
          }`}
        >
          {speciesName}
        </span>
      )}
    </button>
  );
};

interface Fish3dPreviewModalProps {
  fish: Fish3dPreviewSpec | null;
  onClose: () => void;
}

export const Fish3dPreviewModal: React.FC<Fish3dPreviewModalProps> = ({ fish, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const dragStateRef = useRef<{
    dragging: boolean;
    lastX: number;
    lastY: number;
    yaw: number;
    pitch: number;
    zoom: number;
  }>({
    dragging: false,
    lastX: 0,
    lastY: 0,
    yaw: 0.25,
    pitch: 0.04,
    zoom: 2.45,
  });

  const isOpen = Boolean(fish);
  const activeSpeciesId = fish?.speciesId ?? '';
  const activeColorHex = fish?.colorHex ?? '';

  useEffect(() => {
    if (!isOpen || !activeSpeciesId) return;
    dragStateRef.current = {
      dragging: false,
      lastX: 0,
      lastY: 0,
      yaw: 0.25,
      pitch: 0.04,
      zoom: 2.45,
    };

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const logicalW = 680;
    const logicalH = 340;
    canvas.width = Math.round(logicalW * dpr);
    canvas.height = Math.round(logicalH * dpr);
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

    const resolvedColor = resolveSpeciesColorHex(activeSpeciesId, activeColorHex);
    const fishModel = buildShorelineProceduralFishGroup(activeSpeciesId, resolvedColor);

    let rafId = 0;
    const startMs = performance.now();
    const animate = (nowMs: number) => {
      if (typeof document === 'undefined' || !document.hidden) {
        const t = (nowMs - startMs) * 0.001;
        fishModel.updateSwimAnimation(t);

        if (!dragStateRef.current.dragging) {
          dragStateRef.current.yaw += 0.0045;
        }
        fishModel.group.rotation.y = dragStateRef.current.yaw;
        fishModel.group.rotation.x = dragStateRef.current.pitch;
        fishModel.group.rotation.z = Math.sin(t * 1.6) * 0.025;

        renderFishGroupTo2dCanvas(
          ctx2d,
          fishModel.group,
          logicalW,
          logicalH,
          dragStateRef.current.zoom,
          24,
        );
      }
      rafId = window.requestAnimationFrame(animate);
    };
    rafId = window.requestAnimationFrame(animate);

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.cancelAnimationFrame(rafId);
      fishModel.dispose();
    };
  }, [isOpen, activeSpeciesId, activeColorHex]);

  if (!fish) return null;

  const spec = FISH_SPECIES_CATALOG.find((s) => s.speciesId === fish.speciesId);
  const lengthCm =
    fish.lengthCm || computeLengthCmFromWeightKg(fish.weightKg, spec?.lwA, spec?.lwB);

  const rarityBadgeClass =
    fish.rarity === 'Mythic'
      ? 'bg-purple-100 text-purple-800 border-purple-200/80'
      : fish.rarity === 'Rare'
        ? 'bg-amber-100 text-amber-800 border-amber-200/80'
        : fish.rarity === 'Uncommon'
          ? 'bg-teal-100 text-teal-800 border-teal-200/80'
          : 'bg-slate-100 text-slate-700 border-slate-200/80';

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${fish.speciesName} Preview`}
      data-fish-3d-preview-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-sm pointer-events-auto select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-[24px] bg-[#edf0f5]/95 backdrop-blur-2xl border border-white/80 shadow-[0_24px_64px_rgba(15,23,42,0.3)] text-slate-900 overflow-hidden"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-white/95 border-b border-slate-200/80">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span
                className={`px-2.5 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wide ${rarityBadgeClass}`}
              >
                {fish.rarity}
              </span>
              {fish.isTrophy && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200/80 text-[10px] font-semibold uppercase tracking-wide">
                  TROPHY
                </span>
              )}
              {fish.isMintedNft && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold uppercase tracking-wide">
                  FISH NFT
                </span>
              )}
            </div>
            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate">
              {fish.speciesName}
            </h3>
            <div className="text-xs font-medium text-slate-500">{fish.waterZoneLabel}</div>
          </div>

          <button
            type="button"
            data-close-fish-3d-preview="true"
            aria-label="Close"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 font-semibold text-xs cursor-pointer transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Close</span>
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-3.5">
          {/* Interactive 360° Fish Canvas Stage */}
          <div className="rounded-2xl bg-white border border-slate-200/75 shadow-sm p-2">
            <div
              style={{
                background:
                  'radial-gradient(70% 65% at 50% 50%, rgba(186, 230, 253, 0.55) 0%, rgba(226, 236, 248, 0.92) 55%, rgba(210, 224, 240, 0.98) 100%)',
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                dragStateRef.current.dragging = true;
                dragStateRef.current.lastX = e.clientX;
                dragStateRef.current.lastY = e.clientY;
              }}
              onPointerMove={(e) => {
                if (!dragStateRef.current.dragging) return;
                const dx = e.clientX - dragStateRef.current.lastX;
                const dy = e.clientY - dragStateRef.current.lastY;
                dragStateRef.current.lastX = e.clientX;
                dragStateRef.current.lastY = e.clientY;
                dragStateRef.current.yaw += dx * 0.012;
                dragStateRef.current.pitch = Math.max(
                  -0.75,
                  Math.min(0.75, dragStateRef.current.pitch + dy * 0.008),
                );
              }}
              onPointerUp={() => {
                dragStateRef.current.dragging = false;
              }}
              onPointerCancel={() => {
                dragStateRef.current.dragging = false;
              }}
              onWheel={(e) => {
                e.preventDefault();
                dragStateRef.current.zoom = Math.max(
                  1.55,
                  Math.min(3.8, dragStateRef.current.zoom + e.deltaY * 0.002),
                );
              }}
              className="relative w-full h-[220px] sm:h-[260px] rounded-xl cursor-grab active:cursor-grabbing overflow-hidden touch-none flex items-center justify-center"
            >
              <canvas
                ref={canvasRef}
                width={680}
                height={340}
                className="w-full h-full object-contain pointer-events-none"
              />

              <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-full bg-white/85 backdrop-blur-md border border-slate-200/80 text-[10.5px] font-medium text-slate-600 pointer-events-none shadow-xs">
                Drag to rotate
              </div>

              <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    dragStateRef.current.zoom = Math.min(3.8, dragStateRef.current.zoom + 0.3);
                  }}
                  className="w-7 h-7 rounded-full bg-white/90 hover:bg-white text-slate-700 border border-slate-200/80 text-xs font-bold shadow-xs flex items-center justify-center cursor-pointer transition-colors"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    dragStateRef.current.yaw = 0.25;
                    dragStateRef.current.pitch = 0.04;
                    dragStateRef.current.zoom = 2.45;
                  }}
                  className="inline-flex items-center gap-1 px-2.5 h-7 rounded-full bg-white/90 hover:bg-white text-sky-700 border border-slate-200/80 text-[10px] font-semibold uppercase shadow-xs cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3 h-3" aria-hidden="true" />
                  <span>Reset</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    dragStateRef.current.zoom = Math.max(1.55, dragStateRef.current.zoom - 0.3);
                  }}
                  className="w-7 h-7 rounded-full bg-white/90 hover:bg-white text-slate-700 border border-slate-200/80 text-xs font-bold shadow-xs flex items-center justify-center cursor-pointer transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-white border border-slate-200/75 shadow-sm">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Weight
              </div>
              <div className="text-sm font-mono tabular-nums font-bold text-slate-900 mt-0.5">
                {fish.weightKg.toFixed(2)} kg
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500">{lengthCm} cm</div>
            </div>

            <div className="p-3 rounded-2xl bg-white border border-slate-200/75 shadow-sm">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Habitat
              </div>
              <div className="text-xs font-semibold text-sky-700 mt-1 truncate">
                {fish.waterZoneLabel}
              </div>
              {fish.ownerOrSellerLabel && (
                <div className="text-[10px] font-mono text-slate-500 truncate mt-0.5">
                  {fish.ownerOrSellerLabel}
                </div>
              )}
            </div>

            <div className="p-3 rounded-2xl bg-white border border-slate-200/75 shadow-sm">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Value
              </div>
              <div className="text-sm font-mono tabular-nums font-bold text-emerald-700 mt-0.5 truncate">
                {fish.valueLabel || 'In Bag'}
              </div>
              {fish.nftTokenId && (
                <div className="text-[9.5px] font-mono text-slate-500 truncate mt-0.5">
                  {fish.nftTokenId}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};
