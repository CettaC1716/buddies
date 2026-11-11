import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { FISH_SPECIES_CATALOG, computeLengthCmFromWeightKg } from '../game/buddiesFishingMarket';
import { soundEngine } from '../game/audio';
import { buildTidewaterProceduralFishGroup } from './TidewaterCatchShowcaseModal';

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
 * Renders a crisp studio-lit 3D fish snapshot to a PNG data URL once per `(speciesId, colorHex)`
 * and immediately releases the temporary WebGL context so list views consume zero active WebGL contexts.
 */
export function getOrRenderFish3dPortraitUrl(speciesId: string, rawColorHex?: string): string {
  const colorHex = resolveSpeciesColorHex(speciesId, rawColorHex);
  const cacheKey = `${speciesId}:${colorHex}`;
  const existing = portraitCache.get(cacheKey);
  if (existing) return existing;

  if (typeof document === 'undefined') return '';

  let renderer: THREE.WebGLRenderer | null = null;
  try {
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 320;
    offscreenCanvas.height = 180;

    renderer = new THREE.WebGLRenderer({
      canvas: offscreenCanvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(320, 180, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(23, 320 / 180, 0.1, 20);
    camera.position.set(0, 0.03, 2.55);
    camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight('#e2e8f0', 1.45);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight('#fffbeb', 2.9);
    keyLight.position.set(-1.5, 2.3, 2.2);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight('#38bdf8', 1.75);
    rimLight.position.set(1.8, -1.1, -1.5);
    scene.add(rimLight);

    const fishModel = buildTidewaterProceduralFishGroup(speciesId, colorHex);
    fishModel.updateSwimAnimation(0.42);
    fishModel.group.rotation.y = 0.24;
    fishModel.group.rotation.z = 0.02;
    scene.add(fishModel.group);

    renderer.render(scene, camera);
    const dataUrl = offscreenCanvas.toDataURL('image/png');

    fishModel.dispose();
    renderer.forceContextLoss();
    renderer.dispose();
    renderer = null;

    if (dataUrl && dataUrl.startsWith('data:image/')) {
      portraitCache.set(cacheKey, dataUrl);
      return dataUrl;
    }
  } catch {
    if (renderer) {
      try {
        renderer.forceContextLoss();
        renderer.dispose();
      } catch {
        // ignore cleanup error
      }
    }
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
  const [portraitUrl, setPortraitUrl] = useState<string>('');
  const resolvedHex = resolveSpeciesColorHex(speciesId, colorHex);

  useEffect(() => {
    const url = getOrRenderFish3dPortraitUrl(speciesId, resolvedHex);
    setPortraitUrl(url);
  }, [speciesId, resolvedHex]);

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
      title={`View ${speciesName} in 3D`}
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
      <span className="absolute bottom-1 right-1 z-20 px-1 py-0.2 bg-black/80 text-[#b8ff3c] border border-white/25 font-mono font-black text-[8px] uppercase tracking-wider">
        3D
      </span>
    </button>
  );
};

interface Fish3dPreviewModalProps {
  fish: Fish3dPreviewSpec | null;
  onClose: () => void;
}

export const Fish3dPreviewModal: React.FC<Fish3dPreviewModalProps> = ({ fish, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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
    zoom: 2.55,
  });

  useEffect(() => {
    if (!fish) return;
    dragStateRef.current = {
      dragging: false,
      lastX: 0,
      lastY: 0,
      yaw: 0.25,
      pitch: 0.04,
      zoom: 2.55,
    };

    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
      });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(680, 340, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(24, 680 / 340, 0.1, 20);
    camera.position.set(0, 0.03, dragStateRef.current.zoom);
    camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight('#e2e8f0', 1.4);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight('#fffbeb', 2.85);
    keyLight.position.set(-1.6, 2.4, 2.2);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight('#38bdf8', 1.7);
    rimLight.position.set(1.8, -1.2, -1.5);
    scene.add(rimLight);
    const fillLight = new THREE.DirectionalLight('#a855f7', 0.65);
    fillLight.position.set(0, -1.8, 1.5);
    scene.add(fillLight);

    const resolvedColor = resolveSpeciesColorHex(fish.speciesId, fish.colorHex);
    const fishModel = buildTidewaterProceduralFishGroup(fish.speciesId, resolvedColor);
    scene.add(fishModel.group);

    let rafId = 0;
    const startMs = performance.now();
    const animate = (nowMs: number) => {
      const t = (nowMs - startMs) * 0.001;
      fishModel.updateSwimAnimation(t);

      if (!dragStateRef.current.dragging) {
        dragStateRef.current.yaw += 0.0045;
      }
      fishModel.group.rotation.y = dragStateRef.current.yaw;
      fishModel.group.rotation.x = dragStateRef.current.pitch;
      fishModel.group.rotation.z = Math.sin(t * 1.6) * 0.025;

      camera.position.z = dragStateRef.current.zoom;
      renderer?.render(scene, camera);
      rafId = window.requestAnimationFrame(animate);
    };
    rafId = window.requestAnimationFrame(animate);

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.cancelAnimationFrame(rafId);
      fishModel.dispose();
      renderer?.forceContextLoss();
      renderer?.dispose();
    };
  }, [fish, onClose]);

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${fish.speciesName} 3D Preview`}
      data-fish-3d-preview-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs pointer-events-auto select-none"
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

        {/* Interactive 360° 3D Fish Canvas Stage */}
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
            Drag to rotate 360°
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
                dragStateRef.current.zoom = 2.55;
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
};
