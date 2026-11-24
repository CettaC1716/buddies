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
import { TabletDeviceMockupShell } from './TabletDeviceMockupShell';

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

export function getOrRenderScooterPortraitUrl(kind: UrbanScooterKind): string {
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
      className="fixed inset-0 z-[210] flex items-center justify-center p-2.5 sm:p-5 bg-black/25 pointer-events-auto select-none"
    >
      <TabletDeviceMockupShell
        appLabel="SCOOTER SHOWROOM"
        title="Urban Scooter Showroom"
        subtitle="Central Plaza Mobility · Exclusive NFT Vehicles · Settled in RESPITE"
        headerIcon={<Bike className="w-5 h-5" aria-hidden="true" />}
        maxWidthClass="max-w-5xl"
        heightClass="h-[min(700px,92vh)]"
        onClose={onClose}
        closeAriaLabel="Close Urban Scooter Showroom"
        closeButtonProps={{ 'data-scooter-showroom-close': 'true' }}
        headerRight={
          <div className="flex items-center gap-2 shrink-0">
            <div
              data-testid="scooter-modal-respite-balance"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-mono tabular-nums font-semibold text-white whitespace-nowrap shrink-0"
            >
              <Coins className="w-3.5 h-3.5 text-teal-400 shrink-0" aria-hidden="true" />
              <span className="font-bold text-white">
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
                className="px-3.5 py-1.5 rounded-full bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Sign In
              </button>
            )}
          </div>
        }
        subHeader={
          <div className="flex items-center justify-between gap-3 px-5 py-2.5 bg-white/[0.03] border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2 overflow-x-auto">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-white text-slate-950 shadow-xs whitespace-nowrap shrink-0">
                <Bike className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Scooters</span>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2 text-xs text-white/55 font-medium whitespace-nowrap shrink-0">
              <span>{URBAN_SCOOTER_CATALOG_ITEMS.length} NFT Vehicles</span>
            </div>
          </div>
        }
      >
        {/* Main Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Top 2-Column Featured Product Showcase */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Left Column: Fixed-Size 360° Interactive Drag-Only 3D Showcase */}
            <div className="lg:col-span-6 flex flex-col">
              <div className="rounded-2xl bg-white/[0.06] border border-white/15 shadow-sm p-2.5 flex-1 flex flex-col">
                <div
                  ref={viewportBoxRef}
                  data-testid="scooter-showroom-3d-viewport"
                  className="relative w-full h-[240px] sm:h-[300px] lg:h-[336px] shrink-0 rounded-xl bg-gradient-to-b from-[#f7f9fc] via-[#eef2f7] to-[#e4eaf2] overflow-hidden cursor-grab active:cursor-grabbing touch-none"
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
                    <span className="pointer-events-none px-3 py-1 rounded-full bg-slate-950/80 border border-white/15 text-[11px] font-medium text-white shadow-xs">
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
                            : 'bg-white/90 hover:bg-white text-slate-800 border-slate-200/80'
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
            <div className="lg:col-span-6 rounded-2xl bg-white/[0.06] border border-white/15 shadow-sm p-5 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30 text-[11px] font-semibold">
                  {selectedItem.subtitle}
                </div>

                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
                  {selectedItem.name}
                </h3>

                <div className="flex items-center justify-between gap-3 pt-0.5">
                  <div
                    data-testid="scooter-selected-price"
                    className="text-2xl font-mono font-bold text-white tabular-nums whitespace-nowrap"
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
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/90 border border-white/15 text-[11px] font-semibold tracking-wide cursor-pointer transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>NFT</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                </div>

                <p className="text-xs sm:text-sm text-white/65 leading-relaxed">
                  {selectedItem.description}
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  {selectedItem.specs.map((sp) => (
                    <div
                      key={sp.label}
                      className="min-w-0 rounded-xl bg-white/[0.05] border border-white/10 px-3 py-2"
                    >
                      <div className="text-[11px] text-white/50 truncate">{sp.label}</div>
                      <div className="text-xs font-semibold text-white tabular-nums truncate mt-0.5">
                        {sp.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action & Wallet Area */}
              <div className="space-y-2.5 pt-3 border-t border-white/10">
                {statusFeedback && (
                  <div
                    role="status"
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-medium border ${
                      statusFeedback.tone === 'success'
                        ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200'
                        : 'bg-rose-500/15 border-rose-400/35 text-rose-200'
                    }`}
                  >
                    {statusFeedback.message}
                  </div>
                )}

                {isOwned ? (
                  <div
                    data-testid="scooter-owned-state"
                    className="w-full h-11 px-4 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/35 font-semibold text-xs flex items-center justify-center gap-2 whitespace-nowrap"
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
                    className="w-full h-11 px-4 rounded-full bg-sky-500 hover:bg-sky-400 text-white shadow-sm font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
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
                        ? 'bg-sky-500 hover:bg-sky-400 text-white shadow-sm'
                        : 'bg-white/10 hover:bg-white/15 text-white/75 border border-white/15'
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
              className="flex flex-nowrap gap-3 overflow-x-auto scroll-smooth pb-1 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-thumb]:bg-white/25 [&::-webkit-scrollbar-thumb]:rounded-full"
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
                    className={`group shrink-0 w-[184px] sm:w-[208px] rounded-2xl p-2 border transition-all cursor-pointer flex items-center gap-2.5 text-left ${
                      active
                        ? 'bg-sky-500/20 border-sky-400/75 ring-1 ring-sky-400/40 shadow-md'
                        : 'bg-white/[0.06] border-white/12 hover:bg-white/[0.11] hover:border-white/25'
                    }`}
                  >
                    <div className="relative w-[76px] h-[58px] shrink-0 rounded-xl flex items-center justify-center overflow-hidden bg-[#edf2f8]">
                      {portraitUrl ? (
                        <img
                          src={portraitUrl}
                          alt={veh.name}
                          referrerPolicy="no-referrer"
                          draggable={false}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-150"
                        />
                      ) : (
                        <Bike className="w-5 h-5 text-slate-500" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pr-1">
                      <div className="text-xs font-semibold text-white truncate">
                        {veh.name}
                      </div>
                      <div
                        className={`text-[11px] font-mono tabular-nums mt-0.5 truncate ${
                          vehOwned ? 'text-emerald-300' : 'text-white/60'
                        }`}
                      >
                        {vehOwned ? 'Owned' : `${veh.priceRespite} RESPITE`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </TabletDeviceMockupShell>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
