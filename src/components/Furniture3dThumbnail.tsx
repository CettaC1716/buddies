import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Crown, Flower2, Maximize2, Rotate3d, Sparkles } from 'lucide-react';
import { buildOriginalBuddiesCatalogFurnitureMesh } from '../game/buddiesInteriorAssets';
import { soundEngine } from '../game/audio';
import {
  prepareFittedStudioGroup,
  renderTexturedGroupTo2dCanvas,
} from './furniture3dRasterizer';

/**
 * Studio portrait for a catalog furniture item, rendered once per catalogId
 * with our zero-WebGL Z-buffered UV-textured 2D triangle rasterizer so oak wood grain,
 * bouclé weave, ceramic speckles, leaf veins, and wireframe holograms render with full color,
 * then cached as a PNG data URL. Items without a 3D builder (house themes)
 * render curated architectural theme artwork + swatches.
 */
const furniturePortraitCache = new Map<string, string>();

export function getOrRenderFurniturePortraitUrl(
  catalogId: string,
  aspectMode: 'landscape' | 'portrait' = 'landscape',
): string {
  if (catalogId.startsWith('theme_')) return '';
  const cacheKey = aspectMode === 'portrait' ? `${catalogId}:portrait` : catalogId;
  const existing = furniturePortraitCache.get(cacheKey);
  if (existing) return existing;
  if (typeof document === 'undefined') return '';

  try {
    const meshGroup = buildOriginalBuddiesCatalogFurnitureMesh(catalogId);
    const width = aspectMode === 'portrait' ? 280 : 320;
    const height = aspectMode === 'portrait' ? 300 : 200;
    const margin = aspectMode === 'portrait' ? 0.065 : 0.075;
    const wrapper = prepareFittedStudioGroup(meshGroup, {
      cameraZ: 2.9,
      fovDeg: 24,
      aspect: width / height,
      topMarginFrac: margin,
      bottomMarginFrac: margin,
      sideMarginFrac: margin,
      pitchRange: [0.24, 0.24],
    });
    wrapper.rotation.set(0.24, 0.62, 0);
    wrapper.updateMatrixWorld(true);

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const ctx2d = offscreenCanvas.getContext('2d');
    if (!ctx2d) return '';

    const drawnCount = renderTexturedGroupTo2dCanvas(ctx2d, wrapper, width, height, 2.9, 24);

    meshGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry) mesh.geometry.dispose();
    });

    if (drawnCount > 0) {
      const dataUrl = offscreenCanvas.toDataURL('image/png');
      if (dataUrl && dataUrl.startsWith('data:image/')) {
        furniturePortraitCache.set(cacheKey, dataUrl);
        return dataUrl;
      }
    }
  } catch {
    // Fall back to theme/icon visual if the portrait cannot be rendered.
  }

  return '';
}

export const THEME_VISUAL_SPECS: Record<
  string,
  {
    imageSrc: string;
    overlayClass: string;
    accentHex: string;
    swatches: readonly [string, string, string];
    Icon: typeof Flower2;
  }
> = {
  theme_japanese_zen: {
    imageSrc: '/assets/kiosk/house_interior.jpg',
    overlayClass: 'from-[#f4a261]/25 via-[#264653]/35 to-[#0f172a]/85',
    accentHex: '#fca5a5',
    swatches: ['#e7c8a0', '#6b8c76', '#f9a8d4'],
    Icon: Flower2,
  },
  theme_cyber_neon: {
    imageSrc: '/assets/kiosk/house_interior.jpg',
    overlayClass: 'from-[#06b6d4]/45 via-[#3b0764]/55 to-[#090d16]/90',
    accentHex: '#22d3ee',
    swatches: ['#0f172a', '#22d3ee', '#a855f7'],
    Icon: Sparkles,
  },
  theme_royal_gold: {
    imageSrc: '/assets/kiosk/house_exterior.jpg',
    overlayClass: 'from-[#f59e0b]/40 via-[#451a03]/50 to-[#0f172a]/90',
    accentHex: '#facc15',
    swatches: ['#facc15', '#78350f', '#fef3c7'],
    Icon: Crown,
  },
};

interface Furniture3dThumbnailProps {
  catalogId: string;
  name: string;
  iconEmoji?: string;
  compact?: boolean;
  size?: 'compact' | 'normal' | 'hero' | 'portrait';
  variant?: 'dark' | 'studio';
  onInspect?: () => void;
}

export const Furniture3dThumbnail: React.FC<Furniture3dThumbnailProps> = ({
  catalogId,
  name,
  iconEmoji,
  compact = false,
  size,
  variant = 'dark',
  onInspect,
}) => {
  const resolvedSize = size ?? (compact ? 'compact' : 'normal');
  const portraitUrl = useMemo(
    () =>
      getOrRenderFurniturePortraitUrl(
        catalogId,
        resolvedSize === 'portrait' ? 'portrait' : 'landscape',
      ),
    [catalogId, resolvedSize],
  );
  const heightClass =
    resolvedSize === 'portrait'
      ? 'h-full'
      : resolvedSize === 'compact'
        ? 'h-16'
        : resolvedSize === 'hero'
          ? 'h-32'
          : 'h-24';

  const isStudio = variant === 'studio';
  const themeSpec = THEME_VISUAL_SPECS[catalogId];
  const isInteractive = typeof onInspect === 'function';

  const surfaceClass = isStudio
    ? 'bg-[#f0f1f4]'
    : 'bg-gradient-to-br from-[#0f172a] via-[#132338] to-[#09101d] border-2 border-black';

  const innerContent = (
    <>
      {isStudio ? (
        <>
          <div
            style={{
              background:
                'radial-gradient(75% 70% at 50% 35%, rgba(255, 255, 255, 0.75) 0%, transparent 75%)',
            }}
            className="absolute inset-0 pointer-events-none"
          />
          {portraitUrl && (
            <div
              aria-hidden="true"
              className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[56%] h-3 rounded-full bg-black/[0.08] blur-[5px] pointer-events-none"
            />
          )}
        </>
      ) : (
        <div
          style={{
            background:
              'radial-gradient(65% 65% at 50% 55%, rgba(56, 189, 248, 0.12) 0%, transparent 75%)',
          }}
          className="absolute inset-0 pointer-events-none"
        />
      )}
      {portraitUrl ? (
        <img
          src={portraitUrl}
          alt={name}
          className={`relative z-10 w-full h-full object-contain group-hover:scale-105 transition-transform duration-200 pointer-events-none ${
            isStudio ? 'p-2 drop-shadow-[0_6px_10px_rgba(15,23,42,0.14)]' : ''
          }`}
          draggable={false}
        />
      ) : themeSpec ? (
        <>
          <img
            src={themeSpec.imageSrc}
            alt={name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 pointer-events-none"
            draggable={false}
          />
          <div
            className={`absolute inset-0 bg-gradient-to-br ${themeSpec.overlayClass} pointer-events-none`}
          />
          <div className="relative z-10 flex flex-col items-center gap-1.5 pointer-events-none">
            <div
              className={`w-9 h-9 flex items-center justify-center ${
                isStudio
                  ? 'rounded-xl bg-white/90 backdrop-blur-sm shadow-sm border border-black/10'
                  : 'border-2 border-black bg-black/75 shadow-[2px_2px_0_#000]'
              }`}
              style={{ color: themeSpec.accentHex }}
            >
              <themeSpec.Icon className="w-5 h-5" aria-hidden="true" />
            </div>
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 ${
                isStudio
                  ? 'rounded-full bg-white/90 backdrop-blur-sm border border-black/10'
                  : 'bg-black/75 border border-black'
              }`}
            >
              {themeSpec.swatches.map((hex) => (
                <span
                  key={hex}
                  className={`w-2.5 h-2.5 inline-block ${
                    isStudio ? 'rounded-full border border-black/15' : 'border border-white/60'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>
        </>
      ) : (
        <span className="relative z-10 text-[26px] leading-none pointer-events-none" aria-hidden="true">
          {iconEmoji || '◆'}
        </span>
      )}

      {isInteractive && resolvedSize !== 'compact' && (
        <span
          className={`absolute bottom-1.5 right-1.5 z-20 inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-black uppercase opacity-85 group-hover:opacity-100 transition-colors pointer-events-none ${
            isStudio
              ? 'rounded-md bg-white/90 text-neutral-800 border border-black/10 shadow-xs group-hover:bg-neutral-900 group-hover:text-white'
              : 'bg-black/80 text-white border border-white/30 group-hover:bg-[#38bdf8] group-hover:text-black group-hover:border-black'
          }`}
        >
          {catalogId.startsWith('theme_') ? (
            <Maximize2 className="w-2.5 h-2.5" aria-hidden="true" />
          ) : (
            <Rotate3d className="w-2.5 h-2.5" aria-hidden="true" />
          )}
          <span>{catalogId.startsWith('theme_') ? 'VIEW' : '3D'}</span>
        </span>
      )}
    </>
  );

  if (isInteractive) {
    return (
      <button
        type="button"
        data-furniture-3d-thumb={catalogId}
        aria-label={`Inspect ${name} in 3D`}
        title={`Click to inspect ${name}`}
        onClick={(e) => {
          e.stopPropagation();
          soundEngine.playUiClick();
          onInspect();
        }}
        className={`group relative w-full ${heightClass} ${surfaceClass} overflow-hidden flex items-center justify-center cursor-pointer hover:brightness-[1.03] active:scale-[0.99] transition-all select-none`}
      >
        {innerContent}
      </button>
    );
  }

  return (
    <div
      data-furniture-3d-thumb={catalogId}
      className={`group relative w-full ${heightClass} ${surfaceClass} overflow-hidden flex items-center justify-center`}
    >
      {innerContent}
    </div>
  );
};
