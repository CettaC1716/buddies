import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import {
  Bike,
  Check,
  Coins,
  ExternalLink,
  ShoppingBag,
  Wallet,
  X,
} from 'lucide-react';
import {
  URBAN_SCOOTER_CATALOG_ITEMS,
  getNearBlocksNftTokenUrl,
  type UrbanScooterCatalogItem,
  type UrbanScooterKind,
} from '../game/buddiesUrbanScooterRules';
import {
  createElectricScooterBike3D,
  createPushKickScooter3D,
} from '../game/buddiesUrbanScooterBuilder';
import {
  getProjectedGroupBounds,
  prepareFittedStudioGroup,
  renderTexturedGroupTo2dCanvas,
} from './furniture3dRasterizer';
import { NEAR_CONFIG } from '../lib/nearClient';
import { soundEngine } from '../game/audio';

export interface UrbanScooterShowroomModalProps {
  isOpen: boolean;
  onClose: () => void;
  respiteBalance: number;
  walletConnected: boolean;
  walletAccountId: string | null;
  ownedScooterIds: readonly string[];
  onConnectWallet: () => void;
  onOpenWalletTopUp: () => void;
  onPurchaseScooter: (
    item: UrbanScooterCatalogItem,
  ) => Promise<{ ok: boolean; errorMessage?: string }>;
}

const DEFAULT_YAW = 0.64;
const DEFAULT_PITCH = 0.22;
const FIXED_CAMERA_Z = 2.86;

const scooterPortraitCache = new Map<UrbanScooterKind, string>();

function getOrRenderScooterPortraitUrl(kind: UrbanScooterKind): string {
  const existing = scooterPortraitCache.get(kind);
  if (existing) return existing;
  if (typeof document === 'undefined') return '';

  try {
    const rawVehicleGroup =
      kind === 'electric_scooter_bike'
        ? createElectricScooterBike3D({
            parked: true,
            steerAngleRad: -0.14,
            includeContactShadow: false,
          }).root
        : createPushKickScooter3D({
            parked: true,
            folded: false,
            steerAngleRad: -0.16,
            includeContactShadow: false,
          }).root;

    const width = 320;
    const height = 200;
    const wrapper = prepareFittedStudioGroup(rawVehicleGroup, {
      cameraZ: FIXED_CAMERA_Z,
      fovDeg: 24,
      aspect: width / height,
      topMarginFrac: 0.08,
      bottomMarginFrac: 0.08,
      sideMarginFrac: 0.08,
      pitchRange: [DEFAULT_PITCH, DEFAULT_PITCH],
    });
    wrapper.rotation.set(DEFAULT_PITCH, DEFAULT_YAW, 0);
    wrapper.updateMatrixWorld(true);

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const ctx2d = offscreenCanvas.getContext('2d');
    if (!ctx2d) return '';

    const drawnCount = renderTexturedGroupTo2dCanvas(
      ctx2d,
      wrapper,
      width,
      height,
      FIXED_CAMERA_Z,
      24,
    );

    rawVehicleGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry) mesh.geometry.dispose();
    });

    if (drawnCount > 0) {
      const dataUrl = offscreenCanvas.toDataURL('image/png');
      if (dataUrl && dataUrl.startsWith('data:image/')) {
        scooterPortraitCache.set(kind, dataUrl);
        return dataUrl;
      }
    }
  } catch {
    // Fall back gracefully if offscreen canvas is unavailable.
  }

  return '';
}

export const UrbanScooterShowroomModal: React.FC<UrbanScooterShowroomModalProps> = ({
  isOpen,
  onClose,
  respiteBalance,
  walletConnected,
  walletAccountId: _walletAccountId,
  ownedScooterIds,
  onConnectWallet,
  onOpenWalletTopUp: _onOpenWalletTopUp,
  onPurchaseScooter,
}) => {
  const [selectedKind, setSelectedKind] = useState<UrbanScooterKind>('electric_scooter_bike');
  const [kickPreviewFolded, setKickPreviewFolded] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  const viewportBoxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scheduleDrawRef = useRef<(() => void) | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const viewStateRef = useRef({
    dragging: false,
    lastX: 0,
    lastY: 0,
    yaw: DEFAULT_YAW,
    pitch: DEFAULT_PITCH,
  });

  const selectedItem =
    URBAN_SCOOTER_CATALOG_ITEMS.find((it) => it.kind === selectedKind) ??
    URBAN_SCOOTER_CATALOG_ITEMS[0];
  const isOwned = ownedScooterIds.includes(selectedItem.id);
  const canAfford = respiteBalance >= selectedItem.priceRespite;
  const nftExplorerUrl = getNearBlocksNftTokenUrl(
    NEAR_CONFIG.nep245MultiTokenContractId,
    selectedItem.tokenId,
    NEAR_CONFIG.network,
  );

  const portraitByKind = useMemo(() => {
    const map: Partial<Record<UrbanScooterKind, string>> = {};
    if (!isOpen) return map;
    for (const veh of URBAN_SCOOTER_CATALOG_ITEMS) {
      map[veh.kind] = getOrRenderScooterPortraitUrl(veh.kind);
    }
    return map;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setStatusFeedback(null);
    setIsPurchasing(false);
  }, [isOpen, selectedKind]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        soundEngine.playUiCancel();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    const canvas = canvasRef.current;
    const viewportBox = viewportBoxRef.current;
    const ctx2d = canvas?.getContext('2d') ?? null;
    if (!canvas || !viewportBox || !ctx2d) {
      return () => {
        window.removeEventListener('keydown', onKeyDown);
      };
    }

    const rawVehicleGroup =
      selectedKind === 'electric_scooter_bike'
        ? createElectricScooterBike3D({
            parked: true,
            steerAngleRad: -0.14,
            includeContactShadow: false,
          }).root
        : createPushKickScooter3D({
            parked: !kickPreviewFolded,
            folded: kickPreviewFolded,
            steerAngleRad: kickPreviewFolded ? 0 : -0.16,
            includeContactShadow: false,
          }).root;

    const initialRect = viewportBox.getBoundingClientRect();
    const initialAspect = Math.max(
      1.05,
      Math.min(1.26, (initialRect.width || 480) / Math.max(1, initialRect.height || 360)),
    );
    const studioWrapper = prepareFittedStudioGroup(rawVehicleGroup, {
      cameraZ: FIXED_CAMERA_Z,
      fovDeg: 24,
      aspect: initialAspect,
      topMarginFrac: 0.075,
      bottomMarginFrac: 0.145,
      sideMarginFrac: 0.065,
      pitchRange: [-0.25, 0.68],
    });

    let rafId = 0;
    let dirty = false;

    const drawFrame = () => {
      rafId = 0;
      dirty = false;
      const rect = viewportBox.getBoundingClientRect();
      const renderW = Math.max(280, Math.min(600, Math.round(rect.width || 480)));
      const renderH = Math.max(240, Math.min(400, Math.round(rect.height || 360)));
      if (canvas.width !== renderW || canvas.height !== renderH) {
        canvas.width = renderW;
        canvas.height = renderH;
      }

      studioWrapper.rotation.set(
        viewStateRef.current.pitch,
        viewStateRef.current.yaw,
        0,
      );
      renderTexturedGroupTo2dCanvas(
        ctx2d,
        studioWrapper,
        renderW,
        renderH,
        FIXED_CAMERA_Z,
        24,
      );

      // Composite soft elliptical studio contact ground shadow cleanly behind scooter pixels
      const projBounds = getProjectedGroupBounds(
        studioWrapper,
        renderW,
        renderH,
        FIXED_CAMERA_Z,
        24,
      );
      ctx2d.save();
      ctx2d.globalCompositeOperation = 'destination-over';
      const shCx = (projBounds.minX + projBounds.maxX) * 0.5;
      const shRy = renderH * 0.075;
      const shCy = Math.max(
        renderH * 0.66,
        Math.min(renderH * 0.865, projBounds.maxY - shRy * 0.05),
      );
      const shRx = Math.max(
        renderW * 0.19,
        Math.min(renderW * 0.35, (projBounds.maxX - projBounds.minX) * 0.50),
      );
      ctx2d.translate(shCx, shCy);
      ctx2d.scale(shRx, shRy);
      const grad = ctx2d.createRadialGradient(0, 0, 0.08, 0, 0, 1.0);
      grad.addColorStop(0, 'rgba(2, 6, 15, 0.58)');
      grad.addColorStop(0.55, 'rgba(2, 6, 15, 0.26)');
      grad.addColorStop(1, 'rgba(2, 6, 15, 0)');
      ctx2d.fillStyle = grad;
      ctx2d.beginPath();
      ctx2d.arc(0, 0, 1.0, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.restore();
    };

    const scheduleDraw = () => {
      if (dirty) return;
      dirty = true;
      rafId = window.requestAnimationFrame(drawFrame);
    };
    scheduleDrawRef.current = scheduleDraw;

    // Immediate crisp initial paint + ResizeObserver for responsive matching aspect ratio
    drawFrame();

    const resizeObs =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            scheduleDraw();
          })
        : null;
    resizeObs?.observe(viewportBox);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      resizeObs?.disconnect();
      scheduleDrawRef.current = null;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      rawVehicleGroup.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry) {
          mesh.geometry.dispose();
        }
      });
    };
  }, [isOpen, selectedKind, kickPreviewFolded]);

  if (!isOpen) return null;

  const handleSelectVehicle = (kind: UrbanScooterKind) => {
    soundEngine.playUiClick();
    setSelectedKind(kind);
    viewStateRef.current.yaw = DEFAULT_YAW;
    viewStateRef.current.pitch = DEFAULT_PITCH;
  };

  const handleBuyClick = async () => {
    if (isOwned || isPurchasing) return;
    soundEngine.playUiClick();
    if (!walletConnected && respiteBalance < selectedItem.priceRespite) {
      onConnectWallet();
      return;
    }
    if (!canAfford) {
      setStatusFeedback({
        tone: 'error',
        message: `Insufficient RESPITE balance (${respiteBalance.toLocaleString()} / ${selectedItem.priceRespite} RESPITE).`,
      });
      return;
    }

    setIsPurchasing(true);
    setStatusFeedback(null);
    try {
      const res = await onPurchaseScooter(selectedItem);
      if (res.ok) {
        soundEngine.playPickup();
        setStatusFeedback({
          tone: 'success',
          message: `${selectedItem.name} acquired for ${selectedItem.priceRespite} RESPITE.`,
        });
      } else if (res.errorMessage) {
        setStatusFeedback({
          tone: 'error',
          message: res.errorMessage,
        });
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Urban Scooter Showroom"
      data-scooter-showroom-modal="true"
      onClick={() => {
        soundEngine.playUiCancel();
        onClose();
      }}
      className="fixed inset-0 z-[210] flex items-center justify-center p-3 sm:p-6 bg-black/80 pointer-events-auto select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl h-[min(660px,92vh)] bg-[#0f172a] text-white border-[3.5px] border-black ring-2 ring-white shadow-[8px_8px_0px_#000] overflow-hidden flex flex-col"
      >
        {/* Top Storefront Header Bar (Matches Real Estate & Interior Studio Catalog) */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 bg-[#14161d] border-b-[3px] border-black shrink-0">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black tracking-wide text-white truncate">
              Urban Scooter Showroom
            </h2>
            <p className="text-xs text-slate-300 truncate">
              Central Plaza Mobility · Exclusive NFT Vehicles · Settled in RESPITE
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div
              data-testid="scooter-modal-respite-balance"
              className="flex items-center gap-2 px-3 py-1.5 bg-[#1e293b] border-2 border-black shadow-[2px_2px_0_#000] text-xs font-bold tabular-nums whitespace-nowrap shrink-0"
            >
              <Coins className="w-3.5 h-3.5 text-[#2dd4bf] shrink-0" aria-hidden="true" />
              <span className="font-black text-[#2dd4bf]">
                {respiteBalance.toLocaleString()} RESPITE
              </span>
            </div>

            {!walletConnected && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onConnectWallet();
                }}
                className="px-3 py-1.5 bg-[#b8ff3c] hover:bg-[#d9f99d] text-[#090d16] border-2 border-black shadow-[2px_2px_0_#000] text-xs font-black uppercase cursor-pointer whitespace-nowrap shrink-0"
              >
                Sign In
              </button>
            )}

            <button
              type="button"
              aria-label="Close Urban Scooter Showroom"
              data-scooter-showroom-close="true"
              onClick={() => {
                soundEngine.playUiCancel();
                onClose();
              }}
              className="w-10 h-10 bg-[#ef4444] hover:bg-[#f87171] text-white border-2 border-black shadow-[3px_3px_0_#000] flex items-center justify-center cursor-pointer active:translate-y-0.5 transition-transform shrink-0"
            >
              <X className="w-5 h-5 stroke-[2.75]" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Category Bar (Matches Real Estate & Interior Studio Catalog) */}
        <div className="flex items-center justify-between gap-3 px-5 py-2.5 bg-[#111827] border-b-[2.5px] border-black shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 border-2 border-black text-xs font-black tracking-wide bg-[#38bdf8] text-[#090d16] shadow-[2px_2px_0_#000] whitespace-nowrap shrink-0">
              <Bike className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Scooters</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap shrink-0">
            <span>{URBAN_SCOOTER_CATALOG_ITEMS.length} NFT Vehicles</span>
          </div>
        </div>

        {/* Main Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Top 2-Column Featured Product Showcase */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Left Column: Fixed-Size 360° Interactive Drag-Only 3D Showcase */}
            <div className="lg:col-span-6 flex flex-col">
              <div
                ref={viewportBoxRef}
                data-testid="scooter-showroom-3d-viewport"
                className="relative w-full h-[260px] sm:h-[320px] lg:h-[360px] shrink-0 bg-gradient-to-b from-[#172338] via-[#101829] to-[#090d16] border-2 border-black overflow-hidden cursor-grab active:cursor-grabbing touch-none"
                onPointerDown={(e) => {
                  viewStateRef.current.dragging = true;
                  viewStateRef.current.lastX = e.clientX;
                  viewStateRef.current.lastY = e.clientY;
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (!viewStateRef.current.dragging) return;
                  const dx = e.clientX - viewStateRef.current.lastX;
                  const dy = e.clientY - viewStateRef.current.lastY;
                  viewStateRef.current.lastX = e.clientX;
                  viewStateRef.current.lastY = e.clientY;
                  viewStateRef.current.yaw += dx * 0.011;
                  viewStateRef.current.pitch = Math.max(
                    -0.22,
                    Math.min(0.65, viewStateRef.current.pitch + dy * 0.008),
                  );
                  scheduleDrawRef.current?.();
                }}
                onPointerUp={(e) => {
                  viewStateRef.current.dragging = false;
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                }}
                onPointerCancel={(e) => {
                  viewStateRef.current.dragging = false;
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                }}
              >
                <canvas
                  ref={canvasRef}
                  data-testid="scooter-showroom-3d-canvas"
                  className="absolute inset-0 w-full h-full block"
                />

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                  <span className="pointer-events-none text-xs font-medium text-slate-300/85">
                    ‹ drag to turn it around ›
                  </span>

                  {selectedItem.kind === 'push_kick_scooter' && (
                    <div className="flex items-center gap-1 p-0.5 bg-black/80 border border-slate-600">
                      <button
                        type="button"
                        data-scooter-fold-toggle="true"
                        onClick={() => {
                          soundEngine.playUiClick();
                          setKickPreviewFolded((prev) => !prev);
                        }}
                        className={`px-2.5 py-1 text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                          kickPreviewFolded
                            ? 'bg-[#38bdf8] text-[#090d16]'
                            : 'text-slate-200 hover:text-white'
                        }`}
                      >
                        {kickPreviewFolded ? 'Riding State' : 'Folded (85 cm)'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Contiguous Product Purchase & Preview Details */}
            <div className="lg:col-span-6 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="text-xs font-semibold text-[#2dd4bf]">
                  {selectedItem.subtitle}
                </div>

                <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                  {selectedItem.name}
                </h3>

                <div className="flex items-center justify-between gap-3 pt-0.5">
                  <div
                    data-testid="scooter-selected-price"
                    className="text-2xl font-black text-[#facc15] tabular-nums whitespace-nowrap"
                  >
                    {selectedItem.priceRespite} RESPITE
                  </div>

                  <a
                    href={nftExplorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View ${selectedItem.name} NFT on NEAR Explorer`}
                    data-scooter-nft-explorer-link="true"
                    onClick={() => soundEngine.playSoftTap()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#1e293b] hover:bg-[#334155] text-[#2dd4bf] border-2 border-black shadow-[2px_2px_0_#000] text-[11px] font-black uppercase tracking-wider cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>NFT</span>
                    <ExternalLink className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                  </a>
                </div>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {selectedItem.description}
                </p>

                <div className="border-t border-b border-slate-700/80 py-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {selectedItem.specs.map((sp) => (
                    <div key={sp.label} className="min-w-0">
                      <div className="text-[11px] text-slate-400 truncate">{sp.label}</div>
                      <div className="text-xs font-bold text-slate-100 tabular-nums truncate">
                        {sp.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action & Wallet Area */}
              <div className="space-y-2.5">
                {statusFeedback && (
                  <div
                    role="status"
                    className={`px-3 py-2 text-xs font-bold border-2 border-black ${
                      statusFeedback.tone === 'success'
                        ? 'bg-[#14532d] text-[#b8ff3c]'
                        : 'bg-[#450a0a] text-[#fca5a5]'
                    }`}
                  >
                    {statusFeedback.message}
                  </div>
                )}

                {isOwned ? (
                  <div
                    data-testid="scooter-owned-state"
                    className="w-full h-11 px-4 bg-[#b8ff3c] text-[#0b0d13] border-2 border-black shadow-[3px_3px_0_#000] font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <Check className="w-4 h-4 stroke-[3] shrink-0" aria-hidden="true" />
                    <span>Owned in Collection · Ready to Equip</span>
                  </div>
                ) : !walletConnected && respiteBalance < selectedItem.priceRespite ? (
                  <button
                    type="button"
                    data-scooter-connect-wallet-btn="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      onConnectWallet();
                    }}
                    className="w-full h-11 px-4 bg-[#38bdf8] hover:bg-[#7dd3fc] text-[#090d16] border-2 border-black shadow-[4px_4px_0_#000] font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <Wallet className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Connect Wallet to Buy ({selectedItem.priceRespite} RESPITE)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    data-scooter-buy-btn="true"
                    disabled={isPurchasing}
                    onClick={() => void handleBuyClick()}
                    className={`w-full h-11 px-4 border-2 border-black shadow-[4px_4px_0_#000] font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
                      canAfford
                        ? 'bg-[#facc15] hover:bg-[#fde047] text-[#090d16]'
                        : 'bg-[#1e293b] hover:bg-[#334155] text-slate-200'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>
                      {isPurchasing
                        ? 'Confirming Transaction...'
                        : `Buy ${selectedItem.name} · ${selectedItem.priceRespite} RESPITE`}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Hairline Divider & Single-Row Visual-Only Vehicle Selector Cards (Matches Property Kiosk) */}
          <div className="border-t border-slate-700/80 pt-3.5">
            <div
              role="tablist"
              aria-label="Select Urban Scooter Model"
              className="flex flex-nowrap gap-3 overflow-x-auto scroll-smooth pb-1 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-[#0b1120] [&::-webkit-scrollbar-thumb]:bg-slate-600"
            >
              {URBAN_SCOOTER_CATALOG_ITEMS.map((veh) => {
                const active = veh.kind === selectedItem.kind;
                const portraitUrl = portraitByKind[veh.kind] || '';
                return (
                  <button
                    key={veh.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={veh.name}
                    title={veh.name}
                    data-scooter-tab={veh.kind}
                    onClick={() => handleSelectVehicle(veh.kind)}
                    className={`group shrink-0 w-[160px] sm:w-[176px] h-[86px] p-1.5 border-2 transition-colors cursor-pointer flex items-center justify-center ${
                      active
                        ? 'border-[#2dd4bf] bg-[#16243a] shadow-[3px_3px_0_#000]'
                        : 'border-black bg-[#141a29] hover:bg-[#1b2438]'
                    }`}
                  >
                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-[#0b1120] border border-black/70">
                      {portraitUrl ? (
                        <img
                          src={portraitUrl}
                          alt={veh.name}
                          referrerPolicy="no-referrer"
                          draggable={false}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-150"
                        />
                      ) : (
                        <Bike className="w-6 h-6 text-[#2dd4bf]" aria-hidden="true" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
