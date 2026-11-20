import type { BuddyModularOutfitUrls } from './buddiesBlitzShadersAndAssets';
import {
  DEFAULT_NEUTRAL_FACE_CUSTOMIZATION,
  type BuddyFaceCustomizationProfile,
  type WardrobeBrowStyleSpec,
  type WardrobeEyeStyleSpec,
  type WardrobeLipStyleSpec,
} from './buddiesFaceCompositor';

export type WardrobeStudioCategoryId =
  | 'presets'
  | 'top'
  | 'bottoms'
  | 'set'
  | 'hair'
  | 'shoes'
  | 'body_shape'
  | 'face_eyes'
  | 'face_brows'
  | 'face_lips'
  | 'style_anim'
  | 'style_dance';
export type WardrobeFaceCategoryId = 'face_eyes' | 'face_brows' | 'face_lips';
export type WardrobeStyleCategoryId = 'style_anim' | 'style_dance' | 'style_tint';
export type WardrobeItemGender = 'male' | 'female' | 'unisex';
export type WardrobeBottomTabId = 'character' | 'face' | 'body' | 'style' | 'outfit' | 'shop';
export type WardrobeFilterMode = 'all' | 'owned' | 'shop';
export type WardrobeSortMode = 'featured' | 'price_asc' | 'price_desc';
export type WardrobeCameraFraming = 'full' | 'upper' | 'face';
export type WardrobePoseId = 'casual' | 'runway' | 'relaxed';
export type WardrobeGlassPreference = 'auto' | 'smoked_pseudo' | 'frosted_blur';
export type ResolvedWardrobeGlassMode = 'smoked_pseudo' | 'frosted_blur';

export interface WardrobeBodyShapeProfile {
  /**
   * Real blend-shape (morph target) weights driven directly on `blitz-male-player.glb`,
   * `blitz-female-player.glb`, and all new-generation Blitz NPC garments (`blitz-*-01..04.glb`).
   */
  morphWeights: Record<string, number>;
  /** Vertical stature multiplier (1.0 = default BaseDoll height). */
  heightScale: number;
  /** Horizontal shoulder/frame multiplier (1.0 = default BaseDoll width). */
  widthScale: number;
  /**
   * Optional future-proof override URL when a Body Shape swaps to a radically
   * different topology/skeleton BaseDoll GLB (e.g. Chibi or Stylized Hero).
   */
  baseDollGlbUrl?: string | null;
  /** Short badge descriptor for the silhouette (e.g. "Balanced", "Curvy"). */
  silhouetteTag: string;
}

export const DEFAULT_NEUTRAL_BODY_SHAPE: WardrobeBodyShapeProfile = {
  morphWeights: {},
  heightScale: 1.0,
  widthScale: 1.0,
  baseDollGlbUrl: null,
  silhouetteTag: 'Balanced',
};

export type WardrobeDanceKind =
  | 'none'
  | 'groove'
  | 'wave'
  | 'cheer'
  | 'salute'
  | 'idol_pop'
  | 'hiphop';

export interface WardrobeAnimSetSpec {
  /** Pre-sanitized clip priority order available on BuddyCharacterRig.customGlbController.clips */
  clipCandidates: readonly string[];
  vibeTag: string;
}

export interface WardrobeDancePoseSpec {
  danceKind: WardrobeDanceKind;
  tempoBpm: number;
  vibeTag: string;
}

export interface WardrobeCatalogItem {
  id: string;
  slot: Exclude<WardrobeStudioCategoryId, 'presets'>;
  gender: WardrobeItemGender;
  name: string;
  subtitle: string;
  collection: string;
  priceLul: number;
  isStarterDefault: boolean;
  glbPath: string | null;
  bodyShape?: WardrobeBodyShapeProfile;
  eyeStyle?: WardrobeEyeStyleSpec;
  browStyle?: WardrobeBrowStyleSpec;
  lipStyle?: WardrobeLipStyleSpec;
  animSet?: WardrobeAnimSetSpec;
  dancePose?: WardrobeDancePoseSpec;
  swatchGradient: [string, string];
  accentHex: string;
}

export interface WardrobeOutfitDraft {
  topId: string | null;
  bottomsId: string | null;
  shoesId: string | null;
  hairId: string | null;
  setId: string | null;
  bodyShapeId: string | null;
  eyeStyleId: string | null;
  browStyleId: string | null;
  lipStyleId: string | null;
  animSetId: string | null;
  dancePoseId: string | null;
  clothingTintHex: string | null;
}

export interface WardrobeSavedPreset {
  id: string;
  name: string;
  createdAtMs: number;
  isBuiltIn?: boolean;
  gender?: WardrobeItemGender;
  draft: WardrobeOutfitDraft;
  accentGradient: [string, string];
}

export interface WardrobeHistoryState {
  past: WardrobeOutfitDraft[];
  present: WardrobeOutfitDraft;
  future: WardrobeOutfitDraft[];
}

export interface WardrobeTintSwatch {
  id: string;
  label: string;
  hex: string | null;
  previewHex: string;
}

export interface WardrobePoseSpec {
  id: WardrobePoseId;
  label: string;
  animUrl: string;
}

export const EMPTY_WARDROBE_DRAFT: WardrobeOutfitDraft = {
  topId: null,
  bottomsId: null,
  shoesId: null,
  hairId: null,
  setId: null,
  bodyShapeId: null,
  eyeStyleId: null,
  browStyleId: null,
  lipStyleId: null,
  animSetId: null,
  dancePoseId: null,
  clothingTintHex: null,
};

export const WARDROBE_STUDIO_POSES: readonly WardrobePoseSpec[] = [
  {
    id: 'casual',
    label: 'Casual Idle',
    animUrl: '/assets/idle-2-anim.glb',
  },
  {
    id: 'runway',
    label: 'Runway Pose',
    animUrl: '/assets/character_custom_idle_runway_catwalk_stylish_11 (3).glb',
  },
  {
    id: 'relaxed',
    label: 'Studio Calm',
    animUrl: '/assets/character_custom_idle_elegan_kalem_4.glb',
  },
] as const;

export const WARDROBE_CLOTHING_TINT_SWATCHES: readonly WardrobeTintSwatch[] = [
  { id: 'original', label: 'Original', hex: null, previewHex: '#e2e8f0' },
  { id: 'rose_blush', label: 'Rose Blush', hex: '#f4a4c0', previewHex: '#f4a4c0' },
  { id: 'sky_mist', label: 'Sky Mist', hex: '#8ecae6', previewHex: '#8ecae6' },
  { id: 'warm_sand', label: 'Warm Sand', hex: '#e6ccb2', previewHex: '#e6ccb2' },
  { id: 'sage_leaf', label: 'Sage Leaf', hex: '#a3c9a8', previewHex: '#a3c9a8' },
  { id: 'lavender_fog', label: 'Lavender', hex: '#c8b6ff', previewHex: '#c8b6ff' },
  { id: 'amber_gold', label: 'Amber', hex: '#f4c95d', previewHex: '#f4c95d' },
  { id: 'slate_noir', label: 'Charcoal', hex: '#475569', previewHex: '#475569' },
  { id: 'crimson_pop', label: 'Crimson', hex: '#e05a6d', previewHex: '#e05a6d' },
] as const;

/**
 * Next-Gen Morph-Ready Modular Wardrobe Catalog powered exclusively by the new
 * Blitz BaseDoll + NPC outfits (`blitz-female-01..04.glb` & `blitz-male-01..04.glb`).
 * Every paid garment shares the exact baked Body Shape morph targets (`Bust_Size`,
 * `Chest_Build`, `Shoulder_Width`, `Arm_Muscle`, `Waist_Slim`, `Hip_Width`,
 * `Glute_Projection`, `Thigh_Fullness`) with the player BaseDoll for zero-clipping fit.
 */
export const WARDROBE_STUDIO_ITEMS: readonly WardrobeCatalogItem[] = [
  // =========================================================================
  // STARTER DEFAULTS (Unisex · Free / Owned)
  // =========================================================================
  {
    id: 'starter_top_default',
    slot: 'top',
    gender: 'unisex',
    name: 'Classic City Tee',
    subtitle: 'Starter Everyday Top',
    collection: 'Starter Essentials',
    priceLul: 0,
    isStarterDefault: true,
    glbPath: null,
    swatchGradient: ['#f8fafc', '#cbd5e1'],
    accentHex: '#94a3b8',
  },
  {
    id: 'starter_bottoms_default',
    slot: 'bottoms',
    gender: 'unisex',
    name: 'Classic City Bottoms',
    subtitle: 'Starter Everyday Fit',
    collection: 'Starter Essentials',
    priceLul: 0,
    isStarterDefault: true,
    glbPath: null,
    swatchGradient: ['#334155', '#0f172a'],
    accentHex: '#64748b',
  },
  {
    id: 'starter_shoes_default',
    slot: 'shoes',
    gender: 'unisex',
    name: 'Classic Low Sneakers',
    subtitle: 'Starter Everyday Footwear',
    collection: 'Starter Essentials',
    priceLul: 0,
    isStarterDefault: true,
    glbPath: null,
    swatchGradient: ['#e2e8f0', '#94a3b8'],
    accentHex: '#cbd5e1',
  },
  {
    id: 'starter_hair_default',
    slot: 'hair',
    gender: 'unisex',
    name: 'Classic Studio Cut',
    subtitle: 'Starter Everyday Hair',
    collection: 'Starter Essentials',
    priceLul: 0,
    isStarterDefault: true,
    glbPath: null,
    swatchGradient: ['#27272a', '#09090b'],
    accentHex: '#71717a',
  },

  // =========================================================================
  // FEMALE NEW-GEN NPC OUTFITS (blitz-female-01..04.glb · Full Morph Targets)
  // =========================================================================
  // --- Female Tops ---
  {
    id: 'blitz_f01_top',
    slot: 'top',
    gender: 'female',
    name: 'Noir Halter Top',
    subtitle: 'Morph-Fit Atelier Cut',
    collection: 'Noir Atelier · 01',
    priceLul: 16,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-female-01.glb#slot=torso',
    swatchGradient: ['#334155', '#09090b'],
    accentHex: '#94a3b8',
  },
  {
    id: 'blitz_f02_top',
    slot: 'top',
    gender: 'female',
    name: 'Chic Studio Top',
    subtitle: 'Tailored Modern Fit',
    collection: 'City Chic · 02',
    priceLul: 16,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-female-02.glb#slot=torso',
    swatchGradient: ['#fda4af', '#be185d'],
    accentHex: '#fb7185',
  },
  {
    id: 'blitz_f03_top',
    slot: 'top',
    gender: 'female',
    name: 'Academy Street Top',
    subtitle: 'Crisp Layered Campus Cut',
    collection: 'Academy Street · 03',
    priceLul: 15,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-female-03.glb#slot=torso',
    swatchGradient: ['#38bdf8', '#1d4ed8'],
    accentHex: '#38bdf8',
  },
  {
    id: 'blitz_f04_top',
    slot: 'top',
    gender: 'female',
    name: 'Urban Luxe Top',
    subtitle: 'Signature Runway Silhouette',
    collection: 'Urban Luxe · 04',
    priceLul: 18,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-female-04.glb#slot=torso',
    swatchGradient: ['#c084fc', '#6b21a8'],
    accentHex: '#a855f7',
  },

  // --- Female Bottoms ---
  {
    id: 'blitz_f01_bottoms',
    slot: 'bottoms',
    gender: 'female',
    name: 'Chain Mini Skirt',
    subtitle: 'Noir Belted Chain Fit',
    collection: 'Noir Atelier · 01',
    priceLul: 15,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-female-01.glb#slot=legs',
    swatchGradient: ['#27272a', '#09090b'],
    accentHex: '#71717a',
  },
  {
    id: 'blitz_f02_bottoms',
    slot: 'bottoms',
    gender: 'female',
    name: 'Tailored Studio Trousers',
    subtitle: 'High-Waist Morph-Fit',
    collection: 'City Chic · 02',
    priceLul: 16,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-female-02.glb#slot=legs',
    swatchGradient: ['#fb7185', '#881337'],
    accentHex: '#f43f5e',
  },
  {
    id: 'blitz_f03_bottoms',
    slot: 'bottoms',
    gender: 'female',
    name: 'Academy Denim Shorts',
    subtitle: 'Relaxed Everyday Street Cut',
    collection: 'Academy Street · 03',
    priceLul: 14,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-female-03.glb#slot=legs',
    swatchGradient: ['#60a5fa', '#1e3a8a'],
    accentHex: '#3b82f6',
  },
  {
    id: 'blitz_f04_bottoms',
    slot: 'bottoms',
    gender: 'female',
    name: 'Urban Luxe Trousers',
    subtitle: 'Sculpted Editorial Cut',
    collection: 'Urban Luxe · 04',
    priceLul: 16,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-female-04.glb#slot=legs',
    swatchGradient: ['#a78bfa', '#4c1d95'],
    accentHex: '#8b5cf6',
  },

  // --- Female Shoes ---
  {
    id: 'blitz_f01_shoes',
    slot: 'shoes',
    gender: 'female',
    name: 'Noir Stiletto Heels',
    subtitle: 'Sleek Runway Heels',
    collection: 'Noir Atelier · 01',
    priceLul: 12,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-female-01.glb#slot=feet',
    swatchGradient: ['#3f3f46', '#09090b'],
    accentHex: '#a1a1aa',
  },
  {
    id: 'blitz_f02_shoes',
    slot: 'shoes',
    gender: 'female',
    name: 'Atelier Block Heels',
    subtitle: 'Polished Evening Footwear',
    collection: 'City Chic · 02',
    priceLul: 12,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-female-02.glb#slot=feet',
    swatchGradient: ['#f9a8d4', '#9d174d'],
    accentHex: '#ec4899',
  },
  {
    id: 'blitz_f03_shoes',
    slot: 'shoes',
    gender: 'female',
    name: 'Academy Court Sneakers',
    subtitle: 'Lightweight City Runners',
    collection: 'Academy Street · 03',
    priceLul: 12,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-female-03.glb#slot=feet',
    swatchGradient: ['#bae6fd', '#0369a1'],
    accentHex: '#0ea5e9',
  },
  {
    id: 'blitz_f04_shoes',
    slot: 'shoes',
    gender: 'female',
    name: 'Urban Luxe Sneakers',
    subtitle: 'Sculpted Platform Sole',
    collection: 'Urban Luxe · 04',
    priceLul: 13,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-female-04.glb#slot=feet',
    swatchGradient: ['#ddd6fe', '#5b21b6'],
    accentHex: '#8b5cf6',
  },

  // --- Female Hair ---
  {
    id: 'blitz_f01_hair',
    slot: 'hair',
    gender: 'female',
    name: 'Long Wave Hair',
    subtitle: 'Flowing Shoulder Waves',
    collection: 'Noir Atelier · 01',
    priceLul: 10,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-female-01.glb#slot=hair',
    swatchGradient: ['#52525b', '#18181b'],
    accentHex: '#a1a1aa',
  },
  {
    id: 'blitz_f02_hair',
    slot: 'hair',
    gender: 'female',
    name: 'Silky Back-Long Hair',
    subtitle: 'Sleek Straight Studio Cut',
    collection: 'City Chic · 02',
    priceLul: 10,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-female-02.glb#slot=hair',
    swatchGradient: ['#92400e', '#451a03'],
    accentHex: '#d97706',
  },
  {
    id: 'blitz_f03_hair',
    slot: 'hair',
    gender: 'female',
    name: 'Academy Layered Cut',
    subtitle: 'Soft Framed Bangs',
    collection: 'Academy Street · 03',
    priceLul: 10,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-female-03.glb#slot=hair',
    swatchGradient: ['#78350f', '#292524'],
    accentHex: '#f59e0b',
  },
  {
    id: 'blitz_f04_hair',
    slot: 'hair',
    gender: 'female',
    name: 'Urban Luxe Styling',
    subtitle: 'Modern Editorial Volume',
    collection: 'Urban Luxe · 04',
    priceLul: 11,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-female-04.glb#slot=hair',
    swatchGradient: ['#6366f1', '#312e81'],
    accentHex: '#818cf8',
  },

  // --- Female Full Sets ---
  {
    id: 'blitz_f01_set',
    slot: 'set',
    gender: 'female',
    name: 'Noir Atelier Set',
    subtitle: 'Halter Top · Chain Skirt · Heels · Acc',
    collection: 'Noir Atelier · 01',
    priceLul: 34,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-female-01.glb#slot=costume',
    swatchGradient: ['#475569', '#09090b'],
    accentHex: '#e2e8f0',
  },
  {
    id: 'blitz_f02_set',
    slot: 'set',
    gender: 'female',
    name: 'City Chic Ensemble',
    subtitle: 'Studio Top · Trousers · Block Heels',
    collection: 'City Chic · 02',
    priceLul: 34,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-female-02.glb#slot=costume',
    swatchGradient: ['#f472b6', '#881337'],
    accentHex: '#fb7185',
  },
  {
    id: 'blitz_f03_set',
    slot: 'set',
    gender: 'female',
    name: 'Academy Street Set',
    subtitle: 'Street Top · Denim Shorts · Sneakers',
    collection: 'Academy Street · 03',
    priceLul: 32,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-female-03.glb#slot=costume',
    swatchGradient: ['#38bdf8', '#1e3a8a'],
    accentHex: '#38bdf8',
  },
  {
    id: 'blitz_f04_set',
    slot: 'set',
    gender: 'female',
    name: 'Urban Luxe Ensemble',
    subtitle: 'Luxe Top · Trousers · Sneakers',
    collection: 'Urban Luxe · 04',
    priceLul: 36,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-female-04.glb#slot=costume',
    swatchGradient: ['#c084fc', '#4c1d95'],
    accentHex: '#a855f7',
  },

  // =========================================================================
  // MALE NEW-GEN NPC OUTFITS (blitz-male-01..04.glb · Full Morph Targets)
  // =========================================================================
  // --- Male Tops ---
  {
    id: 'blitz_m01_top',
    slot: 'top',
    gender: 'male',
    name: 'Plaza Street Top',
    subtitle: 'Morph-Fit Athletic Cut',
    collection: 'Plaza Street · 01',
    priceLul: 16,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-male-01.glb#slot=torso',
    swatchGradient: ['#38bdf8', '#1e3a8a'],
    accentHex: '#38bdf8',
  },
  {
    id: 'blitz_m02_top',
    slot: 'top',
    gender: 'male',
    name: 'Metro Layered Top',
    subtitle: 'Urban Tailored Layer',
    collection: 'Metro Layered · 02',
    priceLul: 17,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-male-02.glb#slot=torso',
    swatchGradient: ['#475569', '#0f172a'],
    accentHex: '#64748b',
  },
  {
    id: 'blitz_m03_top',
    slot: 'top',
    gender: 'male',
    name: 'Studio Casual Top',
    subtitle: 'Relaxed Modern Fit',
    collection: 'Studio Casual · 03',
    priceLul: 15,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-male-03.glb#slot=torso',
    swatchGradient: ['#34d399', '#065f46'],
    accentHex: '#10b981',
  },
  {
    id: 'blitz_m04_top',
    slot: 'top',
    gender: 'male',
    name: 'Vanguard Jacket Top',
    subtitle: 'Structured Street Outerwear',
    collection: 'Vanguard Urban · 04',
    priceLul: 18,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-male-04.glb#slot=torso',
    swatchGradient: ['#facc15', '#b45309'],
    accentHex: '#f59e0b',
  },

  // --- Male Bottoms ---
  {
    id: 'blitz_m01_bottoms',
    slot: 'bottoms',
    gender: 'male',
    name: 'Plaza Street Pants',
    subtitle: 'Tapered Everyday Cut',
    collection: 'Plaza Street · 01',
    priceLul: 15,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-male-01.glb#slot=legs',
    swatchGradient: ['#60a5fa', '#1e293b'],
    accentHex: '#3b82f6',
  },
  {
    id: 'blitz_m02_bottoms',
    slot: 'bottoms',
    gender: 'male',
    name: 'Metro Relaxed Trousers',
    subtitle: 'Clean City Drape',
    collection: 'Metro Layered · 02',
    priceLul: 15,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-male-02.glb#slot=legs',
    swatchGradient: ['#64748b', '#0f172a'],
    accentHex: '#94a3b8',
  },
  {
    id: 'blitz_m03_bottoms',
    slot: 'bottoms',
    gender: 'male',
    name: 'Studio Tapered Pants',
    subtitle: 'Athletic Morph-Fit Cut',
    collection: 'Studio Casual · 03',
    priceLul: 14,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-male-03.glb#slot=legs',
    swatchGradient: ['#10b981', '#064e3b'],
    accentHex: '#34d399',
  },
  {
    id: 'blitz_m04_bottoms',
    slot: 'bottoms',
    gender: 'male',
    name: 'Vanguard Cargo Pants',
    subtitle: 'Utility Street Silhouette',
    collection: 'Vanguard Urban · 04',
    priceLul: 16,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-male-04.glb#slot=legs',
    swatchGradient: ['#fb923c', '#7c2d12'],
    accentHex: '#f97316',
  },

  // --- Male Shoes ---
  {
    id: 'blitz_m01_shoes',
    slot: 'shoes',
    gender: 'male',
    name: 'Plaza Low Runners',
    subtitle: 'Cushioned Street Sole',
    collection: 'Plaza Street · 01',
    priceLul: 12,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-male-01.glb#slot=feet',
    swatchGradient: ['#93c5fd', '#1e3a8a'],
    accentHex: '#38bdf8',
  },
  {
    id: 'blitz_m02_shoes',
    slot: 'shoes',
    gender: 'male',
    name: 'Metro Court Kicks',
    subtitle: 'Monochrome City Footwear',
    collection: 'Metro Layered · 02',
    priceLul: 12,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-male-02.glb#slot=feet',
    swatchGradient: ['#cbd5e1', '#334155'],
    accentHex: '#94a3b8',
  },
  {
    id: 'blitz_m03_shoes',
    slot: 'shoes',
    gender: 'male',
    name: 'Studio Street Sneakers',
    subtitle: 'Clean Everyday Runner',
    collection: 'Studio Casual · 03',
    priceLul: 12,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-male-03.glb#slot=feet',
    swatchGradient: ['#6ee7b7', '#065f46'],
    accentHex: '#10b981',
  },
  {
    id: 'blitz_m04_shoes',
    slot: 'shoes',
    gender: 'male',
    name: 'Vanguard High-Tops',
    subtitle: 'Heavyweight Street Grip',
    collection: 'Vanguard Urban · 04',
    priceLul: 13,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-male-04.glb#slot=feet',
    swatchGradient: ['#fde047', '#9a3412'],
    accentHex: '#f59e0b',
  },

  // --- Male Hair ---
  {
    id: 'blitz_m01_hair',
    slot: 'hair',
    gender: 'male',
    name: 'Plaza Textured Cut',
    subtitle: 'Natural Street Volume',
    collection: 'Plaza Street · 01',
    priceLul: 10,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-male-01.glb#slot=hair',
    swatchGradient: ['#52525b', '#18181b'],
    accentHex: '#a1a1aa',
  },
  {
    id: 'blitz_m02_hair',
    slot: 'hair',
    gender: 'male',
    name: 'Metro Side-Part Cut',
    subtitle: 'Clean Studio Sweep',
    collection: 'Metro Layered · 02',
    priceLul: 10,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-male-02.glb#slot=hair',
    swatchGradient: ['#92400e', '#451a03'],
    accentHex: '#d97706',
  },
  {
    id: 'blitz_m03_hair',
    slot: 'hair',
    gender: 'male',
    name: 'Studio Crop Style',
    subtitle: 'Modern Short Layers',
    collection: 'Studio Casual · 03',
    priceLul: 10,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-male-03.glb#slot=hair',
    swatchGradient: ['#78350f', '#292524'],
    accentHex: '#f59e0b',
  },
  {
    id: 'blitz_m04_hair',
    slot: 'hair',
    gender: 'male',
    name: 'Vanguard Slick Cut',
    subtitle: 'Sharp Editorial Contour',
    collection: 'Vanguard Urban · 04',
    priceLul: 11,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-male-04.glb#slot=hair',
    swatchGradient: ['#6366f1', '#312e81'],
    accentHex: '#818cf8',
  },

  // --- Male Full Sets ---
  {
    id: 'blitz_m01_set',
    slot: 'set',
    gender: 'male',
    name: 'Plaza Street Set',
    subtitle: 'Street Top · Pants · Low Runners',
    collection: 'Plaza Street · 01',
    priceLul: 34,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-male-01.glb#slot=costume',
    swatchGradient: ['#38bdf8', '#1e3a8a'],
    accentHex: '#38bdf8',
  },
  {
    id: 'blitz_m02_set',
    slot: 'set',
    gender: 'male',
    name: 'Metro Layered Set',
    subtitle: 'Layered Top · Trousers · Court Kicks',
    collection: 'Metro Layered · 02',
    priceLul: 34,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-male-02.glb#slot=costume',
    swatchGradient: ['#64748b', '#0f172a'],
    accentHex: '#94a3b8',
  },
  {
    id: 'blitz_m03_set',
    slot: 'set',
    gender: 'male',
    name: 'Studio Casual Set',
    subtitle: 'Casual Top · Tapered Pants · Sneakers',
    collection: 'Studio Casual · 03',
    priceLul: 32,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-male-03.glb#slot=costume',
    swatchGradient: ['#34d399', '#065f46'],
    accentHex: '#10b981',
  },
  {
    id: 'blitz_m04_set',
    slot: 'set',
    gender: 'male',
    name: 'Vanguard Urban Set',
    subtitle: 'Jacket Top · Cargo Pants · High-Tops',
    collection: 'Vanguard Urban · 04',
    priceLul: 36,
    isStarterDefault: false,
    glbPath: '/assets/avatars/blitz-male-04.glb#slot=costume',
    swatchGradient: ['#facc15', '#b45309'],
    accentHex: '#f59e0b',
  },

  // =========================================================================
  // BODY SHAPE (Unisex · Hybrid Morph Targets + Silhouette Scale)
  // =========================================================================
  {
    id: 'apparel_body_default_balanced',
    slot: 'body_shape',
    gender: 'unisex',
    name: 'Balanced Studio',
    subtitle: 'Starter Natural BaseDoll',
    collection: 'Starter Essentials',
    priceLul: 0,
    isStarterDefault: true,
    glbPath: null,
    bodyShape: {
      morphWeights: {},
      heightScale: 1.0,
      widthScale: 1.0,
      baseDollGlbUrl: null,
      silhouetteTag: 'Natural',
    },
    swatchGradient: ['#64748b', '#1e293b'],
    accentHex: '#94a3b8',
  },
  {
    id: 'apparel_body_slim_runway',
    slot: 'body_shape',
    gender: 'unisex',
    name: 'Slim Runway',
    subtitle: 'Tall Editorial Silhouette',
    collection: 'Studio Sculpt · 26',
    priceLul: 20,
    isStarterDefault: false,
    glbPath: null,
    bodyShape: {
      morphWeights: {
        Waist_Slim: 0.85,
        Shoulder_Width: 0.12,
      },
      heightScale: 1.035,
      widthScale: 0.945,
      baseDollGlbUrl: null,
      silhouetteTag: 'Tall · Slim',
    },
    swatchGradient: ['#38bdf8', '#1d4ed8'],
    accentHex: '#38bdf8',
  },
  {
    id: 'apparel_body_athletic_sculpt',
    slot: 'body_shape',
    gender: 'unisex',
    name: 'Athletic Sculpt',
    subtitle: 'Defined Shoulders & Core',
    collection: 'Studio Sculpt · 26',
    priceLul: 25,
    isStarterDefault: false,
    glbPath: null,
    bodyShape: {
      morphWeights: {
        Chest_Build: 0.85,
        Bust_Size: 0.35,
        Shoulder_Width: 0.85,
        Arm_Muscle: 0.9,
        Waist_Slim: 0.5,
        Thigh_Fullness: 0.45,
      },
      heightScale: 1.02,
      widthScale: 1.045,
      baseDollGlbUrl: null,
      silhouetteTag: 'Athletic',
    },
    swatchGradient: ['#34d399', '#065f46'],
    accentHex: '#10b981',
  },
  {
    id: 'apparel_body_glam_hourglass',
    slot: 'body_shape',
    gender: 'unisex',
    name: 'Glam Hourglass',
    subtitle: 'Curved Studio Proportions',
    collection: 'Atelier Form · 26',
    priceLul: 28,
    isStarterDefault: false,
    glbPath: null,
    bodyShape: {
      morphWeights: {
        Bust_Size: 0.62,
        Chest_Build: 0.35,
        Waist_Slim: 0.72,
        Hip_Width: 0.58,
        Glute_Projection: 0.56,
        Thigh_Fullness: 0.42,
      },
      heightScale: 1.0,
      widthScale: 1.015,
      baseDollGlbUrl: null,
      silhouetteTag: 'Curvy',
    },
    swatchGradient: ['#f472b6', '#9d174d'],
    accentHex: '#ec4899',
  },
  {
    id: 'apparel_body_petite_studio',
    slot: 'body_shape',
    gender: 'unisex',
    name: 'Petite Studio',
    subtitle: 'Compact Youthful Frame',
    collection: 'Atelier Form · 26',
    priceLul: 20,
    isStarterDefault: false,
    glbPath: null,
    bodyShape: {
      morphWeights: {
        Waist_Slim: 0.45,
        Bust_Size: 0.2,
        Hip_Width: 0.25,
      },
      heightScale: 0.935,
      widthScale: 0.965,
      baseDollGlbUrl: null,
      silhouetteTag: 'Petite',
    },
    swatchGradient: ['#fbbf24', '#b45309'],
    accentHex: '#f59e0b',
  },
  {
    id: 'apparel_body_power_hero',
    slot: 'body_shape',
    gender: 'unisex',
    name: 'Power Hero',
    subtitle: 'Broad Tall Heroic Stature',
    collection: 'Titan Edition · 26',
    priceLul: 30,
    isStarterDefault: false,
    glbPath: null,
    bodyShape: {
      morphWeights: {
        Chest_Build: 1.0,
        Bust_Size: 0.55,
        Shoulder_Width: 1.0,
        Arm_Muscle: 1.0,
        Hip_Width: 0.4,
        Thigh_Fullness: 0.72,
      },
      heightScale: 1.055,
      widthScale: 1.085,
      baseDollGlbUrl: null,
      silhouetteTag: 'Heroic',
    },
    swatchGradient: ['#a78bfa', '#4c1d95'],
    accentHex: '#8b5cf6',
  },

  // ── Face: Eyes (Mata) ─────────────────────────────────────────────────────
  {
    id: 'face_eyes_default',
    slot: 'face_eyes',
    gender: 'unisex',
    name: 'Classic Emerald',
    subtitle: 'Natural Starter Eyes',
    collection: 'Face Essentials',
    priceLul: 0,
    isStarterDefault: true,
    glbPath: null,
    eyeStyle: {
      shape: 'classic',
      irisOuterHex: '#3f6236',
      irisInnerHex: '#86b566',
      pupilHex: '#0d100e',
      linerHex: '#1c1816',
      linerThickness: 1.0,
      wingLength: 0.1,
      lashCount: 0,
      irisScale: 1.0,
    },
    swatchGradient: ['#86efac', '#14532d'],
    accentHex: '#4ade80',
  },
  {
    id: 'face_eyes_hazel_warm',
    slot: 'face_eyes',
    gender: 'unisex',
    name: 'Warm Hazel',
    subtitle: 'Golden Amber Iris',
    collection: 'Face Essentials',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    eyeStyle: {
      shape: 'almond',
      irisOuterHex: '#7c4a1d',
      irisInnerHex: '#e0a954',
      pupilHex: '#140c08',
      linerHex: '#231712',
      linerThickness: 1.05,
      wingLength: 0.2,
      lashCount: 3,
      irisScale: 1.02,
    },
    swatchGradient: ['#fcd34d', '#78350f'],
    accentHex: '#d97706',
  },
  {
    id: 'face_eyes_sapphire_sky',
    slot: 'face_eyes',
    gender: 'unisex',
    name: 'Ocean Sapphire',
    subtitle: 'Bright Sky-Blue Iris',
    collection: 'Face Essentials',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    eyeStyle: {
      shape: 'almond',
      irisOuterHex: '#1d4ed8',
      irisInnerHex: '#7dd3fc',
      pupilHex: '#090d1a',
      linerHex: '#151924',
      linerThickness: 1.05,
      wingLength: 0.25,
      lashCount: 4,
      irisScale: 1.04,
    },
    swatchGradient: ['#7dd3fc', '#1e3a8a'],
    accentHex: '#38bdf8',
  },
  {
    id: 'face_eyes_espresso_doll',
    slot: 'face_eyes',
    gender: 'unisex',
    name: 'Velvet Espresso',
    subtitle: 'Lush Doll-Eye Lashes',
    collection: 'Beauty Atelier',
    priceLul: 10,
    isStarterDefault: false,
    glbPath: null,
    eyeStyle: {
      shape: 'doll',
      irisOuterHex: '#3b2014',
      irisInnerHex: '#8c5a3c',
      pupilHex: '#0c0705',
      linerHex: '#140e0c',
      linerThickness: 1.25,
      wingLength: 0.45,
      lashCount: 6,
      irisScale: 1.12,
      eyeshadowHex: '#c08474',
    },
    swatchGradient: ['#d6a88a', '#3b1f14'],
    accentHex: '#92400e',
  },
  {
    id: 'face_eyes_smoky_emerald',
    slot: 'face_eyes',
    gender: 'unisex',
    name: 'Smoky Cat-Eye',
    subtitle: 'Winged Liner & Jade',
    collection: 'Beauty Atelier',
    priceLul: 14,
    isStarterDefault: false,
    glbPath: null,
    eyeStyle: {
      shape: 'cat_wing',
      irisOuterHex: '#0f766e',
      irisInnerHex: '#5eead4',
      pupilHex: '#071412',
      linerHex: '#0b0d12',
      linerThickness: 1.4,
      wingLength: 0.9,
      lashCount: 6,
      irisScale: 1.04,
      eyeshadowHex: '#475569',
    },
    swatchGradient: ['#5eead4', '#134e4a'],
    accentHex: '#14b8a6',
  },
  {
    id: 'face_eyes_violet_idol',
    slot: 'face_eyes',
    gender: 'unisex',
    name: 'Starlight Violet',
    subtitle: 'Amethyst Idol Sparkle',
    collection: 'Beauty Atelier',
    priceLul: 16,
    isStarterDefault: false,
    glbPath: null,
    eyeStyle: {
      shape: 'idol',
      irisOuterHex: '#6d28d9',
      irisInnerHex: '#e879f9',
      pupilHex: '#160926',
      linerHex: '#181024',
      linerThickness: 1.3,
      wingLength: 0.55,
      lashCount: 6,
      irisScale: 1.14,
      starHighlight: true,
      eyeshadowHex: '#c084fc',
    },
    swatchGradient: ['#e879f9', '#4c1d95'],
    accentHex: '#c084fc',
  },

  // ── Face: Eyebrows (Alis) ─────────────────────────────────────────────────
  {
    id: 'face_brows_default',
    slot: 'face_brows',
    gender: 'unisex',
    name: 'Natural Classic',
    subtitle: 'Default Balanced Brow',
    collection: 'Face Essentials',
    priceLul: 0,
    isStarterDefault: true,
    glbPath: null,
    browStyle: {
      shape: 'natural',
      colorHex: '#3f342e',
      highlightHex: '#6b5a50',
      thickness: 0.85,
      archLift: 0.42,
      tailDrop: 0.2,
      softness: 0.8,
    },
    swatchGradient: ['#a8a29e', '#44403c'],
    accentHex: '#78716c',
  },
  {
    id: 'face_brows_soft_straight',
    slot: 'face_brows',
    gender: 'unisex',
    name: 'Soft Straight',
    subtitle: 'Gentle Seoul Brow',
    collection: 'Face Essentials',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    browStyle: {
      shape: 'soft_straight',
      colorHex: '#4c3a32',
      highlightHex: '#7a6054',
      thickness: 0.86,
      archLift: 0.16,
      tailDrop: 0.08,
      softness: 0.95,
    },
    swatchGradient: ['#d6c3b6', '#574238'],
    accentHex: '#a17c6b',
  },
  {
    id: 'face_brows_sleek_arch',
    slot: 'face_brows',
    gender: 'unisex',
    name: 'Sleek Arch',
    subtitle: 'Sculpted High Arch',
    collection: 'Face Essentials',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    browStyle: {
      shape: 'sleek_arch',
      colorHex: '#2f241f',
      highlightHex: '#59453c',
      thickness: 0.68,
      archLift: 0.72,
      tailDrop: 0.34,
      softness: 0.55,
    },
    swatchGradient: ['#9ca3af', '#27272a'],
    accentHex: '#52525b',
  },
  {
    id: 'face_brows_bold_blade',
    slot: 'face_brows',
    gender: 'unisex',
    name: 'Bold Runway',
    subtitle: 'Full Editorial Brow',
    collection: 'Beauty Atelier',
    priceLul: 8,
    isStarterDefault: false,
    glbPath: null,
    browStyle: {
      shape: 'bold_blade',
      colorHex: '#231f20',
      highlightHex: '#4a4345',
      thickness: 1.12,
      archLift: 0.36,
      tailDrop: 0.16,
      softness: 0.85,
    },
    swatchGradient: ['#64748b', '#18181b'],
    accentHex: '#334155',
  },
  {
    id: 'face_brows_feather_gold',
    slot: 'face_brows',
    gender: 'unisex',
    name: 'Honey Feather',
    subtitle: 'Warm Caramel Strokes',
    collection: 'Beauty Atelier',
    priceLul: 10,
    isStarterDefault: false,
    glbPath: null,
    browStyle: {
      shape: 'feathered',
      colorHex: '#785032',
      highlightHex: '#b8875a',
      thickness: 0.92,
      archLift: 0.46,
      tailDrop: 0.18,
      softness: 1.0,
    },
    swatchGradient: ['#f6c89f', '#78350f'],
    accentHex: '#b45309',
  },
  {
    id: 'face_brows_sharp_noir',
    slot: 'face_brows',
    gender: 'unisex',
    name: 'Sharp Noir',
    subtitle: 'Crisp Angled Jet Brow',
    collection: 'Beauty Atelier',
    priceLul: 12,
    isStarterDefault: false,
    glbPath: null,
    browStyle: {
      shape: 'sharp_angle',
      colorHex: '#141418',
      highlightHex: '#343642',
      thickness: 0.84,
      archLift: 0.78,
      tailDrop: 0.1,
      softness: 0.35,
    },
    swatchGradient: ['#475569', '#09090b'],
    accentHex: '#1e293b',
  },

  // ── Face: Lips (Bibir) ────────────────────────────────────────────────────
  {
    id: 'face_lips_default',
    slot: 'face_lips',
    gender: 'unisex',
    name: 'Natural Tint',
    subtitle: 'Default Starter Lips',
    collection: 'Face Essentials',
    priceLul: 0,
    isStarterDefault: true,
    glbPath: null,
    lipStyle: {
      shape: 'natural',
      baseHex: '#c98882',
      innerHex: '#a96864',
      lineHex: '#7d4644',
      glossAlpha: 0.18,
      fullness: 0.95,
      widthScale: 0.96,
    },
    swatchGradient: ['#f5c2ba', '#9a5a55'],
    accentHex: '#d48b84',
  },
  {
    id: 'face_lips_peach_nude',
    slot: 'face_lips',
    gender: 'unisex',
    name: 'Peach Nude',
    subtitle: 'Soft Warm Matte',
    collection: 'Face Essentials',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    lipStyle: {
      shape: 'soft_matte',
      baseHex: '#d98f79',
      innerHex: '#b96b57',
      lineHex: '#8c4c3d',
      glossAlpha: 0.14,
      fullness: 0.98,
      widthScale: 1.0,
    },
    swatchGradient: ['#fdba74', '#9a3412'],
    accentHex: '#fb923c',
  },
  {
    id: 'face_lips_rose_velvet',
    slot: 'face_lips',
    gender: 'unisex',
    name: 'Rose Velvet',
    subtitle: 'Satin Sculpted Rose',
    collection: 'Face Essentials',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    lipStyle: {
      shape: 'satin_bow',
      baseHex: '#d4667b',
      innerHex: '#a83c54',
      lineHex: '#752336',
      glossAlpha: 0.34,
      fullness: 1.05,
      widthScale: 1.02,
    },
    swatchGradient: ['#fda4af', '#9f1239'],
    accentHex: '#f43f5e',
  },
  {
    id: 'face_lips_cherry_gloss',
    slot: 'face_lips',
    gender: 'unisex',
    name: 'Cherry Gloss',
    subtitle: 'Glass Shine Crimson',
    collection: 'Beauty Atelier',
    priceLul: 10,
    isStarterDefault: false,
    glbPath: null,
    lipStyle: {
      shape: 'gloss_plump',
      baseHex: '#d62849',
      innerHex: '#9c102e',
      lineHex: '#63091d',
      glossAlpha: 0.78,
      fullness: 1.15,
      widthScale: 1.05,
    },
    swatchGradient: ['#fb7185', '#881337'],
    accentHex: '#e11d48',
  },
  {
    id: 'face_lips_berry_plum',
    slot: 'face_lips',
    gender: 'unisex',
    name: 'Berry Plum',
    subtitle: 'Deep Editorial Velvet',
    collection: 'Beauty Atelier',
    priceLul: 12,
    isStarterDefault: false,
    glbPath: null,
    lipStyle: {
      shape: 'velvet_full',
      baseHex: '#8e2d52',
      innerHex: '#5e1433',
      lineHex: '#3d0a20',
      glossAlpha: 0.32,
      fullness: 1.14,
      widthScale: 1.04,
    },
    swatchGradient: ['#c084fc', '#581c87'],
    accentHex: '#9333ea',
  },
  {
    id: 'face_lips_coral_blush',
    slot: 'face_lips',
    gender: 'unisex',
    name: 'Coral Gradient',
    subtitle: 'Dewy Idol Ombre Lip',
    collection: 'Beauty Atelier',
    priceLul: 12,
    isStarterDefault: false,
    glbPath: null,
    lipStyle: {
      shape: 'gradient_tint',
      baseHex: '#f0867d',
      innerHex: '#df3f4d',
      lineHex: '#99212e',
      glossAlpha: 0.64,
      fullness: 1.08,
      widthScale: 1.0,
    },
    swatchGradient: ['#fda4af', '#ea580c'],
    accentHex: '#fb7185',
  },

  // ── Style: Animation Sets (Set Animasi Idle/Walk/Run) ─────────────────────
  {
    id: 'style_anim_default',
    slot: 'style_anim',
    gender: 'unisex',
    name: 'Casual City',
    subtitle: 'Natural Starter Motion',
    collection: 'Motion Essentials',
    priceLul: 0,
    isStarterDefault: true,
    glbPath: null,
    animSet: {
      clipCandidates: ['idle.001', 'bima_idle.001', 'kai_idle.001'],
      vibeTag: 'Casual',
    },
    swatchGradient: ['#94a3b8', '#334155'],
    accentHex: '#94a3b8',
  },
  {
    id: 'style_anim_runway',
    slot: 'style_anim',
    gender: 'unisex',
    name: 'Runway Chic',
    subtitle: 'Catwalk Model Stance',
    collection: 'Motion Essentials',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    animSet: {
      clipCandidates: ['nadia_idle.001', 'hana_idle.001', 'mira_idle.001', 'idle.001'],
      vibeTag: 'Runway',
    },
    swatchGradient: ['#38bdf8', '#1d4ed8'],
    accentHex: '#38bdf8',
  },
  {
    id: 'style_anim_calm',
    slot: 'style_anim',
    gender: 'unisex',
    name: 'Studio Calm',
    subtitle: 'Poised Relaxed Idle',
    collection: 'Motion Essentials',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    animSet: {
      clipCandidates: ['hana_idle.001', 'mira_idle.001', 'kai_idle.001', 'idle.001'],
      vibeTag: 'Calm',
    },
    swatchGradient: ['#34d399', '#065f46'],
    accentHex: '#10b981',
  },
  {
    id: 'style_anim_energetic',
    slot: 'style_anim',
    gender: 'unisex',
    name: 'Energetic Idol',
    subtitle: 'Lively Upbeat Motion Set',
    collection: 'Motion Atelier',
    priceLul: 14,
    isStarterDefault: false,
    glbPath: null,
    animSet: {
      clipCandidates: ['tari_idle.001', 'mira_idle.001', 'hana_idle.001', 'idle.001'],
      vibeTag: 'Energetic',
    },
    swatchGradient: ['#f472b6', '#9d174d'],
    accentHex: '#ec4899',
  },
  {
    id: 'style_anim_sassy',
    slot: 'style_anim',
    gender: 'unisex',
    name: 'Sassy Active',
    subtitle: 'Confident Hand-on-Hip Set',
    collection: 'Motion Atelier',
    priceLul: 14,
    isStarterDefault: false,
    glbPath: null,
    animSet: {
      clipCandidates: ['mira_idle.001', 'nadia_idle.001', 'idle.001'],
      vibeTag: 'Sassy',
    },
    swatchGradient: ['#fb7185', '#881337'],
    accentHex: '#f43f5e',
  },
  {
    id: 'style_anim_formal',
    slot: 'style_anim',
    gender: 'unisex',
    name: 'Formal Cool',
    subtitle: 'Sharp Executive Stance',
    collection: 'Motion Atelier',
    priceLul: 16,
    isStarterDefault: false,
    glbPath: null,
    animSet: {
      clipCandidates: ['raka_idle.001', 'bima_idle.001', 'idle.001'],
      vibeTag: 'Formal',
    },
    swatchGradient: ['#818cf8', '#312e81'],
    accentHex: '#6366f1',
  },
  {
    id: 'style_anim_street',
    slot: 'style_anim',
    gender: 'unisex',
    name: 'Street Swagger',
    subtitle: 'Relaxed Urban Attitude',
    collection: 'Motion Atelier',
    priceLul: 14,
    isStarterDefault: false,
    glbPath: null,
    animSet: {
      clipCandidates: ['bima_idle.001', 'kenji_idle.001', 'idle.001'],
      vibeTag: 'Street',
    },
    swatchGradient: ['#fbbf24', '#92400e'],
    accentHex: '#f59e0b',
  },
  {
    id: 'style_anim_urban',
    slot: 'style_anim',
    gender: 'unisex',
    name: 'Urban Flow',
    subtitle: 'Chill Plaza Rhythm Set',
    collection: 'Motion Atelier',
    priceLul: 12,
    isStarterDefault: false,
    glbPath: null,
    animSet: {
      clipCandidates: ['kenji_idle.001', 'kai_idle.001', 'idle.001'],
      vibeTag: 'Flow',
    },
    swatchGradient: ['#2dd4bf', '#115e59'],
    accentHex: '#14b8a6',
  },

  // ── Style: Dance & Emote Poses (Pose Dance & Emote) ───────────────────────
  {
    id: 'style_dance_default',
    slot: 'style_dance',
    gender: 'unisex',
    name: 'Standing Pose',
    subtitle: 'Base Animation Stance',
    collection: 'Dance Essentials',
    priceLul: 0,
    isStarterDefault: true,
    glbPath: null,
    dancePose: {
      danceKind: 'none',
      tempoBpm: 0,
      vibeTag: 'Base',
    },
    swatchGradient: ['#94a3b8', '#334155'],
    accentHex: '#94a3b8',
  },
  {
    id: 'style_dance_groove',
    slot: 'style_dance',
    gender: 'unisex',
    name: 'City Groove',
    subtitle: 'Rhythmic Plaza Dance',
    collection: 'Dance Essentials',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    dancePose: {
      danceKind: 'groove',
      tempoBpm: 118,
      vibeTag: 'Dance',
    },
    swatchGradient: ['#38bdf8', '#1e3a8a'],
    accentHex: '#38bdf8',
  },
  {
    id: 'style_dance_wave',
    slot: 'style_dance',
    gender: 'unisex',
    name: 'Friendly Wave',
    subtitle: 'Cheerful Greeting Emote',
    collection: 'Dance Essentials',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    dancePose: {
      danceKind: 'wave',
      tempoBpm: 100,
      vibeTag: 'Wave',
    },
    swatchGradient: ['#34d399', '#065f46'],
    accentHex: '#10b981',
  },
  {
    id: 'style_dance_cheer',
    slot: 'style_dance',
    gender: 'unisex',
    name: 'Victory Cheer',
    subtitle: 'Celebration Hands-Up',
    collection: 'Dance Essentials',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    dancePose: {
      danceKind: 'cheer',
      tempoBpm: 124,
      vibeTag: 'Cheer',
    },
    swatchGradient: ['#facc15', '#b45309'],
    accentHex: '#eab308',
  },
  {
    id: 'style_dance_salute',
    slot: 'style_dance',
    gender: 'unisex',
    name: 'Street Salute',
    subtitle: 'Crisp Tactical Pose',
    collection: 'Dance Atelier',
    priceLul: 10,
    isStarterDefault: false,
    glbPath: null,
    dancePose: {
      danceKind: 'salute',
      tempoBpm: 90,
      vibeTag: 'Salute',
    },
    swatchGradient: ['#60a5fa', '#1e40af'],
    accentHex: '#3b82f6',
  },
  {
    id: 'style_dance_idol_pop',
    slot: 'style_dance',
    gender: 'unisex',
    name: 'Idol Pop Dance',
    subtitle: 'Stage Spotlight Routine',
    collection: 'Dance Atelier',
    priceLul: 16,
    isStarterDefault: false,
    glbPath: null,
    dancePose: {
      danceKind: 'idol_pop',
      tempoBpm: 132,
      vibeTag: 'Idol',
    },
    swatchGradient: ['#e879f9', '#701a75'],
    accentHex: '#d946ef',
  },
  {
    id: 'style_dance_hiphop',
    slot: 'style_dance',
    gender: 'unisex',
    name: 'Hip-Hop Bounce',
    subtitle: 'Street Cypher Groove',
    collection: 'Dance Atelier',
    priceLul: 18,
    isStarterDefault: false,
    glbPath: null,
    dancePose: {
      danceKind: 'hiphop',
      tempoBpm: 106,
      vibeTag: 'Hip-Hop',
    },
    swatchGradient: ['#fb923c', '#9a3412'],
    accentHex: '#f97316',
  },
] as const;

export const BUILT_IN_WARDROBE_PRESETS: readonly WardrobeSavedPreset[] = [
  {
    id: 'preset_builtin_starter_clean',
    name: 'Starter Clean',
    createdAtMs: 0,
    isBuiltIn: true,
    gender: 'unisex',
    draft: { ...EMPTY_WARDROBE_DRAFT },
    accentGradient: ['#94a3b8', '#334155'],
  },
  // Female Curated Looks
  {
    id: 'preset_builtin_f_noir_atelier',
    name: 'Noir Atelier',
    createdAtMs: 1,
    isBuiltIn: true,
    gender: 'female',
    draft: {
      ...EMPTY_WARDROBE_DRAFT,
      hairId: 'blitz_f01_hair',
      setId: 'blitz_f01_set',
    },
    accentGradient: ['#475569', '#09090b'],
  },
  {
    id: 'preset_builtin_f_city_chic',
    name: 'City Chic',
    createdAtMs: 2,
    isBuiltIn: true,
    gender: 'female',
    draft: {
      ...EMPTY_WARDROBE_DRAFT,
      hairId: 'blitz_f02_hair',
      setId: 'blitz_f02_set',
    },
    accentGradient: ['#fda4af', '#881337'],
  },
  {
    id: 'preset_builtin_f_academy_street',
    name: 'Academy Street',
    createdAtMs: 3,
    isBuiltIn: true,
    gender: 'female',
    draft: {
      ...EMPTY_WARDROBE_DRAFT,
      hairId: 'blitz_f03_hair',
      setId: 'blitz_f03_set',
    },
    accentGradient: ['#38bdf8', '#1e3a8a'],
  },
  {
    id: 'preset_builtin_f_urban_luxe',
    name: 'Urban Luxe',
    createdAtMs: 4,
    isBuiltIn: true,
    gender: 'female',
    draft: {
      ...EMPTY_WARDROBE_DRAFT,
      hairId: 'blitz_f04_hair',
      setId: 'blitz_f04_set',
    },
    accentGradient: ['#c084fc', '#4c1d95'],
  },
  // Male Curated Looks
  {
    id: 'preset_builtin_m_plaza_street',
    name: 'Plaza Street',
    createdAtMs: 5,
    isBuiltIn: true,
    gender: 'male',
    draft: {
      ...EMPTY_WARDROBE_DRAFT,
      hairId: 'blitz_m01_hair',
      setId: 'blitz_m01_set',
    },
    accentGradient: ['#38bdf8', '#1e3a8a'],
  },
  {
    id: 'preset_builtin_m_metro_layered',
    name: 'Metro Layered',
    createdAtMs: 6,
    isBuiltIn: true,
    gender: 'male',
    draft: {
      ...EMPTY_WARDROBE_DRAFT,
      hairId: 'blitz_m02_hair',
      setId: 'blitz_m02_set',
    },
    accentGradient: ['#64748b', '#0f172a'],
  },
  {
    id: 'preset_builtin_m_studio_casual',
    name: 'Studio Casual',
    createdAtMs: 7,
    isBuiltIn: true,
    gender: 'male',
    draft: {
      ...EMPTY_WARDROBE_DRAFT,
      hairId: 'blitz_m03_hair',
      setId: 'blitz_m03_set',
    },
    accentGradient: ['#34d399', '#065f46'],
  },
  {
    id: 'preset_builtin_m_vanguard_urban',
    name: 'Vanguard Urban',
    createdAtMs: 8,
    isBuiltIn: true,
    gender: 'male',
    draft: {
      ...EMPTY_WARDROBE_DRAFT,
      hairId: 'blitz_m04_hair',
      setId: 'blitz_m04_set',
    },
    accentGradient: ['#facc15', '#b45309'],
  },
] as const;

export function isWardrobeItemCompatibleWithGender(
  item: WardrobeCatalogItem,
  characterGender?: 'male' | 'female',
): boolean {
  if (!characterGender) return true;
  return item.gender === 'unisex' || item.gender === characterGender;
}

export function getVisibleBuiltInWardrobePresets(
  characterGender?: 'male' | 'female',
): WardrobeSavedPreset[] {
  return BUILT_IN_WARDROBE_PRESETS.filter(
    (p) => !characterGender || !p.gender || p.gender === 'unisex' || p.gender === characterGender,
  );
}

export function getWardrobeCatalogItemById(id: string | null | undefined): WardrobeCatalogItem | null {
  if (!id) return null;
  return WARDROBE_STUDIO_ITEMS.find((item) => item.id === id) ?? null;
}

export function isWardrobeItemOwned(
  item: WardrobeCatalogItem,
  ownedApparelIds: readonly string[],
): boolean {
  return item.isStarterDefault || item.priceLul === 0 || ownedApparelIds.includes(item.id);
}

export function partitionWardrobeCategoryItems(
  slot: Exclude<WardrobeStudioCategoryId, 'presets'>,
  ownedApparelIds: readonly string[],
  filterMode: WardrobeFilterMode,
  sortMode: WardrobeSortMode,
  characterGender?: 'male' | 'female',
): {
  owned: WardrobeCatalogItem[];
  shop: WardrobeCatalogItem[];
  allVisible: WardrobeCatalogItem[];
} {
  const inSlot = WARDROBE_STUDIO_ITEMS.filter(
    (item) => item.slot === slot && isWardrobeItemCompatibleWithGender(item, characterGender),
  );
  const sortList = (list: WardrobeCatalogItem[]): WardrobeCatalogItem[] => {
    const copy = [...list];
    if (sortMode === 'price_asc') {
      copy.sort((a, b) => a.priceLul - b.priceLul);
    } else if (sortMode === 'price_desc') {
      copy.sort((a, b) => b.priceLul - a.priceLul);
    }
    return copy;
  };

  const ownedRaw = inSlot.filter((item) => isWardrobeItemOwned(item, ownedApparelIds));
  const shopRaw = inSlot.filter((item) => !isWardrobeItemOwned(item, ownedApparelIds));

  const owned = filterMode === 'shop' ? [] : sortList(ownedRaw);
  const shop = filterMode === 'owned' ? [] : sortList(shopRaw);
  return {
    owned,
    shop,
    allVisible: [...owned, ...shop],
  };
}

export function areWardrobeDraftsEqual(a: WardrobeOutfitDraft, b: WardrobeOutfitDraft): boolean {
  return (
    a.topId === b.topId &&
    a.bottomsId === b.bottomsId &&
    a.shoesId === b.shoesId &&
    a.hairId === b.hairId &&
    a.setId === b.setId &&
    a.bodyShapeId === b.bodyShapeId &&
    a.eyeStyleId === b.eyeStyleId &&
    a.browStyleId === b.browStyleId &&
    a.lipStyleId === b.lipStyleId &&
    a.animSetId === b.animSetId &&
    a.dancePoseId === b.dancePoseId &&
    a.clothingTintHex === b.clothingTintHex
  );
}

export function createWardrobeHistory(initial: WardrobeOutfitDraft): WardrobeHistoryState {
  return {
    past: [],
    present: { ...initial },
    future: [],
  };
}

export function pushWardrobeDraft(
  history: WardrobeHistoryState,
  nextDraft: WardrobeOutfitDraft,
): WardrobeHistoryState {
  if (areWardrobeDraftsEqual(history.present, nextDraft)) return history;
  const nextPast = [...history.past, { ...history.present }].slice(-25);
  return {
    past: nextPast,
    present: { ...nextDraft },
    future: [],
  };
}

export function undoWardrobeDraft(history: WardrobeHistoryState): WardrobeHistoryState {
  if (history.past.length === 0) return history;
  const prev = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: { ...prev },
    future: [{ ...history.present }, ...history.future].slice(0, 25),
  };
}

export function redoWardrobeDraft(history: WardrobeHistoryState): WardrobeHistoryState {
  if (history.future.length === 0) return history;
  const next = history.future[0];
  return {
    past: [...history.past, { ...history.present }].slice(-25),
    present: { ...next },
    future: history.future.slice(1),
  };
}

/**
 * Applies an item click onto a draft: selecting a full Set clears individual
 * conflicting garment slots cleanly, while Body Shape and Hair remain orthogonal
 * so players can combine any silhouette with any outfit or full set.
 */
export function applyItemSelectionToDraft(
  current: WardrobeOutfitDraft,
  item: WardrobeCatalogItem,
): WardrobeOutfitDraft {
  const next: WardrobeOutfitDraft = { ...current };
  const resolvedId = item.isStarterDefault ? null : item.id;
  if (item.slot === 'body_shape') {
    next.bodyShapeId = next.bodyShapeId === resolvedId ? null : resolvedId;
    return next;
  }
  if (item.slot === 'face_eyes') {
    next.eyeStyleId = next.eyeStyleId === resolvedId ? null : resolvedId;
    return next;
  }
  if (item.slot === 'face_brows') {
    next.browStyleId = next.browStyleId === resolvedId ? null : resolvedId;
    return next;
  }
  if (item.slot === 'face_lips') {
    next.lipStyleId = next.lipStyleId === resolvedId ? null : resolvedId;
    return next;
  }
  if (item.slot === 'style_anim') {
    next.animSetId = next.animSetId === resolvedId ? null : resolvedId;
    return next;
  }
  if (item.slot === 'style_dance') {
    next.dancePoseId = next.dancePoseId === resolvedId ? null : resolvedId;
    return next;
  }
  if (item.slot === 'set') {
    const isSame = next.setId === resolvedId;
    next.setId = isSame ? null : resolvedId;
    if (next.setId) {
      next.topId = null;
      next.bottomsId = null;
      next.shoesId = null;
    }
    return next;
  }

  // Selecting an individual garment item clears a full costume set if it's top/bottoms/shoes
  if (item.slot !== 'hair') {
    next.setId = null;
  }

  if (item.slot === 'top') {
    next.topId = next.topId === resolvedId ? null : resolvedId;
  } else if (item.slot === 'bottoms') {
    next.bottomsId = next.bottomsId === resolvedId ? null : resolvedId;
  } else if (item.slot === 'shoes') {
    next.shoesId = next.shoesId === resolvedId ? null : resolvedId;
  } else if (item.slot === 'hair') {
    next.hairId = next.hairId === resolvedId ? null : resolvedId;
  }
  return next;
}

/**
 * Collects any locked/unowned Shop items currently being previewed (try-on) in the draft.
 */
export function collectUnownedItemsInDraft(
  draft: WardrobeOutfitDraft,
  ownedApparelIds: readonly string[],
  characterGender?: 'male' | 'female',
): WardrobeCatalogItem[] {
  const ids = [
    draft.setId,
    draft.topId,
    draft.bottomsId,
    draft.shoesId,
    draft.hairId,
    draft.bodyShapeId,
    draft.eyeStyleId,
    draft.browStyleId,
    draft.lipStyleId,
    draft.animSetId,
    draft.dancePoseId,
  ];
  const locked: WardrobeCatalogItem[] = [];
  for (const id of ids) {
    const item = getWardrobeCatalogItemById(id);
    if (
      item &&
      isWardrobeItemCompatibleWithGender(item, characterGender) &&
      !isWardrobeItemOwned(item, ownedApparelIds)
    ) {
      locked.push(item);
    }
  }
  return locked;
}

/**
 * Strips any unowned (or opposite-gender) try-on items from a draft before committing to the live avatar.
 */
export function sanitizeDraftToOwnedOnly(
  draft: WardrobeOutfitDraft,
  ownedApparelIds: readonly string[],
  characterGender?: 'male' | 'female',
): WardrobeOutfitDraft {
  const keepIfOwned = (id: string | null | undefined): string | null => {
    const item = getWardrobeCatalogItemById(id);
    if (
      !item ||
      !isWardrobeItemCompatibleWithGender(item, characterGender) ||
      !isWardrobeItemOwned(item, ownedApparelIds)
    ) {
      return null;
    }
    return item.isStarterDefault ? null : item.id;
  };
  return {
    topId: keepIfOwned(draft.topId),
    bottomsId: keepIfOwned(draft.bottomsId),
    shoesId: keepIfOwned(draft.shoesId),
    hairId: keepIfOwned(draft.hairId),
    setId: keepIfOwned(draft.setId),
    bodyShapeId: keepIfOwned(draft.bodyShapeId),
    eyeStyleId: keepIfOwned(draft.eyeStyleId),
    browStyleId: keepIfOwned(draft.browStyleId),
    lipStyleId: keepIfOwned(draft.lipStyleId),
    animSetId: keepIfOwned(draft.animSetId),
    dancePoseId: keepIfOwned(draft.dancePoseId),
    clothingTintHex: draft.clothingTintHex,
  };
}

export function resolveWardrobeDraftAnimStyle(draft: WardrobeOutfitDraft): {
  clipCandidates: readonly string[];
  danceKind: WardrobeDanceKind;
  tempoBpm: number;
} {
  const animItem = getWardrobeCatalogItemById(draft.animSetId);
  const danceItem = getWardrobeCatalogItemById(draft.dancePoseId);
  return {
    clipCandidates:
      animItem && animItem.slot === 'style_anim' && animItem.animSet
        ? animItem.animSet.clipCandidates
        : ['nadia_idle.001', 'hana_idle.001', 'mira_idle.001', 'idle.001'],
    danceKind:
      danceItem && danceItem.slot === 'style_dance' && danceItem.dancePose
        ? danceItem.dancePose.danceKind
        : 'none',
    tempoBpm:
      danceItem && danceItem.slot === 'style_dance' && danceItem.dancePose
        ? danceItem.dancePose.tempoBpm
        : 0,
  };
}

/**
 * Resolves the active Body Shape morph & silhouette profile for a draft.
 */
export function resolveWardrobeDraftBodyShape(
  draft: WardrobeOutfitDraft,
): WardrobeBodyShapeProfile {
  const item = getWardrobeCatalogItemById(draft.bodyShapeId);
  if (item && item.slot === 'body_shape' && item.bodyShape) {
    return item.bodyShape;
  }
  return DEFAULT_NEUTRAL_BODY_SHAPE;
}

/**
 * Resolves the active Face customization (Eyes, Eyebrows, Lips) for a draft.
 */
export function resolveWardrobeDraftFaceCustomization(
  draft: WardrobeOutfitDraft,
): BuddyFaceCustomizationProfile {
  const eyeItem = getWardrobeCatalogItemById(draft.eyeStyleId);
  const browItem = getWardrobeCatalogItemById(draft.browStyleId);
  const lipItem = getWardrobeCatalogItemById(draft.lipStyleId);
  return {
    eyeStyle:
      eyeItem && eyeItem.slot === 'face_eyes' && !eyeItem.isStarterDefault && eyeItem.eyeStyle
        ? eyeItem.eyeStyle
        : DEFAULT_NEUTRAL_FACE_CUSTOMIZATION.eyeStyle,
    browStyle:
      browItem && browItem.slot === 'face_brows' && !browItem.isStarterDefault && browItem.browStyle
        ? browItem.browStyle
        : DEFAULT_NEUTRAL_FACE_CUSTOMIZATION.browStyle,
    lipStyle:
      lipItem && lipItem.slot === 'face_lips' && !lipItem.isStarterDefault && lipItem.lipStyle
        ? lipItem.lipStyle
        : DEFAULT_NEUTRAL_FACE_CUSTOMIZATION.lipStyle,
  };
}

/**
 * Converts a WardrobeOutfitDraft into the exact `BuddyModularOutfitUrls` payload
 * consumed by `setBuddyRigModularOutfitUrls(...)` on both studio & live city rigs,
 * automatically ignoring opposite-gender items when switching between Male & Female frames.
 */
export function resolveWardrobeDraftToModularOutfitUrls(
  draft: WardrobeOutfitDraft,
  characterGender?: 'male' | 'female',
): BuddyModularOutfitUrls {
  const resolveSlotUrl = (id: string | null): string | null => {
    const item = getWardrobeCatalogItemById(id);
    if (!item || !isWardrobeItemCompatibleWithGender(item, characterGender)) return null;
    return item.glbPath ?? null;
  };

  return {
    costumeUrl: resolveSlotUrl(draft.setId),
    torsoUrl: resolveSlotUrl(draft.topId),
    legsUrl: resolveSlotUrl(draft.bottomsId),
    feetUrl: resolveSlotUrl(draft.shoesId),
    hairUrl: resolveSlotUrl(draft.hairId),
  };
}

export function purchaseWardrobeCatalogItem(
  ownedApparelIds: readonly string[],
  currentLulBalance: number,
  itemId: string,
): {
  ok: boolean;
  alreadyOwned: boolean;
  nextOwnedIds: string[];
  nextLulBalance: number;
  priceChargedLul: number;
  errorMessage?: string;
} {
  const item = getWardrobeCatalogItemById(itemId);
  if (!item) {
    return {
      ok: false,
      alreadyOwned: false,
      nextOwnedIds: [...ownedApparelIds],
      nextLulBalance: currentLulBalance,
      priceChargedLul: 0,
      errorMessage: 'Item not found in wardrobe catalog.',
    };
  }
  if (isWardrobeItemOwned(item, ownedApparelIds)) {
    return {
      ok: true,
      alreadyOwned: true,
      nextOwnedIds: [...ownedApparelIds],
      nextLulBalance: currentLulBalance,
      priceChargedLul: 0,
    };
  }
  if (currentLulBalance < item.priceLul) {
    return {
      ok: false,
      alreadyOwned: false,
      nextOwnedIds: [...ownedApparelIds],
      nextLulBalance: currentLulBalance,
      priceChargedLul: 0,
      errorMessage: `Need ${item.priceLul} $LUL (you have ${Math.floor(currentLulBalance)} $LUL).`,
    };
  }
  return {
    ok: true,
    alreadyOwned: false,
    nextOwnedIds: [...ownedApparelIds, item.id],
    nextLulBalance: currentLulBalance - item.priceLul,
    priceChargedLul: item.priceLul,
  };
}

/**
 * Resolves whether the Wardrobe Studio renders 0%-FPS-overhead Smoked Pseudo-Glass
 * or lightweight GPU Frosted Glass automatically based on renderer capability & frame time.
 */
export function resolveWardrobeGlassSurfaceMode(input: {
  preference: WardrobeGlassPreference;
  isSoftwareGl: boolean;
  smoothedFrameMs: number;
}): ResolvedWardrobeGlassMode {
  if (input.preference === 'smoked_pseudo') return 'smoked_pseudo';
  if (input.preference === 'frosted_blur') return 'frosted_blur';
  // Auto mode: 0% overhead smoked glass on software renderers or under GPU pressure (>18.5ms)
  if (input.isSoftwareGl || input.smoothedFrameMs > 18.5) {
    return 'smoked_pseudo';
  }
  return 'frosted_blur';
}

export function getWardrobeDraftStorageKey(accountKey: string): string {
  const clean = (accountKey || 'guest').trim() || 'guest';
  return `bb_wardrobe_outfit_draft_v1:${clean}`;
}

export function getWardrobePresetsStorageKey(accountKey: string): string {
  const clean = (accountKey || 'guest').trim() || 'guest';
  return `bb_wardrobe_saved_presets_v1:${clean}`;
}

export function loadSavedWardrobePresets(accountKey: string): WardrobeSavedPreset[] {
  try {
    const raw = window.localStorage.getItem(getWardrobePresetsStorageKey(accountKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is WardrobeSavedPreset =>
        Boolean(p) &&
        typeof p.id === 'string' &&
        typeof p.name === 'string' &&
        Boolean(p.draft) &&
        typeof p.draft === 'object',
    );
  } catch {
    return [];
  }
}

export function persistSavedWardrobePresets(
  accountKey: string,
  presets: readonly WardrobeSavedPreset[],
): void {
  try {
    window.localStorage.setItem(
      getWardrobePresetsStorageKey(accountKey),
      JSON.stringify(presets.filter((p) => !p.isBuiltIn).slice(0, 12)),
    );
  } catch {
    // ignore storage errors
  }
}

export function createSavedPresetFromDraft(
  draft: WardrobeOutfitDraft,
  existingCount: number,
  nowMs = Date.now(),
  gender?: 'male' | 'female',
): WardrobeSavedPreset {
  const topItem = getWardrobeCatalogItemById(draft.topId);
  const setItem = getWardrobeCatalogItemById(draft.setId);
  const gradient: [string, string] = setItem?.swatchGradient ??
    topItem?.swatchGradient ?? ['#93c5fd', '#334155'];
  return {
    id: `preset_user_${nowMs}_${existingCount + 1}`,
    name: `Look ${existingCount + 1}`,
    createdAtMs: nowMs,
    gender,
    draft: { ...draft },
    accentGradient: gradient,
  };
}

export type DefaultAvatarGarmentSlot = 'torso' | 'legs' | 'feet' | 'hair' | 'hands' | 'neck';

/**
 * Classifies a built-in default avatar mesh (and its companion `_Outline` shell) into its
 * replaceable modular garment slot so equipping a new Top, Bottoms, Shoes, Hair, or Set
 * cleanly hides the default New Player garment on both legacy (`torso_*`, `legs_*`, ...) and
 * Blitz modular (`Blitz_Male_NewPlayer_Top`, `Blitz_NewPlayer_Skirt`, `Blitz_Hair_ClipIt`, ...) rigs.
 *
 * Always returns `null` for base skin dolls (`Blitz_BaseDoll_*`, `*_skin*`), head, and ears.
 */
export function classifyDefaultAvatarSlotFromMeshName(
  meshName: string | null | undefined,
): DefaultAvatarGarmentSlot | null {
  const lower = (meshName || '').trim().toLowerCase();
  if (!lower) return null;
  if (
    lower.includes('basedoll') ||
    lower.includes('_skin') ||
    lower.startsWith('head_') ||
    lower.startsWith('ears_')
  ) {
    return null;
  }

  // Strip runtime outline & GLTF mesh suffixes before keyword matching
  const clean = lower
    .replace(/_outline$/i, '')
    .replace(/_mesh(?:_\d+)?$/i, '')
    .trim();

  if (clean.startsWith('torso_')) return 'torso';
  if (clean.startsWith('legs_')) return 'legs';
  if (clean.startsWith('feet_')) return 'feet';
  if (clean.startsWith('hair_')) return 'hair';
  if (clean.startsWith('hands_')) return 'hands';
  if (clean.startsWith('neck_')) return 'neck';

  if (/(?:^|_)hair(?:_|$)/i.test(clean)) return 'hair';
  if (
    /(?:^|_)(?:legs|shorts|skirt|trousers|pants|jeans|leggings|bottoms)(?:_|$)|chainskirt/i.test(
      clean,
    )
  ) {
    return 'legs';
  }
  if (
    /(?:^|_)(?:feet|shoes|sneakers|heels|boots|sandals|trainers|instep)(?:_|$)|blackheels/i.test(
      clean,
    )
  ) {
    return 'feet';
  }
  if (
    /(?:^|_)top(?:_|$)|haltertop|(?:^|_)(?:shirt|jacket|hoodie|sweater|blouse|vest|tee)(?:_|$)/i.test(
      clean,
    )
  ) {
    return 'torso';
  }
  if (/(?:^|_)(?:acc_hands|gloves)(?:_|$)/i.test(clean)) return 'hands';
  if (/(?:^|_)(?:necklace|choker|scarf|collar)(?:_|$)/i.test(clean)) return 'neck';

  return null;
}
