import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Public path of the owner-supplied Glass Modern house scene GLB. */
export const GLASS_MODERN_HOUSE_GLB_PATH = '/assets/houses/glass_modern_house.glb';

/**
 * Mount offset (room-local metres) applied to the GLB scene so the model's
 * house floor block (`Col_Floor_House`, GLB centre (1.10, -3.70), size
 * 10.60 x 7.40) lands exactly on the shared cutaway room frame
 * (x -5.3..5.3, z -3.7..3.7, floor top at y 0). The entrance porch then sits
 * at room z ~ +3.6..4.0 beside the exit pad, and the north deck / zen garden
 * extend beyond the room's north edge as the house's outdoor backdrop.
 */
export const GLASS_MODERN_HOUSE_MOUNT_OFFSET = { x: -1.1, y: 0, z: 3.7 } as const;

/** Room-local axis-aligned footprint of one hidden `Col_*` collider mesh. */
export interface HouseSceneColliderAabb {
  name: string;
  /** Centre X in room-local coordinates. */
  x: number;
  /** Centre Z in room-local coordinates. */
  z: number;
  /** Half extent along X. */
  hw: number;
  /** Half extent along Z. */
  hd: number;
}

export interface GlassModernHouseSceneHandle {
  /** Group to add under `houseInteriorRoomGrp`; carries the mount offset. */
  root: THREE.Group;
  /**
   * Live list of room-local collider footprints collected from the GLB's
   * `Col_*` meshes. Empty until the async load completes; mutated in place
   * so frame loops can read it every frame without re-querying.
   */
  colliders: HouseSceneColliderAabb[];
  /** Shows/hides the tagged `Roof_*` / `Ceiling_*` nodes (visit vs studio). */
  setRoofCeilingVisible: (visible: boolean) => void;
  isRoofCeilingVisible: () => boolean;
  dispose: () => void;
}

/**
 * Mounts the Glass Modern house GLB as the private-house interior scene.
 *
 * Follows the salon interior precedent (buddiesBeautySalonInteriorBuilder):
 * the model is loaded as-is behind a `window` guard (skipped under
 * node/tests), and every rule that depends on the room (spawn, exit,
 * furniture placement) keeps working from the shared room frame even if the
 * model fails to load.
 *
 * On load:
 * - the model's own `Backdrop_GoldenHour_SkyDome` is removed (the room
 *   already carries a radius-52 studio dome);
 * - every `Col_*` mesh is hidden and its room-local AABB is reported as
 *   collision data (the Arena consumes the wall/partition subset for
 *   walk-in collision);
 * - `Roof_*` / `Ceiling_*` nodes are tagged so the Arena can hide them in
 *   the top-down studio mode and show them in walk-in visit mode.
 */
export function buildGlassModernHouseScene(
  onCollidersReady?: (colliders: HouseSceneColliderAabb[]) => void,
): GlassModernHouseSceneHandle {
  const root = new THREE.Group();
  root.name = 'GlassModernHouseScene3D';
  root.position.set(
    GLASS_MODERN_HOUSE_MOUNT_OFFSET.x,
    GLASS_MODERN_HOUSE_MOUNT_OFFSET.y,
    GLASS_MODERN_HOUSE_MOUNT_OFFSET.z,
  );

  const colliders: HouseSceneColliderAabb[] = [];
  const roofCeilingNodes: THREE.Object3D[] = [];
  let roofCeilingVisible = false;

  const setRoofCeilingVisible = (visible: boolean) => {
    roofCeilingVisible = visible;
    for (const node of roofCeilingNodes) {
      node.visible = visible;
    }
  };

  if (typeof window !== 'undefined') {
    new GLTFLoader().load(
      GLASS_MODERN_HOUSE_GLB_PATH,
      (gltf) => {
        if (!root.parent) return; // room was torn down meanwhile
        root.add(gltf.scene);
        root.updateWorldMatrix(true, true);

        const backdrop = gltf.scene.getObjectByName('Backdrop_GoldenHour_SkyDome');
        if (backdrop && backdrop.parent) {
          backdrop.parent.remove(backdrop);
        }

        const box = new THREE.Box3();
        gltf.scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) {
            // The shell is decorative: pointer picking in the room works on
            // mathematical planes and the furniture container, never on it.
            mesh.raycast = () => {};
            if (obj.name.startsWith('Col_')) {
              obj.visible = false;
              box.setFromObject(obj);
              if (!box.isEmpty()) {
                colliders.push({
                  name: obj.name,
                  x: (box.min.x + box.max.x) / 2,
                  z: (box.min.z + box.max.z) / 2,
                  hw: Math.max(0.01, (box.max.x - box.min.x) / 2),
                  hd: Math.max(0.01, (box.max.z - box.min.z) / 2),
                });
              }
            }
          }
          if (obj.name.startsWith('Roof_') || obj.name.startsWith('Ceiling_')) {
            roofCeilingNodes.push(obj);
            obj.visible = roofCeilingVisible;
          }
        });
        onCollidersReady?.(colliders);
      },
      undefined,
      () => {
        // Model failed to load: the room keeps its plinth, dome, furniture
        // and every interaction rule; only the shell visual is missing.
      },
    );
  }

  const dispose = () => {
    const disposedGeos = new Set<THREE.BufferGeometry>();
    const disposedMats = new Set<THREE.Material>();
    root.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry && !disposedGeos.has(m.geometry)) {
        disposedGeos.add(m.geometry);
        m.geometry.dispose();
      }
      if (m.material) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          if (!disposedMats.has(mat)) {
            disposedMats.add(mat);
            mat.dispose();
          }
        }
      }
    });
  };

  return {
    root,
    colliders,
    setRoofCeilingVisible,
    isRoofCeilingVisible: () => roofCeilingVisible,
    dispose,
  };
}
