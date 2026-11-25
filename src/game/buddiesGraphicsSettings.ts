import type { AdaptiveShadowMapRes } from './buddiesPerfOptimizations';

export type GraphicsQualityPreset = 'low' | 'balanced' | 'high' | 'adaptive';

export interface GraphicsQualityOption {
  id: GraphicsQualityPreset;
  label: string;
  description: string;
}

export const GRAPHICS_QUALITY_OPTIONS: ReadonlyArray<GraphicsQualityOption> = [
  {
    id: 'low',
    label: 'Low',
    description: 'Lighter visuals and shadows off for steady speed.',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Standard sharpness and medium shadows.',
  },
  {
    id: 'high',
    label: 'High',
    description: 'Sharpest visuals and full shadows.',
  },
  {
    id: 'adaptive',
    label: 'Adaptive',
    description: 'Automatically adjusts quality to keep gameplay smooth.',
  },
] as const;

export const DEFAULT_GRAPHICS_QUALITY: GraphicsQualityPreset = 'adaptive';
export const GRAPHICS_QUALITY_STORAGE_KEY = 'bb_graphics_quality_v1';
export const GRAPHICS_QUALITY_CHANGED_EVENT = 'bb-graphics-quality-changed';

const VALID_GRAPHICS_PRESETS = new Set<string>(
  GRAPHICS_QUALITY_OPTIONS.map((option) => option.id),
);

export function isGraphicsQualityPreset(value: unknown): value is GraphicsQualityPreset {
  return typeof value === 'string' && VALID_GRAPHICS_PRESETS.has(value);
}

export function sanitizeGraphicsQualityPreset(value: unknown): GraphicsQualityPreset {
  return isGraphicsQualityPreset(value) ? value : DEFAULT_GRAPHICS_QUALITY;
}

export interface ResolvedGraphicsQualityProfile {
  preset: GraphicsQualityPreset;
  isAdaptive: boolean;
  dprCap: number;
  /** Non-null for manual presets (Low/Balanced/High); null when Adaptive owns DPR scaling. */
  fixedDpr: number | null;
  shadowsEnabled: boolean;
  shadowMapRes: AdaptiveShadowMapRes;
  foliageShadowsEnabled: boolean;
  hudBackdropBlurEnabled: boolean;
}

/**
 * Resolves a GraphicsQualityPreset into concrete WebGL renderer settings.
 * Manual presets (low, balanced, high) return `isAdaptive: false` and a fixed DPR
 * so the render loop never raises or lowers quality on its own.
 */
export function resolveGraphicsQualityProfile(
  preset: GraphicsQualityPreset,
  devicePixelRatio: number,
  isSoftwareGl: boolean,
): ResolvedGraphicsQualityProfile {
  const safeDpr =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;

  switch (preset) {
    case 'low': {
      const dprCap = 0.85;
      const fixedDpr = Math.min(safeDpr, dprCap);
      return {
        preset: 'low',
        isAdaptive: false,
        dprCap,
        fixedDpr,
        shadowsEnabled: false,
        shadowMapRes: 1024,
        foliageShadowsEnabled: false,
        hudBackdropBlurEnabled: false,
      };
    }
    case 'balanced': {
      const dprCap = 1.0;
      const fixedDpr = Math.min(safeDpr, dprCap);
      return {
        preset: 'balanced',
        isAdaptive: false,
        dprCap,
        fixedDpr,
        shadowsEnabled: !isSoftwareGl,
        shadowMapRes: 1024,
        foliageShadowsEnabled: false,
        hudBackdropBlurEnabled: false,
      };
    }
    case 'high': {
      const dprCap = isSoftwareGl ? 1.0 : 1.5;
      const fixedDpr = Math.min(safeDpr, dprCap);
      return {
        preset: 'high',
        isAdaptive: false,
        dprCap,
        fixedDpr,
        shadowsEnabled: !isSoftwareGl,
        shadowMapRes: isSoftwareGl ? 1024 : 1536,
        foliageShadowsEnabled: false,
        hudBackdropBlurEnabled: !isSoftwareGl,
      };
    }
    case 'adaptive':
    default: {
      const dprCap = isSoftwareGl ? 1.0 : Math.min(safeDpr, 1.25);
      return {
        preset: 'adaptive',
        isAdaptive: true,
        dprCap,
        fixedDpr: null,
        shadowsEnabled: !isSoftwareGl,
        shadowMapRes: 1024,
        foliageShadowsEnabled: false,
        hudBackdropBlurEnabled: false,
      };
    }
  }
}

export function shouldRunAdaptiveQualityControls(preset: GraphicsQualityPreset): boolean {
  return preset === 'adaptive';
}

export function readStoredGraphicsQuality(
  storage?: Pick<Storage, 'getItem'> | null,
): GraphicsQualityPreset {
  const targetStorage =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;
  if (!targetStorage) return DEFAULT_GRAPHICS_QUALITY;
  try {
    return sanitizeGraphicsQualityPreset(targetStorage.getItem(GRAPHICS_QUALITY_STORAGE_KEY));
  } catch {
    return DEFAULT_GRAPHICS_QUALITY;
  }
}

export function writeStoredGraphicsQuality(
  preset: GraphicsQualityPreset,
  storage?: Pick<Storage, 'setItem'> | null,
): GraphicsQualityPreset {
  const clean = sanitizeGraphicsQualityPreset(preset);
  const targetStorage =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;
  if (targetStorage) {
    try {
      targetStorage.setItem(GRAPHICS_QUALITY_STORAGE_KEY, clean);
    } catch {
      // ignore storage errors
    }
  }
  return clean;
}
