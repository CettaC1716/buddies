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
      grad.addColorStop(0, 'rgba(15, 23, 42, 0.24)');
      grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.10)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
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
      className="fixed inset-0 z-[210] flex items-center justify-center p-3 sm:p-6 bg-slate-950/55 backdrop-blur-sm pointer-events-auto select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl h-[min(680px,92vh)] rounded-[26px] bg-[#edf0f5]/95 backdrop-blur-2xl border border-white/80 shadow-[0_24px_64px_rgba(15,23,42,0.3)] text-slate-900 overflow-hidden flex flex-col"
      >
        {/* Top Storefront Header Bar */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 bg-white/95 border-b border-slate-200/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-sky-50 text-sky-600 border border-sky-200/70 flex items-center justify-center shrink-0">
              <Bike className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 truncate">
                Urban Scooter Showroom
              </h2>
              <p className="text-xs text-slate-500 truncate">
                Central Plaza Mobility · Exclusive NFT Vehicles · Settled in RESPITE
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div
              data-testid="scooter-modal-respite-balance"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200/80 text-xs font-mono tabular-nums font-semibold text-slate-800 whitespace-nowrap shrink-0"
            >
              <Coins className="w-3.5 h-3.5 text-teal-600 shrink-0" aria-hidden="true" />
              <span className="font-bold text-slate-900">
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
                className="px-3.5 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
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
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center cursor-pointer transition-colors shrink-0"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Category Bar */}
        <div className="flex items-center justify-between gap-3 px-5 py-2.5 bg-white/70 border-b border-slate-200/75 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-slate-900 text-white shadow-xs whitespace-nowrap shrink-0">
              <Bike className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Scooters</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-medium whitespace-nowrap shrink-0">
            <span>{URBAN_SCOOTER_CATALOG_ITEMS.length} NFT Vehicles</span>
          </div>
        </div>

        {/* Main Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Top 2-Column Featured Product Showcase */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Left Column: Fixed-Size 360° Interactive Drag-Only 3D Showcase */}
            <div className="lg:col-span-6 flex flex-col">
              <div className="rounded-2xl bg-white border border-slate-200/75 shadow-sm p-2.5 flex-1 flex flex-col">
                <div
                  ref={viewportBoxRef}
                  data-testid="scooter-showroom-3d-viewport"
                  className="relative w-full h-[250px] sm:h-[310px] lg:h-[348px] shrink-0 rounded-xl bg-gradient-to-b from-[#f7f9fc] via-[#eef2f7] to-[#e4eaf2] overflow-hidden cursor-grab active:cursor-grabbing touch-none"
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

                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                    <span className="pointer-events-none px-3 py-1 rounded-full bg-white/85 backdrop-blur-md border border-slate-200/80 text-[11px] font-medium text-slate-600 shadow-xs">
                      ‹ drag to turn it around ›
                    </span>

                    {selectedItem.kind === 'push_kick_scooter' && (
                      <button
                        type="button"
                        data-scooter-fold-toggle="true"
                        onClick={() => {
                          soundEngine.playUiClick();
                          setKickPreviewFolded((prev) => !prev);
                        }}
                        className={`px-3 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 shadow-xs border ${
                          kickPreviewFolded
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white/90 hover:bg-white text-slate-700 border-slate-200/80'
                        }`}
                      >
                        {kickPreviewFolded ? 'Riding State' : 'Folded (85 cm)'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Bento Product Purchase & Preview Details */}
            <div className="lg:col-span-6 rounded-2xl bg-white border border-slate-200/75 shadow-sm p-5 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200/70 text-[11px] font-semibold">
                  {selectedItem.subtitle}
                </div>

                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-tight">
                  {selectedItem.name}
                </h3>

                <div className="flex items-center justify-between gap-3 pt-0.5">
                  <div
                    data-testid="scooter-selected-price"
                    className="text-2xl font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap"
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
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 text-[11px] font-semibold tracking-wide cursor-pointer transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>NFT</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                </div>

                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                  {selectedItem.description}
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  {selectedItem.specs.map((sp) => (
                    <div
                      key={sp.label}
                      className="min-w-0 rounded-xl bg-[#f3f5f9] border border-slate-200/60 px-3 py-2"
                    >
                      <div className="text-[11px] text-slate-500 truncate">{sp.label}</div>
                      <div className="text-xs font-semibold text-slate-900 tabular-nums truncate mt-0.5">
                        {sp.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action & Wallet Area */}
              <div className="space-y-2.5 pt-3 border-t border-slate-100">
                {statusFeedback && (
                  <div
                    role="status"
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-medium border ${
                      statusFeedback.tone === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}
                  >
                    {statusFeedback.message}
                  </div>
                )}

                {isOwned ? (
                  <div
                    data-testid="scooter-owned-state"
                    className="w-full h-11 px-4 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-xs flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
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
                    className="w-full h-11 px-4 rounded-full bg-sky-600 hover:bg-sky-500 text-white shadow-sm font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
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
                    className={`w-full h-11 px-4 rounded-full font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
                      canAfford
                        ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/80'
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

          {/* Bottom Vehicle Selector Cards */}
          <div className="pt-1">
            <div
              role="tablist"
              aria-label="Select Urban Scooter Model"
              className="flex flex-nowrap gap-3 overflow-x-auto scroll-smooth pb-1 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-slate-200/60 [&::-webkit-scrollbar-thumb]:bg-slate-400/70 [&::-webkit-scrollbar-thumb]:rounded-full"
            >
              {URBAN_SCOOTER_CATALOG_ITEMS.map((veh) => {
                const active = veh.kind === selectedItem.kind;
                const portraitUrl = portraitByKind[veh.kind] || '';
                const vehOwned = ownedScooterIds.includes(veh.id);
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
                    className={`group shrink-0 w-[184px] sm:w-[208px] rounded-2xl p-2 bg-white border transition-all cursor-pointer flex items-center gap-2.5 text-left ${
                      active
                        ? 'border-slate-900 ring-2 ring-slate-900/10 shadow-md'
                        : 'border-slate-200/80 shadow-xs hover:shadow-sm hover:border-slate-300'
                    }`}
                  >
                    <div className="relative w-[76px] h-[58px] shrink-0 rounded-xl flex items-center justify-center overflow-hidden bg-[#f3f5f9]">
                      {portraitUrl ? (
                        <img
                          src={portraitUrl}
                          alt={veh.name}
                          referrerPolicy="no-referrer"
                          draggable={false}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-150"
                        />
                      ) : (
                        <Bike className="w-5 h-5 text-slate-400" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pr-1">
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        {veh.name}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5 truncate">
                        {vehOwned ? 'Owned' : `${veh.priceRespite} RESPITE`}
                      </div>
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
