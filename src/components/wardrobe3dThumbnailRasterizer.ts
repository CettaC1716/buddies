import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  loadModularApparelGltf,
  parseModularAssetSlotFragment,
} from '../game/buddiesBlitzShadersAndAssets';
import { classifyDefaultAvatarSlotFromMeshName } from '../game/buddiesWardrobeStudioRules';

const thumbnailCache = new Map<string, string>();
const inFlightRequests = new Map<string, Promise<string | null>>();

let sharedRenderer: THREE.WebGLRenderer | null = null;
let sharedScene: THREE.Scene | null = null;
let sharedCamera: THREE.PerspectiveCamera | null = null;
let idleDisposeTimer: number | null = null;

function scheduleIdleDispose(): void {
  if (typeof window === 'undefined') return;
  if (idleDisposeTimer !== null) {
    window.clearTimeout(idleDisposeTimer);
  }
  idleDisposeTimer = window.setTimeout(() => {
    idleDisposeTimer = null;
    if (sharedRenderer) {
      sharedRenderer.dispose();
      sharedRenderer = null;
    }
    sharedScene = null;
    sharedCamera = null;
  }, 15000);
}

function getOrCreateThumbRenderer(): {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
} | null {
  if (typeof document === 'undefined') return null;
  if (sharedRenderer && sharedScene && sharedCamera) {
    scheduleIdleDispose();
    return { renderer: sharedRenderer, scene: sharedScene, camera: sharedCamera };
  }
  try {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(1);
    renderer.setSize(160, 160, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    const hemi = new THREE.HemisphereLight('#fff8f0', '#3b3248', 1.35);
    scene.add(hemi);
    const key = new THREE.DirectionalLight('#fff4e6', 1.8);
    key.position.set(1.8, 2.6, 2.5);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#c4b5fd', 0.9);
    rim.position.set(-2.0, 1.5, -1.8);
    scene.add(rim);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 25);

    sharedRenderer = renderer;
    sharedScene = scene;
    sharedCamera = camera;
    scheduleIdleDispose();
    return { renderer, scene, camera };
  } catch {
    return null;
  }
}

export function getCachedWardrobeItemThumbnail(glbPath: string | null): string | null {
  if (!glbPath) return null;
  return thumbnailCache.get(glbPath) ?? null;
}

/**
 * Renders a crisp 160x160 transparent 3D preview of a modular apparel GLB (or a `#slot=...`
 * extracted piece from a full Blitz NPC avatar GLB) once using a pooled offscreen WebGLRenderer.
 */
export async function renderWardrobeItemThumbnail(
  glbPath: string | null,
): Promise<string | null> {
  if (!glbPath) return null;
  const cached = thumbnailCache.get(glbPath);
  if (cached) return cached;

  const existing = inFlightRequests.get(glbPath);
  if (existing) return existing;

  const task = (async (): Promise<string | null> => {
    try {
      const gltf = await loadModularApparelGltf(glbPath);
      if (!gltf?.scene) return null;
      const ctx = getOrCreateThumbRenderer();
      if (!ctx) return null;

      const slotFilter = parseModularAssetSlotFragment(glbPath);
      const holder = new THREE.Group();
      const cloned = SkeletonUtils.clone(gltf.scene) as THREE.Group;
      const clonedGeos: THREE.BufferGeometry[] = [];
      const visibleMeshes: THREE.Mesh[] = [];

      cloned.traverse((node) => {
        if ((node as THREE.Mesh).isMesh) {
          const m = node as THREE.Mesh;
          const lower = (m.name || '').toLowerCase();
          if (
            lower.includes('outline') ||
            lower.includes('_skin') ||
            lower.includes('basedoll') ||
            lower.startsWith('head_') ||
            lower.startsWith('ears_')
          ) {
            m.visible = false;
            return;
          }
          if (slotFilter) {
            const meshSlot = classifyDefaultAvatarSlotFromMeshName(m.name);
            const keep =
              slotFilter === 'costume'
                ? meshSlot === 'torso' ||
                  meshSlot === 'legs' ||
                  meshSlot === 'feet' ||
                  meshSlot === 'hands' ||
                  meshSlot === 'neck'
                : meshSlot === slotFilter;
            if (!keep) {
              m.visible = false;
              return;
            }
          }
          if (m.geometry) {
            m.geometry = m.geometry.clone();
            clonedGeos.push(m.geometry);
          }
          m.visible = true;
          m.frustumCulled = false;
          visibleMeshes.push(m);
        }
      });

      if (visibleMeshes.length === 0) {
        return null;
      }

      holder.add(cloned);
      cloned.updateMatrixWorld(true);
      const box = new THREE.Box3();
      for (const vm of visibleMeshes) {
        box.expandByObject(vm);
      }
      if (!box.isEmpty()) {
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        const maxDim = Math.max(size.x, size.y, size.z, 0.08);
        const scale = 1.05 / maxDim;
        cloned.scale.setScalar(scale);
        cloned.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
      }
      holder.rotation.y = 0.28;

      ctx.scene.add(holder);
      ctx.camera.position.set(0, 0.08, 2.35);
      ctx.camera.lookAt(0, 0, 0);
      ctx.renderer.setClearColor(0x000000, 0);
      ctx.renderer.clear();
      ctx.renderer.render(ctx.scene, ctx.camera);

      const dataUrl = ctx.renderer.domElement.toDataURL('image/png');
      ctx.scene.remove(holder);
      for (const g of clonedGeos) {
        g.dispose();
      }
      if (dataUrl && dataUrl.startsWith('data:image/png')) {
        thumbnailCache.set(glbPath, dataUrl);
        return dataUrl;
      }
      return null;
    } catch {
      return null;
    } finally {
      inFlightRequests.delete(glbPath);
    }
  })();

  inFlightRequests.set(glbPath, task);
  return task;
}
