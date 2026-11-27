import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Public path of the owner-supplied Glass Modern house scene GLB. */
export const GLASS_MODERN_HOUSE_GLB_PATH = '/assets/houses/glass_modern_house.glb';

/**
 * Vertical stretch factor applied around `y = 0` to the apartment's architectural
 * shell (walls, glass facades, mullions, beams, door casings, ceilings, roofs,
 * and their wall/partition colliders) so the ceiling height feels more open and
 * spacious (~3.53m..3.71m clear soffit instead of ~2.85m..2.99m) while keeping
 * floors, kitchen joinery, furniture, courtyard perimeter walls, and yard trees
 * at 100% natural scale.
 */
export const HOUSE_SHELL_HEIGHT_SCALE = 1.24;

/**
 * Mount offset (room-local metres) applied to the GLB scene so the model's
 * house floor block (`Col_Floor_House`, GLB centre (1.10, -3.70), size
 * 10.60 x 7.40) lands exactly on the shared cutaway room frame
 * (x -5.3..5.3, z -3.7..3.7, floor top at y 0). The entrance porch then sits
 * at room z ~ +3.7..4.4 and the courtyard garden surrounds the apartment
 * within x -8.67..8.67, z -6.87..7.47.
 */
export const GLASS_MODERN_HOUSE_MOUNT_OFFSET = { x: -1.1, y: 0, z: 3.7 } as const;

const HOUSE_SHELL_STRETCH_PREFIXES = [
  'Wall_',
  'Part_',
  'Glass_',
  'Mullion_',
  'Post_',
  'Beam_',
  'Brow_',
  'Ceiling_',
  'Roof_',
  'DoorCasing_',
  'MainDoor_',
  'MainSlide_',
  'BedSlide_',
  'BathWin_',
  'KitchenWin_',
  'East_Timber_Battens',
  'Col_Wall_',
  'Col_Part_',
  'Col_MainSlide_',
  'Col_BedSlide_',
] as const;

/**
 * Returns true if a GLB node belongs to the apartment's vertical architectural
 * shell and should be stretched by `HOUSE_SHELL_HEIGHT_SCALE` around `y = 0`.
 */
export function isHouseShellHeightScaledNodeName(name: string): boolean {
  if (!name) return false;
  for (let i = 0; i < HOUSE_SHELL_STRETCH_PREFIXES.length; i++) {
    if (name.startsWith(HOUSE_SHELL_STRETCH_PREFIXES[i])) return true;
  }
  return false;
}

const HOUSE_CAMERA_COLLIDER_PREFIXES = [
  'Col_Wall_',
  'Col_Part_',
  'Col_Courtyard_',
  'Col_MainSlide_',
  'Col_BedSlide_',
] as const;

const HOUSE_CAMERA_ROOF_NODE_NAMES = new Set([
  'Roof_Main_Slate',
  'Roof_East_Ceiling',
  'Roof_East_Cap',
  'Ceiling_Main_OakSoffit',
]);

/** Returns true if a GLB node contributes a solid wall/roof obstruction box for the 3rd-person camera. */
export function isHouseCameraObstructionNodeName(name: string): boolean {
  if (!name) return false;
  if (HOUSE_CAMERA_ROOF_NODE_NAMES.has(name)) return true;
  for (let i = 0; i < HOUSE_CAMERA_COLLIDER_PREFIXES.length; i++) {
    if (name.startsWith(HOUSE_CAMERA_COLLIDER_PREFIXES[i])) return true;
  }
  return false;
}

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
  /** Bottom Y in room-local coordinates. */
  minY?: number;
  /** Top Y in room-local coordinates. */
  maxY?: number;
}

/** Room-local 3D AABB used by the anti-wall-clipping camera solver. */
export interface HouseCameraObstructionBox {
  name: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
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
  /**
   * Live list of room-local 3D wall/partition/courtyard/roof boxes used by the
   * `house_visit` camera obstruction solver. Populated in place on GLB load.
   */
  cameraColliders: HouseCameraObstructionBox[];
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
 * - apartment shell nodes (walls, glass, mullions, beams, doors, ceiling, roof)
 *   are vertically stretched around `y = 0` by `HOUSE_SHELL_HEIGHT_SCALE` so
 *   the apartment roof is taller and more open without distorting furniture or
 *   the outdoor garden;
 * - every `Col_*` mesh is hidden and its room-local AABB is reported as
 *   collision data (and solid walls/courtyard/roofs populate `cameraColliders`
 *   for strict anti-wall-clipping camera containment);
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
  const cameraColliders: HouseCameraObstructionBox[] = [];
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

        const backdrop = gltf.scene.getObjectByName('Backdrop_GoldenHour_SkyDome');
        if (backdrop && backdrop.parent) {
          backdrop.parent.remove(backdrop);
        }

        // First pass: raise the apartment architectural shell around y = 0 so
        // ceilings, beams, walls, glass mullions, and door headers lift
        // cleanly together with zero gaps before extracting world AABBs.
        gltf.scene.traverse((obj) => {
          if (isHouseShellHeightScaledNodeName(obj.name)) {
            obj.position.y *= HOUSE_SHELL_HEIGHT_SCALE;
            obj.scale.y *= HOUSE_SHELL_HEIGHT_SCALE;
          }
        });
        root.updateWorldMatrix(true, true);

        const parentOffsetY = root.parent ? root.parent.position.y : 0;
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
                const minY = box.min.y - parentOffsetY;
                const maxY = box.max.y - parentOffsetY;
                colliders.push({
                  name: obj.name,
                  x: (box.min.x + box.max.x) / 2,
                  z: (box.min.z + box.max.z) / 2,
                  hw: Math.max(0.01, (box.max.x - box.min.x) / 2),
                  hd: Math.max(0.01, (box.max.z - box.min.z) / 2),
                  minY,
                  maxY,
                });
                if (isHouseCameraObstructionNodeName(obj.name)) {
                  cameraColliders.push({
                    name: obj.name,
                    minX: box.min.x,
                    maxX: box.max.x,
                    minY,
                    maxY,
                    minZ: box.min.z,
                    maxZ: box.max.z,
                  });
                }
              }
            } else if (isHouseCameraObstructionNodeName(obj.name)) {
              box.setFromObject(obj);
              if (!box.isEmpty()) {
                cameraColliders.push({
                  name: obj.name,
                  minX: box.min.x,
                  maxX: box.max.x,
                  minY: box.min.y - parentOffsetY,
                  maxY: box.max.y - parentOffsetY,
                  minZ: box.min.z,
                  maxZ: box.max.z,
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
    cameraColliders,
    setRoofCeilingVisible,
    isRoofCeilingVisible: () => roofCeilingVisible,
    dispose,
  };
}
