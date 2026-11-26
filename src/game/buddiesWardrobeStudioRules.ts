import type { BuddyModularOutfitUrls } from './buddiesBlitzShadersAndAssets';
import {
  DEFAULT_NEUTRAL_FACE_CUSTOMIZATION,
  type BeautyUvLayerSpec,
  type BuddyFaceCustomizationProfile,
  type WardrobeBrowStyleSpec,
  type WardrobeEyeStyleSpec,
  type WardrobeLipStyleSpec,
} from './buddiesFaceCompositor';
import { BLENDER_MODULAR_WARDROBE_ITEMS } from './buddiesBlitzGeneratedWardrobeOutfits';

export type WardrobeStudioCategoryId =
  | 'presets'
  | 'top'
  | 'bottoms'
  | 'set'
  | 'hair'
  | 'shoes'
  | 'underwear'
  | 'body_shape'
  | 'face_eyes'
  | 'face_brows'
  | 'face_lips'
  | 'face_eyeshadow'
  | 'face_blush'
  | 'face_facepaint'
  | 'face_beard'
  | 'face_nose'
  | 'face_tuning'
  | 'face_head'
  | 'style_anim'
  | 'style_dance'
  | 'style_pose'
  | 'style_action'
  | 'style_paired';
export type WardrobeFaceCategoryId =
  | 'face_eyes'
  | 'face_brows'
  | 'face_lips'
  | 'face_eyeshadow'
  | 'face_blush'
  | 'face_facepaint'
  | 'face_beard'
  | 'face_nose'
  | 'face_tuning'
  | 'face_head';
export type WardrobeStyleCategoryId =
  | 'style_anim'
  | 'style_dance'
  | 'style_pose'
  | 'style_action'
  | 'style_paired'
  | 'style_tint';
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
  /** Uniform Head bone proportion multiplier (0.78..1.06, 1.0 = default BaseDoll head size). */
  headScale?: number;
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
  headScale: 1.0,
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
  /** Pre-sanitized idle clip priority order available on BuddyCharacterRig.customGlbController.clips */
  clipCandidates: readonly string[];
  walkClipCandidates?: readonly string[];
  runClipCandidates?: readonly string[];
  sitClipCandidates?: readonly string[];
  /** Optional external PelvisRoot 4-state Animation Set `.glb` URLs loaded lazily on select */
  animGlbUrl?: string | null;
  walkGlbUrl?: string | null;
  runGlbUrl?: string | null;
  sitGlbUrl?: string | null;
  vibeTag: string;
}

export interface WardrobeDancePoseSpec {
  danceKind: WardrobeDanceKind;
  tempoBpm: number;
  /** Optional external PelvisRoot Dance/Pose/Action `.glb` URL loaded lazily on select */
  animGlbUrl?: string | null;
  vibeTag: string;
}

export interface WardrobePairedAnimSpec {
  initiateGlbUrl: string;
  receiveGlbUrl: string;
  subKind: 'pose' | 'dance';
  vibeTag: string;
}

export interface WardrobeBeautyOverlaySpec {
  f?: BeautyUvLayerSpec | null;
  m?: BeautyUvLayerSpec | null;
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
  thumbUrl?: string | null;
  /** True when the 2D catalog thumbnail was cropped directly from a glTF `flipY = false` UV texture (upside-down in PNG/WebP space). */
  thumbFlipY?: boolean;
  underwearSubSlot?: 'underwear' | 'corewear';
  bodyShape?: WardrobeBodyShapeProfile;
  eyeStyle?: WardrobeEyeStyleSpec;
  browStyle?: WardrobeBrowStyleSpec;
  lipStyle?: WardrobeLipStyleSpec;
  beautyOverlay?: WardrobeBeautyOverlaySpec;
  animSet?: WardrobeAnimSetSpec;
  dancePose?: WardrobeDancePoseSpec;
  pairedAnim?: WardrobePairedAnimSpec;
  swatchGradient: [string, string];
  accentHex: string;
}

export interface WardrobeOutfitDraft {
  topId: string | null;
  bottomsId: string | null;
  shoesId: string | null;
  hairId: string | null;
  setId: string | null;
  underwearId?: string | null;
  corewearId?: string | null;
  hideOuterForUnderwear?: boolean;
  hideBaseUnderwear?: boolean;
  bodyShapeId: string | null;
  eyeStyleId: string | null;
  browStyleId: string | null;
  lipStyleId: string | null;
  eyeshadowId?: string | null;
  blushId?: string | null;
  facepaintId?: string | null;
  beardId?: string | null;
  animSetId: string | null;
  dancePoseId: string | null;
  stylePoseId?: string | null;
  styleActionId?: string | null;
  stylePairedId?: string | null;
  clothingTintHex: string | null;
  noseStyleId?: string | null;
  lipScale?: number;
  lipOffsetY?: number;
  eyeSpacing?: number;
  eyeTiltDeg?: number;
  eyeScale?: number;
  browOffsetY?: number;
  browTiltDeg?: number;
  headScale?: number;
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
  underwearId: null,
  corewearId: null,
  hideOuterForUnderwear: false,
  hideBaseUnderwear: false,
  bodyShapeId: null,
  eyeStyleId: null,
  browStyleId: null,
  lipStyleId: null,
  eyeshadowId: null,
  blushId: null,
  facepaintId: null,
  beardId: null,
  animSetId: null,
  dancePoseId: null,
  stylePoseId: null,
  styleActionId: null,
  stylePairedId: null,
  clothingTintHex: null,
  noseStyleId: 'face_nose_default',
  lipScale: 1.0,
  lipOffsetY: 0,
  eyeSpacing: 0,
  eyeTiltDeg: 0,
  eyeScale: 1.0,
  browOffsetY: 0,
  browTiltDeg: 0,
  headScale: 1.0,
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
  // CLEAN BLENDER MODULAR OUTFITS, SETS & SALON HAIRSTYLES (Female + Male)
  // Replaces all legacy broken blitz-female-01..04 / blitz-male-01..04 items.
  // =========================================================================
  ...BLENDER_MODULAR_WARDROBE_ITEMS,

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
  // ── Female Body Shapes (Buddies Studio Master Morphs) ────────
  {
    id: 'body_f_hourglass',
    slot: 'body_shape',
    gender: 'female',
    name: 'Blitz Hourglass',
    subtitle: 'Slim Waist & Full Curves',
    collection: 'Master Body · Women',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    bodyShape: {
      morphWeights: {
        Bust_Size: 0.72,
        Waist_Slim: 0.85,
        Hip_Width: 0.68,
        Glute_Projection: 0.65,
        Thigh_Fullness: 0.45,
      },
      heightScale: 1.0,
      widthScale: 1.01,
      baseDollGlbUrl: '/assets/avatars/female-hourglass.glb',
      silhouetteTag: 'Hourglass',
    },
    swatchGradient: ['#f472b6', '#9d174d'],
    accentHex: '#ec4899',
  },
  {
    id: 'body_f_athletic',
    slot: 'body_shape',
    gender: 'female',
    name: 'Blitz Athletic',
    subtitle: 'Athletic Silhouette & Defined Shoulders',
    collection: 'Master Body · Women',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    bodyShape: {
      morphWeights: {
        Bust_Size: 0.42,
        Shoulder_Width: 0.75,
        Waist_Slim: 0.55,
        Hip_Width: 0.35,
        Thigh_Fullness: 0.55,
      },
      heightScale: 1.015,
      widthScale: 1.02,
      baseDollGlbUrl: '/assets/avatars/female-athletic.glb',
      silhouetteTag: 'Athletic',
    },
    swatchGradient: ['#34d399', '#065f46'],
    accentHex: '#10b981',
  },
  {
    id: 'body_f_pear',
    slot: 'body_shape',
    gender: 'female',
    name: 'Blitz Pear',
    subtitle: 'Fuller Hips & Thighs',
    collection: 'Master Body · Women',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    bodyShape: {
      morphWeights: {
        Bust_Size: 0.25,
        Waist_Slim: 0.65,
        Hip_Width: 0.9,
        Glute_Projection: 0.82,
        Thigh_Fullness: 0.78,
      },
      heightScale: 0.99,
      widthScale: 1.01,
      baseDollGlbUrl: '/assets/avatars/female-pearl.glb',
      silhouetteTag: 'Pear',
    },
    swatchGradient: ['#fbbf24', '#b45309'],
    accentHex: '#f59e0b',
  },
  {
    id: 'body_f_spoon',
    slot: 'body_shape',
    gender: 'female',
    name: 'Blitz Spoon',
    subtitle: 'High & Full Hip Curves',
    collection: 'Master Body · Women',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    bodyShape: {
      morphWeights: {
        Bust_Size: 0.45,
        Waist_Slim: 0.78,
        Hip_Width: 0.85,
        Glute_Projection: 0.72,
        Thigh_Fullness: 0.62,
      },
      heightScale: 1.0,
      widthScale: 1.015,
      baseDollGlbUrl: '/assets/avatars/female-spoon.glb',
      silhouetteTag: 'Spoon',
    },
    swatchGradient: ['#fb7185', '#881337'],
    accentHex: '#f43f5e',
  },
  {
    id: 'body_f_triangle',
    slot: 'body_shape',
    gender: 'female',
    name: 'Blitz Triangle',
    subtitle: 'Soft A-Line Silhouette',
    collection: 'Master Body · Women',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    bodyShape: {
      morphWeights: {
        Bust_Size: 0.3,
        Shoulder_Width: 0.1,
        Waist_Slim: 0.5,
        Hip_Width: 0.76,
        Thigh_Fullness: 0.65,
      },
      heightScale: 1.0,
      widthScale: 1.0,
      baseDollGlbUrl: '/assets/avatars/female-Triangle.glb',
      silhouetteTag: 'A-Line',
    },
    swatchGradient: ['#c084fc', '#581c87'],
    accentHex: '#a855f7',
  },
  // ── Male Body Shapes (Buddies Studio Master Morphs) ──────────
  {
    id: 'body_m_vtaper',
    slot: 'body_shape',
    gender: 'male',
    name: 'Blitz V-Taper',
    subtitle: 'Broad Athletic Chest & Shoulders',
    collection: 'Master Body · Men',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    bodyShape: {
      morphWeights: {
        Chest_Build: 0.9,
        Shoulder_Width: 1.0,
        Arm_Muscle: 0.85,
        Waist_Slim: 0.72,
        Thigh_Fullness: 0.35,
      },
      heightScale: 1.025,
      widthScale: 1.055,
      baseDollGlbUrl: '/assets/avatars/male-vtaper.glb',
      silhouetteTag: 'V-Taper',
    },
    swatchGradient: ['#38bdf8', '#1e3a8a'],
    accentHex: '#38bdf8',
  },
  {
    id: 'body_m_athletic',
    slot: 'body_shape',
    gender: 'male',
    name: 'Blitz Lean Athletic',
    subtitle: 'Defined & Balanced Chest & Shoulders',
    collection: 'Master Body · Men',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    bodyShape: {
      morphWeights: {
        Chest_Build: 0.58,
        Shoulder_Width: 0.65,
        Arm_Muscle: 0.62,
        Waist_Slim: 0.48,
        Thigh_Fullness: 0.32,
      },
      heightScale: 1.015,
      widthScale: 1.025,
      baseDollGlbUrl: '/assets/avatars/male-athletic.glb',
      silhouetteTag: 'Athletic',
    },
    swatchGradient: ['#34d399', '#065f46'],
    accentHex: '#10b981',
  },
  {
    id: 'body_m_trapezoid',
    slot: 'body_shape',
    gender: 'male',
    name: 'Blitz Trapezoid',
    subtitle: 'Balanced Upright Build',
    collection: 'Master Body · Men',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    bodyShape: {
      morphWeights: {
        Chest_Build: 0.78,
        Shoulder_Width: 0.8,
        Arm_Muscle: 0.75,
        Waist_Slim: 0.35,
        Hip_Width: 0.25,
        Thigh_Fullness: 0.48,
      },
      heightScale: 1.02,
      widthScale: 1.045,
      baseDollGlbUrl: '/assets/avatars/male-trapezoid.glb',
      silhouetteTag: 'Balanced',
    },
    swatchGradient: ['#818cf8', '#312e81'],
    accentHex: '#6366f1',
  },
  {
    id: 'body_m_full_trapezoid',
    slot: 'body_shape',
    gender: 'male',
    name: 'Blitz Full Trapezoid',
    subtitle: 'Broad & Full Build',
    collection: 'Master Body · Men',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    bodyShape: {
      morphWeights: {
        Chest_Build: 1.0,
        Shoulder_Width: 0.96,
        Arm_Muscle: 1.0,
        Hip_Width: 0.48,
        Glute_Projection: 0.42,
        Thigh_Fullness: 0.82,
      },
      heightScale: 1.04,
      widthScale: 1.08,
      baseDollGlbUrl: '/assets/avatars/male-full-trapezoid.glb',
      silhouetteTag: 'Full',
    },
    swatchGradient: ['#fb923c', '#9a3412'],
    accentHex: '#f97316',
  },
  {
    id: 'body_m_rectangle',
    slot: 'body_shape',
    gender: 'male',
    name: 'Blitz Rectangle',
    subtitle: 'Straight & Even Solid Torso',
    collection: 'Master Body · Men',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    bodyShape: {
      morphWeights: {
        Chest_Build: 0.45,
        Shoulder_Width: 0.38,
        Arm_Muscle: 0.4,
        Hip_Width: 0.46,
        Thigh_Fullness: 0.46,
      },
      heightScale: 1.0,
      widthScale: 1.03,
      baseDollGlbUrl: '/assets/avatars/male-rectangle.glb',
      silhouetteTag: 'Solid',
    },
    swatchGradient: ['#94a3b8', '#334155'],
    accentHex: '#64748b',
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

  // ── Face: Nose (Pilihan Hidung) ──────────────────────────────────────────
  {
    id: 'face_nose_default',
    slot: 'face_nose',
    gender: 'unisex',
    name: 'Natural Base',
    subtitle: 'Classic Smooth Shading',
    collection: 'Face Essentials',
    priceLul: 0,
    isStarterDefault: true,
    glbPath: null,
    swatchGradient: ['#f5d0b5', '#b48366'],
    accentHex: '#d89b7b',
  },
  {
    id: 'face_nose_button',
    slot: 'face_nose',
    gender: 'unisex',
    name: 'Petite Button',
    subtitle: 'Imut Kancing Ala Anime',
    collection: 'Face Essentials',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    swatchGradient: ['#fbcfe8', '#db2777'],
    accentHex: '#ec4899',
  },
  {
    id: 'face_nose_anime_sculpted',
    slot: 'face_nose',
    gender: 'unisex',
    name: 'Anime Sculpted',
    subtitle: 'Mancung Runcing Tajam',
    collection: 'Face Essentials',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    swatchGradient: ['#fed7aa', '#c2410c'],
    accentHex: '#ea580c',
  },
  {
    id: 'face_nose_korean_petite',
    slot: 'face_nose',
    gender: 'unisex',
    name: 'Korean Petite',
    subtitle: 'Mungil Halus K-Idol',
    collection: 'Face Essentials',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    swatchGradient: ['#fef08a', '#ca8a04'],
    accentHex: '#eab308',
  },
  {
    id: 'face_nose_straight_elegant',
    slot: 'face_nose',
    gender: 'unisex',
    name: 'Straight Elegant',
    subtitle: 'Lurus Elegan Klasik',
    collection: 'Face Essentials',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    swatchGradient: ['#e9d5ff', '#7e22ce'],
    accentHex: '#a855f7',
  },
  {
    id: 'face_nose_defined_bridge',
    slot: 'face_nose',
    gender: 'unisex',
    name: 'Defined Bridge',
    subtitle: 'Batang Hidung Tegas',
    collection: 'Face Essentials',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    swatchGradient: ['#cbd5e1', '#334155'],
    accentHex: '#64748b',
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
    subtitle: 'Idle · Walk · Run · Sit (Nadia)',
    collection: 'Motion Essentials',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    animSet: {
      clipCandidates: ['nadia_idle.001', 'hana_idle.001', 'mira_idle.001', 'idle.001'],
      walkClipCandidates: ['nadia_walk.001', 'mira_walk.001'],
      runClipCandidates: ['nadia_run.001', 'mira_run.001'],
      sitClipCandidates: ['nadia_sit.001', 'mira_sit.001'],
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
    subtitle: 'Idle · Walk · Run · Sit (Calm)',
    collection: 'Motion Essentials',
    priceLul: 0,
    isStarterDefault: false,
    glbPath: null,
    animSet: {
      clipCandidates: ['hana_idle.001', 'mira_idle.001', 'kai_idle.001', 'idle.001'],
      walkClipCandidates: ['mira_walk.001', 'nadia_walk.001'],
      runClipCandidates: ['mira_run.001', 'nadia_run.001'],
      sitClipCandidates: ['mira_sit.001', 'nadia_sit.001'],
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
    subtitle: 'Idle · Walk · Run · Sit (Tari)',
    collection: 'Motion Atelier',
    priceLul: 14,
    isStarterDefault: false,
    glbPath: null,
    animSet: {
      clipCandidates: ['tari_idle.001', 'mira_idle.001', 'hana_idle.001', 'idle.001'],
      walkClipCandidates: ['tari_walk.001', 'mira_walk.001'],
      runClipCandidates: ['tari_run.001', 'mira_run.001'],
      sitClipCandidates: ['tari_sit.001', 'mira_sit.001'],
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
    subtitle: 'Idle · Walk · Run · Sit (Mira)',
    collection: 'Motion Atelier',
    priceLul: 14,
    isStarterDefault: false,
    glbPath: null,
    animSet: {
      clipCandidates: ['mira_idle.001', 'nadia_idle.001', 'idle.001'],
      walkClipCandidates: ['mira_walk.001', 'nadia_walk.001'],
      runClipCandidates: ['mira_run.001', 'nadia_run.001'],
      sitClipCandidates: ['mira_sit.001', 'nadia_sit.001'],
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
    subtitle: 'Idle · Walk · Run · Sit (Raka)',
    collection: 'Motion Atelier',
    priceLul: 16,
    isStarterDefault: false,
    glbPath: null,
    animSet: {
      clipCandidates: ['raka_idle.001', 'bima_idle.001', 'idle.001'],
      walkClipCandidates: ['raka_walk.001', 'bima_walk.001'],
      runClipCandidates: ['raka_run.001', 'bima_run.001'],
      sitClipCandidates: ['raka_sit.001', 'bima_sit.001'],
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
    subtitle: 'Idle · Walk · Run · Sit (Bima)',
    collection: 'Motion Atelier',
    priceLul: 14,
    isStarterDefault: false,
    glbPath: null,
    animSet: {
      clipCandidates: ['bima_idle.001', 'kenji_idle.001', 'idle.001'],
      walkClipCandidates: ['bima_walk.001', 'kenji_walk.001'],
      runClipCandidates: ['bima_run.001', 'kenji_run.001'],
      sitClipCandidates: ['bima_sit.001', 'kenji_sit.001'],
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
    subtitle: 'Idle · Walk · Run · Sit (Kenji)',
    collection: 'Motion Atelier',
    priceLul: 12,
    isStarterDefault: false,
    glbPath: null,
    animSet: {
      clipCandidates: ['kenji_idle.001', 'kai_idle.001', 'idle.001'],
      walkClipCandidates: ['kenji_walk.001', 'bima_walk.001'],
      runClipCandidates: ['kenji_run.001', 'bima_run.001'],
      sitClipCandidates: ['kenji_sit.001', 'bima_sit.001'],
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
  // ── Starter Defaults for Extended Face Makeup & Style Animation Tabs ──────
  {
    id: 'face_eyeshadow_default',
    slot: 'face_eyeshadow',
    gender: 'unisex',
    name: 'No Eyeshadow',
    subtitle: 'Clean Natural Eyelids',
    collection: 'Face Essentials',
    priceLul: 0,
    isStarterDefault: true,
    glbPath: null,
    swatchGradient: ['#e2e8f0', '#94a3b8'],
    accentHex: '#cbd5e1',
  },
  {
    id: 'face_blush_default',
    slot: 'face_blush',
    gender: 'unisex',
    name: 'No Blush',
    subtitle: 'Clean Natural Cheeks',
    collection: 'Face Essentials',
    priceLul: 0,
    isStarterDefault: true,
    glbPath: null,
    swatchGradient: ['#fecdd3', '#fda4af'],
    accentHex: '#fb7185',
  },
  {
    id: 'face_facepaint_default',
    slot: 'face_facepaint',
    gender: 'unisex',
    name: 'No Face Makeup',
    subtitle: 'Clean Natural Skin',
    collection: 'Face Essentials',
    priceLul: 0,
    isStarterDefault: true,
    glbPath: null,
    swatchGradient: ['#fde68a', '#f59e0b'],
    accentHex: '#fbbf24',
  },
  {
    id: 'face_beard_default',
    slot: 'face_beard',
    gender: 'male',
    name: 'Clean Shaven',
    subtitle: 'No Facial Hair',
    collection: 'Face Essentials',
    priceLul: 0,
    isStarterDefault: true,
    glbPath: null,
    swatchGradient: ['#94a3b8', '#475569'],
    accentHex: '#94a3b8',
  },
  {
    id: 'style_pose_default',
    slot: 'style_pose',
    gender: 'unisex',
    name: 'Default Stance',
    subtitle: 'Standard Studio Pose',
    collection: 'Pose Essentials',
    priceLul: 0,
    isStarterDefault: true,
    glbPath: null,
    dancePose: { danceKind: 'none', tempoBpm: 0, animGlbUrl: null, vibeTag: 'Base' },
    swatchGradient: ['#94a3b8', '#334155'],
    accentHex: '#94a3b8',
  },
  {
    id: 'style_action_default',
    slot: 'style_action',
    gender: 'unisex',
    name: 'No Action',
    subtitle: 'Standard Idle Motion',
    collection: 'Action Essentials',
    priceLul: 0,
    isStarterDefault: true,
    glbPath: null,
    dancePose: { danceKind: 'none', tempoBpm: 0, animGlbUrl: null, vibeTag: 'Base' },
    swatchGradient: ['#94a3b8', '#334155'],
    accentHex: '#94a3b8',
  },
  {
    id: 'style_paired_default',
    slot: 'style_paired',
    gender: 'unisex',
    name: 'No Paired Pose',
    subtitle: 'Preview Mode Off',
    collection: 'Paired Essentials',
    priceLul: 0,
    isStarterDefault: true,
    glbPath: null,
    swatchGradient: ['#94a3b8', '#334155'],
    accentHex: '#94a3b8',
  },
  {
    id: 'underwear_none',
    slot: 'underwear',
    gender: 'unisex',
    name: 'Bare / None',
    subtitle: 'No Underwear',
    collection: 'Underwear Essentials',
    priceLul: 0,
    isStarterDefault: true,
    glbPath: null,
    underwearSubSlot: 'underwear',
    swatchGradient: ['#e2c0a8', '#b88b6e'],
    accentHex: '#d4a383',
  },
] as const;

// ---------------------------------------------------------------------------
// Dynamic External Catalog Registry (Beauty/Makeup + 4-State Animations + Fitted Outfits + Underwear)
// Loaded lazily from `/assets/{beauty,animations,outfit/fitted,underwear}/catalog.json`
// ---------------------------------------------------------------------------
let dynamicExternalWardrobeItems: WardrobeCatalogItem[] = [];
const dynamicExternalItemsById = new Map<string, WardrobeCatalogItem>();
let externalCatalogsLoadPromise: Promise<number> | null = null;
let externalCatalogsLoaded = false;

interface RawBeautyCatalogJson {
  items?: Array<{
    id: string;
    category: string;
    gender?: string;
    label: string;
    thumbUrl?: string | null;
    f?: BeautyUvLayerSpec;
    m?: BeautyUvLayerSpec;
  }>;
}

interface RawAnimCatalogJson {
  items?: Array<{
    id: string;
    category: string;
    subKind?: 'pose' | 'dance';
    gender?: string;
    label: string;
    styleTag?: string;
    glbPath: string;
    idleGlbPath?: string;
    walkGlbPath?: string;
    runGlbPath?: string;
    sitGlbPath?: string;
    initiateGlbPath?: string;
    receiveGlbPath?: string;
  }>;
}

interface RawFittedOutfitCatalogJson {
  items?: Array<{
    id: string;
    slot: 'top' | 'bottoms' | 'shoes' | 'hair';
    gender: 'female' | 'male';
    name: string;
    collection?: string;
    glbPath: string;
    swatchGradient?: [string, string];
    accentHex?: string;
  }>;
}

interface RawUnderwearCatalogJson {
  items?: Array<{
    id: string;
    sourceId: string;
    subSlot: 'underwear' | 'corewear';
    gender: 'female' | 'male';
    label: string;
    tag?: string;
    thumbUrl?: string | null;
    uv: BeautyUvLayerSpec;
  }>;
}

const BEAUTY_CAT_TO_SLOT: Record<string, Exclude<WardrobeStudioCategoryId, 'presets'>> = {
  eyes: 'face_eyes',
  brows: 'face_brows',
  lips: 'face_lips',
  eyeshadow: 'face_eyeshadow',
  blush: 'face_blush',
  facepaint: 'face_facepaint',
  faceoverlay: 'face_facepaint',
  beard: 'face_beard',
};

const BEAUTY_CAT_PALETTE: Record<string, { grad: [string, string]; accent: string; col: string }> = {
  eyes: { grad: ['#7dd3fc', '#1e3a8a'], accent: '#38bdf8', col: 'Glow Salon · Eyes' },
  brows: { grad: ['#78350f', '#292524'], accent: '#d97706', col: 'Glow Salon · Brows' },
  lips: { grad: ['#fb7185', '#881337'], accent: '#f43f5e', col: 'Glow Salon · Lips' },
  eyeshadow: { grad: ['#c084fc', '#581c87'], accent: '#a855f7', col: 'Glow Salon · Eyeshadow' },
  blush: { grad: ['#fda4af', '#be123c'], accent: '#fb7185', col: 'Glow Salon · Blush' },
  facepaint: { grad: ['#fcd34d', '#b45309'], accent: '#f59e0b', col: 'Glow Salon · Makeup' },
  faceoverlay: { grad: ['#f9a8d4', '#831843'], accent: '#ec4899', col: 'Glow Salon · Face Art' },
  beard: { grad: ['#64748b', '#1e293b'], accent: '#94a3b8', col: 'Glow Salon · Beard' },
};

const ANIM_CAT_PALETTE: Record<string, { grad: [string, string]; accent: string; col: string; tag: string }> = {
  idle: { grad: ['#38bdf8', '#1e3a8a'], accent: '#38bdf8', col: 'Studio Motion · Idle', tag: 'Idle Set' },
  dance: { grad: ['#e879f9', '#701a75'], accent: '#d946ef', col: 'Studio Motion · Dance', tag: 'Dance' },
  pose: { grad: ['#34d399', '#065f46'], accent: '#10b981', col: 'Studio Motion · Pose', tag: 'Pose' },
  action: { grad: ['#fbbf24', '#92400e'], accent: '#f59e0b', col: 'Studio Motion · Action', tag: 'Action' },
  paired: { grad: ['#fb7185', '#9f1239'], accent: '#f43f5e', col: 'Studio Motion · Paired', tag: 'Duo' },
};

const EXCLUDED_UGLY_POSE_LABELS = new Set([
  'line',
  'diva pose1',
  'diva pose 1',
  'wave',
  'cheer',
  'dance',
  'friendly wave',
  'victory cheer',
]);

const EXCLUDED_UGLY_POSE_IDS = new Set([
  'style_dance_wave',
  'style_dance_cheer',
]);

const EXCLUDED_UGLY_POSE_ID_PATTERN = /(^|[_-])(line|diva[_-]?pose[_-]?1)$/;

/**
 * Excludes low-quality / unwanted poses (Wave, Cheer, Dance, Line, Diva Pose1)
 * from the Pose catalog, Quick Pose modal, and City Selfie Camera.
 */
export function isExcludedUglyPoseItem(item: {
  id?: string | null;
  name?: string | null;
  label?: string | null;
  slot?: string | null;
  category?: string | null;
}): boolean {
  const slotOrCat = (item.slot ?? item.category ?? '').trim().toLowerCase();
  const isPoseLike =
    !slotOrCat ||
    slotOrCat === 'pose' ||
    slotOrCat === 'action' ||
    slotOrCat === 'dance' ||
    slotOrCat === 'style_pose' ||
    slotOrCat === 'style_action' ||
    slotOrCat === 'style_dance';
  if (!isPoseLike) return false;

  const normalizedId = (item.id ?? '').trim().toLowerCase();
  if (
    normalizedId &&
    (EXCLUDED_UGLY_POSE_IDS.has(normalizedId) || EXCLUDED_UGLY_POSE_ID_PATTERN.test(normalizedId))
  ) {
    return true;
  }

  const normalizedLabel = (item.name ?? item.label ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return Boolean(normalizedLabel && EXCLUDED_UGLY_POSE_LABELS.has(normalizedLabel));
}

function registerExternalWardrobeItems(items: readonly WardrobeCatalogItem[]): void {
  for (const item of items) {
    if (isExcludedUglyPoseItem(item)) continue;
    if (!dynamicExternalItemsById.has(item.id)) {
      dynamicExternalItemsById.set(item.id, item);
      dynamicExternalWardrobeItems.push(item);
    }
  }
}

export function getExternalWardrobeCatalogCount(): number {
  return dynamicExternalWardrobeItems.length;
}

/**
 * External Face/Beauty thumbnails under `/assets/beauty/*_t.webp` were cropped
 * directly from `Blitz_Mask_Head` glTF `flipY = false` UV maps, so they are
 * vertically inverted in image space and must be flipped vertically (`scaleY(-1)`)
 * when shown in 2D catalog previews (whereas underwear thumbnails and procedural
 * canvas previews are already right-side-up).
 */
export function shouldFlipWardrobeThumbY(
  item: Pick<WardrobeCatalogItem, 'thumbUrl' | 'thumbFlipY'>,
): boolean {
  if (typeof item.thumbFlipY === 'boolean') {
    return item.thumbFlipY;
  }
  return Boolean(item.thumbUrl && item.thumbUrl.startsWith('/assets/beauty/'));
}

/**
 * Lazily fetches `/assets/beauty/catalog.json` (403 beauty/makeup/beard overlays)
 * and `/assets/animations/catalog.json` (134 Dance/Pose/Action/Idle animations)
 * and registers them into the active Wardrobe Studio catalog.
 */
export function loadExternalWardrobeCatalogs(): Promise<number> {
  if (externalCatalogsLoaded) {
    return Promise.resolve(dynamicExternalWardrobeItems.length);
  }
  if (externalCatalogsLoadPromise) {
    return externalCatalogsLoadPromise;
  }
  if (typeof fetch !== 'function') {
    return Promise.resolve(0);
  }

  externalCatalogsLoadPromise = (async () => {
    const collected: WardrobeCatalogItem[] = [];
    const [beautyRes, animRes, fittedRes, underwearRes] = await Promise.all([
      fetch('/assets/beauty/catalog.json').then((r) => (r.ok ? (r.json() as Promise<RawBeautyCatalogJson>) : null)).catch(() => null),
      fetch('/assets/animations/catalog.json').then((r) => (r.ok ? (r.json() as Promise<RawAnimCatalogJson>) : null)).catch(() => null),
      fetch('/assets/outfit/fitted/catalog.json').then((r) => (r.ok ? (r.json() as Promise<RawFittedOutfitCatalogJson>) : null)).catch(() => null),
      fetch('/assets/underwear/catalog.json').then((r) => (r.ok ? (r.json() as Promise<RawUnderwearCatalogJson>) : null)).catch(() => null),
    ]);

    if (underwearRes?.items && Array.isArray(underwearRes.items)) {
      for (const u of underwearRes.items) {
        if (!u.id || !u.uv?.url) continue;
        const gender: WardrobeItemGender = u.gender === 'male' ? 'male' : 'female';
        const subSlot: 'underwear' | 'corewear' = u.subSlot === 'corewear' ? 'corewear' : 'underwear';
        const isCore = subSlot === 'corewear';
        const grad: [string, string] = isCore
          ? gender === 'female'
            ? ['#f472b6', '#831843']
            : ['#60a5fa', '#1e3a8a']
          : gender === 'female'
            ? ['#fda4af', '#9f1239']
            : ['#94a3b8', '#1e293b'];
        collected.push({
          id: u.id,
          slot: 'underwear',
          underwearSubSlot: subSlot,
          gender,
          name: u.label,
          subtitle: u.tag || (isCore ? 'Corewear' : 'Underwear'),
          collection: isCore ? 'Corewear · Singlet/Bustier' : 'Underwear · Essentials',
          priceLul: 0,
          isStarterDefault: false,
          glbPath: null,
          thumbUrl: u.thumbUrl ?? null,
          beautyOverlay: {
            f: gender === 'female' ? u.uv : null,
            m: gender === 'male' ? u.uv : null,
          },
          swatchGradient: grad,
          accentHex: grad[0],
        });
      }
    }

    if (fittedRes?.items && Array.isArray(fittedRes.items)) {
      for (const f of fittedRes.items) {
        if (
          f.slot !== 'top' &&
          f.slot !== 'bottoms' &&
          f.slot !== 'shoes' &&
          f.slot !== 'hair'
        ) {
          continue;
        }
        const grad: [string, string] =
          Array.isArray(f.swatchGradient) && f.swatchGradient.length === 2
            ? [f.swatchGradient[0], f.swatchGradient[1]]
            : ['#64748b', '#1e293b'];
        collected.push({
          id: f.id,
          slot: f.slot,
          gender: f.gender === 'male' ? 'male' : 'female',
          name: f.name,
          subtitle: f.slot === 'hair' ? 'Salon Hairstyle' : 'Morph-Fit Boutique',
          collection: f.collection || 'Blitz Boutique',
          priceLul: 0,
          isStarterDefault: false,
          glbPath: f.glbPath,
          swatchGradient: grad,
          accentHex: f.accentHex || grad[0],
        });
      }
    }

    if (beautyRes?.items && Array.isArray(beautyRes.items)) {
      for (const b of beautyRes.items) {
        const slot = BEAUTY_CAT_TO_SLOT[b.category];
        if (!slot) continue;
        const pal = BEAUTY_CAT_PALETTE[b.category] ?? BEAUTY_CAT_PALETTE.facepaint;
        const gender: WardrobeItemGender =
          b.gender === 'male' ? 'male' : b.gender === 'female' ? 'female' : 'unisex';
        collected.push({
          id: b.id,
          slot,
          gender,
          name: b.label,
          subtitle: pal.col,
          collection: pal.col,
          priceLul: 0,
          isStarterDefault: false,
          glbPath: null,
          thumbUrl: b.thumbUrl ?? null,
          thumbFlipY: Boolean(b.thumbUrl),
          beautyOverlay: {
            f: b.f ?? null,
            m: b.m ?? null,
          },
          swatchGradient: pal.grad,
          accentHex: pal.accent,
        });
      }
    }

    if (animRes?.items && Array.isArray(animRes.items)) {
      for (const a of animRes.items) {
        const pal = ANIM_CAT_PALETTE[a.category === 'anim_set' ? 'idle' : a.category] ?? ANIM_CAT_PALETTE.action;
        const gender: WardrobeItemGender =
          a.gender === 'male' ? 'male' : a.gender === 'female' ? 'female' : 'unisex';
        if (a.category === 'anim_set' || a.category === 'idle') {
          collected.push({
            id: a.id,
            slot: 'style_anim',
            gender,
            name: a.label,
            subtitle: a.styleTag ? `${a.styleTag} · Idle/Walk/Run/Sit` : 'Idle · Walk · Run · Sit',
            collection: pal.col,
            priceLul: 0,
            isStarterDefault: false,
            glbPath: null,
            animSet: {
              clipCandidates: [`${a.id}_idle`],
              walkClipCandidates: a.walkGlbPath ? [`${a.id}_walk`] : undefined,
              runClipCandidates: a.runGlbPath ? [`${a.id}_run`] : undefined,
              sitClipCandidates: a.sitGlbPath ? [`${a.id}_sit`] : undefined,
              animGlbUrl: a.idleGlbPath ?? a.glbPath,
              walkGlbUrl: a.walkGlbPath ?? null,
              runGlbUrl: a.runGlbPath ?? null,
              sitGlbUrl: a.sitGlbPath ?? null,
              vibeTag: '4-State',
            },
            swatchGradient: pal.grad,
            accentHex: pal.accent,
          });
        } else if (a.category === 'paired' && a.initiateGlbPath && a.receiveGlbPath) {
          const subKind: 'pose' | 'dance' = a.subKind === 'dance' ? 'dance' : 'pose';
          const grad: [string, string] =
            subKind === 'dance' ? ['#f472b6', '#831843'] : ['#fb7185', '#9f1239'];
          collected.push({
            id: a.id,
            slot: 'style_paired',
            gender: 'unisex',
            name: a.label,
            subtitle: a.styleTag || (subKind === 'dance' ? 'Dance Duo' : 'Pose Duo'),
            collection: pal.col,
            priceLul: 0,
            isStarterDefault: false,
            glbPath: null,
            pairedAnim: {
              initiateGlbUrl: a.initiateGlbPath,
              receiveGlbUrl: a.receiveGlbPath,
              subKind,
              vibeTag: subKind === 'dance' ? 'Dance Duo' : 'Pose Duo',
            },
            swatchGradient: grad,
            accentHex: grad[0],
          });
        } else if (a.category === 'dance' || a.category === 'pose' || a.category === 'action') {
          if (isExcludedUglyPoseItem({ id: a.id, label: a.label, category: a.category })) {
            continue;
          }
          const slot: 'style_dance' | 'style_pose' | 'style_action' =
            a.category === 'dance'
              ? 'style_dance'
              : a.category === 'pose'
                ? 'style_pose'
                : 'style_action';
          collected.push({
            id: a.id,
            slot,
            gender: 'unisex',
            name: a.label,
            subtitle: `${pal.tag} Mocap`,
            collection: pal.col,
            priceLul: 0,
            isStarterDefault: false,
            glbPath: null,
            dancePose: {
              danceKind: 'none',
              tempoBpm: 0,
              animGlbUrl: a.glbPath,
              vibeTag: pal.tag,
            },
            swatchGradient: pal.grad,
            accentHex: pal.accent,
          });
        }
      }
    }

    registerExternalWardrobeItems(collected);
    externalCatalogsLoaded = true;
    return dynamicExternalWardrobeItems.length;
  })();

  return externalCatalogsLoadPromise;
}

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
  // Female Curated Looks (Clean Blender Modular Sets)
  {
    id: 'preset_builtin_f_noir_atelier',
    name: 'Glam Atelier 01',
    createdAtMs: 1,
    isBuiltIn: true,
    gender: 'female',
    draft: {
      ...EMPTY_WARDROBE_DRAFT,
      hairId: 'bl_bl_f_o1_hair',
      setId: 'bl_set_f_outfit01',
    },
    accentGradient: ['#475569', '#09090b'],
  },
  {
    id: 'preset_builtin_f_city_chic',
    name: 'Nadia Studio 02',
    createdAtMs: 2,
    isBuiltIn: true,
    gender: 'female',
    draft: {
      ...EMPTY_WARDROBE_DRAFT,
      hairId: 'bl_bl_f_o2_hair',
      setId: 'bl_set_f_outfit02',
    },
    accentGradient: ['#38bdf8', '#1d4ed8'],
  },
  {
    id: 'preset_builtin_f_academy_street',
    name: 'Mira Street 03',
    createdAtMs: 3,
    isBuiltIn: true,
    gender: 'female',
    draft: {
      ...EMPTY_WARDROBE_DRAFT,
      hairId: 'bl_bl_f_o3_hair',
      setId: 'bl_set_f_outfit03',
    },
    accentGradient: ['#facc15', '#b45309'],
  },
  {
    id: 'preset_builtin_f_urban_luxe',
    name: 'Urban Chic 04',
    createdAtMs: 4,
    isBuiltIn: true,
    gender: 'female',
    draft: {
      ...EMPTY_WARDROBE_DRAFT,
      hairId: 'bl_bl_f_o4_hair',
      setId: 'bl_set_f_outfit04',
    },
    accentGradient: ['#475569', '#0f172a'],
  },
  // Male Curated Looks (Clean Blender Modular Sets)
  {
    id: 'preset_builtin_m_plaza_street',
    name: 'Pure Street 01',
    createdAtMs: 5,
    isBuiltIn: true,
    gender: 'male',
    draft: {
      ...EMPTY_WARDROBE_DRAFT,
      hairId: 'bl_bl_m_o1_hair',
      setId: 'bl_set_m_outfit01',
    },
    accentGradient: ['#e2e8f0', '#475569'],
  },
  {
    id: 'preset_builtin_m_metro_layered',
    name: 'Casual Hoodie 02',
    createdAtMs: 6,
    isBuiltIn: true,
    gender: 'male',
    draft: {
      ...EMPTY_WARDROBE_DRAFT,
      hairId: 'bl_bl_m_o2_hair',
      setId: 'bl_set_m_outfit02',
    },
    accentGradient: ['#334155', '#09090b'],
  },
  {
    id: 'preset_builtin_m_studio_casual',
    name: 'Floral Flame 03',
    createdAtMs: 7,
    isBuiltIn: true,
    gender: 'male',
    draft: {
      ...EMPTY_WARDROBE_DRAFT,
      hairId: 'bl_bl_m_o3_hair',
      setId: 'bl_set_m_outfit03',
    },
    accentGradient: ['#fb923c', '#9a3412'],
  },
  {
    id: 'preset_builtin_m_vanguard_urban',
    name: 'Cream Urban 04',
    createdAtMs: 8,
    isBuiltIn: true,
    gender: 'male',
    draft: {
      ...EMPTY_WARDROBE_DRAFT,
      hairId: 'bl_bl_m_o4_hair',
      setId: 'bl_set_m_outfit04',
    },
    accentGradient: ['#fde68a', '#78350f'],
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
  return (
    WARDROBE_STUDIO_ITEMS.find((item) => item.id === id) ??
    dynamicExternalItemsById.get(id) ??
    null
  );
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
  const staticInSlot = WARDROBE_STUDIO_ITEMS.filter(
    (item) => item.slot === slot && isWardrobeItemCompatibleWithGender(item, characterGender),
  );
  const dynamicInSlot = dynamicExternalWardrobeItems.filter(
    (item) => item.slot === slot && isWardrobeItemCompatibleWithGender(item, characterGender),
  );
  const inSlot = dynamicInSlot.length > 0 ? [...staticInSlot, ...dynamicInSlot] : staticInSlot;
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
    (a.underwearId ?? null) === (b.underwearId ?? null) &&
    (a.corewearId ?? null) === (b.corewearId ?? null) &&
    Boolean(a.hideOuterForUnderwear) === Boolean(b.hideOuterForUnderwear) &&
    Boolean(a.hideBaseUnderwear) === Boolean(b.hideBaseUnderwear) &&
    a.bodyShapeId === b.bodyShapeId &&
    a.eyeStyleId === b.eyeStyleId &&
    a.browStyleId === b.browStyleId &&
    a.lipStyleId === b.lipStyleId &&
    (a.eyeshadowId ?? null) === (b.eyeshadowId ?? null) &&
    (a.blushId ?? null) === (b.blushId ?? null) &&
    (a.facepaintId ?? null) === (b.facepaintId ?? null) &&
    (a.beardId ?? null) === (b.beardId ?? null) &&
    a.animSetId === b.animSetId &&
    a.dancePoseId === b.dancePoseId &&
    (a.stylePoseId ?? null) === (b.stylePoseId ?? null) &&
    (a.styleActionId ?? null) === (b.styleActionId ?? null) &&
    (a.stylePairedId ?? null) === (b.stylePairedId ?? null) &&
    a.clothingTintHex === b.clothingTintHex &&
    (a.noseStyleId ?? 'face_nose_default') === (b.noseStyleId ?? 'face_nose_default') &&
    (a.lipScale ?? 1.0) === (b.lipScale ?? 1.0) &&
    (a.lipOffsetY ?? 0) === (b.lipOffsetY ?? 0) &&
    (a.eyeSpacing ?? 0) === (b.eyeSpacing ?? 0) &&
    (a.eyeTiltDeg ?? 0) === (b.eyeTiltDeg ?? 0) &&
    (a.eyeScale ?? 1.0) === (b.eyeScale ?? 1.0) &&
    (a.browOffsetY ?? 0) === (b.browOffsetY ?? 0) &&
    (a.browTiltDeg ?? 0) === (b.browTiltDeg ?? 0) &&
    (a.headScale ?? 1.0) === (b.headScale ?? 1.0)
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
 * conflicting garment slots cleanly, while Body Shape, Face Makeup, Style, and Hair
 * remain orthogonal so players can combine any silhouette with any outfit or full set.
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
  if (item.slot === 'face_eyeshadow') {
    next.eyeshadowId = (next.eyeshadowId ?? null) === resolvedId ? null : resolvedId;
    return next;
  }
  if (item.slot === 'face_blush') {
    next.blushId = (next.blushId ?? null) === resolvedId ? null : resolvedId;
    return next;
  }
  if (item.slot === 'face_facepaint') {
    next.facepaintId = (next.facepaintId ?? null) === resolvedId ? null : resolvedId;
    return next;
  }
  if (item.slot === 'face_beard') {
    next.beardId = (next.beardId ?? null) === resolvedId ? null : resolvedId;
    return next;
  }
  if (item.slot === 'face_nose') {
    next.noseStyleId = next.noseStyleId === resolvedId ? 'face_nose_default' : resolvedId;
    return next;
  }
  if (item.slot === 'style_anim') {
    next.animSetId = next.animSetId === resolvedId ? null : resolvedId;
    next.stylePoseId = null;
    next.styleActionId = null;
    return next;
  }
  if (item.slot === 'style_dance') {
    next.dancePoseId = next.dancePoseId === resolvedId ? null : resolvedId;
    next.stylePoseId = null;
    next.styleActionId = null;
    return next;
  }
  if (item.slot === 'style_pose') {
    next.stylePoseId = (next.stylePoseId ?? null) === resolvedId ? null : resolvedId;
    next.dancePoseId = null;
    next.styleActionId = null;
    return next;
  }
  if (item.slot === 'style_action') {
    next.styleActionId = (next.styleActionId ?? null) === resolvedId ? null : resolvedId;
    next.dancePoseId = null;
    next.stylePoseId = null;
    next.stylePairedId = null;
    return next;
  }
  if (item.slot === 'style_paired') {
    next.stylePairedId = (next.stylePairedId ?? null) === resolvedId ? null : resolvedId;
    next.dancePoseId = null;
    next.stylePoseId = null;
    next.styleActionId = null;
    return next;
  }
  if (item.slot === 'underwear') {
    if (item.isStarterDefault) {
      const alreadyBare =
        (next.underwearId ?? null) === null &&
        (next.corewearId ?? null) === null &&
        Boolean(next.hideBaseUnderwear);
      next.underwearId = null;
      next.corewearId = null;
      next.hideBaseUnderwear = !alreadyBare;
    } else if (item.underwearSubSlot === 'corewear') {
      next.corewearId = (next.corewearId ?? null) === resolvedId ? null : resolvedId;
      if (next.corewearId) next.hideBaseUnderwear = false;
    } else {
      next.underwearId = (next.underwearId ?? null) === resolvedId ? null : resolvedId;
      if (next.underwearId) next.hideBaseUnderwear = false;
    }
    return next;
  }
  if (item.slot === 'set') {
    const isSame = next.setId === resolvedId;
    next.setId = isSame ? null : resolvedId;
    next.hideOuterForUnderwear = false;
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
    next.hideOuterForUnderwear = false;
  } else if (item.slot === 'bottoms') {
    next.bottomsId = next.bottomsId === resolvedId ? null : resolvedId;
    next.hideOuterForUnderwear = false;
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
    draft.underwearId,
    draft.corewearId,
    draft.bodyShapeId,
    draft.eyeStyleId,
    draft.browStyleId,
    draft.lipStyleId,
    draft.eyeshadowId,
    draft.blushId,
    draft.facepaintId,
    draft.beardId,
    draft.animSetId,
    draft.dancePoseId,
    draft.stylePoseId,
    draft.styleActionId,
    draft.stylePairedId,
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
    underwearId: keepIfOwned(draft.underwearId),
    corewearId: keepIfOwned(draft.corewearId),
    hideOuterForUnderwear: Boolean(draft.hideOuterForUnderwear),
    bodyShapeId: keepIfOwned(draft.bodyShapeId),
    eyeStyleId: keepIfOwned(draft.eyeStyleId),
    browStyleId: keepIfOwned(draft.browStyleId),
    lipStyleId: keepIfOwned(draft.lipStyleId),
    eyeshadowId: keepIfOwned(draft.eyeshadowId),
    blushId: keepIfOwned(draft.blushId),
    facepaintId: keepIfOwned(draft.facepaintId),
    beardId: keepIfOwned(draft.beardId),
    animSetId: keepIfOwned(draft.animSetId),
    dancePoseId: keepIfOwned(draft.dancePoseId),
    stylePoseId: keepIfOwned(draft.stylePoseId),
    styleActionId: keepIfOwned(draft.styleActionId),
    stylePairedId: keepIfOwned(draft.stylePairedId),
    clothingTintHex: draft.clothingTintHex,
    noseStyleId: keepIfOwned(draft.noseStyleId) ?? 'face_nose_default',
    lipScale: draft.lipScale ?? 1.0,
    lipOffsetY: draft.lipOffsetY ?? 0,
    eyeSpacing: draft.eyeSpacing ?? 0,
    eyeTiltDeg: draft.eyeTiltDeg ?? 0,
    eyeScale: draft.eyeScale ?? 1.0,
    browOffsetY: draft.browOffsetY ?? 0,
    browTiltDeg: draft.browTiltDeg ?? 0,
    headScale: draft.headScale ?? 1.0,
  };
}

/**
 * Returns all owned Pose, Action, and Dance items available for the quick Pose popup
 * above the movement joystick (excludes "None / Default" reset cards).
 */
export function getOwnedQuickPoseActionItems(
  ownedApparelIds: readonly string[],
  characterGender?: 'male' | 'female',
): WardrobeCatalogItem[] {
  const slots: ReadonlyArray<'style_pose' | 'style_action' | 'style_dance'> = [
    'style_pose',
    'style_action',
    'style_dance',
  ];
  const out: WardrobeCatalogItem[] = [];
  for (const slot of slots) {
    const part = partitionWardrobeCategoryItems(
      slot,
      ownedApparelIds,
      'owned',
      'featured',
      characterGender,
    );
    for (const item of part.owned) {
      if (item.isStarterDefault) continue;
      if (isExcludedUglyPoseItem(item)) continue;
      if (!item.dancePose?.animGlbUrl) continue;
      out.push(item);
    }
  }
  return out;
}

/**
 * Returns all owned Paired (2-person) Pose & Dance animations available when
 * interacting with a nearby player or NPC.
 */
export function getOwnedPairedAnimationItems(
  ownedApparelIds: readonly string[],
  characterGender?: 'male' | 'female',
): WardrobeCatalogItem[] {
  const part = partitionWardrobeCategoryItems(
    'style_paired',
    ownedApparelIds,
    'owned',
    'featured',
    characterGender,
  );
  return part.owned.filter((item) => !item.isStarterDefault && Boolean(item.pairedAnim));
}

export function resolveWardrobeDraftAnimStyle(draft: WardrobeOutfitDraft): {
  clipCandidates: readonly string[];
  walkClipCandidates: readonly string[];
  runClipCandidates: readonly string[];
  sitClipCandidates: readonly string[];
  danceKind: WardrobeDanceKind;
  tempoBpm: number;
  externalAnimGlbUrl: string | null;
  externalClipKey: string | null;
  walkGlbUrl: string | null;
  walkClipKey: string | null;
  runGlbUrl: string | null;
  runClipKey: string | null;
  sitGlbUrl: string | null;
  sitClipKey: string | null;
} {
  const animItem = getWardrobeCatalogItemById(draft.animSetId);
  const danceItem = getWardrobeCatalogItemById(draft.dancePoseId);
  const poseItem = getWardrobeCatalogItemById(draft.stylePoseId);
  const actionItem = getWardrobeCatalogItemById(draft.styleActionId);
  const activeSet = animItem && animItem.slot === 'style_anim' ? animItem.animSet : undefined;

  let externalAnimGlbUrl: string | null = null;
  let externalClipKey: string | null = null;
  if (actionItem?.dancePose?.animGlbUrl) {
    externalAnimGlbUrl = actionItem.dancePose.animGlbUrl;
    externalClipKey = actionItem.id;
  } else if (poseItem?.dancePose?.animGlbUrl) {
    externalAnimGlbUrl = poseItem.dancePose.animGlbUrl;
    externalClipKey = poseItem.id;
  } else if (danceItem?.dancePose?.animGlbUrl) {
    externalAnimGlbUrl = danceItem.dancePose.animGlbUrl;
    externalClipKey = danceItem.id;
  } else if (activeSet?.animGlbUrl) {
    externalAnimGlbUrl = activeSet.animGlbUrl;
    externalClipKey = `${animItem!.id}_idle`;
  }

  return {
    clipCandidates: activeSet
      ? activeSet.clipCandidates
      : ['nadia_idle.001', 'hana_idle.001', 'mira_idle.001', 'idle.001'],
    walkClipCandidates: activeSet?.walkClipCandidates ?? [],
    runClipCandidates: activeSet?.runClipCandidates ?? [],
    sitClipCandidates: activeSet?.sitClipCandidates ?? [],
    danceKind:
      !externalAnimGlbUrl && danceItem && danceItem.slot === 'style_dance' && danceItem.dancePose
        ? danceItem.dancePose.danceKind
        : 'none',
    tempoBpm:
      !externalAnimGlbUrl && danceItem && danceItem.slot === 'style_dance' && danceItem.dancePose
        ? danceItem.dancePose.tempoBpm
        : 0,
    externalAnimGlbUrl,
    externalClipKey,
    walkGlbUrl: activeSet?.walkGlbUrl ?? null,
    walkClipKey: activeSet?.walkGlbUrl && animItem ? `${animItem.id}_walk` : null,
    runGlbUrl: activeSet?.runGlbUrl ?? null,
    runClipKey: activeSet?.runGlbUrl && animItem ? `${animItem.id}_run` : null,
    sitGlbUrl: activeSet?.sitGlbUrl ?? null,
    sitClipKey: activeSet?.sitGlbUrl && animItem ? `${animItem.id}_sit` : null,
  };
}

/**
 * Resolves the active Body Shape morph & silhouette profile for a draft.
 */
export function resolveWardrobeDraftBodyShape(
  draft: WardrobeOutfitDraft,
): WardrobeBodyShapeProfile {
  const item = getWardrobeCatalogItemById(draft.bodyShapeId);
  const base =
    item && item.slot === 'body_shape' && item.bodyShape
      ? item.bodyShape
      : DEFAULT_NEUTRAL_BODY_SHAPE;
  const headScale =
    typeof draft.headScale === 'number' && Number.isFinite(draft.headScale)
      ? Math.max(0.78, Math.min(1.06, draft.headScale))
      : 1.0;
  return {
    ...base,
    headScale,
  };
}

/**
 * Resolves the active Face & Makeup customization (Eyes, Brows, Lips, Eyeshadow,
 * Blush, Face Paint/Art, Beard) for a draft, choosing gender-calibrated UV overlays.
 */
export function resolveWardrobeDraftFaceCustomization(
  draft: WardrobeOutfitDraft,
  characterGender?: 'male' | 'female',
): BuddyFaceCustomizationProfile {
  const pickOverlay = (item: WardrobeCatalogItem | null): BeautyUvLayerSpec | null => {
    if (!item || item.isStarterDefault || !item.beautyOverlay) return null;
    if (characterGender === 'male') {
      return item.beautyOverlay.m ?? item.beautyOverlay.f ?? null;
    }
    return item.beautyOverlay.f ?? item.beautyOverlay.m ?? null;
  };

  const eyeItem = getWardrobeCatalogItemById(draft.eyeStyleId);
  const browItem = getWardrobeCatalogItemById(draft.browStyleId);
  const lipItem = getWardrobeCatalogItemById(draft.lipStyleId);
  const eyeshadowItem = getWardrobeCatalogItemById(draft.eyeshadowId);
  const blushItem = getWardrobeCatalogItemById(draft.blushId);
  const facepaintItem = getWardrobeCatalogItemById(draft.facepaintId);
  const beardItem = getWardrobeCatalogItemById(draft.beardId);
  const underwearItem = getWardrobeCatalogItemById(draft.underwearId);
  const corewearItem = getWardrobeCatalogItemById(draft.corewearId);

  const pickGenderedOverlay = (item: WardrobeCatalogItem | null): BeautyUvLayerSpec | null => {
    if (!item || !isWardrobeItemCompatibleWithGender(item, characterGender)) return null;
    return pickOverlay(item);
  };

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
    eyeOverlay: eyeItem?.slot === 'face_eyes' ? pickOverlay(eyeItem) : null,
    browOverlay: browItem?.slot === 'face_brows' ? pickOverlay(browItem) : null,
    lipOverlay: lipItem?.slot === 'face_lips' ? pickOverlay(lipItem) : null,
    eyeshadowOverlay: eyeshadowItem?.slot === 'face_eyeshadow' ? pickOverlay(eyeshadowItem) : null,
    blushOverlay: blushItem?.slot === 'face_blush' ? pickOverlay(blushItem) : null,
    facepaintOverlay: facepaintItem?.slot === 'face_facepaint' ? pickOverlay(facepaintItem) : null,
    beardOverlay: beardItem?.slot === 'face_beard' ? pickGenderedOverlay(beardItem) : null,
    underwearOverlay:
      underwearItem?.slot === 'underwear' ? pickGenderedOverlay(underwearItem) : null,
    corewearOverlay:
      corewearItem?.slot === 'underwear' ? pickGenderedOverlay(corewearItem) : null,
    hideBaseUnderwear: Boolean(draft.hideBaseUnderwear),
    tuning: {
      lipScale:
        typeof draft.lipScale === 'number' && Number.isFinite(draft.lipScale)
          ? Math.max(0.72, Math.min(1.18, draft.lipScale))
          : 1.0,
      lipOffsetY:
        typeof draft.lipOffsetY === 'number' && Number.isFinite(draft.lipOffsetY)
          ? Math.max(-6, Math.min(6, draft.lipOffsetY))
          : 0,
      eyeSpacing:
        typeof draft.eyeSpacing === 'number' && Number.isFinite(draft.eyeSpacing)
          ? Math.max(-5, Math.min(10, draft.eyeSpacing))
          : 0,
      eyeTiltDeg:
        typeof draft.eyeTiltDeg === 'number' && Number.isFinite(draft.eyeTiltDeg)
          ? Math.max(-8, Math.min(10, draft.eyeTiltDeg))
          : 0,
      eyeScale:
        typeof draft.eyeScale === 'number' && Number.isFinite(draft.eyeScale)
          ? Math.max(0.82, Math.min(1.22, draft.eyeScale))
          : 1.0,
      browOffsetY:
        typeof draft.browOffsetY === 'number' && Number.isFinite(draft.browOffsetY)
          ? Math.max(-7, Math.min(6, draft.browOffsetY))
          : 0,
      browTiltDeg:
        typeof draft.browTiltDeg === 'number' && Number.isFinite(draft.browTiltDeg)
          ? Math.max(-10, Math.min(12, draft.browTiltDeg))
          : 0,
      noseStyleId: draft.noseStyleId ?? 'face_nose_default',
      headScale:
        typeof draft.headScale === 'number' && Number.isFinite(draft.headScale)
          ? Math.max(0.78, Math.min(1.06, draft.headScale))
          : 1.0,
    },
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
    hideOuterClothes: Boolean(draft.hideOuterForUnderwear),
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
