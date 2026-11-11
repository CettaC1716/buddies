import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FISH_SPECIES_CATALOG, computeLengthCmFromWeightKg } from '../game/buddiesFishingMarket';
import { soundEngine } from '../game/audio';
import {
  buildTidewaterProceduralFishGroup,
  renderFishGroupTo2dCanvas,
} from './TidewaterCatchShowcaseModal';

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

    const fishModel = buildTidewaterProceduralFishGroup(speciesId, colorHex);
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
  variant?: 'compact' | 'dark' | 'card';
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
    variant === 'card'
      ? 'w-full h-28 bg-gradient-to-br from-[#0f172a] via-[#132338] to-[#09101d] border-2 border-black'
      : variant === 'dark'
        ? 'w-[88px] h-[54px] bg-gradient-to-br from-[#09111e] to-[#172554] border-2 border-black shrink-0'
        : 'w-[84px] h-[52px] bg-gradient-to-br from-[#0f172a] to-[#1e293b] border-2 border-black shrink-0';

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
      className={`group relative overflow-hidden flex items-center justify-center cursor-pointer hover:brightness-110 active:scale-[0.98] transition-all select-none ${containerStyle}`}
    >
      <div
        style={{
          background: `radial-gradient(circle at 50% 55%, ${resolvedHex}33 0%, transparent 72%)`,
        }}
        className="absolute inset-0 pointer-events-none"
      />
      {portraitUrl ? (
        <img
          src={portraitUrl}
          alt={speciesName}
          className="relative z-10 w-full h-full object-contain group-hover:scale-105 transition-transform duration-200 pointer-events-none"
        />
      ) : (
        <span className="relative z-10 text-[10px] font-black uppercase text-white/80 px-1 text-center truncate">
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
    const fishModel = buildTidewaterProceduralFishGroup(activeSpeciesId, resolvedColor);

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
      ? 'bg-[#c084fc] text-black'
      : fish.rarity === 'Rare'
        ? 'bg-[#facc15] text-black'
        : fish.rarity === 'Uncommon'
          ? 'bg-[#2dd4bf] text-black'
          : 'bg-slate-200 text-black';

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${fish.speciesName} Preview`}
      data-fish-3d-preview-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs pointer-events-auto select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-[#0f172a] text-white border-4 border-black shadow-[10px_10px_0_#000] p-4 sm:p-5 space-y-3"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between gap-2 border-b-2 border-white/15 pb-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`px-2 py-0.5 border border-black text-[10px] font-black uppercase ${rarityBadgeClass}`}
            >
              {fish.rarity}
            </span>
            {fish.isTrophy && (
              <span className="px-2 py-0.5 bg-[#facc15] text-black border border-black text-[10px] font-black uppercase">
                TROPHY
              </span>
            )}
            {fish.isMintedNft && (
              <span className="px-2 py-0.5 bg-[#b8ff3c] text-black border border-black text-[10px] font-black uppercase">
                FISH NFT
              </span>
            )}
          </div>

          <button
            type="button"
            data-close-fish-3d-preview="true"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            className="-skew-x-6 px-3 py-1 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black shadow-[2px_2px_0_#000] font-black text-xs uppercase cursor-pointer"
          >
            <span className="skew-x-6 inline-block">CLOSE</span>
          </button>
        </div>

        {/* Title */}
        <div>
          <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
            {fish.speciesName}
          </h3>
          <div className="text-xs font-bold text-slate-400">{fish.waterZoneLabel}</div>
        </div>

        {/* Interactive 360° Fish Canvas Stage */}
        <div
          style={{
            background:
              'radial-gradient(65% 65% at 50% 50%, rgba(30, 58, 95, 0.55) 0%, rgba(6, 11, 22, 0.95) 100%)',
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
          className="relative w-full h-[220px] sm:h-[260px] border-2 border-black shadow-[inset_0_0_24px_rgba(0,0,0,0.7)] cursor-grab active:cursor-grabbing overflow-hidden touch-none flex items-center justify-center"
        >
          <canvas
            ref={canvasRef}
            width={680}
            height={340}
            className="w-full h-full object-contain pointer-events-none"
          />

          <div className="absolute bottom-2 left-2.5 text-[10px] font-bold text-slate-300/80 pointer-events-none">
            Drag to rotate
          </div>

          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                dragStateRef.current.zoom = Math.min(3.8, dragStateRef.current.zoom + 0.3);
              }}
              className="px-2 py-0.5 bg-black/75 hover:bg-black text-white border border-white/25 text-[10px] font-black cursor-pointer"
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
              className="px-2 py-0.5 bg-black/75 hover:bg-black text-[#38bdf8] border border-white/25 text-[9.5px] font-black uppercase cursor-pointer"
            >
              RESET
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                dragStateRef.current.zoom = Math.max(1.55, dragStateRef.current.zoom - 0.3);
              }}
              className="px-2 py-0.5 bg-black/75 hover:bg-black text-white border border-white/25 text-[10px] font-black cursor-pointer"
            >
              +
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 bg-[#1e293b] border-2 border-black">
            <div className="text-[9.5px] font-black uppercase text-slate-400">WEIGHT</div>
            <div className="text-sm font-black text-white mt-0.5">
              {fish.weightKg.toFixed(2)} kg
            </div>
            <div className="text-[10px] font-mono text-slate-400">{lengthCm} cm</div>
          </div>

          <div className="p-2.5 bg-[#1e293b] border-2 border-black">
            <div className="text-[9.5px] font-black uppercase text-slate-400">HABITAT</div>
            <div className="text-xs font-black text-[#38bdf8] mt-0.5 truncate">
              {fish.waterZoneLabel}
            </div>
            {fish.ownerOrSellerLabel && (
              <div className="text-[9.5px] font-mono text-slate-400 truncate mt-0.5">
                {fish.ownerOrSellerLabel}
              </div>
            )}
          </div>

          <div className="p-2.5 bg-[#1e293b] border-2 border-black">
            <div className="text-[9.5px] font-black uppercase text-slate-400">VALUE</div>
            <div className="text-sm font-black text-[#b8ff3c] mt-0.5 truncate">
              {fish.valueLabel || 'In Bag'}
            </div>
            {fish.nftTokenId && (
              <div className="text-[9px] font-mono text-slate-400 truncate mt-0.5">
                {fish.nftTokenId}
              </div>
            )}
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
