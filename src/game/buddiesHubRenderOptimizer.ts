import * as THREE from 'three';

/**
 * Pure Three.js render-optimization helpers for the Buddies Blitz social hubs:
 * 1. GPU Instancing batch & union bounding-volume utilities (with paired outline meshes).
 * 2. Safe frustum-culling policy, audit, and SkinnedMesh bone-reach sphere sizing.
 * 3. Environment lighting, indoor/outdoor light isolation, PointLight budgeting,
 *    district chunk-cull radius selection, directional shadow texel snapping, and avatar LOD cadence.
 */

export const LIGHTING_HYGIENE_LIMITS = {
  maxActiveLaserPointLights: 2,
  laserPointLightMaxDistSq: 48 * 48,
  maxHouseInteriorPointLights: 2,
  maxCafeInteriorPointLights: 2,
  defaultShadowMapRes: 1024,
  shadowUpdateMaxIntervalFrames: 12,
  defaultDistrictChunkCullRadiusM: 152,
} as const;

/**
 * Scene objects / material prefixes whose vertex shaders displace vertices in world/view space
 * or track the camera continuously, so Three.js local-bounds frustum culling must stay disabled.
 */
export const FRUSTUM_CULLING_PRESERVE_NAMES = new Set<string>([
  'CurvedPlanetGround',
  'InfiniteGrass',
  'InfiniteGrassPetals',
  'BlitzInfiniteGrass',
  'BlitzInfiniteGrassPetals',
  'AnimeSkyDome',
  'AnimeSkySparkles',
  'ShorelineFishingLine',
]);

export interface InstancedBoundingVolumesResult {
  activeCount: number;
  boundingBox: THREE.Box3;
  boundingSphere: THREE.Sphere;
}

const _cornerTmp = new THREE.Vector3();
const _matTmp = new THREE.Matrix4();
const _boxTmp = new THREE.Box3();
const _scaleTmp = new THREE.Vector3();
const _posTmp = new THREE.Vector3();
const _quatTmp = new THREE.Quaternion();
const _eulerTmp = new THREE.Euler();

/**
 * Computes exact union `boundingBox` and enclosing `boundingSphere` for an `InstancedMesh`
 * by transforming its geometry bounding-box corners by every non-collapsed instance matrix.
 * Ensures `frustumCulled = true` can be safely enabled without premature popping.
 */
export function computeInstancedBoundingVolumes(
  instMesh: THREE.InstancedMesh,
  options?: {
    padding?: number;
    frustumCulled?: boolean;
    skipZeroScale?: boolean;
  },
): InstancedBoundingVolumesResult {
  const padding = Math.max(0, options?.padding ?? 0.25);
  const skipZeroScale = options?.skipZeroScale ?? true;
  const geo = instMesh.geometry;
  if (!geo.boundingBox) {
    geo.computeBoundingBox();
  }
  const geoBox = geo.boundingBox ?? _boxTmp.set(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));
  const minX = geoBox.min.x;
  const minY = geoBox.min.y;
  const minZ = geoBox.min.z;
  const maxX = geoBox.max.x;
  const maxY = geoBox.max.y;
  const maxZ = geoBox.max.z;

  const unionBox = new THREE.Box3();
  let activeCount = 0;

  for (let i = 0; i < instMesh.count; i++) {
    instMesh.getMatrixAt(i, _matTmp);
    const e = _matTmp.elements;
    if (skipZeroScale) {
      const sxSq = e[0] * e[0] + e[1] * e[1] + e[2] * e[2];
      const sySq = e[4] * e[4] + e[5] * e[5] + e[6] * e[6];
      const szSq = e[8] * e[8] + e[9] * e[9] + e[10] * e[10];
      if (sxSq < 1e-10 && sySq < 1e-10 && szSq < 1e-10) {
        continue;
      }
    }
    activeCount++;
    for (let cx = 0; cx < 2; cx++) {
      const x = cx === 0 ? minX : maxX;
      for (let cy = 0; cy < 2; cy++) {
        const y = cy === 0 ? minY : maxY;
        for (let cz = 0; cz < 2; cz++) {
          const z = cz === 0 ? minZ : maxZ;
          _cornerTmp.set(x, y, z).applyMatrix4(_matTmp);
          unionBox.expandByPoint(_cornerTmp);
        }
      }
    }
  }

  const boundingSphere = new THREE.Sphere();
  if (activeCount === 0 || unionBox.isEmpty()) {
    unionBox.makeEmpty();
    boundingSphere.set(new THREE.Vector3(0, 0, 0), 0);
  } else {
    unionBox.expandByScalar(padding);
    const center = unionBox.getCenter(new THREE.Vector3());
    let maxDistSq = 0;
    for (let cx = 0; cx < 2; cx++) {
      const x = cx === 0 ? unionBox.min.x : unionBox.max.x;
      for (let cy = 0; cy < 2; cy++) {
        const y = cy === 0 ? unionBox.min.y : unionBox.max.y;
        for (let cz = 0; cz < 2; cz++) {
          const z = cz === 0 ? unionBox.min.z : unionBox.max.z;
          const dSq =
            (x - center.x) * (x - center.x) +
            (y - center.y) * (y - center.y) +
            (z - center.z) * (z - center.z);
          if (dSq > maxDistSq) maxDistSq = dSq;
        }
      }
    }
    boundingSphere.set(center, Math.sqrt(maxDistSq));
  }

  if (!instMesh.boundingBox) {
    instMesh.boundingBox = unionBox.clone();
  } else {
    instMesh.boundingBox.copy(unionBox);
  }
  if (!instMesh.boundingSphere) {
    instMesh.boundingSphere = boundingSphere.clone();
  } else {
    instMesh.boundingSphere.copy(boundingSphere);
  }

  if (options?.frustumCulled !== undefined) {
    instMesh.frustumCulled = options.frustumCulled;
  } else {
    instMesh.frustumCulled = true;
  }

  return {
    activeCount,
    boundingBox: instMesh.boundingBox,
    boundingSphere: instMesh.boundingSphere,
  };
}

export interface InstancedBatchWithOutlineOptions {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrices: readonly THREE.Matrix4[];
  colors?: readonly THREE.ColorRepresentation[];
  outlineGeometry?: THREE.BufferGeometry;
  outlineMaterial?: THREE.Material;
  name?: string;
  castShadow?: boolean;
  receiveShadow?: boolean;
  customDepthMaterial?: THREE.Material;
  renderOrder?: number;
  padding?: number;
  lockStaticMatrix?: boolean;
}

export interface InstancedBatchWithOutlineResult {
  mesh: THREE.InstancedMesh;
  strokeMesh: THREE.InstancedMesh | null;
  boundingSphere: THREE.Sphere;
}

/**
 * Creates a static/updatable `THREE.InstancedMesh` batch plus an optional paired BackSide ink
 * outline `InstancedMesh` sharing the exact `instanceMatrix` GPU buffer (zero duplicate matrices),
 * with pre-computed union bounding volumes and `frustumCulled = true`.
 */
export function createInstancedMeshWithOutline(
  options: InstancedBatchWithOutlineOptions,
): InstancedBatchWithOutlineResult {
  const count = options.matrices.length;
  const mesh = new THREE.InstancedMesh(options.geometry, options.material, Math.max(1, count));
  mesh.count = count;
  if (options.name) {
    mesh.name = options.name;
  }
  mesh.castShadow = options.castShadow ?? false;
  mesh.receiveShadow = options.receiveShadow ?? false;
  mesh.renderOrder = options.renderOrder ?? 0;
  if (options.customDepthMaterial) {
    mesh.customDepthMaterial = options.customDepthMaterial;
  }

  for (let i = 0; i < count; i++) {
    mesh.setMatrixAt(i, options.matrices[i]);
    if (options.colors && options.colors[i] !== undefined) {
      mesh.setColorAt(i, new THREE.Color(options.colors[i]));
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  const padding = options.padding ?? 0.25;
  const bounds = computeInstancedBoundingVolumes(mesh, { padding, frustumCulled: true });

  if (options.lockStaticMatrix !== false) {
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
  }

  let strokeMesh: THREE.InstancedMesh | null = null;
  if (options.outlineGeometry && options.outlineMaterial) {
    strokeMesh = new THREE.InstancedMesh(
      options.outlineGeometry,
      options.outlineMaterial,
      Math.max(1, count),
    );
    strokeMesh.count = count;
    strokeMesh.name = options.name ? `${options.name}_Stroke` : 'InstancedBatch_Stroke';
    strokeMesh.castShadow = false;
    strokeMesh.receiveShadow = false;
    strokeMesh.renderOrder = options.renderOrder ?? 0;
    strokeMesh.userData.isModelStroke = true;
    strokeMesh.instanceMatrix = mesh.instanceMatrix;
    strokeMesh.boundingBox = bounds.boundingBox.clone();
    strokeMesh.boundingSphere = bounds.boundingSphere.clone();
    strokeMesh.frustumCulled = true;
    if (options.lockStaticMatrix !== false) {
      strokeMesh.updateMatrix();
      strokeMesh.matrixAutoUpdate = false;
    }
  }

  return {
    mesh,
    strokeMesh,
    boundingSphere: bounds.boundingSphere,
  };
}

/**
 * Checks whether an Object3D must keep `frustumCulled = false` because its shader/vertices
 * are toroidally shifted or follow the camera continuously.
 */
export function shouldPreserveFrustumCulledFalse(obj: THREE.Object3D): boolean {
  if (obj.userData?.preserveFrustumCulledFalse === true) return true;
  if (obj.name && FRUSTUM_CULLING_PRESERVE_NAMES.has(obj.name)) return true;
  if ((obj as THREE.Line).isLine && obj.userData?.dynamicVertices === true) return true;
  return false;
}

/**
 * Assigns an animation-safe local boundingSphere onto a `THREE.SkinnedMesh` so off-camera
 * avatars and outlines can be frustum-culled cleanly without clipping during limb swings,
 * jumps, carrying crates overhead, or riding scooters.
 */
export function applySkinnedMeshSafeBoundingSphere(
  mesh: THREE.SkinnedMesh,
  marginMultiplier = 1.85,
  minLocalRadius = 0.65,
): THREE.Sphere {
  const geo = mesh.geometry;
  if (!geo.boundingSphere) {
    geo.computeBoundingSphere();
  }
  const srcSphere = geo.boundingSphere;
  const center = srcSphere ? srcSphere.center.clone() : new THREE.Vector3(0, 0.9, 0);
  const rawRadius = srcSphere && Number.isFinite(srcSphere.radius) ? srcSphere.radius : 1.0;
  const safeRadius = Math.max(minLocalRadius, rawRadius * Math.max(1.25, marginMultiplier));

  if (!mesh.boundingSphere) {
    mesh.boundingSphere = new THREE.Sphere(center, safeRadius);
  } else {
    mesh.boundingSphere.set(center, safeRadius);
  }
  mesh.frustumCulled = true;
  return mesh.boundingSphere;
}

export interface FrustumCullingAuditReport {
  totalMeshes: number;
  alreadyCulledCount: number;
  enabledCullingCount: number;
  preservedAllowlistCount: number;
}

/**
 * Audits a Three.js scene subtree and enables `frustumCulled = true` with computed bounds on all
 * eligible `Mesh`, `InstancedMesh`, and `SkinnedMesh` nodes while respecting allowlisted shaders.
 */
export function auditAndApplyFrustumCulling(
  root: THREE.Object3D,
  options?: {
    skinnedMarginMultiplier?: number;
    instancedPadding?: number;
  },
): FrustumCullingAuditReport {
  const report: FrustumCullingAuditReport = {
    totalMeshes: 0,
    alreadyCulledCount: 0,
    enabledCullingCount: 0,
    preservedAllowlistCount: 0,
  };
  const skinnedMargin = options?.skinnedMarginMultiplier ?? 1.85;
  const instancedPadding = options?.instancedPadding ?? 0.35;

  root.traverse((obj) => {
    const asMesh = obj as THREE.Mesh;
    const asPoints = obj as THREE.Points;
    const asLine = obj as THREE.Line;
    if (!asMesh.isMesh && !asPoints.isPoints && !asLine.isLine) {
      return;
    }
    report.totalMeshes++;

    if (shouldPreserveFrustumCulledFalse(obj)) {
      if (!obj.frustumCulled) {
        report.preservedAllowlistCount++;
        return;
      }
    }

    if ((obj as THREE.InstancedMesh).isInstancedMesh) {
      const inst = obj as THREE.InstancedMesh;
      if (!inst.boundingSphere || !inst.frustumCulled) {
        computeInstancedBoundingVolumes(inst, {
          padding: instancedPadding,
          frustumCulled: true,
        });
      }
    } else if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
      applySkinnedMeshSafeBoundingSphere(obj as THREE.SkinnedMesh, skinnedMargin);
    } else if (asMesh.geometry && !asMesh.geometry.boundingSphere) {
      asMesh.geometry.computeBoundingSphere();
    }

    if (obj.frustumCulled) {
      report.alreadyCulledCount++;
    } else {
      obj.frustumCulled = true;
      report.enabledCullingCount++;
    }
  });

  return report;
}

/**
 * Packs a world position + Y yaw + uniform/vector scale + optional hit-jiggle XZ tilt into `out`.
 */
export function composeWorldPropInstanceMatrix(
  out: THREE.Matrix4,
  x: number,
  y: number,
  z: number,
  rotY: number,
  scaleX: number,
  scaleY: number = scaleX,
  scaleZ: number = scaleX,
  tiltX = 0,
  tiltZ = 0,
): THREE.Matrix4 {
  _posTmp.set(x, y, z);
  _eulerTmp.set(tiltX, rotY, tiltZ, 'XYZ');
  _quatTmp.setFromEuler(_eulerTmp);
  _scaleTmp.set(scaleX, scaleY, scaleZ);
  return out.compose(_posTmp, _quatTmp, _scaleTmp);
}

/**
 * Sets a zero-scale matrix at `slotIdx` so hidden/destroyed instanced props emit zero triangles.
 */
export function hideInstancedSlotMatrix(instMesh: THREE.InstancedMesh, slotIdx: number): void {
  _matTmp.makeScale(0, 0, 0);
  instMesh.setMatrixAt(slotIdx, _matTmp);
  instMesh.instanceMatrix.needsUpdate = true;
}

export interface InstancedTreeSlotBinding {
  variantKey: 'purple' | 'gold';
  treeSlotIdx: number;
  trunkInst: THREE.InstancedMesh | null;
  trunkStrokeInst: THREE.InstancedMesh | null;
  trunkBaseMatrix: THREE.Matrix4;
  leavesInst: THREE.InstancedMesh | null;
  leafSlotStart: number;
  leafMarkerMatrices: readonly THREE.Matrix4[];
  needsBoundsRefresh: boolean;
  syncTransform: (
    x: number,
    y: number,
    z: number,
    rotY: number,
    visible: boolean,
    tiltX?: number,
    tiltZ?: number,
  ) => void;
}

export interface InstancedPropSlotBinding {
  slotIdx: number;
  partInsts: readonly THREE.InstancedMesh[];
  partLocalMatrices: readonly THREE.Matrix4[];
  visibleCache: boolean;
  syncTransform: (
    x: number,
    y: number,
    z: number,
    rotY: number,
    scaleX: number,
    scaleY: number,
    scaleZ: number,
    visible: boolean,
    tiltX?: number,
    tiltZ?: number,
  ) => void;
}

/**
 * Lightweight manager that promotes static repetitive props (`realPropsGroup`) and trees (`trees`)
 * into shared `THREE.InstancedMesh` batches inside `batchRootGroup`, cutting 200+ draw calls
 * down to ~15 batched draw calls while keeping destruction, editor rebuilds, and jiggle tilt exact.
 */
export class InstancedWorldPropBatchManager {
  public readonly batchRootGroup: THREE.Group;
  private readonly instancedMeshes: THREE.InstancedMesh[] = [];
  private readonly treeShadowProxies: THREE.InstancedMesh[] = [];
  private treeShadowProxyGeo: THREE.BufferGeometry | null = null;
  private treeShadowProxyMat: THREE.MeshBasicMaterial | null = null;
  private foliageShadowsEnabled = true;
  private readonly lastSyncedState = new WeakMap<
    object,
    { x: number; y: number; z: number; rotY: number; tiltX: number; tiltZ: number; visible: boolean }
  >();

  constructor(name = 'InstancedWorldPropBatches') {
    this.batchRootGroup = new THREE.Group();
    this.batchRootGroup.name = name;
  }

  clear(): void {
    for (let i = 0; i < this.instancedMeshes.length; i++) {
      const m = this.instancedMeshes[i];
      this.batchRootGroup.remove(m);
      m.dispose();
    }
    this.instancedMeshes.length = 0;
    for (let i = 0; i < this.treeShadowProxies.length; i++) {
      const p = this.treeShadowProxies[i];
      this.batchRootGroup.remove(p);
      p.dispose();
    }
    this.treeShadowProxies.length = 0;
    this.treeShadowProxyGeo?.dispose();
    this.treeShadowProxyGeo = null;
    this.treeShadowProxyMat?.dispose();
    this.treeShadowProxyMat = null;
    while (this.batchRootGroup.children.length > 0) {
      this.batchRootGroup.remove(this.batchRootGroup.children[0]);
    }
  }

  setTreeFoliageShadowsEnabled(enabled: boolean): void {
    if (this.foliageShadowsEnabled === enabled) return;
    this.foliageShadowsEnabled = enabled;
    for (let i = 0; i < this.treeShadowProxies.length; i++) {
      const proxy = this.treeShadowProxies[i];
      proxy.castShadow = enabled;
      proxy.visible = enabled;
    }
  }

  getBatchDrawCallCount(): number {
    return this.instancedMeshes.length;
  }

  getInstancedMeshes(): readonly THREE.InstancedMesh[] {
    return this.instancedMeshes;
  }

  /**
   * Batches `trees` that were populated by `populateRealBlitzTreeFromGlb` into at most
   * 3 InstancedMeshes per variant (`purple` / `gold`): trunk, optional trunk stroke, and shared leaves.
   */
  promoteTreesToInstancedBatches(
    entries: readonly {
      isPurple: boolean;
      mesh: THREE.Group;
      x: number;
      z: number;
      alive: boolean;
    }[],
  ): number {
    type TreeGroupSource = {
      entry: (typeof entries)[number];
      trunkMesh: THREE.Mesh | null;
      trunkStroke: THREE.Mesh | null;
      leavesInst: THREE.InstancedMesh | null;
    };
    const buckets: Record<'purple' | 'gold', TreeGroupSource[]> = {
      purple: [],
      gold: [],
    };

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const trunkGroup = entry.mesh.getObjectByName('RealGlbTreeTrunk');
      if (!trunkGroup) continue;
      let trunkMesh: THREE.Mesh | null = null;
      let trunkStroke: THREE.Mesh | null = null;
      let leavesInst: THREE.InstancedMesh | null = null;

      for (let ci = 0; ci < trunkGroup.children.length; ci++) {
        const ch = trunkGroup.children[ci];
        if (ch.name === 'RealGlbTreeLeaves' && (ch as THREE.InstancedMesh).isInstancedMesh) {
          leavesInst = ch as THREE.InstancedMesh;
        } else if ((ch as THREE.Mesh).isMesh && !trunkMesh && ch.children.length <= 1) {
          trunkMesh = ch as THREE.Mesh;
          for (let si = 0; si < ch.children.length; si++) {
            const sub = ch.children[si] as THREE.Mesh;
            if (sub.isMesh && sub.userData?.isModelStroke) {
              trunkStroke = sub;
            }
          }
        }
      }
      // Require single clean trunk mesh (or leaf batch); fallback multi-limb trunks keep only leaf batching
      if (!leavesInst && !trunkMesh) continue;
      buckets[entry.isPurple ? 'purple' : 'gold'].push({
        entry,
        trunkMesh,
        trunkStroke,
        leavesInst,
      });
    }

    let promotedCount = 0;
    const tmpLocal = new THREE.Matrix4();
    const tmpWorld = new THREE.Matrix4();

    for (const variantKey of ['purple', 'gold'] as const) {
      const groupItems = buckets[variantKey];
      if (groupItems.length < 2) continue;

      const withTrunk = groupItems.filter((g) => g.trunkMesh !== null);
      let trunkBatchInst: THREE.InstancedMesh | null = null;
      let trunkStrokeBatchInst: THREE.InstancedMesh | null = null;

      if (withTrunk.length === groupItems.length && withTrunk[0].trunkMesh) {
        const tmplTrunk = withTrunk[0].trunkMesh;
        const canShareTrunkGeo = withTrunk.every(
          (g) => g.trunkMesh && g.trunkMesh.geometry === tmplTrunk.geometry,
        );
        if (canShareTrunkGeo) {
          trunkBatchInst = new THREE.InstancedMesh(
            tmplTrunk.geometry,
            tmplTrunk.material,
            groupItems.length,
          );
          trunkBatchInst.name = `InstancedTreeTrunks_${variantKey}`;
          trunkBatchInst.castShadow = tmplTrunk.castShadow;
          trunkBatchInst.receiveShadow = tmplTrunk.receiveShadow;
          this.batchRootGroup.add(trunkBatchInst);
          this.instancedMeshes.push(trunkBatchInst);

          const tmplStroke = withTrunk[0].trunkStroke;
          if (tmplStroke) {
            trunkStrokeBatchInst = new THREE.InstancedMesh(
              tmplStroke.geometry,
              tmplStroke.material,
              groupItems.length,
            );
            trunkStrokeBatchInst.name = `InstancedTreeTrunkStrokes_${variantKey}`;
            trunkStrokeBatchInst.castShadow = false;
            trunkStrokeBatchInst.receiveShadow = false;
            trunkStrokeBatchInst.userData.isModelStroke = true;
            trunkStrokeBatchInst.instanceMatrix = trunkBatchInst.instanceMatrix;
            this.batchRootGroup.add(trunkStrokeBatchInst);
            this.instancedMeshes.push(trunkStrokeBatchInst);
          }
        }
      }

      const withLeaves = groupItems.filter((g) => g.leavesInst !== null);
      let leavesBatchInst: THREE.InstancedMesh | null = null;
      let totalLeafMarkers = 0;
      const perTreeLeafMarkers: THREE.Matrix4[][] = [];

      if (withLeaves.length === groupItems.length && withLeaves[0].leavesInst) {
        const tmplLeaves = withLeaves[0].leavesInst;
        const canShareLeaves = withLeaves.every(
          (g) =>
            g.leavesInst &&
            g.leavesInst.geometry === tmplLeaves.geometry &&
            g.leavesInst.material === tmplLeaves.material,
        );
        if (canShareLeaves) {
          for (let ti = 0; ti < groupItems.length; ti++) {
            const srcInst = groupItems[ti].leavesInst!;
            const treeLocalMats: THREE.Matrix4[] = [];
            groupItems[ti].entry.mesh.updateMatrix();
            for (let mi = 0; mi < srcInst.count; mi++) {
              const mm = new THREE.Matrix4();
              srcInst.getMatrixAt(mi, mm);
              treeLocalMats.push(mm);
            }
            perTreeLeafMarkers.push(treeLocalMats);
            totalLeafMarkers += treeLocalMats.length;
          }
          leavesBatchInst = new THREE.InstancedMesh(
            tmplLeaves.geometry,
            tmplLeaves.material,
            Math.max(1, totalLeafMarkers),
          );
          leavesBatchInst.count = totalLeafMarkers;
          leavesBatchInst.name = `InstancedTreeLeaves_${variantKey}`;
          const wantsOpaqueShadowProxy = Boolean(tmplLeaves.castShadow && tmplLeaves.userData?.useOpaqueShadowProxy);
          if (wantsOpaqueShadowProxy) {
            // Never run alpha-tested `discard` billboard leaf quads in the shadow depth pass:
            // use a shared 20-triangle opaque icosahedron proxy per crown cluster for full Early-Z speed.
            leavesBatchInst.castShadow = false;
            leavesBatchInst.receiveShadow = tmplLeaves.receiveShadow;
            if (!this.treeShadowProxyGeo) {
              this.treeShadowProxyGeo = new THREE.IcosahedronGeometry(1.12, 0);
            }
            if (!this.treeShadowProxyMat) {
              this.treeShadowProxyMat = new THREE.MeshBasicMaterial({
                colorWrite: false,
                depthWrite: false,
              });
            }
            const shadowProxy = new THREE.InstancedMesh(
              this.treeShadowProxyGeo,
              this.treeShadowProxyMat,
              Math.max(1, totalLeafMarkers),
            );
            shadowProxy.count = totalLeafMarkers;
            shadowProxy.name = `InstancedTreeShadowProxy_${variantKey}`;
            shadowProxy.instanceMatrix = leavesBatchInst.instanceMatrix;
            shadowProxy.castShadow = this.foliageShadowsEnabled;
            shadowProxy.visible = this.foliageShadowsEnabled;
            shadowProxy.receiveShadow = false;
            this.batchRootGroup.add(shadowProxy);
            this.treeShadowProxies.push(shadowProxy);
          } else {
            leavesBatchInst.castShadow = tmplLeaves.castShadow;
            leavesBatchInst.receiveShadow = tmplLeaves.receiveShadow;
            if (tmplLeaves.customDepthMaterial) {
              leavesBatchInst.customDepthMaterial = tmplLeaves.customDepthMaterial;
            }
          }
          this.batchRootGroup.add(leavesBatchInst);
          this.instancedMeshes.push(leavesBatchInst);
        }
      }

      if (!trunkBatchInst && !leavesBatchInst) continue;

      let leafCursor = 0;
      for (let ti = 0; ti < groupItems.length; ti++) {
        const item = groupItems[ti];
        const treeObj = item.entry.mesh;
        treeObj.updateMatrix();
        const trunkBaseMat = new THREE.Matrix4();
        if (trunkBatchInst && item.trunkMesh) {
          item.trunkMesh.updateMatrix();
          trunkBaseMat.copy(item.trunkMesh.matrix);
          item.trunkMesh.visible = false;
        }
        const leafMarkers = perTreeLeafMarkers[ti] ?? [];
        const leafStart = leafCursor;
        if (leavesBatchInst && item.leavesInst) {
          leafCursor += leafMarkers.length;
          item.leavesInst.visible = false;
        }

        const binding: InstancedTreeSlotBinding = {
          variantKey,
          treeSlotIdx: ti,
          trunkInst: trunkBatchInst,
          trunkStrokeInst: trunkStrokeBatchInst,
          trunkBaseMatrix: trunkBaseMat,
          leavesInst: leavesBatchInst,
          leafSlotStart: leafStart,
          leafMarkerMatrices: leafMarkers,
          needsBoundsRefresh: false,
          syncTransform: (x, y, z, rotY, visible, tiltX = 0, tiltZ = 0) => {
            const prev = this.lastSyncedState.get(treeObj);
            if (
              prev &&
              prev.x === x &&
              prev.y === y &&
              prev.z === z &&
              prev.rotY === rotY &&
              prev.tiltX === tiltX &&
              prev.tiltZ === tiltZ &&
              prev.visible === visible
            ) {
              return;
            }
            this.lastSyncedState.set(treeObj, { x, y, z, rotY, tiltX, tiltZ, visible });
            if (!visible) {
              if (trunkBatchInst) hideInstancedSlotMatrix(trunkBatchInst, ti);
              if (leavesBatchInst) {
                for (let li = 0; li < leafMarkers.length; li++) {
                  hideInstancedSlotMatrix(leavesBatchInst, leafStart + li);
                }
              }
              return;
            }
            composeWorldPropInstanceMatrix(tmpWorld, x, y, z, rotY, 1, 1, 1, tiltX, tiltZ);
            if (trunkBatchInst) {
              tmpLocal.multiplyMatrices(tmpWorld, trunkBaseMat);
              trunkBatchInst.setMatrixAt(ti, tmpLocal);
              trunkBatchInst.instanceMatrix.needsUpdate = true;
            }
            if (leavesBatchInst) {
              for (let li = 0; li < leafMarkers.length; li++) {
                tmpLocal.multiplyMatrices(tmpWorld, leafMarkers[li]);
                leavesBatchInst.setMatrixAt(leafStart + li, tmpLocal);
              }
              leavesBatchInst.instanceMatrix.needsUpdate = true;
            }
          },
        };

        binding.syncTransform(
          treeObj.position.x,
          treeObj.position.y,
          treeObj.position.z,
          treeObj.rotation.y,
          item.entry.alive && treeObj.visible,
        );
        treeObj.userData.__instancedTreeBinding = binding;
        promotedCount++;
      }

      if (trunkBatchInst) {
        const tb = computeInstancedBoundingVolumes(trunkBatchInst, {
          padding: 0.6,
          frustumCulled: true,
        });
        if (trunkStrokeBatchInst) {
          trunkStrokeBatchInst.boundingBox = tb.boundingBox.clone();
          trunkStrokeBatchInst.boundingSphere = tb.boundingSphere.clone();
          trunkStrokeBatchInst.frustumCulled = true;
        }
      }
      if (leavesBatchInst) {
        const lb = computeInstancedBoundingVolumes(leavesBatchInst, {
          padding: 2.2,
          frustumCulled: true,
        });
        const matchingProxy = this.treeShadowProxies.find(
          (p) => p.instanceMatrix === leavesBatchInst!.instanceMatrix,
        );
        if (matchingProxy) {
          matchingProxy.boundingBox = lb.boundingBox.clone();
          matchingProxy.boundingSphere = lb.boundingSphere.clone();
          matchingProxy.frustumCulled = true;
        }
      }
    }

    return promotedCount;
  }

  /**
   * Batches repetitive static props (at least `minGroupSize` instances of identical template parts,
   * e.g. lampposts, benches, recycle bins, hydrants, river rocks, flower clusters, static pipes/fences)
   * into shared `THREE.InstancedMesh`es while preserving wrapper transform/visibility/jiggle updates.
   */
  promoteStaticPropsToInstancedBatches(
    wrappers: readonly THREE.Object3D[],
    minGroupSize = 2,
  ): number {
    type PartSpec = {
      geometry: THREE.BufferGeometry;
      material: THREE.Material;
      castShadow: boolean;
      receiveShadow: boolean;
      isModelStroke: boolean;
      renderOrder: number;
      localMatrix: THREE.Matrix4;
      mesh: THREE.Mesh;
    };
    type EligibleWrapper = {
      wrapper: THREE.Object3D;
      signature: string;
      parts: PartSpec[];
    };

    const bySignature = new Map<string, EligibleWrapper[]>();
    const rootInv = new THREE.Matrix4();

    for (let wi = 0; wi < wrappers.length; wi++) {
      const wrapper = wrappers[wi];
      if (!wrapper.visible) continue;
      if (
        (wrapper.userData.windFanNodes as unknown[] | undefined)?.length ||
        (wrapper.userData.spinYNodes as unknown[] | undefined)?.length ||
        (wrapper.userData.craneTopNodes as unknown[] | undefined)?.length ||
        (wrapper.userData.chimneySmokePuffs as unknown[] | undefined)?.length ||
        wrapper.userData.skipStaticInstancing === true
      ) {
        continue;
      }

      wrapper.updateMatrixWorld(true);
      rootInv.copy(wrapper.matrixWorld).invert();

      const parts: PartSpec[] = [];
      let unsupported = false;
      wrapper.traverse((node) => {
        if (unsupported) return;
        if ((node as THREE.InstancedMesh).isInstancedMesh) {
          unsupported = true;
          return;
        }
        const m = node as THREE.Mesh;
        if (!m.isMesh) return;
        if (Array.isArray(m.material)) {
          unsupported = true;
          return;
        }
        const localMat = new THREE.Matrix4().multiplyMatrices(rootInv, m.matrixWorld);
        parts.push({
          geometry: m.geometry,
          material: m.material,
          castShadow: m.castShadow,
          receiveShadow: m.receiveShadow,
          isModelStroke: Boolean(m.userData?.isModelStroke),
          renderOrder: m.renderOrder || 0,
          localMatrix: localMat,
          mesh: m,
        });
      });

      if (unsupported || parts.length === 0) continue;

      const sig = parts
        .map(
          (p) =>
            `${p.geometry.uuid}:${p.material.uuid}:${p.castShadow ? 1 : 0}:${p.isModelStroke ? 1 : 0}`,
        )
        .sort()
        .join('|');
      let list = bySignature.get(sig);
      if (!list) {
        list = [];
        bySignature.set(sig, list);
      }
      list.push({ wrapper, signature: sig, parts });
    }

    let promotedCount = 0;
    const tmpWorld = new THREE.Matrix4();
    const tmpCombined = new THREE.Matrix4();

    for (const groupItems of bySignature.values()) {
      if (groupItems.length < minGroupSize) continue;
      const partCount = groupItems[0].parts.length;
      const sortedRef = [...groupItems[0].parts].sort((a, b) =>
        `${a.geometry.uuid}:${a.material.uuid}`.localeCompare(
          `${b.geometry.uuid}:${b.material.uuid}`,
        ),
      );
      const partInsts: THREE.InstancedMesh[] = [];
      for (let pi = 0; pi < partCount; pi++) {
        const refPart = sortedRef[pi];
        const inst = new THREE.InstancedMesh(
          refPart.geometry,
          refPart.material,
          groupItems.length,
        );
        inst.name = `InstancedStaticProp_Part${pi}`;
        inst.castShadow = refPart.castShadow;
        inst.receiveShadow = refPart.receiveShadow;
        inst.renderOrder = refPart.renderOrder;
        if (refPart.isModelStroke) {
          inst.userData.isModelStroke = true;
        }
        this.batchRootGroup.add(inst);
        this.instancedMeshes.push(inst);
        partInsts.push(inst);
      }

      for (let wi = 0; wi < groupItems.length; wi++) {
        const item = groupItems[wi];
        const w = item.wrapper;
        const sortedParts = [...item.parts].sort((a, b) =>
          `${a.geometry.uuid}:${a.material.uuid}`.localeCompare(
            `${b.geometry.uuid}:${b.material.uuid}`,
          ),
        );
        const localMatrices = sortedParts.map((p) => {
          p.mesh.visible = false;
          return p.localMatrix;
        });

        const binding: InstancedPropSlotBinding = {
          slotIdx: wi,
          partInsts,
          partLocalMatrices: localMatrices,
          visibleCache: true,
          syncTransform: (
            x,
            y,
            z,
            rotY,
            scaleX,
            scaleY,
            scaleZ,
            visible,
            tiltX = 0,
            tiltZ = 0,
          ) => {
            const prev = this.lastSyncedState.get(w);
            if (
              prev &&
              prev.x === x &&
              prev.y === y &&
              prev.z === z &&
              prev.rotY === rotY &&
              prev.tiltX === tiltX &&
              prev.tiltZ === tiltZ &&
              prev.visible === visible
            ) {
              return;
            }
            this.lastSyncedState.set(w, { x, y, z, rotY, tiltX, tiltZ, visible });
            if (!visible) {
              for (let pi = 0; pi < partInsts.length; pi++) {
                hideInstancedSlotMatrix(partInsts[pi], wi);
              }
              return;
            }
            composeWorldPropInstanceMatrix(
              tmpWorld,
              x,
              y,
              z,
              rotY,
              scaleX,
              scaleY,
              scaleZ,
              tiltX,
              tiltZ,
            );
            for (let pi = 0; pi < partInsts.length; pi++) {
              tmpCombined.multiplyMatrices(tmpWorld, localMatrices[pi]);
              partInsts[pi].setMatrixAt(wi, tmpCombined);
              partInsts[pi].instanceMatrix.needsUpdate = true;
            }
          },
        };

        binding.syncTransform(
          w.position.x,
          w.position.y,
          w.position.z,
          w.rotation.y,
          w.scale.x,
          w.scale.y,
          w.scale.z,
          w.visible,
        );
        w.userData.__instancedPropBinding = binding;
        promotedCount++;
      }

      for (let pi = 0; pi < partInsts.length; pi++) {
        computeInstancedBoundingVolumes(partInsts[pi], {
          padding: 0.4,
          frustumCulled: true,
        });
      }
    }

    return promotedCount;
  }
}

export interface PointLightEmitterRequest {
  x: number;
  y: number;
  z: number;
  colorHex: number | string;
  intensity: number;
  distance: number;
  decay?: number;
}

/**
 * Selects up to `maxActive` brightest/nearest PointLight emitter requests within `maxDistSq`
 * relative to `focusPos` so fixed-pool WebGL PointLights never trigger shader recompilation.
 */
export function selectBudgetedPointLightEmitters(
  requests: readonly PointLightEmitterRequest[],
  focusPos: { x: number; y: number; z: number },
  maxActive: number = LIGHTING_HYGIENE_LIMITS.maxActiveLaserPointLights,
  maxDistSq: number = LIGHTING_HYGIENE_LIMITS.laserPointLightMaxDistSq,
): PointLightEmitterRequest[] {
  if (maxActive <= 0 || requests.length === 0) return [];
  const scored: { req: PointLightEmitterRequest; distSq: number }[] = [];
  for (let i = 0; i < requests.length; i++) {
    const r = requests[i];
    if (r.intensity <= 0.001) continue;
    const dx = r.x - focusPos.x;
    const dy = r.y - focusPos.y;
    const dz = r.z - focusPos.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq <= maxDistSq) {
      scored.push({ req: r, distSq });
    }
  }
  scored.sort((a, b) => a.distSq - b.distSq);
  return scored.slice(0, maxActive).map((s) => s.req);
}

function computePoolBoundaryFade(distSq: number, maxDistSq: number): number {
  if (maxDistSq <= 0) return 1;
  const maxDist = Math.sqrt(maxDistSq);
  const fadeStart = maxDist * 0.72;
  const dist = Math.sqrt(distSq);
  if (dist <= fadeStart) return 1;
  if (dist >= maxDist) return 0;
  const t = (dist - fadeStart) / Math.max(1e-4, maxDist - fadeStart);
  return 1 - t * t * (3 - 2 * t);
}

/**
 * Fixed-size scene PointLight pool (default 2) preventing `NUM_POINT_LIGHTS` WebGL shader
 * recompilations during laser battles by keeping light count constant and setting unused `intensity = 0`.
 */
export class FixedPointLightPool {
  public readonly lights: THREE.PointLight[] = [];
  private readonly pending: PointLightEmitterRequest[] = [];
  private readonly maxDistSq: number;
  private lastActiveCount = 0;

  constructor(
    scene: THREE.Scene,
    poolSize: number = LIGHTING_HYGIENE_LIMITS.maxActiveLaserPointLights,
    maxDistSq: number = LIGHTING_HYGIENE_LIMITS.laserPointLightMaxDistSq,
  ) {
    this.maxDistSq = maxDistSq;
    for (let i = 0; i < poolSize; i++) {
      const pt = new THREE.PointLight(0xffffff, 0, 6.0, 1.65);
      pt.name = `PooledLaserPointLight_${i}`;
      pt.castShadow = false;
      scene.add(pt);
      this.lights.push(pt);
    }
  }

  getActiveCount(): number {
    return this.lastActiveCount;
  }

  beginFrame(): void {
    this.pending.length = 0;
  }

  submit(req: PointLightEmitterRequest): void {
    this.pending.push(req);
  }

  commitFrame(focusPos: { x: number; y: number; z: number }, activeAllowed = true): number {
    if (!activeAllowed) {
      for (let i = 0; i < this.lights.length; i++) {
        this.lights[i].intensity = 0;
      }
      this.lastActiveCount = 0;
      return 0;
    }
    const chosen = selectBudgetedPointLightEmitters(
      this.pending,
      focusPos,
      this.lights.length,
      this.maxDistSq,
    );
    let activeCount = 0;
    for (let i = 0; i < this.lights.length; i++) {
      const pt = this.lights[i];
      if (i < chosen.length) {
        const c = chosen[i];
        const dx = c.x - focusPos.x;
        const dy = c.y - focusPos.y;
        const dz = c.z - focusPos.z;
        const fade = computePoolBoundaryFade(dx * dx + dy * dy + dz * dz, this.maxDistSq);
        const effIntensity = c.intensity * fade;
        pt.position.set(c.x, c.y, c.z);
        pt.color.set(c.colorHex);
        pt.intensity = effIntensity;
        pt.distance = Math.max(4.0, c.distance);
        pt.decay = c.decay ?? 1.65;
        if (effIntensity > 0.001) activeCount++;
      } else {
        pt.intensity = 0;
      }
    }
    this.lastActiveCount = activeCount;
    return activeCount;
  }
}

export interface HouseInteriorLightIntensities {
  ambientIntensity: number;
  hemiIntensity: number;
  sunIntensity: number;
  counterFillIntensity: number;
  ceilingFillPointIntensity: number;
  warmLampPointIntensity: number;
}

/**
 * Computes calibrated indoor house light intensities when global outdoor `hemiLight` & `dirLight`
 * are isolated (turned off indoors), while consolidating ceiling illumination cleanly to
 * stay within the 2-PointLight indoor hygiene budget.
 */
export function computeHouseInteriorLightRig(
  dayFactor: number,
  sunIntensityNorm: number,
  lampIntensity: number,
): HouseInteriorLightIntensities {
  const clampedDay = Math.max(0, Math.min(1, dayFactor));
  const clampedSun = Math.max(0, Math.min(1, sunIntensityNorm));
  const clampedLamp = Math.max(0, Math.min(1, lampIntensity));
  return {
    ambientIntensity: 0.28 + clampedDay * 0.14,
    hemiIntensity: 1.05 + clampedDay * 0.42,
    sunIntensity: 0.78 + clampedSun * 0.56,
    counterFillIntensity: 0.34 + clampedDay * 0.12,
    ceilingFillPointIntensity: 0.58 + clampedLamp * 0.80,
    warmLampPointIntensity: 0.42 + clampedLamp * 0.88,
  };
}

export interface OutdoorLightingSyncResult {
  outdoorLightsVisible: boolean;
  outdoorCastShadow: boolean;
  hasDirShadowUniform: number;
  windLightColorHex: string;
}

/**
 * Resolves outdoor vs indoor light/shadow isolation flags and synchronized world-shader
 * `windUniforms.uLightColor` tint for a given preset (`day` / `dusk` / `night` / `dawn`).
 */
export function resolveOutdoorLightingState(
  presetKey: 'day' | 'dusk' | 'night' | 'dawn',
  isFlatIndoorRoomMode: boolean,
  isSoftwareGl: boolean,
  dirLightColorHex: string,
): OutdoorLightingSyncResult {
  const windLightColorHex = presetKey === 'day' ? '#fff4c8' : dirLightColorHex;
  return {
    outdoorLightsVisible: !isFlatIndoorRoomMode,
    outdoorCastShadow: !isSoftwareGl && !isFlatIndoorRoomMode,
    hasDirShadowUniform: !isSoftwareGl && !isFlatIndoorRoomMode ? 1.0 : 0.0,
    windLightColorHex,
  };
}

export interface ChunkCullRadiusInput {
  isFlatIndoorRoomMode: boolean;
  isFullMapOverview: boolean;
  isCityView: boolean;
  isParkView: boolean;
  isCasinoView: boolean;
  isLandingTour: boolean;
  isOrbit: boolean;
}

/**
 * Returns the distance radius (meters) for district visibility culling during live play,
 * or `0` to keep every landmark rendered in wide overview/showcase/tour cameras.
 */
export function computeDistrictChunkCullRadius(opts: ChunkCullRadiusInput): number {
  if (
    opts.isFlatIndoorRoomMode ||
    opts.isFullMapOverview ||
    opts.isCityView ||
    opts.isParkView ||
    opts.isCasinoView ||
    opts.isLandingTour ||
    opts.isOrbit
  ) {
    return 0;
  }
  return LIGHTING_HYGIENE_LIMITS.defaultDistrictChunkCullRadiusM;
}

/**
 * Determines per-frame rig bone/IK update cadence so distant or idle avatars in crowded hubs
 * throttle heavy world-matrix/IK work cleanly while foreground players stay 60Hz exact.
 */
export function shouldStepCharacterDetailThisFrame(
  distSqToCamera: number,
  frameTick: number,
  unitIndex: number,
  isLocalPlayer: boolean,
  isAnimatedAction: boolean,
): boolean {
  if (isLocalPlayer) return true;
  // Within 16m: full 60Hz fidelity (100% crisp close interactions & plaza chat)
  if (distSqToCamera <= 16 * 16) return true;
  // Near-mid range 16m..30m: active motion runs at 30Hz, idle/sitting at 20Hz
  if (distSqToCamera <= 30 * 30) {
    const stride = isAnimatedAction ? 2 : 3;
    return (frameTick + unitIndex) % stride === 0;
  }
  // Mid-far range 30m..46m: active motion runs at 20Hz, idle/sitting at 12Hz
  if (distSqToCamera <= 46 * 46) {
    const stride = isAnimatedAction ? 3 : 5;
    return (frameTick + unitIndex) % stride === 0;
  }
  // Far range > 46m: stride 6 (~10Hz)
  return (frameTick + unitIndex) % 6 === 0;
}
