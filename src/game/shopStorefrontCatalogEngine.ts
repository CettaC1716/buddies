import {
  CITY_RENTAL_LOTS,
  SHOP_BUILDING_FORMS,
  SHOP_BUILDING_FORM_IDS,
  type ShopBuildingFormId,
} from './buddiesCityRentalLotsRules';
import { FASHION_APPAREL_CATALOG_ITEMS } from './buddiesFashionKioskRules';
import { BLENDER_MODULAR_WARDROBE_ITEMS } from './buddiesBlitzGeneratedWardrobeOutfits';
import { URBAN_SCOOTER_CATALOG_ITEMS } from './buddiesUrbanScooterRules';
import { MERCHANT_CATALOG_ITEMS } from './buddiesMerchantPricing';
import { CAFE_MENU_ITEMS, type CafeMenuItemId } from './buddiesCafeRules';
import { CENTRAL_PLAZA_SPECIAL_GIFT_ITEMS } from './npcGiftEngine';
import {
  partitionWardrobeCategoryItems,
  shouldFlipWardrobeThumbY,
  type WardrobeCatalogItem,
} from './buddiesWardrobeStudioRules';
import { HOUSE_OWNERSHIP_PRICE_RESPITE } from '../lib/nearClient';

/**
 * ============================================================================
 * SHOP STOREFRONT CATALOG, WALLET ESCROW VAULT & ATOMIC SETTLEMENT ENGINE
 * ============================================================================
 * Powers the Landscape Editorial Tablet Storefront (`Home` + `Catalog` + `Shop` +
 * `My Bag` + `Manage Store`):
 * - Per-building editorial theme & default curated 6-item 3D catalog:
 *   1. `brick_rooftop_deck`      -> Atelier & Boutique (Warm Terracotta & Espresso)
 *   2. `glass_corner_3story`     -> Circuit & Byte (Cerulean Tech Blue & Slate)
 *   3. `canopy_storefront_2story`-> Maison Botanica (Sage Forest & Warm Brass)
 * - Owner Wallet (`My Things`) -> Store Escrow Vault stocking & unstocking
 * - Hybrid Product Slots: supports in-game digital asset escrow sales (`RESPITE`)
 *   AND/OR external promotional/marketplace links (`externalUrl` / `externalLabel`)
 * - Instant Atomic Settlement on checkout:
 *   - 97.5% settles immediately to the store owner's wallet balance / revenue ledger
 *   - 2.5% commercial district fee
 *   - Escrowed digital asset transfers immediately to the buyer's `My Things`
 */

export const SHOP_STOREFRONT_STORAGE_KEY = 'cerria_shop_storefront_catalog_v1';
export const STORE_ATOMIC_OWNER_SHARE_BPS = 9750; // 97.5% direct to store owner wallet
export const STORE_CITY_TREASURY_FEE_BPS = 250; // 2.5% city commercial tax

export type StoreProduct3DArchetype =
  | 'tailored_coat'
  | 'classic_blazer'
  | 'leather_satchel'
  | 'pleated_dress'
  | 'fedora_hat'
  | 'knit_cardigan'
  | 'pro_gamepad'
  | 'anc_headset'
  | 'ultrabook_laptop'
  | 'flagship_phone'
  | 'pulse_earbuds'
  | 'hifi_speaker'
  | 'pourover_carafe'
  | 'espresso_tin'
  | 'ceramic_mug_set'
  | 'botanical_diffuser'
  | 'matcha_whisk_kit'
  | 'linen_apron'
  | 'urban_scooter'
  | 'apartment_deed'
  | 'shop_building'
  | 'lounge_furniture'
  | 'beauty_palette'
  | 'flower_bouquet'
  | 'gift_box'
  | 'motion_pose';

export type CentralPlazaGiftPreviewKind =
  | 'rose_bouquet'
  | 'sunflower_bouquet'
  | 'lavender_bouquet'
  | 'macaron_box'
  | 'truffle_box'
  | 'tea_set';

export interface StoreProductColorVariant {
  id: string;
  label: string;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
}

export interface StoreProductOptionTier {
  id: string;
  label: string;
  priceDeltaRespite: number;
}

export interface StoreCatalogItem {
  id: string;
  slotIndex: number;
  title: string;
  categoryLabel: string;
  description: string;
  basePriceRespite: number;
  /** Number of units locked in the Store Escrow Vault available for instant purchase. */
  escrowStockCount: number;
  /** Optional linked wallet / My Things catalog item id when stocked from owner's inventory. */
  linkedInventoryItemId: string | null;
  /** 3D procedural turntable model archetype rendered in the interactive showcase stage. */
  archetype3d: StoreProduct3DArchetype;
  colorVariants: StoreProductColorVariant[];
  optionTiers: StoreProductOptionTier[];
  /** Optional external marketplace / promotional URL (e.g. Official Store / Tokopedia / Website). */
  externalUrl: string;
  externalCtaLabel: string;
  /** Optional real 3D GLB model path for the interactive drag-to-rotate product showcase. */
  previewGlbPath?: string;
  /** Optional real image render path for product thumbnails and architectural showcases. */
  previewImageUrl?: string;
  /** True when a UV-exported beauty thumbnail should be vertically flipped upright. */
  previewThumbFlipY?: boolean;
  /** Optional real catalog furniture id rendered via buildOriginalBuddiesCatalogFurnitureMesh. */
  previewFurnitureId?: string;
  /** Optional real 3D scooter kind rendered via buddiesUrbanScooterBuilder. */
  previewScooterKind?: 'electric_scooter_bike' | 'push_kick_scooter';
  /** Optional real 3D cafe food/drink prop rendered via buddiesCafeFoodPropBuilder. */
  previewCafeFoodId?: CafeMenuItemId;
  /** Optional 3D floral / confection gift prop kind for Cerria Bites & Sips. */
  previewGiftKind?: CentralPlazaGiftPreviewKind;
  /** Optional sub-filter group label inside large multi-category stores (e.g. Eyes, Lips, Dances). */
  subGroupLabel?: string;
  /** Optional concise real product spec rows displayed cleanly without fake color/size selectors. */
  previewSpecs?: ReadonlyArray<{ readonly label: string; readonly value: string }>;
  isFeatured: boolean;
  isBestseller: boolean;
}

export interface StoreSaleReceipt {
  id: string;
  lotId: string;
  itemId: string;
  itemTitle: string;
  colorLabel: string;
  tierLabel: string;
  quantity: number;
  grossRespite: number;
  ownerSettledRespite: number;
  cityFeeRespite: number;
  buyerAccountId: string;
  sellerAccountId: string;
  timestampMs: number;
}

export type DistrictPlazaStoreId = 'WEST-PLAZA' | 'CENTRAL-PLAZA';

export interface LotStorefrontConfig {
  lotId: string;
  buildingFormId: ShopBuildingFormId;
  /** Optional custom 3D building GLB path for district flagship dioramas (e.g. Central Plaza Vintage Cafe). */
  customDioramaGlbPath?: string;
  /** Optional Major NPC Manager badge displayed in the tablet header/footer. */
  managerNpcName?: string;
  managerRoleTitle?: string;
  brandName: string;
  brandCategory: string;
  heroHeadlineLines: [string, string, string];
  heroTagsLine: string;
  stickyNoteLines: [string, string, string];
  seasonTag: string;
  seasonHeadline: string;
  seasonSubtitle: string;
  footerTagline: string;
  defaultExternalUrl: string;
  defaultExternalLabel: string;
  items: StoreCatalogItem[];
  /** Cumulative RESPITE settled directly to the store owner's wallet via atomic checkout. */
  totalSettledOwnerRespite: number;
  /** Cumulative 2.5% city fee collected from sales at this storefront. */
  totalCityFeeRespite: number;
  totalUnitsSold: number;
  recentSales: StoreSaleReceipt[];
}

export interface ShopStorefrontThemeTokens {
  formId: ShopBuildingFormId;
  themeName: string;
  canvasBgHex: string;
  cardBgHex: string;
  stageBgHex: string;
  borderHex: string;
  primaryTextHex: string;
  mutedTextHex: string;
  accentHex: string;
  accentSoftBgHex: string;
  activeNavPillHex: string;
  darkButtonHex: string;
  externalBadgeHex: string;
}

export const SHOP_BUILDING_THEMES: Readonly<
  Record<ShopBuildingFormId, ShopStorefrontThemeTokens>
> = {
  brick_rooftop_deck: {
    formId: 'brick_rooftop_deck',
    themeName: 'Heritage Brick Atelier',
    canvasBgHex: '#F5EFE6',
    cardBgHex: '#FAF6F0',
    stageBgHex: '#F1E8DA',
    borderHex: '#E5DDD0',
    primaryTextHex: '#231812',
    mutedTextHex: '#7A685B',
    accentHex: '#A3583D',
    accentSoftBgHex: '#F6E3DC',
    activeNavPillHex: '#E06451',
    darkButtonHex: '#2B1D16',
    externalBadgeHex: '#2E8B57',
  },
  glass_corner_3story: {
    formId: 'glass_corner_3story',
    themeName: 'Modern Glass Flagship',
    canvasBgHex: '#F4EFE8',
    cardBgHex: '#FAF7F2',
    stageBgHex: '#EFE7DA',
    borderHex: '#E3DBD0',
    primaryTextHex: '#18202C',
    mutedTextHex: '#697282',
    accentHex: '#1588D8',
    accentSoftBgHex: '#E1F0FB',
    activeNavPillHex: '#E25B4B',
    darkButtonHex: '#1B222C',
    externalBadgeHex: '#2E8B57',
  },
  canopy_storefront_2story: {
    formId: 'canopy_storefront_2story',
    themeName: 'Botanical Canopy Boutique',
    canvasBgHex: '#F3EFE7',
    cardBgHex: '#F9F6F0',
    stageBgHex: '#EDE6D8',
    borderHex: '#E1DACD',
    primaryTextHex: '#1B2620',
    mutedTextHex: '#68756C',
    accentHex: '#2E6F54',
    accentSoftBgHex: '#E1EFE8',
    activeNavPillHex: '#D66844',
    darkButtonHex: '#1E2A23',
    externalBadgeHex: '#2E8B57',
  },
};

function buildDefaultBrickAtelierCatalog(): StoreCatalogItem[] {
  return [
    {
      id: 'item_trench_coat',
      slotIndex: 0,
      title: 'Trench Coat',
      categoryLabel: 'TAILORING',
      description:
        'Double-breasted heritage trench coat tailored from water-repellent cotton gabardine with storm flaps and horn buckle belt.',
      basePriceRespite: 120,
      escrowStockCount: 6,
      linkedInventoryItemId: null,
      archetype3d: 'tailored_coat',
      colorVariants: [
        {
          id: 'sand_gabardine',
          label: 'Sand Gabardine',
          primaryHex: '#C9AD88',
          secondaryHex: '#8C6C49',
          accentHex: '#D4A857',
        },
        {
          id: 'charcoal_slate',
          label: 'Charcoal Slate',
          primaryHex: '#32363B',
          secondaryHex: '#1E2024',
          accentHex: '#C79B4B',
        },
        {
          id: 'olive_drab',
          label: 'Olive Field',
          primaryHex: '#555E4B',
          secondaryHex: '#383F30',
          accentHex: '#C79B4B',
        },
        {
          id: 'espresso_wool',
          label: 'Espresso Wool',
          primaryHex: '#4A3429',
          secondaryHex: '#2B1D16',
          accentHex: '#D8A95B',
        },
      ],
      optionTiers: [
        { id: 'S', label: 'S', priceDeltaRespite: 0 },
        { id: 'M', label: 'M', priceDeltaRespite: 0 },
        { id: 'L', label: 'L', priceDeltaRespite: 10 },
        { id: 'XL', label: 'XL', priceDeltaRespite: 15 },
      ],
      externalUrl: 'https://near.org',
      externalCtaLabel: 'Official Lookbook',
      isBestseller: true,
      isFeatured: false,
    },
    {
      id: 'item_classic_blazer',
      slotIndex: 1,
      title: 'Classic Blazer',
      categoryLabel: 'TAILORING',
      description:
        'Structured single-breasted blazer with classic notch lapels, twin flap pockets, and soft satin interior lining for casual or formal wear.',
      basePriceRespite: 78,
      escrowStockCount: 8,
      linkedInventoryItemId: null,
      archetype3d: 'classic_blazer',
      colorVariants: [
        {
          id: 'charcoal_slate',
          label: 'Charcoal Slate',
          primaryHex: '#2F3337',
          secondaryHex: '#EAE5DC',
          accentHex: '#C49645',
        },
        {
          id: 'warm_taupe',
          label: 'Warm Taupe',
          primaryHex: '#8C7A6B',
          secondaryHex: '#F3EFEA',
          accentHex: '#C49645',
        },
        {
          id: 'industrial_brick',
          label: 'Industrial Brick',
          primaryHex: '#8E4A39',
          secondaryHex: '#F3EFEA',
          accentHex: '#D1A153',
        },
        {
          id: 'espresso_brown',
          label: 'Espresso Brown',
          primaryHex: '#422F25',
          secondaryHex: '#EDE6DC',
          accentHex: '#C49645',
        },
      ],
      optionTiers: [
        { id: 'S', label: 'S', priceDeltaRespite: 0 },
        { id: 'M', label: 'M', priceDeltaRespite: 0 },
        { id: 'L', label: 'L', priceDeltaRespite: 0 },
        { id: 'XL', label: 'XL', priceDeltaRespite: 8 },
      ],
      externalUrl: 'https://near.org',
      externalCtaLabel: 'Official Lookbook',
      isBestseller: true,
      isFeatured: false,
    },
    {
      id: 'item_leather_bag',
      slotIndex: 2,
      title: 'Leather Bag',
      categoryLabel: 'LEATHER GOODS',
      description:
        'Full-grain vegetable-tanned leather messenger satchel with brushed brass clasp hardware and padded interior compartment.',
      basePriceRespite: 52,
      escrowStockCount: 10,
      linkedInventoryItemId: null,
      archetype3d: 'leather_satchel',
      colorVariants: [
        {
          id: 'cognac_tan',
          label: 'Cognac Saddle',
          primaryHex: '#9A5B32',
          secondaryHex: '#63371B',
          accentHex: '#D9AE5F',
        },
        {
          id: 'obsidian_calf',
          label: 'Obsidian Calf',
          primaryHex: '#242629',
          secondaryHex: '#141517',
          accentHex: '#D5B263',
        },
        {
          id: 'oxblood_hide',
          label: 'Oxblood Hide',
          primaryHex: '#632626',
          secondaryHex: '#3B1515',
          accentHex: '#D9AE5F',
        },
        {
          id: 'sand_suede',
          label: 'Sand Suede',
          primaryHex: '#B89B78',
          secondaryHex: '#7D6549',
          accentHex: '#C89B4B',
        },
      ],
      optionTiers: [
        { id: 'Compact', label: 'Compact', priceDeltaRespite: 0 },
        { id: 'Standard', label: 'Standard', priceDeltaRespite: 8 },
        { id: 'Weekender', label: 'Weekender', priceDeltaRespite: 22 },
      ],
      externalUrl: '',
      externalCtaLabel: '',
      isBestseller: true,
      isFeatured: true,
    },
    {
      id: 'item_pleated_dress',
      slotIndex: 3,
      title: 'Pleated Dress',
      categoryLabel: 'ATELIER SILK',
      description:
        'Flowing midi silhouette with knife-pleated skirt, cinched waist belt, and breathable mulberry silk-linen blend.',
      basePriceRespite: 64,
      escrowStockCount: 5,
      linkedInventoryItemId: null,
      archetype3d: 'pleated_dress',
      colorVariants: [
        {
          id: 'sage_silk',
          label: 'Sage Moss',
          primaryHex: '#6E7F69',
          secondaryHex: '#465442',
          accentHex: '#D2A85D',
        },
        {
          id: 'terracotta_rose',
          label: 'Terracotta Rose',
          primaryHex: '#B56352',
          secondaryHex: '#7D3E31',
          accentHex: '#DFB76C',
        },
        {
          id: 'ivory_pearl',
          label: 'Ivory Pearl',
          primaryHex: '#EAE2D3',
          secondaryHex: '#B8AA96',
          accentHex: '#C99E4E',
        },
        {
          id: 'midnight_ink',
          label: 'Midnight Ink',
          primaryHex: '#273042',
          secondaryHex: '#181E2B',
          accentHex: '#D6B065',
        },
      ],
      optionTiers: [
        { id: 'S', label: 'S', priceDeltaRespite: 0 },
        { id: 'M', label: 'M', priceDeltaRespite: 0 },
        { id: 'L', label: 'L', priceDeltaRespite: 0 },
      ],
      externalUrl: '',
      externalCtaLabel: '',
      isBestseller: true,
      isFeatured: true,
    },
    {
      id: 'item_fedora_hat',
      slotIndex: 4,
      title: 'Fedora Hat',
      categoryLabel: 'MILLINERY',
      description:
        'Hand-blocked Australian merino wool felt fedora trimmed with a grosgrain ribbon band and satin sweatband.',
      basePriceRespite: 34,
      escrowStockCount: 12,
      linkedInventoryItemId: null,
      archetype3d: 'fedora_hat',
      colorVariants: [
        {
          id: 'camel_felt',
          label: 'Camel Felt',
          primaryHex: '#C29B6B',
          secondaryHex: '#4F3724',
          accentHex: '#D5AC5C',
        },
        {
          id: 'espresso_felt',
          label: 'Espresso Felt',
          primaryHex: '#4B3628',
          secondaryHex: '#21160F',
          accentHex: '#C89E51',
        },
        {
          id: 'slate_grey',
          label: 'Slate Grey',
          primaryHex: '#596068',
          secondaryHex: '#23262A',
          accentHex: '#D1A95A',
        },
      ],
      optionTiers: [
        { id: '56cm', label: '56 cm', priceDeltaRespite: 0 },
        { id: '58cm', label: '58 cm', priceDeltaRespite: 0 },
        { id: '60cm', label: '60 cm', priceDeltaRespite: 4 },
      ],
      externalUrl: '',
      externalCtaLabel: '',
      isBestseller: false,
      isFeatured: true,
    },
    {
      id: 'item_knit_cardigan',
      slotIndex: 5,
      title: 'Knit Cardigan',
      categoryLabel: 'KNITWEAR',
      description:
        'Relaxed-fit fisherman cable-knit cardigan spun from soft organic merino wool with tortoise-shell buttons.',
      basePriceRespite: 59,
      escrowStockCount: 7,
      linkedInventoryItemId: null,
      archetype3d: 'knit_cardigan',
      colorVariants: [
        {
          id: 'oatmeal_marl',
          label: 'Oatmeal Marl',
          primaryHex: '#DDD3C2',
          secondaryHex: '#94836D',
          accentHex: '#634832',
        },
        {
          id: 'forest_pine',
          label: 'Forest Pine',
          primaryHex: '#355443',
          secondaryHex: '#21362B',
          accentHex: '#8C6543',
        },
        {
          id: 'rust_amber',
          label: 'Rust Amber',
          primaryHex: '#9E5339',
          secondaryHex: '#6E3622',
          accentHex: '#4B3222',
        },
      ],
      optionTiers: [
        { id: 'S', label: 'S', priceDeltaRespite: 0 },
        { id: 'M', label: 'M', priceDeltaRespite: 0 },
        { id: 'L', label: 'L', priceDeltaRespite: 0 },
        { id: 'XL', label: 'XL', priceDeltaRespite: 6 },
      ],
      externalUrl: '',
      externalCtaLabel: '',
      isBestseller: false,
      isFeatured: true,
    },
  ];
}

function buildDefaultGlassTechCatalog(): StoreCatalogItem[] {
  return [
    {
      id: 'item_pro_gamepad',
      slotIndex: 0,
      title: 'Pro Gamepad',
      categoryLabel: 'GAMING GEAR',
      description:
        'Tournament-grade ergonomic wireless controller featuring Hall-effect magnetic thumbsticks, hair-trigger locks, mechanical D-pad, and dual-color LED accent rings.',
      basePriceRespite: 95,
      escrowStockCount: 9,
      linkedInventoryItemId: null,
      archetype3d: 'pro_gamepad',
      colorVariants: [
        {
          id: 'cyber_black_cyan',
          label: 'Cyber Matte Black & Cyan LED',
          primaryHex: '#22262E',
          secondaryHex: '#14171C',
          accentHex: '#00D2FF',
        },
        {
          id: 'neon_magenta',
          label: 'Neon Magenta & Obsidian',
          primaryHex: '#26212C',
          secondaryHex: '#15121A',
          accentHex: '#FF3D9A',
        },
        {
          id: 'arctic_white',
          label: 'Arctic White & Electric Blue',
          primaryHex: '#E8ECF2',
          secondaryHex: '#2B3240',
          accentHex: '#2563EB',
        },
        {
          id: 'cobalt_lime',
          label: 'Cobalt Pro & Neon Lime',
          primaryHex: '#1E3A8A',
          secondaryHex: '#131C31',
          accentHex: '#84CC16',
        },
      ],
      optionTiers: [
        { id: 'standard', label: 'Standard Wireless', priceDeltaRespite: 0 },
        { id: 'charging_dock', label: 'Pro + Charging Dock', priceDeltaRespite: 22 },
        { id: 'coop_duo', label: 'Co-Op Duo Pack (2x)', priceDeltaRespite: 75 },
      ],
      externalUrl: 'https://near.org',
      externalCtaLabel: 'Buy via Official Partner',
      isBestseller: true,
      isFeatured: false,
    },
    {
      id: 'item_anc_headset',
      slotIndex: 1,
      title: 'ANC Headset',
      categoryLabel: 'STUDIO AUDIO',
      description:
        'Flagship over-ear studio headphones wrapped in matte anodized aluminum and memory-foam lambskin cushions with adaptive hybrid ANC and machined desk stand.',
      basePriceRespite: 140,
      escrowStockCount: 7,
      linkedInventoryItemId: null,
      archetype3d: 'anc_headset',
      colorVariants: [
        {
          id: 'matte_black_silver',
          label: 'Matte Black & Brushed Silver',
          primaryHex: '#232730',
          secondaryHex: '#C4CCD8',
          accentHex: '#38BDF8',
        },
        {
          id: 'midnight_gold',
          label: 'Midnight Navy & Champagne Gold',
          primaryHex: '#1E293B',
          secondaryHex: '#D4AF37',
          accentHex: '#F59E0B',
        },
        {
          id: 'titanium_blue',
          label: 'Titanium Silver & Royal Blue',
          primaryHex: '#D1D5DB',
          secondaryHex: '#1D4ED8',
          accentHex: '#2563EB',
        },
        {
          id: 'graphite_cyan',
          label: 'Cyber Graphite & Neon Cyan',
          primaryHex: '#333842',
          secondaryHex: '#181B20',
          accentHex: '#06B6D4',
        },
      ],
      optionTiers: [
        { id: 'travel_case', label: 'Headphones + Travel Case', priceDeltaRespite: 0 },
        { id: 'studio_stand', label: 'Studio + Aluminum Stand', priceDeltaRespite: 25 },
        { id: 'audiophile_dac', label: 'Audiophile Balanced Kit', priceDeltaRespite: 55 },
      ],
      externalUrl: 'https://near.org',
      externalCtaLabel: 'Buy via Official Partner',
      isBestseller: true,
      isFeatured: false,
    },
    {
      id: 'item_ultrabook_15',
      slotIndex: 2,
      title: 'Ultrabook 15"',
      categoryLabel: 'COMPUTING',
      description:
        'Precision CNC-milled unibody aluminum laptop featuring an edge-to-edge 120Hz OLED display, tactile backlit keyboard, and glass haptic trackpad.',
      basePriceRespite: 260,
      escrowStockCount: 4,
      linkedInventoryItemId: null,
      archetype3d: 'ultrabook_laptop',
      colorVariants: [
        {
          id: 'space_silver',
          label: 'Space Silver & Cyan Wallpaper',
          primaryHex: '#C8D0DC',
          secondaryHex: '#1F242D',
          accentHex: '#0EA5E9',
        },
        {
          id: 'stealth_charcoal',
          label: 'Stealth Matte Charcoal',
          primaryHex: '#2B303A',
          secondaryHex: '#15181E',
          accentHex: '#38BDF8',
        },
        {
          id: 'midnight_sky',
          label: 'Midnight Sky Blue',
          primaryHex: '#273952',
          secondaryHex: '#141E2B',
          accentHex: '#60A5FA',
        },
        {
          id: 'starlight_champagne',
          label: 'Starlight Champagne Aluminum',
          primaryHex: '#D8CEBE',
          secondaryHex: '#28241E',
          accentHex: '#F59E0B',
        },
      ],
      optionTiers: [
        { id: '16_512', label: '16GB RAM / 512GB SSD', priceDeltaRespite: 0 },
        { id: '32_1tb', label: '32GB RAM / 1TB SSD', priceDeltaRespite: 45 },
        { id: '64_2tb', label: '64GB RAM / 2TB SSD', priceDeltaRespite: 95 },
      ],
      externalUrl: 'https://near.org',
      externalCtaLabel: 'Buy via Official Partner',
      isBestseller: true,
      isFeatured: true,
    },
    {
      id: 'item_5g_phone',
      slotIndex: 3,
      title: '5G Phone',
      categoryLabel: 'MOBILE',
      description:
        'Grade-5 titanium smartphone with triple pro-optic camera array, periscope telephoto zoom, and all-day fast-charge battery.',
      basePriceRespite: 185,
      escrowStockCount: 6,
      linkedInventoryItemId: null,
      archetype3d: 'flagship_phone',
      colorVariants: [
        {
          id: 'natural_titanium',
          label: 'Natural Titanium',
          primaryHex: '#9CA3AF',
          secondaryHex: '#1F2937',
          accentHex: '#38BDF8',
        },
        {
          id: 'obsidian_glass',
          label: 'Obsidian Matte Glass',
          primaryHex: '#1F242B',
          secondaryHex: '#111317',
          accentHex: '#60A5FA',
        },
        {
          id: 'cobalt_titanium',
          label: 'Cobalt Blue Titanium',
          primaryHex: '#1E3A8A',
          secondaryHex: '#111827',
          accentHex: '#38BDF8',
        },
      ],
      optionTiers: [
        { id: '256gb', label: '256GB Storage', priceDeltaRespite: 0 },
        { id: '512gb', label: '512GB Storage', priceDeltaRespite: 25 },
        { id: '1tb', label: '1TB Creator Pro', priceDeltaRespite: 55 },
      ],
      externalUrl: '',
      externalCtaLabel: '',
      isBestseller: true,
      isFeatured: true,
    },
    {
      id: 'item_pulse_buds',
      slotIndex: 4,
      title: 'Pulse Buds',
      categoryLabel: 'WIRELESS AUDIO',
      description:
        'Pocket-sized wireless spatial earbuds with translucent charging case, dual dynamic drivers, and low-latency gaming mode.',
      basePriceRespite: 68,
      escrowStockCount: 11,
      linkedInventoryItemId: null,
      archetype3d: 'pulse_earbuds',
      colorVariants: [
        {
          id: 'glacier_white',
          label: 'Glacier White & Cyan',
          primaryHex: '#F1F5F9',
          secondaryHex: '#334155',
          accentHex: '#06B6D4',
        },
        {
          id: 'carbon_black',
          label: 'Carbon Black & Lime',
          primaryHex: '#262B33',
          secondaryHex: '#14171C',
          accentHex: '#84CC16',
        },
      ],
      optionTiers: [
        { id: 'standard', label: 'Standard Case', priceDeltaRespite: 0 },
        { id: 'magsafe_pro', label: 'MagSafe + Lossless Dongle', priceDeltaRespite: 18 },
      ],
      externalUrl: '',
      externalCtaLabel: '',
      isBestseller: false,
      isFeatured: true,
    },
    {
      id: 'item_hifi_speaker',
      slotIndex: 5,
      title: 'Hi-Fi Speaker',
      categoryLabel: 'HOME SOUND',
      description:
        'Sculptural acoustic bookshelf speaker with woven wool grille, brushed aluminum bass woofer, and room-filling 360-degree dispersion.',
      basePriceRespite: 155,
      escrowStockCount: 5,
      linkedInventoryItemId: null,
      archetype3d: 'hifi_speaker',
      colorVariants: [
        {
          id: 'walnut_brass',
          label: 'Warm Walnut & Brass Cone',
          primaryHex: '#6E472B',
          secondaryHex: '#23262C',
          accentHex: '#EAB308',
        },
        {
          id: ' anodized_slate',
          label: 'Anodized Slate & Cyan Woofer',
          primaryHex: '#2E3440',
          secondaryHex: '#181B22',
          accentHex: '#38BDF8',
        },
      ],
      optionTiers: [
        { id: 'single_unit', label: 'Single Studio Unit', priceDeltaRespite: 0 },
        { id: 'stereo_pair', label: 'Matched Stereo Pair (2x)', priceDeltaRespite: 135 },
      ],
      externalUrl: '',
      externalCtaLabel: '',
      isBestseller: false,
      isFeatured: true,
    },
  ];
}

function buildDefaultCanopyBotanicalCatalog(): StoreCatalogItem[] {
  return [
    {
      id: 'item_pourover_carafe',
      slotIndex: 0,
      title: 'Pour-Over Carafe',
      categoryLabel: 'BREW GEAR',
      description:
        'Hand-blown borosilicate glass coffee decanter fitted with a turned American walnut collar and reusable stainless mesh dripper.',
      basePriceRespite: 54,
      escrowStockCount: 8,
      linkedInventoryItemId: null,
      archetype3d: 'pourover_carafe',
      colorVariants: [
        {
          id: 'walnut_amber',
          label: 'Walnut Collar & Amber Glass',
          primaryHex: '#D8C3A5',
          secondaryHex: '#6E492D',
          accentHex: '#C87D55',
        },
        {
          id: 'ash_smoke',
          label: 'Smoked Glass & White Ash',
          primaryHex: '#9CA3AF',
          secondaryHex: '#C4B299',
          accentHex: '#2E6F54',
        },
        {
          id: 'copper_edition',
          label: 'Hammered Copper Collar',
          primaryHex: '#E5DDD0',
          secondaryHex: '#B86B43',
          accentHex: '#D97706',
        },
      ],
      optionTiers: [
        { id: '400ml', label: '400 ml (2 Cups)', priceDeltaRespite: 0 },
        { id: '600ml', label: '600 ml (4 Cups)', priceDeltaRespite: 12 },
        { id: 'barista_set', label: '600 ml + Kettle Set', priceDeltaRespite: 34 },
      ],
      externalUrl: 'https://near.org',
      externalCtaLabel: 'Roastery Journal',
      isBestseller: true,
      isFeatured: false,
    },
    {
      id: 'item_artisan_espresso',
      slotIndex: 1,
      title: 'Artisan Espresso',
      categoryLabel: 'ROASTERY',
      description:
        'Small-batch highlands arabica roasted to a medium-dark chocolate and toasted hazelnut profile, sealed in an embossed keepsake tin.',
      basePriceRespite: 32,
      escrowStockCount: 14,
      linkedInventoryItemId: null,
      archetype3d: 'espresso_tin',
      colorVariants: [
        {
          id: 'forest_tin',
          label: 'Forest Reserve Tin',
          primaryHex: '#2D5A43',
          secondaryHex: '#D4AF37',
          accentHex: '#E6D7C3',
        },
        {
          id: 'terracotta_roast',
          label: 'Terracotta Sunrise Blend',
          primaryHex: '#A6543A',
          secondaryHex: '#E8D8C3',
          accentHex: '#2B1D16',
        },
        {
          id: 'midnight_decaf',
          label: 'Midnight Swiss-Water Tin',
          primaryHex: '#24303C',
          secondaryHex: '#C9A86A',
          accentHex: '#F3EFEA',
        },
      ],
      optionTiers: [
        { id: '250g', label: '250g Whole Bean', priceDeltaRespite: 0 },
        { id: '500g', label: '500g Collector Tin', priceDeltaRespite: 18 },
        { id: 'trio_flight', label: '3-Origin Tasting Flight', priceDeltaRespite: 42 },
      ],
      externalUrl: '',
      externalCtaLabel: '',
      isBestseller: true,
      isFeatured: false,
    },
    {
      id: 'item_ceramic_mug',
      slotIndex: 2,
      title: 'Ceramic Mug Set',
      categoryLabel: 'TABLEWARE',
      description:
        'Wheel-thrown speckled stoneware mugs glazed in satin botanical tones with an unglazed raw clay base that warms comfortably in hand.',
      basePriceRespite: 44,
      escrowStockCount: 9,
      linkedInventoryItemId: null,
      archetype3d: 'ceramic_mug_set',
      colorVariants: [
        {
          id: 'oat_speckle',
          label: 'Oatmeal Speckled Glaze',
          primaryHex: '#E2D9C8',
          secondaryHex: '#9C8265',
          accentHex: '#2E6F54',
        },
        {
          id: 'celadon_moss',
          label: 'Celadon Moss Glaze',
          primaryHex: '#7A9A82',
          secondaryHex: '#8E7358',
          accentHex: '#435E4A',
        },
        {
          id: 'kiln_rust',
          label: 'Kiln Ochre & Clay',
          primaryHex: '#B56B45',
          secondaryHex: '#6E4730',
          accentHex: '#E5D8C5',
        },
      ],
      optionTiers: [
        { id: 'pair_2x', label: 'Pair (2 Mugs)', priceDeltaRespite: 0 },
        { id: 'quartet_4x', label: 'Table Set (4 Mugs)', priceDeltaRespite: 32 },
      ],
      externalUrl: '',
      externalCtaLabel: '',
      isBestseller: true,
      isFeatured: true,
    },
    {
      id: 'item_botanical_diffuser',
      slotIndex: 3,
      title: 'Botanical Diffuser',
      categoryLabel: 'HOME SCENT',
      description:
        'Apothecary amber glass reed diffuser infused with cold-pressed Hinoki cedarwood, wild fig leaf, and bergamot essential oils.',
      basePriceRespite: 48,
      escrowStockCount: 10,
      linkedInventoryItemId: null,
      archetype3d: 'botanical_diffuser',
      colorVariants: [
        {
          id: 'amber_hinoki',
          label: 'Amber Glass · Hinoki & Fig',
          primaryHex: '#8C4A22',
          secondaryHex: '#2B2118',
          accentHex: '#D8C29D',
        },
        {
          id: 'emerald_vetiver',
          label: 'Emerald Glass · Rain Vetiver',
          primaryHex: '#23533D',
          secondaryHex: '#1A241E',
          accentHex: '#D8C29D',
        },
      ],
      optionTiers: [
        { id: '200ml', label: '200 ml Diffuser', priceDeltaRespite: 0 },
        { id: '500ml_refill', label: '200 ml + Refill Bottle', priceDeltaRespite: 24 },
      ],
      externalUrl: '',
      externalCtaLabel: '',
      isBestseller: true,
      isFeatured: true,
    },
    {
      id: 'item_matcha_kit',
      slotIndex: 4,
      title: 'Matcha Whisk Kit',
      categoryLabel: 'TEA CEREMONY',
      description:
        'First-harvest Uji ceremonial matcha paired with a hand-carved 80-prong bamboo chasen whisk and spouted ceramic preparation bowl.',
      basePriceRespite: 62,
      escrowStockCount: 6,
      linkedInventoryItemId: null,
      archetype3d: 'matcha_whisk_kit',
      colorVariants: [
        {
          id: 'jade_ceramic',
          label: 'Jade Glaze & Natural Bamboo',
          primaryHex: '#4E7D5B',
          secondaryHex: '#C9A875',
          accentHex: '#65A30D',
        },
        {
          id: 'charcoal_raku',
          label: 'Charcoal Raku & Dark Bamboo',
          primaryHex: '#333633',
          secondaryHex: '#8C6D46',
          accentHex: '#65A30D',
        },
      ],
      optionTiers: [
        { id: 'ceremonial_set', label: 'Bowl + Whisk + 40g Matcha', priceDeltaRespite: 0 },
        { id: 'master_set', label: 'Full Ceremony Box + 100g', priceDeltaRespite: 28 },
      ],
      externalUrl: '',
      externalCtaLabel: '',
      isBestseller: false,
      isFeatured: true,
    },
    {
      id: 'item_linen_apron',
      slotIndex: 5,
      title: 'Linen Apron',
      categoryLabel: 'WORKSHOP',
      description:
        'Stonewashed Belgian flax linen cross-back apron with deep tool pockets and solid brass hardware for baristas and studio makers.',
      basePriceRespite: 39,
      escrowStockCount: 11,
      linkedInventoryItemId: null,
      archetype3d: 'linen_apron',
      colorVariants: [
        {
          id: 'flax_natural',
          label: 'Raw Flax Linen',
          primaryHex: '#C8B9A0',
          secondaryHex: '#7A634B',
          accentHex: '#C89B4B',
        },
        {
          id: 'sage_canvas',
          label: 'Washed Sage Canvas',
          primaryHex: '#5D7563',
          secondaryHex: '#3A4A3E',
          accentHex: '#C89B4B',
        },
      ],
      optionTiers: [
        { id: 'regular', label: 'Regular Fit', priceDeltaRespite: 0 },
        { id: 'tall', label: 'Long Workshop Cut', priceDeltaRespite: 6 },
      ],
      externalUrl: '',
      externalCtaLabel: '',
      isBestseller: false,
      isFeatured: true,
    },
  ];
}

export type WestPlazaDepartmentId =
  | 'outfits'
  | 'vehicles'
  | 'apartments'
  | 'furniture'
  | 'shop_buildings';

export interface WestPlazaDepartmentSpec {
  id: WestPlazaDepartmentId;
  tabLabel: string;
  storeTag: string;
  storeTitle: string;
  storeSubtitle: string;
  heroTagsLine: string;
  stickyNoteLines: [string, string, string];
  brandCategory: string;
  items: StoreCatalogItem[];
}

export function buildWestPlazaDepartments(): Record<
  WestPlazaDepartmentId,
  WestPlazaDepartmentSpec
> {
  const defaultOptionTier = [{ id: 'standard', label: 'Standard', priceDeltaRespite: 0 }];

  // 1. OUTFITS — Real items from Fashion Boutique & Blender Modular Wardrobe full sets
  const fashionCoreItems: StoreCatalogItem[] = FASHION_APPAREL_CATALOG_ITEMS.map((item, idx) => ({
    id: `wp_outfit_${item.id}`,
    slotIndex: idx,
    title: item.name,
    categoryLabel: item.collectionLabel.toUpperCase(),
    description: item.description,
    basePriceRespite: item.priceLul,
    escrowStockCount: 15,
    linkedInventoryItemId: item.id,
    archetype3d: 'knit_cardigan',
    colorVariants: [
      {
        id: 'default',
        label: item.fitLabel,
        primaryHex: item.accentColor || '#38BDF8',
        secondaryHex: '#231812',
        accentHex: '#D8B78C',
      },
    ],
    optionTiers: defaultOptionTier,
    externalUrl: '',
    externalCtaLabel: '',
    previewGlbPath: item.maleGlbPath,
    previewSpecs: item.specs,
    isBestseller: true,
    isFeatured: true,
  }));

  const signatureSetItems: StoreCatalogItem[] = BLENDER_MODULAR_WARDROBE_ITEMS.filter(
    (w) =>
      w.slot === 'set' &&
      Boolean(w.glbPath) &&
      w.id !== 'bl_set_f_newplayer' &&
      w.id !== 'bl_set_m_newplayer',
  ).map((w, idx) => ({
    id: `wp_outfit_${w.id}`,
    slotIndex: fashionCoreItems.length + idx,
    title: w.name,
    categoryLabel: `${w.gender === 'female' ? 'WOMEN' : 'MEN'} · ${w.collection.toUpperCase()}`,
    description: `${w.subtitle}. Full modular avatar outfit ready to equip in your Wardrobe & Personal Bag.`,
    basePriceRespite: w.priceLul > 0 ? w.priceLul : 25,
    escrowStockCount: 12,
    linkedInventoryItemId: w.id,
    archetype3d: w.gender === 'female' ? 'pleated_dress' : 'classic_blazer',
    colorVariants: [
      {
        id: 'default',
        label: w.collection,
        primaryHex: w.swatchGradient?.[0] || '#475569',
        secondaryHex: w.swatchGradient?.[1] || '#1E293B',
        accentHex: w.accentHex || '#C99B42',
      },
    ],
    optionTiers: defaultOptionTier,
    externalUrl: '',
    externalCtaLabel: '',
    previewGlbPath: w.glbPath ?? undefined,
    previewSpecs: [
      { label: 'Collection', value: w.collection },
      { label: 'Fit', value: w.gender === 'female' ? 'Female Rig' : 'Male Rig' },
      { label: 'Type', value: 'Full Outfit Set' },
      { label: 'Delivery', value: 'Personal Bag' },
    ],
    isBestseller: idx < 3,
    isFeatured: idx >= 2,
  }));

  const outfitItems: StoreCatalogItem[] = [...fashionCoreItems, ...signatureSetItems];

  // 2. VEHICLES — Exact real Urban Scooter Showroom catalog (2 NFT vehicles)
  const vehicleItems: StoreCatalogItem[] = URBAN_SCOOTER_CATALOG_ITEMS.map((veh, idx) => ({
    id: `wp_vehicle_${veh.id}`,
    slotIndex: idx,
    title: veh.name,
    categoryLabel: veh.subtitle.toUpperCase(),
    description: veh.description,
    basePriceRespite: veh.priceRespite,
    escrowStockCount: 10,
    linkedInventoryItemId: veh.id,
    archetype3d: 'urban_scooter',
    colorVariants: [
      {
        id: 'default',
        label: veh.subtitle,
        primaryHex: veh.kind === 'electric_scooter_bike' ? '#F2EFE9' : '#B8BEC7',
        secondaryHex: '#232830',
        accentHex: veh.kind === 'electric_scooter_bike' ? '#2563EB' : '#D97706',
      },
    ],
    optionTiers: defaultOptionTier,
    externalUrl: '',
    externalCtaLabel: '',
    previewScooterKind: veh.kind,
    previewSpecs: veh.specs,
    isBestseller: true,
    isFeatured: true,
  }));

  // 3. APARTMENTS — Real Glass Modern House Deed + Real NFT House Themes
  const houseThemePalette: Record<string, [string, string, string]> = {
    theme_japanese_zen: ['#E8DFD1', '#7A5438', '#E8A5B8'],
    theme_cyber_neon: ['#1F2937', '#0F172A', '#22D3EE'],
    theme_royal_gold: ['#D9B45A', '#3B2C1A', '#F59E0B'],
  };

  const apartmentItems: StoreCatalogItem[] = [
    {
      id: 'wp_apt_glass_modern_house',
      slotIndex: 0,
      title: 'Glass Modern House',
      categoryLabel: 'NFT PROPERTY DEED · PRIVATE RESIDENCE',
      description:
        'Glass-walled modern house wrapped around a private zen garden with lotus pond, bamboo grove, and maple shade, plus a full private cutaway studio inside.',
      basePriceRespite: HOUSE_OWNERSHIP_PRICE_RESPITE,
      escrowStockCount: 20,
      linkedInventoryItemId: 'private_house_deed',
      archetype3d: 'apartment_deed',
      colorVariants: [
        {
          id: 'default',
          label: 'Glass Modern',
          primaryHex: '#E8E3DA',
          secondaryHex: '#2D343E',
          accentHex: '#A6543A',
        },
      ],
      optionTiers: defaultOptionTier,
      externalUrl: '',
      externalCtaLabel: '',
      previewImageUrl: '/assets/kiosk/glass_modern_exterior.jpg',
      previewSpecs: [
        { label: 'Plot Zoning', value: 'Private Residence Deed' },
        { label: 'Architecture', value: 'Glass Modern & Zen Garden' },
        { label: 'Studio Slots', value: '5 Custom Placements' },
        { label: 'Access', value: 'Smartphone · My Apartment' },
      ],
      isBestseller: true,
      isFeatured: true,
    },
    ...MERCHANT_CATALOG_ITEMS.filter((it) => it.category === 'nft_house_theme').map(
      (themeItem, idx) => {
        const [pHex, sHex, aHex] = houseThemePalette[themeItem.id] ?? [
          '#E8DFD1',
          '#3B2C1A',
          '#A6543A',
        ];
        return {
          id: `wp_apt_${themeItem.id}`,
          slotIndex: idx + 1,
          title: themeItem.name,
          categoryLabel: 'HOUSE ARCHITECTURE THEME · NFT',
          description: themeItem.description,
          basePriceRespite: themeItem.basePrice,
          escrowStockCount: themeItem.initialStock,
          linkedInventoryItemId: themeItem.id,
          archetype3d: 'apartment_deed' as const,
          colorVariants: [
            {
              id: 'default',
              label: themeItem.name,
              primaryHex: pHex,
              secondaryHex: sHex,
              accentHex: aHex,
            },
          ],
          optionTiers: defaultOptionTier,
          externalUrl: '',
          externalCtaLabel: '',
          previewImageUrl: '/assets/kiosk/glass_modern_interior.jpg',
          previewSpecs: [
            { label: 'Category', value: 'Exterior & Garden Theme' },
            { label: 'Token Standard', value: 'NEP-245 NFT' },
            { label: 'Apply Inside', value: 'My Apartment Editor' },
            { label: 'Currency', value: themeItem.currency },
          ],
          isBestseller: idx < 2,
          isFeatured: true,
        };
      },
    ),
  ];

  // 4. FURNITURE — Exact all 7 real NFT Collector Furniture items from MERCHANT_CATALOG_ITEMS
  const furnitureSlotLabel: Record<string, string> = {
    center_table: 'Centerpiece Floor Slot',
    left_wall: 'Left Wall Studio Slot',
    right_wall: 'Right Lounge Wall Slot',
    corner_plant: 'Courtyard Corner Slot',
    trophy_pedestal: 'Showcase Pedestal Slot',
  };

  const furnitureItems: StoreCatalogItem[] = MERCHANT_CATALOG_ITEMS.filter(
    (it) => it.category === 'nft_collector_furniture',
  ).map((furn, idx) => ({
    id: `wp_furn_${furn.id}`,
    slotIndex: idx,
    title: furn.name,
    categoryLabel: 'COLLECTOR FURNITURE · NFT',
    description: furn.description,
    basePriceRespite: furn.basePrice,
    escrowStockCount: furn.initialStock,
    linkedInventoryItemId: furn.id,
    archetype3d: 'lounge_furniture',
    colorVariants: [
      {
        id: 'default',
        label: furn.name,
        primaryHex: '#C59A6B',
        secondaryHex: '#4E3724',
        accentHex: '#A6543A',
      },
    ],
    optionTiers: defaultOptionTier,
    externalUrl: '',
    externalCtaLabel: '',
    previewFurnitureId: furn.id,
    previewSpecs: [
      {
        label: 'Interior Slot',
        value: (furn.interiorSlot && furnitureSlotLabel[furn.interiorSlot]) || 'Custom Floor Slot',
      },
      { label: 'Token Standard', value: 'NEP-245 NFT' },
      { label: 'Height', value: furn.height ? `${Math.round(furn.height * 100)} cm` : 'Standard' },
      { label: 'Placement', value: 'Private Apartment' },
    ],
    isBestseller: idx < 4,
    isFeatured: idx >= 2,
  }));

  // 5. SHOP BUILDINGS — Exact all 3 real architectural shop building packages from SHOP_BUILDING_FORMS
  const shopBuildingItems: StoreCatalogItem[] = SHOP_BUILDING_FORM_IDS.map((formId, idx) => {
    const spec = SHOP_BUILDING_FORMS[formId];
    return {
      id: `wp_bldg_${formId}`,
      slotIndex: idx,
      title: spec.name,
      categoryLabel: `SHOP BUILDING · ${spec.stories}-STORY`,
      description: `${spec.subtitle}. ${spec.materialNotes}`,
      basePriceRespite: spec.defaultPriceRespite,
      escrowStockCount: 10,
      linkedInventoryItemId: spec.catalogItemId,
      archetype3d: 'shop_building',
      colorVariants: [
        {
          id: 'default',
          label: spec.name,
          primaryHex: spec.palette.wallHex,
          secondaryHex: spec.palette.trimHex,
          accentHex: spec.palette.accentHex,
        },
      ],
      optionTiers: defaultOptionTier,
      externalUrl: '',
      externalCtaLabel: '',
      previewGlbPath: spec.glbPath,
      previewImageUrl: spec.renderImagePath,
      previewSpecs: [
        { label: 'Stories', value: `${spec.stories} Floors` },
        {
          label: 'Footprint',
          value: `${spec.footprintWidthM.toFixed(1)}m × ${spec.footprintDepthM.toFixed(1)}m`,
        },
        { label: 'Height', value: `${spec.heightM.toFixed(1)}m` },
        { label: 'Rooftop Billboard', value: 'Customizable Logo' },
      ],
      isBestseller: true,
      isFeatured: true,
    };
  });

  return {
    outfits: {
      id: 'outfits',
      tabLabel: 'Outfits',
      storeTag: 'WEST PLAZA BOUTIQUE',
      storeTitle: 'Fashion Boutique',
      storeSubtitle: 'MODULAR OUTFITS · STREETWEAR SETS',
      heroTagsLine: 'MODULAR OUTFITS · STREETWEAR SETS',
      stickyNoteLines: ['Curated by Hana', 'Avatar Outfits ♥', 'West Plaza Style'],
      brandCategory: 'FASHION BOUTIQUE',
      items: outfitItems,
    },
    vehicles: {
      id: 'vehicles',
      tabLabel: 'Vehicles',
      storeTag: 'WEST PLAZA MOBILITY',
      storeTitle: 'Urban Vehicles',
      storeSubtitle: 'ELECTRIC SCOOTER · PUSH KICK SCOOTER',
      heroTagsLine: 'ELECTRIC SCOOTER · PUSH KICK SCOOTER',
      stickyNoteLines: ['Curated by Hana', 'City Mobility ♥', 'Ready to Ride'],
      brandCategory: 'URBAN VEHICLES',
      items: vehicleItems,
    },
    apartments: {
      id: 'apartments',
      tabLabel: 'Apartments',
      storeTag: 'WEST PLAZA RESIDENCES',
      storeTitle: 'Private Apartments',
      storeSubtitle: 'GLASS MODERN HOUSE · ARCHITECTURE THEMES',
      heroTagsLine: 'GLASS MODERN HOUSE · ARCHITECTURE THEMES',
      stickyNoteLines: ['Curated by Hana', 'City Living ♥', 'Private Deeds'],
      brandCategory: 'PRIVATE APARTMENTS',
      items: apartmentItems,
    },
    furniture: {
      id: 'furniture',
      tabLabel: 'Furniture',
      storeTag: 'WEST PLAZA LIVING',
      storeTitle: 'Home & Furniture',
      storeSubtitle: 'INTERIOR DECOR · LIGHTING · COLLECTIBLES',
      heroTagsLine: 'INTERIOR DECOR · LIGHTING · COLLECTIBLES',
      stickyNoteLines: ['Curated by Hana', 'Warm Interiors ♥', 'Crafted Decor'],
      brandCategory: 'HOME & FURNITURE',
      items: furnitureItems,
    },
    shop_buildings: {
      id: 'shop_buildings',
      tabLabel: 'Shop Buildings',
      storeTag: 'WEST PLAZA ARCHITECTURE',
      storeTitle: 'Shop Buildings',
      storeSubtitle: 'COMMERCIAL LOT BUILDINGS · 20×20M LOTS',
      heroTagsLine: 'COMMERCIAL LOTS · 3D ARCHITECTURAL FORMS',
      stickyNoteLines: ['Curated by Hana', 'Commercial Lots ♥', 'Build Your Shop'],
      brandCategory: 'SHOP BUILDINGS',
      items: shopBuildingItems,
    },
  };
}

export type CentralPlazaDepartmentId = 'glow' | 'bites_sips' | 'red_studio';

export interface CentralPlazaDepartmentConfig {
  id: CentralPlazaDepartmentId;
  tabLabel: string;
  storeTag: string;
  storeTitle: string;
  storeSubtitle: string;
  heroTagsLine: string;
  stickyNoteLines: [string, string, string];
  brandCategory: string;
  items: StoreCatalogItem[];
}

function toCentralPlazaRespitePrice(priceLul: number, fallbackRespite: number): number {
  if (!Number.isFinite(priceLul) || priceLul <= 0) return fallbackRespite;
  return Math.max(4, Math.round(priceLul / 5));
}

function interleaveByGroup<T>(groups: readonly T[][]): T[] {
  const result: T[] = [];
  const maxLen = groups.reduce((acc, g) => Math.max(acc, g.length), 0);
  for (let i = 0; i < maxLen; i += 1) {
    for (const group of groups) {
      if (i < group.length) {
        result.push(group[i]);
      }
    }
  }
  return result;
}

export function buildCentralPlazaDepartments(): Record<
  CentralPlazaDepartmentId,
  CentralPlazaDepartmentConfig
> {
  const defaultOptionTier: StoreProductOptionTier[] = [
    { id: 'standard', label: 'Standard', priceDeltaRespite: 0 },
  ];

  // 1. GLOW — All real Face / Makeup items from the Wardrobe Face menu
  const glowSlots: ReadonlyArray<{
    slot:
      | 'face_eyes'
      | 'face_brows'
      | 'face_lips'
      | 'face_eyeshadow'
      | 'face_blush'
      | 'face_facepaint'
      | 'face_beard';
    subGroup: string;
    categoryUpper: string;
    fallbackPalette: [string, string, string];
  }> = [
    {
      slot: 'face_eyes',
      subGroup: 'Eyes',
      categoryUpper: 'GLOW STUDIO · EYES',
      fallbackPalette: ['#6E90B5', '#231812', '#C99B42'],
    },
    {
      slot: 'face_lips',
      subGroup: 'Lips',
      categoryUpper: 'GLOW STUDIO · LIPS',
      fallbackPalette: ['#C85564', '#6E2B35', '#E8B4B8'],
    },
    {
      slot: 'face_brows',
      subGroup: 'Brows',
      categoryUpper: 'GLOW STUDIO · BROWS',
      fallbackPalette: ['#5A4234', '#2C1E16', '#C8A582'],
    },
    {
      slot: 'face_eyeshadow',
      subGroup: 'Eyeshadow',
      categoryUpper: 'GLOW STUDIO · EYESHADOW',
      fallbackPalette: ['#B87E78', '#52323A', '#E2B887'],
    },
    {
      slot: 'face_blush',
      subGroup: 'Blush',
      categoryUpper: 'GLOW STUDIO · BLUSH',
      fallbackPalette: ['#E58F94', '#A64D58', '#F6D5D7'],
    },
    {
      slot: 'face_facepaint',
      subGroup: 'Face Art',
      categoryUpper: 'GLOW STUDIO · FACE ART',
      fallbackPalette: ['#B5825E', '#3A2820', '#E0B973'],
    },
    {
      slot: 'face_beard',
      subGroup: 'Beard',
      categoryUpper: 'GLOW STUDIO · BEARD',
      fallbackPalette: ['#4A372B', '#241913', '#9C7E66'],
    },
  ];

  const glowGroupedLists: StoreCatalogItem[][] = glowSlots.map((slotDef) => {
    const rawItems: WardrobeCatalogItem[] = partitionWardrobeCategoryItems(
      slotDef.slot,
      [],
      'all',
      'featured',
    ).allVisible.filter((w) => !w.isStarterDefault);

    return rawItems.map((w, idx) => {
      const pHex = w.swatchGradient?.[0] || slotDef.fallbackPalette[0];
      const sHex = w.swatchGradient?.[1] || slotDef.fallbackPalette[1];
      const aHex = w.accentHex || slotDef.fallbackPalette[2];
      const fitLabel =
        w.gender === 'female' ? 'Female Face' : w.gender === 'male' ? 'Male Face' : 'Unisex Face';
      return {
        id: `cp_glow_${w.id}`,
        slotIndex: idx,
        title: w.name,
        categoryLabel: slotDef.categoryUpper,
        description: `${w.subtitle}. Unlocks immediately in your Wardrobe Face & Makeup menu.`,
        basePriceRespite: toCentralPlazaRespitePrice(w.priceLul, 8),
        escrowStockCount: 99,
        linkedInventoryItemId: w.id,
        archetype3d: 'beauty_palette',
        colorVariants: [
          {
            id: 'default',
            label: w.collection,
            primaryHex: pHex,
            secondaryHex: sHex,
            accentHex: aHex,
          },
        ],
        optionTiers: defaultOptionTier,
        externalUrl: '',
        externalCtaLabel: '',
        previewImageUrl: w.thumbUrl ?? undefined,
        previewThumbFlipY: shouldFlipWardrobeThumbY(w),
        subGroupLabel: slotDef.subGroup,
        previewSpecs: [
          { label: 'Category', value: slotDef.subGroup },
          { label: 'Collection', value: w.collection },
          { label: 'Fit', value: fitLabel },
          { label: 'Delivery', value: 'Wardrobe · Face' },
        ],
        isBestseller: idx < 2,
        isFeatured: idx < 4,
      };
    });
  });

  const glowItems: StoreCatalogItem[] = interleaveByGroup(glowGroupedLists).map((item, idx) => ({
    ...item,
    slotIndex: idx,
  }));

  // 2. CERRIA BITES & SIPS — NPC-giftable Flowers, Gift Boxes, Food & Drinks
  const giftSpecialItems: StoreCatalogItem[] = CENTRAL_PLAZA_SPECIAL_GIFT_ITEMS.map(
    (gift, idx) => ({
      id: `cp_gift_${gift.id}`,
      slotIndex: idx,
      title: gift.name,
      categoryLabel:
        gift.subCategory === 'flower'
          ? 'CERRIA BITES & SIPS · FLOWERS'
          : 'CERRIA BITES & SIPS · GIFT BOX',
      description: gift.description,
      basePriceRespite: gift.priceRespite,
      escrowStockCount: 30,
      linkedInventoryItemId: gift.id,
      archetype3d: gift.subCategory === 'flower' ? 'flower_bouquet' : 'gift_box',
      colorVariants: [
        {
          id: 'default',
          label: gift.subCategory === 'flower' ? 'Fresh Florals' : 'Gift Box',
          primaryHex: gift.primaryHex,
          secondaryHex: gift.secondaryHex,
          accentHex: gift.accentHex,
        },
      ],
      optionTiers: defaultOptionTier,
      externalUrl: '',
      externalCtaLabel: '',
      previewGiftKind: gift.previewGiftKind,
      subGroupLabel: 'Flowers & Gifts',
      previewSpecs: [
        {
          label: 'Category',
          value:
            gift.subCategory === 'flower'
              ? 'Floral Bouquet'
              : gift.subCategory === 'tea'
                ? 'Artisan Tea Gift'
                : 'Patisserie Gift',
        },
        { label: 'NPC Gifting', value: 'Eligible Gift' },
        { label: 'Wrapping', value: 'Plaza Ribbon Pack' },
        { label: 'Delivery', value: 'Personal Gift Bag' },
      ],
      isBestseller: idx < 3,
      isFeatured: true,
    }),
  );

  const cafeFoodColorMap: Record<CafeMenuItemId, [string, string, string]> = {
    latte: ['#C89A6A', '#4B2E1B', '#F4ECE1'],
    espresso: ['#3B2316', '#1F130C', '#C48A47'],
    iced_latte: ['#D5A879', '#5A3A24', '#E5F2FA'],
    hot_mocha: ['#56301D', '#2A170D', '#E8D5C0'],
    croissant: ['#D9913B', '#8C4E18', '#F6D9A5'],
    sandwich: ['#D8A86C', '#4E7A3C', '#C84B31'],
    cinnamon_roll: ['#C47E3E', '#6B3D1B', '#F9F3E8'],
    donut: ['#E57EA3', '#B8783E', '#FFF3C4'],
    muffin: ['#D49547', '#334E82', '#F4DFB6'],
  };

  const cafeGiftItems: StoreCatalogItem[] = CAFE_MENU_ITEMS.map((food, idx) => {
    const [pHex, sHex, aHex] = cafeFoodColorMap[food.id] ?? ['#C89A6A', '#4B2E1B', '#E5D3BD'];
    const subGroup = food.category === 'drink' ? 'Drinks' : 'Food';
    return {
      id: `cp_cafe_${food.id}`,
      slotIndex: giftSpecialItems.length + idx,
      title: food.name,
      categoryLabel: `CERRIA BITES & SIPS · ${food.category === 'drink' ? 'DRINK' : 'BAKERY'}`,
      description: `${food.prepHint}. Stored in your Personal Gift Bag and ready to gift to any NPC in Cerria.`,
      basePriceRespite: Math.max(4, Math.round(food.priceLul / 2)),
      escrowStockCount: 40,
      linkedInventoryItemId: food.id,
      archetype3d: food.category === 'drink' ? 'pourover_carafe' : 'ceramic_mug_set',
      colorVariants: [
        {
          id: 'default',
          label: subGroup,
          primaryHex: pHex,
          secondaryHex: sHex,
          accentHex: aHex,
        },
      ],
      optionTiers: defaultOptionTier,
      externalUrl: '',
      externalCtaLabel: '',
      previewCafeFoodId: food.id,
      subGroupLabel: subGroup,
      previewSpecs: [
        { label: 'Category', value: food.category === 'drink' ? 'Cafe Beverage' : 'Artisan Food' },
        { label: 'NPC Gifting', value: 'Eligible Gift' },
        {
          label: 'Preparation',
          value: food.category === 'drink' ? 'Fresh Barista Pour' : 'Fresh Bakery Batch',
        },
        { label: 'Delivery', value: 'Personal Gift Bag' },
      ],
      isBestseller: idx < 3,
      isFeatured: idx >= 2,
    };
  });

  const bitesSipsItems: StoreCatalogItem[] = [...giftSpecialItems, ...cafeGiftItems];

  // 3. RED STUDIO — Real Animation Sets, Dances, Poses, Actions & Paired Motions
  const redMotionSlots: ReadonlyArray<{
    slot: 'style_anim' | 'style_dance' | 'style_pose' | 'style_action' | 'style_paired';
    subGroup: string;
    typeLabel: string;
    categoryUpper: string;
    fallbackPalette: [string, string, string];
  }> = [
    {
      slot: 'style_anim',
      subGroup: 'Animation Sets',
      typeLabel: 'Animation Set',
      categoryUpper: 'RED STUDIO · ANIMATION SET',
      fallbackPalette: ['#B84237', '#2B1D16', '#E5B769'],
    },
    {
      slot: 'style_dance',
      subGroup: 'Dances',
      typeLabel: 'Dance Routine',
      categoryUpper: 'RED STUDIO · DANCE',
      fallbackPalette: ['#D45448', '#231812', '#F3C97A'],
    },
    {
      slot: 'style_pose',
      subGroup: 'Poses',
      typeLabel: 'Editorial Pose',
      categoryUpper: 'RED STUDIO · POSE',
      fallbackPalette: ['#A3483D', '#32221B', '#DFB06E'],
    },
    {
      slot: 'style_action',
      subGroup: 'Actions',
      typeLabel: 'Expressive Action',
      categoryUpper: 'RED STUDIO · ACTION',
      fallbackPalette: ['#8F3B34', '#261914', '#E6A75C'],
    },
    {
      slot: 'style_paired',
      subGroup: 'Paired',
      typeLabel: 'Paired Motion',
      categoryUpper: 'RED STUDIO · PAIRED',
      fallbackPalette: ['#C95A52', '#2E1E19', '#F0C38E'],
    },
  ];

  const redGroupedLists: StoreCatalogItem[][] = redMotionSlots.map((slotDef) => {
    const rawItems: WardrobeCatalogItem[] = partitionWardrobeCategoryItems(
      slotDef.slot,
      [],
      'all',
      'featured',
    ).allVisible.filter((w) => !w.isStarterDefault);

    return rawItems.map((w, idx) => {
      const pHex = w.swatchGradient?.[0] || slotDef.fallbackPalette[0];
      const sHex = w.swatchGradient?.[1] || slotDef.fallbackPalette[1];
      const aHex = w.accentHex || slotDef.fallbackPalette[2];
      return {
        id: `cp_red_${w.id}`,
        slotIndex: idx,
        title: w.name,
        categoryLabel: slotDef.categoryUpper,
        description: `${w.subtitle}. Unlocks immediately for your avatar in Wardrobe Style & city emotes.`,
        basePriceRespite: toCentralPlazaRespitePrice(w.priceLul, 12),
        escrowStockCount: 99,
        linkedInventoryItemId: w.id,
        archetype3d: 'motion_pose',
        colorVariants: [
          {
            id: 'default',
            label: slotDef.typeLabel,
            primaryHex: pHex,
            secondaryHex: sHex,
            accentHex: aHex,
          },
        ],
        optionTiers: defaultOptionTier,
        externalUrl: '',
        externalCtaLabel: '',
        subGroupLabel: slotDef.subGroup,
        previewSpecs: [
          { label: 'Motion Type', value: slotDef.typeLabel },
          { label: 'Collection', value: w.collection },
          { label: 'Compatibility', value: 'All Avatars' },
          { label: 'Delivery', value: 'Wardrobe & Emotes' },
        ],
        isBestseller: idx < 2,
        isFeatured: idx < 4,
      };
    });
  });

  const redStudioItems: StoreCatalogItem[] = interleaveByGroup(redGroupedLists).map(
    (item, idx) => ({
      ...item,
      slotIndex: idx,
    }),
  );

  return {
    glow: {
      id: 'glow',
      tabLabel: 'Glow',
      storeTag: 'CENTRAL PLAZA BEAUTY',
      storeTitle: 'Glow Studio',
      storeSubtitle: 'EYES · BROWS · LIPS · BLUSH · BEARD',
      heroTagsLine: 'EYES · BROWS · LIPS · BLUSH · BEARD',
      stickyNoteLines: ['Curated by Nadia', 'Face & Makeup ♥', 'Glow Studio'],
      brandCategory: 'GLOW STUDIO',
      items: glowItems,
    },
    bites_sips: {
      id: 'bites_sips',
      tabLabel: 'Cerria Bites & Sips',
      storeTag: 'CENTRAL PLAZA GIFTS & CAFE',
      storeTitle: 'Cerria Bites & Sips',
      storeSubtitle: 'NPC GIFTS · FLOWERS · FOOD · DRINKS',
      heroTagsLine: 'NPC GIFTS · FLOWERS · FOOD · DRINKS',
      stickyNoteLines: ['Curated by Nadia', 'Gifts & Florals ♥', 'Bites & Sips'],
      brandCategory: 'CERRIA BITES & SIPS',
      items: bitesSipsItems,
    },
    red_studio: {
      id: 'red_studio',
      tabLabel: 'Red Studio',
      storeTag: 'CENTRAL PLAZA MOTION',
      storeTitle: 'Red Studio',
      storeSubtitle: 'ANIMATION SETS · POSES · DANCES · ACTIONS',
      heroTagsLine: 'ANIMATION SETS · POSES · DANCES · ACTIONS',
      stickyNoteLines: ['Curated by Nadia', 'Poses & Dances ♥', 'Red Studio'],
      brandCategory: 'RED STUDIO',
      items: redStudioItems,
    },
  };
}

export function createDistrictPlazaStorefrontConfig(
  plazaId: DistrictPlazaStoreId,
): LotStorefrontConfig {
  if (plazaId === 'WEST-PLAZA') {
    const depts = buildWestPlazaDepartments();
    return {
      lotId: 'WEST-PLAZA',
      buildingFormId: 'brick_rooftop_deck',
      customDioramaGlbPath: '/assets/buildings/shop_brick_rooftop_deck.glb',
      managerNpcName: 'Hana',
      managerRoleTitle: 'West Plaza Commercial & Lifestyle Manager',
      brandName: 'West Plaza Flagship',
      brandCategory: 'OUTFITS · VEHICLES · APARTMENTS · FURNITURE',
      heroHeadlineLines: ['West Plaza', 'Commercial', 'Hub'],
      heroTagsLine: depts.outfits.heroTagsLine,
      stickyNoteLines: depts.outfits.stickyNoteLines,
      seasonTag: depts.outfits.storeTag,
      seasonHeadline: depts.outfits.storeTitle,
      seasonSubtitle: depts.outfits.storeSubtitle,
      footerTagline: 'Managed by Hana · West Plaza Commercial Hub',
      defaultExternalUrl: 'https://near.org',
      defaultExternalLabel: 'West Plaza Lookbook',
      items: depts.outfits.items,
      totalSettledOwnerRespite: 0,
      totalCityFeeRespite: 0,
      totalUnitsSold: 0,
      recentSales: [],
    };
  }

  const centralDepts = buildCentralPlazaDepartments();
  return {
    lotId: 'CENTRAL-PLAZA',
    buildingFormId: 'brick_rooftop_deck',
    customDioramaGlbPath: '/assets/buildings/bites_sips_pavilion.glb',
    managerNpcName: 'Nadia',
    managerRoleTitle: 'Central Plaza Hospitality & Lifestyle Manager',
    brandName: 'Central Plaza Lifestyle Hub',
    brandCategory: 'GLOW · CERRIA BITES & SIPS · RED STUDIO',
    heroHeadlineLines: ['Central Plaza', 'Lifestyle', 'Hub'],
    heroTagsLine: 'GLOW · CERRIA BITES & SIPS · RED STUDIO',
    stickyNoteLines: ['Curated by Nadia', 'Beauty & Gifts ♥', 'Motion Studio'],
    seasonTag: 'CENTRAL PLAZA HUB',
    seasonHeadline: "Nadia's Plaza Edit",
    seasonSubtitle: 'GLOW · CERRIA BITES & SIPS · RED STUDIO',
    footerTagline: 'Managed by Nadia · Central Plaza Lifestyle Hub',
    defaultExternalUrl: '',
    defaultExternalLabel: '',
    items: centralDepts.bites_sips.items,
    totalSettledOwnerRespite: 0,
    totalCityFeeRespite: 0,
    totalUnitsSold: 0,
    recentSales: [],
  };
}

export function createDefaultLotStorefrontConfig(
  lotId: string,
  buildingFormId: ShopBuildingFormId,
): LotStorefrontConfig {
  if (lotId === 'WEST-PLAZA' || lotId === 'CENTRAL-PLAZA') {
    return createDistrictPlazaStorefrontConfig(lotId);
  }
  const lotSpec = CITY_RENTAL_LOTS.find((l) => l.slotId === lotId);
  const shortCode = lotSpec?.shortCode ?? 'N-01';

  if (buildingFormId === 'glass_corner_3story') {
    return {
      lotId,
      buildingFormId,
      brandName: `Circuit & Byte ${shortCode}`,
      brandCategory: 'TECH & AUDIO',
      heroHeadlineLines: ['Future', 'Tech &', 'Sound'],
      heroTagsLine: 'GADGET · AUDIO · GAMING',
      stickyNoteLines: ['OLED & 5G', 'Spatial Audio ♥', 'Pro Gaming'],
      seasonTag: 'SEASON SPECIAL',
      seasonHeadline: 'Next-Gen Tech',
      seasonSubtitle: 'PRO STUDIO & GAMING',
      footerTagline: 'Open Daily · 09:00 – 22:00',
      defaultExternalUrl: 'https://near.org',
      defaultExternalLabel: 'Official Partner Store',
      items: buildDefaultGlassTechCatalog(),
      totalSettledOwnerRespite: 0,
      totalCityFeeRespite: 0,
      totalUnitsSold: 0,
      recentSales: [],
    };
  }

  if (buildingFormId === 'canopy_storefront_2story') {
    return {
      lotId,
      buildingFormId,
      brandName: `Maison Botanica ${shortCode}`,
      brandCategory: 'ROASTERY & LIVING',
      heroHeadlineLines: ['Crafted', 'For Calm', 'Living'],
      heroTagsLine: 'ROASTERY · CERAMICS · BOTANICALS',
      stickyNoteLines: ['Small Batch', 'Slow Pour ♥', 'Artisan Clay'],
      seasonTag: 'SEASON SPECIAL',
      seasonHeadline: 'Morning Rituals',
      seasonSubtitle: 'SMALL-BATCH CRAFT & BREW',
      footerTagline: 'Handcrafted rituals for everyday calm.',
      defaultExternalUrl: 'https://near.org',
      defaultExternalLabel: 'Visit Brand Journal',
      items: buildDefaultCanopyBotanicalCatalog(),
      totalSettledOwnerRespite: 0,
      totalCityFeeRespite: 0,
      totalUnitsSold: 0,
      recentSales: [],
    };
  }

  return {
    lotId,
    buildingFormId,
    brandName: `Atelier & Boutique ${shortCode}`,
    brandCategory: 'FASHION HOUSE',
    heroHeadlineLines: ['Tailored', 'For Art', '& Style'],
    heroTagsLine: 'TAILORED · CRAFT · SILHOUETTE',
    stickyNoteLines: ['Tailored', 'Silhouette ♥', 'Modern Craft'],
    seasonTag: 'SEASON SPECIAL',
    seasonHeadline: 'Tailored Style',
    seasonSubtitle: 'MODERN ARTISAN WEAR',
    footerTagline: 'Tailored silhouettes for everyday art.',
    defaultExternalUrl: 'https://near.org',
    defaultExternalLabel: 'Visit Brand Lookbook',
    items: buildDefaultBrickAtelierCatalog(),
    totalSettledOwnerRespite: 0,
    totalCityFeeRespite: 0,
    totalUnitsSold: 0,
    recentSales: [],
  };
}

export type StorefrontCatalogMap = Record<string, LotStorefrontConfig>;

export function loadPersistedStorefrontCatalogMap(): StorefrontCatalogMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SHOP_STOREFRONT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StorefrontCatalogMap;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

export function savePersistedStorefrontCatalogMap(map: StorefrontCatalogMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SHOP_STOREFRONT_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors in private mode
  }
}

export function resolveLotStorefrontConfig(
  map: StorefrontCatalogMap,
  lotId: string,
  buildingFormId: ShopBuildingFormId,
): LotStorefrontConfig {
  const existing = map[lotId];
  if (lotId === 'WEST-PLAZA' || lotId === 'CENTRAL-PLAZA') {
    const fresh = createDistrictPlazaStorefrontConfig(lotId);
    if (existing) {
      return {
        ...fresh,
        totalSettledOwnerRespite: existing.totalSettledOwnerRespite || 0,
        totalCityFeeRespite: existing.totalCityFeeRespite || 0,
        totalUnitsSold: existing.totalUnitsSold || 0,
        recentSales: existing.recentSales ?? [],
      };
    }
    return fresh;
  }
  if (existing && existing.buildingFormId === buildingFormId && existing.items?.length > 0) {
    return existing;
  }
  return createDefaultLotStorefrontConfig(lotId, buildingFormId);
}

export function computeAtomicSaleSettlement(grossRespite: number): {
  grossRespite: number;
  ownerSettledRespite: number;
  cityFeeRespite: number;
} {
  const cleanGross = Math.max(0, Math.round(grossRespite));
  const cityFeeRespite = Math.max(
    1,
    Math.round((cleanGross * STORE_CITY_TREASURY_FEE_BPS) / 10000),
  );
  const ownerSettledRespite = Math.max(0, cleanGross - cityFeeRespite);
  return {
    grossRespite: cleanGross,
    ownerSettledRespite,
    cityFeeRespite,
  };
}

export interface WalletInventoryStockCandidate {
  catalogItemId: string;
  title: string;
  categoryLabel: string;
  suggestedPriceRespite: number;
  archetype3d: StoreProduct3DArchetype;
  description: string;
}

const WALLET_ASSET_CATALOG_PRESETS: Readonly<Record<string, WalletInventoryStockCandidate>> = {
  fashion_autumn_trench: {
    catalogItemId: 'fashion_autumn_trench',
    title: 'Autumn Heritage Trench',
    categoryLabel: 'COLLECTOR APPAREL',
    suggestedPriceRespite: 135,
    archetype3d: 'tailored_coat',
    description: 'Authenticated wardrobe trench piece stocked directly from owner wallet vault.',
  },
  fashion_velvet_blazer: {
    catalogItemId: 'fashion_velvet_blazer',
    title: 'Velvet Evening Blazer',
    categoryLabel: 'COLLECTOR APPAREL',
    suggestedPriceRespite: 95,
    archetype3d: 'classic_blazer',
    description: 'Tailored evening jacket locked in storefront escrow for instant settlement.',
  },
  scooter_vespa_mint: {
    catalogItemId: 'scooter_vespa_mint',
    title: 'Mint Collector Edition Kit',
    categoryLabel: 'MOBILITY & GEAR',
    suggestedPriceRespite: 210,
    archetype3d: 'pro_gamepad',
    description: 'Verified citizen mobility & controller kit stocked from owner My Things vault.',
  },
  furniture_arcade_cabinet: {
    catalogItemId: 'furniture_arcade_cabinet',
    title: 'Retro Neon Gaming Rig',
    categoryLabel: 'COLLECTOR HARDWARE',
    suggestedPriceRespite: 165,
    archetype3d: 'ultrabook_laptop',
    description: 'Collector-grade interactive hardware unit backed 1:1 in store escrow.',
  },
};

export function buildOwnerWalletStockCandidates(
  ownedCatalogItemIds: readonly string[],
): WalletInventoryStockCandidate[] {
  const out: WalletInventoryStockCandidate[] = [];
  const seen = new Set<string>();
  const shopFormCatalogIds = new Set(
    Object.values(SHOP_BUILDING_FORMS).map((f) => f.catalogItemId),
  );

  for (const id of ownedCatalogItemIds) {
    if (!id || seen.has(id) || shopFormCatalogIds.has(id)) continue;
    seen.add(id);
    const preset = WALLET_ASSET_CATALOG_PRESETS[id];
    if (preset) {
      out.push(preset);
      continue;
    }
    const cleanTitle = id
      .replace(/^(fashion_|furniture_|scooter_|item_|cafe_)/i, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const isTech = /arcade|neon|cyber|scooter| audio|speaker|phone/i.test(id);
    const isBotanical = /cafe|coffee|tea|plant|sofa|lamp|oak/i.test(id);
    out.push({
      catalogItemId: id,
      title: cleanTitle || 'Digital Collector Asset',
      categoryLabel: isTech
        ? 'DIGITAL HARDWARE'
        : isBotanical
          ? 'ARTISAN COLLECTIBLE'
          : 'WARDROBE & EDITION',
      suggestedPriceRespite: isTech ? 120 : 65,
      archetype3d: isTech
        ? 'anc_headset'
        : isBotanical
          ? 'pourover_carafe'
          : 'leather_satchel',
      description: `Verified digital asset (${cleanTitle}) deposited from the store owner's wallet into Store Escrow for instant atomic purchase.`,
    });
  }

  return out;
}
