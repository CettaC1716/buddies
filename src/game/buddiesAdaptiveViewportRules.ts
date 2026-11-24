export type AdaptiveDeviceClass = 'phone' | 'tablet' | 'desktop';
export type AdaptiveOrientation = 'portrait' | 'landscape';
export type AdaptiveHudDensity = 'compact' | 'medium' | 'full';

export type WardrobeStudioLayoutMode =
  | 'desktop_split'
  | 'tablet_split'
  | 'phone_landscape_split'
  | 'portrait_sheet';

export interface AdaptiveViewportInfo {
  width: number;
  height: number;
  aspect: number;
  device: AdaptiveDeviceClass;
  orientation: AdaptiveOrientation;
  hasTouch: boolean;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
  isPhonePortrait: boolean;
  isPhoneLandscape: boolean;
  isTabletPortrait: boolean;
  isTabletLandscape: boolean;
  isCompactHeight: boolean;
  hudDensity: AdaptiveHudDensity;
  showTouchControls: boolean;
}

export interface WardrobeStudioAdaptiveLayout {
  mode: WardrobeStudioLayoutMode;
  isPortraitSheet: boolean;
  isCompactTopBar: boolean;
  panelWidthPx: number;
  cameraShiftRightPx: number;
  cameraShiftDownPx: number;
  cameraFovDelta: number;
  useHorizontalCategoryStrip: boolean;
  gridCols: 3 | 4;
}

export function classifyAdaptiveViewport(
  rawWidth: number,
  rawHeight: number,
  hasTouch = false,
): AdaptiveViewportInfo {
  const width = Math.max(320, Math.round(Number.isFinite(rawWidth) ? rawWidth : 1280));
  const height = Math.max(240, Math.round(Number.isFinite(rawHeight) ? rawHeight : 720));
  const aspect = width / height;
  const orientation: AdaptiveOrientation = height > width ? 'portrait' : 'landscape';
  const isPortrait = orientation === 'portrait';
  const isLandscape = !isPortrait;
  const minDim = Math.min(width, height);
  const maxDim = Math.max(width, height);

  // Phone: short edge < 600px (covers all iPhones & Android phones in both portrait & landscape)
  // Tablet: short edge >= 600px AND either width < 1024, portrait, or touch device <= 1366px
  // Desktop: larger landscape non-touch screens (or > 1366px wide)
  let device: AdaptiveDeviceClass;
  if (minDim < 600) {
    device = 'phone';
  } else if (
    width < 1024 ||
    isPortrait ||
    (hasTouch && maxDim <= 1366)
  ) {
    device = 'tablet';
  } else {
    device = 'desktop';
  }

  const isPhone = device === 'phone';
  const isTablet = device === 'tablet';
  const isDesktop = device === 'desktop';
  const isCompactHeight = height < 540;
  const isPhonePortrait = isPhone && isPortrait;
  const isPhoneLandscape = isPhone && isLandscape;
  const isTabletPortrait = isTablet && isPortrait;
  const isTabletLandscape = isTablet && isLandscape;

  const hudDensity: AdaptiveHudDensity =
    isPhone || isCompactHeight
      ? 'compact'
      : isTablet || width < 1180
        ? 'medium'
        : 'full';

  const showTouchControls = Boolean(hasTouch || isPhone || isTablet || width < 1024);

  return {
    width,
    height,
    aspect,
    device,
    orientation,
    hasTouch,
    isPhone,
    isTablet,
    isDesktop,
    isPortrait,
    isLandscape,
    isPhonePortrait,
    isPhoneLandscape,
    isTabletPortrait,
    isTabletLandscape,
    isCompactHeight,
    hudDensity,
    showTouchControls,
  };
}

/**
 * Computes responsive layout geometry and 3D camera frustum offsets for WardrobeStudioModal
 * across Desktop, Tablet (Landscape & Portrait), and Phone (Landscape & Portrait).
 */
export function computeWardrobeStudioLayout(
  viewport: AdaptiveViewportInfo,
  isSheetCollapsed = false,
): WardrobeStudioAdaptiveLayout {
  const { width, height, isPortrait, isCompactHeight, isPhone } = viewport;

  // Portrait phones & portrait tablets (< 1024px wide):
  // Split vertically: top half unobstructed 3D avatar preview, bottom half smoked-glass drawer sheet.
  if (isPortrait && width < 1024) {
    // Positive setViewOffset Y shifts the frustum down, framing the avatar cleanly below the top toolbar
    // and well above the bottom drawer sheet without clipping hair/head behind top controls.
    const cameraShiftDownPx = isSheetCollapsed
      ? 0
      : Math.round(height * (isPhone ? 0.135 : 0.125));
    const cameraFovDelta = isSheetCollapsed ? 0 : isPhone ? 8.0 : 6.0;
    return {
      mode: 'portrait_sheet',
      isPortraitSheet: true,
      isCompactTopBar: true,
      panelWidthPx: Math.max(300, width - 16),
      cameraShiftRightPx: 0,
      cameraShiftDownPx,
      cameraFovDelta,
      useHorizontalCategoryStrip: true,
      gridCols: width >= 640 ? 4 : 3,
    };
  }

  // Phone landscape (short viewport height < 540px):
  // Compact right drawer (max 50% width), avatar shifted cleanly into the left open viewport
  if (isCompactHeight || (isPhone && !isPortrait)) {
    const panelWidthPx = Math.max(270, Math.min(332, Math.round(width * 0.48)));
    const cameraShiftRightPx = Math.round((panelWidthPx + 16) * 0.48);
    return {
      mode: 'phone_landscape_split',
      isPortraitSheet: false,
      isCompactTopBar: true,
      panelWidthPx,
      cameraShiftRightPx,
      cameraShiftDownPx: 0,
      cameraFovDelta: 2,
      useHorizontalCategoryStrip: false,
      gridCols: 3,
    };
  }

  // Tablet landscape (768..1099px wide landscape)
  if (width < 1100) {
    const panelWidthPx = Math.max(336, Math.min(380, Math.round(width * 0.39)));
    const cameraShiftRightPx = Math.round((panelWidthPx + 24) * 0.46);
    return {
      mode: 'tablet_split',
      isPortraitSheet: false,
      isCompactTopBar: width < 920,
      panelWidthPx,
      cameraShiftRightPx,
      cameraShiftDownPx: 0,
      cameraFovDelta: 0,
      useHorizontalCategoryStrip: false,
      gridCols: 3,
    };
  }

  // Desktop (>= 1100px wide landscape): exact canonical 420px right glass panel
  const panelWidthPx = 420;
  const cameraShiftRightPx = Math.round(width * 0.145);
  return {
    mode: 'desktop_split',
    isPortraitSheet: false,
    isCompactTopBar: false,
    panelWidthPx,
    cameraShiftRightPx,
    cameraShiftDownPx: 0,
    cameraFovDelta: 0,
    useHorizontalCategoryStrip: false,
    gridCols: 3,
  };
}

/**
 * Gently widens vertical FOV on portrait screens (aspect < 1.0) so narrow phones and
 * portrait tablets preserve horizontal street/avatar visibility without disturbing
 * desktop/landscape framing (aspect >= 1.0 returns baseFov untouched).
 */
export function computeAdaptiveWorldCameraFov(baseFov: number, aspect: number): number {
  if (!Number.isFinite(baseFov) || !Number.isFinite(aspect) || aspect <= 0) {
    return baseFov;
  }
  if (aspect >= 1.0) {
    return baseFov;
  }
  const extraFov = Math.max(0, Math.min(14, (1.0 - aspect) * 24));
  return Number((baseFov + extraFov).toFixed(2));
}
