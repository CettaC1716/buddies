/**
 * Unified Asset Preloader & Progress Calculator for Buddies Blitz
 * Coordinates:
 * 1. 3D `.glb` models, `.ktx2` textures, and track JSON via `THREE.LoadingManager` + `Promise.all`
 * 2. All UI / Tactical Kiosk / Merchant Catalog / Profile thumbnail images via `new Image()` + `img.decode()`
 * 3. All SFX & BGM `.mp3` audio files via `Promise.all`
 * 4. Three.js `renderer.compile(scene, camera)` + 1 warm-up frame render gate
 */

export const CRITICAL_UI_IMAGE_URLS: readonly string[] = [
  '/assets/kiosk/af9_plane.png',
  '/assets/kiosk/ar99_rifle.png',
  '/assets/kiosk/cb24_cluster.png',
  '/assets/kiosk/hg04_grenade.png',
  '/assets/kiosk/hq_super_command.png',
  '/assets/kiosk/hq_tactical_comms.png',
  '/assets/kiosk/ht88_dump_truck.png',
  '/assets/kiosk/lg88_laser_rifle.png',
  '/assets/kiosk/nuclear_launcher.png',
  '/assets/kiosk/p12_handgun.png',
  '/assets/kiosk/radar_arena_map.png',
  '/assets/kiosk/skyshield_turret.png',
  '/assets/kiosk/st01_minitank.png',
  '/assets/kiosk/family_member_female.jpg',
  '/assets/kiosk/family_member_male.jpg',
  '/assets/kiosk/private_house_isometric.jpg',
  '/assets/kiosk/titan6_gatling.png',
  '/assets/kiosk/tm89_mine.png',
  '/assets/kiosk/vx20_bazooka.png',
  '/assets/avatar_hiro.jpg',
  '/assets/avatar_nadia.jpg',
  '/docs/hero-1-beach-pier.jpg',
  '/docs/hero-2-tram-station.jpg',
  '/docs/hero-3-house-interior.jpg',
  '/docs/hero-4-hana-exchange.jpg',
  '/docs/hero-6-oasis-lake.jpg',
  '/docs/hero-7-crate-stacking-pad.jpg',
  '/docs/hero-8-weapon-armory.jpg',
];

export const CRITICAL_3D_ASSET_COUNT = 40;
export const CRITICAL_AUDIO_ASSET_COUNT = 23;

export interface PreloadProgressInput {
  modelsLoaded: number;
  modelsTotal: number;
  imagesLoaded: number;
  imagesTotal: number;
  audioLoaded: number;
  audioTotal: number;
  sceneWarmupComplete: boolean;
}

export interface PreloadProgressResult {
  percent: number;
  isComplete: boolean;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/**
 * Pure calculation of unified preload percentage (`0` to `100`) and completion state.
 * Guarantees `percent` only reaches `100` and `isComplete` only becomes `true` when:
 * - all 3D models/textures have settled (`modelsLoaded >= modelsTotal`),
 * - all UI/Kiosk/Catalog images have settled and decoded (`imagesLoaded >= imagesTotal`),
 * - all audio assets have settled (`audioLoaded >= audioTotal`), AND
 * - `sceneWarmupComplete === true` (`renderer.compile(scene, camera)` + 1 warm-up frame).
 */
export function computeUnifiedPreloadProgress(
  input: PreloadProgressInput,
): PreloadProgressResult {
  const modelsTotal = Math.max(1, input.modelsTotal);
  const imagesTotal = Math.max(1, input.imagesTotal);
  const audioTotal = Math.max(1, input.audioTotal);

  const modelsRatio = clamp01(input.modelsLoaded / modelsTotal);
  const imagesRatio = clamp01(input.imagesLoaded / imagesTotal);
  const audioRatio = clamp01(input.audioLoaded / audioTotal);

  const allModelsDone = input.modelsLoaded >= modelsTotal;
  const allImagesDone = input.imagesLoaded >= imagesTotal;
  const allAudioDone = input.audioLoaded >= audioTotal;

  const isComplete =
    allModelsDone && allImagesDone && allAudioDone && Boolean(input.sceneWarmupComplete);

  if (isComplete) {
    return { percent: 100, isComplete: true };
  }

  const weighted =
    modelsRatio * 55 +
    imagesRatio * 20 +
    audioRatio * 15 +
    (input.sceneWarmupComplete ? 10 : 0);

  const percent = Math.max(0, Math.min(99, Math.round(weighted)));
  return { percent, isComplete: false };
}

/**
 * Retains decoded `HTMLImageElement` instances in memory so the browser never evicts
 * decoded Kiosk/Catalog bitmap textures before modals are opened.
 */
const preloadedUiImageCache = new Map<string, HTMLImageElement>();
let inFlightUiImagePreloadPromise: Promise<void> | null = null;
let uiImagesPreloadCompleted = false;

/**
 * Preloads and decodes a single UI/Kiosk/Catalog image via `new Image()` + `img.decode()`.
 * Never rejects on missing/corrupt optional thumbnails: logs a warning and resolves `false`.
 */
export async function preloadAndDecodeSingleImage(url: string): Promise<boolean> {
  if (typeof Image === 'undefined') {
    return true;
  }
  const existing = preloadedUiImageCache.get(url);
  if (existing && existing.complete && existing.naturalWidth > 0) {
    return true;
  }

  return new Promise<boolean>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (ok) {
        preloadedUiImageCache.set(url, img);
      }
      resolve(ok);
    };

    img.onload = () => {
      if (typeof img.decode === 'function') {
        img
          .decode()
          .then(() => finish(true))
          .catch(() => finish(true));
      } else {
        finish(true);
      }
    };

    img.onerror = (err) => {
      console.warn(`[PreloadGate] Non-critical UI image failed to load: ${url}`, err);
      finish(false);
    };

    img.src = url;
  });
}

/**
 * Preloads and decodes all critical UI, Kiosk, Catalog, and Avatar images concurrently via `Promise.all`,
 * reporting incremental progress `(loaded, total)`.
 */
export function preloadAllUiAndKioskImages(
  onProgress?: (loaded: number, total: number) => void,
  urls: readonly string[] = CRITICAL_UI_IMAGE_URLS,
): Promise<void> {
  const total = urls.length;
  if (total === 0) {
    onProgress?.(1, 1);
    return Promise.resolve();
  }

  if (uiImagesPreloadCompleted && urls === CRITICAL_UI_IMAGE_URLS) {
    onProgress?.(total, total);
    return Promise.resolve();
  }

  if (urls === CRITICAL_UI_IMAGE_URLS && inFlightUiImagePreloadPromise) {
    return inFlightUiImagePreloadPromise.then(() => {
      onProgress?.(total, total);
    });
  }

  let loaded = 0;
  onProgress?.(0, total);

  const runPromise = Promise.all(
    urls.map((url) =>
      preloadAndDecodeSingleImage(url)
        .catch((err) => {
          console.warn(`[PreloadGate] Unexpected error preloading image ${url}:`, err);
          return false;
        })
        .finally(() => {
          loaded += 1;
          onProgress?.(loaded, total);
        }),
    ),
  )
    .then(() => {
      if (urls === CRITICAL_UI_IMAGE_URLS) {
        uiImagesPreloadCompleted = true;
      }
    })
    .finally(() => {
      if (urls === CRITICAL_UI_IMAGE_URLS) {
        inFlightUiImagePreloadPromise = null;
      }
    });

  if (urls === CRITICAL_UI_IMAGE_URLS) {
    inFlightUiImagePreloadPromise = runPromise;
  }

  return runPromise;
}
