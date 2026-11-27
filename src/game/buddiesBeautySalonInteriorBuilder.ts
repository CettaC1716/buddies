import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { computeInstancedBoundingVolumes } from './buddiesHubRenderOptimizer';
import { buildGlowingDoorFloorArrowPad } from './buddiesCafeInteriorBuilder';
import { GLOW_STUDIO_SALON_GLB_PATH } from './buddiesBeautySalonBuilder';
import {
  SALON_GLB_SCALE,
  SALON_INTERIOR_BOUNDS,
  SALON_INTERIOR_SEAT_SPOTS,
  SALON_ORIGIN_Y,
  type SalonStationInteractionKind,
} from './buddiesBeautySalonRules';
import {
  createPlazaBuildingGlowUniforms,
  optimizeCentralPlazaBuildingGlb,
} from './buddiesCentralPlazaGlbOptimizer';

export interface SalonInteriorSceneHandle {
  root: THREE.Group;
  floorSpotIndicators: Array<{
    coinRoot: THREE.Group;
    blueCoin: THREE.Object3D;
    greenCoin: THREE.Object3D;
  }>;
  updateVisuals: (
    timeSec: number,
    activeStationKind?: SalonStationInteractionKind | null,
    playerFloorY?: number,
  ) => void;
  dispose: () => void;
}

/**
 * Extra drop (scene units) applied to the interior GLB mount so the model's
 * terrazzo floor top lands exactly on SALON_ORIGIN_Y: the prepped GLB was
 * re-grounded by its 0.16m sidewalk slab, leaving its floor top 0.04 model
 * units above y=0, which is 0.04 * SALON_GLB_SCALE in scene units.
 */
const SALON_GLB_FLOOR_DROP_Y = 0.04 * SALON_GLB_SCALE;

/**
 * Builds the Beauty Salon interior scene at SALON_ORIGIN_Y.
 *
 * The interior is the owner Glow Studio GLB itself — the same prepped model
 * that stands on Central Plaza — mounted at the isolated interior origin
 * with the same uniform scale (SALON_GLB_SCALE), so the room the player
 * walks in is a true reflection of the exterior (owner's direction). The
 * earlier procedural interior build is retired; everything it provided is
 * preserved through buddiesBeautySalonRules (bounds, L-staircase ramps,
 * mezzanine containment, colliders) re-measured from the model, the
 * sittable seats re-anchored onto the model's own vanity chairs, lounge
 * sofa and spa bed (SALON_INTERIOR_SEAT_SPOTS), and the handle contract
 * below (exit-door arrow pad, floating seat coins, two point lights).
 */
export function buildBeautySalonInterior(): SalonInteriorSceneHandle {
  const root = new THREE.Group();
  root.name = 'BeautyGlowSalonInterior3D';
  root.position.set(0, SALON_ORIGIN_Y, 0);

  // 1. The Glow Studio GLB as the interior room (async, same load-as-is
  // pattern as the exterior mount; skipped under node/tests).
  const glbMount = new THREE.Group();
  glbMount.name = 'BeautyGlowSalonInteriorGlb3D';
  glbMount.position.y = -SALON_GLB_FLOOR_DROP_Y;
  glbMount.scale.setScalar(SALON_GLB_SCALE);
  root.add(glbMount);
  if (typeof window !== 'undefined') {
    const interiorGlowUniforms = createPlazaBuildingGlowUniforms();
    interiorGlowUniforms.uNightFactor.value = 0.45;
    new GLTFLoader().load(
      GLOW_STUDIO_SALON_GLB_PATH,
      (gltf) => {
        if (!glbMount.parent) return; // scene was disposed meanwhile
        optimizeCentralPlazaBuildingGlb(gltf.scene, {
          buildingId: 'GlowStudioSalonInterior',
          glowUniforms: interiorGlowUniforms,
          castShadow: false,
          receiveShadow: false,
          glassWarmTintHex: '#ffe6bd',
        });
        glbMount.add(gltf.scene);
      },
      undefined,
      () => {
        // Model failed to load: the room still has its exit pad, seat
        // coins and lights, and every rule (movement/seats/exit) works.
      },
    );
  }

  // 2. Warm interior lighting (lighting hygiene: <= 2 PointLights, no
  // SpotLights, no shadows, decay inside the audited 1.2..1.8 band).
  const gfLight = new THREE.PointLight('#ffd9b0', 60, 0, 1.5);
  gfLight.position.set(0, 3.6, 0.5);
  gfLight.castShadow = false;
  root.add(gfLight);
  const mezzLight = new THREE.PointLight('#ffd9b0', 45, 0, 1.5);
  mezzLight.position.set(0, SALON_INTERIOR_BOUNDS.secondFloorY + 2.8, -1.0);
  mezzLight.castShadow = false;
  root.add(mezzLight);

  // 3. Exit Door Glowing Floor Pad inside the model's main door (South
  // wall); the pad's chevron faces +Z toward the door, no rotation needed.
  const exitPad = buildGlowingDoorFloorArrowPad();
  exitPad.group.position.set(SALON_INTERIOR_BOUNDS.exitDoorX, 0.032, SALON_INTERIOR_BOUNDS.exitDoorZ);
  root.add(exitPad.group);

  // 4. GPU-Instanced Compact Floating Seat Discs above the model's vanity
  // chairs (1F), lounge sofa and spa bed (2F mezzanine).
  const seatCount = SALON_INTERIOR_SEAT_SPOTS.length;
  const outerCoinGeo = new THREE.CylinderGeometry(1, 1, 1, 24);
  outerCoinGeo.rotateX(Math.PI * 0.5);
  const outerCoinMat = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    fog: false,
  });
  const outerCoinInst = new THREE.InstancedMesh(outerCoinGeo, outerCoinMat, seatCount);
  outerCoinInst.count = seatCount;
  outerCoinInst.name = 'SalonSeatOuterCoinInstanced';
  outerCoinInst.raycast = () => {};
  root.add(outerCoinInst);

  const innerCoinGeo = new THREE.CylinderGeometry(0.68, 0.68, 1, 20);
  innerCoinGeo.rotateX(Math.PI * 0.5);
  const innerCoinMat = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
    fog: false,
  });
  const innerCoinInst = new THREE.InstancedMesh(innerCoinGeo, innerCoinMat, seatCount);
  innerCoinInst.count = seatCount;
  innerCoinInst.name = 'SalonSeatInnerCoinInstanced';
  innerCoinInst.raycast = () => {};
  root.add(innerCoinInst);

  const floorSpotIndicators = SALON_INTERIOR_SEAT_SPOTS.map((spot) => {
    const coinRoot = new THREE.Group();
    coinRoot.position.set(spot.x, spot.indicatorHeightY, spot.z);
    const blueCoin = new THREE.Group();
    const greenCoin = new THREE.Group();
    greenCoin.visible = false;
    coinRoot.add(blueCoin, greenCoin);
    return { coinRoot, blueCoin, greenCoin };
  });

  const coinPosTmp = new THREE.Vector3();
  const coinQuatTmp = new THREE.Quaternion();
  const coinScaleTmp = new THREE.Vector3();
  const coinMatTmp = new THREE.Matrix4();
  const coinYAxis = new THREE.Vector3(0, 1, 0);
  const blueOuter = new THREE.Color('#38bdf8');
  const blueInner = new THREE.Color('#7dd3fc');
  const greenOuter = new THREE.Color('#b8ff3c');
  const greenInner = new THREE.Color('#d9f99d');
  const secondFloorThreshold =
    (SALON_INTERIOR_BOUNDS.midLandingY + SALON_INTERIOR_BOUNDS.secondFloorY) / 2;

  const syncSeatCoins = (timeSec: number, playerFloorY: number) => {
    const onSecondFloor = playerFloorY >= secondFloorThreshold;
    for (let idx = 0; idx < seatCount; idx++) {
      const spot = SALON_INTERIOR_SEAT_SPOTS[idx];
      const entry = floorSpotIndicators[idx];
      const matchFloor = onSecondFloor === (spot.floorLevel === '2f');
      if (!entry.coinRoot.visible || !matchFloor) {
        coinPosTmp.set(spot.x, spot.indicatorHeightY, spot.z);
        coinQuatTmp.identity();
        coinScaleTmp.set(0, 0, 0);
        coinMatTmp.compose(coinPosTmp, coinQuatTmp, coinScaleTmp);
        outerCoinInst.setMatrixAt(idx, coinMatTmp);
        innerCoinInst.setMatrixAt(idx, coinMatTmp);
        continue;
      }
      const isGreen = entry.greenCoin.visible;
      const baseY = spot.indicatorHeightY;
      const posY = baseY + Math.sin(timeSec * 3.4 + idx * 0.9) * 0.024;
      const rotY = timeSec * 2.1 + idx * 0.6;
      const r = isGreen ? 0.165 : 0.142;
      const thick = isGreen ? 0.020 : 0.018;

      coinPosTmp.set(spot.x, posY, spot.z);
      coinQuatTmp.setFromAxisAngle(coinYAxis, rotY);

      coinScaleTmp.set(r, r, thick);
      coinMatTmp.compose(coinPosTmp, coinQuatTmp, coinScaleTmp);
      outerCoinInst.setMatrixAt(idx, coinMatTmp);
      outerCoinInst.setColorAt(idx, isGreen ? greenOuter : blueOuter);

      coinScaleTmp.set(r, r, thick + 0.003);
      coinMatTmp.compose(coinPosTmp, coinQuatTmp, coinScaleTmp);
      innerCoinInst.setMatrixAt(idx, coinMatTmp);
      innerCoinInst.setColorAt(idx, isGreen ? greenInner : blueInner);
    }
    outerCoinInst.instanceMatrix.needsUpdate = true;
    innerCoinInst.instanceMatrix.needsUpdate = true;
    if (outerCoinInst.instanceColor) outerCoinInst.instanceColor.needsUpdate = true;
    if (innerCoinInst.instanceColor) innerCoinInst.instanceColor.needsUpdate = true;
  };
  syncSeatCoins(0, 0);
  computeInstancedBoundingVolumes(outerCoinInst, { padding: 0.25, frustumCulled: true });
  computeInstancedBoundingVolumes(innerCoinInst, { padding: 0.25, frustumCulled: true });

  const updateVisuals = (
    timeSec: number,
    activeStationKind: SalonStationInteractionKind | null = null,
    playerFloorY = 0,
  ) => {
    const isNearExit = activeStationKind === 'exit_door';
    exitPad.pulseMat.color.set(isNearExit ? '#b8ff3c' : '#38bdf8');
    exitPad.innerDiscMat.color.set(isNearExit ? '#84cc16' : '#0ea5e9');
    exitPad.arrowMat.color.set(isNearExit ? '#b8ff3c' : '#38bdf8');
    exitPad.chevronArrow.scale.setScalar(isNearExit ? 1.14 : 1.0);
    exitPad.pulseMat.opacity = 0.55 + Math.sin(timeSec * 3.8) * 0.25;
    exitPad.chevronArrow.position.y = 0.65 + Math.sin(timeSec * 3.5) * 0.12;
    exitPad.chevronArrow.rotation.y = timeSec * 1.4;
    syncSeatCoins(timeSec, playerFloorY);
  };

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
    floorSpotIndicators,
    updateVisuals,
    dispose,
  };
}
