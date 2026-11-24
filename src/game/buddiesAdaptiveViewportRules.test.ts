import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAdaptiveViewport,
  computeAdaptiveWorldCameraFov,
  computeWardrobeStudioLayout,
} from './buddiesAdaptiveViewportRules';

test('classifyAdaptiveViewport accurately classifies Desktop, Tablet, and Phone viewports', () => {
  const desktop = classifyAdaptiveViewport(1440, 900, false);
  assert.equal(desktop.device, 'desktop');
  assert.equal(desktop.orientation, 'landscape');
  assert.equal(desktop.hudDensity, 'full');
  assert.equal(desktop.showTouchControls, false);

  const tabletLandscape = classifyAdaptiveViewport(1024, 768, true);
  assert.equal(tabletLandscape.device, 'tablet');
  assert.equal(tabletLandscape.isTabletLandscape, true);
  assert.equal(tabletLandscape.hudDensity, 'medium');
  assert.equal(tabletLandscape.showTouchControls, true);

  const tabletPortrait = classifyAdaptiveViewport(768, 1024, true);
  assert.equal(tabletPortrait.device, 'tablet');
  assert.equal(tabletPortrait.isTabletPortrait, true);
  assert.equal(tabletPortrait.isPortrait, true);

  const phonePortrait = classifyAdaptiveViewport(390, 844, true);
  assert.equal(phonePortrait.device, 'phone');
  assert.equal(phonePortrait.isPhonePortrait, true);
  assert.equal(phonePortrait.hudDensity, 'compact');
  assert.equal(phonePortrait.showTouchControls, true);

  const phoneLandscape = classifyAdaptiveViewport(844, 390, true);
  assert.equal(phoneLandscape.device, 'phone');
  assert.equal(phoneLandscape.isPhoneLandscape, true);
  assert.equal(phoneLandscape.isCompactHeight, true);
  assert.equal(phoneLandscape.hudDensity, 'compact');
});

test('computeWardrobeStudioLayout adapts split panel, portrait sheet, and 3D camera view offsets', () => {
  const desktop = computeWardrobeStudioLayout(classifyAdaptiveViewport(1440, 900, false));
  assert.equal(desktop.mode, 'desktop_split');
  assert.equal(desktop.panelWidthPx, 420);
  assert.equal(desktop.isPortraitSheet, false);
  assert.ok(desktop.cameraShiftRightPx > 150);
  assert.equal(desktop.cameraShiftDownPx, 0);

  const tabletLandscape = computeWardrobeStudioLayout(classifyAdaptiveViewport(1024, 768, true));
  assert.equal(tabletLandscape.mode, 'tablet_split');
  assert.equal(tabletLandscape.isPortraitSheet, false);
  assert.ok(tabletLandscape.panelWidthPx >= 336 && tabletLandscape.panelWidthPx <= 380);
  assert.ok(tabletLandscape.cameraShiftRightPx > 120);

  const phonePortrait = computeWardrobeStudioLayout(classifyAdaptiveViewport(390, 844, true), false);
  assert.equal(phonePortrait.mode, 'portrait_sheet');
  assert.equal(phonePortrait.isPortraitSheet, true);
  assert.equal(phonePortrait.useHorizontalCategoryStrip, true);
  assert.equal(phonePortrait.gridCols, 3);
  assert.equal(phonePortrait.cameraShiftRightPx, 0);
  assert.ok(phonePortrait.cameraShiftDownPx >= 95 && phonePortrait.cameraShiftDownPx <= 140);

  const phonePortraitCollapsed = computeWardrobeStudioLayout(
    classifyAdaptiveViewport(390, 844, true),
    true,
  );
  assert.equal(phonePortraitCollapsed.cameraShiftDownPx, 0);
  assert.equal(phonePortraitCollapsed.cameraFovDelta, 0);

  const tabletPortrait = computeWardrobeStudioLayout(classifyAdaptiveViewport(768, 1024, true), false);
  assert.equal(tabletPortrait.mode, 'portrait_sheet');
  assert.equal(tabletPortrait.gridCols, 4);

  const phoneLandscape = computeWardrobeStudioLayout(classifyAdaptiveViewport(844, 390, true));
  assert.equal(phoneLandscape.mode, 'phone_landscape_split');
  assert.equal(phoneLandscape.isCompactTopBar, true);
  assert.ok(phoneLandscape.panelWidthPx <= 332);
  assert.ok(phoneLandscape.cameraShiftRightPx > 120);
});

test('computeAdaptiveWorldCameraFov preserves landscape FOV and gently widens portrait FOV', () => {
  assert.equal(computeAdaptiveWorldCameraFov(45, 16 / 9), 45);
  assert.equal(computeAdaptiveWorldCameraFov(45, 1.0), 45);

  const tabletPortraitFov = computeAdaptiveWorldCameraFov(45, 768 / 1024);
  assert.ok(tabletPortraitFov > 49 && tabletPortraitFov < 53);

  const phonePortraitFov = computeAdaptiveWorldCameraFov(45, 390 / 844);
  assert.ok(phonePortraitFov > 55 && phonePortraitFov <= 59);
});
