import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import {
  Check,
  Coins,
  Pause,
  Play,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { buildOriginalBuddiesCatalogFurnitureMesh } from '../game/buddiesInteriorAssets';
import { soundEngine } from '../game/audio';
import {
  prepareStudioFurnitureGroup,
  renderTexturedGroupTo2dCanvas,
} from './furniture3dRasterizer';
import { THEME_VISUAL_SPECS } from './Furniture3dThumbnail';

export interface Furniture3dPreviewSpec {
  catalogId: string;
  name: string;
  description?: string;
  isNft: boolean;
  currency: 'CYON' | 'RESPITE';
  priceLabel: string;
  stock?: number;
  isOwned?: boolean;
  canBuy?: boolean;
  onBuy?: () => void;
}

const DEFAULT_YAW = 0.62;
const DEFAULT_PITCH = 0.24;
const DEFAULT_CAMERA_Z = 2.95;
const MIN_CAMERA_Z = 1.55; // Closest zoom-in
const MAX_CAMERA_Z = 4.65; // Widest zoom-out

export const Furniture3dPreviewModal: React.FC<{
  item: Furniture3dPreviewSpec | null;
  onClose: () => void;
}> = ({ item, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [autoSpin, setAutoSpin] = useState(true);
  const autoSpinRef = useRef(true);
  autoSpinRef.current = autoSpin;

  const [cameraZDisplay, setCameraZDisplay] = useState(DEFAULT_CAMERA_Z);
  const [themeZoomedOut, setThemeZoomedOut] = useState(false);

  const viewStateRef = useRef({
    dragging: false,
    lastX: 0,
    lastY: 0,
    yaw: DEFAULT_YAW,
    pitch: DEFAULT_PITCH,
    cameraZ: DEFAULT_CAMERA_Z,
  });

  const isOpen = Boolean(item);
  const activeCatalogId = item?.catalogId ?? '';
  const isThemeItem = activeCatalogId.startsWith('theme_');

  const updateZoom = (nextCamZ: number) => {
    const clamped = Math.max(MIN_CAMERA_Z, Math.min(MAX_CAMERA_Z, nextCamZ));
    viewStateRef.current.cameraZ = clamped;
    setCameraZDisplay(clamped);
  };

  useEffect(() => {
    if (!isOpen || !activeCatalogId) return;

    setAutoSpin(true);
    autoSpinRef.current = true;
    setThemeZoomedOut(false);
    viewStateRef.current = {
      dragging: false,
      lastX: 0,
      lastY: 0,
      yaw: DEFAULT_YAW,
      pitch: DEFAULT_PITCH,
      cameraZ: DEFAULT_CAMERA_Z,
    };
    setCameraZDisplay(DEFAULT_CAMERA_Z);

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    if (isThemeItem) {
      return () => {
        window.removeEventListener('keydown', onKeyDown);
      };
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return () => {
        window.removeEventListener('keydown', onKeyDown);
      };
    }
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) {
      return () => {
        window.removeEventListener('keydown', onKeyDown);
      };
    }

    const renderW = 760;
    const renderH = 480;
    canvas.width = renderW;
    canvas.height = renderH;

    const rawMesh = buildOriginalBuddiesCatalogFurnitureMesh(activeCatalogId);
    const wrapper = prepareStudioFurnitureGroup(rawMesh, 1.48);

    // Compute a small per-frame globe spin target if Holo Command Globe
    const globeSphere = rawMesh.getObjectByName('HoloCommandGlobeSphere');

    let rafId = 0;
    const animate = () => {
      if (typeof document === 'undefined' || !document.hidden) {
        if (!viewStateRef.current.dragging && autoSpinRef.current) {
          viewStateRef.current.yaw += 0.0065;
        }
        if (globeSphere) {
          globeSphere.rotation.y += 0.015;
        }
        wrapper.rotation.set(
          viewStateRef.current.pitch,
          viewStateRef.current.yaw,
          0,
        );
        renderTexturedGroupTo2dCanvas(
          ctx2d,
          wrapper,
          renderW,
          renderH,
          viewStateRef.current.cameraZ,
          24,
        );
      }
      rafId = window.requestAnimationFrame(animate);
    };
    rafId = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.cancelAnimationFrame(rafId);
      rawMesh.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry) mesh.geometry.dispose();
      });
    };
  }, [isOpen, activeCatalogId, isThemeItem]);

  if (!item) return null;

  const zoomPct = Math.round((DEFAULT_CAMERA_Z / cameraZDisplay) * 100);
  const themeSpec = THEME_VISUAL_SPECS[item.catalogId];

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${item.name} 3D Preview`}
      data-furniture-3d-preview-modal={item.catalogId}
      onClick={onClose}
      className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-6 bg-black/85 pointer-events-auto select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl h-[min(88vh,740px)] bg-[#0f172a] text-white border-4 border-black shadow-[10px_10px_0_#000] flex flex-col overflow-hidden"
      >
        {/* Top Modal Header */}
        <div className="px-4 py-3 bg-[#111827] border-b-2 border-black flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span
              className={`px-2 py-0.5 border border-black text-[10px] font-black uppercase ${
                item.isNft ? 'bg-[#38bdf8] text-black' : 'bg-[#a7f3d0] text-black'
              }`}
            >
              {item.isNft ? 'NFT' : 'CYON'}
            </span>
            {typeof item.stock === 'number' && (
              <span className="px-2 py-0.5 bg-black/75 border border-white/25 text-[10px] font-black uppercase text-slate-200">
                STOCK ×{item.stock}
              </span>
            )}
            <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-white truncate">
              {item.name}
            </h3>
          </div>

          <button
            type="button"
            data-close-furniture-3d-preview="true"
            aria-label="Close 3D preview"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            className="inline-flex items-center gap-1 px-3 py-1 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black shadow-[2px_2px_0_#000] font-black text-xs uppercase cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            <span>CLOSE</span>
          </button>
        </div>

        {/* Full-Modal Interactive 3D Canvas / Theme Showcase Stage */}
        {isThemeItem && themeSpec ? (
          <div className="relative flex-1 min-h-0 bg-[#070c17] overflow-hidden flex items-center justify-center">
            <img
              src={themeSpec.imageSrc}
              alt={item.name}
              className={`w-full h-full transition-transform duration-300 pointer-events-none ${
                themeZoomedOut ? 'object-contain scale-95' : 'object-cover scale-100'
              }`}
              draggable={false}
            />
            <div
              className={`absolute inset-0 bg-gradient-to-br ${themeSpec.overlayClass} pointer-events-none`}
            />
            <div className="relative z-10 flex flex-col items-center gap-3 p-6">
              <div
                className="w-16 h-16 border-2 border-black bg-black/80 flex items-center justify-center shadow-[4px_4px_0_#000]"
                style={{ color: themeSpec.accentHex }}
              >
                <themeSpec.Icon className="w-9 h-9" aria-hidden="true" />
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-black/85 border-2 border-black shadow-[3px_3px_0_#000]">
                {themeSpec.swatches.map((hex) => (
                  <span
                    key={hex}
                    className="w-5 h-5 border border-white/70 inline-block"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>

            <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  setThemeZoomedOut((v) => !v);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-black/85 hover:bg-black text-white border border-white/30 text-[10px] font-black uppercase cursor-pointer"
              >
                {themeZoomedOut ? (
                  <>
                    <ZoomIn className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>FILL</span>
                  </>
                ) : (
                  <>
                    <ZoomOut className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>ZOOM OUT</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              background:
                'radial-gradient(70% 65% at 50% 50%, rgba(30, 58, 95, 0.58) 0%, rgba(5, 10, 20, 0.96) 100%)',
            }}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement | null)?.closest('button')) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              viewStateRef.current.dragging = true;
              viewStateRef.current.lastX = e.clientX;
              viewStateRef.current.lastY = e.clientY;
            }}
            onPointerMove={(e) => {
              if (!viewStateRef.current.dragging) return;
              const dx = e.clientX - viewStateRef.current.lastX;
              const dy = e.clientY - viewStateRef.current.lastY;
              viewStateRef.current.lastX = e.clientX;
              viewStateRef.current.lastY = e.clientY;
              viewStateRef.current.yaw += dx * 0.011;
              viewStateRef.current.pitch = Math.max(
                -0.95,
                Math.min(1.05, viewStateRef.current.pitch + dy * 0.009),
              );
            }}
            onPointerUp={() => {
              viewStateRef.current.dragging = false;
            }}
            onPointerCancel={() => {
              viewStateRef.current.dragging = false;
            }}
            onWheel={(e) => {
              e.preventDefault();
              updateZoom(viewStateRef.current.cameraZ + e.deltaY * 0.0022);
            }}
            data-furniture-3d-stage="true"
            className="relative flex-1 min-h-0 w-full cursor-grab active:cursor-grabbing overflow-hidden touch-none flex items-center justify-center"
          >
            <canvas
              ref={canvasRef}
              width={760}
              height={480}
              data-furniture-3d-canvas={item.catalogId}
              className="w-full h-full object-contain pointer-events-none"
            />

            {/* Bottom-left drag & zoom hint */}
            <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-black/70 border border-white/20 text-[10px] font-bold uppercase tracking-wide text-slate-200 pointer-events-none">
              Drag to rotate 360° · Scroll to zoom
            </div>

            {/* Bottom-right interactive 3D controls */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
              <button
                type="button"
                aria-label={autoSpin ? 'Pause rotation' : 'Resume rotation'}
                onClick={(e) => {
                  e.stopPropagation();
                  soundEngine.playUiClick();
                  setAutoSpin((v) => !v);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-black/80 hover:bg-black text-white border border-white/30 text-[10px] font-black uppercase cursor-pointer"
              >
                {autoSpin ? (
                  <>
                    <Pause className="w-3 h-3" aria-hidden="true" />
                    <span>SPIN</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" aria-hidden="true" />
                    <span>PAUSED</span>
                  </>
                )}
              </button>

              <button
                type="button"
                data-furniture-zoom-out="true"
                aria-label="Zoom out 3D furniture"
                onClick={(e) => {
                  e.stopPropagation();
                  soundEngine.playUiClick();
                  updateZoom(viewStateRef.current.cameraZ + 0.45);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-black/80 hover:bg-black text-white border border-white/30 text-[10px] font-black uppercase cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" aria-hidden="true" />
              </button>

              <button
                type="button"
                data-furniture-zoom-reset="true"
                aria-label="Reset 3D view"
                onClick={(e) => {
                  e.stopPropagation();
                  soundEngine.playUiClick();
                  viewStateRef.current.yaw = DEFAULT_YAW;
                  viewStateRef.current.pitch = DEFAULT_PITCH;
                  updateZoom(DEFAULT_CAMERA_Z);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-black/80 hover:bg-black text-[#38bdf8] border border-white/30 text-[10px] font-black uppercase cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>{zoomPct}%</span>
              </button>

              <button
                type="button"
                data-furniture-zoom-in="true"
                aria-label="Zoom in 3D furniture"
                onClick={(e) => {
                  e.stopPropagation();
                  soundEngine.playUiClick();
                  updateZoom(viewStateRef.current.cameraZ - 0.45);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-black/80 hover:bg-black text-white border border-white/30 text-[10px] font-black uppercase cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* Compact Bottom Action & Price Footer */}
        <div className="px-4 py-3 bg-[#111827] border-t-2 border-black flex items-center justify-between gap-3 flex-wrap shrink-0">
          <div className="min-w-0 flex-1">
            {item.description && (
              <div className="text-xs font-medium text-slate-300 truncate">
                {item.description}
              </div>
            )}
            <div
              className={`mt-0.5 inline-flex items-center gap-1.5 text-sm font-black ${
                item.currency === 'CYON' ? 'text-[#38bdf8]' : 'text-[#d8b4fe]'
              }`}
            >
              {item.currency === 'CYON' ? (
                <Coins className="w-4 h-4 shrink-0" aria-hidden="true" />
              ) : (
                <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              <span>{item.priceLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {item.isOwned ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#b8ff3c] text-black border-2 border-black text-xs font-black uppercase">
                <Check className="w-4 h-4" aria-hidden="true" />
                <span>OWNED</span>
              </span>
            ) : item.onBuy ? (
              <button
                type="button"
                data-preview-buy-furniture-btn={item.catalogId}
                disabled={!item.canBuy}
                onClick={() => {
                  if (!item.canBuy) return;
                  soundEngine.playPickup();
                  item.onBuy?.();
                  onClose();
                }}
                className={`inline-flex items-center gap-1.5 px-4 py-2 border-2 border-black shadow-[2px_2px_0_#000] text-xs font-black uppercase ${
                  item.canBuy
                    ? 'bg-[#2bb3b1] hover:bg-[#38bdf8] text-black cursor-pointer'
                    : 'bg-slate-700 text-slate-300 cursor-not-allowed'
                }`}
              >
                <ShoppingBag className="w-4 h-4" aria-hidden="true" />
                <span>BUY ({item.priceLabel})</span>
              </button>
            ) : null}
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
