import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import {
  ArrowRightLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  ExternalLink,
  Eye,
  Home,
  LogIn,
  PackageOpen,
  ShoppingBag,
  Sofa,
  Store,
  Tag,
  User,
  Wallet,
} from 'lucide-react';
import { TabletDeviceMockupShell } from './TabletDeviceMockupShell';
import {
  MERCHANT_CATALOG_ITEMS,
  countOwnedMerchantItems,
  evaluateMerchantItemQuote,
  type MerchantAgentMarketState,
  type MerchantCatalogItem,
} from '../game/buddiesMerchantPricing';
import { buildOriginalBuddiesCatalogFurnitureMesh } from '../game/buddiesInteriorAssets';
import { getNearBlocksNftTokenUrl } from '../game/buddiesUrbanScooterRules';
import { soundEngine } from '../game/audio';
import {
  HOUSE_OWNERSHIP_PRICE_RESPITE,
  NEAR_CONFIG,
  getLastNearTransactionError,
  getNearBlocksTxUrl,
} from '../lib/nearClient';
import type { DbPropertyListingRow } from '../lib/supabaseClient';
import {
  getProjectedGroupBounds,
  prepareFittedStudioGroup,
  renderTexturedGroupTo2dCanvas,
} from './furniture3dRasterizer';
import {
  Furniture3dThumbnail,
  THEME_VISUAL_SPECS,
  getOrRenderFurniturePortraitUrl,
} from './Furniture3dThumbnail';

export type RealEstateCatalogTabId = 'house' | 'shops' | 'furniture' | 'market';
export type HouseStyleId = 'glass_modern';

export interface RealEstateCatalogModalProps {
  isOpen: boolean;
  initialTab?: RealEstateCatalogTabId;
  onClose: () => void;
  marketState: MerchantAgentMarketState;
  respiteBalance: number;
  cyonBalance: number;
  nearTestnetBalance?: number;
  walletConnected: boolean;
  playerNearAccount?: string;
  hasHouseOwnership?: boolean;
  ownedItemIds: readonly string[];
  houseArchitectureStyle?: HouseStyleId;
  ownedHouseStyle?: HouseStyleId | null;
  onChainHouseStyleLocked?: boolean;
  propertyListings?: DbPropertyListingRow[];
  busyPropertyListingId?: string | null;
  onConnectWallet: () => void;
  onOpenWalletTopUp: () => void;
  onSelectHouseArchitectureStyle?: (style: HouseStyleId) => void;
  onViewModelHouse?: (style?: HouseStyleId) => void;
  onEnterOwnHouse?: (style?: HouseStyleId) => void;
  onBuyHouseWithRespite?: (
    priceRespite: number,
    style?: HouseStyleId,
  ) => Promise<boolean> | boolean | void;
  onBuyMerchantItem: (
    item: MerchantCatalogItem,
    price: number,
  ) => Promise<{ ok: boolean; txHash?: string; explorerUrl?: string }>;
  onCreatePropertyListing?: (input: {
    assetKind: 'house' | 'furniture';
    assetId: string;
    assetLabel: string;
    priceRespite: number;
  }) => Promise<boolean>;
  onCancelPropertyListing?: (listingId: string) => Promise<void> | void;
  onBuyPropertyListing?: (listing: DbPropertyListingRow) => Promise<boolean>;
  onCompletePropertyTransfer?: (listing: DbPropertyListingRow) => Promise<boolean>;
}

interface HouseSeriesSpec {
  readonly id: HouseStyleId;
  readonly katalogCardId: string;
  readonly tokenId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly location: string;
  readonly description: string;
  readonly exteriorImg: string;
  readonly interiorImg: string;
  readonly previewLabel: string;
  readonly specs: ReadonlyArray<{ readonly label: string; readonly value: string }>;
}

const HOUSE_SERIES_CATALOG: readonly HouseSeriesSpec[] = [
  {
    id: 'glass_modern',
    katalogCardId: 'buddies_glass_modern',
    tokenId: 'nep171:house:glass_modern',
    title: 'Glass Modern House',
    subtitle: 'NFT Property Deed · Model House',
    location: 'Glass Walls & Zen Garden',
    description:
      'Glass-walled modern house wrapped around a private zen garden with lotus pond, bamboo grove, and maple shade, plus a full private cutaway studio inside.',
    exteriorImg: '/assets/kiosk/glass_modern_exterior.jpg',
    interiorImg: '/assets/kiosk/glass_modern_interior.jpg',
    previewLabel: 'View Model House',
    specs: [
      { label: 'Plot Zoning', value: 'Private Residence Deed' },
      { label: 'Architecture', value: 'Glass Modern & Zen Garden' },
      { label: 'Studio Slots', value: '5 Custom Placements' },
      { label: 'Settlement', value: 'NEAR Testnet NFT' },
    ],
  },
] as const;

const SLOT_LABELS: Record<string, string> = {
  center_table: 'Centerpiece Floor Slot',
  left_wall: 'Left Wall Studio Slot',
  right_wall: 'Right Lounge Wall Slot',
  corner_plant: 'Courtyard Corner Slot',
  trophy_pedestal: 'Showcase Pedestal Slot',
};

const DEFAULT_YAW = 0.62;
const DEFAULT_PITCH = 0.24;
const FIXED_CAMERA_Z = 2.9;

export const RealEstateCatalogModal: React.FC<RealEstateCatalogModalProps> = ({
  isOpen,
  initialTab = 'house',
  onClose,
  marketState,
  respiteBalance,
  cyonBalance,
  nearTestnetBalance = 0,
  walletConnected,
  playerNearAccount = '',
  hasHouseOwnership = false,
  ownedItemIds,
  houseArchitectureStyle = 'glass_modern',
  ownedHouseStyle = null,
  onChainHouseStyleLocked = false,
  propertyListings = [],
  busyPropertyListingId = null,
  onConnectWallet,
  onOpenWalletTopUp,
  onSelectHouseArchitectureStyle,
  onViewModelHouse,
  onEnterOwnHouse,
  onBuyHouseWithRespite,
  onBuyMerchantItem,
  onCreatePropertyListing,
  onCancelPropertyListing,
  onBuyPropertyListing,
  onCompletePropertyTransfer,
}) => {
  const catalogShopBuildingItems = useMemo(
    () => MERCHANT_CATALOG_ITEMS.filter((item) => item.category === 'nft_shop_building'),
    [],
  );
  const catalogFurnitureItems = useMemo(
    () =>
      MERCHANT_CATALOG_ITEMS.filter(
        (item) => item.category !== 'fishing_gear' && item.category !== 'nft_shop_building',
      ),
    [],
  );

  const [activeCatalogTab, setActiveCatalogTab] = useState<RealEstateCatalogTabId>(initialTab);
  const [selectedHouseId, setSelectedHouseId] = useState<HouseStyleId>(houseArchitectureStyle);
  const [houseStageAngle, setHouseStageAngle] = useState<'exterior' | 'interior'>('exterior');
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string>(
    catalogFurnitureItems[0]?.id ?? 'tatami_tea_table',
  );

  const [isBuyingAsset, setIsBuyingAsset] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [lastTxReceipt, setLastTxReceipt] = useState<{
    txHash: string;
    explorerUrl: string;
  } | null>(null);

  // Market state
  const [houseListPrice, setHouseListPrice] = useState('40');
  const [furnitureListPrices, setFurnitureListPrices] = useState<Record<string, string>>({});
  const [marketFeedback, setMarketFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const viewportBoxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scheduleDrawRef = useRef<(() => void) | null>(null);
  const furnitureSliderRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [furnitureSliderState, setFurnitureSliderState] = useState({
    canPrev: false,
    canNext: true,
  });

  const viewStateRef = useRef({
    dragging: false,
    lastX: 0,
    lastY: 0,
    yaw: DEFAULT_YAW,
    pitch: DEFAULT_PITCH,
  });

  useEffect(() => {
    if (!isOpen) return;
    setActiveCatalogTab(initialTab);
    setSelectedHouseId(
      hasHouseOwnership && ownedHouseStyle ? ownedHouseStyle : houseArchitectureStyle,
    );
    setHouseStageAngle('exterior');
    setActionFeedback(null);
    setLastTxReceipt(null);
    setMarketFeedback(null);
    setIsBuyingAsset(false);
  }, [isOpen, initialTab, hasHouseOwnership, ownedHouseStyle, houseArchitectureStyle]);

  const selectedHouse =
    HOUSE_SERIES_CATALOG.find((h) => h.id === selectedHouseId) ?? HOUSE_SERIES_CATALOG[0];

  const selectedFurnitureItem =
    catalogFurnitureItems.find((i) => i.id === selectedFurnitureId) ??
    catalogFurnitureItems[0];

  const isSelectedTheme = Boolean(selectedFurnitureItem?.id.startsWith('theme_'));
  const selectedThemeSpec = selectedFurnitureItem
    ? THEME_VISUAL_SPECS[selectedFurnitureItem.id]
    : undefined;

  const ownedItemCounts = useMemo(() => countOwnedMerchantItems(ownedItemIds), [ownedItemIds]);

  const portraitByItemId = useMemo(() => {
    const map: Record<string, string> = {};
    if (!isOpen) return map;
    for (const item of catalogFurnitureItems) {
      map[item.id] = getOrRenderFurniturePortraitUrl(item.id);
    }
    return map;
  }, [isOpen, catalogFurnitureItems]);

  // Pre-calculate Market board collections
  const myPropertyListings = useMemo(
    () =>
      propertyListings.filter(
        (l) =>
          l.seller_account.toLowerCase() === playerNearAccount.toLowerCase() &&
          (l.status === 'active' || l.status === 'paid'),
      ),
    [propertyListings, playerNearAccount],
  );
  const myHouseListing = myPropertyListings.find((l) => l.asset_kind === 'house') ?? null;
  const listedFurnitureIds = useMemo(
    () =>
      new Set(
        myPropertyListings
          .filter((l) => l.asset_kind === 'furniture')
          .map((l) => l.asset_id),
      ),
    [myPropertyListings],
  );
  const boardListings = useMemo(
    () => propertyListings.filter((l) => l.status === 'active' || l.status === 'paid'),
    [propertyListings],
  );
  const listableNftFurniture = useMemo(
    () =>
      MERCHANT_CATALOG_ITEMS.filter(
        (item) => item.isNft && ownedItemIds.includes(item.id),
      ),
    [ownedItemIds],
  );

  // Keyboard Escape handler
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
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  // Interactive 360 drag-to-turn 3D canvas for Furniture (zero auto-spin, zero zoom buttons)
  useEffect(() => {
    if (
      !isOpen ||
      activeCatalogTab !== 'furniture' ||
      !selectedFurnitureItem ||
      isSelectedTheme
    ) {
      return;
    }

    const canvas = canvasRef.current;
    const viewportBox = viewportBoxRef.current;
    const ctx2d = canvas?.getContext('2d') ?? null;
    if (!canvas || !viewportBox || !ctx2d) return;

    const rawMesh = buildOriginalBuddiesCatalogFurnitureMesh(selectedFurnitureItem.id);
    const initialRect = viewportBox.getBoundingClientRect();
    const initialAspect = Math.max(
      1.05,
      Math.min(1.26, (initialRect.width || 480) / Math.max(1, initialRect.height || 360)),
    );
    const studioWrapper = prepareFittedStudioGroup(rawMesh, {
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

      // Subtle grounded studio shadow behind furniture geometry aligned to projected base
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
      const shRy = renderH * 0.072;
      const shCy = Math.max(
        renderH * 0.68,
        Math.min(renderH * 0.865, projBounds.maxY - shRy * 0.05),
      );
      const shRx = Math.max(
        renderW * 0.19,
        Math.min(renderW * 0.35, (projBounds.maxX - projBounds.minX) * 0.48),
      );
      ctx2d.translate(shCx, shCy);
      ctx2d.scale(shRx, shRy);
      const grad = ctx2d.createRadialGradient(0, 0, 0.08, 0, 0, 1.0);
      grad.addColorStop(0, 'rgba(15, 23, 42, 0.22)');
      grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.09)');
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

    drawFrame();

    const resizeObs =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            scheduleDraw();
          })
        : null;
    resizeObs?.observe(viewportBox);

    return () => {
      resizeObs?.disconnect();
      scheduleDrawRef.current = null;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      rawMesh.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry) {
          mesh.geometry.dispose();
        }
      });
    };
  }, [isOpen, activeCatalogTab, selectedFurnitureItem, isSelectedTheme]);

  const syncFurnitureSliderArrows = () => {
    const track = furnitureSliderRef.current;
    if (!track) return;
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    setFurnitureSliderState({
      canPrev: track.scrollLeft > 4,
      canNext: maxScroll > 4 && track.scrollLeft < maxScroll - 4,
    });
  };

  useEffect(() => {
    if (!isOpen || activeCatalogTab !== 'furniture') return;
    const track = furnitureSliderRef.current;
    if (!track) return;
    syncFurnitureSliderArrows();
    const rafId = window.requestAnimationFrame(() => syncFurnitureSliderArrows());
    const resizeObs =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => syncFurnitureSliderArrows())
        : null;
    resizeObs?.observe(track);
    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObs?.disconnect();
    };
  }, [isOpen, activeCatalogTab, catalogFurnitureItems.length]);

  if (!isOpen) return null;

  const isHouseOwned = Boolean(walletConnected && hasHouseOwnership);
  const canAffordHouse = walletConnected && respiteBalance >= HOUSE_OWNERSHIP_PRICE_RESPITE;
  const effectiveOwnedStyle = isHouseOwned
    ? ownedHouseStyle ?? houseArchitectureStyle
    : null;

  const handleSelectHouseCard = (houseId: HouseStyleId) => {
    soundEngine.playUiClick();
    setSelectedHouseId(houseId);
    setActionFeedback(null);
    const isLockedOther = Boolean(
      isHouseOwned && onChainHouseStyleLocked && effectiveOwnedStyle !== houseId,
    );
    if (!isLockedOther) {
      onSelectHouseArchitectureStyle?.(houseId);
    }
  };

  const handleSlideFurnitureStrip = (direction: -1 | 1) => {
    const track = furnitureSliderRef.current;
    if (!track) return;
    soundEngine.playSoftTap();
    const step = Math.max(220, Math.round(track.clientWidth * 0.65));
    track.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  const handleSelectFurnitureCard = (
    itemId: string,
    buttonEl?: HTMLButtonElement | null,
  ) => {
    soundEngine.playUiClick();
    setSelectedFurnitureId(itemId);
    setActionFeedback(null);
    setLastTxReceipt(null);
    viewStateRef.current.yaw = DEFAULT_YAW;
    viewStateRef.current.pitch = DEFAULT_PITCH;
    buttonEl?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  };

  const handleBuyHouseDeed = async (style: HouseStyleId) => {
    soundEngine.playUiClick();
    if (!walletConnected) {
      onConnectWallet();
      return;
    }
    if (isHouseOwned) {
      if (!onChainHouseStyleLocked) {
        onSelectHouseArchitectureStyle?.(style);
        setActionFeedback({
          ok: true,
          text: 'Updated your deed plot style to Glass Modern House.',
        });
      } else {
        const ownedLabel = 'Glass Modern House';
        setActionFeedback({
          ok: true,
          text: `You own ${ownedLabel}. Tap Go to Your House to step inside.`,
        });
      }
      return;
    }
    if (!canAffordHouse) {
      setActionFeedback({
        ok: false,
        text: `Insufficient RESPITE balance (${respiteBalance.toLocaleString()} / ${HOUSE_OWNERSHIP_PRICE_RESPITE} RESPITE).`,
      });
      return;
    }

    onSelectHouseArchitectureStyle?.(style);
    setActionFeedback(null);
    setLastTxReceipt(null);
    setIsBuyingAsset(true);
    try {
      const ok = await onBuyHouseWithRespite?.(HOUSE_OWNERSHIP_PRICE_RESPITE, style);
      if (ok) {
        soundEngine.playPickup();
        setActionFeedback({
          ok: true,
          text: 'House Deed minted! Tap Go to Your House to step inside.',
        });
      } else {
        const detail =
          getLastNearTransactionError() ||
          `Could not complete purchase. Ensure ${HOUSE_OWNERSHIP_PRICE_RESPITE} RESPITE and approve the transaction.`;
        setActionFeedback({ ok: false, text: detail });
      }
    } finally {
      setIsBuyingAsset(false);
    }
  };

  const selectedHouseIsOwnedDeed = Boolean(
    isHouseOwned && effectiveOwnedStyle === selectedHouse.id,
  );
  const selectedHouseLockedOther = Boolean(
    isHouseOwned && onChainHouseStyleLocked && !selectedHouseIsOwnedDeed,
  );
  const houseNftExplorerUrl = getNearBlocksNftTokenUrl(
    NEAR_CONFIG.nep245MultiTokenContractId,
    selectedHouse.tokenId,
    NEAR_CONFIG.network,
  );

  // Selected Furniture quote & state
  const furnitureQuote = selectedFurnitureItem
    ? evaluateMerchantItemQuote(marketState, selectedFurnitureItem)
    : null;
  const isFurnitureOwned = selectedFurnitureItem
    ? ownedItemIds.includes(selectedFurnitureItem.id)
    : false;
  const furnitureOwnedCount = selectedFurnitureItem
    ? ownedItemCounts[selectedFurnitureItem.id] ?? 0
    : 0;
  const furnitureBalance =
    selectedFurnitureItem?.currency === 'CYON' ? cyonBalance : respiteBalance;
  const furnitureNeedsHouse = Boolean(
    selectedFurnitureItem?.category === 'nft_collector_furniture' && !hasHouseOwnership,
  );
  const canAffordFurniture = Boolean(
    selectedFurnitureItem &&
      furnitureQuote &&
      furnitureBalance >= furnitureQuote.buyPrice,
  );
  const canBuyFurniture = Boolean(
    selectedFurnitureItem &&
      furnitureQuote &&
      !furnitureNeedsHouse &&
      (!isFurnitureOwned || Boolean(selectedFurnitureItem.interiorSlot)) &&
      furnitureQuote.stock > 0 &&
      canAffordFurniture &&
      (selectedFurnitureItem.currency === 'CYON' || walletConnected),
  );
  const furnitureNftExplorerUrl = selectedFurnitureItem
    ? getNearBlocksNftTokenUrl(
        NEAR_CONFIG.nep245MultiTokenContractId,
        selectedFurnitureItem.tokenId,
        NEAR_CONFIG.network,
      )
    : '';

  const handleBuySelectedFurniture = async () => {
    if (!selectedFurnitureItem || !furnitureQuote || isBuyingAsset) return;
    soundEngine.playUiClick();
    if (selectedFurnitureItem.currency === 'RESPITE' && !walletConnected) {
      onConnectWallet();
      return;
    }
    if (furnitureNeedsHouse) {
      setActionFeedback({
        ok: false,
        text: 'Buy a House Deed first before collecting NFT Furniture.',
      });
      return;
    }
    if (!canBuyFurniture) {
      if (!canAffordFurniture) {
        setActionFeedback({
          ok: false,
          text: `Need ${furnitureQuote.buyPrice} ${selectedFurnitureItem.currency} to purchase ${selectedFurnitureItem.name}.`,
        });
      }
      return;
    }

    setIsBuyingAsset(true);
    setActionFeedback(null);
    setLastTxReceipt(null);
    try {
      const res = await onBuyMerchantItem(selectedFurnitureItem, furnitureQuote.buyPrice);
      if (res.ok) {
        soundEngine.playPickup();
        if (res.txHash) {
          setLastTxReceipt({
            txHash: res.txHash,
            explorerUrl: res.explorerUrl ?? '',
          });
        }
        setActionFeedback({
          ok: true,
          text: `Bought ${selectedFurnitureItem.name} (${furnitureQuote.buyPrice} ${selectedFurnitureItem.currency}). Place it in your house studio.`,
        });
      } else {
        setActionFeedback({
          ok: false,
          text: 'Purchase failed — your balance was not charged.',
        });
      }
    } finally {
      setIsBuyingAsset(false);
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Real Estate and Furniture Catalog"
      data-realestate-catalog-modal="true"
      onClick={() => {
        soundEngine.playUiCancel();
        onClose();
      }}
      className="fixed inset-0 z-[210] flex items-center justify-center p-2.5 sm:p-5 bg-black/25 pointer-events-auto select-none"
    >
      <TabletDeviceMockupShell
        appLabel="ESTATE STUDIO"
        title="Real Estate & Interior Studio Catalog"
        subtitle="Central Plaza Agency · Private House Deeds, Collector Furniture & Property Market"
        headerIcon={<Home className="w-5 h-5" aria-hidden="true" />}
        maxWidthClass="max-w-5xl"
        heightClass="h-[min(700px,92vh)]"
        onClose={onClose}
        closeAriaLabel="Close Real Estate Catalog"
        closeButtonProps={{ 'data-realestate-catalog-close': 'true' }}
        headerRight={
          <div className="flex items-center gap-2 shrink-0">
            <div
              data-testid="catalog-modal-respite-balance"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-mono tabular-nums font-semibold text-white whitespace-nowrap shrink-0"
            >
              <Coins className="w-3.5 h-3.5 text-teal-400 shrink-0" aria-hidden="true" />
              <span className="font-bold text-white">
                {respiteBalance.toLocaleString()} RESPITE
              </span>
              <span className="text-white/35" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-sky-300">
                {cyonBalance.toLocaleString()} CYON
              </span>
            </div>

            {!walletConnected && (
              <button
                type="button"
                data-catalog-signin-btn="true"
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
          <div
            role="tablist"
            aria-label="Hana Property Catalog Categories"
            data-hana-catalog-tabs="true"
            className="flex items-center justify-between gap-3 px-5 py-2.5 bg-white/[0.03] border-b border-white/10 shrink-0"
          >
            <div className="flex items-center gap-2 overflow-x-auto">
              {(
                [
                  { id: 'house', label: 'House', Icon: Home },
                  { id: 'shops', label: `Shop Buildings (${catalogShopBuildingItems.length})`, Icon: Store },
                  { id: 'furniture', label: 'Furniture', Icon: Sofa },
                  {
                    id: 'market',
                    label:
                      boardListings.length > 0 ? `Market (${boardListings.length})` : 'Market',
                    Icon: Tag,
                  },
                ] as const
              ).map((tab) => {
                const active = activeCatalogTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-hana-catalog-tab={tab.id}
                    onClick={() => {
                      soundEngine.playUiClick();
                      setActionFeedback(null);
                      setActiveCatalogTab(tab.id);
                    }}
                    className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'bg-white/10 hover:bg-white/15 text-white/75 border border-white/15'
                    }`}
                  >
                    <tab.Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="hidden md:flex items-center gap-2 text-xs text-white/55 font-medium whitespace-nowrap shrink-0">
              <span>
                {activeCatalogTab === 'house'
                  ? `${HOUSE_SERIES_CATALOG.length} Architectural Deeds`
                  : activeCatalogTab === 'shops'
                    ? `${catalogShopBuildingItems.length} Shop Building Forms`
                    : activeCatalogTab === 'furniture'
                      ? `${catalogFurnitureItems.length} Studio Items`
                      : `${boardListings.length} Active Listings`}
              </span>
            </div>
          </div>
        }
      >
        {/* Main Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* ===============================================================
              TAB: SHOP BUILDINGS (3 Neutral Building Forms + Real Renders)
             =============================================================== */}
          {activeCatalogTab === 'shops' && (
            <div data-catalog-shop-buildings-panel="true" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div>
                  <h3 className="text-lg font-bold text-white">Shop Buildings</h3>
                  <p className="text-xs text-white/65">
                    Own a building form and place it on any rented city lot. Empty neutral interior with customizable rooftop sign.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-[11px] font-semibold text-emerald-300">
                  Lot Rent: 50 RESPITE / 30 days
                </span>
              </div>

              {actionFeedback && (
                <div
                  className={`rounded-xl px-3.5 py-2 text-xs font-medium border ${
                    actionFeedback.ok
                      ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200'
                      : 'bg-rose-500/15 border-rose-400/35 text-rose-200'
                  }`}
                >
                  {actionFeedback.text}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {catalogShopBuildingItems.map((item) => {
                  const ownedQty = countOwnedMerchantItems(ownedItemIds)[item.id] ?? 0;
                  const canAfford = respiteBalance >= item.basePrice;
                  return (
                    <div
                      key={item.id}
                      data-shop-building-card={item.id}
                      className="rounded-2xl bg-white/[0.06] border border-white/15 overflow-hidden flex flex-col justify-between shadow-sm"
                    >
                      <div>
                        <div className="relative aspect-square bg-[#eef2f7] overflow-hidden">
                          {item.renderImagePath && (
                            <img
                              src={item.renderImagePath}
                              alt={item.name}
                              draggable={false}
                              className="w-full h-full object-contain p-2 select-none"
                            />
                          )}
                          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-900/80 text-white text-[10px] font-semibold">
                              Shop Building
                            </span>
                            {item.footprintLabel && (
                              <span className="px-2 py-0.5 rounded-full bg-white/90 text-slate-800 text-[10px] font-semibold">
                                {item.footprintLabel}
                              </span>
                            )}
                          </div>
                          {ownedQty > 0 && (
                            <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                              Owned ×{ownedQty}
                            </span>
                          )}
                        </div>

                        <div className="p-4 space-y-2">
                          <h4 className="text-base font-bold text-white leading-snug">
                            {item.name}
                          </h4>
                          <p className="text-xs text-white/65 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      <div className="px-4 pb-4 pt-2 flex items-center justify-between gap-2 border-t border-white/10">
                        <div className="text-base font-mono font-bold text-white tabular-nums">
                          {item.basePrice} RESPITE
                        </div>
                        <button
                          type="button"
                          disabled={isBuyingAsset || (!walletConnected ? false : !canAfford)}
                          onClick={() => {
                            soundEngine.playUiClick();
                            if (!walletConnected) {
                              onConnectWallet();
                              return;
                            }
                            void (async () => {
                              setIsBuyingAsset(true);
                              setActionFeedback(null);
                              try {
                                const res = await onBuyMerchantItem(item, item.basePrice);
                                setActionFeedback({
                                  ok: res.ok,
                                  text: res.ok
                                    ? `Purchased ${item.name}! Find it in My Things → Properties.`
                                    : 'Could not complete purchase.',
                                });
                              } finally {
                                setIsBuyingAsset(false);
                              }
                            })();
                          }}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                            !walletConnected
                              ? 'bg-sky-500 hover:bg-sky-400 text-white'
                              : canAfford && !isBuyingAsset
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                                : 'bg-white/10 text-white/40 cursor-not-allowed'
                          }`}
                        >
                          {!walletConnected
                            ? 'Connect Wallet'
                            : isBuyingAsset
                              ? 'Buying...'
                              : 'Buy Building'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===============================================================
              TAB 1: HOUSE DEEDS (Clean Bento Property Card + Bottom Selector Strip)
             =============================================================== */}
          {activeCatalogTab === 'house' && (
            <div data-catalog-house-and-family-panel="true" className="space-y-4">
              {/* Top 2-Column Featured Property Showcase */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                {/* Left Column: Architectural Exterior / Interior Hero Card */}
                <div className="lg:col-span-6 flex flex-col">
                  <div className="rounded-2xl bg-white/[0.06] border border-white/15 shadow-sm p-2.5 flex-1 flex flex-col">
                    <div className="relative w-full h-[240px] sm:h-[300px] lg:h-[336px] shrink-0 rounded-xl bg-slate-900 overflow-hidden">
                      <img
                        src={
                          houseStageAngle === 'exterior'
                            ? selectedHouse.exteriorImg
                            : selectedHouse.interiorImg
                        }
                        alt={`${selectedHouse.title} (${houseStageAngle})`}
                        referrerPolicy="no-referrer"
                        draggable={false}
                        className="absolute inset-0 w-full h-full object-cover select-none"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/75 via-slate-950/25 to-transparent pointer-events-none" />
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                        <span className="px-3 py-1 rounded-full bg-slate-950/75 border border-white/15 text-[11px] font-medium text-white truncate">
                          {selectedHouse.location} ·{' '}
                          {houseStageAngle === 'exterior' ? 'Exterior Elevation' : 'Interior Studio'}
                        </span>
                        <div className="flex items-center gap-1 p-0.5 rounded-full bg-slate-950/75 border border-white/15 shrink-0">
                          {(['exterior', 'interior'] as const).map((angle) => (
                            <button
                              key={angle}
                              type="button"
                              data-house-stage-angle={angle}
                              onClick={() => {
                                soundEngine.playUiClick();
                                setHouseStageAngle(angle);
                              }}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                                houseStageAngle === angle
                                  ? 'bg-white text-slate-900 shadow-xs'
                                  : 'text-white/80 hover:text-white'
                              }`}
                            >
                              {angle}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Bento Property Purchase & Specs Card */}
                <div
                  data-buy-house-section="true"
                  className="lg:col-span-6 rounded-2xl bg-white/[0.06] border border-white/15 shadow-sm p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center flex-wrap gap-1.5 text-[11px]">
                      <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30 font-semibold">
                        {selectedHouse.subtitle}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/10 font-medium">
                        {selectedHouse.location}
                      </span>
                    </div>

                    <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
                      {selectedHouse.title}
                    </h3>

                    <div className="flex items-center justify-between gap-3 pt-0.5">
                      <div
                        data-testid="catalog-selected-house-price"
                        className={`text-2xl font-mono font-bold tabular-nums whitespace-nowrap ${
                          selectedHouseIsOwnedDeed ? 'text-emerald-300' : 'text-white'
                        }`}
                      >
                        {selectedHouseIsOwnedDeed
                          ? 'Owned Deed'
                          : `${HOUSE_OWNERSHIP_PRICE_RESPITE} RESPITE`}
                      </div>
                      <a
                        href={houseNftExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`View ${selectedHouse.title} NFT on NEAR Explorer`}
                        onClick={() => soundEngine.playSoftTap()}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/90 border border-white/15 text-[11px] font-semibold tracking-wide cursor-pointer transition-colors whitespace-nowrap shrink-0"
                      >
                        <span>NFT</span>
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>
                    </div>

                    <p className="text-xs sm:text-sm text-white/65 leading-relaxed">
                      {selectedHouse.description}
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {selectedHouse.specs.map((sp) => (
                        <div
                          key={sp.label}
                          className="min-w-0 rounded-xl bg-white/[0.05] border border-white/10 px-3 py-2"
                        >
                          <div className="text-[11px] text-white/50 truncate">{sp.label}</div>
                          <div className="text-xs font-semibold text-white truncate mt-0.5">
                            {sp.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-3 border-t border-white/10">
                    {actionFeedback && (
                      <div
                        role="status"
                        className={`px-3.5 py-2.5 rounded-xl text-xs font-medium border ${
                          actionFeedback.ok
                            ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200'
                            : 'bg-rose-500/15 border-rose-400/35 text-rose-200'
                        }`}
                      >
                        {actionFeedback.text}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {selectedHouseIsOwnedDeed && onEnterOwnHouse ? (
                        <button
                          type="button"
                          data-catalog-go-your-house-btn="true"
                          onClick={() => {
                            soundEngine.playUiClick();
                            onClose();
                            onEnterOwnHouse(selectedHouse.id);
                          }}
                          className="h-11 px-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white shadow-sm font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
                        >
                          <Home className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>Go to Your House</span>
                        </button>
                      ) : onViewModelHouse ? (
                        <button
                          type="button"
                          data-catalog-view-model-house-btn="true"
                          onClick={() => {
                            soundEngine.playUiClick();
                            onClose();
                            onViewModelHouse(selectedHouse.id);
                          }}
                          className="h-11 px-4 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 shadow-xs font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
                        >
                          <Eye className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
                          <span>{selectedHouse.previewLabel}</span>
                        </button>
                      ) : null}

                      {!walletConnected ? (
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playUiClick();
                            onConnectWallet();
                          }}
                          className="h-11 px-4 rounded-full bg-sky-500 hover:bg-sky-400 text-white shadow-sm font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
                        >
                          <Wallet className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>Connect Wallet to Buy</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          data-buy-house-btn="true"
                          disabled={
                            isBuyingAsset ||
                            selectedHouseLockedOther ||
                            (!isHouseOwned && !canAffordHouse)
                          }
                          onClick={() => void handleBuyHouseDeed(selectedHouse.id)}
                          className={`h-11 px-4 rounded-full font-semibold text-xs flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                            selectedHouseIsOwnedDeed
                              ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/35 cursor-pointer'
                              : selectedHouseLockedOther
                                ? 'bg-white/[0.06] text-white/40 border border-white/10 cursor-not-allowed'
                                : isHouseOwned
                                  ? 'bg-sky-500 hover:bg-sky-400 text-white shadow-sm cursor-pointer'
                                  : canAffordHouse && !isBuyingAsset
                                    ? 'bg-sky-500 hover:bg-sky-400 text-white shadow-sm cursor-pointer'
                                    : 'bg-white/[0.06] text-white/40 border border-white/10 cursor-not-allowed'
                          }`}
                        >
                          {selectedHouseIsOwnedDeed ? (
                            <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                          ) : (
                            <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden="true" />
                          )}
                          <span>
                            {isBuyingAsset
                              ? 'Signing...'
                              : selectedHouseIsOwnedDeed
                                ? 'Owned'
                                : selectedHouseLockedOther
                                  ? '1 Deed Owned'
                                  : isHouseOwned
                                    ? 'Select Style'
                                    : `Buy Deed · ${HOUSE_OWNERSHIP_PRICE_RESPITE} R`}
                          </span>
                        </button>
                      )}
                    </div>

                    {walletConnected && !isHouseOwned && !canAffordHouse && (
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          onClose();
                          onOpenWalletTopUp();
                        }}
                        className="w-full h-9 px-3.5 rounded-full bg-teal-500/15 hover:bg-teal-500/25 text-teal-200 border border-teal-400/30 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                      >
                        <Coins className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {nearTestnetBalance >= 0.25
                            ? `Need ${HOUSE_OWNERSHIP_PRICE_RESPITE} RESPITE? Open Wallet to Swap NEAR → RESPITE`
                            : 'Open Wallet & Swap NEAR → RESPITE'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Single-Row Selectable Property Cards Strip */}
              <div className="pt-1">
                <div
                  className="flex flex-nowrap gap-3 overflow-x-auto scroll-smooth pb-1 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-thumb]:bg-white/25 [&::-webkit-scrollbar-thumb]:rounded-full"
                  data-hana-house-architecture-grid="true"
                >
                  {HOUSE_SERIES_CATALOG.map((house) => {
                    const isActiveCard = selectedHouse.id === house.id;
                    const houseOwned = Boolean(isHouseOwned && effectiveOwnedStyle === house.id);
                    return (
                      <button
                        key={house.id}
                        type="button"
                        aria-label={house.title}
                        title={house.title}
                        data-katalog-card={house.katalogCardId}
                        data-house-style-card={house.id}
                        onClick={() => handleSelectHouseCard(house.id)}
                        className={`group shrink-0 w-[212px] sm:w-[232px] rounded-2xl p-2 border transition-all cursor-pointer flex items-center gap-3 text-left ${
                          isActiveCard
                            ? 'bg-sky-500/20 border-sky-400/75 ring-1 ring-sky-400/40 shadow-md'
                            : 'bg-white/[0.06] border-white/12 hover:bg-white/[0.11] hover:border-white/25'
                        }`}
                      >
                        <div className="w-[78px] h-[58px] shrink-0 rounded-xl overflow-hidden bg-slate-900">
                          <img
                            src={house.exteriorImg}
                            alt={house.title}
                            referrerPolicy="no-referrer"
                            draggable={false}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-150"
                          />
                        </div>
                        <div className="min-w-0 flex-1 pr-1">
                          <div className="text-xs font-semibold text-white truncate">
                            {house.title}
                          </div>
                          <div className="text-[11px] text-white/55 truncate mt-0.5">
                            {house.location}
                          </div>
                          <div
                            className={`text-[11px] font-mono tabular-nums font-semibold mt-0.5 truncate ${
                              houseOwned ? 'text-emerald-300' : 'text-white/80'
                            }`}
                          >
                            {houseOwned ? 'Owned Deed' : `${HOUSE_OWNERSHIP_PRICE_RESPITE} RESPITE`}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ===============================================================
              TAB 2: FURNITURE & THEMES (Bento Stage + Horizontal Sliding Strip)
             =============================================================== */}
          {activeCatalogTab === 'furniture' && selectedFurnitureItem && furnitureQuote && (
            <div data-catalog-hana-furniture-panel="true" className="space-y-4">
              {/* Top 2-Column Featured Product Stage + Purchase Details */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                {/* Left Column: 360 Interactive Drag-Only 3D Showcase or Theme Art */}
                <div className="lg:col-span-6 flex flex-col">
                  <div className="rounded-2xl bg-white/[0.06] border border-white/15 shadow-sm p-2.5 flex-1 flex flex-col">
                    {isSelectedTheme && selectedThemeSpec ? (
                      <div className="relative w-full h-[240px] sm:h-[300px] lg:h-[336px] shrink-0 rounded-xl overflow-hidden bg-slate-900 flex flex-col justify-end">
                        <img
                          src={selectedThemeSpec.imageSrc}
                          alt={selectedFurnitureItem.name}
                          referrerPolicy="no-referrer"
                          draggable={false}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div
                          className={`absolute inset-0 bg-gradient-to-br ${selectedThemeSpec.overlayClass}`}
                        />
                        <div className="relative z-10 m-3 px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 bg-slate-950/75 border border-white/15">
                          <span className="text-xs font-medium text-white">
                            House Theme Architectural Palette
                          </span>
                          <div className="flex items-center gap-1.5">
                            {selectedThemeSpec.swatches.map((hex) => (
                              <span
                                key={hex}
                                title={hex}
                                className="w-4 h-4 rounded-full border border-white/75 inline-block shadow-xs"
                                style={{ backgroundColor: hex }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : selectedFurnitureItem.renderImagePath ? (
                      <div
                        data-testid="catalog-shop-building-render"
                        className="relative w-full h-[240px] sm:h-[300px] lg:h-[336px] shrink-0 rounded-xl bg-gradient-to-b from-[#dceafa] via-[#e8f1fa] to-[#cbd5e1] overflow-hidden flex items-center justify-center"
                      >
                        <img
                          src={selectedFurnitureItem.renderImagePath}
                          alt={selectedFurnitureItem.name}
                          className="w-full h-full object-contain"
                          draggable={false}
                        />
                        {selectedFurnitureItem.footprintLabel && (
                          <div className="pointer-events-none absolute bottom-3 left-3">
                            <span className="px-2.5 py-1 rounded-full bg-slate-950/80 border border-white/15 text-[11px] font-semibold text-white">
                              {selectedFurnitureItem.footprintLabel}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        ref={viewportBoxRef}
                        data-testid="catalog-furniture-3d-viewport"
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
                            -0.25,
                            Math.min(0.68, viewStateRef.current.pitch + dy * 0.008),
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
                          data-testid="catalog-furniture-3d-canvas"
                          className="absolute inset-0 w-full h-full block"
                        />
                        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                          <span className="px-3 py-1 rounded-full bg-slate-950/80 border border-white/15 text-[11px] font-medium text-white shadow-xs">
                            ‹ drag to turn it around ›
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Bento Card with Category Kicker, Title, Price, Specs & Buy Controls */}
                <div className="lg:col-span-6 rounded-2xl bg-white/[0.06] border border-white/15 shadow-sm p-5 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center flex-wrap gap-1.5 text-[11px]">
                      <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30 font-semibold">
                        {selectedFurnitureItem.category === 'nft_shop_building'
                          ? 'Shop Building'
                          : selectedFurnitureItem.category === 'nft_house_theme'
                            ? 'House Theme'
                            : 'Furniture'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/10 font-medium">
                        {selectedFurnitureItem.footprintLabel
                          ? selectedFurnitureItem.footprintLabel
                          : selectedFurnitureItem.interiorSlot
                            ? SLOT_LABELS[selectedFurnitureItem.interiorSlot] ?? 'Interior Slot'
                            : 'Full Interior & Exterior'}
                      </span>
                    </div>

                    <h3
                      data-testid="catalog-selected-furniture-title"
                      className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight"
                    >
                      {selectedFurnitureItem.name}
                    </h3>

                    <div className="flex items-center justify-between gap-3 pt-0.5">
                      <div
                        data-testid="catalog-selected-furniture-price"
                        className="text-2xl font-mono font-bold text-white tabular-nums whitespace-nowrap"
                      >
                        {furnitureQuote.buyPrice}{' '}
                        {selectedFurnitureItem.currency === 'RESPITE'
                          ? 'RESPITE'
                          : selectedFurnitureItem.currency}
                      </div>

                      {selectedFurnitureItem.isNft && (
                        <a
                          href={furnitureNftExplorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`View ${selectedFurnitureItem.name} NFT on NEAR Explorer`}
                          onClick={() => soundEngine.playSoftTap()}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/90 border border-white/15 text-[11px] font-semibold tracking-wide cursor-pointer transition-colors whitespace-nowrap shrink-0"
                        >
                          <span>NFT</span>
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm text-white/65 leading-relaxed">
                      {selectedFurnitureItem.description}
                    </p>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div className="min-w-0 rounded-xl bg-white/[0.05] border border-white/10 px-3 py-2">
                        <div className="text-[11px] text-white/50 truncate">In Stock</div>
                        <div className="text-xs font-semibold text-white tabular-nums mt-0.5">
                          {furnitureQuote.stock} available
                        </div>
                      </div>
                      <div className="min-w-0 rounded-xl bg-white/[0.05] border border-white/10 px-3 py-2">
                        <div className="text-[11px] text-white/50 truncate">Your Bag</div>
                        <div className="text-xs font-semibold text-white tabular-nums mt-0.5">
                          {isFurnitureOwned ? `${Math.max(1, furnitureOwnedCount)} owned` : '0 owned'}
                        </div>
                      </div>
                      <div className="min-w-0 rounded-xl bg-white/[0.05] border border-white/10 px-3 py-2">
                        <div className="text-[11px] text-white/50 truncate">Currency</div>
                        <div className="text-xs font-semibold text-teal-300 mt-0.5">
                          {selectedFurnitureItem.currency}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-3 border-t border-white/10">
                    {actionFeedback && (
                      <div
                        role="status"
                        className={`px-3.5 py-2.5 rounded-xl text-xs font-medium border ${
                          actionFeedback.ok
                            ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200'
                            : 'bg-rose-500/15 border-rose-400/35 text-rose-200'
                        }`}
                      >
                        {actionFeedback.text}
                      </div>
                    )}

                    {lastTxReceipt && (
                      <div
                        data-catalog-buy-receipt="true"
                        className="px-3.5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/35 text-xs font-medium text-emerald-200 flex items-center justify-between gap-2"
                      >
                        <span>Transaction confirmed</span>
                        <a
                          href={
                            lastTxReceipt.explorerUrl ||
                            getNearBlocksTxUrl(lastTxReceipt.txHash, 'testnet')
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-300 hover:text-sky-200 underline font-mono"
                        >
                          View Tx on NearBlocks ↗
                        </a>
                      </div>
                    )}

                    {selectedFurnitureItem.currency === 'RESPITE' && !walletConnected ? (
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          onConnectWallet();
                        }}
                        className="w-full h-11 px-4 rounded-full bg-sky-500 hover:bg-sky-400 text-white shadow-sm font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
                      >
                        <Wallet className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>
                          Connect Wallet to Buy ({furnitureQuote.buyPrice}{' '}
                          {selectedFurnitureItem.currency})
                        </span>
                      </button>
                    ) : furnitureNeedsHouse ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          disabled
                          className="h-11 px-4 rounded-full bg-white/[0.06] text-white/40 border border-white/10 text-xs font-semibold flex items-center justify-center gap-2 cursor-not-allowed whitespace-nowrap"
                        >
                          <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>Needs a House Deed</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playUiClick();
                            setActiveCatalogTab('house');
                          }}
                          className="h-11 px-4 rounded-full bg-sky-500 hover:bg-sky-400 text-white shadow-sm font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
                        >
                          <Home className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>Browse Houses</span>
                        </button>
                      </div>
                    ) : isFurnitureOwned && !selectedFurnitureItem.interiorSlot ? (
                      <div className="w-full h-11 px-4 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/35 font-semibold text-xs flex items-center justify-center gap-2 whitespace-nowrap">
                        <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>Owned in Studio · Ready to Apply</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        data-buy-furniture-btn={selectedFurnitureItem.id}
                        disabled={!canBuyFurniture || isBuyingAsset}
                        onClick={() => void handleBuySelectedFurniture()}
                        className={`w-full h-11 px-4 rounded-full font-semibold text-xs flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                          canBuyFurniture && !isBuyingAsset
                            ? 'bg-sky-500 hover:bg-sky-400 text-white shadow-sm cursor-pointer'
                            : 'bg-white/[0.06] text-white/40 border border-white/10 cursor-not-allowed'
                        }`}
                      >
                        <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>
                          {isBuyingAsset
                            ? 'Confirming Transaction...'
                            : furnitureQuote.stock <= 0
                              ? 'Out of Stock'
                              : isFurnitureOwned
                                ? `Buy Another (+1) · ${furnitureQuote.buyPrice} ${selectedFurnitureItem.currency}`
                                : `Buy · ${furnitureQuote.buyPrice} ${selectedFurnitureItem.currency}`}
                        </span>
                      </button>
                    )}

                    {walletConnected && !furnitureNeedsHouse && !canAffordFurniture && (
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          onClose();
                          onOpenWalletTopUp();
                        }}
                        className="w-full h-9 px-3.5 rounded-full bg-teal-500/15 hover:bg-teal-500/25 text-teal-200 border border-teal-400/30 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                      >
                        <Coins className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          Need {selectedFurnitureItem.currency}? Open Wallet to Swap NEAR → RESPITE
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Single-Row Horizontal Sliding Product Strip */}
              <div className="pt-1">
                <div
                  data-catalog-furniture-slider-wrapper="true"
                  className="flex items-center gap-2"
                >
                  <button
                    type="button"
                    aria-label="Slide products left"
                    data-catalog-slider-prev="true"
                    disabled={!furnitureSliderState.canPrev}
                    onClick={() => handleSlideFurnitureStrip(-1)}
                    className={`w-9 h-[86px] rounded-2xl border flex items-center justify-center shrink-0 transition-colors ${
                      furnitureSliderState.canPrev
                        ? 'bg-white/10 hover:bg-white/20 text-white border-white/15 shadow-xs cursor-pointer'
                        : 'bg-white/[0.03] text-white/25 border-white/10 cursor-not-allowed'
                    }`}
                  >
                    <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                  </button>

                  <div
                    ref={furnitureSliderRef}
                    data-catalog-furniture-slider="true"
                    onScroll={syncFurnitureSliderArrows}
                    onWheel={(e) => {
                      const track = furnitureSliderRef.current;
                      if (!track) return;
                      if (
                        track.scrollWidth > track.clientWidth &&
                        Math.abs(e.deltaY) > Math.abs(e.deltaX)
                      ) {
                        track.scrollLeft += e.deltaY;
                      }
                    }}
                    className="flex-1 flex flex-nowrap gap-2.5 overflow-x-auto scroll-smooth pb-1.5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-thumb]:bg-white/25 [&::-webkit-scrollbar-thumb]:rounded-full"
                  >
                    {catalogFurnitureItems.map((item) => {
                      const isActive = selectedFurnitureItem.id === item.id;
                      const portraitUrl = portraitByItemId[item.id] || '';
                      const themeSpec = THEME_VISUAL_SPECS[item.id];

                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-label={item.name}
                          title={item.name}
                          data-catalog-furniture-card={item.id}
                          onClick={(e) =>
                            handleSelectFurnitureCard(item.id, e.currentTarget)
                          }
                          className={`group shrink-0 w-[112px] sm:w-[124px] h-[86px] p-1.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-center ${
                            isActive
                              ? 'bg-sky-500/20 border-sky-400/75 ring-1 ring-sky-400/40 shadow-md'
                              : 'bg-white/[0.06] border-white/12 hover:bg-white/[0.11] hover:border-white/25'
                          }`}
                        >
                          <div className="relative w-full h-full rounded-xl flex items-center justify-center overflow-hidden bg-[#edf2f8]">
                            {portraitUrl ? (
                              <img
                                src={portraitUrl}
                                alt={item.name}
                                referrerPolicy="no-referrer"
                                draggable={false}
                                className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-150"
                              />
                            ) : themeSpec ? (
                              <>
                                <img
                                  src={themeSpec.imageSrc}
                                  alt={item.name}
                                  referrerPolicy="no-referrer"
                                  draggable={false}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-150"
                                />
                                <div
                                  className={`absolute inset-0 bg-gradient-to-br ${themeSpec.overlayClass}`}
                                />
                                <themeSpec.Icon
                                  className="relative z-10 w-5 h-5"
                                  style={{ color: themeSpec.accentHex }}
                                  aria-hidden="true"
                                />
                              </>
                            ) : (
                              <span className="text-lg font-semibold text-slate-600">
                                {item.iconEmoji || '◆'}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    aria-label="Slide products right"
                    data-catalog-slider-next="true"
                    disabled={!furnitureSliderState.canNext}
                    onClick={() => handleSlideFurnitureStrip(1)}
                    className={`w-9 h-[86px] rounded-2xl border flex items-center justify-center shrink-0 transition-colors ${
                      furnitureSliderState.canNext
                        ? 'bg-white/10 hover:bg-white/20 text-white border-white/15 shadow-xs cursor-pointer'
                        : 'bg-white/[0.03] text-white/25 border-white/10 cursor-not-allowed'
                    }`}
                  >
                    <ChevronRight className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===============================================================
              TAB 3: PROPERTY MARKET (Clean Bento P2P Escrow Listings)
             =============================================================== */}
          {activeCatalogTab === 'market' && (
            <div data-property-market-panel="true" className="space-y-5">
              <div className="rounded-2xl bg-white/[0.06] border border-white/15 shadow-sm px-4 py-3.5 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-base font-bold tracking-tight text-white">
                    Secondary Property &amp; Furniture Market
                  </h3>
                  <p className="text-xs text-white/60 mt-0.5">
                    List owned House Deeds or Collector NFT Furniture in escrow, or buy from fellow citizens in RESPITE.
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs text-white/75 whitespace-nowrap">
                  <span>List</span>
                  <span aria-hidden="true" className="text-white/40">→</span>
                  <span>Escrow Pay</span>
                  <span aria-hidden="true" className="text-white/40">→</span>
                  <span className="text-emerald-300 font-semibold">Instant Transfer</span>
                </div>
              </div>

              {marketFeedback && (
                <div
                  role="status"
                  className={`px-3.5 py-2.5 rounded-xl border text-xs font-medium ${
                    marketFeedback.ok
                      ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200'
                      : 'bg-rose-500/15 border-rose-400/35 text-rose-200'
                  }`}
                >
                  {marketFeedback.text}
                </div>
              )}

              {/* Sell Your Assets */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/65">
                  <Tag className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                  <span>Sell Your Assets</span>
                </div>

                {!walletConnected ? (
                  <div className="p-3.5 rounded-2xl bg-white/[0.06] border border-white/15 shadow-sm flex items-center justify-between gap-3 text-xs font-medium text-white/75">
                    <div className="flex items-center gap-2">
                      <LogIn className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
                      <span>Sign in with your NEAR wallet to list or buy properties.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        onConnectWallet();
                      }}
                      className="px-4 py-1.5 rounded-full bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0"
                    >
                      Sign In
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {hasHouseOwnership && !myHouseListing && (
                      <div
                        className="p-3 rounded-2xl bg-white/[0.06] border border-white/15 shadow-sm flex items-center gap-3 flex-wrap sm:flex-nowrap"
                        data-property-list-house="true"
                      >
                        <div className="w-16 h-12 shrink-0 rounded-xl overflow-hidden bg-slate-900">
                          <img
                            src="/assets/kiosk/house_exterior.jpg"
                            alt="Private House Deed"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                            draggable={false}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold truncate text-white">
                            Private House Deed
                          </div>
                          <div className="text-[11px] text-white/55">NEP-171 Property Deed</div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            value={houseListPrice}
                            onChange={(e) =>
                              setHouseListPrice(e.target.value.replace(/[^0-9]/g, ''))
                            }
                            inputMode="numeric"
                            aria-label="House listing price in RESPITE"
                            className="w-16 px-2.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-mono font-semibold text-white text-right tabular-nums focus:outline-none focus:border-sky-400"
                          />
                          <span className="text-xs font-semibold text-white/60">R</span>
                          <button
                            type="button"
                            disabled={busyPropertyListingId !== null}
                            onClick={async () => {
                              const price = parseInt(houseListPrice || '0', 10);
                              if (!Number.isFinite(price) || price < 1) {
                                setMarketFeedback({
                                  ok: false,
                                  text: 'Enter a price ≥ 1 RESPITE.',
                                });
                                return;
                              }
                              const ok = await onCreatePropertyListing?.({
                                assetKind: 'house',
                                assetId: '',
                                assetLabel: 'Private House Deed',
                                priceRespite: price,
                              });
                              setMarketFeedback(
                                ok
                                  ? {
                                      ok: true,
                                      text: `House listed for ${price} RESPITE.`,
                                    }
                                  : {
                                      ok: false,
                                      text: 'Could not list your house.',
                                    },
                              );
                            }}
                            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold cursor-pointer transition-colors disabled:bg-white/10 disabled:text-white/40"
                          >
                            <Tag className="w-3 h-3" aria-hidden="true" />
                            <span>List</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {hasHouseOwnership && myHouseListing && (
                      <div className="px-3.5 py-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-400/35 text-xs font-semibold text-emerald-200 flex items-center gap-2">
                        <Home className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                        <span>
                          {myHouseListing.status === 'paid'
                            ? 'House paid — click Transfer below'
                            : `House listed · ${myHouseListing.price_respite} RESPITE`}
                        </span>
                      </div>
                    )}

                    {listableNftFurniture.map((item) => {
                      const listed = listedFurnitureIds.has(item.id);
                      return (
                        <div
                          key={item.id}
                          className="p-3 rounded-2xl bg-white/[0.06] border border-white/15 shadow-sm flex items-center gap-3 flex-wrap sm:flex-nowrap"
                          data-property-list-furniture={item.id}
                        >
                          <div className="w-16 shrink-0 rounded-xl overflow-hidden bg-[#edf2f8]">
                            <Furniture3dThumbnail
                              catalogId={item.id}
                              name={item.name}
                              iconEmoji={item.iconEmoji}
                              compact
                              onInspect={() => {
                                setActiveCatalogTab('furniture');
                                handleSelectFurnitureCard(item.id);
                              }}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold truncate text-white">
                              {item.name}
                            </div>
                            <div className="text-[11px] text-sky-300 font-medium">Collector NFT</div>
                          </div>
                          {listed ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/35 text-xs font-semibold">
                              <Check className="w-3 h-3" aria-hidden="true" />
                              <span>Listed</span>
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <input
                                value={furnitureListPrices[item.id] ?? '20'}
                                onChange={(e) =>
                                  setFurnitureListPrices((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.value.replace(/[^0-9]/g, ''),
                                  }))
                                }
                                inputMode="numeric"
                                aria-label={`Listing price for ${item.name} in RESPITE`}
                                className="w-16 px-2.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-mono font-semibold text-white text-right tabular-nums focus:outline-none focus:border-sky-400"
                              />
                              <span className="text-xs font-semibold text-white/60">R</span>
                              <button
                                type="button"
                                disabled={busyPropertyListingId !== null}
                                onClick={async () => {
                                  const price = parseInt(
                                    furnitureListPrices[item.id] || '0',
                                    10,
                                  );
                                  if (!Number.isFinite(price) || price < 1) {
                                    setMarketFeedback({
                                      ok: false,
                                      text: 'Enter a price ≥ 1 RESPITE.',
                                    });
                                    return;
                                  }
                                  const ok = await onCreatePropertyListing?.({
                                    assetKind: 'furniture',
                                    assetId: item.id,
                                    assetLabel: item.name,
                                    priceRespite: price,
                                  });
                                  setMarketFeedback(
                                    ok
                                      ? {
                                          ok: true,
                                          text: `${item.name} listed (${price} R).`,
                                        }
                                      : {
                                          ok: false,
                                          text: 'Could not create listing.',
                                        },
                                  );
                                }}
                                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold cursor-pointer transition-colors disabled:bg-white/10 disabled:text-white/40"
                              >
                                <Tag className="w-3 h-3" aria-hidden="true" />
                                <span>List</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {!hasHouseOwnership && listableNftFurniture.length === 0 && (
                      <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-dashed border-white/20 flex items-center gap-2 text-xs font-medium text-white/55">
                        <PackageOpen className="w-4 h-4 shrink-0 text-white/45" aria-hidden="true" />
                        <span>No House Deed or NFT Furniture owned yet.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Active Market Board Listings */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/65">
                  <Store className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                  <span>Market Board ({boardListings.length})</span>
                </div>

                {boardListings.length === 0 ? (
                  <div className="py-8 px-4 rounded-2xl bg-white/[0.04] border border-dashed border-white/20 flex flex-col items-center justify-center gap-1.5 text-center text-xs font-medium text-white/55">
                    <Store className="w-5 h-5 text-white/45" aria-hidden="true" />
                    <span>No active property or furniture listings right now.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {boardListings.map((listing) => {
                      const isMine =
                        listing.seller_account.toLowerCase() ===
                        playerNearAccount.toLowerCase();
                      const isBusy = busyPropertyListingId === listing.id;
                      const canBuy =
                        walletConnected &&
                        !isMine &&
                        listing.status === 'active' &&
                        busyPropertyListingId === null &&
                        respiteBalance >= listing.price_respite;
                      const isMyPurchase =
                        (listing.buyer_account || '').toLowerCase() ===
                        playerNearAccount.toLowerCase();
                      return (
                        <div
                          key={listing.id}
                          className="rounded-2xl bg-white/[0.06] border border-white/15 shadow-sm hover:border-white/30 transition-all p-3.5 flex flex-col gap-3"
                          data-property-listing={listing.id}
                        >
                          <div className="relative rounded-xl overflow-hidden bg-[#edf2f8]">
                            {listing.asset_kind === 'house' ? (
                              <div className="w-full h-28 overflow-hidden bg-slate-900">
                                <img
                                  src="/assets/kiosk/house_exterior.jpg"
                                  alt={listing.asset_label}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                  draggable={false}
                                />
                              </div>
                            ) : (
                              <Furniture3dThumbnail
                                catalogId={listing.asset_id}
                                name={listing.asset_label}
                                size="normal"
                                onInspect={() => {
                                  setActiveCatalogTab('furniture');
                                  handleSelectFurnitureCard(listing.asset_id);
                                }}
                              />
                            )}
                          </div>

                          <div className="flex flex-col gap-2 flex-1">
                            <div>
                              <div className="text-[11px] font-semibold text-teal-300">
                                {listing.asset_kind === 'house' ? 'House Deed' : 'Collector NFT'}
                                {listing.status === 'paid' ? ' · Paid' : ''}
                              </div>
                              <div className="text-sm font-semibold text-white truncate">
                                {listing.asset_label}
                              </div>
                              <div className="inline-flex items-center gap-1 text-[11px] text-white/55 truncate mt-0.5">
                                <User className="w-3 h-3 shrink-0 text-white/45" aria-hidden="true" />
                                <span className="truncate">
                                  {listing.seller_name || listing.seller_account}
                                </span>
                              </div>
                            </div>

                            <div className="mt-auto pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
                              <span className="text-sm font-mono font-bold text-white tabular-nums">
                                {listing.price_respite} RESPITE
                              </span>

                              {listing.status === 'paid' ? (
                                isMine ? (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={async () => {
                                      const ok =
                                        await onCompletePropertyTransfer?.(listing);
                                      setMarketFeedback(
                                        ok
                                          ? {
                                              ok: true,
                                              text: `${listing.asset_label} transferred!`,
                                            }
                                          : {
                                              ok: false,
                                              text: 'Transfer failed — try again.',
                                            },
                                      );
                                    }}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold cursor-pointer transition-colors disabled:bg-white/10 disabled:text-white/40"
                                  >
                                    <ArrowRightLeft className="w-3 h-3" aria-hidden="true" />
                                    <span>{isBusy ? '...' : 'Transfer'}</span>
                                  </button>
                                ) : (
                                  <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/35 text-xs font-semibold">
                                    {isMyPurchase ? 'Pending' : 'Sold'}
                                  </span>
                                )
                              ) : isMine ? (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={async () => {
                                    await onCancelPropertyListing?.(listing.id);
                                    setMarketFeedback({
                                      ok: true,
                                      text: 'Listing cancelled.',
                                    });
                                  }}
                                  className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/85 text-xs font-semibold cursor-pointer transition-colors"
                                >
                                  Cancel
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!canBuy}
                                  onClick={async () => {
                                    const ok = await onBuyPropertyListing?.(listing);
                                    setMarketFeedback(
                                      ok
                                        ? {
                                            ok: true,
                                            text: `Purchased ${listing.asset_label} for ${listing.price_respite} R!`,
                                          }
                                        : {
                                            ok: false,
                                            text: 'Payment failed — check RESPITE balance.',
                                          },
                                    );
                                  }}
                                  className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold cursor-pointer transition-colors disabled:bg-white/10 disabled:text-white/40 disabled:cursor-not-allowed"
                                >
                                  <ShoppingBag className="w-3 h-3" aria-hidden="true" />
                                  <span>{isBusy ? '...' : 'Buy'}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </TabletDeviceMockupShell>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
