import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Armchair,
  ArrowLeft,
  ArrowUpRight,
  Bike,
  Building2,
  CalendarDays,
  Coffee,
  Disc3,
  Heart,
  Home,
  Package,
  RotateCcw,
  Settings,
  Shirt,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  CITY_RENTAL_LOTS,
  SHOP_BUILDING_FORMS,
  type ShopBuildingFormId,
  type ShopBuildingFormSpec,
} from '../game/buddiesCityRentalLotsRules';
import {
  buildCentralPlazaDepartments,
  buildOwnerWalletStockCandidates,
  buildWestPlazaDepartments,
  computeAtomicSaleSettlement,
  createDefaultLotStorefrontConfig,
  SHOP_BUILDING_THEMES,
  type CentralPlazaDepartmentId,
  type LotStorefrontConfig,
  type StoreCatalogItem,
  type StoreProduct3DArchetype,
  type WestPlazaDepartmentId,
} from '../game/shopStorefrontCatalogEngine';
import { loadExternalWardrobeCatalogs } from '../game/buddiesWardrobeStudioRules';
import {
  ShopBuilding3DDiorama,
  ShopProduct3DTurntable,
  type ShopBuildingDioramaViewPreset,
} from './ShopProduct3DTurntable';
import { getOrRenderScooterPortraitUrl } from './UrbanScooterShowroomModal';
import { getOrRenderFurniturePortraitUrl } from './Furniture3dThumbnail';
import { soundEngine } from '../game/audio';

export interface ShopStorefrontTabletModalProps {
  lotId: string;
  buildingFormId: ShopBuildingFormId;
  config: LotStorefrontConfig;
  isOwner: boolean;
  ownerAccountId: string;
  visitorAccountId: string;
  respiteBalance: number;
  ownedMerchantItemIds: readonly string[];
  billboardLogoUrl: string | null;
  leaseExpiresText: string;
  isGracePeriod: boolean;
  termDays: number;
  onClose: () => void;
  onUpdateConfig: (nextConfig: LotStorefrontConfig) => void;
  onUpdateBillboardLogo: (logoUrl: string | null) => void;
  onAtomicPurchase: (params: {
    items: Array<{
      item: StoreCatalogItem;
      colorLabel: string;
      tierLabel: string;
      unitPriceRespite: number;
      quantity: number;
    }>;
    grossRespite: number;
    ownerSettledRespite: number;
    cityFeeRespite: number;
  }) => void;
  onExtendLease: () => void;
  onEndLease: () => void;
  onRemoveBuilding: () => void;
  /** Optional quick-launch buttons for District Flagship catalogs. */
  districtStudioActions?: Array<{
    id: string;
    label: string;
    badge: string;
    onSelect: () => void;
  }>;
  /** Optional initial store to open directly in West Plaza (omit or null to open mixed Home). */
  initialWestPlazaDepartment?: WestPlazaDepartmentId | null;
}

type TabletTabId = 'home' | 'catalog' | 'shop' | 'bag' | 'manage';

interface BagLineItem {
  key: string;
  itemId: string;
  colorId: string;
  tierId: string;
  quantity: number;
}

const ARCHETYPE_OPTIONS: Array<{ id: StoreProduct3DArchetype; label: string }> = [
  { id: 'tailored_coat', label: 'Tailored Coat (Mannequin)' },
  { id: 'classic_blazer', label: 'Classic Blazer (Mannequin)' },
  { id: 'leather_satchel', label: 'Leather Bag' },
  { id: 'pleated_dress', label: 'Pleated Dress (Mannequin)' },
  { id: 'fedora_hat', label: 'Fedora Hat' },
  { id: 'knit_cardigan', label: 'Knit Cardigan (Mannequin)' },
  { id: 'pro_gamepad', label: 'Pro Wireless Gamepad' },
  { id: 'anc_headset', label: 'Studio ANC Headset' },
  { id: 'ultrabook_laptop', label: 'Ultrabook 15" Laptop' },
  { id: 'flagship_phone', label: '5G Flagship Phone' },
  { id: 'pulse_earbuds', label: 'Wireless Earbuds Case' },
  { id: 'hifi_speaker', label: 'Hi-Fi Studio Speaker' },
  { id: 'pourover_carafe', label: 'Pour-Over Glass Carafe' },
  { id: 'espresso_tin', label: 'Artisan Roast Tin' },
  { id: 'ceramic_mug_set', label: 'Stoneware Ceramic Vessel' },
  { id: 'botanical_diffuser', label: 'Apothecary Reed Diffuser' },
  { id: 'matcha_whisk_kit', label: 'Ceremonial Matcha Bowl' },
  { id: 'linen_apron', label: 'Workshop Linen Apron' },
];

/**
 * Crisp editorial product illustration badge used in Bestsellers, Featured Goods,
 * and the bottom 6-item collection strip.
 */
const ProductArchetypeArtwork: React.FC<{
  archetype: StoreProduct3DArchetype;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  sizeClass?: string;
}> = ({ archetype, primaryHex, secondaryHex, accentHex, sizeClass = 'w-12 h-12' }) => {
  return (
    <div
      className={`${sizeClass} rounded-full bg-[#EFE7DA] flex items-center justify-center shrink-0 relative overflow-hidden`}
    >
      <svg viewBox="0 0 64 64" className="w-4/5 h-4/5" aria-hidden="true">
        {(archetype === 'tailored_coat' ||
          archetype === 'classic_blazer' ||
          archetype === 'knit_cardigan' ||
          archetype === 'linen_apron') && (
          <g>
            <path
              d="M21 15 L27 11 L37 11 L43 15 L51 24 L45 30 L41 24 L41 51 L23 51 L23 24 L19 30 L13 24 Z"
              fill={primaryHex}
              stroke="#231812"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <path
              d="M27 11 L32 25 L37 11"
              fill="none"
              stroke={secondaryHex}
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
            <rect x="23" y="31" width="18" height="3.5" rx="1.5" fill={accentHex} />
          </g>
        )}

        {archetype === 'pleated_dress' && (
          <g>
            <path
              d="M25 13 L39 13 L37 27 L47 51 L17 51 L27 27 Z"
              fill={primaryHex}
              stroke="#231812"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <rect x="26" y="25.5" width="12" height="3.2" rx="1.5" fill={accentHex} />
            <line x1="28" y1="29" x2="24" y2="50" stroke={secondaryHex} strokeWidth="1.6" />
            <line x1="36" y1="29" x2="40" y2="50" stroke={secondaryHex} strokeWidth="1.6" />
          </g>
        )}

        {archetype === 'leather_satchel' && (
          <g>
            <path
              d="M25 21 C25 15, 39 15, 39 21"
              fill="none"
              stroke={secondaryHex}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <rect
              x="14"
              y="21"
              width="36"
              height="27"
              rx="6"
              fill={primaryHex}
              stroke="#231812"
              strokeWidth="2.2"
            />
            <path
              d="M14 25 L50 25 L47 36 L17 36 Z"
              fill={secondaryHex}
              stroke="#231812"
              strokeWidth="1.8"
            />
            <rect x="29" y="33" width="6" height="6" rx="1.5" fill={accentHex} />
          </g>
        )}

        {archetype === 'fedora_hat' && (
          <g>
            <ellipse
              cx="32"
              cy="41"
              rx="22"
              ry="6.5"
              fill={primaryHex}
              stroke="#231812"
              strokeWidth="2.2"
            />
            <path
              d="M19 39 L22 22 C26 19, 38 19, 42 22 L45 39 Z"
              fill={primaryHex}
              stroke="#231812"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <rect x="20" y="34" width="24" height="4.5" rx="1.5" fill={secondaryHex} />
          </g>
        )}

        {archetype === 'pro_gamepad' && (
          <g>
            <path
              d="M18 23 L46 23 C51 23, 53 38, 48 45 C44 49, 40 42, 37 38 L27 38 C24 42, 20 49, 16 45 C11 38, 13 23, 18 23 Z"
              fill={primaryHex}
              stroke="#18202C"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <circle cx="24" cy="31" r="3.8" fill={secondaryHex} stroke={accentHex} strokeWidth="1.8" />
            <circle cx="39" cy="33" r="3.8" fill={secondaryHex} stroke={accentHex} strokeWidth="1.8" />
            <circle cx="43" cy="27" r="1.8" fill={accentHex} />
          </g>
        )}

        {archetype === 'anc_headset' && (
          <g>
            <path
              d="M17 36 L17 29 C17 18, 47 18, 47 29 L47 36"
              fill="none"
              stroke={primaryHex}
              strokeWidth="4.2"
              strokeLinecap="round"
            />
            <rect
              x="13"
              y="32"
              width="8"
              height="15"
              rx="4"
              fill={primaryHex}
              stroke={accentHex}
              strokeWidth="1.8"
            />
            <rect
              x="43"
              y="32"
              width="8"
              height="15"
              rx="4"
              fill={primaryHex}
              stroke={accentHex}
              strokeWidth="1.8"
            />
          </g>
        )}

        {archetype === 'ultrabook_laptop' && (
          <g>
            <rect
              x="15"
              y="17"
              width="34"
              height="23"
              rx="3"
              fill={secondaryHex}
              stroke={primaryHex}
              strokeWidth="2.4"
            />
            <path d="M18 36 L46 21 L46 37 Z" fill={accentHex} opacity="0.75" />
            <path
              d="M10 41 L54 41 L50 46 L14 46 Z"
              fill={primaryHex}
              stroke="#18202C"
              strokeWidth="2"
            />
          </g>
        )}

        {(archetype === 'flagship_phone' ||
          archetype === 'pulse_earbuds' ||
          archetype === 'hifi_speaker') && (
          <g>
            <rect
              x="21"
              y="13"
              width="22"
              height="38"
              rx="4.5"
              fill={primaryHex}
              stroke="#18202C"
              strokeWidth="2.2"
            />
            <circle cx="32" cy="25" r="4.5" fill={secondaryHex} stroke={accentHex} strokeWidth="1.8" />
            <circle cx="32" cy="39" r="6" fill={secondaryHex} stroke={accentHex} strokeWidth="1.8" />
          </g>
        )}

        {(archetype === 'pourover_carafe' ||
          archetype === 'espresso_tin' ||
          archetype === 'ceramic_mug_set' ||
          archetype === 'botanical_diffuser' ||
          archetype === 'matcha_whisk_kit') && (
          <g>
            <path
              d="M23 16 L41 16 L37 28 L44 47 L20 47 L27 28 Z"
              fill={primaryHex}
              stroke="#1E2A23"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <rect x="25" y="25" width="14" height="6" rx="2" fill={secondaryHex} />
            <circle cx="32" cy="38" r="4" fill={accentHex} />
          </g>
        )}

        {archetype === 'urban_scooter' && (
          <g>
            <circle cx="19" cy="44" r="6" fill={secondaryHex} stroke="#231812" strokeWidth="2.2" />
            <circle cx="45" cy="44" r="6" fill={secondaryHex} stroke="#231812" strokeWidth="2.2" />
            <path
              d="M17 36 L34 36 L41 21 L47 21"
              fill="none"
              stroke="#231812"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect
              x="14"
              y="28"
              width="18"
              height="9"
              rx="4"
              fill={primaryHex}
              stroke="#231812"
              strokeWidth="2"
            />
            <rect x="17" y="25" width="12" height="4" rx="2" fill={secondaryHex} />
            <circle cx="43" cy="25" r="2.8" fill={accentHex} />
          </g>
        )}

        {(archetype === 'apartment_deed' || archetype === 'shop_building') && (
          <g>
            <rect
              x="14"
              y="18"
              width="36"
              height="32"
              rx="3"
              fill={primaryHex}
              stroke="#231812"
              strokeWidth="2.2"
            />
            <rect x="11" y="14" width="42" height="6" rx="2" fill={secondaryHex} stroke="#231812" strokeWidth="1.8" />
            <rect x="20" y="24" width="9" height="8" rx="1.5" fill={accentHex} stroke="#231812" strokeWidth="1.5" />
            <rect x="35" y="24" width="9" height="8" rx="1.5" fill={accentHex} stroke="#231812" strokeWidth="1.5" />
            <rect x="27" y="38" width="10" height="12" rx="1.5" fill={secondaryHex} />
          </g>
        )}

        {archetype === 'lounge_furniture' && (
          <g>
            <rect
              x="14"
              y="22"
              width="36"
              height="14"
              rx="5"
              fill={primaryHex}
              stroke="#231812"
              strokeWidth="2.2"
            />
            <rect
              x="11"
              y="31"
              width="42"
              height="12"
              rx="4"
              fill={primaryHex}
              stroke="#231812"
              strokeWidth="2.2"
            />
            <rect x="20" y="25" width="10" height="7" rx="2" fill={accentHex} />
            <line x1="16" y1="43" x2="16" y2="50" stroke={secondaryHex} strokeWidth="2.8" strokeLinecap="round" />
            <line x1="48" y1="43" x2="48" y2="50" stroke={secondaryHex} strokeWidth="2.8" strokeLinecap="round" />
          </g>
        )}

        {archetype === 'beauty_palette' && (
          <g>
            <rect
              x="14"
              y="18"
              width="36"
              height="28"
              rx="5"
              fill={secondaryHex}
              stroke="#231812"
              strokeWidth="2.2"
            />
            <circle cx="25" cy="27" r="4.5" fill={primaryHex} />
            <circle cx="39" cy="27" r="4.5" fill={accentHex} />
            <circle cx="25" cy="38" r="4.5" fill={accentHex} />
            <circle cx="39" cy="38" r="4.5" fill={primaryHex} />
          </g>
        )}

        {archetype === 'flower_bouquet' && (
          <g>
            <path
              d="M22 31 L42 31 L36 52 L28 52 Z"
              fill={accentHex}
              stroke="#231812"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <circle cx="24" cy="24" r="7" fill={primaryHex} stroke="#231812" strokeWidth="1.8" />
            <circle cx="40" cy="24" r="7" fill={primaryHex} stroke="#231812" strokeWidth="1.8" />
            <circle cx="32" cy="18" r="8" fill={primaryHex} stroke="#231812" strokeWidth="1.8" />
            <circle cx="32" cy="18" r="3" fill={secondaryHex} />
          </g>
        )}

        {archetype === 'gift_box' && (
          <g>
            <rect
              x="16"
              y="24"
              width="32"
              height="24"
              rx="4"
              fill={primaryHex}
              stroke="#231812"
              strokeWidth="2.2"
            />
            <rect
              x="14"
              y="19"
              width="36"
              height="7"
              rx="2.5"
              fill={secondaryHex}
              stroke="#231812"
              strokeWidth="2"
            />
            <rect x="29" y="19" width="6" height="29" fill={accentHex} />
            <circle cx="27" cy="15" r="4" fill="none" stroke={accentHex} strokeWidth="2.5" />
            <circle cx="37" cy="15" r="4" fill="none" stroke={accentHex} strokeWidth="2.5" />
          </g>
        )}

        {archetype === 'motion_pose' && (
          <g>
            <ellipse
              cx="32"
              cy="48"
              rx="16"
              ry="4.5"
              fill={secondaryHex}
              stroke="#231812"
              strokeWidth="2"
            />
            <circle cx="33" cy="16" r="5" fill={primaryHex} stroke="#231812" strokeWidth="2" />
            <path
              d="M21 26 L32 23 L43 20 M32 23 L30 35 L23 46 M30 35 L39 46"
              fill="none"
              stroke={primaryHex}
              strokeWidth="3.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )}
      </svg>
    </div>
  );
};

/**
 * Architectural Building Diorama with custom rooftop billboard & streetlamp silhouette
 * that anchors the center of the `Home` view and glides to the bottom-left with
 * the cursive `"you are here"` badge in the `Shop` view.
 */
const ArchitecturalBuildingDiorama: React.FC<{
  formSpec: ShopBuildingFormSpec;
  customGlbPath?: string;
  customDioramaMode?: 'lot_glb' | 'west_plaza_arcade' | 'central_plaza_trio';
  brandName: string;
  brandCategory: string;
  accentHex: string;
  billboardLogoUrl: string | null;
  compact?: boolean;
  fullBleed?: boolean;
  viewPreset?: ShopBuildingDioramaViewPreset;
  cornerAnchorRef?: React.RefObject<HTMLDivElement | null>;
}> = ({
  formSpec,
  customGlbPath,
  customDioramaMode = 'lot_glb',
  brandName,
  brandCategory,
  accentHex,
  billboardLogoUrl,
  compact = false,
  fullBleed = false,
  viewPreset = 'home',
  cornerAnchorRef,
}) => {
  return (
    <ShopBuilding3DDiorama
      formSpec={formSpec}
      customGlbPath={customGlbPath}
      customDioramaMode={customDioramaMode}
      brandName={brandName}
      brandCategory={brandCategory}
      accentHex={accentHex}
      billboardLogoUrl={billboardLogoUrl}
      compact={compact}
      fullBleed={fullBleed}
      viewPreset={viewPreset}
      cornerAnchorRef={cornerAnchorRef}
    />
  );
};

const CatalogItemThumbnail: React.FC<{
  item: StoreCatalogItem;
  fallbackPrimaryHex: string;
  fallbackSecondaryHex: string;
  fallbackAccentHex: string;
  sizeClass?: string;
}> = ({
  item,
  fallbackPrimaryHex,
  fallbackSecondaryHex,
  fallbackAccentHex,
  sizeClass = 'w-12 h-12',
}) => {
  const portraitSrc = useMemo(() => {
    if (item.previewImageUrl) return item.previewImageUrl;
    if (item.previewScooterKind) return getOrRenderScooterPortraitUrl(item.previewScooterKind);
    if (item.previewFurnitureId) return getOrRenderFurniturePortraitUrl(item.previewFurnitureId);
    return '';
  }, [item.previewImageUrl, item.previewScooterKind, item.previewFurnitureId]);

  if (portraitSrc) {
    const isBeautyThumb =
      Boolean(item.previewThumbFlipY) || portraitSrc.includes('/assets/beauty/');
    return (
      <div
        className={`${sizeClass} rounded-xl overflow-hidden ${
          isBeautyThumb ? 'bg-[#FAF6F0]' : 'bg-[#F3ECE1]'
        } border border-black/10 flex items-center justify-center shrink-0`}
      >
        <img
          src={portraitSrc}
          alt={item.title}
          className={`w-full h-full ${
            item.previewImageUrl && !isBeautyThumb ? 'object-cover' : 'object-contain p-1'
          } ${item.previewThumbFlipY ? 'scale-y-[-1]' : ''}`}
        />
      </div>
    );
  }

  const col = item.colorVariants[0];
  return (
    <ProductArchetypeArtwork
      archetype={item.archetype3d}
      primaryHex={col?.primaryHex ?? fallbackPrimaryHex}
      secondaryHex={col?.secondaryHex ?? fallbackSecondaryHex}
      accentHex={col?.accentHex ?? fallbackAccentHex}
      sizeClass={sizeClass}
    />
  );
};

export const ShopStorefrontTabletModal: React.FC<ShopStorefrontTabletModalProps> = ({
  lotId,
  buildingFormId,
  config,
  isOwner,
  ownerAccountId,
  respiteBalance,
  ownedMerchantItemIds,
  billboardLogoUrl,
  leaseExpiresText,
  isGracePeriod,
  termDays,
  onClose,
  onUpdateConfig,
  onUpdateBillboardLogo,
  onAtomicPurchase,
  onExtendLease,
  onEndLease,
  onRemoveBuilding,
  districtStudioActions,
  initialWestPlazaDepartment,
}) => {
  const isWestPlazaHub = lotId === 'WEST-PLAZA';
  const isCentralPlazaHub = lotId === 'CENTRAL-PLAZA';
  const isDistrictHub = isWestPlazaHub || isCentralPlazaHub;
  const shopDioramaAnchorRef = useRef<HTMLDivElement | null>(null);
  const [centralCatalogRevision, setCentralCatalogRevision] = useState(0);
  useEffect(() => {
    if (!isCentralPlazaHub) return;
    let active = true;
    void loadExternalWardrobeCatalogs().then((count) => {
      if (active && count > 0) {
        setCentralCatalogRevision((r) => r + 1);
      }
    });
    return () => {
      active = false;
    };
  }, [isCentralPlazaHub]);

  const westPlazaDepts = useMemo(() => buildWestPlazaDepartments(), []);
  const centralPlazaDepts = useMemo(() => {
    void centralCatalogRevision;
    return buildCentralPlazaDepartments();
  }, [centralCatalogRevision]);

  const [activeWestPlazaDept, setActiveWestPlazaDept] = useState<WestPlazaDepartmentId>(
    initialWestPlazaDepartment ?? 'outfits',
  );
  const [activeCentralPlazaDept, setActiveCentralPlazaDept] =
    useState<CentralPlazaDepartmentId>('glow');
  const [activeSubGroupFilter, setActiveSubGroupFilter] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<TabletTabId>(() =>
    isWestPlazaHub && initialWestPlazaDepartment ? 'shop' : 'home',
  );
  const dioramaViewPreset: ShopBuildingDioramaViewPreset =
    activeTab === 'home' ? 'home' : activeTab === 'shop' ? 'shop_corner' : 'hidden';
  const isDioramaInteractiveTab = activeTab === 'home' || activeTab === 'shop';
  useEffect(() => {
    if (isWestPlazaHub && initialWestPlazaDepartment) {
      setActiveWestPlazaDept(initialWestPlazaDepartment);
      const firstItem = westPlazaDepts[initialWestPlazaDepartment]?.items[0];
      if (firstItem) setSelectedItemId(firstItem.id);
      setActiveSubGroupFilter('All');
      setActiveTab('shop');
    }
  }, [isWestPlazaHub, initialWestPlazaDepartment, westPlazaDepts]);

  const activeWestDept = westPlazaDepts[activeWestPlazaDept];
  const activeCentralDept = centralPlazaDepts[activeCentralPlazaDept];
  const activeDistrictDept = isWestPlazaHub ? activeWestDept : activeCentralDept;

  const westPlazaDeptByItemId = useMemo(() => {
    const map: Record<string, WestPlazaDepartmentId> = {};
    (Object.keys(westPlazaDepts) as WestPlazaDepartmentId[]).forEach((deptId) => {
      westPlazaDepts[deptId].items.forEach((it) => {
        map[it.id] = deptId;
      });
    });
    return map;
  }, [westPlazaDepts]);

  const centralPlazaDeptByItemId = useMemo(() => {
    const map: Record<string, CentralPlazaDepartmentId> = {};
    (Object.keys(centralPlazaDepts) as CentralPlazaDepartmentId[]).forEach((deptId) => {
      centralPlazaDepts[deptId].items.forEach((it) => {
        map[it.id] = deptId;
      });
    });
    return map;
  }, [centralPlazaDepts]);

  const rawDeptItems = useMemo(
    () =>
      isWestPlazaHub
        ? activeWestDept.items
        : isCentralPlazaHub
          ? activeCentralDept.items
          : config.items,
    [isWestPlazaHub, isCentralPlazaHub, activeWestDept.items, activeCentralDept.items, config.items],
  );

  const availableSubGroups = useMemo(() => {
    if (!isCentralPlazaHub) return [];
    const seen = new Set<string>();
    for (const it of rawDeptItems) {
      if (it.subGroupLabel) seen.add(it.subGroupLabel);
    }
    const list = Array.from(seen);
    return list.length > 1 ? ['All', ...list] : [];
  }, [isCentralPlazaHub, rawDeptItems]);

  const displayItems = useMemo(() => {
    if (!isCentralPlazaHub || activeSubGroupFilter === 'All') return rawDeptItems;
    const filtered = rawDeptItems.filter((it) => it.subGroupLabel === activeSubGroupFilter);
    return filtered.length > 0 ? filtered : rawDeptItems;
  }, [isCentralPlazaHub, rawDeptItems, activeSubGroupFilter]);

  const allCatalogItemsForBag = useMemo(
    () =>
      isWestPlazaHub
        ? Object.values(westPlazaDepts).flatMap((dept) => dept.items)
        : isCentralPlazaHub
          ? Object.values(centralPlazaDepts).flatMap((dept) => dept.items)
          : config.items,
    [isWestPlazaHub, isCentralPlazaHub, westPlazaDepts, centralPlazaDepts, config.items],
  );

  const theme = SHOP_BUILDING_THEMES[buildingFormId] ?? SHOP_BUILDING_THEMES.brick_rooftop_deck;
  const formSpec = SHOP_BUILDING_FORMS[buildingFormId];
  const lotSpec = useMemo(
    () => CITY_RENTAL_LOTS.find((l) => l.slotId === lotId) ?? null,
    [lotId],
  );

  // Allow owner (or QA testers) to toggle between Visitor View & Owner Studio smoothly
  const [previewAsVisitor, setPreviewAsVisitor] = useState<boolean>(false);
  const canAccessManage = isOwner && !previewAsVisitor;

  const [selectedItemId, setSelectedItemId] = useState<string>(
    () => displayItems[0]?.id ?? config.items[0]?.id ?? '',
  );
  const [selectedColorByItemId, setSelectedColorByItemId] = useState<Record<string, string>>({});
  const [selectedTierByItemId, setSelectedTierByItemId] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState<number>(1);
  const [bagItems, setBagItems] = useState<BagLineItem[]>([]);
  const [favoriteItemIds, setFavoriteItemIds] = useState<string[]>(() =>
    displayItems[0] ? [displayItems[0].id] : [],
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Owner Manage Store Editing State
  const [editingSlotIndex, setEditingSlotIndex] = useState<number>(0);
  const [logoInputUrl, setLogoInputUrl] = useState<string>(billboardLogoUrl ?? '');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3400);
  };

  const activeItem = useMemo(
    () =>
      displayItems.find((it) => it.id === selectedItemId) ??
      displayItems[0],
    [displayItems, selectedItemId],
  );

  const activeColor = useMemo(() => {
    if (!activeItem) return null;
    const savedId = selectedColorByItemId[activeItem.id];
    return (
      activeItem.colorVariants.find((c) => c.id === savedId) ??
      activeItem.colorVariants[0] ??
      null
    );
  }, [activeItem, selectedColorByItemId]);

  const activeTier = useMemo(() => {
    if (!activeItem) return null;
    const savedId = selectedTierByItemId[activeItem.id];
    return (
      activeItem.optionTiers.find((t) => t.id === savedId) ??
      activeItem.optionTiers[1] ??
      activeItem.optionTiers[0] ??
      null
    );
  }, [activeItem, selectedTierByItemId]);

  const unitPriceRespite = useMemo(() => {
    if (!activeItem) return 0;
    return Math.max(1, activeItem.basePriceRespite + (activeTier?.priceDeltaRespite ?? 0));
  }, [activeItem, activeTier]);

  const totalLinePriceRespite = unitPriceRespite * quantity;

  const totalBagCount = useMemo(
    () => bagItems.reduce((acc, line) => acc + line.quantity, 0),
    [bagItems],
  );

  const detailedBagLines = useMemo(() => {
    return bagItems
      .map((line) => {
        const item = allCatalogItemsForBag.find((i) => i.id === line.itemId);
        if (!item) return null;
        const color =
          item.colorVariants.find((c) => c.id === line.colorId) ?? item.colorVariants[0];
        const tier =
          item.optionTiers.find((t) => t.id === line.tierId) ?? item.optionTiers[0];
        const unitPrice = Math.max(1, item.basePriceRespite + (tier?.priceDeltaRespite ?? 0));
        return {
          ...line,
          item,
          colorLabel: color?.label ?? 'Standard',
          tierLabel: tier?.label ?? 'Standard',
          unitPriceRespite: unitPrice,
          lineTotalRespite: unitPrice * line.quantity,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [bagItems, allCatalogItemsForBag]);

  const bagSubtotalRespite = useMemo(
    () => detailedBagLines.reduce((acc, l) => acc + l.lineTotalRespite, 0),
    [detailedBagLines],
  );

  const walletStockCandidates = useMemo(
    () => buildOwnerWalletStockCandidates(ownedMerchantItemIds),
    [ownedMerchantItemIds],
  );

  const handleOpenProductInShop = (itemId: string) => {
    soundEngine.playUiClick();
    if (isWestPlazaHub) {
      const targetDept = westPlazaDeptByItemId[itemId];
      if (targetDept) {
        setActiveWestPlazaDept(targetDept);
      }
    } else if (isCentralPlazaHub) {
      const targetDept = centralPlazaDeptByItemId[itemId];
      if (targetDept) {
        setActiveCentralPlazaDept(targetDept);
      }
    }
    setActiveSubGroupFilter('All');
    setSelectedItemId(itemId);
    setQuantity(1);
    setActiveTab('shop');
  };

  const handleAddToBag = () => {
    if (!activeItem) return;
    if (activeItem.escrowStockCount <= 0) {
      showToast(`${activeItem.title} is currently out of stock in the Store Vault.`);
      return;
    }
    soundEngine.playUiClick();
    const colorId = activeColor?.id ?? 'default';
    const tierId = activeTier?.id ?? 'default';
    const key = `${activeItem.id}:${colorId}:${tierId}`;
    setBagItems((prev) => {
      const idx = prev.findIndex((p) => p.key === key);
      if (idx >= 0) {
        const next = [...prev];
        const cappedQty = Math.min(
          activeItem.escrowStockCount,
          next[idx].quantity + quantity,
        );
        next[idx] = { ...next[idx], quantity: cappedQty };
        return next;
      }
      return [
        ...prev,
        {
          key,
          itemId: activeItem.id,
          colorId,
          tierId,
          quantity: Math.min(activeItem.escrowStockCount, quantity),
        },
      ];
    });
    showToast(`Added ${quantity}× ${activeItem.title} (${activeColor?.label ?? ''}) to My Bag.`);
  };

  const handleInstantAtomicBuySingle = () => {
    if (!activeItem) return;
    if (activeItem.escrowStockCount < quantity) {
      showToast(`Only ${activeItem.escrowStockCount} unit(s) available in Store Vault.`);
      return;
    }
    const settlement = computeAtomicSaleSettlement(totalLinePriceRespite);
    if (respiteBalance < settlement.grossRespite) {
      showToast(
        `Insufficient RESPITE balance (${respiteBalance} RESPITE available, ${settlement.grossRespite} required).`,
      );
      return;
    }
    soundEngine.playUiClick();
    onAtomicPurchase({
      items: [
        {
          item: activeItem,
          colorLabel: activeColor?.label ?? 'Standard',
          tierLabel: activeTier?.label ?? 'Standard',
          unitPriceRespite,
          quantity,
        },
      ],
      ...settlement,
    });
    showToast(
      `Instant Atomic Settlement: Paid ${settlement.grossRespite} RESPITE (${settlement.ownerSettledRespite} RESPITE settled directly to store owner wallet).`,
    );
  };

  const handleCheckoutBagAtomic = () => {
    if (detailedBagLines.length === 0) return;
    const settlement = computeAtomicSaleSettlement(bagSubtotalRespite);
    if (respiteBalance < settlement.grossRespite) {
      showToast(
        `Insufficient RESPITE balance (${respiteBalance} RESPITE available, ${settlement.grossRespite} required).`,
      );
      return;
    }
    soundEngine.playUiClick();
    onAtomicPurchase({
      items: detailedBagLines.map((l) => ({
        item: l.item,
        colorLabel: l.colorLabel,
        tierLabel: l.tierLabel,
        unitPriceRespite: l.unitPriceRespite,
        quantity: l.quantity,
      })),
      ...settlement,
    });
    setBagItems([]);
    showToast(
      `Order Settled Atomically! ${settlement.ownerSettledRespite} RESPITE sent to store owner wallet & items added to My Things.`,
    );
  };

  const toggleFavorite = (itemId: string) => {
    soundEngine.playUiClick();
    setFavoriteItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
    );
  };

  const editingItem = config.items[editingSlotIndex] ?? config.items[0];

  const updateEditingItem = (patch: Partial<StoreCatalogItem>) => {
    if (!editingItem) return;
    const nextItems = config.items.map((it, idx) =>
      idx === editingSlotIndex ? { ...it, ...patch } : it,
    );
    onUpdateConfig({
      ...config,
      items: nextItems,
    });
  };

  const handleStockFromWalletCandidate = (candidateId: string) => {
    const cand = walletStockCandidates.find((c) => c.catalogItemId === candidateId);
    if (!cand || !editingItem) return;
    soundEngine.playUiClick();
    updateEditingItem({
      title: cand.title,
      categoryLabel: cand.categoryLabel,
      description: cand.description,
      basePriceRespite: cand.suggestedPriceRespite,
      archetype3d: cand.archetype3d,
      linkedInventoryItemId: cand.catalogItemId,
      escrowStockCount: Math.max(1, editingItem.escrowStockCount || 1),
    });
    showToast(`Locked "${cand.title}" from your Wallet into Store Vault Slot #${editingSlotIndex + 1}.`);
  };

  const bestsellerItems = useMemo(() => {
    if (isWestPlazaHub) {
      return [
        westPlazaDepts.outfits.items[0],
        westPlazaDepts.vehicles.items[0],
        westPlazaDepts.apartments.items[0],
        westPlazaDepts.furniture.items[0],
      ].filter((it): it is StoreCatalogItem => Boolean(it));
    }
    if (isCentralPlazaHub) {
      return [
        centralPlazaDepts.glow.items[0],
        centralPlazaDepts.bites_sips.items[0],
        centralPlazaDepts.red_studio.items[0],
        centralPlazaDepts.bites_sips.items[6] ?? centralPlazaDepts.bites_sips.items[1],
      ].filter((it): it is StoreCatalogItem => Boolean(it));
    }
    return displayItems.slice(0, 4);
  }, [isWestPlazaHub, isCentralPlazaHub, westPlazaDepts, centralPlazaDepts, displayItems]);

  const featuredItems = useMemo(() => {
    if (isWestPlazaHub) {
      return [
        westPlazaDepts.shop_buildings.items[0],
        westPlazaDepts.outfits.items[1],
        westPlazaDepts.vehicles.items[1],
        westPlazaDepts.furniture.items[3] ?? westPlazaDepts.furniture.items[1],
      ].filter((it): it is StoreCatalogItem => Boolean(it));
    }
    if (isCentralPlazaHub) {
      return [
        centralPlazaDepts.glow.items[1] ?? centralPlazaDepts.glow.items[0],
        centralPlazaDepts.bites_sips.items[3] ?? centralPlazaDepts.bites_sips.items[1],
        centralPlazaDepts.red_studio.items[1] ?? centralPlazaDepts.red_studio.items[0],
        centralPlazaDepts.bites_sips.items[10] ?? centralPlazaDepts.bites_sips.items[4],
      ].filter((it): it is StoreCatalogItem => Boolean(it));
    }
    return displayItems.length > 4 ? displayItems.slice(2, 6) : displayItems.slice(0, 4);
  }, [isWestPlazaHub, isCentralPlazaHub, westPlazaDepts, centralPlazaDepts, displayItems]);

  const activeShopBuildingFormSpec = formSpec;

  const activeDioramaMode: 'lot_glb' | 'west_plaza_arcade' | 'central_plaza_trio' = isWestPlazaHub
    ? 'west_plaza_arcade'
    : isCentralPlazaHub
      ? 'central_plaza_trio'
      : 'lot_glb';
  const activeDioramaGlbPath = config.customDioramaGlbPath;

  const activeExternalUrl =
    (activeItem?.externalUrl || config.defaultExternalUrl || '').trim();
  const activeExternalLabel =
    (activeItem?.externalCtaLabel || config.defaultExternalLabel || 'Visit Official Store').trim();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${config.brandName} storefront tablet`}
      data-lot-rental-modal="true"
      data-shop-storefront-tablet="true"
      onClick={() => {
        soundEngine.playUiCancel();
        onClose();
      }}
      className="fixed inset-0 z-[215] flex items-center justify-center p-2.5 sm:p-5 bg-black/45 pointer-events-auto select-none"
      style={{ fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Large Landscape Editorial Tablet Frame (matches Teleport Kiosk scale) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[1340px] h-[min(860px,92vh)] rounded-[32px] border-[3px] border-[#2B1D16]/20 shadow-[0_32px_90px_rgba(18,12,8,0.52)] flex flex-col justify-between overflow-hidden transition-colors duration-300"
        style={{
          backgroundColor: theme.canvasBgHex,
          color: theme.primaryTextHex,
        }}
      >
        {/* Persistent full-bleed 3D Diorama Stage — smoothly glides between Home Center and Bottom-Left "you are here" */}
        <div
          className={`absolute inset-0 z-0 transition-opacity duration-300 ${
            dioramaViewPreset === 'hidden'
              ? 'opacity-0 pointer-events-none'
              : 'opacity-100 pointer-events-auto'
          }`}
        >
          <ArchitecturalBuildingDiorama
            formSpec={activeShopBuildingFormSpec}
            customGlbPath={activeDioramaGlbPath}
            customDioramaMode={activeDioramaMode}
            brandName={
              isWestPlazaHub
                ? 'West Plaza Commercial Hub'
                : isCentralPlazaHub
                  ? 'Central Plaza Lifestyle Hub'
                  : config.brandName
            }
            brandCategory={
              isWestPlazaHub
                ? 'OUTFITS · VEHICLES · APARTMENTS · FURNITURE'
                : isCentralPlazaHub
                  ? 'GLOW · CERRIA BITES & SIPS · RED STUDIO'
                  : config.brandCategory
            }
            accentHex={theme.accentHex}
            billboardLogoUrl={billboardLogoUrl}
            fullBleed
            viewPreset={dioramaViewPreset}
            cornerAnchorRef={shopDioramaAnchorRef}
          />
        </div>

        {/* ================================================================= */}
        {/* TOP EDITORIAL FLOATING BAR                                        */}
        {/* ================================================================= */}
        <header
          className={`relative z-20 flex items-center justify-between gap-4 px-6 sm:px-8 pt-5 pb-3 shrink-0 ${
            isDioramaInteractiveTab ? 'pointer-events-none' : ''
          }`}
        >
          {/* Left: Back Button */}
          <div className="flex items-center gap-2.5 shrink-0 pointer-events-auto">
            <button
              type="button"
              data-lot-rental-close="true"
              onClick={() => {
                soundEngine.playUiClick();
                if (activeTab === 'shop' || (isDistrictHub && activeTab === 'bag')) {
                  setActiveTab('home');
                } else {
                  onClose();
                }
              }}
              className="px-4 py-2.5 rounded-full text-xs font-bold tracking-tight text-[#FAF6F0] flex items-center gap-2 shadow-sm hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap"
              style={{ backgroundColor: theme.darkButtonHex }}
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {activeTab === 'shop' || (isDistrictHub && activeTab === 'bag')
                  ? 'Back'
                  : 'Back to City'}
              </span>
            </button>

            {isOwner && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  setPreviewAsVisitor((v) => {
                    const next = !v;
                    if (next && activeTab === 'manage') setActiveTab('home');
                    return next;
                  });
                }}
                className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: theme.cardBgHex,
                  borderColor: theme.borderHex,
                  color: theme.mutedTextHex,
                }}
                title="Switch between Owner Studio and Visitor Storefront view"
              >
                <span>{previewAsVisitor ? 'Viewing as Visitor' : 'Owner Mode'}</span>
              </button>
            )}
          </div>

          {/* Center: Floating Cream Pill Navigation */}
          <nav
            aria-label="Storefront navigation"
            className="flex items-center gap-1 p-1.5 rounded-full border shadow-[0_6px_20px_rgba(35,24,18,0.06)] overflow-x-auto pointer-events-auto"
            style={{
              backgroundColor: theme.cardBgHex,
              borderColor: theme.borderHex,
            }}
          >
            {isWestPlazaHub
              ? (
                  [
                    { id: 'outfits' as const, label: 'Outfits', icon: Shirt },
                    { id: 'vehicles' as const, label: 'Vehicles', icon: Bike },
                    { id: 'apartments' as const, label: 'Apartments', icon: Building2 },
                    { id: 'furniture' as const, label: 'Furniture', icon: Armchair },
                    { id: 'shop_buildings' as const, label: 'Shop Buildings', icon: Store },
                  ] as const
                ).map((dept) => {
                  const isActive = activeTab === 'shop' && activeWestPlazaDept === dept.id;
                  const Icon = dept.icon;
                  return (
                    <button
                      key={dept.id}
                      type="button"
                      data-west-plaza-dept={dept.id}
                      onClick={() => {
                        soundEngine.playUiClick();
                        setActiveWestPlazaDept(dept.id);
                        const firstItem = westPlazaDepts[dept.id].items[0];
                        if (firstItem) setSelectedItemId(firstItem.id);
                        setQuantity(1);
                        setActiveTab('shop');
                      }}
                      className={`px-3.5 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        isActive ? 'text-white shadow-sm' : 'hover:opacity-80'
                      }`}
                      style={{
                        backgroundColor: isActive ? theme.activeNavPillHex : 'transparent',
                        color: isActive ? '#FFFFFF' : theme.primaryTextHex,
                      }}
                    >
                      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{dept.label}</span>
                    </button>
                  );
                })
              : isCentralPlazaHub
                ? (
                    [
                      { id: 'glow' as const, label: 'Glow', icon: Sparkles },
                      { id: 'bites_sips' as const, label: 'Cerria Bites & Sips', icon: Coffee },
                      { id: 'red_studio' as const, label: 'Red Studio', icon: Disc3 },
                    ] as const
                  ).map((dept) => {
                    const isActive = activeTab === 'shop' && activeCentralPlazaDept === dept.id;
                    const Icon = dept.icon;
                    return (
                      <button
                        key={dept.id}
                        type="button"
                        data-central-plaza-dept={dept.id}
                        onClick={() => {
                          soundEngine.playUiClick();
                          setActiveCentralPlazaDept(dept.id);
                          setActiveSubGroupFilter('All');
                          const firstItem = centralPlazaDepts[dept.id].items[0];
                          if (firstItem) setSelectedItemId(firstItem.id);
                          setQuantity(1);
                          setActiveTab('shop');
                        }}
                        className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                          isActive ? 'text-white shadow-sm' : 'hover:opacity-80'
                        }`}
                        style={{
                          backgroundColor: isActive ? theme.activeNavPillHex : 'transparent',
                          color: isActive ? '#FFFFFF' : theme.primaryTextHex,
                        }}
                      >
                        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{dept.label}</span>
                      </button>
                    );
                  })
                : (
                    [
                      { id: 'home' as const, label: 'Home', icon: Home },
                      { id: 'catalog' as const, label: 'Catalog', icon: Package },
                      { id: 'shop' as const, label: 'Shop', icon: ShoppingBag },
                      {
                        id: 'bag' as const,
                        label: `My Bag (${totalBagCount})`,
                        icon: ShoppingBag,
                      },
                      ...(canAccessManage
                        ? [{ id: 'manage' as const, label: 'Manage Store', icon: Settings }]
                        : []),
                    ] as const
                  ).map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        data-storefront-tab={tab.id}
                        onClick={() => {
                          soundEngine.playUiClick();
                          setActiveTab(tab.id);
                        }}
                        className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                          isActive ? 'text-white shadow-sm' : 'hover:opacity-80'
                        }`}
                        style={{
                          backgroundColor: isActive ? theme.activeNavPillHex : 'transparent',
                          color: isActive ? '#FFFFFF' : theme.primaryTextHex,
                        }}
                      >
                        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
          </nav>

          {/* Right: Wallet Balance & Favorites */}
          <div className="flex items-center gap-2 shrink-0 pointer-events-auto">
            <div
              className="px-3.5 py-2 rounded-full border text-xs font-bold flex items-center gap-2 tabular-nums whitespace-nowrap"
              style={{
                backgroundColor: theme.cardBgHex,
                borderColor: theme.borderHex,
              }}
              title="Connected wallet RESPITE balance"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: theme.accentHex }}
              />
              <span>{respiteBalance.toLocaleString()} RESPITE</span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (activeItem) toggleFavorite(activeItem.id);
              }}
              className="px-3 py-2 rounded-full border text-xs font-bold flex items-center gap-1.5 tabular-nums cursor-pointer transition-transform active:scale-95"
              style={{
                backgroundColor: theme.cardBgHex,
                borderColor: theme.borderHex,
              }}
              title="Saved favorite items"
            >
              <Heart
                className="w-3.5 h-3.5"
                style={{
                  color: theme.accentHex,
                  fill:
                    activeItem && favoriteItemIds.includes(activeItem.id)
                      ? theme.accentHex
                      : 'none',
                }}
              />
              <span>{favoriteItemIds.length}</span>
            </button>
          </div>
        </header>

        {/* Live Notification Banner */}
        {toastMessage && (
          <div className="relative z-20 mx-8 mb-1 px-4 py-2 rounded-full bg-[#231812] text-[#FAF6F0] text-xs font-semibold flex items-center justify-between shadow-md shrink-0">
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-[11px] underline ml-4 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* MAIN TABLET VIEWPORT BODY                                         */}
        {/* ================================================================= */}
        <div
          className={`relative z-10 flex-1 min-h-0 px-6 sm:px-8 py-2 overflow-y-auto ${
            isDioramaInteractiveTab ? 'pointer-events-none' : ''
          }`}
        >
          {/* --------------------------------------------------------------- */}
          {/* VIEW 1: HOME (3-COLUMN EDITORIAL LANDING OVER FULL-BLEED 3D)    */}
          {/* --------------------------------------------------------------- */}
          {activeTab === 'home' && (
            <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-center pointer-events-none">
              {/* Left Column: Big Editorial Serif Title + Menu Stack + Pinned Sticky Note */}
              <div className="lg:col-span-3 flex flex-col justify-between h-full py-1 space-y-3 pointer-events-none">
                <div>
                  <h1
                    className="text-3xl xl:text-[42px] leading-[1.06] tracking-tight font-normal"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                  >
                    {isWestPlazaHub ? (
                      <>
                        <span className="block">West Plaza</span>
                        <span className="block">Commercial</span>
                        <span className="block">
                          Hub <span style={{ color: theme.activeNavPillHex }}>♥</span>
                        </span>
                      </>
                    ) : isCentralPlazaHub ? (
                      <>
                        <span className="block">Central Plaza</span>
                        <span className="block">Lifestyle</span>
                        <span className="block">
                          Hub <span style={{ color: theme.activeNavPillHex }}>♥</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="block">{config.heroHeadlineLines[0]}</span>
                        <span className="block">{config.heroHeadlineLines[1]}</span>
                        <span className="block">{config.heroHeadlineLines[2]}</span>
                      </>
                    )}
                  </h1>

                  <p
                    className="mt-3 text-[10.5px] font-bold tracking-[0.18em] uppercase"
                    style={{ color: theme.mutedTextHex }}
                  >
                    {isWestPlazaHub
                      ? 'OUTFITS · VEHICLES · APARTMENTS · FURNITURE'
                      : isCentralPlazaHub
                        ? 'GLOW · CERRIA BITES & SIPS · RED STUDIO'
                        : config.heroTagsLine}
                  </p>

                  {/* Vertical Menu Stack */}
                  <div className="mt-4 space-y-2 max-w-[230px] pointer-events-auto">
                    {(isDistrictHub
                      ? ([
                          { id: 'home' as const, label: 'HOME' },
                          { id: 'bag' as const, label: `MY BAG (${totalBagCount})` },
                        ] as const)
                      : ([
                          { id: 'home' as const, label: 'HOME' },
                          { id: 'catalog' as const, label: 'CATALOG' },
                          { id: 'shop' as const, label: 'SHOP' },
                          { id: 'bag' as const, label: `MY BAG (${totalBagCount})` },
                          ...(canAccessManage
                            ? [{ id: 'manage' as const, label: 'MANAGE STORE' }]
                            : []),
                        ] as const)
                    ).map((navItem) => {
                      const active = activeTab === navItem.id;
                      return (
                        <button
                          key={navItem.id}
                          type="button"
                          onClick={() => {
                            soundEngine.playUiClick();
                            setActiveTab(navItem.id);
                          }}
                          className="w-full px-4 py-2.5 rounded-xl border text-left text-xs font-bold tracking-wider flex items-center justify-between transition-all cursor-pointer"
                          style={{
                            backgroundColor: active
                              ? theme.activeNavPillHex
                              : theme.cardBgHex,
                            borderColor: active ? theme.activeNavPillHex : theme.borderHex,
                            color: active ? '#FFFFFF' : theme.primaryTextHex,
                          }}
                        >
                          <span>{navItem.label}</span>
                          <span aria-hidden="true">›</span>
                        </button>
                      );
                    })}
                  </div>

                  {!isDistrictHub && districtStudioActions && districtStudioActions.length > 0 && (
                    <div className="mt-3 pt-3 border-t space-y-1.5 max-w-[230px] pointer-events-auto" style={{ borderColor: theme.borderHex }}>
                      <p
                        className="text-[10px] font-extrabold tracking-[0.16em] uppercase"
                        style={{ color: theme.mutedTextHex }}
                      >
                        {config.managerNpcName
                          ? `${config.managerNpcName.toUpperCase()} STUDIOS`
                          : 'DISTRICT STUDIOS'}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {districtStudioActions.map((act) => (
                          <button
                            key={act.id}
                            type="button"
                            onClick={() => {
                              soundEngine.playUiClick();
                              act.onSelect();
                            }}
                            className="px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer"
                            style={{
                              backgroundColor: theme.accentSoftBgHex,
                              borderColor: theme.borderHex,
                              color: theme.primaryTextHex,
                            }}
                          >
                            <span>{act.label}</span>
                            <span
                              className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: theme.cardBgHex,
                                color: theme.accentHex,
                              }}
                            >
                              {act.badge}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Tilted Pinned Sticky Note */}
                <div
                  className="relative max-w-[215px] rounded-2xl border p-3.5 shadow-[0_10px_24px_rgba(35,24,18,0.06)] -rotate-2 pointer-events-auto"
                  style={{
                    backgroundColor: theme.cardBgHex,
                    borderColor: theme.borderHex,
                  }}
                >
                  <span
                    className="w-3 h-3 rounded-full absolute -top-1.5 left-1/2 -translate-x-1/2 shadow-sm"
                    style={{ backgroundColor: theme.accentHex }}
                  />
                  <div
                    className="text-[15px] leading-snug italic"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                  >
                    <p>{config.stickyNoteLines[0]}</p>
                    <p>{config.stickyNoteLines[1]}</p>
                    <p>{config.stickyNoteLines[2]}</p>
                  </div>
                </div>
              </div>

              {/* Center Spacer: Open interactive window directly over the unbounded 3D diorama */}
              <div className="hidden lg:block lg:col-span-4 pointer-events-none" aria-hidden="true" />

              {/* Right Column: Season Special + Our Bestsellers + Featured Goods */}
              <div className="lg:col-span-5 flex flex-col justify-between space-y-3 pointer-events-auto">
                {/* 1. Storefront Hero Card */}
                <div
                  className="rounded-[22px] border p-4 flex items-center justify-between gap-4 shadow-[0_8px_24px_rgba(35,24,18,0.04)]"
                  style={{
                    backgroundColor: theme.cardBgHex,
                    borderColor: theme.borderHex,
                  }}
                >
                  <div className="space-y-1">
                    <span
                      className="inline-block text-[10px] font-extrabold tracking-[0.18em] uppercase px-2.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: theme.accentSoftBgHex,
                        color: theme.accentHex,
                      }}
                    >
                      {isWestPlazaHub
                        ? 'WEST PLAZA HUB'
                        : isCentralPlazaHub
                          ? 'CENTRAL PLAZA HUB'
                          : config.seasonTag}
                    </span>
                    <h2
                      className="text-2xl sm:text-[26px] font-bold leading-tight"
                      style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                    >
                      {isWestPlazaHub
                        ? "Hana's Commercial Edit"
                        : isCentralPlazaHub
                          ? "Nadia's Plaza Edit"
                          : config.seasonHeadline}{' '}
                      <span style={{ color: theme.activeNavPillHex }}>♥</span>
                    </h2>
                    <p
                      className="text-[10.5px] font-bold tracking-[0.16em] uppercase"
                      style={{ color: theme.mutedTextHex }}
                    >
                      {isWestPlazaHub
                        ? 'OUTFITS · VEHICLES · APARTMENTS · FURNITURE'
                        : isCentralPlazaHub
                          ? 'GLOW · CERRIA BITES & SIPS · RED STUDIO'
                          : config.seasonSubtitle}
                    </p>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const target = bestsellerItems[0] ?? displayItems[0];
                          if (target) {
                            handleOpenProductInShop(target.id);
                          }
                        }}
                        className="px-4 py-2 rounded-full text-xs font-bold text-white inline-flex items-center gap-1.5 shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
                        style={{ backgroundColor: theme.accentHex }}
                      >
                        <span>Explore &amp; Order</span>
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </div>

                  {(bestsellerItems[0] ?? displayItems[0]) && (
                    <CatalogItemThumbnail
                      item={bestsellerItems[0] ?? displayItems[0]}
                      fallbackPrimaryHex={theme.accentHex}
                      fallbackSecondaryHex={theme.darkButtonHex}
                      fallbackAccentHex={theme.accentHex}
                      sizeClass="w-18 h-18"
                    />
                  )}
                </div>

                {/* 2. Our Bestsellers (4-column Grid) */}
                <div
                  className="rounded-[24px] border p-4 space-y-3 shadow-[0_8px_24px_rgba(35,24,18,0.04)]"
                  style={{
                    backgroundColor: theme.cardBgHex,
                    borderColor: theme.borderHex,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[11px] font-extrabold tracking-[0.16em] uppercase"
                      style={{ color: theme.mutedTextHex }}
                    >
                      OUR BESTSELLERS
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (isDistrictHub) {
                          if (bestsellerItems[0]) handleOpenProductInShop(bestsellerItems[0].id);
                        } else {
                          soundEngine.playUiClick();
                          setActiveTab('catalog');
                        }
                      }}
                      className="text-[11px] font-bold tracking-wider uppercase hover:underline cursor-pointer"
                      style={{ color: theme.accentHex }}
                    >
                      VIEW ALL →
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {bestsellerItems.map((item) => {
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleOpenProductInShop(item.id)}
                          className="rounded-2xl border p-3 flex flex-col items-center text-center hover:-translate-y-0.5 transition-all cursor-pointer"
                          style={{
                            backgroundColor: '#FFFFFF',
                            borderColor: theme.borderHex,
                          }}
                        >
                          <CatalogItemThumbnail
                            item={item}
                            fallbackPrimaryHex={theme.accentHex}
                            fallbackSecondaryHex={theme.darkButtonHex}
                            fallbackAccentHex={theme.accentHex}
                            sizeClass="w-12 h-12"
                          />
                          <p className="mt-2 text-xs font-bold truncate w-full">{item.title}</p>
                          <p
                            className="mt-0.5 text-[11px] font-semibold tabular-nums"
                            style={{ color: theme.mutedTextHex }}
                          >
                            {item.basePriceRespite} RESPITE
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Featured Goods (4-column Grid) */}
                <div
                  className="rounded-[24px] border p-4 space-y-3 shadow-[0_8px_24px_rgba(35,24,18,0.04)]"
                  style={{
                    backgroundColor: theme.cardBgHex,
                    borderColor: theme.borderHex,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[11px] font-extrabold tracking-[0.16em] uppercase"
                      style={{ color: theme.mutedTextHex }}
                    >
                      FEATURED GOODS
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (isDistrictHub && featuredItems[0]) {
                          handleOpenProductInShop(featuredItems[0].id);
                        } else {
                          soundEngine.playUiClick();
                          setActiveTab('shop');
                        }
                      }}
                      className="text-[11px] font-bold tracking-wider uppercase hover:underline cursor-pointer"
                      style={{ color: theme.accentHex }}
                    >
                      SHOP NOW →
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {featuredItems.map((item) => {
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleOpenProductInShop(item.id)}
                          className="rounded-2xl border p-3 flex flex-col items-center text-center hover:-translate-y-0.5 transition-all cursor-pointer"
                          style={{
                            backgroundColor: '#FFFFFF',
                            borderColor: theme.borderHex,
                          }}
                        >
                          <CatalogItemThumbnail
                            item={item}
                            fallbackPrimaryHex={theme.accentHex}
                            fallbackSecondaryHex={theme.darkButtonHex}
                            fallbackAccentHex={theme.accentHex}
                            sizeClass="w-12 h-12"
                          />
                          <p className="mt-2 text-xs font-bold truncate w-full">{item.title}</p>
                          <p
                            className="mt-0.5 text-[11px] font-semibold tabular-nums"
                            style={{ color: theme.mutedTextHex }}
                          >
                            {item.basePriceRespite} RESPITE
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* VIEW 2: SHOP / ORDER PRODUCT (2-COLUMN FOCUS + "YOU ARE HERE")  */}
          {/* --------------------------------------------------------------- */}
          {activeTab === 'shop' && activeItem && (
            <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch pointer-events-none">
              {/* Left Anchor Column: Order Product Heading + "you are here" anchor for persistent 3D diorama */}
              <div className="lg:col-span-4 flex flex-col justify-between py-2 pointer-events-none">
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setActiveTab('home');
                    }}
                    className="text-[11px] font-bold tracking-[0.16em] uppercase hover:underline cursor-pointer flex items-center gap-1.5 pointer-events-auto"
                    style={{ color: theme.mutedTextHex }}
                  >
                    <span>← BACK TO STORE HOME</span>
                  </button>

                  <h1
                    className="mt-2 text-4xl sm:text-[44px] leading-tight italic font-normal"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                  >
                    Order Product
                  </h1>

                  <p
                    className="mt-2 text-[11px] font-bold tracking-[0.18em] uppercase"
                    style={{ color: theme.mutedTextHex }}
                  >
                    {isDistrictHub
                      ? activeItem.previewImageUrl &&
                        !activeItem.previewGlbPath &&
                        !activeItem.previewFurnitureId &&
                        !activeItem.previewScooterKind &&
                        !activeItem.previewCafeFoodId &&
                        !activeItem.previewGiftKind
                        ? activeItem.previewThumbFlipY ||
                          activeItem.previewImageUrl.includes('/assets/beauty/')
                          ? 'BEAUTY STUDIO PREVIEW · DIRECT ORDER'
                          : 'ARCHITECTURAL PREVIEW · DIRECT ORDER'
                        : 'DRAG TO ROTATE · INSPECT PRODUCT'
                      : 'DRAG TO ROTATE · SELECT COLOR & OPTION'}
                  </p>
                </div>

                {/* Bottom-Left "you are here" pill & arrow above transparent anchor where the persistent 3D diorama glides */}
                <div className="flex flex-col items-center pt-4 pointer-events-none">
                  <div
                    className="px-4 py-1.5 rounded-full border shadow-sm text-lg italic"
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderColor: theme.borderHex,
                      color: theme.accentHex,
                      fontFamily: "'Playfair Display', Georgia, serif",
                    }}
                  >
                    you are here
                  </div>
                  {/* Hand-drawn curved arrow SVG */}
                  <svg
                    viewBox="0 0 36 32"
                    className="w-7 h-6 my-1"
                    style={{ color: theme.accentHex }}
                    aria-hidden="true"
                  >
                    <path
                      d="M14 2 C19 10, 21 18, 20 27 M14 22 L20 28 L26 21"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>

                  {/* Transparent landing zone for the persistent full-bleed 3D building diorama */}
                  <div
                    ref={shopDioramaAnchorRef}
                    className="w-full h-[215px] pointer-events-none"
                    aria-hidden="true"
                  />
                </div>
              </div>

              {/* Right 8-Col Main Showcase Card */}
              <div
                className="lg:col-span-8 rounded-[28px] border p-4 sm:p-5 flex flex-col justify-between shadow-[0_12px_36px_rgba(35,24,18,0.05)] pointer-events-auto"
                style={{
                  backgroundColor: theme.cardBgHex,
                  borderColor: theme.borderHex,
                }}
              >
                {/* Breadcrumb & Vault Stock Count */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                  {isDistrictHub ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="text-[11px] font-bold tracking-[0.16em] uppercase"
                        style={{ color: theme.mutedTextHex }}
                      >
                        {activeDistrictDept.storeTitle.toUpperCase()} ({displayItems.length})
                      </span>
                      {availableSubGroups.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          {availableSubGroups.map((group) => {
                            const selected = activeSubGroupFilter === group;
                            return (
                              <button
                                key={group}
                                type="button"
                                onClick={() => {
                                  soundEngine.playUiClick();
                                  setActiveSubGroupFilter(group);
                                  const nextList =
                                    group === 'All'
                                      ? rawDeptItems
                                      : rawDeptItems.filter((it) => it.subGroupLabel === group);
                                  if (nextList[0]) {
                                    setSelectedItemId(nextList[0].id);
                                    setQuantity(1);
                                  }
                                }}
                                className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer"
                                style={{
                                  backgroundColor: selected ? theme.activeNavPillHex : '#FFFFFF',
                                  borderColor: selected ? theme.activeNavPillHex : theme.borderHex,
                                  color: selected ? '#FFFFFF' : theme.primaryTextHex,
                                }}
                              >
                                {group}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setActiveTab('catalog');
                      }}
                      className="text-[11px] font-bold tracking-[0.16em] uppercase hover:underline cursor-pointer"
                      style={{ color: theme.mutedTextHex }}
                    >
                      ← ALL COLLECTION ({displayItems.length})
                    </button>
                  )}

                  <div className="flex items-center gap-3 text-xs">
                    {activeItem.linkedInventoryItemId && (
                      <span
                        className="font-semibold"
                        style={{ color: theme.accentHex }}
                      >
                        Verified Wallet Asset
                      </span>
                    )}
                    <span
                      className="font-bold tabular-nums"
                      style={{
                        color:
                          activeItem.escrowStockCount > 0
                            ? theme.primaryTextHex
                            : '#DC2626',
                      }}
                    >
                      {activeItem.escrowStockCount > 0
                        ? `Vault Stock: ${activeItem.escrowStockCount}`
                        : 'Vault Sold Out'}
                    </span>
                  </div>
                </div>

                {/* Center Product Split: Left 3D Turntable Stage | Right Purchase Configurator */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch my-auto">
                  {/* Left: Interactive 3D Product Turntable Stage */}
                  <div className="md:col-span-5 flex flex-col">
                    <ShopProduct3DTurntable
                      archetype={activeItem.archetype3d}
                      primaryHex={activeColor?.primaryHex ?? theme.accentHex}
                      secondaryHex={activeColor?.secondaryHex ?? theme.darkButtonHex}
                      accentHex={activeColor?.accentHex ?? theme.accentHex}
                      stageBgHex={theme.stageBgHex}
                      previewGlbPath={activeItem.previewGlbPath}
                      previewFurnitureId={activeItem.previewFurnitureId}
                      previewScooterKind={activeItem.previewScooterKind}
                      previewCafeFoodId={activeItem.previewCafeFoodId}
                      previewGiftKind={activeItem.previewGiftKind}
                      previewImageUrl={activeItem.previewImageUrl}
                      previewThumbFlipY={activeItem.previewThumbFlipY}
                      previewImageAlt={activeItem.title}
                    />
                  </div>

                  {/* Right: Product Details, Specs / Variants & Checkout */}
                  <div className="md:col-span-7 flex flex-col justify-between space-y-2">
                    <div>
                      <p
                        className="text-[11px] font-extrabold tracking-[0.18em] uppercase"
                        style={{ color: theme.accentHex }}
                      >
                        {isDistrictHub
                          ? activeItem.categoryLabel
                          : `${activeItem.categoryLabel} · ${(activeColor?.label ?? 'STANDARD').toUpperCase()}`}
                      </p>

                      <h2
                        className="mt-1 text-2xl sm:text-[32px] font-bold leading-tight"
                        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                      >
                        {activeItem.title}
                      </h2>

                      <p
                        className="mt-1 text-xl sm:text-2xl font-extrabold tabular-nums"
                        style={{ color: theme.accentHex }}
                      >
                        {totalLinePriceRespite.toLocaleString()} RESPITE
                      </p>

                      <p
                        className="mt-1.5 text-xs sm:text-[13px] leading-relaxed line-clamp-3"
                        style={{ color: theme.mutedTextHex }}
                      >
                        {activeItem.description}
                      </p>
                    </div>

                    {/* District Plaza Hubs: Clean real product specs (no irrelevant color/size selectors) */}
                    {isDistrictHub &&
                      activeItem.previewSpecs &&
                      activeItem.previewSpecs.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                          {activeItem.previewSpecs.slice(0, 4).map((spec) => (
                            <div
                              key={spec.label}
                              className="rounded-xl border px-3 py-1.5"
                              style={{
                                backgroundColor: '#FFFFFF',
                                borderColor: theme.borderHex,
                              }}
                            >
                              <p
                                className="text-[10px] font-bold tracking-[0.12em] uppercase"
                                style={{ color: theme.mutedTextHex }}
                              >
                                {spec.label}
                              </p>
                              <p className="mt-0.5 text-xs font-bold truncate">{spec.value}</p>
                            </div>
                          ))}
                        </div>
                      )}

                    {/* Real-Time Color Variants (player-owned custom storefronts only) */}
                    {!isDistrictHub && activeItem.colorVariants.length > 1 && (
                      <div className="space-y-1.5 pt-1">
                        <p className="text-[11px] font-bold tracking-wider uppercase">
                          <span style={{ color: theme.mutedTextHex }}>COLOR VARIANT: </span>
                          <span>{activeColor?.label}</span>
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {activeItem.colorVariants.map((variant) => {
                            const isSelected = activeColor?.id === variant.id;
                            return (
                              <button
                                key={variant.id}
                                type="button"
                                onClick={() => {
                                  soundEngine.playUiClick();
                                  setSelectedColorByItemId((prev) => ({
                                    ...prev,
                                    [activeItem.id]: variant.id,
                                  }));
                                }}
                                className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer"
                                style={{
                                  backgroundColor: '#FFFFFF',
                                  borderColor: isSelected
                                    ? theme.primaryTextHex
                                    : theme.borderHex,
                                  boxShadow: isSelected
                                    ? `0 0 0 1.5px ${theme.primaryTextHex}`
                                    : 'none',
                                }}
                              >
                                <span
                                  className="w-3 h-3 rounded-full border border-black/15 shrink-0"
                                  style={{ backgroundColor: variant.primaryHex }}
                                />
                                <span>{variant.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Size / Package Spec Tiers (player-owned custom storefronts only) */}
                    {!isDistrictHub && activeItem.optionTiers.length > 1 && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                        {activeItem.optionTiers.map((tier) => {
                          const isSelected = activeTier?.id === tier.id;
                          return (
                            <button
                              key={tier.id}
                              type="button"
                              onClick={() => {
                                soundEngine.playUiClick();
                                setSelectedTierByItemId((prev) => ({
                                  ...prev,
                                  [activeItem.id]: tier.id,
                                }));
                              }}
                              className="px-2.5 py-2 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer truncate"
                              style={{
                                backgroundColor: isSelected
                                  ? theme.darkButtonHex
                                  : '#FFFFFF',
                                borderColor: isSelected
                                  ? theme.darkButtonHex
                                  : theme.borderHex,
                                color: isSelected ? '#FFFFFF' : theme.primaryTextHex,
                              }}
                              title={tier.label}
                            >
                              {tier.label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Quantity Stepper + Add to Bag + Instant Atomic Buy */}
                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      <div
                        className="flex items-center rounded-full border px-2 py-1"
                        style={{
                          backgroundColor: '#FFFFFF',
                          borderColor: theme.borderHex,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playUiClick();
                            setQuantity((q) => Math.max(1, q - 1));
                          }}
                          className="w-7 h-7 rounded-full font-bold text-sm hover:bg-black/5 cursor-pointer"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-xs font-extrabold tabular-nums">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playUiClick();
                            setQuantity((q) =>
                              Math.min(Math.max(1, activeItem.escrowStockCount), q + 1),
                            );
                          }}
                          className="w-7 h-7 rounded-full font-bold text-sm hover:bg-black/5 cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={activeItem.escrowStockCount <= 0}
                        onClick={handleAddToBag}
                        className="flex-1 min-w-[150px] py-3 px-4 rounded-full text-xs font-extrabold tracking-wider uppercase text-white shadow-sm hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-40"
                        style={{ backgroundColor: theme.accentHex }}
                      >
                        + ADD TO BAG
                      </button>

                      <button
                        type="button"
                        disabled={activeItem.escrowStockCount <= 0}
                        onClick={handleInstantAtomicBuySingle}
                        className="py-3 px-4 rounded-full text-xs font-extrabold tracking-wider uppercase text-white shadow-sm hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-40"
                        style={{ backgroundColor: theme.darkButtonHex }}
                        title="Instant Atomic Settlement directly to Store Owner Wallet"
                      >
                        BUY NOW
                      </button>
                    </div>

                    {/* Optional External Promotional / Marketplace Link */}
                    {!isDistrictHub && activeExternalUrl && (
                      <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                        <a
                          href={activeExternalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => soundEngine.playUiClick()}
                          className="px-3.5 py-1.5 rounded-full text-[11px] font-extrabold tracking-wider uppercase text-white inline-flex items-center gap-1.5 shadow-sm hover:opacity-95 transition-opacity"
                          style={{ backgroundColor: theme.externalBadgeHex }}
                        >
                          <span>{activeExternalLabel}</span>
                          <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </a>
                        <span
                          className="text-[11px] font-medium tabular-nums"
                          style={{ color: theme.mutedTextHex }}
                        >
                          ({totalLinePriceRespite} RESPITE · {activeTier?.label})
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Horizontal Collection Selector Strip */}
                <div
                  className="pt-3 mt-3 border-t flex items-stretch gap-2 overflow-x-auto pb-1"
                  style={{ borderColor: theme.borderHex }}
                >
                  {displayItems.map((item) => {
                    const isSelected = item.id === activeItem.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          setSelectedItemId(item.id);
                          setQuantity(1);
                        }}
                        className="shrink-0 w-[112px] rounded-2xl border p-2 flex flex-col items-center text-center transition-all cursor-pointer"
                        style={{
                          backgroundColor: isSelected ? '#FFFFFF' : theme.cardBgHex,
                          borderColor: isSelected
                            ? theme.activeNavPillHex
                            : theme.borderHex,
                          boxShadow: isSelected
                            ? `0 0 0 1.5px ${theme.activeNavPillHex}`
                            : 'none',
                        }}
                      >
                        <CatalogItemThumbnail
                          item={item}
                          fallbackPrimaryHex={theme.accentHex}
                          fallbackSecondaryHex={theme.darkButtonHex}
                          fallbackAccentHex={theme.accentHex}
                          sizeClass="w-10 h-10"
                        />
                        <span className="mt-1.5 text-[11px] font-bold truncate w-full">
                          {item.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* VIEW 3: CATALOG (FULL COLLECTION GRID)                          */}
          {/* --------------------------------------------------------------- */}
          {activeTab === 'catalog' && (
            <div className="space-y-4 py-2">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p
                    className="text-[11px] font-extrabold tracking-[0.18em] uppercase"
                    style={{ color: theme.accentHex }}
                  >
                    {isDistrictHub ? activeDistrictDept.storeTitle : config.brandName} · COMPLETE COLLECTION
                  </p>
                  <h1
                    className="text-3xl sm:text-4xl font-bold"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                  >
                    {isDistrictHub ? `${activeDistrictDept.storeTitle} Catalog` : 'Curated Storefront Catalog'}
                  </h1>
                </div>
                <p className="text-xs" style={{ color: theme.mutedTextHex }}>
                  Select any item to inspect on the interactive turntable or order with instant atomic settlement.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayItems.map((item) => {
                  const col = item.colorVariants[0];
                  return (
                    <div
                      key={item.id}
                      className="rounded-[24px] border p-5 flex flex-col justify-between space-y-4 shadow-[0_8px_24px_rgba(35,24,18,0.04)]"
                      style={{
                        backgroundColor: theme.cardBgHex,
                        borderColor: theme.borderHex,
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <span
                            className="text-[10px] font-extrabold tracking-[0.16em] uppercase"
                            style={{ color: theme.accentHex }}
                          >
                            {item.categoryLabel}
                          </span>
                          <h3
                            className="text-xl font-bold"
                            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                          >
                            {item.title}
                          </h3>
                          <p
                            className="text-base font-extrabold tabular-nums"
                            style={{ color: theme.accentHex }}
                          >
                            {item.basePriceRespite} RESPITE
                          </p>
                        </div>
                        <ProductArchetypeArtwork
                          archetype={item.archetype3d}
                          primaryHex={col?.primaryHex ?? theme.accentHex}
                          secondaryHex={col?.secondaryHex ?? theme.darkButtonHex}
                          accentHex={col?.accentHex ?? theme.accentHex}
                          sizeClass="w-16 h-16"
                        />
                      </div>

                      <p
                        className="text-xs leading-relaxed line-clamp-2"
                        style={{ color: theme.mutedTextHex }}
                      >
                        {item.description}
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: theme.borderHex }}>
                        <span className="text-[11px] font-semibold" style={{ color: theme.mutedTextHex }}>
                          Vault Stock: {item.escrowStockCount} · {item.colorVariants.length} Colors
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenProductInShop(item.id)}
                          className="px-4 py-2 rounded-full text-xs font-bold text-white cursor-pointer"
                          style={{ backgroundColor: theme.darkButtonHex }}
                        >
                          Inspect &amp; Order →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* VIEW 4: MY BAG & ATOMIC SETTLEMENT CHECKOUT                     */}
          {/* --------------------------------------------------------------- */}
          {activeTab === 'bag' && (
            <div className="max-w-4xl mx-auto py-3 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p
                    className="text-[11px] font-extrabold tracking-[0.18em] uppercase"
                    style={{ color: theme.accentHex }}
                  >
                    DIRECT WALLET ESCROW CHECKOUT
                  </p>
                  <h1
                    className="text-3xl font-bold"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                  >
                    My Shopping Bag ({totalBagCount})
                  </h1>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('shop')}
                  className="text-xs font-bold underline cursor-pointer"
                  style={{ color: theme.accentHex }}
                >
                  ← Continue Shopping
                </button>
              </div>

              {detailedBagLines.length === 0 ? (
                <div
                  className="rounded-[26px] border p-10 text-center space-y-3"
                  style={{
                    backgroundColor: theme.cardBgHex,
                    borderColor: theme.borderHex,
                  }}
                >
                  <ShoppingBag className="w-10 h-10 mx-auto opacity-45" />
                  <h3 className="text-lg font-bold">Your bag is currently empty</h3>
                  <p className="text-xs max-w-md mx-auto" style={{ color: theme.mutedTextHex }}>
                    Explore the storefront collection, customize colors and options on the turntable, and add items to your bag for instant atomic settlement.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('shop')}
                    className="px-5 py-2.5 rounded-full text-xs font-bold text-white cursor-pointer"
                    style={{ backgroundColor: theme.accentHex }}
                  >
                    Browse Products
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  <div className="lg:col-span-7 space-y-3">
                    {detailedBagLines.map((line) => {
                      const col = line.item.colorVariants[0];
                      return (
                        <div
                          key={line.key}
                          className="rounded-2xl border p-4 flex items-center justify-between gap-4"
                          style={{
                            backgroundColor: theme.cardBgHex,
                            borderColor: theme.borderHex,
                          }}
                        >
                          <div className="flex items-center gap-3.5">
                            <CatalogItemThumbnail
                              item={line.item}
                              fallbackPrimaryHex={col?.primaryHex ?? theme.accentHex}
                              fallbackSecondaryHex={col?.secondaryHex ?? theme.darkButtonHex}
                              fallbackAccentHex={col?.accentHex ?? theme.accentHex}
                              sizeClass="w-14 h-14"
                            />
                            <div>
                              <h4 className="text-sm font-bold">{line.item.title}</h4>
                              <p className="text-xs" style={{ color: theme.mutedTextHex }}>
                                {line.colorLabel} · {line.tierLabel}
                              </p>
                              <p
                                className="mt-1 text-xs font-extrabold tabular-nums"
                                style={{ color: theme.accentHex }}
                              >
                                {line.unitPriceRespite} RESPITE × {line.quantity} ={' '}
                                {line.lineTotalRespite} RESPITE
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              soundEngine.playUiClick();
                              setBagItems((prev) => prev.filter((p) => p.key !== line.key));
                            }}
                            className="p-2 rounded-full hover:bg-black/5 text-rose-700 cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Atomic Settlement Breakdown Card */}
                  <div
                    className="lg:col-span-5 rounded-[24px] border p-5 space-y-4"
                    style={{
                      backgroundColor: theme.cardBgHex,
                      borderColor: theme.borderHex,
                    }}
                  >
                    <h3
                      className="text-xl font-bold"
                      style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                    >
                      Atomic Settlement Summary
                    </h3>
                    {(() => {
                      const split = computeAtomicSaleSettlement(bagSubtotalRespite);
                      return (
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span style={{ color: theme.mutedTextHex }}>Order Subtotal</span>
                            <span className="font-bold tabular-nums">
                              {split.grossRespite} RESPITE
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: theme.mutedTextHex }}>
                              Direct to Store Owner Wallet (97.5%)
                            </span>
                            <span className="font-bold tabular-nums text-emerald-700">
                              {split.ownerSettledRespite} RESPITE
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: theme.mutedTextHex }}>
                              City Commercial Fee (2.5%)
                            </span>
                            <span className="font-semibold tabular-nums">
                              {split.cityFeeRespite} RESPITE
                            </span>
                          </div>
                          <div
                            className="pt-2 border-t flex justify-between text-sm font-extrabold"
                            style={{ borderColor: theme.borderHex }}
                          >
                            <span>Total Settlement</span>
                            <span style={{ color: theme.accentHex }}>
                              {split.grossRespite} RESPITE
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    <p className="text-[11px] leading-relaxed" style={{ color: theme.mutedTextHex }}>
                      Funds settle atomically to {ownerAccountId || 'the store owner'} in a single transaction, and purchased digital items move immediately from the Store Vault into your My Things inventory.
                    </p>

                    <button
                      type="button"
                      onClick={handleCheckoutBagAtomic}
                      className="w-full py-3.5 rounded-full text-xs font-extrabold tracking-wider uppercase text-white shadow-md hover:opacity-95 cursor-pointer"
                      style={{ backgroundColor: theme.accentHex }}
                    >
                      Settle &amp; Purchase Now
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* VIEW 5: MANAGE STORE (OWNER STUDIO, WALLET VAULT & LEASE)       */}
          {/* --------------------------------------------------------------- */}
          {activeTab === 'manage' && canAccessManage && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 py-1">
              {/* Left 4-Col: Store Identity, Billboard, Lease & Atomic Revenue Ledger */}
              <div className="lg:col-span-4 space-y-4">
                {/* Atomic Settlement Revenue Ledger */}
                <div
                  className="rounded-[24px] border p-4 space-y-3"
                  style={{
                    backgroundColor: theme.cardBgHex,
                    borderColor: theme.borderHex,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[10.5px] font-extrabold tracking-[0.16em] uppercase"
                      style={{ color: theme.accentHex }}
                    >
                      ATOMIC SETTLEMENT LEDGER
                    </span>
                    <Wallet className="w-4 h-4" style={{ color: theme.accentHex }} />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-white p-2.5 border" style={{ borderColor: theme.borderHex }}>
                      <p className="text-[10px] uppercase" style={{ color: theme.mutedTextHex }}>
                        Owner Settled
                      </p>
                      <p className="text-sm font-extrabold tabular-nums text-emerald-700">
                        {config.totalSettledOwnerRespite} R
                      </p>
                    </div>
                    <div className="rounded-xl bg-white p-2.5 border" style={{ borderColor: theme.borderHex }}>
                      <p className="text-[10px] uppercase" style={{ color: theme.mutedTextHex }}>
                        Units Sold
                      </p>
                      <p className="text-sm font-extrabold tabular-nums">
                        {config.totalUnitsSold}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white p-2.5 border" style={{ borderColor: theme.borderHex }}>
                      <p className="text-[10px] uppercase" style={{ color: theme.mutedTextHex }}>
                        Vault Stock
                      </p>
                      <p className="text-sm font-extrabold tabular-nums">
                        {config.items.reduce((s, i) => s + i.escrowStockCount, 0)}
                      </p>
                    </div>
                  </div>

                  <p className="text-[11px] leading-relaxed" style={{ color: theme.mutedTextHex }}>
                    97.5% of every visitor purchase settles directly to your connected wallet ({ownerAccountId || 'Owner'}) without requiring a separate claim transaction.
                  </p>
                </div>

                {/* Store Branding & Rooftop Billboard */}
                <div
                  className="rounded-[24px] border p-4 space-y-3"
                  style={{
                    backgroundColor: theme.cardBgHex,
                    borderColor: theme.borderHex,
                  }}
                >
                  <h3 className="text-xs font-extrabold tracking-wider uppercase">
                    Store Brand &amp; Rooftop Billboard
                  </h3>

                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold mb-1" style={{ color: theme.mutedTextHex }}>
                        Store Brand Name
                      </label>
                      <input
                        type="text"
                        value={config.brandName}
                        onChange={(e) =>
                          onUpdateConfig({ ...config, brandName: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border bg-white text-xs font-semibold"
                        style={{ borderColor: theme.borderHex }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: theme.mutedTextHex }}>
                          Category Tag
                        </label>
                        <input
                          type="text"
                          value={config.brandCategory}
                          onChange={(e) =>
                            onUpdateConfig({ ...config, brandCategory: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-xl border bg-white text-xs font-semibold"
                          style={{ borderColor: theme.borderHex }}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: theme.mutedTextHex }}>
                          Footer Tagline
                        </label>
                        <input
                          type="text"
                          value={config.footerTagline}
                          onChange={(e) =>
                            onUpdateConfig({ ...config, footerTagline: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-xl border bg-white text-xs font-semibold"
                          style={{ borderColor: theme.borderHex }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold mb-1" style={{ color: theme.mutedTextHex }}>
                        Rooftop 3D Billboard Logo URL (https:// or /assets/)
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={logoInputUrl}
                          onChange={(e) => setLogoInputUrl(e.target.value)}
                          placeholder="https://... or /assets/..."
                          className="flex-1 px-3 py-2 rounded-xl border bg-white text-xs"
                          style={{ borderColor: theme.borderHex }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playUiClick();
                            const trimmed = logoInputUrl.trim();
                            onUpdateBillboardLogo(trimmed || null);
                            showToast(
                              trimmed
                                ? 'Updated 3D rooftop billboard logo.'
                                : 'Cleared rooftop billboard logo.',
                            );
                          }}
                          className="px-3 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
                          style={{ backgroundColor: theme.darkButtonHex }}
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lease & Building Lifecycle */}
                <div
                  className="rounded-[24px] border p-4 space-y-2.5"
                  style={{
                    backgroundColor: theme.cardBgHex,
                    borderColor: theme.borderHex,
                  }}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span>{isGracePeriod ? 'Grace Period Ends' : 'Lease Expires'}</span>
                    </span>
                    <span className="font-semibold">{leaseExpiresText}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <button
                      type="button"
                      data-lot-rental-extend="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        onExtendLease();
                        showToast(`Extended Lot ${lotSpec?.shortCode ?? lotId} lease by +${termDays}d.`);
                      }}
                      className="py-2 px-2 rounded-xl border bg-white text-[11px] font-bold cursor-pointer hover:bg-black/5"
                      style={{ borderColor: theme.borderHex }}
                    >
                      Extend +{termDays}d
                    </button>
                    <button
                      type="button"
                      data-lot-rental-remove-building="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        onRemoveBuilding();
                      }}
                      className="py-2 px-2 rounded-xl border bg-amber-50 text-amber-900 border-amber-300 text-[11px] font-bold cursor-pointer hover:bg-amber-100"
                    >
                      Unbuild to Bag
                    </button>
                    <button
                      type="button"
                      data-lot-rental-end="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        onEndLease();
                      }}
                      className="py-2 px-2 rounded-xl border bg-rose-50 text-rose-800 border-rose-300 text-[11px] font-bold cursor-pointer hover:bg-rose-100"
                    >
                      End Lease
                    </button>
                  </div>
                </div>
              </div>

              {/* Right 8-Col: 6-Slot Store Vault & Hybrid Product / Ad Link Editor */}
              <div
                className="lg:col-span-8 rounded-[26px] border p-5 space-y-4"
                style={{
                  backgroundColor: theme.cardBgHex,
                  borderColor: theme.borderHex,
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p
                      className="text-[10.5px] font-extrabold tracking-[0.16em] uppercase"
                      style={{ color: theme.accentHex }}
                    >
                      STORE ESCROW VAULT &amp; CATALOG SLOTS (6)
                    </p>
                    <h2
                      className="text-2xl font-bold"
                      style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                    >
                      Stock Digital Assets from Wallet or Add Promotional Links
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      onUpdateConfig(
                        createDefaultLotStorefrontConfig(lotId, buildingFormId),
                      );
                      showToast('Reset storefront catalog to building theme defaults.');
                    }}
                    className="px-3 py-1.5 rounded-full border text-[11px] font-bold flex items-center gap-1.5 bg-white cursor-pointer"
                    style={{ borderColor: theme.borderHex }}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Theme Defaults</span>
                  </button>
                </div>

                {/* 6-Slot Selector Tabs */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {config.items.map((item, idx) => {
                    const isSelected = idx === editingSlotIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          setEditingSlotIndex(idx);
                        }}
                        className="p-2.5 rounded-2xl border text-left transition-all cursor-pointer"
                        style={{
                          backgroundColor: isSelected ? '#FFFFFF' : theme.stageBgHex,
                          borderColor: isSelected
                            ? theme.activeNavPillHex
                            : theme.borderHex,
                          boxShadow: isSelected
                            ? `0 0 0 1.5px ${theme.activeNavPillHex}`
                            : 'none',
                        }}
                      >
                        <p className="text-[10px] font-extrabold uppercase" style={{ color: theme.mutedTextHex }}>
                          Slot #{idx + 1}
                        </p>
                        <p className="text-xs font-bold truncate mt-0.5">{item.title}</p>
                        <p className="text-[10.5px] font-semibold tabular-nums mt-0.5" style={{ color: theme.accentHex }}>
                          {item.basePriceRespite} R · {item.escrowStockCount} stk
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Active Slot Editor + Wallet Inventory Quick-Stock */}
                {editingItem && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1">
                    {/* Left 7-col: Product / Ad Link Fields */}
                    <div className="md:col-span-7 space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold mb-1" style={{ color: theme.mutedTextHex }}>
                            Product / Showcase Title
                          </label>
                          <input
                            type="text"
                            value={editingItem.title}
                            onChange={(e) => updateEditingItem({ title: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border bg-white font-semibold"
                            style={{ borderColor: theme.borderHex }}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold mb-1" style={{ color: theme.mutedTextHex }}>
                            Category Header
                          </label>
                          <input
                            type="text"
                            value={editingItem.categoryLabel}
                            onChange={(e) =>
                              updateEditingItem({ categoryLabel: e.target.value.toUpperCase() })
                            }
                            className="w-full px-3 py-2 rounded-xl border bg-white font-semibold"
                            style={{ borderColor: theme.borderHex }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold mb-1" style={{ color: theme.mutedTextHex }}>
                            Price (RESPITE)
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={editingItem.basePriceRespite}
                            onChange={(e) =>
                              updateEditingItem({
                                basePriceRespite: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                            className="w-full px-3 py-2 rounded-xl border bg-white font-bold tabular-nums"
                            style={{ borderColor: theme.borderHex }}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold mb-1" style={{ color: theme.mutedTextHex }}>
                            Vault Escrow Stock
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={editingItem.escrowStockCount}
                            onChange={(e) =>
                              updateEditingItem({
                                escrowStockCount: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className="w-full px-3 py-2 rounded-xl border bg-white font-bold tabular-nums"
                            style={{ borderColor: theme.borderHex }}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold mb-1" style={{ color: theme.mutedTextHex }}>
                            Display Model
                          </label>
                          <select
                            value={editingItem.archetype3d}
                            onChange={(e) =>
                              updateEditingItem({
                                archetype3d: e.target.value as StoreProduct3DArchetype,
                              })
                            }
                            className="w-full px-2.5 py-2 rounded-xl border bg-white font-semibold"
                            style={{ borderColor: theme.borderHex }}
                          >
                            {ARCHETYPE_OPTIONS.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: theme.mutedTextHex }}>
                          Editorial Description
                        </label>
                        <textarea
                          rows={2}
                          value={editingItem.description}
                          onChange={(e) => updateEditingItem({ description: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border bg-white text-xs"
                          style={{ borderColor: theme.borderHex }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold mb-1" style={{ color: theme.mutedTextHex }}>
                            External Ad / Marketplace URL (Optional)
                          </label>
                          <input
                            type="url"
                            value={editingItem.externalUrl}
                            onChange={(e) =>
                              updateEditingItem({ externalUrl: e.target.value })
                            }
                            placeholder="https://tokopedia.com/... or website"
                            className="w-full px-3 py-2 rounded-xl border bg-white text-xs"
                            style={{ borderColor: theme.borderHex }}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold mb-1" style={{ color: theme.mutedTextHex }}>
                            External Button Label
                          </label>
                          <input
                            type="text"
                            value={editingItem.externalCtaLabel}
                            onChange={(e) =>
                              updateEditingItem({ externalCtaLabel: e.target.value })
                            }
                            placeholder="Buy via Official Link"
                            className="w-full px-3 py-2 rounded-xl border bg-white text-xs font-semibold"
                            style={{ borderColor: theme.borderHex }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right 5-col: Stock Digital Assets Directly from Connected Wallet (My Things) */}
                    <div
                      className="md:col-span-5 rounded-2xl border p-3.5 flex flex-col justify-between space-y-3"
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderColor: theme.borderHex,
                      }}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: theme.accentHex }}>
                            Stock from Your Wallet (My Things)
                          </span>
                          <Sparkles className="w-3.5 h-3.5" style={{ color: theme.accentHex }} />
                        </div>
                        <p className="text-[11px] leading-relaxed" style={{ color: theme.mutedTextHex }}>
                          Select an owned digital asset from your wallet to lock into Slot #{editingSlotIndex + 1} for instant visitor purchase:
                        </p>

                        <div className="max-h-[165px] overflow-y-auto space-y-1.5 pt-1">
                          {walletStockCandidates.length > 0 ? (
                            walletStockCandidates.map((cand) => {
                              const isLinked =
                                editingItem.linkedInventoryItemId === cand.catalogItemId;
                              return (
                                <button
                                  key={cand.catalogItemId}
                                  type="button"
                                  onClick={() =>
                                    handleStockFromWalletCandidate(cand.catalogItemId)
                                  }
                                  className="w-full p-2 rounded-xl border text-left flex items-center justify-between gap-2 hover:bg-black/[0.03] transition-colors cursor-pointer"
                                  style={{
                                    borderColor: isLinked
                                      ? theme.accentHex
                                      : theme.borderHex,
                                  }}
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold truncate">{cand.title}</p>
                                    <p className="text-[10px]" style={{ color: theme.mutedTextHex }}>
                                      {cand.categoryLabel} · Suggested {cand.suggestedPriceRespite} R
                                    </p>
                                  </div>
                                  <span
                                    className="px-2.5 py-1 rounded-full text-[10px] font-bold text-white shrink-0"
                                    style={{
                                      backgroundColor: isLinked
                                        ? '#15803D'
                                        : theme.darkButtonHex,
                                    }}
                                  >
                                    {isLinked ? 'Stocked' : 'Stock →'}
                                  </span>
                                </button>
                              );
                            })
                          ) : (
                            <p className="text-[11px] py-4 text-center" style={{ color: theme.mutedTextHex }}>
                              No extra unplaced wallet items detected. You can customize any slot above or add external brand links.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t gap-2" style={{ borderColor: theme.borderHex }}>
                        {editingItem.linkedInventoryItemId ? (
                          <button
                            type="button"
                            onClick={() => {
                              soundEngine.playUiClick();
                              updateEditingItem({
                                linkedInventoryItemId: null,
                                escrowStockCount: 0,
                              });
                              showToast(
                                `Returned "${editingItem.title}" from Store Vault back to your personal Wallet.`,
                              );
                            }}
                            className="text-[11px] font-bold text-rose-700 hover:underline cursor-pointer"
                          >
                            Return Asset to Wallet
                          </button>
                        ) : (
                          <span className="text-[11px]" style={{ color: theme.mutedTextHex }}>
                            Slot #{editingSlotIndex + 1} Ready
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenProductInShop(editingItem.id)}
                          className="px-3.5 py-1.5 rounded-full text-[11px] font-bold text-white cursor-pointer"
                          style={{ backgroundColor: theme.accentHex }}
                        >
                          Preview in Shop →
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* BOTTOM EDITORIAL FOOTER BAR                                       */}
        {/* ================================================================= */}
        <footer
          className="relative z-20 flex flex-wrap items-center justify-between gap-4 px-6 sm:px-8 py-3 border-t shrink-0"
          style={{
            borderColor: theme.borderHex,
            backgroundColor: isDioramaInteractiveTab ? `${theme.canvasBgHex}EB` : undefined,
          }}
        >
          {/* Left: Store Brand Lockup */}
          <div className="flex items-center gap-2.5">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: theme.accentHex }}
            />
            <div>
              <p className="text-xs font-extrabold leading-tight">
                {isWestPlazaHub
                  ? activeTab === 'shop'
                    ? activeWestDept.storeTitle
                    : 'West Plaza Commercial Hub'
                  : isCentralPlazaHub
                    ? activeTab === 'shop'
                      ? activeCentralDept.storeTitle
                      : 'Central Plaza Lifestyle Hub'
                    : config.brandName}
              </p>
              <p
                className="text-[10px] font-bold tracking-[0.16em] uppercase"
                style={{ color: theme.mutedTextHex }}
              >
                {isWestPlazaHub
                  ? activeTab === 'shop'
                    ? activeWestDept.brandCategory
                    : 'OUTFITS · VEHICLES · APARTMENTS · FURNITURE'
                  : isCentralPlazaHub
                    ? activeTab === 'shop'
                      ? activeCentralDept.brandCategory
                      : 'GLOW · CERRIA BITES & SIPS · RED STUDIO'
                    : config.brandCategory}
              </p>
            </div>
          </div>

          {/* Center: Italic Serif Tagline */}
          <p
            className="hidden md:block text-base italic"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              color: theme.mutedTextHex,
            }}
          >
            {config.footerTagline}{' '}
            <span style={{ color: theme.accentHex }}>♥</span>
          </p>

          {/* Right Spacer to keep tagline optically balanced */}
          <div className="hidden md:block w-[160px]" aria-hidden="true" />
        </footer>
      </div>
    </div>
  );
};
