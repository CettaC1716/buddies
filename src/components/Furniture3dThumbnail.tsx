import React, { useMemo } from 'react';
import * as THREE from 'three';
import { buildOriginalBuddiesCatalogFurnitureMesh } from '../game/buddiesInteriorAssets';
import { renderFishGroupTo2dCanvas } from './ShorelineCatchShowcaseModal';

/**
 * Studio portrait for a catalog furniture item, rendered once per catalogId
 * with the same zero-WebGL 2D triangle rasterizer the fish portraits use,
 * then cached as a PNG data URL. Items without a 3D builder (house themes)
 * return '' and the card falls back to its icon/label visual.
 */
const furniturePortraitCache = new Map<string, string>();

export function getOrRenderFurniturePortraitUrl(catalogId: string): string {
  const existing = furniturePortraitCache.get(catalogId);
  if (existing) return existing;
  if (typeof document === 'undefined') return '';

  try {
    const meshGroup = buildOriginalBuddiesCatalogFurnitureMesh(catalogId);

    // Normalize: recenter on the bounding-box center and scale the largest
    // dimension to ~1.5 world units so every piece frames like the fish.
    const box = new THREE.Box3().setFromObject(meshGroup);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;

    const wrapper = new THREE.Group();
    meshGroup.position.set(-center.x, -center.y, -center.z);
    wrapper.add(meshGroup);
    wrapper.scale.setScalar(1.5 / maxDim);
    wrapper.rotation.set(0.1, 0.62, 0);
    wrapper.updateMatrixWorld(true);

    const width = 320;
    const height = 200;
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const ctx2d = offscreenCanvas.getContext('2d');
    if (!ctx2d) return '';

    const drawnCount = renderFishGroupTo2dCanvas(ctx2d, wrapper, width, height, 2.7, 24);

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
    // Fall back to the label visual if the portrait cannot be rendered.
  }

  return '';
}

interface Furniture3dThumbnailProps {
  catalogId: string;
  name: string;
  iconEmoji?: string;
  compact?: boolean;
}

export const Furniture3dThumbnail: React.FC<Furniture3dThumbnailProps> = ({
  catalogId,
  name,
  iconEmoji,
  compact = false,
}) => {
  const portraitUrl = useMemo(
    () => getOrRenderFurniturePortraitUrl(catalogId),
    [catalogId],
  );

  return (
    <div
      data-furniture-3d-thumb={catalogId}
      className={`relative w-full ${
        compact ? 'h-16' : 'h-24'
      } bg-gradient-to-br from-[#0f172a] via-[#132338] to-[#09101d] border-2 border-black overflow-hidden flex items-center justify-center`}
    >
      {portraitUrl ? (
        <img
          src={portraitUrl}
          alt={name}
          className="relative z-10 w-full h-full object-contain pointer-events-none"
          draggable={false}
        />
      ) : (
        <span className="relative z-10 text-[22px] leading-none" aria-hidden="true">
          {iconEmoji || '◆'}
        </span>
      )}
    </div>
  );
};
