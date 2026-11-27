import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createPlazaBuildingGlowUniforms,
  optimizeCentralPlazaBuildingGlb,
} from './buddiesCentralPlazaGlbOptimizer';
import {
  BITES_SIPS_PAVILION_GLB_SCALE,
  CENTRAL_PLAZA_GLB_MOUNT_Y,
  VINTAGE_CAFE_GLB_ORIGIN_SHIFT_X,
  VINTAGE_CAFE_GLB_SCALE,
} from './buddiesUrbanPlazaBuildingsBuilder';
import {
  SALON_EXTERIOR_GLB_SCALE,
  SALON_GLB_SCALE,
} from './buddiesBeautySalonRules';
import { CENTRAL_PARK_BENCHES, CENTRAL_PARK_MASTERPLAN } from './buddiesCentralParkRules';

test('optimizeCentralPlazaBuildingGlb merges static meshes by material and adds glowing window glass with ZERO extra draw calls', () => {
  const root = new THREE.Group();
  const stuccoMat = new THREE.MeshStandardMaterial({ name: 'Stucco_Warm_Ivory', color: '#f3ede0' });
  const brassMat = new THREE.MeshStandardMaterial({ name: 'Metal_Brushed_Brass', color: '#d4ab62', metalness: 0.7 });
  const glassClearMat = new THREE.MeshStandardMaterial({
    name: 'Glass_Boutique_Clear',
    color: '#d8e8f2',
    transparent: true,
    opacity: 0.2,
  });
  const glassUpperMat = new THREE.MeshStandardMaterial({
    name: 'Glass_Upper_Tinted',
    color: '#34424d',
  });
  const signMat = new THREE.MeshStandardMaterial({
    name: 'Sign_Cerria_Fascia',
    color: '#ffffff',
  });
  const lightMat = new THREE.MeshStandardMaterial({
    name: 'Light_Sconce_Warm',
    color: '#fff0d0',
    emissive: '#ffcf88',
    emissiveIntensity: 1.0,
  });

  // Create 20 scattered submeshes across 6 unique materials (simulating unmerged GLB hierarchy)
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), stuccoMat);
    m.position.set(i * 2, 0.5, 0);
    root.add(m);
  }
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2, 0.2), brassMat);
    m.position.set(i, 1, 1);
    root.add(m);
  }
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.0), glassClearMat);
    m.name = `Window_Glass_${i}`;
    m.position.set(i * 2, 1.5, 2);
    root.add(m);
  }
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), glassUpperMat);
    m.name = `Arch_Glass_${i}`;
    m.position.set(i * 2, 5.0, 2);
    root.add(m);
  }
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.6), signMat);
    m.name = `Sign_Front_${i}`;
    m.position.set(0, 3.5 + i, 2.1);
    root.add(m);
  }
  const sconce = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), lightMat);
  sconce.name = 'Sconce_Glow';
  root.add(sconce);

  const glowUniforms = createPlazaBuildingGlowUniforms();
  const report = optimizeCentralPlazaBuildingGlb(root, {
    buildingId: 'TestPlazaBuilding',
    glowUniforms,
    isSoftwareGl: false,
  });

  // 20 scattered draw calls collapse cleanly to 6 (1 per unique material) — 0 extra meshes for glow!
  assert.equal(report.beforeDrawCalls, 20);
  assert.equal(report.afterDrawCalls, 6);
  assert.equal(report.savedDrawCalls, 14);
  assert.equal(report.glowingGlassMaterials, 2);
  assert.equal(report.glowingFixtureMaterials, 1);
  assert.equal(report.zFightProtectedMaterials, 3); // 2 glass mats + 1 wall sign mat

  let meshCount = 0;
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) meshCount++;
  });
  assert.equal(meshCount, 6, 'Glowing glass must add ZERO extra meshes / draw calls');

  // Verify glowing glass & Z-fighting protection properties
  assert.equal(glassClearMat.userData.__plazaZeroDrawCallGlowAttached, true);
  assert.equal(glassClearMat.depthWrite, false);
  assert.equal(glassClearMat.polygonOffset, true);
  assert.ok(glassClearMat.emissiveIntensity > 0);
  assert.equal(glassUpperMat.userData.__plazaZeroDrawCallGlowAttached, true);
  assert.equal(glassUpperMat.polygonOffset, true);
  assert.equal(signMat.polygonOffset, true);
  assert.ok(signMat.polygonOffsetFactor < 0);
});

test('Central Plaza building scales clear the 3.31m outdoor avatar & screenshot layout edits stay geometrically valid', () => {
  const outdoorAvatarHeightM = 3.31;

  // All 3 Central Plaza exterior buildings clear the 3.31m avatar at both door and awning!
  const vintageDoorM = 2.8 * VINTAGE_CAFE_GLB_SCALE;
  const vintageAwningM = 2.73 * VINTAGE_CAFE_GLB_SCALE;
  const bitesDoorM = 2.7 * BITES_SIPS_PAVILION_GLB_SCALE;
  const bitesAwningM = 2.41 * BITES_SIPS_PAVILION_GLB_SCALE;
  const salonDoorFrameM = 2.7 * SALON_EXTERIOR_GLB_SCALE;
  const salonDoorLeafM = 2.54 * SALON_EXTERIOR_GLB_SCALE;
  const salonAwningM = 2.38 * SALON_EXTERIOR_GLB_SCALE;

  assert.ok(vintageDoorM >= 3.85 && vintageAwningM > outdoorAvatarHeightM);
  assert.ok(bitesDoorM >= 3.9 && bitesAwningM > outdoorAvatarHeightM);
  assert.ok(salonDoorFrameM >= 3.7 && salonDoorLeafM > outdoorAvatarHeightM && salonAwningM > outdoorAvatarHeightM);
  assert.ok(SALON_EXTERIOR_GLB_SCALE > SALON_GLB_SCALE, 'Exterior salon scale must be larger than 0.55x-avatar interior scale');

  // Z-fighting guard: GLB exterior mounts sit cleanly above the 0.042m Central Plaza terrazzo top
  assert.ok(CENTRAL_PLAZA_GLB_MOUNT_Y > 0.042, 'GLB building mounts must clear 0.042m terrazzo top');

  // Vintage Cafe shifted West with comfortable margin from West curb (-9.50)
  const vintageOriginX = CENTRAL_PARK_MASTERPLAN.boutiqueTower.x + VINTAGE_CAFE_GLB_ORIGIN_SHIFT_X;
  const vintageWestWallX = vintageOriginX - 4.04 * VINTAGE_CAFE_GLB_SCALE;
  assert.ok(vintageOriginX < 8.0, 'Vintage Cafe must be shifted West from its old 10.52 position');
  assert.ok(
    vintageWestWallX - CENTRAL_PARK_MASTERPLAN.bounds.minX >= 9.0,
    'Vintage Cafe must keep generous margin from outer West curb (-9.50)',
  );

  // Fountain benches: 3 removed, 1 relocated north facing due South (rotY = 0)
  const benchIds = new Set(CENTRAL_PARK_BENCHES.map((b) => b.id));
  assert.equal(benchIds.has('urban_lawn_bench_n'), false);
  assert.equal(benchIds.has('urban_lawn_bench_s'), false);
  assert.equal(benchIds.has('urban_fountain_bench_se'), false);
  const nwBench = CENTRAL_PARK_BENCHES.find((b) => b.id === 'urban_fountain_bench_nw');
  assert.ok(nwBench);
  assert.equal(nwBench.rotY, 0);
  assert.ok(nwBench.z <= -10.0);
});
