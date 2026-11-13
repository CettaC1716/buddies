import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Crown, Flower2, Maximize2, Rotate3d, Sparkles } from 'lucide-react';
import { buildOriginalBuddiesCatalogFurnitureMesh } from '../game/buddiesInteriorAssets';
import { soundEngine } from '../game/audio';
import {
  prepareStudioFurnitureGroup,
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

export function getOrRenderFurniturePortraitUrl(catalogId: string): string {
  if (catalogId.startsWith('theme_')) return '';
  const existing = furniturePortraitCache.get(catalogId);
  if (existing) return existing;
  if (typeof document === 'undefined') return '';

  try {
    const meshGroup = buildOriginalBuddiesCatalogFurnitureMesh(catalogId);
    const wrapper = prepareStudioFurnitureGroup(meshGroup, 1.48);
    wrapper.rotation.set(0.24, 0.62, 0);
    wrapper.updateMatrixWorld(true);

    const width = 320;
    const height = 200;
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
        furniturePortraitCache.set(catalogId, dataUrl);
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
  size?: 'compact' | 'normal' | 'hero';
  onInspect?: () => void;
}

export const Furniture3dThumbnail: React.FC<Furniture3dThumbnailProps> = ({
  catalogId,
  name,
  iconEmoji,
  compact = false,
  size,
  onInspect,
}) => {
  const portraitUrl = useMemo(
    () => getOrRenderFurniturePortraitUrl(catalogId),
    [catalogId],
  );
  const resolvedSize = size ?? (compact ? 'compact' : 'normal');
  const heightClass =
    resolvedSize === 'compact'
      ? 'h-16'
      : resolvedSize === 'hero'
        ? 'h-32'
        : 'h-24';

  const themeSpec = THEME_VISUAL_SPECS[catalogId];
  const isInteractive = typeof onInspect === 'function';

  const innerContent = (
    <>
      <div
        style={{
          background:
            'radial-gradient(65% 65% at 50% 55%, rgba(56, 189, 248, 0.12) 0%, transparent 75%)',
        }}
        className="absolute inset-0 pointer-events-none"
      />
      {portraitUrl ? (
        <img
          src={portraitUrl}
          alt={name}
          className="relative z-10 w-full h-full object-contain group-hover:scale-105 transition-transform duration-200 pointer-events-none"
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
              className="w-9 h-9 border-2 border-black bg-black/75 flex items-center justify-center shadow-[2px_2px_0_#000]"
              style={{ color: themeSpec.accentHex }}
            >
              <themeSpec.Icon className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-black/75 border border-black">
              {themeSpec.swatches.map((hex) => (
                <span
                  key={hex}
                  className="w-2.5 h-2.5 border border-white/60 inline-block"
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>
        </>
      ) : (
        <span className="relative z-10 text-[22px] leading-none pointer-events-none" aria-hidden="true">
          {iconEmoji || '◆'}
        </span>
      )}

      {isInteractive && resolvedSize !== 'compact' && (
        <span className="absolute bottom-1.5 right-1.5 z-20 inline-flex items-center gap-1 px-1.5 py-0.5 bg-black/80 text-white border border-white/30 text-[8px] font-black uppercase opacity-85 group-hover:opacity-100 group-hover:bg-[#38bdf8] group-hover:text-black group-hover:border-black transition-colors pointer-events-none">
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
        className={`group relative w-full ${heightClass} bg-gradient-to-br from-[#0f172a] via-[#132338] to-[#09101d] border-2 border-black overflow-hidden flex items-center justify-center cursor-pointer hover:brightness-110 active:scale-[0.99] transition-all select-none`}
      >
        {innerContent}
      </button>
    );
  }

  return (
    <div
      data-furniture-3d-thumb={catalogId}
      className={`group relative w-full ${heightClass} bg-gradient-to-br from-[#0f172a] via-[#132338] to-[#09101d] border-2 border-black overflow-hidden flex items-center justify-center`}
    >
      {innerContent}
    </div>
  );
};
