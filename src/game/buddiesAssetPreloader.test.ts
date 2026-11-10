import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CRITICAL_3D_ASSET_COUNT,
  CRITICAL_AUDIO_ASSET_COUNT,
  CRITICAL_UI_IMAGE_URLS,
  computeUnifiedPreloadProgress,
  preloadAllUiAndKioskImages,
} from './buddiesAssetPreloader';

test('computeUnifiedPreloadProgress starts at 0% and caps at 99% until all assets AND sceneWarmupComplete are true', () => {
  const start = computeUnifiedPreloadProgress({
    modelsLoaded: 0,
    modelsTotal: CRITICAL_3D_ASSET_COUNT,
    imagesLoaded: 0,
    imagesTotal: CRITICAL_UI_IMAGE_URLS.length,
    audioLoaded: 0,
    audioTotal: CRITICAL_AUDIO_ASSET_COUNT,
    sceneWarmupComplete: false,
  });
  assert.equal(start.percent, 0);
  assert.equal(start.isComplete, false);

  const mid = computeUnifiedPreloadProgress({
    modelsLoaded: 20,
    modelsTotal: 40,
    imagesLoaded: 11,
    imagesTotal: 22,
    audioLoaded: 23,
    audioTotal: 23,
    sceneWarmupComplete: false,
  });
  assert.equal(mid.percent, 53);
  assert.equal(mid.isComplete, false);

  // All files downloaded, waiting on renderer.compile(scene, camera) + warm-up frame
  const waitingOnWarmup = computeUnifiedPreloadProgress({
    modelsLoaded: 40,
    modelsTotal: 40,
    imagesLoaded: 22,
    imagesTotal: 22,
    audioLoaded: 23,
    audioTotal: 23,
    sceneWarmupComplete: false,
  });
  assert.equal(waitingOnWarmup.percent, 90);
  assert.equal(waitingOnWarmup.isComplete, false);

  // Warmup done, but 1 image still decoding -> must not report 100% or isComplete
  const waitingOnOneImage = computeUnifiedPreloadProgress({
    modelsLoaded: 40,
    modelsTotal: 40,
    imagesLoaded: 21,
    imagesTotal: 22,
    audioLoaded: 23,
    audioTotal: 23,
    sceneWarmupComplete: true,
  });
  assert.equal(waitingOnOneImage.percent, 99);
  assert.equal(waitingOnOneImage.isComplete, false);

  // Everything 100% loaded and warm-up frame rendered
  const complete = computeUnifiedPreloadProgress({
    modelsLoaded: 40,
    modelsTotal: 40,
    imagesLoaded: 22,
    imagesTotal: 22,
    audioLoaded: 23,
    audioTotal: 23,
    sceneWarmupComplete: true,
  });
  assert.equal(complete.percent, 100);
  assert.equal(complete.isComplete, true);
});

test('preloadAllUiAndKioskImages advances progress through 100% even in headless/Node environments', async () => {
  const steps: Array<[number, number]> = [];
  await preloadAllUiAndKioskImages(
    (loaded, total) => {
      steps.push([loaded, total]);
    },
    ['/assets/kiosk/ar99_rifle.png', '/assets/kiosk/missing_optional.png'],
  );
  assert.equal(steps[0][0], 0);
  assert.equal(steps[steps.length - 1][0], 2);
  assert.equal(steps[steps.length - 1][1], 2);
});
